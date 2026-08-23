# Module 17 — Bluetooth, USB, and HDMI Audio

## Short Answer

These paths **leave the SoC codec**. Policy must mark a new device **connected**, Flinger must **move** the output thread, and a **different clock and HAL module** start consuming frames. Bugs here are usually **connection state, profile, codec negotiation, or clock domain** — not DAPM on the internal speaker.

If cabin buses still look ACTIVE in Flinger while you wear a BT headset, you are watching the wrong output.

## Mental Model

Each external path adds a **guest mixer** with its own clock.

```text
Internal:  Flinger → HAL primary → ADSP/codec → speaker     (SoC clock)
Bluetooth: Flinger → BT HAL / A2DP/LE path → controller → air → headset clock
USB:       Flinger → USB HAL → USB isochronous → gadget clock
HDMI/DP:   Flinger → HDMI audio HAL/PCM → video link → TV DAC clock
```

Three new skills: **when is the device available to Policy**, **which profile is up**, **who is the clock master**.

### Three-level definitions

**Bluetooth audio**

- **Beginner:** Sound over the air to a headset or car.
- **Engineer:** Multiple profiles (A2DP, Hearing Aid, LE Audio, SCO/eSCO/HFP) with different HAL devices and qualities.
- **Expert:** Policy device types differ per profile. SCO is a voice path (often 8/16 kHz). A2DP/LE are media. Absolute volume, codec (SBC/AAC/LC3/vendor), and AVRCP/media control are parallel state machines. On AAOS, BT may be a zone config target, not the primary cabin.

**USB audio**

- **Beginner:** Dongle or USB headset.
- **Engineer:** ALSA USB gadget/host class driver plus Android USB audio HAL.
- **Expert:** Enumerated rates/formats come from descriptors. Isochronous scheduling and implicit feedback are the XRUN physics. Card index can change.

**HDMI / DisplayPort audio**

- **Beginner:** Sound on the TV.
- **Engineer:** PCM or IEC61937 compressed passthrough tied to the video link.
- **Expert:** Often a **direct** or HDMI-specific output. Hotplug is video *and* audio. EDID audio capabilities can reject your format. Lip-sync is a timestamp problem across two HALs (video + audio).

## Architecture / Flow

### Connection sequence (all three, same skeleton)

```text
Physical / stack connect
    ↓
Some daemon notifies AudioService
    ↓
AudioPolicy.setDeviceConnectionState(AVAILABLE)
    ↓
Engine prefers that device for some strategies
    ↓
Flinger reroutes (close old HAL stream, open new)
    ↓
External clock starts
```

Disconnect is the reverse. The classic bug: **Policy still thinks AVAILABLE** after the user ripped the cable or BT crashed.

### Bluetooth profiles (do not mix them)

| Profile | Typical Android device idea | Content |
| --- | --- | --- |
| A2DP | `AUDIO_DEVICE_OUT_BLUETOOTH_A2DP` | Media |
| LE Audio / HAS | LE / hearing-aid device types (release-dependent names) | Media / hearing |
| SCO / eSCO / HFP | `AUDIO_DEVICE_OUT_BLUETOOTH_SCO` | Call, voice recognition |

Media on SCO sounds terrible (narrow band). Calls on A2DP may not work. If a VoIP app plays on A2DP during a “call,” check whether it used `USAGE_MEDIA` instead of `VOICE_COMMUNICATION`.

On the Android 15 reference HAL, SCO/HFP controls live on **`IBluetooth`** retrieved from `IModule/default`. Attach/detach of the external device is `IModule.connectExternalDevice` / `disconnectExternalDevice`. That is Core HAL, not the Bluetooth stack itself.

### AAOS extra twist

Cabin buses can stay up while a **zone config** switches a passenger to BT headphones (Module 13). Driver media may remain on woofers. Do not assume “BT connected” globally reroutes the car.

## Detailed Explanation

### 1. Routing vs Bluetooth stack

| Layer | Owns |
| --- | --- |
| `bluetooth` process / Fluoride | Pairing, profiles, RF |
| Audio Policy | Device availability + strategy |
| AudioFlinger | Thread move + write |
| BT audio HAL / offload | Encode, transport |

“BT connected” in Settings ≠ A2DP sink ready ≠ Policy AVAILABLE. Join three dumps.

Offload vs host encode:

- **Offload:** SoC DSP encodes SBC/LC3; Flinger may use a compressed or special output
- **Host:** AP encodes

A glitch can be RF, encoder, or Flinger. Packet statistics from the BT stack distinguish RF.

### 2. Absolute volume

Many headsets use AVRCP absolute volume. Android may send a volume index and **not** attenuate PCM. Symptom: Flinger volume 1.0, headset quiet or stuck. Same idea as AAOS fixed volume, different protocol.

### 3. USB specifics

- Descriptors lie sometimes (advertised 96 kHz that fails).
- `hw_params` must match an enumerated alt-setting.
- Unplug during `write` → EPIPE / device gone; Flinger must recover to speaker.
- On AAOS, USB can be a zone config device; address/type must be in policy XML.

### 4. HDMI / passthrough

Compressed passthrough (AC3, DTS, etc.) uses **direct** outputs and `AUDIO_FORMAT_*` non-PCM. Mixing is impossible. If nav must play during HDMI movie passthrough, the product must **decode in software** or mix on the TV. This is a product architecture choice, not a one-line Policy fix.

IEC61937 wrapping means the PCM device carries compressed bursts. Tinyplay of a WAV into that device is the wrong experiment.

### 5. Failover timing

Users report “1 second of silence when unplugging headset.” That is often:

```text
unplug → wait for debounce → Policy update → close BT/USB HAL
  → open speaker HAL → cold start (graph, amp)
```

Shaving this requires **warming** the internal path or faster disconnect notification — power vs latency again.

## Source-Code Path

```text
Policy:
  AudioPolicyManager::setDeviceConnectionStateInt

Java:
  AudioService device inventory
  BtHelper / similar (names evolve)

BT audio:
  packages/modules/Bluetooth/   (or system/bt on older trees)
  hardware/interfaces/audio  IBluetooth (AIDL) / IPrimaryDevice SCO APIs

USB:
  system/media/audio_utils or USB audio HAL in hardware/interfaces
  kernel sound/usb/

HDMI:
  vendor HDMI audio HAL
  kernel sound/soc/...hdmi... or ALSA HDMI driver
```

Paths move with mainline Bluetooth (APEX). Search `setDeviceConnectionState` and `A2DP` from AudioService on your branch.

## Debugging

```text
No audio on accessory
   |
   +-- Is the device AVAILABLE in media.audio_policy?
   |       No  → stack never notified Policy (BT profile, USB enum, HDMI HPD)
   |       Yes ↓
   +-- Did Flinger move the track to that device?
   |       No  → strategy / AAOS mix forcing a bus
   |       Yes ↓
   +-- Is the thread writing? underruns?
   |       No  → Flinger/HAL open fail (format)
   |       Yes ↓
   +-- Accessory-specific
           BT  → profile, codec, RF stats, abs volume
           USB → alt-setting, urb errors
           HDMI → EDID caps, link, passthrough vs PCM
```

### Decision: AAOS mix vs phone-style override

If an AAOS dynamic mix forces `bus0_media_out`, a passenger BT headset will **never** get media until you switch zone config or add a mix. This is the #1 false “BT HAL is broken” on cars.

## Logs / Commands

```bash
adb shell dumpsys media.audio_policy     # available devices
adb shell dumpsys media.audio_flinger    # actual thread device
adb shell dumpsys bluetooth_manager      # if present
adb shell dumpsys audio                  # device inventory
adb logcat -s AudioService APM_AudioPolicyManager a2dp bluetooth
```

Healthy A2DP start:

```text
A2DP sink connected
Policy AVAILABLE for A2DP
Flinger thread device switches to A2DP
Internal speaker thread standby
No repeating open-fail
```

Problem:

```text
Settings shows connected, Policy does not
Policy A2DP, Flinger still BUS/speaker
SCO device during music (wrong profile)
HDMI output open failed (format not in EDID)
```

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Debugging codec DAPM for BT silence | Different chip |
| Assuming any BT connection is A2DP | Could be only HFP |
| Forcing speaker tinyplay to “prove BT HAL” | Wrong path |
| Ignoring AAOS mixes | They override headset preference |
| Mixing passthrough with nav on one HDMI PCM | Impossible |

## Practice

User: “Car Bluetooth is connected but music stays in the cabin.”

1. What three facts do you collect?
2. Give an AAOS-native explanation that is not a bug.
3. Give a Policy-state bug explanation.

Expected:

1. Policy available devices; Flinger track device/address; whether dynamic mix forces a cabin bus; BT profile (A2DP vs HFP only).
2. Product routes driver media only to cabin; BT is for phone calls or a passenger zone. By design.
3. A2DP never reached `setDeviceConnectionState(AVAILABLE)`, or strategy prefers speaker due to a sticky preferred device.

## Key Takeaways

1. External paths are new devices, new clocks, new HALs.
2. Settings connected ≠ Policy available ≠ Flinger moved.
3. Profiles are not interchangeable.
4. AAOS mixes can legally ignore a headset.
5. Passthrough cannot mix.

## Next

[Module 18 — Power Management, Suspend, and Resume](18-power-suspend-resume.md)
