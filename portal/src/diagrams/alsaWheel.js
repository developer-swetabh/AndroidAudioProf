import { compute, DEFAULT_PCM, fmtMs } from "../lib/audioMath.js";
import { mountRingBuffer } from "./ringBuffer.js";

const STATES = [
  { id: "OPEN", note: "pcm_open succeeded. No hw_params yet." },
  { id: "SETUP", note: "hw_params applied: rate, channels, format, period_size, period_count. Still not running." },
  { id: "PREPARED", note: "prepare done. A start with an empty ring can XRUN immediately; many paths write first." },
  { id: "RUNNING", note: "trigger START. DMA turning. appl_ptr / hw_ptr must move. Zeros in the ring are silence — not an XRUN." },
  { id: "XRUN", note: "Underrun (playback) or overrun (capture). Kernel state is XRUN, not RUNNING. pcm_write returns EPIPE. prepare → PREPARED, then start. If no counter moved, it is probably not an XRUN." },
  { id: "PAUSED", note: "snd_pcm_pause. Not Flinger track pause, not StreamDescriptor PAUSED, and not system SUSPENDED." },
  { id: "DRAINING", note: "Play out remaining frames, then typically back toward SETUP/stop." },
];

export function mountAlsaWheel(host) {
  const m = compute(DEFAULT_PCM);
  host.innerHTML = `
    <div class="aw-studio">
      <p class="del-myth"><strong>Myth:</strong> “PCM is RUNNING so the speaker must have sound.”
      <strong>Fact:</strong> RUNNING + zeros is digital silence. An XRUN is an empty or overflowing ring with a counter. Policy does not call <code>pcm_open</code> — the HAL / TinyALSA does.</p>
      <div id="aw-ring"></div>
      <p class="muted">Example ring (not “the” Android period): ${m.rate / 1000} kHz · ${m.channels}ch · ${m.fmt.id} · ${m.periodFrames} frames × ${m.periodCount} = ${fmtMs(m.periodMs)} period, ${fmtMs(m.bufferMs)} buffer. Kernel also has <code>SUSPENDED</code> (system suspend) and <code>DISCONNECTED</code> — not drawn.</p>
      <div class="sd-states">
        ${STATES.map((s) => `<button type="button" class="sd-st" data-pcmst="${s.id}">${s.id}</button>`).join("")}
      </div>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const ring = mountRingBuffer(host.querySelector("#aw-ring"));
  ring.update(m);
  let st = "RUNNING";
  const sheet = host.querySelector("[data-sheet]");

  const paint = () => {
    const s = STATES.find((x) => x.id === st) || STATES[3];
    host.querySelectorAll("[data-pcmst]").forEach((b) => b.classList.toggle("active", b.dataset.pcmst === st));
    const extra =
      st === "XRUN"
        ? "RUNNING → XRUN (EPIPE). Then prepare → PREPARED, start → RUNNING. dumpsys media.audio_flinger does not show this machine — use ALSA status / HAL xrunFrames."
        : st === "RUNNING"
          ? "Frozen hw_ptr with RUNNING → clocks/DAI/DMA (Module 10), not AudioPolicy."
          : "TinyALSA: pcm_open → hw_params → sw_params → prepare → start. sw_params is start_threshold / avail_min, not the format.";
    sheet.innerHTML = `<p><strong>${s.id}.</strong> ${s.note}</p><p class="muted">${extra}</p>`;
    host._onCaption?.({ who: `ALSA PCM · ${s.id}`, fail: s.note });
  };

  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pcmst]");
    if (b) {
      st = b.dataset.pcmst;
      paint();
    }
  });

  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      ring.update(m);
      paint();
    },
  };
}
