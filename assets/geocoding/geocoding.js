(()=>{'use strict';
const root=document.querySelector('[data-geocoding]');if(!root)return;
const it=root.dataset.lang==='it', L=it?{
  needKey:'La ricerca condivisa non è ancora attiva. Puoi utilizzare subito una chiave personale gratuita.',
  enter:'Inserisci la tua chiave Geoapify.',empty:'Inserisci almeno un indirizzo.',limit:'Massimo 100 righe per elaborazione.',single:'La modalità condivisa accetta un indirizzo alla volta.',wait:n=>`Per un’altra ricerca condivisa attendi ${n} secondi, oppure usa la tua API senza attesa.`,
  running:'Ricerca in corso…',done:'Elaborazione completata.',aborted:'Elaborazione interrotta; le righe non elaborate restano vuote.',notfound:'Indirizzo non trovato',uncertain:'Risultato da verificare: corrispondenza poco precisa',connection:'Errore di connessione o richiesta bloccata dal browser',unauth:'Chiave API non valida o non autorizzata per questo dominio',quota:'Quota API temporaneamente non disponibile',server:'Il servizio di geocodifica non risponde',blank:'Riga vuota',failed:'Riga non elaborata',copied:'Due colonne copiate, incluse le righe vuote.',copyfail:'Impossibile copiare automaticamente. Seleziona il testo qui sotto.',saved:'Chiave salvata solo in questo browser.',deleted:'Chiave eliminata dal browser.',noresults:'Nessun risultato da copiare.',freeQuota:'La quota gratuita condivisa non è disponibile. Può essere un segnale di utilizzo intenso del tool! Puoi continuare subito con una tua API gratuita.',
  invalid:'Risposta del servizio non valida.',stop:'Interrotto',cached:'Risultato recuperato dalla cache locale.'
}: {
  needKey:'Shared search is not enabled yet. You can use your own free API key right away.',
  enter:'Enter your Geoapify API key.',empty:'Enter at least one address.',limit:'Maximum 100 rows per run.',single:'Shared mode accepts one address at a time.',wait:n=>`Please wait ${n} seconds before another shared search, or use your own API key without waiting.`,
  running:'Searching…',done:'Processing complete.',aborted:'Processing stopped; remaining rows stay empty.',notfound:'Address not found',uncertain:'Check result: low-confidence address match',connection:'Connection error or browser request blocked',unauth:'Invalid key or key not authorized for this website',quota:'API quota temporarily unavailable',server:'Geocoding service is not responding',blank:'Empty row',failed:'Row not processed',copied:'Two columns copied, including blank rows.',copyfail:'Automatic copy failed. Select the result text below.',saved:'Key saved only in this browser.',deleted:'Key deleted from this browser.',noresults:'No results to copy.',freeQuota:'The shared free quota is temporarily unavailable. This may mean the tool is seeing lots of use! You can continue now with your own free API key.',
  invalid:'Invalid response from the geocoding service.',stop:'Stopped',cached:'Loaded from the local cache.'
};
const $=id=>root.querySelector('#'+id);const state={mode:'shared',rows:[],statuses:[],busy:false,abort:null};
const STORE_KEY='mrc-geocoding-personal-key-v1',USAGE_KEY='mrc-geocoding-shared-usage-v1',CACHE_KEY='mrc-geocoding-cache-v1';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const save=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data))}catch{}};
const sharedKey=String(window.MRC_GEOCODING_SHARED_KEY||'').trim();
const personalInput=$('geo-key');personalInput.value=read(STORE_KEY,'');
const today=()=>Math.floor(Date.now()/86400000);const usage=()=>{const a=read(USAGE_KEY,{day:today(),count:0,last:0});return a.day===today()?a:{day:today(),count:0,last:0}};
const delays=[0,0,0,30,60,120];const delaySec=count=>count<3?0:delays[Math.min(count,5)]||300;
const getWait=()=>{const u=usage();return Math.max(0,Math.ceil((u.last+delaySec(u.count)*1000-Date.now())/1000))};
function status(text,kind=''){const el=$('geo-status');el.textContent=text;el.dataset.kind=kind;}
function selectMode(mode){state.mode=mode;for(const btn of root.querySelectorAll('[data-mode]'))btn.setAttribute('aria-pressed',String(btn.dataset.mode===mode));$('geo-shared').classList.toggle('geo-hidden',mode!=='shared');$('geo-personal').classList.toggle('geo-hidden',mode!=='personal');$('geo-input-label').textContent=mode==='shared'?$('geo-input-label').dataset.single:$('geo-input-label').dataset.batch;$('geo-addresses').rows=mode==='shared'?2:7;$('geo-addresses').value='';state.rows=[];state.statuses=[];showResults();status('');refresh();}
const accordion=root.querySelector('.geo-accordion');
const sharedDetails=$('geo-option-shared'),personalDetails=$('geo-option-personal');
function openMethod(mode){
  if(state.busy)return;
  const method=mode==='shared'?sharedDetails:personalDetails;
  const shouldOpen=!method.open;
  sharedDetails.open=shouldOpen&&mode==='shared';
  personalDetails.open=shouldOpen&&mode==='personal';
  $('geo-search-controls').classList.toggle('geo-hidden',!shouldOpen);
  if(shouldOpen)selectMode(mode);
}
for(const method of [sharedDetails,personalDetails]){
  method.querySelector('summary').addEventListener('click',event=>{
    event.preventDefault();
    openMethod(method===sharedDetails?'shared':'personal');
  });
}
function refresh(){const wait=getWait(),u=usage();$('geo-remaining').textContent=String(Math.max(0,3-u.count));$('geo-wait').textContent=wait?L.wait(wait):'';$('geo-start').disabled=state.busy||(state.mode==='shared'&&(!sharedKey||wait>0));$('geo-cancel').disabled=!state.busy;$('geo-shared-key-warning').classList.toggle('geo-hidden',!!sharedKey);}
const cache=()=>{const c=read(CACHE_KEY,{});return c&&typeof c==='object'&&!Array.isArray(c)?c:{}};
function lookupCache(address){const entry=cache()[address.trim().toLowerCase()];return entry&&Date.now()-entry.ts<30*86400000?entry.result:null}
function putCache(address,result){let c=cache();c[address.trim().toLowerCase()]={ts:Date.now(),result};const keys=Object.keys(c);if(keys.length>300){keys.sort((a,b)=>c[a].ts-c[b].ts);for(const k of keys.slice(0,keys.length-300))delete c[k]}save(CACHE_KEY,c)}
function formatCoord(n){return Number(n).toFixed(Number($('geo-digits').value)).replace('.', $('geo-decimal').value)}
function lines(){return $('geo-addresses').value.replace(/\r/g,'').split('\n')}
function tsv(){const reversed=$('geo-order').value==='lonlat';return state.rows.map(r=>{if(!r||r.length!==2)return '\t';const v=reversed?[r[1],r[0]]:r;return v.map(formatCoord).join('\t')}).join('\n')}
function showResults(){const out=$('geo-output');out.value=state.rows.length?tsv():'';const list=$('geo-issues');list.replaceChildren();let problems=0;for(let i=0;i<state.statuses.length;i++){const s=state.statuses[i];if(!s)continue;problems++;const li=document.createElement('li');li.textContent=`${it?'Riga':'Row'} ${i+1}: ${s}`;list.appendChild(li)}$('geo-issues-wrap').classList.toggle('geo-hidden',problems===0);$('geo-output-count').textContent=state.rows.length?`${state.rows.length} ${it?'righe':'rows'}`:''}
$('geo-order').addEventListener('change',showResults);$('geo-decimal').addEventListener('change',showResults);$('geo-digits').addEventListener('change',showResults);
$('geo-save-key').addEventListener('click',()=>{save(STORE_KEY,personalInput.value.trim());status(L.saved)});
$('geo-delete-key').addEventListener('click',()=>{personalInput.value='';try{localStorage.removeItem(STORE_KEY)}catch{}status(L.deleted)});
$('geo-copy').addEventListener('click',async()=>{if(!state.rows.length){status(L.noresults,'error');return}const value=tsv();try{await navigator.clipboard.writeText(value);status(L.copied)}catch{status(L.copyfail,'error');$('geo-output').focus();$('geo-output').select()}});
$('geo-cancel').addEventListener('click',()=>{state.abort?.abort()});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function geocode(address,key,signal){const u=new URL('https://api.geoapify.com/v1/geocode/search');u.searchParams.set('text',address);u.searchParams.set('format','json');u.searchParams.set('limit','1');u.searchParams.set('apiKey',key);
 let response;try{response=await fetch(u.toString(),{signal,cache:'no-store'})}catch(e){if(e.name==='AbortError')throw e;throw Error(L.connection)}
 if(response.status===401||response.status===403)throw Error(L.unauth);if(response.status===429)throw Error(L.quota);if(response.status>=500)throw Error(L.server);if(!response.ok)throw Error(`${L.server} (${response.status})`);
 let data;try{data=await response.json()}catch{throw Error(L.invalid)};const item=data.results?.[0];if(!item)return {coords:null,issue:L.notfound};
 if(!Number.isFinite(item.lat)||!Number.isFinite(item.lon))return {coords:null,issue:L.invalid};
 const issue=(item.rank?.confidence!=null&&item.rank.confidence<.7)?L.uncertain:null;
 return {coords:[item.lat,item.lon],issue};}
async function start(){if(state.busy)return;const shared=state.mode==='shared',addresses=lines();if(addresses.length>100){status(L.limit,'error');return}if(shared&&addresses.filter(a=>a.trim()).length>1){status(L.single,'error');return}if(!addresses.some(a=>a.trim())){status(L.empty,'error');return}
 const key=shared?sharedKey:personalInput.value.trim();if(!key){status(shared?L.needKey:L.enter,'error');return}if(shared&&getWait()){status(L.wait(getWait()),'error');return}
 state.rows=Array(addresses.length).fill(null);state.statuses=Array(addresses.length).fill('');state.abort=new AbortController();state.busy=true;root.querySelectorAll('[data-mode]').forEach(b=>b.disabled=true);refresh();showResults();status(L.running);
 let fatal=null,aborted=false;try{for(let i=0;i<addresses.length;i++){
  if(state.abort.signal.aborted){aborted=true;break}const address=addresses[i].trim();if(!address)continue;
  let result=lookupCache(address);
  if(!result){if(shared){const u=usage();u.count++;u.last=Date.now();save(USAGE_KEY,u)}try{result=await geocode(address,key,state.abort.signal)}catch(e){if(e.name==='AbortError'){aborted=true;break}state.statuses[i]=e.message;fatal=e.message;break}putCache(address,result)}
  state.rows[i]=result.coords;state.statuses[i]=result.issue||'';$('geo-progress-fill').style.width=`${(i+1)/addresses.length*100}%`;showResults();if(!shared&&i<addresses.length-1)await pause(250);
 }}finally{state.busy=false;state.abort=null;root.querySelectorAll('[data-mode]').forEach(b=>b.disabled=false);refresh()}
 if(fatal){for(let i=0;i<addresses.length;i++)if(addresses[i].trim()&&state.rows[i]===null&&!state.statuses[i])state.statuses[i]=L.failed;status(shared&&fatal===L.quota?L.freeQuota:fatal,'error')}
 else if(aborted){for(let i=0;i<addresses.length;i++)if(addresses[i].trim()&&state.rows[i]===null&&!state.statuses[i])state.statuses[i]=L.failed;status(L.aborted)}
 else status(L.done);showResults();}
$('geo-start').addEventListener('click',start);
// Countdown only updates the display. It does not trigger API calls.
setInterval(refresh,1000);selectMode('shared');
})();
