/* MRC Crossword mobile workspace: game-only touch UI. */
(()=>{'use strict';
 const body=document.body;
 if(!body.classList.contains('mrc-crossword-game'))return;
 const board=document.getElementById('board'),wrap=document.querySelector('.layout .board-wrap');
 const layout=document.querySelector('main > .layout');
 const playArea=document.getElementById('playArea');
 if(!board||!wrap||!layout||!playArea)return;
 const it=document.documentElement.lang.startsWith('it');
 const mq=window.matchMedia('(max-width:800px) and (pointer:coarse)');
 let cell=42,cols=15,pinch=null;
 const bar=document.createElement('div');bar.className='mrc-cw-board-bar';
 const exit=document.createElement('a');exit.href=it?'/it/giochi/':'/games/';exit.textContent=it?'← Giochi':'← Games';
 const buttons=document.createElement('div');buttons.className='mrc-cw-zoom-buttons';
 const originalAcross=document.getElementById('across'),originalDown=document.getElementById('down');
 const originalKeyboard=document.getElementById('mobileKeyboard');
 const originalKeys=document.getElementById('kbd');
 const erase=document.getElementById('erase');
 const letterInput=document.getElementById('letter');
 const topButtons=[];
 for(const [target,symbol,name] of [[originalAcross,'→',it?'Orizzontale':'Across'],[originalDown,'↓',it?'Verticale':'Down']]){
  const button=document.createElement('button');button.type='button';button.textContent=symbol;
  button.setAttribute('aria-label',name);button.addEventListener('click',()=>target?.click());buttons.append(button);topButtons.push(button);
 }
 // Compact keyboard lives with the clue, not in the toolbar above the grid.
 const cluePanel=layout.querySelector('aside.panel');
 const clueHeader=document.createElement('div');clueHeader.className='mrc-cw-clue-header';
 const keyboard=document.createElement('button');keyboard.type='button';keyboard.className='mrc-cw-clue-keyboard-toggle';
 keyboard.setAttribute('aria-label',it?'Mostra tastiera':'Show keyboard');
 keyboard.setAttribute('aria-expanded','false');
 keyboard.innerHTML='<svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="20" height="15" rx="2"/><path d="M5 8h1m2 0h1m2 0h1m2 0h1m2 0h1M5 11h1m2 0h1m2 0h1m2 0h1m2 0h1M7 15h10"/></svg>';
 clueHeader.append(keyboard);cluePanel.insertBefore(clueHeader,playArea);
 const customKeyboard=document.createElement('div');customKeyboard.className='mrc-cw-mini-keyboard';
 customKeyboard.id='mrc-cw-mini-keyboard';customKeyboard.hidden=true;
 for(const letters of ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']){
  const row=document.createElement('div');row.className='mrc-cw-mini-row';
  for(const c of letters){const key=document.createElement('button');key.type='button';key.textContent=c;key.dataset.key=c;key.setAttribute('aria-label',c);row.append(key)}
  if(letters==='ZXCVBNM'){
   const del=document.createElement('button');del.type='button';del.className='mrc-cw-mini-delete';del.textContent='⌫';
   del.setAttribute('aria-label',it?'Cancella lettera':'Delete letter');del.dataset.erase='true';row.append(del);
  }
  customKeyboard.append(row);
 }
 cluePanel.append(customKeyboard);
 let keyboardOpen=false;
 function setKeyboard(open){
  keyboardOpen=!!open;customKeyboard.hidden=!keyboardOpen;
  keyboard.setAttribute('aria-expanded',String(keyboardOpen));
  keyboard.setAttribute('aria-label',keyboardOpen?(it?'Nascondi tastiera':'Hide keyboard'):(it?'Mostra tastiera':'Show keyboard'));
  body.classList.toggle('mrc-cw-mini-open',keyboardOpen&&mq.matches&&body.classList.contains('game-ready'));
  if(letterInput&&document.activeElement===letterInput)letterInput.blur();
 }
 keyboard.addEventListener('click',()=>setKeyboard(!keyboardOpen));
 // Reuse the existing game engine and its event handlers, without focusing an input.
 customKeyboard.addEventListener('click',ev=>{
  const key=ev.target.closest('button');if(!key)return;
  if(key.dataset.erase)erase?.click();
  else if(key.dataset.key)originalKeys?.querySelector(`[data-letter="${key.dataset.key}"]`)?.click();
 });
 // Prevent Safari/Android from opening a native soft keyboard in this game.
 if(letterInput){letterInput.readOnly=true;letterInput.setAttribute('inputmode','none');
  letterInput.addEventListener('focus',()=>{if(mq.matches)letterInput.blur()});}
 bar.append(exit,buttons);wrap.parentElement.insertBefore(bar,wrap);
 const status=document.getElementById('status'),selectedTitle=document.getElementById('selectionTitle');
 const info=document.createElement('div');info.className='mrc-cw-info-row';
 const word=document.createElement('span');word.className='mrc-cw-word-info';
 if(status){status.parentElement.insertBefore(info,status);info.append(word,status);}
 function syncControls(){
  topButtons.forEach((b,i)=>{const original=i===0?originalAcross:originalDown;
   b.disabled=!!original?.disabled;b.setAttribute('aria-pressed',original?.getAttribute('aria-pressed')||'false');});
  body.classList.remove('mrc-cw-keyboard-open');
  body.classList.toggle('mrc-cw-mini-open',keyboardOpen&&mq.matches&&body.classList.contains('game-ready')); 
  const label=selectedTitle?.textContent||'';
  const match=label.match(/^(\d+)\s*([→↓])\s*·\s*(\d+)/);
  word.textContent=match?`${match[1]} ${match[2]} · ${match[3]} ${it?'lettere':'letters'}`:'';
 }
 function updateViewport(){
  const viewport=window.visualViewport;
  body.style.setProperty('--mrc-cw-vh',(viewport?.height||window.innerHeight)+'px');
  body.style.setProperty('--mrc-cw-top',(viewport?.offsetTop||0)+'px');
 }
 function updateColumns(){
  const match=board.style.gridTemplateColumns.match(/repeat\(\s*(\d+)/);
  if(match)cols=Math.max(1,Math.min(30,+match[1]));
  body.style.setProperty('--mrc-cw-cols',String(cols));
  body.style.setProperty('--mrc-cw-board-width',(cols*cell)+'px');
 }
 function zoomTo(next){
  const old=cell;cell=Math.max(30,Math.min(76,Math.round(next)));
  if(old===cell)return;
  const centerX=wrap.scrollLeft+wrap.clientWidth/2,centerY=wrap.scrollTop+wrap.clientHeight/2;
  body.style.setProperty('--mrc-cw-cell',cell+'px');
  body.style.setProperty('--mrc-cw-board-width',(cols*cell)+'px');
  const ratio=cell/old;
  wrap.scrollLeft=centerX*ratio-wrap.clientWidth/2;
  wrap.scrollTop=centerY*ratio-wrap.clientHeight/2;
 }
 function selectedCell(){return board.querySelector('.cell.current')}
 function centerSelection(){
  if(!mq.matches)return;
  const el=selectedCell();if(!el)return;
  const x=el.offsetLeft+el.offsetWidth/2,y=el.offsetTop+el.offsetHeight/2;
  wrap.scrollTo({left:Math.max(0,x-wrap.clientWidth/2),top:Math.max(0,y-wrap.clientHeight/2),behavior:'smooth'});
 }
 function sync(){
  updateColumns();updateViewport();
  const enabled=mq.matches&&body.classList.contains('game-ready')&&!playArea.classList.contains('hidden');
  body.classList.toggle('mrc-cw-touch-play',enabled);syncControls();
 }

 board.addEventListener('click',()=>{if(mq.matches)requestAnimationFrame(()=>{
  const active=selectedCell();if(!active)return;
  // Only nudge when the selected tile would be out of the visible board window.
  const x=active.offsetLeft,y=active.offsetTop;
  if(x<wrap.scrollLeft||x+active.offsetWidth>wrap.scrollLeft+wrap.clientWidth||y<wrap.scrollTop||y+active.offsetHeight>wrap.scrollTop+wrap.clientHeight)centerSelection();
 })});
 function dist(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY)}
 wrap.addEventListener('touchstart',ev=>{if(ev.touches.length===2)pinch={distance:dist(ev.touches),cell};else pinch=null},{passive:true});
 wrap.addEventListener('touchmove',ev=>{if(!pinch||ev.touches.length!==2)return;ev.preventDefault();zoomTo(pinch.cell*dist(ev.touches)/Math.max(1,pinch.distance))},{passive:false});
 wrap.addEventListener('touchend',ev=>{if(ev.touches.length<2)pinch=null},{passive:true});
 const observer=new MutationObserver(sync);observer.observe(board,{attributes:true,attributeFilter:['style']});
 observer.observe(playArea,{attributes:true,attributeFilter:['class']});
 // Observe the start-screen transition instead of body: sync() also changes body classes.
 const startScreen=document.getElementById('startScreen');
 if(startScreen)observer.observe(startScreen,{attributes:true,attributeFilter:['class']});
 for(const el of [originalAcross,originalDown])if(el)observer.observe(el,{attributes:true,attributeFilter:['aria-pressed','disabled']});
 if(selectedTitle)observer.observe(selectedTitle,{childList:true,characterData:true,subtree:true});
 mq.addEventListener('change',sync);window.addEventListener('resize',updateViewport);
 window.visualViewport?.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('scroll',updateViewport);
 body.style.setProperty('--mrc-cw-cell',cell+'px');sync();
})();
