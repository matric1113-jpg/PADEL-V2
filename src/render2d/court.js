import { COURT, GLASS_H, GLASS_STEP_H, LIGHTS, NET_H, VIEW_W, WALL_H_LOW, WALL_H_TALL, ZS } from '../core/constants.js';
import { state } from '../core/state.js';
import { clamp, pick } from '../core/util.js';
import { P, cam, pathPts } from '../view/camera.js';

// Estilo por mapa: césped, pasillo, piso exterior y luz ambiente
const MAP_STYLE = {
  chile:  { turf: [31, 88, 170], apron: [24, 64, 124], outer: 'floor', amb: 0.42, wear: 0.26 },
  brasil: { turf: [36, 98, 172], apron: [196, 174, 128], outer: 'sand', amb: 0.62, wear: 0.42 },
  china:  { turf: [30, 42, 66], apron: [56, 58, 66], outer: 'roof', amb: 0.4, wear: 0.18, border: [176, 28, 40] },
  altura: { turf: [30, 80, 146], apron: [62, 68, 74], outer: 'rock', amb: 0.5, wear: 0.2 },
  atlas:  { turf: [48, 104, 190], apron: [214, 206, 188], outer: 'sky', amb: 0.72, wear: 0.15 },
  crater: { turf: [34, 60, 112], apron: [42, 34, 32], outer: 'lava', amb: 0.4, wear: 0.22 }
};
const styleOf = () => MAP_STYLE[state.map] || MAP_STYLE.chile;
const BACK_Y = -175;     // plano del paisaje de fondo (justo detrás del público)
const BACK_ZK = 0.42;    // el paisaje se pinta "aplastado": cerros lejanos en una franja sobre la tribuna
// ---------- Ruido procedural para el césped ----------
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let tx = x - xi, ty = y - yi;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function makeGrid(x0, y0, x1, y1, step, fn) {
  const w = Math.ceil((x1 - x0) / step) + 1, h = Math.ceil((y1 - y0) / step) + 1;
  const data = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[j * w + i] = fn(x0 + i * step, y0 + j * step);
  return { x0, y0, step, w, h, data };
}
function sampleGrid(g, x, y) {
  let fx = (x - g.x0) / g.step, fy = (y - g.y0) / g.step;
  if (fx < 0) fx = 0; else if (fx > g.w - 1.001) fx = g.w - 1.001;
  if (fy < 0) fy = 0; else if (fy > g.h - 1.001) fy = g.h - 1.001;
  const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * g.w + ix, d = g.data;
  return (d[i] * (1 - tx) + d[i + 1] * tx) * (1 - ty) + (d[i + g.w] * (1 - tx) + d[i + g.w + 1] * tx) * ty;
}

// Luz de los 2 focos (caída suave); un foco roto deja su lado más oscuro
function lightField(x, y) {
  let E = 0;
  LIGHTS.forEach((L, i) => {
    if (!state.lights[i]) return;
    const dh = Math.hypot(x - L.x, y - L.y);
    E += 1 / (1 + (dh / 520) * (dh / 520));
  });
  return E;
}

let LUM_GRID = null, WEAR_GRID = null, gridKey = '';
function buildFieldGrids() {
  const key = state.map + '|' + state.lights.join(',');
  if (key !== gridKey) {
    gridKey = key;
    const amb = styleOf().amb;
    LUM_GRID = makeGrid(-900, -900, 1820, 1400, 10, (x, y) => Math.min(1.25, amb + (1.15 - amb) * lightField(x, y) / 1.6));
  }
  if (WEAR_GRID) return;
  const WEAR = [
    [112, 150, 62, 1], [112, 372, 62, 1], [808, 150, 62, 1], [808, 372, 62, 1],
    [150, 260, 70, 0.55], [770, 260, 70, 0.55],
    [405, 165, 45, 0.6], [405, 355, 45, 0.6], [515, 165, 45, 0.6], [515, 355, 45, 0.6]
  ];
  WEAR_GRID = makeGrid(40, 20, 880, 500, 4, (x, y) => {
    let w = 0;
    for (const [cx, cy, r, k] of WEAR) w += k * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
    const n = vnoise(x * 0.05, y * 0.05);
    return Math.min(1, w * (0.55 + 0.9 * n));
  });
}

function lineCov(d, fp, w) {
  const lo = Math.max(d - fp * 0.5, -w * 0.5), hi = Math.min(d + fp * 0.5, w * 0.5);
  return hi > lo ? (hi - lo) / Math.max(fp, 1e-3) : 0;
}

// Suelo renderizado píxel a píxel: rayo desde cada píxel al plano del suelo.
// Textura con corrección de perspectiva, antialias de líneas y luz de focos.
export function renderGround(lctx, W, H) {
  buildFieldGrids();
  const ST = styleOf();
  const S = W / VIEW_W;
  const img = lctx.createImageData(W, H);
  const data = img.data;
  const { f, r, u, C, F, cx, cy } = cam;
  const prevX = new Float32Array(W), prevY = new Float32Array(W);
  let havePrev = false;

  for (let py = 0; py < H; py++) {
    const ly = (py + 0.5) / S;
    const b = -(ly - cy) / F;
    const dz = f.z + b * u.z;
    let o = py * W * 4;
    if (dz > -1e-4) {
      for (let px = 0; px < W; px++, o += 4) { data[o] = 6; data[o + 1] = 12; data[o + 2] = 20; data[o + 3] = 255; }
      havePrev = false;
      continue;
    }
    const t = -C.z / dz;
    const kx = t * r.x / (F * S), ky = t * r.y / (F * S);
    const a0 = (0.5 / S - cx) / F;
    let X = C.x + t * (f.x + a0 * r.x + b * u.x);
    let Y = C.y + t * (f.y + a0 * r.y + b * u.y);

    for (let px = 0; px < W; px++, X += kx, Y += ky, o += 4) {
      let fx = Math.abs(kx), fy = Math.abs(ky);
      if (havePrev) { fx += Math.abs(X - prevX[px]); fy += Math.abs(Y - prevY[px]); }
      else { fx *= 2.2; fy *= 2.2; }
      prevX[px] = X; prevY[px] = Y;
      const fp = fx > fy ? fx : fy;

      let lum = sampleGrid(LUM_GRID, X, Y);
      let R, G, B;

      const inCourt = X >= 60 && X <= 860 && Y >= 40 && Y <= 480;
      if (inCourt) {
        // Césped sintético con arena
        R = ST.turf[0]; G = ST.turf[1]; B = ST.turf[2];
        const n1 = vnoise(X * 0.013, Y * 0.013) - 0.5;
        const n2 = vnoise(X * 0.07 + 31.7, Y * 0.07 + 17.3) - 0.5;
        let k = 1 + n1 * 0.08 + n2 * 0.05;
        // Rollos de césped (franjas sutiles de instalación)
        k *= ((Math.floor((Y - 40) / 110) & 1) ? 1.02 : 0.985);
        const gAmt = clamp(1.25 - fp * 0.9, 0, 1);
        if (gAmt > 0) {
          k *= 1 + (hash2(Math.floor(X * 1.7), Math.floor(Y * 1.7)) - 0.5) * 0.18 * gAmt;
        }
        R *= k; G *= k; B *= k;
        // Zonas gastadas: la arena aflora donde más se pisa
        const w = sampleGrid(WEAR_GRID, X, Y) * ST.wear;
        R = R + (150 - R) * w; G = G + (146 - G) * w; B = B + (138 - B) * w;
        if (gAmt > 0 && hash2(Math.floor(X * 2.3) + 7, Math.floor(Y * 2.3) + 3) > (state.map === 'brasil' ? 0.955 : 0.982)) {
          const sAmt = 0.4 * gAmt;
          R += (196 - R) * sAmt; G += (184 - G) * sAmt; B += (150 - B) * sAmt;
        }
        // Oclusión ambiental junto a las paredes
        const dw = Math.min(X - 60, 860 - X, Y - 40, 480 - Y);
        if (ST.border && dw < 7) { const c = 0.85; R += (ST.border[0] - R) * c; G += (ST.border[1] - G) * c; B += (ST.border[2] - B) * c; }
        lum *= 1 - 0.36 * Math.exp(-dw / 6);
        // Líneas reglamentarias (5 cm)
        let cov = Math.max(lineCov(X - COURT.serviceLeft, fx, 2), lineCov(X - COURT.serviceRight, fx, 2));
        if (X >= COURT.serviceLeft - 8 && X <= COURT.serviceRight + 8) cov = Math.max(cov, lineCov(Y - COURT.midY, fy, 2));
        if (cov > 0) {
          const c = cov * 0.94;
          R += (236 - R) * c; G += (240 - G) * c; B += (244 - B) * c;
        }
      } else {
        const dOut = Math.max(60 - X, X - 860, 40 - Y, Y - 480);
        const n = vnoise(X * 0.02, Y * 0.02) - 0.5;
        if (dOut < 70 && !(ST.outer === 'sand' && dOut > 20)) {
          // Pasillo alrededor de la cancha
          R = ST.apron[0]; G = ST.apron[1]; B = ST.apron[2];
          const k = 0.92 + n * 0.12;
          R *= k; G *= k; B *= k;
          lum *= 1 - 0.4 * Math.exp(-dOut / 4);
          if (ST.outer === 'sky' && dOut > 58) { R *= 0.7; G *= 0.7; B *= 0.7; }   // canto de la plataforma
        } else if (ST.outer === 'sky') {
          // Cielo bajo la plataforma de Atlas
          const c = vnoise(X * 0.004, Y * 0.006);
          const cloud = clamp((c - 0.45) * 3, 0, 1);
          R = 120 + cloud * 110; G = 150 + cloud * 95; B = 214 + cloud * 35;
          lum = 0.95;
        } else if (ST.outer === 'sand') {
          const k = 1 + n * 0.18 + (hash2(Math.floor(X * 1.3), Math.floor(Y * 1.3)) - 0.5) * 0.08;
          R = 204 * k; G = 178 * k; B = 128 * k;
          lum = Math.max(lum, 0.7) * (0.6 + 0.4 * Math.exp(-Math.max(0, dOut - 70) / 400));
        } else if (ST.outer === 'lava') {
          const v = vnoise(X * 0.012, Y * 0.012);
          const crack = Math.abs(v - 0.5);
          R = 40; G = 32; B = 30;
          if (crack < 0.035 && dOut > 75) {
            const g = 1 - crack / 0.035;
            R = 40 + 215 * g; G = 32 + 90 * g; B = 30 + 10 * g;
            lum = 1;
          } else lum *= 0.55 + 0.45 * Math.exp(-(dOut - 70) / 300);
        } else {
          // Piso del club / azotea / roca
          const k = 1 + n * 0.25;
          if (ST.outer === 'roof') {
            R = 46 * k; G = 48 * k; B = 56 * k;
            if ((Math.floor(X / 60) + Math.floor(Y / 60)) & 1) { R *= 1.06; G *= 1.06; B *= 1.06; }
          } else if (ST.outer === 'rock') { R = 70 * k; G = 74 * k; B = 80 * k; }
          else { R = 30 * k; G = 38 * k; B = 50 * k; }
          const fade = 0.25 + 0.75 * Math.exp(-(dOut - 70) / 260);
          lum *= fade;
          if (dOut < 74) lum *= 0.75;
        }
      }
      // Luz cálida de focos, sombra fría
      R = R * lum + (lum - 1) * 10;
      G = G * lum + (lum - 1) * 6;
      B = B * lum;
      data[o] = R < 0 ? 0 : (R > 255 ? 255 : R);
      data[o + 1] = G < 0 ? 0 : (G > 255 ? 255 : G);
      data[o + 2] = B < 0 ? 0 : (B > 255 ? 255 : B);
      data[o + 3] = 255;
    }
    havePrev = true;
  }
  lctx.putImageData(img, 0, 0);
}

// ---------- Paredes: cristal templado + malla metálica ----------
export const WALLS = {
  F: { kind: 'side', pt: (a, z) => ({ x: a, y: COURT.y, z }) },
  N: { kind: 'side', pt: (a, z) => ({ x: a, y: COURT.y + COURT.h, z }) },
  L: { kind: 'back', pt: (a, z) => ({ x: COURT.x, y: a, z }) },
  R: { kind: 'back', pt: (a, z) => ({ x: COURT.x + COURT.w, y: a, z }) }
};

function wallPanels(kind) {
  if (kind === 'back') {
    const out = [];
    for (let i = 0; i < 5; i++) out.push({ a0: 40 + i * 88, a1: 40 + (i + 1) * 88, glass: GLASS_H, top: WALL_H_TALL });
    return out;
  }
  const g = COURT.glassLength / 2;
  const out = [
    { a0: 60, a1: 60 + g, glass: GLASS_H, top: WALL_H_TALL },
    { a0: 60 + g, a1: 60 + 2 * g, glass: GLASS_STEP_H, top: WALL_H_LOW }
  ];
  const m0 = 60 + 2 * g, m1 = 860 - 2 * g;
  for (let i = 0; i < 6; i++) out.push({ a0: m0 + (m1 - m0) * i / 6, a1: m0 + (m1 - m0) * (i + 1) / 6, glass: 0, top: WALL_H_LOW });
  out.push({ a0: 860 - 2 * g, a1: 860 - g, glass: GLASS_STEP_H, top: WALL_H_LOW });
  out.push({ a0: 860 - g, a1: 860, glass: GLASS_H, top: WALL_H_TALL });
  return out;
}

const DOOR = [438, 482], DOOR_H = 84;   // vano de la puerta al centro de la malla lateral

export function drawWall(c, key, alpha) {
  const wall = WALLS[key];
  const panels = wallPanels(wall.kind);
  const pt = (a, z) => { const q = wall.pt(a, z); return P(q.x, q.y, q.z); };

  for (const pn of panels) {
    // Cristal
    if (pn.glass > 0) {
      const q = [pt(pn.a0, 0), pt(pn.a1, 0), pt(pn.a1, pn.glass), pt(pn.a0, pn.glass)];
      pathPts(c, q);
      c.fillStyle = `rgba(150, 205, 255, ${0.07 * alpha})`;
      c.fill();
      const gr = c.createLinearGradient(q[0].x, q[0].y, q[2].x, q[2].y);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.38, 'rgba(255,255,255,0)');
      gr.addColorStop(0.46, `rgba(225,240,255,${0.12 * alpha})`);
      gr.addColorStop(0.52, 'rgba(255,255,255,0)');
      gr.addColorStop(0.63, `rgba(225,240,255,${0.06 * alpha})`);
      gr.addColorStop(0.68, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr;
      c.fill();
      // Canto superior del vidrio
      c.strokeStyle = `rgba(210, 236, 255, ${0.55 * alpha})`;
      c.lineWidth = Math.max(0.8, 1.2 * q[3].s);
      c.beginPath(); c.moveTo(q[3].x, q[3].y); c.lineTo(q[2].x, q[2].y); c.stroke();
      // Junta inferior con el césped
      c.strokeStyle = `rgba(0, 0, 0, ${0.45 * alpha})`;
      c.lineWidth = Math.max(0.8, 1.5 * q[0].s);
      c.beginPath(); c.moveTo(q[0].x, q[0].y); c.lineTo(q[1].x, q[1].y); c.stroke();
    }
    // Malla
    if (pn.top > pn.glass) {
      const z0 = pn.glass, z1 = pn.top;
      const q = [pt(pn.a0, z0), pt(pn.a1, z0), pt(pn.a1, z1), pt(pn.a0, z1)];
      pathPts(c, q);
      c.fillStyle = `rgba(14, 22, 32, ${0.16 * alpha})`;
      c.fill();
      c.strokeStyle = `rgba(150, 168, 188, ${0.2 * alpha})`;
      c.lineWidth = 0.7;
      c.beginPath();
      const step = 8;
      const isSide = wall.kind === 'side';
      const inDoor = a => isSide && a > DOOR[0] && a < DOOR[1];
      for (let a = pn.a0 + step; a < pn.a1 - 1; a += step) {
        const zs = inDoor(a) ? Math.max(z0, DOOR_H) : z0;
        if (zs >= z1) continue;
        const p0 = pt(a, zs), p1 = pt(a, z1);
        c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y);
      }
      for (let z = z0 + step; z < z1 - 1; z += step) {
        if (isSide && z < DOOR_H && pn.a0 < DOOR[1] && pn.a1 > DOOR[0]) {
          // la malla se corta en el vano de la puerta
          const segs = [[pn.a0, Math.max(pn.a0, Math.min(pn.a1, DOOR[0]))], [Math.min(pn.a1, Math.max(pn.a0, DOOR[1])), pn.a1]];
          for (const [a0, a1] of segs) if (a1 - a0 > 1) { const p0 = pt(a0, z), p1 = pt(a1, z); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); }
        } else {
          const p0 = pt(pn.a0, z), p1 = pt(pn.a1, z);
          c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y);
        }
      }
      c.stroke();
      // Marco de la malla
      c.strokeStyle = `rgba(22, 28, 36, ${0.9 * alpha})`;
      c.lineWidth = Math.max(1, 2.2 * q[3].s);
      c.beginPath();
      c.moveTo(q[0].x, q[0].y); c.lineTo(q[1].x, q[1].y);
      c.moveTo(q[3].x, q[3].y); c.lineTo(q[2].x, q[2].y);
      c.stroke();
    }
  }

  // Marco de la puerta lateral
  if (wall.kind === 'side') {
    const d0 = pt(DOOR[0], 0), d1 = pt(DOOR[0], DOOR_H), d2 = pt(DOOR[1], DOOR_H), d3 = pt(DOOR[1], 0);
    c.strokeStyle = `rgba(22, 28, 36, ${0.95 * alpha})`;
    c.lineWidth = Math.max(1.2, 2.6 * d1.s);
    c.beginPath(); c.moveTo(d0.x, d0.y); c.lineTo(d1.x, d1.y); c.lineTo(d2.x, d2.y); c.lineTo(d3.x, d3.y); c.stroke();
  }

  // Postes de acero en cada junta
  const posts = new Map();
  for (const pn of panels) {
    posts.set(pn.a0, Math.max(posts.get(pn.a0) || 0, pn.top));
    posts.set(pn.a1, Math.max(posts.get(pn.a1) || 0, pn.top));
  }
  for (const [a, h] of posts) {
    const b0 = pt(a, 0), b1 = pt(a, h);
    const w = Math.max(1.2, 3.2 * (b0.s + b1.s) / 2);
    c.lineCap = 'butt';
    c.strokeStyle = `rgba(20, 26, 34, ${0.95 * alpha})`;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(b0.x, b0.y); c.lineTo(b1.x, b1.y); c.stroke();
    c.strokeStyle = `rgba(190, 210, 230, ${0.18 * alpha})`;
    c.lineWidth = Math.max(0.6, w * 0.3);
    c.beginPath(); c.moveTo(b0.x - w * 0.25, b0.y); c.lineTo(b1.x - w * 0.25, b1.y); c.stroke();
  }
}

export function drawNetShadows(c) {
  const hc = NET_H * ZS;
  for (const L of LIGHTS.filter((L, i) => state.lights[i])) {
    const k = L.z / (L.z - hc);
    const pts = [];
    for (let y = COURT.y; y <= COURT.y + COURT.h; y += 20) pts.push(P(COURT.netX, y, 0));
    for (let y = COURT.y + COURT.h; y >= COURT.y; y -= 20) {
      const sx = L.x + (COURT.netX - L.x) * k, sy = clamp(L.y + (y - L.y) * k, COURT.y, COURT.y + COURT.h);
      pts.push(P(sx, sy, 0));
    }
    pathPts(c, pts);
    c.fillStyle = 'rgba(2, 10, 26, 0.12)';
    c.fill();
  }
}

export function drawLightFixture(c, i, alpha) {
  const L = LIGHTS[i];
  const on = state.lights[i];
  const outY = i === 0 ? L.y - 22 : L.y + 22;
  const base = P(L.x, outY, 0), top = P(L.x, outY, L.z + 10), arm = P(L.x, L.y, L.z + 10);
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = '#141b24';
  c.lineCap = 'butt';
  c.lineWidth = Math.max(1.5, 4 * top.s);
  c.beginPath(); c.moveTo(base.x, base.y); c.lineTo(top.x, top.y); c.lineTo(arm.x, arm.y); c.stroke();
  const q = [P(L.x - 16, L.y - 6, L.z + 4), P(L.x + 16, L.y - 6, L.z + 4), P(L.x + 16, L.y + 6, L.z + 4), P(L.x - 16, L.y + 6, L.z + 4)];
  pathPts(c, q);
  c.fillStyle = '#1b232d';
  c.fill();
  const face = [P(L.x - 13, L.y - 4, L.z), P(L.x + 13, L.y - 4, L.z), P(L.x + 13, L.y + 4, L.z), P(L.x - 13, L.y + 4, L.z)];
  pathPts(c, face);
  c.fillStyle = on ? '#fff8df' : '#2a2f36';
  c.fill();
  if (!on) {
    c.strokeStyle = 'rgba(200, 210, 220, 0.6)';
    c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(face[0].x, face[0].y); c.lineTo(face[2].x, face[2].y); c.moveTo(face[1].x, face[1].y); c.lineTo(face[3].x, face[3].y); c.stroke();
  } else {
    const mid = P(L.x, L.y, L.z);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, 100);
    g.addColorStop(0, 'rgba(255, 244, 210, 0.55)');
    g.addColorStop(0.25, 'rgba(255, 236, 190, 0.16)');
    g.addColorStop(1, 'rgba(255, 236, 190, 0)');
    c.fillStyle = g;
    c.fillRect(mid.x - 100, mid.y - 100, 200, 200);
    const g1 = P(L.x - 260, i === 0 ? L.y + 260 : L.y - 260, 0), g2 = P(L.x + 260, i === 0 ? L.y + 260 : L.y - 260, 0);
    const beam = c.createLinearGradient(mid.x, mid.y, (g1.x + g2.x) / 2, (g1.y + g2.y) / 2);
    beam.addColorStop(0, 'rgba(255, 240, 205, 0.06)');
    beam.addColorStop(1, 'rgba(255, 240, 205, 0)');
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(mid.x - 5, mid.y); c.lineTo(g1.x, g1.y); c.lineTo(g2.x, g2.y); c.lineTo(mid.x + 5, mid.y); c.closePath();
    c.fill();
  }
  c.restore();
}

// Paisaje pintado en un plano vertical detrás de la cancha
export function BP(x, z) { return P(x, BACK_Y, z * BACK_ZK); }
function planePoly(c, pts, fill) {
  c.beginPath();
  pts.forEach(([x, z], k) => { const q = BP(x, z); if (k) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); });
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function drawBackdrop(c) {
  const id = state.map;
  const X0 = -1600, X1 = 2600;
  // Altura máxima del plano que sigue delante de la cámara (si no, la proyección se da vuelta)
  let Z1 = 3200;
  while (Z1 > 200 && Math.min(BP(X0, Z1).d, BP(X1, Z1).d, BP(460, Z1).d) < 60) Z1 -= 50;
  const SKY = {
    chile: ['#16284a', '#e8935a'], brasil: ['#3a8fd0', '#ffd59a'], china: ['#0b1030', '#3b1530'],
    altura: ['#55657a', '#aab8c6'], atlas: ['#25407f', '#f3d79a'], crater: ['#120606', '#6a1a0a']
  }[id] || ['#0a1626', '#0a1626'];
  const top = BP(460, Math.min(Z1, 1100)), bot = BP(460, 0);
  const g = c.createLinearGradient(top.x, top.y, bot.x, bot.y);
  g.addColorStop(0, SKY[0]); g.addColorStop(1, SKY[1]);
  planePoly(c, [[X0, 0], [X1, 0], [X1, Z1], [X0, Z1]], g);
  const rnd = seeded(id.length * 977 + 13);

  if (id === 'chile' || id === 'altura') {
    // Cordillera nevada en dos capas: primero el cerro, después la nieve en cada cumbre
    for (const [col, hMin, hMax, snow] of [['#4b5a7a', 380, 760, '#f3f5f9'], ['#2c3954', 220, 460, 'rgba(236, 240, 247, 0.92)']]) {
      const peaks = [];
      const pts = [[X0, 0]];
      let x = X0;
      while (x < X1) {
        const h = hMin + rnd() * (hMax - hMin), w = 120 + rnd() * 160;
        const valley = hMin * 0.55 + rnd() * 60;
        pts.push([x + w * 0.5, h]); pts.push([x + w, valley]);
        peaks.push([x + w * 0.5, h, w]);
        x += w;
      }
      pts.push([X1, 0]);
      planePoly(c, pts, col);
      for (const [px, h, w] of peaks) planePoly(c, [[px - w * 0.16, h * 0.74], [px, h], [px + w * 0.16, h * 0.74], [px + w * 0.05, h * 0.8], [px - w * 0.06, h * 0.78]], snow);
    }
    if (id === 'altura') {
      for (let k = 0; k < 14; k++) planePoly(c, ellipsePts(X0 + rnd() * (X1 - X0), 40 + rnd() * 80, 260 + rnd() * 200, 40 + rnd() * 30), 'rgba(225, 232, 240, 0.55)');
    }
  } else if (id === 'brasil') {
    const sun = BP(1500, 300);
    const sg = c.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 70);
    sg.addColorStop(0, 'rgba(255, 245, 210, 1)'); sg.addColorStop(0.4, 'rgba(255, 220, 150, 0.8)'); sg.addColorStop(1, 'rgba(255, 210, 140, 0)');
    c.fillStyle = sg; c.fillRect(sun.x - 70, sun.y - 70, 140, 140);
    const st = BP(460, 140), sb = BP(460, 0);
    const sea = c.createLinearGradient(st.x, st.y, sb.x, sb.y);
    sea.addColorStop(0, '#1f7fa0'); sea.addColorStop(1, '#45c3cf');
    planePoly(c, [[X0, 0], [X1, 0], [X1, 140], [X0, 140]], sea);
    for (let k = 0; k < 40; k++) { const x = X0 + rnd() * (X1 - X0), z = 10 + rnd() * 120; planePoly(c, [[x, z], [x + 60, z], [x + 60, z + 3], [x, z + 3]], 'rgba(255,255,255,0.35)'); }
  } else if (id === 'china') {
    for (let k = 0; k < 60; k++) {
      const x = X0 + (k / 60) * (X1 - X0) + rnd() * 30, w = 50 + rnd() * 70, h = 160 + rnd() * 520;
      planePoly(c, [[x, 0], [x + w, 0], [x + w, h], [x, h]], k % 3 ? '#151b36' : '#1b2244');
      for (let wy = 30; wy < h - 20; wy += 28) for (let wx = x + 10; wx < x + w - 10; wx += 16) {
        if (rnd() < 0.35) planePoly(c, [[wx, wy], [wx + 7, wy], [wx + 7, wy + 10], [wx, wy + 10]], rnd() < 0.7 ? '#ffd27a' : '#9fd3ff');
      }
    }
    // Pagoda
    for (let t = 0; t < 5; t++) {
      const z = t * 110, w = 230 - t * 34;
      planePoly(c, [[-80 - w / 2, z], [-80 + w / 2, z], [-80 + w / 2 - 18, z + 80], [-80 - w / 2 + 18, z + 80]], '#3a1520');
      planePoly(c, [[-80 - w / 2 - 40, z + 80], [-80 + w / 2 + 40, z + 80], [-80 + w / 2 - 10, z + 108], [-80 - w / 2 + 10, z + 108]], '#7a1e2a');
    }
    // Torre con esferas
    planePoly(c, [[1185, 0], [1215, 0], [1205, 1100], [1195, 1100]], '#2a2448');
    planePoly(c, ellipsePts(1200, 420, 95, 95), '#c8457a');
    planePoly(c, ellipsePts(1200, 780, 60, 60), '#d85a8a');
  } else if (id === 'atlas') {
    for (let k = 0; k < 18; k++) planePoly(c, ellipsePts(X0 + rnd() * (X1 - X0), 80 + rnd() * 900, 180 + rnd() * 220, 50 + rnd() * 50), 'rgba(255, 255, 255, 0.55)');
    // El titán Atlas sostiene la cancha sobre sus hombros
    const bronze = '#9a6b3e', dark = '#6e4626';
    planePoly(c, [[-500, 0], [1420, 0], [1250, 420], [-330, 420]], dark);                   // hombros
    planePoly(c, [[-560, 0], [-330, 420], [-420, 780], [-640, 420]], bronze);              // brazo izquierdo alzado
    planePoly(c, [[1480, 0], [1250, 420], [1340, 780], [1560, 420]], bronze);              // brazo derecho alzado
    planePoly(c, ellipsePts(460, 700, 260, 560), bronze);                                  // cabeza
    planePoly(c, [[230, 560], [690, 560], [610, 200], [310, 200]], '#e9e3d6');             // barba
    planePoly(c, [[330, 800], [420, 780], [420, 765], [330, 780]], dark);                  // ojos cerrados
    planePoly(c, [[500, 780], [590, 800], [590, 780], [500, 765]], dark);
  } else if (id === 'crater') {
    planePoly(c, [[-1200, 0], [-300, 700], [-60, 760], [160, 690], [900, 0]], '#1c0e0a');   // volcán
    const cr = BP(-60, 740);
    const cg = c.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, 90);
    cg.addColorStop(0, 'rgba(255, 170, 60, 0.95)'); cg.addColorStop(1, 'rgba(255, 80, 20, 0)');
    c.fillStyle = cg; c.fillRect(cr.x - 90, cr.y - 90, 180, 180);
    for (const [x0, x1] of [[-120, -500], [0, 380], [-60, 120]]) planePoly(c, [[x0, 720], [x0 + 18, 720], [x1 + 30, 0], [x1, 0]], 'rgba(255, 110, 30, 0.85)');
    for (let k = 0; k < 10; k++) planePoly(c, ellipsePts(-60 + (rnd() - 0.5) * 900, 900 + rnd() * 900, 160 + rnd() * 160, 70 + rnd() * 50), 'rgba(40, 20, 18, 0.7)');
  }
}

function ellipsePts(cx, cz, rx, rz) {
  const out = [];
  for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; out.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); }
  return out;
}

// Público simple alrededor de la cancha
const CROWD_STYLE = {
  chile: () => pick([['#d52b1e', '#ffffff'], ['#c8102e', '#111111'], ['#1f3f99', '#d52b1e'], ['#f4f4f4', '#111111']]),
  brasil: () => pick([['#ffdf00', '#1fa34a'], ['#1fa34a', '#ffdf00'], ['#2b6fd6', '#ffffff'], ['#ffffff', '#1fa34a']]),
  china: () => pick([['#c8102e', '#ffcc33'], ['#ffcc33', '#c8102e'], ['#222222', '#c8102e'], ['#f4f4f4', '#c8102e']]),
  altura: () => pick([['#f4b400', '#333333'], ['#e53935', '#333333'], ['#1e88e5', '#ffffff'], ['#43a047', '#ffffff']]),
  atlas: () => ['#f6f2e8', '#ffd54a'],
  crater: () => (Math.random() < 0.5 ? ['bone', '#e8e2d0'] : ['devil', '#c62828'])
};
const SKINS_CROWD = ['#e9c09b', '#c9935f', '#8a5a3c', '#f2d2b6', '#b07a52'];

export function drawCrowd(c) {
  const style = CROWD_STYLE[state.map] || CROWD_STYLE.chile;
  const seats = [];
  for (let row = 0; row < 3; row++) {
    const y = -36 - row * 38;
    for (let x = 64; x < 860; x += 24) seats.push({ x: x + (row % 2) * 12, y, z: row * 14 });
  }
  for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
    const x = side < 0 ? 22 - row * 34 : 898 + row * 34;
    for (let y = 70; y < 460; y += 28) seats.push({ x, y: y + (row % 2) * 14, z: row * 14 });
  }
  // Gradas
  c.fillStyle = 'rgba(60, 66, 76, 0.85)';
  for (let row = 0; row < 3; row++) {
    const y = -36 - row * 38, z = row * 14;
    pathPts(c, [P(56, y - 14, z), P(872, y - 14, z), P(872, y + 14, z), P(56, y + 14, z)]);
    c.fill();
  }
  const rnd = seeded(4242);
  const old = Math.random;
  Math.random = rnd;           // público siempre igual en cada reconstrucción
  try {
    seats.map(s => ({ ...s, d: P(s.x, s.y, 30).d })).sort((a, b) => b.d - a.d).forEach(s => {
      if (rnd() < 0.18) return;     // asientos vacíos
      const [shirt, accent] = style();
      const body = P(s.x, s.y, s.z + 20), head = P(s.x, s.y, s.z + 38);
      const k = body.s;
      if (state.map === 'atlas') {
        // ángeles: alas y aureola
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath(); c.moveTo(body.x, body.y - 4 * k); c.lineTo(body.x - 16 * k, body.y - 14 * k); c.lineTo(body.x - 6 * k, body.y + 4 * k); c.fill();
        c.beginPath(); c.moveTo(body.x, body.y - 4 * k); c.lineTo(body.x + 16 * k, body.y - 14 * k); c.lineTo(body.x + 6 * k, body.y + 4 * k); c.fill();
      }
      if (state.map === 'brasil' && rnd() < 0.2) {
        const um = P(s.x, s.y, s.z + 62);
        c.fillStyle = pick(['#ff5252', '#ffd740', '#40c4ff', '#69f0ae']);
        c.beginPath(); c.ellipse(um.x, um.y, 16 * k, 6 * k, 0, Math.PI, 0); c.fill();
      }
      const bone = shirt === 'bone', devil = shirt === 'devil';
      c.fillStyle = bone ? '#e8e2d0' : devil ? '#b71c1c' : shirt;
      c.beginPath(); c.ellipse(body.x, body.y, 7.5 * k * (bone ? 0.75 : 1), 10 * k, 0, 0, Math.PI * 2); c.fill();
      if (!bone && !devil) {
        c.fillStyle = accent;
        c.fillRect(body.x - 7 * k, body.y - 2 * k, 14 * k, 2.4 * k);
      } else if (bone) {
        c.strokeStyle = '#6d665a'; c.lineWidth = 0.7;
        c.beginPath(); for (let r = -1; r <= 1; r++) { c.moveTo(body.x - 4 * k, body.y + r * 3 * k); c.lineTo(body.x + 4 * k, body.y + r * 3 * k); } c.stroke();
      }
      c.fillStyle = bone ? '#efe9da' : devil ? '#d32f2f' : pick(SKINS_CROWD);
      c.beginPath(); c.arc(head.x, head.y, 5.4 * k, 0, Math.PI * 2); c.fill();
      if (bone) { c.fillStyle = '#222'; c.fillRect(head.x - 2.6 * k, head.y - 1 * k, 1.6 * k, 1.6 * k); c.fillRect(head.x + 1 * k, head.y - 1 * k, 1.6 * k, 1.6 * k); }
      if (devil) {
        c.fillStyle = '#ffcc80';
        c.beginPath(); c.moveTo(head.x - 4 * k, head.y - 3 * k); c.lineTo(head.x - 3 * k, head.y - 9 * k); c.lineTo(head.x - 1.5 * k, head.y - 4 * k); c.fill();
        c.beginPath(); c.moveTo(head.x + 4 * k, head.y - 3 * k); c.lineTo(head.x + 3 * k, head.y - 9 * k); c.lineTo(head.x + 1.5 * k, head.y - 4 * k); c.fill();
      }
      if (state.map === 'atlas') {
        c.strokeStyle = '#ffd54a'; c.lineWidth = Math.max(0.8, 1.4 * k);
        c.beginPath(); c.ellipse(head.x, head.y - 8 * k, 5 * k, 1.8 * k, 0, 0, Math.PI * 2); c.stroke();
      }
    });
  } finally {
    Math.random = old;
  }
}

// Utilería de cada mapa (palmeras, faroles, banderines, rocas)
export function drawProps(c) {
  const id = state.map;
  if (id === 'brasil') {
    for (const [x, y] of [[-40, -70], [960, -50], [-90, 230], [1010, 330], [300, -200], [700, -190]]) drawPalm(c, x, y);
    // Banderines verde-amarillos sobre el fondo
    for (let x = 60; x < 860; x += 20) {
      const a = P(x, 40, 164), b = P(x + 20, 40, 164), m = P(x + 10, 40, 150);
      c.fillStyle = (x / 20) % 2 ? '#1fa34a' : '#ffdf00';
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(m.x, m.y); c.fill();
    }
  } else if (id === 'china') {
    // Farolillos rojos colgando afuera
    const y = -12;
    c.strokeStyle = 'rgba(30, 20, 20, 0.8)'; c.lineWidth = 1;
    c.beginPath(); for (let x = 40; x <= 880; x += 20) { const q = P(x, y, 205 - Math.sin((x - 40) / 840 * Math.PI) * 18); if (x === 40) c.moveTo(q.x, q.y); else c.lineTo(q.x, q.y); } c.stroke();
    for (let x = 80; x < 860; x += 70) {
      const q = P(x, y, 190 - Math.sin((x - 40) / 840 * Math.PI) * 18);
      const r = 8 * q.s;
      const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3);
      g.addColorStop(0, 'rgba(255, 120, 80, 0.5)'); g.addColorStop(1, 'rgba(255, 60, 40, 0)');
      c.fillStyle = g; c.fillRect(q.x - r * 3, q.y - r * 3, r * 6, r * 6);
      c.fillStyle = '#d71f2a'; c.beginPath(); c.ellipse(q.x, q.y, r, r * 1.2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffcc33'; c.fillRect(q.x - r * 0.5, q.y - r * 1.35, r, r * 0.3); c.fillRect(q.x - r * 0.5, q.y + r * 1.05, r, r * 0.3);
    }
  } else if (id === 'crater') {
    for (const [x, y, s] of [[-60, -60, 1.2], [990, -40, 1], [-70, 520, 0.9], [990, 560, 1.1], [420, -210, 1.4]]) {
      const pts = [];
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; pts.push(P(x + Math.cos(a) * 40 * s, y + Math.sin(a) * 26 * s, 0)); }
      pts.push(P(x, y, 70 * s));
      c.fillStyle = '#231512';
      pathPts(c, [pts[0], pts[1], pts[2], pts[7], pts[5], pts[6]]); c.fill();
    }
  }
}

function drawPalm(c, x, y) {
  const base = P(x, y, 0);
  const pts = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(P(x + Math.sin(t * 1.4) * 30, y, t * 230)); }
  c.strokeStyle = '#7a5a36'; c.lineCap = 'round';
  c.lineWidth = Math.max(2, 7 * base.s);
  pathPts(c, pts, false); c.stroke();
  const top = pts[pts.length - 1];
  c.fillStyle = '#2e7d32';
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2;
    const tip = P(x + Math.sin(1.4) * 30 + Math.cos(a) * 80, y + Math.sin(a) * 60, 200);
    const mid = P(x + Math.sin(1.4) * 30 + Math.cos(a) * 40, y + Math.sin(a) * 30, 240);
    c.beginPath(); c.moveTo(top.x, top.y); c.quadraticCurveTo(mid.x, mid.y - 6, tip.x, tip.y); c.quadraticCurveTo(mid.x, mid.y + 4, top.x, top.y); c.fill();
  }
}

