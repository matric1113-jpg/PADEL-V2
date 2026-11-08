// Tutorial del menú: páginas de texto con las mecánicas del juego (se abre desde el botón "Tutorial" del menú)
const k = t => `<span class="key">${t}</span>`;

export const TUTORIAL_PAGES = [
  {
    title: 'Cómo se gana',
    html: `<p>Se juega 2 contra 2. Cada juego se gana con 4 puntos (<b>15, 30, 40 y ORO</b>): a 40 iguales se juega un <b>punto de oro</b> y el que lo gana se lleva el juego.</p>
      <p>En el <b>Partido amistoso</b> gana quien llegue primero a 2 sets (cada set, a 6 juegos). En el <b>Torneo de jefes</b> te enfrentas a 6 rivales seguidos, cada uno en su cancha, y si pierdes empiezas de nuevo. En el <b>Americano</b> cambias de pareja en cada set y cada uno suma los juegos que gana.</p>
      <p>La pelota puede botar <b>una vez</b> en tu lado: la segunda vez es punto para el rival. Después del primer bote puedes devolverla de aire o de rebote en los cristales.</p>`
  },
  {
    title: 'Moverte y pegarle',
    html: `<ul>
        <li>${k('W A S D')} o las flechas: moverte.</li>
        <li>${k('Mouse')}: apuntar. Una guía de tiro te muestra a dónde irá la pelota.</li>
        <li>${k('Clic izq.')}: mantén para cargar (hasta 2 s) y suelta para pegar. Con más carga sale más fuerte.</li>
        <li>${k('Clic der.')}: globo, una pelota alta y lenta para ganar tiempo o pasar al rival.</li>
      </ul>
      <p>Para pegarle, la pelota tiene que estar de tu lado, al alcance de tu pala y a una altura que alcances.</p>`
  },
  {
    title: 'El saque',
    html: `<p>Al sacar, la pelota está en tu mano. Apunta con el mouse <b>dentro del cuadro de saque marcado</b> en la cancha rival, carga con el clic izquierdo y suelta.</p>
      <p>Es falta de saque si la pelota pega en la red, cae fuera del cuadro, toca la malla o va directo al cristal sin botar. Al sacar no se puede saltar.</p>`
  },
  {
    title: 'Remate, contrapared y salto',
    html: `<ul>
        <li><b>Remate:</b> si la pelota viene alta, estás cerca de la red y cargas al menos la mitad, el drive se convierte en remate: más rápido y con un bote que cuesta devolver. Mientras más arriba le pegues, más fuerte sale.</li>
        <li><b>Contrapared:</b> si la pelota te pasa y está pegada a tu fondo, apunta hacia tu propio cristal de atrás y pégale: rebota y sale en globo hacia el rival.</li>
        <li><b>Salto:</b> mantén ${k('Espacio')} para cargarlo y suelta para saltar. Con más carga saltas más alto y alcanzas pelotas que se van por arriba. Al caer quedas clavado un instante y corres más lento un rato, así que no abuses.</li>
      </ul>`
  },
  {
    title: 'Cristales, por 3, por 4 y puertas',
    html: `<p>Después de botar en el lado rival, la pelota puede rebotar en los cristales y la malla y seguir en juego. Pero si <b>sale por encima de la pared</b> del fondo es un <b>por 4</b>, y si sale por la pared lateral, un <b>por 3</b>: el punto es para quien pegó.</p>
      <p>El punto se decide cuando la pelota toca el suelo de afuera, así que se puede <b>rescatar</b>: sal de la cancha por la <b>puerta</b> de tu lado (donde termina el cristal y empieza la malla), pégale desde afuera con un globo que pase por arriba de la pared y vuelve a entrar por la puerta.</p>`
  },
  {
    title: 'Faltas y reglas de pareja',
    html: `<ul>
        <li><b>Doble golpe:</b> si tu equipo le pega a la pelota y esta vuelve a tu lado, que tú o tu compañero la toquen de nuevo con la pala es falta y punto para el rival.</li>
        <li><b>Raquetazo al compañero:</b> si tu pala golpea a tu compañero mientras pegas, lo aturde 2 segundos. Cuidado al ir los dos por la misma pelota.</li>
        <li><b>Botó en tu propio campo</b> después de tu golpe: falta.</li>
        <li><b>Red:</b> si tu pelota pega en la red antes de pasar al otro lado, es punto para el rival.</li>
        <li><b>Directo al cristal</b> sin botar en el campo rival: fuera.</li>
      </ul>`
  },
  {
    title: 'Sprint, activas y tienda',
    html: `<ul>
        <li>${k('Shift')}: sprint, con recarga. Si compraste una <b>activa</b>, Shift la usa en vez del sprint.</li>
        <li><b>Activas</b> (dura 5 s, recarga 45 s): clon de sombra, gordo, pala enorme o cancha de hielo. Solo puedes tener una.</li>
        <li><b>Tienda:</b> en el torneo, después de cada jefe. En el amistoso, antes de empezar, después del juego 2 y luego cada 3 juegos. Con tu plata compras mejoras: más alcance, velocidad, potencia, carga rápida, remates y más.</li>
        <li>Todos los personajes están parejos: la velocidad y la fuerza se reparten entre las dos (más rápido, menos fuerte).</li>
      </ul>`
  },
  {
    title: 'Los mapas',
    html: `<ul>
        <li><b>Chile, Brasil y China:</b> física normal, con pequeños cambios en cómo pica la pelota.</li>
        <li><b>En altura:</b> lluvia y ráfagas de viento que desvían la pelota.</li>
        <li><b>Hombros de Atlas:</b> la cancha se inclina por ratos y caen rayos que paralizan a quien alcanzan (el aro del suelo avisa).</li>
        <li><b>Cráter volcánico:</b> los remates dejan brasas que queman los pies y los cristales calientes devuelven más rápido y queman al tocarlos.</li>
      </ul>
      <p>Una pelota altísima puede romper un foco y dejar ese lado más oscuro.</p>`
  }
];

export function viewTutorial(page) {
  const i = Math.min(Math.max(page, 0), TUTORIAL_PAGES.length - 1);
  const P = TUTORIAL_PAGES[i];
  const last = i === TUTORIAL_PAGES.length - 1;
  return `<div class="ov-panel tut">
    <div class="ov-sub">Tutorial · ${i + 1} de ${TUTORIAL_PAGES.length}</div>
    <div class="ov-title">${P.title}</div>
    <div class="tut-body">${P.html}</div>
    <div class="row">
      <button data-act="tut-prev" ${i === 0 ? 'disabled' : ''}>Anterior</button>
      ${last ? '<button class="primary big" data-act="tut-close">Volver al menú</button>' : '<button class="primary big" data-act="tut-next">Siguiente</button>'}
      ${last ? '' : '<button data-act="tut-close">Salir del tutorial</button>'}
    </div>
  </div>`;
}
