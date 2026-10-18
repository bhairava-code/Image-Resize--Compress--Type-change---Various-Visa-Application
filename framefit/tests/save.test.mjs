import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {exportFilename,canSaveToDevice,saveToDevice} from '../dist/save.js';

function browser(picker) {const self={};return {self,top:self,isSecureContext:true,showSaveFilePicker:picker};}
const photo=new Blob([new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,255,217])],{type:'image/jpeg'});

test('filenames remain safe and match the actual encoding',()=>{
  for(const [format,extension] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]){
    assert.equal(exportFilename('My photo (original).png',{width:600,height:750,format}),`My-photo-original-framefit-600x750.${extension}`);
    assert.ok(exportFilename('../photo.jpg',{width:600,height:600,format}).endsWith(`.${extension}`));
  }
  assert.equal(exportFilename('',{width:35,height:45,format:'image/jpeg'}),'photo-framefit-35x45.jpg');
});

test('native Save As writes the exact photo bytes and closes before confirming success',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'framefit-save-'));
  const file=path.join(dir,'photo.jpg');
  const events=[];
  const environment=browser(async options=>{
    events.push('picker');assert.equal(options.suggestedName,'photo.jpg');assert.deepEqual(options.types[0].accept,{'image/jpeg':['.jpg']});
    return {async createWritable(){const handle=await fs.open(file,'w');return {
      async write(blob){events.push('write');await handle.writeFile(Buffer.from(await blob.arrayBuffer()));},
      async close(){events.push('close');await handle.close();},
    };}};
  });
  try{
    const result=await saveToDevice(photo,'photo.jpg',environment);
    assert.deepEqual(result,{status:'saved'});assert.deepEqual(events,['picker','write','close']);
    assert.deepEqual(await fs.readFile(file),Buffer.from(await photo.arrayBuffer()));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('the save picker is invoked synchronously while the click gesture is active',async()=>{
  let invoked=false;
  const environment=browser(()=>{invoked=true;return Promise.reject(new DOMException('Cancelled','AbortError'));});
  const saving=saveToDevice(photo,'photo.jpg',environment);
  assert.equal(invoked,true);assert.deepEqual(await saving,{status:'cancelled'});
});

test('cancelling Save As does not write or report a successful download',async()=>{
  const result=await saveToDevice(photo,'photo.jpg',browser(async()=>{throw new DOMException('Cancelled','AbortError');}));
  assert.equal(result.status,'cancelled');
});

test('unsupported, insecure, and embedded contexts preserve the normal download route',async()=>{
  let called=0;
  for(const environment of [{},{...browser(()=>called++),isSecureContext:false},{...browser(()=>called++),top:{}}]){
    assert.equal(canSaveToDevice(environment),false);
    assert.deepEqual(await saveToDevice(photo,'photo.jpg',environment),{status:'unavailable'});
  }
  assert.equal(called,0);
});

test('browser permission restrictions are returned as unavailable instead of false success',async()=>{
  for(const name of ['SecurityError','NotAllowedError']){
    const result=await saveToDevice(photo,'photo.jpg',browser(async()=>{throw new DOMException('Blocked',name);}));
    assert.equal(result.status,'unavailable');
  }
});

test('write and close failures abort the stream and never confirm a saved file',async()=>{
  for(const phase of ['write','close']){
    let aborted=false;
    const result=await saveToDevice(photo,'photo.jpg',browser(async()=>({createWritable:async()=>({
      async write(){if(phase==='write')throw new Error('Disk full');},
      async close(){if(phase==='close')throw new Error('Failed to close');},
      async abort(){aborted=true;},
    })})));
    assert.equal(result.status,'failed');assert.equal(aborted,true);
  }
});

test('download and open-image fallbacks are persistent real links, not synthetic clicks',async()=>{
  const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const app=await fs.readFile(new URL('../dist/app.js',import.meta.url),'utf8');
  for(const id of ['download','download-direct','open-image'])assert.match(html,new RegExp(`<a\\b[^>]*id="${id}"[^>]*>`));
  assert.doesNotMatch(app,/anchor\.click\(\)|Download started\./);
  assert.match(app,/\$\('open-image'\)\.href=state\.outputUrl/);
});
