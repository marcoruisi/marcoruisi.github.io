/* Progressive enhancement: all tools and their links remain in static HTML. */
(() => {
  'use strict';
  const bar=document.querySelector('.mrc-tool-filters');
  const list=document.getElementById('mrc-tools-list');
  const status=document.querySelector('.mrc-tool-filter-count');
  if(!bar||!list||!status)return;
  const buttons=Array.from(bar.querySelectorAll('[data-tool-filter]'));
  const rows=Array.from(list.querySelectorAll('[data-tool-tags]'));
  function filter(button){
    const tag=button.dataset.toolFilter;
    const field=button.dataset.filterField;
    let count=0;
    for(const row of rows){
      const match=field==='type'?row.dataset.toolType===tag:field==='availability'?row.dataset.toolAvailability===tag:row.dataset.toolTags.split(' ').includes(tag);
      row.hidden=tag!=='all'&&!match;if(!row.hidden)count++;
    }
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.toolFilter===tag));
    // Announce the total for All and the visible count for every filtered view.
    status.textContent=`${count} ${status.dataset.countLabel}`;
  }
  for(const button of buttons)button.addEventListener('click',()=>filter(button));
  filter(buttons[0]);bar.hidden=false;status.hidden=false;
})();
