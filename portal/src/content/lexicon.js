/** Junior decoder for hardware/HLOS words.
 *  Home module is the lesson that owns the term — do not dump every acronym on every page. */

export const LEXICON = {
  soc: {
    name: "SoC",
    expands: "System on Chip",
    home: "10",
    junior: "The main computer chip in the phone or car: CPU cores, often a DSP, and the audio pins.",
    who: "Everything Android runs on the SoC’s CPU. The audio serial pins also come out of this chip.",
    not: "Not a driver. Not ASoC. The chip vs the Linux framework that wires it.",
  },
  asoc: {
    name: "ASoC",
    expands: "ALSA System on Chip",
    home: "10",
    junior: "The Linux factory floor plan: which CPU pin, which DMA, which codec, how they clock.",
    who: "Kernel drivers. Android never calls ASoC by name — TinyALSA opens a PCM that ASoC already wired.",
    not: "Not ALSA itself. ASoC sits on top of ALSA PCM.",
  },
  alsa: {
    name: "ALSA",
    expands: "Advanced Linux Sound Architecture",
    home: "09",
    junior: "The kernel’s sound engine: PCM devices, states (RUNNING, XRUN), mixers.",
    who: "Userspace (TinyALSA or the HAL) talks to ALSA with ioctl. Policy never pcm_open.",
    not: "Not PulseAudio. Not ASoC. Not the speaker.",
  },
  dai: {
    name: "DAI",
    expands: "Digital Audio Interface",
    home: "10",
    junior: "The serial audio cable on the board: I2S, TDM, SLIMbus, or SoundWire. This is where samples become pin wiggles.",
    who: "ASoC CPU DAI and codec/amp DAI must agree on clocks and TDM slots.",
    not: "Not the ALSA PCM number. Not car XML. Not I2C.",
  },
  dci: {
    name: "DCI",
    expands: "Digital Control Interface (typical codec/amp datasheet)",
    home: "11",
    junior: "Usually the I2C or SPI bus that sets mute, gain, and slot maps. It does not carry the music samples.",
    who: "HAL, PAL/AGM, or a codec driver writes registers here. Parallel to the DAI, not instead of it.",
    not: "Not DAI. If your schematic labels the I2S bus “DCI”, treat it as the DAI until the datasheet says it is I2C.",
  },
  dsp: {
    name: "DSP",
    expands: "Digital Signal Processor",
    home: "16",
    junior: "A second computer that lives for audio: mix, EQ, echo cancel, decode. On Qualcomm products the audio one is often called ADSP (Hexagon).",
    who: "Vendor HAL/PAL/AGM start graphs on the DSP. AudioFlinger does not program DSP modules.",
    not: "Not AudioFlinger. Not the DAC. Flinger can look healthy while the DSP graph is down.",
  },
  dac: {
    name: "DAC",
    expands: "Digital-to-Analog Converter",
    home: "11",
    junior: "Turns numbers into voltage. Lives in a codec, or inside a smart amp (many cars have no separate codec DAC).",
    who: "After the DAI. Digital RUNNING does not prove the DAC is unmuted.",
    not: "Not the DSP. Not TDM. Not a Policy object.",
  },
  pal: {
    name: "PAL",
    expands: "Platform Abstraction Layer",
    home: "16",
    junior: "Qualcomm’s userspace library under the vendor HAL. Think “use-case objects” (media, voice, a bus) instead of raw mixer strings.",
    who: "Only the vendor Audio HAL calls PAL. Apps, AudioFlinger, and AudioPolicy never do.",
    not: "Not AOSP. Not AGM. Not the DSP. Older chips may have no PAL (legacy mixer_paths HAL).",
  },
  agm: {
    name: "AGM",
    expands: "Audio Graph Manager",
    home: "16",
    junior: "The HLOS piece that actually builds the DSP graph for a PAL use-case: which processing blocks, connected how, to which AFE port.",
    who: "PAL calls AGM. AGM talks to the ADSP over GPR/IPC. Flinger never calls AGM.",
    not: "Not PAL. Not AudioPolicy. “Graph not built” is AGM/DSP, not a wrong bus in car XML.",
  },
  afe: {
    name: "AFE",
    expands: "Audio Front End (DSP port)",
    home: "16",
    junior: "The DSP’s doorway toward the DAI/codec. Graph can be up and AFE still not started — pins stay quiet.",
    who: "AGM/DSP start AFE after the graph is built. Not an Android device port.",
    not: "Not TinyALSA pcm_open. IDs are vendor-specific — do not invent them.",
  },
  hlos: {
    name: "HLOS",
    expands: "High-Level Operating System",
    home: "16",
    junior: "The apps processor’s Linux (where Android, the HAL, PAL, and AGM run). The ADSP is a different computer.",
    who: "PAL and AGM are HLOS programs. The audio graph runs on the DSP.",
    not: "Not the DSP. Crossing HLOS→DSP is IPC (GPR), not Binder.",
  },
};

export function lexiconItems(ids) {
  return ids.map((id) => (LEXICON[id] ? { id, ...LEXICON[id] } : null)).filter(Boolean);
}
