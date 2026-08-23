# Reference Platform

This course reasons about **one default world**. If your board is older, translate backward using [Module 23](modules/23-android-version-evolution.md). Do not translate the course forward from HIDL.

## Default product

| Item | Value |
| --- | --- |
| Android | **15 and higher** |
| Core Audio HAL | **Stable AIDL** `android.hardware.audio.core` |
| Effects HAL | **AIDL** `android.hardware.audio.effect` |
| HAL service name (AOSP) | `vendor.audio-hal-aidl` (see `audioserver.rc`) |
| Policy topology | Served by **`IModule` + `IConfig`**, not consumed by APM as the only XML contract |
| Stream I/O | **`StreamDescriptor`**: FMQ audio + command/reply queues (`burst`, `start`, `standby`, …) |
| AAOS | **15**, `car_audio_configuration.xml` **version 4** |
| AAOS fade | `car_audio_fade_configuration.xml` + RRO `audioUseFadeManagerConfiguration` (default off) |
| AAOS routing switch | `audioUseDynamicRouting` = true |
| CAP engine | Optional (`useCoreAudioVolume` / `useCoreAudioRouting`). On **Android 15** CAP data is still commonly XML-backed; **full CAP-over-AIDL is Android 16+** |

## What “AIDL-first” means when you debug

```text
AudioFlinger / AudioPolicy
        ↓  libaudiohal (AIDL client)
IModule  (instance "default", "bluetooth", "r_submix", …)
        ↓
openOutputStream / openInputStream
        ↓
IStreamOut / IStreamIn + IStreamCommon
        +
StreamDescriptor
   command FMQ   →  start / burst / standby / pause / flush / drain
   reply   FMQ   ←  state, latencyMs, xrunFrames, observable position
   audio   FMQ   ↔  PCM (or mmap buffer)
        ↓
Vendor implementation → TinyALSA / PAL / DSP
```

You no longer describe the data path as “HIDL `IStreamOut.write()`.” The AIDL data path is **`Command.burst` against `audio.fmq`**, with stream **state** (`STANDBY`, `IDLE`, `ACTIVE`, `PAUSED`, `DRAINING`, `ERROR`, …) defined in `StreamDescriptor.aidl`.

## What Android 15 is *not*

| Claim | Reality |
| --- | --- |
| “Android 15 deleted HIDL audio.” | Framework still *can* talk to a HIDL vendor HAL. This course does not treat that as the reference. New APIs after 14 are AIDL-only. |
| “There is no XML left.” | `car_audio_configuration.xml` is still the AAOS map. A default AIDL `IConfig` may convert leftover policy XML internally. CAP on 15 is often still file-based. |
| “CAP is fully AIDL on 15.” | Official full CAP-over-AIDL is documented from **Android 16**. Do not invent 15 CAP AIDL calls. |
| “`IDevice` is the Core HAL.” | That is HIDL. AIDL renamed it to **`IModule`**. |

## Classification one-liner (write this on every bug)

```text
Android 15 AAOS, AIDL Core HAL (vendor.audio-hal-aidl),
car XML v4, fade flag=?, CAP flags=?, vendor DSP=?
```

If `lshal` shows `android.hardware.audio@7.1` and no `android.hardware.audio.core.IModule`, you are **not** on this course’s reference HAL. Say so, then use Module 23 to translate.

## Source roots (search these first)

```text
hardware/interfaces/audio/aidl/android/hardware/audio/core/
  IModule.aidl
  IConfig.aidl
  IStreamOut.aidl  IStreamIn.aidl  IStreamCommon.aidl
  StreamDescriptor.aidl
  ITelephony.aidl  IBluetooth.aidl
hardware/interfaces/audio/aidl/android/hardware/audio/effect/
system/hardware/interfaces/media/aidl/android/media/audio/common/
hardware/interfaces/audio/aidl/default/
frameworks/av/media/libaudiohal/
frameworks/av/services/audioflinger/
frameworks/av/services/audiopolicy/
packages/services/Car/service/src/com/android/car/audio/
device/generic/car/emulator/audio/     # v4 + fade examples
```

## Lab and workbook

- Capture real dumps: [labs/README.md](labs/README.md)
- Annotate teaching dumps: [workbook/README.md](workbook/README.md)
