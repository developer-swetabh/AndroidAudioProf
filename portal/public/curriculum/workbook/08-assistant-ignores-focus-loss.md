# Case 08 — Assistant stays up; AA BT ringtone inaudible

> **Illustrative:** the dumps and logs in this case are teaching reconstructions, not captures from a real device. Field names follow Android 15 AIDL + AAOS; exact `dumpsys` text varies by build.

Google Assistant is already speaking. An Android Auto Bluetooth incoming call rings. Tester hears **only assistant**. Expected: assistant muted or ducked, ringtone on speaker.

This is **not** case 06 (same-bus overlap) and **not** case 07 (CarMedia init). Focus policy did evict assistant. The app did not obey.

## Classification

```text
Android 15 AAOS + AA projected BT call
Holder: Google Assistant  USAGE_ASSISTANT → VOICE_COMMAND
Incoming: ringtone, expected USAGE_NOTIFICATION_RINGTONE → CALL_RING
AOSP FocusInteraction: holder VOICE_COMMAND + incoming CALL_RING
        = INTERACTION_EXCLUSIVE
```

## What the logs showed

```text
CALL_RING request          GRANTED (exclusive)
Assistant                  received LOSS
Assistant players          still ACTIVE, still audible
Ringtone                   not heard on cabin speaker
```

So last-known-good is **CarAudioFocus / MediaFocusControl decision**.  
The failure is **above HAL**: a closed-source player that keeps writing after LOSS.

AOSP system fade (12+) only auto-fades **MEDIA/GAME**. Assistant is **VOICE_COMMAND**, often `CONTENT_TYPE_SPEECH` → `FadeOutManager` will not fade it. You cannot patch Google Assistant.

## Workaround used on the device

```text
MediaFocusControl.java
  existing AOSP mute-on-focus-loss path
  extended so a loser with assistant usage is muted
  (reported as AudioAttributes.USAGE_ASSISTANCE — see answer key)
```

Mute is **per-player / per-uid enforcement**, not a mute of `BUS00_MEDIA`. Ringtone on `CALL_RING` can still play.

## Your annotation (before the answer key)

```text
Why is this not a routing XML bug?
Why would applyFadeConfigs (case 06) likely fail here?
Why MediaFocusControl and not the HAL?
What must happen when the call ends / assistant GAIN returns?
Danger of matching every ASSISTANCE_* usage?
Five-line RCA:
```
