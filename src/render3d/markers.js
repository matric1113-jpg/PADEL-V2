import { Color, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

// ---------- Marcas dibujadas sobre el suelo o una pared ----------
// Aros, rellenos, guiones, la cruz del blanco de tiro, brillos y rectángulos. Cada marca es un
// cuadrado con un shader; se piden en cada cuadro con ring()/rect() entre begin() y end().

const VERT = /* glsl */`
  varying vec2 vP;
  uniform float uSize;
  void main() {
    vP = position.xy * uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */`
  varying vec2 vP;
  uniform vec3 uColor, uColor2;
  uniform float uLine, uFill, uR, uW, uDash, uTicks, uCross, uGlow, uMode;
  uniform vec2 uHalf;
  float band(float x, float w) { float aa = fwidth(x) + 1e-4; return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(x)); }
  void main() {
    float a = 0.0;
    vec3 col = uColor;
    if (uMode > 0.5) {
      // Rectángulo: relleno y borde interior (cuadro de saque, hielo)
      vec2 q = abs(vP) - uHalf;
      float outside = max(q.x, q.y);
      float aa = fwidth(outside) + 1e-4;
      a = uFill * (1.0 - smoothstep(-aa, aa, outside));
      a = max(a, uLine * band(outside + 3.0, uW));
    } else {
      float d = length(vP);
      float aa = fwidth(d) + 1e-4;
      if (uGlow > 0.5) {
        float k = clamp(d / uR, 0.0, 1.0);
        col = mix(uColor, uColor2, smoothstep(0.0, 1.0, k));
        a = uFill * (1.0 - k) * (1.0 - smoothstep(uR - aa, uR + aa, d));
      } else {
        a = uFill * (1.0 - smoothstep(uR - aa, uR + aa, d));
      }
      float ring = band(d - uR, uW);
      if (uDash > 0.5) ring *= step(fract(atan(vP.y, vP.x) / 6.2831853 * uDash), 0.5);
      a = max(a, uLine * ring);
      if (uTicks > 0.5) {
        float t = mod(atan(vP.y, vP.x), 1.5707963) - 0.7853982;
        float tick = band(d * sin(t), uW) * step(uR + 2.0, d) * step(d, uR + 8.0);
        a = max(a, uLine * tick);
      }
      if (uCross > 0.0) {
        float cr = max(band(vP.y, 1.4) * step(abs(vP.x), uCross), band(vP.x, 1.4) * step(abs(vP.y), uCross));
        a = max(a, uLine * cr);
      }
    }
    if (a < 0.003) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

const geo = new PlaneGeometry(1, 1);

function newMarker() {
  const mat = new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new Color() }, uColor2: { value: new Color() },
      uLine: { value: 1 }, uFill: { value: 0 }, uR: { value: 10 }, uW: { value: 1.5 },
      uDash: { value: 0 }, uTicks: { value: 0 }, uCross: { value: 0 }, uGlow: { value: 0 },
      uMode: { value: 0 }, uHalf: { value: [1, 1] }, uSize: { value: 1 }
    },
    transparent: true, depthWrite: false, side: DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const m = new Mesh(geo, mat);
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}

// "r, g, b" (como en el 2D) o cualquier color CSS
function setColor(c, v) {
  if (typeof v === 'string' && /^\s*\d/.test(v)) {
    const [r, g, b] = v.split(',').map(Number);
    return c.setRGB(r / 255, g / 255, b / 255, 'srgb');
  }
  return c.set(v);
}

export class Markers {
  constructor() {
    this.group = new Group();
    this.list = [];
    this.n = 0;
  }
  begin() { this.n = 0; }
  end() { for (let i = this.n; i < this.list.length; i++) this.list[i].visible = false; }

  next() {
    if (this.n === this.list.length) { const m = newMarker(); this.list.push(m); this.group.add(m); }
    const m = this.list[this.n++];
    m.visible = true;
    return m;
  }

  // Ubica el cuadrado: en el suelo (x, y) o sobre una pared ('F', 'N', 'L', 'R') en (a, z)
  place(m, o, size) {
    const h = o.h ?? 0.3;
    m.rotation.set(0, 0, 0);
    if (!o.wall) {
      m.rotation.x = -Math.PI / 2;
      m.scale.set(size, -size, 1);   // el eje local y apunta a +y del mundo
      m.position.set(o.x, h, o.y);
    } else if (o.wall === 'F' || o.wall === 'N') {
      m.scale.set(size, size, 1);
      m.position.set(o.a, o.z, o.wallPos);
    } else {
      m.rotation.y = Math.PI / 2;
      m.scale.set(size, size, 1);
      m.position.set(o.wallPos, o.z, o.a);
    }
  }

  // o: { x, y, r, w, color, line, fill, dash, ticks, cross, glow, color2, h, wall, a, z, wallPos }
  ring(o) {
    const m = this.next();
    const u = m.material.uniforms;
    const extent = Math.max(o.r + (o.w || 1.5) + (o.ticks ? 10 : 0), o.cross || 0) + 2;
    this.place(m, o, extent * 2);
    u.uSize.value = extent * 2;
    setColor(u.uColor.value, o.color || '255, 255, 255');
    if (o.color2) setColor(u.uColor2.value, o.color2);
    u.uLine.value = o.line ?? 1;
    u.uFill.value = o.fill ?? 0;
    u.uR.value = o.r;
    u.uW.value = o.w ?? 1.5;
    u.uDash.value = o.dash || 0;
    u.uTicks.value = o.ticks ? 1 : 0;
    u.uCross.value = o.cross || 0;
    u.uGlow.value = o.glow ? 1 : 0;
    u.uMode.value = 0;
  }

  // Rectángulo en el suelo entre (x0, y0) y (x1, y1)
  rect(o) {
    const m = this.next();
    const u = m.material.uniforms;
    const hw = (o.x1 - o.x0) / 2, hh = (o.y1 - o.y0) / 2;
    const extent = Math.max(hw, hh) + 1;
    this.place(m, { x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2, h: o.h }, extent * 2);
    u.uSize.value = extent * 2;
    setColor(u.uColor.value, o.color);
    u.uLine.value = o.line ?? 0;
    u.uFill.value = o.fill ?? 0;
    u.uW.value = o.w ?? 1.6;
    u.uHalf.value = [hw, hh];
    u.uMode.value = 1;
  }
}
