/** After Command.burst: HAL is the last AOSP object. TinyALSA fork vs PAL→AGM fork. */

const NODES = [
  { id: "hal", x: 340, y: 8, w: 220, h: 56, k: "AOSP contract", t: "Audio HAL", s: "empties audio.fmq" },
  { id: "tiny", x: 40, y: 92, w: 200, h: 56, k: "generic board", t: "TinyALSA", s: "pcm_write" },
  { id: "alsa", x: 40, y: 168, w: 200, h: 56, k: "kernel", t: "ALSA PCM", s: "RUNNING" },
  { id: "asoc", x: 40, y: 244, w: 200, h: 56, k: "kernel", t: "ASoC + DAI", s: "FE → BE pins" },
  { id: "pal", x: 640, y: 92, w: 220, h: 56, k: "HLOS · vendor", t: "PAL", s: "use-case stream" },
  { id: "agm", x: 640, y: 168, w: 220, h: 56, k: "HLOS · vendor", t: "AGM", s: "builds DSP graph" },
  { id: "dsp", x: 640, y: 244, w: 220, h: 56, k: "DSP · vendor", t: "ADSP + AFE", s: "then DAI" },
  { id: "out", x: 340, y: 320, w: 220, h: 56, k: "silicon", t: "DAC / smart amp", s: "voltage" },
];

const EDGES = [
  { id: "h-t", kind: "data", d: "M 380 64 C 240 70, 140 70, 140 92" },
  { id: "t-a", kind: "data", d: "M 140 148 L 140 168" },
  { id: "a-s", kind: "data", d: "M 140 224 L 140 244" },
  { id: "s-o", kind: "data", d: "M 140 300 C 140 330, 340 330, 340 348" },
  { id: "h-p", kind: "control", d: "M 520 64 C 660 70, 750 70, 750 92" },
  { id: "p-g", kind: "control", d: "M 750 148 L 750 168" },
  { id: "g-d", kind: "control", d: "M 750 224 L 750 244" },
  { id: "d-o", kind: "data", d: "M 750 300 C 750 330, 560 330, 560 348" },
];

const SHEET = {
  hal: "Flinger already did Command.burst. The vendor HAL thread must empty audio.fmq. What it does next is product-specific — TinyALSA on many boards, PAL on Qualcomm-like ones. Android does not pick this.",
  tiny: "TinyALSA is Android’s small ioctl library. pcm_write into an ALSA PCM. Policy never calls this.",
  alsa: "Kernel PCM state machine (Module 09). RUNNING + zeros is still silence.",
  asoc: "ASoC wires that PCM (front-end) to a DAI (back-end) on the SoC pins (Module 10).",
  pal: "Vendor HAL calls PAL. PAL is not Binder, not AOSP. It maps the stream to a use-case. Apps and Flinger never call PAL.",
  agm: "PAL calls AGM. AGM builds/connects the DSP graph and starts AFE. “Graph not built” is not AudioPolicy.",
  dsp: "ADSP is another computer. AFE is its port toward the DAI. Crossing HLOS→DSP is GPR/IPC, not Binder.",
  out: "DAC or a smart amp turns the DAI bits into voltage. Amp EN / analog MUX can still mute. DCI/I2C programs those registers — it is not the sample cable.",
};

function fo(n) {
  return `<g class="viz-node" data-hb="${n.id}">
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12"/>
    <foreignObject x="${n.x + 10}" y="${n.y + 6}" width="${n.w - 20}" height="${n.h - 12}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
        <span class="pipe-kicker">${n.k}</span>
        <strong class="pipe-title">${n.t}</strong>
        <span class="pipe-sub">${n.s}</span>
      </div>
    </foreignObject>
  </g>`;
}

const GENERIC = new Set(["tiny", "alsa", "asoc"]);
const QCOM = new Set(["pal", "agm", "dsp"]);
const GEN_EDGES = new Set(["h-t", "t-a", "a-s", "s-o"]);
const QCOM_EDGES = new Set(["h-p", "p-g", "g-d", "d-o"]);

export function mountHalBelow(host) {
  host.innerHTML = `
    <div class="hb-studio">
      <p class="del-myth"><strong>Who calls whom?</strong> Apps, AudioFlinger, and AudioPolicy never call PAL or AGM.
      Flinger → HAL only. Then pick <em>one</em> product: generic TinyALSA <strong>or</strong> Qualcomm-like PAL → AGM — not both at once.</p>
      <div class="arch-mode">
        <span>Product</span>
        <button type="button" class="active" data-fork="generic">Generic · TinyALSA</button>
        <button type="button" data-fork="qcom">Qualcomm-like · PAL</button>
      </div>
      <svg class="viz-svg" viewBox="0 0 900 390" role="img" aria-label="HAL to TinyALSA or PAL AGM">
        ${EDGES.map(
          (e) => `<g class="viz-edge" data-kind="${e.kind}" data-hb-edge="${e.id}">
            <path id="hb-${e.id}" d="${e.d}" fill="none"/>
            <circle class="pipe-pkt" r="4"><animateMotion dur="1.5s" repeatCount="indefinite"><mpath href="#hb-${e.id}"/></animateMotion></circle>
          </g>`,
        ).join("")}
        <foreignObject x="70" y="70" width="140" height="22"><div xmlns="http://www.w3.org/1999/xhtml" class="viz-chip">generic</div></foreignObject>
        <foreignObject x="690" y="70" width="160" height="22"><div xmlns="http://www.w3.org/1999/xhtml" class="viz-chip">Qualcomm-like</div></foreignObject>
        ${NODES.map(fo).join("")}
      </svg>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const sheet = host.querySelector("[data-sheet]");
  let sel = "hal";
  let fork = "generic";
  const paint = () => {
    host.querySelectorAll("[data-fork]").forEach((b) => b.classList.toggle("active", b.dataset.fork === fork));
    const liveNodes = fork === "generic" ? GENERIC : QCOM;
    const liveEdges = fork === "generic" ? GEN_EDGES : QCOM_EDGES;
    host.querySelectorAll("[data-hb]").forEach((g) => {
      const id = g.dataset.hb;
      const dim = id !== "hal" && id !== "out" && !liveNodes.has(id);
      g.classList.toggle("is-sel", id === sel);
      g.classList.toggle("is-dim", dim);
    });
    host.querySelectorAll("[data-hb-edge]").forEach((g) => {
      const on = liveEdges.has(g.dataset.hbEdge);
      g.classList.toggle("is-dim", !on);
      const pkt = g.querySelector(".pipe-pkt");
      if (pkt) pkt.style.opacity = on ? "1" : "0";
    });
    sheet.innerHTML = `<p>${SHEET[sel]}</p>
      <p class="muted">Active fork: ${fork === "generic" ? "TinyALSA → ALSA → ASoC → DAI" : "PAL → AGM → ADSP/AFE → DAI"}. The other fork is dimmed — a product uses one, not both, for a given stream.</p>`;
    host._onCaption?.({ who: NODES.find((n) => n.id === sel).t, fail: SHEET[sel] });
  };
  host.addEventListener("click", (e) => {
    const f = e.target.closest("[data-fork]");
    if (f) {
      fork = f.dataset.fork;
      if (sel !== "hal" && sel !== "out") {
        sel = fork === "generic" ? "tiny" : "pal";
      }
      paint();
      return;
    }
    const g = e.target.closest("[data-hb]");
    if (g) {
      sel = g.dataset.hb;
      paint();
    }
  });
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      paint();
    },
  };
}
