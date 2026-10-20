export const VIEW_W = 1280;
export const VIEW_H = 720;

export const COURT = {
  x: 60, y: 40,
  w: 800, h: 440,
  netX: 460,
  midY: 260,
  serviceLeft: 210,
  serviceRight: 710,
  glassLength: 150 // Los primeros 150px desde el fondo son cristal; el resto hasta la red es malla metálica
};

export const POINTS_LABELS = ['0', '15', '30', '40', 'ORO'];
export const GRAVITY = 0.16;
export const MAX_CHARGE_FRAMES = 120;      // 2 segundos de carga de pala
export const SPRINT_DURATION = 95;         // ~1.6 segundos de sprint activo
export const SPRINT_COOLDOWN = 1200;       // Exactamente 20 segundos a 60 FPS

// ---- Escala real: 40 px de mundo = 1 m. La altura física (z) se dibuja con ZS ----
export const ZS = 1.2;                 // 1 unidad de z = 1,2 px de mundo (3 cm)
export const NET_H = 29;               // Red: 29 unidades = 0,88 m (antes 11 = 33 cm, la pelota la cruzaba a ras de suelo)
export const NET_CLEARANCE = 3;        // Margen que intenta dejar el jugador sobre la red
export const MIN_SPEED_FACTOR = 0.6;   // Cuánto puede "levantar" (frenar) un golpe para pasar la red
export const SMASH_MIN_Z = 44;         // Remate solo con bola sobre ~1,3 m (antes 28 = 84 cm, altura de cintura)
export const BALL_R = 4.6;             // Radio visual (exagerado para que se lea bien)
export const WALL_H_TALL = 160;        // Fondo y primer tramo lateral: 4 m (3 m cristal + 1 m malla)
export const WALL_H_LOW = 120;         // Resto del lateral: 3 m
export const GLASS_H = 120;
export const GLASS_STEP_H = 80;
export const OVER_WALL_RULE = true;   // Pelota que bota y sale por encima de la pared = punto para quien pegó (por 3 / por 4)

// Cancha 15% más grande respecto a los jugadores: personajes, pala y alcance se achican en esa
// proporción (la cámara sigue mostrando la cancha completa) y además corren un 5% más.
const COURT_SCALE = 1.15;
export const ENTITY_K = 1 / COURT_SCALE;
export const SPEED_BOOST = 1.05;
export const PAD_F = 17 * ENTITY_K;          // dónde está la pala respecto al cuerpo
export const PAD_S = 6 * ENTITY_K;
export const BODY_MARGIN = 18 * ENTITY_K;    // distancia mínima del cuerpo a las paredes
export const NET_MARGIN = 28 * ENTITY_K;
// Rebote en el cristal: la pelota sale con un 13% menos de elevación que antes (2,4 y 3,6 originales)
export const GLASS_VZ_K = 0.87;
export const GLASS_MIN_VZ_TRIGGER = 2.0 * GLASS_VZ_K;   // si sube menos que esto, se la fuerza a GLASS_MIN_VZ
export const GLASS_MIN_VZ = 2.4 * GLASS_VZ_K;           // velocidad vertical mínima tras el rebote
export const GLASS_SMASH_MIN_VZ = 3.6 * GLASS_VZ_K;     // ídem para un remate contra el fondo
export const BASE_ROLL = 0.95;               // velocidad horizontal que conserva la pelota al botar (antes 0,90): llega más al fondo
export const ACTIVE_DURATION = 300;          // 5 s
export const ACTIVE_COOLDOWN = 2700;         // 45 s
export let WALL_PLAY = 0.25;                 // chance de que un bot deje pasar la pelota y la juegue de pared

export function sideWallHeight(x) {
  return (x < COURT.x + COURT.glassLength / 2 || x > COURT.x + COURT.w - COURT.glassLength / 2)
    ? WALL_H_TALL : WALL_H_LOW;
}
export const LIGHTS = [
  { x: 460, y: 36, z: 300 },     // lateral del fondo
  { x: 460, y: 484, z: 300 }     // lateral cercano a la cámara
];
