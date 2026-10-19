// Puntos de enlace entre la lógica del juego y todo lo demás (sonido, efectos visuales, marcador).
// La lógica solo llama a hooks.*; main.js decide a qué se conecta cada uno.
export const hooks = {
  sound(type) {},          // sonido + efectos visuales de un evento del juego
  scoreChanged() {}        // el marcador cambió: refrescar la interfaz
};
