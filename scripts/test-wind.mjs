// Prueba que la guía de tiro predice el mismo desvío que sufre la pelota con el viento (mapa En altura):
// se integra la trayectoria igual que view/hud.js (con gustForce(i + 1)) y se compara con stepPhysics.
//   npm run test:wind
import { gustForce, state } from '../src/core/state.js';
import { GRAVITY } from '../src/core/constants.js';
import { prepareRoster, setMap, startFriendly } from '../src/core/game.js';
import { stepPhysics } from '../src/core/physics.js';

prepareRoster('friendly');
startFriendly();
state.screen = 'play';
setMap('altura');
state.players.forEach(p => { p.out = true; });
let worst = 0, n = 0;
for (const w of [0.035, -0.055, 0.055, -0.04]) {
  for (const [vx, vy, vz] of [[3.2, 0.4, 3.4], [2.4, -1.1, 4.2], [4.1, 0.0, 2.6]]) {
    for (const t0 of [240, 150, 60]) {
      state.phase = 'PLAY'; state.screen = 'play'; state.pauseTimer = 0;
      state.hz = { bolt: 9999, tilt: 9999, gust: 9999 };
      state.gust = { w, t: t0 };
      Object.assign(state.ball, { x: 300, y: 260, z: 20, vx, vy, vz, lastHitTeam: 0, bouncesInOpponentSide: 0, isServeShot: false, shotType: 'DRIVE', cut: 0, trail: [] });
      // Predicción (misma integración que predictLanding)
      let x = 300, y = 260, z = 20, pvx = vx, pvy = vy, pvz = vz, pred = null;
      for (let i = 0; i < 400; i++) {
        x += pvx; y += pvy; z += pvz; pvz -= GRAVITY;
        if (z > 0) pvy += gustForce(i + 1);
        if (z <= 0) { pred = { x, y }; break; }
      }
      // Física real hasta el primer bote
      let real = null;
      for (let i = 0; i < 400 && !real; i++) {
        stepPhysics();
        if (state.ball.z <= 0 || state.ball.bouncesInOpponentSide > 0 || state.phase !== 'PLAY') real = { x: state.ball.x, y: state.ball.y };
      }
      if (!pred || !real) { console.log('sin bote', { w, vx, vy, vz, t0 }); process.exit(1); }
      const err = Math.hypot(pred.x - real.x, pred.y - real.y);
      worst = Math.max(worst, err); n++;
    }
  }
}
console.log(`${n} trayectorias; error máximo entre la guía y la física: ${worst.toExponential(2)} unidades`);
if (worst > 0.5) { console.log('LA GUÍA NO COINCIDE CON LA FÍSICA'); process.exit(1); }
