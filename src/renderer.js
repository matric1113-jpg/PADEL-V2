import { resizeCanvas } from './render2d/layers.js';
import { render as render2d, updateAimFromMouse as aim2d } from './render2d/world.js';

// Render activo. Mientras dure la migración, ?render=2d muestra la versión Canvas 2D para comparar.
export const RENDER_MODE = new URLSearchParams(location.search).get('render') === '2d' ? '2d' : '3d';

const R2D = { init: resizeCanvas, render: render2d, updateAimFromMouse: aim2d };
export const renderer = R2D;
