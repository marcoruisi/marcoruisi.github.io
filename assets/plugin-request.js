/* No online endpoint is configured. Prepare a draft through the existing email contact. */
(() => {
  'use strict';
  const form = document.querySelector('[data-plugin-request]');
  if (!form) return;
  const it = document.documentElement.lang === 'it';
  const pick = (a, b) => it ? a : b;
  const error = document.getElementById('request-error');
  const link = form.querySelector('[data-request-email]');
  const status = form.querySelector('[data-request-status]');
  const initialMessage = form.elements.message.value;
  form.addEventListener('input', () => { link.hidden = true; link.removeAttribute('href'); status.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault(); error.hidden = true;
    Array.from(form.elements).forEach(field => field.removeAttribute('aria-invalid'));
    const bad = Array.from(form.elements).find(field => field.willValidate && !field.checkValidity());
    const incomplete = form.elements.message.value.trim() === initialMessage.trim();
    if (bad || incomplete) {
      const field = bad || form.elements.message;
      field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', 'request-error');
      error.textContent = pick('Controlla email e URL e completa il messaggio spiegando come vorresti usare il plugin.', 'Check your email and URL, and complete the message with how you would use the plugin.');
      error.hidden = false; field.focus(); return;
    }
    const values = new FormData(form);
    const body = [values.get('message'), '', 'Email: ' + values.get('email'), 'Website: ' + (values.get('website') || '—'), '', 'Plugin ID: ' + values.get('plugin_id'), 'Plugin: ' + values.get('plugin_name'), 'Source: ' + values.get('source_url'), 'Language: ' + values.get('language')].join('\n');
    link.href = 'mailto:marcoruisi@gmail.com?subject=' + encodeURIComponent('MRC · ' + values.get('plugin_name')) + '&body=' + encodeURIComponent(body);
    link.hidden = false;
    status.textContent = pick('Bozza pronta. Aprila nel programma email, controllala e inviala da lì. Nessuna richiesta è stata inviata dal sito.', 'Draft ready. Open it in your email app, review it and send it there. No request has been sent by the site.');
    link.focus();
  });
})();
