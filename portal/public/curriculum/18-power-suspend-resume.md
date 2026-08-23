# Module 18 — Power Management, Suspend, and Resume

## Short Answer

Audio power management is a **stack of independent sleepers**: Flinger standby, HAL close, ADSP collapse, DAI clocks, codec DAPM, amp enable, and system suspend. The most common field bug is **“works until idle/sleep.”** That sentence already tells you the owning class: a **bring-up race** on the way back, not a static routing typo.

## Mental Model

A building after hours:

- Lights (amps) off
- HVAC (codec analog) off
- Security PC (ADSP) asleep
- Front desk (Flinger thread) on break
- Street still exists (Policy topology)

In the morning everything must start **in order**. If the amp turns on before the DAC is clocked, pop. If the DAC never gets MCLK after resume, RUNNING-but-dead. If Flinger never leaves standby, nothing else happens.

### Three-level definition: standby vs suspend

**Standby (AudioFlinger/HAL)**

- **Beginner:** Audio stops to save power when nothing plays.
- **Engineer:** Output thread calls HAL `standby()`, often closing PCM and tearing graphs.
- **Expert:** Per-output. Fast path may stay warm. Deep buffer goes cold. Time-to-first-sample is a product KPI.

**System suspend**

- **Beginner:** The device sleeps.
- **Engineer:** AP CPUs freeze; many clocks and rails collapse; wake sources remain.
- **Expert:** Resume must restore clocks, IRQ, DSP firmware, and I2C devices. Audio drivers that assume they never lost context will leave registers at reset defaults (muted).

They nest: a phone can be awake with audio in standby, or suspended with everything down, or “audio wake” for a notification.

## Architecture / Flow

### Idle (no suspend)

```text
last track stops
    ↓
Flinger idle timeout
    ↓
HAL standby
    ↓
vendor: pcm_stop, graph teardown, DAPM off, amp EN=0
    ↓
clocks gated
```

### Start after idle

Reverse, plus calibration and unmute ramp (Modules 11, 15, 16).

### Full suspend/resume

```text
userspace freeze
    ↓
audio drivers suspend (if not a wake path)
    ↓
rails collapse
    ↓
resume: restore + possible DSP reload
    ↓
userspace continues
    ↓
next playback pays full cold start
```

### Notification / voice while “asleep”

The product may:

- Resume the AP
- Use a low-power island / always-on DSP / hotword
- Play a short prompt and sleep again

Those paths are **not** the media FE. Tinyplay on MultiMedia1 does not prove the low-power notification path.

## Detailed Explanation

### 1. Independent power domains (typical)

| Domain | Goes down when |
| --- | --- |
| Amp | No active analog path or explicit EN |
| Codec analog | DAPM idle |
| Codec digital / I2C | Sometimes stays up |
| DAI / MCLK | No BE active |
| ADSP | No graphs and idle timer |
| AP AudioFlinger thread | No ACTIVE tracks |

A domain that **did not** come back is your last-known-good+1.

### 2. Wake locks and audio

Audio playback usually holds a wait that prevents suspend (implementation details vary by version and policy). If a product suspends **during** media, something released that wait (app pause, Flinger standby, OEM power policy). Dump wake locks / `dumpsys power` alongside Flinger.

### 3. Resume races

Classic races:

| Race | Symptom |
| --- | --- |
| Write before clocks | XRUN storm then silence |
| I2C to codec before rail | I2C errors; mute leftovers |
| Amp EN before DAC settle | Pop |
| Policy reroute during resume | Wrong device for first track |
| ADSP FW not ready | HAL open fail or graph fail |
| IRQ not re-enabled | `hw_ptr` stuck |

### 4. “After Bluetooth, then sleep, then speaker dead”

Compound bug: disconnect + suspend. Policy might still have A2DP, or speaker PCM might not re-init. Split the repro:

1. BT disconnect without sleep
2. Sleep without BT
3. Both

If only (3) fails, it is an ordering bug between BT teardown and resume bring-up.

### 5. Automotive ignition / ACC

Cars add **electrical** power states beyond Android suspend: ACC on/off, infotainment ECU sleep, amp module sleep on CAN. The amp may be a **different ECU**. Android can be RUNNING with the amp ECU still asleep. That will never show up as an XRUN.

Ask the vehicle architecture team for the amp wake condition. This is not in AOSP.

### 6. Leak vs mute

If audio **never** stands by, you will debug current draw, not silence. HAL that never closes PCM, a stuck silent track (zeros), or a route that never tears down will hold ADSP awake. `dumpsys media.audio_flinger` showing a thread never in standby during “idle UI” is the clue.

## Source-Code Path

```text
AudioFlinger PlaybackThread standby paths
  frameworks/av/services/audioflinger/Threads.cpp

HAL:
  stream standby() / close
  vendor power helpers

Kernel:
  snd_soc_suspend / snd_soc_resume
  component suspend ops
  runtime PM on DAI and codec (`pm_runtime`)

Power:
  dumpsys power
  kernel `/sys/power`
```

Read `standby` in **your** HAL. Some no-op it (power always on — cars sometimes do this on cabin amps). Then “first prompt latency” should already be small; if not, the delay is elsewhere.

## Debugging

```text
Fails only after idle or sleep
   |
   +-- Does it fail after Flinger standby without system suspend?
   |       Yes → HAL/DSP/codec bring-up (no need to debug AP suspend)
   |       No  ↓
   +-- Fails only after full suspend?
   |       Yes → driver resume / FW reload / rails
   |       Only after vehicle ACC? → amp ECU / vehicle power
   |
   +-- After failure, is Flinger ACTIVE and writing?
           No  → never restarted (app/policy)
           Yes → lower layer did not actually wake
```

### The two-dump resume protocol

1. Idle until standby (confirm thread standby yes).
2. Dump mixer / DAPM / vendor graph (should be down).
3. Start playback.
4. Immediately dump Flinger + mixer + vendor graph.
5. If Flinger writes and graph still down, vendor start failed silently.

## Logs / Commands

```bash
adb shell dumpsys media.audio_flinger    # standby flags
adb shell dumpsys power
adb logcat -s AudioFlinger
adb shell dmesg | grep -iE 'suspend|resume|asoc|snd'
```

Healthy wake:

```text
thread leaves standby
HAL open/start
clocks/DAPM/graph up
first write after a documented ramp
no I2C errors
```

Problem:

```text
I2C NAK storm at resume
ASoC resume failed
ADSP not ready
thread never leaves standby
amp EN never asserted after wake
```

## Common Mistakes

| Mistake | Reality |
| --- | --- |
| Treating all “after sleep” bugs as Policy | Policy topology usually survived |
| Warm-path-only testing | You will ship a dead first chime |
| Forcing no-standby to hide races | Power/thermal regress |
| Ignoring vehicle amp ECU | Android is not the only computer |
| Calling pop an XRUN | Sequencing, not an empty ring |

## Practice

Chime is perfect in engineering mode (continuous test tone). In the car, the first seatbelt chime after 10 minutes parked is missing; the second is fine.

1. What physics is this?
2. What is a bad fix?
3. What evidence proves bring-up time > chime length?

Expected:

1. Cold start of a standby bus; first one-shot is shorter than unmute/graph time.
2. Infinite test tone in production, or disabling standby globally.
3. Timestamp HAL start vs first analog energy (scope on amp EN and speaker). If EN rises after the PCM already finished, the chime was digitally played into a muted amp.

## Key Takeaways

1. Standby and suspend are different sleepers.
2. “Works until idle” is a bring-up problem class.
3. Split repros: idle vs suspend vs vehicle power vs BT combo.
4. Power domains come back in order — find the one that did not.
5. Warming a path is a product decision with a power bill.

## Next

[Module 19 — Debugging Methodology](19-debugging-methodology.md)
