# Module 09 — ALSA, TinyALSA, and PCM

## Short Answer

ALSA is the **Linux PCM state machine**. TinyALSA is Android’s small userspace library for that machine. If the HAL opened a stream but you hear nothing or you hear glitches, you must be able to answer: **which PCM, what hw_params, what state, are writes meeting the period deadline?**

Policy does not own this layer. `pcm_open` does.

## Mental Model

A water wheel:

- **Period**: one bucket
- **Buffer** (period × count): the set of buckets on the wheel
- **write()**: filling a bucket
- **DMA**: the wheel turning
- **Trigger START**: releasing the brake
- **XRUN**: a bucket arrived empty (playback underrun) or overflowed (capture overrun)

### Three-level definitions

**PCM device**

- **Beginner:** The sound card device you play to (`hw:0,0`).
- **Engineer:** A kernel `snd_pcm` instance with a playback and/or capture stream.
- **Expert:** A frontend (usually) exposed by ASoC DPCM or a legacy driver, with a unique `(card, device)` pair. It is **not** the DAI, and not the speaker.

**TinyALSA**

- **Beginner:** Android’s way to talk to ALSA.
- **Engineer:** `external/tinyalsa` — `pcm_open`, `pcm_write`, `pcm_read`, mixer API.
- **Expert:** Chosen because full `libasound` is GPL. It is intentionally smaller: fewer plugins, no fancy `.asoundrc` routing. Almost all Android HAL PCM I/O goes through it or a vendor equivalent.

**XRUN**

- **Beginner:** A glitch.
- **Engineer:** The ring buffer ran dry (underrun) or overflowed (overrun).
- **Expert:** PCM state moves toward `XRUN`; you must `prepare`/`start` again. Causes: scheduler delay, blocking in HAL, too-small buffer, clock mismatch, or producer too slow.

## Architecture / Flow

### Userspace sequence (memorize)

```text
pcm_open(card, device, flags, config)
        ↓
kernel applies hw_params
        (rate, channels, format, period_size, period_count)
        ↓
sw_params
        (start threshold, stop threshold, avail_min)
        ↓
prepare
        ↓
write() first period(s)     ← often required before start
        ↓
trigger START
        ↓
DMA + period interrupts
        ↓
continuous write() in a loop
        ↓
trigger STOP / drain
        ↓
pcm_close
```

If you `start` with an empty buffer, you can XRUN immediately. Some drivers auto-start when `start_threshold` is reached.

### PCM states (conceptual)

```text
OPEN → SETUP → PREPARED → RUNNING
                    ↑         |
                    +-- XRUN -+     (state is XRUN, not RUNNING; EPIPE)
                    +-- PAUSED
                    +-- DRAINING → SETUP
```

XRUN is a real kernel state: `RUNNING → XRUN`, then `prepare` back to `PREPARED`, then `start`. The PCM does not remain `RUNNING` through an underrun. Kernel also has `SUSPENDED` (system suspend) and `DISCONNECTED`; they are not the TinyALSA happy path.

`dumpsys` will not show this. Kernel debug or `cat /proc/asound/card*/pcm*/sub*/status` (if exported) will.

## Detailed Explanation

### 1. hw_params vs sw_params

| | hw_params | sw_params |
| --- | --- | --- |
| What | Hardware contract | Software behavior of the ring |
| Examples | rate, format, channels, period size, periods | start threshold, stop threshold, silence threshold, avail_min |
| Who fails | Driver cannot do 96 kHz | Start happens too early/late |

A junior only logs rate/channels. An engineer also logs **period_size** and **period_count**. Those *are* the latency and XRUN budget.

### 2. Period vs buffer

```text
One period = the unit the DMA IRQ / completion usually signals
Buffer     = how much future audio the hardware can chew without userspace
```

| Small period | Large period |
| --- | --- |
| Lower latency | Higher latency |
| More wakeups | Better power |
| Easier to XRUN | More tolerant |

Deep buffer outputs: large periods. Fast / voice: small periods. Do not copy one config onto the other.

### 3. Format and interleaving

Typical Android playback:

- `S16_LE` stereo interleaved
- `S24_LE` / `S24_3LE` / `S32_LE` (do not confuse 24-in-32 with packed 24)
- Channel count 1, 2, 4, 8 on automotive

If userspace writes stereo and the PCM is 8-channel TDM, the extra slots are **not magically populated**. Either Flinger/HAL upmixes, or the other TDM slots are zeros (or leftover garbage if the driver is sloppy).

### 4. Underrun vs overrun vs “no sound”

| Event | Playback | Capture |
| --- | --- | --- |
| Underrun | Hardware needed frames; ring empty → glitch / mute | Rarely named this way |
| Overrun | Rare | Hardware produced frames; userspace did not read |
| Running + zeros | Path alive, digital silence | Path alive, you record silence |

Running + zeros is **not** an XRUN. Juniors conflate them.

### 5. TinyALSA mixer vs PCM

TinyALSA also has `tinymix` / mixer APIs for **controls** (volumes, muxes, switches). Those are **codec/ASoC kcontrols**, not PCM params.

```text
tinymix                 → analog/digital routing and gains
tinyplay / pcm_write    → sample movement
```

A perfect PCM with a mux pointed at the wrong DAC input is silence. That is Module 11, but you discover it while staring at ALSA.

### 6. Android does not use PulseAudio / PipeWire here

The Android HAL is the userspace policy+mixer client. Do not debug `pulseaudio` on a standard AAOS board unless the product explicitly added a Linux desktop stack (unusual).

## Source-Code Path

```text
external/tinyalsa/src/pcm.c
  pcm_open
  pcm_hw_mmap_status / ioctl wrappers
  pcm_writei / pcm_write
  pcm_start / pcm_stop

external/tinyalsa/src/mixer.c
  mixer_open, mixer_ctl_*

Kernel:
  include/uapi/sound/asound.h     # ioctl ABI
  sound/core/pcm.c
  sound/core/pcm_native.c         # hw_params, trigger, write
  sound/core/pcm_lib.c            # XRUN helpers
```

When you read `pcm_open` in TinyALSA, note it immediately tries to set hw_params from the `pcm_config` struct. There is no separate “format negotiation UI.” The HAL must already know what it wants.

## Debugging

```text
HAL says open succeeded
   |
   +-- Does /proc/asound see the card/device?
   |       No  → driver not probed / wrong card index
   |       Yes ↓
   +-- PCM state RUNNING?
   |       No  → prepare/trigger/start_threshold
   |       Yes ↓
   +-- Pointer moving (hw_ptr / appl_ptr)?
   |       No  → DMA/clock not actually running
   |       Yes ↓
   +-- XRUN count climbing?
   |       Yes → timing / period / producer
   |       No  ↓
   +-- Leave ALSA; DSP/codec/amp
```

### Practical commands (device-dependent)

Many production user builds hide `tinyplay` and even `/proc/asound`. Use userdebug/eng or a root shell.

```bash
adb shell cat /proc/asound/cards
adb shell cat /proc/asound/pcm
adb shell ls -l /dev/snd/

# if tiny tools exist
adb shell tinyplay /data/local/tmp/test.wav -D 0 -d 0
adb shell tinymix
```

**Bypass test (critical skill):** If `tinyplay` on the same PCM the HAL uses produces sound, the codec/amp/speaker path can play. The bug is HAL-and-above or the *different* PCM the HAL actually opened. If `tinyplay` is also silent, stop blaming AudioFlinger.

Be careful: `tinyplay` can steal a PCM (`EBUSY`) from the HAL. Stop media first.

## Logs / Commands

Kernel:

```bash
adb shell dmesg | grep -iE 'snd|pcm|asoc|audio'
```

What you expect on start:

```text
ASoC or PCM prepare/trigger logs (if dynamic debug enabled)
No repeating XRUN / underrun messages
```

What indicates a problem:

```text
tinycap/tinyplay: cannot open device
hw_params: Invalid argument     → rate/format/channels/period not supported
write: I/O error / EPIPE        → XRUN or unprepared
DAPM path incomplete            → codec power (next modules)
```

How to read a PCM status (ideas):

```text
state: RUNNING          good if you expect sound
state: PREPARED         started never happened
state: XRUN             already failed
hw_ptr moving           DMA is advancing
avail stuck at 0 or full  consumers/producers not meeting
```

Enabling ASoC/PCM dynamic debug is kernel-version and build specific. Do not invent `echo 1 >` paths; look at `dynamic_debug` control on *that* kernel.

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| “ALSA is ASoC” | ASoC is the SoC driver framework *on top of* ALSA PCM |
| Debugging PulseAudio | Usually not present |
| Matching only rate/channels | Periods cause the XRUNs |
| Thinking RUNNING means analog unmute | Only means the PCM is running |
| Using desktop `aplay` on GPL-sensitive products | TinyALSA is the Android-native tool |
| Assuming card 0 is always the SoC | USB audio can become card 0 after replug on some products |

## Practice

HAL log: `pcm_open card=0 device=7 rate=48000 ch=2 format=S16_LE period=480 periods=4` succeeded. User hears a periodic glitch ~10 times per second.

1. What is `period_ms`?
2. Why might glitches land at that rate?
3. Is this more likely a codec mute or a deadline miss?

Expected:

1. 480/48000 = 10 ms.
2. One XRUN or late write per period sounds like a 10 ms-cadence glitch.
3. Deadline miss / XRUN. A mute is usually continuous silence, not a 100 Hz chop. Confirm with XRUN counters.

**Diagnostic question:** `tinyplay` on `hw:0,0` works. Media is silent. Policy selected `bus0_media_out`. What is your next question?

Expected: “Which `(card,device)` does the HAL open for `bus0_media_out`?” If it is not `0,0`, you tested the wrong PCM.

## Key Takeaways

1. PCM is a state machine with hw_params and a ring buffer.
2. Period math *is* latency and XRUN budget.
3. TinyALSA is the Android userspace; full ALSA lib is not the default.
4. `tinyplay` is the bypass experiment that splits HAL from hardware.
5. RUNNING + zeros ≠ XRUN.

## Next

[Module 10 — ASoC, DAI, DMA, I2S, and TDM](10-asoc-dai-dma-i2s-tdm.md)
