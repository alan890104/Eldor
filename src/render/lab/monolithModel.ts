// Monolith Colossus (model lab version, N, earth): a stone that rolls around by itself, and once grown almost stops moving; the dwarves of the canyon carve their family names into it.
// Identifying features: 1. An upright boulder whose cross-section is a rounded square, with a slanted-cut top, leaning slightly back, and layer upon layer of canyon sandstone banding on its body;
// 2. A gold-inlaid round emblem above the chest (a mountain and a hammer, the crest of the first dwarf family to carve a name into it), the gold faintly translucent; below it, rows of family names carved by dwarves, with the earliest row filled in gold;
// 3. Two stacked beveled stone blocks on each side as arms, with a square big stone fist propped on the ground at the bottom. A cap of moss and a small yellow flower on top, and a ring of rubble at its feet (it has not moved in a long time).
// A stone has no face to begin with (spirit-model-polish <Do not anthropomorphize>): no eyes, mouth or brows are added. Personality: a steady, generous old guardian of the canyon, expressed by the upright, back-leaning stance, the fists propped on the ground and the very slow breathing.
// Gaze order: the emblem (gold on a pale cream worn-smooth stone face) → the gold names on the chest → the stone fists and the moss cap. Back: six rows of names, the top row not yet finished, and a chisel stuck in a crack in the stone beside it.
// Action table: idle barely moves, only very slow breathing and a slight sway; charge-up act.glow brightens the emblem's gold light; strike pounds the ground with the stone fists (anchors fistL / fistR); hit shakes the whole block once.
// Anchors: head, anchors.mouth and crest are all at the center of the emblem; fistL / fistR (L is its own left, +x), crown (top of the moss cap), names (the row of gold characters). The only emissive is the emblem's gold.

import * as THREE from 'three';
import { lathe, loft, mergeStatic, partKit, PI, rbox, rng, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Normal-direction check for a whole mesh: on average the normals must point away from the ref point, and if not, flip the facing */
function orientOut(g: THREE.BufferGeometry, ref: THREE.Vector3): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  let s = 0;
  for (let i = 0; i < pa.count; i++) s += (pa.getX(i) - ref.x) * na.getX(i) + (pa.getY(i) - ref.y) * na.getY(i) + (pa.getZ(i) - ref.z) * na.getZ(i);
  if (s < 0) {
    const idx = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/**
 * A grid surface wrapped around once: rows along the cross-section, cols around it (the last column joins back to the first, with no seam line).
 * When the head and tail of the cross-section shrink to a point (a pole), the normals of that row are averaged so the pole does not show an outline dot.
 */
function wrapGrid(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, ref: THREE.Vector3): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const cl = new Float32Array(rows * cols * 3);
  let hasC = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      const k = (i * cols + j) * 3;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
      if (c) hasC = true;
      cl[k] = c ? c.r : 1;
      cl[k + 1] = c ? c.g : 1;
      cl[k + 2] = c ? c.b : 1;
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = i * cols + j2;
      const d = (i + 1) * cols + j2;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (hasC) g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  orientOut(g, ref);
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (const i of [0, rows - 1]) {
    let spread = 0;
    for (let j = 1; j < cols; j++) spread = Math.max(spread, Math.abs(pos[(i * cols + j) * 3] - pos[i * cols * 3]) + Math.abs(pos[(i * cols + j) * 3 + 2] - pos[i * cols * 3 + 2]));
    if (spread > 1e-5) continue;
    const n = new THREE.Vector3();
    for (let j = 0; j < cols; j++) n.x += na.getX(i * cols + j), n.y += na.getY(i * cols + j), n.z += na.getZ(i * cols + j);
    n.normalize();
    for (let j = 0; j < cols; j++) na.setXYZ(i * cols + j, n.x, n.y, n.z);
  }
  return g;
}

/**
 * A membrane with thickness (wing, cloth, leather): S(u, v) is the midsurface, growing thick / 2 to each side, with a half-round lip along the outer edge.
 * With wrapU, u wraps around with no seam, leaving only the two edges v = 0 and v = 1; without wrapping all four edges are rounded into lips.
 * color(u, v, side): side 1 is the outside, -1 the inside. Which direction is outside is decided by outward (by default, away from the y axis).
 */
function thickSheet(
  NU: number,
  NV: number,
  S: (u: number, v: number) => THREE.Vector3,
  thick: (u: number, v: number) => number,
  o: { wrapU?: boolean; E?: number; color?: (u: number, v: number, side: number) => THREE.Color; outward?: (p: THREE.Vector3) => THREE.Vector3 } = {},
): THREE.BufferGeometry {
  const wrap = !!o.wrapU;
  const cols = wrap ? NU : NU + 1;
  const rows = NV + 1;
  const E = o.E ?? 3;
  const P: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) P.push(S(i / NU, j / NV));
  const at = (i: number, j: number) => P[j * cols + i];
  const Nn: THREE.Vector3[] = [];
  const Su: THREE.Vector3[] = [];
  const Sv: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const iL = wrap ? (i - 1 + cols) % cols : Math.max(0, i - 1);
      const iR = wrap ? (i + 1) % cols : Math.min(cols - 1, i + 1);
      const su = at(iR, j).clone().sub(at(iL, j));
      const sv = at(i, Math.min(rows - 1, j + 1)).clone().sub(at(i, Math.max(0, j - 1)));
      Su.push(su);
      Sv.push(sv);
      Nn.push(su.clone().cross(sv).normalize());
    }
  const mid = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  const ref = (o.outward ?? ((p: THREE.Vector3) => v3(p.x, 0, p.z)))(P[mid]);
  if (Nn[mid].dot(ref) < 0) for (const n of Nn) n.negate();
  const color = o.color ?? (() => col(0xffffff));

  const pos: number[] = [];
  const clr: number[] = [];
  const outs: THREE.Vector3[] = [];
  const addV = (p: THREE.Vector3, d: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z);
    clr.push(c.r, c.g, c.b);
    outs.push(d);
    return outs.length - 1;
  };
  const uvOf = (k: number): [number, number] => [(k % cols) / NU, Math.floor(k / cols) / NV];
  const O: number[] = [];
  const I: number[] = [];
  for (let k = 0; k < P.length; k++) {
    const [u, v] = uvOf(k);
    const h = thick(u, v) / 2;
    O.push(addV(P[k].clone().addScaledVector(Nn[k], h), Nn[k].clone(), color(u, v, 1)));
    I.push(addV(P[k].clone().addScaledVector(Nn[k], -h), Nn[k].clone().negate(), color(u, v, -1)));
  }
  const idx: number[] = [];
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    A.set(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]);
    B.set(pos[b * 3] - A.x, pos[b * 3 + 1] - A.y, pos[b * 3 + 2] - A.z);
    C.set(pos[c * 3] - A.x, pos[c * 3 + 1] - A.y, pos[c * 3 + 2] - A.z);
    const fn = B.cross(C);
    const hint = outs[a].clone().add(outs[b]).add(outs[c]);
    if (fn.dot(hint) < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < (wrap ? cols : cols - 1); i++) {
      const i2 = (i + 1) % cols;
      const a = j * cols + i;
      const b = j * cols + i2;
      const c = (j + 1) * cols + i2;
      const d = (j + 1) * cols + i;
      tri(O[a], O[b], O[c]);
      tri(O[a], O[c], O[d]);
      tri(I[a], I[b], I[c]);
      tri(I[a], I[c], I[d]);
    }
  // Rounded lip on the edge
  const loops: { k: number; e: THREE.Vector3 }[][] = [];
  if (wrap) {
    loops.push(Array.from({ length: cols }, (_, i) => ({ k: i, e: Sv[i].clone().negate() })));
    loops.push(Array.from({ length: cols }, (_, i) => ({ k: (rows - 1) * cols + i, e: Sv[(rows - 1) * cols + i].clone() })));
  } else {
    const L: { k: number; e: THREE.Vector3 }[] = [];
    const eOf = (i: number, j: number) => {
      const k = j * cols + i;
      const e = new THREE.Vector3();
      if (j === 0) e.sub(Sv[k].clone().normalize());
      if (j === rows - 1) e.add(Sv[k].clone().normalize());
      if (i === 0) e.sub(Su[k].clone().normalize());
      if (i === cols - 1) e.add(Su[k].clone().normalize());
      return { k, e };
    };
    for (let i = 0; i < cols; i++) L.push(eOf(i, 0));
    for (let j = 1; j < rows; j++) L.push(eOf(cols - 1, j));
    for (let i = cols - 2; i >= 0; i--) L.push(eOf(i, rows - 1));
    for (let j = rows - 2; j >= 1; j--) L.push(eOf(0, j));
    loops.push(L);
  }
  for (const L of loops) {
    const rings = L.map(({ k, e }) => {
      const n = Nn[k];
      const ee = e.clone().addScaledVector(n, -e.dot(n)).normalize();
      const [u, v] = uvOf(k);
      const h = thick(u, v) / 2;
      const cO = color(u, v, 1);
      const cI = color(u, v, -1);
      const ring = [O[k]];
      for (let m = 1; m <= E; m++) {
        const ph = (PI * m) / (E + 1);
        const d = n.clone().multiplyScalar(Math.cos(ph)).addScaledVector(ee, Math.sin(ph));
        ring.push(addV(P[k].clone().addScaledVector(d, h), d, cO.clone().lerp(cI, (1 - Math.cos(ph)) / 2)));
      }
      ring.push(I[k]);
      return ring;
    });
    for (let q = 0; q < rings.length; q++) {
      const r1 = rings[q];
      const r2 = rings[(q + 1) % rings.length];
      for (let m = 0; m <= E; m++) {
        tri(r1[m], r2[m], r2[m + 1]);
        tri(r1[m], r2[m + 1], r1[m + 1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i));
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** A single-color vertex color (for merging with other parts of the same material) */
const tint = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const cc = col(c);
  return paint(g, () => cc);
};


/** A flat rock slab: an icosahedron subdivided once, each vertex pushed outward a little, split into triangles that share no vertices (facets) */
function rockGeo(seed: number, k = 0.14): THREE.BufferGeometry {
  const r = rng(seed);
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const cache = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let s = cache.get(key);
    if (s === undefined) cache.set(key, (s = 1 + (r() - 0.5) * 2 * k));
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildMonolithLab(): LabModel {
  const rand = rng(20261040);
  const RIMC = 0xffdcae;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const PALE = 0xe2d6bc;
  // The stone body, arms, fists and rubble share one vertex-color sandstone material; the carved text shares one dark vertex-color material
  const stone = vc(labToon(0xffffff, { rim: 0.35, rimColor: RIMC, speckle: 0.4 }));
  const carve = vc(labToon(0xffffff, { rim: 0 }));
  const M = {
    stone,
    carve,
    inlay: labToon(0xecb44a, { ramp: 'metal', rim: 0.3, rimColor: RIMC, spec: 0.6, specTh: 0.97, emissive: 0xc07418, emissiveAmt: 0.3 }),
    moss: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xd8f0a0 })),
    steel: labToon(0x9aa2ac, { ramp: 'metal', rim: 0.4, rimColor: RIMC, spec: 0.8, specTh: 0.97 }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'monolith-lab';
  const kit = partKit();
  const { add, group } = kit;
  const FACEG = 9801;
  const body = group(root);

  // ── Stone body: an upright boulder whose cross-section is a rounded square (flat front, easy to carve on), narrowing slightly upward with a domed top, the whole block leaning slightly back ──
  // Layer upon layer of canyon sandstone banding on the body (ochre, sand, rust red and pale cream alternating, with slightly wavy boundaries), and the brightest pale cream around the face
  const YT = 1.16;
  const DOME = 0.1;
  const W0 = 0.36;
  const D0 = 0.215;
  const SLOPE = 0.1;
  const se = (v: number) => Math.sign(v) * Math.abs(v) ** 0.42;
  const lump = (x: number, y: number, z: number) => 0.022 * Math.sin(3.1 * x + 2.3 * y) + 0.018 * Math.sin(4.7 * z + 1.7 * y + 1) + 0.012 * Math.sin(7.3 * y + 2 * x + 2.2 * z);
  /** s: 0 is the bottom, 1 the top; th: 0 is the front (+z), positive toward +x */
  const surf = (s: number, th: number) => {
    let y: number;
    let k: number;
    const x0 = W0 * se(Math.sin(th));
    const z0 = D0 * se(Math.cos(th));
    if (s < 0.8) {
      y = (s / 0.8) * YT;
      k = 1 + 0.04 * Math.sin((y / YT) * PI) - 0.15 * (y / YT);
    } else {
      const ph = ((s - 0.8) / 0.2) * (PI / 2);
      y = YT + DOME * Math.sin(ph);
      k = 0.85 * Math.cos(ph) ** 0.45;
    }
    const m = k * (1 + lump(x0, y, z0) * 1.2);
    // The top face slopes a little higher toward its left (+x), like a split stone; the whole block leans slightly back
    return v3(x0 * m, y + SLOPE * (x0 * m / W0) * Math.min(1, y / YT) ** 3, z0 * m - 0.045 * (y / YT) ** 2);
  };
  const surfN = (s: number, th: number) => {
    const h = 1e-3;
    const n = surf(Math.min(1, s + h), th).sub(surf(Math.max(0, s - h), th)).cross(surf(s, th - h).sub(surf(s, th + h))).normalize();
    const p = surf(s, th);
    if (n.dot(v3(p.x, 0, p.z + 0.02)) < 0) n.negate();
    return n;
  };
  /** The s for height y (the straight stretch of the stone body) */
  const sOfY = (y: number) => (y / YT) * 0.8;
  const cStrata = [col(0xb4a692), col(0xa08a74), col(0xc6b8a0), col(0x9a6e54), col(0xb8a88e), col(0xa3907a), col(0xc9bca4)];
  const cPale = col(PALE);
  const F_Y = 0.9;
  {
    const R = 44;
    const C = 52;
    const geo = wrapGrid(R, C, (i, j) => {
      const s = i / (R - 1);
      const th = (j / C) * PI * 2;
      const p = surf(s, th);
      const yy = p.y + 0.035 * Math.sin(p.x * 6 + p.z * 4) + 0.02 * Math.sin(p.x * 13);
      const band = Math.floor((yy + 0.2) / 0.16);
      const f = ((yy + 0.2) / 0.16) % 1;
      const cA = cStrata[((band % 7) + 7) % 7];
      const cB = cStrata[(((band + 1) % 7) + 7) % 7];
      let c = cA.clone().lerp(cB, sstep(f, 0.82, 0.95));
      // A patch of pale cream worn smooth around the emblem (the brightest on the whole body, so the emblem stands out most)
      const fd = Math.hypot(p.x / 0.2, (p.y - F_Y) / 0.18);
      c = c.lerp(cPale, (1 - sstep(fd, 0.7, 1.0)) * sstep(p.z, 0.05, 0.15));
      return { p, c };
    }, v3(0, 0.6, 0));
    add(body, geo, M.stone).userData.inkGroup = FACEG;
  }

  // ── Emblem: a gold-inlaid ring above the chest with a mountain and a hammer inside (the crest of the first dwarf family to carve a name into it), the gold faintly translucent ──
  // A stone has no face to begin with, so no features are added; the focus is this emblem, and mood comes from posture, motion and the flicker of the gold light
  const sF = sOfY(F_Y);
  const fp = surf(sF, 0);
  const crestG = group(body, [fp.x, fp.y, fp.z]);
  {
    const n = surfN(sF, 0);
    const tx = new THREE.Vector3().crossVectors(UP, n).normalize();
    const ty = new THREE.Vector3().crossVectors(n, tx).normalize();
    crestG.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ty, n));
    add(crestG, new THREE.TorusGeometry(0.105, 0.014, 6, 36), M.inlay, [0, 0, 0.002], [0, 0, 0], [1, 1, 0.55]);
    const bar = new THREE.BoxGeometry(1, 1, 1);
    // Mountain: two slanted strokes; hammer: a handle and a hammer head
    for (const [x, y, len, a] of [[-0.035, -0.03, 0.09, 0.9], [0.035, -0.03, 0.09, -0.9], [0, 0.018, 0.07, PI / 2]] as [number, number, number, number][])
      add(crestG, bar, M.inlay, [x, y, 0.003], [0, 0, a], [len, 0.018, 0.012]);
    add(crestG, rbox(0.07, 0.03, 0.014, 0.005, 1), M.inlay, [0, 0.055, 0.003]);
  }

  // ── Carved text: the family names carved by the dwarves, rows of cuts (dark brown pigment filling the grooves); the earliest name on the front chest is filled in gold ──
  const glyphs: [number, number, number, number][][] = [
    [[0, 0, 0.05, PI / 2], [0.014, 0.012, 0.024, 0]],
    [[0, 0, 0.05, PI / 2], [0, 0.018, 0.03, 0], [0, -0.018, 0.03, 0]],
    [[0, 0, 0.05, 0.7], [0, 0, 0.05, -0.7]],
    [[-0.012, 0, 0.05, PI / 2], [0.012, 0, 0.05, PI / 2], [0, 0.008, 0.026, 0]],
    [[0, 0, 0.05, PI / 2], [0.01, 0.012, 0.028, 0.8]],
    [[0, 0.012, 0.04, 0], [0, -0.004, 0.05, PI / 2 + 0.3]],
  ];
  const strokeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cCarve = col(0x5e3c26);
  const cGold = col(0xe0ac3e);
  /** The cross-section is very square, so dividing by angle would crowd the characters at the two sides: arrange by the width ratio f (-1 to 1) instead, and when back is true place them on the back */
  const thOfX = (f: number, back: boolean) => {
    const a = Math.asin(Math.sign(f) * Math.abs(f) ** (1 / 0.42));
    return back ? PI - a : a;
  };
  const nameRow = (y: number, f0: number, f1: number, n: number, c: THREE.Color, unfinished = 0, back = false) => {
    for (let i = 0; i < n - unfinished; i++) {
      const th = thOfX(lerp(f0, f1, (i + 0.5) / n), back);
      const s = sOfY(y);
      const p = surf(s, th);
      const nn = surfN(s, th);
      const g = group(body, [p.x, p.y, p.z]);
      const tx = new THREE.Vector3().crossVectors(UP, nn).normalize();
      const ty = new THREE.Vector3().crossVectors(nn, tx).normalize();
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ty, nn));
      const gl = glyphs[Math.floor(rand() * glyphs.length)];
      for (const [x, yy, len, a] of gl) add(g, tint(strokeGeo.clone(), c), M.carve, [x, yy, 0.0], [0, 0, a], [len, 0.014, 0.01]);
    }
  };
  nameRow(0.7, -0.62, 0.62, 6, cGold);
  nameRow(0.56, -0.56, 0.56, 5, cCarve);
  nameRow(0.42, -0.46, 0.46, 4, cCarve);
  const BACK = PI;
  for (const [k, y] of [0.98, 0.84, 0.7, 0.56, 0.42, 0.28].entries()) nameRow(y, 0.66, -0.66, 6, cCarve, k === 0 ? 2 : 0, true);

  // The top row on the back is not yet finished: a chisel is stuck in a crack in the stone, left behind by the dwarf who was carving
  {
    const s = sOfY(1.06);
    const th = BACK + 0.25;
    const p = surf(s, th);
    const nn = surfN(s, th);
    const crack: THREE.Vector3[] = [];
    for (let i = 0; i <= 5; i++) {
      const a = i / 5;
      const q = surf(sOfY(1.12 - a * 0.16), BACK + 0.2 + 0.08 * Math.sin(a * 9) + a * 0.12);
      crack.push(q);
    }
    add(body, tint(loft(crack, (t) => [0.012 * (1 - t) + 0.003, 0.012 * (1 - t) + 0.003], { segs: 12, radial: 6 }), 0x3a2618), M.carve);
    const g = group(body, [p.x, p.y, p.z]);
    g.quaternion.setFromUnitVectors(v3(0, 0, 1), nn);
    g.rotateX(-0.35);
    add(g, tint(lathe([[0.001, 0.0], [0.012, 0.01], [0.012, 0.03], [0.014, 0.032]], 8), 0xffffff), M.steel, [0, 0, 0], [PI / 2, 0, 0]);
    add(g, loft([v3(0, 0, 0.03), v3(0, 0, 0.12)], () => [0.011, 0.011], { segs: 3, radial: 8 }), M.steel);
    add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.016, 10), M.steel, [0, 0, 0.125], [PI / 2, 0, 0]);
  }

  // ── Moss cap on top: one thick sheet of moss with its edge hanging down in clumps; a few tufts of grass and a small yellow flower on it ──
  const cMoss = col(0x6a8a3e);
  const cMossHi = col(0x8eae52);
  const cMossDk = col(0x4a6a2c);
  {
    const geo = thickSheet(48, 6, (u, v) => {
      const th = u * PI * 2;
      const lobes = 0.012 * Math.sin(th * 5 + 0.7) + 0.008 * Math.sin(th * 11 + 2) - 0.035 * Math.cos(th);
      const s = lerp(0.997, 0.845 + lobes, v);
      return surf(s, th).addScaledVector(surfN(s, th), 0.016);
    }, () => 0.03, {
      wrapU: true,
      E: 2,
      outward: (p) => v3(p.x, p.y - 0.8, p.z),
      color: (u, v, side) => (side < 0 ? cMossDk.clone() : cMossHi.clone().lerp(cMoss, sstep(v, 0.2, 0.7)).lerp(cMossDk, sstep(v, 0.85, 1) * 0.6)),
    });
    add(body, geo, M.moss);
  }
  const top = surf(1, 0);
  const crown = group(body, [top.x, top.y + 0.03, top.z]);
  {
    // Small yellow flower
    const fb = v3(top.x + 0.1, top.y + 0.01, top.z - 0.05);
    add(body, tint(loft([fb, fb.clone().add(v3(0.01, 0.06, 0.01)), fb.clone().add(v3(0.0, 0.1, 0.02))], () => [0.006, 0.006], { segs: 5, radial: 5 }), 0x6a9a3a), M.moss);
    const fc = fb.clone().add(v3(0, 0.105, 0.022));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * PI * 2;
      add(body, tint(new THREE.SphereGeometry(1, 8, 6), 0xffd24a), M.moss, [fc.x + Math.sin(a) * 0.018, fc.y, fc.z + Math.cos(a) * 0.018], [0, a, 0], [0.014, 0.006, 0.02]);
    }
    add(body, tint(new THREE.SphereGeometry(0.01, 8, 6), 0xc0702a), M.moss, [fc.x, fc.y + 0.004, fc.z]);
  }

  // ── Hands: two stacked beveled stone blocks on each side as arms, with a square big stone fist propped on the ground below and three knuckle ridges on the fist's face ──
  const fists: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const cA = col(0xb2a28c);
    const cB = col(0x9a8a74);
    const shade = (g: THREE.BufferGeometry) => paint(g, (p) => cA.clone().lerp(cB, sstep(-p.y, -0.05, 0.12)));
    add(body, shade(rbox(0.2, 0.24, 0.2, 0.04, 2)), M.stone, [sx * 0.39, 0.63, -0.02], [0.1, sx * 0.3, sx * -0.18]);
    add(body, shade(rbox(0.17, 0.27, 0.17, 0.035, 2)), M.stone, [sx * 0.49, 0.41, 0.05], [0.25, sx * 0.2, sx * 0.1]);
    const fg = group(body, [sx * 0.52, 0.15, 0.13], [0, sx * -0.25, 0]);
    fists.push(fg);
    add(fg, shade(rbox(0.26, 0.24, 0.25, 0.05, 2)), M.stone);
    for (let k = 0; k < 3; k++) add(fg, tint(rbox(0.07, 0.07, 0.06, 0.02, 1), 0xbcad96), M.stone, [(k - 1) * 0.08, 0.05, 0.12], [0.2, 0, 0]);
  }

  // ── At its feet: a ring of rubble (it rarely moves once grown) ──
  {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * PI * 2 + rand() * 0.4;
      const r = 0.34 + rand() * 0.12;
      const s = 0.03 + rand() * 0.03;
      add(body, tint(rockGeo(60 + k, 0.2), rand() > 0.5 ? 0xb4a690 : 0x98866e), M.stone, [Math.sin(a) * r, s * 0.4, Math.cos(a) * r], [rand() * 3, rand() * 3, rand() * 3], [s, s * 0.7, s]);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: barely moves, only very slow breathing and a slight forward and back sway; the emblem's gold light changes only with act.glow ──
  const act = { glow: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 1.1);
    body.scale.set(1 + br * 0.004, 1 + br * 0.005, 1 + br * 0.004);
    body.rotation.x = Math.sin(t * 0.55) * 0.008;
    body.rotation.z = Math.sin(t * 0.37) * 0.006;
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.inlay.emissiveIntensity = 0.3 + act.glow * 0.5;
    }
  };
  update(0);

  const face = group(crestG, [0, 0, 0.01]);
  const np = surf(sOfY(0.7), 0);
  const namesA = group(body, [np.x, np.y, np.z]);
  const rig = { head: face, anchors: { mouth: face, crest: face, fistR: fists[0], fistL: fists[1], crown, names: namesA } };
  mergeStatic(root, {
    owners: [body],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.66, 0), radius: 0.8 };
}
