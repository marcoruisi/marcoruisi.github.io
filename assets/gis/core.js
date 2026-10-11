/* MRC GIS common - coordinate convention: X=easting/longitude, Y=northing/latitude */
(function(){'use strict';
const defs={
 'EPSG:4326':{label:'WGS84 · longitude / latitude',unit:'deg'},
 'EPSG:3857':{label:'Web Mercator · metres',unit:'m'},
 'EPSG:32632':{label:'WGS84 / UTM 32N',unit:'m',def:'+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs'},
 'EPSG:32633':{label:'WGS84 / UTM 33N',unit:'m',def:'+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs'},
 'EPSG:25832':{label:'ETRS89 / UTM 32N',unit:'m',def:'+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs'},
 'EPSG:25833':{label:'ETRS89 / UTM 33N',unit:'m',def:'+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs'}
};
function ready(){if(typeof proj4==='undefined')throw Error('Projection library not loaded. Check your connection.');Object.entries(defs).forEach(([k,v])=>{if(v.def)proj4.defs(k,v.def)})}
function convert(x,y,from,to){ready();const a=proj4(from,to,[Number(x),Number(y)]);if(!a.every(Number.isFinite))throw Error('Invalid coordinates');return a}
function lonlat(x,y,from){const p=convert(x,y,from,'EPSG:4326');if(Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('Point outside geographic bounds');return p}
function select(node,value='EPSG:4326'){node.replaceChildren();for(const [code,v] of Object.entries(defs)){const el=document.createElement('option');el.value=code;el.textContent=`${code} — ${v.label}`;node.appendChild(el)}node.value=value}
function csvCell(x){const t=String(x??'');return /[",\n\r;]/.test(t)?'"'+t.replaceAll('"','""')+'"':t}
function csv(rows,columns){return '\ufeff'+[columns.join(';'),...rows.map(r=>columns.map(k=>csvCell(r[k])).join(';'))].join('\r\n')}
function download(filename,content,type='text/plain;charset=utf-8'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function copy(t){return navigator.clipboard?.writeText(t).catch(()=>fallback(t))??fallback(t)}function fallback(t){const x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();document.execCommand('copy');x.remove()}
function map(id,center=[42.7,12.5]){if(typeof L==='undefined')throw Error('Map library not loaded');const m=L.map(id,{scrollWheelZoom:false}).setView(center,6);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);return m}
function parseTable(raw){const lines=raw.trim().split(/\r?\n/).filter(Boolean);if(!lines.length)return[];const sep=lines[0].includes(';')?';':lines[0].includes('\t')?'\t':',';const parse=l=>{let q=false,v='',out=[];for(let i=0;i<l.length;i++){let c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){v+='"';i++}else q=!q}else if(c===sep&&!q){out.push(v.trim());v=''}else v+=c}out.push(v.trim());return out};const header=parse(lines.shift()).map(x=>x.toLowerCase());const xi=header.findIndex(x=>['x','lon','longitude','easting'].includes(x)),yi=header.findIndex(x=>['y','lat','latitude','northing'].includes(x)),ni=header.findIndex(x=>['name','nome','id','label'].includes(x));if(xi<0||yi<0)throw Error('CSV must have X/Y or longitude/latitude columns');return lines.map((l,i)=>{const a=parse(l);return {name:a[ni]||'P'+(i+1),x:Number(a[xi].replace(',','.')),y:Number(a[yi].replace(',','.'))}}).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))}
window.MRCGIS={defs,ready,convert,lonlat,select,csv,download,copy,map,parseTable};})();
