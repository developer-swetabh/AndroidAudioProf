import { $, $$, copy, esc } from "../lib/dom.js";
import { load, save } from "../lib/storage.js";
import { getDump, SERVICES } from "../content/debugDumps.js";
import { RCA_CASES, RCA_SLOTS, SIX_Q, getRcaCase, rcaBlank, rcaFromAnswer } from "../content/rcaCases.js";
import { colorDump } from "../lib/dumpMarkup.js";
import { RCA_HINT } from "../content/debugLab.js";
import { parseMarkdown } from "../lib/mdParse.js";

export function rcaIndexHtml() {
  const st = load().rcaLab || {};
  return `
    <div class="rca-index">
      <p class="lede">Workbook cases 01–08. Label each evidence card, write the five RCA lines, then reveal the key. Markdown in <code>workbook/</code> stays canonical.</p>
      <div class="dbg-grid">
        ${RCA_CASES.map((c) => {
          const s = st[c.id] || {};
          const done = s.submitted;
          return `<a class="card path-card" href="#/workbench/rca/${c.id}">
            <div class="path-ico">${c.id}</div>
            <h3>${esc(c.title)}</h3>
            <p>${esc(c.symptom)}</p>
            <p class="muted">${done ? `Submitted · ${s.score ?? "?"} / ${c.cards.length} cards` : "Not submitted"}</p>
          </a>`;
        }).join("")}
      </div>
      <p class="learn-related">
        <a class="btn-ghost" href="#/learn/21">Module 21 · RCA</a>
        <a class="btn-ghost" href="#/workbench/dump">Dump lab</a>
        <a class="btn-ghost" href="#/debug">Debug engine</a>
      </p>
    </div>`;
}

export function rcaCaseHtml(id) {
  const c = getRcaCase(id);
  if (!c) return rcaIndexHtml();
  const st = caseState(c);
  return `
    <div class="rca-case">
      <aside class="rca-side">
        <a class="btn-ghost" href="#/workbench/rca">← All cases</a>
        <div class="badge">Case ${c.id} · ${c.product === "aaos" ? "AAOS" : "AOSP"}</div>
        <h2>${esc(c.title)}</h2>
        <p>${esc(c.symptom)}</p>
        <p class="muted">${esc(c.classify)}</p>
        ${c.note ? `<p class="invent" style="background:var(--cyan-dim);color:var(--text-primary);border-color:rgba(0,229,255,0.35)">${esc(c.note)}</p>` : ""}
        ${c.qcom ? `<p class="invent">Do not invent PAL module IDs, ACDB names, or PCM device numbers.</p>` : ""}
        <details class="practice-fold">
          <summary>Six evidence rules</summary>
          <ol class="rca-rules">
            <li><code>play()</code> ≠ sound at speaker</li>
            <li>PCM RUNNING ≠ analog unmuted</li>
            <li>Policy device name ≠ HAL opened that PCM</li>
            <li>DSP graph “up” ≠ codec DAC powered</li>
            <li>No error log ≠ success</li>
            <li>One log line = clue, not verdict</li>
          </ol>
        </details>
        <details class="practice-fold" ${Object.values(st.six).some(Boolean) ? "open" : ""}>
          <summary>WHO / WHERE / WHEN / WHAT / WHY / HOW</summary>
          <p class="muted">Fill this before a hypothesis. Not a substitute for the five RCA lines.</p>
          ${SIX_Q.map(
            (q) => `<label class="rca-q">${q.label}<span>${esc(q.hint)}</span>
              <input data-six="${q.id}" value="${esc(st.six[q.id] || "")}" placeholder="${esc(q.hint)}"/></label>`,
          ).join("")}
        </details>
        <div class="rca-hypos">
          <label>AOSP hypothesis
            <textarea data-hypo="aosp" rows="3" placeholder="What AOSP decision could produce this dump?">${esc(st.aosp)}</textarea>
          </label>
          <label>Vendor hypothesis
            <textarea data-hypo="vendor" rows="3" placeholder="What vendor/HAL/DSP path? Write “n/a” if killed.">${esc(st.vendor)}</textarea>
          </label>
          <p class="invent" data-hypo-warn ${st.aosp && st.vendor ? "hidden" : ""}>Write both. A course that only names “HAL” has not classified the bug.</p>
        </div>
        <p class="learn-related">
          ${c.dumpScenario ? `<a class="btn-ghost" href="#/workbench/dump/flinger/${c.dumpScenario}">Dump lab</a>` : ""}
          ${c.debug ? `<a class="btn-ghost" href="#/debug/${c.debug}">Debug playbook</a>` : ""}
          ${c.learn.map((l) => `<a class="btn-ghost" href="${l.href}">${esc(l.label)}</a>`).join("")}
        </p>
      </aside>
      <section class="rca-board">
        <p class="muted">Click a card, then a tray — or drag. Do not use a dropdown that pretends to be this lab.</p>
        <div class="rca-pool" data-pool>
          <h3>Unsorted evidence</h3>
          <div data-pool-cards></div>
        </div>
        <div class="rca-trays">
          ${RCA_SLOTS.map(
            (s) => `<div class="rca-tray" data-tray="${s.id}" tabindex="0">
              <header><strong>${esc(s.name)}</strong><span>${esc(s.hint)}</span></header>
              <div data-tray-cards="${s.id}"></div>
            </div>`,
          ).join("")}
        </div>
        <details class="practice-fold" data-book>
          <summary>Textbook case (markdown)</summary>
          <article class="md-body" data-book-md>Loading workbook…</article>
        </details>
      </section>
      <aside class="rca-write">
        <h3>Five-line RCA</h3>
        <p class="muted">Write this <em>before</em> the key. Immediate failure is a dump line, not a feeling. Submit scores cards; the key stays hidden until the five lines have content.</p>
        <pre class="dump-line">${esc(RCA_HINT)}</pre>
        <textarea id="rcaText" rows="8" spellcheck="false">${esc(st.rca || rcaBlank())}</textarea>
        <div class="dbg-actions">
          <button class="btn" type="button" id="rcaSubmit">${st.submitted ? "Re-check labels" : "Submit · check labels"}</button>
          <button class="btn-ghost" type="button" id="rcaCopy">Copy RCA</button>
          <button class="btn-ghost" type="button" id="rcaReset">Reset case</button>
        </div>
        <div data-reveal ${st.submitted ? "" : "hidden"}></div>
      </aside>
    </div>`;
}

export function bindRcaLab(id) {
  const c = getRcaCase(id);
  if (!c) return;
  let st = caseState(c);
  let selected = null;

  const persist = (patch) => {
    st = { ...st, ...patch };
    const all = { ...(load().rcaLab || {}), [c.id]: st };
    save({ rcaLab: all });
  };

  const paintCards = () => {
    const by = { pool: [], ...Object.fromEntries(RCA_SLOTS.map((s) => [s.id, []])) };
    c.cards.forEach((card) => {
      const slot = st.slots[card.id] || "pool";
      (by[slot] || by.pool).push(card);
    });
    $("[data-pool-cards]").innerHTML = by.pool.map(cardHtml).join("") || `<p class="muted">All cards placed.</p>`;
    RCA_SLOTS.forEach((s) => {
      $(`[data-tray-cards="${s.id}"]`).innerHTML = by[s.id].map(cardHtml).join("");
    });
    bindCardUi();
    if (st.submitted) paintReveal();
  };

  const place = (cardId, slot) => {
    persist({ slots: { ...st.slots, [cardId]: slot === "pool" ? undefined : slot }, submitted: false });
    selected = null;
    $("[data-reveal]").hidden = true;
    paintCards();
  };

  function bindCardUi() {
    $$("[data-card]").forEach((el) => {
      el.classList.toggle("is-sel", el.dataset.card === selected);
      el.onclick = (e) => {
        if (e.target.closest("[data-slot-btn]")) return;
        selected = selected === el.dataset.card ? null : el.dataset.card;
        $$("[data-card]").forEach((n) => n.classList.toggle("is-sel", n.dataset.card === selected));
      };
      el.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", el.dataset.card);
        e.dataTransfer.effectAllowed = "move";
      };
    });
    $$("[data-slot-btn]").forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        place(b.closest("[data-card]").dataset.card, b.dataset.slotBtn);
      };
    });
  }

  $$("[data-tray]").forEach((tray) => {
    tray.onclick = (e) => {
      if (e.target.closest("[data-card]")) return;
      if (selected) place(selected, tray.dataset.tray);
    };
    tray.ondragover = (e) => {
      e.preventDefault();
      tray.classList.add("is-over");
    };
    tray.ondragleave = () => tray.classList.remove("is-over");
    tray.ondrop = (e) => {
      e.preventDefault();
      tray.classList.remove("is-over");
      const cardId = e.dataTransfer.getData("text/plain");
      if (cardId) place(cardId, tray.dataset.tray);
    };
  });
  $("[data-pool]").ondragover = (e) => e.preventDefault();
  $("[data-pool]").ondrop = (e) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId) place(cardId, "pool");
  };

  $$("[data-six]").forEach((inp) => {
    inp.oninput = () => persist({ six: { ...st.six, [inp.dataset.six]: inp.value } });
  });
  $$("[data-hypo]").forEach((inp) => {
    inp.oninput = () => {
      persist({ [inp.dataset.hypo]: inp.value });
      const warn = $("[data-hypo-warn]");
      if (warn) warn.hidden = Boolean(st.aosp && st.vendor);
    };
  });
  $("#rcaText").oninput = () => persist({ rca: $("#rcaText").value });

  $("#rcaSubmit").onclick = () => {
    const score = c.cards.filter((card) => (st.slots[card.id] || "") === card.slot).length;
    const wrote = rcaWrote($("#rcaText")?.value || st.rca);
    persist({ submitted: true, score, revealKey: wrote || !!st.revealKey });
    $("[data-reveal]").hidden = false;
    paintReveal();
    $("#rcaSubmit").textContent = "Re-check labels";
  };
  $("#rcaCopy").onclick = () => copy($("#rcaText").value);
  $("#rcaReset").onclick = () => {
    persist({
      slots: {},
      six: {},
      aosp: "",
      vendor: "",
      rca: rcaBlank(),
      submitted: false,
      score: null,
      revealKey: false,
    });
    location.hash = `#/workbench/rca/${c.id}`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  function paintReveal() {
    const host = $("[data-reveal]");
    if (!host) return;
    const misses = c.cards.filter((card) => (st.slots[card.id] || "") !== card.slot);
    const wrote = rcaWrote(st.rca);
    const showKey = wrote || st.revealKey;
    host.innerHTML = `
      <div class="card rca-score">
        <h3>${st.score} / ${c.cards.length} cards in the right tray</h3>
        ${misses.length ? `<ul>${misses.map((m) => missLine(m, st)).join("")}</ul>` : `<p>Every card landed.</p>`}
        ${
          showKey
            ? `<pre class="dump-line">${esc(rcaFromAnswer(c))}</pre>
               <p><strong>Layer:</strong> ${esc(c.layer)}</p>
               <ul>${c.traps.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
               <p class="muted">Answer key is also in <code>workbook/ANSWER_KEY.md</code> — after you write, not instead.</p>`
            : `<p class="invent">Card score is not the key. Write the five RCA lines, then re-check — or say you already wrote them on paper.</p>
               <button class="btn" type="button" id="rcaRevealKey">I wrote the five lines — reveal key</button>`
        }
      </div>`;
    $("#rcaRevealKey")?.addEventListener("click", () => {
      persist({ revealKey: true });
      paintReveal();
    });
  }

  paintCards();
  loadTextbook(c);
}

function cardHtml(card) {
  const dump = card.dump ? getDump(card.dump) : null;
  const svc = card.service || dump?.service || "dump";
  const svcName = SERVICES.find((s) => s.id === svc)?.name || { app: "App", hw: "Analog", dump: "Evidence" }[svc] || svc;
  const body = dump ? colorDump(dump.text) : colorDump(card.text || "");
  return `<article class="rca-card" data-card="${card.id}" draggable="true">
    <header>
      <span class="mf-sub">${esc(svcName)}</span>
      <strong>${esc(cardTitle(card))}</strong>
    </header>
    <div class="dump-term rca-snip">${body}</div>
    <div class="rca-card-slots">
      ${RCA_SLOTS.map((s) => `<button type="button" class="sd-st" data-slot-btn="${s.id}">${esc(s.short)}</button>`).join("")}
    </div>
  </article>`;
}

function cardTitle(card) {
  if (card.title) return card.title;
  if (card.dump) return card.dump;
  return card.id;
}

function missLine(m, st) {
  const got = RCA_SLOTS.find((s) => s.id === st.slots[m.id]);
  const want = RCA_SLOTS.find((s) => s.id === m.slot);
  const you = got ? ` <span class="muted">(you: ${esc(got.name)})</span>` : ` <span class="muted">(unplaced)</span>`;
  return `<li><strong>${esc(cardTitle(m))}</strong> → ${esc(want.name)}${you} — ${esc(m.why)}</li>`;
}

function rcaWrote(text) {
  return (
    String(text || "")
      .split("\n")
      .filter((l) => l.split(":").slice(1).join(":").trim()).length >= 4
  );
}

function caseState(c) {
  const s = (load().rcaLab || {})[c.id] || {};
  return {
    slots: s.slots || {},
    six: s.six || {},
    aosp: s.aosp || "",
    vendor: s.vendor || "",
    rca: s.rca || "",
    submitted: !!s.submitted,
    score: s.score ?? null,
    revealKey: !!s.revealKey,
  };
}

async function loadTextbook(c) {
  const host = $("[data-book-md]");
  if (!host) return;
  try {
    const res = await fetch(`/curriculum/workbook/${c.file}`);
    const text = await res.text();
    if (!res.ok) throw new Error(res.statusText);
    host.innerHTML = parseMarkdown(text);
  } catch {
    host.textContent = "Workbook excerpt unavailable. Open the markdown in the repo.";
  }
}
