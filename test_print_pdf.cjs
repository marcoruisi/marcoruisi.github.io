/* Optional local regression suite: node test_print_pdf.cjs. No network, Git or public fixture files. */
const fs=require('fs'),assert=require('assert'),crypto=require('crypto');
const P=require('./tools/images-to-pdf/pdf-lib-1.17.1.min.js');global.PDFLib=P;require('./tools/print-pdf-to-web/crop-core.js');
const C=global.PrintPdfCore,mm=C.mm,out=fs.mkdtempSync(require('path').join(require('os').tmpdir(),'mrc-print-crop-test-'));
const names=['trim','no-trim','symmetric','asymmetric','multipage','mixed','crop-media','rotation90','rotation180','rotation270','nonzero','destinations'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 for(const kind of names){
  const d=await P.PDFDocument.create();const font=await d.embedFont(P.StandardFonts.Helvetica);
  const png=await d.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  d.setTitle('Print PDF crop test: '+kind);d.setCreator('MRC synthetic test');
  const count=['multipage','mixed','destinations'].includes(kind)?3:1;
  for(let i=0;i<count;i++){
   const p=d.addPage([216*mm+(kind==='mixed'?i*10*mm:0),303*mm]);
   p.drawText('SELECTABLE TEXT '+i,{font,x:30*mm,y:230*mm,size:14});
   p.drawText('MRC LINK',{font,x:30*mm,y:200*mm,size:12});
   p.drawRectangle({x:20*mm,y:20*mm,width:170*mm,height:245*mm,borderColor:P.rgb(.3,.1,.7),borderWidth:1});
   p.drawImage(png,{x:40*mm,y:40*mm,width:40*mm,height:30*mm});
   p.drawRectangle({x:0,y:0,width:2*mm,height:303*mm,color:P.rgb(1,0,0)});
   p.setBleedBox(0,0,p.getWidth(),p.getHeight());
   if(kind!=='no-trim')p.setTrimBox(3*mm,3*mm,p.getWidth()-6*mm,p.getHeight()-6*mm);
   if(kind==='crop-media')p.setCropBox(2*mm,2*mm,p.getWidth()-4*mm,p.getHeight()-4*mm);
   if(kind.startsWith('rotation'))p.setRotation(P.degrees(Number(kind.slice(8))));
   const annot=d.context.register(d.context.obj({Type:'Annot',Subtype:'Link',Rect:[30*mm,198*mm,80*mm,205*mm],Border:[0,0,0],A:{S:'URI',URI:P.PDFString.of('https://marcoruisi.pages.dev/tools/')}}));p.node.set(P.PDFName.of('Annots'),d.context.obj([annot]));
   if(kind==='nonzero'){
    p.translateContent(-10*mm,15*mm);p.setMediaBox(-10*mm,15*mm,216*mm,303*mm);p.setCropBox(-10*mm,15*mm,216*mm,303*mm);p.setTrimBox(-7*mm,18*mm,210*mm,297*mm);p.setBleedBox(-10*mm,15*mm,216*mm,303*mm);
    const a=d.context.lookup(annot);a.set(P.PDFName.of('Rect'),d.context.obj([20*mm,213*mm,70*mm,220*mm]));
   }
  }
  if(kind==='destinations'){
   const target=d.getPage(2).ref;const arr=d.context.obj([target,'XYZ',40*mm,230*mm,null]);d.catalog.set(P.PDFName.of('OpenAction'),arr);
   const a=d.context.lookup(d.getPage(0).node.Annots().get(0));a.set(P.PDFName.of('Dest'),arr);a.delete(P.PDFName.of('A'));
  }
  const input=await d.save();fs.writeFileSync(out+'/'+kind+'.pdf',input);
  const work=await P.PDFDocument.load(input,{updateMetadata:false});const pre=C.inspect(work);
  let mode=['no-trim','symmetric','asymmetric','rotation90','rotation180','rotation270'].includes(kind)?'manual':'trim';
  const margins=kind==='asymmetric'||kind.startsWith('rotation')?{top:6,bottom:4,left:2,right:8}:{top:3,bottom:3,left:3,right:3};
  const rects=C.rectangles(pre,mode,margins);
  const streams=Object.fromEntries(work.context.enumerateIndirectObjects().filter(([,v])=>v instanceof P.PDFRawStream).map(([r,v])=>[r.toString(),hash(v.contents)]));
  C.crop(work,pre,rects);const output=await work.save({updateFieldAppearances:false});fs.writeFileSync(out+'/'+kind+'-web.pdf',output);
  const check=await P.PDFDocument.load(output,{updateMetadata:false});assert.equal(check.getPageCount(),count);
  check.getPages().forEach((p,i)=>{assert(Math.abs(p.getMediaBox().width-rects[i].width)<.001);assert(Math.abs(p.getMediaBox().height-rects[i].height)<.001);assert.equal(p.getRotation().angle,pre.pages[i].rotation);assert.equal(p.getMediaBox().x,0);});
  for(const [ref,object]of check.context.enumerateIndirectObjects())if(streams[ref.toString()])assert.equal(hash(object.contents),streams[ref.toString()],'original stream changed');
  if(kind==='destinations'){const dest=check.catalog.lookup(P.PDFName.of('OpenAction'));assert(Math.abs(dest.lookup(2).asNumber()-37*mm)<.001);assert(Math.abs(dest.lookup(3).asNumber()-227*mm)<.001);}
  assert.throws(()=>C.rectangles(pre,'manual',{top:500,bottom:500,left:0,right:0}),/margins/);
  const expected=rects.map((r,i)=>({width:r.width,height:r.height,rotation:pre.pages[i].rotation,offsetX:r.x,offsetY:r.y}));fs.writeFileSync(out+'/'+kind+'-expected.json',JSON.stringify(expected));
  console.log(kind,'OK',input.length,'→',output.length);
 }
 const d=await P.PDFDocument.create();d.addPage();d.catalog.set(P.PDFName.of('AcroForm'),d.context.obj({Fields:[]}));assert.throws(()=>C.inspect(d),/forms/);
 const tagged=await P.PDFDocument.create();tagged.addPage();tagged.catalog.set(P.PDFName.of('StructTreeRoot'),tagged.context.obj({Type:'StructTreeRoot'}));assert.throws(()=>C.inspect(tagged),/tagged/);
 console.log('Unsupported forms/tags safely blocked');fs.rmSync(out,{recursive:true,force:true});
})();
