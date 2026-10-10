(() => {
  'use strict';
  const it = document.documentElement.lang === 'it';
  document.querySelectorAll('[data-copy]').forEach(button => {
    const box = button.closest('.codebox, .mrc-snippet');
    if (box && !box.querySelector('[role="status"]')) {
      const status = document.createElement('span');
      status.setAttribute('role', 'status');
      status.className = 'mrc-copy-status';
      button.after(status);
    }
    button.addEventListener('click', async () => {
      const code = document.getElementById(button.dataset.copy);
      if (!code) return;
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = it ? 'Copiato' : 'Copied';
      } catch (_) {
        const range = document.createRange(); range.selectNodeContents(code);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        button.textContent = it ? 'Selezionato: copia manualmente' : 'Selected: copy manually';
      }
      let status = button.closest('.codebox, .mrc-snippet').querySelector('[role="status"]');
      if (!status) { status = document.createElement('span'); status.setAttribute('role', 'status'); status.className = 'mrc-copy-status'; button.after(status); }
      status.textContent = button.textContent;
      setTimeout(() => { button.textContent = original; status.textContent = ''; }, 2500);
    });
  });
})();
