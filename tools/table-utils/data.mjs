// CSV values remain strings: no type conversion or formula evaluation.
export function parseCSV(text, delimiter=',') {
 text=text.replace(/^\uFEFF/,''); if(!text)return [];
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c===delimiter){row.push(cell);cell='';closed=false}
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';closed=false}
  else if(c==='"'&&cell===''&&!closed)quoted=true;
  else {if(closed)throw Error('CSV_QUOTE');cell+=c}
 }
 if(quoted)throw Error('CSV_QUOTE');
 if(row.length||cell!==''||closed||!/[\r\n]$/.test(text)){row.push(cell);rows.push(row)}
 return rows;
}
export function detectDelimiter(text){
 let best=',',bestScore=-1;
 for(const delimiter of [',',';','\t','|']){try{
  const rows=parseCSV(text,delimiter).filter(r=>r.some(Boolean)).slice(0,30);if(!rows.length)continue;
  const counts=new Map();for(const row of rows)counts.set(row.length,(counts.get(row.length)||0)+1);
  const [width,freq]=[...counts].sort((a,b)=>b[1]-a[1])[0];
  const score=width>1?freq/rows.length*100+Math.min(width,50):0;
  if(score>bestScore){best=delimiter;bestScore=score}
 }catch{}}
 return best;
}
export function csvText(rows,delimiter=',',newline='\r\n',terminal=true){return rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(delimiter)).join(newline)+(terminal&&rows.length?newline:'')}
export function download(text,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
export function sizeText(n){if(n<1024)return n+' B';const units=['KiB','MiB','GiB','TiB'];let i=-1;do{n/=1024;i++}while(n>=1024&&i<3);return n.toFixed(2)+' '+units[i]}
export function fileRecord(file,path){const parts=path.split('/');const name=parts.pop();const dot=name.lastIndexOf('.');return {name,extension:dot>0?name.slice(dot+1):'',path,folder:parts.join('/'),bytes:file.size,size:sizeText(file.size),modified:file.lastModified?new Date(file.lastModified).toISOString():'',mime:file.type||'',depth:Math.max(0,parts.length-1)}}
export function orderRows(rows,column,descending=false,header=true,numeric=false){const start=header?1:0;const head=rows.slice(0,start);const tail=rows.slice(start).map((row,i)=>({row,i}));const collator=new Intl.Collator(undefined,{numeric:false,sensitivity:'base'});tail.sort((a,b)=>{const x=a.row[column]??'',y=b.row[column]??'';let diff=collator.compare(x,y);if(numeric&&x.trim()&&y.trim()&&Number.isFinite(Number(x))&&Number.isFinite(Number(y)))diff=Number(x)-Number(y);return (descending?-diff:diff)||a.i-b.i});return head.concat(tail.map(x=>x.row))}
