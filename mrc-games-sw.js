/* MRC games offline v1 — site root scope needed for both /games/ and /it/giochi/ */
const VERSION='mrc-games-offline-20261011-v1';
const FILES=['/assets/games/2048-focus.js','/assets/games/2048.js','/assets/games/aphorisms.css','/assets/games/aphorisms.js','/assets/games/aphorisms/quotes.json','/assets/games/crossword-follow.js','/assets/games/crossword-mobile.css','/assets/games/crossword-mobile.js','/assets/games/crosswords/index.json','/assets/games/crosswords/mrc-cruciverba.json','/assets/games/games-shell.css','/assets/games/games.css','/assets/games/offline.js','/assets/games/playtime.js','/assets/games/puzzle-extra.css','/assets/games/puzzle-kit.js','/assets/games/puzzle-maker.js','/assets/games/puzzle-play.js','/assets/games/sudoku.js','/assets/shared-ui.css','/assets/tool-shell.css','/games/','/games/2048/','/games/aphorisms/','/games/codebreaker/','/games/crossword/','/games/sequences/','/games/sudoku/','/games/wordsearch/','/it/giochi/','/it/giochi/2048/','/it/giochi/aforismi/','/it/giochi/codice-segreto/','/it/giochi/cruciverba/','/it/giochi/sequenze/','/it/giochi/sudoku/','/it/giochi/trova-parole/'];
const GAME_PREFIXES=['/games/','/it/giochi/','/assets/games/'];
const SHARED=new Set(['/assets/shared-ui.css','/assets/tool-shell.css','/assets/language-preference.js']);
const isGame=(url)=>url.origin===self.location.origin&&(GAME_PREFIXES.some(p=>url.pathname.startsWith(p))||SHARED.has(url.pathname));
async function downloadAll(){
 const cache=await caches.open(VERSION);let failed=[];
 for(const path of FILES){
  try{const response=await fetch(new Request(path,{cache:'reload'}));if(!response.ok||response.type==='opaque')throw Error('HTTP '+response.status);await cache.put(path,response.clone());}
  catch(e){failed.push(path);}
 }
 return {ready:failed.length===0,loaded:FILES.length-failed.length,total:FILES.length,failed};
}
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('mrc-games-offline-')&&key!==VERSION)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',e=>{
 const port=e.ports&&e.ports[0];if(!port)return;
 e.waitUntil((async()=>{
  if(e.data&&e.data.type==='MRC_GAMES_PREPARE')port.postMessage(await downloadAll());
  else if(e.data&&e.data.type==='MRC_GAMES_STATUS'){
   const cache=await caches.open(VERSION);const keys=await cache.keys();const have=new Set(keys.map(x=>new URL(x.url).pathname));
   port.postMessage({ready:FILES.every(p=>have.has(p)),loaded:FILES.filter(p=>have.has(p)).length,total:FILES.length});
  }
 })());
});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||!isGame(new URL(e.request.url)))return;
 e.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  try{const response=await fetch(e.request);
   if(response.ok&&response.type==='basic')await cache.put(e.request,response.clone());
   return response;
  }catch(error){const fallback=await cache.match(e.request,{ignoreSearch:true});if(fallback)return fallback;
   if(e.request.mode==='navigate')return new Response('<!doctype html><html lang="it"><meta charset="utf-8"><title>Offline</title><body><h1>Gioco non disponibile offline</h1><p>Riconnettiti e prepara i giochi dalla pagina Giochi.</p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
   throw error;
  }
 })());
});
