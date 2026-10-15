// ZIP STORE archives: UTF-8 filenames, CRC32, no remote dependencies.
const encoder=new TextEncoder();
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc(data){let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
export function makeZip(files){
 if(files.length>65535)throw Error('ZIP_LIMIT');let offset=0,centralSize=0;const parts=[],central=[];
 for(const f of files){const name=encoder.encode(f.name),data=encoder.encode(f.text);if(data.length>0xffffffff||offset+data.length>0xffffffff)throw Error('ZIP_LIMIT');const checksum=crc(data);
  const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,checksum,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);
  const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,checksum,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);parts.push(local,data);central.push(dir);offset+=local.length+data.length;centralSize+=dir.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}
export function splitRows(rows,column,header=true){const groups=new Map();for(const row of rows.slice(header?1:0)){const key=row[column]??'';if(!groups.has(key))groups.set(key,header?[rows[0]]:[]);groups.get(key).push(row)}return groups}
export function groupFilename(value,index){const safe=String(value).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').trim().slice(0,80)||'empty';return String(index+1).padStart(3,'0')+'_'+safe+'.csv'}
