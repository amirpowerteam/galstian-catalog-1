// Ensure the app uses same-origin uploaded video assets when available.
(async function(){
  try {
    const CANDIDATES = ['/assets/boloc2.mp4','/assets/boloc-2.mp4','/assets/boloc3.mp4','/assets/boloc-3.mp4'];
    const exists = async (u) => {
      try { const r = await fetch(u, { method: 'HEAD', cache: 'no-store' }); return r && r.ok; } catch(e){ return false; }
    };
    const assets = [];
    for (const c of CANDIDATES) {
      if (await exists(c)) assets.push(c);
    }
    if (!assets.length) return;

    // Use the page's db helpers (defined in index.html)
    if (typeof dbGet !== 'function' || typeof dbPut !== 'function' || typeof STORES === 'undefined') return;

    // Helper: set config key if missing or pointing to remote releases
    const shouldReplace = (val) => { if (!val) return true; try { return /github\.com|releases\/download/.test(String(val)); } catch(e){ return true; } };

    try {
      const w = await dbGet(STORES.CONFIG, 'welcome_video');
      if (!w || shouldReplace(w.value)) await dbPut(STORES.CONFIG, { key: 'welcome_video', value: assets[0] });
    } catch(e){}

    try {
      const wb = await dbGet(STORES.CONFIG, 'welcome_background_video');
      if (!wb || shouldReplace(wb.value)) await dbPut(STORES.CONFIG, { key: 'welcome_background_video', value: (assets[1]||assets[0]) });
    } catch(e){}

    try {
      const hero = await dbGet(STORES.CONFIG, 'hero_media_block');
      const cur = (hero && hero.value) ? hero.value : {};
      if (!cur.mediaUrl || shouldReplace(cur.mediaUrl)) {
        cur.mediaUrl = (assets[1]||assets[0]);
        await dbPut(STORES.CONFIG, { key: 'hero_media_block', value: cur });
      }
    } catch(e){}
  } catch (err) {
    // silent
  }
})();
