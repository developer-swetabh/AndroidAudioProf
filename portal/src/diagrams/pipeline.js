import { LAYERS } from "../content/architecture.js";

const POS = {
  app: { x: 340, y: 8, w: 240, h: 70 },
  svc: { x: 24, y: 108, w: 252, h: 76 },
  policy: { x: 24, y: 220, w: 252, h: 76 },
  flinger: { x: 644, y: 108, w: 252, h: 76 },
  hal: { x: 644, y: 220, w: 252, h: 76 },
  alsa: { x: 340, y: 340, w: 240, h: 70 },
  sinkA: { x: 36, y: 444, w: 268, h: 68 },
  sinkB: { x: 616, y: 444, w: 276, h: 68 },
};

function cx(id) {
  const p = POS[id];
  return p.x + p.w / 2;
}
function cy(id) {
  const p = POS[id];
  return p.y + p.h / 2;
}
function bottom(id) {
  return POS[id].y + POS[id].h;
}
function top(id) {
  return POS[id].y;
}
function right(id) {
  return POS[id].x + POS[id].w;
}
function left(id) {
  return POS[id].x;
}

const EDGES = [
  {
    id: "app-svc",
    kind: "control",
    d: `M ${cx("app")} ${bottom("app")} C ${cx("app") - 40} ${bottom("app") + 30}, ${cx("svc")} ${top("svc") - 24}, ${cx("svc")} ${top("svc")}`,
  },
  {
    id: "app-flinger",
    kind: "track",
    d: `M ${cx("app")} ${bottom("app")} C ${cx("app") + 40} ${bottom("app") + 30}, ${cx("flinger")} ${top("flinger") - 24}, ${cx("flinger")} ${top("flinger")}`,
  },
  {
    id: "svc-policy",
    kind: "control",
    d: `M ${cx("svc")} ${bottom("svc")} L ${cx("policy")} ${top("policy")}`,
  },
  {
    id: "peer",
    kind: "peer",
    d: `M ${right("policy")} ${cy("policy")} C 420 ${cy("policy")}, 520 ${cy("flinger")}, ${left("flinger")} ${cy("flinger")}`,
  },
  {
    id: "flinger-hal",
    kind: "data",
    d: `M ${cx("flinger")} ${bottom("flinger")} L ${cx("hal")} ${top("hal")}`,
  },
  {
    id: "hal-alsa",
    kind: "data",
    d: `M ${cx("hal")} ${bottom("hal")} C ${cx("hal") - 40} ${bottom("hal") + 28}, ${cx("alsa") + 60} ${top("alsa") - 16}, ${cx("alsa")} ${top("alsa")}`,
  },
  {
    id: "alsa-a",
    kind: "data",
    d: `M ${cx("alsa")} ${bottom("alsa")} C ${cx("alsa") - 50} ${bottom("alsa") + 24}, ${cx("sinkA")} ${top("sinkA") - 20}, ${cx("sinkA")} ${top("sinkA")}`,
  },
  {
    id: "hal-a",
    kind: "data",
    d: `M ${left("hal")} ${bottom("hal")} C ${400} ${bottom("hal") + 40}, ${cx("sinkA") + 80} ${top("sinkA") - 30}, ${cx("sinkA")} ${top("sinkA")}`,
  },
  {
    id: "hal-b",
    kind: "data",
    d: `M ${cx("hal")} ${bottom("hal")} L ${cx("sinkB")} ${top("sinkB")}`,
  },
  {
    id: "cap-b-hal",
    kind: "capture",
    d: `M ${cx("sinkB")} ${top("sinkB")} C ${cx("sinkB") - 30} ${top("sinkB") - 40}, ${right("hal")} ${bottom("hal") + 20}, ${right("hal")} ${cy("hal")}`,
  },
  {
    id: "cap-hal-flinger",
    kind: "capture",
    d: `M ${right("hal") - 20} ${top("hal")} L ${right("flinger") - 20} ${bottom("flinger")}`,
  },
  {
    id: "cap-flinger-app",
    kind: "capture",
    d: `M ${cx("flinger")} ${top("flinger")} C ${cx("flinger") + 80} ${top("flinger") - 50}, ${right("app") + 20} ${bottom("app") + 10}, ${right("app")} ${cy("app")}`,
  },
];

function nodeBlock(id, title) {
  const p = POS[id];
  const L = LAYERS.find((l) => l.id === id);
  const color = L?.color || "#94a3b8";
  const kicker = L ? L.process : "I/O";
  return `
    <g class="pipe-node" data-node="${id}" style="--lc:${color}">
      <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="14"/>
      <circle class="pipe-dot" cx="${p.x + 16}" cy="${p.y + 16}" r="5"/>
      <foreignObject x="${p.x + 28}" y="${p.y + 6}" width="${p.w - 36}" height="${p.h - 12}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
          <span class="pipe-kicker">${kicker}</span>
          <strong class="pipe-title">${title}</strong>
          <span class="pipe-sub" data-sub="${id}"></span>
        </div>
      </foreignObject>
    </g>`;
}

export function mountPipeline(host) {
  host.innerHTML = `
    <svg class="pipe-svg" viewBox="0 0 920 530" role="img" aria-label="Android audio call flow">
      <defs>
        <filter id="hotglow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${EDGES.map(
        (e) => `
        <g class="pipe-edge" data-edge="${e.id}" data-kind="${e.kind}">
          <path id="p-${e.id}" d="${e.d}" fill="none"/>
          <circle class="pipe-pkt" r="4.5">
            <animateMotion dur="${e.kind === "capture" ? "2.2s" : e.kind === "data" || e.kind === "track" ? "1.7s" : "2.8s"}" repeatCount="indefinite" rotate="auto">
              <mpath href="#p-${e.id}"/>
            </animateMotion>
          </circle>
        </g>`,
      ).join("")}
      ${nodeBlock("app", "App / client")}
      ${nodeBlock("svc", "AudioService / Car")}
      ${nodeBlock("policy", "AudioPolicy")}
      ${nodeBlock("flinger", "AudioFlinger")}
      ${nodeBlock("hal", "Audio HAL")}
      ${nodeBlock("alsa", "ALSA / TinyALSA")}
      ${nodeBlock("sinkA", "Sink A")}
      ${nodeBlock("sinkB", "Sink B")}
    </svg>`;

  host.querySelectorAll("[data-node]").forEach((g) => {
    g.addEventListener("click", () => host._onSelect?.(g.dataset.node));
  });

  return {
    onSelect(fn) {
      host._onSelect = fn;
    },
    update(sc, { layer, mode }) {
      const sinkState = (which) => sc.sinks[which].state;
      const nodeState = (id) => {
        if (id === "sinkA") return sinkState("a");
        if (id === "sinkB") return sinkState("b");
        if (sc.err[id]) return "err";
        if (sc.hot.includes(id)) return "hot";
        if (sc.cold.includes(id)) return "cold";
        return "off";
      };

      host.querySelectorAll("[data-node]").forEach((g) => {
        const id = g.dataset.node;
        const st = nodeState(id);
        g.dataset.state = st;
        g.classList.toggle("is-hot", st === "hot");
        g.classList.toggle("is-cold", st === "cold" || st === "off");
        g.classList.toggle("is-err", st === "err");
        g.classList.toggle("is-off", st === "off");
        g.classList.toggle("is-sel", id === layer);
        const sub = g.querySelector("[data-sub]");
        if (id === "sinkA") {
          g.querySelector(".pipe-title").textContent = sc.sinks.a.label;
          sub.textContent = st === "off" ? "unused" : sc.labels.hw || "";
        } else if (id === "sinkB") {
          g.querySelector(".pipe-title").textContent = sc.sinks.b.label;
          sub.textContent = st === "off" ? "unused this scenario" : "";
        } else {
          sub.textContent = sc.labels[id] || "";
        }
      });

      const liveSet = new Set([
        ...(sc.live.control || []),
        ...(sc.live.data || []),
        ...(sc.live.capture || []),
      ]);

      host.querySelectorAll("[data-edge]").forEach((g) => {
        const e = EDGES.find((x) => x.id === g.dataset.edge);
        const listed = liveSet.has(e.id);
        const kindOn =
          mode === "both" ||
          (mode === "data" && (e.kind === "data" || e.kind === "capture" || e.kind === "track")) ||
          (mode === "control" && e.kind !== "data" && e.kind !== "capture");
        const live = listed && kindOn;
        const errEdge =
          listed &&
          ((e.id === "hal-b" && nodeState("sinkB") === "err") ||
            (e.id === "alsa-a" && nodeState("sinkA") === "err") ||
            (e.id === "hal-a" && nodeState("sinkA") === "err") ||
            (e.id === "flinger-hal" && sc.err.flinger && (sc.live.data || []).includes("flinger-hal")));
        g.dataset.live = live ? "1" : "0";
        g.classList.toggle("is-live", live);
        g.classList.toggle("is-err", !!errEdge);
        g.classList.toggle("is-kind-off", !kindOn);
        g.classList.toggle("is-capture", e.kind === "capture");
        const pkt = g.querySelector(".pipe-pkt");
        const pktSet = new Set([...(sc.live.data || []), ...(sc.live.capture || [])]);
        const allowPkt = pktSet.has(e.id) && kindOn && mode !== "control";
        pkt.style.opacity = allowPkt ? "1" : "0";
      });
    },
  };
}
