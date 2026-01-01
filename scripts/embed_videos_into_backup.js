const fs = require('fs');
const path = require('path');

const MAX_EMBED_BYTES = 12 * 1024 * 1024; // 12MB
const repoRoot = path.resolve(__dirname, '..');
const deployDir = path.join(repoRoot, 'deploy');
// Allow passing an input file; otherwise pick the most recent catalog_backup*.json in deploy/
const argIn = process.argv[2] || null;
const findLatestBackup = () => {
  const files = fs.readdirSync(deployDir).filter(f => f.startsWith('catalog_backup') && f.endsWith('.json'));
  if (!files || files.length === 0) return null;
  const sorted = files.map(f => ({ f, m: fs.statSync(path.join(deployDir, f)).mtimeMs })).sort((a,b) => b.m - a.m);
  return path.join(deployDir, sorted[0].f);
};
const inputFile = argIn ? path.resolve(argIn) : (findLatestBackup() || path.join(deployDir, 'catalog_backup.json'));
const outputFile = path.join(deployDir, 'catalog_backup_with_videos.json');

function guessMime(filePath) {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return 'application/octet-stream';
}

function embedFile(relPath) {
  const full = path.join(repoRoot, relPath);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  if (stat.size > MAX_EMBED_BYTES) {
    console.warn(`Skipping ${relPath} (size ${stat.size} > ${MAX_EMBED_BYTES})`);
    return null;
  }
  const buf = fs.readFileSync(full);
  const b64 = buf.toString('base64');
  const mime = guessMime(relPath);
  return { src: relPath.replace(/\\/g, '/'), dataUrl: `data:${mime};base64,${b64}` };
}

// Search uploaded_media recursively for a file matching any of the provided basenames
function findUploadedMatch(basenames) {
  const uploadedRoot = path.join(repoRoot, 'uploaded_media');
  if (!fs.existsSync(uploadedRoot)) return null;
  const walk = (dir) => {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const full = path.join(dir, e);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else {
        const name = path.basename(e);
        const nameNoExt = name.replace(/\.[^.]+$/, '');
        for (const b of basenames) {
          if (b === name || b === nameNoExt) {
            return path.relative(repoRoot, full).replace(/\\/g, '/');
          }
        }
      }
    }
    return null;
  };
  return walk(uploadedRoot);
}

(async () => {
  if (!fs.existsSync(inputFile)) {
    console.error('Input backup not found:', inputFile);
    process.exit(2);
  }
  const raw = fs.readFileSync(inputFile, 'utf8');
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { console.error('Failed parsing JSON:', e); process.exit(2); }

  // Prepare embedded media by inspecting config values (welcome_video, hero_media_block.mediaUrl)
  const embedded = {};
  const tryAdd = (rawUrl, keyName) => {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    // Normalize leading slash
    let rel = rawUrl.replace(/^https?:\/\/[^^/]+/, '');
    if (rel.startsWith('//')) rel = rel.replace(/^\/\//, '/');
    // If it looks like a data: URI, skip (already embedded)
    if (rel.startsWith('data:')) return;
    // Remove querystring
    rel = rel.split('?')[0];
    // Remove leading './' or '/' for local file join
    const relPath = rel.replace(/^\./, '').replace(/^\//, '');
    const base = path.basename(relPath);
    const baseNoExt = base.replace(/\.[^.]+$/, '');
    // Try recursive search in uploaded_media for either the basename or basename-without-ext
    const found = findUploadedMatch([base, baseNoExt]);
    if (found) {
      const e = embedFile(found);
      if (e) { embedded[keyName] = e; return; }
    }
    // Fallback: try direct candidates as before
    const candidates = [
      path.join('uploaded_media', base),
      path.join('uploaded_media', baseNoExt),
      path.join('uploaded_media', 'بلوک ۲', base),
      path.join('uploaded_media', 'بلوک ۲', baseNoExt),
      path.join('uploaded_media', 'بلوک ۳', base),
      path.join('uploaded_media', 'بلوک ۳', baseNoExt)
    ];
    for (const p of candidates) {
      const e = embedFile(p);
      if (e) { embedded[keyName] = e; return; }
    }
  };

  // Try extracting known config-backed video paths
  if (obj.config) {
    tryAdd(obj.config.welcome_video, 'welcome_video');
    tryAdd(obj.config.welcome_background_video, 'welcome_background_video');
    try {
      const hero = obj.config.hero_media_block;
      if (hero && typeof hero === 'object') tryAdd(hero.mediaUrl || hero.media_url || hero.url, 'hero_video');
    } catch (e) { /* ignore */ }
  }

  // Fallback: look for common filenames if above didn't find anything
    if (Object.keys(embedded).length === 0) {
      // Try to discover files in uploaded_media recursively by basenames (with or without ext)
      const heroMatch = findUploadedMatch(['bloc2.mp4','bloc2','boloc-2.mp4','boloc-2','boloc2','boloc-2']);
      const welcomeMatch = findUploadedMatch(['bloc3.mp4','bloc3','boloc-3.mp4','boloc-3','boloc3','boloc-3']);
      if (heroMatch) {
        const e = embedFile(heroMatch);
        if (e) embedded['hero_video'] = e;
      }
      if (welcomeMatch) {
        const e = embedFile(welcomeMatch);
        if (e) embedded['welcome_video'] = e;
      }
      // final fallback: try a couple common static candidates at repo root
      if (!embedded['hero_video']) {
        const fallbackHero = findUploadedMatch(['bloc2','boloc-2','boloc2']);
        if (fallbackHero) { const e = embedFile(fallbackHero); if (e) embedded['hero_video'] = e; }
      }
      if (!embedded['welcome_video']) {
        const fallbackWelcome = findUploadedMatch(['bloc3','boloc-3','boloc3']);
        if (fallbackWelcome) { const e = embedFile(fallbackWelcome); if (e) embedded['welcome_video'] = e; }
      }
  }

  if (!obj.config) obj.config = {};
  if (Object.keys(embedded).length === 0) {
    console.log('No files embedded (none found or too large). Writing original copy as', outputFile);
    fs.writeFileSync(outputFile, JSON.stringify(obj, null, 2), 'utf8');
    process.exit(0);
  }

  obj.config._embedded_media = embedded;

  fs.writeFileSync(outputFile, JSON.stringify(obj, null, 2), 'utf8');
  console.log('Wrote backup with embedded media to', outputFile);
})();
