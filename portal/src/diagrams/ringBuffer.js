import { fmtMs } from "../lib/audioMath.js";

export function mountRingBuffer(host) {
  const ns = "http://www.w3.org/2000/svg";
  host.innerHTML = `
    <div class="ring-layout">
      <div data-svg-slot></div>
      <div class="tank-col">
        <div class="tank" aria-hidden="true">
          <div class="tank-fill" data-fill></div>
          <div class="danger-line" style="bottom:25%" title="~20 ms voice/nav">20 ms</div>
        </div>
        <p class="diagram-caption" data-cap></p>
      </div>
    </div>`;

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "ring-svg");
  svg.setAttribute("viewBox", "0 0 240 240");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "ALSA ring buffer");

  const track = document.createElementNS(ns, "circle");
  track.setAttribute("class", "ring-track");
  track.setAttribute("cx", "120");
  track.setAttribute("cy", "120");
  track.setAttribute("r", "84");
  track.setAttribute("fill", "none");

  const wedges = document.createElementNS(ns, "g");

  const hubCircle = document.createElementNS(ns, "circle");
  hubCircle.setAttribute("class", "ring-hub");
  hubCircle.setAttribute("cx", "120");
  hubCircle.setAttribute("cy", "120");
  hubCircle.setAttribute("r", "48");

  const hub = document.createElementNS(ns, "text");
  hub.setAttribute("x", "120");
  hub.setAttribute("y", "114");
  hub.setAttribute("text-anchor", "middle");
  hub.setAttribute("class", "ring-ms");

  const sub = document.createElementNS(ns, "text");
  sub.setAttribute("x", "120");
  sub.setAttribute("y", "132");
  sub.setAttribute("text-anchor", "middle");
  sub.setAttribute("class", "ring-sub");
  sub.textContent = "one buffer";

  const token = document.createElementNS(ns, "g");
  token.setAttribute("class", "ring-token");
  const tok = document.createElementNS(ns, "circle");
  tok.setAttribute("cx", "120");
  tok.setAttribute("cy", "36");
  tok.setAttribute("r", "7");
  token.appendChild(tok);

  svg.append(track, wedges, hubCircle, hub, sub, token);
  host.querySelector("[data-svg-slot]").appendChild(svg);

  const fill = host.querySelector("[data-fill]");
  const cap = host.querySelector("[data-cap]");
  let lastCount = 0;

  function drawWedges(count) {
    while (wedges.firstChild) wedges.removeChild(wedges.firstChild);
    const cx = 120;
    const cy = 120;
    const r0 = 58;
    const r1 = 84;
    for (let i = 0; i < count; i++) {
      const a0 = -Math.PI / 2 + (i / count) * Math.PI * 2;
      const a1 = -Math.PI / 2 + ((i + 1) / count) * Math.PI * 2;
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", arcWedge(cx, cy, r0, r1, a0, a1));
      p.setAttribute("class", "ring-wedge");
      wedges.appendChild(p);
    }
  }

  return {
    update(m) {
      try {
        if (m.periodCount !== lastCount) {
          drawWedges(m.periodCount);
          lastCount = m.periodCount;
        }
        hub.textContent = fmtMs(m.bufferMs);
        const dur = Math.max(2400, m.bufferMs * 80);
        token.style.animationDuration = `${dur}ms`;
        if (fill) {
          const pct = Math.min(100, (m.bufferMs / 80) * 100);
          fill.style.height = `${pct}%`;
          fill.classList.toggle("hot", m.bufferMs > 40);
          fill.classList.toggle("danger", m.bufferMs > 80);
        }
        const twitch = m.periodCount <= 2;
        const fat = m.bufferMs > 80;
        cap.textContent = `Period ${fmtMs(m.periodMs)} × count ${m.periodCount} = buffer ${fmtMs(m.bufferMs)}. IRQ ${m.irqHz.toFixed(0)}/s. ${twitch ? "Count 2 is twitchy — scheduler delay becomes an XRUN." : fat ? "This tank hides XRUNs and hurts AEC / nav urgency." : "Period is the wake quantum. Buffer is the jitter tank."}`;
      } catch (err) {
        if (cap) cap.textContent = `Ring error: ${err.message}`;
        console.error(err);
      }
    },
  };
}

function arcWedge(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}
