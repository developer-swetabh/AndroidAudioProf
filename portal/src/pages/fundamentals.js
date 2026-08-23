import { $ } from "../lib/dom.js";
import { setMain } from "../shell.js";
import { FORMATS } from "../lib/audioMath.js";
import { getPcm, patchPcm } from "../lib/pcmState.js";
import { bindPcmControls, controlsHtml, metricsHtml, paintMetrics, syncControls } from "../ui/pcmControls.js";
import { mountWaveform } from "../diagrams/waveform.js";
import { mountFrameGrid } from "../diagrams/frameGrid.js";
import { mountRingBuffer } from "../diagrams/ringBuffer.js";
import { mountPipes } from "../diagrams/pipes.js";
import { mountTdm } from "../diagrams/tdmSlots.js";

let dispose = [];

export function pageFundamentals(arg) {
  dispose.forEach((fn) => fn());
  dispose = [];

  setMain(`
    <div class="fund-page">
      <header class="fund-hero">
        <div class="badge">Phase 2 · Digital audio physics</div>
        <h1>Sound as numbers</h1>
        <p class="lede">Hz is frames per second of the stream clock. A frame is every channel at one instant. Period is the wake quantum. Buffer is the jitter tank. Offload is not a PCM mixer path.</p>
        <p class="fund-links">
          <a href="#/learn/00b">Long form · Module 00b</a>
          <a href="#/workbench">Same math · Workbench calculator</a>
          <a href="#/glossary/frame">Glossary</a>
        </p>
      </header>

      <div class="fund-rail">
        ${controlsHtml(getPcm())}
        ${metricsHtml()}
        <pre class="dump-line" data-dump></pre>
      </div>

      <nav class="fund-jump" aria-label="Boards">
        <button type="button" data-jump="board-rate">Rate</button>
        <button type="button" data-jump="board-frame">Sample vs frame</button>
        <button type="button" data-jump="board-bits">Bit depth</button>
        <button type="button" data-jump="board-period">Period</button>
        <button type="button" data-jump="board-pipes">Flinger threads</button>
        <button type="button" data-jump="board-tdm">TDM slots</button>
      </nav>

      <div class="fund-boards">
        <section class="board card" id="board-rate">
          <h2>1 · Sample rate</h2>
          <p class="board-lead">Dots are frames packed into <strong>one millisecond</strong>. Changing kHz changes how many snapshots exist in the same wall-clock slice — not “sound quality” by itself.</p>
          <div id="d-wave"></div>
          <p class="insight" data-insight-rate></p>
        </section>

        <section class="board card" id="board-frame">
          <h2>2 · Sample vs frame</h2>
          <p class="board-lead">Rows are channels. The glowing column is <em>one frame</em>. Stereo is not “two streams”; it is two samples glued into one snapshot.</p>
          <div id="d-grid"></div>
        </section>

        <section class="board card" id="board-bits">
          <h2>3 · Frame size &amp; bit depth</h2>
          <p class="board-lead"><code>S24_LE</code> is not <code>S24_3LE</code>. Same useful bits, different bytes on the wire. A profile that lies here opens with <code>EINVAL</code>.</p>
          <div class="table-wrap">
            <table class="skill-grid" data-fmt-table></table>
          </div>
          <p class="insight" data-insight-bits></p>
        </section>

        <section class="board card" id="board-period">
          <h2>4 · Period &amp; period count</h2>
          <p class="board-lead">One wedge is a period (IRQ / wake). The whole ring is the buffer. Animation is slowed so you can see it — the hub still shows real milliseconds.</p>
          <div class="formula">
            <code>period_ms = period_frames / rate × 1000</code>
            <code>buffer_ms = period_ms × period_count</code>
          </div>
          <div id="d-ring"></div>
        </section>

        <section class="board card" id="board-pipes">
          <h2>5 · What AudioFlinger actually does with your bytes</h2>
          <p class="board-lead">Click a thread. <strong>Direct and Offload do not bypass AudioFlinger</strong> — they skip the mixing desk. An MP3 is usually decoded to PCM and then mixed; offload is a special HAL+Policy path, not “because the file is compressed.”</p>
          <div id="d-pipes"></div>
        </section>

        <section class="board card" id="board-tdm">
          <h2>6 · Channels vs TDM slots</h2>
          <p class="board-lead">A <strong>channel</strong> is one person in a group photo (same instant). A <strong>TDM slot</strong> is one apartment in a revolving door (one after another on a pin). 6 channels is 5.1 surround, not “six TDM slots.” Click a demo. Then try <em>FSYNC shift</em>.</p>
          <div id="d-tdm"></div>
        </section>
      </div>
    </div>`);

  const root = $("#app-main");
  const wave = mountWaveform($("#d-wave"));
  const grid = mountFrameGrid($("#d-grid"));
  const ring = mountRingBuffer($("#d-ring"));
  const pipes = mountPipes($("#d-pipes"));
  const tdm = mountTdm($("#d-tdm"));

  const apply = (patch) => {
    const m = patchPcm(patch);
    paintMetrics(root, m);
    syncControls(root, m);
    root.querySelector("[data-dump]").textContent = dumpLike(m);
    paintFormatTable(root.querySelector("[data-fmt-table]"), m);
    root.querySelector("[data-insight-rate]").textContent =
      `Same 240 frames last ${(240000 / 8000).toFixed(0)} ms at 8 kHz and ${(240000 / 48000).toFixed(2)} ms at 48 kHz. Always convert frames to milliseconds before comparing.`;
    root.querySelector("[data-insight-bits]").textContent = m.fmt.note;
    for (const d of [wave, grid, ring, pipes, tdm]) {
      try {
        d.update(m);
      } catch (err) {
        console.error(err);
      }
    }
  };

  pipes.onPath((path) => apply({ path }));
  tdm.onPatch((patch) => apply(patch));
  dispose.push(() => grid.destroy?.());

  bindPcmControls(root, (patch) => apply(patch));
  root.querySelectorAll("[data-jump]").forEach((b) => {
    b.onclick = () =>
      document.getElementById(b.dataset.jump)?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  apply({});

  const jump = arg && document.getElementById(`board-${arg}`);
  if (jump) jump.scrollIntoView({ block: "start", behavior: "smooth" });
}

export function leaveFundamentals() {
  dispose.forEach((fn) => fn());
  dispose = [];
}

function dumpLike(m) {
  return `${m.fmt.android} ${m.rate} Hz ch=${m.channels} period=${m.periodFrames} count=${m.periodCount} · frame=${m.frameSize}B period=${m.periodMs.toFixed(2)}ms buffer=${m.bufferMs.toFixed(2)}ms irq=${m.irqHz.toFixed(0)}/s`;
}

function paintFormatTable(table, m) {
  table.innerHTML = `<thead><tr><th>Format</th><th>Bytes/sample</th><th>Useful bits</th><th>Frame (${m.channels}ch)</th><th>Bytes/period</th><th>Android</th></tr></thead><tbody>${Object.values(FORMATS)
    .map((f) => {
      const fs = m.channels * f.bytes;
      const on = f.id === m.format ? " class=\"on\"" : "";
      return `<tr${on}><td>${f.label}</td><td>${f.bytes}</td><td>${f.usefulBits}${f.packed ? "" : " in 32"}</td><td>${fs} B</td><td>${m.periodFrames * fs} B</td><td><code>${f.android}</code></td></tr>`;
    })
    .join("")}</tbody>`;
}
