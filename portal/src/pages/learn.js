import { $, modHref, onCleanPath } from "../lib/dom.js";
import { load, save } from "../lib/storage.js";
import { track } from "../lib/analytics.js";
import { setMain, consumePrerendered } from "../shell.js";
import { TRACKS, MODULES, getNeighbors } from "../content/catalog.js";
import { getLesson } from "../content/lessons.js";
import {
  enhanceModuleHtml,
  highlightCode,
  hydrateMermaid,
  wireCopyButtons,
  wrapTables,
} from "../lib/markdown.js";
import UPDATED from "../content/updated.json";
import { mountLessonDiagram } from "../diagrams/learnBind.js";
import { scanIslands } from "../lib/islands.js";
import { REPO, anchorHeadings, learnPageHtml, treeHtml } from "./learnMarkup.js";

let learnGen = 0;



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
  // Prerendered /learn/<id>/ page: keep the static DOM (no fetch, no re-render) and only wire it up.
  const pre = consumePrerendered(`learn/${id}`) && Boolean($("#md")?.querySelector("h2"));
  save({ lastModule: id });
  const { prev, next } = getNeighbors(id);
  const done = new Set(load().done || []);
  const lesson = getLesson(id);
  const hasFlow = Boolean(lesson.diagramId);
  const open = new Set(load().openTracks || TRACKS.map((t) => t.id));

  if (!pre) setMain(
    learnPageHtml({
      mod,
      prev,
      next,
      isDone: done.has(id),
      lesson,
      updatedIso: UPDATED[mod.file],
      href: modHref,
      tree: treeHtml({ active: id, open, done, href: modHref }),
      articleHtml: "Loading curriculum…",
    }),
  );
  else if (done.has(id) || load().openTracks) {
    // Static page assumes "not done, all tracks open"; apply saved progress.
    $("#markDone").textContent = done.has(id) ? "Completed ✓" : "Mark complete";
    renderTree(id);
  }
  wireTree(id);
  const drawer = $("#modDrawer");
  if (drawer && window.matchMedia("(min-width: 981px)").matches) drawer.open = true;
  $("#markDone").onclick = () => {
    const d = new Set(load().done || []);
    d.has(id) ? d.delete(id) : d.add(id);
    save({ done: [...d] });
    track("mark_complete", { module: id, done: d.has(id) });
    $("#markDone").textContent = d.has(id) ? "Completed ✓" : "Mark complete";
    renderTree(id);
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
    const md = $("#md");
    if (!pre) {
      const res = await fetch(`/curriculum/${mod.file}`);
      const [text, { parseMarkdown }] = await Promise.all([res.text(), import("../lib/mdParse.js")]);
      if (gen !== learnGen) return;
      if (!res.ok) throw new Error(res.statusText);
      const { html, tocHtml } = anchorHeadings(enhanceModuleHtml(parseMarkdown(text), { moduleId: mod.id }), (s) => sectionHref(id, s));
      md.innerHTML = html;
      $("#learnToc").innerHTML = tocHtml;
    }
    wireHeadings(md, $("#learnToc"), mod.id);
    wrapTables(md);
    wireCopyButtons(md);
    if (section) jumpTo(section);
    else if (!location.hash.startsWith("#/") && location.hash.length > 1) jumpTo(decodeURIComponent(location.hash.slice(1)));
    scanIslands(md);
    highlightCode(md).catch(() => {});
    hydrateMermaid(md).catch(() => {
      /* diagram source stays visible as a code block */
    });
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

/** Ids, anchors and TOC markup come from anchorHeadings(); this only attaches behaviour. */
function wireHeadings(article, toc, modId) {
  article.querySelectorAll("h2 > a.anchor, h3 > a.anchor").forEach((a) => {
    const h = a.parentElement;
    a.setAttribute("href", sectionHref(modId, h.id));
    a.onclick = (e) => {
      e.preventDefault();
      history.replaceState(history.state, "", a.getAttribute("href"));
      h.scrollIntoView({ block: "start", behavior: "smooth" });
    };
  });
  toc?.querySelectorAll("[data-jump]").forEach((b) => {
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
  const tree = $("#modTree");
  if (!tree) return;
  const open = new Set(load().openTracks || TRACKS.map((t) => t.id));
  const done = new Set(load().done || []);
  tree.innerHTML = treeHtml({ active, open, done, href: modHref });
  wireTree(active);
}

function wireTree(active) {
  const tree = $("#modTree");
  if (!tree) return;
  tree.querySelectorAll("[data-tr]").forEach((b) => {
    b.onclick = () => {
      const cur = new Set(load().openTracks || TRACKS.map((t) => t.id));
      cur.has(b.dataset.tr) ? cur.delete(b.dataset.tr) : cur.add(b.dataset.tr);
      save({ openTracks: [...cur] });
      renderTree(active);
    };
  });
}
