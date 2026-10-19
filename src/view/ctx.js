import { canvas } from '../dom.js';

export let ctx = canvas.getContext('2d');

// renderPortrait dibuja un instante en otro canvas y devuelve el contexto original
export function setCtx(c) { ctx = c; }
