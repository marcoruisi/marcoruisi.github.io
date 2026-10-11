/* MRC language preference: home-only first-visit routing; manual choice always wins. */
(()=>{'use strict';
 const KEY='mrc-language-choice';
 const read=()=>{try{return localStorage.getItem(KEY)}catch{return null}};
 const save=value=>{try{localStorage.setItem(KEY,value)}catch{}};
 document.addEventListener('click',e=>{
   const a=e.target.closest('a');if(!a)return;
   const nav=a.closest('.header-language,.popup-language,.language-switch,.mrc-tool-language');
   if(!nav)return;
   const label=a.textContent.trim().toLowerCase();
   const lang=(a.getAttribute('lang')||label).toLowerCase();
   if(lang==='it'||lang==='en')save(lang);
 },true);
 // Only the English homepage is a language-detection entry point.
 // Never redirect direct links to Italian pages, tools or games.
 if(location.pathname!=='/' || location.search || location.hash)return;
 const preferred=read();
 const browser=(navigator.languages&&navigator.languages.length?navigator.languages[0]:navigator.language||'').toLowerCase();
 if(preferred==='it'||(!preferred&&/^it(?:-|$)/.test(browser))){location.replace('/it/');}
})();
