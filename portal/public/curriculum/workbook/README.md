# Dump workbook (Android 15 / AIDL / AAOS v4)

Practice finding **last-known-good** from photographs. Do not open the [answer key](ANSWER_KEY.md) until you have written the five RCA lines for a case.

## How these dumps are written

These are **teaching reconstructions**. Field *ideas* match Android 15 AIDL + AAOS (thread, session, BUS address, `StreamDescriptor.State`, car context map, fade flag). Exact `dumpsys` banners change by build. On a real device, hunt the same ideas (Module 20).

Reference platform: [../REFERENCE_PLATFORM.md](../REFERENCE_PLATFORM.md).

## Method (every case)

```text
1. Classify: Android 15? AIDL IModule? car XML v4?
2. What usage / zone / address is expected?
3. Is the track ACTIVE? Did frames move (t0 vs t1)?
4. Does Flinger address match the car context map?
5. What is StreamDescriptor.State? (STANDBY / ACTIVE / ERROR)
6. Write last-known-good + three hypotheses on different layers
7. Only then open ANSWER_KEY.md
```

## Cases

| Case | File | Skill |
| --- | --- | --- |
| 01 | [01-healthy-media.md](01-healthy-media.md) | What “good” looks like |
| 02 | [02-wrong-usage.md](02-wrong-usage.md) | Usage vs bus |
| 03 | [03-shared-bus-no-duck.md](03-shared-bus-no-duck.md) | Concurrency physics |
| 04 | [04-standby-first-chime.md](04-standby-first-chime.md) | Cold start / STANDBY |
| 05 | [05-stream-error.md](05-stream-error.md) | AIDL `ERROR` vs Policy |
| 06 | [06-aa-radio-same-bus-overlap.md](06-aa-radio-same-bus-overlap.md) | Shared bus, focus vs fade, pause-on-duck flag |
| 07 | [07-carmedia-prefs-init-race.md](07-carmedia-prefs-init-race.md) | 3/10 race above Flinger: CarMedia prefs / user init |
| 08 | [08-assistant-ignores-focus-loss.md](08-assistant-ignores-focus-loss.md) | Exclusive LOSS ignored; framework mute workaround |

Capture your own: [../labs/README.md](../labs/README.md).
