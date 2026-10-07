// Duskshade Hollow's field: the lamps along the road, the Tomb Gate and Stele Gorge, the lamp strings in front of the tower,
// Everdark Lake (pier, jellyfish, Moonspring Falls, Sunken Moon Isle, old stone causeway),
// the Sunken Tomb, Unlit Wood, Silkthread Vale, the Moonlit Glade, Glowgrass Meadow, the floor-to-ceiling
// stalactite-stalagmite pillars and the ceiling's stalactites, and the whole umbrella-mushroom forest and the cave wall.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { GlowSet, V, catenary, fern, rope, runeStone, spiderWeb, stalactites, watchingEyes, type EyePair } from '../../../arenas/_woods.ts';
import { VBatch } from '../../vbatch.ts';
import type { FieldCtx } from '../../kit.ts';
import {
  CAUSEWAY,
  COLUMNS,
  CRACKS,
  CRYPT,
  CRYPT_FLOOR,
  CRYPT_ROT,
  FALLS,
  GATE_U,
  GLADE,
  GORGE_FACE,
  GROVE,
  ISLE,
  LAKE,
  LAMPS,
  LIT,
  MEADOW,
  PIER,
  S,
  SILK,
  TOWER,
  TOWN,
  blocksTownView,
  isolated,
  blocksTowerView,
  ceilH,
  cryptDist,
  cryptWorld,
  gorgeAt,
  gorgeUV,
  lakeEdge,
  sm,
  type Lamp,
} from './common.ts';
import { animateFloaters, groundMist, halo, jellyfish, lakeReflections, moonFalls, moonShafts, shadowsOf, soulLamp, type Floater, type GroundLight, type Reflect, type Shaft } from './fx.ts';
import { COL, cocoon, column, crystals, deadLantern, deadTree, frame, ground, hangLantern, hound, lanternPost, moonbells, mossStone, sarcophagus, shroom, shroomRing, shrub, stalagmite, stoneLantern, tombstone, umbrella } from './props.ts';

export interface Glows {
  lamps: GlowSet[];
  big: GlowSet;
  eye: GlowSet;
  cold: GlowSet;
}

const MOON_DIR = V(0.1, 1, 0.06).normalize();
/** The Seal Tower fully broken through: the lamplighters relight the extinguished lamps, and the corruption in Unlit Wood recedes */
const purified = (ctx: FieldCtx) => ctx.floors > 0 && ctx.done >= ctx.floors;
const WARM = 0xff9a40;

export function buildWild(ctx: FieldCtx, G: Glows, pools: GroundLight[], ceil: THREE.Group): void {
  const k = ctx.low ? 0.5 : 1;
  const trees: [number, number, number, number][] = [];

  isolated(ctx, () => pathLamps(ctx, G, pools));
  gorge(ctx, G, pools);
  towerYard(ctx, G, pools);
  const reflect = lake(ctx, G, pools, trees, ceil);
  crypt(ctx, G, pools);
  isolated(ctx, () => grove(ctx, G, pools, trees));
  silkHollow(ctx, pools, trees);
  glade(ctx, pools, trees);
  meadow(ctx, pools);
  columns(ctx, pools, ceil);
  forest(ctx, trees, k);
  caveWalls(ctx, k);
  silkStrands(ctx, trees, k);
  isolated(ctx, () => eyes(ctx));
  moonlight(ctx, pools, ceil);
  mists(ctx);
  emitters(ctx);
  void reflect;
  ctx.b.lift = 0;
}

// ───────────────────────── Lamps along the road ─────────────────────────

function pathLamps(ctx: FieldCtx, G: Glows, pools: GroundLight[]): void {
  LAMPS.forEach((L, i) => {
    if (L.kind === 'lamp') {
      lanternPost(ctx, G.lamps[i % 3], L, (((i * 7919) % 11) - 5) * 0.012);
      pools.push({ x: L.x + Math.sin(L.face) * 0.9, z: L.z + Math.cos(L.face) * 0.9, r: 4.2, col: WARM, amt: 0.42 });
    } else if (L.kind === 'dead' && !purified(ctx)) {
      deadLantern(ctx, L, ctx.r);
      pools.push({ x: L.x, z: L.z, r: 1.6, col: COL.corrupt, amt: 0.35 });
    } else if (L.kind === 'dead') {
      // After purification: the lamplighters rehang lamps along the old lamp poles
      lanternPost(ctx, G.lamps[i % 3], L, (((i * 7919) % 11) - 5) * 0.02);
      pools.push({ x: L.x + Math.sin(L.face) * 0.9, z: L.z + Math.cos(L.face) * 0.9, r: 4.2, col: WARM, amt: 0.42 });
    } else {
      const [u, v] = gorgeUV(L.x, L.z);
      const face = u < 44 && Math.abs(v) < 12 ? GORGE_FACE + (v > 0 ? -Math.PI / 2 : Math.PI / 2) : L.face;
      stoneLantern(ctx, G.lamps[i % 3], L.x, L.z, face, 1.1);
      pools.push({ x: L.x, z: L.z, r: 3.8, col: WARM, amt: 0.5 });
    }
  });
}

// ───────────────────────── Tomb Gate and Stele Gorge ─────────────────────────

function gorge(ctx: FieldCtx, G: Glows, pools: GroundLight[]): void {
  const { b, r } = ctx;
  const [gx, gz] = gorgeAt(GATE_U, 0);
  const y = ground(ctx, gx, gz, 3);
  const f = frame(gx, y, gz, GORGE_FACE);
  const ST = COL.stone;
  const SD = COL.stoneDark;
  // Twin pillars
  for (const sx of [-1, 1]) {
    b.add(new THREE.BoxGeometry(2.8, 1.1, 2.8), SD, f.m(sx * 3.9, 0.3, 0));
    b.add(new THREE.BoxGeometry(1.9, 11, 1.9), ST, f.m(sx * 3.9, 6.2, 0));
    b.add(new THREE.BoxGeometry(2.5, 0.6, 2.5), SD, f.m(sx * 3.9, 11.9, 0));
    for (let i = 0; i < 4; i++) b.glow(new THREE.BoxGeometry(0.5, 0.08, 0.06), COL.cyan, f.m(sx * 3.9, 3.5 + i * 1.6, 0.99));
    G.cold.add(new THREE.BoxGeometry(0.1, 7.4, 0.08), f.m(sx * 3.9 + sx * 0.7, 6.4, 0.97));
    const [px, pz] = f.at(sx * 3.9, 0);
    ctx.solids.add(px, pz, 1.35);
    // The fallen door leaf, leaning against the wall
    b.add(new THREE.BoxGeometry(3.1, 7.2, 0.35), 0x2a2240, f.m(sx * 5.6, 3.6, 1.6, sx * 1.25));
  }
  // Crossbeam, gable and emblem
  b.add(new THREE.BoxGeometry(11.2, 1.8, 2.4), ST, f.m(0, 13.1, 0));
  b.add(new THREE.BoxGeometry(12.2, 0.45, 2.8), SD, f.m(0, 14.2, 0));
  const gable = new THREE.ConeGeometry(1, 1, 4);
  gable.rotateY(Math.PI / 4);
  gable.scale(6.2 / Math.SQRT2 * 2, 3.0, 1.6 / Math.SQRT2 * 2);
  b.add(gable, SD, f.m(0, 15.9, 0));
  G.eye.add(new THREE.TorusGeometry(1.0, 0.1, 6, 28), f.m(0, 13.1, 1.25));
  const pupil = new THREE.SphereGeometry(0.34, 10, 8);
  pupil.scale(1, 1.5, 0.4);
  G.eye.add(pupil, f.m(0, 13.1, 1.25));
  // Spirit-fire braziers on top of the pillars
  for (const sx of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.75, 0.45, 0.6, 8), SD, f.m(sx * 5.4, 14.7, 0));
    const fl = new THREE.OctahedronGeometry(0.55);
    fl.scale(1, 1.8, 1);
    G.cold.add(fl, f.m(sx * 5.4, 15.5, 0));
  }
  // Walls on both sides, set into the gorge walls
  for (const sx of [-1, 1]) {
    b.add(new THREE.BoxGeometry(6.4, 8.2, 1.8), SD, f.m(sx * 8.0, 4.1, -0.3, 0, 1, sx * 0.02));
    b.add(new THREE.BoxGeometry(3.6, 5.4, 1.8), ST, f.m(sx * 12.4, 2.7, -0.4, sx * 0.1));
    b.add(new THREE.BoxGeometry(6.8, 0.5, 2.2), ST, f.m(sx * 8.0, 8.4, -0.3));
    for (let lx = 4.9; lx <= 13.5; lx += 1.3) {
      const [px, pz] = f.at(sx * lx, -0.3);
      ctx.solids.add(px, pz, 1.0);
    }
    // Gatekeeper hound statues
    const [hx, hz] = f.at(sx * 5.3, 5);
    hound(ctx, G.cold, hx, hz, GORGE_FACE, 1.15);
  }
  // Threshold flagstones
  for (let i = -2; i <= 2; i++) {
    const [px, pz] = f.at(0, i * 1.6);
    const py = ctx.h(px, pz);
    b.add(new THREE.BoxGeometry(6.6, 0.2, 1.5), SD, M(px, py + 0.02, pz, GORGE_FACE + (r() - 0.5) * 0.04));
  }
  pools.push({ x: gx, z: gz, r: 8, col: 0x5ad8ff, amt: 0.35 });
  const [fx, fz] = f.at(0, 5);
  pools.push({ x: fx, z: fz, r: 6, col: 0x8a6aff, amt: 0.3 });

  // Stelae: on both sides of the gorge (alternating with the stone lanterns)
  const lampAt = new Set(LAMPS.filter((l) => l.kind === 'stone').map((l) => {
    const [u, v] = gorgeUV(l.x, l.z);
    return `${Math.round(u)},${Math.sign(v)}`;
  }));
  for (const u of [12, 15.5, 19, 22.5, 26, 29.5, 33]) {
    for (const s of [-1, 1]) {
      if (lampAt.has(`${u},${s}`)) continue;
      const [x, z] = gorgeAt(u, s * 5.7);
      const [cx, cz] = gorgeAt(u, 0);
      ctx.place(x, z, 0.6);
      runeStone(b, x, z, 3.2 + r() * 1.4, COL.stone, 0xa06aff, Math.atan2(cz - z, cx - x), r);
      ctx.solids.add(x, z, 0.6);
      pools.push({ x, z, r: 1.6, col: 0x7a4ad8, amt: 0.35 });
    }
  }
  b.lift = 0;
  // Fallen rocks at the foot of the gorge walls, stalagmites on the rock ledges
  for (let i = 0; i < 26; i++) {
    const u = 6 + r() * 36;
    const s = r() < 0.5 ? -1 : 1;
    const v = s * (7.2 + r() * 2.5);
    const [x, z] = gorgeAt(u, v);
    const rs = 0.8 + r() * 1.2;
    const yy = ground(ctx, x, z, rs * 0.9);
    const g = new THREE.DodecahedronGeometry(rs, 0);
    g.scale(1, 0.8 + r() * 0.5, 1);
    b.add(g, COL.rock, M(x, yy + 0.15, z, r() * 6, 1, 0, r() * 0.3));
  }
  for (let i = 0; i < 14; i++) {
    const u = 12 + r() * 26;
    const s = r() < 0.5 ? -1 : 1;
    const [x, z] = gorgeAt(u, s * (11 + r() * 3.5));
    stalagmite(ctx, x, z, 0.7 + r() * 0.8);
  }
  // Spider silk across the gorge, hung with dewdrops
  for (const u of [15, 23, 30]) {
    const [ax, az] = gorgeAt(u, -11);
    const [bx, bz] = gorgeAt(u + 2, 11);
    const a = V(ax, ctx.h(ax, az) + 1.2, az);
    const c = V(bx, ctx.h(bx, bz) + 1.6, bz);
    silkLine(ctx, a, c, 2.2);
  }
}

/** A strand of silver spider silk: a glowing thin line and a few dewdrops */
function silkLine(ctx: FieldCtx, a: THREE.Vector3, c: THREE.Vector3, sag: number): void {
  const { b } = ctx;
  b.lift = 0;
  rope(b, a, c, sag, 0.014, COL.silk, true, 12);
  const n = Math.max(3, Math.round(a.distanceTo(c) / 2.5));
  for (const p of catenary(a, c, sag, n).slice(1, n)) b.glow(new THREE.SphereGeometry(0.06, 5, 4), 0xe8f0ff, M(p.x, p.y - 0.05, p.z));
}

// ───────────────────────── In front of the tower ─────────────────────────

function towerYard(ctx: FieldCtx, G: Glows, pools: GroundLight[]): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWER;
  const ty = ctx.h(tx, tz);
  // Six tall lamp poles around the tower, with lamp strings stretched between them (the side of the tower door is left open)
  const doorA = Math.atan2(TOWN[1] - tz, TOWN[0] - tx);
  const tops: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = doorA + 0.75 + (i / 7) * (Math.PI * 2 - 1.5);
    const x = tx + Math.cos(a) * 20.5;
    const z = tz + Math.sin(a) * 20.5;
    const y = ground(ctx, x, z, 0.4);
    const H = 8.5;
    b.add(new THREE.CylinderGeometry(0.4, 0.55, 0.6, 6), COL.stoneDark, M(x, y + 0.2, z));
    b.add(new THREE.CylinderGeometry(0.13, 0.18, H, 6), COL.post, M(x, y + H / 2, z));
    b.add(new THREE.BoxGeometry(1.4, 0.1, 0.1), COL.post, M(x, y + H - 0.3, z, -a));
    hangLantern(ctx, G.lamps[i % 3], V(x + Math.cos(a + Math.PI / 2) * 0.6, y + H - 0.35, z + Math.sin(a + Math.PI / 2) * 0.6), 1.1);
    hangLantern(ctx, G.lamps[(i + 1) % 3], V(x - Math.cos(a + Math.PI / 2) * 0.6, y + H - 0.35, z - Math.sin(a + Math.PI / 2) * 0.6), 1.1);
    b.add(new THREE.ConeGeometry(0.22, 0.4, 5), COL.post, M(x, y + H + 0.2, z));
    tops.push(V(x, y + H, z));
    ctx.solids.add(x, z, 0.5);
    pools.push({ x, z, r: 4.5, col: WARM, amt: 0.5 });
  }
  for (let i = 0; i + 1 < tops.length; i++) {
    const a = tops[i];
    const c = tops[i + 1];
    b.lift = 0;
    rope(b, a, c, 1.6, 0.02, COL.cap, false, 10);
    const pts = catenary(a, c, 1.6, 8);
    for (let j = 1; j < 8; j++) {
      const g = new THREE.SphereGeometry(0.16, 7, 5);
      g.scale(1, 1.3, 1);
      if (j % 3 === 0) b.glow(g, COL.rune, M(pts[j].x, pts[j].y - 0.24, pts[j].z));
      else G.lamps[j % 3].add(g, M(pts[j].x, pts[j].y - 0.24, pts[j].z));
    }
  }
  // The last stretch in front of the tower: stone lanterns and two gatekeeper hound statues
  for (const s of [-1, 1]) {
    const [x, z] = gorgeAt(7, s * 5.6);
    stoneLantern(ctx, G.lamps[s > 0 ? 0 : 1], x, z, GORGE_FACE, 1.25);
    pools.push({ x, z, r: 4, col: WARM, amt: 0.5 });
    const [hx, hz] = gorgeAt(3.4, s * 7);
    hound(ctx, G.cold, hx, hz, GORGE_FACE, 1.0);
  }
  // Broken pillars on the outer ring
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = 25 + r() * 6;
    const x = tx + Math.cos(a) * d;
    const z = tz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < 5 || Math.hypot(x - tx, z - tz) < 23) continue;
    column(ctx, x, z, 2 + r() * 4, 0.55 + r() * 0.2, r() < 0.7, r);
  }
  // The glow at the tower top: the brightest lamp in the everdark, visible from far away
  halo(ctx, tx, ty + 57.5, tz, 70, 0x9a7aff, 0.09);
  halo(ctx, tx, ty + 57.5, tz, 20, 0xffc070, 0.32, 0.15);
}

// ───────────────────────── Everdark Lake ─────────────────────────

function lake(ctx: FieldCtx, G: Glows, pools: GroundLight[], trees: [number, number, number, number][], ceil: THREE.Group): Reflect[] {
  const { b, r } = ctx;
  const wl = ctx.waterLevel;
  // Light sources for the reflection: jellyfish go first (positions updated every frame), then lamps and the waterfall,
  // and last the trees on the shore
  const refl: Reflect[] = [];
  const reflJ: Reflect[] = [];
  const reflT: Reflect[] = [];

  // ── Pier
  const [p0, p1] = PIER;
  const deckY = -0.5;
  const len = Math.abs(p1[0] - p0[0]);
  for (let i = 0; i <= len / 0.5; i++) {
    const x = p0[0] - i * 0.5;
    b.add(new THREE.BoxGeometry(0.44, 0.1, 2.5), i % 3 ? COL.wood : 0x3e2c38, M(x, deckY - 0.05, p0[1] + (r() - 0.5) * 0.06, (r() - 0.5) * 0.03));
  }
  for (let x = p0[0] - 2; x >= p1[0]; x -= 3) {
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), 0x2a2030, M(x, deckY - 0.7, p0[1] + s * 1.3));
      if (s > 0) b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 4), 0x2a2030, M(x, deckY + 0.5, p0[1] + s * 1.3));
    }
  }
  b.add(new THREE.BoxGeometry(len - 2, 0.06, 0.06), COL.post, M((p0[0] + p1[0]) / 2 - 1, deckY + 0.95, p0[1] + 1.3));
  const pierLamps: Lamp[] = [
    { x: p1[0] + 0.6, z: p0[1] - 1.05, face: 0, kind: 'lamp' },
    { x: p1[0] + 0.6, z: p0[1] + 1.05, face: Math.PI, kind: 'lamp' },
  ];
  for (const L of pierLamps) {
    lanternPost(ctx, G.lamps[0], L, 0);
    pools.push({ x: L.x, z: L.z + Math.cos(L.face) * 0.9, r: 4, col: WARM, amt: 0.5 });
    refl.push({ x: L.x, y: ctx.h(L.x, L.z) + 2.3, z: L.z + Math.cos(L.face) * 0.88, s: 1.1, col: 0xffa850 });
  }
  // A small boat moored at the pier
  const bx = p1[0] + 3.5;
  const bz = p0[1] + 3.0;
  const hull = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  hull.scale(0.8, 0.45, 2.0);
  b.add(hull, 0x3a2a36, M(bx, wl + 0.18, bz, 0.35));
  b.add(new THREE.TorusGeometry(1, 0.06, 4, 16), 0x2a2030, new THREE.Matrix4().compose(V(bx, wl + 0.2, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -0.35)), V(0.8, 2.0, 1)));
  b.add(new THREE.BoxGeometry(1.2, 0.08, 0.35), COL.wood, M(bx, wl + 0.22, bz, 0.35));
  b.add(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), COL.post, M(bx + 0.2, wl + 0.9, bz + 0.9));
  hangLantern(ctx, G.lamps[1], V(bx + 0.2, wl + 1.55, bz + 0.9), 0.8);
  refl.push({ x: bx + 0.2, y: wl + 1.2, z: bz + 0.9, s: 0.9, col: 0xffa850 });

  // ── Shore: reeds (tips glowing), umbrella-mushroom trees reflected in the lake, shore rocks
  for (let i = 0; i < 70 * (ctx.low ? 0.5 : 1); i++) {
    const a = r() * Math.PI * 2;
    const x = LAKE[0] + Math.cos(a) * (18 + r() * 12);
    const z = LAKE[1] + Math.sin(a) * (18 + r() * 12);
    const e = lakeEdge(x, z);
    if (e < -1.5 || e > 1.2 || ctx.pathDist(x, z) < 4 || !ctx.clear(x, z, -1.5)) continue;
    reeds(ctx, x, z);
  }
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const x = LAKE[0] + Math.cos(a) * (20 + r() * 10);
    const z = LAKE[1] + Math.sin(a) * (20 + r() * 10);
    const e = lakeEdge(x, z);
    if (e < 0.5 || e > 3 || ctx.pathDist(x, z) < 4.5 || !ctx.clear(x, z, 0)) continue;
    mossStone(ctx, x, z, 0.6 + r() * 0.9, 0x4a4462, 0x2f5a6a);
  }
  const shore: [number, number, number, number, boolean][] = [
    [-24, -12, 1.7, 22, true],
    [-30, 30, 1.5, 19, false],
    [-68, 26, 2.0, 26, true],
    [-74, -4, 1.6, 20, false],
    [-44, -24, 1.8, 24, true],
    [-20, 26, 1.2, 15, true],
    [-58, -26, 1.4, 17, false],
  ];
  for (const [x, z, R, H, pale] of shore) {
    if (!ctx.clear(x, z, R) || lakeEdge(x, z) < 1.5) continue;
    umbrella(ctx, x, z, R, H, pale);
    trees.push([x, z, R, H]);
    reflT.push({ x, y: ctx.h(x, z) + H - R * 3.6 * 0.26, z, s: R * 3.2, col: pale ? 0x1a4050 : 0x34224e });
  }

  // ── Moon lotus: round leaves on the water and glowing flowers
  for (let i = 0; i < 60 * (ctx.low ? 0.5 : 1); i++) {
    const a = r() * Math.PI * 2;
    const x = LAKE[0] + Math.cos(a) * (6 + r() * 18);
    const z = LAKE[1] + Math.sin(a) * (6 + r() * 18);
    const hh = ctx.h(x, z);
    if (hh > wl - 0.4 || hh < wl - 3.5) continue;
    if (Math.hypot(x - FALLS[0], z - FALLS[1]) < 5) continue;
    const s = 0.5 + r() * 0.5;
    b.add(new THREE.CylinderGeometry(s, s, 0.04, 12, 1, false, 0.3, Math.PI * 1.85), 0x24485a, M(x, wl + 0.03, z, r() * 6), false);
    if (r() < 0.35) {
      b.glow(new THREE.ConeGeometry(0.14, 0.22, 6), r() < 0.5 ? 0xa8e8ff : 0xe8a8ff, M(x + 0.2, wl + 0.15, z, 0, 1, Math.PI));
    }
  }

  // ── Glowing jellyfish: mostly near the east shore (visible from the road), a few at the island's edge
  const mats: THREE.Material[] = [];
  const fl: Floater[] = [];
  const jellies: [number, number, number, number][] = [
    [-28, 14, 1.0, 0x6ae8ff],
    [-31, 2, 0.8, 0xb08aff],
    [-26, -3, 1.2, 0x6ae8ff],
    [-35, 20, 0.9, 0xff8ad8],
    [-40, 9, 1.1, 0x8ab8ff],
    [-46, -6, 0.8, 0x6ae8ff],
    [-60, 10, 1.0, 0xb08aff],
    [-38, 26, 0.7, 0x6ae8ff],
    [-50, 18, 0.9, 0xff8ad8],
  ];
  const nJ = ctx.low ? 6 : jellies.length;
  jellies.slice(0, nJ).forEach(([x, z, s, col], i) => {
    const jj = jellyfish(col, s, mats);
    fl.push({ obj: jj, x, y: wl + 0.55 + s * 0.4, z, orbit: 1.5 + r() * 2.5, speed: (0.05 + r() * 0.06) * (i % 2 ? 1 : -1), phase: r() * 6, bob: 0.25, pulse: 1.6 + r() * 0.8 });
    reflJ.push({ x, y: wl + 0.9, z, s: s * 1.4, col });
  });
  // Soul-guiding lamps: drifting around Sunken Moon Isle
  const iy = ctx.h(ISLE[0], ISLE[1]);
  for (let i = 0; i < (ctx.low ? 3 : 5); i++) {
    const a = (i / 5) * Math.PI * 2;
    fl.push({ obj: soulLamp(1.1, mats), x: ISLE[0] + Math.cos(a) * 1.5, y: iy + 2.4 + (i % 2) * 1.1, z: ISLE[1] + Math.sin(a) * 1.5, orbit: 4.2 + (i % 3) * 0.8, speed: 0.12 + (i % 2) * 0.05, phase: a, bob: 0.35, pulse: 0 });
  }

  // ── Moonspring Falls
  const top = ceilH(FALLS[0], FALLS[1]);
  moonFalls(ctx, FALLS[0], FALLS[1], top, ceil);
  for (const hy of [3, 12, 26]) refl.push({ x: FALLS[0], y: wl + hy, z: FALLS[1], s: 2.6, col: 0x8aa8e8 });

  // ── Sunken Moon Isle: a ring of broken pillars of an old temple, an altar in the middle, a pale umbrella-mushroom tree
  const ring = 5.8;
  const isleTree: [number, number] = [ISLE[0] + Math.cos(2.64) * 6.8, ISLE[1] + Math.sin(2.64) * 6.8];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const x = ISLE[0] + Math.cos(a) * ring;
    const z = ISLE[1] + Math.sin(a) * ring;
    // Leave open where the old stone causeway comes ashore and the trees at the island's edge
    if (Math.hypot(x - CAUSEWAY[CAUSEWAY.length - 1][0], z - CAUSEWAY[CAUSEWAY.length - 1][1]) < 3) continue;
    if (Math.hypot(x - isleTree[0], z - isleTree[1]) < 2.8) continue;
    column(ctx, x, z, i % 3 === 0 ? 4.6 : 1.6 + r() * 2.4, 0.42, i % 3 !== 0, r);
  }
  const [ax, az] = [ISLE[0], ISLE[1] - 2];
  const ay = ground(ctx, ax, az, 1.5);
  b.add(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 10), COL.stoneDark, M(ax, ay + 0.2, az));
  b.add(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 10), COL.stone, M(ax, ay + 0.8, az));
  G.eye.add(new THREE.TorusGeometry(0.7, 0.06, 5, 24), M(ax, ay + 1.3, az, 0, 1, Math.PI / 2));
  const orb = new THREE.SphereGeometry(0.34, 12, 9);
  G.cold.add(orb, M(ax, ay + 1.75, az));
  ctx.solids.add(ax, az, 1.6);
  pools.push({ x: ISLE[0], z: ISLE[1], r: 8, col: 0x6a5ad8, amt: 0.4 });
  pools.push({ x: ax, z: az, r: 3, col: 0x6ae8ff, amt: 0.5 });
  refl.push({ x: ax, y: ay + 1.75, z: az, s: 1.8, col: 0x5ad8ff });
  umbrella(ctx, isleTree[0], isleTree[1], 1.2, 15, true);
  trees.push([isleTree[0], isleTree[1], 1.2, 15]);

  // ── Old stone causeway: a flagstone road half submerged in the water, with a few broken pillars on both sides
  for (let i = 0; i + 1 < CAUSEWAY.length; i++) {
    const [x0, z0] = CAUSEWAY[i];
    const [x1, z1] = CAUSEWAY[i + 1];
    const l = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    for (let t = 0; t < l; t += 1.25) {
      const x = x0 + ((x1 - x0) * t) / l;
      const z = z0 + ((z1 - z0) * t) / l;
      const g = new THREE.BoxGeometry(2.0 + r() * 0.4, 0.3, 1.05);
      b.add(g, r() < 0.3 ? COL.stoneLight : COL.stone, M(x + (r() - 0.5) * 0.2, -0.95, z, ang + (r() - 0.5) * 0.12));
    }
    if (i < CAUSEWAY.length - 1) {
      const nx = Math.cos(ang);
      const nz = -Math.sin(ang);
      for (const s of [-1, 1]) {
        const x = (x0 + x1) / 2 + nx * s * 1.9;
        const z = (z0 + z1) / 2 + nz * s * 1.9;
        b.add(new THREE.CylinderGeometry(0.38, 0.42, 1.4 + r() * 1.6, 8), COL.stone, M(x, wl + 0.2, z, 0, 1, 0, (r() - 0.5) * 0.2));
      }
    }
  }

  // ── Reflections on the lake surface (at most 16; the moving jellyfish are updated every frame)
  const all = [...reflJ, ...refl, ...reflT].slice(0, 16);
  const set = lakeReflections(ctx, [-80, -10, -26, 42], all);
  animateFloaters(ctx, fl, mats, (i, _f, x, y, z) => {
    if (i < nJ) set(i, x, y + 0.3, z);
  });
  return all;
}

/** Reeds: thin deep-purple stalks, with half of the tips carrying cold light */
function reeds(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z);
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.3;
    const pz = z + (r() - 0.5) * 1.3;
    const h = 1.1 + r() * 1.0;
    const tilt = (r() - 0.5) * 0.25;
    b.add(new THREE.CylinderGeometry(0.02, 0.035, h, 4), 0x3a3462, M(px, y + h / 2, pz, 0, 1, 0, tilt), false);
    const head = new THREE.CapsuleGeometry(0.05, 0.22, 2, 5);
    const m = M(px - Math.sin(tilt) * h * 0.5, y + h, pz, 0, 1, 0, tilt);
    if (i % 2) b.glow(head, 0x7ad8ff, m);
    else b.add(head, 0x5a4a80, m, false);
  }
}

// ───────────────────────── Sunken Tomb ─────────────────────────

function crypt(ctx: FieldCtx, G: Glows, pools: GroundLight[]): void {
  const { b, r } = ctx;
  const rot = CRYPT_ROT;
  const faceX = Math.PI / 2 - rot; // Direction of local +qx
  const W = (qx: number, qz: number) => cryptWorld(qx, qz);
  // Retaining wall: a ring along the courtyard edge (gaps where the road passes)
  const edge: [number, number, number][] = [];
  for (let q = -9; q <= 9; q += 2) {
    edge.push([q, -7.4, 0]);
    edge.push([q, 7.4, 0]);
  }
  for (let q = -5; q <= 5; q += 2) {
    edge.push([10.4, q, Math.PI / 2]);
    if (Math.abs(q) > 2) edge.push([-10.4, q, Math.PI / 2]);
  }
  for (const [qx, qz, ra] of edge) {
    const [x, z] = W(qx, qz);
    if (ctx.pathDist(x, z) < 4) continue;
    const hh = 2.4 + r() * 1.2;
    const fy = CRYPT_FLOOR;
    b.add(new THREE.BoxGeometry(2.05, hh, 0.9), r() < 0.5 ? COL.stoneDark : 0x4a4466, M(x, fy + hh / 2 - 0.2, z, -rot + ra, 1, 0, (r() - 0.5) * 0.05));
    if (r() < 0.4) b.add(new THREE.BoxGeometry(0.9, 0.4, 0.8), COL.stone, M(x, fy + hh, z, -rot + ra + 0.3));
    ctx.solids.add(x, z, 1.0);
  }
  // The sealed tomb door (west side)
  const [dx, dz] = W(-10.6, 0);
  const dy = CRYPT_FLOOR;
  const f = frame(dx, dy, dz, faceX);
  for (const sx of [-1, 1]) {
    b.add(new THREE.BoxGeometry(1.2, 5.2, 1.4), COL.stone, f.m(sx * 2.1, 2.4, 0));
    const [px, pz] = f.at(sx * 2.1, 0);
    ctx.solids.add(px, pz, 0.9);
  }
  b.add(new THREE.BoxGeometry(5.8, 1.1, 1.7), COL.stoneDark, f.m(0, 5.3, 0));
  const gab = new THREE.ConeGeometry(1, 1, 4);
  gab.rotateY(Math.PI / 4);
  gab.scale(3.4, 1.6, 1.3);
  b.add(gab, COL.stoneDark, f.m(0, 6.5, 0));
  b.add(new THREE.BoxGeometry(3.0, 4.6, 0.4), 0x241c34, f.m(0, 2.3, -0.2));
  G.eye.add(new THREE.TorusGeometry(0.95, 0.07, 6, 28), f.m(0, 2.6, 0.05));
  G.eye.add(new THREE.TorusGeometry(0.6, 0.05, 6, 24), f.m(0, 2.6, 0.05));
  G.eye.add(new THREE.BoxGeometry(0.06, 4.2, 0.05), f.m(0, 2.3, 0.02));
  ctx.solids.add(dx, dz, 1.6);
  pools.push({ x: dx, z: dz, r: 5, col: 0x8a5aff, amt: 0.5 });
  for (const sx of [-1, 1]) {
    const [hx, hz] = W(-8.2, sx * 3.4);
    hound(ctx, G.cold, hx, hz, faceX, 0.9);
  }
  // Two rows of stone pillars in the courtyard
  for (const qz of [-4.3, 4.3]) {
    for (const qx of [-5.5, -1.5, 2.5, 6.5]) {
      const [x, z] = W(qx, qz);
      if (ctx.pathDist(x, z) < 3.6) continue;
      column(ctx, x, z, 2.8 + r() * 2.6, 0.48, r() < 0.55, r);
    }
  }
  // Sarcophagi: some already open, with small candles lit beside the coffins
  const coffins: [number, number, boolean][] = [[-4, 0, false], [0.5, 0.2, true], [4.8, -0.2, false]];
  for (const [qx, qz, open] of coffins) {
    const [x, z] = W(qx, qz);
    sarcophagus(ctx, x, z, faceX + (r() - 0.5) * 0.1, open);
    if (open) pools.push({ x, z, r: 2.6, col: 0x9a5aff, amt: 0.55 });
    for (let i = 0; i < 3; i++) {
      const [cx, cz] = W(qx + (r() - 0.5) * 1.6, qz + (r() < 0.5 ? -1 : 1) * 1.45);
      const cy = ctx.h(cx, cz);
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.2 + r() * 0.15, 5), 0xe8e0d0, M(cx, cy + 0.12, cz));
      G.lamps[i].add(new THREE.SphereGeometry(0.05, 5, 4), M(cx, cy + 0.34, cz));
    }
  }
  b.lift = 0;
  // Clusters of gravestones outside the courtyard
  for (let i = 0; i < (ctx.low ? 18 : 34); i++) {
    const a = r() * Math.PI * 2;
    const d = 14 + r() * 10;
    const x = CRYPT[0] + Math.cos(a) * d;
    const z = CRYPT[1] + Math.sin(a) * d * 0.8;
    if (!ctx.clear(x, z, 0.4) || cryptDist(x, z) < 4.8 || lakeEdge(x, z) < 1 || ctx.solids.blocked(x, z, 0.8)) continue;
    tombstone(ctx, x, z, a + Math.PI + (r() - 0.5) * 0.5, (r() - 0.5) * 0.4, 0.9 + r() * 0.5);
  }
  // A few dead trees (owl perches)
  for (const [x, z] of [[-72, 72], [-44, 72], [-70, 50]] as const) if (ctx.clear(x, z, 1)) deadTree(ctx, x, z, 0.7, 9 + r() * 4);
}

// ───────────────────────── Unlit Wood ─────────────────────────

function grove(ctx: FieldCtx, G: Glows, pools: GroundLight[], trees: [number, number, number, number][]): void {
  const { r } = ctx;
  const [gx, gz] = GROVE;
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const d = 5 + r() * 16;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1.2) || ctx.solids.blocked(x, z, 2.5)) continue;
    deadTree(ctx, x, z, 0.6 + r() * 0.5, 8 + r() * 8);
    trees.push([x, z, 0.8, 10]);
  }
  // Corrupted crystal clusters
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 3 + r() * 15;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0.5) || ctx.solids.blocked(x, z, 1.2)) continue;
    const cs = 0.8 + r() * 0.9;
    if (!purified(ctx)) {
      crystals(ctx, x, z, cs, COL.corrupt, 0x2a1a3e);
      pools.push({ x, z, r: 2.4, col: 0xb03aff, amt: 0.45 });
    } else {
      // The corrupted crystal clusters crumbled to soil, and moonbell flowers and small glowing mushrooms sprout
      moonbells(ctx, x, z, 7);
      ctx.place(x, z);
      for (let j = 0; j < 4; j++) shroom(ctx.b, x + (r() - 0.5) * 1.6, z + (r() - 0.5) * 1.6, 0.35 + r() * 0.4, r, r() < 0.3);
      ctx.b.lift = 0;
      pools.push({ x, z, r: 2.2, col: 0x6ad8ff, amt: 0.3 });
    }
  }
  // Extinguished lamps scattered through the wood (even where there is no road)
  for (let i = 0; i < 8; i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 14;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0.4) || ctx.solids.blocked(x, z, 1)) continue;
    const lamp: Lamp = { x, z, face: r() * 6, kind: 'dead' };
    if (!purified(ctx)) deadLantern(ctx, lamp, r);
    else {
      lanternPost(ctx, G.lamps[i % 3], lamp, (r() - 0.5) * 0.1);
      pools.push({ x: x + Math.sin(lamp.face) * 0.9, z: z + Math.cos(lamp.face) * 0.9, r: 4, col: WARM, amt: 0.4 });
    }
  }
  // Fallen big stone lanterns (set upright and relit after purification)
  const [sx, sz] = [gx + 7, gz - 6];
  if (purified(ctx) && ctx.clear(sx, sz, 1)) {
    stoneLantern(ctx, G.lamps[0], sx, sz, 0.4, 1.3);
    pools.push({ x: sx, z: sz, r: 5, col: WARM, amt: 0.55 });
  } else if (ctx.clear(sx, sz, 1)) {
    const y = ground(ctx, sx, sz, 1);
    const { b } = ctx;
    b.add(new THREE.CylinderGeometry(0.7, 0.85, 0.5, 6), COL.stoneDark, M(sx, y + 0.2, sz));
    const sh = new THREE.CylinderGeometry(0.3, 0.36, 1.8, 6);
    sh.rotateZ(Math.PI / 2);
    b.add(sh, COL.stone, M(sx + 1.5, y + 0.35, sz + 0.4, 0.4));
    const rf = new THREE.ConeGeometry(0.95, 0.7, 4);
    rf.rotateZ(1.9);
    b.add(rf, COL.slate, M(sx + 3.0, y + 0.5, sz + 1.2, 0.9));
    b.add(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0x2e2838, M(sx + 2.2, y + 0.3, sz - 0.6, 0.5));
    ctx.solids.add(sx, sz, 1);
    ctx.solids.add(sx + 1.7, sz + 0.5, 0.6);
  }
}

// ───────────────────────── Silkthread Vale ─────────────────────────

function silkHollow(ctx: FieldCtx, pools: GroundLight[], trees: [number, number, number, number][]): void {
  const { b, r } = ctx;
  const [cx, cz] = SILK;
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const d = 12.5 + r() * 3;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1.5)) continue;
    const R = 1.3 + r() * 0.6;
    const H = 16 + r() * 8;
    umbrella(ctx, x, z, R, H, true);
    trees.push([x, z, R, H]);
    ring.push(V(x, ctx.h(x, z), z));
  }
  // Spider silk between trees, hung with cocoons
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const a = V(p.x, p.y + 6 + r() * 3, p.z);
    const c = V(q.x, q.y + 6 + r() * 3, q.z);
    silkLine(ctx, a, c, 2.5);
    const mid = catenary(a, c, 2.5, 4)[2];
    cocoon(ctx, V(mid.x, mid.y - 1.6, mid.z), 1.1, 1.0);
    // Another one stretched across the other side, passing through the middle of the vale
    const o = ring[(i + 3) % ring.length];
    if (i % 2 === 0) silkLine(ctx, V(p.x, p.y + 9, p.z), V(o.x, o.y + 10, o.z), 3.5);
  }
  // The big web in the middle of the vale: three anchor strands pulled toward the trees
  const y0 = ctx.h(cx, cz);
  const center = V(cx, y0 + 5.2, cz);
  b.lift = 0;
  spiderWeb(b, center, V(-0.3, 0.1, 1), 4.6, COL.silk, r);
  for (const p of ring.slice(0, 4)) rope(b, center, V(p.x, p.y + 4.5, p.z), 0.4, 0.012, COL.silk, true, 6);
  rope(b, center, V(cx + 0.5, y0, cz + 0.3), 0.1, 0.012, COL.silk, true, 4);
  pools.push({ x: cx, z: cz, r: 9, col: 0xa8b8ff, amt: 0.3 });
  // Piles of cocoons and small webs on the ground
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 3 + r() * 8;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0) || ctx.solids.blocked(x, z, 0.8)) continue;
    const y = ctx.h(x, z);
    cocoon(ctx, V(x, y + 0.35, z), 0.9 + r() * 0.5, 0);
    ctx.solids.add(x, z, 0.4);
  }
  for (const p of ring) spiderWeb(b, V(p.x + 1.2, p.y + 2.2, p.z + 0.6), V(r() - 0.5, 0.2, r() - 0.5), 1.2 + r() * 0.6, COL.silk, r);
}

// ───────────────────────── Moonlit Glade ─────────────────────────

function glade(ctx: FieldCtx, pools: GroundLight[], trees: [number, number, number, number][]): void {
  const { b, r } = ctx;
  const [gx, gz] = GLADE;
  ctx.place(gx, gz, 2);
  shroomRing(ctx, gx, gz, 6.5, 20);
  pools.push({ x: gx, z: gz, r: 10, col: 0x7a4ad8, amt: 0.4 });
  // A flat stone altar and moonbell flowers at the center
  const y = ground(ctx, gx, gz, 1.5);
  const g = new THREE.CylinderGeometry(1.6, 1.8, 0.5, 9);
  b.add(g, COL.stone, M(gx, y + 0.15, gz, 0.3));
  b.glow(new THREE.TorusGeometry(1.2, 0.04, 4, 24), COL.moon, M(gx, y + 0.42, gz, 0, 1, Math.PI / 2));
  ctx.solids.add(gx, gz, 1.8);
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    const d = 2.5 + r() * 3;
    moonbells(ctx, gx + Math.cos(a) * d, gz + Math.sin(a) * d, 5);
  }
  // Tall umbrella-mushroom trees around the glade
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.5;
    const d = 14 + r() * 4;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    const R = 1.8 + r() * 0.7;
    if (!ctx.clear(x, z, 2) || ctx.solids.blocked(x, z, 3) || blocksTowerView(x, z, R * 3.4)) continue;
    const H = 24 + r() * 8;
    umbrella(ctx, x, z, R, H, i % 2 === 0);
    trees.push([x, z, R, H]);
  }
}

// ───────────────────────── Glowgrass Meadow ─────────────────────────

function meadow(ctx: FieldCtx, pools: GroundLight[]): void {
  const { r, b } = ctx;
  const [mx, mz] = MEADOW;
  for (const [x, z, s] of [[4, 40, 1.8], [24, 30, 1.5], [10, 26, 1.3], [-4, 32, 1.6], [26, 46, 1.2]] as const) {
    if (!ctx.clear(x, z, 1)) continue;
    mossStone(ctx, x, z, s, 0x5a5478, 0x2f5a6a);
  }
  for (let i = 0; i < 70 * (ctx.low ? 0.5 : 1); i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 24;
    const x = mx + Math.cos(a) * d;
    const z = mz + Math.sin(a) * d;
    if (!ctx.clear(x, z, -0.5) || ctx.solids.blocked(x, z, 0.6)) continue;
    moonbells(ctx, x, z, 4 + Math.floor(r() * 4));
  }
  for (let i = 0; i < 24 * (ctx.low ? 0.5 : 1); i++) {
    const a = r() * Math.PI * 2;
    const d = 8 + r() * 18;
    const x = mx + Math.cos(a) * d;
    const z = mz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0) || ctx.solids.blocked(x, z, 0.8)) continue;
    ctx.place(x, z);
    shroom(b, x, z, 0.5 + r() * 0.7, r, r() < 0.3);
  }
  b.lift = 0;
  void pools;
}

// ───────────────────────── Floor-to-ceiling stalactite-stalagmite pillars and the ceiling's stalactites ─────────────────────────

function columns(ctx: FieldCtx, pools: GroundLight[], ceil: THREE.Group): void {
  const { b, r } = ctx;
  const cb = new VBatch(1000);
  for (const [x, z, R] of COLUMNS) {
    const y = ground(ctx, x, z, R);
    // Stalagmite mounds on the ground (always visible)
    b.add(new THREE.ConeGeometry(R * 1.9, R * 3.2, 9), COL.rock, M(x, y + R * 1.3, z, r()));
    b.add(new THREE.CylinderGeometry(R * 1.2, R * 2.1, R * 0.9, 9), COL.rockLight, M(x, y + R * 0.2, z, r()));
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      const d = R * (1.8 + r() * 0.8);
      const s = 0.5 + r() * 0.7;
      const hh = s * (2 + r() * 2);
      b.add(new THREE.ConeGeometry(s * 0.5, hh, 6), COL.rock, M(x + Math.cos(a) * d, ctx.h(x + Math.cos(a) * d, z + Math.sin(a) * d) + hh / 2 - 0.2, z + Math.sin(a) * d, 0, 1, 0, (r() - 0.5) * 0.3));
    }
    const a = r() * Math.PI * 2;
    crystals(ctx, x + Math.cos(a) * R * 2.2, z + Math.sin(a) * R * 2.2, 0.9, r() < 0.5 ? COL.cyan : 0xa88aff, 0x2e2a48);
    pools.push({ x, z, r: R * 3, col: 0x3a8ab8, amt: 0.3 });
    ctx.solids.add(x, z, R * 1.5);
    // The pillars themselves (hidden together with the ceiling)
    const top = ceilH(x, z);
    const H = top - y;
    cb.add(new THREE.CylinderGeometry(R * 0.72, R * 0.95, H, 12), COL.rock, M(x, y + H / 2, z, r()));
    cb.add(new THREE.ConeGeometry(R * 2.4, R * 5, 10), COL.rock, M(x, top - R * 2.3, z, r(), 1, Math.PI));
    for (let i = 0; i < 6; i++) {
      const ba = r() * Math.PI * 2;
      const hy = y + H * (0.1 + r() * 0.8);
      const rr = R * (0.95 - (0.23 * (hy - y)) / H);
      cb.add(new THREE.SphereGeometry(R * (0.3 + r() * 0.2), 7, 5), COL.rockLight, M(x + Math.cos(ba) * rr, hy, z + Math.sin(ba) * rr, ba, 1));
    }
    // Glowing ore veins: thin cold-light lines running up the pillar
    for (let i = 0; i < 3; i++) {
      const ba = r() * Math.PI * 2;
      for (let s = 0; s < 6; s++) {
        const hy = y + 3 + s * (H / 7);
        const rr = R * (0.95 - (0.23 * (hy - y)) / H) + 0.03;
        const aa = ba + s * 0.25;
        cb.glow(new THREE.BoxGeometry(0.08, H / 7 + 0.3, 0.06), i === 1 ? 0xa88aff : COL.cyan, M(x + Math.cos(aa) * rr, hy, z + Math.sin(aa) * rr, -aa, 1, 0, 0.15));
      }
    }
  }
  // Stalactites on the ceiling: denser toward the cave wall, avoiding the cracks and the tower top
  const n = ctx.low ? 90 : 170;
  for (let i = 0; i < n; i++) {
    const x = (r() * 2 - 1) * (S + 10);
    const z = (r() * 2 - 1) * (S + 10);
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (r() > 0.35 + 0.6 * sm(40, S, m)) continue;
    if (Math.hypot(x - TOWER[0], z - TOWER[1]) < 28) continue;
    if (CRACKS.some((c) => Math.hypot(x - c.x, z - c.z) < Math.max(c.rx, c.rz) + 3)) continue;
    stalactites(cb, x, z, ceilH(x, z) + 1.5, 1.0 + r() * 2.2, 0x2a2240, r);
  }
  cb.build(ceil);
  ctx.disposers.push(() => cb.dispose());
}

// ───────────────────────── Umbrella-mushroom forest ─────────────────────────

function forestMask(x: number, z: number): number {
  const S2 = S;
  if (lakeEdge(x, z) < 2.5) return 0;
  const clear: [number, number, number][] = [
    [TOWN[0], TOWN[1], 30],
    [MEADOW[0], MEADOW[1], 23],
    [GLADE[0], GLADE[1], 12],
    [CRYPT[0], CRYPT[1], 20],
    [GROVE[0], GROVE[1], 22],
    [SILK[0], SILK[1], 17],
    [TOWER[0], TOWER[1], 32],
    [ISLE[0], ISLE[1], 12],
  ];
  for (const [cx, cz, cr] of clear) if (Math.hypot(x - cx, z - cz) < cr) return 0;
  const [u, v] = gorgeUV(x, z);
  // Only a few scattered trees on the gorge and the tongue of rock
  if (u < 44 && u > -4 && Math.abs(v) < 17) return 0.06;
  // The line of sight from the spawn point to the tower: leave a sparse corridor through the woods
  const wob = Math.sin(u * 0.08) * 2.5;
  if (u > 40 && u < 160 && Math.abs(v + wob) < 8) return 0.04;
  const m = Math.max(Math.abs(x), Math.abs(z)) / S2;
  const belt = Math.sin(x * 0.045 + 0.7) * Math.cos(z * 0.052 - 0.3) * 0.5 + 0.5;
  return Math.min(1, 0.18 + belt * 0.5 + sm(0.62, 0.85, m) * 0.5);
}

function forest(ctx: FieldCtx, trees: [number, number, number, number][], k: number): void {
  const { r, b } = ctx;
  const S2 = S - 6;
  // Giant trees
  for (let i = 0; i < 900 * k; i++) {
    const x = (r() * 2 - 1) * S2;
    const z = (r() * 2 - 1) * S2;
    const m = forestMask(x, z);
    if (r() > m) continue;
    const big = r();
    const R = 0.9 + big * big * 1.7;
    if (!ctx.clear(x, z, R + 1) || ctx.solids.blocked(x, z, R * 2.4 + 1)) continue;
    const mm = Math.max(Math.abs(x), Math.abs(z));
    if (mm > S - 20 || blocksTownView(x, z, R * 3) || blocksTowerView(x, z, R * 3.4)) continue;
    const H = R * 8.5 + 4 + r() * 7;
    umbrella(ctx, x, z, R, H, r() < 0.55);
    trees.push([x, z, R, H]);
  }
  // Medium-sized glowing big mushrooms
  for (let i = 0; i < 380 * k; i++) {
    const x = (r() * 2 - 1) * S2;
    const z = (r() * 2 - 1) * S2;
    const m = forestMask(x, z);
    if (r() > 0.25 + m * 0.6 || m === 0 || blocksTownView(x, z, 1)) continue;
    if (!ctx.clear(x, z, 0.6) || ctx.solids.blocked(x, z, 1.4) || ctx.h(x, z) < ctx.waterLevel + 0.4) continue;
    ctx.place(x, z, 0.4);
    const s = 1.2 + r() * 2.2;
    shroom(b, x, z, s, r, r() < 0.25);
    if (s > 2) ctx.solids.add(x, z, 0.2 * s);
  }
  // Small mushroom clusters, ferns, bushes, mossy rocks, moonbell flowers
  for (let i = 0; i < 520 * k; i++) {
    const x = (r() * 2 - 1) * S2;
    const z = (r() * 2 - 1) * S2;
    const m = forestMask(x, z);
    if (r() > 0.2 + m * 0.8) continue;
    if (!ctx.clear(x, z, 0) || ctx.solids.blocked(x, z, 0.7) || ctx.h(x, z) < ctx.waterLevel + 0.4) continue;
    ctx.place(x, z);
    const kind = r();
    if (kind < 0.4) fern(b, x, z, 0.8 + r() * 0.8, r() < 0.5 ? 0x2c4a5e : 0x3e3070, r);
    else if (kind < 0.62) {
      for (let j = 0; j < 3 + Math.floor(r() * 3); j++) shroom(b, x + (r() - 0.5) * 1.4, z + (r() - 0.5) * 1.4, 0.35 + r() * 0.5, r, r() < 0.3);
    } else if (kind < 0.84) shrub(ctx, x, z, 0.8 + r() * 0.8, [0x2e2a52, 0x3a2e5c, 0x283a58]);
    else if (kind < 0.93) {
      mossStone(ctx, x, z, 0.5 + r() * 0.8, 0x4a4462, 0x2f5a6a);
    } else moonbells(ctx, x, z, 5);
  }
  b.lift = 0;
}

// ───────────────────────── Cave wall ─────────────────────────

function caveWalls(ctx: FieldCtx, k: number): void {
  const { b, r } = ctx;
  for (let i = 0; i < 260 * k; i++) {
    const side = Math.floor(r() * 4);
    const along = (r() * 2 - 1) * (S - 3);
    const inset = 3 + r() * 28;
    const px = side === 0 ? S - inset : side === 1 ? -(S - inset) : along;
    const pz = side === 2 ? S - inset : side === 3 ? -(S - inset) : along;
    if (!ctx.clear(px, pz, 2) || blocksTownView(px, pz, 5)) continue;
    const kind = r();
    if (inset > 18 && kind < 0.35) {
      stalagmite(ctx, px, pz, 0.9 + r() * 1.6);
    } else if (inset > 14 && kind < 0.45) {
      crystals(ctx, px, pz, 1.0 + r() * 1.2, r() < 0.6 ? COL.cyan : 0xa88aff, 0x2e2a48);
    } else {
      const s = 2 + r() * 4;
      // The cave wall is a steep slope: take the lowest ground under the whole rock block and bury it a bit deeper,
      // so the downhill side does not hang in the air
      const y = ctx.place(px, pz, s * 1.2);
      b.lift = 0;
      const g = new THREE.DodecahedronGeometry(s, 0);
      g.scale(1, 1 + r() * 1.2, 1);
      b.add(g, r() < 0.5 ? 0x2e2844 : 0x3a3252, M(px, y - s * 0.25, pz, r() * 6, 1, 0, (r() - 0.5) * 0.3), inset < 16);
      shadowsOf(ctx).push({ x: px, z: pz, r: s * 1.5, amt: 0.6 });
      if (inset > 16) ctx.solids.add(px, pz, s * 0.8);
    }
  }
  b.lift = 0;
}

// ───────────────────────── Spider silk between trees ─────────────────────────

function silkStrands(ctx: FieldCtx, trees: [number, number, number, number][], k: number): void {
  const { r } = ctx;
  let made = 0;
  for (let tries = 0; tries < 400 && made < 40 * k; tries++) {
    const a = trees[Math.floor(r() * trees.length)];
    const c = trees[Math.floor(r() * trees.length)];
    if (!a || !c || a === c) continue;
    const d = Math.hypot(a[0] - c[0], a[1] - c[1]);
    if (d < 7 || d > 18) continue;
    const pa = V(a[0], ctx.h(a[0], a[1]) + a[3] * (0.3 + r() * 0.25), a[1]);
    const pc = V(c[0], ctx.h(c[0], c[1]) + c[3] * (0.3 + r() * 0.25), c[1]);
    silkLine(ctx, pa, pc, 0.8 + d * 0.08);
    made++;
  }
}

// ───────────────────────── Red eyes in the dark ─────────────────────────

function eyes(ctx: FieldCtx): void {
  const { r } = ctx;
  const pairs: EyePair[] = [];
  const pure = purified(ctx);
  // Especially many in Unlit Wood (they scatter after purification)
  for (let i = 0; i < (pure ? 0 : 10); i++) {
    const a = r() * Math.PI * 2;
    const d = 10 + r() * 14;
    const x = GROVE[0] + Math.cos(a) * d;
    const z = GROVE[1] + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < 7) continue;
    pairs.push({ x, y: ctx.h(x, z) + 0.7 + r() * 1.2, z, gap: 0.3 + r() * 0.12 });
  }
  for (let tries = 0; tries < 600 && pairs.length < (pure ? 12 : 34); tries++) {
    const x = (r() * 2 - 1) * (S - 14);
    const z = (r() * 2 - 1) * (S - 14);
    if (forestMask(x, z) < 0.45 || ctx.pathDist(x, z) < 11 || ctx.solids.blocked(x, z, 0.5)) continue;
    if (Math.hypot(x - TOWN[0], z - TOWN[1]) < 36) continue;
    pairs.push({ x, y: ctx.h(x, z) + 0.6 + r() * 1.4, z, gap: 0.3 + r() * 0.14 });
  }
  watchingEyes(ctx.group, ctx.disposers, ctx.extras, pairs, 0xff2a3a, 0.13);
}

// ───────────────────────── Moonlight ─────────────────────────

function moonlight(ctx: FieldCtx, pools: GroundLight[], ceil: THREE.Group): void {
  const { r } = ctx;
  const list: Shaft[] = [];
  const kx = MOON_DIR.x / MOON_DIR.y;
  const kz = MOON_DIR.z / MOON_DIR.y;
  for (const [ci, c] of CRACKS.entries()) {
    const top = ceilH(c.x, c.z) + 2;
    const pts: [number, number, number][] = [];
    if (ci === 0) {
      // The tower: light falls around the tower from the big opening at the tower top
      // The side of the tower door (facing the village) is left open, so it does not block the view when walking up to the tower
      const door = Math.atan2(TOWN[1] - TOWER[1], TOWN[0] - TOWER[0]);
      for (let i = 0; i < 6; i++) {
        const a = door + 0.95 + (i / 5) * (Math.PI * 2 - 1.9) + (r() - 0.5) * 0.3;
        const d = 13 + r() * 6;
        pts.push([Math.cos(a) * d, Math.sin(a) * d, 3 + r() * 3.5]);
      }
    } else {
      const n = Math.max(2, Math.round((c.rx * c.rz) / 7));
      for (let i = 0; i < n; i++) {
        const lx = (r() - 0.5) * c.rx * 1.1;
        const lz = (r() - 0.5) * c.rz * 1.1;
        pts.push([Math.cos(c.rot) * lx - Math.sin(c.rot) * lz, Math.sin(c.rot) * lx + Math.cos(c.rot) * lz, 1.2 + r() * 2.4]);
      }
    }
    for (const [ox, oz, w] of pts) {
      // The top of the shaft is at the crack, and it falls down along the moonlight direction to the ground
      const tx = c.x + ox;
      const tz = c.z + oz;
      let gx = tx;
      let gz = tz;
      let gy = 0;
      for (let it = 0; it < 3; it++) {
        gy = Math.max(ctx.h(gx, gz), ctx.waterLevel);
        gx = tx - kx * (top - gy);
        gz = tz - kz * (top - gy);
      }
      list.push({ x: gx, y: gy, z: gz, w, len: (top - gy) / MOON_DIR.y });
      pools.push({ x: gx, z: gz, r: w * 1.5, col: 0x8aa0ff, amt: 0.4 });
    }
  }
  moonShafts(ctx, list, MOON_DIR, 0xb8c8ff, 0.3, ceil);
}

// ───────────────────────── Ground-hugging purple mist ─────────────────────────

function mists(ctx: FieldCtx): void {
  const w = (x: number, z: number) => {
    let a = 0.5;
    const le = lakeEdge(x, z);
    a += 0.5 * (1 - sm(-4, 8, le));
    a += 0.5 * (1 - sm(4, 16, cryptDist(x, z)));
    a += (purified(ctx) ? 0.1 : 0.6) * (1 - sm(8, 22, Math.hypot(x - GROVE[0], z - GROVE[1])));
    a *= 0.3 + 0.7 * sm(16, 30, Math.hypot(x - TOWN[0], z - TOWN[1]));
    a *= 0.55 + 0.45 * sm(3, 9, ctx.pathDist(x, z));
    return Math.min(1.2, a);
  };
  groundMist(ctx, 0.35, 0x7048b8, 0.55, 0.05, 1, w);
  if (!ctx.low) groundMist(ctx, 1.7, 0x4a3a90, 0.28, 0.028, 0.7, (x, z) => w(x, z) * 0.8);
}

// ───────────────────────── Ambient particles ─────────────────────────

function emitters(ctx: FieldCtx): void {
  let acc = 0;
  const pure = purified(ctx);
  const near = (cam: THREE.Vector3, x: number, z: number, d: number) => Math.hypot(cam.x - x, cam.z - z) < d;
  ctx.extras.push((dt, _t, vfx) => {
    acc += dt;
    const cam = vfx.camPos;
    while (acc > 0.1) {
      acc -= 0.1;
      // Moonlit Glade: spores from the mushroom ring
      if (near(cam, GLADE[0], GLADE[1], 70)) {
        const a = Math.random() * Math.PI * 2;
        const x = GLADE[0] + Math.cos(a) * 6.5;
        const z = GLADE[1] + Math.sin(a) * 6.5;
        vfx.emit({ pos: V(x, ctx.h(x, z) + 0.5, z), count: 1, color: [0xc46aff, 0x9ae8ff], speed: [0.15, 0.4], dir: V(0, 1, 0), spread: 0.6, life: [2.5, 4], size: [0.08, 0.14], sizeEnd: 0.4, drag: 0.1, intensity: 1.8 });
      }
      // Unlit Wood: corrupted purple smoke drifting upward
      if (near(cam, GROVE[0], GROVE[1], 70) && Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 16;
        const x = GROVE[0] + Math.cos(a) * d;
        const z = GROVE[1] + Math.sin(a) * d;
        vfx.emit({ pos: V(x, ctx.h(x, z) + 0.3, z), count: 1, color: pure ? [0x9ae8ff, 0xffd08a, 0xc8a8ff] : [0x9a3aff, 0x5a1a8a, 0xff5ac8], speed: [0.2, 0.5], dir: V(0, 1, 0), spread: 0.4, life: [2.5, 4], size: pure ? [0.06, 0.12] : [0.12, 0.25], sizeEnd: pure ? 0.3 : 0.6, drag: 0.2, intensity: pure ? 2 : 1.4 });
      }
      // Sunken Tomb: faintly rising soul fire
      if (near(cam, CRYPT[0], CRYPT[1], 70) && Math.random() < 0.5) {
        const [x, z] = cryptWorld((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12);
        vfx.emit({ pos: V(x, CRYPT_FLOOR + 0.3, z), count: 1, color: [0x7affd8, 0x9ab8ff], speed: [0.2, 0.45], dir: V(0, 1, 0), spread: 0.3, life: [3, 5], size: [0.1, 0.18], sizeEnd: 0.3, drag: 0.15, intensity: 1.8 });
      }
      // Silkthread Vale: silver glints on the silk
      if (near(cam, SILK[0], SILK[1], 60) && Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 12;
        const x = SILK[0] + Math.cos(a) * d;
        const z = SILK[1] + Math.sin(a) * d;
        vfx.emit({ pos: V(x, ctx.h(x, z) + 3 + Math.random() * 6, z), count: 1, color: [0xe8f0ff, 0xb8c8ff], speed: [0.05, 0.2], spread: 1, life: [1.5, 3], size: [0.06, 0.12], sizeEnd: 0.2, drag: 0.4, gravity: 0.05, intensity: 2 });
      }
      // Everdark Lake: spirit light rising from the water
      if (near(cam, LAKE[0], LAKE[1], 80)) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 20;
        const x = LAKE[0] + Math.cos(a) * d;
        const z = LAKE[1] + Math.sin(a) * d;
        if (ctx.h(x, z) < ctx.waterLevel) vfx.emit({ pos: V(x, ctx.waterLevel + 0.1, z), count: 1, color: [0x6ae8ff, 0x9ab8ff], speed: [0.1, 0.3], dir: V(0, 1, 0), spread: 0.3, life: [3, 5], size: [0.08, 0.14], sizeEnd: 0.25, drag: 0.1, intensity: 1.6 });
      }
      // The tower: light motes slowly falling in the moonlight
      if (near(cam, TOWER[0], TOWER[1], 80)) {
        const a = Math.random() * Math.PI * 2;
        const d = 12 + Math.random() * 10;
        const x = TOWER[0] + Math.cos(a) * d;
        const z = TOWER[1] + Math.sin(a) * d;
        vfx.emit({ pos: V(x, ctx.h(x, z) + 6 + Math.random() * 16, z), count: 1, color: [0xc8d8ff, 0xffe0b0], speed: [0.1, 0.3], dir: V(0, -1, 0), spread: 0.3, life: [4, 6], size: [0.1, 0.18], sizeEnd: 0.3, drag: 0.2, intensity: 1.5 });
      }
    }
  });
}
