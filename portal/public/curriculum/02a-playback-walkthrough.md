# Module 02A — End-to-End Playback Walkthrough

## Short Answer

This module traces **one playback request** from `AudioTrack.play()` to electrical energy at a speaker. You will learn what happens at **every hop**: which process runs, which buffer owns the samples, which clock drives the transfer, and where each category of failure lives.

If you can narrate this walkthrough from memory and point to the boundary where a bug lives, you have the core skill of an audio engineer.

## Mental Model

Imagine mailing a letter through 11 post offices, each in a different country with its own language, schedule, and customs agent:

```text
Java app                    "I wrote a letter"
   ↓ JNI
Native client               "I stamped and sealed it"
   ↓ Binder IPC
AudioFlinger                "I sorted it with other mail"
   ↓ AIDL FMQ
Audio HAL                   "I loaded it onto the truck"
   ↓ ioctl
Kernel PCM                  "I moved it by conveyor belt"
   ↓ DMA
DAI serializer              "I put it on the wire"
   ↓ I2S/TDM
Codec DAC                   "I translated it to voltage"
   ↓ analog
Amplifier                   "I made it loud enough"
   ↓ current
Speaker                     "I moved air"
```

A letter lost at customs (HAL) looks the same to the sender (app) as a letter lost in the mail room (Flinger) or stolen by the delivery truck (DMA). **You must check each post office.**

## The Complete Playback Journey

### Overview map

```text
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: Java AudioTrack.play()                                    │
│  Process: app          Language: Java         Clock: none yet       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ JNI call
┌──────────────────────────────▼──────────────────────────────────────┐
│  STEP 2: Native AudioTrack::start()                                │
│  Process: app          Language: C++          Clock: none yet       │
│  Buffer: client-side shared memory (AudioTrackClientProxy)         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Binder IPC (IAudioTrack)
┌──────────────────────────────▼──────────────────────────────────────┐
│  STEP 3–5: AudioFlinger (audioserver process)                      │
│  Process: audioserver  Language: C++          Clock: mixer period   │
│  Buffer: server-side shared memory (AudioTrackServerProxy)         │
│  + mixer output buffer                                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ AIDL FMQ (StreamDescriptor)
┌──────────────────────────────▼──────────────────────────────────────┐
│  STEP 6–7: Audio HAL (vendor process or same audioserver)          │
│  Process: vendor HAL   Language: C++          Clock: HAL thread     │
│  Buffer: audio.fmq ring → vendor internal                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ ioctl (ALSA)
┌──────────────────────────────▼──────────────────────────────────────┐
│  STEP 8: Kernel PCM / ALSA ring buffer                             │
│  Process: kernel       Language: C            Clock: DMA/IRQ       │
│  Buffer: DMA ring buffer (period × count)                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ DMA engine
┌──────────────────────────────▼──────────────────────────────────────┐
│  STEP 9–11: ASoC → DAI → Codec → Amp → Speaker                    │
│  Process: hardware     Language: registers    Clock: BCLK/MCLK     │
│  Buffer: FIFO/shift register                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Boundary types (memorize these)

| Boundary | Type | Cost | Failure signature |
| --- | --- | --- | --- |
| Java → native | JNI call | ~microseconds | Exception / init error |
| App → audioserver | Binder IPC | ~100 µs–1 ms | `DEAD_OBJECT`, permission denial |
| AudioFlinger → HAL | AIDL FMQ | ~microseconds (FMQ is zero-copy) | Stream `ERROR`, open failure |
| HAL → kernel | `ioctl` / `pcm_write` | Blocking up to period_ms | `EPIPE`, `EINVAL`, stall |
| Kernel → hardware | DMA + clocks | Hardware | `hw_ptr` stuck, no BCLK |

---

## Step 1 — Java: AudioTrack construction and play()

### What happens

```java
AudioTrack track = new AudioTrack.Builder()
    .setAudioAttributes(new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build())
    .setAudioFormat(new AudioFormat.Builder()
        .setSampleRate(48000)
        .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .build())
    .setBufferSizeInBytes(4 * 960)  // e.g., 4 periods of 960 frames × 2ch × 2 bytes
    .setTransferMode(AudioTrack.MODE_STREAM)
    .build();

track.play();
```

### What actually runs

1. **`AudioTrack.Builder.build()`** calls `AudioTrack` constructor.
2. Constructor calls `native_setup()` via JNI → `android_media_AudioTrack_setup()`.
3. This creates a **native `AudioTrack`** object in the app's process.
4. The native constructor calls `AudioFlinger::createTrack()` over **Binder**.
5. That Binder call is where **Policy is consulted** (`getOutputForAttr`), an output is selected, and shared memory is allocated.
6. **`play()`** calls `native_start()` → `AudioTrack::start()`.

### What you own at this point

- The `AudioAttributes` (usage, content type, flags)
- The `AudioFormat` (rate, channels, encoding)
- The buffer size
- The transfer mode (stream vs static vs callback)
- The session ID (auto-generated or explicit)

### What can fail here

| Failure | Evidence | Layer |
| --- | --- | --- |
| `IllegalArgumentException` | Invalid format/rate/channels | App API |
| `UnsupportedOperationException` | Feature not available | Framework |
| State = `STATE_UNINITIALIZED` | `native_setup` failed → likely Policy rejected the format/flags or AudioFlinger createTrack failed | Framework/Policy |
| `play()` in wrong state | Called without initializing | App bug |

### Key insight

**Construction is already a routing event.** The output device is often chosen at `createTrack`, not at `play()`. If you create with `USAGE_MEDIA`, you may already be bound to the media bus before `play()` is called.

---

## Step 2 — Native Client: AudioTrack::start()

### What happens

```text
AudioTrack::start()                           [app process, native]
    → mProxy->start()                         [client proxy on shared memory]
    → IAudioTrack::start() via Binder         [IPC to audioserver]
```

### Buffer architecture

At this point, **two shared memory regions** exist:

```text
┌──────────────────────────────────────────┐
│  App process                              │
│  AudioTrackClientProxy                    │
│    writes frames → shared memory ring     │
│    (obtainBuffer / releaseBuffer cycle)   │
└──────────────┬───────────────────────────┘
               │ shared memory (mapped in both processes)
┌──────────────▼───────────────────────────┐
│  audioserver process                      │
│  AudioTrackServerProxy                    │
│    reads frames ← same shared memory      │
│    (the mixer pulls from here)            │
└──────────────────────────────────────────┘
```

The shared memory avoids Binder copies for audio data. The app writes PCM into this ring; AudioFlinger's mixer thread reads from it. **The Binder call is only for control** (start, stop, pause), not for data.

### What can fail here

| Failure | Evidence |
| --- | --- |
| `DEAD_OBJECT` | `audioserver` crashed and was restarted by `init` |
| Start rejected | Track in invalid state |

### Key insight

**Fast tracks** use a different, smaller shared buffer with tighter timing contracts. Normal tracks use larger buffers. The track type was determined at `createTrack` based on flags and Policy's decision.

---

## Step 3 — AudioFlinger: Track activation

### What happens in audioserver

```text
AudioFlinger receives IAudioTrack::start()
    → Track::start()
    → track state → ACTIVE
    → if PlaybackThread was in STANDBY:
        → exit standby
        → open HAL stream (IModule.openOutputStream)
        → HAL returns IStreamOut + StreamDescriptor
    → track added to active mix set
    → mixer thread wakes up
```

### The mixer thread loop (the heartbeat of Android audio)

This is the core execution loop. It runs continuously while tracks are active:

```text
PlaybackThread::threadLoop()
    forever:
        1. prepareTracks_l()
            - check which tracks are ACTIVE
            - check volumes, mutes, effects
            - prepare mixing state

        2. Mix
            - for each ACTIVE track:
                pull frames from server proxy (shared memory)
                apply per-track volume
                apply per-track effects
            - sum into the mix buffer (or memcpy for direct/offload)

        3. Effects
            - run post-mix effects chain (if any)

        4. Write to HAL
            - fill audio.fmq with mixed PCM
            - send Command.burst on command FMQ
            - wait for Reply on reply FMQ

        5. Sleep
            - calculate next deadline
            - sleep until next period

        6. Check for standby
            - if no ACTIVE tracks for timeout → enter standby
```

### Thread types determine timing

| Thread type | Typical period | Behavior |
| --- | --- | --- |
| MixerThread (deep buffer) | ~10–20 ms | Multiple tracks mixed; larger jitter tolerance |
| MixerThread + FastMixer | ~2–5 ms (fast) | FastMixer runs a tight inner loop for low-latency tracks |
| DirectOutputThread | Stream-dependent | Single track, no software mixing |
| OffloadThread | Bursty | Compressed data to DSP |

**If the mixer loop takes longer than one period to complete, XRUNs are mathematically inevitable.** This is the timing contract.

### What can fail here

| Failure | Evidence | Dump field |
| --- | --- | --- |
| Track never ACTIVE | `play()` didn't propagate or focus paused it | Track state in `dumpsys media.audio_flinger` |
| Thread stuck in standby | HAL open failed silently | `standby: yes` while user expects sound |
| Track volume 0 | Focus loss, mute, fade | `vol=0.000` |
| Underrun count climbing | App not writing fast enough | `underrun` counter |
| Frames frozen | Mixer not pulling or app not writing | Dump twice; compare `frames` |

### Key insight

**AudioFlinger does not choose where audio goes.** It mixes into whichever output Policy selected. If audio goes to the wrong speaker, the problem is above Flinger (Policy/CarAudio), not in the mixer loop.

---

## Step 4 — AudioPolicy: The routing decision

### When this happens

Policy is consulted at **track creation** (Step 1), not at play. But the routing decision directly determines which HAL stream Flinger writes to. Understanding this step is essential even though it runs before Step 3.

```text
AudioFlinger::createTrack()
    → AudioPolicyManager::getOutputForAttr(attributes, ...)
        → map attributes to strategy (default engine) or dynamic mix match (AAOS)
        → select device type + address for that strategy
        → find or open an output that matches the profile (rate/channels/format)
        → return output handle
    → AudioFlinger assigns track to the PlaybackThread for that output
```

### Phone vs AAOS routing

**Phone:**
```text
USAGE_MEDIA → strategy MEDIA → device SPEAKER (or A2DP if connected)
```

**AAOS:**
```text
USAGE_MEDIA → CarAudioContext MUSIC → dynamic mix rule →
    force device AUDIO_DEVICE_OUT_BUS address=bus0_media_out
```

### What can fail here

| Failure | Evidence |
| --- | --- |
| `getOutputForAttr` returns error | No profile supports the requested format/rate/channels |
| Wrong device selected | Policy dump shows unexpected device; usually a configuration problem |
| AAOS bus address mismatch | Car XML address doesn't match HAL-declared device port |

---

## Step 5 — AIDL HAL: Opening the stream and burst

### What happens at stream open

```text
AudioFlinger (via libaudiohal)
    → IModule.openOutputStream(
        sourceMetadata,    // usage, tags
        offloadInfo,       // if offload
        AudioConfig {rate, channelMask, format},
        flags,
        mixPortHandle
      )
    → returns:
        IStreamOut         // Binder interface for control
        StreamDescriptor {
            command FMQ    // client writes commands here
            reply FMQ      // HAL writes replies here
            audio FMQ      // PCM samples live here (or mmap buffer)
        }
    → Stream state: STANDBY
```

### What happens on each burst (the AIDL data path)

This is the **Android 15 sentence** for audio I/O:

```text
1. Flinger mixer produces one period of mixed PCM
2. Flinger writes PCM bytes into audio.fmq
3. Flinger writes Command { code=burst, fmqByteCount=N } into command FMQ
4. Flinger blocks on reply FMQ

--- process/thread boundary (HAL runs on a vendor high-priority thread) ---

5. HAL I/O thread wakes on command FMQ
6. HAL reads the Command
7. HAL reads ALL bytes from audio.fmq (even more than it can immediately consume)
8. HAL passes data to its backend (pcm_write, PAL, DSP IPC, etc.)
9. HAL writes Reply {
       status: OK,
       fmqByteCount: bytes actually consumed,
       observable: {frames: cumulative output position},
       latencyMs: current HAL+hardware latency,
       xrunFrames: frames lost since last burst,
       state: ACTIVE
   } into reply FMQ

--- thread wakes ---

10. Flinger reads the Reply
11. Flinger uses observable position for timestamps
12. Flinger sleeps until next period
```

### StreamDescriptor state transitions during playback

```text
STANDBY ──[Command.start]──► IDLE ──[Command.burst]──► ACTIVE
                                                          │
                               ┌──[Command.pause]────────┘
                               ▼
                            PAUSED ──[Command.burst]──► ACTIVE
                               │
                               └──[Command.flush]──► IDLE
                                                          │
ACTIVE ──[Command.drain]──► DRAINING ──[drain complete]──► IDLE
                                                          │
                               ┌──[Command.standby]──────┘
                               ▼
                            STANDBY
                            
Any state ──[unrecoverable error]──► ERROR (only close is valid)
```

### What can fail here

| Failure | Evidence |
| --- | --- |
| `openOutputStream` fails | Format/port not supported by HAL; log shows error |
| Stream stays in `STANDBY` | `Command.start` never sent or failed; Flinger thread still in standby |
| `xrunFrames` climbing | HAL not consuming bursts fast enough; or HAL's backend (pcm_write) is late |
| `state = ERROR` | Unrecoverable HAL failure; only close+reopen recovers |
| `observable.frames` frozen | HAL accepted bursts but data is going nowhere |

### Key insight

**The FMQ is not a store.** The HAL must drain the entire `audio.fmq` on each burst, even if it can only play some of those bytes right now. This is different from HIDL `write()` which was a simple blocking call. If the vendor HAL thread is not high priority, bursts will back up and `xrunFrames` will climb — with a "healthy" Flinger mix above.

---

## Step 6 — Vendor Implementation: HAL to ALSA

### What happens (varies by vendor)

The AIDL HAL's `openOutputStream` + burst handling is vendor code. Common patterns:

**Simple (AOSP default HAL / non-Qualcomm):**
```text
burst data received from FMQ
    → pcm_write(pcm, buffer, bytes)    // TinyALSA
    → kernel ALSA ioctl
```

**Qualcomm PAL-based:**
```text
burst data received from FMQ
    → pal_stream_write(stream, buffer, bytes)
    → GPR/IPC to ADSP
    → ADSP graph processes and sends to AFE
    → AFE drives DAI
```

**Qualcomm legacy (mixer_paths):**
```text
burst data received from FMQ
    → pcm_write(pcm, buffer, bytes)    // still TinyALSA
    but also: use-case open applied mixer_paths.xml sequence
    → codec/amp controls set via tinymix
```

### What can fail here (vendor-specific)

| Failure | Evidence | Vendor |
| --- | --- | --- |
| `pcm_write` returns `EPIPE` | ALSA underrun; period too small or write too late | Any |
| `pcm_open` fails | Wrong card/device, format not supported | Any |
| ACDB lookup failure | No calibration for this use case/rate/channels | Qualcomm |
| Graph create failure | ADSP session could not build | Qualcomm |
| AFE port mismatch | Data arrives at wrong I2S/TDM | Qualcomm |

### The tinyplay bypass test (critical skill)

```bash
# Stop all Android audio first (or use a different PCM)
adb shell tinyplay /data/local/tmp/test.wav -D 0 -d 7
```

If `tinyplay` on the **same PCM** the HAL uses produces sound → the codec/amp/speaker path works. The bug is HAL-and-above or the HAL opened a **different** PCM.

If `tinyplay` is also silent → stop blaming AudioFlinger.

---

## Step 7 — Kernel: ALSA PCM ring buffer

### What happens

```text
pcm_write() from TinyALSA
    → ioctl(SNDRV_PCM_IOCTL_WRITEI_FRAMES)
    → kernel copies frames into the DMA ring buffer
    → if start_threshold reached and PCM is PREPARED:
        trigger START → DMA begins
    → if PCM already RUNNING:
        update appl_ptr (application pointer)
        DMA engine asynchronously reads from hw_ptr (hardware pointer)
```

### The ring buffer

```text
                    hw_ptr                     appl_ptr
                      ↓                          ↓
    ┌─────────────────┬──────────────────────────┬─────────────┐
    │  Already played  │  Available for DMA       │  Free space │
    │  (DMA consumed)  │  (written, not yet       │  (app can   │
    │                  │   consumed by DMA)        │   write)    │
    └─────────────────┴──────────────────────────┴─────────────┘
    ◄───────────────── buffer_size (period × count) ──────────►

    hw_ptr advances at BCLK rate (hardware clock)
    appl_ptr advances at pcm_write rate (software)

    If hw_ptr catches appl_ptr → UNDERRUN (playback)
    If appl_ptr catches hw_ptr → OVERRUN (capture)
```

### PCM states

```text
OPEN → SETUP → PREPARED → RUNNING → (XRUN → PREPARED)
                              ↓
                           DRAINING → SETUP
```

### What can fail here

| Failure | Evidence | Cause |
| --- | --- | --- |
| `hw_params` fails | `EINVAL` on `pcm_open` | Rate/format/channels/period not supported by driver |
| PCM stays `PREPARED` | `hw_ptr` frozen | `trigger START` never issued or `start_threshold` not met |
| PCM `RUNNING` but `hw_ptr` stuck | No DMA activity | Clocks not running (BCLK/MCLK), DMA not configured |
| XRUN (`EPIPE`) | Periodic glitches | `hw_ptr` overtook `appl_ptr`; writer too slow |

---

## Step 8 — ASoC: FE bind to BE, DMA start

### What happens

When `pcm_open` and `trigger START` execute on an ASoC card:

```text
FE PCM (e.g., MultiMedia1, hw:0,7)
    → DPCM bind to BE DAI (e.g., PRI_TDM_RX_0)
    → platform/DMA driver: allocate DMA buffer, configure descriptor
    → CPU DAI driver: set format (I2S/TDM/DSP_A), set clock provider,
                      configure TDM slots
    → codec DAI driver: set format, set sysclk, set PLL
    → machine driver: validate links, apply board-specific quirks
    → DAPM: power up path (DAC → mixer → output → amp supply)
    → trigger: DMA engine starts, DAI clocks start
```

### The three partners

```text
Platform/DMA: "I move bytes from memory to the serializer FIFO"
CPU DAI:      "I serialize bytes into I2S/TDM bits on the wire"
Codec DAI:    "I receive those bits and convert to analog"

All three must agree on:
  - Sample rate (BCLK = rate × channels × bit_width)
  - Format (I2S vs left-justified vs DSP_A/B)
  - Clock provider (who generates BCLK and FSYNC)
  - TDM slots (which slots carry which channels)
```

### What can fail here

| Failure | Evidence | Cause |
| --- | --- | --- |
| No BE bound for this FE | Kernel log: "no backend DAI" | DPCM routing table wrong for this use case |
| Clock mismatch | `hw_ptr` stuck; PCM `RUNNING` | Both sides think they are clock consumer → no BCLK |
| TDM slot mapping wrong | Audio on wrong speaker or channels missing | TX mask wrong; slot width mismatch |
| DAPM path incomplete | DAC widget not powered | Missing route in machine driver or codec kcontrol |

---

## Step 9 — Hardware: DAC → Amplifier → Speaker

### What happens

```text
I2S/TDM data bits arrive at codec chip
    → digital interpolation filter
    → DAC conversion: digital samples → analog voltage
    → analog mixer / PGA (programmable gain)
    → line output
    → external amplifier (Class-D typical for speakers)
        → enable GPIO asserted
        → gain set via I2C
        → current drive to speaker coil
    → speaker cone moves air
```

### Mute points (any one = silence)

1. **DSP/HAL digital gain** = 0
2. **Codec digital mute** register set
3. **Codec analog mute** (PGA at minimum or switch widget off)
4. **Codec DAPM** path incomplete (supply widget not powered)
5. **Headphone charge pump** off (headphone path only)
6. **Amplifier enable GPIO** low
7. **Amplifier mute pin** active
8. **Amplifier I2C gain** at mute setting
9. **Amplifier fault latch** (overcurrent, thermal, clock loss)
10. **Physical connector** disconnected or broken

### What can fail here

| Failure | Evidence | Cause |
| --- | --- | --- |
| All above OK, still silent | Measure voltage at speaker terminals | Bad speaker, broken trace, wrong connector |
| Pop at start/stop | Scope shows transient | Amp enabled before DAC settled; sequencing bug |
| Distortion | Scope shows clipping | Gain too high, two full-scale buses summed |
| One channel dead | Only on specific speakers | TDM slot map or amp channel |

---

## The Capture Mirror

Capture is the reverse path, with some important differences:

```text
Microphone → preamplifier → ADC → codec DAI →
    I2S/TDM → CPU DAI → DMA → kernel ring →
    pcm_read → HAL → StreamDescriptor burst (input) →
    AudioFlinger RecordThread → server proxy → shared memory →
    app AudioRecord.read()
```

### Key differences from playback

| Aspect | Playback | Capture |
| --- | --- | --- |
| Data direction | App → speaker | Microphone → app |
| XRUN type | Underrun (ring empty) | Overrun (ring full, app too slow) |
| Clock | DAC consumes | ADC produces |
| Permission | Usually none | `RECORD_AUDIO` + runtime + AppOps |
| Privacy | N/A | Concurrent capture policy, indicators |
| Effects | Volume, EQ, spatializer | AEC, NS, AGC (pre-processing) |
| Source selection | N/A | `AudioSource` (MIC, VOICE_COMMUNICATION, CAMCORDER, etc.) influences routing and effects |

### Echo cancellation adds a constraint

For voice calls / VoIP, the capture path needs to know the playback path's latency to cancel echo:

```text
Speaker output → room → microphone → capture path
                                        ↓
                                    AEC reference
                                        ↑
                              Playback path latency estimate
```

If you increase the playback buffer to fix XRUNs, you may break AEC. **Latency is a system budget.**

---

## The AAOS Variant

On AAOS, the path from Step 4 (Policy routing) changes significantly:

```text
App: USAGE_ASSISTANCE_NAVIGATION_GUIDANCE
    ↓
CarAudioService already registered dynamic mixes at boot:
    match USAGE_ASSISTANCE_NAVIGATION_GUIDANCE + user_id
    → force device = AUDIO_DEVICE_OUT_BUS, address = bus1_navigation_out
    ↓
AudioPolicy: getOutputForAttr hits the dynamic mix rule
    → returns output for bus1_navigation_out
    ↓
AudioFlinger: assigns track to the PlaybackThread for bus1_navigation_out
    ↓
HAL: IModule.openOutputStream for port bus1_navigation_out
    ↓
Vendor: opens PCM for nav use case (different from media)
    ↓
Kernel: different FE/BE binding (possibly different TDM slots / DAI)
    ↓
Hardware: may go to different amp / speaker (driver tweeters vs woofers)
```

### What this means for debugging

On phones, `USAGE_MEDIA` and `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE` often land on the **same** PlaybackThread (speaker). On AAOS, they land on **different** threads with **different** HAL streams, potentially on **different** physical hardware.

This is why AAOS debugging requires checking the **bus address** at every step, not just the device type.

---

## Where Each Failure Type Lives

Use this table to jump directly to the right layer:

| Symptom | Most likely layer | First evidence |
| --- | --- | --- |
| App crash / exception on create | App / Framework / Policy | Logcat: `createTrack failed` |
| `play()` succeeds, no track in Flinger | App didn't actually create track, or audioserver died | `dumpsys media.audio_flinger` — no matching session |
| Track exists but not ACTIVE | Focus pause, `play()` not called, or start rejected | Track state in Flinger dump |
| Track ACTIVE, wrong device/bus | Policy or CarAudio routing | `dumpsys media.audio_policy` device vs intent |
| Track ACTIVE, right device, frames frozen | Mixer stuck, app not writing, HAL blocked | Dump twice; `underrun` counter |
| Track ACTIVE, frames move, volume 0 | Policy mute, focus fade, master mute | Flinger track `vol` / `mute` |
| HAL stream `STANDBY` while Flinger started | HAL `Command.start` failed or never sent | StreamDescriptor state |
| HAL stream `ACTIVE`, `observable.frames` frozen | Vendor backend not consuming (pcm_write fail, graph not built) | HAL/vendor logs |
| PCM `RUNNING`, `hw_ptr` stuck | No BCLK, DMA not configured, BE not bound | `dmesg`, `/proc/asound` |
| PCM `RUNNING`, `hw_ptr` moves, silence | DAPM path incomplete, amp muted/faulted | `tinymix`, GPIO, amp I2C |
| Sound on wrong speaker | TDM slot mapping or amp channel routing | Scope, slot mask verification |
| Glitches at period rate | XRUN: writer too slow for period size | XRUN counters, `period_ms` math |
| First sound delayed / missing | Standby bring-up cost | Cold vs warm comparison |
| Pop at start/stop | Amp/DAC sequencing | Scope; compare enable order |

---

## Practical Exercise

### Exercise 1 — Trace a live playback

1. Play a music track on an emulator or device.
2. Run `adb shell dumpsys media.audio_flinger` twice, 1 second apart.
3. For the ACTIVE track, identify:
   - Session ID, UID
   - Thread type (Mixer/Direct/Offload)
   - Device type + address
   - Frames count (did it increase?)
   - Underrun count (stable?)
   - Volume (non-zero?)
4. Run `adb shell dumpsys media.audio_policy` and confirm the device matches.
5. On AAOS: `adb shell dumpsys car_service --services CarAudioService` — confirm the context→address mapping matches Flinger.

### Exercise 2 — Find last-known-good

Stop the music. Wait 5 seconds. Dump again.

- Is the thread in standby? (It should be if idle long enough.)
- Are there any tracks? (Track may still exist but be STOPPED.)

Now play again. Dump immediately.

- How long did it take for the thread to exit standby? (Compare timestamps in logcat.)
- Is this "cold start" latency?

### Exercise 3 — Predict the AAOS path

Given this `car_audio_configuration.xml` (simplified):

```xml
<zone name="primary" isPrimary="true">
  <volumeGroups>
    <group>
      <device address="bus0_media_out">
        <context context="music"/>
      </device>
    </group>
    <group>
      <device address="bus1_navigation_out">
        <context context="navigation"/>
      </device>
    </group>
  </volumeGroups>
</zone>
```

An app calls `AudioTrack` with `USAGE_MEDIA`. Predict:
1. Which bus address will the track land on?
2. If the app mistakenly uses `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE`, where will it go?
3. If both buses are active, how many PlaybackThreads will Flinger have?

Expected: (1) `bus0_media_out`, (2) `bus1_navigation_out`, (3) at least 2 (one per bus).

---

## Key Takeaways

1. **11 hops, 4 process boundaries, 3 clock domains.** Memorize the map.
2. **Construction is routing.** The device is chosen before `play()`.
3. **Binder is for control; shared memory is for data.** The mixer thread does not do IPC per frame.
4. **The AIDL FMQ is not a store.** HAL must drain it completely on each burst.
5. **Any mute point explains silence.** There are 10+ independent mute points from Flinger to speaker.
6. **The tinyplay test splits HAL from hardware.** This single experiment is worth 100 lines of logcat.
7. **AAOS changes the routing step, not the mixing step.** Different bus, different HAL stream, potentially different hardware.
8. **Dump twice.** One photograph shows state. Two photographs show motion.

## Next

[Module 03 — AudioPolicy vs AudioFlinger](03-audio-policy-vs-audioflinger.md)
