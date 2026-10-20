import { GUST_FRAMES, GUST_RAMP, SPRINT_COOLDOWN, SPRINT_DURATION } from './constants.js';
import { MAPS } from './data.js';
import { emptyUpgrades } from './stats.js';

// Estado de ejecución compartido (antes eran variables sueltas del script).
export const rt = {
  peer: null,
  isHost: true,
  mySlot: 0,
  connections: {},
  hostConn: null,
  gotHostState: false,       // el invitado ya recibió el estado del anfitrión
  joinTimer: null,
  localChargeFrames: 0,
  lastPlayedSoundSeq: 0,
  netMsg: '',                // mensaje de conexión visible en el menú
  uiMenuOpen: true,
  overlayKey: ''
};

export const mapOf = () => MAPS[state.map] || MAPS.chile;
// Fuerza del viento (aceleración lateral por cuadro) dentro de `ahead` cuadros: sube y baja suave dentro de la ráfaga.
// La usan la física y las guías de tiro (así predicen el mismo desvío que sufre la pelota).
export function gustForce(ahead = 0) {
  const t = state.gust.t - ahead;
  if (t <= 0 || ahead < 0) return 0;
  return state.gust.w * Math.min(1, t / GUST_RAMP, (GUST_FRAMES - t) / GUST_RAMP + 0.001);
}

export const localInput = {
  up: false, down: false, left: false, right: false,
  sprint: false,
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
export function createPlayer(x, y, team, name, isBot, speedPref = 0.5, lookId = 'fernando') {
  return {
    x, y, vx: 0, vy: 0, team, name, isBot,
    lookId,
    skill: 1,                      // solo bots: 1 = dificultad original
    up: emptyUpgrades(),           // mejoras compradas
    money: 0,
    active: '',                    // activa equipada (reemplaza al sprint)
    activePool: '',                // 'all' = jefe que alterna todas las activas
    activeKind: '', activeT: 0, activeCd: 0,
    clone: null,
    stun: 0, slow: 0, burn: 0, burnCd: 0,
    bodyScale: 1, speedMult: 1, powerMult: 1, backPref: false, out: false,
    ready: false, vote: '',
    speedStat: speedPref,          // 0.15 a 0.85
    powerStat: 1 - speedPref,      // Inversamente proporcional a la velocidad
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
    botSeq: -1, botDelay: 0, botErrX: 0, botErrY: 0, botWhiff: false, botUseActive: false, botWallPlay: false
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
  mode: 'friendly',     // 'friendly' (2v2 a un set con tienda y mapas) | 'run' (torneo de jefes)
  screen: 'menu',       // 'menu' | 'lobby' | 'route' | 'play' | 'shop' | 'shop2' | 'lost' | 'champion' | 'setover'
  difficulty: 0.5,
  sets: [0, 0],
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
  hz: { bolt: 600, tilt: 420, gust: 360 },
  rally: { cp: [false, false] },   // ¿algún equipo salvó con contrapared en este punto?
  replay: { seq: 0 },
  celebrate: { seq: 0, team: 0 },
  talk: { seq: 0, slot: 0, text: '' },
  vote: { first: true },
  players: [
    createPlayer(145, 150, 0, 'Fernando', false, 0.50, 'fernando'),
    createPlayer(145, 370, 0, 'Joaquín', true, 0.68, 'joaquin'),
    createPlayer(775, 150, 1, 'Maxi', true, 0.85, 'maxi'),
    createPlayer(775, 370, 1, 'Germán', true, 0.15, 'german')
  ],
  ball: {
    x: 175, y: 150, z: 18,
    vx: 0, vy: 0, vz: 0,
    lastHitTeam: 0,
    bouncesInOpponentSide: 0,
    hasBouncedInValidBox: false,
    isServeShot: true,
    shotType: 'SAQUE',
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
export const remoteInputs = [
  { ...localInput },
  { ...localInput },
  { ...localInput },
  { ...localInput }
];
export const menuSel = { char: 'fernando', mode: 'run', diff: 1, code: '' };
