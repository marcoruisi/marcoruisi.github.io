/* File metadata only: compressed image payloads and PDF page content are not edited. */
(()=>{
 'use strict';
 const signature='MRC — https://marcoruisi.pages.dev',enc=new TextEncoder(),dec=new TextDecoder();
 const ascii=(b,a,z)=>String.fromCharCode(...b.subarray(a,z));
 const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
 const u32=(n,little=false)=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,little);return b;};
 const read32=(b,i,little=false)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(i,little);
 function xmp(bytes){
  const ns='http://ns.adobe.com/xap/1.0/',rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  const xml=bytes?.length?dec.decode(bytes):'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="'+rdf+'"><rdf:Description rdf:about=""/></rdf:RDF></x:xmpmeta>';
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid XMP metadata');
  let descriptions=[...doc.getElementsByTagNameNS(rdf,'Description')];
  if(!descriptions.length){const root=doc.getElementsByTagNameNS(rdf,'RDF')[0];if(!root)throw Error('Invalid XMP RDF');const d=doc.createElementNS(rdf,'rdf:Description');d.setAttributeNS(rdf,'rdf:about','');root.append(d);descriptions=[d];}
  for(const d of descriptions)d.removeAttributeNS(ns,'CreatorTool');
  for(const node of [...doc.getElementsByTagNameNS(ns,'CreatorTool')])node.remove();
  const field=doc.createElementNS(ns,'xmp:CreatorTool');field.textContent=signature;descriptions[0].append(field);
  return enc.encode(new XMLSerializer().serializeToString(doc));
 }
 function jpeg(b){
  const header=enc.encode('http://ns.adobe.com/xap/1.0/\0'),segments=[];let i=2,old=null;
  while(i<b.length){
   const start=i;if(b[i++]!==255)throw Error('Invalid JPEG marker');while(b[i]===255)i++;
   const marker=b[i++];if(marker===218||marker===217){i=start;break;}
   if(marker===1||(marker>=208&&marker<=215)){segments.push(b.subarray(start,i));continue;}
   const length=(b[i]<<8)|b[i+1],end=i+length;if(length<2||end>b.length)throw Error('Invalid JPEG length');
   const payload=b.subarray(i+2,end),isXMP=marker===225&&header.every((v,j)=>payload[j]===v);
   if(isXMP){if(old)throw Error('Multiple JPEG XMP packets');old=payload.subarray(header.length);}else segments.push(b.subarray(start,end));i=end;
  }
  const payload=join([header,xmp(old)]),length=payload.length+2;if(length>65535)throw Error('XMP packet too large');
  const segment=join([new Uint8Array([255,225,length>>8,length&255]),payload]);
  return join([b.subarray(0,2),...segments,segment,b.subarray(i)]);
 }
 function crc32(b){let crc=0xffffffff;for(const v of b){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
 function pngChunk(type,data){const body=join([enc.encode(type),data]);return join([u32(data.length),body,u32(crc32(body))]);}
 function png(b){
  const parts=[b.subarray(0,8)];let i=8,ended=false;
  while(i+12<=b.length){const n=read32(b,i),end=i+12+n;if(end>b.length)throw Error('Invalid PNG chunk');const type=ascii(b,i+4,i+8),data=b.subarray(i+8,i+8+n);
   if(type==='IEND'){parts.push(pngChunk('iTXt',join([enc.encode('Software'),new Uint8Array(5),enc.encode(signature)])));ended=true;}
   const software=['iTXt','tEXt','zTXt'].includes(type)&&ascii(data,0,9)==='Software\0';
   if(!software)parts.push(b.subarray(i,end));i=end;
  }
  if(!ended||i!==b.length)throw Error('Invalid PNG end');return join(parts);
 }
 function webpChunk(type,data){return join([enc.encode(type),u32(data.length,true),data,new Uint8Array(data.length%2)]);}
 function webp(b){
  if(read32(b,4,true)+8!==b.length)throw Error('Invalid WebP size');
  const chunks=[];let i=12,old=null,extended=null,width=0,height=0,alpha=false;
  while(i+8<=b.length){const n=read32(b,i+4,true),end=i+8+n+(n%2);if(end>b.length)throw Error('Invalid WebP chunk');const type=ascii(b,i,i+4),data=b.subarray(i+8,i+8+n);
   if(type==='XMP '){if(old)throw Error('Multiple WebP XMP packets');old=data;}
   else if(type==='VP8X'){if(extended||n!==10)throw Error('Invalid VP8X');extended=data.slice();}
   else{chunks.push(b.subarray(i,end));
    if(type==='VP8 '){if(n<10||ascii(data,3,6)!=='\x9d\x01\x2a')throw Error('Invalid VP8');width=(data[6]|data[7]<<8)&16383;height=(data[8]|data[9]<<8)&16383;}
    if(type==='VP8L'){if(n<5||data[0]!==47)throw Error('Invalid VP8L');const bits=read32(data,1,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;alpha=!!(bits&0x10000000);}
    if(type==='ALPH')alpha=true;
   }i=end;
  }
  if(i!==b.length)throw Error('Invalid WebP end');
  if(!extended){if(!width||!height)throw Error('Missing WebP dimensions');extended=new Uint8Array(10);extended[0]=alpha?16:0;for(let j=0;j<3;j++){extended[4+j]=((width-1)>>>(8*j))&255;extended[7+j]=((height-1)>>>(8*j))&255;}}
  extended[0]|=4;
  const body=join([enc.encode('WEBP'),webpChunk('VP8X',extended),...chunks,webpChunk('XMP ',xmp(old))]);return join([enc.encode('RIFF'),u32(body.length,true),body]);
 }
 async function image(blob){
  const b=new Uint8Array(await blob.arrayBuffer());let out,type;
  if(b[0]===255&&b[1]===216){out=jpeg(b);type='image/jpeg';}
  else if(ascii(b,0,8)==='\x89PNG\r\n\x1a\n'){out=png(b);type='image/png';}
  else if(ascii(b,0,4)==='RIFF'&&ascii(b,8,12)==='WEBP'){out=webp(b);type='image/webp';}
  else return blob;
  return new Blob([out],{type});
 }
 function pdf(doc){doc.setProducer(signature);}
 window.MRCOutputMetadata={signature,image,pdf};
})();
