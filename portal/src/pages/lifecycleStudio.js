import { $ } from "../lib/dom.js";
import { setMain } from "../shell.js";
import { LIFE_SCENES, getLifeScene, parseLifeArg, stepsFor } from "../content/lifecycle.js";
import { mountLifecycleStudio } from "../diagrams/lifecycle.js";

export function pageLifecycleStudio(arg = "") {
  const parsed = parseLifeArg(arg);
  const scene = parsed.scene;
  const stepId = parsed.stepId || stepsFor(scene)[0].id;
  const want = `#/architecture/life/${scene}/${stepId}`;
  if (location.hash !== want) history.replaceState(null, "", want);

  const sc = getLifeScene(scene);
  setMain(`
    <div class="wrap lc-page" data-life-scene="${scene}" data-life-step="${stepId}">
      <div class="wb-head">
        <div>
          <div class="badge">Phase 9 · Lifecycle studio</div>
          <h1>Inside the period</h1>
          <p class="lede">Construction already routes. <code>play()</code> starts the thread. Direct/Offload skip AudioMixer, not Flinger. Two buses can HW-duck; one PCM cannot. Flinger software standby is not <code>StreamDescriptor</code> STANDBY.</p>
        </div>
        <p class="learn-related">
          <a class="btn-ghost" href="#/architecture">Pipeline</a>
          <a class="btn-ghost" href="#/learn/06">Module 06</a>
          <a class="btn-ghost" href="#/learn/02a">Walkthrough 02a</a>
          <a class="btn-ghost" href="#/fundamentals">Threads</a>
        </p>
      </div>
      <div class="wb-tabs">
        ${LIFE_SCENES.map(
          (s) =>
            `<a href="#/architecture/life/${s.id}" class="${s.id === scene ? "active" : ""}">${s.name}</a>`,
        ).join("")}
      </div>
      <section class="card lc-board">
        <p class="muted lc-blurb">${sc.blurb} · ${sc.product}. Click a hop, or focus the board and use ← → / j k.</p>
        <div id="lcStudio"></div>
      </section>
    </div>`);

  const host = $("#lcStudio");
  const studio = mountLifecycleStudio(host, { scene, stepId, compact: false });
  studio.onStep((sceneId, id) => {
    const next = `#/architecture/life/${sceneId}/${id}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  });
  host.focus({ preventScroll: true });
}
