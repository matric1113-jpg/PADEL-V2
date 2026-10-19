import { state } from './state.js';

export const replayBuf = [];
export function recordFrame() {
  if (state.screen !== 'play' || state.phase !== 'PLAY') return;
  replayBuf.push({
    ball: { ...state.ball, trail: state.ball.trail.map(t => ({ ...t })) },
    players: JSON.parse(JSON.stringify(state.players)),
    ice: state.ice ? { ...state.ice } : null
  });
  if (replayBuf.length > 100) replayBuf.shift();
}
