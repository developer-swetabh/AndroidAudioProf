import { lexiconItems } from "../content/lexicon.js";

export function mountLexiconStrip(host, ids) {
  const items = lexiconItems(ids);
  if (!items.length) return { onCaption() {}, update() {} };
  host.innerHTML = `
    <div class="lex-strip">
      <div class="lex-kicker">Junior decoder · what is this word?</div>
      <div class="lex-chips">
        ${items
          .map(
            (t, i) =>
              `<button type="button" class="lex-chip ${i === 0 ? "active" : ""}" data-lex="${t.id}">
                <span>${t.name}</span><em>${t.expands}</em>
              </button>`,
          )
          .join("")}
      </div>
      <aside class="mf-sheet" data-lex-sheet></aside>
    </div>`;

  const sheet = host.querySelector("[data-lex-sheet]");
  let sel = items[0].id;

  const paint = () => {
    const t = items.find((x) => x.id === sel) || items[0];
    host.querySelectorAll("[data-lex]").forEach((b) => b.classList.toggle("active", b.dataset.lex === t.id));
    sheet.innerHTML = `
      <p><strong>${t.name}</strong> · ${t.expands}</p>
      <p>${t.junior}</p>
      <p><strong>Who talks to it?</strong> ${t.who}</p>
      <p class="invent">${t.not}</p>
      <p class="muted">Home lesson: Module ${t.home} · <a href="#/glossary/${t.id}">Glossary</a></p>`;
    host._onCaption?.({ who: `${t.name} · ${t.expands}`, fail: t.junior });
  };

  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lex]");
    if (b) {
      sel = b.dataset.lex;
      paint();
    }
  });

  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      paint();
    },
  };
}
