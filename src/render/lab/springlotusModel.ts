// Springlotus, the Starspring Lotus Lady (model lab version, fully redone 2026-09-28): an ancient spring deep in the Verdantwhisper Forest, whose eye since the Night of the Shattered Heart can only bubble up scattered spirit energy.
// A lotus took root over the spring's eye and hands the spirit energy out bit by bit to passing contractors; after fights the spirits line up at the spring to drink, and no one has ever cut in line.
// The "Lady" in the name does not mean a humanoid form: the whole thing is one lotus, with the nobility coming from the flower crown, the upright posture and the light, with no face and no doll.
// Identifying features:
// - A big lotus flower on top: three layers of white petals with pink tips, the outer layer spread open and the inner layer cupping the center; the center is a pale gold seed pod with a ring of gold stamens like a crown, and seven cyan-glowing lotus seeds on the pod (the stars of the Starspring).
// - A lotus leaf held out forward: a deep cup-shaped leaf at the front right, its center holding a big glowing water drop (the spirit energy handed to the contractor).
// - The ancient spring's stone basin: eight separate blocks of stone ringed around, with recessed mortar between the blocks, and one block in front pressed low into an overflow spout from which the water runs down (the place where the spirits line up to drink).
// - Roots: olive-brown roots crawl out of the spring water, lie along the stone edge, climb over it and grip the basin, with their ends forking on the ground.
// Body shape: a lotus standing in the basin: a long S-shaped stem holds up the flower, which leans slightly forward; a bud on the left, a leaf held out at the front right, and a big leaf floating on the water at the back left, resting on the stone edge.
// Personality: a composed hostess at the spring: standing straight, always handing out the fullest cup first, careful about first come, first served.
// Gaze order: the flower (the brightest on the body: white-pink petals with cyan-glowing seeds) first, the held-out leaf and the water drop second; the bud, floating leaf, basin and roots are all support.
// Back: the stone behind the basin has split in two, and the star pattern carved on it is broken too; a root climbs over the stone edge and lies along the outer wall across the crack, binding the two halves together, and two more also grip the basin, as if holding the shattered ancient spring together.
// Restrained light effects: no bloom and no translucent shell; the emissive is only in two places, the lotus seeds and the water drop at the leaf center.
// <Action table>
// - Idle: the petals slowly open and close like breathing, the flower slowly turns left and right to look around, the long stem sways lightly with the water; the held-out leaf gently rises and falls, the water drop floats slightly; the spring's eye sends out a ring of ripples every few seconds.
// - Move: the whole basin translates, the flower leans back with the petals half closed, and the leaf draws back to shield the water drop.
// - Charge-up (act.gather): the petals fold in layer by layer into a bud, and the seeds brighten.
// - Strike (act.bloom): the petals open fully all at once and the flower tips slightly forward, and the spirit energy is sent out from the pod anchor; the held-out leaf tips forward at the same time.
// - Hit: the long stem whips back and then slowly returns upright, the petals tremble once; the basin does not move (the roots are anchored on the spring's eye).
// - Victory (act.bow): the flower opens completely and slowly bows forward, and the leaf is raised high.
// Anchors: head (center of the top of the seed pod), eyes (center of the group of lotus seeds, which turn red when corrupted), mouth (above the top of the seed pod, where the spirit energy comes out), pod (same as mouth),
//   drop (the held-out water drop), spout (overflow spout), bud (bud tip), leaf (center of the floating leaf at the back left), well (the spring's eye, center of the water surface).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, mergeStatic, outline, partKit, PI, rng, slab, wedge, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Geometry helpers ─────────────────────────

/**
 * Parametric surface: rows × cols, P(i, j) gives the position and C(i, j) the vertex color; columns always wrap around (each row is a closed cross-section).
 * For a row that closes to a point (the poles at the two ends) the normal is the average of that row, and degenerate triangles are dropped.
 * Winding: when want is given, the normals as a whole must face want; when not given, at the point of the middle row farthest from the cross-section center the normal must face away from the center.
 */
function grid(rows: number, cols: number, P: (i: number, j: number) => THREE.Vector3, C?: (i: number, j: number) => THREE.Color, want?: THREE.Vector3): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const cc = C ? new Float32Array(rows * cols * 3) : null;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const k = (i * cols + j) * 3;
      P(i, j).toArray(pos, k);
      if (cc) C!(i, j).toArray(cc, k);
    }
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const D = new THREE.Vector3();
  const idx: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    A.fromArray(pos, a * 3);
    B.fromArray(pos, b * 3).sub(A);
    D.fromArray(pos, c * 3).sub(A);
    if (B.cross(D).lengthSq() < 1e-18) return;
    idx.push(a, b, c);
  };
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + ((j + 1) % cols);
      const d = i * cols + ((j + 1) % cols);
      tri(a, b, d);
      tri(b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (cc) g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const N = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < rows; i++) {
    A.fromArray(pos, i * cols * 3);
    let pole = true;
    for (let j = 1; j < cols && pole; j++) if (B.fromArray(pos, (i * cols + j) * 3).distanceToSquared(A) > 1e-14) pole = false;
    if (!pole) continue;
    const s = new THREE.Vector3();
    for (let j = 0; j < cols; j++) s.add(B.fromBufferAttribute(N, i * cols + j));
    if (s.lengthSq() < 1e-12) continue;
    s.normalize();
    for (let j = 0; j < cols; j++) N.setXYZ(i * cols + j, s.x, s.y, s.z);
  }
  let score = 0;
  if (want) {
    for (let i = 0; i < N.count; i++) score += B.fromBufferAttribute(N, i).dot(want);
  } else {
    const mid = Math.floor(rows / 2);
    const c0 = new THREE.Vector3();
    for (let j = 0; j < cols; j++) c0.add(A.fromArray(pos, (mid * cols + j) * 3));
    c0.divideScalar(cols);
    let best = -1;
    let bj = 0;
    for (let j = 0; j < cols; j++) {
      const d = A.fromArray(pos, (mid * cols + j) * 3).distanceToSquared(c0);
      if (d > best) {
        best = d;
        bj = j;
      }
    }
    score = B.fromBufferAttribute(N, mid * cols + bj).dot(A.fromArray(pos, (mid * cols + bj) * 3).sub(c0));
  }
  if (score < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    for (let i = 0; i < N.count; i++) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i));
  }
  return g;
}

/** A round tube along a curve: parallel-transport frame (does not twist even when upright or curving back), and a radius table with 0 at the ends closes them */
function tube(pts: THREE.Vector3[], rad: (t: number) => number, segs: number, radial: number, C?: (t: number, a: number) => THREE.Color): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const fr = curve.computeFrenetFrames(segs, false);
  const P = new THREE.Vector3();
  return grid(
    segs + 1,
    radial,
    (i, j) => {
      const t = i / segs;
      curve.getPointAt(t, P);
      const a = (j / radial) * PI * 2;
      const r = rad(t);
      return P.clone().addScaledVector(fr.normals[i], Math.cos(a) * r).addScaledVector(fr.binormals[i], Math.sin(a) * r);
    },
    C ? (i, j) => C(i / segs, (j / radial) * PI * 2) : undefined,
  );
}

/** Make the object's y axis point along yDir and its z axis face zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Per-vertex part index: lines are still drawn between parts inside the same mesh (both ink.ts and inkPipeline recognize this attribute) */
function tagPart(g: THREE.BufferGeometry, p: number): THREE.BufferGeometry {
  g.setAttribute('inkPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(p), 1));
  return g;
}

// ───────────────────────── Petals ─────────────────────────

// Sampling of the petal along its length: denser near the petal tip and petal base
const PETAL_V = [0, 0.03, 0.08, 0.16, 0.27, 0.4, 0.53, 0.65, 0.76, 0.85, 0.92, 0.97, 1];
// Width: narrow at the petal base, widest a little above the middle, with the tip tapering to a point (a lotus petal is obovate with a point)
const PETAL_W = curveTable([[0, 0], [0.03, 0.26], [0.1, 0.48], [0.3, 0.8], [0.5, 0.96], [0.62, 1], [0.75, 0.9], [0.86, 0.66], [0.94, 0.36], [1, 0]]);
const PETAL_T = curveTable([[0, 0], [0.05, 0.8], [0.4, 1], [0.85, 0.72], [1, 0]]);
const WHITE = col(0xfdf7ef);
const PINK = col(0xef7fa3);
const BASEG = col(0xe6edbd);

interface PetalOpts {
  L: number;
  W: number;
  T: number;
  /** Cup depth across the width (the petal edges curl inward) */
  cup: number;
  /** The petal tip curls inward */
  curl: number;
  /** The amount of pink (the bud is pinker) */
  blush?: number;
}

/**
 * One lotus petal with thickness: the petal base at the origin growing along +y, with the concave side (the inner face) facing +z. The cross-section is a flat lens, closed all the way around, with the petal tip and petal base closing to a point.
 * Color: white base, gradually turning pink toward the petal tip and edges, with the outside a little pinker than the inside and a touch of pale yellow-green at the petal base.
 */
function petalGeo(o: PetalOpts, cols = 12): THREE.BufferGeometry {
  const bl = o.blush ?? 0;
  return grid(
    PETAL_V.length,
    cols,
    (i, j) => {
      const s = PETAL_V[i];
      const a = (j / cols) * PI * 2;
      const u = Math.cos(a);
      const w = o.W * PETAL_W(s)[0];
      const x = u * w;
      const z = (o.cup * x * x) / o.W + o.curl * o.L * s * s + Math.sin(a) * o.T * 0.5 * PETAL_T(s)[0];
      return v(x, o.L * s, z);
    },
    (i, j) => {
      const s = PETAL_V[i];
      const a = (j / cols) * PI * 2;
      const u = Math.abs(Math.cos(a));
      const outer = Math.sin(a) < 0 ? 0.08 : 0;
      const k = THREE.MathUtils.clamp(ss(s, 0.46 - bl * 0.3, 1.0) * (0.8 + bl * 0.15) + u ** 4 * 0.2 * s + outer + bl * 0.25, 0, 1);
      const c = WHITE.clone().lerp(PINK, k);
      return c.lerp(BASEG, (1 - ss(s, 0.02, 0.2)) * 0.7);
    },
  );
}

interface RingSpec {
  n: number;
  /** Distance of the petal base from the flower axis, and height */
  r0: number;
  y0: number;
  /** The angle the petal leans outward from upright */
  alpha: number;
  /** Starting phase (in units of one petal) */
  off: number;
  petal: PetalOpts;
}

/** One layer of petals: merged into one mesh (per-vertex part indices keep lines between adjacent petals), turning on the CPU each frame about their own petal bases to open and close */
interface PetalRing {
  mesh: THREE.Mesh;
  hinge: THREE.Vector3[];
  axis: THREE.Vector3[];
  of: Uint16Array;
  rest: Float32Array;
  restN: Float32Array;
  last: number;
}

function petalRing(parent: THREE.Object3D, s: RingSpec, mat: THREE.Material, rand: () => number): PetalRing {
  const geos: THREE.BufferGeometry[] = [];
  const hinge: THREE.Vector3[] = [];
  const axis: THREE.Vector3[] = [];
  const counts: number[] = [];
  const parts = s.n % 2 ? 3 : 2;
  for (let k = 0; k < s.n; k++) {
    const phi = ((k + s.off) / s.n) * PI * 2 + (rand() - 0.5) * 0.08;
    const alt = k % 2 ? 1 : -1;
    const al = s.alpha + alt * 0.075 + (rand() - 0.5) * 0.03;
    const R = v(Math.sin(phi), 0, Math.cos(phi));
    const Y = UP.clone().multiplyScalar(Math.cos(al)).addScaledVector(R, Math.sin(al));
    const Z = UP.clone().multiplyScalar(Math.sin(al)).addScaledVector(R, -Math.cos(al));
    const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
    const h = R.clone().multiplyScalar(s.r0 + alt * 0.007).addScaledVector(UP, s.y0 - alt * 0.006);
    const sc = 1 + (rand() - 0.5) * 0.07;
    // The outer petal (alt = 1) is a little narrower and its cup shallower, so the petal edge does not poke out through the outside of the inner petal
    const g = petalGeo({ ...s.petal, L: s.petal.L * sc, W: s.petal.W * (alt > 0 ? 0.92 : 1), cup: s.petal.cup * (alt > 0 ? 0.85 : 1) });
    g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(h));
    tagPart(g, k % parts);
    geos.push(g);
    hinge.push(h);
    axis.push(X);
    counts.push(g.attributes.position.count);
  }
  const geo = mergeGeometries(geos, false)!;
  geo.userData.inkParts = parts;
  const of = new Uint16Array(geo.attributes.position.count);
  let o = 0;
  counts.forEach((c, k) => {
    of.fill(k, o, o + c);
    o += c;
  });
  (geo.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  (geo.attributes.normal as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.layers.enable(INK_LAYER);
  parent.add(mesh);
  return {
    mesh,
    hinge,
    axis,
    of,
    rest: Float32Array.from(geo.attributes.position.array as Float32Array),
    restN: Float32Array.from(geo.attributes.normal.array as Float32Array),
    last: NaN,
  };
}

/** Each petal turns about its own petal base by open (positive opens outward) plus its own small jitter */
function bendRing(r: PetalRing, open: number, flutter: (k: number) => number): void {
  const key = open + flutter(0) * 7.1 + flutter(1) * 3.3;
  if (key === r.last) return;
  r.last = key;
  const qs = r.hinge.map((_, k) => new THREE.Quaternion().setFromAxisAngle(r.axis[k], -(open + flutter(k))));
  const P = r.mesh.geometry.attributes.position as THREE.BufferAttribute;
  const N = r.mesh.geometry.attributes.normal as THREE.BufferAttribute;
  const pa = P.array as Float32Array;
  const na = N.array as Float32Array;
  const p = new THREE.Vector3();
  for (let i = 0; i < r.of.length; i++) {
    const k = r.of[i];
    const h = r.hinge[k];
    p.set(r.rest[i * 3] - h.x, r.rest[i * 3 + 1] - h.y, r.rest[i * 3 + 2] - h.z).applyQuaternion(qs[k]).add(h);
    pa[i * 3] = p.x;
    pa[i * 3 + 1] = p.y;
    pa[i * 3 + 2] = p.z;
    p.set(r.restN[i * 3], r.restN[i * 3 + 1], r.restN[i * 3 + 2]).applyQuaternion(qs[k]);
    na[i * 3] = p.x;
    na[i * 3 + 1] = p.y;
    na[i * 3 + 2] = p.z;
  }
  P.needsUpdate = true;
  N.needsUpdate = true;
}

// ───────────────────────── Lotus leaf ─────────────────────────

interface LeafOpts {
  R: number;
  /** Cup depth: the leaf edge rises above the leaf center by cup × R */
  cup: number;
  /** Height and number of cycles of the leaf-edge waves */
  wave: number;
  waves: number;
  T: number;
  veins: number;
  phase?: number;
}

const LEAF_TOP = col(0x5f9f58);
const LEAF_EDGE = col(0x4f8c4c);
const LEAF_VEIN = col(0x9ccb7e);
const LEAF_EYE = col(0xc9dc93);
const LEAF_UNDER = col(0x9fc4a4);
const LEAF_RIB = col(0xc6dcc2);

/**
 * A peltate round lotus leaf: the stalk joins at the exact center of the underside, the leaf face curls up from the center outward into a shallow cup, and the leaf edge has rising and falling waves.
 * One whole sheet with thickness: rows run from the center of the leaf face outward, around the rounded leaf edge, and back to the center from the outer rim of the underside; columns go around once, each vein taking three columns (on the vein and on both sides),
 * so the pale color of the veins is a thin crisp line (sample points are placed on the features, pitfall 82). A small ring of pale yellow-green at the leaf center. +y is the leaf face normal and the leaf center is at the origin.
 */
function leafGeo(o: LeafOpts): THREE.BufferGeometry {
  const angs: number[] = [];
  const kind: number[] = [];
  const d = 0.032;
  const half = PI / o.veins;
  for (let k = 0; k < o.veins; k++) {
    const a = k * 2 * half;
    angs.push(a - d, a, a + d, a + half);
    kind.push(0, 1, 0, 0);
  }
  const RS = [0, 0.07, 0.16, 0.3, 0.45, 0.6, 0.74, 0.86, 0.95, 1];
  const ph = o.phase ?? 0;
  const rimR = (a: number) => o.R * (1 + 0.035 * Math.sin(o.waves * a + ph + 1.3) + 0.02 * Math.sin(3 * a + ph));
  const hgt = (r: number, a: number) => o.R * (o.cup * r * r + o.wave * r * r * r * Math.sin(o.waves * a + ph));
  const th = (r: number) => o.T * (1 - 0.45 * r);
  type Row = { r: number; side: 1 | 0 | -1 };
  const rows: Row[] = [...RS.map((r) => ({ r, side: 1 as const })), { r: 1, side: 0 as const }, ...[...RS].reverse().map((r) => ({ r, side: -1 as const }))];
  return grid(
    rows.length,
    angs.length,
    (i, j) => {
      const { r, side } = rows[i];
      const a = angs[j];
      const rr = side === 0 ? rimR(a) + o.T * 0.35 : r * rimR(a);
      const y = hgt(r, a) + (side === 0 ? 0 : side * th(r) * 0.5);
      return v(Math.sin(a) * rr, y, Math.cos(a) * rr);
    },
    (i, j) => {
      const { r, side } = rows[i];
      if (side >= 0) {
        const c = LEAF_TOP.clone().lerp(LEAF_EDGE, ss(r, 0.7, 1) * 0.8);
        if (kind[j] === 1) c.lerp(LEAF_VEIN, (1 - ss(r, 0.8, 0.97)) * ss(r, 0.05, 0.14));
        return c.lerp(LEAF_EYE, 1 - ss(r, 0.08, 0.15));
      }
      const c = LEAF_UNDER.clone();
      if (kind[j] === 1) c.lerp(LEAF_RIB, 1 - ss(r, 0.85, 0.98));
      return c;
    },
    UP.clone(),
  );
}

/** A flat water surface: vertex colors in rings outward from the center (deep at the spring's eye, pale for ripples, bright where it reflects near the stone edge) */
function waterGeo(R: number, cols = 48): THREE.BufferGeometry {
  const RS = [0, 0.06, 0.13, 0.2, 0.44, 0.5, 0.56, 0.75, 0.84, 0.9, 1];
  const deep = col(0x2f7f8f);
  const mid = col(0x4aa2b0);
  const pale = col(0x86cfd0);
  return grid(
    RS.length,
    cols,
    (i, j) => {
      const a = (j / cols) * PI * 2;
      return v(Math.sin(a) * RS[i] * R, 0, Math.cos(a) * RS[i] * R);
    },
    (i) => {
      const r = RS[i];
      const c = deep.clone().lerp(mid, ss(r, 0.06, 0.2));
      if (r === 0.5) c.lerp(pale, 0.55);
      if (r === 0.9 || r === 1) c.lerp(pale, 0.8);
      return c;
    },
    UP.clone(),
  );
}

// ───────────────────────── Shape ─────────────────────────

export function buildSpringlotusLab(): LabModel {
  const rand = rng(20260929);
  const vc = <T extends THREE.Material>(m: T): T => {
    (m as unknown as THREE.MeshToonMaterial).vertexColors = true;
    return m;
  };
  const RIM_P = 0xffe2ee;
  const RIM_G = 0xd9f6cf;
  const M = {
    petal: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIM_P })),
    stamen: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xfff1bc })),
    pod: labToon(0xd8cf74, { rim: 0.35, rimColor: 0xfff4c8 }),
    seed: labToon(0x9ff2ff, { ramp: 'gem', emissive: 0x27c3ea, emissiveAmt: 0.85, rim: 0, spec: 0.7, specTh: 0.97 }),
    stem: labToon(0x6a9a4e, { rim: 0.45, rimColor: RIM_G }),
    leaf: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIM_G })),
    drop: labToon(0xa6f1ff, { ramp: 'gem', emissive: 0x36c2ea, emissiveAmt: 0.65, rim: 0.3, rimColor: 0xe8fdff, spec: 1.1, specTh: 0.975 }),
    stone: labToon(0x8c97a5, { rim: 0.35, rimColor: 0xdae6f2, speckle: 0.45 }),
    mortar: labToon(0x4b505b, { rim: 0 }),
    relief: labToon(0xb9c5cf, { rim: 0.3, rimColor: 0xe6f0f8, speckle: 0.25 }),
    moss: labToon(0x78a450, { rim: 0.4, rimColor: RIM_G }),
    water: vc(labToon(0xffffff, { ramp: 'gem', rim: 0, spec: 0.5, specTh: 0.992 })),
    ripple: labToon(0x9edbd9, { ramp: 'gem', rim: 0 }),
    root: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xfff2dc })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'springlotus-lab';
  const { add, group } = partKit();

  // ── Basin: eight separate curved blocks of stone (one in front pressed low into the overflow spout and one at the back split in two), with recessed mortar in the cracks between the stones ──
  const R_IN = 0.37;
  const R_OUT = 0.49;
  const BEV = 0.02;
  const WATER_Y = 0.212;
  const basin = group(root);
  /** Convert the azimuth phi (from +z toward +x) into the wedge's angle in the shape plane */
  const toA = (phi: number) => phi - PI / 2;
  const block = (parent: THREE.Object3D, p0: number, p1: number, h: number, mat: THREE.Material = M.stone) => {
    const g = slab(wedge(R_IN, R_OUT, toA(p0), toA(p1)), h - BEV * 2, BEV, 6);
    g.rotateX(-PI / 2);
    g.translate(0, h / 2, 0);
    return add(parent, g, mat);
  };
  const GAP = 0.13;
  const tops: { phi: number; h: number }[] = [];
  for (let k = 0; k < 8; k++) {
    const phi = (k / 8) * PI * 2;
    const p0 = phi - PI / 8 + GAP / 2;
    const p1 = phi + PI / 8 - GAP / 2;
    const h = k === 0 ? WATER_Y - 0.018 : 0.245 + (rand() - 0.5) * 0.03;
    if (k === 4) {
      // The block that splits at the back: the two halves each lean outward a little, with a crack wide at the top and narrow at the bottom
      for (const sgn of [-1, 1]) {
        const hg = group(basin);
        const R = v(Math.sin(phi), 0, Math.cos(phi));
        hg.quaternion.setFromAxisAngle(R, sgn * 0.075);
        // The right half leans outward and sinks down, with the break offset top to bottom so it reads as cracked
        if (sgn > 0) {
          hg.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(v(Math.cos(phi), 0, -Math.sin(phi)), -0.07));
          hg.position.y = -0.012;
        }
        const a0 = sgn < 0 ? p0 : phi + 0.05;
        const a1 = sgn < 0 ? phi - 0.05 : p1;
        block(hg, a0, a1, h - (sgn > 0 ? 0.012 : 0));
        // The star pattern carved on the outside splits in two along with it
        const S = 0.062;
        const s = 0.022;
        const halfStar: [number, number][] =
          sgn < 0
            ? [[0, S], [-s * 0.7, s * 0.7], [-S, 0], [-s * 0.7, -s * 0.7], [0, -S], [-0.004, 0]]
            : [[0.004, 0], [0, -S], [s * 0.7, -s * 0.7], [S, 0], [s * 0.7, s * 0.7], [0, S]];
        const rel = add(hg, slab(outline(halfStar), 0.012, 0.004, 2), M.relief);
        const off = sgn * 0.012;
        rel.position.copy(R).multiplyScalar(R_OUT + BEV + 0.004).addScaledVector(v(Math.cos(phi), 0, -Math.sin(phi)), -off).setY(0.1);
        rel.rotation.y = phi;
      }
    } else block(basin, p0, p1, h);
    tops.push({ phi, h });
  }
  // Mortar core: shown only through the cracks between stones; not made at the overflow spout in front, so no black patch shows above the pressed-low block
  add(basin, new THREE.LatheGeometry([new THREE.Vector2(R_OUT - 0.035, 0.005), new THREE.Vector2(R_OUT - 0.035, WATER_Y - 0.01), new THREE.Vector2(R_IN - 0.005, WATER_Y - 0.01), new THREE.Vector2(R_IN - 0.005, 0.005), new THREE.Vector2(R_OUT - 0.035, 0.005)], 40, 0.42, PI * 2 - 0.84), M.mortar);
  // Moss: a few flat round moss pads pressed on top of the blocks
  for (const [k, da, sx] of [[1, 0.1, 1], [3, -0.12, 0.8], [6, 0.05, 1.1], [7, -0.2, 0.7]] as [number, number, number][]) {
    const { phi, h } = tops[k];
    const a = phi + da;
    const r = (R_IN + R_OUT) / 2 + 0.005;
    const m = add(basin, new THREE.SphereGeometry(1, 14, 6, 0, PI * 2, 0, PI / 2), M.moss, [Math.sin(a) * r, h - 0.006, Math.cos(a) * r], [0, a + PI / 2, 0], [0.075 * sx, 0.026, 0.055]);
    m.rotateY(0);
  }
  // Water surface, the water running down from the overflow spout, and a small puddle on the ground
  const waterM = add(basin, waterGeo(R_IN + 0.005), M.water, [0, WATER_Y, 0]);
  waterM.castShadow = false;
  // Overflow: a wide thin curtain of water spills over the pressed-low block and follows an arc down to the puddle on the ground
  const fallPts = [v(0, WATER_Y - 0.03, 0.3), v(0, WATER_Y - 0.004, 0.37), v(0, WATER_Y - 0.006, 0.46), v(0, WATER_Y - 0.03, 0.525), v(0, 0.13, 0.558), v(0, 0.06, 0.572), v(0, 0.004, 0.58)];
  const fallW = curveTable([[0, 0], [0.05, 0.13], [0.35, 0.13], [0.6, 0.11], [0.85, 0.1], [0.97, 0.11], [1, 0]]);
  const fallCurve = new THREE.CatmullRomCurve3(fallPts, false, 'centripetal');
  const fallFr = fallCurve.computeFrenetFrames(30, false);
  const fallTop = col(0x9fe0e4);
  const fallLow = col(0x5fb4c0);
  const fallGeo = grid(
    31,
    12,
    (i, j) => {
      const t = i / 30;
      const P = fallCurve.getPointAt(t);
      const T = fallFr.tangents[i];
      const W = v(1, 0, 0);
      const H = new THREE.Vector3().crossVectors(W, T).normalize();
      const a = (j / 12) * PI * 2;
      const w = fallW(t)[0];
      return P.addScaledVector(W, Math.cos(a) * w * 0.5).addScaledVector(H, Math.sin(a) * Math.min(0.008, w * 0.3));
    },
    (i) => fallTop.clone().lerp(fallLow, ss(i / 30, 0.3, 0.9)),
  );
  add(basin, fallGeo, M.water);
  const puddle = add(basin, waterGeo(0.1, 32), M.water, [0, 0.003, 0.6], [0, 0, 0], [1.3, 1, 0.75]);
  puddle.castShadow = false;
  const spoutAt = group(basin, [0, WATER_Y - 0.01, 0.53]);

  // ── Roots: crawling out of the spring water, lying along the stone edge, climbing over it and gripping the basin; the one at the back crosses the crack, binding the two halves together ──
  // Hugging the stone surface (only half a root's thickness from it), with the ends forking in two on the ground; olive brown, and not made as a segmented lotus root (it would look like a worm)
  const ROOT_C = col(0x7c7346);
  const ROOT_T = col(0xa39a66);
  const RO = R_OUT + BEV;
  const rootTube = (pts: THREE.Vector3[], r0: number) => {
    const rad = curveTable([[0, 0], [0.03, r0 * 0.85], [0.15, r0], [0.7, r0 * 0.85], [0.93, r0 * 0.45], [1, 0]]);
    return tube(pts, (t) => rad(t)[0], 40, 8, (t) => ROOT_C.clone().lerp(ROOT_T, ss(t, 0.55, 1)));
  };
  const at = (phi: number, r: number, y: number) => v(Math.sin(phi) * r, y, Math.cos(phi) * r);
  /** A root climbing over the stone edge and gripping downward: rimY is the top of that stone, and finally it forks on the ground */
  const rimRoot = (phi: number, drift: number, r0: number, rimY: number, parent: THREE.Object3D) => {
    const hug = r0 * 0.55;
    const pts = [at(phi - drift, 0.22, WATER_Y - 0.05), at(phi - drift * 0.7, 0.31, WATER_Y - 0.002), at(phi - drift * 0.3, R_IN - 0.01, rimY + hug), at(phi, (R_IN + RO) / 2, rimY + hug), at(phi + drift * 0.2, RO - 0.004, rimY - 0.006), at(phi + drift * 0.5, RO + hug, rimY - 0.07), at(phi + drift * 0.8, RO + hug, 0.07), at(phi + drift, RO + hug + 0.018, 0.012)];
    add(parent, rootTube(pts, r0), M.root);
    const fork = at(phi + drift * 0.85, RO + hug + 0.004, 0.05);
    add(parent, rootTube([fork, at(phi + drift * 0.85 - 0.05, RO + hug + 0.012, 0.025), at(phi + drift * 0.85 - 0.1, RO + hug + 0.04, 0.008)], r0 * 0.6), M.root);
  };
  const roots = group(basin);
  rimRoot(2.3, 0.14, 0.02, 0.245, roots);
  rimRoot(-2.25, -0.12, 0.018, 0.245, roots);
  rimRoot(1.45, 0.1, 0.016, 0.245, roots);
  {
    // The one tied across above the crack: coming over from the left half, lying along the outer wall across the crack, and then gripping down to the ground
    const y = 0.2;
    const hug = 0.011;
    add(roots, rootTube([at(PI - 0.36, 0.24, WATER_Y - 0.05), at(PI - 0.34, R_IN - 0.01, 0.245 + hug), at(PI - 0.33, RO - 0.004, 0.24), at(PI - 0.3, RO + hug, y + 0.01), at(PI - 0.12, RO + hug + 0.004, y - 0.004), at(PI + 0.08, RO + hug + 0.004, y - 0.008), at(PI + 0.24, RO + hug, y - 0.03), at(PI + 0.3, RO + hug, 0.08), at(PI + 0.34, RO + hug + 0.02, 0.012)], 0.02), M.root);
  }

  // ── Lotus: the long stem growing from the spring's eye, and the flower on top ──
  const plant = group(root, [0, WATER_Y, -0.03]);
  const stemPts = [v(0, -0.08, 0), v(0.005, 0.22, -0.04), v(-0.012, 0.5, -0.025), v(0.0, 0.71, 0.04), v(0.0, 0.8, 0.085)];
  const STEM_R = curveTable([[0, 0], [0.02, 0.041], [0.5, 0.037], [0.97, 0.033], [1, 0]]);
  add(plant, tube(stemPts, (t) => STEM_R(t)[0], 36, 10), M.stem);
  const stemCurve = new THREE.CatmullRomCurve3(stemPts, false, 'centripetal');
  const top = stemCurve.getPointAt(0.985);
  const topDir = stemCurve.getTangentAt(0.985);
  // The flower's pivot: first follows the direction of the top of the stem, then turns for looking around and tips forward for the bow
  const bloomBase = group(plant, [top.x, top.y, top.z]);
  bloomBase.quaternion.setFromUnitVectors(UP, topDir);
  const bloomYaw = group(bloomBase);
  const bloomTilt = group(bloomYaw);
  const bloom = group(bloomTilt, [0, 0.055, 0]);
  // Receptacle: a green cup covering the petal bases and the top of the stem
  add(bloom, new THREE.LatheGeometry([[0.001, -0.1], [0.026, -0.095], [0.045, -0.07], [0.075, -0.035], [0.098, -0.004], [0.1, 0.012], [0.085, 0.03], [0.001, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 20), M.stem);
  // Seed pod: a pale gold inverted cone with a slightly concave top face
  const POD_TOP = 0.165;
  add(bloom, new THREE.LatheGeometry([[0.001, 0.0], [0.05, 0.004], [0.072, 0.045], [0.094, 0.11], [0.104, 0.145], [0.103, POD_TOP - 0.006], [0.094, POD_TOP], [0.06, POD_TOP - 0.004], [0.001, POD_TOP - 0.006]].map(([r, y]) => new THREE.Vector2(r, y)), 24), M.pod);
  // Stamens: a ring of gold pointed teeth around the seed pod, one whole sheet (sample points at both tooth tips and tooth valleys)
  {
    const TEETH = 26;
    const cols = TEETH * 4;
    const prof: [number, number][] = [[0, 0], [0.5, 0.3], [1, 1], [0.5, 1.02], [0, 0.35], [-0.2, 0]];
    const lo = col(0xe0a53a);
    const hiC = col(0xffe9a0);
    const g = grid(cols, prof.length, (i, j) => {
      const a = (i / cols) * PI * 2;
      const ph = (i % 4) / 4;
      const tip = ph === 0.5 ? 1 : ph === 0 ? 0 : 0.55;
      const H = 0.05 + 0.055 * tip;
      const [side, hh] = prof[j];
      const y = 0.03 + hh * H;
      const r = 0.103 + (y - 0.03) * 0.55 + (side - 0.5) * 0.012 * (1 - hh * 0.5);
      return v(Math.sin(a) * r, y, Math.cos(a) * r);
    }, (i, j) => lo.clone().lerp(hiC, ss(prof[j][1], 0.3, 0.95)));
    add(bloom, g, M.stamen);
  }
  // Lotus seeds: one in the middle and six in the outer ring, half buried in the top face of the pod
  const seedsG = group(bloom, [0, POD_TOP - 0.004, 0]);
  {
    const geos: THREE.BufferGeometry[] = [];
    const spots: [number, number][] = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.sin((i / 6) * PI * 2 + 0.3) * 0.056, Math.cos((i / 6) * PI * 2 + 0.3) * 0.056] as [number, number])];
    for (const [x, z] of spots) {
      const g = new THREE.SphereGeometry(0.019, 12, 8);
      g.scale(1, 0.72, 1);
      g.translate(x, 0.002, z);
      geos.push(g);
    }
    add(seedsG, mergeGeometries(geos, false)!, M.seed);
  }
  const RINGS: RingSpec[] = [
    { n: 8, r0: 0.082, y0: -0.004, alpha: 1.1, off: 0, petal: { L: 0.37, W: 0.165, T: 0.018, cup: 0.5, curl: 0.06 } },
    { n: 8, r0: 0.09, y0: 0.016, alpha: 0.76, off: 0.5, petal: { L: 0.34, W: 0.152, T: 0.017, cup: 0.66, curl: 0.07 } },
    { n: 6, r0: 0.098, y0: 0.036, alpha: 0.46, off: 0.25, petal: { L: 0.255, W: 0.128, T: 0.016, cup: 0.82, curl: 0.06 } },
  ];
  const rings = RINGS.map((s) => petalRing(bloom, s, M.petal, rand));

  // ── Held-out leaf: a deep cup at the front right, its center holding a big glowing water drop ──
  const offerG = group(plant, [0.1, -0.02, 0.07]);
  const OFFER_TIP = v(0.2, 0.47, 0.19);
  add(offerG, tube([v(0, -0.06, 0), v(0.03, 0.15, 0.0), v(0.12, 0.34, 0.07), OFFER_TIP], (t) => 0.022 * (t < 0.03 ? t / 0.03 : 1) * (t > 0.985 ? 0.4 : 1), 24, 8), M.stem);
  const offerLeaf = group(offerG, [OFFER_TIP.x, OFFER_TIP.y, OFFER_TIP.z]);
  orient(offerLeaf, v(0.18, 0.86, 0.48), v(0, -0.3, 1));
  add(offerLeaf, leafGeo({ R: 0.205, cup: 0.42, wave: 0.07, waves: 6, T: 0.014, veins: 12, phase: 0.4 }), M.leaf, [0, 0.004, 0]);
  const dropG = group(offerLeaf, [0, 0.052, 0]);
  const dropM = add(dropG, new THREE.SphereGeometry(0.05, 20, 14), M.drop, [0, 0, 0], [0, 0, 0], [1, 0.86, 1]);
  const dropHi = add(dropG, new THREE.SphereGeometry(0.011, 10, 8), M.hi, [-0.018, 0.028, 0.03], [0, 0, 0], [1, 0.7, 0.5]);
  dropHi.layers.disable(INK_LAYER);
  dropHi.castShadow = false;

  // ── Bud: a closed pink bud at the front left ──
  const budG = group(plant, [-0.05, -0.02, 0.03]);
  const BUD_TIP = v(-0.25, 0.68, 0.08);
  add(budG, tube([v(0, -0.06, 0), v(-0.04, 0.22, 0.02), v(-0.16, 0.5, 0.06), BUD_TIP], (t) => 0.018 * (t < 0.03 ? t / 0.03 : 1) * (t > 0.985 ? 0.5 : 1), 24, 8), M.stem);
  const bud = group(budG, [BUD_TIP.x, BUD_TIP.y, BUD_TIP.z]);
  orient(bud, v(-0.2, 1, 0.12), v(0, 0, 1));
  {
    const geos: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const phi = (k / 5) * PI * 2;
      const al = 0.18;
      const R = v(Math.sin(phi), 0, Math.cos(phi));
      const Y = UP.clone().multiplyScalar(Math.cos(al)).addScaledVector(R, Math.sin(al));
      const Z = UP.clone().multiplyScalar(Math.sin(al)).addScaledVector(R, -Math.cos(al));
      const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
      const g = petalGeo({ L: 0.17, W: 0.07, T: 0.014, cup: 1.05, curl: 0.2, blush: 0.55 }, 10);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(R.clone().multiplyScalar(0.012 + (k % 2) * 0.004)));
      geos.push(tagPart(g, k % 3));
    }
    const g = mergeGeometries(geos, false)!;
    g.userData.inkParts = 3;
    add(bud, g, M.petal);
    add(bud, new THREE.LatheGeometry([[0.001, -0.05], [0.02, -0.045], [0.034, -0.02], [0.038, 0.006], [0.02, 0.02], [0.001, 0.022]].map(([r, y]) => new THREE.Vector2(r, y)), 12), M.stem);
  }

  // ── Leaves floating on the water: one big one at the back left with its outer edge resting on the stone edge; a small one at the back right ──
  const bigPad = group(basin, [-0.17, WATER_Y + 0.006, -0.17]);
  orient(bigPad, v(0.2, 1, 0.2), v(-1, 0, 1));
  add(bigPad, leafGeo({ R: 0.2, cup: 0.2, wave: 0.07, waves: 6, T: 0.013, veins: 12, phase: 1.7 }), M.leaf);
  const padGeo = leafGeo({ R: 0.11, cup: 0.08, wave: 0.05, waves: 5, T: 0.012, veins: 9, phase: 2.2 });
  add(basin, padGeo, M.leaf, [-0.19, WATER_Y + 0.004, 0.17], [0.04, 0.6, -0.03]);
  add(basin, leafGeo({ R: 0.085, cup: 0.1, wave: 0.05, waves: 5, T: 0.012, veins: 9, phase: 0.9 }), M.leaf, [0.22, WATER_Y + 0.004, -0.12], [-0.03, 2.1, 0.05]);

  // Ripples: a ring of pale water circles sent out from the spring's eye, with no outline
  const rippleG = group(root, [0, WATER_Y + 0.002, -0.03]);
  const rippleM = add(rippleG, new THREE.RingGeometry(0.88, 1, 40, 1).rotateX(-PI / 2), M.ripple);
  rippleM.layers.disable(INK_LAYER);
  rippleM.castShadow = false;

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const face = group(bloom, [0, POD_TOP + 0.01, 0]);
  const eyeA = group(seedsG, [0, 0.01, 0]);
  const podA = group(bloom, [0, POD_TOP + 0.05, 0]);
  const rig = {
    head: face,
    eyes: [eyeA],
    anchors: {
      mouth: podA,
      pod: podA,
      drop: group(dropG),
      spout: spoutAt,
      bud: group(bud, [0, 0.17, 0]),
      leaf: group(bigPad, [0, 0.02, 0]),
      well: group(root, [0, WATER_Y, -0.03]),
    },
  };

  // Action weights: gather folds into a bud, bloom opens fully, bow bows, glow brightens the seeds and the water drop
  const act = { gather: 0, bloom: 0, bow: 0, glow: 0 };

  mergeStatic(root, {
    owners: [basin, plant, bloomBase, bloomYaw, bloomTilt, bloom, seedsG, offerG, offerLeaf, dropG, budG, bud, rippleG],
    keep: [...rings.map((r) => r.mesh), dropHi, rippleM],
    rig,
  });

  // ── Idle action ──
  const TILT0 = 0.32;
  const OPEN = [0, 0, 0];
  const update = (t: number) => {
    const { gather: g, bloom: b, bow, glow } = act;
    plant.rotation.set(Math.sin(t * 0.47) * 0.016 - g * 0.03, 0, Math.sin(t * 0.61) * 0.02);
    bloomYaw.rotation.y = (Math.sin(t * 0.29) * 0.32 + Math.sin(t * 0.83 + 1) * 0.04) * (1 - Math.max(g, bow) * 0.8);
    bloomTilt.rotation.x = TILT0 + Math.sin(t * 0.7) * 0.03 + bow * 0.5 + b * 0.14 - g * 0.12;
    const br = Math.sin(t * 0.9) * 0.04;
    OPEN[0] = br + b * 0.2 - g * 0.95;
    OPEN[1] = br * 0.8 + b * 0.24 - g * 0.72;
    OPEN[2] = br * 0.6 + b * 0.22 - g * 0.4;
    rings.forEach((r, i) => bendRing(r, OPEN[i], (k) => Math.sin(t * 1.7 + k * 1.3 + i) * 0.012));
    M.seed.emissiveIntensity = 0.85 + Math.sin(t * 1.3) * 0.12 + glow * 0.9 + g * 0.5;
    M.drop.emissiveIntensity = 0.65 + Math.sin(t * 1.1 + 2) * 0.1 + glow * 0.8;
    offerG.rotation.set(Math.sin(t * 0.8 + 1) * 0.03 + b * 0.12 - bow * 0.08, 0, Math.sin(t * 0.55) * 0.02 - bow * 0.05);
    dropG.position.y = 0.052 + Math.sin(t * 1.6) * 0.005;
    dropM.scale.set(1 + Math.sin(t * 2.1) * 0.025, 0.86 - Math.sin(t * 2.1) * 0.02, 1 + Math.sin(t * 2.1) * 0.025);
    budG.rotation.set(Math.sin(t * 0.66 + 0.4) * 0.03, 0, Math.sin(t * 0.52 + 2.2) * 0.035);
    // Ripples: one ring spreads outward from the spring's eye every 3.6 seconds, sinking away as it nears the stone edge
    const ph = (t % 3.6) / 3.6;
    const s = 0.07 + ph * 0.28;
    rippleG.scale.set(s, 1, s);
    rippleG.position.y = WATER_Y + 0.002 - ss(ph, 0.8, 1) * 0.01;
    rippleM.visible = ph < 0.97;
  };
  update(0);

  return { root, update, act, rig, center: new THREE.Vector3(0, 0.72, 0), radius: 0.86 };
}
