import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { COURT, NET_H, WALL_H_TALL, ZS } from '../core/constants.js';

// ---------- Cancha (versión mínima: suelo, líneas, paredes y red) ----------
export function buildCourt() {
  const g = new Group();
  const ground = new Mesh(new PlaneGeometry(4000, 3000), new MeshStandardMaterial({ color: '#1e2633' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(COURT.netX, -0.5, COURT.midY);
  g.add(ground);

  const turf = new Mesh(new PlaneGeometry(COURT.w, COURT.h), new MeshStandardMaterial({ color: '#1f58aa' }));
  turf.rotation.x = -Math.PI / 2;
  turf.position.set(COURT.netX, 0, COURT.midY);
  g.add(turf);

  const lineMat = new MeshStandardMaterial({ color: '#eef1f4' });
  const line = (x0, y0, x1, y1) => {
    const m = new Mesh(new PlaneGeometry(Math.max(2, x1 - x0), Math.max(2, y1 - y0)), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0.2, (y0 + y1) / 2);
    g.add(m);
  };
  line(COURT.serviceLeft - 1, COURT.y, COURT.serviceLeft + 1, COURT.y + COURT.h);
  line(COURT.serviceRight - 1, COURT.y, COURT.serviceRight + 1, COURT.y + COURT.h);
  line(COURT.serviceLeft, COURT.midY - 1, COURT.serviceRight, COURT.midY + 1);

  const wallMat = new MeshStandardMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.15 });
  const wall = (x, y, w, d) => {
    const m = new Mesh(new BoxGeometry(w, WALL_H_TALL, d), wallMat);
    m.position.set(x, WALL_H_TALL / 2, y);
    g.add(m);
  };
  wall(COURT.netX, COURT.y, COURT.w, 2);
  wall(COURT.netX, COURT.y + COURT.h, COURT.w, 2);
  wall(COURT.x, COURT.midY, 2, COURT.h);
  wall(COURT.x + COURT.w, COURT.midY, 2, COURT.h);

  const net = new Mesh(new BoxGeometry(1.5, NET_H * ZS, COURT.h), new MeshStandardMaterial({ color: '#10161e', transparent: true, opacity: 0.6 }));
  net.position.set(COURT.netX, NET_H * ZS / 2, COURT.midY);
  g.add(net);
  return g;
}
