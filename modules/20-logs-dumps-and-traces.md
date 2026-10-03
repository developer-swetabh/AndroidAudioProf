# Module 20 — Logs, Dumps, and Traces

## Short Answer

A dump is a **photograph of state**. A log is a **movie of events**. A trace is a **timeline of CPU/time**. You need photographs to know *what is*, movies to know *what happened*, and traces when *time* is the bug.

Learn to **read** `dumpsys media.audio_flinger` and `dumpsys media.audio_policy` the way a mechanic reads a gauge cluster. Collecting them unread is not debugging.

## Mental Model

| Tool | Answers |
| --- | --- |
| logcat | What events fired, in what order, with what errors |
| `dumpsys media.audio_flinger` | What is mixing *right now* |
| `dumpsys media.audio_policy` | What Policy believes is connected and patched |
| `dumpsys audio` | Java AudioService: focus, volumes, devices |
| `dumpsys car_service` | Zones, groups, car focus |
| dmesg | Kernel/ASoC/PCM |
| tee sink | What PCM Flinger actually produced |
| media.log / NBLOG | Fast-path logs that survive `audioserver` death |
| Perfetto | Did we miss a period deadline? |

### Three-level definition: a good log line

**Beginner:** Some text that looks related to audio.

**Engineer:** A line with time, process, thread, component, and a state change.

**Expert:** Something you can join to another layer (session, device address, timestamp within 10 ms).

## How to read AudioFlinger dump

Formatting changes by release. Hunt **ideas**:

```text
1. Header: PID, HAL version/module, clock
2. Playback threads:
     type, rate, format, channels
     period / frame count
     device bits + address
     standby yes/no
     write/standby counters
3. Tracks on each thread:
     session, uid, pid
     state (ACTIVE/PAUSED/...)
     attributes/usage if printed
     volume / mute
     underrun
     frames
4. Record threads (mirror)
5. Effects
6. Patches / devices (sometimes)
```

### What this dump means

| Field | Reveals | Healthy when playing | Problem |
| --- | --- | --- | --- |
| Thread type | Latency contract | Matches product intent | Fast requested, deep used unexpectedly |
| standby | Hardware path may be gone | no | yes while user expects sound |
| device + address | Where PCM is going | Intended bus/speaker | A2DP while you listen to cabin |
| track state | Execution | ACTIVE | PAUSED/STOPPED |
| volume | Software attenuation | Expected (often 1.0 on AAOS) | 0.000 surprise |
| underrun | Producer/mixer deadline | stable | climbing |
| frames | Data path motion | increases across 2 dumps | frozen |

**Join keys:** session, uid, device address, output id.

Dump **twice**. Motion is evidence.

## How to read AudioPolicy dump

Hunt:

```text
Available / connected devices (type + address)
I/O profiles (rates, formats, channels)
Outputs and their attached devices
Inputs
Patches (live connections)
Dynamic / registered mixes (AAOS)
Volume / stream or attribute indices
Phone state / modes (sometimes)
```

| Observation | Meaning |
| --- | --- |
| Device missing | Never connected or XML/HAL never declared it |
| Device present, not in any patch | Topology without a live route |
| Mix matches usage → bus X | AAOS dynamic routing installed |
| No mix, strategy points at speaker | Phone-style routing |
| Profile lacks 48000/8ch | 8ch bus create will fail or resample badly |

Disagreement with Flinger on the live device is a **priority finding**.

## How to read car audio dump

Hunt:

```text
Config version
Zones + occupant ids + current user
Active zoneConfig
Volume groups + indices + mute
Context → address
Focus holders + interaction
Fade configs (15+)
```

If this map says `navigation → bus1` and Flinger shows `bus0`, CarAudio and Policy have drifted (mix not registered, or app usage not what you think).

## How to read logcat

Always:

```bash
adb logcat -v threadtime -b main,system,crash
```

`threadtime` gives date, time, pid, tid, priority, tag. You need tid to see FastMixer vs Binder.

### Tags worth starting with

| Tag (common) | Component |
| --- | --- |
| `AudioTrack` / `AudioRecord` | Client |
| `AudioManager` / `AudioService` | Java policy/focus/volume |
| `MediaFocusControl` | Phone focus |
| `CarAudioService` / `CarAudioFocus` | AAOS |
| `APM_AudioPolicyManager` | Native policy |
| `AudioFlinger` / `AF::Track` | Execution |
| `audio_hw*` | Vendor HAL (name varies) |

`ALOGV` is often compiled out. Absence of a verbose line means nothing.

### Correlation

Illustrative timeline (reconstructed, not a real capture). The `pcm_open` line is a vendor HAL re-opening its PCM on standby exit; the AIDL stream itself was opened long before:

```text
12:01:03.100  app        AudioTrack start session=77
12:01:03.112  audioserver AudioFlinger start track 77
12:01:03.118  audioserver APM startOutput
12:01:03.140  audio HAL   pcm_open card=0 device=7
12:01:03.180  kernel      asoc trigger start
```

If the vendor HAL's standby exit (`pcm_open`/graph start) is 2 seconds later, you found first-prompt latency. If it never appears, last-known-good is Flinger/Policy.

## Tee sink (official AOSP debug — userdebug only, verify on your branch)

Documented at source.android.com/docs/core/audio/debugging. The page still describes the `TEE_SINK` flag and `af.tee` property; current AudioFlinger implements the tee in `services/audioflinger/afutils/NBAIO_Tee.cpp`, writing under `/data/misc/audioserver`. Property names and bits have changed over releases, so treat the list below as historical and check the code on your branch.

Before reaching for the tee, use the `dumpsys` options that every build has:

```bash
adb shell dumpsys media.audio_flinger --hal       # HAL-side stream state
adb shell dumpsys media.audio_flinger --stats     # per-thread timing statistics
adb shell dumpsys media.audio_flinger --effects   # effect chains and their state
adb shell dumpsys media.audio_flinger --memory    # shared-memory heaps
```

Purpose: keep a short recent PCM from Flinger for analysis.

Constraints:

- Disabled by default (privacy)
- Needs custom build (`TEE_SINK` in `frameworks/av/services/audioflinger/Configuration.h`)
- Runtime `af.tee` bitmask in `/data/local.prop`
- userdebug/eng; not for production
- Output under `/data/misc/audioserver/*.wav` after `dumpsys media.audio_flinger`

Bits (documented summary): 1 input, 2 FastMixer output, 4 per-track. Deep buffer may need bit 4 as a substitute.

**What a WAV tells you:**

| WAV content | Conclusion |
| --- | --- |
| Real audio | Flinger mixed correctly; bug below HAL or analog |
| Zeros | Mute/volume/empty track at or above Flinger |
| Glitch visible | XRUN or mixer issue in digital domain |
| Wrong content | Wrong session/track |

Restore the build and delete `/data/local.prop` after use.

## media.log / NBLOG

Also official. Addresses FastMixer logging:

- Non-blocking per timeline
- Shared memory circular buffer
- Can dump after `audioserver` crash
- Enabled when `ro.test_harness=1` (documented procedure)

Use it when adding logs inside FastMixer. Do not `ALOGE` the fast loop.

## Perfetto / systrace

Use when:

- Periodic glitches
- FastMixer overruns
- Binder on hot threads
- “It janks when the UI animates”

Look for slice length **> period_ms** on mixer threads.

If audio atrace tags are disabled on the build, you will see nothing. That is a build limitation, not proof of health.

## Kernel and mixer

```bash
dmesg
cat /proc/asound/cards
cat /proc/asound/pcm
tinymix
tinyplay ...
```

Read Module 09–11. Remember: production user builds may hide these.

## Command cheat sheet (Android 15 / AIDL)

```bash
adb shell getprop ro.build.version.release
adb shell dumpsys media.audio_flinger
adb shell dumpsys media.audio_policy
adb shell dumpsys audio
adb shell dumpsys car_service --services CarAudioService
adb shell dumpsys media.log          # if media.log active
adb logcat -v threadtime
adb shell dmesg
adb shell service list | grep -i 'audio.core\|IModule'
adb shell pidof audioserver
# HIDL-only leftover check (should be empty on the reference platform)
adb shell lshal | grep 'android.hardware.audio@' || true
```

Prefer the [lab script](../labs/capture_audio_lab.sh) so every capture has a fingerprint.

Save with fingerprint:

```bash
adb shell getprop ro.build.fingerprint
adb shell getprop ro.build.version.release
```

## What you can and cannot conclude

| Evidence | You may conclude | You may not conclude |
| --- | --- | --- |
| Track ACTIVE, frames move | Flinger data path alive | Speaker has voltage |
| Policy device = speaker | Policy decided speaker | HAL opened speaker PCM |
| Clean logcat | No logged error | No mute |
| tinyplay works on hw:0,0 | That PCM can play | Production bus uses 0,0 |
| Tee WAV has music | Mix is good | Amp is good |
| No XRUN counter | Not a counted XRUN | No audible glitch |

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Grepping only the app tag | You miss Policy/HAL |
| One Flinger dump | No motion |
| Sharing dumps without fingerprint | Wrong world |
| Leaving tee sink on | Privacy and performance |
| Treating dump field layout as stable ABI | It changes; hunt ideas |

## Practice

You are given (illustrative):

```text
MixerThread 48000 standby=no device=BUS addr=bus0_media_out
  Track session=5 uid=10080 ACTIVE vol=1.0 underrun=0
```

Car dump: `navigation → bus1_navigation_out`. App claims it is a nav app.

1. What is already proven?
2. What is the most likely mismatch?
3. Which single log line do you want next?

Expected:

1. Something from uid 10080 is mixing on the **media** bus.
2. App usage is MEDIA (or context map ignored). Policy/Car intended nav bus.
3. The AudioAttributes usage at track create, or the dynamic mix match log.

**Your turn:** Annotate a real dump from an emulator. Circle last-known-good.

## Key Takeaways

1. Dump = state, log = events, trace = time.
2. Read Flinger and Policy as a pair; join on address/session.
3. Dump twice for motion.
4. Tee sink splits “zeros in Flinger” from “zeros below.”
5. Never over-conclude.

## Next

[Module 21 — Root-Cause Analysis and Case Studies](21-root-cause-analysis-and-case-studies.md)
