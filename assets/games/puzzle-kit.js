/* MRC Puzzle Kit — shared offline puzzles + share links. No network, no accounts. */
(()=>{'use strict';
const kit={};
kit.encode=o=>{const bytes=new TextEncoder().encode(JSON.stringify(o));let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
kit.decode=s=>{if(!s||s.length>5500)throw Error('Invalid challenge');const b=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return JSON.parse(new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0))))};
kit.valid=o=>o&&o.version===1&&['sudoku','mastermind','sequences','wordsearch'].includes(o.type)&&typeof o.data==='object'&&o.data!==null;
kit.share=async(data,title,it)=>{const path=it?{sudoku:'sudoku',mastermind:'codice-segreto',sequences:'sequenze',wordsearch:'trova-parole'}:{sudoku:'sudoku',mastermind:'codebreaker',sequences:'sequences',wordsearch:'wordsearch'};const url=location.origin+(it?'/it/giochi/':'/games/')+(path[data.type]||'')+'/';const qs='?challenge='+kit.encode(data);const link=url+qs;if(link.length>1900)return {link:null,msg:it?'Sfida troppo lunga per un link: scarica il JSON.':'Challenge too long for a link: download JSON.'};try{if(navigator.share){await navigator.share({title,text:it?'Prova la mia sfida MRC':'Try my MRC challenge',url:link});return {link,msg:it?'Condivisa.':'Shared.'}}}catch(e){if(e.name==='AbortError')return {link,msg:''}}try{await navigator.clipboard.writeText(link);return {link,msg:it?'Link copiato.':'Link copied.'}}catch{return {link,msg:it?'Copia il link qui sotto.':'Copy the link below.'}}};
kit.attachGameShare=(root,getData,it)=>{
 if(!root||root.querySelector('.mrc-game-share'))return;
 const box=document.createElement('section');box.className='mrc-game-share';
 const desc=document.createElement('p');desc.textContent=it?'Ti è piaciuta? Invita qualcuno a provare la stessa sfida.':'Enjoyed it? Invite someone to try the same challenge.';
 const actions=document.createElement('div');actions.className='mrc-game-share-actions';
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);actions.append(b);return b};
 const status=document.createElement('p');status.className='mrc-game-share-status';status.setAttribute('role','status');
 const url=document.createElement('input');url.type='text';url.className='mrc-game-share-url';url.readOnly=true;url.hidden=true;url.setAttribute('aria-label',it?'Link della sfida':'Challenge link');
 button(it?'Condividi questa sfida ↗':'Share this challenge ↗',async()=>{
  const data=getData();if(!data||!kit.validate(data)){status.textContent=it?'Sfida non disponibile.':'Challenge unavailable.';return}
  const result=await kit.share(data,it?'Sfida MRC':'MRC challenge',it);status.textContent=result.msg;url.hidden=!result.link;if(result.link){url.value=result.link;url.select()}
  if(!result.link)status.textContent+=(it?' Usa Scarica JSON per inviarla.':' Use Download JSON to send it.');
 });
 button(it?'Scarica JSON':'Download JSON',()=>{const data=getData();if(data&&kit.validate(data))kit.download(data,'mrc-'+data.type+'-challenge')});
 box.append(desc,actions,status,url);root.append(box);
};
kit.download=(data,name)=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
kit.readFile=async f=>{if(!f||f.size>200000)throw Error('File too large');const o=JSON.parse(await f.text());if(!kit.valid(o))throw Error('Invalid MRC puzzle');return o};
kit.sudoku={};
const peers=(i,j)=>i!==j&&(Math.floor(i/9)===Math.floor(j/9)||i%9===j%9||(Math.floor(i/27)===Math.floor(j/27)&&Math.floor(i%9/3)===Math.floor(j%9/3)));
const options=(b,i)=>{const bad=new Set();for(let j=0;j<81;j++)if(b[j]&&peers(i,j))bad.add(b[j]);return [1,2,3,4,5,6,7,8,9].filter(x=>!bad.has(x))};
kit.sudoku.count=(original,limit=2)=>{if(!Array.isArray(original)||original.length!==81||original.some(v=>!Number.isInteger(v)||v<0||v>9))return 0;const b=original.slice();for(let i=0;i<81;i++)if(b[i])for(let j=i+1;j<81;j++)if(b[i]===b[j]&&peers(i,j))return 0;let count=0;function solve(){if(count>=limit)return;let best=-1,opts=[];for(let i=0;i<81;i++)if(!b[i]){const o=options(b,i);if(!o.length)return;if(best<0||o.length<opts.length){best=i;opts=o;if(o.length===1)break}}if(best<0){count++;return}for(const n of opts){b[best]=n;solve();b[best]=0;if(count>=limit)return}}solve();return count};
const shuffled=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
kit.sudoku.generate=(level='easy')=>{const nums=shuffled([1,2,3,4,5,6,7,8,9]),rows=shuffled([0,1,2]).flatMap(x=>shuffled([0,1,2]).map(n=>x*3+n)),cols=shuffled([0,1,2]).flatMap(x=>shuffled([0,1,2]).map(n=>x*3+n));const b=rows.flatMap(r=>cols.map(c=>nums[(r*3+Math.floor(r/3)+c)%9])),target={easy:41,medium:33,hard:28}[level]||41;for(const i of shuffled(Array.from({length:81},(_,i)=>i))){if(b.filter(Boolean).length<=target)break;const old=b[i];b[i]=0;if(kit.sudoku.count(b)!==1)b[i]=old}return b};
kit.validate=o=>{if(!kit.valid(o))return false;const d=o.data;if(o.type==='sudoku')return Array.isArray(d.grid)&&kit.sudoku.count(d.grid)===1;if(o.type==='mastermind')return /^[1-6]{4}$/.test(d.code||'');if(o.type==='sequences')return Number.isSafeInteger(d.start)&&Number.isSafeInteger(d.step)&&Math.abs(d.start)<10000&&d.step!==0&&Math.abs(d.step)<=1000&&Number.isInteger(d.count)&&d.count>=3&&d.count<=9;if(o.type==='wordsearch')return Array.isArray(d.words)&&d.words.length>=3&&d.words.length<=16&&d.words.every(w=>typeof w==='string'&&/^[A-Z]{3,12}$/.test(w))};
kit.challenge=()=>{try{const val=new URLSearchParams(location.search).get('challenge');if(!val)return null;const o=kit.decode(val);return kit.validate(o)?o:null}catch{return null}};
kit.wordsearch=(words,size=12)=>{const cols=typeof size==='object'?size.cols:size,rows=typeof size==='object'?size.rows:size;const grid=Array(rows*cols).fill(''),places=[],directions=[[1,0],[0,1],[1,1],[-1,1]];for(const word of words){let ok=false;for(let t=0;t<600&&!ok;t++){const [dx,dy]=directions[Math.floor(Math.random()*directions.length)],x=Math.floor(Math.random()*cols),y=Math.floor(Math.random()*rows),endX=x+dx*(word.length-1),endY=y+dy*(word.length-1);if(endX<0||endX>=cols||endY<0||endY>=rows)continue;let fits=true;for(let k=0;k<word.length;k++){const index=(y+dy*k)*cols+x+dx*k;if(grid[index]&&grid[index]!==word[k]){fits=false;break}}if(!fits)continue;const ids=[];for(let k=0;k<word.length;k++){const index=(y+dy*k)*cols+x+dx*k;grid[index]=word[k];ids.push(index)}places.push({word,ids});ok=true}}for(let i=0;i<grid.length;i++)if(!grid[i])grid[i]='ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)];return {grid,places,size:cols,rows,cols}};
// Reusable, local end-of-round panel (no external dependencies).
// A full-viewport finish dialog, shared by Sudoku and the other puzzles.
kit.finishPanel=(root,{title,detail,restart,label})=>{
  if(!document.getElementById('mrc-finish-style')){
    const style=document.createElement('style');style.id='mrc-finish-style';
    style.textContent=`.mrc-finish-screen{position:fixed!important;inset:0!important;z-index:100010;display:flex;justify-content:center;align-items:center;width:100%;height:100%;padding:clamp(14px,4vw,28px);box-sizing:border-box;background:rgba(16,16,24,.78);overflow:auto;border-radius:0!important}.mrc-finish-card{background:var(--panel,#fff);color:var(--text,#222);border:1px solid var(--border,#999);width:min(100%,520px);max-height:calc(100dvh - 28px);overflow:auto;padding:clamp(24px,5vw,46px);text-align:center;border-radius:14px;box-shadow:0 16px 55px #0004;box-sizing:border-box}.mrc-finish-card h2{font-size:clamp(28px,5vw,44px);line-height:1.15;margin:0 0 18px}.mrc-finish-card p{font-size:clamp(16px,2.5vw,20px);line-height:1.5;margin:0 0 26px}.mrc-finish-card button{min-height:52px;padding:12px 25px;font:inherit;font-weight:650;border:1px solid #222;border-radius:6px;cursor:pointer;background:#222;color:#fff}.mrc-finish-card button:focus-visible{outline:3px solid #507ca8;outline-offset:3px}.mrc-finish-screen[hidden]{display:none!important}`;
    document.head.append(style);
  }
  let screen=root._mrcFinishScreen;
  if(!screen){screen=document.createElement('div');screen.className='mrc-finish-screen';screen.setAttribute('role','alertdialog');screen.setAttribute('aria-modal','true');document.body.append(screen);root._mrcFinishScreen=screen}
  screen.setAttribute('aria-label',title);
  screen.replaceChildren();const card=document.createElement('section');card.className='mrc-finish-card';
  const h=document.createElement('h2');h.textContent=title;
  const p=document.createElement('p');p.textContent=detail;
  const b=document.createElement('button');b.type='button';b.textContent=label;
  b.addEventListener('click',()=>{screen.hidden=true;restart()});
  card.append(h,p,b);screen.append(card);screen.hidden=false;b.focus({preventScroll:true});
  screen.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();b.focus()}};
};
kit.hideFinish=root=>{if(root._mrcFinishScreen)root._mrcFinishScreen.hidden=true};
window.MRCPuzzleKit=kit;
})();
