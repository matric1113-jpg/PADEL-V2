import { AnimationMixer, Color, Group, LoopOnce, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LOOKS } from '../../core/data.js';
import { angleDiff, clamp, lerp } from '../../core/util.js';
import { assets } from './assets.js';
import { CLIPS, LOOP_NAMES, ONE_SHOT_NAMES, planClips } from './clips.js';
import { makeBodyMaterial, makeHairMaterial, plainMaterial, setHairColor, setSkin } from './materials.js';
import * as P from './pieces.js';
import { computeRegions } from './regions.js';
import { AXIS_X, Rig } from './rig.js';

// ---------- Un personaje 3D: cuerpo del pack, ropa por zonas, piezas sobre los huesos y animación ----------
// Es independiente del juego: se alimenta con un "cuadro" (ver update) que arma render3d/players.js.

export const MODEL_U = 76 / 1.82;                // unidades de mundo por metro del modelo (a escala 1): mide lo mismo que el esqueleto de palitos
const FEMALE = new Set(['gladys', 'nena', 'capitana']);
export const genderOf = lookId => (FEMALE.has(lookId) ? 'mujer' : 'hombre');

// Peinado del LOOK -> pieza del pack (pelo.glb) y piezas propias
const HAIR_PIECE = {
  hombre: { short: 'Hair_Buzzed', side: 'Hair_SimpleParted', slick: 'Hair_SimpleParted', cap: 'Hair_Buzzed', mullet: 'Hair_SimpleParted', spiky: 'Hair_Buzzed', ponytail: 'Hair_Buzzed', bun: 'Hair_Buzzed' },
  mujer: { short: 'Hair_BuzzedFemale', side: 'Hair_Long', slick: 'Hair_Long', cap: 'Hair_BuzzedFemale', mullet: 'Hair_Long', spiky: 'Hair_BuzzedFemale', ponytail: 'Hair_BuzzedFemale', bun: 'Hair_Buns' }
};

const prepared = {};
function prepare(gender) {
  if (prepared[gender]) return;
  const scene = assets.body[gender];
  scene.updateMatrixWorld(true);
  scene.traverse(o => { if (o.isSkinnedMesh && /^super/i.test(o.name)) computeRegions(o); });
  prepared[gender] = true;
}

const _v = new Vector3(), _v2 = new Vector3(), _v3 = new Vector3(), _m = new Matrix4(), _m2 = new Matrix4();
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class Character {
  constructor(gender, { ghost = false } = {}) {
    prepare(gender);
    this.gender = gender;
    this.ghost = ghost;
    this.root = new Group();
    this.model = cloneSkinned(assets.body[gender]);
    this.root.add(this.model);
    this.bones = {};
    this.model.traverse(o => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) {
        o.frustumCulled = false;
        o.castShadow = true;
        o.receiveShadow = true;
        if (/^super/i.test(o.name)) this.bodyMesh = o;
        else if (o.name === 'Eyes') this.eyes = o;
        else if (o.name === 'Eyebrows') this.brows = o;
        if (o !== this.bodyMesh) o.castShadow = false;
      }
    });
    this.bodyMat = makeBodyMaterial(this.bodyMesh.material, gender);
    this.bodyMesh.material = this.bodyMat;
    this.brows.material = plainMaterial('#2b1d14', { roughness: 0.9 });
    this.eyesMat = this.eyes.material;

    // Marco de la cabeza en pose de descanso (los modelos vienen en pose de reposo)
    this.model.updateMatrixWorld(true);
    this.eyes.geometry.computeBoundingBox();
    this.eyeY = (this.eyes.geometry.boundingBox.min.y + this.eyes.geometry.boundingBox.max.y) / 2;
    this.headC = new Vector3(0, this.eyeY + 0.033, -0.012);
    this.rest = {};
    for (const n of ['Head', 'spine_01', 'spine_03', 'hand_r']) this.rest[n] = this.bones[n].matrixWorld.clone().invert();
    const maleScene = assets.body.hombre;
    this.pelvisShift = this.bones.pelvis.position.z - maleScene.getObjectByName('pelvis').position.z;

    // Ojos y cejas siguen solo a la cabeza: como piezas rígidas ahorran dos esqueletos por personaje
    this.faceHolder = this.holder('Head');
    for (const key of ['eyes', 'brows']) {
      const sk = this[key];
      const m = new Mesh(sk.geometry, sk.material);
      sk.parent.remove(sk);
      this.faceHolder.add(m);
      this[key] = m;
    }

    this.rig = new Rig(this.model, this.bones);
    this.headHolder = this.holder('Head');
    this.headPieces = this.holder('Head', _m.makeTranslation(this.headC.x, this.headC.y, this.headC.z));
    this.beltHolder = this.holder('spine_01');
    this.medal = P.makeMedal();
    this.medal.visible = false;
    this.holder('spine_03').add(this.medal);
    this.paddle = P.makePaddle();
    this.bones.hand_r.add(this.paddle.group);
    this.paddle.group.matrixAutoUpdate = false;
    this.belly = new Mesh(new SphereGeometry(1, 20, 14), plainMaterial('#fff'));
    this.belly.castShadow = true;
    this.belly.position.set(0, 1.12, 0.085);
    this.beltHolder.add(this.belly);

    // Mixer: un clip en bucle por estado, todos corriendo a la vez con peso 0 y mezclados cada cuadro
    this.mixer = new AnimationMixer(this.model);
    this.actions = {};
    for (const name of LOOP_NAMES) {
      const a = this.mixer.clipAction(assets.clips[CLIPS[name]]);
      a.play(); a.setEffectiveWeight(0);
      a.time = Math.random() * a.getClip().duration;
      this.actions[name] = a;
    }
    for (const name of ONE_SHOT_NAMES) {
      const a = this.mixer.clipAction(assets.clips[CLIPS[name]]);
      a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveWeight(0);
      this.actions[name] = a;
    }
    this.cur = Object.fromEntries(LOOP_NAMES.map(n => [n, 0]));
    this.cur.idle = 1;
    this.yaw = 0;
    this.yawInit = false;
    this.lastStun = 0; this.lastBurn = 0;
    this.wL = 0;                      // peso del IK del brazo libre
    this.time = Math.random() * 100;
    this.dressedKey = null;
    this.hatCount = -1;
    this.ghostMat = null;
    if (ghost) {
      this.ghostMat = new MeshStandardMaterial({ color: '#4b3a7a', roughness: 0.5, transparent: true, opacity: 0.78, emissive: '#5a33b8', emissiveIntensity: 0.55 });
    }
  }

  // Grupo pegado a un hueso en pose de descanso: lo que se agregue queda en su lugar de reposo y sigue al hueso
  holder(boneName, extra) {
    const g = new Group();
    g.matrixAutoUpdate = false;
    g.matrix.copy(this.rest[boneName]);
    if (extra) g.matrix.multiply(extra);
    this.bones[boneName].add(g);
    return g;
  }
  clearHolder(g) {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse(o => { if (o.isMesh && o.userData.own) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } });
    }
  }

  // Colores y piezas del personaje. Se llama al cambiar de look.
  dress(lookId) {
    if (this.dressedKey === lookId) return;
    this.dressedKey = lookId;
    const look = LOOKS[lookId] || LOOKS.fernando;
    this.look = look;
    const u = this.bodyMat.userData.uniforms;
    setSkin(this.bodyMat, look.skin);
    u.uShirt.value.set(look.shirt); u.uShorts.value.set(look.shorts);
    u.uSock.value.set(look.socksDark ? '#2b2b2b' : '#eef2f6');
    u.uShoe.value.set(look.shoes); u.uBandR.value.set(look.band); u.uBandL.value.set(look.band);
    u.uTank.value = look.tank ? 1 : 0;
    u.uSockStart.value = look.socksHigh ? 0.3 : 0.72;
    this.brows.material.color.set(look.hairColor);
    this.belly.material.color.set(look.shirt);
    this.paddle.setLook(look);

    this.clearHolder(this.headHolder); this.clearHolder(this.headPieces);
    const ex = look.extras || {};
    const hs = look.hair;
    const own = o => { o.traverse(c => { if (c.isMesh) c.userData.own = true; }); return o; };
    const piece = name => {
      const src = assets.hair.getObjectByName(name);
      const m = src.clone();
      m.material = makeHairMaterial(src.material, look.hairColor);
      m.castShadow = true;
      m.userData.own = true;
      m.material.userData.own = true;
      return m;
    };
    const base = HAIR_PIECE[this.gender][hs];
    if (base) this.headHolder.add(piece(base));
    if (ex.beard && this.gender === 'hombre') this.headHolder.add(piece('Hair_Beard'));
    const add = o => this.headPieces.add(own(o));
    if (hs === 'afro') add(P.afro(look.hairColor));
    if (hs === 'curly') add(P.curls(look.hairColor));
    if (hs === 'spiky') add(P.spikes(look.hairColor));
    if (hs === 'mullet') add(P.tail(look.hairColor, 0.1, 0.1));
    if (hs === 'ponytail') add(P.tail(look.hairColor, 0.16, 0.16));
    if (ex.mustache) add(P.mustache(ex.mustache, this.eyeY - this.headC.y));
    if (ex.glasses) add(P.glasses(ex.glasses, this.eyeY - this.headC.y));
    if (ex.headband) add(P.headband(ex.headband));
    if (ex.visor) add(P.visor(ex.visor));
    if (ex.cap) add(P.cap(ex.cap, !!ex.capBack));
    this.hatCount = -1;
    if (this.ghost) this.applyGhost();
  }

  applyGhost() {
    this.model.traverse(o => { if (o.isMesh && o !== this.eyes) o.material = this.ghostMat; });
    this.headHolder.traverse(o => { if (o.isMesh) o.material = this.ghostMat; });
    this.headPieces.traverse(o => { if (o.isMesh) o.material = this.ghostMat; });
    this.paddle.group.traverse(o => { if (o.isMesh) o.material = this.ghostMat; });
    this.belly.material = this.ghostMat;
    this.eyes.visible = false;
  }

  setHats(n) {
    if (n === this.hatCount) return;
    this.hatCount = n;
    if (this.hats) { this.headPieces.remove(this.hats); this.hats.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); this.hats = null; }
    if (n > 0) { this.hats = P.hats(n); this.headPieces.add(this.hats); if (this.ghost) this.hats.traverse(o => { if (o.isMesh) o.material = this.ghostMat; }); }
  }

  // ----- Cuadro -----
  // f: ver render3d/players.js (qué entrega cada campo)
  update(f) {
    const dt = f.dt;
    this.time += dt;
    this.dress(f.lookId);
    const look = this.look;

    // Orientación del cuerpo: mira hacia donde corre; al cargar, golpear o celebrar mira hacia donde apunta el esqueleto
    const busy = f.charging || f.swinging || f.celeb || f.stun > 0 || f.cry;
    const runK = ss(1.2, 2.4, f.speed);
    let target = f.facing;
    if (!busy && runK > 0) target = f.facing + angleDiff(f.moveYaw, f.facing) * runK;
    else if (f.charging && !f.swinging && runK > 0) target = f.facing + angleDiff(f.moveYaw, f.facing) * runK * 0.5;
    if (!this.yawInit) { this.yaw = target; this.yawInit = true; }
    this.yaw += angleDiff(target, this.yaw) * clamp((f.swinging ? 0.45 : 0.2) * dt * 60, 0, 1);

    // Físico desde LOOKS: ancho = escala lateral del modelo; alto = escala vertical; brazos y piernas = grosor de los huesos
    const body = f.body;
    const wK = 1 + (body.w - 1) * 0.9;
    // Zurdo: el modelo se dibuja reflejado en su eje lateral (x del modelo) y los objetivos de las manos se reflejan
    // igual (toModel), así la pose de diestro que calcula el esqueleto se ve como la de un zurdo. Solo es estético.
    this.root.scale.set((f.lefty ? -1 : 1) * f.K * MODEL_U * wK, f.Kz * MODEL_U, f.K * MODEL_U);
    const armK = 1 + (f.armK - 1) * 0.75, legK = 1 + (body.leg - 1) * 0.75;
    for (const s of ['l', 'r']) {
      this.bones['upperarm_' + s].scale.set(armK, 1, armK);
      this.bones['hand_' + s].scale.set(1 / armK, 1, 1 / armK);
      this.bones['thigh_' + s].scale.set(legK, 1, legK);
      this.bones['foot_' + s].scale.set(1 / legK, 1, 1 / legK);
    }

    // ----- Clips -----
    const plan = planClips(f);
    const k = clamp(0.2 * dt * 60, 0, 1);
    for (const name of LOOP_NAMES) {
      const a = this.actions[name];
      this.cur[name] = lerp(this.cur[name], plan.w[name], k);
      a.setEffectiveWeight(this.cur[name]);
      a.setEffectiveTimeScale(plan.ts[name]);
    }
    // Reacciones de una sola vez: golpe del rayo y sobresalto de la quemadura
    if (f.stun > 0 && !(this.lastStun > 0)) this.flinch('hitHead');
    if (f.burn > 0 && !(this.lastBurn > 0)) this.flinch('hitChest');
    this.lastStun = f.stun; this.lastBurn = f.burn;
    for (const name of ONE_SHOT_NAMES) {
      const a = this.actions[name];
      if (a.isRunning()) a.setEffectiveWeight(Math.max(0, 1 - a.time / a.getClip().duration) * 0.9);
      else a.setEffectiveWeight(0);
    }
    this.mixer.update(dt);
    this.bones.pelvis.position.z += this.pelvisShift;

    // ----- Posición en la cancha -----
    let hop = plan.jump * 0.16;
    if (f.burn > 0) hop += Math.abs(Math.sin(this.time * 17)) * 0.07;
    this.root.position.set(f.x, f.y + hop * f.Kz * MODEL_U, f.z);
    this.root.rotation.set(0, this.yaw, 0);
    if (f.stun > 0) this.root.rotation.z = Math.sin(this.time * 5) * 0.07;
    else this.root.rotation.z = 0;
    this.root.updateMatrixWorld(true);
    this.rig.begin();
    const rig = this.rig;

    // ----- Tronco -----
    if (f.cry) {
      // Llorando: encorvado, con los hombros sacudidos por los sollozos
      rig.lean(0.32 + Math.sin(this.time * 13) * 0.025);
      rig.twist(Math.sin(this.time * 2.1) * 0.06);
    } else if (f.stun > 0) {
      rig.twist(Math.sin(this.time * 4) * 0.25);
      rig.lean(0.3 + Math.sin(this.time * 3) * 0.08);
    } else {
      rig.twist(-f.twist + angleDiff(f.facing, this.yaw) * 0.0);
      if (f.kind === 'smash' && (f.charging || f.swinging)) rig.lean(-0.18 - 0.12 * (f.swinging ? 1 - f.swingU : f.cr));
      else if (f.kind === 'lob' && f.charging) rig.lean(0.08);
    }

    // ----- Brazos -----
    const toModel = (w, out) => { out.copy(w).applyMatrix4(rig.inv); if (f.lefty) out.x = -out.x; return out; };
    let tgtR, poleR, tgtL, poleL, handDir = null;
    if (f.cry) {
      // Cabeza abajo y manos a la cara: cada mano va a un ojo (en el marco de la cabeza ya inclinada)
      rig.rot('Head', AXIS_X, 0.6 + Math.sin(this.time * 9) * 0.04);
      rig.rot('neck_01', AXIS_X, 0.25);
      const hp = rig.pos(this.bones.Head, new Vector3()), hq = rig.quat(this.bones.Head, new Quaternion());
      const sob = Math.sin(this.time * 13) * 0.006;
      const eye = (s, dz) => new Vector3(s * 0.04, 0.06 + sob, 0.115 + dz).applyQuaternion(hq).add(hp);
      tgtR = eye(-1, 0.0); poleR = tgtR.clone().add(new Vector3(-0.3, -0.12, 0.08));
      tgtL = eye(1, 0.0); poleL = tgtL.clone().add(new Vector3(0.3, -0.12, 0.08));
    } else if (f.stun > 0) {
      // Brazos caídos, pala colgando
      const sway = Math.sin(this.time * 4);
      tgtR = _v.set(-0.3, 0.86, 0.1 + sway * 0.05); poleR = _v2.set(-0.5, 1.1, -0.2);
      tgtR = tgtR.clone(); poleR = poleR.clone();
      tgtL = new Vector3(0.3, 0.86, 0.05 - sway * 0.05); poleL = new Vector3(0.5, 1.1, -0.2);
    } else {
      tgtR = toModel(f.handR, new Vector3()); poleR = toModel(f.poleR, new Vector3());
      tgtL = toModel(f.handL, new Vector3()); poleL = toModel(f.poleL, new Vector3());
    }
    const wLtarget = (f.charging || f.swinging || f.celeb || f.stun > 0 || f.cry) ? 1 : 0.35;
    this.wL = lerp(this.wL, wLtarget, clamp(0.2 * dt * 60, 0, 1));
    rig.arm('l', tgtL, poleL, this.wL);
    const paddleDir = f.stun > 0 ? new Vector3(0.1, -0.95, 0.25).normalize() : _v3.copy(f.paddle.dir).transformDirection(rig.inv).clone();
    if (f.lefty && !(f.stun > 0)) paddleDir.x = -paddleDir.x;
    const reachedR = rig.arm('r', tgtR, poleR, 1, f.paddle.show || f.stun > 0 ? paddleDir : null);

    // ----- Manos -----
    const celeb = f.celeb ? f.celeb.kind : '';
    if (f.cry) { rig.curl('r', 0.25); rig.curl('l', 0.25); } else if (celeb === 'peace') rig.curl('r', 1, ['ring', 'pinky', 'thumb']);
    else if (f.paddle.show || f.stun > 0) rig.curl('r', 0.95);
    else rig.curl('r', celeb ? 0.9 : 0.3);
    if (!f.cry) rig.curl('l', celeb === 'belly' ? 0.1 : (celeb || f.charging ? 0.8 : 0.35));

    // ----- Cabeza -----
    if (f.stun > 0) rig.rot('Head', AXIS_X, 0.45 + Math.sin(this.time * 3.3) * 0.1);

    // ----- Pala y piezas -----
    this.fitPaddle(f, look);
    this.fitBelly(body, look);
    this.setHats(f.up.sombrero || 0);
    this.medal.visible = !!f.medal;
    if (f.medal && f.medal !== this.medalKind) { this.medalKind = f.medal; P.setMedalKind(this.medal, f.medal); }
    const u = this.bodyMat.userData.uniforms;
    u.uShoe.value.set(f.up.zapas ? '#ffd54a' : look.shoes);
    u.uBandR.value.set(f.up.remate ? '#ff3d00' : look.band);
    u.uBandL.value.set(f.teamColor);
    this.paddle.setDot(look.band);
    return reachedR;
  }

  // Posición en el mundo de un ojo (0 derecho, 1 izquierdo); sirve para las lágrimas. Usar después de update().
  eyeWorld(side, out) {
    out.set(side ? 0.033 : -0.033, this.eyeY, 0.09).applyMatrix4(this.rest.Head);
    return this.bones.Head.localToWorld(out);
  }

  flinch(name) {
    const a = this.actions[name];
    a.reset().play();
  }

  // La pala se coloca con las medidas y la orientación del esqueleto (view/skeleton.js), pero pegada a la mano real del modelo
  fitPaddle(f, look) {
    const pd = f.paddle;
    const g = this.paddle.group;
    g.visible = pd.show || f.stun > 0;
    if (!g.visible) return;
    const hand = this.bones.hand_r;
    // Posición de la empuñadura: la muñeca del modelo desplazada un poco hacia los dedos
    _v.setFromMatrixPosition(hand.matrixWorld);
    const dirW = f.stun > 0 ? _v2.set(0.1, -0.95, 0.25).transformDirection(this.model.matrixWorld) : _v2.copy(pd.dir);
    const normal = f.stun > 0 ? _v3.set(0, 0.25, 1).cross(dirW).normalize() : _v3.copy(pd.normal);
    if (f.lefty && !(f.stun > 0)) {
      // Zurdo: la orientación de la pala se refleja en el eje lateral del modelo, igual que las manos
      for (const v of [dirW, normal]) { v.transformDirection(this.rig.inv); v.x = -v.x; v.transformDirection(this.model.matrixWorld); }
    }
    const wDir = new Vector3().crossVectors(dirW, normal).normalize();
    _m.makeBasis(dirW, normal, wDir).setPosition(_v);
    _m2.copy(hand.matrixWorld).invert();
    g.matrix.multiplyMatrices(_m2, _m);
    g.matrixWorldNeedsUpdate = true;
    this.paddle.fit(pd.halfLen, pd.halfWid, 1.6 * pd.scale, pd.handleLen, 1.2 * pd.scale, 1.5 * pd.scale);
  }

  // Guata: esfera del color de la camiseta delante del abdomen
  fitBelly(body, look) {
    const b = body.belly;
    this.belly.visible = b > 1.1;
    if (!this.belly.visible) return;
    const e = b - 1;
    this.belly.position.set(0, 1.13 - 0.01 * e, 0.07 + 0.035 * e);
    this.belly.scale.set(0.15 + 0.06 * e, 0.13 + 0.05 * e, 0.11 + 0.07 * e);
  }
}
