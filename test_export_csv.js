const fs = require('fs');

const products = [
  { id: 'id-1', name: { en: 'Table CONFORT 01', fa: 'میز نمونه ۱' }, price: 5100, quantity: 4 },
  { id: 'id-2', name: { en: 'CHAIR GLAMOUR', fa: 'صندلی شیک' }, price: 3300, quantity: 14 },
  { id: 'id-3', name: { en: 'RADICA BRIARWOOD', fa: 'رادیکا بریاروود' }, price: 1200, quantity: 11 }
];

let csvContent = '\uFEFF' + 'ID,Product Name (EN),Product Name (FA),Price,Quantity\r\n';

products.forEach(p => {
  const nameEn = (p.name?.en || '').replace(/"/g, '""');
  const nameFa = (p.name?.fa || '').replace(/"/g, '""');
  const row = `"${p.id}","${nameEn}","${nameFa}","${p.price || 0}","${p.quantity || 0}"`;
  csvContent += row + '\r\n';
});

const outPath = 'test-output-catalog.csv';
fs.writeFileSync(outPath, csvContent, { encoding: 'utf8' });

const buf = fs.readFileSync(outPath);
console.log('Wrote file:', outPath);
console.log('File size (bytes):', buf.length);
console.log('First 4 bytes (hex):', Buffer.from(buf.slice(0,4)).toString('hex'));
console.log('Preview (first 200 chars):');
console.log(buf.toString('utf8', 0, 200));

// Exit with success
process.exit(0);
