// Galeweasel (model lab version): weasels that act in a group of three, one tripping, one slashing, one applying salve. When they give everything, the three become one and turn into an invisible whirlwind.
// Wind element, assault and laceration; the moves come in three forms [Trip] [Slash] [Salve], and when all three are chained it becomes "Three Sickles as One".
// Only one form (decided by the user, 2026-09-28): the builder takes no breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on, with reasons (from the name, the wind element, the three-form chain and the lore):
//   1. A group of three: the eldest (Slash) half upright in the middle, the second (Trip) crouched low to the ground in front, and the youngest (Salve) sitting inside the curl of the eldest's tail.
//      The silhouette at a glance is a triangle formation of "one big and two small", which sets it apart from any single four-legged beast.
//   2. The crescent sickles on the eldest's two wrists: pale cyan-jade blades growing from the outer side of the wrist and curving up and back past the elbow, the back of each blade carrying a ridge of deep jade;
//      from the front they look like a pair of brackets framing the chest, and from behind the blade tips show at the two sides of the shoulders. The "slash" in Galeweasel is this pair.
//   3. A weasel with a chestnut back and a cream belly: the boundary between back and belly is a clean line, and the face is a chestnut cap with a cream muzzle and chin,
//      the tail tip deep cocoa (the stoat's black tail tip). A different color scheme and build entirely from Noxfang (dark purple, long-legged, long-muzzled, maned).
//   4. Jade is given only to the things of wind: the blades, blade ridges, salve, scarves and the medicine pouch; everywhere else on the bodies is the weasel's fur color.
//   5. The three sickles: the second's tail tip is a small hook sickle (for tripping), and the youngest holds an open clamshell in both hands, with jade-green salve inside, and carries a knotted medicine pouch on its back.
// Body shape follows the lore: a weasel's long tubular body, long neck, short legs and long tail. The eldest sits on its hind legs with the upper body straight, after the weasel's habit of "standing up to look around", the forelegs tucked at the chest,
// not a humanoid stance (the whole hind foot lying flat on the ground, the tail braced on the ground); the second is the crouch a weasel takes before pouncing; the youngest sits upright holding something as a small animal does.
//
// Personality: three siblings whose hands and feet are quicker than their mouths. Personality comes entirely from build, posture and action, not from facial features: the eldest sits with the upper body straight and both sickles already shown at the chest,
// the head turning in jerks to look around quickly (a weasel's habit), impatient; the second keeps its body low with its head against the ground, watching only the opponent's feet, the tail hook sweeping back and forth on the ground;
// the youngest sits in the curl of the big brother's tail with the medicine pouch on its back, holding the open clamshell, waiting to clean up afterwards.
// The faces are made after weasels: dark, glossy round eyes, the iris filling the eye with no sclera showing, the two eye-lights both on the key-light side; the mouth closed,
// the muzzle just a cream upper lip and chin plus a dark nose, with no brows, no mouth line and no teeth. All three look straight ahead, the gaze of the two eyes matching.
// Gaze order: the eldest's face (cream muzzle, dark bright eyes, chestnut cap) first, the crescent sickles on the two wrists second, and the two small ones and the tail as support.
// The back tells "acting together": the eldest's long tail circles a big loop out behind the rump, enclosing the seated youngest inside, with the tail tip curling up in front of the youngest;
// the youngest carries a knotted jade medicine pouch on its back; behind the eldest's neck are the scarf knot and the two scarf tails blown to the back right, and the sickle tips show at the two sides of the shoulders.
// Restrained light effects: no emissive, no reliance on bloom, and no translucent wind; only the small white points of the eye highlights.
//
// <Action table> (act weights, 0-1; all 0 is idle)
//   Idle: the eldest sits breathing, the head turning in jerks to look around quickly like a weasel, now and then blinking and twitching an ear, the tail swaying lightly; the sickles rise and fall slightly with the breathing.
//         The second lies low, the head also looking around, the hook sickle on the tail tip slowly sweeping left and right on the ground; the youngest looks left and right, holding the clamshell.
//   Move: the three dart out together low to the ground, the eldest on all fours (crouch), the tail stretched straight.
//   Charge-up: the eldest's upper body lowered and both sickles drawn back (crouch), the second's body against the ground (the first half of trip).
//   Strike: [Trip] the second pounces forward and the tail hook sweeps across (trip); [Slash] the eldest cleaves both sickles forward and outward (slash); [Salve] the youngest lifts the clamshell forward (salve).
//   Hit: the eldest does not retreat, both sickles crossed to guard the chest (the reverse of slash, carried by crouch), and the two small ones shrink a little.
//   Victory: the eldest straightens up and both sickles are flicked to the sides and back in, the youngest raises the clamshell, the second lifts its head, no cheering.
//   focus: stop looking around, all three look straight ahead. crouch: the eldest's upper body leans forward and lowers, the sickles drawn back. slash: both forelegs swing forward and outward, the blades standing up.
//   trip: the second pounces forward, the tail hook sweeping forward. salve: the youngest lifts the clamshell forward and up.
// Anchors: head (center of the eldest's face), eyes (the surfaces of the eldest's two eyes), mouth (front end of the eldest's muzzle), chest (the eldest's chest), bladeL / bladeR (the sickle tips, L being its own left, +x),
//       tail (the eldest's tail tip), tripper (the second's face), hook (the hook sickle at the second's tail tip), healer (the youngest's face), salve (the salve in the clamshell), pack (the medicine pouch on the youngest's back).
// Face count: the SR budget is 45,000 faces and 60 meshes. The fur collars and eyelids use low-segment versions; the static parts are merged at the end with mergeStatic.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, smooth, taper, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type V3 = [number, number, number];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const C = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Geometry helpers ─────────────────────────

/** Apply vertex colors by vertex position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i), n.fromBufferAttribute(na, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** One color for the whole piece (for parts that share the vertex-color material) */
const solid = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const k = C(c);
  return paint(g, () => k);
};

interface CoatOpts {
  segs: number;
  /** Number of columns in one ring */
  radial: number;
  /** The wide direction (default -x: for a body growing forward the tall direction faces up; for a body growing upward the tall direction faces back = the back) */
  side?: THREE.Vector3;
  /** Half angle of the pale belly region (the arc measured from the belly midline); if not given the whole ring is one color */
  split?: (t: number) => number;
  /** The proportion of columns the belly takes */
  ventral?: number;
  back: (t: number) => THREE.Color;
  belly?: (t: number) => THREE.Color;
  /** Where the color switches hard along the curve: one more row before and after, the boundary a clean line around the ring */
  cuts?: number[];
  /** Extra rows added (densified where the ends close) */
  rows?: number[];
}

interface Coat {
  geo: THREE.BufferGeometry;
  /** A point on the surface: t along the curve, phi measured from the belly midline (positive toward the wide direction), lift floating outward */
  at: (t: number, phi: number, lift?: number) => THREE.Vector3;
  /** The outward normal of the cross-section ellipse at that point */
  normal: (t: number, phi: number) => THREE.Vector3;
  path: THREE.CatmullRomCurve3;
}

/**
 * Fur lofted along a curve (torso, head, tail): the same cross-section as loft in shapes.ts, with the two-color boundary between back and belly made of two columns of nearly coincident vertices,
 * the boundary following split(t) with a clean edge, and not running in a sawtooth along the triangles the way interpolated vertex colors would (pitfall 32); the row at either end with radius 0 gets only one vertex,
 * so the closure is round with no zero-area triangles (pitfall 85). The number of columns per ring is fixed, and the columns on each side of the boundary are divided evenly.
 */
function coatLoft(pts: THREE.Vector3[], prof: (t: number) => number[], o: CoatOpts): Coat {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const side = o.side ?? v(-1, 0, 0);
  const frame = (t: number) => {
    const P = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const W = side.clone().addScaledVector(T, -T.dot(side));
    if (W.lengthSq() < 1e-8) W.set(1, 0, 0);
    W.normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    return { P, T, W, H };
  };
  const J = o.radial;
  const nV = o.split ? Math.max(3, Math.round(J * (o.ventral ?? 0.4))) : 0;
  const nD = J - nV;
  const EA = 0.005;
  const angles = (t: number): number[] => {
    if (!o.split) return Array.from({ length: J }, (_, j) => (j / J) * PI * 2);
    const f = clamp(o.split(t), 0.2, PI - 0.2);
    const out: number[] = [];
    for (let k = 0; k < nV; k++) out.push(-f + EA + ((2 * f - 2 * EA) * k) / (nV - 1));
    for (let k = 0; k < nD; k++) out.push(f + EA + ((2 * PI - 2 * f - 2 * EA) * k) / (nD - 1));
    return out;
  };
  const tset = new Set<number>();
  for (let i = 0; i <= o.segs; i++) tset.add(i / o.segs);
  for (const r of o.rows ?? []) tset.add(r);
  for (const c of o.cuts ?? []) {
    tset.add(c - 0.002);
    tset.add(c + 0.002);
  }
  const ts = [...tset].filter((t) => t >= 0 && t <= 1).sort((a, b) => a - b);
  const back = o.back;
  const belly = o.belly ?? o.back;
  const pos: number[] = [];
  const col: number[] = [];
  const start: number[] = [];
  const pole: boolean[] = [];
  for (const t of ts) {
    const { P, W, H } = frame(t);
    const [a, b, dy = 0] = prof(t);
    start.push(pos.length / 3);
    if (a < 1e-5 && b < 1e-5) {
      pole.push(true);
      const q = P.clone().addScaledVector(H, dy);
      pos.push(q.x, q.y, q.z);
      const c = back(t);
      col.push(c.r, c.g, c.b);
      continue;
    }
    pole.push(false);
    const ang = angles(t);
    for (let j = 0; j < J; j++) {
      const f = ang[j];
      const x = Math.sin(f) * a;
      const y = dy - Math.cos(f) * b;
      pos.push(P.x + W.x * x + H.x * y, P.y + W.y * x + H.y * y, P.z + W.z * x + H.z * y);
      const c = (j < nV ? belly : back)(t);
      col.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  const id = (r: number, j: number) => (pole[r] ? start[r] : start[r] + (j % J));
  for (let r = 0; r < ts.length - 1; r++) {
    if (pole[r] && pole[r + 1]) continue;
    for (let j = 0; j < J; j++) {
      const A = id(r, j);
      const B = id(r + 1, j);
      const A2 = id(r, j + 1);
      const B2 = id(r + 1, j + 1);
      if (A !== B && A !== A2 && B !== A2) idx.push(A, B, A2);
      if (B !== B2 && B !== A2 && B2 !== A2) idx.push(B, B2, A2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check: the normal of the first vertex of the middle ring must face outward
  const mr = Math.floor(ts.length / 2);
  if (!pole[mr]) {
    const k = start[mr] + Math.floor(J / 3);
    const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, k);
    const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, k);
    if (n.dot(p.sub(path.getPointAt(ts[mr]))) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
  }
  const at = (t: number, phi: number, lift = 0) => {
    const { P, W, H } = frame(t);
    const [a, b, dy = 0] = prof(t);
    const x = Math.sin(phi) * (a + lift);
    const y = dy - Math.cos(phi) * (b + lift);
    return P.addScaledVector(W, x).addScaledVector(H, y);
  };
  const normal = (t: number, phi: number) => {
    const { W, H } = frame(t);
    const [a, b] = prof(t);
    return W.multiplyScalar(Math.sin(phi) / Math.max(a, 1e-4)).addScaledVector(H, -Math.cos(phi) / Math.max(b, 1e-4)).normalize();
  };
  return { geo: g, at, normal, path };
}

/**
 * A low-segment fur collar (furCollar in shapes.ts, with the columns per tuft and the segments along the fur flow turned into parameters): a whole ring of fur joined together,
 * the trailing edge cut into clumps of pointed tips with grooves pressed in between clumps. For a partial arc the thickness at both ends goes to 0, closing naturally. The color is applied separately with paint.
 */
function lowCollar(o: FurCollarOpts, segS = 6, per = 5): THREE.BufferGeometry {
  const a0 = o.a0 ?? -PI;
  const a1 = o.a1 ?? PI;
  const span = a1 - a0;
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * per));
  const rand = rng(o.seed ?? 11);
  const var_ = Array.from({ length: Math.ceil(o.tufts) + 2 }, () => 1 + (rand() - 0.5) * 2 * (o.jitter ?? 0.12));
  const notch = o.notch ?? 0.45;
  const curl = o.curl ?? 0.5;
  const groove = o.groove ?? 0.35;
  const phase = o.phase ?? 0;
  const cols = full ? nT : nT + 1;
  const J = segS * 2 + 1;
  const pos: number[] = [];
  for (let i = 0; i < cols; i++) {
    const th = a0 + (span * i) / nT;
    const u = (i / nT) * o.tufts + phase;
    const w = u - Math.floor(u);
    const c = 1 - Math.abs(2 * w - 1);
    const vi = Math.floor(u) % var_.length;
    const e = full ? 1 : Math.min(1, (i / nT) * o.tufts * 2, ((nT - i) / nT) * o.tufts * 2);
    const L = o.len * var_[vi] * (1 - notch + notch * Math.pow(c, 0.75)) * (0.55 + 0.45 * e) * (1 + (o.bias ?? 0) * Math.cos(th));
    const cr: number[] = [];
    const ca: number[] = [];
    const nr: number[] = [];
    const na: number[] = [];
    let r = o.r0;
    let a = 0;
    for (let k = 0; k <= segS; k++) {
      const sK = k / segS;
      const ph = o.flare - curl * sK * sK;
      cr.push(r);
      ca.push(a);
      nr.push(Math.cos(ph));
      na.push(Math.sin(ph));
      const ph2 = o.flare - curl * ((k + 0.5) / segS) ** 2;
      r += Math.sin(ph2) * (L / segS);
      a -= Math.cos(ph2) * (L / segS);
    }
    const push = (k: number, off: number) => {
      const rr = cr[k] + nr[k] * off;
      pos.push(Math.sin(th) * rr, ca[k] + na[k] * off, Math.cos(th) * rr);
    };
    const hh = (k: number) => {
      const sK = k / segS;
      return o.thick * e * Math.pow(1 - sK, 0.7) * (0.6 + 0.4 * Math.min(1, sK * 4));
    };
    for (let k = 0; k <= segS; k++) push(k, hh(k) * 0.62 * (0.8 + 0.2 * c) * (1 - groove * (k / segS) * (1 - c)));
    for (let k = segS - 1; k >= 0; k--) push(k, -hh(k) * 0.38);
  }
  const idx: number[] = [];
  for (let i = 0; i < nT; i++) {
    const i2 = full ? (i + 1) % nT : i + 1;
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      idx.push(i * J + j, i2 * J + j, i * J + j2, i2 * J + j, i2 * J + j2, i * J + j2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mi = Math.floor(cols / 2) * J + Math.floor(segS / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, mi);
  const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, mi);
  if (nrm.dot(new THREE.Vector3(p.x, 0, p.z)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Low-segment eyelid shell (lidGeometry in shapes.ts): with +y as the top, covering from the top to a lip angle, the edge a rounded lip */
function lidLow(ri: number, ro: number, lip: number, seg = 18, n = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), ri * Math.cos(a)));
  }
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 4; i++) {
    const b = (i / 4) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = n; i >= 0; i--) {
    const a = (i / n) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  return smooth(new THREE.LatheGeometry(prof, seg));
}

/**
 * Eyeball: a sphere with +z as straight ahead, the rings of color (pupil, iris, dark outer ring) being rings of the lathe directly,
 * with two points at the same angle forming a hard boundary (pitfall 32). The normals are the sphere's normals.
 */
function eyeGeo(r: number, bands0: [number, THREE.ColorRepresentation][], seg = 22): THREE.BufferGeometry {
  const bands = [...bands0].reverse();
  const pts = bands.map(([a]) => new THREE.Vector2(Math.max(1e-4, r * Math.sin(a)), r * Math.cos(a)));
  const g = new THREE.LatheGeometry(pts, seg);
  const n = pts.length;
  const col = new Float32Array(g.attributes.position.count * 3);
  const tc = new THREE.Color();
  for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) tc.set(bands[j][1]).toArray(col, (i * n + j) * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.rotateX(PI / 2);
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const q = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    q.fromBufferAttribute(pa, i).normalize();
    na.setXYZ(i, q.x, q.y, q.z);
  }
  return g;
}

/**
 * A small bowl with thickness (ear, clamshell): the lathe outline goes from the outer bottom up over the round lip and back down the inner wall to the inner bottom, the outside facing out and the inside of the bowl facing up;
 * the outer shell and the inner surface are two colors, with the boundary on the lip (two nearly coincident points). The opening faces +y.
 */
function cupGeo(r: number, depth: number, th: number, outer: THREE.ColorRepresentation, inner: THREE.ColorRepresentation, seg = 14): THREE.BufferGeometry {
  const prof: [number, number][] = [
    [0.001, -depth],
    [r * 0.55, -depth * 0.9],
    [r * 0.88, -depth * 0.55],
    [r, 0],
    [r - th * 0.3, th * 0.45],
    [r - th * 0.32, th * 0.44],
    [r - th, 0],
    [(r - th) * 0.84, -(depth - th) * 0.5],
    [(r - th) * 0.45, -(depth - th) * 0.88],
    [0.001, -(depth - th)],
  ];
  const g = lathe(prof, seg);
  const n = prof.length;
  const co = C(outer);
  const ci = C(inner);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) (j <= 4 ? co : ci).toArray(col, (i * n + j) * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

/**
 * Normal transfer at a seam (Luminael's blendNormalsInto): at the ring where a part is inserted into the torso, the vertex normals lean toward the torso surface's normals,
 * so the shading is continuous with no collar line (pitfall 38). offset is the part's position in the torso's coordinates.
 */
function blendNormalsInto(g: THREE.BufferGeometry, surf: THREE.BufferGeometry, d1: number, offset = new THREE.Vector3()) {
  const sp = surf.attributes.position as THREE.BufferAttribute;
  const sn = surf.attributes.normal as THREE.BufferAttribute;
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const nq = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    p.fromBufferAttribute(pa, i).add(offset);
    let best = Infinity;
    let k = 0;
    for (let j = 0; j < sp.count; j++) {
      const dx = sp.getX(j) - p.x;
      const dy = sp.getY(j) - p.y;
      const dz = sp.getZ(j) - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) [best, k] = [d, j];
    }
    q.fromBufferAttribute(sp, k);
    nq.fromBufferAttribute(sn, k);
    const h = p.clone().sub(q).dot(nq);
    const w = 1 - ss(h, 0, d1);
    if (w <= 0) continue;
    n.fromBufferAttribute(na, i).lerp(nq, w).normalize();
    na.setXYZ(i, n.x, n.y, n.z);
  }
  na.needsUpdate = true;
}

/** A point on a quadratic Bézier curve */
const quad = (a: [number, number], c: [number, number], b: [number, number], s: number): [number, number] => {
  const u = 1 - s;
  return [u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], u * u * a[1] + 2 * u * s * c[1] + s * s * b[1]];
};

/**
 * Crescent sickle: from the blade root (x = 0, width width) to the blade tip (x = len), the outer edge the cutting edge, bulging toward +y; the inner edge bulges less, so the blade is thick at the root and pointed at the tip.
 * It returns two outline pieces, the blade and the ridge on the back of the blade (the ridge runs along the inner edge and is extruded a little thicker than the blade, so it projects a ridge on each side).
 */
function sickleShapes(len: number, width: number, bulge: number): { blade: THREE.Shape; spine: THREE.Shape } {
  const N = 16;
  const tip: [number, number] = [len, bulge * 0.35];
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    outer.push(quad([0, width / 2], [len * 0.48, bulge + width * 0.6], tip, s));
    inner.push(quad([0, -width / 2], [len * 0.56, bulge * 0.62 - width * 0.3], tip, s));
  }
  const blade = outline([...outer, ...inner.slice(0, N).reverse()]);
  const M = 13;
  const mid: [number, number][] = [];
  for (let i = 0; i <= M; i++) {
    const k = 0.34 * (1 - (i / M) ** 2);
    mid.push([lerp(inner[i][0], outer[i][0], k), lerp(inner[i][1], outer[i][1], k)]);
  }
  const spine = outline([...inner.slice(0, M + 1), ...mid.reverse()]);
  return { blade, spine };
}

// ───────────────────────── Shape ─────────────────────────

export function buildGaleWeaselLab(): LabModel {
  const RIMC = 0xd6fff0;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  // Palette: a chestnut back, a cream belly and muzzle, a deep cocoa tail tip; the second a darker ochre-chestnut and the youngest a lighter honey yellow-brown;
  // the sickle blades pale cyan-jade, and the blade ridges and salve are jade (wind); the clamshell a milk-powder color; the medicine pouch deep jade cloth
  const COAT = 0xb8622e;
  const COAT2 = 0x8f4b26;
  const COAT3 = 0xcf9658;
  const CREAM = 0xf8ecd4;
  const TIP = 0x3a2520;
  const EAR_IN = 0xefbfa4;
  const BLADE = 0xc2ecdb;
  const JADE = 0x35a282;
  const SALVE = 0x5cc795;
  const SHELL = 0xf0d6c0;
  const SHELL_IN = 0xfff4ec;
  const CLOTH = 0x2f7f67;
  const CLAW = 0x3a2a26;
  const M = {
    coat: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    blade: vc(labToon(0xffffff, { ramp: 'metal', spec: 1.3, specTh: 0.93, rim: 0.6, rimColor: RIMC })),
    eye: vc(labToon(0xffffff, { ramp: 'gem', spec: 0.7, specTh: 0.985, rim: 0 })),
    nose: labToon(0x3a2320, { spec: 0.8, specTh: 0.992, rim: 0.4, rimColor: RIMC }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'gale_weasel-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const S_BODY = 9801;
  const S_ARM_L = 9802;
  const S_ARM_R = 9803;
  const S_TAIL = 9804;
  const T_BODY = 9811;
  const T_TAIL = 9812;
  const H_BODY = 9821;
  const H_TAIL = 9822;

  /** Place a ring of fur: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal */
  const collar = (parent: THREE.Object3D, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup: number | undefined, color: THREE.ColorRepresentation | ((p: THREE.Vector3) => THREE.Color), segS = 6, per = 5) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const f = typeof color === 'function' ? color : () => C(color);
    const m = add(parent, paint(lowCollar(o, segS, per), (p) => f(p)), M.coat);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };

  /** Find the mesh surface outward from from along dir (the mesh is not hung in the scene, and its matrix is the identity) */
  const tmpMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const hit = (geo: THREE.BufferGeometry, from: THREE.Vector3, dir: THREE.Vector3) => {
    const mesh = new THREE.Mesh(geo, tmpMat);
    const d = dir.clone().normalize();
    const rc = new THREE.Raycaster(from.clone().addScaledVector(d, 2), d.clone().negate(), 0, 4);
    const h = rc.intersectObject(mesh, false)[0];
    return h ? h.point.clone() : from.clone();
  };

  // ── The shared head: a chestnut cap, cream muzzle and chin, a short muzzle, a flat wide head, round ears ──
  // The head's coordinates: +z forward, +y up, the origin at the center of the skull; the three use the same head, each scaled separately
  const HEAD_PTS = [v(0, 0.012, -0.15), v(0, 0.016, -0.06), v(0, 0.006, 0.035), v(0, -0.01, 0.11), v(0, -0.02, 0.172)];
  const HEAD_PROF = curveTable([
    [0, 0, 0, 0],
    [0.025, 0.066, 0.058, 0],
    [0.1, 0.106, 0.088, 0],
    [0.28, 0.13, 0.1, 0],
    [0.45, 0.122, 0.093, -0.004],
    [0.6, 0.098, 0.074, -0.01],
    [0.74, 0.074, 0.056, -0.012],
    [0.86, 0.054, 0.042, -0.01],
    [0.95, 0.036, 0.03, -0.006],
    [0.985, 0.021, 0.018, -0.004],
    [1, 0, 0, 0],
  ]);
  // The range of cream: none on the back of the head, the cheeks rising to the lower edge of the eye, and on the muzzle only a chestnut stripe along the bridge of the nose is left
  const HEAD_SPLIT = curveTable([[0, 0.2], [0.14, 0.3], [0.3, 1.05], [0.46, 1.5], [0.64, 1.86], [0.84, 2.1], [1, 2.2]]);

  interface HeadOpts {
    coat: THREE.ColorRepresentation;
    scale: number;
    /** With eyelids (the eldest); without them, the eyeball is squashed to blink */
    lids: boolean;
    /** Eye radius (in the head's coordinates) */
    er: number;
    ink: number;
    segs: number;
    radial: number;
  }
  interface Head {
    g: THREE.Group;
    eyes: THREE.Group[];
    gazes: THREE.Group[];
    lids: { up: THREE.Group; lo: THREE.Group }[];
    his: THREE.Mesh[];
    ears: { g: THREE.Group; sx: number }[];
    mouth: THREE.Group;
    center: THREE.Group;
  }
  const UP_OPEN = 0.95;
  const LO_OPEN = 0.86;
  const buildHead = (parent: THREE.Object3D, pos: THREE.Vector3, rot: V3, o: HeadOpts): Head => {
    const g = group(parent, pos.toArray() as V3, rot);
    g.scale.setScalar(o.scale);
    const coat = coatLoft(HEAD_PTS, HEAD_PROF, {
      segs: o.segs,
      radial: o.radial,
      split: (t) => HEAD_SPLIT(t)[0],
      ventral: 0.55,
      back: () => C(o.coat),
      // The belly side of the back of the head is chestnut too, and the cream only begins in front of the base of the neck (from behind no pointed corner of cream shows)
      belly: (t) => C(t < 0.22 ? o.coat : CREAM),
      rows: [0.008, 0.016, 0.992, 0.996],
      cuts: [0.22],
    });
    add(g, coat.geo, M.coat).userData.inkGroup = o.ink;

    // Nose: a rounded triangle wide at the top and narrow at the bottom, deep cocoa, with a point of hard highlight
    add(g, taper(rbox(0.056, 0.033, 0.04, 0.015, 2), [1, 1], [0.55, 0.78]), M.nose, [0, -0.01, 0.169], [0.3, 0, 0]);

    // Eyes: a weasel's eyes are dark, glossy round eyes, the iris filling the eye, with almost no sclera visible; a ring of deep brown in the iris shows through only up close.
    // The two eye-lights both face the key-light side (the two eyes matching). The eye socket turns outward (visible from the side), and the eyeball is turned a little further forward (pitfalls 23, 43)
    const ER = o.er;
    const eyes: THREE.Group[] = [];
    const gazes: THREE.Group[] = [];
    const lids: { up: THREE.Group; lo: THREE.Group }[] = [];
    const his: THREE.Mesh[] = [];
    const bands: [number, THREE.ColorRepresentation][] = [[0, 0x0b0807], [0.5, 0x0b0807], [0.51, 0x2f1d15], [0.98, 0x3a2419], [0.99, 0x0e0a08], [1.9, 0x0e0a08]];
    const eyeBall = eyeGeo(ER, bands, o.lids ? 22 : 16);
    // Eye-lights: one large and one small squashed little ball laid on the eyeball surface, merged into one mesh (hidden together when the eye is closed)
    const hiGeo = mergeGeometries(([[0.3, 0.38, 0.26], [-0.34, -0.28, 0.12]] as [number, number, number][]).map(([x, y, r]) => {
      const hd = v(x, y, 1).normalize();
      const g1 = new THREE.SphereGeometry(r * ER, 8, 5).scale(1, 1, 0.25);
      g1.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(FWD, hd));
      return g1.translate(hd.x * ER, hd.y * ER, hd.z * ER);
    }))!;
    const lidUp = o.lids ? solid(lidLow(ER + 0.003, ER + 0.009, PI / 2), o.coat) : null;
    const lidLo = o.lids ? solid(lidLow(ER + 0.001, ER + 0.0045, PI / 2), o.coat) : null;
    for (const sx of [-1, 1]) {
      // Eye socket: near the rough position, find the scalp vertex whose normal most faces aim, bury the eyeball along the normal there,
      // so the part exposed outside the head faces aim; the iris only needs turning a little further straight ahead, so it is not cut in half by the scalp (pitfalls 23, 43)
      const d = v(sx * 0.74, 0.44, 0.5).normalize();
      const S0 = hit(coat.geo, v(0, 0.0, -0.01), d);
      const aim = v(sx * 0.6, 0.3, 0.74).normalize();
      const PA = coat.geo.attributes.position as THREE.BufferAttribute;
      const NA = coat.geo.attributes.normal as THREE.BufferAttribute;
      const q = new THREE.Vector3();
      const qn = new THREE.Vector3();
      let best = -Infinity;
      const S = S0.clone();
      const n = d.clone();
      for (let i = 0; i < PA.count; i++) {
        q.fromBufferAttribute(PA, i);
        if (q.distanceTo(S0) > 0.06) continue;
        qn.fromBufferAttribute(NA, i);
        const sc = qn.dot(aim) - q.distanceTo(S0) * 2.5;
        if (sc > best) {
          best = sc;
          S.copy(q);
          n.copy(qn);
        }
      }
      const c = S.addScaledVector(n, -(o.lids ? 0.46 : 0.42) * ER);
      const eg = group(g, c.toArray() as V3);
      eg.quaternion.setFromUnitVectors(FWD, n.clone().lerp(aim, 0.3).normalize());
      const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.1]);
      const want = v(0, -0.02, 1).normalize().applyQuaternion(eg.quaternion.clone().multiply(roll.quaternion).invert());
      const gq = new THREE.Quaternion().setFromUnitVectors(FWD, want);
      const ang = 2 * Math.acos(clamp(gq.w, -1, 1));
      const gaze = group(roll);
      gaze.quaternion.copy(new THREE.Quaternion().slerp(gq, Math.min(1, 0.75 / Math.max(ang, 1e-4))));
      add(gaze, eyeBall, M.eye).userData.inkGroup = o.ink + 40;
      const hl = add(gaze, hiGeo, M.hi);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      his.push(hl);
      eyes.push(group(gaze, [0, 0, ER]));
      gazes.push(gaze);
      if (lidUp && lidLo) {
        const lidG = group(roll);
        lidG.quaternion.copy(new THREE.Quaternion().slerp(gaze.quaternion, 0.75));
        const up = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
        add(up, lidUp, M.coat).userData.inkGroup = o.ink;
        const lo = group(lidG, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
        add(lo, lidLo, M.coat).userData.inkGroup = o.ink;
        lids.push({ up, lo });
      }
    }

    // Ears: low, wide round ears on the two sides of the top of the head, the outer shell chestnut and the inside of the ear pale pink, the opening facing forward and outward
    const ears: { g: THREE.Group; sx: number }[] = [];
    const earGeo = cupGeo(0.042, 0.026, 0.012, o.coat, EAR_IN, 14);
    for (const sx of [-1, 1]) {
      const d = v(sx * 0.56, 0.8, -0.2).normalize();
      const E = hit(coat.geo, v(0, 0, -0.05), d).addScaledVector(d, 0.002);
      const eg = group(g, E.toArray() as V3);
      eg.quaternion.setFromUnitVectors(v(0, 1, 0), v(sx * 0.42, 0.34, 0.84).normalize());
      const inner = group(eg);
      inner.scale.set(1.12, 1, 0.9);
      add(inner, earGeo, M.coat).userData.inkGroup = o.ink + 20;
      ears.push({ g: eg, sx });
    }

    const center = group(g, [0, -0.01, 0.1]);
    const mouth = group(g, coat.at(0.9, 0, 0.004).toArray() as V3);
    return { g, eyes, gazes, lids, his, ears, mouth, center };
  };

  // ── Skeleton: place moves the whole animal onto the pivot ──
  const place = group(root);

  // ═════════════ The eldest (Slash): a weasel sitting on its hind legs with the upper body straight ═════════════
  // sBody handles breathing and crouching (rotating about the rump); the hind feet and tail hang on place, so they lie firmly on the ground
  const HIP = v(0, 0.2, -0.22);
  const sBody = group(place);
  const SP = [v(0, 0.1, -0.25), v(0, 0.2, -0.22), v(0, 0.37, -0.15), v(0, 0.54, -0.075), v(0, 0.68, -0.035), v(0, 0.8, -0.01), v(0, 0.9, 0.03)];
  const sProf = curveTable([
    [0, 0, 0, 0],
    [0.012, 0.09, 0.08, 0],
    [0.045, 0.155, 0.145, 0],
    [0.16, 0.198, 0.188, 0],
    [0.34, 0.172, 0.166, 0],
    [0.5, 0.15, 0.15, 0],
    [0.65, 0.158, 0.168, -0.014],
    [0.79, 0.132, 0.136, -0.006],
    [0.89, 0.112, 0.112, 0],
    [0.96, 0.102, 0.102, 0],
    [0.99, 0.07, 0.07, 0],
    [1, 0, 0, 0],
  ]);
  const sCoat = coatLoft(SP, sProf, {
    segs: 36,
    radial: 26,
    split: (t) => curveTable([[0, 0.75], [0.15, 0.9], [0.4, 1.02], [0.62, 1.12], [0.8, 1.25], [1, 1.3]])(t)[0],
    ventral: 0.36,
    back: () => C(COAT),
    belly: () => C(CREAM),
    rows: [0.006, 0.02, 0.99],
  });
  add(sBody, sCoat.geo, M.coat).userData.inkGroup = S_BODY;

  // Hind legs: thighs bulging at the sides of the rump (in the same group as the torso, the normals joining into the torso, pitfall 38), the feet flat forward on the ground, with cream toe tips
  for (const sx of [-1, 1]) {
    const th = loft([v(sx * 0.05, 0.32, -0.25), v(sx * 0.14, 0.26, -0.18), v(sx * 0.185, 0.17, -0.09), v(sx * 0.19, 0.1, 0.0)],
      curveTable([[0, 0, 0], [0.08, 0.09, 0.1], [0.35, 0.105, 0.125], [0.7, 0.085, 0.09], [0.92, 0.06, 0.06], [1, 0, 0]]), { segs: 18, radial: 14, side: X });
    solid(th, COAT);
    blendNormalsInto(th, sCoat.geo, 0.05);
    add(sBody, th, M.coat).userData.inkGroup = S_BODY;
    const foot = loft([v(sx * 0.19, 0.045, -0.13), v(sx * 0.195, 0.036, -0.03), v(sx * 0.2, 0.032, 0.05)], curveTable([[0, 0, 0], [0.12, 0.045, 0.034], [0.6, 0.05, 0.03], [0.9, 0.045, 0.026], [1, 0, 0]]), { segs: 12, radial: 10, side: X });
    add(place, paint(foot, (p) => (p.z > 0.0 ? C(CREAM) : C(COAT))), M.coat);
    for (let i = 0; i < 4; i++) {
      const tx = sx * 0.2 + (i - 1.5) * 0.024;
      const tz = 0.05 - Math.abs(i - 1.5) * 0.012;
      add(place, solid(new THREE.SphereGeometry(1, 8, 6), CREAM), M.coat, [tx, 0.026, tz], [0, 0, 0], [0.016, 0.018, 0.022]);
      add(place, solid(new THREE.ConeGeometry(0.006, 0.02, 6), CLAW), M.coat, [tx, 0.016, tz + 0.022], [1.9, 0, 0]);
    }
  }

  // Forelegs: from the side of the chest down to the elbow and then forward to the wrist, the wrist hanging down, cream forepaws; the crescent sickle grows from the outer side of the wrist, and a ring of fur blown back at the wrist covers the blade root
  interface Arm { g: THREE.Group; sx: number; tip: THREE.Group }
  const arms: Arm[] = [];
  for (const sx of [-1, 1]) {
    const SH = v(sx * 0.1, 0.72, -0.03);
    const ag = group(sBody, SH.toArray() as V3);
    const off = SH.clone().negate();
    const G = sx > 0 ? S_ARM_L : S_ARM_R;
    const armPts = [v(sx * 0.06, 0.74, -0.04), v(sx * 0.12, 0.645, 0.0), v(sx * 0.158, 0.56, 0.055), v(sx * 0.15, 0.56, 0.13), v(sx * 0.13, 0.58, 0.2)];
    const armGeo = loft(armPts, curveTable([[0, 0, 0], [0.08, 0.048, 0.052], [0.4, 0.05, 0.054], [0.75, 0.04, 0.043], [0.95, 0.034, 0.036], [1, 0, 0]]), { segs: 20, radial: 12, side: X });
    solid(armGeo, COAT);
    blendNormalsInto(armGeo, sCoat.geo, 0.04);
    add(ag, armGeo.translate(off.x, off.y, off.z), M.coat).userData.inkGroup = G;
    // Forepaw: a small cream paw hanging down from the wrist, with four small dark claws
    const paw = loft([v(sx * 0.13, 0.595, 0.185), v(sx * 0.132, 0.57, 0.23), v(sx * 0.128, 0.525, 0.248)], curveTable([[0, 0, 0], [0.15, 0.036, 0.034], [0.55, 0.04, 0.036], [0.85, 0.034, 0.03], [1, 0, 0]]), { segs: 10, radial: 10, side: X });
    add(ag, solid(paw, CREAM).translate(off.x, off.y, off.z), M.coat);
    for (let i = 0; i < 4; i++) {
      const cx = sx * 0.128 + (i - 1.5) * 0.017;
      add(ag, solid(new THREE.ConeGeometry(0.0055, 0.02, 6), CLAW), M.coat, [cx + off.x, 0.512 + off.y, 0.252 - Math.abs(i - 1.5) * 0.004 + off.z], [PI - 0.3, 0, 0]);
    }
    // A ring of fur at the wrist blown toward the elbow
    const armPath = new THREE.CatmullRomCurve3(armPts, false, 'centripetal');
    const cT = armPath.getTangentAt(0.8);
    collar(ag, { r0: 0.036, len: 0.08, thick: 0.035, flare: 0.45, curl: 0.25, tufts: 5, notch: 0.45, seed: 40 + sx }, armPath.getPointAt(0.8).add(off), cT, v(sx, 0.3, 0), G, COAT, 5, 5);
    // Crescent sickle: the blade root on the outer side of the wrist (buried in the wrist fur), curving up and back past the elbow, the edge (outer edge) facing outward and forward
    const B0 = v(sx * 0.158, 0.575, 0.165);
    const B1 = v(sx * 0.27, 0.83, 0.09);
    const U = B1.clone().sub(B0);
    const len = U.length();
    U.normalize();
    const face = v(sx * 0.45, 0, 0.9);
    const Nf = face.addScaledVector(U, -face.dot(U)).normalize();
    const Vd = new THREE.Vector3().crossVectors(Nf, U).normalize();
    if (Vd.dot(v(sx, 0, 0)) < 0) Vd.negate();
    const N = new THREE.Vector3().crossVectors(U, Vd);
    const { blade, spine } = sickleShapes(len, 0.07, 0.12);
    const bg = group(ag, B0.clone().add(off).toArray() as V3);
    bg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(U, Vd, N));
    add(bg, solid(slab(blade, 0.008, 0.004, 1), BLADE), M.blade);
    add(bg, solid(slab(spine, 0.014, 0.003, 1), JADE), M.blade);
    const tipA = group(bg, [len + 0.01, 0.12 * 0.35, 0]);
    arms.push({ g: ag, sx, tip: tipA });
  }

  // Neck and head: sNeck is the head's pivot (looking around)
  const sNeck = group(sBody, [0, 0.9, 0.03]);
  const sHead = buildHead(sNeck, v(0, 0.075, 0.07), [0.02, 0, -0.07], {
    coat: COAT, scale: 1.28, lids: true, er: 0.036, ink: 9850, segs: 30, radial: 26,
  });

  // Scarf: the same piece of deep jade cloth on all three siblings. The eldest's is tied at the base of the neck, the knot behind the neck, the two scarf tails blown to the back right (the wind can be seen from behind);
  // the ring of dark also separates the cream face from the cream chest, so the face stands as a patch of its own
  const NT = 0.875;
  const nP = sCoat.path.getPointAt(NT);
  const nT = sCoat.path.getTangentAt(NT);
  const nH = sCoat.at(NT, PI).sub(sCoat.at(NT, 0)).normalize();
  {
    const band = add(sBody, solid(new THREE.TorusGeometry(0.118, 0.013, 6, 30), CLOTH), M.coat, nP.toArray() as V3, [0, 0, 0], [1, 1, 2.1]);
    band.quaternion.setFromUnitVectors(FWD, nT);
  }
  const KN = nP.clone().addScaledVector(nH, 0.125).addScaledVector(nT, -0.004);
  add(sBody, solid(new THREE.SphereGeometry(1, 12, 8), CLOTH), M.coat, KN.toArray() as V3, [0, 0, 0], [0.034, 0.03, 0.024]);
  const scarfEnds = group(sBody, KN.toArray() as V3);
  for (const pts of [
    [v(0, 0, -0.005), v(-0.03, -0.012, -0.08), v(-0.08, -0.02, -0.16), v(-0.13, -0.01, -0.22)],
    [v(0, 0, -0.005), v(-0.015, -0.045, -0.07), v(-0.04, -0.09, -0.12), v(-0.08, -0.11, -0.15)],
  ]) {
    const end = coatLoft(pts, curveTable([[0, 0.022, 0.007], [0.15, 0.028, 0.007], [0.75, 0.024, 0.006], [0.93, 0.018, 0.005], [1, 0, 0]]), {
      segs: 14, radial: 8, side: v(0.6, 0.8, 0), back: (t) => C(t < 0.8 ? CLOTH : 0x86d9b8), cuts: [0.8], rows: [0.99],
    });
    add(scarfEnds, end.geo, M.coat);
  }

  // Tail: circling a big loop out behind the rump, enclosing the seated youngest inside, the tail tip curling up in front of the youngest; the tip deep cocoa with a tuft of tail fur blown back
  const sTail = group(place, [0, 0.2, -0.3]);
  const TR = v(0, 0.2, -0.3);
  const tailPts = [v(0, 0.2, -0.26), v(0.015, 0.12, -0.42), v(0.09, 0.068, -0.58), v(0.27, 0.058, -0.69), v(0.5, 0.06, -0.63), v(0.63, 0.07, -0.46), v(0.61, 0.1, -0.29), v(0.53, 0.19, -0.19)].map((p) => p.sub(TR));
  const TAIL_CUT = 0.8;
  const tailCoat = coatLoft(tailPts, curveTable([[0, 0.05, 0.05], [0.1, 0.05, 0.05], [0.5, 0.044, 0.044], [0.75, 0.042, 0.042], [0.9, 0.036, 0.036], [0.97, 0.024, 0.024], [1, 0, 0]]), {
    segs: 44,
    radial: 12,
    side: v(0, 1, 0),
    back: (t) => C(t < TAIL_CUT ? COAT : TIP),
    cuts: [TAIL_CUT],
    rows: [0.99],
  });
  blendNormalsInto(tailCoat.geo, sCoat.geo, 0.05, TR);
  add(sTail, tailCoat.geo, M.coat).userData.inkGroup = S_TAIL;
  {
    const t0 = 0.86;
    const tan = tailCoat.path.getTangentAt(t0);
    collar(sTail, { r0: 0.03, len: 0.13, thick: 0.05, flare: 0.35, curl: 0.2, tufts: 5, notch: 0.4, seed: 51 }, tailCoat.path.getPointAt(t0), tan.clone().negate(), v(0, 1, 0), S_TAIL, TIP, 6, 5);
  }
  const sTailTip = group(sTail, tailCoat.at(1, 0).toArray() as V3);

  // ═════════════ The second (Trip): a weasel crouched low to the ground at the front left, ready to pounce, a small hook sickle on its tail tip ═════════════
  const tG = group(place, [-0.44, 0, 0.26], [0, -0.55, 0]);
  const tBody = group(tG);
  const TP = [v(0, 0.11, -0.24), v(0, 0.15, -0.13), v(0, 0.17, -0.02), v(0, 0.165, 0.08), v(0, 0.195, 0.17), v(0, 0.25, 0.24)];
  const tCoat = coatLoft(TP, curveTable([[0, 0, 0, 0], [0.02, 0.04, 0.036, 0], [0.1, 0.07, 0.065, 0], [0.35, 0.068, 0.064, 0], [0.55, 0.064, 0.062, 0], [0.72, 0.068, 0.068, -0.004], [0.86, 0.056, 0.056, 0], [0.95, 0.05, 0.05, 0], [1, 0, 0, 0]]), {
    segs: 26,
    radial: 18,
    split: (t) => 1.05 + 0.25 * ss(t, 0.6, 1),
    ventral: 0.38,
    back: () => C(COAT2),
    belly: () => C(CREAM),
    rows: [0.008, 0.99],
  });
  add(tBody, tCoat.geo, M.coat).userData.inkGroup = T_BODY;
  for (const sx of [-1, 1]) {
    // Forefeet reaching forward and hind feet tucked under the body, the toe tips cream
    const fl = loft([v(sx * 0.035, 0.16, 0.1), v(sx * 0.055, 0.09, 0.15), v(sx * 0.06, 0.035, 0.19)], curveTable([[0, 0, 0], [0.12, 0.028, 0.03], [0.6, 0.024, 0.026], [1, 0.02, 0.022]]), { segs: 8, radial: 8, side: X });
    blendNormalsInto(fl, tCoat.geo, 0.03);
    add(tBody, solid(fl, COAT2), M.coat).userData.inkGroup = T_BODY;
    add(tBody, solid(new THREE.SphereGeometry(1, 10, 7), CREAM), M.coat, [sx * 0.06, 0.022, 0.21], [0, 0, 0], [0.026, 0.02, 0.036]);
    const hl = loft([v(sx * 0.035, 0.15, -0.16), v(sx * 0.07, 0.1, -0.12), v(sx * 0.07, 0.035, -0.15)], curveTable([[0, 0, 0], [0.12, 0.04, 0.045], [0.5, 0.036, 0.04], [1, 0.022, 0.024]]), { segs: 8, radial: 8, side: X });
    blendNormalsInto(hl, tCoat.geo, 0.03);
    add(tBody, solid(hl, COAT2), M.coat).userData.inkGroup = T_BODY;
    add(tBody, solid(new THREE.SphereGeometry(1, 10, 7), CREAM), M.coat, [sx * 0.07, 0.02, -0.125], [0, 0, 0], [0.026, 0.02, 0.04]);
  }
  const tHead = buildHead(tBody, v(0, 0.285, 0.285), [0.06, 0, 0.05], {
    coat: COAT2, scale: 0.6, lids: false, er: 0.04, ink: 9860, segs: 22, radial: 20,
  });
  // Tail: circling out from the rump to the front left, lying along the ground, a small hook sickle hooking inward at the tail tip
  const TT = v(0, 0.11, -0.24);
  const tTail = group(tBody, TT.toArray() as V3);
  const tTailPts = [v(0, 0.12, -0.22), v(-0.05, 0.05, -0.34), v(-0.2, 0.034, -0.37), v(-0.31, 0.034, -0.22), v(-0.33, 0.036, -0.03), v(-0.28, 0.04, 0.13)].map((p) => p.sub(TT));
  const tTailCoat = coatLoft(tTailPts, curveTable([[0, 0.032, 0.032], [0.2, 0.03, 0.03], [0.7, 0.027, 0.027], [0.9, 0.022, 0.022], [0.97, 0.016, 0.016], [1, 0, 0]]), {
    segs: 30, radial: 10, side: v(0, 1, 0), back: (t) => C(t < 0.82 ? COAT2 : TIP), cuts: [0.82], rows: [0.99],
  });
  add(tTail, tTailCoat.geo, M.coat).userData.inkGroup = T_TAIL;
  const hookG = group(tTail, tTailCoat.at(0.97, 0).toArray() as V3);
  {
    const T = tTailCoat.path.getTangentAt(0.97);
    const Vd = v(1, 0.55, 0).addScaledVector(T, -v(1, 0.55, 0).dot(T)).normalize();
    const N = new THREE.Vector3().crossVectors(T, Vd);
    hookG.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, Vd, N));
    const { blade, spine } = sickleShapes(0.13, 0.03, 0.06);
    add(hookG, solid(slab(blade, 0.006, 0.003, 1), BLADE), M.blade, [-0.01, 0, 0]);
    add(hookG, solid(slab(spine, 0.01, 0.0025, 1), JADE), M.blade, [-0.01, 0, 0]);
  }
  const hookTip = group(hookG, [0.13, 0.06 * 0.35, 0]);
  {
    const wrap = add(tTail, solid(new THREE.TorusGeometry(0.024, 0.009, 6, 16), CLOTH), M.coat, tTailCoat.at(0.9, 0).lerp(tTailCoat.path.getPointAt(0.9), 0.5).toArray() as V3, [0, 0, 0], [1, 1, 1.6]);
    wrap.position.copy(tTailCoat.path.getPointAt(0.9));
    wrap.quaternion.setFromUnitVectors(FWD, tTailCoat.path.getTangentAt(0.9));
  }

  // ═════════════ The youngest (Salve): sitting in the curl of the eldest's tail, holding an open clamshell (jade-green salve) in both hands, a knotted medicine pouch on its back ═════════════
  const hG = group(place, [0.34, 0, -0.44], [0, 0.5, 0]);
  const hBody = group(hG);
  const HP = [v(0, 0.01, -0.03), v(0, 0.12, -0.02), v(0, 0.2, 0.0), v(0, 0.27, 0.02), v(0, 0.31, 0.03)];
  const hCoat = coatLoft(HP, curveTable([[0, 0, 0, 0], [0.03, 0.06, 0.056, 0], [0.18, 0.09, 0.086, 0], [0.45, 0.076, 0.074, -0.004], [0.7, 0.06, 0.06, 0], [0.88, 0.05, 0.05, 0], [1, 0, 0, 0]]), {
    segs: 20,
    radial: 18,
    split: (t) => 1.0 + 0.3 * ss(t, 0.5, 1),
    ventral: 0.38,
    back: () => C(COAT3),
    belly: () => C(CREAM),
    rows: [0.01, 0.99],
  });
  add(hBody, hCoat.geo, M.coat).userData.inkGroup = H_BODY;
  for (const sx of [-1, 1]) {
    // Sitting: thighs bulging at the sides, the feet flat forward
    const th = loft([v(sx * 0.03, 0.12, -0.05), v(sx * 0.075, 0.08, -0.02), v(sx * 0.085, 0.05, 0.03)], curveTable([[0, 0, 0], [0.15, 0.045, 0.05], [0.6, 0.04, 0.045], [1, 0, 0]]), { segs: 8, radial: 8, side: X });
    blendNormalsInto(th, hCoat.geo, 0.03);
    add(hBody, solid(th, COAT3), M.coat).userData.inkGroup = H_BODY;
    add(hBody, solid(new THREE.SphereGeometry(1, 10, 7), CREAM), M.coat, [sx * 0.085, 0.018, 0.05], [0, 0, 0], [0.026, 0.018, 0.04]);
    // Forelegs: curving from the shoulder forward and down, holding the clamshell
    const fl = loft([v(sx * 0.04, 0.26, 0.0), v(sx * 0.06, 0.21, 0.05), v(sx * 0.045, 0.19, 0.09)], curveTable([[0, 0, 0], [0.15, 0.022, 0.024], [0.6, 0.02, 0.022], [1, 0.018, 0.018]]), { segs: 8, radial: 8, side: X });
    blendNormalsInto(fl, hCoat.geo, 0.025);
    add(hBody, solid(fl, COAT3), M.coat).userData.inkGroup = H_BODY + 1;
    add(hBody, solid(new THREE.SphereGeometry(1, 8, 6), CREAM), M.coat, [sx * 0.04, 0.186, 0.097], [0, 0, 0], [0.02, 0.018, 0.02]);
  }
  // Clamshell: the lower shell holds the jade-green salve, and the upper shell is flipped open to the back
  const clam = group(hBody, [0, 0.19, 0.115], [0.25, 0, 0]);
  add(clam, cupGeo(0.05, 0.022, 0.006, SHELL, SHELL_IN, 14), M.coat, [0, 0, 0], [0, 0, 0], [1, 1, 0.85]);
  add(clam, solid(new THREE.SphereGeometry(1, 12, 6), SALVE), M.coat, [0, -0.004, 0], [0, 0, 0], [0.04, 0.012, 0.033]);
  const lidHinge = group(clam, [0, 0.002, -0.04], [-2.2, 0, 0]);
  add(lidHinge, cupGeo(0.05, 0.02, 0.006, SHELL, SHELL_IN, 14), M.coat, [0, 0, 0.04], [PI, 0, 0], [1, 1, 0.85]);
  const salveA = group(clam, [0, 0.01, 0]);
  // Pouch on the back: a knotted jade cloth bundle, one slanted strap from the right shoulder around to the left armpit
  const pack = group(hBody, [0, 0.21, -0.085], [0.25, 0, 0]);
  add(pack, solid(new THREE.SphereGeometry(1, 14, 10), CLOTH), M.coat, [0, 0, 0], [0, 0, 0], [0.068, 0.058, 0.046]);
  for (const sx of [-1, 1]) {
    const ear = loft([v(0, 0.045, -0.005), v(sx * 0.02, 0.075, -0.01), v(sx * 0.04, 0.09, -0.02)], curveTable([[0, 0.014, 0.01], [0.5, 0.013, 0.009], [1, 0, 0]]), { segs: 8, radial: 7 });
    add(pack, solid(ear, CLOTH), M.coat);
  }
  add(pack, solid(new THREE.SphereGeometry(1, 10, 7), CLOTH), M.coat, [0, 0.05, -0.004], [0, 0, 0], [0.02, 0.016, 0.018]);
  add(hBody, solid(new THREE.TorusGeometry(0.066, 0.007, 6, 24), CLOTH), M.coat, [0, 0.22, -0.02], [PI / 2 - 0.15, 0.55, 0]);
  const packA = group(pack, [0, 0.03, -0.03]);
  const hHead = buildHead(hBody, v(0, 0.36, 0.05), [-0.05, 0, 0.08], {
    coat: COAT3, scale: 0.58, lids: false, er: 0.042, ink: 9870, segs: 22, radial: 20,
  });
  // The youngest's tail curls in front of its own feet
  const HT = v(0, 0.05, -0.06);
  const hTail = group(hBody, HT.toArray() as V3);
  const hTailPts = [v(0, 0.06, -0.05), v(0.06, 0.03, -0.11), v(0.13, 0.026, -0.04), v(0.13, 0.026, 0.06), v(0.06, 0.03, 0.12)].map((p) => p.sub(HT));
  const hTailCoat = coatLoft(hTailPts, curveTable([[0, 0.03, 0.03], [0.3, 0.028, 0.028], [0.8, 0.024, 0.024], [0.95, 0.016, 0.016], [1, 0, 0]]), {
    segs: 22, radial: 10, side: v(0, 1, 0), back: (t) => C(t < 0.8 ? COAT3 : TIP), cuts: [0.8], rows: [0.99],
  });
  add(hTail, hTailCoat.geo, M.coat).userData.inkGroup = H_TAIL;

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const armL = arms.find((a) => a.sx > 0)!;
  const armR = arms.find((a) => a.sx < 0)!;
  const rig = {
    head: sHead.center,
    eyes: sHead.eyes,
    anchors: {
      mouth: sHead.mouth,
      chest: group(sBody, sCoat.at(0.6, 0, 0.02).toArray() as V3),
      bladeL: armL.tip,
      bladeR: armR.tip,
      tail: sTailTip,
      tripper: tHead.center,
      hook: hookTip,
      healer: hHead.center,
      salve: salveA,
      pack: packA,
    },
  };
  const act = { focus: 0, crouch: 0, slash: 0, trip: 0, salve: 0 };

  // Static parts merged (mesh budget SR 60): nodes that move when idle act as owners; the eye highlights are not merged
  const heads = [sHead, tHead, hHead];
  mergeStatic(root, {
    owners: [sBody, sNeck, scarfEnds, ...heads.flatMap((h) => [h.g, ...h.gazes, ...h.ears.map((e) => e.g), ...h.lids.flatMap((l) => [l.up, l.lo])]), ...arms.map((a) => a.g), sTail, tG, tBody, tTail, hG, hBody, hTail, clam],
    keep: heads.flatMap((h) => h.his),
    rig,
  });

  // ── Idle: all computed from t, so frame-by-frame screenshots at frozen time are consistent too (pitfall 80) ──
  // A weasel's looking around is jerky: it stops at each cell and turns the head very fast
  const looker = (seq: number[], T: number, off: number) => (t: number) => {
    const u = (t + off) / T;
    const i = Math.floor(u);
    const f = u - i;
    const n = seq.length;
    return lerp(seq[((i % n) + n) % n], seq[(((i + 1) % n) + n) % n], ss(f, 0.82, 0.94));
  };
  const lookS = looker([0.0, 0.32, -0.12, 0.2, -0.36, 0.08, 0.26, -0.2], 1.3, 0);
  const lookSp = looker([0.04, -0.06, 0.1, 0.0, -0.1, 0.06, 0.14, -0.04], 1.3, 0.3);
  const lookT = looker([0.0, -0.3, 0.2, -0.1, 0.34, -0.2], 1.1, 0.5);
  const lookH = looker([0.0, 0.4, -0.2, 0.3, -0.35, 0.15], 1.7, 1.1);
  const HIP0 = HIP.clone();
  const bo = new THREE.Vector3();
  const blink = (t: number, period: number, off: number) => {
    const bt = ((t + off) % period) / 0.2;
    return bt < 1 ? Math.min(1, Math.sin(bt * PI) * 1.3) : 0;
  };
  const update = (t: number) => {
    const calm = 1 - act.focus;
    const cr = act.crouch;
    const sl = act.slash;
    const br = Math.sin(t * 1.6);
    // The eldest: the upper body rises and falls slightly when breathing; when crouching the upper body tilts forward about the rump
    const pitch = cr * 0.42;
    bo.set(0, br * 0.006, 0).sub(HIP0);
    sBody.rotation.x = pitch;
    sBody.position.set(0, bo.y * Math.cos(pitch) - bo.z * Math.sin(pitch), bo.y * Math.sin(pitch) + bo.z * Math.cos(pitch)).add(HIP0);
    sNeck.rotation.set(-pitch * 0.8 + lookSp(t) * calm * 0.5, lookS(t) * calm, 0);
    for (const a of arms) {
      const bob = Math.sin(t * 1.6 - 0.5) * 0.03;
      // slash: the forelegs swing forward and outward, the blades standing up; crouch: both sickles drawn back
      a.g.rotation.set(-bob - sl * 0.9 + cr * 0.35, a.sx * (sl * 0.5 - cr * 0.1), a.sx * (-sl * 0.35 + cr * 0.12));
    }
    for (const e of sHead.ears) {
      const ph = (t + (e.sx > 0 ? 0 : 2.6)) % 5.3;
      const tw = ph < 0.3 ? Math.sin(ph * 40) * (1 - ph / 0.3) * 0.25 : 0;
      e.g.rotation.set(0, 0, e.sx * tw);
    }
    sTail.rotation.set(0, Math.sin(t * 0.7) * 0.04, 0);
    scarfEnds.rotation.set(Math.sin(t * 2.3) * 0.07, Math.sin(t * 3.1) * 0.12 + Math.sin(t * 5.3) * 0.03, Math.sin(t * 2.7) * 0.05);
    sTailTip.rotation.set(0, 0, 0);
    // Blink: the upper and lower lids close together toward the midline (pitfall 46); the highlights are hidden once it is more than half closed
    const cs = blink(t, 3.4, 1.2);
    for (const l of sHead.lids) {
      l.up.rotation.x = -UP_OPEN + (UP_OPEN + 0.04) * cs;
      l.lo.rotation.x = PI + LO_OPEN - LO_OPEN * cs;
    }
    for (const h of sHead.his) h.visible = cs < 0.6;
    // The second: breathing while lying low, looking around; trip pounces forward, the tail hook sweeping forward
    const tr = act.trip;
    tBody.position.set(0, Math.sin(t * 2.1) * 0.003 - (1 - tr) * 0.0, tr * 0.12);
    tBody.rotation.x = -tr * 0.08;
    tHead.g.rotation.y = lookT(t) * calm * (1 - tr);
    tTail.rotation.y = Math.sin(t * 0.9) * 0.08 - tr * 0.35;
    const ct = blink(t, 3.9, 0.3);
    for (const gz of tHead.gazes) gz.scale.y = 1 - ct * 0.9;
    for (const h of tHead.his) h.visible = ct < 0.6;
    // The youngest: looking left and right; salve lifts the clamshell forward and up
    const sv = act.salve;
    hHead.g.rotation.y = lookH(t) * calm;
    clam.position.set(0, 0.19 + sv * 0.06, 0.115 + sv * 0.05);
    clam.rotation.x = 0.25 - sv * 0.3;
    hTail.rotation.y = Math.sin(t * 1.1 + 1) * 0.06;
    const ch = blink(t, 4.3, 2.2);
    for (const gz of hHead.gazes) gz.scale.y = 1 - ch * 0.9;
    for (const h of hHead.his) h.visible = ch < 0.6;
  };
  update(1);

  // Move the whole animal onto the pivot: the x and z center of the bounding box is placed at the origin, so the side and back views are not cropped (pitfall 66)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const mid = box.getCenter(new THREE.Vector3());
  place.position.set(-mid.x, 0, -mid.z);
  const size = box.getSize(new THREE.Vector3());

  return {
    root,
    update: (t) => update(t),
    center: new THREE.Vector3(0, mid.y, 0),
    radius: Math.max(size.x, size.y, size.z) * 0.56,
    rig,
    act,
  };
}
