// ================= VOCES (Web Speech API) =================
// Dicen la frase de cada personaje en el menú y las frases del partido (state.talk).
// Las voces dependen del navegador y del sistema: las "Online (Natural)" de Microsoft Edge (por ejemplo Lorenzo y
// Catalina de Chile, Manuel de Cuba) son las más humanas, las "Google" de Chrome vienen después, y las locales
// de Windows (Raúl, Sabina) son las más robóticas. Se elige la mejor que haya. A las voces naturales casi no se les
// cambia el tono: subirlo o bajarlo mucho es lo que las hace sonar a robot.
import { getVolume } from './audio.js';
import { HELLO } from '../core/data.js';

const FEMALE_LOOKS = new Set(['gladys', 'nena', 'capitana']);
// Acento preferido por personaje (el resto, chileno)
const LANG_PREF = { marco: ['es-CU', 'es-DO', 'es-PR', 'es-VE', 'es-ES'], zeus: ['es-ES'] };
// Variación leve de tono y velocidad para que dos personajes con la misma voz no suenen idénticos
const TUNE = {
  german: { pitch: 0.9, rate: 0.95 }, maxi: { pitch: 1.08, rate: 1.12 }, joaquin: { pitch: 1.03, rate: 1.04 },
  alvaro: { pitch: 0.94, rate: 1 }, fernando: { pitch: 0.98, rate: 1.02 }, matias: { pitch: 1.05, rate: 1.08 },
  marco: { pitch: 0.97, rate: 0.98 }, zeus: { pitch: 0.85, rate: 0.92 }
};
const MALE_NAMES = /lorenzo|raul|raúl|jorge|alvaro|álvaro|tomas|tomás|gonzalo|alex|sebasti|manuel|alonso|pablo|emilio|federico|mateo|carlos|diego|enrique|juan|mario|gerardo|marcelo|andr[eé]s|rodrigo|sa[uú]l|arnau|dar[ií]o|nil|luciano|liberto|mauricio|victor|víctor|yago|cristian|jos[eé]|pedro|teo|eduardo|antonio|lucas/i;

let voices = [];
function loadVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang)) : []; cache.clear(); }
const cache = new Map();
if (window.speechSynthesis) { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); }

const quality = v => (/natural|neural/i.test(v.name) ? 300 : /online/i.test(v.name) ? 250 : /google/i.test(v.name) ? 150 : 0);
const isMale = v => MALE_NAMES.test(v.name);

// La voz más humana disponible para un personaje: calidad, luego género y luego acento
function voiceFor(lookId) {
  if (cache.has(lookId)) return cache.get(lookId);
  const female = FEMALE_LOOKS.has(lookId);
  const langs = [...(LANG_PREF[lookId] || []), 'es-CL', 'es-419', 'es-AR', 'es-MX', 'es-US', 'es-CO', 'es-ES'];
  let best = null, bestScore = -1;
  for (const v of voices) {
    const li = langs.findIndex(l => v.lang.replace('_', '-').toLowerCase() === l.toLowerCase());
    const genderOk = female ? !isMale(v) : isMale(v);
    const score = quality(v) + (genderOk ? 100 : 0) + (li >= 0 ? 60 - li * 5 : 0);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  cache.set(lookId, best);
  return best;
}

export function speak(text, lookId, interrupt = true) {
  if (!text || !window.speechSynthesis) return;
  const vol = getVolume('sfx');
  if (vol <= 0) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = voiceFor(lookId);
  u.lang = v ? v.lang : 'es-CL';
  if (v) u.voice = v;
  const t = TUNE[lookId] || {};
  const natural = v && quality(v) >= 150;
  // Las voces naturales aguantan poco cambio de tono antes de sonar artificiales
  u.pitch = natural ? 1 + ((t.pitch || 1) - 1) * 0.6 : (t.pitch || 1);
  u.rate = t.rate || 1;
  u.volume = vol;
  speechSynthesis.speak(u);
}

// Menú: la presentación de cada personaje
export function sayHello(id) {
  const h = HELLO[id];
  if (h) speak(h.say || h.text, id);
}

// Partido: dice en voz alta la frase nueva de state.talk (anfitrión e invitados, porque viene en el estado)
let lastTalk = -1;
export function watchTalk(state, active) {
  const seq = state.talk.seq;
  if (lastTalk < 0 || !active) { lastTalk = seq; return; }
  if (seq === lastTalk) return;
  lastTalk = seq;
  const p = state.players[state.talk.slot];
  if (p) speak(state.talk.text, p.lookId);
}
