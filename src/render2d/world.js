import { BALL_R, COURT, GRAVITY, MAX_CHARGE_FRAMES, NET_H, PAD_F, PAD_S, VIEW_H, VIEW_W, ZS } from '../core/constants.js';
import { getClampedTarget } from '../core/ballistics.js';
import { localInput, mapOf, rt, state } from '../core/state.js';
import { reachOf, reachZOf } from '../core/stats.js';
import { clamp, lerp } from '../core/util.js';
import { canvas } from '../dom.js';
import { mouseView } from '../input/input.js';
import { CAMS, P, cam, groundCircle, pathPts, unprojectGround } from '../view/camera.js';
import { ctx } from '../view/ctx.js';
import { fx } from '../view/fx.js';
import { beginFrame, swapInReplay, swapOutReplay } from '../view/frame.js';
import { aimTarget, drawAimArc, drawHud } from '../view/hud.js';
import { CELEB_KIND, SHADOW_LOOK_COLORS, buildPlayerParts, lookOf } from '../view/skeleton.js';
import { BP, WALLS } from './court.js';
import { LAYERS, layerKey, rebuildLayers, renderScale } from './layers.js';
import { drawBallShadows, drawPlayer, drawPlayerShadows } from './players.js';

export function updateAimFromMouse() {
  if (!cam.ready || !mouseView.moved) return;
  let mx = mouseView.x, my = mouseView.y;
  const v = fx.view;
  if (v && (v.rot || v.oy || v.k !== 1)) {
    const cx = VIEW_W / 2, cy = VIEW_H / 2 + v.oy;
    const dx = (mx - cx) / v.k, dy = (my - cy) / v.k;
    mx = cx + dx * Math.cos(-v.rot) - dy * Math.sin(-v.rot);
    my = cy - v.oy + dx * Math.sin(-v.rot) + dy * Math.cos(-v.rot);
  }
  const g = unprojectGround(mx, my);
  if (g) {
    localInput.aimX = g.x;
    localInput.aimY = g.y;
  }
}
// ---------- Pelota ----------
function ballItems() {
  const b = state.ball;
  const z = b.z * ZS + BALL_R;
  const pp = P(b.x, b.y, z);
  const hot = b.shotType === '¡REMATE!';
  return [{
    d: pp.d,
    x: b.x,
    draw: () => {
      // Estela con perspectiva
      const tr = b.trail;
      if (state.phase === 'PLAY' && tr.length > 1) {
        const pts = tr.map(t => P(t.x, t.y, t.z * ZS + BALL_R));
        pts.push(pp);
        ctx.lineCap = 'round';
        for (let i = 1; i < pts.length; i++) {
          const k = i / pts.length;
          ctx.strokeStyle = hot ? `rgba(255, 190, 60, ${k * 0.5})` : `rgba(228, 255, 58, ${k * 0.38})`;
          ctx.lineWidth = Math.max(1, BALL_R * 2 * pts[i].s * k * 0.85);
          ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        }
      }
      const rr = Math.max(2.6, BALL_R * pp.s);
      const g = ctx.createRadialGradient(pp.x - rr * 0.35, pp.y - rr * 0.4, rr * 0.05, pp.x, pp.y, rr * 1.05);
      g.addColorStop(0, '#fbffd6');
      g.addColorStop(0.35, hot ? '#ffe34a' : '#e4ff3a');
      g.addColorStop(1, hot ? '#b07a12' : '#88a01c');
      ctx.beginPath(); ctx.arc(pp.x, pp.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = Math.max(0.7, rr * 0.16);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, rr * 0.62, fx.ballSpin, fx.ballSpin + Math.PI * 0.85);
      ctx.stroke();
    }
  }];
}

// ---------- Red ----------
function drawNet() {
  const x0 = COURT.netX;
  const hc = NET_H * ZS, hp = hc + 2.4;
  const y0 = COURT.y, y1 = COURT.y + COURT.h;
  const half = (y1 - y0) / 2, mid = (y0 + y1) / 2;
  const n = fx.net;
  const topZ = y => hp - (hp - hc) * (1 - ((y - mid) / half) ** 2);
  const bulge = (y, zf) => n.amp ? n.dir * n.amp * Math.exp(-(((y - n.y0) / 55) ** 2)) * Math.sin(zf * Math.PI) * Math.cos(n.t * 0.55) : 0;
  const pt = (y, zf) => P(x0 + bulge(y, zf), y, topZ(y) * zf);

  // Paño
  const outline = [];
  for (let y = y0; y <= y1; y += 20) outline.push(pt(y, 0));
  for (let y = y1; y >= y0; y -= 20) outline.push(pt(y, 1));
  pathPts(ctx, outline);
  ctx.fillStyle = 'rgba(8, 12, 18, 0.42)';
  ctx.fill();

  // Malla romboidal
  ctx.strokeStyle = 'rgba(12, 16, 22, 0.75)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let y = y0; y <= y1; y += 6) {
    const a = pt(y, 0), b = pt(y, 0.92);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  }
  for (let k = 1; k <= 5; k++) {
    const zf = k / 6;
    let first = true;
    for (let y = y0; y <= y1; y += 20) {
      const q = pt(y, zf);
      if (first) { ctx.moveTo(q.x, q.y); first = false; } else ctx.lineTo(q.x, q.y);
    }
  }
  ctx.stroke();

  // Faja blanca superior
  const tape = [];
  for (let y = y0; y <= y1; y += 10) tape.push(pt(y, 1));
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(2, 3.8 * tape[0].s);
  pathPts(ctx, tape, false); ctx.stroke();
  ctx.strokeStyle = '#f2f5f8';
  ctx.lineWidth = Math.max(1.5, 2.8 * tape[0].s);
  pathPts(ctx, tape, false); ctx.stroke();

  // Postes
  for (const y of [y0, y1]) {
    const b = P(x0, y, 0), t = P(x0, y, hp + 3);
    ctx.strokeStyle = '#151b23';
    ctx.lineWidth = Math.max(1.5, 3.4 * b.s);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
  }
}

// ---------- Elementos sobre el suelo ----------
function drawServeBox() {
  const b = state.ball;
  if (!(state.phase === 'SERVE' || (state.phase === 'PLAY' && b.isServeShot && b.bouncesInOpponentSide === 0))) return;
  const box = state.serveTargetBox;
  const q = [P(box.minX, box.minY, 0), P(box.maxX, box.minY, 0), P(box.maxX, box.maxY, 0), P(box.minX, box.maxY, 0)];
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
  pathPts(ctx, q);
  ctx.fillStyle = `rgba(228, 255, 58, ${0.1 + pulse * 0.06})`;
  ctx.fill();
  const qi = [P(box.minX + 3, box.minY + 3, 0), P(box.maxX - 3, box.minY + 3, 0), P(box.maxX - 3, box.maxY - 3, 0), P(box.minX + 3, box.maxY - 3, 0)];
  pathPts(ctx, qi);
  ctx.strokeStyle = `rgba(228, 255, 58, ${0.55 + pulse * 0.3})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function drawPlayerRing(p, idx) {
  const isMe = idx === rt.mySlot;
  const isServer = state.phase === 'SERVE' && state.serverSlot === idx;
  const col = isMe ? '228, 255, 58' : (p.team === 0 ? '69, 168, 255' : '255, 92, 80');
  const pulse = isServer ? 0.5 + 0.5 * Math.sin(performance.now() * 0.008) : 0;
  const ring = groundCircle(p.x, p.y, 20 + pulse * 3, 0, 36);
  pathPts(ctx, ring);
  ctx.strokeStyle = `rgba(${col}, ${isMe ? 0.9 : 0.5})`;
  ctx.lineWidth = isMe ? 2.2 : 1.5;
  ctx.stroke();
  if (isMe) {
    ctx.fillStyle = `rgba(${col}, 0.07)`;
    ctx.fill();
    // Marcas tipo MOBA
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const p0 = P(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, 0);
      const p1 = P(p.x + Math.cos(a) * 28, p.y + Math.sin(a) * 28, 0);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }
}

function drawReach(p, idx, charging) {
  const b = state.ball;
  const dir = p.team === 0 ? 1 : -1;
  const px = p.x + dir * PAD_F, py = p.y + PAD_S;
  const swingFlash = p.swingTimer > 0;
  if (!charging && !swingFlash) return;
  const reach = reachOf(p);
  const inRange = state.phase === 'PLAY' && b.lastHitTeam !== p.team &&
    Math.hypot(b.x - px, b.y - py) <= reach && b.z <= reachZOf(p);
  const isMe = idx === rt.mySlot;
  pathPts(ctx, groundCircle(px, py, reach, 0, 36));
  if (inRange && isMe) {
    ctx.fillStyle = 'rgba(228, 255, 58, 0.12)';
    ctx.fill();
  }
  ctx.strokeStyle = swingFlash ? 'rgba(250, 204, 21, 0.7)' : (inRange ? 'rgba(228, 255, 58, 0.8)' : `rgba(255, 255, 255, ${isMe ? 0.32 : 0.14})`);
  ctx.lineWidth = swingFlash ? 2.2 : 1.2;
  ctx.setLineDash(swingFlash ? [] : [5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRivalAims(me) {
  state.players.forEach((p, i) => {
    if (p.team === me.team || !p.charging) return;
    const serve = state.phase === 'SERVE' && state.serverSlot === i;
    const cr = Math.min(1, p.chargeFrames / MAX_CHARGE_FRAMES);
    const { tx, ty } = getClampedTarget(p.team, p.aimX, p.aimY, cr, p.powerStat, p.lobMode, serve);
    pathPts(ctx, groundCircle(tx, ty, 13, 0, 26));
    ctx.fillStyle = 'rgba(255, 92, 80, 0.12)';
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 92, 80, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function predictLanding() {
  const b = state.ball;
  if (state.phase !== 'PLAY') return null;
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
  for (let i = 0; i < 400; i++) {
    x += vx; y += vy; z += vz; vz -= GRAVITY;
    if (z > 0 && state.gust.t > 0) vy += state.gust.w;
    if (x < COURT.x + 10 || x > COURT.x + COURT.w - 10 || y < COURT.y + 10 || y > COURT.y + COURT.h - 10) return null;
    if (z <= 0) return i < 2 ? null : { x, y };
  }
  return null;
}

function drawLandingMarker() {
  const land = predictLanding();
  if (!land) return;
  const me = state.players[rt.mySlot];
  const mine = me && ((land.x < COURT.netX) === (me.team === 0));
  const col = mine ? '228, 255, 58' : '255, 255, 255';
  pathPts(ctx, groundCircle(land.x, land.y, 7, 0, 20));
  ctx.strokeStyle = `rgba(${col}, ${mine ? 0.55 : 0.22})`;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  pathPts(ctx, groundCircle(land.x, land.y, 2, 0, 10));
  ctx.fillStyle = `rgba(${col}, ${mine ? 0.6 : 0.25})`;
  ctx.fill();
}

function drawGroundFx() {
  for (const r of fx.rings) {
    const k = r.t / 26;
    pathPts(ctx, groundCircle(r.x, r.y, 4 + k * 18, 0, 22));
    ctx.strokeStyle = `rgba(230, 236, 210, ${0.45 * (1 - k)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function drawRipples(walls) {
  for (const rp of fx.ripples) {
    if (!walls.includes(rp.wall)) continue;
    const wall = WALLS[rp.wall];
    const k = rp.t / 30;
    for (const m of [1, 0.6]) {
      const rad = (5 + k * 30) * m;
      const pts = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const q = wall.pt(rp.a + Math.cos(a) * rad, Math.max(0, rp.z + Math.sin(a) * rad));
        pts.push(P(q.x, q.y, q.z));
      }
      pathPts(ctx, pts);
      ctx.strokeStyle = `rgba(200, 240, 255, ${0.55 * (1 - k) * m})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
}

function particleItems() {
  return fx.particles.map(pt => {
    const pp = P(pt.x, pt.y, pt.z);
    return {
      d: pp.d, x: pt.x,
      draw: () => {
        const a = (1 - pt.life / pt.max) * 0.75;
        ctx.fillStyle = `rgba(214, 200, 160, ${a})`;
        const r = Math.max(0.6, pt.size * pp.s);
        ctx.fillRect(pp.x - r / 2, pp.y - r / 2, r, r);
      }
    };
  });
}

function impactItems() {
  return fx.impacts.map(im => {
    const pp = P(im.x, im.y, im.z);
    return {
      d: pp.d - 1, x: im.x,
      draw: () => {
        const k = im.t / 14;
        const r = (im.big ? 26 : 14) * pp.s * (0.4 + k);
        ctx.strokeStyle = im.big ? `rgba(255, 200, 80, ${0.9 * (1 - k)})` : `rgba(255, 255, 255, ${0.8 * (1 - k)})`;
        ctx.lineWidth = im.big ? 3 : 2;
        ctx.beginPath(); ctx.arc(pp.x, pp.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + 0.3;
          ctx.moveTo(pp.x + Math.cos(a) * r * 0.7, pp.y + Math.sin(a) * r * 0.7);
          ctx.lineTo(pp.x + Math.cos(a) * r * 1.25, pp.y + Math.sin(a) * r * 1.25);
        }
        ctx.stroke();
      }
    };
  });
}

// ---------- Blanco de tiro del jugador local ----------
function drawAimGround(me) {
  const { tx, ty, col, ratio, isCharging } = aimTarget(me);
  const rad = isCharging ? 10 + ratio * 6 : 8;
  pathPts(ctx, groundCircle(tx, ty, rad, 0, 30));
  ctx.fillStyle = `rgba(${col}, ${isCharging ? 0.14 : 0.06})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${col}, ${isCharging ? 0.95 : 0.6})`;
  ctx.lineWidth = isCharging ? 2.2 : 1.4;
  ctx.stroke();
  const a = P(tx - 14, ty, 0), b2 = P(tx + 14, ty, 0), c = P(tx, ty - 14, 0), d = P(tx, ty + 14, 0);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y);
  ctx.lineWidth = 1.2; ctx.stroke();
}

// ---------- Frame completo ----------

function drawMapDynamics(layer) {
  const M = mapOf();
  if (layer === 'sky') {
    for (const bd of fx.birds) {
      const q = BP(bd.x, bd.z), s = 7 * q.s * 3, f = Math.sin(bd.ph) * 0.6;
      ctx.strokeStyle = 'rgba(30, 30, 40, 0.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(q.x - s, q.y - s * f); ctx.lineTo(q.x, q.y); ctx.lineTo(q.x + s, q.y - s * f); ctx.stroke();
    }
    return;
  }
  if (layer === 'ground') {
    if (state.ice) {
      const s = state.ice.side, a = clamp(state.ice.t / 30, 0, 1);
      const x0 = s === 0 ? COURT.x : COURT.netX, x1 = s === 0 ? COURT.netX : COURT.x + COURT.w;
      pathPts(ctx, [P(x0, COURT.y, 0), P(x1, COURT.y, 0), P(x1, COURT.y + COURT.h, 0), P(x0, COURT.y + COURT.h, 0)]);
      ctx.fillStyle = `rgba(200, 240, 255, ${0.3 * a})`; ctx.fill();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * a})`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 14; k++) { const x = x0 + ((k * 97) % (x1 - x0)), y = COURT.y + ((k * 131) % COURT.h); const p0 = P(x, y, 0), p1 = P(x + 30, y + 12, 0); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); }
      ctx.stroke();
    }
    for (const e of state.embers) {
      const c = P(e.x, e.y, 0), a = clamp(e.t / 40, 0, 1);
      pathPts(ctx, groundCircle(e.x, e.y, 22, 0, 24));
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 26 * c.s);
      g.addColorStop(0, `rgba(255, 200, 80, ${0.75 * a})`); g.addColorStop(0.6, `rgba(255, 90, 20, ${0.5 * a})`); g.addColorStop(1, 'rgba(120, 20, 0, 0)');
      ctx.fillStyle = g; ctx.fill();
    }
    for (const bo of state.bolts) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.02);
      const locked = bo.t <= 42;
      pathPts(ctx, groundCircle(bo.x, bo.y, 30, 0, 30));
      ctx.fillStyle = `rgba(255, 240, 120, ${locked ? 0.3 : 0.12 + 0.1 * pulse})`; ctx.fill();
      ctx.strokeStyle = `rgba(255, 245, 160, ${0.6 + 0.3 * pulse})`; ctx.lineWidth = locked ? 2.4 : 1.6; ctx.stroke();
    }
    return;
  }
  if (layer === 'air') {
    // Nubes de tormenta sobre los avisos y descargas
    for (const bo of state.bolts) {
      const c = P(bo.x, bo.y, 300);
      ctx.fillStyle = 'rgba(50, 55, 75, 0.75)';
      for (const [dx, dy, r] of [[-16, 0, 13], [0, -5, 17], [16, 0, 13]]) { ctx.beginPath(); ctx.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2); ctx.fill(); }
    }
    for (const st of fx.strikes) {
      const a = 1 - st.t / 26;
      const top = P(st.x, st.y, 300), bot = P(st.x, st.y, 0);
      ctx.strokeStyle = `rgba(255, 255, 210, ${a})`; ctx.lineWidth = 3.2; ctx.lineJoin = 'miter';
      ctx.beginPath(); ctx.moveTo(top.x, top.y);
      for (let k = 1; k <= 6; k++) { const t = k / 6; ctx.lineTo(lerp(top.x, bot.x, t) + (k % 2 ? 8 : -8) * (k < 6 ? 1 : 0), lerp(top.y, bot.y, t)); }
      ctx.stroke();
    }
    for (const s of fx.sparks) {
      const q = P(s.x, s.y, s.z);
      ctx.fillStyle = s.fire ? `rgba(255, ${120 + Math.random() * 80}, 30, ${1 - s.t / s.max})` : s.elec ? `rgba(160, 220, 255, ${1 - s.t / s.max})` : `rgba(255, 240, 180, ${1 - s.t / s.max})`;
      ctx.fillRect(q.x - 1.2, q.y - 1.2, 2.4, 2.4);
    }
    if (fx.rain.length) {
      ctx.strokeStyle = 'rgba(200, 220, 240, 0.22)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of fx.rain) { const a = P(d.x, d.y, d.z), b = P(d.x, d.y + 2, d.z + 14); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
    }
    if (fx.streaks.length) {
      ctx.strokeStyle = 'rgba(235, 242, 250, 0.35)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const s of fx.streaks) { const a = P(s.x, s.y, s.z), b = P(s.x, s.y - Math.sign(state.gust.w || 1) * 60, s.z); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
    }
  }
}

function setWorldTransform(S, sx, sy) {
  ctx.setTransform(S, 0, 0, S, sx * S, sy * S);
  const v = fx.view;
  if (v.rot || v.oy || v.k !== 1) {
    ctx.translate(VIEW_W / 2, VIEW_H / 2 + v.oy);
    ctx.rotate(v.rot);
    ctx.scale(v.k, v.k);
    ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
  }
}

function drawWorld(dt, now, which, me) {
  const S = renderScale;
  const sx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
  const sy = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
  const inReplay = which === 'replay';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#071019';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  setWorldTransform(S, sx, sy);
  ctx.drawImage(LAYERS[which].st, 0, 0, VIEW_W, VIEW_H);
  drawMapDynamics('sky');
  drawRipples(['F', 'L', 'R']);

  // --- Suelo ---
  const players = state.players;
  if (!inReplay) drawServeBox();
  drawMapDynamics('ground');
  const celebKind = p => CELEB_KIND[p.lookId] || 'fist';
  const built = players.map((p, idx) => p.out ? null : buildPlayerParts(p, idx, dt * (inReplay ? 0.45 : 1), now, fx.players[idx],
    fx.celeb && !inReplay && p.team === fx.celeb.team ? { celeb: { kind: celebKind(p), t: fx.celeb.t } } : {}));
  const builtClones = players.map((p, idx) => {
    if (p.out || !p.clone) return null;
    const look = { ...lookOf(p), ...SHADOW_LOOK_COLORS, extras: {}, paddle: { ...lookOf(p).paddle, face: '#2a2048', rim: '#9d7bff' } };
    const fake = { ...p, x: p.clone.x, y: p.clone.y, clone: null };
    const bc = buildPlayerParts(fake, idx, dt, now, fx.clones[idx], { look });
    bc.fake = fake;
    return bc;
  });
  players.forEach(p => { if (!p.out) drawPlayerShadows(p); });
  drawBallShadows(state.ball);
  drawGroundFx();
  players.forEach((p, idx) => { if (!p.out) drawPlayerRing(p, idx); });
  if (!inReplay) {
    players.forEach((p, idx) => { if (!p.out) drawReach(p, idx, built[idx].charging); });
    drawLandingMarker();
    drawAimGround(me);
  }

  const b = state.ball;
  const bh = b.z * ZS;
  if (bh > 30 && (state.phase === 'PLAY' || inReplay)) {
    const g0 = P(b.x, b.y, 0), g1 = P(b.x, b.y, bh);
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(228, 255, 58, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- Objetos con profundidad: lado lejano de la red, red, lado cercano ---
  const items = [];
  players.forEach((p, idx) => {
    if (p.out) return;
    for (const it of drawPlayer(p, idx, built[idx])) { it.x = p.x; items.push(it); }
    const bc = builtClones[idx];
    if (bc) for (const it of drawPlayer(bc.fake, idx, bc)) {
      const d0 = it.draw;
      it.draw = () => { ctx.save(); ctx.globalAlpha = 0.78; d0(); ctx.restore(); };
      it.x = bc.fake.x; items.push(it);
    }
  });
  items.push(...ballItems(), ...particleItems(), ...impactItems());
  const camLeft = cam.C.x < COURT.netX;
  const far = [], near = [];
  for (const it of items) ((it.x < COURT.netX) === camLeft ? near : far).push(it);
  far.sort((a, c) => c.d - a.d);
  near.sort((a, c) => c.d - a.d);
  for (const it of far) it.draw();
  drawNet();
  for (const it of near) it.draw();

  if (!inReplay) drawAimArc(me);
  drawMapDynamics('air');

  // --- Primer plano: pared cercana translúcida + viñeta ---
  setWorldTransform(S, sx, sy);
  ctx.drawImage(LAYERS[which].fg, 0, 0, VIEW_W, VIEW_H);
  setWorldTransform(S, sx, sy);
  drawRipples(['N']);
  return built;
}

export function render(now) {
  const { me, dt } = beginFrame(now, () => { LAYERS.main.key = LAYERS.replay.key = ''; }, updateAimFromMouse);
  const which = fx.replay ? 'replay' : 'main';
  if (LAYERS[which].key !== layerKey(which)) rebuildLayers(which);
  const saved = swapInReplay();
  let built;
  Object.assign(cam, CAMS[which]);
  try {
    built = drawWorld(dt, now, which, me);
  } finally {
    swapOutReplay(saved);
  }
  const S = renderScale;
  drawHud(me, built, S, () => ctx.setTransform(S, 0, 0, S, 0, 0));
}
