SW Admin UI — usage

Purpose
- Tiny client-side admin UI to safely call the two-step cleanup flow implemented in `sw.js`.

How to use
1) Serve the app and open it in a browser where the Service Worker is active and the page is controlled.
2) Include the script on a debug/admin page:

```html
<script src="/scripts/sw_admin.js"></script>
<script>createSwAdmin();</script>
```

Or paste the file into DevTools Console and run `createSwAdmin()`.

What it does
- `List Old Caches` — sends `LIST_OLD_CACHES` to the SW; SW replies with `OLD_CACHES_LIST`.
- `Confirm Clean` — after user confirmation, sends `CONFIRM_CLEAN_OLD_CACHES_SAFE` with optional `includeIndexedDB` boolean. SW replies `CLEAN_OLD_CACHES_SAFE_DONE` when finished.

Note about safety
- For safety, destructive operations (automatic deletion of caches/IndexedDB) are disabled by default in the application. The admin UI will only list candidate old caches and provide guidance. If you need to perform deletion you must do so manually via DevTools or enable a one-time server-side/admin action outside of the user-facing app.
