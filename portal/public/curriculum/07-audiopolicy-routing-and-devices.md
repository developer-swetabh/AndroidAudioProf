# Module 07 — AudioPolicy: Routing and Devices

## Short Answer

AudioPolicy turns **meaning + topology + current connections** into a concrete **output or input**. Routing is a decision about **ports and patches**, not about I2S pins. If the wrong device is selected, you debug Policy, its engine, its XML/AIDL configuration, and (on AAOS) CarAudio’s dynamic mixes — not the codec first.

## Mental Model

Policy is a graph problem.

```text
Sources (apps / usages / strategies)
        ↓
Mix ports  (what Flinger can open: primary, deep_buffer, compress_offload, r_submix, bus mixes…)
        ↓
Device ports (speaker, headset, a2dp, usb, bus0_media_out, …)
        ↓
Patches (this mix is currently connected to that device)
```

You do not “route to I2S2” in Policy. You route to a **device port** whose HAL implementation eventually opens a PCM that the machine driver wired to I2S2.

### Three-level definition: routing

**Beginner:** Choosing speaker vs headphones vs Bluetooth.

**Engineer:** Selecting a device type (and address) for a strategy or attribute, given currently available devices.

**Expert:** Building or choosing an audio patch between a mix port and one or more device ports, subject to profiles (rate/format/channels/flags), exclusive devices, dynamic mixes, and engine rules. On AIDL HAL, the declared topology may be queried from the HAL instead of parsed only from XML.

## Architecture / Flow

```text
Device connect / disconnect
  (headset jack, BT profile, USB, dock)
        ↓
AudioService / HAL callback
        ↓
AudioPolicyManager.setDeviceConnectionState
        ↓
engine recomputes preferred device per strategy
        ↓
AudioFlinger told to move outputs
        ↓
maybe close/reopen HAL streams
```

```text
New track with AudioAttributes
        ↓
getOutputForAttr()
        ↓
map attributes → strategy or product strategy
        ↓
select device for that strategy
        ↓
select an I/O profile that supports format/rate/channels/flags
        ↓
return output handle to Flinger
```

```mermaid
flowchart TD
    In([AudioAttributes + Format + Flags + UID]) --> DynamicMixCheck{AAOS: Match<br/>Dynamic Mix Rule?}
    
    DynamicMixCheck -- Match Found --> RouteBus[Force Device: AUDIO_DEVICE_OUT_BUS<br/>Target Address: e.g. bus0_media_out]
    DynamicMixCheck -- No Match / Phone --> EngineCheck[Engine: Map Usage to Product Strategy<br/>e.g. MEDIA, PHONE, SONIFICATION]
    
    EngineCheck --> DevicePick[Select Active Output Device for Strategy<br/>e.g. A2DP if connected, else SPEAKER]
    
    RouteBus --> ProfileCheck{Find Matching<br/>I/O Profile on Port?}
    DevicePick --> ProfileCheck
    
    ProfileCheck -- Match Found --> OpenCheck{Compatible Thread<br/>already open?}
    ProfileCheck -- No Match --> Reject[Fail: Return BAD_VALUE / INVALID_OPERATION]
    
    OpenCheck -- Yes --> Reuse[Reuse existing PlaybackThread ioHandle]
    OpenCheck -- No --> OpenNew[Open new HAL Output Stream -> new PlaybackThread]
    
    Reuse --> Return[Return ioHandle to AudioFlinger]
    OpenNew --> Return
```

### Phone routing vs AAOS routing

| | Phone Android | AAOS with dynamic routing |
| --- | --- | --- |
| Key | strategy (MEDIA, PHONE, …) | CarAudioContext → bus address |
| Who builds mixes | Static `audio_policy_configuration.xml` | CarAudioService registers dynamic mixes at runtime |
| Typical device | `SPEAKER`, `A2DP`, `USB_HEADSET` | `AUDIO_DEVICE_OUT_BUS` + address |
| Multi-user | Rare | Per-zone user-id device affinity |
| Override | `setPreferredDevice` / communication device | Zone config switch, cast, mirror |

Same Policy *code*, different **mix graph**.

## Detailed Explanation

### 1. Device types vs addresses

`AUDIO_DEVICE_OUT_SPEAKER` is a **type**. On phones there is usually one.

`AUDIO_DEVICE_OUT_BUS` is also a type, but there are **many buses**. They are distinguished by **address** (`bus0_media_out`). Car audio configuration and audio policy configuration must use the **same address string**. A typo here is a classic “everything compiles, nothing plays where you think.”

### 2. Profiles are admission control

A device port lists profiles:

```xml
<!-- illustrative shape; schema depends on HAL version -->
<profile format="AUDIO_FORMAT_PCM_16_BIT"
         samplingRates="48000"
         channelMasks="AUDIO_CHANNEL_OUT_STEREO"/>
```

If an app asks for 44.1 kHz surround and no profile (and no resampler path) accepts it, **create fails**. That is Policy saying no, not ALSA saying no — although the profiles *should* match what the HAL can actually open.

Lies in XML are a frequent root cause: Policy thinks 96 kHz is fine; HAL open fails; Flinger cannot start.

### 3. Strategies (default engine)

The default engine groups usages into strategies. Exact lists evolve, but the idea is stable:

| Strategy (concept) | Typical usages |
| --- | --- |
| Media | media, game, unknown |
| Phone | voice communication |
| Sonification | UI, sonification |
| Enforced audible | camera click even if muted (policy-dependent) |
| Accessibility / assistant | assistant |
| DTMF | DTMF |

Each strategy has a **device category preference** (e.g. media prefers A2DP if connected; ringing may prefer speaker).

Do not memorize one year’s enum as eternal. Read the engine for your branch.

### 4. Dynamic mixes (critical for AAOS)

CarAudioService builds `AudioPolicy.AudioPolicyMix` objects:

- match on usage / attributes
- force output to a specific device address
- associated with a user id (affinity)

Then it registers them with AudioService / Policy. After that, `getOutputForAttr` hits a **mix rule** before generic strategy logic.

If `audioUseDynamicRouting` is false, this entire mechanism is off.

### 5. Patches

A **patch** is a live connection: source port(s) → sink port(s).

Examples:

- mix port `primary` → device port `speaker`
- device port `FM tuner` → mix port (loopback)
- mix → two devices (duplication)

`dumpsys media.audio_policy` listing patches is how you see **current** routing, not just possible topology.

### 6. Preferred devices and app overrides

Apps and system UI can request a preferred device (Bluetooth hearing aid, USB, communication device for VoIP). These interact with strategy rules. When debugging “it ignored the headset,” ask whether:

- the device was **connected in Policy** (not just in Bluetooth settings)
- a **preferred device** or communication device is sticky
- an AAOS mix is forcing a bus (preferred BT may lose)

### 7. Configuration transport on Android 15 (AIDL)

APM does **not** own a vendor XML as its primary contract:

```text
IModule.getAudioPorts / getAudioRoutes
IConfig.getEngineConfig / getSurroundSoundConfig
IModule.connectExternalDevice   ← jack / USB / BT
IModule.setAudioPatch           ← live route
```

A default AIDL HAL may still *implement* those calls by converting `audio_policy_configuration.xml`. Bring-up teams often edit that file. Your debug question is: **does `dumpsys media.audio_policy` show the port the converter claimed?** If not, the converter or `IModule` implementation is wrong.

HIDL XML/XSD and the v6→v7 space-separator script are history (Module 23). Do not run them as the 15 procedure.

CAP (`useCoreAudioVolume` / `useCoreAudioRouting`) can sit on top. On **15**, CAP data is typically still file-based. Full CAP-over-AIDL is **16+**.

## Source-Code Path

```text
frameworks/av/services/audiopolicy/service/AudioPolicyService.cpp

frameworks/av/services/audiopolicy/managerdefault/AudioPolicyManager.cpp
  setDeviceConnectionStateInt
  getOutputForAttr
  getInputForAttr
  startOutput / stopOutput
  registerPolicyMixes

frameworks/av/services/audiopolicy/enginedefault/
frameworks/av/services/audiopolicy/engineconfigurable/

AAOS mix registration:
packages/services/Car/service/src/com/android/car/audio/CarAudioService.java
packages/services/Car/service/src/com/android/car/audio/CarAudioZonesHelper.java
  (helper names vary by release)
```

Read `getOutputForAttr` with a paper log:

```text
attributes in
  → mix match?
  → strategy?
  → device?
  → profile match?
  → output handle out
```

That function is the routing brain.

## Debugging

```text
Wrong or no device
   |
   +-- Is the physical device connected in Policy?
   |       No  → connection path (BT profile, USB attach, jack, HAL callback)
   |       Yes ↓
   +-- Which strategy / context did attributes map to?
   |       Unexpected → attributes or engine/XML map
   |       Expected ↓
   +-- Is a dynamic mix capturing this usage?
   |       Yes → CarAudio / OEM mix rules (address typo?)
   |       No  ↓
   +-- Does a profile accept format/rate/channels?
   |       No  → XML lie or app format
   |       Yes ↓
   +-- Does Flinger open that output successfully?
           No  → HAL open (now you may leave Policy)
```

### XML consistency checklist (AAOS)

1. Every address in `car_audio_configuration.xml` exists as a device port advertised by `IModule.getAudioPorts()` (and therefore in `dumpsys media.audio_policy`). If you still have a converter XML, the address must be there too — but Policy’s truth is the HAL port list.
2. Gain / volume curve blocks exist if Policy expects them.
3. Module names match the HAL module that actually implements the bus.
4. Channel masks match the physical amp (2 vs 4 vs 8).

Official docs: devices referenced by car audio config **must** be defined in the audio policy configuration.

## Logs / Commands

```bash
adb shell dumpsys media.audio_policy
adb shell dumpsys media.audio_flinger     # join on device/address
adb logcat -s APM_AudioPolicyManager AudioPolicyService
```

How to read Policy dump (hunt ideas, not exact banners):

```text
Available devices:
  - types + addresses + connected state

Outputs / mix ports:
  - sample rate, channels
  - attached devices

Patches:
  - who is connected to whom *now*

Dynamic mixes / policy mixes:
  - matching usages
  - forced devices
```

Problem patterns:

```text
A2DP still “available” after user disconnected
No BUS address that matches car XML
Mix exists but patch still points at speaker
getOutputForAttr logs “no output found”
```

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Editing kernel DAI to fix Policy device selection | Wrong layer |
| Duplicating addresses with slight name changes | Mixes silently fail to bind |
| Assuming headset connect in Settings = Policy connected | BT A2DP may not be up yet |
| Forgetting profiles when adding 24-bit / 96 kHz | Create fails or falls back oddly |
| Thinking `AUDIO_DEVICE_OUT_SPEAKER` is the cabin on AAOS | Cabin is usually BUS devices |

## Practice

You add a new chime usage and a new bus `bus8_chime_out` in `car_audio_configuration.xml`. Media still plays. Chime is silent. Policy dump shows no device with that address.

1. Last-known-good layer?
2. Immediate failure?
3. Most likely root cause?

Expected:

1. App and Flinger may not even have a track if create failed; or a track exists on a fallback device. The Policy dump already says the bus is unknown.
2. Policy has no such device port.
3. You forgot to declare the bus in `audio_policy_configuration.xml` (or AIDL HAL config) with that exact address.

## Key Takeaways

1. Routing is ports, profiles, and patches — not pins.
2. `getOutputForAttr` is the function to read.
3. AAOS routing is dynamic mixes + addresses; XML must agree.
4. A profile lie becomes a HAL open failure later.
5. Device *connection state* is part of the decision, not just topology.

## Next

[Module 08 — Audio HAL: Legacy, HIDL, AIDL](08-audio-hal-legacy-hidl-aidl.md)
