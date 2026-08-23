/** Shared PCM math. Fundamentals studio and Workbench calculator both call this.
 *  Do not put DOM here. Do not rebuild UI from these numbers. */

export const RATES = [8000, 16000, 44100, 48000, 96000];
export const CHANNELS = [1, 2, 6, 8];
export const PERIOD_COUNTS = [2, 3, 4, 6, 8];
export const TDM_SLOTS = [2, 4, 8];
export const PATHS = ["pcm", "fast", "direct", "offload"];

export const FORMATS = {
  S16_LE: {
    id: "S16_LE",
    label: "S16_LE · 16-bit",
    bytes: 2,
    usefulBits: 16,
    packed: true,
    android: "AUDIO_FORMAT_PCM_16_BIT",
    note: "2 bytes/sample. Common mixer path.",
  },
  S24_3LE: {
    id: "S24_3LE",
    label: "S24_3LE · 24-bit packed",
    bytes: 3,
    usefulBits: 24,
    packed: true,
    android: "AUDIO_FORMAT_PCM_24_BIT_PACKED",
    note: "3 bytes/sample. Packed. DMA alignment is picky.",
  },
  S24_LE: {
    id: "S24_LE",
    label: "S24_LE · 24-in-32",
    bytes: 4,
    usefulBits: 24,
    packed: false,
    android: "AUDIO_FORMAT_PCM_8_24_BIT",
    note: "24 useful bits in a 32-bit container. Not 32-bit SNR.",
  },
  S32_LE: {
    id: "S32_LE",
    label: "S32_LE · 32-bit",
    bytes: 4,
    usefulBits: 32,
    packed: true,
    android: "AUDIO_FORMAT_PCM_32_BIT",
    note: "4 bytes/sample. Confirm Q-format with the codec.",
  },
};

export const DEFAULT_PCM = {
  rate: 48000,
  channels: 2,
  format: "S16_LE",
  periodFrames: 240,
  periodCount: 4,
  tdmSlots: 2,
  path: "pcm",
};

export function clamp(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export function compute(raw = {}) {
  const rate = RATES.includes(+raw.rate) ? +raw.rate : DEFAULT_PCM.rate;
  const channels = CHANNELS.includes(+raw.channels) ? +raw.channels : DEFAULT_PCM.channels;
  const format = FORMATS[raw.format] ? raw.format : DEFAULT_PCM.format;
  const fmt = FORMATS[format];
  const periodFrames = Math.round(clamp(raw.periodFrames, 32, 2048));
  const periodCount = PERIOD_COUNTS.includes(+raw.periodCount)
    ? +raw.periodCount
    : DEFAULT_PCM.periodCount;
  const tdmSlots = TDM_SLOTS.includes(+raw.tdmSlots) ? +raw.tdmSlots : Math.max(2, channels === 1 ? 2 : channels);
  const rawPath = raw.path === "compressed" ? "direct" : raw.path;
  const path = PATHS.includes(rawPath) ? rawPath : "pcm";

  const bytesPerSample = fmt.bytes;
  const frameSize = channels * bytesPerSample;
  const periodBytes = periodFrames * frameSize;
  const bufferFrames = periodFrames * periodCount;
  const bufferBytes = bufferFrames * frameSize;
  const periodMs = (periodFrames * 1000) / rate;
  const bufferMs = periodMs * periodCount;
  const irqHz = rate / periodFrames;
  const bytesPerSec = rate * frameSize;
  const sampleMs = 1000 / rate;
  const unusedSlots = Math.max(0, tdmSlots - channels);
  const slotOverflow = channels > tdmSlots;

  return {
    rate,
    channels,
    format,
    fmt,
    periodFrames,
    periodCount,
    tdmSlots,
    path,
    bytesPerSample,
    frameSize,
    periodBytes,
    bufferFrames,
    bufferBytes,
    periodMs,
    bufferMs,
    irqHz,
    bytesPerSec,
    sampleMs,
    unusedSlots,
    slotOverflow,
    mixable: path === "pcm" || path === "fast",
    exclusive: path === "direct" || path === "offload",
  };
}

export function fmtMs(ms) {
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

export function fmtHz(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 2)} kHz`;
  return `${n.toFixed(n < 10 ? 2 : 1)} Hz`;
}

export function fmtBytes(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)} kB`;
  return `${n} B`;
}

export function dumpLine(m) {
  return `${m.fmt.android} ${m.rate} Hz ch=${m.channels} period=${m.periodFrames} count=${m.periodCount} · ${fmtMs(m.periodMs)} × ${m.periodCount} = ${fmtMs(m.bufferMs)}`;
}

export function metricText(key, m) {
  switch (key) {
    case "periodMs":
      return fmtMs(m.periodMs);
    case "bufferMs":
      return fmtMs(m.bufferMs);
    case "frameSize":
      return `${m.frameSize} B`;
    case "periodBytes":
      return `${m.periodBytes} B`;
    case "irqHz":
      return `${m.irqHz.toFixed(m.irqHz < 10 ? 2 : 0)} /s`;
    case "bytesPerSec":
      return `${fmtBytes(m.bytesPerSec)}/s`;
    case "sampleMs":
      return fmtMs(m.sampleMs);
    case "bytesPerSample":
      return `${m.bytesPerSample} B`;
    case "bufferBytes":
      return `${m.bufferBytes} B`;
    case "rate":
      return fmtHz(m.rate);
    default:
      return "";
  }
}

/** Golden check used by the Phase 2 exit criterion. */
export function golden48000StereoS16() {
  return compute({
    rate: 48000,
    channels: 2,
    format: "S16_LE",
    periodFrames: 240,
    periodCount: 4,
  });
}
