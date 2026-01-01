const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node extract_hero_media_block.js <path-to-backup.json>');
  process.exit(2);
}

const stream = fs.createReadStream(file, { encoding: 'utf8' });
let buffer = '';
let found = false;
let startIndex = -1;
let braceCount = 0;

stream.on('data', chunk => {
  if (found) return;
  buffer += chunk;
  const keyPos = buffer.indexOf('"hero_media_block"');
  if (keyPos !== -1) {
    // find the colon after key
    const afterKey = buffer.indexOf(':', keyPos);
    if (afterKey === -1) return; // wait for more data
    // find first '{' after colon
    const firstBrace = buffer.indexOf('{', afterKey);
    if (firstBrace === -1) return; // wait for more data
    found = true;
    startIndex = firstBrace;
    // count braces from startIndex
    for (let i = startIndex; i < buffer.length; i++) {
      if (buffer[i] === '{') braceCount++;
      else if (buffer[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          const objText = buffer.slice(keyPos, i + 1);
          // attempt to extract the object value only (after colon)
          const colon = objText.indexOf(':');
          const valueText = objText.slice(colon + 1).trim();
          // try to parse
          try {
            const v = JSON.parse(valueText);
            console.log(JSON.stringify(v, null, 2));
            process.exit(0);
          } catch (e) {
            // if parse fails, print raw
            console.log(valueText);
            process.exit(0);
          }
        }
      }
    }
  } else {
    // keep last 1000 chars to avoid memory growth
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
