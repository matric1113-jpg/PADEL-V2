import { seeded } from './noise.js';
import { MAP_STYLE } from './style.js';

// ---------- Telón de fondo de cada mapa, pintado en un canvas ----------
// Mismo dibujo que drawBackdrop del render 2D, en coordenadas del plano (x, z): el telón es un plano
// vertical en y = BACK_Y con las alturas aplastadas por BACK_ZK (cerros lejanos en una franja sobre
// la tribuna). Las coordenadas y la semilla del azar son las del 2D, así el paisaje queda igual.
export const BACK_Y = -175;
export const BACK_ZK = 0.42;
export const BACK_X0 = -1600, BACK_X1 = 2600, BACK_Z1 = 3200;
const PX = 0.85;                    // píxeles de textura por unidad del plano
const SCREEN_K = 0.75 / PX;         // un radio de R px en la pantalla del 2D ≈ R / SCREEN_K px de textura

function ellipsePts(cx, cz, rx, rz) {
  const out = [];
  for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; out.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); }
  return out;
}

export function paintBackdrop(id) {
  const W = Math.round((BACK_X1 - BACK_X0) * PX), H = Math.round(BACK_Z1 * BACK_ZK * PX);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const U = x => (x - BACK_X0) * PX, V = z => H - z * BACK_ZK * PX;
  const poly = (pts, fill) => {
    c.beginPath();
    pts.forEach(([x, z], k) => (k ? c.lineTo(U(x), V(z)) : c.moveTo(U(x), V(z))));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  };
  const radial = (x, z, r, stops) => {
    const R = r / SCREEN_K;
    const g = c.createRadialGradient(U(x), V(z), 0, U(x), V(z), R);
    stops.forEach(([t, col]) => g.addColorStop(t, col));
    c.fillStyle = g;
    c.fillRect(U(x) - R, V(z) - R, R * 2, R * 2);
  };
  const X0 = BACK_X0, X1 = BACK_X1;

  const sky = (MAP_STYLE[id] || MAP_STYLE.chile).sky;
  const g = c.createLinearGradient(0, V(1100), 0, V(0));
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rnd = seeded(id.length * 977 + 13);

  if (id === 'chile' || id === 'altura') {
    // Cordillera nevada en dos capas: primero el cerro, después la nieve en cada cumbre
    for (const [col, hMin, hMax, snow] of [['#4b5a7a', 380, 760, '#f3f5f9'], ['#2c3954', 220, 460, 'rgba(236, 240, 247, 0.92)']]) {
      const peaks = [];
      const pts = [[X0, 0]];
      let x = X0;
      while (x < X1) {
        const h = hMin + rnd() * (hMax - hMin), w = 120 + rnd() * 160;
        const valley = hMin * 0.55 + rnd() * 60;
        pts.push([x + w * 0.5, h]); pts.push([x + w, valley]);
        peaks.push([x + w * 0.5, h, w]);
        x += w;
      }
      pts.push([X1, 0]);
      poly(pts, col);
      for (const [px, h, w] of peaks) poly([[px - w * 0.16, h * 0.74], [px, h], [px + w * 0.16, h * 0.74], [px + w * 0.05, h * 0.8], [px - w * 0.06, h * 0.78]], snow);
    }
    if (id === 'altura') {
      for (let k = 0; k < 14; k++) poly(ellipsePts(X0 + rnd() * (X1 - X0), 40 + rnd() * 80, 260 + rnd() * 200, 40 + rnd() * 30), 'rgba(225, 232, 240, 0.55)');
    }
  } else if (id === 'brasil') {
    radial(1500, 300, 70, [[0, 'rgba(255, 245, 210, 1)'], [0.4, 'rgba(255, 220, 150, 0.8)'], [1, 'rgba(255, 210, 140, 0)']]);
    const sea = c.createLinearGradient(0, V(140), 0, V(0));
    sea.addColorStop(0, '#1f7fa0'); sea.addColorStop(1, '#45c3cf');
    poly([[X0, 0], [X1, 0], [X1, 140], [X0, 140]], sea);
    for (let k = 0; k < 40; k++) { const x = X0 + rnd() * (X1 - X0), z = 10 + rnd() * 120; poly([[x, z], [x + 60, z], [x + 60, z + 3], [x, z + 3]], 'rgba(255,255,255,0.35)'); }
  } else if (id === 'china') {
    for (let k = 0; k < 60; k++) {
      const x = X0 + (k / 60) * (X1 - X0) + rnd() * 30, w = 50 + rnd() * 70, h = 160 + rnd() * 520;
      poly([[x, 0], [x + w, 0], [x + w, h], [x, h]], k % 3 ? '#151b36' : '#1b2244');
      for (let wy = 30; wy < h - 20; wy += 28) for (let wx = x + 10; wx < x + w - 10; wx += 16) {
        if (rnd() < 0.35) poly([[wx, wy], [wx + 7, wy], [wx + 7, wy + 10], [wx, wy + 10]], rnd() < 0.7 ? '#ffd27a' : '#9fd3ff');
      }
    }
    for (let t = 0; t < 5; t++) {
      const z = t * 110, w = 230 - t * 34;
      poly([[-80 - w / 2, z], [-80 + w / 2, z], [-80 + w / 2 - 18, z + 80], [-80 - w / 2 + 18, z + 80]], '#3a1520');
      poly([[-80 - w / 2 - 40, z + 80], [-80 + w / 2 + 40, z + 80], [-80 + w / 2 - 10, z + 108], [-80 - w / 2 + 10, z + 108]], '#7a1e2a');
    }
    poly([[1185, 0], [1215, 0], [1205, 1100], [1195, 1100]], '#2a2448');
    poly(ellipsePts(1200, 420, 95, 95), '#c8457a');
    poly(ellipsePts(1200, 780, 60, 60), '#d85a8a');
  } else if (id === 'atlas') {
    for (let k = 0; k < 18; k++) poly(ellipsePts(X0 + rnd() * (X1 - X0), 80 + rnd() * 900, 180 + rnd() * 220, 50 + rnd() * 50), 'rgba(255, 255, 255, 0.55)');
    // El titán Atlas sostiene la cancha sobre sus hombros
    const bronze = '#9a6b3e', dark = '#6e4626';
    poly([[-500, 0], [1420, 0], [1250, 420], [-330, 420]], dark);
    poly([[-560, 0], [-330, 420], [-420, 780], [-640, 420]], bronze);
    poly([[1480, 0], [1250, 420], [1340, 780], [1560, 420]], bronze);
    poly(ellipsePts(460, 700, 260, 560), bronze);
    poly([[230, 560], [690, 560], [610, 200], [310, 200]], '#e9e3d6');
    poly([[330, 800], [420, 780], [420, 765], [330, 780]], dark);
    poly([[500, 780], [590, 800], [590, 780], [500, 765]], dark);
  } else if (id === 'crater') {
    poly([[-1200, 0], [-300, 700], [-60, 760], [160, 690], [900, 0]], '#1c0e0a');
    radial(-60, 740, 90, [[0, 'rgba(255, 170, 60, 0.95)'], [1, 'rgba(255, 80, 20, 0)']]);
    for (const [x0, x1] of [[-120, -500], [0, 380], [-60, 120]]) poly([[x0, 720], [x0 + 18, 720], [x1 + 30, 0], [x1, 0]], 'rgba(255, 110, 30, 0.85)');
    for (let k = 0; k < 10; k++) poly(ellipsePts(-60 + (rnd() - 0.5) * 900, 900 + rnd() * 900, 160 + rnd() * 160, 70 + rnd() * 50), 'rgba(40, 20, 18, 0.7)');
  }
  return cv;
}
