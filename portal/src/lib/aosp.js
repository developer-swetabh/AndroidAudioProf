/**
 * Single source of the AOSP version the course is pinned to.
 * Every source link on the site is built here. Moving the course to a newer
 * Android is a tag change here plus `npm run sources` (re-resolves every symbol).
 */
export const AOSP_TAG = "android-15.0.0_r36";
export const KERNEL_BRANCH = "android15-6.6";

const GITILES = "https://android.googlesource.com";

/** Short repo keys used in content → googlesource project paths. */
export const REPOS = {
  "frameworks/av": "platform/frameworks/av",
  "frameworks/base": "platform/frameworks/base",
  "hardware/interfaces": "platform/hardware/interfaces",
  "packages/services/Car": "platform/packages/services/Car",
  "system/media": "platform/system/media",
  "external/tinyalsa": "platform/external/tinyalsa",
  "kernel/common": "kernel/common",
};

export function isKernel(repo) {
  return repo === "kernel/common";
}

/** Pinned link: tag for platform repos, the android15 branch for the kernel (moving). */
export function aospLink({ repo, path, line }) {
  const project = REPOS[repo];
  if (!project) throw new Error(`aospLink: unknown repo ${repo}`);
  const ref = isKernel(repo) ? `refs/heads/${KERNEL_BRANCH}` : `refs/tags/${AOSP_TAG}`;
  return `${GITILES}/${project}/+/${ref}/${path || ""}${line ? `#${line}` : ""}`;
}

/** Raw-file URL used by the fetch tool (base64 body). */
export function aospRawUrl({ repo, path }) {
  const project = REPOS[repo];
  const ref = isKernel(repo) ? `refs/heads/${KERNEL_BRANCH}` : `refs/tags/${AOSP_TAG}`;
  return `${GITILES}/${project}/+/${ref}/${path}?format=TEXT`;
}

/** Superproject-style path (e.g. "frameworks/av/services/…") → pinned link. */
export function aospPathLink(fullPath, line) {
  const repo = Object.keys(REPOS)
    .filter((r) => fullPath === r || fullPath.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!repo) throw new Error(`aospPathLink: no repo for ${fullPath}`);
  return aospLink({ repo, path: fullPath.slice(repo.length + 1), line });

}

/** Unpinned symbol search (labelled "search latest" wherever it is shown). */
export function csSearch(symbol) {
  return `https://cs.android.com/search?q=${encodeURIComponent(`symbol:${symbol}`)}`;
}

export function lockKey({ repo, path, symbol, occurrence = 1 }) {
  return `${repo}:${path}#${symbol}${occurrence > 1 ? `@${occurrence}` : ""}`;
}
