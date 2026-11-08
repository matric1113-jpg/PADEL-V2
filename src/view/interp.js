import { state } from '../core/state.js';

// ---------- Interpolación del dibujo ----------
// La física avanza a 60 Hz fijos. En pantallas de 120/144/165 Hz, dibujar siempre el último paso hace que el movimiento
// avance a saltos (2 y 3 cuadros alternados). Aquí se guarda una foto de las posiciones al final de cada paso y, al
// dibujar, se muestra el punto intermedio entre las dos últimas según el tiempo que ha pasado desde el último paso.
// No toca la lógica: las posiciones reales se restauran apenas termina el dibujo. Cuesta hasta 1/60 s de retraso visual.
const TELEPORT_PLAYER = 50;   // más salto que esto en un paso (sacar, empezar el punto, rayo...) no se interpola
const TELEPORT_BALL = 80;

let prev = null, cur = null;

function capture() {
  return {
    players: state.players.map(p => ({ uid: p.uid, x: p.x, y: p.y, jz: p.jz || 0, cx: p.clone ? p.clone.x : null, cy: p.clone ? p.clone.y : null })),
    ball: { x: state.ball.x, y: state.ball.y, z: state.ball.z }
  };
}

// Se llama al final de cada paso de física (y en los invitados, que no corren la física, al final de cada paso del reloj)
export function snapshot() {
  prev = cur;
  cur = capture();
}

const lerp = (a, b, t) => a + (b - a) * t;

// Pone en el estado las posiciones intermedias y devuelve la función que deja todo como estaba
export function applyInterp(alpha) {
  if (!prev || !cur || alpha >= 1 || state.screen !== 'play') return null;
  const undo = [];
  const set = (o, k, v) => { undo.push(o, k, o[k]); o[k] = v; };

  const b = state.ball, pb = prev.ball, cb = cur.ball;
  if (Math.hypot(cb.x - pb.x, cb.y - pb.y, cb.z - pb.z) < TELEPORT_BALL) {
    set(b, 'x', lerp(pb.x, cb.x, alpha)); set(b, 'y', lerp(pb.y, cb.y, alpha)); set(b, 'z', lerp(pb.z, cb.z, alpha));
  }
  if (prev.players.length === state.players.length && cur.players.length === state.players.length) {
    state.players.forEach((p, i) => {
      const a = prev.players[i], c = cur.players[i];
      if (a.uid !== c.uid || Math.hypot(c.x - a.x, c.y - a.y) >= TELEPORT_PLAYER) return;
      set(p, 'x', lerp(a.x, c.x, alpha)); set(p, 'y', lerp(a.y, c.y, alpha)); set(p, 'jz', lerp(a.jz, c.jz, alpha));
      if (p.clone && a.cx != null && c.cx != null) { set(p.clone, 'x', lerp(a.cx, c.cx, alpha)); set(p.clone, 'y', lerp(a.cy, c.cy, alpha)); }
    });
  }
  return () => { for (let i = undo.length - 3; i >= 0; i -= 3) undo[i][undo[i + 1]] = undo[i + 2]; };
}
