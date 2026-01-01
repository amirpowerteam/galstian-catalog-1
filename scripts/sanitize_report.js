#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { execSync } = require('child_process');

function usage() {
  console.log('Usage: node sanitize_report.js <input.json> [--out out.json] [--keep-bodies] [--stream] [--gzip] [--max-field-length N] [--head-lines N] [--tail-lines N] [--include-files]');
  console.log('Defaults: bodies are removed (pass --keep-bodies to keep), stream=false, gzip=false, max-field-length=20000');
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv.length < 1) usage();
const input = argv[0];
let out = null;
let keepBodies = false;
let streamMode = false; // JSONL
let makeGzip = false;
let includeFiles = false; // include file blobs (base64) summaries
let maxFieldLength = 20000;
let headLines = 20;
let tailLines = 20;
let sampleArrays = true;
let maxArrayLength = 200;
for (let i=1;i<argv.length;i++){
  const a = argv[i];
  if (a === '--keep-bodies') keepBodies = true;
  if (a === '--stream') streamMode = true;
  if (a === '--gzip') makeGzip = true;
  if (a === '--include-files') includeFiles = true;
  if (a === '--out') { out = argv[i+1]; i++; }
  if (a === '--max-field-length') { maxFieldLength = parseInt(argv[i+1],10) || maxFieldLength; i++; }
  if (a === '--head-lines') { headLines = parseInt(argv[i+1],10) || headLines; i++; }
  if (a === '--tail-lines') { tailLines = parseInt(argv[i+1],10) || tailLines; i++; }
  if (a === '--no-sample-arrays') { sampleArrays = false; }
  if (a === '--max-array-length') { maxArrayLength = parseInt(argv[i+1],10) || maxArrayLength; i++; }
}
if (!out) out = input.replace(/\.json$/i, '') + '.sanitized.json';

// map sha256 -> {summary, count}
const fileIndex = new Map();

function redactStorage(obj){
  try {
    const SENSITIVE_RE = /api[_-]?key|token|secret|password|gemini|openai|authorization/i;
    if (obj && obj.storage && obj.storage.localStorage){
      for (const k of Object.keys(obj.storage.localStorage)){
        try {
          if (SENSITIVE_RE.test(k)) obj.storage.localStorage[k] = '<<REDACTED>>';
        } catch(e){}
      }
    }
  } catch(e){}
}

function isLikelyBase64DataUri(s){
  if (typeof s !== 'string') return false;
  return s.startsWith('data:') && s.indexOf('base64,') !== -1;
}

function isLikelyBase64String(s){
  if (typeof s !== 'string') return false;
  // heuristic: long and only base64 chars (plus padding)
  if (s.length < 512) return false;
  return /^[A-Za-z0-9+/=\n\r]+$/.test(s);
}

function summarizeBase64(b64, mime){
  try {
    // If includeFiles is false, avoid decoding/hashing large binaries — just record a small placeholder.
    const approxSize = Math.floor((b64.replace(/\s+/g,'').length * 3) / 4);
    if (!includeFiles) return {fileOmitted: true, mime: mime || 'application/octet-stream', approxSize};
    const raw = Buffer.from(b64, 'base64');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const size = raw.length;
    if (fileIndex.has(hash)){
      fileIndex.get(hash).count++;
      return {fileRef: hash};
    }
    const summary = {sha256: hash, size, mime: mime || 'application/octet-stream'};
    fileIndex.set(hash, {summary, count:1});
    if (includeFiles) {
      summary.sample = raw.slice(0,64).toString('base64');
    }
    return {fileSummary: summary};
  } catch(e){
    return {fileSummary: {error: 'failed-to-hash'}};
  }
}

function truncateStringForKey(key, str){
  if (typeof str !== 'string') return str;
  if (str.length <= maxFieldLength) return str;
  // prefer line-based head/tail
  const lines = str.split(/\r?\n/);
  if (lines.length > headLines + tailLines + 2){
    const head = lines.slice(0, headLines).join('\n');
    const tail = lines.slice(lines.length - tailLines).join('\n');
    return {__truncated__:true, head, tail, originalLength: str.length, note: 'truncated by sanitizer'};
  }
  // fallback to char truncation
  const head = str.slice(0, Math.floor(maxFieldLength/2));
  const tail = str.slice(str.length - Math.floor(maxFieldLength/2));
  return {__truncated__:true, head, tail, originalLength: str.length, note: 'truncated by sanitizer'};
}

function shouldPreserveFull(keyPath){
  // always preserve fields related to errors
  const k = keyPath.join('.').toLowerCase();
  if (k.includes('error') || k.includes('exception')) return true;
  return false;
}

function objectContainsError(obj){
  try {
    if (!obj || typeof obj !== 'object') return false;
    const stack = [obj];
    while (stack.length){
      const cur = stack.pop();
      if (!cur || typeof cur !== 'object') continue;
      for (const k of Object.keys(cur)){
        const v = cur[k];
        if (typeof k === 'string' && (k.toLowerCase().includes('error') || k.toLowerCase().includes('exception') || k.toLowerCase().includes('stack') || k.toLowerCase().includes('message'))) return true;
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  } catch(e){}
  return false;
}

function sanitizeArray(arr, keyPath){
  if (!Array.isArray(arr)) return arr;
  const n = arr.length;
  if (!sampleArrays || n <= maxArrayLength) return arr.map((v,i) => sanitizeValue(v, keyPath.concat(String(i))));
  // sample: keep head and tail, plus any items that contain errors
  const half = Math.floor(maxArrayLength/2);
  const head = arr.slice(0, half).map((v,i) => sanitizeValue(v, keyPath.concat(String(i))));
  const tail = arr.slice(Math.max(half, n-half)).map((v,i) => sanitizeValue(v, keyPath.concat(String(n - tail.length + i))));
  // collect extras that contain errors not already in head/tail
  const extras = [];
  for (let i=0;i<n;i++){
    if (i < half) continue;
    if (i >= n-half) continue;
    const item = arr[i];
    if (objectContainsError(item)) extras.push({index:i, item: sanitizeValue(item, keyPath.concat(String(i)))});
    if (extras.length > 50) break; // prevent extras explosion
  }
  return {__truncated__:true, originalLength: n, head, tail, extras};
}

function sanitizeValue(val, keyPath){
  // preserve null/number/boolean
  if (val === null) return null;
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof val === 'string'){
    // data uri
    if (isLikelyBase64DataUri(val)){
      const m = /^data:([^;]+);base64,(.*)$/s.exec(val);
      if (m) {
        if (!includeFiles) {
          const b64 = m[2];
          const approxSize = Math.floor((b64.replace(/\s+/g,'').length * 3) / 4);
          return {fileOmitted: true, mime: m[1], approxSize};
        }
        return summarizeBase64(m[2], m[1]);
      }
    }
    // raw base64 large string
    if (isLikelyBase64String(val) && val.length > 1024){
      if (!includeFiles){
        const approxSize = Math.floor((val.replace(/\s+/g,'').length * 3) / 4);
        return {fileOmitted: true, mime: 'application/octet-stream', approxSize};
      }
      return summarizeBase64(val, 'application/octet-stream');
    }
    // otherwise, maybe truncate unless it's an error-related key
    if (!shouldPreserveFull(keyPath)) return truncateStringForKey(keyPath.join('.'), val);
    return val;
  }
  if (Array.isArray(val)){
    return sanitizeArray(val, keyPath);
  }
  if (typeof val === 'object'){
    return sanitizeObject(val, keyPath);
  }
  return val;
}

function sanitizeObject(obj, keyPath){
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)){
    try {
      const v = obj[k];
      // never remove or truncate if this key is error/exception
      if (shouldPreserveFull(keyPath.concat(k))) {
        out[k] = v;
        continue;
      }
      // avoid stripping when keepBodies true
      if (!keepBodies) {
        if (k === 'bodyBase64' || k === 'blob' || k === 'body' || k === 'responseBody'){
          if (typeof v === 'string'){
            // summarize large blobs
            out[k] = summarizeBase64(v, null);
            continue;
          }
        }
      }
      out[k] = sanitizeValue(v, keyPath.concat(k));
    } catch(e){
      out[k] = {__sanitizeError: String(e)};
    }
  }
  return out;
}

function writeIndexSummary(outPath){
  if (!fileIndex.size) return;
  const indexObj = {};
  for (const [k,v] of fileIndex.entries()) indexObj[k] = {summary: v.summary, count: v.count};
  const p = outPath + '.files.json';
  fs.writeFileSync(p, JSON.stringify(indexObj, null, 2), 'utf8');
  console.log('Wrote file index summary to', p);
}

try {
  const txt = fs.readFileSync(input, 'utf8');
  const obj = JSON.parse(txt);
  redactStorage(obj);

  if (streamMode) {
    // stream top-level keys as JSONL to avoid huge allocations
    const outStream = fs.createWriteStream(out, 'utf8');
    for (const k of Object.keys(obj)){
      try {
        const sanitized = sanitizeValue(obj[k], [k]);
        const line = JSON.stringify({key: k, value: sanitized});
        outStream.write(line + '\n');
      } catch(e){
        outStream.write(JSON.stringify({key: k, value: {__sanitizeError: String(e)}}) + '\n');
      }
    }
    outStream.end(() => {
      console.log('Sanitized (streamed) report written to', out);
      writeIndexSummary(out);
      if (makeGzip) {
        const gzPath = out + '.gz';
        fs.createReadStream(out).pipe(zlib.createGzip()).pipe(fs.createWriteStream(gzPath)).on('close', () => console.log('Created gzip:', gzPath));
      }
    });
  } else {
    const sanitized = sanitizeObject(obj, []);
    fs.writeFileSync(out, JSON.stringify(sanitized, null, 2), 'utf8');
    console.log('Sanitized report written to', out);
    writeIndexSummary(out);
    if (makeGzip) {
      const gzPath = out + '.gz';
      fs.createReadStream(out).pipe(zlib.createGzip()).pipe(fs.createWriteStream(gzPath)).on('close', () => console.log('Created gzip:', gzPath));
    }
  }
} catch (e) {
  console.error('Failed to sanitize:', e);
  process.exit(2);
}
