import { computeLaunch, getClampedTarget } from '../core/ballistics.js';
import { ACTIVE_COOLDOWN, ACTIVE_DURATION, BALL_R, COURT, GRAVITY, MAX_CHARGE_FRAMES, NET_H, PAD_F, PAD_S, SPRINT_COOLDOWN, SPRINT_DURATION, TILT_BALL_ACCEL, VIEW_H, VIEW_W, ZS } from '../core/constants.js';
import { contraTarget, isContraAim } from '../core/physics.js';
import { gustForce, tiltEase, localInput, rt, state } from '../core/state.js';
import { smashMinOf, upLvl } from '../core/stats.js';
import { clamp } from '../core/util.js';
import { mouseView } from '../input/input.js';
import { P, cam, pathPts } from './camera.js';
import { ctx } from './ctx.js';
import { fx } from './fx.js';
import { lookOf, scaleOf } from './skeleton.js';
import { COLORS, FONT_BODY, FONT_COND } from './theme.js';

// ---------- HUD en el canvas 2D: lo usan los dos renders, con la misma proyección P() ----------

// ---------- Guía de tiro del jugador local ----------
function shotPreviewParams(me, ratio, isLob, isMyServe) {
  const b = state.ball;
  const dir = me.team === 0 ? 1 : -1;
  const padX = me.x + dir * PAD_F, padY = me.y + PAD_S;
  let from;
  if (isMyServe) from = { x: b.x, y: b.y, z: b.z };
  else {
    const near = state.phase === 'PLAY' && b.lastHitTeam !== me.team && Math.hypot(b.x - padX, b.y - padY) < 70;
    from = near ? { x: b.x, y: b.y, z: b.z } : { x: padX, y: padY, z: 30 };
  }
  const charge = Math.max(0.15, ratio);
  let label, speed;
  const fz = 1 + 0.12 * upLvl(me, 'fuerza'), rl = upLvl(me, 'remate');
  if (isMyServe) { label = 'SAQUE'; speed = (5.4 + charge * 2.2 + me.powerStat * 1.4) * (1 + 0.06 * upLvl(me, 'fuerza')); }
  else if (isLob) { label = 'GLOBO'; speed = 3.9 + charge * 1.3; }
  else {
    const pm = (0.78 + me.powerStat * 0.52) * fz;
    if (from.z > smashMinOf(me) && charge >= (rl ? 0.4 : 0.5) && Math.abs(me.x - COURT.netX) < 220) { label = '¡REMATE!'; speed = (7.8 + charge * 3.8) * pm * (1 + 0.1 * rl); }
    else { label = 'DRIVE'; speed = (5.2 + charge * 4.0) * pm; }
  }
  return { from, label, speed };
}

// Contrapared: línea al cristal propio y luego el globo hacia el rival
function drawContraPreview(me) {
  const b = state.ball;
  const wallX = me.team === 0 ? COURT.x + 10 : COURT.x + COURT.w - 10;
  const wy = clamp(localInput.aimY, COURT.y + 30, COURT.y + COURT.h - 30);
  const from = Math.hypot(b.x - me.x, b.y - me.y) < 80 ? { x: b.x, y: b.y, z: Math.max(b.z, 10) } : { x: me.x, y: me.y, z: 30 };
  const w = P(wallX, wy, 58 * ZS);
  const a = P(from.x, from.y, from.z * ZS);
  const { tx, ty } = contraTarget(me, localInput.aimY);
  const v = computeLaunch(wallX, wy, 58, tx, ty, 4.6, 'GLOBO', me.team);
  let x = wallX, y = wy, z = 58, vx = v.vx, vy = v.vy, vz = v.vz;
  const pts = [w];
  for (let i = 0; i < 300 && z > 0; i++) { x += vx; y += vy; z += vz; vz -= GRAVITY; if (i % 2 === 0) pts.push(P(x, y, Math.max(0, z) * ZS)); }
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = 'rgba(160, 230, 255, 0.95)';
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(w.x, w.y); ctx.stroke();
  pathPts(ctx, pts, false); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(w.x, w.y, 5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(160, 230, 255, 0.9)'; ctx.fill();
  const l = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.font = `600 13px ${FONT_COND}`; ctx.textAlign = 'center'; ctx.fillStyle = '#bfefff';
  ctx.fillText('Contrapared', w.x, w.y - 10);
}

// Dónde va a botar la pelota (marca en el suelo)
export function predictLanding() {
  const b = state.ball;
  if (state.phase !== 'PLAY') return null;
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
  for (let i = 0; i < 400; i++) {
    x += vx; y += vy; z += vz; vz -= GRAVITY;
    if (z > 0) { vy += gustForce(i + 1); const e = tiltEase(i + 1) * TILT_BALL_ACCEL; vx += state.tilt.x * e; vy += state.tilt.y * e; }
    if (x < COURT.x + 10 || x > COURT.x + COURT.w - 10 || y < COURT.y + 10 || y > COURT.y + COURT.h - 10) return null;
    if (z <= 0) return i < 2 ? null : { x, y };
  }
  return null;
}

// Blanco de tiro del jugador local en el suelo (lo dibuja cada render a su manera)
export function aimTarget(me) {
  const ratio = rt.isHost ? (me.chargeFrames / MAX_CHARGE_FRAMES) : (rt.localChargeFrames / MAX_CHARGE_FRAMES);
  const isCharging = rt.isHost ? me.charging : localInput.charging;
  const isLob = rt.isHost ? me.lobMode : localInput.lobMode;
  const isMyServe = (state.phase === 'SERVE' && state.serverSlot === rt.mySlot);

  const { tx, ty } = getClampedTarget(me.team, localInput.aimX, localInput.aimY, ratio, me.powerStat, isLob, isMyServe);

  let aimValid = true;
  if (isMyServe) {
    const box = state.serveTargetBox;
    aimValid = (tx >= box.minX && tx <= box.maxX && ty >= box.minY && ty <= box.maxY);
  }
  const col = !aimValid ? '239, 68, 68' : (isLob ? '96, 190, 255' : '228, 255, 58');
  return { tx, ty, col, ratio, isCharging, isLob, isMyServe };
}

// Arco 3D previsto del golpe (misma balística que la física)
export function drawAimArc(me) {
  const { tx, ty, col, ratio, isCharging, isLob, isMyServe } = aimTarget(me);
  if (!isCharging || state.phase === 'POINT_PAUSE') return;
  if (!isMyServe && !isLob && isContraAim(me, localInput.aimX)) { drawContraPreview(me); return; }
  const { from, label, speed } = shotPreviewParams(me, ratio, isLob, isMyServe);
  const v = computeLaunch(from.x, from.y, from.z, tx, ty, speed, label, me.team);
  let x = from.x, y = from.y, z = from.z, vx = v.vx, vy = v.vy, vz = v.vz;
  const pts = [P(x, y, z * ZS + BALL_R)];
  const shadow = [P(x, y, 0)];
  let netFail = false;
  for (let i = 0; i < 300; i++) {
    const px = x;
    x += vx; y += vy; z += vz; vz -= GRAVITY;
    if (z > 0) { vy += gustForce(i + 1); const e = tiltEase(i + 1) * TILT_BALL_ACCEL; vx += state.tilt.x * e; vy += state.tilt.y * e; }
    if ((px - COURT.netX) * (x - COURT.netX) < 0 && z < NET_H) netFail = true;
    if (z <= 0) { pts.push(P(x, y, BALL_R)); shadow.push(P(x, y, 0)); break; }
    if (i % 2 === 0) { pts.push(P(x, y, z * ZS + BALL_R)); shadow.push(P(x, y, 0)); }
    if (x < COURT.x || x > COURT.x + COURT.w) break;
  }
  const arcCol = netFail ? '239, 68, 68' : col;
  ctx.setLineDash([2, 6]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${arcCol}, 0.22)`;
  ctx.lineWidth = 1.5;
  pathPts(ctx, shadow, false); ctx.stroke();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = `rgba(${arcCol}, 0.9)`;
  ctx.lineWidth = 2.2;
  pathPts(ctx, pts, false); ctx.stroke();
  ctx.setLineDash([]);
  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${arcCol}, 0.95)`; ctx.fill();
}

// Transformación de lo que está en el mundo: escala del canvas, sacudida (sx, sy) y giro de Atlas
export function setWorldTransform(S, sx, sy) {
  ctx.setTransform(S, 0, 0, S, sx * S, sy * S);
  const v = fx.view;
  if (v.rot || v.oy || v.k !== 1) {
    ctx.translate(VIEW_W / 2, VIEW_H / 2 + v.oy);
    ctx.rotate(v.rot);
    ctx.scale(v.k, v.k);
    ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
  }
}

// ---------- Interfaz en pantalla ----------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawNameplate(p, idx, built) {
  const anchorZ = Math.max(98, built.pf.pose.z + 58) + upLvl(p, 'sombrero') * 7;   // sube si la pala está en alto o hay sombreros
  const top = P(p.x, p.y, anchorZ * scaleOf(p) * lookOf(p).body.h + (built.jumpZ || 0));
  const k = clamp(top.s / 1.0, 0.85, 1.12);
  const isMe = idx === rt.mySlot;
  const x = top.x, y = top.y;
  const bw = 50 * k;

  ctx.font = `600 ${Math.round(13 * k)}px ${FONT_COND}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(4, 10, 20, 0.85)';
  ctx.lineWidth = 3;
  ctx.strokeText(p.name, x, y - 9 * k);
  ctx.fillStyle = isMe ? COLORS.ball : '#f2f6fa';
  ctx.fillText(p.name, x, y - 9 * k);

  // Barra de sprint o de la activa (siempre visible, como la vida en un MOBA)
  let sprintRatio, fillCol;
  if (p.active) {
    sprintRatio = p.activeT > 0 ? p.activeT / ACTIVE_DURATION : 1 - p.activeCd / ACTIVE_COOLDOWN;
    fillCol = p.activeT > 0 ? '#e1d4ff' : (p.activeCd === 0 ? '#a07bff' : '#5a5076');
  } else {
    sprintRatio = p.sprintActiveTimer > 0 ? (p.sprintActiveTimer / (p.sprintDurMax || SPRINT_DURATION)) : (1 - p.sprintCooldown / (p.sprintCdMax || SPRINT_COOLDOWN));
    fillCol = p.sprintActiveTimer > 0 ? COLORS.ball : (p.sprintCooldown === 0 ? (p.team === 0 ? COLORS.blue : COLORS.red) : '#5d6f82');
  }
  roundRect(x - bw / 2, y - 4 * k, bw, 5 * k, 2);
  ctx.fillStyle = 'rgba(4, 10, 20, 0.8)'; ctx.fill();
  if (sprintRatio > 0.01) {
    roundRect(x - bw / 2 + 1, y - 3 * k, (bw - 2) * clamp(sprintRatio, 0, 1), 3 * k, 1.5);
    ctx.fillStyle = fillCol; ctx.fill();
  }

  // Barra de carga del golpe
  if (built.charging) {
    const r = built.cr;
    const cy = y - 27 * k;
    roundRect(x - bw / 2, cy, bw, 7 * k, 3);
    ctx.fillStyle = 'rgba(4, 10, 20, 0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    const c = built.lob ? '#60beff' : (r > 0.85 ? '#ff8a2a' : (r > 0.45 ? '#ffd23a' : COLORS.ball));
    if (r > 0.01) {
      roundRect(x - bw / 2 + 1.5, cy + 1.5, (bw - 3) * r, 7 * k - 3, 2);
      ctx.fillStyle = c; ctx.fill();
    }
  }
}

function drawBanner() {
  if (state.bannerTimer <= 0 || !state.bannerText) return;
  const alpha = clamp(state.bannerTimer / 14, 0, 1);
  const lines = String(state.bannerText).split('\n');
  const title = lines[0], sub = lines[1] || '';
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `600 24px ${FONT_COND}`;
  const tw = ctx.measureText(title).width;
  ctx.font = `500 15px ${FONT_BODY}`;
  const sw = sub ? ctx.measureText(sub).width : 0;
  const w = Math.max(tw, sw) + 52;
  const h = sub ? 64 : 42;
  const x = VIEW_W / 2 - w / 2, y = VIEW_H - h - 22;
  roundRect(x, y, w, h, 6);
  ctx.fillStyle = 'rgba(8, 19, 31, 0.88)';
  ctx.fill();
  ctx.fillStyle = COLORS.ball;
  ctx.fillRect(x, y + 8, 4, h - 16);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f2f6fa';
  ctx.font = `600 24px ${FONT_COND}`;
  ctx.fillText(title, x + 24, y + 30);
  if (sub) {
    ctx.fillStyle = '#a9bdd0';
    ctx.font = `500 15px ${FONT_BODY}`;
    ctx.fillText(sub, x + 24, y + 52);
  }
  ctx.restore();
}

function drawAbilityGlyph(kind, cx, cy, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  if (kind === 'clone') {
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(cx - 5, cy - 3, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(cx - 11, cy + 4, 12, 9);
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx + 4, cy - 5, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(cx - 2, cy + 2, 12, 10);
  } else if (kind === 'gordo') {
    ctx.beginPath(); ctx.arc(cx, cy + 3, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 11, 5, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'palaxl') {
    ctx.beginPath(); ctx.ellipse(cx + 2, cy - 4, 9, 11, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + 4); ctx.lineTo(cx - 11, cy + 13); ctx.stroke();
  } else if (kind === 'hielo') {
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 12, cy - Math.sin(a) * 12); ctx.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); ctx.stroke(); }
  } else {
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - 15); ctx.lineTo(cx - 8, cy + 2); ctx.lineTo(cx - 1, cy + 2);
    ctx.lineTo(cx - 4, cy + 15); ctx.lineTo(cx + 8, cy - 3); ctx.lineTo(cx + 1, cy - 3); ctx.closePath();
    ctx.fill();
  }
}

function drawSprintAbility(me) {
  const right = cam.team !== 1;
  const cx = right ? VIEW_W - 58 : 58, cy = VIEW_H - 64, r = 26;
  const isAct = !!me.active;
  const active = isAct ? me.activeT > 0 : me.sprintActiveTimer > 0;
  const cd = isAct ? me.activeCd : me.sprintCooldown;
  const cdMax = isAct ? ACTIVE_COOLDOWN : (me.sprintCdMax || SPRINT_COOLDOWN);
  const ready = cd === 0;
  const tint = isAct ? '#b79cff' : COLORS.ball;
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8, 19, 31, 0.88)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = ready || active ? (isAct ? 'rgba(160, 120, 255, 0.18)' : 'rgba(228, 255, 58, 0.14)') : 'rgba(255,255,255,0.04)'; ctx.fill();
  drawAbilityGlyph(isAct ? me.active : 'sprint', cx, cy, ready || active ? tint : '#6c7f92');
  if (!ready && !active) {
    const k = cd / cdMax;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.closePath();
    ctx.fillStyle = 'rgba(4, 10, 20, 0.62)'; ctx.fill();
    ctx.fillStyle = '#eef3f8';
    ctx.font = `700 17px ${FONT_COND}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(cd / 60), cx, cy + 1);
  }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = active ? tint : (ready ? (isAct ? 'rgba(183, 156, 255, 0.8)' : 'rgba(228, 255, 58, 0.7)') : 'rgba(150, 190, 225, 0.3)');
  ctx.beginPath();
  const dur = isAct ? me.activeT / ACTIVE_DURATION : me.sprintActiveTimer / (me.sprintDurMax || SPRINT_DURATION);
  if (active) ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dur);
  else ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `600 12px ${FONT_COND}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a9bdd0';
  ctx.fillText('Espacio', cx, cy + r + 17);
}

function drawCursor(me) {
  if (!mouseView.inside) return;
  const ratio = rt.isHost ? (me.chargeFrames / MAX_CHARGE_FRAMES) : (rt.localChargeFrames / MAX_CHARGE_FRAMES);
  const charging = rt.isHost ? me.charging : localInput.charging;
  const lob = rt.isHost ? me.lobMode : localInput.lobMode;
  const { x, y } = mouseView;
  ctx.strokeStyle = 'rgba(4, 10, 20, 0.7)';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  if (charging) {
    ctx.strokeStyle = lob ? '#60beff' : (ratio > 0.85 ? '#ff8a2a' : COLORS.ball);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke();
  }
}

// Globo de diálogo sobre la cabeza
function drawTalk(built) {
  const t = fx.talk;
  if (!t) return;
  const p = state.players[t.slot];
  if (!p || p.out || !built[t.slot]) return;
  const anchorZ = Math.max(98, built[t.slot].pf.pose.z + 58) + upLvl(p, 'sombrero') * 7;
  const top = P(p.x, p.y, anchorZ * scaleOf(p) * lookOf(p).body.h + 16);
  const a = clamp(Math.min(t.t / 6, (140 - t.t) / 16), 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `600 14px ${FONT_BODY}`;
  const w = ctx.measureText(t.text).width + 20, h = 26;
  const x = clamp(top.x - w / 2, 8, VIEW_W - w - 8), y = top.y - 34 - h;
  roundRect(x, y, w, h, 9);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(top.x - 6, y + h - 1); ctx.lineTo(top.x, y + h + 8); ctx.lineTo(top.x + 6, y + h - 1); ctx.fill();
  ctx.fillStyle = '#0b1a29'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t.text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}
function drawReplayBars() {
  ctx.fillStyle = '#05080d';
  ctx.fillRect(0, 0, VIEW_W, 46); ctx.fillRect(0, VIEW_H - 46, VIEW_W, 46);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = `700 22px ${FONT_COND}`;
  const tw = ctx.measureText('Repetición').width;
  ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(VIEW_W / 2 - tw / 2 - 14, VIEW_H - 23, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2f6fa'; ctx.fillText('Repetición', VIEW_W / 2, VIEW_H - 22);
  ctx.font = `500 15px ${FONT_BODY}`; ctx.fillStyle = '#c6d4e1';
  ctx.fillText(fx.replay.reason, VIEW_W / 2, 24);
}

// HUD completo sobre el mundo. setWorld() pone la transformación de lo que va anclado a los
// jugadores (nombres, barras, globos); built son los esqueletos del cuadro (view/skeleton.js).
export function drawHud(me, built, S, setWorld) {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  if (fx.replay) {
    drawReplayBars();
  } else {
    setWorld();
    state.players.forEach((p, idx) => { if (!p.out && built[idx]) drawNameplate(p, idx, built[idx]); });
    drawTalk(built);
    ctx.setTransform(S, 0, 0, S, 0, 0);
    if (state.screen === 'play') {
      drawBanner();
      drawSprintAbility(me);
      drawCursor(me);
    }
  }
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${fx.flash * 0.55})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
