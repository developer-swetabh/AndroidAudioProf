/** Dump-lab scenarios. Dump *text* lives in debugDumps.js — this file only points at keys. */

import { SERVICES, dumpServiceOf, getDump } from "./debugDumps.js";

export const DUMP_SCENARIOS = [
  {
    id: "healthy-media",
    name: "Healthy media",
    product: "aaos",
    blurb: "Cabin has sound. Learn this shape so 02–08 look wrong.",
    hunt: "What does (t1−t0) prove at 48 kHz? Is the nav thread a bug?",
    look: "Join address, session, t1−t0 frames, StreamDescriptor vs software standby.",
    dumps: [
      "flinger/healthy-media",
      "policy/healthy-aaos",
      "car/healthy",
      "audio/healthy",
      "hal/active",
      "alsa/healthy",
    ],
    guns: {
      "flinger/healthy-media": ["observable.frames", "StreamDescriptor.state=ACTIVE", "bus0_media_out"],
      "policy/healthy-aaos": ["Patch:", "bus0_media_out"],
      "car/healthy": ["contexts: MUSIC", "uid=10080"],
    },
    notes: {
      "flinger/healthy-media": [
        { match: "MIXER", label: "PlaybackThread type — software mix, not Direct/Offload" },
        { match: "bus0_media_out", label: "AAOS bus — join to Policy mix and Car context" },
        { match: "software standby=no", label: "Flinger thread power machine — not HAL StreamDescriptor" },
        { match: "StreamDescriptor.state=ACTIVE", label: "AIDL I/O machine. HAL STANDBY is a different word." },
        { match: "t0=480000  t1=528000", label: "48000 frames ≈ 1 s at 48 kHz — motion" },
      ],
    },
    workbook: "01",
    debug: null,
    qcom: false,
  },
  {
    id: "wrong-usage",
    name: "Wrong usage",
    product: "aaos",
    blurb: "Nav UI speaking. Nav volume group does nothing.",
    hunt: "Which bus is session 129 on, and why? Is this an IModule bug?",
    look: "Track usage vs CarAudioContext. bus1 STANDBY is consistent with MEDIA.",
    dumps: ["flinger/wrong-usage", "policy/wrong-usage", "car/wrong-usage"],
    guns: {
      "flinger/wrong-usage": ["session=129", "bus1_navigation_out"],
      "policy/wrong-usage": ["session 129 is MEDIA"],
      "car/wrong-usage": ["uid=10095 usage=MEDIA"],
    },
    notes: {
      "flinger/wrong-usage": [
        { match: "session=129", label: "Nav APK, but usage=MEDIA — matched MUSIC mix" },
        { match: "bus1_navigation_out", label: "Nav thread correctly idle. Not a HAL bug." },
      ],
    },
    workbook: "02",
    debug: "wrong-bus",
    qcom: false,
  },
  {
    id: "shared-bus",
    name: "Shared bus, no HW duck",
    product: "aaos",
    blurb: "Nav + media both full scale. DSP blamed.",
    hunt: "How many HAL streams does the DSP see? Can hardware duck exist?",
    look: "One MixerThread, one IModule stream, two tracks at vol=1.0.",
    dumps: ["flinger/shared-bus", "policy/shared-bus", "car/shared-bus"],
    guns: {
      "flinger/shared-bus": ["ONE MixerThread", "vol=1.000"],
      "policy/shared-bus": ["same bus0_media_out"],
      "car/shared-bus": ["context NAVIGATION"],
    },
    notes: {
      "flinger/shared-bus": [
        { match: "ONE MixerThread", label: "One mixport → one PCM at the DSP" },
        { match: "NAVIGATION", label: "Usage is right; the address map is not" },
      ],
    },
    workbook: "03",
    debug: "shared-bus",
    qcom: false,
  },
  {
    id: "standby-chime",
    name: "First chime / STANDBY",
    product: "aaos",
    blurb: "Route is right. One-shot died in STANDBY.",
    hunt: "Is this an XRUN? Which AIDL command is late vs the WAV?",
    look: "Track ACTIVE, StreamDescriptor STANDBY, framesWritten already done.",
    dumps: ["flinger/standby-chime", "hal/standby-late"],
    guns: {
      "flinger/standby-chime": ["StreamDescriptor.state=STANDBY", "framesWritten=9600"],
      "hal/standby-late": ["WAV ended", "Command.start"],
    },
    notes: {
      "flinger/standby-chime": [
        { match: "software standby=yes", label: "Flinger thread still leaving standby" },
        { match: "StreamDescriptor.state=STANDBY", label: "HAL I/O not open. Not Flinger track state." },
        { match: "framesWritten=9600", label: "App already finished a 200 ms WAV" },
      ],
    },
    workbook: "04",
    debug: "standby-chime",
    qcom: false,
  },
  {
    id: "stream-error",
    name: "Stream ERROR",
    product: "aaos",
    blurb: "8ch media silent. 2ch still works. Track still writes.",
    hunt: "Did Policy lie? What does ERROR allow next? AOSP vs vendor?",
    look: "StreamDescriptor.ERROR is terminal. observable.frames=UNKNOWN.",
    dumps: ["flinger/stream-error", "policy/profile-8ch", "hal/error"],
    guns: {
      "flinger/stream-error": ["StreamDescriptor.state=ERROR", "observable.frames=UNKNOWN"],
      "policy/profile-8ch": ["OUT_7POINT1"],
      "hal/error": ["ERROR", "EINVAL"],
    },
    notes: {
      "flinger/stream-error": [
        { match: "ERROR", label: "Only legal next step is IStreamCommon.close" },
        { match: "framesWritten increasing", label: "Client still pushing into a dead stream" },
      ],
      "hal/error": [{ match: "pal/graph", label: "Vendor path — do not invent PAL module IDs" }],
    },
    workbook: "05",
    debug: "stream-error",
    qcom: true,
  },
  {
    id: "overlap-aa-radio",
    name: "AA → radio overlap",
    product: "aaos",
    blurb: "Two MEDIA tracks ~300 ms on one bus. Do not HAL-mute it.",
    hunt: "Why is a BUS mute the wrong lever? Did fade actually run?",
    look: "Two ACTIVE tracks vol=1.0. PAUSES_ON_DUCKABLE_LOSS blocks fade.",
    dumps: [
      "flinger/overlap-aa-radio",
      "policy/overlap-same-bus",
      "audio/overlap-fade-blocked",
      "perfetto/overlap",
      "qxdm/afe-busy",
    ],
    guns: {
      "flinger/overlap-aa-radio": ["two writers", "vol=1.0"],
      "audio/overlap-fade-blocked": ["PAUSES_ON_DUCKABLE_LOSS", "return false"],
      "policy/overlap-same-bus": ["muting that BUS"],
    },
    notes: {
      "audio/overlap-fade-blocked": [
        { match: "PAUSES_ON_DUCKABLE_LOSS", label: "AOSP canCauseFadeOut returns false — fade XML never runs" },
      ],
      "qxdm/afe-busy": [{ match: "busy AFE", label: "QXDM last. DSP is playing the mix Flinger already made." }],
    },
    workbook: "06",
    debug: "overlap",
    qcom: true,
  },
  {
    id: "carmedia-race",
    name: "CarMedia init race",
    product: "aaos",
    blurb: "3/10 no music after a source switch. Focus looked fine.",
    hunt: "Why can focus be perfect and the cabin still silent? What does 3/10 tell you?",
    look: "mSharedPrefs null, mPendingInit false, MediaConnection never started.",
    dumps: ["flinger/carmedia-idle", "audio/carmedia-focus-ok", "car/carmedia-uninit"],
    guns: {
      "car/carmedia-uninit": ["mPendingInit=false", "not initialized"],
      "audio/carmedia-focus-ok": ["red herring"],
      "flinger/carmedia-idle": ["no new MEDIA track"],
    },
    notes: {
      "car/carmedia-uninit": [
        { match: "mPendingInit=false", label: "Nobody armed deferred initUser() for unlock/visible" },
        { match: "MediaConnection", label: "CarMedia never started the selected source" },
      ],
    },
    workbook: "07",
    debug: null,
    qcom: false,
  },
  {
    id: "assistant-loss",
    name: "Assistant ignores LOSS",
    product: "aaos",
    blurb: "Exclusive LOSS delivered. Assistant still mixed. Ringtone missing.",
    hunt: "Why MediaFocusControl and not the HAL? Danger of matching every ASSISTANCE_* ?",
    look: "USAGE_ASSISTANT still ACTIVE after LOSS. Mute the player, not the bus.",
    dumps: ["flinger/assistant-still", "audio/assistant-loss", "policy/assistant-ring"],
    guns: {
      "audio/assistant-loss": ["still ACTIVE", "INTERACTION_EXCLUSIVE"],
      "flinger/assistant-still": ["USAGE_ASSISTANT", "BUS00_MEDIA"],
    },
    notes: {
      "audio/assistant-loss": [
        { match: "USAGE_ASSISTANT", label: "Not USAGE_ASSISTANCE. Do not mute NAVIGATION or SONIFICATION." },
        { match: "unfadeable", label: "AOSP auto-fade is MEDIA/GAME only" },
      ],
    },
    workbook: "08",
    debug: null,
    qcom: false,
  },
  {
    id: "xrun",
    name: "Glitch / XRUN",
    product: "both",
    blurb: "Periodic chop. Path looks routed.",
    hunt: "Is ALSA in XRUN, or RUNNING with late mixer slices?",
    look: "xrunFrames climbing. Perfetto mixer slice vs period_ms. RUNNING+zeros is not this.",
    dumps: ["flinger/xrun", "alsa/xrun", "perfetto/deadline"],
    guns: {
      "flinger/xrun": ["xrunFrames climbing"],
      "alsa/xrun": ["state: XRUN"],
      "perfetto/deadline": ["period_ms"],
    },
    notes: {
      "alsa/xrun": [{ match: "XRUN", label: "Kernel state. Not RUNNING. prepare → start after EPIPE." }],
    },
    workbook: null,
    debug: "xrun",
    qcom: false,
  },
  {
    id: "bt-split",
    name: "BT split-brain",
    product: "both",
    blurb: "Cabin silent. Frames still increment on A2DP.",
    hunt: "Is AVAILABLE a live headset? Which IModule is I/O?",
    look: "A2DP thread ACTIVE, SPEAKER STANDBY. Policy still patched to A2DP.",
    dumps: ["flinger/bt-a2dp", "policy/stale-a2dp"],
    guns: {
      "flinger/bt-a2dp": ["BLUETOOTH_A2DP", "SPEAKER"],
      "policy/stale-a2dp": ["AVAILABLE", "Live patch"],
    },
    notes: {
      "policy/stale-a2dp": [{ match: "AVAILABLE", label: "Not “headset is alive.” Flinger thread is the live evidence." }],
    },
    workbook: null,
    debug: "bt-split",
    qcom: false,
  },
  {
    id: "vendor-mute",
    name: "AOSP green, cabin mute",
    product: "both",
    blurb: "Flinger ACTIVE. Speaker dead. Vendor graph.",
    hunt: "Where does AOSP stop? What would QXDM add after Flinger looks healthy?",
    look: "Do not invent PAL module IDs. dumpsys will not name PAL sessions.",
    dumps: ["flinger/vendor-green", "hal/active", "alsa/running-zeros", "qxdm/graph-down"],
    guns: {
      "flinger/vendor-green": ["AOSP looks healthy"],
      "alsa/running-zeros": ["RUNNING"],
      "qxdm/graph-down": ["graph not built"],
    },
    notes: {
      "qxdm/graph-down": [{ match: "PAL/AGM", label: "HLOS/DSP — Flinger never calls PAL" }],
      "alsa/running-zeros": [{ match: "Zeros", label: "Digital path alive. Silence can still be zeros in the ring." }],
    },
    workbook: null,
    debug: "vendor-mute",
    qcom: true,
  },
  {
    id: "distortion-tdm",
    name: "Distortion / TDM",
    product: "both",
    blurb: "Harsh, chop, pitch, or garbled channels. Capture first.",
    hunt: "XRUN chop vs mix clip vs clock vs TDM slot vs DSP.",
    look: "xrunFrames, track count, mixer slice vs period_ms, slot map vs car XML.",
    dumps: ["flinger/clip-mix", "perfetto/deadline", "qxdm/clip", "alsa/tdm-shift"],
    guns: {
      "flinger/clip-mix": ["vol=1.000", "xrunFrames=0"],
      "alsa/tdm-shift": ["FSYNC", "slot"],
      "qxdm/clip": ["clip"],
    },
    notes: {
      "alsa/tdm-shift": [{ match: "slot map", label: "TDM slot ≠ channel. car XML does not program slots." }],
      "flinger/clip-mix": [{ match: "two full-scale", label: "Software mix of two full-scale streams — not XRUN" }],
    },
    workbook: null,
    debug: "distortion",
    qcom: true,
  },
];

export function getDumpScenario(id) {
  return DUMP_SCENARIOS.find((s) => s.id === id) || null;
}

export function dumpIdsFor(scenario, serviceId) {
  if (!scenario) return [];
  return (scenario.dumps || []).filter((id) => dumpServiceOf(id) === serviceId);
}

export function servicesOn(scenario) {
  return [...new Set((scenario?.dumps || []).map(dumpServiceOf))];
}

export function productLabel(product) {
  if (product === "aaos") return "AAOS";
  if (product === "phone") return "Phone";
  return "AOSP + AAOS";
}

/** Scenario rail: keep the service if this scenario has it; otherwise first dump's service. Dimmed chips still deep-link to empty pairs. */
export function dumpHref(serviceId, scenario) {
  const have = servicesOn(scenario);
  const svc = have.includes(serviceId) ? serviceId : have[0] || serviceId;
  return `#/workbench/dump/${svc}/${scenario.id}`;
}

export function resolveDumpLab(serviceId, scenarioId) {
  const sc = getDumpScenario(scenarioId) || DUMP_SCENARIOS[0];
  const known = SERVICES.some((s) => s.id === serviceId);
  const svc = known ? serviceId : dumpServiceOf(sc.dumps[0]);
  const ids = dumpIdsFor(sc, svc);
  const dumps = ids.map(getDump).filter(Boolean);
  return {
    scenario: sc,
    serviceId: svc,
    service: SERVICES.find((s) => s.id === svc) || SERVICES[0],
    ids,
    dumps,
    hasDump: dumps.length > 0,
  };
}
