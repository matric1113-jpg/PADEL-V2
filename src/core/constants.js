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
// Mapa En altura: ráfagas de viento (aceleración lateral de la pelota por cuadro, antes 0,014-0,020 durante 180 cuadros)
export const GUST_STRENGTH_MIN = 0.035;
export const GUST_STRENGTH_RANGE = 0.02;
export const GUST_FRAMES = 240;             // duración de una ráfaga (4 s)
export const GUST_RAMP = 30;                // cuadros que tarda en subir y en bajar
export const GUST_GAP_MIN = 420;            // pausa entre ráfagas
export const GUST_GAP_RANGE = 360;
export const GUST_PLAYER_PUSH = 8;          // cuánto arrastra a los jugadores (unidades por cuadro por unidad de fuerza)
// Mapa Hombros de Atlas: inclinación de la cancha (antes: cámara 0,03 rad y 10 px, jugadores 0,5, pelota 0,011)
export const TILT_FRAMES = 240;             // duración de una inclinación (4 s)
export const TILT_RAMP = 30;                // cuadros que tarda en subir y en bajar
export const TILT_GAP_MIN = 360;            // pausa entre inclinaciones (antes 480 + hasta 360)
export const TILT_GAP_RANGE = 300;
export const TILT_CAM_ROT = 0.1;            // giro de cámara (rad) con la inclinación al máximo
export const TILT_CAM_SHIFT = 34;           // desplazamiento vertical de la cámara (px de pantalla)
export const TILT_PLAYER_PUSH = 1.5;        // unidades por cuadro que arrastra a los jugadores
export const TILT_BALL_ACCEL = 0.03;        // aceleración de la pelota en el aire por cuadro
// Partido amistoso: gana quien llegue primero a SETS_TO_WIN sets. Después viene la cinemática del podio.
export const SETS_TO_WIN = 2;
// Americano: cada set se juega al primero en llegar a este número de juegos (sin tie-break)
export const AMERICANO_GAMES_TO_WIN = 4;
export const PODIUM_FRAMES = 660;           // duración de la cinemática (11 s) antes de la pantalla de resultado
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

// Remate: sale con toda su fuerza solo si se le pega a la pelota bien arriba. Entre la altura mínima de remate
// (smashMinOf) y SMASH_FULL_Z la fuerza y el bote crecen de a poco; abajo de eso es un remate algo más suave.
export const SMASH_FULL_Z = 72;              // altura de la pelota (2,2 m, cerca del tope del alcance o saltando) desde la que el remate sale como antes
export const SMASH_LOW_SPEED = 0.9;          // velocidad del remate pegado justo en la altura mínima (×)
export const SMASH_LOW_BOUNCE = 0.79;        // rebote en el suelo de ese remate (el remate de siempre: 0,84; un golpe normal: 0,74)
// Salto (Espacio) que se carga: se mantiene apretado en el suelo (el jugador se agacha y camina más lento) y al soltarlo
// salta más alto cuanto más rato lo cargó. Sirve sobre todo para alcanzar las pelotas que salen hacia la malla o el
// fondo (por 3 / por 4). Al caer se queda un instante clavado y le cuesta volver a correr: abusar del salto se paga.
export const JUMP_G = 0.3;                   // gravedad del salto (unidades de z por cuadro²)
export const JUMP_MIN_H = 19.2;              // altura con un toque (antes 16; ×1,2 = 58 cm)
export const JUMP_MAX_H = 52.8;              // altura con la carga completa (antes 44; ×1,2 = 1,6 m)
export const JUMP_CHARGE_FRAMES = 30;        // cuadros de carga para el salto más alto (0,5 s)
export const JUMP_CHARGE_SLOW = 0.8;         // velocidad al moverse mientras carga el salto
export const JUMP_LAND_STOP = 4;             // al caer de un salto completo queda clavado 4 cuadros (0,07 s; de uno corto, la mitad)
export const JUMP_LAND_FRAMES = 24;          // después, cuadros que tarda en recuperar la velocidad (0,4 s)
export const JUMP_LAND_SLOW = 0.2;           // vuelve a correr desde el 80 % de su velocidad
export const JUMP_REJUMP_FRAMES = 6;         // no puede volver a cargar el salto apenas cae
export const JUMP_SMASH_BONUS = 0.04;        // remate en el aire: hasta un 4 % más fuerte
// Raquetazo al compañero: si la pala de un jugador golpea a su pareja mientras balancea, depende de la carga del golpe:
// el más suave la deja aturdida 2 s, con la mitad de carga 4 s (en medio, proporcional) y con más de la mitad cae al
// suelo y no vuelve hasta que termina el punto
export const MATE_HIT_RADIUS = 18 * 1.2 * ENTITY_K;   // (×1,2: antes 18)
export const LIGHT_BREAK_R = 84;             // distancia horizontal de la pelota al foco para romperlo (antes 42)
export const LIGHT_BREAK_Z = 72;             // y diferencia de altura (antes 36)
export const ROOF_BOUNCE = 0.6;              // mapas con techo (cráter): velocidad vertical que conserva la pelota al pegar en el techo
export const SHIFT_POINTS = 2;               // mapa cambiante: cada cuántos puntos cambia la cancha
export const RUN_PODIUM_FRAMES = 420;        // cinemática al ganar o perder el torneo (7 s)

export const MIN_SWING_CHARGE = 0.15;        // carga mínima de un golpe (aunque se suelte el clic al instante)
export const MATE_STUN_FRAMES = 120;         // 2 s a 60 cuadros por segundo (golpe más suave)
export const MATE_STUN_MAX_FRAMES = 240;     // 4 s (golpe con la mitad de carga)
export const MATE_KO_CHARGE = 0.5;           // por encima de esta carga el compañero cae al suelo
export const MATE_KO_FRAMES = 1000000;       // "hasta que termine el punto": setupServe lo deja en 0

// ---------- Laboratorio (versión de prueba): canchas, jefes y poderes nuevos ----------
// Piso que se cae (mapa El Abismo, mutador y poder Rompesuelos): la cancha se divide en baldosas de 80 x 88 unidades.
// Cada cierto rato una baldosa de cada lado avisa (parpadea) y se cae; el hoyo queda hasta que termina el punto.
// Quien pisa un hoyo cae y queda fuera hasta el punto siguiente (se puede saltar por encima); si la pelota bota en un
// hoyo del lado rival, el punto es para quien pegó.
export const TILE_COLS = 10;                 // 5 columnas por lado
export const TILE_ROWS = 5;
export const TILE_W = COURT.w / TILE_COLS;
export const TILE_H = COURT.h / TILE_ROWS;
export const HOLE_WARN_FRAMES = 80;          // aviso antes de caer (1,3 s)
export const HOLE_FAST_WARN_FRAMES = 36;     // aviso corto del piso roto por un golpe (Rompesuelos, hermanos Terremoto)
export const HOLE_FIRST_FRAMES = 150;        // el primer aviso llega 2,5 s después de empezar el punto
export const HOLE_GAP_MAX = 150;             // pausa entre avisos al principio del punto...
export const HOLE_GAP_MIN = 65;              // ...y la mínima cuando el punto se alarga
export const HOLE_GAP_STEP = 12;             // cuánto se acorta por cada par de hoyos abiertos
export const HOLE_MAX_PER_SIDE = 12;         // de 25 baldosas por lado
export const HOLE_EDGE = 5;                  // margen de perdón: hay que meter el pie 5 unidades dentro del hoyo
// Camas elásticas (mapa El Circo y mutador): 2 por lado, se pasean por la cancha
export const PAD_R = 30;                     // radio
export const PAD_JUMP_H = 80;                // altura del salto de quien la pisa (2,4 m)
export const PAD_BALL_K = 1.7;               // la pelota que bota en una sale con este múltiplo de su bote normal
export const PAD_BALL_MIN_VZ = 7;            // y al menos con esta velocidad vertical
// Poder Terremoto
export const QUAKE_WARN_FRAMES = 60;         // aviso (1 s): hay que estar en el aire cuando termina
export const QUAKE_STUN_FRAMES = 100;        // aturdimiento de quien estaba pisando el suelo (1,7 s)
// Poder Parpadeo
export const BLINK_LEAD_FRAMES = 16;         // aparece donde la pelota va a estar a su alcance dentro de al menos estos cuadros
