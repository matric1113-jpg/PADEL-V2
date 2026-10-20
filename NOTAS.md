# Notas de la migración a Vite + Three.js

Rama de trabajo: `threejs`. `main` (y el link de GitHub Pages) sigue mostrando la versión de un solo `index.html`.

## Cómo correr

```bash
npm install
npm run dev           # servidor local en http://localhost:5173 (render 3D)
npm run build         # genera dist/ (base relativa: sirve en la raíz o en una subcarpeta)
npm run sim           # simulación sin pantalla (ver abajo)
npm run test:camera   # prueba que la cámara 3D es igual a la 2D (ver etapa 2)
```

- `http://localhost:5173/` muestra el render 3D (Three.js). `http://localhost:5173/?render=2d` muestra el render Canvas 2D anterior, para comparar mientras dure la migración.
- Para probar el online hacen falta dos pestañas: en una "Crear sala", en la otra escribir el código en "Unirse a una sala".
- Si una pestaña queda en segundo plano, el navegador pausa su dibujo (`requestAnimationFrame`); la física del anfitrión sigue por el Worker, pero conviene tener la pestaña del anfitrión al frente.
- Solo en `npm run dev`, `window.__padel` da acceso desde la consola a `state`, `rt`, `localInput`, las funciones de `game`, `fx`, la cámara y la escena 3D (`r3d`). Sirve para revisar mapas y efectos sin jugar, por ejemplo `__padel.game.setMap('atlas')` o `__padel.state.lights[0] = false`. No va en el build.

## Estructura

```
index.html            Entrada de Vite: solo el marcado (canvas, marcador, panel, teclas)
src/style.css         Todo el CSS (antes inline)
src/main.js           Bucle de juego (física a 60 Hz fijos + dibujo), conecta los hooks, arranque
src/dom.js            Referencias al canvas y su contenedor
src/renderer.js       Elige el render activo: 3D por defecto, 2D con ?render=2d

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
src/input/input.js    Teclado y mouse -> localInput (la puntería la calcula el render activo)
src/audio/audio.js    Web Audio: efectos y música
src/ui/hud.js         Marcador HTML
src/ui/menu.js        Menús y pantallas HTML (overlay), retratos

src/view/             LO QUE COMPARTEN LOS DOS RENDERS (no depende de Canvas 2D ni de Three.js)
  camera.js           Cámara diagonal: makeCam, fitCam, P (mundo→pantalla), unprojectGround, CAMS
  frame.js            Comienzo de cada cuadro: cámara por equipo, inclinación de Atlas, cuadro de repetición
  fx.js               Efectos (estado visual) y detección de eventos del estado: detectStateEvents, onGameEvent
  skeleton.js         Esqueleto de los jugadores: poses y articulaciones (correr, cargar, golpear, celebrar)
  hud.js              HUD en el canvas 2D: nombres, barras, globos, guía de tiro, cursor, banner, activa, flash
  ctx.js, theme.js    Contexto 2D del canvas #game, fuentes y colores

src/render3d/         RENDER 3D (Three.js), el que se usa por defecto
  index.js            Arma la escena, dibuja cada cuadro, HUD encima, puntería con el mouse
  camera.js           Cámara Three.js con los mismos números que view/camera.js (+ screenToGround)
  court.js            Césped, alrededores, paredes de cristal y malla, postes, puerta, red
  lights.js           Los 2 focos (SpotLight con sombra), luz ambiente y mapa de entorno
  maps.js             Cielo, telón de fondo, público y utilería de cada mapa
  backdrop.js         Telón de fondo pintado (mismo dibujo que el 2D)
  crowd.js            Público 3D
  players.js          Jugadores: figuras simples sobre el esqueleto de view/skeleton.js
  ball.js             Pelota, estela y guía de altura
  ground.js           Marcas en el suelo (aros, cuadro de saque, alcance, blanco de tiro, hielo, brasas, rayos)
  markers.js          Shader de esas marcas
  effects.js          Partículas, chispas, lluvia, ráfagas, aves, rayos, grietas, impactos, ondas en el cristal
  overlay.js          Viñeta y estrellitas del jugador paralizado (capa 2D)
  style.js            Colores por mapa (césped, pasillo, cielo, luz)
  noise.js, merge.js  Ruido para texturas; fusión de mallas fijas

src/render2d/         RENDER 2D ANTERIOR (Canvas). Solo para comparar con ?render=2d; se borra al terminar la migración
  court.js            Suelo, paredes, focos, fondo, público, utilería
  layers.js           Capas estáticas en caché y tamaño del canvas
  players.js          Palitos proyectados, sombras, retratos del menú (renderPortrait, lo usa el menú también en 3D)
  world.js            Pelota, red, marcas, frame completo, puntería con el mouse (2D)

scripts/simulate.mjs     Simulación de bots con solo `src/core`
scripts/test-camera.mjs  Prueba de la cámara 3D contra la 2D
```

## Qué quedó hecho

### Etapa 1

- El juego funciona igual que antes: torneo de 6 jefes (con Zeus), 6 mapas, activas, tienda y votación en el 2v2, repetición, controles y online.
- La lógica quedó separada del render y de la interfaz. Se comprobó con una búsqueda de imports: `src/core` no importa nada fuera de `core` ni usa `document`/`window`.
- Se probó en el navegador: menú, torneo, saque, movimiento, sprint, sala online con dos pestañas (el input del invitado llega al anfitrión y el estado del anfitrión al invitado).
- Se comprobó que la lógica es idéntica a la original: se ejecutó el `<script>` original de `index.html` en un entorno simulado y los módulos nuevos con el mismo generador de azar, y se compararon posición de pelota y jugadores, marcador, pantalla, mapa y dinero. Resultado idéntico en 2 partidos amistosos y 2 torneos de 150.000 cuadros y en cada uno de los 6 jefes por separado. Ese script de comparación era de un solo uso y no está en el repo.

### Etapa 2 (cancha en Three.js)

- **Cámara idéntica.** `render3d/camera.js` arma la cámara de Three.js con los mismos números de `fitCam` (posición, ejes, foco F y centro cx, cy, con una proyección descentrada hecha a mano) para los dos equipos, la cámara de repetición y el giro/sacudida de Atlas. `npm run test:camera` hace 52.296 comprobaciones: para puntos del suelo y para posiciones del mouse en toda la pantalla, la conversión pantalla→suelo 3D devuelve el mismo punto que `unprojectGround` (error máximo 1,6e-12 unidades; 1 m = 40 unidades), y los puntos con altura caen en el mismo píxel que `P()`. Además se probó en el navegador: con el mouse sobre el juego, la puntería 3D y la 2D difieren en menos de 1e-12, también durante la inclinación de Atlas, y un saque apuntado con el mouse salió hacia el punto buscado.
- **Iluminación.** Los 2 focos de `LIGHTS` son `SpotLight` con sombra (mapas de 2048). Si la pelota rompe uno, su intensidad baja a 0 y se van su luz, su sombra, su brillo y su haz; si se rompen los dos, la cancha queda solo con luz ambiente. El foco del lado de la cámara no se dibuja (como en el 2D), pero su luz está.
- **Materiales.** Césped con arena, zonas gastadas, rollos, grano y líneas (textura generada por mapa con el mismo ruido del 2D); cristal con transmisión, reflejo del entorno y brillos; malla metálica con textura de alambre que proyecta sombra; postes y marcos; puerta lateral con una hoja entreabierta (solo estética, no cambia la física); red con paño, faja y postes, que se deforma cuando la golpea la pelota.
- **Los 6 mapas.** Cada uno con su cielo, piso exterior, telón de fondo (mismo dibujo y semilla que el 2D), público 3D y utilería: Chile (cordillera y aves), Brasil (playa, mar, palmeras, quitasoles, banderines), China (azotea, rascacielos, pagoda, farolillos, borde rojo), En altura (roca, peñascos, lluvia y ráfagas), Atlas (plataforma flotante sobre nubes, titán, ángeles con aureola que flotan, inclinación y rayos), Cráter (lava que brilla, volcán, calaveras y diablos, brasas).
- **Efectos.** Rayos con aviso (aro que sigue al jugador y se fija, nube de tormenta, descarga en zigzag con destello de luz real), hielo con grietas, clon morado translúcido, flash, sacudida, arena al botar y al hacer sprint, chispas (foco roto, Zeus, quemaduras), impactos de golpe, ondas en el cristal y estela de la pelota (naranja en el remate).
- **HUD.** Nombres, barras de sprint/activa/carga, globos de texto, guía de tiro, cursor, banner, botón de activa, franjas de la repetición y flash se dibujan en el canvas 2D `#game`, que queda encima del canvas WebGL `#game3d`, con la misma `P()` y la misma transformación de pantalla. Las marcas del suelo (aros, cuadro de saque, alcance, blanco de tiro, bote previsto) pasaron al 3D para que queden debajo de los jugadores.
- **Jugadores.** Figuras 3D simples con sus colores, pelo y accesorios, pala y sombreros, sobre el mismo esqueleto de poses del 2D (corren, cargan, golpean, celebran). También el "gordo", la pala enorme, la nube de Zeus y las estrellitas del paralizado.
- **Rendimiento.** Unas 100 llamadas de dibujo por cuadro (las piezas fijas se fusionan por material y los jugadores y el público son mallas instanciadas); unos 4 ms por cuadro en la máquina de prueba.
- **Sin cambios en la lógica.** `src/core` y `src/net` no se tocaron en esta etapa (`git diff` vacío). `npm run sim` sigue sin errores.

### Etapa 3 (personajes 3D animados): assets y créditos

Modelos y animaciones de **Quaternius**, licencia **CC0 1.0** (dominio público, sin obligación de atribuir; se deja el crédito igual): https://quaternius.com
- **Universal Base Characters [Standard]**: cuerpos Superhero (hombre y mujer), cejas, ojos y peinados. La versión gratuita no trae el cuerpo *Regular* (solo la versión de pago `Source`), así que todos los personajes usan Superhero.
- **Universal Animation Library [Standard]**: 43 clips sobre el rig universal (65 huesos, mismos nombres que los cuerpos); se usan 13. No trae ningún golpe de tenis o pádel.

Los zips originales están en `assets/` pero **no se suben** (`assets/*.zip` está en `.gitignore`). En el repo solo están los `.glb` ya procesados en `assets/models/` (unos 2 MB en total):

| Archivo | Contenido | Cómo se hizo desde el pack |
|---|---|---|
| `cuerpo_hombre.glb`, `cuerpo_mujer.glb` | cuerpo + ojos + cejas + esqueleto | `Superhero_*_FullBody.gltf` a un solo `.glb`; textura de piel clara a 1024 px (WebP), mapa de normales a 1024 px; sin mapa de rugosidad ni atributos que no se usan |
| `pelo.glb` | Buzzed, SimpleParted, Beard, Buns, BuzzedFemale, Long | versión *Rigged to Head Bone* convertida a mallas estáticas (ya alineadas con la cabeza en pose de descanso); texturas a 512 px |
| `animaciones.glb` | 13 clips, sin la malla del maniquí | `UAL1_Standard.glb` (sin root motion), solo rotaciones de cada hueso y la traslación de la cadera; claves redundantes eliminadas |

Los `Superhero_*_FullBody.gltf` del pack referencian dos texturas que no vienen en esa carpeta (`T_Eye_Normal_png.png`, `T_Hair_1_Normal_png.png`); al convertir se usaron las de `Textures/`.

## Decisiones

**Cómo se hizo el corte (etapa 1).** Se partió el `<script>` con un script de un solo uso que usa un parser (acorn) y análisis de ámbitos, no a mano ni con regex. Así los imports/exports salen de las referencias reales y no se pierde ninguna. Ese script tampoco está en el repo.

**Variables sueltas -> `rt`.** Los `let` globales que se reasignan desde varios archivos (`isHost`, `mySlot`, `connections`, `hostConn`, `peer`, `gotHostState`, `joinTimer`, `localChargeFrames`, `lastPlayedSoundSeq`, `netMsg`, `uiMenuOpen`, `overlayKey`) pasaron a propiedades del objeto `rt` (`core/state.js`). Un módulo no puede reasignar una variable importada. `rt` no viaja por la red; `state` sí (el anfitrión lo envía completo y los invitados hacen `Object.assign(state, ...)`, así que su forma no se debe cambiar).

**Eventos entre la lógica y el render.** La lógica no llama a nada de afuera: usa `hooks` (`core/events.js`).
- `hooks.sound(type)`: lo llama `emitSound` (anfitrión) y la red cuando un invitado recibe un `soundTrigger` nuevo. `main.js` lo conecta a `playSound` (audio) y `onGameEvent` (efectos visuales, `view/fx.js`).
- `hooks.scoreChanged()`: lo llama la lógica cuando cambia el marcador. `main.js` lo conecta a `updateScoreUI`.
- Además, el bucle de `main.js` llama cada cuadro a `syncHud`, `updateScoreUI` y `syncOverlay`.
- El estado visual se sincroniza a partir de `state`: `detectStateEvents` (en `view/fx.js`) compara contadores `seq` de `state` (repetición, celebración, texto, focos, rayos). Sirve igual en anfitrión e invitados y se debe conservar.

**La cámara 3D no es una PerspectiveCamera común.** `applyCam` escribe a mano la matriz de la cámara (columnas derecha, arriba, atrás con y↔z intercambiados: el mundo del juego es (x, y, z) con z hacia arriba y Three.js usa (x, altura, y)) y una proyección descentrada (`cx`, `cy` no están en el centro de la pantalla). El giro de Atlas y la sacudida se aplican después de la proyección, en coordenadas de pantalla, igual que `setWorldTransform` en el 2D. Nunca hay que llamar `updateProjectionMatrix()` sobre esas cámaras: borraría la proyección. Si se cambia algo de la cámara, correr `npm run test:camera`.

**La puntería en 3D** usa `screenToGround` con una cámara aparte (`aimCamera`): la de juego con el giro de Atlas pero sin la sacudida, que es lo que hacía el 2D.

**Unidades en 3D.** Una unidad de Three.js es una unidad de mundo (40 = 1 m). Lo que en `state` es altura física `z` se dibuja a `z * ZS` (la pelota a `z * ZS + BALL_R`), igual que en el 2D.

**HUD en una capa 2D encima.** Se reutiliza el HUD del 2D (`view/hud.js`) en vez de rehacerlo en 3D: queda nítido, es el mismo código para los dos renders y se proyecta con la misma cámara. Las marcas del suelo, en cambio, son 3D (un cuadrado con shader por marca, `render3d/markers.js`) para que los jugadores las tapen.

**Esqueleto compartido.** `view/skeleton.js` (antes dentro de `render2d/players.js`) calcula las articulaciones de cada jugador en coordenadas de mundo. El 2D las dibuja como palitos y el 3D como cilindros y esferas. Al tronco se le agregaron los datos 3D (`frame`) sin cambiar el dibujo 2D.

**Fondo como en el 2D.** La cámara de juego no ve el horizonte: el borde superior de la pantalla corta el suelo a unos 300-600 unidades detrás de la cancha. Por eso el paisaje es un telón vertical en `y = -175` con las alturas aplastadas ×0,42, exactamente como el 2D (`render3d/backdrop.js`), y delante va el público y la utilería en 3D.

**Focos rotos sin tirones.** Apagar un foco pone su intensidad en 0 en vez de quitar la luz o su sombra; así Three.js no recompila los shaders en medio del punto.

**Otras.**
- El 2v2 y el torneo comparten la misma lógica; solo cambia `state.mode`.
- PeerJS viene de npm (misma versión 1.5.2, mismo prefijo de sala `padel2v2-pro-`, mismos servidores STUN/TURN). Las fuentes siguen cargando desde Google Fonts.
- `vite.config.js` usa `base: './'` para que el build funcione en una subcarpeta de GitHub Pages.
- `.claude/launch.json` es solo para el panel de vista previa de Claude Code.

## Para tener presente en la etapa 3 (personajes 3D animados)

1. **Dónde va.** Reemplazar `render3d/players.js` (`Players.figure`). Lo demás no debería cambiar. `Players.update` devuelve los esqueletos del cuadro (`built`), que usa el HUD; hay que seguir devolviéndolos.
2. **De dónde salen las animaciones.** `view/skeleton.js` ya decide la pose de cada cuadro y se puede usar para elegir y mezclar clips: velocidad de carrera (`pf.vx`, `pf.vy`), carga (`built.charging`, `built.cr`, `built.lob`), tipo de golpe y su avance (`pf.swingKind` = drive/lob/smash/serve, `pf.swingT` de 0 a 13 cuadros), postura (`pf.pose.kind` = ready/drive/lob/smash/serve), celebración (`CELEB_KIND`, `fx.celeb`), salto (`built.jumpZ`) y la nube de Zeus (`built.cloud`). Clips necesarios: correr, guardia, golpe de drive, globo, remate, saque y una celebración por personaje (`CELEB_KIND`).
3. **Tamaños.** Escala horizontal `scaleOf(p)` y vertical `scaleOf(p) * look.body.h * (1 + 0.03 * estirón) * (gordo ? 1,2 : 1)`; el "gordo" además ensancha (`buildPlayerParts` cambia `look.body`). Un jugador mide unos 75-80 unidades de alto.
4. **HUD.** El nombre y las barras se anclan a `max(98, built.pf.pose.z + 58)` (subiendo con los sombreros) y el globo de texto un poco más arriba (`view/hud.js`). Si los modelos tienen otra altura, ajustar ahí.
5. **Clon de sombra.** Hoy es la misma figura con colores `SHADOW_LOOK_COLORS` en un material morado translúcido (`Players.ghost`). Con modelos, usar un material aparte para el clon (no compartir el del jugador).
6. **Sombras y luces.** Los jugadores deben tener `castShadow` para las sombras de los 2 focos. La sombra de contacto (disco oscuro bajo los pies) está en `render3d/ground.js`.
7. **Retratos del menú.** `renderPortrait` (en `render2d/players.js`) sigue dibujando los personajes del menú con los palitos 2D, también en el modo 3D. Con los modelos se pueden dibujar con Three.js en esos `<canvas>`; cuando ya no se use, se puede borrar `render2d/` entero.
8. **Assets.** No existe la carpeta `assets/`. Hay que traer los modelos (o buscar modelos libres con las animaciones del punto 2). Con modelos glTF conviene un `GLTFLoader` y cargarlos antes de empezar el partido.
9. **Presupuesto.** Hoy son ~100 llamadas de dibujo y 2 mapas de sombra de 2048. Los personajes animados (skinning) no se pueden fusionar ni instanciar como ahora; 4 jugadores + 4 clones es poco, pero conviene vigilar `renderer.info.render.calls` (`__padel.r3d.renderer.info` en la consola).
10. **Cuando termine la migración** se borra `render2d/`, `R2D` en `src/renderer.js` y la opción `?render=2d`. `view/ctx.js` debe quedar: es el canvas del HUD.

## Rendimiento

- **Contador.** `?perf` en la URL (o la tecla F2) muestra FPS, ms por cuadro (media, p95, peor) y el tiempo de CPU de física, render e interfaz. Lo que tarda la GPU se ve en los ms por cuadro, no en "render".
- **Comparar con el original.** `npm run perf:original` genera `perf-original/index.html` (ignorado por git): el `index.html` del commit 0ac502c con el mismo contador. Con `npm run dev` se abre en `http://localhost:5173/perf-original/`.
- **Medición del 2026-10-19 (Radeon RX 6600 XT, pantalla de 180 Hz, Brasil, 4 bots).** Original y versión nueva en 2D: 180 FPS, 5,6 ms por cuadro, física ~0,005 ms por paso y render 2D ~0,8-1,7 ms de CPU, sin diferencias: la reorganización no introdujo una regresión. El suelo píxel a píxel del 2D no es el cuello de botella (solo se dibuja al cambiar de mapa, de foco o de cámara). Render 3D: ~1,7 ms de CPU por cuadro (0,7 ms los cuesta la transmisión del cristal y 0,3 ms las sombras).
- **Tirones con FPS altos.** La física avanza a 60 Hz fijos y se dibuja al ritmo de la pantalla sin interpolar (igual que en el original). A 144 o 165 Hz la física avanza alternando cada 2 y 3 cuadros, y el movimiento se ve a saltos aunque el contador marque FPS altos. Se arreglaría interpolando en el dibujo las posiciones entre los dos últimos pasos (no cambia la lógica, pero agrega hasta 1/60 s de retraso visual). Pendiente de decidir.
- Ojo al medir: si la ventana del navegador queda detrás de otra, el sistema baja los FPS (en una prueba bajó a 2 FPS incluso una página vacía). Medir con la ventana al frente.

## Pendientes y detalles conocidos

- Cambiar de mapa genera las texturas del suelo en el momento (~0,5 s). Pasa al empezar un partido o al votar mapa, no durante un punto. Si molesta, se puede hacer en un Worker con `OffscreenCanvas` o guardar las de los mapas ya vistos.
- El build avisa que el JavaScript pesa más de 500 kB (Three.js). No es un error; si se quiere, se puede separar Three.js en su propio archivo para que el navegador lo guarde en caché aparte.
- El brillo de los focos y la luz de cada mapa (`render3d/style.js`, `render3d/lights.js`) se pueden afinar a gusto.
- Etapa 4: GitHub Pages solo publica un sitio por repositorio; hay que decidir cómo publicar el build sin reemplazar el link actual.
- Para validar un cambio en la lógica: `npm run sim` detecta excepciones y valores inválidos. No compara contra el original (ese chequeo se hizo una vez y la lógica no debería cambiar).
