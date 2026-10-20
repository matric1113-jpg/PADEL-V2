import { state } from '../core/state.js';

// ---------- Estilo de cada mapa en 3D ----------
// turf/apron/outer/wear/border salen del render 2D. amb = luz ambiente (0 a 1); sky = degradado
// del cielo (arriba, horizonte); light = intensidad de los focos (de noche pesan más).
export const MAP_STYLE = {
  chile:  { turf: [31, 88, 170], apron: [24, 64, 124], outer: 'floor', amb: 0.42, wear: 0.26, sky: ['#16284a', '#e8935a'], light: 1 },
  brasil: { turf: [36, 98, 172], apron: [196, 174, 128], outer: 'sand', amb: 0.62, wear: 0.42, sky: ['#3a8fd0', '#ffd59a'], light: 0.8, sun: true },
  china:  { turf: [30, 42, 66], apron: [56, 58, 66], outer: 'roof', amb: 0.4, wear: 0.18, border: [176, 28, 40], sky: ['#0b1030', '#3b1530'], light: 1.1 },
  altura: { turf: [30, 80, 146], apron: [62, 68, 74], outer: 'rock', amb: 0.5, wear: 0.2, sky: ['#55657a', '#aab8c6'], light: 0.9 },
  atlas:  { turf: [48, 104, 190], apron: [214, 206, 188], outer: 'sky', amb: 0.72, wear: 0.15, sky: ['#25407f', '#f3d79a'], light: 0.8, sun: true },
  crater: { turf: [34, 60, 112], apron: [42, 34, 32], outer: 'lava', amb: 0.4, wear: 0.22, sky: ['#120606', '#6a1a0a'], light: 1 }
};
export const styleOf = () => MAP_STYLE[state.map] || MAP_STYLE.chile;
