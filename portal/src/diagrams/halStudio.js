import { mountStreamDescriptor } from "./streamDescriptor.js";
import { mountHalBelow } from "./halBelow.js";
import { mountLexiconStrip } from "./lexiconStrip.js";

/** Module 08: AIDL burst (AOSP contract) then what the vendor HAL calls. Module 26 stays burst-only. */

export function mountHalStudio(host) {
  host.innerHTML = `
    <div class="hal-studio">
      <p class="lex-kicker">Two tabs. Finish burst, then open <strong>After the HAL</strong> — that is where PAL/AGM live.</p>
      <div class="sd-tabs">
        <button type="button" class="active" data-hal-tab="burst">1 · AIDL burst</button>
        <button type="button" data-hal-tab="below">2 · After the HAL</button>
      </div>
      <div data-burst></div>
      <div data-below hidden></div>
      <div data-lex></div>
    </div>`;

  const burstHost = host.querySelector("[data-burst]");
  const belowHost = host.querySelector("[data-below]");
  const lexHost = host.querySelector("[data-lex]");
  const burst = mountStreamDescriptor(burstHost);
  const below = mountHalBelow(belowHost);
  const lex = mountLexiconStrip(lexHost, ["pal", "agm", "alsa", "asoc", "dsp"]);
  let tab = "burst";

  const paint = () => {
    host.querySelectorAll("[data-hal-tab]").forEach((b) => b.classList.toggle("active", b.dataset.halTab === tab));
    burstHost.hidden = tab !== "burst";
    belowHost.hidden = tab !== "below";
    if (tab === "burst") burst.update();
    else below.update();
  };

  burst.onCaption((c) => host._onCaption?.(c));
  below.onCaption((c) => host._onCaption?.(c));
  lex.onCaption((c) => {
    if (tab === "below") host._onCaption?.(c);
  });

  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-hal-tab]");
    if (b) {
      tab = b.dataset.halTab;
      paint();
    }
  });

  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      lex.update();
      paint();
    },
  };
}
