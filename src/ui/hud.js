import { POINTS_LABELS } from '../core/constants.js';
import { BOSSES } from '../core/data.js';
import { mapOf, state } from '../core/state.js';

const hudState = { servingTeam: -1 };

function setText(id, v) {
  const el = document.getElementById(id);
  if (el && el.textContent !== String(v)) el.textContent = v;
}

function hazardLabel() {
  if (state.screen !== 'play') return '';
  if (state.gust.t > 0) return 'Ráfaga de viento';
  if (state.tilt.t > 0) return 'La cancha se inclina';
  if (state.ice) return 'Cancha de hielo';
  return '';
}

export function updateScoreUI() {
  const tb = state.tiebreak;
  const lab = n => (tb ? String(n) : (POINTS_LABELS[n] || '0'));
  const run = state.mode === 'run';
  setText('score-blue', lab(state.score[0]));
  setText('score-red', lab(state.score[1]));
  setText('games-blue', state.games[0]);
  setText('games-red', state.games[1]);
  setText('name-blue', run ? 'Ustedes' : 'Azul');
  setText('name-red', run ? BOSSES[state.run.boss].team : 'Rojo');
  // Sets ganados (modo amistoso): un punto dorado por set junto al nombre
  const pips = t => (run ? '' : '●'.repeat(state.sets[t]));
  for (const [id, t] of [['name-blue', 0], ['name-red', 1]]) document.getElementById(id).dataset.sets = pips(t);
  const inGame = state.screen !== 'menu';
  setText('sb-sub', !inGame ? '' : run ? `Jefe ${state.run.boss + 1} de ${BOSSES.length}, ${mapOf().name}` : `Set ${state.sets[0] + state.sets[1] + 1}, ${mapOf().name}`);
  setText('sb-cond', hazardLabel());
  const golden = !tb && state.score[0] === 3 && state.score[1] === 3;
  setText('sb-tag', tb ? 'Tie-break' : 'Punto de oro');
  document.getElementById('sb-tag').classList.toggle('show', tb || golden);
  const sb = document.getElementById('scorebug');
  // En el torneo se ven los juegos solo cuando es al mejor de 3
  sb.classList.toggle('run', run && BOSSES[state.run.boss].gamesToWin === 1);
  const longest = Math.max(document.getElementById('name-blue').textContent.length + pips(0).length, document.getElementById('name-red').textContent.length + pips(1).length);
  const nw = Math.max(92, Math.round(longest * 8.6 + 16)) + 'px';
  if (sb.style.getPropertyValue('--namew') !== nw) sb.style.setProperty('--namew', nw);
}
export function syncHud() {
  const servingTeam = state.players[state.serverSlot] ? state.players[state.serverSlot].team : 0;
  if (servingTeam !== hudState.servingTeam) {
    hudState.servingTeam = servingTeam;
    document.getElementById('sb-blue').classList.toggle('serving', servingTeam === 0);
    document.getElementById('sb-red').classList.toggle('serving', servingTeam === 1);
  }
}

