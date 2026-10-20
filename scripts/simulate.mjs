// Simulación sin pantalla: 4 bots juegan partidos amistosos y el torneo usando solo la lógica (src/core).
// Sirve para detectar errores en las reglas sin abrir el navegador y para comparar el efecto de un ajuste.
//   npm run sim                       2 modos x 120000 cuadros, semilla 1
//   npm run sim -- 300000 7 friendly  cuadros, semilla y modo (friendly | run)
// El azar está sembrado: con la misma semilla y el mismo código sale exactamente lo mismo.
import { rt, state } from '../src/core/state.js';
import { BOSSES } from '../src/core/data.js';
import { prepareRoster, resolveVoteAndPlay, setMap, startBossMatch, startFriendly, startRun } from '../src/core/game.js';
import { stepPhysics } from '../src/core/physics.js';

const FRAMES = Number(process.argv[2] || 120000);
const SEED = Number(process.argv[3] || 1);
const MODES = process.argv[4] ? [process.argv[4]] : ['friendly', 'run'];

// mulberry32: generador pequeño con semilla
let seed = SEED >>> 0;
Math.random = () => {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let points = 0, games = 0, shops = 0, sets = 0;
const reasons = new Map();

// El banner de un juego ganado trae el motivo del punto en la segunda línea
function reasonOf(text) {
  const [a, b] = text.split(String.fromCharCode(10));
  if (/^(Juego para|Punto de oro)/.test(a) && b) return b.replace(/\s+\(\d+-\d+\)$/, '');
  return a;
}

function setup(mode) {
  prepareRoster(mode);
  state.players.forEach(p => { p.isBot = true; p.skill = 1; });
  if (mode === 'run') startRun(); else startFriendly();
}

for (const mode of MODES) {
  setup(mode);
  let lastScore = '';
  for (let f = 0; f < FRAMES; f++) {
    const s = state.screen;
    if (s === 'shop2') { shops++; resolveVoteAndPlay(); }
    else if (s === 'setover') { sets++; startFriendly(); }
    else if (s === 'route') startBossMatch();
    else if (s === 'shop') { state.run.boss++; setMap(BOSSES[state.run.boss].map); state.screen = 'route'; }
    else if (s === 'lost' || s === 'champion') startRun();
    else stepPhysics();
    const key = state.score.join('-') + '|' + state.games.join('-');
    if (key !== lastScore && state.phase === 'POINT_PAUSE') { points++; if (state.bannerText) { const r = state.bannerText.split('\n')[0]; reasons.set(r, (reasons.get(r) || 0) + 1); } }
    lastScore = key;
    for (const p of state.players) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('posición inválida en el cuadro ' + f);
    if (!Number.isFinite(state.ball.x) || !Number.isFinite(state.ball.z)) throw new Error('pelota inválida en el cuadro ' + f);
  }
  console.log(`${mode}: ${FRAMES} cuadros sin errores`);
}
console.log({ semilla: SEED, puntos: points, tiendas: shops, sets, host: rt.isHost });
const all = [...reasons].sort((a, b) => b[1] - a[1]);
console.log('Motivos de punto:');
for (const [r, n] of all) console.log(`  ${String(n).padStart(5)}  ${r}`);
