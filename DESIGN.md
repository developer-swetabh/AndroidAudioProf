---
name: Audio Architect
description: An open reference manual for the Android 15 AAOS audio path.
colors:
  oxide: "#e25b1a"
  ink: "#1a120c"
  cream: "#f6f1e8"
  night-leaf: "#16130f"
  night-surface: "#1c1814"
  night-card: "#221e19"
  day-paper: "#f3eee6"
  day-card: "#fffaf3"
  night-secondary: "#e4d8c8"
  night-muted: "#cbbba8"
  day-secondary: "#3a2e24"
  day-muted: "#5c4a3a"
  pcm-night: "#7dcec8"
  pcm-day: "#0e6b64"
  control-night: "#8f6428"
  control-day: "#6b4510"
  amber-text-night: "#e2b15a"
  amber-text-day: "#8a5a12"
  ok-night: "#6dca9a"
  ok-day: "#0f6b3c"
  stop-night: "#e07a72"
  stop-day: "#9b2f2a"
  steel-night: "#9eb8cc"
  steel-day: "#3d5568"
typography:
  display:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino, serif"
    fontSize: "clamp(2.4rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino, serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  reading:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.85em"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0em"
rounded:
  control: "2px"
  punch: "50%"
spacing:
  page: "24px"
  home-max: "1160px"
  nav: "56px"
  banner: "34px"
components:
  button-primary:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.night-leaf}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-day:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cream}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  nav-board:
    backgroundColor: "{colors.oxide}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    height: "{spacing.nav}"
---

# Design System: Audio Architect

## Overview

**Creative North Star: "Open manual"**

Audio Architect is a reference manual lying open on a coloured divider board. The board is one saturated oxide field and carries the banner and the navigation. The reading leaf is warm paper by day and warm ink by night, because engineers use this beside source and dumps after dark and also print-read a lesson in daylight. The page shows the audio path doing its job. It does not pitch.

The signature is a solid punched disc: on the brand, on the active navigation item, and on the selected playback stage. Nothing eases or fades in. Depth comes from the board against the leaf, not from shadow or glass.

**Key Characteristics:**

- Oxide board for banner and navigation in both themes, with ink type on that board.
- Serif for the manual title and lesson prose. Grotesk for chrome. Mono only for code, paths, counts, and stage order.
- Two-pixel corners. The only circle is the punch.
- Sample colour stays meaningful. Cyan is PCM. It is not the brand.

## Colors

One board colour, a warm leaf, and a separate set of data colours that must not be restyled into the brand.

### Primary

- **Oxide** (#e25b1a): The banner and the navigation bar in both themes. Ink (#1a120c) is the type and the punch on that board.

### Secondary

- **PCM** (#7dcec8 at night, #0e6b64 by day): Solid sample line and PCM stage colour. Never remap this to oxide.
- **Control stroke** (#8f6428 at night, #6b4510 by day): The dashed control line, legend dash, and the short join between control stages. Darker than warning amber so a 2px dash stays a line instead of a glare. Warning text stays #e2b15a at night and #8a5a12 by day, and is not the stroke.
- **Steel** (#9eb8cc at night, #3d5568 by day): Compressed and mixed-format stages. The variable is still named violet in CSS. The colour is steel, not lavender.
- **Clear** (#6dca9a at night, #0f6b3c by day) and **Stop** (#e07a72 at night, #9b2f2a by day): Success and error. Pair each with a word.

### Neutral

- **Night leaf** (#16130f), **Night surface** (#1c1814), **Night card** (#221e19): Default theme. Cream type (#f6f1e8), secondary (#e4d8c8), muted (#cbbba8).
- **Day paper** (#f3eee6) and **Day card** (#fffaf3): Light theme. Ink type, secondary (#3a2e24), muted (#5c4a3a).

**The Data Colour Rule.** Cyan, amber, steel, green, and red name a format or a state. Oxide never substitutes for them. A link on the leaf is ink or cream with an oxide underline, not a cyan link.

## Typography

**Display Font:** Source Serif 4 (Iowan Old Style, Palatino)
**Body Font:** Schibsted Grotesk (system-ui)
**Label/Mono Font:** JetBrains Mono (ui-monospace)

**Character:** The manual speaks in a text serif. The instrument around it speaks in a plain grotesk. Mono is measurement, not costume.

### Hierarchy

- **Display** (600, clamp(2.4rem, 5vw, 3.5rem), line-height 1.05, tracking -0.03em): Home title. Tracking does not go tighter than -0.04em. Size stays under 6rem.
- **Headline** (600, about 1.75rem): Section titles on the reading leaf, including the catalog heading.
- **Title** (600, grotesk, about 0.95rem): Navigation, buttons, track names.
- **Body** (400, grotesk, 1rem): Chrome and notes.
- **Reading** (400, serif, 1.0625rem, line-height 1.65, measure up to 72ch): Lesson prose.
- **Label** (500, mono): Module ids, stage order, paths, minute counts.

**The Reading Measure Rule.** Lesson prose stays inside roughly 65–75 characters. Chrome does not.

## Layout

Home is one column, max width 1160px, 24px of page padding (16px under 800px). The title, one sentence, and the two actions sit above the real playback diagram so they are in the first viewport. The catalog is an index under the diagram, grouped by the real track names. More space sits above a heading than below it.

The banner is 34px and the navigation bar is 56px. They share one oxide board. At 980px the navigation links move into a leaf-coloured drawer. Playback studio layout, including the 800px bottom sheet, is unchanged.

## Elevation & Depth

The system is flat. The board is a solid field. Cards are a one-pixel warm border on a leaf or card fill. There is no drop shadow, no glow, and no backdrop blur. `--cyan-glow` is `none`.

A selected stage also gets a 2px outline in the leaf’s focus colour, plus the punch. That outline is a state, not elevation.

**The Flat Leaf Rule.** Do not lift a card on hover. A press may move one pixel. Nothing else moves.

## Shapes

Corners are 2px, including buttons, cards, inputs, and stage nodes. The punched disc is a filled circle, 12px on the brand and 8px on an active nav item or selected stage. Pills are not part of the system.

Playback stages that cross a process or hardware boundary keep a 3px border on every side, and the word “boundary”. That thickness is the signal. Do not replace it with a left stripe.

## Components

### Buttons

- **Shape:** 2px corners. Weight 600. No gradient.
- **Primary:** On the night leaf, cream fill and night-leaf text. By day, ink fill and cream text. Hover mixes the fill slightly toward the page. Active state shifts down 1px.
- **Ghost:** Transparent fill, one-pixel border in the current text colour.
- **Focus:** 2px outline, offset 2px. The outline is cream on the night leaf and ink by day, so it shows on both the leaf and the oxide board.

### Navigation

- Oxide bar, ink grotesk, no underline. The active item leads with a filled ink disc. In the mobile drawer the bar colour stops: links are leaf text, and the active disc is oxide.
- Icon buttons are 36px, with an 18px stroke icon at 1.5px, `currentColor`. Search, theme, commands, and menu. No emoji.

### Cards / Containers

- **Corner Style:** 2px.
- **Background:** Night card or day card.
- **Shadow Strategy:** None.
- **Border:** 1px at the leaf’s border mix.
- **Internal Padding:** About 14–18px where a card is still used. Home’s catalog is a ruled list, not a card grid.

### The playback stage

- Full border, 2px, coloured by format. Boundary stages are 3px on every side.
- PCM is solid cyan. Compressed is solid steel. Control is a dashed stroke in the darker control colour, not warning amber. A stage that is both compressed and PCM says “compressed → PCM” and uses the steel border. It does not add a cyan side stripe.
- The selected stage says “Selected”, draws the punch, and keeps a 2px outline.

## Do's and Don'ts

### Do:

- **Do** keep the oxide board and the punched disc as the only brand marks.
- **Do** set lesson titles and lesson prose in Source Serif 4, and chrome in Schibsted Grotesk.
- **Do** keep PCM cyan, the darker control dash, and steel as data colours, with a word beside each. Warning amber is for text, not the dash.
- **Do** keep the playback boundary at a 3px border on every side, plus the word “boundary”.

### Don't:

- **Don't** open a page with a slogan, a count-up, or a row of equal icon cards.
- **Don't** put a kicker or eyebrow above a heading. A phase label above a non-home title is leftover, not the pattern.
- **Don't** use glow, glass, gradient fills, or a cyan underline as chrome.
- **Don't** use Inter, Outfit, or a system display face as the voice of the page.
- **Don't** use emoji or unicode glyphs as the shell icons.
- **Don't** let oxide replace a data colour, and don't thin the boundary border to satisfy a 1px side-stripe habit.
