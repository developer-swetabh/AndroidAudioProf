# Case 01 — Healthy media (baseline)

A driver-zone media app is playing. Cabin woofers have sound. Annotate this so you know what “good” looks like.

## Classification

```text
ro.build.version.release=15
ro.build.version.sdk=35
pm has android.hardware.type.automotive=true
service: android.hardware.audio.core.IModule/default
service: android.hardware.audio.core.IModule/bluetooth
HIDL android.hardware.audio@ : (none)
car_audio_configuration version=4
audioUseDynamicRouting=true
audioUseFadeManagerConfiguration=false
```

## CarAudioService (excerpt)

```text
Zone 0 primary occupantZoneId=0 user=10
  active zoneConfig: "primary zone config 0"
  VolumeGroup name=media id=0 index=18 muted=false
    device address=bus0_media_out
    contexts: MUSIC ANNOUNCEMENT
  VolumeGroup name=navigation id=1 index=22 muted=false
    device address=bus1_navigation_out
    contexts: NAVIGATION
  VolumeGroup name=system id=2 index=12 muted=false
    device address=bus7_system_sound_out
    contexts: SYSTEM_SOUND EMERGENCY SAFETY VEHICLE_STATUS
  Focus holders:
    uid=10080 usage=AUDIO_USAGE_MEDIA gain=GAIN zone=0
```

## AudioPolicy (excerpt)

```text
Device ports:
  BUS address=bus0_media_out  profiles=48000 PCM_16_BIT OUT_STEREO
  BUS address=bus1_navigation_out  profiles=48000 PCM_16_BIT OUT_STEREO
  BUS address=bus7_system_sound_out profiles=48000 PCM_16_BIT OUT_STEREO
Dynamic mix: match USAGE_MEDIA,USAGE_GAME,USAGE_UNKNOWN → bus0_media_out (user 10)
Patch: mix:media_bus0 → device:bus0_media_out
```

## AudioFlinger t0 / t1 (excerpt)

```text
HAL: AIDL IModule/default
Output thread 0xA11 MIXER 48000 Hz ch=2 fmt=PCM_16_BIT
  device=AUDIO_DEVICE_OUT_BUS address=bus0_media_out
  software standby=no
  StreamDescriptor.state=ACTIVE
  StreamDescriptor.observable.frames t0=480000  t1=528000
  StreamDescriptor.xrunFrames=0
  StreamDescriptor.latencyMs=20
  Track session=77 uid=10080 pid=4821 ACTIVE
    usage=AUDIO_USAGE_MEDIA content=MUSIC
    vol=1.000 muted=0 underrun=0
    framesWritten t0=479000 t1=527000

Output thread 0xB22 MIXER 48000 Hz
  device=AUDIO_DEVICE_OUT_BUS address=bus1_navigation_out
  software standby=yes
  StreamDescriptor.state=STANDBY
```

## Your annotation

```text
Expected path:
Last-known-good:
Is the nav thread a problem?
What does (t1-t0) frames tell you at 48 kHz?
StreamDescriptor.State vs Flinger software standby — consistent?
```
