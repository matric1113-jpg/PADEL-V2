import {
  BoxGeometry, CapsuleGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, IcosahedronGeometry,
  InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Shape, SphereGeometry, TorusGeometry, Vector3
} from 'three';
import { plainMaterial } from './materials.js';

// ---------- Piezas que van sobre la cabeza y la mano ----------
// Todas se arman en metros, con la cabeza centrada en el origen del grupo: +X a la izquierda del personaje,
// +Y arriba, +Z hacia donde mira. El grupo se pega al hueso Head en la pose de descanso (ver character.js).
// Medidas de la cabeza del pack: radio ~0,085 a los lados, ~0,095 de adelante hacia atrás, coronilla a +0,085.

const sh = mesh => { mesh.castShadow = true; mesh.receiveShadow = false; return mesh; };
const small = mesh => { mesh.castShadow = false; return mesh; };   // detalles chicos: no aportan sombra y cuestan un dibujo por foco
const place = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };

// ---- Peinados que el pack no trae ----

// Afro: una esfera irregular
export function afro(color) {
  const geo = new IcosahedronGeometry(1, 3);
  const p = geo.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 9.1 + v.y * 3.7) * Math.cos(v.z * 8.3 - v.y * 5.1);
    v.multiplyScalar(1 + 0.05 * n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = sh(new Mesh(geo, plainMaterial(color, { roughness: 0.95 })));
  m.scale.set(0.155, 0.15, 0.15);
  m.position.set(0, 0.03, -0.02);
  return m;
}

// Rulos: bolitas repartidas sobre el cráneo (deja libre la frente)
export function curls(color) {
  const pts = [];
  const radii = new Vector3(0.088, 0.093, 0.098);
  for (const [lat, n] of [[10, 1], [32, 7], [55, 11], [76, 13]]) {
    for (let i = 0; i < n; i++) {
      const lon = (i / n) * Math.PI * 2 + lat * 0.05;
      const sl = Math.sin(lat * Math.PI / 180), cl = Math.cos(lat * Math.PI / 180);
      const x = Math.sin(lon) * sl, z = Math.cos(lon) * sl, y = cl;
      if (z > 0.35 && y < 0.62) continue;   // cara
      pts.push(new Vector3(x * radii.x, y * radii.y, z * radii.z).multiplyScalar(1.07));
    }
  }
  const mesh = new InstancedMesh(new SphereGeometry(0.034, 10, 8), plainMaterial(color, { roughness: 0.95 }), pts.length);
  const m = new Matrix4();
  pts.forEach((p, i) => { m.makeScale(1, 1, 1).setPosition(p); mesh.setMatrixAt(i, m); });
  mesh.castShadow = true;
  return mesh;
}

// Puntas: conos sobre la coronilla
export function spikes(color) {
  const mesh = new InstancedMesh(new ConeGeometry(0.02, 0.075, 8), plainMaterial(color, { roughness: 0.8 }), 9);
  const m = new Matrix4(), q = new Quaternion(), s = new Vector3(1, 1, 1);
  const list = [[-0.05, 0.075, 0.03], [0, 0.085, 0.04], [0.05, 0.075, 0.03], [-0.07, 0.06, -0.02], [0, 0.092, -0.01], [0.07, 0.06, -0.02], [-0.04, 0.07, -0.06], [0.04, 0.07, -0.06], [0, 0.065, -0.09]];
  list.forEach(([x, y, z], i) => {
    const dir = new Vector3(x * 1.6, 0.9, z * 1.6).normalize();
    q.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    m.compose(new Vector3(x, y, z), q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  return mesh;
}

// Cola de caballo / cola del mullet: cápsula que sale de la nuca
export function tail(color, long, down) {
  const g = new Group();
  const geo = new CapsuleGeometry(long ? 0.03 : 0.036, long, 6, 10);
  const mesh = sh(new Mesh(geo, plainMaterial(color, { roughness: 0.85 })));
  mesh.position.set(0, -down * 0.5, 0);
  g.add(mesh);
  g.position.set(0, 0.02, -0.095);
  g.rotation.x = -0.35;
  return g;
}

// ---- Cara ----
export function mustache(color, eyeY) {
  const g = new Group();
  for (const s of [-1, 1]) {
    const m = small(new Mesh(new CapsuleGeometry(0.0085, 0.032, 4, 8), plainMaterial(color, { roughness: 0.9 })));
    m.rotation.z = Math.PI / 2 + s * 0.28;
    m.position.set(s * 0.021, 0, 0);
    g.add(m);
  }
  g.position.set(0, eyeY - 0.055, 0.094);
  return g;
}

export function glasses(color, eyeY) {
  const g = new Group();
  const mat = plainMaterial(color, { roughness: 0.3, metalness: 0.2 });
  const lens = plainMaterial(color, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.78 });
  for (const s of [-1, 1]) {
    const ring = small(new Mesh(new TorusGeometry(0.0215, 0.0045, 6, 18), mat));
    ring.position.set(s * 0.036, 0, 0);
    const disc = new Mesh(new CircleGeometry(0.0205, 16), lens);
    disc.position.set(s * 0.036, 0, 0.001);
    const arm = small(new Mesh(new CylinderGeometry(0.0028, 0.0028, 0.11, 5), mat));
    arm.rotation.x = Math.PI / 2;
    arm.position.set(s * 0.0575, 0, -0.054);
    g.add(ring, disc, arm);
  }
  const bridge = small(new Mesh(new CylinderGeometry(0.003, 0.003, 0.026, 5), mat));
  bridge.rotation.z = Math.PI / 2;
  g.add(bridge);
  g.position.set(0, eyeY + 0.002, 0.1);
  return g;
}

// ---- Cabeza: cintillo, visera, jockey, sombreros ----
// Aro alrededor de la frente (el cráneo es una elipse: 0,082 de ancho, 0,098 de fondo)
function band(color, h, y) {
  const m = small(new Mesh(new CylinderGeometry(1, 1, h, 24, 1, true), new MeshStandardMaterial({ color, roughness: 0.7, side: DoubleSide })));
  m.scale.set(0.084, 1, 0.1);
  m.position.y = y;
  return m;
}
export const headband = color => band(color, 0.028, 0.044);

export function visor(color) {
  const g = new Group();
  g.add(band(color, 0.032, 0.046));
  const brim = sh(new Mesh(new CylinderGeometry(1, 1, 0.006, 20, 1, false, -Math.PI / 2, Math.PI), plainMaterial(color)));
  brim.rotation.y = Math.PI / 2;   // el semicírculo mira hacia adelante
  brim.scale.set(0.095, 1, 0.07);
  brim.position.set(0, 0.052, 0.085);
  g.add(brim);
  return g;
}

// Jockey: domo + visera; capBack = puesto al revés
export function cap(color, back) {
  const g = new Group();
  const mat = plainMaterial(color, { roughness: 0.75 });
  const dome = sh(new Mesh(new SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mat));
  dome.scale.set(0.093, 0.082, 0.104);
  dome.position.set(0, 0.024, -0.005);
  g.add(dome);
  const brim = sh(new Mesh(new CylinderGeometry(1, 1, 0.006, 20, 1, false, -Math.PI / 2, Math.PI), mat));
  brim.rotation.y = back ? -Math.PI / 2 : Math.PI / 2;
  brim.scale.set(0.088, 1, 0.075);
  brim.position.set(0, 0.04, back ? -0.095 : 0.093);
  brim.rotation.x = back ? -0.15 : 0.15;
  g.add(brim);
  return g;
}

const HAT_COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
// Sombreros comprados en la tienda, uno sobre otro
export function hats(n) {
  const g = new Group();
  let y = 0.078;
  for (let k = 0; k < n; k++) {
    const mat = plainMaterial(HAT_COLORS[k % 5], { roughness: 0.7 });
    const brim = sh(new Mesh(new CylinderGeometry(0.115, 0.115, 0.012, 20), mat));
    brim.position.set(0, y, 0);
    const crown = sh(new Mesh(new CylinderGeometry(0.062, 0.07, 0.085, 18), mat));
    crown.position.set(0, y + 0.045, 0);
    g.add(brim, crown);
    y += 0.092;
  }
  return g;
}

// ---- Pala: tres formas ----
// Contorno en coordenadas unitarias: x a lo largo (de -1 en el cuello a +1 en la punta), z a lo ancho (-1..1).
// Mismas fórmulas del esqueleto (view/skeleton.js): redonda, lágrima y diamante.
function outline(shape, steps = 40) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    let wd;
    if (shape === 'round') wd = 7.6 / 8.4;
    else if (shape === 'diamond') wd = 7.8 * (1 - 0.55 * Math.max(0, -ca)) * (1 - 0.12 * Math.max(0, ca)) / 9;
    else wd = 7 * (1 + 0.1 * ca) / 9;
    pts.push([ca, sa * wd]);
  }
  return pts;
}
function shapeOf(pts, k) {
  const s = new Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x * k, z * k) : s.moveTo(x * k, z * k)));
  s.closePath();
  return s;
}

// Devuelve { group, setLook(look, ps) }. La pala está en el sistema (x = largo hacia la punta, y = normal de la cara,
// z = ancho) y mide 1 de largo y ancho medios: se escala cada cuadro con las medidas reales (ver character.js).
export function makePaddle() {
  const group = new Group();
  const faceMat = plainMaterial('#fff', { roughness: 0.45 });
  const rimMat = plainMaterial('#fff', { roughness: 0.4 });
  const dotMat = plainMaterial('#fff', { roughness: 0.5 });
  const handleMat = plainMaterial('#11151b', { roughness: 0.8 });
  const head = new Group();            // cabeza de la pala (se escala por largo y ancho)
  group.add(head);
  const geos = {};
  for (const shape of ['round', 'tear', 'diamond']) {
    const pts = outline(shape);
    const rim = new ExtrudeGeometry((() => { const s = shapeOf(pts, 1); s.holes.push(shapeOf(pts, 0.86)); return s; })(), { depth: 1, bevelEnabled: false, steps: 1 });
    const face = new ExtrudeGeometry(shapeOf(pts, 0.88), { depth: 1, bevelEnabled: false, steps: 1 });
    for (const g of [rim, face]) { g.translate(0, 0, -0.5); g.rotateX(-Math.PI / 2); }
    geos[shape] = { rim, face };
  }
  const rimMesh = sh(new Mesh(geos.round.rim, rimMat));
  const faceMesh = sh(new Mesh(geos.round.face, faceMat));
  faceMesh.scale.set(1, 0.72, 1);
  const dot = new Mesh(new SphereGeometry(1, 10, 8), dotMat);
  head.add(rimMesh, faceMesh, dot);
  const handle = sh(new Mesh(new CylinderGeometry(1, 1, 1, 10), handleMat));   // eje X, de la mano al cuello
  handle.rotation.z = Math.PI / 2;
  group.add(handle);

  return {
    group, head, handle, rimMesh, faceMesh, dot,
    setLook(look) {
      const shape = look.paddle.shape;
      rimMesh.geometry = geos[shape].rim; faceMesh.geometry = geos[shape].face;
      faceMat.color.set(look.paddle.face); rimMat.color.set(look.paddle.rim); dotMat.color.set(look.band);
    },
    setDot(color) { dotMat.color.set(color); },
    // Tamaños en unidades de mundo: largo y ancho medios de la cabeza, grosor del borde, y mango (de la mano al cuello)
    fit(halfLen, halfWid, thick, handleLen, handleR, dotR) {
      head.scale.set(halfLen, thick, halfWid);
      head.position.set(handleLen + halfLen, 0, 0);
      rimMesh.scale.set(1, 1, 1);
      dot.scale.set(dotR / halfLen, dotR / thick, dotR / halfWid);
      dot.position.set(0, 0.55, 0);
      handle.scale.set(handleR, handleLen + halfLen * 0.06, handleR);
      handle.position.set((handleLen + halfLen * 0.06) / 2, 0, 0);
    }
  };
}

// ---- Medalla de oro del podio: disco con cinta en V, en coordenadas de reposo del torso (se pega a spine_03) ----
export function makeMedal() {
  const g = new Group();
  const gold = new MeshStandardMaterial({ color: '#e6b83a', roughness: 0.25, metalness: 0.9, emissive: '#6a4500', emissiveIntensity: 0.4 });
  const ribbon = new MeshStandardMaterial({ color: '#c62828', roughness: 0.7, side: DoubleSide });
  const disc = new Mesh(new CylinderGeometry(0.058, 0.058, 0.012, 28), gold);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 1.3, 0.155);
  const rim = new Mesh(new TorusGeometry(0.058, 0.006, 8, 28), gold);
  rim.position.copy(disc.position);
  g.add(disc, rim);
  for (const s of [-1, 1]) {
    const a = new Vector3(s * 0.085, 1.55, 0.075), b = new Vector3(0, 1.36, 0.15);
    const len = a.distanceTo(b);
    const r = new Mesh(new BoxGeometry(0.026, len, 0.004), ribbon);
    r.position.copy(a).lerp(b, 0.5);
    r.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(r);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  g.userData.metal = gold;
  return g;
}

// Color de la medalla según el puesto (oro, plata o bronce)
const MEDAL_COLORS = {
  gold: { color: '#e6b83a', emissive: '#6a4500', ei: 0.4 },
  silver: { color: '#d4dae4', emissive: '#3a4250', ei: 0.3 },
  bronze: { color: '#c97a3a', emissive: '#4a2208', ei: 0.35 }
};
export function setMedalKind(medal, kind) {
  const c = MEDAL_COLORS[kind] || MEDAL_COLORS.gold;
  const m = medal.userData.metal;
  m.color.set(c.color); m.emissive.set(c.emissive); m.emissiveIntensity = c.ei;
}
