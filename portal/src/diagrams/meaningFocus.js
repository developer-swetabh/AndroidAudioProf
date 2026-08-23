/** Module 05: Attributes/Usage, Focus, and Routing are three different levers. */

const CARDS = [
  {
    id: "meaning",
    title: "Meaning · AudioAttributes",
    sub: "The badge",
    body: "Usage is the job title Policy keys on: USAGE_MEDIA, USAGE_ASSISTANCE_NAVIGATION_GUIDANCE, USAGE_VOICE_COMMUNICATION, …. Content type is the payload (speech vs music). Flags are extra requests (low latency, HW AV sync). This describes why the stream exists — not which speaker is wired.",
    fail: "On AAOS, a nav app that sets USAGE_MEDIA matches CarAudioContext.MUSIC and lands on the media bus. Badge bug, not a TDM slot.",
    aosp: "AudioAttributes.USAGE_* · CONTENT_TYPE_* · flags · tags",
  },
  {
    id: "focus",
    title: "Focus · right-of-way",
    sub: "The intersection",
    body: "Permission to be prominent — not a device. App calls AudioManager.requestAudioFocus → Binder IAudioService → AudioService. Phone: MediaFocusControl (GAIN / LOSS / MAY_DUCK, mostly cooperative). AAOS: CarAudioService registers a focus policy; CarAudioFocus applies exclusive / reject / concurrent per zone.",
    fail: "Requesting focus does not call getOutputForAttr. An app can ignore LOSS; mute/fade is enforcement, not a new route.",
    aosp: "AudioManager.requestAudioFocus → IAudioService → AudioService → MediaFocusControl; AAOS: CarAudioFocus via registerAudioPolicy (not a second app Binder)",
  },
  {
    id: "route",
    title: "Routing · the lane",
    sub: "Where PCM goes",
    body: "Decided when the track is created, not when focus is granted. Phone: usage → strategy → device. AAOS: usage → CarAudioContext → bus address (AudioPolicyMix). Flinger asks Policy: createTrack → AudioSystem.getOutputForAttr.",
    fail: "Live patch ≠ possible ports. Two contexts on one BUS_MEDIA → one PCM at the DSP; hardware duck is impossible.",
    aosp: "IAudioFlinger.createTrack → AudioSystem.getOutputForAttr → AudioPolicyService",
  },
];

export function mountMeaningFocus(host) {
  host.innerHTML = `
    <div class="mf-studio">
      <p class="del-myth"><strong>Myth:</strong> “If I request audio focus, it will play on the right speakers.”
      <strong>Fact:</strong> Focus is the intersection. Routing is the lane (getOutputForAttr). Usage is the badge Policy reads during createTrack — Flinger asks, the app does not Binder to Policy.</p>
      <div class="mf-row">
        ${CARDS.map(
          (c, i) => `
          <button type="button" class="mf-card ${i === 0 ? "active" : ""}" data-mf="${c.id}">
            <span class="mf-sub">${c.sub}</span>
            <strong>${c.title}</strong>
          </button>
          ${i < CARDS.length - 1 ? `<div class="mf-gap" aria-hidden="true">≠</div>` : ""}`,
        ).join("")}
      </div>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const sheet = host.querySelector("[data-sheet]");
  const paint = (id) => {
    const c = CARDS.find((x) => x.id === id) || CARDS[0];
    host.querySelectorAll("[data-mf]").forEach((b) => b.classList.toggle("active", b.dataset.mf === id));
    sheet.innerHTML = `
      <p>${c.body}</p>
      <p class="invent">${c.fail}</p>
      <p class="muted"><code>${c.aosp}</code></p>`;
    host._onCaption?.({ who: c.title, fail: c.fail });
  };

  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mf]");
    if (b) paint(b.dataset.mf);
  });

  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      paint("meaning");
    },
  };
}
