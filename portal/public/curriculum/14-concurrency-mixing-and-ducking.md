# Module 14 — Concurrency, Mixing, and Ducking

## Short Answer

Several mechanisms can make two sounds coexist or yield. They are **not interchangeable**:

| Mechanism | Layer | What it does |
| --- | --- | --- |
| Audio focus | AudioService / CarAudioService | Permission / prominence rules |
| Software mix | AudioFlinger | Adds PCM on the **same** output thread |
| Software duck / fade | Flinger VolumeShaper / track volume | Scales PCM |
| Hardware mix | HAL / DSP / analog | Adds two buses after separate processing |
| Hardware duck | HAL / DSP / amp gain | Scales one bus, not the other |

“Nav ducks media” can be any of the last four. If you implement the wrong one, the demo works on a headset and fails in the cabin.

## Mental Model

Two cars at an intersection (focus) vs two cars on the same trailer (software mix) vs two cars in adjacent lanes (separate buses).

- Focus decides who **may** enter.
- Routing decides whether they **share a lane**.
- Mixing/ducking decides the **relative speed/volume** if they share the road at all.

### Three-level definition: ducking

**Beginner:** Music gets quieter when nav talks.

**Engineer:** Temporary attenuation of one stream because another is more important.

**Expert:** Either a focus-driven software scale on a shared mix, or a HAL gain change on a **different** device, or AAOS 15 system fade on focus loss. Concurrent focus without separate devices **cannot** hardware-duck.

## Architecture / Flow

### The nav + media story (AAOS, designed path)

```text
Media app
  USAGE_MEDIA
  focus GAIN
  zone 0 context MUSIC
  bus0_media_out
        ↓
  AudioFlinger MixerThread A  →  HAL stream A  →  DSP media graph  →  cabin woofers

Nav app
  USAGE_ASSISTANCE_NAVIGATION_GUIDANCE
  focus GAIN_TRANSIENT_MAY_DUCK
  zone 0 context NAVIGATION
  bus1_navigation_out
        ↓
  AudioFlinger MixerThread B  →  HAL stream B  →  DSP nav graph  →  driver tweeters

CarAudioFocus: CONCURRENT (if criteria met)
HAL: optional duck of stream A gain
```

### The same story on a phone (typical)

```text
Both streams
        ↓
Often the same MixerThread (speaker or A2DP)
        ↓
Flinger mixes; media track volume lowered (duck)
        ↓
One HAL stream
```

Same user sentence. Different physics.

## Detailed Explanation

### 1. Focus outcomes vs acoustic outcomes

| Focus result | Acoustic possibilities |
| --- | --- |
| Reject | Incoming silent **if it obeys**; rude app may still play |
| Exclusive loss | Loser should pause; AAOS 15 may fade+silence anyway |
| Concurrent | Both play; duck may be HAL or none |
| Delayed | Incoming waits |

Focus never moves a bus. If both granted concurrent and both mapped to `bus0`, you get a **software mix**, even in a car.

Concurrent criteria (documented):

- Incoming asked `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`
- Current holder did not `setWillPauseWhenDucked(true)`
- Holder does not demand duck notifications in the way that forces exclusive behavior

If the media app pauses on duck, you will not hear “media under nav,” even with two buses. That is an **app choice**, not a HAL bug.

### 2. Where mixing happens

```text
Same PlaybackThread
   → Flinger mixer (sample-accurate add)
   → one HAL write

Different PlaybackThreads, different HAL streams
   → two write loops
   → HAL/DSP/analog sum
   → possibly different speakers
```

Implications:

- Shared thread: one sample rate; resampler in Flinger; one standby; one XRUN domain.
- Separate threads: independent standby (nav can wake a cold bus — first-prompt latency).
- Separate threads + same physical speaker: HAL must sum; watch clipping.

### 3. Hardware ducking needs a control surface

To duck media 12 dB when nav is active, something must:

1. Know nav is active (focus callback, AudioControl, or HAL detecting the nav stream start).
2. Know which gain to move (media bus / media graph / media amp).
3. Ramp without clicks.

If step 2’s target is “the only PCM,” you are back to software duck.

### 4. System-enforced fade (Android 15 AAOS)

Problem: focus is historically cooperative. A rude media app keeps blasting during a call.

AAOS 15 can:

- Fade out the loser
- Silence the stream
- Notify focus loss
- Fade back later (default ~2 s, OEM configurable)

Gated by RRO `audioUseFadeManagerConfiguration` (default false) and `car_audio_fade_configuration.xml`. Speech content can be marked unfadeable. This is **not** hardware ducking; it is framework VolumeShaper on the losing player.

### 5. Priority of interactions

With multiple holders, AAOS uses the most conservative interaction vs each holder: reject > exclusive > concurrent.

Example: media (holder) + emergency (holder). Incoming game:

- vs media: concurrent/exclusive depending on matrix
- vs emergency: likely reject
- result: reject

### 6. Call + navigation

Android 11+ user setting `android.car.KEY_AUDIO_FOCUS_NAVIGATION_REJECTED_DURING_CALL` can change nav-vs-call from concurrent to reject. Same binaries, different user preference. Reproduce with the setting both ways before you “fix” Policy.

### 7. Clipping and headroom

Two full-scale buses summed in a DSP to one speaker = clip. Hardware duck exists partly for **headroom**, not only politeness. If you refuse to duck and refuse to lower media bus gain, you will “fix routing” and create distortion.

## Source-Code Path

```text
AAOS matrix and focus:
  packages/services/Car/service/src/com/android/car/audio/CarAudioFocus.java

Fade (15+):
  car_audio_fade_configuration.xml
  FadeManager / VolumeShaper integration in frameworks + car audio
  (class names evolve — search FadeManagerConfiguration)

Phone duck:
  frameworks/base/services/core/java/com/android/server/audio/PlaybackActivityMonitor.java
  (and related; varies)
  AudioFlinger track volume / VolumeShaper

HAL:
  AudioControl onAudioFocusChange / ducking hooks (version-specific)
  vendor DSP graph mixers
```

When reading `CarAudioFocus`, follow one incoming request through evaluation against **all** current holders.

## Debugging

```text
Two sounds at once (unwanted)
   |
   +-- Did the loser receive focus loss?
   |       No  → focus not requested or not reaching CarAudioFocus
   |       Yes, ignored → rude app; on 15 consider enforced fade
   |
   +-- Are they on the same Flinger thread?
           Yes → software mix; look at volumes
           No  → expected if concurrent; look at HAL duck

Wanted duck missing
   |
   +-- Same bus? → cannot HW duck; implement SW duck or split buses
   +-- Different buses, gains both 1.0 → HAL never ducked
   +-- Media app paused → concurrent criteria failed (pause-on-duck)
```

### Evidence table

| Evidence | Conclusion |
| --- | --- |
| One Flinger thread, two ACTIVE tracks | Software mix |
| Two BUS addresses, two threads | Hardware-capable concurrency |
| Media track volume drops in Flinger | Software duck/fade |
| Media track volume 1.0, HAL gain drops | Hardware duck |
| Both 1.0, both audible, clip | Missing duck entirely |

## Logs / Commands

```bash
adb shell dumpsys car_service --services CarAudioService
adb shell dumpsys media.audio_flinger     # thread count, track volumes
adb logcat -s CarAudioFocus AudioFocus
```

Nav+media healthy AAOS pattern:

```text
Two holders, interaction concurrent
Two BUS threads not in standby
Media HAL gain reduced or media speakers physically quieter
Nav intelligible
No digital clip on the summed acoustic result
```

Problem patterns:

```text
One thread, two tracks, both vol=1.0, cabin mush
Nav rejected, app plays anyway
Fade config names referenced but not defined (15+ fatal)
```

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| “Focus will duck them” | Focus may allow concurrent with no attenuation |
| Implementing duck only in the media app | Rear zone / tuner / projection may not obey |
| Shared bus + “the DSP will duck nav vs media” | DSP sees one mixed PCM |
| Treating 15 fade as a replacement for bus split | Fade is for rude losers, not cabin spatialization |
| Forgetting pause-on-duck | Sounds like “HAL ate my media” |

## Practice

Requirement: “During nav, media continues 12 dB down on woofers; nav is only on the driver tweeter.”

Current XML maps both contexts to `bus0_media_out`.

1. Can you meet the requirement with a Flinger VolumeShaper only?
2. What is the smallest correct change set?
3. Regression risks?

Expected:

1. No. You can make media quieter, but you cannot put nav only on tweeters if they share one stream.
2. Split nav to its own bus/device in both car XML and policy XML; implement HAL/DSP duck of media bus on nav activity (or group gains); verify TDM slot / amp map; keep focus concurrent MAY_DUCK.
3. First-prompt latency on a cold nav bus; missing context in some zone configs; HAL clip if duck forgotten; focus matrix accidentally exclusive (media pauses).

**Diagnostic question:** You see two ACTIVE tracks on two buses, media Flinger vol=1.0, and acoustically media does not duck. Which layer failed?

Expected: HAL/DSP/amp gain — or nobody told that layer that nav started (AudioControl/focus hook missing). Framework concurrency is working.

## Key Takeaways

1. Focus, route, mix, and duck are four dials.
2. Hardware duck requires separate devices and a gain hook.
3. Shared thread = software physics.
4. App pause-on-duck changes the product sentence.
5. Prove *where* attenuation happens with Flinger volume vs HAL gain.

## Next

[Module 15 — Latency, Buffering, and XRUNs](15-latency-buffering-and-xruns.md)
