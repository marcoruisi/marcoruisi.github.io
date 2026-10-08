/* Shared IT/EN interface. Compression engines and their parameters are unchanged. */
(()=>{
 'use strict';
 const it=document.documentElement.lang==='it',tr=(en,italian)=>it?italian:en,$=id=>document.getElementById(id);
 const format=(n,d=1)=>new Intl.NumberFormat(it?'it-IT':'en-GB',{maximumFractionDigits:d,minimumFractionDigits:d}).format(n);
 const size=b=>b<1024?`${b} B`:`${format(b>=1048576?b/1048576:b/1024)} ${b>=1048576?'MB':'KB'}`;
 let source=null,url=null,reportUrl=null,resultName='',busy=false;
 const status=s=>$('status').textContent=s;
 function revoke(){if(url)URL.revokeObjectURL(url);if(reportUrl)URL.revokeObjectURL(reportUrl);url=reportUrl=null;$('downloadButton').disabled=true;$('reportButton').disabled=true;}
 function resetResult(){revoke();$('resultSection').hidden=true;$('compressionDetails').open=false;$('detailContent').replaceChildren();$('compressionAdvice').hidden=true;$('compressButton').classList.add('primary');}
 function setFile(file){
  if(busy)return;if(!file||(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf')){status(tr('Choose a PDF.','Scegli un PDF.'));return;}
  resetResult();source=file;$('compressButton').disabled=false;$('clearButton').disabled=false;
  $('dropzone').querySelector('strong').textContent=file.name;$('dropzone').querySelector('span').textContent=size(file.size);status('');
 }
 function mode(){
  const raster=$('compressionMode').value==='raster',target=$('qualityPreset').value==='target';
  $('targetFields').hidden=!target;$('targetSize').disabled=!target;$('targetUnit').disabled=!target;
  $('modeNote').dataset.raster=String(raster);
  $('modeNote').textContent=raster?tr('Warning: rasterisation converts entire pages into images. Selectable text, vectors, links and annotations will be lost.','Attenzione: la rasterizzazione trasforma intere pagine in immagini. Testo selezionabile, vettori, link e annotazioni andranno persi.'):tr('The default method compresses embedded images while preserving text, vectors, links and compatible annotations.','Il metodo predefinito comprime le immagini incorporate conservando testo, vettori, link e annotazioni compatibili.');
 }
 function download(href,name){const a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();}
 function details(r){
  const box=$('detailContent'),dl=document.createElement('dl');dl.className='detail-list';
  const row=(a,b)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;dl.append(dt,dd);};
  row(tr('Method','Metodo'),r.method==='raster'?tr('Whole-page rasterisation','Rasterizzazione delle pagine'):tr('Embedded image compression','Compressione delle immagini incorporate'));
  if(Number.isFinite(r.dpi))row(tr('Requested resolution','Risoluzione impostata'),r.dpi+' DPI');
  if(Number.isFinite(r.quality))row(tr('JPEG quality','Qualità JPEG'),Math.round(r.quality*100)+'%');
  row(tr('Image colour','Colore delle immagini'),r.gray?tr('Grayscale','Scala di grigi'):tr('Colour','Colori'));
  if(r.method!=='raster'&&Number.isFinite(r.imagesFound))row(tr('Raster image objects found','Oggetti immagine raster rilevati'),r.imagesFound);
  if(r.attempts)row(tr('Compression attempts','Tentativi di compressione'),r.attempts.length);
  if(Number.isFinite(r.targetBytes))row(tr('Requested file size','Peso richiesto'),size(r.targetBytes));
  if(r.structural)row(tr('Unused PDF objects removed','Oggetti PDF inutilizzati rimossi'),r.structural.unreachableObjectsRemoved);
  box.append(dl);
  const note=text=>{const p=document.createElement('p');p.className='detail-note';p.textContent=text;box.append(p);};
  if(r.invariants?.nonImageObjectsUnchanged)note(tr('Objects outside image and metadata changes passed the preservation check.','Gli oggetti non interessati dalle modifiche a immagini e metadati hanno superato il controllo di conservazione.'));
  if(r.metadata?.attribution)note(tr('MRC attribution is stored only in file metadata.','L’attribuzione MRC è contenuta soltanto nei metadati del file.'));
  if(r.metadata?.fields?.length||r.metadata?.documentXMPRemoved)note(tr('Original removable metadata was cleared. This is not guaranteed anonymisation.','I metadati originali eliminabili sono stati rimossi. Non è un’anonimizzazione garantita.'));
  const untouched=(r.images||[]).filter(x=>x.status==='untouched');
  if(untouched.length){
   const counts=new Map();
   for(const image of untouched){let why=tr('Unsupported or undecodable image','Immagine non supportata o non decodificabile');const reason=image.reason||'';
    if(reason.includes('not smaller'))why=tr('Recompression would not make the image smaller','La ricompressione non renderebbe l’immagine più leggera');
    else if(reason.includes('Mask/stencil'))why=tr('Masks and stencils are not compressed independently','Maschere e stencil non vengono compressi separatamente');
    else if(reason.includes('megapixels'))why=tr('Image exceeds the memory limit or has invalid dimensions','Immagine oltre il limite di memoria o con dimensioni non valide');
    else if(reason.includes('colour resource'))why=tr('Image has different colour interpretations across uses','L’immagine ha interpretazioni colore diverse nei suoi utilizzi');
    else if(reason.includes('OPI'))why=tr('Image includes alternate print versions','L’immagine contiene versioni alternative per la stampa');
    counts.set(why,(counts.get(why)||0)+1);
   }
   note(tr('Why some image objects were not rewritten:','Perché alcuni oggetti immagine non sono stati riscritti:'));const ul=document.createElement('ul');for(const [why,n]of counts){const li=document.createElement('li');li.textContent=`${n} — ${why}`;ul.append(li);}box.append(ul);
  }
  if(r.warnings?.some(w=>w.includes('Placement analysis')))note(tr('Some image placements could not be measured: their original dimensions were retained.','Non è stato possibile misurare alcuni posizionamenti: sono state mantenute le dimensioni originali delle immagini.'));
  if(r.warnings?.some(w=>w.includes('ICC')))note(tr('ICC/CMYK colours may differ from a professional colour-managed print workflow. Unsupported images remain unchanged.','I colori ICC/CMYK possono differire da un flusso di stampa con gestione colore professionale. Le immagini non supportate restano inalterate.'));
 }
 function showResult(r,finalBytes){
  const saved=source.size-finalBytes;
  $('originalSize').textContent=size(source.size);$('finalSize').textContent=size(finalBytes);
  $('reductionLabel').textContent=saved<0?tr('Increase','Aumento'):tr('Reduction','Riduzione');$('reduction').textContent=format(Math.abs(saved)/source.size*100)+'%';
  $('imageCountLabel').textContent=r.method==='raster'?tr('Pages rasterised','Pagine rasterizzate'):tr('Images optimised','Immagini ottimizzate');$('imageCount').textContent=r.imagesChanged??'—';
  $('targetOutcome').textContent=r.targetReached===true?tr('Target reached.','Obiettivo raggiunto.'):r.targetReached===false?tr('Target not reached within the selected quality limits.','Obiettivo non raggiunto entro i limiti di qualità selezionati.'):tr('Selected quality profile applied.','Profilo di qualità selezionato applicato.');
  const notes=[];
  if(saved<=0)notes.push(tr('The processed PDF is not smaller. The download includes the requested metadata and colour changes.','Il PDF elaborato non è più leggero. Il download comprende le modifiche richieste a metadati e colore.'));
  if(r.method==='raster')notes.push(tr('Pages were rasterised by your choice: text selection and links are not preserved.','Le pagine sono state rasterizzate su tua scelta: selezione del testo e link non sono conservati.'));
  if(r.targetReached===false)notes.push(tr('This is the smallest tested result, not a proven minimum.','Questo è il risultato più piccolo provato, non un minimo tecnico dimostrato.'));
  $('compressionAdvice').textContent=notes.join(' ');$('compressionAdvice').hidden=!notes.length;
  details(r);$('resultSection').hidden=false;$('compressButton').classList.remove('primary');
 }
 async function run(){
  if(!source||busy)return;
  const preset=$('qualityPreset').value,target=Number($('targetSize').value)*($('targetUnit').value==='MB'?1048576:1024),minDpi=Number($('minDpi').value),minQuality=Number($('minQuality').value)/100;
  if(preset==='target'&&(!Number.isFinite(target)||target<=0)){status(tr('Enter a positive target size.','Inserisci un peso desiderato positivo.'));return;}
  if(!Number.isFinite(minDpi)||minDpi<72||minDpi>300||!Number.isFinite(minQuality)||minQuality<.4||minQuality>.95){$('advancedOptions').open=true;status(MRCPDFConservative.message(Error('parameters')));return;}
  busy=true;resetResult();const controls=[...document.querySelectorAll('.panel input,.panel select,.panel button')];controls.forEach(x=>x.disabled=true);
  $('progress').classList.add('visible');$('progress').querySelector('span').style.width='15%';status(tr('Reading PDF…','Lettura del PDF…'));
  try{
   const bytes=await source.arrayBuffer();await MRCPDFConservative.check(bytes);
   const result=await MRCPDFConservative.optimize(bytes,target,status,{preset,minDpi,minQuality,gray:$('colorMode').value==='gray',method:$('compressionMode').value});
   url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));resultName=source.name.replace(/\.pdf$/i,'')+'-compressed.pdf';
   reportUrl=URL.createObjectURL(new Blob([JSON.stringify(result.report,null,2)],{type:'application/json'}));
   showResult(result.report,result.bytes.length);status(tr('Completed. Your PDF is ready to download.','Completato. Il PDF è pronto da scaricare.'));$('progress').querySelector('span').style.width='100%';
  }catch(e){console.error(e);revoke();status(MRCPDFConservative.message(e));}
  finally{busy=false;controls.forEach(x=>x.disabled=false);$('downloadButton').disabled=!url;$('reportButton').disabled=!reportUrl;$('compressButton').disabled=!source;$('clearButton').disabled=!source;mode();$('progress').classList.remove('visible');if(url)$('downloadButton').focus();}
 }
 $('fileInput').addEventListener('change',e=>setFile(e.target.files[0]));
 for(const event of ['dragenter','dragover','dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.toggle('drag',event==='dragenter'||event==='dragover');if(event==='drop'&&!busy)setFile(e.dataTransfer.files[0]);});
 $('compressButton').addEventListener('click',run);$('downloadButton').addEventListener('click',()=>url&&download(url,resultName));$('reportButton').addEventListener('click',()=>reportUrl&&download(reportUrl,resultName.replace(/\.pdf$/,'.report.json')));
 $('clearButton').addEventListener('click',()=>{resetResult();source=null;$('fileInput').value='';$('compressButton').disabled=$('clearButton').disabled=true;$('dropzone').querySelector('strong').textContent=tr('Drop a PDF here','Trascina qui un PDF');$('dropzone').querySelector('span').textContent=tr('or click to select one file','oppure clicca per scegliere un file');status('');});
 for(const el of document.querySelectorAll('.settings input,.settings select'))el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{resetResult();mode();status('');});
 mode();
})();
