import { ACTIVE_COOLDOWN, ACTIVE_DURATION, ENTITY_K, SMASH_MIN_Z } from './constants.js';
import { ACTIVES } from './data.js';
import { entK } from './state.js';

export const upLvl = (p, id) => (p && p.up && p.up[id]) || 0;
export const actOn = (p, kind) => !!p && p.activeT > 0 && p.activeKind === kind;
export function sizeOf(p) { return (p && p.bodyScale) || 1; }
export function reachOf(p) {
  let r = 35 * ENTITY_K * (1 + 0.15 * upLvl(p, 'pala'));
  const s = sizeOf(p);
  r *= s >= 1 ? 1 + (s - 1) * 0.6 : 0.95;
  if (actOn(p, 'gordo')) r *= 1.9;
  if (actOn(p, 'palaxl')) r *= 2.1;
  return r * entK();   // Estadio gigante: la pala alcanza menos respecto a la cancha
}
export function reachZOf(p) {
  let z = 80 + 8 * upLvl(p, 'pala') + 6 * upLvl(p, 'estiron');
  z *= Math.max(1, 1 + (sizeOf(p) - 1) * 0.5);
  if (actOn(p, 'gordo')) z *= 1.45;
  if (actOn(p, 'palaxl')) z += 30;
  return z * (0.5 + 0.5 * entK());
}
export const chargeRateOf = p => 1 + 0.25 * upLvl(p, 'grip');
// (declaración de función y no flecha: state.js la llama al cargarse, y este módulo importa a su vez state.js)
export function emptyUpgrades() { return { pala: 0, zapas: 0, fuerza: 0, grip: 0, sprint: 0, remate: 0, estiron: 0, cortado: 0, sombrero: 0 }; }
// Duración y recarga de una activa (las del laboratorio traen las suyas; el resto, 5 s y 45 s)
export const activeDurOf = kind => (ACTIVES[kind] && ACTIVES[kind].dur) || ACTIVE_DURATION;
export const activeCdOf = kind => (ACTIVES[kind] && ACTIVES[kind].cd) || ACTIVE_COOLDOWN;
export const smashMinOf = p => SMASH_MIN_Z - 8 * upLvl(p, 'remate') - 4 * upLvl(p, 'estiron');
