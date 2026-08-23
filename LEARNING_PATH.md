# Learning Path

Use this file as the syllabus. Each row is a study unit. Do not skip the “prove it” column.

Default world: **Android 15 + AIDL Core HAL + AAOS car XML v4**. See [REFERENCE_PLATFORM.md](REFERENCE_PLATFORM.md).

## Foundation track (required)

| Order | Module | You should be able to | Prove it |
| --- | --- | --- | --- |
| 0 | [How to use this course](modules/00-how-to-use-this-course.md) | State the evidence rules and version rule | Write the six questions (WHO/WHERE/WHEN/WHAT/WHY/HOW) from memory |
| 0b | [Sound as numbers](modules/00b-digital-audio-fundamentals.md) | Convert frames to milliseconds; separate sample, frame, period, packing, PCM vs offload | 48 kHz · 2 ch · S16 · 240 × 4 → 5 ms period, 20 ms buffer, 4-byte frame. Contrast `S24_LE` vs `S24_3LE` |
| 1 | [Think in layers](modules/01-think-in-layers.md) | Place any symptom on a layer and name the next check | Take “no audio” and write a 10-step decision tree |
| 2 | [End-to-end architecture](modules/02-end-to-end-android-audio-architecture.md) | Draw control path vs data path | Mark where AudioPolicy and AudioFlinger sit relative to each other |
| 2A | [Playback walkthrough](modules/02a-playback-walkthrough.md) | Trace one playback from `AudioTrack.play()` to speaker | Name every hop, buffer, and clock domain from app to DAC |
| 3 | [AudioPolicy vs AudioFlinger](modules/03-audio-policy-vs-audioflinger.md) | Explain who decides vs who executes | From a dumpsys pair, say which service owns each field |
| 4 | [AudioTrack / AudioRecord / Media](modules/04-audiotrack-audiorecord-media-apis.md) | Trace app playback to a track in AudioFlinger | Create a track and find it in `dumpsys media.audio_flinger` |
| 5 | [Attributes, usage, focus](modules/05-audio-attributes-usage-and-focus.md) | Separate meaning, routing key, and arbitration | Explain why usage is not a device |

## Framework track

| Order | Module | You should be able to | Prove it |
| --- | --- | --- | --- |
| 6 | [AudioFlinger internals](modules/06-audioflinger-internals.md) | Name thread types and track states | Map a track to Mixer / Fast / Direct / Offload |
| 7 | [AudioPolicy routing](modules/07-audiopolicy-routing-and-devices.md) | Explain strategy, device, patch, mix | Predict the output for MEDIA + speaker + BT connected |
| 8 | [Audio HAL](modules/08-audio-hal-legacy-hidl-aidl.md) | State which HAL generation a platform uses | Identify HAL type from device files and dumps |

## Kernel and hardware track

| Order | Module | You should be able to | Prove it |
| --- | --- | --- | --- |
| 9 | [ALSA / TinyALSA / PCM](modules/09-alsa-tinyalsa-and-pcm.md) | Explain period, buffer, trigger, XRUN | Read `cat /proc/asound/pcm` and interpret one device |
| 10 | [ASoC, DAI, DMA, I2S, TDM](modules/10-asoc-dai-dma-i2s-tdm.md) | Separate FE, BE, DAI, and clock owner | Draw FE→BE for one playback path |
| 11 | [Codec, amplifier, analog path](modules/11-codec-amplifier-and-hardware-path.md) | Trace digital samples to a speaker | List mute points from DSP to amp enable |

## Automotive track

| Order | Module | You should be able to | Prove it |
| --- | --- | --- | --- |
| 12 | [AAOS Car Audio architecture](modules/12-aaos-car-audio-architecture.md) | Explain what CarAudioService adds on top of phone Android | Contrast phone routing vs car routing |
| 13 | [Zones, volume groups, buses](modules/13-aaos-zones-volume-groups-and-routing.md) | Read `car_audio_configuration.xml` and predict runtime mixes | Map NAVIGATION to a bus and a volume group |
| 14 | [Concurrency, mixing, ducking](modules/14-concurrency-mixing-and-ducking.md) | Separate focus, mix, duck, fade, and hardware mix | Trace nav + media through all five |
| 15 | [Latency, buffering, XRUNs](modules/15-latency-buffering-and-xruns.md) | Compute a buffer in milliseconds and name the jitter source | Diagnose one underrun from period vs write rate |

## Vendor, peripherals, power

| Order | Module | You should be able to | Prove it |
| --- | --- | --- | --- |
| 16 | [Qualcomm audio and DSP](modules/16-qualcomm-audio-and-dsp.md) | Distinguish AOSP from PAL / ACDB / ADSP | Write a Qualcomm-only hypothesis and an AOSP-only one |
| 17 | [Bluetooth, USB, HDMI](modules/17-bluetooth-usb-hdmi.md) | Explain why these paths leave the SoC codec | Name the extra service each path adds |
| 18 | [Power, suspend, resume](modules/18-power-suspend-resume.md) | Predict clock/regulator/DSP collapse | Explain a “works until sleep” bug by layer |

## Professional practice

| Order | Module | You should be able to | Prove it |
| --- | --- | --- | --- |
| 19 | [Debugging methodology](modules/19-debugging-methodology.md) | Run the 8-step method without skipping to a patch | Apply it to a provided “no audio” case |
| 20 | [Logs, dumps, traces](modules/20-logs-dumps-and-traces.md) | Read a dump instead of collecting it blindly | Annotate a fictional AudioFlinger dump |
| 21 | [RCA and case studies](modules/21-root-cause-analysis-and-case-studies.md) | Write symptom ≠ immediate failure ≠ root cause | Complete three case write-ups |
| 22 | [Source code navigation](modules/22-source-code-navigation.md) | Find the next function from any API call | Trace `AudioTrack.play()` to AIDL `StreamDescriptor.Command.burst` |
| 23 | [Android version evolution](modules/23-android-version-evolution.md) | Translate older trees back to the 15/AIDL default | Explain one HIDL name → AIDL name without mixing eras |
| 24 | [Junior to architect](modules/24-from-junior-to-architect.md) | Assess your current level honestly | Pick the next skill gate |
| 25 | [Glossary and comparisons](modules/25-glossary-and-comparisons.md) | Explain confused pairs in one sentence each | Fill the comparison tables from memory |
| 26 | [Android 15 AIDL reference](modules/26-android15-aidl-reference.md) | Name IModule, IConfig, StreamDescriptor states and burst | Draw the FMQ command/reply/audio path |
| Lab | [Capture script](labs/README.md) | Collect the minimum dump set on a 15/AIDL device | Run `labs/capture_audio_lab.sh` during playback |
| Workbook | [Dump annotation](workbook/README.md) | Find last-known-good from a dump pair | Complete cases 01–05 before reading the answer key |

---

## Minimum lab kit

You do not need a car or a Qualcomm SoC to start.

| Resource | Why |
| --- | --- |
| AOSP checkout or [cs.android.com](https://cs.android.com) | Source-level reading |
| Emulator or any Android device | `dumpsys media.audio_flinger` / `audio_policy` |
| `adb` | Logs and dumps |
| Optional: AAOS emulator | Zones and `dumpsys car_service` |
| Optional: real board with ALSA | `tinyplay`, mixer, `/proc/asound` |

Prefer an **Android 15** image (phone or AAOS emulator). Confirm AIDL with `service list | grep audio.core` or the Flinger HAL line before you treat dumps as this course’s reference.

If you only have an emulator, you can still complete modules 00–08, 12–15, 19–26, the lab capture, and the workbook. Hardware modules 09–11 and 16–18 need a real path or honest “I cannot verify this on this device” notes.

---

## After you finish a module

Write four lines in a notebook:

```text
Concept I can now explain:
Layer that owns it:
Dump or log that proves it:
Question I still cannot answer:
```

The last line is the most important. Bring those questions back to the architecture, not to random blog posts.
