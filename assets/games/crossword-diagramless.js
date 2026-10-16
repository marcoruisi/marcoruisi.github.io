/* Diagramless play: the reference layout is never used for cursor movement. */
(()=>{'use strict';
window.MRCDiagramless={create({getState,save,render,focus}){
 const $=id=>document.getElementById(id),it=document.documentElement.lang==='it',say=(a,b)=>it?a:b;
 const chooser=document.createElement('label');chooser.className='mrc-cw-variant';
 chooser.append(document.createTextNode(say('Modalità di gioco ','Game mode ')));
 const mode=document.createElement('select');mode.id='cwVariant';
 for(const [value,label] of [['classic',say('Classico','Classic')],['diagramless',say('Senza schema','Diagramless')]]){const o=document.createElement('option');o.value=value;o.textContent=label;mode.append(o)}chooser.append(mode);
 const help=document.createElement('p');help.className='muted';help.textContent=say('Senza schema: inserisci lettere e caselle nere. Le definizioni sono riordinate per riga e colonna e il contatore indica quante nere collocare. I file con schema sconosciuto si giocano solo senza schema. La modalità si applica al prossimo cruciverba aperto; le partite salvate conservano la loro.','Diagramless: enter letters and black squares. Clues are reordered by row and column; the counter shows how many black squares to place. Files with an unknown layout can only be played diagramless. The mode applies to the next puzzle opened; saved games keep their mode.');
 $('startScreen').querySelector('.start-actions').before(chooser,help);
 const controls=document.createElement('div');controls.className='mrc-diagramless-controls';controls.hidden=true;
 const black=document.createElement('button');black.type='button';black.textContent=say('■ Nera / bianca','■ Black / white');black.setAttribute('aria-pressed','false');
 const check=document.createElement('button');check.type='button';check.textContent=say('Verifica nere','Check black squares');
 const hint=document.createElement('p');hint.className='hint';hint.textContent=say('Seleziona una casella e usa ■ (oppure # da tastiera). Per correggere, ripremi ■ o scrivi una lettera. Le definizioni seguono l’ordine da sinistra a destra e dall’alto in basso.','Select a square and press ■ (or # on your keyboard). Press ■ again or type a letter to correct it. Clues follow left-to-right and top-to-bottom order.');
 controls.append(black,check,hint);$('currentClue').before(controls);
 const total=s=>s.layoutKnown===false?s.blackCount:s.blacks.filter(Boolean).length;
 const active=()=>getState().variant==='diagramless'&&getState().ui.mode==='play';
 const marks=()=>{const s=getState();return s.diagramlessBlacks||(s.diagramlessBlacks=Array(s.rows*s.cols).fill(false))};
 function commit(){render();save();focus()}
 function select(i,dir){const s=getState();if(!Number.isInteger(i)||i<0||i>=s.rows*s.cols)return;s.ui.selected=i;if(dir)s.ui.dir=dir;commit()}
 function next(delta,skip=false){const s=getState(),i=s.ui.selected,step=s.ui.dir==='d'?s.cols:1;let j=i+delta*step;while(j>=0&&j<s.rows*s.cols&&(s.ui.dir==='d'||Math.floor(j/s.cols)===Math.floor(i/s.cols))){if(!skip||!marks()[j])return j;j+=delta*step}return i}
 function toggle(){const s=getState(),i=s.ui.selected;marks()[i]=!marks()[i];s.letters[i]='';$('message').textContent='';commit()}
 black.onclick=toggle;
 check.onclick=()=>{const s=getState();if(s.layoutKnown===false)return;const errors=s.blacks.reduce((n,b,i)=>n+(b!==marks()[i]),0);$('message').textContent=errors?say('Lo schema delle nere non coincide ancora. Puoi continuare a correggerlo.','The black-square layout does not match yet. You can keep correcting it.'):say('Le caselle nere sono tutte corrette. Le lettere non sono state verificate.','All black squares are correct. Letters have not been checked.')};
 function letter(value){const s=getState(),v=[...String(value).normalize('NFC').toLocaleUpperCase()][0]||'';if(!/[\p{L}\p{N}]/u.test(v))return;marks()[s.ui.selected]=false;s.letters[s.ui.selected]=v;s.ui.selected=next(1,true);$('message').textContent='';commit()}
 function erase(back=false){const s=getState();let i=s.ui.selected;if(back&&!marks()[i]&&!s.letters[i]){i=next(-1);s.ui.selected=i}marks()[i]=false;s.letters[i]='';$('message').textContent='';commit()}
 function keydown(ev){const s=getState();if(ev.ctrlKey||ev.metaKey||ev.altKey)return;
  if(ev.key==='#'){ev.preventDefault();toggle()}
  else if(ev.key==='Backspace'||ev.key==='Delete'){ev.preventDefault();erase(ev.key==='Backspace')}
  else if(ev.key==='Tab'){ev.preventDefault();select(s.ui.selected,s.ui.dir==='a'?'d':'a')}
  else if(ev.key.startsWith('Arrow')){ev.preventDefault();const d=ev.key==='ArrowUp'||ev.key==='ArrowDown'?'d':'a';s.ui.dir=d;select(next(ev.key==='ArrowLeft'||ev.key==='ArrowUp'?-1:1))}
  else if(ev.key.length===1&&/[\p{L}\p{N}]/u.test(ev.key)){ev.preventDefault();letter(ev.key)}
 }
 function renderClues(entries,dir,line,host){
  const s=getState(),group=entries.filter(e=>e.dir===dir&&(dir==='a'?Math.floor(e.start/s.cols):e.start%s.cols)===line);
  const label=say(dir==='a'?'Riga ':'Colonna ',dir==='a'?'Row ':'Column ')+(line+1);
  const title=document.createElement('strong');title.textContent=label;host.append(title);
  const texts=s.layoutKnown===false?s.orderedClues[dir][line]:group.map(e=>s.clues[e.key]||say('Definizione non disponibile','Clue unavailable'));
  if(!texts.length){const p=document.createElement('p');p.textContent=say('Nessuna definizione.','No clues.');host.append(p);return}
  const list=document.createElement('ol');for(let k=0;k<texts.length;k++){const item=document.createElement('li');item.textContent=texts[k];const src=s.layoutKnown===false?null:s.clueSources?.[group[k].key];if(src){const a=document.createElement(src.url?'a':'span');a.textContent=' · '+src.name;if(src.url){a.href=src.url;a.target='_blank';a.rel='noopener noreferrer'}item.append(a)}list.append(item)}host.append(list);
 }
 function draw(entries){
  const s=getState(),m=marks(),row=Math.floor(s.ui.selected/s.cols),col=s.ui.selected%s.cols;controls.hidden=false;check.hidden=s.layoutKnown===false;
  for(const id of ['dimensions','buildPanel','clueEdit','bulkBox'])$(id).classList.add('hidden');$('playArea').classList.remove('hidden');
  $('buildHelp').textContent='';$('mrcClueSource').replaceChildren();$('selectionInfo').textContent='';
  $('selectionTitle').textContent=say('Senza schema · ','Diagramless · ')+say('riga ','row ')+(row+1)+say(', colonna ', ', column ')+(col+1);
  for(const [id,d] of [['across','a'],['down','d']]){$(id).disabled=false;$(id).setAttribute('aria-pressed',String(s.ui.dir===d))}
  black.setAttribute('aria-pressed',String(m[s.ui.selected]));
  $('currentClue').replaceChildren();renderClues(entries,s.ui.dir,s.ui.dir==='a'?row:col,$('currentClue'));
  const frag=document.createDocumentFragment();
  for(let i=0;i<s.rows*s.cols;i++){
   const b=document.createElement('button');b.type='button';b.dataset.index=i;b.className='cell'+(m[i]?' black':'')+(i===s.ui.selected?' current':'');
   b.setAttribute('aria-label',say('Riga ','Row ')+(Math.floor(i/s.cols)+1)+say(', colonna ', ', column ')+(i%s.cols+1)+(m[i]?say(', nera',', black'):', '+(s.letters[i]||say('vuota','empty'))));
   if(!m[i]){const ch=document.createElement('span');ch.className='char';ch.textContent=s.letters[i];b.append(ch)}frag.append(b);
  }
  $('board').replaceChildren(frag);$('board').style.gridTemplateColumns=`repeat(${s.cols},minmax(0,1fr))`;
  $('status').textContent=say('Lettere: ','Letters: ')+s.letters.filter((v,i)=>v&&!m[i]).length+say(' · Nere inserite: ',' · Black squares placed: ')+m.filter(Boolean).length+' / '+total(s)+(m.filter(Boolean).length>total(s)?say(' · Troppe nere',' · Too many black squares'):'')+(s.layoutKnown===false?say(' · Schema libero: verifica non disponibile',' · Free grid: checking unavailable'):'');
  const list=document.createDocumentFragment();
  for(const dir of ['a','d']){const h=document.createElement('h3');h.textContent=say(dir==='a'?'Orizzontali':'Verticali',dir==='a'?'Across':'Down');list.append(h);for(let l=0;l<(dir==='a'?s.rows:s.cols);l++){const box=document.createElement('section');renderClues(entries,dir,l,box);list.append(box)}}
  $('wordList').replaceChildren(list);
 }
 function sync(){const on=active();controls.hidden=!on;document.body.classList.toggle('mrc-diagramless',on);const description=$('mrc-cw-clear-description');if(description)description.textContent=on?say('Verranno cancellate lettere e caselle nere inserite. Il cruciverba resterà lo stesso.','Entered letters and black squares will be cleared. The puzzle will stay the same.'):say('Verranno cancellate tutte le lettere inserite. Il cruciverba resterà lo stesso.','All entered letters will be removed. The crossword will stay the same.')}
 $('fresh').addEventListener('click',sync);
 return {active,sync,render:draw,select,letter,erase,keydown,toggle,advance:n=>select(next(n)),prepare(s,{saved=false}={}){if(!saved&&s.layoutKnown!==false){if(mode.value==='diagramless'){s.variant='diagramless';s.diagramlessBlacks=Array(s.rows*s.cols).fill(false);s.letters.fill('');s.ui.selected=0}else{delete s.variant;delete s.diagramlessBlacks}}return s},clear(){if(active())marks().fill(false)}};
}};
})();
