/** Channels vs TDM slots studio.
 *  Channel = one sample in a PCM frame (same instant).
 *  Slot    = one time apartment on a serial wire (I2S/TDM). */

const DEMOS = [
  { id: "i2s", label: "Stereo I2S", channels: 2, tdmSlots: 2 },
  { id: "st8", label: "Stereo on 8-slot amp", channels: 2, tdmSlots: 8 },
  { id: "51", label: "5.1 (6ch) on 8-slot", channels: 6, tdmSlots: 8 },
  { id: "match8", label: "8ch fills 8 slots", channels: 8, tdmSlots: 8 },
  { id: "overflow", label: "6ch into 2 slots", channels: 6, tdmSlots: 2 },
];

const AMP8 = ["FL", "FR", "RL", "RR", "C", "LFE", "CHIME", "RSV"];

export function mountTdm(host) {
  host.innerHTML = `
    <div class="tdm-studio">
      <p class="del-myth"><strong>Myth:</strong> “6 channels means 6 TDM slots” or “TDM slots are speakers in car XML.”
      <strong>Fact:</strong> a <em>channel</em> is a sample inside one PCM snapshot. A <em>slot</em> is a time apartment on a serial pin. They are two contracts. Policy / <code>car_audio_configuration.xml</code> does not program the slot map.</p>

      <div class="tdm-demos">
        ${DEMOS.map((d) => `<button type="button" class="btn-ghost" data-tdm-demo="${d.id}">${d.label}</button>`).join("")}
        <button type="button" class="btn-ghost" data-tdm-shift>Simulate FSYNC shift</button>
      </div>

      <div class="tdm-pair">
        <section class="tdm-col">
          <h3>Android / PCM frame · same instant</h3>
          <p class="muted">One column = one frame. Every channel is photographed together. This is what Flinger mixed (or the app wrote).</p>
          <div class="tdm-frame" data-frame></div>
          <p class="tdm-eq" data-frame-eq></p>
        </section>
        <div class="tdm-map-arrow" aria-hidden="true">→ wire →</div>
        <section class="tdm-col">
          <h3>TDM / I2S wire · one after another</h3>
          <p class="muted">One FSYNC period. Slots are time, not simultaneous speakers. The amp listens to <em>slot numbers</em>.</p>
          <div class="tdm-wire">
            <span class="tdm-fsync">FSYNC</span>
            <div class="tdm-row" data-slots></div>
          </div>
          <p class="tdm-eq" data-wire-eq></p>
        </section>
      </div>

      <div class="del-grid">
        <aside class="del-sheet">
          <div class="del-flags">
            <span class="del-flag on" data-fit-flag></span>
            <span class="del-flag" data-shift-flag></span>
          </div>
          <p data-junior></p>
          <p class="del-eng" data-engineer></p>
          <p><strong>Architect.</strong> <span data-architect></span></p>
          <p><strong>Who owns the map?</strong> <span data-owner></span></p>
          <p class="muted">Long form: <a href="#/learn/00b">Module 00b</a> · DAI/TDM: <a href="#/learn/10">Module 10</a> · PCM open: <a href="#/learn/09">Module 09</a></p>
        </aside>
        <div class="table-wrap">
          <table class="skill-grid del-table">
            <thead>
              <tr><th></th><th>Android channel</th><th>TDM slot</th></tr>
            </thead>
            <tbody>
              <tr><th>What</th><td>One sample in a PCM frame</td><td>One time apartment on BCLK/FSYNC/DOUT</td></tr>
              <tr><th>When</th><td>Same instant as the other channels</td><td>One after another, then FSYNC repeats</td></tr>
              <tr><th>Typical count</th><td>1, 2, 6 (5.1), 8</td><td>2 (I2S), 4, 8, 16</td></tr>
              <tr><th>Name</th><td>Channel mask: FL, FR, C, LFE…</td><td>Slot index 0..N-1, plus TX/RX mask</td></tr>
              <tr><th>Owner</th><td>App format → Flinger mix → HAL PCM</td><td>CPU DAI + codec DAI (<code>set_tdm_slot</code>)</td></tr>
              <tr><th>Fail</th><td>Wrong count → EINVAL / silence</td><td>Shifted map → wrong speaker, Policy innocent</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  let shift = 0;
  let lastSlots = -1;
  const row = host.querySelector("[data-slots]");
  const frame = host.querySelector("[data-frame]");

  host.addEventListener("click", (e) => {
    const demo = e.target.closest("[data-tdm-demo]");
    if (demo && host._onPatch) {
      const d = DEMOS.find((x) => x.id === demo.dataset.tdmDemo);
      if (d) host._onPatch({ channels: d.channels, tdmSlots: d.tdmSlots });
      return;
    }
    if (e.target.closest("[data-tdm-shift]")) {
      shift = shift ? 0 : 1;
      if (host._paint) host._paint();
    }
  });

  function paint(m) {
    const names = channelNames(m.channels);
    const slots = m.tdmSlots;
    const overflow = m.channels > slots;
    const unused = Math.max(0, slots - m.channels);

    if (slots !== lastSlots) {
      lastSlots = slots;
      row.innerHTML = "";
      for (let i = 0; i < slots; i++) {
        const s = document.createElement("div");
        s.className = "tdm-slot";
        s.dataset.i = String(i);
        row.appendChild(s);
      }
    }

    frame.innerHTML = names
      .map((n, i) => {
        const dest = overflow ? "—" : (i + shift) % slots;
        return `<div class="tdm-ch"><span class="tdm-ch-i">ch${i}</span><strong>${n}</strong><span class="tdm-ch-to">${overflow ? "no slot" : `→ slot ${dest}`}</span></div>`;
      })
      .join("");

    const occupying = new Map();
    if (!overflow) {
      names.forEach((n, i) => occupying.set((i + shift) % slots, n));
    }

    row.querySelectorAll(".tdm-slot").forEach((el, i) => {
      const who = occupying.get(i);
      el.classList.toggle("live", !!who);
      el.classList.toggle("zero", !who && !overflow);
      el.classList.toggle("overflow", overflow);
      el.classList.toggle("shifted", shift && !!who);
      const amp = slots === 8 ? AMP8[i] : slots === 2 ? ["L", "R"][i] : `s${i}`;
      el.innerHTML = `<span class="tdm-slot-i">slot ${i}</span><strong>${who || (overflow ? "clash" : "0")}</strong><span class="tdm-slot-amp">${amp}</span>`;
    });

    host.querySelector("[data-frame-eq]").textContent =
      `frame_size = ${m.channels} ch × ${m.bytesPerSample} B = ${m.frameSize} B. 6 channels is 5.1 (six named speakers in software), not “TDM-6.”`;
    host.querySelector("[data-wire-eq]").textContent = overflow
      ? `${m.channels} channels cannot fit in ${slots} slots. The serializer has no apartments left. This is a DAI/format bug, not a Policy bug.`
      : unused
        ? `${unused} apartments stay 0 (or another occupant). BCLK ≈ ${m.rate} × ${slots} × 32 ≈ ${((m.rate * slots * 32) / 1e6).toFixed(3)} MHz if slot width is 32.`
        : `Counts match. Still check slot width (16-bit sample in a 32-bit apartment is normal) and TX mask.`;

    const fit = host.querySelector("[data-fit-flag]");
    fit.textContent = overflow ? "Does not fit" : unused ? "Spare slots" : "Counts match";
    fit.classList.toggle("warn", overflow || unused);
    fit.classList.toggle("on", !overflow);
    const sf = host.querySelector("[data-shift-flag]");
    sf.textContent = shift ? "FSYNC shift ON" : "Map ch i → slot i";
    sf.classList.toggle("warn", !!shift);

    host.querySelector("[data-junior]").textContent = juniorCopy(m, overflow, unused, shift);
    host.querySelector("[data-engineer]").textContent = engineerCopy(m, overflow, shift);
    host.querySelector("[data-architect]").textContent = architectCopy(m, overflow, shift, slots);
    host.querySelector("[data-owner]").textContent =
      "Channel count lives on the PCM (app → Flinger → TinyALSA hw_params). Slot count, slot width, and TX/RX mask live on the DAI (CPU + codec). car_audio_configuration.xml names buses, not TDM apartments.";

    host.querySelectorAll("[data-tdm-demo]").forEach((b) => {
      const d = DEMOS.find((x) => x.id === b.dataset.tdmDemo);
      b.classList.toggle("active", d && d.channels === m.channels && d.tdmSlots === m.tdmSlots);
    });
    host.querySelector("[data-tdm-shift]").classList.toggle("active", !!shift);
  }

  host._paint = () => {};
  return {
    onPatch(fn) {
      host._onPatch = fn;
    },
    update(m) {
      host._paint = () => paint(m);
      paint(m);
    },
  };
}

function channelNames(n) {
  if (n === 1) return ["Mono"];
  if (n === 2) return ["L", "R"];
  if (n === 6) return ["FL", "FR", "FC", "LFE", "RL", "RR"];
  if (n === 8) return ["FL", "FR", "FC", "LFE", "RL", "RR", "SL", "SR"];
  return Array.from({ length: n }, (_, i) => `ch${i}`);
}

function juniorCopy(m, overflow, unused, shift) {
  if (overflow) {
    return `Think of a family photo (${m.channels} people) trying to walk through a revolving door with only ${m.tdmSlots} apartments. They do not fit. The wire cannot carry that PCM layout. Nobody “routes” extra people onto new speakers from Policy.`;
  }
  if (shift) {
    return `FSYNC polarity (frame-sync upside down) is like rotating the revolving door one apartment. Every person still exists, but they walk into the neighbour’s room. Media plays on the tweeter that should be chime. Policy’s bus address is still correct.`;
  }
  if (m.channels === 6) {
    return `6 channels means 5.1: six named people in one photo (front L/R, center, sub, surround L/R). It does not mean “TDM-6.” Car amps often have an 8-apartment door. Two apartments stay empty — or belong to chime / another occupant. Silence on those speakers is expected unless something upmixes.`;
  }
  if (m.channels === 2 && m.tdmSlots > 2) {
    return `Stereo is two people in the photo. The door has ${m.tdmSlots} apartments. Only two get a person; the rest are zeros. The extra speakers do not magically play a copy. If you hear two of eight, the layer is DAI/HAL packing, not “Policy forgot the other seats.”`;
  }
  if (m.tdmSlots === 2) {
    return `Two slots is the I2S picture: left apartment, then right apartment, then FSYNC repeats. Both people were photographed at the same instant; they just walk through the door one at a time.`;
  }
  return `A channel is “who is in the snapshot.” A slot is “which time apartment on the cable.” Same numbers can still be the wrong map.`;
}

function engineerCopy(m, overflow, shift) {
  if (overflow) {
    return `hw_params channels=${m.channels} cannot be serialized into ${m.tdmSlots} slots without downmix. Expect EINVAL, a driver warning, or a HAL that quietly downmixes — ask the PCM open, do not assume Policy.`;
  }
  return `ALSA period is in frames, and a frame still has ${m.channels} samples. TDM parameters are separate: slot count, slot width (often 32), sample width (16/24/32), TX/RX mask. 16-bit PCM in a 32-bit slot is padding, not extra SNR. ${shift ? "One inverted FSYNC on 8-slot TDM shifts every slot by one." : `Default teaching map is ch i → slot i. Real boards use a mask, not this even fill.`}`;
}

function architectCopy(m, overflow, shift, slots) {
  const bclk = (m.rate * slots * 32) / 1e6;
  const countMatch =
    !overflow && m.channels === 8 && slots === 8
      ? " Count 8=8 can still be wrong: 7.1 names (SL/SR) are not a car amp map (chime/RSV). Count match ≠ speaker match."
      : "";
  return `BCLK ≈ rate × slots × slot_width. At ${m.rate / 1000} kHz, ${slots} slots, 32-bit apartments → ~${bclk.toFixed(3)} MHz. Two AAOS occupants can share one TDM line in different slots; that is not two Flinger channels appearing by magic. If Flinger’s bus address matches XML and the wrong speaker sings, leave Policy — you are in slot map / amp. ${overflow ? "Fix the FE channel count or the BE slot count so they are a designed pair." : shift ? "Fix DAI format/polarity, not car XML." : "Do not invent a slot map. Read the amp datasheet and the machine driver’s set_tdm_slot."}${countMatch}`;
}
