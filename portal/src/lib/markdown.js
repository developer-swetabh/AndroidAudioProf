import { esc } from "./dom.js";

export function parseMarkdown(text) {
  const parse = window.marked?.parse;
  if (typeof parse === "function") return parse(text);
  return `<pre>${esc(text)}</pre>`;
}

export function enhanceModuleHtml(html) {
  let h = html;
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
