/**
 * Privacy-friendly analytics wrapper. Everything is a no-op unless the build
 * opted in (ANALYTICS=vercel or ANALYTICS=vercel+events at build time, which makes
 * scripts/prerender.mjs inject the Vercel Web Analytics loader and set
 * window.__aaepAnalytics). Nothing is sent when the browser asks Do Not Track
 * (the loader is not even injected), and nothing ever includes typed text.
 *
 * - Page views: Vercel Web Analytics (cookieless, free on Hobby). Clean URLs are
 *   counted by the script itself; hash routes (/#/debug) are reported here.
 * - Custom events (track): only with ANALYTICS=vercel+events. Vercel custom
 *   events need a paid plan; on Hobby leave events off and track() stays silent.
 */
const cfg = () => (typeof window === "undefined" ? null : window.__aaepAnalytics || null);

export function analyticsEnabled() {
  const c = cfg();
  return Boolean(c && typeof window.va === "function");
}

/** Custom event. Props must be small scalars (no free text). */
export function track(name, props = {}) {
  const c = cfg();
  if (!c?.events || typeof window.va !== "function") return;
  const data = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "number" || typeof v === "boolean") data[k] = v;
    else if (typeof v === "string") data[k] = v.slice(0, 100);
  }
  try {
    window.va("event", { name, data });
  } catch {
    /* never break the page for analytics */
  }
}

/** Page view for SPA hash routes (the script already counts real page loads). */
export function trackHashPageview() {
  if (!analyticsEnabled()) return;
  const h = location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
  const page = h.split("/")[0] || "home";
  try {
    window.va("pageview", { route: `/#/${page}`, path: `/#/${h}` });
  } catch {
    /* ignore */
  }
}

let depthCleanup = null;

/** scroll_depth {page, pct: 25|50|75|100}, once per threshold per page view. */
export function trackScrollDepth(page) {
  depthCleanup?.();
  depthCleanup = null;
  if (!cfg()?.events) return;
  const sent = new Set();
  let raf = 0;
  const check = () => {
    raf = 0;
    const doc = document.documentElement;
    const max = doc.scrollHeight - innerHeight;
    const pct = max <= 0 ? 100 : (scrollY / max) * 100;
    for (const t of [25, 50, 75, 100]) {
      if (pct >= t - 1 && !sent.has(t)) {
        sent.add(t);
        track("scroll_depth", { page, pct: t });
      }
    }
    if (sent.size === 4) depthCleanup?.();
  };
  const onScroll = () => {
    raf ||= requestAnimationFrame(check);
  };
  addEventListener("scroll", onScroll, { passive: true });
  depthCleanup = () => {
    removeEventListener("scroll", onScroll);
    depthCleanup = null;
  };
}
