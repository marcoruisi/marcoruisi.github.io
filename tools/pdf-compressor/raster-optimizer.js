/* Explicit alternative only. Never invoked by the image-preserving engine. */
(()=>{
 async function compress(input,{dpi,quality,gray,onProgress}){
  const pjs=await import('/tools/print-pdf-to-web/vendor/pdf.min.mjs');pjs.GlobalWorkerOptions.workerSrc='/tools/print-pdf-to-web/vendor/pdf.worker.min.mjs';
  const task=pjs.getDocument({data:new Uint8Array(input),stopAtErrors:true,isEvalSupported:false}),out=await PDFLib.PDFDocument.create();
  try{
   const pdf=await task.promise;
   for(let i=1;i<=pdf.numPages;i++){
    onProgress(i,pdf.numPages);const p=await pdf.getPage(i),v=p.getViewport({scale:dpi/72}),base=p.getViewport({scale:1});
    if(v.width*v.height>40000000)throw Error('complex');
    const c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);
    try{
     const ctx=c.getContext('2d',{alpha:false});await p.render({canvasContext:ctx,viewport:v,background:'#fff'}).promise;
     if(gray){const img=ctx.getImageData(0,0,c.width,c.height);for(let j=0;j<img.data.length;j+=4){const d=img.data,y=Math.round(.2126*d[j]+.7152*d[j+1]+.0722*d[j+2]);d[j]=d[j+1]=d[j+2]=y;}ctx.putImageData(img,0,0);}
     const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',quality));if(!blob)throw Error('encoder');
     const jpg=await out.embedJpg(await blob.arrayBuffer()),page=out.addPage([base.width,base.height]);page.drawImage(jpg,{x:0,y:0,width:base.width,height:base.height});
    }finally{c.width=c.height=1;}
   }
   out.setCreator('MRC - PDF Compressor 2.0');out.setProducer('MRC | marcoruisi.pages.dev');
   const bytes=await out.save();return {bytes,report:{originalBytes:input.byteLength,finalBytes:bytes.length,imagesFound:pdf.numPages,imagesChanged:pdf.numPages,treatable:pdf.numPages,dpi,quality,gray,warnings:['Pages rasterised by explicit choice; selectable text, vectors, links and annotations are not preserved.'],metadata:{attribution:'MRC | marcoruisi.pages.dev'}}};
  }finally{await task.destroy();}
 }
 window.MRCPDFRaster={compress};
})();
