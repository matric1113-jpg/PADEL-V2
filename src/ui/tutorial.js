// Tutorial del menú: pocas páginas, con frases cortas (se abre desde el botón "Tutorial" del menú)
const k = t => `<span class="key">${t}</span>`;

export const TUTORIAL_PAGES = [
  {
    title: 'Controles',
    html: `<ul>
        <li>${k('W A S D')} moverte · ${k('Shift')} sprint (o tu activa)</li>
        <li>${k('Mouse')} apuntar · ${k('Clic izq.')} mantén y suelta para pegar</li>
        <li>${k('Clic der.')} globo · ${k('Espacio')} mantén y suelta para saltar</li>
      </ul>`
  },
  {
    title: 'Reglas básicas',
    html: `<ul>
        <li>Juegos a 4 puntos (15, 30, 40, ORO). A 40 iguales, punto de oro.</li>
        <li>La pelota bota una vez de tu lado. A la segunda, punto del rival.</li>
        <li>Si sale por encima de la pared tras botar, es <b>por 3 o por 4</b>: punto de quien pegó.</li>
        <li>Sal por tu puerta para rescatarla desde afuera.</li>
      </ul>`
  },
  {
    title: 'Con tu compañero',
    html: `<ul>
        <li>No pueden pegarle dos veces seguidas a la misma pelota: es falta.</li>
        <li>Si le pegas con la pala a tu compañero, lo aturdes de 2 a 4 s.</li>
        <li>Si lo golpeas con más de la mitad de carga, cae al suelo hasta que termine el punto.</li>
      </ul>`
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
