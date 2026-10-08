/* Conservative beta: validated image whitelist from the MRC pdf-lib 1.17.1 POC. */
(() => {
  'use strict';
  const {PDFDocument, PDFName, PDFRawStream, PDFRef, PDFDict, decodePDFRawStream}=PDFLib;
  const N=PDFName.of, get=(d,k)=>d.get(N(k)), name=o=>o?.toString(), num=o=>o?.asNumber?.();
  const MAX_PIXELS=16000000;
  async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
  async function snapshot(context){
    const result={};
    for(const [ref,obj] of context.enumerateIndirectObjects()){
      const representation=new TextEncoder().encode(obj instanceof PDFRawStream?obj.dict.toString():obj.toString());
      const content=obj instanceof PDFRawStream ? obj.getContents() : new Uint8Array();
      const bytes=new Uint8Array(representation.length+content.length);bytes.set(representation);bytes.set(content,representation.length);
      result[ref.toString()]=await hash(bytes);
    }
    return result;
  }
  function jpegComponents(bytes){
    if(bytes[0]!==255||bytes[1]!==216)throw Error('JPEG non riconoscibile');
    let i=2, components;
    while(i<bytes.length){
      if(bytes[i++]!==255)throw Error('Struttura JPEG non supportata');
      while(bytes[i]===255)i++;
      const marker=bytes[i++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      const len=(bytes[i]<<8)|bytes[i+1];
      if(len<2||i+len>bytes.length)throw Error('Segmento JPEG non valido');
      if([225,226,238].includes(marker))throw Error('JPEG con EXIF/ICC/Adobe: lasciato intatto per prudenza');
      if([192,194].includes(marker)){
        if(bytes[i+2]!==8)throw Error('JPEG non a 8 bit');
        components=bytes[i+7];
      }else if(marker>=192&&marker<=207&&![196,200,204].includes(marker))throw Error('Codifica JPEG non supportata');
      i+=len;
    }
    if(![1,3].includes(components))throw Error('Componenti JPEG non supportati');
    return components;
  }
  function inspect(ref,stream,maskRefs){
    const d=stream.dict, id=ref.toString();
    if(maskRefs.has(id))throw Error('Oggetto usato come mask/soft mask');
    const allowed=new Set(['Type','Subtype','Width','Height','BitsPerComponent','ColorSpace','Filter','Length']);
    for(const [key] of d.entries())if(!allowed.has(key.decodeText()))throw Error('Attributo non gestito: '+key.decodeText());
    const width=num(get(d,'Width')),height=num(get(d,'Height')),bpc=num(get(d,'BitsPerComponent'));
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS)throw Error('Dimensioni non valide o oltre il limite prudenziale di 16 megapixel');
    const color=name(get(d,'ColorSpace'));
    if(bpc!==8||!['/DeviceRGB','/DeviceGray'].includes(color))throw Error('Spazio colore o profondità non supportati');
    const filter=name(get(d,'Filter'));
    if(!['/DCTDecode','/FlateDecode'].includes(filter))throw Error('Filtro non supportato: '+(filter||'assente'));
    if(filter==='/DCTDecode'){
      const components=jpegComponents(stream.getContents());
      if((color==='/DeviceRGB'?3:1)!==components)throw Error('Spazio colore e componenti JPEG non coerenti');
    }
    return {width,height,color,filter};
  }
  // Canvas produces known sRGB pixels; discard its redundant embedded ICC APP2
  // metadata. This is NEVER applied to an arbitrary source image.
  function stripCanvasICC(bytes){
    const chunks=[bytes.subarray(0,2)];let i=2;
    while(i<bytes.length){const start=i;if(bytes[i++]!==255)throw Error('JPEG encoder non valido');while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===218||marker===217){chunks.push(bytes.subarray(start));break;}if(marker===1||(marker>=208&&marker<=215)){chunks.push(bytes.subarray(start,i));continue;}const len=(bytes[i]<<8)|bytes[i+1];if(len<2||i+len>bytes.length)throw Error('JPEG encoder troncato');i+=len;if(marker!==226)chunks.push(bytes.subarray(start,i));}
    const result=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
  }
  async function recompress(stream,spec,quality,maxEdge){
    const canvas=document.createElement('canvas');canvas.width=spec.width;canvas.height=spec.height;
    let output;try{
    const ctx=canvas.getContext('2d',{alpha:false});
    if(spec.filter==='/DCTDecode'){
      const bitmap=await createImageBitmap(new Blob([stream.getContents()],{type:'image/jpeg'}),{imageOrientation:'none',colorSpaceConversion:'none'});
      try{if(bitmap.width!==spec.width||bitmap.height!==spec.height)throw Error('Dimensioni JPEG e dizionario diverse');ctx.drawImage(bitmap,0,0);}finally{bitmap.close();}
    }else{
      const pixels=decodePDFRawStream(stream).decode(),channels=spec.color==='/DeviceRGB'?3:1;
      if(pixels.length!==spec.width*spec.height*channels)throw Error('Stream Flate non corrispondente ai pixel attesi');
      const rgba=ctx.createImageData(spec.width,spec.height);
      for(let p=0,q=0;p<pixels.length;p+=channels,q+=4){rgba.data[q]=pixels[p];rgba.data[q+1]=pixels[p+(channels===3?1:0)];rgba.data[q+2]=pixels[p+(channels===3?2:0)];rgba.data[q+3]=255;}
      ctx.putImageData(rgba,0,0);
    }
    const scale=Math.min(1,maxEdge/Math.max(canvas.width,canvas.height));
    output=document.createElement('canvas');output.width=Math.max(1,Math.round(canvas.width*scale));output.height=Math.max(1,Math.round(canvas.height*scale));
    output.getContext('2d',{alpha:false}).drawImage(canvas,0,0,output.width,output.height);
    const blob=await new Promise(resolve=>output.toBlob(resolve,'image/jpeg',quality));
    if(!blob)throw Error('Encoder JPEG non disponibile');
    const bytes=stripCanvasICC(new Uint8Array(await blob.arrayBuffer()));jpegComponents(bytes);
    const width=output.width,height=output.height;canvas.width=canvas.height=output.width=output.height=1;
    return {bytes,width,height};
    }finally{canvas.width=canvas.height=1;if(output)output.width=output.height=1;}
  }

  function guard(doc){
    const c=doc.catalog;
    if(doc.isEncrypted||doc.context.trailerInfo.Encrypt)throw Error('encrypted');
    if(c.has(N('AcroForm'))||c.has(N('Perms')))throw Error('forms');
    if(c.has(N('StructTreeRoot')))throw Error('tagged');
    const objects=doc.context.enumerateIndirectObjects();
    if(objects.length>100000||doc.getPageCount()>500||!doc.getPageCount())throw Error('complex');
    for(const [,o]of objects){const d=o instanceof PDFRawStream?o.dict:o;
      if(d instanceof PDFDict&&(name(get(d,'FT'))==='/Sig'||name(get(d,'Type'))==='/Sig'||get(d,'ByteRange')||get(d,'XFA')))throw Error('forms');
    }
    for(const p of doc.getPages()){
      for(const b of [p.getMediaBox(),p.getCropBox()])if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0||b.width>14400||b.height>14400)throw Error('complex');
      if(!Number.isFinite(p.getRotation().angle)||p.getRotation().angle%90!==0)throw Error('complex');
      const list=p.node.Annots();if(list)for(const a of list.asArray()){
        const d=doc.context.lookup(a);if(!(d instanceof PDFDict)||name(get(d,'Subtype'))!=='/Link'||d.has(N('AP'))||d.has(N('AA')))throw Error('annotations');
      }
    }
  }
  function referenceCount(context,ref){
    let count=0;const seen=new Set();
    function walk(o){if(o instanceof PDFRef){if(o.toString()===ref.toString())count++;return;}
      if(!o||seen.has(o))return;seen.add(o);
      if(o instanceof PDFRawStream)walk(o.dict);
      else if(o instanceof PDFDict)for(const [,v]of o.entries())walk(v);
      else if(o instanceof PDFLib.PDFArray)for(const v of o.asArray())walk(v);
    }
    for(const [,o]of context.enumerateIndirectObjects())walk(o);return count;
  }
  function cleanup(doc){
    const ctx=doc.context,allowed=new Set(),fields=[];let changed=false,xmp=false;
    const infoRef=ctx.trailerInfo.Info;
    // Only the conventional document Info dictionary; never shared arbitrary dictionaries.
    if(infoRef instanceof PDFRef&&referenceCount(ctx,infoRef)===0){const info=ctx.lookup(infoRef);
      if(info instanceof PDFDict){for(const key of ['Title','Author','Subject','Keywords','CreationDate','ModDate','Creator','Producer'])if(info.has(N(key))){info.delete(N(key));fields.push(key);changed=true;}
        if(fields.length){allowed.add(infoRef.toString());if(!info.entries().length){delete ctx.trailerInfo.Info;ctx.delete(infoRef);}}
      }
    }
    const metaRef=doc.catalog.get(N('Metadata'));
    if(metaRef instanceof PDFRef&&referenceCount(ctx,metaRef)===1){const meta=ctx.lookup(metaRef);
      if(meta instanceof PDFRawStream&&name(get(meta.dict,'Type'))==='/Metadata'&&name(get(meta.dict,'Subtype'))==='/XML'){
        doc.catalog.delete(N('Metadata'));ctx.delete(metaRef);allowed.add(metaRef.toString());allowed.add(ctx.trailerInfo.Root.toString());changed=true;xmp=true;
      }
    }
    return {allowed,fields,changed,xmp};
  }

  async function compress(input,{quality=.65,maxEdge=1400}={}){
    if(!(quality>=.1&&quality<=.95)||!(maxEdge>=100&&maxEdge<=4000))throw Error('Parametri fuori intervallo');
    const source=new Uint8Array(input);if(source.length>64*1024*1024)throw Error('size');const doc=await PDFDocument.load(source,{updateMetadata:false,throwOnInvalidObject:true});
    guard(doc);
    const before=await snapshot(doc.context),cleaned=cleanup(doc),objects=doc.context.enumerateIndirectObjects();
    const maskRefs=new Set();
    for(const [,o]of objects)if(o instanceof PDFRawStream)for(const k of ['Mask','SMask']){const r=get(o.dict,k);if(r instanceof PDFRef)maskRefs.add(r.toString());}
    const report={scope:'Oggetti immagine raster indiretti; non conta immagini inline né occorrenze visive',originalBytes:source.length,finalBytes:source.length,imagesFound:0,treatable:0,imagesChanged:0,images:[],invariants:{},warnings:['Beta: unsupported image encodings are preserved. PDF/A conformance and anonymisation are not guaranteed.','La ricompressione JPEG è lossy. Nessuna stima del minimo tecnico viene promessa.']};
    const changed=new Set();let pixelBudget=0;
    for(const [ref,obj]of objects){
      if(!(obj instanceof PDFRawStream)||name(get(obj.dict,'Subtype'))!=='/Image')continue;
      report.imagesFound++;
      const entry={ref:ref.toString(),originalBytes:obj.getContents().length,status:'untouched'};report.images.push(entry);
      let spec;
      try{spec=inspect(ref,obj,maskRefs);}catch(e){entry.reason=e.message;continue;}
      if(pixelBudget+spec.width*spec.height>48000000){entry.reason='Pixel budget exceeded';continue;}pixelBudget+=spec.width*spec.height;
      if(spec.color!=='/DeviceRGB'){entry.reason='Grayscale image left unchanged: no validated grayscale JPEG encoder';continue;}
      report.treatable++;Object.assign(entry,spec);
      try{
        const replacement=await recompress(obj,spec,quality,maxEdge);entry.candidateBytes=replacement.bytes.length;
        if(replacement.bytes.length>=entry.originalBytes){entry.reason='Ricompressione non più piccola: originale conservato';continue;}
        const d=obj.dict.clone(doc.context);d.set(N('Filter'),N('DCTDecode'));d.set(N('ColorSpace'),N('DeviceRGB'));d.set(N('Width'),doc.context.obj(replacement.width));d.set(N('Height'),doc.context.obj(replacement.height));d.set(N('Length'),doc.context.obj(replacement.bytes.length));
        
        doc.context.assign(ref,PDFRawStream.of(d,replacement.bytes));changed.add(entry.ref);
        entry.status='recompressed';entry.finalBytes=replacement.bytes.length;entry.finalDimensions=[replacement.width,replacement.height];
      }catch(e){entry.reason='Decodifica/ricompressione non sicura: '+e.message;}
    }
    let output=source;
    if(changed.size||cleaned.changed){
      const expected=await snapshot(doc.context);
      const candidate=await doc.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false});
      const check=await PDFDocument.load(candidate,{updateMetadata:false,throwOnInvalidObject:true}),after=await snapshot(check.context);guard(check);
      if(check.getPageCount()!==doc.getPageCount())throw Error('integrity');
      const writtenChanged=Object.keys(expected).filter(ref=>expected[ref]!==after[ref]),writtenAdded=Object.keys(after).filter(ref=>!(ref in expected));
      if(writtenChanged.length||writtenAdded.length)throw Error('integrity');
      const altered=Object.keys(before).filter(ref=>!changed.has(ref)&&!cleaned.allowed.has(ref)&&before[ref]!==after[ref]);
      const added=Object.keys(after).filter(ref=>!(ref in before));
      report.invariants={nonImageObjectsUnchanged:altered.length===0&&added.length===0,alteredNonTargetRefs:altered,newRefs:added,sharedImageRefsPreserved:[...changed].every(ref=>ref in after)};
      if(altered.length||added.length)throw Error('Verifica conservativa fallita: oggetti non target modificati. Nessun output rilasciato. '+JSON.stringify(report.invariants));
      if(candidate.length<source.length)output=candidate;
      else {for(const entry of report.images)if(changed.has(entry.ref)){entry.status='untouched';entry.reason='Il PDF serializzato non è più piccolo: restituito il file originale';}changed.clear();cleaned.changed=false;cleaned.fields=[];cleaned.xmp=false;report.warnings.push('Nessun risparmio complessivo: conservati esattamente i byte originali.');}
    }else report.invariants={nonImageObjectsUnchanged:true,alteredNonTargetRefs:[],newRefs:[],sharedImageRefsPreserved:true};
    report.metadata={fields:cleaned.changed?cleaned.fields:[],documentXMPRemoved:cleaned.changed&&cleaned.xmp,otherMetadataPreserved:true};
    report.finalBytes=output.length;report.imagesChanged=changed.size;report.bytesSaved=source.length-output.length;
    report.structuralEvidence='Oggetti testo, font, contenuti di pagina, annotazioni/link e vettori non riscritti; controllo SHA-256 degli oggetti non target dopo salvataggio. Non equivale a una validazione universale su qualsiasi PDF.';
    return {bytes:output,report};
  }
  window.MRCPDFOptimizer={compress,guard,snapshot,inspect};
})();
