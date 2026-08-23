# Case 04 — First seatbelt chime missing after idle

Engineering-mode continuous tone on the system bus is fine. After 10 minutes parked, the first one-shot chime is missing; the second (1 s later) is heard.

## Classification

Android 15 AAOS, AIDL, car XML v4. System sounds → `bus7_system_sound_out`.

## Timeline

```text
T+0.000  chime app AudioTrack.play() session=201 usage=ASSISTANCE_SONIFICATION
T+0.008  Flinger track ACTIVE on bus7
T+0.010  StreamDescriptor.State still STANDBY  (t0 dump)
T+0.040  chime PCM ends (200 ms WAV)
T+0.180  StreamDescriptor.State=ACTIVE  observable.frames starts moving
T+1.000  second chime, State already ACTIVE, audible
```

## AudioFlinger just after the first play() (t0)

```text
Thread MIXER bus7_system_sound_out
  software standby=yes → leaving
  StreamDescriptor.state=STANDBY
  Track session=201 ACTIVE vol=1.0 framesWritten=9600  (app already finished)
```

## Tee sink on a lab image (first chime)

```text
WAV contains the chime PCM (not zeros)
```

## Scope (lab)

```text
amp EN for system slots rises at T+0.170
```

## Your annotation

```text
Is this an XRUN?
Last-known-good for the first chime's *samples*?
Which AIDL command is late relative to the one-shot?
Bad fix vs good fix?
Five-line RCA:
```
