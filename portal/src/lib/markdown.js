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

export function parseMarkdown(text) {
  const parse = window.marked?.parse;
  if (typeof parse === "function") return rewriteCurriculumLinks(parse(text));
  return `<pre>${esc(text)}</pre>`;
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
  h = h.replace(/<pre><code/g, '<div class="code-wrap"><button class="icon-btn copy-code" type="button" aria-label="Copy">⧉</button><pre><code');
  h = h.replace(/<\/pre>/g, "</pre></div>");
  return h;
}

export function slugHeading(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

let mermaidMod = null;

export async function hydrateMermaid(root) {
  if (!root) return;
  const blocks = [...root.querySelectorAll("pre code.language-mermaid, pre code.lang-mermaid")];
  if (!blocks.length) return;
  try {
    mermaidMod ??= (await import("https://cdn.jsdelivr.net/npm/mermaid@11/+esm")).default;
    mermaidMod.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "dark",
      fontFamily: "Inter, system-ui, sans-serif",
      flowchart: { useMaxWidth: true, htmlLabels: true, nodeSpacing: 28, rankSpacing: 36 },
      sequence: { useMaxWidth: true, actorMargin: 28, messageMargin: 28 },
    });
  } catch {
    return;
  }
  let n = 0;
  for (const code of blocks) {
    const src = code.textContent || "";
    const wrap = code.closest(".code-wrap") || code.closest("pre") || code;
    const div = document.createElement("div");
    div.className = "mermaid-live";
    wrap.replaceWith(div);
    try {
      const id = `mmd-${Date.now()}-${n++}`;
      const { svg } = await mermaidMod.render(id, src);
      div.innerHTML = svg;
    } catch {
      div.innerHTML = `<pre class="mermaid-fail">${esc(src)}</pre>`;
    }
  }
}
