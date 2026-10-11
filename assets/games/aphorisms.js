/* MRC Games - Aphorisms. Static data, source-linked, no accounts. */
(()=>{'use strict';
const $=id=>document.getElementById(id),it=document.documentElement.lang==='it';
const t=it?{who:'Chi l’ha detto?',finish:'Completa la frase',n:'Domanda',of:'di',correct:'Esatto!',wrong:'Non proprio.',answer:'Risposta:',next:'Prossima domanda',again:'Nuova partita',done:'Partita conclusa!',result:'Hai indovinato',out:'su',source:'Fonte originale',translation:'Traduzione redazionale MRC',load:'Impossibile caricare la raccolta di aforismi. Riprova.',select:'Scegli una risposta.',whoHint:'Indovina l’autore della frase.',finishHint:'Scegli come termina la frase.',pick:'Scegli una modalità per iniziare.',end:'La partita è terminata. Vuoi giocare ancora?'}:
{who:'Who said it?',finish:'Complete the quote',n:'Question',of:'of',correct:'Correct!',wrong:'Not quite.',answer:'Answer:',next:'Next question',again:'New game',done:'Round complete!',result:'You got',out:'out of',source:'Original source',translation:'MRC editorial translation',load:'Could not load quotes. Try again.',select:'Choose an answer.',whoHint:'Guess the author of the quote.',finishHint:'Choose how the quote ends.',pick:'Choose a mode to start.',end:'Your round is over. Play again?'};
let quotes=[],mode='who',round=[],position=0,score=0,locked=false;
const shuffle=a=>{let copy=[...a];for(let i=copy.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy};
const n=(tag,cls,txt)=>{let el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el};
function answerOptions(q){if(mode==='who'){let others=shuffle([...new Set(quotes.map(x=>x.author).filter(v=>v!==q.author))]).slice(0,3);return shuffle([q.author,...others]).map(v=>({value:v,correct:v===q.author}))}
const ending=q[it?'it':'en'].ending;const others=shuffle([...new Set(quotes.filter(x=>x.id!==q.id).map(x=>x[it?'it':'en'].ending))]).slice(0,2);return shuffle([ending,...others]).map(v=>({value:v,correct:v===ending}))}
function render(){if(position>=round.length){completed();return}locked=false;const q=round[position],piece=q[it?'it':'en'];$('aq-progress').textContent=`${t.n} ${position+1} ${t.of} ${round.length} · ${score} ${it?'punti':'points'}`;
$('aq-instruction').textContent=mode==='who'?t.whoHint:t.finishHint;
$('aq-quote').textContent=mode==='who'?`“${piece.text}”`:`“${piece.lead} …”`;
const options=$('aq-options');options.replaceChildren();for(const v of answerOptions(q)){const b=n('button','aq-answer',v.value);b.type='button';b.dataset.correct=v.correct?'1':'0';b.addEventListener('click',()=>choose(b,q));options.append(b)}
$('aq-feedback').replaceChildren();$('aq-next').hidden=true;$('aq-game').hidden=false;$('aq-end').hidden=true;}
function choose(button,q){if(locked)return;locked=true;const yes=button.dataset.correct==='1';if(yes)score++;for(const b of $('aq-options').querySelectorAll('button')){b.disabled=true;if(b.dataset.correct==='1')b.classList.add('is-correct');else if(b===button)b.classList.add('is-wrong')}
const feedback=$('aq-feedback');feedback.replaceChildren();const msg=n('strong','',yes?t.correct:t.wrong);feedback.append(msg,n('p','',`${t.answer} ${mode==='who'?q.author:q[it?'it':'en'].ending}`));
const meta=n('p','aq-source',`${q.author} · ${q.work} · `);const link=n('a','',t.source);link.href=q.source;link.target='_blank';link.rel='noopener noreferrer';meta.append(link);feedback.append(meta);
if(q.original!==(it?'it':'en'))feedback.append(n('small','aq-translation',t.translation));
$('aq-next').hidden=false;$('aq-next').textContent=position===round.length-1?t.done:t.next;
}
function completed(){const end=$('aq-end');end.hidden=false;end.setAttribute('role','alertdialog');end.setAttribute('aria-modal','true');$('aq-game').hidden=true;$('aq-final').textContent=`${t.result} ${score} ${t.out} ${round.length}.`;$('aq-new').focus({preventScroll:true});}
function start(chosen){mode=chosen;score=position=0;round=shuffle(quotes).slice(0,Math.min(10,quotes.length));$('aq-mode').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));render();}
$('aq-mode').addEventListener('click',ev=>{let b=ev.target.closest('[data-mode]');if(b&&quotes.length)start(b.dataset.mode)});
$('aq-next').addEventListener('click',()=>{if(locked){position++;render()}});
$('aq-new').addEventListener('click',()=>start(mode));
$('aq-next').hidden=true;$('aq-end').hidden=true;
fetch('/assets/games/aphorisms/quotes.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{quotes=data.items.filter(q=>q&&q.source&&q.author&&q.it?.text&&q.en?.text&&q.it?.ending&&q.en?.ending);if(quotes.length<4)throw Error('Insufficient quotes');start('who')}).catch(()=>{$('aq-progress').textContent=t.load;$('aq-mode').querySelectorAll('button').forEach(b=>b.disabled=true)});
})();