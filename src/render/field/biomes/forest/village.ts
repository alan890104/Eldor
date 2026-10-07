// Treespeak Village: the Forest Folk live in the trees. Four "home trees" surround the plaza; in them are round platforms,
// treehouses, the elder's tree hall and acorn houses hanging from the branch tips, and rope bridges between the platforms
// join them into a ring of aerial walkways; on the ground are the council stump, market stalls, the mushroom garden of the
// mushroom-picking children, a bamboo-pipe spring and drying racks for grass, with strings of lanterns stretched between
// the trees. To the north is the Vine Gate, and the slope outside it leads down to the Wildflower Slope.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { GlowSet, V, lantern, mushroom, rope, ropeBridge, segM, spiralStair, treeHouse } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import { crates } from '../../kit.ts';
import { TOWN } from './geo.ts';
import { blossomTree, bushAt, COL, flowerPatch, FLOWERS, giant, put, SHROOM } from './plants.ts';

const HOUSE = { deck: 0x9a6a42, post: 0x5a3c26, wall: 0xe0c898, roof: 0x6f9e4a };
const ROOF2 = 0x5a8a3e;
const THATCH = 0xc8a060;
const CLOTH = [0x6fae5a, 0xf2e4c0, 0xe8a05a];

interface HomeTree {
  x: number;
  z: number;
  R: number;
  H: number;
  decks: number[];
  /** Direction of the cottage on a platform (facing the plaza) */
  face: number;
}

/** Hang a lantern (absolute position; the lantern's glowing part is not raised by lift, so lift is zeroed for the moment) */
function hang(ctx: FieldCtx, glow: GlowSet, p: THREE.Vector3, s: number): void {
  const lift = ctx.b.lift;
  ctx.b.lift = 0;
  lantern(ctx.b, glow, p, s, HOUSE.post);
  ctx.b.lift = lift;
}

const MX = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));

/** Round tree hall: round walls, a thatched conical roof, a ring of (glowing) windows, a lamp on the roof */
function roundHall(ctx: FieldCtx, glow: GlowSet, x: number, y: number, z: number, r: number, h: number, face: number): void {
  const { b } = ctx;
  b.add(new THREE.CylinderGeometry(r, r * 1.05, h, 14), HOUSE.wall, M(x, y + h / 2, z));
  b.add(new THREE.CylinderGeometry(r * 1.07, r * 1.07, 0.22, 14), HOUSE.post, M(x, y + h * 0.55, z));
  b.add(new THREE.ConeGeometry(r * 1.45, r * 1.5, 14), THATCH, M(x, y + h + r * 0.72, z));
  b.add(new THREE.CylinderGeometry(r * 1.46, r * 1.46, 0.18, 14), HOUSE.roof, M(x, y + h + 0.02, z));
  b.add(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 5), HOUSE.post, M(x, y + h + r * 1.5 + 0.4, z));
  lantern(b, glow, V(x, y + h + r * 1.5 + 0.2, z), 1.2, HOUSE.post);
  for (let i = 0; i < 6; i++) {
    const a = face + (i / 6) * Math.PI * 2;
    if (i === 0) {
      b.add(new THREE.BoxGeometry(0.9, 1.6, 0.2), HOUSE.post, M(x + Math.sin(a) * r, y + 0.8, z + Math.cos(a) * r, a));
      continue;
    }
    glow.add(new THREE.BoxGeometry(0.55, 0.6, 0.12), M(x + Math.sin(a) * (r + 0.02), y + h * 0.62, z + Math.cos(a) * (r + 0.02), a));
  }
}

/** Acorn house: an egg-shaped hut hanging from a branch tip, with a round window that lights up and a lantern hanging below */
function acornPod(ctx: FieldCtx, glow: GlowSet, hang: THREE.Vector3, y: number, face: number, s: number): void {
  const { b } = ctx;
  const c = V(hang.x, y, hang.z);
  put(b, new THREE.SphereGeometry(1, 14, 10), HOUSE.wall, MX(c.x, c.y, c.z, 1.45 * s, 1.7 * s, 1.45 * s));
  const cap = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  b.add(cap, HOUSE.roof, MX(c.x, c.y + 0.55 * s, c.z, 1.62 * s, 1.35 * s, 1.62 * s));
  b.add(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 0.7 * s, 6), HOUSE.post, M(c.x, c.y + 1.95 * s, c.z));
  // Ring around the cap's brim
  b.add(new THREE.TorusGeometry(1.58 * s, 0.1 * s, 5, 20), ROOF2, M(c.x, c.y + 0.55 * s, c.z, 0, 1, Math.PI / 2));
  const fx = Math.sin(face);
  const fz = Math.cos(face);
  glow.add(new THREE.CircleGeometry(0.42 * s, 14), MX(c.x + fx * 1.44 * s, c.y + 0.05 * s, c.z + fz * 1.44 * s, 1, 1, 1, 0, face));
  b.add(new THREE.TorusGeometry(0.46 * s, 0.07 * s, 5, 14), HOUSE.post, MX(c.x + fx * 1.43 * s, c.y + 0.05 * s, c.z + fz * 1.43 * s, 1, 1, 1, 0, face));
  // Small side door and the little step in front of it
  const sx = Math.cos(face);
  const sz = -Math.sin(face);
  b.add(new THREE.BoxGeometry(0.2, 1.0 * s, 0.62 * s), HOUSE.post, MX(c.x + sx * 1.4 * s, c.y - 0.35 * s, c.z + sz * 1.4 * s, 1, 1, 1, 0, face));
  b.add(new THREE.BoxGeometry(1.0 * s, 0.1, 0.8 * s), HOUSE.deck, MX(c.x + sx * 1.75 * s, c.y - 0.9 * s, c.z + sz * 1.75 * s, 1, 1, 1, 0, face));
  // Hanging rope
  for (const o of [-0.35, 0.35]) b.add(new THREE.CylinderGeometry(1, 1, 1, 4), 0xc8b48a, segM(V(c.x + o * s, c.y + 2.2 * s, c.z), V(hang.x + o * 0.3, hang.y, hang.z), 0.05), false);
  lantern(b, glow, V(c.x, c.y - 1.7 * s, c.z), 1.1, HOUSE.post);
}

/** A thick horizontal branch on a home tree; returns the position of the branch tip (for hanging things) */
function limb(ctx: FieldCtx, x: number, z: number, R: number, y: number, a: number, len: number): THREE.Vector3 {
  const from = V(x + Math.cos(a) * R * 0.5, y - 0.8, z + Math.sin(a) * R * 0.5);
  const to = V(x + Math.cos(a) * (R + len), y + 0.6, z + Math.sin(a) * (R + len));
  ctx.b.add(new THREE.CylinderGeometry(0.35, 0.75, 1, 8), COL.trunk, segM(from, to, 1));
  put(ctx.b, new THREE.IcosahedronGeometry(1, 1), COL.leaf[0], MX(to.x, to.y + 1.8, to.z, 2.6, 2.0, 2.6, 0, a));
  return to;
}

/** Market stall: four posts, a counter, a slanting cloth awning and a pile of goods */
function stall(ctx: FieldCtx, glow: GlowSet, x: number, z: number, face: number, cloth: number, goods: number[]): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 1.6);
  const fx = Math.sin(face);
  const fz = Math.cos(face);
  const sx = Math.cos(face);
  const sz = -Math.sin(face);
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const hh = c > 0 ? 2.3 : 2.8;
    b.add(new THREE.CylinderGeometry(0.08, 0.1, hh, 5), HOUSE.post, M(x + sx * a * 1.3 + fx * c * 0.8, hh / 2, z + sz * a * 1.3 + fz * c * 0.8));
  }
  b.add(new THREE.BoxGeometry(2.6, 0.9, 0.8), HOUSE.deck, M(x + fx * 0.6, 0.45, z + fz * 0.6, face));
  const awn = new THREE.BoxGeometry(3.1, 0.08, 2.2);
  b.add(awn, cloth, MX(x, 2.62, z, 1, 1, 1, -0.22, face));
  // Stripes on the awning edge
  b.add(new THREE.BoxGeometry(3.1, 0.3, 0.06), CLOTH[1], MX(x + fx * 1.08, 2.25, z + fz * 1.08, 1, 1, 1, 0, face));
  for (let i = 0; i < 7; i++) {
    const t = (i / 6 - 0.5) * 2.2;
    b.add(new THREE.SphereGeometry(0.16 + r() * 0.06, 7, 5), goods[i % goods.length], M(x + sx * t + fx * 0.6, 1.0, z + sz * t + fz * 0.6));
  }
  b.add(new THREE.CylinderGeometry(0.3, 0.25, 0.4, 8), THATCH, M(x + sx * 1.8 + fx * 0.9, 0.2, z + sz * 1.8 + fz * 0.9));
  hang(ctx, glow, V(x + fx * 1.1, y + 2.2, z + fz * 1.1), 0.8);
  ctx.solids.add(x, z, 1.5);
}

/** Lantern post: a wooden post with a bent neck, hanging a paper lantern */
function lanternPost(ctx: FieldCtx, glow: GlowSet, x: number, z: number, face: number): void {
  const { b } = ctx;
  const y = ctx.place(x, z);
  const fx = Math.sin(face);
  const fz = Math.cos(face);
  b.add(new THREE.CylinderGeometry(0.08, 0.11, 2.4, 6), HOUSE.post, M(x, 1.2, z));
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), HOUSE.post, segM(V(x, 2.3, z), V(x + fx * 0.65, 2.45, z + fz * 0.65), 1));
  hang(ctx, glow, V(x + fx * 0.65, y + 2.42, z + fz * 0.65), 0.9);
  ctx.solids.add(x, z, 0.25);
}

/** Woven-branch low fence: a row of wooden stakes with horizontal branches woven between them */
function wattle(ctx: FieldCtx, pts: [number, number][]): void {
  const { b } = ctx;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [cx, cz] = pts[i + 1];
    const len = Math.hypot(cx - ax, cz - az);
    const n = Math.max(1, Math.round(len / 1.1));
    const ang = Math.atan2(cx - ax, cz - az);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((cx - ax) * k) / n;
      const z = az + ((cz - az) * k) / n;
      ctx.place(x, z);
      b.add(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 5), HOUSE.post, M(x, 0.5, z));
      if (k < n) {
        const mx = x + (cx - ax) / n / 2;
        const mz = z + (cz - az) / n / 2;
        b.add(new THREE.BoxGeometry(0.1, 0.36, len / n), 0x8a6a42, M(mx, 0.62, mz, ang));
      }
      ctx.solids.add(x, z, 0.25);
    }
  }
}

export function buildVillage(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWN;
  const glow = new GlowSet(0xffc86a);
  const ground = ctx.h(tx, tz);

  // ── Four home trees
  const trees: HomeTree[] = [
    { x: -21, z: 64, R: 3.4, H: 42, decks: [7, 15], face: 0 },
    { x: 14, z: 62, R: 3.0, H: 36, decks: [9], face: 0 },
    { x: -12, z: 87, R: 3.2, H: 40, decks: [7.5], face: 0 },
    { x: 18, z: 79, R: 2.6, H: 32, decks: [8.5], face: 0 },
  ];
  for (const t of trees) t.face = Math.atan2(tz - t.z, tx - t.x);
  for (const t of trees) {
    giant(ctx, t.x, t.z, { R: t.R, H: t.H, leaves: [COL.leaf[0], COL.leaf[2], COL.leaf[1]], shelf: false });
    const gy = ctx.h(t.x, t.z);
    t.decks.forEach((dy, i) => {
      b.lift = 0;
      treeHouse(b, glow, t.x, t.z, gy + dy, t.R * (1 - (0.5 * dy) / t.H), t.face + (i ? Math.PI * 0.8 : 0), { ...HOUSE, roof: i ? ROOF2 : HOUSE.roof });
    });
    // Spiral stair: from the ground around to the first platform (entrance facing the plaza)
    b.lift = gy;
    spiralStair(b, t.x, t.z, t.R, t.decks[0], t.face + 0.5, 0.85, HOUSE.deck, HOUSE.post);
    if (t.decks[1]) {
      b.lift = gy + t.decks[0];
      spiralStair(b, t.x, t.z, t.R * 0.9, t.decks[1] - t.decks[0], t.face + 2.2, 0.7, HOUSE.deck, HOUSE.post);
    }
  }
  b.lift = 0;
  // The elder's tree hall (the upper platform of the elder's tree)
  {
    const t = trees[0];
    const gy = ctx.h(t.x, t.z);
    const a = t.face + Math.PI * 0.25;
    const rr = t.R * 0.75 + 2.4;
    roundHall(ctx, glow, t.x + Math.cos(a) * rr, gy + t.decks[1] + 0.16, t.z + Math.sin(a) * rr, 1.5, 2.2, Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI);
  }
  // Acorn houses: hanging from the thick branches of the home trees
  {
    const c = trees[2];
    const gy = ctx.h(c.x, c.z);
    for (const [a, len, hy, py] of [[c.face + 1.4, 7, 17, 12.5], [c.face - 1.5, 6, 15, 11]] as const) {
      const tip = limb(ctx, c.x, c.z, c.R * 0.8, gy + hy, a, len);
      acornPod(ctx, glow, tip, gy + py, Math.atan2(tx - tip.x, tz - tip.z), 1.0);
    }
    const a = trees[0];
    const gA = ctx.h(a.x, a.z);
    const tip = limb(ctx, a.x, a.z, a.R * 0.75, gA + 22, a.face - 1.2, 6.5);
    acornPod(ctx, glow, tip, gA + 18.5, Math.atan2(tx - tip.x, tz - tip.z), 0.9);
  }
  // Aerial walkway: rope bridges between the platforms, hung with lanterns
  const deckEdge = (t: HomeTree, dy: number, to: HomeTree) => {
    const d = Math.hypot(to.x - t.x, to.z - t.z);
    const rr = t.R * (1 - (0.5 * dy) / t.H) + 2.2;
    return V(t.x + ((to.x - t.x) / d) * rr, ctx.h(t.x, t.z) + dy + 0.2, t.z + ((to.z - t.z) / d) * rr);
  };
  const links: [number, number][] = [[0, 2], [2, 3], [3, 1], [1, 0]];
  for (const [i, j] of links) {
    const A = trees[i];
    const B = trees[j];
    const a = deckEdge(A, A.decks[0], B);
    const c = deckEdge(B, B.decks[0], A);
    const hooks = ropeBridge(b, a, c, 1.1 + a.distanceTo(c) * 0.025, HOUSE.deck, 0xc8b48a);
    for (const h of hooks) lantern(b, glow, h, 0.8, HOUSE.post);
  }

  // ── Strings of lanterns between the trees (across the plaza)
  const strings: [number, number, number, number][] = [
    [0, 3, 5.2, 5.6],
    [1, 2, 5.8, 5.0],
  ];
  for (const [i, j, ya, yb] of strings) {
    const A = trees[i];
    const B = trees[j];
    const d = Math.hypot(B.x - A.x, B.z - A.z);
    const ux = (B.x - A.x) / d;
    const uz = (B.z - A.z) / d;
    const pa = V(A.x + ux * A.R * 0.95, ctx.h(A.x, A.z) + ya, A.z + uz * A.R * 0.95);
    const pb = V(B.x - ux * B.R * 0.95, ctx.h(B.x, B.z) + yb, B.z - uz * B.R * 0.95);
    const sag = 1.6;
    rope(b, pa, pb, sag, 0.03, 0xc8b48a, false, 16);
    const n = Math.round(pa.distanceTo(pb) / 2.4);
    for (let k = 1; k < n; k++) {
      const u = k / n;
      const p = pa.clone().lerp(pb, u);
      p.y -= sag * 4 * u * (1 - u);
      lantern(b, glow, p, 0.75, HOUSE.post);
      // Small triangular pennants between the lanterns
      const f = pa.clone().lerp(pb, u + 0.5 / n);
      f.y -= sag * 4 * (u + 0.5 / n) * (1 - u - 0.5 / n);
      b.add(new THREE.ConeGeometry(0.22, 0.5, 3), CLOTH[k % 3], M(f.x, f.y - 0.28, f.z, Math.atan2(ux, uz), 1, Math.PI), false);
    }
  }

  // ── Center of the plaza: the council stump and a ring of stump seats
  {
    const y = ctx.place(tx, tz, 2.6);
    b.lift = y - 0.1;
    b.add(new THREE.CylinderGeometry(2.6, 2.95, 1.0, 20), COL.bark, M(tx, 0.5, tz));
    b.add(new THREE.CylinderGeometry(2.45, 2.45, 0.06, 20), 0xd8b884, M(tx, 1.02, tz));
    for (const rr of [0.7, 1.4, 2.0]) b.add(new THREE.TorusGeometry(rr, 0.04, 3, 28), 0xb08a5a, M(tx, 1.05, tz, 0, 1, Math.PI / 2), false);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      b.add(new THREE.CylinderGeometry(0.5, 0.8, 1.2, 6), COL.bark, M(tx + Math.cos(a) * 2.8, 0.3, tz + Math.sin(a) * 2.8, a, 1, 0, 0.5));
    }
    // Tea set and a lamp on the stump
    b.add(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 8), 0xe8dcc0, M(tx + 0.6, 1.2, tz - 0.3));
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 8), 0xe8dcc0, M(tx - 0.4, 1.12, tz + 0.5));
    hang(ctx, glow, V(tx - 0.8, y - 0.1 + 1.75, tz - 0.6), 0.9);
    ctx.solids.add(tx, tz, 3.0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.5) continue; // Leave the north side for the road
      const x = tx + Math.cos(a) * 4.9;
      const z = tz + Math.sin(a) * 4.9;
      ctx.place(x, z);
      b.add(new THREE.CylinderGeometry(0.42, 0.48, 0.55, 9), COL.bark, M(x, 0.27, z));
      b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 9), 0xd8b884, M(x, 0.56, z));
      ctx.solids.add(x, z, 0.45);
    }
  }

  // ── Market stalls
  stall(ctx, glow, tx - 9.5, tz + 5.5, Math.atan2(9.5, -5.5), CLOTH[0], [0xff6a4a, 0xffc24a, 0x9ad35c]);
  stall(ctx, glow, tx + 9.8, tz + 4.5, Math.atan2(-9.8, -4.5), CLOTH[2], [0xf7c757, 0x46b8a8, 0xff8fb8]);
  stall(ctx, glow, tx + 8.5, tz - 5.5, Math.atan2(-8.5, 5.5), 0x7aa0d8, [0xc84a6a, 0xf2e4c0, 0x8a5a2a]);

  // ── Mushroom garden of the mushroom-picking children (west side): a plot of glowing mushrooms inside a low fence
  {
    const cx = tx - 12.5;
    const cz = tz + 9.5;
    wattle(ctx, [[cx - 2.6, cz - 1.8], [cx + 2.6, cz - 1.8], [cx + 2.6, cz + 1.8], [cx - 2.6, cz + 1.8], [cx - 2.6, cz - 0.6]]);
    for (let i = 0; i < 14; i++) {
      const x = cx + (r() - 0.5) * 4.4;
      const z = cz + (r() - 0.5) * 2.8;
      ctx.place(x, z);
      mushroom(b, x, z, 0.4 + r() * 0.45, SHROOM, r, r() < 0.3);
    }
    // Mushroom-picking basket
    const y = ctx.place(cx + 3.4, cz - 2.6);
    b.add(new THREE.CylinderGeometry(0.4, 0.3, 0.45, 10, 1, true), THATCH, M(cx + 3.4, 0.22, cz - 2.6));
    b.add(new THREE.TorusGeometry(0.34, 0.035, 4, 12, Math.PI), THATCH, M(cx + 3.4, 0.45, cz - 2.6));
    for (let i = 0; i < 3; i++) mushroom(b, cx + 3.4 + (i - 1) * 0.12, cz - 2.6, 0.3, SHROOM, r);
    void y;
  }

  // ── Bamboo-pipe spring: a bamboo pipe leads out of a rock crack and the water falls into a stone basin
  {
    const x = tx + 11.5;
    const z = tz - 0.5;
    ctx.place(x, z, 1.4);
    put(b, new THREE.DodecahedronGeometry(1, 0), COL.rock, MX(x + 0.9, 0.9, z + 0.6, 1.3, 1.4, 1.1, 0.2, 0.6, 0));
    b.add(new THREE.CylinderGeometry(1.0, 1.1, 0.7, 12), 0xa8a492, M(x - 0.6, 0.35, z - 0.2));
    b.add(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 12), 0x6ac8c0, M(x - 0.6, 0.66, z - 0.2), false);
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), 0x9ab85a, segM(V(x + 0.4, 1.5, z + 0.3), V(x - 0.6, 1.25, z - 0.2), 1));
    b.glow(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 4), 0xc8fff4, M(x - 0.62, 0.95, z - 0.22));
    ctx.solids.add(x, z, 1.6);
  }

  // ── Drying racks, crates, firewood piles
  for (const [x, z, a] of [[tx + 5, tz + 11.5, 0.3], [tx - 4, tz + 12.5, -0.2]] as const) {
    ctx.place(x, z, 1.2);
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), HOUSE.post, M(x + Math.cos(a) * s * 1.3, 1.1, z - Math.sin(a) * s * 1.3, a, 1, 0.25, 0));
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), HOUSE.post, M(x + Math.cos(a) * s * 1.3, 1.1, z - Math.sin(a) * s * 1.3, a, 1, -0.25, 0));
    }
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5), HOUSE.post, M(x, 2.2, z, a, 1, 0, Math.PI / 2));
    for (let i = 0; i < 6; i++) {
      const t = (i / 5 - 0.5) * 2.2;
      b.add(new THREE.ConeGeometry(0.16, 0.7, 5), i % 2 ? 0x8aa84a : 0xc8a060, M(x + Math.cos(a) * t, 1.8, z - Math.sin(a) * t, 0, 1, Math.PI), false);
    }
    ctx.solids.add(x, z, 1.3);
  }
  crates(ctx, tx + 12.5, tz + 8.5, 0x9a6a3a, 0x6a4a2a);
  crates(ctx, tx - 13, tz - 3.5, 0x9a6a3a, 0x6a4a2a);
  {
    const x = tx + 6.5;
    const z = tz + 13;
    ctx.place(x, z, 1);
    for (let i = 0; i < 7; i++) b.add(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 7), COL.bark, M(x + (i % 4) * 0.34 - 0.5, 0.18 + Math.floor(i / 4) * 0.3, z, 0, 1, 0, Math.PI / 2));
    ctx.solids.add(x, z, 1.0);
  }

  // ── Lantern posts around the outside of the plaza
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.1;
    const x = tx + Math.cos(a) * 11.8;
    const z = tz + Math.sin(a) * 11.8;
    if (ctx.pathDist(x, z) < 3.4) continue;
    if (ctx.solids.blocked(x, z, 1.2)) continue;
    lanternPost(ctx, glow, x, z, Math.atan2(tx - x, tz - z));
  }

  // ── Vine Gate: two carved wooden posts, a lintel of bent branches, a hanging sign and lanterns
  {
    const gx = tx;
    const gz = tz - 16.2;
    const y = ctx.place(gx, gz, 3);
    for (const s of [-1, 1]) {
      const px = gx + s * 3.3;
      b.add(new THREE.CylinderGeometry(0.34, 0.42, 5.2, 8), COL.trunk, M(px, 2.5, gz));
      for (let k = 0; k < 3; k++) b.add(new THREE.TorusGeometry(0.4, 0.07, 4, 12), ROOF2, M(px, 1.2 + k * 1.3, gz, 0, 1, Math.PI / 2));
      put(b, new THREE.IcosahedronGeometry(1, 1), COL.leaf[0], MX(px, 5.4, gz, 1.0, 0.8, 1.0));
      hang(ctx, glow, V(px - s * 0.2, y + 4.3, gz - 0.5), 1.0);
      ctx.solids.add(px, gz, 0.5);
    }
    b.add(new THREE.TorusGeometry(3.3, 0.24, 6, 18, Math.PI), COL.trunk, M(gx, 4.9, gz));
    for (let k = 0; k < 9; k++) {
      const a = 0.2 + (k / 8) * (Math.PI - 0.4);
      put(b, new THREE.IcosahedronGeometry(1, 0), k % 2 ? COL.leaf[0] : COL.leaf[2], MX(gx + Math.cos(a) * 3.3, 4.9 + Math.sin(a) * 3.3, gz, 0.55, 0.45, 0.55, 0, k), false);
    }
    // Sign
    b.add(new THREE.BoxGeometry(2.2, 0.75, 0.12), 0xb08a5a, M(gx, 6.9, gz - 0.1));
    b.add(new THREE.BoxGeometry(2.4, 0.12, 0.14), HOUSE.post, M(gx, 7.3, gz - 0.1));
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 3), HOUSE.post, M(gx + s * 0.9, 7.5, gz - 0.1), false);
  }

  // ── Woven-branch low fence around the outside of the village (gaps at the north gate and on the east and west sides)
  {
    const R = 17.5;
    const segs: [number, number][] = [];
    const flush = () => {
      if (segs.length > 1) wattle(ctx, segs.splice(0));
      segs.length = 0;
    };
    for (let i = 0; i <= 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      const x = tx + Math.cos(a) * R;
      const z = tz + Math.sin(a) * R;
      const gap = ctx.pathDist(x, z) < 4 || ctx.solids.blocked(x, z, 0.9) || Math.abs(Math.cos(a)) > 0.93;
      if (gap) flush();
      else segs.push([x, z]);
    }
    flush();
  }

  // ── Flower beds, flowering trees, shrubs
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = 12.5 + r() * 3.5;
    const x = tx + Math.cos(a) * d;
    const z = tz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < 3.2 || ctx.solids.blocked(x, z, 1)) continue;
    flowerPatch(ctx, x, z, FLOWERS, 7, 1.6);
  }
  for (const [x, z] of [[tx - 15, tz + 3], [tx + 15.5, tz + 13], [tx - 13, tz - 19], [tx + 14, tz - 18]] as const) {
    if (ctx.solids.blocked(x, z, 2) || ctx.pathDist(x, z) < 4) continue;
    blossomTree(ctx, x, z, 1.15);
  }
  for (const [x, z] of [[tx + 4, tz - 18], [tx - 11, tz - 18], [tx + 16, tz - 9]] as const) if (!ctx.solids.blocked(x, z, 1.2) && ctx.pathDist(x, z) > 3.5) bushAt(ctx, x, z, 1.1);

  // ── After every Seal Tower floor is broken through: Treespeak Village holds a "Sprouting Festival"
  if (ctx.done >= ctx.floors) festival(ctx, trees);

  void ground;
  b.lift = 0;
  const setGlow = glow.build(ctx.group, ctx.disposers);
  ctx.extras.push((_dt, t) => setGlow(2.05 + 0.2 * Math.sin(t * 1.5) + 0.1 * Math.sin(t * 3.7)));
}

/**
 * Sprouting Festival: strings of colorful paper lanterns circle the plaza between the home trees, and the Vine Gate gets
 * garlands and ribbons (appears only after purification; does not use ctx.r, so other placements are not disturbed)
 */
function festival(ctx: FieldCtx, trees: HomeTree[]): void {
  const { b } = ctx;
  const [tx, tz] = TOWN;
  const cols = [0xff6a50, 0xff8ac8, 0xffb040];
  const sets = cols.map((c) => new GlowSet(c));
  const caps = [0xb83a2a, 0xc0487e, 0xc07a1a];
  const ring: [number, number, number, number][] = [
    [0, 1, 4.6, 4.9],
    [1, 3, 4.9, 4.5],
    [3, 2, 4.5, 4.7],
    [2, 0, 4.7, 4.6],
  ];
  b.lift = 0;
  let k = 0;
  for (const [i, j, ya, yb] of ring) {
    const A = trees[i];
    const B = trees[j];
    const d = Math.hypot(B.x - A.x, B.z - A.z);
    const ux = (B.x - A.x) / d;
    const uz = (B.z - A.z) / d;
    const pa = V(A.x + ux * A.R * 0.95, ctx.h(A.x, A.z) + ya, A.z + uz * A.R * 0.95);
    const pb = V(B.x - ux * B.R * 0.95, ctx.h(B.x, B.z) + yb, B.z - uz * B.R * 0.95);
    const sag = 1.4;
    rope(b, pa, pb, sag, 0.03, 0xe8d8b0, false, 16);
    const n = Math.round(pa.distanceTo(pb) / 2.0);
    for (let q = 1; q < n; q++, k++) {
      const u = q / n;
      const p = pa.clone().lerp(pb, u);
      p.y -= sag * 4 * u * (1 - u);
      const c = k % 3;
      // Plump paper lanterns: dark caps top and bottom, the whole lantern body in the middle glowing
      b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 3), caps[c], M(p.x, p.y - 0.12, p.z), false);
      b.add(new THREE.CylinderGeometry(0.12, 0.16, 0.07, 8), caps[c], M(p.x, p.y - 0.26, p.z));
      const body = new THREE.SphereGeometry(0.3, 10, 7);
      body.scale(1, 0.85, 1);
      sets[c].add(body, M(p.x, p.y - 0.54, p.z));
      b.add(new THREE.CylinderGeometry(0.16, 0.12, 0.07, 8), caps[c], M(p.x, p.y - 0.82, p.z));
      b.add(new THREE.BoxGeometry(0.05, 0.36, 0.02), caps[c], M(p.x, p.y - 1.02, p.z), false);
    }
  }
  // Garland on the Vine Gate: a ring of flower balls along the lintel, ribbons hanging down on both sides
  {
    const gx = tx;
    const gz = tz - 16.2;
    const y = ctx.place(gx, gz, 3);
    b.lift = y;
    const fl = [0xff9ac0, 0xfff4f0, 0xffd25a, 0xff7aa0];
    for (let i = 0; i < 17; i++) {
      const a = 0.08 + (i / 16) * (Math.PI - 0.16);
      const g = new THREE.IcosahedronGeometry(0.28 + (i % 3) * 0.05, 1);
      b.add(g, fl[i % 4], M(gx + Math.cos(a) * 3.3, 4.9 + Math.sin(a) * 3.3, gz - 0.3, i, 1, i * 0.7), false);
    }
    for (const s of [-1, 1]) {
      const x = gx + s * 2.2;
      const top = 4.9 + Math.sqrt(3.3 * 3.3 - 2.2 * 2.2);
      for (let m = 0; m < 2; m++) {
        const len = 2.4 + m * 0.6;
        b.add(new THREE.BoxGeometry(0.16, len, 0.02), m ? 0xff8ac8 : 0xffd25a, M(x + m * 0.22 * s, top - len / 2, gz - 0.34, 0, 1, 0, s * 0.05), false);
      }
    }
  }
  b.lift = 0;
  const setters = sets.map((g) => g.build(ctx.group, ctx.disposers));
  ctx.extras.push((_dt, t) => setters.forEach((f, i) => f(1.9 + 0.25 * Math.sin(t * 1.3 + i * 2.1))));
}
