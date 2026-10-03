/** Module 22: live AOSP walk. File names from cs.android.com — not vendor trees. */

const CS = "https://cs.android.com/android/platform/superproject/+/android-latest-release:";

const WALKS = {
  play: {
    title: "play() → burst",
    steps: [
      { name: "AudioTrack.play()", file: "frameworks/base/media/java/android/media/AudioTrack.java", note: "App process. PLAYING is not acoustic energy." },
      { name: "native_start / JNI", file: "frameworks/base/core/jni/android_media_AudioTrack.cpp", note: "Still the app process." },
      { name: "AudioTrack::start", file: "frameworks/av/media/libaudioclient/AudioTrack.cpp", note: "IAudioTrack Binder to audioserver." },
      { name: "IAudioFlinger.createTrack", file: "frameworks/av/services/audioflinger/AudioFlinger.cpp", note: "Construction already routed. App does not Binder to Policy." },
      { name: "getOutputForAttr", file: "frameworks/av/services/audiopolicy/service/AudioPolicyService.cpp", note: "Flinger asks Policy. Peer, not a stack." },
      { name: "PlaybackThread / Track::start", file: "frameworks/av/services/audioflinger/Threads.cpp", note: "If STANDBY, the next write sends Command.start/burst on the already open HAL stream." },
      { name: "IModule.openOutputStream", file: "hardware/interfaces/audio/aidl/android/hardware/audio/core/IModule.aidl", note: "AIDL. HIDL IStreamOut.write() is history." },
      { name: "Command.burst", file: "hardware/interfaces/audio/aidl/android/hardware/audio/core/StreamDescriptor.aidl", note: "Write audio.fmq, then burst. HAL must empty the FMQ." },
    ],
  },
  route: {
    title: "attributes → device",
    steps: [
      { name: "native_setup / createTrack", file: "frameworks/av/media/libaudioclient/AudioTrack.cpp", note: "Attributes travel with createTrack." },
      { name: "AudioFlinger::createTrack", file: "frameworks/av/services/audioflinger/AudioFlinger.cpp", note: "Then getOutputForAttr — not a second app Binder to Policy." },
      { name: "AudioPolicyManager::getOutputForAttr", file: "frameworks/av/services/audiopolicy/managerdefault/AudioPolicyManager.cpp", note: "Phone: usage → strategy → device. AAOS: usage → mix / bus address." },
      { name: "openOutput (if needed)", file: "frameworks/av/services/audioflinger/AudioFlinger.cpp", note: "Policy client asks Flinger to open. Policy does not pcm_open." },
    ],
  },
};

export function mountSourceHops(host) {
  host.innerHTML = `
    <div class="hop-studio">
      <p class="del-myth"><strong>Do not memorize AOSP.</strong> Walk Binder boundaries. File names shift; symbols last. Stop when you leave AOSP for vendor code (PAL/AGM are not these trees).</p>
      <div class="sd-tabs">
        <button type="button" class="active" data-walk="play">Walk 1 · play() → burst</button>
        <button type="button" data-walk="route">Walk 2 · attributes → device</button>
      </div>
      <svg class="viz-svg" viewBox="0 0 920 168" role="img" aria-label="AOSP source walk">
        <g data-graph></g>
      </svg>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  let walk = "play";
  let idx = 0;
  const graph = host.querySelector("[data-graph]");
  const sheet = host.querySelector("[data-sheet]");

  const paint = () => {
    const w = WALKS[walk];
    host.querySelectorAll("[data-walk]").forEach((b) => b.classList.toggle("active", b.dataset.walk === walk));
    const n = w.steps.length;
    const box = Math.min(108, (900 - (n - 1) * 8) / n);
    const gap = 8;
    const x0 = (920 - (n * box + (n - 1) * gap)) / 2;
    graph.innerHTML = w.steps
      .map((s, i) => {
        const x = x0 + i * (box + gap);
        const on = i === idx;
        const edge =
          i < n - 1
            ? `<g class="viz-edge" data-kind="${i < 3 ? "control" : "data"}">
                <path id="sh-${i}" d="M ${x + box} 80 L ${x + box + gap} 80" fill="none"/>
                ${on ? `<circle class="pipe-pkt" r="3.5"><animateMotion dur="0.9s" repeatCount="indefinite"><mpath href="#sh-${i}"/></animateMotion></circle>` : ""}
              </g>`
            : "";
        return `${edge}<g class="viz-node ${on ? "is-sel" : ""}" data-hop="${i}">
          <rect x="${x}" y="28" width="${box}" height="112" rx="12"/>
          <foreignObject x="${x + 6}" y="34" width="${box - 12}" height="100">
            <div xmlns="http://www.w3.org/1999/xhtml" class="pipe-fo">
              <span class="pipe-kicker">${i + 1}</span>
              <strong class="pipe-title">${s.name}</strong>
            </div>
          </foreignObject>
        </g>`;
      })
      .join("");
    const s = w.steps[idx];
    sheet.innerHTML = `<p><strong>${s.name}</strong></p>
      <p class="muted"><a href="${CS}${s.file}" target="_blank" rel="noreferrer">${s.file}</a></p>
      <p>${s.note}</p>`;
    host._onCaption?.({ who: s.name, fail: s.note });
  };

  host.addEventListener("click", (e) => {
    const wbtn = e.target.closest("[data-walk]");
    if (wbtn) {
      walk = wbtn.dataset.walk;
      idx = 0;
      paint();
      return;
    }
    const h = e.target.closest("[data-hop]");
    if (h) {
      idx = +h.dataset.hop;
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
