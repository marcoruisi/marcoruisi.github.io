import {changeCase} from '../multiple-find-replace/case-transform.mjs';
import {replaceAll} from '../multiple-find-replace/core.mjs';
const it=document.documentElement.lang==='it', $=id=>document.getElementById(id);
const tr=(a,b)=>it?a:b;
let entries=[];
const split=name=>{const p=name.lastIndexOf('.');return p>0?{base:name.slice(0,p),ext:name.slice(p)}:{base:name,ext:''};};
const invalid=name=>!name||name==='.'||name==='..'||/[\\/\x00-\x1f<>:"|?*]/.test(name)||/[. ]$/.test(name);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pendingDuplicateChanges=null;
const normalizedName=name=>name.normalize('NFC').toLocaleLowerCase();
function cancelDuplicatePreview(){
 pendingDuplicateChanges=null;
 $('duplicate-preview').hidden=true;
 $('duplicate-preview-rows').replaceChildren();
}
function proposeDuplicateResolution(){
 const groups=new Map();
 entries.forEach((e,i)=>{const key=normalizedName(e.base+e.ext);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
 const occupied=new Set(entries.map(e=>normalizedName(e.base+e.ext)));
 const proposed=[];
 for(const indices of groups.values()){
   if(indices.length<2)continue;
   // Keep first occurrence; only the later duplicates receive a suffix.
   for(const i of indices.slice(1)){
     const e=entries[i];let number=2,base,name;
     do {base=e.base+'_'+String(number).padStart(2,'0');name=base+e.ext;number++;}
     while(occupied.has(normalizedName(name))||invalid(base));
     occupied.add(normalizedName(name));
     proposed.push({i,old:e.base+e.ext,base,newName:name});
   }
 }
 return proposed;
}
function validate(){
 cancelDuplicatePreview();
 const seen=new Map();for(const e of entries){const n=normalizedName(e.base+e.ext);seen.set(n,(seen.get(n)||0)+1);}
 for(const e of entries){const full=e.base+e.ext; e.error=invalid(e.base)?tr('Nome non valido','Invalid name'):(seen.get(normalizedName(full))>1?tr('Duplicato','Duplicate'):'');}
 const selected=entries.filter(e=>e.selected);const errors=entries.filter(e=>e.error);
 $('download').disabled=!selected.length||errors.length>0;
 $('resolve-duplicates').hidden=![...seen.values()].some(n=>n>1);
 $('duplicate-note').textContent=$('resolve-duplicates').hidden?'':tr('Sono presenti nomi duplicati. Puoi correggerli a mano oppure visualizzare una proposta.','Duplicate names detected. Edit them manually or preview a suggested fix.');
 $('status').textContent=tr(`${entries.length} file · ${selected.length} selezionati · ${errors.length} problemi`,`${entries.length} files · ${selected.length} selected · ${errors.length} issues`);
}
function render(){
 $('rows').innerHTML=entries.map((e,i)=>`<tr class="${e.error?'invalid':''}"><td><input type="checkbox" data-select="${i}" ${e.selected?'checked':''}></td><td>${escapeHTML(e.file.name)}</td><td><input type="text" data-name="${i}" value="${escapeHTML(e.base)}" aria-label="${tr('Nuovo nome','New name')} ${i+1}"></td><td>${escapeHTML(e.ext)}</td><td data-error="${i}">${escapeHTML(e.error||'OK')}</td></tr>`).join('');validate();updateErrors();
}
function updateErrors(){document.querySelectorAll('[data-error]').forEach(el=>{const i=+el.dataset.error;el.textContent=entries[i].error||'OK';el.closest('tr').classList.toggle('invalid',!!entries[i].error);});}
$('resolve-duplicates').addEventListener('click',()=>{
 const changes=proposeDuplicateResolution();
 if(!changes.length)return;
 pendingDuplicateChanges=changes;
 $('duplicate-preview-rows').innerHTML=changes.map(c=>`<tr><td>${escapeHTML(c.old)}</td><td>${escapeHTML(c.newName)}</td></tr>`).join('');
 $('duplicate-preview').hidden=false;
});
$('duplicate-cancel').addEventListener('click',cancelDuplicatePreview);
$('duplicate-confirm').addEventListener('click',()=>{
 if(!pendingDuplicateChanges)return;
 const changes=pendingDuplicateChanges;
 for(const c of changes)entries[c.i].base=c.base;
 render();
 $('status').textContent=tr(`${changes.length} nomi duplicati risolti.`,`${changes.length} duplicate names resolved.`);
});
$('rows').addEventListener('input',event=>{const t=event.target;if(t.dataset.name===undefined)return;entries[+t.dataset.name].base=t.value;validate();updateErrors();});
$('rows').addEventListener('change',event=>{const t=event.target;if(t.dataset.select===undefined)return;entries[+t.dataset.select].selected=t.checked;validate();});
$('all').addEventListener('change',e=>{entries.forEach(x=>x.selected=e.target.checked);render();});
function addFiles(files){for(const file of files){const {base,ext}=split(file.name);entries.push({file,base,ext,selected:true,error:''});}render();$('file-status').textContent=tr(`${files.length} file aggiunti.`,`Added ${files.length} files.`);}
$('files').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value='';});
for(const eventName of ['dragover','dragenter'])$('drop').addEventListener(eventName,e=>{e.preventDefault();$('drop').classList.add('drag');});
for(const eventName of ['drop','dragleave'])$('drop').addEventListener(eventName,e=>{e.preventDefault();$('drop').classList.remove('drag');if(eventName==='drop')addFiles([...e.dataTransfer.files]);});
$('reset').addEventListener('click',()=>{entries.forEach(e=>e.base=split(e.file.name).base);render();});
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
 if(rules.some(r=>!r.find&&r.replace)){$('status').textContent=tr('Completa la coppia Trova/Sostituisci.','Complete the Find/Replace pair.');return;}
 const mode=$('case-mode').value;
 for(const e of entries.filter(e=>e.selected)){
   let name=e.base;
   name=replaceAll(name,rules,$('case-sensitive').checked).text;
   e.base=changeCase(name,mode,it?'it':'en');
 }
 render();
});
// Prefix and suffix are literal. Sequence is a special prefix/suffix placed at the outer edge.
$('apply-extras').addEventListener('click',()=>{
 const chosen=entries.filter(e=>e.selected);
 if(!chosen.length){$('status').textContent=tr('Seleziona almeno un file.','Select at least one file.');return;}
 const prefix=$('prefix').value, suffix=$('suffix').value;
 const numbered=$('sequence-on').checked, width=Number($('sequence-digits').value);
 const first=Number($('sequence-first').value), glue=$('sequence-separator').value;
 if(numbered&&(!Number.isSafeInteger(first)||first<0||first>999999||!Number.isSafeInteger(first+chosen.length-1))){
   $('status').textContent=tr('Numero iniziale non valido.','Invalid starting number.');return;
 }
 if(!prefix&&!suffix&&!numbered){$('status').textContent=tr('Inserisci un prefisso, un suffisso o attiva la numerazione.','Enter a prefix or suffix, or enable numbering.');return;}
 const atStart=$('sequence-position').value==='start';
 chosen.forEach((e,i)=>{
   const seq=numbered?String(first+i).padStart(width,'0'):'';
   e.base=(numbered&&atStart?seq+glue:'')+prefix+e.base+suffix+(numbered&&!atStart?glue+seq:'');
 });
 render();
});
function parseCSV(text){const result=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){
 const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
 else if(c==='"'&&field==='')quoted=true;
 else if(c===','||c==='\r'||c==='\n'){row.push(field);field='';if(c!==','){if(row.some(x=>x!==''))result.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}
 else field+=c;
 }if(quoted)throw Error(tr('Virgolette CSV non chiuse','Unclosed CSV quotes'));if(row.length||field){row.push(field);result.push(row);}return result;
}
$('mapping').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{
 const csv=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/^\ufeff/,'');const rows=parseCSV(csv);
 if(rows[0]?.[0]?.toLowerCase()!=='old_name'||rows[0]?.[1]?.toLowerCase()!=='new_name')throw Error(tr('Intestazioni richieste: old_name,new_name','Required headers: old_name,new_name'));
 const lookup=new Map();for(const row of rows.slice(1)){if(row.length!==2||lookup.has(row[0]))throw Error(tr('CSV ambiguo o non valido','Ambiguous or invalid CSV'));lookup.set(row[0],row[1]);}
 let count=0;for(const entry of entries){if(!lookup.has(entry.file.name))continue;const proposed=lookup.get(entry.file.name),p=split(proposed);if(p.ext.toLowerCase()!==entry.ext.toLowerCase())throw Error(tr(`Estensione diversa: ${entry.file.name}`,`Extension mismatch: ${entry.file.name}`));entry.base=p.base;count++;}
 render();$('file-status').textContent=tr(`${count} nomi associati.`,`${count} names matched.`);
 }catch(error){$('file-status').textContent=error.message;}e.target.value='';});
const csvQuote=s=>'"'+String(s).replace(/"/g,'""')+'"';
function mapping(){return 'old_name,new_name\r\n'+entries.map(e=>[e.file.name,e.base+e.ext].map(csvQuote).join(',')).join('\r\n');}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
for(const id of ['mapping-export','csv-download'])$(id).addEventListener('click',()=>downloadBlob(new Blob(['\ufeff',mapping()],{type:'text/csv;charset=utf-8'}),'mrc-file-mapping.csv'));
// Minimal ZIP writer: STORE entries, CRC-32, UTF-8 names, no external library/network.
const encoder=new TextEncoder();const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function header(length){return new DataView(new ArrayBuffer(length));}
function put(view,offset,value,size){if(size===2)view.setUint16(offset,value,true);else view.setUint32(offset,value,true);}
async function makeZip(items){let local=[],central=[],offset=0;for(const e of items){const bytes=new Uint8Array(await e.file.arrayBuffer()),name=encoder.encode(e.base+e.ext),crc=crc32(bytes);if(bytes.length>0xffffffff||offset>0xffffffff)throw Error('ZIP64 not supported');
 const h=header(30);put(h,0,0x04034b50,4);put(h,4,20,2);put(h,6,0x0800,2);put(h,14,crc,4);put(h,18,bytes.length,4);put(h,22,bytes.length,4);put(h,26,name.length,2);local.push(h.buffer,name,bytes);const c=header(46);put(c,0,0x02014b50,4);put(c,4,20,2);put(c,6,20,2);put(c,8,0x0800,2);put(c,16,crc,4);put(c,20,bytes.length,4);put(c,24,bytes.length,4);put(c,28,name.length,2);put(c,42,offset,4);central.push(c.buffer,name);offset+=30+name.length+bytes.length;}
 const centralSize=central.reduce((n,b)=>n+b.byteLength,0),end=header(22);put(end,0,0x06054b50,4);put(end,8,items.length,2);put(end,10,items.length,2);put(end,12,centralSize,4);put(end,16,offset,4);return new Blob([...local,...central,end.buffer],{type:'application/zip'});}
$('download').addEventListener('click',async()=>{validate();if($('download').disabled)return;const button=$('download');button.disabled=true;try{const zip=await makeZip(entries.filter(e=>e.selected));downloadBlob(zip,'mrc-renamed-files.zip');}catch(error){$('status').textContent=error.message;}finally{validate();}});
render();
