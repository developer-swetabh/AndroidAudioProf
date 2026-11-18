#!/usr/bin/env node
/**
 * Fail if any AAOS playback stage is missing a source or a tag.
 * Usage: node portal/scripts/check-aaos-paths.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertQuotes } from "../src/diagrams/playbackPath.js";

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, "../src/content/aaos-playback-paths.json");
const data = JSON.parse(readFileSync(file, "utf8"));

const tags = new Set(data.meta?.tags ?? []);
const owners = new Set(data.meta?.owners ?? []);
const required = [
  "id",
  "name",
  "line",
  "short",
  "technical",
  "owner",
  "inputFormat",
  "outputFormat",
  "process",
  "thread",
  "buffers",
  "latency",
  "tag",
  "sources",
];
const lines = new Set(["data", "control"]);
const errors = [];

function checkStage(stage, where) {
  if (stage == null || typeof stage !== "object") {
    errors.push(`${where}: stage is not an object`);
    return;
  }
  const id = stage.id || where;
  for (const key of required) {
    const value = stage[key];
    if (value == null || value === "") {
      errors.push(`${id}: missing ${key}`);
    }
  }
  if (stage.line != null && !lines.has(stage.line)) {
    errors.push(`${id}: line must be data or control, got ${stage.line}`);
  }
  if (stage.tag != null && !tags.has(stage.tag)) {
    errors.push(`${id}: tag ${stage.tag} is not in meta.tags`);
  }
  if (stage.owner != null && !owners.has(stage.owner)) {
    errors.push(`${id}: owner ${stage.owner} is not in meta.owners`);
  }
  const allowedBounds = new Set(data.meta?.bounds ?? []);
  if (!Array.isArray(stage.bounds) || stage.bounds.length === 0) {
    errors.push(`${id}: missing bounds`);
  } else {
    const seen = new Set();
    const processText = String(stage.process || "").toLowerCase();
    stage.bounds.forEach((bound, index) => {
      if (typeof bound !== "string" || !allowedBounds.has(bound)) {
        errors.push(`${id}: bounds[${index}] ${bound} is not in meta.bounds`);
        return;
      }
      if (seen.has(bound)) errors.push(`${id}: duplicate bound ${bound}`);
      seen.add(bound);
      if (!processText.includes(bound.toLowerCase())) {
        errors.push(`${id}: bound "${bound}" is not in the process text`);
      }
    });
  }
  if (Array.isArray(stage.sources)) {
    if (stage.sources.length === 0) {
      errors.push(`${id}: sources is empty`);
    }
    stage.sources.forEach((source, index) => {
      if (!source || typeof source !== "object") {
        errors.push(`${id}: source ${index} is not an object`);
        return;
      }
      if (!source.url || !String(source.url).startsWith("https://")) {
        errors.push(`${id}: source ${index} needs an https url`);
      }
      if (!source.label) {
        errors.push(`${id}: source ${index} needs a label`);
      }
      if (source.kind !== "doc") {
        if (!source.path || !source.symbol) {
          errors.push(`${id}: source ${index} needs path and symbol`);
        }
      }
    });
  }
}

const groups = [
  ["control", data.control],
  ["paths.A", data.paths?.A?.stages],
  ["paths.B", data.paths?.B?.stages],
];

for (const [name, list] of groups) {
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`${name}: no stages`);
    continue;
  }
  list.forEach((stage, index) => checkStage(stage, `${name}[${index}]`));
}

try {
  assertQuotes(data);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

const count = groups.reduce((sum, [, list]) => sum + (Array.isArray(list) ? list.length : 0), 0);

if (errors.length) {
  console.error(`check-aaos-paths: ${errors.length} problem(s) in ${count} stages`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`check-aaos-paths: ${count} stages, each has a source, a tag, and bounds`);
