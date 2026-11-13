import { DIFFICULTIES, PLAYABLE, validLab } from '../core/data.js';

// ---------- Progreso guardado en el navegador (localStorage) ----------
// Se guardan: lo último que elegiste en el menú (jugador, modo y nivel), los récords (torneo, amistosos y americanos) y el
// torneo en curso para poder continuarlo desde el jefe en que quedaste. Si el navegador no deja guardar (ventana privada,
// datos bloqueados), todo sigue funcionando en memoria y simplemente no queda nada para la próxima vez.
const KEY = 'padel-progress-v1';
const MODES = ['run', 'friendly', 'americano', 'lab'];

const blank = () => ({
  prefs: { char: null, mode: null, diff: null, lab: null },   // lab: configuración del laboratorio (JSON)
  stats: { runsWon: 0, runsLost: 0, bestBoss: 0, bossWins: {}, friendlyPlayed: 0, friendlyWon: 0, americanoPlayed: 0, americanoGold: 0 },
  run: null   // torneo en curso: { boss, char, money, up, active }
});

function load() {
  const d = blank();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      Object.assign(d.prefs, raw.prefs);
      Object.assign(d.stats, raw.stats);
      if (raw.run && Number.isInteger(raw.run.boss) && raw.run.boss > 0) d.run = raw.run;
    }
  } catch (e) { /* sin almacenamiento o datos dañados: se parte de cero */ }
  return d;
}

export const progress = load();
export const progressRev = { n: 0 };   // sube con cada cambio, para que el menú se redibuje

function commit() {
  progressRev.n++;
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* sin almacenamiento */ }
}

// Lo último que elegiste en el menú, validado (por si un personaje o nivel ya no existe)
export function applyPrefs(sel) {
  const p = progress.prefs;
  if (PLAYABLE.includes(p.char)) sel.char = p.char;
  if (MODES.includes(p.mode)) sel.mode = p.mode;
  if (Number.isInteger(p.diff) && p.diff >= 0 && p.diff < DIFFICULTIES.length) sel.diff = p.diff;
  if (p.lab) { try { sel.lab = validLab(JSON.parse(p.lab)); } catch (e) { /* se queda con la de fábrica */ } }
}
export function savePrefs(sel) {
  const p = progress.prefs;
  const lab = JSON.stringify(sel.lab || null);
  if (p.char === sel.char && p.mode === sel.mode && p.diff === sel.diff && p.lab === lab) return;
  p.char = sel.char; p.mode = sel.mode; p.diff = sel.diff; p.lab = lab;
  commit();
}

// Récords
export function recordBossBeaten(boss) {
  const s = progress.stats;
  s.bossWins[boss] = (s.bossWins[boss] || 0) + 1;
  s.bestBoss = Math.max(s.bestBoss, boss + 1);
  commit();
}
export function recordRunWon() { progress.stats.runsWon++; progress.run = null; commit(); }
export function recordRunLost() { progress.stats.runsLost++; progress.run = null; commit(); }
export function recordFriendly(won) {
  const s = progress.stats;
  s.friendlyPlayed++;
  if (won) s.friendlyWon++;
  commit();
}
export function recordAmericano(place) {
  const s = progress.stats;
  s.americanoPlayed++;
  if (place === 1) s.americanoGold++;
  commit();
}

// Torneo en curso (solo se guarda jugando con un bot de compañero)
export const savedRun = () => progress.run;
export function saveRun(run) {
  if (JSON.stringify(run) === JSON.stringify(progress.run)) return;
  progress.run = run;
  commit();
}
export function clearRun() { if (progress.run) { progress.run = null; commit(); } }

export function resetProgress() {
  Object.assign(progress, blank());
  commit();
}
