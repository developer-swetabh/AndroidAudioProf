import { CHANNELS, FORMATS, PERIOD_COUNTS, RATES, TDM_SLOTS, metricText } from "../lib/audioMath.js";

const PRESETS = [
  { id: "media", label: "Media 48k", rate: 48000, channels: 2, format: "S16_LE", periodFrames: 960, periodCount: 4, path: "pcm", tdmSlots: 2 },
  { id: "fast", label: "Fast 48k", rate: 48000, channels: 2, format: "S16_LE", periodFrames: 192, periodCount: 2, path: "pcm", tdmSlots: 2 },
  { id: "voice", label: "Voice 16k", rate: 16000, channels: 1, format: "S16_LE", periodFrames: 160, periodCount: 2, path: "pcm", tdmSlots: 2 },
  { id: "cd", label: "44.1k CD", rate: 44100, channels: 2, format: "S16_LE", periodFrames: 512, periodCount: 4, path: "pcm", tdmSlots: 2 },
  { id: "gold", label: "Golden 5 ms", rate: 48000, channels: 2, format: "S16_LE", periodFrames: 240, periodCount: 4, path: "pcm", tdmSlots: 2 },
];

export function controlsHtml(m, { extras = true } = {}) {
  return `
    <div class="pcm-controls" data-pcm-controls>
      <div class="pcm-presets">
        ${PRESETS.map((p) => `<button type="button" class="btn-ghost" data-preset="${p.id}">${p.label}</button>`).join("")}
      </div>
      <label>Sample rate
        <select data-pcm="rate">${RATES.map((r) => `<option value="${r}" ${r === m.rate ? "selected" : ""}>${r === 44100 ? "44.1 kHz" : r / 1000 + " kHz"}</option>`).join("")}</select>
      </label>
      <label>Channels
        <select data-pcm="channels">${CHANNELS.map((c) => `<option value="${c}" ${c === m.channels ? "selected" : ""}>${c === 1 ? "1 · mono" : c === 2 ? "2 · stereo" : c + " ch"}</option>`).join("")}</select>
      </label>
      <label>Bit depth
        <select data-pcm="format">${Object.values(FORMATS).map((f) => `<option value="${f.id}" ${f.id === m.format ? "selected" : ""}>${f.label}</option>`).join("")}</select>
      </label>
      <label>Period frames
        <input type="range" data-pcm="periodFrames" min="32" max="2048" step="16" value="${m.periodFrames}">
        <span data-m="periodFrames">${m.periodFrames}</span>
      </label>
      <label>Period count
        <select data-pcm="periodCount">${PERIOD_COUNTS.map((n) => `<option value="${n}" ${n === m.periodCount ? "selected" : ""}>${n}</option>`).join("")}</select>
      </label>
      ${extras ? `
      <label>TDM slots
        <select data-pcm="tdmSlots">${TDM_SLOTS.map((n) => `<option value="${n}" ${n === m.tdmSlots ? "selected" : ""}>${n}</option>`).join("")}</select>
      </label>
      <label>Flinger thread
        <select data-pcm="path">
          <option value="pcm" ${m.path === "pcm" ? "selected" : ""}>MixerThread · PCM mix</option>
          <option value="fast" ${m.path === "fast" ? "selected" : ""}>FastMixer · low-lat PCM</option>
          <option value="direct" ${m.path === "direct" ? "selected" : ""}>DirectOutputThread · no mix</option>
          <option value="offload" ${m.path === "offload" ? "selected" : ""}>OffloadThread · DSP decode</option>
        </select>
      </label>` : ""}
    </div>`;
}

export function metricsHtml() {
  const keys = [
    ["periodMs", "Period"],
    ["bufferMs", "Buffer"],
    ["frameSize", "Frame size"],
    ["periodBytes", "Bytes/period"],
    ["irqHz", "IRQ rate"],
    ["bytesPerSec", "Wire rate"],
  ];
  return `<div class="metric-bar" data-metric-bar>
    ${keys.map(([k, l]) => `<div class="metric"><div class="v" data-m="${k}">—</div><div class="l">${l}</div></div>`).join("")}
  </div>`;
}

export function paintMetrics(root, m) {
  root.querySelectorAll("[data-m]").forEach((el) => {
    const k = el.dataset.m;
    if (k === "periodFrames") el.textContent = String(m.periodFrames);
    else el.textContent = metricText(k, m);
  });
}

export function syncControls(root, m) {
  root.querySelectorAll("[data-pcm]").forEach((el) => {
    const k = el.dataset.pcm;
    const val = String(m[k]);
    if (el.type === "range") {
      if (el.value !== val) el.value = val;
    } else if (el.value !== val) {
      el.value = val;
    }
  });
}

export function bindPcmControls(root, onPatch) {
  const box = root.querySelector("[data-pcm-controls]") || root;
  box.addEventListener("input", (e) => {
    const el = e.target.closest("[data-pcm]");
    if (!el) return;
    onPatch({ [el.dataset.pcm]: coerce(el) });
  });
  box.addEventListener("change", (e) => {
    const el = e.target.closest("[data-pcm]");
    if (!el) return;
    onPatch({ [el.dataset.pcm]: coerce(el) });
  });
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (!btn) return;
    const p = PRESETS.find((x) => x.id === btn.dataset.preset);
    if (p) {
      const { id, label, ...patch } = p;
      onPatch(patch);
    }
  });
}

function coerce(el) {
  const k = el.dataset.pcm;
  if (k === "format" || k === "path") return el.value;
  return Number(el.value);
}

export { PRESETS };
