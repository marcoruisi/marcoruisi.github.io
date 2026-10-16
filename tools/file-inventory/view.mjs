export const fields=['name','extension','path','folder','size','modified','depth'];
export const filterFields=['extension','folder','depth'];
export function filterValue(row,key){return key==='extension'?row.extension.toLocaleLowerCase():String(row[key])}
export function selectRecords(records,{query='',hidden=true,selections={},sort='path',direction=1}={}){
 const q=query.trim().toLocaleLowerCase();
 return records.filter(r=>r.name.toLocaleLowerCase().includes(q)&&(hidden||!r.path.split('/').some(x=>x.startsWith('.')))&&filterFields.every(k=>selections[k]==null||selections[k].has(filterValue(r,k))))
 .sort((a,b)=>{let diff;if(sort==='size')diff=a.bytes-b.bytes;else if(sort==='depth')diff=a.depth-b.depth;else diff=String(a[sort]).localeCompare(String(b[sort]),undefined,{numeric:true});return direction*diff||a.path.localeCompare(b.path,undefined,{numeric:true})});
}
