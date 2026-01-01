// Auto-apply GitHub Release video URLs into IndexedDB (merge-safe) and
// attempt to set blob URLs on any <video> elements so mobile can play them.
(async function(){
  try{
    const DB = 'PortableCatalogDB_Lazy_V1';
    const openDB = (name, version=1) => new Promise((res, rej)=>{
      const rq = indexedDB.open(name, version);
      rq.onsuccess = ()=>res(rq.result);
      rq.onerror = ()=>rej(rq.error);
      rq.onupgradeneeded = ()=>res(rq.result);
    });

    const db = await openDB(DB);
    const tx = db.transaction('config','readwrite');
    const store = tx.objectStore('config');

    // Known release asset URLs (these are the files uploaded to the v1.0.0-deploy release)
    const RELEASE_BASE = 'https://github.com/amirpowerteam/galstian-catalog-1/releases/download/v1.0.0-deploy/';
    const ASSETS = ['boloc2.mp4','boloc3.mp4'].map(n=>RELEASE_BASE + n);

    // Safe helper to put if missing or merge hero block
    const get = (k)=> new Promise(res=>{ const r=store.get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); });
    const put = (k,v)=> new Promise(res=>{ try{ const p = store.put({ key:k, value:v }); p.onsuccess=()=>res(true); p.onerror=()=>res(false);}catch(e){res(false);} });

    // Apply welcome_video if missing
    (async ()=>{
      try{
        const w = await get('welcome_video');
        if (!w || !w.value){ await put('welcome_video', ASSETS[0]); console.info('auto_apply_release_urls: set welcome_video'); }
      }catch(e){}
    })();

    // Apply welcome_background_video if missing
    (async ()=>{
      try{
        const w = await get('welcome_background_video');
        if (!w || !w.value){ await put('welcome_background_video', ASSETS[0]); console.info('auto_apply_release_urls: set welcome_background_video'); }
      }catch(e){}
    })();

    // Merge hero_media_block.mediaUrl if missing, preserve heading/body
    (async ()=>{
      try{
        const h = await get('hero_media_block');
        const cur = h && h.value ? h.value : {};
        if (!cur.mediaUrl){ const merged = Object.assign({}, cur, { mediaUrl: ASSETS[1] }); await put('hero_media_block', merged); console.info('auto_apply_release_urls: merged hero_media_block.mediaUrl'); }
      }catch(e){}
    })();

    tx.oncomplete = ()=>{
      // After writes, attempt to fetch blobs and assign to <video> elements to improve mobile playback
      (async function setBlobs(){
        try{
          for(const url of ASSETS){
            try{
              const resp = await fetch(url, { mode: 'cors' });
              if (!resp.ok) continue;
              const blob = await resp.blob();
              const blobUrl = URL.createObjectURL(blob);
              const filename = url.split('/').pop();
              document.querySelectorAll('video').forEach(v=>{
                try{
                  const src = v.currentSrc || v.src || '';
                  if (!src || src.includes(filename) || src === url){ v.src = blobUrl; v.setAttribute('data-auto-apply','1'); }
                }catch(e){}
              });
            }catch(e){ console.warn('auto_apply_release_urls: fetch failed', e); }
          }
        }catch(e){ console.warn('auto_apply_release_urls: setBlobs failed', e); }
      })();
    };
    tx.onerror = ()=>{};
  }catch(e){ console.warn('auto_apply_release_urls error', e); }
})();
