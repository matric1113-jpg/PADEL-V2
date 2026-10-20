// Simulación sin pantalla: 4 bots juegan partidos amistosos (a 2 sets) y el torneo usando solo la lógica (src/core).
// Sirve para detectar errores en las reglas sin abrir el navegador y para comparar el efecto de un ajuste.
//   npm run sim                       2 modos x 120000 cuadros, semilla 1
//   npm run sim -- 300000 7 friendly  cuadros, semilla y modo (friendly | run)
// El azar está sembrado: con la misma semilla y el mismo código sale exactamente lo mismo.
// En el modo amistoso además comprueba el flujo de sets: cada set nuevo parte con marcador en cero, $700 y sin
// activas ni sombreros, los sets no se pierden, el partido termina recién con SETS_TO_WIN sets y pasa por el podio.
import { rt, state } from '../src/core/state.js';
import { ACTIVE_COST, BOSSES, FRIENDLY_START_MONEY, MAP_IDS, UPG } from '../src/core/data.js';
import { SETS_TO_WIN } from '../src/core/constants.js';
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

let points = 0, shops = 0, matches = 0, newSets = 0, podiums = 0;
const reasons = new Map();
const fail = msg => { throw new Error('flujo de sets: ' + msg + ' | ' + JSON.stringify({ sets: state.sets, historial: state.setHistory, pantalla: state.screen })); };

// El banner de un juego ganado trae el motivo del punto en la segunda línea
function reasonOf(text) {
  const [a, b] = text.split('\n');
  if (/^(Juego para|Punto de oro)/.test(a) && b) return b.replace(/\s+\(\d+-\d+\)$/, '');
  return a;
}

// Valor total de lo que tiene un jugador: dinero + mejoras + activa. Al abrir la tienda de un set nuevo es exactamente lo del inicio.
const wealth = p => p.money + Object.entries(p.up).reduce((a, [id, n]) => a + n * UPG[id].cost, 0) + (p.active ? ACTIVE_COST : 0);

function checkNewSet(prevSets) {
  if (state.score[0] || state.score[1] || state.games[0] || state.games[1] || state.tiebreak) fail('el marcador del set nuevo no está en cero');
  for (const p of state.players) {
    if (wealth(p) !== FRIENDLY_START_MONEY) fail(`el set nuevo no parte con $${FRIENDLY_START_MONEY} (${p.name}: ${wealth(p)})`);
    if (p.activeKind || p.activeT || p.clone || p.up.sombrero) fail('quedó una activa o un sombrero del set anterior');
  }
  if (state.sets[0] !== prevSets[0] || state.sets[1] !== prevSets[1]) fail('los sets cambiaron al abrir el set nuevo');
}

function setup(mode) {
  prepareRoster(mode);
  state.players.forEach(p => { p.isBot = true; p.skill = 1; });
  if (mode === 'run') startRun(); else startFriendly();
}

for (const mode of MODES) {
  setup(mode);
  let lastScore = '', inPodium = false;
  for (let f = 0; f < FRAMES; f++) {
    const s = state.screen;
    if (s === 'shop2') {
      shops++;
      if (state.vote.first) { checkNewSet(state.setHistory.length ? state.sets.slice() : [0, 0]); if (state.setHistory.length) newSets++; }
      resolveVoteAndPlay();
      setMap(MAP_IDS[shops % MAP_IDS.length]);   // recorre los 6 mapas (así también se prueban el viento, la inclinación y los rayos)
    } else if (s === 'matchover') {
      matches++;
      const [a, b] = state.sets;
      if (Math.max(a, b) !== SETS_TO_WIN || Math.min(a, b) >= SETS_TO_WIN) fail('el partido terminó sin un ganador a ' + SETS_TO_WIN + ' sets');
      if (state.setHistory.length !== a + b) fail('el historial no coincide con los sets');
      if (!state.result || !state.result.match || state.result.winner !== (a > b ? 0 : 1)) fail('el resultado final no coincide');
      startFriendly();
      checkNewSet([0, 0]);
    } else if (s === 'route') startBossMatch();
    else if (s === 'shop') { state.run.boss++; setMap(BOSSES[state.run.boss].map); state.screen = 'route'; }
    else if (s === 'lost' || s === 'champion') startRun();
    else stepPhysics();   // también durante 'podium': la cuenta de la cinemática la lleva la física
    if (state.screen === 'podium' && !inPodium) { podiums++; if (Math.max(...state.sets) !== SETS_TO_WIN) fail('podio antes de tiempo'); }
    inPodium = state.screen === 'podium';
    const key = state.score.join('-') + '|' + state.games.join('-');
    if (key !== lastScore && state.phase === 'POINT_PAUSE') { points++; if (state.bannerText) { const r = reasonOf(state.bannerText); reasons.set(r, (reasons.get(r) || 0) + 1); } }
    lastScore = key;
    for (const p of state.players) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('posición inválida en el cuadro ' + f);
    if (!Number.isFinite(state.ball.x) || !Number.isFinite(state.ball.z)) throw new Error('pelota inválida en el cuadro ' + f);
  }
  console.log(`${mode}: ${FRAMES} cuadros sin errores`);
}
console.log({ semilla: SEED, puntos: points, tiendas: shops, partidos: matches, 'sets nuevos abiertos': newSets, podios: podiums, host: rt.isHost });
const all = [...reasons].sort((a, b) => b[1] - a[1]);
console.log('Motivos de punto:');
for (const [r, n] of all) console.log(`  ${String(n).padStart(5)}  ${r}`);
