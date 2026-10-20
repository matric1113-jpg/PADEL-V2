import { Color, MeshStandardMaterial, Vector3 } from 'three';

// ---------- Materiales de los personajes ----------
// Colores medios (lineales) de las texturas originales; sirven para recolorear conservando el detalle.
const SKIN_MEAN = { hombre: new Vector3(0.3885, 0.1774, 0.0831), mujer: new Vector3(0.4034, 0.1867, 0.0866) };
const HAIR_MEAN = 0.28;

const lin = hex => new Color(hex);   // three convierte hex (sRGB) a lineal con ColorManagement

// Cuerpo: textura de piel + camiseta, short, calcetines, zapatillas y muñequeras por zonas (ver regions.js).
// Las zonas grises de la textura original (la ropa interior) se reemplazan por el color del short.
export function makeBodyMaterial(src, gender) {
  const mat = new MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughness: 0.72, metalness: 0 });
  const u = {
    uSkin: { value: new Color() }, uSkinMean: { value: SKIN_MEAN[gender].clone() },
    uShirt: { value: new Color() }, uShirtLo: { value: new Color() }, uShorts: { value: new Color() },
    uSock: { value: new Color() }, uShoe: { value: new Color() }, uSole: { value: new Color() },
    uBandR: { value: new Color() }, uBandL: { value: new Color() },
    uTank: { value: 0 },            // 1 = musculosa (sin mangas ni hombros cubiertos)
    uSockStart: { value: 0.72 }     // dónde empieza el calcetín en la pantorrilla (0 rodilla .. 1 tobillo)
  };
  mat.userData.uniforms = u;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aReg0;\nattribute vec4 aReg1;\nvarying vec4 vReg0;\nvarying vec4 vReg1;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvReg0 = aReg0;\nvReg1 = aReg1;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vReg0;
varying vec4 vReg1;
uniform vec3 uSkin, uSkinMean, uShirt, uShirtLo, uShorts, uSock, uShoe, uSole, uBandR, uBandL;
uniform float uTank, uSockStart;`)
      .replace('#include <map_fragment>', `
vec3 baseTex = texture2D(map, vMapUv).rgb;
float lumTex = dot(baseTex, vec3(0.2126, 0.7152, 0.0722));
float lumMean = dot(uSkinMean, vec3(0.2126, 0.7152, 0.0722));
// Piel: el color del personaje con el detalle de luz y sombra de la textura
vec3 detail = mix(vec3(lumTex / lumMean), baseTex / uSkinMean, 0.35);
vec3 col = uSkin * detail;
// Zonas grises de la textura = ropa interior -> short
float mxc = max(baseTex.r, max(baseTex.g, baseTex.b));
float sat = (mxc - min(baseTex.r, min(baseTex.g, baseTex.b))) / max(mxc, 1e-3);
float undies = 1.0 - smoothstep(0.05, 0.14, sat);
float cloth = 0.0;
// Las zonas se interpolan entre vértices: se afila el borde para que las prendas no se difuminen
vec4 r0 = smoothstep(0.42, 0.58, vReg0);
vec4 r1 = vec4(vReg1.x, smoothstep(0.42, 0.58, vReg1.yzw));
float shortsK = max(undies, r0.w);
col = mix(col, uShorts * clamp(lumTex / 0.45, 0.55, 1.35), shortsK);
cloth = shortsK;
// Calcetines y zapatillas
float sock = vReg1.x >= 0.0 ? smoothstep(uSockStart - 0.04, uSockStart, vReg1.x) : 0.0;
col = mix(col, uSock * clamp(lumTex / 0.3, 0.7, 1.3), sock);
col = mix(col, uShoe * clamp(lumTex / 0.3, 0.7, 1.3), r1.y);
cloth = max(cloth, max(sock, r1.y));
// Muñequeras
float bandK = max(r1.z, r1.w);
col = mix(col, mix(uBandL, uBandR, step(r1.w, r1.z)), bandK);
cloth = max(cloth, bandK);
// Camiseta (musculosa: solo el tronco). El degradado oscurece hacia el borde de abajo.
float shirtK = max(r0.x, (1.0 - uTank) * max(r0.y, r0.z));
vec3 shirtCol = uShirt * clamp(lumTex / 0.28, 0.82, 1.15);
col = mix(col, shirtCol, shirtK);
cloth = max(cloth, shirtK);
vec4 sampledDiffuseColor = vec4(col, 1.0);
diffuseColor *= sampledDiffuseColor;
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.9, cloth);');
  };
  mat.customProgramCacheKey = () => 'charBody';
  return mat;
}

// Pelo, barba, cejas: color liso (la textura original solo aporta el detalle de las hebras)
export function makeHairMaterial(src, color) {
  const mat = new MeshStandardMaterial({ map: src ? src.map : null, roughness: 0.85, metalness: 0, side: 2 });
  setHairColor(mat, color);
  return mat;
}
export function setHairColor(mat, color) {
  mat.color.set(color);
  if (mat.map) mat.color.multiplyScalar(1 / HAIR_MEAN);
}

export const plainMaterial = (color, opts = {}) => new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...opts });

export function setSkin(mat, hex) { mat.userData.uniforms.uSkin.value.copy(lin(hex)); }
