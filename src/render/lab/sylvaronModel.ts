// Sylvaron, the Ancient Stag of Ten Thousand Leaves (model lab version): an ancient stag with a whole forest growing on its antlers; wherever it walks, dead trees sprout overnight.
// It keeps the five things that made the old model easiest to recognize: the milk-white coat, the antlers grown into a small forest (crowns, flowers, fruit, hanging vines), the moss and seedlings on its back, the Wood Source Crystal on the chest, and the dark hooves;
// the old version's green eyes are changed into the species' deep brown deer eyes, with green showing through from the back of the eye only when glow is on.
// Body shape follows the lore: a four-legged stag. The old version was a white torso of a few stacked balls, legs like thin bamboo poles, and antlers that were thin sticks topped with green balls (like lollipops),
// surrounded by halos, falling leaves, fireflies and glowing leaf veins; this one is changed into a whole lofted stag body: a deep chest, a narrow waist, a round rump, the legs with knees, hocks, white fetlock tufts and cloven hooves,
// two layers of white throat mane under the throat, and a patch of white behind the rump. The torso is lowered and the legs thickened, the center of gravity stable, not like walking on stilts.
// Antlers: branches with bark grooves (dark at the groove bottoms and bright on the ridges), a thick short main trunk dividing upward into five branches, each branch tip growing a tree: three round-crowned broadleaf trees, a pale green sapling,
// a tall pine in the middle; the brow tine in front puts out two new leaves, and the outer and rear tines hang thin vines. The roots are gray-white dead wood, gradually turning to a newly grown warm brown toward the branch tips,
// with the crowns coming out only at the tips: the dead wood sprouting grows on its head. A crown is a whole sphere held up by clumps of leaves, and the creases between clumps and the leaf-tip sawteeth on the lower edge are the leaves, not leaves pasted on one by one.
// Personality: a kindly, ancient and quiet lord of the forest, watching all things slowly grow. Head held high, ears spread, a pair of deep brown deer eyes open on the sides of the head,
// the corners of the mouth turned up slightly; no drooping eyes, no downward look. The eyes are made after the species: no sclera showing, horizontal pupils, one small point of highlight, no eyelashes, and the eyelids appear only when blinking.
// Gaze order: the face (the deep brown deer eyes, the dark nose tip) first, the forest on its head second, and the source crystal on the chest and the moss on the back as support.
// Back: a strip of moss laid from between the two antlers along the back of the head and nape all the way to the rump, with a small tree, a small pine, red mushrooms and white flowers growing on the back;
// at the fork of the rear tine of the right antler is a bird's nest with three blue eggs, and beside the nest a robin now and then turns its head: the life in the forest follows it.
// Restrained light effects: the old version's halo, orbiting falling leaves, fireflies, pollen ring and glowing leaf veins are removed; the only emissive left is the source crystal on the chest, and the eyes do not glow normally, with green showing through from the back of the eye only on glow.
// <Action table> focus: stop looking around and look straight ahead (0-1); glow: the source crystal lights up and green shows from the back of the eye (0-1); bloom: the crowns on the antlers swell, flowers and fruit open, the seedlings on the back grow taller (0-1);
// rustle: the crowns tremble rustling, shaken by a sound wave or a stomp (0-1); raise: head thrown back in a long call, the neck stretching up, the nose tip pointing to the sky, the ears laid back (0-1);
// rear: rearing up, the front of the body tilting up about the rump by about 42°, the forelegs lifted and pawing in the air one after the other; tweening back to 0 is stamping on the ground (0-1);
// brace: head lowered, pressing the forest on the antlers forward at the opponent, the ears laid back (0-1).
// Anchors: head, eyes, mouth, nose, antlerL / antlerR (the forks of the antlers), crownL / crownR (the center of the forest on each side), pineL / pineR (the pine tips),
// canopy (the midpoint of the two forests), gem (the source crystal), moss (the middle of the moss on the back ridge), sapling (the treetop of the small tree on the back), tail (the tail tip),
// hoofL / hoofR (forehooves, lifting with the rearing), nest (the bird's nest). L / R are its own left and right.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, furCollar, lathe, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, smooth, taper, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;

// ───────────────────────── Helpers ─────────────────────────

/** Fixed three-dimensional noise (0-1), for the undulations of the moss and the knots of the bark */
function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const w = fy * fy * (3 - 2 * fy);
  const q = fz * fz * (3 - 2 * fz);
  const l = THREE.MathUtils.lerp;
  const a = l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), w);
  const b = l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), w);
  return l(a, b, q);
}

/** Grid surface: rows × cols points, with f(i, j) giving the position and color; not wrapping around */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  let hasCol = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      pos.push(p.x, p.y, p.z);
      if (c) hasCol = true;
      const cc = c ?? new THREE.Color(1, 1, 1);
      cl.push(cc.r, cc.g, cc.b);
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      idx.push(a, a + cols, a + 1, a + cols, a + cols + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    P.fromBufferAttribute(pa, i);
    N.fromBufferAttribute(na, i);
    const c = f(P, N);
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

// barkTube, canopyGeo and flowerSlab are also given to the ultimate (the trees and flowers growing from under its hooves use the same shapes as the forest on the antlers)

/**
 * Bark branch: a tube along a curve, the cross-section radius undulating with angle into longitudinal bark grooves (the grooves twisting slightly), dark at the groove bottoms and brighter on the ridges;
 * the radius closes to 0 at both ends (round heads), and a branch root buried inside the parent branch shows no opening. The frame is parallel-transported, so an upright branch does not twist.
 */
export function barkTube(pts: THREE.Vector3[], rad: (t: number) => number, o: { grooves?: number; depth?: number; twist?: number; color?: (t: number, ridge: number) => THREE.Color; segs?: number; radial?: number; seed?: number } = {}): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = o.segs ?? 32;
  const radial = o.radial ?? 14;
  const fr = path.computeFrenetFrames(segs, false);
  const grooves = o.grooves ?? 5;
  const depth = o.depth ?? 0.1;
  const twist = o.twist ?? 0.6;
  const seed = o.seed ?? 0;
  const C = new THREE.Vector3();
  const g = gridGeo(segs + 1, radial + 1, (i, j) => {
    const t = i / segs;
    path.getPointAt(t, C);
    const th = (-j / radial) * PI * 2;
    const ph = th * grooves + twist * t * PI * 2 + seed;
    const ridge = 0.5 + 0.5 * Math.sin(ph) * (0.7 + 0.3 * Math.sin(ph * 0.5 + seed));
    const knot = vnoise(t * 9 + seed, Math.cos(th) * 1.5, Math.sin(th) * 1.5);
    const r = rad(t) * (1 + depth * (ridge - 0.5) * 2 + 0.12 * (knot - 0.5));
    const p = C.clone().addScaledVector(fr.normals[i], Math.cos(th) * r).addScaledVector(fr.binormals[i], Math.sin(th) * r);
    return { p, c: o.color ? o.color(t, ridge) : undefined };
  });
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/**
 * Crown: a sphere held up by a dozen-odd spherical caps of different sizes (clumps of leaves), taking the maximum between clumps, so the junctions dish naturally into creases,
 * the outline's normal creases are drawn only between clumps, and the cartoon shading is clump by clump too; the underside is flattened and darker, and the clumps at the top are brighter.
 */
export function canopyGeo(r: number, seed: number, o: { lobes?: number; amp?: number; detail?: number; base: THREE.ColorRepresentation; light: THREE.ColorRepresentation; dark: THREE.ColorRepresentation; squash?: number; teeth?: number }): THREE.BufferGeometry & { surfaceAt?: (d: THREE.Vector3) => THREE.Vector3 } {
  const rand = rng(seed);
  const n = o.lobes ?? 14;
  const amp = o.amp ?? 0.26;
  const L: { d: THREE.Vector3; w: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 1.7;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996 + rand() * 0.6;
    L.push({ d: v(Math.cos(a) * rr + (rand() - 0.5) * 0.25, y + (rand() - 0.5) * 0.2, Math.sin(a) * rr + (rand() - 0.5) * 0.25).normalize(), w: 0.5 + rand() * 0.25, h: 0.75 + rand() * 0.25 });
  }
  const base = new THREE.IcosahedronGeometry(1, o.detail ?? 5);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const g = mergeVertices(base, 1e-6);
  const pa = g.attributes.position as THREE.BufferAttribute;
  const cl = new Float32Array(pa.count * 3);
  const d = new THREE.Vector3();
  const cB = col(o.base);
  const cL = col(o.light);
  const cD = col(o.dark);
  const tc = new THREE.Color();
  const sq = o.squash ?? 0.72;
  const lobeAt = (dd: THREE.Vector3) => {
    let best = 0;
    for (const l of L) {
      const ang = dd.angleTo(l.d);
      if (ang < l.w) best = Math.max(best, l.h * Math.sqrt(1 - (ang / l.w) ** 2));
    }
    return best;
  };
  const teeth = o.teeth ?? 15;
  /** The surface point in unit direction dd */
  const surfaceAt = (dd: THREE.Vector3) => {
    const best = lobeAt(dd);
    // The lower edge cut into a ring of leaf tips: a sawtooth about the y axis, only on the lower half-ring, so the bottom edge of the silhouette is a series of leaves
    const ph = (Math.atan2(dd.z, dd.x) / (PI * 2)) * teeth + best * 0.8;
    const tooth = 1 - Math.abs(2 * (ph - Math.floor(ph)) - 1);
    const k = (0.8 + amp * best) * (1 + 0.075 * tooth * sstep(-dd.y, -0.15, 0.35));
    return v(dd.x * r * k, (dd.y < 0 ? dd.y * sq : dd.y) * r * k, dd.z * r * k);
  };
  for (let i = 0; i < pa.count; i++) {
    d.fromBufferAttribute(pa, i).normalize();
    const best = lobeAt(d);
    const q = surfaceAt(d);
    pa.setXYZ(i, q.x, q.y, q.z);
    // The tops of the clumps are bright, between clumps and the underside dark
    tc.copy(cB).lerp(cL, sstep(best, 0.5, 0.95) * sstep(d.y, -0.3, 0.6) * 0.9).lerp(cD, Math.max(sstep(0.35 - best, 0, 0.3) * 0.6, sstep(-d.y, 0.2, 0.8) * 0.7));
    cl.set([tc.r, tc.g, tc.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.computeVertexNormals();
  return Object.assign(g, { surfaceAt });
}

/** Flat leaf: lofted along a slightly curved path with both ends closing to points; growing out from the origin along +y with the leaf face toward +z */
function leafGeo(len: number, w: number, th: number, bend = 0.25): THREE.BufferGeometry {
  const pts = [0, 0.33, 0.66, 1].map((u) => v(0, len * u, -bend * len * u * u));
  return loft(pts, (t) => {
    const k = Math.pow(Math.sin(PI * Math.min(1, t * 1.02)), 0.75) * (1 - 0.25 * t);
    return [w * 0.5 * k, th * 0.5 * k + 0.0005];
  }, { segs: 8, radial: 6, side: X });
}

/** Five-petaled small flower: an extruded beveled plate, with the flower center placed separately */
function flowerShape(r: number, petals = 5): THREE.Shape {
  const s = new THREE.Shape();
  const N = petals * 6;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * PI * 2;
    const k = 0.45 + 0.55 * Math.pow(Math.abs(Math.cos((a * petals) / 2)), 0.6);
    const x = Math.cos(a) * r * k;
    const y = Math.sin(a) * r * k;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

/** The beveled plate of a small flower: a flower is only the size of a fingernail, so one bevel step is enough */
export function flowerSlab(r: number, depth: number, bevel: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(flowerShape(r), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ───────────────────────── Helpers for the face-count budget (SSR 60,000 faces) ─────────────────────────

/** Eyelid shell: the same outline as lidGeometry in shapes.ts, with the lathe segments and the number of outline points adjustable (the eyelid edge shows only half a circle from the front, so 16 segments show no corner) */
function lidGeo(ri: number, ro: number, lip: number, seg = 16, n = 6, rim = 4): THREE.BufferGeometry {
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

/**
 * The furCollar mesh is column by column (12 columns per tuft), 29 vertices per column (the outer side from fur root to fur tip, k = 0..14, then back from the inner side to the root).
 * For each tuft only per columns are kept, landing on the notch between tufts, the fur tip and the midpoints on the two sides (the nearest column is found by phase, so the sawtooth's tips and notches are not skipped),
 * and the cross-section keeps only the ks points (14 is the fur tip and must be there); the shape and vertex normals reuse the values computed on the original fine mesh, with only the triangles reconnected.
 */
function thinCollar(g: THREE.BufferGeometry, o: FurCollarOpts, per = 6, ks = [0, 2, 4, 6, 8, 10, 12, 14]): THREE.BufferGeometry {
  const span = (o.a1 ?? PI) - (o.a0 ?? -PI);
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * 12));
  const J = 29;
  const phase = o.phase ?? 0;
  const set = new Set<number>(full ? [] : [0, nT]);
  for (let m = -1; m <= Math.ceil(o.tufts) + 1; m++)
    for (let k = 0; k < per; k++) {
      const i = Math.round(((m + k / per - phase) * nT) / o.tufts);
      if (full) set.add(((i % nT) + nT) % nT);
      else if (i >= 0 && i <= nT) set.add(i);
    }
  const cols = [...set].sort((a, b) => a - b);
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
/** Small tufts of fur and pine needles: 4 columns per tuft, 5 points in the cross-section */
const THIN_S: [number, number[]] = [4, [0, 4, 8, 11, 14]];

// ───────────────────────── Shape ─────────────────────────

export function buildSylvaronLab(): LabModel {
  const rand = rng(20261001);
  const jit = (a: number) => (rand() - 0.5) * 2 * a;
  const RIMC = 0xd8f5c0;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const COAT = 0xf1e9d4;
  const FAWN = 0xd9c7a2;
  const BELLY = 0xfcf9f0;
  const SOCK = 0xa8917a;
  const M = {
    coat: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    white: labToon(BELLY, { rim: 0.5, rimColor: RIMC }),
    lid: labToon(COAT, { rim: 0.5, rimColor: RIMC }),
    ruff: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    earIn: labToon(0xe8c8b8, { rim: 0.3 }),
    hoof: labToon(0x3b2e28, { spec: 0.9, specTh: 0.985, rim: 0.4, rimColor: RIMC }),
    nose: labToon(0x2e2622, { spec: 0.9, specTh: 0.997, rim: 0.4, rimColor: RIMC }),
    line: labToon(0x3a2c26, { rim: 0 }),
    // Deer eye: dark brown close to black, the vertex colors only darkening; the emissive is the green reflection from the back of the eye on glow, 0 normally
    eye: vc(labToon(0x3a2418, { ramp: 'gem', emissive: 0x2c9a56, emissiveAmt: 0, rim: 0 })),
    pupil: labToon(0x0c0806, { rim: 0 }),
    bark: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xffe6c0 })),
    leaf: vc(labToon(0xffffff, { rim: 0.55, rimColor: 0xe6ffb8 })),
    moss: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xe6ffb8 })),
    sprout: labToon(0x7cc85a, { rim: 0.5, rimColor: 0xe6ffb8 }),
    sproutDk: labToon(0x4f9a4a, { rim: 0.5, rimColor: 0xe6ffb8 }),
    stem: labToon(0x6a8a3a, { rim: 0.3 }),
    petal: labToon(0xf6b6cc, { rim: 0.4, rimColor: 0xffe0ea }),
    petalW: labToon(0xfbf6ee, { rim: 0.4 }),
    pollen: labToon(0xf2c24a, { rim: 0.2 }),
    cap: labToon(0xd8643a, { spec: 0.6, specTh: 0.97, rim: 0.4 }),
    capStem: labToon(0xf4ead6, { rim: 0.3 }),
    fruit: labToon(0xf0a03a, { spec: 1.0, specTh: 0.95, rim: 0.4 }),
    twig: labToon(0x8a6a48, { speckle: 0.35, rim: 0.3 }),
    birdBack: labToon(0x7a6450, { rim: 0.4 }),
    birdChest: labToon(0xe8844a, { rim: 0.4 }),
    egg: labToon(0xb8e2ea, { speckle: 0.25, spec: 0.6, specTh: 0.97, rim: 0.4 }),
    wood: labToon(0x7a5638, { speckle: 0.2, rim: 0.4 }),
    gold: labToon(0xe2b04a, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    gem: labToon(0x3ee08a, { ramp: 'gem', emissive: 0x16b060, emissiveAmt: 0.55, spec: 1.4, specTh: 0.88, rim: 0.6, rimColor: 0xd8ffd0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'sylvaron-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const BODY = 9301;
  const HEAD = 9302;
  const ANTL = 9303;
  const TAIL = 9304;

  /** Place a ring of fur: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal */
  const collar = (parent: THREE.Object3D, mat: THREE.Material, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup?: number) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, thinCollar(furCollar(o), o, 6, [0, 2, 4, 6, 8, 10, 12, 13, 14]), mat);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };

  // Body (rising and falling slightly with breathing); the hind feet hang directly on root, so they stand firmly on the ground.
  // The body and forelegs hang under the hip pivot rearG (at rest rearG and rearIn cancel, so the shape is unchanged): when act.rear rears up the whole front of the body tilts up about the rump, and the hind feet stay on the ground
  const BY = 0;
  const HIP = v(0, 0.62, -0.4);
  const rearG = group(root, [HIP.x, HIP.y, HIP.z]);
  const rearIn = group(rearG, [-HIP.x, -HIP.y, -HIP.z]);
  const body = group(rearIn, [0, BY, 0]);

  // ── Torso: one whole loft, the rump round, the waist narrow, the chest deep; light brown on the back and pure white below the belly ──
  const spine = [v(0, 0.63, -0.54), v(0, 0.65, -0.34), v(0, 0.63, -0.08), v(0, 0.64, 0.14), v(0, 0.69, 0.32), v(0, 0.75, 0.42)];
  const prof = curveTable([
    [0, 0, 0, 0],
    [0.03, 0.11, 0.105, 0],
    [0.09, 0.168, 0.178, 0],
    [0.2, 0.185, 0.2, -0.01],
    [0.36, 0.166, 0.178, 0],
    [0.5, 0.156, 0.168, 0.01],
    [0.66, 0.175, 0.21, -0.03],
    [0.8, 0.186, 0.238, -0.05],
    [0.92, 0.158, 0.21, -0.03],
    [0.975, 0.105, 0.135, 0],
    [1, 0, 0, 0],
  ]);
  const path = new THREE.CatmullRomCurve3(spine, false, 'centripetal');
  const frame = (t: number) => {
    const C = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, UP).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [a, b, dy] = prof(t);
    return { C, T, W, H, a, b, dy };
  };
  /** Torso surface: θ = PI/2 faces up; returns position and normal */
  const surf = (t: number, th: number, off = 0) => {
    const { C, T, W, H, a, b, dy } = frame(t);
    const n = W.clone().multiplyScalar(Math.cos(th) / Math.max(a, 1e-3)).addScaledVector(H, Math.sin(th) / Math.max(b, 1e-3)).normalize();
    const p = C.addScaledVector(W, a * Math.cos(th)).addScaledVector(H, b * Math.sin(th) + dy).addScaledVector(n, off);
    return { p, n, T };
  };
  // Look up the midline height and half height by z, to color the torso
  const zs: { z: number; y: number; b: number }[] = [];
  for (let i = 0; i <= 120; i++) {
    const f = frame(i / 120);
    zs.push({ z: f.C.z, y: f.C.y + f.dy, b: Math.max(f.b, 0.05) });
  }
  const yRel = (p: THREE.Vector3) => {
    let best = zs[0];
    for (const s of zs) if (Math.abs(s.z - p.z) < Math.abs(best.z - p.z)) best = s;
    return (p.y - best.y) / best.b;
  };
  const cCoat = col(COAT);
  const cFawn = col(FAWN);
  const cBelly = col(BELLY);
  const cSock = col(SOCK);
  const coatAt = (p: THREE.Vector3) => {
    const r = yRel(p);
    // A patch of white behind the rump (the deer's white rump), shown when the tail is raised
    const rump = sstep(-0.44 - p.z, 0, 0.05) * sstep(r, -0.5, -0.2);
    return cCoat.clone().lerp(cFawn, sstep(r, 0.35, 0.75) * (1 - rump)).lerp(cBelly, Math.max(sstep(-r, 0.35, 0.6), rump));
  };
  const torso = add(body, paint(loft(spine, prof, { segs: 48, radial: 26 }), coatAt), M.coat);
  torso.userData.inkGroup = BODY;

  // ── Neck: standing up from the chest going up and forward, thick and strong ──
  const nb = v(0, 0.71, 0.3);
  const nt = v(0, 1.03, 0.46);
  const neckPts = [nb, v(0, 0.89, 0.4), nt];
  const neckProf = curveTable([[0, 0.138, 0.168], [0.5, 0.11, 0.122], [1, 0.092, 0.1]]);
  const neckGeo = loft(neckPts, neckProf, { segs: 20, radial: 18 });
  const neckMesh = add(body, paint(neckGeo, (p, n) => cCoat.clone().lerp(cBelly, sstep(n.z - n.y * 0.3, 0.4, 0.8))), M.coat);
  neckMesh.userData.inkGroup = BODY;
  const nT = nt.clone().sub(nb).normalize();
  const nU = v(0, nT.z, -nT.y);

  /** Shoot a line from straight ahead onto the body, to find the surface point and normal on the chest or the front of the neck */
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const stick = (x: number, y: number) => {
    ray.set(v(x, y, 2), v(0, 0, -1));
    const hit = ray.intersectObjects([torso, neckMesh], false)[0];
    const n = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld);
    return { p: body.worldToLocal(hit.point.clone()), n };
  };

  // Throat mane: a long sheet of white hair draping down from under the neck, which only an old stag has
  collar(body, M.ruff, { r0: 0.09, len: 0.2, thick: 0.13, flare: 0.95, curl: 0.8, tufts: 6, a0: PI - 1.1, a1: PI + 1.1, notch: 0.5, groove: 0.3, jitter: 0.22, tint: [COAT, BELLY, 0.4], seed: 7 }, nb.clone().lerp(nt, 0.35), nT, nU, BODY);
  collar(body, M.ruff, { r0: 0.08, len: 0.18, thick: 0.12, flare: 0.9, curl: 0.8, tufts: 6, phase: 0.5, a0: PI - 1.2, a1: PI + 1.2, notch: 0.5, groove: 0.3, jitter: 0.22, tint: [COAT, BELLY, 0.4], seed: 8 }, nb.clone().lerp(nt, 0.72), nT, nU, BODY);

  // ── Limbs: forelegs straight with the knee at the middle; the hind thighs forward and the hocks backward; below the knee a darker sock color, and dark cloven hooves ──
  const legPaint = (p: THREE.Vector3) => cCoat.clone().lerp(cSock, sstep(0.35 - p.y, 0, 0.12));
  const hoof = (parent: THREE.Object3D, x: number, z: number) => {
    const g = group(parent, [x, 0, z]);
    // Two hoof plates: the heel round, closing forward to a point, the front end pressed low against the ground
    for (const s of [-1, 1]) add(g, loft([v(0, 0.036, -0.036), v(0, 0.03, 0.01), v(0, 0.016, 0.056)], curveTable([[0, 0, 0], [0.1, 0.019, 0.03], [0.45, 0.021, 0.028], [0.8, 0.015, 0.017], [1, 0, 0]]), { segs: 12, radial: 10, side: X }), M.hoof, [s * 0.021, 0, 0.006], [0, s * 0.07, 0]);
    for (const s of [-1, 1]) add(g, new THREE.ConeGeometry(0.009, 0.026, 8), M.hoof, [s * 0.024, 0.078, -0.04], [-2.4, 0, 0]);
    // A ring of white fetlock tuft on the hoof, covering the upper edge of the hoof plates downward
    const fo: FurCollarOpts = { r0: 0.03, len: 0.05, thick: 0.03, flare: 0.5, curl: 0.3, tufts: 7, notch: 0.45, jitter: 0.2, tint: [SOCK, BELLY, 0.35], seed: Math.round(x * 100 + z * 10) };
    add(g, thinCollar(furCollar(fo), fo, ...THIN_S), M.ruff, [0, 0.085, 0.004]).userData.inkGroup = BODY;
  };
  // The forelegs hang on the shoulder pivot (when act.rear rears up they lift forward and paw in the air; act.brace braces them forward); at rest shIn cancels the displacement of sh
  const shoulders: { sh: THREE.Group; sx: number; hoof: THREE.Group }[] = [];
  for (const sx of [-1, 1]) {
    const fz = sx > 0 ? 0.04 : 0;
    const SH = v(sx * 0.09, 0.64, 0.24 + fz);
    const sh = group(rearIn, [SH.x, SH.y, SH.z]);
    const shIn = group(sh, [-SH.x, -SH.y, -SH.z]);
    add(
      shIn,
      paint(loft([v(sx * 0.08, 0.67, 0.24 + fz), v(sx * 0.122, 0.43, 0.2 + fz), v(sx * 0.122, 0.255, 0.22 + fz), v(sx * 0.122, 0.1, 0.235 + fz), v(sx * 0.122, 0.05, 0.255 + fz)],
        curveTable([[0, 0, 0], [0.03, 0.065, 0.075], [0.1, 0.094, 0.112], [0.3, 0.078, 0.09], [0.47, 0.05, 0.057], [0.55, 0.054, 0.059], [0.64, 0.042, 0.047], [0.84, 0.037, 0.041], [0.91, 0.045, 0.048], [0.97, 0.04, 0.041], [1, 0, 0]]), { segs: 32, radial: 12, side: X }), legPaint),
      M.coat,
    ).userData.inkGroup = BODY;
    shoulders.push({ sh, sx, hoof: group(shIn, [sx * 0.122, 0.02, 0.29 + fz]) });
    hoof(shIn, sx * 0.122, 0.265 + fz);
    add(
      root,
      paint(loft([v(sx * 0.08, 0.69, -0.4), v(sx * 0.135, 0.44, -0.3), v(sx * 0.122, 0.265, -0.48), v(sx * 0.122, 0.1, -0.45), v(sx * 0.122, 0.05, -0.425)],
        curveTable([[0, 0, 0], [0.03, 0.09, 0.12], [0.1, 0.13, 0.18], [0.24, 0.108, 0.15], [0.38, 0.066, 0.078], [0.48, 0.049, 0.06], [0.58, 0.042, 0.048], [0.84, 0.037, 0.041], [0.91, 0.045, 0.048], [0.97, 0.04, 0.041], [1, 0, 0]]), { segs: 34, radial: 12, side: X }), legPaint),
      M.coat,
    ).userData.inkGroup = BODY;
    hoof(root, sx * 0.122, -0.41);
  }

  // ── Tail: a short deer tail hanging down, the underside white ──
  const tail = group(body, [0, 0.69, -0.55], [0.5, 0, 0]);
  add(tail, paint(loft([v(0, 0.02, 0.04), v(0, 0.0, -0.04), v(0, -0.07, -0.09), v(0, -0.14, -0.1)], curveTable([[0, 0, 0], [0.1, 0.038, 0.03], [0.4, 0.05, 0.04], [0.85, 0.035, 0.03], [1, 0, 0]]), { segs: 14, radial: 12, side: X }), (p, n) => cFawn.clone().lerp(cBelly, sstep(-n.z, -0.1, 0.3))), M.coat).userData.inkGroup = TAIL;

  // ── Moss: a thick moss laid from behind the head along the nape all the way to the rump, widest on the back, the edge undulating and thinning, the surface clump-by-clump moss cushions;
  //    it has the same outline index as the body, so only the undulation of the cushions and the silhouette draw lines, and it looks grown on the body ──
  const cM1 = col(0x4f8c3c);
  const cM2 = col(0x86b852);
  const cM3 = col(0x2f5e2e);
  const mossColor = (lump: number) => cM1.clone().lerp(cM2, sstep(lump, 0.5, 0.8)).lerp(cM3, sstep(0.35 - lump, 0, 0.25) * 0.7);
  /** Lay a patch of moss along the lofted surface sf(t, θ, distance from the surface): θ = PI/2 is the back ridge, and edgeW(t, left and right) is the half width (radians) */
  const mossShell = (sf: (t: number, th: number, off: number) => { p: THREE.Vector3 }, T0: number, T1: number, edgeW: (t: number, s: number) => number, NR: number, NC: number, ends: [number, number]) =>
    gridGeo(NR + 3, NC + 3, (ii, jj) => {
      const wall = ii === 0 || ii === NR + 2 || jj === 0 || jj === NC + 2;
      const i = THREE.MathUtils.clamp(ii - 1, 0, NR);
      const j = THREE.MathUtils.clamp(jj - 1, 0, NC);
      const t = T0 + ((T1 - T0) * i) / NR;
      const u = (2 * j) / NC - 1;
      const th = PI / 2 + u * edgeW(t, u < 0 ? -1 : 1);
      const s0 = sf(t, th, 0).p;
      const lump = vnoise(s0.x * 24, s0.y * 24, s0.z * 24);
      const fade = Math.min(1, (1 - Math.abs(u)) * 3.5, i / ends[0], (NR - i) / ends[1]);
      const off = wall ? -0.006 : (0.004 + 0.022 * lump) * (0.25 + 0.75 * fade);
      return { p: sf(t, th, off).p, c: mossColor(lump) };
    });
  {
    const T0 = 0.1;
    const T1 = 0.9;
    const edgeW = (t: number, s: number) => 0.62 + 0.28 * Math.sin((PI * (t - T0)) / (T1 - T0)) + 0.07 * Math.sin(t * 31 + s * 2) + 0.04 * Math.sin(t * 57 + s * 5);
    add(body, mossShell(surf, T0, T1, edgeW, 60, 34, [7.5, 2.5]), M.moss).userData.inkGroup = BODY;
  }
  {
    const nPath = new THREE.CatmullRomCurve3(neckPts, false, 'centripetal');
    const nSurf = (t: number, th: number, off: number) => {
      const C = nPath.getPointAt(t);
      const T = nPath.getTangentAt(t);
      const W = new THREE.Vector3().crossVectors(T, UP).normalize();
      const H = new THREE.Vector3().crossVectors(W, T).normalize();
      const [a, b] = neckProf(t);
      const n = W.clone().multiplyScalar(Math.cos(th) / a).addScaledVector(H, Math.sin(th) / b).normalize();
      return { p: C.addScaledVector(W, a * Math.cos(th)).addScaledVector(H, b * Math.sin(th)).addScaledVector(n, off) };
    };
    const edgeW = (t: number, s: number) => 0.8 - 0.3 * t + 0.08 * Math.sin(t * 23 + s * 2);
    add(body, mossShell(nSurf, 0.08, 0.96, edgeW, 30, 16, [1, 1]), M.moss).userData.inkGroup = BODY;
  }

  // Seedlings, small mushrooms and white flowers on the moss
  const onMoss = (t: number, th: number, off = 0.02) => {
    const s = surf(t, th, off);
    const g = group(body, [s.p.x, s.p.y, s.p.z]);
    g.quaternion.setFromUnitVectors(UP, s.n.clone().lerp(UP, 0.5).normalize());
    return g;
  };
  // The small saplings on the back: seedlings of the forest on the antlers, one round-crowned and one small pine
  const sprouts: THREE.Group[] = [];
  {
    const g = onMoss(0.3, PI / 2 + 0.25, 0.012);
    add(g, barkTube([v(0, -0.01, 0), v(0.003, 0.03, 0), v(0, 0.055, 0.003)], (t) => 0.007 * (1 - 0.5 * t) * (t > 0.9 ? 0.5 : 1), { segs: 10, radial: 8, grooves: 3, depth: 0.05, color: () => col(0x7a5a3e) }), M.bark);
    add(g, canopyGeo(0.032, 5, { base: 0x78b24a, light: 0xb8dc68, dark: 0x3e7430, lobes: 8, amp: 0.3, detail: 4 }), M.leaf, [0, 0.07, 0]);
    sprouts.push(g);
  }
  {
    const g = onMoss(0.64, PI / 2 - 0.22, 0.012);
    for (let k = 0; k < 3; k++) {
      const len = 0.04 - k * 0.009;
      const fo: FurCollarOpts = { r0: 0.002, len, thick: 0.018 - k * 0.004, flare: 1.1, curl: 0.3, tufts: 6, notch: 0.5, phase: k * 0.3, tint: [0x1f5238, 0x3a8656, 0.55], seed: 90 + k };
      add(g, thinCollar(furCollar(fo), fo, ...THIN_S), M.leaf, [0, 0.012 + k * 0.022 + len * 0.55, 0]).userData.inkGroup = 9320;
    }
    add(g, loft([v(0, -0.01, 0), v(0, 0.02, 0)], () => [0.004, 0.004], { segs: 4, radial: 8 }), M.wood);
    sprouts.push(g);
  }
  for (const [t, th, s] of [[0.2, PI / 2 - 0.45, 1], [0.24, PI / 2 - 0.62, 0.7], [0.5, PI / 2 + 0.55, 0.85]] as [number, number, number][]) {
    const g = onMoss(t, th, 0.015);
    add(g, lathe([[0.006, 0], [0.007, 0.02], [0.006, 0.034]], 8), M.capStem, [0, 0, 0], [0, 0, 0], [s, s, s]);
    add(g, lathe([[0.001, 0.03], [0.022, 0.03], [0.026, 0.036], [0.02, 0.048], [0.001, 0.054]], 12), M.cap, [0, 0, 0], [0, 0, 0], [s, s, s]);
  }
  for (const [t, th] of [[0.42, PI / 2 + 0.1], [0.7, PI / 2 + 0.35], [0.36, PI / 2 - 0.5], [0.78, PI / 2 - 0.3]] as [number, number][]) {
    const g = onMoss(t, th, 0.024);
    add(g, flowerSlab(0.018, 0.004, 0.0015), M.petalW, [0, 0, 0], [-PI / 2, 0, jit(1)]);
    add(g, new THREE.SphereGeometry(0.006, 8, 6), M.pollen, [0, 0.004, 0]);
  }

  // ── The Wood Source Crystal on the chest: a ring of carved wooden seat, a gold inner frame, an emerald-green source crystal; four thin roots at the bottom of the seat gripping into the chest fur, and two new leaves coming out at the upper edge ──
  const bs = stick(0, 0.63);
  const brooch = group(body, [bs.p.x, bs.p.y, bs.p.z]);
  brooch.quaternion.setFromUnitVectors(v(0, 0, 1), bs.n);
  add(brooch, lathe([[0.03, -0.018], [0.058, -0.016], [0.066, -0.004], [0.062, 0.012], [0.05, 0.016], [0.044, 0.006]], 28), M.wood, [0, 0, 0.004], [PI / 2, 0, 0]);
  add(brooch, lathe([[0.04, 0.002], [0.046, 0.006], [0.045, 0.014], [0.039, 0.012]], 28), M.gold, [0, 0, 0.004], [PI / 2, 0, 0]);
  add(brooch, brilliant(0.04, 0.026, 0.03, 10), M.gem, [0, 0, 0.016], [PI / 2, 0, 0]);
  const gemA = group(brooch, [0, 0, 0.05]);
  // A ring of leaves around the seat: ten small leaves arranged in the same direction, two greens alternating, with the space directly above left for the two new leaves
  for (let i = 0; i < 10; i++) {
    const a = PI / 2 + 0.55 + (i / 10) * (PI * 2 - 1.1);
    const lg = group(brooch, [Math.cos(a) * 0.066, Math.sin(a) * 0.066, -0.002], [0, 0, a + PI]);
    add(lg, leafGeo(0.04, 0.02, 0.005, 0.1), i % 2 ? M.sprout : M.sproutDk, [0, 0, 0], [0.35, 0, 0]);
  }
  for (const s of [-1, 1]) {
    const lg = group(brooch, [s * 0.012, 0.06, 0.006], [0, 0, -s * 0.45]);
    add(lg, leafGeo(0.05, 0.026, 0.005, 0.2), M.sprout);
  }

  // ── Head: the neck pivot handles looking around, the head's origin is at the center of the skull; head held high, the muzzle forward ──
  const neck = group(body, [0, 0.97, 0.45]);
  const head = group(neck, [0, 0.1, 0.05], [0.12, 0, 0]);
  head.scale.setScalar(1.42);

  // Skull and muzzle: the forehead and bridge of the nose light brown, the front of the muzzle and the chin white
  const cBridge = col(0xd9c294);
  const headPaint = (p: THREE.Vector3) => {
    const bridge = sstep(p.y + 0.025 - p.z * 0.12, 0, 0.03) * sstep(p.z, 0.02, 0.09) * sstep(0.055 - Math.abs(p.x), 0, 0.03);
    const top = sstep(p.y, 0.05, 0.1) * sstep(0.08 - Math.abs(p.x), 0, 0.04);
    const muzzleW = sstep(p.z, 0.17, 0.2) * (1 - sstep(p.z, 0.235, 0.25));
    const chin = sstep(-p.y, 0.05, 0.08) * sstep(p.z, 0.04, 0.1);
    return cCoat.clone().lerp(cBridge, Math.max(bridge, top) * (1 - muzzleW)).lerp(cBelly, Math.max(muzzleW, chin));
  };
  add(head, paint(new THREE.SphereGeometry(0.12, 32, 22).scale(1.08, 0.94, 1.0), headPaint), M.coat).userData.inkGroup = HEAD;
  add(head, paint(loft([v(0, -0.005, 0.02), v(0, -0.038, 0.14), v(0, -0.054, 0.24)], curveTable([[0, 0.09, 0.088], [0.45, 0.068, 0.066], [0.85, 0.053, 0.049], [0.95, 0.043, 0.04], [1, 0, 0]]), { segs: 24, radial: 20 }), headPaint), M.coat).userData.inkGroup = HEAD;
  add(head, taper(rbox(0.07, 0.042, 0.04, 0.017), [1, 1], [0.6, 0.8]), M.nose, [0, -0.046, 0.245], [0.3, 0, 0]);
  // The two nostrils are separated by the nose tip, and from the side the far one is hidden, so they can go in the same batch when merging
  const nostrils = [-1, 1].map((sx) => add(head, new THREE.SphereGeometry(1, 12, 8), M.pupil, [sx * 0.018, -0.06, 0.263], [0, sx * 0.4, 0], [0.01, 0.006, 0.008]));
  // Mouth: a philtrum under the nose, going back on both sides, the corners of the mouth turned up slightly
  {
    const pts = [v(-0.044, -0.08, 0.17), v(-0.03, -0.088, 0.205), v(-0.01, -0.088, 0.225), v(0, -0.081, 0.231), v(0.01, -0.088, 0.225), v(0.03, -0.088, 0.205), v(0.044, -0.08, 0.17)];
    add(head, loft(pts, (u) => { const k = Math.pow(Math.sin(PI * u), 0.35); return [0.0035 * k, 0.0035 * k]; }, { segs: 32, radial: 6 }), M.line);
    add(head, loft([v(0, -0.064, 0.25), v(0, -0.074, 0.242), v(0, -0.082, 0.232)], (u) => { const k = Math.pow(Math.sin(PI * u), 0.35); return [0.003 * k, 0.003 * k]; }, { segs: 8, radial: 6 }), M.line);
  }

  // Eyes: a deer's eyes sit on the side of the head, dark brown close to black with almost no sclera showing, the pupil a horizontal dark ellipse; about seventeen percent of the head's width in diameter,
  // buried forty percent along the normal from the point on the skull ellipsoid whose normal faces forward, outward and up. No brow line added (a ridge above the eye would be drawn by the outline as a human eyebrow).
  // The highlight is only a small point (the eye material's spec is 0); no eyelashes. The eyelids appear only when blinking, and the whole set is hidden when the eyes are open (reference.md pitfall 105).
  // On glow a little green reflection shows from the back of the eye (a deer's tapetum), and the old model's green eyes live on here.
  const ER = 0.022;
  const EMBED = 0.4;
  // The open-eye angle: the eyelid lips stop outside the range where the eyeball shows (the eyeball is buried forty percent, and the half angle of the exposed spherical cap is about 1.16); when blinking they meet slightly below the midline
  const UP_OPEN = 1.25;
  const LO_OPEN = 1.2;
  const LID_MEET = 0.14;
  const lids: THREE.Group[] = [];
  const lowers: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeA: THREE.Group[] = [];
  const eyeBall = paint(new THREE.SphereGeometry(ER, 16, 12), (p) => {
    // The upper half darkened by the bony ridge, and the lower half letting through a little warm brown
    const k = 0.62 + 0.38 * sstep(-p.y / ER, -0.55, 0.6);
    return new THREE.Color(k, k, k);
  });
  const lidUp = lidGeo(ER + 0.0022, ER + 0.0056, PI / 2, 16);
  const lidLow = lidGeo(ER + 0.0016, ER + 0.0042, PI / 2, 16);
  const lidLine = lidGeo(ER + 0.001, ER + 0.003, PI / 2, 16, 4, 3);
  // The half axes of the skull ellipsoid (the skull is a sphere of 0.12, scaled 1.08, 0.94, 1.0)
  const HA = v(0.12 * 1.08, 0.12 * 0.94, 0.12);
  for (const sx of [-1, 1]) {
    // The point on the ellipsoid whose normal is n: p = (a²nx, b²ny, c²nz) / √(a²nx² + b²ny² + c²nz²)
    const f = v(sx * 0.74, 0.34, 0.58).normalize();
    const k = Math.hypot(HA.x * f.x, HA.y * f.y, HA.z * f.z);
    const at = v((HA.x * HA.x * f.x) / k, (HA.y * HA.y * f.y) / k, (HA.z * HA.z * f.z) / k).addScaledVector(f, -ER * EMBED);
    const eg = group(head, [at.x, at.y, at.z]);
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    // The eyeball, pupil and highlight form a group of their own (corruption looks at the size of this group to swap materials); the gaze draws in slightly forward, with both eyes looking in the same direction
    const gaze = group(eg, [0, 0, 0], [0, -sx * 0.12, 0]);
    add(gaze, eyeBall, M.eye);
    add(gaze, diskDecal(0.5, 0.2, ER + 0.0006, 2, 20), M.pupil);
    eyeA.push(group(gaze, [0, 0, ER]));
    // Highlight: one small point, on the same side for both eyes (the light comes from the same direction)
    const hl = add(gaze, new THREE.SphereGeometry(ER * 0.17, 8, 6), M.hi, [ER * 0.34, ER * 0.42, ER * 0.84], [0, 0, 0], [1, 1, 0.5]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    const upper = group(eg, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.lid).userData.inkGroup = HEAD;
    const upLine = group(eg, [0, 0, 0], [-UP_OPEN + 0.08, 0, 0]);
    add(upLine, lidLine, M.line);
    const lower = group(eg, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lower, lidLow, M.lid).userData.inkGroup = HEAD;
    const loLine = group(eg, [0, 0, 0], [PI + LO_OPEN - 0.06, 0, 0]);
    add(loLine, lidLine, M.line);
    lids.push(upper, upLine);
    lowers.push(lower, loLine);
  }

  // Ears: big spread-open deer ears, extending flat to the two sides and slightly up; pale pink on the inside, twitching now and then
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.085, 0.06, -0.035], [0.15, sx * 0.35, -sx * 1.25]);
    const ep = [v(0, 0, 0), v(0, 0.08, 0.004), v(0, 0.16, 0)];
    add(eg, paint(loft(ep, curveTable([[0, 0, 0], [0.08, 0.028, 0.014], [0.45, 0.046, 0.016], [0.8, 0.032, 0.012], [1, 0, 0]]), { segs: 16, radial: 12, side: X }), () => cCoat), M.coat);
    add(eg, loft(ep.map((p) => p.clone().multiplyScalar(0.82).add(v(0, 0.02, 0.009))), curveTable([[0, 0, 0], [0.1, 0.018, 0.006], [0.45, 0.032, 0.007], [0.8, 0.022, 0.005], [1, 0, 0]]), { segs: 14, radial: 10, side: X }), M.earIn);
    ears.push(eg);
  }

  // Neck mane: a ring of white hair draping down from the lower edge of the skull, covering the junction of head and neck, longest under the throat; a small tuft of white hair going back on each cheek, widening the frame of the face a little
  collar(head, M.ruff, { r0: 0.062, len: 0.13, thick: 0.07, flare: 0.55, curl: 0.35, tufts: 7, a0: -2.1, a1: 2.1, notch: 0.45, jitter: 0.2, bias: 0.35, tint: [COAT, BELLY, 0.5], seed: 71 }, v(0, -0.05, -0.05), v(0, 1, 0.5), v(0, -0.4, 1), HEAD);
  // Moss behind the head: laid from between the two antlers down the back of the head, joining the strip of moss on the nape; covering the junction of head and neck
  {
    const c = v(0, 0.3, -0.95).normalize();
    const e1 = v(1, 0, 0);
    const e2 = new THREE.Vector3().crossVectors(c, e1).normalize();
    const S = v(0.12 * 1.08, 0.12 * 0.94, 0.12);
    const NR = 14;
    const NC = 32;
    const geo = gridGeo(NR + 2, NC + 1, (i, j) => {
      const phi = (j / NC) * PI * 2;
      // Narrow side to side and long up and down: going up to join between the two antlers, going down to join the nape
      const A = 0.4 + 0.42 * Math.sin(phi) ** 2 + 0.05 * Math.sin(5 * phi + 0.5) + 0.03 * Math.sin(9 * phi + 1);
      const a = (Math.min(i, NR) / NR) * A;
      const d = c.clone().multiplyScalar(Math.cos(a)).addScaledVector(e1, Math.sin(a) * Math.cos(phi)).addScaledVector(e2, Math.sin(a) * Math.sin(phi));
      const k = 1 / Math.sqrt((d.x / S.x) ** 2 + (d.y / S.y) ** 2 + (d.z / S.z) ** 2);
      const p0 = d.clone().multiplyScalar(k);
      const n = v(p0.x / (S.x * S.x), p0.y / (S.y * S.y), p0.z / (S.z * S.z)).normalize();
      const lump = vnoise(p0.x * 40 + 3, p0.y * 40, p0.z * 40);
      const fade = Math.min(1, (NR - i) / 3);
      const off = i > NR ? -0.004 : (0.003 + 0.01 * lump) * (0.2 + 0.8 * fade);
      return { p: p0.addScaledVector(n, off), c: mossColor(lump) };
    });
    const m = mergeVertices(geo, 1e-6);
    m.computeVertexNormals();
    add(head, m, M.moss).userData.inkGroup = HEAD;
  }
  for (const sx of [-1, 1]) collar(head, M.ruff, { r0: 0.095, len: 0.07, thick: 0.04, flare: 1.25, curl: 0.3, tufts: 2, notch: 0.5, a0: sx > 0 ? 1.75 : -2.55, a1: sx > 0 ? 2.55 : -1.75, tint: [COAT, BELLY, 0.5], seed: 75 + sx }, v(0, -0.03, 0.0), v(0, 0, 1), UP, HEAD);

  // ── Antlers: two small groves growing on the head. The roots are gray-white dead wood, and the closer to the branch tips the more newly grown warm brown;
  //    a thick short main trunk dividing up and out into five branches: the outer, front and rear tines each topped with a round-crowned broadleaf tree, a tall pine in the middle, and a small flowering tree on the inner tine;
  //    the short brow tine in front puts out new leaves ──
  const cDead = col(0xa49a88);
  const cBark = col(0x7a5a3e);
  const cGroove = col(0x4e3826);
  const cNew = col(0x8a6a3e);
  const barkColor = (t0: number, t1: number) => (t: number, ridge: number) => {
    const age = t0 + (t1 - t0) * t;
    return cDead.clone().lerp(cBark, sstep(age, 0.15, 0.55)).lerp(cNew, sstep(age, 0.75, 1)).lerp(cGroove, (1 - ridge) * 0.55);
  };
  let bird: THREE.Group | null = null;
  let nestA: THREE.Group | null = null;
  const crowns: THREE.Group[] = [];
  /** Flowers and fruit on the crowns (opening when act.bloom is on) */
  const blooms: THREE.Group[] = [];
  /** The anchors of each antler: the fork, the center of the forest, the pine tip */
  const antA: { fork: THREE.Group; crown: THREE.Group; pine: THREE.Group }[] = [];
  const broad: { g: THREE.Group; surfaceAt: (d: THREE.Vector3) => THREE.Vector3 }[] = [];
  const PAL = [
    { base: 0x509c4a, light: 0x8cc85a, dark: 0x2a6436 },
    { base: 0x438e54, light: 0x7cbe66, dark: 0x245638 },
    { base: 0x6aa446, light: 0xa8d062, dark: 0x386a2e },
    { base: 0x8cbe54, light: 0xc4e27a, dark: 0x507e34 },
  ];
  for (const sx of [-1, 1]) {
    const ag = group(head);
    ag.scale.setScalar(0.92);
    const P = (x: number, y: number, z: number) => v(sx * x, y, z);
    const beam = [P(0.045, 0.07, -0.01), P(0.09, 0.14, -0.035), P(0.15, 0.2, -0.06), P(0.19, 0.25, -0.07)];
    const beamPath = new THREE.CatmullRomCurve3(beam, false, 'centripetal');
    const capEnd = (t: number, from: number) => (t > from ? Math.sqrt(Math.max(0, 1 - ((t - from) / (1 - from)) ** 2)) : 1);
    add(ag, barkTube(beam, (t) => (0.026 - 0.006 * t) * Math.min(1, Math.sqrt(t * 20 + 0.05)) * capEnd(t, 0.9), { segs: 20, radial: 16, grooves: 5, depth: 0.12, seed: sx * 3, color: barkColor(0, 0.45) }), M.bark).userData.inkGroup = ANTL;
    // Antler base: a ring of knobby burr
    {
      const b0 = beamPath.getPointAt(0.14);
      const tb = beamPath.getTangentAt(0.14);
      const bg = group(ag, [b0.x, b0.y, b0.z]);
      bg.quaternion.setFromUnitVectors(UP, tb);
      const tor = new THREE.TorusGeometry(0.026, 0.009, 8, 20);
      tor.deleteAttribute('normal');
      tor.deleteAttribute('uv');
      const tm = mergeVertices(tor, 1e-6);
      const tp = tm.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < tp.count; i++) {
        const q = v(tp.getX(i), tp.getY(i), tp.getZ(i));
        const k = 1 + 0.3 * (vnoise(q.x * 90 + sx, q.y * 90, q.z * 90) - 0.5);
        const c = v(q.x, q.y, 0).setLength(0.026);
        tp.setXYZ(i, c.x + (q.x - c.x) * k, c.y + (q.y - c.y) * k, q.z * k);
      }
      tm.computeVertexNormals();
      add(bg, paint(tm, () => cDead), M.bark, [0, 0, 0], [PI / 2, 0, 0]).userData.inkGroup = ANTL;
    }
    /** A branch splitting off from from (from is inside the parent branch, with the round head of the branch root hidden inside the parent branch) */
    const F = beam[beam.length - 1].clone().lerp(beam[beam.length - 2], 0.3);
    const tine = (from: THREE.Vector3, pts: THREE.Vector3[], r0: number, age0: number) => {
      const all = [from, ...pts];
      const rr = (u: number) => r0 * (1 - 0.45 * u) * Math.min(1, Math.sqrt(u * 12 + 0.1)) * capEnd(u, 0.93);
      add(ag, barkTube(all, rr, { segs: 14, radial: 12, grooves: 4, depth: 0.1, seed: from.y * 7 + pts[0].x * 13 + sx, color: barkColor(age0, 1) }), M.bark).userData.inkGroup = ANTL;
      return all[all.length - 1];
    };
    /** A tree at a branch tip: the pivot is placed at the branch tip, and the crown sways in the wind about the branch tip */
    const cc: THREE.Vector3[] = [];
    const tree = (at: THREE.Vector3, r: number, seed: number, hue: number) => {
      cc.push(at.clone().add(v(0, r * 0.55, 0)));
      const pivot = group(ag, [at.x, at.y, at.z]);
      const g = group(pivot, [0, r * 0.55, 0]);
      const geo = canopyGeo(r, seed, { ...PAL[hue], lobes: 20, amp: 0.36, detail: r < 0.06 ? 4 : 5 });
      add(g, geo, M.leaf);
      crowns.push(pivot);
      if (hue < 3) broad.push({ g, surfaceAt: geo.surfaceAt! });
      return g;
    };
    // Brow tine: a short forward tine, two new leaves at the tip
    const brow = tine(beamPath.getPointAt(0.42), [P(0.15, 0.19, 0.03), P(0.17, 0.22, 0.08)], 0.011, 0.35);
    for (const s of [-1, 1]) {
      const lg = group(ag, [brow.x, brow.y, brow.z], [0.3, sx * 0.3, s * 0.7]);
      add(lg, leafGeo(0.05, 0.026, 0.005, 0.25), M.sprout);
    }
    tree(tine(F, [P(0.27, 0.29, -0.05), P(0.34, 0.33, -0.03)], 0.015, 0.45), 0.095, 11 + sx, 0);
    tree(tine(F, [P(0.22, 0.31, 0.0), P(0.23, 0.37, 0.03)], 0.013, 0.45), 0.085, 17 + sx, 2);
    const backTop = tine(F, [P(0.23, 0.3, -0.14), P(0.26, 0.35, -0.21)], 0.013, 0.45);
    // Hanging vines: two thin vines hanging from the outer and rear tines, with a few small leaves on each vine
    for (const [a, b, len] of [[P(0.29, 0.305, -0.045), P(0.33, 0.2, -0.03), 0.12], [P(0.245, 0.325, -0.18), P(0.27, 0.23, -0.2), 0.1]] as [THREE.Vector3, THREE.Vector3, number][]) {
      const mid = a.clone().lerp(b, 0.5).add(P(0.012, -0.01, 0));
      const vp = [a, mid, b];
      add(ag, loft(vp, (u) => [0.0042 * (1 - u * 0.5), 0.0042 * (1 - u * 0.5)], { segs: 12, radial: 6 }), M.stem);
      const vpath = new THREE.CatmullRomCurve3(vp);
      for (let k = 0; k < 3; k++) {
        const u = 0.4 + k * 0.28;
        const q = vpath.getPointAt(Math.min(1, u));
        const lg = group(ag, [q.x, q.y, q.z], [0.2, (k % 2 ? 1 : -1) * 1.2 + sx * 0.5, (k % 2 ? 1 : -1) * 2.3]);
        add(lg, leafGeo(0.03 + len * 0.1, 0.018, 0.004, 0.2), M.sprout);
      }
    }
    tree(backTop, 0.082, 23 + sx, 1);
    tree(tine(F, [P(0.14, 0.31, -0.11), P(0.1, 0.36, -0.14)], 0.01, 0.5), 0.056, 31 + sx, 3);
    // The pine in the middle: a thin trunk, four layers of sawtooth pine-needle skirts, getting smaller going up
    const pineAt = tine(F, [P(0.2, 0.33, -0.08), P(0.19, 0.4, -0.09)], 0.013, 0.45);
    {
      const pg = group(ag, [pineAt.x, pineAt.y, pineAt.z]);
      const PINE = 9310 + (sx > 0 ? 1 : 0);
      const tiers: [number, number, number][] = [[0.0, 0.09, 0.04], [0.055, 0.075, 0.034], [0.105, 0.06, 0.028], [0.15, 0.045, 0.022]];
      for (let k = 0; k < tiers.length; k++) {
        const [y, len, th] = tiers[k];
        const fo: FurCollarOpts = { r0: 0.005, len, thick: th, flare: 1.12, curl: 0.35, tufts: 7, notch: 0.5, jitter: 0.2, phase: k * 0.37, tint: [0x1f5238, 0x3a8656, 0.55], seed: 60 + k + sx };
        add(pg, thinCollar(furCollar(fo), fo, ...THIN_S), M.leaf, [0, y + len * 0.55, 0]).userData.inkGroup = PINE;
      }
      add(pg, paint(new THREE.ConeGeometry(0.014, 0.06, 10), () => col(0x3a8656)), M.leaf, [0, 0.215, 0]).userData.inkGroup = PINE;
      crowns.push(pg);
      cc.push(pineAt.clone().add(v(0, 0.1, 0)));
      // Anchors: the fork, the center of the forest on this side (the average of the crown centers), the pine tip
      const mid = cc.reduce((a, b) => a.add(b), v(0, 0, 0)).multiplyScalar(1 / cc.length);
      antA.push({ fork: group(ag, [F.x, F.y, F.z]), crown: group(ag, [mid.x, mid.y, mid.z]), pine: group(pg, [0, 0.25, 0]) });
    }
    // At the fork of the rear tine of the right antler is a bird's nest, with three blue eggs
    if (sx > 0) {
      const nest = group(ag, [0.215, 0.29, -0.14], [-0.35, 0, -0.15]);
      nest.scale.setScalar(1.3);
      nestA = group(nest, [0, 0.02, 0]);
      add(nest, lathe([[0.012, -0.022], [0.034, -0.02], [0.046, -0.006], [0.048, 0.008], [0.04, 0.012], [0.03, 0.0], [0.012, -0.004]], 14), M.twig);
      for (let k = 0; k < 4; k++) add(nest, new THREE.TorusGeometry(0.043 - k * 0.002, 0.0035, 5, 16), M.twig, [0, 0.004 - k * 0.005, 0], [PI / 2 + jit(0.25), jit(0.25), 0]);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.3;
        add(nest, new THREE.SphereGeometry(1, 12, 8), M.egg, [Math.cos(a) * 0.014, 0.006, Math.sin(a) * 0.014], [jit(0.4), 0, 0.5], [0.012, 0.016, 0.012]);
      }
      // A little robin stands beside the nest, guarding its eggs
      bird = group(nest, [0.036, 0.012, 0.01], [0, -0.9, 0]);
      add(bird, new THREE.SphereGeometry(1, 14, 10), M.birdBack, [0, 0.024, 0], [0.35, 0, 0], [0.017, 0.016, 0.024]);
      add(bird, new THREE.SphereGeometry(1, 12, 9), M.birdChest, [0, 0.02, 0.009], [0.3, 0, 0], [0.014, 0.013, 0.014]);
      add(bird, new THREE.SphereGeometry(0.012, 12, 9), M.birdBack, [0, 0.043, 0.014]);
      add(bird, new THREE.ConeGeometry(0.0035, 0.01, 8), M.pollen, [0, 0.042, 0.03], [PI / 2, 0, 0]);
      add(bird, slab(outline([[-0.007, 0], [0.007, 0], [0.009, -0.026], [0, -0.022], [-0.009, -0.026]]), 0.003, 0.001, 1), M.birdBack, [0, 0.03, -0.018], [-1.9, 0, 0]);
      for (const s2 of [-1, 1]) {
        const hl = add(bird, new THREE.SphereGeometry(0.0028, 8, 6), M.pupil, [s2 * 0.0095, 0.046, 0.02]);
        hl.castShadow = false;
      }
    }
  }
  // A few pink flowers and one or two fruits on the broadleaf crowns
  for (let i = 0; i < broad.length; i++) {
    const { g, surfaceAt } = broad[i];
    if (i % 2) continue;
    const n = 2;
    for (let k = 0; k < n; k++) {
      const a = k * 2.2 + i;
      const d = v(Math.cos(a) * 0.8, 0.35 + (k % 2) * 0.3, Math.sin(a) * 0.8).normalize();
      // The flowers lie on the surface of the crowns (the undulations of the clumps differ everywhere, so the same function computes the surface points)
      const sp = surfaceAt(d).multiplyScalar(0.985);
      const fg = group(g, [sp.x, sp.y, sp.z]);
      fg.quaternion.setFromUnitVectors(v(0, 0, 1), d);
      blooms.push(fg);
      if ((i + k) % 3 === 2) add(fg, new THREE.SphereGeometry(0.012, 10, 7), M.fruit, [0, 0, 0.004]);
      else {
        add(fg, flowerSlab(0.017, 0.004, 0.0015), M.petal, [0, 0, 0.002], [0, 0, jit(1)]);
        add(fg, new THREE.SphereGeometry(0.005, 8, 6), M.pollen, [0, 0, 0.006]);
      }
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // Anchors (for hooking into the game): all empty groups, hung on parts that move along. L / R are its own left and right (the model faces +z, and the left-hand side is +x)
  const [antR, antL] = antA;
  const canopyAt = antL.crown.position.clone().add(antR.crown.position).multiplyScalar(0.5 * 0.92);
  const mossAt = surf(0.5, PI / 2, 0.035).p;
  const rig = {
    head: group(head, [0, 0.01, 0.1]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [0, -0.07, 0.245]),
      nose: group(head, [0, -0.045, 0.27]),
      antlerL: antL.fork,
      antlerR: antR.fork,
      crownL: antL.crown,
      crownR: antR.crown,
      pineL: antL.pine,
      pineR: antR.pine,
      canopy: group(head, [canopyAt.x, canopyAt.y, canopyAt.z]),
      gem: gemA,
      moss: group(body, [mossAt.x, mossAt.y, mossAt.z]),
      sapling: group(sprouts[0], [0, 0.1, 0]),
      tail: group(tail, [0, -0.14, -0.1]),
      hoofL: shoulders[1].hoof,
      hoofR: shoulders[0].hoof,
      nest: nestA ?? group(head),
    },
  };
  // Action weights (performances tween these values; see the names in <Action table> in the file header)
  const act = { focus: 0, glow: 0, bloom: 0, rustle: 0, raise: 0, rear: 0, brace: 0 };
  const bloomRest = blooms.map((b) => b.scale.x);
  let lastGlow = -1;

  // ── Idle: breathing, slow looking around, blinking, the ears twitching now and then, the tail flicking now and then, the crowns swaying lightly in the wind, the source crystal glimmering faintly ──
  let blinkIn = 2.4;
  let blinkT = -1;
  const crownRest = crowns.map((c) => c.rotation.clone());
  const sproutRest = sprouts.map((s) => s.rotation.z);
  const update = (t: number, dt: number) => {
    const br = Math.sin(t * 1.1);
    torso.scale.set(1 + br * 0.01, 1 + br * 0.012, 1);
    body.position.y = BY + br * 0.003;
    // focus stops looking around and looks straight ahead; raise throws the head back in a long call (the neck stretching up, the nose tip pointing to the sky); brace lowers the head and presses the forest of the antlers forward
    const roam = 1 - act.focus;
    neck.rotation.y = (Math.sin(t * 0.3) * 0.14 + Math.sin(t * 0.87) * 0.02) * roam;
    neck.rotation.x = Math.sin(t * 0.47) * 0.02 * roam - act.raise * 0.62 + act.brace * 0.62;
    head.rotation.x = 0.12 - act.raise * 0.26 + act.brace * 0.18;
    head.rotation.z = Math.sin(t * 0.3 + 0.7) * 0.025 * roam;
    // rear: the front of the body tilts up about the rump and the forelegs lift forward, pawing in the air one after the other; falling back to 0 is stamping on the ground
    rearG.rotation.x = -act.rear * 0.74;
    for (const s of shoulders) {
      const paw = Math.sin(t * 10 + (s.sx > 0 ? 0 : PI)) * 0.3 * act.rear;
      s.sh.rotation.x = -act.rear * 0.2 + paw;
      s.sh.rotation.z = s.sx * act.rear * 0.06;
    }

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
      const ph = (t + i * 2.7) % 6.1;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.25 : 0;
      // In a long call and with the head lowered the ears are laid back
      const back = Math.max(act.raise, act.brace);
      ears[i].rotation.z = -sx * (1.25 - back * 0.35) + sx * tw * (1 - back);
      ears[i].rotation.x = 0.15 - back * 0.55;
    }
    const tp = t % 7.3;
    tail.rotation.x = 0.5 - (tp < 0.5 ? Math.sin((tp / 0.5) * PI) * 0.5 : 0) + Math.sin(t * 1.3) * 0.03;
    // bloom: the crowns on the antlers swell, flowers and fruit open, the seedlings on the back grow taller; rustle: the crowns tremble rustling, shaken by a sound wave or a stomp
    const swell = 1 + act.bloom * 0.24;
    for (let i = 0; i < crowns.length; i++) {
      const r0 = crownRest[i];
      const sh = act.rustle * 0.08;
      crowns[i].rotation.set(r0.x + Math.sin(t * 0.9 + i * 1.3) * 0.03 + Math.sin(t * 23 + i * 1.7) * sh, r0.y, r0.z + Math.sin(t * 0.7 + i) * 0.04 + Math.cos(t * 19 + i * 2.3) * sh);
      crowns[i].scale.setScalar(swell);
    }
    for (let i = 0; i < blooms.length; i++) blooms[i].scale.setScalar(bloomRest[i] * (1 + act.bloom * 1.3));
    for (let i = 0; i < sprouts.length; i++) {
      sprouts[i].rotation.z = sproutRest[i] + Math.sin(t * 1.4 + i * 2.1) * 0.06 + Math.sin(t * 21 + i) * act.rustle * 0.12;
      sprouts[i].scale.setScalar(1 + act.bloom * 0.7);
    }
    // glow: the source crystal on the chest lights up and green shows from the back of the eye (the eyes are written only when a weight changes, so another ultimate changing the emissive is not overwritten)
    M.gem.emissiveIntensity = (0.55 + Math.sin(t * 1.1) * 0.08) * (1 + act.glow * 1.2);
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.eye.emissiveIntensity = act.glow * 0.4;
    }
    // The little bird beside the nest quickly turns its head to look every few seconds
    if (bird) {
      const ph = t % 4.3;
      bird.rotation.y = -0.9 + (sstep(ph, 1.6, 1.68) - sstep(ph, 3.3, 3.38)) * 0.7;
    }
  };
  update(0, 0);

  // Draw calls: parts that never move on their own are merged into the groups that move (the rearing hip pivot, body, two shoulders, tail, neck, head, ears, eyelids, crowns, flowers and fruit, the seedlings on the back, the little bird);
  // the torso scales itself when breathing and the eye highlights are hidden when the eyes close, so those are not merged; the eyelids are hidden when the eyes are open, so they are neither merged nor drawn
  mergeStatic(root, {
    owners: [rearG, body, ...shoulders.map((s) => s.sh), tail, neck, head, ...ears, ...lids, ...lowers, ...crowns, ...blooms, ...sprouts, ...(bird ? [bird] : [])],
    keep: [torso, ...glints],
    rig,
    share: [nostrils],
  });
  return { root, update, center: new THREE.Vector3(0, 0.96, -0.02), radius: 1.08, rig, act };
}
