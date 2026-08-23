import { $, $$, esc } from "../lib/dom.js";
import { setMain, openModal } from "../shell.js";
import { TERMS, TERM_CATS, getTerm } from "../content/terms.js";
import { COMPARISONS, getComparison } from "../content/comparisons.js";

export function pageGlossary(arg = "") {
  const st = { q: "", cat: "All", highlight: arg || "" };
  setMain(`
    <div class="wrap glossary-page">
      <div class="glossary-head">
        <div>
          <div class="badge">Terms · one list</div>
          <h1>Glossary</h1>
          <p class="lede">Compare is wired by <code>compareId</code> only. Unpaired terms have no Compare button. There is no “first word of the title” fallback.</p>
        </div>
      </div>
      <div class="search-row">
        <input id="gq" placeholder="Filter terms…" aria-label="Search glossary" />
      </div>
      <div class="pills" id="gcats">${TERM_CATS.map((c) => `<button type="button" data-cat="${c}" class="${c === "All" ? "active" : ""}">${c}</button>`).join("")}</div>
      <p class="muted" id="gcount"></p>
      <div class="term-grid" id="ggrid"></div>
      <h2 class="section-title">Comparison tables</h2>
      <p class="muted">Each table has a stable id. Glossary cards open these by id, never by fuzzy title match.</p>
      <div id="gcomps"></div>
    </div>`);

  const paintList = () => {
    const q = st.q.toLowerCase().trim();
    const terms = TERMS.filter((t) => {
      const catOk = st.cat === "All" || t.cat === st.cat;
      const blob = `${t.name} ${t.short} ${t.catch} ${t.beginner} ${t.engineer} ${t.architect} ${t.id}`.toLowerCase();
      return catOk && (!q || blob.includes(q));
    });
    $("#gcount").textContent = `${terms.length} term${terms.length === 1 ? "" : "s"}`;
    $("#ggrid").innerHTML = terms.map(termCard).join("") || `<p class="muted">No terms match.</p>`;
    $$("#ggrid [data-cmp]").forEach((b) => {
      b.onclick = () => showComparison(b.dataset.cmp);
    });
    $$("#ggrid [data-lvl]").forEach((btn) => {
      btn.onclick = () => {
        const card = btn.closest(".term-card");
        card.querySelectorAll("[data-lvl]").forEach((x) => x.classList.toggle("active", x === btn));
        card.querySelectorAll("[data-pane]").forEach((p) => {
          p.hidden = p.dataset.pane !== btn.dataset.lvl;
        });
      };
    });
    if (st.highlight) {
      const el = document.getElementById(`term-${st.highlight}`);
      if (el) {
        el.classList.add("term-flash");
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  };

  $("#gq").oninput = (e) => {
    st.q = e.target.value;
    st.highlight = "";
    paintList();
  };
  $$("#gcats [data-cat]").forEach((b) => {
    b.onclick = () => {
      st.cat = b.dataset.cat;
      $$("#gcats [data-cat]").forEach((x) => x.classList.toggle("active", x === b));
      st.highlight = "";
      paintList();
    };
  });

  $("#gcomps").innerHTML = Object.entries(COMPARISONS)
    .map(([id, c]) => renderComp(c, id))
    .join("");

  paintList();

  if (arg && !getTerm(arg)) {
    const maybeCmp = getComparison(arg);
    if (maybeCmp) showComparison(arg);
  }
}

function termCard(t) {
  const cmp = t.compareId ? getComparison(t.compareId) : null;
  const hi = location.hash.includes(`/glossary/${t.id}`) ? " term-flash" : "";
  return `<article class="term-card${hi}" id="term-${t.id}">
    <div class="term-top">
      <span class="layer-badge">${esc(t.cat)}</span>
      <span class="layer-badge layer-badge-muted">${esc(t.layer)}</span>
    </div>
    <h3>${esc(t.name)}</h3>
    <p>${esc(t.short)}</p>
    <p class="term-catch">${esc(t.catch)}</p>
    <div class="tabs term-tabs">
      <button type="button" class="tab active" data-lvl="b">Beginner</button>
      <button type="button" class="tab" data-lvl="e">Engineer</button>
      <button type="button" class="tab" data-lvl="x">Architect</button>
    </div>
    <p data-pane="b">${esc(t.beginner)}</p>
    <p data-pane="e" hidden>${esc(t.engineer)}</p>
    <p data-pane="x" hidden>${esc(t.architect)}</p>
    ${cmp ? `<button class="btn-ghost" type="button" data-cmp="${esc(t.compareId)}">Compare · ${esc(cmp.title)}</button>` : ""}
  </article>`;
}

function renderComp(c, id) {
  return `<div class="card comp-card" id="cmp-${id}">
    <div class="comp-id">${esc(id)}</div>
    <h3>${esc(c.title)}</h3>
    <div class="table-wrap">
      <table class="skill-grid">
        <thead><tr>${c.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${c.rows.map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  </div>`;
}

function showComparison(id) {
  const c = getComparison(id);
  if (!c) return;
  openModal(`${renderComp(c, id)}`, { label: c.title });
}
