/**
 * Pure markup for the app chrome. Shared by the browser (shell.js) and the
 * build-time prerender (scripts/prerender.mjs) so the static HTML and the
 * hydrated page are identical and nothing shifts when the app boots.
 * No DOM access here.
 */
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

export function navLinksHtml(page = "") {
  return NAV.map(
    (n) => `<a href="#/${n.id}" data-nav="${n.id}"${n.id === page ? ' class="active"' : ""}>${n.label}</a>`,
  ).join("");
}

export function shellHtml({ page = "", mainHtml = "" } = {}) {
  return `
    <div class="version-banner" role="note">
      <span>Course targets <strong>Android 15</strong> · AIDL Core HAL · AAOS car config v4</span>
      <span class="banner-sep" aria-hidden="true">·</span>
      <a href="#/learn/23">Other versions / HIDL? Classification guide →</a>
    </div>
    <header class="app-nav">
      <a class="brand" href="#/home" aria-label="Audio Architect home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-text">Audio Architect</span>
      </a>
      <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false">☰</button>
      <nav class="nav-links" id="navLinks" aria-label="Primary">${navLinksHtml(page)}</nav>
      <div class="nav-actions">
        <button class="icon-btn" id="searchBtn" type="button" aria-label="Search (Ctrl+K)">⌘K</button>
        <button class="icon-btn" id="themeBtn" type="button" aria-label="Switch to light theme" aria-pressed="false">☀</button>
        <button class="icon-btn" id="cmdBtn" type="button" aria-label="Quick commands">$_</button>
      </div>
    </header>
    <main id="app-main" tabindex="-1">${mainHtml}</main>
    <footer class="site-sig" role="contentinfo">
      Created by <strong>Swetabh Suman</strong> ·
      <a href="https://github.com/developer-swetabh/AndroidAudioProf" rel="noopener">Source on GitHub</a> ·
      <a href="https://github.com/developer-swetabh/AndroidAudioProf/issues/new?title=Erratum:%20" rel="noopener">Report an error</a> ·
      <a href="https://github.com/developer-swetabh/AndroidAudioProf/blob/main/LICENSE" rel="noopener">MIT License</a>
    </footer>
    <div class="cmd-dock" id="dock"></div>
  `;
}
