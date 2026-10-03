import { $, $$, copy, go, parseHash } from "./lib/dom.js";
import { load, save } from "./lib/storage.js";
import { MODULES } from "./content/catalog.js";
import { TERMS } from "./content/terms.js";
import { DUMP_SCENARIOS } from "./content/dumpLab.js";
import { RCA_CASES } from "./content/rcaCases.js";
import { GATES } from "./content/gates.js";
import { rethemeMermaid } from "./lib/markdown.js";
import { XML_FILES } from "./content/xmlFiles.js";
import { LIFE_SCENES } from "./content/lifecycle.js";

export const NAV = [
  { id: "home", label: "Home" },
  { id: "fundamentals", label: "Fundamentals" },
  { id: "architecture", label: "Architecture" },
  { id: "learn", label: "Learn" },
  { id: "debug", label: "Debug" },
  { id: "workbench", label: "Workbench" },
  { id: "glossary", label: "Glossary" },
  { id: "progression", label: "Progress" },
];

const COMMANDS = `adb shell dumpsys media.audio_flinger
adb shell dumpsys media.audio_policy
adb shell dumpsys audio
adb shell dumpsys car_service --services CarAudioService
adb shell cat /proc/asound/pcm
adb logcat -b main,system,crash -v threadtime`;

let mounted = false;

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
  app.innerHTML = `
    <div class="version-banner" role="note">
      <span>Course targets <strong>Android 15</strong> · AIDL Core HAL · AAOS car config v4</span>
      <span class="banner-sep" aria-hidden="true">·</span>
      <a href="#/learn/23">Other versions / HIDL? Classification guide →</a>
    </div>
    <header class="app-nav">
      <a class="brand" href="#/home" aria-label="Home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-text">Audio Architect</span>
      </a>
      <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false">☰</button>
      <nav class="nav-links" id="navLinks" aria-label="Primary"></nav>
      <div class="nav-actions">
        <button class="icon-btn" id="searchBtn" type="button" aria-label="Search (Ctrl+K)">⌘K</button>
        <button class="icon-btn" id="themeBtn" type="button" aria-label="Switch to light theme" aria-pressed="false">☀</button>
        <button class="icon-btn" id="cmdBtn" type="button" aria-label="Quick commands">$_</button>
      </div>
    </header>
    <main id="app-main" class="page" tabindex="-1"></main>
    <footer class="site-sig" role="contentinfo">
      Created by <strong>Swetabh Suman</strong> ·
      <a href="https://github.com/developer-swetabh/AndroidAudioProf" rel="noopener">Source on GitHub</a> ·
      <a href="https://github.com/developer-swetabh/AndroidAudioProf/issues/new?title=Erratum:%20" rel="noopener">Report an error</a> ·
      <a href="https://github.com/developer-swetabh/AndroidAudioProf/blob/main/LICENSE" rel="noopener">MIT License</a>
    </footer>
    <div class="cmd-dock" id="dock"></div>
  `;

  $("#navLinks").innerHTML = NAV.map(
    (n) => `<a href="#/${n.id}" data-nav="${n.id}">${n.label}</a>`,
  ).join("");

  $("#themeBtn").onclick = () => {
    save({ theme: currentTheme() === "dark" ? "light" : "dark" });
    applyTheme();
    rethemeMermaid().catch(() => {});
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

export function setMain(html) {
  const main = $("#app-main");
  main.classList.remove("page");
  main.innerHTML = html;
  void main.offsetWidth;
  main.classList.add("page");
}

export function openPalette() {
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
