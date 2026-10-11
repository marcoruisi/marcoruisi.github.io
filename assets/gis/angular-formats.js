(()=>{'use strict';
const q=s=>document.querySelector(s),lang=document.documentElement.lang==='it'?'it':'en',it=lang==='it';
const el={raw:q('#gis4-raw'),lat:q('#gis4-lat'),lon:q('#gis4-lon'),format:q('#gis4-format'),result:q('#gis4-result'),status:q('#gis4-status'),map:q('#gis4-map'),table:q('#gis4-table'),separator:q('#gis4-separator')};
const label=it?{err:'Coordinate non valide. Controlla valori, minuti, secondi ed emisferi.',copied:'Copiato negli appunti.',failed:'Copia non disponibile: seleziona il risultato e copialo.',ready:'Coordinate convertite. Sistema: WGS84 (EPSG:4326).',paste:'Inserisci entrambe le coordinate.',range:'Latitudine massimo 90°, longitudine massimo 180°.', lat:'Latitudine',lon:'Longitudine',copy:'Copia',copyLabel:'Copia',decimal:'Separatore decimale'}:{err:'Invalid coordinates. Check values, minutes, seconds and hemispheres.',copied:'Copied to clipboard.',failed:'Copy unavailable: select and copy the result.',ready:'Coordinates converted. Datum: WGS84 (EPSG:4326).',paste:'Enter both coordinates.',range:'Latitude max 90°, longitude max 180°.',lat:'Latitude',lon:'Longitude',copy:'Copy',copyLabel:'Copy',decimal:'Decimal separator'};
const parseNumber=s=>{let v=Number(String(s).trim().replace(',','.'));return Number.isFinite(v)?v:NaN};
function parseOne(value,axis){let s=String(value||'').trim().toUpperCase().replace(/[−–]/g,'-');if(!s)return NaN;const compass=s.match(/[NSEW]/g)||[];if(compass.length>1||compass.some(x=>axis==='lat'?!'NS'.includes(x):!'EW'.includes(x)))return NaN;
const h=compass[0]||'',explicit=/^[\s+-]*-/.test(s),hasPlus=/^[\s]*\+/.test(s);s=s.replace(/[NSEW]/g,'').trim();if(/[a-z]/i.test(s))return NaN;
const decimal=/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;let abs;
if(decimal.test(s))abs=Math.abs(parseNumber(s));
else {let parts=s.match(/[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)/g)||[];if(parts.length<2||parts.length>3)return NaN;let rest=s.replace(/[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)/g,'').replace(/[°º'′’"″:\s]/g,'');if(rest)return NaN;let n=parts.map(parseNumber);if(n.some(x=>!Number.isFinite(x))||n[0]<0&&parts[0][0]!=='-'||n.slice(1).some(x=>x<0)||n[1]>=60||(n.length===3&&n[2]>=60))return NaN;abs=Math.abs(n[0])+n[1]/60+(n[2]||0)/3600;}
let nSign=explicit||s.startsWith('-')?-1:1;if(h){const hSign=/[SW]/.test(h)?-1:1;if((explicit&&hSign===1)||(hasPlus&&hSign===-1))return NaN;nSign=hSign;}
let limit=axis==='lat'?90:180;return abs<=limit+1e-11?nSign*abs:NaN;}
const fixed=(n,p)=>n.toFixed(p).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
function format(v,axis,type){const hemi=axis==='lat'?(v<0||Object.is(v,-0)?'S':'N'):(v<0||Object.is(v,-0)?'W':'E');let a=Math.abs(v);if(type==='dd')return fixed(v,8)+'°';if(type==='dmm'){let whole=Math.floor(a),minutes=(a-whole)*60;minutes=Math.round(minutes*1e6)/1e6;if(minutes>=60){whole++;minutes=0;}return `${whole}° ${minutes.toFixed(6)}′ ${hemi}`;}
let total=Math.round(a*3600*100)/100,deg=Math.floor(total/3600);let rem=total-deg*3600,min=Math.floor(rem/60),sec=rem-min*60;return `${deg}° ${String(min).padStart(2,'0')}′ ${sec.toFixed(2).padStart(5,'0')}″ ${hemi}`;}
const outputNumber=(value)=>el.separator.value==='comma'?String(value).replace(/\./g,','):String(value);
function outputFormat(v,axis,type){return outputNumber(type==='dd'?fixed(v,8):format(v,axis,type));}
function copyValue(value){
 const fallback=()=>{const field=document.createElement('textarea');field.value=value;field.style.cssText='position:fixed;opacity:0;left:-9999px';document.body.append(field);field.select();let ok=false;try{ok=document.execCommand('copy');}catch{}field.remove();return ok;};
 if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(value).then(()=>{el.status.textContent=label.copied;}).catch(()=>{el.status.textContent=fallback()?label.copied:label.failed;});}
 else el.status.textContent=fallback()?label.copied:label.failed;
}
function renderResults(latitude,longitude){
 el.result.replaceChildren();
 for(const [type,name] of [['dd','DD'],['dmm','DMM'],['dms','DMS']]){
  const section=document.createElement('section');section.className='gis4-result-group';
  const heading=document.createElement('h3');heading.textContent=name;section.append(heading);
  for(const [axis,coordinate] of [['lat',latitude],['lon',longitude]]){
   const row=document.createElement('div');row.className='gis4-result-row';
   const description=document.createElement('span');description.className='gis4-result-name';description.textContent=label[axis];
   const value=document.createElement('output');value.className='gis4-result-value';value.textContent=outputFormat(coordinate,axis,type);
   const button=document.createElement('button');button.type='button';button.className='gis4-copy-value';button.textContent=label.copy;button.setAttribute('aria-label',`${label.copyLabel} ${label[axis]} ${name}`);
   button.addEventListener('click',()=>copyValue(value.textContent));
   row.append(description,value,button);section.append(row);
  }
  el.result.append(section);
 }
}
try {const chosen=localStorage.getItem('mrc-gis4-decimal-separator');if(chosen==='comma'||chosen==='dot')el.separator.value=chosen;}catch{}
el.separator.addEventListener('change',()=>{try{localStorage.setItem('mrc-gis4-decimal-separator',el.separator.value)}catch{} if(el.table.dataset.lat)renderResults(Number(el.table.dataset.lat),Number(el.table.dataset.lon));});
function calculate(){const latitude=parseOne(el.lat.value,'lat'),longitude=parseOne(el.lon.value,'lon');if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){el.status.textContent=label.err;el.result.textContent='';el.map.hidden=true;return;}renderResults(latitude,longitude);el.status.textContent=label.ready;el.map.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latitude.toFixed(8)+','+longitude.toFixed(8))}`;el.map.hidden=false;el.table.dataset.lat=String(latitude);el.table.dataset.lon=String(longitude);}
q('#gis4-convert').addEventListener('click',calculate);
q('#gis4-from-text').addEventListener('click',()=>{let t=el.raw.value.trim();let chunks=t.split(/[;\n]/).map(v=>v.trim()).filter(Boolean);if(chunks.length===1){let s=chunks[0];let matches=[...s.matchAll(/([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:\s*[°º]\s*\d+(?:[.,]\d+)?\s*[′’']?\s*(?:\d+(?:[.,]\d+)?\s*[″"]?)?)?\s*[NS])|([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:\s*[°º]\s*\d+(?:[.,]\d+)?\s*[′’']?\s*(?:\d+(?:[.,]\d+)?\s*[″"]?)?)?\s*[EW])/gi)].map(x=>x[0].trim());if(matches.length===2)chunks=matches;else {let m=s.split(/\s*,\s*(?=[+-]?\d)/);if(m.length===2)chunks=m;else {let p=s.split(/\s+/);if(p.length===2)chunks=p;}}}
if(chunks.length!==2){el.status.textContent=label.paste;return;}el.lat.value=chunks[0];el.lon.value=chunks[1];calculate();});
q('#gis4-example').addEventListener('click',()=>{el.lat.value='44° 29′ 12″ N';el.lon.value='11° 20′ 15″ E';calculate();});
q('#gis4-copy').addEventListener('click',()=>{if(!el.table.dataset.lat)return;copyValue([...el.result.querySelectorAll('.gis4-result-group')].map(group=>group.querySelector('h3').textContent+'\n'+[...group.querySelectorAll('.gis4-result-row')].map(row=>row.querySelector('.gis4-result-name').textContent+': '+row.querySelector('output').textContent).join('\n')).join('\n\n'));});
q('#gis4-csv').addEventListener('click',()=>{
 if(!el.table.dataset.lat)return;
 const lat=Number(el.table.dataset.lat),lon=Number(el.table.dataset.lon),decimalComma=el.separator.value==='comma';
 const separator=decimalComma?';':',';
 const fields=[outputNumber(fixed(lat,8)),outputNumber(fixed(lon,8)),outputFormat(lat,'lat','dmm'),outputFormat(lon,'lon','dmm'),outputFormat(lat,'lat','dms'),outputFormat(lon,'lon','dms')];
 const header=['latitude_dd','longitude_dd','latitude_dmm','longitude_dmm','latitude_dms','longitude_dms'].join(separator);
 const content=header+'\n'+fields.map(v=>'"'+v.replace(/"/g,'""')+'"').join(separator)+'\n';
 const url=URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='mrc-coordinates-formats.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
q('#gis4-format').addEventListener('change',()=>{const type=el.format.value;if(!el.table.dataset.lat)return;const lat=Number(el.table.dataset.lat),lon=Number(el.table.dataset.lon);el.lat.value=outputFormat(lat,'lat',type);el.lon.value=outputFormat(lon,'lon',type);});
})();