// Literal matching on the original only. Longer rules claim overlaps first.
export function replaceAll(original, rules, caseSensitive = false) {
  const ranked = rules.map((r, order) => ({...r, order, length: [...r.find].length}))
    .filter(r => r.find !== '').sort((a, b) => b.length - a.length || a.order - b.order);
  const occupied = new Uint8Array(original.length), matches = [];
  for (const rule of ranked) {
    const escaped = rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, caseSensitive ? 'gu' : 'giu');
    let match;
    while ((match = pattern.exec(original))) {
      const start = match.index, end = start + match[0].length;
      let free = true;
      for (let i = start; i < end; i++) if (occupied[i]) { free = false; break; }
      if (free) {
        occupied.fill(1, start, end);
        matches.push({start, end, replacement: rule.replace});
      }
      // Include overlapping occurrences, without splitting surrogate pairs.
      pattern.lastIndex = start + (original.codePointAt(start) > 0xffff ? 2 : 1);
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const parts = []; let cursor = 0;
  for (const m of matches) { parts.push(original.slice(cursor, m.start), m.replacement); cursor = m.end; }
  parts.push(original.slice(cursor));
  return {text: parts.join(''), count: matches.length};
}

export function cleanup(text, options = {}) {
  if (options.spaces) text = text.replace(/ {2,}/g, ' ');
  // Only ordinary spaces, never tabs, NBSP or other Unicode whitespace.
  if (options.trim) text = text.replace(/(^|[\r\n]) +/g, '$1').replace(/ +(?=[\r\n]|$)/g, '');
  if (options.blankLines) {
    const lines = text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) || [];
    let previousBlank = false;
    text = lines.filter(line => {
      const blank = /^ *(?:\r\n|\r|\n)$/.test(line);
      const keep = !blank || !previousBlank;
      previousBlank = blank;
      return keep;
    }).join('');
  }
  return text;
}

export function exportCSV(rules) {
  const field = value => '"' + value.replace(/"/g, '""') + '"';
  return 'find,replace\r\n' + rules.filter(r => r.find !== '' || r.replace !== '')
    .map(r => [r.find, r.replace].map(field).join(',')).join('\r\n');
}

export function parseCSV(csv) {
  if (csv.startsWith('\ufeff')) csv = csv.slice(1);
  const rows = []; let row = [], field = '', state = 'start';
  const fail = () => { throw new Error('csvSyntax'); };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (state === 'quoted') {
      if (c === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++; } else state = 'closed';
      } else field += c;
    } else if (c === ',' || c === '\r' || c === '\n') {
      row.push(field); field = ''; state = 'start';
      if (c !== ',') { rows.push(row); row = []; if (c === '\r' && csv[i + 1] === '\n') i++; }
    } else if (c === '"') {
      if (state !== 'start') fail();
      state = 'quoted';
    } else {
      if (state === 'closed') fail();
      field += c; state = 'plain';
    }
  }
  if (state === 'quoted') fail();
  if (row.length || field !== '' || state !== 'start') { row.push(field); rows.push(row); }
  if (!rows.length || rows[0].length !== 2 || rows[0][0] !== 'find' || rows[0][1] !== 'replace') throw new Error('csvHeader');
  return rows.slice(1).map(row => {
    if (row.length !== 2) throw new Error('csvColumns');
    if (row[0] === '') throw new Error('csvEmptyFind');
    return {find: row[0], replace: row[1]};
  });
}
