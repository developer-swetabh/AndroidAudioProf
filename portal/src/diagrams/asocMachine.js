/** Module 10: left-to-right — SoC → ASoC → FE → DAI → DAC. DCI is the control cable. */

const NODES = [
  { id: "soc", x: 16, y: 36, w: 150, h: 88, k: "silicon", t: "SoC", s: "the chip" },
  { id: "asoc", x: 186, y: 36, w: 160, h: 88, k: "kernel framework", t: "ASoC", s: "wires this board" },
  { id: "fe", x: 366, y: 36, w: 160, h: 88, k: "ALSA PCM", t: "FE PCM", s: "hw:C,D" },
  { id: "be", x: 546, y: 36, w: 160, h: 88, k: "DAI · samples", t: "BE DAI", s: "I2S / TDM" },
  { id: "dac", x: 726, y: 36, w: 158, h: 88, k: "analog", t: "DAC / amp", s: "voltage" },
  { id: "dci", x: 546, y: 150, w: 160, h: 72, k: "control · not samples", t: "DCI / I2C", s: "mute · gain · slots" },
];

const EDGES = [
  { id: "soc-asoc", kind: "control", d: "M 166 80 L 186 80" },
  { id: "asoc-fe", kind: "data", d: "M 346 80 L 366 80" },
  { id: "fe-be", kind: "data", d: "M 526 80 L 546 80" },
  { id: "be-dac", kind: "data", d: "M 706 80 L 726 80" },
  { id: "dci-dac", kind: "control", d: "M 706 186 C 760 186, 805 140, 805 124" },
];

const SHEET = {
  soc: "System on Chip: the die. CPU runs Android. DAI pins and often a DSP live here. SoC is hardware — not a driver.",
  asoc: "ALSA System on Chip: Linux framework that wires CPU DAI, DMA, and codec on this board. Android never calls ASoC by name.",
  fe: "Front-end PCM — the ALSA device TinyALSA opens (Module 09). DPCM binds this dock to a back-end at use-case start.",
  be: "Back-end DAI: serial audio + clocks. TDM slots live here. car XML does not program them.",
  dac: "Digital-to-analog after the DAI. May live in a codec or inside a smart amp.",
  dci: "Digital Control Interface in most datasheets = I2C/SPI. Parallel to the DAI. Does not carry PCM. If the schematic labels I2S as DCI, treat it as the DAI until the datasheet says I2C.",
};

function fo(n) {
  return `<g class="viz-node" data-am="${n.id}">
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12"/>
    <foreignObject x="${n.x + 10}" y="${n.y + 8}" width="${n.w - 20}" height="${n.h - 16}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
        <span class="pipe-kicker">${n.k}</span>
        <strong class="pipe-title">${n.t}</strong>
        <span class="pipe-sub">${n.s}</span>
      </div>
    </foreignObject>
  </g>`;
}

export function mountAsocMachine(host) {
  host.innerHTML = `
    <div class="am-studio">
      <p class="del-myth">Read left to right: <strong>SoC</strong> (chip) → <strong>ASoC</strong> (wiring) → <strong>ALSA FE</strong> → <strong>DAI</strong> (samples) → <strong>DAC</strong>.
      The dashed box is <strong>DCI/I2C</strong> — registers, not music.</p>
      <svg class="viz-svg" viewBox="0 0 900 240" role="img" aria-label="SoC ASoC ALSA DAI DCI">
        ${EDGES.map(
          (e) => `<g class="viz-edge" data-kind="${e.kind}">
            <path id="am-${e.id}" d="${e.d}" fill="none"/>
            ${e.kind === "data" ? `<circle class="pipe-pkt" r="4"><animateMotion dur="1.4s" repeatCount="indefinite"><mpath href="#am-${e.id}"/></animateMotion></circle>` : ""}
          </g>`,
        ).join("")}
        <foreignObject x="548" y="118" width="120" height="22"><div xmlns="http://www.w3.org/1999/xhtml" class="viz-chip">samples</div></foreignObject>
        <foreignObject x="700" y="168" width="120" height="22"><div xmlns="http://www.w3.org/1999/xhtml" class="viz-chip">registers</div></foreignObject>
        ${NODES.map(fo).join("")}
      </svg>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const sheet = host.querySelector("[data-sheet]");
  let sel = "asoc";
  const paint = () => {
    host.querySelectorAll("[data-am]").forEach((g) => g.classList.toggle("is-sel", g.dataset.am === sel));
    sheet.innerHTML = `<p>${SHEET[sel]}</p>`;
    host._onCaption?.({ who: NODES.find((n) => n.id === sel).t, fail: SHEET[sel] });
  };
  host.addEventListener("click", (e) => {
    const g = e.target.closest("[data-am]");
    if (g) {
      sel = g.dataset.am;
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
