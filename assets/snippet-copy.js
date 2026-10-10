(() => {
  'use strict';
  const it = document.documentElement.lang === 'it';
  document.querySelectorAll('[data-copy]').forEach(button => {
    const original = button.textContent;
    button.setAttribute('aria-live', 'polite');
    let timer;
    button.addEventListener('click', async () => {
      const code = document.getElementById(button.dataset.copy);
      if (!code) return;
      clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = it ? 'Copiato' : 'Copied';
      } catch (_) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = it ? 'Selezionato' : 'Selected';
      }
      timer = setTimeout(() => { button.textContent = original; }, 2500);
    });
  });
})();
