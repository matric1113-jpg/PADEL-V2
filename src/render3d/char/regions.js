import { BufferAttribute, Vector3 } from 'three';

// ---------- Zonas del cuerpo para vestirlo ----------
// El cuerpo viene en una sola malla con la ropa interior pintada en la textura. Para ponerle la camiseta,
// el short, los calcetines y las zapatillas de cada personaje se calcula, una sola vez por cuerpo, cuánto
// pertenece cada vértice a cada prenda a partir de sus pesos de huesos y de su posición a lo largo del hueso.
// Resultado: dos atributos por vértice que lee el shader de materials.js.
//   aReg0 = (camiseta del tronco, camiseta sobre el hombro, manga, short)
//   aReg1 = (posición en la pantorrilla 0 rodilla..1 tobillo, o -1 si no es pantorrilla; zapatilla;
//            muñequera derecha; muñequera izquierda)

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function computeRegions(skinned) {
  const geo = skinned.geometry;
  const bones = skinned.skeleton.bones;
  const byName = {};
  bones.forEach((b, i) => { byName[b.name] = { bone: b, i }; });
  const wp = n => byName[n].bone.getWorldPosition(new Vector3());

  // Segmento de cada hueso largo: de su origen al origen de su hijo
  const seg = {};
  for (const [name, child] of [['upperarm_l', 'lowerarm_l'], ['upperarm_r', 'lowerarm_r'], ['lowerarm_l', 'hand_l'], ['lowerarm_r', 'hand_r'],
    ['thigh_l', 'calf_l'], ['thigh_r', 'calf_r'], ['calf_l', 'foot_l'], ['calf_r', 'foot_r']]) {
    const a = wp(name), b = wp(child), d = b.clone().sub(a);
    seg[name] = { a, d, len2: d.lengthSq() };
  }
  const along = (name, p) => {
    const s = seg[name];
    return Math.min(1, Math.max(0, p.clone().sub(s.a).dot(s.d) / s.len2));
  };

  // Grupo de cada hueso
  const group = bones.map(b => {
    const n = b.name;
    if (/^spine_/.test(n)) return 'spine';
    if (/^clavicle_/.test(n)) return 'clav';
    if (n === 'pelvis') return 'pelvis';
    if (/^(upperarm|lowerarm|thigh|calf)_[lr]$/.test(n)) return n;
    if (/^(foot|ball)_/.test(n)) return 'foot';
    return '';
  });

  const pos = geo.attributes.position, sIdx = geo.attributes.skinIndex, sW = geo.attributes.skinWeight;
  const n = pos.count;
  const r0 = new Float32Array(n * 4), r1 = new Float32Array(n * 4);
  const v = new Vector3();
  const M = skinned.matrixWorld;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const W = {};
    for (let k = 0; k < 4; k++) {
      const w = sW.getComponent(i, k);
      if (w <= 0) continue;
      const g = group[sIdx.getComponent(i, k)];
      if (g) W[g] = (W[g] || 0) + w;
    }
    const g = name => W[name] || 0;
    const upperL = g('upperarm_l'), upperR = g('upperarm_r');
    const thighL = g('thigh_l'), thighR = g('thigh_r');
    const calfL = g('calf_l'), calfR = g('calf_r');
    const lowerL = g('lowerarm_l'), lowerR = g('lowerarm_r');

    // Camiseta: tronco, hombros y manga corta (hasta la mitad del brazo)
    const core = ss(0.25, 0.55, g('spine'));
    const shoulder = ss(0.25, 0.55, g('clav'));
    let sleeve = 0;
    if (upperL > 0.3) sleeve = Math.max(sleeve, ss(0.3, 0.6, upperL) * (1 - ss(0.4, 0.5, along('upperarm_l', v))));
    if (upperR > 0.3) sleeve = Math.max(sleeve, ss(0.3, 0.6, upperR) * (1 - ss(0.4, 0.5, along('upperarm_r', v))));

    // Short: la cadera y el muslo hasta un poco más arriba de la rodilla
    let shorts = ss(0.4, 0.7, g('pelvis'));
    if (thighL > 0.3) shorts = Math.max(shorts, ss(0.3, 0.6, thighL) * (1 - ss(0.5, 0.6, along('thigh_l', v))));
    if (thighR > 0.3) shorts = Math.max(shorts, ss(0.3, 0.6, thighR) * (1 - ss(0.5, 0.6, along('thigh_r', v))));

    // Pantorrilla (posición 0..1 para los calcetines) y pie (zapatilla)
    let leg = -1;
    if (calfL > 0.5) leg = along('calf_l', v); else if (calfR > 0.5) leg = along('calf_r', v);
    const shoe = ss(0.35, 0.65, g('foot'));

    // Muñequeras en el extremo del antebrazo
    const bandR = lowerR > 0.4 ? ss(0.4, 0.7, lowerR) * ss(0.74, 0.8, along('lowerarm_r', v)) : 0;
    const bandL = lowerL > 0.4 ? ss(0.4, 0.7, lowerL) * ss(0.74, 0.8, along('lowerarm_l', v)) : 0;

    r0.set([core, shoulder, sleeve, shorts], i * 4);
    r1.set([leg, shoe, bandR, bandL], i * 4);
  }
  geo.setAttribute('aReg0', new BufferAttribute(r0, 4));
  geo.setAttribute('aReg1', new BufferAttribute(r1, 4));
}
