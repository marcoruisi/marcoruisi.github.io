export function parseTable(text, separator='auto') {
 text=text.replace(/^\ufeff/,'');
 if(separator==='auto'){
  const counts={',':0,';':0,'\t':0};let quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted){if(c==='\r'||c==='\n')break;if(c in counts)counts[c]++;}}
  separator=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 }
 if(separator==='tab')separator='\t';
 const rows=[];let row=[],field='',quoted=false,closed=false;
 const endField=()=>{row.push(field);field='';closed=false;};
 const endRow=()=>{endField();if(row.some(x=>x!==''))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===separator){endField();continue;}
  if(c==='\r'||c==='\n'){endRow();if(c==='\r'&&text[i+1]==='\n')i++;continue;}
  if(closed)throw Error('csvSyntax');
  if(c==='"'){if(field!=='')throw Error('csvSyntax');quoted=true;}else field+=c;
 }
 if(quoted)throw Error('csvSyntax');
 if(field!==''||row.length||closed)endRow();
 if(!rows.length||rows[0].length<2)throw Error('csvColumns');
 return {rows,separator};
}
export function planMapping(entries,rows,oldColumn,newColumn,hasHeader=true){
 if(!Number.isInteger(oldColumn)||!Number.isInteger(newColumn)||oldColumn<0||newColumn<0||oldColumn===newColumn)throw Error('csvChoice');
 const lookup=new Map();let skipped=0;
 for(const row of rows.slice(hasHeader?1:0)){
  const old=(row[oldColumn]??'').normalize('NFC'),next=row[newColumn]??'';
  if(!old.trim()||!next.trim()){skipped++;continue;}
  if(lookup.has(old)&&lookup.get(old)!==next)throw Error('csvAmbiguous');
  lookup.set(old,next);
 }
 if(!lookup.size)throw Error('csvEmpty');
 const used=new Set();let matched=0;
 const changes=entries.map(entry=>{
  const path=(entry.originalPath||entry.file.name).normalize('NFC');
  const basename=entry.file.name.normalize('NFC');
  const key=lookup.has(path)?path:basename,original=entry.file.name.slice(0,entry.file.name.length-entry.ext.length);
  if(!lookup.has(key))return {entry,base:original,matched:false};
  if(key===basename&&entries.filter(e=>e.file.name.normalize('NFC')===basename).length>1)throw Error('csvAmbiguous');
  const next=lookup.get(key),p=entry.isDirectory?-1:next.lastIndexOf('.'),ext=p>0?next.slice(p):'',base=p>0?next.slice(0,p):next;
  if(ext.toLowerCase()!==entry.ext.toLowerCase())throw Error('csvExtension');
  if(!base||base==='.'||base==='..'||/[\\/\x00-\x1f<>:"|?*]/.test(next)||/[. ]$/.test(base)||/[. ]$/.test(next))throw Error('csvName');
  matched++;used.add(key);return {entry,base,matched:true};
 });
 return {changes,matched,unmatched:entries.length-matched,unused:lookup.size-used.size,skipped};
}
