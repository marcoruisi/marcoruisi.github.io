/* Catalogue entries link to clean starts; optional progress snapshots live in the fragment. */
(()=>{'use strict';
window.MRCCrosswordCatalog={init({lang,open,canAutoOpen,requestURL=location.href}){
 const it=lang==='it',say=(a,b)=>it?a:b,root=document.querySelector('#startScreen .start-actions');if(!root)return;
 const safeFile=name=>typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(name)&&!name.includes('..');
 const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id);
 const requested=new URL(requestURL),requestedId=requested.searchParams.get('puzzle'),requestedMode=requested.searchParams.get('mode')==='diagramless'?'diagramless':'classic';
 const host=document.createElement('div');host.className='mrc-cw-catalog';root.append(host);const columns={};
 for(const [mode,title,desc] of [['classic',say('Con schema','With a grid'),say('Nere visibili e definizioni numerate.','Visible black squares and numbered clues.')],['diagramless',say('Senza schema','Diagramless'),say('Inserisci lettere e nere. Definizioni in sequenza per riga e colonna.','Place letters and black squares. Ordered clues for rows and columns.')]]){
  const section=document.createElement('section');section.className='mrc-cw-catalog-column';section.id='raccolta-'+mode;const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=desc;const list=document.createElement('div');list.className='mrc-cw-catalog-list';const note=document.createElement('p');note.className='muted';note.textContent=say('Caricamento…','Loading…');section.append(h,p,list,note);host.append(section);columns[mode]={list,note};
 }
 let interacted=false;root.addEventListener('click',()=>{interacted=true},{capture:true});
 let pending=0;const loaded=new Map(),itemsById=new Map();
 function urlFor(id,mode){const url=new URL(location.pathname,location.origin);url.searchParams.set('puzzle',id);url.searchParams.set('mode',mode);return url.href}
 async function start(item,mode,fragment=''){const token=++pending;try{let raw=loaded.get(item.file);if(!raw){const r=await fetch('/assets/games/crosswords/'+encodeURIComponent(item.file),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);raw=await r.json();loaded.set(item.file,raw)}const clean=MRCCrosswordJSON.load(MRCCrosswordJSON.document(raw),{playable:true});if(!clean)throw Error('JSON');const effective=clean.layoutKnown===false?'diagramless':mode;if(token!==pending)return;let progress=null;if(fragment){if(!fragment.startsWith('#p'))throw Error('link');progress=MRCCrosswordLink.decode(fragment.slice(2),clean,effective)}open(clean,effective,urlFor(item.id,effective),progress);}catch{if(token===pending)columns[mode].note.textContent=say('Impossibile aprire questo link: dati incompleti o schema modificato. Puoi aprire lo schema iniziale dalla raccolta.','Cannot open this link: incomplete data or changed puzzle. You can open the starting puzzle from the collection.')}}
 function card(item,mode){const a=document.createElement('a');a.className='mrc-cw-catalog-card';a.href=urlFor(item.id,mode);const strong=document.createElement('strong');strong.textContent=item.title||item.id;const small=document.createElement('small');small.textContent=item.type==='daily-news'?say('Cruciverba del giorno','Daily crossword'):item.type==='time-machine'||item.category==='history'?say('Macchina del tempo','Time machine'):say('Esempio','Example');a.append(strong,small);a.addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();start(item,mode)});columns[mode].list.append(a)}
 async function list(){try{
  const r=await fetch('/assets/games/crosswords/index.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const manifest=await r.json();if(!Array.isArray(manifest.games))throw Error();
  const items=manifest.games.filter(x=>x&&x.language===lang&&safeFile(x.file)).map(x=>({...x,id:safeId(x.id)?x.id:x.file.replace(/\.json$/,'')}));
  let cursor=0;const results=Array(items.length);await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{while(cursor<items.length){const i=cursor++,item=items[i];try{const response=await fetch('/assets/games/crosswords/'+encodeURIComponent(item.file),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const raw=await response.json(),valid=MRCCrosswordJSON.load(raw,{playable:true});if(!valid)throw Error();loaded.set(item.file,raw);results[i]=valid.layoutKnown!==false}catch{results[i]=null}}}));
  let failed=0;items.forEach((item,i)=>{if(results[i]===null||itemsById.has(item.id)){failed++;return}itemsById.set(item.id,item);if(results[i])card(item,'classic');card(item,'diagramless')});
  for(const mode of ['classic','diagramless'])columns[mode].note.textContent=(columns[mode].list.children.length?'':say('Nessun cruciverba disponibile.','No crosswords available.'))+(failed?say(' Alcuni file del catalogo non sono disponibili o hanno ID duplicati.',' Some catalogue files are unavailable or have duplicate IDs.'):'');
  if(requestedId&&!interacted&&canAutoOpen()){const item=itemsById.get(requestedId);if(item)await start(item,requestedMode,requested.hash);else columns[requestedMode].note.textContent=say('Il cruciverba di questo link non è disponibile nella raccolta.','The crossword in this link is not available in the collection.')}
 }catch{for(const mode of ['classic','diagramless'])columns[mode].note.textContent=say('Raccolta non disponibile. Puoi aprire un file JSON.','Collection unavailable. You can open a JSON file.')}}
 list();
 const warning=say('Scarica un JSON da conservare e riaprire anche offline. Per gli esempi della raccolta puoi condividere anche un link.','Download a JSON to keep and reopen offline. Catalogue puzzles can also be shared by link.');
 const share=document.createElement('button');share.type='button';share.id='mrcShareExample';share.className='mrc-cw-share-example';share.textContent=say('Salva / condividi','Save / share');share.hidden=true;
 const panel=document.createElement('div');panel.className='mrc-cw-example-link';const fallback=document.createElement('input');fallback.type='url';fallback.readOnly=true;fallback.hidden=true;fallback.setAttribute('aria-label',say('Link allo schema iniziale','Starting puzzle link'));const note=document.createElement('span');note.setAttribute('role','status');panel.append(share,fallback,note);document.querySelector('main > .layout').before(panel);
 async function sendLink(output,withProgress){
  let url=history.state?.exampleURL;if(!url)return;
  const message=withProgress?say('Cruciverba con i progressi condivisi.','Crossword with shared progress.'):say('Cruciverba: schema iniziale senza progressi.','Crossword: starting puzzle without progress.');
  try{const u=new URL(url);u.hash='';if(withProgress){u.hash='p'+MRCCrosswordLink.encode(history.state.puzzle,u.searchParams.get('mode')==='diagramless'?'diagramless':'classic')}url=u.href;if(url.length>1800)throw Error('length')}catch{output.textContent=say('Impossibile creare un link compatto. Usa “JSON con progressi” e invia il file.','Cannot create a compact link. Use “JSON with progress” and send the file.');return}
  output.textContent=message;
  if(navigator.share){try{await navigator.share({title:say('Cruciverba','Crossword'),text:message,url});return}catch(error){if(error.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(url);output.textContent=say('Link copiato. ','Link copied. ')+message}
  catch{fallback.value=url;fallback.hidden=false;panel.hidden=false;fallback.focus();fallback.select();output.textContent=say('Copia questo indirizzo: ','Copy this address: ')+url+' — '+message}
 }
 function shareLink(output=note){
  output.replaceChildren();const label=document.createElement('span');label.textContent=warning;label.style.display='block';output.append(label);
  function action(title,run){const button=document.createElement('button');button.type='button';button.textContent=title;button.style.cssText='margin:6px 6px 0 0;white-space:normal';button.onclick=run;output.append(button)}
  if(history.state?.exampleURL){
   action(say('Link allo schema iniziale','Link to starting puzzle'),()=>sendLink(output,false));
   action(say('Link con progressi','Link with progress'),()=>sendLink(output,true));
  }
  action(say('JSON dello schema iniziale','Starting puzzle JSON'),()=>document.getElementById('mrcDownloadPuzzle')?.click());
  action(say('JSON con progressi','JSON with progress'),()=>document.getElementById('export')?.click());
  action(say('Chiudi','Close'),()=>output.replaceChildren());
 }

 window.MRCShareCrossword={share:shareLink,warning};
 share.onclick=()=>shareLink();
 document.addEventListener('mrc-crossword-view',()=>{const available=history.state?.mrcCrosswordView==='play';share.hidden=!available;fallback.hidden=true;note.replaceChildren();panel.hidden=!available});panel.hidden=true;
}};
})();
