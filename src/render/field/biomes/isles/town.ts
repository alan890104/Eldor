// Lighthouse Harbor: a half-moon-shaped harbor town. To the north are a stone embankment and the Tidebell Gate (the start of
// the boardwalk); at the center of the plaza is the Whale Fountain, surrounded by blue-and-white mosaic paving,
// and beside the plaza are fish stalls, fruit stalls, pottery stalls, open-air café seating and big clay pots planted with
// lemon trees. The houses are Mediterranean-style white-walled houses (houses.ts):
// tile roofs, flat-roof terraces, outer stairs, balconies, bougainvillea, and to the south, facing the plaza, the blue-domed Whale Chapel.
// The inner side of the embankment and the fishing harbor in the west are in port.ts; on the eastern cape are the
// red-and-white lighthouse and the lighthouse keeper's yard.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { lampPost, signpost, type FieldCtx } from '../../kit.ts';
import { ColorBatch, flagGeo, gulls, lighthouseBeam, poolSurface } from './fx.ts';
import { olive, seg, solidPalm, tropicBush } from './flora.ts';
import { BLOOMS, GERANIUM, lowWall, medHouse, PLANK, POT, pottedPlant, STONE, STONE_D, TERRA, whaleChapel, WINDOW, WOOD, WOOD_D, type HouseOpt, type HouseOut } from './houses.ts';
import { Frame, MX, put, putGlow, rod, rope, T, V } from './parts.ts';
import { buildPort } from './port.ts';
import { LIGHTHOUSE, TOWN } from './terrain.ts';

const IRON = 0x3a4050;
const FLOWERS = [0xff5a6a, 0xff9ac0, 0xffd24a, 0xffffff];

export type TownOut = HouseOut;

/** Stall: a counter, four posts, a striped cloth awning with a hanging fringe; kind decides the goods on the counter and hanging under the awning */
function stall(ctx: FieldCtx, x: number, z: number, facing: number, cloth: number, kind: 'fish' | 'fruit' | 'pots' | 'shells' = 'fish'): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 1.2);
  b.lift = 0;
  const F = new Frame(x, y, z, facing);
  put(b, T.box, WOOD, F.L(0, 0.45, 0.2, 2.6, 0.9, 1.0));
  put(b, T.box, kind === 'fish' ? 0xdfe8ee : PLANK, F.L(0, 0.93, 0.2, 2.7, 0.08, 1.1));
  for (let i = 0; i < 3; i++) put(b, T.box, WOOD_D, F.L(-0.9 + i * 0.9, 0.45, 0.71, 0.06, 0.8, 0.02), false);
  for (const sx of [-1.25, 1.25]) for (const sz of [-0.7, 0.8]) put(b, T.cyl6, WOOD_D, F.L(sx, 1.2, sz, 0.06, 2.4, 0.06));
  for (let i = 0; i < 6; i++) {
    const g = F.L(-1.45 + (i + 0.5) * (2.9 / 6), 2.45, 0.1, 2.9 / 6, 0.06, 1.9, -0.18);
    put(b, T.box, i % 2 ? 0xffffff : cloth, g, false);
    put(b, T.cone4, i % 2 ? 0xffffff : cloth, F.L(-1.45 + (i + 0.5) * (2.9 / 6), 2.13, 1.05, 0.22, 0.3, 0.06, Math.PI), false);
  }
  const top = (gx: number, gz: number) => F.L(gx, 1.05, gz);
  if (kind === 'fish') {
    const fish = [0xb8c8d8, 0x6a9ac8, 0xff8a5a, 0xd8c070];
    for (let i = 0; i < 6; i++) put(b, T.oct, fish[i % 4], F.L(-1.0 + i * 0.4, 1.02, 0.25 + (r() - 0.5) * 0.3, 0.38, 0.1, 0.16, 0, r() * 0.4), false);
    // Crushed ice
    for (let i = 0; i < 8; i++) put(b, T.ico0, 0xeaf6fc, F.L(-1.1 + r() * 2.2, 0.99, 0.1 + r() * 0.5, 0.08, 0.05, 0.08, 0, r() * 6), false);
    // Dried fish hanging under the awning
    for (let i = 0; i < 5; i++) put(b, T.oct, 0xc8a878, F.L(-1.0 + i * 0.5, 1.85, 0.75, 0.08, 0.3, 0.12), false);
  } else if (kind === 'fruit') {
    const fr = [0xffa030, 0xffe04a, 0x6ac84a, 0xe8443a];
    for (let i = 0; i < 14; i++) put(b, T.sphere, fr[i % 4], top(-1.1 + (i % 7) * 0.36, 0.05 + Math.floor(i / 7) * 0.35), false);
    // Watermelons and hanging bunches of bananas
    for (const gx of [-0.6, 0.6]) put(b, T.sphere12, 0x3a8a3a, F.L(gx, 0.3, 1.0, 0.3, 0.26, 0.3));
    for (let i = 0; i < 3; i++) put(b, T.cyl5, 0xf0d040, F.L(-0.8 + i * 0.8, 1.9, 0.8, 0.12, 0.35, 0.12), false);
  } else if (kind === 'pots') {
    const pc = [TERRA, 0x3a78c8, 0xf2e6cc, 0x2a9a8a];
    for (let i = 0; i < 6; i++) {
      put(b, T.taper8, pc[i % 4], F.L(-1.0 + i * 0.4, 1.2, 0.2, 0.14, 0.45, 0.14));
      put(b, T.cyl8, pc[i % 4], F.L(-1.0 + i * 0.4, 1.46, 0.2, 0.08, 0.1, 0.08), false);
    }
    for (const gx of [-1.6, 1.7]) put(b, T.taper8, TERRA, F.L(gx, 0.45, 0.9, 0.3, 0.9, 0.3));
    for (let i = 0; i < 3; i++) put(b, T.pot, 0xc8a870, F.L(-0.8 + i * 0.8, 1.75, 0.8, 0.18, 0.25, 0.18), false);
  } else {
    for (let i = 0; i < 12; i++) put(b, T.dome, [0xfff1e2, 0xffd8c8, 0xf7c0a0, 0xe8d0f0][i % 4], F.L(-1.1 + (i % 6) * 0.44, 0.97, 0.05 + Math.floor(i / 6) * 0.4, 0.14, 0.1, 0.18, 0, r() * 6), false);
    for (let i = 0; i < 6; i++) put(b, T.sphere, i % 2 ? 0xffffff : 0xfff0d0, F.L(-1.0 + i * 0.4, 1.9, 0.8, 0.07, 0.07, 0.07), false);
  }
  // A small wooden sign and the basket beside it
  put(b, T.box, PLANK, F.L(1.05, 1.25, 0.72, 0.5, 0.36, 0.04));
  put(b, T.pot, 0xb89060, F.L(1.6, 0.23, 0.6, 0.35, 0.45, 0.35));
  put(b, T.cyl8, kind === 'fish' ? 0x6a9ac8 : kind === 'fruit' ? 0xffa030 : 0xd8c8a8, F.L(1.6, 0.47, 0.6, 0.3, 0.05, 0.3), false);
  ctx.solids.add(x, z, 1.5);
}


// ───────────────────────── Little things on the plaza ─────────────────────────

/** Open-air café seating: a round table, two or three chairs, a striped parasol */
function cafeTable(ctx: FieldCtx, x: number, z: number, cloth: number): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 0.8);
  b.lift = 0;
  const F = new Frame(x, y, z, r() * 6);
  put(b, T.cyl12, 0xf8f6f0, F.L(0, 0.76, 0, 0.5, 0.06, 0.5));
  put(b, T.cyl5, IRON, F.L(0, 0.38, 0, 0.05, 0.76, 0.05), false);
  put(b, T.cyl8, IRON, F.L(0, 0.03, 0, 0.26, 0.06, 0.26), false);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const C = F.sub(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85, a + Math.PI);
    put(b, T.box, cloth === 0xe8443a ? 0x2f7ab8 : 0xe8e0d0, C.L(0, 0.44, 0, 0.42, 0.06, 0.42));
    put(b, T.box, cloth === 0xe8443a ? 0x2f7ab8 : 0xe8e0d0, C.L(0, 0.72, -0.19, 0.42, 0.5, 0.05));
    for (const sx of [-0.17, 0.17]) for (const sz of [-0.17, 0.17]) put(b, T.box, IRON, C.L(sx, 0.21, sz, 0.035, 0.42, 0.035), false);
  }
  // Parasol: ribs, canopy, white rib lines and a top finial
  put(b, T.cyl5, WOOD_D, F.L(0, 1.35, 0, 0.035, 2.1, 0.035), false);
  put(b, T.cone8, cloth, F.L(0, 2.45, 0, 1.4, 0.5, 1.4));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    put(b, T.box, 0xffffff, F.L(Math.sin(a) * 0.7, 2.45, Math.cos(a) * 0.7, 0.05, 0.03, 1.48, Math.atan2(0.5, 1.4), a), false);
  }
  put(b, T.sphere, 0xf8f6f0, F.L(0, 2.74, 0, 0.08, 0.08, 0.08), false);
  // On the table: a water bottle and two cups
  put(b, T.taper8, 0x6ac0d8, F.L(0.1, 0.9, 0.05, 0.07, 0.22, 0.07), false);
  put(b, T.cyl8, 0xffffff, F.L(-0.18, 0.84, -0.1, 0.05, 0.1, 0.05), false);
  ctx.solids.add(x, z, 1.0);
}

/** A lemon tree in a clay pot */
function lemonPlanter(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 0.8);
  b.lift = 0;
  put(b, T.pot, POT, MX(x, y + 0.42, z, 0.62, 0.84, 0.62));
  put(b, T.ring, 0xb8603a, MX(x, y + 0.84, z, 0.6, 0.6, 0.6, Math.PI / 2));
  put(b, T.cyl8, 0x7a5a38, MX(x, y + 0.84, z, 0.56, 0.04, 0.56), false);
  put(b, T.taper8, 0x8a6a48, MX(x, y + 1.35, z, 0.08, 1.1, 0.08));
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    put(b, T.ico1, i % 2 ? 0x3f8a3a : 0x2f7a34, MX(x + Math.cos(a) * 0.35, y + 2.0 + r() * 0.35, z + Math.sin(a) * 0.35, 0.7, 0.6, 0.7, 0, r() * 6));
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const rr = 0.55 + r() * 0.35;
    put(b, T.sphere, 0xffe04a, MX(x + Math.cos(a) * rr, y + 1.75 + r() * 0.7, z + Math.sin(a) * rr, 0.1, 0.12, 0.1), false);
  }
  ctx.solids.add(x, z, 0.75);
}

/**
 * A whale tail on a stone stele: a signpost where the harbor folk worship the Sacred Whale, with shells and small candles at the foot of the stele
 */
export function whaleStele(ctx: FieldCtx, x: number, z: number, face: number, out: TownOut): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 0.6);
  b.lift = 0;
  const F = new Frame(x, y, z, face);
  put(b, T.box, STONE_D, F.L(0, 0.15, 0, 0.9, 0.5, 0.9));
  put(b, T.box, 0xe4dccb, F.L(0, 1.0, 0, 0.45, 1.3, 0.4));
  put(b, T.cyl6, 0xe4dccb, F.L(0, 1.8, 0, 0.14, 0.4, 0.14));
  for (const s of [-1, 1]) put(b, T.sphere, 0xe4dccb, F.L(s * 0.34, 2.12, 0, 0.44, 0.1, 0.18, 0, 0, s * 0.5));
  // Wave carvings on the stele face (pale blue)
  for (let i = 0; i < 3; i++) put(b, T.box, 0x6aa8d8, F.L(0, 0.75 + i * 0.25, 0.21, 0.3, 0.05, 0.02), false);
  for (let i = 0; i < 3; i++) put(b, T.dome, [0xfff1e2, 0xffd8c8, 0xf7c0a0][i], F.L(-0.25 + i * 0.25, 0.4, 0.5 + r() * 0.1, 0.09, 0.06, 0.12, 0, r() * 6), false);
  put(b, T.cyl6, 0xfff4e0, F.L(0.3, 0.5, 0.3, 0.04, 0.16, 0.04), false);
  putGlow(b, T.sphere, 0xffc86a, F.L(0.3, 0.62, 0.3, 0.04, 0.05, 0.04));
  const p = F.p(0.3, 0.62, 0.3);
  out.lights.push([p.x, p.y, p.z, 0.6]);
  ctx.solids.add(x, z, 0.55);
}

/** A cat sleeping on the steps */
function cat(ctx: FieldCtx, x: number, y: number, z: number, face: number, col: number): void {
  const { b } = ctx;
  const F = new Frame(x, y, z, face);
  put(b, T.sphere, col, F.L(0, 0.13, 0, 0.2, 0.14, 0.3));
  put(b, T.sphere, col, F.L(0, 0.2, 0.28, 0.13, 0.12, 0.12));
  for (const s of [-1, 1]) put(b, T.cone4, col, F.L(s * 0.07, 0.32, 0.29, 0.04, 0.09, 0.04), false);
  put(b, T.sphere, col === 0x2a2a30 ? 0xffffff : 0xf8e0c0, F.L(0, 0.16, 0.36, 0.06, 0.05, 0.04), false);
  rod(b, F.p(0.08, 0.08, -0.26), F.p(0.3, 0.06, -0.1), 0.035, col, T.cyl4, false);
}

/** A flock of pigeons pecking on the ground (gray and white) */
function pigeons(ctx: FieldCtx, x: number, z: number, n: number): void {
  const { b, r } = ctx;
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 2.4;
    const pz = z + (r() - 0.5) * 2.4;
    const y = ctx.h(px, pz);
    const F = new Frame(px, y, pz, r() * 6);
    const col = r() < 0.7 ? 0x9aa4b8 : 0xf0f0f4;
    const peck = r() < 0.4;
    put(b, T.sphere, col, F.L(0, 0.12, 0, 0.09, 0.08, 0.14), false);
    put(b, T.sphere, 0x7a8498, F.L(0, peck ? 0.06 : 0.2, peck ? 0.15 : 0.1, 0.055, 0.055, 0.055), false);
    put(b, T.cone4, 0xe8a040, F.L(0, peck ? 0.04 : 0.2, peck ? 0.2 : 0.16, 0.015, 0.05, 0.015, Math.PI / 2), false);
  }
}

/** Standing seagulls (on the mooring posts of the embankment, on roof ridges) */
export function perchedGull(ctx: FieldCtx, x: number, y: number, z: number, face: number): void {
  const { b } = ctx;
  const F = new Frame(x, y, z, face);
  put(b, T.sphere, 0xf8f8fc, F.L(0, 0.22, 0, 0.13, 0.13, 0.26), false);
  for (const s of [-1, 1]) put(b, T.sphere, 0x9aa8b8, F.L(s * 0.1, 0.25, -0.05, 0.05, 0.08, 0.24), false);
  put(b, T.sphere, 0xf8f8fc, F.L(0, 0.38, 0.18, 0.09, 0.09, 0.1), false);
  put(b, T.cone4, 0xf0c030, F.L(0, 0.37, 0.3, 0.025, 0.1, 0.025, Math.PI / 2), false);
  for (const s of [-1, 1]) put(b, T.cyl4, 0xe89a40, F.L(s * 0.05, 0.06, 0, 0.012, 0.14, 0.012), false);
}

/** Clothesline: a rope between a and c hung with a few clothes that flutter */
export function laundry(ctx: FieldCtx, a: THREE.Vector3, c: THREE.Vector3, out: TownOut, n = 5): void {
  const { b, r } = ctx;
  rope(b, a, c, 0.25, 0.015, 0xe8e0d0, 6);
  const ang = Math.atan2(c.x - a.x, c.z - a.z) - Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.7) / (n + 0.4);
    const p = a.clone().lerp(c, t);
    p.y -= Math.sin(t * Math.PI) * 0.25;
    const big = r() < 0.4;
    out.flags.push(flagGeo(big ? 0.9 : 0.5, big ? 0.7 : 0.6, [0xffffff, 0x6ab0e8, 0xffd0a0, 0xe86a6a, 0xa0d890, 0xf0e070][Math.floor(r() * 6)], true, false, MX(p.x, p.y, p.z, 1, 1, 1, 0, ang + Math.PI / 2)));
  }
}

/**
 * The yard behind a house: a U-shaped low wall, an olive or lemon tree, a water jar, a woodpile;
 * if the wall would touch a road or another house, it is not built
 */
function backyard(ctx: FieldCtx, F: Frame, w: number, d: number, out: TownOut): void {
  const { b, r } = ctx;
  const yd = 3.2;
  const corners = [F.p(-w / 2 - 0.2, 0, -d / 2), F.p(-w / 2 - 0.2, 0, -d / 2 - yd), F.p(w / 2 + 0.2, 0, -d / 2 - yd), F.p(w / 2 + 0.2, 0, -d / 2)];
  const ok = (p: THREE.Vector3) => ctx.pathDist(p.x, p.z) > 3.2 && ctx.h(p.x, p.z) > 0.6;
  const mid = F.p(0, 0, -d / 2 - yd * 0.55);
  if (!ok(mid) || ctx.solids.blocked(mid.x, mid.z, 1.2)) return;
  for (let i = 0; i < 3; i++) {
    const a = corners[i];
    const c = corners[i + 1];
    const m = a.clone().lerp(c, 0.5);
    if (!ok(a) || !ok(c) || !ok(m)) continue;
    // Leave a gap in the middle of the back wall as a back door
    if (i === 1) {
      lowWall(ctx, [a.x, a.z], [a.x + (c.x - a.x) * 0.4, a.z + (c.z - a.z) * 0.4], 0xf4efe4, 0xe2d8c2);
      lowWall(ctx, [a.x + (c.x - a.x) * 0.6, a.z + (c.z - a.z) * 0.6], [c.x, c.z], 0xf4efe4, 0xe2d8c2);
    } else lowWall(ctx, [a.x, a.z], [c.x, c.z], 0xf4efe4, 0xe2d8c2);
  }
  b.lift = 0;
  // In the yard: a tree, a water jar, a woodpile or a chicken coop
  const tp = F.p(-w * 0.25, 0, -d / 2 - yd * 0.5);
  if (r() < 0.55) olive(b, tp.x, tp.z, ctx.h(tp.x, tp.z), 0.8 + r() * 0.3, r);
  else {
    const y = ctx.h(tp.x, tp.z);
    put(b, T.taper8, 0x8a6a48, MX(tp.x, y + 0.7, tp.z, 0.09, 1.4, 0.09));
    put(b, T.ico1, 0x2f7a34, MX(tp.x, y + 1.7, tp.z, 0.85, 0.75, 0.85, 0, r() * 6));
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2;
      put(b, T.sphere, 0xffe04a, MX(tp.x + Math.cos(a) * 0.7, y + 1.5 + r() * 0.6, tp.z + Math.sin(a) * 0.7, 0.09, 0.11, 0.09), false);
    }
  }
  ctx.solids.add(tp.x, tp.z, 0.5);
  const jp = F.p(w * 0.25, 0, -d / 2 - 0.7);
  const jy = ctx.h(jp.x, jp.z);
  for (let i = 0; i < 3; i++) {
    put(b, T.taper8, [TERRA, 0xd88a5a, TERRA][i], MX(jp.x + (i - 1) * 0.45, jy + 0.35, jp.z, 0.2, 0.7, 0.2));
    put(b, T.cyl8, 0xb8603a, MX(jp.x + (i - 1) * 0.45, jy + 0.74, jp.z, 0.1, 0.1, 0.1), false);
  }
  const wp = F.p(w * 0.3, 0, -d / 2 - yd + 0.6);
  const wy = ctx.h(wp.x, wp.z);
  if (r() < 0.5) {
    for (let i = 0; i < 6; i++) put(b, T.cyl6, 0xa07a4c, MX(wp.x, wy + 0.12 + Math.floor(i / 3) * 0.22, wp.z + ((i % 3) - 1) * 0.22, 0.1, 1.0, 0.1, 0, F.face, Math.PI / 2), false);
  } else {
    // The chicken coop and two chickens
    const C = new Frame(wp.x, wy, wp.z, F.face);
    put(b, T.box, WOOD, C.L(0, 0.45, 0, 1.0, 0.7, 0.7));
    put(b, T.prism, TERRA, C.L(0, 0.8, 0, 1.2, 0.35, 0.9));
    put(b, T.box, 0x3a2a1c, C.L(0, 0.4, 0.36, 0.3, 0.3, 0.02), false);
    for (const s of [-1, 1]) {
      const q = C.p(s * 0.7, 0, 0.8);
      put(b, T.sphere, 0xf8f4ea, MX(q.x, wy + 0.18, q.z, 0.12, 0.12, 0.16, 0, r() * 6), false);
      put(b, T.cone4, 0xe8443a, MX(q.x, wy + 0.33, q.z, 0.03, 0.07, 0.05), false);
    }
  }
  void out;
}

// ───────────────────────── Lighthouse ─────────────────────────


/**
 * Whale Fountain: a round pool, with a whale statue leaping out of the water at the center (tail toward the sky); returns the position of the spout
 */
function fountain(ctx: FieldCtx, x: number, z: number): THREE.Vector3 {
  const { b } = ctx;
  const y0 = ctx.place(x, z, 3);
  const R = 3.2;
  b.add(new THREE.CylinderGeometry(R + 0.35, R + 0.55, 0.8, 24), STONE, M(x, 0.4, z));
  b.add(new THREE.TorusGeometry(R + 0.2, 0.22, 6, 28), STONE_D, M(x, 0.82, z, 0, 1, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(R, R, 0.1, 24), 0x3a8aa8, M(x, 0.55, z), false);
  // Base: a ring of wave carving
  b.add(new THREE.CylinderGeometry(0.9, 1.3, 1.4, 10), STONE_D, M(x, 1.1, z));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(new THREE.SphereGeometry(0.45, 8, 6), 0xe4eef4, M(x + Math.cos(a) * 1.1, 1.3, z + Math.sin(a) * 1.1, 0, 1).multiply(new THREE.Matrix4().makeScale(1, 0.6, 1)));
  }
  // Whale: the body slanting upward, the head up and the tail flicked up below
  const WH = 0x8fb4cc;
  const WB = 0xe8f0f4;
  const body = new THREE.SphereGeometry(1, 14, 10);
  body.scale(0.95, 0.9, 2.2);
  const tilt = -0.95;
  const bm = new THREE.Matrix4().compose(new THREE.Vector3(x, 3.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0.4, 0)), new THREE.Vector3(1, 1, 1));
  b.add(body, WH, bm);
  const belly = new THREE.SphereGeometry(1, 12, 8);
  belly.scale(0.75, 0.55, 1.9);
  b.add(belly, WB, bm.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.42, 0.1)));
  // Pectoral fins
  for (const s of [-1, 1]) {
    const fin = new THREE.SphereGeometry(1, 8, 6);
    fin.scale(0.9, 0.1, 0.35);
    b.add(fin, WH, bm.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(s * 1.0, -0.35, 0.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.5, s * -0.5)), new THREE.Vector3(1, 1, 1))));
  }
  // Tail stock and flukes
  const stem = new THREE.CylinderGeometry(0.35, 0.6, 1.6, 10);
  stem.rotateX(Math.PI / 2);
  b.add(stem, WH, bm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -2.6)));
  for (const s of [-1, 1]) {
    const fl = new THREE.SphereGeometry(1, 8, 6);
    fl.scale(1.1, 0.1, 0.45);
    b.add(fl, WH, bm.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(s * 0.8, 0, -3.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.45, 0)), new THREE.Vector3(1, 1, 1))));
  }
  // Eyes
  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.1, 6, 5), 0x1b2a3a, bm.clone().multiply(new THREE.Matrix4().makeTranslation(s * 0.78, 0.05, 1.5)), false);
  poolSurface(ctx, x, y0 + 0.72, z, R - 0.05, 0x7ae0e8, 0x3aa0c8, 0.15);
  ctx.solids.add(x, z, R + 0.5);
  b.lift = 0;
  const spout = new THREE.Vector3(0, 0.95, 1.2).applyMatrix4(bm);
  spout.y += y0;
  return spout;
}


/** Fishing boat (vertex colors, the whole boat as one mesh): hull, gunwale, thwarts, mast, sail and a small flag */
export function boat(cb: ColorBatch, hull: number, sail: number, s = 1): void {
  const shape = (k: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 1.95 * k);
    sh.quadraticCurveTo(0.9 * k, 1.0 * k, 0.82 * k, -0.2 * k);
    sh.quadraticCurveTo(0.8 * k, -1.3 * k, 0.45 * k, -1.6 * k);
    sh.lineTo(-0.45 * k, -1.6 * k);
    sh.quadraticCurveTo(-0.8 * k, -1.3 * k, -0.82 * k, -0.2 * k);
    sh.quadraticCurveTo(-0.9 * k, 1.0 * k, 0, 1.95 * k);
    return sh;
  };
  const S = new THREE.Matrix4().makeScale(s, s, s);
  const at = (m: THREE.Matrix4) => S.clone().multiply(m);
  const hullG = new THREE.ExtrudeGeometry(shape(1), { depth: 0.75, bevelEnabled: false, curveSegments: 6 });
  hullG.rotateX(Math.PI / 2);
  cb.add(hullG, hull, at(M(0, 0.55, 0)));
  const rim = new THREE.ExtrudeGeometry(shape(1.07), { depth: 0.14, bevelEnabled: false, curveSegments: 6 });
  rim.rotateX(Math.PI / 2);
  cb.add(rim, PLANK, at(M(0, 0.69, 0)));
  const inner = new THREE.ExtrudeGeometry(shape(0.8), { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
  inner.rotateX(Math.PI / 2);
  cb.add(inner, 0x5a3a24, at(M(0, 0.6, 0)));
  cb.add(new THREE.BoxGeometry(1.3, 0.08, 0.26), PLANK, at(M(0, 0.65, 0.55)));
  cb.add(new THREE.BoxGeometry(1.1, 0.08, 0.26), PLANK, at(M(0, 0.65, -0.7)));
  cb.add(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6), 0x8a6440, at(M(0, 2.1, 0.1)));
  cb.add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 5), 0x8a6440, at(M(0, 1.15, -0.75, 0, 1, Math.PI / 2)));
  const sl = new THREE.Shape();
  sl.moveTo(0.05, 1.2);
  sl.lineTo(0.05, 3.55);
  sl.quadraticCurveTo(-0.5, 2.3, -1.6, 1.25);
  sl.lineTo(0.05, 1.2);
  const sg = new THREE.ExtrudeGeometry(sl, { depth: 0.04, bevelEnabled: false, curveSegments: 5 });
  sg.rotateY(Math.PI / 2);
  cb.add(sg, sail, at(M(0, 0, 0)));
  const fl = new THREE.Shape();
  fl.moveTo(0, 0);
  fl.lineTo(0, 0.3);
  fl.lineTo(-0.55, 0.15);
  fl.lineTo(0, 0);
  const fg = new THREE.ExtrudeGeometry(fl, { depth: 0.03, bevelEnabled: false });
  fg.rotateY(Math.PI / 2);
  cb.add(fg, 0xe8443a, at(M(0, 3.45, 0.1)));
}

/** A boat that rocks on the water (one group per boat) */
export function mooredBoat(ctx: FieldCtx, x: number, z: number, heading: number, hull: number, sail: number, s: number): void {
  const cb = new ColorBatch();
  boat(cb, hull, sail, s);
  const { group, tick } = cb.build(ctx.group, ctx.disposers, 0.05);
  group.position.set(x, ctx.waterLevel - 0.12, z);
  group.rotation.y = heading;
  const ph = ctx.r() * 6;
  ctx.extras.push((_dt, t) => {
    tick(t);
    group.position.y = ctx.waterLevel - 0.12 + Math.sin(t * 1.3 + ph) * 0.07;
    group.rotation.x = Math.sin(t * 0.9 + ph) * 0.03;
    group.rotation.z = Math.sin(t * 1.1 + ph * 1.3) * 0.05;
  });
}

/** The deck, piles and mooring posts of a wooden pier (along the sample points, with the deck height taken from the ground) */
export function deckAlong(ctx: FieldCtx, pts: [number, number][], width: number, opts: { rail?: boolean; lamps?: number; snow?: number } = {}): [number, number, number][] {
  const { b } = ctx;
  const lamps: [number, number, number][] = [];
  const dense: THREE.Vector3[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.55));
    for (let k = 0; k < n; k++) dense.push(new THREE.Vector3(ax + ((bx - ax) * k) / n, 0, az + ((bz - az) * k) / n));
  }
  const last = pts[pts.length - 1];
  dense.push(new THREE.Vector3(last[0], 0, last[1]));
  b.lift = 0;
  let acc = 0;
  let nextPost = 0;
  const railPts: THREE.Vector3[][] = [[], []];
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i];
    const q = dense[Math.min(dense.length - 1, i + 1)];
    const o = dense[Math.max(0, i - 1)];
    const dx = q.x - o.x;
    const dz = q.z - o.z;
    const l = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(dx, dz);
    const y = ctx.h(p.x, p.z) + 0.07;
    const pitch = -Math.atan2(ctx.h(q.x, q.z) - ctx.h(o.x, o.z), l);
    if (i > 0) acc += p.distanceTo(dense[i - 1]);
    const col = opts.snow && i % 5 === 2 ? 0xe8f0f8 : i % 7 === 3 ? 0xb48656 : PLANK;
    b.add(new THREE.BoxGeometry(width, 0.12, 0.5), col, new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    const nx = Math.cos(yaw);
    const nz = -Math.sin(yaw);
    if (acc >= nextPost) {
      nextPost += 2.2;
      const wet = ctx.h(p.x + nx * (width / 2 + 0.5), p.z + nz * (width / 2 + 0.5)) < 0.1;
      for (const s of [-1, 1]) {
        const px = p.x + nx * s * (width / 2 + 0.05);
        const pz = p.z + nz * s * (width / 2 + 0.05);
        // Piles: from the seabed up to the deck (railing posts go higher still)
        if (wet) b.add(new THREE.CylinderGeometry(0.14, 0.17, y + 4.5, 6), WOOD_D, M(px, (y - 4.5) / 2, pz));
        if (opts.rail) {
          b.add(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 5), WOOD, M(px, y + 0.55, pz));
          railPts[s < 0 ? 0 : 1].push(new THREE.Vector3(px, y + 1.02, pz));
          ctx.solids.add(px, pz, 0.28);
        }
      }
      if (opts.lamps && Math.round(acc / 2.2) % opts.lamps === Math.floor(opts.lamps / 2)) lamps.push([p.x + nx * (width / 2 + 0.05), y, p.z + nz * (width / 2 + 0.05)]);
    }
  }
  if (opts.rail) {
    for (const rp of railPts) for (let i = 0; i + 1 < rp.length; i++) seg(b, rp[i], rp[i + 1], 0.04, 0xd8c090, 4, false);
  }
  return lamps;
}


/**
 * Lighthouse: a stone platform, a red-and-white striped shaft, a balcony railing, the lamp room and a red dome;
 * beside it is the lighthouse keeper's small house; returns the lamp room position
 */
function lighthouse(ctx: FieldCtx, x: number, z: number, out: TownOut): THREE.Vector3 {
  const { b, r } = ctx;
  const y0 = ctx.place(x, z, 4);
  b.add(new THREE.CylinderGeometry(4.2, 4.8, 1.2, 12), STONE_D, M(x, 0.3, z));
  b.add(new THREE.CylinderGeometry(3.3, 3.6, 1.6, 12), 0xb4b8c4, M(x, 1.7, z));
  const H = 2.8;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const r0 = 2.9 - i * 0.2;
    b.add(new THREE.CylinderGeometry(r0 - 0.2, r0, H, 14), i % 2 ? 0xe8443a : 0xf8f4ee, M(x, 2.5 + H * i + H / 2, z));
  }
  // Small windows on the shaft
  for (let i = 1; i < n; i += 2) {
    const a = 0.6 + i;
    const rr = 2.9 - i * 0.2 - 0.05;
    b.glow(new THREE.BoxGeometry(0.1, 0.7, 0.45), WINDOW, M(x + Math.cos(a) * rr, 2.5 + H * i + H / 2, z - Math.sin(a) * rr, a));
  }
  const top = 2.5 + H * n;
  b.add(new THREE.CylinderGeometry(2.6, 1.8, 0.6, 14), 0x3a4050, M(x, top + 0.3, z));
  b.add(new THREE.TorusGeometry(2.45, 0.08, 6, 28), 0x3a4050, M(x, top + 1.5, z, 0, 1, Math.PI / 2));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 4), 0x3a4050, M(x + Math.cos(a) * 2.45, top + 1.05, z + Math.sin(a) * 2.45));
  }
  const lantern = new THREE.Vector3(x, y0 + top + 1.6, z);
  b.glow(new THREE.CylinderGeometry(1.5, 1.5, 2.0, 12), 0xffe08a, M(x, top + 1.6, z));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.14, 2.1, 0.14), 0x3a4050, M(x + Math.cos(a) * 1.55, top + 1.6, z + Math.sin(a) * 1.55));
  }
  b.add(new THREE.ConeGeometry(2.1, 1.8, 14), 0xe8443a, M(x, top + 3.5, z));
  b.add(new THREE.SphereGeometry(0.28, 8, 6), 0xffd870, M(x, top + 4.55, z));
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 4), 0x3a4050, M(x, top + 5.6, z));
  out.flags.push(flagGeo(2.2, 0.9, 0xe8443a, false, true, M(x, y0 + top + 6.4, z, 0.9)));
  // Door
  b.add(new THREE.BoxGeometry(1.2, 2.0, 0.2), 0x6a4630, M(x - 3.0, 3.3, z + 0.6, -Math.PI / 2 + 0.2));
  ctx.solids.add(x, z, 4.4);
  // The lighthouse keeper's small house: on the plateau to the southeast of the lighthouse, with the door facing the town
  b.lift = 0;
  {
    const hx = x + 3.6;
    const hz = z + 6.2;
    const hy = ctx.place(hx, hz, 2.1);
    // Collision keeps the original single circle (a gap must be left between the lighthouse and the small house for the path to the chest)
    medHouse(ctx, new Frame(hx, hy, hz, -2.0), { w: 4.2, d: 3.6, h: 2.7, floors: 1, roof: 'gable', wall: 0xf7f2e8, trim: 0xc0443a, band: 0xc0443a, chimney: true, lit: 0.6, noSolid: true }, out);
    ctx.solids.add(hx, hz, 4.2 * 0.6);
  }
  lighthouseGrounds(ctx, x, z, y0, out);
  ctx.place(x, z);
  // Wooden fence at the cape's edge: a ring along the cliff edge (not on the gentle-slope side facing the town)
  const edge: (THREE.Vector3 | null)[] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let found: THREE.Vector3 | null = null;
    // The west is the path coming up, so no fence
    if (ca < -0.55) {
      edge.push(null);
      continue;
    }
    for (let rr = 5.2; rr < 14; rr += 0.3) {
      const hh = ctx.h(x + ca * rr, z + sa * rr);
      if (hh < y0 - 1.2) {
        const re = rr - 1.0;
        const px = x + ca * re;
        const pz = z + sa * re;
        const hp = ctx.h(px, pz);
        if (hp > y0 - 0.7 && ctx.pathDist(px, pz) > 2.6) found = new THREE.Vector3(px, hp, pz);
        break;
      }
    }
    edge.push(found);
  }
  for (let i = 0; i < N; i++) {
    const p = edge[i];
    if (!p) continue;
    b.lift = p.y;
    b.add(new THREE.BoxGeometry(0.14, 1.0, 0.14), WOOD, M(p.x, 0.5, p.z));
    ctx.solids.add(p.x, p.z, 0.35);
    const q = edge[(i + 1) % N];
    if (q && p.distanceTo(q) < 4.5) {
      b.lift = 0;
      seg(b, new THREE.Vector3(p.x, p.y + 0.8, p.z), new THREE.Vector3(q.x, q.y + 0.8, q.z), 0.04, WOOD, 4);
      seg(b, new THREE.Vector3(p.x, p.y + 0.4, p.z), new THREE.Vector3(q.x, q.y + 0.4, q.z), 0.035, WOOD, 4);
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    ctx.place(x + Math.cos(a) * 5.5, z + Math.sin(a) * 5.5);
    if (!ctx.solids.blocked(x + Math.cos(a) * 5.5, z + Math.sin(a) * 5.5, 0.6)) tropicBush(ctx, x + Math.cos(a) * 5.5, z + Math.sin(a) * 5.5, 0.9, FLOWERS[i % 4]);
  }
  b.lift = 0;
  return lantern;
}
/**
 * The lighthouse yard: stone steps going uphill, oil barrels and firewood, a telescope bench, a vegetable plot,
 * a clothesline, and seagulls circling the tower top
 */
function lighthouseGrounds(ctx: FieldCtx, x: number, z: number, y0: number, out: TownOut): void {
  const { b, r } = ctx;
  b.lift = 0;
  // Stone steps on the path: flat stone slabs one by one along the trail to the lighthouse
  const trail: [number, number][] = [[26, 71.5], [34, 68], [39.5, 66.5]];
  for (let i = 0; i + 1 < trail.length; i++) {
    const [ax, az] = trail[i];
    const [cx, cz] = trail[i + 1];
    const len = Math.hypot(cx - ax, cz - az);
    const n = Math.round(len / 0.9);
    const ang = Math.atan2(cx - ax, cz - az);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const px = ax + (cx - ax) * t + Math.cos(ang) * (r() - 0.5) * 0.4;
      const pz = az + (cz - az) * t - Math.sin(ang) * (r() - 0.5) * 0.4;
      put(b, T.cyl6, k % 3 ? 0xc8c0b0 : 0xb4ac9c, MX(px, ctx.h(px, pz) + 0.02, pz, 0.55 + r() * 0.2, 0.12, 0.42 + r() * 0.15, 0, ang + r() * 0.5), false);
    }
  }
  // Oil barrels at the lighthouse's northwest corner (the dead corner beside the end of the path)
  for (let i = 0; i < 3; i++) {
    const px = x - 3.7 + (i % 2) * 0.7;
    const pz = z - 3.2 - Math.floor(i / 2) * 0.7;
    if (ctx.pathDist(px, pz) < 2.8) continue;
    put(b, T.cyl8, i % 2 ? 0x8a5a38 : 0x2f6aa8, MX(px, ctx.h(px, pz) + 0.42, pz, 0.32, 0.84, 0.32));
    put(b, T.cyl8, IRON, MX(px, ctx.h(px, pz) + 0.62, pz, 0.33, 0.06, 0.33), false);
    ctx.solids.add(px, pz, 0.4);
  }
  // A bench and a tripod telescope northwest of the lighthouse: looking north toward the icefield (the east side of the
  // plateau is the road to the chest, so nothing is placed there)
  {
    const bx = x - 6;
    const bz = z - 5.5;
    const by = ctx.h(bx, bz);
    if (!ctx.solids.blocked(bx, bz, 1.2) && ctx.pathDist(bx, bz) > 3.4) {
      const F = new Frame(bx, by, bz, Math.PI);
      put(b, T.box, PLANK, F.L(0, 0.48, 0, 1.8, 0.1, 0.5));
      put(b, T.box, PLANK, F.L(0, 0.78, -0.24, 1.8, 0.4, 0.08));
      for (const s of [-0.75, 0.75]) put(b, T.box, WOOD_D, F.L(s, 0.24, 0, 0.1, 0.48, 0.45));
      const T0 = F.sub(1.6, 0, 0.6, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        rod(b, T0.p(Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35), T0.p(0, 1.15, 0), 0.03, IRON, T.cyl4, false);
      }
      put(b, T.cyl8, 0xc89a48, T0.L(0, 1.3, 0.1, 0.09, 0.8, 0.09, Math.PI / 2 - 0.2));
      put(b, T.cyl8, 0xc89a48, T0.L(0, 1.39, 0.5, 0.12, 0.12, 0.12, Math.PI / 2 - 0.2));
      ctx.solids.add(bx, bz, 1.0);
    }
  }
  // The lighthouse keeper's vegetable plot: a low wooden fence, rows of vegetables and tomato trellises;
  // placed on the gentle slope southwest of the lighthouse (eight meters from the path, leaving a way out all around)
  {
    const gx = x - 7;
    const gz = z + 11;
    const gy = ctx.h(gx, gz);
    if (!ctx.solids.blocked(gx, gz, 2.2) && ctx.pathDist(gx, gz) > 4.5) {
      const F = new Frame(gx, gy, gz, -0.4);
      for (let row = 0; row < 3; row++) {
        put(b, T.box, 0x7a5a3a, F.L(0, 0.05, -0.9 + row * 0.9, 2.6, 0.18, 0.5), false);
        for (let k = 0; k < 5; k++) {
          const px = -1.0 + k * 0.5;
          if (row === 1) {
            put(b, T.cyl4, WOOD, F.L(px, 0.5, -0.9 + row * 0.9, 0.025, 1.0, 0.025), false);
            put(b, T.ico0, 0x3f8a3a, F.L(px, 0.55, -0.9 + row * 0.9, 0.16, 0.3, 0.16), false);
            put(b, T.sphere, 0xe8443a, F.L(px + 0.1, 0.45, -0.85 + row * 0.9, 0.06, 0.06, 0.06), false);
          } else put(b, T.ico0, row ? 0x6ac04a : 0x4aa84a, F.L(px, 0.22, -0.9 + row * 0.9, 0.2, 0.16, 0.2, 0, k), false);
        }
      }
      for (const [ax, az, cx, cz] of [[-1.5, -1.4, 1.5, -1.4], [1.5, -1.4, 1.5, 1.4], [1.5, 1.4, -1.5, 1.4]]) {
        const a = F.p(ax, 0, az);
        const c = F.p(cx, 0, cz);
        for (let k = 0; k <= 4; k++) {
          const p = a.clone().lerp(c, k / 4);
          put(b, T.box, WOOD, MX(p.x, ctx.h(p.x, p.z) + 0.35, p.z, 0.08, 0.7, 0.08), false);
        }
        rod(b, a.clone().setY(ctx.h(a.x, a.z) + 0.55), c.clone().setY(ctx.h(c.x, c.z) + 0.55), 0.025, WOOD, T.cyl4, false);
      }
      ctx.solids.add(gx, gz, 1.8);
    }
  }
  // The clothesline beside the plot
  {
    const a = V(x - 9, 0, z + 8);
    const c = V(x - 5, 0, z + 7.2);
    const ya = ctx.h(a.x, a.z);
    const yc = ctx.h(c.x, c.z);
    if (!ctx.solids.blocked(a.x, a.z, 0.8) && !ctx.solids.blocked(c.x, c.z, 0.8) && ctx.pathDist(a.x, a.z) > 3 && ctx.pathDist(c.x, c.z) > 3) {
      for (const [p, y] of [[a, ya], [c, yc]] as const) {
        rod(b, V(p.x, y - 0.2, p.z), V(p.x, y + 2.0, p.z), 0.05, WOOD_D, T.cyl5);
        ctx.solids.add(p.x, p.z, 0.3);
      }
      laundry(ctx, V(a.x, ya + 1.9, a.z), V(c.x, yc + 1.9, c.z), out, 4);
    }
  }
  gulls(ctx, x, y0 + 26, z, 6, 5, 10, 0.16);
}

// ───────────────────────── Town ─────────────────────────

/** The town's houses: [x, z, style] (doors facing the plaza) */
const HOMES: [number, number, HouseOpt][] = [
  // The captain's home: two floors, a hip tile roof, a balcony, an outer stair on the north side, a woodshed on the south side
  [-22, 80, { w: 5.2, d: 4.4, h: 2.7, floors: 2, roof: 'hip', wall: 0xf7f2e8, trim: 0x2f7ab8, band: 0x6a9ac8, balcony: true, stair: 1, annex: -1, vine: BLOOMS[0], chimney: true }],
  // Flat-roofed white house: a roof terrace and a pergola
  [-16.5, 89.5, { w: 4.6, d: 4.2, h: 2.8, floors: 1, roof: 'flat', wall: 0xeef4f4, trim: 0x2a9a8a, band: 0x2a9a8a, stair: 1, vine: BLOOMS[2], chimney: true }],
  // Bakery: a gable tile roof, a red awning, bread displayed at the door
  [6.5, 90, { w: 5.0, d: 4.0, h: 2.8, floors: 1, roof: 'gable', wall: 0xf3e6cf, trim: 0xc0503a, awning: 0xc0503a, shop: 'bread', chimney: true, vine: BLOOMS[3], lit: 0.7 }],
  // Ochre two-story house: green shutters, a balcony
  [12.5, 82, { w: 4.6, d: 4.4, h: 2.6, floors: 2, roof: 'hip', wall: 0xf2d6b0, trim: 0x4a9a5a, band: 0xc89a6a, balcony: true, vine: BLOOMS[0], chimney: true }],
  // Harbor tavern: a gable tile roof, a blue awning (seating under a grape trellis in front)
  [-16.5, 64.5, { w: 5.8, d: 4.4, h: 2.9, floors: 1, roof: 'gable', wall: 0xf7f2e8, trim: 0x2f7ab8, awning: 0x2f7ab8, shop: 'fish', band: 0x2f7ab8, lit: 0.8 }],
  // Pale blue two-story flat-roofed house: the outer stair goes straight up to the second floor
  [7.5, 65.5, { w: 4.4, d: 4.0, h: 2.7, floors: 2, roof: 'flat', wall: 0xcfe4e8, trim: 0x2f6aa8, band: 0xf8f6f0, stair: -1, vine: BLOOMS[1] }],
  // Net mender: a gable roof, a fishing gear shed beside it, rope coils hung on the shopfront
  [-27, 73.5, { w: 4.4, d: 3.8, h: 2.7, floors: 1, roof: 'gable', wall: 0xf7f2e8, trim: 0x2a9a8a, annex: 1, shop: 'rope', awning: 0x2a9a8a }],
  // The pink small house in the west
  [-33, 80.5, { w: 3.8, d: 3.6, h: 2.7, floors: 1, roof: 'flat', wall: 0xf0d0c4, trim: 0x3a86c8, band: 0x3a86c8, vine: BLOOMS[2] }],
  // The small house beside the east beach
  [19.5, 88.5, { w: 4.2, d: 3.6, h: 2.6, floors: 1, roof: 'gable', wall: 0xf3e6cf, trim: 0x2f7ab8, chimney: true, vine: BLOOMS[0], annex: -1 }],
];

/** Everything in the town */
/**
 * The near view within 9 m in front of the opening camera (about 10 m behind the spawn point, raised about 4 m):
 * no tall small props, so they do not block the opening shot
 */
function nearSpawnCam(ctx: FieldCtx, x: number, z: number): boolean {
  const [sx, sz, yaw] = ctx.layout.spawn;
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);
  const cx = sx - dx * 10.3;
  const cz = sz - dz * 10.3;
  const along = (x - cx) * dx + (z - cz) * dz;
  const across = Math.abs((x - cx) * dz - (z - cz) * dx);
  return along > -1.5 && along < 9 && across < 2 + along * 0.8;
}

export function buildTown(ctx: FieldCtx): TownOut {
  const { b, r, low } = ctx;
  const out: TownOut = { flags: [], lights: [], smoke: [] };
  const [tx, tz] = TOWN;


  // ── Embankment: a stone embankment along the north waterline, leaving the Tidebell Gate in the middle
  for (let i = 0; i <= 26; i++) {
    const a = -1.25 + (i / 26) * 2.5;
    const R = 16.6;
    const x = tx + Math.sin(a) * R;
    const z = tz - Math.cos(a) * R;
    if (Math.abs(x - -3.6) < 2.8) continue;
    const g = ctx.h(x, z);
    if (g < -1.5) continue;
    b.lift = 0;
    const top = 2.55;
    const bottom = -2.2;
    b.add(new THREE.BoxGeometry(1.9, top - bottom, 1.5), i % 3 ? STONE : STONE_D, M(x, (top + bottom) / 2 + 0.02, z, -a + (r() - 0.5) * 0.04));
    b.add(new THREE.BoxGeometry(2.0, 0.22, 1.6), 0xe2d8c2, M(x, top + 0.08, z, -a));
    if (i % 4 === 1) {
      // Mooring posts
      b.add(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 8), 0x3a4050, M(x + Math.sin(a) * 0.3, top + 0.45, z - Math.cos(a) * 0.3));
    }
    ctx.solids.add(x - Math.sin(a) * 0.4, z + Math.cos(a) * 0.4, 0.95);
  }
  // Tidebell Gate: two red-lacquered wooden posts, a crossbeam, a bronze bell hung from it, and behind the gate the boardwalk heading north
  {
    const gx = -3.6;
    const gz = 61.6;
    const y = ctx.place(gx, gz, 2);
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.28, 0.34, 5.6, 8), 0xc0443a, M(gx + s * 2.9, 2.8, gz));
      b.add(new THREE.CylinderGeometry(0.5, 0.55, 0.5, 8), STONE_D, M(gx + s * 2.9, 0.25, gz));
      ctx.solids.add(gx + s * 2.9, gz, 0.45);
    }
    b.add(new THREE.BoxGeometry(7.6, 0.45, 0.6), 0x3a4050, M(gx, 5.7, gz));
    b.add(new THREE.BoxGeometry(6.6, 0.3, 0.45), 0xc0443a, M(gx, 5.05, gz));
    // Bell
    b.add(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4), 0x3a4050, M(gx, 4.6, gz), false);
    const bell = new THREE.CylinderGeometry(0.35, 0.62, 0.9, 12, 1, true);
    b.add(bell, 0xc89a48, M(gx, 3.95, gz));
    b.add(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xc89a48, M(gx, 4.4, gz));
    b.add(new THREE.SphereGeometry(0.12, 6, 5), 0x6a4a2a, M(gx, 3.45, gz));
    // Shell wind chimes
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) b.add(new THREE.ConeGeometry(0.09, 0.2, 5), 0xfff1e2, M(gx + s * 2.2, 4.8 - k * 0.3, gz), false);
      out.lights.push([gx + s * 2.9, y + 5.2, gz + 0.4, 1.6]);
    }
    b.glow(new THREE.SphereGeometry(0.22, 8, 6), WINDOW, M(gx - 2.9, 5.25, gz + 0.35));
    b.glow(new THREE.SphereGeometry(0.22, 8, 6), WINDOW, M(gx + 2.9, 5.25, gz + 0.35));
    b.lift = 0;
    signpost(ctx, gx + 4.6, gz + 2.2, -0.3, WOOD);
  }


  // ── Plaza: the Whale Fountain and the mosaic around it
  const [fx, fz] = [tx - 1.2, tz - 0.5];
  const spout = fountain(ctx, fx, fz);
  ctx.extras.push((dt, t, vfx) => {
    // The whale's spray: in bursts
    const k = Math.sin(t * 0.9);
    if (k > 0.2 && Math.random() < dt * 30) {
      vfx.emit({ pos: spout.clone(), count: 2, color: [0xe8fbff, 0xbfefff], speed: [3.5, 5.2], dir: new THREE.Vector3(0.1, 1, -0.2), spread: 0.14, life: [0.7, 1.1], size: [0.14, 0.26], sizeEnd: 0.5, gravity: 9, drag: 0.3, intensity: 1.1 });
    }
  });
  {
    // A ring of blue-and-white tiles, an outer ring of wave patterns, eight radiating blue diamonds
    const cols = [0x3a7ac8, 0xf4efe4, 0x3a7ac8, 0xe0b070];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const [R, dr, off] of [[4.55, 0.85, 0], [5.35, 0.4, 2]] as const) {
        const x = fx + Math.cos(a) * R;
        const z = fz + Math.sin(a) * R;
        put(b, T.box, cols[(i + off) % 4], MX(x, ctx.h(x, z) + 0.03, z, dr, 0.05, ((2 * Math.PI * R) / n) * 0.92, 0, -a), false);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = fx + Math.cos(a) * 7.1;
      const z = fz + Math.sin(a) * 7.1;
      put(b, T.oct, i % 2 ? 0x3a7ac8 : 0x5aa8d8, MX(x, ctx.h(x, z) + 0.02, z, 0.45, 0.03, 1.5, 0, Math.PI / 2 - a), false);
      const x2 = fx + Math.cos(a + Math.PI / 8) * 8.3;
      const z2 = fz + Math.sin(a + Math.PI / 8) * 8.3;
      put(b, T.cyl6, 0xe0b070, MX(x2, ctx.h(x2, z2) + 0.02, z2, 0.3, 0.04, 0.3), false);
    }
    // Flagstones of the plaza: a few rings of flat stones close to the ground color, avoiding the two rings of diamonds and
    // dots, and not laid under the stalls
    const PAVE = [0xcfc0a2, 0xd8caac, 0xc6b696, 0xd2c4a6];
    const g0 = ctx.h(fx, fz);
    for (const R of low ? [6.2, 9.4] : [6.0, 6.5, 9.1, 9.6]) {
      const n = Math.floor((2 * Math.PI * R) / 0.5);
      for (let i = 0; i < n; i++) {
        if (r() < 0.22) continue;
        const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.02;
        const x = fx + Math.cos(a) * R;
        const z = fz + Math.sin(a) * R;
        const g = ctx.h(x, z);
        if (Math.abs(g - g0) > 0.35 || ctx.solids.blocked(x, z, 0.3)) continue;
        put(b, T.cyl6, PAVE[Math.floor(r() * 4)], MX(x, g + 0.015, z, 0.22 + r() * 0.04, 0.03, 0.2 + r() * 0.04, 0, -a + r() * 0.3), false);
      }
    }
  }
  const poles: [number, number][] = [[tx - 10.5, tz - 1.5], [tx + 8.5, tz - 2.5], [tx + 6.6, tz + 6.4], [tx - 9.6, tz + 6.4]];
  const poleTop: THREE.Vector3[] = [];
  for (const [x, z] of poles) {
    const y = ctx.place(x, z);
    b.add(new THREE.CylinderGeometry(0.1, 0.15, 6.6, 6), WOOD_D, M(x, 3.3, z));
    b.add(new THREE.CylinderGeometry(0.25, 0.3, 0.3, 8), STONE_D, M(x, 0.15, z));
    b.glow(new THREE.SphereGeometry(0.22, 8, 6), WINDOW, M(x, 6.75, z));
    b.add(new THREE.ConeGeometry(0.34, 0.3, 6), IRON, M(x, 7.1, z));
    out.lights.push([x, y + 6.75, z, 1.0]);
    poleTop.push(new THREE.Vector3(x, y + 6.4, z));
    ctx.solids.add(x, z, 0.3);
  }
  b.lift = 0;
  const bunting = (p0: THREE.Vector3, p1: THREE.Vector3, n: number) => {
    const ry = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const sag = Math.sin(k * Math.PI) * 0.6;
      out.flags.push(flagGeo(0.36, 0.46, [0xe8443a, 0xfff0d0, 0x4fb0ff, 0xffc84a][i % 4], true, false, M(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k - sag, p0.z + (p1.z - p0.z) * k, ry)));
    }
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y -= 0.6;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    b.add(new THREE.TubeGeometry(curve, 10, 0.025, 3), IRON, new THREE.Matrix4(), false);
  };
  // Bunting along the east, south and west sides of the plaza (not on the north side, which is the spawn point's line of sight)
  bunting(poleTop[1], poleTop[2], 10);
  bunting(poleTop[2], poleTop[3], 14);
  bunting(poleTop[3], poleTop[0], 10);
  // Benches facing the sea
  for (const [x, z, f] of [[tx + 6, tz - 11.5, Math.PI], [tx - 12.5, tz - 9.5, Math.PI + 0.5], [tx + 9.5, tz - 8.5, Math.PI - 0.6]] as const) {
    const y = ctx.place(x, z);
    b.lift = 0;
    const F = new Frame(x, y, z, f);
    put(b, T.box, PLANK, F.L(0, 0.48, 0, 1.8, 0.1, 0.5));
    put(b, T.box, PLANK, F.L(0, 0.78, -0.24, 1.8, 0.4, 0.08));
    for (const s of [-0.75, 0.75]) put(b, T.box, WOOD_D, F.L(s, 0.24, 0, 0.1, 0.48, 0.45));
    ctx.solids.add(x, z, 0.8);
  }
  b.lift = 0;

  // ── Houses (doors facing the plaza) and the yards behind them
  const homeFrames: Frame[] = [];
  for (const [x, z, o] of HOMES) {
    const face = Math.atan2(tx - x, tz - z);
    const y = ctx.place(x, z, Math.max(o.w, o.d) * 0.55);
    const F = new Frame(x, y, z, face);
    medHouse(ctx, F, o, out);
    homeFrames.push(F);
  }
  // Whale Chapel: on the south side of the plaza, directly facing the fountain
  {
    const x = -5.5;
    const z = 93;
    const y = ctx.place(x, z, 2.8);
    whaleChapel(ctx, new Frame(x, y, z, Math.atan2(tx - x, tz - z)), out);
  }
  if (!low) HOMES.forEach(([, , o], i) => backyard(ctx, homeFrames[i], o.w, o.d, out));
  // Clotheslines between houses (from one house's corner to another's)
  for (const [i, j] of [[0, 6], [1, 7], [2, 8]] as const) {
    const A = homeFrames[i];
    const B = homeFrames[j];
    const oa = HOMES[i][2];
    const ob = HOMES[j][2];
    const pa = A.p(0, 0, 0);
    const pb = B.p(0, 0, 0);
    const dir = new THREE.Vector3().subVectors(pb, pa).setY(0).normalize();
    const a = pa.clone().addScaledVector(dir, Math.min(oa.w, oa.d) / 2 + 0.1);
    const c = pb.clone().addScaledVector(dir, -Math.min(ob.w, ob.d) / 2 - 0.1);
    if (a.distanceTo(c) > 11) continue;
    a.y = A.y + 2.8;
    c.y = B.y + 2.8;
    laundry(ctx, a, c, out, 6);
  }
  // A cat on the steps
  cat(ctx, homeFrames[2].p(-1.3, 0, 2.6).x, homeFrames[2].y + 0.02, homeFrames[2].p(-1.3, 0, 2.6).z, homeFrames[2].face + 0.8, 0xe8943a);
  cat(ctx, homeFrames[0].p(0.4, 0, 2.95).x, homeFrames[0].y + 0.36, homeFrames[0].p(0.4, 0, 2.95).z, homeFrames[0].face - 1.2, 0x2a2a30);

  // ── Market: fish stalls on the west side, fruit and pottery stalls on the east side, a shell stall in the south
  stall(ctx, tx - 11, tz + 1.5, Math.PI / 2 + 0.15, 0x3a86c8, 'fish');
  stall(ctx, tx - 10.2, tz - 3.8, Math.PI / 2 + 0.5, 0xe8443a, 'fish');
  stall(ctx, tx - 9.6, tz + 6.8, Math.PI / 2 - 0.3, 0x2a9a8a, 'shells');
  for (const [x, z, cloth, kind] of [[tx + 9.8, tz + 6.2, 0xffa030, 'fruit'], [tx + 11.5, tz + 1.8, 0x3a86c8, 'pots']] as const) {
    if (ctx.pathDist(x, z) < 3.4 || ctx.solids.blocked(x, z, 1.6)) continue;
    stall(ctx, x, z, Math.atan2(tx - x, tz - z), cloth, kind);
  }
  // Crates, barrels and fish baskets beside the stalls
  for (const [x, z] of [[tx - 14.5, tz + 4], [tx + 9.5, tz + 4.5], [tx - 12.6, tz - 1.4], [tx + 13.2, tz + 4.6]] as const) {
    if (ctx.pathDist(x, z) < 3.4 || ctx.solids.blocked(x, z, 1.1) || nearSpawnCam(ctx, x, z)) continue;
    goods(ctx, x, z);
  }
  // Open-air café seating: under the trellis in front of the tavern, in front of the bakery
  {
    const F = homeFrames[4];
    const o = HOMES[4][2];
    pergola(ctx, F.sub(0, 0, o.d / 2 + 2.3, 0), o.w + 0.6, 3.0, out);
    for (const [lx, lz, c] of [[-1.6, o.d / 2 + 2.0, 0x2f7ab8], [1.4, o.d / 2 + 2.6, 0xe8443a]] as const) {
      const p = F.p(lx, 0, lz);
      if (ctx.pathDist(p.x, p.z) > 3.0 && !ctx.solids.blocked(p.x, p.z, 0.9)) cafeTable(ctx, p.x, p.z, c);
    }
  }
  for (const [lx, lz, c] of [[2.2, 4.4, 0xe8443a], [-2.6, 4.8, 0x2a9a8a]] as const) {
    const p = homeFrames[2].p(lx, 0, lz);
    if (ctx.pathDist(p.x, p.z) > 3.0 && !ctx.solids.blocked(p.x, p.z, 1.0)) cafeTable(ctx, p.x, p.z, c);
  }
  // Big clay pots with lemon trees at the edge of the plaza
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const x = fx + Math.cos(a) * 10.2;
    const z = fz + Math.sin(a) * 10.2;
    if (ctx.pathDist(x, z) < 3.0 || ctx.solids.blocked(x, z, 1.3) || nearSpawnCam(ctx, x, z)) continue;
    lemonPlanter(ctx, x, z);
  }
  // On both sides of the road in front of the Tidebell Gate: whale-tail stone steles (placed outside the opening camera's near view)
  for (const [x, z] of [[-9.6, 66.4], [1.2, 65.8]] as const) {
    if (ctx.solids.blocked(x, z, 0.9) || ctx.pathDist(x, z) < 2.6 || nearSpawnCam(ctx, x, z)) continue;
    whaleStele(ctx, x, z, Math.PI, out);
  }
  // Pigeons
  pigeons(ctx, fx + 5, fz + 3.5, 7);
  pigeons(ctx, fx - 3, fz - 6.5, 5);

  // ── Street lamps
  for (const [x, z] of [[tx + 4, tz - 12], [tx - 9, tz - 12], [tx + 3.5, tz + 10], [tx - 4.5, tz + 10.5], [tx + 12, tz - 3], [tx - 16, tz - 4]] as const) {
    if (ctx.solids.blocked(x, z, 0.4)) continue;
    lampPost(ctx, x, z, IRON, WINDOW, 3.0);
    out.lights.push([x, ctx.h(x, z) + 3.22, z, 1.6]);
  }
  b.lift = 0;

  // ── Coconut palms and flower clusters in town
  for (const [x, z, s] of [[tx - 13.5, tz - 8.5, 1.5], [tx + 10.5, tz - 12, 1.6], [tx + 13, tz + 8, 1.4], [tx - 13.5, tz + 11.5, 1.5], [tx - 20, tz - 1, 1.7], [tx + 15.5, tz - 6, 1.45]] as const) {
    if (ctx.pathDist(x, z) < 3.2 || ctx.solids.blocked(x, z, 1)) continue;
    solidPalm(ctx, x, z, s, Math.atan2(z - tz, x - tx), 0.8);
  }
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = 9 + r() * 6.4; // Inside the embankment (R 16.6)
    const x = tx + Math.cos(a) * d;
    const z = tz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < 3.4 || ctx.solids.blocked(x, z, 1.2) || ctx.h(x, z) < 1.2) continue;
    if (Math.hypot(x - ctx.layout.waypoint[0], z - ctx.layout.waypoint[1]) < 4 || nearSpawnCam(ctx, x, z)) continue;
    if (r() < 0.5) tropicBush(ctx, x, z, 0.7 + r() * 0.4, FLOWERS[i % FLOWERS.length]);
    else {
      const y = ctx.h(x, z);
      pottedPlant(ctx, x, y, z, 1.1 + r() * 0.4, r() < 0.7 ? GERANIUM[Math.floor(r() * 4)] : undefined);
    }
  }
  b.lift = 0;

  buildPort(ctx, out);
  const lantern = lighthouse(ctx, LIGHTHOUSE[0], LIGHTHOUSE[1], out);
  lighthouseBeam(ctx, lantern, 70, 0xffe6a0);
  out.lights.push([lantern.x, lantern.y, lantern.z, 9]);

  // Chimney smoke: only emitted near the camera
  const smoke = out.smoke;
  ctx.extras.push((dt, _t, vfx) => {
    const cp = vfx.camPos;
    for (const p of smoke) {
      if (Math.random() > dt * 1.6) continue;
      if (Math.abs(cp.x - p.x) + Math.abs(cp.z - p.z) > 110) continue;
      vfx.smoke({ pos: p.clone(), count: 1, color: [0xf4f4f4, 0xdedede], speed: [0.5, 0.9], dir: V(0.3, 1, 0.1), spread: 0.15, life: [2.2, 3.2], size: [0.3, 0.5], sizeEnd: 1.6, drag: 0.25 });
    }
  });
  return out;
}

/** A pile of goods beside a stall: crates, barrels, fish baskets or a stack of pottery jars */
function goods(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 1);
  b.lift = 0;
  const F = new Frame(x, y, z, r() * 6);
  put(b, T.box, WOOD, F.L(0, 0.4, 0, 0.8, 0.8, 0.8));
  put(b, T.box, WOOD_D, F.L(0, 0.4, 0.41, 0.8, 0.08, 0.02), false);
  put(b, T.box, 0xb08050, F.L(0.15, 1.1, 0.05, 0.6, 0.6, 0.6, 0, 0.4));
  put(b, T.cyl12, 0x8a5a38, F.L(0.95, 0.48, -0.2, 0.4, 0.96, 0.4));
  for (const y2 of [0.18, 0.78]) put(b, T.cyl12, IRON, F.L(0.95, y2, -0.2, 0.41, 0.06, 0.41), false);
  put(b, T.pot, 0xc8a870, F.L(-0.85, 0.25, 0.35, 0.34, 0.5, 0.34));
  for (let i = 0; i < 3; i++) put(b, T.oct, [0xb8c8d8, 0x6a9ac8, 0xff8a5a][i], F.L(-0.85 + (i - 1) * 0.12, 0.52, 0.35, 0.25, 0.07, 0.1, 0, r() * 3), false);
  ctx.solids.add(x + 0.2, z, 1.1);
}

/** Grape trellis: four white posts, wooden beams, vine leaves, with two lamps hung */
function pergola(ctx: FieldCtx, F: Frame, w: number, d: number, out: TownOut): void {
  const { b, r } = ctx;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = F.p((sx * w) / 2, 0, (sz * d) / 2);
      if (ctx.pathDist(p.x, p.z) < 2.6) return;
    }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = F.p((sx * w) / 2, 0, (sz * d) / 2);
      const y = ctx.h(p.x, p.z);
      put(b, T.box, 0xf4efe4, MX(p.x, y + 1.25, p.z, 0.22, 2.5, 0.22, 0, F.face));
      ctx.solids.add(p.x, p.z, 0.3);
    }
  const y = F.y + 2.55;
  for (const sz of [-1, 1]) put(b, T.box, WOOD, F.L(0, y - F.y, (sz * d) / 2, w + 0.5, 0.14, 0.16));
  const n = Math.round(w / 0.6);
  for (let i = 0; i <= n; i++) put(b, T.box, WOOD, F.L(-w / 2 + (i * w) / n, y - F.y + 0.12, 0, 0.1, 0.1, d + 0.5), false);
  for (let i = 0; i < 16; i++) put(b, T.ico0, i % 3 ? 0x4a9a3a : 0x6ab84a, F.L((r() - 0.5) * w, y - F.y + 0.25 + r() * 0.1, (r() - 0.5) * d, 0.5, 0.2, 0.5, 0, r() * 6), false);
  // Hanging bunches of grapes
  for (let i = 0; i < 6; i++) put(b, T.cone5, 0x7a3a8a, F.L((r() - 0.5) * w * 0.9, y - F.y - 0.1, (r() - 0.5) * d * 0.8, 0.1, 0.24, 0.1, Math.PI), false);
  for (const s of [-1, 1]) {
    const p = F.p(s * w * 0.25, y - F.y - 0.35, 0);
    rod(b, p.clone().setY(y), p, 0.012, IRON, T.cyl4, false);
    putGlow(b, T.sphere, WINDOW, MX(p.x, p.y - 0.15, p.z, 0.16, 0.2, 0.16));
    out.lights.push([p.x, p.y - 0.15, p.z, 1.4]);
  }
}
