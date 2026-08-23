import { load, save } from "./storage.js";
import { compute, DEFAULT_PCM } from "./audioMath.js";

export function getPcm() {
  return compute({ ...DEFAULT_PCM, ...(load().pcm || {}) });
}

export function patchPcm(patch) {
  const next = compute({ ...getPcm(), ...patch });
  save({
    pcm: {
      rate: next.rate,
      channels: next.channels,
      format: next.format,
      periodFrames: next.periodFrames,
      periodCount: next.periodCount,
      tdmSlots: next.tdmSlots,
      path: next.path,
    },
  });
  return next;
}
