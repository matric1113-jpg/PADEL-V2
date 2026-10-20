# Notas de la migración a Vite + Three.js

Rama de trabajo: `threejs`. `main` (y el link de GitHub Pages) sigue mostrando la versión de un solo `index.html`.

## Cómo correr

```bash
npm install
npm run dev           # servidor local en http://localhost:5173 (render 3D)
npm run build         # genera dist/ (base relativa: sirve en la raíz o en una subcarpeta)
npm run sim           # simulación sin pantalla con azar sembrado: npm run sim -- <cuadros> <semilla> <friendly|americano|run>
npm run test:camera   # prueba que la cámara 3D es igual a la 2D (ver etapa 2)
npm run test:hazards  # la guía de tiro predice el viento y la inclinación como la física (ver ajustes)
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
  game.js             Puntos y juegos, set, tienda 2v2, votación de mapa, torneo, compras, puestos/equipos, americano
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
  players.js          Jugadores: traduce el esqueleto de view/skeleton.js a órdenes para los personajes 3D (frameFor)
  players-simple.js   Figuras simples de respaldo (mientras cargan los modelos) y estela del golpe
  portraits.js        Retratos del menú: el mismo modelo, dibujado fuera de pantalla
  char/               Personajes animados (Quaternius): assets, regions, materials, pieces, clips, rig, character
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
  players.js          Palitos proyectados, sombras, retratos del menú (renderPortrait: respaldo del menú mientras cargan los modelos 3D)
  world.js            Pelota, red, marcas, frame completo, puntería con el mouse (2D)

assets/models/         Modelos y animaciones .glb (ver "Etapa 3")
visor.html, src/dev/    Visor de personajes y clips (solo en npm run dev)
scripts/simulate.mjs     Simulación de bots con solo `src/core` (amistoso, americano y torneo)
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

### Etapa 3 (personajes 3D animados): cómo funciona

- **Todos comparten un esqueleto** (65 huesos del rig universal). Cuerpo Superhero hombre para todos y Superhero mujer para Tía Gladys, Tía Nena y La Capitana (`FEMALE` en `char/character.js`). Sirven las mismas animaciones porque los huesos se llaman igual. El cuerpo *Regular* no viene en el pack gratuito (ver arriba), así que "fuertes vs. el resto" se resuelve solo con el físico de LOOKS.
- **Quién hace qué.** `view/skeleton.js` sigue decidiendo cada cuadro la pose (hacia dónde mira, carga, golpe, celebración, saltos) y ahora devuelve también `rig` (hacia dónde mira, giro del tronco, objetivos de las manos, medidas de la pala). `render3d/players.js` (`frameFor`) lo traduce al mundo de Three.js y lo entrega a `char/character.js`, que mezcla clips y ejecuta las órdenes de brazos con IK. Las animaciones son **solo visuales**: el golpe ocurre cuando lo decide la física (`src/core` no se tocó).
- **Archivos.** `char/assets.js` (carga), `char/regions.js` (zonas de la ropa), `char/materials.js` (shader del cuerpo), `char/pieces.js` (pelo propio, lentes, pala...), `char/clips.js` (mapeo de clips), `char/rig.js` (IK, giro del tronco, dedos), `char/character.js` (el personaje), `render3d/portraits.js` (retratos), `render3d/players-simple.js` (figuras simples de respaldo mientras cargan los modelos). `visor.html` (solo en `npm run dev`) muestra un personaje con el módulo real: `/visor.html?look=german&speed=5&celeb=flex&stun=1&burn=1&swing=1&hats=2`; sin `look` es el visor de clips (`?sheet=Idle_Loop,Jog_Fwd_Loop&t=0.3&view=side`).
- **Cámara de cerca (solo dev).** En la consola: `__padel.r3d.closeup = { slot: 0, dist: 120, height: 45, angle: 0.6, ty: 38, fov: 30 }`; `__padel.r3d.closeup = null` la quita.

**Mapeo de estados del juego a animaciones** (`char/clips.js`; las mezclas son pesos que se suavizan cada cuadro)

| Estado del juego | Piernas y tronco | Brazos |
|---|---|---|
| Guardia (parado, esperando) | `Idle_Loop` 68 % + `Crouch_Idle_Loop` 32 % (55 % cargando) | pala al frente, IK hacia la mano del esqueleto |
| Correr | `Walk_Loop` → `Jog_Fwd_Loop` → `Sprint_Loop` según la velocidad (m/s del modelo: 1 / 5,4 / 8,3, medidos en la versión con root motion); la velocidad de reproducción sigue a la del jugador; el cuerpo gira hacia donde corre (al cargar o golpear mira donde apunta) | brazo libre: mezcla clip/IK |
| Cargar mientras corre | + `Crouch_Fwd_Loop` 30 % | IK |
| Drive, globo, saque | piernas según lo anterior; el tronco gira (`rig.twist`) y se inclina | **procedural (falta en el pack):** IK de dos huesos hacia la mano que calcula el esqueleto en cada cuadro (mismo gesto y tiempos que en el 2D) y la mano agarra la pala |
| Remate | `Jump_Start` (piernas recogidas) hasta 70 % en el golpe + saltito de 16 cm + inclinación hacia atrás | IK |
| Celebración "guata" (Germán) | `Dance_Loop` 75 % + `Idle_Loop` | manos a la guata (IK) |
| "mullet" (Maxi) | idem | una mano a la nuca, otra a la cintura |
| "bíceps" (Álvaro) | idem | brazos en alto doblados (IK) |
| "jockey" (Fernando) | idem | una mano en el jockey |
| "salto" (Matías) | `Jump_Loop` 70 % + `Dance_Loop` 25 % + saltos del esqueleto | un brazo arriba |
| "paz" (Joaquín) | idem | mano arriba con los dedos en V (se cierran anular, meñique y pulgar) |
| "rayo" (Zeus) | idem | ambos brazos arriba |
| Paralizado por rayo | `Hit_Head` una vez al empezar + `Idle_Loop` 45 % / `Crouch_Idle_Loop` 55 % | **procedural:** brazos caídos con la pala colgando, cabeza y tronco caídos, balanceo; las estrellitas siguen siendo la capa 2D |
| Quemadura (pies) | `Hit_Chest` una vez al empezar + `Dance_Loop` al doble de velocidad 75 % + saltitos | IK |
| Clon de sombra | el mismo personaje con un material morado translúcido propio | igual |

Clips del pack sin usar (quedaron fuera de `animaciones.glb`): sentado, nado, armas, hechizos, empujar, rodar, muerte, interactuar, etc.

**Físico desde LOOKS** (`Character.update`): alto = escala vertical de la raíz (`Kz`, igual que el esqueleto); ancho = escala lateral de toda la figura (`1 + (w − 1) · 0,9`); brazos y piernas = grosor de los huesos (`upperarm`, `thigh`; mano y pie compensan para no deformarse); guata = esfera del color de la camiseta delante del abdomen (visible desde `belly` > 1,1). El "gordo", la pala enorme, "estirón" y "fuerza" usan los mismos números del esqueleto.

**Ropa:** el cuerpo trae la ropa interior pintada en la textura, así que el shader (`materials.js`) recolorea por zonas: piel (color del LOOK sobre el detalle de la textura), camiseta con mangas cortas o musculosa (`tank`), short (zonas grises de la textura + muslo), calcetines (altos o bajos, claros u oscuros), zapatillas (doradas con la mejora) y muñequeras (la derecha con el color del LOOK o naranja con "remate", la izquierda con el color del equipo). Las zonas salen de los pesos de huesos (`regions.js`, una vez por cuerpo).

**Piezas sobre los huesos** (se pegan a `Head`, `spine_01` o `hand_r` en pose de descanso): pelo `short`/`side`/`slick`/`cap`/`bun`/barba del pack; afro, rulos, puntas, cola de caballo y cola de mullet propios; bigote, lentes, cintillo, visera, jockey (también al revés), sombreros apilados de la tienda; la pala con sus 3 formas (redonda, lágrima, diamante), que sigue la orientación y medidas del esqueleto pero va pegada a la mano real del modelo.

**Rendimiento (medición en el panel de vista previa de Claude Code, sin GPU dedicada, así que sirve para comparar, no como valor absoluto):** 4 jugadores suman unas 160 llamadas de dibujo (de 88 a 250 en total) y unos 5,5 ms de GPU por cuadro, sobre todo las sombras de los 2 focos; `Players.update` cuesta ~0,9 ms de CPU por cuadro. Ojos y cejas son piezas rígidas (ahorran dos esqueletos por personaje) y los detalles chicos no proyectan sombra. Si hiciera falta más: fusionar las piezas de la pala, bajar el mapa de sombras o quitar la sombra de los clones.

### Ajustes de jugabilidad (después de la etapa 3)

Cada uno en su commit y con constantes con nombre en `src/core/constants.js`.

- **Rebote en el cristal (`GLASS_VZ_K` = 0,87).** La velocidad vertical mínima forzada tras tocar el cristal baja un 13 %: 2,4 → 2,09 (umbral 2,0 → 1,74) y, en remates contra el fondo, 3,6 → 3,13. Simulación de bots, modo amistoso, 12 semillas × 300.000 cuadros, antes → después: puntos 4131 → 3972; doble bote 1393 (33,7 %) → 1378 (34,7 %); por 3: 280 (6,8 %) → 260 (6,5 %); por 4: 402 (9,7 %) → 447 (11,3 %). Los puntos por 3 y por 4 siguen apareciendo y el doble bote queda dentro del ruido (la simulación diverge mucho entre ejecuciones; por eso se compararon porcentajes sobre muchas semillas).
- **Mapa En altura: viento (`GUST_*`).** Ráfagas de 0,035-0,055 por cuadro (antes 0,014-0,020), de 4 s (antes 3 s), con subida y bajada suaves, más seguidas, y que además arrastran a los jugadores (`GUST_PLAYER_PUSH`). A la vista: la lluvia se tumba con el viento y se vuelve más densa y rápida (`RAIN_WIND` en `view/fx.js`) y aparecen rachas largas y brillantes en la capa 2D (`drawWindStreaks`, `render3d/overlay.js`). `gustForce(ahead)` (en `core/state.js`) es la fuerza del viento dentro de `ahead` cuadros: la usan la física y las dos guías de tiro (`view/hud.js`: arco y bote previsto), así que la guía sigue prediciendo el desvío.
- **Mapa Hombros de Atlas: inclinación (`TILT_*`).** Giro de cámara 0,03 → 0,1 rad y desplazamiento 10 → 34 px; jugadores arrastrados 0,5 → 1,5 por cuadro y pelota con aceleración 0,011 → 0,03; pausa entre inclinaciones 360-660 cuadros. `tiltEase(ahead)` (`core/state.js`) la hace subir y bajar suave y la comparten la cámara (`view/frame.js`), la física y las guías de tiro (que ahora también predicen la inclinación). Se comprobó que el apuntado con el mouse sigue correcto con la inclinación al máximo: `npm run test:camera` (69.728 comprobaciones, error 1e-12, con el giro máximo en los dos sentidos y a medias) y a mano en el navegador (el cursor coincide con el mouse).
- `npm run test:hazards` integra la trayectoria igual que las guías y la compara con `stepPhysics` con viento y con inclinación: error 0 en 84 trayectorias.

### Partido amistoso a 2 sets y podio

- **Sets.** Ganar un set (6 juegos, tie-break en 6-6) ya no termina el partido: se suma a `state.sets` (puntos dorados junto al nombre en el marcador), se guarda en `state.setHistory`, hay un banner y la celebración, y `goToScreen('nextset')` llama a `beginSet()`: marcador a cero, dinero, compras, activas y sombreros reiniciados, tienda de $700 y votación de mapa como al inicio (`state.vote.first`). Gana quien llegue primero a `SETS_TO_WIN` (2). El torneo de jefes no cambia.
- **Estado.** Lo único nuevo en `state` es `setHistory` (juegos de cada set terminado) y las pantallas `'podium'` y `'matchover'` (reemplazan a `'setover'`); `state.result` lleva `match: true` cuando el partido está decidido. El anfitrión cuenta la cinemática con `rt.podiumT` (no viaja por la red) hasta `PODIUM_FRAMES` (660 = 11 s) y pasa a `'matchover'`. Los invitados lo ven igual porque todo sale de `state` (probado con dos pestañas: set nuevo con tienda de $700, podio y resultado; el invitado mide el tiempo del podio con su propio reloj de dibujo).
- **Podio** (`render3d/podium.js`, `render3d/index.js` → `renderStage`). Cámara en perspectiva propia que parte en diagonal desde arriba y se acerca; ganadores en el escalón alto con medalla de oro (`makeMedal` en `char/pieces.js`) y la celebración de cada personaje (`CELEB_KIND`); perdedores en los escalones bajos llorando. Quaternius no trae una animación de tristeza, así que el llanto es procedural en `Character.update` (`f.cry`): cabeza y tronco caídos, manos a los ojos con IK, sollozos y lágrimas como partículas (`Players.emitTears`). Confeti, un foco sobre el podio y fundido desde negro. En `'matchover'` el podio sube en el cuadro para dejar sitio al panel (`.overlay.matchover`) con el resultado y "Jugar otra vez" (solo el anfitrión) o "Volver al menú". Solo en desarrollo: `__padel.r3d.stageT = 420` fija el instante de la cinemática.
- **Simulación** (`npm run sim -- 800000 1 friendly`). Con azar sembrado (misma semilla, mismo resultado). Recorre los 6 mapas y, en el modo amistoso, comprueba el flujo: cada set nuevo parte con marcador en cero, $700 en total (dinero + mejoras + activa) y sin activas ni sombreros; los sets no se pierden al abrir el set nuevo; el partido termina solo con un ganador a 2 sets, con historial coherente; el podio solo aparece con 2 sets de un equipo. 3 semillas × 800.000 cuadros: 21 partidos, 32 sets nuevos, sin errores.

### Equipos en la sala, modo Americano, saque automático, Marco y voces del menú

- **Puestos y equipos.** Cada jugador tiene un id fijo (`uid`: `u0` es el anfitrión, `u1`-`u3` los otros puestos) y el equipo sale del puesto: `state.players[0..1]` es el azul y `[2..3]` el rojo, como siempre. Cambiar a alguien de equipo es reordenar `state.players` (`seatPlayers(uids)` en `core/game.js`), así la física, los bots, la cámara y el render no cambiaron. La red y los inputs ya no usan el puesto sino el `uid`: `rt.connections[uid]`, `remoteInputs[uid]` (`inputOf(p)`), `rt.myUid`; el invitado recibe su `uid` en `welcome` y `syncMySlot()` recalcula `rt.mySlot` cada vez que llega el estado. `resetSeats()` vuelve al orden `u0..u3` al preparar una partida y al salir de una sala.
- **Equipos en la sala (amistoso).** El anfitrión toca "Cambiar de equipo" en un jugador y luego "Intercambiar" en uno del otro equipo (`swapSeats`, solo en `'lobby'` y modo `'friendly'`): siempre quedan 2 por lado. Los invitados lo ven al instante porque viene en `state.players`, y la cámara de cada uno sigue a su equipo (`beginFrame` compara `me.team`). El bot que juega al lado del anfitrión sigue con `TEAMMATE_SKILL`. En el torneo no hay botones ni cambia nada. Si un invitado elige el personaje de un bot, el bot toma otro libre (`fixBotLooks`; los jefes no se tocan).
- **Americano** (`state.mode = 'americano'`, botón en el menú). 4 jugadores (bots en los puestos vacíos) y 3 sets con parejas A+B vs C+D, A+C vs B+D, A+D vs B+C (`AMERICANO_PAIRS`; A-D es el orden de la sala). Cada set es al primero en llegar a `AMERICANO_GAMES_TO_WIN` (4) juegos, sin tie-break, y empieza como un set del amistoso (`beginSet`: tienda de $700, compras y activas a cero, votación de mapa; tienda también después del juego 2 y luego cada 3). `state.amer = { set, order, pts, against, history }`: cada juego ganado suma 1 a `pts` de los dos de la pareja y 1 a `against` de los otros dos. `americanoRanking()` ordena por juegos ganados y luego por menos en contra; si sigue igual, comparten el puesto (1, 1, 3, 4). El marcador muestra las parejas del set y la tabla (`#sb-amer`, `ui/hud.js`). Al terminar el set 3, `state.result = { americano: true, ranking }` y podio: escalones 1 (oro), 2 (plata) y 3 (bronce) con medalla del color (`setMedalKind`), los empatados comparten escalón, el 4.º en el suelo; celebra solo el 1.º lugar, el resto llora. La cámara del podio termina un poco más lejos (`wide`). La pantalla de resultado muestra la tabla con medallas y los 3 sets. "Jugar otra vez" conserva quién es A, B, C y D.
- **Saque que salía solo.** La física guarda el último `releaseSeq` (soltar el clic) de cada jugador, pero no lo leía durante la pausa entre puntos ni fuera de `'play'`. Un clic soltado en ese rato (por ejemplo, al terminar el punto o al pasar por la tienda) quedaba pendiente, y al volver al saque contaba como golpe: quien sacaba lanzaba la pelota al tocar "Listo". Ahora `discardPendingSwings()` (`core/physics.js`) descarta esos clics y la carga mientras no se está jugando un punto. `npm run sim` lo prueba (`testStaleRelease`): sin el arreglo falla.
- **Marco.** Personaje nuevo elegible (`LOOKS.marco`): piel oscura, pelado, polera verde agua, pala diamante, "Todoterreno" (velocidad 0,45). Frases propias en `TALK.byLook`.
- **Voces del menú.** Al entrar el cursor a la tarjeta de un personaje aparece un globo con su frase y la dice la voz del navegador (Web Speech API, voz en español si hay; `HELLO` en `core/data.js` con el texto, la pronunciación `say` cuando cambia y el tono/velocidad de cada uno). Chrome solo deja hablar después de que el usuario tocó la página una vez; antes, solo se ve el globo.
- **Pruebas.** `npm run sim` ahora corre amistoso (con el anfitrión cambiado al equipo rojo desde la sala), americano y torneo. En el americano comprueba las parejas de cada set, que cada set termina en 4, que cada jugador juega todos los juegos (`pts + against`), que sus juegos ganados coinciden con el historial y la tabla final; además prueba fija de los desempates. 2 semillas × 600.000 cuadros de americano: 21 americanos completos sin errores. Con dos pestañas: sala de amistoso con el anfitrión pasado al rojo (el invitado vio el cambio al instante, sacó y se movió con su input desde el puesto 1, cada cámara del lado de su equipo) y sala de americano (el invitado cambió de puesto y de equipo en cada set, vio el podio con su medalla de bronce compartida y la tabla final).

### Etapa 4: publicación en /beta/ de GitHub Pages

- **Resultado buscado.** `https://matric1113-jpg.github.io/PADEL-V2/` sigue mostrando exactamente el `index.html` de `main`, y `https://matric1113-jpg.github.io/PADEL-V2/beta/` muestra el 3D de esta rama. GitHub Pages publica un solo sitio por repositorio, por eso se arma uno con las dos cosas.
- **Cómo funciona.** `.github/workflows/pages.yml` ("Publicar en Pages") se ejecuta con cada push a `threejs` y a mano (`workflow_dispatch`). Hace checkout de `threejs`, `npm ci` con Node 24.22.0 (la versión del PC de desarrollo) y `npm run build -- --base=/PADEL-V2/beta/`. Arma `_site/`: el build en `_site/beta/` y, en la raíz, el `index.html` de `origin/main` copiado tal cual (`git show origin/main:index.html`), más `.nojekyll`. Lo sube con `upload-pages-artifact` y `deploy-pages`. `vite.config.js` conserva `base: './'` (sirve en `npm run dev` y en cualquier subcarpeta); la ruta absoluta solo la fuerza la Action.
- **Prefijo de sala.** La beta usa `padel2v2-beta-` (`ROOM_PREFIX` en `src/net/network.js`; antes y en `main`: `padel2v2-pro-`). El estado que viaja por la red es distinto entre las dos versiones, así que alguien en la versión vieja no puede entrar a una sala de la beta (ni al revés): buscaría un id que no existe.
- **Qué pasa con los cambios futuros en `main`.** El workflow vive solo en `threejs` (no se tocó `main`). Un push a `main` **no** dispara la Action, así que la raíz no se republica hasta el próximo push a `threejs` o hasta lanzar el workflow a mano. Si se cambia `main`, hay que relanzarlo para que la raíz se actualice. Al fusionar `threejs` en `main`: poner `on.push.branches: [main]`, quitar `ref: threejs` del checkout, y decidir si `/beta/` sigue existiendo o el 3D pasa a la raíz (en ese caso, cambiar el `--base` y volver al prefijo de sala que se quiera). El workflow viaja con la fusión.
- **Pasos en Settings de GitHub** (los hace el dueño del repositorio, no la Action):
  1. Settings → Environments → `github-pages` → *Deployment branches and tags*: si dice "Selected branches and tags", agregar la regla `threejs` (Add deployment branch or tag); si dice "No restriction", no hay nada que hacer. Sin esto el deploy falla con "branch not allowed".
  2. Settings → Pages → *Build and deployment* → *Source*: cambiar "Deploy from a branch" por **GitHub Actions** (no tiene botón de guardar).
  3. Actions → *Publicar en Pages* → *Run workflow* (rama `threejs`), o *Re-run all jobs* si la ejecución del push salió en rojo porque Pages aún estaba en "branch". Entre el paso 2 y el 3 el link actual puede quedar sin servir unos minutos.
- **Cómo comprobar que ambos links funcionan.** (1) La Action termina en verde. (2) La raíz es idéntica a `main`: `curl -s https://matric1113-jpg.github.io/PADEL-V2/ | sha256sum` debe dar lo mismo que `git show origin/main:index.html | sha256sum`. (3) `/beta/` carga los retratos 3D y, en F12 → Network, ningún `.glb` da 404 (`favicon.ico` sí: no existe, tampoco en `main`). (4) Crear una sala en la beta (el id empieza por `padel2v2-beta-`) y comprobar que la versión vieja no la encuentra con ese código.
- **Prueba local previa a subir.** `MSYS_NO_PATHCONV=1 npm run build -- --base=/PADEL-V2/beta/` y servir `dist/` bajo `/PADEL-V2/beta/`: los 4 `.glb`, el JS y el CSS respondieron 200. En Git Bash de Windows hay que anteponer `MSYS_NO_PATHCONV=1`; si no, convierte `/PADEL-V2/beta/` en una ruta de Windows (en la Action, que corre en Ubuntu, no pasa).

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
- PeerJS viene de npm (misma versión 1.5.2, prefijo de sala `padel2v2-beta-` (`ROOM_PREFIX` en `src/net/network.js`; la versión de main usa `padel2v2-pro-`, así que no pueden entrar a salas de la otra), mismos servidores STUN/TURN). Las fuentes siguen cargando desde Google Fonts.
- `vite.config.js` usa `base: './'` para que el build funcione en una subcarpeta de GitHub Pages.
- `.claude/launch.json` es solo para el panel de vista previa de Claude Code.

## Pendientes después de la etapa 4

1. **Borrar `render2d/`.** Todavía se usa en dos lugares: `?render=2d` (para comparar) y el retrato 2D de respaldo en `render3d/portraits.js` mientras cargan los modelos. Al borrarlo hay que quitar `R2D` de `src/renderer.js`, la opción `?render=2d` y ese respaldo (por ejemplo esperando `loadCharacterAssets()` antes de mostrar el menú). `view/ctx.js` debe quedar: es el canvas del HUD. `render3d/players-simple.js` (figuras de respaldo) se puede borrar igual si se espera a los modelos antes de empezar.
2. **HUD.** El nombre y las barras siguen anclados a `max(98, built.pf.pose.z + 58)` (`view/hud.js`): el modelo mide lo mismo que el esqueleto de palitos (~76 unidades), así que no hizo falta cambiarlo.
3. **Pendientes de pulido de los personajes.** Los dedos se cierran con un giro fijo por eje (probado a ojo); el agarre de la pala puede verse algo rígido. Los peinados `afro`, `curly` y `spiky` son geometría propia, más simples que los del pack. Se puede añadir un cuerpo *Regular* si se compra el pack completo (misma carpeta `assets/models/`, mismos huesos).

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
- Para validar un cambio en la lógica: `npm run sim` detecta excepciones y valores inválidos, comprueba el flujo de sets y da la tabla de motivos de punto (sirve para comparar un ajuste antes y después sobre varias semillas). No compara contra el original (ese chequeo se hizo una vez; los ajustes de jugabilidad posteriores cambiaron la lógica a propósito).
