// Geometry is expressed in the visible page: origin at top left, centre in %.
export function pageSelection(spec, count) {
  if (!spec.trim()) return Array.from({length:count},(_,i)=>i);
  const selected=new Set();
  for (const part of spec.split(',')) {
    const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw Error('pages');
    const first=Number(match[1]), last=Number(match[2]||match[1]);
    if (!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<1||last<first) throw Error('pages');
    for (let n=first;n<=Math.min(last,count);n++) selected.add(n-1);
  }
  return [...selected].sort((a,b)=>a-b);
}
export function placement(width,height,aspect,{x,y,size}) {
  if (![width,height,aspect,x,y,size].every(Number.isFinite)||width<=0||height<=0||aspect<=0||x<0||x>100||y<0||y>100||size<=0||size>100) throw Error('geometry');
  const w=Math.min(width*size/100,height*aspect),h=w/aspect;
  return {x:Math.max(0,Math.min(width-w,width*x/100-w/2)),y:Math.max(0,Math.min(height-h,height*y/100-h/2)),width:w,height:h};
}
export function visiblePage(page) {
  const crop=page.getCropBox(),media=page.getMediaBox();
  const x=Math.max(crop.x,media.x),y=Math.max(crop.y,media.y);
  const width=Math.min(crop.x+crop.width,media.x+media.width)-x;
  const height=Math.min(crop.y+crop.height,media.y+media.height)-y;
  const angle=((page.getRotation().angle%360)+360)%360;
  if (width<=0||height<=0||![0,90,180,270].includes(angle)) throw Error('geometry');
  const matrices={0:[1,0,0,1,x,y],90:[0,1,-1,0,x+width,y],180:[-1,0,0,-1,x+width,y+height],270:[0,-1,1,0,x,y+height]};
  return {width:angle%180?height:width,height:angle%180?width:height,matrix:matrices[angle]};
}
export async function watermarkPDF(bytes, png, aspect, settings, spec, lib) {
  const doc=await lib.PDFDocument.load(bytes,{updateMetadata:false});
  // Rewriting a signed PDF invalidates signatures. Keep the original untouched.
  for(const [,object] of doc.context.enumerateIndirectObjects()) {
    if(object instanceof lib.PDFDict && (object.get(lib.PDFName.of('Type'))?.toString()==='/Sig'||object.get(lib.PDFName.of('FT'))?.toString()==='/Sig')) throw Error('signed');
  }
  const pages=pageSelection(spec,doc.getPageCount());
  if (!pages.length) throw Error('noPages');
  const stamp=await doc.embedPng(png);
  for(const index of pages) {
    const page=doc.getPage(index),view=visiblePage(page),rect=placement(view.width,view.height,aspect,settings);
    page.pushOperators(lib.pushGraphicsState(),lib.concatTransformationMatrix(...view.matrix));
    page.drawImage(stamp,{x:rect.x,y:view.height-rect.y-rect.height,width:rect.width,height:rect.height,opacity:settings.opacity});
    page.pushOperators(lib.popGraphicsState());
  }
  return {bytes:await doc.save(),marked:pages.length};
}
export function outputName(name,extension,occupied) {
  let base=name.replace(/\.[^.]+$/,'').replace(/[\\/\x00-\x1f<>:"|?*]/g,'_').replace(/[. ]+$/,'')||'file';
  let result=base+'_watermark.'+extension,number=2;
  while(occupied.has(result.normalize('NFC').toLowerCase())) result=base+'_watermark_'+String(number++).padStart(2,'0')+'.'+extension;
  occupied.add(result.normalize('NFC').toLowerCase());return result;
}
// Local, uncompressed ZIP. Limits are checked before writing ZIP32 headers.
const encoder=new TextEncoder(),table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function put(v,o,n,size){size===2?v.setUint16(o,n,true):v.setUint32(o,n,true);}
export async function makeZip(items){
  if(items.length>65535)throw Error('zipLimit');
  let local=[],central=[],offset=0;
  for(const item of items){
    const bytes=new Uint8Array(await item.blob.arrayBuffer()),name=encoder.encode(item.name),crc=crc32(bytes);
    if(name.length>65535||bytes.length>0xffffffff||offset+30+name.length+bytes.length>0xffffffff)throw Error('zipLimit');
    const h=new DataView(new ArrayBuffer(30));put(h,0,0x04034b50,4);put(h,4,20,2);put(h,6,0x0800,2);put(h,12,33,2);put(h,14,crc,4);put(h,18,bytes.length,4);put(h,22,bytes.length,4);put(h,26,name.length,2);local.push(h.buffer,name,bytes);
    const c=new DataView(new ArrayBuffer(46));put(c,0,0x02014b50,4);put(c,4,20,2);put(c,6,20,2);put(c,8,0x0800,2);put(c,14,33,2);put(c,16,crc,4);put(c,20,bytes.length,4);put(c,24,bytes.length,4);put(c,28,name.length,2);put(c,42,offset,4);central.push(c.buffer,name);offset+=30+name.length+bytes.length;
  }
  const size=central.reduce((n,b)=>n+b.byteLength,0);if(offset+size>0xffffffff)throw Error('zipLimit');
  const end=new DataView(new ArrayBuffer(22));put(end,0,0x06054b50,4);put(end,8,items.length,2);put(end,10,items.length,2);put(end,12,size,4);put(end,16,offset,4);
  return new Blob([...local,...central,end.buffer],{type:'application/zip'});
}
