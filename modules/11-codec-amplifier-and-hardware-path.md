# Module 11 — Codec, Amplifier, and the Hardware Path

## Short Answer

After samples are serialized, they still have to become **voltage and current**. The codec DAC, analog muxes, bias supplies, mute switches, and the amplifier (often a separate smart amp) each have a mute point. Digital RUNNING + analog mute = the most common “everything looks fine” silence.

This layer is where **DAPM, regulators, GPIOs, I2C/SPI register maps, and fault pins** live. It is not AOSP. It is datasheet plus board schematic plus mixer state.

## Mental Model

A garden hose with many valves:

```text
TDM/I2S bits
   → DAC digital filter
   → DAC analog
   → analog mixer / mux
   → line mute
   → AC coupling
   → amplifier enable / mute / gain
   → load (speaker)
```

Any closed valve explains silence. A half-open valve explains “too quiet.” A popping valve explains transients at start/stop.

### Three-level definitions

**Codec**

- **Beginner:** The chip that turns digital audio into analog.
- **Engineer:** ADC/DAC plus analog routing, often with a small DSP and I2C control.
- **Expert:** A DAPM graph of widgets (DAC, mixer, PGA, micbias, charge pump). Register defaults and calibration (DC offset, speaker protection) matter as much as “unmute.”

**Amplifier**

- **Beginner:** Makes the speaker loud.
- **Engineer:** External Class-D (or similar) with enable GPIO, I2C gain, and fault reporting.
- **Expert:** May include speaker protection DSP, load diagnostics, thermal foldback. Can mute on overcurrent and stay muted until cleared. May receive TDM directly, bypassing a classic codec DAC.

**DAPM**

- **Beginner:** Auto power management for audio widgets.
- **Engineer:** ASoC walks a widget graph and powers only complete paths.
- **Expert:** Incomplete routes look like “driver loaded, mixer looks on, but supply widget never came up.” Reading DAPM widget power state is the evidence.

## Architecture / Flow

### Common hardware topologies

```text
A. Codec + analog amp
   BE DAI → Codec DAC → analog → GPIO-enabled Class-D → speaker

B. Codec smart amp (digital)
   BE DAI → Codec digital out / same TDM → Smart amp DAC+Class-D → speaker

C. Split: SoC DSP → TDM → multiple smart amps (typical auto)
   ADSP AFE → TDM8 → Amp0 slots 0-1 (FL/FR)
                  → Amp1 slots 2-3 (RL/RR)
                  → Amp2 slots 4-5 (tweeters)
```

In C there may be **no analog codec** in the phone sense. “Check the codec” is then the wrong sentence. Check the **amp slot** and **DSP AFE port**.

### Mute points (memorize the list)

| Stage | Typical mute mechanism |
| --- | --- |
| DSP / HAL gain | Digital zero or gain 0 |
| Codec digital mute | Soft mute register |
| Codec analog mute | Switch widget / PGA -72 dB |
| Headphone charge pump | Supply down |
| External amp EN | GPIO low |
| External amp mute pin | Active mute |
| External amp I2C gain | 0 dB mute bit |
| Speaker protection | Fault latch |
| Mechanical | Connector, load disconnect |

A complete debug of “no audio” ends by crossing these off with evidence, not by assuming the last one.

## Detailed Explanation

### 1. DAPM path completeness

ASoC will not power a DAC if the route to an output widget is missing. Routes come from:

- Codec driver `dapm_routes`
- Machine driver extra routes
- Mixer controls that connect muxes

`tinymix` showing a volume of 80 does not mean the mux in front of that PGA is selected.

### 2. Power supplies

Codecs need:

- Digital IO supply
- Analog supply
- Charge pump for headphones
- Micbias for analog mics

A missing analog supply can still allow I2C and DAI clocks (digital side alive). Symptom: I2C reads work, PCM runs, analog is dead. Measure supplies; do not argue with logcat.

### 3. Pop suppression vs first-prompt clip

Bring-up sequences often:

1. Mute analog
2. Enable clocks and DAC
3. Ramp gain
4. Unmute amp last

Tear-down is the reverse. If software unmutes the amp **before** the DAC is settled, users hear a pop. If it unmutes **too late**, the first 30 ms of a nav prompt is missing. These are sequencing bugs at this layer, often triggered by Flinger standby (Module 06).

### 4. Smart amp faults

Automotive amps latch faults:

- Overcurrent (shorted speaker)
- Overtemperature
- Clock loss
- DC detect
- Open load

The HAL/PCM path can look healthy while the amp is in fault mute. **Read the fault register.** Clearing without fixing the load will just retrip.

### 5. Calibration

Not only Qualcomm ACDB. Amps and codecs have:

- Speaker impedance models
- DC offset calibration
- Factory gain trims

A wrong calibration can sound like distortion or low level on **one** channel. That is not Policy. It is a per-unit or per-SKU data problem.

### 6. What Android still owns here

Even though this layer is hardware:

- AAOS fixed volume: CarAudioService converts the group index to millibels and calls `setAudioPortGain()` → HAL `IModule.setAudioPortConfig(AudioGainConfig)`, which the vendor HAL may turn into an amp gain register write
- AAOS volume groups often intend **hardware** attenuation
- Mute from user / call / emergency may be a HAL parameter that hits these valves

So a “volume group 0” can be a Policy decision executed as an amp register. Trace it; do not pick a side early.

## Source-Code Path

There is no universal AOSP codec file. You will live in:

```text
Kernel codec driver:   sound/soc/codecs/<name>.c
Kernel amp driver:     sound/soc/codecs/<amp>.c  or vendor/misc
Machine routes:        sound/soc/<vendor>/<board>.c
Device tree:           codec supplies, amp enable-gpios, reset-gpios
Vendor HAL:            use-case → mixer control sequences
Android mixer paths (older Qualcomm):  mixer_paths.xml
```

**mixer_paths.xml** (and friends) are **vendor**, very common on Qualcomm Android, **not** a generic AOSP contract. They describe sequences of mixer controls for a use case. Wrong path name = digital alive, analog not routed.

On newer Qualcomm stacks, mixer_paths may be partly replaced or supplemented by PAL/ACDB graphs (Module 16). Do not assume the file exists.

## Debugging

```text
PCM RUNNING, hw_ptr moving
   |
   +-- DAPM path complete / widgets powered?
   |       No  → routes, mux, missing widget
   |       Yes ↓
   +-- Codec digital and analog unmute?
   |       No  → mixer / register / HAL sequence
   |       Yes ↓
   +-- Amp enable asserted? mute pin released?
   |       No  → GPIO / pinctrl / regulator
   |       Yes ↓
   +-- Amp fault register clear?
   |       No  → load, thermal, clocks to amp
   |       Yes ↓
   +-- Electrical signal at speaker terminals?
           No  → connector, filter, wrong channel
           Yes → acoustic issue or you are listening to the wrong seat
```

### Minimum lab

- Schematic with enable pins highlighted
- I2C dump of codec/amp (vendor tool)
- `tinymix` snapshot at silence vs at known-good playback
- Multimeter on amp EN and speaker terminals
- Optional: dummy load if the bench has no speaker

### Mixer snapshot method

```text
1. Capture tinymix at boot (idle)
2. Start known-good tone
3. Capture tinymix again
4. Diff
```

The diff is the **true bring-up sequence**. Compare it to the sequence for the failing use case. The first control that does not move is your clue.

## Logs / Commands

```bash
# mixer (if available)
adb shell tinymix

# GPIO (names are board-specific)
adb shell cat /sys/kernel/debug/gpio

# kernel
adb shell dmesg | grep -iE 'dapm|codec|amp|speaker|fault'
```

What you expect on a good start:

```text
DAPM power-up of DAC → mixer → output → amp supply
Amp enable
No fault
Optional: gain ramp logs
```

What indicates a problem:

```text
DAPM incomplete path
regulator enable failed
i2c transfer error  (amp not on bus — can still be “enabled” in software)
overcurrent / clock error in amp driver
```

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| “tinymix volume is non-zero so analog is open” | Mux/enable/fault can still mute |
| Debugging cabin silence on the headphone charge pump | Wrong analog widget |
| Ignoring amp fault because PCM is RUNNING | Different chip, different mute |
| Reusing phone codec bring-up on a smart-amp car | There may be no analog codec |
| Changing kernel DAPM to fix a Policy bus typo | Prove last-known-good first |

## Practice

Nav is silent; media is loud. Same speaker physically. Flinger shows nav on `bus1_navigation_out` ACTIVE. `tinyplay` on media PCM works. `tinyplay` on the nav PCM (correct card/device) is also silent. Amp fault is clear. Media tinymix snapshot shows `TDM Slot 0-1 Playback` on. Nav snapshot shows no TDM slot control change.

1. Last-known-good?
2. Owning layer?
3. Likely fix type?

Expected:

1. Nav PCM may even be RUNNING; last-known-good is at least HAL open. Analog/TDM slot for nav never configured.
2. HAL use-case / mixer path / DSP graph for the nav backend — or machine routes missing for that FE/BE. Not the nav app.
3. Add the missing mixer/DAPM/graph sequence for the nav use case so the same amp slots (or the intended tweeter slots) unmute.

**Self-check:** Name five independent mute points without looking.

## Key Takeaways

1. Digital healthy ≠ analog open. List mute points.
2. DAPM completeness is evidence, not decoration.
3. Smart amps fail silent on fault latch.
4. Mixer diffs beat reading 200-page datasheets first.
5. Automotive “codec” is often “DSP + many amps.” Use the real topology.

## Next

[Module 12 — AAOS Car Audio Architecture](12-aaos-car-audio-architecture.md)
