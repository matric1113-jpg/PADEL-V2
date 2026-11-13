import { BASE_ROLL, BLINK_LEAD_FRAMES, BODY_MARGIN, COURT, GRAVITY, GUST_FRAMES, GUST_GAP_MIN, GUST_GAP_RANGE, GUST_STRENGTH_MIN, GUST_STRENGTH_RANGE, HOLE_FAST_WARN_FRAMES, HOLE_GAP_MAX, HOLE_GAP_MIN, HOLE_GAP_STEP, HOLE_MAX_PER_SIDE, HOLE_WARN_FRAMES, NET_MARGIN, PAD_F, PAD_S, QUAKE_STUN_FRAMES, QUAKE_WARN_FRAMES, TILE_COLS, TILE_ROWS, TILT_FRAMES, TILT_GAP_MIN, TILT_GAP_RANGE } from './constants.js';
import { ACTIVES, ACTIVE_IDS, TALK } from './data.js';
import { showBanner } from './ballistics.js';
import { holeAt, tileOf, tileSide } from './floor.js';
import { emitSound, say, talkLine } from './game.js';
import { bossOf, mapOf, state } from './state.js';
import { activeCdOf, activeDurOf, reachZOf } from './stats.js';
import { clamp, pick } from './util.js';

export function activate(p, idx) {
  let kind = p.active;
  if (p.activePool === 'all') { kind = pick(ACTIVE_IDS); p.active = kind; }
  if (!kind || !ACTIVES[kind]) return;
  p.activeKind = kind;
  p.activeT = activeDurOf(kind);
  p.activeCd = activeCdOf(kind);
  if (kind === 'clone') {
    let cy = 2 * COURT.midY - p.y;
    if (Math.abs(cy - p.y) < 90) cy = p.y < COURT.midY ? p.y + 150 : p.y - 150;
    p.clone = { x: p.x, y: clamp(cy, COURT.y + BODY_MARGIN, COURT.y + COURT.h - BODY_MARGIN) };
  }
  if (kind === 'hielo') state.ice = { side: 1 - p.team, t: activeDurOf(kind) };
  if (kind === 'teleport') {
    // Parpadeo: a donde la pelota va a quedar a su alcance; si no viene hacia él, a donde apunta (dentro de su lado)
    const [minX, maxX, minY, maxY] = halfBounds(p.team);
    const s = blinkSpot(p) || { x: clamp(p.aimX, minX, maxX), y: clamp(p.aimY, minY, maxY) };
    blinkTo(p, s.x, s.y);
  }
  if (kind === 'sismo') {
    state.quake = { team: 1 - p.team, t: QUAKE_WARN_FRAMES, id: state.soundTrigger.seq + 1 };
    showBanner('¡Terremoto!\nQuien esté pisando el suelo cuando llegue queda aturdido: salten', QUAKE_WARN_FRAMES + 20);
  }
  emitSound(kind === 'teleport' ? 'blink' : 'power');
  if (Math.random() < 0.55) say(idx, talkLine(p, TALK.power[kind]));
}

// Límites de la mitad de cada equipo para el cuerpo del jugador
function halfBounds(team) {
  return [
    team === 0 ? COURT.x + BODY_MARGIN : COURT.netX + NET_MARGIN,
    team === 0 ? COURT.netX - NET_MARGIN : COURT.x + COURT.w - BODY_MARGIN,
    COURT.y + BODY_MARGIN, COURT.y + COURT.h - BODY_MARGIN
  ];
}

// Dónde pararse para pegarle a la pelota que viene: el primer punto de su trayectoria (con el bote en el suelo) en que
// queda al alcance de la pala, dentro de al menos BLINK_LEAD_FRAMES cuadros. null si no viene hacia su lado o si antes
// llega a una pared (de ahí en adelante no se predice).
export function blinkSpot(p) {
  const b = state.ball;
  if (state.phase !== 'PLAY' || b.lastHitTeam === p.team || b.out) return null;
  const M = mapOf();
  const dir = p.team === 0 ? 1 : -1;
  const zMax = reachZOf(p) - 8;
  const [minX, maxX, minY, maxY] = halfBounds(p.team);
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, bounces = b.bouncesInOpponentSide;
  for (let k = 1; k <= 240; k++) {
    x += vx; y += vy; z += vz; vz -= GRAVITY;
    if (z <= 0) {
      if (++bounces >= 2) return null;
      z = 0; vz = Math.abs(vz) * 0.74 * M.bounceZ;
      vx *= BASE_ROLL * M.roll; vy *= BASE_ROLL * M.roll;
    }
    if (x < COURT.x + 12 || x > COURT.x + COURT.w - 12 || y < COURT.y + 12 || y > COURT.y + COURT.h - 12) return null;
    const mine = p.team === 0 ? x < COURT.netX - 14 : x > COURT.netX + 14;
    if (k >= BLINK_LEAD_FRAMES && mine && z > 4 && z <= zMax) {
      const px = clamp(x - dir * PAD_F, minX, maxX), py = clamp(y - PAD_S, minY, maxY);
      if (holeAt(px, py, -4, true)) continue;   // no aparece sobre un hoyo ni sobre una baldosa que avisa
      return { x: px, y: py };
    }
  }
  return null;
}

export function blinkTo(p, x, y) {
  state.blink = { seq: state.blink.seq + 1, x0: p.x, y0: p.y, x1: x, y1: y };
  p.x = x; p.y = y; p.vx = 0; p.vy = 0;
  p.outside = false;
}

// Rompe la baldosa de (x, y): avisa un instante y cae (poder Rompesuelos y remates de los hermanos Terremoto)
export function breakFloorAt(x, y) {
  const i = tileOf(x, y);
  if (i < 0 || state.holes.some(h => h.i === i)) return;
  state.holes.push({ i, w: HOLE_FAST_WARN_FRAMES });
}

// Una baldosa nueva empieza a avisar en ese lado: la mitad de las veces, la que pisa uno de sus jugadores
function spawnHole(side) {
  const taken = new Set(state.holes.map(h => h.i));
  let onSide = 0;
  for (const i of taken) if (tileSide(i) === side) onSide++;
  if (onSide >= HOLE_MAX_PER_SIDE) return;
  const free = [];
  for (let i = 0; i < TILE_COLS * TILE_ROWS; i++) if (tileSide(i) === side && !taken.has(i)) free.push(i);
  if (!free.length) return;
  let i = -1;
  if (Math.random() < 0.5) {
    const cands = state.players.filter(p => p.team === side && !p.out && !p.fell && !p.outside);
    if (cands.length) { const p = pick(cands); i = tileOf(p.x, p.y); }
  }
  if (i < 0 || taken.has(i) || tileSide(i) !== side) i = pick(free);
  state.holes.push({ i, w: HOLE_WARN_FRAMES });
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
      const zeusBoss = state.mode === 'run' && bossOf().solo;
      const teams = zeusBoss ? [0] : [0, 1];
      teams.forEach(t => {
        const cands = state.players.map((p, i) => i).filter(i => state.players[i].team === t && !state.players[i].out && !state.players[i].fell);
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
        if (!q.out && !q.fell && Math.hypot(q.x - bo.x, q.y - bo.y) < 30) { q.stun = 240; q.charging = false; q.chargeFrames = 0; }
      });
      emitSound('bolt');
    }
  }
  state.bolts = state.bolts.filter(bo => bo.t > 0);

  // Camas elásticas: se pasean mientras se juega
  if (M.pads) state.padT++;

  // Piso que se cae: las baldosas que avisan terminan de caer; con el punto en juego van avisando otras, cada vez más seguido
  let opened = false;
  for (const h of state.holes) if (h.w > 0 && --h.w === 0) opened = true;
  if (opened) emitSound('crack');
  if (M.holes && state.phase === 'PLAY' && --state.hz.hole <= 0) {
    state.hz.hole = Math.max(HOLE_GAP_MIN, HOLE_GAP_MAX - HOLE_GAP_STEP * (state.holes.length / 2));
    spawnHole(0);
    spawnHole(1);
  }

  // Terremoto: cuando llega, aturde a quienes estén pisando el suelo de ese lado (en el aire no pasa nada)
  if (state.quake && --state.quake.t <= 0) {
    const team = state.quake.team;
    state.quake = null;
    state.players.forEach(q => {
      if (q.out || q.fell || q.team !== team || q.jz > 0.5) return;
      q.stun = Math.max(q.stun, QUAKE_STUN_FRAMES);
      q.charging = false; q.chargeFrames = 0;
    });
    emitSound('quake');
  }
}
