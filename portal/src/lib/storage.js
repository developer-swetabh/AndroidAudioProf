const KEY = "aaep.v1";

export function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function save(patch) {
  localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch }));
}
