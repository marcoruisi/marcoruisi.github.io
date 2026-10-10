/* MRC Games: continuous visible-page playtime, optional breaks and voluntary support. */
(()=>{'use strict';
 const host=document.querySelector('main');if(!host)return;
 const it=document.documentElement.lang.toLowerCase().startsWith('it');
 const texts=it?{
  timer:'Tempo di gioco',support:'Sostieni MRC →',supportNote:'Un contributo libero. Il gioco rimane gratuito.',
  title:'Una pausa ci sta.',continue:'Continuo a giocare',close:'Per ora basta',
  intro:'Il tempo vola quando ci si diverte.',
  messages:['Hai risolto abbastanza problemi per oggi. Quelli veri ti aspettano.','Torna a lavorare. Oppure spegni il computer e fatti una passeggiata.','Questo gioco non compare nella lista delle cose da fare. Ho controllato.','Il computer ha una funzione interessante: si può spegnere.','Hai trasformato una pausa in un’attività a tempo pieno.']
 }:{
  timer:'Time playing',support:'Support MRC →',supportNote:'A voluntary contribution. Games stay free.',
  title:'Time for a little break.',continue:'Keep playing',close:'That’s enough for now',
  intro:'Time flies when you’re having fun.',
  messages:['You have solved enough problems for today. The real ones are waiting.','Back to work. Or switch off your computer and take a walk.','This game was not on your to-do list. I checked.','Your computer has a useful feature: you can switch it off.','You have turned a quick break into a full-time activity.']
 };
 const STORE='mrc-games-active-time-v1';const IDLE=60000;const BREAK_PAUSE=3000;
 // Breaks start after 5 minutes, repeat every 5 minutes up to 30, then every 15.
 function nextMilestone(previous){const m=previous/60000;return (m<30?(Math.floor(m/5)+1)*5:30+(Math.floor((m-30)/15)+1)*15)*60000;}
 let accumulated=0,lastAlert=0,lastMessage=-1;
 try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved&&Number.isFinite(saved.ms)&&saved.ms>=0&&saved.ms<31536000000){accumulated=saved.ms;lastAlert=Number.isFinite(saved.alert)?saved.alert:0}}catch{}
 let lastTick=performance.now(),dialogOpen=false,pendingAlert=false,pendingSince=0;
 const bar=document.createElement('div');bar.className='mrc-playtime';bar.innerHTML='<span class="mrc-playtime-clock" role="timer" aria-label=""></span><a class="mrc-playtime-support" data-support-link target="_blank" rel="noopener noreferrer"></a>';
 const clock=bar.querySelector('.mrc-playtime-clock');clock.setAttribute('aria-label',texts.timer);bar.querySelector('a').textContent=texts.support;
 const pageIntro=host.querySelector('.game-area')||host.querySelector('h1');if(pageIntro)pageIntro.before(bar);else host.prepend(bar);
 const dialog=document.createElement('div');dialog.className='mrc-break-overlay';dialog.hidden=true;
 dialog.innerHTML='<section class="mrc-break-dialog" role="dialog" aria-modal="true" aria-labelledby="mrc-break-title"><p class="mrc-break-eyebrow"></p><h2 id="mrc-break-title"></h2><p class="mrc-break-message"></p><p class="mrc-break-support-copy"></p><div class="mrc-break-amounts" role="group" aria-label="'+(it?'Scegli un importo':'Choose an amount')+'"><a class="mrc-break-amount" data-amount="1" target="_blank" rel="noopener noreferrer">1 €</a><a class="mrc-break-amount" data-amount="3" target="_blank" rel="noopener noreferrer">3 €</a><a class="mrc-break-amount" data-amount="5" target="_blank" rel="noopener noreferrer">5 €</a><a class="mrc-break-amount" data-amount="other" target="_blank" rel="noopener noreferrer">'+(it?'Altro':'Other')+'</a></div><div class="mrc-break-actions"><button type="button" class="mrc-break-continue"></button><button type="button" class="mrc-break-dismiss"></button></div></section>';
 document.body.appendChild(dialog);
 dialog.querySelector('.mrc-break-eyebrow').textContent=texts.intro;
 dialog.querySelector('h2').textContent=texts.title;
 dialog.querySelector('.mrc-break-support-copy').textContent=texts.supportNote;
 dialog.querySelector('.mrc-break-continue').textContent=texts.continue;
 dialog.querySelector('.mrc-break-dismiss').textContent=texts.close;
 const donations={
  '1':'https://buy.stripe.com/14AbJ0evvfwyeIrh2X4sE03',
  '3':'https://buy.stripe.com/3cI00i9bb5VY1VFaEz4sE05',
  '5':'https://buy.stripe.com/14AaEW9bb3NQ1VFh2X4sE06',
  other:'https://buy.stripe.com/eVq5kCaff0BE1VFdQL4sE02'
 }; // Same payment links as assets/support.js.
 dialog.querySelectorAll('[data-amount]').forEach(a=>{a.href=donations[a.dataset.amount]});
 bar.querySelector('[data-support-link]').href=donations.other;
 function update(){const kids=document.body.classList.contains('mrc-kids-mode');bar.querySelector('[data-support-link]').hidden=kids;dialog.querySelector('.mrc-break-support-copy').hidden=kids;dialog.querySelector('.mrc-break-amounts').hidden=kids;const n=Math.floor(accumulated/1000);clock.textContent=`${texts.timer}: ${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
 function persist(){try{localStorage.setItem(STORE,JSON.stringify({ms:Math.round(accumulated),alert:lastAlert}))}catch{}}
 let previousFocus=null;
 function dismiss(){dialog.hidden=true;dialogOpen=false;pendingAlert=false;lastTick=performance.now();pendingSince=0;persist();previousFocus?.focus?.()}
 dialog.querySelector('.mrc-break-continue').addEventListener('click',dismiss);
 dialog.querySelector('.mrc-break-dismiss').addEventListener('click',dismiss);
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss()}if(e.key==='Tab'){const focusable=[...dialog.querySelectorAll('button,a[href]')].filter(el=>!el.closest('[hidden]')); const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 function show(){if(dialogOpen)return;update();dialogOpen=true;previousFocus=document.activeElement;let pick=Math.floor(Math.random()*texts.messages.length);if(texts.messages.length>1&&pick===lastMessage)pick=(pick+1+Math.floor(Math.random()*(texts.messages.length-1)))%texts.messages.length;lastMessage=pick;dialog.querySelector('.mrc-break-message').textContent=texts.messages[pick];dialog.hidden=false;dialog.querySelector('.mrc-break-continue').focus();}
 // Continuous visible-page time, including reading/planning; no inactivity threshold.
 // Page-hidden and unfocused periods are excluded, and saved time resumes next visit.
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
