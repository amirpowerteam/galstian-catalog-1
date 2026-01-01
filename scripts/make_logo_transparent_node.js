const fs = require('fs');
const { PNG } = require('pngjs');

const src = 'assets/galstian-logo.png';
const out = 'assets/galstian-logo.png';
const outCopy = 'assets/galstian-logo-transparent.png';
const b64File = 'assets/galstian-logo.b64';

function readPng(path){
  const buf = fs.readFileSync(path);
  return PNG.sync.read(buf);
}

function writePng(png, path){
  const buf = PNG.sync.write(png);
  fs.writeFileSync(path, buf);
}

function mostCommonBorderColor(png){
  const {width, height, data} = png;
  const counts = new Map();
  function addColor(r,g,b){
    const key = r+','+g+','+b;
    counts.set(key, (counts.get(key)||0)+1);
  }
  for(let x=0;x<width;x++){
    let idxTop = (0*width + x)<<2;
    addColor(data[idxTop], data[idxTop+1], data[idxTop+2]);
    let idxBot = ((height-1)*width + x)<<2;
    addColor(data[idxBot], data[idxBot+1], data[idxBot+2]);
  }
  for(let y=0;y<height;y++){
    let idxL = (y*width + 0)<<2;
    addColor(data[idxL], data[idxL+1], data[idxL+2]);
    let idxR = (y*width + (width-1))<<2;
    addColor(data[idxR], data[idxR+1], data[idxR+2]);
  }
  let max=0, best=null;
  for(const [k,v] of counts.entries()){
    if(v>max){ max=v; best=k; }
  }
  const parts = best.split(',').map(s=>parseInt(s,10));
  return {r:parts[0], g:parts[1], b:parts[2]};
}

function colorDist(c1,c2){
  return Math.sqrt(
    (c1.r-c2.r)*(c1.r-c2.r)+
    (c1.g-c2.g)*(c1.g-c2.g)+
    (c1.b-c2.b)*(c1.b-c2.b)
  );
}

try{
  if(!fs.existsSync(src)){
    console.error('Source file not found:', src);
    process.exit(2);
  }
  const png = readPng(src);
  const bg = mostCommonBorderColor(png);
  const {width, height, data} = png;
  const threshold = 60; // tweak if needed
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const idx = (y*width + x)<<2;
      const r = data[idx], g=data[idx+1], b=data[idx+2];
      const dist = colorDist({r,g,b}, bg);
      if(dist < threshold){
        data[idx+3] = 0; // set alpha 0
      }
    }
  }
  // write outputs
  writePng(png, outCopy);
  writePng(png, out);
  const outBuf = fs.readFileSync(out);
  const b64 = outBuf.toString('base64');
  fs.writeFileSync(b64File, b64, {encoding:'ascii'});
  console.log('TRANSPARENT_DONE', out, outCopy, b64File);
}catch(err){
  console.error('ERROR', err);
  process.exit(1);
}
