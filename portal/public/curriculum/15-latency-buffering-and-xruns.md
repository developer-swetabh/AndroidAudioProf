# Module 15 — Latency, Buffering, and XRUNs

## Short Answer

Latency is **the time a frame spends in queues**. An XRUN is **a queue that was empty or full at the wrong time**. You cannot debug either without converting every buffer into **milliseconds** and knowing **which clock** is consuming those frames.

“Increase the buffer” fixes some XRUNs and creates other bugs (slow nav, lip-sync fail, sluggish VoIP). Treat buffer size as a **product contract**, not a hammer.

## Mental Model

A series of water tanks between a pump (app) and a turbine (DAC). Each tank adds delay. If any tank empties, the turbine sputters (underrun). If a capture tank overflows, samples are lost (overrun).

```text
App buffer
  + AudioTrack / AAudio client buffer
  + Flinger mixer pipeline
  + HAL / ALSA ring (period × count)
  + DSP algorithmic delay
  + digital filters in codec
  + analog / amp
  = output latency
```

### Three-level definitions

**Latency**

- **Beginner:** Delay between event and sound.
- **Engineer:** End-to-end time from write/callback to acoustic energy (playback) or the reverse (capture).
- **Expert:** A sum of deterministic buffer delays plus non-deterministic scheduler/IPC/standby bring-up. Fast paths exist to remove the large terms, not the speed of light.

**Period vs buffer**

- **Beginner:** Chunk vs total queued audio.
- **Engineer:** `period_ms = period_frames / rate`; `buffer_ms = period_ms * period_count`.
- **Expert:** Period is the wakeup/IRQ quantum. Buffer is the jitter tolerance. `sw_params.start_threshold` decides how full the tank must be before the turbine starts.

**XRUN**

- **Beginner:** A click or dropout.
- **Engineer:** ALSA underrun/overrun; PCM leaves RUNNING.
- **Expert:** Can originate above ALSA (app late, Flinger mix late, HAL blocked) or below (DMA glitch, clock drift, DSP regraph). The **first counter that increments** names the layer.

## Architecture / Flow

### Playback timing loop

```text
PlaybackThread wakes
    ↓
mix period_frames
    ↓
HAL write (should not block longer than remaining jitter budget)
    ↓
sleep until next deadline
```

If `write()` blocks waiting for the kernel, that can be OK (it *is* the clock). If `write()` blocks on a mutex held by a Binder thread, you blow the deadline.

### Two clocks that must agree

```text
Software timeline: Flinger frame counters / AudioTimestamps
Hardware timeline: DMA pointer / DSP wallclock / DAI BCLK
```

If they drift, you get gradual slip, resample correction, or periodic XRUN. USB and Bluetooth add a **third clock** (the accessory). That is why those paths are harder (Module 17).

## Detailed Explanation

### 1. Convert everything to milliseconds

Always.

```text
frames_to_ms = frames * 1000 / sample_rate
```

Examples at 48 kHz:

| Frames | ms |
| --- | --- |
| 192 | 4 |
| 240 | 5 |
| 480 | 10 |
| 960 | 20 |
| 1920 | 40 |

If someone says “period is 512,” ask “at what rate?” 512 @ 8 kHz is 64 ms. 512 @ 48 kHz is 10.7 ms.

### 2. Typical Android output classes (orders of magnitude)

Exact numbers are **product-specific**. Use this only as intuition:

| Path | What you are buying | Typical period class |
| --- | --- | --- |
| Deep buffer / media | Power, few wakeups | ~10–20+ ms |
| Normal mixer | Compromise | mid |
| FastMixer / AAudio low-latency | Touch, games, some VoIP | ~2–5 ms |
| MMAP exclusive | Lowest framework latency | smallest the HAL allows |
| Compressed offload | DSP decode, large bursts | not period-like in the PCM sense |

Do not put a 2-hour playlist on a 2 ms path. You will burn power and catch every scheduling hiccup.

### 3. Cold start vs steady-state latency

| | Cold | Steady |
| --- | --- | --- |
| Includes standby bring-up | Yes | No |
| DSP graph build | Often | No |
| Amp unmute ramp | Often | No |
| What users say | “First nav word clipped / late” | “Music stutters” |

These are different bugs. Measure both. Warm the path (play silence or keep the bus out of standby) only as a **product decision**, not as a silent workaround that wrecks power.

### 4. Who is late? Counter discipline

| Counter | Owner |
| --- | --- |
| `AudioTrack.getUnderrunCount` | Client not filling the client buffer |
| Flinger track underrun | Track empty at mix time |
| HAL/TinyALSA EPIPE | ALSA ring empty/full |
| DMA FIFO error | Serializer starved despite PCM |
| User “glitch” with all counters 0 | Often not an XRUN (route click, DSP rebuild, BT packet loss) |

If only the user hears it and no counter moves, stop saying XRUN.

### 5. FastMixer special physics

FastMixer is intolerant of:

- Binder in the loop
- `ALOGx` that may block
- Page faults (memory must be warm)
- Priority inversion
- Effects that take too long

AOSP invented NBLOG/media.log for this reason (Module 20). If glitches vanish when you disable logcat spam, you may have created them.

### 6. Resampling, Format & Channel Conversion Architecture

Whenever track format does not match output thread format, AudioFlinger must perform real-time conversion in the mixer loop:

#### A. Sample Rate Conversion (AudioResampler)
- **Engine**: `AudioResampler::create()` instantiates a polyphase sinc/FIR resampler (`AudioResamplerDyn`).
- **Quality levels**: `DYN_LOW_QUALITY` (linear), `DYN_MED_QUALITY` (cubic), `DYN_HIGH_QUALITY` (sinc with Kaiser window).
- **Cost**: High-quality sinc resampling 44.1 kHz to 48 kHz across 8 channels consumes significant DSP/CPU cycles per period.
- **Buffer expansion**: Resampling introduces filter group delay (latency) and non-integer sample ratio buffering (e.g. 441 input frames for 480 output frames).

#### B. Bit-Depth & Format Conversion
- **Internal Mixer Precision**: AudioFlinger mixes in **IEEE 754 32-bit float** internally to maintain dynamic range and prevent integer overflow/clipping during summing.
- **Conversion stages**:
  ```text
  App 16-bit PCM ──► Convert to Float (division by 32768.0) ──► Mix / Effects ──► Convert & Clamp to HAL format (Float / S24_LE / S16_LE)
  ```
- **Quantization & Dither**: When down-converting from float to 16-bit integer for the HAL, dither may be applied to reduce harmonic distortion.

#### C. Channel Mapping & Upmixing/Downmixing
- **Downmix (Multi-channel -> Stereo)**: Uses ITU-R BS.775 downmix matrix coefficients (Center -3dB, Surrounds -3dB) or custom multichannel downmixers.
- **Upmix (Stereo -> Multichannel Bus)**: By default, stereo content sent to an 8-channel automotive bus is duplicated to Front Left/Right while other slots receive zeros unless an upmixer effect is attached.
- **System Impact**: Mismatched channel counts and sample rates on multiple concurrent tracks compound CPU usage. On loaded automotive SoCs, this conversion CPU can directly cause deadline misses and XRUNs. Always prefer configuring media decoders to match native HAL output sample rates (typically 48000 Hz).

### 7. Capture / AEC latency

Voice and VoIP add:

- Input buffer
- AEC tail (must cover output latency!)
- Possible DSP round-trip

If you increase output buffer to hide XRUNs, AEC may break (echo returns). Latency is a **system** budget, not a per-stream preference.

### 8. Timestamp APIs

`AudioTimestamp` / `getTimestamp` exist so apps can align video or MIDI. If timestamps jump at route changes, the app may “glitch” even when PCM did not XRUN. Join video bugs to route-change logs before you enlarge periods.

## Source-Code Path

```text
AudioFlinger Threads.cpp
  wait for next write time
  measure sleep vs work

AudioTrack.cpp
  obtainBuffer / underrun accounting

TinyALSA pcm.c
  pcm_write → EPIPE path

Kernel pcm_lib.c
  xrun handling

AAudio:
  frameworks/av/media/libaaudio/  (MMAP vs legacy path)
```

When reading the mixer loop, annotate **work time vs period time**. If work time exceeds period time, XRUNs are mathematically required.

## Debugging

```text
Glitch or late sound
   |
   +-- Cold only? → standby / graph / unmute ramp
   +-- Steady?
         |
         +-- App underrun count up? → producer / decoder / GC / app thread
         +-- Flinger underrun up, app OK? → mixer overload / scheduling
         +-- ALSA EPIPE? → write late or period too small or clock
         +-- No counters? → route click, BT packet, DSP rebuild, analog pop
```

### Experiments that change one variable

1. Move the stream to deep buffer (if allowed). If XRUNs vanish, you had a deadline problem, not a broken DAC.
2. Raise the app’s callback priority / bind to a performance CPU (product policy permitting).
3. Disable an effect.
4. Lock sample rate to the mixer rate.
5. Hold the output out of standby and retest first-prompt.

Change **one** thing per experiment.

### Oscilloscope of software

Dump Flinger twice. Compute frames delta / time delta. If it is not ~sample_rate, the thread is not keeping real time.

## Logs / Commands

```bash
adb shell dumpsys media.audio_flinger    # underruns, frame counts, period
adb shell dumpsys media.audio_policy
# systrace / perfetto with audio atrace tags (if enabled on the build)
```

Perfetto/systrace is the right tool once you suspect scheduling. Look for:

- FastMixer / MixerThread slices longer than a period
- Binder transactions on the hot thread
- CPU idle just before a deadline miss
- HAL `write` blocking abnormally

Tee sink (Module 20) tells you whether the glitch is already in the mixed PCM.

What you expect on a healthy media path:

```text
Underrun counters stable
write counters increment at sample_rate
No EPIPE
Latency report from HAL roughly equals buffer_ms + DSP
```

What indicates a problem:

```text
Underruns climb in lockstep with UI jank
EPIPE every N ms matching period_ms
First 20–50 ms missing only after long idle
Timestamps jump by hundreds of ms at a route change
```

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Maxing ALSA buffer on every output | Breaks VoIP, games, AEC, nav urgency |
| Calling every click an XRUN | Many clicks are mute sequencing |
| Debugging FastMixer with heavy logcat | Observer effect |
| Ignoring standby on first-prompt bugs | Different physics |
| Fixing 44.1 vs 48 by “it’s just 0.2 kHz” | It is a resample every frame |

## Practice

Product: 48 kHz, HAL period 240 frames, 4 periods. App AudioTrack buffer is 1920 frames. DSP claims 3 ms. Amp 0.5 ms.

1. What is the steady-state **minimum** software+HAL+DSP+amp delay, ignoring mixer pipeline extras?
2. Nav first prompt after 2 minutes idle is ~80 ms late. Is the math above enough to explain it?
3. Where do you look?

Expected:

1. App 40 ms + HAL 20 ms + DSP 3 + amp 0.5 ≈ 63.5 ms plus Flinger internal pipeline (not zero). Order of tens of milliseconds.
2. No. 80 ms extra on top of a warm path is bring-up, not the ring size.
3. Standby, graph build, calibration, amp ramp. Compare warm vs cold timestamps.

**Diagnostic question:** ALSA XRUN every 10 ms, period is 10 ms, app underrun is 0, Flinger work time is 11 ms. Who owns it?

Expected: Flinger/CPU/effects — the mixer **cannot** meet a 10 ms period if it needs 11 ms to mix. Enlarge period, reduce mix cost, or move off this thread. Not the speaker.

## Key Takeaways

1. Convert frames to milliseconds every time.
2. Period = wakeup; buffer = jitter budget.
3. Counters name the layer; no counter → probably not an XRUN.
4. Cold-start latency is a different bug class.
5. Buffer size is a product tradeoff with AEC, power, and urgency.

## Next

[Module 16 — Qualcomm Audio and DSP](16-qualcomm-audio-and-dsp.md)
