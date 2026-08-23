/** Module 00: six evidence rules from the textbook — not the WHO/WHERE questions. */

const RULES = [
  {
    id: "r1",
    n: "1",
    title: "play() ≠ speaker",
    body: "AudioTrack.play() only proves the Java/native track entered PLAYING. It does not prove voltage at a speaker.",
  },
  {
    id: "r2",
    n: "2",
    title: "RUNNING ≠ analog unmute",
    body: "PCM RUNNING proves the DMA/DAI side is in RUNNING (or transferring). Amp EN and DAPM are a different mute list (Module 11).",
  },
  {
    id: "r3",
    n: "3",
    title: "Policy device ≠ HAL PCM",
    body: "A correct AudioPolicy device name does not prove the HAL opened that card,device. Policy and HAL can disagree when the profile lies.",
  },
  {
    id: "r4",
    n: "4",
    title: "DSP graph ≠ DAC",
    body: "A Qualcomm-like DSP graph “up” does not prove the codec DAC is powered. PAL/AGM/AFE are a different domain (Module 16).",
  },
  {
    id: "r5",
    n: "5",
    title: "No error log ≠ success",
    body: "Many mute and routing failures are silent. Absence of a crash is not positive evidence.",
  },
  {
    id: "r6",
    n: "6",
    title: "One line ≠ verdict",
    body: "Correlate at least two layers (Flinger dump + Policy dump, or PCM status + amp EN) before you name a root cause.",
  },
];

export function mountSixRules(host) {
  host.innerHTML = `
    <div class="six-studio">
      <p class="del-myth">These are <strong>evidence rules</strong>, not the WHO/WHERE questions in the textbook below.
      Next you will <em>see</em> the layers in Module 02.</p>
      <div class="six-grid">
        ${RULES.map(
          (r, i) => `<button type="button" class="mf-card ${i === 0 ? "active" : ""}" data-rule="${r.id}">
            <span class="mf-sub">Rule ${r.n}</span>
            <strong>${r.title}</strong>
          </button>`,
        ).join("")}
      </div>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  const sheet = host.querySelector("[data-sheet]");
  const paint = (id) => {
    const r = RULES.find((x) => x.id === id) || RULES[0];
    host.querySelectorAll("[data-rule]").forEach((b) => b.classList.toggle("active", b.dataset.rule === id));
    sheet.innerHTML = `<p><strong>Rule ${r.n}.</strong> ${r.body}</p>`;
    host._onCaption?.({ who: `Rule ${r.n} · ${r.title}`, fail: r.body });
  };

  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rule]");
    if (b) paint(b.dataset.rule);
  });

  return {
    onCaption(fn) {
      host._onCaption = fn;
    },
    update() {
      paint("r1");
    },
  };
}
