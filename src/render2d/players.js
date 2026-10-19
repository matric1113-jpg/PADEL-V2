import { BALL_R, LIGHTS, ZS } from '../core/constants.js';
import { LOOKS } from '../core/data.js';
import { createPlayer, state } from '../core/state.js';
import { actOn, upLvl } from '../core/stats.js';
import { clamp } from '../core/util.js';
import { P, cam, groundCircle, makeCam, pathPts } from '../view/camera.js';
import { ctx, setCtx } from '../view/ctx.js';
import { newPf } from '../view/fx.js';
import { PLAYER_SCALE, buildPlayerParts, lookOf, scaleOf } from '../view/skeleton.js';

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
const OUTLINE = 'rgba(4, 10, 20, 0.5)';

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * k, 0, 255) | 0;
  const g = clamp(((n >> 8) & 255) * k, 0, 255) | 0;
  const b = clamp((n & 255) * k, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
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
