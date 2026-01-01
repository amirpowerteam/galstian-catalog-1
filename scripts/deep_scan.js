const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) { console.error('Usage: node deep_scan.js <report.json>'); process.exit(1); }

function safeParse(p){
  try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch(e){ console.error('Failed to read/parse',p,e); process.exit(2); }
}

const data = safeParse(input);
const report = { time: data.time || null, env: data.env || {}, issues: [], summary: {} };

// 1) Console errors/warnings
const consoleEntries = (data.console && data.console.recent) || [];
report.summary.consoleCount = consoleEntries.length;
report.consoleErrors = consoleEntries.filter(e => e.level === 'error' || e.level === 'warn');
if (report.consoleErrors.length) report.issues.push({type:'console', severity:'medium', detail:`${report.consoleErrors.length} console warn/error entries`});

// 2) Storage secrets
const local = (data.storage && data.storage.localStorage) || {};
const sensitive = [];
const SENSITIVE_RE = /api[_-]?key|token|secret|password|authorization|gemini|openai/i;
for (const k of Object.keys(local)){
  try {
    const v = local[k];
    if (SENSITIVE_RE.test(k) && v && String(v).length>0) sensitive.push({key:k,valuePreview: String(v).slice(0,200)});
  } catch(e){}
}
if (sensitive.length) { report.issues.push({type:'secrets', severity:'high', detail:`Found ${sensitive.length} sensitive storage keys`}); }
report.sensitiveKeys = sensitive;

// 3) Service worker / CACHE_VERSION mismatch
function extractCacheVersionFromText(txt){
  if (!txt || typeof txt !== 'string') return null;
  const m = /CACHE_VERSION\s*=\s*['`\"]([0-9A-Za-z_\-\.]+)['`\"]/i.exec(txt);
  if (m) return m[1];
  const m2 = /Version:\s*([0-9A-Za-z_\-\.]+)/i.exec(txt);
  if (m2) return m2[1];
  return null;
}
const files = data.files || {};
const swText = files['/sw.js'] && files['/sw.js'].text && (files['/sw.js'].text.head || files['/sw.js'].text);
const indexText = files['/index.html'] && files['/index.html'].text && (files['/index.html'].text.head || files['/index.html'].text);
const swVer = extractCacheVersionFromText(swText);
const idxVer = extractCacheVersionFromText(indexText) || (files['/index.html'] && files['/index.html'].text && files['/index.html'].text.head && /Version:\s*([0-9A-Za-z_\-\.]+)/i.exec(files['/index.html'].text.head) && /Version:\s*([0-9A-Za-z_\-\.]+)/i.exec(files['/index.html'].text.head)[1]);
if (swVer && idxVer && swVer !== idxVer) report.issues.push({type:'sw_cache_version', severity:'medium', detail:`sw.js CACHE_VERSION='${swVer}' vs index.html Version='${idxVer}'`});
report.sw = {swVersion: swVer, indexVersion: idxVer};

// 4) Caches: large entries
const caches = (data.caches && data.caches['galstian-cache-runtime-2025-12-26-1'] && data.caches['galstian-cache-runtime-2025-12-26-1'].entries) || (data.caches && Object.values(data.caches).reduce((acc,cur)=> acc.concat((cur && cur.entries)||[]),[]));
const largeCache = [];
if (Array.isArray(caches)){
  for (const e of caches){
    try{
      if (e.bodySize && e.bodySize > 200000) largeCache.push({url:e.url, size:e.bodySize});
    }catch(e){}
  }
}
if (largeCache.length) report.issues.push({type:'large_cache_entries', severity:'low', detail:`${largeCache.length} cached responses >200KB`});
report.largeCache = largeCache.slice(0,50);

// 5) IndexedDB heavy items (images/data URIs)
const idb = data.indexedDB || {};
const idbSummary = {dbs: Object.keys(idb).length, stores: {}};
for (const dbName of Object.keys(idb)){
  try{
    const db = idb[dbName];
    const stores = db.stores || {};
    idbSummary.stores[dbName] = {};
    for (const sName of Object.keys(stores)){
      const s = stores[sName];
      const sample = s && s.sample || [];
      let images = 0, totalApprox=0;
      for (const item of sample){
        function walkObj(o){
          if (!o) return;
          if (typeof o === 'string'){
            if (o.startsWith('data:') && o.indexOf('base64,')!==-1){ images++; const b64=o.split('base64,')[1]; totalApprox += Math.floor((b64.replace(/\s+/g,'').length*3)/4); }
          } else if (typeof o==='object'){
            for (const k of Object.keys(o)) walkObj(o[k]);
          }
        }
        walkObj(item);
      }
      idbSummary.stores[dbName][sName] = {sampleCount: sample.length, images, totalApprox};
      if (images>0) report.issues.push({type:'indexeddb_images', severity:'medium', detail:`store ${sName} in ${dbName} contains ~${images} image samples (~${totalApprox} bytes)`});
    }
  }catch(e){}
}
report.indexedDB = idbSummary;

// 6) Non-200 network statuses in caches or files
const non200 = [];
for (const p of Object.keys(files)){
  try{
    const f = files[p];
    if (f && typeof f.status === 'number' && f.status !== 200) non200.push({path:p,status:f.status});
  }catch(e){}
}
if (non200.length) report.issues.push({type:'non200_resources', severity:'low', detail:`${non200.length} non-200 resources`});
report.non200 = non200;

// 7) Console warnings about production
const prodWarnings = consoleEntries.filter(e=> e.args && e.args.some(a=> typeof a==='string' && /cdn\.tailwindcss\.com|in-browser Babel|precompile/i.test(a)));
if (prodWarnings.length) report.issues.push({type:'prod_warnings', severity:'low', detail:`${prodWarnings.length} production warnings in console`});
report.prodWarnings = prodWarnings.map(w=>({time:w.time,args:w.args}));

// write report
const out = path.basename(input).replace(/\.json$/,'') + '.deep_scan.json';
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
console.log('Wrote', out);
