const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run() {
  const url = 'http://127.0.0.1:8080/';
  const userDataDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sw-test-'));
  console.log('Using userDataDir:', userDataDir);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    userDataDir,
    // increase protocol timeout to allow large report serialization
    protocolTimeout: 600000,
  });

  const page = await browser.newPage();

  // capture console messages from page (includes SW logs forwarded to console)
  page.on('console', (msg) => console.log('[PAGE]', msg.text()));

  // prepare a global message array in page to collect SW->page messages
  await page.exposeFunction('onSWMessage', (data) => {
    console.log('[SW->PAGE MSG]', JSON.stringify(data));
  });

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  // install a listener in the page to forward SW messages to Node
  await page.evaluate(() => {
    window.__swMessages = [];
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (ev) => {
        try {
          window.__swMessages.push(ev.data);
          if (window.onSWMessage) window.onSWMessage(ev.data);
        } catch (e) {
          /* ignore */
        }
      });
    }
  });

  // wait for service worker controller
  const swReady = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return { ok: false, reason: 'no-sw' };
    const reg = await navigator.serviceWorker.ready.catch((e) => ({ error: e }));
    return { ok: true };
  });
  console.log('SW ready:', swReady);

  // populate runtime cache by fetching an existing static asset many times with cache-busting query
  console.log('Populating runtime cache...');
  const populateCount = 140; // > RUNTIME_MAX_ENTRIES(120) to force eviction
  await page.evaluate(async (n) => {
    const urlBase = '/assets/galstian-logo.png';
    for (let i = 0; i < n; i++) {
      try {
        await fetch(urlBase + '?_cb=' + i, { cache: 'reload' }).then((r) => r.blob()).catch(() => {});
      } catch (e) {}
    }
    return true;
  }, populateCount);

  // ask SW for stats
  console.log('Requesting SW stats (LOG_STATS)...');
  await page.evaluate(() => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'LOG_STATS' });
    }
  });

  // wait a little for messages
  await new Promise((r) => setTimeout(r, 2500));

  // query CacheStorage for runtime cache size from page context
  const runtimeCacheName = 'galstian-cache-runtime-2025-12-26-1';
  const stats = await page.evaluate(async (name) => {
    const res = { cacheKeys: 0, hasRuntime: false };
    try {
      const keys = await caches.keys();
      res.hasRuntime = keys.includes(name);
      if (res.hasRuntime) {
        const cache = await caches.open(name);
        const ckeys = await cache.keys();
        res.cacheKeys = ckeys.length;
      }
    } catch (e) { res.error = String(e); }
    try {
      // read indexedDB count for METADB if accessible
      const req = indexedDB.open('galstian-cache-metadb-2025-12-26-1');
      const db = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }).catch(() => null);
      if (db) {
        const tx = db.transaction('entries', 'readonly');
        const countReq = tx.objectStore('entries').count();
        res.metaCount = await new Promise((r) => { countReq.onsuccess = () => r(countReq.result); countReq.onerror = () => r(-1); });
      }
    } catch (e) { res.metaError = String(e); }
    return res;
  }, runtimeCacheName);

  console.log('Runtime cache stats:', stats);

  // test offline fetch of a cached asset
  console.log('Switching to offline and testing cached asset fetch...');
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });

  const offlineOk = await page.evaluate(async () => {
    try {
      const r = await fetch('/assets/galstian-logo.png?_cb=0');
      return { ok: r.ok, status: r.status };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  });

  console.log('Offline fetch result:', offlineOk);

  // cleanup
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  // try to request a detailed bug report from the page and save it to disk
  // increase page timeout for long-running evaluations
  page.setDefaultTimeout(600000);
  page.setDefaultNavigationTimeout(600000);
  try {
    const report = await page.evaluate(async () => {
      if (window.__generateDetailedReport) return await window.__generateDetailedReport({ includeBodies: true, bodyLimit: 2 * 1024 * 1024 });
      return { error: 'report-generator-not-available' };
    });
    const outPath = path.join(userDataDir, 'detailed_bug_report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log('Saved detailed report to', outPath);
    // save summary text if available
    try {
      const summary = report && report.summary ? report.summary : (report && report.console && Array.isArray(report.console.recent) ? report.console.recent.slice(0,200).map(l=>JSON.stringify(l)).join('\n') : 'no-summary');
      const sPath = path.join(userDataDir, 'detailed_bug_report_summary.txt');
      fs.writeFileSync(sPath, summary);
      console.log('Saved summary to', sPath);
    } catch (e) { console.error('Failed to save summary:', e); }
      // Attempt to extract any large bodies stored in IndexedDB by the report generator
      try {
        // first get all keys from the 'bodies' store
        const keys = await page.evaluate(async () => {
          try {
            const rq = indexedDB.open('detailed_report_bodies_v1');
            const db = await new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); rq.onupgradeneeded = () => { rq.transaction && rq.transaction.abort(); res(rq.result); }; });
            const tx = db.transaction('bodies', 'readonly');
            const store = tx.objectStore('bodies');
            const out = [];
            const cursorReq = store.openCursor();
            await new Promise((res, rej) => {
              cursorReq.onsuccess = (ev) => {
                const cur = ev.target.result;
                if (!cur) return res();
                out.push(cur.key || (cur.value && cur.value.key));
                cur.continue();
              };
              cursorReq.onerror = () => rej(cursorReq.error);
            });
            try { db.close(); } catch(e){}
            return out;
          } catch (e) { return { error: String(e) }; }
        });
        if (Array.isArray(keys) && keys.length) {
          const bodiesDir = path.join(userDataDir, 'extracted_bodies');
          try { fs.mkdirSync(bodiesDir); } catch(e){}
          for (const key of keys) {
            try {
              const dataUrl = await page.evaluate(async (k) => {
                try {
                  const rq = indexedDB.open('detailed_report_bodies_v1');
                  const db = await new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); rq.onupgradeneeded = () => { rq.transaction && rq.transaction.abort(); res(rq.result); }; });
                  const tx = db.transaction('bodies', 'readonly');
                  const store = tx.objectStore('bodies');
                  const getReq = store.get(k);
                  const rec = await new Promise((res, rej) => { getReq.onsuccess = () => res(getReq.result); getReq.onerror = () => rej(getReq.error); });
                  try { db.close(); } catch(e){}
                  if (!rec || !rec.blob) return { error: 'missing' };
                  const blob = rec.blob;
                  return await new Promise((res, rej) => {
                    try {
                      const fr = new FileReader();
                      fr.onload = () => res({ dataUrl: fr.result, size: blob.size });
                      fr.onerror = () => res({ error: 'readfailed' });
                      fr.readAsDataURL(blob);
                    } catch (e) { res({ error: String(e) }); }
                  });
                } catch (e) { return { error: String(e) }; }
              }, key);
              if (dataUrl && dataUrl.dataUrl) {
                const m = dataUrl.dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
                if (!m) continue;
                const mime = m[1];
                const base64 = m[2];
                const ext = mime.split('/')[1] ? mime.split('/')[1].replace(/[^a-z0-9]/gi,'') : 'bin';
                const fname = path.join(bodiesDir, `${key}.${ext}`);
                fs.writeFileSync(fname, Buffer.from(base64, 'base64'));
                console.log('Wrote body file:', fname);
              } else {
                console.log('Skipped key (no data):', key, dataUrl && dataUrl.error);
              }
            } catch (e) { console.warn('Failed to extract key', key, e && e.message); }
          }
          // Sanitize the report and create a ZIP containing sanitized JSON + extracted bodies
          const sanitizeCmd = `node "${path.join(__dirname, '..', 'scripts', 'sanitize_report.js')}" "${outPath}" --out "${path.join(userDataDir, 'detailed_bug_report.sanitized.json')}" --no-bodies=false`;
          try {
            require('child_process').execSync(sanitizeCmd, { stdio: 'inherit' });
          } catch (e) { console.warn('Sanitizer failed, continuing:', e && e.message); }
          const zipPath = path.join(userDataDir, 'detailed_bug_report_with_bodies.zip');
          try {
            if (process.platform === 'win32') {
              const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${path.join(userDataDir, 'detailed_bug_report.sanitized.json')}', '${bodiesDir}/*' -DestinationPath '${zipPath}' -Force"`;
              require('child_process').execSync(psCmd, { stdio: 'inherit' });
            } else {
              require('child_process').execSync(`zip -j '${zipPath}' '${path.join(userDataDir, 'detailed_bug_report.sanitized.json')}' '${bodiesDir}/*'`, { stdio: 'inherit' });
            }
            console.log('Created zip with bodies:', zipPath);
          } catch (e) { console.warn('Failed to create zip with bodies:', e && e.message); }
        } else {
          console.log('No stored bodies found in IndexedDB.');
        }
      } catch (e) { console.error('Failed to extract bodies from IndexedDB:', e); }
  } catch (e) {
    console.error('Full report failed, retrying without bodies:', e);
    try {
      const report = await page.evaluate(async () => {
        if (window.__generateDetailedReport) return await window.__generateDetailedReport({ includeBodies: false });
        return { error: 'report-generator-not-available' };
      });
      const outPath = path.join(userDataDir, 'detailed_bug_report_no_bodies.json');
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log('Saved no-bodies report to', outPath);
      try {
        const summary = report && report.summary ? report.summary : (report && report.console && Array.isArray(report.console.recent) ? report.console.recent.slice(0,200).map(l=>JSON.stringify(l)).join('\n') : 'no-summary');
        const sPath = path.join(userDataDir, 'detailed_bug_report_summary.txt');
        fs.writeFileSync(sPath, summary);
        console.log('Saved summary to', sPath);
      } catch (e2) { console.error('Failed to save summary for no-bodies report:', e2); }
    } catch (e2) {
      console.error('Failed to save fallback no-bodies report:', e2);
    }
  }

  await browser.close();
  console.log('Browser closed. User data in:', userDataDir);
}

run().catch((e) => { console.error(e); process.exit(2); });
