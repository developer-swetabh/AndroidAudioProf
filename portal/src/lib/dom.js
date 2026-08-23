export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function go(h) {
  const hash = h.startsWith("#") ? h : `#/${h.replace(/^\/+/, "")}`;
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  location.hash = hash;
}

export function copy(text) {
  return navigator.clipboard?.writeText(text);
}

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "") || "home";
  const [page, ...rest] = raw.split("/");
  return { page, arg: rest.join("/") || "" };
}
