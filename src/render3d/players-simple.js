import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3
} from 'three';
import { state } from '../core/state.js';
import { actOn, upLvl } from '../core/stats.js';
import { fx } from '../view/fx.js';
import { CELEB_KIND, SHADOW_LOOK_COLORS, buildPlayerParts, lookOf, scaleOf } from '../view/skeleton.js';

// ---------- Jugadores: figuras 3D simples armadas sobre el esqueleto de view/skeleton.js ----------
// Las poses (correr, cargar, golpear, celebrar) son las mismas del render 2D; aquí cada hueso es un
// cilindro con esferas en las puntas, el tronco un cilindro elíptico y la cabeza una esfera con pelo.
// Todo va en pocas mallas instanciadas. Es la versión de respaldo: mientras cargan los modelos animados (render3d/players.js)
// o si no se pueden cargar, se dibuja esto.

const HAT_COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
const CLONE_LOOK = { ...SHADOW_LOOK_COLORS, extras: {} };

const _m = new Matrix4(), _a = new Vector3(), _b = new Vector3(), _x = new Vector3(), _y = new Vector3(), _z = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

// Una malla instanciada que se vuelve a llenar en cada cuadro
class Batch {
  constructor(geo, mat, max) {
    this.mesh = new InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.set('#fff'));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.max = max;
    this.n = 0;
  }
  add(m, color) {
    if (this.n >= this.max) return;
    this.mesh.setMatrixAt(this.n, m);
    this.mesh.setColorAt(this.n, _c.set(color));
    this.n++;
  }
  begin() { this.n = 0; }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Juego de mallas: cilindros, esferas y casquetes (pelo, jockey)
class Kit {
  constructor(mat) {
    this.cyl = new Batch(new CylinderGeometry(1, 1, 1, 14, 1), mat, 700);
    this.sph = new Batch(new SphereGeometry(1, 16, 12), mat, 900);
    this.cap = new Batch(new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat, 60);
    this.all = [this.cyl, this.sph, this.cap];
  }
  begin() { this.all.forEach(b => b.begin()); }
  end() { this.all.forEach(b => b.end()); }
}

// Base ortonormal con el eje Y en dir (y X lo más parecido posible a side)
function basis(dir, side) {
  _y.copy(dir).normalize();
  _x.copy(side || (Math.abs(_y.y) < 0.9 ? UP : _x.set(1, 0, 0)));
  _z.crossVectors(_x, _y);
  if (_z.lengthSq() < 1e-8) _z.set(0, 0, 1).cross(_y);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
}

export class SimplePlayers {
  constructor() {
    this.group = new Group();
    this.solid = new Kit(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0.02 }));
    this.ghost = new Kit(new MeshStandardMaterial({
      color: '#ffffff', roughness: 0.5, transparent: true, opacity: 0.78, emissive: '#5a33b8', emissiveIntensity: 0.55
    }));
    for (const k of [this.solid, this.ghost]) for (const b of k.all) this.group.add(b.mesh);
    // Estela del golpe (una por figura)
    this.trails = [];
    for (let i = 0; i < 8; i++) { const m = makeTrail(); this.trails.push(m); this.group.add(m); }
  }

  // Arma los esqueletos del cuadro y los dibuja. Devuelve los esqueletos (los usa el HUD).
  update(dt, now, inReplay) {
    const players = state.players;
    const celebKind = p => CELEB_KIND[p.lookId] || 'fist';
    const built = players.map((p, idx) => p.out ? null : buildPlayerParts(p, idx, dt * (inReplay ? 0.45 : 1), now, fx.players[idx],
      fx.celeb && !inReplay && p.team === fx.celeb.team ? { celeb: { kind: celebKind(p), t: fx.celeb.t } } : {}));
    this.solid.begin(); this.ghost.begin();
    let trail = 0;
    players.forEach((p, idx) => {
      if (p.out) return;
      this.figure(this.solid, p, built[idx], this.trails[trail++]);
      if (p.clone) {
        const base = lookOf(p);
        const look = { ...base, ...CLONE_LOOK, paddle: { ...base.paddle, face: '#2a2048', rim: '#9d7bff' } };
        const fake = { ...p, x: p.clone.x, y: p.clone.y, clone: null };
        const bc = buildPlayerParts(fake, idx, dt, now, fx.clones[idx], { look });
        this.figure(this.ghost, fake, bc, this.trails[trail++]);
      }
    });
    for (; trail < this.trails.length; trail++) this.trails[trail].visible = false;
    this.solid.end(); this.ghost.end();
    return built;
  }

  figure(kit, p, built, trailMesh) {
    const { parts, look } = built;
    const K = scaleOf(p);
    const Kz = K * look.body.h * (1 + 0.03 * upLvl(p, 'estiron')) * (actOn(p, 'gordo') ? 1.2 : 1);
    const jz = built.jumpZ || 0;
    // Esqueleto (x, y, z del juego) → Three.js (x, altura, y)
    const T = (v, out) => out.set(p.x + (v.x - p.x) * K, v.z * Kz + jz, p.y + (v.y - p.y) * K);

    for (const part of parts) {
      if (part.k === 'limb') {
        T(part.a, _a); T(part.b, _b);
        const r = part.w * K / 2;
        this.bone(kit, _a, _b, r, part.c);
      } else if (part.k === 'torso') this.torso(kit, part, T, look, K);
      else if (part.k === 'head') this.head(kit, part, T, K);
      else if (part.k === 'paddle') this.paddle(kit, part, T, K);
    }
    this.trail(trailMesh, built.pf.tips, T);
    if (built.cloud) {
      // Zeus remata parado sobre una nube
      for (const [dx, dy, r] of [[-12, 0, 9], [0, -3, 12], [12, 0, 9], [0, 5, 9], [-6, 4, 8]]) {
        _m.makeScale(r, r * 0.55, r).setPosition(p.x + dx, 6, p.y + dy);
        kit.sph.add(_m, '#f0f6ff');
      }
    }
  }

  // Hueso: cilindro entre a y b con esferas en las articulaciones
  bone(kit, a, b, r, color) {
    _z.subVectors(b, a);
    const len = _z.length();
    if (len > 1e-3) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2;   // antes de reutilizar _a
      basis(_z, null);
      _m.makeBasis(_x, _y, _z).scale(_a.set(r, len, r)).setPosition(mx, my, mz);
      kit.cyl.add(_m, color);
    }
    _m.makeScale(r, r, r).setPosition(b.x, b.y, b.z);
    kit.sph.add(_m, color);
  }

  torso(kit, part, T, look, K) {
    const f = part.frame;
    const top = T(f.top, new Vector3()), bot = T(f.bot, new Vector3());
    const r0 = f.botR[0] * K, r1 = f.topR[0] * K, d0 = f.botR[1] * K, d1 = f.topR[1] * K;
    // Cuerpo: un cilindro elíptico con la media de los dos extremos, orientado con los hombros
    _z.subVectors(top, bot);
    const len = _z.length();
    basis(_z, _b.set(f.topSide.x, 0, f.topSide.y));
    _m.makeBasis(_x, _y, _z).scale(_a.set((r0 + r1) / 2, len, (d0 + d1) / 2)).setPosition((top.x + bot.x) / 2, (top.y + bot.y) / 2, (top.z + bot.z) / 2);
    kit.cyl.add(_m, look.shirt);
    // Hombros y cadera redondeados
    _m.makeBasis(_x, _y, _z).scale(_a.set(r1, 4 * K, d1)).setPosition(top.x, top.y, top.z);
    kit.sph.add(_m, look.tank ? look.skin : look.shirt);
    _m.makeBasis(_x, _y, _z).scale(_a.set(r0 * 1.05, 5 * K, d0 * 1.05)).setPosition(bot.x, bot.y, bot.z);
    kit.sph.add(_m, look.shorts);
    // Short
    _m.makeBasis(_x, _y, _z).scale(_a.set(r0 * 1.08, 8 * K, d0 * 1.1)).setPosition(bot.x, bot.y - 2.5 * K, bot.z);
    kit.cyl.add(_m, look.shorts);
    if (look.tank) {
      _m.makeBasis(_x, _y, _z).scale(_a.set((r0 + r1) / 2 + 0.2, len * 0.75, (d0 + d1) / 2 + 0.2)).setPosition((top.x + bot.x) / 2, (top.y + bot.y) / 2 - len * 0.1, (top.z + bot.z) / 2);
      kit.cyl.add(_m, look.shirt);
    }
    if (part.belly) {
      const c = T(part.belly, new Vector3()), r = part.belly.r * K;
      _m.makeScale(r, r * 0.95, r).setPosition(c.x, c.y, c.z);
      kit.sph.add(_m, look.shirt);
    }
  }

  head(kit, part, T, K) {
    const c = T(part.c, new Vector3());
    const L = part.look, ex = L.extras || {};
    const r = part.r * K;
    const fx = part.fx, fy = part.fy;                // hacia dónde mira (plano del suelo)
    const fwd = new Vector3(fx, 0, fy), side = new Vector3(fy, 0, -fx);   // (side, arriba, fwd) es base derecha
    const at = (f, s, h, out = new Vector3()) => out.set(c.x + fwd.x * f * r + side.x * s * r, c.y + h * r, c.z + fwd.z * f * r + side.z * s * r);
    const sphere = (pos, sx, sy, sz, color) => { _m.makeBasis(side, UP, fwd).scale(_a.set(sx * r, sy * r, sz * r)).setPosition(pos.x, pos.y, pos.z); kit.sph.add(_m, color); };
    // Casquete inclinado hacia atrás: cubre la coronilla y la nuca
    const capAt = (scale, color, tilt = -0.45, lift = 0) => {
      _y.set(0, Math.cos(tilt), 0).addScaledVector(fwd, Math.sin(tilt)).normalize();
      _z.copy(fwd).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, -Math.sin(tilt)).normalize();
      _x.crossVectors(_y, _z).normalize();
      _m.makeBasis(_x, _y, _z).scale(_a.set(r * scale, r * scale, r * scale)).setPosition(c.x, c.y + lift * r, c.z);
      kit.cap.add(_m, color);
    };

    sphere(c, 1, 1.05, 1, L.skin);
    const hs = L.hair, hc = L.hairColor;
    if (hs === 'afro') sphere(at(-0.15, 0, 0.25), 1.45, 1.35, 1.45, hc);
    else if (hs !== 'bald') capAt(1.07, hc);
    if (hs === 'mullet') sphere(at(-0.75, 0, -0.75), 0.6, 0.9, 0.5, hc);
    if (hs === 'ponytail') sphere(at(-1.05, 0, -0.3), 0.4, 0.95, 0.4, hc);
    if (hs === 'bun') sphere(at(-0.55, 0, 0.85), 0.5, 0.45, 0.5, hc);
    if (hs === 'spiky') for (let i = -2; i <= 2; i++) sphere(at(-0.1, i * 0.32, 1.0), 0.22, 0.5, 0.22, hc);
    if (ex.beard) sphere(at(0.55, 0, -0.5), 0.75, 0.5, 0.55, ex.beard);
    if (ex.mustache) sphere(at(0.92, 0, -0.12), 0.45, 0.14, 0.18, ex.mustache);
    if (ex.glasses) sphere(at(0.88, 0, 0.18), 0.8, 0.2, 0.18, ex.glasses);
    if (ex.headband) { _m.makeBasis(side, UP, fwd).scale(_a.set(r * 1.04, r * 0.28, r * 1.04)).setPosition(c.x, c.y + 0.25 * r, c.z); kit.cyl.add(_m, ex.headband); }
    if (ex.visor) {
      _m.makeBasis(side, UP, fwd).scale(_a.set(r * 1.05, r * 0.26, r * 1.05)).setPosition(c.x, c.y + 0.3 * r, c.z); kit.cyl.add(_m, ex.visor);
      const v = at(0.95, 0, 0.25); _m.makeBasis(side, UP, fwd).scale(_a.set(r * 0.7, r * 0.08, r * 0.55)).setPosition(v.x, v.y, v.z); kit.cyl.add(_m, ex.visor);
    }
    if (ex.cap) {
      capAt(1.1, ex.cap, 0, 0.12);
      const v = at(ex.capBack ? -1.0 : 1.0, 0, 0.18); _m.makeBasis(side, UP, fwd).scale(_a.set(r * 0.75, r * 0.08, r * 0.6)).setPosition(v.x, v.y, v.z); kit.cyl.add(_m, ex.cap);
    }
    // Sombreros comprados en la tienda, uno sobre otro
    let h = c.y + r * 0.9;
    for (let k = 0; k < part.hats; k++) {
      _m.makeScale(r * 1.35, r * 0.12, r * 1.35).setPosition(c.x, h, c.z); kit.cyl.add(_m, HAT_COLORS[k % 5]);
      _m.makeScale(r * 0.75, r * 0.95, r * 0.75).setPosition(c.x, h + r * 0.5, c.z); kit.cyl.add(_m, HAT_COLORS[k % 5]);
      h += r * 1.05;
    }
  }

  paddle(kit, part, T, K) {
    const hand = T(part.hand, new Vector3()), neck = T(part.neck, new Vector3()), pc = T(part.center, new Vector3());
    const tip = T(part.face[0], new Vector3()), sideP = T(part.face[Math.round(part.face.length / 4)], new Vector3());
    this.bone(kit, hand, neck, 1.2 * K, '#11151b');
    // Cara: disco orientado con el largo (hacia la punta) y el ancho de la pala
    const halfLen = _z.subVectors(tip, pc).length();
    const half = new Vector3().subVectors(sideP, pc);
    const wd = half.length();
    const lenDir = _z.clone().normalize();
    const normal = new Vector3().crossVectors(lenDir, half).normalize();
    const wDir = new Vector3().crossVectors(lenDir, normal).normalize();
    _m.makeBasis(lenDir, normal, wDir).scale(_a.set(halfLen + 0.9, 1.1, wd + 0.9)).setPosition(pc.x, pc.y, pc.z);
    kit.cyl.add(_m, part.paddle.rim);
    _m.makeBasis(lenDir, normal, wDir).scale(_a.set(halfLen, 1.6, wd)).setPosition(pc.x, pc.y, pc.z);
    kit.cyl.add(_m, part.paddle.face);
    _m.makeScale(1.5 * K * part.ps, 1.5 * K * part.ps, 1.5 * K * part.ps).setPosition(pc.x + normal.x * 0.9, pc.y + normal.y * 0.9, pc.z + normal.z * 0.9);
    kit.sph.add(_m, part.dot);
  }

  trail(mesh, tips, T) { updateTrail(mesh, tips, T); }
}

// Estela blanca del barrido de la pala: una banda de 8 tramos que se actualiza cada cuadro
export function makeTrail() {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(8 * 2 * 3), 3).setUsage(DynamicDrawUsage));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(8 * 2 * 4), 4).setUsage(DynamicDrawUsage));
  const idx = [];
  for (let k = 0; k < 7; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
  geo.setIndex(idx);
  const m = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }));
  m.frustumCulled = false;
  return m;
}

export function updateTrail(mesh, tips, T) {
  if (!tips || tips.length < 2) { mesh.visible = false; return; }
  mesh.visible = true;
  const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
  const n = Math.min(8, tips.length);
  for (let i = 0; i < 8; i++) {
    const t = tips[Math.min(i, n - 1)];
    T(t.tip, _a); T(t.pc, _b);
    pos.setXYZ(i * 2, _a.x, _a.y, _a.z);
    pos.setXYZ(i * 2 + 1, _b.x, _b.y, _b.z);
    const al = i < n ? 0.07 + 0.3 * i / n : 0;
    col.setXYZW(i * 2, 0.92, 0.96, 1, al);
    col.setXYZW(i * 2 + 1, 0.92, 0.96, 1, al * 0.4);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
}
