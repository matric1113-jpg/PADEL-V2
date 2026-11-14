import { AIM_SLACK, COURT, MIN_SPEED_FACTOR, NET_CLEARANCE, NET_H } from './constants.js';
import { gravAt, state } from './state.js';

export function showBanner(text, duration = 90) {
  state.bannerText = text;
  state.bannerTimer = duration;
}

// Calcula el cuadro cruzado obligatorio para el saque
export function computeServeBox(server) {
  const serverInTopHalf = server.y < COURT.midY;
  return {
    minX: server.team === 0 ? COURT.netX : COURT.serviceLeft,
    maxX: server.team === 0 ? COURT.serviceRight : COURT.netX,
    minY: serverInTopHalf ? COURT.midY : COURT.y,
    maxY: serverInTopHalf ? (COURT.y + COURT.h) : COURT.midY
  };
}

export function getClampedTarget(team, rawAimX, rawAimY, chargeRatio, powerStat, isLob, isServe) {
  // Sin ayuda: el golpe va a donde se apunta, aunque sea fuera de la cancha, a la red, a un costado o hacia atrás
  // (y entonces se falla). Solo se limita a unos metros alrededor de la cancha.
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  let tx = cl(rawAimX, COURT.x - AIM_SLACK, COURT.x + COURT.w + AIM_SLACK);
  const ty = cl(rawAimY, COURT.y - AIM_SLACK, COURT.y + COURT.h + AIM_SLACK);
  const deep = 22;   // fondo "seguro": la carga no empuja la pelota más allá de esto (salvo que ya se apuntara más allá)
  const ahead = team === 0 ? tx > COURT.netX : tx < COURT.netX;

  // En juego normal (no en saque), más carga y más fuerza empujan la bola más profunda
  if (!isLob && !isServe && ahead) {
    const depthPull = (chargeRatio - 0.4) * (50 + powerStat * 45);
    if (team === 0) tx = Math.max(Math.min(tx + depthPull, Math.max(tx, COURT.x + COURT.w - deep)), COURT.netX + 1);
    else tx = Math.min(Math.max(tx - depthPull, Math.min(tx, COURT.x + deep)), COURT.netX - 1);
  }
  return { tx, ty };
}

// Balística: misma fórmula de siempre (aterriza en el objetivo a la velocidad horizontal pedida)
// + ayuda de paso de red: si la parábola no supera la red, el jugador "levanta" la bola
// (baja la velocidad hasta un 60%). Si aun así no alcanza, la bola se va a la red.
export function computeLaunch(fromX, fromY, fromZ, targetX, targetY, speedX, shotLabel, team) {
  // La dirección sale del objetivo (puede ser hacia atrás). Si el objetivo está muy al costado, el vuelo se alarga.
  const G = gravAt();
  const dx = targetX - fromX;
  const dirX = Math.abs(dx) < 1 ? (team === 0 ? 1 : -1) : Math.sign(dx);
  const distX = Math.max(85, Math.abs(dx));
  let T = Math.max(distX, Math.abs(targetY - fromY) * 0.6) / speedX;

  const dNet = (COURT.netX - fromX) * dirX;
  if (shotLabel !== 'GLOBO' && dNet > 0 && dNet < distX) {
    const f = dNet / distX;
    const need = NET_H + NET_CLEARANCE;
    const zAtNet = fromZ * (1 - f) + 0.5 * G * T * T * f * (1 - f);
    if (zAtNet < need) {
      const tNeed = Math.sqrt(Math.max(0, 2 * (need - fromZ * (1 - f)) / (G * f * (1 - f))));
      T = Math.min(tNeed, T / MIN_SPEED_FACTOR);
    }
  }

  let vz = (0.5 * G * T * T - fromZ) / T;
  if (shotLabel === 'GLOBO' && vz < 5.6) vz = 5.9;
  return { vx: dirX * distX / T, vy: (targetY - fromY) / T, vz };
}

export function launchBall(targetX, targetY, speedX, shotLabel, team, isServeShot, cut = 0) {
  const b = state.ball;
  b.cut = cut;
  const v = computeLaunch(b.x, b.y, b.z, targetX, targetY, speedX, shotLabel, team);
  b.vx = v.vx;
  b.vy = v.vy;
  b.vz = v.vz;

  b.lastHitTeam = team;
  b.bouncesInOpponentSide = 0;
  b.isServeShot = isServeShot;
  b.shotType = shotLabel;
  b.hitSeq = (b.hitSeq || 0) + 1;
  b.wallBounced = false;
  b.ghost = false; b.breaker = false;   // poderes del laboratorio: los vuelve a poner quien pega, si corresponde
}

export function nextServerSlot(s) {
  for (let k = 0; k < 4; k++) {
    s = (s + 1) % 4;
    if (!state.players[s].out) return s;
  }
  return 0;
}
