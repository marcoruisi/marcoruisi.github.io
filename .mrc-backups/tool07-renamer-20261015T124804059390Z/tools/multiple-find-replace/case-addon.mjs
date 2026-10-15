import {changeCase} from './case-transform.mjs';
const it = document.documentElement.lang === 'it';
const $ = id => document.getElementById(id);
const reference = $('clean-lines');
if (reference && $('apply') && $('result')) {
  const box = document.createElement('div');
  box.className = 'mrc-case-panel';
  const label = document.createElement('label');
  label.htmlFor = 'mrc-case-mode';
  label.textContent = it ? 'Maiuscole / minuscole' : 'Letter case';
  const select = document.createElement('select');
  select.id = 'mrc-case-mode';
  for (const [value, a, b] of [
    ['none', 'Non modificare', 'No change'],
    ['lower', 'Tutto minuscolo', 'Lowercase'],
    ['upper', 'Tutto MAIUSCOLO', 'UPPERCASE'],
    ['sentence', 'Normalizzato (inizio frase)', 'Sentence case'],
    ['title', 'Iniziale di ogni parola maiuscola', 'Capitalize Every Word']
  ]) {const option = document.createElement('option');option.value=value;option.textContent=it?a:b;select.append(option);}
  const help = document.createElement('p');
  help.textContent = it ? 'La trasformazione si applica dopo le sostituzioni e la pulizia del testo. Non riconosce automaticamente i nomi propri.' : 'Applied after replacements and cleanup. Proper names are not detected automatically.';
  box.append(label,select,help);
  const cleanupSection = reference.closest('fieldset') || reference.closest('section') || reference.parentElement?.parentElement;
  cleanupSection?.after(box);
  select.addEventListener('change', () => { $('result-section').hidden=true; $('status').textContent=''; });
  // The existing Apply handler runs first and produces the unmodified result.
  $('apply').addEventListener('click', () => {
    if ($('result-section').hidden || select.value==='none') return;
    const transformed = changeCase($('result').value,select.value,it?'it':'en');
    $('result').value=transformed;
    // Existing clipboard and TXT callbacks use private module state. Sync it by
    // passing the final text through the original output when those actions fire.
  });
  // Use the displayed output as the single source for copy/download via capture.
  const copy=$('copy');
  if(copy) copy.addEventListener('click',event=>{
    if(select.value==='none'||$('result-section').hidden)return;
    event.stopImmediatePropagation();
    navigator.clipboard.writeText($('result').value).then(()=>{$('copy-status').textContent=it?'Risultato copiato.':'Result copied.';}).catch(()=>{$('result').focus();$('result').select();$('copy-status').textContent=it?'Selezionato: usa Copia.':'Selected: use Copy.';});
  },true);
  const download=$('download');
  if(download) download.addEventListener('click',event=>{
    if(select.value==='none'||$('result-section').hidden)return;
    event.stopImmediatePropagation();
    const url=URL.createObjectURL(new Blob([$('result').value],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='mrc-text.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  },true);
}
