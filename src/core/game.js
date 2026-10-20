import { computeServeBox, nextServerSlot, showBanner } from './ballistics.js';
import { PAD_F, PAD_S, POINTS_LABELS, SETS_TO_WIN } from './constants.js';
import { ACTIVES, ACTIVE_COST, ACTIVE_IDS, BOSSES, CHARACTERS, DIFFICULTIES, FRIENDLY_SHOP_MONEY, FRIENDLY_START_MONEY, LOOKS, MAPS, MAP_IDS, RUN_REWARD, TALK, TEAMMATE_SKILL, UPG, UPGRADES } from './data.js';
import { hooks } from './events.js';
import { mapOf, menuSel, rt, state } from './state.js';
import { emptyUpgrades, upLvl } from './stats.js';
import { pick, shuffle } from './util.js';

export function emitSound(type) {
  state.soundTrigger.seq++;
  state.soundTrigger.type = type;
  hooks.sound(type);
  rt.lastPlayedSoundSeq = state.soundTrigger.seq;
}
export function setupServe(nextServerSlot) {
  state.phase = 'SERVE';
  if (state.players[nextServerSlot] && state.players[nextServerSlot].out) nextServerSlot = 2;
  state.serverSlot = nextServerSlot;
  state.serveBotTimer = 75;
  state.rally = { cp: [false, false] };
  state.bolts = [];

  const solo1 = state.players[3].out;
  const pos = [
    [145, 155], [145, 365],
    [775, solo1 ? 260 : 155], [775, 365]
  ];
  state.players.forEach((p, i) => {
    p.x = pos[i][0]; p.y = pos[i][1];
    p.vx = 0; p.vy = 0;
    p.charging = false; p.chargeFrames = 0;
    p.swingTimer = 0; p.cooldown = 0;
    p.activeT = 0; p.activeKind = ''; p.clone = null;
    p.stun = 0; p.slow = 0; p.burn = 0;
  });
  // Zeus saca desde un lado y luego cubre toda su mitad
  if (solo1 && nextServerSlot === 2) state.players[2].y = 155;
  state.ice = null;

  const server = state.players[state.serverSlot];
  state.serveTargetBox = computeServeBox(server);

  const dir = server.team === 0 ? 1 : -1;
  const b = state.ball;
  b.x = server.x + dir * (PAD_F + 3);
  b.y = server.y + PAD_S;
  b.z = 16;
  b.vx = 0; b.vy = 0; b.vz = 0;
  b.trail = [];
  b.isServeShot = true;
  b.bouncesInOpponentSide = 0;
  b.shotType = 'SAQUE';
  b.cpTarget = null;

  // El texto lo ven todos en la sala, así que nombra a quien saca
  showBanner(server.isBot ? 'Al saque: ' + server.name : 'Saca ' + server.name + '\nApunta al cuadro iluminado, carga y suelta el clic', 9999);
}

// ---- Frases ----
export function say(slot, text) {
  if (!text || !state.players[slot] || state.players[slot].out) return;
  state.talk = { seq: state.talk.seq + 1, slot, text };
}
export function talkLine(p, pool) {
  const own = TALK.byLook[p.lookId];
  return own && Math.random() < 0.45 ? pick(own) : pick(pool);
}
function maybeTalkAfterPoint(winner, isFault) {
  if (Math.random() > (isFault ? 0.35 : 0.4)) return;
  const cands = state.players.map((p, i) => i).filter(i => !state.players[i].out && state.players[i].team === winner);
  if (!cands.length) return;
  const slot = pick(cands);
  say(slot, talkLine(state.players[slot], isFault ? TALK.taunt : TALK.brag));
}

export function awardPoint(winningTeam, reason, isFault = false) {
  if (isFault) emitSound('fault');
  state.phase = 'POINT_PAUSE';
  state.pauseTimer = 95;
  state.score[winningTeam]++;

  // Repetición para los puntos espectaculares
  const spectacular = /^Por [34]/.test(reason) || reason.startsWith('Remate ganador') || state.rally.cp[winningTeam];
  if (spectacular) {
    state.replay = { seq: state.replay.seq + 1, reason: state.rally.cp[winningTeam] && !/^Por|^Remate/.test(reason) ? 'Salvada con contrapared' : reason };
    state.pauseTimer += 150;
  }
  maybeTalkAfterPoint(winningTeam, isFault);

  const other = 1 - winningTeam;
  const s = state.score;
  const gameWon = state.tiebreak
    ? (s[winningTeam] >= 7 && s[winningTeam] - s[other] >= 2)
    : s[winningTeam] >= 4;   // 40-40 = punto de oro: el siguiente punto gana

  if (gameWon) {
    const finalScore = [s[0], s[1]];
    state.games[winningTeam]++;
    state.score = [0, 0];
    state.celebrate = { seq: state.celebrate.seq + 1, team: winningTeam };
    state.pauseTimer += 80;
    const g = state.games;
    if (state.mode === 'run') {
      const B = BOSSES[state.run.boss];
      if (g[winningTeam] >= B.gamesToWin) endRunMatch(winningTeam, finalScore);
      else showBanner(`Juego para ${winningTeam === 0 ? 'ustedes' : B.team}\n${g[0]}-${g[1]} en juegos: gana el primero en llegar a ${B.gamesToWin}`, 140);
    } else {
      const setWon = state.tiebreak || (g[winningTeam] >= 6 && g[winningTeam] - g[other] >= 2);
      if (setWon) {
        const team = winningTeam === 0 ? 'azul' : 'rojo';
        state.sets[winningTeam]++;
        state.setHistory.push([g[0], g[1]]);
        const matchWon = state.sets[winningTeam] >= SETS_TO_WIN;
        state.result = { winner: winningTeam, games: [g[0], g[1]], tiebreak: state.tiebreak, match: matchWon };
        state.tiebreak = false;
        state.pauseTimer += 120;   // un rato más para la celebración
        // Un set no termina el partido: se juega otro (con tienda y mapa nuevos) hasta que alguien llegue a SETS_TO_WIN
        state.afterPause = matchWon ? 'podium' : 'nextset';
        showBanner(matchWon
          ? `¡Partido para el equipo ${team}!\nSets ${state.sets[0]}-${state.sets[1]}  (${state.setHistory.map(h => h.join('-')).join(', ')})`
          : `Set para el equipo ${team}: ${g[0]}-${g[1]}\nSets ${state.sets[0]}-${state.sets[1]}. Se juega otro set`, matchWon ? 9999 : 400);
      } else {
        if (g[0] === 6 && g[1] === 6) {
          state.tiebreak = true;
          showBanner(`Juego para el equipo ${winningTeam === 0 ? 'azul' : 'rojo'}\n6-6: tie-break a 7 puntos`, 140);
        } else {
          showBanner(`Juego para el equipo ${winningTeam === 0 ? 'azul' : 'rojo'}\n${reason}  (${g[0]}-${g[1]})`, 140);
        }
        // Tienda y votación: después del juego 2 y luego cada 3 juegos
        const played = g[0] + g[1];
        if (played === 2 || (played > 2 && (played - 2) % 3 === 0)) state.afterPause = 'shop2';
      }
    }
  } else if (state.tiebreak) {
    showBanner(`${reason}\nTie-break ${s[0]}-${s[1]}`, 95);
  } else if (s[0] === 3 && s[1] === 3) {
    showBanner(`Punto de oro, 40 iguales\n${reason}`, 100);
  } else {
    showBanner(`${reason}\n${POINTS_LABELS[s[0]]} – ${POINTS_LABELS[s[1]]}`, 95);
  }
  hooks.scoreChanged();
  state.serverSlot = nextServerSlot(state.serverSlot);
}

export function goToScreen(s) {
  state.bannerTimer = 0;
  if (s === 'shop2') openShop2(false);
  else if (s === 'nextset') beginSet();
  else if (s === 'podium') { rt.podiumT = 0; state.screen = 'podium'; }
  else state.screen = s;
}

export function setLook(p, id, speed) {
  const L = LOOKS[id];
  if (!L) return;
  p.lookId = id;
  p.name = L.name;
  p.speedStat = speed != null ? speed : L.speed;
  p.powerStat = 1 - p.speedStat;
}

function resetPlayerExtras(p) {
  p.up = emptyUpgrades();
  p.money = 0;
  p.active = ''; p.activePool = ''; p.activeKind = ''; p.activeT = 0; p.activeCd = 0; p.clone = null;
  p.bodyScale = 1; p.speedMult = 1; p.powerMult = 1; p.backPref = false; p.out = false;
  p.stun = 0; p.slow = 0; p.burn = 0; p.burnCd = 0;
  p.sprintCooldown = 0; p.sprintActiveTimer = 0;
  p.ready = false; p.vote = '';
}

export function setMap(id) {
  state.map = MAPS[id] ? id : 'chile';
  state.lights = [true, true];
  state.ice = null;
  state.embers = [];
  state.bolts = [];
  state.tilt = { x: 0, y: 0, t: 0 };
  state.gust = { w: 0, t: 0 };
  state.hz = { bolt: 600 + Math.random() * 300, tilt: 420, gust: 360 };
}

// Arma las parejas según el modo (lo llama el anfitrión antes de empezar)
export function prepareRoster(mode) {
  state.mode = mode;
  state.difficulty = DIFFICULTIES[menuSel.diff].skill;
  const pool = shuffle(CHARACTERS.filter(c => c !== menuSel.char));
  state.players.forEach((p, i) => {
    resetPlayerExtras(p);
    if (i === 0) {
      setLook(p, menuSel.char);
      p.isBot = false;
    } else if (!rt.connections[i]) {
      p.isBot = true;
      setLook(p, pool[i - 1]);
      p.skill = p.team === 0 ? Math.max(TEAMMATE_SKILL, state.difficulty) : state.difficulty;
    }
  });
  if (mode === 'run') {
    state.run = { boss: 0 };
    applyBoss(0);
  }
  state.sets = [0, 0];
  state.setHistory = [];
  state.score = [0, 0];
  state.games = [0, 0];
  state.tiebreak = false;
  state.result = null;
  hooks.scoreChanged();
}

function giveRandomUpgrades(p, n) {
  for (let k = 0; k < n; k++) {
    const opts = UPGRADES.filter(u => !u.cosmetic && upLvl(p, u.id) < u.max);
    if (!opts.length) return;
    p.up[pick(opts).id]++;
  }
}

function applyBoss(i) {
  const B = BOSSES[i];
  [2, 3].forEach((slot, k) => {
    const p = state.players[slot];
    resetPlayerExtras(p);
    const bp = B.players[k];
    if (!bp) { p.out = true; p.isBot = true; p.x = 2000; p.y = 2000; p.name = ''; return; }
    setLook(p, bp.look, bp.speed);
    if (bp.name) p.name = bp.name;
    p.isBot = true;
    p.skill = B.skill;
    p.bodyScale = bp.bodyScale || 1;
    p.speedMult = bp.speedMult || 1;
    p.powerMult = bp.powerMult || 1;
    p.backPref = !!bp.backPref;
    if (bp.ups) giveRandomUpgrades(p, bp.ups);
    if (bp.active === 'all') { p.activePool = 'all'; p.active = pick(ACTIVE_IDS); }
    else if (bp.active === 'random') p.active = pick(ACTIVE_IDS);
    else if (bp.active) p.active = bp.active;
    p.activeCd = 300 + Math.floor(Math.random() * 600);    // no la usan apenas parte el partido
  });
  // El compañero bot del torneo es vanilla y juega casi al nivel del jefe
  const mate = state.players[1];
  if (mate.isBot) {
    const keepLook = mate.lookId;
    resetPlayerExtras(mate);
    setLook(mate, keepLook);
    mate.skill = Math.max(0.3, B.skill - 0.05);
  }
}

// Partido amistoso nuevo (a SETS_TO_WIN sets)
export function startFriendly() {
  state.sets = [0, 0];
  state.setHistory = [];
  beginSet();
}

// Comienzo de cada set: marcador a cero, y todo vuelve a empezar como al principio (dinero, compras, activas, sombreros)
// con la tienda de $700 y la votación de mapa.
export function beginSet() {
  state.score = [0, 0];
  state.games = [0, 0];
  state.tiebreak = false;
  state.result = null;
  state.afterPause = null;
  state.players.forEach(p => {
    const keep = { lookId: p.lookId, name: p.name, isBot: p.isBot, skill: p.skill, speedStat: p.speedStat };
    resetPlayerExtras(p);
    Object.assign(p, keep);
    p.powerStat = 1 - p.speedStat;
  });
  hooks.scoreChanged();
  openShop2(true);
}

// ---- Tienda del 2v2 y votación de mapa ----
function openShop2(first) {
  const add = first ? FRIENDLY_START_MONEY : FRIENDLY_SHOP_MONEY;
  state.players.forEach(p => {
    if (p.out) return;
    p.money += add;
    p.ready = false;
    p.vote = '';
    if (p.isBot) botShop(p);
  });
  state.vote = { first };
  state.screen = 'shop2';
  state.bannerTimer = 0;
}

function botShop(p) {
  if (p.money >= ACTIVE_COST && (!p.active || Math.random() < 0.15) && Math.random() < 0.7) {
    p.active = pick(ACTIVE_IDS.filter(a => a !== p.active));
    p.money -= ACTIVE_COST;
  }
  if (!p.active && p.money < ACTIVE_COST && Math.random() < 0.45) return;   // ahorra para una activa
  for (let k = 0; k < 6; k++) {
    const opts = UPGRADES.filter(u => !u.cosmetic && upLvl(p, u.id) < u.max && u.cost <= p.money);
    if (!opts.length) break;
    const u = pick(opts);
    p.up[u.id]++;
    p.money -= u.cost;
  }
}

export function setVote(slot, mapId) {
  const p = state.players[slot];
  if (!p || p.isBot || state.screen !== 'shop2') return;
  if (mapId !== 'random' && mapId !== 'keep' && !MAPS[mapId]) return;
  p.vote = mapId;
}

export function setReady(slot) {
  const p = state.players[slot];
  if (!p || p.isBot || state.screen !== 'shop2') return;
  p.ready = !p.ready;
}

export function checkVoteReady() {
  const humans = state.players.filter(p => !p.isBot && !p.out);
  if (humans.length && humans.every(p => p.ready)) resolveVoteAndPlay();
}

export function resolveVoteAndPlay() {
  const counts = {};
  state.players.forEach(p => { if (!p.isBot && p.vote) counts[p.vote] = (counts[p.vote] || 0) + 1; });
  let best = [], max = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) { max = v; best = [k]; } else if (v === max) best.push(k);
  }
  let choice = best.length ? pick(best) : (state.vote.first ? 'random' : 'keep');
  if (choice === 'random') choice = pick(MAP_IDS);
  const changed = choice !== 'keep' && (choice !== state.map || state.vote.first);
  if (choice !== 'keep') setMap(choice);
  state.players.forEach(p => { p.ready = false; });
  state.screen = 'play';
  setupServe(state.serverSlot);
  const M = mapOf();
  showBanner(`${changed ? 'Mapa: ' : 'Siguen en '}${M.name}\n${M.desc}`, 200);
  hooks.scoreChanged();
}

// ---- Torneo ----
export function startRun() {
  state.mode = 'run';
  state.run = { boss: 0 };
  state.players.forEach(p => { if (p.team === 0) { const k = { lookId: p.lookId, name: p.name, isBot: p.isBot, skill: p.skill, speedStat: p.speedStat }; resetPlayerExtras(p); Object.assign(p, k); } });
  applyBoss(0);
  setMap(BOSSES[0].map);
  state.screen = 'route';
  state.bannerTimer = 0;
  hooks.scoreChanged();
}

export function startBossMatch() {
  const i = state.run.boss;
  const B = BOSSES[i];
  setMap(B.map);
  applyBoss(i);
  state.players.forEach(p => { p.sprintCooldown = 0; p.sprintActiveTimer = 0; if (p.team === 0) p.activeCd = 0; });
  state.score = [0, 0];
  state.games = [0, 0];
  state.tiebreak = false;
  state.result = null;
  state.afterPause = null;
  state.screen = 'play';
  setupServe(0);
  const serveLine = state.bannerText.split('\n').pop();
  showBanner(`Jefe ${i + 1} de ${BOSSES.length}: ${B.team}\n${B.gamesToWin > 1 ? 'Al mejor de 3 juegos. ' : ''}${serveLine}`, 9999);
  hooks.scoreChanged();
}

function endRunMatch(winner, finalScore) {
  const i = state.run.boss;
  state.result = { winner, score: finalScore, games: [...state.games], boss: i };
  if (winner === 0) {
    state.players.forEach(p => { if (p.team === 0 && !p.isBot) p.money += RUN_REWARD; });
    state.afterPause = i >= BOSSES.length - 1 ? 'champion' : 'shop';
    showBanner(`¡Le ganaron a ${BOSSES[i].team}!\n+$${RUN_REWARD.toLocaleString('es-CL')} para cada uno`, 9999);
  } else {
    state.afterPause = 'lost';
    showBanner(`Perdieron contra ${BOSSES[i].team}\nEl torneo vuelve a empezar`, 9999);
  }
}

export function tryBuy(slot, id) {
  const p = state.players[slot];
  if (!p || p.isBot || (state.screen !== 'shop' && state.screen !== 'shop2')) return;
  if (ACTIVES[id]) {
    if (p.active === id || p.money < ACTIVE_COST) return;
    p.money -= ACTIVE_COST;
    p.active = id;
    p.activeCd = 0; p.activeT = 0;
    return;
  }
  const u = UPG[id];
  if (!u) return;
  const lvl = upLvl(p, id);
  if (lvl >= u.max || p.money < u.cost) return;
  p.money -= u.cost;
  p.up[id] = lvl + 1;
}

function resetMatch() {
  if (!rt.isHost) return;
  if (state.mode === 'run') startRun();
  else startFriendly();
}
