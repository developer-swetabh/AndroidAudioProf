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
| `07_logcat_ring.txt` | Last ~2000 `threadtime` lines (unfiltered ring) |
| `07_logcat_threadtime.txt` | Same ring, filtered to the audio tags below |
| `08_asound.txt` | Kernel PCM list if the shell can see it |
| `NOTES.txt` | Template for your symptom sentence |

Logcat filter tags in `07_logcat_threadtime.txt`:

| Tag | Why |
| --- | --- |
| `AudioTrack` / `AudioRecord` / `AudioManager` / `AudioService` | Client and Java service |
| `AudioFlinger` / `APM_AudioPolicyManager` | Native execute / decide |
| `CarAudioService` / `CarAudioFocus` / `CAR.MEDIA` | AAOS routing, focus, car media |
| `MediaSessionService` / `MediaFocusControl` | Media session + phone-style focus |
| `android.hardware.audio` | AIDL HAL binder side |
| `AHAL_StreamOut_QTI` and any `AHAL_*` | Qualcomm AIDL HAL stream/module (vendor; prefix match) |

`AHAL_*` cannot be passed to `logcat` as a glob. The script keeps every ring line whose tag starts with `AHAL_`.

It does **not** grab 200 MB of logcat or vendor DSP traces. Add those only after last-known-good says you need them.

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
