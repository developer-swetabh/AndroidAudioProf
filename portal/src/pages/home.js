import { setMain } from "../shell.js";
import { MODULES } from "../content/catalog.js";
import { TERMS } from "../content/terms.js";

export function pageHome() {
  setMain(`
    <section class="hero">
      <div class="hero-bg" aria-hidden="true">${heroBg()}</div>
      <div class="hero-inner">
        <div class="badge">Android 15 · AOSP &amp; AAOS · Beginner to Architect</div>
        <h1>Android Audio,<br>Completely Demystified.</h1>
        <p class="lede">From your first <code>AudioTrack.play()</code> to actual acoustic energy at a speaker — one catalog, one glossary, and a console that will grow phase by phase.</p>
        <div class="cta-row">
          <a class="btn" href="#/learn">Start Learning →</a>
          <a class="btn-ghost" href="#/glossary">Open Glossary →</a>
        </div>
        <div class="stats wrap stats-home">
          ${stat(MODULES.length, "Modules · one catalog, not two")}
          ${stat(TERMS.length, "Terms · Compare by id, not first word")}
          ${stat(10, "Debug playbooks · live engine")}
          ${stat(8, "Gates A–H · demonstrations")}
        </div>
      </div>
    </section>
    <div class="wrap">
      <h2 class="section-title">Which path are you on?</h2>
      <div class="path-grid">
        <a class="path-card" href="#/learn/00"><div class="path-ico">01</div><h3>Student</h3><p>Module 00, then the Fundamentals studio, then climb the catalog. Rank yourself on Progression.</p></a>
        <a class="path-card" href="#/debug"><div class="path-ico">02</div><h3>Engineer on a bug</h3><p>Capture Flinger, Policy, Perfetto, QXDM — then kill tests. Practice the same dumps on Workbench.</p></a>
        <a class="path-card" href="#/fundamentals"><div class="path-ico">03</div><h3>PCM first</h3><p>Rate, frames, bit depth, offload — live studio. Same math as the calculator.</p></a>
        <a class="path-card" href="#/architecture/xml"><div class="path-ico">04</div><h3>Automotive</h3><p>car XML → bus address → mix. Pipeline for PCM. Config studio for the files that built the buses.</p></a>
      </div>

      <div class="phase-note">
        <h2>What is live in Phase 9</h2>
        <ul>
          <li><strong>Lifecycle studio</strong> — createTrack vs play(), MixerThread period (Fast/Direct/Offload picker), two-bus vs shared, two STANDBYs, Policy room. Module 06 binds it. Fundamentals still has the four threads.</li>
          <li><strong>Config studio</strong> — car XML, fade XML, policy ports, CAP, flags, mixer_paths.</li>
          <li><strong>Progression</strong> — gates A–H. Rank per track.</li>
          <li><strong>Workbench / Debug</strong> — dump lab, RCA 01–08, 10 playbooks.</li>
        </ul>
      </div>
    </div>`);

  document.querySelectorAll(".stat-card .n").forEach((el) => countUp(el, +el.dataset.n));
}

function stat(n, l) {
  return `<article class="stat-card"><div class="n" data-n="${n}">0</div><div class="l">${l}</div></article>`;
}

function countUp(el, to) {
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / 600);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function heroBg() {
  return `<svg viewBox="0 0 1200 700" preserveAspectRatio="none">
    <defs>
      <radialGradient id="halo" cx="50%" cy="38%">
        <stop offset="0%" stop-color="#00E5FF" stop-opacity="0.2"/>
        <stop offset="45%" stop-color="#C084FC" stop-opacity="0.1"/>
        <stop offset="100%" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="700" fill="url(#halo)"/>
    <g class="grid-dots" fill="rgba(255,255,255,0.07)">
      ${Array.from({ length: 90 }, (_, i) => `<circle cx="${(i * 97) % 1200}" cy="${(i * 53) % 700}" r="1.15"/>`).join("")}
    </g>
    <path fill="none" stroke="#00E5FF" stroke-opacity="0.4" stroke-width="1.6"
      d="M0 360 Q 150 300 300 360 T 600 360 T 900 360 T 1200 360">
      <animate attributeName="d" dur="8s" repeatCount="indefinite"
        values="M0 360 Q 150 300 300 360 T 600 360 T 900 360 T 1200 360;
                M0 360 Q 150 420 300 360 T 600 360 T 900 360 T 1200 360;
                M0 360 Q 150 300 300 360 T 600 360 T 900 360 T 1200 360"/>
    </path>
    <path fill="none" stroke="#C084FC" stroke-opacity="0.25" stroke-width="1.2"
      d="M0 410 Q 150 450 300 410 T 600 410 T 900 410 T 1200 410">
      <animate attributeName="d" dur="11s" repeatCount="indefinite"
        values="M0 410 Q 150 450 300 410 T 600 410 T 900 410 T 1200 410;
                M0 410 Q 150 360 300 410 T 600 410 T 900 410 T 1200 410;
                M0 410 Q 150 450 300 410 T 600 410 T 900 410 T 1200 410"/>
    </path>
  </svg>`;
}
