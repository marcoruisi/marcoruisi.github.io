(function(){'use strict';const $=id=>document.getElementById(id),g=window.MRCGIS,lang=document.documentElement.lang==='it'?'it':'en';g.select($('pointsCrs'),'EPSG:4326');g.select($('rasterCrs'),'EPSG:4326');const m=g.map('map');const markers=L.layerGroup().addTo(m);let points=[],vectors=[],rasters=[],wmsSources=[],results=[];let nextSourceId=1;const maxPoints=500;let nextPointId=1;const editor=g.pointPrecision(m,{create:(lat,lon)=>putPoint(lat,lon),move:(p,lat,lon)=>{p.lat=lat;p.lon=lon;results=[];redraw();table()},remove:p=>{points=points.filter(x=>x!==p);results=[];redraw();table()}});function status(t){$('status').textContent=t}function putPoint(lat,lon,name){if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Invalid point');if(points.length>=maxPoints)throw Error('Maximum 500 points');points.push({id:nextPointId++,name:name||'P'+(points.length+1),lon,lat});redraw()}
function redraw(){markers.clearLayers();points.forEach(p=>{L.marker([p.lat,p.lon],{draggable:true}).on('click',()=>editor.edit(p,p.lat,p.lon)).on('dragend',e=>{const ll=e.target.getLatLng();p.lat=ll.lat;p.lon=ll.lng;results=[];redraw();table()}).addTo(markers)});$('pointCount').textContent=String(points.length);$('pointsList').replaceChildren();points.forEach(p=>{const li=document.createElement('li');li.className='gis-point-row';const txt=document.createElement('span');txt.textContent=`${p.name}: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} `;const edit=document.createElement('button');edit.type='button';edit.className='gis-point-action';edit.textContent=lang==='it'?'Sposta':'Move';edit.onclick=()=>editor.edit(p,p.lat,p.lon);const del=document.createElement('button');del.type='button';del.className='gis-point-action';del.textContent=lang==='it'?'Rimuovi':'Remove';del.onclick=()=>{points=points.filter(x=>x!==p);results=[];redraw();table()};li.append(txt,edit,del);$('pointsList').append(li)})}m.on('click',e=>editor.create(e.latlng.lat,e.latlng.lng));$('pointAdd').onclick=()=>{try{const [lon,lat]=g.lonlat(Number($('pointX').value.replace(',','.')),Number($('pointY').value.replace(',','.')),$('pointsCrs').value);putPoint(lat,lon,$('pointName').value.trim());m.panTo([lat,lon]);status('')}catch(e){status(e.message)}};$('pointFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;let arr;if(file.name.toLowerCase().endsWith('.json')||file.name.toLowerCase().endsWith('.geojson')){let obj=JSON.parse(await file.text());arr=(obj.type==='FeatureCollection'?obj.features:[]).filter(f=>f.geometry?.type==='Point').map((f,i)=>({name:f.properties?.name||'P'+(i+1),x:f.geometry.coordinates[0],y:f.geometry.coordinates[1]}))}else arr=g.parseTable(await file.text());if(!arr.length)throw Error('No usable points');for(const p of arr){const [lon,lat]=g.lonlat(p.x,p.y,$('pointsCrs').value);putPoint(lat,lon,p.name)}m.fitBounds(points.map(p=>[p.lat,p.lon]),{maxZoom:13});status(`${arr.length} points imported`)}catch(e){status(e.message)}e.target.value=''};$('pointClear').onclick=()=>{points=[];results=[];redraw();table()};
function ptRing(pt,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}function hit(point,geometry){if(!geometry)return false;const pt=[point.lon,point.lat];if(geometry.type==='Polygon'){const rings=geometry.coordinates;return ptRing(pt,rings[0])&&!rings.slice(1).some(r=>ptRing(pt,r))}if(geometry.type==='MultiPolygon')return geometry.coordinates.some(rings=>ptRing(pt,rings[0])&&!rings.slice(1).some(r=>ptRing(pt,r)));if(geometry.type==='Point')return Math.hypot(geometry.coordinates[0]-pt[0],geometry.coordinates[1]-pt[1])<.00001;if(geometry.type==='MultiPoint')return geometry.coordinates.some(c=>Math.hypot(c[0]-pt[0],c[1]-pt[1])<.00001);return false}
// Multiple named data sources. IDs are stable even if a source is removed.
const sourceTitle={vector:lang==='it'?'Vettore':'Vector',raster:'GeoTIFF',wms:'WMS'};
function sourceLabel(src){return `${sourceTitle[src.type]} ${src.id} · ${src.name}`;}
function sourceList(){
 for(const [type,list] of [['vector',vectors],['raster',rasters],['wms',wmsSources]]){
  const target=$(`${type}Sources`);target.replaceChildren();
  if(!list.length){const p=document.createElement('p');p.className='gis-note';p.textContent=lang==='it'?'Nessuna sorgente aggiunta.':'No sources added.';target.append(p);continue;}
  for(const src of list){const item=document.createElement('div');item.className='gis-source-item';
   const description=document.createElement('span');description.textContent=sourceLabel(src)+(src.details?` · ${src.details}`:'');description.title=description.textContent;
   const remove=document.createElement('button');remove.type='button';remove.className='gis-source-remove';remove.textContent=lang==='it'?'Rimuovi':'Remove';remove.setAttribute('aria-label',(lang==='it'?'Rimuovi ':'Remove ')+sourceLabel(src));
   remove.addEventListener('click',()=>{if(src.layer)m.removeLayer(src.layer);const arr=type==='vector'?vectors:type==='raster'?rasters:wmsSources;arr.splice(arr.indexOf(src),1);results=[];table();sourceList();status(lang==='it'?'Sorgente rimossa.':'Source removed.');});
   item.append(description,remove);target.append(item);
  }
 }
}
$('vectorFile').onchange=async e=>{const files=Array.from(e.target.files||[]);let loaded=0,errors=[];try{for(const file of files){try{let data;
 if(file.name.toLowerCase().endsWith('.zip')){const mod=await import('https://cdn.jsdelivr.net/npm/shpjs@6.2.0/dist/shp.esm.js');data=await mod.default(await file.arrayBuffer())}
 else data=JSON.parse(await file.text());
 const sets=Array.isArray(data)?data:[data];const features=sets.flatMap(s=>s.type==='FeatureCollection'?s.features:s.type==='Feature'?[s]:[]).filter(f=>f.geometry);
 if(!features.length)throw Error('No vector features found');
 vectors.push({id:nextSourceId++,type:'vector',name:file.name,features,details:`${features.length} features`});loaded++;
 }catch(err){errors.push(file.name+': '+err.message)}}sourceList();status(`${loaded} ${lang==='it'?'vettori caricati':'vectors loaded'}${errors.length?' · '+errors.join(' | '):''}`)}finally{e.target.value=''}};
$('rasterFile').onchange=async e=>{const files=Array.from(e.target.files||[]);let loaded=0,errors=[];try{for(const file of files){try{
 const mod=await import('https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm');const tif=await mod.fromBlob(file);const image=await tif.getImage();const bbox=image.getBoundingBox();
 if(!bbox.every(Number.isFinite)||bbox[2]===bbox[0]||bbox[3]===bbox[1])throw Error('Invalid raster bounds');
 rasters.push({id:nextSourceId++,type:'raster',name:file.name,image,bbox,crs:$('rasterCrs').value,details:`${image.getWidth()}×${image.getHeight()} · ${$('rasterCrs').value}`});loaded++;
 }catch(err){errors.push(file.name+': '+err.message)}}sourceList();status(`${loaded} ${lang==='it'?'raster caricati':'rasters loaded'}${errors.length?' · '+errors.join(' | '):''}`)}finally{e.target.value=''}};
// Diagnostic is advisory: image tiles can work even when GetCapabilities is blocked by CORS.
async function inspectWms(src){
 const cap=new URL(src.base);for(const key of [...cap.searchParams.keys()])if(['SERVICE','REQUEST','VERSION'].includes(key.toUpperCase()))cap.searchParams.delete(key);
 cap.searchParams.set('SERVICE','WMS');cap.searchParams.set('REQUEST','GetCapabilities');cap.searchParams.set('VERSION','1.1.1');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8500);
 try{
  const response=await fetch(cap.href,{signal:abort.signal,mode:'cors'});
  if(!response.ok)return {kind:'http',code:response.status};
  const body=await response.text();if(body.length>3500000)return {kind:'large'};
  const xml=new DOMParser().parseFromString(body,'text/xml');
  if(xml.querySelector('parsererror'))return {kind:'invalid'};
  const exception=xml.querySelector('ServiceException,ExceptionText');
  if(exception)return {kind:'exception',text:(exception.textContent||'').trim().slice(0,240)};
  const layers=[...xml.getElementsByTagName('*')].filter(n=>n.localName==='Layer');
  const names=layers.flatMap(layer=>[...layer.children].filter(n=>n.localName==='Name').map(n=>(n.textContent||'').trim())).filter(Boolean);
  if(!names.length)return {kind:'no-layers'};
  const wanted=src.name.split(',').map(x=>x.trim()).filter(Boolean);
  const absent=wanted.filter(x=>!names.includes(x));
  if(absent.length){const near=names.filter(x=>absent.some(y=>x.toLowerCase().includes(y.toLowerCase())||y.toLowerCase().includes(x.toLowerCase()))).slice(0,5);
   return {kind:'layer',absent,examples:near.length?near:names.slice(0,5)};}
  return {kind:'valid'};
 }catch(err){return {kind:err.name==='AbortError'?'timeout':'unavailable'};}
 finally{clearTimeout(timer)}
}
function wmsDiagnostic(src){
 const diagnostic=src.diagnostic;
 if(!diagnostic)return lang==='it'?'Controlla nome layer e risposta GetMap; verifica la scheda Rete del browser.':'Check layer name and GetMap response in browser Network tools.';
 switch(diagnostic.kind){
  case 'layer':return lang==='it'
   ?`Layer inesistente nel GetCapabilities: ${diagnostic.absent.join(', ')}. Layer disponibili, ad esempio: ${diagnostic.examples.join(', ')}.`
   :`Layer missing from GetCapabilities: ${diagnostic.absent.join(', ')}. Available examples: ${diagnostic.examples.join(', ')}.`;
  case 'valid':return lang==='it'?'Nome layer confermato dal GetCapabilities. Controlla GetMap nella scheda Rete (risposta XML, HTTP o immagine) e i parametri della mappa.':'Layer name confirmed by GetCapabilities. Inspect GetMap in Network (XML, HTTP or image response) and map parameters.';
  case 'http':return lang==='it'?`GetCapabilities: HTTP ${diagnostic.code}. Il server ha risposto con un errore.`:`GetCapabilities: HTTP ${diagnostic.code}. The server returned an error.`;
  case 'exception':return `GetCapabilities: ${diagnostic.text}`;
  case 'timeout':return lang==='it'?'GetCapabilities scaduto: il server è lento o non risponde a questa richiesta.':'GetCapabilities timed out: server is slow or did not respond to this request.';
  case 'unavailable':return lang==='it'?'GetCapabilities non leggibile dal browser (possibile CORS o rete). Non significa che il WMS sia offline: controlla GetMap nella scheda Rete.':'GetCapabilities inaccessible from browser (possible CORS or network issue). This does not mean the WMS is offline: inspect GetMap in Network.';
  default:return lang==='it'?'GetCapabilities non interpretabile. Controlla layer e risposta GetMap nella scheda Rete.':'GetCapabilities could not be parsed. Check layer and GetMap response in Network.';
 }
}
$('wmsAdd').onclick=()=>{try{
 const raw=$('wmsUrl').value.trim(),name=$('wmsName').value.trim();
 let parsed;try{parsed=new URL(raw)}catch{throw Error(lang==='it'?'Inserisci un URL WMS completo.':'Enter a complete WMS URL.');}
 if(parsed.protocol==='http:')throw Error(lang==='it'
  ?'Questo WMS usa HTTP e non puo essere caricato da MRC (HTTPS). Cerca un endpoint HTTPS ufficiale oppure scarica i dati e importali come GeoJSON, shapefile ZIP o GeoTIFF. Cambiare solo http in https non garantisce che il server funzioni.'
  :'This WMS uses HTTP and cannot be loaded from MRC (HTTPS). Find an official HTTPS endpoint, or download the data and import GeoJSON, shapefile ZIP or GeoTIFF. Simply replacing http with https does not guarantee the server works.');
 if(parsed.protocol!=='https:'||!name)throw Error(lang==='it'?'Servono un indirizzo WMS HTTPS e il nome del layer.':'An HTTPS WMS URL and layer name are required.');
 const layer=L.tileLayer.wms(parsed.href,{layers:name,format:'image/png',transparent:true,version:'1.1.1',attribution:'WMS'});
 const src={id:nextSourceId++,type:'wms',name,base:parsed.href,layer,query:$('wmsQuery').checked,details:lang==='it'?'Connessione da verificare':'Connection not yet verified'};
 // Leaflet requests several tiles per view. One failed tile does not mean the WMS is down.
 let successfulTiles=0,failedTiles=0,reportedFailure=false,cycle=0;
 layer.on('loading',()=>{cycle++;successfulTiles=0;failedTiles=0;reportedFailure=false;});
 layer.on('tileload',()=>{successfulTiles++;
  src.details=src.query?(lang==='it'?'Mappa caricata · GetFeatureInfo da verificare':'Map loaded · GetFeatureInfo not verified'):(lang==='it'?'Mappa caricata':'Map loaded');
  sourceList();
  if(reportedFailure){reportedFailure=false;status(lang==='it'?`WMS «${name}»: mappa nuovamente disponibile.`:`WMS “${name}”: map available again.`)}
 });
 layer.on('tileerror',()=>{failedTiles++;});
 layer.on('load',()=>{
  if(!failedTiles)return;
  if(successfulTiles){src.details=lang==='it'?'Mappa caricata parzialmente':'Map partially loaded';sourceList();return;}
  reportedFailure=true;src.details=lang==='it'?'Nessun tassello caricato':'No map tiles loaded';sourceList();
  const current=cycle;
  const show=()=>{if(!wmsSources.includes(src)||successfulTiles||current!==cycle)return;status(`${lang==='it'?`WMS «${name}»: nessuna immagine caricata.`:`WMS “${name}”: no images loaded.`} ${wmsDiagnostic(src)}`);};
  if(src.diagnostic)show();else{src.pendingReport=show;show();}
 });
 layer.addTo(m);wmsSources.push(src);
 inspectWms(src).then(diag=>{
  if(!wmsSources.includes(src))return;
  src.diagnostic=diag;
  if(diag.kind==='layer'){
   src.details=lang==='it'?'Nome layer non trovato nel servizio':'Layer name not found in service';sourceList();
   status(`${lang==='it'?`WMS «${name}»: `:`WMS “${name}”: `}${wmsDiagnostic(src)}`);
  }else if(src.pendingReport){const report=src.pendingReport;src.pendingReport=null;report();}
 });
 $('wmsName').value='';sourceList();status(lang==='it'?'WMS aggiunto; caricamento da verificare. GetFeatureInfo richiede un servizio interrogabile e CORS.':'WMS added; loading not yet verified. GetFeatureInfo requires query support and CORS.');
 }catch(e){status(e.message)};
};
async function sampleRaster(p,raster){
 const [x,y]=g.convert(p.lon,p.lat,'EPSG:4326',raster.crs);const {image,bbox}=raster;
 const width=image.getWidth(),height=image.getHeight();const col=Math.floor((x-bbox[0])/(bbox[2]-bbox[0])*width),row=Math.floor((bbox[3]-y)/(bbox[3]-bbox[1])*height);
 if(col<0||row<0||col>=width||row>=height)return {status:'outside'};
 const samples=await image.readRasters({window:[col,row,col+1,row+1]});const out={};samples.forEach((s,i)=>{out['band_'+(i+1)]=s[0]});return out;
}
async function wmsInfo(p,src){
 const d=.0006,par=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',LAYERS:src.name,QUERY_LAYERS:src.name,SRS:'EPSG:4326',BBOX:`${p.lon-d},${p.lat-d},${p.lon+d},${p.lat+d}`,WIDTH:'101',HEIGHT:'101',X:'50',Y:'50',INFO_FORMAT:'text/plain',FEATURE_COUNT:'10'});
 const url=new URL(src.base);for(const [k,v]of par)url.searchParams.set(k,v);
 try{const res=await fetch(url);if(!res.ok)throw Error('HTTP '+res.status);const t=(await res.text()).slice(0,2000);return {info:t.replace(/\s+/g,' ').trim()||'empty'}}catch(e){return {error:e.message}}
}
function prefix(src){return `${src.type==='vector'?'v':src.type==='raster'?'r':'w'}${src.id}_`}
function collect(out,src,values){const pre=prefix(src);for(const [key,value] of Object.entries(values))out[pre+key]=typeof value==='object'?JSON.stringify(value):value;}
function table(){const columns=[...new Set(results.flatMap(x=>Object.keys(x)))];$('resultHead').replaceChildren();$('resultRows').replaceChildren();columns.forEach(k=>{const th=document.createElement('th');th.textContent=k;$('resultHead').append(th)});results.forEach(row=>{const tr=document.createElement('tr');columns.forEach(k=>{const td=document.createElement('td');td.textContent=typeof row[k]==='object'?JSON.stringify(row[k]):String(row[k]??'');tr.append(td)});$('resultRows').append(tr)});$('resultCount').textContent=String(results.length)}
$('sample').onclick=async()=>{
 if(!points.length){status(lang==='it'?'Aggiungi o importa dei punti.':'Add or import points first');return}
 if(!vectors.length&&!rasters.length&&!wmsSources.some(s=>s.query)){status(lang==='it'?'Aggiungi almeno una sorgente interrogabile.':'Add at least one queryable source.');return}
 const btn=$('sample');btn.disabled=true;results=[];
 try{for(let i=0;i<points.length;i++){const p=points[i],out={name:p.name,lon:p.lon,lat:p.lat};
  for(const src of vectors){const hits=src.features.filter(f=>hit(p,f.geometry));const values={matches:hits.length};
   // All matching features are included as JSON, not silently discarded.
   if(hits.length){values.features=JSON.stringify(hits.map(f=>f.properties||{}));if(hits.length===1)for(const [key,v] of Object.entries(hits[0].properties||{}))values[key]=v;}
   collect(out,src,values);
  }
  for(const src of rasters){try{collect(out,src,await sampleRaster(p,src))}catch(err){collect(out,src,{error:err.message})}}
  for(const src of wmsSources)if(src.query)collect(out,src,await wmsInfo(p,src));
  results.push(out);status(`${i+1}/${points.length}`);
 }table();status((lang==='it'?'Dati estratti per ':'Extracted ')+results.length+(lang==='it'?' punti':' points'))}
 catch(e){status(e.message)}finally{btn.disabled=false}
};
$('csv').onclick=()=>{if(!results.length)return;const keys=[...new Set(results.flatMap(r=>Object.keys(r)))];g.download('mrc-gis-extracted.csv',g.csv(results,keys),'text/csv;charset=utf-8')};$('geojson').onclick=()=>{if(!results.length)return;const features=results.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.lon,r.lat]},properties:Object.fromEntries(Object.entries(r).filter(([k])=>!['lon','lat'].includes(k)))}));g.download('mrc-gis-extracted.geojson',JSON.stringify({type:'FeatureCollection',features},null,2),'application/geo+json')};$('shp').onclick=async()=>{try{if(!results.length)throw Error('Extract results first');status('Preparing shapefile...');const mod=await import('https://cdn.jsdelivr.net/npm/@mapbox/shp-write@0.4.3/+esm');const shp=mod.default||mod;const used=new Set(),dbfKeys=new Map();for(const row of results)for(const key of Object.keys(row)){
 if(key==='lon'||key==='lat'||dbfKeys.has(key))continue;
 const root=key.replace(/[^A-Za-z0-9_]/g,'_').slice(0,10)||'field';let short=root,n=1;
 while(used.has(short.toUpperCase())){const suf=String(n++);short=root.slice(0,10-suf.length)+suf}
 used.add(short.toUpperCase());dbfKeys.set(key,short);
 }
 const features=results.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.lon,r.lat]},properties:Object.fromEntries(Object.entries(r).filter(([k])=>!['lon','lat'].includes(k)).map(([k,v])=>[dbfKeys.get(k),String(v??'').slice(0,240)]))}));const data=await shp.zip({type:'FeatureCollection',features},{folder:'points',filename:'mrc-points',outputType:'blob'});g.download('mrc-gis-points.zip',data instanceof Blob?data:new Blob([data],{type:'application/zip'}));status('Shapefile downloaded (WGS84)')}catch(e){status('Shapefile export unavailable: '+e.message)}};redraw();sourceList()})();
