/* PDF content placement analysis. Unsupported contexts retain source dimensions. */
(()=>{
 'use strict';
 const P=PDFLib,N=P.PDFName.of,I=[1,0,0,1,0,0];
 const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 // Strings, hex strings, arrays and dictionaries must not be interpreted as operators.
 function tokens(s){
  const out=[];let i=0;
  while(i<s.length){
   const c=s[i];if(/[\s\x00]/.test(c)){i++;continue;}
   if(c==='%'){while(i<s.length&&!/[\r\n]/.test(s[i]))i++;continue;}
   if(c==='('){let depth=1;i++;while(i<s.length&&depth){if(s[i]==='\\'){i+=2;continue;}if(s[i]==='(')depth++;if(s[i]===')')depth--;i++;}if(depth)throw Error('string');out.push(null);continue;}
   if(c==='<'&&s[i+1]!=='<'){const end=s.indexOf('>',i+1);if(end<0)throw Error('hex');i=end+1;out.push(null);continue;}
   if(s.slice(i,i+2)==='<<'||s.slice(i,i+2)==='>>'){out.push(s.slice(i,i+2));i+=2;continue;}
   if('[]{}'.includes(c)){out.push(c);i++;continue;}
   const start=i++;while(i<s.length&&!/[\s\x00()<>\[\]{}/%]/.test(s[i]))i++;
   const t=s.slice(start,i);out.push(t);
   // Never guess where binary inline image data ends.
   if(t==='BI')throw Error('inline-image');
  }return out;
 }
 function analyze(doc){
  const ctx=doc.context,uses=new Map(),warnings=[];let reliable=true,visits=0;
  const lookup=(o)=>ctx.lookup(o),get=(d,k)=>lookup(d?.get(N(k)));
  function read(o){o=lookup(o);if(o instanceof P.PDFArray)return o.asArray().map(read).join('\n');if(!(o instanceof P.PDFRawStream))throw Error('content');return new TextDecoder('latin1').decode(P.decodePDFRawStream(o).decode());}
  function walk(contents,res,initial,ancestors){
   if(++visits>10000||ancestors.size>40)throw Error('recursion');
   let matrix=initial.slice(),stack=[],args=[],depth=0;
   for(const t of tokens(read(contents))){
    if(t==='['||t==='<<'){depth++;continue;}if(t===']'||t==='>>'){depth--;if(depth<0)throw Error('syntax');continue;}if(depth)continue;
    if(t===null||t.startsWith('/')||/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t)){args.push(t);continue;}
    if(t==='q')stack.push(matrix.slice());
    else if(t==='Q'){if(!stack.length)throw Error('graphics-state');matrix=stack.pop();}
    else if(t==='cm'){if(args.length!==6||args.some(v=>v===null||!Number.isFinite(Number(v))))throw Error('matrix');matrix=mul(matrix,args.map(Number));}
    else if(t==='Do'){
     if(args.length!==1||!args[0]?.startsWith('/'))throw Error('xobject');
     const key=P.PDFName.of(args[0].slice(1).replace(/#([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))));
     const ref=get(res,'XObject')?.get(key),obj=lookup(ref);
     if(!(obj instanceof P.PDFRawStream))throw Error('xobject');
     const subtype=get(obj.dict,'Subtype')?.toString();
     if(subtype==='/Image'&&ref instanceof P.PDFRef){
      const id=ref.toString(),u=uses.get(id)||{width:0,height:0,resources:res,contexts:new Set(),count:0};
      u.width=Math.max(u.width,Math.hypot(matrix[0],matrix[1]));u.height=Math.max(u.height,Math.hypot(matrix[2],matrix[3]));u.count++;
      const spaces=get(res,'ColorSpace');let cs=get(obj.dict,'ColorSpace');
      if(cs instanceof P.PDFName&&!['/DeviceRGB','/DeviceCMYK','/DeviceGray','/Pattern'].includes(cs.toString()))cs=get(spaces,cs.decodeText());
      const defaultKey={'/DeviceRGB':'DefaultRGB','/DeviceCMYK':'DefaultCMYK','/DeviceGray':'DefaultGray'}[cs?.toString()];
      u.contexts.add((defaultKey&&get(spaces,defaultKey)||cs)?.toString()||'embedded');uses.set(id,u);
     }else if(subtype==='/Form'){
      const id=ref?.toString();if(ancestors.has(id))throw Error('cycle');
      const m=get(obj.dict,'Matrix'),fm=m instanceof P.PDFArray?m.asArray().map(x=>lookup(x).asNumber()):I;
      if(fm.length!==6||!fm.every(Number.isFinite))throw Error('form-matrix');
      walk(obj,get(obj.dict,'Resources')||res,mul(matrix,fm),new Set([...ancestors,id]));
     }
    }args=[];
   }if(depth||stack.length)throw Error('unbalanced-state');
  }
  for(const page of doc.getPages())try{
   const unit=get(page.node,'UserUnit')?.asNumber?.()||1;
   if(!Number.isFinite(unit)||unit<=0)throw Error('user-unit');
   if(page.node.Contents())walk(page.node.Contents(),page.node.Resources(),[unit,0,0,unit,0,0],new Set());
  }catch(e){reliable=false;warnings.push('Placement analysis incomplete: '+e.message);}
  return {uses,reliable,warnings};
 }
 window.MRCImagePlacement={analyze};
})();
