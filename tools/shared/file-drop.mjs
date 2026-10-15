// Snapshot entry handles during the drop event; directory readers return batches.
export async function readDrop(transfer, chooseFolders) {
 const handles=[...transfer.items||[]].filter(i=>i.kind==='file').map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
 const fallback=[...transfer.files||[]];
 if(!handles.length)return fallback.map(file=>({file,isDirectory:false,parentId:null,id:crypto.randomUUID()}));
 const folders=handles.some(h=>h.isDirectory);
 const mode=folders?await chooseFolders(): 'files';
 if(!mode)return [];
 const result=[];
 async function walk(handle,parentId=null,path=''){
  const id=crypto.randomUUID(),originalPath=path+handle.name;
  if(handle.isDirectory){
   if(mode==='folders')result.push({file:{name:handle.name},isDirectory:true,id,parentId,originalPath});
   const reader=handle.createReader();let children;
   do{children=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));for(const child of children)await walk(child,mode==='folders'?id:null,originalPath+'/');}while(children.length);
  }else{
   const file=await new Promise((resolve,reject)=>handle.file(resolve,reject));
   result.push({file,isDirectory:false,id,parentId:mode==='folders'?parentId:null,originalPath});
  }
 }
 for(const handle of handles)await walk(handle);
 return result;
}
