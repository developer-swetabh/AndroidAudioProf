# Audio lab — capture the minimum dump set

Use this on an **Android 15** device or emulator while the symptom is happening. The script writes a timestamped folder you can attach to a bug or to a workbook-style annotation.

## What it collects (and why)

| File | Why |
| --- | --- |
| `00_fingerprint.txt` | Build, SDK, fingerprint — dumps without this are from another world |
| `01_hal_classification.txt` | Proves AIDL `IModule` vs leftover HIDL |
| `02_audio_flinger_t0.txt` | Execution photograph |
| `03_audio_flinger_t1.txt` | Second photograph (~1 s later) so counters can move |
| `04_audio_policy.txt` | Decision photograph (ports, routes, mixes) |
| `05_audio_service.txt` | Java focus / volume / devices |
| `06_car_audio.txt` | Zones, groups, contexts (empty-ish on phones — that is OK) |
| `06b_car_media.txt` | CarMediaService (source switch / prefs race). Empty on phones — OK |
| `07_logcat_ring.txt` | Last ~4000 `threadtime` lines, buffers `main,system,crash` (unfiltered) |
| `07_logcat_threadtime.txt` | Same ring, split: AOSP/client tags then Qualcomm-like vendor tags |
| `08_asound.txt` | Cards, PCM list, first playback `status` if sysfs exists |
| `NOTES.txt` | Template for your symptom sentence |

Logcat cannot take glob tags (`AHAL_*`, `pal_stream*`). The script parses the **tag field** of `threadtime` (not the whole line — so `pal` will not match “application”).

**AOSP / client**

| Tag | Why |
| --- | --- |
| `AAudio` / `AAudioStream` | Native client (Oboe usually still logs as AAudio) |
| `AudioTrack` / `AudioRecord` / `AudioManager` / `AudioService` | Java client and service |
| `AudioFlinger` / `FastMixer` / `AudioHwDevice` | Execute / HAL wrapper |
| `APM_AudioPolicyManager` / `AudioPolicyService` / `android.hardware.audio` | Decide + AIDL binder |
| `CarAudioService` / `CarAudioFocus` / `CAR.MEDIA` | AAOS routing, focus, car media |
| `MediaSessionService` / `MediaFocusControl` / `VolumeShaper` / `FadeOutManager` | Session, focus, fade |

**Qualcomm-like (vendor — names vary by CAF branch)**

| Tag / prefix | Why |
| --- | --- |
| `AHAL_*` | QTI AIDL HAL stream/module (`AHAL_StreamOut_QTI`, …) |
| `PAL` / `PalClient` / `PalStream` / `pal_stream*` | PAL is **HLOS**. Stream type is often in the *message* (`StreamPCM`) with tag `PAL`. Not a DSP log. |
| `AGM` / `agm_server` / `AGM_*` | Audio Graph Manager — graph PAL asked for. Typical tag is `AGM`, not `agm_pcm`. |
| `SessionAlsa*` / `GSL` | PAL session → ALSA/GSL toward the DSP on some chips |
| `ACDB` / `GPR` / `APR` | Cal / IPC crumbs in logcat. **ADSP/AFE still wants QXDM/QCAT.** |

If your BSP prints a different tag, copy that string from `07_logcat_ring.txt` — do **not** invent PAL module IDs. QXDM last, and only after AOSP dumps look mixed/healthy.

It does **not** grab 200 MB of logcat or vendor DSP traces.

## How to run

```bash
# from the repo, with adb connected
chmod +x labs/capture_audio_lab.sh

# start the failing playback first, then:
./labs/capture_audio_lab.sh

# optional label
./labs/capture_audio_lab.sh --label nav-silent-after-call

# specific serial
./labs/capture_audio_lab.sh -s emulator-5554
```

Output lands in `labs/captures/<timestamp>_<label>/`.

## After capture

1. Confirm `01_hal_classification.txt` looks like **AIDL** (`IModule` / `audio.core`). If it is HIDL `@7.x`, write that on the bug and translate names (Module 23).
2. Diff the two Flinger dumps. Frozen frames = no data-path motion.
3. Join Flinger device **address** to Policy ports and to `06_car_audio.txt` context map.
4. Annotate using the [workbook](../workbook/README.md) method.

## Privacy

Dumps can include app UIDs, session IDs, and sometimes file paths. Treat `labs/captures/` as confidential. The script does not enable tee sink and does not pull `/data/misc/audioserver` WAVs.
