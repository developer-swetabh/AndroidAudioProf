import { esc } from "../lib/dom.js";
import { setMain } from "../shell.js";
import { TRACKS } from "../content/catalog.js";
import spec from "../content/aaos-playback-paths.json";
import { renderDiagram } from "../diagrams/playbackPath.js";

const HOME_STAGE = "a1-player-service";

export function pageHome() {
  const diagram = renderDiagram(spec, { pathId: "pcm", stageId: HOME_STAGE });
  setMain(`
    <div class="home">
      <header class="home-open">
        <h1>${esc(spec.meta.title)}</h1>
        <p class="home-sentence">${esc(spec.meta.player)}</p>
        <div class="home-actions">
          <a class="btn" href="#/learn">Start learning</a>
          <a class="btn-ghost" href="#/workbench">Open a dump</a>
        </div>
      </header>
      <section class="home-walk" aria-label="${esc(spec.meta.title)}">
        ${diagram}
      </section>
      <section class="home-catalog" aria-label="Catalog">
        <h2>Catalog</h2>
        ${TRACKS.map(
          (track) => `
          <section class="catalog-track">
            <h3>${esc(track.title)}</h3>
            <ol>
              ${track.modules
                .map(
                  (mod) => `<li>
                    <a href="#/learn/${mod.id}"><span class="mod-id">${esc(mod.id)}</span>${esc(mod.title)}</a>
                    <span class="mins">${mod.mins} min</span>
                  </li>`,
                )
                .join("")}
            </ol>
          </section>`,
        ).join("")}
      </section>
      <section class="phase-note">
        <h2>What is live in Phase 9</h2>
        <ul>
          <li><strong>Lifecycle studio</strong> — createTrack vs play(), MixerThread period (Fast/Direct/Offload picker), two-bus vs shared, two STANDBYs, Policy room. Module 06 binds it. Fundamentals still has the four threads.</li>
          <li><strong>File to speaker</strong> — <a href="#/architecture/play">MP3 to the speaker</a> on Android 15 <code>android15-release</code>. Play walks one sample stage at a time. The wait is illustrative, not real latency.</li>
          <li><strong>Config studio</strong> — car XML, fade XML, policy ports, CAP, flags, mixer_paths.</li>
          <li><strong>Progression</strong> — gates A–H. Rank per track.</li>
          <li><strong>Workbench / Debug</strong> — dump lab, RCA 01–08, 10 playbooks.</li>
        </ul>
      </section>
    </div>`);

  document.querySelectorAll(".home-walk [data-stage]").forEach((node) => {
    node.addEventListener("click", () => {
      location.hash = `#/architecture/play/${node.dataset.stage}`;
    });
  });
}
