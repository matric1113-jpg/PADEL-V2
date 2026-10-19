// Prueba de la cámara 3D: debe ser matemáticamente igual a la del render 2D, o apuntar cambia.
//   npm run test:camera
// Para cada cámara (equipos 0 y 1, juego y repetición, con y sin inclinación de Atlas):
//  1. Puntos del suelo: P() (+ giro 2D) → pantalla → screenToGround (3D) debe devolver el mismo punto,
//     y lo mismo que unprojectGround tras deshacer el giro (lo que hace updateAimFromMouse en 2D).
//  2. Posiciones del mouse en toda la pantalla: la conversión 3D y la 2D deben coincidir.
//  3. Puntos con altura: la proyección de Three.js debe caer en el mismo píxel que P().
import { VIEW_H, VIEW_W } from '../src/core/constants.js';
import { CAMS, P, cam, setupCamera, unprojectGround } from '../src/view/camera.js';
import { applyCam, newCamera, projectPoint, screenToGround } from '../src/render3d/camera.js';

const TOL_GROUND = 1e-6;   // unidades de mundo (40 = 1 m)
const TOL_PIXEL = 1e-6;    // píxeles de VIEW

// Giro de la vista 2D, igual que setWorldTransform y updateAimFromMouse (render2d/world.js)
function viewForward(v, x, y) {
  if (!(v.rot || v.oy || v.k !== 1)) return { x, y };
  const cx = VIEW_W / 2, cy = VIEW_H / 2;
  const dx = (x - cx) * v.k, dy = (y - cy) * v.k;
  return { x: cx + dx * Math.cos(v.rot) - dy * Math.sin(v.rot), y: cy + v.oy + dx * Math.sin(v.rot) + dy * Math.cos(v.rot) };
}
function viewInverse(v, mx, my) {
  if (!(v.rot || v.oy || v.k !== 1)) return { x: mx, y: my };
  const cx = VIEW_W / 2, cy = VIEW_H / 2 + v.oy;
  const dx = (mx - cx) / v.k, dy = (my - cy) / v.k;
  return { x: cx + dx * Math.cos(-v.rot) - dy * Math.sin(-v.rot), y: cy - v.oy + dx * Math.sin(-v.rot) + dy * Math.cos(-v.rot) };
}

const VIEWS = [
  { name: 'sin giro', rot: 0, oy: 0, k: 1 },
  { name: 'Atlas inclinada', rot: 0.03, oy: 7, k: 1 + 0.03 * 1.6 },
  { name: 'Atlas al otro lado', rot: -0.021, oy: -10, k: 1 + 0.021 * 1.6 }
];
const groundPts = [];
for (let x = 0; x <= 920; x += 46) for (let y = 0; y <= 520; y += 26) groundPts.push([x, y]);

let checks = 0, worstGround = 0, worstPixel = 0, failures = 0;
const camera = newCamera();

for (const team of [0, 1]) {
  setupCamera(team);
  for (const which of ['main', 'replay']) {
    for (const v of VIEWS) {
      Object.assign(cam, CAMS[which]);
      applyCam(camera, CAMS[which], v);
      let caseWorst = 0;
      const fail = msg => { if (failures++ < 10) console.log('  FALLA', msg); };

      // 1. Puntos del suelo
      for (const [x, y] of groundPts) {
        const p = P(x, y, 0);
        const s = viewForward(v, p.x, p.y);
        const g3 = screenToGround(camera, s.x, s.y);
        const i2 = viewInverse(v, s.x, s.y);
        const g2 = unprojectGround(i2.x, i2.y);
        const e = Math.max(Math.hypot(g3.x - x, g3.y - y), Math.hypot(g3.x - g2.x, g3.y - g2.y));
        caseWorst = Math.max(caseWorst, e);
        if (!(e < TOL_GROUND)) fail(`equipo ${team} ${which} ${v.name}: suelo (${x}, ${y}) → 3D (${g3.x}, ${g3.y}) 2D (${g2.x}, ${g2.y})`);
        checks++;
      }
      worstGround = Math.max(worstGround, caseWorst);

      // 2. Mouse en toda la pantalla
      for (let sx = 0; sx <= VIEW_W; sx += 32) for (let sy = 0; sy <= VIEW_H; sy += 24) {
        const g3 = screenToGround(camera, sx, sy);
        const i2 = viewInverse(v, sx, sy);
        const g2 = unprojectGround(i2.x, i2.y);
        if (!g2 || !g3) {
          if (!!g2 !== !!g3) fail(`equipo ${team} ${which} ${v.name}: mouse (${sx}, ${sy}) uno da suelo y el otro no`);
          continue;
        }
        const e = Math.hypot(g3.x - g2.x, g3.y - g2.y) / Math.max(1, Math.hypot(g2.x, g2.y) / 1000);
        worstGround = Math.max(worstGround, e);
        if (!(e < TOL_GROUND)) fail(`equipo ${team} ${which} ${v.name}: mouse (${sx}, ${sy}) → 3D (${g3.x}, ${g3.y}) 2D (${g2.x}, ${g2.y})`);
        checks++;
      }

      // 3. Proyección de puntos con altura (pelota, cabezas, focos, paredes)
      for (const [x, y] of groundPts) for (const h of [0, 4.6, 37, 120, 160, 300]) {
        const p = P(x, y, h);
        const s2 = viewForward(v, p.x, p.y);
        const s3 = projectPoint(camera, x, y, h);
        const e = Math.hypot(s3.x - s2.x, s3.y - s2.y);
        worstPixel = Math.max(worstPixel, e);
        if (!(e < TOL_PIXEL)) fail(`equipo ${team} ${which} ${v.name}: (${x}, ${y}, ${h}) → 3D (${s3.x}, ${s3.y}) 2D (${s2.x}, ${s2.y})`);
        checks++;
      }
      console.log(`equipo ${team}, cámara ${which === 'main' ? 'de juego' : 'de repetición'}, ${v.name}: error máximo en el suelo ${caseWorst.toExponential(1)}`);
    }
  }
}

console.log(`\n${checks} comprobaciones. Error máximo: ${worstGround.toExponential(1)} unidades en el suelo, ${worstPixel.toExponential(1)} px en pantalla.`);
if (failures) {
  console.log(`${failures} fallas: la cámara 3D NO coincide con la 2D.`);
  process.exit(1);
}
console.log('La cámara 3D coincide con la 2D.');
