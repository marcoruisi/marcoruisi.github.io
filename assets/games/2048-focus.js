(()=>{'use strict';
const area=document.querySelector('[data-game="2048"]');if(!area)return;
const it=document.documentElement.lang.toLowerCase().startsWith('it');
const parent=area.parentNode,marker=document.createComment('2048 game position');parent.insertBefore(marker,area);
const overlay=document.createElement('div');overlay.className='mrc-2048-focus';overlay.hidden=true;
overlay.innerHTML='<section class="mrc-2048-stage" role="dialog" aria-modal="true" aria-label="2048"><div class="mrc-2048-stage-head"><strong>2048</strong><button type="button" class="mrc-2048-save-leave"></button><button type="button" class="mrc-2048-close"></button></div><div class="mrc-2048-chooser" hidden role="group"><h2></h2><p></p><div class="mrc-2048-chooser-actions"><button type="button" class="mrc-2048-choose-resume primary"></button><button type="button" class="mrc-2048-choose-new"></button></div></div></section>';
const stage=overlay.firstElementChild,close=stage.querySelector('.mrc-2048-close'),saveLeave=stage.querySelector('.mrc-2048-save-leave'),chooser=stage.querySelector('.mrc-2048-chooser');
const resumeBtn=stage.querySelector('.mrc-2048-choose-resume'),newBtn=stage.querySelector('.mrc-2048-choose-new');
close.textContent=it?'← Esci dalla partita':'← Leave game';saveLeave.textContent=it?'Salva e esci':'Save and leave';
chooser.querySelector('h2').textContent=it?'Partita salvata':'Saved game';
chooser.querySelector('p').textContent=it?'Vuoi riprendere da dove eri rimasto oppure iniziare una nuova partita?':'Resume where you left off, or start a new game?';
resumeBtn.textContent=it?'Riprendi partita':'Resume game';newBtn.textContent=it?'Nuova partita':'New game';
document.body.appendChild(overlay);
let bar=null,barMarker=null;
function goBack(){window.location.assign(it?'/it/giochi/':'/games/');}
function start(kind){
 if(kind==='resume'&&!window.MRC2048?.resume()){kind='new';}
 if(kind==='new')window.MRC2048?.newGame();
 chooser.hidden=true;bar=document.querySelector('main > .mrc-playtime');
 if(bar&&!barMarker){barMarker=document.createComment('timer position');bar.before(barMarker)}
 if(bar)stage.append(bar);
 stage.append(area);stage.classList.add('mrc-2048-stage-active');document.body.classList.add('mrc-2048-playing');
 close.focus({preventScroll:true});
}
function show(){overlay.hidden=false;document.body.classList.add('mrc-2048-overlay-open');
 const saved=window.MRC2048?.savedInfo();
 // The first visit begins immediately; only an actual saved game requires a decision.
 if(saved){chooser.hidden=false;saveLeave.hidden=true;resumeBtn.focus({preventScroll:true});}
 else start('new');
}
resumeBtn.addEventListener('click',()=>{saveLeave.hidden=false;start('resume')});
newBtn.addEventListener('click',()=>{saveLeave.hidden=false;start('new')});
close.addEventListener('click',goBack);
saveLeave.addEventListener('click',()=>{window.MRC2048?.saveNow();goBack()});
overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();goBack()}if(e.key==='Tab'){
 const elements=[...overlay.querySelectorAll('button:not([hidden]):not(:disabled)')].filter(el=>el.getClientRects().length);
 const first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}});
show();
})();
