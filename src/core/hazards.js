import { ACTIVE_COOLDOWN, ACTIVE_DURATION, BODY_MARGIN, COURT, GUST_FRAMES, GUST_GAP_MIN, GUST_GAP_RANGE, GUST_STRENGTH_MIN, GUST_STRENGTH_RANGE, TILT_FRAMES, TILT_GAP_MIN, TILT_GAP_RANGE } from './constants.js';
import { ACTIVES, ACTIVE_IDS, BOSSES, TALK } from './data.js';
import { emitSound, say, talkLine } from './game.js';
import { mapOf, state } from './state.js';
import { clamp, pick } from './util.js';

export function activate(p, idx) {
  let kind = p.active;
  if (p.activePool === 'all') { kind = pick(ACTIVE_IDS); p.active = kind; }
  if (!kind || !ACTIVES[kind]) return;
  p.activeKind = kind;
  p.activeT = ACTIVE_DURATION;
  p.activeCd = ACTIVE_COOLDOWN;
  if (kind === 'clone') {
    let cy = 2 * COURT.midY - p.y;
    if (Math.abs(cy - p.y) < 90) cy = p.y < COURT.midY ? p.y + 150 : p.y - 150;
    p.clone = { x: p.x, y: clamp(cy, COURT.y + BODY_MARGIN, COURT.y + COURT.h - BODY_MARGIN) };
  }
  if (kind === 'hielo') state.ice = { side: 1 - p.team, t: ACTIVE_DURATION };
  emitSound('power');
  if (Math.random() < 0.55) say(idx, talkLine(p, TALK.power[kind]));
}

// ---- Peligros de los mapas (los decide el anfitrión) ----
export function updateHazards() {
  const M = mapOf();
  if (state.ice && --state.ice.t <= 0) state.ice = null;
  state.embers.forEach(e => e.t--);
  state.embers = state.embers.filter(e => e.t > 0);
  if (state.phase === 'POINT_PAUSE') return;

  if (M.gusts) {
    if (state.gust.t > 0) state.gust.t--;
    else if (--state.hz.gust <= 0) {
      state.gust = { w: (Math.random() < 0.5 ? -1 : 1) * (GUST_STRENGTH_MIN + Math.random() * GUST_STRENGTH_RANGE), t: GUST_FRAMES };
      state.hz.gust = GUST_GAP_MIN + Math.random() * GUST_GAP_RANGE;
    }
  }
  if (M.tilt) {
    if (state.tilt.t > 0) {
      if (--state.tilt.t === 0) { state.tilt.x = 0; state.tilt.y = 0; }
    } else if (--state.hz.tilt <= 0) {
      const a = Math.random() * Math.PI * 2;
      state.tilt = { x: Math.cos(a), y: Math.sin(a), t: TILT_FRAMES };
      state.hz.tilt = TILT_GAP_MIN + Math.random() * TILT_GAP_RANGE;
    }
  }
  if (M.bolts && state.phase === 'PLAY') {
    if (--state.hz.bolt <= 0) {
      state.hz.bolt = 840 + Math.random() * 420;
      const zeusBoss = state.mode === 'run' && BOSSES[state.run.boss].solo;
      const teams = zeusBoss ? [0] : [0, 1];
      teams.forEach(t => {
        const cands = state.players.map((p, i) => i).filter(i => state.players[i].team === t && !state.players[i].out);
        if (!cands.length) return;
        const slot = pick(cands);
        state.bolts.push({ slot, t: 120, x: state.players[slot].x, y: state.players[slot].y });
      });
    }
  }
  // Rayos: el aviso sigue al jugador y se fija en el último 0,7 s; si no se mueve, queda paralizado 4 s
  for (const bo of state.bolts) {
    const p = state.players[bo.slot];
    if (bo.t > 42 && p) { bo.x = p.x; bo.y = p.y; }
    if (--bo.t <= 0) {
      state.players.forEach(q => {
        if (!q.out && Math.hypot(q.x - bo.x, q.y - bo.y) < 30) { q.stun = 240; q.charging = false; q.chargeFrames = 0; }
      });
      emitSound('bolt');
    }
  }
  state.bolts = state.bolts.filter(bo => bo.t > 0);
}

