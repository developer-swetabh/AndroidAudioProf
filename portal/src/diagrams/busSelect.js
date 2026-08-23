import { BUS_STEPS } from "../content/xmlFiles.js";
import { esc } from "../lib/dom.js";

export function mountBusSelect(host) {
  if (!host) return { update() {} };
  let i = 0;
  const paint = () => {
    const s = BUS_STEPS[i];
    host.innerHTML = `
      <div class="bus-steps">
        ${BUS_STEPS.map(
          (st, n) =>
            `<button type="button" class="sd-st ${n === i ? "active" : ""}" data-bs="${n}"><span>${n + 1}</span>${esc(st.title)}</button>`,
        ).join("")}
      </div>
      <div class="bus-card">
        <span class="mf-sub">${esc(s.who)}</span>
        <strong>${esc(s.title)}</strong>
        <p>${esc(s.line)}</p>
      </div>`;
    host.querySelectorAll("[data-bs]").forEach((b) => {
      b.onclick = () => {
        i = +b.dataset.bs;
        paint();
      };
    });
  };
  return {
    update() {
      paint();
    },
    onCaption(fn) {
      host._onCaption = fn;
    },
  };
}
