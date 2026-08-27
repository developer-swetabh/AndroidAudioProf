/** Thin lesson binders. Prose stays in markdown. Diagrams reuse Architecture / Fundamentals. */

export const LESSONS = {
  "00": {
    diagramId: "six-rules",
    kicker: "Six evidence rules · no fake animation",
    related: [
      { href: "#/learn/02", label: "Next · Module 02 layers" },
      { href: "#/learn/01", label: "Module 01 · last known good" },
      { href: "#/architecture", label: "Architecture" },
    ],
  },
  "00b": {
    diagramId: "fund-embed",
    kicker: "Hz is frames/s. Period is the wake. Offload is not a mixer path.",
    args: { board: "ring" },
    related: [
      { href: "#/fundamentals", label: "Fundamentals studio" },
      { href: "#/glossary/frame", label: "Glossary · Frame" },
      { href: "#/learn/06", label: "Module 06 · Flinger threads" },
    ],
  },
  "01": {
    diagramId: "pipeline-lkg",
    kicker: "Click a layer · that is last-known-good. Investigate from here down.",
    args: { scenario: "media" },
    related: [
      { href: "#/architecture/media", label: "Architecture · phone media" },
      { href: "#/learn/02", label: "Module 02 · end-to-end" },
      { href: "#/learn/19", label: "Module 19 · debug method" },
    ],
  },
  "02": {
    diagramId: "pipeline-peers",
    kicker: "Peers in audioserver · createTrack is App → Flinger",
    args: { scenario: "media" },
    related: [
      { href: "#/architecture/media", label: "Architecture · phone media" },
      { href: "#/architecture/navduck", label: "Architecture · AAOS two-bus" },
      { href: "#/learn/03", label: "Module 03 · Policy vs Flinger" },
    ],
  },
  "02a": {
    diagramId: "pipeline-stepper",
    kicker: "Nine hops · same live edges as phone media. No tenth Binder.",
    args: { scenario: "media" },
    hops: [
      { short: "Java", layer: "app", mode: "control", line: "Java AudioTrack.Builder → JNI native_setup. createTrack is already a routing event — not play()." },
      { short: "start", layer: "app", mode: "control", line: "AudioTrack::start → IAudioTrack::start. Still the app process. No Policy Binder from the app." },
      { short: "Flinger", layer: "flinger", mode: "control", line: "Track::start on the PlaybackThread. If the thread was STANDBY, Flinger will open the HAL stream." },
      { short: "Policy", layer: "policy", mode: "control", line: "getOutputForAttr already ran during createTrack (peer). startOutput is ref-count / volume — not a new Binder from the app to Policy." },
      { short: "burst", layer: "hal", mode: "both", line: "IModule.openOutputStream → Command.start → write audio.fmq → Command.burst." },
      { short: "vendor", layer: "hal", mode: "data", line: "Vendor HAL consumes the burst: TinyALSA pcm_write, or Qualcomm-like PAL/AGM IPC. Policy is not on this path." },
      { short: "PCM", layer: "alsa", mode: "data", line: "Kernel PCM ring. RUNNING + zeros is silence, not an XRUN." },
      { short: "ASoC", layer: "alsa", mode: "data", line: "ASoC FE binds to BE DAI. DMA feeds the serializer. TDM slots are not Policy objects." },
      { short: "analog", layer: "sinkA", mode: "data", line: "DAC or smart amp EN → speaker. Digital RUNNING can still be analog mute. Analog MUX ≠ TDM slot." },
    ],
    related: [
      { href: "#/learn/02", label: "Module 02 · architecture" },
      { href: "#/architecture/media", label: "Architecture · phone media" },
      { href: "#/architecture/life/create", label: "Lifecycle · createTrack vs play()" },
      { href: "#/architecture/life/period", label: "Lifecycle · period" },
    ],
  },
  "03": {
    diagramId: "policy-flinger",
    kicker: "Decide vs execute · events vs periods · same audioserver",
    related: [
      { href: "#/learn/08", label: "Next · Module 08 HAL" },
      { href: "#/learn/02", label: "Module 02" },
      { href: "#/architecture/life/create", label: "Lifecycle · createTrack" },
      { href: "#/architecture/life/policy", label: "Lifecycle · Policy room" },
      { href: "#/learn/07", label: "Module 07 · routing" },
    ],
  },
  "04": {
    diagramId: "pipeline-io",
    kicker: "Playback: createTrack. Capture: createRecord / getInputForAttr. MediaPlayer is a producer.",
    related: [
      { href: "#/learn/02", label: "Module 02" },
      { href: "#/architecture/carplay", label: "Architecture · duplex" },
      { href: "#/learn/05", label: "Module 05 · attributes" },
    ],
  },
  "05": {
    diagramId: "meaning-focus-route",
    kicker: "Usage is a badge. Focus is right-of-way. Routing is the lane.",
    related: [
      { href: "#/glossary/usage", label: "Glossary · Usage" },
      { href: "#/glossary/focus", label: "Glossary · Focus" },
      { href: "#/learn/13", label: "Module 13 · AAOS contexts" },
    ],
  },
  "06": {
    diagramId: "lifecycle",
    kicker: "createTrack routes. play() starts the clock. Direct/Offload skip the mixer, not Flinger.",
    args: { scene: "period" },
    related: [
      { href: "#/architecture/life", label: "Lifecycle studio" },
      { href: "#/fundamentals", label: "Fundamentals · threads" },
      { href: "#/learn/08", label: "Module 08 · burst" },
      { href: "#/architecture/life/standby", label: "Lifecycle · two STANDBYs" },
    ],
  },
  "07": {
    diagramId: "ports-patch",
    kicker: "Possible ports ≠ live patch. AVAILABLE is not “Flinger moved.”",
    related: [
      { href: "#/architecture/xml/audio-policy-configuration", label: "Config · policy XML" },
      { href: "#/architecture/life/policy", label: "Lifecycle · Policy room" },
      { href: "#/learn/05", label: "Module 05 · usage" },
    ],
  },
  "08": {
    diagramId: "hal-studio",
    kicker: "Burst is the AOSP contract. After that the HAL calls TinyALSA or PAL → AGM.",
    related: [
      { href: "#/learn/10", label: "Next · Module 10 ASoC / DAI" },
      { href: "#/learn/16", label: "Module 16 · PAL / AGM" },
      { href: "#/learn/09", label: "Module 09 · ALSA" },
    ],
  },
  "09": {
    diagramId: "alsa-wheel",
    kicker: "Period is the wake. Buffer is the tank. RUNNING + zeros is not an XRUN.",
    related: [
      { href: "#/glossary/alsa", label: "Glossary · ALSA" },
      { href: "#/learn/10", label: "Module 10 · ASoC / DAI" },
      { href: "#/learn/15", label: "Module 15 · Latency" },
    ],
  },
  "10": {
    diagramId: "asoc-machine",
    kicker: "SoC is the chip. ASoC wires it. DAI carries samples. DCI is usually I2C, not music.",
    related: [
      { href: "#/learn/16", label: "Next · Module 16 PAL / AGM" },
      { href: "#/glossary/dai", label: "Glossary · DAI" },
      { href: "#/learn/11", label: "Module 11 · DAC / amp" },
    ],
  },
  "11": {
    diagramId: "mute-chain",
    kicker: "PCM RUNNING can still be analog mute. Click a valve.",
    related: [
      { href: "#/glossary/dac", label: "Glossary · DAC" },
      { href: "#/glossary/dci", label: "Glossary · DCI" },
      { href: "#/learn/16", label: "Module 16 · PAL / AGM" },
    ],
  },
  "12": {
    diagramId: "pipeline-navduck",
    kicker: "CarAudioService programs mixes. It is not a hop on the PCM path.",
    args: {
      scenario: "navduck",
      myth: "CarAudioService registers <code>AudioMix</code>es at boot. It is not a hop on the PCM path. Two contexts → two MixerThreads.",
    },
    related: [
      { href: "#/architecture/navduck", label: "Architecture · two-bus" },
      { href: "#/architecture/life/bus", label: "Lifecycle · two-bus vs shared" },
      { href: "#/architecture/xml", label: "Config XML" },
      { href: "#/learn/13", label: "Module 13 · zones" },
      { href: "#/learn/05", label: "Module 05 · usage" },
    ],
  },
  "13": {
    diagramId: "xml-studio",
    kicker: "car XML maps context → address at boot. Mix match at play(). dumpsys is what booted.",
    related: [
      { href: "#/architecture/xml/car-audio-configuration", label: "Config · car XML" },
      { href: "#/architecture/navduck", label: "Architecture · two-bus" },
      { href: "#/learn/14", label: "Module 14 · ducking" },
    ],
  },
  "14": {
    diagramId: "pipeline-navduck",
    kicker: "Hardware duck needs two HAL streams. One MixerThread cannot HW-duck.",
    args: {
      scenario: "navduck",
      myth: "Concurrent focus wants two outputs. Software mix on one MixerThread cannot hardware-duck.",
    },
    related: [
      { href: "#/architecture/navduck", label: "Architecture · two-bus" },
      { href: "#/architecture/life/bus", label: "Lifecycle · two-bus vs shared" },
      { href: "#/architecture/xml/car-audio-fade", label: "Config · fade XML" },
      { href: "#/learn/13", label: "Module 13 · buses" },
    ],
  },
  "15": {
    diagramId: "fund-embed",
    kicker: "period_ms = period_frames / rate × 1000. Work > period_ms ⇒ you will glitch.",
    args: { board: "ring" },
    related: [
      { href: "#/fundamentals", label: "Fundamentals studio" },
      { href: "#/learn/09", label: "Module 09 · XRUN" },
      { href: "#/learn/06", label: "Module 06 · FastMixer" },
    ],
  },
  "16": {
    diagramId: "qcom-stack",
    kicker: "AOSP stops at the HAL. PAL and AGM are HLOS. AFE is the DSP port. Invent no module IDs.",
    args: { scenario: "qcom" },
    related: [
      { href: "#/architecture/xml/mixer-paths", label: "Config · mixer_paths (vendor)" },
      { href: "#/glossary/pal", label: "Glossary · PAL" },
      { href: "#/glossary/agm", label: "Glossary · AGM" },
      { href: "#/learn/08", label: "Module 08 · after the HAL" },
    ],
  },
  "17": {
    diagramId: "pipeline-bt",
    kicker: "A2DP is the bluetooth HAL, not TinyALSA. Cabin speaker can be cold.",
    args: { scenario: "bt" },
    related: [
      { href: "#/architecture/bt", label: "Architecture · BT split-brain" },
      { href: "#/learn/07", label: "Module 07 · AVAILABLE" },
      { href: "#/learn/18", label: "Module 18 · power" },
    ],
  },
  "18": {
    diagramId: "pipeline-chime",
    kicker: "STANDBY means no burst yet. No PCM packets. Route can still be right.",
    args: { scenario: "chime" },
    related: [
      { href: "#/architecture/chime", label: "Architecture · chime" },
      { href: "#/architecture/life/standby", label: "Lifecycle · two STANDBYs" },
      { href: "#/learn/09", label: "Module 09 · PCM" },
      { href: "#/glossary/standby", label: "Glossary · Standby" },
    ],
  },
  "19": {
    diagramId: "debug-jump",
    kicker: "The habit is here. The engine is Debug — classify, then kill tests.",
    related: [
      { href: "#/debug", label: "Open Debug engine" },
      { href: "#/learn/01", label: "Module 01 · layers" },
      { href: "#/learn/21", label: "Module 21 · RCA" },
    ],
  },
  "20": {
    diagramId: "dump-jump",
    kicker: "Dumpsys is evidence. Service × scenario — never a stub Flinger dump.",
    related: [
      { href: "#/workbench/dump", label: "Dump lab" },
      { href: "#/learn/19", label: "Module 19 · method" },
      { href: "#/learn/08", label: "Module 08 · HAL dump" },
    ],
  },
  "21": {
    diagramId: "rca-jump",
    kicker: "Label evidence. Write five lines. Then the answer key.",
    related: [
      { href: "#/workbench/rca", label: "RCA lab" },
      { href: "#/learn/19", label: "Module 19" },
      { href: "#/learn/12", label: "Module 12 · AAOS" },
    ],
  },
  "22": {
    diagramId: "source-hops",
    kicker: "play() → createTrack → getOutputForAttr → burst. AOSP names only.",
    related: [
      { href: "#/learn/02a", label: "Module 02a · walkthrough" },
      { href: "#/learn/08", label: "Module 08 · AIDL" },
      { href: "#/learn/03", label: "Module 03 · peers" },
    ],
  },
  "23": {
    diagramId: "hidl-aidl",
    kicker: "After Android 14, new HAL APIs are AIDL-only. HIDL is a deviation.",
    related: [
      { href: "#/learn/08", label: "Module 08 · HAL" },
      { href: "#/learn/26", label: "Module 26 · AIDL sheet" },
      { href: "#/glossary", label: "Glossary · hidl-aidl" },
    ],
  },
  "24": {
    diagramId: "gate-jump",
    kicker: "Gates are demonstrations. Rank per track — not one ego number.",
    related: [
      { href: "#/progression", label: "Progression · gates A–H" },
      { href: "#/learn/00", label: "Module 00 · how to study" },
      { href: "#/learn/01", label: "Module 01 · layers" },
    ],
  },
  "25": {
    diagramId: "glossary-jump",
    kicker: "One glossary. Compare is by id, never first-word match.",
    related: [
      { href: "#/glossary", label: "Glossary" },
      { href: "#/learn/03", label: "Module 03" },
      { href: "#/learn/05", label: "Module 05" },
    ],
  },
  "26": {
    diagramId: "streamdescriptor",
    kicker: "API sheet · same StreamDescriptor studio as Module 08",
    related: [
      { href: "#/learn/08", label: "Module 08 · HAL lesson" },
      { href: "#/glossary/burst", label: "Glossary · burst" },
      { href: "#/architecture", label: "Architecture" },
    ],
  },
};

const FALLBACK_RELATED = [
  { href: "#/architecture", label: "Architecture" },
  { href: "#/fundamentals", label: "Fundamentals" },
  { href: "#/glossary", label: "Glossary" },
];

export function getLesson(id) {
  return LESSONS[id] || { diagramId: null, kicker: "", related: FALLBACK_RELATED, args: {}, hops: null };
}
