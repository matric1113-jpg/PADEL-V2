// Simulación sin pantalla: 4 bots juegan partidos amistosos (a 2 sets), americanos y el torneo usando solo la lógica (src/core).
// Sirve para detectar errores en las reglas sin abrir el navegador y para comparar el efecto de un ajuste.
//   npm run sim                       3 modos x 120000 cuadros, semilla 1
//   npm run sim -- 300000 7 friendly  cuadros, semilla y modo (friendly | americano | run)
// El azar está sembrado: con la misma semilla y el mismo código sale exactamente lo mismo.
// En el modo amistoso además comprueba el flujo de sets: cada set nuevo parte con marcador en cero, $700 y sin
// activas ni sombreros, los sets no se pierden, el partido termina recién con SETS_TO_WIN sets y pasa por el podio.
// El amistoso se juega con los equipos cambiados en la sala (el anfitrión pasa al rojo), como lo haría el anfitrión.
// En el americano comprueba las parejas de cada set, el set a AMERICANO_GAMES_TO_WIN juegos, la suma de juegos de cada
// jugador y la tabla final. Además hay pruebas cortas fijas: desempates de la tabla y el clic pendiente al volver al saque.
import { localInput, menuSel, rt, state } from '../src/core/state.js';
import { ACTIVE_COST, ALL_ACTIVE_IDS, ALL_MAP_IDS, BOSSES, FRIENDLY_START_MONEY, LAB_RIVALS, MAP_IDS, MUTATOR_IDS, UPG, runReward } from '../src/core/data.js';
import { padsNow, tileOf } from '../src/core/floor.js';
import { DOORS, insideCourt } from '../src/core/walls.js';
import { PAD_JUMP_H, AMERICANO_GAMES_TO_WIN, JUMP_LAND_FRAMES, JUMP_LAND_STOP, JUMP_MAX_H, JUMP_MIN_H, MIN_SWING_CHARGE, SETS_TO_WIN } from '../src/core/constants.js';
import { AMERICANO_PAIRS, americanoRanking, prepareRoster, resolveVoteAndPlay, setMap, setupServe, startBossMatch, startFriendly, startMatch, startRun, swapSeats } from '../src/core/game.js';
import { stepPhysics } from '../src/core/physics.js';

const FRAMES = Number(process.argv[2] || 120000);
const SEED = Number(process.argv[3] || 1);
const MODES = process.argv[4] ? [process.argv[4]] : ['friendly', 'americano', 'run', 'lab'];

// mulberry32: generador pequeño con semilla
let seed = SEED >>> 0;
Math.random = () => {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let points = 0, shops = 0, matches = 0, newSets = 0, podiums = 0, americanos = 0, labs = 0, falls = 0;
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

const teamsOf = () => [0, 1].map(t => state.players.filter(p => p.team === t).map(p => p.uid).sort().join('+')).join(' vs ');
function checkSeats() {
  state.players.forEach((p, i) => { if (p.team !== (i < 2 ? 0 : 1)) fail('el equipo no coincide con el puesto'); });
  if (state.players[rt.mySlot].uid !== rt.myUid) fail('rt.mySlot no apunta a mi jugador');
}
// Americano: en cada set nuevo, las parejas son las de AMERICANO_PAIRS con el orden A, B, C, D
function checkAmericanoSet() {
  const A = state.amer, o = A.order, s = AMERICANO_PAIRS[A.set];
  const want = [[o[s[0]], o[s[1]]], [o[s[2]], o[s[3]]]].map(t => t.sort().join('+')).join(' vs ');
  if (teamsOf() !== want) fail(`parejas del set ${A.set + 1}: ${teamsOf()} en vez de ${want}`);
  checkSeats();
}
function checkAmericanoEnd() {
  const A = state.amer;
  if (A.set !== AMERICANO_PAIRS.length - 1 || A.history.length !== AMERICANO_PAIRS.length) fail('el americano terminó sin jugar los ' + AMERICANO_PAIRS.length + ' sets');
  const total = A.history.reduce((a, h) => a + h.games[0] + h.games[1], 0);
  for (const h of A.history) if (Math.max(...h.games) !== AMERICANO_GAMES_TO_WIN || Math.min(...h.games) >= AMERICANO_GAMES_TO_WIN) fail('un set no terminó al llegar a ' + AMERICANO_GAMES_TO_WIN);
  for (const u of A.order) {
    if (A.pts[u] + A.against[u] !== total) fail(`${u} no jugó todos los juegos (${A.pts[u]} + ${A.against[u]} != ${total})`);
    const won = A.history.reduce((a, h) => a + (h.teams[0].includes(u) ? h.games[0] : h.games[1]), 0);
    if (won !== A.pts[u]) fail(`los juegos ganados de ${u} no coinciden con el historial`);
  }
  const r = state.result;
  if (!r || !r.americano || r.ranking.length !== 4 || r.ranking[0].place !== 1) fail('tabla final inválida');
  if (JSON.stringify(r.ranking) !== JSON.stringify(americanoRanking())) fail('la tabla final no es la de la lógica');
}

// Laboratorio: cada partido cambia de rival, cancha, activa y mutadores, para pasar por todas las combinaciones
function labSetup(n) {
  menuSel.lab = {
    map: ALL_MAP_IDS[(n * 4 + 6) % ALL_MAP_IDS.length], rival: n % LAB_RIVALS.length, active: ALL_ACTIVE_IDS[n % ALL_ACTIVE_IDS.length],
    ups: n % 3, games: 1 + (n % 2), mods: n % 4 === 3 ? [MUTATOR_IDS[n % MUTATOR_IDS.length], MUTATOR_IDS[(n + 3) % MUTATOR_IDS.length]] : []
  };
  prepareRoster('lab');
  if (!state.run.lab || state.mode !== 'run') fail('el laboratorio no quedó armado');
  state.players.forEach(p => { p.isBot = true; });
  state.players[1].skill = 0.9;
  startMatch();
  // en la simulación no hay humanos: la activa elegida la lleva el bot del puesto 0
  state.players[0].active = menuSel.lab.active;
  state.players[0].skill = 0.9;
  if (state.screen !== 'play' || state.map !== menuSel.lab.map) fail('el laboratorio no empezó en la cancha elegida');
}

function setup(mode) {
  if (mode === 'lab') { labSetup(labs); return; }
  prepareRoster(mode);
  state.players.forEach(p => { p.isBot = true; p.skill = 1; });
  if (mode === 'friendly') {
    // Como en la sala: el anfitrión (u0) se cambia al equipo rojo intercambiándose con el puesto 2
    state.screen = 'lobby';
    swapSeats(0, 2);
    if (teamsOf() !== 'u1+u2 vs u0+u3' || rt.mySlot !== 2) fail('swapSeats no armó los equipos: ' + teamsOf());
    checkSeats();
  }
  startMatch();
}

// Desempates de la tabla del americano: más juegos ganados, luego menos en contra; si sigue igual, comparten puesto
function testRanking() {
  prepareRoster('americano');
  startMatch();
  const A = state.amer, [a, b, c, d] = A.order;
  const cases = [
    [{ [a]: 9, [b]: 7, [c]: 7, [d]: 5 }, { [a]: 3, [b]: 4, [c]: 5, [d]: 7 }, [1, 2, 3, 4]],
    [{ [a]: 8, [b]: 8, [c]: 6, [d]: 6 }, { [a]: 4, [b]: 4, [c]: 6, [d]: 7 }, [1, 1, 3, 4]],
    [{ [a]: 6, [b]: 6, [c]: 6, [d]: 6 }, { [a]: 6, [b]: 6, [c]: 6, [d]: 6 }, [1, 1, 1, 1]],
    [{ [a]: 5, [b]: 7, [c]: 7, [d]: 7 }, { [a]: 7, [b]: 5, [c]: 5, [d]: 6 }, [4, 1, 1, 3]]
  ];
  for (const [pts, against, places] of cases) {
    A.pts = pts; A.against = against;
    const got = A.order.map(u => americanoRanking().find(r => r.uid === u).place);
    if (got.join() !== places.join()) fail(`desempate: ${got} en vez de ${places}`);
  }
}

// Un clic soltado durante la pausa o la tienda no debe hacer sacar solo a quien saca al volver al juego
function testStaleRelease() {
  prepareRoster('friendly');
  startFriendly();
  const me = state.players[rt.mySlot];
  me.isBot = false;
  state.serverSlot = rt.mySlot;
  stepPhysics();                       // tienda: registra el input del anfitrión
  localInput.releaseSeq++;             // suelta el clic mientras está en la tienda
  stepPhysics();
  resolveVoteAndPlay();
  for (let k = 0; k < 30; k++) stepPhysics();
  if (state.phase !== 'SERVE') fail('el saque salió solo con un clic de la tienda');
  localInput.releaseSeq++;             // un clic en el juego sí saca
  for (let k = 0; k < 3; k++) stepPhysics();
  if (state.phase !== 'PLAY') fail('un clic en el juego no sacó');
  me.isBot = true;
}
// Salto: se carga con el Espacio y salta al soltarlo; un toque salta poco y la carga completa, JUMP_MAX_H.
// Al caer queda clavado un instante y después corre más lento un rato
function testJump() {
  prepareRoster('friendly');
  startFriendly();
  resolveVoteAndPlay();
  const me = state.players[rt.mySlot];
  me.isBot = false;
  state.serverSlot = (rt.mySlot + 2) % 4;     // saca un rival (bot), así el jugador puede saltar
  state.phase = 'PLAY'; state.ball.x = 700; state.ball.z = 40; state.ball.vx = 0; state.ball.vz = 0;
  // (la pelota se deja quieta en el aire del otro lado para que no termine el punto)
  const step = () => { state.phase = 'PLAY'; Object.assign(state.ball, { x: 700, z: 40, vx: 0, vy: 0, vz: 0 }); stepPhysics(); };
  const reset = () => { me.jz = 0; me.jvz = 0; me.jumpCharge = 0; me.landStop = 0; me.landSlow = 0; me.x = 300; me.y = 260; };
  // Carga "held" cuadros, suelta y mide hasta caer. Mientras carga no salta.
  const jumpFor = held => {
    reset();
    localInput.jump = true;
    for (let k = 0; k < held; k++) { step(); if (me.jz > 0) fail('saltó antes de soltar el Espacio'); }
    localInput.jump = false;
    let top = 0, frames = 0;
    for (let k = 0; k < 120; k++) {
      step();
      top = Math.max(top, me.jz);
      if (me.jz === 0 && me.jvz === 0) break;
      frames++;
    }
    return { top, frames, stop: me.landStop };
  };
  const short = jumpFor(1), mid = jumpFor(15), long = jumpFor(60);
  if (!(short.top >= JUMP_MIN_H - 1 && short.top < JUMP_MIN_H + 2)) fail('salto corto de altura rara: ' + short.top.toFixed(1));
  if (!(mid.top > short.top + 4 && mid.top < long.top - 4)) fail('la carga a medias no da un salto intermedio: ' + mid.top.toFixed(1));
  if (!(long.top > JUMP_MAX_H - 2 && long.top <= JUMP_MAX_H + 1)) fail('salto largo de altura rara: ' + long.top.toFixed(1));
  if (long.stop < JUMP_LAND_STOP - 2 || short.stop > long.stop) fail('al caer no queda clavado (más rato tras un salto alto)');
  // Recién caído: clavado; después del clavado, más lento; al final, normal
  localInput.left = true;
  const x0 = me.x; step(); const stuck = Math.abs(me.x - x0);
  while (me.landStop > 0) step();
  const x1 = me.x; step(); const slowStep = Math.abs(me.x - x1);
  for (let k = 0; k < JUMP_LAND_FRAMES; k++) { localInput.left = k % 2 === 0; localInput.right = !localInput.left; step(); }
  localInput.right = false; localInput.left = true;
  const x2 = me.x; step(); const fullStep = Math.abs(me.x - x2); localInput.left = false;
  if (stuck !== 0) fail('recién caído se movió');
  if (!(slowStep < fullStep * 0.95)) fail(`después del clavado no corre más lento (${slowStep.toFixed(2)} vs ${fullStep.toFixed(2)})`);
  me.isBot = true;
  console.log(`salto: toque ${short.top.toFixed(1)} de alto, media carga ${mid.top.toFixed(1)}, carga completa ${long.top.toFixed(1)} (${long.frames} cuadros en el aire); al caer clavado ${long.stop} cuadros y luego corre a ${(slowStep / fullStep * 100).toFixed(0)} %`);
}
// Pelota que sale por 4: el punto no se da al cruzar la pared, sino al tocar el suelo de afuera
function testOutBall() {
  prepareRoster('friendly'); startFriendly(); resolveVoteAndPlay();
  state.players.forEach(p => { p.isBot = true; p.skill = 0.1; p.x = p.team === 0 ? 300 : 620; });   // lejos, sin rescatar
  state.phase = 'PLAY';
  const b = state.ball;
  Object.assign(b, { x: 800, y: 260, z: 130, vx: 4, vy: 0, vz: 3, lastHitTeam: 0, bouncesInOpponentSide: 1, shotType: 'DRIVE', isServeShot: false, out: false });
  const s0 = state.score.slice();
  let crossed = -1, k = 0;
  for (; k < 200 && state.phase === 'PLAY'; k++) { stepPhysics(); if (b.out && crossed < 0) crossed = k; }
  if (crossed < 0) fail('la pelota no salió por encima del fondo');
  if (k - crossed < 3) fail('el punto terminó al cruzar la pared, no al tocar el suelo de afuera');
  if (state.score[0] !== s0[0] + 1 || !/^Por 4/.test(state.bannerText)) fail('el por 4 no fue para quien pegó: ' + state.bannerText);
}

// Puertas: por la propia puerta se sale (y se vuelve a entrar); contra la pared no
function testDoors() {
  prepareRoster('friendly'); startFriendly(); resolveVoteAndPlay();
  const me = state.players[rt.mySlot];
  me.isBot = false;
  state.serverSlot = (rt.mySlot + 2) % 4;
  const step = () => { state.phase = 'PLAY'; Object.assign(state.ball, { x: 700, y: 260, z: 40, vx: 0, vy: 0, vz: 0, out: false }); stepPhysics(); };
  const dc = (DOORS[0][0] + DOORS[0][1]) / 2;
  me.x = dc + 6; me.y = 400; me.outside = false;
  localInput.down = true;
  for (let k = 0; k < 80; k++) step();
  localInput.down = false;
  if (!me.outside || me.y < 480) fail(`no salió por la puerta (${me.x.toFixed(0)}, ${me.y.toFixed(0)})`);
  localInput.up = true;
  for (let k = 0; k < 80; k++) step();
  localInput.up = false;
  if (me.outside || !insideCourt(me.x, me.y)) fail('no volvió a entrar por la puerta');
  me.x = 120; me.y = 400;
  localInput.down = true;
  for (let k = 0; k < 80; k++) step();
  localInput.down = false;
  if (me.outside || me.y > 480) fail('atravesó la pared lejos de la puerta');
  me.isBot = true;
}

// Doble golpe: la pelota que pegó su equipo y vuelve a su lado es falta si el mismo jugador o su compañero la toca con la
// pala; si ya salió por 3 o por 4 no cuenta. Raquetazo al compañero: según la carga lo aturde 2 a 4 s o lo tira al suelo hasta que termine el punto, sin dar punto
function testDoubleHit() {
  prepareRoster('friendly'); startFriendly(); resolveVoteAndPlay();
  const me = state.players[rt.mySlot], mate = state.players[rt.mySlot ^ 1];
  const rivals = state.players.filter(p => p.team !== me.team);
  me.isBot = false;
  const b = state.ball;
  const dir = me.team === 0 ? 1 : -1;
  const setup = who => {
    state.phase = 'PLAY'; state.screen = 'play'; state.score = [0, 0];
    Object.assign(b, { x: me.team === 0 ? 300 : 620, y: 260, z: 30, vx: 0, vy: 0, vz: 0, lastHitTeam: me.team, bouncesInOpponentSide: 0, out: false, isServeShot: false });
    for (const p of state.players) { p.swingTimer = 0; p.cooldown = 0; p.stun = 0; p.jz = 0; p.jvz = 0; p.landStop = 0; }
    me.x = b.x - dir * 100; me.y = 420; mate.x = b.x - dir * 100; mate.y = 100;   // lejos de la pelota
    rivals.forEach(r => { r.x = r.team === 0 ? 150 : 780; r.y = r.uid === rivals[0].uid ? 100 : 420; });
    const q = who === 'me' ? me : mate;
    q.x = b.x - dir * 17 * (1 / 1.15); q.y = b.y - 6 * (1 / 1.15);                  // la pala justo en la pelota
    q.swingTimer = 5;
  };
  const stepFrozen = () => { Object.assign(b, { x: b.x, y: b.y, z: 30, vx: 0, vy: 0, vz: 0 }); stepPhysics(); };
  for (const who of ['me', 'mate']) {
    setup(who);
    stepFrozen();
    if (state.score[1 - me.team] !== 1 || !/^Falta: doble golpe/.test(state.bannerText.split('\n')[0] || '')) fail(`doble golpe de ${who}: ${state.bannerText} ${state.score}`);
  }
  setup('mate'); b.out = true; b.outTeam = me.team;
  stepFrozen();
  if (state.score[0] + state.score[1] !== 0) fail('la pelota afuera contó como doble golpe');
  setup('mate'); b.lastHitTeam = 1 - me.team;
  stepFrozen();
  if (state.score[1 - me.team] !== 0 || b.lastHitTeam !== me.team) fail('un golpe normal al saque del rival se contó como falta');

  // Raquetazo al compañero
  // Con la pala justo en el compañero y una carga dada: pega y devuelve cuántos cuadros queda aturdido
  const hitMate = charge => {
    setup('mate'); b.lastHitTeam = 1 - me.team; b.x = me.team === 0 ? 700 : 220;      // pelota lejos, en el lado rival
    me.x = mate.x - dir * 17 / 1.15; me.y = mate.y - 6 / 1.15; me.swingTimer = 5;        // el compañero queda donde pega mi pala
    me.swingCharge = charge; mate.swingTimer = 0; mate.down = false;
    stepFrozen();
    return mate.stun;
  };
  const soft = hitMate(MIN_SWING_CHARGE);
  if (soft < 100 || soft > 120) fail('el golpe más suave no aturdió 2 s: ' + soft);
  const mx = mate.x; stepFrozen();
  if (mate.x !== mx) fail('el compañero aturdido se movió');
  for (let k = 0; k < 125; k++) stepFrozen();
  if (mate.stun !== 0 || mate.down) fail('el aturdimiento no terminó');
  const mid = hitMate(0.5);
  if (mid < 220 || mid > 240 || mate.down) fail('el golpe con la mitad de carga no aturdió 4 s: ' + mid + ' down=' + mate.down);
  const between = hitMate((MIN_SWING_CHARGE + 0.5) / 2);
  if (!(between > soft + 30 && between < mid - 30)) fail('la carga intermedia no da un aturdimiento intermedio: ' + between);
  if (hitMate(0.8) < 1000 || !mate.down) fail('con más de la mitad de carga el compañero no cayó al suelo');
  for (let k = 0; k < 600; k++) stepFrozen();   // 10 s después sigue en el suelo mientras el punto no termina
  if (!mate.down || mate.stun <= 0) fail('el compañero noqueado se levantó antes de que terminara el punto');
  setupServe(0);                                 // el punto siguiente: de pie otra vez
  if (mate.down || mate.stun !== 0) fail('el compañero noqueado no se levantó en el punto siguiente');
  if (state.score[0] + state.score[1] !== 0) fail('el raquetazo al compañero dio punto');
  setup('mate'); me.x = b.x - dir * 300; me.y = 420; b.x = me.team === 0 ? 700 : 220; b.lastHitTeam = 1 - me.team;   // compañero lejos de mi pala
  me.swingTimer = 5; stepFrozen();
  if (mate.stun !== 0) fail('un raquetazo lejos aturdió al compañero');
  me.isBot = true;
}

// Laboratorio: hoyos del piso (caer, saltarlos, pelota al vacío), camas elásticas y terremoto
function testLab() {
  const begin = (map, mods = []) => {
    menuSel.lab = { map, rival: LAB_RIVALS.length - 1, active: '', ups: 0, games: 1, mods };
    prepareRoster('lab');
    state.players.forEach(p => { p.isBot = true; p.skill = 1; });
    startMatch();
    state.phase = 'PLAY';
    const b = state.ball;
    Object.assign(b, { x: 600, y: 260, z: 150, vx: 0, vy: 0, vz: 0, lastHitTeam: 0, isServeShot: false, bouncesInOpponentSide: 0 });
    state.hz.hole = 100000;
  };
  // 1. pisar un hoyo es caer; en el aire se pasa por encima; al punto siguiente vuelve y el piso se rearma
  begin('abismo');
  const [p0, p1] = state.players;
  p0.x = 180; p0.y = 170; p1.x = 180; p1.y = 350;   // al centro de una baldosa
  state.holes = [{ i: tileOf(p0.x, p0.y), w: 0 }, { i: tileOf(p1.x, p1.y), w: 0 }];
  p1.jz = 20; p1.jvz = 3;
  stepPhysics();
  if (!p0.fell) fail('no cayó por el hoyo');
  if (p1.fell) fail('cayó por un hoyo estando en el aire');
  stepPhysics(); stepPhysics();
  if (!(p0.jz < 0)) fail('quien cayó no sigue cayendo');
  setupServe(0);
  if (p0.fell || p0.jz !== 0 || state.holes.length) fail('el piso o el jugador no volvieron al punto siguiente');
  // 2. una baldosa que avisa todavía no es hoyo
  begin('abismo');
  state.players[0].x = 180; state.players[0].y = 170;
  state.holes = [{ i: tileOf(180, 170), w: 50 }];
  stepPhysics();
  if (state.players[0].fell) fail('cayó por una baldosa que solo estaba avisando');
  // 3. la pelota que bota en un hoyo del lado rival es punto para quien pegó
  begin('chile');
  Object.assign(state.ball, { x: 730, y: 300, z: 1, vz: -2 });
  state.holes = [{ i: tileOf(730, 300), w: 0 }];
  stepPhysics();
  if (state.score[0] !== 1 || !/Al vacío/.test(state.bannerText)) fail('la pelota en el hoyo no dio el punto: ' + state.bannerText);
  // 4. cama elástica: quien la pisa salta PAD_JUMP_H
  begin('circo');
  const pad = padsNow()[0], q = state.players[0];
  if (!pad) fail('el circo no tiene camas elásticas');
  q.x = pad.x; q.y = pad.y; q.skill = 0;
  let top = 0;
  for (let k = 0; k < 40; k++) { stepPhysics(); q.x = 100; q.y = 100; top = Math.max(top, q.jz); state.ball.z = 150; state.ball.vz = 0; }
  if (Math.abs(top - PAD_JUMP_H) > 1.5) fail('la cama elástica no lanzó a la altura esperada: ' + top);
  // 5. terremoto: aturde a quien pisa el suelo, no a quien está en el aire
  begin('chile');
  const [a, c] = state.players;
  c.jz = 12; c.jvz = 2;
  state.quake = { team: 0, t: 1, id: 1 };
  stepPhysics();
  if (!(a.stun > 0) || c.stun > 0 || state.quake) fail('el terremoto no aturdió solo a quien pisaba el suelo');
  // 6. mutadores: suman peligros a la cancha elegida
  begin('chile', ['holes', 'pads']);
  if (!padsNow().length) fail('el mutador de camas elásticas no se aplicó');
  state.hz.hole = 1;
  stepPhysics();
  if (state.holes.length !== 2) fail('el mutador del piso que se cae no abrió una baldosa por lado');
}

// Premio del torneo según el marcador
function testRewards() {
  const one = BOSSES.find(B => B.gamesToWin === 1), three = BOSSES.find(B => B.gamesToWin > 1);
  const got = [[4, 0], [4, 1], [4, 2], [4, 3]].map(s => runReward(one, s, [1, 0])).concat([runReward(three, [4, 0], [2, 0]), runReward(three, [4, 2], [2, 1])]);
  if (got.join() !== '1500,1100,900,700,1500,1000') fail('premios del torneo: ' + got.join());
}

testLab();
testRanking();
testStaleRelease();
testJump();
testOutBall();
testDoors();
testDoubleHit();
testRewards();
console.log('pruebas fijas: laboratorio (hoyos, camas elásticas, terremoto, mutadores), desempates del americano, clic pendiente al sacar, salto, pelota afuera, puertas, doble golpe, raquetazo al compañero y premios, sin errores');

for (const mode of MODES) {
  setup(mode);
  let lastScore = '', inPodium = false;
  for (let f = 0; f < FRAMES; f++) {
    const s = state.screen;
    if (s === 'shop2') {
      shops++;
      if (state.vote.first) {
        checkNewSet(state.setHistory.length ? state.sets.slice() : [0, 0]);
        if (state.setHistory.length) newSets++;
        if (state.mode === 'americano') checkAmericanoSet();
        else if (state.mode === 'friendly' && teamsOf() !== 'u1+u2 vs u0+u3') fail('los equipos de la sala se perdieron: ' + teamsOf());
      }
      resolveVoteAndPlay();
      setMap(MAP_IDS[shops % MAP_IDS.length]);   // recorre los 6 mapas (así también se prueban el viento, la inclinación y los rayos)
    } else if (s === 'matchover' && state.mode === 'americano') {
      americanos++;
      checkAmericanoEnd();
      startMatch();
      checkNewSet([0, 0]);
      checkAmericanoSet();
    } else if (s === 'matchover') {
      matches++;
      const [a, b] = state.sets;
      if (Math.max(a, b) !== SETS_TO_WIN || Math.min(a, b) >= SETS_TO_WIN) fail('el partido terminó sin un ganador a ' + SETS_TO_WIN + ' sets');
      if (state.setHistory.length !== a + b) fail('el historial no coincide con los sets');
      if (!state.result || !state.result.match || state.result.winner !== (a > b ? 0 : 1)) fail('el resultado final no coincide');
      startMatch();
      checkNewSet([0, 0]);
    } else if (s === 'route') startBossMatch();
    else if (s === 'shop') { state.run.boss++; setMap(BOSSES[state.run.boss].map); state.screen = 'route'; }
    else if (s === 'lost' || s === 'champion') startRun();
    else if (s === 'labover') {
      if (!state.result || !state.result.lab || Math.max(...state.games) !== state.run.lab.games) fail('el laboratorio terminó sin llegar a los juegos pedidos');
      labs++;
      labSetup(labs);
    }
    else stepPhysics();   // también durante 'podium': la cuenta de la cinemática la lleva la física
    if (state.screen === 'podium' && !inPodium) {
      podiums++;
      if (state.mode === 'americano' ? state.amer.history.length !== AMERICANO_PAIRS.length : Math.max(...state.sets) !== SETS_TO_WIN) fail('podio antes de tiempo');
    }
    inPodium = state.screen === 'podium';
    const key = state.score.join('-') + '|' + state.games.join('-');
    if (key !== lastScore && state.phase === 'POINT_PAUSE') { points++; if (state.bannerText) { const r = reasonOf(state.bannerText); reasons.set(r, (reasons.get(r) || 0) + 1); } }
    lastScore = key;
    for (const p of state.players) if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.jz)) throw new Error('posición inválida en el cuadro ' + f);
    if (/se fue por un hoyo/.test(state.bannerText) && state.bannerTimer === 80) falls++;
    if (!Number.isFinite(state.ball.x) || !Number.isFinite(state.ball.z)) throw new Error('pelota inválida en el cuadro ' + f);
  }
  console.log(`${mode}: ${FRAMES} cuadros sin errores`);
}
console.log({ semilla: SEED, puntos: points, tiendas: shops, 'partidos amistosos': matches, americanos, 'sets nuevos abiertos': newSets, podios: podiums, 'partidos de laboratorio': labs, 'caídas por un hoyo': falls, host: rt.isHost });
const all = [...reasons].sort((a, b) => b[1] - a[1]);
console.log('Motivos de punto:');
for (const [r, n] of all) console.log(`  ${String(n).padStart(5)}  ${r}`);
