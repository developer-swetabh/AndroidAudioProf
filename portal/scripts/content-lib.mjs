/**
 * Shared helpers for the YAML content pipeline (build-content.mjs, fetch-sources.mjs).
 * Content lives in portal/content/: flows/*.yaml, quizzes/*.yaml, scenarios/*.yaml.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { lockKey, isKernel } from "../src/lib/aosp.js";

export const portal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const contentDir = path.join(portal, "content");
export const LOCK_FILE = path.join(contentDir, "sources.lock.json");
export const EXCERPTS_FILE = path.join(contentDir, "sources", "excerpts.json");

export function readYamlDir(kind) {
  const dir = path.join(contentDir, kind);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => {
      const file = path.join(dir, f);
      const doc = YAML.parseDocument(fs.readFileSync(file, "utf8"), { prettyErrors: true });
      if (doc.errors.length) throw new Error(`${path.relative(portal, file)}: ${doc.errors.map((e) => e.message).join("; ")}`);
      return { file: path.relative(portal, file), data: doc.toJS() };
    });
}

export function loadContent() {
  return {
    flows: readYamlDir("flows"),
    quizzes: readYamlDir("quizzes"),
    scenarios: readYamlDir("scenarios"),
  };
}

/** Every `{repo, path, ...}` object anywhere in the content (sources are recognised by shape). */
export function collectSourceRefs(content) {
  const refs = [];
  const walk = (node, where) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${where}[${i}]`));
    if (node && typeof node === "object") {
      if (typeof node.repo === "string" && typeof node.path === "string") refs.push({ ref: node, where });
      for (const [k, v] of Object.entries(node)) walk(v, `${where}.${k}`);
    }
  };
  for (const kind of ["flows", "quizzes", "scenarios"]) for (const { file, data } of content[kind]) walk(data, file);
  return refs;
}

export const refKey = (ref) => (ref.symbol ? lockKey(ref) : `${ref.repo}:${ref.path}`);
export const needsLine = (ref) => Boolean(ref.symbol) && !isKernel(ref.repo);

export function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

const escHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Tiny inline formatter for authored strings: `code`, **bold**, *em*, [text](https://…).
 * Everything else is escaped. Output is trusted HTML (authored in this repo).
 */
export function inline(s) {
  const codes = [];
  let t = String(s ?? "").replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  t = escHtml(t)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escHtml(codes[+i])}</code>`);
}

export const plainText = (s) => String(s ?? "").replace(/`([^`]+)`/g, "$1").replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
