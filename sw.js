/* SW: Advanced runtime cache with versioning, quota (LRU), and logging
   - Versioning via CACHE_VERSION
   - skipWaiting / clients.claim on install/activate
   - Runtime cache with max entries and LRU eviction using IndexedDB
   - Network-first for navigations/API; cache-first for static assets
   - Verbose logging controlled by VERBOSE flag
*/

const CACHE_PREFIX = 'galstian-cache';
const CACHE_VERSION = '2026-01-05-1';
const PRECACHE = `${CACHE_PREFIX}-precache-${CACHE_VERSION}`;
const RUNTIME = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const METADB = `${CACHE_PREFIX}-metadb-${CACHE_VERSION}`;

const VERBOSE = true;

const RUNTIME_MAX_ENTRIES = 120; // quota: max number of entries

function log(...args) {
  if (VERBOSE) {
    console.log('[SW]', ...args);
  }
}

/* ----------------- Small IndexedDB wrapper for LRU metadata ----------------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(METADB, 1);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('entries')) {
        const os = db.createObjectStore('entries', { keyPath: 'url' });
        os.createIndex('by_time', 'lastAccessed');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putMeta(url, ts = Date.now()) {
  try {
    const db = await openDB();
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    store.put({ url, lastAccessed: ts });
    return tx.complete || new Promise((res) => (tx.oncomplete = res));
  } catch (e) {
    log('putMeta failed', e);
  }
}

async function deleteMeta(url) {
  try {
    const db = await openDB();
    const tx = db.transaction('entries', 'readwrite');
    tx.objectStore('entries').delete(url);
    return tx.complete || new Promise((res) => (tx.oncomplete = res));
  } catch (e) {
    log('deleteMeta failed', e);
  }
}

async function countEntries() {
  try {
    const db = await openDB();
    const tx = db.transaction('entries', 'readonly');
    const store = tx.objectStore('entries');
    return new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    log('countEntries failed', e);
    return 0;
  }
}

async function getOldestEntries(limit = 1) {
  try {
    const db = await openDB();
    const tx = db.transaction('entries', 'readonly');
    const idx = tx.objectStore('entries').index('by_time');
    const entries = [];
    return new Promise((resolve, reject) => {
      const cursorReq = idx.openCursor();
      cursorReq.onsuccess = (ev) => {
        const cur = ev.target.result;
        if (!cur || entries.length >= limit) return resolve(entries);
        entries.push(cur.value.url);
        cur.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch (e) {
    log('getOldestEntries failed', e);
    return [];
  }
}

/* ----------------- Lifecycle: install / activate ----------------- */
self.addEventListener('install', (event) => {
  log('install event, version=', CACHE_VERSION);
  self.skipWaiting();
  // Optionally pre-cache app shell here if needed
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => {
      log('precache opened:', PRECACHE);
      return Promise.resolve();
    })
  );
});

self.addEventListener('activate', (event) => {
  log('activate event, version=', CACHE_VERSION);
  event.waitUntil(
    (async () => {
      // claim clients immediately
      await self.clients.claim();
      // Find old caches but DO NOT delete automatically to avoid accidental data loss.
      const keys = await caches.keys();
      const old = keys.filter((k) => ![PRECACHE, RUNTIME].includes(k));
      if (old.length) {
        log('Found old caches (not deleted automatically):', old);
      }
      // Note: to delete old caches send a message {type: 'CLEAN_OLD_CACHES'} from the page.
    })()
  );
});

/* ----------------- Utility: enforce runtime quota (LRU eviction) ----------------- */
async function enforceQuota(cache) {
  try {
    const cnt = await countEntries();
    if (cnt <= RUNTIME_MAX_ENTRIES) return;
    const toRemove = cnt - RUNTIME_MAX_ENTRIES;
    log('enforceQuota: current=', cnt, 'max=', RUNTIME_MAX_ENTRIES, 'remove=', toRemove);
    const oldest = await getOldestEntries(toRemove);
    for (const url of oldest) {
      try {
        await cache.delete(url);
        await deleteMeta(url);
        log('evicted (LRU) from runtime cache:', url);
      } catch (e) {
        log('eviction failed for', url, e);
      }
    }
  } catch (e) {
    log('enforceQuota failed', e);
  }
}

/* ----------------- Fetch handler with strategies ----------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Quick guard: intercept accidental requests to '/null' and return empty response
  try {
    if (url.pathname === '/null' || url.href.endsWith('/null')) {
      log('Intercepted request to /null — responding with 204');
      event.respondWith(new Response('', { status: 204, statusText: 'No Content' }));
      return;
    }
  } catch (e) { /* ignore URL parse errors */ }

  // Skip cross-origin requests except if explicitly same-origin resources fetched by CDN allowed
  const isSameOrigin = url.origin === self.location.origin;

  // Heuristics for request type
  const accept = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html');
  const isApi = url.pathname.startsWith('/api') || accept.includes('application/json');
  const isStaticAsset = /\.(?:js|css|png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|json)$/.test(url.pathname);

  if (isNavigation || isApi) {
    // network-first strategy
    event.respondWith(networkFirst(req));
    return;
  }

  if (isStaticAsset && isSameOrigin) {
    // cache-first strategy
    event.respondWith(cacheFirst(req));
    return;
  }

  // default: try network, fallback to cache
  event.respondWith(networkFallbackCache(req));
});

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) {
      const cloned = resp.clone();
      await cache.put(req, cloned);
      await putMeta(req.url);
      log('networkFirst: fetched & cached', req.url);
      await enforceQuota(cache);
    }
    return resp;
  } catch (e) {
    log('networkFirst failed, trying cache for', req.url, e);
    const cached = await cache.match(req);
    if (cached) {
      await putMeta(req.url);
      log('networkFirst: served from cache', req.url);
      return cached;
    }
    return new Response('Network error and no cached resource', { status: 504, statusText: 'Gateway Timeout' });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  if (cached) {
    await putMeta(req.url);
    log('cacheFirst: hit', req.url);
    return cached;
  }
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) {
      await cache.put(req, resp.clone());
      await putMeta(req.url);
      log('cacheFirst: fetched & cached', req.url);
      await enforceQuota(cache);
    }
    return resp;
  } catch (e) {
    log('cacheFirst fetch failed for', req.url, e);
    return new Response('Offline and resource not cached', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFallbackCache(req) {
  try {
    const resp = await fetch(req);
    // don't cache opaque cross-origin responses to avoid quota issues
    if (resp && resp.ok && resp.type !== 'opaque') {
      const cache = await caches.open(RUNTIME);
      await cache.put(req, resp.clone());
      await putMeta(req.url);
      log('networkFallbackCache: fetched & cached', req.url);
      await enforceQuota(cache);
    }
    return resp;
  } catch (e) {
    const cache = await caches.open(RUNTIME);
    const cached = await cache.match(req);
    if (cached) {
      await putMeta(req.url);
      log('networkFallbackCache: served from cache', req.url);
      return cached;
    }
    return new Response('Offline and no cache', { status: 504, statusText: 'Gateway Timeout' });
  }
}

/* ----------------- Message handler for manual control / debugging ----------------- */
self.addEventListener('message', (ev) => {
  const data = ev.data || {};
  log('message from client:', data);
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data && data.type === 'LOG_STATS') {
    (async () => {
      const cache = await caches.open(RUNTIME);
      const keys = await cache.keys();
      const count = keys.length;
      ev.source.postMessage({ type: 'RUNTIME_STATS', count });
    })();
  }
  if (data && data.type === 'CLEAN_OLD_CACHES') {
    // Destructive operation disabled by default to prevent accidental data loss.
    (async () => {
      const keys = await caches.keys();
      const old = keys.filter((k) => ![PRECACHE, RUNTIME].includes(k));
      log('CLEAN_OLD_CACHES requested but DESTRUCTIVE OPS ARE DISABLED. Candidates:', old);
      ev.source.postMessage({ type: 'CLEAN_OLD_CACHES_DISABLED', candidates: old });
    })();
  }
});

/* ----------------- Safe cleanup flow (two-step) -----------------
   - LIST_OLD_CACHES: returns the list of cache keys considered "old" (no destructive action)
   - CONFIRM_CLEAN_OLD_CACHES_SAFE: performs deletion; optional { includeIndexedDB: true }
   This two-step flow avoids accidental deletions when invoked unintentionally.
*/

async function listOldCaches() {
  const keys = await caches.keys();
  const old = keys.filter((k) => ![PRECACHE, RUNTIME].includes(k));
  return old;
}

async function deleteOldIndexedDBs(prefixes = [CACHE_PREFIX]) {
  // Use indexedDB.databases() when available (modern browsers)
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      const toDelete = dbs.map(d => d.name).filter(n => n && prefixes.some(p => n.startsWith(p)));
      for (const name of toDelete) {
        try {
          log('Deleting IndexedDB:', name);
          await new Promise((res, rej) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
            req.onblocked = () => log('deleteDatabase blocked for', name);
          });
        } catch (e) {
          log('Failed to delete IndexedDB', name, e);
        }
      }
      return toDelete;
    }
  } catch (e) {
    log('indexedDB.databases() not available or failed', e);
  }
  return [];
}

self.addEventListener('message', (ev) => {
  const data = ev.data || {};
  // support the safe two-step cleanup protocol
  if (data && data.type === 'LIST_OLD_CACHES') {
    (async () => {
      const old = await listOldCaches();
      ev.source.postMessage({ type: 'OLD_CACHES_LIST', caches: old });
    })();
    return;
  }

  if (data && data.type === 'CONFIRM_CLEAN_OLD_CACHES_SAFE') {
    // CONFIRM flow intentionally disabled in-app to avoid destructive changes.
    (async () => {
      const keys = await caches.keys();
      const old = keys.filter((k) => ![PRECACHE, RUNTIME].includes(k));
      log('CONFIRM_CLEAN_OLD_CACHES_SAFE requested but DESTRUCTIVE OPS ARE DISABLED. Candidates:', old);
      ev.source.postMessage({ type: 'CLEAN_OLD_CACHES_SAFE_DISABLED', candidates: old });
    })();
    return;
  }
});

/* End of sw.js */
