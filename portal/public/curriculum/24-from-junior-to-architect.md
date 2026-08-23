# Module 24 — From Junior to Architect

## Short Answer

The course goal is not to finish 25 markdown files. It is to move your **default reaction** to a bug from “which snippet do I paste?” to “which layer owns this, and what evidence would change my mind?”

Use this module as a periodic self-exam.

## The ladder

```text
Junior developer
      ↓  can name the components
Understands Android audio concepts
      ↓  can draw control vs data path
Understands AOSP audio architecture
      ↓  can walk createTrack → getOutputForAttr → threadLoop
Can read AudioFlinger / AudioPolicy
      ↓  can join dumps across services
Can trace audio end-to-end
      ↓  can use tinyplay / PCM state to split HAL from analog
Can debug HAL / ALSA
      ↓  can hold AOSP vs vendor hypotheses apart
Can debug Qualcomm DSP (when present)
      ↓  can read car XML as a running machine
Can debug AAOS multi-zone
      ↓  teaches others; designs buses and power contracts
Independent audio engineer
      ↓  owns product-level tradeoffs (latency, safety, power, cost)
Audio architect
```

You can be high on AAOS XML and junior on ASoC. That is normal. Rank **per track**, not one ego number.

## Skill gates (honest checks)

### Gate A — Concepts

You can explain without notes:

- Policy vs Flinger
- Usage vs focus vs volume
- Period vs buffer
- FE vs BE

**Test:** teach a new hire Module 03 and 05 in 20 minutes.

### Gate B — Architecture

You can draw the corrected end-to-end map and mark Binder, ioctl, and clocks.

**Test:** given “nav + media,” draw AAOS vs phone.

### Gate C — Source

You can find `getOutputForAttr` and `threadLoop` on your branch in 5 minutes and say what they return/do.

**Test:** walk `play()` to AIDL `Command.burst` (then vendor `pcm_write` if present) with tabs open, narrating process hops.

### Gate D — Dumps

You can annotate a Flinger+Policy pair and name last-known-good.

**Test:** Module 20 practice on a live emulator.

### Gate E — HAL/ALSA

You can convert a `pcm_config` to milliseconds and interpret RUNNING vs XRUN vs zeros.

**Test:** tinyplay bypass on a real board; write the split.

### Gate F — Vendor

You refuse to invent PAL/ACDB names; you still write a vendor hypothesis.

**Test:** Case study 6 in Module 21 from memory.

### Gate G — AAOS

You can read a v3 XML and predict Flinger addresses for two users.

**Test:** explain cast vs mirror vs zone config switch.

### Gate H — Architect

You can design a bus map, focus matrix implications, power budget, and test plan for a new ECU amp — and list what you would demand from DSP and apps.

**Test:** write a one-page audio architecture for “driver + RSE + ADAS chimes” and defend every shared bus.

## Habits of independent engineers

1. Classify the platform before naming APIs.
2. Write competing hypotheses on different layers.
3. Dump twice.
4. Convert frames to milliseconds.
5. Separate AOSP from vendor in every sentence.
6. Ask for four pieces of evidence, not a zip bomb.
7. State confidence and what would reduce it.
8. After a fix, list regressions (power, first-prompt, AEC, other zone).

## Habits of architects (additional)

1. Design **concurrency in hardware** where the product sentence requires it.
2. Treat focus as insufficient for safety.
3. Budget latency **and** bring-up, not only steady-state.
4. Make XML/HAL/ACDB the same story (one address, one use case, one AFE).
5. Specify factory tests: tinyplay per bus, fault bits, zone switch, ACC off/on.
6. Say no to “one bus to keep it simple” when it deletes ducking.
7. Document clock owners per use case (media vs voice vs BT).

## How to keep learning on the job

| Cadence | Action |
| --- | --- |
| Weekly | Read one function in AudioPolicyManager or Threads.cpp |
| Each bug | Five-line RCA in the ticket, even if you already patched |
| Each bring-up | A living diagram: bus → PCM → AFE/DAI → amp |
| Each release | Re-classify HAL and car XML versions |
| Teaching | Explain one comparison table from Module 25 to a peer |

If you only consume blogs, you will memorize Pixel folklore. If you only read XML, you will fear Flinger. Alternate.

## A note on mentoring

When you review a junior’s debug:

- Ask “what is last-known-good?” before you ask “what did you change?”
- If they jump layers, send them to the decision tree, not to the answer.
- If they are right, make them write the five lines anyway.

That is how this course intended to be used with you.

## Practice — place yourself

Copy and fill:

```text
Date:
Android I work on:
HAL generation I actually have:
AAOS? (xml version):
Vendor DSP?:

Strongest gate I pass:
First gate I fail:
One dump I will take tomorrow:
One source file I will read tomorrow:
```

Revisit every month. The file is the course’s last exam, and it never ends.

## Key Takeaways

1. Rank skills per track.
2. Gates are demonstrations, not rereads.
3. Architects design contracts between XML, HAL, DSP, and power.
4. Safety and concurrency are design inputs, not bugfix afterthoughts.
5. Teach; it exposes the holes faster than another logcat.

## Next

[Module 25 — Glossary and Comparisons](25-glossary-and-comparisons.md)
