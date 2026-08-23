import { fmtHz, fmtMs } from "../lib/audioMath.js";

/** 1 ms of a sine, with one dot per frame. Density is the sample-rate lesson. */
export function mountWaveform(host) {
  host.innerHTML = `
    <svg class="wave-svg" viewBox="0 0 640 160" role="img" aria-label="One millisecond of frames">
      <line x1="32" y1="80" x2="608" y2="80" class="wave-axis"/>
      <path class="wave-path" fill="none"></path>
      <g class="wave-dots"></g>
      <text x="32" y="18" class="wave-label">1 ms window</text>
      <text x="608" y="18" text-anchor="end" class="wave-count"></text>
    </svg>
    <p class="diagram-caption" data-cap></p>`;
  const path = host.querySelector(".wave-path");
  const dots = host.querySelector(".wave-dots");
  const count = host.querySelector(".wave-count");
  const cap = host.querySelector("[data-cap]");

  return {
    update(m) {
      const frames = Math.max(1, Math.round(m.rate / 1000));
      const w = 576;
      const x0 = 32;
      let d = "";
      const pts = [];
      const drawN = Math.min(frames, 96);
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const x = x0 + t * w;
        const y = 80 - Math.sin(t * Math.PI * 2 * 3) * 48;
        d += i ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      path.setAttribute("d", d);
      dots.replaceChildren();
      const ns = "http://www.w3.org/2000/svg";
      for (let i = 0; i < drawN; i++) {
        const t = drawN === 1 ? 0 : i / (drawN - 1);
        const x = x0 + t * w;
        const y = 80 - Math.sin(t * Math.PI * 2 * 3) * 48;
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("cx", x.toFixed(1));
        c.setAttribute("cy", y.toFixed(1));
        c.setAttribute("r", drawN > 64 ? "1.6" : "2.6");
        c.setAttribute("class", "wave-dot");
        c.style.animationDelay = `${(i / drawN) * 1.2}s`;
        dots.appendChild(c);
      }
      count.textContent = `${frames} frames in 1 ms`;
      cap.textContent = `${fmtHz(m.rate)} means ${m.rate.toLocaleString()} frames every second. One frame is ${fmtMs(m.sampleMs)}. IRQ rate is not this number — IRQ rate is frames-per-period.`;
    },
  };
}
