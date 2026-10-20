// ---------- Contador de rendimiento: FPS y milisegundos por cuadro ----------
// Se muestra con ?perf en la URL o con la tecla F2. Separa el tiempo de la física (pasos a 60 Hz
// fijos), del dibujo (render) y de la interfaz HTML (marcador y menús). Son tiempos de CPU:
// lo que tarda la GPU se nota en el intervalo entre cuadros (FPS), no en "render".
const SAMPLE_MS = 500;

export const perf = {
  on: new URLSearchParams(location.search).has('perf'),
  frame: { t0: 0, physics: 0, render: 0, ui: 0, steps: 0 },
  acc: null,
  el: null
};

function resetAcc(now) {
  perf.acc = { start: now, frames: 0, physics: 0, render: 0, ui: 0, steps: 0, worstFrame: 0, last: now, intervals: [] };
}

// Mide fn() y suma su duración al apartado indicado del cuadro actual
export function timed(part, fn) {
  if (!perf.on) return fn();
  const t = performance.now();
  const r = fn();
  perf.frame[part] += performance.now() - t;
  return r;
}

export function countStep() { if (perf.on) perf.frame.steps++; }

export function endFrame(now) {
  if (!perf.on) return;
  if (!perf.acc) resetAcc(now);
  const a = perf.acc, f = perf.frame;
  const interval = now - a.last;
  a.last = now;
  if (a.frames > 0) { a.intervals.push(interval); a.worstFrame = Math.max(a.worstFrame, interval); }
  a.frames++;
  a.physics += f.physics; a.render += f.render; a.ui += f.ui; a.steps += f.steps;
  f.physics = f.render = f.ui = f.steps = 0;
  if (now - a.start >= SAMPLE_MS && a.frames > 1) {
    show(a, now);
    resetAcc(now);
  }
}

function show(a, now) {
  if (!perf.el) {
    perf.el = document.createElement('pre');
    Object.assign(perf.el.style, {
      position: 'fixed', top: '8px', right: '8px', zIndex: 100000, margin: 0, padding: '6px 9px',
      background: 'rgba(0, 0, 0, 0.78)', color: '#d7ff3a', font: '12px/1.35 Consolas, monospace',
      borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'pre'
    });
    document.body.appendChild(perf.el);
  }
  const n = a.frames, secs = (now - a.start) / 1000;
  const iv = a.intervals.slice().sort((x, y) => x - y);
  const p95 = iv.length ? iv[Math.min(iv.length - 1, Math.floor(iv.length * 0.95))] : 0;
  perf.el.textContent =
    `FPS       ${(n / secs).toFixed(0)}\n` +
    `cuadro    ${(secs * 1000 / n).toFixed(1)} ms  (p95 ${p95.toFixed(1)}, peor ${a.worstFrame.toFixed(1)})\n` +
    `física    ${(a.physics / n).toFixed(2)} ms  (${(a.steps / n).toFixed(2)} pasos/cuadro)\n` +
    `render    ${(a.render / n).toFixed(2)} ms\n` +
    `interfaz  ${(a.ui / n).toFixed(2)} ms`;
}

window.addEventListener('keydown', e => {
  if (e.key !== 'F2') return;
  perf.on = !perf.on;
  perf.acc = null;
  if (!perf.on && perf.el) { perf.el.remove(); perf.el = null; }
  e.preventDefault();
});
