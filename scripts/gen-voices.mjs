// Genera los audios de las frases de cada personaje con edge-tts (voces neurales de Microsoft, gratis).
//   npm run voices          genera los que faltan (los que ya existen no se vuelven a pedir)
//   npm run voices -- all   los vuelve a generar todos (por ejemplo, tras cambiar la voz o el tono de alguien)
// Requisitos: Python y `py -m pip install edge-tts`. Necesita internet (las voces vienen del servicio de Microsoft).
// Deja los .mp3 en assets/voices/<personaje>/<id>.mp3; el juego los busca con el mismo id (src/audio/voice-id.js)
// y, si falta alguno, usa la voz del navegador.
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { HELLO, LOOKS, TALK } from '../src/core/data.js';
import { VOICE_OF, phraseId } from '../src/audio/voice-id.js';

const OUT = path.resolve('assets/voices');
const ALL = process.argv[2] === 'all';
const PARALLEL = 6;

// Cómo llamar a edge-tts: el comando directo o a través de Python
const CANDIDATES = [['edge-tts'], ['py', '-m', 'edge_tts'], ['python', '-m', 'edge_tts'], ['python3', '-m', 'edge_tts']];
const cmd = CANDIDATES.find(c => spawnSync(c[0], [...c.slice(1), '--help'], { stdio: 'ignore' }).status === 0);
if (!cmd) {
  console.error('No encontré edge-tts. Instálalo con:  py -m pip install edge-tts   (y cierra y abre PowerShell)');
  process.exit(1);
}

// Frases de cada personaje: su presentación del menú, las suyas y las que puede decir cualquiera
const generic = [...TALK.brag, ...TALK.taunt, ...Object.values(TALK.power).flat()];
const jobs = [];
for (const look of Object.keys(LOOKS)) {
  const v = VOICE_OF[look];
  if (!v) { console.warn('Sin voz definida para', look, '(se queda con la del navegador)'); continue; }
  const lines = new Set([...(TALK.byLook[look] || []), ...generic]);
  if (HELLO[look]) lines.add(HELLO[look].say || HELLO[look].text);
  for (const text of lines) jobs.push({ look, text, v, file: path.join(OUT, look, phraseId(text) + '.mp3') });
}
const todo = jobs.filter(j => ALL || !fs.existsSync(j.file));
console.log(`${jobs.length} frases en total, ${todo.length} por generar (con ${cmd.join(' ')})`);

const sign = n => (n >= 0 ? '+' : '') + n;
function run(j) {
  fs.mkdirSync(path.dirname(j.file), { recursive: true });
  const args = [...cmd.slice(1), '--voice', j.v.voice, `--rate=${sign(j.v.rate)}%`, `--pitch=${sign(j.v.pitch)}Hz`, '--text', j.text, '--write-media', j.file];
  return new Promise(res => {
    const p = spawn(cmd[0], args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('close', code => res(code === 0 && fs.existsSync(j.file) && fs.statSync(j.file).size > 0 ? null : `${j.look}: "${j.text}" -> ${err.trim().split('\n').pop()}`));
  });
}

let done = 0;
const errors = [];
const queue = todo.slice();
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (queue.length) {
    const j = queue.shift();
    const e = await run(j);
    if (e) errors.push(e);
    if (++done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
  }
}));

// Borra audios de frases que ya no existen (por ejemplo, si se cambió el texto)
const keep = new Set(jobs.map(j => j.file));
let removed = 0;
if (fs.existsSync(OUT)) for (const dir of fs.readdirSync(OUT)) {
  const d = path.join(OUT, dir);
  if (!fs.statSync(d).isDirectory()) continue;
  for (const f of fs.readdirSync(d)) if (!keep.has(path.join(d, f))) { fs.unlinkSync(path.join(d, f)); removed++; }
}

const size = jobs.filter(j => fs.existsSync(j.file)).reduce((a, j) => a + fs.statSync(j.file).size, 0);
console.log(`Listo: ${jobs.length - errors.length} de ${jobs.length} frases con audio (${(size / 1e6).toFixed(1)} MB)${removed ? `, ${removed} audios viejos borrados` : ''}.`);
if (errors.length) {
  console.log(`${errors.length} fallaron (vuelve a correr "npm run voices" para reintentar solo esas):`);
  errors.slice(0, 10).forEach(e => console.log('  ' + e));
  process.exitCode = 1;
}
