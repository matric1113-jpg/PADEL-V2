import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, DynamicDrawUsage, Group, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, PointLight, Points, ShaderMaterial,
  SphereGeometry, Sprite, SpriteMaterial, Vector3
} from 'three';
import { COURT } from '../core/constants.js';
import { state } from '../core/state.js';
import { clamp, lerp } from '../core/util.js';
import { fx } from '../view/fx.js';
import { BACK_Y, BACK_ZK } from './backdrop.js';

// ---------- Efectos: los mismos de fx (view/fx.js), ahora en 3D ----------
// Arena al botar, chispas (foco roto, Zeus, quemaduras), lluvia, ráfagas, aves, nubes de
// tormenta y rayos, grietas del hielo, impactos de los golpes y ondas en el cristal.
// Las coordenadas del juego (x, y, z) van a Three.js como (x, z, y).

// Puntos cuadrados con tamaño en unidades de mundo y color con alfa por punto
const POINTS_VERT = /* glsl */`
  attribute float size;
  attribute vec4 rgba;
  varying vec4 vC;
  uniform float uViewH;
  void main() {
    vC = rgba;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, size * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z);
  }
`;
const POINTS_FRAG = /* glsl */`
  varying vec4 vC;
  void main() { if (vC.a < 0.003) discard; gl_FragColor = vC; }
`;

class PointCloud {
  constructor(max, additive) {
    this.max = max;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(max * 3), 3).setUsage(DynamicDrawUsage));
    g.setAttribute('size', new BufferAttribute(new Float32Array(max), 1).setUsage(DynamicDrawUsage));
    g.setAttribute('rgba', new BufferAttribute(new Float32Array(max * 4), 4).setUsage(DynamicDrawUsage));
    this.mat = new ShaderMaterial({
      vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, uniforms: { uViewH: { value: 720 } },
      transparent: true, depthWrite: false, blending: additive ? AdditiveBlending : NormalBlending
    });
    this.obj = new Points(g, this.mat);
    this.obj.frustumCulled = false;
    this.n = 0;
  }
  begin(viewH) { this.n = 0; this.mat.uniforms.uViewH.value = viewH; }
  add(x, y, z, size, r, g, b, a) {
    if (this.n >= this.max) return;
    const at = this.obj.geometry.attributes;
    at.position.setXYZ(this.n, x, z, y);
    at.size.setX(this.n, size);
    at.rgba.setXYZW(this.n, r, g, b, a);
    this.n++;
  }
  end() {
    const at = this.obj.geometry.attributes;
    this.obj.geometry.setDrawRange(0, this.n);
    at.position.needsUpdate = at.size.needsUpdate = at.rgba.needsUpdate = true;
  }
}

// Segmentos de línea (lluvia, rachas, aves, grietas): pares de puntos con color y alfa por vértice
class Segments {
  constructor(max, opts = {}) {
    this.max = max;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(max * 6), 3).setUsage(DynamicDrawUsage));
    g.setAttribute('color', new BufferAttribute(new Float32Array(max * 8), 4).setUsage(DynamicDrawUsage));
    this.obj = new LineSegments(g, new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, ...opts }));
    this.obj.frustumCulled = false;
    this.n = 0;
  }
  begin() { this.n = 0; }
  // Puntos en coordenadas del juego (x, y, altura)
  add(x0, y0, z0, x1, y1, z1, r, g, b, a) {
    if (this.n >= this.max) return;
    const at = this.obj.geometry.attributes, i = this.n * 2;
    at.position.setXYZ(i, x0, z0, y0); at.position.setXYZ(i + 1, x1, z1, y1);
    at.color.setXYZW(i, r, g, b, a); at.color.setXYZW(i + 1, r, g, b, a);
    this.n++;
  }
  end() {
    const at = this.obj.geometry.attributes;
    this.obj.geometry.setDrawRange(0, this.n * 2);
    at.position.needsUpdate = at.color.needsUpdate = true;
  }
}

// Cinta que mira a la cámara a lo largo de una línea quebrada (rayos)
class Ribbon {
  constructor(maxPts, color) {
    this.maxPts = maxPts;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(maxPts * 2 * 3), 3).setUsage(DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < maxPts - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    this.mat = new MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
    this.obj = new Mesh(g, this.mat);
    this.obj.frustumCulled = false;
  }
  set(pts, width, view, alpha) {
    const pos = this.obj.geometry.attributes.position;
    const d = new Vector3(), n = new Vector3();
    for (let i = 0; i < this.maxPts; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      d.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]);
      n.crossVectors(d, view).normalize().multiplyScalar(width / 2);
      pos.setXYZ(i * 2, p.x + n.x, p.y + n.y, p.z + n.z);
      pos.setXYZ(i * 2 + 1, p.x - n.x, p.y - n.y, p.z - n.z);
    }
    pos.needsUpdate = true;
    this.mat.opacity = alpha;
    this.obj.visible = alpha > 0.01;
  }
}

// Anillo con rayos para los impactos de golpe (sprite que mira a la cámara)
function impactTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.strokeStyle = '#fff';
  c.lineCap = 'round';
  c.lineWidth = 7;
  c.beginPath(); c.arc(64, 64, 40, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 6;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.3;
    c.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30);
    c.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
  }
  c.stroke();
  return new CanvasTexture(cv);
}

export class Effects {
  constructor() {
    this.group = new Group();
    this.sand = new PointCloud(600, false);
    this.sparks = new PointCloud(600, true);
    this.lines = new Segments(900);
    this.glowLines = new Segments(120, { blending: AdditiveBlending });
    this.group.add(this.sand.obj, this.sparks.obj, this.lines.obj, this.glowLines.obj);

    // Nubes de tormenta sobre los avisos de rayo
    const cloudMat = new MeshStandardMaterial({ color: '#32374b', roughness: 1, transparent: true, opacity: 0.85 });
    this.clouds = [];
    for (let i = 0; i < 12; i++) {
      const m = new Mesh(new SphereGeometry(1, 12, 8), cloudMat);
      m.visible = false;
      this.clouds.push(m);
      this.group.add(m);
    }
    // Descargas: cinta en zigzag y una luz real que destella
    this.bolts = [0, 1, 2, 3].map(() => { const r = new Ribbon(7, '#fffbd2'); this.group.add(r.obj); return r; });
    this.boltLight = new PointLight('#e6f0ff', 0, 0, 1);
    this.boltLight.position.set(COURT.netX, 80, COURT.midY);
    this.group.add(this.boltLight);
    // Impactos
    const tex = impactTexture();
    this.impacts = [];
    for (let i = 0; i < 10; i++) {
      const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false;
      this.impacts.push(s);
      this.group.add(s);
    }
  }

  update(camera, viewH, markers) {
    const view = camera.userData.forward;
    this.sand.begin(viewH); this.sparks.begin(viewH); this.lines.begin(); this.glowLines.begin();

    // Arena levantada por los botes y el sprint
    for (const p of fx.particles) {
      const a = (1 - p.life / p.max) * 0.75;
      this.sand.add(p.x, p.y, p.z, p.size, 0.84, 0.78, 0.63, a);
    }
    // Chispas: fuego, electricidad (Zeus) o las del foco roto
    for (const s of fx.sparks) {
      const a = 1 - s.t / s.max;
      if (s.fire) this.sparks.add(s.x, s.y, s.z, 2.6, 1, (120 + Math.random() * 80) / 255, 0.12, a);
      else if (s.elec) this.sparks.add(s.x, s.y, s.z, 2.4, 0.63, 0.86, 1, a);
      else this.sparks.add(s.x, s.y, s.z, 2.6, 1, 0.94, 0.7, a);
    }
    // Lluvia (En altura): gotas inclinadas por el viento
    // la cola de cada gota sale contra el viento: con una ráfaga la lluvia se ve tumbada
    const slant = -(fx.rainWind || 0) * (14 / (11 + 9 * (fx.windK || 0)));
    for (const d of fx.rain) this.lines.add(d.x, d.y, d.z, d.x, d.y + 2 + slant, d.z + 14, 0.78, 0.86, 0.94, 0.3 + 0.25 * (fx.windK || 0));
    // Aves cruzando la cordillera (Chile), sobre el telón de fondo
    for (const bd of fx.birds) {
      const z = bd.z * BACK_ZK, s = 9, f = Math.sin(bd.ph) * 0.6;
      this.lines.add(bd.x - s, BACK_Y + 2, z + s * f, bd.x, BACK_Y + 2, z, 0.12, 0.12, 0.16, 0.85);
      this.lines.add(bd.x, BACK_Y + 2, z, bd.x + s, BACK_Y + 2, z + s * f, 0.12, 0.12, 0.16, 0.85);
    }
    // Grietas del hielo
    if (state.ice) {
      const s = state.ice.side, a = clamp(state.ice.t / 30, 0, 1);
      const x0 = s === 0 ? COURT.x : COURT.netX, x1 = s === 0 ? COURT.netX : COURT.x + COURT.w;
      for (let k = 0; k < 14; k++) {
        const x = x0 + ((k * 97) % (x1 - x0)), y = COURT.y + ((k * 131) % COURT.h);
        this.glowLines.add(x, y, 0.5, x + 30, y + 12, 0.5, 1, 1, 1, 0.45 * a);
        this.glowLines.add(x + 30, y + 12, 0.5, x + 38, y + 28, 0.5, 1, 1, 1, 0.3 * a);
      }
    }
    this.sand.end(); this.sparks.end(); this.lines.end(); this.glowLines.end();

    this.updateStorm(view);
    this.updateImpacts();
    // Ondas en el cristal donde pegó la pelota
    for (const rp of fx.ripples) {
      const k = rp.t / 30;
      const wallPos = { F: COURT.y + 1.2, N: COURT.y + COURT.h - 1.2, L: COURT.x + 1.2, R: COURT.x + COURT.w - 1.2 }[rp.wall];
      for (const m of [1, 0.6]) {
        markers.ring({ wall: rp.wall, wallPos, a: rp.a, z: rp.z, r: (5 + k * 30) * m, w: 1.6, line: 0.55 * (1 - k) * m, color: '200, 240, 255' });
      }
    }
  }

  updateStorm(view) {
    let c = 0;
    for (const bo of state.bolts) {
      for (const [dx, dz, r] of [[-16, 0, 13], [0, 5, 17], [16, 0, 13], [-6, -4, 12]]) {
        const m = this.clouds[c++];
        if (!m) break;
        m.visible = true;
        m.position.set(bo.x + dx, 300 + dz, bo.y);
        m.scale.set(r, r * 0.7, r);
      }
    }
    for (; c < this.clouds.length; c++) this.clouds[c].visible = false;

    let light = 0;
    this.bolts.forEach((rb, i) => {
      const st = fx.strikes[i];
      if (!st) { rb.obj.visible = false; return; }
      const a = 1 - st.t / 26;
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const off = (k % 2 ? 8 : -8) * (k < 6 && k > 0 ? 1 : 0);
        pts.push(new Vector3(st.x + off, lerp(300, 0, t), st.y + off * 0.5));
      }
      rb.set(pts, 4, view, a);
      if (a > light) { light = a; this.boltLight.position.set(st.x, 90, st.y); }
    });
    this.boltLight.intensity = light * 700;
  }

  updateImpacts() {
    this.impacts.forEach((s, i) => {
      const im = fx.impacts[i];
      if (!im) { s.visible = false; return; }
      const k = im.t / 14;
      s.visible = true;
      s.position.set(im.x, im.z, im.y);
      const r = (im.big ? 26 : 14) * (0.4 + k) * 2.6;
      s.scale.set(r, r, 1);
      s.material.color.set(im.big ? '#ffc850' : '#ffffff');
      s.material.opacity = (im.big ? 0.9 : 0.8) * (1 - k);
    });
  }
}
