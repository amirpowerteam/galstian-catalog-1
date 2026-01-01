/*
  Small admin UI to safely trigger the two-step cleanup in sw.js

  Usage:
    1) Add <script src="/scripts/sw_admin.js"></script> to a debug/admin page, or
    2) Paste the file content into the Console, then call `createSwAdmin()`.

  The UI provides:
    - "List Old Caches" (non-destructive) -> shows candidate caches
    - Checkbox: include IndexedDB
    - "Confirm Clean" -> sends CONFIRM_CLEAN_OLD_CACHES_SAFE

  The UI is intentionally minimal and only active in same-origin pages.
*/

(function(){
  function ensureContainer(){
    let container = document.getElementById('sw-admin-panel');
    if (container) return container;
    container = document.createElement('div');
    container.id = 'sw-admin-panel';
    container.style.position = 'fixed';
    container.style.right = '12px';
    container.style.bottom = '12px';
    container.style.zIndex = 999999;
    container.style.minWidth = '280px';
    container.style.maxWidth = '420px';
    container.style.background = 'rgba(0,0,0,0.8)';
    container.style.color = '#fff';
    container.style.padding = '10px';
    container.style.borderRadius = '8px';
    container.style.fontFamily = 'system-ui, Arial, sans-serif';
    container.style.fontSize = '13px';
    container.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong>SW Admin</strong>
        <button id="sw-admin-close" title="close" style="background:transparent;border:0;color:#ccc;cursor:pointer">✕</button>
      </div>
      <div style="margin-bottom:6px;"><button id="sw-admin-list" style="width:100%;padding:8px">List Old Caches</button></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><input id="sw-admin-include-idb" type="checkbox"/><label for="sw-admin-include-idb">Include IndexedDB</label></div>
      <div style="margin-bottom:6px;"><button id="sw-admin-clean" style="width:100%;padding:8px;background:#a33;color:#fff;border:0;border-radius:4px">Confirm Clean (Destructive)</button></div>
      <div id="sw-admin-output" style="max-height:260px;overflow:auto;background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;font-size:12px;color:#eee"></div>
    `;
    document.body.appendChild(container);
    document.getElementById('sw-admin-close').addEventListener('click', ()=>container.remove());
    return container;
  }

  function postToSW(msg){
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(msg);
      return true;
    }
    // try to use active registration
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        const sw = reg.active || reg.waiting || reg.installing;
        if (sw) sw.postMessage(msg);
      });
      return true;
    }
    return false;
  }

  function createSwAdmin(){
    const container = ensureContainer();
    const out = container.querySelector('#sw-admin-output');
    function logLine(x){
      const p = document.createElement('div');
      p.textContent = typeof x === 'string' ? x : JSON.stringify(x);
      out.appendChild(p);
      out.scrollTop = out.scrollHeight;
    }

    // listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (ev)=>{
      const d = ev.data || {};
      logLine(['<-', d.type || 'MSG', d]);
    });

    container.querySelector('#sw-admin-list').addEventListener('click', ()=>{
      const ok = postToSW({ type: 'LIST_OLD_CACHES' });
      if (!ok) logLine('No active ServiceWorker controller. Ensure the page is controlled.');
      else logLine('Requested LIST_OLD_CACHES...');
    });

    // Destructive clean is disabled in-app. Provide a safe informational action instead.
    const cleanBtn = container.querySelector('#sw-admin-clean');
    cleanBtn.disabled = true;
    cleanBtn.title = 'پاک‌سازی خودکار غیرفعال است (برای ایمنی)';
    cleanBtn.addEventListener('click', ()=>{
      logLine('پاک‌سازی خودکار غیرفعال است. برای پاک‌سازی دستی از DevTools یا ابزارهای سرور استفاده کنید.');
    });

    return container;
  }

  window.createSwAdmin = createSwAdmin;
})();
