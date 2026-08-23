# Module 21 — Root-Cause Analysis and Case Studies

## Short Answer

**Symptom ≠ immediate failure ≠ root cause ≠ contributing factor ≠ fix.**

If you cannot fill all five lines, you are not ready to merge a change. This module practices that discipline on realistic automotive and phone stories.

## Mental Model

A crashed car:

| Term | Meaning | Example |
| --- | --- | --- |
| Symptom | What a human noticed | The cabin is silent |
| Immediate failure | What technically stopped | PCM is zeros or amp muted |
| Root cause | Why that happened | Nav context mapped to a bus whose HAL path never unmutes |
| Contributing factor | What made it likely or worse | No factory test on the nav PCM |
| Fix | The change that removes the why | Map nav to the working bus *or* implement the HAL path — whichever the **product** requires |

Fixing only the contributing factor (add a test) does not restore audio. Fixing only the symptom (make media louder) does not restore nav.

## The five-line template (use forever)

```text
Symptom:
Immediate failure:
Root cause:
Contributing factor:
Fix:
```

Add:

```text
Layer changed:
Validation:
Regression risks:
Confidence: (low/med/high) because (evidence)
```

## Case Study 1 — “No audio” that is really a usage bug

### Story

Nav prompts inaudible. Media fine. App team says AudioTrack plays.

### Evidence

- App: `USAGE_MEDIA`, `PLAYSTATE_PLAYING`, writes succeed
- Car dump: music → `bus0`, navigation → `bus1`
- Flinger: session on `bus0` ACTIVE

### Analysis

```text
Symptom:           Nav not heard as nav (maybe buried in media)
Immediate failure: Stream never entered the nav path
Root cause:        App used USAGE_MEDIA
Contributing:      No CTS-like check on attributes for the nav APK
Fix:               Set USAGE_ASSISTANCE_NAVIGATION_GUIDANCE; verify bus1
Layer:             Application
```

Confidence: **high** — join keys agree.

### Teaching point

Last-known-good was Flinger on the **wrong** bus. Hardware was innocent.

## Case Study 2 — Shared bus destroys hardware duck

### Story

OEM: “DSP will duck media 12 dB during nav.” Both full blast, clipped.

### Evidence

- Both usages correct
- Both contexts mapped to `bus0_media_out`
- One MixerThread, two ACTIVE tracks, both vol=1.0
- Fixed volume enabled

### Analysis

```text
Symptom:           Nav not intelligible; distortion
Immediate failure: Digital sum of two full-scale streams on one PCM
Root cause:        Config placed MUSIC and NAVIGATION on one bus
Contributing:      Fixed volume → Flinger cannot duck; HAL sees one stream
Fix:               Split nav bus in car + policy XML; implement HAL duck
                   on media bus; keep concurrent MAY_DUCK
Layer:             AAOS configuration + HAL gain
```

### Teaching point

The DSP engineer was blamed. The DSP never saw two streams.

## Case Study 3 — Policy/HAL profile lie

### Story

New 24-bit media app fails to start on a phone.

### Evidence

- `createTrack` fails
- Policy XML advertises `AUDIO_FORMAT_PCM_8_24_BIT` on speaker
- HAL open of that format returns EINVAL
- 16-bit apps work

### Analysis

```text
Symptom:           App cannot play
Immediate failure: HAL open EINVAL
Root cause:        Policy profile claimed a format the HAL/PCM cannot do
Contributing:      VTS not run after codec change
Fix:               Either implement 24-bit in HAL/PCM or remove it from
                   the declared profile and let framework convert
Layer:             Policy config and/or HAL capability (make them match)
```

### Teaching point

XML is a contract. A lie moves the failure to the most confusing layer.

## Case Study 4 — Cold chime

### Story

Seatbelt chime missing after parked idle; second chime OK.

### Evidence

- Flinger shows a short ACTIVE burst on `bus7`
- Tee sink (lab image) contains the chime PCM
- Scope: amp EN rises after the burst ends
- Standby yes before the event

### Analysis

```text
Symptom:           First chime missing
Immediate failure: Analog path still muted during the one-shot
Root cause:        Unmute/graph time > chime duration after standby
Contributing:      System sounds share a cold deep-buffer-like bus
Fix:               Warm the chime path, shorten bring-up, or pre-roll
                   silence; do not disable all standby
Layer:             HAL bring-up / power policy for that bus
```

### Teaching point

Tee sink saved you from rewriting Policy. Digital was fine.

## Case Study 5 — BT disconnect split-brain

### Story

After BT disconnect, media UI plays, cabin silent, then sometimes jumps to speaker after 10 s.

### Evidence

- Policy still lists A2DP AVAILABLE for 10 s
- Flinger thread still A2DP, writes increment
- BT stack already down (writes going to a dying HAL)

### Analysis

```text
Symptom:           Silence after unpair/disconnect
Immediate failure: Frames sent to a dead A2DP output
Root cause:        Device disconnect not propagated promptly to Policy
Contributing:      No timeout failover; HAL write does not fail fast
Fix:               Fix BT→AudioService disconnect notification;
                   consider write-fail → reroute
Layer:             Connection state path (BT stack / AudioService)
```

### Teaching point

Flinger did its job on the device Policy still advertised.

## Case Study 6 — Qualcomm cal miss (vendor)

### Story

New 8ch media bus silent. 2ch speaker device works. AAOS XML looks right.

### Evidence

- Flinger ACTIVE on `bus0_media_out` 8ch, frames move
- tinyplay on the HAL’s PCM silent
- Vendor log: ACDB lookup fail, default graph, AFE start on a debug port
- tinymix: cabin amps never change vs idle

### Analysis

```text
Symptom:           Cabin silent for media bus
Immediate failure: Default graph does not unmute cabin amps
Root cause:        No ACDB topology for this use case / 8ch / AFE
Contributing:      Bus added in Android XML without tuner involvement
Fix:               Add cal/graph + correct AFE; do not “fix” CarAudio
Layer:             Vendor DSP/calibration
```

### Teaching point

Always pair an AOSP hypothesis with a vendor one. Here AOSP was already proven good by Flinger + correct address.

## Case Study 7 — Rude app vs missing enforcement

### Story

During a call, a game keeps blasting. Legal/safety concern.

### Evidence

- Call holds focus; game never requested focus, still ACTIVE vol=1.0
- Android 13 product, no fade manager
- Both on cabin media-like bus

### Analysis

```text
Symptom:           Game audible during call
Immediate failure: Game PCM still mixed
Root cause:        Focus is cooperative; game ignores it; product has
                   no enforced fade (pre-15 or flag off)
Contributing:      Shared bus; HAL does not duck on CALL context
Fix (product):     Enforce at framework (15 fade) and/or HAL mute of
                   non-call buses during CALL; do not rely on the game
Layer:             Policy/HAL enforcement, not the game alone
```

### Teaching point

Telling app developers to “please obey focus” is not a vehicle safety plan.

## How to write the report

A good audio RCA is one page:

```text
Title
Build fingerprint / Android / HAL / AAOS config version
Repro steps
Expected vs actual
Last-known-good + evidence (paste 10 lines, not 10 MB)
Hypotheses considered and killed
Five-line RCA
Patch links + validation + regressions
```

If a reviewer cannot see **why the next layer was innocent**, the report is not done.

## Practice

Write five-line RCAs for these (then check the sketches):

**A.** Rear headphone zone config switch: user still hears headrest.

Sketch: Symptom = wrong transducer. Immediate = affinity still on `bus_100`. Root = config switch API failed or UI did not call it. Contributing = no dump after switch. Fix = fix switch path; verify Flinger address.

**B.** HDMI movie passthrough; nav inaudible on TV.

Sketch: Immediate = compressed direct output cannot mix. Root = product architecture. Fix = decode PCM and mix, or send nav to cabin speakers, not “HAL bug.”

**C.** `ERROR_DEAD_OBJECT` on all apps at once.

Sketch: Immediate = `audioserver` died. Root = crash (tombstone). Contributing = HAL binder death or mixer assert. Fix = the crash, not the apps.

## Key Takeaways

1. Five lines or it is not RCA.
2. Last-known-good decides the layer of the fix.
3. Shared-bus and wrong-usage bugs impersonate DSP bugs.
4. Vendor cal and Policy XML fail independently.
5. Safety-critical products cannot treat focus as sufficient enforcement.

## Next

[Module 22 — Source Code Navigation](22-source-code-navigation.md)
