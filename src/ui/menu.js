import { ensureAudio, playJingle } from '../audio/audio.js';
import { ACTIVES, ACTIVE_COST, ACTIVE_IDS, BOSSES, CHARACTERS, DIFFICULTIES, FRIENDLY_SHOP_MONEY, FRIENDLY_START_MONEY, LOOKS, MAPS, MAP_IDS, RUN_REWARD, UPGRADES } from '../core/data.js';
import { prepareRoster, setLook, setMap, setReady, setVote, startBossMatch, startFriendly, startRun, tryBuy } from '../core/game.js';
import { localInput, menuSel, rt, state } from '../core/state.js';
import { upLvl } from '../core/stats.js';
import { createRoom, joinRoom, leaveNetwork } from '../net/network.js';
import { renderPortrait } from '../render2d/players.js';

export function setStatus(t) { document.getElementById('status-text').innerText = t; }
export function setNetMsg(t) { rt.netMsg = t; rt.overlayKey = ''; }
let lastScreenSeen = 'menu';
const overlayEl = document.getElementById('overlay');

const fmt = n => Number(n).toLocaleString('es-CL');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function chooseChar(id) {
  menuSel.char = id;
  localInput.charId = id;
  localInput.speedPref = LOOKS[id].speed;
  if (rt.isHost && state.screen === 'menu') {
    setLook(state.players[0], id);
    state.players[0].isBot = false;
  }
}

export function openMenu() {
  leaveNetwork();
  rt.uiMenuOpen = true;
  state.screen = 'menu';
  state.mode = menuSel.mode;
  state.bannerTimer = 0;
  chooseChar(menuSel.char);
}

function playSolo() {
  leaveNetwork();
  prepareRoster(menuSel.mode);
  rt.uiMenuOpen = false;
  if (menuSel.mode === 'run') startRun(); else startFriendly();
}

function skillWord(sk) {
  if (sk > 1) return 'Nivel: más bravos que los bots originales.';
  if (sk < 0.3) return 'Nivel: de club, sin apuro.';
  if (sk < 0.55) return 'Nivel: intermedio.';
  if (sk < 0.85) return 'Nivel: bravos.';
  return 'Nivel: el de los bots originales.';
}

function hostButtons(primaryAct, primaryLabel, extra = '') {
  if (!rt.isHost) return '<span class="lbl">Esperando al anfitrión…</span>';
  return `<button class="primary big" data-act="${primaryAct}">${primaryLabel}</button>${extra}<button data-act="menu">Volver al menú</button>`;
}

function mapChip(id) {
  const M = MAPS[id];
  return `<span class="mapchip"><i style="background:${M.swatch}"></i>${esc(M.name)}</span>`;
}

// Camino del torneo: los 6 jefes y sus canchas
function routeHtml(current, done) {
  return `<div class="route">${BOSSES.map((B, k) => {
    const st = k < done ? 'done' : (k === current ? 'now' : 'locked');
    const faces = B.players.map(bp => `<canvas class="portrait mini" data-look="${bp.look}"></canvas>`).join('');
    return `<div class="stop ${st}">
      <div class="stop-n">${k < done ? 'Ganado' : 'Jefe ' + (k + 1)}</div>
      <div class="stop-faces">${faces}</div>
      <div class="stop-team">${esc(B.team)}</div>
      ${mapChip(B.map)}
      <div class="stop-meta">${B.gamesToWin > 1 ? 'Al mejor de 3' : '1 juego'}${B.solo ? ', 1 contra 2' : ''}</div>
    </div>`;
  }).join('<span class="route-link"></span>')}</div>`;
}

function statBars(L) {
  const v = Math.round(L.speed * 100);
  return `<div class="stat">Velocidad<span class="bar"><i style="width:${v}%"></i></span></div>` +
    `<div class="stat">Fuerza<span class="bar pw"><i style="width:${100 - v}%"></i></span></div>`;
}

function viewMenu() {
  const run = menuSel.mode === 'run';
  const cards = CHARACTERS.map(id => {
    const L = LOOKS[id];
    return `<button class="card${menuSel.char === id ? ' sel' : ''}" data-act="char" data-v="${id}">
      <canvas class="portrait" data-look="${id}"></canvas>
      <span class="nm">${esc(L.name)}</span><span class="rl">${L.role}</span>
      ${statBars(L)}<span class="ds">${esc(L.desc)}</span></button>`;
  }).join('');
  const diffs = DIFFICULTIES.map((d, i) =>
    `<button data-act="diff" data-v="${i}" class="${menuSel.diff === i ? 'sel' : ''}">${d.name}</button>`).join('');
  return `<div class="ov-panel">
    <div class="ov-title">Elige a tu jugador</div>
    <div class="ov-sub">Más velocidad significa menos fuerza, y al revés.</div>
    <div class="cards">${cards}</div>
    <div class="ov-h">Modo de juego</div>
    <div class="modes">
      <button class="mode${run ? ' sel' : ''}" data-act="mode" data-v="run"><h3>Torneo de jefes</h3>
        <p>${BOSSES.length} jefes, cada uno en su cancha: los 2 primeros a un juego y del 3 en adelante al mejor de 3. Cada victoria da $${fmt(RUN_REWARD)} por jugador para mejoras o activas. Si pierden, vuelven al inicio.</p></button>
      <button class="mode${run ? '' : ' sel'}" data-act="mode" data-v="friendly"><h3>Partido amistoso</h3>
        <p>Un set a 6 juegos, contra bots o con hasta 4 personas online. Tienda y votación de mapa al inicio, después del juego 2 y luego cada 3 juegos.</p></button>
    </div>
    ${run ? '' : `<div class="row"><span class="lbl">Nivel de los bots</span><div class="seg">${diffs}</div></div>`}
    <div class="row">
      <button class="primary big" data-act="solo">${run ? 'Jugar con un bot de compañero' : 'Jugar contra bots'}</button>
      <button class="big" data-act="host">${run ? 'Crear sala para tu compañero' : 'Crear sala online'}</button>
      <span class="spacer"></span>
      <input type="text" id="room-code-input" placeholder="Código" maxlength="6" value="${esc(menuSel.code)}" style="width: 96px; text-transform: uppercase;" aria-label="Código de sala">
      <button data-act="join">Unirse a una sala</button>
    </div>
    ${rt.netMsg ? `<div class="net-msg" role="status">${esc(rt.netMsg)}</div>` : ''}
  </div>`;
}

function viewConnecting() {
  return `<div class="ov-panel">
    <div class="ov-title">Entrando a la sala…</div>
    <div class="ov-sub">Conectado. Esperando datos del anfitrión: si se queda aquí, pídele que vuelva a la pestaña del juego.</div>
    <div class="row"><button data-act="menu">Cancelar</button></div>
  </div>`;
}

function viewLobby() {
  const run = state.mode === 'run';
  const rows = state.players.map((p, i) => {
    const kind = i === rt.mySlot ? '<span class="kind me">Tú</span>'
      : `<span class="kind">${p.isBot ? (run && p.team === 1 ? 'Jefe' : 'Bot') : 'Jugador online'}</span>`;
    return `<div class="slot${p.team ? ' red' : ''}"><span class="tm"></span><span>${esc(p.name)}</span>${kind}</div>`;
  }).join('');
  return `<div class="ov-panel">
    <div class="ov-title">${state.roomCode ? 'Sala ' + state.roomCode : 'Creando sala…'}</div>
    <div class="ov-sub">${run ? 'Tu compañero entra con este código desde "Unirse a una sala". Si nadie entra, juega un bot a tu lado.' : 'Comparte el código. Los puestos que nadie ocupe los juegan bots.'} Tus amigos escriben el código en "Unirse a una sala".</div>
    <div class="slots">${rows}</div>
    <div class="row">${rt.isHost ? '<button class="primary big" data-act="start">Empezar</button><button data-act="menu">Volver al menú</button>' : '<span class="lbl">Esperando que el anfitrión empiece…</span>'}</div>
  </div>`;
}

function walletsHtml() {
  return state.players.map((p, k) => (p.out || (state.mode === 'run' && p.team !== 0)) ? '' :
    `<div>${esc(p.name)}${k === rt.mySlot ? ' (tú)' : ''}: ${p.isBot ? (state.mode === 'run' ? '<span class="lbl">bot vanilla</span>' : '<span class="money sm">$' + fmt(p.money) + '</span>') : '<span class="money">$' + fmt(p.money) + '</span>'}${p.active ? ` <span class="actchip">${esc(ACTIVES[p.active].name)}</span>` : ''}${state.screen === 'shop2' && !p.isBot ? (p.ready ? ' <span class="okchip">Listo</span>' : '') : ''}</div>`).join('');
}

function shopItemsHtml() {
  const me = state.players[rt.mySlot];
  const canBuy = me && !me.isBot;
  const passives = UPGRADES.map(u => {
    const lvl = upLvl(me, u.id);
    const maxed = lvl >= u.max;
    const afford = me && me.money >= u.cost;
    const pips = Array.from({ length: u.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('');
    return `<div class="item"><h4>${u.name}</h4>${u.cosmetic ? '<span class="team">Estético</span>' : ''}
      <p>${u.desc}</p><div class="pips">${pips}</div>
      <button data-act="buy" data-v="${u.id}" ${(!canBuy || maxed || !afford) ? 'disabled' : ''}>${maxed ? 'Al máximo' : 'Comprar $' + fmt(u.cost)}</button></div>`;
  }).join('');
  const actives = ACTIVE_IDS.map(id => {
    const A = ACTIVES[id];
    const mine = me && me.active === id;
    const afford = me && me.money >= ACTIVE_COST;
    return `<div class="item act${mine ? ' mine' : ''}"><h4>${A.name}</h4><span class="team">Activa: 5 s, recarga 45 s</span>
      <p>${A.desc}</p>
      <button data-act="buy" data-v="${id}" ${(!canBuy || mine || !afford) ? 'disabled' : ''}>${mine ? 'Equipada' : (me && me.active ? 'Cambiar por $' : 'Comprar $') + fmt(ACTIVE_COST)}</button></div>`;
  }).join('');
  return `<div class="ov-h">Mejoras</div><div class="shop">${passives}</div>
    <div class="ov-h">Activas <span class="lbl">(reemplazan al sprint en Espacio; solo puedes tener una)</span></div><div class="shop">${actives}</div>`;
}

function viewShop() {
  const i = state.run.boss;
  const beaten = BOSSES[i];
  const r = state.result || { score: [4, 0], games: [1, 0] };
  return `<div class="ov-panel">
    <div class="ov-title">¡Le ganaron a ${esc(beaten.team)}!</div>
    <div class="ov-sub">${beaten.gamesToWin > 1 ? `Ganaron ${r.games[0]} juegos a ${r.games[1]}.` : `Ganaron el juego ${r.score[0]} puntos a ${r.score[1]}.`} Cada jugador recibe $${fmt(RUN_REWARD)}; la plata que no gasten se guarda.</div>
    <div class="wallets">${walletsHtml()}</div>
    ${shopItemsHtml()}
    <div class="row">${hostButtons('route', 'Ver el camino')}</div>
  </div>`;
}

function viewRoute() {
  const i = state.run.boss, B = BOSSES[i];
  const M = MAPS[B.map];
  return `<div class="ov-panel">
    <div class="ov-title">Torneo de jefes: jefe ${i + 1} de ${BOSSES.length}</div>
    <div class="ov-sub">Próximo rival: ${esc(B.team)} en ${esc(M.name)}. ${esc(M.desc)} ${B.gamesToWin > 1 ? 'Hay que ganarles 2 juegos.' : 'Basta con ganar un juego.'} ${skillWord(B.skill)}</div>
    ${routeHtml(i, i)}
    <div class="row">${hostButtons('go', 'Jugar contra ' + esc(B.team))}</div>
  </div>`;
}

function viewShop2() {
  const me = state.players[rt.mySlot];
  const first = state.vote && state.vote.first;
  const opts = [...MAP_IDS, 'random'].concat(first ? [] : ['keep']);
  const votes = {};
  state.players.forEach(p => { if (!p.isBot && p.vote) votes[p.vote] = (votes[p.vote] || 0) + 1; });
  const cards = opts.map(id => {
    const M = MAPS[id];
    const label = id === 'random' ? 'Mapa al azar' : id === 'keep' ? 'Seguir en ' + MAPS[state.map].name : M.name;
    const desc = id === 'random' ? 'Cualquiera de los 6.' : id === 'keep' ? 'Sin cambios.' : M.desc;
    const sw = M ? M.swatch : (id === 'random' ? 'conic-gradient(#e98a52, #45c3cf, #6b1b2b, #8fa2b4, #f5d58a, #ff6a1a, #e98a52)' : MAPS[state.map].swatch);
    return `<button class="mapcard${me && me.vote === id ? ' sel' : ''}" data-act="vote" data-v="${id}" ${me && !me.isBot ? '' : 'disabled'}>
      <i style="background:${sw}"></i><b>${esc(label)}</b>${M ? `<span class="tag">${M.tag}</span>` : ''}<span>${esc(desc)}</span>${votes[id] ? `<em>${votes[id]} voto${votes[id] > 1 ? 's' : ''}</em>` : ''}</button>`;
  }).join('');
  const humans = state.players.filter(p => !p.isBot && !p.out);
  const readyCount = humans.filter(p => p.ready).length;
  return `<div class="ov-panel">
    <div class="ov-title">${first ? 'Antes de empezar: tienda y mapa' : 'Tienda y votación de mapa'}</div>
    <div class="ov-sub">${first ? `Cada uno parte con $${fmt(FRIENDLY_START_MONEY)}.` : `+$${fmt(FRIENDLY_SHOP_MONEY)} para cada uno.`} La tienda vuelve a abrir después del juego 2 y luego cada 3 juegos. Votan solo los jugadores humanos.</div>
    <div class="wallets">${walletsHtml()}</div>
    <div class="ov-h">Mapa para los próximos juegos</div>
    <div class="maps">${cards}</div>
    ${shopItemsHtml()}
    <div class="row sticky"><button class="primary big" data-act="ready">${me && me.ready ? 'Listo (toca para cancelar)' : 'Listo'}</button>
      <span class="lbl">${readyCount} de ${humans.length} listos. Se empieza cuando todos estén listos.</span>
      <button data-act="menu">Volver al menú</button></div>
  </div>`;
}

function viewLost() {
  const i = state.run.boss, r = state.result || { score: [0, 4], games: [0, 1] };
  return `<div class="ov-panel">
    <div class="ov-title">Perdieron contra ${esc(BOSSES[i].team)}</div>
    <div class="ov-sub">${BOSSES[i].gamesToWin > 1 ? `Quedaron ${r.games[0]} juegos a ${r.games[1]}.` : `Quedaron ${r.score[0]} puntos a ${r.score[1]}.`} El torneo vuelve a empezar desde el jefe 1, sin plata ni mejoras.</div>
    ${routeHtml(i, i)}
    <div class="row">${hostButtons('restart', 'Empezar de nuevo')}</div>
  </div>`;
}

function viewChampion() {
  return `<div class="ov-panel">
    <div class="ov-title">¡Campeones del club!</div>
    <div class="ov-sub">Le ganaron a los ${BOSSES.length} jefes, incluido Zeus.</div>
    ${routeHtml(-1, BOSSES.length)}
    <div class="row">${hostButtons('restart', 'Nuevo torneo')}</div>
  </div>`;
}

function viewSetover() {
  const r = state.result || { winner: 0, games: [6, 0] };
  const myTeam = (state.players[rt.mySlot] || {}).team || 0;
  const won = r.winner === myTeam;
  return `<div class="ov-panel">
    <div class="ov-title">${won ? '¡Ganaron el set!' : 'Perdieron el set'}</div>
    <div class="ov-sub">Set para el equipo ${r.winner === 0 ? 'azul' : 'rojo'}, ${r.games[0]}-${r.games[1]}${r.tiebreak ? ' con tie-break' : ''}. Sets en la sesión: azul ${state.sets[0]}, rojo ${state.sets[1]}.</div>
    <div class="row">${hostButtons('again', 'Jugar otro set')}</div>
  </div>`;
}

const VIEWS = { connecting: viewConnecting, menu: viewMenu, lobby: viewLobby, route: viewRoute, shop: viewShop, shop2: viewShop2, lost: viewLost, champion: viewChampion, setover: viewSetover };

export function syncOverlay() {
  const view = rt.uiMenuOpen ? 'menu' : (!rt.isHost && !rt.gotHostState ? 'connecting' : state.screen);
  if (!rt.uiMenuOpen && state.screen !== lastScreenSeen) {
    const s = state.screen;
    const myTeam = (state.players[rt.mySlot] || {}).team || 0;
    if (s === 'shop' || s === 'champion') playJingle(true);
    else if (s === 'lost') playJingle(false);
    else if (s === 'setover' && state.result) playJingle(state.result.winner === myTeam);
  }
  lastScreenSeen = state.screen;

  if (!VIEWS[view]) {
    if (rt.overlayKey !== 'play') {
      overlayEl.classList.remove('show');
      overlayEl.innerHTML = '';
      rt.overlayKey = 'play';
    }
    return;
  }
  const data = view === 'menu' ? [menuSel.char, menuSel.mode, menuSel.diff, rt.netMsg]
    : [state.roomCode, state.mode, state.run, state.result, state.sets, rt.mySlot, rt.isHost, state.map, state.vote,
       state.players.map(p => [p.name, p.isBot, p.money, p.up, p.team, p.active, p.ready, p.vote, p.out])];
  const key = view + '|' + JSON.stringify(data);
  if (key === rt.overlayKey) return;
  rt.overlayKey = key;
  const scroll = overlayEl.scrollTop;
  overlayEl.innerHTML = VIEWS[view]();
  overlayEl.classList.add('show');
  overlayEl.scrollTop = scroll;
  overlayEl.querySelectorAll('canvas[data-look]').forEach(cv => renderPortrait(cv, cv.dataset.look));
}

overlayEl.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  ensureAudio();
  const v = t.dataset.v;
  switch (t.dataset.act) {
    case 'char': chooseChar(v); break;
    case 'mode': menuSel.mode = v; break;
    case 'diff': menuSel.diff = Number(v); break;
    case 'solo': playSolo(); break;
    case 'host': setNetMsg(''); createRoom(); break;
    case 'join': joinRoom(); break;
    case 'start': if (rt.isHost) { if (state.mode === 'run') startRun(); else startFriendly(); } break;
    case 'buy':
      if (rt.isHost) tryBuy(rt.mySlot, v);
      else if (rt.hostConn && rt.hostConn.open) rt.hostConn.send({ type: 'buy', id: v });
      break;
    case 'route': if (rt.isHost) { state.run.boss++; setMap(BOSSES[state.run.boss].map); state.screen = 'route'; } break;
    case 'go': if (rt.isHost) startBossMatch(); break;
    case 'vote':
      if (rt.isHost) setVote(rt.mySlot, v);
      else if (rt.hostConn && rt.hostConn.open) rt.hostConn.send({ type: 'vote', map: v });
      break;
    case 'ready':
      if (rt.isHost) setReady(rt.mySlot);
      else if (rt.hostConn && rt.hostConn.open) rt.hostConn.send({ type: 'ready' });
      break;
    case 'restart': if (rt.isHost) startRun(); break;
    case 'again': if (rt.isHost) startFriendly(); break;
    case 'menu': openMenu(); setNetMsg(''); break;
  }
  rt.overlayKey = '';
});
overlayEl.addEventListener('input', e => {
  if (e.target.id === 'room-code-input') menuSel.code = e.target.value;
});
overlayEl.addEventListener('keydown', e => {
  if (e.target.id === 'room-code-input' && e.key === 'Enter') joinRoom();
});

