// Luminael, the Morningstar Pegasus (model lab version): a pegasus that appears in the first light of dawn. The scriptures of the Dawnlight Holy See record it as the "Envoy of Truth", but it has never spoken for anyone.
// It keeps the five things that made the old model easiest to recognize: a pure white horse body, a pair of white wings with gold tips, the morning star on the forehead, a mane and long tail in dawn colors (milk white, champagne gold to apricot, rose), and gold hooves.
// Body shape follows the lore: a horse with wings, not drifting toward a humanoid, and not made by modifying a wolf's or lion's body. The old version was a body of three stacked balls, legs of thin tubes with joint balls, and six separate fan-shaped feather pieces,
// surrounded by halos, light rings, stardust and holy-light patterns all over the body; this one is one whole lofted horse body: a deep chest, a round rump, a slightly dipped back line, and the neck arching all the way to the head;
// thick legs and big hooves, the hocks folded back, the leg roots tucked into the torso and in the same outline group as the torso. The left foreleg nearer the camera is lifted (it is about to walk away, not waiting for anyone).
// At the rings where the neck base and wing roots enter the torso, the vertex normals join onto the torso surface (blendNormalsInto): the shading is continuous, there is no collar line on the chest, and the wing roots do not look like boards stuck into the back.
// Wings: growing from the shoulder blades and sweeping up and out in a V, the wing surfaces half facing forward, so the whole wing can be seen from both the front and the back. Each wing is only three layers of feather sheet joined into one
// (the lesser coverts joined to the wing bone, the greater coverts, the flight feathers; sheetGeo), the trailing edge cut into individual round-headed feather tips with grooves pressed in between feathers; the primaries spread back from the metacarpal into a few separate long fingers,
// the outermost one shorter, so the wing tip is round. It is not made of separate feather pieces (that would look like armor plates). The ends of the flight feathers are tinted a faint morning-light gold.
// Face: the eyes hang on a head frame with no pitch, so the head tilts down while the gaze stays level; a horse's eyes sit on the side of the head, dark brown close to black, no sclera showing, horizontal pupils, a small point of highlight,
// half buried in the skull, with no eyelashes or brow lines, and the eyelids appear only when blinking. The morning star on the forehead is a four-pointed star on a gold base, lying flat on the forehead and not projecting as a horn.
// Personality: a witness who speaks for no one, quiet, clear-headed and noble. Head high, neck arched, mouth shut tight; the pair of dark horse eyes on the sides of the head open and looking level ahead, both ears pricked forward.
// Gaze order: the face (the dark horse eyes, the gold morning star on the forehead) first, the raised wings and the feather tips second, and the mane, long tail and gold hooves as support.
// Back: the primaries of the left wing (+x) are missing one, with only a length of new feather, still in its sheath, coming out of the gap. The "Feather of Truth" that the Dawnlight Holy See enshrines in the cathedral fell from here,
// and it is the only thing it ever left them. Under the wings is a long tail in dawn colors hanging all the way to the hocks.
// Restrained light effects: the old version's halo, dawn light ring, stardust, rotating morning star, glowing mane and holy-light patterns are removed; the only emissive left is the morning star on the forehead, with no reliance on bloom.
// <Action table> (weights tweened by performances, 0-1; flap is -1 to 1)
//   focus: stop looking around and look straight ahead. rear: rearing up, the body turning up about the hind-leg roots by about 41°, the forelegs lifted forward from the shoulder, the knees folded back on the CPU (the hind feet stay on the ground).
//   raise: head thrown back (a long neigh). spread: both wings' V spread open, the wing surfaces turned straight forward. flap: manual wing flapping (-1 raised high, 1 pressed to the lowest; one downstroke is -1 → 1).
//   beat: the amplitude of continuous flapping (1.6 beats per second). star: the morning star on the forehead lights up and enlarges slightly (the halo is added by the performance's effect object; spirits take no bloom).
//   back: backlight, a wide rim light on the upper edge of the silhouette (done in the material, not by bloom); backDawn: the color of the rim light, 0 dusk gold, 1 dawn blue.
// Anchors: head (center of the face), eyes (the surface of the eyes), mouth, star (top of the morning star on the forehead), chest, tail (the end of the tail),
//   wingL / wingR (wing roots, L being its own left, +x), wingTipL / wingTipR (ends of the outermost flight feathers), hoofL / hoofR (forehooves), hoofHL / hoofHR (hind hooves).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, furCollar, lathe, loft, outline, partKit, PI, rng, slab, smooth, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';
import type { SpiritMaterial } from '../spiritToon.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const ss = THREE.MathUtils.smoothstep;

/** The two colors of the backlight rim (dusk gold, dawn blue); the rim light itself is toonKit's uBack */
const BACK_DUSK = new THREE.Color(0xffc45a);
const BACK_DAWN = new THREE.Color(0xa8d0ff);

// ───────────────────────── Helpers for the face-count budget (SSR 60,000 faces) ─────────────────────────

/**
 * An elliptical decal on a sphere (iris, pupil): longitude radius rx, latitude radius ry (radians), centered on +z. The outline and projection are the same as the n-point ellipse that sphereDecal in shapes.ts
 * lays down, but it is split into concentric rings instead (a fan of triangles in the center and rings quadrilaterals outside), the chord faces likewise do not sink into the sphere, and the face count is a tenth.
 */
function ovalDecal(rx: number, ry: number, r: number, n = 28, rings = 4): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const put = (lon: number, lat: number) => {
    const x = Math.cos(lat) * Math.sin(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(lon);
    pos.push(x * r, y * r, z * r);
    nor.push(x, y, z);
  };
  put(0, 0);
  for (let k = 1; k <= rings; k++)
    for (let j = 0; j < n; j++) put(Math.cos((j / n) * PI * 2) * rx * (k / rings), Math.sin((j / n) * PI * 2) * ry * (k / rings));
  const at = (k: number, j: number) => 1 + (k - 1) * n + (j % n);
  const idx: number[] = [];
  for (let j = 0; j < n; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let k = 1; k < rings; k++)
    for (let j = 0; j < n; j++) idx.push(at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j), at(k + 1, j + 1), at(k, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/**
 * Eyelid shell with thickness and a round lip edge: the same shape as lidGeometry in shapes.ts, with the segment counts adjustable.
 * Only the ring near the lip edge can be seen, so the outline sampling is concentrated toward the lip edge; radial segments around the axis, n segments per face, lipN segments for the round lip.
 */
function lidGeo(ri: number, ro: number, lip: number, radial = 32, n = 6, lipN = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const at = (i: number) => { const u = i / n; return lip * u * (1.5 - 0.5 * u); };
  for (let i = 0; i <= n; i++) prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(at(i))), ri * Math.cos(at(i))));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < lipN; i++) {
    const b = (i / lipN) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = n; i >= 0; i--) prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(at(i))), ro * Math.cos(at(i))));
  return smooth(new THREE.LatheGeometry(prof, radial));
}

/** Keep 8 columns per tuft: the notch, the tip, one column on each side of each, and one column for each of the two flat stretches */
const FOLD_W = [0, 1 / 12, 3 / 12, 5 / 12, 6 / 12, 7 / 12, 9 / 12, 11 / 12];
/** Divide each tuft evenly into n columns (small tufts of fur, with the notch and the tip always landing on sample points) */
const evenW = (n: number) => Array.from({ length: n }, (_, k) => k / n);

/**
 * The furCollar mesh is column by column (12 columns per tuft), 29 vertices per column (the outer side from fur root to fur tip, k = 0..14, then back from the inner side to the root).
 * Only some of the columns and cross-section points are kept and the triangles reconnected; the shape, vertex colors and vertex normals all reuse the values computed on the original fine mesh.
 * Columns: ws is the positions kept within each tuft (0 is the notch between tufts, 0.5 is the fur tip, aligned by phase). The notch and the tip are fold lines, with one extra column kept on each side
 * (FOLD_W), so the triangles beside a fold line are exactly the same as the original, the normals change just as steeply across the fold line, and the lines between tufts do not fade;
 * only the flat stretches on the two sides are sampled more sparsely.
 * Cross-section: the ks points (14 is the fur tip and must be there); when there is a tint, the points on both sides of the color-change position are added automatically, so the color-change boundary from fur root to fur tip does not widen.
 */
function thinCollar(g: THREE.BufferGeometry, o: FurCollarOpts, ws: number[] = FOLD_W, ks0 = [0, 2, 4, 6, 8, 10, 12, 13, 14]): THREE.BufferGeometry {
  const span = (o.a1 ?? PI) - (o.a0 ?? -PI);
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * 12));
  const J = 29;
  const phase = o.phase ?? 0;
  const set = new Set<number>(full ? [] : [0, nT]);
  for (let m = -1; m <= Math.ceil(o.tufts) + 1; m++)
    for (const w of ws) {
      const i = Math.round(((m + w - phase) * nT) / o.tufts);
      if (full) set.add(((i % nT) + nT) % nT);
      else if (i >= 0 && i <= nT) set.add(i);
    }
  const cols = [...set].sort((a, b) => a - b);
  const kset = new Set(ks0);
  if (o.tint) {
    const kt = o.tint[2] * 14;
    for (const k of [Math.floor(kt), Math.ceil(kt)]) if (k >= 0 && k <= 14) kset.add(k);
  }
  const ks = [...kset].sort((a, b) => a - b);
  const js = [...ks, ...ks.slice(0, -1).reverse().map((k) => J - 1 - k)];
  const old = g.index!.array;
  // The original winding: whether the first triangle is (a, b, d) or the flipped (a, d, b)
  const flipped = old[1] !== J;
  const idx: number[] = [];
  const nc = full ? cols.length : cols.length - 1;
  for (let ci = 0; ci < nc; ci++) {
    const i = cols[ci];
    const i2 = cols[(ci + 1) % cols.length];
    for (let k = 0; k < js.length; k++) {
      const j = js[k];
      const j2 = js[(k + 1) % js.length];
      const a = i * J + j;
      const b = i2 * J + j;
      const c = i2 * J + j2;
      const d = i * J + j2;
      if (flipped) idx.push(a, d, b, b, d, c);
      else idx.push(a, b, d, b, c, d);
    }
  }
  g.setIndex(idx);
  return g;
}

// ───────────────────────── Shape ─────────────────────────

/** Multi-stop gradient: stops are [position, color], with smoothstep transitions between stops, so interpolated vertex colors show no sawtooth */
function ramp(stops: [number, number][], t: number, out = new THREE.Color()): THREE.Color {
  out.set(stops[0][1]);
  const tmp = new THREE.Color();
  for (let i = 1; i < stops.length; i++) {
    const k = ss(t, stops[i - 1][0], stops[i][0]);
    if (k > 0) out.lerp(tmp.set(stops[i][1]), k);
  }
  return out;
}

interface SheetOpts {
  /** The position at s (0-1) on the root curve */
  root: (s: number) => THREE.Vector3;
  /** The direction the feather (tuft of hair) grows out from the root at s */
  dir: (s: number) => THREE.Vector3;
  /** The direction at the end: if given, it turns smoothly from dir to tipDir, and the feathers and tufts curve */
  tipDir?: (s: number) => THREE.Vector3;
  /** The normal of the sheet at s (the upper side); the thickness and the bend both follow it */
  nrm: (s: number) => THREE.Vector3;
  /** The length at s */
  len: (s: number) => number;
  /** How many feathers (tufts of hair) this sheet is divided into */
  count: number;
  /** The proportion by which the end is shortened between roots */
  notch: number | ((s: number) => number);
  /** Pointed tip (tufts) or round tip (feathers) */
  pointed?: boolean;
  /** How many strands the end of each tuft is further split into, and the depth of the notches between strands (the raggedness of hair, not tuft-by-tuft sawteeth) */
  strands?: number;
  strandNotch?: number;
  /** The length multiplier of the k-th one (applied only to the end section, continuous at the junction) */
  tipScale?: (k: number) => number;
  /** The half thickness at the thickest point */
  thick: (s: number) => number;
  /** The amount of bending toward the normal along v (0 at the root to 1 at the end) (multiplied by length) */
  curl?: (s: number, v: number) => number;
  /** The depth of the grooves in the surface between roots */
  groove?: number;
  phase?: number;
  jitter?: number;
  seed?: number;
  /** Vertex color: s, v, c (1 is the midline of a feather, 0 is between two) */
  color?: (s: number, v: number, c: number) => THREE.ColorRepresentation;
  /** The number of samples per feather, and the number of samples on a half circle of the cross-section */
  per?: number;
  segV?: number;
  /** The range at the two ends of the sheet (s = 0, 1) where it thins and closes */
  fade?: [number, number];
  /** How blunt the cross-section is: 0.5 is very round and 1 is lens-shaped */
  blunt?: number;
}

/**
 * A feather sheet or hair sheet joined into one piece: growing from the root curve along dir, the cross-section a lens shape with thickness (a closed ring, no opening),
 * the end cut into individual round-headed feather tips (or pointed tufts) with grooves pressed in between roots. The whole sheet is one part, and the outline falls only on the edges of the feather tips and the grooves,
 * and does not draw a ring of line around every single feather the way separate feather pieces would. The three layers of the wing, the mane and the forelock all use it.
 */
function sheetGeo(o: SheetOpts): THREE.BufferGeometry {
  const per = o.per ?? 12;
  const nS = Math.round(o.count * per) + 1;
  const segV = o.segV ?? 12;
  const J = segV * 2;
  const rand = rng(o.seed ?? 7);
  const vary = Array.from({ length: o.count + 3 }, () => 1 + (rand() - 0.5) * 2 * (o.jitter ?? 0.1));
  const [f0, f1] = o.fade ?? [0.04, 0.04];
  const blunt = o.blunt ?? 0.6;
  const groove = o.groove ?? 0.3;
  const pos: number[] = [];
  const col: number[] = [];
  const tc = new THREE.Color();
  const P = new THREE.Vector3();
  for (let i = 0; i < nS; i++) {
    const s = i / (nS - 1);
    const u = s * o.count + (o.phase ?? 0);
    const k = Math.floor(u);
    const w = u - k;
    const c = 1 - Math.abs(2 * w - 1);
    const shape = o.pointed ? Math.pow(c, 0.8) : Math.sqrt(Math.max(0, 1 - (1 - c) * (1 - c)));
    const kk = ((k % vary.length) + vary.length) % vary.length;
    const tip = vary[kk] * (o.tipScale ? o.tipScale(k) : 1);
    const notch = typeof o.notch === 'number' ? o.notch : o.notch(s);
    let L = o.len(s) * (1 - notch + notch * shape * tip);
    if (o.strands) {
      const u2 = u * o.strands + 0.5;
      const c2 = 1 - Math.abs(2 * (u2 - Math.floor(u2)) - 1);
      L *= 1 - (o.strandNotch ?? 0.1) * (1 - Math.pow(c2, 0.7)) * shape;
    }
    const R = o.root(s);
    const d0 = o.dir(s).normalize();
    const dd = o.tipDir ? o.tipDir(s).normalize().sub(d0) : new THREE.Vector3();
    const N = o.nrm(s).normalize();
    const e = (f0 > 0 ? ss(s, 0, f0) : 1) * (f1 > 0 ? ss(1 - s, 0, f1) : 1);
    const th = o.thick(s) * e * (0.82 + 0.18 * c);
    for (let j = 0; j < J; j++) {
      const a = (j / J) * PI * 2;
      const vv = (1 - Math.cos(a)) / 2;
      const sn = Math.sin(a);
      const env = Math.sign(sn) * Math.pow(Math.abs(sn), blunt) * (1 - 0.65 * vv) * (1 - groove * (1 - c) * vv);
      const cu = o.curl ? o.curl(s, vv) : 0;
      P.copy(R)
        .addScaledVector(d0, L * vv)
        .addScaledVector(dd, L * vv * vv * 0.5)
        .addScaledVector(N, cu * L + env * th);
      pos.push(P.x, P.y, P.z);
      tc.set(o.color ? o.color(s, vv, c) : 0xffffff);
      col.push(tc.r, tc.g, tc.b);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nS - 1; i++)
    for (let j = 0; j < J; j++) {
      const a = i * J + j;
      const b = (i + 1) * J + j;
      const a1 = i * J + ((j + 1) % J);
      const b1 = (i + 1) * J + ((j + 1) % J);
      idx.push(a, b, a1, b, b1, a1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check: the normal on the upper side at the middle must face nrm, and if reversed it is flipped
  const im = Math.floor(nS / 2);
  const nm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, im * J + Math.floor(J / 4));
  if (nm.dot(o.nrm(im / (nS - 1)).normalize()) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/**
 * Bend geometry that grows along -y (y from 0 to -len, such as furCollar) along a curve: -y corresponds to the arc length of the curve, x to the lateral direction side, and z to the other direction.
 * It returns each vertex's position s on the curve, for applying a gradient color.
 */
function bendAlong(g: THREE.BufferGeometry, pts: THREE.Vector3[], side: THREE.Vector3): Float32Array {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const p = g.attributes.position as THREE.BufferAttribute;
  g.computeBoundingBox();
  const len = -g.boundingBox!.min.y;
  const sArr = new Float32Array(p.count);
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const s = THREE.MathUtils.clamp(-p.getY(i) / len, 0, 1);
    sArr[i] = s;
    path.getPointAt(s, C);
    path.getTangentAt(s, T);
    W.copy(side).addScaledVector(T, -T.dot(side)).normalize();
    H.crossVectors(T, W);
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setXYZ(i, C.x + W.x * x + H.x * z, C.y + W.y * x + H.y * z, C.z + W.z * x + H.z * z);
  }
  g.computeVertexNormals();
  return sArr;
}

/**
 * Normal transfer at a seam: at the ring where a part is inserted into the torso, the vertex normals lean toward the torso surface's normals.
 * Where two faces meet at a large angle, the toon shading breaks into a line at the junction and the outline also draws a crease, making it look stuck on;
 * once the normals are joined the shading is continuous, and the neck and wing roots grow out of the body.
 * The torso surface is looked up by its own vertices and normals: find the nearest vertex, measure with its normal how far from the surface (h), and within d1 gradually switch to the torso's normals.
 * offset is the position of the part's group in the body's coordinates.
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

/** Four-pointed morning star: two long points up and down, two short points left and right, eight facets on the top face, a flat bottom; lying flat in the xz plane with the top toward +y, the long points along z */
function starGem(rLong: number, rShort: number, rIn: number, h: number): THREE.BufferGeometry {
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    const r = i % 2 ? rIn : i % 4 === 0 ? rLong : rShort;
    ring.push(v(Math.sin(a) * r, 0, Math.cos(a) * r));
  }
  const top = v(0, h, 0);
  const bot = v(0, -h * 0.2, 0);
  const pos: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 8];
    pos.push(...top.toArray(), ...a.toArray(), ...b.toArray());
    pos.push(...bot.toArray(), ...b.toArray(), ...a.toArray());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildLuminaelLab(): LabModel {
  const RIMC = 0xffdcc4;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const WHITE = 0xfbf8ff;
  const MUZZLE = 0xe6ccd6;
  // Dawn colors: milk white, champagne gold, apricot orange, rose
  const CREAM = 0xfff4e2;
  const CHAMP = 0xffdc98;
  const APRICOT = 0xffba8c;
  const ROSE = 0xf4a0b2;
  const GOLDTIP = 0xf8d88c;
  const M = {
    coat: labToon(WHITE, { rim: 0.55, rimColor: RIMC }),
    coatVC: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    feather: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    hair: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    gold: labToon(0xe8b64a, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6, rimColor: 0xffe6b0 }),
    star: labToon(0xffe6a0, { ramp: 'gem', emissive: 0xffb43a, emissiveAmt: 0.45, spec: 1.4, specTh: 0.88, rim: 0.5, rimColor: 0xfff0c8 }),
    // Horse eye: dark brown close to black, the vertex colors only darkening
    eye: vc(labToon(0x3a2418, { ramp: 'gem', rim: 0 })),
    pupil: labToon(0x0c0806, { rim: 0 }),
    line: labToon(0x4a3858, { rim: 0 }),
    lineSoft: labToon(0x8a7894, { rim: 0 }),
    quill: labToon(0xf3e2c4, { rim: 0.5, rimColor: RIMC }),
    nostril: labToon(0x5a3a4c, { rim: 0 }),
    muzzle: labToon(MUZZLE, { rim: 0.4, rimColor: RIMC }),
    earIn: labToon(0xe8c8d4, { rim: 0.3 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  // Backlight (for performances, act.back): a wide rim light along the edge of the silhouette of the fur, feathers, mane and gold ornaments, overriding the base color; the direction is up in the frame and slightly behind the camera.
  // The color is switched between dusk gold and dawn blue by act.backDawn. When act.back is 0 it does nothing, and the usual look is pixel-for-pixel unchanged
  const BACK_MATS = [M.coat, M.coatVC, M.feather, M.hair, M.gold, M.quill, M.muzzle, M.earIn] as SpiritMaterial[];

  const root = new THREE.Group();
  root.name = 'luminael-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group. The torso, neck and the lesser coverts at the wing roots are one group, so the wings read as growing from the shoulder; the skull, face, cheeks and eyelids are one group
  const BODY = 9301;
  const HEAD = 9302;
  const TAIL = 9303;

  /** Place a ring of fur: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal */
  const collar = (parent: THREE.Object3D, mat: THREE.Material, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup?: number) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, furCollar(o), mat);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };

  // Body (rising and falling slightly with breathing); the four feet hang directly on root, so they stand firmly on the ground
  const body = group(root);

  // ── Torso: one whole loft, the rump round, the back line slightly dipped, the chest deep ──
  const torsoPts = [v(0, 0.86, -0.54), v(0, 0.88, -0.39), v(0, 0.84, -0.14), v(0, 0.85, 0.1), v(0, 0.86, 0.3), v(0, 0.8, 0.45)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.03, 0.13, 0.14, 0.01],
    [0.09, 0.2, 0.21, 0.01],
    [0.2, 0.215, 0.23, 0],
    [0.4, 0.19, 0.22, -0.025],
    [0.6, 0.19, 0.23, -0.025],
    [0.78, 0.2, 0.235, -0.015],
    [0.9, 0.185, 0.21, -0.01],
    [0.97, 0.13, 0.14, -0.01],
    [1, 0, 0, 0],
  ]);
  const torsoGeo = loft(torsoPts, torsoProf, { segs: 52, radial: 28 });
  const torso = add(body, torsoGeo, M.coat);
  torso.userData.inkGroup = BODY;
  // ── Neck: arching up from above the chest and joining all the way to the head; the normals at the ring where it enters the torso join onto the torso, so the shading is continuous with no collar line ──
  const neckPts = [v(0, 0.84, 0.18), v(0, 1.1, 0.32), v(0, 1.3, 0.44), v(0, 1.45, 0.57)];
  const neckProf = curveTable([[0, 0, 0, 0], [0.05, 0.17, 0.22, 0], [0.2, 0.155, 0.22, -0.025], [0.35, 0.12, 0.16, 0.015], [0.65, 0.1, 0.135, 0.008], [0.9, 0.092, 0.12, -0.012], [1, 0, 0, 0]]);
  const neckGeo = loft(neckPts, neckProf, { segs: 30, radial: 24 });
  blendNormalsInto(neckGeo, torsoGeo, 0.07);
  add(body, neckGeo, M.coat).userData.inkGroup = BODY;
  const neckPath = new THREE.CatmullRomCurve3(neckPts, false, 'centripetal');
  /** The cross-section coordinate frame of the neck at t (the same as loft: W toward -x, H toward the back side) */
  const nFrame = (t: number) => {
    const C = neckPath.getPointAt(t);
    const T = neckPath.getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, UP).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [a, b, dy] = neckProf(t);
    return { C, T, W, H, a, b, dy };
  };

  // ── Limbs: forelegs straight, hocks of the hind legs folded back; legs thick and hooves big. The left foreleg (+x) nearer the camera is lifted ──
  const LEGSIDE = X;
  const hoofGeo = lathe([[0.001, 0], [0.068, 0], [0.072, 0.008], [0.068, 0.03], [0.058, 0.066], [0.05, 0.078], [0.001, 0.08]], 28);
  const hoofFur: FurCollarOpts = { r0: 0.046, len: 0.075, thick: 0.03, flare: 0.55, curl: 0.25, tufts: 7, notch: 0.45, seed: 61, tint: [WHITE, CREAM, 0.6] };
  const hoof = (parent: THREE.Object3D, at: THREE.Vector3, up: THREE.Vector3) => {
    const g = group(parent, [at.x, at.y, at.z]);
    g.quaternion.setFromUnitVectors(UP, up.clone().normalize());
    add(g, hoofGeo, M.gold, [0, 0, 0], [0, 0, 0], [1, 1, 1.12]);
    // A ring of white feathering on the hoof (the wing's feathers grow a little on the feet too)
    add(g, thinCollar(furCollar(hoofFur), hoofFur, evenW(6), [0, 3, 6, 9, 11, 13, 14]), M.hair, [0, 0.105, 0]);
    return g;
  };
  const foreProf = curveTable([[0, 0, 0], [0.03, 0.075, 0.1], [0.12, 0.095, 0.125], [0.35, 0.08, 0.095], [0.55, 0.062, 0.07], [0.68, 0.06, 0.066], [0.76, 0.05, 0.055], [0.85, 0.05, 0.055], [0.91, 0.058, 0.064], [0.96, 0.05, 0.054], [1, 0, 0]]);
  const hindProf = curveTable([[0, 0, 0], [0.03, 0.12, 0.15], [0.12, 0.15, 0.2], [0.3, 0.115, 0.145], [0.5, 0.07, 0.085], [0.62, 0.058, 0.07], [0.69, 0.054, 0.07], [0.76, 0.048, 0.054], [0.86, 0.048, 0.054], [0.92, 0.058, 0.064], [0.97, 0.05, 0.054], [1, 0, 0]]);
  /**
   * Knee joint: the foreleg is one whole loft, and when rearing the vertices below the knee are rotated about the knee on the CPU (the weights blending smoothly along the shin, with position and normal at the same angle),
   * with the hoof turning to the end of the shin. It is not recomputed if the angle has not changed.
   */
  const knee = (mesh: THREE.Mesh, hoofG: THREE.Group, K: THREE.Vector3, D: THREE.Vector3) => {
    const g = mesh.geometry;
    const pa = g.attributes.position as THREE.BufferAttribute;
    const na = g.attributes.normal as THREE.BufferAttribute;
    pa.setUsage(THREE.DynamicDrawUsage);
    na.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const p0 = Float32Array.from(pa.array as Float32Array);
    const n0 = Float32Array.from(na.array as Float32Array);
    const w = new Float32Array(pa.count);
    const P = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) w[i] = ss(P.fromArray(p0, i * 3).sub(K).dot(D), -0.015, 0.035);
    const hp = hoofG.position.clone();
    const hq = hoofG.quaternion.clone();
    const q = new THREE.Quaternion();
    let last = 0;
    return (a: number) => {
      if (Math.abs(a - last) < 1e-4) return;
      last = a;
      for (let i = 0; i < pa.count; i++) {
        const k = i * 3;
        const ang = a * w[i];
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const y = p0[k + 1] - K.y;
        const z = p0[k + 2] - K.z;
        pa.setXYZ(i, p0[k], K.y + y * c - z * sn, K.z + y * sn + z * c);
        na.setXYZ(i, n0[k], n0[k + 1] * c - n0[k + 2] * sn, n0[k + 1] * sn + n0[k + 2] * c);
      }
      pa.needsUpdate = true;
      na.needsUpdate = true;
      q.setFromAxisAngle(X, a);
      hoofG.position.copy(hp).sub(K).applyQuaternion(q).add(K);
      hoofG.quaternion.copy(q).multiply(hq);
    };
  };
  // The foreleg is wrapped in two layers of groups (follow, following the body rearing up, and shoulder, the shoulder joint), and the meshes are added in the same order as the original (the outline part indices do not change)
  const fores: { follow: THREE.Group; shoulder: THREE.Group; sx: number; fold: (a: number) => void }[] = [];
  const foreHooves: THREE.Group[] = [];
  const hindHooves: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    // Foreleg
    const fp = sx < 0
      ? [v(sx * 0.1, 0.92, 0.3), v(sx * 0.14, 0.6, 0.25), v(sx * 0.14, 0.34, 0.28), v(sx * 0.14, 0.14, 0.29), v(sx * 0.14, 0.05, 0.32)]
      : [v(sx * 0.1, 0.92, 0.3), v(sx * 0.14, 0.64, 0.31), v(sx * 0.145, 0.53, 0.47), v(sx * 0.145, 0.35, 0.44), v(sx * 0.145, 0.29, 0.39)];
    const follow = group(root);
    const shoulder = group(follow, [fp[0].x, fp[0].y, fp[0].z]);
    const off = group(shoulder, [-fp[0].x, -fp[0].y, -fp[0].z]);
    const legMesh = add(off, loft(fp, foreProf, { segs: 32, radial: 16, side: LEGSIDE }), M.coat);
    legMesh.userData.inkGroup = BODY;
    const fPath = new THREE.CatmullRomCurve3(fp, false, 'centripetal');
    if (sx < 0) foreHooves.push(hoof(off, v(sx * 0.14, 0, 0.33), UP));
    else {
      const T = fPath.getTangentAt(1);
      foreHooves.push(hoof(off, fPath.getPointAt(0.93).addScaledVector(T, 0.075), T.clone().negate()));
    }
    // Knee (wrist joint): on the upright right foreleg at half height; the lifted left foreleg is already folded at the knee
    const K = sx < 0 ? v(sx * 0.14, 0.44, 0.27) : fp[2].clone();
    const D = sx < 0 ? v(0, -1, 0.03).normalize() : fp[4].clone().sub(fp[2]).normalize();
    fores.push({ follow, shoulder, sx, fold: knee(legMesh, foreHooves[foreHooves.length - 1], K, D) });
    // Hind leg
    const hp = [v(sx * 0.11, 0.92, -0.38), v(sx * 0.155, 0.62, -0.26), v(sx * 0.14, 0.36, -0.46), v(sx * 0.14, 0.14, -0.42), v(sx * 0.14, 0.05, -0.39)];
    add(root, loft(hp, hindProf, { segs: 36, radial: 16, side: LEGSIDE }), M.coat).userData.inkGroup = BODY;
    hindHooves.push(hoof(root, v(sx * 0.14, 0, -0.38), UP));
  }

  // ── Wings: growing from the shoulder blades and sweeping up and back. Three layers of feather sheet joined into one: the lesser coverts (joined to the wing bone, with a blunt rounded leading edge), the greater coverts, the flight feathers ──
  const wings: THREE.Group[] = [];
  /** Wing-tip anchor (the end of the outermost flight feather, moving with the wing) */
  const wingTips: THREE.Group[] = [];
  /** The flight feather missing from the left wing (+x): the "Feather of Truth" */
  const RELIC = 8;
  for (const sx of [-1, 1]) {
    const R0 = v(sx * 0.09, 0.965, 0.1);
    const wg = group(body, [R0.x, R0.y, R0.z]);
    wings.push(wg);
    // Wing-surface coordinates: A goes up along the wing bone (leaning outward into a V), B faces forward, N faces outward; then rotated about A by beta so the wing surface half faces forward
    const V = 0.5;
    const A = v(sx * Math.sin(V), Math.cos(V), -0.12).normalize();
    const B = v(0, 0, 1).addScaledVector(A, -A.z).normalize();
    const N = new THREE.Vector3().crossVectors(A, B).multiplyScalar(sx).normalize();
    const beta = 0.8;
    const B2 = B.clone().multiplyScalar(Math.cos(beta)).addScaledVector(N, -Math.sin(beta));
    const N2 = N.clone().multiplyScalar(Math.cos(beta)).addScaledVector(B, Math.sin(beta));
    const L = (x: number, y: number, z: number) => A.clone().multiplyScalar(x).addScaledVector(B2, y).addScaledVector(N2, z);
    const bone = new THREE.CatmullRomCurve3([L(-0.16, -0.03, -0.12), L(0.2, 0.05, 0), L(0.42, 0.07, 0), L(0.58, 0.04, -0.02), L(0.7, 0.0, -0.05)], false, 'centripetal');
    const psi = curveTable([[0, -0.4], [0.3, -0.1], [0.6, 0.3], [0.85, 0.58], [1, 0.72]]);
    const fdir = (s: number) => { const p = psi(s)[0]; return L(Math.sin(p), -Math.cos(p), -0.15).normalize(); };
    const fnrm = (s: number) => {
      const n = new THREE.Vector3().crossVectors(bone.getTangentAt(Math.min(0.999, s)), fdir(s)).normalize();
      return n.dot(N2) < 0 ? n.negate() : n;
    };
    const lenF = curveTable([[0, 0.3], [0.3, 0.4], [0.55, 0.5], [0.72, 0.58], [0.84, 0.6], [0.94, 0.5], [1, 0.36]]);
    const cup = (_s: number, vv: number) => -0.12 * vv * vv;
    // Flight feathers: the longest layer, the primaries spread a little wider apart; the ends tinted morning-light gold, the primaries more strongly than the secondaries
    add(wg, sheetGeo({
      root: (s) => bone.getPointAt(s).addScaledVector(fdir(s), 0.02),
      dir: fdir,
      nrm: fnrm,
      len: (s) => lenF(s)[0] * (0.3 + 0.7 * ss(s, 0, 0.16)),
      count: 11,
      phase: 0,
      per: 8,
      segV: 8,
      notch: (s) => 0.16 + 0.34 * ss(s, 0.45, 0.75),
      tipScale: (k) => (sx > 0 && k === RELIC ? -0.62 : 1),
      thick: (s) => 0.012 * (1 - 0.3 * s),
      curl: cup,
      groove: 0.45,
      jitter: 0.05,
      seed: 3 + sx,
      fade: [0.02, 0.05],
      // The missing one grows only a length of new feather, not yet tinted morning-light gold
      color: (s, vv) => (sx > 0 && Math.floor(s * 11) === RELIC ? ramp([[0.3, WHITE], [0.9, CREAM]], vv) : ramp([[0, WHITE], [0.68, WHITE], [0.95, GOLDTIP]], vv * (0.8 + 0.2 * ss(s, 0.3, 0.7)))),
    }), M.feather);
    // Greater coverts: covering the roots of the flight feathers, the feather tips round and short
    add(wg, sheetGeo({
      root: (s) => bone.getPointAt(s * 0.9).addScaledVector(fdir(s * 0.9), 0.008),
      dir: (s) => fdir(s * 0.9),
      nrm: (s) => fnrm(s * 0.9),
      len: (s) => lenF(s * 0.9)[0] * 0.48 * (0.3 + 0.7 * ss(s, 0, 0.16)),
      count: 10,
      phase: 0.5,
      per: 6,
      segV: 8,
      notch: 0.22,
      thick: () => 0.02,
      curl: cup,
      groove: 0.35,
      seed: 11 + sx,
      fade: [0.02, 0.12],
      color: () => WHITE,
    }), M.feather);
    // Lesser coverts: joined to the wing bone, the leading edge blunt and round, the roots buried in the shoulder; in the same group as the torso, so the wing reads as grown
    const lesser = sheetGeo({
      root: (s) => bone.getPointAt(s * 0.82).addScaledVector(fdir(s * 0.82), -0.01),
      dir: (s) => fdir(s * 0.82),
      nrm: (s) => fnrm(s * 0.82),
      len: (s) => (0.14 + 0.06 * Math.sin(PI * s)) * (0.25 + 0.75 * ss(s, 0, 0.2)),
      count: 9,
      phase: 0.5,
      per: 6,
      segV: 8,
      notch: 0.25,
      thick: (s) => 0.034 * (1 - 0.35 * s) * (0.45 + 0.55 * ss(s, 0, 0.3)),
      curl: cup,
      groove: 0.3,
      blunt: 0.45,
      seed: 21 + sx,
      fade: [0.03, 0.14],
      color: () => WHITE,
    });
    // The section where the wing root enters the shoulder, with normals joined onto the torso: the shading is continuous, and it does not look like a board stuck into the back
    blendNormalsInto(lesser, torsoGeo, 0.05, R0);
    add(wg, lesser, M.feather).userData.inkGroup = BODY;
    // Wing tip: the point at the end of the flight feathers farthest from the wing root
    {
      let best = -1;
      const tip = new THREE.Vector3();
      for (let i = 0; i <= 40; i++) {
        const s = 0.6 + (i / 40) * 0.4;
        const p = bone.getPointAt(s).addScaledVector(fdir(s), 0.02 + lenF(s)[0]);
        if (p.length() > best) [best, tip.x, tip.y, tip.z] = [p.length(), p.x, p.y, p.z];
      }
      wingTips.push(group(wg, [tip.x, tip.y, tip.z]));
    }
    // The position of the missing flight feather: a length of new feather that has just come out, still wrapped in its sheath, with the end only just beginning to fan out
    if (sx > 0) {
      const sR = (RELIC + 0.5) / 11;
      const d = fdir(sR);
      const n = fnrm(sR);
      const b0 = bone.getPointAt(sR).addScaledVector(d, 0.02);
      const L0 = lenF(sR)[0];
      const pin = [b0.clone().addScaledVector(d, L0 * 0.3), b0.clone().addScaledVector(d, L0 * 0.5).addScaledVector(n, -0.004), b0.clone().addScaledVector(d, L0 * 0.74).addScaledVector(n, -0.01)];
      const side = new THREE.Vector3().crossVectors(n, d).normalize();
      add(wg, loft(pin, curveTable([[0, 0, 0], [0.12, 0.008, 0.006], [0.45, 0.012, 0.007], [0.8, 0.016, 0.005], [1, 0, 0]]), { segs: 20, radial: 12, side }), M.quill);
    }
  }

  // ── Mane: a whole sheet of hair hanging from the crest of the neck to the left side (+x), the trailing edge cut into clumps of pointed tips; the dawn colors going from milk white to rose ──
  const hairColor = (vv: number) => ramp([[0.2, CREAM], [0.75, CHAMP], [1.3, APRICOT]], vv);
  {
    const T0 = 0.9;
    const T1 = 0.1;
    const crest = (s: number) => {
      const f = nFrame(THREE.MathUtils.lerp(T0, T1, s));
      return { p: f.C.clone().addScaledVector(f.H, f.b + f.dy - 0.03), f };
    };
    // A whole sheet of long hair hanging from the crest of the neck over the side of the neck: a few big tufts, the ends further split into strands, curling back
    add(body, sheetGeo({
      root: (s) => crest(s).p,
      dir: (s) => { const { f } = crest(s); return f.W.clone().negate().multiplyScalar(0.85).addScaledVector(f.H, 0.25 + 0.15 * ss(s, 0, 0.3)).add(v(0, 0, -0.12)); },
      // The hair tips hang down with gravity and drift slightly back (not along the neck's back-side direction, which would curl into the neck)
      tipDir: (s) => { const { f } = crest(s); return f.W.clone().negate().multiplyScalar(0.38).add(v(0, -0.95, -0.16 - 0.22 * Math.sin(s * 11))); },
      nrm: (s) => { const { f } = crest(s); return f.H.clone().multiplyScalar(0.75).addScaledVector(f.W, -0.65); },
      len: (s) => (0.34 + 0.16 * Math.sin(PI * Math.min(1, s * 1.1))) * (0.55 + 0.45 * ss(s, 0, 0.25)),
      count: 5,
      pointed: true,
      notch: 0.55,
      strands: 3,
      strandNotch: 0.18,
      per: 12,
      segV: 10,
      thick: () => 0.07,
      curl: (_s, vv) => 0.05 * vv + 0.08 * vv * vv,
      groove: 0.2,
      jitter: 0.3,
      seed: 41,
      fade: [0.08, 0.12],
      blunt: 0.45,
      color: (_s, vv) => hairColor(vv),
    }), M.hair).userData.inkGroup = BODY;
  }

  // ── Tail: the tail root first kicks up and back, then hangs all the way to the hocks; two layers of long hair joined into a ring, bending along the curve, with a dawn-color gradient ──
  const tailG = group(body, [0, 0.95, -0.46]);
  {
    const pts = [v(0, 0, 0), v(0, 0.05, -0.14), v(0.02, -0.03, -0.28), v(0.06, -0.25, -0.36), v(0.1, -0.49, -0.34), v(0.13, -0.66, -0.26)];
    add(tailG, loft(pts.slice(0, 3), curveTable([[0, 0.05, 0.05], [0.6, 0.045, 0.045], [1, 0, 0]]), { segs: 20, radial: 14, side: X }), M.coat).userData.inkGroup = TAIL;
    // The tail hair bends along the curve, with a few more samples along the length kept; the points at the hair tips are all kept
    const TAIL_KS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const tailColor = (g: THREE.BufferGeometry, sArr: Float32Array, k: number) => {
      const c = g.attributes.color as THREE.BufferAttribute;
      const tc = new THREE.Color();
      for (let i = 0; i < c.count; i++) {
        ramp([[0.08, WHITE], [0.42, CREAM], [0.72, CHAMP], [0.93, APRICOT], [1.05, ROSE]], sArr[i] * k, tc);
        c.setXYZ(i, tc.r, tc.g, tc.b);
      }
    };
    const innerO: FurCollarOpts = { r0: 0.035, len: 0.8, thick: 0.1, flare: 0.12, curl: 0.05, tufts: 7, notch: 0.5, jitter: 0.2, seed: 71, tint: [WHITE, WHITE, 0.5] };
    const inner = furCollar(innerO);
    tailColor(inner, bendAlong(inner, pts, X), 1);
    thinCollar(inner, innerO, FOLD_W, TAIL_KS);
    add(tailG, inner, M.hair).userData.inkGroup = TAIL;
    const outerO: FurCollarOpts = { r0: 0.05, len: 0.4, thick: 0.08, flare: 0.28, curl: 0.25, tufts: 6, notch: 0.5, jitter: 0.2, phase: 0.5, seed: 72, tint: [WHITE, WHITE, 0.5] };
    const outer = furCollar(outerO);
    tailColor(outer, bendAlong(outer, pts.slice(0, 4), X), 0.6);
    thinCollar(outer, outerO, FOLD_W, TAIL_KS);
    add(tailG, outer, M.hair);
  }

  // ── Head: the neck pivot handles looking around. lvl is the head frame with no pitch (the eyes and ears hang here, so the gaze stays level), and head tilts down by PITCH ──
  const PITCH = 0.8;
  const neck = group(body, [0, 1.4, 0.52]);
  const lvl = group(neck, [0, 0.06, 0.06]);
  lvl.scale.setScalar(1.34);
  const head = group(lvl, [0, 0, 0], [PITCH, 0, 0]);
  const toLvl = (p: THREE.Vector3) => p.clone().applyAxisAngle(X, PITCH);

  add(head, new THREE.SphereGeometry(0.12, 32, 24), M.coat, [0, 0.0, 0.03], [0, 0, 0], [1.0, 0.86, 0.8]).userData.inkGroup = HEAD;
  // Face: one loft from the forehead to the nose bridge, the end of the muzzle swelling slightly; the muzzle tinted a faint rose gray (vertex colors, with a smooth boundary)
  {
    const g = loft([v(0, 0.035, 0.0), v(0, 0.014, 0.14), v(0, -0.008, 0.26), v(0, -0.016, 0.315)],
      curveTable([[0, 0, 0, 0], [0.06, 0.095, 0.085, 0], [0.3, 0.08, 0.074, 0], [0.58, 0.07, 0.07, -0.004], [0.8, 0.077, 0.075, -0.01], [0.93, 0.071, 0.068, -0.012], [1, 0, 0, 0]]), { segs: 36, radial: 28 });
    const p = g.attributes.position as THREE.BufferAttribute;
    const col: number[] = [];
    const tc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      tc.set(WHITE).lerp(new THREE.Color(MUZZLE), ss(p.getZ(i), 0.2, 0.27));
      col.push(tc.r, tc.g, tc.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    add(head, g, M.coatVC).userData.inkGroup = HEAD;
  }
  // Cheeks: a round patch at the rear and lower part of the horse's face
  for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(1, 20, 14), M.coat, [sx * 0.05, -0.06, 0.03], [0, sx * 0.25, 0], [0.047, 0.082, 0.088]).userData.inkGroup = HEAD;
  // Lower lip and chin: the boundary with the upper lip is the closed mouth
  add(head, new THREE.SphereGeometry(1, 20, 12), M.muzzle, [0, -0.056, 0.25], [0, 0, 0], [0.052, 0.03, 0.058]);
  // Nostrils: dark openings on the two sides of the front of the muzzle
  for (const sx of [-1, 1]) {
    const n = add(head, new THREE.SphereGeometry(1, 12, 8), M.nostril, [sx * 0.043, -0.008, 0.302], [0, 0, 0], [0.011, 0.019, 0.007]);
    n.quaternion.setFromUnitVectors(v(0, 0, 1), v(sx * 0.55, 0.05, 0.84).normalize());
  }

  // The morning star on the forehead: a four-pointed star on a gold base, the long points running up and down the forehead
  const sg = group(head, [0, 0.1, 0.075]);
  {
    sg.quaternion.setFromUnitVectors(UP, v(0, 1, -0.12).normalize());
    const setting: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      const r = i % 2 ? 0.018 : i % 4 === 0 ? 0.064 : 0.044;
      setting.push([Math.sin(a) * r, Math.cos(a) * r]);
    }
    const plate = slab(outline(setting), 0.008, 0.003, 2);
    plate.rotateX(-PI / 2);
    add(sg, plate, M.gold, [0, 0.002, 0]);
    add(sg, starGem(0.052, 0.035, 0.012, 0.013), M.star, [0, 0.007, 0]);
  }
  const starGemMesh = sg.children[sg.children.length - 1] as THREE.Mesh;

  // Eyes: a horse's eyes sit on the side of the head, dark brown close to black with almost no sclera showing, the pupil a horizontal dark ellipse; about seventeen percent of the head's width in diameter.
  // The eyes hang on the lvl frame with no pitch (the head tilts down while the gaze stays level): on the skull ellipsoid find the point whose normal faces forward and outward, and bury the eye forty percent along the normal.
  // The highlight is only a small point (the eye material's spec is 0); no eyelashes, no brow lines. The eyelids appear only when blinking, and the whole set is hidden when the eyes are open (reference.md pitfall 105).
  const ER = 0.02;
  const EMBED = 0.4;
  // The open-eye angle: the eyelid lips stop outside the range where the eyeball shows (the half angle of the exposed spherical cap is about 1.16); when blinking they meet slightly below the midline
  const UP_OPEN = 1.25;
  const LO_OPEN = 1.2;
  const LID_MEET = 0.14;
  const lids: THREE.Group[] = [];
  const lowers: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  /** Anchor at the center of the eye surface (the eye-light) */
  const eyeA: THREE.Group[] = [];
  const eyeBall = new THREE.SphereGeometry(ER, 16, 12);
  {
    // The upper half darker and the lower half letting through a little warm brown (the vertex colors only darkening)
    const pa = eyeBall.attributes.position as THREE.BufferAttribute;
    const c: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      const k = 0.62 + 0.38 * ss(-pa.getY(i) / ER, -0.55, 0.6);
      c.push(k, k, k);
    }
    eyeBall.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  const lidUp = lidGeo(ER + 0.002, ER + 0.0052, PI / 2, 16);
  const lidLow = lidGeo(ER + 0.0015, ER + 0.004, PI / 2, 16);
  const lidLine = lidGeo(ER + 0.001, ER + 0.0028, PI / 2, 16, 4, 3);
  // Skull ellipsoid (in the head's coordinates): center (0, 0, 0.03), half axes 0.12, 0.1032, 0.096
  const HC = v(0, 0, 0.03);
  const HA = v(0.12, 0.12 * 0.86, 0.12 * 0.8);
  for (const sx of [-1, 1]) {
    const f = v(sx * 0.75, 0.14, 0.65).normalize();
    // The point on the ellipsoid whose normal is n: p = (a²nx, b²ny, c²nz) / √(a²nx² + b²ny² + c²nz²); n is first turned back into the head's coordinates
    const n = f.clone().applyAxisAngle(X, -PITCH);
    const k = Math.hypot(HA.x * n.x, HA.y * n.y, HA.z * n.z);
    const at = toLvl(v((HA.x * HA.x * n.x) / k, (HA.y * HA.y * n.y) / k, (HA.z * HA.z * n.z) / k).add(HC)).addScaledVector(f, -ER * EMBED);
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    const eg = group(lvl, [at.x, at.y, at.z]);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    // The eyeball, pupil and highlight form a group of their own (the ultimate and corruption look at this group to find the eye's material); the gaze draws in slightly forward, with both eyes looking in the same direction
    const gaze = group(eg, [0, 0, 0], [0, -sx * 0.12, 0]);
    add(gaze, eyeBall, M.eye);
    add(gaze, ovalDecal(0.5, 0.2, ER + 0.0006, 20, 2), M.pupil);
    eyeA.push(group(gaze, [0, 0, ER]));
    // Highlight: one small point, on the same side for both eyes (the light comes from the same direction)
    const hl = add(gaze, new THREE.SphereGeometry(ER * 0.17, 8, 6), M.hi, [ER * 0.34, ER * 0.42, ER * 0.84], [0, 0, 0], [1, 1, 0.5]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    const upper = group(eg, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.coat).userData.inkGroup = HEAD;
    const upLine = group(eg, [0, 0, 0], [-UP_OPEN + 0.08, 0, 0]);
    add(upLine, lidLine, M.line);
    const lower = group(eg, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lower, lidLow, M.coat).userData.inkGroup = HEAD;
    const loLine = group(eg, [0, 0, 0], [PI + LO_OPEN - 0.06, 0, 0]);
    add(loLine, lidLine, M.lineSoft);
    lids.push(upper, upLine);
    lowers.push(lower, loLine);
  }

  // Ears: pointed ears pricked forward, a pale rose inner ear on the front; twitching now and then
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const at = toLvl(v(sx * 0.05, 0.075, -0.03));
    const eg = group(lvl, [at.x, at.y, at.z]);
    eg.quaternion.setFromUnitVectors(UP, v(sx * 0.22, 1, 0.12).normalize());
    const pts = [v(0, -0.03, 0), v(0, 0.06, 0.004), v(-sx * 0.006, 0.125, 0.004), v(-sx * 0.014, 0.165, -0.004)];
    add(eg, loft(pts, curveTable([[0, 0, 0], [0.06, 0.03, 0.021], [0.4, 0.034, 0.022], [0.8, 0.018, 0.014], [1, 0, 0]]), { segs: 24, radial: 16, side: X }), M.coat).userData.inkGroup = HEAD;
    add(eg, loft(pts.map((p) => p.clone().add(v(0, 0.004, 0.014))), curveTable([[0, 0, 0], [0.12, 0.02, 0.008], [0.5, 0.02, 0.008], [0.85, 0.008, 0.004], [1, 0, 0]]), { segs: 24, radial: 12, side: X }), M.earIn);
    ears.push(eg);
  }

  // Forelock: a small tuft hanging between the two ears, parted toward its right (-x), not covering the morning star
  add(head, sheetGeo({
    root: (s) => v(THREE.MathUtils.lerp(0.035, -0.035, s), 0.098, -0.04),
    dir: () => v(-0.3, 0.2, 1),
    tipDir: () => v(-0.85, -0.45, 0.45),
    nrm: () => v(0.15, 1, -0.15),
    len: (s) => 0.12 + 0.04 * s,
    count: 3,
    pointed: true,
    notch: 0.4,
    strands: 2,
    strandNotch: 0.14,
    per: 12,
    thick: () => 0.036,
    curl: (_s, vv) => 0.12 * vv,
    groove: 0.3,
    jitter: 0.15,
    seed: 51,
    fade: [0.15, 0.15],
    blunt: 0.5,
    color: (_s, vv) => hairColor(vv * 0.8),
  }), M.hair).userData.inkGroup = HEAD;

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // Anchors (for hooking into the game): all empty groups, following the action
  const rig = {
    head: group(head, [0, 0.0, 0.13]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [0, -0.045, 0.29]),
      star: group(sg, [0, 0.02, 0]),
      chest: group(body, [0, 0.74, 0.48]),
      tail: group(tailG, [0.13, -0.66, -0.26]),
      wingL: wings[1],
      wingR: wings[0],
      wingTipL: wingTips[1],
      wingTipR: wingTips[0],
      hoofL: foreHooves[1],
      hoofR: foreHooves[0],
      hoofHL: hindHooves[1],
      hoofHR: hindHooves[0],
    },
  };
  // Action weights (performances tween these values, 0-1): see <Action table> in the file header
  const act = { focus: 0, rear: 0, raise: 0, spread: 0, flap: 0, beat: 0, star: 0, back: 0, backDawn: 0 };
  /** The rearing pivot: the roots of the hind legs (the hind feet stay on the ground, and the body and forelegs rotate up about here) */
  const HIP = v(0, 0.88, -0.38);
  const REAR = 0.72;
  const hipRot = new THREE.Vector3();
  let flapPh = 0;

  // ── Idle: breathing, slow looking around, blinking, the ears twitching now and then, the wings opening and closing slightly with the breathing, the tail swaying lightly, the lifted forehoof tapping lightly now and then, the morning star glimmering faintly ──
  let blinkIn = 2.4;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    const br = Math.sin(t * 1.3);
    const idle = 1 - act.focus;
    torso.scale.set(1 + br * 0.012, 1 + br * 0.012, 1);
    // Rearing: the body rotates up about the roots of the hind legs; the forelegs follow the body, then lift forward from the shoulder joint (the left foreleg nearer the camera lifted high, the right foreleg a little lower)
    const th = -REAR * act.rear;
    hipRot.copy(HIP).applyAxisAngle(X, th);
    body.rotation.x = th;
    body.position.set(0, HIP.y - hipRot.y + br * 0.004, HIP.z - hipRot.z);
    for (const f of fores) {
      f.follow.rotation.x = th;
      f.follow.position.set(0, HIP.y - hipRot.y, HIP.z - hipRot.z);
      f.shoulder.rotation.x = -act.rear * (f.sx > 0 ? 0.55 : 0.8);
      f.fold(act.rear * (f.sx > 0 ? 0.5 : 1.75));
    }
    // Looking around (stopping at focus and looking straight ahead); head thrown back (raise); when rearing the head draws in forward a little, so it does not go all the way back over the back
    neck.rotation.y = (Math.sin(t * 0.3) * 0.14 + Math.sin(t * 0.87) * 0.02) * idle;
    neck.rotation.x = Math.sin(t * 0.5) * 0.025 * idle - act.raise * 0.55 + act.rear * 0.4;
    lvl.rotation.z = Math.sin(t * 0.3 + 0.7) * 0.025 * idle;

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.8 + ((t * 7.3) % 3);
    }
    let close = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.22;
      close = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.3) : 0;
      if (k >= 1) blinkT = -1;
    }
    // Blink: the upper and lower eyelids slide out of the socket and meet slightly below the midline; when the eyes are open the whole set is hidden, leaving no ring of eyelid around the eye
    const lidOn = close > 0.01;
    for (let i = 0; i < lids.length; i++) {
      lids[i].rotation.x = -UP_OPEN + (i % 2 ? 0.08 : 0) + (UP_OPEN + LID_MEET) * close;
      lids[i].visible = lidOn;
    }
    for (let i = 0; i < lowers.length; i++) {
      lowers[i].rotation.x = PI + LO_OPEN - (i % 2 ? 0.06 : 0) - (LO_OPEN - LID_MEET + 0.03) * close;
      lowers[i].visible = lidOn;
    }
    // When the eyes are closed the highlight is put away, so it does not poke out through the eyelid
    for (const g of glints) g.visible = close < 0.6;

    for (let i = 0; i < ears.length; i++) {
      const sx = i === 0 ? -1 : 1;
      const ph = (t + i * 2.9) % 6.4;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.18 : 0;
      ears[i].rotation.z = sx * tw;
    }
    // Wings: spread opens the V and turns the wing surfaces straight forward (the whole wing can be seen from the front and three-quarters);
    // flap is manual flapping (-1 raised high, 1 pressed to the lowest), and beat is continuous flapping (1.6 beats per second, the downstroke faster). Phase: computed from t when time is frozen, and accumulated with dt during playback
    flapPh = dt > 0 ? flapPh + dt * 1.6 : t * 1.6;
    const q = ((flapPh % 1) + 1) % 1;
    const stroke = q < 0.4 ? Math.cos((q / 0.4) * PI) : -Math.cos(((q - 0.4) / 0.6) * PI);
    const flap = act.beat * (0.05 - 0.55 * stroke) + act.flap * 0.55;
    for (let i = 0; i < wings.length; i++) {
      const sx = i === 0 ? -1 : 1;
      wings[i].rotation.z = -sx * (Math.sin(t * 1.3 - 0.6) * 0.03 + act.spread * 0.35 + flap);
      wings[i].rotation.x = Math.sin(t * 0.65) * 0.02;
      wings[i].rotation.y = -sx * act.spread * 0.35;
    }
    // Tail: turning back when rearing, but still hanging down with gravity and drifting slightly back
    tailG.rotation.y = Math.sin(t * 0.8) * 0.08;
    tailG.rotation.x = Math.sin(t * 1.1) * 0.025 + act.rear * REAR * 0.85;
    // The morning star on the forehead: lights up and enlarges slightly with star (spirits take no bloom, and the halo is added by the performance's effect object)
    M.star.emissiveIntensity = 0.45 + Math.sin(t * 1.2) * 0.07 + act.star * 0.5;
    starGemMesh.scale.setScalar(1 + act.star * 0.15);
    for (const m of BACK_MATS) {
      m.uniforms.uBack.value = act.back;
      (m.uniforms.uBackCol.value as THREE.Color).lerpColors(BACK_DUSK, BACK_DAWN, act.backDawn);
    }
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0, 0.93, -0.03), radius: 1.08, rig, act };
}
