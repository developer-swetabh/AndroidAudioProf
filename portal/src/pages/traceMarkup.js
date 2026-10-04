/**
 * Pure markup for the "Trace the Audio Path" player (flow), shared by
 * scripts/prerender.mjs (static, crawlable, works without JS) and the
 * runtime (src/elements/aa-flow.js hydrates it; hash-route pages render it).
 * No DOM access here. Flow data comes from src/content/generated/flows/*.json.
 */
import { getModule } from "../content/catalog.js";
export const REPO = "https://github.com/developer-swetabh/AndroidAudioProf";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const LANE_LABEL = {
  app: "app",
  system_server: "system_server",
  "com.android.car": "CarService",
  audioserver: "audioserver",
  vendor_hal: "vendor HAL",
  kernel: "kernel",
  hardware: "hardware",
};
const PROC_LABEL = { ...LANE_LABEL, vendor_hal: "vendor audio HAL process", hardware: "hardware", "com.android.car": "com.android.car" };
export const PATH_LABEL = { data: "Data path", control: "Control path", both: "Data + control", config: "Config" };
const PATH_CHIP = { data: "PCM", control: "CTRL", both: "PCM + CTRL", config: "CONFIG" };

export const procText = (step) => step.process.map((p) => PROC_LABEL[p] || p).join(" → ");

export function reportHref(flow, step) {
  const title = `Trace ${flow.id} step ${step.n}: ${step.title}`;
  const body = `flow=${flow.id}\nstep=${step.n}\ntag=${flow.tag}\n\nWhat is wrong, and the source line that shows it:\n`;
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/** Module link "02a#sec-x" → URL. `modHref(id)` gives the module URL for the current URL style. */
function moduleUrl(ref, modHref) {
  const [id, anchor] = String(ref).split("#");
  const base = modHref(id);
  if (!anchor) return base;
  return base.startsWith("#/") ? `${base}/${anchor}` : `${base}#${anchor}`;
}

/** Lane diagram: one row per process, one column per step. Decorative (aria-hidden): the step list is the text alternative. */
export function laneSvg(flow, steps) {
  const lanes = flow.lanes;
  const colW = 58, rowH = 40, padL = 112, padT = 18;
  const W = padL + steps.length * colW + 10;
  const H = padT + lanes.length * rowH + 6;
  const x = (i) => padL + i * colW + colW / 2;
  const y = (lane) => padT + lanes.indexOf(lane) * rowH + rowH / 2;
  const used = new Set(flow.steps.map((s) => s.lane));
  const rows = lanes
    .map((l, i) => `<g class="fl-lane${used.has(l) ? "" : " fl-lane-dim"}"><rect x="0" y="${padT + i * rowH}" width="${W}" height="${rowH}"/><text x="8" y="${padT + i * rowH + rowH / 2 + 4}">${esc(LANE_LABEL[l] || l)}</text></g>`)
    .join("");
  const edges = steps
    .slice(1)
    .map((s, i) => {
      const a = steps[i];
      const x1 = x(i), y1 = y(a.lane), x2 = x(i + 1), y2 = y(s.lane);
      const mx = (x1 + x2) / 2;
      return `<path class="fl-edge fl-${s.path === "control" ? "ctrl" : "data"}" data-edge="${s.n}" pathLength="100" d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}"/>`;
    })
    .join("");
  const nodes = steps
    .map((s, i) => `<g class="fl-node fl-p-${s.path}" data-node="${s.n}" transform="translate(${x(i)} ${y(s.lane)})"><circle r="13"/><text y="4">${s.n}</text></g>`)
    .join("");
  const legend = `<g class="fl-legend" transform="translate(${padL} 10)"><path class="fl-edge fl-data" d="M0 0 H22"/><text x="28" y="4">PCM (data)</text><path class="fl-edge fl-ctrl" d="M112 0 H134"/><text x="140" y="4">CTRL (control)</text></g>`;
  return `<svg class="fl-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">${rows}${legend}${edges}${nodes}</svg>`;
}

function sourcesHtml(step) {
  return step.sources
    .map(
      (s) =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener" data-src-link data-repo="${esc(s.repo)}" data-path="${esc(s.path)}"><code>${esc(s.file)}${s.line ? `:${s.line}` : ""}</code> ${esc(s.label)}</a> <span class="fs-pin">${esc(s.pinned)}</span>${s.search ? ` · <a class="fs-search" href="${esc(s.search)}" target="_blank" rel="noopener">search latest</a>` : ""}</li>`,
    )
    .join("");
}

function predictHtml(flow, uid) {
  const p = flow.predict;
  return `<div class="fs-predict" data-predict>
      <p class="fs-predict-q"><strong>Predict first.</strong> ${p.prompt}</p>
      <div class="fs-predict-choices" role="group" aria-label="Your prediction">${p.choices
        .map((c) => `<button type="button" class="btn-ghost" data-predict-choice="${esc(c.id)}"${c.correct ? " data-correct" : ""}>${c.text}</button>`)
        .join("")}</div>
      <details class="fs-predict-reveal" id="${uid}-predict"><summary>Show the answer</summary><p>${p.reveal}</p></details>
    </div>`;
}

function stepHtml(flow, step, { total, uid, hTag, modHref, active, page }) {
  const id = page ? `step-${step.n}` : `${uid}-step-${step.n}`;
  const predict = flow.predict && flow.predict.before_step === step.n ? predictHtml(flow, uid) : "";
  return `<li class="flow-step${active ? " is-active" : ""}" id="${id}" data-step="${step.n}" data-path="${step.path}" data-lane="${step.lane}">
      <p class="fs-kicker"><span>Step ${step.n} of ${total}</span> <span class="fs-chip fs-chip-${step.path}" title="${PATH_LABEL[step.path]}">${PATH_CHIP[step.path]}</span> <span class="fs-pathtext">${PATH_LABEL[step.path]}</span></p>
      <${hTag} class="fs-title"${hTag === "h3" ? " data-noanchor" : ""}>${step.titleHtml}</${hTag}>
      ${predict}
      <div class="fs-body">
        <dl class="fs-proc"><div><dt>Process</dt><dd>${esc(procText(step))}</dd></div><div><dt>Thread</dt><dd>${step.thread}</dd></div></dl>
        <p class="fs-sum">${step.summary}</p>
        <p class="fs-detail">${step.detail}</p>
        ${step.deep ? `<p class="fs-deep"><span class="fs-tag">Deep dive</span> ${step.deep}</p>` : ""}
        <details class="fs-more"><summary>What you'd see</summary><ul>${step.see.map((x) => `<li>${x}</li>`).join("")}</ul></details>
        <details class="fs-more"><summary>What can fail here</summary><ul>${step.fails.map((x) => `<li>${x}</li>`).join("")}</ul></details>
        <details class="fs-more fs-deeper" data-deeper="${step.n}"><summary>Go deeper: classes and pinned source</summary>
          ${step.classes.length ? `<p class="fs-classes">${step.classes.map((c) => `<code>${esc(c)}</code>`).join(" ")}</p>` : ""}
          ${step.note ? `<p class="fs-note">${step.note}</p>` : ""}
          <ul class="fs-sources">${sourcesHtml(step)}</ul>
          <div class="fs-code" data-code-slot></div>
        </details>
        <p class="fs-links">${step.module ? `<a href="${esc(moduleUrl(step.module, modHref))}">Read the full explanation</a> · ` : ""}<a href="${esc(reportHref(flow, step))}" rel="noopener" target="_blank">Report an error on this step</a></p>
      </div>
    </li>`;
}

/**
 * variant: "page" (the /trace/play/ page: step ids step-N, URL hash sync),
 *          "embed" (inside a module: title + "Open the full trace", subset of steps).
 */
export function flowHtml(flow, { variant = "page", from = 1, to = flow.steps.length, modHref = (id) => `/learn/${id}/`, traceHref = "/trace/play/", start } = {}) {
  const page = variant === "page";
  const steps = flow.steps.slice(from - 1, to);
  const total = flow.steps.length;
  const uid = page ? "trace" : `flow-${flow.id}-${from}-${to}`;
  const first = start && start >= from && start <= to ? start : from;
  const hTag = page ? "h2" : "h4";
  const lanesUsed = flow.lanes.filter((l) => steps.some((s) => s.lane === l));
  const strip = lanesUsed.map((l) => `<li data-lane="${l}">${esc(LANE_LABEL[l])}</li>`).join("");
  const range = from === 1 && to === total ? "" : ` (steps ${from}–${to} of ${total})`;
  const head = page
    ? ""
    : `<div class="flow-embed-head">
        <p class="flow-embed-kicker">Trace the Audio Path${esc(range)}</p>
        <h3 class="flow-embed-title" data-noanchor>${esc(flow.title)}</h3>
        <a class="btn-ghost flow-open" href="${traceHref}${from > 1 ? `#step-${from}` : ""}">Open the full trace →</a>
      </div>`;
  return `<div class="aa-flow aa-flow-${variant}" data-island="flow" data-flow="${esc(flow.id)}" data-from="${from}" data-to="${to}" data-variant="${variant}" data-active="${first}" data-active-lane="${steps[first - from].lane}">
    ${head}
    <div class="flow-player" role="group" aria-roledescription="step player" aria-label="${esc(flow.title)}${esc(range)}">
      <div class="flow-map">
        <ol class="flow-strip" aria-hidden="true">${strip}</ol>
        <button type="button" class="btn-ghost flow-diagram-btn" aria-expanded="false" data-diagram-toggle>Show diagram</button>
        <div class="flow-diagram">${laneSvg(flow, steps)}</div>
      </div>
      <ol class="flow-steps" start="${from}">${steps.map((s) => stepHtml(flow, s, { total, uid, hTag, modHref, active: s.n === first, page })).join("")}</ol>
      <div class="flow-controls">
        <button type="button" class="btn-ghost flow-prev" data-prev aria-label="Previous step"${first === from ? " disabled" : ""}>← Prev</button>
        <div class="flow-dots" role="group" aria-label="Steps">${steps
          .map((s) => `<button type="button" class="flow-dot" data-go="${s.n}" aria-label="Step ${s.n}: ${esc(s.title)}"${s.n === first ? ' aria-current="step"' : ""}>${s.n}</button>`)
          .join("")}</div>
        <button type="button" class="btn flow-next" data-next aria-label="Next step"${first === to ? " disabled" : ""}>Next →</button>
        <span class="flow-extra">
          <button type="button" class="btn-ghost flow-play" data-play aria-pressed="false">▶ Play</button>
          <button type="button" class="btn-ghost flow-copy" data-copy-step aria-label="Copy a link to this step">Copy link</button>
        </span>
      </div>
      <p class="sr-only" aria-live="polite" data-live></p>
    </div>
  </div>`;
}

/** Full /trace/play/ page body (inside <main>). */
export function tracePlayPageHtml(flow, { modHref, breadcrumbs = "" } = {}) {
  return `<div class="wrap trace-page">
    ${breadcrumbs}
    <header class="trace-head">
      <p class="badge">Trace the Audio Path · Android 15 (AOSP ${esc(flow.tag)})</p>
      <h1>${esc(flow.title)}</h1>
      <p class="lede">${esc(flow.summary)}</p>
      <details class="trace-assume"><summary>Assumptions for this trace</summary><ul>${flow.assumptions.map((a) => `<li>${a}</li>`).join("")}</ul></details>
      <p class="trace-keys muted">Keyboard: focus the player, then ← → to move, Home / End for the first / last step.</p>
    </header>
    ${flowHtml(flow, { variant: "page", modHref })}
    <section class="trace-more">
      <h2>Where this is explained</h2>
      <ul>${flow.modules.map((m) => `<li><a href="${modHref(m)}">Module ${esc(m)}${getModule(m) ? `: ${esc(getModule(m).title)}` : ""}</a></li>`).join("")}</ul>
    </section>
  </div>`;
}

/** /trace/ index body. */
export function traceIndexHtml(flows, { breadcrumbs = "" } = {}) {
  return `<div class="wrap trace-page trace-index">
    ${breadcrumbs}
    <h1>Trace the Audio Path</h1>
    <p class="lede">Step-by-step traces through the real Android 15 audio stack. Each step names the process and thread, says whether it carries PCM or only control, and links the exact AOSP source at a pinned tag.</p>
    <ul class="trace-cards">${flows
      .map((f) => `<li class="card trace-card"><h2><a href="/trace/${f.id === "play-media" ? "play" : f.id}/">${esc(f.title)}</a></h2><p>${esc(f.question)}</p><p class="muted">${f.steps} steps · modules ${f.modules.map(esc).join(", ")}</p></li>`)
      .join("")}</ul>
  </div>`;
}

/** Static placeholder used when the module page renders at runtime (hash route) before the island loads. */
export function flowPlaceholder({ src, from, to, variant = "embed" }) {
  return `<div class="aa-flow aa-flow-${variant} aa-flow-ph" data-island="flow" data-flow="${esc(src)}" data-from="${from || ""}" data-to="${to || ""}" data-variant="${variant}" data-render="1"><p class="muted">Loading the interactive trace…</p></div>`;
}
