// Shared browser-only case transformations for MRC Tools.
export function changeCase(value, mode = 'none', locale = 'it') {
  const s = String(value);
  if (mode === 'lower') return s.toLocaleLowerCase(locale);
  if (mode === 'upper') return s.toLocaleUpperCase(locale);
  if (mode === 'title') return s.toLocaleLowerCase(locale).replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (m, prefix, letter) => prefix + letter.toLocaleUpperCase(locale));
  if (mode === 'sentence') return s.toLocaleLowerCase(locale).replace(/(^|[.!?]+[\s"'“”«»([{]*|\n[\s"'“”«»([{]*)(\p{L})/gu, (m, prefix, letter) => prefix + letter.toLocaleUpperCase(locale));
  return s;
}
