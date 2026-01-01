const fs = require('fs');
const file = process.argv[2];
const start = parseInt(process.argv[3],10);
const end = parseInt(process.argv[4],10);
if (!file || isNaN(start) || isNaN(end)) {
  console.error('Usage: node print_lines.js <file> <start> <end>');
  process.exit(2);
}
const data = fs.readFileSync(file,'utf8');
const lines = data.split('\n');
for (let i=start-1;i<end && i<lines.length;i++) {
  console.log((i+1)+': '+lines[i]);
}
