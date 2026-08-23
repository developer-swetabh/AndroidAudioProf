# Workbook answer key

Read this **after** you write your own five lines. If you only read this, you practiced nothing.

---

## Case 01 — Healthy media

**Last-known-good:** Through AIDL `StreamDescriptor.ACTIVE` on `bus0_media_out`. Analog is not proven (no scope), but nothing in software contradicts cabin sound.

**Nav thread:** `STANDBY` is correct. No nav track. Not a bug.

**Frames:** 528000 − 480000 = 48000 frames in ~1 s at 48 kHz → real-time data path.

**Consistency:** Flinger software standby=no and AIDL state=ACTIVE agree. On the nav thread, standby=yes and STANDBY agree.

**Takeaway:** Learn this shape so cases 02–05 look *wrong* immediately.

---

## Case 02 — Wrong usage

```text
Symptom:            Nav volume knob does nothing; nav may be buried in media
Immediate failure:  Nav PCM is on the MUSIC bus
Root cause:         App set USAGE_MEDIA (content=SPEECH does not create NAVIGATION)
Contributing:       No attribute check in the nav APK review
Fix:                USAGE_ASSISTANCE_NAVIGATION_GUIDANCE; confirm session on bus1
Layer:              Application
```

Not an `IModule` bug. `bus1` is correctly asleep. Focus shows two MEDIA holders — CarAudio is consistent with the attributes it was given.

---

## Case 03 — Shared bus, no hardware duck

```text
Symptom:            Both streams full-scale; clip
Immediate failure:  One Flinger mix, one IModule stream, two tracks at vol=1.0
Root cause:         v4 XML mapped MUSIC and NAVIGATION to the same address
Contributing:       useFixedVolume → Flinger will not duck PCM
Fix:                Split navigation to its own bus in car XML *and* IModule ports;
                    implement HAL/DSP duck of media bus; keep CONCURRENT MAY_DUCK
Layer:              AAOS configuration + HAL gain (not the DSP “mixer” of one PCM)
```

DSP sees **one** PCM. Hardware duck is impossible until there are two streams.

---

## Case 04 — First chime / STANDBY

```text
Symptom:            First chime after idle missing
Immediate failure:  Analog unmute after the one-shot already finished
Root cause:         Stream stayed STANDBY / amp EN late vs 200 ms WAV
                    (cold start after standby)
Contributing:       System bus fully tears down; chime is shorter than bring-up
Fix:                Warm the chime path, shorten IModule start+unmute, or pre-roll
                    silence; do not disable all standby
Layer:              HAL bring-up / power policy for bus7
```

Not an XRUN (`xrunFrames` not the story). Tee sink proves Flinger had samples — last-known-good is digital mix. Missing `Command.start`/`burst` completion + analog EN is the late part.

---

## Case 05 — Stream ERROR

```text
Symptom:            8ch media silent; 2ch still works
Immediate failure:  StreamDescriptor.State=ERROR after first burst
Root cause:         Vendor path cannot run the 8ch use case it advertised
                    (PCM/AFE/graph). Port list claimed 8ch anyway.
Contributing:       IModule profile lie — Policy/Flinger legally opened 8ch
Fix:                Either implement 8ch on that AFE/PCM *or* advertise only
                    2ch and let the framework upmix. Then reopen.
Layer:              Vendor HAL / DSP / ALSA — plus honest getAudioPorts()
```

Policy did not “fail.” It believed `getAudioPorts()`. Flinger track ACTIVE with rising `framesWritten` is the client still pushing into a dead stream. AIDL `ERROR` is **terminal** — close/reopen after the vendor fix. `observable.frames=UNKNOWN` means no honest hardware position.

AOSP hypothesis (wrong bus) is **killed** by address + ACTIVE 8ch thread. Vendor hypothesis lives.

---

## Case 06 — AA → Radio, same bus, ~300 ms overlap

```text
Symptom:            AA and radio both audible ~300 ms after source = Radio
Immediate failure:  Two MEDIA tracks mixed on BUS00_MEDIA at vol=1.0
                    AHAL_Streamradio transfer while AA still bursting
Root cause:         No per-track mute of the loser at LOSS.
                    AA holds PAUSES_ON_DUCKABLE_LOSS, so
                    FadeOutManager.canCauseFadeOut() returns false.
                    AA's "pause" is a ~300 ms buffer drain.
Contributing:       Shared bus (cannot HW-duck or bus-mute).
                    Radio requestAudioFocus before AA abandon is normal.
Fix:                (1) v4 applyFadeConfigs + ~50 ms fadeOut so the
                    losing *player* is VolumeShaped to 0 (bus stays up).
                    (2) Allow fade even when the loser set
                    PAUSES_ON_DUCKABLE_LOSS if that player is still STARTED
                    (AA-only package check works; a "still STARTED" rule
                    is the better long-term gate).
Layer:              Focus/fade (framework) + car fade XML — not Policy XML
                    routing, not a codec path, not Spotify.
```

**Wrong lever:** `Command.standby` / DSP mute of `BUS00_MEDIA`. Radio uses that bus.

**Why 50 ms beats a 300 ms tail:** after the ramp, the shaper holds at digital 0. Remaining AA frames may still be mixed; the cabin should not hear them.

**Regressions to watch:** `isDefault` 50 ms on *all* losses; fade-in hole Radio→AA; `canBeFadedOut()` still blocks AAudio/speech; next projection package if you special-case one APK.

AOSP `canCauseFadeOut()` literally skips fade when the loser has `AUDIOFOCUS_FLAG_PAUSES_ON_DUCKABLE_LOSS`. There is an AOSP TODO suggesting a short fade instead of a skip.

---

## Case 07 — 3/10 no music after source switch (CarMedia init)

```text
Symptom:            After AA↔Radio↔USB (any direction), no music. 3/10.
Immediate failure:  CarMedia did not restore/start the selected source
                    (MediaConnection / last-source play never happened).
Root cause:         SharedPreferences for save/restore were never
                    initialized. onUserVisible() did not run on the
                    failing trials, so initUser()/maybeInitSharedPrefs()
                    never ran. mPendingInit was not set, so unlock
                    did not catch up either.
Contributing:       User CE storage is unavailable until unlock.
                    Source switch can race user VISIBLE.
                    Focus succeeding hid the real owner (CarMedia).
Fix:                If the user play-context is not created / not
                    initialized, set mPendingInit = true so the next
                    unlock/visible path calls initUser() and arms
                    prefs + MediaConnection.
Layer:              CarMediaService (user lifecycle), not HAL, not fade.
```

**What a good engineer does here:** treat 3/10 as a race, **kill** fade/HAL when focus+AHAL look fine, then read `CAR.MEDIA` / `CarMediaService` dump: `Pending init`, `No shared preferences`, `User has not been initialized`.

**AOSP already does part of this:** `maybeInitUser()` sets `mPendingInit` when the user is **locked**, and `onUserUnlocked()` calls `initUser()` if that flag is set. The hole is any path that creates a play context or accepts a source change **without** going through `maybeInitUser()`, and without `onUserVisible()`. Arming `mPendingInit` when the context is missing is closing that hole.

**Regressions:** double `initUser()` (prefs “already set” is OK); never clearing `mPendingInit` after a successful init; starting MediaConnection twice on unlock.

This is why “I cannot name the RC without HW logs” was the correct first sentence — the symptom is identical to a silent HAL stream.

---

## Case 08 — Assistant ignores LOSS; mute in MediaFocusControl

```text
Symptom:            Assistant audible; AA BT ringtone not heard on speaker
Immediate failure:  Assistant PCM still mixed after exclusive LOSS
Root cause:         Google Assistant bug: continues playback after
                    onAudioFocusChange(LOSS). No GA source to fix.
Contributing:       AOSP auto-fade is MEDIA/GAME only; SPEECH/assistant
                    is unfadeable. Focus is cooperative for this usage.
Fix:                Workaround — use AOSP’s mute-on-focus-loss in
                    MediaFocusControl.java and apply it to the assistant
                    loser so the player is digitally muted. Ringtone
                    (CALL_RING) is a different player and stays audible.
Layer:              AudioService / MediaFocusControl (enforcement),
                    not Policy XML, not HAL, not CarMedia.
```

**Correct lever:** per-player mute after LOSS.  
**Wrong lever:** mute the shared media bus; change `CALL_RING` vs `VOICE_COMMAND` (already exclusive in AOSP).

**Usage naming:** there is no `USAGE_ASSISTANCE`. Match **`USAGE_ASSISTANT`** (and only `USAGE_ASSISTANCE_ACCESSIBILITY` if that is the same session). Do **not** mute `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE` or `USAGE_ASSISTANCE_SONIFICATION`.

**Must unmute:** when that uid/usage **regains** focus, or when the ringing/call holder abandons. Otherwise the next assistant session is silent.

**AAOS note:** CarAudioService decides exclusive vs concurrent. `MediaFocusControl` still sits in `system_server` and can mute `AudioPlaybackConfiguration` players. That is why a CarAudio LOSS that GA ignores can still be enforced here.

---

## Self-score

| You wrote… | Gate |
| --- | --- |
| Layer + join key (session/address/state) on every case | Dump literacy |
| Competing hypotheses on **different** layers | Method |
| Five RCA lines without jumping to a codec register | RCA |
| Named an AIDL command (`burst`/`standby`) in 04 or 05 | 15/AIDL fluency |
| Case 06: rejected bus mute; named the pause-on-duck fade gate | Same-bus + fade literacy |
| Case 07: did not blame HAL when focus was fine; named CarMedia prefs | Source-manager literacy |
| Case 08: exclusive LOSS + still playing → app bug; mute not bus | Focus enforcement literacy |

If case 03 became “DSP ducking bug” in your notes, reread Module 14.
