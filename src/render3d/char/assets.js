import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---------- Carga de los modelos (Quaternius, CC0) ----------
// Ver NOTAS.md, "Etapa 3": qué trae cada archivo y cómo se generó.
const URLS = {
  hombre: new URL('../../../assets/models/cuerpo_hombre.glb', import.meta.url).href,
  mujer: new URL('../../../assets/models/cuerpo_mujer.glb', import.meta.url).href,
  pelo: new URL('../../../assets/models/pelo.glb', import.meta.url).href,
  anims: new URL('../../../assets/models/animaciones.glb', import.meta.url).href
};

export const assets = { ready: false, body: {}, hair: null, clips: {}, error: null };
let promise = null;

const load = (loader, url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

// Se llama una vez al arrancar; el render espera esta promesa antes de dibujar jugadores animados.
export function loadCharacterAssets() {
  if (promise) return promise;
  const loader = new GLTFLoader();
  promise = Promise.all([load(loader, URLS.hombre), load(loader, URLS.mujer), load(loader, URLS.pelo), load(loader, URLS.anims)])
    .then(([hombre, mujer, pelo, anims]) => {
      assets.body.hombre = hombre.scene;
      assets.body.mujer = mujer.scene;
      assets.hair = pelo.scene;
      for (const clip of anims.animations) assets.clips[clip.name] = clip;
      assets.ready = true;
      return assets;
    })
    .catch(err => { assets.error = err; console.error('No se pudieron cargar los modelos de personajes', err); throw err; });
  return promise;
}
