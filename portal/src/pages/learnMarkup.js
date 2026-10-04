/**
 * Pure markup for a module page, shared by pages/learn.js and
 * scripts/prerender.mjs so the static HTML and the hydrated page match.
 * No DOM access here.
 */
import { TRACKS } from "../content/catalog.js";
import { slugHeading } from "../lib/slug.js";

export const REPO = "https://github.com/developer-swetabh/AndroidAudioProf";

const escHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function textOf(html) {
  return String(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Give every h2/h3 a stable id and a "#" anchor; return the TOC buttons too.
 * `secHref(id)` builds the anchor href (hash route or plain fragment).
 */
export function anchorHeadings(html, secHref) {
  const taken = new Set([...String(html).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const seen = new Set();
  const toc = [];
  const out = String(html).replace(/<(h[23])([^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrs, inner) => {
    if (/class="anchor"/.test(inner) || /\sdata-noanchor/.test(attrs)) return all; // already processed / widget heading
    const label = textOf(inner).trim();
    let id = (/\sid="([^"]+)"/.exec(attrs) || [])[1];
    if (!id || seen.has(id)) {
      const base = `sec-${slugHeading(label)}`;
      id = base;
      for (let n = 2; seen.has(id) || taken.has(id); n++) id = `${base}-${n}`;
      attrs = attrs.replace(/\sid="[^"]*"/, "") + ` id="${id}"`;
    }
    seen.add(id);
    if (tag === "h2") toc.push(`<button type="button" data-jump="${id}">${escHtml(label)}</button>`);
    return `<${tag}${attrs}>${inner}<a class="anchor" href="${secHref(id)}" aria-label="Link to section: ${escHtml(label)}">#</a></${tag}>`;
  });
  return { html: out, tocHtml: toc.join("") };
}

export function treeHtml({ active, open, done, href }) {
  return `
    <a class="mod-item catalog-link" href="${href("")}">All tracks</a>
    ${TRACKS.map(
      (t) => `
      <div class="track">
        <button type="button" data-tr="${t.id}">${open.has(t.id) ? "▾" : "▸"} ${t.title}</button>
        <div class="track-mods" style="display:${open.has(t.id) ? "block" : "none"}">
          ${t.modules
            .map(
              (m) =>
                `<a class="mod-item ${m.id === active ? "active" : ""} ${done.has(m.id) ? "done" : ""}" href="${href(m.id)}"${m.id === active ? ' aria-current="page"' : ""}>${m.id} · ${m.title}</a>`,
            )
            .join("")}
        </div>
      </div>`,
    ).join("")}`;
}

export function learnPageHtml({ mod, prev, next, isDone, lesson, updatedIso, href, tree, tocHtml = "", articleHtml, flowHtml = "", flowCap = "" }) {
  const hasFlow = Boolean(lesson.diagramId);
  return `
    <div class="learn-layout">
      <details class="mod-drawer" id="modDrawer">
        <summary>Modules · ${escHtml(mod.trackTitle)}</summary>
        <aside class="mod-tree" id="modTree" aria-label="Course modules">${tree}</aside>
      </details>
      <script>if (matchMedia("(min-width: 981px)").matches) document.getElementById("modDrawer").open = true;</script>
      <section class="learn-view">
        <div class="module-header">
          <span class="badge">Module ${mod.id}</span>
          <span class="layer-badge">${mod.mins} min · ${mod.trackTitle}</span>
          <h1>${mod.title}</h1>
          <p class="module-meta">
            <span>Applies to: Android 15 (AOSP)</span>
            ${updatedIso ? `<span>· Last updated <time datetime="${updatedIso}">${fmtDate(updatedIso)}</time></span>` : ""}
            <span>· <a href="${REPO}/blob/main/modules/${mod.file}" rel="noopener">Source</a></span>
            <span>· <a href="${REPO}/issues/new?title=${encodeURIComponent(`Erratum: Module ${mod.id}`)}" rel="noopener">Report an error</a></span>
          </p>
        </div>
        ${
          hasFlow
            ? `<div class="flow-stage">
                <div class="flow-kicker">${lesson.kicker}</div>
                <div id="lessonFlow" data-flow="${lesson.diagramId}">${flowHtml}</div>
                <p class="flow-cap" data-flow-cap>${escHtml(flowCap)}</p>
              </div>`
            : ""
        }
        <p class="learn-related">${(lesson.related || [])
          .map((r) => `<a class="btn-ghost" href="${r.href}">${r.label}</a>`)
          .join("")}</p>
        <nav class="learn-toc" id="learnToc" aria-label="In this module">${tocHtml}</nav>
        <article class="md-body" id="md">${articleHtml}</article>
        <div class="module-nav">
          ${prev ? `<a class="btn-ghost" href="${href(prev.id)}">← ${prev.title}</a>` : "<span></span>"}
          <button class="btn" id="markDone" type="button">${isDone ? "Completed ✓" : "Mark complete"}</button>
          ${next ? `<a class="btn-ghost" href="${href(next.id)}">${next.title} →</a>` : "<span></span>"}
        </div>
      </section>
    </div>`;
}
