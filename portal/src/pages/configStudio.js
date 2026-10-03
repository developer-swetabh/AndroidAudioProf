import { $, copy, esc } from "../lib/dom.js";
import { setMain } from "../shell.js";
import { BUS_STEPS, XML_FAMILIES, XML_FILES, getXmlFile } from "../content/xmlFiles.js";
import { colorXml } from "../lib/dumpMarkup.js";
import { MODULES } from "../content/catalog.js";
import { mountBusSelect } from "../diagrams/busSelect.js";

export function pageConfigStudio(arg = "") {
  const parts = String(arg || "")
    .split("/")
    .filter(Boolean);
  const file = parts[0] ? XML_FILES.find((x) => x.id === parts[0]) : null;
  const f = file || getXmlFile("car-audio-configuration");
  const want = `#/architecture/xml/${f.id}`;
  if (location.hash !== want) history.replaceState(null, "", want);

  setMain(`
    <div class="wrap xml-page">
      <div class="wb-head">
        <div>
          <div class="badge">Config studio</div>
          <h1>XML that actually routes</h1>
          <p class="lede">Files are boot contracts. <strong>dumpsys is the running machine.</strong> Car XML maps context → bus address and installs mixes; it is not re-parsed on <code>play()</code>. Fade XML is not a bus mute. mixer_paths is not Policy.</p>
        </div>
        <p class="learn-related">
          <a class="btn-ghost" href="#/architecture">Pipeline scenarios</a>
          <a class="btn-ghost" href="#/architecture/navduck">Two-bus</a>
          <a class="btn-ghost" href="#/learn/13">Module 13</a>
          <a class="btn-ghost" href="#/workbench/rca/03">RCA · shared bus</a>
        </p>
      </div>
      <section class="card xml-bus" style="padding:16px;margin-bottom:16px">
        <h2>How a BUS is selected</h2>
        <p class="muted">App does not Binder to AudioPolicy for createTrack. Focus is not routing.</p>
        <div id="xmlBus"></div>
      </section>
      <div class="xml-layout">
        <aside class="xml-rail">
          ${XML_FAMILIES.map(
            (fam) => `<div class="xml-fam">
              <h3>${esc(fam.name)} <span>${esc(fam.process)}</span></h3>
              ${XML_FILES.filter((x) => x.family === fam.id)
                .map(
                  (x) =>
                    `<a class="dlab-sc ${x.id === f.id ? "active" : ""}" href="#/architecture/xml/${x.id}">
                      <strong>${esc(x.file)}</strong>
                      <span>${esc(x.path)}</span>
                    </a>`,
                )
                .join("")}
            </div>`,
          ).join("")}
        </aside>
        <section class="xml-main">
          ${fileHtml(f)}
        </section>
      </div>
    </div>`);

  const bus = mountBusSelect($("#xmlBus"));
  bus.update();
  $("#xmlCopy")?.addEventListener("click", () => copy(`${f.file}\n${f.dump}\n\n${f.excerpt}`));
}

function fileHtml(f) {
  const mods = (f.modules || [])
    .map((id) => MODULES.find((m) => m.id === id))
    .filter(Boolean);
  return `
    <div class="badge">${f.product === "aaos" ? "AAOS" : "AOSP / both"} · ${esc(f.process)}</div>
    <h2>${esc(f.file)}</h2>
    <p class="muted"><strong>On disk:</strong> ${esc(f.path)} · <strong>Version:</strong> ${esc(f.version)}</p>
    <p><strong>Who parses it:</strong> ${esc(f.parser)}</p>
    <p class="muted">Tree example: <code>${esc(f.example)}</code></p>
    ${f.qcom ? `<p class="invent">Qualcomm-like / vendor. Do not invent PAL module IDs, ACDB names, path names, or PCM device numbers.</p>` : ""}
    <div class="xml-split">
      <article class="card" style="padding:12px">
        <h3>What it is for</h3>
        <ul>${f.uses.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
      </article>
      <article class="card" style="padding:12px">
        <h3>What it is not</h3>
        <ul>${f.not.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
      </article>
    </div>
    <p class="xml-join"><strong>Join key:</strong> ${esc(f.join)}</p>
    ${(f.flags || []).length ? `<p class="muted"><strong>Flags:</strong> ${f.flags.map((x) => `<code>${esc(x)}</code>`).join(" · ")}</p>` : ""}
    <div class="dlab-tools">
      <button class="btn" type="button" id="xmlCopy">Copy excerpt</button>
    </div>
    <div class="dlab-term card">
      <p class="dlab-cmd"><code>${esc(f.dump)}</code>${f.dumpAlso ? ` · ${esc(f.dumpAlso)}` : ""}</p>
      <div class="dump-term">${colorXml(f.excerpt)}</div>
    </div>
    <p class="learn-related">
      ${mods.map((m) => `<a class="btn-ghost" href="#/learn/${m.id}">Module ${m.id} · ${esc(m.title)}</a>`).join("")}
      ${(f.labs || []).map((l) => `<a class="btn-ghost" href="${l.href}">${esc(l.label)}</a>`).join("")}
    </p>`;
}


