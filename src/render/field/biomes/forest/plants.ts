// Whisperwood's plants and small props: oak, birch, fir, sapling, giant tree (a wrapper around giantTree from _woods),
// shrubs, ferns, flower clumps, mossy rocks, glowing mushrooms. Geometries are built as templates first and then copied,
// which is faster when building large numbers of props.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { V, farTree, giantTree, leanDir, leanM, mushroom, shelfFungus, type ShroomCols } from '../../../arenas/_woods.ts';
import type { FieldBatch, FieldCtx } from '../../kit.ts';

export const COL = {
  trunk: 0x86593a,
  bark: 0x6c4830,
  leaf: [0x5cb24c, 0x4a9c3e, 0x7ccc5e],
  leafDark: 0x3f8a44,
  lime: 0x9ccc50,
  birch: 0xe6e0cc,
  birchMark: 0x4a4038,
  fir: 0x3f7a4a,
  fir2: 0x4a8a50,
  blossom: 0xffb6cc,
  blossom2: 0xffd6e2,
  fern: 0x4f9a42,
  fern2: 0x62b04a,
  bush: [0x4f9a3e, 0x62b04a, 0x3f8a3a],
  rock: 0x8a867a,
  rockDark: 0x74705f,
  moss: 0x6aa84e,
  mossDeep: 0x4f8f44,
  stem: 0x3f8a3a,
};

export const SHROOM: ShroomCols = { stem: 0xf2e8d4, caps: [0x46b8a8, 0x5cc8b4, 0xff8fb8, 0xf7c757], glows: [0x9dffd6, 0xffe38f], spots: 0xfff6e8 };
export const FLOWERS = [0xffe07a, 0xff9ac0, 0xffffff, 0xb89aff, 0xff8a6a];

// ───────────────────────── Template geometry ─────────────────────────

export const T = {
  ico1: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  dode0: new THREE.DodecahedronGeometry(1, 0),
  dode1: new THREE.DodecahedronGeometry(1, 1),
  cyl6: new THREE.CylinderGeometry(0.6, 1, 1, 6),
  cyl7: new THREE.CylinderGeometry(0.62, 1, 1, 7),
  cyl5: new THREE.CylinderGeometry(1, 1, 1, 5),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  cone7: new THREE.ConeGeometry(1, 1, 7),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  frond: new THREE.ConeGeometry(1, 1, 4),
  stem: new THREE.CylinderGeometry(0.02, 0.02, 1, 3, 1, true),
};

/** Add a template to the batch (the batch copies it itself, so a template can be reused over and over) */
export function put(b: FieldBatch, geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, outline = true): void {
  b.add(geo, color, m, outline);
}

export const MX = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));

// ───────────────────────── Trees ─────────────────────────

/** Oak: a thick, short trunk splitting into two branches, topped with a wide canopy (about 6 to 11 meters) */
export function oak(ctx: FieldCtx, x: number, z: number, s: number, leaves: number[], solid = true): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.35 * s);
  const H = (2.6 + r() * 0.8) * s;
  const lean = (r() - 0.5) * 0.12;
  const la = r() * Math.PI * 2;
  put(b, T.cyl6, COL.trunk, leanM(V(x, -0.3, z), la, lean, H + 0.3, 0.36 * s, 0.36 * s, 1));
  const top = V(x, -0.3, z).addScaledVector(leanDir(la, lean), H + 0.3);
  // Main canopy clump, plus one clump on each of the two side branches
  const crowns: [THREE.Vector3, number][] = [[top.clone().add(V(0, 1.0 * s, 0)), 1.85 * s]];
  for (let i = 0; i < 2; i++) {
    const a = la + i * Math.PI + (r() - 0.5) * 1.2;
    const base = V(x, H * (0.55 + r() * 0.15), z);
    const len = (1.4 + r() * 0.6) * s;
    put(b, T.cyl5, COL.trunk, leanM(base, a, 0.9 + r() * 0.3, len, 0.12 * s, 0.12 * s, 1));
    crowns.push([base.clone().addScaledVector(leanDir(a, 1.0), len).add(V(0, 0.55 * s, 0)), (1.25 + r() * 0.3) * s]);
  }
  crowns.forEach(([c, rr], i) => put(b, T.ico1, leaves[(i + Math.floor(r() * 3)) % leaves.length], MX(c.x, c.y, c.z, rr, rr * 0.82, rr, 0, r() * 6)));
  if (solid) ctx.solids.add(x, z, 0.42 * s);
}

/** Birch: a tall, slender white trunk with dark scars and a small yellow-green canopy (forest edges, grassland edges) */
export function birch(ctx: FieldCtx, x: number, z: number, s: number, solid = true): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.2);
  const H = (4.6 + r() * 1.4) * s;
  const lean = (r() - 0.5) * 0.14;
  const la = r() * Math.PI * 2;
  put(b, T.cyl7, COL.birch, leanM(V(x, -0.2, z), la, lean, H, 0.16 * s, 0.16 * s, 1));
  for (let i = 0; i < 3; i++) {
    const y = H * (0.2 + i * 0.2) + r() * 0.3;
    const p = V(x, -0.2, z).addScaledVector(leanDir(la, lean), y);
    const a = r() * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.18 * s, 0.06 * s, 0.05), COL.birchMark, M(p.x + Math.cos(a) * 0.14 * s, p.y, p.z + Math.sin(a) * 0.14 * s, -a), false);
  }
  const top = V(x, -0.2, z).addScaledVector(leanDir(la, lean), H);
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : 0.7 * s;
    const rr = (0.9 + r() * 0.35) * s;
    put(b, T.ico1, i % 2 ? COL.lime : COL.leaf[2], MX(top.x + Math.cos(a) * d, top.y - i * 0.55 * s, top.z + Math.sin(a) * d, rr * 0.85, rr * 1.2, rr * 0.85, 0, r() * 6));
  }
  if (solid) ctx.solids.add(x, z, 0.25 * s);
}

/** Fir: a dark green spire built of stacked tiers (on the plateau and the rim wall) */
export function fir(ctx: FieldCtx, x: number, z: number, s: number, solid = true): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.3 * s);
  put(b, T.cyl6, COL.bark, MX(x, 0.6 * s, z, 0.28 * s, 1.6 * s, 0.28 * s));
  for (let i = 0; i < 3; i++) {
    const rr = (1.9 - i * 0.45) * s;
    const hh = (2.6 - i * 0.3) * s;
    put(b, T.cone7, i % 2 ? COL.fir2 : COL.fir, MX(x, (1.5 + i * 1.6) * s + hh / 2, z, rr, hh, rr, 0, r() * 6));
  }
  if (solid) ctx.solids.add(x, z, 0.4 * s);
}

/** Rim wall tree: low-poly, no outline, a large low canopy that merges with its neighbors seen from above (unreachable areas) */
export function wallTree(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1.2 * s);
  const H = (7 + r() * 5) * s;
  b.add(T.cyl6, COL.bark, MX(x, H / 2 - 0.5, z, 0.7 * s, H, 0.7 * s), false);
  const leaf = r() < 0.45 ? COL.leafDark : r() < 0.5 ? COL.leaf[1] : COL.leaf[0];
  put(b, T.ico1, leaf, MX(x, H + 1.2 * s, z, 4.2 * s, 3.2 * s, 4.2 * s, 0, r() * 6), false);
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const rr = (2.6 + r() * 0.8) * s;
    put(b, T.ico0, i % 2 ? COL.leaf[1] : leaf, MX(x + Math.cos(a) * 3.2 * s, H - 0.4 * s + r() * 1.5 * s, z + Math.sin(a) * 3.2 * s, rr, rr * 0.8, rr, 0, r() * 6), false);
  }
}

/** Flowering tree (an accent in the village and on the island): the oak's shape, with a pink crown of blossoms */
export function blossomTree(ctx: FieldCtx, x: number, z: number, s: number): void {
  oak(ctx, x, z, s, [COL.blossom, COL.blossom2, COL.blossom]);
}

export interface GiantOpts {
  R: number;
  H: number;
  leaves?: number[];
  /** Simplified version (on the rim wall, far away): fewer buttress roots and burls */
  lite?: boolean;
  shelf?: boolean;
  solid?: boolean;
}

/** Giant tree: more than ten times taller than a person, buttress roots at the base, glowing bracket fungi on the trunk */
export function giant(ctx: FieldCtx, x: number, z: number, o: GiantOpts): void {
  const { b, r } = ctx;
  ctx.place(x, z, o.R * 0.9);
  b.lift -= 0.25;
  giantTree(
    b,
    x,
    z,
    {
      radius: o.R,
      height: o.H,
      trunk: COL.trunk,
      bark: COL.bark,
      leaves: o.leaves ?? COL.leaf,
      canopy: 'blob',
      roots: o.lite ? 4 : 6,
      burls: o.lite ? 1 : 3,
      branches: o.lite ? 2 : 3,
      branchBand: [0.4, 0.68],
    },
    r,
  );
  if (o.shelf ?? !o.lite) {
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const y = 1.2 + i * 1.3 + r() * 0.6;
      shelfFungus(b, x, z, o.R * (1 - (0.5 * y) / o.H) * 0.97, r() * 6.28, y, 0.35 + r() * 0.25, i % 2 ? 0xf7c757 : 0x46b8a8, i % 2 ? 0xffe38f : 0x9dffd6);
    }
  }
  if (o.solid ?? true) ctx.solids.add(x, z, o.R * 1.2);
}

// ───────────────────────── Understory ─────────────────────────

export function bushAt(ctx: FieldCtx, x: number, z: number, s: number, cols = COL.bush): void {
  const { b, r } = ctx;
  // Shrub on a slope: take the lowest point around and bury it a bit deeper, so the downhill side does not hang in the air
  ctx.place(x, z, s * 0.9);
  b.lift -= s * 0.12;
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = s * 0.45 * r();
    const rr = s * (0.5 + r() * 0.3);
    put(b, T.ico1, cols[i % cols.length], MX(x + Math.cos(a) * d, rr * 0.62, z + Math.sin(a) * d, rr, rr * 0.85, rr, 0, r() * 6));
  }
}

/** Shrub with small flowers */
export function flowerBush(ctx: FieldCtx, x: number, z: number, s: number, flower: number): void {
  const { b, r } = ctx;
  bushAt(ctx, x, z, s);
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = s * (0.3 + r() * 0.35);
    put(b, T.ico0, flower, MX(x + Math.cos(a) * d, s * (0.55 + r() * 0.35), z + Math.sin(a) * d, 0.13, 0.13, 0.13), false);
  }
}

/** Fern: a ring of flat fronds leaning outward (no outline) */
export function fernAt(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  const col = r() < 0.5 ? COL.fern : COL.fern2;
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const tilt = 0.75 + r() * 0.5;
    const len = s * (0.8 + r() * 0.5);
    b.add(T.frond, col, leanM(V(x, 0.05, z), a, tilt, len, 0.17 * s, 0.05 * s, 1), false);
  }
}

export function flowerPatch(ctx: FieldCtx, x: number, z: number, cols: number[], n = 6, spread = 1.5): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * spread;
    const pz = z + (r() - 0.5) * spread;
    const hh = 0.3 + r() * 0.2;
    b.add(T.stem, COL.stem, MX(px, hh / 2, pz, 1, hh, 1), false);
    put(b, T.ico0, cols[i % cols.length], MX(px, hh + 0.03, pz, 0.11, 0.08, 0.11, 0, r() * 6), false);
  }
}

/** Mossy rock: a rock covered with a layer of moss, its base buried in the ground */
export function mossRockAt(ctx: FieldCtx, x: number, z: number, s: number, solid = true, spread = s * 0.7): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, spread);
  b.lift = y - s * 0.3;
  const ry = r() * 6;
  const tilt = (r() - 0.5) * 0.4;
  put(b, T.dode0, r() < 0.5 ? COL.rock : COL.rockDark, MX(x, s * 0.5, z, s * (1 + r() * 0.3), s * (0.75 + r() * 0.3), s, tilt, ry, tilt));
  put(b, T.dode0, COL.moss, MX(x, s * 1.0, z, s * 0.92, s * 0.32, s * 0.92, 0, ry + 0.4));
  if (solid) ctx.solids.add(x, z, s * 0.9);
}

/** A clump of glowing mushrooms */
export function shroomCluster(ctx: FieldCtx, x: number, z: number, n: number, s: number): void {
  const { b, r } = ctx;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.9 * s;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    ctx.place(px, pz);
    mushroom(b, px, pz, s * (0.35 + r() * 0.5), SHROOM, r, r() < 0.3);
  }
}

/** Fallen log: a trunk lying on its side, with the cut face, moss, and small mushrooms on the bark */
export function logAt(ctx: FieldCtx, x: number, z: number, len: number, a: number): void {
  const { b, r } = ctx;
  const rad = 0.35 + r() * 0.2;
  ctx.place(x, z, len * 0.35);
  b.lift -= rad * 0.25;
  b.add(new THREE.CylinderGeometry(rad, rad * 1.1, len, 9), COL.bark, M(x, rad, z, a, 1, 0, Math.PI / 2));
  for (const s of [-1, 1]) b.add(new THREE.CircleGeometry(rad * 0.95, 9), 0xd8b884, M(x + Math.cos(a) * s * len * 0.5, rad, z - Math.sin(a) * s * len * 0.5, a + (s * Math.PI) / 2), false);
  const g = new THREE.SphereGeometry(rad * 1.05, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2.5);
  g.scale(1, 0.5, len * 0.8);
  b.add(g, COL.moss, M(x, rad * 1.3, z, a + Math.PI / 2), false);
  // Small mushrooms sprouting on top of the trunk
  const lift = b.lift;
  b.lift = lift + rad * 1.85;
  for (let i = 0; i < 2; i++) {
    const t = (r() - 0.5) * len * 0.7;
    mushroom(b, x + Math.cos(a) * t, z - Math.sin(a) * t, 0.3 + r() * 0.15, SHROOM, r);
  }
  b.lift = lift;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let t = -0.4; t <= 0.41; t += 0.2) ctx.solids.add(x + ca * len * t, z - sa * len * t, rad + 0.25);
}
