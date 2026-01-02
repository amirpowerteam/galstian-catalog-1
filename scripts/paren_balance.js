const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;let m;let idx=0;let target=null;while((m=re.exec(s))){idx++;if(idx===16){target=m[2];break;}}
if(!target){console.error('script#16 not found');process.exit(1);}const lines=target.split(/\r?\n/);
let cum = {paren:0,brace:0,brack:0};
for(let i=0;i<lines.length;i++){
  const L=lines[i];
  for(let j=0;j<L.length;j++){
    const ch=L[j];
    if(ch==='\\') { j++; continue; }
    if(ch==="\'") continue; // naive skip
    if(ch==='(') cum.paren++;
    if(ch===')') cum.paren--;
    if(ch==='{' ) cum.brace++;
    if(ch==='}') cum.brace--;
    if(ch==='[') cum.brack++;
    if(ch===']') cum.brack--;
  }
  if(cum.paren!==0 || cum.brace!==0 || cum.brack!==0){
    console.log(('   '+(i+1)).slice(-4)+": paren="+cum.paren+" brace="+cum.brace+" brack="+cum.brack+"  => "+lines[i]);
  }
}
console.log('FINAL counts:', cum);
