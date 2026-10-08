import * as pdfjs from './vendor/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
if(document.readyState==='loading') await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
const $=id=>document.getElementById(id),it=document.documentElement.lang==='it';
const tr=(en,italian)=>it?italian:en;
const errors={
 encrypted:tr('Password-protected or encrypted PDFs are not supported. Export an unprotected copy first.','I PDF protetti da password o cifrati non sono supportati. Esporta prima una copia non protetta.'),
 forms:tr('This PDF contains forms or signature information. Cropping cannot safely preserve them in this version.','Questo PDF contiene moduli o informazioni di firma. Questa versione non può conservarli in sicurezza durante il ritaglio.'),
 tagged:tr('This PDF has accessibility tags. This version cannot safely update their layout coordinates. Export is unavailable.','Questo PDF contiene tag di accessibilità. Questa versione non può aggiornare in sicurezza le loro coordinate di impaginazione. L’esportazione non è disponibile.'),
 boxes:tr('The page boxes are invalid or outside the supported range. This PDF cannot be cropped safely.','I riquadri delle pagine non sono validi o superano le dimensioni supportate. Non è possibile ritagliare questo PDF in sicurezza.'),
 unit:tr('This PDF uses a non-standard page scale (UserUnit). It is not supported in this version.','Questo PDF usa una scala di pagina non standard (UserUnit), non supportata in questa versione.'),
 rotation:tr('This PDF has an unsupported page rotation.','Questo PDF ha una rotazione di pagina non supportata.'),
 annotations:tr('This PDF contains annotations other than supported links, or complex link appearances. Export is unavailable to avoid changing them incorrectly.','Questo PDF contiene annotazioni diverse dai link supportati, o aspetti complessi dei link. L’esportazione non è disponibile per evitare modifiche scorrette.'),
 special:tr('This PDF uses specialised page features that cannot be safely repositioned in this version.','Questo PDF usa caratteristiche di pagina speciali che questa versione non può riposizionare in sicurezza.'),
 margins:tr('Enter non-negative margins. Every final page must remain at least 0.36 mm wide and high.','Inserisci margini non negativi. Ogni pagina finale deve rimanere larga e alta almeno 0,36 mm.'),
 trim:tr('A valid explicit TrimBox is needed on every page for automatic cropping. Use manual margins instead.','Il ritaglio automatico richiede un TrimBox esplicito e valido su tutte le pagine. Usa invece i margini manuali.'),
 empty:tr('The PDF has no pages.','Il PDF non contiene pagine.'),
 preview:tr('The preview could not be rendered reliably. Export is unavailable; try a different PDF.','Non è stato possibile generare un’anteprima affidabile. L’esportazione non è disponibile: prova un altro PDF.'),
 malformed:tr('This PDF could not be read safely. It may be damaged or unsupported.','Non è stato possibile leggere il PDF in sicurezza. Potrebbe essere danneggiato o non supportato.')
};
let bytes=null,info=null,preview=null,current=0,viewport=null,renderTask=null,generation=0,renderSerial=0,exporting=false,busy=false,downloadUrl=null,fileName='';
const fmt=n=>new Intl.NumberFormat(it?'it-IT':'en-GB',{maximumFractionDigits:1}).format(n);
const size=n=>n>=1048576?`${fmt(n/1048576)} MB`:`${fmt(n/1024)} KB`;
const dimensions=(b,r)=>`${fmt((r===90||r===270?b.height:b.width)/PrintPdfCore.mm)} × ${fmt((r===90||r===270?b.width:b.height)/PrintPdfCore.mm)} mm`;
const mode=()=>document.querySelector('input[name=mode]:checked')?.value;
const margins=()=>Object.fromEntries(['top','bottom','left','right'].map(k=>[k,$(k).value===''?NaN:Number($(k).value)]));
function resetResult(){ $('result').hidden=true;if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=null;$('download').removeAttribute('href'); }
function error(e){ $('error').textContent=errors[e.message]||errors.malformed; }
function rows(data){$('metadata').replaceChildren();for(const [label,value]of data){if(value===null||value===undefined||value==='')continue;const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);div.append(dt,dd);$('metadata').append(div);}$('metadata').hidden=false;}
function safe(fn){try{return fn();}catch{return null;}}
function date(d){return d instanceof Date&&!Number.isNaN(d.valueOf())?d.toLocaleString(it?'it-IT':'en-GB'):null;}
function showMetadata(doc,file){
 const states=info.pages.map(p=>p.trimState),present=states.filter(s=>s==='present').length,absent=states.filter(s=>s==='absent').length;
 const trim=info.auto?tr('Present and usable on every page','Presente e utilizzabile su tutte le pagine'):absent===states.length?tr('Absent','Assente'):tr(`${present} usable; ${absent} absent; ${states.length-present-absent} not usable`,`${present} utilizzabili; ${absent} assenti; ${states.length-present-absent} non utilizzabili`);
 // Original PDF metadata only: never derive this row from manual crop margins.
 const validTrim=info.pages.filter(p=>p.trimState==='present');
 const trimSize=p=>{const r=p.rotation===90||p.rotation===270,b=p.trim,f=n=>new Intl.NumberFormat(it?'it-IT':'en-GB',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n/PrintPdfCore.mm);return `${f(r?b.height:b.width)} × ${f(r?b.width:b.height)} mm`;};
 const trimDimensions=validTrim.map(trimSize);
 const sameTrim=validTrim.length===info.pages.length&&validTrim.every(p=>{
  const first=validTrim[0],rotated=p.rotation===90||p.rotation===270,firstRotated=first.rotation===90||first.rotation===270;
  return Math.abs((rotated?p.trim.height:p.trim.width)-(firstRotated?first.trim.height:first.trim.width))<.01&&Math.abs((rotated?p.trim.width:p.trim.height)-(firstRotated?first.trim.width:first.trim.height))<.01;
 });
 const finalDimensions=!validTrim.length?tr('Not available','Non disponibile'):sameTrim?trimDimensions[0]:tr('Different or unavailable final sizes by page: ','Formati finali differenti o non disponibili per pagina: ')+info.pages.map((p,i)=>`${i+1}: ${p.trimState==='present'?trimSize(p):tr('Not available','Non disponibile')}`).join('; ');
 const allBleed=info.pages.every(p=>p.bleed),b=info.pages[0].bleed;
 const sameBleed=allBleed&&info.pages.every(p=>['top','bottom','left','right'].every(k=>Math.abs(p.bleed[k]-b[k])<.01));
 const bleed=sameBleed?`${tr('Top / bottom / left / right','Alto / basso / sinistra / destra')}: ${[b.top,b.bottom,b.left,b.right].map(fmt).join(' / ')} mm`:allBleed?tr('Varies by page; shown below','Varia per pagina; indicata sotto'):tr('Not reliably available from BleedBox and TrimBox','Non ricavabile con affidabilità da BleedBox e TrimBox');
 rows([[tr('File','File'),file.name],[tr('Title','Titolo'),safe(()=>doc.getTitle())],[tr('Author','Autore'),safe(()=>doc.getAuthor())],[tr('Created with','Creato con'),safe(()=>doc.getCreator())],[tr('PDF producer','Generatore PDF'),safe(()=>doc.getProducer())],[tr('Creation date','Data creazione'),date(safe(()=>doc.getCreationDate()))],[tr('Modification date','Data modifica'),date(safe(()=>doc.getModificationDate()))],[tr('Pages','Pagine'),info.pages.length],[tr('Original dimensions (MediaBox)','Dimensioni originali (MediaBox)'),info.mixed?tr('Different page sizes or orientations; shown below','Pagine di dimensioni o orientamenti differenti; dettagli sotto'):dimensions(info.pages[0].media,info.pages[0].rotation)],[tr('Final dimensions (TrimBox)','Dimensioni finali (TrimBox)'),finalDimensions],[tr('Original size','Peso originale'),size(file.size)],['TrimBox',trim],[tr('Bleed','Abbondanza'),bleed]]);
}
function update(){
 resetResult();$('error').textContent='';$('manual').hidden=mode()!=='manual';
 const equal=$('equal').checked;
 for(const k of ['bottom','left','right']){$(k).closest('label').hidden=equal;if(equal)$(k).value=$('top').value;}
 $('top').parentElement.firstChild.textContent=equal?tr('All sides (mm)','Tutti i lati (mm)'):tr('Top (mm)','Alto (mm)');
 if(!info)return;
 try{
  const rects=PrintPdfCore.rectangles(info,mode(),margins());
  for(const k of ['top','bottom','left','right'])$(k).removeAttribute('aria-invalid');
  const p=info.pages[current];$('dimensions').textContent=`${dimensions(p.media,p.rotation)} → ${dimensions(rects[current],p.rotation)}`;
  $('page-sizes').replaceChildren();info.pages.forEach((page,i)=>{const li=document.createElement('li');li.textContent=`${i+1}: ${dimensions(page.media,page.rotation)} → ${dimensions(rects[i],page.rotation)}${page.bleed?tr(' · bleed T/B/L/R: ',' · abbondanza A/B/S/D: ')+[page.bleed.top,page.bleed.bottom,page.bleed.left,page.bleed.right].map(fmt).join('/')+' mm':''}`;$('page-sizes').append(li);});
  if(viewport){const r=rects[current];const a=viewport.convertToViewportRectangle([r.x,r.y,r.x+r.width,r.y+r.height]);const x=Math.min(a[0],a[2]),y=Math.min(a[1],a[3]);Object.assign($('crop-area').style,{left:100*x/viewport.width+'%',top:100*y/viewport.height+'%',width:100*Math.abs(a[2]-a[0])/viewport.width+'%',height:100*Math.abs(a[3]-a[1])/viewport.height+'%'});$('crop-area').hidden=false;}
  $('export').disabled=busy||exporting||!viewport;
 }catch(e){error(e);$('export').disabled=true;$('crop-area').hidden=true;$('dimensions').textContent='';for(const k of ['top','bottom','left','right'])$(k).setAttribute('aria-invalid','true');}
}
async function render(){
 const serial=++renderSerial,token=generation;viewport=null;$('export').disabled=true;$('crop-area').hidden=true;
 if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}renderTask=null;}
 if(!preview)return;
 $('prev').disabled=current===0;$('next').disabled=current===info.pages.length-1;
 $('page-position').textContent=tr(`Page ${current+1} of ${info.pages.length}`,`Pagina ${current+1} di ${info.pages.length}`);
 try{
  const page=await preview.getPage(current+1);if(serial!==renderSerial||token!==generation)return;
  const original=page.getViewport({scale:1});const v=page.getViewport({scale:Math.min(1.8,1400/original.width,1800/original.height)});
  const canvas=$('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
  renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport:v,background:'white'});await renderTask.promise;
  if(serial!==renderSerial||token!==generation)return;viewport=v;renderTask=null;update();
 }catch(e){if(e.name!=='RenderingCancelledException'&&token===generation){error(new Error('preview'));$('export').disabled=true;}}
}
async function load(file){
 if(!file)return;const token=++generation;busy=true;bytes=null;info=null;viewport=null;current=0;resetResult();$('controls').hidden=true;$('metadata').hidden=true;$('error').textContent='';$('status').textContent=tr('Reading PDF…','Lettura del PDF…');$('workspace').setAttribute('aria-busy','true');$('choose').disabled=true;
 try{
  if(file.size>100*1024*1024)throw new Error(tr('The file exceeds 100 MB. Choose a smaller PDF.','Il file supera 100 MB. Scegli un PDF più piccolo.'));
  if(!file.size)throw new Error('empty');
  if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}renderTask=null;}
  if(preview){await preview.destroy();preview=null;}
  const input=new Uint8Array(await file.arrayBuffer());
  const doc=await PDFLib.PDFDocument.load(input,{updateMetadata:false,throwOnInvalidObject:true});
  const scanned=PrintPdfCore.inspect(doc);if(scanned.pages.length>500)throw new Error(tr('This version supports up to 500 pages.','Questa versione supporta fino a 500 pagine.'));
  if(token!==generation)return;bytes=input;info=scanned;fileName=file.name;showMetadata(doc,file);
  $('mode-trim').disabled=!info.auto;$('mode-trim').checked=info.auto;$('mode-manual').checked=!info.auto;
  $('trim-help').textContent=info.auto?tr('The explicit TrimBox defines the final size on each page. You can still choose manual margins.','Il TrimBox esplicito definisce il formato finale di ogni pagina. Puoi comunque scegliere i margini manuali.'):errors.trim;
  for(const key of ['top','bottom','left','right'])$(key).value='0';$('equal').checked=true;
  // Preview-only copy exposes the whole MediaBox, even when the input CropBox is smaller.
  doc.getPages().forEach((page,i)=>{const b=info.pages[i].media;page.setCropBox(b.x,b.y,b.width,b.height);});
  const previewBytes=await doc.save({updateFieldAppearances:false});
  preview=await pdfjs.getDocument({data:previewBytes,isEvalSupported:false,useSystemFonts:true,disableAutoFetch:true,disableStream:true}).promise;
  if(token!==generation){await preview.destroy();return;}
  $('controls').hidden=false;$('status').textContent=info.mixed?tr('Page sizes differ. The crop is calculated individually for each page.','Le dimensioni delle pagine differiscono. Il ritaglio viene calcolato singolarmente per ogni pagina.'):'';
  busy=false;await render();
 }catch(e){bytes=null;info=null;if(/encrypted/i.test(e.message))error(new Error('encrypted'));else if(errors[e.message])error(e);else $('error').textContent=e.message.includes('100 MB')||e.message.includes('500')?e.message:errors.malformed;$('status').textContent='';}
 finally{if(token===generation){busy=false;$('choose').disabled=false;$('workspace').setAttribute('aria-busy','false');}}
}
$('choose').addEventListener('click',()=>{$('file').value='';$('file').click();});
$('file').addEventListener('change',()=>load($('file').files[0]));
for(const element of document.querySelectorAll('#controls input'))element.addEventListener('input',update);
$('prev').addEventListener('click',async()=>{if(current>0){current--;await render();}});
$('next').addEventListener('click',async()=>{if(info&&current<info.pages.length-1){current++;await render();}});
$('export').addEventListener('click',async()=>{
 if(!bytes||exporting||busy||!viewport)return;exporting=true;resetResult();$('export').disabled=true;$('choose').disabled=true;$('controls').setAttribute('inert','');$('workspace').setAttribute('aria-busy','true');$('status').textContent=tr('Preparing PDF…','Preparazione del PDF…');
 try{
  const rects=PrintPdfCore.rectangles(info,mode(),margins());
  // Reload the original bytes: preview and previous exports never accumulate crop offsets.
  const doc=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});
  const fresh=PrintPdfCore.inspect(doc);const report=PrintPdfCore.crop(doc,fresh,rects);
  MRCOutputMetadata.pdf(doc);
  const output=await doc.save({updateFieldAppearances:false});
  downloadUrl=URL.createObjectURL(new Blob([output],{type:'application/pdf'}));$('download').href=downloadUrl;$('download').download=fileName.replace(/\.pdf$/i,'')+'-web.pdf';
  $('result-summary').textContent=tr(`${info.pages.length} pages · ${size(output.length)}. Page boxes match the final format. Links wholly outside the crop are removed.`,`${info.pages.length} pagine · ${size(output.length)}. I riquadri delle pagine corrispondono al formato finale. I link interamente esterni al ritaglio vengono rimossi.`)+(report.removedLinks?tr(` ${report.removedLinks} outside links removed.`,` ${report.removedLinks} link esterni rimossi.`):'');
  $('result').hidden=false;$('status').textContent=tr('PDF ready for the web.','PDF pronto per il web.');$('download').focus();
 }catch(e){error(e);$('status').textContent='';}
 finally{exporting=false;$('choose').disabled=false;$('controls').removeAttribute('inert');$('export').disabled=false;$('workspace').setAttribute('aria-busy','false');}
});
window.addEventListener('pagehide',()=>{if(downloadUrl)URL.revokeObjectURL(downloadUrl);});
