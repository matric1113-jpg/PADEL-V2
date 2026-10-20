import {
  BoxGeometry, Color, ConeGeometry, CylinderGeometry, DynamicDrawUsage, Euler, Group, InstancedMesh, Matrix4, Mesh,
  MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3
} from 'three';
import { COURT } from '../core/constants.js';
import { fx } from '../view/fx.js';
import { mergeStatic } from './merge.js';
import { seeded } from './noise.js';

// ---------- Público alrededor de la cancha (mismas ubicaciones y estilos que el 2D) ----------
const CROWD_STYLE = {
  chile: r => r.pick([['#d52b1e', '#ffffff'], ['#c8102e', '#111111'], ['#1f3f99', '#d52b1e'], ['#f4f4f4', '#111111']]),
  brasil: r => r.pick([['#ffdf00', '#1fa34a'], ['#1fa34a', '#ffdf00'], ['#2b6fd6', '#ffffff'], ['#ffffff', '#1fa34a']]),
  china: r => r.pick([['#c8102e', '#ffcc33'], ['#ffcc33', '#c8102e'], ['#222222', '#c8102e'], ['#f4f4f4', '#c8102e']]),
  altura: r => r.pick([['#f4b400', '#333333'], ['#e53935', '#333333'], ['#1e88e5', '#ffffff'], ['#43a047', '#ffffff']]),
  atlas: () => ['#f6f2e8', '#ffd54a'],
  crater: r => (r() < 0.5 ? ['bone', '#e8e2d0'] : ['devil', '#c62828'])
};
const SKINS = ['#e9c09b', '#c9935f', '#8a5a3c', '#f2d2b6', '#b07a52'];
const UMBRELLAS = ['#ff5252', '#ffd740', '#40c4ff', '#69f0ae'];

const _m = new Matrix4(), _q = new Quaternion(), _ql = new Quaternion(), _p = new Vector3(), _s = new Vector3(), _e = new Euler(), _c = new Color();

function seats() {
  const out = [];
  for (let row = 0; row < 3; row++) {
    const y = -36 - row * 38;
    for (let x = 64; x < 860; x += 24) out.push({ x: x + (row % 2) * 12, y, z: row * 14 });
  }
  for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
    const x = side < 0 ? 22 - row * 34 : 898 + row * 34;
    for (let y = 70; y < 460; y += 28) out.push({ x, y: y + (row % 2) * 14, z: row * 14 });
  }
  return out;
}

export class Crowd {
  constructor() {
    this.group = new Group();
    const mat = new MeshStandardMaterial({ color: '#fff', roughness: 0.7 });
    const glow = new MeshStandardMaterial({ color: '#ffd54a', emissive: '#ffcc33', emissiveIntensity: 0.9, roughness: 0.4 });
    const mk = (geo, m, max) => {
      const im = new InstancedMesh(geo, m, max);
      im.instanceMatrix.setUsage(DynamicDrawUsage);
      im.setColorAt(0, _c.set('#fff'));
      im.frustumCulled = false;
      this.group.add(im);
      return im;
    };
    this.batches = {
      sph: mk(new SphereGeometry(1, 12, 9), mat, 1200),
      cyl: mk(new CylinderGeometry(1, 1, 1, 12), mat, 300),
      cone: mk(new ConeGeometry(1, 1, 8), mat, 300),
      cap: mk(new SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat, 100),
      halo: mk(new TorusGeometry(1, 0.18, 6, 20), glow, 200)
    };
    // Gradas
    this.stands = new Group();
    const standMat = new MeshStandardMaterial({ color: '#3c424c', roughness: 0.85 });
    for (let row = 0; row < 3; row++) {
      const h = row * 14 + 3;
      const b = new Mesh(new BoxGeometry(816, h, 30), standMat);
      b.position.set(464, h / 2 - 3, -36 - row * 38);
      b.receiveShadow = true;
      this.stands.add(b);
    }
    for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
      const h = row * 14 + 3;
      const b = new Mesh(new BoxGeometry(30, h, 420), standMat);
      b.position.set(side < 0 ? 22 - row * 34 : 898 + row * 34, h / 2 - 3, 272);
      b.receiveShadow = true;
      this.stands.add(b);
    }
    this.stands = mergeStatic(this.stands);
    this.group.add(this.stands);
    this.people = [];
  }

  setMap(id) {
    const rnd = seeded(4242);
    rnd.pick = a => a[Math.floor(rnd() * a.length)];
    const style = CROWD_STYLE[id] || CROWD_STYLE.chile;
    this.stands.visible = id !== 'atlas';    // en Atlas los ángeles flotan sobre las nubes
    this.people = [];
    for (const s of seats()) {
      if (rnd() < 0.18) continue;            // asientos vacíos
      const [shirt, accent] = style(rnd);
      const bone = shirt === 'bone', devil = shirt === 'devil';
      const items = [];
      const add = (b, o, sc, col, rot) => items.push({ b, o, sc, col, rot });
      // Cuerpo, franja y cabeza (la altura sobre la grada es la del 2D: cuerpo a +20, cabeza a +38)
      add('sph', [0, 0, 20], [7.5 * (bone ? 0.75 : 1), 10, 6], bone ? '#e8e2d0' : devil ? '#b71c1c' : shirt);
      if (!bone && !devil) add('cyl', [0, 0, 22], [7.3, 2.4, 5.9], accent);
      if (bone) for (const u of [16, 20, 24]) add('cyl', [0.5, 0, u], [5.2, 0.8, 4.4], '#6d665a');
      add('sph', [0, 0, 38], [5.4, 5.4, 5.4], bone ? '#efe9da' : devil ? '#d32f2f' : rnd.pick(SKINS));
      if (bone) for (const sd of [-1.8, 1.8]) add('sph', [4.6, sd, 38.5], [1.2, 1.2, 1.2], '#222222');
      if (devil) for (const sd of [-1, 1]) add('cone', [0, sd * 3.2, 44], [1.5, 6, 1.5], '#ffcc80', [0, 0, sd * 0.35]);
      if (id === 'atlas') {
        for (const sd of [-1, 1]) add('sph', [-4, sd * 10, 25], [11, 7, 1.4], '#ffffff', [0, 0, -sd * 0.5]);
        add('halo', [0, 0, 46], [5, 5, 5], '#ffd54a', [Math.PI / 2, 0, 0]);
      }
      if (id === 'brasil' && rnd() < 0.2) {
        add('cyl', [0, 3, 50], [0.6, 22, 0.6], '#dddddd');
        add('cap', [0, 3, 60], [16, 6, 16], rnd.pick(UMBRELLAS));
      }
      // Mira hacia el centro de la cancha
      const yaw = Math.atan2(COURT.midY - s.y, COURT.netX - s.x);
      this.people.push({ ...s, yaw, ph: rnd() * Math.PI * 2, sp: 0.7 + rnd() * 0.6, team: s.x < COURT.netX ? 0 : 1, items, float: id === 'atlas' });
    }
  }

  update(now) {
    const celeb = fx.celeb;
    for (const k in this.batches) this.batches[k].count = 0;
    const t = now * 0.001;
    for (const p of this.people) {
      let bob = Math.sin(t * 2.2 * p.sp + p.ph) * 0.8;
      if (p.float) bob += Math.sin(t * 0.9 + p.ph) * 4 + 6;
      // En una celebración salta el público del lado del equipo que ganó el punto
      if (celeb && (celeb.team === p.team || p.y < 0)) bob += Math.abs(Math.sin(t * 9 * p.sp + p.ph)) * 7;
      // Base (lado, arriba, adelante): derecha, con adelante = hacia la cancha
      const fx_ = Math.cos(p.yaw), fy_ = Math.sin(p.yaw);
      _m.makeBasis(_p.set(fy_, 0, -fx_), _s.set(0, 1, 0), new Vector3(fx_, 0, fy_));
      _q.setFromRotationMatrix(_m);
      for (const it of p.items) {
        const im = this.batches[it.b];
        if (im.count >= im.instanceMatrix.count) continue;
        const [f, sd, u] = it.o;
        _p.set(p.x + fx_ * f + fy_ * sd, p.z + u + bob, p.y + fy_ * f - fx_ * sd);
        if (it.rot) _ql.setFromEuler(_e.set(it.rot[0], it.rot[1], it.rot[2])); else _ql.identity();
        // Escala: x = lado, y = alto, z = adelante
        _m.compose(_p, _ql.premultiply(_q), _s.set(it.sc[0], it.sc[1], it.sc[2]));
        im.setMatrixAt(im.count, _m);
        im.setColorAt(im.count, _c.set(it.col));
        im.count++;
      }
    }
    for (const k in this.batches) {
      this.batches[k].instanceMatrix.needsUpdate = true;
      if (this.batches[k].instanceColor) this.batches[k].instanceColor.needsUpdate = true;
    }
  }
}
