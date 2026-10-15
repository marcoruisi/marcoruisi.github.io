import {replaceAll, cleanup, exportCSV, parseCSV} from './core.mjs';
const it = document.documentElement.lang === 'it';
const pick = (a, b) => it ? a : b;
const $ = id => document.getElementById(id);
const messages = {
 csvSyntax: pick('CSV non valido: controlla virgolette e separatori.', 'Invalid CSV: check quotes and separators.'),
 csvHeader: pick('La prima riga deve contenere le colonne find,replace.', 'The first row must contain the columns find,replace.'),
 csvColumns: pick('Ogni riga del CSV deve avere esattamente due campi.', 'Each CSV row must have exactly two fields.'),
 csvEmptyFind: pick('Il campo find non può essere vuoto nel CSV.', 'The find field cannot be empty in the CSV.'),
 utf8: pick('Il file non è un CSV UTF-8 valido.', 'The file is not valid UTF-8 CSV.')
};
let rules = [], serial = 0, result = '';
function stale() {
 $('result-section').hidden = true; $('status').textContent = ''; result = '';
}
function addRule(find = '', replace = '', focus = false) {
 const rule = {find, replace}, id = ++serial;
 rules.push(rule);
 const row = document.createElement('div'); row.className = 'rule';
 for (const [key, label] of [['find', pick('Trova', 'Find')], ['replace', pick('Sostituisci con', 'Replace with')]]) {
   const wrapper = document.createElement('label'); wrapper.htmlFor = `${key}-${id}`;
   const name = document.createElement('span'); name.textContent = label;
   const input = document.createElement('textarea'); input.id = wrapper.htmlFor; input.rows = 2; input.value = rule[key]; input.spellcheck = false;
   input.addEventListener('input', () => {rule[key] = input.value; stale();});
   wrapper.append(name, input); row.append(wrapper);
 }
 const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = pick('Elimina coppia', 'Remove pair');
 remove.addEventListener('click', () => {rules = rules.filter(r => r !== rule); row.remove(); stale(); $('add-rule').focus();});
 row.append(remove); $('rules').append(row);
 if (focus) row.querySelector('textarea').focus();
}
function download(text, name, type) {
 const url = URL.createObjectURL(new Blob([text], {type}));
 const a = document.createElement('a'); a.href = url; a.download = name;
 document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('add-rule').addEventListener('click', () => {addRule('', '', true); stale();});
for (const id of ['source', 'case-sensitive', 'clean-spaces', 'clean-trim', 'clean-lines']) $(id).addEventListener('input', stale);
$('apply').addEventListener('click', () => {
 stale();
 if ($('source').value === '') { $('status').textContent = pick('Inserisci un testo da elaborare.', 'Enter some text to process.'); $('source').focus(); return; }
 if (rules.some(r => r.find === '' && r.replace !== '')) { $('status').textContent = pick('Compila «Trova» oppure elimina la coppia incompleta.', 'Fill in “Find” or remove the incomplete pair.'); return; }
 try {
   const replaced = replaceAll($('source').value, rules, $('case-sensitive').checked);
   result = cleanup(replaced.text, {spaces: $('clean-spaces').checked, trim: $('clean-trim').checked, blankLines: $('clean-lines').checked});
   $('result').value = result; $('result-section').hidden = false;
   const count = replaced.count.toLocaleString(it ? 'it-IT' : 'en-GB');
   $('count').textContent = pick(`Sostituzioni effettuate: ${count}.`, `Replacements made: ${count}.`) +
     (replaced.count === 0 ? pick(' Nessuna corrispondenza.', ' No matches.') : '') +
     (result !== replaced.text ? pick(' Pulizia del testo applicata.', ' Text cleanup applied.') : '') +
     (result === '' ? pick(' Il risultato è vuoto.', ' The result is empty.') : '');
   $('status').textContent = pick('Elaborazione completata.', 'Processing complete.');
 } catch { $('status').textContent = pick('Impossibile elaborare il testo. Prova con meno testo o meno regole.', 'Unable to process the text. Try less text or fewer rules.'); }
});
$('copy').addEventListener('click', async () => {
 try {
   await navigator.clipboard.writeText(result);
   $('copy-status').textContent = pick('Risultato copiato.', 'Result copied.');
 } catch {
   $('result').focus(); $('result').select();
   $('copy-status').textContent = pick('Copia automatica non disponibile. Il risultato è selezionato: usa il comando Copia.', 'Automatic copying is unavailable. The result is selected: use the Copy command.');
 }
});
$('download').addEventListener('click', () => download(result, 'mrc-text.txt', 'text/plain;charset=utf-8'));
$('export').addEventListener('click', () => {
 if (rules.some(r => r.find === '' && r.replace !== '')) { $('csv-status').textContent = pick('Compila «Trova» prima di esportare.', 'Fill in “Find” before exporting.'); return; }
 download(exportCSV(rules), 'mrc-find-replace.csv', 'text/csv;charset=utf-8');
});
$('import').addEventListener('change', async event => {
 const file = event.target.files[0]; if (!file) return;
 try {
   let csv;
   try {csv = new TextDecoder('utf-8', {fatal: true}).decode(await file.arrayBuffer());} catch {throw new Error('utf8');}
   const imported = parseCSV(csv);
   rules = []; $('rules').replaceChildren();
   imported.forEach(r => addRule(r.find, r.replace)); stale();
   $('csv-status').textContent = pick(`${imported.length} coppie importate. Premi Applica per usarle.`, `${imported.length} pairs imported. Press Apply to use them.`);
 } catch (error) { $('csv-status').textContent = messages[error.message] || pick('Impossibile leggere il file.', 'Unable to read the file.'); }
 event.target.value = '';
});
addRule();
