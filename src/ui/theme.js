// ---------- Estilo de la interfaz ----------
// "clasico" es el de siempre (sin atributo); los demás se definen en themes.css con <html data-theme="...">.
// Se elige en el menú o con ?ui=club, y se recuerda en el navegador.
export const THEMES = [['clasico', 'Clásico'], ['estadio', 'Estadio'], ['club', 'Club'], ['grafito', 'Grafito'], ['neon', 'Neón']];
const KEY = 'padel-ui';
let current = 'clasico';

export const currentTheme = () => current;

export function setTheme(id, save = true) {
  if (!THEMES.some(t => t[0] === id)) id = 'clasico';
  current = id;
  if (id === 'clasico') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
  if (save) { try { localStorage.setItem(KEY, id); } catch (e) { /* sin almacenamiento */ } }
}

export function initTheme() {
  let id = 'clasico';
  try { id = localStorage.getItem(KEY) || id; } catch (e) { /* sin almacenamiento */ }
  const q = new URLSearchParams(location.search).get('ui');
  setTheme(q || id, !!q);
}
