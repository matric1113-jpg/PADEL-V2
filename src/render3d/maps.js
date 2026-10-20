import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide,
  Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SphereGeometry,
  SRGBColorSpace, Sprite, SpriteMaterial, Vector3
} from 'three';
import { COURT } from '../core/constants.js';
import { state } from '../core/state.js';
import { BACK_X0, BACK_X1, BACK_Y, BACK_Z1, BACK_ZK, paintBackdrop } from './backdrop.js';
import { Crowd } from './crowd.js';
import { mergeStatic } from './merge.js';
import { vnoise } from './noise.js';
import { MAP_STYLE } from './style.js';

// ---------- Ambientación de cada mapa: cielo, telón de fondo, público y utilería ----------

function gradientTexture(top, bottom) {
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 256;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, 0, 2, 256);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function glowTexture(r, g, b) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
  gr.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  return new CanvasTexture(cv);
}

// Materiales compartidos (así las piezas de igual material se fusionan en una sola malla)
const MATS = new Map();
const std = (color, extra = {}) => {
  const key = color + JSON.stringify(extra);
  if (!MATS.has(key)) MATS.set(key, new MeshStandardMaterial({ color, roughness: 0.8, ...extra }));
  return MATS.get(key);
};

// Palmera de Brasil: tronco curvo y hojas que caen
function palm(x, y) {
  const g = new Group();
  const trunk = std('#7a5a36');
  let prev = new Vector3(x, 0, y);
  for (let k = 1; k <= 8; k++) {
    const t = k / 8;
    const p = new Vector3(x + Math.sin(t * 1.4) * 30, t * 230, y);
    const seg = new Mesh(new CylinderGeometry(3.2 - t, 3.8 - t, prev.distanceTo(p), 8), trunk);
    seg.position.copy(prev).lerp(p, 0.5);
    seg.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), p.clone().sub(prev).normalize());
    seg.castShadow = true;
    g.add(seg);
    prev = p;
  }
  const leaf = std('#2e7d32', { side: DoubleSide });
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2;
    const tip = new Vector3(prev.x + Math.cos(a) * 80, 200, y + Math.sin(a) * 60);
    const mid = new Vector3(prev.x + Math.cos(a) * 40, 240, y + Math.sin(a) * 30);
    for (const [p0, p1, w] of [[prev, mid, 14], [mid, tip, 9]]) {
      const len = p0.distanceTo(p1);
      const m = new Mesh(new PlaneGeometry(w, len), leaf);
      m.position.copy(p0).lerp(p1, 0.5);
      m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
      m.rotateY(a);
      m.castShadow = true;
      g.add(m);
    }
  }
  return g;
}

// Banderines verde-amarillos sobre la pared del fondo
function bunting() {
  const pos = [], col = [];
  const green = new Color('#1fa34a'), yellow = new Color('#ffdf00');
  for (let x = 60; x < 860; x += 20) {
    const c = (x / 20) % 2 ? green : yellow;
    pos.push(x, 164, COURT.y - 2, x + 20, 164, COURT.y - 2, x + 10, 150, COURT.y - 2);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.computeVertexNormals();
  return new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.7 }));
}

// Farolillos rojos de China colgando de un cordel
function lanterns() {
  const g = new Group();
  const y = -12;
  const sag = x => Math.sin((x - 40) / 840 * Math.PI) * 18;
  const pts = [];
  for (let x = 40; x <= 880; x += 20) pts.push(new Vector3(x, 205 - sag(x), y));
  g.add(new Line(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color: '#2a1a1a' })));
  const red = std('#d71f2a', { emissive: '#ff3a20', emissiveIntensity: 1.1 });
  const gold = std('#ffcc33', { emissive: '#aa7a10', emissiveIntensity: 0.5 });
  const glow = glowTexture(255, 120, 80);
  for (let x = 80; x < 860; x += 70) {
    const h = 190 - sag(x);
    const l = new Mesh(new SphereGeometry(8, 14, 10), red);
    l.scale.set(1, 1.2, 1);
    l.position.set(x, h, y);
    g.add(l);
    for (const dy of [-10, 10]) {
      const c = new Mesh(new CylinderGeometry(4, 4, 2.5, 10), gold);
      c.position.set(x, h + dy, y);
      g.add(c);
    }
    const s = new Sprite(new SpriteMaterial({ map: glow, blending: AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.set(55, 55, 1);
    s.position.set(x, h, y);
    g.add(s);
  }
  return g;
}

// Rocas: pirámides del cráter y peñascos de la montaña
function rocks(list, kind) {
  const g = new Group();
  const mat = kind === 'crater' ? std('#231512', { roughness: 0.95, flatShading: true }) : std('#5d636b', { roughness: 0.95, flatShading: true });
  for (const [x, y, s] of list) {
    const m = kind === 'crater'
      ? new Mesh(new ConeGeometry(40 * s, 70 * s, 7), mat)
      : new Mesh(new DodecahedronGeometry(26 * s, 0), mat);
    if (kind === 'crater') { m.scale.z = 26 / 40; m.position.set(x, 35 * s, y); }
    else { m.scale.set(1.3, 0.8, 1); m.position.set(x, 12 * s, y); m.rotation.y = x; }
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// Mar de nubes bajo la plataforma de Atlas
function cloudSea() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  const img = c.createImageData(256, 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const n = vnoise(i / 32, j / 32) * 0.6 + vnoise(i / 12 + 7, j / 12 + 3) * 0.4;
    const cl = Math.min(1, Math.max(0, (n - 0.4) * 2.5));
    const o = (j * 256 + i) * 4;
    img.data[o] = 120 + cl * 125; img.data[o + 1] = 150 + cl * 100; img.data[o + 2] = 214 + cl * 38; img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(6, 6);
  const m = new Mesh(new PlaneGeometry(9000, 9000), new MeshBasicMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(COURT.netX, -420, COURT.midY);
  return m;
}

export class MapScene {
  constructor() {
    this.group = new Group();
    this.mapId = '';
    this.backdropMat = new MeshBasicMaterial({ fog: false });
    const h = BACK_Z1 * BACK_ZK;
    this.backdrop = new Mesh(new PlaneGeometry(BACK_X1 - BACK_X0, h), this.backdropMat);
    this.backdrop.position.set((BACK_X0 + BACK_X1) / 2, h / 2, BACK_Y);
    this.group.add(this.backdrop);
    this.crowd = new Crowd();
    this.group.add(this.crowd.group);
    this.props = new Group();
    this.group.add(this.props);
  }

  setMap(id, scene) {
    if (id === this.mapId) return;
    this.mapId = id;
    const ST = MAP_STYLE[id] || MAP_STYLE.chile;
    if (scene.background && scene.background.dispose) scene.background.dispose();
    scene.background = gradientTexture(ST.sky[0], ST.sky[1]);
    if (this.backdropMat.map) this.backdropMat.map.dispose();
    const tex = new CanvasTexture(paintBackdrop(id));
    tex.colorSpace = SRGBColorSpace;
    this.backdropMat.map = tex;
    this.backdropMat.needsUpdate = true;
    this.crowd.setMap(id);

    // Utilería: se descarta la del mapa anterior
    this.props.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.props.clear();
    const props = new Group();
    if (id === 'brasil') {
      for (const [x, y] of [[-40, -70], [960, -50], [-90, 230], [1010, 330], [300, -200], [700, -190]]) props.add(palm(x, y));
      props.add(bunting());
    } else if (id === 'china') {
      props.add(lanterns());
    } else if (id === 'crater') {
      props.add(rocks([[-60, -60, 1.2], [990, -40, 1], [-70, 520, 0.9], [990, 560, 1.1], [420, -210, 1.4]], 'crater'));
    } else if (id === 'altura') {
      props.add(rocks([[-80, -40, 1.3], [1000, -20, 1.1], [-120, 300, 1], [1040, 420, 1.4], [-60, 560, 0.9], [980, 600, 1.2]], 'rock'));
    } else if (id === 'atlas') {
      props.add(cloudSea());
    }
    this.props.add(mergeStatic(props));
  }

  update(now, scene) {
    if (state.map !== this.mapId) this.setMap(state.map, scene);
    this.crowd.update(now);
  }
}
