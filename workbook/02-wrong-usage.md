# Case 02 — “Nav is silent” (or buried)

The nav app UI is speaking. The user turns the **nav** volume group. Level does not change. Media is playing and is loud.

## Classification

Same as case 01: Android 15, AIDL `IModule/default`, car XML v4, dynamic routing on, fade off.

## App log (excerpt)

```text
AudioTrack created session=129 rate=48000 ch=2 fmt=PCM_16_BIT
  usage=AUDIO_USAGE_MEDIA content=SPEECH
  playState=PLAYSTATE_PLAYING
  write() returns 960 repeatedly
```

## CarAudioService (excerpt)

```text
Zone 0 user=10
  MUSIC → bus0_media_out  group=media index=18
  NAVIGATION → bus1_navigation_out group=navigation index=8
  Focus:
    uid=10080 usage=MEDIA gain=GAIN
    uid=10095 usage=MEDIA gain=GAIN          # nav APK, but usage=MEDIA
```

## AudioFlinger (excerpt)

```text
Thread MIXER bus0_media_out standby=no State=ACTIVE
  Track session=77  uid=10080 ACTIVE usage=MEDIA vol=1.0 frames moving
  Track session=129 uid=10095 ACTIVE usage=MEDIA vol=1.0 frames moving
Thread MIXER bus1_navigation_out standby=yes State=STANDBY
  (no tracks)
```

## Your annotation

```text
Symptom:
Immediate failure:
Which bus is session 129 on, and why?
Why does the nav knob do nothing?
Is this a HAL / IModule bug?
Five-line RCA (before the answer key):
```
