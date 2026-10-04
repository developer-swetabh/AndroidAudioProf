/**
 * Gated Practice item: the expected answer unlocks after the learner types an
 * answer. Draft text and self-grading stay in localStorage (aaep.v1.practice).
 */
import { load, save } from "../lib/storage.js";
import { track } from "../lib/analytics.js";

// The answer controls only work with JS, so they are built here rather than
// prerendered (keeps every module page's HTML small; JS-off never sees them).
export function workHtml(id) {
  return `<label class="practice-label" for="${id}-a">Your answer (stays on this device)</label>
<textarea id="${id}-a" class="practice-input" rows="4" placeholder="Write your answer first…"></textarea>
<div class="practice-actions"><button type="button" class="btn" data-reveal disabled>Show expected answer</button>
<span class="practice-hint muted" data-hint>Type an answer to unlock it.</span></div>`;
}

export function hydrate(item) {
  const work = item.querySelector(".practice-work");
  if (work && !work.querySelector(".practice-input")) {
    work.innerHTML = workHtml(`practice-${item.dataset.module || "x"}-${item.dataset.item}`);
    item.insertAdjacentHTML("beforeend", `<label class="practice-self" hidden><input type="checkbox" data-self> I got it right</label>`);
  }
  const key = `${item.dataset.module}:${item.dataset.item}`;
  const input = item.querySelector(".practice-input");
  const btn = item.querySelector("[data-reveal]");
  const hint = item.querySelector("[data-hint]");
  const answer = item.querySelector(".practice-answer");
  const self = item.querySelector(".practice-self");
  const selfBox = item.querySelector("[data-self]");
  const all = () => load().practice || {};
  const put = (patch) => save({ practice: { ...all(), [key]: { ...(all()[key] || {}), ...patch } } });
  const st = all()[key] || {};
  item.classList.add("is-live");

  const sync = () => {
    const has = input.value.trim().length > 0;
    btn.disabled = !has;
    hint.textContent = has ? "" : "Type an answer to unlock it.";
  };
  const reveal = () => {
    item.classList.add("is-revealed");
    answer.open = true;
    btn.hidden = true;
    hint.textContent = "";
    self.hidden = false;
  };
  if (st.draft) input.value = st.draft;
  if (st.got) selfBox.checked = true;
  sync();
  if (st.revealed) reveal();

  let t = 0;
  input.addEventListener("input", () => {
    sync();
    clearTimeout(t);
    t = setTimeout(() => put({ draft: input.value.slice(0, 4000) }), 400);
  });
  btn.addEventListener("click", () => {
    if (!input.value.trim()) return;
    put({ draft: input.value.slice(0, 4000), revealed: true });
    track("practice_reveal", { module: item.dataset.module, item: +item.dataset.item, typed: true });
    reveal();
    answer.querySelector("summary")?.focus();
  });
  selfBox.addEventListener("change", () => {
    put({ got: selfBox.checked });
    track("practice_self_grade", { module: item.dataset.module, item: +item.dataset.item, got: selfBox.checked });
  });
}
