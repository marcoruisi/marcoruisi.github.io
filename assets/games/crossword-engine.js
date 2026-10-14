/* Shared local construction engine, extracted from topic-games. */
(()=>{'use strict';
function chooseCrossword(input,it=true){
 const say=(a,b)=>it?a:b;
 // Multi-start constructive crossword, quality-first: compactness and actual crossing density.
 const N=33,MAX_WORDS=48;
 const words=[...new Map(input.map(x=>[x.word,x])).values()].filter(x=>x.word.length>=(x.mrcFiller?2:3)&&x.word.length<=14).sort((a,b)=>(a.mrcFiller?1:0)-(b.mrcFiller?1:0)||a.word.length-b.word.length);
 const themeCount=words.filter(x=>!x.mrcFiller).length;
 const inside=(r,c)=>r>=0&&r<N&&c>=0&&c<N;
 if(words.length<3)throw Error(say('Servono almeno tre soluzioni utilizzabili.','At least three usable answers are required.'));
 let best=null;
 function attempt(seed,vertical,shift){
  const grid=Array.from({length:N},()=>Array(N).fill(''));
  const dirs=Array.from({length:N},()=>Array(N).fill(0));
  let loR=N,loC=N,hiR=0,hiC=0,crossings=0;
  const placed=[],used=new Set();
  function put(w,r,c,dr,dc,hits){
   for(let i=0;i<w.word.length;i++){const y=r+i*dr,x=c+i*dc;grid[y][x]=w.word[i];dirs[y][x]|=dc?1:2}
   placed.push({...w,r,c,dr,dc});used.add(w.word);crossings+=hits;
   loR=Math.min(loR,r);loC=Math.min(loC,c);hiR=Math.max(hiR,r+dr*(w.word.length-1));hiC=Math.max(hiC,c+dc*(w.word.length-1));
  }
  const sr=vertical?Math.floor((N-seed.word.length)/2):Math.floor(N/2),sc=vertical?Math.floor(N/2):Math.floor((N-seed.word.length)/2);
  put(seed,sr,sc,vertical?1:0,vertical?0:1,0);
  function check(w,r,c,dr,dc){
   const flag=dc?1:2,L=w.word.length;
   if(!inside(r,c)||!inside(r+dr*(L-1),c+dc*(L-1)))return -1;
   if(inside(r-dr,c-dc)&&grid[r-dr][c-dc])return -1;
   if(inside(r+dr*L,c+dc*L)&&grid[r+dr*L][c+dc*L])return -1;
   let hits=0;
   for(let k=0;k<L;k++){
    const y=r+k*dr,x=c+k*dc,v=grid[y][x];
    if(v){if(v!==w.word[k]||(dirs[y][x]&flag))return -1;hits++}
    else if(dc?((inside(y-1,x)&&grid[y-1][x])||(inside(y+1,x)&&grid[y+1][x])):((inside(y,x-1)&&grid[y][x-1])||(inside(y,x+1)&&grid[y][x+1])))return -1;
   }
   return hits;
  }
  while(placed.length<MAX_WORDS-8){
   let choice=null;
   const oldArea=(hiR-loR+1)*(hiC-loC+1);
   for(const w of words){if(used.has(w.word))continue;
    if(w.mrcFiller&&placed.filter(x=>x.mrcFiller).length>=Math.max(10,Math.ceil(themeCount*1.2)))continue;
    for(let y=loR;y<=hiR;y++)for(let x=loC;x<=hiC;x++){
     const cell=grid[y][x];if(!cell)continue;
     for(let k=0;k<w.word.length;k++){
      if(w.word[k]!==cell)continue;
      for(const [dr,dc] of [[0,1],[1,0]]){
       const r=y-k*dr,c=x-k*dc,hits=check(w,r,c,dr,dc);if(hits<1)continue;
       const minR=Math.min(loR,r),maxR=Math.max(hiR,r+dr*(w.word.length-1));
       const minC=Math.min(loC,c),maxC=Math.max(hiC,c+dc*(w.word.length-1));
       const h=maxR-minR+1,wd=maxC-minC+1,area=h*wd;
       if(h>30||wd>30)continue;
       const growth=area-oldArea,fill=(w.word.length-hits)/Math.max(1,growth);
       // Two-letter raccordi only close interior gaps; they never stretch the schema.
       if(w.mrcFiller&&w.word.length===2&&(growth!==0||placed.length<12))continue;
       // Density of *new* area matters more than merely joining at one letter.
       const shortBonus=w.word.length<=9?24:0;
       const themedPlaced=placed.filter(x=>!x.mrcFiller).length;
       const themeBonus=w.mrcFiller?(themedPlaced<Math.min(10,themeCount)?-260:0):135;
       const fillerCompact=w.mrcFiller?(growth===0?(w.word.length===2?175:120):-(growth*4)):0;
       const score=Math.random()*45+hits*80-growth*(6.6+shift*.22)+fill*22-Math.abs(h-wd)*2.2+shortBonus-(Math.max(0,w.word.length-9)*9)+themeBonus+fillerCompact;
       if(!choice||score>choice.score)choice={w,r,c,dr,dc,hits,score};
      }
     }
    }
   }
   if(!choice)break;
   // Stop before an especially sparse final attachment makes the board worse.
   if(placed.length>=12&&choice.score< -45)break;
   put(choice.w,choice.r,choice.c,choice.dr,choice.dc,choice.hits);
  }
  const rows=hiR-loR+1,cols=hiC-loC+1,area=rows*cols;
  let occupied=0;for(let y=loR;y<=hiR;y++)for(let x=loC;x<=hiC;x++)if(grid[y][x])occupied++;
  const density=occupied/area;
  // A dense, modestly-sized crossword beats a large web of isolated spokes.
  const shortCount=placed.filter(w=>w.word.length<=9).length;
  const themePlaced=placed.filter(w=>!w.mrcFiller).length;
  const merit=density*550+crossings*31+placed.length*58+themePlaced*45+shortCount*12-area*1.9-Math.abs(rows-cols)*2;
  return {grid,placed,loR,loC,hiR,hiC,merit,density};
 }
 const seeds=words.filter(x=>!x.mrcFiller);
 for(let i=seeds.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[seeds[i],seeds[j]]=[seeds[j],seeds[i]]}
 // Randomized starting points and weighting variations. No server dependency.
 for(const seed of seeds.slice(0,Math.min(14,seeds.length)))for(const vertical of [false,true])for(const shift of [0,1]){
  const candidate=attempt(seed,vertical,shift);
  if(candidate.placed.length<3)continue;
  if(!best||candidate.merit>best.merit)best=candidate;
 }
 if(!best)throw Error(say('Non riesco a costruire abbastanza incroci: prova altre parole.','Not enough crossing words: try different answers.'));
 // Second pass: search for answers that fit inside the existing footprint.
 // Requires two genuine crossings and never creates un-clued adjacent runs.
 {
  const {grid,placed,loR,loC,hiR,hiC}=best;
  const flags=Array.from({length:N},()=>Array(N).fill(0));
  const used=new Set(placed.map(x=>x.word));
  placed.forEach(p=>{for(let k=0;k<p.word.length;k++)flags[p.r+k*p.dr][p.c+k*p.dc]|=p.dc?1:2});
  for(let iteration=0;iteration<Math.min(25,MAX_WORDS-placed.length);iteration++){
   let pick=null;
   for(const w of words){if(used.has(w.word))continue;
    for(const [dr,dc] of [[0,1],[1,0]]){
     const bit=dc?1:2;
     for(let r=loR;r<=hiR-dr*(w.word.length-1);r++)for(let c=loC;c<=hiC-dc*(w.word.length-1);c++){
      if(inside(r-dr,c-dc)&&grid[r-dr][c-dc])continue;
      if(inside(r+dr*w.word.length,c+dc*w.word.length)&&grid[r+dr*w.word.length][c+dc*w.word.length])continue;
      let hits=0,added=0,valid=true;
      for(let k=0;k<w.word.length;k++){
       const y=r+k*dr,x=c+k*dc,v=grid[y][x];
       if(v){if(v!==w.word[k]||(flags[y][x]&bit)){valid=false;break}hits++}
       else {if((inside(y+dc,x+dr)&&grid[y+dc][x+dr])||(inside(y-dc,x-dr)&&grid[y-dc][x-dr])){valid=false;break}added++}
      }
      if(!valid||hits<2||added===0)continue;
      const merit=hits*120+w.word.length*4-added*2+(w.word.length<=4?70:0);
      if(!pick||merit>pick.merit)pick={...w,r,c,dr,dc,merit};
     }
    }
   }
   if(!pick)break;
   for(let k=0;k<pick.word.length;k++){
    const y=pick.r+k*pick.dr,x=pick.c+k*pick.dc;
    grid[y][x]=pick.word[k];flags[y][x]|=pick.dc?1:2;
   }
   placed.push(pick);used.add(pick.word);
  }
 }
 const {grid,placed,loR,loC,hiR,hiC}=best,rows=hiR-loR+1,cols=hiC-loC+1;
 const cells=[];for(let y=loR;y<=hiR;y++)for(let x=loC;x<=hiC;x++)cells.push(grid[y][x]);
 const out=placed.map(w=>({...w,r:w.r-loR,c:w.c-loC}));
 const starts=[...new Set(out.map(w=>w.r*cols+w.c))].sort((a,b)=>a-b);
 const number=new Map(starts.map((v,i)=>[v,i+1]));out.forEach(w=>w.number=number.get(w.r*cols+w.c));
 return {kind:'crossword',rows,cols,cells,words:out};
}
function crosswordProject(p,it=true){
 const rows=Math.max(3,p.rows),cols=Math.max(3,p.cols),blacks=Array(rows*cols).fill(true),clues={},clueSources={};
 for(let r=0;r<p.rows;r++)for(let c=0;c<p.cols;c++)blacks[r*cols+c]=!p.cells[r*p.cols+c];
 for(const w of p.words){
  const pos=w.r*cols+w.c,dir=w.dc?'a':'d';
  if(!blacks[pos]){const key=dir+':'+pos;clues[key]=w.clue||'';if(w.source)clueSources[key]={name:(new URL(w.source)).hostname,url:w.source}}
 }
 return {version:1,rows,cols,blacks,letters:Array(rows*cols).fill(''),clues,clueSources,ui:{mode:'play',dir:'a',selected:0,lang:it?'it':'en'}};
}
globalThis.MRCCrosswordEngine={build:chooseCrossword,project:crosswordProject};
})();
