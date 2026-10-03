import { $ } from "../lib/dom.js";
import { setMain } from "../shell.js";
import { getPcm, patchPcm } from "../lib/pcmState.js";
import { dumpLine, fmtMs } from "../lib/audioMath.js";
import { bindPcmControls, controlsHtml, metricsHtml, paintMetrics, syncControls } from "../ui/pcmControls.js";
import { mountRingBuffer } from "../diagrams/ringBuffer.js";
import { bindDumpLab, canonicalizeDump, dumpLabHtml } from "./workbenchDump.js";
import { bindRcaLab, rcaCaseHtml, rcaIndexHtml } from "./workbenchRca.js";
import { getRcaCase } from "../content/rcaCases.js";

export function pageWorkbench(arg = "") {
  const parts = String(arg || "")
    .split("/")
    .filter(Boolean);
  const tab = parts[0] === "dump" || parts[0] === "rca" ? parts[0] : "calc";

  if (tab === "dump") {
    const resolved = canonicalizeDump(parts[1] || "", parts[2] || "");
    setMain(chrome(tab, dumpLabHtml(resolved.serviceId, resolved.scenario.id)));
    bindDumpLab();
    return;
  }

  if (tab === "rca") {
    const caseId = parts[1] || "";
    const c = caseId ? getRcaCase(caseId) : null;
    if (caseId && !c) history.replaceState(null, "", "#/workbench/rca");
    setMain(chrome(tab, c ? rcaCaseHtml(c.id) : rcaIndexHtml()));
    if (c) bindRcaLab(c.id);
    return;
  }

  setMain(chrome("calc", calcHtml()));
  bindCalc();
}

function chrome(tab, body) {
  return `
    <div class="wrap wb-page">
      <div class="wb-head">
        <div>
          <div class="badge">Workbench</div>
          <h1>Lab bench</h1>
          <p class="lede">${lede(tab)}</p>
        </div>
      </div>
      <div class="wb-tabs">
        <a href="#/workbench" class="${tab === "calc" ? "active" : ""}">Calculator</a>
        <a href="#/workbench/dump" class="${tab === "dump" ? "active" : ""}">Dump lab</a>
        <a href="#/workbench/rca" class="${tab === "rca" ? "active" : ""}">RCA lab</a>
      </div>
      ${body}
    </div>`;
}

function lede(tab) {
  if (tab === "dump") return "Pick a service and a scenario. A missing pair is empty — never a stub Flinger dump.";
  if (tab === "rca") return "Label evidence, write five RCA lines, then reveal the workbook key. Calculator math is still the other tab.";
  return "Calculator uses the same audioMath module as Fundamentals. Dragging a slider does not rebuild this page.";
}

function calcHtml() {
  const m = getPcm();
  return `
    <div class="calc-grid">
      <section class="card" style="padding:16px">
        <h2>Knobs</h2>
        ${controlsHtml(m, { extras: true })}
        <p class="muted">Shared with <a href="#/fundamentals">Fundamentals</a>. Change it here, it stays there.</p>
      </section>
      <section class="card" style="padding:16px">
        <h2>Live contract</h2>
        ${metricsHtml()}
        <pre class="dump-line" id="wb-dump"></pre>
        <div class="wb-eq" id="wb-eq"></div>
      </section>
    </div>
    <section class="card" style="padding:16px;margin-top:16px">
      <h2>Ring = period × count</h2>
      <div id="wb-ring"></div>
    </section>
    <p class="learn-related" style="margin-top:16px">
      <a class="btn-ghost" href="#/workbench/dump">Dump lab →</a>
      <a class="btn-ghost" href="#/workbench/rca">RCA lab →</a>
    </p>`;
}

function bindCalc() {
  const root = $("#app-main");
  const ring = mountRingBuffer($("#wb-ring"));

  const paint = (patch) => {
    const m = patchPcm(patch);
    paintMetrics(root, m);
    syncControls(root, m);
    ring.update(m);
    $("#wb-dump").textContent = dumpLine(m);
    $("#wb-eq").innerHTML = `
      <div><span>period_ms</span> ${m.periodFrames} / ${m.rate} × 1000 = <strong>${fmtMs(m.periodMs)}</strong></div>
      <div><span>buffer_ms</span> ${fmtMs(m.periodMs)} × ${m.periodCount} = <strong>${fmtMs(m.bufferMs)}</strong></div>
      <div><span>frame_size</span> ${m.channels} × ${m.bytesPerSample} = <strong>${m.frameSize} B</strong> · ${m.fmt.id}</div>
      <div><span>bytes/period</span> ${m.periodFrames} × ${m.frameSize} = <strong>${m.periodBytes} B</strong></div>
      <div><span>IRQ</span> ${m.rate} / ${m.periodFrames} = <strong>${m.irqHz.toFixed(2)} /s</strong></div>
    `;
  };

  bindPcmControls(root, (patch) => paint(patch));
  paint({});
}
