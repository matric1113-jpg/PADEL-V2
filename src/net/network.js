import Peer from 'peerjs';
import { ensureAudio } from '../audio/audio.js';
import { hooks } from '../core/events.js';
import { showBanner } from '../core/ballistics.js';
import { BOSSES, CHARACTERS, TEAMMATE_SKILL } from '../core/data.js';
import { prepareRoster, setLook, setReady, setVote, tryBuy } from '../core/game.js';
import { recordFrame } from '../core/replay.js';
import { localInput, menuSel, remoteInputs, rt, state } from '../core/state.js';
import { openMenu, setNetMsg, setStatus } from '../ui/menu.js';

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

export function sendStateTo(conn) {
  if (conn && conn.open) {
    try { conn.send({ type: 'state', state }); } catch (e) { /* conexión cerrándose */ }
  }
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
  rt.mySlot = 0;
  state.roomCode = '';
  setStatus('Sin conexión');
}

export function createRoom() {
  ensureAudio();
  if (!peerAvailable()) return;
  leaveNetwork();
  const code = randomCode();
  const peerId = 'padel2v2-pro-' + code;

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
    // En el torneo solo se puede entrar como compañero; en amistoso, a cualquier puesto libre
    const allowed = state.mode === 'run' ? [1] : [1, 2, 3];
    let slot = -1;
    for (const i of allowed) {
      if (state.players[i].isBot && !rt.connections[i]) { slot = i; break; }
    }
    if (slot === -1) {
      conn.on('open', () => {
        conn.send({ type: 'full', mode: state.mode });
        setTimeout(() => conn.close(), 800);
      });
      return;
    }

    rt.connections[slot] = conn;
    state.players[slot].isBot = false;

    conn.on('open', () => {
      conn.send({ type: 'welcome', slot });
      sendStateTo(conn);     // no depende de que el loop del anfitrión esté corriendo
      showBanner('Se unió un jugador', 120);
    });

    conn.on('data', data => {
      if (data.type === 'input') {
        remoteInputs[slot] = data.input;
        const cid = data.input && data.input.charId;
        if (cid && CHARACTERS.includes(cid) && state.players[slot].lookId !== cid) setLook(state.players[slot], cid);
      } else if (data.type === 'buy') {
        tryBuy(slot, data.id);
      } else if (data.type === 'vote') {
        setVote(slot, data.map);
      } else if (data.type === 'ready') {
        setReady(slot);
      }
    });

    conn.on('error', () => { /* se maneja en close */ });
    conn.on('close', () => {
      if (rt.connections[slot] !== conn) return;
      const p = state.players[slot];
      p.isBot = true;
      p.skill = state.mode === 'run' ? Math.max(0.3, BOSSES[state.run.boss].skill - 0.05) : (p.team === 0 ? Math.max(TEAMMATE_SKILL, state.difficulty) : state.difficulty);
      delete rt.connections[slot];
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
    const conn = myPeer.connect('padel2v2-pro-' + code, { reliable: true });
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
        rt.uiMenuOpen = false;
        setNetMsg('');
        setStatus('Sala ' + code);
      } else if (data.type === 'full') {
        welcomed = true;
        fail(data.mode === 'run'
          ? 'La sala está llena: el torneo de jefes es para 2 jugadores. Para jugar 3 o 4, el anfitrión debe crear un partido amistoso.'
          : 'La sala está llena (4 jugadores).');
      } else if (data.type === 'state') {
        rt.gotHostState = true;
        Object.assign(state, data.state);
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
    rt.hostConn.send({ type: 'input', input: localInput });
  }
}, 20);
