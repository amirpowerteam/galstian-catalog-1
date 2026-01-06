const fs = require('fs');
const path = require('path');
const inPath = path.join(__dirname, '..', 'catalog_backup.json');
const outPath = path.join(__dirname, '..', 'preloaded_backup_min.json');
let raw;
try {
  raw = fs.readFileSync(inPath, 'utf8');
} catch (e) {
  console.error('Failed to read', inPath, e.message);
  process.exit(1);
}
let j;
try { j = JSON.parse(raw); } catch(e) { console.error('JSON parse error', e.message); process.exit(2); }
const data = j.data || j;
const brands = (data.brands || []).map(b => ({ id: b.id || b._id || null, name: b.name || {}, logo: b.logo || null }));
const categories = (data.categories || []).map(c => ({ id: c.id || c._id || null, brandId: c.brandId || c.brand || null, name: c.name || {} }));
const products = (data.products || []).map(p => ({ id: p.id || p._id || null, name: p.name || {}, brandId: p.brandId || p.brand || null, categoryId: p.categoryId || p.category || null }));
const out = { data: { brands, categories, products }, generatedAt: (new Date()).toISOString() };
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath, 'brands:', brands.length, 'categories:', categories.length, 'products:', products.length);
