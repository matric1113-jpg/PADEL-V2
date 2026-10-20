import { computeLaunch, computeServeBox, getClampedTarget, launchBall, showBanner } from './ballistics.js';
import { updateBotLogic } from './bots.js';
import { BASE_ROLL, BODY_MARGIN, COURT, GLASS_MIN_VZ, GLASS_MIN_VZ_TRIGGER, GLASS_SMASH_MIN_VZ, GRAVITY, GUST_PLAYER_PUSH, JUMP_G, JUMP_G_HELD, JUMP_HOLD_FRAMES, JUMP_LAND_FRAMES, JUMP_LAND_SLOW, JUMP_MAX_H, JUMP_REJUMP_FRAMES, JUMP_SMASH_BONUS, JUMP_V0, SMASH_FULL_Z, SMASH_LOW_BOUNCE, SMASH_LOW_SPEED, TILT_BALL_ACCEL, TILT_PLAYER_PUSH, LIGHTS, MAX_CHARGE_FRAMES, NET_H, PODIUM_FRAMES, NET_MARGIN, OVER_WALL_RULE, PAD_F, PAD_S, SPEED_BOOST, SPRINT_COOLDOWN, SPRINT_DURATION, WALL_H_TALL, ZS, sideWallHeight } from './constants.js';
import { BOSSES } from './data.js';
import { awardPoint, checkVoteReady, emitSound, goToScreen, setupServe } from './game.js';
import { activate, updateHazards } from './hazards.js';
import { gustForce, tiltEase, inputOf, localInput, mapOf, remoteInputs, rt, state } from './state.js';
import { actOn, chargeRateOf, reachOf, reachZOf, smashMinOf, upLvl } from './stats.js';
import { clamp } from './util.js';

// ¿Está apuntando a su propio cristal de fondo para hacer contrapared?
export function isContraAim(p, aimX) {
  if (p.team === 0) return aimX < p.x - 25 && p.x < COURT.x + 170;
  return aimX > p.x + 25 && p.x > COURT.x + COURT.w - 170;
}
export function contraTarget(p, aimY) {
  const tx = p.team === 0 ? COURT.netX + (COURT.x + COURT.w - COURT.netX) * 0.72 : COURT.netX - (COURT.netX - COURT.x) * 0.72;
  return { tx, ty: clamp(aimY, COURT.y + 40, COURT.y + COURT.h - 40) };
}
function launchContra(p) {
  const b = state.ball;
  const wallX = p.team === 0 ? COURT.x + 10 : COURT.x + COURT.w - 10;
  const dist = Math.max(14, Math.abs(b.x - wallX));
  const T = Math.max(6, dist / 5.2);
  const wy = clamp(p.aimY, COURT.y + 30, COURT.y + COURT.h - 30);
  b.vx = (wallX - b.x) / T;
  b.vy = (wy - b.y) / T;
  b.vz = (58 - b.z + 0.5 * GRAVITY * T * T) / T;
  b.lastHitTeam = p.team;
  b.bouncesInOpponentSide = 0;
  b.isServeShot = false;
  b.shotType = 'CONTRAPARED';
  b.cut = 0;
  b.cpTarget = contraTarget(p, p.aimY);
  b.hitSeq = (b.hitSeq || 0) + 1;
  b.wallBounced = false;
}

// Fuera del juego (tienda, pausa entre puntos, menús) un clic soltado no debe quedar pendiente: si no, al volver
// al saque la física lo leería como un golpe nuevo y quien saca lanzaría la pelota solo (pasaba al tocar "Listo").
function discardPendingSwings() {
  state.players.forEach(p => {
    if (p.isBot) return;
    p.lastReleaseSeq = inputOf(p).releaseSeq;
    p.charging = false; p.chargeFrames = 0;
  });
}

export function stepPhysics() {
  if (localInput.charging) {
    rt.localChargeFrames = Math.min(MAX_CHARGE_FRAMES, rt.localChargeFrames + chargeRateOf(state.players[rt.mySlot]));
  } else {
    rt.localChargeFrames = 0;
  }

  if (!rt.isHost) return;

  remoteInputs[rt.myUid] = { ...localInput };
  if (state.screen !== 'play' || state.phase === 'POINT_PAUSE') discardPendingSwings();
  if (state.screen === 'shop2') { checkVoteReady(); return; }
  if (state.screen === 'podium') { if (++rt.podiumT >= PODIUM_FRAMES) state.screen = 'matchover'; return; }
  if (state.screen !== 'play') return;

  if (state.bannerTimer > 0 && state.phase === 'PLAY') state.bannerTimer--;
  updateHazards();

  if (state.phase === 'POINT_PAUSE') {
    state.pauseTimer--;
    if (state.pauseTimer <= 0) {
      if (state.afterPause) { const s = state.afterPause; state.afterPause = null; goToScreen(s); }
      else setupServe(state.serverSlot);
    }
    return;
  }

  const b = state.ball;
  const M = mapOf();

  state.players.forEach((p, idx) => {
    if (p.out) return;
    if (p.cooldown > 0) p.cooldown--;
    if (p.swingTimer > 0) p.swingTimer--;
    if (p.sprintActiveTimer > 0) p.sprintActiveTimer--;
    if (p.sprintCooldown > 0) p.sprintCooldown--;
    if (p.activeCd > 0) p.activeCd--;
    if (p.activeT > 0 && --p.activeT === 0) { p.activeKind = ''; p.clone = null; }
    if (p.slow > 0) p.slow--;
    if (p.burn > 0) p.burn--;
    if (p.burnCd > 0) p.burnCd--;
    if (p.landSlow > 0) p.landSlow--;

    const inp = p.isBot ? updateBotLogic(p, idx) : inputOf(p);

    // Salto en el aire (sigue aunque lo paralice un rayo): con el Espacio apretado mientras sube, la gravedad pesa menos
    if (p.jz > 0 || p.jvz > 0) {
      const holding = inp.jump && p.jumpHold > 0 && p.jvz > 0;
      p.jvz -= holding ? JUMP_G_HELD : JUMP_G;
      if (holding) p.jumpHold--;
      p.jz += p.jvz;
      if (p.jz <= 0) { p.jz = 0; p.jvz = 0; p.landSlow = JUMP_LAND_FRAMES; }
    }
    const jumpPressed = inp.jump && !p.jumpPrev;
    p.jumpPrev = !!inp.jump;

    if (typeof inp.speedPref === 'number' && !p.isBot) {
      p.speedStat = Math.max(0.15, Math.min(0.85, inp.speedPref));
      p.powerStat = 1 - p.speedStat;
    }

    p.aimX = inp.aimX;
    p.aimY = inp.aimY;

    // Paralizado por un rayo: no se mueve ni le pega
    if (p.stun > 0) {
      p.stun--;
      p.charging = false; p.chargeFrames = 0;
      p.lastReleaseSeq = inp.releaseSeq;
      p.vx = 0; p.vy = 0;
      return;
    }

    // Espacio: salto (no al sacar ni apenas cae de otro salto)
    if (jumpPressed && p.jz === 0 && p.jvz === 0 && p.landSlow <= JUMP_LAND_FRAMES - JUMP_REJUMP_FRAMES &&
        !(state.phase === 'SERVE' && idx === state.serverSlot)) {
      p.jvz = JUMP_V0;
      p.jumpHold = JUMP_HOLD_FRAMES;
      emitSound('jump');
    }

    // Shift: activa si tiene una equipada; si no, sprint
    if (inp.sprint) {
      if (p.active) {
        if (p.activeCd === 0 && p.activeT === 0) activate(p, idx);
      } else if (p.sprintCooldown === 0 && p.sprintActiveTimer === 0) {
        const sl = upLvl(p, 'sprint');
        p.sprintDurMax = Math.round(SPRINT_DURATION * (1 + 0.15 * sl));
        p.sprintCdMax = Math.round(SPRINT_COOLDOWN * (1 - 0.3 * sl));
        p.sprintActiveTimer = p.sprintDurMax;
        p.sprintCooldown = p.sprintCdMax;
        emitSound('sprint');
      }
    }

    if (inp.charging && p.cooldown === 0) {
      p.charging = true;
      p.lobMode = inp.lobMode;
      p.chargeFrames = Math.min(MAX_CHARGE_FRAMES, p.chargeFrames + chargeRateOf(p));
    }

    if (inp.releaseSeq !== p.lastReleaseSeq) {
      p.lastReleaseSeq = inp.releaseSeq;
      if (p.cooldown === 0) {
        p.swingTimer = 11;
        p.swingCharge = Math.max(0.15, inp.lastChargeRatio || (p.chargeFrames / MAX_CHARGE_FRAMES));
        p.swingLob = inp.lastReleaseLob;
        p.cooldown = 28;
      }
      p.charging = false;
      p.chargeFrames = 0;
    } else if (!inp.charging) {
      p.charging = false;
      p.chargeFrames = 0;
    }

    // Velocidad
    const sprinting = p.sprintActiveTimer > 0;
    let moveSpeed = (2.75 + p.speedStat * 1.85) * SPEED_BOOST * (p.speedMult || 1);
    if (p.charging) moveSpeed *= sprinting ? 0.8 : 0.68;       // con sprint la carga pesa menos
    if (sprinting) moveSpeed *= 1.58;
    moveSpeed *= 1 + 0.07 * upLvl(p, 'zapas');
    if (p.isBot) moveSpeed *= 0.8 + 0.2 * (p.skill == null ? 1 : p.skill);
    if (actOn(p, 'gordo')) moveSpeed *= 0.45;
    if (p.slow > 0) moveSpeed *= 0.5;
    if (p.burn > 0) moveSpeed *= 0.6;
    if (p.landSlow > 0) moveSpeed *= 1 - JUMP_LAND_SLOW * (p.landSlow / JUMP_LAND_FRAMES);   // recién caído de un salto

    const tvx = (inp.right ? moveSpeed : 0) - (inp.left ? moveSpeed : 0);
    const tvy = (inp.down ? moveSpeed : 0) - (inp.up ? moveSpeed : 0);
    if (state.ice && state.ice.side === p.team) {
      // Hielo: cuesta frenar y cambiar de dirección
      p.vx += (tvx - p.vx) * 0.06;
      p.vy += (tvy - p.vy) * 0.06;
    } else {
      p.vx = tvx; p.vy = tvy;
    }
    p.x += p.vx;
    p.y += p.vy;
    if (state.tilt.t > 0) { const e = tiltEase() * TILT_PLAYER_PUSH; p.x += state.tilt.x * e; p.y += state.tilt.y * e; }
    if (state.gust.t > 0) p.y += gustForce() * GUST_PLAYER_PUSH;

    let minX = p.team === 0 ? COURT.x + BODY_MARGIN : COURT.netX + NET_MARGIN;
    let maxX = p.team === 0 ? COURT.netX - NET_MARGIN : COURT.x + COURT.w - BODY_MARGIN;
    if (state.phase === 'SERVE' && idx === state.serverSlot) {
      if (p.team === 0) maxX = COURT.serviceLeft - 10;
      else minX = COURT.serviceRight + 10;
    }
    const minY = COURT.y + BODY_MARGIN, maxY = COURT.y + COURT.h - BODY_MARGIN;
    const rawX = p.x, rawY = p.y;
    p.x = Math.max(minX, Math.min(maxX, p.x));
    p.y = Math.max(minY, Math.min(maxY, p.y));

    // Cráter: tocar el cristal quema y empuja hacia adentro
    if (M.hotGlass && p.burnCd === 0) {
      const backWall = p.team === 0 ? rawX < COURT.x + BODY_MARGIN : rawX > COURT.x + COURT.w - BODY_MARGIN;
      const sideWall = rawY < minY || rawY > maxY;
      if (backWall || sideWall) {
        p.burn = 240; p.burnCd = 300;
        if (backWall) p.x += (p.team === 0 ? 1 : -1) * 26;
        if (rawY < minY) p.y += 26;
        if (rawY > maxY) p.y -= 26;
        emitSound('burn');
      }
    }
    if (M.embers) {
      for (const e of state.embers) if (Math.hypot(p.x - e.x, p.y - e.y) < 22) { p.slow = 20; break; }
    }
    if (p.clone) {
      p.clone.x = clamp(p.clone.x + p.vx, minX, maxX);
      p.clone.y = clamp(p.clone.y + p.vy, minY, maxY);
    }

    const dir = p.team === 0 ? 1 : -1;
    const paddleX = p.x + dir * PAD_F;
    const paddleY = p.y + PAD_S;
    const power = (p.powerMult || 1) * (actOn(p, 'gordo') ? 1.5 : 1);

    // FASE DE SAQUE
    if (state.phase === 'SERVE' && idx === state.serverSlot) {
      state.serveTargetBox = computeServeBox(p);
      b.x = paddleX + dir * 6;
      b.y = paddleY;
      b.z = 16;
      if (p.isBot) state.serveBotTimer--;

      if (p.swingTimer > 0) {
        state.phase = 'PLAY';
        p.swingTimer = 0;
        const { tx, ty } = getClampedTarget(p.team, p.aimX, p.aimY, p.swingCharge, p.powerStat, false, true);
        const serveSpeed = (5.4 + (p.swingCharge * 2.2) + (p.powerStat * 1.4)) * (1 + 0.06 * upLvl(p, 'fuerza')) * Math.min(power, 1.15);
        launchBall(tx, ty, serveSpeed, 'SAQUE', p.team, true, upLvl(p, 'cortado'));
        emitSound('hit');
        showBanner('Saque en juego', 35);
      }
      return;
    }

    // FASE DE JUEGO: impacto con la pala (o con la del clon)
    if (state.phase === 'PLAY' && p.swingTimer > 0) {
      const ballStrictlyOnMySide = (p.team === 0 && b.x < COURT.netX - 6) || (p.team === 1 && b.x > COURT.netX + 6);
      if (b.lastHitTeam === p.team || !ballStrictlyOnMySide) return;

      let distToPaddle = Math.hypot(b.x - paddleX, b.y - paddleY);
      if (p.clone) distToPaddle = Math.min(distToPaddle, Math.hypot(b.x - (p.clone.x + dir * PAD_F), b.y - (p.clone.y + PAD_S)));
      if (distToPaddle <= reachOf(p) && b.z <= reachZOf(p) + p.jz) {
        p.swingTimer = 0;
        const chargePct = Math.round(p.swingCharge * 100);

        if (!p.swingLob && isContraAim(p, p.aimX)) {
          launchContra(p);
          emitSound('hit');
          showBanner('Contrapared', 40);
          return;
        }

        const { tx, ty } = getClampedTarget(p.team, p.aimX, p.aimY, p.swingCharge, p.powerStat, p.swingLob, false);
        const powerMultiplier = (0.78 + (p.powerStat * 0.52)) * (1 + 0.12 * upLvl(p, 'fuerza')) * power;
        const rl = upLvl(p, 'remate');

        if (p.swingLob) {
          const lobSpeed = 3.9 + p.swingCharge * 1.3;
          launchBall(tx, ty, lobSpeed, 'GLOBO', p.team, false, 0);
          emitSound('lob');
          showBanner(`Globo ${chargePct}%`, 35);
        } else if (b.z > smashMinOf(p) && p.swingCharge >= (rl ? 0.4 : 0.5) && Math.abs(p.x - COURT.netX) < 220) {
          // Pegarle arriba se premia: bajo SMASH_FULL_Z sale algo más lento y bota menos (cuesta más sacarla por 3 o por 4)
          const k = clamp((b.z - smashMinOf(p)) / Math.max(1, SMASH_FULL_Z - smashMinOf(p)), 0, 1);
          const air = 1 + JUMP_SMASH_BONUS * Math.min(1, p.jz / JUMP_MAX_H);
          const smashSpeed = (7.8 + p.swingCharge * 3.8) * powerMultiplier * (1 + 0.1 * rl) * (SMASH_LOW_SPEED + (1 - SMASH_LOW_SPEED) * k) * air;
          launchBall(tx, ty, smashSpeed, '¡REMATE!', p.team, false, 0);
          b.smashK = k;
          emitSound(isFlashShot(p) ? 'flash' : 'smash');
          showBanner(`Remate ${chargePct}%`, 45);
        } else {
          const driveSpeed = (5.2 + p.swingCharge * 4.0) * powerMultiplier;
          launchBall(tx, ty, driveSpeed, 'DRIVE', p.team, false, upLvl(p, 'cortado'));
          emitSound(isFlashShot(p) ? 'flash' : 'hit');
        }
      }
    }
  });

  if (state.phase !== 'PLAY') return;

  b.trail.push({ x: b.x, y: b.y, z: b.z });
  if (b.trail.length > 10) b.trail.shift();

  const prevX = b.x;
  b.x += b.vx;
  b.y += b.vy;
  b.z += b.vz;
  b.vz -= GRAVITY;
  if (b.z > 0) {
    if (state.gust.t > 0) b.vy += gustForce();
    if (state.tilt.t > 0) { const e = tiltEase() * TILT_BALL_ACCEL; b.vx += state.tilt.x * e; b.vy += state.tilt.y * e; }
  }

  // Focos: un globo altísimo puede romper uno
  LIGHTS.forEach((L, i) => {
    if (!state.lights[i]) return;
    if (Math.hypot(b.x - L.x, b.y - L.y) < 42 && Math.abs(b.z * ZS - L.z) < 36) {
      state.lights[i] = false;
      b.vz = -Math.abs(b.vz) * 0.3;
      b.vx *= 0.6;
      b.vy = (L.y < COURT.midY ? 1 : -1) * Math.max(0.5, Math.abs(b.vy) * 0.6);
      emitSound('lightbreak');
      showBanner('¡Rompieron un foco!\nEse lado de la cancha queda más oscuro', 90);
    }
  });

  // Cruce de red
  const crossedNet = (prevX <= COURT.netX && b.x > COURT.netX) || (prevX >= COURT.netX && b.x < COURT.netX);
  if (crossedNet) {
    if (b.z < NET_H) {
      if (b.bouncesInOpponentSide >= 1) {
        awardPoint(b.lastHitTeam, 'Remate ganador: volvió contra la red');
      } else {
        awardPoint(b.lastHitTeam === 0 ? 1 : 0, b.isServeShot ? 'Falta de saque: red' : 'Pelota en la red', true);
      }
      return;
    }
  }

  // Bote en el suelo
  if (b.z <= 0) {
    b.z = 0;
    const currentSide = b.x < COURT.netX ? 0 : 1;
    const iced = state.ice && state.ice.side === currentSide;
    const smashBounce = SMASH_LOW_BOUNCE + (0.84 - SMASH_LOW_BOUNCE) * (b.smashK == null ? 1 : b.smashK);
    const bounceRestitution = (b.shotType === '¡REMATE!' ? smashBounce : 0.74 - 0.07 * (b.cut || 0)) * M.bounceZ * (iced ? 0.8 : 1);
    b.vz = Math.abs(b.vz) * bounceRestitution;
    const roll = BASE_ROLL * M.roll * (iced ? 1.08 : 1);
    b.vx *= roll;
    b.vy *= roll;
    if (M.embers && b.shotType === '¡REMATE!') state.embers.push({ x: b.x, y: b.y, t: 240 });
    emitSound('bounce');

    // CASO 1: la pelota bota en el lado del mismo equipo que golpeó
    if (currentSide === b.lastHitTeam) {
      if (b.bouncesInOpponentSide >= 1) {
        awardPoint(b.lastHitTeam, 'Remate ganador: la pelota volvió a su campo');
      } else {
        awardPoint(currentSide === 0 ? 1 : 0, 'Falta: botó en su propio campo', true);
      }
      return;
    }

    // CASO 2: la pelota bota en el campo rival
    if (b.isServeShot && b.bouncesInOpponentSide === 0) {
      const box = state.serveTargetBox;
      const inBoxX = b.x >= box.minX - 4 && b.x <= box.maxX + 4;
      const inBoxY = b.y >= box.minY - 4 && b.y <= box.maxY + 4;
      if (!inBoxX || !inBoxY) {
        awardPoint(b.lastHitTeam === 0 ? 1 : 0, 'Falta de saque: fuera del cuadro', true);
        return;
      }
    }

    b.bouncesInOpponentSide++;

    if (b.bouncesInOpponentSide >= 2) {
      awardPoint(b.lastHitTeam, 'Doble bote');
      return;
    }
  }

  // Rebotes en cristales y malla metálica
  const hitLeft = b.x <= COURT.x + 10;
  const hitRight = b.x >= COURT.x + COURT.w - 10;
  const hitTop = b.y <= COURT.y + 10;
  const hitBottom = b.y >= COURT.y + COURT.h - 10;

  if (hitLeft || hitRight || hitTop || hitBottom) {
    // 0. Contrapared: la pelota pega en el cristal propio y sale en globo hacia el rival
    if (b.shotType === 'CONTRAPARED') {
      const ownSide = (b.x < COURT.netX ? 0 : 1) === b.lastHitTeam;
      if (ownSide && b.cpTarget) {
        if (hitLeft) b.x = COURT.x + 11;
        if (hitRight) b.x = COURT.x + COURT.w - 11;
        if (hitTop) b.y = COURT.y + 11;
        if (hitBottom) b.y = COURT.y + COURT.h - 11;
        const v = computeLaunch(b.x, b.y, b.z, b.cpTarget.tx, b.cpTarget.ty, 4.6, 'GLOBO', b.lastHitTeam);
        b.vx = v.vx; b.vy = v.vy; b.vz = v.vz;
        b.shotType = 'GLOBO';
        b.cpTarget = null;
        state.rally.cp[b.lastHitTeam] = true;
        emitSound('glass');
        return;
      }
    }

    // 1. Contra la pared rival sin haber dado su primer bote en el suelo: fuera
    if (b.bouncesInOpponentSide === 0) {
      const msg = b.isServeShot ? 'Falta de saque: directo a la pared' : 'Fuera: directo al cristal';
      awardPoint(b.lastHitTeam === 0 ? 1 : 0, msg, true);
      return;
    }

    // 2. Saque que bota en el cuadro y luego toca la malla metálica: falta
    const isSideMesh = (hitTop || hitBottom) &&
      (b.x > COURT.x + COURT.glassLength) &&
      (b.x < COURT.x + COURT.w - COURT.glassLength);

    if (b.isServeShot && isSideMesh) {
      awardPoint(b.lastHitTeam === 0 ? 1 : 0, 'Falta de saque: tocó la malla', true);
      return;
    }

    // 3. Tras botar, sale por encima de la pared → punto para quien pegó (por 3 / por 4)
    let wallH = 0;
    if (hitLeft || hitRight) wallH = Math.max(wallH, WALL_H_TALL);
    if (hitTop || hitBottom) wallH = Math.max(wallH, sideWallHeight(b.x));
    if (OVER_WALL_RULE && b.z * ZS > wallH) {
      const overBack = (hitLeft || hitRight);
      awardPoint(b.lastHitTeam, overBack ? 'Por 4: salió por encima del fondo' : 'Por 3: salió por la pared lateral');
      return;
    }

    emitSound('glass');

    let wallRestitution = b.shotType === '¡REMATE!' ? 0.92 : 0.74;
    if (M.hotGlass && (hitLeft || hitRight)) wallRestitution *= 1.3;   // cristales ardientes
    if (hitLeft) { b.x = COURT.x + 11; b.vx = Math.abs(b.vx) * wallRestitution; }
    if (hitRight) { b.x = COURT.x + COURT.w - 11; b.vx = -Math.abs(b.vx) * wallRestitution; }
    if (hitTop) { b.y = COURT.y + 11; b.vy = Math.abs(b.vy) * wallRestitution; }
    if (hitBottom) { b.y = COURT.y + COURT.h - 11; b.vy = -Math.abs(b.vy) * wallRestitution; }

    if (hitLeft || hitRight) b.wallBounced = true;
    if (b.shotType === '¡REMATE!' && (hitLeft || hitRight)) {
      b.vz = Math.max(b.vz, GLASS_SMASH_MIN_VZ);
    } else if (b.vz < GLASS_MIN_VZ_TRIGGER) {
      b.vz = GLASS_MIN_VZ;
    }
    b.isServeShot = false;
  }
}

// Los influencers sacan una foto con flash cuando le pegan cargado
function isFlashShot(p) {
  return p.team === 1 && state.mode === 'run' && BOSSES[state.run.boss].flash && p.swingCharge >= 0.65;
}
