/* Conservative, non-rasterising page crop. Uses the project's pdf-lib 1.17.1. */
(function (root) {
  'use strict';
  const P = root.PDFLib;
  const mm = 72 / 25.4;
  const name = s => P.PDFName.of(s);
  const fail = code => { throw new Error(code); };
  const num = v => v instanceof P.PDFNumber ? v.asNumber() : NaN;
  const lookup = (doc, v) => v ? doc.context.lookup(v) : undefined;
  function box(doc, value) {
    const a = lookup(doc, value);
    if (!(a instanceof P.PDFArray) || a.size() !== 4) return null;
    const n = a.asArray().map(v => num(lookup(doc, v)));
    if (!n.every(Number.isFinite) || n[2] <= n[0] || n[3] <= n[1]) return null;
    return { x:n[0], y:n[1], width:n[2]-n[0], height:n[3]-n[1] };
  }
  const contains = (a,b) => !!a && !!b && b.x >= a.x-.01 && b.y >= a.y-.01 && b.x+b.width <= a.x+a.width+.01 && b.y+b.height <= a.y+a.height+.01;
  const array = (doc, v) => { const a=lookup(doc,v); if (!(a instanceof P.PDFArray)) fail('malformed'); return a; };
  function inspect(doc) {
    if (doc.isEncrypted || doc.catalog.has(name('Encrypt'))) fail('encrypted');
    if (doc.catalog.has(name('AcroForm')) || doc.catalog.has(name('Perms'))) fail('forms');
    if (doc.catalog.has(name('StructTreeRoot'))) fail('tagged');
    const annotationOwners=new Set();
    const pages = doc.getPages().map((page,index) => {
      const media=box(doc,page.node.getInheritableAttribute(name('MediaBox')));
      if (!media || media.width>14400 || media.height>14400) fail('boxes');
      const cropValue=page.node.getInheritableAttribute(name('CropBox'));
      const crop=cropValue ? box(doc,cropValue) : media;
      if (!contains(media,crop)) fail('boxes');
      const unit=page.node.get(name('UserUnit'));
      if (unit && num(lookup(doc,unit))!==1) fail('unit');
      const r=page.getRotation().angle;
      if (!Number.isFinite(r) || r%90!==0) fail('rotation');
      const rotation=((r%360)+360)%360;
      const trimValue=page.node.get(name('TrimBox'));
      const trim=box(doc,trimValue);
      const validTrim=contains(media,trim);
      const bleed=box(doc,page.node.get(name('BleedBox')));
      const margins=validTrim && contains(media,bleed) && contains(bleed,trim) ? {
        top:(bleed.y+bleed.height-trim.y-trim.height)/mm,
        bottom:(trim.y-bleed.y)/mm, left:(trim.x-bleed.x)/mm,
        right:(bleed.x+bleed.width-trim.x-trim.width)/mm
      } : null;
      if (page.node.has(name('VP')) || page.node.has(name('B'))) fail('special');
      const annots=page.node.Annots();
      if (annots) for (const value of annots.asArray()) {
        // A shared annotation cannot be translated differently for two pages.
        const annotationKey=value instanceof P.PDFRef?value.toString():value;
        if(annotationOwners.has(annotationKey)) fail('annotations');
        annotationOwners.add(annotationKey);
        const a=lookup(doc,value);
        if (!(a instanceof P.PDFDict) || a.get(name('Subtype'))?.toString()!=='/Link') fail('annotations');
        if (!box(doc,a.get(name('Rect')))) fail('annotations');
        if (a.has(name('AA')) || a.has(name('AP'))) fail('annotations');
        const q=a.get(name('QuadPoints'));
        if (q && (array(doc,q).size()%8!==0 || !array(doc,q).asArray().every(v=>Number.isFinite(num(lookup(doc,v)))))) fail('annotations');
      }
      return {index,media,crop,trim:validTrim?trim:null,trimState:!trimValue?'absent':validTrim?'present':'invalid',bleed:margins,rotation};
    });
    if (!pages.length) fail('empty');
    return {pages,auto:pages.every(p=>p.trim),mixed:pages.some(p=>Math.abs(p.media.width-pages[0].media.width)>.01 || Math.abs(p.media.height-pages[0].media.height)>.01 || p.rotation!==pages[0].rotation)};
  }
  function manualRect(info, margins) {
    const m={}; for(const key of ['top','bottom','left','right']) {
      m[key]=Number(margins[key])*mm;
      if (!Number.isFinite(m[key]) || m[key]<0) fail('margins');
    }
    // Margins follow the visible orientation; rectangle coordinates remain PDF coordinates.
    const sides=info.rotation===90 ? {left:m.top,right:m.bottom,bottom:m.left,top:m.right}
      : info.rotation===180 ? {left:m.right,right:m.left,bottom:m.top,top:m.bottom}
      : info.rotation===270 ? {left:m.bottom,right:m.top,bottom:m.right,top:m.left} : m;
    const b=info.media;
    const rect={x:b.x+sides.left,y:b.y+sides.bottom,width:b.width-sides.left-sides.right,height:b.height-sides.top-sides.bottom};
    if (rect.width<1 || rect.height<1) fail('margins');
    return rect;
  }
  function rectangles(info,mode,margins) {
    if (mode==='trim' && !info.auto) fail('trim');
    return info.pages.map(p=>mode==='trim'?p.trim:manualRect(p,margins));
  }
  function destinationOffsets(doc,rects) {
    const offsets=new Map(doc.getPages().map((p,i)=>[p.ref.toString(),rects[i]]));
    const seen=new Set();
    function walk(value) {
      const v=lookup(doc,value); if (!v || seen.has(v)) return; seen.add(v);
      if (v instanceof P.PDFArray) {
        const target=v.size()>1 && v.get(0) instanceof P.PDFRef && offsets.get(v.get(0).toString());
        const type=v.size()>1 ? lookup(doc,v.get(1))?.toString() : '';
        if (target && ['/XYZ','/FitH','/FitBH','/FitV','/FitBV','/FitR','/Fit','/FitB'].includes(type)) {
          const coords=type==='/XYZ'?[[2,target.x],[3,target.y]] : ['/FitH','/FitBH'].includes(type)?[[2,target.y]] : ['/FitV','/FitBV'].includes(type)?[[2,target.x]] : type==='/FitR'?[[2,target.x],[3,target.y],[4,target.x],[5,target.y]]:[];
          for (const [i,delta] of coords) if (i<v.size()) {
            const old=lookup(doc,v.get(i)); if(old instanceof P.PDFNumber) v.set(i,P.PDFNumber.of(old.asNumber()-delta));
          }
        }
        v.asArray().forEach(walk);
      } else if (v instanceof P.PDFDict) v.entries().forEach(([,item])=>walk(item));
    }
    // Named destinations, outline destinations and link destinations can share arrays.
    doc.context.enumerateIndirectObjects().forEach(([,v])=>walk(v));
  }
  function crop(doc,info,rects) {
    if(rects.length!==info.pages.length) fail('boxes');
    destinationOffsets(doc,rects);
    let keptLinks=0,removedLinks=0;
    doc.getPages().forEach((page,i)=>{
      const r=rects[i]; if(!contains(info.pages[i].media,r) || r.width<1 || r.height<1) fail('margins');
      const annotations=page.node.Annots();
      if(annotations) {
        const kept=[];
        annotations.asArray().forEach(ref=>{
          const a=lookup(doc,ref),b=box(doc,a.get(name('Rect')));
          const x=Math.max(b.x,r.x),y=Math.max(b.y,r.y);
          const x2=Math.min(b.x+b.width,r.x+r.width),y2=Math.min(b.y+b.height,r.y+r.height);
          if(x2<=x || y2<=y) {removedLinks++;return;}
          a.set(name('Rect'),doc.context.obj([x-r.x,y-r.y,x2-r.x,y2-r.y]));
          if(a.has(name('QuadPoints'))) {
            const q=array(doc,a.get(name('QuadPoints'))).asArray().map((v,j)=>{
              const shifted=num(lookup(doc,v))-(j%2?r.y:r.x);
              return Math.max(0,Math.min(j%2?r.height:r.width,shifted));
            });
            a.set(name('QuadPoints'),doc.context.obj(q));
          }
          kept.push(ref);keptLinks++;
        });
        page.node.set(name('Annots'),doc.context.obj(kept));
      }
      page.translateContent(-r.x,-r.y);
      for(const set of ['setMediaBox','setCropBox','setTrimBox','setBleedBox','setArtBox']) page[set](0,0,r.width,r.height);
      page.setRotation(P.degrees(info.pages[i].rotation));
    });
    return {keptLinks,removedLinks};
  }
  function splitRects(rect,rotation) {
    const sideways=rotation===90||rotation===270;
    if((sideways?rect.height:rect.width)<=(sideways?rect.width:rect.height))return [rect];
    const first={...rect},second={...rect};
    if(sideways){first.height=second.height=rect.height/2;second.y+=first.height;}
    else {first.width=second.width=rect.width/2;second.x+=first.width;}
    return rotation===180||rotation===270?[second,first]:[first,second];
  }
  function excludedPages(text,count) {
    const excluded=new Set();
    if(!text.trim())return excluded;
    for(const part of text.split(/[,;]/)){
      const match=/^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
      if(!match)fail('excludePages');
      const start=Number(match[1]),end=Number(match[2]||match[1]);
      if(start<1||end<start||end>count)fail('excludePages');
      for(let n=start;n<=end;n++)excluded.add(n-1);
    }
    return excluded;
  }
  function splitAndCrop(doc,info,rects,excluded=new Set()) {
    // Labels indexed by the original page count need a separate numbering editor.
    if(doc.catalog.has(name('PageLabels')))fail('splitLabels');
    const original=doc.getPages(),expanded=[],targets=new Map();
    original.forEach((page,i)=>{
      const parts=excluded.has(i)?[rects[i]]:splitRects(rects[i],info.pages[i].rotation),pages=[page];
      if(parts.length===2){
        const node=page.node.clone();
        for(const key of ['Resources','MediaBox','CropBox','Rotate']){
          const value=page.node.getInheritableAttribute(name(key));if(value)node.set(name(key),value);
        }
        const ref=doc.context.register(node),copy=P.PDFPage.of(node,ref,doc);
        doc.insertPage(doc.getPages().indexOf(page)+1,copy);pages.push(copy);
        // Each half needs its own mutable array/dictionaries, but shares original streams.
        for(const p of pages){
          const content=lookup(doc,p.node.get(name('Contents')));
          if(content instanceof P.PDFArray)p.node.set(name('Contents'),content.clone());
          const annots=p.node.Annots();
          if(annots)p.node.set(name('Annots'),doc.context.obj(annots.asArray().map(a=>{
            const cloned=lookup(doc,a).clone();cloned.set(name('P'),p.ref);
            return doc.context.register(cloned);
          })));
        }
      }
      targets.set(page.ref.toString(),pages.map((p,j)=>({ref:p.ref,rect:parts[j]})));
      expanded.push(...parts);
    });
    // Route explicit/named/bookmark destinations before the existing offset adjustment.
    const seen=new Set();
    function walk(value){
      const v=lookup(doc,value);if(!v||seen.has(v))return;seen.add(v);
      if(v instanceof P.PDFArray){
        const choices=v.size()>1&&v.get(0) instanceof P.PDFRef&&targets.get(v.get(0).toString());
        const kind=v.size()>1?lookup(doc,v.get(1))?.toString():'';
        if(choices&&choices.length===2&&['/XYZ','/FitR','/FitH','/FitBH','/FitV','/FitBV','/Fit','/FitB'].includes(kind)){
          const x=['/XYZ','/FitR','/FitV','/FitBV'].includes(kind)&&v.size()>2?num(lookup(doc,v.get(2))):NaN;
          const y=['/XYZ','/FitR'].includes(kind)&&v.size()>3?num(lookup(doc,v.get(3))):['/FitH','/FitBH'].includes(kind)&&v.size()>2?num(lookup(doc,v.get(2))):NaN;
          const axis=choices[0].rect.x!==choices[1].rect.x?'x':'y',coordinate=axis==='x'?x:y;
          const target=Number.isFinite(coordinate)?choices.find(p=>coordinate>=p.rect[axis]&&coordinate<p.rect[axis]+p.rect[axis==='x'?'width':'height']):null;
          v.set(0,(target||choices[0]).ref);
        }
        v.asArray().forEach(walk);
      }else if(v instanceof P.PDFDict)v.entries().forEach(([,item])=>walk(item));
    }
    doc.context.enumerateIndirectObjects().forEach(([,v])=>walk(v));
    return crop(doc,inspect(doc),expanded);
  }
  root.PrintPdfCore={inspect,rectangles,crop,splitRects,splitAndCrop,excludedPages,mm,contains};
})(typeof window==='undefined'?globalThis:window);
