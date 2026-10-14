/* Personal construction: all search, placement and review stay on this device. */
(()=>{'use strict';const host=document.getElementById('cwWizard');if(!host)return;
const it=document.documentElement.lang.startsWith('it'),lang=it?'it':'en',say=(a,b)=>it?a:b,$=id=>document.getElementById(id);
let pairs=[],worker=null,mode='topic';
const status=$('cwWizardStatus'),review=$('cwReview');
for(const [key,label] of Object.entries(MRCCrosswordBank.labels)){const opt=document.createElement('option');opt.value=key;opt.textContent=label[it?0:1];$('cwCategory').append(opt)}
function select(next){mode=next;host.querySelectorAll('[data-wizard-panel]').forEach(p=>p.hidden=p.dataset.wizardPanel!==mode);host.querySelectorAll('[data-wizard-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wizardMode===mode)))}
host.querySelectorAll('[data-wizard-mode]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.wizardMode)));
function rows(){review.replaceChildren();for(const p of pairs){const row=document.createElement('div');row.className='cw-review-row';const word=document.createElement('input'),clue=document.createElement('input'),remove=document.createElement('button');word.value=p.word;word.maxLength=14;word.setAttribute('aria-label',say('Parola','Word'));clue.value=p.clue||'';clue.placeholder=say('Definizione facoltativa','Optional clue');clue.setAttribute('aria-label',clue.placeholder);remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',say('Rimuovi parola','Remove word'));remove.onclick=()=>row.remove();row.append(word,clue,remove);review.append(row)}}
function read(){const result=[];for(const row of review.children){const [w,c]=row.querySelectorAll('input');if(w.value.trim())result.push({word:MRCCrosswordBank.word(w.value),clue:c.value.trim(),source:''})}if(result.some(p=>! /^[A-Z]{3,14}$/.test(p.word)))throw Error(say('Usa parole di 3–14 lettere.','Use words of 3–14 letters.'));return [...new Map(result.map(p=>[p.word,p])).values()]}
function shuffle(data){const a=data.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function busy(flag){$('cwGenerate').disabled=flag;$('cwRegenerate').disabled=flag;$('cwGenerate').setAttribute('aria-busy',String(flag))}
async function generate(revised=false){try{
 if(revised)pairs=read();else{const bank=await MRCCrosswordBank.load(lang);if(mode==='list')pairs=MRCCrosswordBank.list($('cwWords').value,bank);else{const query=$('cwTopic').value.trim();if(mode==='topic'&&!query)throw Error(say('Scrivi un argomento.','Enter a topic.'));pairs=shuffle(MRCCrosswordBank.search(bank,mode==='topic'?query:'',mode==='category'?$('cwCategory').value:'')).slice(0,24)}}
 if(pairs.length<3)throw Error(say('Nel dizionario non ci sono abbastanza parole pertinenti. Prova un tema più ampio o inserisci una lista.','Not enough matching dictionary words. Try a broader topic or enter a list.'));
 if(pairs.length>48)throw Error(say('Usa al massimo 48 parole.','Use at most 48 words.'));
 busy(true);status.textContent=say('Costruisco gli incastri sul tuo dispositivo…','Building crossings on your device…');
 worker?.terminate();worker=new Worker('/assets/games/crossword-worker.js');
 worker.onmessage=({data})=>{worker.terminate();worker=null;busy(false);if(data.error){status.textContent=data.error;return}const valid=MRCCrosswordJSON.load(data.project);if(!valid){status.textContent=say('Schema non valido.','Invalid puzzle.');return}valid.ui.lang=lang;valid.ui.mode='clues';document.dispatchEvent(new CustomEvent('mrc-crossword-generated',{detail:valid}));rows();$('cwReviewBox').hidden=false;status.textContent=say(`${data.grid.words.length} parole inserite su ${pairs.length}. Puoi giocare subito o rifinire lo schema.`,`${data.grid.words.length} of ${pairs.length} words placed. Play now or refine the puzzle.`)};
 worker.onerror=()=>{worker?.terminate();worker=null;busy(false);status.textContent=say('Generazione non riuscita. Riprova.','Generation failed. Try again.')};worker.postMessage({pairs:shuffle(pairs),lang});
 }catch(e){busy(false);status.textContent=e.message}}
$('cwGenerate').onclick=()=>generate();$('cwRegenerate').onclick=()=>generate(true);$('cwAdd').onclick=()=>{pairs=read();pairs.push({word:'',clue:''});rows()};
$('cwPhoto').onclick=()=>{$('startPhoto').click()};select('topic');
})();
