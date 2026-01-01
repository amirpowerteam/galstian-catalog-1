const fs = require('fs');
const path = require('path');

function readJson(p){
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const backupPath = path.resolve(process.argv[2] || 'catalog_backup_lazy_2025-12-24T19-43-29-945Z.json');
const reportPath = path.resolve(process.argv[3] || 'detailed_bug_report_2025-12-27T15-01-33-203Z.json');

if(!fs.existsSync(backupPath)){
  console.error('Backup file not found:', backupPath); process.exit(2);
}
if(!fs.existsSync(reportPath)){
  console.error('Report file not found:', reportPath); process.exit(2);
}

const backup = readJson(backupPath);
const report = readJson(reportPath);

// backup products
const backupProducts = (backup.data && backup.data.products) || backup.products || [];
const backupProductIds = new Set(backupProducts.map(p=>p.id));

// report: try to extract all product IDs by scanning common paths and doing a recursive search
function collectProductIds(obj){
  const ids = new Set();
  const duplicates = new Map();

  function walk(value){
    if(!value) return;
    if(Array.isArray(value)){
      // if array looks like products (objects with id), collect
      const looksLikeObjects = value.every(v => v && typeof v === 'object');
      if(looksLikeObjects){
        const hasManyIds = value.filter(v => v && (typeof v.id === 'string' || typeof v.id === 'number')).length;
        if(hasManyIds >= Math.max(1, Math.floor(value.length * 0.2))){
          // treat as product-like array
          value.forEach(v => {
            if(v && (typeof v.id === 'string' || typeof v.id === 'number')){
              const id = String(v.id);
              if(ids.has(id)) duplicates.set(id, (duplicates.get(id)||0)+1);
              ids.add(id);
            }
          });
          // still walk members for nested products
          value.forEach(walk);
          return;
        }
      }
      // generic array walk
      value.forEach(walk);
      return;
    }
    if(typeof value === 'object'){
      // object with products property
      if(value.products && Array.isArray(value.products)){
        value.products.forEach(p=>{ if(p && (p.id || p.id===0)){
          const id = String(p.id);
          if(ids.has(id)) duplicates.set(id, (duplicates.get(id)||0)+1);
          ids.add(id);
        }});
      }
      // walk properties
      Object.values(value).forEach(walk);
    }
  }

  walk(obj);
  return { ids: Array.from(ids), duplicates: Array.from(duplicates.entries()).map(([id,count])=>({id,count})) };
}

const reportExtraction = collectProductIds(report);
const reportProductIds = new Set(reportExtraction.ids);
const reportProductsCount = reportExtraction.ids.length;
const reportDuplicateIds = reportExtraction.duplicates;

// full intersection
const intersection = [];
for(const id of reportProductIds){ if(backupProductIds.has(id)) intersection.push(id); }

// large cache entries from deep scan if present
const largeCache = (report.largeCache || []);
const largeCachePresenceInBackup = largeCache.map(item=>{
  const inBackup = backupProducts.find(p=>p && p.images && p.images.some && p.images.some(img=>{
    try{ return (typeof img === 'string' && img.includes(path.basename(item.url))) || (img && img.id && img.id.includes(path.basename(item.url))); }catch(e){return false}
  }));
  return { url: item.url, size: item.size, inBackup: !!inBackup };
});

// check for galstian-logo.b64 presence
const galstianInBackup = JSON.stringify(backup).includes('galstian-logo.b64');
const galstianInReport = JSON.stringify(report).includes('galstian-logo.b64');

console.log('SUMMARY_COMPARISON');
console.log('backupProductsCount=', backupProducts.length);
console.log('reportProductsSampleCount=', reportProductsCount);
console.log('reportProductIdsSample=', [...reportProductIds].slice(0,10));
const reportOnly = [...reportProductIds].filter(id => !backupProductIds.has(id));
const backupOnly = [...backupProductIds].filter(id => !reportProductIds.has(id));

console.log('intersectionCount=', intersection.length);
console.log('intersectionSampleIds=', intersection.slice(0,20));
console.log('reportOnlyCount=', reportOnly.length);
console.log('reportOnlySample=', reportOnly.slice(0,30));
console.log('backupOnlyCount=', backupOnly.length);
console.log('backupOnlySample=', backupOnly.slice(0,30));

if(reportDuplicateIds && reportDuplicateIds.length) console.log('reportDuplicateIds=', reportDuplicateIds.slice(0,20));
console.log('galstian-logo.b64 in backup=', galstianInBackup, 'in report=', galstianInReport);
console.log('largeCacheEntries analysed=', largeCache.length);
largeCachePresenceInBackup.forEach(i=>console.log('LARGE:', i.url, 'size=', i.size, 'inBackup=', i.inBackup));

process.exit(0);
