// Scale of Justice (model lab version): the scale in the judgment hall of the Dawnlight Holy See, which gained consciousness after bearing a thousand years of verdicts. It does not care who is right or wrong, only whether the two sides weigh the same.
// Light, neutral, R. It is an object, so no eyes or mouth are added; the focus is on the dawn sun disc on top and the gem at the center, and its mood comes from the tilt of the beam, the swing of the pans and the flicker of the gem.
// Three identifying features:
// 1. The silhouette of an equal-arm balance: a white marble column stands on a three-tier pedestal, with a brass beam on top and a pan hanging from each end; shrunk very small it is still a "balance scale".
// 2. The dawn sun disc on top (the crest of the Dawnlight Holy See): a gold disc with twelve rays of alternating long and short lengths, and a glowing dawn-gold gem at the center; the needle at the center of the beam points at the lower edge of the sun disc, and when both sides weigh the same the needle points straight up.
// 3. A white blindfold tied on the column (justice does not look at the person), the silk ribbon tied into a bow at the back with two swallowtails hanging down and fluttering slightly.
// In the pans: the left pan (+x) holds a white feather, the right pan (-x) holds two stacked bronze weights, yet both sides are level; it cares only that the weight is equal, and does not ask what has been put in.
// Personality: a by-the-book arbiter, calm, fair and a little obsessive. It stands bolt upright and left-right symmetric; when idle the beam always wobbles on its own once and then corrects back to level bit by bit.
// Gaze order: the sun disc and gem first, the beam and the two pans second, and the column, pedestal and blindfold as support.
// Back: the bow and swallowtail ribbon; on the back of the column are rows of gold-inlaid tally marks (in groups of five), the thousand verdicts it has borne.
// Restrained light effects: the emissive is kept only on the gem at the center of the sun disc, with no bloom.
// Action table: idle: the beam wobbles slightly and then corrects to level, the pans swing lightly, the ribbon flutters; move: the whole thing slides forward in jerks; charge-up act.glow lights the gem and pushes the sun disc's rays out slightly;
//   strike act.tilt presses the beam hard to one side (-1 to 1) and then springs it back; hit sways the beam widely and makes the pans swing wildly, then corrects it flat bit by bit; victory: the beam stops at perfect level and the gem flashes once.
// Anchors: head and mouth are both at the gem (no face), sun (gem), needle (needle tip), beamL / beamR (the two beam ends, L is +x), panL / panR (pan centers), base (top of the pedestal).
// act: tilt (-1 to 1), glow (0-1).

import * as THREE from 'three';
import { brilliant, lathe, loft, mergeStatic, outline, partKit, PI, rbox, slab, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const Z = v3(0, 0, 1);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i)).toArray(out, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/**
 * A band lying on a surface (belt, rope loop): P is the centerline of the band's underside and N is the surface normal; the cross-section is a rounded rectangle (width w, thickness th),
 * the whole band floats th / 2 up along the normal so the underside just touches the surface. When closed is true the ends join, otherwise both ends are rounded off.
 */
function strap(P: THREE.Vector3[], N: THREE.Vector3[], w: number, th: number, closed = false, K = 8): THREE.BufferGeometry {
  const n = P.length;
  const pos: number[] = [];
  const T = new THREE.Vector3();
  const rowOf = (i: number, scale = 1) => {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    T.subVectors(b, a).normalize();
    const nn = N[i].clone().addScaledVector(T, -N[i].dot(T)).normalize();
    const bb = new THREE.Vector3().crossVectors(T, nn).normalize();
    for (let k = 0; k < K; k++) {
      const ang = ((k + 0.5) / K) * PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const cx = Math.sign(c) * Math.abs(c) ** 0.45 * (w / 2) * scale;
      const cy = Math.sign(s) * Math.abs(s) ** 0.45 * (th / 2) * scale;
      const q = P[i].clone().addScaledVector(bb, cx).addScaledVector(nn, cy + th / 2);
      pos.push(q.x, q.y, q.z);
    }
  };
  for (let i = 0; i < n; i++) rowOf(i);
  const idx: number[] = [];
  const rows = closed ? n : n - 1;
  for (let i = 0; i < rows; i++)
    for (let k = 0; k < K; k++) {
      const i2 = (i + 1) % n;
      const k2 = (k + 1) % K;
      idx.push(i * K + k, i2 * K + k, i * K + k2, i2 * K + k, i2 * K + k2, i * K + k2);
    }
  if (!closed) {
    // One center point at each end closes it off
    for (const [i, dir] of [[0, -1], [n - 1, 1]] as [number, number][]) {
      const c = new THREE.Vector3();
      for (let k = 0; k < K; k++) c.add(v3(pos[(i * K + k) * 3], pos[(i * K + k) * 3 + 1], pos[(i * K + k) * 3 + 2]));
      c.multiplyScalar(1 / K);
      const tip = c.clone().add(P[i].clone().sub(P[i - dir]).normalize().multiplyScalar(th * 0.4));
      const ci = pos.length / 3;
      pos.push(tip.x, tip.y, tip.z);
      for (let k = 0; k < K; k++) {
        const k2 = (k + 1) % K;
        if (dir > 0) idx.push(i * K + k, ci, i * K + k2);
        else idx.push(i * K + k2, ci, i * K + k);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A membrane with thickness (saddle blanket, mane, cushion): S(u, v) is the midsurface, growing thick / 2 to each side, with the four edges rounded into lips.
 * color(u, v, side): side 1 is the outward side.
 */
function thickSheet(
  NU: number,
  NV: number,
  S: (u: number, v: number) => THREE.Vector3,
  thick: (u: number, v: number) => number,
  o: { E?: number; color?: (u: number, v: number, side: number) => THREE.Color; outward: THREE.Vector3 },
): THREE.BufferGeometry {
  const cols = NU + 1;
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
      const su = at(Math.min(cols - 1, i + 1), j).clone().sub(at(Math.max(0, i - 1), j));
      const sv = at(i, Math.min(rows - 1, j + 1)).clone().sub(at(i, Math.max(0, j - 1)));
      Su.push(su);
      Sv.push(sv);
      Nn.push(su.clone().cross(sv).normalize());
    }
  const mid = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  if (Nn[mid].dot(o.outward) < 0) for (const n of Nn) n.negate();
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
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = j * cols + i + 1;
      const c = (j + 1) * cols + i + 1;
      const d = (j + 1) * cols + i;
      tri(O[a], O[b], O[c]);
      tri(O[a], O[c], O[d]);
      tri(I[a], I[b], I[c]);
      tri(I[a], I[c], I[d]);
    }
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
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Take n even segments over 0-1, and insert one very close node on each side of cuts, so the boundary of the vertex colors is a crisp line */
function nodes(n: number, cuts: number[]): number[] {
  const s = new Set<number>();
  for (let i = 0; i <= n; i++) s.add(+(i / n).toFixed(5));
  for (const c of cuts) {
    s.add(+(c - 0.003).toFixed(5));
    s.add(+(c + 0.003).toFixed(5));
  }
  return [...s].sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 0.0015);
}

/** A round rod between two points (geometry already placed in position, so it can be merged directly) */
function rodGeo(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildBalancescaleLab(): LabModel {
  const RIMC = 0xfff0d2;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    marble: labToon(0xede6d7, { rim: 0.5, rimColor: RIMC, speckle: 0.18 }),
    brass: labToon(0xc39650, { ramp: 'metal', spec: 1.2, specTh: 0.9, rim: 0.5, rimColor: RIMC }),
    gold: labToon(0xf0c04a, { ramp: 'metal', spec: 1.5, specTh: 0.88, rim: 0.6, rimColor: RIMC }),
    bronze: labToon(0x7c5836, { ramp: 'metal', spec: 0.9, specTh: 0.93, rim: 0.45, rimColor: RIMC }),
    gem: labToon(0xffe6a0, { ramp: 'gem', emissive: 0xffa820, emissiveAmt: 0.5, spec: 1.2, specTh: 0.9, rim: 0.4, rimColor: 0xfff4d0 }),
    cloth: vc(labToon(0xffffff, { rim: 0.45, rimColor: RIMC })),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  const cWhite = col(0xfbf8f0);
  const cSilkEdge = col(0xe2b454);
  const cQuill = col(0xf2e8d2);

  const root = new THREE.Group();
  root.name = 'balancescale-lab';
  const { add, group } = partKit();
  const TALLY = 9751;

  // ── Pedestal: a three-tier beveled round platform, with a ring of gold line on the upper edge of the second tier ──
  add(root, lathe([[0.001, 0], [0.335, 0], [0.348, 0.008], [0.35, 0.038], [0.342, 0.048], [0.284, 0.05], [0.276, 0.056], [0.276, 0.086], [0.27, 0.094], [0.214, 0.097], [0.207, 0.103], [0.207, 0.128], [0.2, 0.135], [0.001, 0.135]], 44), M.marble);
  add(root, new THREE.TorusGeometry(0.276, 0.0065, 6, 44).rotateX(PI / 2), M.gold, [0, 0.089, 0]);

  // ── Column: base, a slightly tapered shaft, two brass bands and a flared capital ──
  const body = group(root);
  add(body, lathe([
    [0.001, 0.13], [0.105, 0.13], [0.108, 0.142], [0.102, 0.154], [0.088, 0.16], [0.086, 0.17], [0.078, 0.18], [0.07, 0.192], [0.068, 0.21],
    [0.066, 0.4], [0.063, 0.65], [0.058, 0.9], [0.056, 0.96],
    [0.062, 0.975], [0.078, 1.0], [0.094, 1.03], [0.1, 1.055], [0.1, 1.07], [0.096, 1.078], [0.001, 1.078],
  ], 28), M.marble);
  for (const [y, r] of [[0.36, 0.066], [0.68, 0.0625]] as [number, number][]) add(body, new THREE.TorusGeometry(r + 0.001, 0.0085, 6, 28).rotateX(PI / 2), M.brass, [0, y, 0]);

  // Tally marks on the back: rows of gold-inlaid marks behind the shaft, in groups of four straight strokes and one slanting stroke
  for (const y of [0.44, 0.52, 0.6])
    for (const g0 of [-0.36, 0.36]) {
      const r = lerp(0.066, 0.063, (y - 0.4) / 0.25);
      for (let k = 0; k < 5; k++) {
        const g = group(body, [0, y, 0], [0, PI + g0 + (k < 4 ? (k - 1.5) * 0.16 : 0), 0]);
        const bar = add(g, new THREE.BoxGeometry(0.0048, k < 4 ? 0.05 : 0.066, 0.004), M.gold, [0, 0, r + 0.0006]);
        if (k === 4) bar.rotation.z = 0.95;
        bar.userData.inkGroup = TALLY;
      }
    }

  // ── Fulcrum: the seat on the capital, two lug plates clamping the beam and the axle running across ──
  add(body, rbox(0.12, 0.03, 0.15, 0.008), M.brass, [0, 1.093, 0]);
  for (const sz of [-1, 1]) add(body, rbox(0.06, 0.075, 0.012, 0.005), M.brass, [0, 1.14, sz * 0.034]);
  add(body, new THREE.CylinderGeometry(0.011, 0.011, 0.11, 10).rotateX(PI / 2), M.brass, [0, 1.165, 0]);

  // ── Dawn sun disc: a gold disc standing up behind the top of the column, with twelve rays of alternating long and short lengths and a dawn-gold gem at the center ──
  add(body, rbox(0.024, 0.2, 0.016, 0.006), M.brass, [0, 1.19, -0.062]);
  const sunG = group(body, [0, 1.385, -0.062]);
  add(sunG, lathe([[0.001, -0.016], [0.1, -0.014], [0.108, -0.008], [0.108, 0.006], [0.1, 0.014], [0.06, 0.019], [0.001, 0.021]], 32).rotateX(PI / 2), M.gold);
  {
    const pts: [number, number][] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * PI * 2 + PI / 2;
      const R = k % 2 === 0 ? 0.2 : 0.158;
      pts.push([Math.cos(a) * R, Math.sin(a) * R]);
      const b = a + PI / 12;
      pts.push([Math.cos(b) * 0.092, Math.sin(b) * 0.092]);
    }
    add(sunG, slab(outline(pts), 0.012, 0.003, 1), M.gold, [0, 0, -0.004]);
  }
  add(sunG, new THREE.TorusGeometry(0.047, 0.0065, 8, 24), M.brass, [0, 0, 0.02]);
  add(sunG, brilliant(0.045, 0.022, 0.03, 8).rotateX(PI / 2), M.gem, [0, 0, 0.02]);

  // ── Beam: thick in the middle and tapering at the ends with a slight upward curve, the ends finials of a ball plus a small pointed cap; the round hub at the center extends a needle upward ──
  const beamG = group(body, [0, 1.165, 0]);
  {
    const pts: THREE.Vector3[] = [];
    for (let i = -6; i <= 6; i++) {
      const x = (0.52 * i) / 6;
      pts.push(v3(x, 0.02 * Math.abs(x / 0.52) ** 3, 0));
    }
    add(beamG, loft(pts, (t) => {
      const c = 1 - Math.abs(2 * t - 1);
      return [0.012 + 0.009 * c, 0.013 + 0.02 * c ** 1.5];
    }, { segs: 36, radial: 12 }), M.brass);
    for (const sx of [-1, 1]) {
      add(beamG, new THREE.SphereGeometry(0.026, 12, 8), M.brass, [sx * 0.535, 0.02, 0]);
      add(beamG, new THREE.ConeGeometry(0.011, 0.045, 8), M.brass, [sx * 0.535, 0.062, 0]);
      add(beamG, new THREE.TorusGeometry(0.017, 0.0055, 6, 14), M.brass, [sx * 0.535, -0.024, 0]);
    }
    // The axle's round hub comes out from between the two lug plates, with a gold dome on the front
    add(beamG, new THREE.CylinderGeometry(0.03, 0.03, 0.1, 20).rotateX(PI / 2), M.brass);
    add(beamG, new THREE.SphereGeometry(0.02, 10, 6, 0, PI * 2, 0, PI / 2).rotateX(PI / 2), M.gold, [0, 0, 0.049]);
    const needle = rbox(0.02, 0.11, 0.008, 0.003);
    const pa = needle.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setX(i, pa.getX(i) * lerp(1, 0.2, (pa.getY(i) + 0.055) / 0.11));
    needle.computeVertexNormals();
    add(beamG, needle, M.gold, [0, 0.085, 0.056]);
  }

  // ── Pans: a hook, a hanging rod, a small ring, and three hanging rods (one directly in front), with a shallow bowl-shaped brass pan; the pan always stays level ──
  const pans: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const pg = group(beamG, [sx * 0.535, -0.042, 0]);
    pans.push({ g: pg, sx });
    add(pg, new THREE.CylinderGeometry(0.0065, 0.0065, 0.105, 8), M.brass, [0, -0.05, 0]);
    add(pg, new THREE.TorusGeometry(0.016, 0.0055, 6, 14).rotateX(PI / 2), M.brass, [0, -0.105, 0]);
    for (const th of [PI / 2, PI / 2 + (2 * PI) / 3, PI / 2 + (4 * PI) / 3]) {
      const a = v3(Math.cos(th) * 0.014, -0.107, Math.sin(th) * 0.014);
      const b = v3(Math.cos(th) * 0.166, -0.51, Math.sin(th) * 0.166);
      add(pg, rodGeo(a, b, 0.0062), M.brass);
      add(pg, new THREE.SphereGeometry(0.0095, 8, 6), M.brass, [b.x, b.y, b.z]);
    }
    add(pg, lathe([[0.001, -0.585], [0.05, -0.588], [0.11, -0.575], [0.15, -0.552], [0.172, -0.525], [0.178, -0.516], [0.176, -0.51], [0.168, -0.51], [0.16, -0.52], [0.13, -0.545], [0.08, -0.558], [0.001, -0.561]], 28), M.brass);
    add(pg, new THREE.SphereGeometry(0.016, 8, 6), M.brass, [0, -0.592, 0]);

    if (sx > 0) {
      // Left pan: one white feather, its quill resting on the bottom of the pan and the feather tip curling up forward out past the pan's edge; one side of the vane narrow and one wide, with two splits
      const shaft = new THREE.CatmullRomCurve3([v3(-0.07, -0.55, -0.04), v3(-0.02, -0.48, 0.0), v3(0.05, -0.37, 0.05), v3(0.1, -0.26, 0.08)], false, 'centripetal');
      add(pg, paint(loft(shaft.points, (t) => [0.0065 * (1 - t) + 0.0015, 0.0065 * (1 - t) + 0.0015], { segs: 16, radial: 6 }), () => cQuill), M.cloth);
      const nRef = v3(-0.35, 1, 0.55).normalize();
      const S = (u: number, v: number) => {
        const t = lerp(0.1, 1, v);
        const C = shaft.getPointAt(t);
        const T = shaft.getTangentAt(t);
        const side = new THREE.Vector3().crossVectors(T, nRef).normalize();
        const s = 2 * u - 1;
        const narrow = s < 0 ? 0.72 : 1;
        const notch = s > 0 ? 1 - 0.55 * Math.exp(-(((v - 0.45) / 0.035) ** 2)) - 0.45 * Math.exp(-(((v - 0.72) / 0.03) ** 2)) : 1;
        const w = 0.046 * Math.sin(PI * Math.min(1, v * 0.92 + 0.08)) ** 0.6 * narrow * notch;
        return C.addScaledVector(side, s * w).addScaledVector(nRef, 0.01 * s * s);
      };
      add(pg, thickSheet(8, 28, S, () => 0.005, { E: 2, outward: nRef, color: (u, v) => cWhite.clone().lerp(col(0xdfe6ef), 0.4 * Math.abs(2 * u - 1)) }), M.cloth);
    } else {
      // Right pan: two stacked bronze weights, with a handle knob on top
      const prof: [number, number][] = [[0.001, -0.556], [0.062, -0.556], [0.067, -0.551], [0.067, -0.512], [0.062, -0.506], [0.046, -0.506], [0.043, -0.5], [0.043, -0.47], [0.039, -0.465], [0.013, -0.465], [0.013, -0.458], [0.018, -0.449], [0.016, -0.439], [0.008, -0.435], [0.001, -0.435]];
      add(pg, lathe(prof.map(([r, y]) => [r * 1.3, -0.556 + (y + 0.556) * 1.3] as [number, number]), 20), M.bronze);
    }
  }

  // ── Blindfold: a band of white silk tied around the column under the capital, tied into a bow at the back with two swallowtails hanging down (gold trim) ──
  const RY = 0.925;
  const RR = 0.0575;
  {
    const P: THREE.Vector3[] = [];
    const N: THREE.Vector3[] = [];
    for (let i = 0; i < 36; i++) {
      const th = (i / 36) * PI * 2;
      const n = v3(Math.sin(th), 0, Math.cos(th));
      P.push(n.clone().multiplyScalar(RR).setY(RY));
      N.push(n);
    }
    add(body, paint(strap(P, N, 0.05, 0.01, true), () => cWhite), M.cloth);
    const C = v3(0, RY, -RR - 0.012);
    for (const sx of [-1, 1]) {
      // Teardrop-shaped loops: the pointed end tucked into the knot and the round end curling outward and up
      const tilt = 0.38;
      const LP: THREE.Vector3[] = [];
      const LN: THREE.Vector3[] = [];
      for (let i = 0; i < 24; i++) {
        const ph = (i / 24) * PI * 2;
        const k = 0.5 - 0.5 * Math.cos(ph);
        const r = 0.058 * k ** 0.8;
        const q = v3(0.012 + r * k * 1.2, Math.sin(ph) * r * 0.42, 0);
        const qx = q.x * Math.cos(tilt) - q.y * Math.sin(tilt);
        const qy = q.x * Math.sin(tilt) + q.y * Math.cos(tilt);
        LP.push(C.clone().add(v3(sx * qx, qy, -0.012 * k)));
      }
      const Lc = LP.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / LP.length);
      for (const p of LP) LN.push(p.clone().sub(Lc).setZ(0).normalize());
      add(body, paint(strap(LP, LN, 0.05, 0.009, true), () => cWhite), M.cloth);
    }
    add(body, paint(new THREE.SphereGeometry(1, 12, 8), () => cWhite), M.cloth, [C.x, C.y, C.z - 0.004], [0, 0, 0], [0.02, 0.024, 0.015]);
  }
  const tails: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const tg = group(body, [0, RY - 0.01, -RR - 0.018]);
    tails.push({ g: tg, sx });
    const U = [0, 0.12, 0.13, 0.3, 0.5, 0.7, 0.87, 0.88, 1];
    const dir = v3(sx * 0.1, -1, -0.42).normalize();
    const lat = v3(1, sx * 0.15, 0).normalize();
    const L = 0.3;
    const S = (s: number, v: number) => {
      const u = U[Math.round(s * (U.length - 1))];
      const len = L * (1 - 0.13 * (1 - Math.abs(2 * u - 1)));
      const along = v * len;
      return dir.clone().multiplyScalar(along).addScaledVector(lat, (u - 0.5) * 0.042 * (1 + 0.25 * v)).add(v3(0, 0, 0.018 * Math.sin(v * 5 + sx) * v));
    };
    add(tg, thickSheet(U.length - 1, 12, S, () => 0.007, {
      E: 2,
      outward: v3(0, 0, -1),
      color: (s) => {
        const u = U[Math.round(s * (U.length - 1))];
        return u < 0.125 || u > 0.875 ? cSilkEdge.clone() : cWhite.clone();
      },
    }), M.cloth);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: every so often the beam wobbles on its own and then corrects back to level bit by bit; the pans swing along and the ribbon flutters ──
  const act = { tilt: 0, glow: 0 };
  const gemEm = M.gem.emissiveIntensity;
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const ph = t % 6.5;
    const wob = 0.055 * Math.exp(-ph * 0.9) * Math.sin(ph * 3.4) + 0.004 * Math.sin(t * 0.7);
    const tilt = wob + act.tilt * 0.38;
    beamG.rotation.z = tilt;
    for (const p of pans) {
      p.g.rotation.z = -tilt - wob * 0.35 + Math.sin(t * 1.3 + p.sx) * 0.015;
      p.g.rotation.x = Math.sin(t * 0.9 + p.sx * 1.3) * 0.022;
    }
    body.position.y = Math.sin(t * 1.1) * 0.004;
    for (const r of tails) {
      r.g.rotation.x = -0.04 + Math.sin(t * 1.4 + r.sx) * 0.07;
      r.g.rotation.z = Math.sin(t * 1.1 + r.sx * 2) * 0.05;
    }
    sunG.scale.setScalar(1 + act.glow * 0.06);
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.gem.emissiveIntensity = gemEm + act.glow * 0.8;
    }
  };
  update(0);

  const pL = pans.find((p) => p.sx > 0)!.g;
  const pR = pans.find((p) => p.sx < 0)!.g;
  const rig = {
    head: group(sunG, [0, 0, 0.045]),
    eyes: [] as THREE.Object3D[],
    anchors: {
      mouth: group(sunG, [0, 0, 0.046]),
      sun: group(sunG, [0, 0, 0.044]),
      needle: group(beamG, [0, 0.14, 0.056]),
      beamL: group(beamG, [0.535, 0.02, 0]),
      beamR: group(beamG, [-0.535, 0.02, 0]),
      panL: group(pL, [0, -0.54, 0]),
      panR: group(pR, [0, -0.54, 0]),
      base: group(root, [0, 0.135, 0]),
    },
  };
  mergeStatic(root, { owners: [body, beamG, sunG, ...pans.map((p) => p.g), ...tails.map((r) => r.g)], rig });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.8, 0), radius: 0.86 };
}
