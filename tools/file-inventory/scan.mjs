import {fileRecord} from '../table-utils/data.mjs';
export async function scanEntries(entries,maxDepth,onFile,onError,alive=()=>true){
 async function walk(entry,path,depth){
  if(!alive())return;
  try{
   if(entry.isFile){if(depth<=maxDepth){const f=await new Promise((ok,no)=>entry.file(ok,no));if(alive())await onFile(fileRecord(f,path))}return}
   if(!entry.isDirectory||depth>maxDepth)return;
   const reader=entry.createReader();while(alive()){
    const batch=await new Promise((ok,no)=>reader.readEntries(ok,no));if(!batch.length)break;
    for(const child of batch){if(!alive())return;await walk(child,path+'/'+child.name,child.isDirectory?depth+1:depth)}
   }
  }catch(e){if(alive())onError(path,e)}
 }
 for(const entry of entries){if(!alive())break;await walk(entry,entry.name,0)}
}
