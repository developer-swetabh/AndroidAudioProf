# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is an AOSP or Android Automotive audio engineer. They open the site either to learn the stack from the catalog or to reason about a real car audio path while debugging. Beginners are in scope. The course is not a consumer audio app and not a generic Android overview.

## Product Purpose

A browser course and working console for the Android 15 AAOS audio path, from a file to the speaker, plus the lessons, diagrams, dumps, and drills around that path. Success is that an engineer can follow the sample path and the control path without being shown a claim the source does not support.

## Positioning

The mechanism is a checked model of one release: `android15-release`. Sample bytes and control are different lines. The playback studio walks one stage at a time. Claims are tagged verified, version-dependent, vendor-specific, or unknown. A neighboring Android course can copy the topics. It cannot truthfully copy a path that refuses to invent classes, HAL behavior, or offload frequency.

## Operating Context

People use it in a browser, often beside AOSP source, a car image, or a dump. The local app is the Vite site in `portal/`. Routes are hash routes. A dark theme is the current default. A light theme already exists and stays. The published URL is not part of this change and must not be treated as deployed by a local edit.

## Capabilities and Constraints

Confirmed and in scope for this pass:

- Replace the visual system across the portal.
- Rebuild Home so the first screen is the MP3-to-speaker walk, with two actions: start learning, and open a dump. The catalog sits below that.
- Keep the product name Audio Architect, the Phase 9 banner, every route, studio control, lesson sentence, and AOSP claim.
- Do not rewrite facts in this pass. A later pass may revisit facts only after this look works.

Confirmed and out of scope for invention:

- Target remains Android 15, branch `android15-release` only. Do not mix in `android15-automotiveos-release`.
- Teaching player is MediaPlayer / NuPlayer. Media3 is not the teaching player.
- Colour is never the only signal on the playback studio. Reduced motion starts that studio paused.
- Vendor audio stays a labeled side case, not a specific invented HAL.
- No third AAudio / MMAP path. The first diagram is one primary zone.
- Do not invent classes, APIs, paths, interactions, customers, quotes, or measurements.

Stack already in the repo: Vite 6, vanilla JavaScript, one CSS file, hash router, no login and no database.

## Brand Commitments

The name on the product is Audio Architect. The footer credit is Swetabh. Linear, Teenage Engineering, Raycast, and logic analyzers were named as the craft bar for this redesign. They are not a locked palette, typeface, or layout.

## Evidence on Hand

- Portal source under `portal/src/`, including the playback studio and `portal/src/content/aaos-playback-paths.json`.
- Curriculum markdown under `modules/` and `portal/public/curriculum/`.
- No customer quotes, usage numbers, or car-specific offload rates are on hand. Do not fabricate them. The home counters may only show counts that already exist in the catalog code.

## Product Principles

- Show the working path. Do not introduce the product with a slogan in place of the mechanism.
- A sentence on screen about Android audio is either already sourced or it does not ship.
- Words carry the distinctions colour cannot carry alone.
- Chrome that hides a control, a route, or a claim is a defect.
- This pass changes look and the home composition. It does not change teaching.

## Accessibility & Inclusion

Keyboard access already exists for the command palette and the playback studio and must keep working. Playback colour is paired with text. Reduced motion must not autoplay the walk. No separate legal accessibility standard was set.
