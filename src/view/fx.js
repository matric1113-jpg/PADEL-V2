import { ACTIVE_DURATION, BALL_R, COURT, GUST_STRENGTH_MIN, GUST_STRENGTH_RANGE, LIGHTS, ZS } from '../core/constants.js';

export const RAIN_WIND = 160;   // velocidad lateral de la lluvia (unidades por cuadro) por unidad de fuerza del viento; antes 900 * 0,06 = 54
import { replayBuf } from '../core/replay.js';
import { gustForce, mapOf, state } from '../core/state.js';

// ---------- Efectos (solo visuales, viven en cada cliente) ----------
export function newPf() {
  return {
    phase: 0, facing: null, lastX: null, lastY: null, vx: 0, vy: 0,
    lastCooldown: 0, swingT: -1, swingKind: 'drive', from: null,
    pose: { beta: 0.35, z: 44, reach: 11, tilt: 0.9, kind: 'ready' }, tips: [], dust: 0
  };
}

export const fx = {
  particles: [],
  rings: [],
  ripples: [],
  impacts: [],
  shake: 0,
  net: { amp: 0, y0: 260, t: 0, dir: 1 },
  ballSpin: 0,
  players: [0, 1, 2, 3].map(() => newPf()),
  clones: [0, 1, 2, 3].map(() => newPf()),
  servingTeam: -1,
  rain: [],
  streaks: [],
  birds: [],
  sparks: [],
  strikes: [],
  flash: 0,
  replay: null, replaySeq: -1,
  celeb: null, celebQueue: null, celebSeq: -1,
  talk: null, talkSeq: -1,
  prevLights: [true, true],
  prevBolts: [],
  view: { rot: 0, oy: 0, k: 1 },
  inited: false
};

// Detecta cambios del estado compartido (vale igual en anfitrión e invitados)
export function detectStateEvents() {
  if (!fx.inited) {
    fx.inited = true;
    fx.replaySeq = state.replay.seq; fx.celebSeq = state.celebrate.seq; fx.talkSeq = state.talk.seq;
    fx.prevLights = [...state.lights];
    return;
  }
  if (state.replay.seq !== fx.replaySeq) {
    fx.replaySeq = state.replay.seq;
    if (replayBuf.length > 20) fx.replay = { frames: replayBuf.slice(-80), t: 0, reason: state.replay.reason || '' };
  }
  if (state.celebrate.seq !== fx.celebSeq) {
    fx.celebSeq = state.celebrate.seq;
    fx.celebQueue = { team: state.celebrate.team, t: 0 };
  }
  if (fx.celebQueue && !fx.replay) { fx.celeb = fx.celebQueue; fx.celebQueue = null; }
  if (state.talk.seq !== fx.talkSeq) {
    fx.talkSeq = state.talk.seq;
    fx.talk = { slot: state.talk.slot, text: state.talk.text, t: 0 };
  }
  state.lights.forEach((on, i) => {
    if (!on && fx.prevLights[i]) {
      const L = LIGHTS[i];
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
        fx.sparks.push({ x: L.x, y: L.y, z: L.z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: Math.random() * 3, t: 0, max: 30 + Math.random() * 30 });
      }
      fx.shake = Math.max(fx.shake, 4);
    }
  });
  fx.prevLights = [...state.lights];
  for (const pb of fx.prevBolts) {
    if (pb.t <= 4 && !state.bolts.some(bo => bo.slot === pb.slot)) {
      fx.strikes.push({ x: pb.x, y: pb.y, t: 0 });
      fx.flash = Math.max(fx.flash, 0.45);
      fx.shake = Math.max(fx.shake, 6);
    }
  }
  fx.prevBolts = state.bolts.map(bo => ({ ...bo }));
}

export function spawnSand(x, y, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random() * 1.2) * power;
    fx.particles.push({
      x, y, z: 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: (1.2 + Math.random() * 1.8) * power,
      life: 0, max: 26 + Math.random() * 18, size: 1 + Math.random() * 1.4
    });
  }
}

export function onGameEvent(type) {
  const b = state.ball;
  if (type === 'flash') {
    fx.flash = 0.6;
    fx.impacts.push({ x: b.x, y: b.y, z: b.z * ZS + BALL_R, t: 0, big: true });
  } else if (type === 'power') {
    state.players.forEach(p => { if (p.activeT >= ACTIVE_DURATION - 2) fx.rings.push({ x: p.x, y: p.y, t: 0, power: true }); });
  } else if (type === 'bounce') {
    spawnSand(b.x, b.y, Math.round(9 * (mapOf().sand || 1)));
    fx.rings.push({ x: b.x, y: b.y, t: 0 });
  } else if (type === 'hit' || type === 'lob' || type === 'smash') {
    fx.impacts.push({ x: b.x, y: b.y, z: b.z * ZS + BALL_R, t: 0, big: type === 'smash' });
    if (type === 'smash') fx.shake = 7;
  } else if (type === 'glass') {
    const d = [
      ['L', b.x - COURT.x], ['R', COURT.x + COURT.w - b.x],
      ['F', b.y - COURT.y], ['N', COURT.y + COURT.h - b.y]
    ].sort((p, q) => p[1] - q[1])[0][0];
    const a = (d === 'L' || d === 'R') ? b.y : b.x;
    fx.ripples.push({ wall: d, a, z: b.z * ZS + BALL_R, t: 0 });
  } else if (type === 'fault') {
    if (Math.abs(b.x - COURT.netX) < 30) {
      fx.net = { amp: 7, y0: b.y, t: 0, dir: b.vx >= 0 ? 1 : -1 };
    }
  }
}

export function updateFx(dt) {
  for (const p of fx.particles) {
    p.life += dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vz -= 0.16 * dt;
    if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
  }
  fx.particles = fx.particles.filter(p => p.life < p.max);
  for (const arr of [fx.rings, fx.ripples, fx.impacts]) for (const e of arr) e.t += dt;
  fx.rings = fx.rings.filter(e => e.t < 26);
  fx.ripples = fx.ripples.filter(e => e.t < 30);
  fx.impacts = fx.impacts.filter(e => e.t < 14);
  fx.shake = Math.max(0, fx.shake - 0.6 * dt);
  fx.flash = Math.max(0, fx.flash - 0.06 * dt);
  for (const s of fx.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vz -= 0.2 * dt; }
  fx.sparks = fx.sparks.filter(s => s.t < s.max && s.z > 0);
  for (const s of fx.strikes) s.t += dt;
  fx.strikes = fx.strikes.filter(s => s.t < 26);
  if (fx.talk && (fx.talk.t += dt) > 140) fx.talk = null;
  if (fx.celeb && (fx.celeb.t += dt) > 110) fx.celeb = null;
  if (fx.replay) {
    fx.replay.t += dt * 0.45;
    if (fx.replay.t >= fx.replay.frames.length - 1) fx.replay = null;
  }
  const M = mapOf();
  // Lluvia: cae casi recta y, con una ráfaga, se tumba con el viento y se vuelve más densa y rápida
  const wf = Math.abs(gustForce()) / Math.max(0.001, GUST_STRENGTH_MIN + GUST_STRENGTH_RANGE);   // 0..1 según la fuerza del viento
  fx.windK = wf;
  if (M.rain && state.screen === 'play') {
    const want = Math.round(140 + 220 * Math.min(1, wf));
    while (fx.rain.length < want) fx.rain.push({ x: -150 + Math.random() * 1250, y: -80 + Math.random() * 680, z: Math.random() * 420 });
    const wind = gustForce() * RAIN_WIND;   // unidades de y por cuadro
    fx.rainWind = wind;
    for (const d of fx.rain) {
      d.z -= (11 + 9 * wf) * dt; d.y += wind * dt;
      if (d.z < 0) { d.z = 380 + Math.random() * 60; d.x = -150 + Math.random() * 1250; d.y = -80 + Math.random() * 680; }
    }
  } else { fx.rain.length = 0; fx.rainWind = 0; }
  // Rachas visibles de la ráfaga: líneas largas que cruzan la cancha en la dirección del viento
  if (state.gust.t > 0) {
    const n = 2.2 * wf * dt;
    for (let k = 0; k < n; k += 1) if (Math.random() < Math.min(1, n - k)) fx.streaks.push({ x: -20 + Math.random() * 960, y: state.gust.w > 0 ? -60 : 580, z: 20 + Math.random() * 230, t: 0 });
  }
  for (const s of fx.streaks) { s.t += dt; s.y += Math.sign(state.gust.w || 1) * 16 * dt; }
  fx.streaks = fx.streaks.filter(s => s.t < 60);
  // Aves cruzando la cordillera
  if (state.map === 'chile' && fx.birds.length === 0 && Math.random() < 0.004 * dt) {
    const dirB = Math.random() < 0.5 ? 1 : -1, z0 = 520 + Math.random() * 300;
    for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) fx.birds.push({ x: dirB > 0 ? -900 - k * 60 : 1900 + k * 60, z: z0 + (k % 2) * 30 - k * 10, v: dirB * (3.2 + Math.random() * 0.6), ph: Math.random() * 6 });
  }
  for (const bd of fx.birds) { bd.x += bd.v * dt; bd.ph += 0.25 * dt; }
  fx.birds = fx.birds.filter(bd => bd.x > -1000 && bd.x < 2000);
  // Chispas eléctricas de Zeus y llamas de quemaduras
  state.players.forEach(p => {
    if (p.out) return;
    if (p.lookId === 'zeus' && Math.random() < 0.5 * dt) fx.sparks.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 20, z: 20 + Math.random() * 80, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: Math.random(), t: 0, max: 12, elec: true });
    if ((p.burn > 0 || p.slow > 0) && Math.random() < 0.6 * dt) fx.sparks.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y + (Math.random() - 0.5) * 10, z: 2, vx: 0, vy: 0, vz: 1.4 + Math.random(), t: 0, max: 18, fire: true });
  });
  if (fx.net.amp > 0) { fx.net.t += dt; fx.net.amp *= Math.pow(0.93, dt); if (fx.net.amp < 0.05) fx.net.amp = 0; }
  const b = state.ball;
  fx.ballSpin += Math.hypot(b.vx, b.vy) * 0.12 * dt;
}
