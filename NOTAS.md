# Notas de la migración a Vite + Three.js

Rama de trabajo: `threejs`. `main` (y el link de GitHub Pages) sigue mostrando la versión de un solo `index.html`.

## Cómo correr

```bash
npm install
npm run dev        # servidor local en http://localhost:5173
npm run build      # genera dist/ (base relativa: sirve en la raíz o en una subcarpeta)
npm run sim        # simulación sin pantalla (ver abajo)
```

Para probar el online hacen falta dos pestañas: en una "Crear sala", en la otra escribir el código en "Unirse a una sala".
Si una pestaña queda en segundo plano, el navegador pausa su dibujo (`requestAnimationFrame`); la física del anfitrión sigue por el Worker, pero conviene tener la pestaña del anfitrión al frente.

## Estructura

```
index.html            Entrada de Vite: solo el marcado (canvas, marcador, panel, teclas)
src/style.css         Todo el CSS (antes inline)
src/main.js           Bucle de juego (física a 60 Hz fijos + dibujo), conecta los hooks, arranque
src/dom.js            Referencias al canvas y su contenedor

src/core/             LÓGICA PURA. No toca DOM, audio, red ni render
  constants.js        Medidas de la cancha, física, LIGHTS (los 2 focos)
  data.js             LOOKS, CHARACTERS, MAPS, BOSSES, UPGRADES, ACTIVES, DIFFICULTIES, TALK
  stats.js            Cálculos derivados de mejoras/activas (alcance, carga, remate...)
  util.js             clamp, lerp, pick, shuffle, angleDiff...
  state.js            `state` (compartido por red), `rt` (estado de ejecución), localInput, menuSel
  events.js           `hooks`: único canal de la lógica hacia afuera
  ballistics.js       Apuntado, lanzamiento, saque reglamentario, banners
  game.js             Puntos y juegos, set, tienda 2v2, votación de mapa, torneo, compras
  hazards.js          Activas (clon, gordo, pala enorme, hielo) y peligros de mapa (rayos, inclinación, ráfagas)
  bots.js             IA de los bots
  physics.js          stepPhysics: movimiento, golpes, red, botes, cristales, reglas
  replay.js           Buffer de los últimos fotogramas para la repetición

src/net/network.js    PeerJS: crear sala, unirse, sincronizar `state`, enviar input
src/input/input.js    Teclado y mouse -> localInput
src/audio/audio.js    Web Audio: efectos y música
src/ui/hud.js         Marcador HTML
src/ui/menu.js        Menús y pantallas HTML (overlay), retratos

src/render2d/         RENDER ACTUAL (Canvas 2D). Lo que se reemplaza en las etapas 2 y 3
  camera.js           Cámara diagonal y proyección mundo<->pantalla (P, unprojectGround, fitCam)
  court.js            Suelo, paredes, focos, fondo, público, utilería
  layers.js           Capas estáticas en caché y tamaño del canvas
  fx.js               Efectos visuales y detección de eventos del estado
  players.js          Personajes (esqueleto proyectado), sombras, retratos del menú
  world.js            Pelota, red, guías de tiro, HUD en canvas, frame completo, puntería con mouse
  ctx.js, theme.js    Contexto 2D y fuentes/colores

scripts/simulate.mjs  Simulación de bots con solo `src/core`
```

## Qué quedó hecho (etapa 1)

- El juego funciona igual que antes: torneo de 6 jefes (con Zeus), 6 mapas, activas, tienda y votación en el 2v2, repetición, controles y online.
- La lógica quedó separada del render y de la interfaz. Se comprobó con una búsqueda de imports: `src/core` no importa nada fuera de `core` ni usa `document`/`window`.
- Se probó en el navegador: menú, torneo, saque, movimiento, sprint, sala online con dos pestañas (el input del invitado llega al anfitrión y el estado del anfitrión al invitado).
- Se comprobó que la lógica es idéntica a la original: se ejecutó el `<script>` original de `index.html` en un entorno simulado y los módulos nuevos con el mismo generador de azar, y se compararon posición de pelota y jugadores, marcador, pantalla, mapa y dinero. Resultado idéntico en 2 partidos amistosos y 2 torneos de 150.000 cuadros y en cada uno de los 6 jefes por separado. Ese script de comparación era de un solo uso y no está en el repo.

## Decisiones

**Cómo se hizo el corte.** Se partió el `<script>` con un script de un solo uso que usa un parser (acorn) y análisis de ámbitos, no a mano ni con regex. Así los imports/exports salen de las referencias reales y no se pierde ninguna. Ese script tampoco está en el repo.

**Variables sueltas -> `rt`.** Los `let` globales que se reasignan desde varios archivos (`isHost`, `mySlot`, `connections`, `hostConn`, `peer`, `gotHostState`, `joinTimer`, `localChargeFrames`, `lastPlayedSoundSeq`, `netMsg`, `uiMenuOpen`, `overlayKey`) pasaron a propiedades del objeto `rt` (`core/state.js`). Un módulo no puede reasignar una variable importada. `rt` no viaja por la red; `state` sí (el anfitrión lo envía completo y los invitados hacen `Object.assign(state, ...)`, así que su forma no se debe cambiar).

**Eventos entre la lógica y el render.** La lógica no llama a nada de afuera: usa `hooks` (`core/events.js`).
- `hooks.sound(type)`: lo llama `emitSound` (anfitrión) y la red cuando un invitado recibe un `soundTrigger` nuevo. `main.js` lo conecta a `playSound` (audio) y `onGameEvent` (efectos visuales).
- `hooks.scoreChanged()`: lo llama la lógica cuando cambia el marcador. `main.js` lo conecta a `updateScoreUI`.
- Además, el bucle de `main.js` llama cada cuadro a `syncHud`, `updateScoreUI` y `syncOverlay` (antes los llamaba `render`).
- El estado visual se sincroniza a partir de `state`: `detectStateEvents` (en `render2d/fx.js`) compara contadores `seq` de `state` (repetición, celebración, texto, focos, rayos). Este mecanismo sirve igual en anfitrión e invitados y se debe conservar.

**Proyección de la cámara y puntería.** El mouse se convierte en un punto del suelo con `unprojectGround` (rayo cámara -> plano z=0), usando la cámara de `fitCam`/`makeCam` (yaw ±0,36, pitch 0,83, distancia 1900, objetivo en la red, encuadre automático de la cancha con paredes). Esa función está dentro de `updateAimFromMouse` (hoy en `render2d/world.js`) porque depende de la cámara y de `fx.view` (giro/desplazamiento de la cancha inclinada de Atlas). En la etapa 1 no se cambió su matemática: es lo que hace que apuntar se sienta igual.

**Otras.**
- El 2v2 y el torneo comparten la misma lógica; solo cambia `state.mode`.
- PeerJS ahora viene de npm (misma versión 1.5.2, mismo prefijo de sala `padel2v2-pro-`, mismos servidores STUN/TURN). Las fuentes siguen cargando desde Google Fonts.
- `vite.config.js` usa `base: './'` para que el build funcione en una subcarpeta de GitHub Pages.
- `.claude/launch.json` es solo para el panel de vista previa de Claude Code.

## Para la etapa 2 (cancha en Three.js)

1. **La cámara 3D debe reproducir exactamente la proyección actual**, o apuntar cambia y con eso la jugabilidad. Reproducir `makeCam`/`fitCam` (yaw, pitch, dist, encuadre; una cámara para el juego y otra de repetición con yaw invertido ×1,25, pitch 0,6, dist 1500) con una cámara de perspectiva. Hay que verificar con una prueba: para varios puntos del suelo, `unprojectGround(P(x,y,0))` debe devolver (x,y). La cámara se calcula según el equipo del jugador (`cam.team`).
2. **Unidades.** 40 px de mundo = 1 m. La altura `z` se dibuja con `ZS = 1,2` (1 unidad de z = 1,2 px de mundo), así que la pelota está a `z * ZS + BALL_R`. Los personajes se escalan con `PLAYER_SCALE * ENTITY_K`. El eje Y del mundo es el eje "hacia abajo" del plano de la cancha.
3. **Medidas de la cancha:** `COURT` (x 60..860, y 40..480, red en x=460); paredes `WALL_H_TALL=160`, `WALL_H_LOW=120`, vidrio `GLASS_H=120`/`GLASS_STEP_H=80`; la lógica de rebote usa un margen de 10 unidades. La red mide `NET_H=29` (×ZS al dibujar). Los paneles, la puerta (`DOOR`) y los postes están en `court.js` (`wallPanels`).
4. **Focos y sombras.** `LIGHTS` (2 focos a z=300) son lógica: `state.lights[i]` se apaga si la pelota rompe un foco, y eso debe apagar la luz y su sombra. Hoy la luz se hornea en una textura (`lightField`); en Three.js serán luces con sombras reales.
5. **Mapas.** Estilos en `MAP_STYLE` y fondos en `drawBackdrop`/`drawCrowd`/`drawProps`/`drawMapDynamics` (Chile cordillera y aves; Brasil mar, palmeras, quitasoles y banderines; China rascacielos, pagoda y farolillos; En altura rocas, lluvia y ráfagas; Atlas cielo, el titán, nubes y ángeles; Cráter volcán, lava, brasas y calaveras/diablos). Los peligros son estado compartido: `state.ice`, `state.embers`, `state.bolts`, `state.tilt`, `state.gust`; ver `hazards.js`.
6. **Qué debe leer el render (solo lectura de `state`):** `ball` (x, y, z, `trail`, `shotType`), `players` (posición, `charging`, `chargeFrames`, `swingTimer`, `cooldown`, `swingLob`, `activeKind`/`activeT`, `clone`, `stun`, `burn`, `up`, `bodyScale`, `lookId`), `serveTargetBox`, `phase`, `serverSlot`, `bannerText`/`bannerTimer`. No debe escribir en `state` (el de los invitados se pisa cada tanda de red).
7. **HUD.** Nombres, barras de sprint/activa/carga, banner, globos de texto, guía de tiro (arco previsto con `computeLaunch`), cursor y botón de activa están dibujados en el canvas 2D de `world.js`. Opción prevista: una capa 2D encima del canvas de Three.js, proyectando con la misma cámara. El marcador y los menús ya son HTML.
8. **Repetición en cámara lenta.** `replay.js` guarda `ball`, `players` e `ice` de los últimos ~100 cuadros; `render` reemplaza temporalmente `state.ball/players/ice` mientras reproduce. Hay que respetarlo.
9. **Retratos de los menús.** `renderPortrait` (en `players.js`) dibuja cada personaje en un `<canvas>` del menú con el mismo esqueleto 2D; seguirá usando el render 2D hasta la etapa 3.
10. **Efectos.** Hoy salen de `onGameEvent` y `updateFx` (`fx.js`): arena al botar, anillos, impactos, ondas en el cristal, vibración (`shake`), flash blanco, chispas de foco roto, rayos, lluvia, ráfagas, aves. La sacudida y el giro de la cancha de Atlas (`fx.view`) afectan también a la puntería.
11. **Sugerencia de convivencia.** Dejar `render2d` funcionando y elegir con un parámetro (`?render=2d`) mientras se desarrolla, para comparar. La etapa 2 no cambia ninguna regla ni valor de `core`; si algo necesita tocarlo, hay que avisarlo.
12. **Para validar un cambio en la lógica:** `npm run sim` detecta excepciones y valores inválidos. No compara contra el original (ese chequeo se hizo una vez y la lógica no debería cambiar).

## Pendiente de etapas siguientes

- Etapa 3: no existe la carpeta `assets/`. Hay que traer los modelos o buscar modelos libres con las animaciones necesarias (correr, guardia, golpe, remate, celebración).
- Etapa 4: GitHub Pages solo publica un sitio por repositorio; hay que decidir cómo publicar el build sin reemplazar el link actual.
