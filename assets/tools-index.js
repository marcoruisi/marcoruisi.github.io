/* Search combines with catalogue filters and remains in the URL/language switch. */
(()=>{'use strict';
const bar=document.querySelector('.mrc-tool-filters'),list=document.getElementById('mrc-tools-list'),status=document.querySelector('.mrc-tool-filter-count'),search=document.getElementById('mrc-tool-search');if(!bar||!list||!status)return;
const buttons=[...bar.querySelectorAll('[data-tool-filter]')],rows=[...list.querySelectorAll('[data-tool-tags]')],byTag=new Map(buttons.map(b=>[b.dataset.toolFilter,b]));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
const texts=new Map(rows.map(r=>[r,norm(r.textContent+' '+(r.dataset.toolTags||''))]));
function state(){const p=new URLSearchParams(location.search);return {category:byTag.has(p.get('category'))?p.get('category'):'all',q:p.get('q')||''}}
function apply(){const {category,q}=state(),chosen=byTag.get(category)||buttons[0],terms=norm(q).trim().split(/\s+/).filter(Boolean);let count=0;
if(search&&search.value!==q)search.value=q;
for(const row of rows){const tags=(row.dataset.toolTags||'').split(/\s+/),field=chosen.dataset.filterField;const categoryMatch=category==='all'||(field==='type'?row.dataset.toolType===category:field==='availability'?row.dataset.toolAvailability===category:tags.includes(category));const match=categoryMatch&&terms.every(t=>texts.get(row).includes(t));row.hidden=!match;if(match)count++}
for(const b of buttons)b.setAttribute('aria-pressed',String(b===chosen));status.textContent=`${count} ${status.dataset.countLabel}`;
for(const link of document.querySelectorAll('.mrc-tool-language a[lang]')){const u=new URL(link.href,location.origin);category==='all'?u.searchParams.delete('category'):u.searchParams.set('category',category);q?u.searchParams.set('q',q):u.searchParams.delete('q');link.href=u.pathname+u.search+u.hash}
}
function navigate(category,q,push){const u=new URL(location.href);category==='all'?u.searchParams.delete('category'):u.searchParams.set('category',category);q?u.searchParams.set('q',q):u.searchParams.delete('q');history[push?'pushState':'replaceState'](history.state,'',u.pathname+u.search+u.hash);apply()}
for(const b of buttons)b.onclick=()=>navigate(b.dataset.toolFilter,search?.value||state().q,true);
if(search){search.oninput=()=>navigate(state().category,search.value,false);search.closest('.mrc-tool-search').hidden=false}
const clear=document.getElementById('mrc-tool-search-clear');if(clear)clear.onclick=()=>{navigate(state().category,'',false);search.focus()};
window.addEventListener('popstate',apply);apply();bar.hidden=false;status.hidden=false;
})();
