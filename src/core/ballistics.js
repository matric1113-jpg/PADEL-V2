import { COURT, GRAVITY, MIN_SPEED_FACTOR, NET_CLEARANCE, NET_H } from './constants.js';
import { state } from './state.js';

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
  const margin = 18, deep = 22;    // objetivo profundo, sin llegar a la zona donde ya cuenta como "directo al cristal"
  const minX = team === 0 ? COURT.netX + 35 : COURT.x + deep;
  const maxX = team === 0 ? COURT.x + COURT.w - deep : COURT.netX - 35;
  const minY = COURT.y + margin;
  const maxY = COURT.y + COURT.h - margin;

  let tx = Math.max(minX, Math.min(maxX, rawAimX));
  let ty = Math.max(minY, Math.min(maxY, rawAimY));

  // En juego normal (no en saque), más carga y más fuerza empujan la bola más profunda
  if (!isLob && !isServe) {
    const depthPull = (chargeRatio - 0.4) * (50 + powerStat * 45);
    tx += (team === 0 ? depthPull : -depthPull);
    tx = Math.max(minX, Math.min(maxX, tx));
  }
  return { tx, ty };
}

// Balística: misma fórmula de siempre (aterriza en el objetivo a la velocidad horizontal pedida)
// + ayuda de paso de red: si la parábola no supera la red, el jugador "levanta" la bola
// (baja la velocidad hasta un 60%). Si aun así no alcanza, la bola se va a la red.
export function computeLaunch(fromX, fromY, fromZ, targetX, targetY, speedX, shotLabel, team) {
  const dirX = team === 0 ? 1 : -1;
  const distX = Math.max(85, Math.abs(targetX - fromX));
  let speed = speedX;
  let T = distX / speed;

  const dNet = (COURT.netX - fromX) * dirX;
  if (shotLabel !== 'GLOBO' && dNet > 0 && dNet < distX) {
    const f = dNet / distX;
    const need = NET_H + NET_CLEARANCE;
    const zAtNet = fromZ * (1 - f) + 0.5 * GRAVITY * T * T * f * (1 - f);
    if (zAtNet < need) {
      const tNeed = Math.sqrt(Math.max(0, 2 * (need - fromZ * (1 - f)) / (GRAVITY * f * (1 - f))));
      T = Math.min(tNeed, T / MIN_SPEED_FACTOR);
      speed = distX / T;
    }
  }

  let vz = (0.5 * GRAVITY * T * T - fromZ) / T;
  if (shotLabel === 'GLOBO' && vz < 5.6) vz = 5.9;
  return { vx: dirX * speed, vy: (targetY - fromY) / T, vz };
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
}

export function nextServerSlot(s) {
  for (let k = 0; k < 4; k++) {
    s = (s + 1) % 4;
    if (!state.players[s].out) return s;
  }
  return 0;
}
