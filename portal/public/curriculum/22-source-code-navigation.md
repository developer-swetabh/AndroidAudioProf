# Module 22 — Source Code Navigation

## Short Answer

You do not memorize AOSP. You learn **entry points**, **process boundaries**, and **search keys**. The skill is: start at the API the app called, walk Binder, land in the service, and know when you have left AOSP for vendor code.

Use [cs.android.com](https://cs.android.com) on `android-latest-release` or your exact branch. File names shift; **symbols and responsibilities** last longer.

## Mental Model

```text
Application
    ↓ API
Framework service (Java)
    ↓ JNI / Binder
Native client library
    ↓ Binder
AudioFlinger / AudioPolicy
    ↓ libaudiohal
HAL interface (HIDL/AIDL)
    ↓
Vendor HAL  ← AOSP ends
    ↓
Kernel
```

At each arrow, ask: **new process? new language? new clock domain?**

## Map of important trees

| Tree | Why you open it |
| --- | --- |
| `frameworks/base/media/java/android/media/` | Public APIs: AudioTrack, AudioManager, attributes |
| `frameworks/base/services/core/java/com/android/server/audio/` | AudioService, focus, devices, settings |
| `frameworks/base/core/jni/` | JNI glue |
| `frameworks/av/media/libaudioclient/` | Native AudioTrack/AudioRecord/AudioSystem |
| `frameworks/av/media/libaaudio/` | AAudio |
| `frameworks/av/media/libaudiohal/` | HIDL/AIDL wrapper |
| `frameworks/av/services/audioflinger/` | Execution |
| `frameworks/av/services/audiopolicy/` | Decision |
| `hardware/interfaces/audio/` | HAL IDL |
| `external/tinyalsa/` | PCM userspace |
| `packages/services/Car/service/src/com/android/car/audio/` | AAOS |
| `packages/services/Car/car-lib/` | CarAudioManager |
| `hardware/interfaces/automotive/audiocontrol/` | AudioControl HAL |
| `sound/` in the **kernel** tree | ASoC/PCM |

Vendor trees are extra and optional (Module 16).

## Walk 1 — `AudioTrack.play()` to HAL write

Search these symbols in order (names close; confirm on your branch):

```text
Construction (once, before play):
android.media.AudioTrack (Builder / constructor)
    → native_setup  (android_media_AudioTrack.cpp)
    → AudioTrack::set → AudioTrack::createTrack_l  (libaudioclient)
    → IAudioFlinger::createTrack(CreateTrackRequest)  (Binder)
    → AudioFlinger::createTrack
        → AudioSystem::getOutputForAttr  (AudioFlinger asks Policy)
        → PlaybackThread::createTrack_l  → Track + audio_track_cblk_t shared memory
    → returns IAudioTrack (control only) + cblk

Start and steady state:
android.media.AudioTrack.play
    → native_start
    → AudioTrack::start  (libaudioclient)
    → IAudioTrack::start  (Binder) → TrackHandle::start
    → Track::start        (AudioFlinger, Tracks.cpp)
    → PlaybackThread::addTrack_l  (wakes the thread; AudioSystem::startOutput)
    → PlaybackThread::threadLoop
        → prepareTracks_l → threadLoop_mix → threadLoop_write
    → StreamOutHalAidl::write → StreamHalAidl::transfer  (libaudiohal)
        → if state == STANDBY: Command.start   (leave standby; stream already open)
        → StreamDescriptor.Command.burst  (audio.fmq)
    → vendor consumes burst (often pcm_write)
    → kernel PCM

Not on this path: IModule.openOutputStream. It runs when Policy opens the output
(AudioFlinger::openOutput_l → AudioHwDevice::openOutputStream), at boot / device
attach, or for direct/offload outputs inside getOutputForAttr.
```

Homework: actually click this on cs.android.com once. Note that track code lives in `Tracks.cpp` (headers `PlaybackTracks.h` / `RecordTracks.h`); there is no `PlaybackTracks.cpp`. FastMixer lives in `services/audioflinger/fastpath/`.

## Walk 2 — attributes to device

```text
AudioTrack constructor / set
    → IAudioFlinger::createTrack(CreateTrackRequest)   (the client does not call Policy)
    → AudioFlinger::createTrack
    → AudioSystem::getOutputForAttr   (called by AudioFlinger)
    → IAudioPolicyService
    → AudioPolicyService
    → AudioPolicyManager::getOutputForAttr
    → engine getDevice / dynamic mix match
    → return output io handle
```

On AAOS, before this succeeds in the car sense, `CarAudioService` already registered mixes. Read **boot** of CarAudioService, not only getOutput.

## Walk 3 — volume key to gain

```text
CarAudioManager.setGroupVolume  or  AudioManager.adjustVolume
    → CarAudioService / AudioService
    → phone:  AudioPolicy set volume index → volume curve
              → Flinger set stream/track volume
    → AAOS fixed volume: CarVolumeGroup index → gain in millibels
              → AudioManager.setAudioPortGain
              → AudioPolicy/AudioFlinger setAudioPortConfig
              → IModule.setAudioPortConfig(AudioGainConfig)   (AIDL)
```

On fixed-volume AAOS, expect the HAL branch to matter more. The HAL receives a gain in millibels on a device port, never an index.

## Walk 4 — headset insert

```text
Kernel jack / USB / BT event
    → AudioService / BtHelper
    → AudioPolicyManager::setDeviceConnectionState
        → AudioFlinger forwards to HAL: IModule.connectExternalDevice (external devices)
    → engine update → checkOutputsForDevice
    → same module (wired headset): setOutputDevices → installPatch
        → AudioFlinger::createAudioPatch → PatchPanel
        → PlaybackThread::createAudioPatch_l → IModule.setAudioPatch
    → other module (A2DP / USB): new output opened
        → AudioFlinger::openOutput → IModule.openOutputStream; tracks invalidated and moved
```

## Important Binder interfaces

Search `IAudioFlinger`, `IAudioTrack`, `IAudioRecord`, `IAudioPolicyService`, `IAudioPolicyClient`.

These are the **ABI-ish** seams. If you cannot find who implements an `I*` you are not ready to patch it.

## Threads you will meet

| Thread | Lives in | Role |
| --- | --- | --- |
| App audio thread | App | write/callback |
| Binder threads | audioserver | create/start/stop |
| MixerThread / FastMixer | audioserver | period loop |
| RecordThread | audioserver | capture |
| HAL binder / writer | vendor process | device I/O |
| ADSP (vendor) | DSP | graph |

Never do heavy work on FastMixer. Never block Binder for a full PCM drain if you can avoid it (watchdog / ANR adjacent issues in services).

## How to search without drowning

Good queries:

```text
getOutputForAttr
createTrack_l
threadLoop
setDeviceConnectionStateInt
registerPolicyMixes
setUserIdDeviceAffinity
requestAudioFocus  (then jump to CarAudioFocus on AAOS)
```

Bad queries:

```text
audio
speaker
volume
start
```

Add `-file:` filters on cs.android.com (`AudioPolicyManager.cpp`).

## Version drift survival kit

When a symbol is missing:

1. Search the idea on your **exact** tag (`android-14.0.0_rXX`, `android15-release`).
2. Check HIDL vs AIDL (Module 08, 23).
3. Check whether Car audio moved a class (helpers get renamed often).
4. Do not copy a 10-year-old blog path as truth.

Say: “On this branch the function is X; on Android 11 it was Y.” That sentence is professional.

## What is *not* in AOSP

If grep in AOSP fails for:

- `pal_stream_open`
- `ACDB_`
- your codec’s register names
- `mixer_paths.xml` path names

you are in vendor/kernel. Do not pretend you found it “in AudioFlinger.”

## Practice

Without this file, list the next hop after each:

1. `AudioManager.requestAudioFocus` on AAOS
2. `PlaybackThread` deciding to leave standby
3. `pcm_write` returning `-EPIPE`
4. `CarAudioService` reading configuration at boot

Expected:

1. AudioService → (AAOS) CarAudioService / CarAudioFocus
2. HAL stream start / `start()` on StreamOut
3. TinyALSA/ALSA XRUN handling; Flinger may count underrun / recover
4. XML parse → mix registration → later user affinity

Then open cs.android.com and verify one of them on `android-latest-release`. Write down the real file path you saw.

## Key Takeaways

1. Walk APIs across Binder; do not random-grep “audio.”
2. Memorize trees, not every filename.
3. `getOutputForAttr`, `createTrack`, `threadLoop` are the spine.
4. AOSP ends at the HAL IDL.
5. Always search your branch.

## Next

[Module 23 — Android Version Evolution](23-android-version-evolution.md)
