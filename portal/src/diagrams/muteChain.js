/** Module 11: live mute valves. TDM slot mux ≠ analog MUX. PCM RUNNING can still be silence. */

const VALVES = [
  {
    id: "hal",
    title: "Flinger / HAL gain",
    kicker: "AOSP digital",
    note: "Software volume, stream gain 0, or digital zeros. Flinger can look ACTIVE.",
  },
  {
    id: "pal",
    title: "PAL / AGM graph",
    kicker: "HLOS · vendor",
    note: "Qualcomm-like: PAL use-case + AGM graph on HLOS. Missing calibration (ACDB) mutes AFE while burst still succeeds. Not an AOSP object — do not invent module IDs.",
  },
  {
    id: "afe",
    title: "AFE / FE PCM",
    kicker: "DSP port",
    note: "AFE is the DSP front-end toward the DAI. FE PCM RUNNING only proves the kernel side of that port, not analog unmute.",
  },
  {
    id: "tdm",
    title: "TDM slot (time mux)",
    kicker: "DAI wire",
    note: "Time-division on I2S/TDM. Slot map is the amp’s apartment number. car_audio_configuration.xml does not program slots. This is not an analog MUX.",
  },
  {
    id: "mux",
    title: "Analog MUX / DAPM",
    kicker: "codec switch",
    note: "DAPM analog mux / PGA / charge pump. A different widget from TDM. Incomplete DAPM path: mixer looks on, supply never came up.",
  },
  {
    id: "amp",
    title: "Amp EN / speaker",
    kicker: "silicon",
    note: "GPIO enable, I2C mute, protection fault latch, load disconnect. Independent of PCM RUNNING. Confirm with current draw or a mic.",
  },
];

export function mountMuteChain(host) {
  const w = 132;
  const gap = 14;
  const x0 = 16;
  host.innerHTML = `
    <div class="mute-studio">
      <p class="del-myth"><strong>Myth:</strong> “PCM is RUNNING so the cabin has sound.”
      <strong>Fact:</strong> RUNNING is kernel PCM. Close any valve below. TDM slot mux (time on the wire) is not the codec analog MUX.</p>
      <svg class="viz-svg" viewBox="0 0 920 168" role="img" aria-label="Mute points from HAL to speaker">
        <g data-graph></g>
      </svg>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const graph = host.querySelector("[data-graph]");
  const sheet = host.querySelector("[data-sheet]");
  let closed = "amp";

  const paint = () => {
    const nodes = VALVES.map((v, i) => {
      const x = x0 + i * (w + gap);
      const shut = v.id === closed;
      const after = VALVES.findIndex((x) => x.id === closed) < i;
      return `<g class="viz-node ${shut ? "is-shut is-sel" : after ? "is-dim" : "is-hot"}" data-valve="${v.id}">
        <rect x="${x}" y="28" width="${w}" height="88" rx="14"/>
        <foreignObject x="${x + 8}" y="34" width="${w - 16}" height="76">
          <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
            <span class="pipe-kicker">${v.kicker}</span>
            <strong class="pipe-title">${v.title}</strong>
            <span class="pipe-sub">${shut ? "CLOSED" : after ? "no analog" : "open"}</span>
          </div>
        </foreignObject>
      </g>`;
    }).join("");
    const edges = VALVES.slice(0, -1)
      .map((_, i) => {
        const x1 = x0 + i * (w + gap) + w;
        const x2 = x1 + gap;
        const blocked = i >= VALVES.findIndex((x) => x.id === closed);
        const id = `mute-e${i}`;
        return `<g class="viz-edge" data-kind="${blocked ? "control" : "data"}">
          <path id="${id}" d="M ${x1} 72 L ${x2} 72" fill="none"/>
          ${blocked ? "" : `<circle class="pipe-pkt" r="4"><animateMotion dur="1.1s" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion></circle>`}
        </g>`;
      })
      .join("");
    graph.innerHTML = `<text class="viz-badge" x="16" y="18">PCM RUNNING stays true →</text>${edges}${nodes}`;
    const v = VALVES.find((x) => x.id === closed);
    sheet.innerHTML = `<p><strong>Closed: ${v.title}.</strong> ${v.note}</p>
      <p class="invent">Dump: MixerThread ACTIVE + PCM RUNNING. Cabin: silence. Last-known-good is the last open valve.</p>`;
    host._onCaption?.({ who: `Mute · ${v.title}`, fail: v.note });
  };

  host.addEventListener("click", (e) => {
    const g = e.target.closest("[data-valve]");
    if (g) {
      closed = g.dataset.valve;
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
