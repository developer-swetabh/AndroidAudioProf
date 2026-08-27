import { esc } from "../lib/dom.js";
import { THREADS } from "./pipes.js";
import { CREATE_STEPS, PERIOD_STEPS, getLifeScene, stepsFor } from "../content/lifecycle.js";
import { mountPolicyFlinger } from "./policyFlinger.js";
import { mountPortsPatch } from "./portsPatch.js";
import { mountBusSelect } from "./busSelect.js";
import { mountStreamDescriptor } from "./streamDescriptor.js";

const HOTGLOW = `<defs>
  <filter id="lcglow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="4" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>`;

function pkt(href) {
  return `<circle class="pipe-pkt" r="4"><animateMotion dur="1.6s" repeatCount="indefinite"><mpath href="${href}"/></animateMotion></circle>`;
}

export function createZoomSvg(step) {
  const s = CREATE_STEPS[step] || CREATE_STEPS[0];
  const on = (id) => (s.hot || []).includes(id);
  const dataOn = (s.live.data || []).includes("app-flinger");
  const peerOn = (s.live.control || []).includes("peer");
  const svcOn = (s.live.control || []).includes("app-svc");
  const startOn = s.id === "play";
  const pcmOn = s.id === "pcm";
  const cls = (id) => `viz-node ${on(id) ? "is-sel" : "is-dim"}`;
  const halTitle = startOn ? "IModule · Command.start" : "IModule · Command.burst";
  return `<svg class="lc-svg viz-svg" viewBox="0 0 920 300" role="img" aria-label="createTrack versus play">
    ${HOTGLOW}
    <text class="lc-hull-lab" x="28" y="22">app process</text>
    <text class="lc-hull-lab" x="28" y="118">${svcOn ? "" : "system_server · no PCM"}</text>
    <text class="lc-hull-lab" x="520" y="22">audioserver · Policy ‖ Flinger</text>
    <g class="${cls("app")}">
      <rect x="320" y="28" width="240" height="56" rx="14"/>
      <foreignObject x="332" y="34" width="216" height="44">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">app</span><strong class="pipe-title">App / AudioTrack</strong></div>
      </foreignObject>
    </g>
    <g class="${cls("svc")}">
      <rect x="24" y="128" width="250" height="56" rx="14"/>
      <foreignObject x="36" y="134" width="226" height="44">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">system_server</span><strong class="pipe-title">AudioService</strong></div>
      </foreignObject>
    </g>
    <g class="${cls("policy")}">
      <rect x="24" y="214" width="250" height="56" rx="14"/>
      <foreignObject x="36" y="220" width="226" height="44">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">audioserver</span><strong class="pipe-title">AudioPolicy · decide</strong></div>
      </foreignObject>
    </g>
    <g class="${cls("flinger")}">
      <rect x="620" y="128" width="276" height="56" rx="14"/>
      <foreignObject x="632" y="134" width="252" height="44">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">audioserver</span><strong class="pipe-title">AudioFlinger · execute</strong></div>
      </foreignObject>
    </g>
    <g class="${cls("hal")}">
      <rect x="620" y="214" width="276" height="56" rx="14"/>
      <foreignObject x="632" y="220" width="252" height="44">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">vendor</span><strong class="pipe-title">${halTitle}</strong></div>
      </foreignObject>
    </g>
    <g class="pipe-edge ${dataOn ? "is-live" : ""}" data-kind="track">
      <path d="M 540 56 C 700 70, 760 100, 760 128" fill="none"/>
      ${pcmOn ? pkt("#lc-ct-pcm") : ""}
      <path id="lc-ct-pcm" d="M 540 56 C 700 70, 760 100, 760 128" fill="none"/>
    </g>
    <g class="pipe-edge ${svcOn ? "is-live" : ""}" data-kind="control">
      <path d="M 360 84 C 200 100, 150 110, 150 128" fill="none"/>
    </g>
    <g class="pipe-edge ${peerOn ? "is-live" : ""}" data-kind="peer">
      <path d="M 274 242 C 420 242, 520 156, 620 156" fill="none"/>
    </g>
    <g class="pipe-edge ${startOn || pcmOn ? "is-live" : ""}" data-kind="data">
      <path d="M 760 184 L 760 214" fill="none"/>
      ${pcmOn ? pkt("#lc-ct-hal") : ""}
      <path id="lc-ct-hal" d="M 760 184 L 760 214" fill="none"/>
    </g>
    ${s.id === "createTrack" ? `<text class="lc-chip" x="620" y="92">createTrack</text>` : ""}
    ${s.id === "getOutput" || s.id === "track" ? `<text class="lc-chip" x="360" y="188">getOutputForAttr · not PCM</text>` : ""}
    ${svcOn ? `<text class="lc-chip amber" x="200" y="96">focus · not routing</text>` : ""}
    ${startOn ? `<text class="lc-chip" x="780" y="204">Command.start</text>` : ""}
    ${pcmOn ? `<text class="lc-chip" x="780" y="204">burst</text>` : ""}
  </svg>`;
}

export function periodZoomSvg(step, threadId) {
  const t = THREADS[threadId] || THREADS.pcm;
  const skip = t.skipMixer;
  const s = PERIOD_STEPS[step] || PERIOD_STEPS[0];
  const mixHot = s.id === "mix" && !skip;
  const burstHot = s.id === "burst";
  const prepHot = s.id === "prepare";
  const wakeHot = s.id === "wake";
  const sleepHot = s.id === "sleep";
  const helper = threadId === "fast";
  const underrun = prepHot && !skip;
  return `<svg class="lc-svg viz-svg" viewBox="0 0 920 340" role="img" aria-label="${esc(t.title)} period loop">
    ${HOTGLOW}
    <text class="lc-hull-lab" x="24" y="22">audioserver · ${esc(t.title)}${helper ? " (helper on MixerThread)" : ""}</text>
    <g class="viz-node ${wakeHot || sleepHot ? "is-sel" : ""}">
      <circle cx="70" cy="170" r="44" class="lc-clock"/>
      <text x="70" y="166" text-anchor="middle" class="lc-clock-n">${wakeHot ? "WAKE" : sleepHot ? "SLEEP" : "TICK"}</text>
      <text x="70" y="186" text-anchor="middle" class="lc-hull-lab">${esc(t.period.split("(")[0].trim())}</text>
    </g>
    <g class="viz-node ${prepHot ? "is-sel" : ""}">
      <rect x="150" y="70" width="200" height="52" rx="12"/>
      <foreignObject x="160" y="76" width="180" height="40">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">${skip ? "one track" : "track"}</span><strong class="pipe-title">${skip ? esc(t.tracks[0].label) : "MEDIA FIFO"}</strong></div>
      </foreignObject>
    </g>
    <g class="viz-node ${prepHot && !skip ? "is-sel" : ""} ${skip ? "is-dim" : ""} ${underrun ? "lc-underrun" : ""}">
      <rect x="150" y="138" width="200" height="52" rx="12"/>
      <foreignObject x="160" y="144" width="180" height="40">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">${skip ? "cannot board" : "track"}</span><strong class="pipe-title">${skip ? "NAV ✕" : "optional 2nd"}</strong></div>
      </foreignObject>
    </g>
    ${
      helper
        ? `<g class="viz-node is-sel">
      <rect x="150" y="210" width="200" height="48" rx="12"/>
      <foreignObject x="160" y="214" width="180" height="40">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">helper · not a HAL output</span><strong class="pipe-title">FastMixer</strong></div>
      </foreignObject>
    </g>`
        : ""
    }
    <g class="viz-node ${mixHot ? "is-sel" : ""} ${skip ? "is-dim" : ""}">
      <rect x="400" y="110" width="200" height="88" rx="14"/>
      <foreignObject x="412" y="118" width="176" height="72">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">${skip ? "skipped" : "AudioMixer"}</span><strong class="pipe-title">${skip ? "no mix" : "+  one PCM"}</strong></div>
      </foreignObject>
    </g>
    <g class="viz-node ${burstHot ? "is-sel" : ""}">
      <rect x="660" y="118" width="230" height="72" rx="14"/>
      <foreignObject x="672" y="126" width="206" height="56">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">vendor</span><strong class="pipe-title">${esc(t.burst)}</strong></div>
      </foreignObject>
    </g>
    ${
      skip
        ? `<g class="pipe-edge is-live" data-kind="data">
            <path id="lc-skip" d="M 350 96 C 520 40, 600 90, 660 140" fill="none"/>
            ${burstHot ? pkt("#lc-skip") : ""}
          </g>`
        : `<g class="pipe-edge is-live" data-kind="data">
            <path d="M 350 96 L 400 140" fill="none"/>
            <path d="M 350 164 L 400 160" fill="none"/>
            <path id="lc-mixout" d="M 600 154 L 660 154" fill="none"/>
            ${burstHot ? pkt("#lc-mixout") : ""}
          </g>`
    }
    ${burstHot ? `<text class="lc-chip" x="620" y="110">audio.fmq then burst</text>` : ""}
    ${skip ? `<text class="lc-chip amber" x="400" y="88">skip mixer · still Flinger</text>` : ""}
    ${mixHot && !skip ? `<text class="lc-chip" x="400" y="88">DSP cannot un-mix this</text>` : ""}
    ${underrun ? `<text class="lc-chip amber" x="150" y="208">late track → zeros, not a blocked HAL</text>` : ""}
  </svg>`;
}

export function busZoomSvg(stepId) {
  const shared = stepId === "shared";
  return `<svg class="lc-svg viz-svg" viewBox="0 0 920 280" role="img" aria-label="${shared ? "shared bus one PCM" : "two-bus two MixerThreads"}">
    ${HOTGLOW}
    <text class="lc-hull-lab" x="24" y="22">${shared ? "one address → one MixerThread" : "two mixes → two MixerThreads"}</text>
    <g class="viz-node is-sel">
      <rect x="24" y="48" width="200" height="56" rx="12"/>
      <foreignObject x="36" y="54" width="176" height="44">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">app</span><strong class="pipe-title">MEDIA track</strong></div>
      </foreignObject>
    </g>
    <g class="viz-node is-sel">
      <rect x="24" y="160" width="200" height="56" rx="12"/>
      <foreignObject x="36" y="166" width="176" height="44">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">app</span><strong class="pipe-title">NAV track</strong></div>
      </foreignObject>
    </g>
    ${
      shared
        ? `<g class="viz-node is-sel">
            <rect x="320" y="88" width="240" height="96" rx="14"/>
            <foreignObject x="332" y="96" width="216" height="80">
              <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">audioserver · one output</span><strong class="pipe-title">ONE MixerThread</strong><span class="pipe-sub">vol=1.0 + vol=1.0</span></div>
            </foreignObject>
          </g>
          <g class="viz-node is-sel">
            <rect x="640" y="100" width="250" height="72" rx="14"/>
            <foreignObject x="652" y="108" width="226" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">vendor · one stream</span><strong class="pipe-title">one PCM at the DSP</strong></div>
            </foreignObject>
          </g>
          <g class="pipe-edge is-live" data-kind="data">
            <path d="M 224 76 L 320 120" fill="none"/>
            <path d="M 224 188 L 320 160" fill="none"/>
            <path d="M 560 136 L 640 136" fill="none"/>
          </g>
          <text class="lc-chip amber" x="320" y="72">hardware duck impossible</text>`
        : `<g class="viz-node is-sel">
            <rect x="320" y="40" width="220" height="72" rx="14"/>
            <foreignObject x="332" y="48" width="196" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">bus0_media_out</span><strong class="pipe-title">MixerThread A</strong></div>
            </foreignObject>
          </g>
          <g class="viz-node is-sel">
            <rect x="320" y="152" width="220" height="72" rx="14"/>
            <foreignObject x="332" y="160" width="196" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">bus1_navigation_out</span><strong class="pipe-title">MixerThread B</strong></div>
            </foreignObject>
          </g>
          <g class="viz-node is-sel">
            <rect x="640" y="40" width="250" height="72" rx="14"/>
            <foreignObject x="652" y="48" width="226" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">IModule stream A</span><strong class="pipe-title">Command.burst</strong></div>
            </foreignObject>
          </g>
          <g class="viz-node is-sel">
            <rect x="640" y="152" width="250" height="72" rx="14"/>
            <foreignObject x="652" y="160" width="226" height="56">
              <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo"><span class="pipe-kicker">IModule stream B</span><strong class="pipe-title">Command.burst</strong></div>
            </foreignObject>
          </g>
          <g class="pipe-edge is-live" data-kind="data">
            <path d="M 224 76 L 320 76" fill="none"/>
            <path d="M 224 188 L 320 188" fill="none"/>
            <path d="M 540 76 L 640 76" fill="none"/>
            <path d="M 540 188 L 640 188" fill="none"/>
          </g>
          <text class="lc-chip" x="320" y="28">two FE PCMs · HW duck possible</text>`
    }
  </svg>`;
}

export function standbyZoomSvg(stepId) {
  const sw = stepId === "sw";
  const hal = stepId === "hal";
  const chime = stepId === "chime";
  return `<svg class="lc-svg viz-svg" viewBox="0 0 920 260" role="img" aria-label="two STANDBYs">
    ${HOTGLOW}
    <text class="lc-hull-lab" x="24" y="22">same tear-down, two names</text>
    <g class="viz-node ${sw || chime ? "is-sel" : "is-dim"}">
      <rect x="40" y="48" width="380" height="160" rx="16"/>
      <foreignObject x="56" y="64" width="348" height="128">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
          <span class="pipe-kicker">audioserver · PlaybackThread</span>
          <strong class="pipe-title">software standby</strong>
          <span class="pipe-sub">Idle too long → Command.standby. Next play() pays openOutputStream.</span>
        </div>
      </foreignObject>
    </g>
    <g class="viz-node ${hal || chime ? "is-sel" : "is-dim"}">
      <rect x="500" y="48" width="380" height="160" rx="16"/>
      <foreignObject x="516" y="64" width="348" height="128">
        <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
          <span class="pipe-kicker">vendor · StreamDescriptor</span>
          <strong class="pipe-title">state=STANDBY</strong>
          <span class="pipe-sub">STANDBY --start→ IDLE --burst→ ACTIVE. Not system suspend.</span>
        </div>
      </foreignObject>
    </g>
    ${chime ? `<text class="lc-chip amber" x="40" y="230">Track can still look ACTIVE while the descriptor is STANDBY</text>` : ""}
    ${sw ? `<text class="lc-chip" x="40" y="230">Flinger closed the tunnel</text>` : ""}
    ${hal ? `<text class="lc-chip" x="500" y="230">HAL contract after Command.standby</text>` : ""}
  </svg>`;
}

export function mountLifecycleStudio(host, { scene = "create", stepId = "", compact = false } = {}) {
  if (!host) return { update() {}, onCaption() {} };
  let sceneId = getLifeScene(scene).id;
  let thread = "pcm";
  const steps = () => stepsFor(sceneId);
  let step = Math.max(0, steps().findIndex((x) => x.id === stepId));
  if (step < 0) step = 0;
  let zoomKind = "";

  host.classList.add("lc-stage");
  host.tabIndex = 0;
  host.innerHTML = compact
    ? `<div class="lc-compact">
        <p class="del-myth" data-myth></p>
        <div class="arch-mode" data-threads hidden></div>
        <div class="hop-bar" data-hops role="tablist"></div>
        <div data-zoom></div>
        <pre class="dump-line" data-dump></pre>
      </div>`
    : `<div class="lc-widget">
        <p class="del-myth" data-myth></p>
        <div class="arch-mode" data-threads hidden></div>
        <div class="hop-bar" data-hops role="tablist"></div>
        <div data-zoom></div>
        <p class="flow-cap" data-cap aria-live="polite"></p>
        <pre class="dump-line" data-dump></pre>
      </div>`;

  const zoom = host.querySelector("[data-zoom]");
  const threadBar = host.querySelector("[data-threads]");

  const paintZoom = (st) => {
    if (sceneId === "policy") {
      if (zoomKind !== "policy") {
        zoomKind = "policy";
        zoom.innerHTML = `<div data-pf></div><div data-pp hidden></div><div data-bus hidden></div>`;
        mountPolicyFlinger(zoom.querySelector("[data-pf]")).update();
        mountPortsPatch(zoom.querySelector("[data-pp]")).update();
        mountBusSelect(zoom.querySelector("[data-bus]")).update();
      }
      zoom.querySelector("[data-pf]").hidden = st.id === "avail";
      zoom.querySelector("[data-pp]").hidden = st.id !== "avail";
      zoom.querySelector("[data-bus]").hidden = st.id !== "bootmix";
      if (st.id === "bootmix") zoom.querySelector("[data-pf]").hidden = true;
      return;
    }
    if (sceneId === "standby") {
      if (zoomKind !== "standby") {
        zoomKind = "standby";
        zoom.innerHTML = `<div data-sb-svg></div><div data-sd></div>`;
        mountStreamDescriptor(zoom.querySelector("[data-sd]")).update();
      }
      zoom.querySelector("[data-sb-svg]").innerHTML = standbyZoomSvg(st.id);
      return;
    }
    zoomKind = sceneId;
    if (sceneId === "bus") {
      zoom.innerHTML = busZoomSvg(st.id);
      return;
    }
    if (sceneId === "period") {
      zoom.innerHTML = periodZoomSvg(step, thread);
      return;
    }
    zoom.innerHTML = createZoomSvg(step);
  };

  const paintThreads = () => {
    const show = sceneId === "period";
    threadBar.hidden = !show;
    if (!show) return;
    threadBar.innerHTML = `<span>Thread</span>${Object.values(THREADS)
      .map(
        (t) =>
          `<button type="button" data-th="${t.id}" class="${t.id === thread ? "active" : ""}" aria-pressed="${t.id === thread}">${esc(t.title)}</button>`,
      )
      .join("")}`;
    threadBar.querySelectorAll("[data-th]").forEach((b) => {
      b.onclick = () => {
        thread = THREADS[b.dataset.th] ? b.dataset.th : "pcm";
        paint();
      };
    });
  };

  const paint = () => {
    const sc = getLifeScene(sceneId);
    const list = steps();
    if (step >= list.length) step = list.length - 1;
    if (step < 0) step = 0;
    const st = list[step];
    host.querySelector("[data-myth]").innerHTML = sc.myth;
    paintThreads();
    host.querySelector("[data-hops]").innerHTML = list
      .map(
        (x, i) =>
          `<button type="button" class="sd-st${i === step ? " active" : ""}" role="tab" aria-selected="${i === step}" data-i="${i}"><span>${i + 1}</span>${esc(x.short)}</button>`,
      )
      .join("");
    paintZoom(st);
    const cap = host.querySelector("[data-cap]");
    if (cap) cap.textContent = `WHO · ${st.who} — WHERE · ${st.where} — ${st.line}`;
    host.querySelector("[data-dump]").textContent = st.dump;
    host.querySelectorAll("[data-i]").forEach((b) => {
      b.onclick = () => {
        step = +b.dataset.i;
        paint();
      };
    });
    host._onCaption?.({ who: st.who, fail: st.line });
    host._onStep?.(sceneId, st.id);
    host.focus({ preventScroll: true });
  };

  host.onkeydown = (e) => {
    const list = steps();
    const n = +e.key;
    if (e.key === "ArrowRight" || e.key === "j") {
      step = Math.min(list.length - 1, step + 1);
      paint();
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "k") {
      step = Math.max(0, step - 1);
      paint();
      e.preventDefault();
    } else if (e.key === "Home") {
      step = 0;
      paint();
      e.preventDefault();
    } else if (e.key === "End") {
      step = list.length - 1;
      paint();
      e.preventDefault();
    } else if (n >= 1 && n <= list.length) {
      step = n - 1;
      paint();
      e.preventDefault();
    }
  };

  paint();
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    onStep(fn) {
      host._onStep = fn;
    },
    setScene(id) {
      sceneId = getLifeScene(id).id;
      step = 0;
      zoomKind = "";
      paint();
    },
    setThread(id) {
      thread = THREADS[id] ? id : "pcm";
      paint();
    },
    thread() {
      return thread;
    },
    scene() {
      return sceneId;
    },
    update() {
      paint();
    },
  };
}
