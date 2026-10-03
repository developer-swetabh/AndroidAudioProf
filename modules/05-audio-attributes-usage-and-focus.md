# Module 05 — AudioAttributes, Usage, and Focus

## Short Answer

**AudioAttributes** are the stream’s *meaning*. **Usage** is the most important field of that meaning for routing and focus. **Audio focus** is *permission to be prominent*; it is **not** a route and **not** a volume group.

On phones, focus is mostly a cooperative protocol. On AAOS, focus is a product rule engine (exclusive / reject / concurrent), still **not** the mixer.

If you change routing by “requesting focus harder,” you are using the wrong lever.

## Mental Model

A hospital corridor:

| Concept | Analogy |
| --- | --- |
| AudioAttributes | The badge: “I am an emergency announcement” vs “I am hallway music” |
| Usage | The job title on the badge |
| Content type | What the payload is (speech, music, movie, sonification) |
| Flags | Extra requests (low latency, HW AV sync, audibility enforced) |
| Focus | The right-of-way rule at an intersection |
| Routing | Which set of speakers the announcement is wired to |
| Volume group (AAOS) | Which knob applies |

A surgeon with right-of-way can still be wired to the wrong room.

### Three-level definitions

**AudioAttributes**

- **Beginner:** A description of why the app is playing sound.
- **Engineer:** A struct of usage, content type, flags, tags, and bundle extras that Policy, focus, and CarAudio all key on.
- **Expert:** The replacement for `AudioManager.STREAM_*` as the primary key. Legacy stream types still exist and are mapped. Vendor tags (HAL v7+) can ride along to the HAL as metadata.

**Usage**

- **Beginner:** “This is media / nav / call / alarm.”
- **Engineer:** `AudioAttributes.USAGE_*` constant used to pick strategy (phone) or `CarAudioContext` (AAOS).
- **Expert:** System usages (`EMERGENCY`, `SAFETY`, `VEHICLE_STATUS`, `ANNOUNCEMENT`) exist for privileged automotive/system components. Apps cannot freely impersonate them.

**Audio focus**

- **Beginner:** Asking “may I play now?”
- **Engineer:** `AudioManager.requestAudioFocus` with a gain type and listener.
- **Expert:** On AAOS, `CarAudioService` intercepts focus and applies an interaction matrix per zone. Android 15 can *enforce* fade-out on focus losers. The HAL may also request focus for external sounds (AudioControl).

## Comparison tables

### Usage vs attributes vs stream type

| | Stream type (legacy) | Usage | Full AudioAttributes |
| --- | --- | --- | --- |
| Example | `STREAM_MUSIC` | `USAGE_MEDIA` | usage + contentType + flags + tags |
| Granularity | Coarse | Better | Best |
| Still exists? | Yes, mapped | Yes | Yes |
| AAOS routing key | Indirect | Yes (via context) | Yes |
| Prefer in new code | No | Required | Required |

### Focus vs routing vs volume

| | Focus | Routing | Volume |
| --- | --- | --- | --- |
| Question | Who may be prominent? | Where do PCM bits go? | How loud is that path? |
| Owner (phone) | AudioService | AudioPolicy | AudioPolicy + Flinger/HAL |
| Owner (AAOS) | CarAudioService (per zone) | Dynamic mixes + Policy | Volume groups |
| If it fails | Two apps fight or one is silent by politeness | Wrong speaker/bus | Wrong knob or 0 gain |
| Enforced? | Phones: system-enforced since Android 12 (losing media/game players are faded; cooperative only before 12). AAOS: CarAudioFocus; AAOS 15 can also fade losers | Yes, by Policy/HAL | Yes, by software or HW gain |

### Phone focus vs AAOS focus

| | Phone | AAOS |
| --- | --- | --- |
| Interaction model | Mostly exclusive + transient duck | Exclusive, reject, **concurrent** |
| Ducking | Often app-implemented or framework duck | Often HAL/hardware because streams are on different buses |
| Zones | One user | Independent focus per audio zone |
| Navigation during call | Product-dependent | Configurable; user setting can reject nav during call (Android 11+) |
| HAL as requester | Rare | AudioControl HAL encouraged for external chimes |
| Delayable focus | Exists | Used for media waiting on a call |

## Architecture / Flow

```text
App builds AudioAttributes
        |
        +-- used at AudioTrack create  →  routing (Policy / CarAudio mix)
        |
        +-- used at requestAudioFocus  →  focus arbitration
        |
        +-- used at volume query       →  stream type / group mapping
```

### AAOS mapping (the one you must memorize)

```text
AudioAttributes.usage
        ↓
CarAudioContext   (static table, or OEM-defined contexts on Android 14+)
        ↓
car_audio_configuration.xml
        ↓
output device address  (busX_...)
        ↓
dynamic AudioPolicy mix
        ↓
AudioFlinger output thread for that bus
```

Static context map (from AOSP automotive docs; system contexts are Android 11+):

| CarAudioContext | Associated usages (summary) |
| --- | --- |
| `MUSIC` | `UNKNOWN`, `GAME`, `MEDIA` |
| `NAVIGATION` | `ASSISTANCE_NAVIGATION_GUIDANCE` |
| `VOICE_COMMAND` | `ASSISTANT`, `ASSISTANCE_ACCESSIBILITY` |
| `CALL_RING` | `NOTIFICATION_RINGTONE` |
| `CALL` | `VOICE_COMMUNICATION`, `CALL_ASSISTANT`, `VOICE_COMMUNICATION_SIGNALING` |
| `ALARM` | `ALARM` |
| `NOTIFICATION` | `NOTIFICATION` and `NOTIFICATION_*` |
| `SYSTEM_SOUND` | `ASSISTANCE_SONIFICATION` |
| `EMERGENCY` | `EMERGENCY` |
| `SAFETY` | `SAFETY` |
| `VEHICLE_STATUS` | `VEHICLE_STATUS` |
| `ANNOUNCEMENT` | `ANNOUNCEMENT` |

If your nav app uses `USAGE_MEDIA`, AAOS will treat it as **music**. That single mistake explains an entire class of “nav is not ducked / goes to the wrong speakers / uses the media knob.”

## Detailed Explanation

### 1. Fields inside AudioAttributes

| Field | Role |
| --- | --- |
| `usage` | Why: media, nav, call, alarm, assistant, … |
| `contentType` | What: speech, music, movie, sonification |
| `flags` | How: low latency, HW AV sync, even if muted for sonification, etc. |
| `tags` | Free-form; vendors may pass some to HAL (v7+) |
| bundle extras | e.g. AAOS `AUDIOFOCUS_EXTRA_REQUEST_ZONE_ID` |

`contentType` rarely changes the bus by itself. It *does* change processing expectations (speech vs music) and some fade/unfade rules (Android 15 unfadeable speech).

### 2. Focus gain types

| Gain | Meaning |
| --- | --- |
| `AUDIOFOCUS_GAIN` | Long-term: I am the new owner (media) |
| `AUDIOFOCUS_GAIN_TRANSIENT` | Short: pause others (notification) |
| `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` | Short: others may continue quieter (nav) |
| `AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE` | Short: others must be silent (recognition) |

Loss callbacks:

| Loss | App should |
| --- | --- |
| `LOSS` | Stop; do not expect to resume automatically |
| `LOSS_TRANSIENT` | Pause |
| `LOSS_TRANSIENT_CAN_DUCK` | Lower volume or pause if `setWillPauseWhenDucked` |

On phones, a badly written media app that ignores loss is a common “two things play.” On AAOS 15+, the system can fade and silence the loser anyway.

### 3. AAOS interaction types

From `CarAudioService` documentation:

| Interaction | Incoming request | Current holder |
| --- | --- | --- |
| **Exclusive** | Granted | Loses focus |
| **Reject** | Failed | Unchanged |
| **Concurrent** | Granted | Unchanged, if holder is not pausing-on-duck and incoming asked MAY_DUCK |

When multiple holders exist, the **most conservative** interaction wins: reject > exclusive > concurrent.

Concurrent focus is why AAOS *wants* nav and media on **different output devices**. If they share one mix, Android delivers both at full digital scale and you can no longer duck in hardware.

### 4. Focus is per zone

A rear-seat player requesting `USAGE_MEDIA` does not evict the driver’s media. Zone is derived from user ID / occupant zone, or overridden with `AUDIOFOCUS_EXTRA_REQUEST_ZONE_ID` (privileged / explicit).

### 5. HAL audio focus (AAOS, AudioControl 2.0+)

External chimes (seatbelt, ADAS) may not come from an app. The AudioControl HAL can request focus via `IFocusListener`. Safety-critical sounds should **play even if focus is denied**; Android focus must not be a safety interlock. The HAL should still mute Android streams when regulations require it.

## Source-Code Path

```text
App:
  android.media.AudioAttributes.Builder
  android.media.AudioFocusRequest.Builder
  AudioManager.requestAudioFocus()

Phone focus:
  frameworks/base/services/core/java/com/android/server/audio/MediaFocusControl.java
  (name has been MediaFocusControl for many releases)

AAOS focus:
  packages/services/Car/service/src/com/android/car/audio/CarAudioService.java
  packages/services/Car/service/src/com/android/car/audio/CarAudioFocus.java
  packages/services/Car/car-lib/src/android/car/media/CarAudioManager.java

Context mapping:
  packages/services/Car/service/src/com/android/car/audio/CarAudioContext.java

Policy attribute consumption:
  AudioPolicyManager::getOutputForAttr()
```

On AAOS, confirm `audioUseDynamicRouting` is true; otherwise CarAudioService’s routing/focus world is largely disabled and the product falls back toward phone-like `AudioService` behavior.

## Debugging

```text
Unexpected mixing / missing duck / wrong knob
   |
   +-- What usage did the app actually set?
   |       Unknown → log AudioAttributes / dumpsys audio
   |       Wrong   → app bug (very common)
   |       Right   ↓
   +-- Phone or AAOS?
   |       Phone   → MediaFocusControl holders vs Policy device
   |       AAOS    ↓
   +-- Which CarAudioContext and zone?
   |       dumpsys car_service
   |       Wrong context map → XML or OEM context
   |       Right ↓
   +-- Same bus or different buses?
           Same bus → cannot HW-duck; expect digital mix
           Different → look at HAL duck / focus concurrent rules
```

### Minimum evidence

1. The exact `AudioAttributes` of each stream.
2. Focus request result (`GRANTED` / `FAILED` / `DELAYED`) and subsequent loss callbacks.
3. On AAOS: zone id, context, bus address, volume group.
4. Whether both streams are ACTIVE in Flinger at full volume.

## Logs / Commands

```bash
adb shell dumpsys audio
# look for focus stack / holders (format varies)

adb shell dumpsys car_service --services CarAudioService
# zones, focus holders, group volumes, current configs

adb logcat -s AudioManager CarAudioFocus CarAudioService MediaFocusControl
```

What you expect when nav speaks over media on a well-built AAOS image:

```text
Media holds GAIN on MUSIC context, zone 0
Nav requests TRANSIENT_MAY_DUCK on NAVIGATION
Result GRANTED
Media may receive CAN_DUCK or nothing (concurrent)
Two Flinger tracks ACTIVE on two different BUS addresses
Media bus gain drops in HAL or group; nav bus stays high
```

What indicates a problem:

```text
Nav usage is USAGE_MEDIA
Both contexts mapped to the same bus
Focus REJECTED and nav app plays anyway (and product expected reject-to-silence)
Focus GRANTED but nav bus never opens
```

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Usage = device | Usage is meaning; device is a later mapping |
| Focus = routing | Focus never selects a PCM |
| “Request exclusive focus to force speaker” | Wrong API; you want device / zone / policy |
| Nav app uses `USAGE_MEDIA` because “it plays sound” | It will be music forever |
| Assuming phone ducking on AAOS | Concurrent + hardware duck is the design center |
| Treating focus as a safety mechanism | HAL must still play emergency audio |

## Practice

Two logs:

**App A:** `USAGE_MEDIA`, focus `GAIN`, playing.

**App B:** `USAGE_ASSISTANCE_NAVIGATION_GUIDANCE`, focus `GAIN_TRANSIENT_MAY_DUCK`, granted.

`car_audio_configuration.xml` maps both `music` and `navigation` to `bus0_media_out`.

1. Will both play?
2. Can the HAL duck media independently?
3. What is the correct layer to fix if the product requirement is “nav from driver Tweeters, media stays on woofers”?

Expected:

1. Yes, if both apps write (concurrent or exclusive-with-duck).
2. No. One bus = one HAL stream after Flinger mix (unless they somehow got separate streams on the same address, which they should not). Duck must happen in software or not at all.
3. Car audio configuration (and matching `audio_policy_configuration.xml` bus). Not the nav app, not the codec driver.

**Self-check:** Explain in one sentence why `contentType=SPEECH` on a `USAGE_MEDIA` podcast may still use the music knob.

Because volume group and context mapping are primarily **usage**-driven; content type does not usually create a new AAOS context.

## Key Takeaways

1. Attributes = meaning. Usage is the primary key.
2. Focus = prominence rules. Routing = path. Volume = gain. Three systems.
3. Wrong usage is the most common AAOS “routing bug” that is actually an app bug.
4. Concurrent focus only works as designed when streams can take different devices.
5. Safety audio must not depend on being granted focus.

## Next

[Module 06 — AudioFlinger Internals](06-audioflinger-internals.md)
