import { COURT, VIEW_H, VIEW_W, WALL_H_TALL } from '../core/constants.js';

// ---------- Cámara: inclinada (pitch) y girada en diagonal (yaw) ----------
export const cam = { ready: false, team: -1 };

export function makeCam(yaw, pitch, dist, target) {
  const hx = Math.sin(yaw), hy = -Math.cos(yaw);
  const f = { x: hx * Math.cos(pitch), y: hy * Math.cos(pitch), z: -Math.sin(pitch) };
  const r = { x: Math.cos(yaw), y: Math.sin(yaw), z: 0 };
  const u = { x: hx * Math.sin(pitch), y: hy * Math.sin(pitch), z: Math.cos(pitch) };
  const C = { x: target.x - f.x * dist, y: target.y - f.y * dist, z: target.z - f.z * dist };
  return { yaw, pitch, f, r, u, C };
}

export function setupCamera(team) {
  const yaw = (team === 1 ? -1 : 1) * 0.36;   // ~21°: tu equipo queda más cerca de la cámara
  CAMS.replay = fitCam(-yaw * 1.25, 0.6, 1500, team);
  CAMS.main = fitCam(yaw, 0.83, 1900, team);   // ~48° de inclinación, al estilo MOBA
  Object.assign(cam, CAMS.main);
  cam.ready = true;
}

function fitCam(yaw, pitch, dist, team) {
  const base = makeCam(yaw, pitch, dist, { x: COURT.netX, y: COURT.midY + 8, z: 24 });
  const { f, r, u, C } = base;

  // Encuadre automático: cancha + paredes completas dentro de la vista
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const corners = [[60, 40], [860, 40], [60, 480], [860, 480]];
  for (const [x, y] of corners) {
    for (const z of [0, WALL_H_TALL]) {
      const rx = x - C.x, ry = y - C.y, rz = z - C.z;
      const d = rx * f.x + ry * f.y + rz * f.z;
      const nx = (rx * r.x + ry * r.y) / d;
      const ny = -(rx * u.x + ry * u.y + rz * u.z) / d;
      minX = Math.min(minX, nx); maxX = Math.max(maxX, nx);
      minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
    }
  }
  const padL = 30, padR = 30, padT = 34, padB = 20;
  const F = Math.min((VIEW_W - padL - padR) / (maxX - minX), (VIEW_H - padT - padB) / (maxY - minY));
  return {
    ...base, team, F, ready: true,
    cx: padL + (VIEW_W - padL - padR) / 2 - F * (minX + maxX) / 2,
    cy: padT + (VIEW_H - padT - padB) / 2 - F * (minY + maxY) / 2
  };
}

// Mundo → pantalla. s = píxeles de pantalla por píxel de mundo a esa profundidad
export function P(x, y, z) {
  const rx = x - cam.C.x, ry = y - cam.C.y, rz = z - cam.C.z;
  const d = rx * cam.f.x + ry * cam.f.y + rz * cam.f.z;
  const s = cam.F / d;
  return {
    x: cam.cx + (rx * cam.r.x + ry * cam.r.y) * s,
    y: cam.cy - (rx * cam.u.x + ry * cam.u.y + rz * cam.u.z) * s,
    d, s
  };
}

// Pantalla → suelo (z = 0)
export function unprojectGround(sx, sy) {
  const a = (sx - cam.cx) / cam.F;
  const b = -(sy - cam.cy) / cam.F;
  const dx = cam.f.x + a * cam.r.x + b * cam.u.x;
  const dy = cam.f.y + a * cam.r.y + b * cam.u.y;
  const dz = cam.f.z + b * cam.u.z;
  if (dz > -1e-4) return null;
  const t = -cam.C.z / dz;
  return { x: cam.C.x + t * dx, y: cam.C.y + t * dy };
}

export function pathPts(c, pts, close = true) {
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  if (close) c.closePath();
}

export function groundCircle(x, y, r, z = 0, n = 30) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r, z));
  }
  return pts;
}
export const CAMS = { main: null, replay: null };
