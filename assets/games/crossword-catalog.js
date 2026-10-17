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
 const share=document.createElement('button');share.type='button';share.id='mrcShareExample';share.className='mrc-cw-share-example';share.textContent=say('Condividi / salva','Share / save');
 const panel=document.createElement('div');panel.className='mrc-cw-example-link';panel.append(share);document.querySelector('main > .layout').before(panel);panel.hidden=true;
 const dialog=document.createElement('dialog');dialog.className='mrc-cw-share-dialog';dialog.setAttribute('aria-labelledby','mrc-share-title');
 const title=document.createElement('h2');title.id='mrc-share-title';const content=document.createElement('div');const actions=document.createElement('div');actions.className='mrc-cw-share-actions';
 const close=document.createElement('button');close.type='button';close.textContent=say('Chiudi','Close');close.onclick=()=>dialog.close();dialog.append(title,content,actions,close);document.body.append(dialog);
 let format='json',opener=null;
 dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
 function screen(heading){title.textContent=heading;content.replaceChildren();actions.replaceChildren()}
 function action(label,run){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=run;actions.append(button)}
 function message(text){const p=document.createElement('p');p.textContent=text;content.append(p)}
 function hasProgress(){const s=history.state?.puzzle;return !!s&&(s.letters?.some((v,i)=>!!v&&!(s.variant==='diagramless'?s.diagramlessBlacks?.[i]:s.blacks?.[i]))||s.variant==='diagramless'&&s.diagramlessBlacks?.some(Boolean))}
 async function sendLink(withProgress){
  let url=history.state?.exampleURL;if(!url)return;
  try{const u=new URL(url);u.hash='';if(withProgress)u.hash='p'+MRCCrosswordLink.encode(history.state.puzzle,u.searchParams.get('mode')==='diagramless'?'diagramless':'classic');url=u.href;if(url.length>1800)throw Error('length')}
  catch{screen(say('Usa il file JSON','Use a JSON file'));message(say('Non è stato possibile creare un link compatto per questi dati.','A compact link could not be created for this data.'));action(say('Scarica JSON','Download JSON'),()=>{document.getElementById(withProgress?'export':'mrcDownloadPuzzle')?.click();dialog.close()});return}
  screen(say('Il tuo link','Your link'));message(withProgress?say('Include le lettere e le nere inserite.','Includes entered letters and black squares.'):say('Apre lo schema iniziale, senza progressi.','Opens the starting puzzle, without progress.'));
  const input=document.createElement('input');input.type='url';input.readOnly=true;input.value=url;input.setAttribute('aria-label',say('Link al cruciverba','Crossword link'));content.append(input);
  const status=document.createElement('p');status.setAttribute('role','status');content.append(status);
  async function copy(){try{await navigator.clipboard.writeText(url);status.textContent=say('Link copiato.','Link copied.')}catch{input.focus();input.select();status.textContent=say('Seleziona e copia il link.','Select and copy the link.')}}
  async function send(){try{await navigator.share({title:say('Cruciverba','Crossword'),url})}catch(error){if(error.name!=='AbortError')await copy()}}
  action(say('Copia link','Copy link'),copy);if(navigator.share)action(say('Condividi link','Share link'),send);
  action(say('Indietro','Back'),()=>hasProgress()?chooseProgress():chooseFormat());
  if(navigator.share)await send();else await copy();
 }
 function finish(withProgress){if(format==='link')sendLink(withProgress);else{document.getElementById(withProgress?'export':'mrcDownloadPuzzle')?.click();dialog.close()}}
 function chooseProgress(){
  if(!hasProgress()){finish(false);return}
  screen(say('Includere i progressi?','Include progress?'));message(say('Puoi inviare lo schema iniziale oppure conservare le lettere e le nere inserite.','Send the starting puzzle or keep the letters and black squares you have entered.'));
  action(say('Con progressi','With progress'),()=>finish(true));action(say('Senza progressi','Without progress'),()=>finish(false));if(history.state?.exampleURL)action(say('Indietro','Back'),chooseFormat);
 }
 function chooseFormat(){screen(say('Come vuoi condividere o salvare?','How would you like to share or save?'));message(say('Il JSON conserva il cruciverba in un file. Il link permette di aprirlo dal sito.','JSON saves the crossword in a file. A link opens it from the website.'));action(say('File JSON','JSON file'),()=>{format='json';chooseProgress()});action(say('Link','Link'),()=>{format='link';chooseProgress()})}
 function shareLink(){opener=document.activeElement;format='json';if(history.state?.exampleURL){if(!dialog.open)dialog.showModal();chooseFormat()}else if(hasProgress()){if(!dialog.open)dialog.showModal();chooseProgress()}else finish(false)}
 window.MRCShareCrossword={share:shareLink};share.onclick=shareLink;
 document.addEventListener('mrc-crossword-view',()=>{panel.hidden=history.state?.mrcCrosswordView!=='play';if(dialog.open)dialog.close()});

}};
})();
