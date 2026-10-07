// Eldarin, the First Contract Dragon (model lab version): the partner of Elda, the first contractor; the prototype of the contract mark is carved on its forehead. After the Night of the Shattered Heart it slept beneath the base of the Star Gate, and opened its eyes only when the Star Gate lit again.
// The player's starting spirit and also the narrator of the prologue (speaking in the tone of an old dragon telling a bedtime story), so it needs the highest recognizability.
// It keeps the five things that made the old model easiest to recognize: the platinum-gold scaled body, the pale gold wing membranes, the contract mark on the forehead, the gold rings on the horns, and the cream belly plates.
// Body shape follows the lore: a four-legged winged dragon. The old version was a barrel-shaped torso on four thin cylinders, with a long neck like a giraffe's and a head only a twelfth of the whole body;
// here the neck, torso and tail are one whole loft: a deep chest, a narrow waist, the tail dragging on the ground and then curling back toward the front left; the limbs thick, the elbows out, big three-toed feet; the head enlarged to about a quarter of the whole body.
// The wings are raised half open, the wing surfaces facing forward and outward and closing in slightly, framing the head, and also as if sheltering something in front of it (this is how it shielded Elda on the Night of the Shattered Heart).
// The contract mark is really carved into the forehead: the forehead rises slightly in a patch, and the two ring grooves, the eight radiating cuts and the diamond-shaped slot in the center are all geometry dug downward, gold inlaid in the grooves and a gem inlaid in the slot.
// Personality: an old partner who has kept an agreement for a thousand years, warm and steady, who recognizes you at first sight on waking. Eyes open and looking straight ahead, a dragon's small eyes: one whole sheet of golden iris, a thin vertical pupil, one small point of highlight,
// the upper edge tucked under a gentle brow ridge; the eyelids appear only when blinking and closing the eyes; the corners of the mouth turned up slightly; the head held high, the chin slightly tucked, the forehead facing forward.
// Gaze order: the face (golden eyes) first, the contract mark just above the two eyes second; the wings frame the head, and the wing membranes, dorsal fin and tail are support.
// Back: on the membrane of the right wing a tear mended with gold, with a notch still left in the trailing edge and the gray-purple old marks left by the Void Blight around it: on the Night of the Shattered Heart it used this wing to block the Void Blight for Elda.
// The right shoulder on the same side also has a few gold-mended cracks, and from behind the wing and the old wounds on the shoulder can be seen joined into one.
// Idle: breathing, slow looking around, blinking (the upper and lower eyelids slide out of the socket and meet slightly below the midline, two lines of color at the lip when closed; hidden when the eyes are open), the ear fins twitching now and then, the wings opening and closing with the breathing, the contract-mark gem glimmering faintly.
// The dorsal fin runs from the back of the head along the neck and back all the way to the leaf-shaped tail fin at the end, one whole continuous fin and not plates stacked one on another.
// Restrained light effects: the big magic circle behind the head, the contract fragments circling the body, the light dots, the glowing veins on the neck and flanks, and the double halo at the end of the tail are removed; the only emissive left is the contract mark on the forehead (the central gem and the gold inlay).
//
// <Action table> Performances only tween the act weights (0 to 1, with turn from −1 to 1), and should not go looking for meshes. The neck, torso, tail and limbs are bound to center lines,
// the weights change the control points, and the vertices follow on the CPU (visible to the outline); when the weights all return to 0 every vertex is restored to its original value.
//   focus  stop looking around, the gaze fixed
//   sigil  the contract mark on the forehead lights up (the emissive of the central gem and the gold inlay)
//   raise  head up and chest out: the neck straightens upward and the chin lifts
//   roar   mouth open in a roar: the neck thrust forward, the lower jaw open, the ear fins spread; best stacked with raise
//   speak  speaking: the lower jaw slightly open (forty percent of the opening of roar)
//   spread both wings spread outward and upward as a whole
//   rear   the front half rises about a pivot above the hind feet, the forelegs drawn in forward and the claws spread outward; past 0.5 it looks like a meerkat standing upright, so use 0.3 to 0.5 in performances
//   sleep  lying down to sleep: the body against the ground, the neck bent toward its right-hand side (−x), the head resting beside the right forepaw, the tail curling back from the right, both wings folded, the breathing slowing
//   shut   close the eyes
//   turn   turn the head, a positive value turning toward its left-hand side (+x)
// <Anchors> are all empty groups, following the pose: rig.head the center of the face, rig.eyes the front edge of the two eyeballs; anchors has mouth (inside the mouth), jaw (tip of the lower jaw),
//   sigil (the contract mark gem on the forehead), hornL / hornR (horn tips), chest, tailTip (end of the tail), wingL / wingR (wing shoulders), wingTipL / wingTipR (wing tips).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, smooth, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const X = v(1, 0, 0);

// ───────────────────────── Helpers for the face-count budget (SSR 60,000 faces) ─────────────────────────

/** Eyelid shell: the same outline as lidGeometry in shapes.ts, with the lathe segments and the number of outline points adjustable (the eyelid edge shows only half a circle from the front, so 24 segments show no corner) */
function lidGeo(ri: number, ro: number, lip: number, seg = 24, n = 6, rim = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), ri * Math.cos(a)));
  }
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < rim; i++) {
    const b = (i / rim) * PI;
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
 * An elliptical disc on a sphere (iris, pupil): centered on +z, longitude radius rx, latitude radius ry (radians), laid onto a sphere of radius r.
 * A polar grid going outward ring by ring, with segs segments on the outer edge; compared with sphereDecal subdividing long thin triangles three times it saves many faces, and the chord faces do not sink into the sphere.
 */
function diskDecal(rx: number, ry: number, r: number, rings = 3, segs = 28): THREE.BufferGeometry {
  const pos: number[] = [0, 0, r];
  for (let k = 1; k <= rings; k++)
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * PI * 2;
      const lon = (k / rings) * rx * Math.cos(a);
      const lat = (k / rings) * ry * Math.sin(a);
      pos.push(Math.cos(lat) * Math.sin(lon) * r, Math.sin(lat) * r, Math.cos(lat) * Math.cos(lon) * r);
    }
  const idx: number[] = [];
  const at = (k: number, j: number) => (k === 0 ? 0 : 1 + (k - 1) * segs + (j % segs));
  for (let j = 0; j < segs; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let k = 1; k < rings; k++)
    for (let j = 0; j < segs; j++) idx.push(at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j), at(k + 1, j + 1), at(k, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((x) => x / r), 3));
  g.setIndex(idx);
  return g;
}

/** Sorted sample positions with duplicates removed */
function uniq(a: number[]): number[] {
  const s = [...a].sort((x, y) => x - y);
  return s.filter((x, i) => i === 0 || x - s[i - 1] > 1e-6);
}

/** Distance from a point in the plane to a polyline (ky scales up the second coordinate) */
function polyDist(x: number, y: number, line: [number, number][], ky = 1): number {
  let d = Infinity;
  for (let k = 0; k < line.length - 1; k++) {
    const [x0, y0] = line[k];
    const [x1, y1] = line[k + 1];
    const px = x - x0;
    const py = (y - y0) * ky;
    const qx = x1 - x0;
    const qy = (y1 - y0) * ky;
    const h = THREE.MathUtils.clamp((px * qx + py * qy) / (qx * qx + qy * qy), 0, 1);
    d = Math.min(d, Math.hypot(px - qx * h, py - qy * h));
  }
  return d;
}

// ───────────────────────── Geometry tools ─────────────────────────

/**
 * Grid surface: rows × cols points, with f(i, j) giving the position and color. wrapJ joins column cols − 1 back to column 0 (once around a tube), and wrapI joins the last row back to row 0 (a closed ring).
 * The wrap-around shares vertices directly, with no need to merge afterwards; end rows that close to a single point (closures) get the same averaged normal, so the tip shows no dark streaks.
 */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, o: { wrapJ?: boolean; wrapI?: boolean } = {}): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const col = new Float32Array(rows * cols * 3).fill(1);
  let hasCol = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      const k = (i * cols + j) * 3;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
      if (c) {
        hasCol = true;
        col[k] = c.r;
        col[k + 1] = c.g;
        col[k + 2] = c.b;
      }
    }
  const idx: number[] = [];
  const iN = o.wrapI ? rows : rows - 1;
  const jN = o.wrapJ ? cols : cols - 1;
  for (let i = 0; i < iN; i++)
    for (let j = 0; j < jN; j++) {
      const i2 = (i + 1) % rows;
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = i * cols + j2;
      const c = i2 * cols + j;
      const d = i2 * cols + j2;
      idx.push(a, c, b, c, d, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.userData.grid = [rows, cols];
  normals(g);
  return g;
}

/** Compute smooth normals; rows in a grid surface that lie entirely on one point (closures) share an averaged normal */
function normals(g: THREE.BufferGeometry): void {
  g.computeVertexNormals();
  const grid = g.userData.grid as [number, number] | undefined;
  if (!grid) return;
  const [rows, cols] = grid;
  const P = g.attributes.position.array as Float32Array;
  const N = g.attributes.normal.array as Float32Array;
  for (let i = 0; i < rows; i++) {
    const k0 = i * cols * 3;
    let same = true;
    for (let j = 1; j < cols && same; j++) {
      const k = k0 + j * 3;
      same = Math.abs(P[k] - P[k0]) + Math.abs(P[k + 1] - P[k0 + 1]) + Math.abs(P[k + 2] - P[k0 + 2]) < 1e-7;
    }
    if (!same) continue;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let j = 0; j < cols; j++) {
      x += N[k0 + j * 3];
      y += N[k0 + j * 3 + 1];
      z += N[k0 + j * 3 + 2];
    }
    const l = Math.hypot(x, y, z) || 1;
    for (let j = 0; j < cols; j++) {
      N[k0 + j * 3] = x / l;
      N[k0 + j * 3 + 1] = y / l;
      N[k0 + j * 3 + 2] = z / l;
    }
  }
}

/** Flip the triangles */
function flip(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!.array as Uint32Array | Uint16Array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.index!.needsUpdate = true;
  normals(g);
  return g;
}

/** A tube along a curve (a Frenet frame, safe even if the curve points up); giving rad(u) 0 at both ends closes them */
function tubeGeo(pts: THREE.Vector3[], rad: (u: number) => number, o: { segs?: number; radial?: number; closed?: boolean } = {}): THREE.BufferGeometry {
  const closed = !!o.closed;
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  const segs = o.segs ?? 48;
  const radial = o.radial ?? 10;
  const fr = curve.computeFrenetFrames(segs, closed);
  const g = gridGeo(closed ? segs : segs + 1, radial, (i, j) => {
    const u = i / segs;
    const a = (j / radial) * PI * 2;
    const r = rad(u);
    return { p: curve.getPointAt(u).addScaledVector(fr.normals[i], Math.cos(a) * r).addScaledVector(fr.binormals[i], -Math.sin(a) * r) };
  }, { wrapJ: true, wrapI: closed });
  // Winding check: the normal of the first vertex in the middle section must face outward
  const k = Math.floor(segs / 2) * radial;
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, k);
  const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, k);
  if (n.dot(p.sub(curve.getPointAt(Math.floor(segs / 2) / segs))) < 0) flip(g);
  return g;
}

interface Frame {
  C: THREE.Vector3;
  T: THREE.Vector3;
  W: THREE.Vector3;
  H: THREE.Vector3;
}

interface Sweep {
  /** A surface point: t along the curve 0-1, th once around (0 toward W, PI/2 toward H), off outward along the normal */
  S(t: number, th: number, off?: number): THREE.Vector3;
  /** Surface normal (numerical differentiation) */
  N(t: number, th: number): THREE.Vector3;
  F(t: number): Frame;
  geo(segs: number, radial: number, o?: { color?: (t: number, th: number) => THREE.ColorRepresentation; off?: (t: number, th: number) => number; ts?: number[] }): THREE.BufferGeometry;
}

/**
 * Loft along a curve with a superellipse cross-section: prof(t) returns [width radius, height radius, offset toward H, exponent]; an exponent greater than 2 makes the cross-section squarish (flat forehead, square cheeks).
 * It uses the same coordinate system as loft in shapes.ts (W = T × up, H = W × T), and also returns surface points and normals so parts can be placed against the surface.
 */
function sweep(pts: THREE.Vector3[], prof: (t: number) => number[], o: { up?: THREE.Vector3; side?: THREE.Vector3 } = {}): Sweep {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const up = o.up ?? UP;
  const NS = 600;
  const fr: Frame[] = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    const C = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const W = o.side ? o.side.clone().addScaledVector(T, -T.dot(o.side)) : new THREE.Vector3().crossVectors(T, up);
    if (W.lengthSq() < 1e-8) W.set(1, 0, 0);
    W.normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    fr.push({ C, T, W, H });
  }
  const F = (t: number): Frame => {
    const x = THREE.MathUtils.clamp(t, 0, 1) * NS;
    const i = Math.min(NS - 1, Math.floor(x));
    const f = x - i;
    const a = fr[i];
    const b = fr[i + 1];
    return { C: a.C.clone().lerp(b.C, f), T: a.T.clone().lerp(b.T, f).normalize(), W: a.W.clone().lerp(b.W, f).normalize(), H: a.H.clone().lerp(b.H, f).normalize() };
  };
  const raw = (t: number, th: number) => {
    const { C, W, H } = F(t);
    const [w, h, dy = 0, n = 2] = prof(THREE.MathUtils.clamp(t, 0, 1));
    const e = 2 / n;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const x = w * Math.sign(c) * Math.pow(Math.abs(c), e);
    const y = h * Math.sign(s) * Math.pow(Math.abs(s), e) + dy;
    return C.addScaledVector(W, x).addScaledVector(H, y);
  };
  const N = (t: number, th: number) => {
    const d = 1e-3;
    const a = raw(t, th + d).sub(raw(t, th - d));
    const b = raw(Math.min(1, t + d), th).sub(raw(Math.max(0, t - d), th));
    const n = new THREE.Vector3().crossVectors(b, a).normalize();
    if (n.dot(raw(t, th).sub(F(t).C)) < 0) n.negate();
    return n;
  };
  const S = (t: number, th: number, off = 0) => {
    const p = raw(t, th);
    return off ? p.addScaledVector(N(t, th), off) : p;
  };
  const geo: Sweep['geo'] = (segs0, radial, go = {}) => {
    const tc = new THREE.Color();
    // ts: the sample positions along the curve (when given, the even segs0 sampling is not used); the polyline of an engraved groove must fall on sample points
    const ts = go.ts ?? Array.from({ length: segs0 + 1 }, (_, i) => i / segs0);
    const segs = ts.length - 1;
    const g = gridGeo(segs + 1, radial, (i, j) => {
      const t = ts[i];
      const th = (j / radial) * PI * 2;
      return { p: raw(t, th), c: go.color ? tc.set(go.color(t, th)).clone() : undefined };
    }, { wrapJ: true });
    // The t of each row: the skeleton (Bender) uses it to bind vertices to the center line
    g.userData.rowT = ts;
    if (!go.off) return g;
    // Surface relief (grooves, scale plates) is pushed along the grid's own normals, with no need to do numerical differentiation at every point
    const P = g.attributes.position.array as Float32Array;
    const Nn = g.attributes.normal.array as Float32Array;
    for (let i = 1; i < segs; i++)
      for (let j = 0; j < radial; j++) {
        const off = go.off(ts[i], (j / radial) * PI * 2);
        const k = (i * radial + j) * 3;
        P[k] += Nn[k] * off;
        P[k + 1] += Nn[k + 1] * off;
        P[k + 2] += Nn[k + 2] * off;
      }
    normals(g);
    return g;
  };
  return { S, N, F, geo };
}

/** Coons surface: a membrane bounded by four boundaries A(s), B(s) (two bones), I(a) (inner edge) and O(a) (outer edge) */
interface Patch {
  A: (s: number) => THREE.Vector3;
  B: (s: number) => THREE.Vector3;
  I: (a: number) => THREE.Vector3;
  O: (a: number) => THREE.Vector3;
}

function coons(p: Patch, s: number, a: number): THREE.Vector3 {
  const P = p.A(s).multiplyScalar(1 - a).add(p.B(s).multiplyScalar(a)).add(p.I(a).multiplyScalar(1 - s)).add(p.O(a).multiplyScalar(s));
  const c = p.I(0).multiplyScalar((1 - a) * (1 - s)).add(p.I(1).multiplyScalar(a * (1 - s))).add(p.O(0).multiplyScalar((1 - a) * s)).add(p.O(1).multiplyScalar(a * s));
  return P.sub(c);
}

interface MembraneOpts {
  ns: number;
  na: number;
  /** Sample positions along the outer-edge direction (0-1; when given, the even na sampling is not used): the notch in the wing membrane must fall on sample points */
  as?: number[];
  /** Half thickness */
  h: number;
  /** The front direction of the membrane */
  front: THREE.Vector3;
  /** How far the membrane bulges toward the back */
  bulge: (s: number, a: number) => number;
  color: (s: number, a: number) => THREE.Color;
}

/** A membrane with thickness: one Coons surface each for front and back, with the outer edge closed separately by a tube (see membraneRim) */
function membraneGeo(p: Patch, o: MembraneOpts): THREE.BufferGeometry {
  const P: THREE.Vector3[][] = [];
  const C: THREE.Color[][] = [];
  const as = o.as ?? Array.from({ length: o.na + 1 }, (_, j) => j / o.na);
  const na = as.length - 1;
  for (let i = 0; i <= o.ns; i++) {
    P.push([]);
    C.push([]);
    for (let j = 0; j <= na; j++) {
      const s = i / o.ns;
      const a = as[j];
      P[i].push(coons(p, s, a).addScaledVector(o.front, -o.bulge(s, a)));
      C[i].push(o.color(s, a));
    }
  }
  const side = (sg: number) => {
    const g = gridGeo(o.ns + 1, na + 1, (i, j) => ({ p: P[i][j].clone().addScaledVector(o.front, sg * o.h), c: C[i][j] }));
    const k = Math.floor(o.ns / 2) * (na + 1) + Math.floor(na / 2);
    const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, k);
    if (n.dot(o.front) * sg < 0) flip(g);
    return g;
  };
  return mergeGeometries([side(1), side(-1)])!;
}

// ───────────────────────── Skeleton: bending along the center line ─────────────────────────

/** A mesh already bound to a center line: each vertex remembers which t it is at, and its position and normal in the coordinate frame (W, H, T) there */
interface Bound {
  geo: THREE.BufferGeometry;
  t: Float32Array;
  loc: Float32Array;
  nloc: Float32Array;
  p0: Float32Array;
  n0: Float32Array;
}
/** A rigid part that follows the center line (head, wings, the gold band at the tail end, anchors): remembers its position and orientation in the frame at t */
interface Rigid {
  obj: THREE.Object3D;
  t: number;
  lp: THREE.Vector3;
  lq: THREE.Quaternion;
  p0: THREE.Vector3;
  q0: THREE.Quaternion;
}

/**
 * Center-line skeleton: the neck, torso and tail (or one leg) were lofted along a center line in the first place,
 * so each vertex is replaced by "its position in the frame at t on the center line", and when a control point moves the whole body bends along the new center line.
 * The frame in place uses the same system as sweep() (W = T × up, or a given side, H = W × T); the frame after the control points change is turned from the one in place, and when the control points return to place every vertex is restored one by one to its original value, so at rest the shape is completely unchanged.
 * Vertices are changed on the CPU, so the outline's normal channel can see it (it cannot see the vertex shader's animation).
 */
class Bender {
  private readonly N = 240;
  private base: THREE.Vector3[];
  /** The sample points' positions on the curve's native parameter: on the original curve they are at equal arc length, and after the control points change they are taken at the same native parameters, so the vertices follow the control points near them (each segment stretching on its own) */
  private u: Float32Array;
  private side?: THREE.Vector3;
  private bF: Float32Array;
  private dF: Float32Array;
  private bound: Bound[] = [];
  private rigid: Rigid[] = [];
  /** Bound meshes (vertices rewritten on the CPU every frame, so they cannot be merged) and rigid parts that follow along (owners when merging) */
  readonly meshes: THREE.Mesh[] = [];
  get attached(): THREE.Object3D[] {
    return this.rigid.map((r) => r.obj);
  }
  private posed = false;

  constructor(pts: THREE.Vector3[], side?: THREE.Vector3) {
    this.base = pts.map((p) => p.clone());
    this.side = side;
    const c0 = new THREE.CatmullRomCurve3(this.base, false, 'centripetal');
    this.u = new Float32Array(this.N + 1);
    for (let i = 0; i <= this.N; i++) this.u[i] = c0.getUtoTmapping(i / this.N, 0);
    this.bF = this.frames(this.base, new Float32Array((this.N + 1) * 12));
    this.dF = new Float32Array(this.bF);
  }

  /**
   * Take N + 1 frames along the curve, 12 numbers each: C, T, W, H.
   * With ref (the frame in place), W is the W in place turned by the minimal rotation that follows the tangent: when the neck is raised to vertical T × up degenerates and flips left and right, and this avoids that
   */
  private frames(pts: THREE.Vector3[], out: Float32Array, ref?: Float32Array): Float32Array {
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const C = new THREE.Vector3();
    const T = new THREE.Vector3();
    const W = new THREE.Vector3();
    const H = new THREE.Vector3();
    const T0 = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (let i = 0; i <= this.N; i++) {
      c.getPoint(this.u[i], C);
      c.getTangent(this.u[i], T);
      if (ref) {
        const k = i * 12;
        T0.set(ref[k + 3], ref[k + 4], ref[k + 5]);
        W.set(ref[k + 6], ref[k + 7], ref[k + 8]).applyQuaternion(q.setFromUnitVectors(T0, T));
        W.addScaledVector(T, -T.dot(W));
      } else if (this.side) W.copy(this.side).addScaledVector(T, -T.dot(this.side));
      else W.crossVectors(T, UP);
      if (W.lengthSq() < 1e-8) W.set(1, 0, 0);
      W.normalize();
      H.crossVectors(W, T).normalize();
      out.set([C.x, C.y, C.z, T.x, T.y, T.z, W.x, W.y, W.z, H.x, H.y, H.z], i * 12);
    }
    return out;
  }

  /** The frame at t (linearly interpolated between two adjacent samples) */
  private at(F: Float32Array, t: number, C: THREE.Vector3, T: THREE.Vector3, W: THREE.Vector3, H: THREE.Vector3): void {
    const x = THREE.MathUtils.clamp(t, 0, 1) * this.N;
    const i = Math.min(this.N - 1, Math.floor(x));
    const f = x - i;
    const a = i * 12;
    const b = a + 12;
    const l = (k: number) => F[a + k] + (F[b + k] - F[a + k]) * f;
    C.set(l(0), l(1), l(2));
    T.set(l(3), l(4), l(5)).normalize();
    W.set(l(6), l(7), l(8)).normalize();
    H.set(l(9), l(10), l(11)).normalize();
  }

  /** The t nearest to p (for parts that did not record a t, such as cracks and the spurs on the legs) */
  project(p: THREE.Vector3): number {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i <= this.N; i++) {
      const k = i * 12;
      const d = (p.x - this.bF[k]) ** 2 + (p.y - this.bF[k + 1]) ** 2 + (p.z - this.bF[k + 2]) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return bi / this.N;
  }

  /** Bind a mesh: tOf gives each vertex's t (a grid surface uses userData.rowT, one per row), and if not given the nearest point is found */
  bind(mesh: THREE.Mesh, tOf?: (i: number) => number): void {
    this.meshes.push(mesh);
    const geo = mesh.geometry;
    const P = geo.attributes.position as THREE.BufferAttribute;
    const Nn = geo.attributes.normal as THREE.BufferAttribute;
    const n = P.count;
    const rowT = geo.userData.rowT as number[] | undefined;
    const cols = (geo.userData.grid as [number, number] | undefined)?.[1];
    const get = tOf ?? (rowT && cols ? (i: number) => rowT[Math.floor(i / cols)] : undefined);
    const b: Bound = { geo, t: new Float32Array(n), loc: new Float32Array(n * 3), nloc: new Float32Array(n * 3), p0: new Float32Array(P.array as Float32Array), n0: new Float32Array(Nn.array as Float32Array) };
    const C = new THREE.Vector3();
    const T = new THREE.Vector3();
    const W = new THREE.Vector3();
    const H = new THREE.Vector3();
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(P, i);
      const t = get ? get(i) : this.project(p);
      b.t[i] = t;
      this.at(this.bF, t, C, T, W, H);
      p.sub(C);
      b.loc.set([p.dot(W), p.dot(H), p.dot(T)], i * 3);
      q.fromBufferAttribute(Nn, i);
      b.nloc.set([q.dot(W), q.dot(H), q.dot(T)], i * 3);
    }
    this.bound.push(b);
  }

  /** A rigid part follows the frame at t (obj's parent must be in the same coordinate space as the center line) */
  attach(obj: THREE.Object3D, t: number): void {
    const C = new THREE.Vector3();
    const T = new THREE.Vector3();
    const W = new THREE.Vector3();
    const H = new THREE.Vector3();
    this.at(this.bF, t, C, T, W, H);
    const qb = this.basis(T, W, H);
    const inv = qb.clone().invert();
    this.rigid.push({ obj, t, lp: obj.position.clone().sub(C).applyQuaternion(inv), lq: inv.multiply(obj.quaternion), p0: obj.position.clone(), q0: obj.quaternion.clone() });
  }

  private basis(T: THREE.Vector3, W: THREE.Vector3, H: THREE.Vector3): THREE.Quaternion {
    const w = W.clone().addScaledVector(T, -T.dot(W)).normalize();
    const h = new THREE.Vector3().crossVectors(w, T).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(w, T, h));
  }

  /** Switch to a different set of control points (null = back in place, the vertices restored one by one) */
  pose(pts: THREE.Vector3[] | null): void {
    if (!pts) {
      if (!this.posed) return;
      this.posed = false;
      for (const b of this.bound) {
        (b.geo.attributes.position.array as Float32Array).set(b.p0);
        (b.geo.attributes.normal.array as Float32Array).set(b.n0);
        b.geo.attributes.position.needsUpdate = true;
        b.geo.attributes.normal.needsUpdate = true;
        b.geo.computeBoundingSphere();
      }
      for (const r of this.rigid) {
        r.obj.position.copy(r.p0);
        r.obj.quaternion.copy(r.q0);
      }
      return;
    }
    this.posed = true;
    this.frames(pts, this.dF, this.bF);
    const C = new THREE.Vector3();
    const T = new THREE.Vector3();
    const W = new THREE.Vector3();
    const H = new THREE.Vector3();
    for (const b of this.bound) {
      const P = b.geo.attributes.position.array as Float32Array;
      const Nn = b.geo.attributes.normal.array as Float32Array;
      for (let i = 0; i < b.t.length; i++) {
        this.at(this.dF, b.t[i], C, T, W, H);
        const k = i * 3;
        const x = b.loc[k];
        const y = b.loc[k + 1];
        const z = b.loc[k + 2];
        P[k] = C.x + W.x * x + H.x * y + T.x * z;
        P[k + 1] = C.y + W.y * x + H.y * y + T.y * z;
        P[k + 2] = C.z + W.z * x + H.z * y + T.z * z;
        const nx = b.nloc[k];
        const ny = b.nloc[k + 1];
        const nz = b.nloc[k + 2];
        Nn[k] = W.x * nx + H.x * ny + T.x * nz;
        Nn[k + 1] = W.y * nx + H.y * ny + T.y * nz;
        Nn[k + 2] = W.z * nx + H.z * ny + T.z * nz;
      }
      b.geo.attributes.position.needsUpdate = true;
      b.geo.attributes.normal.needsUpdate = true;
      b.geo.computeBoundingSphere();
    }
    for (const r of this.rigid) {
      this.at(this.dF, r.t, C, T, W, H);
      const qb = this.basis(T, W, H);
      r.obj.position.copy(r.lp).applyQuaternion(qb).add(C);
      r.obj.quaternion.copy(qb).multiply(r.lq);
    }
  }
}

/** Weighting of several sets of control points: base + Σ w(pose − base) */
function blendPts(base: THREE.Vector3[], poses: [THREE.Vector3[], number][], out: THREE.Vector3[]): THREE.Vector3[] {
  for (let i = 0; i < base.length; i++) {
    out[i].copy(base[i]);
    for (const [p, w] of poses) {
      if (!w) continue;
      out[i].x += (p[i].x - base[i].x) * w;
      out[i].y += (p[i].y - base[i].y) * w;
      out[i].z += (p[i].z - base[i].z) * w;
    }
  }
  return out;
}

// ───────────────────────── Shape ─────────────────────────

export function buildEldarinLab(): LabModel {
  const RIMC = 0xffe6b0;
  const SKIN = new THREE.Color(0xf2f1ed);
  const BELLY = new THREE.Color(0xf3e1bb);
  const MEMB_IN = new THREE.Color(0xeccb84);
  const MEMB_OUT = new THREE.Color(0xf8ecd2);
  const STAIN = new THREE.Color(0x9c8aa6);
  const HORN_TIP = new THREE.Color(0xd9ac50);
  const CREST = new THREE.Color(0xe3bb62);
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    skin: labToon(SKIN, { rim: 0.7, rimColor: RIMC }),
    skinV: vc(labToon(0xffffff, { rim: 0.7, rimColor: RIMC })),
    belly: labToon(BELLY, { rim: 0.5, rimColor: RIMC }),
    memb: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    membEdge: labToon(MEMB_OUT, { rim: 0.55, rimColor: RIMC }),
    vein: labToon(0xdcb25e, { rim: 0.4, rimColor: RIMC }),
    horn: vc(labToon(0xffffff, { spec: 0.7, specTh: 0.97, rim: 0.6, rimColor: RIMC })),
    gold: labToon(0xe8b64a, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    sealGold: labToon(0xf0c254, { ramp: 'metal', emissive: 0xffa820, emissiveAmt: 0.16, spec: 1.5, specTh: 0.9, rim: 0.5 }),
    sealGem: labToon(0xfff2c2, { ramp: 'gem', emissive: 0xffc23a, emissiveAmt: 0.6, spec: 1.4, specTh: 0.88, rim: 0.4 }),
    claw: labToon(0x6c5644, { spec: 0.9, specTh: 0.975, rim: 0.4, rimColor: RIMC }),
    // Eye: one whole sheet of amber-gold iris (vertex colors only darken top and bottom), with a little emissive
    eye: vc(labToon(0xf0a832, { ramp: 'gem', emissive: 0x9a5a08, emissiveAmt: 0.18, rim: 0 })),
    pupil: labToon(0x22110a, { rim: 0 }),
    line: labToon(0x44302a, { rim: 0 }),
    nostril: labToon(0x6a5040, { rim: 0 }),
    // Mouth interior (seen only when the mouth is open)
    mouth: labToon(0x6a2026, { rim: 0 }),
    tongue: labToon(0xb8505a, { rim: 0.2, rimColor: RIMC }),
    tooth: labToon(0xfaf3e2, { spec: 0.6, specTh: 0.96, rim: 0.3, rimColor: RIMC }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'eldarin-lab';
  const { add, group } = partKit();
  const BODY = 9301;
  const HEAD = 9302;

  // Body (rising and falling slightly with breathing); the four feet hang directly on root, so they stand firmly on the ground
  const body = group(root);

  // ── Neck, torso, tail: one whole loft. The neck runs from under the head down to the deep chest, the waist narrow and the rump round, the tail dragging on the ground and curling back toward the front left with the end slightly upturned ──
  const spine = [
    v(0, 1.08, 0.42), v(0, 0.98, 0.4), v(0, 0.86, 0.33), v(0, 0.74, 0.22), v(0, 0.64, 0.07), v(0, 0.6, -0.12), v(0, 0.61, -0.32),
    v(0, 0.56, -0.5), v(0.02, 0.42, -0.66), v(0.08, 0.24, -0.8), v(0.22, 0.1, -0.89), v(0.42, 0.07, -0.83), v(0.56, 0.1, -0.64), v(0.6, 0.22, -0.48),
  ];
  const tProf = curveTable([
    // The top of the neck does not close to a sharp cone: it is thick from the start, with a blunt head buried under the back of the skull (closed to a sharp cone, the neck and head would touch at only a point, and from the side the head looks to float on the neck)
    [0, 0, 0, 0],
    [0.004, 0.068, 0.07, 0],
    [0.014, 0.085, 0.09, 0],
    [0.04, 0.092, 0.1, 0],
    [0.1, 0.098, 0.105, -0.006],
    [0.16, 0.13, 0.15, -0.025],
    [0.22, 0.195, 0.22, -0.045],
    [0.28, 0.205, 0.22, -0.03],
    [0.34, 0.172, 0.18, -0.005],
    [0.4, 0.18, 0.175, 0],
    [0.46, 0.13, 0.125, 0],
    [0.55, 0.085, 0.08, 0],
    [0.66, 0.064, 0.058, 0],
    [0.76, 0.05, 0.044, 0],
    [0.86, 0.038, 0.034, 0],
    [0.94, 0.028, 0.025, 0],
    [0.985, 0.016, 0.014, 0],
    [1, 0, 0, 0],
  ]);
  const tor = sweep(spine, tProf);
  /** Left and right of the torso: θ = 0 toward +x; sx = 1 is the left (+x) and -1 the right */
  const torTh = (sx: number, lat: number) => (sx > 0 ? lat : PI - lat);
  // An old crack mended with gold on the right shoulder blade (the same wound as the tear in the right wing), with gray-purple old marks around it
  const cracks: [number, number][][] = [
    [[0.21, 1.66], [0.228, 1.9], [0.246, 1.82], [0.266, 2.08], [0.288, 1.98], [0.31, 2.24], [0.33, 2.14], [0.35, 2.4], [0.366, 2.34], [0.38, 2.56]],
    [[0.266, 2.08], [0.278, 2.32], [0.29, 2.5], [0.3, 2.62]],
    [[0.288, 1.98], [0.306, 1.82], [0.324, 1.74], [0.34, 1.66]],
  ];
  const TS = 2.6;
  const scarAt = (t: number, th: number) => {
    const d = Math.min(...cracks.map((l) => polyDist(t * TS, th * 0.2, l.map(([a, b]) => [a * TS, b * 0.2] as [number, number]))));
    return Math.exp(-(d * d) / 0.0024);
  };
  // Skeleton: the neck, torso and tail are all bound to the same center line (the action weights change the control points and the whole body bends along)
  const spineB = new Bender(spine);
  const torso = add(body, tor.geo(90, 28, { color: (t, th) => SKIN.clone().lerp(HORN_TIP, 0.55 * THREE.MathUtils.smoothstep(t, 0.8, 0.97)).lerp(STAIN, 0.75 * scarAt(t, th)) }), M.skinV);
  torso.userData.inkGroup = BODY;
  spineB.bind(torso);
  cracks.forEach((l, li) => {
    const pts = l.map(([t, th]) => tor.S(t, th, 0.0005));
    const r = li === 0 ? 0.0042 : 0.0032;
    spineB.bind(add(body, tubeGeo(pts, (u) => r * Math.min(1, u * 12 + (li ? 0.7 : 0), (1 - u) * 12), { segs: 6 * l.length, radial: 8 }), M.gold));
  });

  // ── Belly plates: a whole sheet of thick cream shell from the throat to the middle of the tail, the transverse grooves, section by section, pressed in (one part, not stacked armor plates) ──
  {
    const T0 = 0.02;
    const T1 = 0.6;
    const half = curveTable([[0, 0.8], [0.14, 0.85], [0.22, 0.74], [0.3, 0.56], [0.42, 0.56], [0.5, 0.82], [0.6, 0.8]]);
    const DT = 0.0165;
    // Face-count budget: each groove takes the groove bottom and the polyline points on both sides, then one more row outward on each side (originally 520 rows evenly sampled).
    // The row outside the polyline cannot be omitted: when a section has only one cell left, the vertex normals average the groove's slopes into the whole section face, the corner disappears, and the outline cannot draw the groove
    const uMax = (T1 - T0) / DT;
    const us: number[] = [];
    for (let m = 0; m <= Math.floor(uMax); m++) for (const d of [-0.143, -0.075, 0, 0.075, 0.143]) if (m + d >= 0 && m + d < uMax) us.push(m + d);
    us.push(uMax);
    const rowT = uniq(us).map((u) => T0 + u * DT);
    const NR = rowT.length - 1;
    const NC = 12;
    // First take surface points of the torso under the shell, with normals computed from the difference between adjacent points (cheap), then pad out the shell's thickness and the grooves along the normals
    const base: THREE.Vector3[][] = [];
    const nrm: THREE.Vector3[][] = [];
    for (let i = 0; i <= NR; i++) {
      const t = rowT[i];
      const e = half(t)[0];
      base.push(Array.from({ length: NC + 1 }, (_, j) => tor.S(t, -PI / 2 + e * ((2 * j) / NC - 1))));
    }
    for (let i = 0; i <= NR; i++) {
      const C = tor.F(rowT[i]).C;
      nrm.push(base[i].map((p, j) => {
        const a = base[Math.min(NR, i + 1)][j].clone().sub(base[Math.max(0, i - 1)][j]);
        const b = base[i][Math.min(NC, j + 1)].clone().sub(base[i][Math.max(0, j - 1)]);
        const n = new THREE.Vector3().crossVectors(a, b).normalize();
        return n.dot(p.clone().sub(C)) < 0 ? n.negate() : n;
      }));
    }
    const geo = gridGeo(NR + 3, NC + 3, (ii, jj) => {
      const wall = ii === 0 || ii === NR + 2 || jj === 0 || jj === NC + 2;
      const i = THREE.MathUtils.clamp(ii - 1, 0, NR);
      const j = THREE.MathUtils.clamp(jj - 1, 0, NC);
      const t = rowT[i];
      const u = (t - T0) / DT;
      const d = Math.abs(u - Math.round(u));
      // Narrow and steep V-shaped grooves: the outline draws each groove as one clean polyline, and the shading is not cut into blocks by shallow grooves
      const edgeFade = THREE.MathUtils.smoothstep(Math.min(j, NC - j) / NC, 0.02, 0.07);
      const g = Math.max(0, 1 - d / 0.075) * edgeFade;
      const k = Math.min(1, tProf(t)[0] / 0.1);
      const off = wall ? -0.012 : (0.012 - 0.0065 * g) * k;
      return { p: base[i][j].clone().addScaledVector(nrm[i][j], off) };
    });
    geo.userData.rowT = Array.from({ length: NR + 3 }, (_, ii) => rowT[THREE.MathUtils.clamp(ii - 1, 0, NR)]);
    spineB.bind(add(body, geo, M.belly));
  }

  // ── Dorsal fin: one whole continuous fin from the back of the head along the neck and back to the tail end, the upper edge a wave held up by spines slanting backward one by one, the tail end growing into a leaf-shaped tail fin ──
  /** A fin growing along the top line of the loft: hFn is the height, K is the density of the spine count, and lean is the backward slant direction (the sign along T) */
  const crestGeo = (sw: Sweep, t0: number, t1: number, hFn: (t: number) => number, K: number, lean: number, thick: number, lobe?: (t: number) => number, o: { phase?: number; dense?: [number, number] } = {}) => {
    // Face-count budget: the sample points along the spine are placed at the valley, the two sides and the tip of each fin spine (6 points per spine, originally about 22 rows evenly sampled per spine);
    // the dense section (the tail fin) and the closures at the two ends keep the original density; the cross-section points are concentrated on the outer side of the fin
    const ph = o.phase ?? 0;
    const ts: number[] = [t0, t1];
    for (let m = Math.floor(t0 * K) - 1; m <= Math.ceil(t1 * K) + 1; m++)
      for (const f of [0, 0.2, 0.35, 0.5, 0.65, 0.8]) ts.push((m + f - ph) / K);
    for (const e of [0.004, 0.008, 0.012, 0.0167]) ts.push(t0 + e, t1 - e);
    if (o.dense) for (let t = o.dense[0]; t <= o.dense[1]; t += 0.006) ts.push(t);
    const rowT = uniq(ts.filter((t) => t >= t0 && t <= t1));
    const NR = rowT.length - 1;
    const half = [1, 0.88, 0.62, 0.32, 0, -0.6, -1].map((c) => Math.acos(c));
    const ring = [...half, ...half.slice(1, -1).reverse().map((a) => PI * 2 - a)];
    const NC = ring.length;
    const tc = new THREE.Color();
    // Compute each row's top-line point and normal only once
    const rows = rowT.map((t) => ({ f: sw.F(t), top: sw.S(t, PI / 2, -0.012), n: sw.N(t, PI / 2) }));
    const cg = gridGeo(NR + 1, NC, (i, j) => {
      const t = rowT[i];
      const { f, n } = rows[i];
      const top = rows[i].top.clone();
      const a = ring[j];
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      // Both ends close to a point, so the fin's cross-section leaves no opening at the tail tip
      const endK = Math.min(1, (t1 - t) * 60, (t - t0) * 60);
      const ch = endK * (cs > 0 ? cs * (hFn(t) + 0.012) : cs * (0.012 + (lobe ? lobe(t) : 0)));
      const tk = endK * thick * (1 - 0.8 * Math.max(0, cs)) * Math.min(1, (t1 - t) * 30 + 0.2);
      const p = top.addScaledVector(n, ch).addScaledVector(f.W, sn * tk).addScaledVector(f.T, lean * Math.max(0, ch));
      tc.copy(SKIN).lerp(CREST, THREE.MathUtils.smoothstep(ch, 0.006, 0.04));
      return { p, c: tc.clone() };
    }, { wrapJ: true });
    cg.userData.rowT = rowT;
    return cg;
  };
  {
    const hC = curveTable([[0, 0.012], [0.04, 0.034], [0.1, 0.045], [0.17, 0.038], [0.22, 0.028], [0.3, 0.032], [0.4, 0.046], [0.5, 0.04], [0.7, 0.03], [0.86, 0.028], [0.905, 0.06], [0.95, 0.105], [0.985, 0.06], [1, 0]]);
    const K = 20;
    const hFn = (t: number) => {
      const w = 1 - Math.abs(2 * ((t * K) % 1) - 1);
      const scal = t < 0.87 ? 0.45 + 0.55 * Math.pow(w, 1.6) : 1;
      return hC(t)[0] * 1.35 * scal;
    };
    const lobe = (t: number) => 0.06 * THREE.MathUtils.smoothstep(t, 0.9, 0.95) * (1 - THREE.MathUtils.smoothstep(t, 0.985, 1));
    const crest = add(body, crestGeo(tor, 0.03, 1, hFn, K, 0.55, 0.009, lobe, { dense: [0.86, 1] }), M.skinV);
    crest.userData.inkGroup = BODY;
    spineB.bind(crest);
  }

  // The gold band before the end of the tail
  {
    const f = tor.F(0.9);
    const g = group(body, f.C.toArray() as [number, number, number]);
    g.quaternion.setFromUnitVectors(UP, f.T);
    const r = tProf(0.9)[0];
    add(g, lathe([[r * 0.95, -0.014], [r * 1.12, -0.011], [r * 1.18, 0], [r * 1.12, 0.011], [r * 0.95, 0.014]], 20), M.gold);
    spineB.attach(g, 0.9);
  }

  // ── Limbs: stout, the elbows out; the forelegs straight holding up the deep chest, the hind thighs forward and the hock backward; big three-toed feet and dark claws ──
  // The whole foot is put in one group (origin at the center of the foot), so when lying down or lifting a foot the whole foot moves together
  // The left and right toes (and two claws) flank the middle one, their gaps hidden by the middle one, so they can go in the same batch when merging
  const sideToes: THREE.Object3D[][] = [];
  const foot = (x: number, z: number, len: number): THREE.Group => {
    const fg = group(root, [x, 0.05, z]);
    add(fg, new THREE.SphereGeometry(1, 14, 10), M.skin, [0, 0, 0], [0, 0, 0], [0.09, 0.054, 0.1]).userData.inkGroup = BODY;
    const toes: THREE.Object3D[] = [];
    const claws: THREE.Object3D[] = [];
    for (let i = -1; i <= 1; i++) {
      const yaw = i * 0.4;
      const d = v(Math.sin(yaw), 0, Math.cos(yaw));
      const P = (k: number, y: number) => v(d.x * k, y - 0.05, d.z * k);
      const toe = add(fg, loft([P(0.0, 0.04), P(len * 0.55, 0.036), P(len, 0.032)], curveTable([[0, 0, 0], [0.12, 0.033, 0.03], [0.7, 0.029, 0.027], [1, 0.024, 0.022]]), { segs: 8, radial: 8, side: v(d.z, 0, -d.x) }), M.skin);
      const claw = add(fg, loft([P(len - 0.005, 0.032), P(len + 0.034, 0.027), P(len + 0.056, 0.006)], curveTable([[0, 0.02, 0.022], [0.5, 0.014, 0.016], [1, 0, 0]]), { segs: 6, radial: 6, side: v(d.z, 0, -d.x) }), M.claw);
      if (i) toes.push(toe), claws.push(claw);
    }
    sideToes.push(toes, claws);
    return fg;
  };
  /** Leg: from s0 down the front of the loft (θ = 3PI/2), cream scale plates one section after another, the grooves pressed in, done the same way as the belly plates */
  const legGeo = (pts: THREE.Vector3[], prof: (t: number) => number[], s0: number) => {
    const sw = sweep(pts, prof, { side: X });
    const DT = 0.05;
    const win = (t: number, th: number) => {
      const d = Math.abs(Math.atan2(Math.sin(th - 1.5 * PI), Math.cos(th - 1.5 * PI)));
      return (1 - THREE.MathUtils.smoothstep(d, 0.72, 0.86)) * THREE.MathUtils.smoothstep(t, s0, s0 + 0.02) * (1 - THREE.MathUtils.smoothstep(t, 0.95, 0.975));
    };
    // Face-count budget: above the knee one row every 0.04; for the scale-plate section each groove takes the groove bottom and the two sides (originally 64 rows evenly sampled, with the grooves falling between rows)
    const ts: number[] = [];
    for (let t = 0; t < s0; t += 0.05) ts.push(t);
    for (let m = 0; s0 + m * DT <= 1; m++) for (const d of [-0.24, 0, 0.24]) ts.push(s0 + (m + d) * DT);
    ts.push(0.95, 0.975, 1);
    return sw.geo(0, 18, {
      ts: uniq(ts.filter((t) => t >= 0 && t <= 1)),
      color: (t, th) => SKIN.clone().lerp(BELLY, 0.7 * win(t, th)),
      off: (t, th) => {
        const u = (t - s0) / DT;
        const d = Math.abs(u - Math.round(u));
        const g = d < 0.24 ? 0.5 + 0.5 * Math.cos((PI * d) / 0.24) : 0;
        return win(t, th) * (0.008 - 0.009 * g);
      },
    });
  };
  /** A short horny spur behind the elbow and the hock */
  const spur = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    add(root, loft([a, b, c], curveTable([[0, 0.018, 0.02], [0.45, 0.014, 0.015], [1, 0, 0]]), { segs: 10, radial: 8 }), M.claw);
  /** One leg: its own center-line skeleton (control points = the five points of the loft), the foot group, and the position of the foot's center relative to the end of the leg */
  interface Limb {
    sx: number;
    front: boolean;
    b: Bender;
    pts: THREE.Vector3[];
    cur: THREE.Vector3[];
    foot: THREE.Group;
    off: THREE.Vector3;
  }
  const limbs: Limb[] = [];
  const limb = (sx: number, front: boolean, pts: THREE.Vector3[], prof: (t: number) => number[], s0: number, fx: number, fz: number, sp: THREE.Vector3[]) => {
    const b = new Bender(pts, X);
    const m = add(root, legGeo(pts, prof, s0), M.skinV);
    m.userData.inkGroup = BODY;
    b.bind(m);
    if (sp.length) b.bind(spur(sp[0], sp[1], sp[2]));
    const fg = foot(fx, fz, 0.12);
    limbs.push({ sx, front, b, pts, cur: pts.map((p) => p.clone()), foot: fg, off: fg.position.clone().sub(pts[4]) });
  };
  for (const sx of [-1, 1]) {
    const fz = sx > 0 ? 0.05 : 0;
    limb(sx, true, [v(sx * 0.07, 0.66, 0.15 + fz * 0.3), v(sx * 0.16, 0.54, 0.16 + fz * 0.5), v(sx * 0.235, 0.34, 0.1 + fz), v(sx * 0.215, 0.14, 0.19 + fz), v(sx * 0.215, 0.075, 0.24 + fz)],
      curveTable([[0, 0, 0], [0.05, 0.1, 0.11], [0.2, 0.118, 0.128], [0.45, 0.082, 0.09], [0.75, 0.066, 0.072], [1, 0.062, 0.066]]), 0.5,
      sx * 0.215, 0.26 + fz, [v(sx * 0.24, 0.37, 0.07 + fz), v(sx * 0.25, 0.36, 0.0 + fz), v(sx * 0.255, 0.385, -0.045 + fz)]);
    limb(sx, false, [v(sx * 0.07, 0.64, -0.3), v(sx * 0.17, 0.52, -0.24), v(sx * 0.215, 0.34, -0.15), v(sx * 0.21, 0.17, -0.4), v(sx * 0.21, 0.075, -0.35)],
      curveTable([[0, 0, 0], [0.04, 0.11, 0.13], [0.18, 0.148, 0.168], [0.4, 0.09, 0.1], [0.62, 0.068, 0.076], [1, 0.062, 0.066]]), 0.66,
      sx * 0.21, -0.32, []);
  }

  // ── Wings: raised half open, the wing surface facing forward and outward; the wing bone is a loft (shoulder, elbow, wrist), a thumb claw on the wrist, and three wing fingers spreading the pale gold membrane ──
  // The wing hangs on the torso skeleton (the frame at the chest section), so when lying down or rearing up it goes with the body; wg is its own motion (spreading, folding, breathing)
  const wings: { g: THREE.Group; b: THREE.Group; sx: number; sh: THREE.Group; tip: THREE.Group }[] = [];
  const WING = 9310;
  for (const sx of [-1, 1]) {
    const S0 = v(sx * 0.08, 0.74, 0.04);
    const wa = group(body, S0.toArray() as [number, number, number]);
    spineB.attach(wa, 0.34);
    const wr = group(wa);
    const U = v(sx * 0.78, 0, -0.62).normalize();
    const V = v(0, 0.96, -0.28).normalize();
    const Nf = new THREE.Vector3().crossVectors(U, V).normalize();
    if (Nf.z < 0) Nf.negate();
    // The axes of wb are aligned to the wing surface (span, height, front): when folding it shortens along the span and height, like drawing the wing fingers together; wg cancels wb's rotation, and the parts are placed in their original coordinates
    const qB = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(U, new THREE.Vector3().crossVectors(Nf, U), Nf));
    const wb = group(wr);
    wb.quaternion.copy(qB);
    const wg = group(wb);
    wg.quaternion.copy(qB).invert();
    /** A point on the wing surface (relative to the shoulder): u along the span, v up, w along the front */
    const L = (u: number, vv: number, w = 0) => U.clone().multiplyScalar(u).addScaledVector(V, vv).addScaledVector(Nf, w);
    const Sh = L(0, 0);
    const El = L(0.2, 0.1, -0.01);
    const Wr = L(0.34, 0.5, 0.0);
    const tips = [L(0.6, 0.74, -0.04), L(0.8, 0.4, -0.05), L(0.7, 0.04, -0.04)];
    wings.push({ g: wr, b: wb, sx, sh: group(wg), tip: group(wg, tips[1].toArray() as [number, number, number]) });
    const At = L(0.12, -0.1, 0.02);
    // Wing fingers: wrist to fingertip, bowing slightly toward the back in the middle
    const fingers = tips.map((tp) => {
      const mid = Wr.clone().lerp(tp, 0.5).addScaledVector(Nf, -0.025);
      return new THREE.CatmullRomCurve3([Wr.clone(), mid, tp.clone()], false, 'centripetal');
    });
    const arm = new THREE.CatmullRomCurve3([Wr.clone(), El.clone(), Sh.clone()], false, 'centripetal');
    const attach = new THREE.CatmullRomCurve3([Sh.clone(), Sh.clone().lerp(At, 0.5).addScaledVector(Nf, -0.01), At.clone()], false, 'centripetal');
    const scallop = (a: THREE.Vector3, b: THREE.Vector3, toward: THREE.Vector3, depth: number, notch?: (u: number) => number) => (u: number) => {
      const p = a.clone().lerp(b, u);
      const d = toward.clone().sub(p).normalize();
      return p.addScaledVector(d, depth * Math.sin(PI * u) + (notch ? notch(u) : 0));
    };
    // The trailing edge of the second membrane of the right wing (sx = -1) has a tear
    const scar = sx < 0;
    const NOTCH_A = 0.47;
    const notch = scar ? (u: number) => 0.045 * Math.max(0, 1 - Math.abs(u - NOTCH_A) / 0.035) : undefined;
    const panels: Patch[] = [
      { A: (s) => fingers[0].getPointAt(s), B: (s) => fingers[1].getPointAt(s), I: () => Wr.clone(), O: scallop(tips[0], tips[1], Wr, 0.07) },
      { A: (s) => fingers[1].getPointAt(s), B: (s) => fingers[2].getPointAt(s), I: () => Wr.clone(), O: scallop(tips[1], tips[2], Wr, 0.07, notch) },
      { A: (s) => fingers[2].getPointAt(s), B: (s) => attach.getPointAt(s), I: (a) => arm.getPointAt(a), O: scallop(tips[2], At, El, 0.06) },
    ];
    const H = 0.0045;
    const tc = new THREE.Color();
    // The tear: a zigzag line on the membrane (in the second membrane's s, a coordinates)
    const tears: [number, number][][] = [
      [[0.24, 0.5], [0.33, 0.58], [0.42, 0.5], [0.52, 0.6], [0.62, 0.49], [0.72, 0.56], [0.82, 0.45], [0.91, 0.52], [1.0, NOTCH_A]],
      [[0.52, 0.6], [0.58, 0.7], [0.66, 0.74], [0.72, 0.84]],
      [[0.62, 0.49], [0.68, 0.38], [0.74, 0.33]],
    ];
    const stain = (s: number, a: number) => {
      const d = Math.min(...tears.map((l) => polyDist(s, a, l, 1.4)));
      return Math.exp(-(d * d) / 0.016);
    };
    /** How far the membrane bulges toward the back */
    const bul = (s: number, a: number) => 0.028 * Math.sin(PI * a) * Math.sin(PI * Math.min(1, s * 0.9));
    for (let k = 0; k < panels.length; k++) {
      const p = panels[k];
      // Face-count budget: the front and back of the membrane are each 10 × 10 cells (originally 40 × 40); the one with the tear is densified along the outer edge, with the tips of the notch falling on sample points
      const scarP = scar && k === 1;
      const as = scarP ? uniq([...Array.from({ length: 21 }, (_, j) => j / 20), ...[-0.035, -0.0175, 0, 0.0175, 0.035].map((d) => NOTCH_A + d)]) : undefined;
      const mg = membraneGeo(p, {
        ns: scarP ? 16 : 10,
        na: 10,
        as,
        h: H,
        front: Nf,
        bulge: bul,
        color: (s, a) => {
          tc.copy(MEMB_IN).lerp(MEMB_OUT, THREE.MathUtils.smoothstep(s, 0.15, 0.95));
          if (scar && k === 1) tc.lerp(STAIN, 0.62 * stain(s, a));
          return tc.clone();
        },
      });
      add(wg, mg, M.memb).userData.inkGroup = WING + k;
      // The outer edge is closed with a thin tube
      const rimPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 48; i++) rimPts.push(p.O(i / 48).addScaledVector(Nf, -0.028 * Math.sin((PI * i) / 48) * Math.sin(PI * 0.9)));
      add(wg, tubeGeo(rimPts, () => H, { segs: scar && k === 1 ? 56 : 28, radial: 5 }), M.membEdge).userData.inkGroup = WING + k;
      // Wing vein: a slightly raised vein down the middle of each membrane
      if (k < 2) {
        const vp: THREE.Vector3[] = [];
        const va = scar && k === 1 ? 0.22 : 0.5;
        for (let i = 0; i <= 10; i++) {
          const s = 0.06 + (i / 10) * 0.74;
          vp.push(coons(p, s, va).addScaledVector(Nf, -bul(s, va)));
        }
        add(wg, tubeGeo(vp, (u) => (H + 0.002) * Math.min(1, (1 - u) * 6 + 0.25) * Math.min(1, u * 12), { segs: 14, radial: 6 }), M.vein).userData.inkGroup = WING + k;
      }
      // The gold-mended tear
      if (scar && k === 1) {
        tears.forEach((l, li) => {
          const sp = l.map(([s, a]) => coons(p, s, a).addScaledVector(Nf, -bul(s, a)));
          const r = li === 0 ? H + 0.0036 : H + 0.0026;
          add(wg, tubeGeo(sp, (u) => r * Math.min(1, u * 14 + (li ? 0.7 : 0), (1 - u) * 14 + (li ? 0 : 0.6)), { segs: 6 * l.length, radial: 8 }), M.gold);
        });
      }
    }
    // Wing bone: shoulder, elbow, wrist as one loft, bulging at the joints
    add(wg, loft([Sh.clone().addScaledVector(U, -0.03), Sh, El, Wr.clone().lerp(El, 0.35), Wr, Wr.clone().addScaledVector(V, 0.03)],
      curveTable([[0, 0, 0], [0.06, 0.03, 0.03], [0.3, 0.03, 0.03], [0.42, 0.038, 0.036], [0.6, 0.024, 0.024], [0.88, 0.032, 0.03], [1, 0, 0]]), { segs: 28, radial: 10, side: Nf }), M.skin).userData.inkGroup = BODY;
    for (const f of fingers) {
      const fp = [0, 0.33, 0.66, 1].map((u) => f.getPointAt(u));
      add(wg, loft(fp, curveTable([[0, 0.022, 0.022], [0.08, 0.019, 0.019], [0.6, 0.012, 0.012], [0.95, 0.006, 0.006], [1, 0, 0]]), { segs: 16, radial: 8, side: Nf }), M.skin).userData.inkGroup = BODY;
    }
    // The thumb claw on the wrist
    add(wg, loft([Wr.clone().addScaledVector(V, 0.02), Wr.clone().addScaledVector(V, 0.055).addScaledVector(Nf, 0.015), Wr.clone().addScaledVector(V, 0.075).addScaledVector(Nf, 0.04).addScaledVector(U, -0.01)],
      curveTable([[0, 0.014, 0.014], [0.5, 0.01, 0.01], [1, 0, 0]]), { segs: 10, radial: 8 }), M.claw);
  }

  // ── Head: the pivot at the top of the neck handles looking around; the chin slightly tucked, the forehead facing forward ──
  const PITCH = 0.17;
  // Top of the neck: follows the very front end of the torso skeleton. neckF is the frame at the top of the neck (not in the scene); when the head is raised, roars or rears up, the head turns with the neck,
  // and the angle at which the neck joins in from behind and below the head does not change (if the neck pushed up from directly beneath, the round end of the neck would show); when asleep a directly given orientation is used instead, with the head resting on the ground
  const neckTop = group(body, [0, 1.08, 0.42]);
  const neckF = new THREE.Object3D();
  neckF.position.copy(neckTop.position);
  spineB.attach(neckF, 0);
  const headPivot = group(neckTop);
  const head = group(headPivot, [0, 0.045, 0.075], [PITCH, 0, 0]);
  head.scale.setScalar(1.42);
  const hPts = [v(0, 0.05, -0.13), v(0, 0.055, -0.05), v(0, 0.035, 0.04), v(0, 0.008, 0.103), v(0, -0.008, 0.155), v(0, -0.018, 0.195)];
  const hProf = curveTable([
    [0, 0, 0, 0, 2],
    [0.05, 0.07, 0.07, 0, 2.2],
    [0.17, 0.103, 0.095, 0, 2.5],
    [0.32, 0.112, 0.09, -0.005, 2.7],
    [0.46, 0.092, 0.074, -0.012, 2.7],
    [0.6, 0.082, 0.064, -0.014, 2.6],
    [0.78, 0.078, 0.059, -0.012, 2.5],
    [0.92, 0.071, 0.053, -0.01, 2.3],
    [0.975, 0.055, 0.041, -0.007, 2],
    [1, 0, 0, 0, 2],
  ]);
  const hd = sweep(hPts, hProf);
  /** Left and right of the head: W points to -x, so θ = 0 is the right (-x) */
  const hTh = (sx: number, lat: number) => (sx > 0 ? PI - lat : lat);
  const hLat = (th: number) => {
    const a = Math.atan2(Math.sin(th), Math.cos(th));
    return a > PI / 2 ? PI - a : a < -PI / 2 ? -PI - a : a;
  };
  // Mouth line: the lower jaw is cream, and the mouth line follows the boundary back, hooking up at the front and below the eye
  const MOUTH_T = 0.47;
  const mouthLat = curveTable([[0.44, -0.12], [MOUTH_T, -0.2], [0.52, -0.34], [0.7, -0.4], [0.9, -0.38], [1, -0.36]]);
  const jaw = (t: number, th: number) => {
    const lat = hLat(th);
    const m = mouthLat(t)[0];
    return THREE.MathUtils.smoothstep(t, MOUTH_T - 0.02, MOUTH_T + 0.03) * THREE.MathUtils.smoothstep(m - lat, -0.02, 0.02);
  };
  // The head mesh: the same surface as hd.geo(56, 40), only with the columns of each row shifted slightly so the left and right mouth lines each land on a column;
  // from the corner of the mouth to the muzzle tip, the two columns of the mouth line are each copied once, so the lower jaw (the lower half of the ring between the two mouth lines) can open about the pivot at the corner of the mouth (act.roar, act.speak)
  const HR = 56;
  const HC = 40;
  const JL = 22;
  const JR = 38;
  const uL = (JL / HC) * PI * 2;
  const uR = (JR / HC) * PI * 2;
  const colTh = (t: number, j: number) => {
    const u = (j / HC) * PI * 2;
    const k = THREE.MathUtils.smoothstep(t, 0.3, 0.44);
    const m = mouthLat(t)[0];
    const thL = THREE.MathUtils.lerp(uL, PI - m, k);
    const thR = THREE.MathUtils.lerp(uR, PI * 2 + m, k);
    if (u <= uL) return (u / uL) * thL;
    if (u <= uR) return thL + ((u - uL) / (uR - uL)) * (thR - thL);
    return thR + ((u - uR) / (PI * 2 - uR)) * (PI * 2 - thR);
  };
  const CUT0 = Math.ceil(MOUTH_T * HR);
  const headMesh = (() => {
    const g0 = gridGeo(HR + 1, HC, (i, j) => {
      const t = i / HR;
      const th = colTh(t, j);
      return { p: hd.S(t, th), c: SKIN.clone().lerp(BELLY, jaw(t, th)) };
    }, { wrapJ: true });
    // The shallow groove of the mouth line: pressed inward along the grid's own normals (the same as off in sweep.geo, with the rows at the two ends not moving)
    const P0 = g0.attributes.position.array as Float32Array;
    const N0a = g0.attributes.normal.array as Float32Array;
    for (let i = 1; i < HR; i++) {
      const t = i / HR;
      for (let j = 0; j < HC; j++) {
        const lat = hLat(colTh(t, j));
        const off = -0.0035 * Math.exp(-(((lat - mouthLat(t)[0]) / 0.025) ** 2)) * THREE.MathUtils.smoothstep(t, MOUTH_T - 0.02, MOUTH_T + 0.02);
        const k = (i * HC + j) * 3;
        for (let a = 0; a < 3; a++) P0[k + a] += N0a[k + a] * off;
      }
    }
    normals(g0);
    // Split the mouth line: from row CUT0 onward, the quads of the lower half-ring use the copies of the two columns of the mouth line
    const n0 = (HR + 1) * HC;
    const nd = (HR + 1 - CUT0) * 2;
    const dup = (i: number, j: number) => n0 + (i - CUT0) * 2 + (j === JL ? 0 : 1);
    const src = (k: number) => (k < n0 ? k : CUT0 * HC + Math.floor((k - n0) / 2) * HC + ((k - n0) % 2 ? JR : JL));
    const pos = new Float32Array((n0 + nd) * 3);
    const nrm = new Float32Array((n0 + nd) * 3);
    const col = new Float32Array((n0 + nd) * 3);
    const w = new Uint8Array(n0 + nd);
    const C0 = g0.attributes.color.array as Float32Array;
    const N1 = g0.attributes.normal.array as Float32Array;
    for (let k = 0; k < n0 + nd; k++) {
      const s0 = src(k) * 3;
      pos.set(P0.subarray(s0, s0 + 3), k * 3);
      nrm.set(N1.subarray(s0, s0 + 3), k * 3);
      col.set(C0.subarray(s0, s0 + 3), k * 3);
      const i = Math.floor(src(k) / HC);
      const j = src(k) % HC;
      w[k] = i >= CUT0 && ((j > JL && j < JR) || k >= n0) ? 1 : 0;
    }
    const idx: number[] = [];
    for (let i = 0; i < HR; i++)
      for (let j = 0; j < HC; j++) {
        const j2 = (j + 1) % HC;
        const low = i + 1 >= CUT0 && j >= JL && j < JR;
        const V = (r: number, c: number) => (low && r >= CUT0 && (c === JL || c === JR) ? dup(r, c) : r * HC + c);
        const a = V(i, j);
        const b = V(i, j2);
        const c = V(i + 1, j);
        const d = V(i + 1, j2);
        idx.push(a, c, b, c, d, b);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g0.dispose();
    const m = add(head, g, M.skinV);
    m.userData.inkGroup = HEAD;
    return { m, w, p0: pos.slice(), n0: nrm.slice() };
  })();
  // The pivot of the lower jaw: the row at the corner of the mouth, the midpoint of the two mouth lines
  const hingeT = (CUT0 - 1) / HR;
  const HINGE = hd.S(hingeT, colTh(hingeT, JL)).add(hd.S(hingeT, colTh(hingeT, JR))).multiplyScalar(0.5);
  let jawNow = -1;
  const setJaw = (a: number) => {
    if (Math.abs(a - jawNow) < 1e-4) return;
    jawNow = a;
    const g = headMesh.m.geometry;
    const P = g.attributes.position.array as Float32Array;
    const Nn = g.attributes.normal.array as Float32Array;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    for (let k = 0; k < headMesh.w.length; k++) {
      if (!headMesh.w[k]) continue;
      const i = k * 3;
      const y = headMesh.p0[i + 1] - HINGE.y;
      const z = headMesh.p0[i + 2] - HINGE.z;
      P[i + 1] = HINGE.y + y * c - z * sn;
      P[i + 2] = HINGE.z + y * sn + z * c;
      const ny = headMesh.n0[i + 1];
      const nz = headMesh.n0[i + 2];
      Nn[i + 1] = ny * c - nz * sn;
      Nn[i + 2] = ny * sn + nz * c;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
    jawG.rotation.x = a;
    for (const g of teeth) for (const m of g.children) m.visible = a > 0.02;
  };
  // Mouth interior: upper jaw, floor of the mouth of the lower jaw, tongue, teeth. When the mouth is closed it is all wrapped inside the head and cannot be seen, and it shows only when the mouth opens (the teeth are simply hidden when the mouth is closed, so the tips do not poke out through the chin)
  const jawG = group(head, HINGE.toArray() as [number, number, number]);
  // The upper and lower rows of teeth each go in one group (the same outline group, each merged into one mesh when merging), so the whole row appears together when the mouth opens
  const teeth = [group(head), group(jawG)];
  {
    const seam = (i: number, j: number) => {
      const k = (i * HC + j) * 3;
      return v(headMesh.p0[k], headMesh.p0[k + 1], headMesh.p0[k + 2]);
    };
    const rows: number[] = [];
    for (let i = CUT0 - 1; i < HR; i += 2) rows.push(i);
    rows.push(HR);
    const K = 6;
    /** The arched piece between the two mouth lines: up is toward the top of the head (upper jaw) or toward the chin (floor of the mouth) */
    const cap = (dir: number, sagK: number, off: THREE.Vector3) =>
      gridGeo(rows.length, K + 1, (ii, kk) => {
        const i = rows[ii];
        const R = seam(i, JR);
        const L = seam(i, JL);
        const H = hd.F(i / HR).H;
        const p = R.clone().lerp(L, kk / K).addScaledVector(H, dir * sagK * R.distanceTo(L) * Math.sin((PI * kk) / K));
        return { p: p.sub(off) };
      });
    const orient = (g: THREE.BufferGeometry, want: THREE.Vector3) => {
      const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, Math.floor(rows.length / 2) * (K + 1) + K / 2);
      if (n.dot(want) < 0) flip(g);
      return g;
    };
    const ZERO = v(0, 0, 0);
    add(head, orient(cap(1, 0.28, ZERO), v(0, -1, 0)), M.mouth).userData.inkGroup = HEAD + 30;
    add(jawG, orient(cap(-1, 0.12, HINGE), v(0, 1, 0)), M.mouth).userData.inkGroup = HEAD + 31;
    // Tongue: a flat, long piece of flesh lying on the floor of the mouth, the front end round
    const tp: THREE.Vector3[] = [];
    for (const t of [0.52, 0.64, 0.76, 0.86]) {
      const i = Math.round(t * HR);
      const R = seam(i, JR);
      const L = seam(i, JL);
      const H = hd.F(i / HR).H;
      tp.push(R.clone().lerp(L, 0.5).addScaledVector(H, -0.12 * R.distanceTo(L) + 0.006).sub(HINGE));
    }
    add(jawG, loft(tp, curveTable([[0, 0.022, 0.006], [0.7, 0.02, 0.006], [1, 0, 0]]), { segs: 8, radial: 6 }), M.tongue).userData.inkGroup = HEAD + 32;
    // Teeth: the upper row pointing down and the lower row pointing up, set a little inside the mouth line
    const tooth = new THREE.ConeGeometry(0.0055, 0.02, 5);
    for (const [t, big] of [[0.6, 0], [0.72, 0], [0.84, 1]] as [number, number][])
      for (const j of [JL, JR]) {
        const i = Math.round(t * HR);
        const R = seam(i, JR);
        const L = seam(i, JL);
        const H = hd.F(i / HR).H;
        const edge = seam(i, j).lerp(j === JL ? R : L, 0.08);
        const up = add(teeth[0], tooth, M.tooth, edge.clone().addScaledVector(H, -0.008 - big * 0.003).toArray() as [number, number, number], [PI, 0, 0], [1 + big * 0.4, 1 + big * 0.6, 1 + big * 0.4]);
        up.userData.inkGroup = HEAD + 33;
        const lo = add(teeth[1], tooth, M.tooth, edge.clone().sub(HINGE).addScaledVector(H, 0.007).toArray() as [number, number, number], [0, 0, 0], [0.8, 0.8, 0.8]);
        lo.userData.inkGroup = HEAD + 33;
      }
  }
  {
    const pts: THREE.Vector3[] = [];
    const side = (sx: number) => {
      const row: THREE.Vector3[] = [];
      row.push(hd.S(MOUTH_T - 0.015, hTh(sx, mouthLat(MOUTH_T - 0.015)[0] + 0.06), -0.001));
      for (let t = MOUTH_T; t <= 0.985; t += 0.02) row.push(hd.S(t, hTh(sx, mouthLat(t)[0]), -0.0012));
      return row;
    };
    const f1 = hd.F(1);
    pts.push(...side(-1), f1.C.clone().addScaledVector(f1.H, -0.012).addScaledVector(f1.T, -0.004), ...side(1).reverse());
    add(head, loft(pts, (u) => { const k = Math.pow(Math.sin(PI * u), 0.3); return [0.0042 * k, 0.0042 * k]; }, { segs: 48, radial: 5 }), M.line);
  }
  // Nostrils: two dark nostrils dished in above the muzzle tip, with a slightly raised ring around each
  for (const sx of [-1, 1]) {
    const t = 0.93;
    const th = hTh(sx, 0.42);
    const p = hd.S(t, th, -0.002);
    const n = hd.N(t, th);
    const g = group(head, p.toArray() as [number, number, number]);
    g.quaternion.setFromUnitVectors(UP, n);
    add(g, new THREE.SphereGeometry(1, 12, 8), M.skin, [0, 0.001, 0], [0, 0, 0], [0.013, 0.006, 0.017]).userData.inkGroup = HEAD;
    add(g, new THREE.SphereGeometry(1, 10, 6), M.nostril, [sx * 0.002, 0.004, 0.002], [0, sx * 0.5, 0], [0.004, 0.004, 0.01]);
  }

  /** Anchor: the center of the contract mark on the forehead (the sigil light of the ultimate and the opening comes out from here) */
  const sigilA = group(head);
  // ── The contract mark on the forehead: the forehead rises slightly, the two ring grooves, eight radiating cuts and the central diamond slot dug downward, gold inlaid in the grooves and a gem inlaid in the slot ──
  const SEAL_T = 0.36;
  const R_OUT = 0.047;
  const R_IN = 0.031;
  const G_OUT = 0.0085;
  const G_IN = 0.0065;
  const DEPTH = 0.0048;
  const C0 = hd.S(SEAL_T, PI / 2);
  const N0 = hd.N(SEAL_T, PI / 2);
  const Ys = hd.S(SEAL_T - 0.01, PI / 2).sub(hd.S(SEAL_T + 0.01, PI / 2));
  Ys.addScaledVector(N0, -Ys.dot(N0)).normalize();
  const Xs = new THREE.Vector3().crossVectors(Ys, N0).normalize();
  const proj = (p: THREE.Vector3): [number, number] => {
    const d = p.clone().sub(C0);
    return [d.dot(Xs), d.dot(Ys)];
  };
  /** Find the surface point whose projection falls at (x, y) (Newton's method, continuing from the previous point's solution) */
  let guess: [number, number] = [SEAL_T, PI / 2];
  const solve = (x: number, y: number): THREE.Vector3 => {
    let [t, th] = guess;
    let P = hd.S(t, th);
    for (let it = 0; it < 6; it++) {
      const [px, py] = proj(P);
      const ex = x - px;
      const ey = y - py;
      if (Math.abs(ex) + Math.abs(ey) < 2e-6) break;
      const d = 1e-4;
      const [ax, ay] = proj(hd.S(t + d, th));
      const [bx, by] = proj(hd.S(t, th + d));
      const j11 = (ax - px) / d;
      const j21 = (ay - py) / d;
      const j12 = (bx - px) / d;
      const j22 = (by - py) / d;
      const det = j11 * j22 - j12 * j21;
      t += (j22 * ex - j12 * ey) / det;
      th += (-j21 * ex + j11 * ey) / det;
      P = hd.S(t, th);
    }
    guess = [t, th];
    return P;
  };
  const ring = (r: number, R: number, w: number) => 1 - THREE.MathUtils.smoothstep(Math.abs(r - R), w * 0.32, w * 0.5);
  const TICKS = 8;
  const carve = (x: number, y: number) => {
    const r = Math.hypot(x, y);
    let g = Math.max(ring(r, R_OUT, G_OUT), ring(r, R_IN, G_IN));
    const phi = Math.atan2(x, y);
    for (let k = 0; k < TICKS; k++) {
      const a = (k / TICKS) * PI * 2;
      const along = r * Math.cos(phi - a);
      const across = Math.abs(r * Math.sin(phi - a));
      const long = k % 2 === 0;
      const r0 = R_IN + G_IN * 0.5 + 0.002;
      const r1 = R_OUT - G_OUT * 0.5 - (long ? 0.002 : 0.006);
      const inR = THREE.MathUtils.smoothstep(along, r0, r0 + 0.0015) * (1 - THREE.MathUtils.smoothstep(along, r1 - 0.0015, r1));
      g = Math.max(g, inR * (1 - THREE.MathUtils.smoothstep(across, 0.0011, 0.0022)));
    }
    const dm = Math.abs(x) / 0.0135 + Math.abs(y) / 0.021;
    g = Math.max(g, 1 - THREE.MathUtils.smoothstep(dm, 0.82, 1.0));
    // The rise of the forehead: the ring of engraving is a little higher, and the outer edge descends smoothly to below the skull surface (the edge of the patch is hidden inside the skull)
    const boss = 0.0035 - 0.0075 * THREE.MathUtils.smoothstep(r, R_OUT + 0.006, R_OUT + 0.02);
    return boss - DEPTH * g;
  };
  /** The engraving and the inlays are dug and padded along the normal at the center of the sigil (the depth is under half a centimeter, indistinguishable from per-point normals) */
  const sealAt = (x: number, y: number, lift: number) => solve(x, y).addScaledVector(N0, carve(x, y) + lift);
  {
    // Polar grid: the rows, ring by ring, run exactly along the ring grooves, so the engraving is crisp
    // Face-count budget: rings are placed at the diamond slot, the slopes on both sides of the ring grooves, the two ends of the cuts and the outer edge of the rise; columns are placed at the midline of the eight cuts and the slopes on both sides
    // (originally 120 rings × 176 columns evenly sampled), with the polylines of the engraving all falling on sample points
    const RP = R_OUT + 0.026;
    const rr: number[] = [0, 0.008];
    for (let r = 0.0095; r <= 0.0241; r += 0.002) rr.push(r);
    for (const [R, G] of [[R_IN, G_IN], [R_OUT, G_OUT]]) for (const k of [-0.5, -0.41, -0.32, 0.32, 0.41, 0.5]) rr.push(R + k * G);
    const tr0 = R_IN + G_IN * 0.5 + 0.002;
    rr.push(tr0, tr0 + 0.00075, tr0 + 0.0015);
    for (const tr1 of [R_OUT - G_OUT * 0.5 - 0.002, R_OUT - G_OUT * 0.5 - 0.006]) rr.push(tr1 - 0.0015, tr1 - 0.00075, tr1);
    for (const k of [0, 0.25, 0.5, 0.75, 1]) rr.push(R_OUT + 0.006 + 0.014 * k);
    rr.push(RP);
    const RS = uniq(rr);
    const AS: number[] = [];
    for (let k = 0; k < TICKS; k++) {
      const a0 = (k / TICKS) * PI * 2;
      for (const d of [-0.058, -0.029, 0, 0.029, 0.058, 0.25, 0.53]) AS.push(a0 + d);
    }
    const ANG = uniq(AS.map((a) => (a + PI * 2) % (PI * 2)));
    const NRr = RS.length - 1;
    const NA = ANG.length;
    guess = [SEAL_T, PI / 2];
    const rows: THREE.Vector3[][] = [];
    for (let i = 0; i <= NRr; i++) {
      const r = RS[i];
      const row: THREE.Vector3[] = [];
      for (let j = 0; j < NA; j++) {
        const a = ANG[j];
        row.push(sealAt(Math.sin(a) * r, Math.cos(a) * r, 0));
      }
      rows.push(row);
    }
    const g = gridGeo(NRr + 1, NA, (i, j) => ({ p: rows[i][j] }), { wrapJ: true });
    const k = Math.floor(NRr / 2) * NA;
    const nn = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, k);
    if (nn.dot(N0) < 0) flip(g);
    add(head, g, M.skin).userData.inkGroup = HEAD;
    // Gold inlay: two rings and eight cuts
    const inlay = (R: number, rad: number) => {
      const pts: THREE.Vector3[] = [];
      guess = [SEAL_T, PI / 2];
      for (let j = 0; j < 72; j++) {
        const a = (j / 72) * PI * 2;
        pts.push(sealAt(Math.sin(a) * R, Math.cos(a) * R, rad * 0.95));
      }
      add(head, tubeGeo(pts, () => rad, { segs: 56, radial: 6, closed: true }), M.sealGold);
    };
    inlay(R_OUT, 0.0031);
    inlay(R_IN, 0.0024);
    for (let k = 0; k < TICKS; k++) {
      const a = (k / TICKS) * PI * 2;
      const long = k % 2 === 0;
      const r0 = R_IN + G_IN * 0.5 + 0.0028;
      const r1 = R_OUT - G_OUT * 0.5 - (long ? 0.0028 : 0.0068);
      const pts = [0, 0.5, 1].map((u) => {
        const r = r0 + (r1 - r0) * u;
        return sealAt(Math.sin(a) * r, Math.cos(a) * r, 0.0012);
      });
      add(head, tubeGeo(pts, (u) => 0.0013 * Math.min(1, u * 8, (1 - u) * 8 + 0.1) + 0.0002, { segs: 6, radial: 6 }), M.sealGold);
    }
    // The central diamond gem: facets facing outward, projecting slightly out of the slot
    const gp = sealAt(0, 0, 0.0028);
    sigilA.position.copy(gp).addScaledVector(N0, 0.004);
    const gem = add(head, new THREE.OctahedronGeometry(1, 0), M.sealGem, gp.toArray() as [number, number, number]);
    gem.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xs, Ys, N0));
    gem.scale.set(0.0118, 0.0185, 0.0055);
  }

  // ── Eyes: a dragon's small eyes, the golden iris filling the whole exposed spherical cap (no sclera, no pale outer ring, no concentric circles), a thin vertical pupil, one small point of highlight;
  // about eighteen percent of the head's width in diameter, found by taking the point on the scalp whose normal faces forward, outward and up and burying the eye along the normal, the upper edge tucked under a gentle brow ridge.
  // The eyelids appear only when blinking and closing the eyes (act.shut), and the whole set is hidden when the eyes are open (reference.md pitfall 105) ──
  const ER = 0.021;
  const EMBED = 0.45;
  // The open-eye angle: the eyelid lips stop outside the range where the eyeball shows (the half angle of the exposed spherical cap is about 1.1); when closed they meet slightly below the midline
  const UP_OPEN = 1.2;
  const LO_OPEN = 1.15;
  const LID_MEET = 0.14;
  const lids: THREE.Group[] = [];
  const lowers: THREE.Group[] = [];
  const eyeA: THREE.Group[] = [];
  const irises: { g: THREE.Group; sx: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeBall = new THREE.SphereGeometry(ER, 16, 12);
  {
    // The iris shading only runs top to bottom: the upper edge darkened by the brow ridge and the lower half translucent and bright (vertex colors only darken, no rings drawn)
    const pa = eyeBall.attributes.position as THREE.BufferAttribute;
    const c: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      const k = 0.5 + 0.5 * THREE.MathUtils.smoothstep(-pa.getY(i) / ER, -0.75, 0.45);
      c.push(k, k * 0.92, k * 0.82);
    }
    eyeBall.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  const lidUp = lidGeo(ER + 0.0025, ER + 0.0065, PI / 2, 16);
  const lidLow = lidGeo(ER + 0.002, ER + 0.005, PI / 2, 16);
  const lidLine = lidGeo(ER + 0.001, ER + 0.003, PI / 2, 16, 4, 2);
  // The position of the eye: the point on the scalp whose normal is closest to "forward, outward and up" (after subtracting the head's downward tilt), the eyeball buried along the normal, so the eye's direction is the normal, and it does not look cross-eyed
  const findEye = (sx: number) => {
    const want = v(sx * 0.62, 0.3, 0.72).normalize().applyAxisAngle(X, -PITCH);
    let best = { d: -2, t: 0.4, th: 0 };
    for (let t = 0.3; t <= 0.52; t += 0.005)
      for (let lat = 0; lat <= 1.3; lat += 0.01) {
        const th = hTh(sx, lat);
        const d = hd.N(t, th).dot(want);
        if (d > best.d) best = { d, t, th };
      }
    return { p: hd.S(best.t, best.th, -ER * EMBED), n: hd.N(best.t, best.th) };
  };
  for (const sx of [-1, 1]) {
    const { p, n: f } = findEye(sx);
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    const eg = group(head, p.toArray() as [number, number, number]);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    // The eyeball, pupil and highlight form a group of their own (the corruption effect looks at the size of this group to swap materials); when idle the whole group turning slightly is the eyeball moving
    const gz = group(eg);
    add(gz, eyeBall, M.eye);
    add(gz, diskDecal(0.1, 0.62, ER + 0.0006, 2, 16), M.pupil);
    eyeA.push(group(gz, [0, 0, ER]));
    const hl = add(gz, new THREE.SphereGeometry(ER * 0.16, 8, 6), M.hi, [ER * 0.36, ER * 0.3, ER * 0.88], [0, 0, 0], [1, 1, 0.5]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    irises.push({ g: gz, sx });
    const upper = group(eg, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.skin).userData.inkGroup = HEAD;
    const upLine = group(eg, [0, 0, 0], [-UP_OPEN + 0.08, 0, 0]);
    add(upLine, lidLine, M.line);
    const lower = group(eg, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lower, lidLow, M.skin).userData.inkGroup = HEAD;
    const loLine = group(eg, [0, 0, 0], [PI + LO_OPEN - 0.06, 0, 0]);
    add(loLine, lidLine, M.line);
    lids.push(upper, upLine);
    lowers.push(lower, loLine);
    // Brow ridge: a gentle bony ridge along the upper edge of the eye, its lower edge stopping exactly at the upper edge of the eye (pressing on the eye would look sleepy), the inner end slightly higher (gentle),
    // the outer end running back along the side of the head to the horn root; the same color as the head and the same outline group
    const B = 0.03;
    const bpts: THREE.Vector3[] = [];
    for (let q = 0; q <= 8; q++) {
      const s2 = q / 8;
      bpts.push(v(sx * B * (-0.9 + 2.3 * s2), ER * 0.9 + B * (0.16 + 0.1 * s2 - 0.12 * s2 * s2), ER * 0.6 + B * (0.2 - 1.5 * s2 * s2)));
    }
    add(eg, loft(bpts, (tt) => { const k = Math.pow(Math.sin(PI * Math.min(1, tt * 1.4)), 0.5) * (1 - 0.6 * tt); return [0.014 * k + 0.001, 0.009 * k + 0.001]; }, { segs: 16, radial: 8 }), M.skin).userData.inkGroup = HEAD;
  }

  const hornA: THREE.Group[] = [];
  // ── Horns: two horns behind the forehead sweeping back with the ends slightly upturned, ivory white fading to gold; a gold ring at each horn root ──
  for (const sx of [-1, 1]) {
    const hp = [v(sx * 0.064, 0.06, -0.035), v(sx * 0.086, 0.078, -0.085), v(sx * 0.112, 0.082, -0.165), v(sx * 0.135, 0.09, -0.24), v(sx * 0.15, 0.11, -0.31), v(sx * 0.152, 0.145, -0.35)];
    const hs = sweep(hp, curveTable([[0, 0, 0], [0.03, 0.027, 0.029], [0.2, 0.025, 0.026], [0.6, 0.016, 0.017], [0.9, 0.007, 0.007], [1, 0, 0]]));
    add(head, hs.geo(30, 10, { color: (t) => SKIN.clone().lerp(HORN_TIP, THREE.MathUtils.smoothstep(t, 0.35, 0.95)) }), M.horn).userData.inkGroup = HEAD + 10 + sx;
    hornA[sx > 0 ? 1 : 0] = group(head, hs.F(1).C.toArray() as [number, number, number]);
    const f = hs.F(0.17);
    const bg = group(head, f.C.toArray() as [number, number, number]);
    bg.quaternion.setFromUnitVectors(UP, f.T);
    add(bg, lathe([[0.024, -0.009], [0.029, -0.007], [0.031, 0], [0.029, 0.007], [0.024, 0.009]], 20), M.gold);
  }

  // A short run of spines on the back of the head, from between the two horns going back to join the dorsal fin on the nape
  add(head, crestGeo(hd, 0.015, 0.2, (t) => 0.024 * Math.sin(PI * Math.min(1, (t - 0.015) / 0.185)) * (0.5 + 0.5 * Math.pow(1 - Math.abs(2 * ((t * 16 + 0.3) % 1) - 1), 1.6)), 16, -0.5, 0.0075, undefined, { phase: 0.3 }), M.skinV).userData.inkGroup = HEAD;

  // ── Ear fins: behind the cheek a fan spread by three spines, framing the face; twitching now and then ──
  const frills: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const rootP = hd.S(0.24, hTh(sx, -0.05), -0.01);
    const fg = group(head, rootP.toArray() as [number, number, number]);
    frills.push({ g: fg, sx });
    const dirs = [v(sx * 0.62, 0.56, -0.55), v(sx * 0.78, 0.06, -0.62), v(sx * 0.58, -0.44, -0.68)].map((d) => d.normalize());
    const lens = [0.14, 0.16, 0.11];
    const tipsF = dirs.map((d, i) => d.clone().multiplyScalar(lens[i]));
    const spines = tipsF.map((tp, i) => new THREE.CatmullRomCurve3([v(0, 0, 0), tp.clone().multiplyScalar(0.5).add(v(0, i === 0 ? 0.012 : 0, 0.008)), tp], false, 'centripetal'));
    const nF = new THREE.Vector3().crossVectors(tipsF[0], tipsF[2]).normalize();
    if (nF.z < 0) nF.negate();
    const tc = new THREE.Color();
    for (let k = 0; k < 2; k++) {
      const a0 = tipsF[k];
      const a1 = tipsF[k + 1];
      const p: Patch = {
        A: (s) => spines[k].getPointAt(s),
        B: (s) => spines[k + 1].getPointAt(s),
        I: () => v(0, 0, 0),
        O: (u) => { const q = a0.clone().lerp(a1, u); return q.addScaledVector(q.clone().normalize(), -0.035 * Math.sin(PI * u)); },
      };
      add(fg, membraneGeo(p, { ns: 10, na: 8, h: 0.0032, front: nF, bulge: (s, a) => 0.008 * Math.sin(PI * a) * Math.sin(PI * s), color: (s) => tc.copy(MEMB_IN).lerp(MEMB_OUT, THREE.MathUtils.smoothstep(s, 0.2, 1)).clone() }), M.memb).userData.inkGroup = HEAD + 20 + sx;
      const rp: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) rp.push(p.O(i / 24));
      add(fg, tubeGeo(rp, () => 0.0032, { segs: 18, radial: 5 }), M.membEdge).userData.inkGroup = HEAD + 20 + sx;
    }
    for (const sp of spines) {
      add(fg, loft([0, 0.33, 0.66, 1].map((u) => sp.getPointAt(u)), curveTable([[0, 0.011, 0.011], [0.5, 0.008, 0.008], [0.94, 0.004, 0.004], [1, 0, 0]]), { segs: 12, radial: 6, side: nF }), M.skin).userData.inkGroup = HEAD;
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors (for hooking into the game): all empty groups, following the action ──
  const chestA = group(body, tor.S(0.21, -PI / 2).toArray() as [number, number, number]);
  spineB.attach(chestA, 0.21);
  const tailA = group(body, tor.F(0.99).C.toArray() as [number, number, number]);
  spineB.attach(tailA, 0.99);
  const faceA = group(head, hd.F(0.5).C.toArray() as [number, number, number]);
  const mouthA = group(head, hd.F(0.97).C.addScaledVector(hd.F(0.97).H, -0.03).addScaledVector(hd.F(0.97).T, 0.03).toArray() as [number, number, number]);
  const jawA = group(jawG, hd.F(0.96).C.addScaledVector(hd.F(0.96).H, -0.045).sub(HINGE).toArray() as [number, number, number]);
  const rig = {
    head: faceA,
    eyes: eyeA,
    anchors: {
      mouth: mouthA,
      jaw: jawA,
      sigil: sigilA,
      hornL: hornA[1],
      hornR: hornA[0],
      chest: chestA,
      tailTip: tailA,
      wingL: wings[1].sh,
      wingR: wings[0].sh,
      wingTipL: wings[1].tip,
      wingTipR: wings[0].tip,
    },
  };

  // Draw calls: parts that never move on their own are merged into the groups that move (the body, the wing shoulders and gold band that follow the center line, the wings, neck, head, lower jaw, the two rows of teeth, eyeballs, eyelids, ear fins and feet);
  // the meshes bound to the center line and the head (the vertices of the lower jaw) are rewritten on the CPU every frame and are not merged. Done before update(0, 0), when the teeth are not yet hidden.
  // The thin tube at the outer edge of the wing membrane is in the same outline group as the membrane, and writing the base color into vertex colors lets it merge with the membrane into one; the skin likewise merges into the skin with vertex colors on
  mergeStatic(root, {
    owners: [
      body, ...spineB.attached, ...wings.flatMap((w) => [w.g, w.b]), neckTop, headPivot, head, jawG, ...teeth,
      ...irises.map((i) => i.g), ...lids, ...lowers, ...frills.map((f) => f.g), ...limbs.map((l) => l.foot),
    ],
    keep: [...spineB.meshes, ...limbs.flatMap((l) => l.b.meshes), headMesh.m],
    rig,
    share: sideToes,
    twins: [[M.membEdge, M.memb], [M.skin, M.skinV]],
  });

  // ── Action weights (see <Action table> in the file header): performances tween these values, and the poses are set here by the weights ──
  const act = { focus: 0, sigil: 0, raise: 0, roar: 0, speak: 0, spread: 0, rear: 0, sleep: 0, shut: 0, turn: 0 };

  // The poses of the center line (14 control points, one to one with spine)
  /** Raise the head: the neck straightens and is pulled up, the chest thrust out */
  const SP_RAISE = spine.map((p, i) => p.clone().add([v(0, 0.17, -0.05), v(0, 0.15, -0.03), v(0, 0.13, 0), v(0, 0.1, 0.01), v(0, 0.06, 0.01), v(0, 0.02, 0)][i] ?? v(0, 0, 0)));
  /** Roar: the neck thrust forward */
  const SP_ROAR = spine.map((p, i) => p.clone().add([v(0, 0.02, 0.14), v(0, 0.03, 0.12), v(0, 0.03, 0.1), v(0, 0.02, 0.07), v(0, 0.01, 0.02)][i] ?? v(0, 0, 0)));
  /** Sleep: the body against the ground, the neck bending down toward the right-hand side (-x), the head resting beside the right forepaw, the tail curling back from the right */
  const SP_SLEEP = [
    v(-0.44, 0.2, 0.46), v(-0.36, 0.21, 0.41), v(-0.24, 0.26, 0.34), v(-0.1, 0.3, 0.22), v(0, 0.31, 0.07), v(0.01, 0.27, -0.12), v(0, 0.25, -0.32),
    v(-0.02, 0.21, -0.5), v(-0.08, 0.14, -0.66), v(-0.22, 0.09, -0.77), v(-0.4, 0.07, -0.74), v(-0.52, 0.06, -0.58), v(-0.57, 0.06, -0.36), v(-0.56, 0.085, -0.16),
  ];
  /** Rear up: the front half lifts about the pivot above the hind feet */
  const REAR_PIVOT = v(0, 0.58, -0.36);
  const REAR_ANG = -0.45;
  const REAR_W = [1, 1, 1, 1, 1, 1, 0.7, 0.25, 0, 0, 0, 0, 0, 0];
  const rot = (p: THREE.Vector3, c: THREE.Vector3, a: number) => {
    const y = p.y - c.y;
    const z = p.z - c.z;
    p.y = c.y + y * Math.cos(a) - z * Math.sin(a);
    p.z = c.z + y * Math.sin(a) + z * Math.cos(a);
    return p;
  };
  // The poses of the legs: when lying down the forelegs lie flat forward (forearm on the ground, foot facing forward), and the hind feet are tucked at the side, extending forward
  const legSleep = (l: Limb) => {
    const sx = l.sx;
    const fz = l.front && sx > 0 ? 0.05 : 0;
    return l.front
      ? [v(sx * 0.08, 0.3, 0.12 + fz * 0.3), v(sx * 0.17, 0.2, 0.08), v(sx * 0.22, 0.1, 0.04 + fz), v(sx * 0.22, 0.075, 0.22 + fz), v(sx * 0.22, 0.07, 0.34 + fz)]
      : [v(sx * 0.07, 0.27, -0.3), v(sx * 0.2, 0.22, -0.26), v(sx * 0.28, 0.13, -0.2), v(sx * 0.31, 0.075, -0.1), v(sx * 0.31, 0.07, -0.03)];
  };
  const LEG_SLEEP = limbs.map(legSleep);
  const FOLD = -1.05;
  const fq = new THREE.Quaternion();
  const EX = new THREE.Euler();
  const spineCur = spine.map((p) => p.clone());
  let poseKey = '';
  const applyPose = () => {
    const key = `${act.raise.toFixed(4)},${act.roar.toFixed(4)},${act.rear.toFixed(4)},${act.sleep.toFixed(4)}`;
    if (key === poseKey) return;
    poseKey = key;
    const still = !act.raise && !act.roar && !act.rear && !act.sleep;
    if (still) {
      spineB.pose(null);
      for (const l of limbs) {
        l.b.pose(null);
        l.foot.position.copy(l.pts[4]).add(l.off);
        l.foot.quaternion.identity();
      }
      return;
    }
    blendPts(spine, [[SP_RAISE, act.raise], [SP_ROAR, act.roar], [SP_SLEEP, act.sleep]], spineCur);
    const ra = REAR_ANG * act.rear;
    if (ra) for (let i = 0; i < spineCur.length; i++) if (REAR_W[i]) rot(spineCur[i], REAR_PIVOT, ra * REAR_W[i]);
    spineB.pose(spineCur);
    limbs.forEach((l, li) => {
      blendPts(l.pts, [[LEG_SLEEP[li], act.sleep]], l.cur);
      let fa = 0;
      if (l.front && ra) {
        // The forefeet rise with the front half, and the forearms then draw in forward (the feet off the ground, lifted forward)
        for (const p of l.cur) rot(p, REAR_PIVOT, ra);
        const fold = FOLD * act.rear;
        for (let i = 3; i < 5; i++) rot(l.cur[i], l.cur[2], fold);
        // The forepaws spread slightly outward (a bracing stance, not tucked against the chest)
        for (let i = 2; i < 5; i++) l.cur[i].x += l.sx * 0.07 * (i - 1) * act.rear;
        fa = ra + fold;
      }
      l.b.pose(l.cur);
      fq.setFromEuler(EX.set(fa, 0, 0));
      l.foot.quaternion.copy(fq);
      l.foot.position.copy(l.off).applyQuaternion(fq).add(l.cur[4]);
    });
  };

  // ── Idle: breathing, slow looking around, blinking, the ear fins twitching now and then, the wings opening and closing slightly with the breathing, the sigil glimmering faintly ──
  // The action weights are stacked on top: focus stops looking around, raise lifts the head, roar opens the mouth in a roar, spread spreads the wings, rear raises the front half, sleep lies down to sleep, shut closes the eyes, turn turns the head
  let blinkIn = 2.4;
  let blinkT = -1;
  const qA = new THREE.Quaternion();
  const qS = new THREE.Quaternion();
  const EX2 = new THREE.Euler();
  /** The angle and amount of shortening for folding the wings */
  const WF = { x: 0.2, y: 1.1, z: 1.1, su: 0.4, sv: 0.28 };
  const update = (t: number, dt: number) => {
    const A = act;
    applyPose();
    // When asleep the breathing slows and deepens
    const br = Math.sin(t * (1.1 - 0.5 * A.sleep));
    body.position.y = br * (0.006 + 0.004 * A.sleep);
    const idle = 1 - Math.min(1, Math.max(A.focus, A.sleep, A.roar, A.raise * 0.85));
    headPivot.rotation.y = (Math.sin(t * 0.3) * 0.14 + Math.sin(t * 0.83) * 0.02) * idle;
    headPivot.rotation.x = Math.sin(t * 0.47) * 0.025 * idle;
    headPivot.rotation.z = Math.sin(t * 0.3 + 0.7) * 0.02 * idle;
    // The angles of the head and neck: raising the head tilts the chin up, a roar lifts the chin a little more, and when asleep the head turns to the right-hand side and rests on the ground
    qA.setFromEuler(EX2.set(-0.2 * A.raise - 0.1 * A.roar - 0.12 * A.rear, 0.7 * A.turn, 0, 'YXZ')).premultiply(neckF.quaternion);
    qS.setFromEuler(EX2.set(0.22, -1.05 + 0.7 * A.turn, -0.12, 'YXZ'));
    neckTop.quaternion.copy(qA).slerp(qS, A.sleep);
    neckTop.position.copy(neckF.position);
    setJaw(0.5 * A.roar + 0.2 * A.speak);
    // The eye socket faces forward, outward and up, and the eyeball is drawn back down and in to horizontal: from the front it looks at the camera, and not as if the two eyes look to different sides
    for (const { g, sx } of irises) g.rotation.set(0.26, -sx * 0.16 + Math.sin(t * 0.3 - 0.5) * 0.05 * idle, 0);

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.8 + ((t * 7.3) % 3);
    }
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.22;
      blink = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.3) : 0;
      if (k >= 1) blinkT = -1;
    }
    const close = Math.max(blink * (1 - A.roar), A.shut);
    // When blinking the upper and lower eyelids meet slightly below the midline of the eye, the seam facing forward, so the lash line can be seen
    // When the eyes are open the eyelids are hidden as a whole, leaving no ring of eyelid around the eye
    const lidOn = close > 0.01;
    for (let i = 0; i < lids.length; i++) {
      lids[i].rotation.x = -UP_OPEN + (i % 2 ? 0.08 : 0) + (UP_OPEN + LID_MEET) * close;
      lids[i].visible = lidOn;
    }
    for (let i = 0; i < lowers.length; i++) {
      lowers[i].rotation.x = PI + LO_OPEN - (i % 2 ? 0.06 : 0) - (LO_OPEN - LID_MEET + 0.03) * close;
      lowers[i].visible = lidOn;
    }
    for (const g of glints) g.visible = close < 0.6;

    for (let i = 0; i < frills.length; i++) {
      const { g, sx } = frills[i];
      const ph = (t + i * 2.6) % 6.1;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.18 : 0;
      // In a roar the ear fins spread outward
      g.rotation.set(0, sx * (tw * 0.5 + 0.35 * A.roar), sx * (tw + 0.3 * A.roar - 0.25 * A.sleep));
    }
    for (const { g, b, sx } of wings) {
      // Wings spread: the whole wing opens outward and upward; asleep: the wing fingers drawn together (span and height shortened), drawn back and lowered against the flank
      g.rotation.set(
        -0.2 * A.spread + WF.x * A.sleep,
        -sx * Math.sin(t * 1.1 - 0.6) * 0.015 - sx * 0.55 * A.spread + sx * WF.y * A.sleep,
        sx * (br * 0.02) + sx * 0.4 * A.spread - sx * WF.z * A.sleep,
        'YXZ',
      );
      b.scale.set(1 - WF.su * A.sleep, 1 - WF.sv * A.sleep, 1);
    }
    M.sealGem.emissiveIntensity = 0.55 + Math.sin(t * 1.1) * 0.08 + 1.0 * A.sigil;
    M.sealGold.emissiveIntensity = 0.16 + 0.5 * A.sigil;
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0.02, 0.76, -0.06), radius: 1.02, rig, act };
}
