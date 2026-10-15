import {fileRecord,csvText,download} from '../table-utils/data.mjs';
import {scanEntries} from './scan.mjs';
const it=document.documentElement.lang==='it',say=(a,b)=>it?a:b,$=id=>document.getElementById(id);
let records=[],source=null,run=0,page=0,filtered=[],busy=false;
const fields=['name','extension','path','folder','bytes','size','modified','mime','depth'];
const labels=it?['Nome','Estensione','Percorso relativo','Cartella','Dimensione (byte)','Dimensione','Ultima modifica (UTC)','Tipo MIME','Profondità']:['Name','Extension','Relative path','Folder','Size (bytes)','Size','Last modified (UTC)','MIME type','Depth'];
function limit(){return $('all-depth').checked?Infinity:Math.max(0,Math.floor(Number($('depth').value)||0))}
function view(){
 const q=$('search').value.toLocaleLowerCase();filtered=records.filter(r=>r.path.toLocaleLowerCase().includes(q)&&($('hidden-files').checked||!r.path.split('/').some(x=>x.startsWith('.'))));
 const key=$('sort').value;filtered.sort((a,b)=>key==='bytes'?b.bytes-a.bytes:String(a[key]).localeCompare(String(b[key]),undefined,{numeric:true}));
 page=Math.max(0,Math.min(page,Math.ceil(filtered.length/100)-1));$('rows').replaceChildren();
 for(const r of filtered.slice(page*100,page*100+100)){const tr=document.createElement('tr');for(const key of fields){const td=document.createElement('td');td.textContent=r[key];tr.append(td)}$('rows').append(tr)}
 $('count').textContent=say(`${filtered.length} file visualizzati · ${records.length} trovati`,`${filtered.length} files shown · ${records.length} found`);
 $('page').textContent=`${page+1} / ${Math.max(1,Math.ceil(filtered.length/100))}`;$('prev').disabled=page===0;$('next').disabled=(page+1)*100>=filtered.length;
 for(const id of ['csv','txt','copy'])$(id).disabled=busy||!filtered.length;
}
async function scan(){if(!source)return;const token=++run;busy=true;records=[];page=0;$('issues').replaceChildren();let errors=0,seen=0;
 $('stop').disabled=false;$('status').textContent=say('Scansione in corso…','Scanning…');view();
 const add=async r=>{records.push(r);if(++seen%200===0){$('status').textContent=say(`${seen} file letti…`,`${seen} files read…`);await new Promise(r=>setTimeout(r,0))}};
 const fail=(path)=>{errors++;if(errors<=20){const li=document.createElement('li');li.textContent=path;$('issues').append(li)}};
 try{if(source.entries)await scanEntries(source.entries,limit(),add,fail,()=>token===run);
 else for(const f of source.files){if(token!==run)break;const r=fileRecord(f,f.webkitRelativePath||f.name);if(r.depth<=limit())await add(r)}
 if(token!==run)return;
 $('status').textContent=say(`Scansione completata: ${records.length} file.`, `Scan complete: ${records.length} files.`)+(errors?say(` ${errors} elementi non leggibili; elenco parziale.`, ` ${errors} unreadable items; partial list.`):'');
 }catch(e){if(token===run)$('status').textContent=say('Scansione non riuscita. Prova a selezionare la cartella.','Scan failed. Try selecting the folder.')}
 finally{if(token===run){busy=false;$('stop').disabled=true;view()}}
}
$('folder').onchange=()=>{const files=[...$('folder').files];if(files.length){source={files};scan()}else $('status').textContent=say('Nessun file selezionato. La cartella potrebbe essere vuota.','No files selected. The folder may be empty.');$('folder').value=''};
$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('drag')};$('drop').ondragleave=()=>$('drop').classList.remove('drag');
$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('drag');const items=[...e.dataTransfer.items];const entries=items.map(x=>x.webkitGetAsEntry?.()).filter(Boolean);if(!entries.length||entries.some(x=>!x.isDirectory)){$('status').textContent=say('Trascina una cartella oppure usa Seleziona cartella.','Drop a folder or use Select folder.');return}source={entries};scan()};
$('scan').onclick=scan;$('stop').onclick=()=>{run++;busy=false;$('stop').disabled=true;$('status').textContent=say('Scansione interrotta: elenco parziale.','Scan stopped: partial list.');view()};
$('all-depth').onchange=()=>{$('depth').disabled=$('all-depth').checked};
for(const id of ['search','hidden-files','sort'])$(id).addEventListener('input',()=>{page=0;view()});
$('prev').onclick=()=>{page--;view()};$('next').onclick=()=>{page++;view()};
$('csv').onclick=()=>download('\uFEFF'+csvText([labels,...filtered.map(r=>fields.map(k=>r[k]))],';'),'mrc-file-inventory.csv','text/csv;charset=utf-8');
$('txt').onclick=()=>download(filtered.map(r=>r.path).join('\n'),'mrc-file-list.txt');
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(filtered.map(r=>r.path).join('\n'));$('status').textContent=say('Elenco copiato.','List copied.')}catch{$('status').textContent=say('Copia non disponibile: scarica il TXT.','Copy unavailable: download the TXT.')}};
const head=document.createElement('tr');for(const label of labels){const th=document.createElement('th');th.textContent=label;head.append(th)}$('heads').append(head);view();
