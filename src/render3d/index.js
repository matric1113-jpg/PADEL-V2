import { ACESFilmicToneMapping, CapsuleGeometry, Color, Mesh, MeshStandardMaterial, PCFSoftShadowMap, Scene, SphereGeometry, SRGBColorSpace, WebGLRenderer } from 'three';
import { BALL_R, VIEW_H, VIEW_W, ZS } from '../core/constants.js';
import { localInput, state } from '../core/state.js';
import { canvas, wrapper } from '../dom.js';
import { mouseView } from '../input/input.js';
import { CAMS, cam } from '../view/camera.js';
import { ctx } from '../view/ctx.js';
import { fx } from '../view/fx.js';
import { beginFrame, swapInReplay, swapOutReplay } from '../view/frame.js';
import { drawAimArc, drawHud, setWorldTransform } from '../view/hud.js';
import { buildPlayerParts, lookOf } from '../view/skeleton.js';
import { applyCam, newCamera, screenToGround } from './camera.js';
import { Court } from './court.js';
import { drawGroundMarks } from './ground.js';
import { CourtLights } from './lights.js';
import { Markers } from './markers.js';

// ---------- Render 3D (Three.js) ----------
// La escena se dibuja en #game3d; el HUD sigue en el canvas 2D #game, que queda encima.
const camera = newCamera();
const aimCamera = newCamera();   // cámara de juego sin sacudida: la que usa la puntería
let renderer = null, scene = null, markers = null, ball = null, court = null, lights = null;
const playerMeshes = [];
export const debug = {};   // solo para revisar desde la consola en desarrollo

export function init() {
  const gl = document.createElement('canvas');
  gl.id = 'game3d';
  wrapper.insertBefore(gl, canvas);
  canvas.classList.add('hud');
  renderer = new WebGLRenderer({ canvas: gl, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  scene = new Scene();
  scene.background = new Color('#0b1522');
  court = new Court(renderer);
  lights = new CourtLights();
  scene.add(court.group, lights.group);
  markers = new Markers();
  scene.add(markers.group);
  ball = new Mesh(new SphereGeometry(BALL_R, 20, 14), new MeshStandardMaterial({ color: '#e4ff3a', emissive: '#556010' }));
  ball.castShadow = true;
  scene.add(ball);
  for (let i = 0; i < 4; i++) {
    const m = new Mesh(new CapsuleGeometry(9, 50, 4, 12), new MeshStandardMaterial());
    m.castShadow = true;
    playerMeshes.push(m);
    scene.add(m);
  }

  Object.assign(debug, { renderer, scene, court, lights, camera });
  resize();
  new ResizeObserver(resize).observe(wrapper);
}

function resize() {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width < 10) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(rect.width, rect.width * VIEW_H / VIEW_W, false);
  const w = Math.round(rect.width * dpr), h = Math.round(w * VIEW_H / VIEW_W);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

// Mouse → suelo con la cámara Three.js (equivale a unprojectGround; ver scripts/test-camera.mjs)
export function updateAimFromMouse() {
  if (!cam.ready || !CAMS.main || !mouseView.moved) return;
  applyCam(aimCamera, CAMS.main, fx.view);
  const g = screenToGround(aimCamera, mouseView.x, mouseView.y);
  if (g) {
    localInput.aimX = g.x;
    localInput.aimY = g.y;
  }
}

function updateWorld(dt, now, inReplay, me) {
  court.update();
  lights.update(renderer, scene);
  const built = state.players.map((p, idx) => p.out ? null : buildPlayerParts(p, idx, dt * (inReplay ? 0.45 : 1), now, fx.players[idx]));
  state.players.forEach((p, i) => {
    const m = playerMeshes[i];
    m.visible = !p.out;
    m.position.set(p.x, 34, p.y);
    m.material.color.set(lookOf(p).shirt);
  });
  const b = state.ball;
  ball.position.set(b.x, b.z * ZS + BALL_R, b.y);
  drawGroundMarks(markers, me, built, inReplay, now);
  return built;
}

export function render(now) {
  const { me, dt } = beginFrame(now, () => {}, updateAimFromMouse);
  const which = fx.replay ? 'replay' : 'main';
  const sx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
  const sy = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
  const saved = swapInReplay();
  let built;
  Object.assign(cam, CAMS[which]);
  try {
    applyCam(camera, CAMS[which], fx.view, sx, sy);
    built = updateWorld(dt, now, which === 'replay', me);
    renderer.render(scene, camera);
  } finally {
    swapOutReplay(saved);
  }

  // HUD: misma cámara (P de view/camera.js) y misma transformación de pantalla
  const S = canvas.width / VIEW_W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!fx.replay) { setWorldTransform(S, sx, sy); drawAimArc(me); }
  drawHud(me, built, S, () => setWorldTransform(S, sx, sy));
}
