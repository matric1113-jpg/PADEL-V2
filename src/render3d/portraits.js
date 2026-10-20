import { ACESFilmicToneMapping, AmbientLight, CircleGeometry, DirectionalLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { LOOKS } from '../core/data.js';
import { createPlayer, rt } from '../core/state.js';
import { renderPortrait as renderPortrait2d } from '../render2d/players.js';
import { newPf } from '../view/fx.js';
import { buildPlayerParts } from '../view/skeleton.js';
import { assets, loadCharacterAssets } from './char/assets.js';
import { Character, genderOf } from './char/character.js';
import { frameFor } from './players.js';

// ---------- Retratos del menú en 3D ----------
// Un solo renderizador fuera de pantalla dibuja al personaje (el mismo modelo del partido, en guardia) y el
// resultado se copia al <canvas> de cada tarjeta. Mientras cargan los modelos se usa el retrato 2D de respaldo.

let gl = null, scene = null, camera = null, floor = null;
const chars = new Map();     // lookId -> Character (se reutiliza entre menús)
let pending = false;

function init() {
  gl = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = ACESFilmicToneMapping;
  scene = new Scene();
  scene.add(new AmbientLight('#cfe0ff', 1.6));
  const key = new DirectionalLight('#fff4e0', 3.4); key.position.set(120, 220, 260); scene.add(key);
  const rim = new DirectionalLight('#7fb0ff', 1.6); rim.position.set(-200, 120, -150); scene.add(rim);
  floor = new Mesh(new CircleGeometry(22, 28), new MeshBasicMaterial({ color: '#000814', transparent: true, opacity: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.2;
  scene.add(floor);
  camera = new PerspectiveCamera(24, 1, 10, 2000);
}

function characterFor(lookId) {
  let c = chars.get(lookId);
  if (!c) {
    c = new Character(genderOf(lookId));
    scene.add(c.root);
    c.root.visible = false;
    chars.set(lookId, c);
  }
  return c;
}

export function renderPortrait(cv, lookId, up) {
  const L = LOOKS[lookId];
  if (!cv || !L) return;
  if (!assets.ready) {
    // Respaldo 2D, y se repinta el menú cuando lleguen los modelos
    renderPortrait2d(cv, lookId, up);
    if (!pending) {
      pending = true;
      loadCharacterAssets().then(() => { rt.overlayKey = ''; }).catch(() => {});
    }
    return;
  }
  if (!gl) init();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 120, h = cv.clientHeight || 120;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  gl.setPixelRatio(1);
  gl.setSize(cv.width, cv.height, false);
  camera.aspect = cv.width / cv.height;

  // Pose: la misma que el retrato 2D (parado, mirando de tres cuartos hacia la cámara)
  const fake = createPlayer(0, 0, 0, L.name, true, L.speed, lookId);
  if (up) fake.up = { ...up };
  const b = buildPlayerParts(fake, -1, 1, 0, newPf(), { portrait: true, facing: Math.PI / 2 - 0.5 });
  const ch = characterFor(lookId);
  for (const c of chars.values()) c.root.visible = false;
  ch.root.visible = true;
  const f = frameFor(fake, b, 0.05, 0, 0);
  f.speed = 0;
  f.celeb = null;
  for (let i = 0; i < 40; i++) ch.update(f);   // deja que se asienten los pesos de los clips
  const top = 78 * f.Kz + (up && up.sombrero ? 10 : 0);
  camera.position.set(34, top * 0.6, 245);
  camera.lookAt(0, top * 0.5, 0);
  camera.updateProjectionMatrix();
  gl.render(scene, camera);
  ch.root.visible = false;

  const c2 = cv.getContext('2d');
  c2.setTransform(1, 0, 0, 1, 0, 0);
  c2.clearRect(0, 0, cv.width, cv.height);
  c2.drawImage(gl.domElement, 0, 0);
}
