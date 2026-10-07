// Rediron Keep: a forge city ringed by an iron-banded stone wall. The North Gate faces the Seal Tower, and inside it is the
// plaza of the Oathsword statue; to the east is the fire-lit Great Blast Furnace, to the west a row of smithies, to the
// southwest the Knights' barracks and to the south the drill yard; the four red-roofed corner towers on the wall fly the
// Knights' banners.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { banner, pennants } from './fx.ts';
import { COL, anvil, box, brazier, emberMaple, local, oreCrates, sword } from './props.ts';
import { samplePath } from '../../compose.ts';
import { PATH, TOWER, TOWN, TRAILS, WALL_R } from './shape.ts';

export interface TownOut {
  /** Chimney mouths (smoke and sparks) */
  chimneys: { p: THREE.Vector3; big: boolean }[];
  /** Brazier flame positions */
  flames: THREE.Vector3[];
  /** Banner geometry (hung on a flagpole; the caller merges it into one waving mesh) */
  flags: THREE.BufferGeometry[];
  /** Blast furnace tap holes (spray sparks) */
  tap: THREE.Vector3;
  /** Flickering furnace fire */
  fireGeos: THREE.BufferGeometry[];
}

const GATE_A = Math.atan2(TOWER[1] - TOWN[1], TOWER[0] - TOWN[0]);

/** Polar coordinates inside the town: angle 0 = east, π/2 = south */
const polar = (a: number, r: number): [number, number] => [TOWN[0] + Math.cos(a) * r, TOWN[1] + Math.sin(a) * r];
/** Facing toward the town center */
const faceCenter = (x: number, z: number) => Math.atan2(TOWN[0] - x, TOWN[1] - z);

export function buildTown(ctx: FieldCtx): TownOut {
  const out: TownOut = { chimneys: [], flames: [], flags: [], tap: new THREE.Vector3(), fireGeos: [] };
  const y0 = ctx.h(TOWN[0], TOWN[1]);
  walls(ctx, y0, out);
  gatehouse(ctx, y0, out);
  furnace(ctx, y0, out);
  const [sax, saz] = polar((200 / 180) * Math.PI, 11.5);
  smithy(ctx, sax, saz, faceCenter(sax, saz) + 0.25, out);
  const [sbx, sbz] = polar((158 / 180) * Math.PI, 11.5);
  smithy(ctx, sbx, sbz, faceCenter(sbx, sbz) - 0.2, out);
  const [bx, bz] = polar((132 / 180) * Math.PI, 13);
  barracks(ctx, bx, bz, faceCenter(bx, bz), out);
  trainingYard(ctx, ...polar((62 / 180) * Math.PI, 11.5));
  for (const [a, r] of [
    [-48, 13],
    [36, 13.5],
    [98, 14.2],
    [-18, 14],
  ] as const) {
    const [hx, hz] = polar((a / 180) * Math.PI, r);
    house(ctx, hx, hz, faceCenter(hx, hz), a === 98 ? 1 : 0, out);
  }
  monument(ctx, 40.6, 61.2, out);
  for (const a of [-76, -124]) {
    const [mx, mz] = polar((a / 180) * Math.PI, 13.2);
    stall(ctx, mx, mz, faceCenter(mx, mz), a === -76 ? COL.cloth : 0x8a5a2a);
  }
  // braziers on both sides of the street
  for (const [x, z] of [
    [30.6, 51.5],
    [36.6, 52.2],
    [31.4, 57.8],
    [38.2, 58.4],
    [31.8, 70.2],
    [39.8, 69.4],
  ] as const) out.flames.push(brazier(ctx, x, z, 1.25));
  // clutter: ore crates, coal piles, handcarts
  oreCrates(ctx, 43.4, 60.6, 0.4);
  oreCrates(ctx, 29.2, 73.6, 2.2);
  oreCrates(ctx, 27.2, 54.2, -0.8);
  coalHeap(ctx, 51.4, 64.4, 1.6);
  coalHeap(ctx, 49.8, 71.6, 1.2);
  cart(ctx, 42.8, 70.6, 0.9);
  // flame maples inside the town
  for (const [x, z, s] of [
    [44.8, 80.6, 1.2],
    [23.4, 76.6, 1.1],
    [51.6, 57.6, 1.0],
  ] as const) emberMaple(ctx, x, z, s);
  approach(ctx, out);
  bluffColumns(ctx);
  if (ctx.done >= ctx.floors) festival(ctx, y0, out);
  ctx.b.lift = 0;
  return out;
}

// ───────────────────────── Basalt column cliff below the town ─────────────────────────

/**
 * The cliff face of Rediron Keep's terrace: two rows of hexagonal basalt columns stand against the slope, one tier at the
 * cliff top and one at the cliff foot
 */
function bluffColumns(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [cx, cz] = TOWN;
  const pw = ctx.layout.pathW;
  const step = ctx.low ? 0.085 : 0.052;
  b.lift = 0;
  for (let a = 0; a < Math.PI * 2; a += step * (0.8 + r() * 0.4)) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const hAt = (rr: number) => ctx.h(cx + ca * rr, cz + sa * rr);
    // find the start and end of the steep slope along the radius
    let rTop = -1;
    let rFoot = -1;
    let prev = hAt(22);
    for (let rr = 22.5; rr <= 46; rr += 0.5) {
      const h = hAt(rr);
      if (prev - h > 0.42) {
        if (rTop < 0) rTop = rr - 0.5;
        rFoot = rr;
      }
      prev = h;
    }
    if (rTop < 0 || rFoot - rTop < 2) continue;
    const hTop = hAt(rTop);
    const hFoot = hAt(rFoot);
    const drop = hTop - hFoot;
    if (drop < 4.5) continue;
    for (const k of [0, 1]) {
      const rr = rTop + (rFoot - rTop) * (k ? 0.74 : 0.32) + (r() - 0.5) * 0.5;
      const aa = a + (r() - 0.5) * step * 0.5;
      const x = cx + Math.cos(aa) * rr;
      const z = cz + Math.sin(aa) * rr;
      if (ctx.pathDist(x, z) < pw + 2.5 || ctx.solids.blocked(x, z, 0.5)) continue;
      const g = ctx.h(x, z);
      const topY = (k ? hTop - drop * 0.36 : hTop - 0.25) - r() * 1.3;
      const rad = 0.72 + r() * 0.26;
      const len = topY - (g - 1.2);
      if (len < 1.5) continue;
      const ry = r() * 6;
      const rx = (r() - 0.5) * 0.05;
      const rz = (r() - 0.5) * 0.05;
      b.add(new THREE.CylinderGeometry(rad, rad * 1.05, len, 6), r() < 0.5 ? COL.basalt : COL.basalt2, M(x, g - 1.2 + len / 2, z, ry, 1, rx, rz));
      b.add(new THREE.CylinderGeometry(rad * 0.97, rad * 0.97, 0.12, 6), COL.basaltTop, M(x, topY + 0.03, z, ry, 1, rx, rz), false);
      ctx.solids.add(x, z, rad * 0.9);
    }
  }
}

// ───────────────────────── After purification: festival ─────────────────────────

/**
 * Once the Seal Tower is fully broken through: a festival flagpole goes up in the plaza, bunting is strung from it to the
 * four corner towers and the gatehouse, and the wall gets an extra row of long banners
 */
function festival(ctx: FieldCtx, y0: number, out: TownOut): void {
  const { b } = ctx;
  const [mx, mz] = [TOWN[0] - 1.2, TOWN[1] - 2.6];
  ctx.place(mx, mz, 0.6);
  b.add(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8), COL.stoneD, M(mx, 0.3, mz));
  b.add(new THREE.CylinderGeometry(0.1, 0.14, 12.5, 6), COL.wood, M(mx, 6.25, mz));
  b.add(new THREE.SphereGeometry(0.22, 8, 6), COL.gold, M(mx, 12.6, mz));
  const topY = y0 + 12.2;
  const top = new THREE.Vector3(mx, topY, mz);
  out.flags.push(banner(1.6, 3.2, M(mx + 0.1, topY - 0.3, mz, GATE_A), COL.cloth, COL.gold));
  const cols = [COL.cloth, COL.gold, 0xe8e0d0, 0xd05a1a];
  const anchors: THREE.Vector3[] = [];
  for (const da of [0.95, -0.95, Math.PI - 0.72, Math.PI + 0.72]) {
    const [x, z] = polar(GATE_A + da, WALL_R + 0.3);
    anchors.push(new THREE.Vector3(x, y0 + 10.4, z));
  }
  const gf = Math.atan2(Math.cos(GATE_A), Math.sin(GATE_A));
  const G = local(...polar(GATE_A, WALL_R), gf);
  for (const s of [-1, 1]) {
    const [x, z] = G(s * 4.5, 0);
    anchors.push(new THREE.Vector3(x, y0 + 11.2, z));
  }
  for (const a of anchors) {
    const L = a.distanceTo(top);
    out.flags.push(pennants(top, a, Math.round(L / 0.95), cols, 1.1));
    // thin cord
    const n = 10;
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const p0 = top.clone().lerp(a, t0).add(new THREE.Vector3(0, -4.4 * t0 * (1 - t0), 0));
      const p1 = top.clone().lerp(a, t1).add(new THREE.Vector3(0, -4.4 * t1 * (1 - t1), 0));
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const seg = p1.clone().sub(p0);
      const g = new THREE.CylinderGeometry(0.025, 0.025, seg.length(), 3);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), seg.clone().normalize()));
      b.lift = 0;
      b.add(g, COL.woodD, M(mid.x, mid.y, mid.z), false);
    }
  }
  // outside the wall: a Knights' long banner every so often
  const gap = Math.asin(6.4 / WALL_R);
  const span = Math.PI * 2 - gap * 2;
  const n = Math.round((span * WALL_R) / 3.3);
  for (let i = 0; i < n; i += 3) {
    // aligned with the wall segment's center (the braces are on the segments where i % 3 === 1, so it does not pass through them)
    const a = GATE_A + gap + ((i + 0.5) / n) * span;
    const [x, z] = polar(a, WALL_R + 1.5);
    const face = Math.atan2(Math.cos(a), Math.sin(a));
    out.flags.push(banner(1.2, 3.6, M(x, y0 + 6.1, z, face), (i / 3) % 2 ? COL.cloth : COL.gold, (i / 3) % 2 ? COL.gold : COL.cloth));
  }
  ctx.solids.add(mx, mz, 0.5);
}

// ───────────────────────── Outside the town: the ridge road ─────────────────────────

/**
 * The road down the ridge outside the North Gate: iron lamp posts on both sides, a signpost at the fork, boundary posts at
 * the foot of the hill, and the slag heap below the town
 */
function approach(ctx: FieldCtx, out: TownOut): void {
  const { b } = ctx;
  const pts = samplePath(PATH, 1);
  const [gx, gz] = polar(GATE_A, WALL_R);
  let i0 = 0;
  let best = 1e9;
  pts.forEach(([x, z], i) => {
    const d = Math.hypot(x - gx, z - gz);
    if (d < best) {
      best = d;
      i0 = i;
    }
  });
  const side = ctx.layout.pathW + 1.4;
  const at = (i: number) => {
    const [x, z] = pts[i];
    const [ax, az] = pts[Math.max(0, i - 1)];
    const [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return { x, z, tx: (bx - ax) / l, tz: (bz - az) / l };
  };
  // iron lamp posts: one every 9 m after leaving the town, alternating left and right
  for (let k = 0; k < 5; k++) {
    const i = i0 + 7 + k * 9;
    if (i >= pts.length - 1) break;
    const p = at(i);
    const s = k % 2 ? 1 : -1;
    const lx = p.x - p.tz * side * s;
    const lz = p.z + p.tx * side * s;
    if (ctx.solids.blocked(lx, lz, 0.5)) continue;
    const face = Math.atan2(-s * -p.tz, -s * p.tx);
    const L = local(lx, lz, face);
    ctx.place(lx, lz, 0.3);
    b.add(new THREE.BoxGeometry(0.55, 0.35, 0.55), COL.stoneD, M(lx, 0.17, lz, face));
    b.add(new THREE.CylinderGeometry(0.08, 0.12, 3.3, 6), COL.iron, M(lx, 1.8, lz));
    const [ax, az] = L(0, 0.4);
    b.add(new THREE.BoxGeometry(0.07, 0.07, 0.9), COL.iron, M(ax, 3.3, az, face));
    const [hx, hz] = L(0, 0.78);
    b.add(new THREE.BoxGeometry(0.34, 0.08, 0.34), COL.iron, M(hx, 3.08, hz, face));
    b.add(new THREE.BoxGeometry(0.34, 0.08, 0.34), COL.iron, M(hx, 2.62, hz, face));
    b.glow(new THREE.BoxGeometry(0.26, 0.4, 0.26), COL.fire, M(hx, 2.85, hz, face));
    ctx.solids.add(lx, lz, 0.35);
  }
  // signpost at the fork at the foot of the hill (north: Seal Tower; east: Sword Mound)
  {
    const fork = TRAILS[2][0];
    let fi = i0;
    let fd = 1e9;
    pts.forEach(([x, z], i) => {
      const d = Math.hypot(x - fork[0], z - fork[1]);
      if (d < fd) {
        fd = d;
        fi = i;
      }
    });
    const p = at(Math.max(i0, fi - 5));
    const x = p.x + p.tz * (side + 0.6);
    const z = p.z - p.tx * (side + 0.6);
    if (!ctx.solids.blocked(x, z, 0.5)) {
      ctx.place(x, z, 0.3);
      b.add(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), COL.woodD, M(x, 1.3, z));
      const north = Math.atan2(TOWER[0] - x, TOWER[1] - z);
      for (const [a, y] of [
        [north, 2.2],
        [Math.PI / 2 - 0.1, 1.75],
      ] as const) {
        const L = local(x, z, a);
        const [bx, bz] = L(0, 0.5);
        b.add(new THREE.BoxGeometry(1.0, 0.28, 0.06), COL.wood, M(bx, y, bz, a - Math.PI / 2));
        const [tx, tz] = L(0, 1.12);
        b.add(new THREE.ConeGeometry(0.2, 0.26, 3), COL.wood, M(tx, y, tz, a - Math.PI / 2, 1, 0, -Math.PI / 2));
      }
      ctx.solids.add(x, z, 0.3);
    }
  }
  // boundary posts at the foot of the hill: basalt columns topped with the Knights' banner
  {
    let i1 = i0;
    while (i1 < pts.length - 2 && ctx.h(pts[i1][0], pts[i1][1]) > ctx.h(TOWN[0], TOWN[1]) - 9) i1++;
    const p = at(i1);
    for (const s of [-1, 1]) {
      const x = p.x - p.tz * (side + 0.4) * s;
      const z = p.z + p.tx * (side + 0.4) * s;
      if (ctx.solids.blocked(x, z, 0.8)) continue;
      const face = Math.atan2(p.tx, p.tz);
      ctx.place(x, z, 0.8);
      b.add(new THREE.CylinderGeometry(0.72, 0.9, 4.4, 6), COL.basalt, M(x, 2.2, z, 0.3));
      b.add(new THREE.CylinderGeometry(0.95, 0.95, 0.35, 6), COL.ironL, M(x, 4.5, z, 0.3));
      b.add(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 5), COL.iron, M(x, 6.2, z));
      const y = ctx.b.lift;
      b.add(new THREE.BoxGeometry(1.4, 0.08, 0.08), COL.iron, M(x + Math.sin(face) * 0.1, 7.7, z + Math.cos(face) * 0.1, face));
      out.flags.push(banner(1.1, 2.2, M(x + Math.sin(face) * 0.14, y + 7.65, z + Math.cos(face) * 0.14, face), COL.cloth, COL.gold));
      out.flames.push(new THREE.Vector3(x, y + 4.9, z));
      b.glow(new THREE.CylinderGeometry(0.5, 0.6, 0.25, 6), COL.ember, M(x, 4.78, z, 0.3));
      ctx.solids.add(x, z, 1.0);
    }
  }
  // slag heap on the west side below the town: black slag tipped down from the wall, with red that has not cooled yet inside
  for (const [a, rr, s] of [
    [196, 29, 1.4],
    [214, 30, 1.1],
    [178, 30.5, 1.2],
  ] as const) {
    const [x, z] = polar((a / 180) * Math.PI, rr);
    if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 2)) continue;
    ctx.place(x, z, 2 * s);
    const g = new THREE.DodecahedronGeometry(2.2 * s, 1);
    g.scale(1.3, 0.5, 1.1);
    b.add(g, 0x1c1618, M(x, 0.1, z, a));
    for (let k = 0; k < 6; k++) {
      const q = ctx.r() * Math.PI * 2;
      const d = ctx.r() * 2.2 * s;
      b.add(new THREE.DodecahedronGeometry((0.25 + ctx.r() * 0.3) * s, 0), 0x2a2024, M(x + Math.cos(q) * d, 0.5 * s, z + Math.sin(q) * d, q), false);
    }
    for (let k = 0; k < 3; k++) {
      const q = ctx.r() * Math.PI * 2;
      const d = ctx.r() * 1.6 * s;
      b.glow(new THREE.DodecahedronGeometry(0.16 * s, 0), COL.ember, M(x + Math.cos(q) * d, 0.8 * s, z + Math.sin(q) * d, q));
    }
    ctx.solids.add(x, z, 2 * s);
  }
}

// ───────────────────────── Town wall and corner towers ─────────────────────────

function walls(ctx: FieldCtx, y0: number, out: TownOut): void {
  const { b } = ctx;
  const R = WALL_R;
  const gap = Math.asin(6.4 / R);
  const a0 = GATE_A + gap;
  const span = Math.PI * 2 - gap * 2;
  const n = Math.round((span * R) / 3.3);
  b.lift = y0;
  const H = 6.2;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + 0.5) / n) * span;
    const [x, z] = polar(a, R);
    const ry = -a + Math.PI / 2;
    const len = (span * R) / n + 0.25;
    b.add(new THREE.BoxGeometry(len, H, 2.6), COL.stoneD, M(x, H / 2, z, ry));
    // outer iron bands (two) and the sloped wall base
    const [ox, oz] = polar(a, R + 1.34);
    b.add(new THREE.BoxGeometry(len + 0.05, 0.28, 0.12), COL.ironL, M(ox, 2.3, oz, ry), false);
    b.add(new THREE.BoxGeometry(len + 0.05, 0.28, 0.12), COL.ironL, M(ox, 4.4, oz, ry), false);
    const [fx, fz] = polar(a, R + 1.5);
    b.add(new THREE.BoxGeometry(len, 1.4, 1.4), COL.stone, M(fx, 0.2, fz, ry, 1, 0.5, 0));
    // wall-top walkway and battlements
    b.add(new THREE.BoxGeometry(len, 0.3, 2.9), COL.stone, M(x, H + 0.15, z, ry));
    const k = Math.max(1, Math.round(len / 1.65));
    for (let j = 0; j < k; j++) {
      const aj = a + (((j + 0.5) / k - 0.5) * len) / R;
      const [mx, mz] = polar(aj, R + 1.05);
      b.add(new THREE.BoxGeometry(0.85, 0.9, 0.55), COL.stone, M(mx, H + 0.75, mz, -aj + Math.PI / 2));
    }
    // one brace every three segments
    if (i % 3 === 1) {
      const [px, pz] = polar(a, R + 1.9);
      b.add(new THREE.BoxGeometry(1.1, H * 0.8, 1.6), COL.stoneD, M(px, H * 0.38, pz, ry, 1, 0.14, 0));
    }
  }
  // collision: a ring along the wall
  const m = Math.round((span * R) / 1.6);
  for (let i = 0; i <= m; i++) {
    const [x, z] = polar(a0 + (i / m) * span, R);
    ctx.solids.add(x, z, 1.6);
  }
  // four corner towers
  for (const da of [0.95, -0.95, Math.PI - 0.72, Math.PI + 0.72]) {
    const a = GATE_A + da;
    const [x, z] = polar(a, R + 0.3);
    tower(ctx, x, z, y0, out);
  }
}

function tower(ctx: FieldCtx, x: number, z: number, y0: number, out: TownOut): void {
  const { b } = ctx;
  b.lift = y0;
  const R = 2.9;
  const H = 10;
  b.add(new THREE.CylinderGeometry(R, R + 0.35, H, 12), COL.stoneD, M(x, H / 2, z));
  for (const y of [3, 6.4]) b.add(new THREE.TorusGeometry(R + 0.08, 0.14, 4, 16), COL.ironL, M(x, y, z, 0, 1, Math.PI / 2), false);
  b.add(new THREE.CylinderGeometry(R + 0.55, R + 0.3, 0.6, 12), COL.stone, M(x, H + 0.3, z));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.8, 0.8, 0.5), COL.stone, M(x + Math.cos(a) * (R + 0.3), H + 0.95, z + Math.sin(a) * (R + 0.3), -a + Math.PI / 2));
  }
  b.add(new THREE.ConeGeometry(R + 0.4, 4.2, 12), COL.roof, M(x, H + 3.4, z));
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 4), COL.iron, M(x, H + 6.4, z));
  // arrow slits glowing furnace-fire color
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    b.glow(new THREE.BoxGeometry(0.22, 0.95, 0.1), COL.ember, M(x + Math.cos(a) * (R + 0.02), 7.4, z + Math.sin(a) * (R + 0.02), -a + Math.PI / 2));
  }
  // pennants on the flagpoles: they fly downwind (east)
  out.flags.push(banner(1.1, 2.0, M(x, y0 + H + 7.0, z).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), COL.cloth, COL.gold));
  ctx.solids.add(x, z, R + 0.4);
}

function gatehouse(ctx: FieldCtx, y0: number, out: TownOut): void {
  const { b } = ctx;
  const [gx, gz] = polar(GATE_A, WALL_R);
  const facing = Math.atan2(Math.cos(GATE_A), Math.sin(GATE_A));
  const L = local(gx, gz, facing);
  b.lift = y0;
  const H = 11;
  for (const s of [-1, 1]) {
    const [tx, tz] = L(s * 4.5, 0);
    b.add(new THREE.BoxGeometry(4.2, H, 4.8), COL.stoneD, M(tx, H / 2, tz, facing));
    b.add(new THREE.BoxGeometry(4.6, 0.5, 5.2), COL.stone, M(tx, H + 0.25, tz, facing));
    for (const [mx, mz] of [
      [-1.6, -1.9],
      [1.6, -1.9],
      [-1.6, 1.9],
      [1.6, 1.9],
    ]) {
      const [px, pz] = L(s * 4.5 + mx, mz);
      b.add(new THREE.BoxGeometry(0.9, 1.0, 0.9), COL.stone, M(px, H + 1.0, pz, facing));
    }
    // small spires on top of the corner towers
    b.add(new THREE.ConeGeometry(1.4, 2.6, 4), COL.roof, M(tx, H + 2.8, tz, facing + Math.PI / 4));
    // iron plates on the gatehouse outer wall and the glowing arrow slits
    const [wx, wz] = L(s * 4.5, 2.45);
    b.add(new THREE.BoxGeometry(4.3, 0.3, 0.14), COL.ironL, M(wx, 3.2, wz, facing), false);
    b.glow(new THREE.BoxGeometry(0.3, 1.2, 0.1), COL.ember, M(wx, 8.2, wz, facing));
    // long banners: hanging from the gatehouse outer wall
    const [fx, fz] = L(s * 4.5, 2.6);
    out.flags.push(banner(1.5, 4.6, M(fx, y0 + 9.6, fz, facing), COL.cloth, COL.gold));
    ctx.solids.add(tx, tz, 2.5);
  }
  // archway: the beam and arch above the gate opening
  const [ax, az] = L(0, 0);
  b.add(new THREE.BoxGeometry(5.0, 3.4, 4.6), COL.stoneD, M(ax, H - 1.7 - 0.6, az, facing));
  b.add(new THREE.TorusGeometry(2.4, 0.45, 6, 12, Math.PI), COL.stone, M(ax, 6.2, az, facing));
  // raised portcullis
  const [px, pz] = L(0, 1.6);
  for (let j = -2; j <= 2; j++) {
    const [qx, qz] = L(j * 0.85, 1.6);
    b.add(new THREE.BoxGeometry(0.12, 1.6, 0.12), COL.iron, M(qx, 7.0, qz, facing));
    b.add(new THREE.ConeGeometry(0.1, 0.35, 4), COL.iron, M(qx, 6.05, qz, facing, 1, Math.PI));
  }
  b.add(new THREE.BoxGeometry(4.6, 0.14, 0.14), COL.iron, M(px, 6.7, pz, facing));
  b.add(new THREE.BoxGeometry(4.6, 0.14, 0.14), COL.iron, M(px, 7.5, pz, facing));
  // passage walls inside the gate (dark)
  for (const s of [-1, 1]) {
    const [ix, iz] = L(s * 2.5, 0);
    b.add(new THREE.BoxGeometry(0.2, 6, 4.6), COL.rock, M(ix, 3, iz, facing), false);
  }
  // two large braziers outside the gate
  for (const s of [-1, 1]) {
    const [bx, bz] = L(s * 4.2, 5.4);
    out.flames.push(brazier(ctx, bx, bz, 1.6, true));
  }
}

// ───────────────────────── Great Blast Furnace ─────────────────────────

function furnace(ctx: FieldCtx, y0: number, out: TownOut): void {
  const { b } = ctx;
  const [x, z] = polar((6 / 180) * Math.PI, 11.2);
  const facing = faceCenter(x, z);
  const L = local(x, z, facing);
  b.lift = y0;
  b.add(new THREE.CylinderGeometry(4.4, 4.7, 1.2, 12), COL.stone, M(x, 0.6, z));
  b.add(new THREE.CylinderGeometry(3.0, 3.6, 9, 14), COL.iron, M(x, 5.7, z));
  for (const y of [2.2, 4.8, 7.6, 10.0]) b.add(new THREE.TorusGeometry(y > 9 ? 3.05 : 3.5 - y * 0.05, 0.2, 5, 18), COL.bronze, M(x, y, z, 0, 1, Math.PI / 2));
  const belt = new THREE.TorusGeometry(3.52, 0.22, 5, 18);
  belt.applyMatrix4(M(x, y0 + 3.5, z, 0, 1, Math.PI / 2));
  out.fireGeos.push(belt);
  b.add(new THREE.SphereGeometry(3.05, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), COL.ironL, M(x, 10.2, z));
  // chimney
  b.add(new THREE.CylinderGeometry(1.15, 1.45, 14, 10), COL.iron, M(x, 18, z));
  b.add(new THREE.CylinderGeometry(1.55, 1.55, 0.6, 10), COL.ironTrim, M(x, 24.6, z));
  b.add(new THREE.TorusGeometry(1.5, 0.18, 5, 12), COL.bronze, M(x, 16, z, 0, 1, Math.PI / 2));
  const rim = new THREE.TorusGeometry(1.1, 0.2, 5, 12);
  rim.applyMatrix4(M(x, y0 + 25.0, z, 0, 1, Math.PI / 2));
  out.fireGeos.push(rim);
  out.chimneys.push({ p: new THREE.Vector3(x, y0 + 25.2, z), big: true });
  // tap hole and trough: glowing molten iron runs into the molds
  const [tx, tz] = L(0, 3.4);
  b.add(new THREE.BoxGeometry(1.6, 1.6, 0.6), COL.ironL, M(tx, 1.6, tz, facing));
  const tapG = new THREE.BoxGeometry(0.8, 0.7, 0.2);
  tapG.applyMatrix4(M(tx, y0 + 1.5, tz, facing).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.25)));
  out.fireGeos.push(tapG);
  out.tap.set(tx, y0 + 1.4, tz);
  const [cx, cz] = L(0, 5.6);
  b.add(new THREE.BoxGeometry(0.9, 0.5, 4.2), COL.stone, M(cx, 0.25, cz, facing));
  const flow = new THREE.BoxGeometry(0.5, 0.06, 4.0);
  flow.applyMatrix4(M(cx, y0 + 0.52, cz, facing));
  out.fireGeos.push(flow);
  for (const s of [-1, 1]) {
    const [mx, mz] = L(s * 1.3, 7.2);
    b.add(new THREE.BoxGeometry(1.1, 0.4, 1.1), COL.stone, M(mx, 0.2, mz, facing));
    b.glow(new THREE.BoxGeometry(0.8, 0.05, 0.8), COL.fire, M(mx, 0.42, mz, facing));
  }
  // blower house and blast pipes at the side
  const [hx, hz] = L(5.6, -0.6);
  b.add(new THREE.BoxGeometry(3.2, 3.2, 3.6), COL.stoneD, M(hx, 1.6, hz, facing));
  b.add(new THREE.BoxGeometry(3.6, 0.3, 4.0), COL.roofD, M(hx, 3.35, hz, facing));
  const [px, pz] = L(3.6, -0.6);
  b.add(new THREE.CylinderGeometry(0.4, 0.4, 2.6, 8), COL.ironL, M(px, 4.2, pz, facing, 1, 0, Math.PI / 2));
  // wooden charging walkway (slanting up from the ground to the furnace top)
  const [rx, rz] = L(-4.8, -2.6);
  const [rtx, rtz] = L(-2.4, -1.2);
  const ramp = new THREE.Vector3(rtx - rx, 9.6, rtz - rz);
  const len = ramp.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ramp.clone().normalize());
  b.add(new THREE.BoxGeometry(1.4, len, 0.2), COL.wood, new THREE.Matrix4().compose(new THREE.Vector3((rx + rtx) / 2, 4.8, (rz + rtz) / 2), q, new THREE.Vector3(1, 1, 1)));
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    b.add(new THREE.BoxGeometry(0.22, 9.6 * t, 0.22), COL.woodD, M(rx + (rtx - rx) * t, 4.8 * t, rz + (rtz - rz) * t, facing));
  }
  ctx.solids.add(x, z, 4.8);
  ctx.solids.add(hx, hz, 2.3);
  ctx.solids.add(rx, rz, 0.8);
}

// ───────────────────────── Buildings ─────────────────────────

function smithy(ctx: FieldCtx, x: number, z: number, facing: number, out: TownOut): void {
  const { b } = ctx;
  const L = local(x, z, facing);
  const y = ctx.place(x, z, 3);
  const W = 7;
  const D = 5.2;
  const H = 4;
  // three stone walls + two posts on the front (an open workshop)
  const [bkx, bkz] = L(0, -D / 2);
  b.add(new THREE.BoxGeometry(W, H, 0.5), COL.stone, M(bkx, H / 2, bkz, facing));
  for (const s of [-1, 1]) {
    const [sx, sz] = L((s * W) / 2, 0);
    b.add(new THREE.BoxGeometry(0.5, H, D), COL.stone, M(sx, H / 2, sz, facing));
    const [px, pz] = L((s * W) / 2 - s * 0.1, D / 2);
    b.add(new THREE.BoxGeometry(0.7, H + 0.2, 0.7), COL.stoneD, M(px, (H + 0.2) / 2, pz, facing));
  }
  // mono-pitch sheet-iron roof
  const [rx, rz] = L(0, 0.2);
  b.add(new THREE.BoxGeometry(W + 1.2, 0.25, D + 1.6), COL.ironL, M(rx, H + 0.55, rz, facing, 1, -0.22));
  const [ex, ez] = L(0, D / 2 + 0.95);
  b.add(new THREE.BoxGeometry(W + 1.3, 0.35, 0.3), COL.ironTrim, M(ex, H + 0.18, ez, facing));
  // forge and chimney inside
  const [fx, fz] = L(-1.6, -1.4);
  b.add(new THREE.BoxGeometry(2.2, 1.2, 1.6), COL.stoneD, M(fx, 0.6, fz, facing));
  const hearth = new THREE.BoxGeometry(1.6, 0.12, 1.1);
  hearth.applyMatrix4(M(fx, y + 1.24, fz, facing));
  out.fireGeos.push(hearth);
  const [cx, cz] = L(-1.6, -2.1);
  b.add(new THREE.BoxGeometry(1.2, H + 2.6, 1.2), COL.stoneD, M(cx, (H + 2.6) / 2, cz, facing));
  out.chimneys.push({ p: new THREE.Vector3(cx, y + H + 2.7, cz), big: false });
  // weapon rack on the wall
  const [wx, wz] = L(1.6, -D / 2 + 0.4);
  b.add(new THREE.BoxGeometry(2.4, 0.12, 0.2), COL.woodD, M(wx, 1.9, wz, facing));
  for (let i = 0; i < 4; i++) {
    const [sx, sz] = L(0.7 + i * 0.6, -D / 2 + 0.45);
    sword(ctx, sx, y + 0.6, sz, 0.85, facing, 0, 0);
  }
  // in front of the door: a red-hot anvil, quench trough, whetstone
  anvil(ctx, ...L(0.2, D / 2 + 1.6), facing + Math.PI / 2, true);
  ctx.place(x, z, 3);
  const [qx, qz] = L(2.4, D / 2 + 1.3);
  b.add(new THREE.BoxGeometry(1.6, 0.7, 0.8), COL.woodD, M(qx, 0.35, qz, facing));
  b.add(new THREE.BoxGeometry(1.4, 0.05, 0.6), 0x1a2a34, M(qx, 0.68, qz, facing), false);
  const [gx, gz] = L(-2.4, D / 2 + 1.2);
  b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 12), COL.stoneL, M(gx, 0.8, gz, facing, 1, 0, Math.PI / 2));
  b.add(new THREE.BoxGeometry(0.15, 0.7, 0.15), COL.woodD, M(gx, 0.35, gz, facing));
  ctx.solids.add(x, z, 3.6);
  ctx.solids.add(...L(2.4, D / 2 + 1.3), 0.7);
  ctx.solids.add(...L(-2.4, D / 2 + 1.2), 0.5);
}

function house(ctx: FieldCtx, x: number, z: number, facing: number, variant: number, out: TownOut): void {
  const { b } = ctx;
  const L = local(x, z, facing);
  const y = ctx.place(x, z, 3);
  const W = variant ? 5.2 : 4.6;
  const D = 4.4;
  const H1 = 3.2;
  // stone walls on the ground floor, a dark timber-framed jettied upper floor
  b.add(new THREE.BoxGeometry(W, H1, D), COL.stone, M(x, H1 / 2, z, facing));
  b.add(new THREE.BoxGeometry(W + 0.5, 2.4, D + 0.5), COL.woodD, M(x, H1 + 1.2, z, facing));
  for (const s of [-1, 1]) {
    const [bx, bz] = L((s * (W + 0.5)) / 2, (D + 0.5) / 2 + 0.01);
    b.add(new THREE.BoxGeometry(0.16, 2.4, 0.1), COL.stoneL, M(bx, H1 + 1.2, bz, facing), false);
  }
  // steep red-tile roof (triangular prism)
  const roofH = 2.6;
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  prism.rotateX(Math.PI / 2);
  prism.rotateZ(Math.PI);
  prism.scale(((W + 0.5) * 0.62) / 0.866, roofH / 1.5, D + 1.2);
  b.add(prism, variant ? COL.roofD : COL.roof, M(x, H1 + 2.4 + roofH / 3, z, facing));
  // door, windows, chimney
  const [dx, dz] = L(0, D / 2 + 0.03);
  b.add(new THREE.BoxGeometry(1.0, 1.9, 0.12), COL.woodD, M(dx, 0.95, dz, facing));
  b.add(new THREE.TorusGeometry(0.5, 0.1, 4, 8, Math.PI), COL.stoneD, M(dx, 1.9, dz, facing), false);
  for (const s of [-1, 1]) {
    const [wx, wz] = L(s * W * 0.3, (D + 0.5) / 2 + 0.03);
    b.glow(new THREE.BoxGeometry(0.62, 0.7, 0.08), 0xffb86a, M(wx, H1 + 1.25, wz, facing));
  }
  const [cx, cz] = L(W * 0.28, -D * 0.2);
  b.add(new THREE.BoxGeometry(0.7, 2.2, 0.7), COL.stoneD, M(cx, H1 + 2.4 + 1.6, cz, facing));
  out.chimneys.push({ p: new THREE.Vector3(cx, y + H1 + 2.4 + 2.8, cz), big: false });
  // iron sign hanging by the door
  const [sx, sz] = L(W / 2 + 0.1, D / 2 + 0.5);
  b.add(new THREE.BoxGeometry(0.08, 0.08, 1.0), COL.iron, M(sx, 2.5, sz, facing));
  b.add(new THREE.BoxGeometry(0.06, 0.6, 0.6), COL.bronze, M(sx, 2.1, sz + 0, facing));
  ctx.solids.add(x, z, Math.max(W, D) * 0.62);
}

function barracks(ctx: FieldCtx, x: number, z: number, facing: number, out: TownOut): void {
  const { b } = ctx;
  const L = local(x, z, facing);
  const y = ctx.place(x, z, 4);
  const W = 11;
  const D = 5.4;
  const H = 4.2;
  b.add(new THREE.BoxGeometry(W, H, D), COL.stone, M(x, H / 2, z, facing));
  b.add(new THREE.BoxGeometry(W + 0.3, 0.4, D + 0.3), COL.stoneD, M(x, 0.2, z, facing));
  const roofH = 3;
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  prism.rotateX(Math.PI / 2);
  prism.rotateZ(Math.PI);
  prism.rotateY(Math.PI / 2);
  prism.scale(W + 0.8, roofH / 1.5, ((D + 0.8) * 0.62) / 0.866);
  b.add(prism, COL.roof, M(x, H + roofH / 3, z, facing));
  // front: two doors, windows, the Knights' shield emblem and banner
  for (const s of [-1, 1]) {
    const [dx, dz] = L(s * 2.8, D / 2 + 0.04);
    b.add(new THREE.BoxGeometry(1.1, 2.2, 0.12), COL.woodD, M(dx, 1.1, dz, facing));
    const [fx, fz] = L(s * 4.6, D / 2 + 0.25);
    out.flags.push(banner(1.1, 2.6, M(fx, y + H - 0.1, fz, facing), COL.cloth, COL.gold));
  }
  for (const lx of [-1.4, 0, 1.4]) {
    const [wx, wz] = L(lx, D / 2 + 0.04);
    if (lx === 0) {
      b.add(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 14), COL.cloth, M(wx, 2.6, wz, facing, 1, Math.PI / 2));
      b.add(new THREE.TorusGeometry(0.75, 0.08, 4, 14), COL.bronze, M(wx, 2.6, wz + 0, facing), false);
      sword(ctx, wx, y + 1.9, wz + 0, 0.7, facing, 0, 0, COL.stoneL, COL.bronze);
    } else b.glow(new THREE.BoxGeometry(0.6, 0.8, 0.08), 0xffb86a, M(wx, 2.4, wz, facing));
  }
  // weapon rack by the door (spears)
  const [rx, rz] = L(W / 2 + 0.9, 1.2);
  b.add(new THREE.BoxGeometry(0.12, 1.4, 1.6), COL.woodD, M(rx, 0.7, rz, facing));
  for (let i = 0; i < 4; i++) {
    const [px, pz] = L(W / 2 + 0.9, 0.6 + i * 0.4);
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 4), COL.woodD, M(px, 1.3, pz, facing, 1, 0, 0.12));
    b.add(new THREE.ConeGeometry(0.06, 0.3, 4), COL.ironTrim, M(px - 0.15, 2.65, pz, facing));
  }
  const [cx, cz] = L(-W * 0.3, -D * 0.2);
  b.add(new THREE.BoxGeometry(0.8, 2.6, 0.8), COL.stoneD, M(cx, H + 2.2, cz, facing));
  out.chimneys.push({ p: new THREE.Vector3(cx, y + H + 3.6, cz), big: false });
  ctx.solids.add(...L(-2.8, 0), 3.2);
  ctx.solids.add(...L(2.8, 0), 3.2);
  ctx.solids.add(rx, rz, 0.8);
}

function trainingYard(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  const facing = Math.atan2(TOWN[0] - x, TOWN[1] - z);
  const L = local(x, z, facing);
  ctx.place(x, z, 4);
  // low wooden fence (open on the side facing the town center)
  const W = 9;
  const D = 6.5;
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    const [p0x, p0z] = L(ax, az);
    const [p1x, p1z] = L(bx, bz);
    const len = Math.hypot(p1x - p0x, p1z - p0z);
    const ang = Math.atan2(p1x - p0x, p1z - p0z);
    b.add(new THREE.BoxGeometry(0.1, 0.12, len), COL.wood, M((p0x + p1x) / 2, 0.85, (p0z + p1z) / 2, ang));
    b.add(new THREE.BoxGeometry(0.1, 0.12, len), COL.wood, M((p0x + p1x) / 2, 0.45, (p0z + p1z) / 2, ang));
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) b.add(new THREE.BoxGeometry(0.16, 1.05, 0.16), COL.woodD, M(p0x + ((p1x - p0x) * i) / n, 0.52, p0z + ((p1z - p0z) * i) / n));
  };
  rail(-W / 2, -D / 2, W / 2, -D / 2);
  rail(-W / 2, -D / 2, -W / 2, D / 2);
  rail(W / 2, -D / 2, W / 2, D / 2);
  rail(-W / 2, D / 2, -1.5, D / 2);
  rail(1.5, D / 2, W / 2, D / 2);
  // three straw dummy targets
  for (const [lx, lz] of [
    [-2.6, -1.2],
    [0.4, -1.8],
    [3, -0.8],
  ] as const) {
    const [px, pz] = L(lx, lz);
    const ry = facing + (r() - 0.5) * 0.6;
    b.add(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 5), COL.woodD, M(px, 0.95, pz));
    b.add(new THREE.CylinderGeometry(0.36, 0.3, 0.9, 8), 0xc8a060, M(px, 1.35, pz, ry));
    b.add(new THREE.SphereGeometry(0.26, 8, 6), 0xc8a060, M(px, 2.05, pz, ry));
    b.add(new THREE.BoxGeometry(1.4, 0.08, 0.08), COL.woodD, M(px, 1.6, pz, ry));
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), COL.cloth, M(px + Math.sin(ry) * 0.33, 1.4, pz + Math.cos(ry) * 0.33, ry, 1, Math.PI / 2));
    ctx.solids.add(px, pz, 0.5);
  }
  // arms rack
  const [wx, wz] = L(-W / 2 + 0.8, 1.6);
  b.add(new THREE.BoxGeometry(0.14, 1.2, 1.8), COL.woodD, M(wx, 0.6, wz, facing));
  for (let i = 0; i < 3; i++) {
    const [sx, sz] = L(-W / 2 + 0.8, 1.0 + i * 0.6);
    sword(ctx, sx, ctx.h(sx, sz) + 0.35, sz, 0.8, facing + Math.PI / 2, 0.1, 0);
  }
  ctx.solids.add(wx, wz, 0.9);
}

function monument(ctx: FieldCtx, x: number, z: number, out: TownOut): void {
  const { b } = ctx;
  const y = ctx.place(x, z, 2);
  const facing = Math.atan2(TOWER[0] - x, TOWER[1] - z);
  const L = local(x, z, facing);
  // stepped stone pedestal
  b.add(new THREE.CylinderGeometry(2.6, 2.8, 0.5, 8), COL.stone, M(x, 0.25, z, Math.PI / 8));
  b.add(new THREE.BoxGeometry(2.2, 2.0, 2.2), COL.stoneD, M(x, 1.5, z, facing));
  b.add(new THREE.BoxGeometry(2.5, 0.3, 2.5), COL.stone, M(x, 2.6, z, facing));
  const [gx, gz] = L(0, 1.12);
  b.glow(new THREE.BoxGeometry(1.4, 0.12, 0.05), COL.rune, M(gx, 1.7, gz, facing));
  // knight statue (bronze): sword raised toward the Seal Tower
  const Y = 2.75;
  for (const s of [-1, 1]) {
    const [lx, lz] = L(s * 0.28, 0);
    b.add(new THREE.CylinderGeometry(0.2, 0.24, 1.4, 7), COL.bronze, M(lx, Y + 0.7, lz, facing));
  }
  b.add(new THREE.BoxGeometry(0.95, 1.2, 0.6), COL.bronze, M(x, Y + 2.0, z, facing));
  b.add(new THREE.CylinderGeometry(0.62, 0.5, 0.35, 8), COL.bronze, M(x, Y + 2.65, z, facing));
  b.add(new THREE.SphereGeometry(0.34, 10, 8), COL.bronze, M(x, Y + 3.05, z, facing));
  b.add(new THREE.BoxGeometry(0.1, 0.35, 0.6), COL.cloth, M(x, Y + 3.45, z, facing));
  // cloak
  const [cx, cz] = L(0, -0.4);
  b.add(new THREE.BoxGeometry(1.1, 2.0, 0.12), COL.cloth, M(cx, Y + 1.7, cz, facing, 1, 0.14));
  // raised right arm and sword
  const [ax, az] = L(0.55, 0.05);
  b.add(new THREE.CylinderGeometry(0.14, 0.16, 1.1, 6), COL.bronze, M(ax, Y + 3.1, az, facing, 1, 0, -0.35));
  sword(ctx, ax + 0, y + Y + 3.2, az, 1.5, facing, 0, -0.18, COL.stoneL, COL.bronze, COL.rune);
  // shield in the left hand
  const [shx, shz] = L(-0.62, 0.25);
  b.add(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10), COL.bronze, M(shx, Y + 1.9, shz, facing, 1, 0, Math.PI / 2 + 0.2));
  ctx.solids.add(x, z, 2.6);
  for (const s of [-1, 1]) out.flames.push(brazier(ctx, ...L(s * 3.4, 0.6), 1.1));
}

function stall(ctx: FieldCtx, x: number, z: number, facing: number, cloth: number): void {
  const { b, r } = ctx;
  const L = local(x, z, facing);
  ctx.place(x, z, 2);
  for (const [lx, lz] of [
    [-1.5, -1],
    [1.5, -1],
    [-1.5, 1],
    [1.5, 1],
  ]) {
    const [px, pz] = L(lx, lz);
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 5), COL.woodD, M(px, 1.25, pz));
  }
  b.add(new THREE.BoxGeometry(3.6, 0.1, 2.6), cloth, M(x, 2.55, z, facing, 1, 0.18));
  for (let i = 0; i < 4; i++) {
    const [px, pz] = L(-1.35 + i * 0.9, 1.3);
    b.add(new THREE.BoxGeometry(0.9, 0.35, 0.05), i % 2 ? COL.gold : cloth, M(px, 2.3, pz, facing), false);
  }
  const [cx, cz] = L(0, 0.5);
  b.add(new THREE.BoxGeometry(3.0, 0.9, 1.0), COL.wood, M(cx, 0.45, cz, facing));
  // goods on the stall: helmets, glowing iron ingots
  for (let i = 0; i < 3; i++) {
    const [gx, gz] = L(-1 + i, 0.5);
    if (i === 1) b.glow(new THREE.BoxGeometry(0.5, 0.14, 0.24), COL.fire, M(gx, 0.98, gz, facing + r()));
    else b.add(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), COL.ironTrim, M(gx, 0.9, gz, facing));
  }
  ctx.solids.add(x, z, 1.9);
}

function coalHeap(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, s);
  b.add(new THREE.ConeGeometry(1.2 * s, 0.9 * s, 8), 0x1a1618, M(x, 0.4 * s, z, r() * 6));
  for (let i = 0; i < 4; i++) b.add(new THREE.DodecahedronGeometry(0.15 * s, 0), 0x1a1618, M(x + (r() - 0.5) * 2 * s, 0.1, z + (r() - 0.5) * 2 * s, r() * 6), false);
  ctx.solids.add(x, z, 1.1 * s);
}

function cart(ctx: FieldCtx, x: number, z: number, facing: number): void {
  const { b } = ctx;
  const L = local(x, z, facing);
  ctx.place(x, z, 1.2);
  b.add(new THREE.BoxGeometry(1.4, 0.7, 2.2), COL.wood, M(x, 0.95, z, facing));
  for (const s of [-1, 1]) {
    const [wx, wz] = L(s * 0.8, -0.3);
    b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), COL.woodD, M(wx, 0.5, wz, facing, 1, 0, Math.PI / 2));
  }
  const [hx, hz] = L(0, 1.7);
  b.add(new THREE.BoxGeometry(0.1, 0.1, 1.4), COL.woodD, M(hx - 0.3, 0.7, hz, facing, 1, 0.3));
  for (let i = 0; i < 4; i++) b.add(new THREE.DodecahedronGeometry(0.25, 0), COL.rock, M(x + (i % 2) * 0.4 - 0.2, 1.4, z + (i > 1 ? 0.4 : -0.3), i));
  ctx.solids.add(x, z, 1.3);
}

void MS;
void box;
