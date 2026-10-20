// ---------- Ruido procedural para texturas (mismo que usaba el suelo del render 2D) ----------
export function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let tx = x - xi, ty = y - yi;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

// Generador con semilla (para que el público y el paisaje salgan siempre iguales)
export function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Grilla precalculada para muestrear rápido una función suave
export function makeGrid(x0, y0, x1, y1, step, fn) {
  const w = Math.ceil((x1 - x0) / step) + 1, h = Math.ceil((y1 - y0) / step) + 1;
  const data = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[j * w + i] = fn(x0 + i * step, y0 + j * step);
  return { x0, y0, step, w, h, data };
}
export function sampleGrid(g, x, y) {
  let fx = (x - g.x0) / g.step, fy = (y - g.y0) / g.step;
  if (fx < 0) fx = 0; else if (fx > g.w - 1.001) fx = g.w - 1.001;
  if (fy < 0) fy = 0; else if (fy > g.h - 1.001) fy = g.h - 1.001;
  const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * g.w + ix, d = g.data;
  return (d[i] * (1 - tx) + d[i + 1] * tx) * (1 - ty) + (d[i + g.w] * (1 - tx) + d[i + g.w + 1] * tx) * ty;
}
