/* Shared adaptive search. Each attempt starts from the original PDF, never a lossy intermediate. */
(()=>{
 'use strict';
 const it=document.documentElement.lang==='it',tr=(en,italian)=>it?italian:en;
 const messages={encrypted:tr('Export an unprotected PDF first.','Esporta prima un PDF non protetto.'),forms:tr('Forms and digital signatures are not supported.','Moduli e firme digitali non sono supportati.'),complex:tr('Unsupported page structure or more than 500 pages.','Struttura di pagina non supportata o più di 500 pagine.'),size:tr('Choose a PDF up to 64 MB.','Scegli un PDF entro 64 MB.'),integrity:tr('Preservation check failed. No output created.','Controllo di conservazione fallito. Nessun output creato.'),parameters:tr('Use at least 72 DPI and 40% JPEG quality.','Usa almeno 72 DPI e qualità JPEG 40%.')};
 function message(e){return messages[e.message]||(/encrypt/i.test(e.message)?messages.encrypted:tr('Unable to process this PDF safely. No output created.','Impossibile elaborare questo PDF in sicurezza. Nessun output creato.'));}
 async function check(bytes){if(bytes.byteLength>64*1024*1024)throw Error('size');MRCPDFOptimizer.guard(await PDFLib.PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true}));}
 const profiles={high:{dpi:220,quality:.88},medium:{dpi:144,quality:.68},low:{dpi:96,quality:.5}};
 async function optimize(bytes,target,onStatus,options={}){
  const {preset='target',minDpi=72,minQuality=.4,gray=false,method='preserve'}=options;
  if(!Number.isFinite(minDpi)||minDpi<72||minDpi>300||!Number.isFinite(minQuality)||minQuality<.4||minQuality>.95)throw Error('parameters');
  const attempts=[];let best=null,bestHit=null;
  async function run(level){
   const setting=typeof level==='number'?{dpi:Math.round(minDpi+(Math.max(220,minDpi)-minDpi)*level),quality:minQuality+(Math.max(.88,minQuality)-minQuality)*level}:level;
   setting.dpi=Math.max(minDpi,setting.dpi);setting.quality=Math.max(minQuality,setting.quality);
   onStatus(tr(`Attempt ${attempts.length+1} · ${setting.dpi} DPI · JPEG ${Math.round(setting.quality*100)}%`,`Tentativo ${attempts.length+1} · ${setting.dpi} DPI · JPEG ${Math.round(setting.quality*100)}%`));
   const params={...setting,minDpi,minQuality,gray,onProgress:(i,n)=>onStatus(tr(`Attempt ${attempts.length+1} · image ${i}/${n} · ${setting.dpi} DPI`,`Tentativo ${attempts.length+1} · immagine ${i}/${n} · ${setting.dpi} DPI`))};
   const result=await (method==='raster'?MRCPDFRaster.compress(bytes,params):MRCPDFOptimizer.compress(bytes,params));
   attempts.push({...setting,bytes:result.bytes.length});
   if(!best||result.bytes.length<best.bytes.length)best=result;
   if(result.bytes.length<=target)bestHit=result;
   await new Promise(r=>setTimeout(r,0));return result;
  }
  if(preset!=='target')await run(profiles[preset]||profiles.medium);
  else{
   let failed=1,passed=null;
   for(const level of [1,.75,.5,.25,0]){
    const result=await run(level);
    if(result.bytes.length<=target){passed=level;break;}
    failed=level;
    if(result.report.treatable===0&&method==='preserve')break;
   }
   // Refine the highest tested quality that meets the target. JPEG sizes need not be monotonic.
   if(passed!==null&&passed<failed)for(let i=0;i<3;i++){
    const mid=(passed+failed)/2,result=await run(mid);
    if(result.bytes.length<=target)passed=mid;else failed=mid;
   }
  }
  const result=bestHit||best;result.report.attempts=attempts;result.report.targetBytes=preset==='target'?target:null;result.report.targetReached=preset==='target'?result.bytes.length<=target:null;result.report.method=method;
  return result;
 }
 window.MRCPDFConservative={check,optimize,message};
})();
