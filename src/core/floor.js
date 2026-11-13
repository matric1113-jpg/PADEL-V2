// ---------- Piso que se cae y camas elásticas (laboratorio) ----------
// Baldosas: la cancha se divide en TILE_COLS x TILE_ROWS; state.holes guarda las que están avisando (w > 0) o ya
// cayeron (w = 0). Camas elásticas: su posición sale de state.padT, así anfitrión e invitados calculan lo mismo.
import { COURT, PAD_R, TILE_COLS, TILE_H, TILE_ROWS, TILE_W } from './constants.js';
import { mapOf, state } from './state.js';

export const tileOf = (x, y) => {
  const c = Math.floor((x - COURT.x) / TILE_W), r = Math.floor((y - COURT.y) / TILE_H);
  return c < 0 || c >= TILE_COLS || r < 0 || r >= TILE_ROWS ? -1 : r * TILE_COLS + c;
};
export const tileRect = i => {
  const c = i % TILE_COLS, r = (i - c) / TILE_COLS;
  return { x0: COURT.x + c * TILE_W, y0: COURT.y + r * TILE_H, x1: COURT.x + (c + 1) * TILE_W, y1: COURT.y + (r + 1) * TILE_H };
};
export const tileSide = i => ((i % TILE_COLS) < TILE_COLS / 2 ? 0 : 1);

// Hoyo en (x, y). edge: margen hacia adentro (positivo perdona el borde; negativo lo agranda).
// warn: cuenta también las baldosas que todavía están avisando.
export function holeAt(x, y, edge = 0, warn = false) {
  for (const h of state.holes) {
    if (h.w > 0 && !warn) continue;
    const r = tileRect(h.i);
    if (x > r.x0 + edge && x < r.x1 - edge && y > r.y0 + edge && y < r.y1 - edge) return h;
  }
  return null;
}

// Camas elásticas: dos por lado, moviéndose en óvalos; las del lado rojo son el reflejo de las del azul
const PAD_BASE = [[250, 150, 0], [250, 370, 2.1]];
export function padsNow() {
  if (!mapOf().pads) return [];
  const t = state.padT * 0.012;
  const out = [];
  for (const [x, y, ph] of PAD_BASE) {
    const px = x + Math.cos(t + ph) * 75, py = y + Math.sin(t * 1.3 + ph) * 55;
    out.push({ x: px, y: py }, { x: 2 * COURT.netX - px, y: 2 * COURT.midY - py });
  }
  return out;
}
export function padAt(x, y) {
  for (const pad of padsNow()) if (Math.hypot(x - pad.x, y - pad.y) < PAD_R) return pad;
  return null;
}
