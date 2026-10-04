/**
 * <div data-island="flow"> hydration: the static step list becomes a step player.
 * Prerendered markup is only wired (class toggles, no re-render, so no layout
 * shift). Runtime placeholders (hash-route module pages) are rendered from the
 * generated flow JSON first.
 */
import { flowHtml } from "../pages/traceMarkup.js";
import { modHref, copy } from "../lib/dom.js";
import { track } from "../lib/analytics.js";

const FLOWS = import.meta.glob("../content/generated/flows/*.json", { import: "default" });
const flowData = (id, part = "") => FLOWS[`../content/generated/flows/${id}${part}.json`]?.();

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const AUTO_MS = 6000;

export async function hydrate(host) {
  const id = host.dataset.flow;
  if (host.dataset.render) {
    const flow = await flowData(id);
    if (!flow) throw new Error(`unknown flow ${id}`);
    const from = +host.dataset.from || 1;
    const to = +host.dataset.to || flow.steps.length;
    const tmp = document.createElement("div");
    tmp.innerHTML = flowHtml(flow, { variant: host.dataset.variant || "embed", from, to, modHref });
    const fresh = tmp.firstElementChild;
    fresh.dataset.islandState = "ready";
    host.replaceWith(fresh);
    host = fresh;
  }
  wire(host, id);
}

function wire(host, id) {
  const from = +host.dataset.from;
  const to = +host.dataset.to;
  // Clean-URL trace page only: the hash-route view (#/trace/play) owns location.hash.
  const page = host.dataset.variant === "page" && location.pathname.startsWith("/trace/");
  const player = host.querySelector(".flow-player");
  const steps = [...host.querySelectorAll(".flow-step")];
  const dots = [...host.querySelectorAll(".flow-dot")];
  const nodes = [...host.querySelectorAll(".fl-node")];
  const edges = [...host.querySelectorAll(".fl-edge[data-edge]")];
  const live = host.querySelector("[data-live]");
  const prev = host.querySelector("[data-prev]");
  const next = host.querySelector("[data-next]");
  const playBtn = host.querySelector("[data-play]");
  const total = steps.length ? +steps[0].querySelector(".fs-kicker span").textContent.match(/of (\d+)/)[1] : to;
  let cur = +host.dataset.active || from;
  let started = false;
  let timer = 0;
  const seen = new Set([cur]);

  const meta = (n) => {
    const li = steps[n - from];
    return {
      n,
      title: li.querySelector(".fs-title").textContent.trim(),
      path: li.dataset.path,
      threadText: li.querySelector(".fs-proc div:nth-child(2) dd").textContent.trim(),
      proc: li.querySelector(".fs-proc dd").textContent.trim(),
    };
  };

  function show(n, { user = true, focusDot = false } = {}) {
    n = Math.max(from, Math.min(to, n));
    if (n === cur && user) return;
    cur = n;
    host.dataset.active = String(n);
    const li = steps[n - from];
    host.dataset.activeLane = li.dataset.lane;
    steps.forEach((s, i) => s.classList.toggle("is-active", i === n - from));
    dots.forEach((d) => (+d.dataset.go === n ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current")));
    nodes.forEach((g) => {
      const k = +g.dataset.node;
      g.classList.toggle("is-active", k === n);
      g.classList.toggle("is-done", k < n);
    });
    edges.forEach((e) => e.classList.toggle("is-active", +e.dataset.edge === n));
    prev.disabled = n === from;
    next.disabled = n === to;
    const m = meta(n);
    live.textContent = `Step ${n} of ${total}: ${m.title}. ${{ data: "Data path", control: "Control path", both: "Data + control", config: "Config" }[m.path]}. ${m.proc}, ${m.threadText}.`;
    if (focusDot) dots[n - from]?.focus();
    if (page && user) history.replaceState(history.state, "", `#step-${n}`);
    if (user) {
      if (!started) {
        started = true;
        track("flow_start", { flow: id });
      }
      track("flow_step", { flow: id, step: n });
      seen.add(n);
      if (n === to) track("flow_complete", { flow: id, from, to });
    }
    if (n === to) stopAuto();
  }

  function stopAuto() {
    if (!timer) return;
    clearInterval(timer);
    timer = 0;
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.textContent = "▶ Play";
  }
  function startAuto() {
    if (reduceMotion()) return;
    if (cur === to) show(from);
    timer = setInterval(() => show(cur + 1), AUTO_MS);
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.textContent = "❚❚ Pause";
  }

  prev.addEventListener("click", () => {
    stopAuto();
    show(cur - 1);
  });
  next.addEventListener("click", () => {
    stopAuto();
    show(cur + 1);
  });
  dots.forEach((d) =>
    d.addEventListener("click", () => {
      stopAuto();
      show(+d.dataset.go);
    }),
  );
  nodes.forEach((g) =>
    g.addEventListener("click", () => {
      stopAuto();
      show(+g.dataset.node);
    }),
  );
  if (reduceMotion()) {
    playBtn.disabled = true;
    playBtn.title = "Auto-advance is off because your system asks for reduced motion";
  }
  playBtn.addEventListener("click", () => (timer ? stopAuto() : startAuto()));
  host.querySelector("[data-copy-step]")?.addEventListener("click", (e) => {
    const url = `${location.origin}/trace/play/#step-${cur}`;
    copy(url);
    const b = e.currentTarget;
    b.textContent = "Link copied";
    setTimeout(() => (b.textContent = "Copy link"), 1600);
  });
  const dToggle = host.querySelector("[data-diagram-toggle]");
  dToggle?.addEventListener("click", () => {
    const open = host.classList.toggle("show-diagram");
    dToggle.setAttribute("aria-expanded", String(open));
    dToggle.textContent = open ? "Hide diagram" : "Show diagram";
  });

  // ←/→/Home/End while focus is inside the player (never hijack text fields).
  player.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest("input, textarea, select")) return;
    const map = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: from, End: to };
    if (!(e.key in map)) return;
    e.preventDefault();
    stopAuto();
    const onDot = e.target.classList?.contains("flow-dot");
    show(map[e.key], { focusDot: onDot });
  });

  // Prediction prompt (before the step that surprises people most).
  host.querySelectorAll("[data-predict]").forEach((box) => {
    box.closest(".flow-step")?.classList.add("predict-pending");
    box.querySelectorAll("[data-predict-choice]").forEach((b) =>
      b.addEventListener("click", () => {
        const right = b.hasAttribute("data-correct");
        box.querySelectorAll("[data-predict-choice]").forEach((x) => {
          x.disabled = true;
          x.classList.toggle("is-right", x.hasAttribute("data-correct"));
        });
        b.classList.add(right ? "is-right" : "is-wrong");
        const det = box.querySelector("details");
        det.open = true;
        det.querySelector("summary").textContent = right ? "Correct. Why:" : "Not quite. Why:";
        box.closest(".flow-step")?.classList.remove("predict-pending");
        track("flow_predict", { flow: id, correct: right });
      }),
    );
    box.querySelector("details")?.addEventListener("toggle", (e) => {
      if (e.target.open) box.closest(".flow-step")?.classList.remove("predict-pending");
    });
  });

  // Go deeper: code excerpts load on first open.
  host.querySelectorAll("[data-deeper]").forEach((det) =>
    det.addEventListener("toggle", async () => {
      if (!det.open) return;
      track("flow_deeper_open", { flow: id, step: +det.dataset.deeper });
      const slot = det.querySelector("[data-code-slot]");
      if (slot.dataset.loaded) return;
      slot.dataset.loaded = "1";
      slot.textContent = "Loading source excerpts…";
      try {
        const [code, flow] = await Promise.all([flowData(id, ".code"), flowData(id)]);
        const step = flow.steps.find((s) => s.n === +det.dataset.deeper);
        slot.innerHTML = step.sources
          .filter((s) => s.code && code[s.code])
          .map((s) => codeFigure(s, code[s.code], flow.tag))
          .join("");
      } catch {
        slot.textContent = "Source excerpts could not be loaded. The links above still open the pinned files.";
      }
    }),
  );
  host.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-src-link]");
    if (a) track("source_click", { repo: a.dataset.repo, path: a.dataset.path });
  });

  // Deep link (#step-N) on the trace page.
  const m = page && /^#step-(\d+)$/.exec(location.hash);
  if (m) show(+m[1], { user: false });
  else show(cur, { user: false });
  window.addEventListener("hashchange", () => {
    const k = page && /^#step-(\d+)$/.exec(location.hash);
    if (k) show(+k[1], { user: false });
  });
  host.classList.add("is-hydrated");
}

function codeFigure(src, c, tag) {
  const lines = c.html.split("\n");
  const gutter = lines.map((_, i) => c.start + i).join("\n");
  return `<figure class="aa-code" style="--hl:${c.hl}">
    <figcaption><a href="${src.url}" target="_blank" rel="noopener" data-src-link data-repo="${src.repo}" data-path="${src.path}"><code>${src.file}:${src.line}</code></a> ${src.label}</figcaption>
    <div class="aa-code-body" tabindex="0" role="region" aria-label="Source excerpt, ${src.file} lines ${c.start} to ${c.start + lines.length - 1}"><pre class="aa-code-gutter" aria-hidden="true">${gutter}</pre><pre class="aa-code-src"><code class="hljs language-${c.lang}">${c.html}</code></pre></div>
    <p class="aa-code-attr">AOSP, Apache-2.0, tag ${tag}. Excerpt; open the link for the full file.</p>
  </figure>`;
}
