const EXTENSIONS = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};

export function exportFilename(originalName, settings) {
  const stem=(originalName||'photo').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'photo';
  const extension=EXTENSIONS[settings.format];
  if(!extension)throw new Error('Unsupported image format.');
  return `${stem}-framefit-${settings.width}x${settings.height}${extension}`;
}

export function canSaveToDevice(environment=globalThis) {
  try {
    return typeof environment.showSaveFilePicker==='function' && environment.isSecureContext!==false && environment.top===environment.self;
  } catch { return false; }
}

// Called directly from the user's click, before any other asynchronous work.
// Only report success after the writable file has actually closed.
export async function saveToDevice(blob, filename, environment=globalThis) {
  if(!canSaveToDevice(environment))return {status:'unavailable'};
  let writable;
  try {
    const handle=await environment.showSaveFilePicker({
      suggestedName:filename,
      types:[{description:'Resized photo',accept:{[blob.type]:[EXTENSIONS[blob.type]]}}],
      excludeAcceptAllOption:true,
    });
    writable=await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return {status:'saved'};
  } catch(error) {
    if(writable && typeof writable.abort==='function') {
      try { await writable.abort(); } catch { /* Preserve the original failure. */ }
    }
    if(error?.name==='AbortError')return {status:'cancelled'};
    if(error?.name==='SecurityError' || error?.name==='NotAllowedError')return {status:'unavailable'};
    return {status:'failed',message:error?.message||'The file could not be saved.'};
  }
}
