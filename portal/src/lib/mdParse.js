/**
 * Markdown → sanitized HTML. marked and DOMPurify are bundled (version-pinned in
 * package.json). Kept in its own module so prerendered pages, which already
 * carry the rendered lesson, never download the parser.
 */
import { marked } from "marked";
import DOMPurify from "dompurify";
import { esc } from "./dom.js";
import { rewriteCurriculumLinks } from "./markdown.js";

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}

export function parseMarkdown(text) {
  try {
    return rewriteCurriculumLinks(sanitizeHtml(marked.parse(String(text ?? ""))));
  } catch {
    return `<pre>${esc(text)}</pre>`;
  }
}
