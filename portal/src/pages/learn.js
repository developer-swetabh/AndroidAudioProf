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
import { REPO, anchorHeadings, learnPageHtml, treeHtml, alsoFlowsHtml } from "./learnMarkup.js";
import FLOW_INDEX from "../content/generated/index.json";

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
  const { prev, next, prevInTrack, nextInTrack } = getNeighbors(id);
  const done = new Set(load().done || []);
  const lesson = getLesson(id);
  const hasFlow = Boolean(lesson.diagramId);
  const open = new Set(load().openTracks || TRACKS.map((t) => t.id));

  if (!pre) setMain(
    learnPageHtml({
      mod,
      prev,
      next,
      prevInTrack,
      nextInTrack,
      alsoHtml: alsoFlowsHtml(FLOW_INDEX.flows, id, false),
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
  spyToc(article, toc);
}

let spy = null;
/**
 * Scroll-tracked TOC: the h2 that most recently crossed below the sticky header
 * is marked aria-current="location" in #learnToc and named in the breadcrumb.
 * IntersectionObserver only triggers the (cheap) recompute; nothing moves layout.
 */
function spyToc(article, toc) {
  spy?.disconnect();
  const heads = [...article.querySelectorAll("h2[id]")];
  const btns = new Map([...(toc?.querySelectorAll("[data-jump]") || [])].map((b) => [b.dataset.jump, b]));
  const crumb = document.querySelector("[data-crumb-sec]");
  if (!heads.length || !("IntersectionObserver" in window)) return;
  let current = null;
  const line = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64) + 56;
  const update = () => {
    if (!article.isConnected) return spy?.disconnect();
    const y = line();
    let active = null;
    for (const h of heads) {
      if (h.getBoundingClientRect().top - y <= 1) active = h;
      else break;
    }
    // At the end of the page the last short sections can never reach the line: use the last one in view.
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
      for (const h of heads) if (h.getBoundingClientRect().top < innerHeight * 0.85) active = h;
    }
    if (active === current) return;
    current = active;
    btns.forEach((b, id) => (active && id === active.id ? b.setAttribute("aria-current", "location") : b.removeAttribute("aria-current")));
    if (crumb) crumb.textContent = active ? active.textContent.replace(/#\s*$/, "").trim() : "";
  };
  let raf = 0;
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(() => ((raf = 0), update()));
  };
  spy = new IntersectionObserver(schedule, { rootMargin: `-${line()}px 0px 0px 0px`, threshold: [0, 1] });
  heads.forEach((h) => spy.observe(h));
  // Fast scrolls or jumps can skip an intersection change; a passive scroll hook keeps it exact.
  addEventListener("scroll", schedule, { passive: true });
  spy.cleanup = () => removeEventListener("scroll", schedule);
  const disconnect = spy.disconnect.bind(spy);
  spy.disconnect = () => (spy.cleanup(), disconnect());
  update();
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
          <section class="card track-card" id="track-${t.id}">
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
  // Track links from breadcrumbs (/learn/#track-t1): the runtime index differs from the static one, so re-apply the fragment.
  const t = /^#track-[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
  if (t) t.scrollIntoView({ block: "start" });
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
