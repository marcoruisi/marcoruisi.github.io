/* Shared IT/EN interface; no network transport for document bytes. */
(()=>{
 'use strict';
 const it=document.documentElement.lang==='it',tr=(en,italian)=>it?italian:en,$=id=>document.getElementById(id);
 const size=b=>`${(Math.abs(b)>=1048576?b/1048576:b/1024).toFixed(1)} ${Math.abs(b)>=1048576?'MB':'KB'}`;
 let source=null,url=null,reportUrl=null,resultName='',busy=false;
 const status=(s)=>$('status').textContent=s;
 function revoke(){if(url)URL.revokeObjectURL(url);if(reportUrl)URL.revokeObjectURL(reportUrl);url=reportUrl=null;$('downloadButton').disabled=true;$('reportButton').disabled=true;}
 function resetResult(){revoke();$('summary').textContent='';$('summary').classList.remove('visible');$('compressionAdvice').textContent='';$('compressionAdvice').style.display='none';}
 function setFile(file){
  if(busy)return;if(!file||(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')){status(tr('Choose a PDF.','Scegli un PDF.'));return;}
  resetResult();source=file;$('compressButton').disabled=false;$('clearButton').disabled=false;
  $('dropzone').querySelector('strong').textContent=file.name;$('dropzone').querySelector('span').textContent=size(file.size);status('');
 }
 function mode(){
  const raster=$('compressionMode').value==='raster',target=$('qualityPreset').value==='target';
  $('targetSize').disabled=!target;$('targetUnit').disabled=!target;
  $('modeNote').textContent=raster?tr('Rasterise pages: selectable text, vectors, links and annotations will be lost. This is an explicit alternative.','Rasterizza pagine: testo selezionabile, vettori, link e annotazioni andranno persi. È un’alternativa esplicita.'):tr('Image compression: original text, vectors, page layout and compatible annotations are preserved. Colour profiles may render differently. Inline images, stencils and unsupported images remain unchanged. Up to 64 MB and 500 pages.','Compressione immagini: conserva testo originale, vettori, impaginazione e annotazioni compatibili. I profili colore possono avere una resa diversa. Immagini inline, stencil e immagini non supportate restano inalterate. Fino a 64 MB e 500 pagine.');
 }
 function download(href,name){const a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();}
 async function run(){
  if(!source||busy)return;
  const preset=$('qualityPreset').value,target=Number($('targetSize').value)*($('targetUnit').value==='MB'?1048576:1024),minDpi=Number($('minDpi').value),minQuality=Number($('minQuality').value)/100;
  if(preset==='target'&&(!Number.isFinite(target)||target<=0)){status(tr('Enter a positive target size.','Inserisci un peso desiderato positivo.'));return;}
  if(!Number.isFinite(minDpi)||minDpi<72||minDpi>300||!Number.isFinite(minQuality)||minQuality<.4||minQuality>.95){status(MRCPDFConservative.message(Error('parameters')));return;}
  busy=true;resetResult();const controls=[...document.querySelectorAll('.panel input,.panel select,.panel button')];controls.forEach(x=>x.disabled=true);
  $('progress').classList.add('visible');$('progress').querySelector('span').style.width='15%';status(tr('Reading PDF…','Lettura del PDF…'));
  try{
   const bytes=await source.arrayBuffer();await MRCPDFConservative.check(bytes);
   const result=await MRCPDFConservative.optimize(bytes,target,status,{preset,minDpi,minQuality,gray:$('colorMode').value==='gray',method:$('compressionMode').value});
   url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));resultName=source.name.replace(/\.pdf$/i,'')+'-compressed.pdf';
   reportUrl=URL.createObjectURL(new Blob([JSON.stringify(result.report,null,2)],{type:'application/json'}));
   const saved=source.size-result.bytes.length,r=result.report;
   $('summary').textContent=tr(`Original: ${size(source.size)} · Final: ${size(result.bytes.length)} · Change: ${(-saved/source.size*100).toFixed(1)}% · ${r.dpi} DPI · JPEG ${Math.round(r.quality*100)}%`,`Originale: ${size(source.size)} · Finale: ${size(result.bytes.length)} · Variazione: ${(-saved/source.size*100).toFixed(1)}% · ${r.dpi} DPI · JPEG ${Math.round(r.quality*100)}%`);$('summary').classList.add('visible');
   let note=r.method==='raster'?tr('Pages rasterised by your choice.','Pagine rasterizzate su tua scelta.'):tr(`${r.imagesChanged} of ${r.imagesFound} raster image objects rewritten. Text, vectors and compatible annotations preserved; non-target objects checked after saving.`,`${r.imagesChanged} di ${r.imagesFound} oggetti immagine raster riscritti. Testo, vettori e annotazioni compatibili conservati; oggetti non interessati verificati dopo il salvataggio.`);
   note+=' '+tr('Removable metadata cleared; MRC attribution added only to metadata. This does not guarantee anonymisation.','Rimossi i metadati eliminabili; attribuzione MRC inserita soltanto nei metadati. Non garantisce l’anonimizzazione.');
   if(saved<=0)note+=' '+tr('The processed PDF is not smaller. The download includes the metadata changes and any requested grayscale conversion.','Il PDF elaborato non è più leggero. Il download comprende le modifiche ai metadati e l’eventuale conversione in grigio richiesta.');
   if(r.targetReached===false)note+=' '+tr('Target not reached within the selected floors. This is the smallest tested result, not a proven technical minimum.','Obiettivo non raggiunto entro le soglie selezionate. Questo è il risultato più piccolo provato, non un minimo tecnico dimostrato.');
   if(r.images?.some(x=>x.status==='untouched'))note+=' '+tr('Download the report for individual exclusions.','Scarica il report per i motivi delle singole esclusioni.');
   $('compressionAdvice').textContent=note;$('compressionAdvice').style.display='block';
   status(r.targetReached===false?tr('Completed. Target not reached.','Completato. Obiettivo non raggiunto.'):tr('Completed.','Completato.'));
   $('progress').querySelector('span').style.width='100%';
  }catch(e){console.error(e);revoke();status(MRCPDFConservative.message(e));}
  finally{busy=false;controls.forEach(x=>x.disabled=false);$('downloadButton').disabled=!url;$('reportButton').disabled=!reportUrl;$('compressButton').disabled=!source;$('clearButton').disabled=!source;mode();$('progress').classList.remove('visible');}
 }
 $('fileInput').addEventListener('change',e=>setFile(e.target.files[0]));
 for(const event of ['dragenter','dragover','dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.toggle('drag',event==='dragenter'||event==='dragover');if(event==='drop'&&!busy)setFile(e.dataTransfer.files[0]);});
 $('compressButton').addEventListener('click',run);$('downloadButton').addEventListener('click',()=>url&&download(url,resultName));$('reportButton').addEventListener('click',()=>reportUrl&&download(reportUrl,resultName.replace(/\.pdf$/,'.report.json')));
 $('clearButton').addEventListener('click',()=>{resetResult();source=null;$('fileInput').value='';$('compressButton').disabled=$('clearButton').disabled=true;$('dropzone').querySelector('strong').textContent=tr('Drop a PDF here','Trascina qui un PDF');$('dropzone').querySelector('span').textContent=tr('or click to select one file','oppure clicca per scegliere un file');status('');});
 for(const el of document.querySelectorAll('.settings input,.settings select'))el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{resetResult();mode();status('');});
 mode();
})();
