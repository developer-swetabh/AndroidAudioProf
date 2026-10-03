# Module 04 — AudioTrack, AudioRecord, and Media APIs

## Short Answer

All app-visible playback eventually becomes a **track** inside AudioFlinger (or a closely related MMAP/fast path that still interacts with it). `MediaPlayer`, ExoPlayer, SoundPool, Ringtone, and most games are not alternate audio systems. They are **producers** that feed `AudioTrack`, AAudio, or OpenSL ES.

Your job at this layer is to know: **what object was created, with which attributes, in which session, writing at which rate.**

## Mental Model

```text
App API you see
      ↓
A buffer source (decoded PCM, generated PCM, or offload bitstream)
      ↓
A client object (AudioTrack / AudioRecord / AAudio stream)
      ↓
A Binder + shared-memory connection
      ↓
A Track on a Thread in AudioFlinger
```

If the client object was never created, the rest of the stack cannot be guilty of “not mixing your stream.” It can still be guilty of *rejecting* creation.

### Three-level definitions

**AudioTrack**

- **Beginner:** The object an app uses to play PCM.
- **Engineer:** A client that obtains an `IAudioTrack`, writes to a shared buffer or callback, and starts/stops a Flinger track.
- **Expert:** Construction is a policy query (`getOutputForAttr`) plus thread selection. There are buffer modes (`MODE_STREAM`, `MODE_STATIC`), write flags (blocking / non-blocking), native callback delivery, performance modes (low latency / power saving), and offload flags that pick *different thread types*.

**AudioRecord**

- **Beginner:** The object that captures from a microphone.
- **Engineer:** A client that reads from a RecordThread via shared memory.
- **Expert:** Source (`MIC`, `VOICE_COMMUNICATION`, `CAMCORDER`, `UNPROCESSED`…) is a routing and effects key, not just a label. Privacy, concurrent capture, and AOP/hotword paths complicate this on modern Android.

**MediaPlayer / ExoPlayer**

- **Beginner:** Plays files and streams.
- **Engineer:** A demux/decode pipeline that ends in an `AudioTrack` (or offload).
- **Expert:** Offload and compressed paths can send encoded data to a Direct/Offload thread so the DSP decodes. That changes XRUN semantics and pause/flush behavior.

## Comparison table: APIs people confuse

| API | You use it for | Ends in | You do not use it for |
| --- | --- | --- | --- |
| `AudioTrack` | PCM playback you control | Flinger track | File decoding |
| `AudioRecord` | PCM capture | Flinger record track | File encoding |
| `MediaPlayer` | Simple file/URL playback | Decoder + AudioTrack/offload | Fine sample control |
| ExoPlayer | App-controlled media | Decoder + AudioTrack | System policy |
| `SoundPool` | Short UI/game clips | Shared AudioTrack-like path | Long media |
| `ToneGenerator` | DTMF / tones | System playback path | Music |
| OpenSL ES | NDK legacy low-level | Eventually Flinger | New designs (prefer AAudio) |
| AAudio | Low-latency PCM | Flinger or MMAP | Policy/routing |
| `MediaRecorder` | Encoded capture | AudioRecord-like + encoder | Raw routing debug |

AAudio is not a second AudioFlinger. It is a client API with a possible **MMAP** data path for lower latency. Routing and focus still go through the same policy world.

## Architecture / Flow

### Playback create + start

```text
new AudioTrack.Builder()
    .setAudioAttributes(...)
    .setAudioFormat(...)
    .setBufferSizeInBytes(...)
    .setTransferMode(...)
    .setSessionId(...)          // optional
    .build()
        ↓ JNI
AudioTrack::set() / createTrack_l
        ↓ Binder
AudioFlinger::createTrack
        ↓
AudioPolicy getOutputForAttr / similar
        ↓
attach to the PlaybackThread of the chosen output
(mixer outputs are opened at boot; direct/offload may be opened now)
        ↓
return IAudioTrack + shared buffer
        ↓
AudioTrack.play()
        ↓
Track::start → if the thread is in standby, the next write
sends Command.start/burst on the already open HAL stream
        ↓
app write() or callback fire
```

### Capture

```text
new AudioRecord.Builder()
    .setAudioSource(...)        // or setAudioAttributes
    .setAudioFormat(...)
    .build()
        ↓
AudioFlinger::createRecord
        ↓
Policy getInputForAttr
        ↓
RecordThread + HAL input stream
        ↓
AudioRecord.startRecording()
        ↓
app read()
```

### MediaPlayer (compressed file)

```text
setDataSource → prepare
    ↓
NuPlayer / MediaCodec decoder  (or hardware offload)
    ↓
AudioSink = AudioTrack (PCM)  or offload AudioTrack
    ↓
same Flinger path as above
```

## Detailed Explanation

### 1. The constructor is already a routing event

Juniors think routing happens at `play()`. Often the **output is chosen at create**. `play()` then starts that output. If the device later changes (headset insert), Policy/Flinger must **move** the track.

Consequences:

- Creating a track with the wrong usage can bind you to the wrong AAOS bus immediately.
- A create-time failure (`ERROR`, exception) is often Policy saying “no profile matches this rate/channel/format/flags.”

### 2. Session ID

A **session** groups a track with its effects and sometimes with related recordings (AEC).

```text
sessionId
  - generated if you pass AUDIO_SESSION_ALLOCATE / 0
  - shared if you want an effect applied to this playback
```

When you dump Flinger, join app logs to tracks using **session**. UID is the other join key.

### 3. Buffer modes, write flags, callbacks and offload

These are four different knobs, not one list of “transfer modes”:

| Knob | Options | Behavior | Typical use |
| --- | --- | --- | --- |
| Java buffer mode | `MODE_STREAM` | App pushes PCM with `write()` while playing | Media, simple generators |
| Java buffer mode | `MODE_STATIC` | Entire buffer preloaded once, then replayed | Short sounds |
| Write flag | `WRITE_BLOCKING` / `WRITE_NON_BLOCKING` | Whether `write()` waits for room in the shared buffer | Non-blocking for event-loop apps |
| Callback (pull) | native `AudioTrack` `TRANSFER_CALLBACK`, AAudio data callback | A **client-side** thread is woken to fill the buffer. AudioFlinger never calls into app code | Low-latency, games |
| Offload | `AudioTrack.Builder.setOffloadedPlayback(true)` + compressed `AudioFormat` | Encoded frames go to an OffloadThread; the DSP decodes | Long compressed media |

If the app’s write rate is slower than real time, Flinger underruns. That is an app-layer data-path bug that *looks* like a HAL glitch.

### 4. Performance modes and thread selection

`AudioTrack` performance / flags influence whether you land on:

- **Normal mixer** (larger period, power saving, deep buffer)
- **Fast mixer** (small period, stricter callbacks)
- **Direct** (exclusive, no software mix)
- **Offload** (DSP decode)

You cannot demand “fast” and also demand heavy effects and arbitrary rates on every product. Policy will fall back. Always check which thread type you actually got.

### 5. Permissions and attribution (capture)

`AudioRecord` can fail for reasons that are not ALSA:

- Missing `RECORD_AUDIO`
- Runtime permission denied
- Privacy indicators / concurrent capture policy
- AppOps
- Wrong source for background capture

A create failure here is often **framework policy**, not a broken microphone.

### 6. What the app does *not* control

Apps do not choose:

- The PCM card number
- The AAOS bus address (except indirectly via usage, zone extras, or privileged APIs)
- The mixer period
- Whether ducking happens (they can request focus; they do not implement cabin ducking)

If an app hardcodes `STREAM_MUSIC` forever, it is giving Policy a coarse, legacy key. Prefer `AudioAttributes`.

## Source-Code Path

```text
frameworks/base/media/java/android/media/AudioTrack.java
frameworks/base/media/java/android/media/AudioRecord.java
frameworks/base/media/java/android/media/AudioAttributes.java
frameworks/base/media/java/android/media/AudioFormat.java
frameworks/base/media/java/android/media/MediaPlayer.java

JNI:
frameworks/base/core/jni/android_media_AudioTrack.cpp
frameworks/base/core/jni/android_media_AudioRecord.cpp

Native client:
frameworks/av/media/libaudioclient/AudioTrack.cpp
frameworks/av/media/libaudioclient/AudioRecord.cpp
frameworks/av/media/libaudioclient/AudioSystem.cpp

AAudio (NDK):
frameworks/av/media/libaaudio/
```

Read `AudioTrack::createTrack_l` (name may vary slightly) until you see the Binder call into AudioFlinger. That is the process boundary.

## Debugging

### Prove the client exists

```text
Need:
1. Constructor succeeded (no exception / init check OK)
2. play() or startRecording() called
3. Session ID
4. Usage / source
5. Sample rate, channels, encoding
6. Whether write/read is actually happening
```

App-side instrumentation that is legal and useful:

```java
int session = track.getAudioSessionId();
int state = track.getPlayState();   // PLAYSTATE_PLAYING?
int result = track.write(buf, 0, buf.length);
// log session, state, result, underrun count if API available
```

`write` returning 0 or negative is an immediate failure at the client. Do not go to the codec.

### Join to Flinger

```bash
adb shell dumpsys media.audio_flinger
```

Find the session. Confirm:

- Thread type
- Track state (`ACTIVE`, `PAUSED`, `STOPPED`)
- Format matches the app
- Frames written increase

If the app is PLAYING and Flinger has no session, you are looking at the wrong user, a crashed `audioserver` that restarted, or a player that never created a track (decoder stuck).

## Logs / Commands

```bash
adb logcat -s AudioTrack AudioRecord AudioManager AudioFlinger
# app tag as well
```

What you expect to see on a healthy start (messages vary by version):

```text
A create/open log with sample rate, channel mask, format
A start log
Subsequent writes without repeating EINVAL
```

What indicates a problem:

```text
createTrack failed
getOutputForAttr returned 0 / error
play() in state uninitialized
write() ERROR_DEAD_OBJECT   → audioserver died
permission denial on AudioRecord
```

`ERROR_DEAD_OBJECT` means the Binder target died. Restart of `audioserver` is the next fact to confirm (`ps`, tombstones), not a codec register.

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Debugging MediaPlayer as if it had its own HAL | It feeds a track |
| Using `STREAM_MUSIC` and wondering why AAOS routing is wrong | Usage/context mapping needs proper attributes |
| Assuming `play()` starts hardware immediately | The HAL stream is already open, but it may be in standby; leaving standby (`Command.start`, vendor PCM/graph restart, amp ramp) costs time |
| Ignoring `write()` return value | That is your data-path heartbeat |
| Comparing AAudio “exclusive MMAP” behavior to mixer tracks | Different thread, different XRUN physics |
| Thinking session ID is the UID | Session is per-track group; UID is the app identity |

## Practice

An app logs:

```text
AudioTrack created session=129 rate=44100 ch=2 fmt=PCM_16BIT usage=USAGE_ASSISTANCE_NAVIGATION_GUIDANCE
playState=PLAYSTATE_PLAYING
write() returns 2048 repeatedly
```

Flinger dump shows session 129 ACTIVE on a BUS `bus1_navigation_out`. The user tests with the media volume knob and hears no change. Music is also playing.

1. Is the track healthy?
2. Why might the media knob do nothing to this stream?
3. Which module do you open next?

Expected:

1. Yes — create, start, and data are healthy. Last-known-good is at least Flinger.
2. On AAOS, navigation is often another **volume group**. The media knob is the wrong group.
3. Module 05 (attributes/usage) and Module 13 (volume groups). Not the codec.

## Key Takeaways

1. Almost every player is an AudioTrack producer.
2. Construction is already a policy transaction.
3. Session ID and UID are how you join app to Flinger.
4. `write()`/`read()` return values are evidence.
5. Performance flags pick a thread type; you must verify what you got.

## Next

[Module 05 — AudioAttributes, Usage, and Focus](05-audio-attributes-usage-and-focus.md)
