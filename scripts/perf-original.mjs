// Genera el index.html ORIGINAL (un solo archivo, commit 0ac502c) con el mismo contador de
// rendimiento que el juego nuevo, para comparar en el mismo navegador:
//   npm run perf:original
//   npm run dev  →  http://localhost:5173/perf-original/      (original)
//                   http://localhost:5173/?perf               (nuevo, 3D)
//                   http://localhost:5173/?render=2d&perf     (nuevo, 2D)
// El contador se engancha envolviendo las funciones globales del original; su código no se toca.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ORIGINAL = '0ac502c';
const html = execSync(`git show ${ORIGINAL}:index.html`, { encoding: 'utf8', maxBuffer: 1 << 26 });
let perf = readFileSync('src/perf.js', 'utf8').replace(/export /g, '');
perf = perf.replace("on: new URLSearchParams(location.search).has('perf'),", 'on: true,');

const injected = `<script>
// Contador inyectado por scripts/perf-original.mjs (no es parte del original)
(function () {
${perf}
const sp = window.stepPhysics;
window.stepPhysics = function () { const t = performance.now(); sp(); perf.frame.physics += performance.now() - t; perf.frame.steps++; };
let ui = 0;
for (const n of ['syncHud', 'updateScoreUI', 'syncOverlay']) {
  const f = window[n];
  window[n] = function (...a) { const t = performance.now(); const r = f.apply(this, a); ui += performance.now() - t; return r; };
}
// En el original, render() llama a la interfaz por dentro: se resta para separarla
const rd = window.render;
window.render = function (now) { ui = 0; const t = performance.now(); rd(now); perf.frame.render += performance.now() - t - ui; perf.frame.ui += ui; endFrame(now); };
window.__orig = { get state() { return state; }, prepareRoster, startFriendly, resolveVoteAndPlay, setMap, stepPhysics: sp, render: rd, setMenu(v) { uiMenuOpen = v; } };
})();
</script>`;

const out = html.replace(/<\/script>\s*<\/body>/, `</script>\n${injected}\n</body>`);
if (out === html) throw new Error('No se encontró el final del <script> del original');
mkdirSync('perf-original', { recursive: true });
writeFileSync('perf-original/index.html', out);
console.log('Listo: perf-original/index.html (con npm run dev: http://localhost:5173/perf-original/)');
