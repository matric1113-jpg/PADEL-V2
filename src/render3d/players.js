import { Group, InstancedMesh, Matrix4, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { state } from '../core/state.js';
import { actOn, upLvl } from '../core/stats.js';
import { fx } from '../view/fx.js';
import { CELEB_KIND, SHADOW_LOOK_COLORS, TEAM_COLORS, buildPlayerParts, lookOf, scaleOf } from '../view/skeleton.js';
import { assets, loadCharacterAssets } from './char/assets.js';
import { Character, MODEL_U, genderOf } from './char/character.js';
import { SimplePlayers, makeTrail, updateTrail } from './players-simple.js';

// ---------- Jugadores: personajes 3D animados (Quaternius) ----------
// view/skeleton.js sigue decidiendo cada cuadro la pose (hacia dónde mira, carga, golpe, celebración, saltos).
// Aquí ese esqueleto de palitos solo entrega las órdenes: dónde van las manos, cuánto gira el tronco, qué tan
// rápido corre. El modelo las ejecuta (char/character.js). La animación es solo visual: cuándo ocurre el golpe
// lo decide la física, igual que antes.
// Mientras cargan los modelos (o si fallan) se dibujan las figuras simples de players-simple.js.

const CLONE_LOOK = { ...SHADOW_LOOK_COLORS, extras: {} };
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3();

export class Players {
  constructor() {
    this.group = new Group();
    this.simple = new SimplePlayers();
    this.group.add(this.simple.group);
    this.live = new Group();
    this.live.visible = false;
    this.group.add(this.live);
    this.slots = [null, null, null, null];     // personaje de cada jugador
    this.cloneSlots = [null, null, null, null];  // su clon de sombra
    this.trails = [];
    for (let i = 0; i < 8; i++) { const m = makeTrail(); m.visible = false; this.trails.push(m); this.live.add(m); }
    // Nube de Zeus
    this.cloud = new InstancedMesh(new SphereGeometry(1, 12, 8), new MeshStandardMaterial({ color: '#f0f6ff', roughness: 0.9 }), 20);
    this.cloud.frustumCulled = false;
    this.live.add(this.cloud);
    loadCharacterAssets().catch(() => {});
  }

  // Devuelve el personaje de un lugar, creándolo (o rehaciéndolo si cambia de género) cuando hace falta
  char(list, idx, gender, ghost) {
    let c = list[idx];
    if (!c || c.gender !== gender) {
      if (c) this.live.remove(c.root);
      c = new Character(gender, { ghost });
      list[idx] = c;
      this.live.add(c.root);
    }
    return c;
  }

  // Arma los esqueletos del cuadro y los dibuja. Devuelve los esqueletos (los usa el HUD).
  update(dt, now, inReplay) {
    const players = state.players;
    const celebKind = p => CELEB_KIND[p.lookId] || 'fist';
    const built = players.map((p, idx) => p.out ? null : buildPlayerParts(p, idx, dt * (inReplay ? 0.45 : 1), now, fx.players[idx],
      fx.celeb && !inReplay && p.team === fx.celeb.team ? { celeb: { kind: celebKind(p), t: fx.celeb.t } } : {}));

    if (!assets.ready) {
      this.live.visible = false;
      this.simple.group.visible = true;
      return this.simple.update(dt, now, inReplay);
    }
    this.simple.group.visible = false;
    this.live.visible = true;

    const dtSec = dt / 60 * (inReplay ? 0.45 : 1);
    let trail = 0, cloudN = 0;
    const cloudM = new Matrix4();
    players.forEach((p, idx) => {
      const c = this.slots[idx], cc = this.cloneSlots[idx];
      if (p.out) { if (c) c.root.visible = false; if (cc) cc.root.visible = false; return; }
      const gender = genderOf(p.lookId);
      const ch = this.char(this.slots, idx, gender, false);
      ch.root.visible = true;
      const b = built[idx];
      ch.update(this.frame(p, b, dtSec, p.x, p.y));
      this.trail(this.trails[trail++], p, b);
      if (b.cloud) {
        // Zeus remata parado sobre una nube
        for (const [dx, dy, r] of [[-12, 0, 9], [0, -3, 12], [12, 0, 9], [0, 5, 9], [-6, 4, 8]]) {
          cloudM.makeScale(r, r * 0.55, r).setPosition(p.x + dx, 6, p.y + dy);
          this.cloud.setMatrixAt(cloudN++, cloudM);
        }
      }
      if (p.clone) {
        const base = lookOf(p);
        const look = { ...base, ...CLONE_LOOK };
        const fake = { ...p, x: p.clone.x, y: p.clone.y, clone: null };
        const bc = buildPlayerParts(fake, idx, dt, now, fx.clones[idx], { look });
        const g = this.char(this.cloneSlots, idx, gender, true);
        g.root.visible = true;
        g.update(this.frame(fake, bc, dtSec, fake.x, fake.y));
        this.trail(this.trails[trail++], fake, bc);
      } else if (cc) cc.root.visible = false;
    });
    for (; trail < this.trails.length; trail++) this.trails[trail].visible = false;
    this.cloud.count = cloudN;
    this.cloud.instanceMatrix.needsUpdate = true;
    return built;
  }

  // Esqueleto de palitos (mundo del juego) -> Three.js: (x, y, z del juego) = (x, altura, y)
  mapper(p, b) {
    const K = scaleOf(p);
    const Kz = K * b.look.body.h * (1 + 0.03 * upLvl(p, 'estiron')) * (actOn(p, 'gordo') ? 1.2 : 1);
    const jz = b.jumpZ || 0;
    return { K, Kz, jz, T: (v, out) => out.set(p.x + (v.x - p.x) * K, v.z * Kz + jz, p.y + (v.y - p.y) * K) };
  }

  trail(mesh, p, b) {
    const { T } = this.mapper(p, b);
    updateTrail(mesh, b.pf.tips, T);
  }

  // Todo lo que el personaje necesita saber del cuadro (ver char/character.js)
  frame(p, b, dtSec, x, y) {
    const { K, Kz, jz, T } = this.mapper(p, b);
    const R = b.rig, pf = b.pf;
    const v = (vec) => T(vec, new Vector3());
    const pd = R.paddle;
    const hand = v(pd.hand), center = v(pd.center), tip = v(pd.tip), side = v(pd.side);
    const dir = _a.subVectors(center, hand).normalize().clone();
    const half = _b.subVectors(side, center);
    const normal = _c.crossVectors(dir, half).normalize().clone();
    const sp = Math.hypot(pf.vx, pf.vy);
    const body = b.look.body;
    return {
      dt: dtSec, lookId: p.lookId,
      x, y: jz, z: y, K, Kz, body, armK: body.arm * (1 + 0.08 * upLvl(p, 'fuerza')),
      facing: Math.atan2(Math.cos(R.th), Math.sin(R.th)),
      moveYaw: Math.atan2(pf.vx, pf.vy),
      speed: sp * 60 / (K * MODEL_U),
      charging: b.charging, cr: b.cr, kind: pf.pose.kind,
      swinging: b.swinging, swingKind: pf.swingKind, swingU: R.swingU,
      celeb: R.celeb ? { kind: R.celeb } : null,
      stun: p.stun, burn: p.burn, slow: p.slow,
      twist: R.twist,
      handR: v(R.handR), poleR: v(R.elbowR), handL: v(R.handL), poleL: v(R.elbowL),
      paddle: { show: pd.show, dir, normal, halfLen: tip.distanceTo(center), halfWid: half.length(), handleLen: pd.handleLen * K, scale: K },
      teamColor: TEAM_COLORS[p.team], up: p.up
    };
  }
}
