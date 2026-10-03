# Module 23 — Android Version Evolution

## Short Answer

This course’s **present tense** is **Android 15 + AIDL Core HAL + AAOS car XML v4**. This module is how you **translate older trees backward** and how you avoid mixing 16-only CAP-over-AIDL into a 15 debug.

Roles are stable (Policy decides, Flinger executes, HAL abstracts). Contracts are not. Classify the device first. If it matches the [reference platform](../REFERENCE_PLATFORM.md), do not open HIDL folders.

## Mental Model

```text
Same skeleton since early Android:
  app → policy + flinger → HAL → driver

Changed repeatedly:
  process split (audioserver)
  HAL IPC language
  how topology is described
  how cars route (dynamic mixes, CAP, plugins, fade)
  low-latency paths (OpenSL → AAudio → MMAP)
```

Learn the skeleton once. Re-learn the contract per product.

## HAL generation vs Android

### Legacy C HAL

- Headers: `hardware/libhardware/include/hardware/audio.h`
- Pre-Treble world; still wrapped by later HIDL defaults
- `hw_module_t`, `audio_hw_device`, `audio_stream_out`

### HIDL (Treble)

Official pairing:

| Android | HIDL Audio HAL |
| --- | --- |
| 8 | 2.0 |
| 9 | 4.0 |
| 10 | 5.0 |
| 11 | 6.0 |
| 12 | 7.0 |
| 13 | 7.1 |

Documented through Android 13 as the HIDL era. HIDL 7 (Android 12) unified data models and moved many enums to XSD/strings. XML list separators changed to spaces — old XML can fail VTS.

### AIDL (Android 14 introduce, **15 = this course**)

- Core HAL: `IModule`, `IStreamOut`, `IStreamIn`, `ITelephony`, `IBluetooth`, `IConfig`, `ISoundDose`
- Stream I/O: `StreamDescriptor` FMQ + `Command.burst` (Module 26)
- **APM obtains topology from the HAL**
- Effects and common types also AIDL
- Service name: `vendor.audio-hal-aidl`
- New HAL APIs after 14 are **AIDL-only**
- Some 15 devices still ship HIDL — name that as a deviation

**Rule:** detect the running HAL. This course then assumes AIDL unless you said otherwise.

**Android 16 note:** full Configurable Audio Policy over AIDL. Do not use those AIDL CAP types as if they exist on a 15 vendor interface.

## Policy configuration evolution

| Era | Topology |
| --- | --- |
| Long-standing | `audio_policy_configuration.xml` + includes |
| Configurable engine | Strategies/volumes as data (engineconfigurable) |
| AIDL | Config objects from HAL; CAP structure expressed in AIDL |

AAOS still needs `car_audio_configuration.xml` on top unless a product moves volume/routing fully to CAP flags.

## AAOS timeline (public docs)

| Android | Car audio |
| --- | --- |
| 10 | `car_audio_configuration.xml` replaces `car_volumes_groups.xml` and `IAudioControl.getBusForContext` |
| 11 | `audioZoneId`, `occupantZoneId`; AudioControl 2.0 HAL focus; delayable focus; nav-during-call setting; system usages |
| 14 | Config v3: OEM contexts, non-primary multi `zoneConfig`, OEM plugin focus, CAP hooks (`audioUseCoreVolume` / `audioUseCoreRouting`) |
| 15 | Config v4: `car_audio_fade_configuration.xml` + `applyFadeConfigs` (system-enforced fade, `audioUseFadeManagerConfiguration`) and `activationVolumeConfigs` (min/max activation volume, `audioUseMinMaxActivationVolume`) |

Forward compatibility: old XML may run on new AAOS until you use new tags. Using new tags on an old version throws at `car_service` start.

AudioControl HAL has its own HIDL→AIDL migration (documented around Android 12 for that HAL). Independent of Core Audio HAL generation.

## Client API timeline (ideas)

| Idea | Notes |
| --- | --- |
| `STREAM_*` | Legacy; still mapped |
| `AudioAttributes` | Modern key; prefer this |
| OpenSL ES | NDK legacy |
| AAudio | Preferred low-latency NDK |
| MMAP / exclusive | Lowest latency; HAL support required |
| Offload | Compressed to DSP; still a Flinger thread type |

## Process timeline

`audioserver` split from `mediaserver` around Android 7 so mixer crashes do not kill all media. Pre-7 dumps and crash stories look different.

## What stays valid across versions

You can always teach:

- Last-known-good layering
- Policy vs Flinger roles
- Attributes as meaning
- Focus ≠ routing
- PCM period math
- DAI vs DMA
- AAOS zone/group/context/address (from 10 onward)

You cannot always teach:

- A specific HIDL method name
- Where XML lives vs AIDL `IConfig`
- Whether fade enforcement exists
- Whether OEM contexts exist
- Qualcomm PAL vs mixer_paths

## How to classify a mystery device in 5 minutes

```bash
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.build.fingerprint
adb shell pm has android.hardware.type.automotive   # idea; or check features
adb shell lshal | grep android.hardware.audio
adb shell dumpsys media.audio_flinger | head
adb shell ls vendor/etc/car_audio_configuration.xml
adb shell ls vendor/etc/audio_policy_configuration.xml
```

Write a one-liner:

> Android 13 AAOS, HIDL 7.1 Core HAL, car XML v2, Qualcomm PAL unknown — treat as HIDL+dynamic mixes, no fade manager.

That one-liner prevents a week of wrong API names.

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| “Android 14 means AIDL audio” | Encouraged, not guaranteed |
| Copying v6 XML onto v7 HAL | Schema/separators changed |
| Using v4 fade tags on v2 parser | Startup exception |
| Citing AudioControl as Core HAL | Different HAL |
| Applying phone focus articles to AAOS concurrent matrix | Different product physics |

## Practice

Fill the classification line for:

1. Android 11 Qualcomm AAOS car, `lshal` shows `audio@6.0`.
2. Android 15 emulator, AIDL `IModule`, `car_audio_configuration.xml` version 4.
3. Android 14 phone, HIDL 7.1, no car XML.

Expected:

1. HIDL 6.0; car features up to 11 (zones ids, HAL focus); no OEM contexts/fade; vendor QC stack likely mixer_paths/ACDB or early PAL — ask BSP.
2. AIDL Core HAL; fade possible; treat AIDL config path as relevant.
3. No CarAudioService routing; phone Policy; HIDL 7.1 XML contract.

## Key Takeaways

1. Roles are stable; contracts are not.
2. Android version ≠ HAL generation ≠ car XML version.
3. Detect; do not assume.
4. Old car XML can run; new tags cannot run on old parsers.
5. State your classification before you name an API.

## Next

[Module 24 — From Junior to Architect](24-from-junior-to-architect.md)
