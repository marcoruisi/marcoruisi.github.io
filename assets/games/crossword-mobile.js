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
 const minus=document.createElement('button'),plus=document.createElement('button'),center=document.createElement('button');
 for(const [b,label,aria] of [[minus,'−',it?'Riduci zoom':'Zoom out'],[plus,'+',it?'Ingrandisci':'Zoom in'],[center,'⌖',it?'Centra casella':'Center cell']]){
  b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);buttons.append(b);
 }
 bar.append(exit,buttons);wrap.parentElement.insertBefore(bar,wrap);
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
  body.classList.toggle('mrc-cw-touch-play',enabled);
 }
 minus.addEventListener('click',()=>zoomTo(cell-6));plus.addEventListener('click',()=>zoomTo(cell+6));center.addEventListener('click',centerSelection);
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
 observer.observe(body,{attributes:true,attributeFilter:['class']});
 mq.addEventListener('change',sync);window.addEventListener('resize',updateViewport);
 window.visualViewport?.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('scroll',updateViewport);
 body.style.setProperty('--mrc-cw-cell',cell+'px');sync();
})();
