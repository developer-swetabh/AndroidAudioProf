/**
 * Islands: interactive widgets are static HTML first (prerendered, readable
 * without JS) and hydrate only when they come near the viewport.
 *
 *   <div data-island="flow" …>static markup</div>
 *
 * The element module (src/elements/<name>.js) is a separate chunk and exports
 * hydrate(el). Nothing is downloaded on pages without islands.
 */
const LOADERS = import.meta.glob("../elements/aa-*.js");

let io = null;

function hydrate(el) {
  if (el.dataset.islandState) return;
  const load = LOADERS[`../elements/aa-${el.dataset.island}.js`];
  if (!load) return;
  el.dataset.islandState = "loading";
  load()
    .then((m) => m.hydrate(el))
    .then(() => (el.dataset.islandState = "ready"))
    .catch(() => {
      // The static markup stays usable (gated answers become plain <details>); allow a retry on the next scan.
      delete el.dataset.islandState;
      el.classList.add("island-failed");
    });
}

/** Observe every not-yet-hydrated island under root. Safe to call repeatedly. */
export function scanIslands(root = document) {
  const els = [...root.querySelectorAll("[data-island]:not([data-island-state])")];
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) return els.forEach(hydrate);
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        hydrate(e.target);
      }
    },
    { rootMargin: "800px 0px" },
  );
  els.forEach((el) => io.observe(el));
}

/** Hydrate one island now (e.g. a deep link to #step-4 or a focused control). */
export function hydrateNow(el) {
  io?.unobserve(el);
  hydrate(el);
}
