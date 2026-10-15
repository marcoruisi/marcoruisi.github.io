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
}
