import { esc } from "./dom.js";
import { MODULES } from "../content/catalog.js";
import { RCA_CASES } from "../content/rcaCases.js";

/** GitHub-style .md hrefs in the textbook become portal hash routes. Markdown files stay canonical. */
export function mapCurriculumHref(href) {
  if (href == null) return href;
  let raw = String(href).trim().replace(/&amp;/g, "&");
  try {
    raw = decodeURI(raw);
  } catch {
    /* keep raw */
  }
  if (!raw) return href;
  if (/^(https?:|mailto:)/i.test(raw)) return href;
  if (raw.startsWith("#/")) return raw;
  if (raw.startsWith("#")) return href;

  const filePart = raw.split("?")[0].split("#")[0];
  const normalized = filePart.replace(/\\/g, "/").replace(/^\.\//, "");
  const name = normalized.split("/").filter(Boolean).pop() || "";

  const mod = MODULES.find((m) => m.file === name);
  if (mod) return `#/learn/${mod.id}`;

  const rca = RCA_CASES.find((c) => c.file === name);
  if (rca) return `#/workbench/rca/${rca.id}`;

  if (/^ANSWER_KEY\.md$/i.test(name)) return "#/workbench/rca";
  if (/workbook/i.test(normalized) && /^README\.md$/i.test(name)) return "#/workbench/rca";
  if (/REFERENCE_PLATFORM\.md$/i.test(name)) return "#/learn/00";
  if (/LEARNING_PATH\.md$/i.test(name)) return "#/learn";
  if (/(^|\/)labs(\/|$)/i.test(normalized)) return "#/debug";
  if (/^README\.md$/i.test(name)) return "#/home";
  return href;
}

export function rewriteCurriculumLinks(html) {
  return String(html || "").replace(/href=(["'])([^"']*)\1/gi, (all, q, url) => {
    const mapped = mapCurriculumHref(url);
    if (!mapped || mapped === url) return all;
    return `href=${q}${mapped}${q}`;
  });
}

export function enhanceModuleHtml(html) {
  let h = rewriteCurriculumLinks(html);
  h = h.replace(
    /<h2[^>]*>Short Answer<\/h2>([\s\S]*?)(?=<h2|$)/i,
    (_, body) =>
      `<section class="callout callout-cyan" id="sec-short-answer"><h2>Short Answer</h2>${body}</section>`,
  );
  h = h.replace(
    /<h2[^>]*>Mental Model<\/h2>([\s\S]*?)(?=<h2|$)/i,
    (_, body) =>
      `<section class="callout callout-amber" id="sec-mental-model"><h2>Mental Model</h2>${body}</section>`,
  );
  h = h.replace(
    /<h2[^>]*>Practice<\/h2>([\s\S]*?)(?=<h2|$)/i,
    (_, body) =>
      `<details class="practice-fold" id="sec-practice"><summary>Practice</summary>${body}</details>`,
  );
  h = h.replace(
    /<pre><code/g,
    '<div class="code-wrap"><button class="copy-code" type="button" aria-label="Copy code to clipboard">Copy</button><pre tabindex="0"><code',
  );
  h = h.replace(/<\/pre>/g, "</pre></div>");
  return h;
}

export { slugHeading } from "./slug.js";

let mermaidMod = null;

function mermaidTheme() {
  return document.documentElement.dataset.theme === "light" ? "default" : "dark";
}

async function loadMermaid() {
  // Code-split chunk, version-locked through package-lock.json (no CDN).
  mermaidMod ??= (await import("mermaid")).default;
  mermaidMod.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: mermaidTheme(),
    fontFamily: "Inter, system-ui, sans-serif",
    flowchart: { useMaxWidth: true, htmlLabels: true, nodeSpacing: 28, rankSpacing: 36 },
    sequence: { useMaxWidth: true, actorMargin: 28, messageMargin: 28 },
  });
  return mermaidMod;
}

let mmdSeq = 0;

async function renderMermaidInto(div, src) {
  try {
    const id = `mmd-${Date.now()}-${mmdSeq++}`;
    const { svg } = await mermaidMod.render(id, src);
    div.innerHTML = svg;
    const svgEl = div.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("role", "img");
      const first = src.trim().split("\n")[0] || "diagram";
      svgEl.setAttribute("aria-label", `Diagram (${first.trim()}). The source text follows in the expandable section.`);
    }
    const det = document.createElement("details");
    det.className = "mermaid-src";
    det.innerHTML = `<summary>Diagram source (text)</summary><pre>${esc(src)}</pre>`;
    div.appendChild(det);
  } catch {
    div.innerHTML = `<pre class="mermaid-fail">${esc(src)}</pre>`;
  }
}

let mermaidObserver = null;
let renderQueue = Promise.resolve();

/** Render one pending block: load mermaid on first use, then draw. Serialized (mermaid is not re-entrant). */
function renderPending(wrap) {
  if (wrap.dataset.mmdState) return renderQueue;
  wrap.dataset.mmdState = "queued";
  renderQueue = renderQueue.then(async () => {
    if (!wrap.isConnected) return;
    const code = wrap.querySelector("code");
    const src = code?.textContent || "";
    try {
      await loadMermaid();
    } catch {
      delete wrap.dataset.mmdState; // source stays visible as a code block
      return;
    }
    if (!wrap.isConnected) return;
    const div = document.createElement("div");
    div.className = "mermaid-live";
    div.dataset.src = src;
    wrap.replaceWith(div);
    await renderMermaidInto(div, src);
  });
  return renderQueue;
}

/**
 * Diagrams are drawn only when they scroll near the viewport, so pages without a
 * visible diagram never download or run mermaid. The fenced source shows until then.
 */
export async function hydrateMermaid(root) {
  if (!root) return;
  const blocks = [...root.querySelectorAll("pre code.language-mermaid, pre code.lang-mermaid")];
  if (!blocks.length) return;
  const wraps = blocks.map((code) => {
    const wrap = code.closest(".code-wrap") || code.closest("pre") || code;
    wrap.classList.add("mermaid-pending");
    return wrap;
  });
  if (!("IntersectionObserver" in window)) {
    for (const w of wraps) await renderPending(w);
    return;
  }
  mermaidObserver?.disconnect();
  mermaidObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        mermaidObserver.unobserve(e.target);
        renderPending(e.target);
      }
    },
    { rootMargin: "400px 0px" },
  );
  wraps.forEach((w) => mermaidObserver.observe(w));
}


/** Re-render live diagrams after a theme toggle so they match light/dark. */
export async function rethemeMermaid() {
  const live = [...document.querySelectorAll(".mermaid-live[data-src]")];
  if (!live.length || !mermaidMod) return;
  await loadMermaid();
  for (const div of live) await renderMermaidInto(div, div.dataset.src);
}

/* ---------- code highlighting (lazy chunk) ---------- */

let hljsMod = null;
const LANG_ALIAS = { aidl: "java", sh: "bash", shell: "bash", console: "bash", dts: "dts", kt: "kotlin", c: "cpp", h: "cpp", rc: "bash" };

async function loadHljs() {
  if (hljsMod) return hljsMod;
  const [core, bash, xml, cpp, java, kotlin, dts] = await Promise.all([
    import("highlight.js/lib/core"),
    import("highlight.js/lib/languages/bash"),
    import("highlight.js/lib/languages/xml"),
    import("highlight.js/lib/languages/cpp"),
    import("highlight.js/lib/languages/java"),
    import("highlight.js/lib/languages/kotlin"),
    import("highlight.js/lib/languages/dts"),
  ]);
  const h = core.default;
  h.registerLanguage("bash", bash.default);
  h.registerLanguage("xml", xml.default);
  h.registerLanguage("cpp", cpp.default);
  h.registerLanguage("java", java.default);
  h.registerLanguage("kotlin", kotlin.default);
  h.registerLanguage("dts", dts.default);
  hljsMod = h;
  return h;
}

/** Highlight fenced code that declares a known language; label every block. Plain/ASCII blocks stay untouched. */
export async function highlightCode(root) {
  if (!root) return;
  const codes = [...root.querySelectorAll("pre > code")];
  const todo = [];
  for (const code of codes) {
    const m = /(?:^|\s)language-([\w+-]+)/.exec(code.className || "");
    if (!m) continue;
    const raw = m[1].toLowerCase();
    if (raw === "mermaid") continue;
    const wrap = code.closest(".code-wrap");
    if (wrap && !wrap.querySelector(".code-lang") && raw !== "text") {
      const lab = document.createElement("span");
      lab.className = "code-lang";
      lab.textContent = raw;
      wrap.prepend(lab);
    }
    const lang = LANG_ALIAS[raw] || raw;
    todo.push({ code, lang });
  }
  if (!todo.length) return;
  let h;
  try {
    h = await loadHljs();
  } catch {
    return;
  }
  for (const { code, lang } of todo) {
    if (!h.getLanguage(lang)) continue;
    try {
      // hljs escapes the text it was given; we only feed it textContent.
      code.innerHTML = h.highlight(code.textContent || "", { language: lang, ignoreIllegals: true }).value;
      code.classList.add("hljs");
    } catch {
      /* leave plain */
    }
  }
}

/** Copy buttons with visible + announced feedback. */
export function wireCopyButtons(root) {
  if (!root) return;
  root.querySelectorAll(".copy-code").forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.parentElement.querySelector("code");
      const text = code?.innerText || "";
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = false;
      }
      btn.textContent = ok ? "Copied" : "Copy failed";
      btn.setAttribute("aria-live", "polite");
      clearTimeout(btn._t);
      btn._t = setTimeout(() => (btn.textContent = "Copy"), 1500);
    };
  });
}

/** Horizontal scroll wrapper so wide tables do not squash on phones. */
export function wrapTables(root) {
  if (!root) return;
  root.querySelectorAll("table").forEach((t) => {
    if (t.parentElement?.classList.contains("table-wrap")) return;
    const w = document.createElement("div");
    w.className = "table-wrap";
    w.tabIndex = 0;
    t.replaceWith(w);
    w.append(t);
  });
}
