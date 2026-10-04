import "./styles.css";
import { parseHash, onCleanPath, cleanTarget } from "./lib/dom.js";
import { mountShell, syncNav, closeOverlays } from "./shell.js";
import { pageComing } from "./pages/coming.js";
import { trackHashPageview, trackScrollDepth } from "./lib/analytics.js";

// Each section's code is a separate chunk, fetched the first time it is opened.
const LIVE = {
  home: () => import("./pages/home.js").then((m) => m.pageHome),
  learn: () => import("./pages/learn.js").then((m) => m.pageLearn),
  glossary: () => import("./pages/glossary.js").then((m) => m.pageGlossary),
  fundamentals: () => import("./pages/fundamentals.js").then((m) => m.pageFundamentals),
  workbench: () => import("./pages/workbench.js").then((m) => m.pageWorkbench),
  architecture: () => import("./pages/architecture.js").then((m) => m.pageArchitecture),
  debug: () => import("./pages/debug.js").then((m) => m.pageDebug),
  progression: () => import("./pages/progression.js").then((m) => m.pageProgression),
};

let fundamentals = null; // loaded module, so we can stop its animation loop on leave
let routeSeq = 0;

async function route() {
  const seq = ++routeSeq;
  fundamentals?.leaveFundamentals();
  const { page, arg } = parseHash();
  const load = LIVE[page];
  if (!load) {
    mountShell();
    syncNav();
    closeOverlays();
    pageComing(page);
    return;
  }
  let render;
  try {
    render = await load();
    if (page === "fundamentals") fundamentals = await import("./pages/fundamentals.js");
  } catch {
    // A stale chunk after a deploy: one full reload fetches the new build.
    if (!sessionStorage.getItem("aaep.chunkReload")) {
      sessionStorage.setItem("aaep.chunkReload", "1");
      location.reload();
      return;
    }
    mountShell();
    pageComing(page);
    return;
  }
  sessionStorage.removeItem("aaep.chunkReload");
  if (seq !== routeSeq) return;
  // Mount after the chunk arrives so prerendered HTML stays on screen meanwhile.
  mountShell();
  syncNav();
  closeOverlays();
  render(arg);
  trackScrollDepth(arg ? `${page}/${arg.split("/")[0]}` : page);
}

// Only "#/..." (or an empty hash) is a route. Plain "#id" fragments (skip link,
// in-page section anchors on clean-path pages) must not re-render the page.
window.addEventListener("hashchange", () => {
  const h = location.hash;
  if (h === "" || h === "#" || h.startsWith("#/")) {
    route();
    trackHashPageview();
  }
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
