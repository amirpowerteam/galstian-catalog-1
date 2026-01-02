const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const s = fs.readFileSync(file, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m; let i = 0; const results = [];
while ((m = re.exec(s))) {
  i++;
  const attrs = m[1] || '';
  const content = m[2] || '';
  const lower = attrs.toLowerCase();
  if (lower.indexOf('type=') !== -1 && (lower.indexOf('text/babel') !== -1 || lower.indexOf('type="module"') !== -1 || lower.indexOf("type='module'") !== -1 || lower.indexOf('type="text/plain"') !== -1 || lower.indexOf("type='text/plain'") !== -1)) continue;
  if (content.trim().length > 10000 && content.indexOf('React') !== -1) continue; // skip big babel block
  const startIndex = m.index;
  const before = s.slice(0, startIndex);
  const line = before.split(/\r?\n/).length;
  try {
    // attempt to parse by creating a new function
    new Function(content);
  } catch (e) {
    // also compute simple bracket/quote balance to help locate the issue
    const lines = content.split(/\r?\n/);
    const scan = () => {
      const stack = { '(':0, ')':0, '{':0, '}':0, '[':0, ']':0 };
      let inSingle = false, inDouble = false, inBack = false;
      for (let li = 0; li < lines.length; li++) {
        const L = lines[li];
        for (let ci = 0; ci < L.length; ci++) {
          const ch = L[ci];
          if (ch === '\\' ) { ci++; continue; }
          if (!inDouble && !inBack && ch === "'") { inSingle = !inSingle; continue; }
          if (!inSingle && !inBack && ch === '"') { inDouble = !inDouble; continue; }
          if (!inSingle && !inDouble && ch === '`') { inBack = !inBack; continue; }
          if (inSingle || inDouble || inBack) continue;
          if (ch === '(') stack['(']++; if (ch === ')') stack[')']++;
          if (ch === '{') stack['{']++; if (ch === '}') stack['}']++;
          if (ch === '[') stack['[']++; if (ch === ']') stack[']']++;
          // detect negative counts (closing before opening) - approximate
          if (stack[')'] > stack['('] || stack['}'] > stack['{'] || stack[']'] > stack['[']) {
            return { badLine: li+1, badChar: ci+1, stack };
          }
        }
      }
      return { badLine: null, stack };
    };
    const scanRes = scan();
    results.push({ index: i, attrs: attrs.trim(), line, err: String(e).split('\n')[0], snippet: content.split('\n').slice(0, 80).join('\n'), scan: scanRes, full: content });
  }
}
if (results.length === 0) {
  console.log('No syntax errors found in plain inline scripts.');
  process.exit(0);
}
for (const r of results) {
  console.log('--- Script#' + r.index + ' at approx line ' + r.line + ' ---');
  console.log('Attrs:', r.attrs);
  console.log('Error:', r.err);
  console.log('Snippet (first 40 lines):\n' + r.snippet);
  if (r.scan) console.log('Scan result:', JSON.stringify(r.scan));
  console.log('\n');
}
// For convenience, also print full failing script with numbered lines for the first result
if (results.length) {
  const r = results[0];
  console.log('=== Full script content with line numbers (failing script) ===');
  const L = r.full.split(/\r?\n/);
  for (let idx = 0; idx < L.length; idx++) {
    const num = ('' + (idx+1)).padStart(4, ' ');
    console.log(num + ': ' + L[idx]);
  }
}
