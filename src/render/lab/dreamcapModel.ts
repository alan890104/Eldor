// Dreamcap, the Dream Mushroom Queen (model lab version, fully redone 2026-09-28): a faintly glowing mushroom deep in the forest. A traveler who falls asleep inside the fairy ring has a very, very long dream.
// The "Queen" in the name does not mean a humanoid form: the whole thing is one mushroom, with no face and no features. The nobility comes from the broad cap, the rings of warts on top of it, the upright posture and the light.
// Identifying features:
// - A broad domed cap: deep indigo purple, fading to lavender toward the rim, with a small knob at the center of the top and rings of cream-white warts around it (like a night sky, and also like a crown).
// - Glowing gills: the radial gills under the cap let through a faint cyan-green glow; the cap leans back, so from the front you can see the curve of light under the cap rim.
// - Spores: three cyan-green spores drift slowly in front of the cap (the dust of dreams).
// - Fairy ring: a mossy mound at its feet, cream-white mycelium crawling outward from the base of the stalk to two small mushrooms beside her and a half ring of just-sprouting small mushrooms behind, the very ring in which the traveler fell asleep.
// Body shape: one big mushroom standing on a mossy mound: a stout cream-white stalk, swollen at the base and wrapped in a torn volva, rising in a slight S shape to hold up a cap wider than the body.
// Personality: the mother of the fairy ring: unhurried and protective, rocking gently as if lulling a child to sleep; whoever wakes a sleeper in the ring gets a handful of spores thrown at them.
// Gaze order: the cap (the largest on the body, deep purple with cream-white warts) first, the curve of cyan-green light under the cap and the spores second; the stalk, small mushrooms, mossy mound and mycelium are all support.
// Back: the cap leans back, so from behind you can see all the warts on top arranged in rings; the half ring of just-sprouting small mushrooms behind surrounds her, and the mycelium connects everyone (the fairy ring).
// Restrained light effects: no bloom and no translucent shell; the emissive is only the gills and the three spores.
// <Action table>
// - Idle: slowly stretches and contracts like breathing, the whole mushroom sways gently left and right (the rhythm of a cradle) with the cap a half beat behind; the gill light brightens and dims, the spores drift slowly around the front of the cap; the two small mushrooms nod a beat late.
// - Move: the whole mossy mound translates, and the cap bobs with each step.
// - Charge-up (act.puff): the cap presses down, the stalk shortens and the gills brighten.
// - Strike (act.spore): the stalk stretches and the cap tips forward to shake the spores out (the spores come from the gills anchor).
// - Hit: the cap wobbles twice like jelly and the small mushrooms shrink once; it does not retreat.
// - Victory: the cap bounces up and down twice, and the two small mushrooms bounce in turn after it.
// Anchors: head (center of the gills), eyes (center of the gills, the glowing place), mouth (a little below the center of the gills, where the spores come out), gills (same as mouth),
//   cap (the knob on top of the cap), spores (center of the spores' drift), ring (center of the fairy ring, at the feet), kidL / kidR (cap tops of the two small mushrooms).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Geometry helpers ─────────────────────────

/**
 * Parametric surface: rows × cols, P(i, j) gives the position and C(i, j) the vertex color; columns always wrap around (each row is a closed ring).
 * For a row that closes to a point (a pole) the normal is the average of that row, and degenerate triangles are dropped.
 * Winding: when want is given, the normals as a whole must face want; when not given, at the point of the middle row farthest from the center the normal must face away from the center.
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

/** A round tube along a curve: parallel-transport frame, and a radius table with 0 at the ends closes them */
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

// ───────────────────────── Cap and gills ─────────────────────────

const CAP_TOP = col(0x3d2a68);
const CAP_MID = col(0x553b8c);
const CAP_RIM = col(0x7a61b3);
const CAP_LIP = col(0xb7a5dc);

interface CapOpts {
  R: number;
  H: number;
  /** Waves in the cap rim */
  wave: number;
  waves: number;
  umbo: number;
  phase?: number;
}

/** A point on the cap surface: s runs from the top of the cap (0) to the rim (1), and a is the azimuth (from +z toward +x) */
function capPoint(o: CapOpts, s: number, a: number): THREE.Vector3 {
  const ph = o.phase ?? 0;
  const R = o.R * (1 + o.wave * Math.sin(o.waves * a + ph) + o.wave * 0.5 * Math.sin((o.waves * 2 - 1) * a + ph * 2));
  const th = Math.min(1, s) * PI * 0.5;
  // A half-ellipse dome, with the last stretch of the rim curling inward (r pulls back, y is pressed below 0)
  const roll = ss(s, 0.72, 1);
  const r = R * (Math.sin(th) - roll * 0.025);
  const y = o.H * Math.max(0, Math.cos(th)) ** 0.8 - roll * o.H * 0.1 + o.umbo * Math.exp(-((s / 0.16) ** 2)) + o.H * 0.045 * Math.sin(o.waves * a + ph) * s ** 4;
  return v(Math.sin(a) * r, y, Math.cos(a) * r);
}

/** Normal of the cap surface (numerical difference, normalized before use) */
function capNormal(o: CapOpts, s: number, a: number): THREE.Vector3 {
  const e = 1e-3;
  const p = capPoint(o, s, a);
  const ds = capPoint(o, s + e, a).sub(p);
  const da = capPoint(o, s, a + e).sub(p);
  return new THREE.Vector3().crossVectors(ds, da).normalize().multiplyScalar(-1);
}

/**
 * Cap: from the top outward to the rim, rolling over the rounded rim, then drawing in from the underside toward the center to a flat bottom (covered by the gills). One closed sheet.
 * Color: deep indigo purple at the top, fading to lavender toward the rim, palest at the rim lip.
 */
function capGeo(o: CapOpts, cols = 48): THREE.BufferGeometry {
  const S = [0, 0.06, 0.13, 0.22, 0.33, 0.45, 0.57, 0.68, 0.78, 0.86, 0.92, 0.965, 1];
  const lip = o.H * 0.07;
  type Row = { s: number; k: number };
  // k: 0 cap surface, 1 rim lip, 2 underside
  const rows: Row[] = [...S.map((s) => ({ s, k: 0 })), { s: 1, k: 1 }, { s: 0.94, k: 2 }, { s: 0.6, k: 2 }, { s: 0, k: 2 }];
  return grid(
    rows.length,
    cols,
    (i, j) => {
      const { s, k } = rows[i];
      const a = (j / cols) * PI * 2;
      if (k === 0) return capPoint(o, s, a);
      const rim = capPoint(o, 1, a);
      if (k === 1) return rim.addScaledVector(UP, -lip * 0.7).add(v(Math.sin(a), 0, Math.cos(a)).multiplyScalar(lip * 0.3));
      // The underside draws in toward the center inside the cap (higher than the gills), so the gills can show
      const f = s / 0.94;
      const yc = o.H * 0.16;
      return v(rim.x * f * 0.94, THREE.MathUtils.lerp(yc, rim.y - lip * 0.45, f * f), rim.z * f * 0.94);
    },
    (i) => {
      const { s, k } = rows[i];
      if (k > 0) return CAP_LIP.clone();
      const c = CAP_TOP.clone().lerp(CAP_MID, ss(s, 0.1, 0.35)).lerp(CAP_RIM, ss(s, 0.8, 0.97));
      return c.lerp(CAP_LIP, ss(s, 0.97, 1) * 0.5);
    },
  );
}

const GILL_HI = col(0xb6eee0);
const GILL_LO = col(0x4aa39c);
const GILL_IN = col(0xd8f4ea);

/**
 * Gills: a ring of radial folds under the cap, with the fold edge (ridge) and the space between folds (valley) taking one column each; long gills run from the stalk all the way to the rim, with a short gill between them that grows only on the outer half ring.
 * The depth of the folds fades out near the stalk and the rim, so lines and shading do not bunch up at the center. Normals point down.
 */
function gillGeo(rIn: number, rOut: number, y0: number, drop: number, n: number, depth: number, wave?: (a: number) => number): THREE.BufferGeometry {
  const RS = [0, 0.12, 0.28, 0.45, 0.6, 0.74, 0.86, 0.95, 1];
  const cols = n * 4;
  return grid(
    RS.length,
    cols,
    (i, j) => {
      const u = RS[i];
      const a = (j / cols) * PI * 2;
      const r = rIn + (rOut - rIn) * u;
      const ph = j % 4;
      // 0 long gill ridge, 1 valley, 2 short gill ridge, 3 valley
      const ridge = ph === 0 ? 1 : ph === 2 ? ss(u, 0.35, 0.6) : 0;
      const dd = depth * ss(u, 0.05, 0.3) * (1 - ss(u, 0.9, 1));
      const y = y0 - drop * Math.sin(u * PI) ** 0.8 + (1 - ridge) * dd + (wave ? wave(a) * u ** 3 : 0);
      return v(Math.sin(a) * r, y, Math.cos(a) * r);
    },
    (i, j) => {
      const u = RS[i];
      const ph = j % 4;
      const ridge = ph === 0 ? 1 : ph === 2 ? ss(u, 0.35, 0.6) : 0;
      return GILL_LO.clone().lerp(GILL_HI, ridge).lerp(GILL_IN, (1 - ss(u, 0.0, 0.2)) * 0.7);
    },
    v(0, -1, 0),
  );
}

// ───────────────────────── Shape ─────────────────────────

export function buildDreamcapLab(): LabModel {
  const rand = rng(20260930);
  const vc = <T extends THREE.Material>(m: T): T => {
    (m as unknown as THREE.MeshToonMaterial).vertexColors = true;
    return m;
  };
  const RIM_V = 0xe4d6ff;
  const M = {
    cap: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIM_V })),
    wart: labToon(0xf2e8d6, { rim: 0.3, rimColor: 0xfff6e6 }),
    gill: vc(labToon(0xffffff, { ramp: 'gem', emissive: 0x2ab8a6, emissiveAmt: 0.42, rim: 0 })),
    stem: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xfff4e6 })),
    volva: labToon(0xd9ccb4, { rim: 0.3, speckle: 0.25 }),
    mound: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xd9f2c8 })),
    myc: labToon(0xece4d0, { rim: 0.3 }),
    kidGill: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    // The spores do not go into the outline layer, so they are not in the spirit's bloom mask either: their brightness is kept below the bloom threshold (displayed brightness about 0.75) so they do not bleed
    spore: labToon(0x5ccbbd, { ramp: 'gem', emissive: 0x1c8f84, emissiveAmt: 0.35, rim: 0 }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'dreamcap-lab';
  const { add, group } = partKit();

  // ── Mossy mound: a flat round mound with moss on top and dark soil showing at the edge ──
  const MR = 0.44;
  const MH = 0.11;
  const moundR = (a: number) => MR * (1 + 0.05 * Math.sin(5 * a + 0.7) + 0.03 * Math.sin(9 * a + 2));
  const moundY = (u: number) => MH * Math.max(0, 1 - u ** 2.2) ** 0.7;
  const moundAt = (x: number, z: number) => {
    const a = Math.atan2(x, z);
    return moundY(Math.min(1, Math.hypot(x, z) / moundR(a)));
  };
  {
    const U = [0, 0.15, 0.3, 0.45, 0.6, 0.72, 0.82, 0.9, 0.96, 1];
    const moss = col(0x6f9a4a);
    const mossHi = col(0x86ad58);
    const soil = col(0x6a4f3c);
    const rows = [...U.map((u) => ({ u, b: false })), { u: 0.5, b: true }, { u: 0, b: true }];
    const g = grid(
      rows.length,
      40,
      (i, j) => {
        const { u, b } = rows[i];
        const a = (j / 40) * PI * 2;
        const r = moundR(a) * (b ? u * 0.98 : u);
        return v(Math.sin(a) * r, b ? 0.002 : moundY(u) + 0.002, Math.cos(a) * r);
      },
      (i, j) => {
        const { u, b } = rows[i];
        if (b) return soil.clone();
        const a = (j / 40) * PI * 2;
        return moss.clone().lerp(mossHi, 0.5 + 0.5 * Math.sin(a * 3 + u * 4)).lerp(soil, ss(u, 0.86, 0.97));
      },
    );
    add(root, g, M.mound);
  }

  // ── Mycelium: crawling outward from the base of the stalk along the surface of the mossy mound, connecting to the small mushrooms and the ground ──
  const threads: THREE.BufferGeometry[] = [];
  const thread = (a0: number, a1: number, r1: number, rad: number) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 7; k++) {
      const f = k / 7;
      const a = a0 + (a1 - a0) * f + Math.sin(f * PI * 2 + a0) * 0.06;
      const r = 0.1 + (r1 - 0.1) * f;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const y = r < MR * 0.98 ? moundAt(x, z) + rad * 0.55 : rad * 0.55;
      pts.push(v(x, y, z));
    }
    const R = curveTable([[0, 0], [0.04, rad], [0.75, rad * 0.85], [0.95, rad * 0.55], [1, 0]]);
    threads.push(tube(pts, (t) => R(t)[0], 30, 6));
  };
  thread(-0.6, -0.8, 0.47, 0.014);
  thread(0.9, 1.1, 0.47, 0.013);
  thread(2.2, 2.5, 0.46, 0.014);
  thread(3.1, 3.0, 0.47, 0.012);
  thread(-2.2, -2.45, 0.47, 0.013);
  add(root, mergeGeometries(threads, false)!, M.myc);

  const ivory = col(0xf2eadb);
  const ivoryDk = col(0xd9ccb6);
  const lav = col(0xe2d8ee);

  // ── Fairy ring: the half ring of just-sprouting small mushrooms behind (stationary, merged into one mesh) ──
  const capKid = (R: number, H: number, ph: number): CapOpts => ({ R, H, wave: 0.03, waves: 5, umbo: 0, phase: ph });
  const buttons: [number, number, number][] = [
    [1.9, 0.4, 0.05],
    [2.35, 0.43, 0.036],
    [2.85, 0.41, 0.046],
    [3.45, 0.44, 0.032],
    [-2.25, 0.4, 0.05],
    [-1.75, 0.43, 0.034],
  ];
  const kidsStatic = group(root);
  for (const [a, r, R] of buttons) {
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const y = r < MR ? moundAt(x, z) : 0;
    const g = group(kidsStatic, [x, y - 0.01, z]);
    orient(g, v(Math.sin(a) * 0.35, 1, Math.cos(a) * 0.35), v(0, 0, 1));
    const sh = R * 1.3;
    add(g, tube([v(0, 0, 0), v(0, sh * 0.5, 0), v(0, sh, 0)], (t) => R * 0.42 * (t < 0.05 ? t / 0.05 : 1) * (t > 0.97 ? 0.3 : 1), 6, 8, (t) => ivoryDk.clone().lerp(ivory, t)), M.stem, [0, 0, 0]);
    add(g, capGeo(capKid(R, R * 0.9, a * 3), 16), M.cap, [0, sh - R * 0.05, 0]);
  }

  // ── The big mushroom: volva, stalk, cap ──
  const mother = group(root, [0, 0.07, -0.02]);
  // The stalk runs all the way through the gills into the cap (the top end hidden between the underside and the gills), so when the cap leans back no break shows from the front
  const stemPts = [v(0, -0.05, 0), v(0.01, 0.08, 0), v(0.05, 0.26, -0.02), v(0.025, 0.44, -0.03), v(-0.02, 0.6, 0.0), v(-0.032, 0.68, 0.02), v(-0.036, 0.77, 0.02)];
  const STEM_R = curveTable([[0, 0], [0.03, 0.13], [0.12, 0.165], [0.28, 0.13], [0.5, 0.112], [0.78, 0.106], [0.9, 0.118], [0.96, 0.1], [1, 0]]);
  add(mother, tube(stemPts, (t) => STEM_R(t)[0], 30, 14, (t, a) => ivoryDk.clone().lerp(ivory, ss(t, 0.05, 0.35)).lerp(lav, ss(t, 0.75, 1) * 0.6).multiplyScalar(0.97 + 0.03 * Math.cos(a * 7))), M.stem);
  // Volva: a cup with a torn upper edge that wraps the swollen base of the stalk
  {
    const cols = 44;
    const tr = rng(77);
    const teeth = Array.from({ length: 11 }, () => 0.6 + tr() * 0.4);
    const prof: [number, number][] = [[0, 0], [0.6, 0.35], [1, 1], [0.35, 0.98], [-0.4, 0.3], [-0.5, 0]];
    const g = grid(cols, prof.length, (i, j) => {
      const a = (i / cols) * PI * 2;
      const q = (i % 4) / 4;
      const tip = q === 0 ? teeth[Math.floor(i / 4)] : q === 2 ? 0.45 : 0.72;
      const [side, hh] = prof[j];
      const H = 0.13 * tip;
      const y = hh * H;
      const r = 0.158 + y * 0.45 + side * 0.012;
      return v(Math.sin(a) * r, y - 0.005, Math.cos(a) * r);
    });
    add(mother, g, M.volva, [0.01, 0.02, 0]);
  }
  const stemCurve = new THREE.CatmullRomCurve3(stemPts, false, 'centripetal');
  const apex = stemCurve.getPointAt(0.885);
  // The cap's pivot: leaning back and tilting slightly to the left
  const capPivot = group(mother, [apex.x, apex.y, apex.z]);
  const CAP_X = -0.3;
  const CAP_Z = 0.1;
  const capG = group(capPivot, [0, 0.0, 0]);
  const CAP: CapOpts = { R: 0.53, H: 0.36, wave: 0.028, waves: 7, umbo: 0.03, phase: 0.6 };
  const capBase = 0.02;
  add(capG, capGeo(CAP, 56), M.cap, [0, capBase, 0]);
  // Warts: arranged ring by ring on the cap (five large ones around the knob, getting smaller outward), polyhedral flat blocks standing proud of the cap surface (like the universal veil remnants on an Amanita), not stickers
  {
    const geos: THREE.BufferGeometry[] = [];
    const rings: [number, number, number, number][] = [
      [0.2, 5, 0.06, 0.3],
      [0.42, 8, 0.05, 0.0],
      [0.63, 10, 0.04, 0.35],
      [0.8, 11, 0.03, 0.1],
    ];
    for (const [s0, n, r0, off] of rings)
      for (let k = 0; k < n; k++) {
        const a = ((k + off + (rand() - 0.5) * 0.35) / n) * PI * 2;
        const s = s0 + (rand() - 0.5) * 0.05;
        const r = r0 * (0.8 + rand() * 0.4);
        const p = capPoint(CAP, s, a);
        const nn = capNormal(CAP, s, a);
        const g = new THREE.IcosahedronGeometry(1, 0);
        g.scale(r, r * 0.5, r * (0.75 + rand() * 0.35));
        const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, nn).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * PI)));
        m.setPosition(p.addScaledVector(nn, r * 0.08).add(v(0, capBase, 0)));
        g.applyMatrix4(m);
        geos.push(g);
      }
    add(capG, mergeGeometries(geos, false)!, M.wart);
  }
  // Gills
  const gillsG = group(capG, [0, capBase, 0]);
  // The outer edge of the gills aligns with the lower edge of the cap rim lip (the rim curls in by H × 0.1 and the lip is H × 0.07 thick), rising and falling together with the rim
  const lipY = -CAP.H * 0.1 - CAP.H * 0.07 * 0.6;
  add(gillsG, gillGeo(0.07, CAP.R * 0.9, lipY, 0.03, 34, 0.03, (a) => CAP.H * 0.045 * Math.sin(CAP.waves * a + (CAP.phase ?? 0))), M.gill);

  // ── Two small mushrooms that move: one at the front left and one at the back right, nodding a beat late after their mother ──
  interface Kid {
    g: THREE.Group;
    base: THREE.Quaternion;
    delay: number;
    top: THREE.Object3D;
  }
  const kids: Kid[] = [];
  const kid = (a: number, r: number, R: number, stemH: number, lean: number, delay: number) => {
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const g = group(root, [x, moundAt(x, z) - 0.01, z]);
    orient(g, v(Math.sin(a) * lean, 1, Math.cos(a) * lean), v(-Math.cos(a), 0, Math.sin(a)));
    add(g, tube([v(0, 0, 0), v(0.01, stemH * 0.5, 0), v(0, stemH, 0)], (t) => R * 0.3 * (t < 0.04 ? t / 0.04 : 1) * (1 + 0.25 * (1 - ss(t, 0, 0.3))) * (t > 0.97 ? 0.3 : 1), 10, 10, (t) => ivoryDk.clone().lerp(ivory, ss(t, 0, 0.4))), M.stem);
    const o = capKid(R, R * 0.62, a);
    const c = group(g, [0, stemH - R * 0.04, 0], [-0.12, 0, 0]);
    add(c, capGeo(o, 28), M.cap);
    // Warts on the small mushrooms: three or four
    const geos: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const s = k === 0 ? 0.1 : 0.5;
      const aa = (k / 3) * PI * 2 + a;
      const p = capPoint(o, s, aa);
      const nn = capNormal(o, s, aa);
      const rr = R * (k === 0 ? 0.24 : 0.18);
      const wg = new THREE.IcosahedronGeometry(1, 0);
      wg.scale(rr, rr * 0.5, rr);
      wg.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, nn)).setPosition(p.addScaledVector(nn, rr * 0.08)));
      geos.push(wg);
    }
    add(c, mergeGeometries(geos, false)!, M.wart);
    add(c, gillGeo(R * 0.14, R * 0.9, -o.H * 0.1 - o.H * 0.07 * 0.6, R * 0.05, 14, R * 0.05, (aa) => o.H * 0.045 * Math.sin(o.waves * aa + (o.phase ?? 0))), M.kidGill);
    kids.push({ g, base: g.quaternion.clone(), delay, top: group(c, [0, o.H, 0]) });
  };
  kid(-0.75, 0.3, 0.13, 0.2, 0.35, 0.7);
  kid(2.0, 0.28, 0.1, 0.15, 0.3, 1.3);

  // ── Spores: three drifting slowly around the front of the cap ──
  const sporeG = group(root, [0, 0.52, 0.26]);
  const spores: { m: THREE.Mesh; a: number; r: number; y: number; sp: number }[] = [];
  for (const [a, r, y, sp, s] of [[0.3, 0.34, 0.05, 0.3, 0.028], [2.4, 0.3, -0.08, 0.24, 0.022], [4.3, 0.38, 0.1, 0.2, 0.025]] as [number, number, number, number, number][]) {
    // Spores are points of light: they do not go into the outline layer (outlined, they would look like bubbles)
    const m = add(sporeG, new THREE.IcosahedronGeometry(s, 1), M.spore);
    m.castShadow = false;
    m.layers.disable(INK_LAYER);
    spores.push({ m, a, r, y, sp });
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const gillC = group(gillsG, [0, lipY - 0.04, 0]);
  const mouthA = group(gillsG, [0, lipY - 0.1, 0]);
  const rig = {
    head: gillC,
    eyes: [group(gillsG, [0, lipY - 0.04, 0])],
    anchors: {
      mouth: mouthA,
      gills: mouthA,
      cap: group(capG, [0, capBase + CAP.H + CAP.umbo, 0]),
      spores: group(sporeG),
      ring: group(root, [0, 0.02, 0]),
      kidL: kids[0].top,
      kidR: kids[1].top,
    },
  };

  // Action weights: puff is charge-up (the cap presses down), spore is strike (stretching and shaking forward), glow brightens the gills and spores
  const act = { puff: 0, spore: 0, glow: 0 };

  mergeStatic(root, {
    owners: [mother, capPivot, capG, gillsG, sporeG, ...kids.map((k) => k.g), kidsStatic],
    keep: [...spores.map((s) => s.m)],
    rig,
  });

  // ── Idle action ──
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const update = (t: number) => {
    const { puff, spore, glow } = act;
    // Breathing: the whole mushroom slowly stretches and contracts (measured from the base of the stalk); it squashes when charging and stretches when striking
    const br = Math.sin(t * 0.8) * 0.016;
    const sy = 1 + br - puff * 0.14 + spore * 0.08;
    const sx = 1 - br * 0.5 + puff * 0.07 - spore * 0.03;
    mother.scale.set(sx, sy, sx);
    // The rhythm of a cradle: the whole mushroom sways gently left and right, with the cap half a beat behind
    mother.rotation.set(Math.sin(t * 0.37) * 0.018 + spore * 0.08, 0, Math.sin(t * 0.5) * 0.035);
    capPivot.rotation.set(CAP_X + Math.sin(t * 0.37 - 0.7) * 0.03 + spore * 0.3 + puff * 0.1, 0, CAP_Z + Math.sin(t * 0.5 - 0.9) * 0.04);
    capG.scale.set(1 + puff * 0.06, 1 - puff * 0.08, 1 + puff * 0.06);
    M.gill.emissiveIntensity = 0.42 + Math.sin(t * 0.7) * 0.07 + glow * 0.6 + puff * 0.3;
    M.spore.emissiveIntensity = 0.35 + glow * 0.4;
    for (const s of spores) {
      const a = s.a + t * s.sp;
      s.m.position.set(Math.sin(a) * s.r, s.y + Math.sin(t * 0.9 + s.a) * 0.03, Math.cos(a) * s.r * 0.45);
    }
    for (const k of kids) {
      const d = Math.sin(t * 0.5 - k.delay);
      e.set(Math.sin(t * 0.8 - k.delay) * 0.05, 0, d * 0.06);
      k.g.quaternion.copy(k.base).multiply(q.setFromEuler(e));
      const kb = Math.sin(t * 0.8 - k.delay) * 0.02 - puff * 0.1;
      k.g.scale.set(1 - kb * 0.5, 1 + kb, 1 - kb * 0.5);
    }
  };
  update(0);

  return { root, update, act, rig, center: new THREE.Vector3(0, 0.66, 0), radius: 0.8 };
}
