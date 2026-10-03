import "./styles.css";
import { parseHash, onCleanPath, cleanTarget } from "./lib/dom.js";
import { mountShell, syncNav, closeOverlays } from "./shell.js";
import { pageHome } from "./pages/home.js";
import { pageLearn } from "./pages/learn.js";
import { pageGlossary } from "./pages/glossary.js";
import { pageComing } from "./pages/coming.js";
import { leaveFundamentals, pageFundamentals } from "./pages/fundamentals.js";
import { pageWorkbench } from "./pages/workbench.js";
import { pageArchitecture } from "./pages/architecture.js";
import { pageDebug } from "./pages/debug.js";
import { pageProgression } from "./pages/progression.js";

const LIVE = {
  home: (arg) => pageHome(arg),
  learn: (arg) => pageLearn(arg),
  glossary: (arg) => pageGlossary(arg),
  fundamentals: (arg) => pageFundamentals(arg),
  workbench: (arg) => pageWorkbench(arg),
  architecture: (arg) => pageArchitecture(arg),
  debug: (arg) => pageDebug(arg),
  progression: (arg) => pageProgression(arg),
};

function route() {
  leaveFundamentals();
  mountShell();
  syncNav();
  closeOverlays();
  const { page, arg } = parseHash();
  const live = LIVE[page];
  if (live) {
    live(arg);
    return;
  }
  pageComing(page);
}

// Only "#/..." (or an empty hash) is a route. Plain "#id" fragments (skip link,
// in-page section anchors on clean-path pages) must not re-render the page.
window.addEventListener("hashchange", () => {
  const h = location.hash;
  if (h === "" || h === "#" || h.startsWith("#/")) route();
});

// On prerendered clean-path pages (/learn/06/), turn app hash links into real
// navigations so the address bar never shows /learn/06/#/learn/07.
if (onCleanPath()) {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href^='#/']");
    if (!a) return;
    e.preventDefault();
    location.assign(cleanTarget(a.getAttribute("href")));
  });
}

route();
