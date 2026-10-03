import { esc } from "../lib/dom.js";
import { setMain } from "../shell.js";

export const COMING = {
  debug: {
    phase: 5,
    kicker: "Guided diagnostic engine",
    title: "Debug",
    lede: "Playbooks as a decision tree with service-correct dump snippets.",
    now: [
      { href: "#/learn/19", label: "Module 19 · Debugging methodology" },
      { href: "#/learn/20", label: "Module 20 · Logs, dumps, traces" },
      { href: "#/learn/21", label: "Module 21 · RCA & case studies" },
    ],
    boards: [
      "10 playbooks as a state machine",
      "Mock dumps keyed by service + scenario",
      "5-line RCA export",
      "Classify Android / HAL / AAOS first",
    ],
  },
  workbench: {
    phase: 6,
    kicker: "Dump & RCA labs",
    title: "Dump and RCA labs",
    lede: "Pick a service and a scenario to read a dump; RCA cards follow workbook cases 01–08.",
    now: [
      { href: "#/workbench/dump", label: "Dump lab" },
      { href: "#/workbench/rca", label: "RCA lab" },
      { href: "#/workbench", label: "Calculator" },
    ],
    boards: [
      "Dump lab: service × scenario",
      "RCA lab: labeled evidence vs workbook 01–08",
    ],
  },
  progression: {
    phase: 7,
    kicker: "Engineering ladder",
    title: "Progress",
    lede: "Gates A–H are demonstrations, not rereads. Rank yourself per track.",
    now: [
      { href: "#/progression", label: "Progression" },
      { href: "#/learn/24", label: "Module 24 · Junior to architect" },
    ],
    boards: [
      "Eight gates with evidence tests",
      "Layer × depth skill matrix",
      "Next-module recommendation from the same catalog",
    ],
  },
};

export function pageComing(id) {
  const spec = COMING[id];
  if (!spec) {
    setMain(`<div class="wrap"><h1>Unknown page</h1><p><a href="#/home">Back home</a></p></div>`);
    return;
  }
  setMain(`
    <div class="coming">
      <div class="coming-inner">
        <div class="coming-kicker">
          <span class="coming-kicker-text">${esc(spec.kicker)}</span>
        </div>
        <h1>${esc(spec.title)}</h1>
        <p class="lede">${esc(spec.lede)}</p>
        <div class="coming-grid">
          <section class="card coming-card">
            <h2>What it covers</h2>
            <ul>${spec.boards.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
          </section>
          <section class="card coming-card">
            <h2>Related reading</h2>
            <ul class="coming-links">${spec.now.map((n) => `<li><a href="${n.href}">${esc(n.label)}</a></li>`).join("")}</ul>
          </section>
        </div>
      </div>
    </div>`);
}
