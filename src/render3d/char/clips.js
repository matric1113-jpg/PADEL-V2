import { clamp } from '../../core/util.js';

// ---------- Mapeo entre los clips de la Universal Animation Library y los estados del juego ----------
// El pack no trae ningún golpe de tenis o pádel. Lo que sí trae (correr, saltar, reacciones) se usa tal cual
// para piernas y tronco; los brazos, los golpes y las celebraciones los resuelve char/rig.js con IK
// (los brazos van a donde los manda view/skeleton.js, así que cada golpe y cada pose de celebración
// sigue exactamente el mismo gesto y tiempos que en el render 2D).
export const CLIPS = {
  idle: 'Idle_Loop',               // parado sin carga
  ready: 'Crouch_Idle_Loop',       // se mezcla con idle para la guardia (rodillas flexionadas)
  crouchRun: 'Crouch_Fwd_Loop',    // desplazarse cargando el golpe
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  jump: 'Jump_Start',              // piernas recogidas: remate y salto de celebración
  hop: 'Jump_Loop',
  hitHead: 'Hit_Head',             // golpe en la cabeza: al paralizarlo un rayo
  hitChest: 'Hit_Chest',           // sobresalto: al quemarse los pies
  dance: 'Dance_Loop'              // rebote: celebraciones y pies quemados
};
export const LOOP_NAMES = ['idle', 'ready', 'crouchRun', 'walk', 'jog', 'sprint', 'jump', 'hop', 'dance'];
export const ONE_SHOT_NAMES = ['hitHead', 'hitChest'];

// Velocidad real de cada clip (m/s del modelo), medida con la versión con root motion del pack
export const CLIP_SPEED = { walk: 0.97, jog: 5.36, sprint: 8.25 };

const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Estado del cuadro -> peso objetivo y velocidad de reproducción de cada clip en bucle.
// f: { speed (m/s del modelo), charging, kind, swinging, swingKind, swingU, celeb: {kind}|null, stun, burn, slow }
export function planClips(f) {
  const w = {}, ts = {};
  for (const n of LOOP_NAMES) { w[n] = 0; ts[n] = 1; }
  const v = f.speed;

  // Parado: guardia (idle + agachado). Corriendo: caminar, trotar o sprint según la velocidad.
  const run = ss(0.3, 1.2, v);
  const jogK = ss(1.6, 3.4, v), sprintK = ss(6.2, 7.6, v);
  const readyK = f.charging ? 0.55 : 0.32;
  w.idle = (1 - run) * (1 - readyK);
  w.ready = (1 - run) * readyK;
  w.walk = run * (1 - jogK);
  w.jog = run * jogK * (1 - sprintK);
  w.sprint = run * jogK * sprintK;
  ts.walk = clamp(v / CLIP_SPEED.walk, 0.7, 2.2);
  ts.jog = clamp(v / CLIP_SPEED.jog, 0.6, 1.5);
  ts.sprint = clamp(v / CLIP_SPEED.sprint, 0.7, 1.3);
  // Cargando mientras se desplaza: un poco de agachado
  if (f.charging && run > 0.05) { w.crouchRun = 0.3 * run; ts.crouchRun = clamp(v / 1.5, 0.8, 2); }

  // Remate: las piernas se recogen en el aire
  let jump = 0;
  if (f.swinging && f.swingKind === 'smash') jump = Math.sin(clamp(f.swingU, 0, 1) * Math.PI);
  else if (f.charging && f.kind === 'smash') jump = 0.35 * f.cr;
  if (f.celeb && f.celeb.kind === 'jump') jump = 1;

  if (f.celeb) {
    // Celebración: rebote de baile (la pose de los brazos viene del esqueleto)
    const bounce = f.celeb.kind === 'jump' ? 0.25 : 0.75;
    for (const n of LOOP_NAMES) w[n] = 0;
    w.dance = bounce; w.idle = 1 - bounce;
    ts.dance = f.celeb.kind === 'belly' ? 0.8 : 1;
  }

  if (f.burn > 0) {
    // Pies quemados: salticos rápidos
    const k = 0.75;
    for (const n of LOOP_NAMES) w[n] *= 1 - k;
    w.dance += k; ts.dance = 2.3;
  }

  if (f.cry) {
    // Llorando (podio): parado y algo encogido; la cabeza caída y las manos en la cara son procedurales
    for (const n of LOOP_NAMES) w[n] = 0;
    w.idle = 0.6; w.ready = 0.4;
    jump = 0;
  }

  if (f.stun > 0) {
    // Paralizado: parado y agachado; el resto (cabeza caída, balanceo) es procedural
    for (const n of LOOP_NAMES) w[n] = 0;
    w.idle = 0.45; w.ready = 0.55;
    jump = 0;
  }

  if (jump > 0) {
    const jw = 0.7 * jump;
    for (const n of LOOP_NAMES) w[n] *= 1 - jw;
    w[f.celeb && f.celeb.kind === 'jump' ? 'hop' : 'jump'] += jw;
  }
  if (f.slow > 0) for (const n of ['walk', 'jog', 'sprint']) ts[n] *= 0.85;
  return { w, ts, jump };
}
