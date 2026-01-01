// Helper: set release video URLs into the app's IndexedDB config
// Usage: after you upload boloc-2.mp4 and boloc-3.mp4 to the
// Release `v1.0.0-deploy`, open the app, open DevTools Console and
// paste this file's contents and run it.
(async function(){
  try{
    const base = 'https://github.com/amirpowerteam/galstian-catalog-1/releases/download/v1.0.0-deploy/';
    const welcomeUrl = base + 'boloc2.mp4';
    const heroUrl = base + 'boloc3.mp4';

    console.log('Setting release video URLs:');
    console.log(' welcome_background_video ->', welcomeUrl);
    console.log(' hero_media_block.mediaUrl ->', heroUrl);

    // Prefer existing helper if available. Merge hero_media_block instead of overwriting.
    if (typeof dbPut === 'function' && typeof dbGet === 'function' && typeof STORES !== 'undefined'){
      const existingHero = (await dbGet(STORES.CONFIG, 'hero_media_block'))?.value || {};
      const mergedHero = Object.assign({}, existingHero, { mediaType: 'video', mediaUrl: heroUrl });
      await dbPut(STORES.CONFIG, { key: 'welcome_video', value: welcomeUrl });
      await dbPut(STORES.CONFIG, { key: 'welcome_background_video', value: welcomeUrl });
      await dbPut(STORES.CONFIG, { key: 'hero_media_block', value: mergedHero });
      console.log('Config updated via dbPut (merged hero). Reloading page...');
      setTimeout(()=>location.reload(), 700);
      return;
    }

    // Fallback: write directly to IndexedDB (PortableCatalogDB_Lazy_V1 / config)
    const openDB = (name, version=1) => new Promise((res, rej)=>{
      const rq = indexedDB.open(name, version);
      rq.onsuccess = ()=>res(rq.result);
      rq.onerror = ()=>rej(rq.error);
      rq.onupgradeneeded = ()=>{
        const db = rq.result;
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'key' });
      };
    });

    const db = await openDB('PortableCatalogDB_Lazy_V1', 1);
    const tx = db.transaction('config', 'readwrite');
    const store = tx.objectStore('config');
    // Read existing hero_media_block and merge heading/body if present.
    const getReq = store.get('hero_media_block');
    getReq.onsuccess = ()=>{
      const cur = getReq.result ? getReq.result.value || {} : {};
      const merged = Object.assign({}, cur, { mediaType: 'video', mediaUrl: heroUrl });
      try{
        store.put({ key: 'welcome_video', value: welcomeUrl });
        store.put({ key: 'welcome_background_video', value: welcomeUrl });
        store.put({ key: 'hero_media_block', value: merged });
      }catch(e){ console.error('Error writing merged config', e); }
    };
    getReq.onerror = (e)=>{ console.error('Failed to read existing hero_media_block', e); };

    tx.oncomplete = ()=>{ console.log('IndexedDB config updated. Reloading page...'); setTimeout(()=>location.reload(),700); };
    tx.onerror = (e)=>{ console.error('IndexedDB write failed', e); };

  }catch(err){ console.error('set_release_video_urls error', err); }
})();
