import { getScenario, getLayer } from "../content/architecture.js";
import { getComparison } from "../content/comparisons.js";
import { getPcm, patchPcm } from "../lib/pcmState.js";
import { COMING } from "../pages/coming.js";
import { PLAYBOOKS } from "../content/playbooks.js";
import { DUMP_SCENARIOS, productLabel } from "../content/dumpLab.js";
import { RCA_CASES } from "../content/rcaCases.js";
import { GATES } from "../content/gates.js";
import { XML_FILES } from "../content/xmlFiles.js";
import { mountBusSelect } from "./busSelect.js";
import { bindPcmControls, controlsHtml, metricsHtml, paintMetrics, syncControls } from "../ui/pcmControls.js";
import { mountPipeline } from "./pipeline.js";
import { mountMeaningFocus } from "./meaningFocus.js";
import { mountStreamDescriptor } from "./streamDescriptor.js";
import { mountAlsaWheel } from "./alsaWheel.js";
import { mountSixRules } from "./sixRules.js";
import { mountPolicyFlinger } from "./policyFlinger.js";
import { mountPortsPatch } from "./portsPatch.js";
import { mountMuteChain } from "./muteChain.js";
import { mountSourceHops } from "./sourceHops.js";
import { mountQcomStack } from "./qcomStack.js";
import { mountHalStudio } from "./halStudio.js";
import { mountAsocMachine } from "./asocMachine.js";
import { mountLexiconStrip } from "./lexiconStrip.js";
import { mountRingBuffer } from "./ringBuffer.js";
import { mountPipes, THREADS } from "./pipes.js";
import { mountTdm } from "./tdmSlots.js";
import { mountLifecycleStudio } from "./lifecycle.js";
import { LIFE_SCENES } from "../content/lifecycle.js";

const LAST_GOOD = {
  app: "play() returned; buffers are being written; session exists",
  svc: "Focus / volume index set — not a PCM proof",
  policy: "Selected device matches intent; a mix/patch exists",
  flinger: "Track ACTIVE on a PlaybackThread; write counters increase",
  hal: "StreamDescriptor ACTIVE; observable frames move",
  alsa: "PCM RUNNING; hw_ptr moves; no XRUN storm",
  hw: "Amp EN asserted; acoustic energy (mic / current draw)",
};

const PEERS_MYTH =
  "<strong>Two Binders from the app:</strong> <code>IAudioFlinger.createTrack</code> (right) and <code>IAudioService</code> focus/volume (left). Policy is a peer — Flinger calls <code>getOutputForAttr</code>. PCM never visits Policy or AudioService. Phone media; AAOS two-bus is Architecture · navduck.";

export function mountLessonDiagram(host, diagramId, lesson = {}) {
  if (!diagramId) return null;
  const args = lesson.args || {};
  switch (diagramId) {
    case "pipeline-peers":
      return mountScenarioPipe(host, { scenarioId: args.scenario || "media", myth: PEERS_MYTH });
    case "pipeline-lkg":
      return mountScenarioPipe(host, {
        scenarioId: args.scenario || "media",
        lastGood: true,
        myth: "Last-known-good is the lowest layer with positive evidence. “No error in logcat” is not evidence. Click a box.",
      });
    case "pipeline-stepper":
      return mountScenarioPipe(host, {
        scenarioId: args.scenario || "media",
        hops: lesson.hops,
        myth: "Same live edges as Architecture · phone media. Step 4 is the peer query that already happened at createTrack — not a new App→Policy Binder.",
      });
    case "pipeline-io":
      return mountIoPipe(host);
    case "pipeline-navduck":
      return mountScenarioPipe(host, {
        scenarioId: "navduck",
        myth:
          args.myth ||
          "Two MixerThreads, two StreamDescriptors, two FE PCMs. CarAudioService registered the mixes — it is not on the sample path.",
      });
    case "pipeline-qcom":
      return mountWithLex(host, mountQcomStack, ["hlos", "pal", "agm", "dsp", "afe"]);
    case "pipeline-bt":
      return mountScenarioPipe(host, {
        scenarioId: "bt",
        myth: "A2DP I/O is Flinger → IModule bluetooth. Cabin TinyALSA is cold. AVAILABLE is not a live headset.",
      });
    case "pipeline-chime":
      return mountScenarioPipe(host, {
        scenarioId: "chime",
        myth: "Route is right. Output is STANDBY (HAL closed). No Command.burst yet — so no PCM packets on this drawing.",
      });
    case "meaning-focus-route":
      return mountMeaningFocus(host);
    case "streamdescriptor":
      return mountStreamDescriptor(host);
    case "hal-studio":
      return mountHalStudio(host);
    case "alsa-wheel":
      return mountWithLex(host, mountAlsaWheel, ["alsa", "asoc", "soc"]);
    case "asoc-machine":
      return mountAsocStudio(host);
    case "six-rules":
      return mountSixRules(host);
    case "fund-embed":
      return mountFundEmbed(host, args.board || "ring");
    case "policy-flinger":
      return mountPolicyFlinger(host);
    case "ports-patch":
      return mountPortsPatch(host);
    case "mute-chain":
      return mountWithLex(host, mountMuteChain, ["dsp", "dac", "dci", "dai"]);
    case "qcom-stack":
      return mountWithLex(host, mountQcomStack, ["hlos", "pal", "agm", "dsp", "afe", "dac"]);
    case "source-hops":
      return mountSourceHops(host);
    case "hidl-aidl":
      return mountHidlAidl(host);
    case "coming":
      return mountComingBind(host, args.coming || "debug");
    case "glossary-jump":
      return mountGlossaryJump(host);
    case "debug-jump":
      return mountDebugJump(host);
    case "dump-jump":
      return mountDumpJump(host);
    case "rca-jump":
      return mountRcaJump(host);
    case "gate-jump":
      return mountGateJump(host);
    case "xml-studio":
      return mountXmlStudio(host);
    case "lifecycle":
      return mountLifecycleBind(host, args);
    default:
      return null;
  }
}

function mountLifecycleBind(host, args) {
  let scene = args.scene === "create" ? "create" : "period";
  host.innerHTML = `
    <div class="learn-pipe">
      <div class="arch-mode">
        <span>Scene</span>
        ${LIFE_SCENES.map(
          (s) =>
            `<button type="button" data-life="${s.id}" class="${s.id === scene ? "active" : ""}">${s.name}</button>`,
        ).join("")}
      </div>
      <div data-lc></div>
      <p class="muted">Same stepper as <a data-life-link href="#/architecture/life/${scene}">Lifecycle studio</a>. Four PlaybackThreads stay on <a href="#/fundamentals">Fundamentals</a>.</p>
    </div>`;
  const studio = mountLifecycleStudio(host.querySelector("[data-lc]"), { scene, compact: true });
  host.querySelectorAll("[data-life]").forEach((b) => {
    b.onclick = () => {
      scene = b.dataset.life;
      host.querySelectorAll("[data-life]").forEach((x) => x.classList.toggle("active", x === b));
      const link = host.querySelector("[data-life-link]");
      if (link) link.setAttribute("href", `#/architecture/life/${scene}`);
      studio.setScene(scene);
    };
  });
  return {
    onCaption(fn) {
      host._onCaption = fn;
      studio.onCaption(fn);
    },
    update() {
      studio.update();
    },
  };
}

function mountWithLex(host, mountFn, ids) {
  host.innerHTML = `<div data-lex-main></div><div data-lex></div>`;
  const main = mountFn(host.querySelector("[data-lex-main]"));
  const lex = mountLexiconStrip(host.querySelector("[data-lex]"), ids);
  return {
    onCaption(fn) {
      host._onCaption = fn;
      main.onCaption?.(fn);
      lex.onCaption?.(fn);
    },
    update() {
      lex.update();
      main.update();
    },
  };
}

function mountAsocStudio(host) {
  host.innerHTML = `<div data-am></div>
    <p class="lex-kicker">TDM lives on the DAI. A channel is a snapshot; a slot is a time apartment. Car XML does not program slots.</p>
    <div data-tdm></div><div data-lex></div>`;
  const am = mountAsocMachine(host.querySelector("[data-am]"));
  const tdm = mountTdm(host.querySelector("[data-tdm]"));
  const lex = mountLexiconStrip(host.querySelector("[data-lex]"), ["soc", "asoc", "alsa", "dai", "dci"]);
  const apply = (patch) => {
    const m = patch ? patchPcm(patch) : getPcm();
    tdm.update(m);
    return m;
  };
  tdm.onPatch((patch) => apply(patch));
  return {
    onCaption(fn) {
      host._onCaption = fn;
      am.onCaption?.(fn);
      lex.onCaption?.(fn);
    },
    update() {
      lex.update();
      am.update();
      apply();
    },
  };
}

function mountScenarioPipe(host, { scenarioId, myth, lastGood, hops }) {
  const sc = getScenario(scenarioId);
  const hopList = hops || [];
  host.innerHTML = `
    <div class="learn-pipe">
      ${myth ? `<p class="del-myth">${myth}</p>` : ""}
      ${
        hopList.length
          ? `<div class="hop-bar">${hopList
              .map(
                (h, i) =>
                  `<button type="button" class="sd-st" data-hop="${i}"><span>${i + 1}</span>${h.short || ""}</button>`,
              )
              .join("")}</div>`
          : `<div class="arch-mode">
              <span>Path</span>
              <button type="button" data-mode="both" class="active">Both</button>
              <button type="button" data-mode="control">Control</button>
              <button type="button" data-mode="data">Data</button>
            </div>`
      }
      <div data-pipe-host></div>
      <ol class="arch-seq" data-seq></ol>
    </div>`;
  const pipe = mountPipeline(host.querySelector("[data-pipe-host]"));
  let mode = hopList.length ? hopList[0].mode : "both";
  let layer = hopList.length ? hopList[0].layer : "flinger";
  let hop = 0;

  const paint = () => {
    if (hopList.length) {
      const h = hopList[hop] || hopList[0];
      mode = h.mode;
      layer = h.layer;
      host.querySelectorAll("[data-hop]").forEach((b) => b.classList.toggle("active", +b.dataset.hop === hop));
      host.querySelector("[data-seq]").innerHTML = `<li><span>${hop + 1}</span>${h.line}</li>`;
    } else {
      host.querySelector("[data-seq]").innerHTML = sc.sequence.map((s, i) => `<li><span>${i + 1}</span>${s}</li>`).join("");
    }
    pipe.update(sc, { layer, mode });
    const L = getLayer(layer === "sinkA" || layer === "sinkB" ? "hw" : layer);
    if (lastGood) {
      const ev = LAST_GOOD[L.id] || LAST_GOOD.flinger;
      host._onCaption?.({
        who: `Last known good · ${L.name}`,
        fail: `${ev}. Investigate from here down. ${L.fails[0]}`,
      });
    } else if (hopList.length) {
      host._onCaption?.({ who: `Hop ${hop + 1} · ${L.name}`, fail: hopList[hop].line });
    } else {
      host._onCaption?.({
        who: `${L.name} · ${sc.labels[L.id] || ""}`,
        fail: L.fails[0],
      });
    }
  };

  pipe.onSelect((id) => {
    layer = id;
    paint();
  });
  host.querySelectorAll("[data-mode]").forEach((b) => {
    b.onclick = () => {
      mode = b.dataset.mode;
      host.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x === b));
      paint();
    };
  });
  host.querySelectorAll("[data-hop]").forEach((b) => {
    b.onclick = () => {
      hop = +b.dataset.hop;
      paint();
    };
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

function mountIoPipe(host) {
  host.innerHTML = `
    <div class="learn-pipe">
      <p class="del-myth"><strong>Playback</strong> is <code>IAudioFlinger.createTrack</code> → <code>getOutputForAttr</code>.
      <strong>Capture</strong> is <code>createRecord</code> → <code>getInputForAttr</code> — data runs the other way. MediaPlayer still ends in a track. AAudio is not a second Flinger.</p>
      <div class="arch-mode">
        <span>I/O</span>
        <button type="button" data-io="play" class="active">Playback</button>
        <button type="button" data-io="rec">Capture</button>
      </div>
      <div class="arch-mode">
        <span>Path</span>
        <button type="button" data-mode="both" class="active">Both</button>
        <button type="button" data-mode="control">Control</button>
        <button type="button" data-mode="data">Data</button>
      </div>
      <div data-pipe-host></div>
      <ol class="arch-seq" data-seq></ol>
    </div>`;
  const pipe = mountPipeline(host.querySelector("[data-pipe-host]"));
  let io = "play";
  let mode = "both";
  let layer = "flinger";

  const scenario = () => {
    if (io === "play") return getScenario("media");
    const base = getScenario("carplay");
    return {
      ...base,
      live: {
        control: ["app-svc", "svc-policy", "peer", "app-flinger"],
        data: [],
        capture: ["cap-b-hal", "cap-hal-flinger", "cap-flinger-app"],
      },
      sequence: [
        "AudioRecord / AAudio input in the app process",
        "Binder IAudioFlinger.createRecord — not IAudioPolicyService",
        "Flinger → AudioSystem.getInputForAttr → Policy (source / device)",
        "RecordThread. Data is opposite: mic → HAL in → RecordThread → app",
        "Focus / privacy still AudioService. ECNR is DSP, not a Flinger mix",
      ],
    };
  };

  const paint = () => {
    const sc = scenario();
    pipe.update(sc, { layer, mode });
    host.querySelector("[data-seq]").innerHTML = sc.sequence.map((s, i) => `<li><span>${i + 1}</span>${s}</li>`).join("");
    const L = getLayer(layer === "sinkA" || layer === "sinkB" ? "hw" : layer);
    host._onCaption?.({
      who: `${io === "play" ? "Playback" : "Capture"} · ${L.name}`,
      fail: io === "play" ? "createTrack → getOutputForAttr. App does not Binder to Policy." : "createRecord → getInputForAttr. Mic → HAL → RecordThread → app.",
    });
  };

  pipe.onSelect((id) => {
    layer = id === "sinkA" || id === "sinkB" ? "hw" : id;
    paint();
  });
  host.querySelectorAll("[data-io]").forEach((b) => {
    b.onclick = () => {
      io = b.dataset.io;
      host.querySelectorAll("[data-io]").forEach((x) => x.classList.toggle("active", x === b));
      paint();
    };
  });
  host.querySelectorAll("[data-mode]").forEach((b) => {
    b.onclick = () => {
      mode = b.dataset.mode;
      host.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("active", x === b));
      paint();
    };
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

function mountFundEmbed(host, board) {
  const m0 = getPcm();
  const showRing = board === "ring";
  const showPipes = board === "pipes";
  const showTdm = board === "tdm";
  host.innerHTML = `
    <div class="fund-embed">
      ${showRing ? `${controlsHtml(m0, { extras: false })}${metricsHtml()}<div data-ring></div>` : ""}
      ${showPipes ? `<div data-pipes></div>` : ""}
      ${showTdm ? `<div data-tdm></div>` : ""}
    </div>`;

  const ring = showRing ? mountRingBuffer(host.querySelector("[data-ring]")) : null;
  const pipes = showPipes ? mountPipes(host.querySelector("[data-pipes]")) : null;
  const tdm = showTdm ? mountTdm(host.querySelector("[data-tdm]")) : null;

  const apply = (patch) => {
    const m = patch ? patchPcm(patch) : getPcm();
    if (showRing) {
      paintMetrics(host, m);
      syncControls(host, m);
      ring.update(m);
      host._onCaption?.({
        who: `${m.rate / 1000} kHz · ${m.periodFrames} × ${m.periodCount}`,
        fail: `period ${m.periodMs.toFixed(2)} ms, buffer ${m.bufferMs.toFixed(1)} ms. RUNNING + zeros is not an XRUN.`,
      });
    }
    if (showPipes) {
      pipes.update(m);
      const t = THREADS[m.path] || THREADS.pcm;
      host._onCaption?.({ who: t.title, fail: t.skipMixer ? "Mixer skipped — Flinger still owns the thread." : t.junior });
    }
    if (showTdm) {
      tdm.update(m);
      host._onCaption?.({
        who: `${m.channels} ch · ${m.tdmSlots} slots`,
        fail: "Channel ≠ TDM slot. car_audio_configuration.xml does not program the slot map.",
      });
    }
    return m;
  };

  if (showRing) bindPcmControls(host, (patch) => apply(patch));
  if (showPipes) {
    pipes.onPath((path) => apply({ path }));
  }
  if (showTdm) {
    tdm.onPatch((patch) => apply(patch));
  }

  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      apply();
    },
  };
}

function mountHidlAidl(host) {
  const c = getComparison("hidl-aidl");
  host.innerHTML = `
    <div class="cmp-embed">
      <p class="del-myth"><strong>This course is AIDL.</strong> A HIDL vendor HAL can still load — classify it, then stop using <code>IStreamOut.write()</code> as the I/O primitive.</p>
      <svg class="viz-svg" viewBox="0 0 900 150" role="img" aria-label="HIDL write versus AIDL burst">
        <g class="viz-node is-dim">
          <rect x="20" y="28" width="400" height="96" rx="14"/>
          <foreignObject x="32" y="36" width="376" height="80">
            <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
              <span class="pipe-kicker">HIDL · history</span>
              <strong class="pipe-title">IDevicesFactory → IDevice → IStreamOut.write()</strong>
              <span class="pipe-sub">Config XML was APM input. No new audio HAL APIs after Android 14.</span>
            </div>
          </foreignObject>
        </g>
        <g class="viz-node is-sel">
          <rect x="480" y="28" width="400" height="96" rx="14"/>
          <foreignObject x="492" y="36" width="376" height="80">
            <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
              <span class="pipe-kicker">AIDL · this course</span>
              <strong class="pipe-title">IModule + StreamDescriptor.Command.burst</strong>
              <span class="pipe-sub">write audio.fmq, then burst. IConfig + getAudioPorts for topology.</span>
            </div>
          </foreignObject>
        </g>
      </svg>
      <div class="table-wrap">
        <table class="skill-grid">
          <thead><tr>${c.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${c.rows.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </div>`;
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      host._onCaption?.({
        who: "HIDL vs AIDL",
        fail: "I/O: IStreamOut.write (history) vs StreamDescriptor.Command.burst (this course).",
      });
    },
  };
}

function mountComingBind(host, id) {
  const spec = COMING[id] || COMING.debug;
  host.innerHTML = `
    <div class="coming-bind">
      <p class="del-myth"><span class="phase-chip">Phase ${spec.phase}</span> ${spec.lede}</p>
      <div class="coming-grid">
        <section class="card coming-card">
          <h2>What will ship</h2>
          <ul>${spec.boards.map((b) => `<li>${b}</li>`).join("")}</ul>
        </section>
        <section class="card coming-card">
          <h2>Use this until then</h2>
          <ul class="coming-links">${spec.now.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}</ul>
        </section>
      </div>
    </div>`;
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      host._onCaption?.({ who: spec.title, fail: spec.lede });
    },
  };
}

function mountDebugJump(host) {
  host.innerHTML = `
    <div class="gloss-jump">
      <p class="del-myth">This module is the <strong>habit</strong>. The <a href="#/debug">Debug engine</a> is the tree: classify HAL generation, then a kill test per layer. Dumps are teaching reconstructions.</p>
      <div class="six-grid">
        ${PLAYBOOKS.map(
          (p) =>
            `<a class="mf-card" href="#/debug/${p.id}"><span class="mf-sub">${p.product}</span><strong>${p.name}</strong></a>`,
        ).join("")}
      </div>
    </div>`;
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      host._onCaption?.({ who: "Debug engine", fail: "Classify first. Then walk a kill test. Do not start in the HAL for a wrong usage." });
    },
  };
}

function mountDumpJump(host) {
  host.innerHTML = `
    <div class="gloss-jump">
      <p class="del-myth">This module is how to <strong>read</strong> dumps. The <a href="#/workbench/dump">dump lab</a> is service × scenario. A missing pair is empty — the old simulator that ignored the service dropdown does not come back.</p>
      <div class="six-grid">
        ${DUMP_SCENARIOS.map(
          (s) =>
            `<a class="mf-card" href="#/workbench/dump/flinger/${s.id}"><span class="mf-sub">${productLabel(s.product)}</span><strong>${s.name}</strong></a>`,
        ).join("")}
      </div>
    </div>`;
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      host._onCaption?.({
        who: "Dump lab",
        fail: "Join session, address, StreamDescriptor, and t1−t0. Policy dump is not a Flinger dump.",
      });
    },
  };
}

function mountXmlStudio(host) {
  host.innerHTML = `
    <div class="gloss-jump">
      <p class="del-myth">XML is a <strong>boot contract</strong>. Mixes are installed once; <code>play()</code> matches them. Car XML does not program TDM. Fade XML is not a bus mute. <a href="#/architecture/xml">Open Config studio</a>.</p>
      <div data-xml-bus></div>
      <div class="six-grid">
        ${XML_FILES.filter((f) => f.family === "aaos" || f.id === "audio-policy-configuration" || f.id === "mixer-paths")
          .map(
            (f) =>
              `<a class="mf-card" href="#/architecture/xml/${f.id}"><span class="mf-sub">${f.process}</span><strong>${f.file}</strong></a>`,
          )
          .join("")}
      </div>
    </div>`;
  const bus = mountBusSelect(host.querySelector("[data-xml-bus]"));
  return {
    onCaption(fn) {
      host._onCaption = fn;
      bus.onCaption?.(fn);
    },
    update() {
      bus.update();
      host._onCaption?.({
        who: "Config studio",
        fail: "Address join: car XML = Policy port = Flinger BUS. dumpsys is what booted.",
      });
    },
  };
}

function mountGateJump(host) {
  host.innerHTML = `
    <div class="gloss-jump">
      <p class="del-myth">Gates are <strong>demonstrations</strong>, not rereads. Rank per track — you can be high on AAOS XML and junior on ASoC. The <a href="#/progression">Progression</a> page is the ladder.</p>
      <div class="six-grid">
        ${GATES.map(
          (g) =>
            `<a class="mf-card" href="#/progression/${g.id}"><span class="mf-sub">Gate ${g.id}</span><strong>${g.title}</strong></a>`,
        ).join("")}
      </div>
    </div>`;
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      host._onCaption?.({
        who: "Progression",
        fail: "Mark a gate only when you can run its test. Module 24 is the textbook.",
      });
    },
  };
}

function mountRcaJump(host) {
  host.innerHTML = `
    <div class="gloss-jump">
      <p class="del-myth">This module is how to <strong>write</strong> RCA. The <a href="#/workbench/rca">RCA lab</a> uses workbook 01–08. Label cards, write five lines, then reveal. Markdown stays canonical.</p>
      <div class="six-grid">
        ${RCA_CASES.map(
          (c) =>
            `<a class="mf-card" href="#/workbench/rca/${c.id}"><span class="mf-sub">Case ${c.id}</span><strong>${c.title}</strong></a>`,
        ).join("")}
      </div>
    </div>`;
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      host._onCaption?.({
        who: "RCA lab",
        fail: "Immediate failure is a dump line. Competing hypotheses on different layers. Then the key.",
      });
    },
  };
}

function mountGlossaryJump(host) {
  const ids = ["policy-flinger", "hidl-aidl", "pal-agm", "dai-dci", "alsa-asoc", "dsp-dac", "soc-asoc", "pcm-dai"];
  host.innerHTML = `
    <div class="gloss-jump">
      <p class="del-myth">Compare is wired by <code>compareId</code> only. Unpaired terms have no Compare button. This page does not clone the glossary.</p>
      <div class="six-grid">
        ${ids
          .map((id) => {
            const c = getComparison(id);
            return c
              ? `<a class="mf-card" href="#/glossary/${id}"><span class="mf-sub">${id}</span><strong>${c.title}</strong></a>`
              : "";
          })
          .join("")}
      </div>
    </div>`;
  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      host._onCaption?.({ who: "Glossary", fail: "Open a table by id. Never match on the first word of the title." });
    },
  };
}
