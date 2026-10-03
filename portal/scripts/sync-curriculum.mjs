#!/usr/bin/env node
/**
 * Copies the course text (repo-root modules/ and workbook/) into
 * portal/public/curriculum/ and records each module's last git commit date in
 * src/content/updated.json (shown as "Last updated" and used for sitemap lastmod).
 *
 *   npm run sync          copy + update dates (run after editing modules/ or workbook/)
 *   npm run sync:check    exit 1 if public/curriculum is out of date (CI-friendly)
 *
 * Not part of `npm run build`: the deploy uses the committed copy, so a build
 * never depends on files outside portal/.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(portal, "..");
const dest = path.join(portal, "public", "curriculum");
const check = process.argv.includes("--check");

const sets = [
  { from: path.join(repo, "modules"), to: dest },
  { from: path.join(repo, "workbook"), to: path.join(dest, "workbook") },
];

let drift = 0;
for (const { from, to } of sets) {
  if (!fs.existsSync(from)) {
    console.error(`missing ${from}`);
    process.exit(2);
  }
  fs.mkdirSync(to, { recursive: true });
  const want = fs.readdirSync(from).filter((f) => f.endsWith(".md"));
  for (const f of want) {
    const src = fs.readFileSync(path.join(from, f));
    const dst = path.join(to, f);
    const same = fs.existsSync(dst) && Buffer.compare(src, fs.readFileSync(dst)) === 0;
    if (!same) {
      drift++;
      console.log(`${check ? "stale" : "copy "} ${path.relative(portal, dst)}`);
      if (!check) fs.writeFileSync(dst, src);
    }
  }
  for (const f of fs.readdirSync(to).filter((f) => f.endsWith(".md"))) {
    if (!want.includes(f)) {
      drift++;
      console.log(`${check ? "extra" : "rm   "} ${path.relative(portal, path.join(to, f))}`);
      if (!check) fs.rmSync(path.join(to, f));
    }
  }
}

function gitDate(rel) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", rel], { cwd: repo, encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

const dates = {};
for (const f of fs.readdirSync(path.join(repo, "modules")).filter((f) => f.endsWith(".md")).sort()) {
  const d = gitDate(`modules/${f}`);
  if (d) dates[f] = d;
}
const datesPath = path.join(portal, "src", "content", "updated.json");
const json = `${JSON.stringify(dates, null, 2)}\n`;
const oldJson = fs.existsSync(datesPath) ? fs.readFileSync(datesPath, "utf8") : "";
if (json !== oldJson) {
  if (check) {
    drift++;
    console.log("stale src/content/updated.json");
  } else fs.writeFileSync(datesPath, json);
}

if (check && drift) {
  console.error(`${drift} file(s) out of date. Run: npm run sync`);
  process.exit(1);
}
console.log(check ? "curriculum copy is up to date" : `synced (${drift} change(s))`);
