import { Group, Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- Fusiona las mallas fijas de un grupo: una sola malla por material ----------
// Paredes, postes y utilería son cientos de piezas que no se mueven; dibujarlas una por una
// (y otra vez por cada sombra) cuesta cientos de llamadas por cuadro. Lo que no es Mesh
// (sprites, líneas, luces) queda tal cual.
export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map(), keep = [];
  group.traverse(o => {
    if (o === group || !o.visible) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) {
      const key = o.material.uuid + (o.castShadow ? '|s' : '') + (o.receiveShadow ? '|r' : '');
      if (!byMat.has(key)) byMat.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      g.applyMatrix4(o.matrixWorld);
      byMat.get(key).geos.push(g);
    } else if (o.isSprite || o.isLine || o.isPoints) keep.push(o);
  });
  const out = new Group();
  for (const { mat, cast, receive, geos } of byMat.values()) {
    // Todas las piezas deben tener los mismos atributos para fusionarse
    const names = geos.map(g => Object.keys(g.attributes).sort().join());
    const groups = new Map();
    geos.forEach((g, i) => { if (!groups.has(names[i])) groups.set(names[i], []); groups.get(names[i]).push(g); });
    for (const list of groups.values()) {
      const m = new Mesh(mergeGeometries(list), mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      out.add(m);
      list.forEach(g => g.dispose());
    }
  }
  for (const o of keep) {
    o.matrixWorld.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
  }
  return out;
}
