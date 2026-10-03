# Case 06 — AA → Radio overlap on a shared media bus

> **Illustrative:** the dumps and logs in this case are teaching reconstructions, not captures from a real device. Field names follow Android 15 AIDL + AAOS; exact `dumpsys` text varies by build.

Real hardware bring-up. Android Auto (Spotify) and radio both use **`BUS00_MEDIA`**. Tester hears ~300 ms of both on source switch to radio.

This case exists so you do **not** recommend a bus mute (that would kill radio too).

## Classification

```text
Android 15 AAOS, AIDL IModule
car_audio_configuration.xml version=4
audioUseDynamicRouting=true
Both AA (USAGE_MEDIA) and Radio routed to address=BUS00_MEDIA
```

## Timeline (from device logs)

```text
T0      User selects source = Radio
T0+ε    Radio requestAudioFocus(GAIN)     // winner
        AA has not abandonAudioFocus() yet
T0+…    AHAL_Streamradio: start
T0+…    AHAL_Streamradio: transfer        // radio PCM entering the mix
T0+260  AA still bursting remaining buffer
T0+300  AA stops / abandonAudioFocus()
        Overlap window ≈ 300 ms
```

## Focus / fade gates

```text
AA AudioFocusInfo grant flag:
  AUDIOFOCUS_FLAG_PAUSES_ON_DUCKABLE_LOSS
  (setWillPauseWhenDucked(true))

FadeOutManager.canCauseFadeOut(requester, loser):
  if (loser has PAUSES_ON_DUCKABLE_LOSS) return false;
  // AOSP log: "not fading out: loser has PAUSES_ON_DUCKABLE_LOSS"

So: car fade XML is installed, but this LOSS does not fade AA.
AA promised to pause; it actually drained ~300 ms of client/mixer buffer.
```

## Flinger / HAL (ideas)

```text
ONE MixerThread  address=BUS00_MEDIA  State=ACTIVE
  Track uid=AA      MEDIA   ACTIVE vol=1.0  frames still moving
  Track uid=Radio   MEDIA   ACTIVE vol=1.0  AHAL_Streamradio transfer
```

## Your annotation (do this before the answer key)

```text
Why is a HAL/DSP mute of BUS00_MEDIA the wrong lever?
What does request-before-abandon actually prove?
Why did applyFadeConfigs alone not change the cabin?
What does VolumeShaper on the *losing player* do to the 250 ms after a 50 ms fade?
Five-line RCA:
```
