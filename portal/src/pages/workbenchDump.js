import { $, copy, esc } from "../lib/dom.js";
import { load, save } from "../lib/storage.js";
import { SERVICES } from "../content/debugDumps.js";
import { DUMP_SCENARIOS, dumpHref, productLabel, resolveDumpLab, servicesOn } from "../content/dumpLab.js";
import { colorDump } from "../lib/dumpMarkup.js";

export function dumpLabHtml(serviceId, scenarioId) {
  const r = resolveDumpLab(serviceId, scenarioId);
  const opts = load().dumpLab || {};
  const have = new Set(servicesOn(r.scenario));
  const dump = r.dumps[0] || null;
  const guns = r.scenario.guns?.[dump ? r.ids[0] : ""] || [];
  const notes = r.scenario.notes?.[dump ? r.ids[0] : ""] || [];

  return `
    <div class="dlab">
      <aside class="dlab-rail">
        <h2>Scenario</h2>
        <p class="muted">Service × scenario is required. Dimmed chips are clickable — they must not show a Flinger dump.</p>
        <div class="dlab-scen">
          ${DUMP_SCENARIOS.map(
            (s) =>
              `<a class="dlab-sc ${s.id === r.scenario.id ? "active" : ""}" href="${dumpHref(r.serviceId, s)}">
                <span class="mf-sub">${productLabel(s.product)}</span>
                <strong>${esc(s.name)}</strong>
                <span>${esc(s.blurb)}</span>
              </a>`,
          ).join("")}
        </div>
      </aside>
      <section class="dlab-main">
        <div class="dlab-head">
          <div>
            <div class="badge">${productLabel(r.scenario.product)} · teaching reconstruction</div>
            <h2>${esc(r.scenario.name)}</h2>
            <p class="lede">${esc(r.scenario.hunt)}</p>
          </div>
          <div class="dlab-links">
            ${r.scenario.workbook ? `<a class="btn-ghost" href="#/workbench/rca/${r.scenario.workbook}">RCA case ${r.scenario.workbook}</a>` : ""}
            ${r.scenario.debug ? `<a class="btn-ghost" href="#/debug/${r.scenario.debug}">Debug playbook</a>` : ""}
            <a class="btn-ghost" href="#/learn/20">Module 20</a>
          </div>
        </div>
        ${r.scenario.qcom ? `<p class="invent">Do not invent PAL module IDs, ACDB topology names, or PCM device numbers. Ask your BSP owner.</p>` : ""}
        <div class="dlab-svcs" role="tablist" aria-label="Service">
          ${SERVICES.map((s) => {
            const on = have.has(s.id);
            const sel = s.id === r.serviceId;
            return `<a class="sd-st${sel ? " active" : ""}${on ? "" : " is-dim"}" href="#/workbench/dump/${s.id}/${r.scenario.id}" role="tab" aria-selected="${sel}" title="${on ? s.cmd : "No reconstruction for this pair"}">${esc(s.name)}${on ? "" : " · none"}</a>`;
          }).join("")}
        </div>
        <p class="muted dlab-count">${have.size} of ${SERVICES.length} services have a reconstruction for <strong>${esc(r.scenario.name)}</strong>.</p>
        <div class="dlab-tools">
          <label><input type="checkbox" id="dlabHints" ${opts.hints ? "checked" : ""}/> Show smoking-gun lines</label>
          <label><input type="checkbox" id="dlabNotes" ${opts.annotate ? "checked" : ""}/> Annotations</label>
          <button class="btn-ghost" type="button" id="dlabReplay">Replay</button>
          <button class="btn" type="button" id="dlabCopy">Copy dump</button>
        </div>
        <div class="dlab-term card" data-term>
          ${
            r.hasDump && dump
              ? `<p class="dlab-cmd"><code>${esc(r.service.cmd)}</code></p>
                 <p class="muted">${esc(dump.note)}</p>
                 <div class="dump-term" data-raw>${colorDump(dump.text, { guns, notes, hints: !!opts.hints, annotate: !!opts.annotate })}</div>`
              : emptyHtml(r)
          }
        </div>
        <p class="dlab-look"><strong>Hunt:</strong> ${esc(r.scenario.look)}</p>
      </section>
    </div>`;
}

function emptyHtml(r) {
  return `<div class="dlab-empty">
    <h3>No dump for ${esc(r.service.name)} × ${esc(r.scenario.name)}</h3>
    <p>The old simulator ignored the service dropdown and showed a stub Flinger dump for every choice. This lab will not.</p>
    <p>Capture on a device with:</p>
    <pre class="dump-line">${esc(r.service.cmd)}</pre>
    <p class="muted">Services with a reconstruction: ${servicesOn(r.scenario)
      .map((id) => SERVICES.find((s) => s.id === id)?.name || id)
      .join(" · ")}</p>
  </div>`;
}

export function bindDumpLab() {
  const r = resolveFromHash();
  const rawDump = r.dumps[0]?.text || "";
  const persist = (patch) => save({ dumpLab: { ...(load().dumpLab || {}), ...patch } });

  $("#dlabHints")?.addEventListener("change", (e) => {
    persist({ hints: e.target.checked });
    paintTerm(r, e.target.checked, $("#dlabNotes")?.checked);
  });
  $("#dlabNotes")?.addEventListener("change", (e) => {
    persist({ annotate: e.target.checked });
    paintTerm(r, $("#dlabHints")?.checked, e.target.checked);
  });
  $("#dlabCopy")?.addEventListener("click", () => {
    if (rawDump) copy(`${r.service.cmd}\n\n${rawDump}`);
  });
  $("#dlabReplay")?.addEventListener("click", () => {
    const pre = $("[data-raw]");
    if (!pre) return;
    pre.classList.remove("is-replay");
    void pre.offsetWidth;
    pre.classList.add("is-replay");
  });
}

function paintTerm(r, hints, annotate) {
  const dump = r.dumps[0];
  const pre = $("[data-raw]");
  if (!dump || !pre) return;
  const guns = r.scenario.guns?.[r.ids[0]] || [];
  const notes = r.scenario.notes?.[r.ids[0]] || [];
  pre.innerHTML = colorDump(dump.text, { guns, notes, hints: !!hints, annotate: !!annotate });
}

function resolveFromHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").slice(2);
  return resolveDumpLab(parts[0] || "", parts[1] || "");
}

/** Keep hash canonical: /workbench/dump/:service/:scenario */
export function canonicalizeDump(serviceId, scenarioId) {
  const r = resolveDumpLab(serviceId, scenarioId);
  const want = `#/workbench/dump/${r.serviceId}/${r.scenario.id}`;
  if (location.hash !== want) history.replaceState(null, "", want);
  return r;
}
