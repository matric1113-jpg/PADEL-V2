export const CHARACTERS = ['german', 'maxi', 'joaquin', 'alvaro', 'fernando', 'matias', 'marco'];
// Los 7 personajes elegibles están balanceados: velocidad (y con ella la fuerza, que es 1 - velocidad) entre 0,44 y
// 0,56. Lo demás es estético: estatura (body.h, poca diferencia), contextura, zurdo o diestro (lefty), paleta, pelo,
// gorros y lentes. body solo cambia cómo se ve; el alcance de la pala no depende de él.
export const LOOKS = {
  german: {
    name: 'Germán', role: 'Diestro', speed: 0.44,
    desc: 'Guatita de campeón, bigote de los 80, cintillo rojo y pala redonda.',
    skin: '#e3b38f', hair: 'bald', hairColor: '#4a3426',
    body: { w: 1.28, h: 0.96, belly: 1.5, arm: 1.15, leg: 1.15 },
    shirt: '#f2f2ec', shirtHi: '#ffffff', shirtLo: '#a3a39a', shorts: '#1f2c4a', shoes: '#2a2a2a', band: '#e53935',
    extras: { mustache: '#4a3426', headband: '#e53935' },
    paddle: { face: '#c62828', rim: '#1b1b1b', shape: 'round' }
  },
  maxi: {
    name: 'Maxi', role: 'Zurdo', speed: 0.56, lefty: true,
    desc: 'Mullet rubio, lentes de sol, calcetas altas y pala de lágrima. Zurdo y sin frenos.',
    skin: '#f2cba8', hair: 'mullet', hairColor: '#f3d36b',
    body: { w: 0.9, h: 1.04, belly: 0.9, arm: 0.9, leg: 0.92 },
    shirt: '#39e07a', shirtHi: '#9dffc0', shirtLo: '#1b8a46', shorts: '#101820', shoes: '#ffffff', band: '#ff4fa3', socksHigh: true,
    extras: { glasses: '#0d0d0d' },
    paddle: { face: '#00d5ff', rim: '#ffffff', shape: 'tear' }
  },
  joaquin: {
    name: 'Joaquín', role: 'Diestro', speed: 0.52,
    desc: 'Manos rápidas, cintillo de la suerte y pala diamante. Lee el juego antes que tú.',
    skin: '#ebc39a', hair: 'side', hairColor: '#121212',
    body: { w: 0.94, h: 0.98, belly: 0.94, arm: 0.95, leg: 0.95 },
    shirt: '#7b4dff', shirtHi: '#b9a3ff', shirtLo: '#432a9c', shorts: '#20123f', shoes: '#ff8f00', band: '#ffeb3b',
    extras: { headband: '#ffeb3b' },
    paddle: { face: '#ff6d00', rim: '#1b1b1b', shape: 'diamond' }
  },
  alvaro: {
    name: 'Álvaro', role: 'Zurdo', speed: 0.47, lefty: true,
    desc: 'Brazos de gimnasio, afro imponente con cintillo blanco y musculosa amarilla.',
    skin: '#6a4330', hair: 'afro', hairColor: '#17100c',
    body: { w: 1.14, h: 1.05, belly: 0.95, arm: 1.4, leg: 1.1 },
    shirt: '#ffb300', shirtHi: '#ffe082', shirtLo: '#a87400', tank: true, shorts: '#1a1a1a', shoes: '#e53935', band: '#ffffff',
    extras: { headband: '#ffffff' },
    paddle: { face: '#212121', rim: '#ffb300', shape: 'round' }
  },
  fernando: {
    name: 'Fernando', role: 'Diestro', speed: 0.5,
    desc: 'Pelirrojo, barba tupida, jockey blanco al revés y pala de lágrima.',
    skin: '#f4d0b5', hair: 'cap', hairColor: '#c2481a',
    body: { w: 1.02, h: 1.0, belly: 1.06, arm: 1.0, leg: 1.0 },
    shirt: '#1e88e5', shirtHi: '#90caf9', shirtLo: '#0d47a1', shorts: '#e9e9e9', shoes: '#1b1b1b', band: '#1e88e5',
    extras: { beard: '#b8441a', cap: '#ffffff', capBack: true },
    paddle: { face: '#43a047', rim: '#ffffff', shape: 'tear' }
  },

  matias: {
    name: 'Matías', role: 'Diestro', speed: 0.53,
    desc: 'Pelo crespo, visera blanca, polera naranja y paciencia infinita.',
    skin: '#e8bd98', hair: 'curly', hairColor: '#3b2416',
    body: { w: 0.98, h: 0.97, belly: 1.0, arm: 1.05, leg: 1.02 },
    shirt: '#ff7a1a', shirtHi: '#ffb27a', shirtLo: '#b04a00', shorts: '#0f2238', shoes: '#ffffff', band: '#ff7a1a', socksHigh: true,
    extras: { visor: '#ffffff' },
    paddle: { face: '#ffe600', rim: '#0f2238', shape: 'tear' }
  },

  marco: {
    name: 'Marco', role: 'Zurdo', speed: 0.48, lefty: true,
    desc: 'Cubano, español y chileno a la vez. Pelado, zurdo y con lentes de sol.',
    skin: '#4a2c1d', hair: 'bald', hairColor: '#140d09',
    body: { w: 1.06, h: 1.03, belly: 1.0, arm: 1.12, leg: 1.06 },
    shirt: '#00a884', shirtHi: '#7ee8c9', shirtLo: '#00664f', shorts: '#0d1b2a', shoes: '#ffd600', band: '#ffd600',
    extras: { glasses: '#141414' },
    paddle: { face: '#0050b5', rim: '#ffd600', shape: 'diamond' }
  },

  // ---- Jefes del torneo ----
  gladys: {
    name: 'Tía Gladys', role: 'Jefa', speed: 0.35, desc: '',
    skin: '#e8b996', hair: 'curly', hairColor: '#d8d2c8',
    body: { w: 1.24, h: 0.9, belly: 1.4, arm: 1.05, leg: 1.05 },
    shirt: '#ff4fa3', shirtHi: '#ff9fcc', shirtLo: '#b0215f', shorts: '#3b2a4a', shoes: '#ffffff', band: '#ff4fa3',
    extras: { glasses: '#7a4e2d' },
    paddle: { face: '#ff4fa3', rim: '#ffffff', shape: 'round' }
  },
  nena: {
    name: 'Tía Nena', role: 'Jefa', speed: 0.6, desc: '',
    skin: '#f0c7a3', hair: 'bun', hairColor: '#8d5a3b',
    body: { w: 0.86, h: 0.94, belly: 0.9, arm: 0.85, leg: 0.88 },
    shirt: '#26c6da', shirtHi: '#9beaf3', shirtLo: '#0e7d8a', shorts: '#ffffff', shoes: '#26c6da', band: '#ffffff',
    extras: { visor: '#ffffff' },
    paddle: { face: '#ffffff', rim: '#26c6da', shape: 'tear' }
  },
  patricio: {
    name: 'Don Patricio', role: 'Jefe', speed: 0.25, desc: '',
    skin: '#e2b48f', hair: 'bald', hairColor: '#5d4037',
    body: { w: 1.22, h: 0.97, belly: 1.45, arm: 1.05, leg: 1.05 },
    shirt: '#8fc3f0', shirtHi: '#cfe6fb', shirtLo: '#4f86b8', shorts: '#cdb894', shoes: '#4e342e', band: '#8fc3f0', socksDark: true, socksHigh: true,
    extras: { mustache: '#5d4037' },
    paddle: { face: '#455a64', rim: '#cfd8dc', shape: 'round' }
  },
  rodrigo: {
    name: 'Rodrigo', role: 'Jefe', speed: 0.6, desc: '',
    skin: '#ecc19d', hair: 'slick', hairColor: '#2b1d14',
    body: { w: 1.0, h: 1.04, belly: 1.0, arm: 1.0, leg: 1.0 },
    shirt: '#ffffff', shirtHi: '#ffffff', shirtLo: '#b6bcc4', shorts: '#0d1b2a', shoes: '#ffffff', band: '#0d1b2a',
    extras: {},
    paddle: { face: '#0d1b2a', rim: '#c9a227', shape: 'tear' }
  },
  brayan: {
    name: 'Brayan', role: 'Jefe', speed: 0.8, desc: '',
    skin: '#d9a77f', hair: 'spiky', hairColor: '#f5f5f5',
    body: { w: 0.88, h: 1.02, belly: 0.88, arm: 0.88, leg: 0.88 },
    shirt: '#151515', shirtHi: '#4a4a4a', shirtLo: '#000000', shorts: '#e91e63', shoes: '#ffffff', band: '#e91e63',
    extras: { glasses: '#e91e63' },
    paddle: { face: '#e91e63', rim: '#151515', shape: 'diamond' }
  },
  kevin: {
    name: 'Kevin', role: 'Jefe', speed: 0.45, desc: '',
    skin: '#c99772', hair: 'cap', hairColor: '#2b1d14',
    body: { w: 1.1, h: 1.0, belly: 1.05, arm: 1.25, leg: 1.05 },
    shirt: '#d50000', shirtHi: '#ff6e6e', shirtLo: '#8e0000', shorts: '#151515', shoes: '#ffeb3b', band: '#ffeb3b',
    extras: { cap: '#151515', capBack: true },
    paddle: { face: '#ffeb3b', rim: '#151515', shape: 'diamond' }
  },
  martinez: {
    name: 'Profe Martínez', role: 'Jefe', speed: 0.5, desc: '',
    skin: '#e6b48d', hair: 'short', hairColor: '#c7c7c7',
    body: { w: 1.04, h: 1.02, belly: 1.1, arm: 1.1, leg: 1.05 },
    shirt: '#0d2c54', shirtHi: '#3d6fae', shirtLo: '#06172d', shorts: '#0d2c54', shoes: '#ffffff', band: '#e4ff3a',
    extras: { beard: '#a8a8a8' },
    paddle: { face: '#e4ff3a', rim: '#0d2c54', shape: 'tear' }
  },
  capitana: {
    name: 'La Capitana', role: 'Jefa', speed: 0.7, desc: '',
    skin: '#d8a27b', hair: 'ponytail', hairColor: '#2a1a12',
    body: { w: 0.92, h: 1.0, belly: 0.92, arm: 1.05, leg: 0.95 },
    shirt: '#fdd835', shirtHi: '#fff59d', shirtLo: '#b59a00', shorts: '#111111', shoes: '#111111', band: '#111111',
    extras: { headband: '#111111' },
    paddle: { face: '#111111', rim: '#fdd835', shape: 'diamond' }
  }
};

Object.assign(LOOKS, {
  zeus: {
    name: 'Zeus', role: 'Jefe', speed: 0.7, desc: '',
    skin: '#e8c6a4', hair: 'short', hairColor: '#f4f4f4',
    body: { w: 1.15, h: 1.08, belly: 1.0, arm: 1.3, leg: 1.1 },
    shirt: '#f4f1e6', shirtHi: '#ffffff', shirtLo: '#bdb59a', shorts: '#d4af37', shoes: '#c9a227', band: '#ffd54a',
    extras: { beard: '#f0f0f0', headband: '#d4af37' },
    paddle: { face: '#ffd54a', rim: '#ffffff', shape: 'diamond' }
  },
  coloso: {
    name: 'El Coloso', role: 'Jefe', speed: 0.2, desc: '',
    skin: '#b0703f', hair: 'bald', hairColor: '#2a1a12',
    body: { w: 1.4, h: 1.05, belly: 1.3, arm: 1.6, leg: 1.4 },
    shirt: '#3a120c', shirtHi: '#ff6a2b', shirtLo: '#1c0806', shorts: '#111111', shoes: '#ff6a2b', band: '#ff6a2b',
    extras: { beard: '#2a1a12' },
    paddle: { face: '#ff3d00', rim: '#111111', shape: 'round' }
  },
  chispa: {
    name: 'Chispita', role: 'Jefe', speed: 0.85, desc: '',
    skin: '#f0c39b', hair: 'spiky', hairColor: '#ff7a1a',
    body: { w: 0.86, h: 0.95, belly: 0.88, arm: 0.85, leg: 0.86 },
    shirt: '#ffca28', shirtHi: '#ffe58a', shirtLo: '#b88a00', shorts: '#3a120c', shoes: '#ff3d00', band: '#ff3d00',
    extras: { glasses: '#222222' },
    paddle: { face: '#ffca28', rim: '#3a120c', shape: 'diamond' }
  },
  // ---- Jefes del laboratorio ----
  ilusionista: {
    name: 'El Ilusionista', role: 'Jefe', speed: 0.65, desc: '',
    skin: '#ead0b6', hair: 'slick', hairColor: '#0e0e12',
    body: { w: 0.92, h: 1.07, belly: 0.9, arm: 0.95, leg: 1.0 },
    shirt: '#3b1466', shirtHi: '#9a6be0', shirtLo: '#1c0833', shorts: '#101014', shoes: '#f4f4f4', band: '#ffd54a', socksDark: true, socksHigh: true,
    extras: { mustache: '#0e0e12' },
    paddle: { face: '#7a2cff', rim: '#ffd54a', shape: 'diamond' }
  },
  temblor: {
    name: 'Temblor', role: 'Jefe', speed: 0.3, desc: '',
    skin: '#a9764e', hair: 'cap', hairColor: '#2a1a12',
    body: { w: 1.36, h: 1.04, belly: 1.25, arm: 1.5, leg: 1.35 },
    shirt: '#5a4632', shirtHi: '#ffb300', shirtLo: '#2e2318', tank: true, shorts: '#2b2b2b', shoes: '#ffb300', band: '#ffb300',
    extras: { beard: '#2a1a12', cap: '#ffb300' },
    paddle: { face: '#6d4c41', rim: '#ffb300', shape: 'round' }
  },
  replica: {
    name: 'Réplica', role: 'Jefe', speed: 0.8, desc: '',
    skin: '#b98660', hair: 'cap', hairColor: '#2a1a12',
    body: { w: 0.86, h: 0.95, belly: 0.9, arm: 0.88, leg: 0.88 },
    shirt: '#ffb300', shirtHi: '#ffe082', shirtLo: '#a87400', shorts: '#2b2b2b', shoes: '#5a4632', band: '#5a4632',
    extras: { cap: '#ffb300', capBack: true, glasses: '#2b2b2b' },
    paddle: { face: '#ffb300', rim: '#2b2b2b', shape: 'tear' }
  }
});


// ---- Jefes del torneo (beta 3): caricaturas de pádel, sin más intención que el parecido ----
Object.assign(LOOKS, {
  rubius: { name: 'elrubius', role: 'Jefe', speed: 0.35, desc: '', skin: '#f0cfb0', hair: 'spiky', hairColor: '#b98a4e',
    body: { w: 0.9, h: 1.0, belly: 0.92, arm: 0.9, leg: 0.92 }, shirt: '#f2f2f2', shirtHi: '#ffffff', shirtLo: '#a9a9a9', shorts: '#1b1b1b', shoes: '#ffffff', band: '#39e07a',
    extras: {}, paddle: { face: '#39e07a', rim: '#1b1b1b', shape: 'tear' } },
  itown: { name: 'iTownGamePlay', role: 'Jefe', speed: 0.6, desc: '', skin: '#e2b792', hair: 'short', hairColor: '#1a1410',
    body: { w: 1.04, h: 1.0, belly: 1.05, arm: 1.0, leg: 1.0 }, shirt: '#c62828', shirtHi: '#ff7a6e', shirtLo: '#7f1414', shorts: '#151515', shoes: '#e9e9e9', band: '#c62828',
    extras: { beard: '#1a1410' }, paddle: { face: '#151515', rim: '#c62828', shape: 'round' } },
  jara: { name: 'Jeannette Jara', role: 'Jefa', speed: 0.25, desc: '', skin: '#e3b592', hair: 'ponytail', hairColor: '#241812',
    body: { w: 1.02, h: 0.94, belly: 1.05, arm: 0.95, leg: 0.95 }, shirt: '#d32f2f', shirtHi: '#ff8a80', shirtLo: '#8e1a1a', shorts: '#1c1c28', shoes: '#ffffff', band: '#ffffff',
    extras: { glasses: '#2a1a1a' }, paddle: { face: '#d32f2f', rim: '#ffffff', shape: 'round' } },
  otakin: { name: 'El Otakin', role: 'Jefe', speed: 0.6, desc: '', skin: '#e8c19c', hair: 'side', hairColor: '#101018',
    body: { w: 0.92, h: 1.0, belly: 0.95, arm: 0.9, leg: 0.92 }, shirt: '#6a3df0', shirtHi: '#b39dff', shirtLo: '#38209a', shorts: '#14141c', shoes: '#ff5c8a', band: '#ff5c8a', socksHigh: true,
    extras: { glasses: '#101018', headband: '#ff5c8a' }, paddle: { face: '#ff5c8a', rim: '#14141c', shape: 'diamond' } },
  bachelet: { name: 'La Bachelet', role: 'Jefa', speed: 0.8, desc: '', skin: '#f0c9a8', hair: 'short', hairColor: '#d9bf7a',
    body: { w: 1.0, h: 0.93, belly: 1.02, arm: 0.95, leg: 0.95 }, shirt: '#1e5fbf', shirtHi: '#8fb8f5', shirtLo: '#103a7a', shorts: '#f2f2f2', shoes: '#d32f2f', band: '#d32f2f',
    extras: { glasses: '#6b4a2a' }, paddle: { face: '#ffffff', rim: '#d32f2f', shape: 'round' } },
  xokas: { name: 'elXokas', role: 'Jefe', speed: 0.45, desc: '', skin: '#e0b08a', hair: 'bald', hairColor: '#1a1410',
    body: { w: 1.14, h: 1.03, belly: 1.0, arm: 1.3, leg: 1.08 }, shirt: '#151515', shirtHi: '#4a4a4a', shirtLo: '#000000', tank: true, shorts: '#151515', shoes: '#f2f2f2', band: '#e53935',
    extras: { beard: '#1a1410' }, paddle: { face: '#e53935', rim: '#151515', shape: 'diamond' } },
  pinera: { name: 'Sebastián Piñera', role: 'Jefe', speed: 0.85, desc: '', skin: '#ecc7a6', hair: 'side', hairColor: '#cfcfcf',
    body: { w: 0.9, h: 0.95, belly: 0.95, arm: 0.88, leg: 0.88 }, shirt: '#f4f4f4', shirtHi: '#ffffff', shirtLo: '#b0b6be', shorts: '#12305e', shoes: '#ffffff', band: '#12305e',
    extras: {}, paddle: { face: '#12305e', rim: '#f4f4f4', shape: 'tear' } },
  huevito: { name: 'Huevito Rey', role: 'Jefe', speed: 0.7, desc: '', skin: '#e6b890', hair: 'bald', hairColor: '#2a1a12',
    body: { w: 0.96, h: 0.98, belly: 1.0, arm: 0.95, leg: 0.95 }, shirt: '#ffd23a', shirtHi: '#fff0a0', shirtLo: '#b08a00', shorts: '#1b1b1b', shoes: '#ffffff', band: '#1b1b1b',
    extras: {}, paddle: { face: '#fff7d6', rim: '#ffd23a', shape: 'round' } },
  bombo: { name: 'Bombo Fica', role: 'Jefe', speed: 0.5, desc: '', skin: '#dfb08a', hair: 'short', hairColor: '#bdbdbd',
    body: { w: 1.26, h: 1.0, belly: 1.45, arm: 1.1, leg: 1.1 }, shirt: '#2e7d5b', shirtHi: '#8fd6b4', shirtLo: '#17452f', shorts: '#2a2a2a', shoes: '#3a2a20', band: '#2e7d5b',
    extras: { mustache: '#9a9a9a' }, paddle: { face: '#8d5a2b', rim: '#f2e6c8', shape: 'round' } },
  corxea: { name: 'Corxea', role: 'Jefe', speed: 0.7, desc: '', skin: '#e2b48e', hair: 'cap', hairColor: '#1a1410',
    body: { w: 1.05, h: 1.05, belly: 0.98, arm: 1.15, leg: 1.05 }, shirt: '#2a1d4f', shirtHi: '#9a6be0', shirtLo: '#140c2a', shorts: '#0e0e14', shoes: '#b79cff', band: '#b79cff', socksDark: true,
    extras: { beard: '#1a1410', cap: '#0e0e14', capBack: true }, paddle: { face: '#7a2cff', rim: '#e4ff3a', shape: 'diamond' } },
  vardoc: { name: 'Vardoc', role: 'Jefe', speed: 0.45, desc: '', skin: '#e4b792', hair: 'mullet', hairColor: '#1c1410',
    body: { w: 1.12, h: 1.04, belly: 1.08, arm: 1.2, leg: 1.08 }, shirt: '#101010', shirtHi: '#505050', shirtLo: '#000000', shorts: '#101010', shoes: '#e53935', band: '#e53935',
    extras: { beard: '#1c1410', headband: '#e53935' }, paddle: { face: '#e53935', rim: '#101010', shape: 'diamond' } },
  maradona: { name: 'Maradona', role: 'Jefe', speed: 0.8, desc: '', skin: '#d7a57c', hair: 'curly', hairColor: '#0e0b09',
    body: { w: 1.08, h: 0.93, belly: 1.12, arm: 1.05, leg: 1.15 }, shirt: '#75aadb', shirtHi: '#ffffff', shirtLo: '#3f77ad', shorts: '#101010', shoes: '#101010', band: '#ffffff', socksHigh: true,
    extras: { headband: '#ffffff' }, paddle: { face: '#75aadb', rim: '#ffffff', shape: 'round' } }
});
LOOKS.neira = { ...LOOKS.matias, name: 'Matías Neira', role: 'Jefe', desc: '' };

// "Otros personajes" del menú: se puede jugar con el aspecto y el nombre de un jefe, pero con estadísticas normales
// (velocidad y fuerza parejas, tamaño normal, sin poderes)
export const EXTRA_CHARACTERS = ['rubius', 'itown', 'jara', 'otakin', 'bachelet', 'xokas', 'pinera', 'zeus', 'huevito', 'bombo', 'corxea', 'vardoc', 'maradona'];
export const PLAYABLE = [...CHARACTERS, ...EXTRA_CHARACTERS];
export const EXTRA_SPEED = 0.5;
export const playSpeed = id => (CHARACTERS.includes(id) ? LOOKS[id].speed : EXTRA_SPEED);

// ---- Mapas: 3 vanilla y 3 raros ----
export const MAPS = {
  chile:  { name: 'Chile', tag: 'Vanilla', desc: 'Cancha clásica frente a la cordillera. Física 100% normal.', bounceZ: 1, roll: 1,
            swatch: 'linear-gradient(180deg, #f0a46b 0%, #3b4f7a 55%, #1f5fb0 100%)' },
  brasil: { name: 'Brasil, en la playa', tag: 'Vanilla', desc: 'Más arena en el césped: la pelota pica un 10% más bajo.', bounceZ: 0.9, roll: 1, sand: 2.2,
            swatch: 'linear-gradient(180deg, #7cc6f0 0%, #2aa6b8 45%, #e8cf94 100%)' },
  china:  { name: 'China, terraza de Shanghái', tag: 'Vanilla', desc: 'Carpeta un poco más rápida: la pelota frena algo menos al botar.', bounceZ: 1, roll: 1.02,
            swatch: 'linear-gradient(180deg, #1a1440 0%, #6b1b2b 55%, #23324a 100%)' },
  altura: { name: 'En altura', tag: 'Raro', desc: 'Lluvia suave y ráfagas de viento cada cierto rato que desvían la pelota.', bounceZ: 0.97, roll: 1, rain: true, gusts: true,
            swatch: 'linear-gradient(180deg, #8fa2b4 0%, #5b6b7d 50%, #2c4f7a 100%)' },
  atlas:  { name: 'Hombros de Atlas', tag: 'Raro', desc: 'La cancha se inclina por ratos y caen rayos que paralizan 4 s.', bounceZ: 1, roll: 1, tilt: true, bolts: true,
            swatch: 'linear-gradient(180deg, #2a3f8f 0%, #8fa7e0 50%, #f5d58a 100%)' },
  crater: { name: 'Cráter volcánico', tag: 'Raro', desc: 'Con techo: nadie saca la pelota por 3 ni por 4, rebota y sigue. Los remates dejan brasas que queman los pies; los cristales calientes devuelven más rápido y queman al tocarlos.', bounceZ: 1, roll: 1, embers: true, hotGlass: true, roof: 200,
            swatch: 'linear-gradient(180deg, #2a0a06 0%, #8a1f0a 55%, #ff6a1a 100%)' }
};
// Mapas del laboratorio (versión de prueba): no entran a la votación ni al azar del amistoso
Object.assign(MAPS, {
  abismo: { name: 'El Abismo', tag: 'Nuevo', lab: true, desc: 'El piso se cae por baldosas: avisan, se abren y quedan así hasta el fin del punto. Si pisas un hoyo quedas fuera ese punto (se saltan); si la pelota bota en un hoyo rival, el punto es tuyo.', bounceZ: 1, roll: 1, holes: true,
            swatch: 'linear-gradient(180deg, #07061a 0%, #3a1d5e 55%, #2a2d6e 100%)' },
  circo:  { name: 'El Circo', tag: 'Nuevo', lab: true, desc: 'Cuatro camas elásticas se pasean por la cancha: si las pisas sales volando 2,4 m y rematas desde arriba; si la pelota bota en una, sale disparada.', bounceZ: 1, roll: 1, pads: true,
            swatch: 'linear-gradient(180deg, #1a0b2e 0%, #b0306a 55%, #f2c14e 100%)' },
  gigante: { name: 'Estadio gigante', tag: 'Nuevo', lab: true, desc: 'La cancha es un 35% más grande: los jugadores y la pelota se ven más chicos, la pala alcanza menos y hay que correr mucho más.', bounceZ: 1, roll: 1, big: 0.74, bigSpeed: 0.9,
            swatch: 'linear-gradient(180deg, #050a18 0%, #1b3a6b 50%, #2a7a4a 100%)' }
});
// Mapa cambiante: no es una cancha, es una forma de jugar. Cada SHIFT_POINTS puntos la cancha se desarma y se arma
// otra al azar (state.shift lleva la cuenta; state.map es siempre la cancha real del momento)
MAPS.cambiante = { name: 'Mapa cambiante', tag: 'Raro', shift: true, desc: 'Cada 2 puntos la cancha se desarma y se arma otra al azar, con sus peligros: cualquiera de las otras 9.', bounceZ: 1, roll: 1,
  swatch: 'conic-gradient(#e98a52, #45c3cf, #6b1b2b, #8fa2b4, #f5d58a, #ff6a1a, #4a2a7a, #b0306a, #2a7a4a, #e98a52)' };
export const MAP_IDS = Object.keys(MAPS).filter(id => !MAPS[id].lab);
export const ALL_MAP_IDS = Object.keys(MAPS);
export const REAL_MAP_IDS = ALL_MAP_IDS.filter(id => !MAPS[id].shift);   // canchas de verdad (las que puede armar el mapa cambiante)
// Mutadores del laboratorio: suman el peligro de otro mapa a la cancha elegida
export const MUTATORS = {
  holes: { name: 'Piso que se cae', flags: { holes: true } },
  pads: { name: 'Camas elásticas', flags: { pads: true } },
  big: { name: 'Cancha gigante', flags: { big: 0.74, bigSpeed: 0.9 } },
  bolts: { name: 'Rayos', flags: { bolts: true } },
  gusts: { name: 'Viento', flags: { gusts: true } },
  tilt: { name: 'Inclinación', flags: { tilt: true } },
  lava: { name: 'Brasas y cristal caliente', flags: { embers: true, hotGlass: true } }
};
export const MUTATOR_IDS = Object.keys(MUTATORS);
// Torneo de 8 jefes. El nivel (skill) de los 6 primeros es el de siempre aunque cambió el orden (Zeus pasó del 3.º al 5.º).
// blink: cada tantos cuadros puede teletransportarse a la pelota (aparte de su activa); breaker: sus remates rompen el piso;
// activeCd: recarga propia de su activa (cuadros).
export const BOSSES = [
  { team: 'elrubius y iTownGamePlay', map: 'chile', skill: 0.45, gamesToWin: 1, players: [
    { look: 'rubius', name: 'elrubius', speed: 0.35, active: 'random' },
    { look: 'itown', name: 'iTownGamePlay', speed: 0.6 }] },
  { team: 'Jeannette Jara y El Otakin', map: 'brasil', skill: 0.58, gamesToWin: 1, players: [
    { look: 'jara', name: 'Jeannette Jara', speed: 0.25, active: 'random' },
    { look: 'otakin', name: 'El Otakin', speed: 0.6, active: 'random' }] },
  { team: 'La Bachelet y elXokas', map: 'china', skill: 0.91, gamesToWin: 1, flash: true, players: [
    { look: 'bachelet', name: 'La Bachelet', speed: 0.8, active: 'clone' },
    { look: 'xokas', name: 'elXokas', speed: 0.45, active: 'random' }] },
  { team: 'Sebastián Piñera y Matías Neira', map: 'crater', skill: 0.96, gamesToWin: 2, players: [
    { look: 'neira', name: 'Matías Neira', speed: 0.2, bodyScale: 1.5, speedMult: 0.88, powerMult: 1.3, active: 'random', ups: 3 },
    { look: 'pinera', name: 'Sebastián Piñera', speed: 0.85, bodyScale: 0.74, speedMult: 1.3, backPref: true, active: 'random', ups: 3 }] },
  { team: 'Zeus (ministro Quiroz)', map: 'atlas', skill: 0.76, gamesToWin: 2, solo: true, players: [
    { look: 'zeus', name: 'Ministro Quiroz', speed: 0.7, bodyScale: 1.3, speedMult: 1.32, powerMult: 1.15 }] },
  { team: 'Huevito Rey y Bombo Fica', map: 'altura', skill: 1.02, gamesToWin: 2, players: [
    { look: 'bombo', name: 'Bombo Fica', speed: 0.5, active: 'all', ups: 4 },
    { look: 'huevito', name: 'Huevito Rey', speed: 0.7, active: 'all', ups: 4 }] },
  // 7.º: uno solo contra los dos, en el piso que se cae. Corxea se teletransporta a la pelota y su clon de sombra es el Tío Tito
  { team: 'Corxea y Tío Tito', map: 'abismo', skill: 0.92, gamesToWin: 2, solo: true, players: [
    { look: 'corxea', name: 'Corxea', speed: 0.7, bodyScale: 1.25, speedMult: 1.36, powerMult: 1.2, active: 'clone', blink: 300, ups: 3 }] },
  // 8.º: la final, en el mapa cambiante
  { team: 'Vardoc y Maradona', map: 'cambiante', skill: 1.12, gamesToWin: 2, breaker: true, players: [
    { look: 'vardoc', name: 'Vardoc', speed: 0.45, bodyScale: 1.15, powerMult: 1.2, active: 'sismo', ups: 6 },
    { look: 'maradona', name: 'Maradona', speed: 0.8, speedMult: 1.15, active: 'fantasma', blink: 420, ups: 6 }] }
];
// ---- Laboratorio (versión de prueba) ----
// Jefes nuevos. blink: cada tantos cuadros puede teletransportarse a la pelota (aparte de su activa);
// breaker: sus remates rompen el piso donde botan; hats: sombreros apilados.
export const LAB_BOSSES = [
  { team: 'El Gran Ilusionista', map: 'circo', skill: 0.9, gamesToWin: 2, solo: true, isNew: true,
    desc: 'Juega solo contra los dos. Se teletransporta a la pelota cada 5 s y, cada tanto, su golpe sale invisible hasta que bota.', players: [
    { look: 'ilusionista', name: 'El Ilusionista', speed: 0.65, bodyScale: 1.12, speedMult: 1.2, powerMult: 1.1, active: 'fantasma', blink: 300, hats: 2 }] },
  { team: 'Los hermanos Terremoto', map: 'abismo', skill: 0.85, gamesToWin: 2, breaker: true, isNew: true,
    desc: 'Temblor sacude tu lado (salta para esquivarlo), Réplica se duplica, y los remates de los dos rompen el piso.', players: [
    { look: 'temblor', name: 'Temblor', speed: 0.3, bodyScale: 1.35, speedMult: 0.95, powerMult: 1.25, active: 'sismo', ups: 2 },
    { look: 'replica', name: 'Réplica', speed: 0.8, bodyScale: 0.8, speedMult: 1.2, backPref: true, active: 'clone', ups: 2 }] }
];
// Rivales del laboratorio: los nuevos, los 6 del torneo y una pareja de bots normales (con el nivel elegido en el menú)
export const LAB_RIVALS = [
  ...LAB_BOSSES,
  ...BOSSES,
  { team: 'Sparring', map: 'chile', skill: 0.5, gamesToWin: 1, sparring: true, desc: 'Dos bots normales, sin poderes, con el nivel que elijas.', players: [{ look: 'maxi' }, { look: 'german' }] }
];
// Configuración del laboratorio: cancha, rival (índice de LAB_RIVALS), activa ('' = sprint), mejoras (0 ninguna, 1 un nivel
// de cada una, 2 todas al máximo), juegos para ganar y mutadores
export const LAB_DEFAULT = { map: 'abismo', rival: 1, active: 'teleport', ups: 2, games: 2, mods: [] };
// La misma, validada (el menú la recuerda entre sesiones y puede venir de una versión anterior)
export function validLab(c) {
  c = c || {};
  const d = LAB_DEFAULT;
  return {
    map: MAPS[c.map] ? c.map : d.map,
    rival: Number.isInteger(c.rival) && LAB_RIVALS[c.rival] ? c.rival : d.rival,
    active: c.active === '' || ACTIVES[c.active] ? c.active : d.active,
    ups: [0, 1, 2].includes(c.ups) ? c.ups : d.ups,
    games: [1, 2, 3].includes(c.games) ? c.games : d.games,
    mods: Array.isArray(c.mods) ? c.mods.filter(m => MUTATORS[m]) : []
  };
}

// Premio por jefe ganado (para cada jugador), según qué tan claro fue. Jefes a un juego: por los puntos que les
// hicieron en ese juego (40-0, 40-15, 40-30, punto de oro). Jefes al mejor de 3: por los juegos que perdieron.
export const RUN_REWARD_BY_POINTS = [1500, 1100, 900, 700];
export const RUN_REWARD_BY_GAMES = [1500, 1000];
export const RUN_REWARD = RUN_REWARD_BY_POINTS[0];   // el máximo (para los textos del menú)
export function runReward(boss, finalScore, games) {
  if (boss.gamesToWin > 1) return RUN_REWARD_BY_GAMES[Math.min(games[1], RUN_REWARD_BY_GAMES.length - 1)];
  return RUN_REWARD_BY_POINTS[Math.min(finalScore[1], RUN_REWARD_BY_POINTS.length - 1)];
}
export const TEAMMATE_SKILL = 0.6;
export const FRIENDLY_START_MONEY = 700;
export const FRIENDLY_SHOP_MONEY = 1000;

// ---- Tienda ----
export const UPGRADES = [
  { id: 'pala', name: 'Pala XL', desc: 'Pala más grande: +15% de alcance por nivel.', cost: 600, max: 3 },
  { id: 'zapas', name: 'Zapatillas turbo', desc: '+7% de velocidad al moverte.', cost: 500, max: 3 },
  { id: 'fuerza', name: 'Gimnasio', desc: '+12% de potencia en drives, remates y saque.', cost: 600, max: 3 },
  { id: 'grip', name: 'Grip pro', desc: 'Cargas el golpe un 25% más rápido.', cost: 400, max: 3 },
  { id: 'sprint', name: 'Isotónica', desc: 'Solo el sprint normal: recarga un 30% más rápido y dura más. No afecta a las activas.', cost: 400, max: 2 },
  { id: 'remate', name: 'Muñequera de remate', desc: 'Rematas desde más abajo, con menos carga y más fuerte.', cost: 700, max: 2 },
  { id: 'estiron', name: 'Estirón', desc: 'Creces 5 cm por nivel: alcanzas pelotas más altas y rematas desde más abajo.', cost: 500, max: 3 },
  { id: 'cortado', name: 'Golpe cortado', desc: 'Tus drives y saques botan más bajo y mueren antes.', cost: 600, max: 2 },
  { id: 'sombrero', name: 'Sombrero', desc: 'Solo estético. Se apilan uno encima del otro, hasta 5.', cost: 350, max: 5, cosmetic: true }
];
export const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
export const ACTIVES = {
  clone: { name: 'Kage Bunshin no Jutsu', desc: 'Un clon de sombra copia tus movimientos 5 s y también le pega a la pelota.' },
  gordo: { name: 'Gordo', desc: 'Te vuelves gigante 5 s: muy lento, pero alcanzas todo y le pegas durísimo.' },
  palaxl: { name: 'Pala enorme', desc: 'Tu pala se vuelve gigantesca por 5 s: muchísimo más alcance.' },
  hielo: { name: 'Cancha de hielo', desc: 'Congelas la mitad rival 5 s: los rivales resbalan y la pelota patina.' }
};
// Activas del laboratorio (versión de prueba): no salen en la tienda ni se las dan al azar a bots y jefes.
// dur y cd (cuadros) reemplazan a los 5 s y 45 s de las demás.
Object.assign(ACTIVES, {
  teleport: { name: 'Parpadeo', lab: true, dur: 18, cd: 480, desc: 'Apareces justo donde la pelota va a quedar a tu alcance (si no viene hacia ti, donde apuntas). Recarga 8 s.' },
  sismo: { name: 'Terremoto', lab: true, dur: 60, cd: 1500, desc: 'Sacudes el lado rival: 1 s después, los rivales que estén pisando el suelo quedan aturdidos 1,7 s. Se esquiva saltando. Recarga 25 s.' },
  fantasma: { name: 'Pelota fantasma', lab: true, dur: 300, cd: 1200, desc: 'Tu próximo golpe (tienes 5 s) sale invisible para los rivales desde que cruza la red hasta que bota. Recarga 20 s.' },
  martillo: { name: 'Rompesuelos', lab: true, dur: 360, cd: 1500, desc: 'Durante 6 s, donde boten tus golpes se rompe el piso: queda un hoyo hasta el fin del punto. Recarga 25 s.' }
});
export const ACTIVE_IDS = Object.keys(ACTIVES).filter(id => !ACTIVES[id].lab);
export const ALL_ACTIVE_IDS = Object.keys(ACTIVES);
export const ACTIVE_COST = 1000;
export const DIFFICULTIES = [
  { name: 'Fácil', skill: 0.25 },
  { name: 'Normal', skill: 0.5 },
  { name: 'Difícil', skill: 0.75 },
  { name: 'Pro (como antes)', skill: 1.0 }
];

// ---- Frases y burlas (globos de texto) ----
export const TALK = {
  brag: ['¡Toma!', '¡Esa no la saca nadie!', '¡Puntazo!', 'Así se juega, compadre', '¡Para la repetición!', '¿Vieron eso?'],
  taunt: ['¡Uy, casi!', 'Tranquilo, respira', 'La red te quiere, parece', '¿Necesitas lentes?', 'Otra vez será', 'Jajaja, ¿qué fue eso?'],
  power: {
    clone: ['¡Kage Bunshin no Jutsu!', '¡Clones de sombra!'],
    gordo: ['¡Modo guatón!', '¡Abran cancha!'],
    palaxl: ['¡Mira mi pala!', 'Pala de concreto'],
    hielo: ['¡Patinen, patinen!', 'Hace frío por allá, ¿no?'],
    teleport: ['¡Ahora me ves!', '¡Puf!'],
    sismo: ['¡Agárrense!', '¡Terremoto!'],
    fantasma: ['¿Dónde está la pelotita?', 'Nada por aquí…'],
    martillo: ['¡Cuidado con el piso!', 'Se viene abajo']
  },
  byLook: {
    german: ['Con la guata, mijo', 'Ni me moví'],
    maxi: ['¡Muy lento, compadre!', 'El mullet no perdona'],
    joaquin: ['La leí antes que tú', 'Pura muñeca'],
    alvaro: ['Puro gimnasio', '¿Quieres otra?'],
    fernando: ['Sin despeinar el jockey', 'Equilibrio, hermano'],
    matias: ['Globito y a cobrar', 'Paciencia, puro cerebro'],
    marco: ['¡Qué bolá, asere!', '¡Venga, hombre!', 'Wena, po'],
    gladys: ['¡Ay, mijito!', 'Como en mis tiempos'],
    nena: ['Pasa la pelota, cariño', 'Y eso que no calenté'],
    patricio: ['Esto va al informe', 'Reunión terminada'],
    rodrigo: ['Deadline cumplido', 'Lo vemos el lunes'],
    zeus: ['¡Temblad, mortales!', 'Un rayito, nomás'],
    brayan: ['Esto va directo a las historias', 'Dale like'],
    kevin: ['Suscríbete', 'Contenido del bueno'],
    coloso: ['¡APLASTAR!', 'Pequeño humano'],
    chispa: ['¡Más rápido que tú!', '¡Chispeza!'],
    martinez: ['Primera lección: no fallar', 'Eso se entrena'],
    capitana: ['Así se gana un club', 'Siguiente'],
    rubius: ['¡Muy buenas, criaturitas!', 'Eso va para el vídeo'],
    itown: ['¡Hola, chicos!', 'Partidazo, ¿eh?'],
    jara: ['Con trabajo se gana', 'Punto para la gente'],
    otakin: ['¡Nani!', 'El poder de la amistad'],
    bachelet: ['Paso', 'Con calma, que llegamos'],
    xokas: ['¡Qué golpe, chaval!', 'A entrenar, máquina'],
    pinera: ['Tiempos mejores', 'Esto lo calculé antes'],
    neira: ['Globito y a cobrar', 'Paciencia, puro cerebro'],
    huevito: ['¡Buena, cabros!', 'Ese fue de rey'],
    bombo: ['¿Y cómo estuvo?', 'Tranquilo el perro'],
    corxea: ['Ahora me ves, ahora no', 'Tito, la tuya'],
    vardoc: ['GG, fácil', 'Eso fue un combo'],
    maradona: ['La pelota no se mancha', '¡Golazo!'],
    ilusionista: ['Nada por aquí, nada por allá', '¡Abracadabra!'],
    temblor: ['Grado 9, compadre', '¡Se movió el piso!'],
    replica: ['Y viene otra', 'Somos dos, por si acaso']
  }
};

// Lo que dice cada personaje al pasar el cursor por su tarjeta en el menú (text: lo que se lee en pantalla;
// say: cómo lo pronuncia la voz del navegador, si cambia. La voz de cada uno se elige en audio/voice.js)
export const HELLO = {
  joaquin: { text: '¡Hola, cabros! Hola, Germancito, la paz del Señor.' },
  matias: { text: '¡Mati Neira! ¡Illaoi número 1 de LAS!', say: '¡Mati Neira! ¡Ilaói número uno de las!' },
  alvaro: { text: '¡Álvaro! Los esmeraldas son horribles, no como yo: diamante 4.' },
  maxi: { text: '¡El Maxi, siiii! Katarina, Katarina, Kastarina, Kastina, Kast.', say: '¡El Maxi, siiiii! Katarina, Katarina, Kastarina, Kastina, Kast.' },
  marco: { text: 'Soy el Marco: cubano, español y chileno.' },
  german: { text: '¡Soy el Germancito! ¡Viva Jeannette Jara! ¡Suban el sueldo mínimo!', say: '¡Soy el Germancito! ¡Viva Yanet Jara! ¡Suban el sueldo mínimo!' },
  fernando: { text: '¡Soy el Xerny! ¡Haré que respeten la ley!', say: '¡Soy el Cherny! ¡Haré que respeten la ley!' }
};
