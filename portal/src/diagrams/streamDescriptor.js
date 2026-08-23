/** Module 08: StreamDescriptor.aidl — three FMQs. Official output SM: stream-out-sm.gv. */

const STATES = [
  {
    id: "STANDBY",
    note: "Initial after openOutputStream, and after Command.standby from IDLE. Producer and consumer inactive. Hardware may sleep. Buffer treated empty.",
    next: "start → IDLE. (burst without start → PAUSED: producer fills while HW still off — MixerThread does not do this.)",
  },
  {
    id: "IDLE",
    note: "After Command.start. Hardware is on. Output buffer is empty; HW may emit zeros. xrunFrames is not counted — the client is not in periodic I/O yet.",
    next: "burst → ACTIVE. standby → STANDBY.",
  },
  {
    id: "ACTIVE",
    note: "After burst from IDLE (or start from PAUSED). Periodic I/O expected. Late client is an xrun. Reply.xrunFrames is for the previous transfer.",
    next: "burst stays ACTIVE. pause → PAUSED. drain → DRAINING.",
  },
  {
    id: "PAUSED",
    note: "Command.pause: consumer off. Output HW emits silence. Burst while paused writes into the buffer and stays PAUSED. Resume is Command.start → ACTIVE, not a new openOutputStream. flush → IDLE (buffer cleared).",
    next: "start → ACTIVE. burst stays PAUSED. flush → IDLE. There is no Command.standby from PAUSED in stream-out-sm.gv.",
  },
  {
    id: "DRAINING",
    note: "Command.drain: producer off; consumer empties the buffer. Completes to IDLE when empty. Burst during drain returns to ACTIVE.",
    next: "empty → IDLE. burst → ACTIVE. pause → DRAIN_PAUSED (then start to resume drain).",
  },
  {
    id: "ERROR",
    note: "Unrecoverable lower-layer failure. The command queue is done. Only legal next step is IStreamCommon.close. More burst will not heal it.",
    next: "close only.",
  },
];

export function mountStreamDescriptor(host) {
  host.innerHTML = `
    <div class="sd-studio">
      <div class="sd-tabs">
        <button type="button" class="active" data-era="aidl">AIDL · this course</button>
        <button type="button" data-era="hidl">HIDL · history</button>
      </div>
      <div class="sd-aidl" data-aidl>
        <ol class="sd-seq arch-seq">
          <li><span>1</span> Flinger writes PCM into <code>audio.fmq</code> (transient — not a ring to store in)</li>
          <li><span>2</span> Flinger writes <code>Command.burst(byteCount)</code> on <code>command.fmq</code> (one slot), waits on <code>reply.fmq</code></li>
          <li><span>3</span> HAL high-priority thread wakes, reads the command, and <em>must empty</em> <code>audio.fmq</code> even if it cannot use every byte</li>
          <li><span>4</span> Reply: <code>status</code>, <code>fmqByteCount</code> (consumed), <code>observable</code>, <code>latencyMs</code>, <code>xrunFrames</code>, <code>state</code>. Flinger resends any remainder next burst</li>
        </ol>
        <div class="sd-fmq">
          <div class="sd-box" data-fmq="cmd"><strong>command.fmq</strong><span>one slot · getStatus · start · burst · pause · flush · drain · standby</span></div>
          <div class="sd-box" data-fmq="audio"><strong>audio.fmq</strong><span>Empty it on burst. fmqByteCount may be smaller; remainder is resent.</span><i class="sd-pkt"></i></div>
          <div class="sd-box" data-fmq="reply"><strong>reply.fmq</strong><span>status · fmqByteCount · observable · latencyMs · xrunFrames · state</span></div>
        </div>
        <p class="sd-burst muted">This is not HIDL <code>IStreamOut.write()</code>. Policy’s <code>IModule.getAudioPorts</code> / <code>IConfig</code> is a different conversation — topology, not this FMQ. <code>Reply.hardware</code> is MMap-only.</p>
        <div class="sd-states">
          ${STATES.map((s) => `<button type="button" class="sd-st" data-st="${s.id}">${s.id}</button>`).join("")}
        </div>
        <p class="muted">Happy path: <code>STANDBY --start→ IDLE --burst→ ACTIVE</code>. Resume from PAUSED is <code>start</code>, not burst. Also in the IDL (not drawn): <code>DRAIN_PAUSED</code>; <code>TRANSFERRING</code> / <code>TRANSFER_PAUSED</code> only if the HAL uses async burst.</p>
      </div>
      <div class="sd-hidl" data-hidl hidden>
        <p class="del-myth">HIDL <code>android.hardware.audio@7.1</code>: <code>IDevicesFactory</code> + <code>IDevice</code> + <code>IStreamOut.write()</code>. Config XML was APM input. After Android 14, new HAL APIs are AIDL-only. Do not debug Android 15 as if <code>write()</code> were the I/O primitive.</p>
      </div>
      <aside class="mf-sheet" data-sheet></aside>
    </div>`;

  let era = "aidl";
  let st = "ACTIVE";
  const sheet = host.querySelector("[data-sheet]");

  const paint = () => {
    host.querySelectorAll("[data-era]").forEach((b) => b.classList.toggle("active", b.dataset.era === era));
    host.querySelector("[data-aidl]").hidden = era !== "aidl";
    host.querySelector("[data-hidl]").hidden = era !== "hidl";
    host.querySelectorAll("[data-st]").forEach((b) => b.classList.toggle("active", b.dataset.st === st));
    host.querySelector("[data-fmq='audio']").classList.toggle("live", era === "aidl" && (st === "ACTIVE" || st === "PAUSED"));
    if (era === "hidl") {
      sheet.innerHTML = `<p>History only. The Android 15 I/O sentence is: write <code>audio.fmq</code>, then <code>Command.burst</code>.</p>`;
      host._onCaption?.({ who: "HIDL (history)", fail: "IStreamOut.write() is not the Android 15 path." });
      return;
    }
    const s = STATES.find((x) => x.id === st) || STATES[2];
    sheet.innerHTML = `<p><strong>${s.id}.</strong> ${s.note}</p>
      <p class="muted">Next: ${s.next}</p>
      <p class="muted">HAL <code>STANDBY</code> is not Flinger’s PlaybackThread standby — though Flinger uses <code>Command.standby</code> to get here, and may then <code>IStreamCommon.close</code>.</p>`;
    host._onCaption?.({ who: `StreamDescriptor · ${s.id}`, fail: s.note });
  };

  host.addEventListener("click", (e) => {
    const eraBtn = e.target.closest("[data-era]");
    if (eraBtn) {
      era = eraBtn.dataset.era;
      paint();
      return;
    }
    const btn = e.target.closest("[data-st]");
    if (btn) {
      st = btn.dataset.st;
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
