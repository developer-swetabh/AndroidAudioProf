# MASTER PROMPT: Android Audio Engineering Portal
## Build a Beautiful, Interactive, Beginner-to-Architect Teaching & Debugging Platform

---

## 🎯 MISSION

You are a world-class Principal Audio Systems Architect and Senior Full-Stack Web Engineer. Your mission is to build a **stunning, production-quality web application** that teaches the complete **Android Audio Stack — from a Java app call down to actual electrical energy at a speaker** — across both standard **AOSP (Android Open Source Project)** and **AAOS (Android Automotive OS)**.

The platform must serve two audiences simultaneously:
- **Students** (interns to senior engineers) learning Android audio systematically for the first time
- **Working engineers** in the field who need a fast, structured diagnostic tool when a bug hits at 2 AM

The UI must feel like a **premium engineering console** — something between a spacecraft dashboard and a Figma design tool — not a boring documentation portal.

---

## 🎨 DESIGN SYSTEM & VISUAL IDENTITY

### Color Palette (strict — do not deviate)

```css
/* Backgrounds */
--bg-base:        #09090F;   /* Deep space black */
--bg-surface:     #111119;   /* Elevated surface */
--bg-card:        #16161F;   /* Card/panel background */
--bg-glass:       rgba(255,255,255,0.04); /* Glassmorphic overlay */
--bg-border:      rgba(255,255,255,0.08); /* Subtle border */

/* Primary Accent — Data flow / Playback path */
--cyan:           #00E5FF;
--cyan-dim:       rgba(0,229,255,0.12);
--cyan-glow:      0 0 24px rgba(0,229,255,0.35);

/* Secondary — AudioPolicy / Routing decisions */
--amber:          #FFB300;
--amber-dim:      rgba(255,179,0,0.12);

/* Success — Healthy metrics / HAL ACTIVE */
--emerald:        #00E676;
--emerald-dim:    rgba(0,230,118,0.12);

/* Danger — XRUNs / Errors / HAL ERROR state */
--crimson:        #FF4444;
--crimson-dim:    rgba(255,68,68,0.12);

/* Warning — Potential issues / Contributors */
--amber-warn:     #FF9100;

/* Purple — AAOS / Car-specific layer */
--violet:         #C084FC;
--violet-dim:     rgba(192,132,252,0.12);

/* Neutral text */
--text-primary:   #F1F5F9;
--text-secondary: #94A3B8;
--text-muted:     #475569;
--text-code:      #7DD3FC;
```

### Typography

```css
/* Headings */
font-family: 'Outfit', 'Inter', sans-serif;

/* Body / UI */
font-family: 'Inter', system-ui, sans-serif;

/* Code, Logs, Dumps, Commands */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

Import from Google Fonts: `Outfit:wght@300;400;600;700;800`, `Inter:wght@400;500;600`, `JetBrains+Mono:wght@400;500`.

### Component Design Language

| Component | Style |
|---|---|
| Cards | `background: var(--bg-card); border: 1px solid var(--bg-border); border-radius: 16px; backdrop-filter: blur(12px)` |
| Glow badges | `box-shadow: var(--cyan-glow); border: 1px solid rgba(0,229,255,0.3)` |
| Active state | Left border in layer color + background tint |
| Code blocks | Dark surface `#0D1117`, line numbers, token coloring |
| Log blocks | Terminal green `#22C55E` text on `#09090F` bg with scanline aesthetic |
| Buttons (primary) | Gradient `linear-gradient(135deg, #00E5FF22, #00E5FF11)` + cyan border |
| Progress bars | Animated shimmer gradient in layer color |
| Tooltips | Glassmorphic, `blur(20px)`, shadow-heavy |

### Micro-animations (mandatory throughout)

- **Hover:** `transform: translateY(-2px) scale(1.01)` + `box-shadow` lift, 200ms ease
- **Click/tap:** `scale(0.97)` brief pulse, 100ms
- **Layer transitions:** Cross-fade + slide, 300ms ease-in-out  
- **Signal flow arrows:** Animated dashed stroke SVG, flowing in direction of data
- **Metric updates:** Count-up number animation (0 → value, 600ms ease-out)
- **Code reveal:** Line-by-line typewriter effect for log simulators
- **Sidebar expand:** Spring physics (cubic-bezier(0.34, 1.56, 0.64, 1))
- **Page transitions:** Blur-fade (opacity 0→1 + blur 8px→0, 250ms)
- **Active layer glow:** Pulsing `box-shadow` animation at 2s interval

---

## 🏗️ APPLICATION ARCHITECTURE

**Technology:** Single HTML file OR a Vite + React/Vue SPA with modular components.

**Sections / Pages (top-level navigation):**
1. 🏠 **Home** — Hero + quick-start launcher
2. 🗺️ **Architecture** — Interactive Signal Chain Explorer
3. 📚 **Learn** — Structured module curriculum (beginner → architect)
4. 🔍 **Debug** — Guided Diagnostic Engine + Playbooks
5. 🧪 **Workbench** — RCA Playground + Buffer Calculator + Simulators
6. 📖 **Glossary** — Searchable term reference
7. 🏆 **Progression** — Personal skill tracker / gates

---

## 📐 PAGE-BY-PAGE SPECIFICATIONS

### Page 1: HERO (Home)

**Layout:** Full viewport hero with animated background.

**Background:** Animated SVG signal waveform (sine wave flowing left-to-right) + subtle grid of faint dots + a slow-rotating radial gradient halo in cyan/violet.

**Hero content:**
```
[Badge: "Android 15 · AOSP & AAOS · Beginner to Architect"]

h1: "Android Audio, 
     Completely Demystified."

Subtext: "From your first AudioTrack.play() to actual acoustic energy 
          at a speaker — learn, debug, and diagnose every layer of 
          the stack with an interactive engineering console."

[CTA Button: "Start Learning →"]   [CTA Ghost: "Debug an Issue →"]
```

**Below the fold — 4 animated stat cards:**
- `27 Modules` · Complete curriculum
- `8 Debug Playbooks` · Systematic diagnosis
- `7 Stack Layers` · From app to speaker
- `150+ Terms` · Searchable glossary

**Below stats — "Which path are you on?" selector cards:**

| 🎓 Student | 🔧 Engineer on a Bug | 🏎️ Automotive | 🎵 CarPlay / AA |
|---|---|---|---|
| Start from Module 00 | Jump to Diagnostic Engine | AAOS Architecture | Projection Deep-dive |

---

### Page 2: INTERACTIVE SIGNAL CHAIN EXPLORER ("Architecture")

This is the **centerpiece feature** of the application.

**Layout:** Full-screen interactive canvas. Left panel = scenario selector. Center = animated block diagram. Right panel = detail drawer.

#### The 7-Layer Block Diagram

Render a **vertical pipeline** of animated, clickable blocks. Each layer has:
- Its own **accent color** (see Layer Color Map below)
- An **animated connection arrow** showing data flow direction
- A **live state indicator** (dot: green=healthy, amber=warning, red=error) that changes with the selected scenario

**Layer Color Map:**
```
Layer 1: App & APIs              → Cyan     (#00E5FF)
Layer 2: AudioPolicy & Routing   → Amber    (#FFB300)
Layer 3: AAOS CarAudioService    → Violet   (#C084FC)
Layer 4: AudioFlinger Engine     → Sky Blue (#38BDF8)
Layer 5: Audio HAL (AIDL)        → Emerald  (#00E676)
Layer 6: Kernel / ALSA / ASoC    → Orange   (#FF9100)
Layer 7: DSP / Codec / Amp / Speaker → Rose (#FB7185)
```

**Clickable block — what opens on click (right panel drawer):**
- **WHO owns this layer?**
- **WHAT does it do?** (3-level: Beginner / Engineer / Architect)
- **KEY CLASSES / FILES** (clickable, links to cs.android.com)
- **FAILURE MODES** (what breaks here)
- **DUMPS / COMMANDS** (copy-to-clipboard bash snippets)
- **ANIMATIONS:** The connection to the next layer pulses when that layer is selected

#### Scenario Selector (left panel — 6 scenarios)

Users switch scenarios and the block diagram updates in real-time (state indicators change, labels update, the active path highlights, inactive paths dim):

1. **📱 Standard Media Playback (Phone)** — `AudioTrack` → `MixerThread` → HAL speaker  
2. **🚗 AAOS Navigation Ducking Media** — Two buses, concurrent focus, HAL duck of media  
3. **📞 CarPlay Duplex Telephony + ECNR** — Duplex path, `AAudioRecorder` + `AAudioPlayer`, ECNR model load  
4. **🔔 Emergency Chime on Cold Standby Bus** — Standby exit cost, first-prompt latency, amp unmute ramp  
5. **🎧 Bluetooth A2DP Routing Failure** — Policy BT disconnect split-brain, dead sink  
6. **🎵 Qualcomm DSP Graph + ACDB** — ADSP wake, PAL use-case, ACDB calibration, AFE port

**Each scenario must show:**
- Which layers are "hot" (active path) vs "cold" (standby or unused)
- Where errors/delays occur (highlighted in crimson with a pulsing warning icon)
- Animated data flow packets traveling down the pipeline

---

### Page 3: LEARN (Curriculum)

**Layout:** Two-panel — left sidebar = module tree (collapsible by track), right = module content viewer.

#### Module Navigation Tree

Grouped into 5 tracks (sidebar):

**🎓 Track 0: Foundations**
- Module 00: How to Use This Course
- Module 01: Think in Layers
- Module 02: End-to-End Architecture
- Module 02A: Playback Walkthrough (App→Speaker)

**🔊 Track 1: Core Stack (Layers 1–5)**
- Module 03: AudioPolicy vs AudioFlinger
- Module 04: AudioTrack, AudioRecord & Media APIs
- Module 05: AudioAttributes, Usage & Focus
- Module 06: AudioFlinger Internals
- Module 07: AudioPolicy Routing & Devices
- Module 08: Audio HAL (Legacy HIDL → AIDL)
- Module 09: ALSA, TinyALSA & PCM
- Module 10: ASoC, DAI, DMA, I2S, TDM
- Module 11: Codec, Amplifier & Hardware

**🚗 Track 2: Automotive (AAOS)**
- Module 12: AAOS Car Audio Architecture
- Module 13: Zones, Volume Groups & Routing
- Module 14: Concurrency, Mixing & Ducking
- Module 17: Bluetooth, USB & HDMI

**⚡ Track 3: Performance & Advanced**
- Module 15: Latency, Buffering & XRUNs
- Module 16: Qualcomm Audio & DSP
- Module 18: Power, Suspend & Resume
- Module 26: Android 15 AIDL Reference

**🔬 Track 4: Engineering Practice**
- Module 19: Debugging Methodology (8 Steps)
- Module 20: Logs, Dumps & Traces
- Module 21: Root Cause Analysis & Case Studies
- Module 22: Source Code Navigation
- Module 23: Android Version Evolution
- Module 24: From Junior to Architect
- Module 25: Glossary & Comparisons

#### Module Content Viewer (right panel)

Each module renders with:

**Header:** Module number badge + title + estimated read time + track color accent

**Content sections rendered with beautiful styling:**
- **Short Answer** → Highlighted summary card with cyan left-border
- **Mental Model / Analogy** → Illustrated card with an icon and light background tint
- **Architecture diagrams** → Rendered as visual block diagrams (not plain text)
- **3-Level Definitions** → Tabbed card: `Beginner` | `Engineer` | `Architect`
- **Code blocks** → Syntax-highlighted with copy button + language badge
- **Command blocks** → Terminal-styled with copy button
- **Comparison tables** → Styled data tables with hover highlights
- **Debugging trees** → Interactive flowchart (clickable decision tree nodes)
- **Practice questions** → Collapsible Q&A — question visible, answer hidden until clicked
- **Key Takeaways** → Numbered list with icon bullets
- **Common Mistakes** → Red-accented warning cards

**Bottom of each module:**
- `← Previous Module` / `Next Module →` navigation
- **Mark Complete** button → updates Progression page
- **"Quick Debug"** button → jumps to relevant Diagnostic playbook

---

### Page 4: DEBUG (Diagnostic Engine)

The **8-Step Methodology** (Module 19) built as a live interactive tool.

#### Layout: Three columns
1. **Left:** Playbook selector (vertical tabs)
2. **Center:** Active playbook (decision tree + step-by-step)
3. **Right:** Evidence collector + 5-Line RCA template

#### 7 Interactive Playbooks

Each playbook is a **clickable decision tree**. The user answers questions; the tree narrows to a specific diagnosis.

---

**Playbook 1: 🔇 No Audio / Silence**

Interactive flowchart with yes/no branches:
```
Is an AudioTrack / player created?
├── NO  → Framework/API / Permission / Format rejection
│         → Check: logcat -s AudioTrack; look for RECORD_AUDIO denial
└── YES → Is track ACTIVE in AudioFlinger?
          ├── NO  → Focus pause / Start rejected / Standby
          │         → Command: dumpsys media.audio_flinger
          └── YES → Is output the intended device/bus?
                    ├── NO  → AudioPolicy / CarAudio / BUS mapping
                    └── YES → Are Flinger frame counters moving & vol > 0?
                              ├── NO  → Mixer mute / empty buffer / VolumeShaper fade
                              └── YES → Did HAL open expected stream?
                                        ├── NO  → HAL flags/profile/address mismatch
                                        └── YES → Is PCM RUNNING & hw_ptr moving?
                                                  ├── NO  → ALSA hw_params / DMA / Clocks
                                                  └── YES → DSP graph / ACDB / AFE?
                                                            ├── NO  → Vendor DSP/calibration
                                                            └── YES → Codec/amp unmuted?
```

**Playbook 2: 📢 Wrong Speaker / Wrong Device**
**Playbook 3: 💥 Glitches / Drops / XRUNs**
**Playbook 4: ⏱️ High Latency / Cold Start Delay**
**Playbook 5: 🔊 Volume Stuck / Double Attenuation**
**Playbook 6: 🔵 Bluetooth Disconnect Split-Brain**
**Playbook 7: 📱 CarPlay Duplex KPI / ECNR Crash**

Each playbook renders its own styled decision tree with:
- Animated traversal (nodes light up as user clicks)
- Command suggestions at each branch (`copy to clipboard`)
- A **mock dump panel** that shows a simulated `dumpsys` output relevant to that playbook

#### Evidence Collector (right panel)

A form where the user fills in:
```
Android Version: [dropdown]
HAL Generation: [AIDL / HIDL / Legacy]
AAOS?: [Yes / No / Unknown]
Symptom: [text area]
What works: [text area]
What fails: [text area]
When: [dropdown — boot / focus / idle / BT connect / CarPlay]
```

As they fill, the **relevant playbook highlights** automatically.

At the bottom, a live **5-Line RCA Template** auto-populates from the decision tree path:
```
Symptom:           [auto-filled from evidence]
Immediate failure: [from tree leaf]
Root cause:        [editable]
Contributing:      [editable]
Fix:               [editable]
Layer changed:     [from tree]
Validation:        [from playbook recommendation]
Confidence:        [Low / Med / High selector]
```

**Export button:** Copy the RCA as markdown.

---

### Page 5: WORKBENCH (Interactive Tools)

Three sub-tools in a tabbed layout.

#### Tool A: ⚡ Buffer & Latency Calculator

**Interactive sliders:**
- Sample Rate: 8000, 16000, 44100, 48000, 96000 Hz (button group)
- Period Frames: 96, 192, 240, 480, 960, 1920 (slider)
- Period Count: 2, 3, 4, 6, 8 (slider)
- Extra columns for App Buffer Frames + DSP Delay ms + Amp Ramp ms

**Live real-time outputs (large, animated numbers):**
- **Period Duration:** `period_frames / sample_rate × 1000` ms
- **Hardware Buffer:** `period_ms × period_count` ms
- **Cold Start Budget:** `hw_buffer + DSP + amp ramp` ms
- **AEC Tail Requirement:** Must exceed output latency (warning if not)
- **XRUN Threshold:** Alert if period > 20ms on a FastMixer-class path

**Visual:** An animated water tank diagram showing fill level, flow rate, and XRUN danger zone marker.

**Scenario presets (buttons):**
- FastMixer / Touch Sounds → 48kHz, 192 frames, 2×
- AAOS Nav Prompt → 48kHz, 480 frames, 4×
- Deep Buffer Media → 48kHz, 1920 frames, 4×
- Voice/VoIP (AEC-safe) → 48kHz, 240 frames, 4×
- CarPlay Duplex → 16kHz, 256 frames, 4×

#### Tool B: 🖥️ Dump Simulator

A mock terminal that generates realistic `dumpsys` outputs for user-selected scenarios.

**Selector:** Choose service (`audio_flinger` / `audio_policy` / `car_service`) + Scenario dropdown.

**Output renders as a styled terminal block** with:
- Syntax-colorized fields (thread names in cyan, addresses in amber, states in emerald/crimson, volumes as numbers)
- Highlighted "smoking gun" lines (user can toggle: `Show hints`)
- **Annotations mode:** toggle to overlay callout labels explaining each field
- Copy full output button

**Example annotation (audio_flinger, "No Audio" scenario):**
```
Output thread 0xb2... MixerThread         ← [LAYER: AudioFlinger PlaybackThread]
  48000 Hz, AUDIO_FORMAT_PCM_16_BIT
  device: 0x40000000 bus0_media_out       ← [ROUTING: BUS to cabin woofers]
  standby: yes   ← ⚠️ HINT: Thread in standby. Start() was never called, or
                           no active tracks woke the thread. Check below.
  Track 0x123 uid=10087 PAUSED vol=0.000  ← ⚠️ HINT: vol=0 means either muted
                                              by focus loss or VolumeShaper fade.
```

#### Tool C: 🧩 5-Line RCA Workbench (Case Studies)

Interactive version of the case studies from Module 21 + the CarPlay workbook.

**Case study cards (left):**
- Case 1: "No Audio" — Usage Bug
- Case 2: Shared Bus Ducking Failure
- Case 3: Policy/HAL Profile Lie
- Case 4: Cold Chime Missing
- Case 5: BT Disconnect Split-Brain
- Case 6: Qualcomm ACDB Calibration Miss
- Case 7: Rude App vs Missing Focus Enforcement
- Case 8: CarPlay Duplex KPI Failure (SDVCCS-90202)

**For each case:**
1. Show **evidence snippets** as styled log cards
2. User drags evidence cards to match: `Symptom` / `Immediate Failure` / `Root Cause` / `Contributing` / `Fix`
3. On submit → show the correct RCA with detailed explanation
4. Show which layer owned the fix, and what regression risks existed

---

### Page 6: 📖 GLOSSARY

A searchable, categorized reference. Every term from Module 25 + all unique terms from the curriculum.

**Layout:**
- Top: live search input (filter as you type, fuzzy match)
- Filter pills: `All` | `API` | `HAL` | `AAOS` | `DSP` | `ALSA` | `Focus` | `Latency`
- Results: card grid with term, one-line definition, 3-level expandable detail, layer badge

**Featured comparison tables (Module 25 style):**
- MixerThread vs FastMixer vs DirectOutputThread vs OffloadThread
- FAST vs DIRECT vs DEEP_BUFFER flags
- Phone routing vs AAOS routing
- Software duck vs Hardware duck vs Focus exclusive loss
- HIDL vs AIDL: API rename table
- `useForVolume` device-port vs software track volume

---

### Page 7: 🏆 PROGRESSION TRACKER

Based on the 8 Gates from Module 24.

**Layout:** A visual "engineering ladder" with 8 rungs, each gate having:
- Gate letter + title
- Skill description
- `Mark as Done` toggle
- Self-test prompt
- Locked state (gates above current level dimmed)

**Skills inventory grid:** 
Axes: `Stack Layer` (rows) × `Skill Depth` (columns: Concepts / Architecture / Source / Dumps / Debug).
User marks cells green as they feel confident.

**Summary card at top:**
- Highest completed gate badge (animated particle burst when a new gate is completed)
- Weakest area (the column with fewest green cells)
- "Next recommended module" link

---

## 📚 COMPLETE CONTENT TAXONOMY

### The 6 Evidence Rules (Module 00) — display everywhere as a "first principles" sidebar:
1. `AudioTrack.play()` ≠ sound at speaker
2. PCM RUNNING ≠ analog path unmuted
3. Policy device name ≠ HAL opened that PCM
4. DSP graph "up" ≠ codec DAC powered
5. No error log ≠ success
6. One log line = clue, not verdict

### The 6 WHO/WHERE/WHEN/WHAT/WHY/HOW questions (Module 00) — integrate into RCA Workbench

### Stack Layers with Full Content:

**Layer 1 — App & APIs:**
- `AudioTrack`, `AudioRecord`, `MediaPlayer`, `AAudio` (C++), Oboe
- `AudioAttributes`: Usage, ContentType, Flags
- `AudioFocusRequest`, `OnAudioFocusChangeListener`
- Session IDs, Stream Types (legacy), Volume types
- Evidence: app log of attributes, write return code

**Layer 2 — AudioPolicy & Routing:**
- `AudioPolicyManager`: `getOutputForAttr`, `getInputForAttr`, `startOutput`, `stopOutput`, `startInput`, `stopInput`
- `AudioPolicyService`, Engine (default vs configurable), Strategies
- `audio_policy_configuration.xml` (legacy HIDL) vs `IConfig`+`IModule.getAudioPorts` (AIDL)
- Mix ports, Device ports, Profiles (format/rate/channel admission control)
- Patches: `IModule.setAudioPatch`, `resetAudioPatch`, `setAudioPortConfig`
- `useForVolume="true"` device-port property → forced `setAudioPortConfig` on `startOutput`
- AAOS Dynamic Mixes: `AudioPolicyMix`, `AudioPolicy.Builder`, user-id device affinity
- Evidence: `dumpsys media.audio_policy`

**Layer 3 — AAOS CarAudioService:**
- `car_audio_configuration.xml` (v1→v4), `car_audio_fade_configuration.xml` (v4/Android 15)
- `audioUseDynamicRouting` master flag
- Audio Zones → Volume Groups → CarAudioContexts → Bus addresses
- `CarOccupantZoneManager`: seat/display/user → occupant zone → audio zone → device affinity
- `CarAudioFocus`: focus matrix, concurrent interactions (reject/exclusive/concurrent/delayed)
- `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`, `setWillPauseWhenDucked()`
- `FadeManager` / `VolumeShaper` system-enforced fade (Android 15+, gated by flag)
- AudioControl HAL: `onAudioFocusChange`, ducking callbacks, OEM focus plugin
- CAP engine (Android 14+): `useCoreAudioVolume`, `useCoreAudioRouting`
- Evidence: `dumpsys car_service --services CarAudioService`

**Layer 4 — AudioFlinger:**
- Thread types: `MixerThread`, `FastMixer`, `DirectOutputThread`, `OffloadThread`, `RecordThread`, `DuplicatingThread`
- FAST vs DIRECT: FAST mixes (upmixes mono→stereo); DIRECT bypasses mixer (exact format required)
- Track states: `IDLE` / `ACTIVE` / `PAUSED` / `STOPPING` / `DRAINING` / `TERMINATED`
- Shared memory: `ashmem`/`memfd`, `AudioTrackClientProxy`/`ServerProxy`, `obtainBuffer`/`releaseBuffer`
- Buffer math: `period_ms = period_frames / sample_rate * 1000`; jitter window; XRUN physics
- Standby: teardown + DSP graph; bring-up cost on next start
- Effect chains: `EffectChain`, session scope, AEC/NS/AGC pre-proc, Spatializer (Android 12+)
- Fixed volume (`useFixedVolume=true`): Flinger stays at 1.0; HAL/DSP owns gain
- `createTrack_l` / `createRecord_l`: synchronous Binder RPCs; latency cost 16ms / 62ms typical
- `FAILED_TRANSACTION` retry in `createRecord_l` → up to 200–490ms sleep (outlier explained)
- Evidence: `dumpsys media.audio_flinger` (dump twice, compare frame counters)

**Layer 5 — Audio HAL (AIDL, Android 15):**
- `IModule`, `IConfig`, `IStreamOut`, `IStreamIn`, `IStreamCommon`, `ITelephony`, `IBluetooth`
- `StreamDescriptor`: command FMQ + reply FMQ + audio FMQ; `Command.burst`, `Command.start`, `Command.standby`
- Stream state machine: `STANDBY` → `IDLE` → `ACTIVE` → `PAUSED` → `DRAINING` → `ERROR`
- HIDL→AIDL rename table (must be visible on the AIDL module page)
- HIDL vs AIDL classification: how to identify which one the device runs
- Effects AIDL: `IFactory`, `IEffect`, `command(START/STOP/RESET)`
- Evidence: service list | grep audio; `lshal` for HIDL; Flinger header line

**Layer 6 — Kernel / ALSA / ASoC:**
- TinyALSA: `pcm_open`, `pcm_write`, `pcm_read`, `pcm_config`
- ALSA ring buffer: `hw_ptr`, `appl_ptr`, period frames × period count
- PCM states: `OPEN` → `PREPARED` → `RUNNING` → `XRUN` → `DRAINING`
- DMA engine, I2S, TDM multi-channel slot allocation
- ASoC DAI (Digital Audio Interface), DAPM (Dynamic Audio Power Management)
- FE/BE on Qualcomm: `MultiMedia1`, `Deep-Buffer`, `Compress` FEs; `PRI_MI2S`, `TDM`, `SLIMBUS` BEs
- Evidence: `/proc/asound/pcm`, `dmesg | grep xrun`, `tinyplay` bypass

**Layer 7 — DSP / Codec / Amplifier / Speaker:**
- Qualcomm ADSP (Hexagon), PAL, ACDB calibration database
- Use-case bring-up: graph lookup → ACDB → IPC (GPR/APR) → graph build → AFE port start
- `mixer_paths.xml` (kcontrol sequences) — NOT `audio_policy_configuration.xml`
- ADSP power: separate clock domain; SSR (subsystem restart) = global audio outage
- Smart Amp: thermal feedback, fault latch, speaker protection
- DAPM, GPIO enable sequences, pop/click suppression ramp
- Codec DAC power domain ≠ DSP graph "up"

---

## 🔑 CONTENT PRINCIPLES (must be visible / teachable throughout)

### The 3-Level Pedagogy (every major concept must have all three):
- **Beginner:** Analogy/mental model, no jargon
- **Engineer:** APIs, class names, concrete behavior
- **Architect:** Lock contention, IPC cost, timing budget, vendor contract boundaries

### The Teaching Loop (Module 00 — the 9 steps):
Concept → Architecture → Source-code path → Runtime behavior → Logs/dumps → Debugging → Root cause thinking → Fix discipline → Reusable mental model

### The 4 "Done" Criteria (for any module):
1. Explain it to a junior engineer
2. Name the owning component
3. Name the dump or log that proves it
4. Name one false assumption people make

### The 8 Engineer Habits (Module 24):
1. Classify platform before naming APIs
2. Write competing hypotheses on different layers
3. Dump twice (frame counter delta = motion)
4. Convert frames to milliseconds every time
5. Separate AOSP from vendor in every sentence
6. Ask for four pieces of evidence, not a log zip bomb
7. State confidence and what would reduce it
8. After fix: list regressions (power, first-prompt, AEC, other zone)

---

## 🌟 ADDITIONAL FEATURES (what the original prompt missed)

### Feature: Version Awareness Banner
Every page has a persistent top banner / sidebar badge:
```
📱 Default: Android 15 | AIDL Core HAL | AAOS Config v4
   Still on HIDL? → Classification guide →
```

### Feature: The Six Evidence Rules Card
A sticky floating card on debugging pages listing all 6 evidence rules from Module 00.

### Feature: WHO/WHERE/WHEN/WHAT/WHY/HOW Form
Built into the RCA Workbench. Users fill this table before forming any hypothesis.

### Feature: "Invent Nothing" Guard
A red warning badge on any page covering Qualcomm/vendor DSP that reads:
*"Do not invent PAL module IDs, ACDB topology names, or PCM device numbers. Ask your BSP owner."*

### Feature: AOSP vs Vendor Hypothesis Separator
Every debug hypothesis entry in the workbench has a mandatory toggle: `AOSP` | `Vendor`. The tool warns if only one type of hypothesis is written.

### Feature: Quick Compare Mode
Anywhere two similar concepts appear (FAST vs DIRECT, Phone vs AAOS, Hardware duck vs Software duck), a "Compare" button opens a side-by-side split view.

### Feature: cs.android.com Deep Links
Every AOSP class or file name mentioned in the content is a hyperlink pointing to the current branch on cs.android.com.

### Feature: Command Copy Panel
A collapsible side panel ("Quick Commands") always accessible, showing the minimum dump set for the current context:
```bash
adb shell dumpsys media.audio_flinger
adb shell dumpsys media.audio_policy
adb shell dumpsys audio
adb shell dumpsys car_service --services CarAudioService
adb shell cat /proc/asound/pcm
adb logcat -b main,system,crash -v threadtime
```

### Feature: "Classify Your Bug" First Modal
When landing on the Debug page, a modal asks 5 classification questions:
1. Android version (dropdown)
2. HAL generation (HIDL / AIDL)
3. AAOS or Phone?
4. Qualcomm DSP? (Yes / No / Unknown)
5. Reproduction trigger (boot / idle / BT connect / focus change / CarPlay session)
This pre-selects the most relevant playbook and fills the evidence form.

---

## 📱 RESPONSIVE & PERFORMANCE REQUIREMENTS

- **Mobile-first responsive** (320px → 1920px+)
- **Light/Dark toggle** (default: Dark)
- **Accessible:** WCAG 2.1 AA contrast, `aria-label` on all interactive elements, keyboard navigation
- **Performance:** No layout shift, lazy-load heavy SVG animations, `content-visibility: auto` on off-screen modules
- **Search:** Instant, client-side fuzzy search across all module titles, terms, and playbook names (`Ctrl+K` / `Cmd+K` opens command palette)
- **No placeholder content:** Every section must have real content from the curriculum above

---

## 🚀 DELIVERABLES CHECKLIST

- [ ] Complete, production-ready single-file HTML or Vite SPA
- [ ] All 7 pages (Home, Architecture, Learn, Debug, Workbench, Glossary, Progression)
- [ ] Interactive Signal Chain Explorer with 6 scenarios
- [ ] 7 Diagnostic Playbooks with interactive decision trees
- [ ] Buffer & Latency Calculator with animated tank viz
- [ ] Dump Simulator with annotation mode
- [ ] RCA Case Study workbench (8 cases)
- [ ] Searchable Glossary (full Module 25 content + terms from all modules)
- [ ] Progression tracker with 8 gates + skill matrix
- [ ] Full design system (colors, typography, animations) applied consistently
- [ ] All 27 modules rendered with beautiful typography and interactive elements
- [ ] SEO: proper `<title>`, `<meta description>`, semantic HTML5, `<h1>` per page
- [ ] Google Fonts loaded (Outfit, Inter, JetBrains Mono)
- [ ] Mobile responsive
- [ ] Dark/Light mode toggle
- [ ] `Ctrl+K` command palette search

---

## ⚡ THE NON-NEGOTIABLE AESTHETIC STANDARD

The final product must feel **premium and alive**. A developer opening it should feel the same "wow" as opening a Figma file, Linear, or Vercel dashboard — not a static docs site. Every interaction must have a micro-animation. Every data value must glow with meaning. Every layer of the stack must have its own visual identity that makes it instantly recognizable. If it looks like Bootstrap, it has failed. If it looks like the Android source docs, it has failed. It must look like something an audio architect would be proud to show at a conference.
```
