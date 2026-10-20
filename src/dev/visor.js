import {
  AmbientLight, AnimationMixer, Box3, Color, DirectionalLight, GridHelper, LoopRepeat, PerspectiveCamera, Scene, SkeletonHelper, Vector3, WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Visor de desarrollo: http://localhost:5173/visor.html
const canvas = document.getElementById('c');
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new Scene();
scene.background = new Color('#2b303a');
scene.add(new AmbientLight('#fff', 1.1));
const sun = new DirectionalLight('#fff', 2.4); sun.position.set(2, 4, 3); scene.add(sun);
scene.add(new GridHelper(4, 8, '#555', '#3a3f4a'));
const camera = new PerspectiveCamera(35, 1, 0.05, 50);
camera.position.set(0, 1.2, 4.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0);

const loader = new GLTFLoader();
const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
const ui = document.getElementById('ui');
const params = new URLSearchParams(location.search);

// ?look=german  ->  personaje vestido y animado con el módulo real (char/character.js); &speed=0..8 &celeb=flex &stun=1 &burn=1
if (params.get('look')) {
  const { loadCharacterAssets } = await import('./../render3d/char/assets.js');
  const { Character, genderOf } = await import('./../render3d/char/character.js');
  const { LOOKS } = await import('./../core/data.js');
  await loadCharacterAssets();
  const id = params.get('look');
  const ch = new Character(genderOf(id));
  scene.add(ch.root);
  const look = LOOKS[id];
  const V = (x, y, z) => new Vector3(x, y, z);
  const speed = +(params.get('speed') || 0), celeb = params.get('celeb') || '';
  controls.target.set(0, 38, 0); camera.position.set(0, 60, 190); camera.near = 1; camera.far = 2000; camera.updateProjectionMatrix();
  scene.children.filter(c => c.isGridHelper).forEach(g => scene.remove(g));
  let last2 = performance.now(), t0 = 0;
  const loop = now => {
    const dt = Math.min(0.05, (now - last2) / 1000); last2 = now; t0 += dt;
    const sw = params.get('swing') ? (t0 % 1.2) / 1.2 : 0;
    const f = {
      dt, lookId: id, x: 0, y: 0, z: 0, K: 0.99, Kz: 0.99 * look.body.h, body: look.body, armK: look.body.arm,
      facing: 0, moveYaw: 0, speed, charging: false, cr: 0, kind: 'ready', swinging: !!sw, swingKind: 'drive', swingU: sw,
      celeb: celeb ? { kind: celeb } : null, stun: params.get('stun') ? 100 : 0, burn: params.get('burn') ? 100 : 0, slow: 0, twist: 0,
      handR: V(-12, 48 + (sw ? 10 * Math.sin(sw * 6) : 0), 14 + (sw ? 14 * Math.cos(sw * 6) : 0)), poleR: V(-18, 42, 2),
      handL: celeb === 'flex' ? V(15, 70, 4) : V(10, 46, 10), poleL: V(22, 44, 0),
      paddle: { show: !celeb, dir: V(-0.1, 0.3, 1).normalize(), normal: V(0, 1, -0.3).normalize(), halfLen: 9, halfWid: 7, handleLen: 5.5, scale: 1 },
      teamColor: '#45a8ff', up: { sombrero: +(params.get('hats') || 0), zapas: 0, remate: 0 }
    };
    ch.update(f);
    controls.update(); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.render(scene, camera); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  await new Promise(() => {});
}
const [body, anims] = await Promise.all([
  load(`/assets/models/cuerpo_${params.get('g') || 'hombre'}.glb`),
  load('/assets/models/animaciones.glb')
]);
const model = body.scene;
// ?sheet=Clip1,Clip2&t=0.3  ->  fila de poses congeladas (hoja de contacto); &view=side para verlas de lado
if (params.get('sheet')) {
  const names = params.get('sheet').split(',');
  const ts = (params.get('t') || '0.25').split(',').map(Number);
  names.forEach((name, i) => {
    const m = i === 0 ? model : clone(model);
    m.position.x = (i - (names.length - 1) / 2) * 1.5;
    if (params.get('view') === 'side') m.rotation.y = Math.PI / 2;
    if (params.get('view') === 'back') m.rotation.y = Math.PI;
    if (i > 0) scene.add(m);
    const mx = new AnimationMixer(m);
    // "A:0.6+B:0.4" mezcla clips con esos pesos
    for (const part of name.split('+')) {
      const [cn, wt] = part.split(':');
      const clip = anims.animations.find(c => c.name === cn);
      const act = mx.clipAction(clip).play();
      act.time = ts[i % ts.length] * clip.duration;
      act.setEffectiveWeight(wt === undefined ? 1 : +wt);
    }
    mx.update(0);
  });
  controls.target.set(0, 0.9, 0);
  camera.position.set(0, 1.1, Math.max(4.2, names.length * 1.9));
  camera.fov = 30;
  scene.add(model);
  const label = document.getElementById('ui'); label.innerHTML = names.map((n, i) => `${i}:${n}@${ts[i % ts.length]}`).join('<br>');
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  function sheetFrame() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(sheetFrame); }
  sheetFrame();
  await new Promise(() => {});
}
scene.add(model);
const box = new Box3().setFromObject(model);
const mixer = new AnimationMixer(model);
const clips = anims.animations;
let action = null, helper = null;

function play(name) {
  if (action) action.stop();
  const clip = clips.find(c => c.name === name);
  action = mixer.clipAction(clip);
  action.setLoop(LoopRepeat).reset().play();
  window.__action = action;
}
ui.innerHTML = `<b>Visor</b> (g=hombre|mujer)<br><select id="clip">${clips.map(c => `<option>${c.name}</option>`).join('')}</select>
<label><input type="checkbox" id="pause"> pausa</label>
<label>tiempo <input type="range" id="t" min="0" max="1" step="0.001" style="width:200px"></label>
<label>velocidad <input type="range" id="sp" min="0" max="2" step="0.05" value="1" style="width:150px"></label>
<label><input type="checkbox" id="skel"> huesos</label>
<div id="info"></div>`;
const sel = document.getElementById('clip');
sel.onchange = () => play(sel.value);
let speed = 1;
document.getElementById('sp').oninput = e => { speed = +e.target.value; };
document.getElementById('skel').onchange = e => {
  if (e.target.checked) { helper = new SkeletonHelper(model); scene.add(helper); } else if (helper) { scene.remove(helper); helper = null; }
};
play(params.get('clip') || 'Idle_Loop');
sel.value = params.get('clip') || 'Idle_Loop';

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const paused = document.getElementById('pause').checked;
  const slider = document.getElementById('t');
  if (paused) { action.paused = false; action.time = slider.value * action.getClip().duration; mixer.update(0); }
  else { mixer.update(dt * speed); slider.value = (action.time % action.getClip().duration) / action.getClip().duration; }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.getElementById('info').textContent = `alto ${(box.max.y - box.min.y).toFixed(3)} m  ancho ${(box.max.x - box.min.x).toFixed(3)}  prof ${(box.max.z - box.min.z).toFixed(3)}`;
window.__v = { THREE: null, model, mixer, clips, scene, camera, controls, renderer, play };
