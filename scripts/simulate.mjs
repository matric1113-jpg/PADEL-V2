// Simulación sin pantalla: 4 bots juegan partidos amistosos y el torneo usando solo la lógica (src/core).
// Sirve para detectar errores en las reglas sin abrir el navegador:  npm run sim
import { rt, state } from '../src/core/state.js';
import { BOSSES } from '../src/core/data.js';
import { prepareRoster, resolveVoteAndPlay, setMap, startBossMatch, startFriendly, startRun } from '../src/core/game.js';
import { stepPhysics } from '../src/core/physics.js';

const FRAMES = Number(process.argv[2] || 120000);
let points = 0, games = 0, shops = 0, sets = 0;
const reasons = new Map();

function setup(mode) {
  prepareRoster(mode);
  state.players.forEach(p => { p.isBot = true; p.skill = 1; });
  if (mode === 'run') startRun(); else startFriendly();
}

for (const mode of ['friendly', 'run']) {
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
console.log({ puntos: points, tiendas: shops, sets, host: rt.isHost });
console.log('Motivos de punto más frecuentes:', [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 6));
