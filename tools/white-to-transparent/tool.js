(() => {
  'use strict';
  const $ = id => document.getElementById(id), it = document.documentElement.lang === 'it';
  const say = (a,b) => it ? a : b;
  let source = null, filename = 'image', generation = 0, timer;
  function render() {
    if (!source) return;
    const w = source.width, h = source.height, pixels = new Uint8ClampedArray(source.data);
    const tolerance = Number($('tolerance').value), limit = Math.max(0,255-tolerance);
    const white = n => pixels[n*4+3] === 0 || Math.min(pixels[n*4],pixels[n*4+1],pixels[n*4+2]) >= limit;
    const mask = new Uint8Array(w*h);
    if ($('scope').value === 'all') {
      for (let n=0;n<mask.length;n++) if(white(n)) mask[n]=1;
    } else {
      const queue = new Int32Array(w*h); let head=0,tail=0;
      const add = n => {if(!mask[n] && white(n)){mask[n]=1;queue[tail++]=n;}};
      for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
      for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
      while(head<tail){const n=queue[head++],x=n%w;if(x>0)add(n-1);if(x<w-1)add(n+1);if(n>=w)add(n-w);if(n<(h-1)*w)add(n+w);}
    }
    const colour=$('colour').value;
    for(let n=0;n<mask.length;n++) {
      if(mask[n]) pixels[n*4+3]=0;
      else if(colour!=='original') pixels.fill(colour==='white'?255:0,n*4,n*4+3);
    }
    const pad=Math.max(0,Math.min(200,Number($('spacing').value)||0));
    const canvas=$('canvas');canvas.width=w+2*pad;canvas.height=h+2*pad;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';
    if($('shape').value==='rectangle')ctx.fillRect(0,0,canvas.width,canvas.height);
    if($('shape').value==='ellipse'){ctx.beginPath();ctx.ellipse(canvas.width/2,canvas.height/2,canvas.width/2,canvas.height/2,0,0,2*Math.PI);ctx.fill();}
    const layer=document.createElement('canvas');layer.width=w;layer.height=h;
    layer.getContext('2d').putImageData(new ImageData(pixels,w,h),0,0);ctx.drawImage(layer,pad,pad);
    $('preview').hidden=false;$('download').disabled=false;
    $('status').textContent=`${filename} · ${canvas.width} × ${canvas.height} px`;
  }
  $('file').addEventListener('change', async () => {
    const token=++generation, file=$('file').files[0];source=null;$('download').disabled=true;$('preview').hidden=true;
    if(!file)return;
    let bitmap;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error();
      bitmap=await createImageBitmap(file);
      if(token!==generation)return;
      if(bitmap.width*bitmap.height>16000000)throw Error();
      const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);
      source=ctx.getImageData(0,0,c.width,c.height);filename=file.name;render();
    }catch{if(token===generation)$('status').textContent=say('Impossibile aprire il file. Usa PNG, JPG o WebP fino a 16 milioni di pixel.','Cannot open this file. Use PNG, JPG or WebP up to 16 million pixels.');}
    finally{if(bitmap)bitmap.close();}
  });
  ['tolerance','scope','colour','shape','spacing'].forEach(id=>$(id).addEventListener('input',()=>{
    $('tolerance-value').value=$('tolerance').value;$('download').disabled=true;clearTimeout(timer);timer=setTimeout(render,100);
  }));
  $('background').addEventListener('change',()=>{$('preview').className='preview '+$('background').value;});
  $('download').addEventListener('click',()=>{
    const name=filename.replace(/\.[^.]+$/,'')+'-transparent.png';
    $('canvas').toBlob(blob=>{if(!blob){$('status').textContent=say('Esportazione non riuscita.','Export failed.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);},'image/png');
  });
  $('reset').addEventListener('click',()=>{generation++;clearTimeout(timer);source=null;$('file').value='';$('preview').hidden=true;$('download').disabled=true;$('status').textContent='';$('canvas').width=1;$('canvas').height=1;});
})();
