import { setMain, consumePrerendered } from "../shell.js";
import { homeHtml } from "./homeMarkup.js";

export function pageHome() {
  // First paint came from prerendered HTML: keep the final numbers, no count-up flash.
  if (consumePrerendered("home") && document.querySelector("#app-main .hero")) return; // static DOM already shown
  setMain(homeHtml());
  document.querySelectorAll(".stat-card .n").forEach((el) => countUp(el, +el.dataset.n));
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
