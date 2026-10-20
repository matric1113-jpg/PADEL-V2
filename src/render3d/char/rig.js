import { Matrix4, Quaternion, Vector3 } from 'three';

// ---------- Ajustes procedurales sobre el esqueleto animado ----------
// Todo se resuelve en el espacio del modelo (metros, sin la escala ni el giro del personaje en la cancha), después
// de que el mixer escribió la pose de los clips: giro del tronco, IK de brazos, agarre de la mano, cabeza.
// En este rig cada hueso apunta a su hijo con su eje local +Y.

export const AXIS_X = new Vector3(1, 0, 0);
export const AXIS_Y = new Vector3(0, 1, 0);
const Y = AXIS_Y;
const _m = new Matrix4(), _p = new Vector3(), _s = new Vector3(), _q = new Quaternion(), _q2 = new Quaternion();
const _qp = new Quaternion();
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _d = new Vector3();

export class Rig {
  constructor(model, bones) {
    this.model = model;
    this.bones = bones;
    this.inv = new Matrix4();
  }

  // Llamar después de root.updateMatrixWorld() y antes de cualquier ajuste del cuadro
  begin() { this.inv.copy(this.model.matrixWorld).invert(); }

  pos(bone, out) { _m.multiplyMatrices(this.inv, bone.matrixWorld); return out.setFromMatrixPosition(_m); }
  quat(bone, out) { _m.multiplyMatrices(this.inv, bone.matrixWorld); _m.decompose(_p, out, _s); return out; }

  // Fija la rotación de un hueso dada en el espacio del modelo y actualiza el hueso y sus hijos
  setQuat(bone, qModel) {
    this.quat(bone.parent, _qp).invert().multiply(qModel);
    bone.quaternion.copy(_qp);
    bone.updateMatrixWorld(true);
  }

  // Rota un hueso para que su eje +Y apunte hacia un punto (espacio del modelo)
  aim(bone, target) {
    this.pos(bone, _a);
    this.quat(bone, _q);
    _b.copy(Y).applyQuaternion(_q);
    _c.subVectors(target, _a);
    if (_c.lengthSq() < 1e-10) return;
    _c.normalize();
    _q2.setFromUnitVectors(_b, _c).multiply(_q);
    this.setQuat(bone, _q2);
  }

  // Rotación (en el espacio del modelo) de un hueso por nombre, aplicada encima de la animación
  rot(name, axis, angle) {
    const b = this.bones[name];
    this.quat(b, _q);
    _q2.setFromAxisAngle(axis, angle).multiply(_q);
    this.setQuat(b, _q2);
  }

  // Giro alrededor del eje vertical del modelo, repartido entre los huesos de la columna
  twist(angle) {
    const parts = [['spine_01', 0.3], ['spine_02', 0.35], ['spine_03', 0.35]];
    for (const [name, k] of parts) {
      const b = this.bones[name];
      this.quat(b, _q);
      _q2.setFromAxisAngle(Y, angle * k).multiply(_q);
      this.setQuat(b, _q2);
    }
  }

  // Inclinación hacia adelante (+) o atrás (-) de la columna, alrededor del eje lateral del modelo
  lean(angle) {
    for (const [name, k] of [['spine_01', 0.3], ['spine_02', 0.35], ['spine_03', 0.35]]) {
      const b = this.bones[name];
      this.quat(b, _q);
      _q2.setFromAxisAngle(_d.set(1, 0, 0), angle * k).multiply(_q);
      this.setQuat(b, _q2);
    }
  }

  // Brazo con IK de dos huesos hacia target (espacio del modelo). pole orienta el codo. w = peso (0 clip, 1 IK).
  arm(side, target, pole, w, handDir) {
    const upper = this.bones['upperarm_' + side], lower = this.bones['lowerarm_' + side], hand = this.bones['hand_' + side];
    const saved = [upper.quaternion.clone(), lower.quaternion.clone(), hand.quaternion.clone()];
    const S = this.pos(upper, new Vector3()), E0 = this.pos(lower, new Vector3()), H0 = this.pos(hand, new Vector3());
    const L1 = S.distanceTo(E0), L2 = E0.distanceTo(H0);
    const to = new Vector3().subVectors(target, S);
    const d = Math.max(to.length(), 1e-4);
    const dd = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-3), (L1 + L2) * 0.999);
    const u = to.clone().divideScalar(d);
    const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd);
    const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
    const pv = new Vector3().subVectors(pole, S);
    pv.addScaledVector(u, -pv.dot(u));
    if (pv.lengthSq() < 1e-8) pv.copy(E0).sub(S).addScaledVector(u, -E0.clone().sub(S).dot(u));
    pv.normalize();
    const E = S.clone().addScaledVector(u, a).addScaledVector(pv, h);
    const T = S.clone().addScaledVector(u, dd);
    this.aim(upper, E);
    this.aim(lower, T);
    if (handDir) this.aim(hand, this.pos(hand, new Vector3()).add(handDir));
    if (w < 1) {
      const ik = [upper.quaternion.clone(), lower.quaternion.clone(), hand.quaternion.clone()];
      [upper, lower, hand].forEach((bn, i) => bn.quaternion.copy(saved[i]).slerp(ik[i], w));
      upper.updateMatrixWorld(true);
    }
    return T;   // punto realmente alcanzado
  }

  // Cierra los dedos de una mano (0 abierta, 1 puño). only: lista de dedos que sí se cierran.
  curl(side, amount, only) {
    const fingers = only || ['index', 'middle', 'ring', 'pinky', 'thumb'];
    for (const f of fingers) {
      for (let i = 1; i <= 3; i++) {
        const b = this.bones[`${f}_0${i}_${side}`];
        if (!b) continue;
        const k = f === 'thumb' ? 0.55 : (i === 1 ? 0.85 : 1);
        b.quaternion.multiply(_q.setFromAxisAngle(f === 'thumb' ? _d.set(0, 1, 0) : _d.set(1, 0, 0), amount * k * (side === 'l' ? 1 : -1) * (f === 'thumb' ? -1 : 1)));
      }
    }
  }
}
