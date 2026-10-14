/* One crossword document: required puzzle data, optional progress. */
(()=>{'use strict';
function validate(x,playable=false){
 if(!x||x.version!==1||!Number.isInteger(x.rows)||!Number.isInteger(x.cols)||x.rows<3||x.rows>30||x.cols<3||x.cols>30)return null;
 const n=x.rows*x.cols;
 if(!Array.isArray(x.blacks)||x.blacks.length!==n||!x.blacks.every(v=>typeof v==='boolean')||!x.clues||typeof x.clues!=='object'||Array.isArray(x.clues))return null;
 const clues={},clueSources={};
 for(const [k,v] of Object.entries(x.clues)){
  if(!/^[ad]:\d+$/.test(k)||Number(k.slice(2))>=n||typeof v!=='string'||v.length>1000)return null;
  clues[k]=v;
 }
 for(const [k,v] of Object.entries(x.clueSources||{})){
  if(!Object.hasOwn(clues,k)||!v||typeof v!=='object')continue;
  if(typeof v.name!=='string'||v.name.length>140||typeof v.url!=='string'||v.url.length>2000||!/^https?:\/\//.test(v.url))continue;
  clueSources[k]={name:v.name,url:v.url};
  for(const f of ['date','publishedAt','year','category'])if(typeof v[f]==='string'||typeof v[f]==='number')clueSources[k][f]=String(v[f]).slice(0,100);
 }
 if(playable){
  const covered=new Set();let count=0;
  for(let i=0;i<n;i++)if(!x.blacks[i])for(const dir of ['a','d']){
   const c=i%x.cols,r=Math.floor(i/x.cols),step=dir==='a'?1:x.cols;
   if(dir==='a'?c>0&&!x.blacks[i-1]:r>0&&!x.blacks[i-x.cols])continue;
   const cells=[];for(let j=i;j<n&&!x.blacks[j]&&(dir==='d'||Math.floor(j/x.cols)===r);j+=step)cells.push(j);
   if(cells.length<2)continue;
   if(!String(clues[dir+':'+i]||'').trim())return null;
   cells.forEach(j=>covered.add(j));count++;
  }
  if(!count||x.blacks.some((b,i)=>!b&&!covered.has(i)))return null;
 }
 if(Object.hasOwn(x,'progress')&&(!x.progress||typeof x.progress!=='object'||Array.isArray(x.progress)))return null;
 const progress=x.progress||x;
 const letters=progress.letters===undefined&&!Object.hasOwn(x,'progress')?Array(n).fill(''):progress.letters;
 if(!Array.isArray(letters)||letters.length!==n||!letters.every(v=>typeof v==='string'&&v.length<=2))return null;
 const ui=progress.ui||{};
 if(typeof ui!=='object'||Array.isArray(ui))return null;
 const first=x.blacks.findIndex(b=>!b);
 const s={version:1,rows:x.rows,cols:x.cols,blacks:x.blacks.slice(),letters:letters.map(v=>v.toLocaleUpperCase().slice(0,1)),clues,clueSources,ui:{mode:['build','clues','play'].includes(ui.mode)?ui.mode:'build',dir:ui.dir==='d'?'d':'a',selected:Number.isInteger(ui.selected)&&ui.selected>=0&&ui.selected<n&&!x.blacks[ui.selected]?ui.selected:Math.max(0,first),lang:ui.lang==='en'?'en':'it'}};
 for(const f of ['title','date'])if(typeof x[f]==='string')s[f]=x[f].slice(0,200);
 return s;
}
function documentData(input,{progress=false,title=''}={}){
 const s=validate(input,!progress);if(!s)throw Error('invalid');
 if(title)s.title=title.slice(0,200);
 const {letters,ui,...puzzle}=s;
 if(progress)puzzle.progress={letters,ui};
 return puzzle;
}
function load(input,{playable=false}={}){
 const s=validate(input,playable);if(!s)return null;
 if(!Object.hasOwn(input,'progress')&&!Object.hasOwn(input,'letters'))s.ui.mode='play';
 if(playable)s.ui.mode='play';
 return s;
}
function download(input,options={}){
 const s=documentData(input,options);
 const stem=(s.title||s.date||new Date().toISOString().slice(0,10)).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'cruciverba';
 const url=URL.createObjectURL(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='mrc-'+stem+(options.progress?'-progressi':'')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
window.MRCCrosswordJSON={validate,load,download};
})();
