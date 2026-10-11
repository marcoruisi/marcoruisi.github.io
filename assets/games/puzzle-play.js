(()=>{'use strict';const kit=window.MRCPuzzleKit,root=document.querySelector('[data-mrc-puzzle]');if(!kit||!root)return;const type=root.dataset.mrcPuzzle,it=document.documentElement.lang==='it',$=s=>root.querySelector(s);let data=kit.challenge(),current=null,tries=0,found=new Set(),selection=[],selected=-1;const defaults={mastermind:{version:1,type,data:{code:Array.from({length:4},()=>1+Math.floor(Math.random()*6)).join('')}},sequences:{version:1,type,data:{start:3+Math.floor(Math.random()*12),step:1+Math.floor(Math.random()*7),count:6}},wordsearch:{version:1,type,data:{words:it?['LUNA','SOLE','FIUME','BOSCO','VENTO','MARE']:['MOON','SUN','RIVER','FOREST','WIND','OCEAN']}}};
// Piccoli vocabolari locali: nessuna rete, nessun dizionario scaricato.
const wordBanks={
 it:['LUNA','SOLE','FIUME','BOSCO','VENTO','MARE','NUVOLA','STELLA','PIANTA','FIORE','ALBERO','ERBA','MONTAGNA','COLLINA','VALLE','LAGO','ISOLA','SPIAGGIA','SABBIA','PIOGGIA','NEVE','GHIACCIO','FOGLIA','RADICE','FRUTTO','SEME','RAMO','PIETRA','ROCCIA','FUOCO','TERRA','CIELO','AQUILA','GUFO','CIVETTA','VOLPE','LUPO','ORSO','CERVO','TIGRE','LEONE','GATTO','CANE','DELFINO','BALENA','SQUALO','PESCE','TARTARUGA','FARFALLA','FORMICA','APE','RANA','SERPENTE','GRANCHIO','POLPO','CORALLO','PONTE','TORRE','PIAZZA','STRADA','SCUOLA','LIBRO','PAGINA','MATITA','PENNA','COLORE','MUSICA','PIANO','CHITARRA','VIOLINO','TEATRO','CINEMA','QUADRO','PITTORE','STORIA','TEMPO','OROLOGIO','VIAGGIO','TRENO','BARCA','AEREO','BICICLETTA','SPORT','CORSA','SALTO','GIOCO','ENIGMA','LOGICA','NUMERO','LETTERA','PAROLA'],
 en:['MOON','SUN','RIVER','FOREST','WIND','OCEAN','CLOUD','STAR','PLANT','FLOWER','TREE','GRASS','MOUNTAIN','HILL','VALLEY','LAKE','ISLAND','BEACH','SAND','RAIN','SNOW','ICE','LEAF','ROOT','FRUIT','SEED','BRANCH','STONE','ROCK','FIRE','EARTH','SKY','EAGLE','OWL','FOX','WOLF','BEAR','DEER','TIGER','LION','CAT','DOG','DOLPHIN','WHALE','SHARK','FISH','TURTLE','BUTTERFLY','ANT','BEE','FROG','SNAKE','CRAB','OCTOPUS','CORAL','BRIDGE','TOWER','SQUARE','ROAD','SCHOOL','BOOK','PAGE','PENCIL','PEN','COLOR','MUSIC','PIANO','GUITAR','VIOLIN','THEATER','CINEMA','PAINTING','ARTIST','HISTORY','TIME','CLOCK','TRAVEL','TRAIN','BOAT','PLANE','BICYCLE','SPORT','RUNNING','JUMP','GAME','RIDDLE','LOGIC','NUMBER','LETTER','WORD']
};
const kidsBanks={
 it:['SOLE','LUNA','CANE','GATTO','MARE','FIORE','CASA','MELA','PANE','NASO','MANO','RANA','APE','ORSO','PESCE','ERBA','LIBRO','LATTE','PALLA','TRENO','NEVE','UOVO','LEONE','TOPO','BARCA','ISOLA','FIUME','CUORE','SCUOLA','GIOCO','FOGLIA','NUVOLA'],
 en:['SUN','MOON','DOG','CAT','SEA','TREE','HOME','APPLE','BREAD','NOSE','HAND','FROG','BEE','BEAR','FISH','GRASS','BOOK','MILK','BALL','TRAIN','SNOW','EGG','LION','MOUSE','BOAT','ISLAND','RIVER','HEART','SCHOOL','GAME','LEAF','CLOUD']
};
let wordsearchLevel=(()=>{try{return localStorage.getItem('mrc-wordsearch-level')==='kids'?'kids':'classic'}catch{return 'classic'}})();
let lastGeneratedWords=[];
const WORDSEARCH_SIZES={small:{rows:8,cols:10},medium:{rows:10,cols:15},large:{rows:12,cols:18}};
let wordsearchSize=(()=>{try{const v=localStorage.getItem('mrc-wordsearch-size');return WORDSEARCH_SIZES[v]?v:(wordsearchLevel==='kids'?'small':'medium')}catch{return wordsearchLevel==='kids'?'small':'medium'}})();
function gridSize(){return WORDSEARCH_SIZES[wordsearchSize].cols}

// An active game registers one resize listener; remove it before rendering a new board.
let removeWordsearchOrientation=null;
function portraitViewport(){return window.innerHeight>window.innerWidth}

function freshWords(){
 const pool=(wordsearchLevel==='kids'?kidsBanks:wordBanks)[it?'it':'en'],shuffled=pool.slice();
 for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
 const different=shuffled.filter(w=>!lastGeneratedWords.includes(w));
 const limit=gridSize(),count=8;
 const eligible=different.filter(w=>w.length<=limit);
 const fallback=shuffled.filter(w=>w.length<=limit);
 const chosen=(eligible.length>=count?eligible:fallback).slice(0,count);
 lastGeneratedWords=chosen.slice();
 return chosen;
}
function finish(title,detail){kit.finishPanel(root,{title,detail,label:it?'Nuova partita':'New game',restart:()=>{if(type==='wordsearch'){root.querySelector('.new-words')?.click()}else $('.restart').click()}})}
function setStatus(s){$('.puzzle-status').textContent=s}function setup(){document.body.classList.toggle('mrc-kids-mode',type==='wordsearch'&&wordsearchLevel==='kids'&&!data);if(removeWordsearchOrientation){removeWordsearchOrientation();removeWordsearchOrientation=null}kit.hideFinish(root);current=data&&data.type===type&&kit.validate(data)?data:defaults[type];const d=current?.data;root.querySelector('.puzzle-area').replaceChildren();tries=0;found=new Set();selection=[];setStatus('');if(type==='mastermind')mastermind(d);else if(type==='sequences')sequences(d);else if(type==='wordsearch')wordsearch(d)}function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);return b}
function mastermind(d){const area=$('.puzzle-area');const explain=document.createElement('div');explain.className='codebreaker-instructions';const heading=document.createElement('strong');heading.textContent=it?'Come si gioca':'How to play';const text=document.createElement('p');text.textContent=it?'Il codice ha 4 cifre da 1 a 6 (possono ripetersi). Prova una combinazione: dopo ogni tentativo saprai quante cifre sono giuste nella posizione giusta e quante sono giuste ma nella posizione sbagliata. Usa questi indizi per il tentativo successivo. Hai 12 tentativi.':'The code has 4 digits from 1 to 6 (repeats are allowed). Try a combination: after each guess you will learn how many digits are correct and in the right position, and how many are correct but in the wrong position. Use these clues to refine your next guess. You have 12 guesses.';const example=document.createElement('p');example.className='codebreaker-example';example.textContent=it?'Esempio: codice 1234, tentativo 1523 → 1 cifra al posto giusto (1), 2 cifre al posto sbagliato (2 e 3).':'Example: code 1234, guess 1523 → 1 digit in the right place (1), 2 digits in the wrong place (2 and 3).';explain.append(heading,text,example);area.append(explain);const form=document.createElement('form');form.className='puzzle-input-row';const inp=document.createElement('input');inp.inputMode='numeric';inp.maxLength=4;inp.pattern='[1-6]{4}';inp.required=true;inp.setAttribute('aria-label',it?'Tentativo di quattro cifre':'Four-digit guess');const submit=button(it?'Prova combinazione':'Try combination',()=>form.requestSubmit());form.append(inp,submit);area.append(form);const title=document.createElement('strong');title.textContent=it?'Tentativi e indizi':'Guesses and clues';area.append(title);const log=document.createElement('ol');log.className='codebreaker-history';area.append(log);form.addEventListener('submit',e=>{e.preventDefault();const guess=inp.value;if(!/^[1-6]{4}$/.test(guess)){setStatus(it?'Inserisci quattro cifre da 1 a 6.':'Enter four digits from 1 to 6.');return}tries++;let exact=0,usedCode=[],usedGuess=[];for(let i=0;i<4;i++)if(guess[i]===d.code[i])exact++;else{usedCode.push(d.code[i]);usedGuess.push(guess[i])}let misplaced=0;for(const n of usedGuess){const idx=usedCode.indexOf(n);if(idx>=0){misplaced++;usedCode.splice(idx,1)}}const li=document.createElement('li');const digits=document.createElement('strong');digits.textContent=guess;const clue=document.createElement('span');clue.textContent=it?`✓ ${exact} al posto giusto · ↔ ${misplaced} giuste, posto sbagliato`:`✓ ${exact} right place · ↔ ${misplaced} correct digits, wrong place`;li.append(digits,clue);log.prepend(li);inp.value='';inp.focus();if(exact===4){setStatus(it?`Risolto in ${tries} tentativi!`:`Solved in ${tries} guesses!`);inp.disabled=true;submit.disabled=true;finish(it?'Codice scoperto!':'Code cracked!',it?`Hai indovinato in ${tries} tentativi.`:`You cracked the code in ${tries} guesses.`)}else if(tries>=12){setStatus((it?'Tentativi terminati. Codice: ':'No tries left. Code: ')+d.code);inp.disabled=true;submit.disabled=true;finish(it?'Tentativi esauriti':'No guesses left',it?`Il codice era ${d.code}. Riprova con una nuova sfida.`:`The code was ${d.code}. Try a new challenge.`)}else setStatus(it?`Tentativo ${tries}/12: usa gli indizi per scegliere il prossimo codice.`:`Guess ${tries}/12: use the clues to choose your next code.`)})}
function sequences(d){const area=$('.puzzle-area'),seq=document.createElement('p');seq.className='sequence-display';seq.textContent=Array.from({length:d.count},(_,i)=>d.start+i*d.step).join(' · ')+' · ?';area.append(seq);const form=document.createElement('form');form.className='puzzle-input-row';const input=document.createElement('input');input.type='number';input.required=true;input.placeholder=it?'Numero successivo':'Next number';form.append(input,button(it?'Controlla':'Check',()=>form.requestSubmit()));area.append(form);form.addEventListener('submit',e=>{e.preventDefault();tries++;const ans=d.start+d.step*d.count;if(Number(input.value)===ans){setStatus(it?'Giusto!':'Correct!');input.disabled=true;finish(it?'Sequenza completata!':'Sequence completed!',it?'Hai individuato la regola. Pronto per un’altra?':'You found the pattern. Ready for another?')}else setStatus(it?'Riprova.':'Try again.')})}
function wordsearch(d){
 const area=$('.puzzle-area'),words=[...new Set(d.words)],kids=wordsearchLevel==='kids'&&!data,size=WORDSEARCH_SIZES[wordsearchSize],cols=Math.max(size.cols,...words.map(w=>w.length)),rows=size.rows;
 const levelRow=document.createElement('div');levelRow.className='wordsearch-layout wordsearch-level';
 const levelLabel=document.createElement('span');levelLabel.textContent=it?'Modalità:':'Mode:';levelRow.append(levelLabel);
 for(const [key,label] of [['classic',it?'Classico':'Classic'],['kids',it?'Bambini':'Kids']]){
   const b=button(label,()=>{
     if(wordsearchLevel===key)return;
     wordsearchLevel=key;wordsearchSize=key==='kids'?'small':'medium';try{localStorage.setItem('mrc-wordsearch-level',key);localStorage.setItem('mrc-wordsearch-size',wordsearchSize)}catch{}
     if(data){data=null}
     defaults.wordsearch.data.words=freshWords();setup();
   });
   b.className='wordsearch-layout-option';b.setAttribute('aria-pressed',String(wordsearchLevel===key));levelRow.append(b);
 }
 area.append(levelRow);
 const sizeRow=document.createElement('div');sizeRow.className='wordsearch-layout wordsearch-size';
 const sizeLabel=document.createElement('span');sizeLabel.textContent=it?'Griglia:':'Grid:';sizeRow.append(sizeLabel);
 for(const [key,label] of [['small',it?'Piccolo':'Small'],['medium',it?'Medio':'Medium'],['large',it?'Grande':'Large']]){
   const b=button(label,()=>{
     if(wordsearchSize===key)return;
     wordsearchSize=key;try{localStorage.setItem('mrc-wordsearch-size',key)}catch{}
     data=null;defaults.wordsearch.data.words=freshWords();setup();
   });
   b.className='wordsearch-layout-option';b.setAttribute('aria-pressed',String(wordsearchSize===key));
   b.setAttribute('aria-label',label+' '+WORDSEARCH_SIZES[key].cols+'×'+WORDSEARCH_SIZES[key].rows);
   sizeRow.append(b);
 }
 area.append(sizeRow);
 const w=kit.wordsearch(words,{rows,cols});
  const wrap=document.createElement('div');wrap.className='wordsearch-grid wordsearch-rect';
  const cells=[];
  let lastPortrait=null;
  function updateOrientation(){
    const portrait=portraitViewport();
    if(portrait===lastPortrait)return;
    lastPortrait=portrait;
    wrap.classList.toggle('wordsearch-portrait',portrait);
    wrap.classList.toggle('wordsearch-landscape',!portrait);
    wrap.classList.toggle('wordsearch-kids',kids);wrap.dataset.size=wordsearchSize;
    wrap.style.gridTemplateColumns=`repeat(${portrait?rows:cols},minmax(0,1fr))`;
    const order=[];
    if(portrait){for(let x=0;x<cols;x++)for(let y=0;y<rows;y++)order.push(y*cols+x)}
    else {for(let i=0;i<w.grid.length;i++)order.push(i)}
    // DOM buttons keep their original indices and state when transposed.
    wrap.append(...order.map(i=>cells[i]));
  }
  const orientationNote=document.createElement('p');orientationNote.className='wordsearch-layout-note';
  orientationNote.textContent=kids?(it?'8 parole da trovare. La modalità Bambini non mostra richieste di contributo.':'Find 8 words. Kids mode has no donation requests.'):(it?'La griglia segue automaticamente la rotazione dello schermo, senza perdere i progressi.':'The grid automatically follows screen rotation without losing your progress.');
  area.append(orientationNote);
 const instruction=document.createElement('p');instruction.className='wordsearch-instructions';instruction.innerHTML=it?'<strong>Come si gioca:</strong> clicca la <strong>prima lettera</strong> di una parola e poi la <strong>ultima lettera</strong>. Non occorre cliccare le lettere intermedie.':'<strong>How to play:</strong> select the <strong>first letter</strong> of a word, then its <strong>last letter</strong>. You do not need to click the letters in between.';
 const clue=document.createElement('p');clue.className='wordsearch-word-list';const wordLabels=new Map();
 for(const [i,word] of words.entries()){if(i)clue.append(document.createTextNode(' · '));const label=document.createElement('span');label.textContent=word;wordLabels.set(word,label);clue.append(label)}
 area.append(instruction,clue,wrap);
 for(const [i,char] of w.grid.entries()){
   const b=button(char,()=>{
     if(selected<0){selected=i;selection=[i];b.classList.add('selected');setStatus(it?'Prima lettera selezionata. Ora clicca l’ultima lettera.':'First letter selected. Now click the last letter.');return}
     if(i===selected){b.classList.remove('selected');selected=-1;selection=[];setStatus(it?'Selezione annullata.':'Selection cleared.');return}
     const a=selected,ax=a%cols,ay=Math.floor(a/cols),bx=i%cols,by=Math.floor(i/cols),dx=Math.sign(bx-ax),dy=Math.sign(by-ay),steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));const ids=[];
     if(dx===0||dy===0||Math.abs(bx-ax)===Math.abs(by-ay)){for(let j=0;j<=steps;j++)ids.push((ay+j*dy)*cols+ax+j*dx)}
     const match=w.places.find(p=>!found.has(p.word)&&(p.ids.join(',')===ids.join(',')||p.ids.slice().reverse().join(',')===ids.join(',')));
     if(match){found.add(match.word);wordLabels.get(match.word)?.classList.add('is-found');for(const index of ids)cells[index].classList.add('found');setStatus((it?'Trovata: ':'Found: ')+match.word)}
     else setStatus(it?'Non corrisponde: seleziona prima e ultima lettera.':'Not a match: select first and last letter.');
     for(const cell of cells)cell.classList.remove('selected');selected=-1;selection=[];
     if(w.places.length>0&&found.size===w.places.length){setStatus(it?'Tutte le parole trovate!':'All words found!');finish(it?'Tutte le parole trovate!':'All words found!',it?`Hai trovato tutte e ${found.size} le parole. Vuoi cercarne altre?`:`You found all ${found.size} words. Ready for new ones?`)}
   });
   b.setAttribute('aria-label',`${char}, ${Math.floor(i/cols)+1}, ${i%cols+1}`);cells.push(b);
 }
 // Build the grid before changing its DOM order. Keep one resize listener
 // so rotating the device transposes the same board, without resetting progress.
 updateOrientation();
 window.addEventListener('resize',updateOrientation,{passive:true});
 removeWordsearchOrientation=()=>window.removeEventListener('resize',updateOrientation);
 if(w.places.length<words.length)setStatus(it?'Alcune parole non sono entrate: prova una nuova griglia.':'Some words did not fit: try a new grid.');
}

if(type==='wordsearch'){
 const restart=$('.restart');
 restart.textContent=it?'Rimescola griglia':'Shuffle grid';
 const fresh=button(it?'Nuove parole':'New words',()=>{
   data=null;defaults.wordsearch.data.words=freshWords();setup();
 });
 fresh.className='new-words';
 restart.insertAdjacentElement('afterend',fresh);
 // Una nuova visita propone parole varie, non sempre le stesse sei.
 if(!data){defaults.wordsearch.data.words=freshWords()}
}
kit.attachGameShare(root,()=>{const d=current?.data;if(!d)return null;return {version:1,type,data:JSON.parse(JSON.stringify(d))}},it);$('.restart').addEventListener('click',()=>{if(!data||!new URLSearchParams(location.search).has('challenge')){if(type==='mastermind')defaults.mastermind.data.code=Array.from({length:4},()=>1+Math.floor(Math.random()*6)).join('');if(type==='sequences'){defaults.sequences.data.start=1+Math.floor(Math.random()*20);defaults.sequences.data.step=1+Math.floor(Math.random()*8)} }setup()});const input=$('.load-json');input.addEventListener('change',async()=>{try{const o=await kit.readFile(input.files[0]);if(o.type!==type||!kit.validate(o))throw Error('wrong puzzle');data=o;setup()}catch{setStatus(it?'File non valido per questo gioco.':'Invalid file for this game.')}});setup();})();
