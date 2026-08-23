import { $, $$, copy, esc } from "../lib/dom.js";
import { setMain } from "../shell.js";
import { PLAYBOOKS, getPlaybook, getNode } from "../content/playbooks.js";
import { SERVICES, getDump } from "../content/debugDumps.js";
import { CAPTURE_KIT, ANALYZE, RCA_HINT } from "../content/debugLab.js";
import { colorDump } from "../lib/dumpMarkup.js";
import { getScenario, getLayer } from "../content/architecture.js";
import { mountPipeline } from "../diagrams/pipeline.js";

export function pageDebug(arg = "") {
  const parts = (arg || "").split("/").filter(Boolean);
  const pb = parts[0] ? getPlaybook(parts[0]) : null;
  if (!pb || pb.id !== parts[0]) {
    renderIndex();
    return;
  }
  renderPlaybook(pb);
}

function renderIndex() {
  setMain(`
    <div class="wrap dbg-index">
      <div class="dbg-index-head">
        <div>
          <div class="badge">Phase 5 · Diagnostic engine</div>
          <h1>Debug</h1>
          <p class="lede">Classify first. For overlap and distortion: <strong>capture Flinger (twice), Policy, Perfetto, QXDM last</strong> — then analyze. Dumps here are teaching reconstructions, not a second textbook.</p>
        </div>
      </div>
      <section class="dbg-classify card">
        <h2>Classify before you name a method</h2>
        <p class="muted">HIDL products must not be debugged as if <code>Command.burst</code> were the I/O primitive. Phone products do not have CarAudioContext.</p>
        <div class="dbg-class-row">
          <label>Product
            <select id="dbgProduct">
              <option value="aaos">AAOS</option>
              <option value="phone">Phone AOSP</option>
            </select>
          </label>
          <label>HAL
            <select id="dbgHal">
              <option value="aidl">AIDL IModule</option>
              <option value="hidl">HIDL (deviation)</option>
            </select>
          </label>
        </div>
        <p class="invent" id="dbgClassNote" hidden></p>
      </section>
      <section class="dbg-lab">
        <details class="practice-fold" open>
          <summary>How to take dumps (do this before you guess)</summary>
          <div class="dbg-lab-grid">
            ${CAPTURE_KIT.map(
              (c) => `<article class="card">
                <h3>${esc(c.title)}</h3>
                <p>${esc(c.body)}</p>
                <pre class="dump-line">${esc(c.cmd)}</pre>
              </article>`,
            ).join("")}
          </div>
        </details>
        <details class="practice-fold">
          <summary>How to analyze and write RCA</summary>
          <div class="dbg-lab-grid">
            ${ANALYZE.map((c) => `<article class="card"><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></article>`).join("")}
            <article class="card"><h3>Five-line RCA</h3><pre class="dump-line">${esc(RCA_HINT)}</pre></article>
          </div>
        </details>
      </section>
      <div class="dbg-grid">
        ${PLAYBOOKS.map(
          (p) => `
          <a class="card path-card dbg-pb" href="#/debug/${p.id}" data-product="${p.product}">
            <div class="path-ico">${p.product === "aaos" ? "AAOS" : "AOSP"}</div>
            <h3>${p.name}</h3>
            <p>${p.blurb}</p>
          </a>`,
        ).join("")}
      </div>
    </div>`);
  const note = $("#dbgClassNote");
  const paintClass = () => {
    const product = $("#dbgProduct").value;
    const hidl = $("#dbgHal").value === "hidl";
    note.hidden = !hidl && product === "aaos";
    if (hidl) {
      note.hidden = false;
      note.innerHTML = `HIDL: use Module 23 names. <code>IStreamOut.write()</code> is history on this course. <a href="#/learn/23">Classification guide</a>`;
    } else if (product === "phone") {
      note.hidden = false;
      note.textContent = "Phone: hide AAOS-only trees or treat CarAudio dumps as N/A.";
    }
    $$(".dbg-pb").forEach((a) => {
      const aaosOnly = a.dataset.product === "aaos";
      a.classList.toggle("is-dim", product === "phone" && aaosOnly);
    });
  };
  $("#dbgProduct").onchange = paintClass;
  $("#dbgHal").onchange = paintClass;
  paintClass();
}

function renderPlaybook(pb) {
  setMain(`
    <div class="dbg-page">
      <aside class="dbg-rail">
        <a class="btn-ghost" href="#/debug">← All playbooks</a>
        <h2>${esc(pb.name)}</h2>
        <p class="muted">${esc(pb.blurb)}</p>
        <ol class="arch-seq" data-expected>
          ${pb.expected.map((s, i) => `<li><span>${i + 1}</span>${esc(s)}</li>`).join("")}
        </ol>
        <div class="dbg-crumbs" data-crumbs></div>
      </aside>
      <section class="dbg-stage">
        <div id="dbgPipe"></div>
        <div class="dbg-q card" data-q></div>
        <div class="dbg-actions" data-actions></div>
      </section>
      <aside class="dbg-evidence">
        <div class="sd-tabs" data-svcs></div>
        <pre class="dump-line dbg-dump" data-dump></pre>
        <p class="muted" data-look></p>
        <div class="dbg-rca card">
          <h3>Five-line RCA</h3>
          <textarea id="dbgRca" rows="7" spellcheck="false"></textarea>
          <button class="btn" type="button" id="dbgCopy">Copy RCA</button>
        </div>
      </aside>
    </div>`);

  const pipe = mountPipeline($("#dbgPipe"));
  let nodeId = pb.start;
  const trail = [];

  const sc = () => getScenario(pb.scenario);
  const paintPipe = (lkg) => {
    pipe.update(sc(), { layer: lkg || "flinger", mode: "both" });
  };

  const paint = () => {
    const n = getNode(nodeId);
    if (!n) return;
    const crumbs = [...trail, nodeId];
    $("[data-crumbs]").innerHTML = crumbs
      .map((id) => {
        const x = getNode(id);
        const label = x.type === "verdict" ? x.title : shortQ(x.q);
        return `<button type="button" data-jump="${id}">${esc(label)}</button>`;
      })
      .join("<span>→</span>");
    $("[data-crumbs]").querySelectorAll("[data-jump]").forEach((b) => {
      b.onclick = () => {
        nodeId = b.dataset.jump;
        const i = trail.indexOf(nodeId);
        if (i >= 0) trail.length = i;
        else if (nodeId === pb.start) trail.length = 0;
        paint();
      };
    });

    if (n.type === "collect") {
      paintPipe(n.lkg);
      $("[data-q]").innerHTML = `
        <div class="badge">Collect first</div>
        <h2>${esc(n.q)}</h2>
        <p>${esc(n.why)}</p>
        <p class="muted">${esc(n.look)}</p>`;
      $("[data-actions]").innerHTML = `
        <button class="btn" type="button" data-next>Captured — start analysis →</button>
        <button class="btn-ghost" type="button" data-back>Back</button>`;
      showDumps(n.dumps, n.look);
      $("#dbgRca").value = `Symptom: ${pb.blurb}
Immediate failure:
Root cause:
Contributing factor:
Fix:`;
    } else if (n.type === "verdict") {
      paintPipe(null);
      $("[data-q]").innerHTML = `
        <div class="badge">${esc(n.domain)}</div>
        <h2>Verdict · ${esc(n.title)}</h2>
        <p><strong>Owner:</strong> ${esc(n.owner)}</p>
        <p class="invent">${esc(n.rca.root)}</p>
        <p class="learn-related">${(n.learn || [])
          .map((href) => `<a class="btn-ghost" href="${href}">${esc(href.replace("#/", ""))}</a>`)
          .join("")}
          <a class="btn-ghost" href="#/architecture/${n.scenario || pb.scenario}">Architecture</a>
        </p>`;
      $("[data-actions]").innerHTML = `
        <button class="btn-ghost" type="button" data-back>Back</button>
        <button class="btn" type="button" data-reset>Restart tree</button>`;
      const rca = `Symptom: ${n.rca.symptom}
Immediate failure: ${n.rca.immediate}
Root cause: ${n.rca.root}
Contributing factor: ${n.rca.contribute}
Fix: ${n.rca.fix}`;
      $("#dbgRca").value = rca;
      showDumps(n.dumps || dumpsFor(getNode(trail[trail.length - 1])), n.look);
    } else {
      paintPipe(n.lkg);
      const L = getLayer(n.lkg);
      $("[data-q]").innerHTML = `
        <div class="badge">Kill test · ${esc(L.name)}</div>
        <h2>${esc(n.q)}</h2>
        <p>${esc(n.why)}</p>
        <p class="muted">Last-known-good if Yes: <strong>${esc(L.name)}</strong> — investigate from here down.</p>`;
      $("[data-actions]").innerHTML = `
        <button class="btn" type="button" data-ans="yes">Yes →</button>
        <button class="btn-ghost" type="button" data-ans="no">No →</button>
        <button class="btn-ghost" type="button" data-back>Back</button>`;
      showDumps(n.dumps || (n.dump ? [n.dump] : []), n.look);
      $("#dbgRca").value = `Symptom: ${pb.blurb}
Immediate failure:
Root cause:
Contributing factor:
Fix:`;
    }

    $("[data-actions]").querySelectorAll("[data-ans]").forEach((b) => {
      b.onclick = () => {
        const n0 = getNode(nodeId);
        trail.push(nodeId);
        nodeId = n0[b.dataset.ans];
        paint();
      };
    });
    $("[data-actions]").querySelector("[data-next]")?.addEventListener("click", () => {
      const n0 = getNode(nodeId);
      trail.push(nodeId);
      nodeId = n0.next;
      paint();
    });
    $("[data-actions]").querySelector("[data-back]")?.addEventListener("click", () => {
      nodeId = trail.pop() || pb.start;
      paint();
    });
    $("[data-actions]").querySelector("[data-reset]")?.addEventListener("click", () => {
      trail.length = 0;
      nodeId = pb.start;
      paint();
    });
  };

  $("#dbgCopy").onclick = () => copy($("#dbgRca").value);

  paint();
}

function dumpsFor(n) {
  if (!n) return [];
  if (n.dumps?.length) return n.dumps;
  return n.dump ? [n.dump] : [];
}

function showDumps(ids, look) {
  const list = (ids || []).map(getDump).filter(Boolean);
  const tabs = $("[data-svcs]");
  $("[data-look]").textContent = look || "";
  if (!list.length) {
    tabs.innerHTML = "";
    $("[data-dump]").textContent = "No dump on this step. Answer from the path you already drew.";
    return;
  }
  let cur = 0;
  const paintDump = () => {
    tabs.innerHTML = list
      .map((d, i) => {
        const svc = SERVICES.find((s) => s.id === d.service);
        return `<button type="button" class="sd-st ${i === cur ? "active" : ""}" data-di="${i}">${esc(svc ? svc.name : d.service)}</button>`;
      })
      .join("");
    const d = list[cur];
    const svc = SERVICES.find((s) => s.id === d.service);
    $("[data-dump]").innerHTML = `${esc(d.note)}\n${esc(svc ? svc.cmd : "")}\n\n${colorDump(d.text)}`;
    tabs.querySelectorAll("[data-di]").forEach((b) => {
      b.onclick = () => {
        cur = +b.dataset.di;
        paintDump();
      };
    });
  };
  paintDump();
}

function shortQ(q) {
  return String(q || "").replace(/\?$/, "").slice(0, 28);
}
