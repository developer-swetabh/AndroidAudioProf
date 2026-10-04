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

/** Visual breadcrumbs: items [{label, href?}], the last one is the current page. */
export function crumbsHtml(items, { section = false } = {}) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map((it, i) =>
      i === items.length - 1
        ? `<li><span aria-current="page">${escHtml(it.label)}</span></li>`
        : `<li><a href="${it.href}">${escHtml(it.label)}</a></li>`,
    )
    .join("")}${section ? `<li class="crumb-sec" data-crumb-sec aria-hidden="true"></li>` : ""}</ol></nav>`;
}

/** "Also: related flow" under prev/next for modules that a trace explains. flows = generated index.json flows. */
export function alsoFlowsHtml(flows, modId, clean) {
  const rel = (flows || []).filter((f) => f.modules.includes(modId));
  if (!rel.length) return "";
  const url = (f) => {
    const slug = f.id === "play-media" ? "play" : f.id;
    return clean ? `/trace/${slug}/` : `#/trace/${slug}`;
  };
  return `<p class="mod-also">Also: ${rel.map((f) => `<a href="${url(f)}">Trace the Audio Path: ${escHtml(f.title)}</a>`).join(" · ")}</p>`;
}

/** Index link for a track: a fragment on the clean index page, the plain index on hash routes. */
export const trackHref = (href, trackId) => (href("").startsWith("/") ? `${href("")}#track-${trackId}` : href(""));

function navLink(side, m, inTrack, cur, href) {
  if (!m) return "<span></span>";
  const k = side === "prev" ? (inTrack ? `Previous in ${cur.trackTitle}` : `Previous track: ${m.trackTitle}`) : inTrack ? `Next in ${cur.trackTitle}` : `Next track: ${m.trackTitle}`;
  const t = side === "prev" ? `← ${m.id} · ${m.title}` : `${m.id} · ${m.title} →`;
  return `<a class="btn-ghost mod-nav-${side}" rel="${side}" href="${href(m.id)}"><span class="mod-nav-k">${escHtml(k)}</span><span class="mod-nav-t">${escHtml(t)}</span></a>`;
}

export function learnPageHtml({ mod, prev, next, prevInTrack = true, nextInTrack = true, alsoHtml = "", isDone, lesson, updatedIso, href, tree, tocHtml = "", articleHtml, flowHtml = "", flowCap = "" }) {
  const hasFlow = Boolean(lesson.diagramId);
  return `
    <div class="learn-layout">
      <details class="mod-drawer" id="modDrawer">
        <summary>Modules · ${escHtml(mod.trackTitle)}</summary>
        <aside class="mod-tree" id="modTree" aria-label="Course modules">${tree}</aside>
      </details>
      <script>if (matchMedia("(min-width: 981px)").matches) document.getElementById("modDrawer").open = true;</script>
      <section class="learn-view">
        ${crumbsHtml(
          [
            { label: "Learn", href: href("") },
            { label: mod.trackTitle, href: trackHref(href, mod.trackId) },
            { label: `${mod.id} ${mod.title}` },
          ],
          { section: true },
        )}
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
        <nav class="module-nav" aria-label="Module navigation">
          ${navLink("prev", prev, prevInTrack, mod, href)}
          <button class="btn" id="markDone" type="button">${isDone ? "Completed ✓" : "Mark complete"}</button>
          ${navLink("next", next, nextInTrack, mod, href)}
        </nav>
        ${alsoHtml}
      </section>
    </div>`;
}
