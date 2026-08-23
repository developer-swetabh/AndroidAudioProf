import { $, $$, copy } from "../lib/dom.js";
import { load, save } from "../lib/storage.js";
import { setMain } from "../shell.js";
import { TRACKS, MODULES, getNeighbors } from "../content/catalog.js";
import { getLesson } from "../content/lessons.js";
import { enhanceModuleHtml, hydrateMermaid, parseMarkdown, slugHeading } from "../lib/markdown.js";
import { mountLessonDiagram } from "../diagrams/learnBind.js";

let learnGen = 0;

export async function pageLearn(id) {
  const gen = ++learnGen;
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
      <aside class="mod-tree" id="modTree"></aside>
      <section class="learn-view">
        <div class="module-header">
          <span class="badge">Module ${mod.id}</span>
          <span class="layer-badge">${mod.mins} min · ${mod.trackTitle}</span>
          <h1>${mod.title}</h1>
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
          ${prev ? `<a class="btn-ghost" href="#/learn/${prev.id}">← ${prev.title}</a>` : "<span></span>"}
          <button class="btn" id="markDone" type="button">${done.has(id) ? "Completed ✓" : "Mark complete"}</button>
          ${next ? `<a class="btn-ghost" href="#/learn/${next.id}">${next.title} →</a>` : "<span></span>"}
        </div>
      </section>
    </div>`);
  renderTree(id);
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
    $("#md").innerHTML = enhanceModuleHtml(parseMarkdown(text));
    wireHeadings($("#md"), $("#learnToc"));
    $$(".copy-code").forEach((b) => {
      b.onclick = () => copy(b.parentElement.querySelector("code")?.innerText || "");
    });
    try {
      await hydrateMermaid($("#md"));
    } catch {
      /* mermaid CDN optional; ASCII/code fence remains */
    }
    if (gen !== learnGen) return;
  } catch {
    if (gen !== learnGen) return;
    $("#md").innerHTML = `<p class="invent">Could not load <code>${mod.file}</code>. Run <code>npm run dev</code> from <code>portal/</code>.</p>`;
  }
}

function wireHeadings(article, toc) {
  const hs = $$("h2", article);
  if (!hs.length || !toc) return;
  hs.forEach((h) => {
    h.id = h.id || `sec-${slugHeading(h.textContent)}`;
  });
  toc.innerHTML = hs
    .map((h) => `<button type="button" data-jump="${h.id}">${h.textContent}</button>`)
    .join("");
  toc.querySelectorAll("[data-jump]").forEach((b) => {
    b.onclick = () => document.getElementById(b.dataset.jump)?.scrollIntoView({ block: "start", behavior: "smooth" });
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
          <p class="lede">Markdown is still the textbook. Every module opens with a live flow bound to Architecture or Fundamentals — no second invented call path.</p>
        </div>
        <div class="learn-progress card">
          <div class="n">${done.size}<span>/${MODULES.length}</span></div>
          <p>modules marked complete</p>
          ${next ? `<a class="btn" href="#/learn/${next.id}">Continue · ${next.id} ${next.title}</a>` : `<p>Curriculum complete.</p>`}
          ${last && last !== next?.id ? `<p class="muted">Last opened: <a href="#/learn/${last}">Module ${last}</a></p>` : ""}
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
                    <a href="#/learn/${m.id}"><span class="mod-id">${m.id}</span> ${m.title}</a>
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
    <a class="mod-item catalog-link" href="#/learn">All tracks</a>
    ${TRACKS.map(
      (t) => `
      <div class="track">
        <button type="button" data-tr="${t.id}">${open.has(t.id) ? "▾" : "▸"} ${t.title}</button>
        <div class="track-mods" style="display:${open.has(t.id) ? "block" : "none"}">
          ${t.modules
            .map(
              (m) =>
                `<a class="mod-item ${m.id === active ? "active" : ""} ${done.has(m.id) ? "done" : ""}" href="#/learn/${m.id}">${m.id} · ${m.title}</a>`,
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
