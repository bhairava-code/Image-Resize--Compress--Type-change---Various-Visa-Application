import {PRESETS,toPixels,parseRequest,cropGeometry,renderPhoto,chooseEncoding,setJpegDensity,setPngDensity,formatBytes} from './core.js';
import {exportFilename,canSaveToDevice,saveToDevice} from './save.js';

const $ = id => document.getElementById(id);
const state = {mode:'preset',preset:'india',format:'image/jpeg',image:null,file:null,rotation:0,zoom:1,panX:0,panY:0,revision:0,busy:false,output:null,outputUrl:null,loadId:0,aspect:1,preview:false};
const MIME_EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function showError(id,message){$(id).textContent=message;$(id).hidden=!message;}
function preset(){return PRESETS.find(p=>p.id===state.preset);}
function clearOutput(){
  state.revision++;state.output=null;state.preview=false;
  if(state.outputUrl){URL.revokeObjectURL(state.outputUrl);state.outputUrl=null;}
  $('result-panel').hidden=true;$('export-preview').hidden=true;$('export-preview').removeAttribute('src');
  for(const id of ['download','download-direct','open-image']){$(id).removeAttribute('href');$(id).removeAttribute('download');}
  $('download-status').hidden=true;$('download-status').textContent='';
  $('download').setAttribute('aria-disabled','false');
  $('editor-bottom').hidden=false;$('export-label').textContent=state.busy?'Processing…':state.mode==='compress'?'Compress photo':'Resize & compress';
  $('stage-label').textContent=state.image?'YOUR CROP PREVIEW':'A SPACE FOR YOUR PHOTO';
  $('stage-instruction').textContent=state.image?(state.mode==='compress'?'Original framing preserved':'Drag to position · arrow keys to fine-tune'):'Your photo stays on this device';
  updateControls();
}
function resetCrop(){state.zoom=1;state.panX=0;state.panY=0;state.rotation=0;$('zoom').value='1';$('zoom-value').textContent='100%';}
function setTarget(kb){if(kb==null){$('target-size').value='';$('size-unit').value='KB';}else if(kb>=1000){$('size-unit').value='MB';$('target-size').value=String(kb/1000);}else{$('size-unit').value='KB';$('target-size').value=String(kb);}}
function setFormat(format){
  state.format=format;
  for(const button of document.querySelectorAll('[data-format]')){
    const active=button.dataset.format===format;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    button.disabled=state.mode==='preset' && button.dataset.format!==preset().format;
  }
  $('quality').disabled=format==='image/png';
  $('quality-value').textContent=format==='image/png'?'Lossless':`${$('quality').value}%`;
  $('format-help').textContent=state.mode==='preset'?'JPEG is required for this application.':format==='image/png'?'Lossless PNG preserves transparency. A tight size limit may be unreachable.':format==='image/webp'?'Smaller files with transparency. Check whether your upload form accepts WebP.':'Widely accepted. Transparent areas and padding become white.';
}
function applyPreset(id){
  state.preset=id;const p=preset();$('preset-select').value=id;
  $('width').value=p.w;$('height').value=p.h;$('unit').value=p.unit;$('dpi').value=p.dpi;state.aspect=p.w/p.h;
  setTarget(p.maxKB);$('fit').value='cover';$('quality').value='95';
  $('preset-type').textContent=p.type;$('preset-rule').textContent=p.rule;$('preset-source').href=p.url;
  for(const button of document.querySelectorAll('[data-preset]')){const active=button.dataset.preset===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  setFormat(p.format);resetCrop();clearOutput();refreshDimensions();
}
function setMode(mode,apply=true){
  state.mode=mode;
  for(const button of document.querySelectorAll('[data-mode]')){const active=button.dataset.mode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  $('preset-fields').hidden=mode!=='preset';$('custom-fields').hidden=mode!=='custom';$('compress-fields').hidden=mode!=='compress';
  $('quality').min=mode==='preset'?'55':'30';
  if(mode==='preset' && apply){applyPreset(state.preset);return;}
  if(mode==='compress'){resetCrop();if(!$('target-size').value)setTarget(200);}
  setFormat(mode==='preset'?preset().format:state.format);clearOutput();refreshDimensions();
}
function readSettings(){
  let w=+$('width').value,h=+$('height').value,unit=$('unit').value,dpi=+$('dpi').value;
  if(state.mode==='compress'){
    if(!state.image)throw new Error('Choose a photo to begin.');
    w=state.image.width;h=state.image.height;unit='px';dpi=300;
  }
  const {width,height}=toPixels(w,h,unit,dpi);
  const amount=$('target-size').value.trim(),value=+amount;
  const maxKB=amount===''?null:value*($('size-unit').value==='MB'?1000:1);
  if(maxKB!==null && (!Number.isFinite(maxKB)||maxKB<1||maxKB>50000))throw new Error('Choose a file limit between 1 KB and 50 MB, or leave it blank.');
  const p=state.mode==='preset'?preset():null;
  return {width,height,unit,w,h,dpi,format:state.format,targetBytes:maxKB===null?null:Math.floor(maxKB*1000),maxQuality:+$('quality').value/100,minQuality:p ? 0.55 : 0.3,preset:p,rotation:state.rotation,zoom:state.zoom,panX:state.panX,panY:state.panY,fit:state.mode==='custom'?$('fit').value:'cover',transparent:state.mode!=='preset' && state.format!=='image/jpeg'};
}
function updateControls(){
  const editable=!!state.image && state.mode!=='compress' && !state.preview;
  const canZoom=editable && !(state.mode==='custom' && $('fit').value==='contain');
  for(const id of ['zoom','zoom-in','zoom-out'])$(id).disabled=!canZoom;
  for(const id of ['rotate','reset-crop'])$(id).disabled=!editable;
  $('show-guide').disabled=!state.image || state.mode==='compress' || state.preview;
  $('export').disabled=!state.image || state.busy;
  $('export-footnote').textContent=state.image?'Processed here. Ready to download in seconds.':'Add a photo to get started';
  $('composition-guide').classList.toggle('visible',$('show-guide').checked && !!state.image && state.mode!=='compress' && !state.preview);
}
function refreshDimensions(){
  try{
    const s=readSettings();$('dimension-chip').textContent=`${s.width} × ${s.height} px`;
    $('pixel-conversion').textContent=`Output: ${s.width.toLocaleString()} × ${s.height.toLocaleString()} px${s.unit!=='px'?` at ${s.dpi} DPI`:''}`;
    showError('settings-error','');draw();
  }catch(error){if(state.mode==='compress' && !state.image){$('dimension-chip').textContent='Original dimensions';showError('settings-error','');}else showError('settings-error',error.message);}
}
function draw(){
  if(!state.image)return;
  let s;try{s=readSettings();}catch{return;}
  const stage=$('drop-zone'),maxW=Math.max(1,stage.clientWidth-48),maxH=Math.max(1,stage.clientHeight-98);
  const ratio=s.width/s.height,displayW=Math.min(maxW,maxH*ratio),displayH=displayW/ratio;
  const wrap=$('canvas-wrap');wrap.style.width=`${displayW}px`;wrap.style.height=`${displayH}px`;
  const canvas=$('photo-canvas'),scale=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(displayW*scale));canvas.height=Math.max(1,Math.round(displayH*scale));renderPhoto(canvas,state.image,s);
  const head=s.preset?.head,oval=document.querySelector('.guide-oval');
  const headHeight=head?((head[0]+head[1])/2)*100:62;
  oval.style.height=`${headHeight}%`;oval.style.top=`${(100-headHeight)/2-3}%`;
  updateControls();
}

async function loadPhoto(file){
  if(!file)return;
  const id=++state.loadId;showError('upload-error','');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){showError('upload-error','Choose a JPG, PNG or WebP image. Convert HEIC files to JPG first.');return;}
  if(file.size>50000000){showError('upload-error','This file is over 50 MB. Choose a smaller image.');return;}
  $('choose-photo').disabled=true;$('choose-photo').textContent='Opening photo…';
  let image;
  try{
    if(typeof createImageBitmap==='function') image=await createImageBitmap(file,{imageOrientation:'from-image'});
    else{
      const url=URL.createObjectURL(file);
      try{image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('This image could not be opened.'));img.src=url;});}finally{URL.revokeObjectURL(url);}
    }
    if(id!==state.loadId){image.close?.();return;}
    if(image.width*image.height>40000000){image.close?.();throw new Error('This image is over 40 megapixels. Choose a smaller source image.');}
    state.image?.close?.();state.image=image;state.file=file;state.aspect=image.width/image.height;resetCrop();
    $('empty-state').hidden=true;$('canvas-wrap').hidden=false;$('replace-photo').hidden=false;$('file-hint').hidden=true;$('file-strip').hidden=false;
    $('file-name').textContent=file.name||'Pasted image';$('file-details').textContent=`${image.width.toLocaleString()} × ${image.height.toLocaleString()} px · ${formatBytes(file.size)}`;
    $('original-dimensions').textContent=`${image.width.toLocaleString()} × ${image.height.toLocaleString()} px · unchanged`;
    if(state.mode==='custom' && $('lock-ratio').checked)$('height').value=String(Math.round(+$('width').value/state.aspect*100)/100);
    clearOutput();refreshDimensions();
  }catch(error){showError('upload-error',error.message||'This image could not be opened. Try another JPG, PNG or WebP.');}
  finally{if(id===state.loadId){$('choose-photo').disabled=false;$('choose-photo').innerHTML='<svg><use href="#i-upload"/></svg>Choose a photo';}}
}

function removePhoto(){
  state.loadId++;state.image?.close?.();state.image=null;state.file=null;clearOutput();resetCrop();
  $('canvas-wrap').hidden=true;$('empty-state').hidden=false;$('replace-photo').hidden=true;$('file-hint').hidden=false;$('file-strip').hidden=true;$('file-input').value='';
  $('choose-photo').disabled=false;$('choose-photo').innerHTML='<svg><use href="#i-upload"/></svg>Choose a photo';
  $('original-dimensions').textContent='Choose a photo to begin';showError('upload-error','');refreshDimensions();
}

async function exportPhoto(){
  if(!state.image||state.busy)return;
  let s;try{s=readSettings();}catch(error){showError('settings-error',error.message);return;}
  clearOutput();const revision=state.revision;state.busy=true;updateControls();$('export-label').textContent='Processing…';showError('settings-error','');
  let canvas;
  try{
    canvas=document.createElement('canvas');canvas.width=s.width;canvas.height=s.height;renderPhoto(canvas,state.image,s);
    const encode=async quality=>{
      if(revision!==state.revision)throw new Error('Settings changed. Generate your photo again.');
      let blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('The image could not be encoded. Try smaller dimensions.')),s.format,quality));
      if(blob.type!==s.format)throw new Error('Your browser cannot export this format. Choose JPG or PNG.');
      if(s.format==='image/jpeg')blob=new Blob([setJpegDensity(await blob.arrayBuffer(),s.dpi)],{type:s.format});
      else if(s.format==='image/png')blob=new Blob([setPngDensity(await blob.arrayBuffer(),s.dpi)],{type:s.format});
      return blob;
    };
    const result=await chooseEncoding(encode,{targetBytes:s.targetBytes,maxQuality:s.maxQuality,minQuality:s.minQuality,lossless:s.format==='image/png'});
    if(revision!==state.revision)throw new Error('Settings changed. Generate your photo again.');
    const originalBytes=state.file.size,warnings=[];
    if(!result.met)warnings.push(`The ${formatBytes(s.targetBytes)} target could not be reached at the selected dimensions. This file is ${formatBytes(result.blob.size)}. ${s.format==='image/png'?'Try JPG or WebP, or increase the file limit.':'Increase the file limit or use smaller custom dimensions. Further compression may harm photo clarity.'}`);
    if(s.preset?.maxKB && result.blob.size>s.preset.maxKB*1000)warnings.push(`This exceeds the ${s.preset.country} ${s.preset.short} preset’s ${formatBytes(s.preset.maxKB*1000)} maximum.`);
    if(s.preset?.minKB && result.blob.size<s.preset.minKB*1000)warnings.push(`This is below the preset’s ${s.preset.minKB} KB minimum. Increase maximum quality, or use a higher-resolution source and suitable larger custom dimensions.`);
    if(s.preset?.id==='us' && s.width*s.height*3/result.blob.size>20)warnings.push('The estimated uncompressed-to-file ratio exceeds the US 20:1 limit. Increase maximum quality and the file limit, or use a better source.');
    const swap=s.rotation===90||s.rotation===270,iw=swap?state.image.height:state.image.width,ih=swap?state.image.width:state.image.height;
    if(cropGeometry(iw,ih,s.width,s.height,s.zoom,s.panX,s.panY,s.fit).scale>1.02)warnings.push('This export enlarges the source photo. Check sharpness at full size; resizing cannot recover missing detail.');
    if(s.unit!=='px' && s.format==='image/webp')warnings.push('WebP does not include print DPI here. Choose JPG or PNG to preserve physical print sizing.');
    const filename=exportFilename(state.file.name,s);
    state.output={...result,settings:s,filename};state.outputUrl=URL.createObjectURL(result.blob);state.preview=true;
    for(const id of ['download','download-direct']){$(id).href=state.outputUrl;$(id).download=filename;}
    $('open-image').href=state.outputUrl;
    $('export-preview').src=state.outputUrl;$('export-preview').hidden=false;$('composition-guide').classList.remove('visible');
    $('stage-label').textContent='YOUR EXPORTED PHOTO';$('stage-instruction').textContent='Preview of the actual download';
    $('result-heading').textContent=warnings.length?'Export ready · check details':'Your photo is ready';
    $('result-dimensions').textContent=`${s.width} × ${s.height}`;$('result-size').textContent=formatBytes(result.blob.size);
    const saving=(1-result.blob.size/originalBytes)*100;
    $('result-third-label').textContent=saving>=0?'Smaller by':'Larger by';$('result-saving').textContent=`${Math.abs(saving).toFixed(1)}%`;
    $('result-warning').textContent=warnings.join(' ');$('result-warning').hidden=!warnings.length;
    const format=MIME_EXT[s.format].toUpperCase(),density=s.format==='image/webp'?'':` · ${s.dpi} DPI`,quality=result.quality===null?' · lossless':` · ${Math.round(result.quality*100)}% encoder quality`;
    $('result-detail').textContent=`${format}${density}${quality}${s.unit!=='px'?` · print at ${s.w} × ${s.h} ${s.unit}`:''}. ${s.preset?'Dimensions and file size checked; facial composition and acceptance are not certified.':'Original metadata is not copied.'}`;
    $('download-label').textContent=`Download ${format} · ${formatBytes(result.blob.size)}`;
    $('result-panel').hidden=false;$('editor-bottom').hidden=true;
    if(window.innerWidth<=760)$('result-panel').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
  }catch(error){showError('settings-error',error.message||'Export failed. Try a smaller image or different format.');}
  finally{if(canvas){canvas.width=1;canvas.height=1;}state.busy=false;$('export-label').textContent=state.mode==='compress'?'Compress photo':'Resize & compress';updateControls();}
}

function showDownloadStatus(message){$('download-status').textContent=message;$('download-status').hidden=false;}

async function downloadPhoto(event){
  if(!state.output || !state.outputUrl || $('download').getAttribute('aria-disabled')==='true'){event.preventDefault();return;}
  if(!canSaveToDevice(window)){
    // Let the user's real click follow the persistent download link.
    // A browser download cannot be confirmed by JavaScript.
    showDownloadStatus('Check your browser’s downloads. If no file appears, choose Open image below, then right-click or long-press the image and save it.');
    return;
  }
  event.preventDefault();
  const output=state.output;
  $('download').setAttribute('aria-disabled','true');
  showDownloadStatus('Choose where to save your photo.');
  const result=await saveToDevice(output.blob,output.filename,window);
  if(state.output!==output)return;
  $('download').setAttribute('aria-disabled','false');
  if(result.status==='saved'){showDownloadStatus(`Saved: ${output.filename}`);toast('Photo saved to your chosen location.');}
  else if(result.status==='cancelled')showDownloadStatus('Save cancelled. Your photo is still ready to download.');
  else if(result.status==='unavailable')showDownloadStatus('The save dialog is unavailable here. Use Direct download, or Open image and choose Save image as.');
  else showDownloadStatus('The file could not be saved. Try Direct download, or Open image and choose Save image as.');
}

function applyRequest(text){
  try{
    const parsed=parseRequest(text);
    if(parsed.preset){setMode('preset',false);applyPreset(parsed.preset);}
    if(parsed.w){setMode('custom',false);$('width').value=parsed.w;$('height').value=parsed.h;$('unit').value=parsed.unit;$('dpi').value=parsed.dpi||300;$('lock-ratio').checked=false;state.aspect=parsed.w/parsed.h;resetCrop();}
    else if(!parsed.preset && parsed.maxKB!=null)setMode('compress',false);
    if(parsed.maxKB!=null)setTarget(parsed.maxKB);
    if(parsed.format){if(state.mode==='preset' && parsed.format!==preset().format)setMode('custom',false);setFormat(parsed.format);}
    clearOutput();refreshDimensions();
    let description=parsed.w?`${parsed.w} × ${parsed.h} ${parsed.unit}`:parsed.preset?`${preset().country} · ${preset().short}`:'Original dimensions';
    if(parsed.maxKB!=null)description+=` · up to ${formatBytes(parsed.maxKB*1000)}`;
    $('request-feedback').textContent=`Applied: ${description}`;$('request-feedback').classList.remove('error');
  }catch(error){$('request-feedback').textContent=error.message;$('request-feedback').classList.add('error');}
}

for(const p of PRESETS){const option=document.createElement('option');option.value=p.id;option.textContent=`${p.flag} ${p.country} — ${p.short}`;$('preset-select').append(option);}
for(const p of PRESETS.filter(p=>p.id!=='india-evisa')){const button=document.createElement('button');button.type='button';button.dataset.preset=p.id;button.textContent=p.flag;button.title=`${p.country}: ${p.type}`;button.setAttribute('aria-label',button.title);button.addEventListener('click',()=>applyPreset(p.id));$('popular-presets').append(button);}
for(const p of PRESETS){const article=document.createElement('article');article.className='guide-card';const h=document.createElement('h3');const flag=document.createElement('span');flag.textContent=p.flag;h.append(flag,document.createTextNode(p.country));const type=document.createElement('span');type.textContent=p.type;const rule=document.createElement('p');rule.textContent=p.rule;const note=document.createElement('p');note.textContent=p.note;const link=document.createElement('a');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Official requirements ↗';article.append(h,type,rule,note,link);if(p.extraUrl){const extra=document.createElement('a');extra.href=p.extraUrl;extra.target='_blank';extra.rel='noopener noreferrer';extra.textContent=' · Upload guide ↗';article.append(extra);}$('guide-cards').append(article);}

$('request-form').addEventListener('submit',e=>{e.preventDefault();applyRequest($('request').value);});
for(const button of document.querySelectorAll('[data-request]'))button.addEventListener('click',()=>{$('request').value=button.dataset.request;applyRequest(button.dataset.request);});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>setMode(button.dataset.mode));
for(const button of document.querySelectorAll('[data-format]'))button.addEventListener('click',()=>{setFormat(button.dataset.format);clearOutput();draw();});
for(const button of document.querySelectorAll('[data-kb]'))button.addEventListener('click',()=>{setTarget(+button.dataset.kb);clearOutput();refreshDimensions();});
$('preset-select').addEventListener('change',()=>applyPreset($('preset-select').value));
for(const id of ['choose-photo','replace-photo'])$(id).addEventListener('click',()=>$('file-input').click());
$('file-input').addEventListener('change',()=>{const file=$('file-input').files?.[0];$('file-input').value='';loadPhoto(file);});
$('remove-photo').addEventListener('click',removePhoto);
const drop=$('drop-zone');
let dragDepth=0;
drop.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;drop.classList.add('dragover');});
drop.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
drop.addEventListener('dragleave',()=>{dragDepth--;if(dragDepth<=0)drop.classList.remove('dragover');});
drop.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;drop.classList.remove('dragover');loadPhoto(e.dataTransfer.files?.[0]);});
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});
document.addEventListener('paste',e=>{const file=[...(e.clipboardData?.items||[])].find(item=>item.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();loadPhoto(file);}});
for(const id of ['target-size','size-unit','dpi','fit'])$(id).addEventListener('input',()=>{clearOutput();refreshDimensions();});
for(const id of ['width','height'])$(id).addEventListener('input',()=>{
  if($('lock-ratio').checked && +$(id).value>0){const other=id==='width'?'height':'width';const value=id==='width'?+$(id).value/state.aspect:+$(id).value*state.aspect;$(other).value=String($('unit').value==='px'?Math.round(value):Math.round(value*100)/100);}
  clearOutput();refreshDimensions();
});
$('lock-ratio').addEventListener('change',()=>{state.aspect=+$('width').value/+$('height').value||1;});
let lastUnit='px';
$('unit').addEventListener('focus',()=>lastUnit=$('unit').value);
$('unit').addEventListener('change',()=>{const next=$('unit').value,dpi=+$('dpi').value||300,factor=u=>u==='px'?1:{mm:25.4,cm:2.54,in:1}[u]/dpi;for(const id of ['width','height']){const value=+$(id).value/factor(lastUnit)*factor(next);$(id).value=String(next==='px'?Math.round(value):Math.round(value*100)/100);}lastUnit=next;clearOutput();refreshDimensions();});
$('quality').addEventListener('input',()=>{$('quality-value').textContent=`${$('quality').value}%`;clearOutput();});
function changeZoom(value){state.zoom=Math.min(4,Math.max(1,value));$('zoom').value=String(state.zoom);$('zoom-value').textContent=`${Math.round(state.zoom*100)}%`;clearOutput();draw();}
$('zoom').addEventListener('input',()=>changeZoom(+$('zoom').value));$('zoom-in').addEventListener('click',()=>changeZoom(state.zoom+.1));$('zoom-out').addEventListener('click',()=>changeZoom(state.zoom-.1));
$('rotate').addEventListener('click',()=>{state.rotation=(state.rotation+90)%360;state.panX=0;state.panY=0;clearOutput();draw();});
$('reset-crop').addEventListener('click',()=>{resetCrop();clearOutput();draw();});
$('show-guide').addEventListener('change',updateControls);
let drag=null;
$('photo-canvas').addEventListener('pointerdown',e=>{
  if(!state.image||state.mode==='compress'||state.preview)return;
  let s;try{s=readSettings();}catch{return;}if(s.fit==='contain')return;
  const r=e.currentTarget.getBoundingClientRect(),swap=state.rotation===90||state.rotation===270;
  const geometry=cropGeometry(swap?state.image.height:state.image.width,swap?state.image.width:state.image.height,r.width,r.height,state.zoom,state.panX,state.panY,s.fit);
  drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,panX:state.panX,panY:state.panY,geometry};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus({preventScroll:true});
});
$('photo-canvas').addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;const {geometry:g}=drag;state.panX=g.overflowX?Math.max(-1,Math.min(1,drag.panX+(e.clientX-drag.x)/g.overflowX)):0;state.panY=g.overflowY?Math.max(-1,Math.min(1,drag.panY+(e.clientY-drag.y)/g.overflowY)):0;clearOutput();draw();});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('photo-canvas').addEventListener(name,()=>drag=null);
$('photo-canvas').addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)||state.mode==='compress'||state.preview)return;e.preventDefault();const amount=e.shiftKey?.12:.025;if(e.key==='ArrowLeft')state.panX=Math.max(-1,state.panX-amount);if(e.key==='ArrowRight')state.panX=Math.min(1,state.panX+amount);if(e.key==='ArrowUp')state.panY=Math.max(-1,state.panY-amount);if(e.key==='ArrowDown')state.panY=Math.min(1,state.panY+amount);clearOutput();draw();});
$('export').addEventListener('click',exportPhoto);$('download').addEventListener('click',downloadPhoto);
$('download-direct').addEventListener('click',event=>{if(!state.output){event.preventDefault();return;}showDownloadStatus('Check your browser’s downloads. If nothing appears, Open image and save it with a right-click or long-press.');});
$('open-image').addEventListener('click',event=>{if(!state.output){event.preventDefault();return;}showDownloadStatus('In the image tab, right-click the photo and choose Save image as. On a phone, long-press the image. You can also save directly from the preview above.');});
$('back-to-crop').addEventListener('click',()=>{clearOutput();draw();$('photo-canvas').focus();});
for(const id of ['guide-open','guide-open-bottom'])$(id).addEventListener('click',()=>$('guide-dialog').showModal());
$('guide-close').addEventListener('click',()=>$('guide-dialog').close());
$('guide-dialog').addEventListener('click',e=>{if(e.target===$('guide-dialog')){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();}});
new ResizeObserver(draw).observe($('drop-zone'));
window.addEventListener('beforeunload',()=>{state.image?.close?.();if(state.outputUrl)URL.revokeObjectURL(state.outputUrl);});
applyPreset('india');
