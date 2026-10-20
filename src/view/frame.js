import { TILT_CAM_ROT, TILT_CAM_SHIFT } from '../core/constants.js';
import { rt, state, tiltEase } from '../core/state.js';
import { clamp, lerp } from '../core/util.js';
import { CAMS, cam, setupCamera } from './camera.js';
import { detectStateEvents, fx, updateFx } from './fx.js';

// ---------- Comienzo de cada cuadro, común a los dos renders ----------
let lastRenderTime = performance.now();

// Devuelve { me, dt }. onCamChange se llama cuando la cámara cambia de equipo.
// aim() vuelve a calcular la puntería con el mouse (depende de la cámara del render activo).
export function beginFrame(now, onCamChange, aim) {
  const me = state.players[rt.mySlot] || state.players[0];
  if (!cam.ready || cam.team !== me.team) {
    setupCamera(me.team);
    onCamChange();
    aim();
    document.getElementById('scorebug').classList.toggle('flip', me.team === 1);
    document.getElementById('status-text').classList.toggle('flip', me.team === 1);
  }

  const dt = clamp((now - lastRenderTime) / (1000 / 60), 0.1, 3);
  lastRenderTime = now;
  detectStateEvents();
  updateFx(dt);

  // Inclinación de la cancha de Atlas (se ve como un leve giro de cámara)
  const tilt = tiltEase();
  const targetRot = state.tilt.x * TILT_CAM_ROT * tilt, targetOy = state.tilt.y * TILT_CAM_SHIFT * tilt;
  fx.view.rot = lerp(fx.view.rot, targetRot, clamp(0.1 * dt, 0, 1));
  fx.view.oy = lerp(fx.view.oy, targetOy, clamp(0.1 * dt, 0, 1));
  fx.view.k = 1 + Math.abs(fx.view.rot) * 1.6;
  if (Math.abs(fx.view.rot) < 1e-4) fx.view.rot = 0;
  if (Math.abs(fx.view.oy) < 0.01) fx.view.oy = 0;
  if (fx.view.rot || fx.view.oy) aim();
  return { me, dt };
}

// Durante la repetición se dibuja un cuadro guardado en lugar del estado actual
export function swapInReplay() {
  if (!fx.replay) return null;
  const fr = fx.replay.frames[Math.min(fx.replay.frames.length - 1, Math.floor(fx.replay.t))];
  const saved = { ball: state.ball, players: state.players, ice: state.ice };
  state.ball = fr.ball; state.players = fr.players; state.ice = fr.ice;
  return saved;
}
export function swapOutReplay(saved) {
  if (saved) Object.assign(state, saved);
  Object.assign(cam, CAMS.main);
}
