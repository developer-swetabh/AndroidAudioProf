/**
 * Learning check: single choice, the answer is revealed only after an attempt.
 * Static markup (src/pages/quizMarkup.js) is wired in place; runtime
 * placeholders are rendered from the generated quiz JSON first.
 */
import { quizzesHtml } from "../pages/quizMarkup.js";
import { modHref } from "../lib/dom.js";
import { load, save } from "../lib/storage.js";
import { track } from "../lib/analytics.js";

export async function hydrate(host) {
  if (host.dataset.render) {
    const all = (await import("../content/generated/quizzes.json")).default;
    const ids = host.dataset.ids.split(",").filter((id) => all[id]);
    const tmp = document.createElement("div");
    tmp.innerHTML = quizzesHtml(ids.map((id) => all[id]), { moduleId: host.dataset.module, modHref });
    const fresh = tmp.firstElementChild;
    host.replaceWith(fresh);
    fresh.querySelectorAll(".aa-quiz").forEach(wire);
    return;
  }
  wire(host);
}

function state() {
  return load().quiz || {};
}

function wire(box) {
  if (box.dataset.wired) return;
  box.dataset.wired = "1";
  box.dataset.islandState = "ready";
  const id = box.dataset.quiz;
  const radios = [...box.querySelectorAll('input[type="radio"]')];
  const check = box.querySelector("[data-check]");
  const retry = box.querySelector("[data-retry]");
  const status = box.querySelector("[data-status]");
  const answer = box.querySelector(".quiz-answer");
  const correctId = (() => {
    const t = answer.querySelector(".quiz-explain strong")?.textContent || "";
    return (/Answer: ([A-E])/.exec(t) || [])[1]?.toLowerCase();
  })();
  box.classList.add("is-live");
  if (radios.some((r) => r.checked)) check.disabled = false; // chosen before hydration

  radios.forEach((r) =>
    r.addEventListener("change", () => {
      check.disabled = false;
    }),
  );

  const reveal = (picked, { fromSaved = false } = {}) => {
    const right = picked === correctId;
    box.classList.add("is-answered");
    box.querySelectorAll(".quiz-choice").forEach((l) => {
      const c = l.dataset.choice;
      l.classList.toggle("is-correct", c === correctId);
      l.classList.toggle("is-wrong", c === picked && !right);
      const fb = l.querySelector(".quiz-fb");
      const why = answer.querySelector(`[data-why="${c}"] span`);
      if (c === correctId) fb.textContent = c === picked ? "Your choice: correct." : "Correct answer.";
      else if (c === picked) fb.innerHTML = `Your choice. ${why ? why.innerHTML : ""}`;
      else fb.textContent = "";
      if (c === picked || c === correctId) l.querySelector("input").setAttribute("aria-describedby", `${fb.id} ${answer.id}`);
    });
    radios.forEach((r) => (r.disabled = true));
    const p = radios.find((r) => r.value === picked);
    if (p) p.checked = true;
    check.hidden = true;
    retry.hidden = false;
    answer.open = true;
    answer.querySelector("summary").textContent = "Explanation";
    status.textContent = fromSaved ? "" : right ? "Correct." : `Not quite. The answer is ${correctId.toUpperCase()}.`;
  };

  check.addEventListener("click", () => {
    const picked = radios.find((r) => r.checked)?.value;
    if (!picked) return;
    const s = state();
    const prev = s[id] || { tries: 0 };
    const tries = prev.tries + 1;
    const right = picked === correctId;
    save({ quiz: { ...s, [id]: { tries, choice: picked, correct: right, firstCorrect: prev.firstCorrect ?? right } } });
    track("quiz_attempt", { id, correct: right, try: tries });
    reveal(picked);
  });
  retry.addEventListener("click", () => {
    box.classList.remove("is-answered");
    box.querySelectorAll(".quiz-choice").forEach((l) => {
      l.classList.remove("is-correct", "is-wrong");
      l.querySelector(".quiz-fb").textContent = "";
      l.querySelector("input").removeAttribute("aria-describedby");
    });
    radios.forEach((r) => {
      r.disabled = false;
      r.checked = false;
    });
    check.hidden = false;
    check.disabled = true;
    retry.hidden = true;
    answer.open = false;
    status.textContent = "";
    radios[0]?.focus();
  });

  const saved = state()[id];
  if (saved?.choice) reveal(saved.choice, { fromSaved: true });
}
