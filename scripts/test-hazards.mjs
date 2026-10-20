// Prueba que la guía de tiro predice el mismo desvío que sufre la pelota con el viento (En altura) y con la
// inclinación (Hombros de Atlas): se integra la trayectoria igual que view/hud.js (gustForce(i + 1) y
// tiltEase(i + 1)) y se compara con stepPhysics.
//   npm run test:hazards
import { gustForce, state, tiltEase } from '../src/core/state.js';
import { GRAVITY, TILT_BALL_ACCEL } from '../src/core/constants.js';
import { prepareRoster, setMap, startFriendly } from '../src/core/game.js';
import { stepPhysics } from '../src/core/physics.js';

prepareRoster('friendly');
startFriendly();
state.screen = 'play';
state.players.forEach(p => { p.out = true; });
let worst = 0, n = 0;
const shots = [[1.6, 0.4, 3.4], [-1.4, -1.1, 4.2], [1.0, 0.0, 2.6]];   // se quedan en su mitad de la cancha (sin red ni cristal)
function run(label, map, setHazard) {
  setMap(map);
  for (const h of setHazard) {
    for (const [vx, vy, vz] of shots) {
      state.phase = 'PLAY'; state.screen = 'play'; state.pauseTimer = 0;
      state.hz = { bolt: 9999, tilt: 9999, gust: 9999 };
      state.gust = { w: 0, t: 0 }; state.tilt = { x: 0, y: 0, t: 0 };
      h();
      Object.assign(state.ball, { x: 300, y: 260, z: 20, vx, vy, vz, lastHitTeam: 0, bouncesInOpponentSide: 0, isServeShot: false, shotType: 'DRIVE', cut: 0, trail: [] });
      let x = 300, y = 260, z = 20, pvx = vx, pvy = vy, pvz = vz, pred = null;
      for (let i = 0; i < 400; i++) {
        x += pvx; y += pvy; z += pvz; pvz -= GRAVITY;
        if (z > 0) { pvy += gustForce(i + 1); const e = tiltEase(i + 1) * TILT_BALL_ACCEL; pvx += state.tilt.x * e; pvy += state.tilt.y * e; }
        if (z <= 0) { pred = { x, y }; break; }
      }
      let real = null;
      for (let i = 0; i < 400 && !real; i++) {
        stepPhysics();
        if (state.ball.z <= 0 || state.ball.bouncesInOpponentSide > 0 || state.phase !== 'PLAY') real = { x: state.ball.x, y: state.ball.y };
      }
      if (!pred || !real) { console.log('sin bote', label); process.exit(1); }
      const err = Math.hypot(pred.x - real.x, pred.y - real.y);
      if (err > 0.5) console.log('desvío', label, { vx, vy, vz, gust: state.gust, tilt: state.tilt, pred, real, err }); worst = Math.max(worst, err); n++;
    }
  }
  console.log(label + ': ok');
}
const winds = [];
for (const w of [0.035, -0.055, 0.055, -0.04]) for (const t0 of [240, 150, 60]) winds.push(() => { state.gust = { w, t: t0 }; });
run('viento (En altura)', 'altura', winds);
const tilts = [];
for (const a of [0, 1.3, 2.6, 4.1]) for (const t0 of [240, 200, 120, 40]) tilts.push(() => { state.tilt = { x: Math.cos(a), y: Math.sin(a), t: t0 }; });
run('inclinación (Atlas)', 'atlas', tilts);
console.log(`${n} trayectorias; error máximo entre la guía y la física: ${worst.toExponential(2)} unidades`);
if (worst > 0.5) { console.log('LA GUÍA NO COINCIDE CON LA FÍSICA'); process.exit(1); }
