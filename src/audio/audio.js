// ================= SONIDO (Web Audio API) =================
let audioCtx = null;
let musicPlaying = false;
let musicInterval = null;
let beatStep = 0;
let noiseBuffer = null;
let sfxBus = null;

// ---- Volumen: dos barras en la parte de abajo (música, y efectos con las voces). Se recuerdan en este navegador ----
function loadVol(k) {
  try { const v = parseFloat(localStorage.getItem('padel-vol-' + k)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1; } catch (e) { return 1; }
}
const vol = { music: loadVol('music'), sfx: loadVol('sfx') };
export const getVolume = k => vol[k];
export function setVolume(k, v) {
  vol[k] = Math.min(1, Math.max(0, v));
  try { localStorage.setItem('padel-vol-' + k, String(vol[k])); } catch (e) { /* sin almacenamiento */ }
  if (k === 'sfx' && sfxBus) sfxBus.gain.value = vol.sfx;
  if (k === 'music') {
    if (musicBus) musicBus.gain.value = MUSIC_GAIN * vol.music;
    const on = vol.music > 0;
    if (on !== musicPlaying) { musicPlaying = on; if (on) { ensureAudio(); startMusic(); } else stopMusic(); }
  }
}
// Salida de los efectos (pasa por la barra de volumen de efectos)
function sfxOut() {
  if (!sfxBus) { sfxBus = audioCtx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(audioCtx.destination); }
  return sfxBus;
}

export function ensureAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (musicPlaying && !musicTimer) startMusic();
}

function getNoise() {
  if (!noiseBuffer) {
    const len = Math.floor(audioCtx.sampleRate * 0.5);
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noiseHit(t, dur, freq, q, gain, type = 'bandpass') {
  const src = audioCtx.createBufferSource();
  src.buffer = getNoise();
  const f = audioCtx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxOut());
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
}

function toneHit(t, type, f0, f1, dur, gain) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(sfxOut());
  osc.start(t); osc.stop(t + dur + 0.01);
}

export function playSound(type) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  if (type === 'hit') {
    // "Pock" de pala de carbono: transitorio de ruido + cuerpo grave corto
    noiseHit(now, 0.045, 1900, 1.3, 0.55);
    toneHit(now, 'sine', 340, 120, 0.07, 0.32);
  } else if (type === 'smash') {
    noiseHit(now, 0.08, 1500, 0.9, 0.8);
    toneHit(now, 'triangle', 260, 65, 0.12, 0.45);
  } else if (type === 'lob') {
    noiseHit(now, 0.04, 2300, 1.5, 0.32);
    toneHit(now, 'sine', 290, 150, 0.06, 0.22);
  } else if (type === 'bounce') {
    toneHit(now, 'sine', 170, 55, 0.07, 0.26);
    noiseHit(now, 0.03, 700, 0.7, 0.14, 'lowpass');
  } else if (type === 'glass') {
    // Cristal templado: golpe sordo + brillo metálico de la estructura
    toneHit(now, 'sine', 150, 60, 0.09, 0.3);
    noiseHit(now, 0.11, 3400, 7, 0.32);
    toneHit(now, 'sine', 920, 640, 0.16, 0.05);
  } else if (type === 'sprint') {
    noiseHit(now, 0.18, 900, 0.6, 0.12);
    toneHit(now, 'sine', 240, 560, 0.18, 0.1);
  } else if (type === 'power') {
    toneHit(now, 'sawtooth', 220, 880, 0.25, 0.08);
    noiseHit(now, 0.3, 2400, 0.8, 0.12);
  } else if (type === 'bolt') {
    noiseHit(now, 0.5, 600, 0.5, 0.6, 'lowpass');
    toneHit(now, 'square', 90, 40, 0.4, 0.15);
  } else if (type === 'lightbreak') {
    noiseHit(now, 0.35, 5200, 3, 0.4);
    toneHit(now, 'triangle', 1400, 300, 0.25, 0.12);
  } else if (type === 'burn') {
    noiseHit(now, 0.35, 3000, 0.7, 0.18, 'highpass');
  } else if (type === 'flash') {
    noiseHit(now, 0.045, 1900, 1.3, 0.55);
    toneHit(now, 'sine', 340, 120, 0.07, 0.3);
    noiseHit(now + 0.02, 0.05, 6000, 2, 0.35, 'highpass');
  } else if (type === 'jump') {
    // Impulso del salto: roce de zapatilla
    noiseHit(now, 0.06, 1200, 0.8, 0.12);
    toneHit(now, 'sine', 180, 320, 0.08, 0.06);
  } else if (type === 'fault') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.setValueAtTime(135, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain); gain.connect(sfxOut());
    osc.start(now); osc.stop(now + 0.34);
  }
}

export function playJingle(win) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const notes = win ? [523.25, 659.25, 783.99, 1046.5] : [392, 329.63, 261.63, 196];
  notes.forEach((f, i) => toneHit(now + i * 0.13, 'triangle', f, f * 0.98, 0.22, 0.12));
}

// ---- Música: groove latino suave (La menor: Am - F - C - G), con secuenciador preciso ----
musicPlaying = vol.music > 0;   // con la barra de música en 0 no suena
const MUSIC_GAIN = 0.55;
let musicBus = null, musicTimer = null, musicNextTime = 0, musicStep = 0;
const MUSIC_BPM = 104;
const NOTE = n => 440 * Math.pow(2, n / 12);           // n = semitonos desde La4
const CHORDS = [[-12, -9, -5], [-16, -12, -9], [-9, -5, -2], [-14, -10, -7]];   // Am, F, C, G
const BASS = [-36, -40, -33, -38];
const MELODY = [
  [7, null, null, 3, null, 5, 7, null, null, 0, null, null, 3, null, 5, null],
  [3, null, null, 0, null, 3, 8, null, null, 7, null, null, 3, null, 0, null],
  [-2, null, null, 3, null, 7, 10, null, null, 7, null, null, 5, null, 3, null],
  [2, null, null, 5, null, 10, 5, null, null, 2, null, null, 0, null, -2, null]
];
const MELODY_B = [
  [12, null, 10, null, 7, null, null, null, 7, null, 5, null, 3, null, null, null],
  [8, null, 7, null, 3, null, null, null, 0, null, 3, null, 5, null, null, null],
  [7, null, 10, null, 12, null, null, null, 10, null, 7, null, 3, null, null, null],
  [5, null, 7, null, 10, null, 7, null, 5, null, null, null, 2, null, null, null]
];

function musicVoice(t, type, freq, dur, gain, attack = 0.005) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicBus);
  o.start(t); o.stop(t + dur + 0.02);
}
function musicNoise(t, dur, freq, gain, type) {
  const s = audioCtx.createBufferSource();
  s.buffer = getNoise();
  const f = audioCtx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(musicBus);
  s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}
function scheduleMusicStep(step, t) {
  const s16 = step % 16, bar = Math.floor(step / 16) % 8, chord = bar % 4;
  const beat = 60 / MUSIC_BPM / 4;
  // Batería
  if (s16 % 4 === 0) {                                       // bombo
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.22);
  }
  if (s16 === 4 || s16 === 12) musicNoise(t, 0.12, 1700, 0.16, 'bandpass');   // palmas
  if (s16 % 2 === 0) musicNoise(t, 0.03, 8000, s16 % 4 === 2 ? 0.07 : 0.03, 'highpass');   // hi-hat
  if ([3, 7, 11, 15].includes(s16)) musicNoise(t, 0.05, 5000, 0.035, 'highpass');           // shaker
  // Bajo con ritmo 3-3-2
  if ([0, 3, 6, 8, 11, 14].includes(s16)) {
    const n = BASS[chord] + (s16 === 6 || s16 === 14 ? 12 : 0);
    musicVoice(t, 'triangle', NOTE(n), beat * 2.2, 0.22);
  }
  // Acordes: colchón suave y golpecitos tipo marimba
  if (s16 === 0) CHORDS[chord].forEach(n => musicVoice(t, 'sine', NOTE(n), beat * 15, 0.035, 0.12));
  if ([2, 6, 10, 14].includes(s16)) CHORDS[chord].forEach(n => musicVoice(t, 'triangle', NOTE(n + 12), beat * 1.6, 0.03));
  // Melodía (A en los compases 1-4, B en los 5-8)
  const mel = (bar < 4 ? MELODY : MELODY_B)[chord][s16];
  if (mel != null) {
    musicVoice(t, 'sine', NOTE(mel), beat * 3, 0.075);
    musicVoice(t, 'sine', NOTE(mel + 12), beat * 1.2, 0.018);
  }
}
function musicScheduler() {
  if (!audioCtx || !musicPlaying) return;
  const beat = 60 / MUSIC_BPM / 4;
  while (musicNextTime < audioCtx.currentTime + 0.15) {
    scheduleMusicStep(musicStep, musicNextTime);
    musicNextTime += beat;
    musicStep++;
  }
}
function startMusic() {
  if (!audioCtx || musicTimer) return;
  if (!musicBus) {
    musicBus = audioCtx.createGain();
    musicBus.gain.value = MUSIC_GAIN * vol.music;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 7000;
    musicBus.connect(lp); lp.connect(audioCtx.destination);
  }
  musicNextTime = audioCtx.currentTime + 0.08;
  musicTimer = setInterval(musicScheduler, 25);
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

