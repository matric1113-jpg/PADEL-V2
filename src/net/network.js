import Peer from 'peerjs';
import { ensureAudio } from '../audio/audio.js';
import { hooks } from '../core/events.js';
import { showBanner } from '../core/ballistics.js';
import { PLAYABLE, TEAMMATE_SKILL } from '../core/data.js';
import { fixBotLooks, prepareRoster, resetSeats, setLook, setReady, setVote, tryBuy } from '../core/game.js';
import { recordFrame } from '../core/replay.js';
import { bossOf, localInput, menuSel, remoteInputs, rt, slotOfUid, state, syncMySlot } from '../core/state.js';
import { openMenu, setNetMsg, setStatus } from '../ui/menu.js';

// Prefijo de las salas de PeerJS. La versión 3D (beta) usa uno distinto al de la versión de main ('padel2v2-pro-'):
// el estado que viaja por la red es distinto y así nadie de la versión vieja puede entrar por error a una sala nueva.
export const ROOM_PREFIX = 'padel2v2-beta-';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function peerAvailable() {
  if (typeof Peer === 'undefined') {
    document.getElementById('status-text').innerText = 'No se pudo cargar PeerJS: revisa tu conexión';
    return false;
  }
  return true;
}

// Sin un servidor TURN, dos casas detrás de routers/NAT estrictos (o datos móviles) muchas
// veces no logran conectarse por WebRTC: el "unirse" se queda pegado para siempre.
// Si sigue fallando entre redes distintas, crea una cuenta gratis en un proveedor TURN
// (por ejemplo metered.ca) y reemplaza aquí urls, username y credential.
const PEER_OPTIONS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
  }
};
const peerOptions = () => Object.assign({}, PEER_OPTIONS, window.PEER_OVERRIDE || {});

// ---------- Envío del estado del anfitrión ----------
// El estado completo pesa ~5 KB y antes se mandaba 60 veces por segundo a cada invitado (unos 2,3 Mbit/s). Si la conexión
// (sobre todo con el servidor TURN gratuito) rinde menos que eso, PeerJS deja acumular hasta 8 MB en la cola y todo se
// atrasa cada vez más. Ahora: (1) cada cuadro solo viaja lo que cambió desde el último envío, y el estado completo una vez
// por segundo para corregir cualquier diferencia; (2) si la cola de envío ya tiene datos sin salir, se salta ese envío (el
// siguiente lleva lo último, porque los cambios se calculan contra lo que de verdad se mandó).
const FULL_EVERY = 60;          // cada tantos envíos va el estado completo
const MAX_QUEUE = 16 * 1024;    // bytes sin salir a partir de los cuales se salta un envío

function snapshotOf(s) {
  const top = {};
  for (const k in s) if (k !== 'players') top[k] = JSON.stringify(s[k]);
  return { top, pl: s.players.map(p => { const o = {}; for (const f in p) o[f] = JSON.stringify(p[f]); return o; }), uids: s.players.map(p => p.uid).join() };
}
// Cambios entre lo último enviado y el estado actual; null si hay que mandarlo completo (cambió la estructura)
function deltaOf(prev, cur, s) {
  if (prev.uids !== cur.uids) return null;
  const d = {}, p = {};
  for (const k in cur.top) {
    if (!(k in prev.top)) return null;
    if (cur.top[k] !== prev.top[k]) d[k] = s[k];
  }
  for (const k in prev.top) if (!(k in cur.top)) return null;
  for (let i = 0; i < cur.pl.length; i++) {
    for (const f in cur.pl[i]) {
      if (!(f in prev.pl[i])) return null;
      if (cur.pl[i][f] !== prev.pl[i][f]) (p[i] || (p[i] = {}))[f] = s.players[i][f];
    }
  }
  return { type: 'delta', d, p };
}
// Guarda de cada invitado lo último enviado
const sentTo = new WeakMap();

export function sendStateTo(conn) {
  if (!conn || !conn.open) return;
  const dc = conn.dataChannel;
  if (dc && dc.bufferedAmount > MAX_QUEUE) return;
  try {
    const cur = snapshotOf(state);
    const st = sentTo.get(conn) || { prev: null, n: 0 };
    const delta = st.prev && st.n % FULL_EVERY !== 0 ? deltaOf(st.prev, cur, state) : null;
    conn.send(delta || { type: 'state', state });
    st.prev = cur; st.n++;
    sentTo.set(conn, st);
  } catch (e) { /* conexión cerrándose */ }
}

// Aplica en el invitado los cambios que manda el anfitrión
function applyDelta(msg) {
  for (const k in msg.d) state[k] = msg.d[k];
  for (const i in msg.p) if (state.players[i]) Object.assign(state.players[i], msg.p[i]);
}

export function leaveNetwork() {
  clearTimeout(rt.joinTimer);
  const old = rt.peer;
  rt.peer = null;
  rt.hostConn = null;
  if (old) { try { old.destroy(); } catch (e) { /* nada */ } }
  rt.gotHostState = false;
  rt.hostConn = null;
  rt.connections = {};
  rt.isHost = true;
  rt.myUid = 'u0';
  state.amer = null;
  resetSeats();
  rt.mySlot = 0;
  state.roomCode = '';
  setStatus('Sin conexión');
}

export function createRoom() {
  ensureAudio();
  if (!peerAvailable()) return;
  leaveNetwork();
  const code = randomCode();
  const peerId = ROOM_PREFIX + code;

  rt.isHost = true;
  rt.mySlot = 0;
  prepareRoster(menuSel.mode);
  state.screen = 'lobby';
  rt.uiMenuOpen = false;
  const myPeer = new Peer(peerId, peerOptions());
  rt.peer = myPeer;
  setStatus('Creando sala...');

  myPeer.on('open', () => {
    state.roomCode = code;
    setStatus('Sala ' + code);
  });

  myPeer.on('error', err => {
    if (rt.peer !== myPeer) return;
    if (err && err.type === 'unavailable-id') { createRoom(); return; }   // código repetido: otro
    if (err && err.type === 'peer-unavailable') return;
    setStatus('Problema con el servidor de salas');
    if (!state.roomCode) { openMenu(); setNetMsg('No se pudo crear la sala. Revisa tu internet y vuelve a intentarlo.'); }
  });

  myPeer.on('disconnected', () => {
    // Se cayó el enlace con el servidor de salas: las partidas en curso siguen, pero nadie nuevo podría entrar
    if (rt.peer === myPeer && !myPeer.destroyed) { try { myPeer.reconnect(); } catch (e) { /* nada */ } }
  });

  myPeer.on('connection', conn => {
    // En el torneo solo se puede entrar como compañero; en amistoso y americano, a cualquier puesto libre
    const allowed = state.mode === 'run' ? [1] : [1, 2, 3];
    let slot = -1;
    for (const i of allowed) {
      if (state.players[i].isBot && !rt.connections[state.players[i].uid]) { slot = i; break; }
    }
    if (slot === -1) {
      conn.on('open', () => {
        conn.send({ type: 'full', mode: state.mode });
        setTimeout(() => conn.close(), 800);
      });
      return;
    }

    // El invitado queda ligado al uid de su jugador: si el anfitrión arma los equipos (o cambian las parejas del
    // americano) cambia de puesto, pero no de jugador
    const uid = state.players[slot].uid;
    const slotNow = () => slotOfUid(uid);
    rt.connections[uid] = conn;
    state.players[slot].isBot = false;

    conn.on('open', () => {
      conn.send({ type: 'welcome', slot, uid });
      sendStateTo(conn);     // no depende de que el loop del anfitrión esté corriendo
      showBanner('Se unió un jugador', 120);
    });

    conn.on('data', data => {
      const s = slotNow();
      if (s < 0) return;
      if (data.type === 'input') {
        remoteInputs[uid] = data.input;
        const cid = data.input && data.input.charId;
        if (cid && PLAYABLE.includes(cid) && state.players[s].lookId !== cid) { setLook(state.players[s], cid); fixBotLooks(); }
      } else if (data.type === 'buy') {
        tryBuy(s, data.id);
      } else if (data.type === 'vote') {
        setVote(s, data.map);
      } else if (data.type === 'ready') {
        setReady(s);
      } else if (data.type === 'ping') {
        conn.send({ type: 'pong', t: data.t });
        if (state.roomCode) setStatus('Sala ' + state.roomCode + ' · ping ' + (data.rtt || '…') + ' ms');
      }
    });

    conn.on('error', () => { /* se maneja en close */ });
    conn.on('close', () => {
      if (rt.connections[uid] !== conn) return;
      const p = state.players[slotNow()];
      delete rt.connections[uid];
      delete remoteInputs[uid];
      if (!p) return;
      p.isBot = true;
      const hostTeam = state.players[rt.mySlot].team;
      p.skill = state.mode === 'run' ? Math.max(0.3, (bossOf().sparring ? state.difficulty : bossOf().skill) - 0.05) : (p.team === hostTeam ? Math.max(TEAMMATE_SKILL, state.difficulty) : state.difficulty);
      showBanner('Un jugador salió; lo reemplaza un bot', 120);
    });
  });
}

export function joinRoom() {
  ensureAudio();
  const input = document.getElementById('room-code-input');
  const code = (input ? input.value : menuSel.code).trim().toUpperCase();
  if (!code) { setNetMsg('Escribe el código de 4 letras que aparece en la pantalla del anfitrión.'); return; }
  if (typeof Peer === 'undefined') { setNetMsg('No se pudo cargar PeerJS. Revisa tu internet y recarga la página.'); return; }
  leaveNetwork();

  rt.isHost = false;
  const myPeer = new Peer(peerOptions());
  rt.peer = myPeer;
  let welcomed = false;
  setStatus('Conectando a ' + code + '...');
  setNetMsg('Conectando a la sala ' + code + '…');

  const fail = msg => {
    if (rt.peer !== myPeer) return;
    leaveNetwork();
    rt.uiMenuOpen = true;
    state.screen = 'menu';
    setNetMsg(msg);
  };

  rt.joinTimer = setTimeout(() => {
    if (!welcomed) fail('No se pudo conectar con la sala ' + code + '. Si el código está bien, lo más probable es que sus redes no se dejen conectar directo (router o datos móviles): prueben otra red, o que otro de ustedes cree la sala.');
  }, 15000);

  myPeer.on('open', () => {
    const conn = myPeer.connect(ROOM_PREFIX + code, { reliable: true });
    rt.hostConn = conn;
    conn.on('open', () => {
      setStatus('Conectado a ' + code);
      setNetMsg('Conectado, esperando al anfitrión…');
    });
    conn.on('data', data => {
      if (rt.peer !== myPeer) return;
      if (data.type === 'welcome') {
        welcomed = true;
        clearTimeout(rt.joinTimer);
        rt.mySlot = data.slot;
        rt.myUid = data.uid;
        rt.uiMenuOpen = false;
        setNetMsg('');
        setStatus('Sala ' + code);
      } else if (data.type === 'full') {
        welcomed = true;
        fail(data.mode === 'run'
          ? 'La sala está llena: el torneo de jefes es para 2 jugadores. Para jugar 3 o 4, el anfitrión debe crear un partido amistoso.'
          : 'La sala está llena (4 jugadores).');
      } else if (data.type === 'pong') {
        rt.rtt = Math.round(performance.now() - data.t);
        setStatus('Sala ' + code + ' · ' + rt.rtt + ' ms');
      } else if (data.type === 'state' || data.type === 'delta') {
        rt.gotHostState = true;
        if (data.type === 'delta') applyDelta(data);
        else Object.assign(state, data.state);
        syncMySlot();
        recordFrame();
        if (state.soundTrigger.seq !== rt.lastPlayedSoundSeq) {
          rt.lastPlayedSoundSeq = state.soundTrigger.seq;
          hooks.sound(state.soundTrigger.type);
        }
      }
    });
    conn.on('error', () => { /* se maneja en close o en el tiempo límite */ });
    conn.on('close', () => {
      if (rt.peer !== myPeer) return;
      if (!welcomed) return;   // lo maneja 'full' o el tiempo límite
      fail('El anfitrión cerró la sala.');
      setStatus('Se cerró la sala');
    });
  });

  myPeer.on('error', err => {
    const t = err && err.type;
    console.warn('PeerJS:', t, err && err.message);
    if (t === 'peer-unavailable') fail('No existe una sala con el código ' + code + '. Revisa el código y que el anfitrión siga en la pantalla de la sala.');
    else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') fail('No se pudo llegar al servidor de salas. Revisa tu internet y vuelve a intentarlo.');
    else if (t === 'browser-incompatible') fail('Este navegador no permite jugar online. Prueben con Chrome, Edge o Firefox actualizados.');
    else if (!welcomed) fail('Error al conectar (' + (t || 'desconocido') + ').');
  });
}

setInterval(() => {
  if (!rt.isHost && rt.hostConn && rt.hostConn.open) {
    const dc = rt.hostConn.dataChannel;
    if (dc && dc.bufferedAmount > 8 * 1024) return;   // la cola está atrasada: el próximo envío lleva lo último
    rt.hostConn.send({ type: 'input', input: localInput });
  }
}, 20);

// Ping cada 2 s: el invitado mide el tiempo de ida y vuelta y se lo cuenta al anfitrión; ambos lo ven junto al código de sala
setInterval(() => {
  if (!rt.isHost && rt.hostConn && rt.hostConn.open) rt.hostConn.send({ type: 'ping', t: performance.now(), rtt: rt.rtt });
}, 2000);
