import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace
} from 'three';
import { COURT, GLASS_H, GLASS_STEP_H, NET_H, WALL_H_LOW, WALL_H_TALL, ZS } from '../core/constants.js';
import { state } from '../core/state.js';
import { clamp } from '../core/util.js';
import { fx } from '../view/fx.js';
import { hash2, makeGrid, sampleGrid, vnoise } from './noise.js';
import { styleOf } from './style.js';

// ---------- Cancha: césped, alrededores, paredes de cristal y malla, puerta y red ----------
// Unidades: 1 = 1 px de mundo (40 = 1 m). En Three.js (x, altura, y).
const X0 = COURT.x, X1 = COURT.x + COURT.w, Y0 = COURT.y, Y1 = COURT.y + COURT.h;
const DOOR = [438, 482], DOOR_H = 84;   // vano de la puerta al centro de cada lateral (solo estética)
const APRON = 70;                       // pasillo alrededor de la cancha

let maxAniso = 8;
function canvasTex(cv, srgb = true) {
  const t = new CanvasTexture(cv);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

// ---------- Suelo ----------
const TURF_PX = 2;   // píxeles de textura por unidad de mundo
let WEAR_GRID = null;
function wearAt(x, y) {
  if (!WEAR_GRID) {
    // Donde más se pisa: fondo de cada lado, posición de saque y junto a la red
    const WEAR = [
      [112, 150, 62, 1], [112, 372, 62, 1], [808, 150, 62, 1], [808, 372, 62, 1],
      [150, 260, 70, 0.55], [770, 260, 70, 0.55],
      [405, 165, 45, 0.6], [405, 355, 45, 0.6], [515, 165, 45, 0.6], [515, 355, 45, 0.6]
    ];
    WEAR_GRID = makeGrid(40, 20, 880, 500, 4, (x, y) => {
      let w = 0;
      for (const [cx, cy, r, k] of WEAR) w += k * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
      return Math.min(1, w * (0.55 + 0.9 * vnoise(x * 0.05, y * 0.05)));
    });
  }
  return sampleGrid(WEAR_GRID, x, y);
}

// Línea de 5 cm (2 unidades) con antialias: cobertura del píxel
const lineCov = d => clamp(1 + TURF_PX * (1 - Math.abs(d)), 0, 1);

// Césped sintético con arena, zonas gastadas, rollos de instalación y líneas reglamentarias
function turfCanvas(ST, mapId) {
  const W = COURT.w * TURF_PX, H = COURT.h * TURF_PX;
  const cv = makeCanvas(W, H);
  const c = cv.getContext('2d');
  const img = c.createImageData(W, H), d = img.data;
  const sandCut = mapId === 'brasil' ? 0.955 : 0.982;
  for (let py = 0, o = 0; py < H; py++) {
    const Y = Y0 + (py + 0.5) / TURF_PX;
    for (let px = 0; px < W; px++, o += 4) {
      const X = X0 + (px + 0.5) / TURF_PX;
      let R = ST.turf[0], G = ST.turf[1], B = ST.turf[2];
      const n1 = vnoise(X * 0.013, Y * 0.013) - 0.5;
      const n2 = vnoise(X * 0.07 + 31.7, Y * 0.07 + 17.3) - 0.5;
      let k = 1 + n1 * 0.08 + n2 * 0.05;
      k *= (Math.floor((Y - 40) / 110) & 1) ? 1.02 : 0.985;
      k *= 1 + (hash2(Math.floor(X * 1.7), Math.floor(Y * 1.7)) - 0.5) * 0.18;
      R *= k; G *= k; B *= k;
      const w = wearAt(X, Y) * ST.wear;
      R += (150 - R) * w; G += (146 - G) * w; B += (138 - B) * w;
      if (hash2(Math.floor(X * 2.3) + 7, Math.floor(Y * 2.3) + 3) > sandCut) {
        R += (196 - R) * 0.4; G += (184 - G) * 0.4; B += (150 - B) * 0.4;
      }
      const dw = Math.min(X - X0, X1 - X, Y - Y0, Y1 - Y);
      if (ST.border && dw < 7) { R += (ST.border[0] - R) * 0.85; G += (ST.border[1] - G) * 0.85; B += (ST.border[2] - B) * 0.85; }
      const ao = 1 - 0.3 * Math.exp(-dw / 6);
      R *= ao; G *= ao; B *= ao;
      let cov = Math.max(lineCov(X - COURT.serviceLeft), lineCov(X - COURT.serviceRight));
      if (X >= COURT.serviceLeft - 1 && X <= COURT.serviceRight + 1) cov = Math.max(cov, lineCov(Y - COURT.midY));
      if (cov > 0) { const t = cov * 0.94; R += (236 - R) * t; G += (240 - G) * t; B += (244 - B) * t; }
      d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// Alrededores: pasillo y piso exterior de cada mapa (club, arena, azotea, roca, lava)
const OUT = { x0: -1140, y0: -940, w: 3200, h: 2400, px: 0.5 };
function outerCanvas(ST) {
  const W = OUT.w * OUT.px, H = OUT.h * OUT.px;
  const cv = makeCanvas(W, H), glow = ST.outer === 'lava' ? makeCanvas(W, H) : null;
  const img = cv.getContext('2d').createImageData(W, H), d = img.data;
  const gimg = glow ? glow.getContext('2d').createImageData(W, H) : null;
  for (let py = 0, o = 0; py < H; py++) {
    const Y = OUT.y0 + (py + 0.5) / OUT.px;
    for (let px = 0; px < W; px++, o += 4) {
      const X = OUT.x0 + (px + 0.5) / OUT.px;
      const dOut = Math.max(X0 - X, X - X1, Y0 - Y, Y - Y1);
      const n = vnoise(X * 0.02, Y * 0.02) - 0.5;
      let R, G, B, lum = 1;
      if (dOut < APRON && !(ST.outer === 'sand' && dOut > 20)) {
        R = ST.apron[0]; G = ST.apron[1]; B = ST.apron[2];
        const k = 0.92 + n * 0.12;
        R *= k; G *= k; B *= k;
        lum = 1 - 0.4 * Math.exp(-Math.max(0, dOut) / 4);
      } else if (ST.outer === 'sand') {
        const k = 1 + n * 0.18 + (hash2(Math.floor(X * 1.3), Math.floor(Y * 1.3)) - 0.5) * 0.08;
        R = 204 * k; G = 178 * k; B = 128 * k;
      } else if (ST.outer === 'lava') {
        const crack = Math.abs(vnoise(X * 0.012, Y * 0.012) - 0.5);
        R = 40; G = 32; B = 30;
        if (crack < 0.035 && dOut > 75) {
          const g = 1 - crack / 0.035;
          gimg.data[o] = 255 * g; gimg.data[o + 1] = 110 * g; gimg.data[o + 2] = 20 * g;
        }
        lum = 0.6 + 0.4 * Math.exp(-(dOut - APRON) / 300);
      } else {
        const k = 1 + n * 0.25;
        if (ST.outer === 'roof') {
          R = 46 * k; G = 48 * k; B = 56 * k;
          if ((Math.floor(X / 60) + Math.floor(Y / 60)) & 1) { R *= 1.06; G *= 1.06; B *= 1.06; }
        } else if (ST.outer === 'rock') { R = 70 * k; G = 74 * k; B = 80 * k; }
        else { R = 30 * k; G = 38 * k; B = 50 * k; }
        lum = (0.45 + 0.55 * Math.exp(-(dOut - APRON) / 300)) * (dOut < APRON + 4 ? 0.75 : 1);
      }
      d[o] = R * lum; d[o + 1] = G * lum; d[o + 2] = B * lum; d[o + 3] = 255;
      if (gimg) gimg.data[o + 3] = 255;
    }
  }
  cv.getContext('2d').putImageData(img, 0, 0);
  if (glow) glow.getContext('2d').putImageData(gimg, 0, 0);
  return { cv, glow };
}

// Brillos diagonales del cristal (como los del 2D); se suman al reflejo real del entorno
function streakTexture() {
  const cv = makeCanvas(256, 256), c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 256, 256, 0);
  for (const [t, a] of [[0, 0], [0.38, 0], [0.46, 0.5], [0.52, 0], [0.63, 0.25], [0.68, 0], [1, 0]]) g.addColorStop(t, `rgba(225, 240, 255, ${a})`);
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  return canvasTex(cv);
}

// ---------- Texturas de alambre (malla de las paredes y paño de la red) ----------
function wireTexture(size, line) {
  const cv = makeCanvas(size, size);
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, size, size);
  c.fillStyle = '#fff';
  c.fillRect(0, 0, line, size);
  c.fillRect(0, 0, size, line);
  const t = canvasTex(cv, false);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

// Plano vertical sobre una pared. Con cell, UV en unidades de mundo / cell (el patrón queda continuo)
function wallPlane(key, a0, a1, z0, z1, mat, cell) {
  const geo = new PlaneGeometry(a1 - a0, z1 - z0);
  const uv = geo.attributes.uv;
  if (cell) for (let i = 0; i < uv.count; i++) uv.setXY(i, (a0 + uv.getX(i) * (a1 - a0)) / cell, (z0 + uv.getY(i) * (z1 - z0)) / cell);
  const m = new Mesh(geo, mat);
  placeOnWall(m, key, (a0 + a1) / 2, (z0 + z1) / 2);
  return m;
}
function placeOnWall(m, key, a, z, out = 0) {
  if (key === 'F') m.position.set(a, z, Y0 - out);
  else if (key === 'N') m.position.set(a, z, Y1 + out);
  else { m.rotation.y = Math.PI / 2; m.position.set(key === 'L' ? X0 - out : X1 + out, z, a); }
}
function wallBox(key, a0, a1, z0, z1, t, mat, out = 0) {
  const m = new Mesh(new BoxGeometry(a1 - a0, z1 - z0, t), mat);
  placeOnWall(m, key, (a0 + a1) / 2, (z0 + z1) / 2, out);
  return m;
}

// Paneles de cada pared (mismo trazado que el 2D): cristal abajo y malla hasta arriba
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

export class Court {
  constructor(renderer) {
    maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.group = new Group();
    this.mapId = '';

    // Suelo
    this.turfMat = new MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
    const turf = new Mesh(new PlaneGeometry(COURT.w, COURT.h), this.turfMat);
    turf.rotation.x = -Math.PI / 2;
    turf.position.set(COURT.netX, 0, COURT.midY);
    turf.receiveShadow = true;
    this.group.add(turf);

    this.outerMat = new MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    this.outer = new Mesh(new PlaneGeometry(OUT.w, OUT.h), this.outerMat);
    this.outer.rotation.x = -Math.PI / 2;
    this.outer.position.set(OUT.x0 + OUT.w / 2, -0.4, OUT.y0 + OUT.h / 2);
    this.outer.receiveShadow = true;
    this.group.add(this.outer);

    // Plataforma flotante de Atlas (pasillo con canto; abajo solo hay cielo)
    this.platMat = new MeshStandardMaterial({ roughness: 0.9 });
    this.platform = new Mesh(new BoxGeometry(COURT.w + APRON * 2, 36, COURT.h + APRON * 2), [
      new MeshStandardMaterial({ color: '#8d8576', roughness: 0.9 }), new MeshStandardMaterial({ color: '#8d8576', roughness: 0.9 }),
      this.platMat, new MeshStandardMaterial({ color: '#5d574d' }),
      new MeshStandardMaterial({ color: '#8d8576', roughness: 0.9 }), new MeshStandardMaterial({ color: '#8d8576', roughness: 0.9 })
    ]);
    this.platform.position.set(COURT.netX, -18.4, COURT.midY);
    this.platform.receiveShadow = true;
    this.group.add(this.platform);

    this.buildWalls();
    this.buildNet();
  }

  // Texturas del suelo según el mapa (se generan una vez por mapa)
  setMap(mapId) {
    if (mapId === this.mapId) return;
    this.mapId = mapId;
    const ST = styleOf();
    for (const m of [this.turfMat, this.outerMat, this.platMat]) {
      if (m.map) m.map.dispose();
      if (m.emissiveMap) m.emissiveMap.dispose();
      m.map = null; m.emissiveMap = null;
    }
    this.turfMat.map = canvasTex(turfCanvas(ST, mapId));
    this.turfMat.needsUpdate = true;
    const sky = ST.outer === 'sky';
    this.outer.visible = !sky;
    this.platform.visible = sky;
    if (sky) {
      // Atlas: el pasillo es la cara superior de la plataforma
      const cv = makeCanvas(256, 160), c = cv.getContext('2d');
      c.fillStyle = `rgb(${ST.apron.join(',')})`; c.fillRect(0, 0, 256, 160);
      this.platMat.map = canvasTex(cv);
    } else {
      const { cv, glow } = outerCanvas(ST);
      this.outerMat.map = canvasTex(cv);
      if (glow) {
        this.outerMat.emissiveMap = canvasTex(glow);
        this.outerMat.emissive.set('#ffffff');
        this.outerMat.emissiveIntensity = 1.6;
      } else this.outerMat.emissive.set('#000000');
    }
    for (const m of [this.outerMat, this.platMat]) m.needsUpdate = true;
  }

  buildWalls() {
    const walls = new Group();
    // Cristal templado: transmisión real (deja ver a través) y reflejo del entorno
    const glass = new MeshPhysicalMaterial({
      color: '#e6f4ff', metalness: 0, roughness: 0.04, transmission: 1, thickness: 1.2, ior: 1.5,
      attenuationColor: '#cfeaff', attenuationDistance: 140, specularIntensity: 1, envMapIntensity: 1.4
    });
    const streaks = new MeshBasicMaterial({ map: streakTexture(), transparent: true, opacity: 0.38, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    const glassEdge = new MeshStandardMaterial({ color: '#cfe6f7', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.75 });
    const metal = new MeshStandardMaterial({ color: '#1d252f', metalness: 0.65, roughness: 0.45 });
    const wireMat = new MeshStandardMaterial({
      color: '#6c7682', metalness: 0.7, roughness: 0.45, alphaMap: wireTexture(32, 3),
      transparent: true, alphaTest: 0.04, side: DoubleSide, depthWrite: false
    });
    this.wireMat = wireMat;

    for (const key of ['F', 'N', 'L', 'R']) {
      const side = key === 'F' || key === 'N';
      const panels = wallPanels(side ? 'side' : 'back');
      const out = key === 'F' || key === 'L' ? -1 : 1;   // hacia afuera de la cancha
      for (const pn of panels) {
        if (pn.glass > 0) {
          const g = wallBox(key, pn.a0 + 0.6, pn.a1 - 0.6, 0, pn.glass, 1.2, glass);
          walls.add(g);
          walls.add(wallPlane(key, pn.a0 + 0.6, pn.a1 - 0.6, 0, pn.glass, streaks));
          walls.add(wallBox(key, pn.a0 + 0.6, pn.a1 - 0.6, pn.glass - 0.8, pn.glass, 1.5, glassEdge));   // canto superior
        }
        if (pn.top > pn.glass) {
          const z0 = pn.glass, z1 = pn.top;
          // La malla se corta en el vano de la puerta
          const cuts = side && pn.a0 < DOOR[1] && pn.a1 > DOOR[0]
            ? [[pn.a0, DOOR[0], z0, z1], [DOOR[1], pn.a1, z0, z1], [Math.max(pn.a0, DOOR[0]), Math.min(pn.a1, DOOR[1]), DOOR_H, z1]]
            : [[pn.a0, pn.a1, z0, z1]];
          for (const [a0, a1, c0, c1] of cuts) {
            if (a1 - a0 < 0.5) continue;
            const w = wallPlane(key, a0, a1, c0, c1, wireMat, 8);
            w.castShadow = true;
            walls.add(w);
          }
          // Marco de la malla: barras arriba y abajo
          walls.add(wallBox(key, pn.a0, pn.a1, z1 - 2, z1, 2.4, metal));
          if (z0 > 0) walls.add(wallBox(key, pn.a0, pn.a1, z0, z0 + 1.6, 2.2, metal));
        }
      }
      // Postes de acero en cada junta (el del centro del lateral queda dentro de la puerta)
      const posts = new Map();
      for (const pn of panels) for (const a of [pn.a0, pn.a1]) posts.set(a, Math.max(posts.get(a) || 0, pn.top));
      for (const [a, h] of posts) {
        if (side && a > DOOR[0] && a < DOOR[1]) continue;
        const p = wallBox(key, a - 1.7, a + 1.7, 0, h + 1, 3.4, metal, out * 1.6);
        p.castShadow = true;
        walls.add(p);
      }
      if (side) this.buildDoor(walls, key, out, metal, wireMat);
    }
    walls.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    this.group.add(walls);
  }

  // Puerta lateral: marco y una hoja de malla entreabierta hacia afuera (solo estética)
  buildDoor(walls, key, out, metal, wireMat) {
    for (const a of DOOR) {
      const p = wallBox(key, a - 1.7, a + 1.7, 0, WALL_H_LOW + 1, 3.4, metal, out * 1.6);
      p.castShadow = true;
      walls.add(p);
    }
    walls.add(wallBox(key, DOOR[0], DOOR[1], DOOR_H, DOOR_H + 2.4, 3, metal, out * 1.6));
    const leaf = new Group();
    const w = DOOR[1] - DOOR[0] - 4;
    const frame = [[0, w, 0, 2], [0, w, DOOR_H - 4, DOOR_H - 2], [0, 2, 0, DOOR_H - 2], [w - 2, w, 0, DOOR_H - 2]];
    for (const [a0, a1, z0, z1] of frame) {
      const b = new Mesh(new BoxGeometry(a1 - a0, z1 - z0, 1.6), metal);
      b.position.set((a0 + a1) / 2, (z0 + z1) / 2, 0);
      b.castShadow = true;
      leaf.add(b);
    }
    const mesh = new Mesh(new PlaneGeometry(w - 4, DOOR_H - 6), wireMat);
    mesh.position.set(w / 2, DOOR_H / 2 - 1, 0);
    leaf.add(mesh);
    // Bisagra en DOOR[0], abierta unos 35° hacia afuera
    const hinge = new Group();
    hinge.add(leaf);
    leaf.position.x = 0;
    const ang = 0.6;
    if (key === 'F') { hinge.position.set(DOOR[0] + 2, 0.5, Y0 - 3); hinge.rotation.y = ang; }
    else { hinge.position.set(DOOR[0] + 2, 0.5, Y1 + 3); hinge.rotation.y = -ang; }
    walls.add(hinge);
  }

  // Red: paño con alambre, faja blanca y postes. Se deforma cuando la golpea la pelota (fx.net)
  buildNet() {
    const SY = 44, SZ = 6;
    this.netSegs = { SY, SZ };
    const geo = new BufferGeometry();
    const n = (SY + 1) * (SZ + 1);
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    const uv = new Float32Array(n * 2), idx = [];
    for (let j = 0; j <= SZ; j++) for (let i = 0; i <= SY; i++) {
      const k = j * (SY + 1) + i;
      uv[k * 2] = i / SY * COURT.h / 6;
      uv[k * 2 + 1] = j / SZ * 6;
      if (i < SY && j < SZ) idx.push(k, k + 1, k + SY + 1, k + 1, k + SY + 2, k + SY + 1);
    }
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const netMat = new MeshStandardMaterial({
      color: '#0d1218', roughness: 0.8, alphaMap: wireTexture(16, 2), transparent: true, alphaTest: 0.05,
      side: DoubleSide, depthWrite: false
    });
    netMat.alphaMap.repeat.set(1, 1);
    this.netCloth = new Mesh(geo, netMat);
    this.netCloth.castShadow = true;
    this.netCloth.frustumCulled = false;

    const tgeo = new BufferGeometry();
    tgeo.setAttribute('position', new BufferAttribute(new Float32Array((SY + 1) * 2 * 3), 3));
    const tidx = [];
    for (let i = 0; i < SY; i++) tidx.push(i, i + 1, i + SY + 1, i + 1, i + SY + 2, i + SY + 1);
    tgeo.setIndex(tidx);
    this.netTape = new Mesh(tgeo, new MeshStandardMaterial({ color: '#f2f5f8', roughness: 0.6, side: DoubleSide }));
    this.netTape.castShadow = true;
    this.netTape.frustumCulled = false;

    const hc = NET_H * ZS, hp = hc + 2.4;
    const postMat = new MeshStandardMaterial({ color: '#151b23', metalness: 0.5, roughness: 0.5 });
    for (const y of [Y0, Y1]) {
      const p = new Mesh(new CylinderGeometry(1.8, 1.8, hp + 3, 12), postMat);
      p.position.set(COURT.netX, (hp + 3) / 2, y);
      p.castShadow = true;
      this.group.add(p);
    }
    this.group.add(this.netCloth, this.netTape);
    this.netKey = '';
    this.updateNet();
  }

  updateNet() {
    const n = fx.net;
    const key = n.amp ? `${n.amp}|${n.t}` : '0';
    if (key === this.netKey) return;
    this.netKey = key;
    const { SY, SZ } = this.netSegs;
    const hc = NET_H * ZS, hp = hc + 2.4, half = COURT.h / 2, mid = COURT.midY;
    const topZ = y => hp - (hp - hc) * (1 - ((y - mid) / half) ** 2);
    const bulge = (y, zf) => n.amp ? n.dir * n.amp * Math.exp(-(((y - n.y0) / 55) ** 2)) * Math.sin(zf * Math.PI) * Math.cos(n.t * 0.55) : 0;
    const pos = this.netCloth.geometry.attributes.position;
    for (let j = 0; j <= SZ; j++) for (let i = 0; i <= SY; i++) {
      const y = Y0 + COURT.h * i / SY, zf = j / SZ;
      pos.setXYZ(j * (SY + 1) + i, COURT.netX + bulge(y, zf), topZ(y) * zf, y);
    }
    pos.needsUpdate = true;
    this.netCloth.geometry.computeVertexNormals();
    const tp = this.netTape.geometry.attributes.position;
    for (let i = 0; i <= SY; i++) {
      const y = Y0 + COURT.h * i / SY, top = topZ(y);
      const x = COURT.netX + bulge(y, 1);
      tp.setXYZ(i, x, top - 3, y);
      tp.setXYZ(i + SY + 1, x, top + 0.4, y);
    }
    tp.needsUpdate = true;
    this.netTape.geometry.computeVertexNormals();
  }

  update() {
    if (state.map !== this.mapId) this.setMap(state.map);
    this.updateNet();
  }
}
