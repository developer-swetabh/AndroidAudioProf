import "./styles.css";
import { parseHash } from "./lib/dom.js";
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

window.addEventListener("hashchange", route);
route();
