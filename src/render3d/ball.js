import {
  BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Group, Line, LineDashedMaterial, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3
} from 'three';
import { BALL_R, ZS } from '../core/constants.js';
import { state } from '../core/state.js';
import { fx } from '../view/fx.js';

// ---------- Pelota: esfera con costura que gira, estela y guía de altura ----------
const TRAIL_MAX = 40;
const _a = new Vector3(), _b = new Vector3(), _d = new Vector3(), _n = new Vector3();

export class Ball {
  constructor() {
    this.group = new Group();
    this.mat = new MeshStandardMaterial({ color: '#e4ff3a', emissive: '#c8e020', emissiveIntensity: 0.35, roughness: 0.55 });
    this.mesh = new Mesh(new SphereGeometry(BALL_R, 24, 16), this.mat);
    this.mesh.castShadow = true;
    this.seam = new Mesh(new TorusGeometry(BALL_R * 0.98, 0.32, 6, 32), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 }));
    this.mesh.add(this.seam);
    this.group.add(this.mesh);

    // Estela: cinta que mira a la cámara, más ancha y opaca cerca de la pelota
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(TRAIL_MAX * 2 * 3), 3).setUsage(DynamicDrawUsage));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(TRAIL_MAX * 2 * 4), 4).setUsage(DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < TRAIL_MAX - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setIndex(idx);
    this.trail = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }));
    this.trail.frustumCulled = false;
    this.group.add(this.trail);

    // Línea punteada de la pelota al suelo cuando va alta
    const lg = new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, 1, 0)]);
    this.guide = new Line(lg, new LineDashedMaterial({ color: '#e4ff3a', dashSize: 3, gapSize: 5, transparent: true, opacity: 0.3 }));
    this.guide.computeLineDistances();
    this.guide.frustumCulled = false;
    this.group.add(this.guide);
  }

  update(camera, inReplay) {
    const b = state.ball;
    const h = b.z * ZS + BALL_R;
    const hot = b.shotType === '¡REMATE!';
    this.mesh.position.set(b.x, h, b.y);
    this.mat.color.set(hot ? '#ffe34a' : '#e4ff3a');
    this.mat.emissive.set(hot ? '#ff9a20' : '#c8e020');
    // La costura gira según la velocidad (fx.ballSpin), alrededor del eje perpendicular al avance
    this.seam.rotation.set(Math.PI / 2 + 0.5, fx.ballSpin, Math.atan2(b.vy, b.vx));

    const bh = b.z * ZS;
    this.guide.visible = bh > 30 && (state.phase === 'PLAY' || inReplay);
    if (this.guide.visible) {
      this.guide.position.set(b.x, 0, b.y);
      this.guide.scale.set(1, bh, 1);
      this.guide.material.dashSize = 3 / bh; this.guide.material.gapSize = 5 / bh;
    }
    this.updateTrail(camera, hot);
  }

  updateTrail(camera, hot) {
    const b = state.ball, tr = b.trail;
    if (state.phase !== 'PLAY' || tr.length < 2) { this.trail.visible = false; return; }
    this.trail.visible = true;
    const pts = tr.slice(-(TRAIL_MAX - 1)).map(t => new Vector3(t.x, t.z * ZS + BALL_R, t.y));
    pts.push(this.mesh.position.clone());
    const view = camera.userData.forward;
    const pos = this.trail.geometry.attributes.position, col = this.trail.geometry.attributes.color;
    const n = pts.length;
    const [r, g, bl] = hot ? [1, 0.75, 0.24] : [0.89, 1, 0.23];
    for (let i = 0; i < TRAIL_MAX; i++) {
      const j = Math.min(i, n - 1);
      _a.copy(pts[Math.max(0, j - 1)]); _b.copy(pts[Math.min(n - 1, j + 1)]);
      _d.subVectors(_b, _a);
      _n.crossVectors(_d, view).normalize();
      const k = (j + 1) / n;
      const w = BALL_R * k * 0.85;
      pos.setXYZ(i * 2, pts[j].x + _n.x * w, pts[j].y + _n.y * w, pts[j].z + _n.z * w);
      pos.setXYZ(i * 2 + 1, pts[j].x - _n.x * w, pts[j].y - _n.y * w, pts[j].z - _n.z * w);
      const al = i < n ? k * (hot ? 0.5 : 0.38) : 0;
      col.setXYZW(i * 2, r, g, bl, al);
      col.setXYZW(i * 2 + 1, r, g, bl, al);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}
