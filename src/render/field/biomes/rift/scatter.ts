// Detail that blankets the whole land:
// ─ Ground (instanced, one mesh per shape for the whole map): gravel, sharp-edged rock chips, flaking slab shards,
//   small crystal sprouts poking out of the ground;
// ─ Medium (vertex-color batches): heaps of rubble (Old Kingdom square stones, column segments, broken rock),
//   remaining paved ground (some tilted up, some split in two), clusters of slabs pushed up from underground;
// ─ Corrupted life: petrified giant trees (gray-purple, twisted, with crystals growing from broken branches),
//   lampgrass (clumps of thin stems topped with glowing pods), tentacles coming up near the fissures, thornvines,
//   tall thin blight caps.
// After purification the same spots turn green again: petrified trees sprout new buds, lampgrass blooms into gold-white
// lamp flowers, tentacles become tender green vines.
// It uses its own random numbers (so other modules' placement is not disturbed); the positions are exactly the same before
// and after purification, only the colors change and new sprouts are added.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import type { Scatter } from './inst.ts';
import { COL, crystalCluster, upthrust } from './props.ts';
import { BASIN, COLOSSUS, CRATER, CROWN, FIELD, GRAVES, ISLE, land, RIN, relief, SINKS, sm, T, TOWN } from './shape.ts';
import type { Debris } from './void.ts';

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

export const STONE = [0x5e5268, 0x4c4258, 0x6a5e74, 0x40364c, 0x564a60];
const PEB = [0x5c5068, 0x6a5e76, 0x7a7088, 0x4a4056, 0x847a92, 0x3a3046];
const FLAKE = [0x6e6480, 0x7a7088, 0x62586e, 0x857b93];
const PETRI = [0x6e6478, 0x5e566a, 0x7c7286];
const PETRI_D = 0x4a4256;
const STALK = 0x2a1a36;
const TEND = 0x24162e;
const THORN = [0x2e2236, 0x3a2c44, 0x33263e];
const CAP = [0x4a2a5e, 0x3c2250, 0x5a2e6a];
const GREEN = [0x6a9a5a, 0x7cb068, 0x5a8a50];

/** Purification state (set by decorate; how grass grows also depends on it) */
export const HEAL = { pure: false, k: 0 };
const SHOOT = [0x6a9a5a, 0x8ab86a, 0x5a8a50, 0x9ac878];

/** Areas that affect the density of ground detail (leave a little room around landmarks) */
const KEEP: [number, number, number][] = [
  [TOWN[0], TOWN[1], 26],
  [T[0], T[1], 19],
  [COLOSSUS[0] - 2, COLOSSUS[1], 10],
  [CROWN[0], CROWN[1], 5],
  [CRATER[0], CRATER[1], 9],
  [ISLE[0], ISLE[1], 8],
];

/** Shared conditions for scattering: far enough from cliff edges, roads, towns, chests, residents and existing props */
export function roomFor(ctx: FieldCtx, x: number, z: number, rad: number, pathPad = 1.2): boolean {
  const L = ctx.layout;
  if (land(x, z) < rad + 2.2) return false;
  if (ctx.pathDist(x, z) < L.pathW + pathPad + rad) return false;
  for (const [kx, kz, kr] of KEEP) if (Math.hypot(x - kx, z - kz) < kr + rad) return false;
  if (Math.hypot(x - L.waypoint[0], z - L.waypoint[1]) < 4 + rad) return false;
  if (L.chests.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 3 + rad)) return false;
  if (L.npcs.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.5 + rad)) return false;
  if (ctx.solids.blocked(x, z, rad)) return false;
  return true;
}

/** The center of a spirit's spawn zone is kept clear (no large props there) */
function zoneFree(ctx: FieldCtx, x: number, z: number, rad: number): boolean {
  return ctx.layout.zones.every((zn) => Math.hypot(zn.x - x, zn.z - z) > zn.r * 0.45 + rad);
}

const n2 = (x: number, z: number, f: number, s: number) => Math.sin(x * f + s) * Math.cos(z * f * 1.13 - s * 0.7) + 0.35 * Math.sin((x + z) * f * 2.1 + s * 1.9);

/** Distance ratio to the Wound: 1 at the edge of the Wound, 0 in the outer sea */
const woundK = (x: number, z: number) => 1 - sm(44, 92, Math.hypot(x - T[0], z - T[1]));

/** Turn the terrain normal into the rotation that makes a flat prop lie on the ground */
function onGround(ctx: FieldCtx, x: number, z: number, ry: number, extraTilt = 0, r?: () => number): THREE.Quaternion {
  const n = ctx.terrain.normalAt(x, z);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
  const qy = new THREE.Quaternion().setFromEuler(new THREE.Euler(r ? (r() - 0.5) * extraTilt : 0, ry, r ? (r() - 0.5) * extraTilt : 0));
  return q.multiply(qy);
}

/** A frustum from a to b (base radius r0, top radius r1) */
export function seg(b: FieldCtx['b'], a: THREE.Vector3, c: THREE.Vector3, r0: number, r1: number, col: number, sides = 6, outline = true): void {
  const d = c.clone().sub(a);
  const len = d.length();
  if (len < 1e-3) return;
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(len));
  b.add(new THREE.CylinderGeometry(r1, r0, len, sides), col, new THREE.Matrix4().compose(a.clone().lerp(c, 0.5), q, new THREE.Vector3(1, 1, 1)), outline);
}

/** A curved tube tapering from thick to thin (tentacles, vines): pts is the centerline, the radius tapers from r0 to r1 */
export function taperTube(pts: THREE.Vector3[], r0: number, r1: number, radial = 5): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = pts.length;
  const t = new THREE.Vector3();
  const nrm = new THREE.Vector3(1, 0, 0);
  const bin = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    t.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
    bin.crossVectors(t, nrm).normalize();
    if (bin.lengthSq() < 1e-6) bin.set(0, 0, 1);
    nrm.crossVectors(bin, t).normalize();
    const rr = r0 + (r1 - r0) * (i / (n - 1));
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const ca = Math.cos(a) * rr;
      const sa = Math.sin(a) * rr;
      pos.push(pts[i].x + nrm.x * ca + bin.x * sa, pts[i].y + nrm.y * ca + bin.y * sa, pts[i].z + nrm.z * ca + bin.z * sa);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k;
      const b2 = i * radial + ((k + 1) % radial);
      idx.push(a, a + radial, b2, b2, a + radial, b2 + radial);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── Ground (instanced) ─────────────────────────

export function registerKinds(sc: Scatter): void {
  sc.kind('peb', new THREE.IcosahedronGeometry(1, 0));
  sc.kind('chip', new THREE.TetrahedronGeometry(1, 0));
  sc.kind('flake', new THREE.BoxGeometry(1, 1, 1));
  const sp = new THREE.OctahedronGeometry(1, 0);
  sp.translate(0, 0.55, 0);
  sc.kind('sprout', sp, true);
  // After purification: the same sprouts, turned into non-glowing tender green buds
  const sh = new THREE.OctahedronGeometry(1, 0);
  sh.translate(0, 0.55, 0);
  sc.kind('shoot', sh);
  const tuft = new THREE.ConeGeometry(1, 1, 4, 1, true);
  tuft.translate(0, 0.5, 0);
  sc.kind('spike', tuft);
}

const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tv = new THREE.Vector3();
const ts = new THREE.Vector3();
const tm = new THREE.Matrix4();

function put(sc: Scatter, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, col: number, k = 1): void {
  te.set(rx, ry, rz);
  tq.setFromEuler(te);
  tv.set(x, y, z);
  ts.set(sx, sy, sz);
  tm.compose(tv, tq, ts);
  sc.add(kind, tm, col, k);
}

/**
 * Debris on the ground: clump after clump of gravel and rock chips (most around rubble heaps, cliff edges and ridges),
 * scattered flaking slab shards, and small crystal sprouts that get more numerous the closer to the Wound.
 * spots are the rubble and ruins already placed (gravel gathers around them).
 */
export function groundCover(ctx: FieldCtx, sc: Scatter, spots: [number, number, number][], r: () => number): void {
  const k = ctx.low ? 0.45 : 1;
  const S = ctx.layout.size - 4;
  const pure = HEAL.pure;
  const L = ctx.layout;
  const ok = (x: number, z: number, pad: number) => {
    if (land(x, z) < 0.8) return false;
    if (Math.hypot(x - TOWN[0], z - TOWN[1]) < 21) return false;
    if (Math.hypot(x - T[0], z - T[1]) < 7) return false;
    if (ctx.pathDist(x, z) < L.pathW * pad) return false;
    return !ctx.solids.blocked(x, z, 0.05);
  };
  const pebble = (x: number, z: number, big: number) => {
    const s = (0.05 + r() * 0.13) * big;
    const y = ctx.h(x, z);
    if (r() < 0.55) put(sc, 'peb', x, y + s * 0.2, z, s, s * (0.5 + r() * 0.35), s * (0.8 + r() * 0.4), r() * 3, r() * 6, r() * 3, PEB[Math.floor(r() * PEB.length)]);
    else put(sc, 'chip', x, y + s * 0.15, z, s * 1.1, s * (0.6 + r() * 0.8), s * 1.1, r() * 3, r() * 6, r() * 3, PEB[Math.floor(r() * PEB.length)]);
  };
  // Gravel gathered around rubble and ruins
  for (const [cx, cz, cr] of spots) {
    const n = Math.round((4 + cr * 5) * k);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = cr * (0.6 + Math.pow(r(), 0.7) * 1.6);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (ok(x, z, 0.8)) pebble(x, z, 1 + (1 - d / (cr * 2.2)) * 0.8);
    }
  }
  // The whole land: more at cliff edges and near ridges, and on flat ground just the occasional small handful
  const tries = Math.round(3000 * k);
  for (let i = 0; i < tries; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = land(x, z);
    if (d < 1) continue;
    const rim = 1 - sm(2, 9, d);
    const ridge = sm(0.35, 1.1, relief(x, z));
    const want = 0.2 + rim * 0.6 + ridge * 0.35 + woundK(x, z) * 0.2;
    if (r() > want) continue;
    const n = 2 + Math.floor(r() * 5);
    for (let j = 0; j < n; j++) {
      const px = x + (r() - 0.5) * 1.8;
      const pz = z + (r() - 0.5) * 1.8;
      if (ok(px, pz, 0.55)) pebble(px, pz, 1);
    }
  }
  // Flaking slab shards: flat blocks lying slanted along the ground
  for (let i = 0; i < 1600 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const ruin = Math.max(sm(-30, -60, x), sm(-60, -80, z), 0.3 * woundK(x, z));
    if (r() > 0.15 + ruin * 0.6 || !ok(x, z, 0.9)) continue;
    const w = 0.25 + r() * 0.45;
    const y = ctx.h(x, z);
    put(sc, 'flake', x, y + 0.03, z, w, 0.06 + r() * 0.05, w * (0.6 + r() * 0.5), (r() - 0.5) * 0.35, r() * 6, (r() - 0.5) * 0.35, FLAKE[Math.floor(r() * FLAKE.length)]);
  }
  // Small crystal sprouts: void crystals poking out of the ground, handful after handful, only near the edge of the Wound,
  // the basin, pits and fissures (after purification they fade to pale gold-white and are much sparser)
  const sprouts = Math.round((pure ? 900 : 1300) * k);
  for (let i = 0, placed = 0; i < sprouts * 10 && placed < sprouts; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const bas = 1 - sm(10, 30, Math.hypot(x - BASIN[0], z - BASIN[1]));
    const cr = 1 - sm(8, 20, Math.hypot(x - CRATER[0], z - CRATER[1]));
    const want = woundK(x, z) ** 2 * 0.5 + bas * 0.6 + cr * 0.4;
    if (r() > want || !ok(x, z, 0.7)) continue;
    const n = 2 + Math.floor(r() * 5);
    for (let j = 0; j < n; j++) {
      const px = x + (r() - 0.5) * 0.8;
      const pz = z + (r() - 0.5) * 0.8;
      if (!ok(px, pz, 0.7)) continue;
      const s = 0.05 + r() * 0.1 + (j === 0 ? 0.06 : 0);
      const a = r() * Math.PI * 2;
      const tilt = 0.15 + r() * 0.45;
      if (pure) {
        // After purification what grows is tender green buds, with an occasional one still holding a faint golden glow
        const gold = r() < 0.12;
        put(sc, gold ? 'sprout' : 'shoot', px, ctx.h(px, pz) - 0.03, pz, s * 0.5, s * 1.7, s * 0.5, Math.sin(a) * tilt, r() * 6, -Math.cos(a) * tilt, gold ? 0xffd890 : SHOOT[Math.floor(r() * SHOOT.length)], 0.35);
      } else {
        const col = r() < 0.35 ? COL.cryA : r() < 0.8 ? COL.cryB : COL.cryC;
        put(sc, 'sprout', px, ctx.h(px, pz) - 0.03, pz, s * 0.45, s * 1.9, s * 0.45, Math.sin(a) * tilt, r() * 6, -Math.cos(a) * tilt, col, 0.7);
      }
      placed++;
    }
  }
}

// ───────────────────────── Rubble heaps ─────────────────────────

/**
 * A rubble heap: Old Kingdom square stones, column segments and broken rock, the large ones in the middle;
 * s is roughly the radius
 */
export function rubblePile(ctx: FieldCtx, x: number, z: number, s: number, r: () => number, solid = true): void {
  const { b } = ctx;
  const n = 3 + Math.floor(r() * 3 + s * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : s * (0.3 + r() * 0.75);
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    ctx.place(px, pz);
    const k = (i === 0 ? 1 : 0.4 + r() * 0.5) * s;
    const t = r();
    const col = STONE[Math.floor(r() * STONE.length)];
    if (t < 0.5) {
      // Square stones: slightly askew, half buried
      const w = (0.7 + r() * 0.6) * k;
      const h = (0.45 + r() * 0.4) * k;
      b.add(new THREE.BoxGeometry(w, h, (0.6 + r() * 0.5) * k), col, M(px, h * 0.3, pz, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
    } else if (t < 0.7) {
      // Column segments: lying down or stuck in at a slant
      const R = (0.28 + r() * 0.1) * k;
      const h = (0.5 + r() * 0.6) * k;
      if (r() < 0.6) b.add(new THREE.CylinderGeometry(R, R, h, 8), COL.stone, M(px, R * 0.85, pz, r() * 6, 1, 0, Math.PI / 2));
      else b.add(new THREE.CylinderGeometry(R, R * 1.05, h, 8), COL.stone, M(px, h * 0.35, pz, r() * 6, 1, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
    } else {
      const R = (0.35 + r() * 0.35) * k;
      b.add(new THREE.DodecahedronGeometry(R, 0), r() < 0.5 ? COL.stoneD : COL.slab, M(px, R * 0.35, pz, r() * 6, 1, r() * 3, r() * 3));
    }
  }
  if (solid && s > 0.7) ctx.solids.add(x, z, s * 0.75);
}

// ───────────────────────── Remaining paved ground ─────────────────────────

/**
 * A patch of Old Kingdom paving: laid in a grid with chipped corners at the edge, a few tilted up or split in two;
 * following the slope of the terrain
 */
export function pavingPatch(ctx: FieldCtx, x: number, z: number, ang: number, nx: number, nz: number, r: () => number, debris?: Debris[]): void {
  const { b } = ctx;
  b.lift = 0;
  const ts = 0.95 + r() * 0.35;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const cols = [COL.stone, 0x4c4258, 0x5a5066, COL.stoneD];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const u = (i - (nx - 1) / 2) * ts;
      const v = (j - (nz - 1) / 2) * ts;
      // The further out, the more is missing: an irregular outline
      const e = Math.hypot(u / (nx * ts * 0.5), v / (nz * ts * 0.5));
      if (r() < 0.12 + sm(0.45, 1.05, e) * 0.75) continue;
      const px = x + ca * u + sa * v + (r() - 0.5) * 0.08;
      const pz = z - sa * u + ca * v + (r() - 0.5) * 0.08;
      if (land(px, pz) < 1.5 || ctx.solids.blocked(px, pz, 0.1)) continue;
      const gy = ctx.h(px, pz);
      const w = ts * (0.88 + r() * 0.08);
      const d = ts * (0.88 + r() * 0.08);
      const col = cols[Math.floor(r() * cols.length)];
      const k = r();
      const q = onGround(ctx, px, pz, ang + (r() - 0.5) * 0.12, 0.05, r);
      if (k < 0.1) {
        // A tilted-up piece: one side is still stuck in the ground
        const lift = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8));
        b.add(new THREE.BoxGeometry(w, 0.18, d), col, new THREE.Matrix4().compose(V3(px, gy + 0.12 + r() * 0.12, pz), q.clone().multiply(lift), V3(1, 1, 1)));
      } else if (k < 0.18) {
        // Split in two, with a line of light showing through the middle
        for (const s of [-1, 1]) {
          const off = new THREE.Vector3(s * w * 0.26, 0, 0).applyQuaternion(q);
          const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * 0.08));
          b.add(new THREE.BoxGeometry(w * 0.46, 0.14, d), col, new THREE.Matrix4().compose(V3(px + off.x, gy + 0.03 + off.y, pz + off.z), q.clone().multiply(tilt), V3(1, 1, 1)), false);
        }
        b.glow(new THREE.BoxGeometry(0.04, 0.02, d * 0.8), COL.cryA, new THREE.Matrix4().compose(V3(px, gy + 0.02, pz), q, V3(1, 1, 1)));
      } else if (k < 0.23 && debris) {
        // This piece has already floated up
        debris.push([px, gy + 0.6 + r() * 1.6, pz, ts * 0.32, 1]);
      } else {
        b.add(new THREE.BoxGeometry(w, 0.14, d), col, new THREE.Matrix4().compose(V3(px, gy + 0.02 + (r() - 0.5) * 0.04, pz), q, V3(1, 1, 1)), false);
      }
    }
  }
  b.lift = 0;
}

// ───────────────────────── Petrified giant trees ─────────────────────────

/**
 * Petrified tree: a gray-purple stone trunk twisting upward segment by segment, thick stubby broken branches,
 * crystals growing from the broken ends; after purification the branch tips sprout buds
 */
export function petrifiedTree(ctx: FieldCtx, x: number, z: number, s: number, r: () => number): void {
  const { b } = ctx;
  const gy = ctx.place(x, z, 0.4 * s);
  void gy;
  const col = PETRI[Math.floor(r() * PETRI.length)];
  // Roots: a few buttress roots spreading outward
  const roots = 3 + Math.floor(r() * 3);
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + r() * 0.6;
    const len = (0.9 + r() * 0.7) * s;
    seg(b, V3(x, 0.55 * s, z), V3(x + Math.cos(a) * len, -0.15, z + Math.sin(a) * len), 0.26 * s, 0.05 * s, PETRI_D, 5);
  }
  // Trunk: three segments, each bending in a different direction
  let p = V3(x, -0.2, z);
  let dir = V3((r() - 0.5) * 0.25, 1, (r() - 0.5) * 0.25).normalize();
  const H = (3.2 + r() * 2.6) * s;
  const nSeg = 3;
  let rad = 0.42 * s;
  const tips: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < nSeg; i++) {
    const len = (H / nSeg) * (0.85 + r() * 0.3);
    dir = dir.clone().add(V3((r() - 0.5) * 0.55, 0, (r() - 0.5) * 0.55)).normalize();
    const q = p.clone().addScaledVector(dir, len);
    const r1 = rad * (0.66 + r() * 0.1);
    seg(b, p, q, rad, r1, col, 7);
    // Knots at the joints
    if (i < nSeg - 1) b.add(new THREE.DodecahedronGeometry(r1 * 1.25, 0), col, M(q.x, q.y, q.z, r() * 6, 1, r(), r()));
    // Broken branches
    const nb = i === 0 ? 0 : 1 + Math.floor(r() * 2);
    for (let j = 0; j < nb; j++) {
      const a = r() * Math.PI * 2;
      const bd = V3(Math.cos(a), 0.35 + r() * 0.6, Math.sin(a)).normalize();
      const bl = (0.8 + r() * 1.3) * s;
      const start = p.clone().lerp(q, 0.5 + r() * 0.4);
      const end = start.clone().addScaledVector(bd, bl);
      seg(b, start, end, r1 * 0.55, r1 * 0.3, col, 5);
      tips.push([end, bd]);
    }
    p = q;
    rad = r1;
  }
  tips.push([p, dir]);
  // Break ends: paler cut faces; some grow crystals or new buds
  for (const [e, d] of tips) {
    b.add(new THREE.ConeGeometry(rad * 0.9, rad * 1.6, 5), 0x8a8096, new THREE.Matrix4().compose(e, new THREE.Quaternion().setFromUnitVectors(UP, d), V3(1, 1, 1)));
    if (HEAL.pure) {
      if (r() < 0.8) {
        for (let k = 0; k < 3; k++) b.add(new THREE.IcosahedronGeometry((0.16 + r() * 0.16) * s, 0), GREEN[k % 3], M(e.x + (r() - 0.5) * 0.4 * s, e.y + 0.1 + r() * 0.3 * s, e.z + (r() - 0.5) * 0.4 * s, r() * 6), false);
        if (r() < 0.5) b.glow(new THREE.OctahedronGeometry(0.06 * s), 0xfff4e0, M(e.x, e.y + 0.4 * s, e.z));
      }
    } else if (r() < 0.35) {
      const g = new THREE.OctahedronGeometry(0.14 * s);
      g.scale(0.7, 2.2, 0.7);
      b.glow(g, r() < 0.5 ? COL.cryA : COL.cryB, new THREE.Matrix4().compose(e.clone().addScaledVector(d, 0.2 * s), new THREE.Quaternion().setFromUnitVectors(UP, d), V3(1, 1, 1)));
    }
  }
  // A corruption crack on the trunk
  if (!HEAL.pure && r() < 0.5) {
    const a = r() * Math.PI * 2;
    b.glow(new THREE.BoxGeometry(0.05 * s, H * 0.35, 0.04), COL.cryA, M(x + Math.cos(a) * 0.36 * s, H * 0.25, z + Math.sin(a) * 0.36 * s, -a + Math.PI / 2, 1, (r() - 0.5) * 0.3, 0));
  }
  if (HEAL.pure) {
    // Moss grown back in a ring at the tree's foot
    const g = new THREE.SphereGeometry(0.9 * s, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.18, 1);
    b.add(g, 0x5a8a50, M(x, -0.02, z, r() * 6), false);
  }
  ctx.solids.add(x, z, 0.5 * s);
  b.lift = 0;
}

/** Fallen petrified tree: broken into several sections lying on the ground, with a stump beside it */
function fallenPetrified(ctx: FieldCtx, x: number, z: number, s: number, r: () => number): void {
  const { b } = ctx;
  ctx.place(x, z, 0.8 * s);
  const col = PETRI[Math.floor(r() * PETRI.length)];
  const a = r() * Math.PI * 2;
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  // Stump
  seg(b, V3(x, -0.2, z), V3(x, 0.9 * s, z), 0.45 * s, 0.38 * s, col, 7);
  b.add(new THREE.ConeGeometry(0.4 * s, 0.5 * s, 6), 0x8a8096, M(x, 1.05 * s, z, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
  let off = 0.9 * s;
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const len = (1.2 + r() * 1.1) * s;
    const R = 0.36 * s * (1 - i * 0.15);
    const c = off + len / 2;
    const px = x + dx * c;
    const pz = z + dz * c;
    ctx.place(px, pz);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, V3(dx, (r() - 0.5) * 0.12, dz).normalize());
    b.add(new THREE.CylinderGeometry(R * 0.92, R, len, 7), col, new THREE.Matrix4().compose(V3(px, R * 0.8, pz), q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, r() * 6)), V3(1, 1, 1)));
    ctx.solids.add(px, pz, R + 0.2);
    off += len + 0.15 + r() * 0.35;
  }
  ctx.solids.add(x, z, 0.5 * s);
  b.lift = 0;
}

// ───────────────────────── Corrupted plants ─────────────────────────

/**
 * Lampgrass: a clump of thin stems topped with glowing pods, each pod supported by two curled leaves;
 * after purification it blooms into gold-white lamp flowers
 */
export function lanternWeed(ctx: FieldCtx, x: number, z: number, r: () => number): void {
  const { b } = ctx;
  const pure = HEAL.pure;
  const n = 3 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.3;
    const pz = z + (r() - 0.5) * 1.3;
    ctx.place(px, pz);
    const h = 0.45 + r() * 1.1;
    const lean = V3((r() - 0.5) * 0.5, 1, (r() - 0.5) * 0.5).normalize();
    const mid = V3(px, h * 0.5, pz).addScaledVector(lean, 0.05);
    const top = V3(px + lean.x * h * 0.45, h, pz + lean.z * h * 0.45);
    seg(b, V3(px, -0.05, pz), mid, 0.035, 0.028, pure ? 0x4a7a4a : STALK, 4, false);
    seg(b, mid, top, 0.028, 0.02, pure ? 0x5a8a50 : STALK, 4, false);
    // Supporting leaves
    for (const s of [-1, 1]) {
      const g = new THREE.ConeGeometry(0.09, 0.22, 4, 1, true);
      b.add(g, pure ? 0x6a9a5a : 0x3a2248, M(top.x + s * 0.06, top.y - 0.08, top.z, r() * 6, 1, 0, s * 0.9), false);
    }
    const bulb = new THREE.IcosahedronGeometry(0.07 + r() * 0.07, 0);
    bulb.scale(1, 1.35, 1);
    const glow = pure ? (r() < 0.6 ? 0xb89048 : 0xc8b070) : r() < 0.5 ? 0xff6ad0 : r() < 0.7 ? 0xc07aff : COL.cryC;
    b.glow(bulb, glow, M(top.x, top.y + 0.05, top.z));
  }
  b.lift = 0;
}

/**
 * Tentacle: a long thin curling tentacle coming out of a black knot, its tip glowing;
 * after purification it becomes a tender green vine with a white flower at the tip
 */
export function tendrils(ctx: FieldCtx, x: number, z: number, s: number, r: () => number): void {
  const { b } = ctx;
  const pure = HEAL.pure;
  ctx.place(x, z, 0.3);
  const base = new THREE.IcosahedronGeometry(0.35 * s, 0);
  base.scale(1.2, 0.45, 1.1);
  b.add(base, pure ? 0x4a6a44 : 0x1e1228, M(x, 0, z, r() * 6));
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a0 = r() * Math.PI * 2;
    const H = (0.8 + r() * 1.5) * s;
    const curl = (r() < 0.5 ? -1 : 1) * (2 + r() * 2.5);
    const spread = (0.25 + r() * 0.35) * s;
    const pts: THREE.Vector3[] = [];
    const m = 7;
    for (let k = 0; k <= m; k++) {
      const t = k / m;
      // Grows upward, curling further outward the higher it goes, with the last segment hooking back
      const a = a0 + curl * t * t;
      const rr = spread * Math.sin(t * Math.PI * 0.85) + 0.05;
      pts.push(V3(x + Math.cos(a0) * 0.12 * s + Math.cos(a) * rr * t * 1.6, H * Math.sin(t * Math.PI * 0.5) * (1 - 0.12 * t), z + Math.sin(a0) * 0.12 * s + Math.sin(a) * rr * t * 1.6));
    }
    b.add(taperTube(pts, 0.08 * s, 0.012 * s, 4), pure ? GREEN[i % 3] : TEND, new THREE.Matrix4());
    const tip = pts[m];
    if (pure) {
      b.glow(new THREE.OctahedronGeometry(0.06 * s), 0xfff8f0, M(tip.x, tip.y, tip.z));
    } else if (r() < 0.8) {
      b.glow(new THREE.OctahedronGeometry(0.05 * s + 0.02), r() < 0.5 ? COL.cryA : 0xff86ff, M(tip.x, tip.y, tip.z));
    }
  }
  ctx.solids.add(x, z, 0.35 * s);
  b.lift = 0;
}

/**
 * Thornvine: a low clump with black thorns sticking out in all directions;
 * after purification the thorn tips bloom into small flowers
 */
export function thornBush(ctx: FieldCtx, x: number, z: number, s: number, r: () => number, sc: Scatter): void {
  const { b } = ctx;
  const gy = ctx.place(x, z, 0.3);
  const base = new THREE.DodecahedronGeometry(0.32 * s, 0);
  base.scale(1.2, 0.55, 1.2);
  b.add(base, THORN[0], M(x, 0.05, z, r() * 6));
  const n = 7 + Math.floor(r() * 7);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const tilt = 0.25 + r() * 0.9;
    const len = (0.4 + r() * 0.75) * s;
    const w = (0.035 + r() * 0.03) * s;
    const d = V3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    tm.compose(V3(x + d.x * 0.1, gy + 0.05, z + d.z * 0.1), q, V3(w, len, w));
    sc.add('spike', tm, THORN[Math.floor(r() * THORN.length)]);
    if (HEAL.pure && r() < 0.35) b.add(new THREE.IcosahedronGeometry(0.05 * s, 0), r() < 0.5 ? 0xffc8dc : 0xffffff, M(x + d.x * (len + 0.1), 0.05 + d.y * len, z + d.z * (len + 0.1)), false);
  }
  if (s > 0.9) ctx.solids.add(x, z, 0.35 * s);
  b.lift = 0;
}

/** Blight cap: a thin tall stalk, a flat cap, a ring of glowing gills under the cap; a cluster at varying heights */
export function voidShrooms(ctx: FieldCtx, x: number, z: number, s: number, r: () => number): void {
  const { b } = ctx;
  const pure = HEAL.pure;
  const n = 3 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.1 * s;
    const pz = z + (r() - 0.5) * 1.1 * s;
    ctx.place(px, pz);
    const h = (0.25 + r() * 0.9) * s * (i === 0 ? 1.4 : 1);
    const lean = V3((r() - 0.5) * 0.35, 1, (r() - 0.5) * 0.35).normalize();
    const top = V3(px, -0.05, pz).addScaledVector(lean, h);
    seg(b, V3(px, -0.05, pz), top, 0.045 * s, 0.03 * s, 0x8a7a96, 5, false);
    const R = (0.14 + r() * 0.16) * s * (i === 0 ? 1.4 : 1);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, V3(lean.x * 0.6, 1, lean.z * 0.6).normalize());
    const cap = new THREE.SphereGeometry(R, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.45, 1);
    b.add(cap, pure ? 0x8a6a4a : CAP[Math.floor(r() * CAP.length)], new THREE.Matrix4().compose(top, q, V3(1, 1, 1)));
    b.glow(new THREE.CylinderGeometry(R * 0.92, R * 0.5, 0.02, 8), pure ? 0xffe0a0 : r() < 0.6 ? 0xd08aff : 0xff7ac8, new THREE.Matrix4().compose(top.clone().add(V3(0, -0.01, 0)), q, V3(1, 1, 1)));
  }
  b.lift = 0;
}

// ───────────────────────── Assembly ─────────────────────────

/**
 * Medium-sized detail for the whole land. spots returns the positions of the rubble and ruins (for the ground gravel to gather
 * around), and debris collects the rock pieces that float up.
 */
export function buildScatter(ctx: FieldCtx, sc: Scatter, r: () => number, spots: [number, number, number][], debris: Debris[]): void {
  const k = ctx.low ? 0.5 : 1;
  const S = ctx.layout.size - 6;
  const rand = (n: number, pad: number, want: (x: number, z: number) => number, fn: (x: number, z: number) => void) => {
    for (let i = 0; i < n; i++) {
      const x = (r() * 2 - 1) * S;
      const z = (r() * 2 - 1) * S;
      if (r() > want(x, z)) continue;
      if (!roomFor(ctx, x, z, pad)) continue;
      fn(x, z);
    }
  };
  const west = (x: number, z: number) => Math.max(sm(-30, -58, x), sm(-58, -80, z));

  // Remaining paving: most in the old city to the west and in the north, with some along both sides of the trails too
  rand(Math.round(260 * k), 2.5, (x, z) => 0.12 + west(x, z) * 0.5 + 0.3 * (1 - sm(4, 14, ctx.pathDist(x, z))), (x, z) => {
    pavingPatch(ctx, x, z, r() * Math.PI, 3 + Math.floor(r() * 4), 3 + Math.floor(r() * 4), r, debris);
    spots.push([x, z, 1.2]);
  });
  // Rubble heaps
  rand(Math.round(620 * k), 1.2, (x, z) => 0.18 + west(x, z) * 0.45 + woundK(x, z) * 0.25, (x, z) => {
    const s = 0.5 + r() * 0.9 + (r() < 0.12 ? 0.8 : 0);
    if (s > 0.9 && !zoneFree(ctx, x, z, s)) return;
    rubblePile(ctx, x, z, s, r);
    spots.push([x, z, s]);
    ctx.b.lift = 0;
  });
  // Groups of pushed-up slabs (near ridges and the Wound), with flaking rocks floating above
  rand(Math.round(170 * k), 3, (x, z) => 0.1 + sm(0.4, 1.1, relief(x, z)) * 0.6 + woundK(x, z) * 0.3, (x, z) => {
    if (!zoneFree(ctx, x, z, 3)) return;
    const n = 1 + Math.floor(r() * 3);
    const a0 = r() * Math.PI;
    for (let i = 0; i < n; i++) {
      const px = x + (r() - 0.5) * 4;
      const pz = z + (r() - 0.5) * 4;
      if (land(px, pz) < 4 || ctx.pathDist(px, pz) < ctx.layout.pathW + 3 || ctx.solids.blocked(px, pz, 1.2)) continue;
      const w = 1.5 + r() * 2.8;
      ctx.place(px, pz, w * 0.4);
      upthrust(ctx.b, px, pz, w, 1.4 + r() * 2.6, 0.6 + r() * 0.4, a0 + (r() - 0.5) * 0.6, 0.3 + r() * 0.55, r);
      ctx.solids.add(px, pz, w * 0.42);
      for (let j = 0; j < 3; j++) if (r() < 0.6) debris.push([px + (r() - 0.5) * 3, ctx.h(px, pz) + 1.5 + r() * 3, pz + (r() - 0.5) * 3, 0.15 + r() * 0.35, r() < 0.4 ? 1 : 0]);
    }
    spots.push([x, z, 2]);
    ctx.b.lift = 0;
  });
  // Petrified giant trees: a stone forest, patch after patch
  const grove = (x: number, z: number) => sm(0.15, 0.75, n2(x, z, 0.041, 0.6));
  rand(Math.round(900 * k), 1.6, (x, z) => (0.015 + grove(x, z) * 0.22) * (1 - woundK(x, z) * 0.5), (x, z) => {
    if (!zoneFree(ctx, x, z, 1.5)) return;
    if (r() < 0.22) fallenPetrified(ctx, x, z, 0.9 + r() * 0.5, r);
    else petrifiedTree(ctx, x, z, 0.8 + r() * 0.7, r);
    spots.push([x, z, 1.4]);
  });
  // Lampgrass: in low ground (sinkholes, the basin's edge, around pits) in patches
  const damp = (x: number, z: number) => {
    let m = 0;
    for (const [sx, sz, sr] of SINKS) m = Math.max(m, 1 - sm(sr * 1.2, sr * 3.2, Math.hypot(x - sx, z - sz)));
    m = Math.max(m, (1 - sm(16, 34, Math.hypot(x - BASIN[0], z - BASIN[1]))) * 0.7, (1 - sm(12, 28, Math.hypot(x - CRATER[0], z - CRATER[1]))) * 0.8);
    return m;
  };
  rand(Math.round(900 * k), 0.8, (x, z) => 0.03 + damp(x, z) * 0.45 + 0.2 * sm(0.3, 0.9, n2(x, z, 0.07, 3.3)), (x, z) => lanternWeed(ctx, x, z, r));
  // Tentacles: most numerous at the edge of the Wound and in the Fractured Field
  rand(Math.round(700 * k), 1, (x, z) => 0.02 + woundK(x, z) * 0.28 + (1 - sm(8, 22, Math.hypot(x - FIELD[0], z - FIELD[1]))) * 0.4, (x, z) => {
    if (!zoneFree(ctx, x, z, 0.5)) return;
    tendrils(ctx, x, z, 0.8 + r() * 0.6, r);
  });
  // Thornvines: an occasional clump on open flat ground
  rand(Math.round(1100 * k), 0.8, (x, z) => 0.08 + 0.25 * sm(0.2, 0.8, n2(x, z, 0.055, 5.1)), (x, z) => thornBush(ctx, x, z, 0.7 + r() * 0.7, r, sc));
  // Blight caps: in the shade of ruins and the stone forest
  rand(Math.round(700 * k), 0.8, (x, z) => 0.04 + west(x, z) * 0.25 + grove(x, z) * 0.25, (x, z) => voidShrooms(ctx, x, z, 0.8 + r() * 0.6, r));
  // Scattered small crystal clusters (larger ones, with collision): near the basin and the Wound
  rand(Math.round(160 * k), 0.8, (x, z) => 0.05 + woundK(x, z) * 0.3 + (1 - sm(20, 36, Math.hypot(x - BASIN[0], z - BASIN[1]))) * 0.4, (x, z) => {
    ctx.place(x, z, 0.3);
    if (HEAL.pure) rubblePile(ctx, x, z, 0.5, r, false);
    else crystalCluster(ctx.b, x, z, 0.35 + r() * 0.6, r);
    ctx.solids.add(x, z, 0.45);
    ctx.b.lift = 0;
  });
  void GRAVES;
  void RIN;
}
