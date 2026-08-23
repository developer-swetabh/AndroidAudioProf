# Android Audio Engineering Portal

Interactive teaching and debugging console for the AOSP / AAOS audio stack (Android 15, AIDL HAL).

## Run

```bash
cd portal
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

## Phase 8 (this ship)

Config studio on Architecture: AAOS/AOSP XML contracts (car map, fade, policy ports, CAP, flags, vendor mixer_paths). Markdown in modules 07/12/13/14 stays the essay.

## Phase 7

Progression: Module 24 gates A–H, layer × depth skill matrix, next-module recommendation from the same catalog. Dump/RCA labs remain from Phase 6.

| Route | Status |
| --- | --- |
| `#/debug` · `#/debug/:playbook` | Live — 10 playbooks |
| `#/learn` · `#/learn/:id` | Live — chrome + bound flow |
| `#/architecture` | Live — pipeline |
| `#/architecture/xml/:id` | Live — Config studio (car / fade / policy / flags) |
| `#/fundamentals` | Live — PCM studio |
| `#/glossary` | Live |
| `#/workbench` | Calculator + dump lab + RCA lab |
| `#/workbench/dump/:service/:scenario` | Live — empty pair ≠ Flinger stub |
| `#/workbench/rca/:id` | Live — cases 01–08 |
| `#/progression` · `#/progression/:gate` | Live — gates A–H |

`Ctrl+K` / `Cmd+K` opens the command palette.

Content lives in `src/content/` (`catalog.js`, `terms.js`, `comparisons.js`). Long-form teaching stays in `public/curriculum/` (copied from repo `modules/`).

Design system: `../master_prompt.md`.
