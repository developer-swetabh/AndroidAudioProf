#!/usr/bin/env node
/**
 * YAML content → validated JSON for the site.
 *
 *   node scripts/build-content.mjs          validate + write src/content/generated/**
 *   node scripts/build-content.mjs --check  validate only (used by `npm run sync:check`)
 *
 * Validation (fails the build):
 *  - JSON Schema (content/schema/*.schema.json) via ajv
 *  - module ids exist in catalog.js; `#anchor`s exist in the rendered module headings
 *  - exactly one `correct: true` per single-choice item; ids unique
 *  - process / lane names come from a fixed enum (so CarAudioService can never be
 *    tagged system_server; it is com.android.car)
 *  - every source reference has an entry in content/sources.lock.json for AOSP_TAG,
 *    with the same symbol, and its excerpt is present and matches the locked hash.
 *    (Offline: run `npm run sources` to refresh, `npm run sources -- --check` to
 *    re-verify against googlesource.)
 *  - every ```aa-flow / ```aa-quiz block in modules/*.md points at real content
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Ajv from "ajv";
import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import { AOSP_TAG, KERNEL_BRANCH, aospLink, csSearch, isKernel } from "../src/lib/aosp.js";
import { MODULES } from "../src/content/catalog.js";
import { anchorHeadings } from "../src/pages/learnMarkup.js";
import { enhanceModuleHtml } from "../src/lib/markdown.js";
import { portal, contentDir, loadContent, collectSourceRefs, refKey, readJson, LOCK_FILE, EXCERPTS_FILE, inline, plainText } from "./content-lib.mjs";

hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("java", java);
hljs.registerLanguage("c", c);

const CHECK = process.argv.includes("--check");
const outDir = path.join(portal, "src", "content", "generated");
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

// ---------- schemas
const ajv = new Ajv({ allErrors: true, strict: true });
const schemaDir = path.join(contentDir, "schema");
for (const f of fs.readdirSync(schemaDir).filter((x) => x.endsWith(".json")))
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(schemaDir, f), "utf8")));
const validators = { flows: ajv.getSchema("flow.schema.json"), quizzes: ajv.getSchema("quiz.schema.json"), scenarios: ajv.getSchema("scenario.schema.json") };

const content = loadContent();
for (const kind of Object.keys(validators))
  for (const { file, data } of content[kind])
    if (!validators[kind](data)) for (const e of validators[kind].errors) err(file, `${e.instancePath || "/"} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(", ")})` : ""}`);

// ---------- module headings (same pipeline as prerender: marked → enhance → anchorHeadings)
const modIds = new Set(MODULES.map((m) => m.id));
const mdOf = new Map(MODULES.map((m) => [m.id, fs.readFileSync(path.join(portal, "..", "modules", m.file), "utf8")]));
const anchorCache = new Map();
function anchorsOf(id) {
  if (!anchorCache.has(id)) {
    const { html } = anchorHeadings(enhanceModuleHtml(marked.parse(mdOf.get(id))), (s) => `#${s}`);
    anchorCache.set(id, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return anchorCache.get(id);
}
function checkModuleRef(where, ref) {
  const [id, anchor] = String(ref).split("#");
  if (!modIds.has(id)) return err(where, `unknown module "${id}"`);
  if (anchor && !anchorsOf(id).has(anchor)) err(where, `module ${id} has no heading id "#${anchor}"`);
}

// ---------- sources
const lock = readJson(LOCK_FILE, { sources: {} });
const excerpts = readJson(EXCERPTS_FILE, {});
if (lock.tag !== AOSP_TAG) err("content/sources.lock.json", `tag ${lock.tag} ≠ AOSP_TAG ${AOSP_TAG}; run npm run sources`);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const LANG = { ".cpp": "cpp", ".h": "cpp", ".cc": "cpp", ".c": "c", ".java": "java", ".aidl": "java" };
const code = {}; // key → highlighted excerpt (loaded lazily by the player)

function resolveSource(where, ref) {
  const key = refKey(ref);
  const L = lock.sources[key];
  if (!L) {
    err(where, `no lock entry for ${key}; run npm run sources`);
    return null;
  }
  if (L.ref !== (isKernel(ref.repo) ? `heads/${KERNEL_BRANCH}` : `tags/${AOSP_TAG}`)) err(where, `${key} locked at ${L.ref}`);
  const file = path.basename(ref.path);
  const out = {
    repo: ref.repo,
    path: ref.path,
    file,
    label: ref.label || (ref.symbol ? ref.symbol.replace(/\($/, "()") : file),
    line: L.line || null,
    url: aospLink({ repo: ref.repo, path: ref.path, line: L.line }),
    pinned: isKernel(ref.repo) ? `${KERNEL_BRANCH} (moving branch)` : AOSP_TAG,
  };
  if (ref.symbol && /^[A-Za-z_][\w:~]*\(?$/.test(ref.symbol)) out.search = csSearch(ref.symbol.replace(/\($/, "").split("::").pop());
  if (ref.symbol) {
    if (L.symbol !== ref.symbol) err(where, `${key} lock symbol mismatch`);
    const ex = excerpts[key];
    if (!ex) err(where, `${key} has no stored excerpt`);
    else if (sha256(ex.lines.join("\n")) !== L.excerptSha256 || ex.start !== L.start) err(where, `${key} excerpt does not match lock`);
    else if (!ex.lines[L.line - L.start]?.includes(ref.symbol)) err(where, `${key} symbol not at locked line ${L.line}`);
    else {
      out.code = key;
      if (!code[key]) {
        const lang = LANG[path.extname(file)];
        const src = ex.lines.join("\n");
        code[key] = {
          start: ex.start,
          hl: L.line - ex.start,
          lang: lang || "text",
          html: lang ? hljs.highlight(src, { language: lang, ignoreIllegals: true }).value : src.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
        };
      }
    }
  }
  return out;
}

// ---------- flows
const flows = {};
for (const { file, data: f } of content.flows) {
  if (flows[f.id]) err(file, `duplicate flow id ${f.id}`);
  f.modules?.forEach((m) => modIds.has(m) || err(file, `unknown module ${m}`));
  const ids = new Set();
  (f.steps || []).forEach((s, i) => {
    const w = `${file} step ${s.n}`;
    if (s.n !== i + 1) err(w, `steps must be numbered 1..N in order (got ${s.n} at position ${i + 1})`);
    if (ids.has(s.id)) err(w, `duplicate step id ${s.id}`);
    ids.add(s.id);
    if (s.lane && !f.lanes.includes(s.lane)) err(w, `lane ${s.lane} not in flow lanes`);
    if (s.links?.module) checkModuleRef(w, s.links.module);
  });
  if (f.predict) {
    if (f.predict.before_step > f.steps.length) err(file, "predict.before_step out of range");
    if (f.predict.choices.filter((c) => c.correct).length !== 1) err(file, "predict needs exactly one correct choice");
  }
  if (errors.length) continue;
  flows[f.id] = {
    id: f.id,
    title: f.title,
    question: f.question,
    summary: f.summary || "",
    product: f.product,
    android: f.applies_to.android,
    hal: f.applies_to.hal,
    tag: AOSP_TAG,
    modules: f.modules,
    lanes: f.lanes,
    assumptions: f.assumptions.map(inline),
    phases: f.phases || [],
    predict: f.predict ? { ...f.predict, prompt: inline(f.predict.prompt), reveal: inline(f.predict.reveal), choices: f.predict.choices.map((c) => ({ ...c, text: inline(c.text) })) } : null,
    steps: f.steps.map((s) => ({
      n: s.n,
      id: s.id,
      title: s.title,
      titleHtml: inline(s.title),
      short: s.short,
      process: s.process,
      thread: inline(s.thread),
      threadText: plainText(s.thread),
      path: s.path,
      lane: s.lane,
      summary: inline(s.text.intermediate),
      summaryText: plainText(s.text.intermediate),
      detail: inline(s.text.internals),
      deep: s.text.deep ? inline(s.text.deep) : "",
      see: s.see.map(inline),
      fails: s.fails.map(inline),
      classes: s.deeper.classes,
      note: s.deeper.note ? inline(s.deeper.note) : "",
      sources: s.deeper.sources.map((r) => resolveSource(`${file} step ${s.n}`, r)).filter(Boolean),
      module: s.links?.module || "",
    })),
  };
}

// ---------- quizzes
const quizzes = {};
for (const { file, data } of content.quizzes) {
  for (const q of Array.isArray(data) ? data : []) {
    const w = `${file} ${q.id}`;
    if (quizzes[q.id]) err(w, "duplicate quiz id");
    if (q.choices?.filter((c) => c.correct).length !== 1) err(w, "needs exactly one correct choice");
    if (new Set(q.choices?.map((c) => c.id)).size !== q.choices?.length) err(w, "duplicate choice ids");
    q.modules?.forEach((m) => modIds.has(m) || err(w, `unknown module ${m}`));
    if (q.reread) checkModuleRef(w, q.reread);
    quizzes[q.id] = {
      id: q.id,
      label: q.label || "",
      modules: q.modules,
      stem: inline(q.stem),
      choices: q.choices.map((c) => ({ id: c.id, text: inline(c.text), correct: Boolean(c.correct), feedback: c.feedback ? inline(c.feedback) : "" })),
      explain: inline(q.explain),
      sources: (q.sources || []).map((r) => resolveSource(w, r)).filter(Boolean),
      reread: q.reread || "",
    };
  }
}

// ---------- scenarios (schema + cross refs only; the UI ships in Phase 2)
for (const { file, data: s } of content.scenarios) {
  s.modules?.forEach((m) => modIds.has(m) || err(file, `unknown module ${m}`));
  if (s.choices?.filter((c) => c.correct).length !== 1) err(file, "needs exactly one correct choice");
  (s.sources || []).forEach((r) => resolveSource(file, r));
}

// ---------- embeds in the textbook
const EMBED = /```(aa-flow|aa-quiz)\n([\s\S]*?)```/g;
const placed = new Set(); // "quizId@module"
for (const [id, md] of mdOf) {
  for (const m of md.matchAll(EMBED)) {
    const w = `modules/${MODULES.find((x) => x.id === id).file} ${m[1]}`;
    const body = m[2];
    if (m[1] === "aa-flow") {
      const src = (/^src:\s*([\w-]+)/m.exec(body) || [])[1];
      const steps = (/^steps:\s*(\d+)(?:-(\d+))?\s*$/m.exec(body) || []);
      if (!flows[src]) err(w, `unknown flow "${src}"`);
      else if (steps[1]) {
        const a = +steps[1], b = +(steps[2] || steps[1]);
        if (a < 1 || b > flows[src].steps.length || a > b) err(w, `steps ${a}-${b} out of range`);
      }
      if (flows[src] && !flows[src].modules.includes(id)) err(w, `flow ${src} does not list module ${id}`);
    } else {
      const ids = (/^ids:\s*\[([^\]]*)\]/m.exec(body) || [])[1];
      if (!ids) err(w, "aa-quiz needs ids: [q-…]");
      for (const q of (ids || "").split(",").map((x) => x.trim()).filter(Boolean)) {
        placed.add(`${q}@${id}`);
        if (!quizzes[q]) err(w, `unknown quiz id ${q}`);
        else if (!quizzes[q].modules.includes(id)) err(w, `quiz ${q} does not list module ${id}`);
      }
    }
  }
}

for (const q of Object.values(quizzes)) for (const m of q.modules) if (!placed.has(`${q.id}@${m}`)) err(`quiz ${q.id}`, `lists module ${m} but no \`\`\`aa-quiz block there embeds it`);

// ---------- unused lock entries (stale content) are reported, not fatal
const used = new Set(collectSourceRefs(content).map(({ ref }) => refKey(ref)));
const stale = Object.keys(lock.sources).filter((k) => !used.has(k));

if (errors.length) {
  console.error(`build-content: ${errors.length} error(s)\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const summary = `${Object.keys(flows).length} flow(s), ${Object.keys(quizzes).length} check(s), ${content.scenarios.length} scenario(s), ${used.size} pinned source(s) at ${AOSP_TAG}`;
if (stale.length) console.warn(`build-content: ${stale.length} lock entr${stale.length === 1 ? "y is" : "ies are"} unused (run npm run sources): ${stale.join(", ")}`);
if (CHECK) {
  console.log(`content check OK: ${summary}`);
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "flows"), { recursive: true });
const write = (rel, obj) => fs.writeFileSync(path.join(outDir, rel), JSON.stringify(obj));
for (const [id, f] of Object.entries(flows)) {
  write(`flows/${id}.json`, f);
  const keys = new Set(f.steps.flatMap((s) => s.sources.map((x) => x.code).filter(Boolean)));
  write(`flows/${id}.code.json`, Object.fromEntries([...keys].map((k) => [k, code[k]])));
}
write("quizzes.json", quizzes);
write("index.json", { tag: AOSP_TAG, flows: Object.values(flows).map((f) => ({ id: f.id, title: f.title, question: f.question, steps: f.steps.length, modules: f.modules })) });
console.log(`build-content: ${summary}`);
