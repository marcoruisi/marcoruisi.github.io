/* One local dictionary shared by the wizard and topic tools. No external API. */
(()=>{'use strict';
const labels={cinema:['Cinema','Cinema'],musica:['Musica','Music'],scienza:['Scienza','Science'],natura:['Natura','Nature'],storia:['Storia','History'],geografia:['Geografia','Geography'],sport:['Sport','Sport'],letteratura:['Letteratura','Literature'],tecnologia:['Tecnologia','Technology'],curiosita:['Curiosità','Curiosities']};
const aliases={music:'musica',science:'scienza',nature:'natura',history:'storia',geography:'geografia',sports:'sport',literature:'letteratura',technology:'tecnologia',curiosities:'curiosita',animali:'natura',animals:'natura',piante:'natura',plants:'natura',film:'cinema',astronomia:'scienza',astronomy:'scienza'};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const word=s=>normalize(s).toUpperCase().replace(/[^A-Z]/g,'');
let cache;
function parse(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[]}}else field+=c}
 if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}
 const header=rows.shift().map(x=>x.replace(/^\uFEFF/,''));
 return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]||'']))).filter(r=>r.word);
}
async function load(lang='it'){
 if(!cache)cache=fetch('/assets/games/crossword-fillers.csv',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Dictionary unavailable');return r.text()}).then(parse).catch(e=>{cache=null;throw e});
 return (await cache).filter(r=>r.lang===lang&&/^[A-Z]{3,14}$/.test(r.word)).map(r=>({word:r.word,clue:r.clue_it,source:'',bankTopic:r.topic,bankCategory:r.category,tags:r.tags||r.topic||''}));
}
function search(bank,query='',category=''){
 if(category)return bank.filter(p=>(p.tags+' '+p.bankTopic).split(/\s+/).includes(category));
 const terms=normalize(query).match(/[a-z]{2,}/g)||[];
 if(!terms.length)return bank;
 const mapped=terms.map(t=>aliases[t]||t);
 return bank.filter(p=>{const hay=normalize(p.word+' '+p.clue+' '+p.tags+' '+p.bankTopic);return mapped.some(t=>hay.includes(t))});
}
function list(text,bank=[]){const known=new Map(bank.map(p=>[p.word,p]));return [...new Map(text.split(/[\n;,]+/).filter(s=>s.trim()).map(line=>{const [raw,...clue]=line.split('|'),w=word(raw);if(!/^[A-Z]{3,14}$/.test(w))throw Error('3–14 letters / lettere: '+raw);return [w,{word:w,clue:clue.length?clue.join('|').trim():(known.get(w)?.clue||''),source:''}]})).values()]}
globalThis.MRCCrosswordBank={load,search,list,labels,normalize,word};
})();
