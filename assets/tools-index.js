/* MRC Tools index: shareable category filters, no duplicate index pages. */
(() => {
  'use strict';
  const bar = document.querySelector('.mrc-tool-filters');
  const list = document.getElementById('mrc-tools-list');
  const status = document.querySelector('.mrc-tool-filter-count');
  if (!bar || !list || !status) return;

  const PARAM = 'category';
  const buttons = [...bar.querySelectorAll('[data-tool-filter]')];
  const rows = [...list.querySelectorAll('[data-tool-tags]')];
  const byTag = new Map(buttons.map(button => [button.dataset.toolFilter, button]));
  const languageLinks = [...document.querySelectorAll('.mrc-tool-language a[lang]')];

  function readCategory() {
    const params = new URLSearchParams(location.search);
    const value = (params.get(PARAM) || 'all').toLowerCase();
    return byTag.has(value) ? value : 'all';
  }

  function setLanguageLinks(category) {
    for (const link of languageLinks) {
      const url = new URL(link.href, location.origin);
      if (category === 'all') url.searchParams.delete(PARAM);
      else url.searchParams.set(PARAM, category);
      link.href = url.pathname + url.search + url.hash;
    }
  }

  function applyCategory(category) {
    const chosen = byTag.get(category) || byTag.get('all');
    if (!chosen) return;
    const tag = chosen.dataset.toolFilter;
    const field = chosen.dataset.filterField;
    let count = 0;
    for (const row of rows) {
      const tags = (row.dataset.toolTags || '').split(/\s+/);
      const match = tag === 'all' || (field === 'type'
        ? row.dataset.toolType === tag
        : field === 'availability'
          ? row.dataset.toolAvailability === tag
          : tags.includes(tag));
      row.hidden = !match;
      if (match) count++;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button === chosen));
    status.textContent = `${count} ${status.dataset.countLabel}`;
    setLanguageLinks(tag);
  }

  function navigateCategory(category) {
    const url = new URL(location.href);
    if (category === 'all') url.searchParams.delete(PARAM);
    else url.searchParams.set(PARAM, category);
    history.pushState(null, '', url.pathname + url.search + url.hash);
    applyCategory(category);
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const category = button.dataset.toolFilter;
      if (category !== readCategory()) navigateCategory(category);
    });
  }
  window.addEventListener('popstate', () => applyCategory(readCategory()));
  applyCategory(readCategory());
  bar.hidden = false;
  status.hidden = false;
})();
