import { $, esc } from "../lib/dom.js";
import { setMain } from "../shell.js";
import spec from "../content/aaos-playback-paths.json";
import {
  renderDiagram,
  renderInspector,
  resolveStageId,
  stageIndex,
} from "../diagrams/playbackPath.js";

const index = stageIndex(spec);
const mobileQuery = "(max-width: 800px)";
const STEP_MS = 1400;
let sheetSync = null;
let stopPage = null;

if (typeof window !== "undefined") {
  window.matchMedia(mobileQuery).addEventListener("change", () => sheetSync?.());
}

export function pagePlaybackStudio(arg = "") {
  stopPage?.();
  const stop = new AbortController();
  let timer = null;
  stopPage = () => {
    if (timer) clearInterval(timer);
    stop.abort();
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stageId = resolveStageId(spec, arg);
  let pathId = index.get(stageId).lane === "offload" ? "offload" : "pcm";
  let cursor = 0;
  let playing = false;
  let speed = 1;
  let sheetOpen = false;
  let secondApp = false;
  let underrun = false;
  let aaos = false;
  let compare = false;

  const stages = () => (pathId === "offload" ? spec.paths.B.stages : spec.paths.A.stages);
  const found = stages().findIndex((stage) => stage.id === stageId);
  if (found >= 0) cursor = found;

  const note = reduceMotion
    ? "Illustrative, not to scale. Reduced motion is on, so this stays paused until you press Play. Arrow keys step one stage."
    : "Illustrative, not to scale. The wait between stages is not real latency. Arrow keys step one stage.";

  setMain(`
    <div class="play-page">
      <header class="play-head">
        <div>
          <p class="play-node-kicker">${esc(spec.meta.target)} · ${esc(spec.meta.branch)}</p>
          <h1>${esc(spec.meta.title)}</h1>
          <p class="play-note">${esc(spec.meta.player)}</p>
        </div>
        <div class="play-head-actions">
          <div class="play-scenes" role="group" aria-label="Scenarios">
            <button type="button" id="playSecond" aria-pressed="false">Second app</button>
            <button type="button" id="playUnderrun" aria-pressed="false">Underrun</button>
            <button type="button" id="playAaos" aria-pressed="false">AAOS focus</button>
            <button type="button" id="playCompare" aria-pressed="false">Compare paths</button>
          </div>
          <div class="play-switch" id="playPaths" role="group" aria-label="Sample path">
            <button type="button" data-path="pcm" aria-pressed="true">PCM path</button>
            <button type="button" data-path="offload" aria-pressed="false">Offload path</button>
          </div>
          <p class="learn-related">
            <a class="btn-ghost" href="#/architecture">Pipeline</a>
            <a class="btn-ghost" href="#/architecture/life">Lifecycle</a>
            <a class="btn-ghost" href="#/learn/02a">Walkthrough 02a</a>
          </p>
        </div>
      </header>
      <section class="play-diagram" id="playDiagram" tabindex="0" aria-label="Playback stages"></section>
      <button type="button" class="play-details-btn" id="playDetails" aria-controls="playInspector" aria-expanded="false">Details</button>
      <aside class="play-inspector" id="playInspector"></aside>
      <footer class="play-transport" aria-describedby="playTransportNote">
        <p id="playTransportNote">${esc(note)}</p>
        <div class="play-transport-row">
          <button type="button" id="playToggle" aria-pressed="false">Play</button>
          <button type="button" id="playBack">Step back</button>
          <button type="button" id="playForward">Step forward</button>
          <label>Speed
            <select id="playSpeed">
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="2">2×</option>
            </select>
          </label>
          <button type="button" id="playReset">Reset</button>
          <label class="play-progress">Progress
            <progress id="playProgress" max="1" value="0"></progress>
            <span id="playProgressText" aria-live="polite"></span>
          </label>
          <label class="play-scrub">Scrub
            <input id="playScrub" type="range" min="0" max="1" value="0" aria-label="Scrub the sample path" />
          </label>
        </div>
      </footer>
    </div>`);

  const root = $("#app-main");

  const syncHash = () => {
    const want = `#/architecture/play/${stageId}`;
    if (location.hash !== want) history.replaceState(null, "", want);
  };

  const syncSheet = () => {
    const inspector = $("#playInspector");
    const button = $("#playDetails");
    if (!inspector || !button) return;
    const mobile = window.matchMedia(mobileQuery).matches;
    const open = sheetOpen && mobile;
    inspector.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", sheetOpen ? "true" : "false");
    if (mobile && !sheetOpen) inspector.setAttribute("inert", "");
    else inspector.removeAttribute("inert");
  };
  sheetSync = syncSheet;

  const clearTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const pause = () => {
    playing = false;
    clearTimer();
  };

  const syncTransport = () => {
    const list = stages();
    const toggle = $("#playToggle");
    if (!toggle) return;
    toggle.textContent = playing ? "Pause" : "Play";
    toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    const progress = $("#playProgress");
    progress.max = Math.max(1, list.length - 1);
    progress.value = cursor;
    const scrub = $("#playScrub");
    scrub.max = String(list.length - 1);
    scrub.value = String(cursor);
    scrub.setAttribute("aria-valuetext", list[cursor]?.name || "");
    const onPath = list[cursor]?.id === stageId;
    $("#playProgressText").textContent = onPath
      ? `${cursor + 1} of ${list.length}`
      : `${cursor + 1} of ${list.length} · control step open`;
  };

  const paint = ({ focusId = "", scroll = "node" } = {}) => {
    if (!root.querySelector(".play-page")) return;
    const hit = index.get(stageId);
    $("#playDiagram").innerHTML = renderDiagram(spec, {
      pathId,
      stageId,
      secondApp,
      underrun,
      aaos,
      compare,
    });
    $("#playInspector").innerHTML = renderInspector(hit.stage);
    $("#playDetails").textContent = `Details · ${hit.stage.name}`;
    root.querySelectorAll("[data-path]").forEach((button) => {
      const on = button.dataset.path === pathId;
      const label = button.dataset.path === "offload" ? "Offload path" : "PCM path";
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.textContent = on ? `${label} · selected` : label;
    });
    const scenes = [
      ["#playSecond", secondApp, "Second app"],
      ["#playUnderrun", underrun, "Underrun"],
      ["#playAaos", aaos, "AAOS focus"],
      ["#playCompare", compare, "Compare paths"],
    ];
    for (const [id, on, label] of scenes) {
      const button = $(id);
      if (!button) continue;
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.textContent = on ? `${label} · on` : label;
    }
    $("#playPaths")?.setAttribute("aria-label", compare ? "Which path Play walks" : "Sample path");
    syncTransport();
    syncHash();
    syncSheet();
    if (scroll === "banner") {
      root.querySelector(".play-scene, .play-diff")?.scrollIntoView({ block: "nearest" });
    }
    root.querySelector(".play-node.is-sel")?.scrollIntoView({ block: "nearest" });
    if (focusId) root.querySelector(`[data-stage="${CSS.escape(focusId)}"]`)?.focus();
  };

  const arm = () => {
    clearTimer();
    timer = setInterval(() => {
      const list = stages();
      if (cursor >= list.length - 1) {
        pause();
        paint();
        return;
      }
      cursor += 1;
      stageId = list[cursor].id;
      if (cursor >= list.length - 1) playing = false;
      paint();
      if (!playing) clearTimer();
    }, STEP_MS / speed);
  };

  const play = () => {
    const list = stages();
    const onPath = list[cursor]?.id === stageId;
    if (!onPath) {
      stageId = list[cursor].id;
      if (cursor >= list.length - 1) {
        playing = false;
        paint();
        return;
      }
    } else if (cursor >= list.length - 1) {
      cursor = 0;
      stageId = list[0].id;
    }
    playing = true;
    paint();
    arm();
  };

  const step = (dir, focus) => {
    pause();
    const list = stages();
    if (list[cursor]?.id !== stageId) stageId = list[cursor].id;
    else {
      cursor = Math.min(list.length - 1, Math.max(0, cursor + dir));
      stageId = list[cursor].id;
    }
    paint({ focusId: focus ? stageId : "" });
  };

  $("#playToggle").onclick = () => {
    if (playing) {
      pause();
      paint();
      return;
    }
    play();
  };
  $("#playBack").onclick = () => step(-1, false);
  $("#playForward").onclick = () => step(1, false);
  $("#playReset").onclick = () => {
    pause();
    cursor = 0;
    stageId = stages()[0].id;
    paint();
  };
  $("#playSpeed").onchange = () => {
    speed = Number($("#playSpeed").value) || 1;
    if (playing) arm();
  };
  $("#playScrub").oninput = () => {
    pause();
    cursor = Number($("#playScrub").value);
    stageId = stages()[cursor].id;
    paint();
  };

  const goStage = (id, moveCursor) => {
    const hit = index.get(id);
    if (!hit) return;
    stageId = id;
    if (!moveCursor) return;
    if (hit.lane === "pcm" || hit.lane === "offload") {
      pathId = hit.lane;
      cursor = stages().findIndex((stage) => stage.id === id);
    }
  };

  const toggleScene = (key) => {
    pause();
    if (key === "second") {
      secondApp = !secondApp;
      if (secondApp) goStage(pathId === "offload" ? "b6-offload-thread" : "a7-mix", true);
    } else if (key === "underrun") {
      underrun = !underrun;
      if (underrun) goStage(pathId === "offload" ? "b7-write-drain" : "a8-write-hal", true);
    } else if (key === "aaos") {
      aaos = !aaos;
      if (aaos) goStage("c-focus", false);
    } else if (key === "compare") {
      compare = !compare;
    }
    paint({ scroll: "banner" });
  };

  $("#playSecond").onclick = () => toggleScene("second");
  $("#playUnderrun").onclick = () => toggleScene("underrun");
  $("#playAaos").onclick = () => toggleScene("aaos");
  $("#playCompare").onclick = () => toggleScene("compare");

  $("#playDiagram").addEventListener("keydown", (event) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === "ArrowRight") {
      step(1, true);
      event.preventDefault();
    } else if (event.key === "ArrowLeft") {
      step(-1, true);
      event.preventDefault();
    } else if (event.key === "Home") {
      pause();
      cursor = 0;
      stageId = stages()[0].id;
      paint({ focusId: stageId });
      event.preventDefault();
    } else if (event.key === "End") {
      pause();
      cursor = stages().length - 1;
      stageId = stages()[cursor].id;
      paint({ focusId: stageId });
      event.preventDefault();
    } else if (event.key === " " && event.target.id === "playDiagram") {
      if (playing) {
        pause();
        paint();
      } else play();
      event.preventDefault();
    }
  }, { signal: stop.signal });

  root.addEventListener("click", (event) => {
    if (!root.querySelector(".play-page")) return;
    const closer = event.target.closest("[data-close-sheet]");
    if (closer) {
      sheetOpen = false;
      syncSheet();
      $("#playDetails")?.focus();
      return;
    }
    const pathButton = event.target.closest("[data-path]");
    if (pathButton && root.contains(pathButton)) {
      const next = pathButton.dataset.path;
      if (next !== pathId) {
        pause();
        pathId = next;
        const list = stages();
        if (index.get(stageId).lane !== "control") {
          cursor = 0;
          stageId = list[0].id;
        } else if (cursor > list.length - 1) {
          cursor = list.length - 1;
        }
        paint();
      }
      return;
    }
    const stageButton = event.target.closest("[data-stage]");
    if (!stageButton || !root.contains(stageButton)) return;
    const next = index.get(stageButton.dataset.stage);
    if (!next) return;
    pause();
    stageId = next.stage.id;
    if (next.lane === "pcm" || next.lane === "offload") {
      pathId = next.lane;
      cursor = stages().findIndex((stage) => stage.id === stageId);
    }
    paint({ focusId: stageId });
  }, { signal: stop.signal });

  $("#playDetails").onclick = () => {
    sheetOpen = !sheetOpen;
    syncSheet();
    if (sheetOpen) $("#playInspector h2")?.focus();
  };

  paint();
}
