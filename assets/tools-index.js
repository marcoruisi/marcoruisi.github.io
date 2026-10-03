/* Progressive enhancement: all tools and their links remain in static HTML. */
(() => {
  'use strict';
  const bar=document.querySelector('.mrc-tool-filters');
  const list=document.getElementById('mrc-tools-list');
  const status=document.querySelector('.mrc-tool-filter-count');
  if(!bar||!list||!status)return;
  const buttons=Array.from(bar.querySelectorAll('[data-tool-filter]'));
  const rows=Array.from(list.querySelectorAll('[data-tool-tags]'));
  function filter(tag){
    let count=0;
    for(const row of rows){row.hidden=tag!=='all'&&!row.dataset.toolTags.split(' ').includes(tag);if(!row.hidden)count++;}
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.toolFilter===tag));
    status.textContent=`${count} ${status.dataset.countLabel}`;
  }
  for(const button of buttons)button.addEventListener('click',()=>filter(button.dataset.toolFilter));
  filter('all');bar.hidden=false;status.hidden=false;
})();
