const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('Usage: node report_summary.js <json>'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(p,'utf8'));
const summary = { time: data.time || null, env: data.env || {}, filesCount: Object.keys(data.files || {}).length };
const filesArr = Object.entries(data.files || {}).map(([k,v])=>({path:k, status: v && v.status, length: v && v.length ? v.length : (v && v.text ? (v.text.en? v.text.en.length : 0) : 0)}));
filesArr.sort((a,b)=> (b.length||0) - (a.length||0));
summary.topFiles = filesArr.slice(0,10);

const errorHits = [];
const largeStrings = [];

function walk(obj, keyPath){
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)){
    const v = obj[k];
    if (/error|exception|stack|message/i.test(k)){
      errorHits.push({path: keyPath.concat(k).join('.'), key:k, value: typeof v === 'string' ? v.slice(0,1000) : JSON.stringify(v).slice(0,1000)});
      if (errorHits.length > 200) return;
    }
    if (typeof v === 'string' && v.length > 1000){
      largeStrings.push({path: keyPath.concat(k).join('.'), len: v.length, sample: v.slice(0,200)});
      if (largeStrings.length > 200) return;
    }
    if (typeof v === 'object') walk(v, keyPath.concat(k));
  }
}

walk(data, []);
summary.errorCount = errorHits.length;
summary.errors = errorHits.slice(0,50);
summary.largeStrings = largeStrings.slice(0,50);
fs.writeFileSync('detailed_bug_report_summary.json', JSON.stringify(summary, null, 2), 'utf8');
console.log('Wrote detailed_bug_report_summary.json');
