/** Single catalog of curriculum modules. Learn, Home, and search all read this. */

export const TRACKS = [
  {
    id: "t0",
    title: "Foundations",
    modules: [
      { id: "00", file: "00-how-to-use-this-course.md", title: "How to Use This Course", mins: 18, diagramId: "six-rules" },
      { id: "00b", file: "00b-digital-audio-fundamentals.md", title: "Sound as Numbers", mins: 22, diagramId: "fund-embed" },
      { id: "01", file: "01-think-in-layers.md", title: "Think in Layers", mins: 22, diagramId: "pipeline-lkg" },
      { id: "02", file: "02-end-to-end-android-audio-architecture.md", title: "End-to-End Architecture", mins: 28, diagramId: "pipeline-peers" },
      { id: "02a", file: "02a-playback-walkthrough.md", title: "Playback Walkthrough", mins: 24, diagramId: "pipeline-stepper" },
    ],
  },
  {
    id: "t1",
    title: "Core stack",
    modules: [
      { id: "03", file: "03-audio-policy-vs-audioflinger.md", title: "AudioPolicy vs AudioFlinger", mins: 22, diagramId: "policy-flinger" },
      { id: "04", file: "04-audiotrack-audiorecord-media-apis.md", title: "AudioTrack, AudioRecord & Media APIs", mins: 20, diagramId: "pipeline-io" },
      { id: "05", file: "05-audio-attributes-usage-and-focus.md", title: "Attributes, Usage & Focus", mins: 25, diagramId: "meaning-focus-route" },
      { id: "06", file: "06-audioflinger-internals.md", title: "AudioFlinger Internals", mins: 30, diagramId: "fund-embed" },
      { id: "07", file: "07-audiopolicy-routing-and-devices.md", title: "AudioPolicy Routing & Devices", mins: 26, diagramId: "ports-patch" },
      { id: "08", file: "08-audio-hal-legacy-hidl-aidl.md", title: "Audio HAL (HIDL → AIDL)", mins: 28, diagramId: "hal-studio" },
      { id: "09", file: "09-alsa-tinyalsa-and-pcm.md", title: "ALSA, TinyALSA & PCM", mins: 22, diagramId: "alsa-wheel" },
      { id: "10", file: "10-asoc-dai-dma-i2s-tdm.md", title: "ASoC, DAI, DMA, I2S, TDM", mins: 22, diagramId: "asoc-machine" },
      { id: "11", file: "11-codec-amplifier-and-hardware-path.md", title: "Codec, Amplifier & Hardware", mins: 20, diagramId: "mute-chain" },
    ],
  },
  {
    id: "t2",
    title: "Automotive",
    modules: [
      { id: "12", file: "12-aaos-car-audio-architecture.md", title: "AAOS Car Audio Architecture", mins: 24, diagramId: "pipeline-navduck" },
      { id: "13", file: "13-aaos-zones-volume-groups-and-routing.md", title: "Zones, Volume Groups & Routing", mins: 26, diagramId: "xml-studio" },
      { id: "14", file: "14-concurrency-mixing-and-ducking.md", title: "Concurrency, Mixing & Ducking", mins: 22, diagramId: "pipeline-navduck" },
      { id: "17", file: "17-bluetooth-usb-hdmi.md", title: "Bluetooth, USB & HDMI", mins: 20, diagramId: "pipeline-bt" },
    ],
  },
  {
    id: "t3",
    title: "Performance",
    modules: [
      { id: "15", file: "15-latency-buffering-and-xruns.md", title: "Latency, Buffering & XRUNs", mins: 24, diagramId: "fund-embed" },
      { id: "16", file: "16-qualcomm-audio-and-dsp.md", title: "Qualcomm Audio & DSP", mins: 26, diagramId: "qcom-stack" },
      { id: "18", file: "18-power-suspend-resume.md", title: "Power, Suspend & Resume", mins: 18, diagramId: "pipeline-chime" },
      { id: "26", file: "26-android15-aidl-reference.md", title: "Android 15 AIDL Reference", mins: 20, diagramId: "streamdescriptor" },
    ],
  },
  {
    id: "t4",
    title: "Practice",
    modules: [
      { id: "19", file: "19-debugging-methodology.md", title: "Debugging Methodology", mins: 20, diagramId: "debug-jump" },
      { id: "20", file: "20-logs-dumps-and-traces.md", title: "Logs, Dumps & Traces", mins: 22, diagramId: "dump-jump" },
      { id: "21", file: "21-root-cause-analysis-and-case-studies.md", title: "RCA & Case Studies", mins: 24, diagramId: "rca-jump" },
      { id: "22", file: "22-source-code-navigation.md", title: "Source Code Navigation", mins: 16, diagramId: "source-hops" },
      { id: "23", file: "23-android-version-evolution.md", title: "Android Version Evolution", mins: 16, diagramId: "hidl-aidl" },
      { id: "24", file: "24-from-junior-to-architect.md", title: "From Junior to Architect", mins: 14, diagramId: "gate-jump" },
      { id: "25", file: "25-glossary-and-comparisons.md", title: "Glossary & Comparisons", mins: 18, diagramId: "glossary-jump" },
    ],
  },
];

export const MODULES = TRACKS.flatMap((track) =>
  track.modules.map((m) => ({ ...m, trackId: track.id, trackTitle: track.title })),
);

export function getModule(id) {
  return MODULES.find((m) => m.id === id) || MODULES[0];
}

export function getNeighbors(id) {
  const i = MODULES.findIndex((m) => m.id === id);
  return { prev: MODULES[i - 1] || null, next: MODULES[i + 1] || null };
}
