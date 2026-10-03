import { $, $$, copy, go, parseHash } from "./lib/dom.js";
import { load, save } from "./lib/storage.js";
import { MODULES } from "./content/catalog.js";
import { NAV, shellHtml } from "./shellMarkup.js";

export { NAV };

/** Search data is only needed once the palette opens; keep it out of the boot bundle. */
let paletteData = null;
function loadPaletteData() {
  paletteData ??= Promise.all([
    import("./content/terms.js"),
    import("./content/dumpLab.js"),
    import("./content/rcaCases.js"),
    import("./content/gates.js"),
    import("./content/xmlFiles.js"),
    import("./content/lifecycle.js"),
  ]).then(([t, d, r, g, x, l]) => ({
    TERMS: t.TERMS,
    DUMP_SCENARIOS: d.DUMP_SCENARIOS,
    RCA_CASES: r.RCA_CASES,
    GATES: g.GATES,
    XML_FILES: x.XML_FILES,
    LIFE_SCENES: l.LIFE_SCENES,
  }));
  return paletteData;
}

const COMMANDS = `adb shell dumpsys media.audio_flinger
adb shell dumpsys media.audio_policy
adb shell dumpsys audio
adb shell dumpsys car_service --services CarAudioService
adb shell cat /proc/asound/pcm
adb logcat -b main,system,crash -v threadtime`;

let mounted = false;

// Set by scripts/prerender.mjs on static entry pages: <div id="app" data-prerendered="home|learn/06">.
let prerendered = document.getElementById("app")?.dataset.prerendered || "";
// The static shell (banner, nav, footer) is reused as-is on boot instead of re-rendered,
// so the first-painted nodes stay on screen (no flash, no new LCP candidate).
const staticShell = Boolean(prerendered) && Boolean(document.querySelector("#app .app-nav"));

/** True once, on boot, if the static HTML already shows `key`. */
export function consumePrerendered(key) {
  const hit = prerendered === key;
  prerendered = "";
  return hit;
}

/** Saved choice wins; otherwise follow the OS setting on first visit. */
export function currentTheme() {
  const saved = load().theme;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme() {
  const theme = currentTheme();
  document.documentElement.dataset.theme = theme;
  const btn = $("#themeBtn");
  if (btn) {
    btn.textContent = theme === "light" ? "☾" : "☀";
    btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
  }
}

export function mountShell() {
  if (mounted) return;
  mounted = true;
  const app = $("#app");
  if (!staticShell) app.innerHTML = shellHtml({ page: parseHash().page });


  $("#themeBtn").onclick = () => {
    save({ theme: currentTheme() === "dark" ? "light" : "dark" });
    applyTheme();
    // Only re-theme diagrams if the markdown chunk is already in use.
    if (document.querySelector(".mermaid-live[data-src]")) {
      import("./lib/markdown.js").then((m) => m.rethemeMermaid()).catch(() => {});
    }
  };
  $("#searchBtn").onclick = openPalette;
  $("#cmdBtn").onclick = toggleCmds;
  $("#menuBtn").onclick = () => {
    const open = $("#navLinks").classList.toggle("open");
    $("#menuBtn").setAttribute("aria-expanded", open ? "true" : "false");
  };
  $("#navLinks").addEventListener("click", (e) => {
    if (e.target.closest("a")) $("#navLinks").classList.remove("open");
  });

  applyTheme();
  syncNav();
}

export function syncNav() {
  const { page } = parseHash();
  $$("#navLinks [data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === page);
  });
}

export function setMain(html, { animate = true } = {}) {
  const main = $("#app-main");
  main.innerHTML = html;
  if (!animate) return;
  main.classList.remove("page");
  void main.offsetWidth;
  main.classList.add("page");
}

export async function openPalette() {
  closeOverlays();
  const { TERMS, DUMP_SCENARIOS, RCA_CASES, GATES, XML_FILES, LIFE_SCENES } = await loadPaletteData();
  closeOverlays();
  const items = [
    ...NAV.map((n) => ({ t: `Go to ${n.label}`, h: n.id, k: "page" })),
    ...MODULES.map((m) => ({ t: `Module ${m.id}: ${m.title}`, h: `learn/${m.id}`, k: "learn" })),
    ...DUMP_SCENARIOS.map((s) => ({ t: `Dump: ${s.name}`, h: `workbench/dump/flinger/${s.id}`, k: "dump" })),
    ...RCA_CASES.map((c) => ({ t: `RCA ${c.id}: ${c.title}`, h: `workbench/rca/${c.id}`, k: "rca" })),
    ...GATES.map((g) => ({ t: `Gate ${g.id}: ${g.title}`, h: `progression/${g.id}`, k: "gate" })),
    ...XML_FILES.map((x) => ({ t: `XML: ${x.file}`, h: `architecture/xml/${x.id}`, k: "xml" })),
    ...LIFE_SCENES.map((s) => ({ t: `Lifecycle: ${s.name}`, h: `architecture/life/${s.id}`, k: "life" })),
    ...TERMS.map((t) => ({ t: `Term: ${t.name}`, h: `glossary/${t.id}`, k: "glossary" })),
  ];
  const el = document.createElement("div");
  el.className = "overlay";
  el.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="Search">
    <input id="pin" placeholder="Jump to a page, module, or term…" autocomplete="off" aria-label="Search pages, modules and terms" />
    <div id="plist"></div>
  </div>`;
  document.body.appendChild(el);
  const pin = $("#pin");
  let sel = 0;
  const draw = () => {
    const q = pin.value.toLowerCase().trim();
    const hit = items.filter((i) => i.t.toLowerCase().includes(q)).slice(0, 14);
    $("#plist").innerHTML = hit
      .map(
        (i, n) =>
          `<button type="button" class="palette-item ${n === sel ? "active" : ""}" data-h="${i.h}"><span class="palette-k">${i.k}</span>${i.t}</button>`,
      )
      .join("") || `<p class="palette-empty">No matches.</p>`;
    $$("#plist [data-h]").forEach((n) => {
      n.onclick = () => {
        go(n.dataset.h);
        el.remove();
      };
    });
  };
  pin.oninput = () => {
    sel = 0;
    draw();
  };
  pin.onkeydown = (e) => {
    const rows = $$(".palette-item");
    if (e.key === "ArrowDown") {
      sel = Math.min(rows.length - 1, sel + 1);
      draw();
      e.preventDefault();
    }
    if (e.key === "ArrowUp") {
      sel = Math.max(0, sel - 1);
      draw();
      e.preventDefault();
    }
    if (e.key === "Enter") rows[sel]?.click();
    if (e.key === "Escape") el.remove();

  };
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") el.remove();
    if (e.key !== "Tab") return;
    // Keep focus inside the dialog.
    const f = [pin, ...$$(".palette-item")];
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
  });
  el.onclick = (e) => {
    if (e.target === el) el.remove();
  };
  pin.focus();
  draw();
}

function toggleCmds() {
  const d = $("#dock");
  if (d.dataset.open) {
    d.innerHTML = "";
    delete d.dataset.open;
    return;
  }
  d.dataset.open = "1";
  d.innerHTML = `<div class="cmd-panel card"><strong>Quick commands</strong>
    <pre class="term">${COMMANDS}</pre>
    <button class="btn" id="cpc" type="button">Copy all</button></div>`;
  $("#cpc").onclick = () => copy(COMMANDS);
}

export function closeOverlays() {
  $$(".overlay").forEach((n) => n.remove());
}

export function openModal(html, { label = "Dialog" } = {}) {
  closeOverlays();
  const el = document.createElement("div");
  el.className = "overlay";
  el.innerHTML = `<div class="modal" role="dialog" aria-label="${label}">${html}<div class="modal-actions"><button class="btn" type="button" data-close>Close</button></div></div>`;
  document.body.appendChild(el);
  el.querySelector("[data-close]").onclick = () => el.remove();
  el.onclick = (e) => {
    if (e.target === el) el.remove();
  };
  return el;
}

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openPalette();
  }
  if (e.key === "Escape") closeOverlays();
});
