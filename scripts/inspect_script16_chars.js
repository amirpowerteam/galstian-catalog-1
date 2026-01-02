const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;let m;let idx=0;let target=null;while((m=re.exec(s))){idx++;if(idx===16){target=m[2];break;}}
if(!target){console.error('script#16 not found');process.exit(1);}const lines=target.split(/\r?\n/);
const inspectLine = (n)=>{
  const L = lines[n-1]||'';
  console.log('LINE',n,':',JSON.stringify(L));
  for(let i=0;i<L.length;i++){
    const ch=L[i];
    const code=L.charCodeAt(i);
    process.stdout.write(`${i}:${ch}(${code}) `);
    if(i>200) break;
  }
  console.log('\n');
};
// find occurrence of 'importBackupFromRepo' (or broken parts)
for(let i=1;i<=lines.length;i++){
  if(lines[i-1] && lines[i-1].includes('importBackup')){
    console.log('Found importBackup on line',i);
    inspectLine(i);
    if(lines[i]){console.log('Next line:');inspectLine(i+1);}    
  }
}
// Also show nearby lines 90-100
const start = Math.max(1,90); for(let j=start;j<=110 && j<=lines.length;j++){ console.log(('   '+j).slice(-4)+': '+lines[j-1]); }
