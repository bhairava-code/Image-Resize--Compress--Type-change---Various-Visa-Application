export const PRESETS = [
  { id: 'india', country: 'India', flag: '🇮🇳', type: 'Regular visa · digital', short: 'Regular visa', w: 600, h: 600, unit: 'px', dpi: 300, maxKB: 300, minKB: 10, format: 'image/jpeg', head: [.50,.69], label: '600 × 600 px', rule: 'Square JPEG, 10–300 KB. The official upload guide allows 350–1,000 px per side; this preset uses 600 px.', note: 'Use a recent, front-facing photograph on a plain light or white background. Include the full head, without borders.', url: 'https://www.indianvisaonline.gov.in/visa/instruction.html', extraUrl: 'https://indianvisaonline.gov.in/visa/VSS_IMAGE.pdf', aliases: /\b(india|indian)\b/i },
  { id: 'us', country: 'United States', flag: '🇺🇸', type: 'Visa · digital', short: 'US visa', w: 600, h: 600, unit: 'px', dpi: 300, maxKB: 240, minKB: 0, format: 'image/jpeg', head: [.50,.69], label: '600 × 600 px', rule: 'Square JPEG, 600–1,200 px per side, up to 240 KB. This preset uses 600 px. Compression ratio must be no greater than 20:1.', note: 'Head height should be 50–69% of the image. Use a plain white or off-white background. The app does not verify facial composition.', url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html', aliases: /\b(united states|usa|u\.s\.|us visa|american)\b/i },
  { id: 'uk', country: 'United Kingdom', flag: '🇬🇧', type: 'Visa / permission · digital', short: 'UK visa', w: 600, h: 750, unit: 'px', dpi: 300, maxKB: 6000, minKB: 50, format: 'image/jpeg', label: '600 × 750 px', rule: 'JPEG, at least 600 × 750 px, 50 KB–6 MB. This preset uses the minimum dimensions.', note: 'Show your head, shoulders and upper body on a plain light background. Do not mirror or alter your appearance. For passports, follow the separate passport instructions.', url: 'https://www.gov.uk/guidance/how-to-take-a-photo-for-a-visa-application-or-permission', aliases: /\b(united kingdom|uk|britain|british)\b/i },
  { id: 'germany', country: 'Germany', flag: '🇩🇪', type: 'Schengen visa · print', short: 'Schengen visa', w: 35, h: 45, unit: 'mm', dpi: 300, maxKB: null, minKB: 0, format: 'image/jpeg', head: [.70,.80], label: '35 × 45 mm', rule: '35 × 45 mm with a white background. This preset exports 413 × 531 px at 300 DPI for printing.', note: 'German Embassy Dhaka instructions specify 70–80% face coverage. Print at 35 × 45 mm with scaling disabled; confirm the rules of your destination embassy.', url: 'https://dhaka.diplo.de/blob/2245990/037f3d12604e06514ed4de6cff6496bd/c-tourist-visa-info-data.pdf', aliases: /\b(germany|german|schengen)\b/i },
  { id: 'canada', country: 'Canada', flag: '🇨🇦', type: 'Temporary resident visa · print', short: 'Visitor visa', w: 35, h: 45, unit: 'mm', dpi: 300, maxKB: null, minKB: 0, format: 'image/jpeg', head: [31/45,36/45], label: '35 × 45 mm', rule: 'Printed photographs at least 35 × 45 mm. This preset exports 413 × 531 px at 300 DPI.', note: 'Head height: 31–36 mm from chin to crown. These are printed temporary-resident-visa specifications, not Canadian passport or permanent-resident specifications.', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/temporary-resident-visa-application-photograph-specifications.html', aliases: /\b(canada|canadian)\b/i },
  { id: 'singapore', country: 'Singapore', flag: '🇸🇬', type: 'Visa · digital', short: 'Online visa', w: 400, h: 514, unit: 'px', dpi: 300, maxKB: 60, minKB: 0, format: 'image/jpeg', label: '400 × 514 px', rule: 'For the visa e-Service: JPEG, 400 × 514 px, no more than 60 KB. Other ICA applications have different limits.', note: 'Use a recent colour photograph taken within the last three months, facing forward against a white background.', url: 'https://ask.gov.sg/ica/questions/clos83fvx01lz5k0wkrclrdwg', aliases: /\b(singapore|singaporean)\b/i },
  { id: 'india-evisa', country: 'India', flag: '🇮🇳', type: 'e-Visa · digital', short: 'e-Visa', w: 600, h: 600, unit: 'px', dpi: 300, maxKB: 1000, minKB: 10, format: 'image/jpeg', label: '600 × 600 px', rule: 'Square JPEG, 10 KB–1 MB. The sample application specifies at least 350 × 350 px; this preset uses 600 px.', note: 'The e-Visa file limit differs from the regular visa portal. Follow your selected application’s upload instructions.', url: 'https://indianvisaonline.gov.in/evisa/tvoa.html', extraUrl: 'https://www.indianvisaonline.gov.in/evisa/images/SampleForm.pdf', aliases: /\b(e[ -]?visa)\b/i },
];

export const MAX_EDGE = 6000;
export const MAX_PIXELS = 24000000;
export function toPixels(w, h, unit = 'px', dpi = 300) {
  if (![w,h,dpi].every(x => Number.isFinite(+x) && +x > 0)) throw new Error('Enter a positive width, height and DPI.');
  if (!['px','mm','cm','in'].includes(unit)) throw new Error('Choose px, mm, cm or inches.');
  if (+dpi < 36 || +dpi > 1200) throw new Error('DPI must be between 36 and 1,200.');
  const scale = unit === 'px' ? 1 : +dpi / ({mm:25.4,cm:2.54,in:1}[unit]);
  const width = Math.round(+w * scale), height = Math.round(+h * scale);
  if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE || width*height > MAX_PIXELS) throw new Error('Use dimensions up to 6,000 px per side and 24 megapixels in total.');
  return {width,height};
}

function normalizeUnit(unit) {
  if (!unit || /^(px|pixels?)$/i.test(unit)) return 'px';
  if (/^(in|inch|inches|")$/i.test(unit)) return 'in';
  return unit.toLowerCase();
}

export function parseRequest(text) {
  const raw = text.trim().toLowerCase();
  if (!raw) throw new Error('Type a size, a country or a file limit first.');
  if (/(?:^|\s)-\d/.test(raw)) throw new Error('Dimensions and file limits must be positive.');
  const result = {};
  const unit = '(px|pixels?|mm|cm|inches|inch|in|")?';
  const dimensions = new RegExp('(\\d+(?:\\.\\d+)?)\\s*'+unit+'\\s*(?:x|×|\\*|by)\\s*(\\d+(?:\\.\\d+)?)\\s*'+unit, 'i').exec(raw);
  if (dimensions) {
    const first = dimensions[2] ? normalizeUnit(dimensions[2]) : null;
    const second = dimensions[4] ? normalizeUnit(dimensions[4]) : null;
    if(first && second && first !== second) throw new Error('Use the same unit for width and height.');
    result.w = +dimensions[1]; result.h = +dimensions[3]; result.unit = second || first || 'px';
  }
  const density = raw.match(/(\d+)\s*(?:dpi|ppi)\b/);
  if (density) result.dpi = +density[1];
  const size = raw.match(/(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|bytes?)\b/);
  if(size) {
    const multiplier = {kb:1000,kib:1024,mb:1000000,mib:1048576,byte:1,bytes:1}[size[2]];
    result.maxKB = +size[1] * multiplier / 1000;
    if (result.maxKB < 1 || result.maxKB > 50000) throw new Error('Choose a file limit between 1 KB and 50 MB.');
  }
  const format = raw.match(/\b(jpe?g|png|webp)\b/);
  if (format) result.format = {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}[format[1]];
  if (/\be[ -]?visa\b/.test(raw) && /\bindia(n)?\b/.test(raw)) result.preset = 'india-evisa';
  else result.preset = PRESETS.find(p=>p.id !== 'india-evisa' && p.aliases.test(raw))?.id;
  if (result.w != null) toPixels(result.w,result.h,result.unit,result.dpi || 300);
  if (!result.w && !result.maxKB && !result.preset) throw new Error('Try “600 × 600 px under 200 KB”, “35 × 45 mm at 300 DPI”, or “India visa”.');
  return result;
}

export function cropGeometry(iw, ih, ow, oh, zoom=1, panX=0, panY=0, fit='cover') {
  const base = (fit === 'contain' ? Math.min : Math.max)(ow/iw,oh/ih);
  const scale = base * (fit === 'contain' ? 1 : Math.max(1,zoom));
  const w = iw*scale, h = ih*scale;
  const x = (ow-w)/2 + Math.max(-1,Math.min(1,panX))*Math.max(0,(w-ow)/2);
  const y = (oh-h)/2 + Math.max(-1,Math.min(1,panY))*Math.max(0,(h-oh)/2);
  return {x,y,w,h,scale,overflowX:Math.max(0,(w-ow)/2),overflowY:Math.max(0,(h-oh)/2)};
}

export function renderPhoto(canvas, image, settings) {
  const ctx = canvas.getContext('2d');
  const {width,height} = canvas;
  const angle = ((settings.rotation || 0)%360+360)%360;
  const iw = image.width, ih = image.height;
  const swap = angle === 90 || angle === 270;
  const g = cropGeometry(swap?ih:iw,swap?iw:ih,width,height,settings.zoom,settings.panX,settings.panY,settings.fit);
  ctx.clearRect(0,0,width,height);
  if (!settings.transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,width,height); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.save(); ctx.translate(g.x+g.w/2,g.y+g.h/2); ctx.rotate(angle*Math.PI/180);
  ctx.drawImage(image,-iw*g.scale/2,-ih*g.scale/2,iw*g.scale,ih*g.scale);
  ctx.restore();
  return g;
}

export async function chooseEncoding(encode, {targetBytes=null, maxQuality=.95, minQuality=.3, lossless=false}={}) {
  const high = await encode(maxQuality);
  if (!targetBytes || high.size <= targetBytes || lossless) return {blob:high,quality:lossless?null:maxQuality,met:!targetBytes || high.size<=targetBytes};
  const low = await encode(minQuality);
  if (low.size > targetBytes) return {blob:low,quality:minQuality,met:false};
  let best = low, bestQuality=minQuality, left=minQuality, right=maxQuality;
  for (let i=0;i<8;i++) {
    const q = (left+right)/2;
    const blob = await encode(q);
    if(blob.size <= targetBytes) { best=blob;bestQuality=q;left=q; } else right=q;
  }
  return {blob:best,quality:bestQuality,met:true};
}

export function setJpegDensity(bytes,dpi) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if(src[0] !== 0xff || src[1] !== 0xd8) throw new Error('The browser did not return a JPEG image.');
  const d = Math.round(dpi);
  let i=2;
  while(i+8<src.length && src[i]===0xff) {
    const marker=src[i+1]; if(marker===0xda || marker===0xd9) break;
    const length=(src[i+2]<<8)|src[i+3]; if(length<2) break;
    if(marker===0xe0 && src[i+4]===0x4a && src[i+5]===0x46 && src[i+6]===0x49 && src[i+7]===0x46 && length>=16) {
      const out = src.slice(); out[i+11]=1; out[i+12]=d>>8;out[i+13]=d&255;out[i+14]=d>>8;out[i+15]=d&255;return out;
    }
    i+=length+2;
  }
  const jfif=new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,d>>8,d&255,d>>8,d&255,0,0]);
  const out=new Uint8Array(src.length+jfif.length);out.set(src.subarray(0,2));out.set(jfif,2);out.set(src.subarray(2),20);return out;
}

function crc32(bytes) {
  let crc=0xffffffff;
  for (const byte of bytes) {crc ^= byte;for(let b=0;b<8;b++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
export function setPngDensity(bytes,dpi) {
  const src=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(src[0]!==137 || src[1]!==80) throw new Error('The browser did not return a PNG image.');
  const chunk=new Uint8Array(21),view=new DataView(chunk.buffer),density=Math.round(dpi/0.0254);
  view.setUint32(0,9);chunk.set([112,72,89,115],4);view.setUint32(8,density);view.setUint32(12,density);chunk[16]=1;view.setUint32(17,crc32(chunk.subarray(4,17)));
  const parts=[src.subarray(0,8)],input=new DataView(src.buffer,src.byteOffset,src.byteLength);
  let pos=8,inserted=false;
  while(pos+12<=src.length){
    const size=input.getUint32(pos),end=pos+size+12;
    if(end>src.length)throw new Error('Invalid PNG data.');
    const name=String.fromCharCode(...src.subarray(pos+4,pos+8));
    if(name!=='pHYs') parts.push(src.subarray(pos,end));
    if(name==='IHDR' && !inserted){parts.push(chunk);inserted=true;}
    pos=end;
  }
  const out=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}

export function formatBytes(bytes) {
  if(bytes<1000) return `${bytes} B`;
  if(bytes<1000000) return `${(bytes/1000).toFixed(1)} KB`;
  return `${(bytes/1000000).toFixed(2)} MB`;
}
