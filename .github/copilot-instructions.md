# Copilot instructions — Catalog Builder

Purpose: quick, actionable guidance for AI coding agents to be productive in this repository.

- **Big picture**: this project is a single-file, offline-first React app delivered from `index.html`. UI and app logic are implemented inline (React UMD + Babel standalone) and styled with Tailwind CDN. Supporting artifacts: `index.css`, `metadata*.json` (app metadata), and some TypeScript/TSX stubs that are empty in this snapshot.

- **Entry point**: `index.html` is the canonical source of truth for behavior and data structures. Inspect it first for constants like `INITIAL_BRANDS`, `INITIAL_CATEGORIES`, `INITIAL_PRODUCTS`, `TRANSLATIONS`, and for placeholders such as `PRELOADED_DATA_PLACEHOLDER` which is used to seed runtime data.

- **Run / debug**: no npm scripts in `package.json`. The app runs by opening `index.html` in a browser or serving the folder with a static server. Recommended quick commands to run locally:

  ```bash
  npx http-server -c-1 .  # serve from repo root
  # or
  python -m http.server 5173
  ```

- **Important integration points**:
  - React and ReactDOM are loaded from UMD CDN and executed via `babel-standalone` in the browser — editing needs care (JSX inside `<script type="text/babel">`). See `index.html`.
  - Tailwind is injected via CDN `https://cdn.tailwindcss.com` and configured with `tailwind.config` in-page.
  - AI integration: the page dynamically imports `@google/genai` from `https://esm.sh/@google/genai` (look for `window.genai` initialization). Feature toggles or missing API keys should be handled defensively.

- **Data and persistence**: the app is offline-first and keeps data in-memory and persisted to browser storage (localStorage / in-page DB patterns). CSV export is used instead of XLSX (see index comments). Keep any migrations small and backward-compatible with existing `metadata*.json` conventions.

- **Project-specific conventions & patterns**:
  - Dual-language fields: objects commonly use `name.en` and `name.fa` for English and Persian content. Follow this shape when adding brands/categories/products.
  - UI state and data constants are declared as top-level constants inside `index.html` — modify them in-place or migrate to a modular structure but preserve the `PRELOADED_DATA_PLACEHOLDER` hook.
  - Avoid adding heavy build tooling unless migrating the whole repo; minimal changes are easier if kept compatible with the UMD/Babel runtime.

- **Files to inspect when making changes**:
  - [index.html](index.html) — primary app logic and UI.
  - [index.css](index.css) — project styles (may be empty or minimal).
  - [metadata.json](metadata.json) and `metadata-*.json` — metadata hints and app descriptors.
  - [package.json](package.json) — currently minimal; check before adding scripts.

- **Typical tasks & examples**:
  - To add a new product field: update the initializer (e.g., `INITIAL_PRODUCTS`) in `index.html` and adjust serialization logic where exports are created.
  - To disable AI calls for local dev: guard the `window.genai` usage early and provide a local fallback that returns placeholder descriptions.

- **When to propose bigger refactors**:
  - If adding tests, TypeScript build, or a componentized structure, recommend moving inline JSX into proper `.tsx` files and adding a small `package.json` script set (e.g., `vite` or `parcel`). Document migration steps; do not change app behavior during initial PRs.

If anything here is unclear or you want me to expand migration steps or add example PR patches (e.g., extract a component from `index.html`), tell me which area to prioritize.
