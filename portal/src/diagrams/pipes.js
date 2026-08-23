/** Delivery studio: four AudioFlinger PlaybackThreads.
 *  Direct/Offload skip the mixer. They do not skip AudioFlinger. */

export const THREADS = {
  pcm: {
    id: "pcm",
    title: "MixerThread",
    kitchen: "Everyday mixing desk",
    payload: "Linear PCM samples (L R L R …)",
    burst: "Mixed PCM",
    mix: true,
    skipMixer: false,
    period: "~10–20 ms class (product-specific; deep-buffer can be larger)",
    junior:
      "You hand AudioFlinger raw numbers. One cook (MixerThread) adds everyone who is allowed on this speaker or bus, then pours one PCM stream to the HAL. This is the default media path.",
    engineer:
      "PlaybackThread::threadLoop pulls ACTIVE tracks, applies volume, mixes, optional software effects, then StreamDescriptor.Command.burst of mixed PCM.",
    mp3:
      "Playing an MP3 usually does not mean Offload. MediaCodec unpacks the file to PCM first. Then you land here.",
    nav:
      "Nav can mix or duck on this thread (software). On AAOS, nav often uses a second MixerThread on a second bus so the DSP can duck in hardware.",
    tracks: [
      { id: "media", label: "MEDIA", ok: true },
      { id: "nav", label: "NAV", ok: true },
    ],
    mixLabel: "Software mix → one PCM",
  },
  fast: {
    id: "fast",
    title: "FastMixer",
    kitchen: "Impatient second cook in the same kitchen",
    payload: "Linear PCM, few tracks",
    burst: "Mixed PCM (small period)",
    mix: true,
    skipMixer: false,
    period: "~2–5 ms class",
    junior:
      "Still PCM. Still AudioFlinger. Still a mixer. FastMixer is not a separate HAL output like Direct. It is a low-period helper thread that a MixerThread uses for a few fast tracks. Everyday media often stays on the same output’s MixerThread.",
    engineer:
      "FastMixer is owned by a MixerThread, not a third PlaybackThread type like DirectOutputThread. Fast tracks sit on a tight FIFO. If the app is late, FastMixer mixes silence rather than blocking. ALOGE in this loop can cause the glitch. Heavy software effects may demote a track off the fast path.",
    mp3:
      "An MP3 album almost never belongs here. This is for already-PCM, latency-sensitive streams.",
    nav:
      "A fast nav chime can mix with other fast PCM. A deep-buffer media track is on MixerThread, not FastMixer.",
    tracks: [
      { id: "ui", label: "TOUCH / FAST", ok: true },
      { id: "nav", label: "FAST NAV", ok: true },
    ],
    mixLabel: "Tiny mix, tight deadline",
  },
  direct: {
    id: "direct",
    title: "DirectOutputThread",
    kitchen: "One train, no coupling",
    payload: "One stream as-is (exclusive PCM or compressed passthrough)",
    burst: "That one stream, unmixed",
    mix: false,
    skipMixer: true,
    period: "Matches the stream — not a mixer period",
    junior:
      "Direct does not bypass AudioFlinger. Flinger still owns a PlaybackThread, Policy still chose the output, the HAL still gets I/O. What is skipped is the mixing desk: only one track may board. A second stream (nav) cannot be added into this output.",
    engineer:
      "DirectOutputThread: no AudioMixer. Used for HDMI/SPDIF compressed passthrough (AC3/DTS — the TV decodes) and some exclusive PCM. AUDIO_OUTPUT_FLAG_DIRECT. Passthrough cannot VolumeShaper-mix a PCM nav into an AC3 bitstream.",
    mp3:
      "Two different stories: (1) exclusive PCM after a decoder — still one track, no mix. (2) compressed passthrough — Flinger forwards the zip file; the sink unpacks it.",
    nav:
      "Nav needs another output: another device or another AAOS bus with its own MixerThread. You cannot mix into Direct.",
    tracks: [
      { id: "one", label: "ONE TRACK", ok: true },
      { id: "nav", label: "NAV", ok: false },
    ],
    mixLabel: "No mixer — nav cannot board",
  },
  offload: {
    id: "offload",
    title: "OffloadThread",
    kitchen: "Post office to the DSP kitchen",
    payload: "Compressed frames (AAC, MP3, …) not mixer samples",
    burst: "Encoded frames; DSP decodes",
    mix: false,
    skipMixer: true,
    period: "Burstier than PCM mixer periods",
    junior:
      "Offload also does not bypass AudioFlinger. Flinger’s OffloadThread is a post office: it ships the zip file to the DSP, and the DSP unpacks it. Flinger does not mix PCM here, so it cannot add nav into the same stream.",
    engineer:
      "OffloadThread writes encoded frames to the HAL. Pause, flush, gapless, and XRUN semantics differ from MixerThread. Software duck may not apply; AAOS needs a separate PCM bus for nav/chimes. AUDIO_OUTPUT_FLAG_COMPRESS_OFFLOAD.",
    mp3:
      "This is the path where the file stays compressed until the DSP. It is not the default. Policy + HAL must advertise offload for that format. If they do not, MediaPlayer decodes in the framework and you are back on MixerThread.",
    nav:
      "Impossible on this thread. Play nav on a MixerThread (another bus or speaker) or the DSP never hears a second PCM.",
    tracks: [
      { id: "enc", label: "ENCODED MEDIA", ok: true },
      { id: "nav", label: "NAV", ok: false },
    ],
    mixLabel: "DSP decode — no Flinger mix",
  },
};

export function mountPipes(host) {
  host.innerHTML = `
    <div class="del-studio">
      <p class="del-myth"><strong>Myth:</strong> “Direct / Offload bypass AudioFlinger.” <strong>Fact:</strong> they skip the <em>software mixer</em>. Policy still routes. A PlaybackThread still runs inside <code>audioserver</code>. The HAL still gets I/O.</p>
      <div class="del-picks">
        ${Object.values(THREADS)
          .map(
            (t) => `<button type="button" class="del-pick" data-pipe="${t.id}">
              <span class="del-pick-k">${t.kitchen}</span>
              <strong>${t.title}</strong>
              <span class="del-pick-m">${t.mix ? "Mixes PCM" : "Does not mix"}</span>
            </button>`,
          )
          .join("")}
      </div>
      <div class="del-grid">
        <ol class="del-stack">
          <li class="del-hop" data-hop="app"><span class="del-who">App</span><strong data-app>AudioTrack / MediaPlayer</strong><p data-app-p></p></li>
          <li class="del-flow" aria-hidden="true"><i></i></li>
          <li class="del-hop hot"><span class="del-who">Always</span><strong>AudioPolicy</strong><p>Picks the output and the flags. Direct/Offload are Policy decisions, not a Flinger bug.</p></li>
          <li class="del-flow" aria-hidden="true"><i></i></li>
          <li class="del-hop hot del-flinger"><span class="del-who">Always · AudioFlinger</span><strong data-th></strong><p data-th-p></p>
            <div class="del-bay" data-bay></div>
          </li>
          <li class="del-flow" aria-hidden="true"><i></i></li>
          <li class="del-hop hot"><span class="del-who">Always</span><strong>Audio HAL</strong><p data-hal></p></li>
          <li class="del-flow" aria-hidden="true"><i></i></li>
          <li class="del-hop"><span class="del-who">Device</span><strong data-dev>Speaker / HDMI / AAOS bus</strong><p data-dev-p></p></li>
        </ol>
        <aside class="del-sheet">
          <div class="del-flags">
            <span class="del-flag on">In AudioFlinger</span>
            <span class="del-flag" data-mix-flag></span>
          </div>
          <p data-junior></p>
          <p class="del-eng" data-engineer></p>
          <p><strong>MP3 trap.</strong> <span data-mp3></span></p>
          <p><strong>Can nav join?</strong> <span data-navjoin></span></p>
          <p class="muted">Long form: <a href="#/learn/00b">Module 00b</a> · threads: <a href="#/learn/06">Module 06</a> · APIs: <a href="#/learn/04">Module 04</a></p>
        </aside>
      </div>
      <div class="table-wrap">
        <table class="skill-grid del-table">
          <thead>
            <tr>
              <th></th>
              <th>MixerThread</th>
              <th>FastMixer</th>
              <th>DirectOutputThread</th>
              <th>OffloadThread</th>
            </tr>
          </thead>
          <tbody>
            <tr><th>Inside AudioFlinger?</th><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
            <tr><th>Software mixer?</th><td>Yes, many tracks</td><td>Yes, few fast tracks</td><td>No — one track</td><td>No — one track</td></tr>
            <tr><th>What the app writes</th><td>PCM samples</td><td>PCM samples</td><td>PCM or compressed as-is</td><td>Compressed frames</td></tr>
            <tr><th>Who decodes MP3/AAC</th><td>Usually MediaCodec, then mix</td><td>Already PCM</td><td>Sink if passthrough</td><td>DSP</td></tr>
            <tr><th>Nav on this output</th><td>Can mix / duck</td><td>Only if nav is also fast</td><td>Impossible</td><td>Impossible</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;

  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pipe]");
    if (b && host._onPath) host._onPath(b.dataset.pipe);
  });

  return {
    onPath(fn) {
      host._onPath = fn;
    },
    update(m) {
      const t = THREADS[m.path] || THREADS.pcm;
      host.dataset.path = t.id;
      host.querySelectorAll("[data-pipe]").forEach((el) => {
        el.classList.toggle("active", el.dataset.pipe === t.id);
      });
      host.querySelector("[data-app]").textContent = t.mix
        ? "App writes PCM (AudioTrack / AAudio / decoded MediaPlayer)"
        : t.id === "offload"
          ? "App / MediaPlayer writes encoded frames"
          : "App writes one exclusive stream (PCM or compressed)";
      host.querySelector("[data-app-p]").textContent = t.payload;
      host.querySelector("[data-th]").textContent = `${t.title} · still inside AudioFlinger`;
      host.querySelector("[data-th-p]").textContent = `${t.kitchen}. Period: ${t.period}.`;
      host.querySelector("[data-hal]").textContent = t.mix
        ? "Command.burst of mixed PCM (AIDL). HIDL write() is history on Android 15."
        : t.id === "offload"
          ? "HAL receives compressed bursts. DSP unpacks. Not a mixer period."
          : "HAL receives that one stream unmixed. Sink or codec may decode.";
      host.querySelector("[data-dev-p]").textContent = t.mix
        ? "One PCM at the pins of this output. Two app streams already became one mix."
        : "Still one stream. A second meaning (nav) needs a second output.";
      const bay = host.querySelector("[data-bay]");
      bay.innerHTML = t.tracks
        .map(
          (tr) =>
            `<span class="del-trk ${tr.ok ? "ok" : "no"}">${tr.label}${tr.ok ? "" : " · blocked"}</span>`,
        )
        .join(`<span class="del-plus">${t.mix ? "+" : "✕"}</span>`) +
        `<span class="del-eq">${t.mixLabel}</span>`;
      const mixFlag = host.querySelector("[data-mix-flag]");
      mixFlag.textContent = t.skipMixer ? "Mixer skipped" : "Mixer runs";
      mixFlag.classList.toggle("warn", t.skipMixer);
      mixFlag.classList.toggle("on", !t.skipMixer);
      host.querySelector("[data-junior]").textContent = t.junior;
      host.querySelector("[data-engineer]").textContent = t.engineer;
      host.querySelector("[data-mp3]").textContent = t.mp3;
      host.querySelector("[data-navjoin]").textContent = t.nav;
      const col = { pcm: 1, fast: 2, direct: 3, offload: 4 }[t.id] || 1;
      host.querySelectorAll(".del-table tr").forEach((tr) => {
        [...tr.children].forEach((cell, i) => cell.classList.toggle("on", i === 0 || i === col));
      });
    },
  };
}
