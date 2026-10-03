import { $, $$, esc, modHref, onCleanPath } from "../lib/dom.js";
import { load, save } from "../lib/storage.js";
import { setMain } from "../shell.js";
import { TRACKS, MODULES, getNeighbors } from "../content/catalog.js";
import { getLesson } from "../content/lessons.js";
import {
  enhanceModuleHtml,
  highlightCode,
  hydrateMermaid,
  parseMarkdown,
  slugHeading,
  wireCopyButtons,
  wrapTables,
} from "../lib/markdown.js";
import UPDATED from "../content/updated.json";
import { mountLessonDiagram } from "../diagrams/learnBind.js";

let learnGen = 0;

const REPO = "https://github.com/developer-swetabh/AndroidAudioProf";

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function pageLearn(arg) {
  const gen = ++learnGen;
  const [id, section] = String(arg || "").split("/");
  if (!id) {
    renderIndex();
    return;
  }
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) {
    renderIndex(`No module “${id}”. Pick one from the catalog.`);
    return;
  }
  save({ lastModule: id });
  const { prev, next } = getNeighbors(id);
  const done = new Set(load().done || []);
  const lesson = getLesson(id);
  const hasFlow = Boolean(lesson.diagramId);

  setMain(`
    <div class="learn-layout">
      <details class="mod-drawer" id="modDrawer">
        <summary>Modules · ${esc(mod.trackTitle)}</summary>
        <aside class="mod-tree" id="modTree" aria-label="Course modules"></aside>
      </details>
      <section class="learn-view">
        <div class="module-header">
          <span class="badge">Module ${mod.id}</span>
          <span class="layer-badge">${mod.mins} min · ${mod.trackTitle}</span>
          <h1>${mod.title}</h1>
          <p class="module-meta">
            <span>Applies to: Android 15 (AOSP)</span>
            ${UPDATED[mod.file] ? `<span>· Last updated <time datetime="${UPDATED[mod.file]}">${fmtDate(UPDATED[mod.file])}</time></span>` : ""}
            <span>· <a href="${REPO}/blob/main/modules/${mod.file}" rel="noopener">Source</a></span>
            <span>· <a href="${REPO}/issues/new?title=${encodeURIComponent(`Erratum: Module ${mod.id}`)}" rel="noopener">Report an error</a></span>
          </p>
        </div>
        ${
          hasFlow
            ? `<div class="flow-stage">
                <div class="flow-kicker">${lesson.kicker}</div>
                <div id="lessonFlow"></div>
                <p class="flow-cap" data-flow-cap></p>
              </div>`
            : ""
        }
        <p class="learn-related">${(lesson.related || [])
          .map((r) => `<a class="btn-ghost" href="${r.href}">${r.label}</a>`)
          .join("")}</p>
        <nav class="learn-toc" id="learnToc" aria-label="In this module"></nav>
        <article class="md-body" id="md">Loading curriculum…</article>
        <div class="module-nav">
          ${prev ? `<a class="btn-ghost" href="${modHref(prev.id)}">← ${prev.title}</a>` : "<span></span>"}
          <button class="btn" id="markDone" type="button">${done.has(id) ? "Completed ✓" : "Mark complete"}</button>
          ${next ? `<a class="btn-ghost" href="${modHref(next.id)}">${next.title} →</a>` : "<span></span>"}
        </div>
      </section>
    </div>`);
  renderTree(id);
  const drawer = $("#modDrawer");
  if (drawer && window.matchMedia("(min-width: 981px)").matches) drawer.open = true;
  $("#markDone").onclick = () => {
    const d = new Set(load().done || []);
    d.has(id) ? d.delete(id) : d.add(id);
    save({ done: [...d] });
    pageLearn(id);
  };

  if (hasFlow) {
    const diagram = mountLessonDiagram($("#lessonFlow"), lesson.diagramId, lesson);
    diagram?.onCaption?.((c) => {
      const el = $("[data-flow-cap]");
      if (el) el.textContent = [c.who, c.fail].filter(Boolean).join(" — ");
    });
    diagram?.update?.();
  }

  try {
    const res = await fetch(`/curriculum/${mod.file}`);
    const text = await res.text();
    if (gen !== learnGen) return;
    if (!res.ok) throw new Error(res.statusText);
    const md = $("#md");
    md.innerHTML = enhanceModuleHtml(parseMarkdown(text));
    wireHeadings(md, $("#learnToc"), mod.id);
    wrapTables(md);
    wireCopyButtons(md);
    if (section) jumpTo(section);
    else if (!location.hash.startsWith("#/") && location.hash.length > 1) jumpTo(decodeURIComponent(location.hash.slice(1)));
    highlightCode(md).catch(() => {});
    try {
      await hydrateMermaid(md);
    } catch {
      /* diagram source stays visible as a code block */
    }
    if (gen !== learnGen) return;
  } catch {
    if (gen !== learnGen) return;
    $("#md").innerHTML = `<p class="invent">Couldn't load this lesson. <a href="${modHref(mod.id)}" data-retry>Retry</a> or <a href="${REPO}/blob/main/modules/${mod.file}" rel="noopener">read it on GitHub</a>.</p>`;
    const r = $("[data-retry]");
    if (r && !onCleanPath()) r.onclick = (e) => { e.preventDefault(); pageLearn(arg); };
  }
}

function jumpTo(secId) {
  const el = document.getElementById(secId);
  if (!el) return;
  if (el.tagName === "DETAILS") el.open = true;
  el.closest("details")?.setAttribute("open", "");
  requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
}

function sectionHref(modId, secId) {
  return onCleanPath() ? `#${secId}` : `#/learn/${modId}/${secId}`;
}

function wireHeadings(article, toc, modId) {
  const hs = $$("h2, h3", article);
  if (!hs.length || !toc) return;
  const seen = new Set();
  hs.forEach((h) => {
    if (!h.id || seen.has(h.id)) {
      let base = `sec-${slugHeading(h.textContent)}`;
      let idv = base;
      for (let n = 2; seen.has(idv) || (document.getElementById(idv) && document.getElementById(idv) !== h); n++) idv = `${base}-${n}`;
      h.id = idv;
    }
    seen.add(h.id);
    const label = h.textContent.trim();
    const a = document.createElement("a");
    a.className = "anchor";
    a.href = sectionHref(modId, h.id);
    a.setAttribute("aria-label", `Link to section: ${label}`);
    a.textContent = "#";
    a.onclick = (e) => {
      e.preventDefault();
      history.replaceState(history.state, "", a.getAttribute("href"));
      h.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    h.appendChild(a);
  });
  const h2s = hs.filter((h) => h.tagName === "H2");
  toc.innerHTML = h2s
    .map((h) => `<button type="button" data-jump="${h.id}">${esc(h.firstChild?.textContent || h.textContent)}</button>`)
    .join("");
  toc.querySelectorAll("[data-jump]").forEach((b) => {
    b.onclick = () => {
      const el = document.getElementById(b.dataset.jump);
      if (!el) return;
      history.replaceState(history.state, "", sectionHref(modId, el.id));
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    };
  });
}

function renderIndex(notice = "") {
  const done = new Set(load().done || []);
  const last = load().lastModule;
  const next = MODULES.find((m) => !done.has(m.id));
  setMain(`
    <div class="wrap learn-index">
      <div class="learn-index-head">
        <div>
          <div class="badge">Curriculum</div>
          <h1>Learn</h1>
          <p class="lede">Each module is a written lesson. Most open with an interactive flow linked to the Architecture or Fundamentals studios.</p>
        </div>
        <div class="learn-progress card">
          <div class="n">${done.size}<span>/${MODULES.length}</span></div>
          <p>modules marked complete</p>
          ${next ? `<a class="btn" href="${modHref(next.id)}">Continue · ${next.id} ${next.title}</a>` : `<p>Curriculum complete.</p>`}
          ${last && last !== next?.id ? `<p class="muted">Last opened: <a href="${modHref(last)}">Module ${last}</a></p>` : ""}
        </div>
      </div>
      ${notice ? `<p class="invent">${notice}</p>` : ""}
      <div class="track-grid">
        ${TRACKS.map(
          (t) => `
          <section class="card track-card">
            <h2>${t.title}</h2>
            <ol>
              ${t.modules
                .map(
                  (m) => `<li class="${done.has(m.id) ? "done" : ""}">
                    <a href="${modHref(m.id)}"><span class="mod-id">${m.id}</span> ${m.title}</a>
                    <span class="mins">${m.mins} min${getLesson(m.id).diagramId ? " · flow" : ""}</span>
                  </li>`,
                )
                .join("")}
            </ol>
          </section>`,
        ).join("")}
      </div>
    </div>`);
}

function renderTree(active) {
  const open = new Set(load().openTracks || TRACKS.map((t) => t.id));
  const done = new Set(load().done || []);
  const tree = $("#modTree");
  if (!tree) return;
  tree.innerHTML = `
    <a class="mod-item catalog-link" href="${modHref("")}">All tracks</a>
    ${TRACKS.map(
      (t) => `
      <div class="track">
        <button type="button" data-tr="${t.id}">${open.has(t.id) ? "▾" : "▸"} ${t.title}</button>
        <div class="track-mods" style="display:${open.has(t.id) ? "block" : "none"}">
          ${t.modules
            .map(
              (m) =>
                `<a class="mod-item ${m.id === active ? "active" : ""} ${done.has(m.id) ? "done" : ""}" href="${modHref(m.id)}"${m.id === active ? ' aria-current="page"' : ""}>${m.id} · ${m.title}</a>`,
            )
            .join("")}
        </div>
      </div>`,
    ).join("")}`;
  tree.querySelectorAll("[data-tr]").forEach((b) => {
    b.onclick = () => {
      const cur = new Set(load().openTracks || TRACKS.map((t) => t.id));
      cur.has(b.dataset.tr) ? cur.delete(b.dataset.tr) : cur.add(b.dataset.tr);
      save({ openTracks: [...cur] });
      renderTree(active);
    };
  });
}
