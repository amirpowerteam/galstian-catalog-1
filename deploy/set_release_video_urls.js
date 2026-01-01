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

    // Prefer existing helper if available
    if (typeof dbPut === 'function' && typeof STORES !== 'undefined'){
      // Only set the welcome/welcome_video and hero media URL.
      // Do NOT force the welcome background type to 'video' so we don't overwrite user's wallpaper preference.
      await dbPut(STORES.CONFIG, { key: 'welcome_video', value: welcomeUrl });
      await dbPut(STORES.CONFIG, { key: 'welcome_background_video', value: welcomeUrl });
      await dbPut(STORES.CONFIG, { key: 'hero_media_block', value: { mediaType: 'video', mediaUrl: heroUrl, heading: '', body: '' } });
      console.log('Config updated via dbPut. Reloading page...');
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
    // Don't change welcome_background_type here.
    store.put({ key: 'welcome_video', value: welcomeUrl });
    store.put({ key: 'welcome_background_video', value: welcomeUrl });
    store.put({ key: 'hero_media_block', value: { mediaType: 'video', mediaUrl: heroUrl, heading: '', body: '' } });

    tx.oncomplete = ()=>{ console.log('IndexedDB config updated. Reloading page...'); setTimeout(()=>location.reload(),700); };
    tx.onerror = (e)=>{ console.error('IndexedDB write failed', e); };

  }catch(err){ console.error('set_release_video_urls error', err); }
})();
