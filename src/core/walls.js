// ---------- Paredes, puertas y el afuera de la cancha ----------
// Los jugadores pueden salir de la cancha por las puertas de los laterales para ir a buscar las pelotas que salen
// por 3 o por 4. Cada equipo tiene una puerta en cada lateral, donde termina el cristal y empieza la malla (cerca de
// su fondo): desde la red no alcanzarían nunca una pelota que sale por el fondo. Afuera pueden moverse alrededor de la
// cancha (hasta OUT_MARGIN) pero no atraviesan paredes: solo se entra y se sale por una puerta.
import { COURT, NET_MARGIN } from './constants.js';
import { clamp } from './util.js';

// Vanos de las puertas en x (en las dos paredes laterales): el del equipo azul y el del rojo
export const DOORS = [[214, 260], [660, 706]];
export const OUT_MARGIN = 80;          // cuánto se puede alejar el jugador de la cancha por afuera (2 m)
const WALL_R = 10;                     // radio del cuerpo contra paredes y marcos (cabe por la puerta con algo de holgura)

export const doorOf = team => DOORS[team === 0 ? 0 : 1];
export const insideCourt = (x, y) => x > COURT.x && x < COURT.x + COURT.w && y > COURT.y && y < COURT.y + COURT.h;

// Tramos de pared (segmentos en el suelo): los dos fondos y los laterales cortados en las puertas
const X0 = COURT.x, X1 = COURT.x + COURT.w, Y0 = COURT.y, Y1 = COURT.y + COURT.h;
const SEGMENTS = [[X0, Y0, X0, Y1], [X1, Y0, X1, Y1]];
for (const y of [Y0, Y1]) {
  let a = X0;
  for (const [d0, d1] of DOORS) { SEGMENTS.push([a, y, d0, y]); a = d1; }
  SEGMENTS.push([a, y, X1, y]);
}

function segDist(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ¿Puede estar el jugador de este equipo parado en (x, y)? Su mitad, el borde del afuera y sin pisar una pared
export function validSpot(team, x, y) {
  if (team === 0 ? x > COURT.netX - NET_MARGIN : x < COURT.netX + NET_MARGIN) return false;
  if (x < X0 - OUT_MARGIN || x > X1 + OUT_MARGIN || y < Y0 - OUT_MARGIN || y > Y1 + OUT_MARGIN) return false;
  for (const s of SEGMENTS) if (segDist(x, y, s) < WALL_R) return false;
  return true;
}

// ¿Está cerca de su puerta (por dentro o por fuera)? Ahí el movimiento pasa a ser con choque contra las paredes
export function nearOwnDoor(p) {
  const [d0, d1] = doorOf(p.team);
  return p.x > d0 - 8 && p.x < d1 + 8 && (p.y < Y0 + 45 || p.y > Y1 - 45);
}

// Mueve al jugador desde (fromX, fromY) hacia (p.x, p.y) eje por eje, deslizando contra las paredes.
// Cerca de su puerta lo centra un poco en el vano para que no se trabe en el marco.
export function moveWithWalls(p, fromX, fromY) {
  const tx = p.x, ty = p.y;
  const [d0, d1] = doorOf(p.team), dc = (d0 + d1) / 2;
  const throughDoor = p.x > d0 - 30 && p.x < d1 + 30 && (Math.abs(fromY - Y0) < 40 || Math.abs(fromY - Y1) < 40) && Math.abs(ty - fromY) > 0.1;
  let x = fromX, y = fromY;
  const nx = throughDoor ? tx + clamp(dc - tx, -2.2, 2.2) : tx;
  if (validSpot(p.team, nx, y)) x = nx;
  if (validSpot(p.team, x, ty)) y = ty;
  p.x = x; p.y = y;
  p.outside = !insideCourt(p.x, p.y);
}

// Punto de paso para ir de donde está el jugador a (tx, ty): si uno está adentro y el otro afuera, primero la puerta
export function waypoint(p, tx, ty) {
  const meIn = insideCourt(p.x, p.y), tgtIn = insideCourt(tx, ty);
  if (meIn === tgtIn) return { x: tx, y: ty };
  const [d0, d1] = doorOf(p.team), dc = (d0 + d1) / 2;
  // Pared por la que conviene pasar: la del lado del objetivo (o del jugador, si el objetivo está adentro)
  const refY = tgtIn ? p.y : ty;
  const wallY = refY < COURT.midY ? Y0 : Y1;
  const inward = wallY === Y0 ? 1 : -1;
  const atDoor = Math.abs(p.x - dc) < 12;
  if (meIn) return atDoor ? { x: dc, y: wallY - inward * 40 } : { x: dc, y: wallY + inward * 24 };
  return atDoor ? { x: dc, y: wallY + inward * 40 } : { x: dc, y: wallY - inward * 24 };
}
