# Android / AAOS Audio Engineering Course

A teaching curriculum for becoming an independent **AOSP / AAOS audio engineer**.

**Read it online:** https://androidaudio.vercel.app/ — the same modules, rendered with interactive diagrams, a debugging workbench and a lifecycle studio.

> **Version note:** the course currently targets **Android 15** (AOSP `android15-release`, AIDL audio HAL, AAOS car audio config v4). Features that only exist in Android 16 or later are labelled as such.

**Reference platform for every module:** **Android 15+** with an **AIDL Audio HAL** (`android.hardware.audio.core`) and, for automotive examples, **AAOS 15** with `car_audio_configuration.xml` **version 4** plus optional fade configuration. HIDL and older car XML versions are history, not the default. See [REFERENCE_PLATFORM.md](REFERENCE_PLATFORM.md).

This is not a dump of facts. Each module trains the same professional habit:

```text
WHO owns this behavior?
WHERE does the state change?
WHEN does the failure occur?
WHAT evidence proves it?
WHY did the state change?
HOW can we reproduce and validate it?
```

You will learn to think in layers, trace control and data paths, read source, collect the *right* evidence, and separate **symptom** from **root cause**.

---

## Who this is for

A junior or mid-level Android engineer who is actively building expertise in:

- AOSP audio framework
- AudioFlinger and AudioPolicy
- Audio HAL (**AIDL Core HAL** on Android 15+; HIDL only as history)
- ALSA / ASoC / I2S / TDM / DMA
- AAOS Car Audio (zones, volume groups, dynamic routing)
- Qualcomm / DSP debugging (vendor-specific, clearly labeled)
- Systematic audio debugging on real devices

---

## How the course is organized

| Phase | Goal | Modules |
| --- | --- | --- |
| 0. How to learn | Study method, evidence rules, version awareness | [00](modules/00-how-to-use-this-course.md) |
| 0b. Sound as numbers | Sample vs frame, rate, period, packing, PCM vs offload | [00b](modules/00b-digital-audio-fundamentals.md) |
| 1. Mental models | Think in layers; never debug only the symptom layer | [01](modules/01-think-in-layers.md) |
| 2. Architecture | End-to-end Android and AAOS audio maps | [02](modules/02-end-to-end-android-audio-architecture.md), [02A](modules/02a-playback-walkthrough.md), [03](modules/03-audio-policy-vs-audioflinger.md) |
| 3. App and policy meaning | Tracks, attributes, usage, focus | [04](modules/04-audiotrack-audiorecord-media-apis.md), [05](modules/05-audio-attributes-usage-and-focus.md) |
| 4. Framework engines | AudioFlinger mixing, AudioPolicy routing | [06](modules/06-audioflinger-internals.md), [07](modules/07-audiopolicy-routing-and-devices.md) |
| 5. HAL boundary | AIDL Core HAL (HIDL as history) | [08](modules/08-audio-hal-legacy-hidl-aidl.md) |
| 5b. AIDL deep dive | StreamDescriptor, IModule, IConfig | [26](modules/26-android15-aidl-reference.md) |
| 6. Kernel and hardware | ALSA, ASoC, clocks, codec, amplifier | [09](modules/09-alsa-tinyalsa-and-pcm.md), [10](modules/10-asoc-dai-dma-i2s-tdm.md), [11](modules/11-codec-amplifier-and-hardware-path.md) |
| 7. Automotive | Car Audio Service, zones, volume, multi-zone | [12](modules/12-aaos-car-audio-architecture.md), [13](modules/13-aaos-zones-volume-groups-and-routing.md) |
| 8. Runtime behavior | Concurrency, latency, XRUNs | [14](modules/14-concurrency-mixing-and-ducking.md), [15](modules/15-latency-buffering-and-xruns.md) |
| 9. Vendor and peripherals | Qualcomm DSP, BT / USB / HDMI, power | [16](modules/16-qualcomm-audio-and-dsp.md), [17](modules/17-bluetooth-usb-hdmi.md), [18](modules/18-power-suspend-resume.md) |
| 10. Professional practice | Debug method, logs, RCA, source map | [19](modules/19-debugging-methodology.md), [20](modules/20-logs-dumps-and-traces.md), [21](modules/21-root-cause-analysis-and-case-studies.md), [22](modules/22-source-code-navigation.md) |
| 11. Growth | Version evolution, career path, glossary | [23](modules/23-android-version-evolution.md), [24](modules/24-from-junior-to-architect.md), [25](modules/25-glossary-and-comparisons.md) |
| 12. Lab | Capture dumps; annotate Android 15 cases | [labs/](labs/README.md), [workbook/](workbook/README.md) |

**Interactive portal:** https://androidaudio.vercel.app/ · source and local setup in [portal/README.md](portal/README.md) (`cd portal && npm install && npm run dev`)

Start at [modules/00-how-to-use-this-course.md](modules/00-how-to-use-this-course.md).

A compact recommended order is in [LEARNING_PATH.md](LEARNING_PATH.md).

---

## The architecture this course uses

The following diagram is a **corrected teaching model**. It is more accurate than the common “one straight pipe” drawing.

```text
Application
    |
    v
AudioTrack / AudioRecord / MediaPlayer / ExoPlayer / AAudio / OpenSL ES
    |
    v
Java framework  (AudioManager, AudioService, AudioAttributes)
    |
    v
Native client   (libaudioclient: AudioTrack.cpp / AudioRecord.cpp)
    |
    +---------------------------+
    |                           |
    v                           v
AudioPolicyService         AudioFlinger
(decision: device,          (execution: mix, clock,
 strategy, volume)           threads, HAL I/O)

  The native client calls AudioFlinger (createTrack); AudioFlinger asks
  AudioPolicyService (getOutputForAttr). Focus never reaches either: it lives
  in AudioService (MediaFocusControl) and, on AAOS, CarAudioFocus.
    |                           |
    +-------------+-------------+
                  |
                  v
            AIDL Audio HAL
      IModule / IConfig / IStream*
      StreamDescriptor (FMQ + commands)
                  |
                  v
     Vendor audio layer (optional)
     (Qualcomm PAL / AudioReach / other)
                  |
                  v
         TinyALSA / ALSA PCM
                  |
                  v
              ASoC
     (FE PCM, BE DAI, machine, codec, platform/DMA)
                  |
          +-------+--------+
          |                |
         DMA              DAI
      (data mover)   (digital interface)
          |                |
          +-------+--------+
                  |
                  v
            I2S / TDM / SLIMbus / SoundWire
                  |
                  v
        DSP (SoC ADSP and/or codec DSP)
                  |
                  v
                Codec
                  |
                  v
             Amplifier
                  |
                  v
         Speaker / Headset / Line-out
```

For **Android Automotive (AAOS)** an extra policy layer sits above Core Audio:

```text
AudioAttributes / Usage
        |
        v
  CarAudioService
        |
        v
  Audio zone + volume group + context-to-bus map
        |
        v
  Dynamic Audio Policy mixes
        |
        v
  AudioPolicy + AudioFlinger
        |
        v
  AIDL Audio HAL (IModule + StreamDescriptor) + hardware path
```

On Android 15+, Audio Policy Manager **gets its topology from the AIDL HAL** (`IModule.getAudioPorts` / `getAudioRoutes`, `IConfig`) — queried by AudioFlinger's libaudiohal and handed to APM — instead of treating a vendor XML file as the only contract. A default HAL may still *implement* `IConfig` by converting leftover XML internally. You debug the **AIDL objects**, not the file, unless you are looking at that converter.

---

## Rules this course never breaks

1. **Symptom is not root cause.** “No sound” is an observation, not a diagnosis.
2. **Name the owning layer.** Every behavior has an owner.
3. **This course’s default contract is Android 15 + AIDL.** HIDL method names are historical. New HAL APIs after Android 14 exist **only** on AIDL.
4. **Generic AOSP is not Qualcomm.** Vendor components are labeled as vendor-specific.
5. **Do not invent APIs, mixer names, PCM devices, or DSP modules.** If a name is platform-specific, the module says so.
6. **Evidence before fix.** A patch without a last-known-good layer is a guess.

---

## Official references

These are the primary public sources used while writing the modules:

- [Android audio architecture](https://source.android.com/docs/core/audio)
- [Audio HAL](https://source.android.com/docs/core/audio/implement)
- [AIDL Audio HAL](https://source.android.com/docs/core/audio/aidl-implement)
- [AIDL vs HIDL comparison](https://source.android.com/docs/core/audio/aidl-hidl-comp)
- [HIDL Audio HAL (history)](https://source.android.com/docs/core/audio/hidl-implement)
- [Audio debugging](https://source.android.com/docs/core/audio/debugging)
- [Car audio configuration](https://source.android.com/docs/automotive/audio/audio-policy-configuration)
- [AAOS audio focus](https://source.android.com/docs/automotive/audio/audio-focus)
- [Multi-zone audio routing](https://source.android.com/docs/automotive/audio/audio-multizone-routing)
- [Configurable audio policy engine](https://source.android.com/docs/automotive/audio/configurable-audio-policy-engine)

AOSP paths move between releases. The course is pinned to the tag `android-15.0.0_r36`: check paths and line numbers there ([frameworks/av at that tag](https://android.googlesource.com/platform/frameworks/av/+/refs/tags/android-15.0.0_r36/)). cs.android.com defaults to a newer branch, so select an Android 15 tag before comparing line numbers.

---

## Suggested weekly rhythm

| Day | Activity |
| --- | --- |
| 1 | Read one module slowly. Draw the layer diagram from memory. |
| 2 | Open the named AOSP files and walk the call path. |
| 3 | On a device or emulator, collect the dumps that module names. |
| 4 | Answer the practice questions without looking. |
| 5 | Take a real or synthetic bug and apply the decision tree. |

Do not binge-read. Audio expertise is built by correlating source with runtime dumps.

---

## Repository layout

| Path | What it is |
| --- | --- |
| `modules/` | The course text (one Markdown file per module). **Edit here.** |
| `workbook/` | Dump-reading cases 01–08 and the answer key (teaching reconstructions). |
| `labs/` | `capture_audio_lab.sh` for collecting your own dumps. |
| `portal/` | The website (Vite, vanilla JS). `portal/public/curriculum/` is a generated copy of `modules/` + `workbook/` — run `npm run sync` in `portal/` after editing. |

## Found an error?

Open an issue: https://github.com/developer-swetabh/AndroidAudioProf/issues/new?title=Erratum: — please include the module number, the sentence, and a link to the AOSP source or documentation that shows the correct behaviour.

## License

[MIT](LICENSE) © 2026 Swetabh Suman.
