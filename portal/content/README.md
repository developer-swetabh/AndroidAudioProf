# Interactive content (YAML)

Authored data for the interactive features. Markdown modules stay the textbook;
these files drive the widgets that are embedded in them.

| Folder | What | Schema |
| --- | --- | --- |
| `flows/` | Step-by-step traces (Trace the Audio Path) | `schema/flow.schema.json` |
| `quizzes/` | Learning checks (single choice, reveal after attempt) | `schema/quiz.schema.json` |
| `scenarios/` | Debugging scenarios (UI ships in Phase 2) | `schema/scenario.schema.json` |
| `sources.lock.json` | Every source reference resolved to a line at the pinned tag | generated |
| `sources/excerpts.json` | Stored code excerpts (≤ 30 lines, AOSP Apache-2.0) | generated |

## Pinned sources

The course is pinned to **`android-15.0.0_r36`** (`src/lib/aosp.js`, `AOSP_TAG`).
A source reference looks like:

```yaml
- { repo: frameworks/av, path: services/audioflinger/AudioFlinger.cpp, symbol: "status_t AudioFlinger::createTrack(" }
```

`symbol` is a literal substring; `occurrence` picks the n-th match; `before` / `after`
size the excerpt. Kernel paths (`kernel/common`, branch `android15-6.6`, which moves)
are links only.

```bash
npm run sources              # fetch from googlesource (cached in .cache/), resolve lines, write the lock + excerpts
npm run sources -- --check   # re-verify every locked line against googlesource (network)
npm run content              # validate YAML + lock, write src/content/generated/** (also part of npm run build)
npm run sync:check           # curriculum copy + content check (offline)
```

The build never touches the network: it checks that every reference has a lock
entry for the current tag, with the same symbol, at the locked line of the stored
excerpt. Moving to a newer Android is a tag change in `aosp.js` plus `npm run sources`,
which reports every line that moved and fails on every symbol that disappeared.

## Validation rules (`scripts/build-content.mjs`)

- JSON Schema for each file type.
- Module ids exist in `src/content/catalog.js`; `#anchors` exist in the rendered module headings.
- Exactly one `correct: true` per single-choice item; ids are unique.
- `process` / `lane` come from a fixed enum (`app`, `system_server`, `com.android.car`,
  `audioserver`, `vendor_hal`, `kernel`, `hardware`).
- Every ```` ```aa-flow ```` / ```` ```aa-quiz ```` block in `modules/*.md` points at real content.
