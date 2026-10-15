import {readDrop} from '../shared/file-drop.mjs';
import {pageSelection,placement,watermarkPDF,outputName,makeZip} from './core.mjs';
const $=id=>document.getElementById(id),it=document.documentElement.lang==='it',tr=(a,b)=>it?a:b;
const errors={pages:tr('Pagine non valide. Usa ad esempio 1, 3-5.','Invalid pages. Use e.g. 1, 3-5.'),geometry:tr('Controlla posizione e dimensione.','Check position and size.'),noPages:tr('Nessuna pagina corrisponde alla selezione.','No pages match the selection.'),signed:tr('PDF con firme: usa una copia senza firme.','Signed PDF: use an unsigned copy.'),zipLimit:tr('Limite ZIP superato: scarica i file singolarmente.','ZIP limit exceeded: download individual files.'),image:tr('Immagine non leggibile. Usa PNG, JPEG o WebP.','Cannot read image. Use PNG, JPEG or WebP.'),large:tr('Immagine troppo grande (massimo 40 milioni di pixel).','Image too large (maximum 40 million pixels).'),mark:tr('Inserisci un testo o carica il marchio.','Enter text or upload a watermark.'),markPage:tr('Pagina del marchio PDF non valida.','Invalid PDF watermark page.')};
const message=e=>errors[e.message]||tr('File non elaborabile: potrebbe essere protetto, danneggiato o non supportato.','Cannot process file: it may be protected, damaged or unsupported.');
let entries=[],outputs=[],urls=[],engine;
const isPDF=f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name);
const isImage=f=>/^image\/(png|jpeg|webp)$/.test(f.type)||/\.(png|jpe?g|webp)$/i.test(f.name);
function canvas(width,height){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(width));c.height=Math.max(1,Math.round(height));return c;}
const blob=(c,type='image/png')=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('image')),type,.95));
async function decode(file){
 const url=URL.createObjectURL(file),img=new Image();
 try{img.src=url;await img.decode();if(img.naturalWidth*img.naturalHeight>40000000)throw Error('large');return img;}
 catch(e){throw Error(e.message==='large'?'large':'image');}finally{URL.revokeObjectURL(url);}
}
async function pdfEngine(){if(!engine)engine=import('/tools/print-pdf-to-web/vendor/pdf.min.mjs').then(p=>{p.GlobalWorkerOptions.workerSrc='/tools/print-pdf-to-web/vendor/pdf.worker.min.mjs';return p;});return engine;}
async function pdfCanvas(file,pageNumber,maxSize,transparent=false){
 const pdfjs=await pdfEngine(),task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 let doc;
 try{
  doc=await task.promise;
  if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>doc.numPages)throw Error('markPage');
  const page=await doc.getPage(pageNumber),natural=page.getViewport({scale:1});
  const viewport=page.getViewport({scale:maxSize/Math.max(natural.width,natural.height)}),c=canvas(viewport.width,viewport.height);
  await page.render({canvasContext:c.getContext('2d'),viewport,background:transparent?'rgba(0,0,0,0)':'rgb(255,255,255)'}).promise;
  return c;
 }finally{await task.destroy();}
}
async function stamp(){
 let c;
 if($('mark-type').value==='text'){
  const text=$('mark-text').value.trim();if(!text)throw Error('mark');
  await document.fonts.load('600 96px Manrope');
  const lines=text.split('\n'),measure=canvas(1,1).getContext('2d');measure.font='600 96px Manrope, sans-serif';
  const width=Math.ceil(Math.max(...lines.map(line=>measure.measureText(line).width)))+24,height=lines.length*120+24;
  if(width>8192||height>4096)throw Error('large');
  c=canvas(width,height);const ctx=c.getContext('2d');ctx.font=measure.font;ctx.fillStyle=$('mark-color').value;ctx.textBaseline='top';ctx.textAlign='center';
  lines.forEach((line,i)=>ctx.fillText(line,width/2,12+i*120));
 }else{
  const file=$('mark-file').files[0];if(!file)throw Error('mark');
  if(isPDF(file))c=await pdfCanvas(file,Number($('mark-page').value),2400,true);
  else{if(!isImage(file))throw Error('image');const img=await decode(file),scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));c=canvas(img.naturalWidth*scale,img.naturalHeight*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);}
 }
 return {canvas:c,aspect:c.width/c.height,png:new Uint8Array(await (await blob(c)).arrayBuffer())};
}
function settings(){
 const result={x:Number($('x').value),y:Number($('y').value),size:Number($('size').value),opacity:Number($('opacity').value)/100};
 if(['x','y','size','opacity'].some(id=>!$(id).value.trim())||!Number.isFinite(result.opacity)||result.opacity<=0||result.opacity>1)throw Error('geometry');
 placement(100,100,1,result);return result;
}
function spec(e){return e.spec.trim()||$('pages').value;}
function clearOutputs(){for(const url of urls)URL.revokeObjectURL(url);urls=[];outputs=[];$('results').replaceChildren();$('download-all').hidden=true;}
function invalidate(){clearOutputs();$('preview-wrap').hidden=true;$('preview-note').textContent=tr('Aggiorna l’anteprima dopo le modifiche.','Refresh the preview after changes.');}
function renderFiles(){
 $('file-list').replaceChildren();$('preview-file').replaceChildren();
 entries.forEach((e,index)=>{
  const row=document.createElement('div');row.className='wm-file';
  const name=document.createElement('span');name.textContent=e.file.name+(e.pdf?tr(` · ${e.pages} pagine`,` · ${e.pages} pages`):'');
  const field=document.createElement('input');field.type='text';field.value=e.spec;field.placeholder=tr('Selezione generale','General selection');field.disabled=!e.pdf;field.setAttribute('aria-label',tr('Pagine di ','Pages of ')+e.file.name);
  field.addEventListener('input',()=>{e.spec=field.value;invalidate();});
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent=tr('Rimuovi','Remove');remove.addEventListener('click',()=>{entries.splice(index,1);invalidate();renderFiles();});
  row.append(name,field,remove);$('file-list').append(row);
  const option=document.createElement('option');option.value=index;option.textContent=e.file.name;$('preview-file').append(option);
 });
 syncPage();
}
function syncPage(){const e=entries[Number($('preview-file').value)];$('preview-page').max=e?.pages||1;$('preview-page').value='1';$('preview-page').disabled=!e?.pdf;}
async function busy(fn){$('controls').disabled=true;$('download-all').disabled=true;try{await fn();}catch(e){$('status').textContent=message(e);}finally{$('controls').disabled=false;$('download-all').disabled=false;}}
async function addFiles(files){await busy(async()=>{
 invalidate();const failures=[];
 for(const file of files){
  try{
   const pdf=isPDF(file);let pages=1;
   if(pdf){const doc=await PDFLib.PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});pages=doc.getPageCount();if(!pages)throw Error('noPages');}
   else{if(!isImage(file))throw Error('image');await decode(file);}
   entries.push({file,pdf,pages,spec:''});
  }catch(e){failures.push(file.name+': '+message(e));}
 }
 $('files').value='';renderFiles();$('status').textContent=tr(`${entries.length} file pronti.`,`${entries.length} files ready.`)+(failures.length?'\n'+failures.join('\n'):'');
});}
$('files').addEventListener('change',()=>addFiles([...$('files').files]));
$('controls').addEventListener('input',invalidate);
$('mark-type').addEventListener('change',()=>{const text=$('mark-type').value==='text';$('text-fields').hidden=!text;$('file-fields').hidden=text;invalidate();});
$('mark-file').addEventListener('change',()=>{$('pdf-mark-fields').hidden=!$('mark-file').files[0]||!isPDF($('mark-file').files[0]);invalidate();});
$('preview-file').addEventListener('change',()=>{syncPage();invalidate();});
for(const button of document.querySelectorAll('[data-position]'))button.addEventListener('click',()=>{const [x,y]=button.dataset.position.split(',');$('x').value=x;$('y').value=y;invalidate();});
function draw(c,mark,opts){const rect=placement(c.width,c.height,mark.aspect,opts),ctx=c.getContext('2d');ctx.save();ctx.globalAlpha=opts.opacity;ctx.drawImage(mark.canvas,rect.x,rect.y,rect.width,rect.height);ctx.restore();}
$('preview-button').addEventListener('click',()=>busy(async()=>{
 const entry=entries[Number($('preview-file').value)];if(!entry){$('status').textContent=tr('Aggiungi almeno un file.','Add at least one file.');return;}
 $('status').textContent=tr('Preparazione anteprima…','Preparing preview…');
 const opts=settings(),mark=await stamp(),page=Number($('preview-page').value);
 let c;
 if(entry.pdf)c=await pdfCanvas(entry.file,page,1100);
 else{const img=await decode(entry.file),scale=Math.min(1,1100/Math.max(img.naturalWidth,img.naturalHeight));c=canvas(img.naturalWidth*scale,img.naturalHeight*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);}
 const selected=!entry.pdf||pageSelection(spec(entry),entry.pages).includes(page-1);
 if(selected)draw(c,mark,opts);
 const target=$('preview');target.width=c.width;target.height=c.height;target.getContext('2d').drawImage(c,0,0);$('preview-wrap').hidden=false;
 $('preview-note').textContent=selected?tr('Anteprima della posizione e dell’opacità.','Position and opacity preview.'):tr('Questa pagina è esclusa: resterà senza watermark.','This page is excluded: it will remain without a watermark.');$('status').textContent='';
}));
function showResult(name,detail,output){
 const row=document.createElement('p');row.className=output?'wm-success':'wm-error';
 if(output){const a=document.createElement('a');a.textContent=name;a.href=URL.createObjectURL(output.blob);urls.push(a.href);a.download=name;row.append(a,document.createTextNode(' — '+detail));}
 else row.textContent=name+' — '+detail;
 $('results').append(row);
}
$('process').addEventListener('click',()=>busy(async()=>{
 clearOutputs();if(!entries.length){$('status').textContent=tr('Aggiungi almeno un file.','Add at least one file.');return;}
 const opts=settings(),mark=await stamp(),occupied=new Set();
 for(const [index,entry] of entries.entries()){
  $('status').textContent=tr(`Elaborazione ${index+1}/${entries.length}: `,`Processing ${index+1}/${entries.length}: `)+entry.file.name;
  try{
   let result,ext,detail;
   if(entry.pdf){const data=await watermarkPDF(await entry.file.arrayBuffer(),mark.png,mark.aspect,opts,spec(entry),PDFLib);result=new Blob([data.bytes],{type:'application/pdf'});ext='pdf';detail=tr(`${data.marked}/${entry.pages} pagine marcate`,`${data.marked}/${entry.pages} pages marked`);}
   else{const img=await decode(entry.file),c=canvas(img.naturalWidth,img.naturalHeight);c.getContext('2d').drawImage(img,0,0);draw(c,mark,opts);ext=/\.jpe?g$/i.test(entry.file.name)||entry.file.type==='image/jpeg'?'jpg':'png';result=await blob(c,ext==='jpg'?'image/jpeg':'image/png');detail=`${c.width} × ${c.height} px`;}
   const name=outputName(entry.file.name,ext,occupied),output={name,blob:result};outputs.push(output);showResult(name,detail,output);
  }catch(e){showResult(entry.file.name,message(e));}
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 $('download-all').hidden=!outputs.length;$('status').textContent=tr(`${outputs.length}/${entries.length} file pronti. Gli originali non sono stati modificati.`,`${outputs.length}/${entries.length} files ready. Original files are unchanged.`);
}));
$('download-all').addEventListener('click',()=>busy(async()=>{
 const zip=await makeZip(outputs),url=URL.createObjectURL(zip),a=document.createElement('a');a.href=url;a.download='mrc-watermark.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}));

for(const type of ['dragover','drop'])window.addEventListener(type,event=>{if([...event.dataTransfer?.types||[]].includes('Files'))event.preventDefault();});
for(const id of ['file-drop','mark-drop']){
 const zone=$(id);
 zone.addEventListener('dragover',event=>{event.preventDefault();if(!$('controls').disabled)zone.classList.add('drag');});
 zone.addEventListener('dragleave',()=>zone.classList.remove('drag'));
 zone.addEventListener('drop',async event=>{
  event.preventDefault();zone.classList.remove('drag');if($('controls').disabled)return;
  if(id==='file-drop'){
   // Only documents/images are meaningful here; traverse dropped folders.
   $('controls').disabled=true;
   try{const items=await readDrop(event.dataTransfer,async()=> 'files');$('controls').disabled=false;await addFiles(items.map(i=>i.file));}
   catch{$('status').textContent=tr('Impossibile leggere i file trascinati.','Cannot read the dropped files.');}
   finally{$('controls').disabled=false;}
  }else{
   const files=[...event.dataTransfer.files];
   if(files.length!==1){$('status').textContent=tr('Trascina un solo marchio.','Drop one watermark file.');return;}
   const transfer=new DataTransfer();transfer.items.add(files[0]);$('mark-file').files=transfer.files;$('mark-file').dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
}
