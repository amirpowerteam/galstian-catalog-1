// Auto-fix runtime config on page load (one-time safe migration)
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

    // Backup helper
    const backupKey = (k)=>`backup__${k}__${Date.now()}`;

    // Restore hero text if missing (preserve any existing heading/body)
    const gHero = store.get('hero_media_block');
    gHero.onsuccess = ()=>{
      const cur = gHero.result ? gHero.result.value || {} : {};
      // If heading/body missing or empty, restore sensible default
      if (!cur.heading || String(cur.heading).trim() === ''){
        // create a backup of current value
        try{ store.put({ key: backupKey('hero_media_block'), value: cur }); } catch(e){/* ignore */}
        const backupHero = {
          heading: "گالستیان؛ بیش از یک قرن میراث ماندگار در چیدمان",
          body: "«زمانی که صحبت از ۱۰۸ سال تخصص به میان می‌آید، یعنی درباره‌ میراثی حرف می‌زنیم که از پسِ آزمونِ زمان سربلند بیرون آمده است. برند گالستیان با بیش از یک قرن سابقه درخشان، هنر طراحی را با دانش فنی نسل‌ها درآمیخته تا امروز کامل‌ترین تجربه شخصی‌سازی فضا را به شما ارائه دهد. ما از نخستین طرح‌ها تا مدرن‌ترین آشپزخانه‌ها و مبلمان سفارشی امروز، همواره بر یک اصل استوار بوده‌ایم: خلق آثاری که کیفیت و شکوه آن‌ها، دهه‌ها ماندگار بماند. اعتماد شما، ریشه در قدمت ما دارد.»"
        };
        const merged = Object.assign({}, cur, backupHero);
        try{ store.put({ key: 'hero_media_block', value: merged }); console.info('auto_fix_runtime: restored hero heading/body'); }catch(e){console.warn('auto_fix_runtime: failed writing hero_media_block', e);}
      }
    };
    gHero.onerror = ()=>{/* ignore */};

    // If welcome background type is video, prefer keeping it photos (prevent wallpaper video autoplay)
    const gBg = store.get('welcome_background_type');
    gBg.onsuccess = ()=>{
      const cur = gBg.result ? gBg.result.value : null;
      if (cur === 'video'){
        try{ store.put({ key: backupKey('welcome_background_type'), value: cur }); } catch(e){}
        try{ store.put({ key: 'welcome_background_type', value: 'photos' }); console.info('auto_fix_runtime: switched welcome_background_type to photos'); } catch(e){console.warn('auto_fix_runtime: bg type write failed', e); }
      }
    };
    gBg.onerror = ()=>{/* ignore */};

    tx.oncomplete = ()=>{ console.info('auto_fix_runtime: migration done (if any changes)'); };
    tx.onerror = (e)=>{ console.warn('auto_fix_runtime: transaction failed', e); };
  }catch(err){ console.error('auto_fix_runtime error', err); }
})();
