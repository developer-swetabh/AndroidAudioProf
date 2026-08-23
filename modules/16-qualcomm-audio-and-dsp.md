# Module 16 — Qualcomm Audio and DSP

## Short Answer

Qualcomm audio is a **vendor stack** on top of (or beside) the AOSP HAL contract. AOSP does **not** contain ADSP graphs, ACDB calibration, or PAL as required components. If you debug a non-Qualcomm board with these words, you are in the wrong textbook.

On Qualcomm products, silence with a healthy AudioFlinger often means: **wrong use case, graph not built, calibration miss, or AFE port not connected** — not “AudioPolicy forgot the speaker.”

Who calls whom (memorize):

```text
App / AudioFlinger / AudioPolicy
        │  never call PAL or AGM
        ▼
Audio HAL (AIDL IModule)     ← last AOSP object
        │  vendor code
        ▼
PAL  (HLOS)  use-case
        ▼
AGM  (HLOS)  build DSP graph
        ▼
GPR / IPC
        ▼
ADSP graph + ACDB + AFE
        ▼
DAI (samples)  and  DCI/I2C (mute/gain registers)
```

This module teaches **how to think** on that stack, not a single SoC’s proprietary API as if it were universal.

## Mental Model

AOSP stops at a HAL stream. Qualcomm continues:

```text
Android Framework
       ↓
Audio HAL  (HIDL or AIDL, still the AOSP contract)
       ↓
Vendor audio layer (HLOS — apps processor userspace)
   older: audio_extn / legacy msm HAL
   newer: PAL (Platform Abstraction Layer) → AGM (Audio Graph Manager)
   emerging open direction: AudioReach
       ↓
ACDB / calibration + graph definitions
       ↓
GPR / IPC  (or older APR)
       ↓
ADSP  (Hexagon audio DSP)
       ↓
Audio processing graph
   (decoder / PP / mixer / ECNS / ...)
       ↓
AFE port  (interface to I2S/TDM/SLIM/SoundWire/codec)
       ↓
Codec / smart amp / speaker
```

Think of PAL as “use-case objects,” ACDB as “the recipe book,” ADSP as “the kitchen,” AFE as “the pass to the dining room.”

### Three-level definitions

**ADSP**

- **Beginner:** The extra CPU that processes audio.
- **Engineer:** Qualcomm’s Hexagon DSP running audio services.
- **Expert:** A separate power/clock domain. Graphs are downloaded and connected at use-case start. If it is asleep or the IPC failed, PCM from Android may be accepted and discarded.

**PAL**

- **Beginner:** Qualcomm’s modern userspace audio API under the HAL.
- **Engineer:** Platform Abstraction Layer: streams, devices, and use cases so the HAL is not a pile of `setParameters` strings.
- **Expert:** Not part of AOSP. Runs on HLOS (the apps processor). Present on newer chip families; older chips use different HALs. Public Qualcomm Linux/AudioReach docs describe PAL as the middleware to hardware and drivers.

**AGM**

- **Beginner:** The piece that actually wires the DSP graph for a PAL use-case.
- **Engineer:** Audio Graph Manager. PAL opens a use-case; AGM builds/connects the graph and talks to the DSP over GPR.
- **Expert:** Still HLOS, still vendor, still not AOSP. A “graph not built” log is AGM/DSP, not AudioPolicy. Do not invent graph module IDs.

**ACDB**

- **Beginner:** Tuning files.
- **Engineer:** Audio calibration database: topologies, graphs, gains, filter coefficients.
- **Expert:** If the ACDB does not contain the (use case, device, sample rate, channel) tuple you just opened, the graph may fail to build or may build with defaults that mute. This is a **data** bug, not a Java bug.

**AFE / ASM (classic Q6 mental model)**

These names appear in older/public materials. Your tree may differ.

- **ASM-like path:** stream/session services (decode, playback session)
- **AFE-like path:** audio front end — the port toward the codec/DAI
- Do not invent module IDs. Read *your* ADSP logs.

## Architecture / Flow

### Generic AOSP vs Qualcomm-specific

| Concern | Generic AOSP | Qualcomm typical |
| --- | --- | --- |
| After HAL write | TinyALSA PCM | Often TinyALSA **or** IPC to ADSP, sometimes both |
| Routing | Policy device / bus | Device + **backend / AFE port** + graph |
| Volume | Flinger and/or HAL gain | Often DSP gain + analog |
| Effects | Flinger or Effects HAL | Many live on ADSP |
| Voice | Telephony + HAL | Dedicated voice graphs, different FE |
| Calibration | Usually none in AOSP | ACDB required |

### Use case bring-up (conceptual)

```text
HAL open_output(flags, rate, channels, device)
    ↓
map to vendor use case (media / deep / fast / voice / compress / bus_X)
    ↓
PAL session → AGM graph
    ↓
look up ACDB graph + cal
    ↓
GPR/IPC to ADSP: build graph, connect stream to AFE
    ↓
configure codec/amp via mixer or DSP commands
    ↓
start
    ↓
frames flow: Flinger → HAL → (PCM and/or shared mem) → ADSP → AFE → pins
```

If any step returns a vendor error, Android may still show a started track (if open “succeeded” poorly) or may fail open. **Read the vendor error**, not just logcat from `AudioFlinger`.

### FE/BE on Qualcomm kernels

Qualcomm kernels typically expose many FE PCMs (`MultiMedia1`, `Deep-Buffer`, `Compress`, voice). DPCM binds them to BE DAIs (`PRI_MI2S`, `TDM`, `SLIMBUS`, `WSA` SoundWire, etc.). The HAL’s job is to pick the pair that matches the Android device/bus.

Wrong BE: Flinger is happy, cabin is silent, headphone codec might even play if you hit that BE by mistake.

**TDM slot mux vs analog MUX:** TDM is time-division on the serial DAI (the amp listens to slot N). Analog MUX is a DAPM/codec analog switch. They are not the same object. `car_audio_configuration.xml` programs neither.

## Detailed Explanation

### 1. Do not assume one Qualcomm architecture

There are generations:

- Legacy `audio_hw.c` + `mixer_paths.xml` + ACDB + APR to ADSP
- Intermediate audio extensions (`audio_extn`)
- PAL-based HAL
- AudioReach (Qualcomm has publicly discussed open-sourcing end-to-end pieces, including ACDB as graph+tuning storage)

**Ask your BSP owner which one you have** before you search for `mixer_paths.xml` or `pal_stream_open`.

### 2. mixer_paths.xml (when present)

A common older Android-on-Qualcomm mechanism: XML sequences of mixer controls for a path name (`speaker`, `voice-handset`, `bus0_media`…).

```text
Use case start → apply path → hundreds of kcontrols flip
Use case stop  → reset path
```

Bugs:

- Path name typo
- Path incomplete (DAC on, WSA amp off)
- Two paths fight (voice and media)
- Path written for a different codec SKU

This file is **not** `audio_policy_configuration.xml`. Policy does not parse mixer_paths.

### 3. Calibration misses

Typical symptom: one sample rate works (48 k), another does not (44.1 or 16 k voice). Or 2ch works and 8ch bus does not.

Hypothesis: ACDB has no entry; graph default is mute or invalid AFE config.

Evidence: vendor log line about cal lookup failure / default cal / graph create fail. The exact text is **build-specific**.

### 4. Power domains

ADSP can collapse independently of the AP. After a long idle:

- Flinger standby → HAL stop → ADSP graph torn down → clocks off
- Next start must bring ADSP, load graph, apply cal

This is the Qualcomm-shaped version of Module 15’s cold start. “First chime lost” may be ADSP wake + graph time.

### 5. Voice vs media

Voice often uses:

- Different FE
- Different AFE (maybe modem)
- ECNS graph
- Different clock master (Module 10)

A media speaker path working does **not** prove voice. Never reuse a media `tinyplay` success as a voice verdict.

### 6. What you may not have

If `tinyplay` on a MultiMedia PCM works, you exercised **some** graph. If production audio uses PAL shared memory into ADSP without that PCM, tinyplay is still a useful bypass but not a 1:1 replica. State that limitation in the report.

## Source-Code Path

AOSP-side (always real):

```text
frameworks/av/services/audioflinger/
frameworks/av/media/libaudiohal/
hardware/interfaces/audio/
```

Qualcomm-side (vendor trees; names vary; **may be absent**):

```text
hardware/qcom/audio/          or vendor/qcom/opensource/audio-hal/
PAL headers / pal_*.cpp
ACDB loader
GPR/APR IPC
kernel sound/soc/qcom/        (or techpack audio)
```

If your tree has none of these, **stop using this module as a map**.

Public Qualcomm documentation (Linux audio / AudioReach) is the right *conceptual* reference when the vendor tree is closed. It still may not match your Android BSP.

## Debugging

```text
Flinger ACTIVE, correct BUS/device, counters moving
   |
   +-- HAL open mapped to which use case / FE / BE?
   |       Unknown → enable vendor HAL logs (board handbook)
   |       Wrong BE → HAL routing table
   |       Right ↓
   +-- Did ADSP graph create succeed?
   |       No  → ACDB / IPC / ADSP down
   |       Yes ↓
   +-- Is the AFE port the one wired to the cabin amps?
   |       No  → backend map
   |       Yes ↓
   +-- Codec/WSA/amp mixer path applied?
           No  → mixer_paths / PAL device setup
           Yes → Module 11 electrical
```

### Hypothesis pairs you should always write

Always produce **one AOSP hypothesis and one Qualcomm hypothesis**:

```text
AOSP: Policy selected the wrong bus address.
QC:   Correct bus, but ACDB has no graph for 8ch 48k on that AFE.
```

Then pick evidence that distinguishes them (Policy dump vs vendor graph log).

## Logs / Commands

AOSP (always valid):

```bash
adb shell dumpsys media.audio_flinger
adb shell dumpsys media.audio_policy
adb logcat -s AudioFlinger audio_hw_primary
```

Qualcomm (only if your image actually has them — **do not invent props**):

```text
Vendor logcat tags often include words like PAL, ACDB, audio_hw, qti
Kernel: dmesg for q6dsp / asoc-qcom /gpr
Optional: vendor qxdm / mini-dm / ADSP fastrpc logs on debug images
```

Ask your platform team for the **supported** audio log kit for that chip. Using a random `setprop` from a 2016 blog on a 2024 PAL device is how you waste a week.

What a healthy start often contains (ideas):

```text
stream open with use case name
graph / session id allocated
AFE port start
mixer path apply
no cal miss
```

Problem ideas:

```text
graph create failed
ACDB lookup failed
AFE start failed
ADSP SSR (subsystem restart) — audio dies for everyone
```

ADSP SSR is a **platform event**. After SSR, all graphs are gone. Users hear a full audio outage. Look for subsystem restart, not a single app.

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Treating PAL as AOSP | Vendor only |
| Debugging ACDB on a non-QC SoC | Wrong universe |
| Equating mixer_paths with audio policy XML | Different files, different parsers |
| tinyplay success = production path success | May be a different FE/graph |
| Ignoring ADSP SSR | Looks like a mysterious global mute |
| Copying Pixel HAL logs | Different vendor |

## Practice

Media works. A new AAOS bus for chimes is silent. Flinger writes to `bus8_chime_out`. Policy looks perfect. Vendor HAL log (imagined structure): `pal_stream_open usecase=chime rate=48000 ch=2` then `acdb lookup failed, using default` then `AFE port 0xB3 start ok`. Cabin amps never unmute.

1. Last-known-good?
2. AOSP or Qualcomm?
3. What do you ask the tuner/BSP for?

Expected:

1. Android path is good through HAL write. Graph/AFE may be up on a **default** path that does not unmute cabin amps.
2. Qualcomm/vendor calibration and device mapping. Not CarAudio XML (already proven by Flinger address).
3. A proper ACDB topology for this use case + the AFE port that matches the chime TDM slots + mixer/PAL device sequence for those amps.

**Self-check:** Write three sentences: what is generic AOSP here, what is Qualcomm-specific, and what you refuse to invent.

## Key Takeaways

1. Label every hypothesis AOSP vs vendor.
2. Use case + graph + AFE + cal is the Qualcomm continuation of “HAL open.”
3. mixer_paths and ACDB are not AudioPolicy.
4. ADSP power and SSR create global symptoms.
5. If the BSP is not Qualcomm, leave this module.

## Next

[Module 17 — Bluetooth, USB, and HDMI Audio](17-bluetooth-usb-hdmi.md)
