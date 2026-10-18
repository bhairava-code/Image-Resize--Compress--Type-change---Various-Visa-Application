import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {PRESETS,toPixels,parseRequest,cropGeometry,renderPhoto,chooseEncoding,setJpegDensity,setPngDensity,formatBytes} from '../dist/core.js';

const require=createRequire(import.meta.url);
const paths=[process.cwd(),process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean);
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths}));
const sharp=require(require.resolve('sharp',{paths}));

test('physical units resolve to the intended rounded pixel dimensions',()=>{
  assert.deepEqual(toPixels(35,45,'mm',300),{width:413,height:531});
  assert.deepEqual(toPixels(3.5,4.5,'cm',300),{width:413,height:531});
  assert.deepEqual(toPixels(2,2,'in',300),{width:600,height:600});
  assert.deepEqual(toPixels(600,750,'px',300),{width:600,height:750});
});
test('unsafe and invalid output dimensions are rejected',()=>{
  for(const args of [[0,600],[-5,600],[Infinity,10],[6001,10],[6000,6000],[35,45,'mm',0],[35,45,'mm',99999],[30,50,'unknown']])assert.throws(()=>toPixels(...args));
});
test('all application presets have valid dimensions and primary source links',()=>{
  for(const p of PRESETS){assert.ok(toPixels(p.w,p.h,p.unit,p.dpi).width>0);assert.match(p.url,/^https:\/\//);assert.ok(p.minKB>=0);assert.equal(p.format,'image/jpeg');}
  assert.equal(PRESETS.find(p=>p.id==='india').maxKB,300);
  assert.equal(PRESETS.find(p=>p.id==='india-evisa').maxKB,1000);
  assert.equal(PRESETS.find(p=>p.id==='singapore').maxKB,60);
});
test('typed sizes support pixels, millimetres, inches, byte limits, and country aliases',()=>{
  const a=parseRequest('600 × 600 px, under 200 KB');assert.equal(a.w,600);assert.equal(a.h,600);assert.equal(a.maxKB,200);assert.equal(a.unit,'px');
  const b=parseRequest('35 by 45 mm at 300 DPI');assert.equal(b.unit,'mm');assert.equal(b.dpi,300);
  const c=parseRequest('2 inches x 2 inches under 0.2 MB jpg');assert.equal(c.unit,'in');assert.equal(c.maxKB,200);assert.equal(c.format,'image/jpeg');
  assert.equal(parseRequest('India visa under 100 KB').preset,'india');
  assert.equal(parseRequest('India e-visa').preset,'india-evisa');
  assert.equal(parseRequest('US visa').preset,'us');
  assert.equal(parseRequest('compress to 100 KB').maxKB,100);
  assert.equal(parseRequest('600x800 under 10 KiB').maxKB,10.24);
});
test('ambiguous units, nonsense, negative sizes, and unachievable dimensions return helpful errors',()=>{
  for(const text of ['','make it good','35mm x 45px','9000x9000','600x600 under 0 KB','-600 x 600 px','35x45mm at 2000dpi'])assert.throws(()=>parseRequest(text));
});
test('cover geometry fills the frame at all drag boundaries without distortion',()=>{
  for(const [iw,ih,ow,oh] of [[1200,800,600,600],[800,1200,600,600],[800,800,413,531]]){
    for(const zoom of [1,1.5,4])for(const px of [-2,0,2])for(const py of [-2,0,2]){
      const g=cropGeometry(iw,ih,ow,oh,zoom,px,py);
      assert.ok(g.x<=.00001 && g.y<=.00001);assert.ok(g.x+g.w>=ow-.00001 && g.y+g.h>=oh-.00001);
      assert.ok(Math.abs(g.w/g.h-iw/ih)<1e-8);
    }
  }
});
test('contain geometry keeps the entire image and centres padding',()=>{
  assert.deepEqual(cropGeometry(100,50,100,100,2,1,1,'contain'),{x:0,y:25,w:100,h:50,scale:1,overflowX:0,overflowY:0});
});

function stripedImage(){const c=createCanvas(120,60),ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,60,60);ctx.fillStyle='#0000ff';ctx.fillRect(60,0,60,60);return c;}
function pixel(canvas,x,y){return [...canvas.getContext('2d').getImageData(x,y,1,1).data];}
test('rendered images preserve crop geometry, rotation, padding, and alpha',()=>{
  const source=stripedImage(),out=createCanvas(100,100);
  renderPhoto(out,source,{zoom:1,panX:1,panY:0,rotation:0,fit:'cover'});
  assert.deepEqual(pixel(out,50,50),[255,0,0,255]);
  renderPhoto(out,source,{zoom:1,panX:-1,panY:0,rotation:0,fit:'cover'});
  assert.deepEqual(pixel(out,50,50),[0,0,255,255]);
  renderPhoto(out,source,{zoom:1,panX:0,panY:0,rotation:0,fit:'contain',transparent:true});
  assert.deepEqual(pixel(out,50,0),[0,0,0,0]);
  renderPhoto(out,source,{zoom:1,panX:0,panY:0,rotation:0,fit:'contain',transparent:false});
  assert.deepEqual(pixel(out,50,0),[255,255,255,255]);
  renderPhoto(out,source,{zoom:1,panX:0,panY:0,rotation:90,fit:'contain'});
  assert.deepEqual(pixel(out,50,15),[255,0,0,255]);assert.deepEqual(pixel(out,50,85),[0,0,255,255]);
});
test('a real JPEG export has the exact dimensions, decodes successfully, and carries 300 DPI',async()=>{
  const canvas=createCanvas(413,531);renderPhoto(canvas,stripedImage(),{zoom:1,panX:0,panY:0,rotation:0,fit:'cover'});
  const bytes=setJpegDensity(canvas.toBuffer('image/jpeg',90),300);
  const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,413);assert.equal(metadata.height,531);assert.equal(metadata.density,300);assert.equal(metadata.format,'jpeg');
  const decoded=await loadImage(Buffer.from(bytes));assert.equal(decoded.width,413);assert.equal(decoded.height,531);
});
test('JFIF density can be inserted into a JPEG without an existing JFIF segment',async()=>{
  const raw=await sharp({create:{width:80,height:100,channels:3,background:'#58ab7d'}}).jpeg().toBuffer();
  const withDensity=setJpegDensity(raw,600);assert.equal((await sharp(withDensity).metadata()).density,600);
  const updated=setJpegDensity(withDensity,300);assert.equal((await sharp(updated).metadata()).density,300);assert.equal(updated.length,withDensity.length);
});
test('PNG print density is valid and replacement does not duplicate metadata',async()=>{
  const canvas=createCanvas(413,531),raw=canvas.toBuffer('image/png'),out=setPngDensity(raw,300);
  const metadata=await sharp(out).metadata();assert.equal(metadata.width,413);assert.equal(metadata.height,531);assert.equal(metadata.density,300);
  const twice=setPngDensity(out,600);assert.equal(twice.length,out.length);assert.equal((await sharp(twice).metadata()).density,600);
  assert.equal((await loadImage(Buffer.from(twice))).width,413);
});
test('compression chooses the highest fitting quality and accurately reports impossible targets',async()=>{
  const encode=async quality=>new Blob([new Uint8Array(Math.round(quality*100000))],{type:'image/jpeg'});
  const result=await chooseEncoding(encode,{targetBytes:65000});assert.ok(result.met);assert.ok(result.blob.size<=65000);assert.ok(result.quality>.64);
  const impossible=await chooseEncoding(encode,{targetBytes:1000});assert.equal(impossible.met,false);assert.equal(impossible.quality,.3);
  const lossless=await chooseEncoding(encode,{targetBytes:1000,lossless:true});assert.equal(lossless.met,false);assert.equal(lossless.quality,null);
  const free=await chooseEncoding(encode);assert.equal(free.quality,.95);assert.equal(free.met,true);
});
test('real JPEG compression respects the byte budget without changing pixels',async()=>{
  const canvas=createCanvas(600,600),ctx=canvas.getContext('2d'),image=ctx.createImageData(600,600);let seed=17;
  for(let i=0;i<image.data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;image.data[i]=seed&255;image.data[i+1]=(seed>>>8)&255;image.data[i+2]=(seed>>>16)&255;image.data[i+3]=255;}ctx.putImageData(image,0,0);
  const encode=async quality=>new Blob([setJpegDensity(canvas.toBuffer('image/jpeg',Math.round(quality*100)),300)],{type:'image/jpeg'});
  const result=await chooseEncoding(encode,{targetBytes:180000,minQuality:.3});assert.ok(result.met);assert.ok(result.blob.size<=180000);
  const metadata=await sharp(await result.blob.arrayBuffer()).metadata();assert.equal(metadata.width,600);assert.equal(metadata.height,600);assert.equal(metadata.density,300);
});
test('file sizes use conservative decimal KB and MB',()=>{assert.equal(formatBytes(240000),'240.0 KB');assert.equal(formatBytes(1000000),'1.00 MB');assert.equal(formatBytes(400),'400 B');});
test('all UI elements referenced by the app exist, IDs are unique, and local resources resolve',()=>{
  const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),js=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),set=new Set(ids);assert.equal(ids.length,set.size);
  for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(set.has(id),`Missing element: ${id}`);
  for(const [,resource] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert.ok(fs.existsSync(new URL(`../dist/${resource}`,import.meta.url)),`Missing resource: ${resource}`);
  assert.doesNotMatch(js,/\b(fetch|XMLHttpRequest|sendBeacon)\s*\(/,'Photo processing should not use network requests');
});
