import { COURT, VIEW_H, VIEW_W } from '../core/constants.js';
import { state } from '../core/state.js';
import { canvas, wrapper } from '../dom.js';
import { CAMS, P, cam } from '../view/camera.js';
import { drawBackdrop, drawCrowd, drawLightFixture, drawNetShadows, drawProps, drawWall, renderGround } from './court.js';

// ---------- Capas estáticas en caché (una por cámara: juego y repetición) ----------
const staticLayer = document.createElement('canvas');
const fgLayer = document.createElement('canvas');
const groundLayer = document.createElement('canvas');
export const LAYERS = {
  main: { st: staticLayer, fg: fgLayer, key: '' },
  replay: { st: document.createElement('canvas'), fg: document.createElement('canvas'), key: '' }
};
export let renderScale = 1;

export function layerKey(which) {
  return [which, canvas.width, canvas.height, state.map, state.lights.join(','), cam.team, CAMS[which] && CAMS[which].yaw].join('|');
}

export function rebuildLayers(which = 'main') {
  if (which === 'main' && !CAMS.main && cam.ready) CAMS.main = { ...cam };
  if (!cam.ready || !CAMS[which]) return;
  const saved = { ...cam };
  Object.assign(cam, CAMS[which]);
  try {
    const W = canvas.width, H = canvas.height;
    renderScale = W / VIEW_W;
    const set = LAYERS[which];
    for (const l of [set.st, set.fg]) { l.width = W; l.height = H; }

    const s = set.st.getContext('2d');
    const gScale = Math.min(renderScale, 1.5);
    groundLayer.width = Math.round(VIEW_W * gScale);
    groundLayer.height = Math.round(VIEW_H * gScale);
    renderGround(groundLayer.getContext('2d'), groundLayer.width, groundLayer.height);
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.imageSmoothingEnabled = true;
    s.imageSmoothingQuality = 'high';
    s.drawImage(groundLayer, 0, 0, W, H);
    s.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    drawBackdrop(s);
    drawCrowd(s);
    drawProps(s);
    drawNetShadows(s);
    drawLightFixture(s, 0, 1);
    drawWall(s, 'F', 1);
    const lFar = P(COURT.x, COURT.midY, 0).d > P(COURT.x + COURT.w, COURT.midY, 0).d;
    drawWall(s, lFar ? 'L' : 'R', 1);
    drawWall(s, lFar ? 'R' : 'L', 1);

    const g = set.fg.getContext('2d');
    g.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    drawWall(g, 'N', 0.42);
    const v = g.createRadialGradient(VIEW_W / 2, VIEW_H * 0.52, VIEW_W * 0.32, VIEW_W / 2, VIEW_H * 0.52, VIEW_W * 0.78);
    v.addColorStop(0, 'rgba(3, 8, 16, 0)');
    v.addColorStop(1, 'rgba(3, 8, 16, 0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    set.key = layerKey(which);
  } finally {
    Object.assign(cam, saved);
  }
}

export function resizeCanvas() {
  const rect = wrapper.getBoundingClientRect();
  if (rect.width < 10) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(w * VIEW_H / VIEW_W);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    renderScale = w / VIEW_W;
  }
}

let resizeTimer = null;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCanvas, 120);
}).observe(wrapper);
