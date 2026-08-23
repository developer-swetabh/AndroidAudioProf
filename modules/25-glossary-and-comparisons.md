# Module 25 — Glossary and Comparisons

## Short Answer

This is the pocket reference. If two terms blur in a meeting, open the comparison table, say one sentence each, and go back to evidence.

Definitions use the course’s three-level habit only where a single sentence would lie.

---

## Comparison tables (confused pairs)

### AudioPolicy vs AudioFlinger

| | AudioPolicy | AudioFlinger |
| --- | --- | --- |
| Role | Decide | Execute |
| Time | Events | Periods |
| Dump | `media.audio_policy` | `media.audio_flinger` |
| Failure | Wrong device | Glitch, stuck standby, empty mix |

### AudioTrack vs MediaPlayer

| | AudioTrack | MediaPlayer |
| --- | --- | --- |
| Input | PCM (or offload frames you feed) | File/URL |
| Control | Sample-accurate write | Prepare/start |
| Ends in | Flinger track | Decoder + track |

### Audio HAL vs ALSA

| | HAL | ALSA |
| --- | --- | --- |
| Audience | Android framework | Kernel PCM ABI |
| Objects | Devices, streams, flags | cards, PCMs, kcontrols |
| IPC | Binder HIDL/AIDL | ioctl |

### ALSA vs ASoC

| | ALSA | ASoC |
| --- | --- | --- |
| What | PCM core + mixer ABI | SoC wiring framework on top |
| You debug | state, hw_params, XRUN | DAI links, DAPM, machine |

### PCM device vs DAI

| | PCM (FE) | DAI (often BE) |
| --- | --- | --- |
| What | The device Android/TinyALSA opens | Serial interface + clocks |
| Example | `hw:0,7` MultiMedia1 | I2S0 / TDM1 |
| Fail | open EINVAL, XRUN | no BCLK, slot shift |

### FE vs BE

| | Front-end | Back-end |
| --- | --- | --- |
| Near | Userspace PCM | Pins / codec / amp |
| DPCM | Many FEs | Many BEs |
| Bind | At use-case start | At use-case start |

### I2S vs TDM

| | I2S | TDM |
| --- | --- | --- |
| Slots | Typically 2 | N |
| Failures | Format/polarity | Slot mask/width/FSYNC |

### Usage vs AudioAttributes

| | Usage | Attributes |
| --- | --- | --- |
| What | Why (one field) | Why + what + flags + tags |
| AAOS | Maps to context | Full match key |

### Audio zone vs occupant zone

| | Audio zone | Occupant zone |
| --- | --- | --- |
| What | Independent audio universe | Seat + displays + user |
| Owner | CarAudioService | CarOccupantZoneManager |
| Link | `audioZoneId` ↔ `occupantZoneId` | one-to-one when used |

### Audio focus vs routing

| | Focus | Routing |
| --- | --- | --- |
| Question | Who may be prominent? | Where do bits go? |
| AAOS | Per-zone matrix | Context → bus mix |

### MixerThread vs FastMixer

| | MixerThread | FastMixer |
| --- | --- | --- |
| Period | Larger | Smaller |
| Effects | More | Restricted |
| Logging | Normal | NBLOG preferred |

### Buffer vs period

| | Period | Buffer |
| --- | --- | --- |
| Meaning | Wake/IRQ quantum | Jitter tank |
| Math | `frames/rate` | `period × count` |

### Framework routing vs DSP routing

| | Framework | DSP (vendor) |
| --- | --- | --- |
| Objects | devices, mixes, buses | graphs, AFE, backends |
| File | policy / car XML | ACDB / PAL / mixer_paths |

### Standby vs suspend

| | Standby | Suspend |
| --- | --- | --- |
| Owner | Flinger/HAL per output | Whole AP / vehicle |
| Typical tear-down | PCM/graph/amp | Rails, FW, drivers |

### Core Audio HAL vs AudioControl HAL

| | Core | AudioControl |
| --- | --- | --- |
| Plays PCM? | Yes | No |
| Used on phones? | Yes | Rarely |
| AAOS extras | Buses as devices | HAL focus, gain hooks |

### HIDL vs AIDL Audio HAL

| | HIDL (history) | AIDL (**this course**) |
| --- | --- | --- |
| Typical | Android 8–13 | **Android 15+** (introduced 14) |
| Config | XML + XSD as APM input | `IModule` / `IConfig` APIs |
| Entry | `IDevicesFactory` + `IDevice` | `IModule` registered with ServiceManager |
| I/O | `IStreamOut.write` | `StreamDescriptor.Command.burst` |
| Primary extras | `IPrimaryDevice` | `ITelephony` + `IBluetooth` |

---

## Glossary (one-line, then the catch)

**AIDL Audio HAL** — `android.hardware.audio.core` on Android 15+. Catch: not HIDL `@7.1`.

**IConfig** — AIDL object for system-wide engine/surround config. Catch: may convert leftover XML internally.

**IModule** — AIDL Core HAL entry (replaces HIDL `IDevice`). Instances: `default`, `bluetooth`, `r_submix`.

**StreamDescriptor** — FMQ command/reply/audio plus the HAL stream state machine.

**burst** — AIDL I/O command. Catch: not HIDL `write()`; HAL must drain the whole audio FMQ.

**AAudio** — NDK low-latency API. Catch: still Policy + Flinger/MMAP, not a second OS.

**ACDB** — Qualcomm calibration/graph database. Catch: not AOSP.

**ADSP** — Qualcomm audio DSP. Catch: own power domain; SSR mutes everything.

**AFE** — Vendor “audio front end” port toward the codec/DAI. Catch: name/IDs are vendor.

**AudioAttributes** — Meaning of a stream (usage, content type, flags, tags).

**AudioControl** — AAOS HAL for focus/gain hooks. Catch: no PCM.

**AudioFlinger** — Native mixer/IO server in `audioserver`.

**AudioPolicy** — Native decision engine in `audioserver`.

**AudioService** — Java service in `system_server` for focus/volume/devices (phone-centric).

**audioserver** — Process hosting Flinger + Policy (modern Android).

**Bus device** — `AUDIO_DEVICE_OUT_BUS` + address; AAOS cable name.

**CarAudioContext** — Group of usages for car routing/focus/volume.

**CarAudioService** — AAOS orchestrator of mixes, zones, focus, groups.

**Content type** — Payload kind (speech/music/…). Catch: rarely selects the bus.

**DAPM** — ASoC widget power graph.

**Deep buffer** — Large-period output for media/power.

**Direct output** — Exclusive, no software mix (HDMI/passthrough).

**DPCM** — Dynamic binding of FE PCM to BE DAI.

**Duck** — Temporary attenuation of a less-important stream.

**Dynamic mix** — Runtime AudioPolicy mix; AAOS routing mechanism.

**Fade (AAOS 15)** — Framework VolumeShaper enforcement on focus loss.

**FastMixer** — Low-period mix thread.

**Fixed volume** — Android sends index; HAL/amp apply gain; PCM unscaled.

**Focus** — Prominence protocol. Catch: historically cooperative.

**hw_params** — ALSA hardware contract (rate, format, periods…).

**MMAP** — Shared-memory low-latency path (AAudio exclusive, if HAL supports).

**Occupant zone** — User/seat/display grouping.

**Offload** — Compressed decode on DSP; OffloadThread.

**PAL** — Qualcomm Platform Abstraction Layer. Catch: vendor.

**Patch** — Live Policy connection between ports.

**Period** — One IRQ/write quantum.

**PCM** — Pulse code modulation **or** the ALSA device. Say which.

**Profile (policy)** — Declared formats/rates/channels of a port.

**Session** — Groups a track with effects; join key to dumps.

**Standby** — Flinger/HAL idle power-down of an output.

**Strategy** — Default-engine grouping of usages (MEDIA, PHONE, …).

**sw_params** — ALSA ring behavior (start threshold…).

**Tee sink** — Debug capture of Flinger PCM (non-production).

**TinyALSA** — Android userspace ALSA library.

**TDM** — Multi-slot serial audio.

**Usage** — Why the app plays; primary routing/focus key.

**Volume group** — AAOS set of devices sharing one knob.

**XRUN** — ALSA underrun/overrun; ring empty/full at the wrong time.

**Zone config** — One hardware layout for a zone (headrest vs headphones).

---

## The six questions (reprint)

```text
WHO owns this behavior?
WHERE does the state change?
WHEN does the failure occur?
WHAT evidence proves it?
WHY did the state change?
HOW can we reproduce and validate it?
```

## The five RCA lines (reprint)

```text
Symptom:
Immediate failure:
Root cause:
Contributing factor:
Fix:
```

## The no-audio spine (reprint)

```text
App create → track ACTIVE → correct device/bus
  → counters + volume → HAL open → PCM RUNNING + pointer
  → DSP graph (if any) → analog unmute → voltage at the load
```

## Official references

- https://source.android.com/docs/core/audio
- https://source.android.com/docs/core/audio/implement
- https://source.android.com/docs/core/audio/hidl-implement
- https://source.android.com/docs/core/audio/aidl-implement
- https://source.android.com/docs/core/audio/debugging
- https://source.android.com/docs/automotive/audio/audio-policy-configuration
- https://source.android.com/docs/automotive/audio/audio-focus
- https://source.android.com/docs/automotive/audio/audio-multizone-routing

## Closing

You now have a map. Expertise starts the first time you take a real dump and refuse to guess.

Return to [Module 00](00-how-to-use-this-course.md) if you feel lost, or to [Module 19](19-debugging-methodology.md) when a bug arrives.

AIDL pocket card: [Module 26](26-android15-aidl-reference.md). Lab: [../labs/README.md](../labs/README.md). Workbook: [../workbook/README.md](../workbook/README.md).

Course index: [../README.md](../README.md)
