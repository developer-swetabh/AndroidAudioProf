import { $, $$, esc } from "../lib/dom.js";
import { load, save } from "../lib/storage.js";
import { setMain } from "../shell.js";
import {
  ARCHITECT_HABITS,
  ENGINEER_HABITS,
  GATES,
  MATRIX_DEPTHS,
  MATRIX_LAYERS,
  cellKey,
  firstOpenGate,
  getGate,
  nextModule,
  strongestGate,
  weakestDepth,
} from "../content/gates.js";
import { MODULES } from "../content/catalog.js";

export function pageProgression(arg = "") {
  const sel = /^[A-H]$/i.test(arg) ? arg.toUpperCase() : "";
  const st = loadProg();
  const learned = load().done || [];
  const strongest = strongestGate(st.gates);
  const open = firstOpenGate(st.gates);
  const next = nextModule(st.gates, learned);
  const weak = weakestDepth(st.matrix);
  const gate = sel ? getGate(sel) : open || strongest || GATES[0];
  const passed = GATES.filter((g) => st.gates[g.id]).length;

  setMain(`
    <div class="wrap prog-page">
      <div class="wb-head">
        <div>
          <div class="badge">Progression</div>
          <h1>Engineering ladder</h1>
          <p class="lede">Gates are demonstrations, not rereads. You can be high on AAOS XML and junior on ASoC — rank <strong>per track</strong>, not one ego number. Markdown in Module 24 stays canonical.</p>
        </div>
      </div>
      <section class="prog-sum card ${st.burst === gate.id ? "is-burst" : ""}">
        <div>
          <div class="path-ico">${strongest ? strongest.id : "—"}</div>
          <h2>${strongest ? `Strongest pass · Gate ${strongest.id} ${esc(strongest.title)}` : "No gate marked yet"}</h2>
          <p class="muted">${passed} / ${GATES.length} gates · Learn complete: ${learned.length} / ${MODULES.length}</p>
        </div>
        <ul>
          <li><strong>First open gate:</strong> ${open ? `Gate ${open.id} · ${esc(open.title)}` : "All eight marked. Revisit the self-exam."}</li>
          <li><strong>Weakest matrix column:</strong> ${esc(weak.depth.name)} (${weak.count} / ${weak.total} layers)</li>
          <li><strong>Next recommended module:</strong> ${
            next ? `<a href="#/learn/${next.id}">Module ${next.id} · ${esc(next.title)}</a>` : "—"
          }</li>
        </ul>
      </section>
      <div class="prog-layout">
        <aside class="prog-rail">
          <ol class="prog-ladder">
            ${GATES.map((g) => {
              const on = !!st.gates[g.id];
              return `<li>
                <a class="prog-rung ${g.id === gate.id ? "active" : ""} ${on ? "is-done" : ""}" href="#/progression/${g.id}">
                  <span class="prog-letter">${g.id}</span>
                  <span>
                    <strong>${esc(g.title)}</strong>
                    <em>${esc(g.rung)}</em>
                  </span>
                </a>
              </li>`;
            }).join("")}
          </ol>
        </aside>
        <section class="prog-gate card">
          <div class="badge">Gate ${gate.id} · ${esc(gate.title)}</div>
          <h2>${esc(gate.rung)}</h2>
          <p>${esc(gate.skill)}</p>
          <p><strong>Test:</strong> ${esc(gate.test)}</p>
          ${gate.qcom ? `<p class="invent">Do not invent PAL module IDs, ACDB topology names, or PCM device numbers. Ask your BSP owner.</p>` : ""}
          <p class="learn-related">
            ${gate.modules
              .map((id) => {
                const m = MODULES.find((x) => x.id === id);
                return m ? `<a class="btn-ghost" href="#/learn/${m.id}">Module ${m.id} · ${esc(m.title)}</a>` : "";
              })
              .join("")}
            ${gate.labs.map((l) => `<a class="btn-ghost" href="${l.href}">${esc(l.label)}</a>`).join("")}
          </p>
          <label class="prog-mark">
            <input type="checkbox" id="gateDone" ${st.gates[gate.id] ? "checked" : ""}/>
            Mark as demonstrated
          </label>
          <p class="muted">Not a reread. If you cannot run the test, leave it open.</p>
        </section>
      </div>
      <section class="card prog-matrix-wrap">
        <h2>Skill inventory</h2>
        <p class="muted">Rows are the same pipeline names as Architecture — not OSI numbers. Click a cell when you can demonstrate it.</p>
        <div class="table-wrap">
          <table class="skill-grid prog-matrix">
            <thead>
              <tr><th>Layer</th>${MATRIX_DEPTHS.map((d) => `<th>${esc(d.name)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${MATRIX_LAYERS.map(
                (l) => `<tr>
                  <th scope="row">${esc(l.name)}</th>
                  ${MATRIX_DEPTHS.map((d) => {
                    const k = cellKey(l.id, d.id);
                    const on = !!st.matrix[k];
                    return `<td><button type="button" class="prog-cell ${on ? "on" : ""}" data-cell="${k}" aria-pressed="${on}">${on ? "yes" : "—"}</button></td>`;
                  }).join("")}
                </tr>`,
              ).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="prog-bottom">
        <article class="card">
          <h2>Place yourself</h2>
          <p class="muted">Module 24’s last exam. Revisit every month.</p>
          ${examHtml(st.exam)}
        </article>
        <article class="card">
          <h2>Habits</h2>
          <h3>Independent engineer</h3>
          <ol>${ENGINEER_HABITS.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
          <h3>Architect (additional)</h3>
          <ol>${ARCHITECT_HABITS.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
        </article>
      </section>
      <p class="learn-related">
        <a class="btn-ghost" href="#/learn/24">Module 24 · textbook</a>
        <a class="btn-ghost" href="#/workbench/rca">RCA lab</a>
        <a class="btn-ghost" href="#/debug">Debug engine</a>
      </p>
    </div>`);

  $("#gateDone").onchange = () => {
    const on = $("#gateDone").checked;
    saveProg({ gates: { [gate.id]: on }, burst: on ? gate.id : "" });
    pageProgression(gate.id);
  };
  $$("[data-cell]").forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.cell;
      saveProg({ matrix: { [k]: !st.matrix[k] } });
      pageProgression(gate.id);
    };
  });
  $$("[data-exam]").forEach((inp) => {
    inp.oninput = () => {
      const exam = { ...loadProg().exam };
      exam[inp.dataset.exam] = inp.value;
      saveProg({ exam });
    };
  });
}

function examHtml(exam) {
  const fields = [
    ["date", "Date"],
    ["android", "Android I work on"],
    ["hal", "HAL generation I actually have"],
    ["aaos", "AAOS? (xml version)"],
    ["vendor", "Vendor DSP?"],
    ["strongest", "Strongest gate I pass"],
    ["fail", "First gate I fail"],
    ["dump", "One dump I will take tomorrow"],
    ["source", "One source file I will read tomorrow"],
  ];
  return fields
    .map(
      ([id, label]) => `<label class="rca-q">${esc(label)}
        <input data-exam="${id}" value="${esc(exam[id] || "")}"/></label>`,
    )
    .join("");
}

function loadProg() {
  const p = load().progression || {};
  return {
    gates: p.gates || {},
    matrix: p.matrix || {},
    exam: p.exam || {},
    burst: p.burst || "",
  };
}

function saveProg(patch) {
  const cur = loadProg();
  save({
    progression: {
      gates: { ...cur.gates, ...(patch.gates || {}) },
      matrix: { ...cur.matrix, ...(patch.matrix || {}) },
      exam: patch.exam || cur.exam,
      burst: patch.burst !== undefined ? patch.burst : cur.burst,
    },
  });
}
