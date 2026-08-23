/** Module 16: Qualcomm-like HLOS/DSP continuation. PAL · AGM · AFE. No invented module IDs. */

const STEPS = [
  {
    id: "aosp",
    zone: "AOSP",
    title: "Flinger",
    sub: "ACTIVE · burst OK",
    note: "AOSP last-known-good. createTrack → getOutputForAttr → mix → burst. This dump can be healthy while the cabin is silent.",
  },
  {
    id: "hal",
    zone: "AOSP contract",
    title: "Audio HAL",
    sub: "IModule · last AOSP",
    note: "The HAL is still the AOSP contract (AIDL IModule on this course). Qualcomm products usually hide PAL behind that HAL. Classify AIDL vs HIDL first.",
  },
  {
    id: "pal",
    zone: "HLOS · vendor",
    title: "PAL",
    sub: "HLOS use-case",
    note: "Userspace on the apps processor (HLOS). Maps the Android stream to a vendor use-case (media / deep / voice / bus_X). Not in AOSP. Do not invent stream or module IDs — read your BSP.",
  },
  {
    id: "agm",
    zone: "HLOS · vendor",
    title: "AGM",
    sub: "builds the graph",
    note: "Builds and connects the DSP graph for that use-case. PAL talks to AGM; AGM talks over GPR/IPC to ADSP. Graph-not-built is a vendor failure, not AudioPolicy.",
  },
  {
    id: "adsp",
    zone: "DSP · vendor",
    title: "ADSP",
    sub: "DSP + ACDB cal",
    note: "Separate power/clock domain. ACDB is the recipe book (topology + cal). Missing (use-case, device, rate, channels) tuple → default mute. Never invent ACDB keys.",
  },
  {
    id: "afe",
    zone: "DSP port",
    title: "AFE",
    sub: "front-end toward the DAI",
    note: "AFE is the port out of the DSP toward I2S/TDM/SLIM/SoundWire. AFE not started = digital alive, pins quiet.",
  },
  {
    id: "dai",
    zone: "kernel / wire",
    title: "DAI",
    sub: "I2S/TDM pins",
    note: "TDM slot = time apartment on the serial pin (amp listens to slot N). Analog MUX = DAPM/codec analog switch. Different objects. car XML does not program either.",
  },
  {
    id: "amp",
    zone: "silicon",
    title: "Amp",
    sub: "DAC · EN · load",
    note: "On many auto SoCs there is no phone-style codec DAC — TDM goes straight to a smart amp. Amp EN and fault latch are independent of Flinger.",
  },
];

export function mountQcomStack(host) {
  host.innerHTML = `
    <div class="qcom-studio">
      <p class="del-myth"><strong>Myth:</strong> “Flinger is ACTIVE, so Qualcomm is playing.”
      <strong>Fact:</strong> AOSP stops at the HAL. PAL and AGM are HLOS; the graph runs on the ADSP. One stream — not a second Android mixer.</p>
      <div class="arch-mode">
        <span>Vendor</span>
        <button type="button" class="active" data-qc-mode="ok">Healthy graph</button>
        <button type="button" data-qc-mode="fail">ACDB / graph miss</button>
      </div>
      <svg class="viz-svg" viewBox="0 0 920 210" role="img" aria-label="Qualcomm-like PAL AGM AFE path">
        <g data-graph></g>
      </svg>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const graph = host.querySelector("[data-graph]");
  const sheet = host.querySelector("[data-sheet]");
  let sel = "pal";
  let mode = "ok";

  const paint = () => {
    host.querySelectorAll("[data-qc-mode]").forEach((b) => b.classList.toggle("active", b.dataset.qcMode === mode));
    const failAt = STEPS.findIndex((s) => s.id === "adsp");
    const w = 104;
    const gap = 6;
    const x0 = 16;
    const html = STEPS.map((s, i) => {
      const x = x0 + i * (w + gap);
      const broken = mode === "fail" && i >= failAt;
      const on = s.id === sel;
      const cls = on ? (broken ? "is-shut is-sel" : "is-sel") : broken ? "is-err" : "is-hot";
      const pkt = mode === "ok" || i < failAt;
      const edge =
        i < STEPS.length - 1
          ? `<g class="viz-edge" data-kind="${i < 2 ? "data" : "control"}">
              <path id="qc-${i}" d="M ${x + w} 88 L ${x + w + gap} 88" fill="none"/>
              ${pkt ? `<circle class="pipe-pkt" r="3.5"><animateMotion dur="1.2s" repeatCount="indefinite"><mpath href="#qc-${i}"/></animateMotion></circle>` : ""}
            </g>`
          : "";
      return `${edge}<g class="viz-node ${cls}" data-qc="${s.id}">
        <rect x="${x}" y="28" width="${w}" height="132" rx="12"/>
        <foreignObject x="${x + 6}" y="34" width="${w - 12}" height="120">
          <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
            <span class="pipe-kicker">${s.zone}</span>
            <strong class="pipe-title">${s.title}</strong>
            <span class="pipe-sub">${s.sub}</span>
          </div>
        </foreignObject>
      </g>`;
    }).join("");
    graph.innerHTML = html;
    const s = STEPS.find((x) => x.id === sel);
    sheet.innerHTML = `<p><strong>${s.title}.</strong> ${s.note}</p>
      <p class="muted">${mode === "fail" ? "Packets stop at ADSP/ACDB — Flinger dump still looks ACTIVE." : "Healthy: samples continue PAL → AGM → ADSP → AFE → DAI. dumpsys still will not name PAL sessions."}</p>`;
    host._onCaption?.({ who: `QCOM-like · ${s.title}`, fail: s.note });
  };

  host.addEventListener("click", (e) => {
    const m = e.target.closest("[data-qc-mode]");
    if (m) {
      mode = m.dataset.qcMode;
      paint();
      return;
    }
    const g = e.target.closest("[data-qc]");
    if (g) {
      sel = g.dataset.qc;
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
