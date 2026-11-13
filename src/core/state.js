import { GUST_FRAMES, GUST_RAMP, SPRINT_COOLDOWN, SPRINT_DURATION, TILT_FRAMES, TILT_RAMP } from './constants.js';
import { BOSSES, LAB_DEFAULT, LAB_RIVALS, MAPS, MUTATORS } from './data.js';
import { emptyUpgrades } from './stats.js';

// Estado de ejecución compartido (antes eran variables sueltas del script).
export const rt = {
  peer: null,
  isHost: true,
  mySlot: 0,                 // puesto actual en state.players (cambia al armar equipos o en el americano)
  myUid: 'u0',               // id fijo de mi jugador: el puesto se busca con él (syncMySlot)
  connections: {},           // conexiones de los invitados, por uid de su jugador
  hostConn: null,
  gotHostState: false,       // el invitado ya recibió el estado del anfitrión
  joinTimer: null,
  localChargeFrames: 0,
  lastPlayedSoundSeq: 0,
  netMsg: '',                // mensaje de conexión visible en el menú
  rtt: 0,                    // ping (ms) del invitado al anfitrión, medido cada 2 s
  tutorialPage: -1,          // página abierta del tutorial del menú (-1 = cerrado)
  uiMenuOpen: true,
  overlayKey: '',
  podiumT: 0                 // cuadros transcurridos de la cinemática del podio (lo cuenta el anfitrión)
};

// ¿Se está jugando un partido del laboratorio? (un partido contra un jefe con la configuración de state.run.lab)
export const isLab = () => state.mode === 'run' && !!(state.run && state.run.lab);
// Mapa actual. En el laboratorio se le suman los mutadores elegidos (peligros de otros mapas).
let mapKey = '', mapMerged = null;
export function mapOf() {
  const base = MAPS[state.map] || MAPS.chile;
  const mods = isLab() ? state.run.lab.mods : null;
  if (!mods || !mods.length) return base;
  const key = state.map + '|' + mods.join();
  if (key !== mapKey) {
    mapKey = key;
    mapMerged = { ...base };
    for (const m of mods) if (MUTATORS[m]) Object.assign(mapMerged, MUTATORS[m].flags);
  }
  return mapMerged;
}
// Jefe actual: el del torneo o, en el laboratorio, el rival elegido con los juegos y la cancha elegidos
let bossKey = '', bossMerged = null;
export function bossOf() {
  if (!isLab()) return BOSSES[state.run.boss] || BOSSES[0];
  const L = state.run.lab, key = state.run.boss + '|' + L.games + '|' + L.map;
  if (key !== bossKey) {
    bossKey = key;
    bossMerged = { ...(LAB_RIVALS[state.run.boss] || LAB_RIVALS[0]), gamesToWin: L.games, map: L.map };
  }
  return bossMerged;
}
// Tamaño de jugadores y pelota respecto a la cancha (mapa Estadio gigante: menos de 1)
export const entK = () => mapOf().big || 1;
// Fuerza del viento (aceleración lateral por cuadro) dentro de `ahead` cuadros: sube y baja suave dentro de la ráfaga.
// La usan la física y las guías de tiro (así predicen el mismo desvío que sufre la pelota).
export function gustForce(ahead = 0) {
  const t = state.gust.t - ahead;
  if (t <= 0 || ahead < 0) return 0;
  return state.gust.w * Math.min(1, t / GUST_RAMP, (GUST_FRAMES - t) / GUST_RAMP + 0.001);
}

// Cuánto de la inclinación está aplicada (0 a 1) dentro de `ahead` cuadros: la cancha se inclina y vuelve suave.
// La usan la cámara, los jugadores, la pelota y las guías de tiro.
export function tiltEase(ahead = 0) {
  const t = state.tilt.t - ahead;
  if (t <= 0 || ahead < 0) return 0;
  return Math.min(1, t / TILT_RAMP, (TILT_FRAMES - t) / TILT_RAMP + 0.0001);
}

export const localInput = {
  up: false, down: false, left: false, right: false,
  sprint: false,      // Shift: sprint o activa
  jump: false,        // Espacio apretado: carga el salto; al soltarlo salta (más alto cuanto más lo cargó)
  speedPref: 0.50,
  charId: 'fernando',
  charging: false,
  lobMode: false,
  aimX: 600,          // Coordenadas de MUNDO (suelo de la cancha), igual que antes
  aimY: 260,
  releaseSeq: 0,
  lastChargeRatio: 0,
  lastReleaseLob: false
};
export function createPlayer(uid, x, y, team, name, isBot, speedPref = 0.5, lookId = 'fernando') {
  return {
    uid,                           // id fijo; el puesto (índice en state.players) puede cambiar
    x, y, vx: 0, vy: 0, team, name, isBot,
    lookId,
    skill: 1,                      // solo bots: 1 = dificultad original
    up: emptyUpgrades(),           // mejoras compradas
    money: 0,
    active: '',                    // activa equipada (reemplaza al sprint)
    activePool: '',                // 'all' = jefe que alterna todas las activas
    activeKind: '', activeT: 0, activeCd: 0,
    clone: null,
    fell: false,                   // cayó por un hoyo del piso: fuera hasta el punto siguiente
    blinkCd: 0, blinkMax: 0,       // jefes que se teletransportan solos: recarga actual y recarga total (0 = no lo hace)
    botQk: 0, botQkDodge: false, botCareless: false,   // bots: terremoto que ya vieron, si lo van a saltar, y si andan distraídos con los hoyos
    stun: 0, down: false, slow: 0, burn: 0, burnCd: 0,   // down: noqueado por un raquetazo de su compañero (en el suelo hasta que termine el punto)
    bodyScale: 1, speedMult: 1, powerMult: 1, backPref: false, out: false,
    ready: false, vote: '',
    speedStat: speedPref,          // 0.15 a 0.85
    powerStat: 1 - speedPref,      // Inversamente proporcional a la velocidad
    outside: false,                // salió de la cancha por la puerta
    jz: 0, jvz: 0, jumpCharge: 0, jumpK: 0, landStop: 0, landSlow: 0,   // salto: altura, velocidad vertical, carga, fuerza del último salto, clavado y recuperación al caer
    sprintActiveTimer: 0,
    sprintCooldown: 0,
    sprintDurMax: SPRINT_DURATION,
    sprintCdMax: SPRINT_COOLDOWN,
    charging: false,
    lobMode: false,
    chargeFrames: 0,
    swingTimer: 0,
    swingCharge: 0,
    swingLob: false,
    cooldown: 0,
    aimX: team === 0 ? 600 : 320,
    aimY: 260,
    lastReleaseSeq: 0,
    botSeq: -1, botDelay: 0, botErrX: 0, botErrY: 0, botWhiff: false, botUseActive: false, botWallPlay: false, botJump: false, botJumpTarget: 0, botJumpTarget: 0
  };
}

export const state = {
  phase: 'SERVE', // 'SERVE' | 'PLAY' | 'POINT_PAUSE'
  serverSlot: 0,
  serveTargetBox: { minX: 460, maxX: 710, minY: 260, maxY: 480 },
  serveBotTimer: 75,
  pauseTimer: 0,
  afterPause: null,
  soundTrigger: { seq: 0, type: '' },
  mode: 'friendly',     // 'friendly' (2v2 a 2 sets con tienda y mapas) | 'run' (torneo de jefes) | 'americano'
  screen: 'menu',       // 'menu' | 'lobby' | 'route' | 'play' | 'shop' | 'shop2' | 'lost' | 'champion' | 'podium' | 'matchover'
  difficulty: 0.5,
  sets: [0, 0],
  setHistory: [],                  // juegos de cada set ya terminado: [[6, 4], [3, 6], ...] (modo amistoso)
  tiebreak: false,
  result: null,
  roomCode: '',
  run: { boss: 0 },
  map: 'chile',
  lights: [true, true],
  ice: null,                       // { side, t }
  embers: [],                      // brasas del cráter
  bolts: [],                       // rayos con aviso
  tilt: { x: 0, y: 0, t: 0 },
  gust: { w: 0, t: 0 },
  hz: { bolt: 600, tilt: 420, gust: 360, hole: 150 },
  holes: [],                       // baldosas que avisan o ya cayeron: { i: baldosa, w: cuadros de aviso que le quedan (0 = hoyo abierto) }
  quake: null,                     // terremoto en camino: { team: lado sacudido, t: cuadros que faltan, id }
  shift: null,                     // mapa cambiante: { n: puntos jugados, due: toca cambiar de cancha en el próximo saque }
  padT: 0,                         // reloj de las camas elásticas (su posición sale de él)
  blink: { seq: 0, x0: 0, y0: 0, x1: 0, y1: 0 },   // último teletransporte (para el efecto)
  rally: { cp: [false, false] },   // ¿algún equipo salvó con contrapared en este punto?
  replay: { seq: 0 },
  celebrate: { seq: 0, team: 0 },
  talk: { seq: 0, slot: 0, text: '' },
  vote: { first: true },
  amer: null,                      // americano: { set, order: [uid A, B, C, D], pts: {uid: juegos ganados}, against: {uid: juegos perdidos} }
  players: [
    createPlayer('u0', 145, 150, 0, 'Fernando', false, 0.50, 'fernando'),
    createPlayer('u1', 145, 370, 0, 'Joaquín', true, 0.68, 'joaquin'),
    createPlayer('u2', 775, 150, 1, 'Maxi', true, 0.85, 'maxi'),
    createPlayer('u3', 775, 370, 1, 'Germán', true, 0.15, 'german')
  ],
  ball: {
    x: 175, y: 150, z: 18,
    vx: 0, vy: 0, vz: 0,
    lastHitTeam: 0,
    bouncesInOpponentSide: 0,
    hasBouncedInValidBox: false,
    isServeShot: true,
    shotType: 'SAQUE',
    smashK: 1,
    ghost: false, breaker: false,             // pelota fantasma (invisible para el rival hasta que bota) y golpe que rompe el piso donde bota
    out: false, outTeam: -1, outReason: '',   // salió por 3 o por 4 y sigue volando afuera (punto para outTeam al tocar el suelo)          // remate: 0 = pegado justo en la altura mínima, 1 = bien arriba (fuerza y bote completos)
    hitSeq: 0,
    cut: 0,
    cpTarget: null,
    trail: []
  },
  score: [0, 0],
  games: [0, 0],
  bannerText: '',
  bannerTimer: 0
};
// Input de cada jugador humano, por uid (el del anfitrión lo copia la física desde localInput)
export const remoteInputs = {};
export const inputOf = p => remoteInputs[p.uid] || localInput;
export const slotOfUid = uid => state.players.findIndex(p => p.uid === uid);
// Los puestos 0-1 son el equipo azul y 2-3 el rojo. Si se reordena state.players (equipos de la sala, americano)
// o llega el estado del anfitrión, mi puesto se vuelve a buscar por uid.
export function syncMySlot() {
  const i = slotOfUid(rt.myUid);
  if (i >= 0) rt.mySlot = i;
}
// mode: 'run' | 'friendly' | 'americano' | 'lab' (laboratorio: partido directo con la configuración de lab)
export const menuSel = { char: 'fernando', mode: 'run', diff: 1, code: '', lab: { ...LAB_DEFAULT, mods: [] } };
