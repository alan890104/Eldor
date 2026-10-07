// Lampglow Village: the village of the Umbral Society lamplighters. From the Thousand-Lamp Pillar at the center,
// lamp strings run out to the stone houses all around;
// to the east is the Society Hall (its front bears the Eye of Dusk emblem), the north gate is a stone archway hung with a
// big lantern, and east of the village outside is a mushroom field growing glowing mushrooms.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { GlowSet, V } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import { PATH, PILLAR, TOWN, TOWN_R, rng, sm } from './common.ts';
import { COL, festoon, frame, ground, hall, hangLantern, lanternPillar, moonbells, shroom, stoneHouse, stoneLantern } from './props.ts';
import type { GroundLight } from './fx.ts';

export interface TownOut {
  /** Warm light patches on the ground */
  pools: GroundLight[];
  /** Glow points the lake reflection does not use, but global effects such as the glow at the tower top may use */
  glows: THREE.Vector3[];
}

export function buildTown(ctx: FieldCtx, lamps: GlowSet[], big: GlowSet, eye: GlowSet, pools: GroundLight[]): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWN;
  const L = (i: number) => lamps[((Math.round(i) % lamps.length) + lamps.length) % lamps.length];

  // ── Thousand-Lamp Pillar and the hall
  const top = lanternPillar(ctx, L(0), big, PILLAR[0], PILLAR[1]);
  pools.push({ x: PILLAR[0], z: PILLAR[1], r: 11, col: 0xff9a40, amt: 0.55 });
  hall(ctx, L(1), eye, 60, 75, -Math.PI / 2);
  pools.push({ x: 53, z: 75, r: 7, col: 0xff9a40, amt: 0.45 });

  // ── Stone houses: doors facing the plaza
  const homes: [number, number, number, number, number, number][] = [
    [27, 66, 4.6, 4.2, 3.2, 0],
    [25.5, 78, 5.2, 4.4, 3.4, 0],
    [31, 89, 4.4, 4.0, 3.0, 0],
    [53, 61, 4.8, 4.2, 3.2, 0],
    [54, 88, 5.0, 4.4, 3.3, 0],
    [20, 88, 3.8, 3.6, 2.8, 0.4],
  ];
  const apex: THREE.Vector3[] = [];
  homes.forEach(([x, z, w, d, h, off], i) => {
    const face = Math.atan2(tx - x, tz - z) + off;
    apex.push(stoneHouse(ctx, L(i), x, z, face, w, d, h, { shrooms: i % 2 === 0, wall: i % 3 === 1 ? 0x5a5474 : COL.stone }));
    const [px, pz] = frame(x, 0, z, face).at(0.95, d / 2 + 0.9);
    pools.push({ x: px, z: pz, r: 4, col: 0xff9a40, amt: 0.45 });
  });

  // ── Lamp strings: the Thousand-Lamp Pillar pulls them to every roof, and a few tall poles fill in the empty directions
  const poles: [number, number][] = [[36, 62], [44, 88], [50, 66], [37, 84], [55, 81]];
  const anchors = [...apex];
  for (const [x, z] of poles) {
    const y = ground(ctx, x, z, 0.3);
    b.add(new THREE.CylinderGeometry(0.1, 0.14, 6, 6), COL.post, M(x, y + 3, z));
    b.add(new THREE.BoxGeometry(0.9, 0.08, 0.08), COL.post, M(x, y + 5.6, z, Math.atan2(PILLAR[0] - x, PILLAR[1] - z) + Math.PI / 2));
    hangLantern(ctx, L(x), V(x, y + 5.55, z), 0.9);
    ctx.solids.add(x, z, 0.3);
    anchors.push(V(x, y + 5.9, z));
  }
  for (const a of anchors) {
    const d = a.distanceTo(top);
    festoon(ctx, L(Math.round(a.x)), top, a, 0.6 + d * 0.06, Math.max(4, Math.round(d / 1.7)));
  }
  // Strings also link one house to the next
  const ring = [apex[0], apex[1], apex[2]];
  for (let i = 0; i + 1 < ring.length; i++) festoon(ctx, L(i + 2), ring[i], ring[i + 1], 1.0, 6);
  festoon(ctx, L(3), apex[3], anchors[apex.length], 0.8, 5);

  // ── North gate: a stone archway with a big lantern hung at the center of the crossbeam
  gateArch(ctx, L(0), big, pools);

  // ── The village's low stone wall (leaving gaps for the road and the way to the mushroom field)
  const wallCol = [COL.stoneDark, 0x4a4466];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const R = TOWN_R + 3.5 + Math.sin(a * 3) * 0.8;
    const x = tx + Math.cos(a) * R;
    const z = tz + Math.sin(a) * R;
    if (ctx.pathDist(x, z) < 5) continue;
    if (Math.abs(a - 0.1) < 0.35) continue; // East gate: toward the mushroom field
    if (Math.hypot(x - 60, z - 75) < 9) continue;
    const y = ground(ctx, x, z, 0.8);
    const hh = 0.9 + r() * 0.5;
    b.add(new THREE.BoxGeometry(1.9, hh, 0.7), wallCol[i % 2], M(x, y + hh / 2 - 0.1, z, -a + Math.PI / 2, 1, 0, (r() - 0.5) * 0.06));
    if (r() < 0.35) b.add(new THREE.BoxGeometry(0.8, 0.35, 0.6), COL.stoneLight, M(x, y + hh + 0.05, z, -a + Math.PI / 2 + 0.3));
    ctx.solids.add(x, z, 0.8);
    if (i % 8 === 4) {
      stoneLantern(ctx, L(i), tx + Math.cos(a) * (R - 1.4), tz + Math.sin(a) * (R - 1.4), -a - Math.PI / 2, 0.8);
      pools.push({ x: tx + Math.cos(a) * (R - 1.4), z: tz + Math.sin(a) * (R - 1.4), r: 3.2, col: 0xff9a40, amt: 0.4 });
    }
  }

  // ── Stone lanterns along the road in the village
  for (const [x, z, f] of [[33.6, 79, 0], [40.5, 67, 0], [39, 83, 0], [34.6, 66, 0]] as const) {
    stoneLantern(ctx, L(x), x, z, f, 0.9);
    pools.push({ x, z, r: 3.4, col: 0xff9a40, amt: 0.45 });
  }

  // ── Signs of life: crates and oil barrels, a lantern-drying rack, a bench, a mask stall
  crateStack(ctx, 22, 71);
  crateStack(ctx, 49, 57.5);
  crateStack(ctx, 58, 84);
  lanternRack(ctx, L(4), 30, 73, 0.2);
  lanternRack(ctx, L(5), 50, 91, -2.4);
  bench(ctx, 42.5, 66.5, 0.2);
  bench(ctx, 50.5, 70, -1.7);
  maskStall(ctx, L(2), 34, 85, 2.2, pools);
  // Moonbell flowers in the planter
  for (const [x, z] of [[40, 79], [49, 79], [44, 67], [30, 70]] as const) {
    const y = ground(ctx, x, z, 0.8);
    b.add(new THREE.CylinderGeometry(0.8, 0.9, 0.45, 8), COL.stoneDark, M(x, y + 0.2, z));
    b.add(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 8), 0x2a2238, M(x, y + 0.44, z), false);
    moonbells(ctx, x, z, 7, 0.45);
    ctx.solids.add(x, z, 0.9);
  }

  // ── Mushroom field: east of the village's east gate, rows of glowing mushrooms planted in beds
  for (let row = 0; row < 3; row++) {
    const x0 = 68 + row * 5.2;
    const z0 = 70 + (row % 2) * 2;
    const y = ground(ctx, x0, z0, 4);
    b.add(new THREE.BoxGeometry(3.4, 0.5, 11), COL.stoneDark, M(x0, y + 0.1, z0, 0.12));
    b.add(new THREE.BoxGeometry(3.0, 0.2, 10.6), 0x241c30, M(x0, y + 0.32, z0, 0.12), false);
    for (let k = 0; k < 14; k++) {
      const lz = -4.6 + (k % 7) * 1.5;
      const lx = k < 7 ? -0.7 : 0.7;
      const mx = x0 + Math.cos(0.12) * lx + Math.sin(0.12) * lz;
      const mz = z0 - Math.sin(0.12) * lx + Math.cos(0.12) * lz;
      ctx.b.lift = y + 0.4;
      shroom(b, mx, mz, 0.45 + r() * 0.35, r, r() < 0.2);
    }
    ctx.b.lift = 0;
    ctx.solids.add(x0, z0 - 3, 1.8);
    ctx.solids.add(x0, z0 + 3, 1.8);
    pools.push({ x: x0, z: z0, r: 6, col: 0x6a8aff, amt: 0.28 });
  }
  const fy = ground(ctx, 66, 63, 0.4);
  b.add(new THREE.BoxGeometry(0.14, 1.6, 0.14), COL.post, M(66, fy + 0.8, 63));
  b.add(new THREE.BoxGeometry(1.3, 0.5, 0.08), COL.wood, M(66, fy + 1.4, 63, -0.4));

  // ── Accents on the open ground around the village
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2;
    const d = TOWN_R + 5 + r() * 9;
    const x = tx + Math.cos(a) * d;
    const z = tz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) > 4 && !ctx.solids.blocked(x, z, 1.2) && Math.abs(x) < 100 && Math.abs(z) < 96) moonbells(ctx, x, z, 6);
  }
  void sm;
  ctx.b.lift = 0;

  // After the Seal Tower is fully broken through: the villagers release sky lanterns one after another from the plaza,
  // which slowly drift toward the cave ceiling
  if (ctx.floors > 0 && ctx.done >= ctx.floors) skyLanterns(ctx);
}

/**
 * Sky lanterns celebrating the purification: one InstancedMesh, positions updated every frame;
 * they fade out near the ceiling, then are released again from the plaza
 */
function skyLanterns(ctx: FieldCtx): void {
  const n = ctx.low ? 14 : 26;
  const body = new THREE.CylinderGeometry(0.55, 0.42, 1.1, 6, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a3a).multiplyScalar(2.4), toneMapped: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.InstancedMesh(body, mat, n);
  mesh.frustumCulled = false;
  const r = rng(4242);
  const base = ctx.h(PILLAR[0], PILLAR[1]);
  const L = Array.from({ length: n }, () => ({ x: TOWN[0] + (r() - 0.5) * 22, z: TOWN[1] + (r() - 0.5) * 18, t: r(), sp: 0.018 + r() * 0.012, ph: r() * 6.28, s: 0.8 + r() * 0.5 }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const top = 58;
  const place = (time: number) => {
    L.forEach((l, i) => {
      const t = (l.t + time * l.sp) % 1;
      const y = base + 2 + t * top;
      // The higher they go, the more they drift toward the tower
      p.set(l.x + Math.sin(time * 0.3 + l.ph) * 1.2 - t * 26, y, l.z + Math.cos(time * 0.23 + l.ph) * 1.2 - t * 48);
      const k = l.s * Math.min(1, t * 12) * Math.min(1, (1 - t) * 6);
      sc.set(k, k, k);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.ph + time * 0.2);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  ctx.group.add(mesh);
  ctx.extras.push((_dt, t) => place(t));
  ctx.disposers.push(() => {
    body.dispose();
    mat.dispose();
    mesh.dispose();
  });
}

/**
 * The stone archway at the north gate: two stone pillars, a double crossbeam, a big lantern hung at the center,
 * and a stone lantern at the foot of each pillar
 */
function gateArch(ctx: FieldCtx, glow: GlowSet, big: GlowSet, pools: GroundLight[]): void {
  const { b } = ctx;
  // Find the position and direction of the village's northern edge on the road
  const gz = 57.5;
  let best = PATH[0];
  let dir: [number, number] = [0, -1];
  for (let i = 0; i + 1 < PATH.length; i++) {
    const [x0, z0] = PATH[i];
    const [x1, z1] = PATH[i + 1];
    if ((z0 - gz) * (z1 - gz) <= 0) {
      const t = (gz - z0) / (z1 - z0);
      best = [x0 + (x1 - x0) * t, gz];
      const l = Math.hypot(x1 - x0, z1 - z0);
      dir = [(x1 - x0) / l, (z1 - z0) / l];
    }
  }
  const face = Math.atan2(dir[0], dir[1]);
  const y = ground(ctx, best[0], best[1], 4);
  const f = frame(best[0], y, best[1], face);
  for (const sx of [-1, 1]) {
    b.add(new THREE.BoxGeometry(1.2, 0.5, 1.2), COL.stoneDark, f.m(sx * 4.3, 0.1, 0));
    b.add(new THREE.CylinderGeometry(0.38, 0.46, 6.4, 8), COL.stone, f.m(sx * 4.3, 3.4, 0));
    b.add(new THREE.BoxGeometry(0.9, 0.3, 0.9), COL.silver, f.m(sx * 4.3, 6.6, 0));
    const [px, pz] = f.at(sx * 4.3, 0);
    ctx.solids.add(px, pz, 0.6);
    const [lx, lz] = f.at(sx * 5.8, -1.2);
    stoneLantern(ctx, glow, lx, lz, face, 1);
    pools.push({ x: lx, z: lz, r: 3.5, col: 0xff9a40, amt: 0.5 });
  }
  b.add(new THREE.BoxGeometry(11.4, 0.55, 0.9), COL.slate, f.m(0, 7.1, 0));
  b.add(new THREE.BoxGeometry(10.2, 0.35, 0.6), COL.stone, f.m(0, 6.1, 0));
  const tip = new THREE.ConeGeometry(0.3, 0.6, 4);
  for (const sx of [-1, 1]) b.add(tip, COL.slate, f.m(sx * 5.8, 7.25, 0, 0, 1, -sx * 1.2));
  // Name plaque
  b.add(new THREE.BoxGeometry(2.2, 0.8, 0.12), COL.wood, f.m(0, 6.6, 0.35));
  glowPlaque(ctx, f.m(0, 6.6, 0.43));
  // Big lantern
  b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 3), COL.cap, f.m(0, 5.7, 0), false);
  b.add(new THREE.CylinderGeometry(0.3, 0.42, 0.14, 10), COL.cap, f.m(0, 5.4, 0));
  const body = new THREE.SphereGeometry(0.6, 12, 9);
  body.scale(1, 1.25, 1);
  big.add(body, f.m(0, 4.62, 0));
  b.add(new THREE.CylinderGeometry(0.4, 0.28, 0.12, 10), COL.cap, f.m(0, 3.82, 0));
  b.add(new THREE.ConeGeometry(0.1, 0.5, 4), COL.tassel, f.m(0, 3.5, 0, 0, 1, Math.PI), false);
  pools.push({ x: best[0], z: best[1], r: 7, col: 0xff9a40, amt: 0.6 });
}

function glowPlaque(ctx: FieldCtx, m: THREE.Matrix4): void {
  // Three glowing glyph strokes on the plaque
  for (let i = -1; i <= 1; i++) {
    const g = new THREE.BoxGeometry(0.34, 0.08, 0.04);
    g.translate(i * 0.6, 0, 0);
    ctx.b.glow(g, 0xffd08a, m);
  }
}

function crateStack(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z, 1);
  b.add(new THREE.BoxGeometry(0.9, 0.9, 0.9), COL.wood, M(x, y + 0.45, z, r()));
  b.add(new THREE.BoxGeometry(0.7, 0.7, 0.7), 0x5a4050, M(x + 0.2, y + 1.25, z + 0.1, r()));
  for (let i = 0; i < 2; i++) {
    b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.9, 10), 0x3a2a36, M(x + 1.0 + i * 0.8, y + 0.45, z - 0.4));
    b.add(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 10), COL.silver, M(x + 1.0 + i * 0.8, y + 0.7, z - 0.4));
  }
  ctx.solids.add(x + 0.5, z, 1.2);
}

/** Lantern-drying rack: a row of freshly pasted lanterns hung on a crossbar (two of them lit) */
function lanternRack(ctx: FieldCtx, glow: GlowSet, x: number, z: number, face: number): void {
  const { b } = ctx;
  const y = ground(ctx, x, z, 1.5);
  const f = frame(x, y, z, face);
  for (const sx of [-1.6, 1.6]) b.add(new THREE.BoxGeometry(0.12, 2.3, 0.12), COL.post, f.m(sx, 1.15, 0));
  b.add(new THREE.BoxGeometry(3.6, 0.08, 0.08), COL.post, f.m(0, 2.25, 0));
  for (let i = 0; i < 5; i++) {
    const lx = -1.2 + i * 0.6;
    if (i === 1 || i === 3) hangLantern(ctx, glow, f.v(lx, 2.2, 0), 0.75);
    else {
      const g = new THREE.SphereGeometry(0.15, 8, 6);
      g.scale(1, 1.3, 1);
      b.add(g, 0xe8d8c0, f.m(lx, 1.8, 0));
      b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 3), COL.cap, f.m(lx, 2.1, 0), false);
    }
  }
  const [ax, az] = f.at(-1.6, 0);
  const [bx, bz] = f.at(1.6, 0);
  ctx.solids.add(ax, az, 0.3);
  ctx.solids.add(bx, bz, 0.3);
}

function bench(ctx: FieldCtx, x: number, z: number, face: number): void {
  const { b } = ctx;
  const y = ground(ctx, x, z, 1);
  const f = frame(x, y, z, face);
  b.add(new THREE.BoxGeometry(2.0, 0.14, 0.55), COL.stoneLight, f.m(0, 0.5, 0));
  for (const sx of [-0.75, 0.75]) b.add(new THREE.BoxGeometry(0.3, 0.45, 0.45), COL.stoneDark, f.m(sx, 0.22, 0));
  ctx.solids.add(x, z, 0.9);
}

/** Mask stall: a wooden counter and a cloth awning, with white masks hung on the rack */
function maskStall(ctx: FieldCtx, glow: GlowSet, x: number, z: number, face: number, pools: GroundLight[]): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z, 1.6);
  const f = frame(x, y, z, face);
  b.add(new THREE.BoxGeometry(2.8, 0.9, 1.0), COL.wood, f.m(0, 0.45, 0));
  for (const sx of [-1.35, 1.35]) for (const sz of [-0.45, 0.9]) b.add(new THREE.BoxGeometry(0.1, 2.5, 0.1), COL.post, f.m(sx, 1.25, sz));
  const awning = new THREE.BoxGeometry(3.2, 0.08, 1.8);
  awning.rotateX(-0.25);
  b.add(awning, COL.cloth, f.m(0, 2.5, 0.25), false);
  b.add(new THREE.BoxGeometry(2.7, 0.06, 0.06), COL.post, f.m(0, 2.05, -0.45));
  for (let i = 0; i < 5; i++) {
    const g = new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.rotateX(Math.PI / 2);
    g.scale(1, 1.25, 0.6);
    b.add(g, i % 2 ? 0xf0e8f8 : 0xe0d0e8, f.m(-1.1 + i * 0.55, 1.65, -0.42));
    b.add(new THREE.BoxGeometry(0.05, 0.03, 0.02), 0x1a1424, f.m(-1.17 + i * 0.55, 1.72, -0.3), false);
    b.add(new THREE.BoxGeometry(0.05, 0.03, 0.02), 0x1a1424, f.m(-1.03 + i * 0.55, 1.72, -0.3), false);
    if (r() < 0.5) b.add(new THREE.BoxGeometry(0.22, 0.03, 0.02), i % 2 ? 0x9a2a4a : 0x4a3aa8, f.m(-1.1 + i * 0.55, 1.55, -0.3), false);
  }
  hangLantern(ctx, glow, f.v(1.35, 2.35, 0.9), 0.8);
  const [px, pz] = f.at(0, 1.4);
  pools.push({ x: px, z: pz, r: 3.5, col: 0xff9a40, amt: 0.4 });
  ctx.solids.add(x, z, 1.5);
}
