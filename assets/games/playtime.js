/* MRC Games: continuous visible-page playtime, optional breaks and voluntary support. */
(()=>{'use strict';
 const host=document.querySelector('main');if(!host)return;
 const it=document.documentElement.lang.toLowerCase().startsWith('it');
 const texts=it?{
  timer:'Tempo di gioco', support:'Sostieni MRC →',
  title:'Hai fatto una pausa. Ora torna alla realtà.',
  continue:'Continuo ancora',close:'Chiudo il gioco',
  intro:'I giochi MRC sono una pausa breve, non un posto dove passare la giornata.',
  stages:[
   'Ti ho preparato questo gioco per una pausa. Non per passarci la giornata.',
   'Mi fa piacere che tu sia ancora qui. Ma mi farebbe più piacere saperti fuori, a fare qualcosa di vero.',
   'Ho costruito questo gioco, ma non voglio che diventi un motivo per restare davanti allo schermo. Spegnilo. Vai a vivere.'
  ],
  kidsStages:[
   'Questo gioco l’ho fatto io. Il prossimo inventalo tu, magari con un amico.',
   'Hai giocato qui. Adesso spegni lo schermo e inventa un gioco con qualcuno.',
   'Sai qual è il gioco che mi piace di più? Quello che inventi tu, senza uno schermo.'
  ]
 }:{
  timer:'Time playing',support:'Support MRC →',
  title:'That was your break. Now back to real life.',
  continue:'Keep playing a little longer',close:'Leave the game',
  intro:'MRC games are a short break, not somewhere to spend your day.',
  stages:[
   'I made this game for a short break. Not for spending your whole day here.',
   'I’m glad you’re still here. But I’d be happier knowing you’re out doing something real.',
   'I built this game, but I don’t want it to keep you in front of a screen. Switch it off. Go live.'
  ],
  kidsStages:[
   'I made this game. Now invent your own, maybe with a friend.',
   'You’ve played here. Now turn off the screen and make up a game with someone.',
   'Know which game I like best? The one you make up without a screen.'
  ]
 };
 const STORE='mrc-games-session-time-v1';const OLD_STORE='mrc-games-active-time-v1';
 // A session survives navigation between games in this tab, not later visits.
 // A long break (15 minutes) starts a fresh session even if the tab stays open.
 const SESSION_GAP=15*60*1000;const BREAK_PAUSE=3000;
 // Breaks start after 5 minutes, repeat every 5 minutes up to 30, then every 15.
 function nextMilestone(previous){const m=previous/60000;return (m<30?(Math.floor(m/5)+1)*5:30+(Math.floor((m-30)/15)+1)*15)*60000;}
 let accumulated=0,lastAlert=0;
 try{
  const saved=JSON.parse(sessionStorage.getItem(STORE)||'null');
  if(saved&&Number.isFinite(saved.ms)&&saved.ms>=0&&saved.ms<86400000&&
     Number.isFinite(saved.updated)&&Date.now()-saved.updated>=0&&Date.now()-saved.updated<SESSION_GAP){
   accumulated=saved.ms;lastAlert=Number.isFinite(saved.alert)?saved.alert:0;
  }else sessionStorage.removeItem(STORE);
  // Retire the old persistent timer so previous visits cannot reappear.
  localStorage.removeItem(OLD_STORE);
 }catch{}
 let lastTick=performance.now(),dialogOpen=false,pendingAlert=false,pendingSince=0;
 const bar=document.createElement('div');bar.className='mrc-playtime';bar.innerHTML='<span class="mrc-playtime-clock" role="timer" aria-label=""></span><a class="mrc-playtime-support" data-support-link target="_blank" rel="noopener noreferrer"></a>';
 const clock=bar.querySelector('.mrc-playtime-clock');clock.setAttribute('aria-label',texts.timer);bar.querySelector('a').textContent=texts.support;
 const pageIntro=host.querySelector('.game-area')||host.querySelector('h1');if(pageIntro)pageIntro.before(bar);else host.prepend(bar);
 const dialog=document.createElement('div');dialog.className='mrc-break-overlay';dialog.hidden=true;
 dialog.innerHTML='<section class="mrc-break-dialog" role="dialog" aria-modal="true" aria-labelledby="mrc-break-title" aria-describedby="mrc-break-message"><p class="mrc-break-eyebrow"></p><h2 id="mrc-break-title"></h2><p class="mrc-break-message" id="mrc-break-message"></p><p class="mrc-break-signature">— Marco, MRC</p><div class="mrc-break-actions"><button type="button" class="mrc-break-dismiss"></button><button type="button" class="mrc-break-continue"></button></div></section>';
 document.body.appendChild(dialog);
 dialog.querySelector('.mrc-break-eyebrow').textContent=texts.intro;
 dialog.querySelector('h2').textContent=texts.title;
 dialog.querySelector('.mrc-break-continue').textContent=texts.continue;
 dialog.querySelector('.mrc-break-dismiss').textContent=texts.close;
 // Optional support remains outside the break reminder and never appears in kids mode.
 const supportURL='https://buy.stripe.com/eVq5kCaff0BE1VFdQL4sE02';
 bar.querySelector('[data-support-link]').href=supportURL;
 function update(){const kids=document.body.classList.contains('mrc-kids-mode');bar.querySelector('[data-support-link]').hidden=kids;const n=Math.floor(accumulated/1000);clock.textContent=`${texts.timer}: ${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
 function persist(){try{sessionStorage.setItem(STORE,JSON.stringify({ms:Math.round(accumulated),alert:lastAlert,updated:Date.now()}))}catch{}}
 let previousFocus=null;
 function dismiss(){dialog.hidden=true;dialogOpen=false;pendingAlert=false;lastTick=performance.now();pendingSince=0;persist();previousFocus?.focus?.()}
 dialog.querySelector('.mrc-break-continue').addEventListener('click',dismiss);
 dialog.querySelector('.mrc-break-dismiss').addEventListener('click',()=>{persist();window.location.assign(it?'/it/giochi/':'/games/')});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss()}if(e.key==='Tab'){const focusable=[...dialog.querySelectorAll('button,a[href]')].filter(el=>!el.closest('[hidden]')); const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 function show(){
  if(dialogOpen)return;
  update();dialogOpen=true;previousFocus=document.activeElement;
  const kids=document.body.classList.contains('mrc-kids-mode');
  const stage=lastAlert<10*60000?0:lastAlert<15*60000?1:2;
  dialog.querySelector('.mrc-break-message').textContent=(kids?texts.kidsStages:texts.stages)[stage];
  dialog.hidden=false;
  dialog.querySelector('.mrc-break-dismiss').focus();
 }
 // Continuous visible-page time, including reading/planning; no inactivity threshold.
 // Hidden and unfocused periods are excluded; only this tab's active session resumes.
 function tick(){const now=performance.now();const delta=Math.min(1500,Math.max(0,now-lastTick));lastTick=now;
  const visible=!document.hidden&&document.hasFocus();
  if(visible&&!dialogOpen){
   accumulated+=delta;
   if(!pendingAlert&&accumulated>=nextMilestone(lastAlert)){pendingAlert=true;pendingSince=now;}
   if(pendingAlert&&now-pendingSince>=BREAK_PAUSE){lastAlert=nextMilestone(lastAlert);pendingAlert=false;pendingSince=0;persist();show();}
  }
  update();
 }
 document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(document.hidden)persist()});
 window.addEventListener('blur',()=>{persist();lastTick=performance.now()});
 window.addEventListener('focus',()=>{lastTick=performance.now()});
 window.addEventListener('pagehide',persist);
 setInterval(tick,250);setInterval(persist,5000);update();
})();
