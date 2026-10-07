// Magma Golem (model lab version, SR, fire + earth): a guardian cast by the dwarves of the Kingdom Era from volcanic rock and source crystal; its master is long gone, yet it still guards the furnace.
// Identifying features: 1. A top-heavy block-of-rock build: a barrel-shaped chest pressed down on two short thick legs, two forearms thicker than the legs hanging down to the front of the knees, and huge fists wrapped in iron knuckles forged by the dwarves;
// 2. The two shoulders are two chiseled big rock blocks, higher than the head, with the head sunk between the shoulders and a low ridge of rock behind it blocking the view; a cluster of three amber source crystals grows from the top of the left shoulder;
//    the legs are two stacked sections of pentagonal basalt columns (the columns volcanic rock splits into as it cools), and the knees are a ring of black rock crust;
// 3. A cut source crystal (the Fire Heart) at the exact center of the chest, set in a dwarf-made iron seat with three red-copper pattern studs on the seat (corresponding to the three forge patterns of the moves: flame, edge and heavy);
//    the rock blocks of the chest split into three pieces outward from the source crystal with lava showing in the seams, and the elbow joints are lava too; between the other rock blocks is cooled black rock crust.
// 4. Four material layers: volcanic rock blocks (dark gray-brown, with a layer of furnace ash on the upward faces), lava seams (only the chest, the elbows and the crack on the back glow), source crystal facets, and the dwarf-forged iron parts and red copper.
// Not anthropomorphized (spirit-model-polish <Do not anthropomorphize>): no face. The head is two stacked rocks: a brow stone jutting forward on top and a jaw stone pushing forward below,
// with a deep slit between them, and at the bottom of the slit only a point of furnace fire (like a furnace's fire-viewing port); that point of light sliding left and right in the slit is its gaze; no eyeballs, sclera or mouth are made.
// Kept distinct from Monolith Colossus (a pale cream upright boulder), Forgeheart (a four-legged beast with a furnace on its back), Astragate (a pale stone lion) and Gatewarden (blue-gray, crouching, with bat wings):
// dark volcanic rock, a giant build wide on top and narrow below, a head sunk between the shoulders, the source crystal cluster on the left shoulder, the source crystal and lava cracks on the chest, iron knuckles and pentagonal-column legs.
// Personality: a stubborn, silent old furnace guard. Its master left hundreds of years ago, and it still stands in front of the furnace mouth and refuses to leave, giving a look to anyone who comes near; personality comes from the forward-leaning stance, the huge fists hanging in front of the knees and the flicker of the lava, not from expression.
// Gaze order: the head (the point of fire in the slit under the brow stone) and the source crystal on the chest directly below first, the big rock blocks of the two shoulders and the source crystal cluster on the left shoulder second, and the iron knuckles of the huge fists and the lava elbows as support.
// Back: an old crack from the right shoulder to the waist, which the master cramped together with three iron cramps, lava still showing in the seam; the left half of the back has the forge hammer the master left, fastened with two iron rings;
// on top of the back is a red-copper anvil mark (the master's family forging stamp).
// Action table: idle is very slow, heavy breathing with the lava flickering along; the fire in the slit looks left and right, and every so often the head tilts to the left rear, as if turning back to confirm the furnace behind is still there;
// move is a very heavy step; charge-up act.glow brightens the lava and source crystal on the chest and in the cracks; strike pounds down with the huge fists (Forge Fist, anchors fistL / fistR) or blasts a heat wave from the chest (Out of the Furnace, anchor heart);
// hit does not retreat, and only sinks the head down and shrinks the fire in the slit to a line; victory puts both fists back in front of the body and glances back at the furnace behind.
// act: glow brightens the lava and source crystal; wake brightens the fire in the slit and raises the head; flame / edge / heavy light the three pattern studs on the chest's iron seat individually (flame pattern, edge pattern, heavy pattern, the forge-pattern states in battle).
// Anchors: head (center of the face, directly in front of the slit), eyes (the point of fire at the bottom of the slit), anchors.mouth and heart (the surface of the chest source crystal, where the Out of the Furnace heat wave comes out),
// fistL / fistR (the fist faces, L is its own left +x), crystal (tip of the left shoulder's source crystal), hammer (the head of the forge hammer on the back), crack (center of the crack on the back), anvil (the anvil mark on top of the back).
// Restrained light effects: the emissive is only the source crystal on the chest and the three cracks, the two elbows, the crack on the back and the point of fire at the bottom of the slit; the left shoulder's source crystal only transmits a faint glow; no bloom.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { brilliant, lathe, mergeStatic, outline, partKit, PI, rbox, rng, slab, frameShape, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
type P2 = [number, number];

// ───────────────────────── Geometry helpers ─────────────────────────

/** Convex hull of a point cloud: every face is flat (no shared vertices), used for rock blocks, rock columns and crystals, so the shading of the facets is clean patch by patch */
function hull(pts: THREE.Vector3[]): THREE.BufferGeometry {
  return new ConvexGeometry(pts);
}

interface HewnOpts {
  /** Edge bevel (about 45 degrees, a bright band in toon shading, with no outline drawn) */
  b?: number;
  /** The x and z scale of the top face and bottom face (narrowing upward, narrowing downward) */
  top?: P2;
  bot?: P2;
  /** Displacement of the top face relative to the bottom face (x, z) */
  skew?: P2;
  /** Random displacement of each corner's points, as if hand-chiseled */
  jit?: number;
  /** Probability that some corners have a big chunk knocked off */
  chip?: number;
  seed?: number;
}

/** A hand-chiseled rock block: a cuboid with every edge beveled, each corner's bevel a different size, and occasionally one corner with a big chunk knocked off */
function hewn(w: number, h: number, d: number, o: HewnOpts = {}): THREE.BufferGeometry {
  const r = rng(o.seed ?? 7);
  const b0 = o.b ?? Math.min(w, h, d) * 0.16;
  const top = o.top ?? [1, 1];
  const bot = o.bot ?? [1, 1];
  const skew = o.skew ?? [0, 0];
  const jit = o.jit ?? b0 * 0.35;
  const pts: THREE.Vector3[] = [];
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const put = (x: number, y: number, z: number) => {
    const t = (y + hy) / h;
    const sx = lerp(bot[0], top[0], t);
    const sz = lerp(bot[1], top[1], t);
    pts.push(v(x * sx + skew[0] * t + (r() - 0.5) * jit, y + (r() - 0.5) * jit, z * sz + skew[1] * t + (r() - 0.5) * jit));
  };
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const big = r() < (o.chip ?? 0.15);
        const bx = Math.min(hx * 0.8, b0 * (big ? 2.4 : 0.6 + 0.8 * r()));
        const by = Math.min(hy * 0.8, b0 * (big ? 2.4 : 0.6 + 0.8 * r()));
        const bz = Math.min(hz * 0.8, b0 * (big ? 2.4 : 0.6 + 0.8 * r()));
        put(sx * hx, sy * (hy - by), sz * (hz - bz));
        put(sx * (hx - bx), sy * hy, sz * (hz - bz));
        put(sx * (hx - bx), sy * (hy - by), sz * hz);
      }
  return hull(pts);
}

/**
 * A rounder big stone (shoulder): Fibonacci points on an ellipsoid plus a little randomness, taking the convex hull, with chisel marks face by face.
 * cuts are the chiseled-flat faces [normal x, y, z, distance from center] (in the ellipsoid's units); points that go beyond are pressed back to that plane, so the hull shows one whole flat facet
 */
function boulder(rx: number, ry: number, rz: number, n: number, seed: number, cuts: [number, number, number, number][] = []): THREE.BufferGeometry {
  const r = rng(seed);
  const pts: THREE.Vector3[] = [];
  const ga = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rad = Math.sqrt(1 - y * y);
    const a = i * ga;
    const k = 0.93 + 0.1 * r();
    const p = v(Math.cos(a) * rad * k, y * k, Math.sin(a) * rad * k);
    for (const [nx, ny, nz, d] of cuts) {
      const nn = v(nx, ny, nz).normalize();
      const over = p.dot(nn) - d;
      if (over > 0) p.addScaledVector(nn, -over);
    }
    pts.push(p.multiply(v(rx, ry, rz)));
  }
  return hull(pts);
}

/** One pentagonal column section (leg): a ring of bevel at both the top and bottom ends, with a flat plane directly at the front */
function drum(r: number, h: number, seed: number): THREE.BufferGeometry {
  const rand = rng(seed);
  const b = Math.min(0.022, r * 0.2);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a = PI * 0.3 + (i / 5) * PI * 2 + (rand() - 0.5) * 0.1;
    const rr = r * (0.94 + 0.12 * rand());
    const x = Math.cos(a);
    const z = Math.sin(a);
    pts.push(v(x * (rr - b), 0, z * (rr - b)), v(x * rr, b, z * rr), v(x * rr, h - b, z * rr), v(x * (rr - b), h, z * (rr - b)));
  }
  return hull(pts);
}

/** Hexagonal source crystal: the shaft slightly thicker going up, and the top closing into a slightly off-center point */
function crystal(r: number, h: number, seed: number): THREE.BufferGeometry {
  const rand = rng(seed);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + (rand() - 0.5) * 0.12;
    pts.push(v(Math.cos(a) * r * 0.82, -0.05, Math.sin(a) * r * 0.82), v(Math.cos(a) * r, h * 0.7, Math.sin(a) * r));
  }
  pts.push(v(r * 0.15, h, -r * 0.1));
  return hull(pts);
}

/** Each edge of a convex polygon inset by d (it can differ per edge) */
function insetPoly(poly: P2[], d: number | number[]): P2[] {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const s = area > 0 ? 1 : -1;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const ux = dx / L;
    const uy = dy / L;
    const di = Array.isArray(d) ? d[i] : d;
    return { px: a[0] - s * uy * di, py: a[1] + s * ux * di, ux, uy };
  });
  return poly.map((_, i) => {
    const A = lines[(i - 1 + n) % n];
    const B = lines[i];
    const den = A.ux * B.uy - A.uy * B.ux;
    if (Math.abs(den) < 1e-6) return [B.px, B.py] as P2;
    const t = ((B.px - A.px) * B.uy - (B.py - A.py) * B.ux) / den;
    return [A.px + A.ux * t, A.py + A.uy * t] as P2;
  });
}

/**
 * A thick rock slab cut from a bulging curved surface: poly is the outline seen from the front (a convex polygon), insets is the amount each edge is pulled in (more on the crack side),
 * zIn is the face buried in the body, and zOut(x, y) is the outer surface (the chest bulging forward, the back bulging backward), with a ring of bevel around the outer edge
 */
function shard(poly: P2[], insets: number[], zIn: number, zOut: (x: number, y: number) => number, bevel: number): THREE.BufferGeometry {
  const P = insetPoly(poly, insets);
  const F = insetPoly(P, bevel);
  const dir = Math.sign(zOut(0, 0) - zIn);
  const pts: THREE.Vector3[] = [];
  const ring = (Q: P2[], f: (x: number, y: number) => number) => {
    for (let i = 0; i < Q.length; i++) {
      const a = Q[i];
      const b = Q[(i + 1) % Q.length];
      for (let k = 0; k < 3; k++) {
        const x = lerp(a[0], b[0], k / 3);
        const y = lerp(a[1], b[1], k / 3);
        pts.push(v(x, y, f(x, y)));
      }
    }
  };
  ring(P, () => zIn);
  ring(P, (x, y) => zOut(x, y) - dir * bevel);
  ring(F, zOut);
  const cx = F.reduce((s, p) => s + p[0], 0) / F.length;
  const cy = F.reduce((s, p) => s + p[1], 0) / F.length;
  pts.push(v(cx, cy, zOut(cx, cy)));
  for (const p of F) {
    const x = (p[0] + cx) / 2;
    const y = (p[1] + cy) / 2;
    pts.push(v(x, y, zOut(x, y)));
  }
  return hull(pts);
}

/** Make the object's y axis point along yDir and its z axis face zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// ───────────────────────── Shape ─────────────────────────

export function buildMagmaGolemLab(): LabModel {
  const RIMC = 0xffc9a2;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const rockOpts = { speckle: 0.16, rim: 0.55, rimColor: RIMC };
  const metalOpts = { ramp: 'metal' as const, spec: 0.55, specTh: 0.965, rim: 0.45, rimColor: RIMC };
  const M = {
    // Volcanic rock: vertex colors (upward faces with furnace ash, and burnt red-brown near the lava)
    rock: vc(labToon(0xffffff, rockOpts)),
    // The cooled black rock crust between rock blocks (mortar), with the same parameters as the rock and differing only in base color, changed to vertex colors when merged
    crust: labToon(0x2a2123, rockOpts),
    lava: labToon(0xff7c26, { ramp: 'gem', emissive: 0xff4a10, emissiveAmt: 0.8, rim: 0 }),
    gem: labToon(0xffbf45, { ramp: 'gem', emissive: 0xff9016, emissiveAmt: 0.45, rim: 0.3, rimColor: 0xfff0c8, spec: 0.8, specTh: 0.975 }),
    iron: labToon(0x535d69, metalOpts),
    copper: labToon(0xbf6f3a, metalOpts),
    metal: vc(labToon(0xffffff, metalOpts)),
    wood: labToon(0x6f4a2f, { rim: 0.35, rimColor: RIMC }),
    leather: labToon(0x3f2a20, { rim: 0.35, rimColor: RIMC }),
    woodV: vc(labToon(0xffffff, { rim: 0.35, rimColor: RIMC })),
    ember: labToon(0xffd27c, { ramp: 'gem', emissive: 0xff8a22, emissiveAmt: 1.0, rim: 0 }),
    runeFlame: labToon(0xbf6f3a, { ...metalOpts, emissive: 0xff5a14, emissiveAmt: 0 }),
    runeEdge: labToon(0xbf6f3a, { ...metalOpts, emissive: 0xffd24a, emissiveAmt: 0 }),
    runeHeavy: labToon(0xbf6f3a, { ...metalOpts, emissive: 0xff8a2a, emissiveAmt: 0 }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'magma_golem-lab';
  const { add, group, rivet } = partKit();
  /** The overall darkness of one stone (one value per rock), multiplied in when coloring */
  const tone = new Map<THREE.Mesh, number>();
  const toneR = rng(97);
  const rock = (parent: THREE.Object3D, geo: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0]) => {
    const m = add(parent, geo, M.rock, pos, rot);
    tone.set(m, 0.9 + 0.2 * toneR());
    return m;
  };

  // ── Legs and pelvis: hung under root, standing firmly on the ground. Short and thick, with the feet planted wide apart ──
  rock(root, hewn(0.56, 0.2, 0.42, { bot: [0.84, 0.84], seed: 11 }), [0, 0.56, -0.05]);
  for (const sx of [-1, 1]) {
    const s = sx > 0 ? 0 : 50;
    // Legs of two stacked pentagonal column sections (like stacked basalt columns), with the knee a black seam
    rock(root, drum(0.12, 0.17, 12 + s), [sx * 0.245, 0.31, -0.02], [0, 0, sx * 0.06]);
    add(root, new THREE.SphereGeometry(0.085, 12, 9), M.crust, [sx * 0.25, 0.3, -0.01]);
    rock(root, drum(0.135, 0.19, 13 + s), [sx * 0.262, 0.1, 0.0]);
    rock(root, hewn(0.29, 0.12, 0.35, { top: [0.86, 0.8], seed: 14 + s, chip: 0.05 }), [sx * 0.27, 0.06, 0.04]);
    for (const t of [-1, 1]) rock(root, hewn(0.115, 0.085, 0.11, { top: [0.85, 0.8], seed: 15 + s + t }), [sx * 0.27 + t * 0.07, 0.043, 0.24], [0, t * 0.1, 0]);
  }

  // ── Torso: leaning forward about the waist, handling the breathing. A barrel-shaped chest: a core of black rock crust, wrapped in a ring of thick rock blocks ──
  const LEAN = 0.24;
  const torso = group(root, [0, 0.6, -0.05], [LEAN, 0, 0]);
  // The top of the core is pressed under the raised stone behind the head, and does not show a ring of black behind the top of the head (it would look like a hood)
  add(torso, new THREE.SphereGeometry(1, 22, 16), M.crust, [0, 0.37, -0.03]).scale.set(0.35, 0.33, 0.27);
  // Lava core: behind the chest crack
  add(torso, new THREE.SphereGeometry(1, 22, 16), M.lava, [0, 0.38, 0.1]).scale.set(0.22, 0.18, 0.2);

  /** One run of lava: a cone from a to b (thick at the a end and thin at the b end), buried under the crack */
  const lavaVein = (a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number) => {
    const g = group(torso, a.clone().add(b).multiplyScalar(0.5).toArray() as V3);
    orient(g, a.clone().sub(b), v(0, 0, 1));
    add(g, new THREE.CylinderGeometry(ra, rb, a.distanceTo(b), 8, 1), M.lava);
  };

  // Three rocks on the chest: splitting outward from the source crystal, with lava showing at the bottom of the seams
  const H: P2 = [0.02, 0.4];
  const zChest = (x: number, y: number) => 0.25 + 0.11 * Math.max(0, 1 - (x / 0.44) ** 2 - ((y - 0.38) / 0.38) ** 2);
  const CR = 0.017;
  const ED = 0.01;
  const cracks: P2[] = [[-0.26, 0.6], [0.05, 0.2], [0.36, 0.52]];
  const chest = [
    { poly: [H, cracks[2], [0.3, 0.6], cracks[0]] as P2[], ins: [CR, ED, ED, CR] },
    { poly: [H, cracks[0], [-0.36, 0.42], [-0.3, 0.2], cracks[1]] as P2[], ins: [CR, ED, ED, ED, CR] },
    { poly: [H, cracks[1], [0.3, 0.2], [0.37, 0.4], cracks[2]] as P2[], ins: [CR, ED, ED, ED, CR] },
  ];
  for (const c of chest) rock(torso, shard(c.poly, c.ins, 0.1, zChest, 0.024), [0, 0, 0]);
  for (const e of cracks) lavaVein(v(H[0], H[1], zChest(H[0], H[1]) - 0.036), v(e[0], e[1], zChest(e[0], e[1]) - 0.03), 0.024, 0.011);
  // Belly: a rock below the chest tapering downward
  rock(torso, hewn(0.6, 0.18, 0.4, { bot: [0.86, 0.86], seed: 21 }), [0, 0.1, 0.06]);
  // Flanks: under the arms
  for (const sx of [-1, 1]) rock(torso, hewn(0.14, 0.46, 0.36, { top: [1, 0.9], seed: 22 + sx }), [sx * 0.36, 0.38, -0.04]);

  // Back: four rocks bulging backward, with a black seam between the upper and lower layers; an old crack runs slantwise from the right shoulder to the waist, kinking once along the way, with lava showing at the bottom of the seam
  const zBack = (x: number, y: number) => -0.3 - 0.09 * Math.max(0, 1 - (x / 0.44) ** 2 - ((y - 0.36) / 0.36) ** 2);
  const K1: P2 = [-0.4, 0.56];
  const Km: P2 = [-0.28, 0.3];
  const K2: P2 = [-0.02, 0.06];
  const CR1 = 0.013;
  const CR2 = 0.009;
  const backPieces: { poly: P2[]; ins: number[] }[] = [
    { poly: [K1, [-0.36, 0.62], [0.36, 0.62], [0.4, 0.33], Km], ins: [ED, ED, ED, ED, CR1] },
    { poly: [Km, [0.4, 0.31], [0.34, 0.05], K2], ins: [ED, ED, ED, CR2] },
    { poly: [K1, Km, [-0.41, 0.3]], ins: [CR1, ED, ED] },
    { poly: [Km, K2, [-0.36, 0.05], [-0.41, 0.28]], ins: [CR2, ED, ED, ED] },
  ];
  for (const b of backPieces) rock(torso, shard(b.poly, b.ins, -0.1, zBack, 0.024), [0, 0, 0]);
  const onBack = (p: P2, off: number) => v(p[0], p[1], zBack(p[0], p[1]) + off);
  lavaVein(onBack(K1, 0.07), onBack(Km, 0.07), 0.016, 0.015);
  lavaVein(onBack(Km, 0.07), onBack(K2, 0.065), 0.015, 0.009);
  const crackMid = onBack(Km, 0);
  // Three iron cramps across the crack: a flat bar of iron with both ends nailed into the stone, each with a red-copper rivet
  for (const [A, B, t] of [[K1, Km, 0.3], [K1, Km, 0.78], [Km, K2, 0.5]] as [P2, P2, number][]) {
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const x = A[0] + dx * t;
    const y = A[1] + dy * t;
    // First turn half a turn so +z faces outward (the back), then turn within the back plane to be perpendicular to the crack
    const g = group(torso, [x, y, zBack(x, y) - 0.008]);
    g.rotation.order = 'ZYX';
    g.rotation.set(0, PI, Math.atan2(dy, dx) + PI / 2);
    add(g, rbox(0.13, 0.03, 0.022, 0.008, 2), M.iron, [0, 0, 0]);
    for (const e of [-1, 1]) {
      add(g, rbox(0.028, 0.03, 0.04, 0.006, 1), M.iron, [e * 0.058, 0, -0.018]);
      rivet(g, M.copper, [e * 0.045, 0, 0.011], [0, 0, 1], 0.011);
    }
  }
  // Top of the back: the master's family anvil mark (a red-copper plate set in an iron plaque)
  const anvilG = group(torso, [-0.04, 0.51, zBack(-0.04, 0.51) - 0.006], [0, PI, 0]);
  {
    const sh = outline([[-0.06, 0.02], [0.05, 0.02], [0.065, 0.034], [0.03, 0.034], [0.018, 0.05], [0.018, 0.064], [0.034, 0.075], [0.034, 0.083], [-0.05, 0.083], [-0.05, 0.075], [-0.028, 0.064], [-0.028, 0.05], [-0.04, 0.034], [-0.07, 0.034]]);
    const g = slab(sh, 0.008, 0.003, 4);
    g.translate(0, -0.052, 0);
    add(anvilG, g, M.copper, [0, 0, 0]);
    add(anvilG, rbox(0.17, 0.11, 0.012, 0.005, 1), M.iron, [0, -0.002, -0.006]);
    for (const [x, y] of [[-0.07, 0.04], [0.07, 0.04], [-0.07, -0.042], [0.07, -0.042]] as P2[]) rivet(anvilG, M.copper, [x, y, 0.001], [0, 0, 1], 0.009);
  }
  // Left half of the back: the forge hammer the master left, with its handle passing through two iron rings fastened on the back
  const hammerHead = new THREE.Group();
  {
    const a = onBack([0.22, 0.57], -0.04);
    const b = onBack([0.13, 0.13], -0.035);
    const L = a.distanceTo(b);
    const hg = group(torso, a.clone().add(b).multiplyScalar(0.5).toArray() as V3);
    orient(hg, a.clone().sub(b), v(0, 0, -1));
    add(hg, new THREE.CylinderGeometry(0.019, 0.022, L, 10, 1), M.wood);
    add(hg, new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10, 1), M.leather, [0, -L * 0.28, 0]);
    add(hg, lathe([[0.001, -0.012], [0.026, -0.012], [0.028, 0.0], [0.024, 0.01], [0.001, 0.01]], 10), M.iron, [0, -L / 2, 0]);
    // Hammer head: lying across the top of the handle, with one end flat and one end narrowed
    const head = group(hg, [0, L / 2 + 0.02, 0]);
    head.add(hammerHead);
    add(head, rbox(0.19, 0.085, 0.085, 0.014, 2), M.iron, [0, 0, 0]);
    add(head, rbox(0.03, 0.1, 0.1, 0.01, 2), M.iron, [0.1, 0, 0]);
    add(head, rbox(0.05, 0.05, 0.1, 0.012, 2), M.iron, [0, 0, 0.0]);
    for (const t of [-0.22, 0.2]) {
      const rg = group(hg, [0, t * L, 0.012], [PI / 2, 0, 0]);
      add(rg, slab(frameShape(0.075, 0.07, 0.046, 0.044, 0.012), 0.022, 0.004, 4), M.iron);
    }
  }

  // The raised stone behind the head (the head sinks between the two shoulders), the shoulder-neck stones on both sides of the head, and the big round stones of the two shoulders
  rock(torso, boulder(0.27, 0.12, 0.2, 30, 31), [0, 0.6, -0.12]);
  for (const sx of [-1, 1]) rock(torso, hewn(0.15, 0.13, 0.26, { top: [0.8, 0.85], seed: 32 + sx }), [sx * 0.26, 0.575, 0.06], [0, 0, -sx * 0.3]);
  // The top face and outer side of the shoulder are each chiseled flat with one cut (the top face facing up and slightly outward, collecting furnace ash), so it is not a round ball
  for (const sx of [-1, 1]) rock(torso, boulder(0.215, 0.195, 0.23, 40, 40 + sx, [[sx * 0.35, 1, -0.1, 0.68], [sx, -0.15, 0, 0.84], [0, 0.3, 1, 0.86]]), [sx * 0.45, 0.67, -0.04]);
  // The left shoulder's stone splits open, and a cluster of source crystals (large, medium and small) grows out, outward, upward and slightly forward
  const crystalTip = new THREE.Group();
  {
    const cg = group(torso, [0.5, 0.8, 0.04]);
    orient(cg, v(0.55, 1, 0.3), v(0, 0, 1));
    const g1 = group(cg, [0, 0, 0], [0.12, 0, -0.08]);
    add(g1, crystal(0.052, 0.3, 81), M.gem);
    g1.add(crystalTip);
    crystalTip.position.set(0.008, 0.3, -0.005);
    const g2 = group(cg, [0.07, -0.03, 0.05], [0.45, 0, -0.55]);
    add(g2, crystal(0.038, 0.19, 82), M.gem);
    const g3 = group(cg, [-0.07, -0.02, 0.04], [0.5, 0, 0.35]);
    add(g3, crystal(0.03, 0.13, 83), M.gem);
  }

  // ── The Fire Heart on the chest: a cut source crystal set in a dwarf-made iron seat, with three red-copper pattern studs on the seat ──
  const heartZ = zChest(H[0], H[1]);
  const heartG = group(torso, [H[0], H[1], heartZ - 0.012], [PI / 2, 0, 0]);
  // Iron seat: a thick lathe ring with the outer edge drawing back; after turning 90 degrees about x, +y faces forward
  add(heartG, lathe([[0.058, -0.03], [0.1, -0.03], [0.104, 0.005], [0.094, 0.028], [0.07, 0.03], [0.062, 0.018], [0.058, 0.0], [0.058, -0.03]], 30), M.iron);
  add(heartG, brilliant(0.066, 0.034, 0.05, 8), M.gem, [0, 0.012, 0]);
  const runes = [M.runeFlame, M.runeEdge, M.runeHeavy];
  const runeMeshes: THREE.Mesh[] = [];
  [PI / 2, (PI * 7) / 6, (PI * 11) / 6].forEach((a, i) => {
    const m = add(heartG, new THREE.CylinderGeometry(0.016, 0.019, 0.014, 10, 1), runes[i], [Math.cos(a) * 0.083, 0.03, -Math.sin(a) * 0.083]);
    runeMeshes.push(m);
  });
  const heartAnchor = group(heartG, [0, 0.06, 0]);

  // ── Head: two stacked rocks, the brow stone pressing forward and the jaw stone pushing forward, with a deep slit between them and a point of furnace fire at the bottom of the slit ──
  const headBase = group(torso, [0, 0.745, 0.22], [-0.22, 0, 0]);
  const headG = group(headBase);
  const SOCKET = 7811;
  const socket = add(headG, hewn(0.24, 0.16, 0.2, { seed: 91, chip: 0 }), M.crust, [0, -0.015, -0.04]);
  socket.userData.inkGroup = SOCKET;
  rock(headG, hewn(0.34, 0.14, 0.3, { top: [0.72, 0.56], skew: [0, -0.05], b: 0.045, seed: 92, chip: 0.25 }), [0, 0.078, -0.005], [0.06, 0, 0.04]);
  rock(headG, hewn(0.3, 0.12, 0.28, { bot: [0.8, 0.85], b: 0.03, seed: 93, chip: 0.2 }), [0, -0.105, 0.025], [0, 0, -0.03]);
  // The point of fire at the bottom of the slit: it is looking when it slides left and right
  const emberG = group(headG, [0, -0.022, 0.085]);
  const ember = add(emberG, new THREE.SphereGeometry(0.019, 14, 10), M.ember, [0, 0, 0]);
  ember.scale.set(1.3, 0.9, 0.5);
  ember.userData.inkGroup = SOCKET;
  const eyeAnchor = group(emberG, [0, 0, 0.01]);

  // ── Arms: huge arms hanging from the shoulders, the forearm thicker than the upper arm and the elbow a lava joint; an iron band at the wrist, and the fist face wrapped in iron knuckles ──
  interface Arm {
    g: THREE.Group;
    fore: THREE.Group;
    sx: number;
    fist: THREE.Group;
  }
  const arms: Arm[] = [];
  for (const sx of [-1, 1]) {
    const s = sx > 0 ? 0 : 20;
    const g = group(torso, [sx * 0.47, 0.58, -0.02]);
    rock(g, hewn(0.21, 0.3, 0.22, { bot: [0.88, 0.9], seed: 101 + s }), [sx * 0.02, -0.19, 0]);
    add(g, new THREE.SphereGeometry(0.056, 14, 10), M.lava, [sx * 0.03, -0.36, 0.04]);
    const fore = group(g, [sx * 0.03, -0.37, 0.01]);
    rock(fore, hewn(0.25, 0.32, 0.26, { top: [0.8, 0.8], seed: 102 + s }), [0, -0.17, 0]);
    // Iron band at the wrist: a rounded-corner square frame against the forearm, with four red-copper rivets
    const band = group(fore, [0, -0.29, 0], [PI / 2, 0, 0]);
    add(band, slab(frameShape(0.3, 0.31, 0.256, 0.266, 0.045), 0.05, 0.006, 6), M.iron);
    for (const [x, z] of [[0, 0.158], [0, -0.158], [0.153, 0], [-0.153, 0]] as P2[]) rivet(band, M.copper, [x, z, 0], [x ? Math.sign(x) : 0, z ? Math.sign(z) : 0, 0], 0.012);
    // Fist: one big rock, with three curled knuckles on the front edge and a thumb on the inside
    rock(fore, hewn(0.29, 0.25, 0.29, { seed: 103 + s, chip: 0.2 }), [0, -0.465, 0.01]);
    for (const [i, dx] of [-0.088, 0, 0.088].entries()) rock(fore, hewn(0.085, 0.1, 0.11, { seed: 104 + s + i, b: 0.018 }), [dx, -0.56, 0.1], [0.3, 0, 0]);
    rock(fore, hewn(0.08, 0.14, 0.1, { seed: 108 + s, b: 0.018 }), [-sx * 0.15, -0.45, 0.07], [0.2, 0, -sx * 0.15]);
    // Iron knuckles: a piece of iron wrapping the fist face, with three rivets
    const kn = group(fore, [0, -0.47, 0.158]);
    add(kn, rbox(0.27, 0.1, 0.032, 0.012, 2), M.iron, [0, 0, 0]);
    for (const dx of [-0.085, 0, 0.085]) rivet(kn, M.copper, [dx, 0, 0.016], [0, 0, 1], 0.012);
    const fist = group(fore, [0, -0.53, 0.18]);
    // Pose it into the idle posture first and then color it (the furnace ash follows the world's upward direction)
    g.rotation.set(-LEAN + (sx > 0 ? 0.2 : 0.08), 0, sx * 0.1);
    fore.rotation.set(sx > 0 ? -0.66 : -0.46, 0, 0);
    arms.push({ g, fore, sx, fist });
  }

  // ── Coloring: upward faces with furnace ash, downward faces darkened, burnt red-brown near the lava; each stone has a different darkness ──
  root.updateMatrixWorld(true);
  const hot: [THREE.Vector3, number][] = [];
  const toW = (o: THREE.Object3D, p: THREE.Vector3) => o.localToWorld(p.clone());
  hot.push([toW(torso, v(H[0], H[1], heartZ)), 0.3]);
  hot.push([toW(torso, crackMid), 0.24]);
  for (const a of arms) hot.push([toW(a.g, v(a.sx * 0.03, -0.37, 0.01)), 0.17]);
  hot.push([toW(headG, v(0, -0.022, 0.1)), 0.1]);
  const cBase = new THREE.Color(0x544f57);
  const cDark = new THREE.Color(0x36323a);
  const cAsh = new THREE.Color(0x8e8983);
  const cHeat = new THREE.Color(0x7c4030);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.material !== M.rock) return;
    const g = m.geometry;
    const pa = g.attributes.position as THREE.BufferAttribute;
    const na = g.attributes.normal as THREE.BufferAttribute;
    nm.getNormalMatrix(m.matrixWorld);
    const k = tone.get(m) ?? 1;
    // The head is the first stop of the gaze, so it is kept dark, so that the point of fire in the slit can stand out
    let ash = 1;
    for (let q: THREE.Object3D | null = m; q; q = q.parent) if (q === headG) ash = 0.25;
    const out = new Float32Array(pa.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pa.count; i++) {
      P.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
      N.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      c.copy(cBase).lerp(cDark, ss(-N.y, 0.2, 0.85) * 0.7).multiplyScalar(k);
      c.lerp(cAsh, ss(N.y, 0.6, 0.95) * 0.55 * ash);
      let heat = 0;
      for (const [hp, hr] of hot) heat = Math.max(heat, 1 - ss(P.distanceTo(hp), hr * 0.35, hr));
      c.lerp(cHeat, heat * 0.65);
      out.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  });
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const rig = {
    head: group(headG, [0, -0.02, 0.16]),
    eyes: [eyeAnchor],
    anchors: {
      mouth: heartAnchor,
      heart: heartAnchor,
      fistL: arms[1].fist,
      fistR: arms[0].fist,
      crystal: crystalTip,
      hammer: hammerHead,
      crack: group(torso, [crackMid.x, crackMid.y, crackMid.z - 0.02]),
      anvil: group(anvilG, [0, 0, 0.01]),
    },
  };
  const act = { glow: 0, wake: 0, flame: 0, edge: 0, heavy: 0 };

  mergeStatic(root, {
    owners: [torso, headBase, headG, ...arms.flatMap((a) => [a.g, a.fore])],
    keep: [ember, ...runeMeshes],
    rig,
    twins: [
      [M.crust, M.rock],
      [M.iron, M.metal],
      [M.copper, M.metal],
      [M.wood, M.woodV],
      [M.leather, M.woodV],
    ],
  });

  // ── Idle: very slow, heavy breathing, the lava flickering, the fire in the slit looking left and right, and every so often turning back to look at the furnace behind ──
  // The stance is asymmetric: the left fist (+x) is lifted slightly forward with the elbow bent more, as if about to block the furnace mouth at any moment; the right arm hangs
  const armRest = arms.map((a) => ({ x: -LEAN + (a.sx > 0 ? 0.2 : 0.08), z: a.sx * 0.1, f: a.sx > 0 ? -0.66 : -0.46 }));
  const update = (t: number, _dt: number) => {
    const wk = act.wake;
    const br = Math.sin(t * 0.85);
    torso.rotation.x = LEAN + br * 0.012 - wk * 0.03;
    torso.position.y = 0.6 + br * 0.005;
    arms.forEach((a, i) => {
      a.g.rotation.set(armRest[i].x - br * 0.014, 0, armRest[i].z + a.sx * br * 0.006);
      a.fore.rotation.set(armRest[i].f - br * 0.02, 0, 0);
    });
    // Gaze: an 11-second cycle. Look right, pause, look left, pause, look back behind (the head tilts to the left rear, the fire sliding to the left end of the slit), return to center
    const c = t % 11;
    const seg = (a: number, b: number) => ss(c, a, b);
    const gaze = -0.8 * seg(0.5, 1.6) + 0.8 * seg(3.2, 3.8) + 0.7 * seg(3.8, 4.6) - 0.7 * seg(6.6, 7.4);
    const back = seg(7.6, 8.4) - seg(9.4, 10.3);
    headG.rotation.set(-wk * 0.12 + back * 0.04, gaze * 0.18 + back * 0.42, back * -0.05);
    emberG.position.x = THREE.MathUtils.clamp(gaze * 0.055 + back * 0.07, -0.07, 0.075);
    // Blink: the fire shrinks to a line
    const bt = (t + 1.3) % 5.3;
    const close = bt < 0.22 ? Math.sin((bt / 0.22) * PI) : 0;
    ember.scale.set(1.25 + close * 0.2, 0.85 * (1 - 0.8 * close), 0.5);
    // The lava flickers with the breathing (brighter on the inhale)
    const heat = 0.5 + 0.5 * Math.sin(t * 0.85 - 0.5);
    M.lava.emissiveIntensity = (0.62 + 0.22 * heat) * (1 + act.glow * 0.7);
    M.gem.emissiveIntensity = (0.38 + 0.12 * heat) * (1 + act.glow * 1.2);
    M.ember.emissiveIntensity = 0.95 + wk * 0.7 + heat * 0.08;
    M.runeFlame.emissiveIntensity = act.flame * 1.1;
    M.runeEdge.emissiveIntensity = act.edge * 1.1;
    M.runeHeavy.emissiveIntensity = act.heavy * 1.1;
  };
  update(0, 0);

  return { root, update, rig, act, center: new THREE.Vector3(0, 0.82, 0), radius: 0.98 };
}
