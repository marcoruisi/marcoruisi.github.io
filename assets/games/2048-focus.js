(()=>{'use strict';
const area=document.querySelector('[data-game="2048"]'),entry=document.querySelector('.mrc-2048-entry');if(!area||!entry)return;
const it=document.documentElement.lang.toLowerCase().startsWith('it');
const newButton=entry.querySelector('.mrc-2048-new'),resumeButton=entry.querySelector('.mrc-2048-resume'),note=entry.querySelector('.mrc-2048-save-note');
const parent=area.parentNode,marker=document.createComment('2048 game position');parent.insertBefore(marker,area);
const overlay=document.createElement('div');overlay.className='mrc-2048-focus';overlay.hidden=true;
overlay.innerHTML='<section class="mrc-2048-stage" role="dialog" aria-modal="true" aria-label="2048"><div class="mrc-2048-stage-head"><strong>2048</strong><button type="button" class="mrc-2048-close"></button></div></section>';
const stage=overlay.firstElementChild,close=stage.querySelector('.mrc-2048-close');const saveLeave=document.createElement('button');saveLeave.type='button';saveLeave.className='mrc-2048-save-leave';saveLeave.textContent=it?'Salva e esci':'Save and leave';close.before(saveLeave);close.textContent=it?'← Esci dalla partita':'← Leave game';document.body.appendChild(overlay);
let bar,barMarker;let previouslyFocused=null;
function updateSave(){const saved=window.MRC2048?.savedInfo();resumeButton.hidden=!saved;note.textContent=saved?(it?'Partita salvata · '+saved.score+' punti.':'Saved game · '+saved.score+' points.'):(it?'Nessuna partita da riprendere.':'No saved game to resume.');}
function open(kind){if(kind==='resume'&&!window.MRC2048?.resume())return;if(kind==='new')window.MRC2048?.newGame();
 previouslyFocused=document.activeElement;bar=document.querySelector('main > .mrc-playtime');if(bar&&!barMarker){barMarker=document.createComment('timer position');bar.before(barMarker)}if(bar)stage.append(bar);
 stage.append(area);overlay.hidden=false;document.body.classList.add('mrc-2048-playing');close.focus({preventScroll:true});}
function leave(){overlay.hidden=true;document.body.classList.remove('mrc-2048-playing');marker.after(area);if(bar&&barMarker)barMarker.after(bar);updateSave();(previouslyFocused||newButton).focus({preventScroll:true})}
newButton.addEventListener('click',()=>open('new'));resumeButton.addEventListener('click',()=>open('resume'));close.addEventListener('click',leave);saveLeave.addEventListener('click',()=>{window.MRC2048?.saveNow();leave();note.textContent=it?'Partita salvata: potrai riprenderla più tardi.':'Game saved: you can resume it later.';});
overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();leave()}if(e.key==='Tab'){const elements=[...overlay.querySelectorAll('button:not(:disabled),a[href]')];const first=elements[0],last=elements.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
updateSave();
})();
