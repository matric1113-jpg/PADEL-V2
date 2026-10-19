import { ENTITY_K, SMASH_MIN_Z } from './constants.js';

export const upLvl = (p, id) => (p && p.up && p.up[id]) || 0;
export const actOn = (p, kind) => !!p && p.activeT > 0 && p.activeKind === kind;
export function sizeOf(p) { return (p && p.bodyScale) || 1; }
export function reachOf(p) {
  let r = 35 * ENTITY_K * (1 + 0.15 * upLvl(p, 'pala'));
  const s = sizeOf(p);
  r *= s >= 1 ? 1 + (s - 1) * 0.6 : 0.95;
  if (actOn(p, 'gordo')) r *= 1.9;
  if (actOn(p, 'palaxl')) r *= 2.1;
  return r;
}
export function reachZOf(p) {
  let z = 80 + 8 * upLvl(p, 'pala') + 6 * upLvl(p, 'estiron');
  z *= Math.max(1, 1 + (sizeOf(p) - 1) * 0.5);
  if (actOn(p, 'gordo')) z *= 1.45;
  if (actOn(p, 'palaxl')) z += 30;
  return z;
}
export const chargeRateOf = p => 1 + 0.25 * upLvl(p, 'grip');
export const emptyUpgrades = () => ({ pala: 0, zapas: 0, fuerza: 0, grip: 0, sprint: 0, remate: 0, estiron: 0, cortado: 0, sombrero: 0 });
export const smashMinOf = p => SMASH_MIN_Z - 8 * upLvl(p, 'remate') - 4 * upLvl(p, 'estiron');
