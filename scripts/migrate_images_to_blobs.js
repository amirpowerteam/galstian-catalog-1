/*
  Browser-run migration helper: convert data: or base64 image fields in an IndexedDB store
  into Blob objects and store them back under a new field `image_blob` to reduce JSON exports.

  Usage (paste into page Console, or include temporarily):
    // list DBs (if supported)
    await MigrateImages.listDatabases();

    // then run migration for a specific DB and store
    await MigrateImages.migrate({ dbName: 'PortableCatalogDB_Lazy_V1', storeName: 'products', keyPath: 'id', dataField: 'image' });

  Notes:
  - The script creates a backup DB named `backup_<dbName>` with a copy of the targeted store before modifying data.
  - It's conservative: you must provide `dbName` and `storeName` to perform changes.
  - Works in modern browsers (uses indexedDB.databases() when available).
*/

(function(){
  const MigrateImages = {
    listDatabases: async function() {
      if (!indexedDB.databases) {
        console.warn('indexedDB.databases() not available in this browser');
        return [];
      }
      const dbs = await indexedDB.databases();
      console.log('Databases:', dbs.map(d=>d.name));
      return dbs.map(d=>d.name);
    },

    migrate: async function({ dbName, storeName, keyPath = 'id', dataField = 'image', batch = 50 } = {}){
      if (!dbName || !storeName) throw new Error('dbName and storeName required');

      console.log('Starting migration for', dbName, storeName);

      // backup
      await this._backupStore(dbName, storeName);

      const db = await this._openDB(dbName);
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      let cursorReq = store.openCursor();
      let processed = 0;
      const failures = [];

      return new Promise((resolve, reject) => {
        cursorReq.onsuccess = async (ev) => {
          const cur = ev.target.result;
          if (!cur) {
            console.log('Migration complete, processed=', processed, 'failures=', failures.length);
            resolve({ processed, failures });
            return;
          }
          const val = cur.value;
          const key = cur.primaryKey;
          try {
            const fieldVal = val[dataField];
            if (typeof fieldVal === 'string' && fieldVal.startsWith('data:')) {
              const blob = MigrateImages._dataURLToBlob(fieldVal);
              val.image_blob = blob;
              // optionally remove the original field to save space; keep original as backup in backup DB
              delete val[dataField];
              cur.update(val);
              processed++;
            }
          } catch (e) {
            failures.push({ key, error: e && e.message });
          }
          cur.continue();
        };
        cursorReq.onerror = (ev) => reject(ev.target.error);
      });
    },

    _openDB: function(name){
      return new Promise((res, rej) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    },

    _backupStore: async function(dbName, storeName){
      const backupName = 'backup_' + dbName;
      console.log('Creating backup DB', backupName, 'copying store', storeName);
      const src = await this._openDB(dbName);
      const version = src.version + 1;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(backupName, version);
        req.onupgradeneeded = (ev) => {
          const db = ev.target.result;
          try { db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: false }); } catch(e) {}
        };
        req.onsuccess = async () => {
          const dest = req.result;
          const tx = dest.transaction(storeName, 'readwrite');
          const dstStore = tx.objectStore(storeName);
          const srcTx = src.transaction(storeName, 'readonly');
          const srcStore = srcTx.objectStore(storeName);
          const cursorReq = srcStore.openCursor();
          cursorReq.onsuccess = (ev) => {
            const cur = ev.target.result;
            if (!cur) return;
            dstStore.put(cur.value);
            cur.continue();
          };
          cursorReq.onerror = (ev) => console.warn('backup cursor failed', ev.target.error);
          tx.oncomplete = () => { console.log('Backup complete'); resolve(); };
        };
        req.onerror = () => reject(req.error);
      });
    },

    _dataURLToBlob: function(dataurl){
      const arr = dataurl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while(n--) u8[n] = bstr.charCodeAt(n);
      return new Blob([u8], { type: mime });
    }
  };

  window.MigrateImages = MigrateImages;
})();
