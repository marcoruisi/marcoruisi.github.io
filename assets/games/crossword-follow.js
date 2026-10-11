/* MRC Crossword: follow the active cell only while the native keyboard is in use. */
(()=>{'use strict';
 const board=document.getElementById('board');
 const wrap=board?.closest('.board-wrap');
 const input=document.getElementById('letter');
 const play=document.getElementById('playArea');
 if(!board||!wrap||!input||!play)return;
 const narrow=window.matchMedia('(max-width:900px)');
 let frame=0, lastKeyViewHeight=0;
 const typing=()=>narrow.matches && document.activeElement===input && !play.classList.contains('hidden');
 function follow(){
  frame=0;
  if(!typing())return;
  const cell=board.querySelector('.cell.current');
  if(!cell)return;
  const cellBox=cell.getBoundingClientRect(), wrapBox=wrap.getBoundingClientRect();
  // Move the board's own scroll container first: don't force a page jump on every letter.
  const pad=Math.max(12,Math.min(32,cellBox.width*.55));
  let dx=0,dy=0;
  if(cellBox.left<wrapBox.left+pad)dx=cellBox.left-wrapBox.left-pad;
  else if(cellBox.right>wrapBox.right-pad)dx=cellBox.right-wrapBox.right+pad;
  if(cellBox.top<wrapBox.top+pad)dy=cellBox.top-wrapBox.top-pad;
  else if(cellBox.bottom>wrapBox.bottom-pad)dy=cellBox.bottom-wrapBox.bottom+pad;
  if(dx||dy){wrap.scrollLeft+=dx;wrap.scrollTop+=dy;}
  // In the Tool the container is not viewport-height constrained; account for keyboard.
  const visible=window.visualViewport;
  const top=visible?.offsetTop||0;
  const bottom=top+(visible?.height||window.innerHeight);
  const actual=cell.getBoundingClientRect();
  const topLimit=top+Math.min(66,(bottom-top)*.16);
  const bottomLimit=bottom-Math.min(110,(bottom-top)*.28);
  if(actual.top<topLimit || actual.bottom>bottomLimit){
   const delta=actual.top<topLimit?actual.top-topLimit:actual.bottom-bottomLimit;
   window.scrollBy({top:delta,behavior:'instant'});
  }
 }
 function queueFollow(){if(!typing()||frame)return;frame=requestAnimationFrame(follow)}
 // Rendering replaces all grid cells after each letter, so observe the selection itself.
 const observer=new MutationObserver(queueFollow);
 observer.observe(board,{childList:true});
 input.addEventListener('focus',()=>{
  // iOS adjusts visualViewport over several frames as the native keyboard slides in.
  queueFollow();setTimeout(queueFollow,120);setTimeout(queueFollow,360);
 });
 input.addEventListener('input',queueFollow);
 input.addEventListener('beforeinput',()=>setTimeout(queueFollow,0));
 board.addEventListener('click',()=>setTimeout(queueFollow,0));
 const viewport=window.visualViewport;
 viewport?.addEventListener('resize',()=>{
  if(!typing())return;
  if(Math.abs((viewport.height||0)-lastKeyViewHeight)>2){lastKeyViewHeight=viewport.height;queueFollow()}
 });
 window.addEventListener('resize',queueFollow);
 narrow.addEventListener('change',()=>{if(frame)cancelAnimationFrame(frame);frame=0});
})();
