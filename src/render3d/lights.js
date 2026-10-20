import {
  AdditiveBlending, BackSide, BoxGeometry, CanvasTexture, Color, ConeGeometry, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, SpotLight, Sprite, SpriteMaterial
} from 'three';
import { COURT, LIGHTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { styleOf } from './style.js';

// ---------- Los 2 focos: luces reales con sombra. Si la pelota rompe uno, su luz se apaga ----------
const SPOT_INTENSITY = 2.6;   // sin caída por distancia: la luz baja solo por el ángulo, pareja como en el 2D

function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 248, 225, 1)');
  g.addColorStop(0.2, 'rgba(255, 236, 190, 0.45)');
  g.addColorStop(1, 'rgba(255, 236, 190, 0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  return new CanvasTexture(cv);
}

// Cono de luz tenue (el haz que se ve en el aire)
const BEAM_FRAG = /* glsl */`
  varying float vH;
  uniform float uAlpha;
  void main() { gl_FragColor = vec4(1.0, 0.94, 0.8, uAlpha * vH * vH); }
`;
const BEAM_VERT = /* glsl */`
  varying float vH;
  void main() { vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export class CourtLights {
  constructor() {
    this.group = new Group();
    this.hemi = new HemisphereLight('#dfe8ff', '#2a2a30', 1);
    this.group.add(this.hemi);
    const metal = new MeshStandardMaterial({ color: '#141b24', metalness: 0.6, roughness: 0.5 });
    const housing = new MeshStandardMaterial({ color: '#1b232d', metalness: 0.4, roughness: 0.6 });
    const glow = glowTexture();
    this.fixtures = LIGHTS.map((L, i) => {
      const dir = i === 0 ? -1 : 1;           // hacia afuera de la cancha (en y)
      const outY = L.y + dir * 22;
      const f = new Group();
      // Poste, brazo y carcasa
      const pole = new Mesh(new BoxGeometry(5, L.z + 12, 5), metal);
      pole.position.set(L.x, (L.z + 12) / 2, outY);
      const arm = new Mesh(new BoxGeometry(4, 4, 24), metal);
      arm.position.set(L.x, L.z + 10, (L.y + outY) / 2);
      const head = new Mesh(new BoxGeometry(32, 8, 12), housing);
      head.position.set(L.x, L.z + 4, L.y);
      for (const m of [pole, arm, head]) { m.castShadow = false; f.add(m); }
      // Cara emisora
      const faceMat = new MeshStandardMaterial({ color: '#2a2f36', emissive: '#fff4d6', emissiveIntensity: 4 });
      const face = new Mesh(new BoxGeometry(26, 1, 8), faceMat);
      face.position.set(L.x, L.z - 0.2, L.y);
      f.add(face);
      // Resplandor y haz
      const sprite = new Sprite(new SpriteMaterial({ map: glow, color: '#fff2d0', blending: AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.scale.set(150, 150, 1);
      sprite.position.set(L.x, L.z - 2, L.y);
      f.add(sprite);
      const beamMat = new ShaderMaterial({
        vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: { uAlpha: { value: 0.035 } },
        transparent: true, depthWrite: false, blending: AdditiveBlending, side: BackSide
      });
      const beam = new Mesh(new ConeGeometry(220, L.z, 32, 1, true), beamMat);
      beam.position.set(L.x, L.z / 2, L.y - dir * 150);
      beam.rotation.x = dir * 0.45;
      f.add(beam);
      // La luz: foco con sombra, apuntando al centro de su lado de la cancha
      const spot = new SpotLight('#fff1d8', SPOT_INTENSITY, 0, 1.3, 0.8, 0);
      spot.position.set(L.x, L.z - 2, L.y);
      const target = new Object3D();
      target.position.set(L.x, 0, COURT.midY - dir * 70);
      spot.target = target;
      spot.castShadow = true;
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.camera.near = 60;
      spot.shadow.camera.far = 1100;
      spot.shadow.bias = -0.0004;
      spot.shadow.normalBias = 0.6;
      f.add(spot, target);
      // El foco del lado de la cámara no se dibuja (taparía la cancha, igual que en el 2D); su luz sí está
      if (i === 1) for (const m of [pole, arm, head, face, sprite, beam]) m.visible = false;
      this.group.add(f);
      return { spot, faceMat, sprite, beam, on: null };
    });
    this.envKey = '';
    this.env = null;
  }

  // Cielo + focos como mapa de entorno (reflejos del cristal y luz ambiente suave)
  buildEnv(renderer, scene) {
    const ST = styleOf();
    const key = state.map + '|' + state.lights.join(',');
    if (key === this.envKey) return;
    this.envKey = key;
    const s = new Scene();
    const skyMat = new ShaderMaterial({
      side: BackSide, depthWrite: false,
      uniforms: { top: { value: new Color(ST.sky[0]) }, bot: { value: new Color(ST.sky[1]) }, ground: { value: new Color('#121418') } },
      vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vW; uniform vec3 top, bot, ground; void main(){ float h = vW.y; vec3 c = h > 0.0 ? mix(bot, top, pow(h, 0.6)) : mix(bot, ground, min(1.0, -h * 4.0)); gl_FragColor = vec4(c, 1.0); }'
    });
    s.add(new Mesh(new SphereGeometry(500, 32, 16), skyMat));
    LIGHTS.forEach((L, i) => {
      if (!state.lights[i]) return;
      const m = new Mesh(new BoxGeometry(60, 14, 30), new MeshBasicMaterial({ color: new Color(18, 16, 13) }));
      m.position.set(0, 300, i === 0 ? -260 : 260);
      s.add(m);
    });
    const pm = new PMREMGenerator(renderer);
    const rt = pm.fromScene(s, 0.02);
    pm.dispose();
    if (this.env) this.env.dispose();
    this.env = rt;
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
  }

  update(renderer, scene) {
    const ST = styleOf();
    this.hemi.intensity = 0.4 + ST.amb * 2.2;
    this.fixtures.forEach((f, i) => {
      const on = !!state.lights[i];
      if (on === f.on && f.level === ST.light) return;
      f.on = on; f.level = ST.light;
      // Intensidad 0 en vez de quitar la luz: así no se recompilan los shaders al romperse
      f.spot.intensity = on ? SPOT_INTENSITY * ST.light : 0;
      f.faceMat.emissiveIntensity = on ? 4 : 0;
      f.sprite.visible = on && i === 0;
      f.beam.visible = on && i === 0;
    });
    this.buildEnv(renderer, scene);
  }
}
