import { BALL_R, COURT, ENTITY_K, LIGHTS, MAX_CHARGE_FRAMES, SMASH_MIN_Z, ZS } from '../core/constants.js';
import { LOOKS } from '../core/data.js';
import { createPlayer, localInput, rt, state } from '../core/state.js';
import { actOn, sizeOf, upLvl } from '../core/stats.js';
import { angleDiff, clamp, easeOut, lerp } from '../core/util.js';
import { P, cam, groundCircle, makeCam, pathPts } from './camera.js';
import { ctx, setCtx } from './ctx.js';
import { newPf, spawnSand } from './fx.js';

// ---------- Sombras de los 4 focos ----------
function lightWeights(x, y) {
  const ws = [];
  let sum = 0;
  for (const L of LIGHTS) {
    const dx = x - L.x, dy = y - L.y;
    const d2 = dx * dx + dy * dy + L.z * L.z;
    const w = L.z / (d2 * Math.sqrt(d2));
    ws.push(w); sum += w;
  }
  return ws.map(w => w / sum);
}

export function drawPlayerShadows(p) {
  const ws = lightWeights(p.x, p.y);
  const sc = scaleOf(p) / PLAYER_SCALE;
  const H = 74 * scaleOf(p) * lookOf(p).body.h;
  LIGHTS.forEach((L, i) => {
    if (!state.lights[i]) return;
    const k = L.z / (L.z - H);
    const tx = L.x + (p.x - L.x) * k, ty = L.y + (p.y - L.y) * k;
    let dx = tx - p.x, dy = ty - p.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx;
    const w0 = 8 * sc, w1 = 5.5 * sc, wm = 9 * sc;
    const mx = p.x + dx * len * 0.45, my = p.y + dy * len * 0.45;
    const poly = [
      P(p.x + nx * w0, p.y + ny * w0, 0), P(mx + nx * wm, my + ny * wm, 0),
      P(tx + nx * w1, ty + ny * w1, 0), P(tx + dx * 4, ty + dy * 4, 0),
      P(tx - nx * w1, ty - ny * w1, 0), P(mx - nx * wm, my - ny * wm, 0),
      P(p.x - nx * w0, p.y - ny * w0, 0)
    ];
    pathPts(ctx, poly);
    const a0 = Math.min(0.26, 0.06 + ws[i] * 0.42);
    const g0 = P(p.x, p.y, 0), g1 = P(tx, ty, 0);
    const gr = ctx.createLinearGradient(g0.x, g0.y, g1.x, g1.y);
    gr.addColorStop(0, `rgba(2, 10, 26, ${a0})`);
    gr.addColorStop(1, `rgba(2, 10, 26, ${a0 * 0.25})`);
    ctx.fillStyle = gr;
    ctx.fill();
  });
  // Sombra de contacto
  pathPts(ctx, groundCircle(p.x, p.y, 12 * sc, 0, 22));
  ctx.fillStyle = 'rgba(2, 8, 20, 0.32)';
  ctx.fill();
  if (p.clone) {
    pathPts(ctx, groundCircle(p.clone.x, p.clone.y, 12 * sc, 0, 22));
    ctx.fillStyle = 'rgba(40, 10, 80, 0.35)';
    ctx.fill();
  }
}

export function drawBallShadows(b) {
  const h = b.z * ZS + BALL_R;
  const ws = lightWeights(b.x, b.y);
  LIGHTS.forEach((L, i) => {
    if (!state.lights[i]) return;
    const k = L.z / Math.max(20, L.z - h);
    const sx = L.x + (b.x - L.x) * k, sy = L.y + (b.y - L.y) * k;
    pathPts(ctx, groundCircle(sx, sy, BALL_R * 0.9, 0, 14));
    ctx.fillStyle = `rgba(2, 10, 26, ${0.08 + ws[i] * 0.2})`;
    ctx.fill();
  });
  // Sombra principal bajo la pelota (clave para leer la altura)
  const spread = 1 + h * 0.006;
  pathPts(ctx, groundCircle(b.x, b.y, BALL_R * 1.1 * spread, 0, 18));
  ctx.fillStyle = `rgba(0, 6, 16, ${clamp(0.55 / (1 + h * 0.012), 0.16, 0.55)})`;
  ctx.fill();
}

// ---------- Jugadores con volumen (esqueleto 3D proyectado) ----------
const TEAM_COLORS = ['#45a8ff', '#ff5c50'];
const OUTLINE = 'rgba(4, 10, 20, 0.5)';
const PLAYER_SCALE = 1.14;  // un poco más grandes que la escala real para que se lean bien
export const lookOf = p => LOOKS[p.lookId] || LOOKS.fernando;
export const scaleOf = p => PLAYER_SCALE * ENTITY_K * sizeOf(p) * (actOn(p, 'gordo') ? 1.5 : 1);
export const SHADOW_LOOK_COLORS = { skin: '#4a3a78', hairColor: '#1b1430', shirt: '#4b3a7a', shirtHi: '#8a76c8', shirtLo: '#241a40', shorts: '#1b1430', shoes: '#2a2048', band: '#9d7bff' };
export const CELEB_KIND = { german: 'belly', maxi: 'mullet', alvaro: 'flex', fernando: 'cap', matias: 'jump', joaquin: 'peace', zeus: 'bolt' };

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * k, 0, 255) | 0;
  const g = clamp(((n >> 8) & 255) * k, 0, 255) | 0;
  const b = clamp((n & 255) * k, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}

function targetPose(p, idx, charging, cr, lob) {
  const b = state.ball;
  const isServer = state.phase === 'SERVE' && state.serverSlot === idx;
  const ballHigh = b.z > SMASH_MIN_Z && Math.abs(p.x - COURT.netX) < 220 &&
    Math.hypot(b.x - p.x, b.y - p.y) < 170 && b.lastHitTeam !== p.team;
  if (charging) {
    if (isServer) return { beta: 0.5 + cr * 1.5, z: 30 - cr * 5, reach: 13, tilt: -0.15, kind: 'serve' };
    if (lob) return { beta: 0.45 + cr * 1.6, z: 36 - cr * 9, reach: 14, tilt: 0.05, kind: 'lob' };
    if (ballHigh) return { beta: 1.5 + cr * 0.55, z: 82 + cr * 5, reach: 5, tilt: 0.85, kind: 'smash' };
    return { beta: 0.45 + cr * 1.95, z: 47 - cr * 3, reach: 14, tilt: 0.45, kind: 'drive' };
  }
  return { beta: 0.32, z: isServer ? 30 : 45, reach: 11, tilt: isServer ? 0.2 : 0.95, kind: 'ready' };
}

const SWING_END = {
  drive: { beta: -1.35, z: 54, reach: 14, tilt: 0.5 },
  lob: { beta: -1.1, z: 76, reach: 13, tilt: 0.85 },
  smash: { beta: -0.55, z: 36, reach: 15, tilt: -0.35 },
  serve: { beta: -0.7, z: 52, reach: 14, tilt: 0.6 }
};
const SWING_FRAMES = 13;

function celebPose(kind, t, L, shZ) {
  const w = Math.sin(t * 0.3);
  switch (kind) {
    case 'belly': return { rh: L(10 + 2 * w, 3 + 3 * Math.cos(t * 0.3), shZ - 15), lh: L(10 - 2 * w, -3 - 3 * Math.cos(t * 0.3), shZ - 15), hide: true, jump: 0 };
    case 'mullet': return { rh: L(-5, 4, shZ + 13 + w), lh: L(3, -10, shZ - 13), hide: true, jump: 0 };
    case 'flex': return { rh: L(1, 15, shZ + 13 + w * 1.5), lh: L(1, -15, shZ + 13 - w * 1.5), hide: true, jump: 0 };
    case 'cap': return { rh: L(1, 2, shZ + 17), lh: L(9, -9, shZ + 3), hide: true, jump: 0 };
    case 'jump': return { rh: L(4, 6, shZ + 22), lh: L(5, -9, shZ - 5), hide: false, jump: Math.abs(Math.sin(t * 0.17)) * 16 };
    case 'peace': return { rh: L(11, 5, shZ + 11), lh: L(3, -9, shZ - 12), hide: true, jump: 0, peace: true };
    case 'bolt': return { rh: L(0, 9, shZ + 26), lh: L(0, -9, shZ + 26), hide: true, jump: Math.abs(w) * 8 };
    default: return { rh: L(3, 6, shZ + 22 + w * 3), lh: L(3, -9, shZ - 10), hide: false, jump: 0 };
  }
}

export function buildPlayerParts(p, idx, dt, now, pf, opts = {}) {
  let look = opts.look || lookOf(p);
  if (actOn(p, 'gordo') && !opts.portrait) look = { ...look, body: { ...look.body, w: 1.75, belly: 1.95, arm: 1.55, leg: 1.6 } };
  const body = look.body;
  const skin = look.skin;
  const b = state.ball;
  const wf = body.w;
  const armK = body.arm * (1 + 0.08 * upLvl(p, 'fuerza'));
  const legK = body.leg;

  // Velocidad medida desde la posición (sirve igual en host y en clientes)
  let sp = 0;
  if (!opts.portrait) {
    if (pf.lastX === null) { pf.lastX = p.x; pf.lastY = p.y; }
    let mvx = (p.x - pf.lastX) / Math.max(dt, 0.25), mvy = (p.y - pf.lastY) / Math.max(dt, 0.25);
    if (Math.hypot(mvx, mvy) > 14) { mvx = 0; mvy = 0; }
    pf.vx = lerp(pf.vx, mvx, clamp(0.35 * dt, 0, 1));
    pf.vy = lerp(pf.vy, mvy, clamp(0.35 * dt, 0, 1));
    pf.lastX = p.x; pf.lastY = p.y;
    sp = Math.hypot(pf.vx, pf.vy);
  }
  const moving = sp > 0.35;
  const runAmt = clamp(sp / 3, 0, 1);
  pf.phase += sp * 0.09 * dt;
  if (!opts.portrait && p.sprintActiveTimer > 0 && moving) {
    pf.dust += dt;
    if (pf.dust > 2.5) {
      pf.dust = 0;
      spawnSand(p.x - pf.vx * 2 + (Math.random() - 0.5) * 8, p.y - pf.vy * 2 + (Math.random() - 0.5) * 8, 2, 0.7);
    }
  }

  // Orientación: mira a la red y gira hacia la pelota
  if (opts.facing != null) pf.facing = opts.facing;
  else {
    const base = p.team === 0 ? 0 : Math.PI;
    const toBall = Math.atan2(b.y - p.y, b.x - p.x);
    const desired = base + clamp(angleDiff(toBall, base), -1.1, 1.1) * 0.75;
    if (pf.facing === null) pf.facing = desired;
    pf.facing += angleDiff(desired, pf.facing) * clamp(0.16 * dt, 0, 1);
  }
  const th = pf.facing;
  const Fx = Math.cos(th), Fy = Math.sin(th), Rx = -Fy, Ry = Fx;
  const L = (f, s, z) => ({ x: p.x + Fx * f + Rx * s, y: p.y + Fy * f + Ry * s, z });

  // Estado de carga (el jugador local se ve con su carga en tiempo real)
  let charging = p.charging, cr = Math.min(1, p.chargeFrames / MAX_CHARGE_FRAMES), lob = p.lobMode;
  if (!opts.portrait && !rt.isHost && idx === rt.mySlot) {
    charging = localInput.charging;
    cr = Math.min(1, rt.localChargeFrames / MAX_CHARGE_FRAMES);
    lob = localInput.lobMode;
  }
  if (opts.portrait) charging = false;

  // Detección de golpe: el cooldown salta a 28 al soltar
  if (!opts.portrait && p.cooldown > pf.lastCooldown + 4) {
    const kind = pf.pose.kind || 'drive';
    pf.swingKind = kind === 'ready' ? (p.swingLob ? 'lob' : 'drive') : kind;
    if (p.swingLob) pf.swingKind = 'lob';
    pf.from = { ...pf.pose };
    pf.swingT = 0;
    pf.tips = [];
  }
  pf.lastCooldown = p.cooldown;

  const tgt = targetPose(p, idx, charging, cr, lob);
  let pose;
  if (pf.swingT >= 0) {
    pf.swingT += dt;
    const u = clamp(pf.swingT / SWING_FRAMES, 0, 1);
    const e = easeOut(u);
    const end = SWING_END[pf.swingKind] || SWING_END.drive;
    pose = {
      beta: lerp(pf.from.beta, end.beta, e),
      z: lerp(pf.from.z, end.z, e) + (pf.swingKind === 'smash' ? Math.sin(u * Math.PI) * 8 : 0),
      reach: lerp(pf.from.reach, end.reach, e),
      tilt: lerp(pf.from.tilt, end.tilt, e),
      kind: pf.swingKind
    };
    if (pf.swingT > SWING_FRAMES + 7) pf.swingT = -1;
  } else if (opts.portrait) {
    pose = { beta: 1.35, z: 46, reach: 12, tilt: 1, kind: 'ready' };
  } else {
    const k = clamp(0.22 * dt, 0, 1);
    pose = {
      beta: lerp(pf.pose.beta, tgt.beta, k),
      z: lerp(pf.pose.z, tgt.z, k),
      reach: lerp(pf.pose.reach, tgt.reach, k),
      tilt: lerp(pf.pose.tilt, tgt.tilt, k),
      kind: tgt.kind
    };
  }
  pf.pose = pose;
  const swinging = pf.swingT >= 0 && pf.swingT <= SWING_FRAMES;

  // ---- Piernas ----
  const crouch = charging ? 3 : (moving ? 0.6 : 1.6);
  const bob = moving ? Math.abs(Math.sin(pf.phase)) * 2.2 * runAmt : Math.sin(now * 0.006 + idx) * 0.5;
  const pelvisZ = 37 - crouch + bob;
  const mvLen = sp || 1;
  const mdx = moving ? pf.vx / mvLen : Fx, mdy = moving ? pf.vy / mvLen : Fy;
  const parts = [];
  const shoeCol = upLvl(p, 'zapas') ? '#ffd54a' : look.shoes;
  const sockCol = look.socksDark ? '#2b2b2b' : '#eef2f6';
  for (const s of [-1, 1]) {
    const ph = pf.phase + (s > 0 ? 0 : Math.PI);
    const swingL = moving ? Math.sin(ph) * 10 * runAmt : 0;
    const lift = moving ? Math.max(0, Math.cos(ph)) * 6.5 * runAmt : 0;
    const stanceW = (moving ? 4.6 : 7.6) * Math.max(1, wf * 0.92);
    const hip = L(0, s * 4.4 * wf, pelvisZ);
    const fb = L(moving ? 0 : (s > 0 ? -1.5 : 2.2), s * stanceW, 0);
    const foot = { x: fb.x + mdx * swingL, y: fb.y + mdy * swingL, z: lift };
    const kf = 3.6 + crouch * 0.8 + lift * 0.35;
    const knee = { x: (hip.x + foot.x) / 2 + Fx * kf, y: (hip.y + foot.y) / 2 + Fy * kf, z: (hip.z + foot.z) / 2 + 1.5 };
    const ankle = { x: foot.x, y: foot.y, z: foot.z + 3.2 };
    const thighMid = { x: lerp(hip.x, knee.x, 0.55), y: lerp(hip.y, knee.y, 0.55), z: lerp(hip.z, knee.z, 0.55) };
    const sk0 = look.socksHigh ? 0.3 : 0.72;
    const sock = { x: lerp(knee.x, ankle.x, sk0), y: lerp(knee.y, ankle.y, sk0), z: lerp(knee.z, ankle.z, sk0) };
    const heel = { x: foot.x - Fx * 2.6, y: foot.y - Fy * 2.6, z: foot.z + 1.7 };
    const toe = { x: foot.x + Fx * 4.6, y: foot.y + Fy * 4.6, z: foot.z + 1.5 };
    parts.push({ k: 'limb', a: knee, b: ankle, w: 4.6 * legK, c: skin, hl: true });
    parts.push({ k: 'limb', a: sock, b: ankle, w: 4.9 * legK, c: sockCol });
    parts.push({ k: 'limb', a: heel, b: toe, w: 4.6, c: shoeCol, sole: look.band });
    parts.push({ k: 'limb', a: thighMid, b: knee, w: 5.8 * legK, c: skin, hl: true });
    parts.push({ k: 'limb', a: hip, b: thighMid, w: 7.4 * Math.max(wf, legK), c: look.shorts });
  }

  // ---- Torso (cilindro elíptico visto desde la cámara) ----
  const twist = clamp(-(pose.beta - 0.35) * 0.38, -0.85, 0.7);
  const lean = moving ? 2.6 : (charging ? 1.2 : 2);
  const belly = body.belly;
  const shZ = pelvisZ + 24;
  const Sc = { x: p.x + Fx * lean, y: p.y + Fy * lean, z: shZ };
  const bf = (belly - 1) * 5;
  const Pc = { x: p.x + Fx * (lean * 0.3 + bf), y: p.y + Fy * (lean * 0.3 + bf), z: pelvisZ + 1 };
  const sth = th + twist;
  const SFx = Math.cos(sth), SFy = Math.sin(sth), SRx = -SFy, SRy = SFx;
  const shR = { x: Sc.x + SRx * 8.2 * wf, y: Sc.y + SRy * 8.2 * wf, z: shZ - 0.5 };
  const shL = { x: Sc.x - SRx * 8.2 * wf, y: Sc.y - SRy * 8.2 * wf, z: shZ - 0.5 };
  const crx = cam.r.x, cry = cam.r.y;
  const halfW = (a, bb, ux, uy, vx, vy) => Math.sqrt((a * (ux * crx + uy * cry)) ** 2 + (bb * (vx * crx + vy * cry)) ** 2);
  const wTop = halfW(8.6 * wf, 5 * wf, SRx, SRy, SFx, SFy);
  const wBot = halfW(6.6 * wf * belly, 4.6 * belly * belly, Rx, Ry, Fx, Fy);
  parts.push({
    k: 'torso', look,
    pts: [
      { x: Pc.x - crx * wBot, y: Pc.y - cry * wBot, z: Pc.z - 6 },
      { x: Pc.x + crx * wBot, y: Pc.y + cry * wBot, z: Pc.z - 6 },
      { x: Sc.x + crx * wTop, y: Sc.y + cry * wTop, z: shZ - 1 },
      { x: Sc.x - crx * wTop, y: Sc.y - cry * wTop, z: shZ - 1 }
    ],
    belly: belly > 1.15 ? { x: Pc.x + Fx * 2, y: Pc.y + Fy * 2, z: Pc.z + 2, r: 6.5 * belly } : null,
    shorts: [
      { x: Pc.x - crx * (wBot + 0.6), y: Pc.y - cry * (wBot + 0.6), z: Pc.z - 9 },
      { x: Pc.x + crx * (wBot + 0.6), y: Pc.y + cry * (wBot + 0.6), z: Pc.z - 9 },
      { x: Pc.x + crx * wBot, y: Pc.y + cry * wBot, z: Pc.z + 1 },
      { x: Pc.x - crx * wBot, y: Pc.y - cry * wBot, z: Pc.z + 1 }
    ],
    center: { x: (Sc.x + Pc.x) / 2, y: (Sc.y + Pc.y) / 2, z: (Sc.z + Pc.z) / 2 }
  });

  const sleeveCol = look.tank ? skin : look.shirt;
  const sleeveW = look.tank ? 4.4 * armK : 5.6 * Math.max(wf * 0.95, armK * 0.9);

  // ---- Brazo de la pala (derecho) ----
  const hx = Math.cos(pose.beta) * Fx + Math.sin(pose.beta) * Rx;
  const hy = Math.cos(pose.beta) * Fy + Math.sin(pose.beta) * Ry;
  const pivot = { x: Sc.x + Rx * 5 * wf, y: Sc.y + Ry * 5 * wf };
  let hand = { x: pivot.x + hx * pose.reach, y: pivot.y + hy * pose.reach, z: pose.z };
  const cel = opts.celeb ? celebPose(opts.celeb.kind, opts.celeb.t, L, shZ) : null;
  if (cel) hand = cel.rh;
  const up = pose.z > shZ + 4;
  const elbow = {
    x: (shR.x + hand.x) / 2 + Rx * (up ? 4 : 2.5) - Fx * (up ? 2 : 0),
    y: (shR.y + hand.y) / 2 + Ry * (up ? 4 : 2.5) - Fy * (up ? 2 : 0),
    z: (shR.z + hand.z) / 2 - (up ? -2 : 4.5)
  };
  const sleeve = { x: lerp(shR.x, elbow.x, 0.45), y: lerp(shR.y, elbow.y, 0.45), z: lerp(shR.z, elbow.z, 0.45) };
  const wrist = { x: lerp(elbow.x, hand.x, 0.8), y: lerp(elbow.y, hand.y, 0.8), z: lerp(elbow.z, hand.z, 0.8) };
  parts.push({ k: 'limb', a: shR, b: sleeve, w: sleeveW, c: sleeveCol, hl: look.tank });
  parts.push({ k: 'limb', a: sleeve, b: elbow, w: 4.2 * armK, c: skin, hl: true });
  parts.push({ k: 'limb', a: elbow, b: hand, w: 3.8 * armK, c: skin, hl: true });
  parts.push({ k: 'limb', a: wrist, b: hand, w: 4.2 * armK, c: upLvl(p, 'remate') ? '#ff3d00' : look.band });

  // ---- Brazo libre (equilibrio / señala la pelota) ----
  const armSwing = moving ? Math.sin(pf.phase) * 6 * runAmt : 0;
  let lh;
  if (charging && pose.kind === 'smash') lh = L(10, -6, 78);
  else if (charging) lh = L(12, -9 * wf, 52);
  else lh = L(8 + armSwing, -10.5 * wf, 44 + Math.abs(armSwing) * 0.3);
  if (cel) lh = cel.lh;
  const lel = { x: (shL.x + lh.x) / 2 - Rx * 2.5, y: (shL.y + lh.y) / 2 - Ry * 2.5, z: (shL.z + lh.z) / 2 - 4 };
  const lsl = { x: lerp(shL.x, lel.x, 0.45), y: lerp(shL.y, lel.y, 0.45), z: lerp(shL.z, lel.z, 0.45) };
  const lwr = { x: lerp(lel.x, lh.x, 0.8), y: lerp(lel.y, lh.y, 0.8), z: lerp(lel.z, lh.z, 0.8) };
  parts.push({ k: 'limb', a: shL, b: lsl, w: sleeveW, c: sleeveCol, hl: look.tank });
  parts.push({ k: 'limb', a: lsl, b: lel, w: 4.2 * armK, c: skin, hl: true });
  parts.push({ k: 'limb', a: lel, b: lh, w: 3.8 * armK, c: skin, hl: true });
  if (!opts.portrait) parts.push({ k: 'limb', a: lwr, b: lh, w: 4.4 * armK, c: TEAM_COLORS[p.team] });   // muñequera del equipo

  // ---- Cabeza ----
  const head = { x: Sc.x + Fx * 0.8, y: Sc.y + Fy * 0.8, z: shZ + 10.5 };
  parts.push({ k: 'limb', a: { x: Sc.x, y: Sc.y, z: shZ - 1 }, b: { x: head.x, y: head.y, z: head.z - 3 }, w: 4.2 * Math.max(1, wf * 0.95), c: skin });
  parts.push({ k: 'head', c: head, r: 5.8, look, fx: Fx, fy: Fy, hats: upLvl(p, 'sombrero') });
  if (cel && cel.peace) {
    parts.push({ k: 'limb', a: hand, b: { x: hand.x - 1, y: hand.y + 1, z: hand.z + 4 }, w: 1.2, c: skin });
    parts.push({ k: 'limb', a: hand, b: { x: hand.x + 1, y: hand.y - 1, z: hand.z + 4 }, w: 1.2, c: skin });
  }

  // ---- Pala ----
  const ps = (1 + 0.15 * upLvl(p, 'pala')) * (actOn(p, 'palaxl') && !opts.portrait ? 2.6 : 1);
  let pdx = hand.x - shR.x, pdy = hand.y - shR.y;
  const pl = Math.hypot(pdx, pdy) || 1;
  pdx /= pl; pdy /= pl;
  const ht = clamp(pose.tilt, -1, 1);
  let dX = pdx * (1 - Math.abs(ht) * 0.55), dY = pdy * (1 - Math.abs(ht) * 0.55), dZ = ht;
  const dl = Math.hypot(dX, dY, dZ) || 1;
  dX /= dl; dY /= dl; dZ /= dl;
  let wX = dY, wY = -dX;
  const wl = Math.hypot(wX, wY);
  if (wl < 0.15) { wX = Fx; wY = Fy; } else { wX /= wl; wY /= wl; }
  const shape = look.paddle.shape;
  const halfLen = (shape === 'round' ? 8.4 : 9) * ps;
  const pc = { x: hand.x + dX * (5.5 * ps + halfLen), y: hand.y + dY * (5.5 * ps + halfLen), z: hand.z + dZ * (5.5 * ps + halfLen) };
  const face = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    let wd;
    if (shape === 'round') wd = 7.6;
    else if (shape === 'diamond') wd = 7.8 * (1 - 0.55 * Math.max(0, -ca)) * (1 - 0.12 * Math.max(0, ca));
    else wd = 7 * (1 + 0.1 * ca);
    wd *= ps;
    face.push({ x: pc.x + dX * halfLen * ca + wX * wd * sa, y: pc.y + dY * halfLen * ca + wY * wd * sa, z: pc.z + dZ * halfLen * ca });
  }
  const tip = { x: pc.x + dX * halfLen, y: pc.y + dY * halfLen, z: pc.z + dZ * halfLen };
  if (swinging) {
    pf.tips.push({ tip, pc });
    if (pf.tips.length > 7) pf.tips.shift();
  } else if (pf.tips.length) {
    pf.tips.shift();
  }
  if (!(cel && cel.hide)) parts.push({
    k: 'paddle', hand, neck: { x: hand.x + dX * 6 * ps, y: hand.y + dY * 6 * ps, z: hand.z + dZ * 6 * ps },
    face, paddle: look.paddle, dot: look.band, center: pc, ps
  });

  // Zeus salta sobre una nube cuando remata
  const cloud = p.lookId === 'zeus' && (pose.kind === 'smash' || (swinging && pf.swingKind === 'smash'));
  const jumpZ = (cel ? cel.jump : 0) + (cloud ? 14 : 0);
  return { parts, pf, look, charging, cr, lob, swinging, portrait: !!opts.portrait, jumpZ, cloud };
}

function drawLimb(a, b, w, color, hl, sole) {
  const lw = Math.max(1, w * (a.s + b.s) / 2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw + 1.4;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  if (sole) {
    ctx.strokeStyle = sole;
    ctx.lineWidth = Math.max(0.8, lw * 0.35);
    ctx.beginPath(); ctx.moveTo(a.x, a.y + lw * 0.32); ctx.lineTo(b.x, b.y + lw * 0.32); ctx.stroke();
  }
  if (hl) {
    ctx.strokeStyle = 'rgba(255, 240, 225, 0.28)';
    ctx.lineWidth = Math.max(0.6, lw * 0.32);
    const ox = -lw * 0.18, oy = -lw * 0.2;
    ctx.beginPath(); ctx.moveTo(a.x + ox, a.y + oy); ctx.lineTo(b.x + ox, b.y + oy); ctx.stroke();
  }
}

function ell(x, y, rx, ry, rot, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), rot || 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// Cabeza con peinado, barba, bigote, lentes, jockey o visera según el personaje
function drawHats(c, r, n) {
  const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
  let y = c.y - r * 0.75;
  for (let k = 0; k < n; k++) {
    ell(c.x, y, r * 1.35, r * 0.32, 0, shade(cols[k % 5], 0.75));
    ctx.fillStyle = cols[k % 5];
    ctx.fillRect(c.x - r * 0.72, y - r * 0.95, r * 1.44, r * 0.95);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x - r * 0.72, y - r * 0.32, r * 1.44, r * 0.18);
    y -= r * 1.05;
  }
}

function drawHead(c, front, r, look, K) {
  const ex = look.extras || {};
  const hs = look.hair, hc = look.hairColor, skin = look.skin;
  let fdx = front.x - c.x, fdy = front.y - c.y;
  const fl = Math.hypot(fdx, fdy) || 1;
  fdx /= fl; fdy /= fl;
  const side = clamp(fl / (6 * K * c.s), 0, 1);      // 0 = de frente o de espaldas, 1 = de perfil
  const toward = front.d < c.d;                       // ¿mira hacia la cámara?
  const faceVis = toward ? 1 : clamp(side * 1.4 - 0.25, 0, 1);
  const off = r * 0.36 * side;
  const fx0 = c.x + fdx * off, fy0 = c.y + r * 0.25;
  const bx = -fdx;                                    // hacia la nuca

  // Pelo detrás de la cabeza
  if (hs === 'afro') ell(c.x + bx * r * 0.15, c.y - r * 0.25, r * 1.5, r * 1.4, 0, hc);
  if (hs === 'mullet') ell(c.x + bx * r * 0.75, c.y + r * 0.85, r * 0.6, r * 0.95, 0, hc);
  if (hs === 'ponytail') ell(c.x + bx * r * 1.05, c.y + r * 0.35, r * 0.42, r * 1.0, bx * 0.5, hc);
  if (hs === 'bun') ell(c.x + bx * r * 0.55, c.y - r * 0.85, r * 0.5, r * 0.46, 0, hc);
  if (hs === 'curly') for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.05 + i * 0.15);
    ell(c.x + Math.cos(a) * r * 0.95, c.y + Math.sin(a) * r * 0.9, r * 0.38, r * 0.38, 0, hc);
  }

  ctx.beginPath(); ctx.arc(c.x, c.y, r + 0.7, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE; ctx.fill();
  const bald = hs === 'bald';
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = bald ? shade(skin, 0.92) : hc;
  ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.clip();
  // Cara
  if (faceVis > 0.02) {
    ctx.globalAlpha = faceVis;
    const g = ctx.createRadialGradient(fx0 - r * 0.2, fy0 - r * 0.1, r * 0.1, fx0, fy0, r * 1.05);
    g.addColorStop(0, shade(skin, 1.12));
    g.addColorStop(1, shade(skin, 0.78));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx0, fy0, r * (bald ? 1.05 : 0.9), 0, Math.PI * 2); ctx.fill();
    if (hs === 'side') ell(c.x + fdx * r * 0.25, c.y - r * 0.62, r * 1.0, r * 0.45, -fdx * 0.25, hc);
    if (hs === 'short' || hs === 'mullet' || hs === 'slick') ell(c.x, c.y - r * 0.72, r * 1.0, r * 0.42, 0, hc);
    if (ex.beard) ell(fx0 + fdx * r * 0.1, fy0 + r * 0.45, r * 0.72, r * 0.42, 0, ex.beard);
    if (ex.mustache && faceVis > 0.3) ell(fx0 + fdx * r * 0.32, fy0 + r * 0.1, r * 0.5, r * 0.17, 0, ex.mustache);
    if (ex.glasses && faceVis > 0.3) {
      ctx.strokeStyle = ex.glasses;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, r * 0.34);
      ctx.beginPath(); ctx.moveTo(fx0 - r * 0.55 + fdx * r * 0.2, fy0 - r * 0.25); ctx.lineTo(fx0 + r * 0.55 + fdx * r * 0.2, fy0 - r * 0.25); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (bald) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath(); ctx.ellipse(c.x - r * 0.3, c.y - r * 0.55, r * 0.35, r * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
  }
  if (hs === 'slick') {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(0.6, r * 0.12);
    ctx.beginPath(); ctx.arc(c.x, c.y + r * 0.2, r * 0.85, Math.PI * 1.2, Math.PI * 1.7); ctx.stroke();
  }
  // Cintillo
  if (ex.headband) {
    ctx.strokeStyle = ex.headband;
    ctx.lineWidth = Math.max(0.8, r * 0.28);
    ctx.beginPath(); ctx.ellipse(c.x, c.y - r * 0.2, r * 1.05, r * 0.35, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
  }
  // Jockey
  if (ex.cap) ell(c.x, c.y - r * 0.42, r * 1.05, r * 0.66, 0, ex.cap);
  ctx.restore();

  if (hs === 'spiky') {
    ctx.fillStyle = hc;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.1 + i * 0.2);
      ctx.moveTo(c.x + Math.cos(a - 0.18) * r * 0.85, c.y + Math.sin(a - 0.18) * r * 0.85);
      ctx.lineTo(c.x + Math.cos(a) * r * 1.5, c.y + Math.sin(a) * r * 1.5);
      ctx.lineTo(c.x + Math.cos(a + 0.18) * r * 0.85, c.y + Math.sin(a + 0.18) * r * 0.85);
    }
    ctx.fill();
  }
  // Visera del jockey o visera deportiva
  if (ex.cap) {
    const vd = ex.capBack ? -1 : 1;
    ell(c.x + fdx * r * 0.95 * vd, c.y - r * 0.32, r * (0.35 + 0.35 * side), r * 0.18, 0, shade(ex.cap === '#ffffff' ? '#e6e6e6' : ex.cap, 0.85));
  }
  if (ex.visor) {
    ctx.strokeStyle = ex.visor;
    ctx.lineWidth = Math.max(0.8, r * 0.26);
    ctx.beginPath(); ctx.ellipse(c.x, c.y - r * 0.3, r * 1.05, r * 0.33, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    ell(c.x + fdx * r * 0.95, c.y - r * 0.28, r * (0.3 + 0.35 * side), r * 0.16, 0, ex.visor);
  }
}

export function drawPlayer(p, idx, built) {
  const { parts, pf, look } = built;
  const items = [];
  const K = built.portrait ? PLAYER_SCALE : scaleOf(p);
  const Kz = K * look.body.h * (1 + 0.03 * upLvl(p, 'estiron')) * (actOn(p, 'gordo') ? 1.2 : 1);
  const ox = built.ox != null ? built.ox : p.x, oy = built.oy != null ? built.oy : p.y;
  const jz = built.jumpZ || 0;
  const T = v => P(ox + (v.x - p.x) * K, oy + (v.y - p.y) * K, v.z * Kz + jz);
  for (const part of parts) {
    if (part.k === 'limb') {
      const a = T(part.a), b = T(part.b);
      items.push({ d: (a.d + b.d) / 2, draw: () => drawLimb(a, b, part.w * K, part.c, part.hl, part.sole) });
    } else if (part.k === 'torso') {
      const L = part.look;
      const q = part.pts.map(T);
      const sh = part.shorts.map(T);
      const cc = T(part.center);
      const bel = part.belly ? T(part.belly) : null;
      items.push({
        d: cc.d + 0.5,
        draw: () => {
          pathPts(ctx, sh);
          ctx.fillStyle = L.shorts;
          ctx.fill();
          ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
          pathPts(ctx, q);
          const g = ctx.createLinearGradient(q[3].x, q[3].y, q[2].x, q[2].y);
          g.addColorStop(0, L.shirtLo);
          g.addColorStop(0.3, L.shirtHi);
          g.addColorStop(0.55, L.shirt);
          g.addColorStop(1, L.shirtLo);
          ctx.fillStyle = g;
          ctx.fill();
          if (bel) {
            // Guatita
            ctx.beginPath(); ctx.arc(bel.x, bel.y, part.belly.r * K * bel.s, 0, Math.PI * 2);
            ctx.fill();
          }
          pathPts(ctx, q);
          const g2 = ctx.createLinearGradient(0, q[3].y, 0, q[0].y);
          g2.addColorStop(0, 'rgba(255,255,255,0.08)');
          g2.addColorStop(1, 'rgba(0,0,0,0.26)');
          ctx.fillStyle = g2;
          ctx.fill();
          ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.stroke();
          if (L.tank) {
            // Musculosa: hombros descubiertos
            ctx.fillStyle = L.skin;
            for (const k of [3, 2]) {
              ctx.beginPath(); ctx.arc(q[k].x + (k === 3 ? 1 : -1) * 1.5, q[k].y + 1.5, Math.max(1.2, 2.6 * K * q[k].s), 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      });
    } else if (part.k === 'head') {
      const c = T(part.c);
      const front = T({ x: part.c.x + part.fx * 6, y: part.c.y + part.fy * 6, z: part.c.z });
      items.push({
        d: c.d,
        draw: () => {
          const r = Math.max(2.5, part.r * K * c.s);
          drawHead(c, front, r, part.look, K);
          if (part.hats) drawHats(c, r, part.hats);
        }
      });
    } else if (part.k === 'paddle') {
      const hand = T(part.hand);
      const neck = T(part.neck);
      const face = part.face.map(T);
      const cc = T(part.center);
      const tips = pf.tips.map(t => ({ tip: T(t.tip), pc: T(t.pc) }));
      items.push({
        d: cc.d - 0.5,
        draw: () => {
          if (tips.length > 1) {
            for (let i = 1; i < tips.length; i++) {
              const a = tips[i - 1], b = tips[i];
              ctx.beginPath();
              ctx.moveTo(a.pc.x, a.pc.y); ctx.lineTo(a.tip.x, a.tip.y); ctx.lineTo(b.tip.x, b.tip.y); ctx.lineTo(b.pc.x, b.pc.y);
              ctx.closePath();
              ctx.fillStyle = `rgba(235, 245, 255, ${0.07 + 0.2 * i / tips.length})`;
              ctx.fill();
            }
          }
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#11151b';
          ctx.lineWidth = Math.max(1.2, 2.4 * K * hand.s);
          ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(neck.x, neck.y); ctx.stroke();
          pathPts(ctx, face);
          ctx.fillStyle = part.paddle.face;
          ctx.fill();
          ctx.strokeStyle = part.paddle.rim;
          ctx.lineWidth = Math.max(0.9, 1.4 * K * cc.s);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cc.x, cc.y, Math.max(0.8, 1.6 * K * part.ps * cc.s), 0, Math.PI * 2);
          ctx.fillStyle = part.dot;
          ctx.fill();
        }
      });
    }
  }
  // Estado: rayo (estrellitas), nube de Zeus
  if (!built.portrait) {
    const top = T({ x: p.x, y: p.y, z: 92 });
    if (p.stun > 0) items.push({ d: top.d - 2, draw: () => {
      for (let k = 0; k < 3; k++) {
        const a = performance.now() * 0.006 + k * 2.1;
        const sx = top.x + Math.cos(a) * 10, sy = top.y + Math.sin(a) * 3.5;
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath(); for (let i = 0; i < 5; i++) { const b = i / 5 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(sx + Math.cos(b) * 3.2, sy + Math.sin(b) * 3.2); ctx.lineTo(sx + Math.cos(b + 0.63) * 1.3, sy + Math.sin(b + 0.63) * 1.3); } ctx.fill();
      }
    } });
    if (built.cloud) {
      const cc = P(ox, oy, 6);
      items.push({ d: cc.d + 1, draw: () => {
        ctx.fillStyle = 'rgba(240, 246, 255, 0.92)';
        for (const [dx, dy, r] of [[-12, 0, 9], [0, -3, 12], [12, 0, 9], [0, 4, 9]]) { ctx.beginPath(); ctx.arc(cc.x + dx * cc.s, cc.y + dy * cc.s, r * cc.s, 0, Math.PI * 2); ctx.fill(); }
      } });
    }
  }
  return items;
}

// Retrato del personaje para los menús (mismo esqueleto 3D, otra cámara)
export function renderPortrait(cv, lookId, up) {
  const L = LOOKS[lookId];
  if (!cv || !L) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 120, h = cv.clientHeight || 120;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c2 = cv.getContext('2d');
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const savedCam = { ...cam };
  const savedCtx = ctx;
  try {
    const dist = 320;
    Object.assign(cam, makeCam(0, 0.16, dist, { x: 0, y: 0, z: 47 }));
    cam.F = h * 0.84 * dist / 104;
    cam.cx = w / 2;
    cam.cy = h * 0.5;
    setCtx(c2);
    pathPts(ctx, groundCircle(0, 0, 18, 0, 24));
    ctx.fillStyle = 'rgba(0, 8, 20, 0.4)';
    ctx.fill();
    const fake = createPlayer(0, 0, 0, L.name, true, L.speed, lookId);
    if (up) fake.up = { ...up };
    const built = buildPlayerParts(fake, -1, 1, 0, newPf(), { portrait: true, facing: Math.PI / 2 - 0.5 });
    const items = drawPlayer(fake, -1, built);
    items.sort((a, b) => b.d - a.d);
    items.forEach(it => it.draw());
  } finally {
    Object.assign(cam, savedCam);
    setCtx(savedCtx);
  }
}
