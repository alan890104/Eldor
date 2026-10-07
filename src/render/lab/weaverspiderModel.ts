// Dreamweaver Spider (model lab version): from the ceiling of the underground forest hangs a whole sheet of silver web, every thread a dream it has collected;
// the Society's prophets sleep beneath the web, and when they wake they know what will happen tomorrow. Dark + nature elements, positioned for webs and traps (trait "Weaving": when a trap fires, the opponent's speed drops).
//
// Identifying features settled on:
// 1. A spider's build: a big cephalothorax (the face directly in front), a round abdomen tilted high behind, and eight jointed legs arched at the two sides of the body. In silhouette it is a spider at a glance.
// 2. The dreamcatcher (the signature object): the right foreleg holds high a hoop bent from a tree root, in which a web is woven of silver thread: eight radial threads and spiral threads sagging ring after ring toward the center,
//    a moonstone set at the center of the web, and five dream beads of different colors hanging on the threads (each one a dream it has collected); a few moss-green young leaves sprout from the root hoop, with two silk tassels hanging below.
// 3. The face: a jumping spider's eight eyes. The front row is two big principal eyes, entirely dark with a mirror gloss, and a pair of anterior lateral eyes one size smaller on the outside; further back on the top of the head are two tiny posterior median eyes
//    and two posterior lateral eyes. From the lower edge of the principal eyes to the base of the chelicerae is a pale purple whisker (the paler fur on the clypeus), and below it two chelicerae with a dark green metallic gloss, the tips small ivory fangs.
//    No brows, no mouth line, no sclera or eyelids: the face is made after a jumping spider's real appearance, and the personality comes from posture and action.
// 4. Color scheme: a dark indigo-purple velvety body (dark), a ring of pale purple joint at the end of each leg segment; silver-white thread, warm brown tree root and moss-green young leaves (nature).
// 5. Back: on the back of the round abdomen a closed eye is embroidered in silver thread, its lashes drooping; that is the eye that dreams for the prophets beneath the web. Three spinnerets at the tail end.
//
// Body shape: a spider. The cephalothorax in front, the round abdomen behind tilted up (the posture of an orb-weaver, with two shoulder humps on the front edge of the abdomen), each of the eight legs in three segments (the femur arched up to the knee, the tibia going outward and down,
// the metatarsus touching the ground), the knees higher than the head, so from the front and from the side they are a spider's arched legs. The right foreleg holds the hoop, the left foreleg is the one that taps the ground, and the other six stand.
// Two pedipalps reach out from under the face, the fingertips touching in front of the chin, like a person with fingertips pressed together, calculating.
//
// Personality: an unhurried, tight-lipped collector of dreams. It has long known where you will step tomorrow, and only smiles and does not say.
// Expression: the two mirror-ball big eyes face straight ahead (taking everything in), the head tilted slightly; the pedipalp fingertips pressed together and the left foreleg tapping the ground are its calculating.
// Gaze order: the face (the dark mirror-ball big eyes and highlights, the pale purple whisker below, the dark green chelicerae) first, the dreamcatcher held up by the right foreleg (silver web, moonstone, dream beads) second,
// and the eight arched legs and the round abdomen as support.
// Restrained light effects: no translucent mist shell and no scattered glowing dots; the only emissive is a trace on the dream beads and the moonstone, and the silver thread brightens along only with act.glow.
//
// Action table (battle actions and the ultimate follow this table):
// - Idle: the pedipalp fingertips tap lightly against each other in front of the chin; every few seconds the left foreleg taps the ground twice (waiting for you to step into the web); the dreamcatcher sways lightly like a pendulum; the round abdomen breathes slowly;
//   a spider has no eyelids and does not turn its eyeballs: when looking around the whole cephalothorax turns slowly, and at the end of the turn it snaps into alignment in jerks.
// - Move: the eight legs in a wave of alternating small steps, the body kept level, the foot holding the hoop never put down.
// - Charge-up: the body pressed down slightly, the pedipalps drawn in before the mouth, the dreamcatcher raised high (act.raise), the dream beads and silver thread lighting up (act.glow).
// - Strike: the dreamcatcher flung forward, with silver thread shot from the center of the web (anchor web); or a thread drawn from the spinnerets at the tail end (anchor spinner) to lay a trap.
// - Hit: the eight legs draw in together and the body shrinks back, the dreamcatcher held in front of it; after it recovers the pedipalps slowly press together again.
// - Victory: raises the dreamcatcher high and gives it a gentle turn, the left foreleg tapping the ground gracefully, like a bow.
// Named anchors: rig.head (center of the face), rig.eyes (the surfaces of the two principal eyes), anchors.mouth (between the bases of the two chelicerae), anchors.web (the moonstone at the center of the web),
// anchors.hoop (the hanging thread at the top of the hoop, and the toe holding the hoop), anchors.palps (between the pedipalp fingertips), anchors.spinner (the spinnerets at the tail end),
// anchors.dreamEye (the center of the closed eye embroidered on the back), anchors.foot (the toe tip of the left foreleg tapping the ground).
// act: glow (0-1, the dream beads, moonstone and silver thread brighten), raise (0-1, the right foreleg raises the dreamcatcher high).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { mergeStatic, partKit, PI, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type V = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v3(1, 0, 0);
const UP = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const WHITE = col(0xffffff);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Normal direction check for the whole mesh: the average must point away from the ref point, and if reversed it is flipped */
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

/** After the rings of vertices that close to a point are merged, filter out the zero-area triangles (reference.md pitfall 85) */
function dropDegenerate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!.array;
  const out: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i];
    const b = idx[i + 1];
    const c = idx[i + 2];
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  g.setIndex(out);
  return g;
}

/**
 * A grid surface going once around: rows along the cross-section, cols around (the last column joins back to the first, with no seam line).
 * When the head and tail of the cross-section shrink to a point (poles), the normals of that row are averaged, so the poles do not show outline dots.
 */
function wrapGrid(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, ref: THREE.Vector3): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const cl = new Float32Array(rows * cols * 3);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      const k = (i * cols + j) * 3;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
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
      if (i > 0) idx.push(a, b, c);
      if (i < rows - 2) idx.push(b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  orientOut(g, ref);
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (const i of [0, rows - 1]) {
    const n = new THREE.Vector3();
    for (let j = 0; j < cols; j++) n.x += na.getX(i * cols + j), n.y += na.getY(i * cols + j), n.z += na.getZ(i * cols + j);
    n.normalize();
    for (let j = 0; j < cols; j++) na.setXYZ(i * cols + j, n.x, n.y, n.z);
  }
  return g;
}

/** A grid surface (a ring) going once around in both directions: u and v of f(u, v) are both 0-1 */
function torusGrid(NU: number, NV: number, f: (u: number, v: number) => { p: THREE.Vector3; c: THREE.Color }, center: (u: number) => THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++) {
      const { p, c } = f(i / NU, j / NV);
      pos.push(p.x, p.y, p.z);
      cl.push(c.r, c.g, c.b);
    }
  const idx: number[] = [];
  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++) {
      const i2 = (i + 1) % NU;
      const j2 = (j + 1) % NV;
      const a = i * NV + j;
      const b = i2 * NV + j;
      const c = i * NV + j2;
      const d = i2 * NV + j2;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // The normals of the first ring must point away from the tube's center line
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, 0);
  const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, 0);
  if (n.dot(p.sub(center(0))) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
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

interface SweepOpts {
  /** The position of each row on the curve (arc-length proportion, 0-1) */
  ts: number[];
  radial: number;
  /** The wide direction is fixed toward it (a curve in a plane); if not given a parallel-transport frame is used, and an upright tube that curls back does not twist either */
  side?: THREE.Vector3;
  /** Coloring: t is the arc-length proportion and th is the angle on the cross-section; rows closed to a point at the ends can only be colored by t, so the vertices can be merged */
  paint?: (t: number, th: number) => THREE.Color;
}

/**
 * Loft along a curve: rad(t) returns [width-direction radius, height-direction radius]. The height direction = width × tangent, and the winding always faces outward (the same as loft in shapes.ts).
 * Giving 0 for the radius at the two ends closes them into round heads; the positions of the rows are decided by ts, and can be denser near the closures.
 */
function sweep(pts: THREE.Vector3[], rad: (t: number) => [number, number], o: SweepOpts): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const R = o.radial;
  const pos: number[] = [];
  const cl: number[] = [];
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  const prevT = new THREE.Vector3();
  const q = new THREE.Quaternion();
  o.ts.forEach((t, i) => {
    path.getPointAt(t, C);
    path.getTangentAt(t, T);
    if (o.side) W.copy(o.side).addScaledVector(T, -T.dot(o.side));
    else if (i === 0) W.copy(Math.abs(T.y) < 0.95 ? UP : X).cross(T);
    else {
      q.setFromUnitVectors(prevT, T);
      W.applyQuaternion(q).addScaledVector(T, -T.dot(W));
    }
    if (W.lengthSq() < 1e-10) W.set(1, 0, 0);
    W.normalize();
    prevT.copy(T);
    H.crossVectors(W, T).normalize();
    const [a, b] = rad(t);
    for (let j = 0; j <= R; j++) {
      const th = ((j % R) / R) * PI * 2;
      const ca = Math.cos(th) * a;
      const sb = Math.sin(th) * b;
      pos.push(C.x + W.x * ca + H.x * sb, C.y + W.y * ca + H.y * sb, C.z + W.z * ca + H.z * sb);
      const c = o.paint ? o.paint(t, th) : WHITE;
      cl.push(c.r, c.g, c.b);
    }
  });
  const idx: number[] = [];
  for (let i = 0; i < o.ts.length - 1; i++)
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j;
      const b = a + R + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  const m = mergeVertices(g, 1e-6);
  dropDegenerate(m);
  m.computeVertexNormals();
  return m;
}

/** Positions of the loft rows: 3 rows at each end laid out at the angles of a round head (c0 and c1 are the closing lengths), and n evenly divided segments in the middle */
function capTs(L: number, c0: number, c1: number, n: number): number[] {
  const s: number[] = [];
  for (let k = 0; k < 3; k++) s.push(c0 * (1 - Math.cos((k / 3) * (PI / 2))));
  for (let k = 0; k <= n; k++) s.push(lerp(c0, L - c1, k / n));
  for (let k = 2; k >= 0; k--) s.push(L - c1 * (1 - Math.cos((k / 3) * (PI / 2))));
  return s.map((x) => clamp(x / L, 0, 1));
}

/** The proportion of the round-head closure: the radius multiplier at distance s from the endpoint with closing length c */
const capK = (s: number, L: number, c0: number, c1: number) => (s < c0 ? Math.sqrt(Math.max(0, 1 - (1 - s / c0) ** 2)) : 1) * (s > L - c1 ? Math.sqrt(Math.max(0, 1 - (1 - (L - s) / c1) ** 2)) : 1);

interface TubeOpts {
  radial?: number;
  n?: number;
  side?: THREE.Vector3;
  /** The proportion by which the end swells outward into a joint sleeve */
  flare?: number;
  /** The radius multiplier in the height direction (a flat tube) */
  flat?: number;
  /** Extra rows added (there must be rows on both sides of a color-change boundary, or the boundary stretches into a long gradient) */
  extra?: number[];
  paint?: (t: number, th: number) => THREE.Color;
}

/** A tube with both ends closed into round heads: the radius changing gradually from r0 to r1, the end able to swell into a joint sleeve (femur, pedipalps, silk) */
function tube(pts: THREE.Vector3[], r0: number, r1: number, o: TubeOpts = {}): THREE.BufferGeometry {
  const L = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getLength();
  const flare = o.flare ?? 0;
  const rr = (u: number) => lerp(r0, r1, u) * (1 + flare * sstep(u, 0.68, 0.86));
  const c0 = Math.min(r0 * 0.95, L * 0.3);
  const c1 = Math.min(rr(1) * 0.95, L * 0.3);
  const ts = [...new Set([...capTs(L, c0, c1, o.n ?? 8), ...(o.extra ?? [])])].sort((a, b) => a - b);
  const flat = o.flat ?? 1;
  return sweep(
    pts,
    (t) => {
      const r = rr(t) * capK(t * L, L, c0, c1);
      return [r, r * flat];
    },
    { ts, radial: o.radial ?? 10, side: o.side, paint: o.paint },
  );
}

/** The radius function of a superellipsoid: the half axes may differ up and down and front and back (b up, b down, c front, c back), and the larger the exponent n the squarer it is */
function superR(d: THREE.Vector3, a: number, bT: number, bB: number, cF: number, cB: number, n: number): number {
  const b = d.y >= 0 ? bT : bB;
  const c = d.z >= 0 ? cF : cB;
  const s = Math.pow(Math.abs(d.x / a), n) + Math.pow(Math.abs(d.y / b), n) + Math.pow(Math.abs(d.z / c), n);
  return Math.pow(s, -1 / n);
}

/** A grid mesh of a star-shaped surface (from the center the surface is hit only once in each direction): the poles at ±z, and the distribution of θ decided by thetaOf */
function starGeo(rho: (d: V) => number, rows: number, cols: number, thetaOf: (s: number) => number, color: (d: V, p: V) => THREE.Color): THREE.BufferGeometry {
  return wrapGrid(
    rows,
    cols,
    (i, j) => {
      const th = thetaOf(i / (rows - 1));
      const ph = (j / cols) * PI * 2;
      const d = v3(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th));
      const p = d.clone().multiplyScalar(rho(d));
      return { p, c: color(d, p) };
    },
    v3(0, 0, 0),
  );
}

/** The surface point and normal in direction d on a star-shaped surface (numerical differentiation) */
function starAt(rho: (d: V) => number, d0: V): { p: V; n: V } {
  const d = d0.clone().normalize();
  const h = 1e-3;
  const t1 = (Math.abs(d.y) < 0.9 ? UP : X).clone().cross(d).normalize();
  const t2 = d.clone().cross(t1).normalize();
  const P = (dd: V) => {
    const u = dd.clone().normalize();
    return u.multiplyScalar(rho(u));
  };
  const a = P(d.clone().addScaledVector(t1, h)).sub(P(d.clone().addScaledVector(t1, -h)));
  const b = P(d.clone().addScaledVector(t2, h)).sub(P(d.clone().addScaledVector(t2, -h)));
  const n = a.cross(b).normalize();
  if (n.dot(d) < 0) n.negate();
  return { p: P(d), n };
}

/** Align the group's +y to dirY and its +z to faceZ as far as possible */
function orient(g: THREE.Object3D, dirY: THREE.Vector3, faceZ: THREE.Vector3): void {
  const y = dirY.clone().normalize();
  const z = faceZ.clone().addScaledVector(y, -faceZ.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * A leaf: growing out from the origin along +y with the leaf face toward +z, the two edges turned up slightly toward +z and the end bending toward -z; a pale midrib on the front.
 */
function leafGeo(len: number, w: number, th: number, face: THREE.Color, back: THREE.Color, vein: THREE.Color): THREE.BufferGeometry {
  const pts = [0, 0.33, 0.66, 1].map((u) => v3(0, len * u, -0.18 * len * u * u));
  const width = (t: number) => Math.max(0, t < 0.42 ? Math.sin((PI / 2) * (t / 0.42)) ** 0.7 : Math.max(0, Math.cos((PI / 2) * ((t - 0.42) / 0.58))) ** 0.9);
  const ts = [0, 0.04, 0.1, 0.2, 0.32, 0.45, 0.58, 0.7, 0.82, 0.92, 1];
  return sweep(
    pts,
    (t) => [(w / 2) * width(t) + 1e-4, (th / 2) * width(t) + 1e-4],
    {
      ts,
      radial: 8,
      side: X,
      paint: (t, a) => {
        const top = Math.sin(a) >= -0.2;
        if (!top) return back;
        return face.clone().lerp(vein, (1 - sstep(Math.abs(Math.cos(a)), 0.05, 0.3)) * sstep(t, 0.05, 0.2) * (1 - sstep(t, 0.8, 0.95)));
      },
    },
  );
}

// ───────────────────────── Shape ─────────────────────────

export function buildWeaverspiderLab(): LabModel {
  const RIMC = 0xcbb8ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    // The cephalothorax, round abdomen, legs and pedipalps all use the same vertex-color material: only parts under the same owner can be merged (mesh budget)
    fur: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    // Eight eyes: dark mirror surfaces; the material's own reflectivity is pressed low, so it does not combine with the highlight point into two big white lights
    eye: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.3, rimColor: RIMC, spec: 0 })),
    fang: vc(labToon(0xffffff, { ramp: 'metal', rim: 0.35, rimColor: 0xc8f5e6, spec: 0.8, specTh: 0.975 })),
    silk: vc(labToon(0xffffff, { rim: 0.8, rimColor: 0xf4f2ff, spec: 0.3, specTh: 0.975, emissive: 0x8a78d0, emissiveAmt: 0 })),
    wood: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xffe6c8 })),
    bead: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.3, rimColor: 0xffffff, emissive: 0x7a66b8, emissiveAmt: 0.28 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const C = {
    fur: col(0x3d3373),
    furTop: col(0x4d4389),
    furLow: col(0x2c2556),
    mask: col(0x9f8fd6),
    maskLow: col(0x8a7bc4),
    band: col(0xa596d8),
    claw: col(0x221b42),
    belly: col(0x5a4b8e),
    hump: col(0x9a88d4),
    fang: col(0x2f6470),
    fangTip: col(0xf1e9d6),
    palpTip: col(0xeee6f8),
    silk: col(0xeceef8),
    silkShade: col(0xc8cae2),
    bark: col(0x5b3d2e),
    barkHi: col(0x8c6448),
    leaf: col(0x68a64c),
    leafBack: col(0x4d7e3c),
    leafVein: col(0xa8d27a),
  };

  // Joint sleeves of the legs and pedipalps: a ring of pale purple at the end of each segment; at the toe tip a short stretch of dark claw
  const bandPaint = (t: number) => C.fur.clone().lerp(C.band, sstep(t, 0.765, 0.795));
  const clawPaint = (t: number) => C.fur.clone().lerp(C.claw, sstep(t, 0.83, 0.87));
  const BAND_TS = [0.7, 0.74, 0.765, 0.78, 0.795, 0.82];
  const CLAW_TS = [0.78, 0.81, 0.83, 0.85, 0.87, 0.9];

  const root = new THREE.Group();
  root.name = 'weaverspider-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const BODY = 9601;
  const ABD = 9602;
  const WEB = 9603;
  const EMB = 9604;

  // ── Cephalothorax: a flat face in front and round behind; higher on top than below ──
  const PRO_P = v3(0, 0.45, 0.2);
  const PRO_RX = -0.06;
  const PRO_RZ = 0.045;
  const pro = group(root, [PRO_P.x, PRO_P.y, PRO_P.z], [PRO_RX, 0, PRO_RZ]);
  const proRho = (d: V) => superR(d, 0.31, 0.27, 0.19, 0.26, 0.33, 2.4);
  const FZ = 0.26;
  /** The point (x, y) on the face: shot from the center of the cephalothorax along (x, y, FZ) to the surface (the face is almost flat, so the point hit is roughly (x, y)) */
  const faceAt = (x: number, y: number) => starAt(proRho, v3(x, y, FZ));
  // Face hair: a paler step of purple grows only in a whisker from the lower edge of the principal eyes to the base of the chelicerae (the hair on a jumping spider's clypeus), following the mouth; the row of eyes is itself the dark cephalothorax, with no pale round face laid on
  const maskAmt = (p: V) => (1 - sstep(Math.abs(p.x / 0.25) ** 2 + ((p.y + 0.1) / 0.06) ** 2, 0.7, 1.05)) * sstep(p.z, 0.02, 0.11);
  {
    const geo = starGeo(proRho, 36, 52, (s) => PI * Math.pow(s, 1.15), (d, p) => {
      const c = C.fur.clone().lerp(C.furTop, sstep(d.y, 0.3, 0.85)).lerp(C.furLow, sstep(-d.y, 0.3, 0.8));
      return c.lerp(C.mask.clone().lerp(C.maskLow, sstep(-p.y, 0.02, 0.14)), maskAmt(p));
    });
    add(pro, geo, M.fur).userData.inkGroup = BODY;
  }

  // ── The two principal eyes (a jumping spider's anterior median eyes): each a whole dark glossy mirror ball, bulging from the face; no eyelids, no blinking ──
  // The eyeball itself does not turn: what a jumping spider turns is the retina behind the eye, which cannot be seen from outside, so looking around is left to the cephalothorax turning.
  // A ring of dark purple reflection at the lower edge, and one small point of highlight at the upper right (under a tenth of the eye in area), at the same position on both eyes, so the gaze is consistent. No doll eyes: no iris or pupil, no two big white lights.
  const ER = 0.104;
  const EYE_X = 0.116;
  const EYE_Y = 0.045;
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const cEye = col(0x1b1336);
  const cEyeBounce = col(0x44357e);
  const eyeball = paint(new THREE.SphereGeometry(ER, 24, 14, 0, PI * 2, 0, PI * 0.6).rotateX(PI / 2), (p) => {
    const q = p.clone().normalize();
    // Reflection on the lower edge: the ring facing down and outward
    return cEye.clone().lerp(cEyeBounce, sstep(-q.y, 0.35, 0.8) * sstep(q.z, 0.05, 0.4) * 0.8);
  });
  for (const sx of [-1, 1]) {
    const { p, n } = faceAt(sx * EYE_X, EYE_Y);
    const c = p.clone().addScaledVector(n, -ER * 0.3);
    const eg = group(pro, [c.x, c.y, c.z]);
    // The mirror balls face forward and slightly outward (a jumping spider's principal eyes are a pair of headlights looking forward side by side)
    const f = n.clone().addScaledVector(X, sx * 0.06).normalize();
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    add(eg, eyeball, M.eye);
    // Highlight: one small point at the upper right, in the same direction for both eyes (the light comes from the same side); the eye's local +x points to world +x for both eyes
    for (const [d, rr] of [[v3(0.36, 0.42, 1), 0.021]] as [V, number][]) {
      const hp = d.clone().normalize().multiplyScalar(ER * 0.985);
      const hg = group(eg, [hp.x, hp.y, hp.z]);
      hg.quaternion.setFromUnitVectors(Z, hp.clone().normalize());
      const hl = add(hg, new THREE.SphereGeometry(rr, 10, 6), M.hi, [0, 0, 0], [0, 0, 0], [1, 1, 0.4]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(eg, [0, 0, ER]));
  }

  // The other six small eyes (the group of simple eyes): the two anterior lateral eyes at the outside of the front row line up with the principal eyes in one row, and going back on the top of the head are two tiny posterior median eyes and two posterior lateral eyes;
  // all dark glossy hemispheres, with the anterior lateral eyes carrying a little highlight
  {
    const small: [V, number, boolean][] = [
      [v3(0.262, 0.105, 0.19), 0.042, true],
      [v3(0.2, 0.27, 0.1), 0.017, false],
      [v3(0.2, 0.27, -0.04), 0.032, true],
    ];
    for (const sx of [-1, 1])
      for (const [d, r, shine] of small) {
        const { p, n } = starAt(proRho, v3(sx * d.x, d.y, d.z));
        const g = group(pro, [p.x - n.x * r * 0.3, p.y - n.y * r * 0.3, p.z - n.z * r * 0.3]);
        g.quaternion.setFromUnitVectors(Z, n);
        add(g, paint(new THREE.SphereGeometry(r, 14, 7, 0, PI * 2, 0, PI * 0.58).rotateX(PI / 2), () => cEye), M.eye);
        if (shine) {
          const hl = add(g, new THREE.SphereGeometry(r * 0.26, 8, 5), M.hi, [r * 0.3, r * 0.38, r * 0.86], [0, 0, 0], [1, 1, 0.4]);
          hl.layers.disable(INK_LAYER);
          hl.castShadow = false;
          glints.push(hl);
        }
      }
  }

  // Mouth: a spider's mouth is between the bases of the two chelicerae, and no mouth line is drawn on the face; the anchor is placed at the base of the chelicerae
  const MOUTH_Y = -0.13;

  // Chelicerae: two round fangs under the smile line carrying a dark green metallic gloss, the ends bending inward into small ivory fangs
  for (const sx of [-1, 1]) {
    const pts = [v3(sx * 0.046, -0.1, 0.14), v3(sx * 0.052, -0.162, 0.232), v3(sx * 0.046, -0.21, 0.252), v3(sx * 0.026, -0.238, 0.246)];
    const L = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getLength();
    const ts = capTs(L, 0.032, 0.007, 9);
    add(pro, sweep(pts, (t) => {
      const s = t * L;
      const r = lerp(0.034, 0.01, sstep(t, 0.5, 0.95)) * capK(s, L, 0.032, 0.007);
      return [r, r * 0.92];
    }, { ts, radial: 10, paint: (t) => C.fang.clone().lerp(C.fangTip, sstep(t, 0.7, 0.78)) }), M.fang);
  }

  // ── Pedipalps: reaching out from the two sides under the face, going forward, down and then inward, the furry pale fingertips touching in front of the chin ──
  const palps: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const base = v3(sx * 0.15, -0.1, 0.15);
    const pg = group(pro, [base.x, base.y, base.z]);
    palps.push({ g: pg, sx });
    const E = v3(sx * 0.2, -0.2, 0.33).sub(base);
    const T = v3(sx * 0.056, -0.228, 0.44).sub(base);
    add(pg, tube([v3(0, 0, 0), E.clone().multiplyScalar(0.5).add(v3(sx * 0.01, 0.01, 0)), E], 0.036, 0.03, { radial: 10, n: 5, flare: 0.22, paint: bandPaint, extra: BAND_TS }), M.fur);
    add(pg, tube([E.clone().addScaledVector(T.clone().sub(E), -0.08), E.clone().lerp(T, 0.5).add(v3(0, 0.012, 0)), T], 0.029, 0.025, { radial: 10, n: 6, paint: () => C.fur }), M.fur);
    add(pg, new THREE.SphereGeometry(0.041, 12, 8), M.fur, [T.x, T.y + 0.004, T.z + 0.006], [0, 0, 0], [1, 0.92, 1.05]);
    // The fur on the fingertips is pale: the vertex colors of the ball are painted separately
    const tip = pg.children[pg.children.length - 1] as THREE.Mesh;
    tip.geometry = paint(tip.geometry.clone(), () => C.palpTip);
  }

  // ── Round abdomen: tilted up behind the cephalothorax, with two shoulder humps on the front edge; a closed eye embroidered in silver thread on the back ──
  const ABD_P = v3(0, 0.62, -0.38);
  const ABD_RX = 0.35;
  const abd = group(root, [ABD_P.x, ABD_P.y, ABD_P.z], [ABD_RX, 0, 0]);
  const humps = [-1, 1].map((s) => v3(s * 0.62, 0.72, 0.3).normalize());
  const humpAmt = (d: V) => humps.reduce((m, h) => Math.max(m, Math.exp(-((Math.acos(clamp(d.dot(h), -1, 1)) / 0.3) ** 2))), 0);
  const abdRho = (d: V) => superR(d, 0.33, 0.3, 0.27, 0.3, 0.41, 2.15) + 0.06 * humpAmt(d);
  {
    const geo = starGeo(abdRho, 38, 56, (s) => PI * s, (d) => {
      const c = C.fur.clone().lerp(C.furTop, sstep(d.y, 0.2, 0.8)).lerp(C.belly, sstep(-d.y, 0.25, 0.75));
      return c.lerp(C.hump, sstep(humpAmt(d), 0.55, 0.85));
    });
    add(abd, geo, M.fur).userData.inkGroup = ABD;
  }
  // The closed eye on the back: a downward-curving eyeline (thick in the middle and thin at the ends) plus five lashes hanging down, the silver thread half buried in the abdomen surface
  const nB = v3(0, 0.08, -1).normalize();
  const eU = X.clone();
  const eW = new THREE.Vector3().crossVectors(X, nB).normalize();
  const onAbd = (u: number, w: number, lift: number) => {
    const { p, n } = starAt(abdRho, nB.clone().addScaledVector(eU, u).addScaledVector(eW, w));
    return p.addScaledVector(n, lift);
  };
  const EU = 0.66;
  const lidW = (u: number) => 0.1 - 0.2 * (1 - (u / EU) ** 2);
  {
    // Eyeline: thick in the middle, thinning at both ends (the radius varying with u)
    const pts: V[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = -EU + (i / 16) * 2 * EU;
      pts.push(onAbd(u, lidW(u), 0.006));
    }
    const L = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getLength();
    const ts = capTs(L, 0.01, 0.01, 36);
    add(abd, sweep(pts, (t) => {
      const r = (0.01 + 0.009 * Math.sin(PI * t) ** 0.8) * capK(t * L, L, 0.01, 0.01);
      return [r, r];
    }, { ts, radial: 8, paint: () => C.silk }), M.silk).userData.inkGroup = EMB;
    // Lashes: spreading radially downward from the eyeline, the ends curling outward (a row hanging straight down would look like teeth)
    for (const [u, ang, len] of [[-0.46, -0.95, 0.15], [-0.24, -0.45, 0.17], [0, 0, 0.16], [0.24, 0.45, 0.17], [0.46, 0.95, 0.15]] as [number, number, number][]) {
      const w0 = lidW(u) - 0.006;
      const lash = [0, 0.35, 0.7, 1].map((k) => {
        const a = ang * (1 + 0.45 * k);
        return onAbd(u + Math.sin(a) * len * k, w0 - Math.cos(a) * len * k, 0.005);
      });
      add(abd, tube(lash, 0.013, 0.0075, { radial: 7, n: 6, paint: () => C.silk }), M.silk).userData.inkGroup = EMB;
    }
    // Fold line of the eyelid: a thin arc above the eyeline, which together with the eyeline makes an almond-shaped eye
    {
      const pts: V[] = [];
      for (let i = 0; i <= 12; i++) {
        const u = -0.5 + (i / 12) * 1.0;
        pts.push(onAbd(u, 0.13 + 0.13 * (1 - (u / 0.5) ** 2), 0.005));
      }
      add(abd, tube(pts, 0.0085, 0.0085, { radial: 6, n: 24, paint: () => C.silk }), M.silk).userData.inkGroup = EMB;
    }
    // Above the closed eye a few four-pointed stars embroidered: the prophet dreams beneath the web, beneath a starry sky
    for (const [u, w, k] of [[-0.68, 0.38, 1.25], [0.66, 0.48, 1.45], [-0.12, 0.66, 1.05]] as [number, number, number][]) {
      for (const [du, dw, len] of [[0, 1, 0.13], [1, 0, 0.085]] as [number, number, number][]) {
        const pts = [-1, -0.5, 0, 0.5, 1].map((f) => onAbd(u + du * f * len * k, w + dw * f * len * k, 0.004));
        const ts = [0, 0.06, 0.15, 0.3, 0.5, 0.7, 0.85, 0.94, 1];
        add(abd, sweep(pts, (t) => {
          const r = 0.0095 * k * Math.pow(Math.sin(PI * t), 1.6) + 1e-4;
          return [r, r];
        }, { ts, radial: 6, paint: () => C.silk }), M.silk).userData.inkGroup = EMB;
      }
    }
  }
  // Spinnerets: three small bumps at the tail end, with pale purple tips
  for (const [dx, dy] of [[0, -2.2], [-0.16, -2.0], [0.16, -2.0]] as [number, number][]) {
    const d = v3(dx, dy, -1).normalize();
    const { p, n } = starAt(abdRho, d);
    const a = p.clone().addScaledVector(n, -0.03);
    const b = p.clone().addScaledVector(n, 0.032).add(v3(0, -0.01, 0));
    add(abd, tube([a, a.clone().lerp(b, 0.5), b], 0.02, 0.015, { radial: 8, n: 4, paint: () => C.belly }), M.fur);
  }

  // ── Eight legs: the femur arched up to the knee, the tibia going outward and down, the metatarsus touching the ground; the end of each segment swelling into a pale purple joint sleeve ──
  interface LegSpec {
    psi: number;
    A: [number, number, number];
    kr: number;
    ky: number;
    jr: number;
    jy: number;
    mr: number;
    my: number;
    fr: number;
    r: number;
  }
  // Knee (end of the femur), ankle (end of the tibia), end of the metatarsus, toe tip: the horizontal distance and height from the attachment point
  const LEGS: LegSpec[] = [
    { psi: 0.95, A: [0.24, 0.37, 0.27], kr: 0.32, ky: 0.76, jr: 0.53, jy: 0.46, mr: 0.62, my: 0.13, fr: 0.7, r: 0.064 },
    { psi: 1.35, A: [0.24, 0.4, 0.19], kr: 0.31, ky: 0.77, jr: 0.53, jy: 0.46, mr: 0.62, my: 0.13, fr: 0.7, r: 0.062 },
    { psi: 1.76, A: [0.23, 0.4, 0.1], kr: 0.31, ky: 0.76, jr: 0.52, jy: 0.45, mr: 0.6, my: 0.13, fr: 0.68, r: 0.06 },
    { psi: 2.18, A: [0.19, 0.4, 0.03], kr: 0.3, ky: 0.72, jr: 0.5, jy: 0.43, mr: 0.58, my: 0.12, fr: 0.66, r: 0.058 },
  ];
  /** The four segments of a leg: femur, tibia, metatarsus, tarsus (the foot); returns the geometry of each segment (coordinates minus origin) */
  const legGeos = (A: V, K: V, J: V, Mt: V, F: V, r: number, side: V, origin: V) => {
    const o = (p: V) => p.clone().sub(origin);
    const bow = (a: V, b: V, k: number, out: V) => a.clone().lerp(b, 0.5).addScaledVector(out, k);
    const outD = F.clone().sub(A).setY(0).normalize();
    return {
      femur: tube([o(A), o(bow(A, K, 0.03, UP)), o(K)], r * 1.05, r * 0.82, { radial: 10, n: 6, flare: 0.2, side, paint: bandPaint, extra: BAND_TS }),
      tibia: tube([o(K), o(bow(K, J, 0.018, UP)), o(J)], r * 0.8, r * 0.64, { radial: 10, n: 6, flare: 0.2, side, paint: bandPaint, extra: BAND_TS }),
      meta: tube([o(J), o(bow(J, Mt, -0.018, outD)), o(Mt)], r * 0.6, r * 0.46, { radial: 9, n: 5, flare: 0.2, side, paint: bandPaint, extra: BAND_TS }),
      tarsus: tube([o(Mt), o(bow(Mt, F, 0.006, UP)), o(F)], r * 0.44, r * 0.3, { radial: 8, n: 3, side, paint: clawPaint, extra: CLAW_TS }),
    };
  };
  let tapG: THREE.Group | null = null;
  let tapAxis = v3(1, 0, 0);
  let footA: THREE.Group | null = null;
  let legR1: THREE.Group | null = null;
  let hoopPivot: THREE.Group | null = null;
  for (const s of [-1, 1])
    for (let i = 0; i < LEGS.length; i++) {
      const L = LEGS[i];
      const dir = v3(s * Math.sin(L.psi), 0, Math.cos(L.psi));
      const side = v3(dir.z, 0, -dir.x);
      const A = v3(s * L.A[0], L.A[1], L.A[2]);
      const at = (rr: number, y: number) => A.clone().addScaledVector(dir, rr).setY(y);
      if (i === 0 && s === -1) {
        // Right foreleg: raised up and forward, the toe tip hooking the hanging thread of the dreamcatcher
        // The femur passes on the right of the hoop and the tibia crosses over the top of the hoop, so the leg does not block the face of the web; the dreamcatcher hangs below the toe tip on a longer length of hanging thread
        const A1 = v3(-0.22, 0.37, 0.3);
        A.copy(A1);
        const K = v3(-0.4, 0.84, 0.36);
        const J = v3(-0.56, 1.03, 0.48);
        const hook = [J, v3(-0.592, 1.045, 0.512), v3(-0.607, 1.018, 0.54), v3(-0.606, 0.972, 0.553)];
        const lg = group(root, [A.x, A.y, A.z]);
        legR1 = lg;
        const sd = new THREE.Vector3().crossVectors(K.clone().sub(A), UP).normalize();
        const g = legGeos(A, K, J, J, J, L.r, sd, A);
        add(lg, g.femur, M.fur);
        add(lg, g.tibia, M.fur);
        add(lg, tube(hook.map((p) => p.clone().sub(A)), L.r * 0.6, L.r * 0.34, { radial: 9, n: 8, paint: clawPaint, extra: CLAW_TS }), M.fur);
        hoopPivot = group(lg, [-0.604 - A.x, 0.99 - A.y, 0.548 - A.z]);
        continue;
      }
      const K = at(L.kr, L.ky);
      const J = at(L.jr, L.jy);
      const Mt = at(L.mr, L.my);
      const F = at(L.fr, 0.02);
      const g = legGeos(A, K, J, Mt, F, L.r, side, v3(0, 0, 0));
      add(root, g.femur, M.fur);
      add(root, g.tibia, M.fur);
      if (i === 0 && s === 1) {
        // The metatarsus of the left foreleg taps the ground: the pivot is the joint at the end of the tibia
        const tg = group(root, [J.x, J.y, J.z]);
        tapG = tg;
        tapAxis = side.clone();
        // The angle of turning to align about side must make the toe tip lift up
        const probe = F.clone().sub(J).applyAxisAngle(tapAxis, 0.2);
        if (probe.y < F.y - J.y) tapAxis.negate();
        const gm = legGeos(A, K, J, Mt, F, L.r, side, J);
        add(tg, gm.meta, M.fur);
        add(tg, gm.tarsus, M.fur);
        footA = group(tg, [F.x - J.x, F.y - J.y, F.z - J.z]);
        continue;
      }
      add(root, g.meta, M.fur);
      add(root, g.tarsus, M.fur);
    }

  // ── Dreamcatcher: a hoop bent from a tree root, a silver-thread web, the moonstone at the center of the web, five dream beads, young leaves on the hoop and two silk tassels ──
  const HR = 0.22;
  const HT = 0.021;
  const HANG = 0.13;
  // Orientation of the hoop face: a flat hoop is bound to be edge-on from some angles, so it hangs on its thread and slowly twists back and forth (idle), and every angle gets its turn at facing front.
  // The phase counts from the first update (a Creature's time starts at a random number of seconds, and an avatar counts only one frame): on the first frame the hoop face is turned 0.33 radians,
  // and in the avatar (turned 0.55), the lab bench's three-quarter view, the front and the back the web can be seen, and from the side it never becomes just a line
  const HOOP_YAW = 0.3;
  const hoopTwist = (since: number) => HOOP_YAW + 0.55 * Math.sin((2 * PI * since) / 10 + 0.06);
  const hoopG = group(hoopPivot!, [0, -(HR + HANG), 0], [0, HOOP_YAW, 0]);
  {
    // Tree-root hoop: two strands of root twisted together (the cross-section radius undulating with the twist)
    const TW = 18;
    const ring = torusGrid(120, 10, (u, v) => {
      const ph = u * PI * 2;
      const th = v * PI * 2;
      const tw = Math.cos(2 * th - TW * ph);
      const r = HT * (1 + 0.2 * tw);
      const R = HR + r * Math.cos(th);
      return { p: v3(R * Math.cos(ph), R * Math.sin(ph), r * Math.sin(th)), c: C.bark.clone().lerp(C.barkHi, 0.5 + 0.5 * tw) };
    }, (u) => v3(HR * Math.cos(u * PI * 2), HR * Math.sin(u * PI * 2), 0));
    add(hoopG, ring, M.wood);
  }
  // Radial threads: eight, avoiding the hanging thread directly above
  const silkPaint = (t: number, th: number) => C.silk.clone().lerp(C.silkShade, 0.35 * (0.5 - 0.5 * Math.sin(th)));
  const spokeA = Array.from({ length: 8 }, (_, k) => (k / 8) * PI * 2 + PI / 8);
  for (const a of spokeA) {
    const p0 = v3(Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0);
    const p1 = v3(Math.cos(a) * (HR - HT * 0.2), Math.sin(a) * (HR - HT * 0.2), 0);
    add(hoopG, tube([p0, p1], 0.0095, 0.0095, { radial: 6, n: 4, side: Z, paint: silkPaint }), M.silk).userData.inkGroup = WEB;
  }
  // Spiral threads: three turns, going outward from the center of the web; the stretch between every two radial threads sags toward the center, which is the fan shape of a web
  const beadAt: V[] = [];
  {
    const K = 24;
    const r0 = 0.062;
    const r1 = 0.186;
    const pts: V[] = [];
    for (let k = 0; k <= K; k++) {
      const a = spokeA[0] + (k / 8) * PI * 2;
      const r = lerp(r0, r1, k / K);
      pts.push(v3(Math.cos(a) * r, Math.sin(a) * r, 0));
      if (k < K) {
        const am = a + PI / 8;
        const rm = lerp(r0, r1, (k + 0.5) / K) * 0.9;
        const pm = v3(Math.cos(am) * rm, Math.sin(am) * rm, 0);
        pts.push(pm);
        if ([4, 9, 13, 17, 21].includes(k)) beadAt.push(pm.clone());
      }
    }
    const L = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getLength();
    const ts = capTs(L, 0.008, 0.008, 150);
    add(hoopG, sweep(pts, (t) => {
      const r = 0.0085 * capK(t * L, L, 0.008, 0.008);
      return [r, r];
    }, { ts, radial: 6, side: Z, paint: silkPaint }), M.silk).userData.inkGroup = WEB;
  }
  // The moonstone at the center of the web and five dream beads (each one a dream, all in different colors)
  add(hoopG, paint(new THREE.SphereGeometry(0.038, 16, 10), () => col(0xf3efff)), M.bead, [0, 0, 0.004], [0, 0, 0], [1, 1, 0.72]);
  const dreamCols = [0xffd88a, 0xffb3c8, 0xa9d6ff, 0xc6ecac, 0xd8c2ff];
  beadAt.forEach((p, k) => {
    const r = [0.021, 0.019, 0.023, 0.02, 0.022][k];
    add(hoopG, paint(new THREE.SphereGeometry(r, 12, 8), () => col(dreamCols[k])), M.bead, [p.x, p.y, 0.006]);
  });
  // Hanging thread: from the top of the hoop up to the toe tip
  add(hoopG, tube([v3(0, HR, 0), v3(0.003, HR + HANG * 0.5, 0), v3(0, HR + HANG + 0.012, 0)], 0.0095, 0.0095, { radial: 6, n: 6, paint: silkPaint }), M.silk).userData.inkGroup = WEB;
  // Young leaves on the hoop: two at the upper left and one at the lower right, the leaf faces forward
  for (const [ph, len, tilt] of [[0.8, 0.1, 0.5], [0.93, 0.075, -0.2], [-0.16, 0.085, 0.35]] as [number, number, number][]) {
    const a = ph * PI;
    const g = group(hoopG, [Math.cos(a) * (HR + HT * 0.3), Math.sin(a) * (HR + HT * 0.3), HT * 0.3]);
    const out = v3(Math.cos(a), Math.sin(a), 0);
    const tan = v3(-Math.sin(a), Math.cos(a), 0);
    orient(g, out.clone().addScaledVector(tan, tilt).add(v3(0, 0, 0.35)), Z);
    add(g, leafGeo(len, len * 0.52, 0.012, C.leaf, C.leafBack, C.leafVein), M.wood);
  }
  // Silk tassels: two threads hanging from the bottom of the hoop, one ending in a small leaf and one in a dream bead
  for (const [ph, len, end] of [[-0.6, 0.15, 'leaf'], [-0.4, 0.11, 'bead']] as [number, number, string][]) {
    const a = ph * PI;
    const top = v3(Math.cos(a) * HR, Math.sin(a) * HR, 0);
    const bot = top.clone().add(v3(0.004, -len, 0.006));
    add(hoopG, tube([top, top.clone().lerp(bot, 0.5).add(v3(0.006, 0, 0)), bot], 0.0085, 0.0075, { radial: 6, n: 6, paint: silkPaint }), M.silk).userData.inkGroup = WEB;
    if (end === 'bead') add(hoopG, paint(new THREE.SphereGeometry(0.022, 12, 8), () => col(0xffc2a8)), M.bead, [bot.x, bot.y - 0.014, bot.z]);
    else {
      const g = group(hoopG, [bot.x, bot.y + 0.004, bot.z]);
      orient(g, v3(0.1, -1, 0.15), Z);
      add(g, leafGeo(0.07, 0.04, 0.01, C.leaf, C.leafBack, C.leafVein), M.wood);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle ──
  const act = { glow: 0, raise: 0 };
  let lastGlow = Number.NaN;
  const tapQ = new THREE.Quaternion();
  /** t is the model time, and since is how many seconds have passed since the first update */
  const pose = (t: number, since: number) => {
    const br = Math.sin(t * 1.9);
    abd.scale.set(1 + br * 0.012, 1 + br * 0.016, 1 + br * 0.008);
    abd.rotation.set(ABD_RX + Math.sin(t * 0.9) * 0.015, Math.sin(t * 0.45) * 0.02, 0);
    const look = Math.sin(t * 0.37);
    pro.position.set(PRO_P.x, PRO_P.y + br * 0.003, PRO_P.z);
    // A spider has no eyelids and its eyeballs do not turn: when looking around the whole cephalothorax turns together, now and then snapping into alignment in jerks (the way a jumping spider stares at something)
    const snap = look + Math.sin(t * 2.6) * 0.12 * sstep(Math.abs(look), 0.6, 0.9);
    pro.rotation.set(PRO_RX + Math.sin(t * 0.7) * 0.01, snap * 0.06, PRO_RZ + Math.sin(t * 0.37 + 1) * 0.012);
    // Pedipalps: the fingertips parting and then touching lightly
    const pc = (t % 2.4) / 2.4;
    const tapP = Math.sin(Math.min(1, pc / 0.35) * PI) * (pc < 0.35 ? 1 : 0);
    for (const p of palps) p.g.rotation.set(-tapP * 0.08, p.sx * tapP * 0.14, 0);
    // The left foreleg taps the ground: twice every 5 seconds
    const lc = t % 5;
    const tp = (x: number) => (x > 0 && x < 0.3 ? Math.sin((x / 0.3) * PI) : 0);
    const lift = Math.max(tp(lc - 3.6), tp(lc - 4.0));
    if (tapG) tapG.quaternion.copy(tapQ.setFromAxisAngle(tapAxis, lift * 0.22));
    // The foot holding the hoop, and the dreamcatcher
    const ra = act.raise;
    if (legR1) legR1.rotation.set(Math.sin(t * 1.05 - 0.6) * 0.012 - ra * 0.1, 0, -ra * 0.32);
    if (hoopPivot) hoopPivot.rotation.set(Math.sin(t * 0.8) * 0.035, 0, Math.sin(t * 1.05) * 0.07 + ra * 0.32);
    hoopG.rotation.y = hoopTwist(since);
    // The emissive is written only when the glow weight changes: if it were written every frame, another spirit's ultimate changing this one's uEmissiveAmt would be overwritten
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.bead.emissiveIntensity = 0.28 + gl * 0.45;
      M.silk.emissiveIntensity = gl * 0.4;
    }
  };
  let t0 = Number.NaN;
  const update = (t: number) => {
    if (Number.isNaN(t0)) t0 = t;
    pose(t, t - t0);
  };
  pose(0, 0);

  // Anchors
  const faceC = faceAt(0, EYE_Y);
  const head = group(pro, [faceC.p.x, faceC.p.y, faceC.p.z]);
  const mc = faceAt(0, MOUTH_Y);
  const mouth = group(pro, [mc.p.x, mc.p.y, mc.p.z]);
  const palpsA = group(pro, [0, -0.205, 0.43]);
  const web = group(hoopG, [0, 0, 0.03]);
  const hoopA = group(hoopPivot!, [0, 0, 0]);
  const sp = starAt(abdRho, v3(0, -0.25, -1));
  const spinner = group(abd, [sp.p.x + sp.n.x * 0.05, sp.p.y + sp.n.y * 0.05, sp.p.z + sp.n.z * 0.05]);
  const de = onAbd(0, lidW(0) - 0.03, 0.01);
  const dreamEye = group(abd, [de.x, de.y, de.z]);
  const rig = {
    head,
    eyes: eyeAnchors,
    anchors: { mouth, web, hoop: hoopA, palps: palpsA, spinner, dreamEye, ...(footA ? { foot: footA } : {}) },
  };
  // Static parts merged (mesh budget SR 60): groups that move when idle act as owners, and the eye highlights (not outlined) are not merged
  mergeStatic(root, {
    owners: [pro, abd, ...palps.map((p) => p.g), ...(legR1 ? [legR1] : []), ...(hoopPivot ? [hoopPivot] : []), hoopG, ...(tapG ? [tapG] : [])],
    keep: [...glints],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.5, 0), radius: 1.1 };
}
