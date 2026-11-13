import { BODY_MARGIN, COURT, GRAVITY, JUMP_CHARGE_FRAMES, JUMP_MAX_H, JUMP_MIN_H, MAX_CHARGE_FRAMES, NET_MARGIN, PAD_F, PAD_S, TILE_H, TILE_W, WALL_PLAY } from './constants.js';
import { holeAt, tileOf, tileRect } from './floor.js';
import { emitSound } from './game.js';
import { blinkSpot, blinkTo } from './hazards.js';
import { state } from './state.js';
import { reachOf, reachZOf } from './stats.js';
import { clamp } from './util.js';
import { insideCourt, waypoint } from './walls.js';

// Dónde se puede alcanzar una pelota que va cayendo afuera: el primer punto en que baja de cierta altura
function catchPoint(b, zMax) {
  let x = b.x, y = b.y, z = b.z, vz = b.vz;
  for (let k = 0; k < 300; k++) {
    x += b.vx; y += b.vy; z += vz; vz -= GRAVITY;
    if ((vz < 0 && z <= zMax) || z <= 0) return { x, y };
  }
  return { x, y };
}

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
    p.botJump = incoming && Math.random() < 0.25 + 0.5 * sk;   // si la pelota le pasa alta, a veces salta
    // Laboratorio: pelota fantasma (reacciona tarde y a veces le pega al aire) y hoyos (los más flojos a veces no miran el piso)
    if (incoming && b.ghost) { p.botDelay += 20; p.botWhiff = p.botWhiff || Math.random() < 0.45; }
    if (state.holes.length) p.botCareless = Math.random() < lack * 0.3;
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
  const solo = !partner || partner.out || partner.down || partner.fell;   // con el compañero en el suelo, cubre toda la cancha
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
  // Pelota afuera (por 3 o por 4) en su lado: el más cercano de la pareja sale por su puerta a rescatarla.
  // Si quedó afuera, vuelve a entrar por la puerta.
  if (state.phase === 'PLAY') {
    if (b.out && b.lastHitTeam !== p.team && sk >= 0.35) {
      const c = catchPoint(b, reachZOf(p) - 10);
      const mine = p.team === 0 ? c.x < COURT.netX : c.x > COURT.netX;
      const closer = !partner || partner.out || Math.hypot(p.x - c.x, p.y - c.y) <= Math.hypot(partner.x - c.x, partner.y - c.y);
      if (mine && closer) { targetX = c.x - (p.team === 0 ? 1 : -1) * PAD_F; targetY = c.y - PAD_S; }
    }
    if (p.outside || !insideCourt(targetX, targetY)) {
      const w = waypoint(p, targetX, targetY);
      targetX = w.x; targetY = w.y;
    }
  }

  // Esquiva el aviso de rayo si lo ve venir
  const bolt = state.bolts.find(bo => bo.slot === idx);
  if (bolt && Math.random() < 0.3 + 0.5 * sk) { targetY = p.y + (p.y < COURT.midY ? 80 : -80); }

  // Jefe que se teletransporta: si la pelota le queda lejos, aparece donde va a poder pegarle
  if (p.blinkMax && p.blinkCd === 0 && p.stun === 0 && state.phase === 'PLAY' && b.lastHitTeam !== p.team) {
    const spot = blinkSpot(p);
    if (spot && Math.hypot(spot.x - p.x, spot.y - p.y) > 140) {
      blinkTo(p, spot.x, spot.y);
      p.blinkCd = p.blinkMax;
      p.botDelay = 0;
      emitSound('blink');
      targetX = p.x; targetY = p.y;
    }
  }

  if (p.x < targetX - 8) inp.right = true;
  if (p.x > targetX + 8) inp.left = true;
  if (p.y < targetY - 8) inp.down = true;
  if (p.y > targetY + 8) inp.up = true;
  if (state.holes.length && !p.outside) avoidHoles(p, inp, p.botCareless);

  // Terremoto en camino sobre su lado: los que lo ven venir saltan justo antes de que llegue
  const qk = state.quake;
  const dodging = !!qk && qk.team === p.team && qk.t <= 15 && (() => {
    if (p.botQk !== qk.id) { p.botQk = qk.id; p.botQkDodge = Math.random() < 0.25 + 0.6 * sk; }
    return p.botQkDodge;
  })();

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

  // Salto: la pelota ya botó en su campo y se le va por arriba cerca del fondo o de la malla lateral, pero saltando la alcanza
  const zReach = reachZOf(p);
  const nearWall = (p.team === 0 ? b.x - COURT.x : COURT.x + COURT.w - b.x) < 160 || b.y < COURT.y + 70 || b.y > COURT.y + COURT.h - 70;
  if (dodging) {
    p.botJumpTarget = 4;
    inp.jump = qk.t > 11 && p.jumpCharge < 4;   // carga 4 cuadros y suelta: está en el aire cuando llega
  } else if (state.phase === 'PLAY' && p.botJump && nearWall && b.lastHitTeam !== p.team && ballOnMySide && b.bouncesInOpponentSide >= 1 &&
      p.jz === 0 && p.jumpCharge === 0 && distToPaddle < reach + 25 && b.z > zReach - 6 && b.z < zReach + JUMP_MAX_H - 4) {
    // carga lo justo para la altura que le falta
    const k = clamp((b.z - zReach + 10 - JUMP_MIN_H) / (JUMP_MAX_H - JUMP_MIN_H), 0, 1);
    p.botJumpTarget = 1 + Math.round(k * (JUMP_CHARGE_FRAMES - 1));
    inp.jump = true;
  } else if (p.jumpCharge > 0) {
    inp.jump = p.jumpCharge < p.botJumpTarget;   // suelta al llegar a la carga que quería
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
    if (p.charging && !p.botWhiff && !waitWall && distToPaddle < reach - 1 && b.z <= zReach + p.jz - 5) {
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


// ---- Laboratorio: hoyos del piso ----
// No camina hacia una baldosa abierta o que está avisando; si la que pisa empieza a avisar, sale por el borde más
// cercano que dé a piso firme dentro de su mitad. Distraído (careless) no mira los avisos: solo esquiva los hoyos ya
// abiertos, así que puede caer si la baldosa se abre bajo sus pies.
function avoidHoles(p, inp, careless) {
  const danger = (x, y) => !!holeAt(x, y, -3, !careless);
  const here = tileOf(p.x, p.y);
  if (!careless && here >= 0 && state.holes.some(h => h.i === here)) {
    const r = tileRect(here);
    const minX = p.team === 0 ? COURT.x + BODY_MARGIN : COURT.netX + NET_MARGIN, maxX = p.team === 0 ? COURT.netX - NET_MARGIN : COURT.x + COURT.w - BODY_MARGIN;
    const exits = [
      [p.x - r.x0, -1, 0, r.x0 - TILE_W / 2, p.y], [r.x1 - p.x, 1, 0, r.x1 + TILE_W / 2, p.y],
      [p.y - r.y0, 0, -1, p.x, r.y0 - TILE_H / 2], [r.y1 - p.y, 0, 1, p.x, r.y1 + TILE_H / 2]
    ].filter(e => e[3] > minX && e[3] < maxX && e[4] > COURT.y + BODY_MARGIN && e[4] < COURT.y + COURT.h - BODY_MARGIN && !danger(e[3], e[4]))
      .sort((a, b) => a[0] - b[0]);
    if (exits.length) {
      const [, dx, dy] = exits[0];
      inp.left = dx < 0; inp.right = dx > 0; inp.up = dy < 0; inp.down = dy > 0;
    }
    return;
  }
  const sx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), sy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  const STEP = 18;
  if (sx && danger(p.x + sx * STEP, p.y)) { inp.left = false; inp.right = false; }
  if (sy && danger(p.x, p.y + sy * STEP)) { inp.up = false; inp.down = false; }
  if ((inp.left || inp.right) && (inp.up || inp.down) && danger(p.x + sx * STEP, p.y + sy * STEP)) { inp.up = false; inp.down = false; }
}
