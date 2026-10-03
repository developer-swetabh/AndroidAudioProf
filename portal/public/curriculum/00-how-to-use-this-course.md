# Module 00 — How to Use This Course

## Short Answer

Study Android audio the same way you will debug it: **layer by layer, with evidence, and with version awareness**. Read one module, open the named source, collect one dump, then answer the practice questions. Do not memorize component names without knowing who owns the decision.

## Mental Model

Audio is a **pipeline of ownership**.

- The **app** owns *what* it wants to play and the **meaning** of that sound (usage, content type).
- The **framework** owns *policy* (where it should go, how loud, who may play).
- **AudioFlinger** owns *execution* (mixing, timing, delivering PCM).
- The **HAL** owns *device abstraction*.
- The **kernel / ASoC** owns *PCM, DMA, DAI, clocks*.
- The **DSP / codec / amp** own *processing and analog energy*.

A junior engineer hears “no sound” and stares at the app. An architect asks: **at which ownership boundary did the expected state stop being true?**

## What each module trains

Every technical module is built from the same teaching loop:

```text
Concept
   ↓
Architecture
   ↓
Source-code path
   ↓
Runtime behavior
   ↓
Logs / dumps
   ↓
Debugging
   ↓
Root cause thinking
   ↓
Fix discipline
   ↓
Common mistakes
   ↓
Reusable mental model
```

You are not done with a module when you have read it. You are done when you can:

1. Explain the concept to another junior engineer.
2. Point to the owning component.
3. Name the dump or log that would prove the explanation.
4. List one false assumption people make about it.

## The six questions

Before you form a hypothesis, write these six answers. If you cannot, you do not understand the problem yet.

| Question | Meaning in audio |
| --- | --- |
| **WHO** owns this behavior? | App, AudioService, CarAudioService, AudioPolicy, AudioFlinger, HAL, ALSA, DSP, codec, amp |
| **WHERE** does the state change? | Track state, selected device, opened PCM, mixer control, clock, mute bit |
| **WHEN** does the failure occur? | Create, start, route change, focus loss, suspend, BT connect, boot |
| **WHAT** evidence proves it? | A specific line in a dump, log, mixer state, or scope trace |
| **WHY** did the state change? | Policy decision, config, clock stop, XRUN, wrong bus, calibration miss |
| **HOW** can we reproduce and validate? | Minimal stream, known usage, known device, before/after dump |

## Evidence rules

These rules exist because audio bugs invite confident guessing.

1. **A successful `AudioTrack.play()` does not prove sound left the speaker.** It proves the Java/native track entered a playing state.
2. **A RUNNING PCM does not prove the analog path is unmuted.** It proves the DMA/DAI side is transferring or at least is in the RUNNING state.
3. **A correct AudioPolicy device name does not prove the HAL opened that PCM.** Policy and HAL can disagree if configuration is inconsistent.
4. **A Qualcomm DSP graph being “up” does not prove the codec DAC is powered.** Those are different power domains.
5. **Absence of an error log is not proof of success.** Many mute and routing failures are silent.
6. **One log line is a clue, not a verdict.** Correlate across at least two layers.

## Version rule

This course’s **default** is documented in [REFERENCE_PLATFORM.md](../REFERENCE_PLATFORM.md):

```text
Android 15+
  + AIDL Core HAL  (android.hardware.audio.core.IModule)
  + AIDL Effects HAL
  + APM topology from IModule / IConfig (fetched by AudioFlinger's libaudiohal, handed to APM)
  + StreamDescriptor (FMQ burst / start / standby)
  + AAOS 15 car_audio_configuration.xml version 4
  + optional fade (v4 + car_audio_fade_configuration.xml)
```

Still write the classification line on every bug — some shipping 15 devices still run HIDL:

```text
Android release
    →
Audio HAL generation (this course: AIDL; HIDL is a deviation you must name)
    →
Policy topology source (IConfig/IModule vs leftover XML converter)
    →
AAOS car XML version (this course: 4)
    →
Vendor audio stack
```

If a teammate quotes `IDevice.openOutputStream` or `IPrimaryDevice.setMode`, they are speaking **HIDL**. Translate to `IModule.openOutputStream` and `ITelephony` / `IModule.updateAudioMode` before you debug.

Older anchors (history only — [Module 23](23-android-version-evolution.md)):

| Android | HAL | Notes |
| --- | --- | --- |
| 8–13 | HIDL 2.0–7.1 | XML policy was part of the HIDL contract |
| 14 | AIDL introduced | New HAL APIs are AIDL-only from here |
| **15 (this course)** | **AIDL Core HAL** | Topology via `IModule`/`IConfig`; AAOS config v4 + fade |
| 16+ | AIDL + CAP-over-AIDL | Full CAP configuration through AIDL; do not back-port those APIs to 15 |

## What you must not invent

If a lecture or a teammate cannot point to AOSP, a vendor document, or a device dump, treat the name as **unverified**.

Especially do not invent:

- AOSP class or method names
- HAL interface methods
- Qualcomm graph / module names
- Mixer control names (`RX INT1 MIX2` style names are *codec-specific*)
- PCM device numbers (`hw:0,45` is *board-specific*)
- `setprop` names you have not seen on that build

This course uses widely documented names and, when a name is vendor-specific, it says so.

## How to read a module

Recommended pass structure:

### Pass 1 — Picture (20–30 minutes)

Read Short Answer, Mental Model, Architecture. Draw the diagram yourself.

### Pass 2 — Mechanism (30–45 minutes)

Read Detailed Explanation and Source-Code Path. Open two or three files on [cs.android.com](https://cs.android.com) and skim the named methods.

### Pass 3 — Evidence (30 minutes)

Read Debugging and Logs. On a device or emulator run the *smallest* command set in that module. Save the output.

### Pass 4 — Judgment (15 minutes)

Answer the practice questions. Then read Common Mistakes and Key Takeaways.

If you only do Pass 1, you will recognize words. If you do Pass 3, you will start to become an engineer.

## Lab hygiene

When you collect logs, always record:

```text
Date / time (device + host)
Android version + build fingerprint
Product / board
Audio HAL type (legacy / HIDL version / AIDL)
AAOS or phone
Reproduction steps
Expected vs actual
Commands you ran
```

A dump without a build fingerprint is how teams waste days comparing different worlds.

## Minimum command set you will reuse

You will see these throughout the course. Learn what each *is for*, not only the command.

```bash
# Who is playing, on which thread, to which HAL output?
adb shell dumpsys media.audio_flinger

# What devices and patches does policy believe exist?
adb shell dumpsys media.audio_policy

# App-visible focus, volume, devices (Java AudioService view)
adb shell dumpsys audio

# AAOS zones, groups, focus, current routing
adb shell dumpsys car_service --services CarAudioService

# Kernel / ALSA (on devices that expose it)
adb shell cat /proc/asound/cards
adb shell cat /proc/asound/pcm

# Time-correlated logs
adb logcat -b main,system,crash -v threadtime
```

Module 20 teaches how to *read* these. Do not skip that module later.

## Practice

1. A teammate says: “AudioTrack started, so the HAL is fine.” Which evidence rule did they break?
2. You are given a bug on “Android 12 Qualcomm AAOS.” What five classification facts do you write down before opening logcat?
3. Why is “check the speaker” both a valid last step and a terrible first step?

Write your answers before opening Module 01.

## Key Takeaways

1. Expertise is the ability to name the **owning layer** and the **proving dump**.
2. Architecture first, version second, vendor third.
3. Successful APIs can still produce silence.
4. Do not invent platform-specific names.
5. One module, one diagram, one dump, one set of questions.

## Next

[Module 01 — Think in Layers](01-think-in-layers.md)
