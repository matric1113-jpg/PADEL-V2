import { BALL_R, COURT, PAD_F, PAD_S, ZS } from '../core/constants.js';
import { rt, state } from '../core/state.js';
import { reachOf, reachZOf } from '../core/stats.js';
import { clamp } from '../core/util.js';
import { fx } from '../view/fx.js';
import { aimTarget, predictLanding } from '../view/hud.js';
import { PLAYER_SCALE, scaleOf } from '../view/skeleton.js';

// ---------- Marcas en el suelo: las mismas del render 2D, ahora bajo los jugadores ----------
// built: esqueletos del cuadro (para saber quién está cargando el golpe).
export function drawGroundMarks(mk, me, built, inReplay, now) {
  mk.begin();
  const b = state.ball;
  const players = state.players;

  if (!inReplay) serveBox(mk, now);
  hazards(mk, now);

  // Sombras de contacto (las de los focos son sombras reales)
  players.forEach(p => {
    if (p.out) return;
    const sc = scaleOf(p) / PLAYER_SCALE;
    mk.ring({ x: p.x, y: p.y, r: 12 * sc, fill: 0.26, line: 0, color: '2, 8, 20' });
    if (p.clone) mk.ring({ x: p.clone.x, y: p.clone.y, r: 12 * sc, fill: 0.3, line: 0, color: '40, 10, 80' });
  });
  const h = b.z * ZS + BALL_R;
  mk.ring({ x: b.x, y: b.y, r: BALL_R * 1.1 * (1 + h * 0.006), fill: clamp(0.55 / (1 + h * 0.012), 0.16, 0.55), line: 0, color: '0, 6, 16' });

  // Botes de la pelota
  for (const r of fx.rings) {
    const k = r.t / 26;
    mk.ring({ x: r.x, y: r.y, r: 4 + k * 18, w: 1.2, line: 0.45 * (1 - k), color: '230, 236, 210' });
  }

  players.forEach((p, idx) => { if (!p.out) playerRing(mk, p, idx, now); });
  if (!inReplay) {
    players.forEach((p, idx) => { if (!p.out && built[idx]) reach(mk, p, idx, built[idx].charging); });
    landing(mk, me);
    aim(mk, me);
  }
  mk.end();
}

function serveBox(mk, now) {
  const b = state.ball;
  if (!(state.phase === 'SERVE' || (state.phase === 'PLAY' && b.isServeShot && b.bouncesInOpponentSide === 0))) return;
  const box = state.serveTargetBox;
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
  mk.rect({ x0: box.minX, y0: box.minY, x1: box.maxX, y1: box.maxY, color: '228, 255, 58', fill: 0.1 + pulse * 0.06, line: 0.55 + pulse * 0.3, w: 1.8 });
}

function hazards(mk, now) {
  if (state.ice) {
    const s = state.ice.side, a = clamp(state.ice.t / 30, 0, 1);
    const x0 = s === 0 ? COURT.x : COURT.netX, x1 = s === 0 ? COURT.netX : COURT.x + COURT.w;
    mk.rect({ x0, y0: COURT.y, x1, y1: COURT.y + COURT.h, color: '200, 240, 255', fill: 0.3 * a, line: 0.35 * a, w: 1.2, h: 0.2 });
  }
  for (const e of state.embers) {
    const a = clamp(e.t / 40, 0, 1);
    mk.ring({ x: e.x, y: e.y, r: 24, glow: true, fill: 0.85 * a, line: 0, color: '255, 200, 80', color2: '160, 30, 0' });
  }
  for (const bo of state.bolts) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.02);
    const locked = bo.t <= 42;
    mk.ring({ x: bo.x, y: bo.y, r: 30, color: '255, 240, 120', fill: locked ? 0.3 : 0.12 + 0.1 * pulse, line: 0.6 + 0.3 * pulse, w: locked ? 2.8 : 1.9 });
  }
}

function playerRing(mk, p, idx, now) {
  const isMe = idx === rt.mySlot;
  const isServer = state.phase === 'SERVE' && state.serverSlot === idx;
  const col = isMe ? '228, 255, 58' : (p.team === 0 ? '69, 168, 255' : '255, 92, 80');
  const pulse = isServer ? 0.5 + 0.5 * Math.sin(now * 0.008) : 0;
  mk.ring({ x: p.x, y: p.y, r: 20 + pulse * 3, color: col, line: isMe ? 0.9 : 0.5, w: isMe ? 2.4 : 1.7, fill: isMe ? 0.07 : 0, ticks: isMe });
}

function reach(mk, p, idx, charging) {
  const b = state.ball;
  const dir = p.team === 0 ? 1 : -1;
  const px = p.x + dir * PAD_F, py = p.y + PAD_S;
  const swingFlash = p.swingTimer > 0;
  if (!charging && !swingFlash) return;
  const r = reachOf(p);
  const inRange = state.phase === 'PLAY' && b.lastHitTeam !== p.team &&
    Math.hypot(b.x - px, b.y - py) <= r && b.z <= reachZOf(p);
  const isMe = idx === rt.mySlot;
  const col = swingFlash ? '250, 204, 21' : (inRange ? '228, 255, 58' : '255, 255, 255');
  const line = swingFlash ? 0.7 : (inRange ? 0.8 : (isMe ? 0.32 : 0.14));
  mk.ring({
    x: px, y: py, r, color: col, line, w: swingFlash ? 2.4 : 1.4,
    fill: inRange && isMe ? 0.12 : 0, dash: swingFlash ? 0 : Math.round(2 * Math.PI * r / 11)
  });
}

function landing(mk, me) {
  const land = predictLanding();
  if (!land) return;
  const mine = me && ((land.x < COURT.netX) === (me.team === 0));
  const col = mine ? '228, 255, 58' : '255, 255, 255';
  mk.ring({ x: land.x, y: land.y, r: 7, w: 1.4, color: col, line: mine ? 0.55 : 0.22 });
  mk.ring({ x: land.x, y: land.y, r: 2, line: 0, fill: mine ? 0.6 : 0.25, color: col });
}

function aim(mk, me) {
  const { tx, ty, col, ratio, isCharging } = aimTarget(me);
  mk.ring({
    x: tx, y: ty, r: isCharging ? 10 + ratio * 6 : 8, color: col,
    fill: isCharging ? 0.14 : 0.06, line: isCharging ? 0.95 : 0.6, w: isCharging ? 2.4 : 1.6, cross: 14
  });
}
