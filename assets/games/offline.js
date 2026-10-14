/* MRC Games — offline installation and status (IT/EN) */
(()=>{'use strict';
if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
const it=document.documentElement.lang.toLowerCase().startsWith('it');
const onIndex=/^\/(?:games|it\/giochi)\/?$/.test(location.pathname);
const label=it?{checking:'Verifica disponibilità offline…',preparing:'Preparazione dei giochi per la modalità aereo…',ready:'Giochi pronti per la modalità aereo. Puoi aprirli anche senza Internet.',partial:'Preparazione non completata. Connettiti a Internet per riprovare.',button:'Riprova preparazione',start:'Prepara i giochi per la modalità aereo',details:'I giochi salvati funzionano senza Internet. Link esterni e contributi richiedono la connessione.'}:{checking:'Checking offline availability…',preparing:'Preparing games for airplane mode…',ready:'Games ready for airplane mode. You can open them without internet.',partial:'Offline preparation incomplete. Connect to the internet to retry.',button:'Retry preparation',start:'Prepare games for airplane mode',details:'Saved games work without internet. External links and contributions require a connection.'};
let message,button,details,busy=false,registration;
function ui(){if(!onIndex)return;
 const main=document.querySelector('main');if(!main)return;
 const section=document.createElement('section');section.className='mrc-games-offline';section.setAttribute('aria-label',it?'Giochi offline':'Offline games');
 message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.textContent=label.checking;section.append(message);
 details=document.createElement('p');details.textContent=label.details;details.hidden=true;section.append(details);
 button=document.createElement('button');button.type='button';button.textContent=label.start;button.addEventListener('click',prepare);section.append(button);
 const explainer=main.querySelector('.mrc-games-offline-explainer');const cards=main.querySelector('.cards');if(explainer)explainer.insertAdjacentElement('afterend',section);else if(cards)cards.insertAdjacentElement('afterend',section);else main.append(section);
}
function set(text,active,mode='retry'){if(message)message.textContent=text;if(button){button.hidden=mode==='ready';button.disabled=!!active;button.textContent=mode==='start'?label.start:label.button;}if(details)details.hidden=mode!=='ready';}
function send(worker,type){return new Promise((resolve,reject)=>{
 const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('timeout'));},90000);
 channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
 worker.postMessage({type},[channel.port2]);
});}
async function prepare(){if(busy)return;busy=true;set(label.preparing,true,'preparing');
 try{const worker=registration.active||navigator.serviceWorker.controller;if(!worker)throw Error('not active');const status=await send(worker,'MRC_GAMES_PREPARE');set(status.ready?label.ready:label.partial+' ('+status.loaded+'/'+status.total+')',false,status.ready?'ready':'retry');}
 catch(error){set(label.partial,false);}finally{busy=false;}}
function gameNotice(){
 if(onIndex)return;
 if(!/^\/(?:games|it\/giochi)\/[^/]+\/?$/.test(location.pathname))return;
 const main=document.querySelector('main');if(!main)return;
 const notice=document.createElement('aside');notice.className='mrc-game-offline-note';notice.setAttribute('aria-label',it?'Disponibilità offline':'Offline availability');
 const href=it?'/it/giochi/':'/games/';
 const link=document.createElement('a');link.href=href;link.textContent=it?'Prepara i giochi offline →':'Prepare games for offline play →';
 const p=document.createElement('p');p.textContent=it?'Puoi giocare anche in modalità aereo: prepara una volta i giochi dalla pagina Giochi quando sei online.':'You can play in airplane mode: prepare the games once from the Games page while online.';
 notice.append(p,link);
 const css=document.createElement('style');css.textContent='.mrc-game-offline-note{box-sizing:border-box;clear:both;margin:1.25rem 0;margin-left:max(0px,calc((100% - 920px)/2));padding:.8rem 1rem;width:min(100%,920px);max-width:920px;border:1px solid #cdc8dc;border-radius:10px;background:#fff;color:#202124;font:400 13px/1.5 Manrope,system-ui,sans-serif}.mrc-game-offline-note p{margin:0 0 .35rem}.mrc-game-offline-note a{color:#292336;text-decoration:underline;text-underline-offset:3px;font-weight:600}.mrc-game-offline-note a:focus-visible{outline:2px solid currentColor;outline-offset:3px}';
 notice.prepend(css);
 const anchor=document.querySelector('body > footer');
 if(anchor)anchor.before(notice);else main.append(notice);
}
ui();
gameNotice();
navigator.serviceWorker.register('/mrc-games-sw.js',{scope:'/'}).then(async reg=>{
 registration=reg;await navigator.serviceWorker.ready;
 if(!onIndex)return;
 const worker=reg.active||navigator.serviceWorker.controller;if(!worker)return;
 try{const status=await send(worker,'MRC_GAMES_STATUS');if(status.ready)set(label.ready,false,'ready');else if(navigator.onLine)prepare();else set(label.partial,false,'retry');}catch(e){set(label.partial,false);}
}).catch(()=>set(label.partial,false));
})();
