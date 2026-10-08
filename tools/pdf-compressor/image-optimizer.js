/* MRC PDF Compressor 2.0: image-only decoding; original page streams are never rasterized. */
(()=>{
 'use strict';
 const {PDFDocument,PDFName,PDFRawStream,PDFRef,PDFDict,PDFArray,PDFObjectCopier}=PDFLib;
 const N=PDFName.of,get=(d,k)=>d.get(N(k)),name=o=>o?.toString(),num=o=>o?.asNumber?.();
 const MAX_PIXELS=40000000;
  async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
  async function snapshot(context){
    const result={};
    for(const [ref,obj] of context.enumerateIndirectObjects()){
      const isStream=obj instanceof PDFLib.PDFStream;
      const content=isStream?obj.getContents():new Uint8Array();
      const dictionary=isStream?obj.dict.clone(context):null;if(dictionary)dictionary.delete(N('Length'));
      const representation=new TextEncoder().encode(isStream?dictionary.toString():obj.toString());
      const bytes=new Uint8Array(representation.length+content.length);bytes.set(representation);bytes.set(content,representation.length);
      result[ref.toString()]=await hash(bytes);
    }
    return result;
  }
  function guard(doc){
    const c=doc.catalog;
    if(doc.isEncrypted||doc.context.trailerInfo.Encrypt)throw Error('encrypted');
    if(c.has(N('AcroForm'))||c.has(N('Perms')))throw Error('forms');
    const objects=doc.context.enumerateIndirectObjects();
    if(objects.length>100000||doc.getPageCount()>500||!doc.getPageCount())throw Error('complex');
    for(const [,o]of objects){const d=o instanceof PDFRawStream?o.dict:o;
      if(d instanceof PDFDict&&(name(get(d,'FT'))==='/Sig'||name(get(d,'Type'))==='/Sig'||get(d,'ByteRange')||get(d,'XFA')))throw Error('forms');
    }
    for(const p of doc.getPages()){
      for(const b of [p.getMediaBox(),p.getCropBox()])if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0||b.width>14400||b.height>14400)throw Error('complex');
      if(!Number.isFinite(p.getRotation().angle)||p.getRotation().angle%90!==0)throw Error('complex');

    }
  }
 let engine;
 async function decoder(){
  if(!engine)engine=import('/tools/print-pdf-to-web/vendor/pdf.min.mjs').then(p=>{p.GlobalWorkerOptions.workerSrc='/tools/print-pdf-to-web/vendor/pdf.worker.min.mjs';return p;});
  return engine;
 }
 function reachable(ctx){
  const refs=new Set(),seen=new Set();
  function walk(o){
   if(o instanceof PDFRef){const id=o.toString();if(refs.has(id))return;refs.add(id);walk(ctx.lookup(o));return;}
   if(!o||seen.has(o))return;seen.add(o);
   if(o instanceof PDFLib.PDFStream)walk(o.dict);
   else if(o instanceof PDFDict)for(const [,v]of o.entries())walk(v);
   else if(o instanceof PDFArray)for(const v of o.asArray())walk(v);
  }
  walk(ctx.trailerInfo.Root);walk(ctx.trailerInfo.Info);return refs;
 }
 function cleanup(doc){
  const ctx=doc.context,allowed=new Set(),fields=[];
  // Drop removable Info and XMP, including object-level metadata. Do not claim anonymisation.
  const old=ctx.lookup(ctx.trailerInfo.Info);
  if(old instanceof PDFDict)for(const [k]of old.entries())fields.push(k.decodeText());
  if(ctx.trailerInfo.Info)allowed.add(ctx.trailerInfo.Info.toString());
  let xmp=0;
  for(const [ref,obj]of ctx.enumerateIndirectObjects()){
   const d=obj instanceof PDFRawStream?obj.dict:obj;
   if(d instanceof PDFDict&&d.has(N('Metadata'))){d.delete(N('Metadata'));allowed.add(ref.toString());xmp++;}
  }
  delete ctx.trailerInfo.ID;
  ctx.trailerInfo.Info=ctx.register(ctx.obj({Creator:PDFLib.PDFString.of('MRC - PDF Compressor 2.0'),Producer:PDFLib.PDFString.of('MRC | marcoruisi.pages.dev')}));
  return {allowed,fields,documentXMPRemoved:xmp>0,objectMetadataRemoved:xmp,attribution:'MRC | marcoruisi.pages.dev',otherMetadataPreserved:true};
 }
 function inspect(doc,ref,stream,masks,placement){
  const d=stream.dict,lookup=k=>doc.context.lookup(get(d,k));
  if(masks.has(ref.toString())||lookup('ImageMask')?.toString()==='true')throw Error('Mask/stencil not recompressed independently');
  const width=num(lookup('Width')),height=num(lookup('Height'));
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS)throw Error('Image exceeds 40 megapixels or has invalid dimensions');
  if(get(d,'Alternates')||get(d,'OPI'))throw Error('Alternate/OPI image retained');
  if(placement?.contexts.size>1)throw Error('Image uses different colour resource contexts');
  return {width,height,color:lookup('ColorSpace')?.toString()||'embedded',filter:lookup('Filter')?.toString()||'raw'};
 }
 // Render a temporary page containing ONLY one XObject. Original pages are not rendered/replaced.
 // PDF.js handles DCT/Flate predictors, Decode, Indexed, CMYK, masks and supported colour spaces.
 async function decodeImage(doc,stream,spec,placement){
  const pjs=await decoder(),mini=await PDFDocument.create(),copier=PDFObjectCopier.for(doc.context,mini.context);
  const ref=mini.context.register(copier.copy(stream));
  const resources=mini.context.obj({XObject:{MRCImage:ref}});
  const colors=placement?.resources?.get(N('ColorSpace'));
  if(colors)resources.set(N('ColorSpace'),copier.copy(colors));
  const page=mini.addPage([spec.width,spec.height]);page.node.set(N('Resources'),resources);
  page.node.set(N('Contents'),mini.context.register(mini.context.flateStream(`q ${spec.width} 0 0 ${spec.height} 0 0 cm /MRCImage Do Q`)));
  const data=await mini.save({useObjectStreams:false}),task=pjs.getDocument({data,stopAtErrors:true,isEvalSupported:false,useSystemFonts:false,isOffscreenCanvasSupported:false,maxImageSize:MAX_PIXELS});
  let canvas;
  try{
   const pdf=await task.promise,p=await pdf.getPage(1),ops=await p.getOperatorList();
   const paints=[pjs.OPS.paintImageXObject,pjs.OPS.paintInlineImageXObject,pjs.OPS.paintImageXObjectRepeat,pjs.OPS.paintImageMaskXObject];
   if(!ops.fnArray.some(x=>paints.includes(x)))throw Error('Image decoder returned no image');
   canvas=document.createElement('canvas');canvas.width=spec.width;canvas.height=spec.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
   await p.render({canvasContext:ctx,viewport:p.getViewport({scale:1}),background:'rgba(0,0,0,0)'}).promise;
   return canvas;
  }catch(e){if(canvas)canvas.width=canvas.height=1;throw e;}
  finally{await task.destroy();}
 }
 async function encode(canvas,width,height,quality,gray){
  const scaled=document.createElement('canvas');scaled.width=width;scaled.height=height;
  try{
   const ctx=scaled.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(canvas,0,0,width,height);
   const img=ctx.getImageData(0,0,width,height),d=img.data,alpha=new Uint8Array(width*height);let transparent=false;
   for(let i=0,j=0;i<d.length;i+=4,j++){
    alpha[j]=d[i+3];transparent ||= d[i+3]!==255;
    if(gray){const y=Math.round(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2]);d[i]=d[i+1]=d[i+2]=y;}
    d[i+3]=255;
   }
   ctx.putImageData(img,0,0);
   const blob=await new Promise(r=>scaled.toBlob(r,'image/jpeg',quality));if(!blob)throw Error('JPEG encoder unavailable');
   return {bytes:new Uint8Array(await blob.arrayBuffer()),alpha:transparent?alpha:null,width,height};
  }finally{scaled.width=scaled.height=1;}
 }
 async function compress(input,{quality=.68,dpi=144,minDpi=72,minQuality=.4,gray=false,onProgress=()=>{}}={}){
  if(!Number.isFinite(minDpi)||minDpi<72||minDpi>300||!Number.isFinite(minQuality)||minQuality<.4||minQuality>.95||!Number.isFinite(dpi)||!Number.isFinite(quality))throw Error('parameters');
  dpi=Math.max(minDpi,Math.min(300,dpi));quality=Math.max(minQuality,Math.min(.95,quality));
  const source=new Uint8Array(input);if(source.length>64*1024*1024)throw Error('size');
  const doc=await PDFDocument.load(source,{updateMetadata:false,throwOnInvalidObject:true});guard(doc);
  const ctx=doc.context,before=await snapshot(ctx),metadata=cleanup(doc),objects=ctx.enumerateIndirectObjects(),placement=MRCImagePlacement.analyze(doc),masks=new Set(),changed=new Set();
  for(const [,o]of objects)if(o instanceof PDFRawStream)for(const k of ['Mask','SMask']){const r=get(o.dict,k);if(r instanceof PDFRef)masks.add(r.toString());}
  const report={originalBytes:source.length,imagesFound:0,treatable:0,imagesChanged:0,images:[],dpi,quality,gray,metadata,warnings:[...placement.warnings],invariants:{}};
  const images=objects.filter(([,o])=>o instanceof PDFRawStream&&name(get(o.dict,'Subtype'))==='/Image');
  for(const [ref,stream]of images){
   report.imagesFound++;onProgress(report.imagesFound,images.length);
   const id=ref.toString(),use=placement.uses.get(id),entry={ref:id,status:'untouched',originalBytes:stream.getContents().length};report.images.push(entry);
   let canvas;
   try{
    const spec=inspect(doc,ref,stream,masks,use);Object.assign(entry,spec);
    // Full extent of every occurrence, including nested Forms; never enlarge low-resolution originals.
    let scale=1;
    if(placement.reliable&&use&&use.width>0&&use.height>0)scale=Math.min(1,Math.max(use.width*dpi/(72*spec.width),use.height*dpi/(72*spec.height)));
    else entry.resolutionNote='Placement unknown: source dimensions retained';
    const width=Math.max(1,Math.ceil(spec.width*scale)),height=Math.max(1,Math.ceil(spec.height*scale));
    if(use&&placement.reliable){entry.sourceDpi=Math.min(72*spec.width/use.width,72*spec.height/use.height);entry.outputDpi=Math.min(72*width/use.width,72*height/use.height);if(entry.sourceDpi<minDpi)entry.resolutionNote='Original below DPI floor: no upscaling';}
    canvas=await decodeImage(doc,stream,spec,use);report.treatable++;
    const out=await encode(canvas,width,height,quality,gray);
    let mask;if(out.alpha)mask=ctx.flateStream(out.alpha,{Type:'XObject',Subtype:'Image',Width:width,Height:height,ColorSpace:'DeviceGray',BitsPerComponent:8});
    entry.candidateBytes=out.bytes.length+(mask?.getContents().length||0);
    // Preserve a smaller source unless the user explicitly asks for a colour conversion.
    if(entry.candidateBytes>=entry.originalBytes&&!gray){entry.reason='Encoded candidate is not smaller';continue;}
    const d=stream.dict.clone(ctx);
    for(const k of ['Filter','DecodeParms','Decode','ColorSpace','BitsPerComponent','SMask','Mask','SMaskInData','Matte','Metadata'])d.delete(N(k));
    d.set(N('Filter'),N('DCTDecode'));d.set(N('ColorSpace'),N('DeviceRGB'));d.set(N('BitsPerComponent'),ctx.obj(8));d.set(N('Width'),ctx.obj(width));d.set(N('Height'),ctx.obj(height));d.set(N('Length'),ctx.obj(out.bytes.length));
    if(mask)d.set(N('SMask'),ctx.register(mask));
    ctx.assign(ref,PDFRawStream.of(d,out.bytes));changed.add(id);
    Object.assign(entry,{status:'recompressed',finalBytes:entry.candidateBytes,finalDimensions:[width,height],occurrences:use?.count||0});
   }catch(e){entry.reason=e.message;}finally{if(canvas)canvas.width=canvas.height=1;}
   await new Promise(r=>setTimeout(r,0));
  }
  // Remove unreachable objects (old metadata, obsolete masks, unused image objects).
  const live=reachable(ctx),removed=new Set();
  for(const [ref]of ctx.enumerateIndirectObjects())if(!live.has(ref.toString())){removed.add(ref.toString());ctx.delete(ref);}
  const expected=await snapshot(ctx),candidate=await doc.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
  const check=await PDFDocument.load(candidate,{updateMetadata:false,throwOnInvalidObject:true});guard(check);
  const after=await snapshot(check.context);
  const altered=Object.keys(expected).filter(id=>expected[id]!==after[id]);
  const nonTargets=Object.keys(before).filter(id=>!changed.has(id)&&!metadata.allowed.has(id)&&!removed.has(id)&&before[id]!==after[id]);
  if(altered.length||nonTargets.length||check.getPageCount()!==doc.getPageCount()){console.error('integrity',JSON.stringify({altered,nonTargets}));throw Error('integrity');}
  report.invariants={nonImageObjectsUnchanged:true,sharedImageRefsPreserved:[...changed].filter(id=>!removed.has(id)).every(id=>id in after),alteredNonTargetRefs:nonTargets};
  report.imagesChanged=changed.size;report.finalBytes=candidate.length;report.bytesSaved=source.length-candidate.length;report.structural={objectStreams:true,unreachableObjectsRemoved:removed.size};
  report.warnings.push('ICC profiles use the PDF.js 4 colour-space alternate; colourimetric/proof fidelity and PDF/A conformance are not guaranteed.','Inline images, stencils and images beyond the memory limit remain unchanged. No page rasterisation fallback.');
  return {bytes:candidate,report};
 }
 window.MRCPDFOptimizer={compress,guard,snapshot,inspect};
})();
