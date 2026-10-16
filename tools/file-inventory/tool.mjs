import {fileRecord,csvText,download} from '../table-utils/data.mjs';
import {scanEntries} from './scan.mjs';
import {fields,filterFields,filterValue,selectRecords} from './view.mjs';
const it=document.documentElement.lang==='it',say=(a,b)=>it?a:b,$=id=>document.getElementById(id);
let records=[],source=null,run=0,page=0,filtered=[],busy=false;
const labels=it?['Nome','Estensione','Percorso relativo','Cartella','Dimensione','Ultima modifica (UTC)','Profondità']:['Name','Extension','Relative path','Folder','Size','Last modified (UTC)','Depth'];
let sortKey='path',sortDirection=1,selections={};
const filterBoxes=new Map(),sortHeaders=new Map();
function refreshFilters(){
 for(const key of filterFields){
  const host=filterBoxes.get(key);host.replaceChildren();
  const values=[...new Set(records.map(r=>filterValue(r,key)))].sort((a,b)=>key==='depth'?Number(a)-Number(b):a.localeCompare(b,undefined,{numeric:true}));
  const actions=document.createElement('div');actions.className='inventory-filter-actions';
  for(const [all,label] of [[true,say('Tutti','All')],[false,say('Nessuno','None')]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=busy||!values.length;b.onclick=()=>{selections[key]=all?null:new Set();refreshFilters();page=0;view()};actions.append(b)}host.append(actions);
  const choices=document.createElement('div');choices.className='inventory-filter-options';
  for(const value of values){const label=document.createElement('label');label.className='inline';const input=document.createElement('input');input.type='checkbox';input.checked=selections[key]==null||selections[key].has(value);input.disabled=busy;
   input.onchange=()=>{if(selections[key]==null)selections[key]=new Set(values);input.checked?selections[key].add(value):selections[key].delete(value);if(selections[key].size===values.length)selections[key]=null;page=0;view()};
   label.append(input,document.createTextNode(value||say('Senza estensione','No extension')));choices.append(label)
  }host.append(choices);
  if(!values.length){const empty=document.createElement('p');empty.textContent=say('Nessun valore disponibile','No values available');host.append(empty)}
 }
}
function buildHeaders(){
 const head=document.createElement('tr');
 fields.forEach((key,i)=>{const th=document.createElement('th'),button=document.createElement('button'),arrow=document.createElement('span');button.type='button';button.className='inventory-sort';arrow.setAttribute('aria-hidden','true');button.append(document.createTextNode(labels[i]+' '),arrow);button.onclick=()=>{sortDirection=sortKey===key?-sortDirection:1;sortKey=key;page=0;view()};th.append(button);sortHeaders.set(key,{th,button,arrow});
  if(filterFields.includes(key)){const details=document.createElement('details');details.className='inventory-filter';const summary=document.createElement('summary');summary.textContent=say('Filtra','Filter');summary.setAttribute('aria-label',say('Filtra: ','Filter: ')+labels[i]);const box=document.createElement('div');box.className='inventory-filter-box';details.append(summary,box);th.append(details);filterBoxes.set(key,box)}head.append(th)
 });$('heads').replaceChildren(head);refreshFilters();
}
function limit(){return $('all-depth').checked?Infinity:Math.max(0,Math.floor(Number($('depth').value)||0))}
function view(){
 filtered=selectRecords(records,{query:$('search').value,hidden:$('hidden-files').checked,selections,sort:sortKey,direction:sortDirection});
 for(const [key,{th,button,arrow}] of sortHeaders){const active=key===sortKey;th.setAttribute('aria-sort',active?(sortDirection===1?'ascending':'descending'):'none');arrow.textContent=active?(sortDirection===1?'↑':'↓'):'↕';button.title=say('Ordina per ','Sort by ')+labels[fields.indexOf(key)];}
 for(const [key,host] of filterBoxes){const filtered=selections[key]!=null;host.parentElement.querySelector('summary').textContent=say('Filtra','Filter')+(filtered?' ('+selections[key].size+')':'');}
 page=Math.max(0,Math.min(page,Math.ceil(filtered.length/100)-1));$('rows').replaceChildren();
 for(const r of filtered.slice(page*100,page*100+100)){const tr=document.createElement('tr');for(const key of fields){const td=document.createElement('td');td.textContent=r[key];tr.append(td)}$('rows').append(tr)}
 $('count').textContent=say(`${filtered.length} file visualizzati · ${records.length} trovati`,`${filtered.length} files shown · ${records.length} found`);
 $('page').textContent=`${page+1} / ${Math.max(1,Math.ceil(filtered.length/100))}`;$('prev').disabled=page===0;$('next').disabled=(page+1)*100>=filtered.length;
 for(const id of ['csv','txt','copy'])$(id).disabled=busy||!filtered.length;
}
async function scan(){if(!source)return;const token=++run;busy=true;records=[];page=0;selections={};refreshFilters();$('issues').replaceChildren();let errors=0,seen=0;
 $('stop').disabled=false;$('status').textContent=say('Scansione in corso…','Scanning…');view();
 const add=async r=>{records.push(r);if(++seen%200===0){$('status').textContent=say(`${seen} file letti…`,`${seen} files read…`);await new Promise(r=>setTimeout(r,0))}};
 const fail=(path)=>{errors++;if(errors<=20){const li=document.createElement('li');li.textContent=path;$('issues').append(li)}};
 try{if(source.entries)await scanEntries(source.entries,limit(),add,fail,()=>token===run);
 else for(const f of source.files){if(token!==run)break;const r=fileRecord(f,f.webkitRelativePath||f.name);if(r.depth<=limit())await add(r)}
 if(token!==run)return;
 $('status').textContent=say(`Scansione completata: ${records.length} file.`, `Scan complete: ${records.length} files.`)+(errors?say(` ${errors} elementi non leggibili; elenco parziale.`, ` ${errors} unreadable items; partial list.`):'');
 }catch(e){if(token===run)$('status').textContent=say('Scansione non riuscita. Prova a selezionare la cartella.','Scan failed. Try selecting the folder.')}
 finally{if(token===run){busy=false;$('stop').disabled=true;refreshFilters();view()}}
}
$('folder').onchange=()=>{const files=[...$('folder').files];if(files.length){source={files};scan()}else $('status').textContent=say('Nessun file selezionato. La cartella potrebbe essere vuota.','No files selected. The folder may be empty.');$('folder').value=''};
$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('drag')};$('drop').ondragleave=()=>$('drop').classList.remove('drag');
$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('drag');const items=[...e.dataTransfer.items];const entries=items.map(x=>x.webkitGetAsEntry?.()).filter(Boolean);if(!entries.length||entries.some(x=>!x.isDirectory)){$('status').textContent=say('Trascina una cartella oppure usa Seleziona cartella.','Drop a folder or use Select folder.');return}source={entries};scan()};
$('scan').onclick=scan;$('stop').onclick=()=>{run++;busy=false;$('stop').disabled=true;$('status').textContent=say('Scansione interrotta: elenco parziale.','Scan stopped: partial list.');refreshFilters();view()};
$('all-depth').onchange=()=>{$('depth').disabled=$('all-depth').checked};
for(const id of ['search','hidden-files'])$(id).addEventListener('input',()=>{page=0;view()});
$('prev').onclick=()=>{page--;view()};$('next').onclick=()=>{page++;view()};
$('csv').onclick=()=>download('\uFEFF'+csvText([labels,...filtered.map(r=>fields.map(k=>r[k]))],';'),'mrc-file-inventory.csv','text/csv;charset=utf-8');
$('txt').onclick=()=>download(filtered.map(r=>r.path).join('\n'),'mrc-file-list.txt');
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(filtered.map(r=>r.path).join('\n'));$('status').textContent=say('Elenco copiato.','List copied.')}catch{$('status').textContent=say('Copia non disponibile: scarica il TXT.','Copy unavailable: download the TXT.')}};
buildHeaders();view();
