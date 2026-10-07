// Queen of Eternal Night (model lab version): Eternal Night Lake has no light, only the faint blue on the jellyfish; the society says an ancient kingdom's library lies sunk at the bottom of the lake, and the jellyfish is the lamp that guards the books.
// Dark and water, N, absorbs spirit energy and paralyzes. Identifying features: 1. A deep indigo bell, with eight hanging petal-shaped lappets along its rim and a small gold crown on top (a sapphire at the front);
// 2. A lamp carried under the bell: a short stalk holds a glowing blue lamp orb, and four pale purple oral arms with wavy frilled edges hang from beside the lamp (the body's main emissive); 3. A tentacle on the right curls around an old book, and a tentacle at the back hooks the library's big key.
// Personality: a calm and gentle night-watch queen who lights the way for lost travelers at night. A jellyfish has no face: no eyes, mouth or blush are added; the queen's nobility comes from the gold crown, the slightly tilted pose of the bell, the slow pulsing and the flicker of the lamp.
// Bell surface: eight pale blue radial canals radiate from the apex to the rim, with one short secondary canal in the middle of each lappet; the four oral arms are split to the left and right sides, so the lamp under the bell is visible from both the front and the back.
// Gaze order: the glowing blue lamp orb under the bell and the gold crown on top of the bell (a sapphire at the front) come first, the radial canals on the bell second, and the tentacles, old book and key are support.
// Back: the end of one tentacle hooks a large bronze key (the book keeper's key), and eight pale blue radial canals radiate from the apex to the rim on the back of the bell.
// <Action table> Idle: the bell contracts and relaxes in pulses and the whole body bobs up and down, the oral arms and tentacles sway half a beat behind, the lamp orb flickers, and the old book and key swing along.
// Pulse (act.pulse): the bell contracts hard and the whole body darts upward; glow (act.glow): the lamp orb and gem brighten. Hit: the bell tilts and the tentacles fling out.
// Anchors: head (center of the bell's front), eyes (empty array: no eyes), mouth (root of the oral arms under the bell), crown (gem), lamp (lamp orb), book (old book), key (key), tentacles (center of the tentacles' midsection).

import * as THREE from 'three';
import { brilliant, curveTable, lathe, loft, mergeStatic, partKit, PI, rbox, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

function ringIndex(rows: number, J: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < J; j++) {
      const a = i * J + j;
      const a1 = i * J + ((j + 1) % J);
      idx.push(a, a + J, a1, a + J, a1 + J, a1);
    }
  return idx;
}

function faceOut(g: THREE.BufferGeometry, i: number, want: THREE.Vector3): void {
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, i);
  if (nrm.dot(want) >= 0) return;
  const idx = g.index!.array as Uint32Array | Uint16Array;
  for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  g.index!.needsUpdate = true;
  g.computeVertexNormals();
}

function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

export function buildAbyssjellyLab(): LabModel {
  const RIMC = 0xb8d8ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    bell: vc(labToon(0xffffff, { rim: 0.65, rimColor: RIMC })),
    flesh: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    gold: labToon(0xe2b654, { ramp: 'metal', rim: 0.4, rimColor: 0xfff0c8, spec: 0.6, specTh: 0.93 }),
    brass: labToon(0xb88a46, { ramp: 'metal', rim: 0.35, rimColor: 0xffe8c0, spec: 0.45, specTh: 0.92 }),
    gem: labToon(0x6cd4ff, { ramp: 'gem', rim: 0, emissive: 0x2aa8ff, emissiveAmt: 0.45 }),
    lamp: labToon(0xcff4ff, { ramp: 'gem', rim: 0, emissive: 0x58c8ff, emissiveAmt: 0.85 }),
    cover: labToon(0x6a3a2a, { rim: 0.35, rimColor: 0xffd8c0 }),
    pages: labToon(0xf2e6c8, { rim: 0.25 }),
  };
  for (const [k, m] of Object.entries(M)) m.name = k;

  const root = new THREE.Group();
  root.name = 'abyssjelly-lab';
  const { add, group } = partKit();
  const BELL = 9801;

  const FY = 1.0;
  const float = group(root, [0, FY, 0], [0, 0, 0.06]);
  const bell = group(float);

  // ── Bell: outside is a deep indigo dome, with eight hanging lappets along the rim that flip out a little; the underside is darker; the bell has eight radial canals plus eight short secondary canals ──
  const R = 0.36;
  const H = 0.33;
  const A_END = (PI / 2) * 1.06;
  // w: weight of the lappets hanging down, only near the rim (the rings attached to the bell surface use the same default so that they stay attached to it)
  const outerP = (a: number, phi: number, w = ss(a, 1.05, 1.6)) => {
    const lap = Math.pow(0.5 + 0.5 * Math.cos(8 * phi), 1.5) * w;
    const r = R * Math.sin(a) * (1 + 0.06 * ss(a, 1.2, 1.66)) + 0.012 * lap;
    const y = H * Math.cos(a) - 0.04 * lap;
    return v(r * Math.sin(phi), y, r * Math.cos(phi));
  };
  const cNavy = col(0x262a66);
  const cRimV = col(0x6656c4);
  const cCanal = col(0x5c98f0);
  const cSub = col(0x33276e);
  {
    // Cross-section: outer bell 14 points (apex to rim), rounded rim lip 3 points, underside 8 points (rim back to the apex)
    const rows: { r: number; y: number; w: number; out: boolean; a: number }[] = [];
    for (let k = 0; k <= 13; k++) {
      const a = (k / 13) * A_END;
      rows.push({ r: 0, y: 0, w: ss(a, 1.05, 1.6), out: true, a });
    }
    const lip: [number, number][] = [[0.004, -0.028], [-0.016, -0.036], [-0.034, -0.024]];
    for (let k = 0; k <= 7; k++) {
      const b = (1 - k / 7) * (PI / 2);
      rows.push({ r: (R - 0.04) * Math.sin(b), y: 0.2 * Math.cos(b) - 0.012, w: ss(b, 1.05, 1.57), out: false, a: b });
    }
    const NPHI = 48;
    const pos: number[] = [];
    const cl: number[] = [];
    const rimEnd = outerP(A_END, 0, 0);
    const R_RIM = Math.hypot(rimEnd.x, rimEnd.z);
    const Y_RIM = rimEnd.y;
    const allRows: ((phi: number) => { p: THREE.Vector3; c: THREE.Color })[] = [];
    for (const rw of rows.slice(0, 14))
      allRows.push((phi) => {
        const p = outerP(rw.a, phi, rw.w);
        // Radial canals: eight pale blue ones radiate from the apex to the rim, between two lappets (φ = π/8 + kπ/4), getting brighter toward the rim;
        // at the middle of each lappet (φ = kπ/4) there is one more short secondary canal, starting from the middle of the bell surface and paler
        const canal = (1 - ss(Math.abs(Math.cos(4 * phi)), 0.0, 0.15)) * ss(rw.a, 0.2, 0.5);
        const sub = (1 - ss(Math.abs(Math.sin(4 * phi)), 0.0, 0.13)) * ss(rw.a, 0.72, 1.05);
        const c = cNavy.clone().lerp(cRimV, ss(rw.a, 1.2, 1.62) * 0.8).lerp(cCanal, Math.max(canal * (0.78 + 0.17 * ss(rw.a, 0.6, 1.4)), sub * 0.5));
        return { p, c };
      });
    for (const [dr, dy] of lip)
      allRows.push((phi) => {
        const lap = Math.pow(0.5 + 0.5 * Math.cos(8 * phi), 1.5);
        const r = R_RIM + dr + 0.012 * lap;
        const y = Y_RIM + dy - 0.04 * lap;
        return { p: v(r * Math.sin(phi), y, r * Math.cos(phi)), c: cRimV.clone() };
      });
    for (const rw of rows.slice(14))
      allRows.push((phi) => {
        const lap = Math.pow(0.5 + 0.5 * Math.cos(8 * phi), 1.5) * rw.w;
        const r = rw.r + 0.012 * lap;
        const y = rw.y - 0.04 * lap;
        return { p: v(r * Math.sin(phi), y, r * Math.cos(phi)), c: cSub.clone().lerp(cRimV, rw.w * 0.5) };
      });
    for (const f of allRows)
      for (let j = 0; j < NPHI; j++) {
        const { p, c } = f((j / NPHI) * PI * 2);
        pos.push(p.x, p.y, p.z);
        cl.push(c.r, c.g, c.b);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(ringIndex(allRows.length - 1, NPHI));
    g.computeVertexNormals();
    faceOut(g, 7 * NPHI, v(0, 0.6, 0.8));
    add(bell, g, M.bell).userData.inkGroup = BELL;
  }
  const surfN = (a: number, phi: number) => {
    const e = 1e-3;
    const da = outerP(a + e, phi).sub(outerP(a - e, phi));
    const dp = outerP(a, phi + e).sub(outerP(a, phi - e));
    const n = new THREE.Vector3().crossVectors(dp, da).normalize();
    const p = outerP(a, phi);
    if (n.dot(v(p.x, p.y + 0.2, p.z)) < 0) n.negate();
    return n;
  };
  // ── Gold crown: a small gold crown ring on top, five points with a round bead on each point, and a sapphire set at the front ──
  const crown = group(bell, [0.02, H - 0.025, 0], [0.04, 0, -0.1]);
  add(crown, lathe([[0.076, -0.005], [0.086, 0.0], [0.09, 0.034], [0.084, 0.042], [0.074, 0.034], [0.072, 0.0]], 28), M.gold);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * PI * 2;
    const p = v(Math.sin(a) * 0.082, 0.07, Math.cos(a) * 0.082);
    add(crown, new THREE.ConeGeometry(0.02, 0.06, 8), M.gold, [p.x, p.y, p.z]);
    add(crown, new THREE.SphereGeometry(0.011, 8, 6), M.gold, [p.x, p.y + 0.035, p.z]);
  }
  const gemG = group(crown, [0, 0.02, 0.092]);
  add(gemG, brilliant(0.02, 0.012, 0.018, 8).rotateX(PI / 2), M.gem);

  // ── Lamp, oral arms and tentacles under the bell: they sway half a beat behind the skirt ──
  const skirt = group(float, [0, 0.02, 0]);
  const cArm = col(0x9a86e0);
  const cArmTip = col(0xe4dcff);
  const cTent = col(0x2e3478);
  const cTentTip = col(0x6ac8f0);
  // Lamp: a short stalk holds a glowing lamp orb
  add(skirt, paint(loft([v(0, 0.16, 0), v(0, 0.02, 0), v(0, -0.12, 0)], () => [0.022, 0.022], { segs: 4, radial: 10, side: v(1, 0, 0) }), () => cArm.clone()), M.flesh);
  const lampG = group(skirt, [0, -0.2, 0]);
  add(lampG, new THREE.SphereGeometry(0.08, 20, 14), M.lamp);
  // Two rings of pale purple holder petals above and below the lamp orb frame the lamp like a lantern
  add(skirt, paint(lathe([[0.022, -0.1], [0.04, -0.11], [0.07, -0.12], [0.075, -0.115], [0.06, -0.1], [0.03, -0.09]], 20), () => cArm.clone()), M.flesh);
  // Oral arms: four wide ribbons with wavy frilled edges hang from beside the lamp; split to the left and right sides (±68° and ±112° from straight ahead) so the front does not block the lamp
  for (let k = 0; k < 4; k++) {
    const a = (k < 2 ? 1 : -1) * (k % 2 ? 1.95 : 1.19);
    const out = v(Math.sin(a), 0, Math.cos(a));
    const tan = v(Math.cos(a), 0, -Math.sin(a));
    const P = (r: number, y: number, s: number) => out.clone().multiplyScalar(r).add(v(0, y, 0)).addScaledVector(tan, s);
    const pts = [P(0.05, -0.1, 0), P(0.1, -0.24, 0.03), P(0.08, -0.4, -0.03), P(0.12, -0.55, 0.02), P(0.14, -0.64, 0.05)];
    const g = loft(pts, (t) => {
      const ruff = 1 + 0.35 * Math.sin(t * 26 + k);
      return [0.042 * (1 - 0.45 * t) * ruff * Math.min(1, (1 - t) * 8 + 0.1), 0.016 * (1 - 0.4 * t) * Math.min(1, (1 - t) * 8 + 0.2)];
    }, { segs: 30, radial: 10, side: out });
    add(skirt, paint(g, (p) => cArm.clone().lerp(cArmTip, ss(-p.y, 0.3, 0.62))), M.flesh);
  }
  // Tentacles: eight along the rim (between the lappets), two of them special: the right one curls around the old book, the back one hooks the key
  const tentProf = () => curveTable([[0, 0.019, 0.019], [0.5, 0.015, 0.015], [0.92, 0.01, 0.01], [1, 0.0, 0.0]]);
  for (let k = 0; k < 8; k++) {
    const phi = ((k + 0.5) / 8) * PI * 2;
    const out = v(Math.sin(phi), 0, Math.cos(phi));
    const tan = v(Math.cos(phi), 0, -Math.sin(phi));
    const P = (r: number, y: number, s: number) => out.clone().multiplyScalar(r).add(v(0, y, 0)).addScaledVector(tan, s);
    const len = 0.44 + 0.08 * Math.sin(k * 2.3);
    let pts: THREE.Vector3[];
    const right = k === 1;
    const back = k === 4;
    if (right) pts = [P(0.31, -0.04, 0), P(0.36, -0.16, 0.02), P(0.4, -0.3, 0.04), P(0.41, -0.4, 0.07)];
    else if (back) pts = [P(0.31, -0.04, 0), P(0.33, -0.18, -0.02), P(0.32, -0.33, 0.0), P(0.3, -0.42, 0.03), P(0.27, -0.44, 0.06)];
    else pts = [P(0.31, -0.04, 0), P(0.34, -len * 0.3, 0.03), P(0.3, -len * 0.62, -0.03), P(0.32, -len, 0.02)];
    add(skirt, paint(loft(pts, tentProf(), { segs: 20, radial: 8, side: tan }), (p) => cTent.clone().lerp(cTentTip, ss(-p.y, 0.2, 0.46))), M.flesh);
  }
  // Old book: curled by the end of the right tentacle (the tentacle wraps around the book once)
  const bookG = group(skirt, [0.43, -0.49, 0.1], [0.1, -0.5, 0.35]);
  add(bookG, rbox(0.03, 0.2, 0.15, 0.01, 2), M.cover, [0, 0, 0]);
  add(bookG, rbox(0.024, 0.186, 0.14, 0.004, 1), M.pages, [0, 0, 0.012]);
  add(bookG, rbox(0.036, 0.2, 0.012, 0.004, 1), M.cover, [0, 0, -0.07]);
  add(bookG, rbox(0.012, 0.04, 0.022, 0.004, 1), M.gold, [0.018, 0, 0.078]);
  add(bookG, paint(new THREE.TorusGeometry(0.058, 0.014, 8, 20).scale(1, 1.35, 1), () => cTent.clone().lerp(cTentTip, 0.3)), M.flesh, [0, 0.05, 0.0], [PI / 2, 0, 0]);
  // The library's big key: the end of the back tentacle hooks the key ring
  const backPhi = (4.5 / 8) * PI * 2;
  const bo = v(Math.sin(backPhi), 0, Math.cos(backPhi));
  const bt = v(Math.cos(backPhi), 0, -Math.sin(backPhi));
  const keyAt = bo.clone().multiplyScalar(0.27).add(v(0, -0.47, 0)).addScaledVector(bt, 0.06);
  const keyG = group(skirt, [keyAt.x, keyAt.y, keyAt.z], [0, backPhi, 0.15]);
  add(keyG, new THREE.TorusGeometry(0.034, 0.009, 8, 20), M.brass, [0, 0, 0]);
  add(keyG, new THREE.CylinderGeometry(0.009, 0.009, 0.15, 8), M.brass, [0, -0.1, 0]);
  add(keyG, rbox(0.04, 0.018, 0.01, 0.003, 1), M.brass, [0.02, -0.155, 0]);
  add(keyG, rbox(0.03, 0.016, 0.01, 0.003, 1), M.brass, [0.016, -0.128, 0]);
  add(keyG, new THREE.SphereGeometry(0.014, 8, 6), M.brass, [0, -0.04, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // No face: head sits at the center of the bell's front (in a close-up, the gold crown is above and the lamp below), eyes is an empty array (the eye highlight falls back to head), and mouth is at the root of the oral arms under the bell
  const faceP = outerP(0.95, 0);
  const rig = {
    head: group(bell, [faceP.x, faceP.y, faceP.z]),
    eyes: [] as THREE.Group[],
    anchors: {
      mouth: group(skirt, [0, -0.08, 0.02]),
      crown: gemG,
      lamp: lampG,
      book: bookG,
      key: keyG,
      tentacles: group(skirt, [0, -0.35, 0]),
    },
  };
  const act = { pulse: 0, glow: 0 };

  mergeStatic(root, {
    owners: [float, bell, skirt, lampG, crown, bookG, keyG],
    rig,
  });

  const update = (t: number) => {
    const pu = act.pulse;
    const beat = Math.pow(0.5 + 0.5 * Math.sin(t * 1.8), 2);
    float.position.y = FY + Math.sin(t * 0.9) * 0.03 + pu * 0.08;
    float.rotation.set(Math.sin(t * 0.6) * 0.03, Math.sin(t * 0.3) * 0.12, 0.06 + Math.sin(t * 0.7) * 0.025);
    const sq = beat * 0.04 + pu * 0.12;
    bell.scale.set(1 - sq, 1 + sq * 0.8, 1 - sq);
    skirt.rotation.set(Math.sin(t * 0.9 - 0.9) * 0.05, 0, Math.sin(t * 0.7 - 0.8) * 0.05);
    skirt.scale.set(1, 1 + sq * 0.5, 1);
    bookG.rotation.z = 0.35 + Math.sin(t * 1.1) * 0.06;
    keyG.rotation.z = 0.15 + Math.sin(t * 1.3 + 1) * 0.12;
    M.lamp.emissiveIntensity = 0.8 + Math.sin(t * 1.8) * 0.1 + act.glow * 0.9;
    M.gem.emissiveIntensity = 0.45 + act.glow * 0.6;
    lampG.scale.setScalar(1 + act.glow * 0.15);
  };
  update(0);

  return { root, update, center: new THREE.Vector3(0, 0.9, 0), radius: 0.62, rig, act };
}
