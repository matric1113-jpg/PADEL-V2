import { COURT, MAX_CHARGE_FRAMES, SMASH_MIN_Z, ENTITY_K } from '../core/constants.js';
import { LOOKS } from '../core/data.js';
import { localInput, rt, state } from '../core/state.js';
import { actOn, sizeOf, upLvl } from '../core/stats.js';
import { angleDiff, clamp, easeOut, lerp } from '../core/util.js';
import { cam } from './camera.js';
import { spawnSand } from './fx.js';

// ---------- Esqueleto de los jugadores: poses y articulaciones en coordenadas de mundo ----------
// No dibuja nada: lo usan el render 2D (palitos proyectados) y el 3D (figuras simples).
export const TEAM_COLORS = ['#45a8ff', '#ff5c50'];
export const PLAYER_SCALE = 1.14;  // un poco más grandes que la escala real para que se lean bien
export const lookOf = p => LOOKS[p.lookId] || LOOKS.fernando;
export const scaleOf = p => PLAYER_SCALE * ENTITY_K * sizeOf(p) * (actOn(p, 'gordo') ? 1.5 : 1);
export const SHADOW_LOOK_COLORS = { skin: '#4a3a78', hairColor: '#1b1430', shirt: '#4b3a7a', shirtHi: '#8a76c8', shirtLo: '#241a40', shorts: '#1b1430', shoes: '#2a2048', band: '#9d7bff' };
export const CELEB_KIND = { german: 'belly', maxi: 'mullet', alvaro: 'flex', fernando: 'cap', matias: 'jump', joaquin: 'peace', zeus: 'bolt' };

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
