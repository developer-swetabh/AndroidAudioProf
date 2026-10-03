# Android Audio Engineering Portal

Interactive teaching and debugging console for the AOSP / AAOS audio stack (Android 15, AIDL HAL). Live at https://androidaudio.vercel.app/.

## Run

```bash
cd portal
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `vite build` + `scripts/prerender.mjs` (static home and `/learn/<id>/` pages, critical CSS, `sitemap.xml`, `404.html`) |
| `npm run sync` | Copy repo `modules/` and `workbook/` into `public/curriculum/` and refresh `src/content/updated.json` from git dates |
| `npm run sync:check` | Fail if `public/curriculum/` is out of date with the repo sources |

Run `npm run sync` after editing anything in `../modules` or `../workbook`, and commit the result.

## Routes

| Route | Status |
| --- | --- |
| `/learn/:id/` | Prerendered module pages (crawlable, shareable) |
| `#/debug` · `#/debug/:playbook` | 10 debug playbooks |
| `#/learn` · `#/learn/:id` | Module reader (hash route) |
| `#/architecture` | Pipeline |
| `#/architecture/life/:scene/:step` | Lifecycle studio (create / period / bus / standby / policy) |
| `#/architecture/xml/:id` | Config studio (car / fade / policy / flags) |
| `#/fundamentals` | PCM studio |
| `#/glossary` | Glossary |
| `#/workbench` | Calculator + dump lab + RCA lab |
| `#/workbench/dump/:service/:scenario` | Dump lab |
| `#/workbench/rca/:id` | RCA cases 01–08 (illustrative) |
| `#/progression` · `#/progression/:gate` | Gates A–H |

`Ctrl+K` / `Cmd+K` opens the command palette.

Content lives in `src/content/` (`catalog.js`, `terms.js`, `comparisons.js`). Long-form teaching lives in `public/curriculum/`, which is a generated copy of repo `modules/` (do not edit it by hand).

## Performance notes

- Home and every `/learn/<id>/` page are prerendered from the same pure markup functions the app uses (`src/shellMarkup.js`, `src/pages/homeMarkup.js`, `src/pages/learnMarkup.js`). On boot the app wires up the static DOM instead of re-rendering it. Keep those functions free of DOM access.
- Lesson flow diagrams are rendered at build time with linkedom; if one throws, the slot stays empty and the app fills it on boot.
- Beasties inlines each page's critical CSS; the full stylesheet loads without blocking.
- Each section (`src/pages/*`) is its own chunk, loaded when first opened. Mermaid loads only when a diagram scrolls near the viewport.
- Fonts are self-hosted in `public/fonts/` (see the README there). No third-party requests.

## Deployment

Vercel, project root `portal/`. `vercel.json` sets trailing slashes, immutable caching for `/assets/*` and `/fonts/*`, and `X-Robots-Tag: noindex` on `/curriculum/*` (raw markdown the app fetches; the prerendered `/learn/` pages are the indexable copies).
