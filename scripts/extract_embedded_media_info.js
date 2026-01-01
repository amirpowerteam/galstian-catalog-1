const fs = require('fs');
const file = process.argv[2];
if (!file) {
  console.error('Usage: node extract_embedded_media_info.js <backup.json>');
  process.exit(2);
}

const stream = fs.createReadStream(file, { encoding: 'utf8' });
let buf = '';
let found = false;
let keyPos = -1;
let braceCount = 0;

stream.on('data', chunk => {
  if (found) return;
  buf += chunk;
  keyPos = buf.indexOf('"_embedded_media"');
  if (keyPos !== -1) {
    const colon = buf.indexOf(':', keyPos);
    if (colon === -1) return;
    const start = buf.indexOf('{', colon);
    if (start === -1) return;
    found = true;
    braceCount = 0;
    for (let i = start; i < buf.length; i++) {
      if (buf[i] === '{') braceCount++;
      else if (buf[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          const objText = buf.slice(colon + 1, i + 1).trim();
          try {
            const obj = JSON.parse(objText);
            analyze(obj);
            process.exit(0);
          } catch (e) {
            console.error('Failed to parse _embedded_media JSON (truncated?).');
            // print a short preview
            const preview = buf.slice(keyPos, Math.min(buf.length, keyPos + 2000));
            console.log(preview);
            process.exit(3);
          }
        }
      }
    }
  } else {
    if (buf.length > 500000) buf = buf.slice(-200000);
  }
});

stream.on('end', () => {
  console.error('No _embedded_media found');
  process.exit(4);
});

stream.on('error', e => { console.error('Read error', e.message); process.exit(5); });

function analyze(obj) {
  console.log('Found keys:', Object.keys(obj).join(', '));
  if (obj.hero_video) {
    const hv = obj.hero_video;
    console.log('\nhero_video keys:', Object.keys(hv).join(', '));
    if (hv.dataUrl) {
      const header = hv.dataUrl.split(',')[0];
      const b64 = hv.dataUrl.split(',')[1] || '';
      console.log('dataUrl header:', header);
      console.log('base64 length:', b64.length);
      // estimate bytes
      const approxBytes = Math.floor(b64.length * 3 / 4);
      console.log('≈ bytes:', approxBytes);
      if (!header.startsWith('data:video/')) console.log('Warning: dataUrl mime is not video/*');
    } else {
      console.log('hero_video has no dataUrl; src:', hv.src || '(none)');
    }
  }
  if (obj.welcome_video) {
    const wv = obj.welcome_video;
    console.log('\nwelcome_video keys:', Object.keys(wv).join(', '));
  }
}
