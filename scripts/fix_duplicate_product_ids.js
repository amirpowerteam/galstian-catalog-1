#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJson(p){ return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }

const input = path.resolve(process.argv[2] || 'catalog_backup_lazy_2025-12-24T19-43-29-945Z.json');
if(!fs.existsSync(input)){ console.error('Input file not found:', input); process.exit(2); }

const timestamp = Date.now();
const backupBefore = input.replace(/\.json$/,'') + `.before_fix_${timestamp}.json`;
const outFile = input.replace(/\.json$/,'') + `.fixed_ids_${timestamp}.json`;
const mapFile = input.replace(/\.json$/,'') + `.id_map_${timestamp}.json`;

console.log('Reading', input);
const data = readJson(input);

const products = (data.data && data.data.products) || data.products || [];
if(!Array.isArray(products)){
  console.error('No products array found in expected locations.');
  process.exit(3);
}

const idToIndices = new Map();
products.forEach((p, idx) => {
  const id = p && (p.id || p.id === 0) ? String(p.id) : null;
  if(!id) return;
  if(!idToIndices.has(id)) idToIndices.set(id, []);
  idToIndices.get(id).push(idx);
});

const duplicateIds = [...idToIndices.entries()].filter(([,arr]) => arr.length > 1);
if(duplicateIds.length === 0){
  console.log('No duplicate product IDs found.');
  process.exit(0);
}

// create backup file before changing
fs.copyFileSync(input, backupBefore);
console.log('Created backup before changes at', backupBefore);

// helper to generate unique id
function genId(existing){
  if(typeof crypto !== 'undefined' && crypto.randomUUID) return `id-${crypto.randomUUID()}`;
  try{
    const arr = new Uint8Array(16);
    if(typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for(let i=0;i<arr.length;i++) arr[i]=Math.floor(Math.random()*256);
    const hex = Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
    return `id-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }catch(e){
    return `id-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }
}

const existingIds = new Set(products.map(p=>String(p.id)));
const idMap = {};

for(const [id, indices] of duplicateIds){
  // keep first occurrence, change others
  for(let i=1;i<indices.length;i++){
    const idx = indices[i];
    let candidate;
    let tries = 0;
    do{
      candidate = genId();
      tries++;
    }while(existingIds.has(candidate) && tries < 50);
    if(existingIds.has(candidate)){
      console.error('Could not generate unique id for', id, 'after', tries, 'tries');
      process.exit(4);
    }
    const old = String(products[idx].id);
    products[idx].id = candidate;
    existingIds.add(candidate);
    idMap[old] = idMap[old] || [];
    idMap[old].push(candidate);
    console.log(`Reassigned duplicate id ${old} at product index ${idx} -> ${candidate}`);
  }
}

// attempt to replace references: walk whole data and replace values equal to old ids when key name indicates product reference
function walkAndReplace(obj, pathArr=[]){
  if(Array.isArray(obj)){
    return obj.map((v,i)=> walkAndReplace(v, pathArr.concat(`[${i}]`)));
  }
  if(obj && typeof obj === 'object'){
    const out = {};
    for(const [k,v] of Object.entries(obj)){
      const keyLower = k.toLowerCase();
      if(typeof v === 'string' || typeof v === 'number'){
        const sval = String(v);
        // replace if value matches an old id and key suggests product reference OR ancestor path includes 'products' or 'cart' or 'items'
        const ancestor = pathArr.join('/').toLowerCase();
        const isProductKey = /product|productid|product_id|item|items|lineitem|line_items|cart/i.test(k);
        const isAncestorRef = /products|cart|items|lineitems|order|orders|line_items/.test(ancestor);
        if(idMap[sval] && (isProductKey || isAncestorRef)){
          // if multiple new ids mapped, we won't know which one to pick for references; skip replacing ambiguous refs.
          const mapped = idMap[sval];
          if(mapped.length === 1){
            out[k] = mapped[0];
            continue;
          }
        }
        out[k] = v;
      } else {
        out[k] = walkAndReplace(v, pathArr.concat(k));
      }
    }
    return out;
  }
  return obj;
}

const fixedData = walkAndReplace(data);

writeJson(outFile, fixedData);
writeJson(mapFile, idMap);

console.log('Wrote fixed backup to', outFile);
console.log('Wrote id mapping to', mapFile);
console.log('Done.');
