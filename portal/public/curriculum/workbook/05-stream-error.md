# Case 05 — Media create succeeds, then immediate silence

> **Illustrative:** the dumps and logs in this case are teaching reconstructions, not captures from a real device. Field names follow Android 15 AIDL + AAOS; exact `dumpsys` text varies by build.

A new 8-channel media bus was added. 2-channel speaker path still works. The media app does not crash.

## Classification

Android 15 AAOS, AIDL `IModule/default`, car XML v4.

Car map: `MUSIC → bus0_media_out`.
`IModule.getAudioPorts()` advertises `bus0_media_out` with profile **8ch 48 kHz PCM_16**.

## AudioFlinger

```text
Thread MIXER bus0_media_out 48000 Hz ch=8
  software standby=no
  StreamDescriptor.state=ERROR
  StreamDescriptor.xrunFrames=0
  observable.frames=UNKNOWN
  Track session=77 uid=10080 ACTIVE usage=MEDIA
    framesWritten increasing   ← client still writing
    underrun climbing
```

## logcat (ideas)

```text
IModule.openOutputStream OK  address=bus0_media_out ch=8 rate=48000   (at boot: bus outputs are opened when APM loads)
Command.start STATUS_OK
Command.burst STATUS_OK (first)
<vendor> pal/graph or pcm_write: EINVAL / AFE start failed
Command.burst STATUS → stream enters ERROR
```

## Your annotation

```text
Did Policy lie? (port exists, 8ch advertised)
Did Flinger fail to start the track?
What does StreamDescriptor.ERROR allow next?
AOSP hypothesis vs vendor hypothesis?
Which dump proves the samples never became analog?
```
