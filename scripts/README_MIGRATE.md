Migration: images in IndexedDB -> Blobs

Purpose
- Convert large data:image/base64 fields stored in IndexedDB records into binary `Blob` fields to reduce JSON export size and improve storage efficiency.

Files
- `scripts/migrate_images_to_blobs.js` — browser-run helper. Exposes `MigrateImages` on `window` with `listDatabases()` and `migrate({...})`.

Basic safe workflow
1. Open the app in a browser on a test device (not production users).
2. Open DevTools Console.
3. Optionally list DBs (if supported):

```javascript
await MigrateImages.listDatabases();
```

4. Run a backup + migration for the exact DB and store name you want to migrate (example):

```javascript
await MigrateImages.migrate({ dbName: 'PortableCatalogDB_Lazy_V1', storeName: 'products', keyPath: 'id', dataField: 'image' });
```

Notes & safety
- The script creates a backup DB named `backup_<dbName>` and copies the target store before modifying records.
- The migration is conservative: it only converts fields that are strings starting with `data:` (data URLs).
- After migration, exported JSON should no longer contain giant base64 data in that field; instead the store contains a `image_blob` field (Blob objects are not inlined in JSON exports).
- Rollback: restore data from `backup_<dbName>` by reading that DB and copying values back into the original DB if needed.

Important safety note
- This migration helper only converts records and creates backups; it does not delete or drop databases/stores. The application explicitly disables destructive deletion operations. If you need a hard-delete of caches or DBs, perform it manually from DevTools or via an out-of-band admin process after verifying backups.

Admin UI
- You can run the migration from the built-in admin page without opening DevTools. Open `/admin.html`, fill `dbName` and `storeName`, then click `اجرای مهاجرت امن`. The page will:
	1. Create a backup DB named `backup_<dbName>`.
	2. Convert `data:` image fields to `Blob` and add `image_blob` to records.
	3. Report `processed` and any `failures` in an alert.

This flow is non-destructive (backup created) and intended for users who prefer not to use DevTools.

Limitations
- `indexedDB.databases()` is not supported in all browsers; listing helper may not work everywhere. The primary migrate operation uses the provided `dbName` and `storeName` and does not rely on that API.
- This is a browser-side migration tool — it must be run in a browser context where the app uses the target IndexedDB.

If you want, I can prepare a small admin UI to run this migration from the app instead of the console.
