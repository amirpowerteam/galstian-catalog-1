# Deploy folder

This folder is produced by `scripts/prepare_deploy.js` and contains the minimal files to publish on GitHub Pages.

Place the contents of this `deploy/` folder at the root of the branch used by GitHub Pages (e.g., `gh-pages`) or push this folder's contents as the repository root.

- `index.html` includes a small script to fetch `catalog_backup.json` and set `window.PRELOADED_DATA`.
- If you want the app to use a different backup file, replace `catalog_backup.json` in this folder.
