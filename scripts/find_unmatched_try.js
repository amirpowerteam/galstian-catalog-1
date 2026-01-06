const fs = require('fs');
const path = require('path');

const file = path.resolve(process.cwd(), 'index.html');
if (!fs.existsSync(file)) {
  console.error('index.html not found in current folder');
  process.exit(2);
}

const txt = fs.readFileSync(file, 'utf8');
const lines = txt.split(/\r?\n/);

function report(line, snippet) {
  console.log(`Possible unmatched try at line ${line}:`);
  console.log('---');
  console.log(snippet);
  console.log('---\n');
}

// Naive scanner: finds "try {" and checks the next 120 lines for 'catch' or 'finally'
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/\btry\s*\{/.test(l)) {
    // collect following N lines
    const window = lines.slice(i, Math.min(lines.length, i + 120)).join('\n');
    if (!/\bcatch\s*\(|\bfinally\s*\{/.test(window)) {
      const snippet = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 20)).join('\n');
      report(i + 1, snippet);
    }
  }
}

console.log('Scan complete. If you see matches, open index.html at the reported lines and fix the try block (add catch/finally or remove incomplete try).');
