import {readDrop} from '../shared/file-drop.mjs';
import {parseTable, planMapping} from './csv.mjs';
import {changeCase} from '../multiple-find-replace/case-transform.mjs';
import {replaceAll} from '../multiple-find-replace/core.mjs';
const it=document.documentElement.lang==='it', $=id=>document.getElementById(id);
const tr=(a,b)=>it?a:b;
let entries=[];
let renameMode='original',csvData=null,csvText='',csvRead=0;
const draftKey=()=>renameMode==='csv'?'csvBase':'originalBase';
function saveDraft(){for(const e of entries)e[draftKey()]=e.base;}
function setMode(mode){saveDraft();renameMode=mode;for(const e of entries)e.base=e[draftKey()];$('original-mode').hidden=mode!=='original';$('csv-mode').hidden=mode!=='csv';render();refreshMapping();}
$('rename-mode').addEventListener('change',()=>setMode($('rename-mode').value));
const split=name=>{const p=name.lastIndexOf('.');return p>0?{base:name.slice(0,p),ext:name.slice(p)}:{base:name,ext:''};};
const invalid=name=>!name||name==='.'||name==='..'||/[\\/\x00-\x1f<>:"|?*]/.test(name)||/[. ]$/.test(name);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pendingDuplicateChanges=null;
const matchStatus=e=>renameMode==='csv'&&e.csvMatched===false?tr('Nessuna corrispondenza · nome originale','No match · original name'):'OK';
const normalizedName=name=>name.normalize('NFC').toLowerCase();
function entryPath(e,overrides=new Map()){
 let path=(overrides.get(e.id)??e.base)+e.ext,parent=e.parentId;
 while(parent){const folder=entries.find(x=>x.id===parent);if(!folder)break;path=(overrides.get(folder.id)??folder.base)+'/'+path;parent=folder.parentId;}
 return path;
}
function chooseFolders(){return new Promise(resolve=>{
 const dialog=$('folder-choice');dialog.returnValue='';dialog.showModal();
 dialog.addEventListener('close',()=>resolve(dialog.returnValue==='folders'?'folders':dialog.returnValue==='files'?'files':null),{once:true});
});}

function cancelDuplicatePreview(){
 pendingDuplicateChanges=null;
 $('duplicate-preview').hidden=true;
 $('duplicate-preview-rows').replaceChildren();
}
function proposeDuplicateResolution(){
 const groups=new Map();
 entries.forEach((e,i)=>{const key=normalizedName(entryPath(e));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
 const occupied=new Set(entries.map(e=>normalizedName(entryPath(e))));
 const proposed=[],overrides=new Map();
 for(const indices of groups.values()){
   if(indices.length<2 || invalid(entries[indices[0]].base))continue;
   // Keep first occurrence; only the later duplicates receive a suffix.
   for(const i of indices.slice(1)){
     const e=entries[i];let number=2,base,name;
     do {base=e.base+'_'+String(number).padStart(2,'0');overrides.set(e.id,base);name=entryPath(e,overrides);number++;}
     while(occupied.has(normalizedName(name)));
     occupied.add(normalizedName(name));
     proposed.push({i,old:e.base+e.ext,base,newName:name});
   }
 }
 return proposed;
}
function validate(){
 cancelDuplicatePreview();
 const seen=new Map();for(const e of entries){const n=normalizedName(entryPath(e));seen.set(n,(seen.get(n)||0)+1);}
 for(const e of entries){const full=e.base+e.ext; e.error=(invalid(e.base)||invalid(full))?tr('Nome non valido','Invalid name'):(seen.get(normalizedName(entryPath(e)))>1?tr('Duplicato','Duplicate'):'');}
 const selected=entries.filter(e=>e.selected);const errors=entries.filter(e=>e.error);
 $('download').disabled=!selected.length||errors.length>0;
 $('resolve-duplicates').hidden=![...seen.values()].some(n=>n>1);
 $('duplicate-note').textContent=$('resolve-duplicates').hidden?'':tr('Sono presenti nomi duplicati. Puoi correggerli a mano oppure visualizzare una proposta.','Duplicate names detected. Edit them manually or preview a suggested fix.');
 $('status').textContent=tr(`${entries.length} file · ${selected.length} selezionati · ${errors.length} problemi`,`${entries.length} files · ${selected.length} selected · ${errors.length} issues`);
}
function render(){
 $('rows').innerHTML=entries.map((e,i)=>`<tr class="${e.error?'invalid':''}"><td><input type="checkbox" data-select="${i}" ${e.selected?'checked':''}></td><td>${e.isDirectory?'📁 ':''}${escapeHTML(e.originalPath||e.file.name)}</td><td><input type="text" data-name="${i}" value="${escapeHTML(e.base)}" aria-label="${tr('Nuovo nome','New name')} ${i+1}"></td><td>${escapeHTML(e.ext)}</td><td data-error="${i}">${escapeHTML(e.error||matchStatus(e))}</td></tr>`).join('');validate();updateErrors();
}
function updateErrors(){document.querySelectorAll('[data-error]').forEach(el=>{const i=+el.dataset.error;el.textContent=entries[i].error||matchStatus(entries[i]);el.closest('tr').classList.toggle('invalid',!!entries[i].error);});}
$('resolve-duplicates').addEventListener('click',()=>{
 const changes=proposeDuplicateResolution();
 if(!changes.length){$('status').textContent=tr('Correggi prima i nomi non validi.','Correct invalid names first.');return;}
 pendingDuplicateChanges=changes;
 $('duplicate-preview-rows').innerHTML=changes.map(c=>`<tr><td>${escapeHTML(c.old)}</td><td>${escapeHTML(c.newName)}</td></tr>`).join('');
 $('duplicate-preview').hidden=false;
});
$('duplicate-cancel').addEventListener('click',cancelDuplicatePreview);
$('duplicate-confirm').addEventListener('click',()=>{
 if(!pendingDuplicateChanges)return;
 const changes=pendingDuplicateChanges;
 for(const c of changes)entries[c.i].base=c.base;
 saveDraft();
 render();
 $('status').textContent=tr(`${changes.length} nomi duplicati risolti.`,`${changes.length} duplicate names resolved.`);
});
$('rows').addEventListener('input',event=>{const t=event.target;if(t.dataset.name===undefined)return;entries[+t.dataset.name].base=t.value;saveDraft();validate();updateErrors();});
$('rows').addEventListener('change',event=>{const t=event.target;if(t.dataset.select===undefined)return;entries[+t.dataset.select].selected=t.checked;validate();});
$('all').addEventListener('change',e=>{entries.forEach(x=>x.selected=e.target.checked);render();});
function addFiles(files){
 for(const input of files){const item=input.file?input:{file:input,isDirectory:false,parentId:null,id:crypto.randomUUID()};
 const {file}=item,{base,ext}=item.isDirectory?{base:file.name,ext:''}:split(file.name);
 entries.push({...item,file,base,ext,originalBase:base,csvBase:base,selected:true,error:''});}
 render();refreshMapping();$('file-status').textContent=tr(`${files.length} elementi aggiunti.`,`${files.length} items added.`);
}
$('files').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value='';});
for(const eventName of ['dragover','dragenter'])$('drop').addEventListener(eventName,e=>{e.preventDefault();$('drop').classList.add('drag');});
$('drop').addEventListener('dragleave',()=> $('drop').classList.remove('drag'));
let importing=false;
$('drop').addEventListener('drop',async e=>{
 e.preventDefault();$('drop').classList.remove('drag');if(importing)return;importing=true;
 try{const items=await readDrop(e.dataTransfer,chooseFolders);if(items.length)addFiles(items);}
 catch{$('file-status').textContent=tr('Impossibile leggere la cartella: nessun elemento aggiunto.','Cannot read folder: no items added.');}
 finally{importing=false;}
});
$('reset').addEventListener('click',()=>{entries.forEach(e=>e.base=e.isDirectory?e.file.name:split(e.file.name).base);saveDraft();render();});
const rules=[];
function addRule(find='',replace=''){
 const rule={find,replace};rules.push(rule);
 const row=document.createElement('div');row.className='rename-rule';
 const f=document.createElement('input');f.type='text';f.placeholder=tr('Trova','Find');f.value=find;f.setAttribute('aria-label',tr('Trova','Find'));
 const r=document.createElement('input');r.type='text';r.placeholder=tr('Sostituisci con','Replace with');r.value=replace;r.setAttribute('aria-label',tr('Sostituisci con','Replace with'));
 const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='×';b.title=tr('Rimuovi coppia','Remove pair');
 f.addEventListener('input',()=>rule.find=f.value);r.addEventListener('input',()=>rule.replace=r.value);
 b.addEventListener('click',()=>{rules.splice(rules.indexOf(rule),1);row.remove();});
 row.append(f,r,b);$('rules').append(row);
}
$('add-rule').addEventListener('click',()=>addRule());addRule();
$('apply').addEventListener('click',()=>{
 if(renameMode!=='original')return;
 if(rules.some(r=>!r.find&&r.replace)){$('status').textContent=tr('Completa la coppia Trova/Sostituisci.','Complete the Find/Replace pair.');return;}
 const chosen=entries.filter(e=>e.selected);
 if(!chosen.length){$('status').textContent=tr('Seleziona almeno un file.','Select at least one file.');return;}
 const numbered=$('sequence-on').checked,width=Number($('sequence-digits').value),first=Number($('sequence-first').value);
 if(numbered&&(![2,3,4].includes(width)||!$('sequence-first').value.trim()||!Number.isSafeInteger(first)||first<0||first>999999||!Number.isSafeInteger(first+chosen.length-1))){$('status').textContent=tr('Numero iniziale non valido.','Invalid starting number.');return;}
 const prefix=$('prefix').value,suffix=$('suffix').value,glue=$('sequence-separator').value,atStart=$('sequence-position').value==='start';
 const changes=chosen.map((e,i)=>{
  const original=e.isDirectory?e.file.name:split(e.file.name).base;
  const name=changeCase(replaceAll(original,rules,$('case-sensitive').checked).text,$('case-mode').value,it?'it':'en');
  const seq=numbered?String(first+i).padStart(width,'0'):'';
  return {e,base:(numbered&&atStart?seq+glue:'')+prefix+name+suffix+(numbered&&!atStart?glue+seq:'')};
 });
 for(const {e,base} of changes)e.base=base;
 saveDraft();render();
});
const csvErrors={
 csvSyntax:tr('CSV non valido: controlla virgolette e separatore.','Invalid CSV: check quotes and delimiter.'),
 csvColumns:tr('Servono almeno due colonne; verifica il separatore e le colonne scelte.','At least two columns are required; check the delimiter and selected columns.'),
 csvChoice:tr('Scegli due colonne diverse per nome originale e nuovo nome.','Choose different columns for original and new name.'),
 csvEmpty:tr('Nessuna coppia completa nelle colonne scelte. Verifica le colonne; le righe incomplete vengono ignorate.','No complete pairs in the selected columns. Check the columns; incomplete rows are skipped.'),
 csvAmbiguous:tr('Lo stesso nome originale ha più nuovi nomi diversi.','The same original name has different replacement names.'),
 csvExtension:tr('Una nuova estensione non corrisponde al file originale. Le estensioni sono protette.','A new extension differs from the original file. Extensions are protected.'),
 csvName:tr('La tabella contiene un nuovo nome non valido.','The table contains an invalid new filename.')
};
function mappingPlan(){return planMapping(entries,csvData.rows,Number($('csv-old').value),Number($('csv-new').value),$('csv-header').checked);}
function refreshMapping(){
 $('csv-apply').disabled=true;$('csv-preview').replaceChildren();
 if(!csvData)return;
 const old=Number($('csv-old').value),next=Number($('csv-new').value);
 const rows=csvData.rows.slice($('csv-header').checked?1:0);
 $('csv-preview').innerHTML=rows.slice(0,200).map(row=>{
 const name=(row[old]??'').normalize('NFC'),newName=row[next]??'';
 const present=entries.some(e=>(e.originalPath||e.file.name).normalize('NFC')===name||e.file.name.normalize('NFC')===name);
 const status=!name.trim()||!newName.trim()?tr('Riga incompleta · ignorata','Incomplete row · skipped'):present?tr('File presente','File uploaded'):tr('Non presente tra i file caricati','Not among uploaded files');
 return `<tr><td>${escapeHTML(name)}</td><td>${escapeHTML(newName)}</td><td>${escapeHTML(status)}</td></tr>`;
 }).join('');
 try{
  const plan=mappingPlan();
  $('csv-status').textContent=tr(`${rows.length} righe · ${plan.skipped} righe incomplete ignorate · ${plan.matched} file associati · ${plan.unmatched} file senza corrispondenza · ${plan.unused} nomi CSV non caricati. Anteprima fino a 200 righe. Premi Applica tabella per confermare.`,`${rows.length} rows · ${plan.skipped} incomplete rows skipped · ${plan.matched} matched files · ${plan.unmatched} unmatched files · ${plan.unused} CSV names not uploaded. Preview of up to 200 rows. Press Apply table to confirm.`);
  $('csv-apply').disabled=!plan.matched;
 }catch(error){$('csv-status').textContent=csvErrors[error.message]||error.message;}
}
function showColumns(preserve=false){
 const previous=[$('csv-old').value,$('csv-new').value],heads=csvData.rows[0],header=$('csv-header').checked;
 for(const [index,id] of ['csv-old','csv-new'].entries()){
  const select=$(id);select.replaceChildren();
  heads.forEach((name,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=header?`${i+1}. ${name||tr('Senza titolo','Untitled')}`:tr(`Colonna ${i+1}: ${name}`,`Column ${i+1}: ${name}`);select.append(option);});
  const guess=header?heads.findIndex(h=>(index===0?/^(old[_ ]?name|nome originale)$/i:/^(new[_ ]?name|nuovo nome)$/i).test(h.trim())):-1;
  select.value=preserve&&previous[index]!==''&&Number(previous[index])<heads.length?previous[index]:String(guess>=0?guess:index);
 }
 $('csv-columns').hidden=false;refreshMapping();
}
$('mapping').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;const ticket=++csvRead;csvData=null;csvText='';$('csv-columns').hidden=true;$('csv-apply').disabled=true;
 try{
  const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(ticket!==csvRead)return;
  csvText=text;const data=parseTable(text,$('csv-separator').value);csvData=data;showColumns();
 }catch(error){if(ticket===csvRead)$('csv-status').textContent=csvErrors[error.message]||tr('Impossibile leggere il CSV. Esportalo in UTF-8.','Cannot read CSV. Export it as UTF-8.');}
 finally{if(ticket===csvRead)event.target.value='';}
});
$('csv-separator').addEventListener('change',()=>{
 if(!csvText)return;
 try{csvData=parseTable(csvText,$('csv-separator').value);showColumns();}catch(error){csvData=null;$('csv-columns').hidden=true;$('csv-apply').disabled=true;$('csv-status').textContent=csvErrors[error.message]||error.message;}
});
$('csv-header').addEventListener('change',()=>{if(csvData)showColumns(true);});
for(const id of ['csv-old','csv-new'])$(id).addEventListener('change',refreshMapping);
$('csv-apply').addEventListener('click',()=>{
 if(renameMode!=='csv'||!csvData)return;
 try{
  const plan=mappingPlan();if(!plan.matched){refreshMapping();return;}
  for(const {entry,base,matched} of plan.changes){entry.csvBase=base;entry.base=base;entry.csvMatched=matched;}
  render();$('csv-status').textContent=tr(`${plan.matched} file rinominati dalla tabella; ${plan.unmatched} mantengono il nome originale. I file caricati sono tutti presenti.`,`${plan.matched} files renamed from the table; ${plan.unmatched} keep their original name. All uploaded files are still present.`);
 }catch(error){$('csv-status').textContent=csvErrors[error.message]||error.message;}
});
// Prevent browser navigation (and loss of in-memory files) on file drops.
for(const type of ['dragover','drop'])window.addEventListener(type,event=>{if([...event.dataTransfer?.types||[]].includes('Files'))event.preventDefault();});
$('csv-drop').addEventListener('dragover',event=>event.preventDefault());
$('csv-drop').addEventListener('drop',event=>{
 event.preventDefault();const files=[...event.dataTransfer.files];
 if(files.length!==1||! /\.(csv|tsv)$/i.test(files[0].name)){$('csv-status').textContent=tr('Trascina una sola tabella CSV o TSV.','Drop one CSV or TSV table.');return;}
 const transfer=new DataTransfer();transfer.items.add(files[0]);$('mapping').files=transfer.files;$('mapping').dispatchEvent(new Event('change',{bubbles:true}));
});
const csvQuote=s=>'"'+String(s).replace(/"/g,'""')+'"';
function mapping(){return 'old_name,new_name\r\n'+entries.map(e=>[e.originalPath||e.file.name,e.base+e.ext].map(csvQuote).join(',')).join('\r\n');}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
for(const id of ['mapping-export','csv-download'])$(id).addEventListener('click',()=>downloadBlob(new Blob(['\ufeff',mapping()],{type:'text/csv;charset=utf-8'}),'mrc-file-mapping.csv'));
// Minimal ZIP writer: STORE entries, CRC-32, UTF-8 names, no external library/network.
const encoder=new TextEncoder();const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function header(length){return new DataView(new ArrayBuffer(length));}
function put(view,offset,value,size){if(size===2)view.setUint16(offset,value,true);else view.setUint32(offset,value,true);}
async function makeZip(items){if(items.length>65535)throw Error('ZIP64 not supported');let local=[],central=[],offset=0;for(const e of items){const bytes=e.isDirectory?new Uint8Array(0):new Uint8Array(await e.file.arrayBuffer()),name=encoder.encode(e.exportPath||entryPath(e)+(e.isDirectory?'/':'')),crc=crc32(bytes);if(name.length>65535||bytes.length>0xffffffff||offset+30+name.length+bytes.length>0xffffffff)throw Error('ZIP64 not supported');
 const h=header(30);put(h,0,0x04034b50,4);put(h,4,20,2);put(h,6,0x0800,2);put(h,12,33,2);put(h,14,crc,4);put(h,18,bytes.length,4);put(h,22,bytes.length,4);put(h,26,name.length,2);local.push(h.buffer,name,bytes);const c=header(46);put(c,0,0x02014b50,4);put(c,4,20,2);put(c,6,20,2);put(c,8,0x0800,2);put(c,14,33,2);put(c,16,crc,4);put(c,20,bytes.length,4);put(c,24,bytes.length,4);put(c,28,name.length,2);put(c,38,e.isDirectory?16:0,4);put(c,42,offset,4);central.push(c.buffer,name);offset+=30+name.length+bytes.length;}
 const centralSize=central.reduce((n,b)=>n+b.byteLength,0);if(offset+centralSize>0xffffffff)throw Error('ZIP64 not supported');const end=header(22);put(end,0,0x06054b50,4);put(end,8,items.length,2);put(end,10,items.length,2);put(end,12,centralSize,4);put(end,16,offset,4);return new Blob([...local,...central,end.buffer],{type:'application/zip'});}
$('download').addEventListener('click',async()=>{validate();if($('download').disabled)return;const button=$('download');button.disabled=true;try{const zip=await makeZip(entries.filter(e=>e.selected).map(e=>({...e,exportPath:entryPath(e)+(e.isDirectory?'/':'')})));downloadBlob(zip,'mrc-renamed-files.zip');}catch(error){validate();$('status').textContent=error.message;return;}validate();});
render();
