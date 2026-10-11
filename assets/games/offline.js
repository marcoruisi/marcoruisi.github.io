/* MRC Games — offline installation and status (IT/EN) */
(()=>{'use strict';
if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
const it=document.documentElement.lang.toLowerCase().startsWith('it');
const onIndex=/^\/(?:games|it\/giochi)\/?$/.test(location.pathname);
const label=it?{checking:'Verifica disponibilità offline…',preparing:'Preparazione dei giochi per la modalità aereo…',ready:'Giochi pronti per la modalità aereo.',partial:'Preparazione incompleta. Serve una connessione per riprovare.',button:'Riprova preparazione offline',start:'Prepara i giochi per la modalità aereo',details:'Dopo la preparazione puoi riaprire i giochi senza Internet. Link esterni e contributi richiedono la connessione.'}:{checking:'Checking offline availability…',preparing:'Preparing games for airplane mode…',ready:'Games ready for airplane mode.',partial:'Not fully saved. Connect to the internet and retry.',button:'Retry offline preparation',start:'Prepare games for airplane mode',details:'Once prepared, you can reopen games without internet. External links and contributions require a connection.'};
let message,button,busy=false,registration;
function ui(){if(!onIndex)return;
 const main=document.querySelector('main');if(!main)return;
 const section=document.createElement('section');section.className='mrc-games-offline';section.setAttribute('aria-label',it?'Giochi offline':'Offline games');
 const css=document.createElement('style');css.textContent='.mrc-games-offline{margin:1.5rem 0;padding:1rem 1.25rem;border:1px solid currentColor;border-radius:12px;max-width:850px}.mrc-games-offline p{margin:.4rem 0;line-height:1.55}.mrc-games-offline button{margin-top:.6rem;padding:.55rem .85rem;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}.mrc-games-offline button:focus-visible{outline:3px solid currentColor;outline-offset:2px}';
 section.append(css);message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.textContent=label.checking;section.append(message);
 const details=document.createElement('p');details.textContent=label.details;section.append(details);
 button=document.createElement('button');button.type='button';button.textContent=label.start;button.addEventListener('click',prepare);section.append(button);
 const cards=main.querySelector('.cards');if(cards)cards.insertAdjacentElement('afterend',section);else main.append(section);
}
function set(text,active){if(message)message.textContent=text;if(button){button.disabled=!!active;button.textContent=label.button;}}
function send(worker,type){return new Promise((resolve,reject)=>{
 const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('timeout'));},90000);
 channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
 worker.postMessage({type},[channel.port2]);
});}
async function prepare(){if(busy)return;busy=true;set(label.preparing,true);
 try{const worker=registration.active||navigator.serviceWorker.controller;if(!worker)throw Error('not active');const status=await send(worker,'MRC_GAMES_PREPARE');set(status.ready?label.ready:label.partial+' ('+status.loaded+'/'+status.total+')',false);}
 catch(error){set(label.partial,false);}finally{busy=false;}}
ui();
navigator.serviceWorker.register('/mrc-games-sw.js',{scope:'/'}).then(async reg=>{
 registration=reg;await navigator.serviceWorker.ready;
 if(!onIndex)return;
 const worker=reg.active||navigator.serviceWorker.controller;if(!worker)return;
 try{const status=await send(worker,'MRC_GAMES_STATUS');if(status.ready)set(label.ready,false);else if(navigator.onLine)prepare();else set(label.partial,false);}catch(e){set(label.partial,false);}
}).catch(()=>set(label.partial,false));
})();
