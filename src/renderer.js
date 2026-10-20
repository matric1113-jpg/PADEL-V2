import { resizeCanvas } from './render2d/layers.js';
import { renderPortrait as portrait2d } from './render2d/players.js';
import { render as render2d, updateAimFromMouse as aim2d } from './render2d/world.js';
import * as render3d from './render3d/index.js';

// Render activo: Three.js por defecto. Mientras dure la migración, ?render=2d muestra la
// versión Canvas 2D para comparar.
export const RENDER_MODE = new URLSearchParams(location.search).get('render') === '2d' ? '2d' : '3d';

const R2D = { init: resizeCanvas, render: render2d, updateAimFromMouse: aim2d, renderPortrait: portrait2d };
export const renderer = RENDER_MODE === '2d' ? R2D : render3d;
