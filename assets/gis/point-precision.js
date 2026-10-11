(function(){'use strict';
const it=document.documentElement.lang==='it';
const t=(a,b)=>it?a:b;
window.MRCGIS=window.MRCGIS||{};
window.MRCGIS.pointPrecision=function(map,opts){
 const holder=map.getContainer(),box=document.createElement('section');box.className='gis-precision';box.hidden=true;
 box.innerHTML='<div class="gis-precision-top"><strong class="gis-precision-title"></strong><button type="button" class="gis-precision-close" aria-label="Close">×</button></div><p class="gis-precision-hint"></p><div class="gis-precision-map" role="application" aria-label="Precision map"></div><div class="gis-precision-coords" aria-live="polite"></div><div class="gis-actions"><button type="button" class="gis-precision-confirm primary"></button><button type="button" class="gis-precision-remove"></button><button type="button" class="gis-precision-cancel"></button></div>';
 holder.insertAdjacentElement('afterend',box);
 const q=s=>box.querySelector(s),mini=L.map(q('.gis-precision-map'),{zoomControl:true,attributionControl:false}).setView(map.getCenter(),16);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(mini);
 let marker=L.marker(map.getCenter(),{draggable:true}).addTo(mini),current=null;
 const update=()=>{const ll=marker.getLatLng();q('.gis-precision-coords').textContent=`${ll.lat.toFixed(7)}, ${ll.lng.toFixed(7)} · EPSG:4326`};
 marker.on('drag',update);marker.on('dragend',update);
 mini.on('click',e=>{marker.setLatLng(e.latlng);update()});
 q('.gis-precision-hint').textContent=t('Sposta il marcatore nella lente o tocca la posizione esatta. Puoi ingrandire ulteriormente.','Drag the marker in the magnifier or tap the precise location. Zoom in further if needed.');
 q('.gis-precision-confirm').textContent=t('Conferma posizione','Confirm position');q('.gis-precision-cancel').textContent=t('Annulla','Cancel');q('.gis-precision-remove').textContent=t('Rimuovi punto','Remove point');
 const close=()=>{box.hidden=true;current=null};q('.gis-precision-close').onclick=close;q('.gis-precision-cancel').onclick=close;
 q('.gis-precision-confirm').onclick=()=>{if(!current)return;const ll=marker.getLatLng();if(current.kind==='create')opts.create(ll.lat,ll.lng);else opts.move(current.id,ll.lat,ll.lng);close()};
 q('.gis-precision-remove').onclick=()=>{if(current?.kind==='edit')opts.remove(current.id);close()};
 function open(lat,lng,id){current=id==null?{kind:'create'}:{kind:'edit',id};q('.gis-precision-title').textContent=id==null?t('Posiziona un nuovo punto','Place a new point'):t('Sposta o rimuovi il punto','Move or remove point');q('.gis-precision-remove').hidden=id==null;box.hidden=false;mini.invalidateSize();mini.setView([lat,lng],Math.max(15,Math.min(map.getZoom()+4,19)),{animate:false});marker.setLatLng([lat,lng]);update();box.scrollIntoView({block:'nearest',behavior:'smooth'})}
 return {create:(lat,lng)=>open(lat,lng,null),edit:(id,lat,lng)=>open(lat,lng,id),close};
};
})();
