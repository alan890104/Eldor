// Elder Banyan (model lab version, SR, nature + earth, rooting / entangling): the oldest banyan tree in the Verdantwhisper Forest, whose aerial roots hang all the way down into the ground beneath Stoneheart Canyon.
// It takes only one step a year, yet the forest folk say there has never been a drought where it has walked.
// Only one form (decided by the user, 2026-09-28): the builder takes no stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on (from the name, lore and element):
// 1. A spreading umbrella-shaped canopy: seven foliage clusters stacked into one big umbrella leaning to the right, one high in the middle with an outer ring a step lower, and one more at the end of the long horizontal branch on the right, layered front to back;
//    each cluster is a whole shell held up by twenty-odd leaf clumps, with creases pressed in between clumps, the lower edge cut into a ring of hanging leaf tips, bright on top and dark underneath. It is wider than the tree is tall.
// 2. A curtain of aerial roots: a dozen-odd roots of varying thickness hanging from under the canopy and from the long horizontal branch, bark gray in the upper section turning red-brown going down, with round pale root tips;
//    three places are two roots growing twisted around each other like a braid. Two of them have already rooted into the ground and become prop roots (the banyan's signature): one holds up the end of the long horizontal branch reaching to the right, and one is at the left rear.
// 3. Buttress-root feet: the base of the trunk flares outward against the ground, and four clusters of buttress roots grow out from the flare, bending down like feet to grip the ground, the main buttress root ending in three flat root toes.
//    The cluster at the left front is lifted off the ground (the one step a year is just halfway), with root toes of uneven length hanging down, carrying two water drops and a small tuft of moss brought up with them;
//    the place it is about to step on has already seeped out a puddle of water, ringed by wet moss (wherever it walks, the water arrives first).
// 4. Layered bark: the trunk is a single root fused from six aerial roots, slightly twisted, with deep narrow V grooves between roots; the surface also has a ring of sixteen longitudinal furrows,
//    adjacent ones snaking in opposite directions and enclosing diamond-shaped bark plates, the furrows with real depth and the ridges between furrows raised and slightly lighter; moss grows at the root on the shaded side, with a few scattered patches of lichen.
// 5. Water-glow in the tree hollow: between the two fused roots at the front right splits a hollow pointed at the top and round at the bottom, ringed by curled-over healed wood at the opening,
//    with a small pool of glowing water collected at the bottom of the hollow (the only emissive on the whole body).
// Body shape: a tree that walks, not a person with bark on. No face: no features are carved on the trunk, and no eyes, mouth or brows are made; its emotion comes from the canopy's sway, the aerial roots' swing and the light in the hollow.
// The trunk does not leave the ground and its base flares against the ground (the first version propped the trunk on four buttress roots, and from the front it looked like a body with its legs spread, which was changed).
// Kept distinct from the other spirits: Elderwood Warden is a bear carrying a broken log (upright, warm chestnut, a single slanted log); Sylvaron is a round tree crown on antlers;
// Springlotus is a lotus at a spring; Dandelion is a white fluffball; Monolith Colossus is an upright stone. Here it is a wide, flat umbrella canopy leaning to one side, with a vertical curtain of roots and prop roots.
//
// Personality: an unhurried ancestor of few words. Nothing is urgent, one step is a year's thought, but every step is planned for where it will bring the water.
// Gaze order: with no face, the first look is the outline of the umbrella canopy plus the curtain of aerial roots (this is its face); the second look is the water-glow in the tree hollow (the only bright color in a dark hollow) and the lifted root foot and the puddle beneath it;
// the prop roots, bark and cloth strips are support.
// Back: the prop root at the left rear has a ring of straw rope tied on it, with five faded cloth strips hanging down (tied by the forest folk when they came to pray for rain); between the two clusters of hind feet sits a clay bowl filled with water.
// Restrained light effects: no halo and no glowing dots, and the only emissive is that one pool in the hollow; the puddle, water drops and leaves rely only on shading and color.
//
// <Action table> (battle actions follow this table)
// - Idle: barely moves. The seven clusters of the canopy each rise and fall slowly (as if breathing in the wind), the curtain of aerial roots sways lightly like a pendulum, the lifted root foot hangs without coming down and now and then probes down a little before drawing back,
//   the light in the hollow flickers very slowly, and the cloth strips flutter in the wind.
// - Move: the whole tree leans forward a little, and the lifted root foot slowly comes down (act.step), with the other root feet not moving.
// - Charge-up: the light in the hollow lights up (act.glow), and the aerial roots draw inward.
// - Strike: the curtain of aerial roots whips forward to entangle the opponent (act.lash).
// - Hit: the whole canopy rustles and trembles (act.rustle), and the trunk does not retreat.
// - Victory: puts the cluster of root feet it has held up for a year down into the puddle (act.step = 1).
// act: glow (0-1, the water-glow lights up), rustle (0-1, canopy trembling), lash (0-1, the curtain of aerial roots whips forward), step (0-1, the lifted root foot lands).
// Anchors: head (top of the trunk, the visual center under the canopy), eyes (empty array), mouth (opening of the tree hollow), glow (the water-glow at the bottom of the hollow, turning red when corrupted),
// canopy (top of the canopy), foot (the root toes of the lifted cluster), puddle (center of the puddle), rootsL / rootsR (the root tips of the left curtain of aerial roots and of the one hanging from the long horizontal branch on the right, L is its own left +x),
// strips (the knot of the rain-prayer cloth strips), trunk (middle of the trunk).

import * as THREE from 'three';
import { curveTable, lathe, mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Helpers ─────────────────────────

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
  const a = lerp(lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), w);
  const b = lerp(lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), w);
  return lerp(a, b, q);
}

interface BarkSample {
  u: number;
  /** 0 is the middle of the V groove between fused roots and 1 is on the root's ridge */
  groove: number;
  /** 1 is inside a longitudinal furrow of the bark */
  crack: number;
  /** 0 is on a furrow and 1 is on the bark ridge midway between two furrows */
  ridge: number;
  p: THREE.Vector3;
  /** How much it faces radially upward (-1 to 1); moss grows on upward-facing surfaces */
  up: number;
  /** The extra amount of push in and out from disp (negative inward for the tree hollow) */
  extra: number;
}

interface TubeOpts {
  segs: number;
  radial: number;
  rad: (u: number) => number;
  /** Ratio of the two axes of the cross-section [N direction, B direction]: a buttress root has a tall thin cross-section and a cloth strip a flat one */
  ell?: (u: number) => [number, number];
  /** A fixed B-axis reference (the horizontal lateral direction of a buttress root); if not given, a parallel-transport frame is used */
  side?: THREE.Vector3;
  /** Fused roots: lobes round ridges on the cross-section, with deep narrow V grooves between ridges (pitfall 39) */
  lobes?: number;
  lobeA?: number;
  /** Number of turns the round ridges twist along the length (a braid-like prop root) */
  twist?: number;
  /**
   * Longitudinal bark furrows: a ring of furrows of them, snaking left and right along the length with adjacent ones in opposite phase, enclosing diamond-shaped bark plates when they come close;
   * furrowW is the half width of a furrow, furrowD the depth, plate the rise of the bark ridge between two furrows, and wob the angular frequency of the snaking per unit length
   */
  furrows?: number;
  furrowW?: number;
  furrowD?: number;
  plate?: number;
  wob?: number;
  seed?: number;
  disp?: (p: THREE.Vector3) => number;
  /** A round cap closing the end into a hemisphere (world length): the last three rings close along a quarter circle, so the root tip does not become a sharpened pencil */
  endCap?: number;
  paint: (s: BarkSample) => THREE.Color;
}

/**
 * Bark tube: a tube along a curve whose cross-section can be a fused root's round ridges plus V grooves, or an ellipse (buttress root, cloth strip); a ring of snaking longitudinal furrows is also carved on the surface,
 * with the furrows pressed inward to real depth (readable by both outlines and toon shading), and the bark ridges between furrows raised. An end with radius 0 closes to a pole,
 * or closes with endCap into a hemispherical round cap (no tube opening shows, pitfall 25).
 * Vertices are shared around the ring, with no duplicate vertices at the seam (pitfall 36).
 */
function barkTube(pts: THREE.Vector3[], o: TubeOpts): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const S = o.segs;
  const R = o.radial;
  const L = path.getLength();
  const fr = o.side ? null : path.computeFrenetFrames(S, false);
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const E = new THREE.Vector3();
  const U = new THREE.Vector3();
  // Round cap: the first S-3 rings are split evenly up to 1 - c, and the last three rings are laid out along a quarter circle
  const cap = o.endCap ? Math.min(0.3, o.endCap / L) : 0;
  const uOf = (i: number) => {
    if (!cap || i <= S - 3) return cap ? (i / (S - 3)) * (1 - cap) : i / S;
    return 1 - cap + cap * Math.sin(((i - (S - 3)) / 3) * (PI / 2));
  };
  const rOf = (i: number) => {
    if (!cap || i <= S - 3) return o.rad(uOf(i));
    return o.rad(1 - cap) * Math.cos(((i - (S - 3)) / 3) * (PI / 2));
  };
  const frame = (i: number) => {
    const u = uOf(i);
    path.getPointAt(u, C);
    if (fr) {
      T.copy(fr.tangents[i]);
      N.copy(fr.normals[i]);
      B.copy(fr.binormals[i]);
    } else {
      path.getTangentAt(Math.min(u, 1), T);
      B.copy(o.side!).addScaledVector(T, -T.dot(o.side!)).normalize();
      N.crossVectors(B, T).normalize();
    }
  };
  const startPole = o.rad(0) <= 1e-6;
  const endPole = cap > 0 || o.rad(1) <= 1e-6;
  const i0 = startPole ? 1 : 0;
  const i1 = endPole ? S - 1 : S;
  let ravg = 0;
  for (let k = 0; k <= 8; k++) ravg += o.rad(k / 8) / 9;
  const nf = o.furrows ?? 0;
  const fw = o.furrowW ?? 0.01;
  const wob = o.wob ?? 9;
  const K = o.lobes ?? 0;
  const A = o.lobeA ?? 0;
  const tw = o.twist ?? 0;
  const seed = o.seed ?? 0;
  const pos: number[] = [];
  const cl: number[] = [];
  const push = (p: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z);
    cl.push(c.r, c.g, c.b);
  };
  for (let i = i0; i <= i1; i++) {
    frame(i);
    const u = uOf(i);
    const rr = rOf(i);
    const [ea, eb] = o.ell ? o.ell(u) : [1, 1];
    for (let j = 0; j < R; j++) {
      const th = (j / R) * PI * 2;
      const tp = th + tw * u * PI * 2 + seed + 0.18 * Math.sin(3 * th + seed);
      const f = K ? Math.pow(Math.abs(Math.sin((K * tp) / 2)), 0.55) : 1;
      const groove = 1 - f;
      let crack = 0;
      let ridge = 0.5;
      if (nf) {
        const x = (th / (2 * PI)) * nf;
        const sl = u * L;
        const k0 = Math.floor(x);
        let dmin = 9;
        for (let k = k0 - 1; k <= k0 + 1; k++) {
          const kw = ((k % nf) + nf) % nf;
          const c = k + 0.5 + 0.34 * Math.sin(sl * wob + hash3(kw, seed, 1) * 1.2 + (kw % 2) * PI) + 0.1 * Math.sin(sl * wob * 2.3 + hash3(kw, seed, 2) * 6.28);
          dmin = Math.min(dmin, Math.abs(x - c));
        }
        const dw = dmin * ((2 * PI * Math.max(rr, 0.02)) / nf);
        crack = 1 - sstep(dw, fw * 0.35, fw);
        ridge = Math.min(1, dmin * 2);
      }
      const scale = Math.min(1, rr / 0.08);
      const r = rr * (1 - A * groove) - (o.furrowD ?? 0) * crack * scale + (o.plate ?? 0) * Math.sin(ridge * PI * 0.5) * scale;
      E.copy(N).multiplyScalar(Math.cos(th) * ea).addScaledVector(B, Math.sin(th) * eb);
      const P = C.clone().addScaledVector(E, r);
      U.copy(E).normalize();
      let extra = 0;
      if (o.disp) {
        extra = o.disp(P);
        P.addScaledVector(U, extra);
      }
      push(P, o.paint({ u, groove, crack, ridge, p: P, up: U.y, extra }));
    }
  }
  const rings = i1 - i0 + 1;
  const idx: number[] = [];
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < R; j++) {
      const a = i * R + j;
      const b = i * R + ((j + 1) % R);
      const c = (i + 1) * R + j;
      const d = (i + 1) * R + ((j + 1) % R);
      idx.push(a, b, c, b, d, c);
    }
  let next = rings * R;
  if (startPole) {
    frame(0);
    push(C, o.paint({ u: 0, groove: 0, crack: 0, ridge: 0.5, p: C.clone(), up: 0, extra: 0 }));
    const s = next++;
    for (let j = 0; j < R; j++) idx.push(s, (j + 1) % R, j);
  }
  if (endPole) {
    frame(S);
    push(C, o.paint({ u: 1, groove: 0, crack: 0, ridge: 0.5, p: C.clone(), up: 0, extra: 0 }));
    const e = next++;
    const base = (rings - 1) * R;
    for (let j = 0; j < R; j++) idx.push(e, base + j, base + ((j + 1) % R));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * One foliage cluster: a shell of a latitude-longitude grid (one vertex at each pole), pushed outward by a dozen-odd spherical-cap-shaped leaf clumps (taking the maximum), with the junctions dished into creases (pitfall 50);
 * below the equator a ring of hanging leaf tips is cut (4 columns per leaf tip, with the sample points falling exactly on the tips and valleys, pitfall 82), and the underside is pressed flat. Bright at the top, dark in the creases and on the underside.
 */
function clumpGeo(rx: number, ry: number, rz: number, seed: number, o: { lobes: number; amp: number; teeth: number; rows: number; base: number; light: number; dark: number; squash?: number; droop?: number; lw?: [number, number] }): THREE.BufferGeometry {
  const rand = rng(seed);
  const lobes: { d: THREE.Vector3; w: number; h: number }[] = [];
  for (let i = 0; i < o.lobes; i++) {
    const y = 1 - ((i + 0.5) / o.lobes) * 1.5;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996 + rand() * 0.7;
    lobes.push({ d: v(Math.cos(a) * rr + (rand() - 0.5) * 0.2, y + (rand() - 0.5) * 0.15, Math.sin(a) * rr + (rand() - 0.5) * 0.2).normalize(), w: (o.lw ?? [0.46, 0.68])[0] + rand() * ((o.lw ?? [0.46, 0.68])[1] - (o.lw ?? [0.46, 0.68])[0]), h: 0.7 + rand() * 0.3 });
  }
  const lobeAt = (d: THREE.Vector3) => {
    let best = 0;
    for (const l of lobes) {
      const ang = d.angleTo(l.d);
      if (ang < l.w) best = Math.max(best, l.h * Math.sqrt(1 - (ang / l.w) ** 2));
    }
    return best;
  };
  const cols = o.teeth * 4;
  const rows = o.rows;
  const sq = o.squash ?? 0.6;
  const droop = o.droop ?? 0.08;
  const cB = col(o.base);
  const cL = col(o.light);
  const cD = col(o.dark);
  const pos: number[] = [];
  const cl: number[] = [];
  const d = new THREE.Vector3();
  const tc = new THREE.Color();
  const put = (ph: number, th: number) => {
    d.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    const best = lobeAt(d);
    const f = (th / (2 * PI)) * o.teeth;
    const tooth = 1 - Math.abs(2 * (f - Math.floor(f)) - 1);
    const rim = sstep(-d.y, -0.25, 0.1) * (1 - sstep(-d.y, 0.5, 0.85));
    const k = (0.72 + o.amp * best) * (1 + 0.13 * tooth * rim);
    const yy = (d.y < 0 ? d.y * sq : d.y) - droop * tooth * rim;
    pos.push(d.x * rx * k, yy * ry * k, d.z * rz * k);
    // The tops of the leaf clumps are bright, between clumps and on the underside dark; the leaf tips a little brighter than the leaf roots
    tc.copy(cB)
      .lerp(cL, sstep(best, 0.45, 0.95) * sstep(d.y, -0.15, 0.65) * 0.9)
      .lerp(cD, Math.max(sstep(0.32 - best, 0, 0.3) * 0.6, sstep(-d.y, 0.05, 0.6) * 0.8))
      .lerp(cB, tooth * rim * 0.25);
    cl.push(tc.r, tc.g, tc.b);
  };
  for (let i = 1; i < rows; i++) for (let j = 0; j < cols; j++) put((i / rows) * PI, (j / cols) * PI * 2);
  const top = pos.length / 3;
  put(0, 0);
  const bot = pos.length / 3;
  put(PI, 0);
  const idx: number[] = [];
  const rings = rows - 1;
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * cols + j;
      const b = i * cols + ((j + 1) % cols);
      const c = (i + 1) * cols + j;
      const e = (i + 1) * cols + ((j + 1) % cols);
      idx.push(a, b, c, b, e, c);
    }
  for (let j = 0; j < cols; j++) idx.push(top, (j + 1) % cols, j);
  const lb = (rings - 1) * cols;
  for (let j = 0; j < cols; j++) idx.push(bot, lb + j, lb + ((j + 1) % cols));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A polar-coordinate ground patch: one pole at the center, h(x, z) gives the height and c(x, z, h) the color; outer edge radius edge(θ) */
function groundGeo(rings: number, cols: number, edge: (th: number) => number, h: (x: number, z: number, s: number) => number, c: (x: number, z: number, y: number, s: number) => THREE.Color, cx = 0, cz = 0, rot = 0, sx = 1, sz = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  const put = (s: number, th: number) => {
    const r = s * edge(th);
    const lx = Math.cos(th) * r * sx;
    const lz = Math.sin(th) * r * sz;
    const x = cx + lx * Math.cos(rot) - lz * Math.sin(rot);
    const z = cz + lx * Math.sin(rot) + lz * Math.cos(rot);
    const y = h(x, z, s);
    pos.push(x, y, z);
    const cc = c(x, z, y, s);
    cl.push(cc.r, cc.g, cc.b);
  };
  for (let i = 1; i <= rings; i++) for (let j = 0; j < cols; j++) put(i / rings, (j / cols) * PI * 2);
  const ctr = pos.length / 3;
  put(0, 0);
  const idx: number[] = [];
  // Looking from outside in is looking from above: increasing θ goes from +x toward +z (clockwise seen from above), and the triangle (a, c, b) faces up
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * cols + j;
      const b = i * cols + ((j + 1) % cols);
      const c2 = (i + 1) * cols + j;
      const d = (i + 1) * cols + ((j + 1) % cols);
      idx.push(a, b, c2, b, d, c2);
    }
  for (let j = 0; j < cols; j++) idx.push(ctr, (j + 1) % cols, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // If the winding faces down, flip the sheet (look at the normal at the center pole)
  const n = g.attributes.normal as THREE.BufferAttribute;
  if (n.getY(ctr) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildBanyanelderLab(): LabModel {
  const rand = rng(20260928);
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const RIM_BARK = 0xffe8cc;
  const RIM_LEAF = 0xe2ffc0;
  const M = {
    bark: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIM_BARK })),
    leaf: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIM_LEAF })),
    moss: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIM_LEAF })),
    water: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.2, rimColor: 0xdaf6ff })),
    drop: labToon(0x8fd6e6, { ramp: 'gem', spec: 1.1, specTh: 0.97, rim: 0.5, rimColor: 0xdaf6ff }),
    heart: labToon(0x8af0e6, { ramp: 'gem', emissive: 0x2ec4cc, emissiveAmt: 0.9, rim: 0 }),
    rope: labToon(0xc7a86a, { rim: 0.35, speckle: 0.2 }),
    cloth: vc(labToon(0xffffff, { rim: 0.35 })),
    clay: labToon(0xb4623c, { speckle: 0.25, rim: 0.35 }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'banyanelder-lab';
  const { add, group } = partKit();

  // Outline group: the trunk and buttress roots in the same group (the roots grow from the trunk, so no line is drawn at the junction)
  const TRUNK = 9701;

  // Bark: a cool gray-brown (banyan bark is gray), with the grooves and cracks dark brown
  const BARK = col(0x938a7c);
  const BARK_HI = col(0xb8b09f);
  const BARK_DK = col(0x4a4239);
  const CRACK = col(0x342d28);
  const LICHEN = col(0xa3ae8c);
  const MOSS = col(0x5a7c36);
  const MOSS_HI = col(0x86a348);
  const WET = col(0x3a5229);
  const SOIL = col(0x5a4634);
  const HOLLOW = col(0x1c1411);
  const LIP = col(0xa89a84);
  const ROOT_MID = col(0x86624c);
  const ROOT_TIP = col(0xd2b394);

  const barkPaint = (mossUp = 0) => (s: BarkSample) => {
    const c = BARK.clone();
    c.lerp(BARK_HI, sstep(s.ridge, 0.45, 0.95) * 0.55 * (1 - sstep(s.groove, 0.2, 0.6)) * (1 - s.crack));
    c.lerp(BARK_DK, sstep(s.groove, 0.3, 0.85) * 0.85);
    c.lerp(CRACK, sstep(s.crack, 0.3, 1) * 0.75);
    const n = vnoise(s.p.x * 7 + 3, s.p.y * 7, s.p.z * 7);
    c.lerp(LICHEN, sstep(n, 0.76, 0.82) * 0.4 * (1 - s.crack));
    if (mossUp > 0) {
      const m = sstep(s.up, 0.5, 0.85) * sstep(vnoise(s.p.x * 5, s.p.y * 5 + 9, s.p.z * 5), 0.45, 0.6) * mossUp;
      c.lerp(n > 0.5 ? MOSS_HI : MOSS, m);
    }
    return c;
  };

  // ── Trunk: six fused aerial roots twisted into one whole root, the base flaring outward against the ground, with the buttress roots growing out from the flare ──
  const trunkRad = curveTable([
    [0, 0],
    [0.015, 0.3],
    [0.05, 0.37],
    [0.13, 0.31],
    [0.28, 0.268],
    [0.48, 0.25],
    [0.68, 0.252],
    [0.84, 0.272],
    [0.93, 0.24],
    [1, 0],
  ]);
  // Tree hollow: at the front right, pointed at the top and round at the bottom, ringed by curled-over healed wood at the opening; a small pool of glowing water collected at the bottom
  const HOLE_PHI = -0.34;
  const HOLE_Y = 0.54;
  const HOLE_W = 0.11;
  const HOLE_H = 0.19;
  const holeField = (p: THREE.Vector3) => {
    let dphi = Math.atan2(p.x, p.z) - HOLE_PHI;
    dphi = Math.atan2(Math.sin(dphi), Math.cos(dphi));
    const b = (p.y - HOLE_Y) / HOLE_H;
    const a = (dphi * 0.26) / HOLE_W / Math.max(0.25, 1 - 0.55 * Math.max(0, b));
    return Math.hypot(a, b);
  };
  const trunkGeo = barkTube([v(0, 0.02, 0), v(0.012, 0.36, 0.006), v(-0.01, 0.7, -0.012), v(0, 1.06, -0.03)], {
    segs: 48,
    radial: 96,
    rad: (u) => trunkRad(u)[0],
    lobes: 6,
    lobeA: 0.13,
    twist: 0.18,
    furrows: 16,
    furrowW: 0.013,
    furrowD: 0.017,
    plate: 0.007,
    wob: 8,
    seed: 1.3,
    disp: (p) => {
      const s = holeField(p);
      return -0.13 * sstep(1 - s, 0, 0.3) - 0.03 * Math.max(0, 1 - s * s) + 0.018 * Math.exp(-(((s - 1.1) / 0.12) ** 2));
    },
    paint: (s) => {
      const c = barkPaint(0)(s);
      // The lower half of the shaded side (the back) grows moss
      const n = vnoise(s.p.x * 6, s.p.y * 6, s.p.z * 6);
      const back = sstep(-s.p.z, 0.0, 0.2);
      c.lerp(n > 0.6 ? MOSS_HI : MOSS, sstep(0.26 + 0.12 * n - s.p.y, 0, 0.05) * back * 0.6 * (1 - s.crack * 0.5));
      if (s.extra > 0.006) c.lerp(LIP, sstep(s.extra, 0.006, 0.016) * 0.6);
      if (s.extra < -0.004) c.lerp(HOLLOW, sstep(-s.extra, 0.004, 0.04));
      return c;
    },
  });
  const trunk = add(root, trunkGeo, M.bark);
  trunk.userData.inkGroup = TRUNK;

  // ── Buttress-root feet: four clusters, each with one main buttress root plus a small one, the main buttress root ending in three flat root toes gripping into the soil ──
  const plankRad = curveTable([
    [0, 0],
    [0.08, 0.125],
    [0.35, 0.112],
    [0.6, 0.088],
    [0.84, 0.06],
    [0.96, 0.044],
    [1, 0],
  ]);
  const toeRad = curveTable([
    [0, 0],
    [0.14, 0.036],
    [0.6, 0.03],
    [1, 0.026],
  ]);
  interface Foot {
    phi: number;
    s: number;
    toes: boolean;
  }
  /** One buttress root (built in world coordinates, with off subtracted when placed in parent); the root toes of a lifted one extend flat, hanging slightly */
  const plank = (parent: THREE.Object3D, off: THREE.Vector3, f: Foot, lifted: boolean) => {
    const d = v(Math.sin(f.phi), 0, Math.cos(f.phi));
    const side = v(Math.cos(f.phi), 0, -Math.sin(f.phi));
    const R = f.s;
    const P = (r: number, y: number) => v(d.x * r, y, d.z * r);
    const hk = lerp(0.88, 1, R);
    const pts = [P(0.08, 0.62 * hk), P(0.22, 0.5 * hk), P(0.35 * R + 0.04, 0.32 * R), P(0.47 * R + 0.04, 0.16 * R), P(0.57 * R + 0.04, 0.065), P(0.63 * R + 0.04, 0.03)];
    const g = barkTube(pts, {
      segs: 22,
      radial: 12,
      rad: (u) => plankRad(u)[0] * lerp(0.72, 1, R),
      side,
      ell: (u) => [lerp(1.05, 0.55, sstep(u, 0.55, 1)), lerp(0.62, 0.95, sstep(u, 0.55, 1))],
      furrows: 7,
      furrowW: 0.011,
      furrowD: 0.01,
      plate: 0.004,
      wob: 11,
      seed: f.phi * 3.1,
      paint: barkPaint(0.7),
    });
    g.translate(-off.x, -off.y, -off.z);
    const m = add(parent, g, M.bark);
    m.userData.inkGroup = TRUNK;
    const tips: THREE.Vector3[] = [];
    if (f.toes)
      for (const k of [-1, 0, 1]) {
        const a = f.phi + (lifted ? [-0.28, 0.02, 0.44][k + 1] : k * 0.34);
        const dd = v(Math.sin(a), 0, Math.cos(a));
        const Q = (r: number, y: number) => v(dd.x * r, y, dd.z * r);
        const base = P(0.46 * R + 0.04, 0.15 * R);
        // The root toes of the lifted cluster are of uneven length and hang down (as if just pulled out of the soil); the planted root toes lie flat against the ground
        const reach = lifted ? [0.58, 0.7, 0.52][k + 1] : 0.68 - Math.abs(k) * 0.025;
        const tip = Q(reach * R + 0.06, lifted ? [-0.02, -0.07, 0.0][k + 1] : 0.016);
        const mid = base.clone().lerp(tip, 0.5).add(v(0, lifted ? 0.035 : 0.03, 0));
        const tg = barkTube([base, mid, tip], {
          segs: 10,
          radial: 8,
          rad: (u) => toeRad(u)[0] * (k ? 0.85 : 1),
          side: v(dd.z, 0, -dd.x),
          ell: (u) => [lerp(1, 0.7, u), lerp(1, 1.25, u)],
          endCap: 0.02,
          paint: (s) => BARK.clone().lerp(ROOT_MID, s.u * 0.5).lerp(ROOT_TIP, sstep(s.u, 0.88, 1) * 0.45),
        });
        tg.translate(-off.x, -off.y, -off.z);
        add(parent, tg, M.bark);
        tips.push(tip.sub(off));
      }
    return tips;
  };
  const FEET: Foot[][] = [
    // Left front (the lifted cluster)
    [
      { phi: 0.72, s: 1, toes: true },
      { phi: 1.16, s: 0.8, toes: false },
    ],
    // Right front
    [
      { phi: -0.7, s: 1, toes: true },
      { phi: -1.14, s: 0.82, toes: false },
    ],
    // Left rear
    [
      { phi: 2.28, s: 1, toes: true },
      { phi: 1.86, s: 0.78, toes: false },
    ],
    // Right rear
    [
      { phi: -2.32, s: 1, toes: true },
      { phi: -2.74, s: 0.8, toes: false },
    ],
  ];
  // The lifted cluster: turned upward about its root on the trunk, with the root toes about 0.15 off the ground
  const LIFT_PHI = 0.9;
  const LIFT_AX = v(Math.cos(LIFT_PHI), 0, -Math.sin(LIFT_PHI));
  const LIFT_PIVOT = v(Math.sin(LIFT_PHI) * 0.2, 0.56, Math.cos(LIFT_PHI) * 0.2);
  const LIFT = 0.2;
  const LIFT_UP = 0.085;
  const liftG = group(root, [LIFT_PIVOT.x, LIFT_PIVOT.y, LIFT_PIVOT.z]);
  let footTips: THREE.Vector3[] = [];
  for (let c = 0; c < FEET.length; c++)
    for (const f of FEET[c]) {
      const tips = plank(c === 0 ? liftG : root, c === 0 ? LIFT_PIVOT : v(0, 0, 0), f, c === 0);
      if (c === 0 && tips.length) footTips = tips;
    }
  // The lifted root toes carry two water drops and a small tuft of moss brought up with them
  const dropGeo = lathe(
    [
      [0, -0.026],
      [0.008, -0.021],
      [0.013, -0.012],
      [0.011, -0.004],
      [0.005, 0],
      [0, 0.003],
    ] as [number, number][],
    10,
  );
  for (const k of [0, 2]) {
    const tp = footTips[k];
    add(liftG, dropGeo, M.drop, [tp.x, tp.y - 0.02, tp.z]);
  }
  const clodGeo = clumpGeo(0.05, 0.03, 0.045, 77, { lobes: 6, amp: 0.4, teeth: 6, rows: 6, base: 0x5a7c36, light: 0x86a348, dark: 0x3a5229, squash: 0.9, droop: 0.02 });
  const clod = add(liftG, clodGeo, M.moss, [footTips[1].x * 0.93, footTips[1].y + 0.026, footTips[1].z * 0.93]);
  clod.rotation.x = 0.4;
  // The position of the root toes in the world after being lifted: the puddle is directly below them
  const liftQ0 = new THREE.Quaternion().setFromAxisAngle(LIFT_AX, -LIFT);
  const liftedTips = footTips.map((p) => p.clone().applyQuaternion(liftQ0).add(LIFT_PIVOT).add(v(0, LIFT_UP, 0)));

  // ── Main branches: splitting into six from the top of the trunk; one especially long horizontal branch reaches to the right (-x), its end held up by a prop root ──
  const limbRad = curveTable([
    [0, 0],
    [0.1, 0.125],
    [0.35, 0.1],
    [0.7, 0.072],
    [0.92, 0.056],
    [1, 0],
  ]);
  const LIMBS: THREE.Vector3[][] = [
    [v(0.02, 0.84, -0.04), v(0.06, 1.08, -0.08), v(0.1, 1.3, -0.1), v(0.12, 1.5, -0.1)],
    [v(0.02, 0.86, 0), v(0.28, 1.03, 0.06), v(0.5, 1.2, 0.12), v(0.7, 1.31, 0.16)],
    [v(0.02, 0.86, -0.02), v(0.2, 1.03, -0.22), v(0.36, 1.2, -0.44), v(0.5, 1.36, -0.56)],
    [v(-0.02, 0.86, -0.04), v(-0.2, 1.04, -0.16), v(-0.36, 1.22, -0.28), v(-0.5, 1.38, -0.36)],
    [v(-0.02, 0.86, 0.02), v(-0.18, 1.04, 0.14), v(-0.3, 1.2, 0.26), v(-0.42, 1.3, 0.32)],
    [v(-0.04, 0.8, 0.0), v(-0.36, 0.99, 0.03), v(-0.72, 1.1, 0.04), v(-1.06, 1.2, 0.02)],
  ];
  const limbCurves: THREE.CatmullRomCurve3[] = [];
  LIMBS.forEach((pts, i) => {
    limbCurves.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
    add(
      root,
      barkTube(pts, {
        segs: i === 5 ? 30 : 20,
        radial: 12,
        rad: (u) => limbRad(u)[0] * (i === 0 ? 1.1 : i === 5 ? 1.02 : 1),
        furrows: 6,
        furrowW: 0.01,
        furrowD: 0.008,
        plate: 0.003,
        wob: 11,
        seed: 5 + i,
        paint: barkPaint(0.6),
      }),
      M.bark,
    );
  });

  // ── Canopy: seven foliage clusters stacked into a big umbrella leaning to the right: one high in the middle with an outer ring lower, and one more at the end of the long horizontal branch on the right ──
  const canopyG = group(root, [0, 1.12, 0]);
  const CLUMPS: [THREE.Vector3, [number, number, number], number, number][] = [
    [v(0.1, 1.56, -0.1), [0.62, 0.34, 0.56], 11, 0x4f813f],
    [v(0.7, 1.36, 0.16), [0.5, 0.3, 0.46], 12, 0x4a7b3c],
    [v(0.5, 1.42, -0.56), [0.5, 0.3, 0.44], 13, 0x436f39],
    [v(-0.5, 1.44, -0.36), [0.5, 0.3, 0.44], 14, 0x436f39],
    [v(-0.44, 1.36, 0.3), [0.46, 0.28, 0.42], 15, 0x4a7b3c],
    [v(0.14, 1.3, 0.44), [0.42, 0.26, 0.36], 16, 0x4d7e3d],
    [v(-0.98, 1.28, 0.02), [0.36, 0.24, 0.34], 17, 0x47773b],
  ];
  const clumps: { g: THREE.Group; ph: number }[] = [];
  CLUMPS.forEach(([c, r, seed, base], i) => {
    // The foliage cluster group is placed at the bottom of the cluster, so when swaying it turns about the bottom
    const bp = v(c.x, c.y - r[1] * 0.5, c.z).sub(canopyG.position);
    const g = group(canopyG, [bp.x, bp.y, bp.z]);
    const geo = clumpGeo(r[0], r[1], r[2], seed, {
      lobes: i === 0 ? 26 : 20,
      amp: 0.42,
      lw: [0.32, 0.5],
      teeth: i === 6 ? 12 : 14,
      rows: i === 6 ? 16 : 19,
      base,
      light: 0x8fb65a,
      dark: 0x264329,
      squash: 0.72,
      droop: 0.07,
    });
    const m = add(g, geo, M.leaf, [0, r[1] * 0.5, 0]);
    m.rotation.y = rand() * PI * 2;
    clumps.push({ g, ph: i * 1.7 });
  });
  /** A point inside a foliage cluster (the starting point for an aerial root hanging from under the canopy) */
  const clumpIn = (x: number, z: number) => {
    let best = 9;
    let y = 1.3;
    for (const [c, r] of CLUMPS) {
      const e = Math.hypot((x - c.x) / r[0], (z - c.z) / r[2]);
      if (e < best) {
        best = e;
        y = c.y - 0.04;
      }
    }
    return y;
  };

  // ── Curtain of aerial roots: the left, right and rear sets each sway like a pendulum; the right set hangs directly from the long horizontal branch; nothing blocks the front of the trunk ──
  const hangRad = curveTable([
    [0, 0],
    [0.05, 1],
    [0.5, 0.86],
    [1, 0.72],
  ]);
  // [start point, root tip height, thickness, two roots twisted together]
  type Hang = [THREE.Vector3, number, number, boolean];
  const arm = limbCurves[5];
  const HANG: Hang[][] = [
    // Left (+x)
    [
      [v(0.95, 0, 0.06), 0.22, 0.026, false],
      [v(0.84, 0, 0.4), 0.5, 0.022, false],
      [v(1.0, 0, -0.3), 0.34, 0.02, false],
      [v(0.72, 0, -0.1), 0.12, 0.019, true],
      [v(0.4, 0, 0.62), 0.74, 0.02, false],
    ],
    // Right (the long horizontal branch, -x)
    [
      [arm.getPointAt(0.46), 0.36, 0.024, false],
      [arm.getPointAt(0.6), 0.1, 0.026, false],
      [arm.getPointAt(0.71), 0.5, 0.02, false],
      [arm.getPointAt(0.8), 0.18, 0.019, true],
      [arm.getPointAt(0.52).add(v(0, 0, -0.04)), 0.7, 0.018, false],
    ],
    // Rear
    [
      [v(0.32, 0, -0.88), 0.2, 0.024, false],
      [v(0.76, 0, -0.66), 0.46, 0.02, false],
      [v(-0.1, 0, -0.74), 0.18, 0.019, true],
      [v(-0.52, 0, -0.68), 0.4, 0.022, false],
      [v(0.12, 0, -0.5), 0.72, 0.018, false],
      [v(-0.82, 0, -0.34), 0.28, 0.02, false],
    ],
  ];
  const curtains: { g: THREE.Group; ph: number; tips: THREE.Vector3[] }[] = [];
  HANG.forEach((set, si) => {
    const lines: { pts: THREE.Vector3[]; r: number }[] = [];
    set.forEach(([p, tipY, r, pair], k) => {
      const top = p.y > 0 ? p.y - 0.02 : clumpIn(p.x, p.z);
      const len = top - tipY;
      const jx = (hash3(si, k, 2) - 0.5) * 0.07;
      const jz = (hash3(si, k, 4) - 0.5) * 0.07;
      const line = (u: number) => v(p.x + jx * Math.sin(u * PI * 0.9), top - len * u, p.z + jz * Math.sin(u * PI * 0.9));
      if (!pair) lines.push({ pts: [0, 0.3, 0.65, 1].map(line), r });
      else
        // Two aerial roots growing down entwined around each other: two helical sections about the same midline
        for (const sgn of [1, -1]) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 9; i++) {
            const u = (i / 9) * (sgn > 0 ? 1 : 0.9);
            const a = u * len * 16 + (sgn > 0 ? 0 : PI);
            const w = 0.021 * sstep(u, 0.02, 0.15);
            pts.push(line(u).add(v(Math.cos(a) * w, 0, Math.sin(a) * w)));
          }
          lines.push({ pts, r });
        }
    });
    const piv = lines.reduce((a, b) => a.add(b.pts[0]), v(0, 0, 0)).multiplyScalar(1 / lines.length);
    const g = group(root, [piv.x, piv.y, piv.z]);
    const tips: THREE.Vector3[] = [];
    for (const { pts, r } of lines) {
      const geo = barkTube(pts, {
        segs: 16,
        radial: 7,
        rad: (u) => hangRad(u)[0] * r,
        endCap: r * 0.8,
        paint: (s) =>
          BARK.clone()
            .lerp(ROOT_MID, sstep(s.u, 0.3, 0.85) * 0.75)
            .lerp(ROOT_TIP, sstep(s.u, 0.9, 0.98)),
      });
      geo.translate(-piv.x, -piv.y, -piv.z);
      add(g, geo, M.bark);
      tips.push(pts[pts.length - 1].clone().sub(piv));
    }
    curtains.push({ g, ph: si * 2.1, tips });
  });

  // ── Prop roots: two aerial roots that have already rooted into the ground, twisted together like a braid, with three small roots spreading from the bottom ──
  const propRad = curveTable([
    [0, 0.05],
    [0.5, 0.055],
    [0.85, 0.064],
    [0.95, 0.082],
    [1, 0],
  ]);
  const armEnd = arm.getPointAt(0.93);
  const props: THREE.Vector3[][] = [
    [armEnd.clone().add(v(0, 0.03, 0)), v(armEnd.x - 0.02, 0.8, 0.03), v(-1.09, 0.4, 0.02), v(-1.11, 0.01, 0.02)],
    [limbCurves[2].getPointAt(0.8).add(v(0, 0.04, 0)), v(0.42, 0.92, -0.56), v(0.4, 0.46, -0.66), v(0.38, 0.01, -0.76)],
  ];
  const propCurves = props.map((pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  props.forEach((pts, i) => {
    add(
      root,
      barkTube(pts, {
        segs: 40,
        radial: 16,
        rad: (u) => propRad(u)[0],
        lobes: 4,
        lobeA: 0.22,
        twist: 1.8,
        seed: 2 + i,
        paint: (s) => barkPaint(0.5)(s).lerp(ROOT_MID, sstep(s.u, 0.0, 0.3) * (1 - sstep(s.u, 0.3, 0.6)) * 0.3),
      }),
      M.bark,
    );
    const foot = pts[3];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * PI * 2 + i;
      const dd = v(Math.sin(a), 0, Math.cos(a));
      const base = foot.clone().add(v(0, 0.1, 0));
      const tip = foot.clone().addScaledVector(dd, 0.13).setY(0.018);
      add(
        root,
        barkTube([base, base.clone().lerp(tip, 0.5).add(v(0, 0.02, 0)), tip], {
          segs: 9,
          radial: 7,
          rad: (u) => toeRad(u)[0] * 0.85,
          endCap: 0.02,
          paint: (s) => BARK.clone().lerp(ROOT_MID, s.u * 0.4),
        }),
        M.bark,
      );
    }
  });

  // ── Ground: directly below the lifted root toes, a puddle has already seeped out on the ground, ringed by wet moss (the place it is about to step on is already wet) ──
  const PUD = liftedTips.reduce((a, b) => a.add(b), v(0, 0, 0)).multiplyScalar(1 / liftedTips.length);
  PUD.multiplyScalar(0.95).setY(0);
  const PUD_ROT = -0.72;
  const PR: [number, number] = [0.21, 0.14];
  const pudLocal = (x: number, z: number) => {
    const dx = x - PUD.x;
    const dz = z - PUD.z;
    return [dx * Math.cos(-PUD_ROT) - dz * Math.sin(-PUD_ROT), dx * Math.sin(-PUD_ROT) + dz * Math.cos(-PUD_ROT)];
  };
  const pudField = (x: number, z: number) => {
    const [lx, lz] = pudLocal(x, z);
    return Math.hypot(lx / PR[0], lz / PR[1]);
  };
  const rimGeo = groundGeo(
    12,
    48,
    (th) => 1.6 + 0.18 * Math.sin(th * 3 + 1) + 0.1 * Math.sin(th * 7 + 2),
    (x, z, s) => {
      const e = pudField(x, z);
      const bump = vnoise(x * 14, 0, z * 14);
      const mound = 0.028 * Math.exp(-(((e - 1.18) / 0.26) ** 2)) * (0.6 + 0.4 * bump);
      return 0.003 + mound * sstep(1 - s, 0, 0.3) + 0.003 * sstep(1 - s, 0, 0.2);
    },
    (x, z, y) => {
      const e = pudField(x, z);
      const n = vnoise(x * 12, 2, z * 12);
      return WET.clone()
        .lerp(MOSS, sstep(e, 1.0, 1.25) * 0.7)
        .lerp(MOSS_HI, sstep(y, 0.022, 0.03) * n * 0.5)
        .lerp(SOIL, sstep(e, 1.3, 1.65) * 0.7);
    },
    PUD.x,
    PUD.z,
    PUD_ROT,
    PR[0],
    PR[1],
  );
  add(root, rimGeo, M.moss);
  // Water surface: a little higher than the bottom of the footprint, with the edge hidden in the slope of the moss; one slanting reflection of the sky
  const SKY = col(0xc4e8f0);
  const DEEP = col(0x357f98);
  const waterGeo = groundGeo(
    5,
    36,
    () => 1.1,
    () => 0.014,
    (x, z) => {
      const e = pudField(x, z);
      const [lx, lz] = pudLocal(x, z);
      const streak = Math.exp(-((((lx / PR[0]) * 0.8 + (lz / PR[1]) * 0.6 + 0.2) / 0.3) ** 2));
      return DEEP.clone().lerp(col(0x6cb6ca), 1 - sstep(e, 0.3, 1.0)).lerp(SKY, streak * 0.75);
    },
    PUD.x,
    PUD.z,
    PUD_ROT,
    PR[0],
    PR[1],
  );
  add(root, waterGeo, M.water);

  // ── Back: the straw rope and rain-prayer cloth strips on the prop root, and the clay bowl between the two clusters of hind feet ──
  const ropeU = 0.32;
  const rc = propCurves[1];
  const ropeP = rc.getPointAt(ropeU);
  const ropeT = rc.getTangentAt(ropeU);
  const ropeR = propRad(ropeU)[0] + 0.012;
  const ropeG = group(root, [ropeP.x, ropeP.y, ropeP.z]);
  ropeG.quaternion.setFromUnitVectors(v(0, 0, 1), ropeT);
  add(ropeG, new THREE.TorusGeometry(ropeR, 0.018, 8, 40), M.rope);
  // Rope knot: facing the left rear
  const out = v(0.55, 0, -1).normalize();
  const knotP = ropeP.clone().addScaledVector(out, ropeR + 0.012);
  add(root, new THREE.SphereGeometry(0.026, 10, 8), M.rope, [knotP.x, knotP.y, knotP.z]);
  const stripsG = group(root, [knotP.x, knotP.y, knotP.z]);
  const CLOTH = [0xb54a40, 0xe4d8bc, 0x3f5a8c, 0xcf9a3e, 0x9fb07a];
  const stripRad = (u: number) => 0.03 * Math.min(1, u / 0.03, (1 - u) / 0.03);
  const tangent = v(-out.z, 0, out.x);
  for (let k = 0; k < 5; k++) {
    const a = (k - 2) * 0.55;
    const dir = out.clone().multiplyScalar(Math.cos(a)).addScaledVector(tangent, Math.sin(a));
    const top = dir
      .clone()
      .multiplyScalar(ropeR * 0.6 + 0.004)
      .add(v(0, -0.015, 0))
      .sub(out.clone().multiplyScalar(ropeR + 0.012));
    const len = 0.22 + 0.1 * hash3(k, 3, 1);
    const pts = [
      top,
      top.clone().add(v(0, -len * 0.4, 0)).addScaledVector(dir, 0.022),
      top
        .clone()
        .add(v(0, -len * 0.75, 0))
        .addScaledVector(dir, 0.03)
        .addScaledVector(tangent, (k - 2) * 0.012),
      top
        .clone()
        .add(v(0, -len, 0))
        .addScaledVector(dir, 0.022)
        .addScaledVector(tangent, (k - 2) * 0.02),
    ];
    const side = v(-dir.z, 0, dir.x);
    const cc = col(CLOTH[k]);
    add(
      stripsG,
      barkTube(pts, {
        segs: 12,
        radial: 8,
        rad: stripRad,
        side,
        ell: () => [0.22, 1],
        paint: (s) => cc.clone().multiplyScalar(lerp(1, 0.8, s.u)),
      }),
      M.cloth,
    );
  }
  // Clay bowl and the water in the bowl
  const BOWL = v(-0.03, 0.0, -0.62);
  const bowlGeo = lathe(
    [
      [0.001, 0],
      [0.045, 0.002],
      [0.066, 0.02],
      [0.074, 0.044],
      [0.07, 0.05],
      [0.062, 0.046],
      [0.056, 0.03],
      [0.03, 0.016],
      [0.001, 0.014],
    ],
    20,
  );
  add(root, bowlGeo, M.clay, [BOWL.x, BOWL.y, BOWL.z]);
  add(root, new THREE.CircleGeometry(0.058, 20).rotateX(-PI / 2), M.drop, [BOWL.x, BOWL.y + 0.038, BOWL.z]);

  // ── A small pool of glowing water collected at the bottom of the tree hollow (the only emissive on the whole body) ──
  const holeDir = v(Math.sin(HOLE_PHI), 0, Math.cos(HOLE_PHI));
  const HEART = holeDir.clone().multiplyScalar(0.15).setY(HOLE_Y - HOLE_H * 0.6);
  const heartG = group(root, [HEART.x, HEART.y, HEART.z]);
  const heart = add(heartG, new THREE.SphereGeometry(0.06, 16, 8), M.heart);
  heart.scale.set(1, 0.32, 0.8);
  heart.rotation.y = HOLE_PHI;

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const mouthP = holeDir.clone().multiplyScalar(0.26).setY(HOLE_Y);
  const lTip = curtains[0].tips[0];
  const rTip = curtains[1].tips[1];
  const rig = {
    head: group(root, [0, 0.96, 0.27]),
    eyes: [] as THREE.Group[],
    anchors: {
      mouth: group(root, [mouthP.x, mouthP.y, mouthP.z]),
      glow: heartG,
      canopy: group(canopyG, [0.1, 1.94 - canopyG.position.y, -0.1]),
      foot: group(liftG, [footTips[1].x, footTips[1].y, footTips[1].z]),
      puddle: group(root, [PUD.x, 0.02, PUD.z]),
      rootsL: group(curtains[0].g, [lTip.x, lTip.y, lTip.z]),
      rootsR: group(curtains[1].g, [rTip.x, rTip.y, rTip.z]),
      strips: group(root, [knotP.x, knotP.y, knotP.z]),
      trunk: group(root, [0, 0.62, 0]),
    },
  };
  const act = { glow: 0, rustle: 0, lash: 0, step: 0 };

  mergeStatic(root, {
    owners: [liftG, canopyG, stripsG, ...clumps.map((c) => c.g), ...curtains.map((c) => c.g)],
    keep: [heart],
    rig,
  });

  // ── Idle: barely moves; the canopy slowly rising and falling, the curtain of aerial roots swaying lightly, the lifted root foot hanging and now and then probing down ──
  let lastGlow = -1;
  const liftQ = new THREE.Quaternion();
  const update = (t: number) => {
    const ru = act.rustle;
    canopyG.scale.set(1, 1 + Math.sin(t * 0.5) * 0.008, 1);
    for (const c of clumps) {
      const sh = ru * Math.sin(t * 23 + c.ph * 3) * 0.035;
      c.g.rotation.set(Math.sin(t * 0.55 + c.ph) * 0.016 + sh, 0, Math.sin(t * 0.43 + c.ph * 1.3) * 0.02 - sh * 0.7);
    }
    for (const c of curtains) {
      const sw = Math.sin(t * 0.9 + c.ph);
      c.g.rotation.set(Math.sin(t * 0.7 + c.ph * 0.7) * 0.026 - act.lash * 0.5 + act.glow * 0.04, 0, sw * 0.028 + ru * Math.sin(t * 17 + c.ph) * 0.03);
    }
    // The lifted root foot: probes down a little every 9 seconds and then draws back; step lands it
    const ph = (t % 9) / 9;
    const probe = ph > 0.55 && ph < 0.85 ? Math.sin(((ph - 0.55) / 0.3) * PI) * 0.035 : 0;
    liftQ.setFromAxisAngle(LIFT_AX, -(LIFT - probe) * (1 - act.step));
    liftG.quaternion.copy(liftQ);
    liftG.position.y = LIFT_PIVOT.y + (LIFT_UP - probe * 0.6) * (1 - act.step);
    stripsG.rotation.set(Math.sin(t * 1.3) * 0.06, 0, Math.sin(t * 1.7 + 1) * 0.08);
    heart.scale.set(1, 0.32, 0.8).multiplyScalar(1 + Math.sin(t * 0.8) * 0.04 + act.glow * 0.2);
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.heart.emissiveIntensity = 0.9 + act.glow * 1.3;
    }
  };
  update(0);

  return { root, update, center: new THREE.Vector3(0, 0.98, 0), radius: 1.42, rig, act };
}
