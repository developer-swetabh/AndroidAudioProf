/** Module 07: live mix-port → device-port patch. AVAILABLE ≠ Flinger moved. */

const VIEWS = {
  spk: {
    dest: "SPEAKER",
    mix: "mixport primary",
    avail: ["SPEAKER", "A2DP", "USB"],
    live: "SPEAKER",
    fail: "Phone: usage → strategy → device. The live patch is mix-port → device-port. Policy does not pcm_open.",
  },
  stale: {
    dest: "SPEAKER",
    mix: "mixport primary",
    avail: ["SPEAKER", "A2DP"],
    live: "SPEAKER",
    stale: "A2DP",
    fail: "A2DP AVAILABLE is not a live patch. Flinger’s PlaybackThread device is the evidence. Policy → AudioPolicyClient → Flinger → HAL to move it.",
  },
  bus: {
    dest: "BUS_MEDIA",
    mix: "dynamic AudioMix",
    avail: ["BUS_MEDIA", "BUS_NAV"],
    live: "BUS_MEDIA",
    fail: "AAOS: usage matched a registered AudioMix → AUDIO_DEVICE_OUT_BUS + address. Not a phone strategy. Two contexts on one bus → one PCM.",
  },
};

export function mountPortsPatch(host) {
  host.innerHTML = `
    <div class="pp-studio">
      <p class="del-myth"><strong>Myth:</strong> “Policy lists the device, so PCM is going there.”
      <strong>Fact:</strong> AVAILABLE is a port. A live route is a <em>patch</em>. Patches are Policy → AudioPolicyClient → Flinger → <code>IModule.setAudioPatch</code> — not I2S pins.</p>
      <div class="sd-states">
        <button type="button" class="sd-st active" data-pp="spk">Phone · SPEAKER</button>
        <button type="button" class="sd-st" data-pp="stale">A2DP AVAILABLE, still SPEAKER</button>
        <button type="button" class="sd-st" data-pp="bus">AAOS · BUS_MEDIA</button>
      </div>
      <svg class="viz-svg" viewBox="0 0 900 240" role="img" aria-label="Ports versus live patch">
        <g data-graph></g>
      </svg>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const sheet = host.querySelector("[data-sheet]");
  const graph = host.querySelector("[data-graph]");
  let view = "spk";

  const paint = () => {
    host.querySelectorAll("[data-pp]").forEach((b) => b.classList.toggle("active", b.dataset.pp === view));
    const v = VIEWS[view];
    const ports = v.avail;
    const portW = 160;
    const gap = 24;
    const total = ports.length * portW + (ports.length - 1) * gap;
    const x0 = (900 - total) / 2;
    const mix = `<g class="viz-node is-sel">
      <rect x="330" y="16" width="240" height="64" rx="14"/>
      <foreignObject x="342" y="22" width="216" height="52">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
          <span class="pipe-kicker">mix port</span>
          <strong class="pipe-title">${v.mix}</strong>
          <span class="pipe-sub">Flinger output</span>
        </div>
      </foreignObject>
    </g>`;
    const devices = ports
      .map((name, i) => {
        const x = x0 + i * (portW + gap);
        const live = name === v.live;
        const stale = name === v.stale;
        const cls = live ? "is-sel" : stale ? "is-stale" : "is-dim";
        const sub = live ? "patched · live" : stale ? "AVAILABLE · not patched" : "possible";
        const edge = live
          ? `<g class="viz-edge" data-kind="data">
              <path id="pp-live" d="M 450 80 L ${x + portW / 2} 128" fill="none"/>
              <circle class="pipe-pkt" r="4.5"><animateMotion dur="1.4s" repeatCount="indefinite"><mpath href="#pp-live"/></animateMotion></circle>
            </g>`
          : "";
        return `${edge}<g class="viz-node ${cls}">
          <rect x="${x}" y="128" width="${portW}" height="64" rx="14"/>
          <foreignObject x="${x + 10}" y="134" width="${portW - 20}" height="52">
            <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
              <span class="pipe-kicker">device port</span>
              <strong class="pipe-title">${name}</strong>
              <span class="pipe-sub">${sub}</span>
            </div>
          </foreignObject>
        </g>`;
      })
      .join("");
    graph.innerHTML = mix + devices;
    sheet.innerHTML = `<p>${v.fail}</p><p class="muted"><code>getOutputForAttr</code> returns the ioHandle Flinger already has or must <code>openOutput</code>.</p>`;
    host._onCaption?.({ who: `Live patch · ${v.mix} → ${v.dest}`, fail: v.fail });
  };

  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pp]");
    if (b) {
      view = b.dataset.pp;
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
