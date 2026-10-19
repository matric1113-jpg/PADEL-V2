import { Matrix3, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { VIEW_H, VIEW_W } from '../core/constants.js';

// ---------- Cámara Three.js equivalente a la de view/camera.js ----------
// Ejes: el mundo del juego es (x, y, z) con z hacia arriba; en Three.js es (x, altura, y).
// La proyección se arma a mano con los mismos números (C, f, r, u, F, cx, cy) para que cada
// punto caiga en el mismo píxel de VIEW (1280×720) que P(). Así apuntar no cambia.
// La prueba está en scripts/test-camera.mjs (npm run test:camera).

export const NEAR = 20, FAR = 40000;

export function newCamera() {
  const c = new PerspectiveCamera();
  c.matrixAutoUpdate = false;   // se arma completa en applyCam
  return c;
}

// Giro de Atlas y sacudida como en setWorldTransform (render 2D), en píxeles de VIEW:
// (x, y) → (a·x + b·y + c, d·x + e·y + f)
function viewAffine(view, sx, sy) {
  const k = view ? view.k : 1, rot = view ? view.rot : 0, oy = view ? view.oy : 0;
  const cs = Math.cos(rot) * k, sn = Math.sin(rot) * k;
  const W2 = VIEW_W / 2, H2 = VIEW_H / 2;
  return new Matrix3().set(
    cs, -sn, W2 + sx - cs * W2 + sn * H2,
    sn, cs, H2 + oy + sy - sn * W2 - cs * H2,
    0, 0, 1
  );
}

const PIX_TO_NDC = new Matrix3().set(2 / VIEW_W, 0, -1, 0, -2 / VIEW_H, 1, 0, 0, 1);
const NDC_TO_PIX = PIX_TO_NDC.clone().invert();

// cam: { C, f, r, u, F, cx, cy } de fitCam. view: fx.view ({ rot, oy, k }). sx, sy: sacudida.
export function applyCam(camera, cam, view = null, sx = 0, sy = 0) {
  const { C, f, r, u, F, cx, cy } = cam;
  // Posición y orientación: columnas derecha, arriba y atrás (-adelante), con y↔z intercambiados
  const m = camera.matrix;
  m.set(
    r.x, u.x, -f.x, C.x,
    r.z, u.z, -f.z, C.z,
    r.y, u.y, -f.y, C.y,
    0, 0, 0, 1
  );
  camera.matrixWorld.copy(m);
  camera.matrixWorldInverse.copy(m).invert();
  m.decompose(camera.position, camera.quaternion, camera.scale);

  // Proyección descentrada: píxel = (cx + F·x/d, cy − F·y/d), d = profundidad
  const base = new Matrix4().set(
    2 * F / VIEW_W, 0, 1 - 2 * cx / VIEW_W, 0,
    0, 2 * F / VIEW_H, 2 * cy / VIEW_H - 1, 0,
    0, 0, -(FAR + NEAR) / (FAR - NEAR), -2 * FAR * NEAR / (FAR - NEAR),
    0, 0, -1, 0
  );
  // La vista 2D (giro/sacudida) se aplica después, en coordenadas de pantalla
  const a = new Matrix3().multiplyMatrices(PIX_TO_NDC, viewAffine(view, sx, sy)).multiply(NDC_TO_PIX).elements;   // column-major
  const post = new Matrix4().set(
    a[0], a[3], 0, a[6],
    a[1], a[4], 0, a[7],
    0, 0, 1, 0,
    0, 0, 0, 1
  );
  camera.projectionMatrix.multiplyMatrices(post, base);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.userData.forward = new Vector3(f.x, f.z, f.y);
  return camera;
}

// Mundo (x, y, altura) → píxel de VIEW, con la cámara Three.js
export function projectPoint(camera, x, y, h) {
  const v = new Vector3(x, h, y).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  return { x: (v.x + 1) * VIEW_W / 2, y: (1 - v.y) * VIEW_H / 2 };
}

// Píxel de VIEW → punto del suelo (altura 0), con la cámara Three.js. null si mira sobre el horizonte.
export function screenToGround(camera, sx, sy) {
  const nx = sx / VIEW_W * 2 - 1, ny = 1 - sy / VIEW_H * 2;
  const p0 = new Vector3(nx, ny, -1).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  const p1 = new Vector3(nx, ny, 1).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  const dir = p1.sub(p0);
  dir.divideScalar(dir.dot(camera.userData.forward));   // componente hacia adelante = 1, como en unprojectGround
  if (dir.y > -1e-4) return null;
  const t = -p0.y / dir.y;
  return { x: p0.x + t * dir.x, y: p0.z + t * dir.z };
}
