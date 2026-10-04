import { $, copy, esc } from "../lib/dom.js";
import { AOSP_TAG } from "../lib/aosp.js";
import { setMain } from "../shell.js";
import { SCENARIOS, getLayer, getScenario } from "../content/architecture.js";
import { mountPipeline } from "../diagrams/pipeline.js";
import { pageConfigStudio } from "./configStudio.js";
import { pageLifecycleStudio } from "./lifecycleStudio.js";

export function pageArchitecture(arg = "") {
  const first = (arg || "").split("/")[0];
  if (first === "xml" || first === "configs") {
    pageConfigStudio((arg || "").split("/").slice(1).join("/"));
    return;
  }
  if (first === "life" || first === "lifecycle") {
    pageLifecycleStudio((arg || "").split("/").slice(1).join("/"));
    return;
  }
  const start = getScenario(first);
  setMain(`
    <div class="arch-page">
      <aside class="arch-rail">
        <p class="learn-related" style="margin:0 0 10px">
          <a class="btn-ghost" href="#/architecture/xml">Config XML →</a>
          <a class="btn-ghost" href="#/architecture/life">Lifecycle →</a>
        </p>
        <h2>Scenarios</h2>
        <div class="arch-scens">
          ${SCENARIOS.map(
            (s) => `<button type="button" class="arch-sc ${s.id === start.id ? "active" : ""}" data-sc="${s.id}">
              <strong>${s.name}</strong>
              <span>${s.blurb}</span>
              <em>${s.product}</em>
            </button>`,
          ).join("")}
        </div>
        <div class="arch-mode">
          <span>Path</span>
          <button type="button" data-mode="both" class="active">Both</button>
          <button type="button" data-mode="control">Control</button>
          <button type="button" data-mode="data">Data</button>
        </div>
        <p class="muted">Box captions are <strong>process names</strong> (app / system_server / audioserver / vendor / kernel), not OSI layers. AudioPolicy and AudioFlinger are both <code>audioserver</code> — peers. Amber dashed = control. Cyan = PCM. Teal dashed = capture.</p>
      </aside>
      <section class="arch-stage">
        <div class="arch-legend">
          <span class="lg hot">Hot</span>
          <span class="lg cold">Cold</span>
          <span class="lg err">Error</span>
          <span class="lg data">Playback PCM</span>
          <span class="lg control">Control (amber dash)</span>
          <span class="lg data">Capture (teal dash)</span>
        </div>
        <div id="pipeline"></div>
        <ol class="arch-seq" data-seq></ol>
        <pre class="dump-line" data-dump></pre>
        <p class="arch-cap" data-cap></p>
      </section>
      <aside class="arch-drawer" id="drawer"></aside>
    </div>`);

  const root = $("#app-main");
  const pipe = mountPipeline($("#pipeline"));
  let scId = start.id;
  let layerId = "app";
  let mode = "both";

  const paint = () => {
    const sc = getScenario(scId);
    pipe.update(sc, { layer: layerId, mode });
    root.querySelector("[data-cap]").textContent = sc.lede;
    root.querySelector("[data-dump]").textContent = sc.dump;
    root.querySelector("[data-seq]").innerHTML = (sc.sequence || [])
      .map((s, i) => `<li><span>${i + 1}</span>${esc(s)}</li>`)
      .join("");
    root.querySelectorAll("[data-sc]").forEach((b) => b.classList.toggle("active", b.dataset.sc === scId));
    root.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    renderDrawer($("#drawer"), sc, layerId);
  };

  pipe.onSelect((id) => {
    if (id === "sinkA" || id === "sinkB") layerId = "hw";
    else layerId = id === "aaos" ? "svc" : id;
    paint();
  });

  root.querySelectorAll("[data-sc]").forEach((b) => {
    b.onclick = () => {
      scId = b.dataset.sc;
      const sc = getScenario(scId);
      if (!sc.hot.includes(layerId) && !sc.cold.includes(layerId) && !sc.err[layerId]) {
        layerId = sc.hot[0];
      }
      history.replaceState(null, "", `#/architecture/${scId}`);
      paint();
    };
  });
  root.querySelectorAll("[data-mode]").forEach((b) => {
    b.onclick = () => {
      mode = b.dataset.mode;
      paint();
    };
  });

  paint();
}

function renderDrawer(el, sc, layerId) {
  const L = getLayer(layerId);
  const err = sc.err[layerId];
  const label = sc.labels[layerId] || "";
  const state = err ? "err" : sc.hot.includes(layerId) ? "hot" : "cold";
  el.innerHTML = `
    <div class="draw-kicker" style="--lc:${L.color}">
      <span class="layer-badge">${esc(L.process)} · ${state}</span>
      <span class="muted">${esc(sc.name)}</span>
    </div>
    <h2 style="color:${L.color}">${esc(L.name)}</h2>
    <p class="draw-label">${esc(label)}</p>
    ${err ? `<p class="invent">${esc(err)}</p>` : ""}
    <p><strong>WHO</strong> — ${esc(L.who)}</p>
    ${L.processes ? `<ul class="proc-list">${L.processes.map((p) => `<li><strong>${esc(p.name)}</strong>: <code>${esc(p.process)}</code>${p.product === "aaos" ? " (AAOS only)" : ""}</li>`).join("")}</ul>` : ""}
    <div class="tabs">
      <button type="button" class="tab active" data-lvl="b">Beginner</button>
      <button type="button" class="tab" data-lvl="e">Engineer</button>
      <button type="button" class="tab" data-lvl="x">Architect</button>
    </div>
    <p data-pane="b">${esc(L.beginner)}</p>
    <p data-pane="e" hidden>${esc(L.engineer)}</p>
    <p data-pane="x" hidden>${esc(L.architect)}</p>
    <p><strong>KEY FILES</strong></p>
    <ul>${
      L.files.length
        ? L.files.map((f) => `<li><a href="${f.url}" target="_blank" rel="noopener">${esc(f.name)}</a></li>`).join("")
        : "<li>Vendor / board specific</li>"
    }</ul>
    ${L.files.length ? `<p class="muted small">Pinned to AOSP <code>${AOSP_TAG}</code>.</p>` : ""}
    ${L.vendor ? `<div class="invent">Do not invent PAL module IDs, ACDB topology names, or PCM device numbers. Ask your BSP owner.</div>` : ""}
    <p><strong>FAILURE MODES</strong></p>
    <ul class="fail-list">${L.fails.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
    <p><strong>COMMAND</strong></p>
    <pre class="term">${esc(L.cmd)}</pre>
    <button type="button" class="btn" data-copy-cmd>Copy</button>
    ${zoomLink(layerId)}
    <p class="muted">Essay: <a href="#/learn/02">Module 02</a> · walkthrough <a href="#/learn/02a">02a</a> · threads <a href="#/learn/06">06</a></p>
  `;
  el.querySelectorAll("[data-lvl]").forEach((btn) => {
    btn.onclick = () => {
      el.querySelectorAll("[data-lvl]").forEach((x) => x.classList.toggle("active", x === btn));
      el.querySelectorAll("[data-pane]").forEach((p) => {
        p.hidden = p.dataset.pane !== btn.dataset.lvl;
      });
    };
  });
  el.querySelector("[data-copy-cmd]").onclick = () => copy(L.cmd);
}

function zoomLink(layerId) {
  if (layerId === "flinger") {
    return `<p class="learn-related"><a class="btn" href="#/architecture/life/period">Zoom internals → period loop</a></p>`;
  }
  if (layerId === "policy") {
    return `<p class="learn-related"><a class="btn" href="#/architecture/life/policy">Zoom internals → Policy room</a></p>`;
  }
  if (layerId === "app") {
    return `<p class="learn-related"><a class="btn-ghost" href="#/architecture/life/create">Zoom createTrack vs play() →</a></p>`;
  }
  return "";
}
