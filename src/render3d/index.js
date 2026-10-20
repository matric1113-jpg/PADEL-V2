import { ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { VIEW_H, VIEW_W } from '../core/constants.js';
import { localInput, state } from '../core/state.js';
import { canvas, wrapper } from '../dom.js';
import { mouseView } from '../input/input.js';
import { CAMS, cam } from '../view/camera.js';
import { ctx } from '../view/ctx.js';
import { fx } from '../view/fx.js';
import { beginFrame, swapInReplay, swapOutReplay } from '../view/frame.js';
import { drawAimArc, drawHud, setWorldTransform } from '../view/hud.js';
import { Ball } from './ball.js';
import { applyCam, newCamera, screenToGround } from './camera.js';
import { Court } from './court.js';
import { Effects } from './effects.js';
import { drawGroundMarks } from './ground.js';
import { CourtLights } from './lights.js';
import { MapScene } from './maps.js';
import { Markers } from './markers.js';
import { drawStunStars, drawVignette, drawWindStreaks } from './overlay.js';
import { Players } from './players.js';
import { Podium } from './podium.js';
export { renderPortrait } from './portraits.js';

// ---------- Render 3D (Three.js) ----------
// La escena se dibuja en #game3d; el HUD sigue en el canvas 2D #game, que queda encima.
const camera = newCamera();
const aimCamera = newCamera();   // cámara de juego sin sacudida: la que usa la puntería
let podium = null, stageT = 0, onStage = false, onStageHud = false, resultK = 0;
let renderer = null, scene = null, markers = null, ball = null, court = null, lights = null, players = null, maps = null, effects = null;
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
  court = new Court(renderer);
  lights = new CourtLights();
  maps = new MapScene();
  scene.add(court.group, lights.group, maps.group);
  markers = new Markers();
  scene.add(markers.group);
  players = new Players();
  ball = new Ball();
  effects = new Effects();
  scene.add(players.group, ball.group, effects.group);
  podium = new Podium();
  scene.add(podium.group);

  Object.assign(debug, { renderer, scene, court, lights, players, ball, maps, effects, camera, podium });
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

// Solo en desarrollo: __padel.r3d.closeup = { slot: 0, dist: 120, height: 45, angle: 0.6, fov: 30 } mira de cerca a un jugador
const closeCam = new PerspectiveCamera(30, VIEW_W / VIEW_H, 1, 4000);
function closeupCamera() {
  const { slot = 0, dist = 120, height = 45, angle = 0.6, fov = 30, ty = 38 } = debug.closeup;
  const p = state.players[slot];
  closeCam.fov = fov; closeCam.updateProjectionMatrix();
  closeCam.position.set(p.x + Math.sin(angle) * dist, height, p.y + Math.cos(angle) * dist);
  closeCam.lookAt(p.x, ty, p.y);
  return closeCam;
}

function updateWorld(dt, now, inReplay, me) {
  court.update();
  lights.update(renderer, scene);
  maps.update(now, scene);
  const built = players.update(dt, now, inReplay);
  ball.update(camera, inReplay);
  markers.begin();
  drawGroundMarks(markers, me, built, inReplay, now);
  effects.update(camera, renderer.domElement.height, markers);
  markers.end();
  return built;
}

// Cinemática final (pantallas 'podium' y 'matchover'): cámara en perspectiva propia sobre el podio, sin HUD de juego
const podiumCam = new PerspectiveCamera(34, VIEW_W / VIEW_H, 1, 4000);
const FADE_FRAMES = 28;
function renderStage(now, dt) {
  if (!onStage) { onStage = true; stageT = 0; }
  stageT += dt;
  if (import.meta.env.DEV && debug.stageT != null) stageT = debug.stageT;   // solo en desarrollo: __padel.r3d.stageT = 400 fija el instante de la cinemática
  const amer = !!(state.result && state.result.americano);
  const winner = amer ? -1 : state.result ? state.result.winner : 0;
  podium.group.visible = true;
  if (!onStageHud) { onStageHud = true; document.getElementById('scorebug').style.display = 'none'; }
  podium.setWinner(winner);
  ball.group.visible = false;
  effects.group.visible = false;
  court.update();
  lights.update(renderer, scene);
  maps.update(now, scene);
  players.podium = { T: stageT, spots: podium.spots(state.players, winner, state.result), winner };
  players.update(dt, now, false);
  markers.begin(); markers.end();
  podium.update(stageT, dt);
  resultK += ((state.screen === 'matchover' ? 1 : 0) - resultK) * Math.min(1, 0.04 * dt);
  podium.camera(podiumCam, stageT, VIEW_W / VIEW_H, resultK, amer);
  renderer.render(scene, podiumCam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const fade = 1 - stageT / FADE_FRAMES;
  if (fade > 0) { ctx.fillStyle = `rgba(0, 0, 0, ${fade})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

export function render(now) {
  const { me, dt } = beginFrame(now, () => {}, updateAimFromMouse);
  if (state.screen === 'podium' || state.screen === 'matchover') { renderStage(now, dt); return; }
  if (onStage) {   // de vuelta al juego: se quita el podio y se vuelven a mostrar la pelota y los efectos
    onStage = false;
    onStageHud = false;
    resultK = 0;
    document.getElementById('scorebug').style.display = '';
    podium.group.visible = false;
    ball.group.visible = true;
    effects.group.visible = true;
    players.podium = null;
  }
  const which = fx.replay ? 'replay' : 'main';
  const sx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
  const sy = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
  const saved = swapInReplay();
  let built;
  Object.assign(cam, CAMS[which]);
  try {
    applyCam(camera, CAMS[which], fx.view, sx, sy);
    built = updateWorld(dt, now, which === 'replay', me);
    renderer.render(scene, import.meta.env.DEV && debug.closeup ? closeupCamera() : camera);
  } finally {
    swapOutReplay(saved);
  }

  // HUD: misma cámara (P de view/camera.js) y misma transformación de pantalla
  const S = canvas.width / VIEW_W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setWorldTransform(S, sx, sy);
  drawVignette();
  drawWindStreaks();
  if (!fx.replay) { drawAimArc(me); drawStunStars(built, now); }
  drawHud(me, built, S, () => setWorldTransform(S, sx, sy));
}
