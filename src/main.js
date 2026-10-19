import './style.css';
import { playSound, toggleMusic } from './audio/audio.js';
import { hooks } from './core/events.js';
import { setupServe } from './core/game.js';
import { stepPhysics } from './core/physics.js';
import { recordFrame } from './core/replay.js';
import { menuSel, rt, state } from './core/state.js';
import { sendStateTo } from './net/network.js';
import { onGameEvent } from './render2d/fx.js';
import { resizeCanvas } from './render2d/layers.js';
import { render } from './render2d/world.js';
import { syncHud, updateScoreUI } from './ui/hud.js';
import { chooseChar, openMenu, syncOverlay } from './ui/menu.js';

// La lógica avisa por hooks; aquí se conectan al sonido, los efectos y la interfaz
hooks.sound = type => { playSound(type); onGameEvent(type); };
hooks.scoreChanged = updateScoreUI;
document.getElementById('menu-btn').addEventListener('click', openMenu);
document.getElementById('music-btn').addEventListener('click', toggleMusic);

// Loop fijo a 60 FPS para la física; el dibujo va al ritmo de la pantalla
let lastTime = performance.now();
let accumulator = 0;
const STEP = 1000 / 60;

function broadcastState() {
  if (!rt.isHost) return;
  Object.values(rt.connections).forEach(sendStateTo);
}

function runSteps(now) {
  const delta = Math.min(now - lastTime, 250);
  lastTime = now;
  accumulator += delta;
  let n = 0;
  while (accumulator >= STEP && n < 15) {
    stepPhysics();
    if (rt.isHost) recordFrame();
    accumulator -= STEP;
    n++;
  }
  if (accumulator > STEP) accumulator = 0;
  if (n > 0) broadcastState();   // un envío por tanda basta
}

function gameLoop(now) {
  runSteps(now);
  render(now);
  syncHud();
  updateScoreUI();
  syncOverlay();
  requestAnimationFrame(gameLoop);
}

// Con la pestaña oculta (por ejemplo, al ir a WhatsApp a pasar el código) el navegador
// detiene requestAnimationFrame. Este reloj en un Worker mantiene la física y la red vivas.
(function startBackgroundTicker() {
  const tick = () => { if (document.hidden) runSteps(performance.now()); };
  try {
    const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16);'], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = tick;
  } catch (e) {
    setInterval(tick, 16);
  }
})();

resizeCanvas();
chooseChar(menuSel.char);
setupServe(0);
state.bannerTimer = 0;
updateScoreUI();
requestAnimationFrame(gameLoop);
