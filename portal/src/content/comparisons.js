/** Comparison tables. Glossary opens these by id only — never by fuzzy title match. */

export const COMPARISONS = {
  "policy-flinger": {
    title: "AudioPolicy vs AudioFlinger",
    headers: ["", "AudioPolicy", "AudioFlinger"],
    rows: [
      ["Role", "Decide", "Execute"],
      ["Time", "Events", "Periods"],
      ["Dump", "media.audio_policy", "media.audio_flinger"],
      ["Failure", "Wrong device", "Glitch, standby, empty mix"],
    ],
  },
  "track-player": {
    title: "AudioTrack vs MediaPlayer",
    headers: ["", "AudioTrack", "MediaPlayer"],
    rows: [
      ["Input", "PCM (or offload frames you feed)", "File / URL"],
      ["Control", "Sample-accurate write", "Prepare / start"],
      ["Ends in", "Flinger track", "Decoder + track"],
    ],
  },
  "hal-alsa": {
    title: "Audio HAL vs ALSA",
    headers: ["", "HAL", "ALSA"],
    rows: [
      ["Audience", "Android framework", "Kernel PCM ABI"],
      ["Objects", "Devices, streams, flags", "Cards, PCMs, kcontrols"],
      ["IPC", "Binder HIDL / AIDL", "ioctl"],
    ],
  },
  "alsa-asoc": {
    title: "ALSA vs ASoC",
    headers: ["", "ALSA", "ASoC"],
    rows: [
      ["What", "PCM core + mixer ABI", "SoC wiring on top of ALSA"],
      ["You debug", "state, hw_params, XRUN", "DAI links, DAPM, machine"],
    ],
  },
  "soc-asoc": {
    title: "SoC vs ASoC",
    headers: ["", "SoC", "ASoC"],
    rows: [
      ["What", "The silicon die", "Linux driver framework"],
      ["Contains", "CPU, DAI pins, often a DSP", "Machine + platform + DAI drivers"],
      ["You debug", "Clocks, pinmux, rails", "DAI link, DAPM, FE/BE bind"],
    ],
  },
  "dai-dci": {
    title: "DAI vs DCI",
    headers: ["", "DAI", "DCI (typical datasheet)"],
    rows: [
      ["Carries", "Audio samples (I2S/TDM/SLIM)", "Registers (I2C/SPI)"],
      ["Job", "Bit clock + slots", "Mute, gain, slot map, amp EN"],
      ["If silent", "No BCLK / wrong slot", "Mute bit / EN low / wrong page"],
    ],
  },
  "dsp-dac": {
    title: "DSP vs DAC",
    headers: ["", "DSP", "DAC"],
    rows: [
      ["Does", "Compute on numbers", "Numbers → voltage"],
      ["Where", "SoC / ADSP / codec DSP", "Codec or smart amp"],
      ["Fail look", "Graph down, Flinger still ACTIVE", "RUNNING + analog mute"],
    ],
  },
  "pal-agm": {
    title: "PAL vs AGM",
    headers: ["", "PAL", "AGM"],
    rows: [
      ["Runs on", "HLOS (apps CPU)", "HLOS (apps CPU)"],
      ["Job", "Use-case / stream API under the HAL", "Build and connect the DSP graph"],
      ["Called by", "Vendor Audio HAL only", "PAL"],
      ["Not called by", "App / Flinger / Policy", "App / Flinger / Policy"],
    ],
  },
  "pcm-dai": {
    title: "PCM device vs DAI",
    headers: ["", "PCM (FE)", "DAI (often BE)"],
    rows: [
      ["What", "Device TinyALSA opens", "Serial interface + clocks"],
      ["Example", "hw:0,7 MultiMedia1", "I2S0 / TDM1"],
      ["Fail", "open EINVAL, XRUN", "No BCLK, slot shift"],
    ],
  },
  "fe-be": {
    title: "Front-end vs back-end",
    headers: ["", "Front-end", "Back-end"],
    rows: [
      ["Near", "Userspace PCM", "Pins / codec / amp"],
      ["DPCM", "Many FEs", "Many BEs"],
      ["Bind", "At use-case start", "At use-case start"],
    ],
  },
  "i2s-tdm": {
    title: "I2S vs TDM",
    headers: ["", "I2S", "TDM"],
    rows: [
      ["Slots", "Typically 2 (L then R)", "N (4, 8, 16…)"],
      ["Picture", "A 2-apartment revolving door", "Same door, more apartments"],
      ["Car use", "Headset / stereo codec", "Multi-amp, multi-mic"],
      ["Failures", "Philips vs left-justified, polarity", "Slot mask, slot width, FSYNC shift"],
    ],
  },
  "channel-slot": {
    title: "Android channel vs TDM slot",
    headers: ["", "Channel", "TDM slot"],
    rows: [
      ["What", "One sample in a PCM frame", "One time apartment on the serial wire"],
      ["When", "Same instant as other channels", "One after another inside one FSYNC"],
      ["Typical", "1 / 2 / 6 (5.1) / 8", "2 (I2S) / 8 (car amp)"],
      ["Mask", "FL|FR|C|LFE|…", "TX/RX slot bitmask"],
      ["Owner", "PCM hw_params / Flinger mix", "CPU DAI + codec DAI"],
      ["Not", "Not car XML", "Not an Android channel count"],
    ],
  },
  "usage-attributes": {
    title: "Usage vs AudioAttributes",
    headers: ["", "Usage", "AudioAttributes"],
    rows: [
      ["What", "Why (one field)", "Why + what + flags + tags"],
      ["AAOS", "Maps to context", "Full match key"],
    ],
  },
  "zone-occupant": {
    title: "Audio zone vs occupant zone",
    headers: ["", "Audio zone", "Occupant zone"],
    rows: [
      ["What", "Independent audio universe", "Seat + displays + user"],
      ["Owner", "CarAudioService", "CarOccupantZoneManager"],
      ["Link", "audioZoneId", "occupantZoneId (1:1 when mapped)"],
    ],
  },
  "focus-routing": {
    title: "Audio focus vs routing",
    headers: ["", "Focus", "Routing"],
    rows: [
      ["Question", "Who may be prominent?", "Where do bits go?"],
      ["AAOS", "Per-zone matrix", "Context → bus mix"],
    ],
  },
  "mixer-fast": {
    title: "MixerThread vs FastMixer",
    headers: ["", "MixerThread", "FastMixer"],
    rows: [
      ["Period", "Larger", "Smaller"],
      ["Effects", "More", "Restricted"],
      ["Logging", "Normal", "NBLOG preferred"],
    ],
  },
  "buffer-period": {
    title: "Buffer vs period",
    headers: ["", "Period", "Buffer"],
    rows: [
      ["Meaning", "Wake / IRQ quantum", "Jitter tank"],
      ["Math", "frames / rate", "period × count"],
    ],
  },
  "framework-dsp": {
    title: "Framework routing vs DSP routing",
    headers: ["", "Framework", "DSP (vendor)"],
    rows: [
      ["Objects", "Devices, mixes, buses", "PAL use-case, AGM graph, AFE"],
      ["File", "Policy / car XML", "ACDB / PAL / mixer_paths"],
    ],
  },
  "standby-suspend": {
    title: "Standby vs suspend",
    headers: ["", "Standby", "Suspend"],
    rows: [
      ["Owner", "Flinger / HAL per output", "Whole AP / vehicle"],
      ["Tear-down", "PCM / graph / amp", "Rails, FW, drivers"],
    ],
  },
  "core-audiocontrol": {
    title: "Core Audio HAL vs AudioControl HAL",
    headers: ["", "Core", "AudioControl"],
    rows: [
      ["Plays PCM?", "Yes", "No"],
      ["Phones?", "Yes", "No (automotive only)"],
      ["AAOS extras", "Buses as devices", "HAL focus, gain callbacks, duck/mute signals"],
    ],
  },
  "hidl-aidl": {
    title: "HIDL vs AIDL Audio HAL",
    headers: ["", "HIDL (history)", "AIDL (this course)"],
    rows: [
      ["Typical", "Android 8–13", "Android 15+"],
      ["Config", "XML as APM input", "IModule / IConfig APIs"],
      ["Entry", "IDevicesFactory + IDevice", "IModule on ServiceManager"],
      ["I/O", "IStreamOut.write", "StreamDescriptor.Command.burst"],
      ["Primary extras", "IPrimaryDevice", "ITelephony + IBluetooth"],
    ],
  },
  "sample-frame": {
    title: "Sample vs frame",
    headers: ["", "Sample", "Frame"],
    rows: [
      ["What", "One channel at one instant", "All channels at one instant"],
      ["Stereo", "L or R", "L + R together"],
      ["Rate", "Often used loosely as Hz", "ALSA / Flinger count these per second"],
      ["Size", "Bit depth / packing", "channels × bytes/sample"],
    ],
  },
  "bit-depth": {
    title: "16-bit vs 24-bit vs 32-bit",
    headers: ["", "S16_LE", "S24_3LE", "S24_LE / S32_LE"],
    rows: [
      ["Bytes/sample", "2", "3 (packed)", "4"],
      ["Useful bits", "16", "24", "24 or 32 — ask the codec"],
      ["Stereo frame", "4 bytes", "6 bytes", "8 bytes"],
      ["Fail mode", "Quantization / dither", "Odd byte counts, DMA align", "Silent high byte ≠ extra SNR"],
    ],
  },
  "pcm-path": {
    title: "Mixer vs Fast vs Direct vs Offload",
    headers: ["", "MixerThread", "FastMixer", "DirectOutputThread", "OffloadThread"],
    rows: [
      ["Still inside AudioFlinger?", "Yes", "Yes", "Yes", "Yes"],
      ["Skips the software mixer?", "No", "No", "Yes — one track", "Yes — one track"],
      ["Payload", "PCM samples", "PCM samples", "PCM as-is or compressed passthrough", "Compressed frames to DSP"],
      ["Who unpacks an MP3?", "Usually MediaCodec, then this thread", "Already PCM", "Sink (passthrough) or already PCM", "DSP"],
      ["Mix nav on this output?", "Yes (software mix/duck)", "Yes, if nav is also fast", "No", "No"],
      ["Typical period", "Larger, ~10–20 ms class", "~2–5 ms class", "Matches the stream", "Burstier, not a PCM mixer period"],
    ],
  },
};

export function getComparison(id) {
  return COMPARISONS[id] || null;
}
