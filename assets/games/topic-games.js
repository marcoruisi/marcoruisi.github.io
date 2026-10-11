/* MRC Topic Games 0.1 — local puzzle construction and sharing, external Wikimedia lookup only. */
(()=>{'use strict';
const root=document.querySelector('[data-topic-games]');if(!root)return;
const it=root.dataset.lang==='it';const $=s=>root.querySelector(s);
const say=(a,b)=>it?a:b;
const cats={news:['attualità cultura scienza','current events science culture'],cinema:['cinema film registi','film cinema directors'],music:['musica cantanti compositori','music singers composers'],science:['scienza fisica astronomia','science astronomy physics'],nature:['natura animali piante','nature animals plants'],sport:['sport atleti','sports athletes'],history:['storia personaggi','history historical figures']};
let pairs=[],puzzle=null,mode='crossword',prepared={},picked=null,letters=[],found=new Set(),editing=false;
const status=$('#topic-status');
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'');
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const eligible=p=>/^[A-Z]{3,14}$/.test(p.word)&&p.clue.length>=9&&p.clue.length<=330;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fileName=()=>`mrc-${mode}-${new Date().toISOString().slice(0,10)}.json`;
function tell(s){status.textContent=s}
function addRow(p={word:'',clue:'',source:''}){const row=document.createElement('div');row.className='topic-pair';row.innerHTML=`<label>${say('Soluzione','Answer')}<input class="pair-word" maxlength="24" value="${escapeHTML(p.word)}"></label><label>${say('Definizione','Clue')}<textarea class="pair-clue" rows="2" maxlength="330">${escapeHTML(p.clue)}</textarea></label><button type="button" class="pair-remove" aria-label="${say('Rimuovi','Remove')}">×</button>`;if(/^https:\/\//i.test(p.source||'')){const a=document.createElement('a');a.href=p.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent=say('Fonte ↗','Source ↗');row.querySelector('label:last-of-type').append(a)}row.querySelector('.pair-remove').addEventListener('click',()=>row.remove());$('#topic-rows').append(row)}
function displayPairs(arr){pairs=arr;$('#topic-rows').replaceChildren();$('#topic-review-panel').hidden=true;$('#topic-edit-section').hidden=false;$('#topic-play-section').hidden=true;prepared={};$('#topic-count').textContent=say(`${arr.length} definizioni create.`,`Created ${arr.length} clues.`);$('#topic-edit-section').scrollIntoView({behavior:'smooth',block:'start'});tell('')}
function gather(){const result=[],seen=new Set();for(const row of root.querySelectorAll('.topic-pair')){const word=norm(row.querySelector('.pair-word').value),clue=clean(row.querySelector('.pair-clue').value),source=row.querySelector('a')?.href||'';if(!word&&!clue)continue;if(!eligible({word,clue})){throw Error(say(`Controlla «${word||'…'}»: soluzione 3–14 lettere A–Z, definizione 9–330 caratteri.`,`Check “${word||'…'}”: answer 3–14 letters A–Z, clue 9–330 characters.`))}if(seen.has(word))continue;seen.add(word);result.push({word,clue,source})}if(result.length<3)throw Error(say('Servono almeno tre coppie valide.','At least three valid pairs are required.'));if(result.length>24)throw Error(say('Massimo 24 coppie.','Maximum 24 pairs.'));return result}
const wikiUrl=(q)=>`https://${it?'it':'en'}.wikipedia.org/w/api.php?${new URLSearchParams({action:'query',generator:'search',gsrsearch:q,gsrlimit:'50',gsrnamespace:'0',prop:'extracts',exintro:'1',explaintext:'1',exsentences:'2',format:'json',origin:'*'}).toString()}`;
async function searchWiki(q){const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),14000);try{const r=await fetch(wikiUrl(q),{signal:ctl.signal,credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.error)throw Error(data.error.info||'API error');const arr=Object.values(data.query?.pages||{});const found=[];for(const page of arr){const title=clean(page.title),word=norm(title);if(!/^[A-Z]{3,12}$/.test(word))continue;const intro=clean(page.extract||'');if(intro.length<38)continue;let clue=intro.split(/(?<=[.!?])\s/)[0]||intro;
 // The introductory sentence is the evidence: remove the encyclopaedia title, never claim to generate an independently fact-checked clue.
 const prefixes=[title, title.replace(/\s*\([^)]*\)/g,'')];for(const pre of prefixes){if(clue.toLowerCase().startsWith(pre.toLowerCase())){clue=clue.slice(pre.length).trim();break}}
 clue=clue.replace(/^[,\s:–—-]+/,'').replace(new RegExp('^(è|era|sono|fu|si tratta di|is|was|are|were)\\s+','i'),'').replace(/^[,\s:–—-]+/,'');
 const re=new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig');clue=clue.replace(re,'…');if(clue.length<18)continue;clue=clue.slice(0,220).trim();if(clue.toLowerCase().includes(title.toLowerCase()))continue;found.push({word,clue:clue[0].toUpperCase()+clue.slice(1),source:`https://${it?'it':'en'}.wikipedia.org/?curid=${page.pageid}`})}
 const seen=new Set();return found.filter(x=>{if(seen.has(x.word))return false;seen.add(x.word);return true}).sort((a,b)=>{const rank=w=>w.length<=9?0:w.length<=11?1:2;return rank(a.word)-rank(b.word)||Math.abs(a.word.length-6)-Math.abs(b.word.length-6)}).slice(0,24)}finally{clearTimeout(tm)}}
$('#topic-search').addEventListener('click',async()=>{const q=$('#topic-query').value.trim();if(q.length<2){tell(say('Scegli o scrivi un argomento.','Select or type a topic.'));return}$('#topic-search').disabled=true;tell(say('Cerco voci e definizioni su Wikipedia…','Searching Wikipedia for entries and clues…'));try{const found=await searchWiki(q);if(found.length<3)throw Error(say('Non ho trovato abbastanza definizioni: prova un argomento più ampio oppure incolla le tue coppie.','Not enough definitions found. Try a broader topic or paste your own pairs.'));displayPairs(found)}catch(e){tell(say('Non è stato possibile preparare la raccolta: ','Unable to prepare collection: ')+e.message)}finally{$('#topic-search').disabled=false}});
root.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('[data-topic]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#topic-query').value=cats[b.dataset.topic][it?0:1]}));
$('#topic-paste-toggle').addEventListener('click',()=>{$('#topic-paste-panel').hidden=!$('#topic-paste-panel').hidden});
$('#topic-import').addEventListener('click',()=>{const arr=$('#topic-paste').value.split(/\r?\n/).filter(Boolean).map(s=>{const i=s.indexOf('|');return {word:norm(i>=0?s.slice(0,i):''),clue:clean(i>=0?s.slice(i+1):''),source:''}}).filter(eligible);if(arr.length<3){tell(say('Incolla almeno tre righe nel formato SOLUZIONE | definizione.','Paste at least three lines in ANSWER | clue format.'));return}displayPairs(arr.slice(0,24))});
$('#topic-add').addEventListener('click',()=>addRow());
// An original, editable MRC clue bank: fillers belong to the crossword, never to the thematic source.
let fillerCache=null;
async function loadFillerWords(){
 if(!it)return [];
 if(fillerCache)return fillerCache;
 try{
  const response=await fetch('/assets/games/crossword-fillers.csv',{cache:'force-cache'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const text=await response.text();
  const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  const parsed=[];
  for(const line of lines.slice(1)){
   const fields=line.split(',');
   if(fields.length!==4)continue;
   const [word,clue,lang]=fields;
   if(lang==='it'&&/^[A-Z]{2,6}$/.test(word)&&clue&&clue.length>=9)parsed.push({word,clue,source:'',mrcFiller:true});
  }
  fillerCache=parsed;return parsed;
 }catch(e){console.warn('MRC: banca parole di raccordo non disponibile',e);return []}
}
function selectFillers(theme,bank,limit=42){
 const used=new Set(theme.map(x=>x.word));const freq={};
 for(const entry of theme)for(const c of new Set(entry.word))freq[c]=(freq[c]||0)+1;
 return bank.filter(entry=>!used.has(entry.word)).map(entry=>({entry,score:[...entry.word].reduce((t,c)=>t+(freq[c]||0),0)/entry.word.length+((entry.word.length<=4)?1:0)})).sort((a,b)=>b.score-a.score||a.entry.word.localeCompare(b.entry.word)).slice(0,limit).map(x=>x.entry);
}
function chooseCrossword(input){
 // Multi-start constructive crossword, quality-first: compactness and actual crossing density.
 const N=33,MAX_WORDS=48;
 const words=[...input].filter(x=>x.word.length>=(x.mrcFiller?2:3)&&x.word.length<=14).sort((a,b)=>(a.mrcFiller?1:0)-(b.mrcFiller?1:0)||a.word.length-b.word.length);
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
       const growth=area-oldArea,fill=(w.word.length-hits)/Math.max(1,growth);
       // Two-letter raccordi only close interior gaps; they never stretch the schema.
       if(w.mrcFiller&&w.word.length===2&&(growth!==0||placed.length<12))continue;
       // Density of *new* area matters more than merely joining at one letter.
       const shortBonus=w.word.length<=9?24:0;
       const themedPlaced=placed.filter(x=>!x.mrcFiller).length;
       const themeBonus=w.mrcFiller?(themedPlaced<Math.min(10,themeCount)?-260:0):135;
       const fillerCompact=w.mrcFiller?(growth===0?(w.word.length===2?175:120):-(growth*4)):0;
       const score=hits*80-growth*(6.6+shift*.22)+fill*22-Math.abs(h-wd)*2.2+shortBonus-(Math.max(0,w.word.length-9)*9)+themeBonus+fillerCompact;
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
 // Multiple deterministic starting points and weighting variations. No server dependency.
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
function chooseWordSearch(input){const words=input.filter(x=>x.word.length<=12).slice(0,8);let last=null;for(let tries=0;tries<8;tries++){const rows=10,cols=15,grid=Array(rows*cols).fill(''),placements=[],dirs=[[1,0],[0,1],[1,1],[-1,1]];for(const pair of words){let placed=false;for(let t=0;t<500&&!placed;t++){const [dc,dr]=dirs[Math.floor(Math.random()*dirs.length)],r=Math.floor(Math.random()*rows),c=Math.floor(Math.random()*cols),er=r+dr*(pair.word.length-1),ec=c+dc*(pair.word.length-1);if(er>=rows||ec>=cols||ec<0)continue;const ids=Array.from({length:pair.word.length},(_,k)=>(r+k*dr)*cols+c+k*dc);if(ids.some((i,k)=>grid[i]&&grid[i]!==pair.word[k]))continue;ids.forEach((i,k)=>grid[i]=pair.word[k]);placements.push({...pair,ids});placed=true}}if(placements.length>=3){for(let i=0;i<grid.length;i++)if(!grid[i])grid[i]='ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.random()*26|0];return {kind:'wordsearch',rows,cols,cells:grid,words:placements}}last=placements}throw Error(say('Non riesco a collocare queste parole.','Unable to place these words.'))}
function readPairs(){pairs=gather();return pairs}
// Native puzzle formats: use the *existing* games, never a separate game renderer.
function crosswordProject(p){
 const rows=Math.max(3,p.rows),cols=Math.max(3,p.cols),blacks=Array(rows*cols).fill(true),clues={},clueSources={};
 for(let r=0;r<p.rows;r++)for(let c=0;c<p.cols;c++)blacks[r*cols+c]=!p.cells[r*p.cols+c];
 for(const w of p.words){
  const pos=w.r*cols+w.c,dir=w.dc?'a':'d';
  if(!blacks[pos]&&w.clue){const key=dir+':'+pos;clues[key]=w.clue;if(w.source)clueSources[key]={name:(new URL(w.source)).hostname,url:w.source}}
 }
 return {version:1,rows,cols,blacks,letters:Array(rows*cols).fill(''),clues,clueSources,ui:{mode:'play',dir:'a',selected:0,lang:it?'it':'en'}};
}
function wordsearchProject(p){return {version:1,type:'wordsearch',data:{words:[...new Set(p.words.map(w=>w.word))].filter(w=>/^[A-Z]{3,12}$/.test(w)).slice(0,16),layout:{grid:p.cells,places:p.words.map(w=>({word:w.word,ids:w.ids})),rows:p.rows,cols:p.cols}}}}
function encode(o){const b=new TextEncoder().encode(JSON.stringify(o));let str='';for(const n of b)str+=String.fromCharCode(n);return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function playPath(kind){return kind==='crossword'?(it?'/it/giochi/cruciverba/':'/games/crossword/'):(it?'/it/giochi/trova-parole/':'/games/wordsearch/')}
function playUrl(kind){const project=kind==='crossword'?crosswordProject(prepared[kind]):wordsearchProject(prepared[kind]);
 return location.origin+playPath(kind)+(kind==='crossword'?'#mrc-crossword='+encode(project):'?challenge='+encode(project));}
function refreshReady(){const available=Object.keys(prepared),section=$('#topic-play-section');section.hidden=!available.length;
 for(const kind of ['crossword','wordsearch']){const b=$('#topic-launch-'+kind);b.hidden=!prepared[kind];if(prepared[kind])b.href=playUrl(kind)}
 $('#topic-ready').textContent=available.length===2?say('Schemi pronti. Apri il gioco desiderato: potrai condividere lo schema dalla partita.','Puzzles ready. Open a game; you can share the puzzle from the game.'):say('Schema pronto. Apri il gioco per utilizzarlo.','Puzzle ready. Open the game to play.');
 const download=$('#topic-native-download');if(download)download.hidden=!prepared.crossword;const wdownload=$('#topic-wordsearch-download');if(wdownload)wdownload.hidden=!prepared.wordsearch;
}
async function prepareGames(review=false){try{if(review)readPairs();else pairs=pairs.filter(eligible);if(pairs.length<3)throw Error(say('Servono almeno tre definizioni valide.','At least three valid clues are required.'));prepared={};const errs=[];for(const [kind,make] of [['crossword',chooseCrossword],['wordsearch',chooseWordSearch]]){try{prepared[kind]=make(kind==='crossword'?[...pairs,...selectFillers(pairs,await loadFillerWords(),78)]:pairs)}catch(e){errs.push(e.message)}}if(!Object.keys(prepared).length)throw Error(errs.join(' · '));refreshReady();$('#topic-play-section').scrollIntoView({behavior:'smooth',block:'start'});tell(errs.length?say('Non tutti gli schemi sono stati generati: ','Some puzzles could not be created: ')+errs.join(' · '):'')}catch(e){tell(e.message)}}
$('#topic-validate').addEventListener('click',()=>prepareGames(true));$('#topic-trust')?.addEventListener('click',()=>prepareGames(false));$('#topic-review')?.addEventListener('click',()=>{const panel=$('#topic-review-panel');panel.hidden=false;$('#topic-rows').replaceChildren();pairs.forEach(addRow);panel.scrollIntoView({behavior:'smooth',block:'nearest'})});
function downloadJSON(data,name){const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
const dl=$('#topic-native-download');if(dl)dl.addEventListener('click',()=>{if(prepared.crossword)downloadJSON(crosswordProject(prepared.crossword),'mrc-cruciverba')});const wd=$('#topic-wordsearch-download');if(wd)wd.addEventListener('click',()=>{if(prepared.wordsearch)downloadJSON(wordsearchProject(prepared.wordsearch),'mrc-trova-parole')});
function validate(o){if(!o||o.mrcTopicGame!==1||o.version!==1||!Array.isArray(o.pairs)||o.pairs.length<3||o.pairs.length>24||!o.pairs.every(eligible))throw Error(say('Raccolta non valida.','Invalid collection.'));const p=o.puzzle;if(!p||!['crossword','wordsearch'].includes(p.kind)||!Number.isInteger(p.rows)||!Number.isInteger(p.cols)||p.rows<1||p.cols<1||p.rows>25||p.cols>25||!Array.isArray(p.cells)||p.cells.length!==p.rows*p.cols||!Array.isArray(p.words)||p.words.length<3||p.words.length>24)throw Error(say('Schema non valido.','Invalid puzzle.'));return o}
function load(o){validate(o);pairs=o.pairs;$('#topic-query').value=o.topic||'';$('#topic-rows').replaceChildren();$('#topic-review-panel').hidden=true;$('#topic-count').textContent=say(`${pairs.length} definizioni importate.`,`${pairs.length} clues imported.`);$('#topic-edit-section').hidden=false;prepared={[o.puzzle.kind]:o.puzzle};refreshReady();tell(say('Raccolta importata. Puoi aprire il gioco o prepararne entrambi.','Collection imported. Open the game or prepare both games.'))}
async function importFile(f){if(!f)return;try{if(f.size>150000)throw Error(say('File troppo grande.','File too large.'));load(JSON.parse(await f.text()))}catch(e){tell(e.message)}}
['#topic-upload','#topic-upload-first'].forEach(id=>$(id)?.addEventListener('change',e=>{importFile(e.target.files[0]);e.target.value=''}));
})();
