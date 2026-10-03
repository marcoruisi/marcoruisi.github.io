/* One image, one limit, one measured JPG. No uploads or external dependencies. */
(() => {
  'use strict';
  const it = document.documentElement.lang === 'it';
  const text = it ? {
    unsupported:'Scegli una foto JPG, PNG o WebP. HEIC non è supportato.',
    one:'Scegli una sola foto per operazione.', invalid:'Indica un peso massimo valido, maggiore di zero.',
    reading:'Apro la foto…', working:'Cerco qualità e dimensioni entro il limite…',
    failed:'Non riesco a leggere o elaborare questa immagine. Prova un’altra foto JPG, PNG o WebP.',
    impossible:'Questo limite richiederebbe una foto troppo degradata. Aumenta il peso massimo: non ho preparato un risultato da scaricare.',
    unchanged:'Il JPG è già entro il limite: puoi scaricare l’originale senza ricompressione.',
    ready:'JPG pronto: il peso effettivo è entro il limite.',
    degraded:'Per rispettare il limite è stato necessario ridurre molto qualità o dimensioni. Controlla l’anteprima: dettagli e testo potrebbero non essere leggibili. Se puoi, aumenta il peso massimo.',
    resized:'Dimensioni ridotte', kept:'Dimensioni mantenute', original:'Originale', result:'Risultato',
    white:'La trasparenza diventa bianca nel JPG.',
    sizeLimit:'Questa immagine è troppo grande per essere elaborata in sicurezza nel browser. Esporta una copia più piccola e riprova.'
  } : {
    unsupported:'Choose a JPG, PNG or WebP photo. HEIC is not supported.',
    one:'Choose just one photo per operation.', invalid:'Enter a valid maximum file size greater than zero.',
    reading:'Opening your photo…', working:'Finding quality and dimensions that fit…',
    failed:'This image could not be read or processed. Try another JPG, PNG or WebP photo.',
    impossible:'This limit would require an excessively degraded photo. Increase the maximum file size: no download has been prepared.',
    unchanged:'This JPG already fits: download the original without recompression.',
    ready:'JPG ready: its actual file size is within the limit.',
    degraded:'Meeting this limit required a large reduction in quality or dimensions. Check the preview: details and text may be hard to read. Increase the limit if you can.',
    resized:'Dimensions reduced', kept:'Dimensions unchanged', original:'Original', result:'Result',
    white:'Transparency becomes white in the JPG.',
    sizeLimit:'This image is too large to process safely in the browser. Export a smaller copy and try again.'
  };
  const $ = id => document.getElementById(id);
  const el = Object.fromEntries(['workspace','choose','file','dropzone','selected','filename','original-preview','original-info','limit','unit','create','clear','status','warning','result','result-preview','summary','download'].map(id=>[id,$(id)]));
  let source = null, bitmap = null, originalURL = null, resultURL = null, generation = 0, busy = false;
  const cancelled = Symbol('cancelled');
  const locale = it ? 'it-IT' : 'en-US';
  const size = bytes => bytes < 1000000 ? `${(bytes/1000).toLocaleString(locale,{maximumFractionDigits:2})} KB` : `${(bytes/1000000).toLocaleString(locale,{maximumFractionDigits:2})} MB`;
  const exact = bytes => `${size(bytes)} (${bytes.toLocaleString(locale)} byte${it?'':'s'})`;
  const limitBytes = () => {
    const n = Number(el.limit.value), bytes = Math.floor(n * Number(el.unit.value));
    return Number.isFinite(n) && n > 0 && Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null;
  };
  function clearResult() {
    el.result.hidden = true; el.warning.hidden = true; el.warning.textContent = '';
    el.download.removeAttribute('href');el['result-preview'].removeAttribute('src');
    if(resultURL) URL.revokeObjectURL(resultURL);resultURL=null;
  }
  function setBusy(value) {
    busy=value;el.workspace.setAttribute('aria-busy',String(value));
    el.choose.disabled=value;el.limit.disabled=value;el.unit.disabled=value;
    el.create.disabled=value||!source||!limitBytes();el.clear.disabled=!source&&!value;
  }
  function releaseSource() {
    if(bitmap && bitmap.close) bitmap.close();bitmap=null;source=null;
    el['original-preview'].removeAttribute('src');
    if(originalURL) URL.revokeObjectURL(originalURL);originalURL=null;
    el.selected.hidden=true;el.file.value='';
  }
  function reset() { generation++;clearResult();releaseSource();el.status.textContent='';setBusy(false); }
  function check(token) { if(token!==generation) throw cancelled; }
  async function fileType(file) {
    const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
    if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
    if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return 'image/png';
    if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
    return null;
  }
  async function openPhoto(files) {
    reset();const token=generation;
    if(files.length!==1){el.status.textContent=text.one;return;}
    setBusy(true);el.status.textContent=text.reading;
    try {
      const file=files[0],type=await fileType(file);check(token);
      if(!type){el.status.textContent=text.unsupported;return;}
      // Modern decoders apply EXIF orientation once. Do not rotate again manually.
      let decoded;
      if(typeof createImageBitmap==='function') decoded=await createImageBitmap(file);
      else decoded=await new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('decode'));};img.src=url;});
      if(token!==generation){if(decoded.close)decoded.close();throw cancelled;}
      const width=decoded.naturalWidth||decoded.width,height=decoded.naturalHeight||decoded.height;
      if(!width||!height||width*height>80000000){if(decoded.close)decoded.close();el.status.textContent=text.sizeLimit;return;}
      bitmap=decoded;source={file,type,width,height};originalURL=URL.createObjectURL(file);
      el['original-preview'].src=originalURL;el.selected.hidden=false;el.filename.textContent=file.name;
      el['original-info'].textContent=`${text.original}: ${exact(file.size)} · ${width} × ${height} px`;
      el.status.textContent='';
    } catch(error) {if(error!==cancelled&&token===generation)el.status.textContent=text.failed;}
    finally {if(token===generation)setBusy(false);}
  }
  function encode(canvas,quality,token) {
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
      if(token!==generation)return reject(cancelled);
      if(!blob||blob.type!=='image/jpeg')return reject(new Error('encode'));
      resolve(blob);
    },'image/jpeg',quality));
  }
  async function atDimensions(canvas,target,token) {
    const maxQuality=.95,minQuality=.5;
    const high=await encode(canvas,maxQuality,token);
    if(high.size<=target)return {blob:high,quality:maxQuality};
    const low=await encode(canvas,minQuality,token);
    if(low.size>target)return {tooLarge:low.size};
    let lo=minQuality,hi=maxQuality,best={blob:low,quality:minQuality};
    // Retain only measured candidates that fit; encoder sizes need not be monotonic.
    for(let i=0;i<9;i++){
      const q=(lo+hi)/2,blob=await encode(canvas,q,token);
      if(blob.size<=target){best={blob,quality:q};lo=q;}else hi=q;
    }
    return best;
  }
  async function prepare() {
    if(busy||!source)return;
    const target=limitBytes();clearResult();if(!target){el.status.textContent=text.invalid;return;}
    const token=++generation,current=source;setBusy(true);el.status.textContent=text.working;
    let canvas;
    try {
      let output,width=current.width,height=current.height,quality=null,unchanged=false;
      if(current.type==='image/jpeg'&&current.file.size<=target){output=current.file;unchanged=true;}
      else {
        canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas');
        // Bound canvas memory on phones; never upscale. Refuse excessively tiny output.
        let scale=Math.min(1,4096/Math.max(width,height),Math.sqrt(12000000/(width*height)));
        const minimumLong=Math.min(320,Math.max(current.width,current.height));
        let candidate;
        for(let attempt=0;attempt<16;attempt++){
          check(token);width=Math.max(1,Math.round(current.width*scale));height=Math.max(1,Math.round(current.height*scale));
          if(Math.max(width,height)<minimumLong||Math.min(width,height)<Math.min(64,Math.min(current.width,current.height)))break;
          canvas.width=width;canvas.height=height;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(bitmap,0,0,width,height);
          candidate=await atDimensions(canvas,target,token);
          if(candidate.blob){output=candidate.blob;quality=candidate.quality;break;}
          scale*=Math.max(.5,Math.min(.9,Math.sqrt(target/candidate.tooLarge)*.95));
        }
        if(!output){el.warning.textContent=text.impossible;el.warning.hidden=false;el.status.textContent='';return;}
      }
      check(token);if(output.size>target)throw new Error('oversize');
      resultURL=URL.createObjectURL(output);el['result-preview'].src=resultURL;
      el.download.href=resultURL;el.download.download=unchanged?current.file.name:(current.file.name.replace(/\.[^.]+$/,'')||'photo')+'-mrc.jpg';
      el.summary.textContent=`${text.result}: ${exact(output.size)} · ${width} × ${height} px · ${width<current.width||height<current.height?text.resized:text.kept}`;
      el.status.textContent=unchanged?text.unchanged:text.ready;
      const degraded=!unchanged&&(quality<.6||Math.max(width,height)<Math.max(current.width,current.height)*.5||Math.max(width,height)<Math.min(640,Math.max(current.width,current.height)));
      if(degraded){el.warning.textContent=text.degraded;el.warning.hidden=false;el.status.textContent='';}
      el.result.hidden=false;
    }catch(error){if(error!==cancelled&&token===generation)el.status.textContent=text.failed;}
    finally{if(canvas){canvas.width=0;canvas.height=0;}if(token===generation)setBusy(false);}
  }
  el.choose.addEventListener('click',()=>el.file.click());
  el.file.addEventListener('change',()=>{const files=Array.from(el.file.files);if(files.length)openPhoto(files);});
  el.create.addEventListener('click',prepare);el.clear.addEventListener('click',reset);
  for(const name of ['limit','unit'])el[name].addEventListener('input',()=>{clearResult();el.status.textContent=limitBytes()?'':text.invalid;setBusy(false);});
  for(const event of ['dragenter','dragover'])el.dropzone.addEventListener(event,e=>{e.preventDefault();if(!busy)el.dropzone.classList.add('drag');});
  for(const event of ['dragleave','drop'])el.dropzone.addEventListener(event,e=>{e.preventDefault();el.dropzone.classList.remove('drag');});
  el.dropzone.addEventListener('drop',e=>{if(!busy)openPhoto(Array.from(e.dataTransfer.files));});
  window.addEventListener('pagehide',reset);
})();
