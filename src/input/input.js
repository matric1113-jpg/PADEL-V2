import { ensureAudio } from '../audio/audio.js';
import { MAX_CHARGE_FRAMES, VIEW_H, VIEW_W } from '../core/constants.js';
import { localInput, rt } from '../core/state.js';
import { canvas } from '../dom.js';
import { renderer } from '../renderer.js';

window.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  ensureAudio();
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') { localInput.up = true; e.preventDefault(); }
  if (k === 's' || e.key === 'ArrowDown') { localInput.down = true; e.preventDefault(); }
  if (k === 'a' || e.key === 'ArrowLeft') { localInput.left = true; e.preventDefault(); }
  if (k === 'd' || e.key === 'ArrowRight') { localInput.right = true; e.preventDefault(); }
  if (e.code === 'Space') { localInput.sprint = true; e.preventDefault(); }
});

window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') localInput.up = false;
  if (k === 's' || e.key === 'ArrowDown') localInput.down = false;
  if (k === 'a' || e.key === 'ArrowLeft') localInput.left = false;
  if (k === 'd' || e.key === 'ArrowRight') localInput.right = false;
  if (e.code === 'Space') localInput.sprint = false;
});

// El mouse se proyecta desde la pantalla al suelo 3D (rayo cámara → plano z=0)
export const mouseView = { x: VIEW_W * 0.72, y: VIEW_H * 0.45, inside: false, moved: false };

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseView.x = (e.clientX - rect.left) * VIEW_W / rect.width;
  mouseView.y = (e.clientY - rect.top) * VIEW_H / rect.height;
  mouseView.inside = true;
  mouseView.moved = true;
  renderer.updateAimFromMouse();
});
canvas.addEventListener('mouseleave', () => { mouseView.inside = false; });

canvas.addEventListener('mousedown', e => {
  ensureAudio();
  if (document.activeElement.tagName === 'INPUT') document.activeElement.blur();
  if (e.button === 0) {
    localInput.charging = true;
    localInput.lobMode = e.shiftKey;
  } else if (e.button === 2) {
    localInput.charging = true;
    localInput.lobMode = true;
  }
});

window.addEventListener('mouseup', e => {
  if (!localInput.charging) return;
  if (e.button === 0 || e.button === 2) {
    localInput.lastChargeRatio = Math.min(1, rt.localChargeFrames / MAX_CHARGE_FRAMES);
    localInput.lastReleaseLob = localInput.lobMode;
    localInput.charging = false;
    localInput.releaseSeq++;
    rt.localChargeFrames = 0;
  }
});
