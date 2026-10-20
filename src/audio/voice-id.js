// Voces grabadas: qué voz de Microsoft (edge-tts) usa cada personaje y cómo se llama el archivo de cada frase.
// Lo comparten el generador (scripts/gen-voices.mjs, en Node) y el juego (audio/voice.js), así ambos calculan
// el mismo nombre de archivo para la misma frase.

// voice: voz neural de Microsoft; pitch y rate: ajuste leve (en Hz y %) para que dos personajes con la misma voz
// no suenen idénticos. Cambiarlos mucho las hace sonar artificiales. Todos van un 15 % más rápido que la voz original.
export const VOICE_OF = {
  german: { voice: 'es-CL-LorenzoNeural', pitch: -8, rate: 9 },
  maxi: { voice: 'es-CL-LorenzoNeural', pitch: 6, rate: 27 },
  joaquin: { voice: 'es-CL-LorenzoNeural', pitch: 3, rate: 19 },
  alvaro: { voice: 'es-CL-LorenzoNeural', pitch: -4, rate: 15 },
  fernando: { voice: 'es-CL-LorenzoNeural', pitch: 0, rate: 17 },
  matias: { voice: 'es-CL-LorenzoNeural', pitch: 4, rate: 23 },
  marco: { voice: 'es-CU-ManuelNeural', pitch: 0, rate: 15 },
  gladys: { voice: 'es-CL-CatalinaNeural', pitch: -4, rate: 9 },
  nena: { voice: 'es-CL-CatalinaNeural', pitch: 4, rate: 19 },
  capitana: { voice: 'es-CL-CatalinaNeural', pitch: -2, rate: 17 },
  patricio: { voice: 'es-CL-LorenzoNeural', pitch: -10, rate: 7 },
  rodrigo: { voice: 'es-CL-LorenzoNeural', pitch: -2, rate: 21 },
  brayan: { voice: 'es-CL-LorenzoNeural', pitch: 8, rate: 25 },
  kevin: { voice: 'es-CL-LorenzoNeural', pitch: 10, rate: 27 },
  martinez: { voice: 'es-CL-LorenzoNeural', pitch: -6, rate: 12 },
  chispa: { voice: 'es-CL-LorenzoNeural', pitch: 12, rate: 30 },
  coloso: { voice: 'es-CL-LorenzoNeural', pitch: -20, rate: 3 },
  zeus: { voice: 'es-ES-AlvaroNeural', pitch: -12, rate: 7 }
};

// Nombre corto y estable para una frase (FNV-1a de 32 bits en hexadecimal)
export function phraseId(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
