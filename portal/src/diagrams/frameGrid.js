/** Interleaved frame grid: columns are time, rows are channels. One highlighted column = one frame. */
export function mountFrameGrid(host) {
  host.innerHTML = `
    <div class="frame-grid-wrap">
      <div class="frame-grid" data-grid></div>
      <div class="byte-row" data-bytes></div>
    </div>
    <p class="diagram-caption" data-cap></p>`;
  const grid = host.querySelector("[data-grid]");
  const bytes = host.querySelector("[data-bytes]");
  const cap = host.querySelector("[data-cap]");
  let lastKey = "";
  let col = 0;
  let timer = 0;

  function paintCells(m) {
    const cols = 8;
    const ch = m.channels;
    const names = channelNames(ch);
    grid.style.setProperty("--cols", cols);
    grid.innerHTML = "";
    for (let r = 0; r < ch; r++) {
      const lab = document.createElement("div");
      lab.className = "fg-lab";
      lab.textContent = names[r];
      grid.appendChild(lab);
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.className = "fg-cell";
        cell.dataset.c = String(c);
        cell.textContent = "s";
        grid.appendChild(cell);
      }
    }
    bytes.innerHTML = "";
    for (let i = 0; i < m.bytesPerSample; i++) {
      const b = document.createElement("div");
      b.className = "byte-cell" + (!m.fmt.packed && i === m.bytesPerSample - 1 ? " pad" : "");
      b.textContent = !m.fmt.packed && i === m.bytesPerSample - 1 ? "pad" : `b${i}`;
      bytes.appendChild(b);
    }
  }

  function tick(m) {
    col = (col + 1) % 8;
    grid.querySelectorAll(".fg-cell").forEach((el) => {
      el.classList.toggle("now", el.dataset.c === String(col));
    });
  }

  return {
    update(m) {
      const key = `${m.channels}:${m.format}`;
      if (key !== lastKey) {
        lastKey = key;
        paintCells(m);
      }
      cap.innerHTML = `A <strong>sample</strong> is one channel at one instant (${m.bytesPerSample} byte${m.bytesPerSample === 1 ? "" : "s"}, ${m.fmt.usefulBits} useful bits). A <strong>frame</strong> is every channel at that instant = <strong>${m.channels} × ${m.bytesPerSample} = ${m.frameSize} bytes</strong>. ${m.fmt.note}`;
      if (timer) clearInterval(timer);
      const step = Math.max(180, Math.min(900, m.periodMs * 40));
      timer = setInterval(() => tick(m), step);
      tick(m);
    },
    destroy() {
      if (timer) clearInterval(timer);
    },
  };
}

function channelNames(n) {
  if (n === 1) return ["M"];
  if (n === 2) return ["L", "R"];
  if (n === 6) return ["FL", "FR", "FC", "LFE", "SL", "SR"];
  return Array.from({ length: n }, (_, i) => `ch${i}`);
}
