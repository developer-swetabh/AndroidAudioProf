import { esc } from "./dom.js";

const STATE = /\b(ACTIVE|STANDBY|ERROR|XRUN|PAUSED|IDLE|DRAINING|RUNNING|PREPARED|OPEN|SETUP)\b/g;

export function colorDump(text, { guns = [], notes = [], annotate = false, hints = false } = {}) {
  const lines = String(text ?? "").split("\n");
  return lines
    .map((line, i) => {
      const gun = hints && guns.some((g) => g && line.includes(g));
      const html = paintTokens(esc(line));
      const note = annotate ? notes.find((n) => n.match && line.includes(n.match)) : null;
      return `<div class="dl-line${gun ? " is-gun" : ""}" style="--i:${i}">${html || "&nbsp;"}${
        note ? `<span class="dl-callout">${esc(note.label)}</span>` : ""
      }</div>`;
    })
    .join("");
}

function paintTokens(html) {
  return html
    .replace(STATE, (_, s) => `<span class="dl-st dl-${s.toLowerCase()}">${s}</span>`)
    .replace(/\b(bus\d+[\w]*|BUS\d+[\w]*)\b/g, `<span class="dl-addr">$1</span>`)
    .replace(/\b(AUDIO_DEVICE_OUT_[\w]+)\b/g, `<span class="dl-addr">$1</span>`)
    .replace(/\b(usage=[\w]+)/gi, `<span class="dl-usage">$1</span>`)
    .replace(/\b(AUDIO_USAGE_[\w]+)/g, `<span class="dl-usage">$1</span>`)
    .replace(/\b(USAGE_[\w]+)/g, `<span class="dl-usage">$1</span>`)
    .replace(/\b(vol=[\d.]+)/g, `<span class="dl-vol">$1</span>`)
    .replace(/(←[^<]*)/g, `<span class="dl-comment">$1</span>`);
}

export function colorXml(text) {
  return String(text ?? "")
    .split("\n")
    .map((line, i) => {
      let html = esc(line);
      html = html.replace(/(&lt;\/?[\w:-]+)/g, `<span class="xml-tag">$1</span>`);
      html = html.replace(/\b(bus[\w]*)\b/g, `<span class="dl-addr">$1</span>`);
      html = html.replace(/\b(AUDIO_USAGE_[\w]+)/g, `<span class="dl-usage">$1</span>`);
      html = html.replace(/(←[^<]*)/g, `<span class="dl-comment">$1</span>`);
      html = html.replace(/^(\s*)(#.*)$/g, `$1<span class="dl-comment">$2</span>`);
      return `<div class="dl-line" style="--i:${i}">${html || "&nbsp;"}</div>`;
    })
    .join("");
}
