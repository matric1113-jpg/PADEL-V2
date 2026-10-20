import { VIEW_H, VIEW_W } from '../core/constants.js';
import { state } from '../core/state.js';
import { actOn, upLvl } from '../core/stats.js';
import { P } from '../view/camera.js';
import { fx } from '../view/fx.js';
import { ctx } from '../view/ctx.js';
import { lookOf, scaleOf } from '../view/skeleton.js';

// ---------- Capa 2D del render 3D: lo que no es parte del HUD común ----------

// Viñeta suave en los bordes (en el 2D venía con la capa de primer plano)
export function drawVignette() {
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.52, VIEW_W * 0.32, VIEW_W / 2, VIEW_H * 0.52, VIEW_W * 0.78);
  v.addColorStop(0, 'rgba(3, 8, 16, 0)');
  v.addColorStop(1, 'rgba(3, 8, 16, 0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// Estrellitas que giran sobre la cabeza del jugador paralizado por un rayo
export function drawStunStars(built, now) {
  state.players.forEach((p, idx) => {
    if (p.out || !(p.stun > 0) || !built[idx]) return;
    const Kz = scaleOf(p) * lookOf(p).body.h * (1 + 0.03 * upLvl(p, 'estiron')) * (actOn(p, 'gordo') ? 1.2 : 1);
    const top = P(p.x, p.y, 92 * Kz + (built[idx].jumpZ || 0));
    for (let k = 0; k < 3; k++) {
      const a = now * 0.006 + k * 2.1;
      const sx = top.x + Math.cos(a) * 10, sy = top.y + Math.sin(a) * 3.5;
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const b = i / 5 * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(sx + Math.cos(b) * 3.2, sy + Math.sin(b) * 3.2);
        ctx.lineTo(sx + Math.cos(b + 0.63) * 1.3, sy + Math.sin(b + 0.63) * 1.3);
      }
      ctx.fill();
    }
  });
}

// Rachas del viento (mapa En altura): trazos largos y brillantes que cruzan la pantalla en la dirección del viento.
// Van en la capa 2D (con la misma P() que el HUD) para que se vean aunque la cancha esté en sombra.
export function drawWindStreaks() {
  if (!fx.streaks.length) return;
  const gs = Math.sign(state.gust.w || 1);
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of fx.streaks) {
    const a = Math.sin(Math.PI * s.t / 60) * (0.35 + 0.5 * (fx.windK || 0));
    const p0 = P(s.x, s.y, s.z), p1 = P(s.x, s.y - gs * 150, s.z + 6);
    const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    g.addColorStop(0, `rgba(235, 244, 255, ${a})`);
    g.addColorStop(1, 'rgba(235, 244, 255, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.6 * p0.s;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  ctx.restore();
}
