/* Browser-local adapter; no PDF is uploaded and no minimum size is invented. */
(()=>{
 'use strict';
 const it=document.documentElement.lang==='it',tr=(en,italian)=>it?italian:en;
 const messages={
  encrypted:tr('Encrypted or password-protected PDFs cannot be rewritten safely. Export an unprotected copy first.','I PDF cifrati o protetti da password non possono essere riscritti in sicurezza. Esporta prima una copia non protetta.'),
  forms:tr('PDFs with forms or digital signatures are not supported. No output has been created.','I PDF con moduli o firme digitali non sono supportati. Nessun file è stato creato.'),
  tagged:tr('This PDF has accessibility tags. This beta cannot safely validate their preservation, so no output has been created.','Questo PDF contiene tag di accessibilità. La beta non può verificarne la conservazione in sicurezza: nessun file è stato creato.'),
  annotations:tr('This PDF contains annotations beyond the supported links. No output has been created to avoid losing functionality.','Questo PDF contiene annotazioni diverse dai link supportati. Nessun file è stato creato per evitare perdite di funzionalità.'),
  complex:tr('This PDF has unsupported page structures or exceeds the 500-page safety limit.','Il PDF contiene strutture di pagina non supportate o supera il limite di sicurezza di 500 pagine.'),
  size:tr('Choose a PDF under 64 MB for this beta.','Per questa beta scegli un PDF entro 64 MB.'),
  integrity:tr('The preservation check failed. No output has been created.','Il controllo di integrità non è riuscito. Nessun file è stato creato.')
 };
 function message(e){if(messages[e.message])return messages[e.message];if(/encrypted/i.test(e.message))return messages.encrypted;return tr('This PDF could not be processed safely. It may be damaged or unsupported. No output has been created.','Non è stato possibile elaborare il PDF in sicurezza. Potrebbe essere danneggiato o non supportato. Nessun file è stato creato.');}
 const size=b=>b<1024?`${b} B`:b>=1048576?`${(b/1048576).toFixed(1)} MB`:`${(b/1024).toFixed(1)} KB`;
 async function check(bytes){if(bytes.byteLength>64*1024*1024)throw Error('size');const doc=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});MRCPDFOptimizer.guard(doc);}
 async function optimize(bytes,target,onStatus){
  const profiles=[{quality:.82,maxEdge:1800},{quality:.65,maxEdge:1400},{quality:.50,maxEdge:1000}];let best=null,used=null;
  for(let i=0;i<profiles.length;i++){
   onStatus(tr(`Optimising supported images… ${i+1}/${profiles.length}`,`Ottimizzazione delle immagini supportate… ${i+1}/${profiles.length}`));
   const result=await MRCPDFOptimizer.compress(bytes,profiles[i]);if(!best||result.bytes.length<best.bytes.length){best=result;used=profiles[i];}
   if(best.bytes.length<=target||result.report.treatable===0)break;
   await new Promise(r=>setTimeout(r,0));
  }
  // Do not degrade images for a negligible total reduction.
  if(best.report.imagesChanged&&bytes.byteLength-best.bytes.length<Math.max(1024,bytes.byteLength*.01)){
   best={bytes:new Uint8Array(bytes),report:{...best.report,imagesChanged:0,metadata:{fields:[],documentXMPRemoved:false}}};
  }
  const original=bytes.byteLength,final=best.bytes.length,saved=original-final,hit=final<=target;
  const reduction=saved?`${(100*saved/original).toFixed(1)}%`:'0%';
  const summary=tr(`Original: ${size(original)} · Final: ${size(final)} · Reduction: ${reduction} (${size(saved)}).`,`Originale: ${size(original)} · Finale: ${size(final)} · Riduzione: ${reduction} (${size(saved)}).`);
  let note=tr(`${best.report.imagesChanged} of ${best.report.imagesFound} raster image objects optimised. Unsupported images are unchanged.`,`${best.report.imagesChanged} di ${best.report.imagesFound} oggetti immagine raster ottimizzati. Le immagini non supportate restano inalterate.`);
  if(!saved)note+=' '+tr('The original file has been kept: the tested optimisation brings no useful reduction.','È stato conservato il file originale: l’ottimizzazione provata non produce una riduzione utile.');
  if(saved&&saved<Math.max(1024,original*.01))note+=' '+tr('Only a negligible reduction is available; this PDF has few optimisable elements.','La riduzione disponibile è trascurabile: questo PDF contiene pochi elementi ottimizzabili.');
  if(saved&&best.report.treatable===0)note+=' '+tr('There are no supported raster images; savings come from document metadata only.','Non ci sono immagini raster supportate: la riduzione riguarda soltanto i metadati del documento.');
  if(!hit)note+=' '+tr(`The ${size(target)} target was not reached within the supported method. No reliable technical minimum is available; rasterisation has not been enabled.`,`L’obiettivo di ${size(target)} non è stato raggiunto con il metodo supportato. Non è disponibile un minimo tecnico attendibile; la rasterizzazione non è stata attivata.`);
  if(best.report.imagesChanged&&used.quality<=.50)note+=' '+tr('This result uses the most aggressive image profile tested: check fine details before distributing.','Questo risultato usa il profilo immagini più aggressivo provato: verifica i dettagli prima della distribuzione.');
  if(best.report.metadata.fields.length||best.report.metadata.documentXMPRemoved)note+=' '+tr('Standard document metadata removed. This is not guaranteed anonymisation.','Rimossi metadati standard del documento. Non è un’anonimizzazione garantita.');
  return {...best,summary,note,status:!saved?tr('No useful reduction. Original PDF retained.','Nessuna riduzione utile. Conservato il PDF originale.'):hit?tr('PDF optimised. Target reached.','PDF ottimizzato. Obiettivo raggiunto.'):tr('PDF optimised. Target not reached.','PDF ottimizzato. Obiettivo non raggiunto.')};
 }
 window.MRCPDFConservative={check,optimize,message};
})();
