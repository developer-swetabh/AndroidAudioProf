import { esc } from "../lib/dom.js";

/** Sample format for colour plus a text label. Control is never coloured as PCM. */
export function formatKind(stage) {
  if (stage.line !== "data") return "control";
  const blob = `${stage.inputFormat} ${stage.outputFormat}`.toLowerCase();
  const pcm = /\bpcm\b/.test(blob);
  const compressed = /compress|mp3|audio\/mpeg/.test(blob);
  if (pcm && compressed) return "both";
  if (pcm) return "pcm";
  if (compressed) return "compressed";
  return "other";
}

export function formatLabel(kind) {
  if (kind === "pcm") return "PCM";
  if (kind === "compressed") return "compressed";
  if (kind === "both") return "compressed → PCM";
  if (kind === "control") return "control";
  return "not PCM";
}

export function boundsChanged(prev, stage) {
  if (!prev) return true;
  const key = (item) => [...item.bounds].slice().sort().join("\0");
  return key(prev) !== key(stage);
}

export function stageIndex(data) {
  const map = new Map();
  for (const stage of data.control) map.set(stage.id, { stage, lane: "control" });
  for (const stage of data.paths.A.stages) map.set(stage.id, { stage, lane: "pcm" });
  for (const stage of data.paths.B.stages) map.set(stage.id, { stage, lane: "offload" });
  return map;
}

export function resolveStageId(data, arg) {
  const index = stageIndex(data);
  const parts = String(arg || "")
    .split("/")
    .filter(Boolean);
  const found = [...parts].reverse().find((part) => index.has(part));
  return found || data.paths.A.stages[0].id;
}

function joinClass(stage) {
  if (stage.line !== "data") return "is-dashed";
  const kind = formatKind(stage);
  if (kind === "compressed" || kind === "both") return "is-solid is-compressed";
  return "is-solid";
}

const DIFF = new Set([
  "a3-decoder",
  "b2-passthrough",
  "a7-mix",
  "b6-offload-thread",
  "a10-alsa-pcm",
  "b8-kernel-compress",
  "b3-offload-gate",
  "b5-gapless-meta",
]);

const PAIRS = [
  ["a3-decoder", "b2-passthrough"],
  ["a7-mix", "b6-offload-thread"],
  ["a10-alsa-pcm", "b8-kernel-compress"],
];

const ONLY_OFFLOAD = ["b3-offload-gate", "b5-gapless-meta"];

/** Sentences copied from the spec. assertQuotes fails if the spec text changes. */
export const QUOTES = [
  ["a7-mix", "technical", "If two AAOS contexts use two bus addresses, they do not meet in this mixer."],
  ["a7-mix", "technical", "A second media app on the same bus does."],
  ["b6-offload-thread", "technical", "prepareTracks_l only writes the latest track. An older track can be flushed or invalidated."],
  ["b6-offload-thread", "technical", "If the format has no proportional frames, it does not pad with zeros."],
  ["a8-write-hal", "buffers", "Underrun on a mixer thread is counted with tallyUnderrunFrames when the thread inserts zeros."],
  ["b7-write-drain", "technical", "If the client underruns and the HAL timestamp is not moving, the track is removed and disabled."],
  ["c-duck", "technical", "If they share a bus, Android mixes them and does not change the gains."],
  ["c-audiocontrol", "technical", "CarVolumeGroupMuting calls onDevicesToMuteChange when volume-group mute is enabled."],
];

export function stageMap(data) {
  const map = new Map();
  for (const stage of [...data.control, ...data.paths.A.stages, ...data.paths.B.stages]) {
    map.set(stage.id, stage);
  }
  return map;
}

export function assertQuotes(data) {
  const map = stageMap(data);
  for (const [id, field, text] of QUOTES) {
    const hay = map.get(id)?.[field] || "";
    if (!hay.includes(text)) throw new Error(`quote missing from ${id}.${field}`);
  }
}

function quote(map, id, field, text) {
  const hay = map.get(id)?.[field] || "";
  return hay.includes(text) ? text : map.get(id)?.short || "";
}

function badges(stage, opts) {
  const labels = [];
  if (opts.compare && DIFF.has(stage.id)) labels.push(["diff", "Different"]);
  if (opts.secondApp && stage.id === "a7-mix") labels.push(["app", "Two apps · same bus · merged"]);
  if (opts.secondApp && stage.id === "b6-offload-thread") labels.push(["app", "Two apps · not merged"]);
  if (opts.underrun && stage.id === "a8-write-hal") labels.push(["underrun", "Underrun · zeros inserted"]);
  if (opts.underrun && stage.id === "b6-offload-thread") labels.push(["underrun", "Underrun · no zero pad"]);
  if (opts.underrun && stage.id === "b7-write-drain") labels.push(["underrun", "Underrun · track removed"]);
  if (opts.aaos && stage.id === "c-focus") labels.push(["aaos", "Focus · samples still run"]);
  if (opts.aaos && stage.id === "c-duck") labels.push(["aaos", "Duck signal · PCM not scaled"]);
  if (opts.aaos && stage.id === "c-audiocontrol") labels.push(["aaos", "Mute signal"]);
  return labels;
}

function lane(stages, stageId, title, note, opts, columnClass) {
  const items = stages
    .map((stage, index) => {
      const prev = index > 0 ? stages[index - 1] : null;
      const boundary = boundsChanged(prev, stage);
      const kind = formatKind(stage);
      const selected = stage.id === stageId;
      const marks = badges(stage, opts);
      const markClass = marks.map(([kindName]) => `is-${kindName}`).join(" ");
      const join =
        index === 0
          ? ""
          : `<div class="play-join ${joinClass(stage)}" aria-hidden="true"></div>`;
      const badgeHtml = marks
        .map(([, label]) => `<span class="play-badge">${esc(label)}</span>`)
        .join("");
      return `<li>
        ${join}
        <button type="button" class="play-node ${stage.line === "data" ? "is-data" : "is-control"}${boundary ? " is-boundary" : ""}${selected ? " is-sel" : ""}${markClass ? ` ${markClass}` : ""}" data-stage="${esc(stage.id)}" data-format="${kind}" data-line="${esc(stage.line)}" aria-current="${selected ? "step" : "false"}">
          <span class="play-node-kicker">${stage.order} · ${esc(stage.bounds.join(" · "))}${boundary ? " · boundary" : ""}</span>
          <strong>${esc(stage.name)}</strong>
          <span class="play-node-meta">${esc(formatLabel(kind))} · ${esc(stage.tag)}${selected ? " · Selected" : ""}</span>
          ${badgeHtml ? `<span class="play-badges">${badgeHtml}</span>` : ""}
        </button>
      </li>`;
    })
    .join("");
  return `<div class="play-col ${columnClass}">
    <h2>${esc(title)}</h2>
    <p>${esc(note)}</p>
    <ol class="play-lane">${items}</ol>
  </div>`;
}

function banners(map, opts) {
  const blocks = [];
  if (opts.secondApp) {
    blocks.push(`<p class="play-scene"><strong>Second app.</strong> ${esc(quote(map, "a7-mix", "technical", QUOTES[0][2]))} ${esc(quote(map, "a7-mix", "technical", QUOTES[1][2]))} <strong>Offload.</strong> ${esc(quote(map, "b6-offload-thread", "technical", QUOTES[2][2]))}</p>`);
  }
  if (opts.underrun) {
    blocks.push(`<p class="play-scene"><strong>Underrun.</strong> PCM: ${esc(quote(map, "a8-write-hal", "buffers", QUOTES[4][2]))} <strong>Offload.</strong> ${esc(quote(map, "b6-offload-thread", "technical", QUOTES[3][2]))} ${esc(quote(map, "b7-write-drain", "technical", QUOTES[5][2]))}</p>`);
  }
  if (opts.aaos) {
    const focus = map.get("c-focus");
    const duck = map.get("c-duck");
    blocks.push(`<p class="play-scene"><strong>AAOS focus.</strong> ${esc(focus.short)} <strong>Duck.</strong> ${esc(duck.short)} ${esc(quote(map, "c-duck", "technical", QUOTES[6][2]))} <strong>Mute.</strong> ${esc(quote(map, "c-audiocontrol", "technical", QUOTES[7][2]))}</p>`);
  }
  return blocks.join("");
}

function compareList(map) {
  const rows = PAIRS.map(([left, right]) => {
    const a = map.get(left);
    const b = map.get(right);
    return `<li><strong>Different.</strong> PCM · ${esc(a.name)}: ${esc(a.short)} Offload · ${esc(b.name)}: ${esc(b.short)}</li>`;
  });
  for (const id of ONLY_OFFLOAD) {
    const stage = map.get(id);
    rows.push(`<li><strong>Only on offload.</strong> ${esc(stage.name)}: ${esc(stage.short)}</li>`);
  }
  return `<ul class="play-diff">${rows.join("")}</ul>`;
}

export function renderDiagram(data, { pathId, stageId, secondApp = false, underrun = false, aaos = false, compare = false }) {
  const opts = { secondApp, underrun, aaos, compare };
  const path = pathId === "offload" ? data.paths.B : data.paths.A;
  const map = stageMap(data);
  const drawing = data.meta.drawing;
  const offloadNote =
    pathId === "offload" || compare
      ? `<p class="play-unknown"><strong>UNKNOWN.</strong> ${esc(data.paths.B.rareOnAaos)}</p>`
      : "";
  const sample = compare
    ? `${lane(data.paths.A.stages, stageId, data.paths.A.title, data.paths.A.summary, opts, "play-col-a")}
       ${lane(data.paths.B.stages, stageId, data.paths.B.title, data.paths.B.summary, opts, "play-col-b")}`
    : lane(path.stages, stageId, path.title, path.summary, opts, "play-col-path");
  return `<div class="play-legend" aria-label="Legend">
      <span class="play-key is-solid">Solid line · PCM</span>
      <span class="play-key is-compressed">Solid line · compressed</span>
      <span class="play-key is-dashed">Dashed line · control</span>
      <span class="play-key is-boundary">Thick border · boundary</span>
      <span class="play-key is-word">Words mark Different, Underrun, and Duck</span>
    </div>
    <div class="play-above">
    <p class="play-drawing">${esc(drawing.policy)}</p>
    ${offloadNote}
    ${banners(map, opts)}
    ${compare ? compareList(map) : ""}
    </div>
    <div class="play-lanes${compare ? " is-compare" : ""}">
      ${sample}
      ${lane(data.control, stageId, "AAOS control", "Beside the samples. These steps do not carry MP3 or PCM bytes.", opts, "play-col-control")}
    </div>
    <details class="play-more">
      <summary>Corrections and open gaps</summary>
      <ul>${data.corrections
        .map(
          (item) =>
            `<li><strong>${esc(item.tag)}.</strong> ${esc(item.claim)} ${esc(item.correction)}</li>`,
        )
        .join("")}</ul>
      <ul>${data.unknowns.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
    </details>`;
}

function field(term, value) {
  if (!value) return "";
  return `<div class="play-field"><dt>${esc(term)}</dt><dd>${esc(value)}</dd></div>`;
}

export function renderInspector(stage) {
  const kind = formatKind(stage);
  const flag =
    stage.tag === "VERIFIED"
      ? ""
      : `<p class="play-unknown"><strong>${esc(stage.tag)}.</strong> ${esc(stage.limits || stage.versionNotes || stage.ownerNote || stage.short)}</p>`;
  const sources = stage.sources
    .map((source) => {
      const url = String(source.url || "");
      if (!url.startsWith("https://")) return "";
      const where =
        source.kind === "doc" ? "" : `${source.path} · ${source.symbol}`;
      return `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)}</a>${where ? `<span class="play-src">${esc(where)}</span>` : ""}</li>`;
    })
    .join("");
  return `<button type="button" class="play-sheet-close" data-close-sheet>Close details</button>
    <p class="play-node-kicker">${esc(stage.owner)} · ${esc(stage.tag)} · ${esc(formatLabel(kind))}</p>
    <h2 tabindex="-1">${esc(stage.name)}</h2>
    ${stage.ownerNote ? `<p class="play-note">${esc(stage.ownerNote)}</p>` : ""}
    ${flag}
    <p>${esc(stage.short)}</p>
    <p class="play-tech">${esc(stage.technical)}</p>
    <dl class="play-fields">
      ${field("In", stage.inputFormat)}
      ${field("Out", stage.outputFormat)}
      ${field("Process", stage.process)}
      ${field("Places", stage.bounds.join(" · "))}
      ${field("Thread", stage.thread)}
      ${field("Buffers", stage.buffers)}
      ${field("Latency", stage.latency)}
      ${field("Version notes", stage.versionNotes)}
      ${field("Limits", stage.limits)}
    </dl>
    <h3>Sources</h3>
    <ul class="play-sources">${sources}</ul>`;
}
