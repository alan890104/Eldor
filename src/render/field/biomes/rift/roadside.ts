// Roadside: the ring the character sees most often while walking the road. The remaining curbstones along both sides of the
// Old Kingdom Road (some missing, some askew), gravel, stone chips and crystal sprouts on the shoulder,
// little piles of rubble and corrupted plants, and on the ring road a bent old iron lamp every so often (a purple ghost fire
// burning inside). Near the spawn point there are also traces the Knights left behind: an overturned supply wagon,
// a cairn with candles piled for fallen comrades, a snuffed-out campfire.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { samplePath } from '../../compose.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import { glowDisc } from './decals.ts';
import type { Flames } from './fx.ts';
import type { Scatter } from './inst.ts';
import { COL } from './props.ts';
import { HEAL, lanternWeed, rubblePile, STONE, thornBush, voidShrooms } from './scatter.ts';
import { land, RIN, sm, T, TOWN } from './shape.ts';
import type { Debris } from './void.ts';

const CURB = [0x6a5e74, 0x5e5268, 0x7a7088, 0x564a60];
const PEB = [0x5c5068, 0x6a5e76, 0x7a7088, 0x847a92, 0x4a4056];
const IRON = 0x2e2a36;
const WOOD = 0x6a4a32;
const WOOD_D = 0x4a3222;
const CANVAS = 0xd8c8a8;
const STEEL = 0x9aa0b0;

const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tv = new THREE.Vector3();
const ts = new THREE.Vector3();

function inst(sc: Scatter, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, col: number, k = 1): void {
  tm.compose(tv.set(x, y, z), tq.setFromEuler(te.set(rx, ry, rz)), ts.set(sx, sy, sz));
  sc.add(kind, tm, col, k);
}

/** Fits (does not press on chests, residents, teleport pads or existing colliders, and is not near a cliff edge) */
function free(ctx: FieldCtx, x: number, z: number, rad: number): boolean {
  const L = ctx.layout;
  if (land(x, z) < rad + 1.8) return false;
  if (Math.hypot(x - L.waypoint[0], z - L.waypoint[1]) < 3.5 + rad) return false;
  if (L.chests.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.6 + rad)) return false;
  if (L.npcs.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.2 + rad)) return false;
  return !ctx.solids.blocked(x, z, rad);
}

/**
 * Old Kingdom iron lamp: a cast-iron post, a curled lamp arm at the top hung with a lantern whose glass is broken,
 * a ghost fire burning inside; some are bent, some have fallen
 */
export function ironLamp(ctx: FieldCtx, fl: Flames, x: number, z: number, face: number, state: number, r: () => number): void {
  const { b } = ctx;
  const gh = ctx.place(x, z);
  b.add(new THREE.CylinderGeometry(0.28, 0.34, 0.35, 8), IRON, M(x, 0.17, z));
  const pure = HEAL.pure;
  if (state === 2) {
    // Fallen post and smashed lantern on the ground
    const dx = Math.sin(face);
    const dz = Math.cos(face);
    b.add(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 6), IRON, M(x + dx * 1.7, 0.12, z + dz * 1.7, face, 1, Math.PI / 2, 0));
    b.add(new THREE.BoxGeometry(0.34, 0.4, 0.34), IRON, M(x + dx * 3.5 + 0.3, 0.18, z + dz * 3.5, r() * 6, 1, 0.6, 1.1));
    ctx.solids.add(x, z, 0.35);
    b.lift = 0;
    return;
  }
  const tilt = state === 1 ? 0.22 + r() * 0.15 : 0;
  const up = new THREE.Vector3(Math.sin(face) * Math.sin(tilt), Math.cos(tilt), Math.cos(face) * Math.sin(tilt));
  const H = 3.1;
  const top = new THREE.Vector3(x, 0.3, z).addScaledVector(up, H);
  b.add(new THREE.CylinderGeometry(0.06, 0.1, H, 6), IRON, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.3, z).addScaledVector(up, H / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up), new THREE.Vector3(1, 1, 1)));
  // Curled lamp arm
  const arm = new THREE.TorusGeometry(0.32, 0.035, 4, 10, Math.PI * 1.3);
  b.add(arm, IRON, M(top.x + Math.sin(face) * 0.3, top.y - 0.05, top.z + Math.cos(face) * 0.3, face + Math.PI / 2));
  const lx = top.x + Math.sin(face) * 0.62;
  const lz = top.z + Math.cos(face) * 0.62;
  const ly = top.y - 0.55;
  b.add(new THREE.ConeGeometry(0.24, 0.18, 4), IRON, M(lx, ly + 0.34, lz, Math.PI / 4));
  b.add(new THREE.BoxGeometry(0.26, 0.05, 0.26), IRON, M(lx, ly - 0.2, lz));
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.add(new THREE.BoxGeometry(0.025, 0.46, 0.025), IRON, M(lx + ox * 0.11, ly + 0.03, lz + oz * 0.11), false);
  if (state === 0 || r() < 0.5) fl.add(lx, gh + ly - 0.17, lz, 0.28, r() * 6, pure ? 2 : 1);
  ctx.solids.add(x, z, 0.35);
  b.lift = 0;
}

/** Overturned supply wagon: the bed on its side, one wheel lost, with crates, sacks and rolled-away casks strewn all around */
function overturnedCart(ctx: FieldCtx, x: number, z: number, ry: number, r: () => number): void {
  const { b } = ctx;
  ctx.place(x, z, 1.4);
  const cs = Math.cos(ry);
  const sn = Math.sin(ry);
  const W = (lx: number, lz: number) => [x + cs * lx + sn * lz, z - sn * lx + cs * lz] as const;
  // Bed on its side: the floor board stands up as a wall, one side board lies on the ground and the other on top of it,
  // and the rear wheel is now lying flat
  const at = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, col: number, rx = 0) => {
    const [px, pz] = W(lx, lz);
    b.add(new THREE.BoxGeometry(sx, sy, sz), col, M(px, ly, pz, ry, 1, rx, 0));
  };
  at(0, 0.72, -0.2, 2.6, 1.4, 0.12, WOOD);
  at(0, 0.06, 0.25, 2.6, 0.08, 0.5, WOOD_D);
  at(0, 1.38, 0.25, 2.6, 0.08, 0.5, WOOD_D, 0.12);
  at(1.28, 0.72, 0.25, 0.08, 1.4, 0.5, WOOD_D);
  for (const lx of [-0.8, 0.9]) at(lx, 0.72, -0.3, 0.1, 1.42, 0.08, WOOD_D);
  // The axle (now pointing up) and the wheel still attached
  const [ax, az] = W(-0.6, -0.55);
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), WOOD_D, M(ax, 0.85, az));
  b.add(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12), WOOD_D, M(ax, 1.6, az));
  b.add(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 8), IRON, M(ax, 1.62, az));
  for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1.15, 0.05, 0.08), WOOD, M(ax, 1.67, az, (i / 3) * Math.PI));
  // The wheel that fell off
  const [wx, wz] = W(1.2, 1.9);
  b.add(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12), WOOD_D, M(wx, 0.06, wz, r() * 6));
  for (let i = 0; i < 4; i++) b.add(new THREE.BoxGeometry(1.15, 0.05, 0.08), WOOD, M(wx, 0.12, wz, (i / 4) * Math.PI));
  // Shafts
  const [px, pz] = W(-2.2, -0.4);
  b.add(new THREE.BoxGeometry(1.9, 0.1, 0.1), WOOD_D, M(px, 0.08, pz, ry + 0.2));
  // Scattered supplies
  for (const [lx, lz, s, k] of [
    [0.4, 1.6, 0.7, 0],
    [-0.8, 1.9, 0.55, 0],
    [0.1, 2.5, 0.5, 1],
    [-1.6, 1.3, 0.5, 1],
    [1.8, -1.1, 0.45, 2],
    [-2.4, 1.8, 0.4, 1],
  ] as const) {
    const [qx, qz] = W(lx, lz);
    ctx.place(qx, qz);
    if (k === 0) {
      b.add(new THREE.BoxGeometry(s, s, s), 0x8a6a42, M(qx, s * 0.45, qz, r() * 6, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
      b.add(new THREE.BoxGeometry(s * 1.02, s * 0.12, s * 1.02), WOOD_D, M(qx, s * 0.7, qz, r() * 6));
    } else if (k === 1) {
      const g = new THREE.SphereGeometry(s * 0.55, 8, 6);
      g.scale(1, 0.62, 0.8);
      b.add(g, CANVAS, M(qx, s * 0.28, qz, r() * 6));
    } else {
      b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.85, 10), WOOD, M(qx, 0.34, qz, r() * 6, 1, 0, Math.PI / 2));
      b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 10), IRON, M(qx, 0.34, qz, r() * 6, 1, 0, Math.PI / 2));
    }
  }
  ctx.solids.add(x, z, 1.7);
  ctx.b.lift = 0;
}

/** Cairn for the fallen: a pile of stacked stones with a sword stuck in the top, a helmet and a lit candle beside it */
function cairn(ctx: FieldCtx, fl: Flames, x: number, z: number, r: () => number): void {
  const { b } = ctx;
  const gh = ctx.place(x, z, 0.8);
  for (let i = 0; i < 11; i++) {
    const layer = i < 6 ? 0 : i < 9 ? 1 : 2;
    const a = r() * Math.PI * 2;
    const d = [0.55, 0.32, 0.1][layer];
    const s = [0.34, 0.28, 0.22][layer];
    b.add(new THREE.DodecahedronGeometry(s, 0), STONE[Math.floor(r() * STONE.length)], M(x + Math.cos(a) * d, 0.18 + layer * 0.34, z + Math.sin(a) * d, r() * 6, 1, r(), r()));
  }
  // Sword
  b.add(new THREE.BoxGeometry(0.08, 1.2, 0.03), STEEL, M(x, 1.45, z, 0.4, 1, 0.08, 0));
  b.add(new THREE.BoxGeometry(0.42, 0.06, 0.07), IRON, M(x, 1.98, z, 0.4, 1, 0.08, 0));
  // Blue cloth draped over the hilt
  b.add(new THREE.BoxGeometry(0.3, 0.6, 0.02), 0x2e4a8a, M(x + 0.05, 1.72, z + 0.06, 0.4, 1, 0.1, 0.1));
  // Helmet and candle
  for (let i = 0; i < 3; i++) {
    const a = 0.4 + i * 2.1 + r() * 0.4;
    const hx = x + Math.cos(a) * 1.05;
    const hz = z + Math.sin(a) * 1.05;
    ctx.place(hx, hz);
    b.add(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 8), 0x7a8090, M(hx, 0.14, hz, a, 1, 0.3, 0));
    b.add(new THREE.SphereGeometry(0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a90a0, M(hx, 0.27, hz, a, 1, 0.3, 0));
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.8 + r() * 0.5;
    const cx = x + Math.cos(a) * d;
    const cz = z + Math.sin(a) * d;
    const ch = 0.1 + r() * 0.16;
    ctx.place(cx, cz);
    b.add(new THREE.CylinderGeometry(0.035, 0.04, ch, 6), 0xf0e8d8, M(cx, ch / 2, cz));
    fl.add(cx, ctx.h(cx, cz) + ch, cz, 0.09, r() * 6, 0);
  }
  glowDisc(ctx, x, z, 2.6, 0xffb060, 0.3);
  void gh;
  ctx.solids.add(x, z, 0.85);
  ctx.b.lift = 0;
}

/** Snuffed-out camp: a ring of stones, burnt logs, embers, an unrolled bedroll and a shield set down */
function coldCamp(ctx: FieldCtx, x: number, z: number, r: () => number): void {
  const { b } = ctx;
  ctx.place(x, z, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(new THREE.DodecahedronGeometry(0.2, 0), COL.stone, M(x + Math.cos(a) * 0.65, 0.08, z + Math.sin(a) * 0.65, r() * 6));
  }
  for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 5), 0x1e1618, M(x, 0.12, z, i * 0.8 + r(), 1, Math.PI / 2 - 0.1, 0));
  b.glow(new THREE.IcosahedronGeometry(0.16, 0), 0xff6a30, M(x, 0.05, z));
  // Bedroll
  const g = new THREE.CapsuleGeometry(0.32, 1.3, 3, 8);
  g.rotateZ(Math.PI / 2);
  g.scale(1, 0.35, 1);
  b.add(g, 0x5a4a6a, M(x + 1.6, 0.1, z + 0.4, 0.5));
  b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8), 0x8a6a4a, M(x + 1.25, 0.2, z - 0.25, 0.5, 1, 0, Math.PI / 2));
  // Shield set down
  const sh = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12);
  b.add(sh, 0x2e4a8a, M(x - 1.2, 0.05, z + 0.9, r() * 6, 1, 0.05, 0));
  b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8), 0xe8c060, M(x - 1.2, 0.08, z + 0.9));
  ctx.solids.add(x, z, 0.8);
  ctx.b.lift = 0;
}

export function buildRoadside(ctx: FieldCtx, sc: Scatter, fl: Flames, r: () => number, spots: [number, number, number][], debris: Debris[]): void {
  const L = ctx.layout;
  const W = L.pathW;
  const k = ctx.low ? 0.5 : 1;
  const pure = HEAL.pure;
  const roads: XZ[][] = [samplePath(L.path, 0.9), ...(L.trails ?? []).map((t) => samplePath(t, 0.9))];
  roads.forEach((road, ri) => {
    const main = ri === 0;
    let lampAt = 8 + r() * 10;
    let dist = 0;
    let lampSide = r() < 0.5 ? -1 : 1;
    for (let i = 1; i < road.length - 1; i++) {
      const [x, z] = road[i];
      const tx = road[i + 1][0] - road[i - 1][0];
      const tz = road[i + 1][1] - road[i - 1][1];
      const tl = Math.hypot(tx, tz) || 1;
      const nx = -tz / tl;
      const nz = tx / tl;
      const face = Math.atan2(tx, tz);
      dist += Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1]);
      const town = Math.hypot(x - TOWN[0], z - TOWN[1]);
      if (town < 19) continue;
      const isle = Math.hypot(x - T[0], z - T[1]) < RIN - 3;
      // On bridges and narrow ridges: void on both sides, so only curbstones are placed
      const narrow = land(x, z) < W + 3.5;
      for (const s of [-1, 1]) {
        // Curbstones
        const ck = main ? 0.7 : 0.42;
        if (!isle && r() < ck * (narrow ? 0.5 : 1)) {
          const off = W + 0.15 + (r() - 0.5) * 0.15;
          const px = x + nx * s * off;
          const pz = z + nz * s * off;
          if (land(px, pz) > 0.6 && ctx.pathDist(px, pz) > W - 0.2 && !ctx.solids.blocked(px, pz, 0.05)) {
            ctx.place(px, pz);
            const moved = r() < 0.22;
            const out = moved ? 0.2 + r() * 0.6 : 0;
            const len = 0.8 + r() * 0.25;
            const hgt = 0.26 + r() * 0.1;
            ctx.b.add(new THREE.BoxGeometry(0.34, hgt, len), CURB[Math.floor(r() * CURB.length)], M(px + nx * s * out, hgt * 0.35, pz + nz * s * out, face + (moved ? (r() - 0.5) * 1.2 : (r() - 0.5) * 0.06), 1, moved ? (r() - 0.5) * 0.5 : 0, moved ? (r() - 0.5) * 0.5 : 0));
            ctx.b.lift = 0;
          }
        }
        if (narrow) continue;
        // Gravel and stone chips on the shoulder (hugging the roadside, where the camera is closest)
        if (r() < 0.8 * k) {
          const n = 1 + Math.floor(r() * 4);
          for (let j = 0; j < n; j++) {
            const off = W - 0.3 + r() * 3.2;
            const px = x + nx * s * off + (r() - 0.5) * 0.9;
            const pz = z + nz * s * off + (r() - 0.5) * 0.9;
            if (land(px, pz) < 1 || ctx.solids.blocked(px, pz, 0.05)) continue;
            const sz = 0.05 + r() * 0.12;
            const y = ctx.h(px, pz);
            if (r() < 0.5) inst(sc, 'peb', px, y + sz * 0.2, pz, sz, sz * 0.6, sz * 0.9, r() * 3, r() * 6, r() * 3, PEB[Math.floor(r() * PEB.length)]);
            else inst(sc, 'chip', px, y + sz * 0.15, pz, sz, sz * 0.8, sz, r() * 3, r() * 6, r() * 3, PEB[Math.floor(r() * PEB.length)]);
          }
        }
        if (r() < 0.3 * k) {
          const off = W + 0.3 + r() * 2.5;
          const px = x + nx * s * off;
          const pz = z + nz * s * off;
          if (land(px, pz) > 1.5 && !ctx.solids.blocked(px, pz, 0.1)) {
            const w = 0.3 + r() * 0.45;
            inst(sc, 'flake', px, ctx.h(px, pz) + 0.03, pz, w, 0.07, w * (0.6 + r() * 0.5), (r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3, CURB[Math.floor(r() * CURB.length)]);
          }
        }
        // Crystal sprouts by the road (more of them the closer to the Wound)
        const wk = 1 - sm(40, 80, Math.hypot(x - T[0], z - T[1]));
        if (r() < (0.08 + wk * 0.3) * k) {
          const off = W + 0.4 + r() * 2.5;
          const px = x + nx * s * off;
          const pz = z + nz * s * off;
          if (land(px, pz) > 1.5 && !ctx.solids.blocked(px, pz, 0.05)) {
            const n = 2 + Math.floor(r() * 3);
            for (let j = 0; j < n; j++) {
              const sx = px + (r() - 0.5) * 0.6;
              const sz = pz + (r() - 0.5) * 0.6;
              const ss = 0.06 + r() * 0.1;
              const a = r() * 6;
              const tl2 = 0.2 + r() * 0.4;
              // After purification they are tender green sprouts (occasionally one pale gold)
              const gold = pure && r() < 0.12;
              const kind = pure && !gold ? 'shoot' : 'sprout';
              const col = pure ? (gold ? 0xffd890 : r() < 0.5 ? 0x8ab86a : 0x6a9a5a) : r() < 0.5 ? COL.cryB : COL.cryA;
              inst(sc, kind, sx, ctx.h(sx, sz) - 0.03, sz, ss * 0.45, ss * 1.9, ss * 0.45, Math.sin(a) * tl2, r() * 6, -Math.cos(a) * tl2, col, pure ? 0.35 : 0.7);
            }
          }
        }
        // A small pile of rubble or a clump of plants by the road
        const t = r();
        if (t < 0.075 * k) {
          const off = W + 1.2 + r() * 2.8;
          const px = x + nx * s * off;
          const pz = z + nz * s * off;
          const sz = 0.35 + r() * 0.45;
          if (free(ctx, px, pz, sz)) {
            rubblePile(ctx, px, pz, sz, r, false);
            spots.push([px, pz, sz]);
            ctx.b.lift = 0;
          }
        } else if (t < 0.13 * k) {
          const off = W + 1.4 + r() * 3;
          const px = x + nx * s * off;
          const pz = z + nz * s * off;
          if (free(ctx, px, pz, 0.6)) {
            const f = r();
            if (f < 0.4) thornBush(ctx, px, pz, 0.55 + r() * 0.4, r, sc);
            else if (f < 0.75) lanternWeed(ctx, px, pz, r);
            else voidShrooms(ctx, px, pz, 0.6 + r() * 0.3, r);
          }
        } else if (t < 0.15 * k && !main) {
          // A paving stone floating up from the shoulder (outside the walkway, so it does not block where one walks)
          const off = W + 0.9 + r() * 1.8;
          const px = x + nx * s * off;
          const pz = z + nz * s * off;
          if (land(px, pz) > 1.5) debris.push([px, ctx.h(px, pz) + 0.7 + r() * 1.2, pz, 0.3 + r() * 0.1, 1]);
        }
      }
      // Old iron lamps on the ring road
      if (!main && !isle && !narrow && dist > lampAt) {
        const off = W + 1.1;
        const px = x + nx * lampSide * off;
        const pz = z + nz * lampSide * off;
        if (free(ctx, px, pz, 0.5)) {
          const st = r();
          ironLamp(ctx, fl, px, pz, Math.atan2(-nx * lampSide, -nz * lampSide), st < 0.55 ? 0 : st < 0.82 ? 1 : 2, r);
          lampAt = dist + 16 + r() * 10;
          lampSide = -lampSide;
        }
      }
    }
  });
  ctx.b.lift = 0;

  // Near the spawn point: traces the Knights left behind
  overturnedCart(ctx, 10, 38, 0.35, r);
  cairn(ctx, fl, 3.8, 30.5, r);
  coldCamp(ctx, -13, 41.5, r);
  spots.push([10, 38, 2.2], [3.8, 30.5, 1.2], [-13, 41.5, 1.4]);
}
