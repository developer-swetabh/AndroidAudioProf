/** Module 24 gates. Rank per track — do not lock G because F is open. */

import { LAYERS } from "./architecture.js";
import { MODULES } from "./catalog.js";

export const GATES = [
  {
    id: "A",
    title: "Concepts",
    from: "Junior developer",
    rung: "Understands Android audio concepts",
    skill: "You can explain without notes: Policy vs Flinger; usage vs focus vs volume; period vs buffer; FE vs BE.",
    test: "Teach a new hire Module 03 and 05 in 20 minutes.",
    modules: ["03", "05", "00b"],
    labs: [
      { href: "#/glossary", label: "Glossary" },
      { href: "#/fundamentals", label: "Fundamentals studio" },
    ],
  },
  {
    id: "B",
    title: "Architecture",
    from: "Understands Android audio concepts",
    rung: "Understands AOSP audio architecture",
    skill: "You can draw the corrected end-to-end map and mark Binder, ioctl, and clocks. createTrack is App → Flinger; Policy is a peer.",
    test: "Given “nav + media,” draw AAOS vs phone.",
    modules: ["02", "12"],
    labs: [
      { href: "#/architecture/media", label: "Architecture · phone media" },
      { href: "#/architecture/navduck", label: "Architecture · two-bus" },
    ],
  },
  {
    id: "C",
    title: "Source",
    from: "Understands AOSP audio architecture",
    rung: "Can read AudioFlinger / AudioPolicy",
    skill: "You can find getOutputForAttr and threadLoop on your branch in 5 minutes and say what they return/do.",
    test: "Walk play() to AIDL Command.burst (then vendor pcm_write if present) with tabs open, narrating process hops.",
    modules: ["02a", "22", "03"],
    labs: [{ href: "#/learn/22", label: "Module 22 · source hops" }],
  },
  {
    id: "D",
    title: "Dumps",
    from: "Can read AudioFlinger / AudioPolicy",
    rung: "Can trace audio end-to-end",
    skill: "You can annotate a Flinger+Policy pair and name last-known-good. Dump twice for motion.",
    test: "Module 20 practice on a live emulator — or Dump lab · healthy media, then RCA case 01.",
    modules: ["20", "01"],
    labs: [
      { href: "#/workbench/dump/flinger/healthy-media", label: "Dump lab · healthy" },
      { href: "#/workbench/rca/01", label: "RCA · case 01" },
      { href: "#/learn/20", label: "Module 20" },
    ],
  },
  {
    id: "E",
    title: "HAL / ALSA",
    from: "Can trace audio end-to-end",
    rung: "Can debug HAL / ALSA",
    skill: "You can convert a pcm_config to milliseconds and interpret RUNNING vs XRUN vs zeros. HAL STANDBY is not Flinger thread standby.",
    test: "tinyplay bypass on a real board; write the split.",
    modules: ["09", "15", "08"],
    labs: [
      { href: "#/workbench/dump/alsa/xrun", label: "Dump lab · XRUN" },
      { href: "#/fundamentals", label: "PCM math" },
      { href: "#/learn/09", label: "Module 09" },
    ],
  },
  {
    id: "F",
    title: "Vendor",
    from: "Can debug HAL / ALSA",
    rung: "Can debug Qualcomm DSP (when present)",
    skill: "You refuse to invent PAL/ACDB names; you still write a vendor hypothesis. Flinger never calls PAL.",
    test: "Module 21 case study 6 (Qualcomm cal miss) from memory. QXDM last.",
    modules: ["16", "21"],
    labs: [
      { href: "#/learn/16", label: "Module 16 · DSP" },
      { href: "#/workbench/dump/qxdm/vendor-mute", label: "Dump lab · vendor mute" },
      { href: "#/workbench/rca/05", label: "RCA · stream ERROR" },
    ],
    qcom: true,
  },
  {
    id: "G",
    title: "AAOS",
    from: "Can debug Qualcomm DSP (when present)",
    rung: "Can debug AAOS multi-zone",
    skill: "You can read car XML and predict Flinger addresses for two users. Two contexts on one bus ⇒ one PCM at the DSP.",
    test: "Explain cast vs mirror vs zone config switch. Shared-bus case 03. Overlap case 06 does not get a bus mute.",
    modules: ["12", "13", "14"],
    labs: [
      { href: "#/architecture/xml", label: "Config XML studio" },
      { href: "#/architecture/navduck", label: "Two-bus nav+media" },
      { href: "#/workbench/rca/03", label: "RCA · shared bus" },
      { href: "#/workbench/rca/06", label: "RCA · overlap" },
    ],
  },
  {
    id: "H",
    title: "Architect",
    from: "Independent audio engineer",
    rung: "Audio architect",
    skill: "You can design a bus map, focus matrix implications, power budget, and test plan for a new ECU amp — and list what you would demand from DSP and apps.",
    test: "Write a one-page audio architecture for “driver + RSE + ADAS chimes” and defend every shared bus.",
    modules: ["24", "18", "14"],
    labs: [
      { href: "#/learn/24", label: "Module 24" },
      { href: "#/architecture/chime", label: "Architecture · chime" },
    ],
  },
];

export const MATRIX_DEPTHS = [
  { id: "concepts", name: "Concepts" },
  { id: "architecture", name: "Architecture" },
  { id: "source", name: "Source" },
  { id: "dumps", name: "Dumps" },
  { id: "debug", name: "Debug" },
];

export const MATRIX_LAYERS = LAYERS.filter((l) => l.process).sort((a, b) => a.n - b.n);

export const ENGINEER_HABITS = [
  "Classify the platform before naming APIs.",
  "Write competing hypotheses on different layers.",
  "Dump twice.",
  "Convert frames to milliseconds.",
  "Separate AOSP from vendor in every sentence.",
  "Ask for four pieces of evidence, not a zip bomb.",
  "State confidence and what would reduce it.",
  "After a fix, list regressions (power, first-prompt, AEC, other zone).",
];

export const ARCHITECT_HABITS = [
  "Design concurrency in hardware where the product sentence requires it.",
  "Treat focus as insufficient for safety.",
  "Budget latency and bring-up, not only steady-state.",
  "Make XML/HAL/ACDB the same story (one address, one use case, one AFE).",
  "Specify factory tests: tinyplay per bus, fault bits, zone switch, ACC off/on.",
  "Say no to “one bus to keep it simple” when it deletes ducking.",
  "Document clock owners per use case (media vs voice vs BT).",
];

export function getGate(id) {
  return GATES.find((g) => g.id === id) || GATES[0];
}

export function strongestGate(done) {
  let last = null;
  for (const g of GATES) if (done[g.id]) last = g;
  return last;
}

export function firstOpenGate(done) {
  return GATES.find((g) => !done[g.id]) || null;
}

export function nextModule(done, learned) {
  const gate = firstOpenGate(done);
  const learnedSet = new Set(learned || []);
  const pool = gate ? gate.modules : MODULES.map((m) => m.id);
  const id = pool.find((mid) => !learnedSet.has(mid)) || pool[0];
  return MODULES.find((m) => m.id === id) || null;
}

export function weakestDepth(matrix) {
  let worst = MATRIX_DEPTHS[0];
  let min = Infinity;
  for (const d of MATRIX_DEPTHS) {
    const n = MATRIX_LAYERS.filter((l) => matrix[cellKey(l.id, d.id)]).length;
    if (n < min) {
      min = n;
      worst = d;
    }
  }
  return { depth: worst, count: min, total: MATRIX_LAYERS.length };
}

export function cellKey(layerId, depthId) {
  return `${layerId}:${depthId}`;
}
