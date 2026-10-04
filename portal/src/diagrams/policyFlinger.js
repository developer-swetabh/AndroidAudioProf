/** Module 03: Policy and Flinger on the same row — peers, not a stack. */

const NODES = [
  { id: "app", x: 340, y: 8, w: 220, h: 56, process: "app", title: "App / client", sub: "AudioTrack" },
  { id: "svc", x: 20, y: 88, w: 240, h: 60, process: "system_server", title: "AudioService", sub: "focus / volume · no PCM" },
  { id: "policy", x: 20, y: 188, w: 280, h: 76, process: "audioserver", title: "AudioPolicy", sub: "decide · events" },
  { id: "flinger", x: 600, y: 188, w: 280, h: 76, process: "audioserver", title: "AudioFlinger", sub: "execute · periods" },
  { id: "hal", x: 600, y: 292, w: 280, h: 60, process: "vendor", title: "Audio HAL", sub: "IModule · burst" },
];

const EDGES = [
  { id: "app-svc", kind: "control", label: "IAudioService", d: "M 360 64 C 240 70, 140 70, 140 88" },
  { id: "app-flinger", kind: "track", label: "createTrack", d: "M 530 64 C 680 90, 740 140, 740 188" },
  { id: "svc-policy", kind: "control", label: "devices / volume", d: "M 140 148 L 140 188" },
  { id: "peer", kind: "peer", label: "getOutputForAttr", d: "M 300 226 L 600 226" },
  { id: "flinger-hal", kind: "data", label: "Command.burst", d: "M 740 264 L 740 292" },
];

const CHIP = {
  "app-svc": [200, 68],
  "app-flinger": [640, 100],
  "svc-policy": [48, 164],
  peer: [380, 210],
  "flinger-hal": [780, 270],
};

const SHEET = {
  app: {
    body: "Two Binders: IAudioFlinger.createTrack (right) and IAudioService for focus (left). The app does not Binder to Policy.",
    fail: "play() returned is not acoustic energy.",
  },
  svc: {
    body: "system_server. Focus, volume UI, device callbacks. On AAOS, CarAudioService (in CarService, com.android.car, not system_server) registers mixes through AudioService — still not in the PCM path.",
    fail: "Requesting focus does not call getOutputForAttr.",
  },
  policy: {
    body: "Decision engine, same process as Flinger (audioserver), same height on this drawing on purpose. Time scale is events. Patches go Policy → AudioPolicyClient → Flinger → HAL. Policy never Command.burst.",
    fail: "Wrong device / bus, profile lie → HAL EINVAL, AVAILABLE on a sink Flinger left.",
  },
  flinger: {
    body: "Execution engine, peer of Policy. Time scale is periods (often 2–20 ms). Direct/Offload skip the mixer, not Flinger.",
    fail: "STANDBY through a one-shot, frozen frames with State=ACTIVE, work > period_ms.",
  },
  hal: {
    body: "Two HAL conversations: Policy reads ports at config time; Flinger does StreamDescriptor I/O. Next lesson: what the vendor HAL does after burst.",
    fail: "open EINVAL, xrunFrames climbing, State=ERROR.",
  },
};

function fo(n) {
  return `<g class="viz-node" data-pf="${n.id}">
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14"/>
    <foreignObject x="${n.x + 12}" y="${n.y + 8}" width="${n.w - 24}" height="${n.h - 16}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
        <span class="pipe-kicker">${n.process}</span>
        <strong class="pipe-title">${n.title}</strong>
        <span class="pipe-sub">${n.sub}</span>
      </div>
    </foreignObject>
  </g>`;
}

export function mountPolicyFlinger(host) {
  host.innerHTML = `
    <div class="pf-studio">
      <p class="del-myth"><strong>Myth:</strong> Policy sits under Flinger.
      <strong>Fact:</strong> they sit on the <em>same row</em> — peers in <code>audioserver</code>. App → Flinger <code>createTrack</code>. Flinger → Policy <code>getOutputForAttr</code> (the bar between them). PCM never visits Policy.</p>
      <svg class="viz-svg" viewBox="0 0 900 368" role="img" aria-label="AudioPolicy vs AudioFlinger peers">
        ${EDGES.map(
          (e) => `<g class="viz-edge" data-kind="${e.kind}" data-edge="${e.id}">
            <path id="pf-${e.id}" d="${e.d}" fill="none"/>
            <circle class="pipe-pkt" r="4.5">
              <animateMotion dur="${e.kind === "data" || e.kind === "track" ? "1.6s" : "2.6s"}" repeatCount="indefinite">
                <mpath href="#pf-${e.id}"/>
              </animateMotion>
            </circle>
          </g>`,
        ).join("")}
        ${EDGES.map((e) => {
          const [x, y] = CHIP[e.id];
          return `<foreignObject x="${x}" y="${y}" width="150" height="24">
            <div xmlns="http://www.w3.org/1999/xhtml" class="viz-chip">${e.label}</div>
          </foreignObject>`;
        }).join("")}
        ${NODES.map(fo).join("")}
      </svg>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const sheet = host.querySelector("[data-sheet]");
  let sel = "policy";

  const paint = () => {
    host.querySelectorAll("[data-pf]").forEach((g) => g.classList.toggle("is-sel", g.dataset.pf === sel));
    const s = SHEET[sel];
    const n = NODES.find((x) => x.id === sel);
    sheet.innerHTML = `<p><strong>${n.title}.</strong> ${s.body}</p><p class="invent">${s.fail}</p>
      <p class="muted">Dump: <code>dumpsys media.audio_policy</code> vs <code>dumpsys media.audio_flinger</code>. Time: events vs periods.</p>`;
    host._onCaption?.({ who: n.title, fail: s.fail });
  };

  host.addEventListener("click", (e) => {
    const g = e.target.closest("[data-pf]");
    if (g) {
      sel = g.dataset.pf;
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
