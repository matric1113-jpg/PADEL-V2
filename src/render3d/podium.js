import {
  BoxGeometry, CanvasTexture, Color, DoubleSide, Euler, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
  Quaternion, SpotLight, SRGBColorSpace, Vector3
} from 'three';
import { TEAM_COLORS } from '../view/skeleton.js';

// ---------- Podio de la cinemática final (amistoso y americano) ----------
// Amistoso: un escalón alto al centro para los ganadores y dos bajos a los lados para los perdedores.
// Americano: escalones 1 (centro), 2 (izquierda) y 3 (derecha) con medallas de oro, plata y bronce; el 4.º, en el suelo.
// Todo sobre la cancha (a un costado de la red). Unidades de mundo del juego; la altura (y de Three.js) de cada
// escalón es el "lift" con el que se levanta a los personajes.
export const PODIUM_C = { x: 300, y: 165 };
const HIGH = 34, MID = 22, LOW = 13;
// Americano: centro y alto de cada escalón por puesto (el 4.º no tiene escalón)
const AMER_STEPS = { 1: { x: 0, h: HIGH, w: 100 }, 2: { x: -84, h: MID, w: 64 }, 3: { x: 84, h: LOW, w: 64 }, 4: { x: -152, h: 0, w: 60 } };   // el 4.º, en el suelo junto al 2 (a la derecha está la red)
const MEDAL_OF = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const FACE_TH = Math.PI / 2;                        // los personajes miran hacia +y, donde está la cámara
const START_T = 0, TRAVEL_T = 330;                  // cuadros que dura el acercamiento

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function numberTexture(text, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 128, 128);
  c.font = '700 96px "Saira Condensed", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(text, 64, 70);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Podium {
  constructor() {
    this.group = new Group();
    this.group.visible = false;
    const stone = new MeshStandardMaterial({ color: '#e8e3d6', roughness: 0.6 });
    const stone2 = new MeshStandardMaterial({ color: '#cfd6e0', roughness: 0.6 });
    const gold = new MeshStandardMaterial({ color: '#e6b83a', roughness: 0.28, metalness: 0.85, emissive: '#5a3c00', emissiveIntensity: 0.35 });
    const silver = new MeshStandardMaterial({ color: '#c3cad6', roughness: 0.3, metalness: 0.8 });
    const bronze = new MeshStandardMaterial({ color: '#c97a3a', roughness: 0.32, metalness: 0.8 });
    this.friendly = new Group();
    this.amer = new Group();
    this.group.add(this.friendly, this.amer);
    let parent = this.friendly;
    const step = (cx, w, h, body, top, label, labelColor) => {
      const g = new Group();
      const b = new Mesh(new BoxGeometry(w, h, 46), body);
      b.position.set(0, h / 2, 0); b.castShadow = true; b.receiveShadow = true;
      const t = new Mesh(new BoxGeometry(w + 3, 2.2, 49), top);
      t.position.set(0, h + 1.1, 0); t.castShadow = true;
      const n = new Mesh(new PlaneGeometry(Math.min(w * 0.4, 28), Math.min(w * 0.4, 28)), new MeshBasicMaterial({ map: numberTexture(label, labelColor), transparent: true, depthWrite: false }));
      n.position.set(0, h * 0.5, 23.2);
      g.add(b, t, n);
      g.position.set(PODIUM_C.x + cx, 0, PODIUM_C.y);
      parent.add(g);
    };
    step(0, 124, HIGH, stone, gold, '1', '#b8860b');
    step(-100, 72, LOW, stone2, silver, '2', '#6b7480');
    step(100, 72, LOW, stone2, silver, '2', '#6b7480');
    parent = this.amer;
    step(AMER_STEPS[1].x, AMER_STEPS[1].w, HIGH, stone, gold, '1', '#b8860b');
    step(AMER_STEPS[2].x, AMER_STEPS[2].w, MID, stone2, silver, '2', '#6b7480');
    step(AMER_STEPS[3].x, AMER_STEPS[3].w, LOW, stone2, bronze, '3', '#8a4b1c');
    this.amer.visible = false;

    // Foco sobre el podio
    this.spot = new SpotLight('#fff0d0', 9, 0, 0.55, 0.7, 0);
    this.spot.position.set(PODIUM_C.x + 70, 330, PODIUM_C.y + 150);
    this.spot.target.position.set(PODIUM_C.x, 40, PODIUM_C.y);
    this.group.add(this.spot, this.spot.target);
    // Luz de relleno desde el frente (la cámara mira de frente a los personajes)
    this.fill = new SpotLight('#cfe0ff', 3.2, 0, 0.7, 0.9, 0);
    this.fill.position.set(PODIUM_C.x - 120, 150, PODIUM_C.y + 380);
    this.fill.target.position.set(PODIUM_C.x, 50, PODIUM_C.y);
    this.group.add(this.fill, this.fill.target);

    // Confeti
    this.confetti = new InstancedMesh(new PlaneGeometry(2.4, 1.3), new MeshBasicMaterial({ side: DoubleSide }), 160);
    this.confetti.frustumCulled = false;
    this.pieces = Array.from({ length: 160 }, () => this.newPiece(true));
    this.group.add(this.confetti);
    this.tmpM = new Matrix4(); this.tmpQ = new Quaternion(); this.tmpV = new Vector3(); this.tmpE = new Euler(); this.one = new Vector3(1, 1, 1);
    this.winner = null;
  }

  newPiece(scatter) {
    return {
      x: PODIUM_C.x + (Math.random() - 0.5) * 300, y: scatter ? Math.random() * 220 : 200 + Math.random() * 60, z: PODIUM_C.y + (Math.random() - 0.5) * 120,
      vy: -(0.35 + Math.random() * 0.35), ph: Math.random() * 6.28, sp: 0.04 + Math.random() * 0.06, rx: Math.random() * 6, ry: Math.random() * 6, c: Math.floor(Math.random() * 4)
    };
  }

  // team -1: americano (confeti dorado en vez del color de un equipo)
  setWinner(team) {
    if (team === this.winner) return;
    this.winner = team;
    this.friendly.visible = team >= 0;
    this.amer.visible = team < 0;
    const palette = [team >= 0 ? TEAM_COLORS[team] : '#e6b83a', '#ffd54a', '#ffffff', '#ff5fa8'].map(c => new Color(c));
    this.pieces.forEach((p, i) => this.confetti.setColorAt(i, palette[p.c]));
    this.confetti.instanceColor.needsUpdate = true;
  }

  // Dónde se para cada jugador. Ganadores en el escalón alto, perdedores abajo a los lados.
  // En el americano manda la tabla final (result.ranking): los empatados comparten escalón y medalla.
  spots(players, winner, result) {
    const out = [];
    if (result && result.americano) {
      const place = uid => (result.ranking.find(r => r.uid === uid) || { place: 4 }).place;
      const groups = {};
      players.forEach((p, idx) => { (groups[place(p.uid)] = groups[place(p.uid)] || []).push(idx); });
      for (const [pl, idxs] of Object.entries(groups)) {
        const st = AMER_STEPS[pl] || AMER_STEPS[4];
        idxs.forEach((idx, k) => {
          out[idx] = { x: PODIUM_C.x + st.x + (k - (idxs.length - 1) / 2) * 30, y: PODIUM_C.y, lift: st.h ? st.h + 2.2 : 0, th: FACE_TH, win: Number(pl) === 1, medal: MEDAL_OF[pl] || '' };
        });
      }
      return out;
    }
    let w = 0, l = 0;
    players.forEach((p, idx) => {
      if (p.out) { out[idx] = null; return; }
      if (p.team === winner) {
        out[idx] = { x: PODIUM_C.x + (w++ ? 26 : -26), y: PODIUM_C.y, lift: HIGH + 2.2, th: FACE_TH, win: true };
      } else {
        out[idx] = { x: PODIUM_C.x + (l++ ? 100 : -100), y: PODIUM_C.y, lift: LOW + 2.2, th: FACE_TH, win: false };
      }
    });
    return out;
  }

  // T: cuadros desde el comienzo de la cinemática
  update(T, dt) {
    this.pieces.forEach((p, i) => {
      p.y += p.vy * dt;
      p.ph += p.sp * dt;
      if (p.y < 0) Object.assign(p, this.newPiece(false), { c: p.c });
      this.tmpQ.setFromEuler(this.tmpE.set(p.rx + p.ph * 3, p.ry + p.ph * 2, 0));
      this.tmpM.compose(this.tmpV.set(p.x + Math.sin(p.ph) * 6, p.y, p.z + Math.cos(p.ph * 0.8) * 4), this.tmpQ, this.one);
      this.confetti.setMatrixAt(i, this.tmpM);
    });
    this.confetti.instanceMatrix.needsUpdate = true;
  }

  // Cámara: parte lejos, en diagonal y desde arriba, y se acerca hasta un plano frontal del podio; después se mueve apenas.
  // low (0..1): en la pantalla de resultado el podio sube en el cuadro para dejar sitio al panel de abajo
  // wide: el americano usa cuatro puestos a lo ancho, así que la cámara termina un poco más lejos
  camera(cam, T, aspect, low = 0, wide = false) {
    const k = ss(START_T, TRAVEL_T, T);
    const end = wide ? 315 : 255;
    const d = 400 + (end - 400) * k, h = 250 + ((wide ? 96 : 84) - 250) * k;
    const a = 0.95 * (1 - k) + 0.03 * k + 0.07 * Math.sin(T / 190) * k;
    cam.position.set(PODIUM_C.x + Math.sin(a) * d, h, PODIUM_C.y + Math.cos(a) * d);
    cam.lookAt(PODIUM_C.x, 40 + 28 * k - 26 * low, PODIUM_C.y);
    cam.fov = 36;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
  }
}
