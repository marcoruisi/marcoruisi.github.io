/* Compact snapshots for catalogued puzzles. Checksums detect changes, not authenticity. */
(()=>{'use strict';
const hash=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return h>>>0};
const bytes=s=>new TextEncoder().encode(s);
function fingerprint(s,mode){return hash(bytes(JSON.stringify([s.rows,s.cols,s.blacks,Object.entries(s.clues||{}).sort(([a],[b])=>a.localeCompare(b)),s.layoutKnown!==false,s.blackCount??null,s.orderedClues||null,mode])))}
function pack(v,width){const a=new Uint8Array(Math.ceil(v.length*width/8));v.forEach((x,i)=>{for(let j=0;j<width;j++)if(x&(1<<(width-1-j)))a[Math.floor((i*width+j)/8)]|=1<<(7-(i*width+j)%8)});return a}
function unpack(a,n,width){if(a.length!==Math.ceil(n*width/8))throw Error('length');const out=[];for(let i=0;i<n;i++){let x=0;for(let j=0;j<width;j++)x=x*2+((a[Math.floor((i*width+j)/8)]>>(7-(i*width+j)%8))&1);out.push(x)}return out}
function encode(s,mode){const n=s.rows*s.cols;const v=Array.from({length:n},(_,i)=>{if(mode==='diagramless'&&s.diagramlessBlacks?.[i])return 27;const c=s.letters[i]||'';if(c&&!/^[A-Z]$/.test(c))throw Error('alphabet');return c?c.charCodeAt(0)-64:0});
 const dense=pack(v,5),mask=pack(v.map(x=>x?1:0),1),filled=pack(v.filter(Boolean),5),sparse=new Uint8Array(mask.length+filled.length);sparse.set(mask);sparse.set(filled,mask.length);const strategy=sparse.length<dense.length?1:0,body=strategy?sparse:dense;
 const data=new Uint8Array(10+body.length),view=new DataView(data.buffer);data[0]=1;data[1]=strategy;view.setUint32(2,fingerprint(s,mode));data.set(body,10);view.setUint32(6,hash(new Uint8Array([...data.slice(0,6),...body])));
 return btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decode(token,s,mode){if(!/^[A-Za-z0-9_-]{14,1200}$/.test(token))throw Error('format');const data=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-token.length%4)%4)),c=>c.charCodeAt(0));const view=new DataView(data.buffer);if(data[0]!==1||data[1]>1||view.getUint32(2)!==fingerprint(s,mode)||view.getUint32(6)!==hash(new Uint8Array([...data.slice(0,6),...data.slice(10)])))throw Error('checksum');
 const n=s.rows*s.cols,body=data.slice(10);let v;if(!data[1])v=unpack(body,n,5);else{const m=Math.ceil(n/8),mask=unpack(body.slice(0,m),n,1),filled=unpack(body.slice(m),mask.reduce((a,b)=>a+b,0),5);let i=0;v=mask.map(x=>x?filled[i++]:0)}
 if(v.some((x,i)=>x>27||(mode==='classic'&&(x===27||(s.blacks[i]&&x)))))throw Error('values');return {letters:v.map(x=>x>0&&x<27?String.fromCharCode(64+x):''),diagramlessBlacks:v.map(x=>x===27)};
}
window.MRCCrosswordLink={encode,decode};
})();
