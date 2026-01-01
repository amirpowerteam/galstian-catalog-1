const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node extract_embedded_media.js <path-to-backup.json>');
  process.exit(2);
}

const stream = fs.createReadStream(file, { encoding: 'utf8' });
let buffer = '';
let found = false;

stream.on('data', chunk => {
  if (found) return;
  buffer += chunk;
  const keyPos = buffer.indexOf('"_embedded_media"');
  if (keyPos !== -1) {
    const afterKey = buffer.indexOf(':', keyPos);
    if (afterKey === -1) return;
    const firstBrace = buffer.indexOf('{', afterKey);
    if (firstBrace === -1) return;
    let braceCount = 0;
    for (let i = firstBrace; i < buffer.length; i++) {
      if (buffer[i] === '{') braceCount++;
      else if (buffer[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          const objText = buffer.slice(firstBrace, i + 1);
          try {
            const v = JSON.parse(objText);
            console.log(JSON.stringify(v, null, 2));
            process.exit(0);
          } catch (e) {
            console.log(objText);
            process.exit(0);
          }
        }
      }
    }
    if (buffer.length > 200000) buffer = buffer.slice(-100000);
  }
});

stream.on('end', () => {
  console.error('Not found');
  process.exit(3);
});

stream.on('error', (e) => {
  console.error('Error reading file', e.message);
  process.exit(4);
});
