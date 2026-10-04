# Module 26 — Android 15 AIDL Reference

## Short Answer

This is the pocket HAL card for the course default. If you need a method name, start here, then open the `.aidl` at the course tag `android-15.0.0_r36` ([hardware/interfaces at that tag](https://android.googlesource.com/platform/hardware/interfaces/+/refs/tags/android-15.0.0_r36/audio/aidl/android/hardware/audio/core/)). Do not invent HIDL twins.

## Mental Model

Three channels per opened stream:

```text
Binder (IStream*)     = control that can be slow
command FMQ           = start / burst / standby / pause / flush / drain / getStatus
audio FMQ or mmap     = the samples
reply FMQ             = state, bytes, position, latency, xruns
```

Plus a **module** that owns ports and patches, and a **config** object that owns system-wide lists.

## IModule — what Policy and Flinger actually call

Documented mapping (source.android.com AIDL vs HIDL comparison). Hunt these in `IModule.aidl`:

| Job | AIDL |
| --- | --- |
| List topology | `getAudioPorts` |
| One port | `getAudioPort` |
| External jack/USB/BT attach | `connectExternalDevice` / `disconnectExternalDevice` |
| Possible connections | `getAudioRoutes` |
| Live connection | `setAudioPatch` / `resetAudioPatch` / `setAudioPortConfig` |
| Open playback | `openOutputStream` |
| Open capture | `openInputStream` |
| Master volume/mute/mic mute | `IModule.*` (same ideas as old IDevice) |
| Screen / mode broadcast | `updateAudioMode` / `updateScreenRotation` / `updateScreenState` |
| Vendor bag | `getVendorParameters` / `setVendorParameters` |
| Device effect | `addDeviceEffect` / `removeDeviceEffect` |
| HW AV sync | `generateHwAvSyncId` |
| Microphones | `getMicrophones` |

Primary module instance name: **`default`**. Others: **`bluetooth`**, **`r_submix`**, plus vendor modules.

`ITelephony` and `IBluetooth` are retrieved from the primary `IModule`.

## StreamDescriptor commands

Client writes **one** command; HAL replies **one** reply.

| Command | Role |
| --- | --- |
| `getStatus` | No side effects. Return state, positions, counters. |
| `start` | Leave standby/idle toward active (see state machine diagrams in the IDL comments). |
| `burst` (int bytes) | The I/O primitive. Output: consume up to N bytes from `audio.fmq`. Input: produce up to N bytes into it. HAL **must read/write the entire FMQ contents** and report consumed/produced in `reply.fmqByteCount` (may be ≤ requested). |
| `standby` | Both sides inactive. Hardware may sleep. Buffer must be treated as empty. |
| `pause` | Consumer inactive. |
| `flush` | Drop pending output. |
| `drain` | Play out remaining output (`DRAIN_ALL` or `DRAIN_EARLY_NOTIFY`). |

Reply fields you will use in debugging:

| Field | Meaning |
| --- | --- |
| `status` | Binder-style: OK, BAD_VALUE, INVALID_OPERATION, NOT_ENOUGH_DATA |
| `fmqByteCount` | Bytes actually moved on this burst |
| `observable` | Presentation (out) or capture (in) position; never reset; `UNKNOWN = -1` |
| `hardware` | MMAP pointer |
| `latencyMs` | Or `LATENCY_UNKNOWN = -1` |
| `xrunFrames` | Frames lost on the **previous** transfer |
| `state` | `STANDBY` … `ERROR` |

## Burst sequence (output) — memorize

From the official `StreamDescriptor.aidl` comments:

```text
1. Client writes PCM into audio.fmq
2. Client writes Command.burst on command FMQ; waits on reply FMQ
3. HAL high-priority thread wakes
4. HAL reads command + ALL bytes currently in audio.fmq
   (even bytes it will not play — FMQ is not a store)
5. HAL writes Reply (status, fmqByteCount, positions, xrunFrames, state)
6. Client wakes and reads the reply
```

If the vendor thread is not high priority, you will see `xrunFrames` climb with a “healthy” Flinger mix. That is a HAL scheduling bug, not an app underrun.

Async mode: after burst the state may be `TRANSFERRING`; client must wait for `IStreamCallback.onTransferReady` before the next burst.

MMAP no-IRQ: burst value is 0; samples live in `audio.mmap`; burst only refreshes positions/latency.

## IConfig — what used to be XML globals

| HIDL-era XML idea | AIDL |
| --- | --- |
| Engine / volumes / product strategies | `IConfig.getEngineConfig` |
| Surround formats for UI | `IConfig.getSurroundSoundConfig` |
| Call-screen / supported modes | `ITelephony.getSupportedAudioModes` (+ engine config) |

`speaker_drc_enabled` is gone; docs say DRC is assumed enabled.

Default AIDL HAL contains an XML→AIDL converter. On a 15 bring-up you may still *edit* XML, but APM’s source of truth is whatever `IConfig`/`IModule` return. Dump Policy ports after a converter change; do not assume the file and the API agree until you have seen both.

## CAP on 15 vs 16 (do not mix)

| | Android 15 (this course) | Android 16+ |
| --- | --- | --- |
| Core HAL | AIDL | AIDL |
| Policy ports/routes | AIDL `IModule`/`IConfig` | AIDL |
| CAP engine data | Typically still XML / parameter-framework files if CAP is enabled | CAP structures documented on the AIDL HAL (`AudioHalCapConfiguration.aidl`) |
| AAOS CAP flags | `audioUseCoreVolume` / `audioUseCoreRouting` (14+) | Same flags, AIDL-backed config possible |

If you are on 15, do not cite `AudioHalCapConfiguration` as if APM is calling it. That is the 16 sentence.

## AAOS 15 on top of this HAL

Unchanged roles, 15 contracts:

```text
car_audio_configuration.xml version="4"
  zones / zoneConfigs / volumeGroups / context → address
  applyFadeConfigs / fadeConfig  → names in car_audio_fade_configuration.xml

audioUseDynamicRouting = true
audioUseFadeManagerConfiguration = false unless OEM enables fade
```

Addresses in the car XML must exist as **device ports** the AIDL module advertises (whatever converter or hand-written `getAudioPorts` you use). A typo is now “HAL port list vs car XML,” not “two XML files APM parsed.”

## Debugging commands (15 / AIDL)

```bash
# Classification
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk          # 35 for Android 15
adb shell service list | grep -i 'audio.core\|audio.effect\|audiocontrol'
adb shell dumpsys media.audio_flinger | head

# Restart HAL (eng/userdebug; must be implemented)
adb shell setprop sys.audio.restart.hal 1

# State photographs
adb shell dumpsys media.audio_flinger
adb shell dumpsys media.audio_policy
adb shell dumpsys car_service --services CarAudioService
```

## Practice

Map each HIDL habit to AIDL in one line:

1. `IDevice.setConnectedState(AVAILABLE)` for USB
2. `out->write(buffer, bytes)`
3. `out->standby()`
4. Parse `audio_policy_configuration.xml` in APM
5. `IPrimaryDevice.setMode(IN_CALL)`

Expected:

1. `IModule.connectExternalDevice`
2. Fill `audio.fmq` + `Command.burst`
3. `Command.standby`
4. `IModule.getAudioPorts` / `getAudioRoutes` + `IConfig.getEngineConfig` — called by AudioFlinger's libaudiohal, which hands the result to APM (`getAudioPolicyConfig` → `loadFromApmAidlConfigWithFallback`)
5. `ITelephony.switchAudioMode` and `IModule.updateAudioMode` on modules

## Key Takeaways

1. `IModule` + `IConfig` + `StreamDescriptor` are the 15 HAL spine.
2. `burst` is the I/O; `standby` is the power gate; `ERROR` is terminal.
3. HAL must service commands on a high-priority thread.
4. Policy topology is an API. XML is optional implementation.
5. CAP-over-AIDL is 16+; do not confuse it with 15.

## Next

[Module 09 — ALSA](09-alsa-tinyalsa-and-pcm.md) or the [workbook](../workbook/README.md).
