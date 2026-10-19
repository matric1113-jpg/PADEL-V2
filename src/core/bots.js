import { COURT, GRAVITY, MAX_CHARGE_FRAMES, PAD_F, PAD_S, WALL_PLAY } from './constants.js';
import { state } from './state.js';
import { reachOf, reachZOf } from './stats.js';
import { clamp } from './util.js';

export function updateBotLogic(p, idx) {
  const b = state.ball;
  const sk = p.skill == null ? 1 : p.skill;   // 1 = exactamente el bot original
  const lack = Math.max(0, 1 - sk);
  const inp = {
    up: false, down: false, left: false, right: false,
    sprint: false,
    speedPref: p.speedStat,
    charging: p.charging, lobMode: p.lobMode,
    aimX: p.aimX, aimY: p.aimY,
    releaseSeq: p.lastReleaseSeq,
    lastChargeRatio: 0.55, lastReleaseLob: false
  };

  if (state.phase === 'SERVE') {
    if (state.serverSlot === idx) {
      const box = state.serveTargetBox;
      if (state.serveBotTimer > 25) {
        if (!p.charging) {
          // Bots flojos apuntan peor y a veces sacan fuera
          p.botErrX = (Math.random() - 0.5) * lack * 120;
          p.botErrY = (Math.random() - 0.5) * lack * 150;
        }
        inp.charging = true;
        inp.aimX = (box.minX + box.maxX) / 2 + p.botErrX;
        inp.aimY = (box.minY + box.maxY) / 2 + p.botErrY;
      } else if (state.serveBotTimer <= 25 && p.charging) {
        inp.charging = false;
        inp.releaseSeq = p.lastReleaseSeq + 1;
        inp.lastChargeRatio = 0.5;
      }
    }
    return inp;
  }

  // Cada golpe rival: tiempo de reacción, error de posición, chance de fallar y de usar su activa
  if (b.hitSeq !== p.botSeq) {
    p.botSeq = b.hitSeq;
    const incoming = b.lastHitTeam !== p.team;
    p.botDelay = incoming ? Math.round(lack * 26 * (0.6 + Math.random() * 0.8)) : 0;
    p.botErrX = incoming ? (Math.random() - 0.5) * 2 * lack * 50 : 0;
    p.botErrY = incoming ? (Math.random() - 0.5) * 2 * lack * 50 : 0;
    p.botWhiff = incoming && Math.random() < lack * 0.32;
    p.botUseActive = incoming && Math.random() < 0.3 + 0.25 * sk;
    // Juego de pared: si la pelota va a botar cerca de su fondo, a veces la dejan pasar y la juegan de rebote
    p.botWallPlay = false;
    if (incoming) {
      let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
      for (let k = 0; k < 300 && z > 0; k++) { x += vx; y += vy; z += vz; vz -= GRAVITY; }
      const ownBack = p.team === 0 ? x - COURT.x : COURT.x + COURT.w - x;
      p.botWallPlay = ownBack < 150 && ownBack > 0 && (b.shotType === 'DRIVE' || b.shotType === 'SAQUE') && Math.random() < WALL_PLAY;
    }
  }

  const partner = state.players[idx % 2 === 0 ? idx + 1 : idx - 1];
  const solo = !partner || partner.out;
  const isTopPlayer = (idx % 2 === 0);
  const backX = p.team === 0 ? 175 : 745;
  const netXPos = p.backPref ? backX : (p.team === 0 ? 315 : 605);
  const homeY = solo ? COURT.midY : (isTopPlayer ? 155 : 365);

  const ballOnMySide = (p.team === 0 && b.x < COURT.netX) || (p.team === 1 && b.x > COURT.netX);
  const ballApproaching = (p.team === 0 && b.vx < 0) || (p.team === 1 && b.vx > 0);
  const inMyHalfY = solo ? true : (isTopPlayer ? (b.y < 285) : (b.y >= 235));

  let targetX = (ballOnMySide || ballApproaching) ? b.x : (b.shotType === 'GLOBO' ? backX : netXPos);
  let targetY = ((ballOnMySide || ballApproaching) && inMyHalfY) ? b.y : homeY;
  const waitWall = p.botWallPlay && !b.wallBounced && b.lastHitTeam !== p.team;
  if (waitWall && (ballOnMySide || ballApproaching)) {
    targetX = p.team === 0 ? Math.min(b.x, COURT.x + 75) : Math.max(b.x, COURT.x + COURT.w - 75);
  }

  if (p.botDelay > 0) {
    p.botDelay--;
    targetX = p.x; targetY = p.y;
  } else if (lack > 0) {
    const near = clamp(Math.hypot(b.x - p.x, b.y - p.y) / 220, 0, 1);
    targetX += p.botErrX * (0.35 + 0.65 * near);
    targetY += p.botErrY * (0.35 + 0.65 * near);
  }
  // Esquiva el aviso de rayo si lo ve venir
  const bolt = state.bolts.find(bo => bo.slot === idx);
  if (bolt && Math.random() < 0.3 + 0.5 * sk) { targetY = p.y + (p.y < COURT.midY ? 80 : -80); }

  if (p.x < targetX - 8) inp.right = true;
  if (p.x > targetX + 8) inp.left = true;
  if (p.y < targetY - 8) inp.down = true;
  if (p.y > targetY + 8) inp.up = true;

  const dir = p.team === 0 ? 1 : -1;
  const paddleX = p.x + dir * PAD_F;
  const paddleY = p.y + PAD_S;
  let distToPaddle = Math.hypot(b.x - paddleX, b.y - paddleY);
  if (p.clone) distToPaddle = Math.min(distToPaddle, Math.hypot(b.x - (p.clone.x + dir * PAD_F), b.y - (p.clone.y + PAD_S)));
  const reach = reachOf(p);

  if (!p.active && sk >= 0.55 && ballOnMySide && inMyHalfY && distToPaddle > 135 && p.sprintCooldown === 0) {
    inp.sprint = true;
  }
  // Activas: la usan cuando la pelota viene a ellos (hielo: justo al pegarle, para que caiga en la cancha congelada)
  if (p.active && p.activeCd === 0 && p.activeT === 0 && p.botUseActive && b.lastHitTeam !== p.team && ballOnMySide) {
    const kind = p.activePool === 'all' ? 'any' : p.active;
    if ((kind === 'hielo' && distToPaddle < reach + 12) || (kind !== 'hielo' && distToPaddle < 160)) inp.sprint = true;
  }

  if (state.phase === 'PLAY' && b.lastHitTeam !== p.team && ballOnMySide && distToPaddle < 130) {
    if (!p.charging && p.cooldown === 0) {
      inp.charging = true;
      // Contrapared: si la pelota ya lo pasó y está pegado a su fondo, le pega a su propio cristal
      const behind = p.team === 0 ? (b.x < p.x - 6) : (b.x > p.x + 6);
      const nearWall = p.team === 0 ? (p.x < COURT.x + 150) : (p.x > COURT.x + COURT.w - 150);
      const contra = behind && nearWall && b.bouncesInOpponentSide >= 1 && Math.random() < 0.6;
      inp.lobMode = !contra && (Math.random() < 0.22 && Math.abs(p.x - COURT.netX) > 220);
      if (contra) {
        inp.aimX = p.team === 0 ? COURT.x - 30 : COURT.x + COURT.w + 30;
        inp.aimY = b.y;
      } else {
        inp.aimX = p.team === 0 ? (600 + Math.random() * 230) : (90 + Math.random() * 230);
        inp.aimY = 260 + (Math.random() - 0.5) * 350 * (0.45 + 0.55 * sk);
      }
    }
    if (p.charging && !p.botWhiff && !waitWall && distToPaddle < reach - 1 && b.z <= reachZOf(p) - 5) {
      inp.charging = false;
      inp.releaseSeq = p.lastReleaseSeq + 1;
      inp.lastChargeRatio = Math.min(p.chargeFrames / MAX_CHARGE_FRAMES, 0.3 + 0.7 * sk);
      inp.lastReleaseLob = p.lobMode;
    }
  } else if (p.charging && b.lastHitTeam === p.team) {
    inp.charging = false;
  }

  return inp;
}

