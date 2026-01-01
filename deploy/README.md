# Deploy folder

This folder is produced by `scripts/prepare_deploy.js` and contains the minimal files to publish on GitHub Pages.

Place the contents of this `deploy/` folder at the root of the branch used by GitHub Pages (e.g., `gh-pages`) or push this folder's contents as the repository root.

- `index.html` includes a small script to fetch `catalog_backup.json` and set `window.PRELOADED_DATA`.
- If you want the app to use a different backup file, replace `catalog_backup.json` in this folder.

## Release assets (large files)

Large media files (videos) have been moved out of the repository to keep the repository lightweight. The original files for this release are available as release assets attached to tag `v1.0.0-deploy`.

Locally they are stored in a folder named `release-assets-local/` (this folder is added to `.gitignore`). If you need to re-upload the videos to the GitHub Release, use the `release-assets-local/` files when creating a Release in the GitHub web UI.

If you want me to upload the files into the GitHub Release for you, provide a GitHub Personal Access Token with `repo` scope and I'll upload them to the `v1.0.0-deploy` release.

### How to attach video assets and enable them in the app

1. Upload the two video files to the release `v1.0.0-deploy` for this repo. Use these file names when uploading:
	 - `boloc-2.mp4`
	 - `boloc-3.mp4`

2. After upload, open the deployed app in your browser, open DevTools → Console, then copy and paste the contents of `deploy/set_release_video_urls.js` and press Enter. This script will write the correct Release URLs into the app's IndexedDB config and reload the page.

3. Confirm playback on mobile: open the app URL on your phone (or use GitHub Pages preview) and the welcome/hero videos should stream from the Release assets URLs.

Notes:
- If you prefer, you can manually set the config entries instead of running the script. The Release URLs will be:
	- `https://github.com/amirpowerteam/galstian-catalog-1/releases/download/v1.0.0-deploy/boloc-2.mp4`
	- `https://github.com/amirpowerteam/galstian-catalog-1/releases/download/v1.0.0-deploy/boloc-3.mp4`
- If the app is served from `file://` open it via a local server for best results (see top of README for commands).
