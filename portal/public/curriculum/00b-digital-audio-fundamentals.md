# Module 00b — Sound as Numbers

Interactive studio (knobs, ring, frame grid): `#/fundamentals`. This page is the long form. The calculator on `#/workbench` uses the **same formulas**.

## Short Answer

Audio software does not move “sound”. It moves **frames on a clock**.

- A **sample** is one channel’s amplitude at one instant.
- A **frame** is every channel at that instant.
- **Sample rate** is frames per second of that stream clock (not IRQ rate).
- **Period** is the wake / IRQ quantum, in frames.
- **Buffer** is `period × period count` — the jitter tank.
- **Bit depth** is useful bits; **packing** is bytes on the wire (`S24_LE` ≠ `S24_3LE`).
- **Linear PCM** can be mixed. **Compressed** and **offload** cannot be mixed in AudioFlinger as if they were PCM.

If you cannot convert frames to milliseconds, you cannot compare two dumps.

## Mental Model

```text
sample   = one number, one channel, one instant
frame    = all channels at that instant
rate     = frames / second
period   = how many frames per wake
count    = how many periods in the ring
buffer   = period × count
```

Water-wheel picture (you will reuse it in Module 09):

- Period = one bucket
- Buffer = buckets on the wheel
- XRUN = a bucket arrived empty (or overflowed)

### Three-level definitions

**Sample rate**

- **Beginner:** How often a snapshot is taken.
- **Engineer:** `48000` means 48,000 **frames** per second, not 48,000 left samples if the stream is stereo.
- **Architect:** Policy profile, HAL, and `hw_params` must agree. A lie becomes `EINVAL` or a resample tax (44.1 kHz into a 48 kHz mixer).

**Sample vs frame**

- **Beginner:** Sample = one speaker’s number. Frame = all speakers at once.
- **Engineer:** `frame_size = channels × bytes_per_sample`. ALSA `period_size` is in **frames**.
- **Architect:** Saying “512 frames” without rate is not a latency. 512 @ 8 kHz is 64 ms; 512 @ 48 kHz is 10.7 ms.

**Period vs buffer**

- **Beginner:** Chunk vs how much is queued.
- **Engineer:** `period_ms = period_frames / rate × 1000`. `buffer_ms = period_ms × period_count`.
- **Architect:** Period is scheduler/IRQ pressure. Buffer is jitter tolerance. Count 2 is twitchy. Huge count hides XRUNs and kills AEC / nav urgency.

**Bit depth / packing**

- **Beginner:** How fine the volume ladder is.
- **Engineer:** `S16_LE` = 2 bytes. `S24_3LE` = 3 bytes packed. `S24_LE` = 24 useful bits in 32. `S32_LE` = 4 bytes.
- **Architect:** 24-in-32 is not 32-bit SNR. Mismatch is often `EINVAL` or channel crawl, not “quiet audio”.

**Linear PCM vs compressed vs offload**

- **Beginner:** Raw numbers vs a zip file vs “the DSP unpacks it”.
- **Engineer:** PCM → MixerThread/FastMixer. Compressed → decoder or DIRECT. Offload → OffloadThread, DSP decode.
- **Architect:** You cannot mix nav into an offload or AC3 pipe in Flinger. That is a product topology choice, not a one-line Policy fix.

## Architecture / Flow

### The only formulas that matter here

```text
period_ms      = period_frames / sample_rate × 1000
buffer_ms      = period_ms × period_count
frame_size     = channels × bytes_per_sample
bytes / period = period_frames × frame_size
IRQ / s        = sample_rate / period_frames
```

Golden set (memorize the shape, not the poetry):

```text
48 000 Hz · 2 ch · S16_LE · 240 frames · 4 periods
  frame        = 4 bytes
  period       = 5.00 ms · 960 bytes
  buffer       = 20.00 ms
  IRQ          = 200 / s
  wire         = 192 000 bytes / s
```

### Where this sits on Android 15

```text
App write (frames)
    → AudioFlinger thread (period of that thread)
        → AIDL StreamDescriptor.Command.burst (must drain audio.fmq)
            → TinyALSA pcm_write
                → ALSA ring (period × count)
                    → DMA / DAI (I2S or TDM slots)
                        → codec / amp
```

Offload **skips the PCM mixer**. Compressed DIRECT often **skips mixing**. Do not apply the water-wheel to the wrong pipe.

## Detailed Explanation

### 1. Rate is a clock, not a quality badge

8 / 16 kHz voice, 44.1 kHz CD files, **48 kHz Android mixer native**, 96 kHz “hi-res” paths. Pulling 44.1 kHz media through a 48 kHz mixer costs a resample. That can be correct and still be the reason a timestamp looks drunk.

Always write milliseconds next to frame counts in a dump.

### 2. Channels belong to the stream; TDM slots belong to the wire

Interactive: `#/fundamentals` board 6.

**Junior picture**

- A **channel** is one person in a **group photo**. Everyone is captured at the **same instant**. Stereo = 2 people. **6 channels = 5.1** (front L/R, center, sub, surround L/R). That is a software snapshot, not a cable.
- A **TDM slot** is one **apartment in a revolving door**. People walk through **one after another** on a single data pin, then FSYNC repeats. I2S is a 2-apartment door (L, then R). Car amps often have an **8-apartment** door.
- So: 6 people in the photo, 8 apartments in the door. Two apartments stay empty (zeros) — or belong to chime / another occupant. Silence there is expected unless something **upmixes**.
- The extra speakers do **not** magically play a copy of stereo. If you hear 2 of 8, look at packing, not Policy.

**Engineer**

| | Channel | TDM slot |
| --- | --- | --- |
| Object | Sample inside a PCM frame | Time apartment on BCLK / FSYNC / DOUT |
| Count | `hw_params` channels / Android channel mask | DAI slot count (`set_tdm_slot`) |
| Mask | FL\|FR\|FC\|LFE\|… | TX/RX bitmask: which apartments this DAI owns |
| Width | Bit depth / packing (S16, S24_3LE…) | Slot width, often 32 even when the sample is 16 |

ALSA `period_size` is still in **frames**. A frame with 6 channels is 6 samples at one instant. The serializer then **queues those samples into slots over time**.

16-bit sample in a 32-bit slot is **padding**, not extra SNR.

**Architect**

- `car_audio_configuration.xml` names **buses**. It does not program TDM apartments. If Flinger’s bus address matches XML and the **wrong speaker** sings, leave Policy.
- One inverted FSYNC on 8-slot TDM **rotates every slot by one**. Media on the chime tweeter; Policy innocent.
- Count 8=8 can still be wrong: 7.1 names (SL/SR) are not a car amp map (chime/RSV).
- Two occupants can share one TDM line in different slots. That is not “Android grew extra channels.”
- BCLK ≈ `sample_rate × slots × slot_width`. 48 kHz × 8 × 32 = 12.288 MHz class. Wrong BCLK → `hw_ptr` stuck while PCM says RUNNING (Module 10).
- Do not invent the slot map. Read the amp datasheet and the machine driver’s `set_tdm_slot`.

### 3. 16-bit vs 24-bit vs 24-in-32

| Format | Bytes/sample | Useful bits | Stereo frame | Android enum (typical) |
| --- | --- | --- | --- | --- |
| S16_LE | 2 | 16 | 4 B | `AUDIO_FORMAT_PCM_16_BIT` |
| S24_3LE | 3 | 24 | 6 B | `AUDIO_FORMAT_PCM_24_BIT_PACKED` |
| S24_LE | 4 | 24 in 32 | 8 B | `AUDIO_FORMAT_PCM_8_24_BIT` |
| S32_LE | 4 | 32 | 8 B | `AUDIO_FORMAT_PCM_32_BIT` |

Workbench case “profile lie” is this table wearing a Policy hat: advertised 24-bit, PCM open `EINVAL`.

### 4. Period is not buffer

If FastMixer runs ~2–5 ms periods, that is IRQ pressure. Media deep-buffer might use a large period × a few counts for power. Putting a chime on deep-buffer makes the first word late. That is Module 15 — the units start here.

### 5. Four PlaybackThreads (Direct does **not** bypass AudioFlinger)

Interactive: `#/fundamentals` board 5.

Every normal playback still does this:

```text
App (AudioTrack / MediaPlayer / AAudio)
    → AudioPolicy   (picks device + flags)     ← always
    → AudioFlinger PlaybackThread              ← always, inside audioserver
    → HAL (AIDL Command.burst on Android 15)
    → pins / HDMI / DSP
```

What changes is **which PlaybackThread** Policy asked Flinger to use — and whether that thread **mixes PCM**.

| Thread | Still in AudioFlinger? | Mixes? | What the app writes | Who unpacks an MP3 | Nav on *this* output |
| --- | --- | --- | --- | --- | --- |
| **MixerThread** | Yes | Yes, many tracks | PCM samples | Usually MediaCodec *before* this thread | Can mix / software-duck |
| **FastMixer** | Yes (often *beside* MixerThread) | Yes, few fast tracks | PCM samples | Already PCM | Only if nav is also fast |
| **DirectOutputThread** | Yes | No — one track | Exclusive PCM **or** compressed passthrough | Sink (TV) if passthrough | Impossible |
| **OffloadThread** | Yes | No — one track | Compressed frames | DSP | Impossible |

**Junior picture**

- **MixerThread** is the everyday mixing desk. You bring numbers. Flinger adds everyone allowed on that speaker/bus and pours **one** PCM to the HAL (~10–20 ms class; deep-buffer is this thread with a large period).
- **FastMixer** is a second, impatient cook in the **same kitchen**. Tiny period (~2–5 ms). Still PCM, still a mixer, still Flinger. Heavy logging (`ALOGE`) in this loop can *cause* the glitch. MixerThread often still handles slower media on that output.
- **DirectOutputThread** is one train with no coupling. Policy still booked the platform. Flinger still owns the thread. HAL still gets I/O. Nobody else may board. HDMI AC3 passthrough is this: Flinger forwards the zip file, the TV unpacks it. You cannot mix nav into AC3.
- **OffloadThread** is a post office. Flinger ships encoded frames to the DSP; the DSP unpacks them. Pause/flush/XRUN are not MixerThread’s. Nav cannot join.

**The MP3 trap.** A `.mp3` file does **not** mean Offload. Default: framework decoder (MediaCodec) → PCM → MixerThread. Offload happens only when Policy **and** the HAL advertise `AUDIO_OUTPUT_FLAG_COMPRESS_OFFLOAD` for that format.

**“Does Direct bypass AudioFlinger?”** No. It bypasses the **software mixer**. `dumpsys media.audio_flinger` will still show a Direct or Offload thread. If that thread is missing, Policy never opened that path.

**Nav + media**

- Same MixerThread → one mixed PCM at the HAL (software duck/mix).
- AAOS often uses **two MixerThreads on two buses** so the DSP can duck in hardware.
- Direct/Offload media → nav must be a **different** output. There is no PCM here to add into.

## Practice

1. Convert 512 frames at 8 kHz and at 48 kHz to milliseconds. Which one can hide a nav prompt?
2. Stereo `S24_3LE` vs stereo `S24_LE`: frame size, bytes/period at 240 frames. Why might only one of them open?
2b. 6-channel 5.1 into an 8-slot TDM amp: how many apartments are zeros? If those two speakers are silent, is Policy guilty? If stereo plays on the chime tweeter, which layer moved?
3. Why is “increase period count to 8” a dangerous fix for an XRUN you have not proven?
4. Can CarAudioService duck offload media by mixing nav into the same OffloadThread? Which pipe did you just choose?

## Takeaways

1. **Frames / rate × 1000 = ms.** Write it on the dump.
2. **Sample ≠ frame.** Stereo doubles bytes, not the rate number.
3. **Period wakes; buffer forgives.** They are not synonyms.
4. **Packing ≠ useful bits.** `S24_LE` is not `S24_3LE`.
5. **Direct and Offload skip the mixer, not AudioFlinger.** An MP3 is usually PCM on MixerThread unless HAL+Policy advertised offload.

## Open in the portal

- Studio: `#/fundamentals`
- Calculator: `#/workbench`
- Next: [Module 01 — Think in Layers](01-think-in-layers.md)
- Later physics: [Module 09](09-alsa-tinyalsa-and-pcm.md), [Module 15](15-latency-buffering-and-xruns.md)
