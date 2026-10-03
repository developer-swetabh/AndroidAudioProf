export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** True on a prerendered clean-path entry (e.g. /learn/06/). The hash router still works there. */
export function onCleanPath() {
  return location.pathname !== "/" && location.pathname !== "/index.html";
}

/** Map a hash route ("#/learn/06") to the URL to navigate to from a clean-path page. */
export function cleanTarget(hash) {
  const m = /^#\/learn(?:\/([\w-]+))?\/?$/.exec(hash);
  if (m) return m[1] ? `/learn/${m[1]}/` : "/learn/";
  return `/${hash}`;
}

/** Link to a module: clean URL on clean pages, hash route on the SPA shell. */
export function modHref(id) {
  if (onCleanPath()) return id ? `/learn/${id}/` : "/learn/";
  return id ? `#/learn/${id}` : "#/learn";
}

export function go(h) {
  const hash = h.startsWith("#") ? h : `#/${h.replace(/^\/+/, "")}`;
  if (onCleanPath()) {
    location.assign(cleanTarget(hash));
    return;
  }
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
  const h = location.hash;
  if (h.startsWith("#/")) {
    const raw = h.replace(/^#\/?/, "") || "home";
    const [page, ...rest] = raw.split("/");
    return { page, arg: rest.join("/") || "" };
  }
  // Prerendered clean paths: /learn/ and /learn/<id>/
  const m = /^\/learn(?:\/([\w-]+))?\/?$/.exec(location.pathname);
  if (m) return { page: "learn", arg: m[1] || "" };
  return { page: "home", arg: "" };
}
