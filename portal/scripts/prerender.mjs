#!/usr/bin/env node
/**
 * Post-build step (runs after `vite build`). Writes crawlable entry points that
 * load the same app bundle as `/`:
 *
 *   dist/learn/index.html          course index      → https://…/learn/
 *   dist/learn/<id>/index.html     one per module    → https://…/learn/06/
 *   dist/sitemap.xml, dist/404.html
 *
 * Each page carries its own <title>, description, canonical, Open Graph/Twitter
 * tags and JSON-LD. The body is the same markup the app renders (shared pure
 * functions in src/shellMarkup.js, src/pages/homeMarkup.js, src/pages/learnMarkup.js),
 * so the first paint needs no JavaScript and nothing shifts when the app boots.
 * The home page (dist/index.html) is prerendered the same way.
 *
 * Finally Beasties inlines the CSS each page's first screen needs and loads the
 * full stylesheet without blocking rendering.
 * Existing hash URLs (/#/learn/06) are untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import Beasties from "beasties";
import { TRACKS, MODULES } from "../src/content/catalog.js";
import { getLesson } from "../src/content/lessons.js";
import { shellHtml } from "../src/shellMarkup.js";
import { homeHtml } from "../src/pages/homeMarkup.js";
import { anchorHeadings, learnPageHtml, treeHtml } from "../src/pages/learnMarkup.js";
import { enhanceModuleHtml } from "../src/lib/markdown.js";

const portal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(portal, "dist");
const SITE = "https://androidaudio.vercel.app";
const SITE_NAME = "Android Audio Engineering";
const REPO = "https://github.com/developer-swetabh/AndroidAudioProf";
const updated = JSON.parse(fs.readFileSync(path.join(portal, "src/content/updated.json"), "utf8"));
const shell = fs.readFileSync(path.join(dist, "index.html"), "utf8");

const escAttr = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

function plain(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function describe(md) {
  const m = /##\s+Short Answer\s*\n+([\s\S]*?)(?:\n\s*\n|$)/.exec(md);
  let text = plain(m ? m[1] : md.split("\n").filter((l) => l && !l.startsWith("#")).slice(0, 3).join(" "));
  if (text.length > 158) text = `${text.slice(0, 155).replace(/\s+\S*$/, "")}…`;
  return text;
}

/** Rewrite GitHub-style .md links to clean URLs (mirrors lib/markdown.js mapCurriculumHref). */
function mapHref(href) {
  if (!href || /^(https?:|mailto:|#)/i.test(href)) return href;
  const name = href.split(/[?#]/)[0].split("/").filter(Boolean).pop() || "";
  const mod = MODULES.find((m) => m.file === name);
  if (mod) return `/learn/${mod.id}/`;
  if (/workbook/i.test(href) || /^ANSWER_KEY\.md$/i.test(name)) return "/#/workbench/rca";
  if (/REFERENCE_PLATFORM\.md$/i.test(name)) return "/learn/00/";
  if (/LEARNING_PATH\.md$/i.test(name)) return "/learn/";
  if (/(^|\/)labs(\/|$)/i.test(href)) return "/#/debug";
  if (/\.md$/i.test(name)) return "/";
  return href;
}

function renderMd(md) {
  const html = marked.parse(md);
  return html.replace(/href="([^"]*)"/g, (all, url) => `href="${escAttr(mapHref(url.replace(/&amp;/g, "&")))}"`);
}

/** On clean-path pages, hash routes become real URLs (crawlable, work before JS). */
function staticLinks(html) {
  return html.replace(/href="#\/([^"]*)"/g, (all, route) => {
    const m = /^learn(?:\/([\w-]+))?\/?$/.exec(route);
    if (m) return `href="${m[1] ? `/learn/${m[1]}/` : "/learn/"}"`;
    return `href="/#/${route}"`;
  });
}

// If the URL carries a different hash route (e.g. /#/debug), drop the static page
// before first paint so it does not flash; the app renders the right one.
const hashGuard = (key) =>
  `<script>(function(){var h=location.hash,k=${JSON.stringify(key)};if(h.indexOf("#/")===0&&h.replace(/^#\/|\/$/g,"")!==k&&!(k==="home"&&h==="#/")){var a=document.getElementById("app");a.removeAttribute("data-prerendered");var m=document.getElementById("app-main");if(m)m.innerHTML="";}})();</script>`;

function page({ title, description, canonical, ogType = "article", modified, ld, body, key = "" }) {
  let h = shell;
  const set = (re, val) => {
    if (!re.test(h)) throw new Error(`prerender: pattern not found in dist/index.html: ${re}`);
    h = h.replace(re, val);
  };
  set(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(title)}</title>`);
  set(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escAttr(description)}$2`);
  set(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  set(/(<meta property="og:type" content=")[^"]*(")/, `$1${ogType}$2`);
  set(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(title)}$2`);
  set(/(<meta property="og:description" content=")[^"]*(")/, `$1${escAttr(description)}$2`);
  set(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`);
  set(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escAttr(title)}$2`);
  set(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escAttr(description)}$2`);
  const extra = [
    modified ? `<meta property="article:modified_time" content="${modified}" />` : "",
    ...ld.map(jsonLd),
  ].join("\n    ");
  set(/<\/head>/, `    ${extra}\n  </head>`);
  set(
    /<div id="app"><\/div>/,
    key ? `<div id="app" data-prerendered="${key}">${body}</div>${hashGuard(key)}` : `<div id="app">${body}</div>`,
  );
  return h;
}

const cleanHref = (id) => (id ? `/learn/${id}/` : "/learn/");

/**
 * Lesson flow diagrams are built with DOM calls. Run them once in linkedom so the
 * static page already shows the diagram (it is usually the largest element on a
 * phone screen). The app re-mounts the same diagram on boot. Any failure just
 * leaves the slot empty, exactly as before.
 */
async function flowRenderer() {
  try {
    const { parseHTML } = await import("linkedom");
    const w = parseHTML("<!doctype html><html><body></body></html>");
    const def = (k, v) => {
      if (globalThis[k] === undefined) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
    };
    for (const k of ["window", "document", "HTMLElement", "Node", "Element", "SVGElement", "CustomEvent", "Event"]) def(k, w[k]);
    const store = {};
    def("localStorage", { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] });
    def("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} }));
    def("requestAnimationFrame", () => 0);
    def("cancelAnimationFrame", () => {});
    def("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    def("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    const { mountLessonDiagram } = await import("../src/diagrams/learnBind.js");
    return (lesson) => {
      if (!lesson.diagramId) return { html: "", cap: "" };
      try {
        const host = document.createElement("div");
        let cap = "";
        const d = mountLessonDiagram(host, lesson.diagramId, lesson);
        d?.onCaption?.((c) => (cap = [c.who, c.fail].filter(Boolean).join(" — ")));
        d?.update?.();
        return { html: host.innerHTML, cap };
      } catch (e) {
        console.warn(`prerender: flow diagram ${lesson.diagramId} skipped (${e.message})`);
        return { html: "", cap: "" };
      }
    };
  } catch (e) {
    console.warn(`prerender: flow diagrams skipped (${e.message})`);
    return () => ({ html: "", cap: "" });
  }
}
const renderFlow = await flowRenderer();
const ALL_TRACKS = new Set(TRACKS.map((t) => t.id));

function write(rel, html) {
  const out = path.join(dist, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

const author = { "@type": "Person", name: "Swetabh Suman", url: "https://github.com/developer-swetabh" };
const urls = [{ loc: `${SITE}/`, lastmod: Object.values(updated).sort().pop() }];

// Module pages
for (const [i, mod] of MODULES.entries()) {
  const md = fs.readFileSync(path.join(portal, "public/curriculum", mod.file), "utf8");
  const h1 = (/^#\s+(.+)$/m.exec(md) || [, mod.title])[1].trim();
  const description = describe(md);
  const canonical = `${SITE}/learn/${mod.id}/`;
  const modified = updated[mod.file];
  const prev = MODULES[i - 1];
  const next = MODULES[i + 1];
  const track = TRACKS.find((t) => t.id === mod.trackId);
  const title = `${mod.title} (Module ${mod.id}) · ${SITE_NAME}`;
  const anchored = anchorHeadings(enhanceModuleHtml(renderMd(md)), (sec) => `#${sec}`);
  const tocHtml = anchored.tocHtml;
  // Same wrapper the app adds (lib/markdown.js wrapTables), so tables do not move on boot.
  const articleHtml = anchored.html.replace(/<table>/g, '<div class="table-wrap" tabindex="0"><table>').replace(/<\/table>/g, "</table></div>");
  const flow = renderFlow(getLesson(mod.id));
  const body = staticLinks(
    shellHtml({
      page: "learn",
      mainHtml: learnPageHtml({
        mod,
        prev,
        next,
        isDone: false,
        lesson: getLesson(mod.id),
        updatedIso: modified,
        href: cleanHref,
        tree: treeHtml({ active: mod.id, open: ALL_TRACKS, done: new Set(), href: cleanHref }),
        tocHtml,
        articleHtml,
        flowHtml: flow.html,
        flowCap: flow.cap,
      }),
    }),
  );
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: h1,
      name: mod.title,
      description,
      inLanguage: "en",
      proficiencyLevel: "Expert",
      dependencies: "Android 15 AOSP, AIDL audio HAL",
      ...(modified ? { dateModified: modified } : {}),
      author,
      publisher: author,
      isPartOf: { "@type": "Course", name: SITE_NAME, url: `${SITE}/learn/` },
      mainEntityOfPage: canonical,
      url: canonical,
      image: `${SITE}/og-image.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Learn", item: `${SITE}/learn/` },
        { "@type": "ListItem", position: 2, name: track.title, item: `${SITE}/learn/` },
        { "@type": "ListItem", position: 3, name: mod.title, item: canonical },
      ],
    },
  ];
  write(`learn/${mod.id}/index.html`, page({ title, description, canonical, modified, ld, body, key: `learn/${mod.id}` }));
  urls.push({ loc: canonical, lastmod: modified });
}

// Course index
const courseLd = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "Android Audio Engineering: AOSP & AAOS audio from AudioTrack to the speaker",
  description:
    "A beginner-to-architect course on the Android audio stack: AudioTrack, AudioFlinger, AudioPolicy, the AIDL audio HAL, ALSA/ASoC, AAOS car audio and systematic debugging. Targets Android 15.",
  url: `${SITE}/learn/`,
  inLanguage: "en",
  provider: author,
  author,
  isAccessibleForFree: true,
  hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT10H" },
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD", category: "Free" },
  hasPart: MODULES.map((m) => ({ "@type": "TechArticle", name: m.title, url: `${SITE}/learn/${m.id}/` })),
};
const indexBody = staticLinks(shellHtml({ page: "learn", mainHtml: `
  <div class="wrap learn-index prerendered">
    <h1>Learn</h1>
    <p class="lede">Each module is a written lesson on the Android audio stack (Android 15, AIDL HAL, AAOS).</p>
    ${TRACKS.map(
      (t) => `<section class="card track-card"><h2>${escAttr(t.title)}</h2><ol>
      ${t.modules.map((m) => `<li><a href="/learn/${m.id}/"><span class="mod-id">${m.id}</span> ${escAttr(m.title)}</a> <span class="mins">${m.mins} min</span></li>`).join("\n      ")}
    </ol></section>`,
    ).join("\n    ")}
  </div>` }));
write(
  "learn/index.html",
  page({
    title: `Learn: Android audio course modules · ${SITE_NAME}`,
    description: courseLd.description,
    canonical: `${SITE}/learn/`,
    ogType: "website",
    ld: [courseLd],
    body: indexBody,
  }),
);
urls.splice(1, 0, { loc: `${SITE}/learn/`, lastmod: urls[0].lastmod });

// Home: prerendered home page; also advertises the course (same Course entity).
// Hash links stay as-is here (this document is the SPA shell for /#/… routes).
fs.writeFileSync(
  path.join(dist, "index.html"),
  shell
    .replace(/<\/head>/, `    ${jsonLd(courseLd)}\n  </head>`)
    .replace(
      /<div id="app"><\/div>/,
      `<div id="app" data-prerendered="home">${shellHtml({ page: "home", mainHtml: homeHtml() })}</div>${hashGuard("home")}`,
    ),
);

// sitemap.xml
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(dist, "sitemap.xml"), sitemap);

// 404 page (static, no app boot needed)
fs.writeFileSync(
  path.join(dist, "404.html"),
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found · ${SITE_NAME}</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>body{font-family:system-ui,sans-serif;background:#09090f;color:#f1f5f9;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#00e5ff}main{max-width:36rem;padding:24px}</style></head><body><main><h1>Page not found</h1><p>That page doesn't exist. Try the <a href="/learn/">course index</a> or the <a href="/">home page</a>.</p><p><a href="${REPO}/issues/new?title=Broken%20link">Report a broken link</a></p></main></body></html>`,
);

// Critical CSS: inline the rules each page's markup uses, load the full sheet async.
const beasties = new Beasties({
  path: dist,
  publicPath: "/",
  preload: "media",
  pruneSource: false,
  reduceInlineStyles: false,
  mergeStylesheets: false,
  fonts: false,
  logLevel: "warn",
});
const htmlFiles = ["index.html", "learn/index.html", ...MODULES.map((m) => `learn/${m.id}/index.html`)];
for (const rel of htmlFiles) {
  const file = path.join(dist, rel);
  fs.writeFileSync(file, await beasties.process(fs.readFileSync(file, "utf8")));
}

console.log(`prerendered home + ${MODULES.length} module pages + /learn/, critical CSS inlined in ${htmlFiles.length} pages, sitemap with ${urls.length} URLs, 404.html`);
