// Highland field landmarks and scenery:
// cliff-top meadow (dandelions, flag trees), the waterfall pool below Station Cliff, Windherd Meadow's Dandelion Meadow,
// Windmill Hill, Shepherd's Slope (dry-stone walls and sheep pens), Letter Crane Cliff (a tree hung with letters that can never
// be sent, a flock of paper cranes), the wind gate and rope fences on Skyridge, the chasm's waterfalls, Windsong Terrace's
// Wind-Carved Stone Forest and Windsong Stone Ring, the flag array and Wing Folk guardian statues on the tower terrace,
// and Floatstone Hollow hidden beneath the giant floating rock.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import { GlowSet, segM, V } from '../../../arenas/_woods.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import { reeds } from '../../props.ts';
import type { Anim } from './anim.ts';
import { rimHeight } from './cliffs.ts';
import { windmill } from './town.ts';
import { banner, bird, grassTuft, pondMaterial, waterfallGeo } from './fx.ts';
import { C, cairn, dandelions, featherFlag, flagPole, flagRail, hoodoo, stoneArch, stoneWall, wildflowers, windRock, windShrub, windTree, WIND_RY } from './props.ts';
import { BASIN, BASIN_H, BASIN_R, FALL_POND, HUT, landD, MILL_HILL, POND, RING, SEA, SHRINE, TOWER, TOWN, WX, WZ, type RimPoint } from './shape.ts';

const STRATA = [0xd3c1a0, 0xb89c7e, 0xa38a74, 0xc9b38e, 0x9a8a7e];
const FLOWERS = [0x9ad0f0, 0xfff6ec, 0xffe07a, 0xc8a8f0, 0xffc3d8];
const CYL = new THREE.CylinderGeometry(1, 1, 1, 7);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const TUFT = [new THREE.Color(0x8fcf6a), new THREE.Color(0xa8d878), new THREE.Color(0x76b85a)];
const TUFT_DRY = [new THREE.Color(0xc2cf80), new THREE.Color(0xa9c070), new THREE.Color(0xd8d898)];

const near = (x: number, z: number, p: XZ, r: number) => Math.hypot(x - p[0], z - p[1]) < r;

/** Tall grass clumps placed on flat ground (the highland's grass grows knee-high) */
function tuft(ctx: FieldCtx, anim: Anim, x: number, z: number, s: number, dry = false): void {
  grassTuft(anim.grass, x, ctx.h(x, z) - 0.05, z, s, dry ? TUFT_DRY : TUFT, ctx.r);
}

/** A patch of water (small pool): a disc lying at height y */
function pond(ctx: FieldCtx, anim: Anim, x: number, z: number, y: number, R: number): void {
  const mat = pondMaterial();
  mat.uniforms.uC.value.set(x, z);
  const geo = new THREE.CircleGeometry(R, 32);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.renderOrder = 2;
  ctx.group.add(m);
  anim.ticks.push((_dt, t) => (mat.uniforms.uTime.value = t));
  ctx.disposers.push(() => {
    mat.dispose();
    geo.dispose();
  });
}

/** The cliff-edge point nearest to (x, z) */
function nearestRim(loops: RimPoint[][], x: number, z: number): RimPoint {
  let best = loops[0][0];
  let bd = Infinity;
  for (const l of loops) {
    for (const p of l) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
  }
  return best;
}

// ───────────────────────── Cliff-top meadow and Station Cliff ─────────────────────────

function crest(ctx: FieldCtx, anim: Anim): void {
  const { r } = ctx;
  const k = ctx.low ? 0.5 : 1;
  // Dandelions and wildflowers: the two meadows east and west on the cliff top
  ctx.scatter(Math.round(70 * k), [14, 60, 54, 90], 1.2, (x, z) => {
    if (landD(x, z) < 3) return;
    if (r() < 0.6) dandelions(ctx, x, z, 5 + Math.floor(r() * 6));
    else wildflowers(ctx, x, z, 6, FLOWERS);
  });
  ctx.scatter(Math.round(50 * k), [-56, -22, 50, 88], 1.2, (x, z) => {
    if (landD(x, z) < 3) return;
    if (r() < 0.5) dandelions(ctx, x, z, 4 + Math.floor(r() * 5));
    else wildflowers(ctx, x, z, 6, FLOWERS);
  });
  // A few lone flag trees on the cliff top
  for (const [x, z, s] of [[30, 80, 1.5], [44, 70, 1.3], [58, 76, 1.6], [-40, 78, 1.4], [-30, 84, 1.2], [26, 58, 1.2], [-50, 66, 1.5]] as const) {
    if (ctx.clear(x, z, 2)) windTree(ctx, x, z, s);
  }
  for (const [x, z] of [[36, 64], [52, 60], [-44, 72], [18, 76]] as const) if (ctx.clear(x, z, 1.5)) windRock(ctx, x, z, 1 + r() * 0.8);
  // Station Cliff's waterfall: falls from a spring on the cliff top into the pool below
  const [px, pz] = FALL_POND;
  const topZ = pz + 7.2;
  const topY = ctx.h(px, topZ - 0.8);
  // The waterfall hugs the rock wall (the cliff face has a shell of strata, so it must fall in front of it)
  const hug = (y: number) => {
    for (let o = 0; o < 12; o += 0.2) if (ctx.h(px, topZ - o) <= y) return o + 1.1;
    return 12;
  };
  anim.fall(waterfallGeo(V(px, topY + 0.15, topZ), new THREE.Vector2(0, -1), topY - ctx.h(px, pz) + 1, 1.4, 1.2, hug));
  // Rocks around the spring and small stream stones on the cliff top
  ctx.place(px, topZ + 1.2, 1);
  for (let i = 0; i < 4; i++) ctx.b.add(new THREE.DodecahedronGeometry(0.6 + r() * 0.5, 0), C.rock, M(px + (r() - 0.5) * 3.5, 0.1, topZ + 0.8 + r() * 1.5, r() * 6));
  pond(ctx, anim, px, pz, ctx.h(px, pz + 4.6) - 0.35, 4.4);
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    const x = px + Math.cos(a) * (4.4 + r() * 1.2);
    const z = pz + Math.sin(a) * (4.4 + r() * 1.2);
    if (z > pz + 3) continue;
    reeds(ctx, x, z, 0x6a9a3a, 0x9a7a4a);
  }
  ctx.extras.push((dt, _t, vfx) => {
    if (Math.random() > dt * 8) return;
    vfx.emit({ pos: V(px + (Math.random() - 0.5) * 2, ctx.h(px, pz) + 0.3, pz + 2.5), count: 1, color: [0xffffff, 0xdff4ff], speed: [0.6, 1.4], dir: V(WX * 0.4, 1, WZ * 0.4), spread: 0.6, life: [0.8, 1.5], size: [0.3, 0.5], sizeEnd: 2, intensity: 0.8 });
  });
}

// ───────────────────────── Windherd Meadow ─────────────────────────

function plain(ctx: FieldCtx, anim: Anim): void {
  const { r } = ctx;
  const k = ctx.low ? 0.5 : 1;
  // Dandelion Meadow
  ctx.scatter(Math.round(110 * k), [-26, 14, 6, 40], 0.8, (x, z) => {
    if (r() < 0.75) dandelions(ctx, x, z, 6 + Math.floor(r() * 8));
    else wildflowers(ctx, x, z, 7, FLOWERS);
  });
  // Flag-tree groves scattered over the plain (clump by clump) and big rocks
  const groves: [number, number, number][] = [[-42, 2, 4], [-6, 4, 3], [66, 42, 4], [30, 44, 2], [-34, 34, 2], [72, 8, 3]];
  for (const [gx, gz, n] of groves) {
    for (let i = 0; i < n * k + 1; i++) {
      const x = gx + (r() - 0.5) * 12;
      const z = gz + (r() - 0.5) * 12;
      if (ctx.clear(x, z, 2) && landD(x, z) > 4) windTree(ctx, x, z, 1.2 + r() * 0.8);
    }
    for (let i = 0; i < 4; i++) {
      const x = gx + (r() - 0.5) * 16;
      const z = gz + (r() - 0.5) * 16;
      if (ctx.clear(x, z, 1) && landD(x, z) > 3) windShrub(ctx, x, z, 0.9 + r() * 0.7);
    }
  }
  for (const [x, z, s] of [[-18, 14, 1.8], [8, 18, 1.4], [-30, 26, 1.2], [58, 34, 1.6], [34, 6, 1.3], [-52, 6, 1.5]] as const) if (ctx.clear(x, z, 1)) windRock(ctx, x, z, s);
  // Waymarker cairn
  for (const [x, z] of [[11, 31], [-14, 30], [25, 25], [-47, 16], [22, 8]] as const) cairn(ctx, anim, x, z);
}

// ───────────────────────── Windmill Hill ─────────────────────────

function windmillHill(ctx: FieldCtx, anim: Anim): void {
  const { r } = ctx;
  const [mx, mz] = MILL_HILL;
  windmill(ctx, anim, mx - 5, mz - 1, 8);
  windmill(ctx, anim, mx + 5, mz + 5, 7.2);
  windmill(ctx, anim, mx + 3, mz - 9, 6.5, true);
  // Mill cottage (round stone house, thatched pointed roof)
  hut(ctx, anim, mx + 11, mz + 4, 2.4, 0xd9b870);
  // Flour sacks, handcart, millstone
  ctx.place(mx + 8, mz + 8.5, 1);
  for (let i = 0; i < 5; i++) ctx.b.add(new THREE.SphereGeometry(1, 8, 6), 0xefe4cc, MS(mx + 7 + (i % 3) * 0.7, 0.35 + Math.floor(i / 3) * 0.5, mz + 8.5 + (i % 2) * 0.4, 0.42, 0.36, 0.34, r()));
  ctx.solids.add(mx + 7.7, mz + 8.7, 1.1);
  ctx.place(mx - 1, mz + 7, 1.2);
  ctx.b.add(new THREE.CylinderGeometry(1.1, 1.1, 0.4, 14), C.stone, M(mx - 1, 0.2, mz + 7));
  ctx.b.add(new THREE.CylinderGeometry(1.0, 1.0, 0.35, 14), C.rockLight, M(mx - 1, 0.6, mz + 7, 0, 1, 0, 0.1));
  ctx.solids.add(mx - 1, mz + 7, 1.2);
  stoneWall(ctx, [[mx - 14, mz + 12], [mx - 8, mz + 15], [mx, mz + 16]], 0.7);
  stoneWall(ctx, [[mx + 14, mz - 6], [mx + 16, mz + 2]], 0.7);
}

/** Round stone house: stone walls, thatched pointed roof, door, one lit window */
function hut(ctx: FieldCtx, anim: Anim, x: number, z: number, R: number, thatch: number): void {
  const { b, r } = ctx;
  const g = ctx.place(x, z, R);
  b.add(new THREE.CylinderGeometry(R, R + 0.2, 2.4, 10), C.stone, M(x, 1.1, z));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r();
    b.add(new THREE.DodecahedronGeometry(0.28, 0), C.rockLight, M(x + Math.cos(a) * (R + 0.05), 0.4 + r() * 1.6, z + Math.sin(a) * (R + 0.05), r() * 6));
  }
  b.add(new THREE.ConeGeometry(R * 1.35, R * 1.25, 10), thatch, M(x, 2.3 + R * 0.62, z));
  b.add(BOX, C.woodDark, M(x - WX * R, 0.9, z - WZ * R, WIND_RY).multiply(new THREE.Matrix4().makeScale(0.8, 1.6, 0.2)));
  b.glow(BOX, 0xffe0a0, M(x + WZ * R, 1.4, z - WX * R, WIND_RY + Math.PI / 2).multiply(new THREE.Matrix4().makeScale(0.45, 0.45, 0.1)));
  b.add(CYL, C.woodDark, M(x, 2.4 + R * 1.25 + 0.4, z).multiply(new THREE.Matrix4().makeScale(0.04, 1.2, 0.04)));
  banner(anim.flags, x, g + 2.4 + R * 1.25 + 0.95, z, 1.2, 0.25, [new THREE.Color(C.cloth[2])], r() * 6, 0.6);
  ctx.solids.add(x, z, R + 0.3);
}

// ───────────────────────── Shepherd's Slope ─────────────────────────

function shepherdSlope(ctx: FieldCtx, anim: Anim): void {
  const { r } = ctx;
  const [hx, hz] = HUT;
  hut(ctx, anim, hx, hz, 2.2, 0xc9a860);
  // Dry-stone walls of the sheep pens and field boundaries
  stoneWall(ctx, [[hx + 6, hz + 9], [hx + 14, hz + 11], [hx + 19, hz + 6], [hx + 17, hz - 1], [hx + 10, hz - 2]], 1.0);
  stoneWall(ctx, [[hx - 10, hz + 22], [hx + 2, hz + 18], [hx + 16, hz + 20], [hx + 26, hz + 16]], 0.8);
  stoneWall(ctx, [[hx - 14, hz - 8], [hx - 4, hz - 14], [hx + 10, hz - 16]], 0.8);
  // Hay bales, water trough
  for (const [dx, dz] of [[3.5, -3], [4.5, -1.2], [3, 3.2]] as const) {
    ctx.place(hx + dx, hz + dz, 0.6);
    ctx.b.add(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10), 0xe0c070, M(hx + dx, 0.6, hz + dz, r(), 1, Math.PI / 2, 0));
    ctx.solids.add(hx + dx, hz + dz, 0.7);
  }
  ctx.place(hx + 12, hz + 4, 1);
  ctx.b.add(BOX, C.wood, M(hx + 12, 0.35, hz + 4, 0.4).multiply(new THREE.Matrix4().makeScale(2.2, 0.6, 0.8)));
  ctx.b.add(BOX, 0x5a9ac8, M(hx + 12, 0.62, hz + 4, 0.4).multiply(new THREE.Matrix4().makeScale(2, 0.05, 0.6)), false);
  ctx.solids.add(hx + 12, hz + 4, 1.2);
  // Shepherds' flags and waymarkers
  flagPole(ctx, anim, hx - 4, hz + 3, 5, [C.cloth[2], C.cloth[4]], 2.4);
  for (const [x, z] of [[-52, 50], [-60, 26], [-58, 12]] as const) cairn(ctx, anim, x, z);
  // Flag trees and rocks on the slope
  for (let i = 0; i < 8; i++) {
    const x = -80 + r() * 30;
    const z = 14 + r() * 44;
    if (ctx.clear(x, z, 2) && landD(x, z) > 5 && !near(x, z, HUT, 8)) windTree(ctx, x, z, 1.1 + r() * 0.6, C.leavesDry);
  }
  for (let i = 0; i < 10; i++) {
    const x = -84 + r() * 36;
    const z = 10 + r() * 50;
    if (ctx.clear(x, z, 1) && landD(x, z) > 3 && !ctx.solids.blocked(x, z, 1.5)) windRock(ctx, x, z, 0.7 + r() * 0.9);
  }
}

// ───────────────────────── Letter Crane Cliff ─────────────────────────

function letterShrine(ctx: FieldCtx, anim: Anim, glow: GlowSet): void {
  const { b, r } = ctx;
  const [sx, sz] = SHRINE;
  // Torii-like wooden gate (the couriers' gate)
  const gx = sx - 7;
  const gz = sz;
  const g = ctx.place(gx, gz, 2);
  for (const s of [-1, 1]) {
    b.add(CYL, 0x3f8fae, M(gx, 2.4, gz + s * 2).multiply(new THREE.Matrix4().makeScale(0.22, 4.8, 0.22)));
    ctx.solids.add(gx, gz + s * 2, 0.35);
  }
  b.add(BOX, 0x3f8fae, M(gx, 4.9, gz).multiply(new THREE.Matrix4().makeScale(0.35, 0.3, 5.6)));
  b.add(BOX, 0xf2eadb, M(gx, 4.2, gz).multiply(new THREE.Matrix4().makeScale(0.22, 0.22, 4.4)));
  b.add(BOX, 0xf2c66a, M(gx + 0.12, 4.55, gz).multiply(new THREE.Matrix4().makeScale(0.06, 0.5, 0.9)));
  for (const s of [-1.5, 0, 1.5]) featherFlag(anim, gx, g + 4.1, gz + s, new THREE.Color(0xfbfaf2), r() * 6, 1.2);
  // Letter Tree: an old flag tree, its branches tied full of letters addressed to faraway places
  const tx = sx - 1;
  const tz = sz - 4.5;
  windTree(ctx, tx, tz, 2.1);
  const tg = ctx.h(tx, tz);
  for (let i = 0; i < 26; i++) {
    const u = r();
    const px = tx + WX * (u * 4.2 - 0.5) + (r() - 0.5) * 2.2;
    const pz = tz + WZ * (u * 4.2 - 0.5) + (r() - 0.5) * 2.2;
    const py = tg + 3.4 + (r() - 0.3) * 1.6 - u * 0.8;
    featherFlag(anim, px, py, pz, new THREE.Color(r() < 0.8 ? 0xfbfaf2 : 0xf6e6c0), r() * 6, 0.5);
  }
  // Stone altar with letters on it
  const ax = sx + 3.5;
  const az = sz - 2;
  ctx.place(ax, az, 1);
  b.add(BOX, C.stone, M(ax, 0.45, az, 0.3).multiply(new THREE.Matrix4().makeScale(1.6, 0.9, 1.0)));
  b.add(BOX, C.rockLight, M(ax, 0.95, az, 0.3).multiply(new THREE.Matrix4().makeScale(1.9, 0.12, 1.2)));
  for (let i = 0; i < 6; i++) b.add(BOX, 0xfbfaf2, M(ax + (r() - 0.5) * 1.2, 1.05 + i * 0.03, az + (r() - 0.5) * 0.6, r() * 3).multiply(new THREE.Matrix4().makeScale(0.36, 0.02, 0.24)), false);
  ctx.solids.add(ax, az, 1.1);
  // Stone lantern
  for (const [lx, lz] of [[sx - 3.5, sz + 3.5], [sx - 3.5, sz - 7.5], [sx + 5.5, sz + 1.5]] as const) {
    ctx.place(lx, lz, 0.5);
    b.add(new THREE.CylinderGeometry(0.28, 0.4, 1.4, 6), C.stone, M(lx, 0.7, lz));
    b.add(new THREE.ConeGeometry(0.6, 0.5, 6), C.rockDark, M(lx, 1.95, lz));
    glow.add(new THREE.BoxGeometry(0.42, 0.42, 0.42), M(lx, ctx.b.lift + 1.55, lz, Math.PI / 4));
    ctx.solids.add(lx, lz, 0.5);
  }
  // Flock of paper cranes: circling the headland
  const fl = anim.flock(sx + 4, tg + 6, sz, -0.32);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3;
    const rr = 6 + r() * 7;
    bird(fl, sx + 4 + Math.cos(a) * rr, tg + 3 + r() * 6, sz + Math.sin(a) * rr, -a + Math.PI, 0.5 + r() * 0.2, new THREE.Color([0xfbfaf2, 0xf2d6e0, 0xd6ecf6, 0xf8ecc8][i % 4]), r() * 6, true);
  }
  for (const [x, z] of [[76, 22], [80, 30]] as const) cairn(ctx, anim, x, z, 1.2);
}

// ───────────────────────── Skyridge and the chasm ─────────────────────────

function ridge(ctx: FieldCtx, anim: Anim, loops: RimPoint[][]): void {
  const { b, r } = ctx;
  // Wind gate: two stone pillars and a crossbeam at the south end of Skyridge, with wind chimes hanging from the beam
  const gz = 6;
  const gx = 21;
  const cols = [0xd8cfbc, 0xc4b8a2];
  for (const s of [-1, 1]) {
    const x = gx + s * 4.7;
    ctx.place(x, gz, 1);
    for (let i = 0; i < 5; i++) b.add(new THREE.CylinderGeometry(0.72 - i * 0.04, 0.8 - i * 0.04, 1.5, 8), cols[i % 2], M(x, 0.75 + i * 1.5, gz, i * 0.4));
    b.add(BOX, C.rockDark, M(x, 7.7, gz).multiply(new THREE.Matrix4().makeScale(1.9, 0.5, 1.9)));
    b.glow(new THREE.OctahedronGeometry(0.28), 0x8ff5e0, M(x, 8.35, gz));
    ctx.solids.add(x, gz, 1.0);
  }
  b.lift = 0;
  const y0 = ctx.h(gx, gz);
  b.add(BOX, C.woodDark, M(gx, y0 + 7.1, gz).multiply(new THREE.Matrix4().makeScale(11.4, 0.45, 0.5)));
  b.add(BOX, 0x3f8fae, M(gx, y0 + 6.55, gz).multiply(new THREE.Matrix4().makeScale(9.5, 0.3, 0.35)));
  for (let i = 0; i < 5; i++) {
    const x = gx - 3 + i * 1.5;
    b.add(CYL, C.rope, M(x, y0 + 6.1, gz).multiply(new THREE.Matrix4().makeScale(0.02, 0.8, 0.02)), false);
    b.add(new THREE.CylinderGeometry(0.12, 0.22, 0.34, 8), 0xf2c66a, M(x, y0 + 5.6, gz));
  }
  banner(anim.flags, gx - 5.5, y0 + 7.2, gz, 2.6, 0.5, [new THREE.Color(C.cloth[0]), new THREE.Color(C.cloth[1])], 0.4, 0.8, true);
  // Rope fences on both sides of Skyridge
  const road: XZ[] = [[21.2, 8], [21, 4], [19.8, -3], [21.2, -11], [20, -19], [18.6, -24]];
  for (const s of [-1, 1]) {
    const rail: XZ[] = road.map(([x, z], i) => {
      const [nx, nz] = road[Math.min(i + 1, road.length - 1)];
      const [px, pz] = road[Math.max(i - 1, 0)];
      const dx = nx - px;
      const dz = nz - pz;
      const l = Math.hypot(dx, dz);
      return [x + (-dz / l) * s * 3.9, z + (dx / l) * s * 3.9];
    });
    flagRail(ctx, anim, rail.slice(1), 3.4);
  }
  // The chasm's waterfalls: gushing from springs in the rock walls on both sides, falling all the way into the cloud sea
  for (const [x, z, w] of [[46, -3.5, 2], [8, -22, 1.6], [72, -24, 1.8], [-4, -3.5, 1.2], [88, -1, 1.5]] as const) {
    const p = nearestRim(loops, x, z);
    const hr = rimHeight(ctx, p);
    const top = V(p.x + p.nx * 0.4, hr - 1.6, p.z + p.nz * 0.4);
    anim.fall(waterfallGeo(top, new THREE.Vector2(p.nx, p.nz), hr - SEA + 2, w, 2.5));
    ctx.b.lift = 0;
    for (let i = 0; i < 3; i++) b.add(new THREE.DodecahedronGeometry(0.5 + r() * 0.5, 0), STRATA[4], M(top.x - p.nz * (i - 1) * w * 0.6, top.y - 0.2, top.z + p.nx * (i - 1) * w * 0.6, r() * 6));
  }
  // Mist rising in the chasm
  ctx.extras.push((dt, _t, vfx) => {
    if (Math.random() > dt * 3) return;
    const x = -20 + Math.random() * 110;
    const z = -10 + (Math.random() - 0.5) * 10;
    if (landD(x, z) > -2) return;
    vfx.emit({ pos: V(x, SEA + 1, z), count: 1, color: [0xffffff, 0xe6eefa], speed: [1, 2], dir: V(WX * 0.5, 1, WZ * 0.5), spread: 0.3, life: [4, 6], size: [1.5, 2.5], sizeEnd: 3, intensity: 0.5 });
  });
}

// ───────────────────────── Windsong Terrace ─────────────────────────

function stoneForest(ctx: FieldCtx, anim: Anim): void {
  const { r } = ctx;
  const k = ctx.low ? 0.6 : 1;
  // Natural stone arch spanning the walkway
  stoneArch(ctx, -63.1, -44.9, Math.atan2(-6, 14), 8, 6.5, STRATA);
  stoneArch(ctx, -79, -50.5, 0.4, 6.5, 5, STRATA);
  // Rock pillars
  const spots: [number, number, number, number][] = [
    [-70, -32, 11, 1.8], [-88, -40, 14, 2.1], [-54, -38, 7, 1.4], [-66, -62, 16, 2.2], [-50, -80, 12, 1.9],
    [-74, -76, 10, 1.7], [-86, -54, 9, 1.5], [-62, -86, 13, 2], [-40, -70, 8, 1.4], [-80, -30, 7, 1.3],
    [-72, -54, 6, 1.2], [-58, -66, 9, 1.5], [-92, -76, 11, 1.8], [-46, -90, 7, 1.3],
  ];
  spots.forEach(([x, z, h, w], i) => {
    if (ctx.low && i % 3 === 2) return;
    if (!ctx.clear(x, z, w + 1) || landD(x, z) < w + 2) return;
    hoodoo(ctx, x, z, h, w, [STRATA[i % 5], STRATA[(i + 2) % 5], STRATA[(i + 3) % 5]]);
  });
  // Trees on top of the small rock shelf
  for (const [x, z, s] of [[-76, -44, 1.5], [-56, -73, 1.3], [-82, -66, 1.2], [-70, 8, 1.4]] as const) windTree(ctx, x, z, s, C.leavesDry);
  // Wind-eroded rocks and withered yellow shrubs
  for (let i = 0; i < 26 * k; i++) {
    const x = -94 + r() * 56;
    const z = -94 + r() * 70;
    if (!ctx.clear(x, z, 1) || landD(x, z) < 3 || ctx.solids.blocked(x, z, 1.5)) continue;
    if (r() < 0.55) windRock(ctx, x, z, 0.7 + r() * 1.3, r() < 0.5 ? C.rock : C.rockLight);
    else windShrub(ctx, x, z, 0.8 + r() * 0.6, C.leavesDry);
  }
  for (const [x, z] of [[-60, -20], [-65, -36], [-52, -50]] as const) cairn(ctx, anim, x, z);
}

/**
 * Windsong Stone Ring: a ring of slabs with holes blown through them by the wind, which sing when the wind passes;
 * a wooden frame in the middle hangs wind chimes
 */
function singingRing(ctx: FieldCtx, anim: Anim, glow: GlowSet): void {
  const { b, r } = ctx;
  const [cx, cz] = RING;
  const R = 8.5;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.15;
    const x = cx + Math.cos(a) * R;
    const z = cz + Math.sin(a) * R;
    if (ctx.pathDist(x, z) < 3.2) continue;
    const h = 4 + r() * 2.8;
    const g = ctx.place(x, z, 0.8);
    const f = -a + Math.PI / 2;
    b.add(BOX, i % 2 ? 0xd8cfbc : 0xc9bea8, M(x, h / 2 - 0.3, z, f, 1, 0, (r() - 0.5) * 0.08).multiply(new THREE.Matrix4().makeScale(1.35, h, 0.5)));
    // Wind-eroded holes (a dark disc on each face)
    for (const hy of [h * 0.62, h * 0.35]) {
      if (hy < h * 0.4 && r() < 0.5) continue;
      for (const s of [-1, 1]) {
        const ox = Math.cos(a) * 0.27 * s;
        const oz = Math.sin(a) * 0.27 * s;
        b.add(new THREE.CircleGeometry(0.24, 10), 0x4a4250, M(x + ox, hy, z + oz, f + (s > 0 ? 0 : Math.PI) + Math.PI / 2, 1), false);
      }
    }
    b.add(BOX, C.rockDark, M(x, h - 0.2, z, f).multiply(new THREE.Matrix4().makeScale(1.5, 0.3, 0.62)));
    // Cloth strips tied to the tops of the slabs
    featherFlag(anim, x, g + h - 0.1, z, new THREE.Color(C.cloth[i % C.cloth.length]), r() * 6, 1.3);
    ctx.solids.add(x, z, 0.8);
  }
  // Center: stone altar and glowing wind patterns
  const g = ctx.place(cx, cz, 1.5);
  b.add(new THREE.CylinderGeometry(1.6, 1.8, 0.45, 10), C.stone, M(cx, 0.2, cz));
  glow.add(new THREE.TorusGeometry(1.1, 0.06, 4, 24), M(cx, g + 0.47, cz, 0, 1, Math.PI / 2));
  glow.add(new THREE.OctahedronGeometry(0.3), M(cx, g + 1.2, cz));
  ctx.solids.add(cx, cz, 1.7);
  // After the Seal Tower is purified, the stone ring "sings" again: a large spinning wind crystal floats above the altar,
  // and light motes spiral up with the wind
  if (ctx.done >= ctx.floors) {
    const pivot = new THREE.Group();
    pivot.position.set(cx, g + 3.3, cz);
    const geo = new THREE.OctahedronGeometry(0.85, 0).scale(0.7, 1.6, 0.7);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8ff5e0).multiplyScalar(2.3), toneMapped: false });
    pivot.add(new THREE.Mesh(geo, mat));
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(geo, mat);
      const a = (i / 3) * Math.PI * 2;
      m.position.set(Math.cos(a) * 1.9, -0.5, Math.sin(a) * 1.9);
      m.scale.setScalar(0.35);
      pivot.add(m);
    }
    ctx.group.add(pivot);
    anim.spinners.push({ obj: pivot, axis: 'y', speed: 0.7 });
    anim.bobbers.push({ obj: pivot, amp: 0.25, speed: 0.8, phase: 0, base: g + 3.3 });
    ctx.disposers.push(() => {
      geo.dispose();
      mat.dispose();
    });
    let acc = 0;
    ctx.extras.push((dt, t, vfx) => {
      acc += dt;
      if (acc < 0.09) return;
      acc = 0;
      const a = t * 2.2;
      vfx.emit({ pos: V(cx + Math.cos(a) * 2.2, g + 0.6, cz + Math.sin(a) * 2.2), count: 1, color: [0xdffcff, 0x8ff5e0], speed: [1.4, 2.4], dir: V(WX * 0.3, 1, WZ * 0.3), spread: 0.25, life: [1.6, 2.4], size: [0.22, 0.34], sizeEnd: 0.05, intensity: 1.2 });
    });
  }
  // Wind chime frame: a three-legged wooden frame hung with a string of swaying tubes (swayed with the flag shader)
  const fx = cx + 3.2;
  const fz = cz + 2.8;
  const fg = ctx.place(fx, fz, 1);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(CYL, C.woodDark, segM(V(fx + Math.cos(a) * 1.2, 0, fz + Math.sin(a) * 1.2), V(fx, 3.2, fz), 0.06));
  }
  const brass = new THREE.Color(0xe8c070);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = fx + Math.cos(a) * 0.35;
    const z = fz + Math.sin(a) * 0.35;
    const L = 0.6 + (i % 3) * 0.25;
    const top = fg + 3.0;
    const w = 0.05;
    anim.flags.quad([x - w, top, z], [x + w, top, z], [x + w, top - L, z], [x - w, top - L, z], brass, [0, 0, 0.6, 0.6], i * 0.9);
    anim.flags.quad([x, top, z - w], [x, top, z + w], [x, top - L, z + w], [x, top - L, z - w], brass, [0, 0, 0.6, 0.6], i * 0.9);
  }
  ctx.solids.add(fx, fz, 1.1);
}

function towerMesa(ctx: FieldCtx, anim: Anim, glow: GlowSet): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWER;
  // Flag array on the edge of the tower terrace (leaving the front road clear)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const x = tx + Math.sin(a) * 25.5;
    const z = tz + Math.cos(a) * 25.5;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.45) continue;
    if (landD(x, z) < 3 || ctx.pathDist(x, z) < 3.5) continue;
    flagPole(ctx, anim, x, z, 9 + (i % 2) * 2, i % 2 ? [C.cloth[0], C.cloth[1]] : [C.cloth[2], C.cloth[1], C.cloth[2]], 4.5);
  }
  // Wing Folk guardian statues atop the tower terrace's slope
  for (const [x, z, f] of [[-10.5, -49.5, 0.3], [3, -50, -0.3]] as const) guardian(ctx, glow, x, z, f);
  // Scattered rune stones
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = 23 + r() * 5;
    const x = tx + Math.cos(a) * d;
    const z = tz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1) || landD(x, z) < 3) continue;
    ctx.place(x, z, 0.5);
    b.add(BOX, 0xd8cfbc, M(x, 0.9, z, r() * 3, 1, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2).multiply(new THREE.Matrix4().makeScale(0.9, 2.2, 0.4)));
    b.glow(new THREE.BoxGeometry(0.12, 1.1, 0.46), 0x8ff5e0, M(x, 1.0, z, 0));
    ctx.solids.add(x, z, 0.7);
  }
}

/** Wing Folk guardian statue: a robed figure on a stone pedestal, with two huge stone wings spread out behind */
function guardian(ctx: FieldCtx, glow: GlowSet, x: number, z: number, f: number): void {
  const { b } = ctx;
  const g = ctx.place(x, z, 1.5);
  b.add(BOX, 0xc4b8a2, M(x, 0.6, z, f).multiply(new THREE.Matrix4().makeScale(2.6, 1.2, 2.6)));
  b.add(BOX, 0xd8cfbc, M(x, 1.35, z, f).multiply(new THREE.Matrix4().makeScale(2.1, 0.3, 2.1)));
  b.add(new THREE.CylinderGeometry(0.55, 1.0, 3.6, 8), 0xe4dccb, M(x, 3.3, z, f));
  b.add(new THREE.SphereGeometry(0.5, 10, 8), 0xe4dccb, M(x, 5.45, z));
  b.add(new THREE.ConeGeometry(0.55, 0.7, 8), 0xd8cfbc, M(x, 5.95, z));
  for (const s of [-1, 1]) {
    const wing = new THREE.BoxGeometry(0.25, 4.2, 1.5);
    wing.translate(0, 2.1, 0);
    b.add(wing, 0xd8cfbc, new THREE.Matrix4().compose(V(x + Math.cos(f) * s * 0.5 - Math.sin(f) * 0.4, 3.2, z - Math.sin(f) * s * 0.5 - Math.cos(f) * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, f, s * 0.55)), V(1, 1, 1)));
    const tip = new THREE.BoxGeometry(0.2, 2.2, 1.0);
    tip.translate(0, 1.1, 0);
    b.add(tip, 0xc9bea8, new THREE.Matrix4().compose(V(x + Math.cos(f) * s * 2.3 - Math.sin(f) * 0.9, 6.3, z - Math.sin(f) * s * 2.3 - Math.cos(f) * 0.9), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, f, s * 1.0)), V(1, 1, 1)));
  }
  glow.add(new THREE.OctahedronGeometry(0.28), M(x + Math.sin(f) * 0.6, g + 4.2, z + Math.cos(f) * 0.6));
  ctx.solids.add(x, z, 1.6);
}

// ───────────────────────── Floatstone Hollow ─────────────────────────

function basin(ctx: FieldCtx, anim: Anim, glow: GlowSet): void {
  const { b, r } = ctx;
  const [bx, bz] = BASIN;
  pond(ctx, anim, POND[0], POND[1], BASIN_H - 0.25, 4.6);
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 4.6 + r() * 1.2;
    reeds(ctx, POND[0] + Math.cos(a) * d, POND[1] + Math.sin(a) * d, 0x5a9a3a, 0x8a6a3a);
  }
  // Spray and mist
  ctx.extras.push((dt, _t, vfx) => {
    if (Math.random() > dt * 10) return;
    vfx.emit({ pos: V(POND[0] + (Math.random() - 0.5) * 2, BASIN_H + 0.1, POND[1] + (Math.random() - 0.5) * 2), count: 1, color: [0xffffff, 0xdff4ff], speed: [1, 2.5], dir: V(0, 1, 0), spread: 0.9, life: [0.6, 1.2], size: [0.3, 0.6], sizeEnd: 2.2, intensity: 0.8 });
  });
  // Wind crystal clusters at the hollow's edge
  const cr = new THREE.OctahedronGeometry(0.5);
  cr.scale(0.55, 2.2, 0.55);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.4;
    const d = BASIN_R - 3 + r() * 2;
    const x = bx + Math.cos(a) * d;
    const z = bz + Math.sin(a) * d;
    if (landD(x, z) < 3 || ctx.pathDist(x, z) < 3) continue;
    const g = ctx.place(x, z, 0.5);
    for (let k = 0; k < 3; k++) glow.add(cr.clone(), M(x + (r() - 0.5) * 0.9, g + 0.5, z + (r() - 0.5) * 0.9, r() * 6, 0.6 + r() * 0.7, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
    ctx.solids.add(x, z, 0.6);
  }
  // Mossy rocks, flowers, shrubs
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * (BASIN_R - 2);
    const x = bx + Math.cos(a) * d;
    const z = bz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0.5) || landD(x, z) < 2.5 || near(x, z, POND, 6)) continue;
    const t = r();
    if (t < 0.45) wildflowers(ctx, x, z, 8, [0xffc3d8, 0xc8a8f0, 0xfff6ec, 0x9ad0f0]);
    else if (t < 0.75) windShrub(ctx, x, z, 0.8 + r() * 0.5, [0x4f9a52, 0x5eae5a, 0x46905a]);
    else {
      ctx.place(x, z, 0.6);
      b.add(new THREE.DodecahedronGeometry(0.7 + r() * 0.5, 0), C.rockDark, M(x, 0.25, z, r() * 6));
      b.add(new THREE.IcosahedronGeometry(0.6, 1), 0x5e9e52, MS(x, 0.55, z, 0.9, 0.35, 0.9, r()), false);
      ctx.solids.add(x, z, 0.8);
    }
  }
  // Stone platform under the treasure chest
  const [cx, cz] = ctx.layout.chests[5];
  const g = ctx.place(cx, cz, 1.4);
  b.add(new THREE.CylinderGeometry(1.5, 1.7, 0.3, 8), C.stone, M(cx, -0.05, cz));
  glow.add(new THREE.TorusGeometry(1.25, 0.05, 4, 24), M(cx, g + 0.12, cz, 0, 1, Math.PI / 2));
  // Rock cleft entrance: rock blocks on both sides and a crooked tree block the view
  for (const [x, z, s] of [[29, -28.5, 1.6], [33, -38, 1.4], [27, -35.5, 1.1]] as const) if (ctx.clear(x, z, 0.5)) windRock(ctx, x, z, s, C.rockLight);
  windTree(ctx, 36, -31, 1.5);
}

// ───────────────────────── Scattered across the whole area ─────────────────────────

function scatterAll(ctx: FieldCtx, anim: Anim): void {
  const { r } = ctx;
  const k = ctx.low ? 0.5 : 1;
  const S = ctx.layout.size - 26;
  const [tx, tz] = TOWN;
  // Flag trees: scattered everywhere, more of them near the cliff edge
  for (let i = 0; i < 110 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = landD(x, z);
    if (d < 4 || d > 22 + r() * 30) continue;
    if (!ctx.clear(x, z, 2.5) || ctx.solids.blocked(x, z, 2) || near(x, z, [tx, tz], 26) || near(x, z, BASIN, BASIN_R + 2)) continue;
    const dry = x < -40;
    if (r() < 0.55) windTree(ctx, x, z, 1 + r() * 0.8, dry ? C.leavesDry : C.leaves);
    else windShrub(ctx, x, z, 0.8 + r() * 0.8, dry ? C.leavesDry : C.leaves);
  }
  // Small stones
  for (let i = 0; i < 90 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    if (landD(x, z) < 2.5 || !ctx.clear(x, z, 0.5) || ctx.solids.blocked(x, z, 1)) continue;
    ctx.place(x, z, 0.3);
    ctx.b.add(new THREE.DodecahedronGeometry(0.25 + r() * 0.35, 0), r() < 0.5 ? C.rock : C.rockLight, M(x, 0.1, z, r() * 6, 1, r(), r()));
  }
  // Dandelions, wildflowers (sparse across the whole area)
  for (let i = 0; i < 160 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    if (landD(x, z) < 3 || !ctx.clear(x, z, 0.3) || ctx.solids.blocked(x, z, 0.8)) continue;
    if (r() < 0.55) dandelions(ctx, x, z, 3 + Math.floor(r() * 4));
    else wildflowers(ctx, x, z, 4, FLOWERS);
  }
  // Tall grass clumps along the roads and cliff edges (they sway with the wind)
  for (let i = 0; i < 700 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = landD(x, z);
    const pd = ctx.pathDist(x, z);
    const edge = (d > 1.8 && d < 6) || (pd > 3 && pd < 6);
    if (!edge || d < 1.8 || ctx.solids.blocked(x, z, 0.4) || near(x, z, [tx, tz], 13)) continue;
    tuft(ctx, anim, x, z, 1.1 + r() * 0.8, x < -40);
  }
}

/** Cliff edge: small rock piles, flag trees leaning against the cliff edge, waymarker cairns */
function rimDecor(ctx: FieldCtx, anim: Anim, loops: RimPoint[][]): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWN;
  const step = ctx.low ? 6 : 3;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i += step) {
      const p = loop[i];
      const o = 1.6 + r() * 2.2;
      const x = p.x - p.nx * o;
      const z = p.z - p.nz * o;
      if (near(x, z, [tx, tz], 22) || !ctx.clear(x, z, 0.5) || ctx.solids.blocked(x, z, 0.9)) continue;
      const t = r();
      if (t < 0.4) {
        ctx.place(x, z, 0.6);
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) b.add(new THREE.DodecahedronGeometry(0.35 + r() * 0.55, 0), [C.rock, C.rockLight, C.rockDark][k % 3], M(x + (r() - 0.5) * 1.4, 0.15, z + (r() - 0.5) * 1.4, r() * 6, 1, r(), r()));
      } else if (t < 0.46 && landD(x, z) > 2) {
        windTree(ctx, x, z, 1.1 + r() * 0.6, x < -40 ? C.leavesDry : C.leaves);
      } else if (t < 0.48) {
        cairn(ctx, anim, x, z, 0.9);
      }
    }
  }
}

export function buildWild(ctx: FieldCtx, anim: Anim, loops: RimPoint[][]): void {
  const glow = new GlowSet(0x8ff5e0);
  const warm = new GlowSet(0xffd890);
  crest(ctx, anim);
  plain(ctx, anim);
  windmillHill(ctx, anim);
  shepherdSlope(ctx, anim);
  letterShrine(ctx, anim, warm);
  ridge(ctx, anim, loops);
  stoneForest(ctx, anim);
  singingRing(ctx, anim, glow);
  towerMesa(ctx, anim, glow);
  basin(ctx, anim, glow);
  rimDecor(ctx, anim, loops);
  scatterAll(ctx, anim);
  ctx.b.lift = 0;
  const setGlow = glow.build(ctx.group, ctx.disposers);
  const setWarm = warm.build(ctx.group, ctx.disposers);
  anim.ticks.push((_dt, t) => {
    setGlow(1.9 + Math.sin(t * 1.6) * 0.45);
    setWarm(2.1 + Math.sin(t * 1.1 + 1) * 0.2);
  });
}
