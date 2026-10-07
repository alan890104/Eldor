// Buildings of the Outer City and the main island of the holy city: the fountain plaza and the white-walled blue-roofed houses
// around it, the domed chapel, the pilgrims' inn, the North Gate, the Cloudedge Terrace; to the north the curved retaining wall and
// grand stair, and on the upper tier the plaza in front of the Cathedral, the obelisk, the Dawnlight Spring, the Belfry (the bell
// swings), the Holy Gate and Holy Bridge leading to the Seal Tower, and the Garden Bridge to the east.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { catenary, segM } from '../../../arenas/_woods.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import { sceneMaterial } from '../../../spiritToon.ts';
import { inkScenery } from '../../../ink.ts';
import { C, angel, balustrade, belfry, bench, cathedral, column, cypress, flowerTree, frame, lamp, obelisk, solidRect, statue, toWorld, townhouse } from './arch.ts';
import { cloudPuff, type Banners } from './sky.ts';
import * as SH from './shape.ts';

const Box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const Cyl = (a: number, b: number, h: number, n = 10) => new THREE.CylinderGeometry(a, b, h, n);

export interface Mats {
  water: THREE.ShaderMaterial;
  fall: THREE.ShaderMaterial;
  banners: Banners;
}

/**
 * Multi-tier fountain: outer basin, central column, upper water bowl and a falling curtain of water, with an
 * angel statue on top; returns where the spray comes out
 */
export function fountain(ctx: FieldCtx, mats: Mats, x: number, z: number, R: number, s = 1): THREE.Vector3 {
  const { b } = ctx;
  const at = frame(ctx, x, z, 0, R * 0.7);
  const y0 = ctx.b.lift;
  b.add(Cyl(R, R + 0.35, 1.1, 36), C.stone, at(M(0, 0.2, 0)));
  b.add(new THREE.TorusGeometry(R - 0.12, 0.24, 6, 36), C.stoneDark, at(M(0, 0.8, 0, 0, 1, Math.PI / 2)));
  b.add(new THREE.TorusGeometry(R + 0.05, 0.06, 4, 36), C.gold, at(M(0, 0.55, 0, 0, 1, Math.PI / 2)), false);
  const w1 = new THREE.Mesh(new THREE.CircleGeometry(R - 0.3, 36), mats.water);
  w1.rotation.x = -Math.PI / 2;
  w1.position.set(x, y0 + 0.78, z);
  ctx.group.add(w1);
  const r2 = R * 0.42;
  b.add(Cyl(0.9 * s, 1.3 * s, 2.4, 14), C.stoneDark, at(M(0, 1.9, 0)));
  b.add(Cyl(r2, 0.8 * s, 0.6, 28), C.stone, at(M(0, 3.1, 0)));
  b.add(new THREE.TorusGeometry(r2 - 0.08, 0.14, 5, 28), C.gold, at(M(0, 3.42, 0, 0, 1, Math.PI / 2)));
  const w2 = new THREE.Mesh(new THREE.CircleGeometry(r2 - 0.15, 28), mats.water);
  w2.rotation.x = -Math.PI / 2;
  w2.position.set(x, y0 + 3.4, z);
  ctx.group.add(w2);
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(r2 + 0.05, r2 + 0.5, 2.6, 36, 1, true), mats.fall);
  sheet.position.set(x, y0 + 2.1, z);
  sheet.renderOrder = 4;
  ctx.group.add(sheet);
  b.add(Cyl(0.4 * s, 0.5 * s, 1.5, 10), C.stone, at(M(0, 4.1, 0)));
  angel(ctx, at, 0, 4.85, 0, 0, s);
  ctx.solids.add(x, z, R + 0.3);
  return new THREE.Vector3(x, y0 + 3.5, z);
}

/** Small stall: four gold posts, a slanted blue-and-white striped cloth canopy, goods laid out on a stone counter */
function stall(ctx: FieldCtx, x: number, z: number, face: number, cloth: number): void {
  const { b, r } = ctx;
  const at = frame(ctx, x, z, face, 1.4);
  for (const [px, pz] of [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.8], [1.3, 0.8]] as const) b.add(Cyl(0.06, 0.07, 2.6, 5), C.gold, at(M(px, 1.3, pz)), false);
  for (let i = 0; i < 5; i++) b.add(Box(0.58, 0.08, 1.9), i % 2 ? 0xf6f2ea : cloth, at(M(-1.16 + i * 0.58, 2.62, 0.05, 0, 1, 0.22)), false);
  b.add(Box(2.5, 0.95, 0.9), C.stone, at(M(0, 0.48, 0.2)));
  b.add(Box(2.7, 0.1, 1.05), C.stoneDark, at(M(0, 0.98, 0.2)));
  for (let i = 0; i < 6; i++) {
    const g = i % 2 ? new THREE.SphereGeometry(0.16, 8, 6) : new THREE.BoxGeometry(0.28, 0.2, 0.28);
    b.add(g, [0xffd27a, 0xf29aa8, 0xa8d8ff, 0xfff4d8][i % 4], at(M(-0.9 + i * 0.36, 1.12, 0.2 + (r() - 0.5) * 0.4)), false);
  }
  ctx.solids.add(x, z, 1.6);
}

/** Telescope (on the Cloudedge Terrace) */
function telescope(ctx: FieldCtx, x: number, z: number, face: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, face, 0.5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(Cyl(0.04, 0.04, 1.5, 4), C.goldDeep, at(M(Math.cos(a) * 0.3, 0.7, Math.sin(a) * 0.3, 0, 1, Math.sin(a) * 0.25, -Math.cos(a) * 0.25)), false);
  }
  b.add(Cyl(0.1, 0.16, 1.4, 8), C.gold, at(M(0, 1.55, 0.2, 0, 1, 1.25)));
  b.glow(new THREE.CircleGeometry(0.15, 8), 0xbfe6ff, at(M(0, 1.4, 0.88, 0, 1, 0)));
  ctx.solids.add(x, z, 0.5);
}

// ───────────────────────── Outer City ─────────────────────────

export function buildTown(ctx: FieldCtx, mats: Mats): THREE.Vector3 {
  const [tx, tz] = SH.TOWN;
  // Central fountain
  const spray = fountain(ctx, mats, tx, tz, 5.6, 1.1);
  // Houses around the plaza (doors facing the fountain), leaving the main road open to the north and the
  // passage to the Cloudedge Terrace open to the south
  const ring: [number, number, number, number, number, Partial<Parameters<typeof townhouse>[4]>][] = [
    [-128, 16.8, 7, 6, 6.4, { turret: -1 }],
    [-52, 16.8, 7, 6, 6.8, { turret: 1 }],
    [-156, 16.2, 6.4, 6, 5.6, { flowers: true }],
    [-24, 16.2, 6.4, 6, 5.8, { flowers: true, roof: C.roofTeal }],
    [22, 16.4, 6.6, 6, 6.2, { flowers: true }],
    [158, 16.4, 6.6, 6, 6.0, { flowers: true, roof: C.roofTeal }],
    [48, 16.8, 6.2, 5.8, 5.4, { roof: C.roof2 }],
    [132, 16.8, 6.2, 5.8, 5.6, { roof: C.roof2 }],
  ];
  for (const [deg, rr, w, d, h, o] of ring) {
    const a = (deg * Math.PI) / 180;
    const x = tx + Math.cos(a) * rr;
    const z = tz + Math.sin(a) * rr;
    townhouse(ctx, x, z, Math.atan2(tx - x, tz - z), { w, d, h, ...o });
  }
  // Domed chapel on the west side, pilgrims' inn on the east side
  townhouse(ctx, tx - 17, tz, Math.PI / 2, { w: 7.5, d: 9.5, h: 7.2, dome: C.gold, roof: C.roof2 });
  townhouse(ctx, tx + 17, tz + 0.5, -Math.PI / 2, { w: 8.5, d: 9, h: 7.6, turret: 1, flowers: true });
  // Small bell frame in front of the chapel
  {
    const { b } = ctx;
    const at = frame(ctx, tx - 10.8, tz - 4.8, Math.PI / 2, 0.6);
    for (const s of [-1, 1]) b.add(Box(0.3, 3.2, 0.3), C.wall, at(M(s * 0.7, 1.6, 0)));
    b.add(Box(1.9, 0.3, 0.4), C.stoneDark, at(M(0, 3.25, 0)));
    b.add(new THREE.ConeGeometry(0.34, 0.5, 10, 1, true), C.gold, at(M(0, 2.8, 0)));
    ctx.solids.add(tx - 10.8, tz - 4.8, 0.9);
  }
  // Curved colonnade on the south side (looking toward the Cloudedge Terrace)
  {
    const at = frame(ctx, tx, tz, 0, 0, ctx.h(tx, tz));
    const pts: XZ[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = ((62 + i * 9.3) * Math.PI) / 180;
      pts.push([Math.cos(a) * 12.4, Math.sin(a) * 12.4]);
    }
    for (const [lx, lz] of pts) {
      column(ctx, at, lx, 0, lz, 3.6, 0.3);
      ctx.solids.add(tx + lx, tz + lz, 0.5);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [cx, cz] = pts[i + 1];
      const len = Math.hypot(cx - ax, cz - az);
      const ry = Math.atan2(-(cz - az), cx - ax);
      ctx.b.add(Box(len + 0.9, 0.55, 1.1), C.wall, at(M((ax + cx) / 2, 5.1, (az + cz) / 2, ry)));
      ctx.b.add(Box(len + 1.0, 0.2, 1.3), C.stoneDark, at(M((ax + cx) / 2, 5.47, (az + cz) / 2, ry)));
      ctx.b.add(Box(len + 0.2, 0.1, 1.16), C.gold, at(M((ax + cx) / 2, 4.85, (az + cz) / 2, ry)), false);
    }
  }
  // Plaza lamps, benches, flower beds, stalls
  for (const deg of [-150, -30, 15, 165, 58, 122]) {
    const a = (deg * Math.PI) / 180;
    lamp(ctx, tx + Math.cos(a) * 9.6, tz + Math.sin(a) * 9.6, 3.0);
  }
  // Low lamps along both sides of the avenue to the North Gate
  for (const s of [-1, 1]) lamp(ctx, s * 4.3, 58.5, 2.6);
  for (const deg of [-35, -145, 35, 145]) {
    const a = (deg * Math.PI) / 180;
    bench(ctx, tx + Math.cos(a) * 8.4, tz + Math.sin(a) * 8.4, -a + Math.PI / 2);
  }
  stall(ctx, tx + 10.5, tz - 6.5, -2.2, 0x6f86c4);
  stall(ctx, tx - 10.5, tz + 6.8, 1.0, 0xe2b34a);
  for (const [px, pz] of [[-7.6, -7], [7.6, -7]] as const) {
    ctx.place(tx + px, tz + pz, 1);
    ctx.b.add(Cyl(1.1, 1.2, 0.6, 12), C.stoneDark, M(tx + px, 0.3, tz + pz));
    flowerTree(ctx, tx + px, tz + pz, 0.75, C.blossom, false);
    ctx.solids.add(tx + px, tz + pz, 1.2);
  }
  // North Gate: two round towers with only a thin gold arch and a sun emblem between them (so the view to the north stays clear)
  {
    const gz = 54;
    const { b } = ctx;
    const at = frame(ctx, 0, gz, 0, 5);
    for (const s of [-1, 1]) {
      const px = s * 6;
      b.add(Cyl(2.0, 2.3, 9.5, 14), C.wall, at(M(px, 4.4, 0)));
      b.add(new THREE.TorusGeometry(2.1, 0.16, 5, 16), C.stoneDark, at(M(px, 6.2, 0, 0, 1, Math.PI / 2)));
      b.add(Cyl(2.4, 2.2, 0.7, 14), C.stoneDark, at(M(px, 9.4, 0)));
      b.add(new THREE.ConeGeometry(2.6, 4.2, 14), C.roof, at(M(px, 11.8, 0)));
      b.glow(new THREE.OctahedronGeometry(0.22), C.glow, at(M(px, 14.2, 0)));
      b.glow(Box(0.34, 1.4, 0.1), C.warm, at(M(px, 7.2, 2.1)));
      b.add(Box(1.3, 2.4, 0.2), C.door, at(M(px - s * 0.6, 1.5, 2.0, -s * 0.3)), false);
      ctx.solids.add(px, gz, 2.4);
      mats.banners.add(px, 5.6 + ctx.b.lift, gz + 2.35, 0, 1.2, 3.4, 1);
    }
    b.add(new THREE.TorusGeometry(4.0, 0.07, 5, 28, Math.PI), C.gold, at(M(0, 9.7, 0)), false);
    b.glow(new THREE.TorusGeometry(0.55, 0.07, 6, 18), C.glow, at(M(0, 14.3, 0)));
  }
  // Cloudedge Terrace: railings along the island edge, benches, telescope, lamps
  const rim = SH.traceRim(tx, tz + 2, -0.25, Math.PI + 0.25, 0.045);
  balustrade(ctx, rim, { pier: 5.5, glowPier: true });
  for (const [px, pz, f] of [[-5, 96, Math.PI], [5, 96, Math.PI], [-12.5, 92.5, Math.PI - 0.6], [12.5, 92.5, Math.PI + 0.6]] as const) bench(ctx, px, pz, f + Math.PI);
  telescope(ctx, -2.2, 99.2, Math.PI);
  telescope(ctx, 17.5, 92.5, 2.3);
  for (const [px, pz] of [[-9, 97.5], [9, 97.5], [-19, 88], [19, 88]] as const) lamp(ctx, px, pz, 2.8);
  // After the Seal Tower is purified: the Outer City celebrates, with strings of triangular bunting hung
  // between the plaza lamps and over the North Gate
  if (ctx.done >= ctx.floors) festival(ctx);
  return spray;
}

/** A string of triangular bunting: a thin gold cord along a catenary curve, a small flag every 0.7 meters */
function bunting(ctx: FieldCtx, a: THREE.Vector3, c: THREE.Vector3, sag: number): void {
  const { b } = ctx;
  const n = Math.max(4, Math.round(a.distanceTo(c) / 0.7));
  const pts = catenary(a, c, sag, n);
  const cols = [0xfbf6ea, C.gold, 0x8fb4ea, 0xffb8d0];
  ctx.b.lift = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    b.add(new THREE.CylinderGeometry(1, 1, 1, 3), C.goldDeep, segM(pts[i], pts[i + 1], 0.02), false);
    if (i === 0) continue;
    const p = pts[i];
    const dir = Math.atan2(pts[i + 1].x - pts[i - 1].x, pts[i + 1].z - pts[i - 1].z);
    const g = new THREE.ConeGeometry(0.26, 0.58, 3);
    g.rotateX(Math.PI);
    g.scale(1, 1, 0.25);
    b.add(g, cols[i % cols.length], M(p.x, p.y - 0.31, p.z, dir + Math.PI / 2), false);
  }
}

function festival(ctx: FieldCtx): void {
  const [tx, tz] = SH.TOWN;
  const top = (x: number, z: number, h: number) => new THREE.Vector3(x, ctx.h(x, z) + h, z);
  // Plaza: between the lamps (skipping the stretch of the main road to the north, which is strung from the North Gate instead)
  const degs = [-150, -30, 15, 58, 122, 165];
  const lamps = degs.map((d) => top(tx + Math.cos((d * Math.PI) / 180) * 9.6, tz + Math.sin((d * Math.PI) / 180) * 9.6, 3.05));
  for (let i = 1; i < lamps.length; i++) bunting(ctx, lamps[i - 1], lamps[i], 0.45);
  bunting(ctx, lamps[lamps.length - 1], lamps[0], 0.45);
  // The angel statue atop the fountain is strung to four of the lamps
  const crown = top(tx, tz, 6.2);
  for (const i of [0, 1, 3, 4]) bunting(ctx, crown, lamps[i], 0.9);
  // Between the two towers of the North Gate, and from the towers to the low lamps along the avenue
  bunting(ctx, top(-6, 54, 8.4), top(6, 54, 8.4), 1.3);
  for (const s of [-1, 1]) bunting(ctx, top(s * 6, 54, 6.4), top(s * 4.3, 58.5, 2.65), 0.25);
}

// ───────────────────────── Retaining wall and grand stair ─────────────────────────

export function buildTerrace(ctx: FieldCtx, mats: Mats): void {
  const { b } = ctx;
  const [tx, tz] = SH.TERRACE_C;
  const R = SH.TERRACE_R;
  const top = SH.HIGH + 0.35;
  const bottom = SH.LOW - 1.2;
  b.lift = 0;
  const seg = 2.9;
  const n = Math.round((Math.PI * R) / seg);
  const rail: XZ[][] = [[]];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI + (i / n) * Math.PI;
    const x = tx + Math.cos(a) * R;
    const z = tz + Math.sin(a) * R;
    const ok = SH.shore(x, z) > 2.2 && SH.shore(tx + Math.cos(a) * (R - 3), tz + Math.sin(a) * (R - 3)) > 1.5 && Math.abs(x) > SH.STAIR_W + 0.4;
    if (!ok) {
      if (rail[rail.length - 1].length) rail.push([]);
      continue;
    }
    const ry = -a + Math.PI / 2;
    b.add(Box(seg + 0.1, top - bottom, 1.8), C.wall, M(x, (top + bottom) / 2, z, ry));
    b.add(Box(seg + 0.2, 0.35, 2.2), C.stoneDark, M(x, top + 0.02, z, ry));
    b.add(Box(seg + 0.2, 0.08, 1.9), C.gold, M(x, top - 0.9, z, ry), false);
    // One buttress every three segments (jutting out toward the lower tier)
    if (k % 3 === 0) {
      const ox = x - Math.cos(a) * 1.3;
      const oz = z - Math.sin(a) * 1.3;
      b.add(Box(1.3, top - bottom - 0.6, 1.4), C.stone, M(ox, (top + bottom) / 2 - 0.3, oz, ry));
      b.add(new THREE.ConeGeometry(0.95, 1.1, 4), C.stoneDark, M(ox, top - 0.2, oz, ry + Math.PI / 4));
    } else if (k % 3 === 2 && k % 2 === 0) {
      const ox = x - Math.cos(a) * 0.95;
      const oz = z - Math.sin(a) * 0.95;
      mats.banners.add(ox, top - 0.8, oz, ry + Math.PI, 1.2, 3.6, 0);
    }
    k++;
    rail[rail.length - 1].push([tx + Math.cos(a) * (R + 0.55), tz + Math.sin(a) * (R + 0.55)]);
  }
  for (const pts of rail) {
    if (pts.length < 2) continue;
    balustrade(ctx, pts, { pier: 6, y: () => top + 0.2 });
    for (const [x, z] of pts) ctx.solids.add(x + 0.001, z, 0.55);
  }
  // Grand stair
  const [z0, z1] = SH.STAIR_Z;
  const steps = 22;
  const W = SH.STAIR_W * 2 - 1.0;
  for (let i = 0; i < steps; i++) {
    const zc = z0 + 0.6 - ((i + 0.5) * (z0 - z1 + 1.2)) / steps;
    const y = ctx.h(0, zc) + 0.1;
    b.add(Box(W, 1.6, (z0 - z1 + 1.2) / steps + 0.02), i % 2 ? C.stone : 0xe4dccb, M(0, y - 0.8, zc));
  }
  for (const s of [-1, 1]) {
    const x = s * (SH.STAIR_W - 0.1);
    for (let i = 0; i < steps; i++) {
      const zc = z0 + 0.6 - ((i + 0.5) * (z0 - z1 + 1.2)) / steps;
      const y = ctx.h(0, zc) + 1.0;
      b.add(Box(1.3, y - bottom, (z0 - z1 + 1.2) / steps + 0.02), C.wall, M(x, (y + bottom) / 2, zc));
    }
    balustrade(ctx, [[x, z0 + 0.8], [x, z1 - 0.8]], { pier: 5, y: (_px, pz) => ctx.h(0, pz) + 1.0 });
    for (let zz = z1; zz <= z0; zz += 1) ctx.solids.add(x, zz, 0.6);
    // Angel statues at the top and bottom of the stair
    statue(ctx, s * 7.4, z0 + 1.6, 0, 1.15);
    statue(ctx, s * 7.4, z1 - 2.4, 0, 1.15);
    lamp(ctx, s * 4.6, z1 - 4.5, 3.4);
  }
}

// ───────────────────────── Upper tier: Cathedral, plaza, Belfry, Holy Gate, Holy Bridge ─────────────────────────

export function buildUpper(ctx: FieldCtx, mats: Mats): { bellY: number } {
  const { b, r } = ctx;
  const cx = SH.CATHEDRAL.x;
  const cz = SH.CATHEDRAL.z;
  cathedral(ctx, cx, cz, 0);
  // Long flags on the Cathedral towers
  for (const s of [-1, 1]) mats.banners.add(cx + s * 9.6, ctx.h(cx, cz) + 1.3 + 22, cz + 12.4, 0, 1.6, 7.5, 0);
  // Plaza: obelisk, two small fountains, lamps and cypresses
  const [mx, mz] = SH.MOSAIC;
  obelisk(ctx, mx, mz, 11);
  for (const s of [-1, 1]) {
    const fx = mx + s * 12;
    const fz = mz + 1;
    const at = frame(ctx, fx, fz, 0, 2.6);
    b.add(Cyl(2.6, 2.8, 0.8, 24), C.stone, at(M(0, 0.2, 0)));
    b.add(new THREE.TorusGeometry(2.5, 0.16, 5, 24), C.stoneDark, at(M(0, 0.62, 0, 0, 1, Math.PI / 2)));
    const w = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24), mats.water);
    w.rotation.x = -Math.PI / 2;
    w.position.set(fx, ctx.b.lift + 0.62, fz);
    ctx.group.add(w);
    b.add(Cyl(0.3, 0.45, 1.8, 8), C.stone, at(M(0, 1.3, 0)));
    b.add(Cyl(0.9, 0.3, 0.3, 12), C.gold, at(M(0, 2.3, 0)));
    ctx.solids.add(fx, fz, 2.9);
  }
  for (const x of [cx - 16.5, cx - 12, cx + 12, cx + 16.5]) lamp(ctx, x, 26.6, 3.4);
  for (const deg of [35, 60, 90, 120, 145]) {
    const a = (deg * Math.PI) / 180;
    cypress(ctx, mx + Math.cos(a) * 12.8, mz + Math.sin(a) * 12.8, 7 + r() * 1.5);
  }
  for (const deg of [10, 170, 75, 105]) {
    const a = (deg * Math.PI) / 180;
    lamp(ctx, mx + Math.cos(a) * 9.8, mz + Math.sin(a) * 9.8, 3.2);
  }
  // Belfry
  const [bx, bz] = SH.BELFRY;
  const bellY = belfry(ctx, bx, bz, -0.2);
  for (const [px, pz] of [[-6, -2], [6, -3], [-5, 8], [7, 9]] as const) lamp(ctx, bx + px, bz + pz, 3);
  // Dawnlight Spring: a round pool with a gold light lotus at its center
  {
    const [sx, sz] = SH.SPRING;
    const at = frame(ctx, sx, sz, 0, 4);
    b.add(Cyl(5.2, 5.5, 0.8, 32), C.stone, at(M(0, 0.15, 0)));
    b.add(new THREE.TorusGeometry(5.1, 0.2, 5, 32), C.stoneDark, at(M(0, 0.56, 0, 0, 1, Math.PI / 2)));
    const w = new THREE.Mesh(new THREE.CircleGeometry(4.9, 32), mats.water);
    w.rotation.x = -Math.PI / 2;
    w.position.set(sx, ctx.b.lift + 0.56, sz);
    ctx.group.add(w);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.SphereGeometry(1, 8, 6);
      petal.scale(0.35, 0.12, 1.1);
      b.add(petal, C.gold, at(M(Math.cos(a) * 1.1, 0.9, Math.sin(a) * 1.1, -a + Math.PI / 2, 1, 0.5, 0)));
    }
    const core = new THREE.OctahedronGeometry(0.6);
    core.scale(0.8, 1.5, 0.8);
    b.glow(core, C.glow, at(M(0, 2.0, 0)));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      statueLite(ctx, sx + Math.cos(a) * 7.4, sz + Math.sin(a) * 7.4);
    }
    ctx.solids.add(sx, sz, 5.6);
  }
  // Holy Gate and the bridgehead plaza
  const [gx, gz] = SH.GATE;
  holyGate(ctx, gx, gz);
  for (const s of [-1, 1]) {
    cypress(ctx, gx + s * 11, gz + 2.5, 8);
    cypress(ctx, gx + s * 13.5, gz + 5.5, 7);
    lamp(ctx, gx + s * 4.6, gz + 5.5, 3.4);
  }
  // Holy Bridge
  const [br, gb] = SH.BRIDGES;
  bridgeDress(ctx, mats, br, true);
  bridgeDress(ctx, mats, gb, false);
  return { bellY };
}

/**
 * Holy Gate: a tall square tower on each side of the bridgehead (column ornaments, a gold sun, an angel on
 * top), with a thin gold arch between the tower tops
 */
function holyGate(ctx: FieldCtx, x: number, z: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, 0, 6);
  const H = 12;
  for (const s of [-1, 1]) {
    const px = s * 6.2;
    b.add(Box(4.2, 1.0, 4.2), C.stoneDark, at(M(px, 0.2, 0)));
    b.add(Box(3.2, H, 3.2), C.wall, at(M(px, H / 2, 0)));
    for (const fz of [-1, 1]) {
      column(ctx, at, px - 1.05, 0.7, fz * 1.75, H - 2.8, 0.24, C.marble);
      column(ctx, at, px + 1.05, 0.7, fz * 1.75, H - 2.8, 0.24, C.marble);
      b.glow(new THREE.TorusGeometry(0.7, 0.1, 6, 20), C.glow, at(M(px, H - 2.6, fz * 1.62, fz > 0 ? 0 : Math.PI)));
      b.glow(new THREE.CircleGeometry(0.4, 14), C.glow, at(M(px, H - 2.6, fz * 1.63, fz > 0 ? 0 : Math.PI)));
      b.add(Box(1.0, 4.2, 0.1), C.door, at(M(px, 3.2, fz * 1.62)), false);
      b.add(new THREE.CircleGeometry(0.5, 10, 0, Math.PI), C.door, at(M(px, 5.3, fz * 1.63, fz > 0 ? 0 : Math.PI)), false);
    }
    b.add(Box(3.9, 0.5, 3.9), C.stoneDark, at(M(px, H + 0.2, 0)));
    b.add(Box(3.94, 0.1, 3.94), C.gold, at(M(px, H - 0.2, 0)), false);
    b.add(Box(2.4, 0.9, 2.4), C.stone, at(M(px, H + 0.9, 0)));
    angel(ctx, at, px, H + 1.35, 0, 0, 1.3);
    const [wx, wz] = toWorld(x, z, 0, px, 0);
    ctx.solids.add(wx, wz, 2.3);
  }
  b.add(new THREE.TorusGeometry(6.2, 0.14, 6, 40, Math.PI), C.gold, at(M(0, H + 0.6, 0)), false);
  b.glow(new THREE.OctahedronGeometry(0.45), C.glow, at(M(0, H + 7.2, 0)));
}

/** A short stone pillar topped with a light orb (around the Dawnlight Spring) */
function statueLite(ctx: FieldCtx, x: number, z: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, 0, 0.5);
  b.add(Box(0.8, 0.3, 0.8), C.stoneDark, at(M(0, 0.1, 0)));
  b.add(Cyl(0.25, 0.3, 1.6, 8), C.wall, at(M(0, 1.0, 0)));
  b.add(Cyl(0.42, 0.25, 0.25, 10), C.gold, at(M(0, 1.9, 0)));
  b.glow(new THREE.SphereGeometry(0.26, 10, 8), C.warm, at(M(0, 2.25, 0)));
  ctx.solids.add(x, z, 0.5);
}

/**
 * Stone bridge decoration: railings on both sides (lamps and flagpoles alternating on the square piers), angel statues at
 * the bridgehead, and cloud puffs under the bridge on both sides
 */
function bridgeDress(ctx: FieldCtx, mats: Mats, s: SH.Span, grand: boolean): void {
  const { b, r } = ctx;
  const [ax, az] = s.a;
  const [cx, cz] = s.c;
  const len = Math.hypot(cx - ax, cz - az);
  const ux = (cx - ax) / len;
  const uz = (cz - az) / len;
  const nx = -uz;
  const nz = ux;
  const off = s.w - 1.0;
  // Add railings only on the overhanging stretch (extending a little past each end)
  let t0 = 0;
  let t1 = len;
  for (let t = 0; t <= len; t += 0.5) {
    const x = ax + ux * t + nx * (s.w + 1.5);
    const z = az + uz * t + nz * (s.w + 1.5);
    if (SH.shore(x, z) < 0.5) {
      t0 = Math.max(0, t - 3);
      break;
    }
  }
  for (let t = len; t >= 0; t -= 0.5) {
    const x = ax + ux * t + nx * (s.w + 1.5);
    const z = az + uz * t + nz * (s.w + 1.5);
    if (SH.shore(x, z) < 0.5) {
      t1 = Math.min(len, t + 3);
      break;
    }
  }
  const deckY = (t: number) => ctx.h(ax + ux * t, az + uz * t);
  for (const side of [-1, 1]) {
    const pts: XZ[] = [];
    for (let t = t0; t <= t1 + 1e-3; t += 1.2) pts.push([ax + ux * t + nx * off * side, az + uz * t + nz * off * side]);
    balustrade(ctx, pts, { pier: grand ? 7.5 : 6, glowPier: !grand, y: (x, z) => ctx.h(x - nx * off * side, z - nz * off * side) });
    // Stone rim: a gold-edged stone strip outside the railing
    b.lift = 0;
    for (let t = t0; t < t1; t += 2) {
      const x = ax + ux * (t + 1) + nx * (off + 0.45) * side;
      const z = az + uz * (t + 1) + nz * (off + 0.45) * side;
      const y = deckY(t + 1);
      b.add(Box(0.5, 0.9, 2.02), C.stoneDark, M(x, y - 0.35, z, Math.atan2(ux, uz)));
      b.add(Box(0.14, 0.12, 2.02), C.gold, M(x + nx * side * 0.26, y - 0.1, z + nz * side * 0.26, Math.atan2(ux, uz)), false);
    }
    // Lamps and flags
    if (grand) {
      let i = 0;
      for (let t = t0 + 3.75; t < t1 - 2; t += 7.5, i++) {
        const x = ax + ux * t + nx * (off - 0.65) * side;
        const z = az + uz * t + nz * (off - 0.65) * side;
        const y = deckY(t);
        if (i % 2 === 0) lamp(ctx, x, z, 3.0);
        else {
          b.lift = 0;
          b.add(Box(0.5, 0.4, 0.5), C.stoneDark, M(x, y + 0.15, z));
          b.add(Cyl(0.08, 0.1, 7.6, 6), C.gold, M(x, y + 3.8, z));
          b.add(Cyl(0.03, 0.03, 1.6, 4), C.gold, M(x - nx * side * 0.7, y + 7.2, z - nz * side * 0.7, Math.atan2(nx, nz), 1, Math.PI / 2, 0), false);
          b.glow(new THREE.OctahedronGeometry(0.16), C.glow, M(x, y + 7.8, z));
          mats.banners.add(x - nx * side * 0.75, y + 7.2, z - nz * side * 0.75, Math.atan2(ux, uz), 1.1, 4.2, (i >> 1) % 2 ? 1 : 0);
          ctx.solids.add(x, z, 0.35);
        }
      }
    }
    // Clouds under both sides of the bridge: so the bridge looks as if it spans the clouds
    b.lift = 0;
    for (let t = t0 + 2; t < t1 - 2; t += grand ? 4.5 : 5) {
      const d = s.w + 3 + r() * 5;
      const x = ax + ux * t + nx * d * side;
      const z = az + uz * t + nz * d * side;
      cloudPuff(b, x, deckY(t) - 8 - r() * 5, z, 3.5 + r() * 2.5, r, 3);
    }
  }
  // Angel statues at the bridgehead
  if (grand) {
    for (const t of [t0 - 1.5, t1 + 1.5]) {
      for (const side of [-1, 1]) {
        const x = ax + ux * t + nx * (off + 0.6) * side;
        const z = az + uz * t + nz * (off + 0.6) * side;
        if (SH.shore(x, z) > 1.8) statue(ctx, x, z, Math.atan2(-ux, -uz), 1.2);
      }
    }
  }
}

// ───────────────────────── Bell ─────────────────────────

/**
 * The bell inside the Belfry: it swings, and every so often rings out loudly (a gold ring of
 * light spreads, sparks fly off)
 */
export function bell(ctx: FieldCtx, x: number, y: number, z: number): void {
  const gold = sceneMaterial(C.gold, { rim: 0.5, surface: 'metal' });
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const geo = new THREE.CylinderGeometry(0.55, 1.15, 1.8, 14);
  const m = new THREE.Mesh(geo, gold);
  m.position.y = -1.2;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.13, 6, 18), gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.9;
  m.add(lip);
  pivot.add(m);
  // Outline the bell body; the ring at the bell's mouth was never outlined, keep it that way
  inkScenery(pivot, { skip: (x) => x === lip });
  ctx.group.add(pivot);
  ctx.disposers.push(() => gold.dispose());
  let next = 6;
  let ring = 0;
  ctx.extras.push((dt, t, vfx) => {
    ring = Math.max(0, ring - dt * 0.35);
    pivot.rotation.z = Math.sin(t * 1.9) * (0.18 + ring * 0.45);
    if (t > next) {
      next = t + 14;
      ring = 1;
      const p = new THREE.Vector3(x, y - 1, z);
      void vfx.ring(p, 0xffe08a, 1, 16, 1.6);
      void vfx.ring(p.clone().setY(y + 2), 0xfff2c0, 1, 11, 1.3);
      vfx.emit({ pos: p, count: 26, color: [0xffe08a, 0xffffff], speed: [2, 6], spread: 1, life: [0.8, 1.6], size: [0.15, 0.3], atlas: 1, intensity: 2, drag: 0.8 });
    }
  });
}

export { toWorld, solidRect };
