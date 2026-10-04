/**
 * Pure markup for learning checks (aa-quiz) and gated Practice items, shared by
 * scripts/prerender.mjs and the runtime. No DOM access here.
 *
 * Without JS both stay readable: radios + the answer inside a closed <details>.
 * With JS (src/elements/aa-quiz.js, aa-practice.js) the answer is revealed only
 * after an attempt.
 */
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function rereadUrl(ref, modHref) {
  const [id, anchor] = String(ref).split("#");
  const base = modHref(id);
  if (!anchor) return base;
  return base.startsWith("#/") ? `${base}/${anchor}` : `${base}#${anchor}`;
}

export function quizHtml(q, { moduleId = "", modHref = (id) => `/learn/${id}/`, n = 1, total = 1 } = {}) {
  const uid = `${q.id}-${moduleId || "x"}`;
  const right = q.choices.find((c) => c.correct);
  const letter = (c) => c.id.toUpperCase();
  return `<div class="aa-quiz" data-island="quiz" data-quiz="${esc(q.id)}" data-module="${esc(moduleId)}">
    <fieldset class="quiz-fs">
      <legend><span class="quiz-kicker">${total > 1 ? `Question ${n} of ${total}` : "Question"}</span> <span class="quiz-stem">${q.stem}</span></legend>
      <div class="quiz-choices">${q.choices
        .map(
          (c) => `<label class="quiz-choice" data-choice="${esc(c.id)}"><input type="radio" name="${esc(uid)}" value="${esc(c.id)}"> <span class="quiz-letter">${letter(c)})</span> <span class="quiz-text">${c.text}</span><span class="quiz-fb" id="${esc(uid)}-fb-${esc(c.id)}"></span></label>`,
        )
        .join("")}</div>
    </fieldset>
    <div class="quiz-actions">
      <button type="button" class="btn" data-check disabled>Check</button>
      <button type="button" class="btn-ghost" data-retry hidden>Try again</button>
      <span class="quiz-status" aria-live="polite" data-status></span>
    </div>
    <details class="quiz-answer" id="${esc(uid)}-answer">
      <summary>Show the answer</summary>
      <div class="quiz-explain">
        <p><strong>Answer: ${letter(right)}.</strong> ${q.explain}</p>
        ${q.choices
          .filter((c) => !c.correct && c.feedback)
          .map((c) => `<p class="quiz-why-not" data-why="${esc(c.id)}"><strong>${letter(c)}</strong>: <span>${c.feedback}</span></p>`)
          .join("")}
        ${q.sources.length ? `<p class="quiz-src">Source (AOSP ${esc(q.sources[0].pinned)}): ${q.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener"><code>${esc(s.file)}${s.line ? `:${s.line}` : ""}</code></a>`).join(", ")}</p>` : ""}
        ${q.reread ? `<p class="quiz-reread"><a href="${esc(rereadUrl(q.reread, modHref))}">Re-read the section</a></p>` : ""}
      </div>
    </details>
  </div>`;
}

export function quizzesHtml(items, opts) {
  return `<div class="aa-quizzes">${items.map((q, i) => quizHtml(q, { ...opts, n: i + 1, total: items.length })).join("")}</div>`;
}

// ---------- Practice (gated) ----------

const BLOCK = /<(\/?)(p|ol|ul|pre|blockquote|table|h[1-6]|div|details|section|figure)\b[^>]*>/gi;

/** Split an HTML fragment into its top-level block elements. */
export function splitBlocks(html) {
  const out = [];
  let depth = 0, start = -1, m;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(html))) {
    const closing = m[1] === "/";
    if (!closing) {
      if (depth === 0) start = m.index;
      depth++;
    } else {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(html.slice(start, BLOCK.lastIndex));
        start = -1;
      }
    }
  }
  return out;
}

const textOf = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// A block that starts the expected answer.
const ANSWER = /^(Write first\. Then:|Then compare\b|Expected\b|Sketch:|Write your answer\. Expected)/;
// A bold label that always opens a new question ("**Second question:**", "**Self-check:**").
const LABELLED = /^<p><strong>(Question|Second question|Diagnostic question|Self-check|Your turn)\b/i;
// After a labelled question, a plain "Because …" paragraph is its answer.
const BECAUSE = /^Because\b/;
// A marker-only paragraph: replaced by the reveal control.
const MARKER_ONLY = /^(Write first\. Then:|Expected:|Then compare to this reasoning \(read only after you write\):)$/;

/** Practice body → items {prompt, answer}. Bold-led paragraphs start a new item once the current one has an answer. */
export function practiceItems(bodyHtml) {
  const items = [];
  let cur = { prompt: [], answer: [], labelled: false };
  const next = (labelled = false) => {
    items.push(cur);
    cur = { prompt: [], answer: [], labelled };
  };
  for (const b of splitBlocks(bodyHtml)) {
    const t = textOf(b);
    const isP = /^<p\b/i.test(b);
    if (isP && cur.labelled && cur.prompt.length && !cur.answer.length && BECAUSE.test(t)) {
      cur.answer.push(b);
      continue;
    }
    if (isP && ANSWER.test(t)) {
      if (cur.answer.length) next();
      // "Write your answer. Expected reasoning: …" → keep the instruction, gate the rest.
      const split = /^<p>Write your answer\.\s*/.exec(b);
      if (split) {
        cur.prompt.push("<p>Write your answer.</p>");
        cur.answer.push(`<p>${b.slice(split[0].length)}`);
      } else if (!MARKER_ONLY.test(t)) cur.answer.push(b);
      else cur.answer.push(""); // marks "answer started"
      continue;
    }
    const labelled = LABELLED.test(b);
    if (isP && /^<p><strong>/i.test(b) && (cur.answer.length || (labelled && cur.prompt.length))) next(labelled);
    else if (labelled && !cur.prompt.length) cur.labelled = true;
    (cur.answer.length ? cur.answer : cur.prompt).push(b);
  }
  items.push(cur);
  return items
    .map((i) => ({ prompt: i.prompt.join("\n"), answer: i.answer.filter(Boolean).join("\n") }))
    .filter((i) => i.prompt || i.answer);
}

export function practiceHtml(bodyHtml, { moduleId = "" } = {}) {
  const items = practiceItems(bodyHtml);
  return items
    .map((it, i) => {
      if (!it.answer) return `<div class="practice-item practice-open">${it.prompt}</div>`;
      const id = `practice-${moduleId || "x"}-${i + 1}`;
      return `<div class="practice-item" data-island="practice" data-module="${esc(moduleId)}" data-item="${i + 1}">
        <div class="practice-q">${it.prompt}</div>
        <div class="practice-work">
          <label class="practice-label" for="${id}-a">Your answer (stays on this device)</label>
          <textarea id="${id}-a" class="practice-input" rows="4" placeholder="Write your answer first…"></textarea>
          <div class="practice-actions">
            <button type="button" class="btn" data-reveal disabled>Show expected answer</button>
            <span class="practice-hint muted" data-hint>Type an answer to unlock it.</span>
          </div>
        </div>
        <details class="practice-answer" id="${id}-x"><summary>Expected answer</summary><div class="practice-answer-body">${it.answer}</div></details>
        <label class="practice-self" hidden><input type="checkbox" data-self> I got it right</label>
      </div>`;
    })
    .join("\n");
}
