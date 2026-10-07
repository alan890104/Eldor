// Signs of people in the Emberspine Volcanic Belt: Rediron Keep is a city that lives off ore and fire,
// and outside the town there are traces everywhere of people passing and working.
//   The ore-hauling rail line beside the mine path (mine carts, buffer stops, hanging lamps) runs on to the fork's ore dump;
//   On the terrace outside the town wall there are charcoal kilns, woodpiles, scaffolding for wall repairs, forge scrap heaps,
//     cooling iron ingots, and iron-chain railings along the cliff edge;
//   On the ridge road below the North Gate, an overturned mine cart has spilled still-glowing red ore all over the ground;
//   At the south end of the stone bridge is the Knights' guard post (barricades, tents, braziers, spear racks);
//     beside the Geyser Flats is the volcanologist Aisi's observation camp.
// The extent of these traces is registered in busy (they do not block the road, but the ground layer's rubble and flowers are not
// laid over them); things that block the way register collisions separately.

import * as THREE from 'three';
import { catenary, V } from '../../../arenas/_woods.ts';
import { samplePath } from '../../compose.ts';
import { tent, type FieldCtx, type Solids, type XZ } from '../../kit.ts';
import { banner } from './fx.ts';
import type { Pool } from './ground.ts';
import { COL, brazier, local, oreCrates, sword } from './props.ts';
import * as SH from './shape.ts';
import { G, LAPILLI, MX, Stains, T, glow, lean, put } from './tmpl.ts';

export interface WorksOut {
  stains: Stains;
  flames: THREE.Vector3[];
  /** Ash smoke from the charcoal kiln */
  smoke: THREE.Vector3[];
  flags: THREE.BufferGeometry[];
  pools: Pool[];
}

const TAU = Math.PI * 2;
const W = { wood: 0x6e4a30, woodD: 0x4a3020, woodL: 0x9a7a54, iron: 0x2a2328, ironL: 0x4a3d44, clay: 0x5a4034, clayD: 0x3e2c24, canvas: 0xc8b48a, rope: 0x8a6a44, slag: 0x1c1618, slagL: 0x2e2426 };

/** Near (cx, cz), find a flat, empty spot far enough from the road (searching in rings from near to far) */
function spot(ctx: FieldCtx, busy: Solids, cx: number, cz: number, R: number, need: number, maxSlope = 0.3): XZ | null {
  const h = ctx.h;
  for (let d = 0; d <= R; d += 1.5) {
    const n = Math.max(1, Math.round((d * TAU) / 2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + d;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!ctx.clear(x, z, need) || ctx.solids.blocked(x, z, need) || busy.blocked(x, z, need)) continue;
      if (h(x, z) < SH.LAVA + 1.5) continue;
      const sl = Math.max(Math.abs(h(x + need, z) - h(x - need, z)), Math.abs(h(x, z + need) - h(x, z - need))) / (2 * need);
      if (sl > maxSlope) continue;
      return [x, z];
    }
  }
  return null;
}

/** A hanging stretch of iron chain: links alternating crosswise and lengthwise, one by one */
function chain(ctx: FieldCtx, a: THREE.Vector3, c: THREE.Vector3, sag: number): void {
  const len = a.distanceTo(c);
  const n = Math.max(4, Math.round(len / 0.17));
  const pts = catenary(a, c, sag, n);
  const up = V(0, 1, 0);
  const d = V(0, 0, 0);
  const keep = ctx.b.lift;
  ctx.b.lift = 0;
  for (let i = 0; i < n; i++) {
    d.subVectors(pts[i + 1], pts[i]);
    const l = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(up, d.normalize());
    if (i % 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2));
    const m = new THREE.Matrix4().compose(pts[i].clone().add(pts[i + 1]).multiplyScalar(0.5), q, V(0.075, l * 1.15, 0.03));
    put(ctx.b, T.box, W.iron, m, false);
  }
  ctx.b.lift = keep;
}

/** An iron post standing at (x, z) (for the chain railing); returns the top of the post */
function chainPost(ctx: FieldCtx, x: number, z: number): THREE.Vector3 {
  const y = ctx.place(x, z, 0.2);
  put(ctx.b, T.box, W.iron, MX(x, 0.55, z, 0.16, 1.1, 0.16));
  put(ctx.b, T.cone4, W.ironL, MX(x, 1.16, z, 0.13, 0.16, 0.13, Math.PI / 4));
  ctx.solids.add(x, z, 0.22);
  return V(x, y + 0.98, z);
}

/** Flagpole and long banner */
function flagPole(ctx: FieldCtx, x: number, z: number, face: number, out: WorksOut, col = COL.cloth, trim = COL.gold, H = 5.2): void {
  const y = ctx.place(x, z, 0.2);
  put(ctx.b, T.cyl5, W.woodD, MX(x, H / 2, z, 0.07, H, 0.07));
  put(ctx.b, T.box, W.iron, MX(x, H - 0.3, z, 1.3, 0.07, 0.07, face));
  out.flags.push(banner(1.0, 2.2, MX(x + Math.sin(face) * 0.08, y + H - 0.3, z + Math.cos(face) * 0.08, 1, 1, 1, face), col, trim));
  ctx.solids.add(x, z, 0.2);
}

export function buildWorks(ctx: FieldCtx, busy: Solids, pools: Pool[], stains: Stains): WorksOut {
  const out: WorksOut = { stains, flames: [], smoke: [], flags: [], pools };
  mineRail(ctx, busy, out);
  townOutskirts(ctx, busy, out);
  ridgeRoad(ctx, busy, out);
  bridgeCheckpoint(ctx, busy, out);
  surveyCamp(ctx, busy, out);
  ruts(ctx);
  ctx.b.lift = 0;
  return out;
}

// ───────────────────────── Ore-hauling rails ─────────────────────────

/** Lay rails along one side of the mine branch path (mine mouth -> fork); the fork end has the ore dump */
function mineRail(ctx: FieldCtx, busy: Solids, out: WorksOut): void {
  const { b, r } = ctx;
  const pw = ctx.layout.pathW;
  // The path leads from the fork to the mine mouth; the rails run back from the end of the old track at the mouth
  const road = samplePath([...SH.TRAILS[1]].reverse(), 0.8);
  // Pick the southwest side of the path (downhill, the side away from the colonnade)
  const off = pw + 2.4;
  const rail: { x: number; z: number; a: number; ok: boolean }[] = [];
  for (let i = 1; i < road.length - 1; i++) {
    const [ax, az] = road[i - 1];
    const [bx, bz] = road[i + 1];
    const tx = bx - ax;
    const tz = bz - az;
    const l = Math.hypot(tx, tz) || 1;
    const x = road[i][0] + (tz / l) * off;
    const z = road[i][1] - (tx / l) * off;
    const ok = ctx.pathDist(x, z) > pw + 1.2 && !ctx.solids.blocked(x, z, 0.8) && Math.hypot(x - SH.MINE[0], z - SH.MINE[1]) > 11 && ctx.clear(x, z, -1.2);
    rail.push({ x, z, a: Math.atan2(tx, tz), ok });
  }
  // Keep only the longest continuous stretch where rails can be laid
  let best: [number, number] = [0, -1];
  let s0 = -1;
  rail.forEach((p, i) => {
    if (p.ok && s0 < 0) s0 = i;
    if ((!p.ok || i === rail.length - 1) && s0 >= 0) {
      const e = p.ok ? i : i - 1;
      if (e - s0 > best[1] - best[0]) best = [s0, e];
      s0 = -1;
    }
  });
  const seg = rail.slice(best[0], best[1] + 1);
  if (seg.length < 12) return;
  b.lift = 0;
  seg.forEach((p, i) => {
    const y = ctx.h(p.x, p.z);
    // Sleepers, ballast
    put(b, T.box, i % 5 ? W.woodD : W.wood, MX(p.x, y + 0.05, p.z, 1.5, 0.1, 0.24, p.a + (r() - 0.5) * 0.06));
    if (i % 3 === 0) put(b, LAPILLI[i % 4], G.ash, MX(p.x, y - 0.02, p.z, 1.1, 0.8, 1.1, r() * TAU), false);
    busy.add(p.x, p.z, 1.3);
    // Two rails: joined to the next sleeper
    const q = seg[i + 1];
    if (!q) return;
    const yq = ctx.h(q.x, q.z);
    for (const s of [-1, 1]) {
      const c = Math.cos(p.a);
      const sn = Math.sin(p.a);
      const x0 = p.x + c * 0.5 * s;
      const z0 = p.z - sn * 0.5 * s;
      const cq = Math.cos(q.a);
      const sq = Math.sin(q.a);
      const x1 = q.x + cq * 0.5 * s;
      const z1 = q.z - sq * 0.5 * s;
      const d = V(x1 - x0, yq - y, z1 - z0);
      const l = d.length();
      const m = new THREE.Matrix4().compose(V((x0 + x1) / 2, (y + yq) / 2 + 0.14, (z0 + z1) / 2), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.normalize()), V(0.08, 0.1, l + 0.04));
      put(b, T.box, COL.ironTrim, m, false);
    }
  });
  // Mine carts: one loaded with still-glowing red ore, one empty
  for (const [t, full] of [
    [0.34, true],
    [0.7, false],
  ] as const) {
    const p = seg[Math.floor(t * (seg.length - 1))];
    if (!p) continue;
    const L = local(p.x, p.z, p.a);
    ctx.place(p.x, p.z, 1);
    put(b, T.hexT, W.ironL, MX(p.x, 0.78, p.z, 0.95, 0.75, 0.75, p.a + Math.PI / 6));
    put(b, T.box, COL.ironTrim, MX(p.x, 1.16, p.z, 1.22, 0.08, 1.4, p.a), false);
    for (const s of [-1, 1]) for (const f of [-1, 1]) {
      const [wx, wz] = L(s * 0.55, f * 0.45);
      put(b, T.cyl7, W.iron, MX(wx, 0.3, wz, 0.24, 0.1, 0.24, p.a, 0, Math.PI / 2));
    }
    if (full) {
      put(b, T.dod, G.crust, MX(p.x, 1.2, p.z, 0.62, 0.3, 0.55, r() * TAU));
      for (let k = 0; k < 4; k++) glow(b, T.oct, k % 2 ? G.ember : G.fire, MX(p.x + (r() - 0.5) * 0.7, 1.4, p.z + (r() - 0.5) * 0.6, 0.12, 0.12, 0.12, r() * TAU));
      out.pools.push({ x: p.x, z: p.z, r: 2.2, color: 0xff7a2a, amt: 0.25 });
    }
    ctx.solids.add(p.x, p.z, 1.0);
  }
  // Hanging lamp posts along the line (hung on the outer side of the rails)
  for (let i = 6; i < seg.length - 4; i += 16) {
    const p = seg[i];
    const c = Math.cos(p.a);
    const sn = Math.sin(p.a);
    const x = p.x + c * 1.35;
    const z = p.z - sn * 1.35;
    if (ctx.solids.blocked(x, z, 0.3) || ctx.pathDist(x, z) < pw + 1) continue;
    ctx.place(x, z);
    put(b, T.box, W.woodD, MX(x, 1.4, z, 0.16, 2.8, 0.16));
    put(b, T.box, W.woodD, MX(x - c * 0.3, 2.7, z + sn * 0.3, 0.7, 0.1, 0.1, p.a));
    glow(b, T.oct, 0xffb040, MX(x - c * 0.55, 2.4, z + sn * 0.55, 0.14, 0.2, 0.14));
    put(b, T.cone4, W.iron, MX(x - c * 0.55, 2.58, z + sn * 0.55, 0.16, 0.12, 0.16, Math.PI / 4));
    out.pools.push({ x: x - c * 0.55, z: z + sn * 0.55, r: 2.6, color: 0xffa040, amt: 0.3 });
    ctx.solids.add(x, z, 0.25);
  }
  // The fork end: buffer stop and ore dump
  const end = seg[seg.length - 1];
  const prev = seg[seg.length - 3];
  const dirA = Math.atan2(end.x - prev.x, end.z - prev.z);
  const [sx, sz] = [end.x + Math.sin(dirA) * 0.6, end.z + Math.cos(dirA) * 0.6];
  ctx.place(sx, sz, 0.6);
  put(b, T.box, W.wood, MX(sx, 0.45, sz, 1.6, 0.5, 0.4, end.a));
  put(b, T.box, COL.cloth, MX(sx, 0.72, sz + 0.0, 1.62, 0.08, 0.42, end.a), false);
  ctx.solids.add(sx, sz, 0.7);
  const hop = spot(ctx, busy, end.x + Math.sin(dirA) * 4.5, end.z + Math.cos(dirA) * 4.5, 6, 2.6, 0.35);
  if (hop) oreHopper(ctx, hop[0], hop[1], Math.atan2(end.x - hop[0], end.z - hop[1]), busy, out);
}

/** Ore dump: a timber platform on four posts, a chute sloping down, a pile of ore underneath */
function oreHopper(ctx: FieldCtx, x: number, z: number, face: number, busy: Solids, out: WorksOut): void {
  const { b, r } = ctx;
  ctx.place(x, z, 2.2);
  const L = local(x, z, face);
  const H = 3.2;
  for (const [lx, lz] of [
    [-1.2, -1.2],
    [1.2, -1.2],
    [-1.2, 1.2],
    [1.2, 1.2],
  ]) {
    const [px, pz] = L(lx, lz);
    put(b, T.box, W.woodD, MX(px, H / 2, pz, 0.26, H, 0.26, face));
    ctx.solids.add(px, pz, 0.3);
  }
  // Diagonal braces
  for (const s of [-1, 1]) {
    const [px, pz] = L(s * 1.2, 0);
    put(b, T.box, W.wood, MX(px, H * 0.45, pz, 0.12, 3.2, 0.12, face, 0.75 * s));
  }
  put(b, T.box, W.wood, MX(x, H + 0.08, z, 3.0, 0.16, 3.0, face));
  // A funnel-shaped hopper and a chute sloping outward
  put(b, T.cone4, W.woodD, MX(x, H + 0.95, z, 1.3, 1.5, 1.3, face + Math.PI / 4, Math.PI));
  const [cx, cz] = L(0, 2.3);
  put(b, T.box, W.wood, MX(cx, H - 0.6, cz, 0.8, 0.1, 2.4, face, 0.6));
  for (const s of [-1, 1]) {
    const [ex, ez] = L(s * 0.42, 2.3);
    put(b, T.box, W.woodD, MX(ex, H - 0.45, ez, 0.08, 0.3, 2.4, face, 0.6));
  }
  // The pile of ore that has slid down (with glowing raw ore mixed in)
  const [ox, oz] = L(0, 4.1);
  ctx.place(ox, oz, 1.4);
  put(b, T.ico1, W.slagL, MX(ox, 0.1, oz, 1.5, 0.75, 1.3, r() * TAU));
  for (let k = 0; k < 6; k++) {
    const a = r() * TAU;
    const d = r() * 1.1;
    glow(b, T.oct, k % 2 ? G.ember : G.fire, MX(ox + Math.cos(a) * d, 0.55 - d * 0.3, oz + Math.sin(a) * d, 0.1, 0.12, 0.1, r() * TAU));
  }
  ctx.solids.add(ox, oz, 1.4);
  out.pools.push({ x: ox, z: oz, r: 2.6, color: 0xff7a2a, amt: 0.28 });
  // The ore crates beside it, a flag
  oreCrates(ctx, ...L(2.8, -0.6), face + 0.3);
  const [fx, fz] = L(-2.4, 1.6);
  if (!ctx.solids.blocked(fx, fz, 0.4)) flagPole(ctx, fx, fz, face, out);
  busy.add(x, z, 4.5);
}

// ───────────────────────── Outside Rediron Keep ─────────────────────────

const GATE_A = Math.atan2(SH.TOWER[1] - SH.TOWN[1], SH.TOWER[0] - SH.TOWN[0]);
const polar = (a: number, rr: number): XZ => [SH.TOWN[0] + Math.cos(a) * rr, SH.TOWN[1] + Math.sin(a) * rr];

/** Find the terrace edge (where the ground starts to drop away) along a radius */
function bluffEdge(ctx: FieldCtx, a: number, y0: number): number {
  for (let rr = 21; rr < 40; rr += 0.5) {
    const [x, z] = polar(a, rr);
    if (ctx.h(x, z) < y0 - 0.8) return rr;
  }
  return 40;
}

function townOutskirts(ctx: FieldCtx, busy: Solids, out: WorksOut): void {
  const y0 = ctx.h(SH.TOWN[0], SH.TOWN[1]);
  const deg = (d: number) => (d / 180) * Math.PI;
  // Find a position on the terrace ring outside the town wall: angle a, k meters outside the wall
  // Place it against the wall, leaving a walkable gap between it and the wall
  const ring = (a: number, need: number, k = 0.5): XZ | null => {
    const edge = bluffEdge(ctx, a, y0);
    const rr = SH.WALL_R + 1.6 + 1.3 + need + k;
    if (rr + need > edge - 0.4) return null;
    const [x, z] = polar(a, rr);
    if (ctx.solids.blocked(x, z, need * 0.8) || ctx.pathDist(x, z) < ctx.layout.pathW + need + 1 || busy.blocked(x, z, need * 0.8)) return null;
    return [x, z];
  };
  // Charcoal kilns and woodpiles (south, southeast)
  for (const a of [deg(64), deg(112)]) {
    const p = ring(a, 2.4, 0.4);
    if (p) kiln(ctx, p[0], p[1], a + Math.PI / 2, out);
    const q = ring(a + deg(14), 1.4);
    if (q) woodpile(ctx, q[0], q[1], a);
  }
  // Scaffolding for wall repairs (southwest)
  {
    const a = deg(150);
    const [x, z] = polar(a, SH.WALL_R + 2.3);
    if (!ctx.solids.blocked(x, z, 0.4) && bluffEdge(ctx, a, y0) > SH.WALL_R + 5) scaffold(ctx, x, z, a, y0);
  }
  // The blast furnace side (east): forge scrap heaps, cooling iron ingots, quench barrels
  for (const [a, fn] of [
    [deg(-14), 'debris'],
    [deg(22), 'ingots'],
    [deg(-38), 'barrels'],
  ] as const) {
    const p = ring(a, fn === 'debris' ? 1.8 : 1.0);
    if (!p) continue;
    if (fn === 'debris') forgeDebris(ctx, p[0], p[1], out);
    else if (fn === 'ingots') ingots(ctx, p[0], p[1], a);
    else barrels(ctx, p[0], p[1]);
  }
  // The Knights' banners outside the town wall (one every so often)
  for (const a of [deg(40), deg(90), deg(135), deg(185), deg(230)]) {
    const p = ring(a, 0.4, 0.2);
    if (p) flagPole(ctx, p[0], p[1], a + Math.PI / 2, out);
  }
  // Cliff edges either side of the North Gate: iron chain railings
  for (const side of [-1, 1]) {
    let prev: THREE.Vector3 | null = null;
    for (let k = 0; k < 9; k++) {
      const a = GATE_A + side * (deg(24) + k * deg(6.5));
      const edge = bluffEdge(ctx, a, y0);
      const [x, z] = polar(a, edge - 1.1);
      if (edge > 36 || ctx.pathDist(x, z) < ctx.layout.pathW + 1.2 || ctx.solids.blocked(x, z, 0.3)) {
        prev = null;
        continue;
      }
      const top = chainPost(ctx, x, z);
      if (prev && prev.distanceTo(top) < 4.2) chain(ctx, prev, top, 0.28);
      prev = top;
      busy.add(x, z, 0.8);
    }
  }
}

/**
 * Charcoal kiln: a clay-built domed kiln, firelight showing at its mouth, ash smoke from the vent on top;
 * beside it a pile of finished charcoal
 */
function kiln(ctx: FieldCtx, x: number, z: number, face: number, out: WorksOut): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 2);
  const L = local(x, z, face);
  put(b, T.torus, COL.stoneD, MX(x, 0.12, z, 2.15, 2.2, 2.15));
  put(b, T.half, W.clay, MX(x, 0, z, 2.0, 1.7, 2.0, r() * TAU));
  // Patched mud lumps on the kiln body
  for (let k = 0; k < 5; k++) {
    const a = r() * TAU;
    const ph = 0.3 + r() * 0.8;
    put(b, T.dod, W.clayD, MX(x + Math.cos(a) * Math.cos(ph) * 2.0, Math.sin(ph) * 1.7, z + Math.sin(a) * Math.cos(ph) * 2.0, 0.3, 0.18, 0.28, r() * TAU));
  }
  const [dx, dz] = L(0, 1.75);
  put(b, T.box, COL.stoneD, MX(dx, 0.55, dz, 1.1, 1.1, 0.5, face));
  put(b, T.box, 0x120a0a, MX(dx + Math.sin(face) * 0.2, 0.5, dz + Math.cos(face) * 0.2, 0.7, 0.75, 0.2, face), false);
  glow(b, T.box, G.ember, MX(dx + Math.sin(face) * 0.24, 0.3, dz + Math.cos(face) * 0.24, 0.6, 0.3, 0.12, face));
  put(b, T.cyl7, W.clayD, MX(x, 1.85, z, 0.3, 0.4, 0.3));
  out.smoke.push(V(x, y + 2.1, z));
  out.stains.add(x, z, 4.6, W.slag, 0.55);
  out.pools.push({ x: dx + Math.sin(face) * 1.2, z: dz + Math.cos(face) * 1.2, r: 2.2, color: 0xff6a24, amt: 0.35 });
  // Charcoal pile
  const [cx, cz] = L(2.6, 1.0);
  ctx.place(cx, cz, 0.8);
  put(b, T.cone6, W.slag, MX(cx, 0.35, cz, 0.9, 0.7, 0.8, r() * TAU));
  for (let k = 0; k < 5; k++) put(b, T.box, W.slagL, MX(cx + (r() - 0.5) * 1.6, 0.06, cz + (r() - 0.5) * 1.4, 0.3, 0.1, 0.12, r() * TAU), false);
  ctx.solids.add(x, z, 2.3);
  ctx.solids.add(cx, cz, 0.8);
}

/** Woodpile: logs stacked in crisscrossing layers, the cut ends showing pale grain */
function woodpile(ctx: FieldCtx, x: number, z: number, a: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1.3);
  const face = a + Math.PI / 2;
  const L = local(x, z, face);
  let k = 0;
  for (let row = 0; row < 3; row++) {
    const n = 4 - row;
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * 0.42;
      const [px, pz] = L(lx, 0);
      const y = 0.2 + row * 0.36;
      const len = 2.1 + (r() - 0.5) * 0.3;
      put(b, T.cyl7, k++ % 3 ? W.wood : W.woodD, MX(px, y, pz, 0.2, len, 0.2, face, Math.PI / 2));
      for (const s of [-1, 1]) {
        const [ex, ez] = local(px, pz, face)(0, (s * len) / 2 + s * 0.005);
        put(b, T.disc, W.woodL, MX(ex, y, ez, 0.17, 1, 0.17, face, (s * Math.PI) / 2), false);
      }
    }
  }
  ctx.solids.add(x, z, 1.3);
}

/**
 * Scaffolding for wall repairs: two rows of timber posts, two levels of planking, diagonal braces and a ladder,
 * with a boom on top lowering a bucket
 */
function scaffold(ctx: FieldCtx, x: number, z: number, a: number, y0: number): void {
  const { b } = ctx;
  const face = Math.atan2(Math.cos(a), Math.sin(a));
  const L = local(x, z, face);
  b.lift = y0;
  const H = 5.6;
  for (const lx of [-2.2, 0, 2.2]) {
    for (const lz of [-0.55, 0.75]) {
      const [px, pz] = L(lx, lz);
      put(b, T.cyl5, W.woodD, MX(px, H / 2, pz, 0.09, H, 0.09));
      if (lz > 0) ctx.solids.add(px, pz, 0.25);
    }
  }
  for (const y of [2.1, 4.1]) {
    const [px, pz] = L(0, 0.1);
    put(b, T.box, W.wood, MX(px, y, pz, 4.8, 0.08, 1.5, face));
    for (const lz of [-0.55, 0.75]) {
      const [qx, qz] = L(0, lz);
      put(b, T.box, W.woodD, MX(qx, y + 0.9, qz, 4.6, 0.07, 0.07, face));
    }
  }
  for (const s of [-1, 1]) {
    const [px, pz] = L(s * 1.1, 0.76);
    put(b, T.box, W.woodD, MX(px, 2.0, pz, 2.6, 0.08, 0.08, face, 0, s * 0.75));
  }
  // Ladder
  const [lx, lz] = L(2.9, 0.9);
  for (const s of [-1, 1]) put(b, T.box, W.wood, MX(lx + Math.cos(face) * s * 0.22, 2.05, lz - Math.sin(face) * s * 0.22, 0.06, 4.2, 0.06, face, -0.12));
  for (let i = 0; i < 9; i++) put(b, T.box, W.wood, MX(lx, 0.3 + i * 0.45, lz + Math.cos(face) * (0.25 - i * 0.055), 0.46, 0.05, 0.05, face), false);
  // Boom, rope and bucket
  const [tx, tz] = L(-1.6, 1.8);
  const [bx, bz] = L(-1.6, 0.4);
  put(b, T.box, W.woodD, MX((tx + bx) / 2, H + 0.1, (tz + bz) / 2, 0.12, 0.12, 1.8, face));
  put(b, T.cyl5, W.rope, MX(tx, H - 1.4, tz, 0.02, 2.8, 0.02), false);
  put(b, T.cyl7, W.woodD, MX(tx, H - 3.0, tz, 0.26, 0.4, 0.26));
  // Stones at the foot and a mortar bucket
  const [sx, sz] = L(1.1, 1.3);
  put(b, T.box, COL.stone, MX(sx, 0.25, sz, 0.7, 0.5, 0.5, face + 0.3));
  put(b, T.box, COL.stoneL, MX(sx + 0.2, 0.7, sz, 0.55, 0.4, 0.45, face - 0.2));
  const [ux, uz] = L(-0.6, 1.4);
  put(b, T.cyl7, W.woodD, MX(ux, 0.3, uz, 0.28, 0.6, 0.28));
  put(b, T.disc, 0xb8b0a0, MX(ux, 0.61, uz, 0.25, 1, 0.25), false);
  ctx.solids.add(sx, sz, 0.5);
}

/** Forge scrap heap: cold slag, broken swords, bent iron plates, with not-yet-cooled red slag underneath */
function forgeDebris(ctx: FieldCtx, x: number, z: number, out: WorksOut): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 1.6);
  put(b, T.ico1, W.slag, MX(x, 0.05, z, 1.7, 0.6, 1.4, r() * TAU));
  for (let k = 0; k < 6; k++) {
    const a = r() * TAU;
    const d = r() * 1.1;
    const h = 0.5 - d * 0.25;
    sword(ctx, x + Math.cos(a) * d, y + h, z + Math.sin(a) * d, 0.7 + r() * 0.3, r() * TAU, (r() - 0.5) * 1.4, (r() - 0.5) * 1.4, COL.ironTrim, r() < 0.3 ? COL.bronze : COL.iron);
  }
  for (let k = 0; k < 4; k++) {
    const a = r() * TAU;
    put(b, T.box, W.ironL, MX(x + Math.cos(a) * 1.0, 0.45, z + Math.sin(a) * 1.0, 0.8, 0.05, 0.5, r() * TAU, (r() - 0.5) * 1.2, (r() - 0.5) * 0.8));
  }
  for (let k = 0; k < 5; k++) {
    const a = r() * TAU;
    const d = 0.6 + r() * 1.2;
    glow(b, T.dod, k % 2 ? G.ember : G.seam, MX(x + Math.cos(a) * d, 0.12, z + Math.sin(a) * d, 0.14, 0.1, 0.12, r() * TAU));
  }
  out.pools.push({ x, z, r: 2.6, color: 0xff5a1a, amt: 0.25 });
  out.stains.add(x, z, 3.4, W.slag, 0.6);
  ctx.solids.add(x, z, 1.6);
}

/** Iron ingots piled in crisscross layers (the top two layers just out of the furnace and still glowing red) */
function ingots(ctx: FieldCtx, x: number, z: number, a: number): void {
  const { b } = ctx;
  ctx.place(x, z, 0.6);
  for (let row = 0; row < 4; row++) {
    const ang = a + (row % 2 ? Math.PI / 2 : 0);
    for (let i = 0; i < 3; i++) {
      const [px, pz] = local(x, z, ang)((i - 1) * 0.22, 0);
      const m = MX(px, 0.07 + row * 0.13, pz, 0.18, 0.12, 0.55, ang);
      if (row >= 2) glow(b, T.box, row === 3 ? G.fire : G.ember, m);
      else put(b, T.box, row % 2 ? COL.ironL : COL.bronze, m);
    }
  }
  ctx.solids.add(x, z, 0.55);
}

/** Quench barrel: an iron-hooped wooden barrel holding black water */
function barrels(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.8);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + r();
    const px = x + Math.cos(a) * 0.55;
    const pz = z + Math.sin(a) * 0.55;
    put(b, T.cyl7, W.woodD, MX(px, 0.45, pz, 0.36, 0.9, 0.36));
    for (const y of [0.2, 0.7]) put(b, T.torus, W.iron, MX(px, y, pz, 0.37, 0.5, 0.37), false);
    put(b, T.disc, 0x16202a, MX(px, 0.88, pz, 0.33, 1, 0.33), false);
  }
  ctx.solids.add(x, z, 1.0);
}

// ───────────────────────── Ridge road downhill from the North Gate ─────────────────────────

/**
 * Stretch an iron chain railing along the downhill side of the ridge road; beside the road an overturned mine cart has spilled
 * still-red ore all over the ground
 */
function ridgeRoad(ctx: FieldCtx, busy: Solids, out: WorksOut): void {
  const { b, r } = ctx;
  const pw = ctx.layout.pathW;
  const pts = samplePath(SH.PATH, 1);
  const y0 = ctx.h(SH.TOWN[0], SH.TOWN[1]);
  // Going down from the town gate: the stretch where the road is 1.5 to 9 m below the town
  let prev: THREE.Vector3[] = [];
  for (let i = 2; i < pts.length - 2; i += 3) {
    const [x, z] = pts[i];
    const hp = ctx.h(x, z);
    if (hp > y0 - 1.5 || hp < y0 - 9.5) {
      prev = [];
      continue;
    }
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i + 1];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (bz - az) / l;
    const nz = -(bx - ax) / l;
    const next: THREE.Vector3[] = [];
    for (const s of [-1, 1]) {
      const px = x + nx * s * (pw + 1.5);
      const pz = z + nz * s * (pw + 1.5);
      // Fence only the steeply downhill side
      const drop = hp - ctx.h(x + nx * s * (pw + 5), z + nz * s * (pw + 5));
      if (drop < 1.6 || ctx.solids.blocked(px, pz, 0.35) || ctx.pathDist(px, pz) < pw + 1.1) continue;
      const top = chainPost(ctx, px, pz);
      const p0 = prev[s < 0 ? 0 : 1];
      if (p0 && p0.distanceTo(top) < 3.8) chain(ctx, p0, top, 0.25);
      next[s < 0 ? 0 : 1] = top;
      busy.add(px, pz, 0.6);
    }
    prev = next;
  }
  // The overturned mine cart: near the fork at the foot of the hill, west of the road
  const fork = SH.TRAILS[2][0];
  const p = spot(ctx, busy, fork[0] + 6, fork[1] + 9, 7, 1.6, 0.35);
  if (p) {
    const [x, z] = p;
    const face = r() * TAU;
    const L = local(x, z, face);
    ctx.place(x, z, 1.2);
    put(b, T.hexT, W.ironL, MX(x, 0.62, z, 0.95, 0.75, 0.75, face + Math.PI / 6, 0, 1.25));
    for (const s of [-1, 1]) {
      const [wx, wz] = L(0.55, s * 0.45);
      put(b, T.cyl7, W.iron, MX(wx, 0.55 + s * 0.2, wz, 0.24, 0.1, 0.24, face, 0.3, 0.2));
    }
    const [wx, wz] = L(-1.6, 0.8);
    put(b, T.cyl7, W.iron, MX(wx, 0.05, wz, 0.24, 0.1, 0.24, face));
    // The spilled ore
    for (let k = 0; k < 7; k++) {
      const a = face - Math.PI / 2 + (r() - 0.5) * 1.4;
      const d = 0.8 + r() * 1.6;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      b.lift = ctx.h(px, pz);
      if (k % 2) glow(b, T.oct, G.ember, MX(px, 0.1, pz, 0.12, 0.12, 0.12, r() * TAU));
      else put(b, T.dod, G.crust, MX(px, 0.08, pz, 0.2, 0.14, 0.18, r() * TAU));
    }
    out.pools.push({ x: x + Math.cos(face - Math.PI / 2) * 1.2, z: z + Math.sin(face - Math.PI / 2) * 1.2, r: 2.2, color: 0xff6a24, amt: 0.25 });
    ctx.solids.add(x, z, 1.1);
    busy.add(x, z, 2.5);
  }
}

// ───────────────────────── Wheel ruts ─────────────────────────

/**
 * Two wheel ruts pressed in by ore carts along the main road: dark thin bands hugging the road surface (town gate to the tower
 * approach, not drawn on the bridge)
 */
function ruts(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const pts = samplePath(SH.PATH, 0.5);
  const crossings = SH.getCrossings();
  const L = ctx.layout;
  const skip = (x: number, z: number) =>
    Math.hypot(x - L.town[0], z - L.town[1]) < SH.WALL_R + 1 || Math.hypot(x - L.tower[0], z - L.tower[1]) < 19 || crossings.some((c) => Math.hypot(x - c.c[0], z - c.c[1]) < 8.5);
  b.lift = 0;
  // Each of the two ruts is one continuous band hugging the ground (separate boxes would break into dashes on an uneven road);
  // a segment is cut every 10 sample points, narrowing at its head and tail,
  // and now and then a whole segment is skipped (the rut has been trodden flat)
  for (const side of [-1, 1]) {
    let run: XZ[] = [];
    const flush = () => {
      if (run.length >= 3 && r() > 0.08) ribbon(ctx, run, side < 0 ? 0x57443a : 0x5e4a3e);
      run = [];
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      if (skip(ax, az)) {
        flush();
        continue;
      }
      const l = Math.hypot(bx - ax, bz - az) || 1;
      const w = 0.95 + 0.08 * Math.sin(i * 0.27 + side);
      run.push([ax + ((bz - az) / l) * side * w, az - ((bx - ax) / l) * side * w]);
      if (run.length >= 20) {
        const last = run[run.length - 1];
        flush();
        run.push(last);
      }
    }
    flush();
  }
}

/** A band hugging the ground: about 0.13 m to each side along pts, narrowing at head and tail */
function ribbon(ctx: FieldCtx, pts: XZ[], color: number): void {
  const n = pts.length;
  const [cx, cz] = pts[n >> 1];
  const cy = ctx.h(cx, cz);
  const pos: number[] = [];
  const nor: number[] = [];
  const nv = new THREE.Vector3();
  const edge = (i: number, s: number): [number, number, number, number, number, number] => {
    const [x, z] = pts[i];
    const [px, pz] = pts[Math.max(0, i - 1)];
    const [qx, qz] = pts[Math.min(n - 1, i + 1)];
    const dx = qx - px;
    const dz = qz - pz;
    const l = Math.hypot(dx, dz) || 1;
    const t = Math.min(i, n - 1 - i) / 2;
    const hw = 0.13 * Math.min(1, 0.35 + t * 0.65) * (0.9 + 0.1 * Math.sin(x * 1.7 + z));
    const ex = x + (dz / l) * s * hw;
    const ez = z - (dx / l) * s * hw;
    // Use the ground's normal for the normals: lighting matches the road surface, only the color differs
    ctx.terrain.normalAt(ex, ez, nv);
    return [ex - cx, ctx.h(ex, ez) + 0.025 - cy, ez - cz, nv.x, nv.y, nv.z];
  };
  for (let i = 0; i < n - 1; i++) {
    const q = [edge(i, -1), edge(i + 1, -1), edge(i, 1), edge(i, 1), edge(i + 1, -1), edge(i + 1, 1)];
    for (const v of q) {
      pos.push(v[0], v[1], v[2]);
      nor.push(v[3], v[4], v[5]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  ctx.b.add(g, color, new THREE.Matrix4().makeTranslation(cx, cy, cz), false);
}

// ───────────────────────── The Knights' guard post at the south end of the stone bridge ─────────────────────────

function bridgeCheckpoint(ctx: FieldCtx, busy: Solids, out: WorksOut): void {
  const { b, r } = ctx;
  const c = SH.getCrossings()[0];
  const south = c.pts[0];
  const p = spot(ctx, busy, south[0] + 7, south[1] + 4, 8, 3.2, 0.3);
  if (!p) return;
  const [x, z] = p;
  const face = Math.atan2(south[0] - x, south[1] - z);
  const L = local(x, z, face);
  // Tents, braziers, spear racks, supply crates, banner
  const [tx, tz] = L(-1.6, -1.4);
  tent(ctx, tx, tz, 1.5, COL.cloth, COL.woodD, face);
  out.flames.push(brazier(ctx, ...L(1.4, 0.8), 1.1));
  const [kx, kz] = L(2.2, -1.2);
  ctx.place(kx, kz, 0.6);
  put(b, T.box, W.woodD, MX(kx, 0.7, kz, 1.6, 0.1, 0.12, face));
  for (let i = 0; i < 4; i++) {
    const [sx, sz] = local(kx, kz, face)(-0.6 + i * 0.4, 0);
    put(b, T.cyl5, W.woodD, MX(sx, 1.1, sz, 0.025, 2.4, 0.025, face, 0.1), false);
    put(b, T.cone4, COL.ironTrim, MX(sx, 2.35, sz + 0.12, 0.05, 0.28, 0.05, face, 0.1));
  }
  ctx.solids.add(kx, kz, 0.6);
  oreCrates(ctx, ...L(-2.8, 1.4), face + 0.4, G.fire);
  flagPole(ctx, ...L(0.2, -2.6), face, out);
  // Barricades: on the side facing the lava river
  const [cx, cz] = L(0.4, 3.4);
  if (!ctx.solids.blocked(cx, cz, 1) && ctx.pathDist(cx, cz) > ctx.layout.pathW + 2) {
    ctx.place(cx, cz, 1.2);
    const ra = face + Math.PI / 2;
    put(b, T.cyl7, W.woodD, MX(cx, 0.6, cz, 0.12, 3.2, 0.12, ra, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) {
      const [sx, sz] = local(cx, cz, ra)(0, -1.2 + i * 0.8);
      for (const s of [-1, 1]) {
        put(b, T.cyl5, W.wood, MX(sx, 0.6, sz, 0.05, 1.7, 0.05, ra + Math.PI / 2, s * 0.7));
        const [ex, ez] = local(sx, sz, ra + Math.PI / 2)(0, s * 0.55);
        put(b, T.cone4, W.woodL, MX(ex, 0.6 + 0.62, ez, 0.06, 0.2, 0.06, ra + Math.PI / 2, s * 0.7));
      }
      ctx.solids.add(sx, sz, 0.45);
    }
  }
  out.pools.push({ x, z, r: 3.5, color: 0xffa040, amt: 0.22 });
  busy.add(x, z, 4.5);
  void r;
}

// ───────────────────────── The volcanologist's observation camp ─────────────────────────

/**
 * Beside the Geyser Flats: a tent, a tripod-mounted instrument, a table piled with notes,
 * and red-and-white survey stakes beside the sinter mounds with a warning rope strung between them
 */
function surveyCamp(ctx: FieldCtx, busy: Solids, out: WorksOut): void {
  const { b, r } = ctx;
  const [gx, gz] = SH.GEYSER;
  const p = spot(ctx, busy, gx - 15, gz + 8, 7, 3.0, 0.3);
  if (p) {
    const [x, z] = p;
    const face = Math.atan2(gx - x, gz - z);
    const L = local(x, z, face);
    tent(ctx, ...L(-1.8, -1.2), 1.4, W.canvas, W.wood, face);
    // Tripod instrument: aimed at the sinter mound
    const [ix, iz] = L(1.3, 1.4);
    const iy = ctx.place(ix, iz, 0.4);
    for (let k = 0; k < 3; k++) put(b, T.cyl5, W.woodD, lean(ix, 0, iz, (k / 3) * TAU, -0.28, 1.5, 0.03, 0.03), false);
    put(b, T.box, COL.bronze, MX(ix, 1.45, iz, 0.26, 0.2, 0.44, face));
    glow(b, T.disc, 0x9adcff, MX(ix + Math.sin(face) * 0.23, 1.47, iz + Math.cos(face) * 0.23, 0.07, 1, 0.07, face, Math.PI / 2));
    ctx.solids.add(ix, iz, 0.5);
    void iy;
    // Table, notebook, lantern
    const [dx, dz] = L(1.5, -1.0);
    ctx.place(dx, dz, 0.6);
    put(b, T.box, W.wood, MX(dx, 0.78, dz, 1.3, 0.07, 0.7, face));
    for (const [lx, lz] of [
      [-0.55, -0.28],
      [0.55, -0.28],
      [-0.55, 0.28],
      [0.55, 0.28],
    ]) {
      const [qx, qz] = local(dx, dz, face)(lx, lz);
      put(b, T.box, W.woodD, MX(qx, 0.38, qz, 0.06, 0.76, 0.06), false);
    }
    const books = [0x8a2a22, 0x2a4a6a, 0xc8b48a, 0x4a6a3a];
    for (let k = 0; k < 4; k++) {
      const [qx, qz] = local(dx, dz, face)(-0.4 + k * 0.22, (r() - 0.5) * 0.3);
      put(b, T.box, books[k], MX(qx, 0.84 + (k === 1 ? 0.04 : 0), qz, 0.18, 0.05 + (k === 1 ? 0.04 : 0), 0.25, face + (r() - 0.5) * 0.5), false);
    }
    const [lx, lz] = local(dx, dz, face)(0.45, 0.15);
    glow(b, T.oct, 0xffc860, MX(lx, 0.98, lz, 0.08, 0.12, 0.08));
    put(b, T.cone4, W.iron, MX(lx, 1.12, lz, 0.1, 0.08, 0.1, Math.PI / 4));
    out.pools.push({ x: lx, z: lz, r: 2.2, color: 0xffc070, amt: 0.3 });
    ctx.solids.add(dx, dz, 0.8);
    busy.add(x, z, 4);
  }
  // Survey stakes and warning rope: on the side of each sinter mound facing the camp
  for (const [vx, vz, s] of SH.GEYSER_VENTS) {
    const cx = gx + vx;
    const cz = gz + vz;
    const a0 = Math.atan2(gz + 8 - cz, gx - 15 - cx);
    let prev: THREE.Vector3 | null = null;
    for (let k = -1; k <= 1; k++) {
      const a = a0 + k * 0.55;
      const x = cx + Math.cos(a) * 3.6 * s;
      const z = cz + Math.sin(a) * 3.6 * s;
      if (ctx.solids.blocked(x, z, 0.3) || ctx.pathDist(x, z) < ctx.layout.pathW + 0.8) {
        prev = null;
        continue;
      }
      const y = ctx.place(x, z);
      put(b, T.box, 0xe8e0d0, MX(x, 0.5, z, 0.06, 1.0, 0.06));
      put(b, T.box, 0xc03020, MX(x, 0.62, z, 0.065, 0.2, 0.065), false);
      put(b, T.box, 0xc03020, MX(x + 0.14, 0.9, z, 0.28, 0.16, 0.01, a + Math.PI / 2), false);
      const top = V(x, y + 0.85, z);
      if (prev) {
        const pts = catenary(prev, top, 0.12, 6);
        for (let i = 0; i < 6; i++) {
          const d = pts[i + 1].clone().sub(pts[i]);
          const l = d.length();
          b.lift = 0;
          put(b, T.cyl5, W.rope, new THREE.Matrix4().compose(pts[i].clone().add(pts[i + 1]).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(0.015, l, 0.015)), false);
        }
      }
      prev = top;
      ctx.solids.add(x, z, 0.12);
    }
  }
}
