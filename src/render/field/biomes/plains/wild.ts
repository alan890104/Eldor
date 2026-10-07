// Field landmarks of Thunderpeal Plains: the pillar terrace, the giant pillars of the Thunderpeal Dais and their charged cables,
// the skeleton, Lone Tree Hill, the Scorched Glass Flats, the boulder group and the old migration camp,
// Thunder Creek and the marsh, the secret realm "Thunderfall Heart", scattered low trees and ovoo,
// the border rock wall and the distant scenery.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import { catenary, rope, runeStone, segM, V } from '../../../arenas/_woods.ts';
import { smooth } from '../../compose.ts';
import { arch, flowers, glowGroup, type FieldCtx, type XZ } from '../../kit.ts';
import { boulder, lilyPads, reeds, scatterMask } from '../../props.ts';
import type { ClothSet } from './cloth.ts';
import { AVENUE, BONES, CHESTS, CREEK, edgeMetric, FORD1, FORD2, HEART, HEART_SEGS, LONE, MARSH, OLDCAMP, RODS, RODS_LIST, S, SCAR, SCAR_SEGS, SPRING, STRIKES, TORS, TOWER, TOWER_DIR, TOWER_RING, towerAt, TOWN, WATER } from './land.ts';
import { balancedRock, bentTree, C, cart, feather, firePit, fulgurite, giantPillar, glassPlate, granite, lattice, ovoo, ramSkull, rodPillar, skeleton, splitTree, steppingStones, stoneRing, tor } from './props.ts';
import { veinDecal } from './ground.ts';

export interface WildOut {
  /** Intact pillar tops in the pillar grove (strike points) */
  rodTips: THREE.Vector3[];
  /** Thunder cores of the Thunderpeal Dais giant pillars */
  ringTips: THREE.Vector3[];
  /** Top of the glass tree in Thunderfall Heart */
  heartTip: THREE.Vector3;
  /** Top of the glass tube at the center of the Scorched Glass Flats */
  scarTip: THREE.Vector3;
  /** Top of the lone tree */
  treeTip: THREE.Vector3;
  /** Makes the discharge patterns flare briefly after a lightning strike */
  surge: (which: 'scar' | 'heart') => void;
  tick: (dt: number, t: number, flash: number, vfx: import('../../../vfx.ts').Vfx) => void;
}

export function buildWild(ctx: FieldCtx, cloth: ClothSet): WildOut {
  const { b, r, low } = ctx;
  // Seal Tower fully broken through: the nomads at the outpost hold a festival
  const calm = ctx.done >= ctx.floors;
  let fest: { flames: THREE.Group; parts: THREE.Mesh[] } | null = null;
  const k = low ? 0.5 : 1;
  const glowRods: THREE.BufferGeometry[] = [];
  const glowCable: THREE.BufferGeometry[] = [];
  const glowBolt: THREE.BufferGeometry[] = [];

  // ───────── Pillar grove
  const rodTips: THREE.Vector3[] = [];
  for (const o of RODS_LIST) {
    const tip = rodPillar(ctx, o.x, o.z, o.h, o.broken, glowRods);
    if (!o.broken && Math.hypot(o.x - RODS[0], o.z - RODS[1]) < 30) rodTips.push(tip);
  }
  // Terrace entrance: the dwarves' stone archway, with the trail passing through the middle
  {
    const [x, z] = [-37, -27];
    arch(ctx, x, z, Math.atan2(-11, -11) + Math.PI / 2, 7.2, 5.2, C.stone, C.spark);
    b.lift = 0;
  }
  // Fallen pillars, the dwarves' rune stones
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 16;
    const x = RODS[0] + Math.cos(a) * d;
    const z = RODS[1] + Math.sin(a) * d;
    if (!ctx.clear(x, z, 2) || ctx.solids.blocked(x, z, 2.5)) continue;
    ctx.place(x, z, 2);
    const len = 4 + r() * 3;
    const ang = r() * Math.PI;
    b.add(new THREE.CylinderGeometry(0.34, 0.44, len, 6), C.stone, M(x, 0.3, z, ang, 1, 0, Math.PI / 2 - 0.05));
    b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 6), C.bronze, M(x + Math.cos(ang) * len * 0.2, 0.3, z - Math.sin(ang) * len * 0.2, ang, 1, 0, Math.PI / 2));
    ctx.solids.add(x + Math.cos(ang) * len * 0.3, z - Math.sin(ang) * len * 0.3, 0.7);
    ctx.solids.add(x - Math.cos(ang) * len * 0.3, z + Math.sin(ang) * len * 0.3, 0.7);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const x = RODS[0] + Math.cos(a) * 9;
    const z = RODS[1] + Math.sin(a) * 9;
    if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1.5)) continue;
    ctx.place(x, z, 0.5);
    runeStone(b, x, z, 2.2 + r() * 0.8, C.stoneDark, C.spark, Math.atan2(RODS[1] - z, RODS[0] - x), r);
    ctx.solids.add(x, z, 0.6);
  }

  // ───────── Thunderpeal Dais: giant pillars around the tower, charged cables between them, pillars beside the approach
  const ringTips: THREE.Vector3[] = [];
  for (const o of TOWER_RING) ringTips.push(giantPillar(ctx, o.x, o.z, o.h, glowRods));
  for (let i = 0; i < ringTips.length; i++) {
    const a = ringTips[i];
    const c = ringTips[(i + 1) % ringTips.length];
    // No cable across the approach
    const mid = a.clone().lerp(c, 0.5);
    const toDoor = Math.hypot(mid.x - towerAt(26)[0], mid.z - towerAt(26)[1]);
    if (toDoor < 12 || a.distanceTo(c) > 30) continue;
    const pts = catenary(a.clone().add(V(0, -1.2, 0)), c.clone().add(V(0, -1.2, 0)), 3.2, 14);
    for (let j = 0; j < pts.length - 1; j++) glowCable.push(new THREE.CylinderGeometry(1, 1, 1, 4).applyMatrix4(segM(pts[j], pts[j + 1], 0.05)));
  }
  for (const o of AVENUE) rodPillar(ctx, o.x, o.z, o.h, false, glowRods, 1.25);
  // Nomad outpost beside the approach: a small tent, a flag, hitching posts
  {
    const [ax, az] = towerAt(44);
    const nx = TOWER_DIR[1];
    const nz = -TOWER_DIR[0];
    const x = ax + nx * 12;
    const z = az + nz * 12;
    // Small tent
    ctx.place(x, z, 2);
    const R = 2.3;
    b.add(new THREE.CylinderGeometry(R, R * 1.03, 1.4, 16), C.felt, M(x, 0.95, z));
    b.add(new THREE.ConeGeometry(R * 1.12, 1.3, 16), C.roof2, M(x, 2.3, z));
    b.add(new THREE.CylinderGeometry(R * 1.1, R * 1.1, 0.12, 16), C.gold, M(x, 1.68, z));
    b.add(new THREE.CylinderGeometry(R + 0.2, R + 0.3, 0.3, 16), C.woodDark, M(x, 0.1, z));
    const fa = Math.atan2(ax - x, az - z);
    b.add(new THREE.BoxGeometry(1.0, 1.3, 0.14), C.door, M(x + Math.sin(fa) * R, 0.9, z + Math.cos(fa) * R, fa));
    ctx.solids.add(x, z, R + 0.3);
    const px = x + nx * 3.4;
    const pz = z + nz * 3.4;
    const py = ctx.place(px, pz);
    b.add(new THREE.CylinderGeometry(0.06, 0.08, 5.4, 6), C.woodDark, M(px, 2.7, pz));
    cloth.flag(px, pz, py + 3.6, py + 5.2, new THREE.Vector3(0.87, 0, 0.49), 2.2, C.red, 1.3, C.gold);
    ctx.solids.add(px, pz, 0.3);
    const fpx = x - nx * 3.6 + TOWER_DIR[0] * 2;
    const fpz = z - nz * 3.6 + TOWER_DIR[1] * 2;
    firePit(ctx, fpx, fpz, !calm);
    if (calm) {
      // After purification: the nomads hold a festival at the outpost, the festival pole hung with long five-color ribbons,
      // strings of pennants run from the pole top to the tent, the flagpole and another short pole, and the fire is lit again
      const five = [0x3a6ad0, 0xf2efe6, 0xc8433a, 0x4a9a52, 0xe8c44a];
      const fx = x - nx * 4.4 - TOWER_DIR[0] * 3.2;
      const fz = z - nz * 4.4 - TOWER_DIR[1] * 3.2;
      const fy = ctx.place(fx, fz, 0.4);
      const FH = 7.6;
      b.add(new THREE.CylinderGeometry(0.1, 0.15, FH, 7), C.woodDark, M(fx, FH / 2, fz));
      b.add(new THREE.SphereGeometry(0.2, 8, 6), C.gold, M(fx, FH + 0.05, fz));
      b.add(new THREE.ConeGeometry(0.09, 0.7, 5), C.gold, M(fx, FH + 0.55, fz));
      for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.06, 0.45, 5), C.gold, M(fx + nx * 0.2 * s, FH + 0.3, fz + nz * 0.2 * s, 0, 1, 0, 0));
      ctx.solids.add(fx, fz, 0.35);
      const top = V(fx, fy + FH - 0.2, fz);
      for (let i = 0; i < 10; i++) cloth.strip(top.clone().add(V(Math.cos(i * 0.63) * 0.13, -i * 0.06, Math.sin(i * 0.63) * 0.13)), 3.0 + r() * 1.8, 0.24, five[i % 5], r() * 6);
      // Another short pole
      const sx = x + TOWER_DIR[0] * 6 - nx * 1.5;
      const sz = z + TOWER_DIR[1] * 6 - nz * 1.5;
      const sy = ctx.place(sx, sz, 0.3);
      b.add(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 6), C.woodDark, M(sx, 1.9, sz));
      ctx.solids.add(sx, sz, 0.3);
      b.lift = 0;
      const from = V(fx, fy + FH - 1.2, fz);
      let ci = 0;
      for (const to of [V(x, ctx.h(x, z) + 2.95, z), V(px, py + 4.4, pz), V(sx, sy + 3.7, sz)]) {
        const len = from.distanceTo(to);
        const sag = len * 0.07;
        rope(b, from, to, sag, 0.025, C.rope, false, 10);
        const n = Math.max(3, Math.round(len / 0.6));
        const pts = catenary(from, to, sag, n);
        for (let i = 1; i < n - 1; i++) {
          const a = pts[i].clone().lerp(pts[i + 1], 0.12);
          const c = pts[i].clone().lerp(pts[i + 1], 0.88);
          cloth.hang(a, c, 0.4, five[ci++ % 5], r() * 6, 0.22);
        }
      }
      // The fire, lit again
      const g = new THREE.Group();
      g.position.set(fpx, ctx.h(fpx, fpz) + 0.2, fpz);
      const parts = (
        [
          [0.5, 1.4, 0xff5a18, 1.5],
          [0.32, 1.05, 0xffa62a, 2.0],
          [0.16, 0.7, 0xfff0a8, 2.6],
        ] as const
      ).map(([rad, hh, col, inten]) => {
        const m = new THREE.Mesh(new THREE.ConeGeometry(rad, hh, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(inten), toneMapped: false }));
        m.position.y = hh / 2;
        g.add(m);
        return m;
      });
      ctx.group.add(g);
      ctx.disposers.push(() =>
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        }),
      );
      fest = { flames: g, parts };
    }
  }
  // Broken pieces of giant pillars scattered in front of the tower
  for (const [d, off] of [
    [30, 13],
    [40, -14],
    [24, -17],
  ] as const) {
    const [ax, az] = towerAt(d);
    const x = ax - TOWER_DIR[1] * off;
    const z = az + TOWER_DIR[0] * off;
    if (!ctx.clear(x, z, 1.5) || ctx.solids.blocked(x, z, 2)) continue;
    ctx.place(x, z, 1.5);
    const ang = r() * Math.PI;
    b.add(new THREE.CylinderGeometry(0.8, 0.95, 3.6, 6), C.stone, M(x, 0.6, z, ang, 1, 0, Math.PI / 2 - 0.1));
    b.add(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 6), C.bronze, M(x + Math.cos(ang) * 0.9, 0.6, z - Math.sin(ang) * 0.9, ang, 1, 0, Math.PI / 2));
    ctx.solids.add(x, z, 1.6);
  }
  // Glass ground on the Thunderpeal Dais
  for (let i = 0; i < 22 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = 20 + r() * 16;
    const x = TOWER[0] + Math.cos(a) * d;
    const z = TOWER[1] + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0)) continue;
    glassPlate(ctx, x, z, 0.8 + r() * 1.4);
  }

  // ───────── Skeleton of the ancient thunderbeast (the main road passes through the middle of the chest cavity)
  {
    const ax = -0.316;
    const az = 0.949;
    const L = 40;
    // The chest cavity's center is at BONES, 16 meters from the skull
    const hx = BONES[0] - ax * 16;
    const hz = BONES[1] - az * 16;
    skeleton(ctx, hx, hz, Math.atan2(az, ax), glowBolt, L);
    b.lift = 0;
  }

  // ───────── Lone Tree Hill
  const treeTip = splitTree(ctx, cloth, LONE[0], LONE[1], glowBolt);
  ovoo(ctx, cloth, LONE[0] + 6.5, LONE[1] - 5.5, 1.5);
  for (const [dx, dz, s] of [
    [-7, 4, 1.4],
    [-4, 9, 1.0],
    [8, 6, 1.2],
  ] as const) {
    ctx.place(LONE[0] + dx, LONE[1] + dz, s);
    granite(ctx, LONE[0] + dx, s * 0.4, LONE[1] + dz, s * 1.2, s * 0.7, s, C.granite2);
    ctx.solids.add(LONE[0] + dx, LONE[1] + dz, s);
  }
  b.lift = 0;

  // ───────── Scorched Glass Flats
  const scarFx = veinDecal(ctx, SCAR[0], SCAR[1], 30, SCAR_SEGS, 0x8ab4ff, 1.4);
  const scarTip = fulgurite(ctx, SCAR[0] - 1.5, SCAR[1] - 2, 3.2, glowBolt);
  for (let i = 0; i < 14 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = 4 + Math.sqrt(r()) * 20;
    const x = SCAR[0] + Math.cos(a) * d;
    const z = SCAR[1] + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0.5) || ctx.solids.blocked(x, z, 1)) continue;
    fulgurite(ctx, x, z, 0.7 + r() * 0.9, glowBolt);
  }
  for (let i = 0; i < 40 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 24;
    const x = SCAR[0] + Math.cos(a) * d;
    const z = SCAR[1] + Math.sin(a) * d;
    if (!ctx.clear(x, z, -1)) continue;
    glassPlate(ctx, x, z, 0.6 + r() * 1.6);
  }
  // Burnt stump
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = 14 + r() * 12;
    const x = SCAR[0] + Math.cos(a) * d;
    const z = SCAR[1] + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1.5)) continue;
    ctx.place(x, z, 0.5);
    const hh = 1.2 + r() * 1.8;
    b.add(new THREE.CylinderGeometry(0.22, 0.4, hh, 6), C.char, M(x, hh / 2, z, r() * 6, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
    b.add(new THREE.ConeGeometry(0.24, 0.6, 5), C.char, M(x, hh + 0.2, z, r() * 6, 1, 0.3));
    ctx.solids.add(x, z, 0.5);
  }

  // ───────── Boulder group of Thundermane Run
  tor(ctx, TORS[0] + 7, TORS[1] + 7, 4.2, 4);
  tor(ctx, TORS[0] - 9, TORS[1] + 11, 3.0, 3);
  balancedRock(ctx, TORS[0] + 10, TORS[1] - 6);
  tor(ctx, TORS[0] + 16, TORS[1] + 2, 2.6, 3);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 20;
    const x = TORS[0] + Math.cos(a) * d;
    const z = TORS[1] + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1.5) || ctx.solids.blocked(x, z, 2)) continue;
    const s = 0.6 + r() * 1.3;
    ctx.place(x, z, s);
    granite(ctx, x, s * 0.35, z, s * 1.3, s * 0.8, s, [C.granite, C.granite2, C.granite3][i % 3]);
    ctx.solids.add(x, z, s * 1.1);
  }
  ovoo(ctx, cloth, TORS[0] - 2, TORS[1] - 10, 1.4, false);

  // ───────── The old migration camp: stone rings left by the tents, a cold hearth, a broken cart, a fallen lattice frame
  const oldRings: [number, number, number][] = [
    [OLDCAMP[0] - 8, OLDCAMP[1] + 10, 3.1],
    [OLDCAMP[0] + 8, OLDCAMP[1] + 7.5, 2.8],
    [OLDCAMP[0] - 5, OLDCAMP[1] - 8, 3.0],
    [OLDCAMP[0] + 10, OLDCAMP[1] - 10, 2.6],
  ];
  for (const [x, z, R] of oldRings) {
    stoneRing(ctx, x, z, R);
    if (r() < 0.75) firePit(ctx, x, z, true);
  }
  cart(ctx, OLDCAMP[0] + 3, OLDCAMP[1] + 13, 0.9, false, true);
  lattice(ctx, OLDCAMP[0] - 12, OLDCAMP[1] + 4, 0.4);
  lattice(ctx, OLDCAMP[0] + 15, OLDCAMP[1] - 3, 2.1);
  ramSkull(ctx, OLDCAMP[0] - 2, OLDCAMP[1] + 6);
  ramSkull(ctx, OLDCAMP[0] + 6, OLDCAMP[1] - 6);
  {
    // Toppled old totem pole
    const [x, z] = [OLDCAMP[0] - 14, OLDCAMP[1] - 6];
    ctx.place(x, z, 0.5);
    b.add(new THREE.CylinderGeometry(0.22, 0.28, 4.8, 8), C.woodDark, M(x, 2.2, z, 0.8, 1, 0.3, 0.15));
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), C.redDark, M(x + 0.35, 3.2, z - 0.2, 0.8, 1, 0.3, 0.15));
    b.add(new THREE.BoxGeometry(1.6, 0.1, 0.5), C.woodDark, M(x + 0.6, 4.4, z - 0.4, 0.8, 1, 0.3, 0.15));
    ctx.solids.add(x, z, 0.5);
  }

  // ───────── Thunder Creek: reeds on the banks, stepping stones at the fords, the spring and the marsh
  for (let i = 0; i < 220 * k; i++) {
    const t = r();
    const seg = Math.min(CREEK.length - 2, Math.floor(t * (CREEK.length - 1)));
    const f = t * (CREEK.length - 1) - seg;
    const [ax, az] = CREEK[seg];
    const [cx, cz] = CREEK[seg + 1];
    const side = r() < 0.5 ? -1 : 1;
    const dx = cx - ax;
    const dz = cz - az;
    const l = Math.hypot(dx, dz) || 1;
    const off = 3 + r() * 5;
    const x = ax + dx * f - (dz / l) * side * off;
    const z = az + dz * f + (dx / l) * side * off;
    const hh = ctx.h(x, z);
    if (hh < WATER - 0.25 || hh > WATER + 0.7) continue;
    if (ctx.pathDist(x, z) < 4 || ctx.solids.blocked(x, z, 0.4)) continue;
    reeds(ctx, x, z, 0x6a8a3a, 0x7a5a3a);
  }
  for (const [c, dir] of [
    [FORD1, [0.53, -0.85]],
    [FORD2, [0.05, -1]],
  ] as const) {
    const px = -dir[1];
    const pz = dir[0];
    steppingStones(ctx, [c[0] - dir[0] * 6 + px * 1.6, c[1] - dir[1] * 6 + pz * 1.6], [c[0] + dir[0] * 6 + px * 1.6, c[1] + dir[1] * 6 + pz * 1.6], 7, WATER);
  }
  // Spring: a crack in the rock below the cliff
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.5 + (i / 8) * Math.PI;
    const x = SPRING[0] + Math.cos(a) * 8;
    const z = SPRING[1] + Math.sin(a) * 8;
    const s = 1.2 + r() * 1.6;
    ctx.place(x, z, s * 0.5);
    granite(ctx, x, s * 0.2, z, s * 1.4, s, s * 1.1, [C.stone, C.stoneDark, C.granite2][i % 3], false);
    ctx.solids.add(x, z, s);
  }
  lilyPads(ctx, MARSH[0], MARSH[1], 26, 0x587a3a, 0xf2efe6);
  for (let i = 0; i < 60 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = 8 + r() * 12;
    const x = MARSH[0] + Math.cos(a) * d;
    const z = MARSH[1] + Math.sin(a) * d;
    const hh = ctx.h(x, z);
    if (hh < WATER - 0.4 || hh > WATER + 0.8 || ctx.solids.blocked(x, z, 0.4) || ctx.pathDist(x, z) < 4) continue;
    reeds(ctx, x, z, 0x5f7a36, 0x6a4a30);
  }
  // Dead trees in the marsh, killed by lightning
  for (const [dx, dz] of [
    [-6, 3],
    [4, -5],
    [7, 6],
  ] as const) {
    const x = MARSH[0] + dx;
    const z = MARSH[1] + dz;
    const y = ctx.h(x, z);
    b.lift = Math.min(y, WATER) - 0.3;
    const hh = 3 + r() * 3;
    b.add(new THREE.CylinderGeometry(0.14, 0.3, hh, 6), C.char, M(x, hh / 2, z, r() * 6, 1, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25));
    b.add(new THREE.CylinderGeometry(0.04, 0.1, 1.6, 5), C.char, M(x + 0.4, hh * 0.7, z, r() * 6, 1, 0, 0.9));
  }
  b.lift = 0;

  // ───────── Secret realm: Thunderfall Heart
  const heartFx = veinDecal(ctx, HEART[0], HEART[1], 17, HEART_SEGS, 0xb49aff, 1.8);
  const heartTip = fulgurite(ctx, HEART[0], HEART[1], 5.2, glowBolt);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = HEART[0] + Math.cos(a) * 10.5;
    const z = HEART[1] + Math.sin(a) * 10.5;
    if (ctx.solids.blocked(x, z, 1)) continue;
    ctx.place(x, z, 0.6);
    runeStone(b, x, z, 3.2 + r() * 1.2, C.stoneDark, 0xb49aff, Math.atan2(HEART[1] - z, HEART[0] - x), r);
    ctx.solids.add(x, z, 0.7);
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 4 + r() * 9;
    const x = HEART[0] + Math.cos(a) * d;
    const z = HEART[1] + Math.sin(a) * d;
    if (ctx.solids.blocked(x, z, 1.2) || Math.hypot(x - CHESTS[5][0], z - CHESTS[5][1]) < 3) continue;
    fulgurite(ctx, x, z, 0.8 + r() * 1.2, glowBolt);
  }
  for (let i = 0; i < 26 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 14;
    const x = HEART[0] + Math.cos(a) * d;
    const z = HEART[1] + Math.sin(a) * d;
    if (ctx.solids.blocked(x, z, 0.5)) continue;
    glassPlate(ctx, x, z, 0.6 + r() * 1.5);
  }
  // The huge feather dropped by the `thunderbird`
  for (const [dx, dz, ry, tilt] of [
    [5, -4, 0.6, 0.35],
    [-6, 3.5, 2.2, 0.5],
    [2, 7, 4.0, 0.25],
  ] as const) {
    feather(ctx, HEART[0] + dx, HEART[1] + dz, ry, tilt, glowBolt);
  }
  // Rocks on the stone ridge (outside the gap)
  for (let i = 0; i < 26 * k + 10; i++) {
    const a = r() * Math.PI * 2;
    let da = a - Math.atan2(RODS[1] - HEART[1], RODS[0] - HEART[0]);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < 0.45) continue;
    const d = 18 + r() * 5;
    const x = HEART[0] + Math.cos(a) * d;
    const z = HEART[1] + Math.sin(a) * d;
    const s = 1.4 + r() * 2.2;
    ctx.place(x, z, s * 0.5);
    b.add(new THREE.DodecahedronGeometry(s, 0), [C.stone, C.stoneDark, C.granite2][i % 3], M(x, s * 0.3, z, r() * 6, 1, r(), r()).multiply(MS(0, 0, 0, 1, 1.3 + r() * 0.6, 1)));
  }
  b.lift = 0;

  // ───────── Odds and ends on the grassland: low trees, ovoo, cairns, wildflowers, animal bones, wheels, strike points
  const trees: XZ[] = [
    [-6, 54],
    [28, 48],
    [74, 64],
    [-28, -46],
    [34, 2],
    [84, -22],
    [-72, -26],
    [62, 26],
    [-34, 60],
    [20, 86],
  ];
  for (const [x, z] of trees) if (ctx.clear(x, z, 2) && !ctx.solids.blocked(x, z, 2)) bentTree(ctx, x, z, 1 + r() * 0.5);
  for (const [x, z, R] of [
    [-24, 38, 1.2],
    [-31, -13, 1.2],
    [34, -26, 1.1],
    [52, 16, 1.1],
  ] as const) {
    if (ctx.clear(x, z, 3)) ovoo(ctx, cloth, x, z, R, R > 1.15);
  }
  // Waymarker cairn
  for (const road of [[-10, 26], [-18, -10], [22, -26], [-8, 80], [44, 46], [-60, 38]] as const) {
    const [x, z] = road;
    if (!ctx.clear(x, z, 0) || ctx.solids.blocked(x, z, 1)) continue;
    ctx.place(x, z, 0.5);
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const s = 0.42 - i * 0.07;
      b.add(new THREE.DodecahedronGeometry(s, 0), i % 2 ? C.granite : C.granite3, M(x + (r() - 0.5) * 0.1, y + s * 0.8, z + (r() - 0.5) * 0.1, r() * 6, 1).multiply(MS(0, 0, 0, 1, 0.65, 1)));
      y += s * 1.25;
    }
    ctx.solids.add(x, z, 0.5);
  }
  // Strike points: charred rubble and small glass tubes
  for (const [x, z] of STRIKES) {
    if (!ctx.clear(x, z, -1)) continue;
    fulgurite(ctx, x + 0.4, z - 0.3, 0.6, glowBolt);
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      const d = 1 + r() * 2;
      ctx.place(x + Math.cos(a) * d, z + Math.sin(a) * d);
      b.add(new THREE.DodecahedronGeometry(0.15 + r() * 0.15, 0), C.char, M(x + Math.cos(a) * d, 0.08, z + Math.sin(a) * d, r() * 6, 1, r(), r()));
    }
  }
  const isSpecial = (x: number, z: number) =>
    Math.hypot(x - SCAR[0], z - SCAR[1]) < 30 || Math.hypot(x - HEART[0], z - HEART[1]) < 26 || Math.hypot(x - RODS[0], z - RODS[1]) < 28 || Math.hypot(x - TOWER[0], z - TOWER[1]) < 42 || Math.hypot(x - TOWN[0], z - TOWN[1]) < 26;
  // Wildflowers: small purple, yellow and white flowers, gathered in a few flower patches in the grass sea
  scatterMask(ctx, Math.round(420 * k), 0.4, (x, z) => (isSpecial(x, z) ? 0 : 0.25 + 0.75 * smooth(0.55, 0.85, Math.sin(x * 0.07 + 1) * Math.cos(z * 0.06 - 0.5) * 0.5 + 0.5)), (x, z) => flowers(ctx, x, z, r() < 0.5 ? [0xb89aff, 0xd8c0ff, 0xf2efe6] : [0xffd86a, 0xf2efe6, 0xffb35c], 4));
  // Stones scattered in the grass
  scatterMask(ctx, Math.round(140 * k), 1.5, (x, z) => (isSpecial(x, z) ? 0.1 : 0.35), (x, z) => boulder(ctx, x, z, 0.6 + r() * 1.3, [C.granite, C.granite2, C.granite3][Math.floor(r() * 3)]));
  for (let i = 0; i < 8; i++) {
    const x = (r() * 2 - 1) * 85;
    const z = (r() * 2 - 1) * 85;
    if (!ctx.clear(x, z, 1) || isSpecial(x, z) || ctx.h(x, z) < WATER + 0.6) continue;
    ramSkull(ctx, x, z);
  }

  // ───────── Rocks on steep scarps: the terrace, the Thunderpeal Dais, the steeper parts of the riverbank
  {
    const n = new THREE.Vector3();
    scatterMask(
      ctx,
      Math.round(2600 * k),
      0.5,
      (x, z) => {
        if (edgeMetric(x, z) > S - 32) return 0;
        ctx.terrain.normalAt(x, z, n);
        return smooth(0.82, 0.62, n.y) * 0.9;
      },
      (x, z) => {
        const s = 0.9 + r() * 1.8;
        ctx.place(x, z, s * 0.4);
        b.add(new THREE.DodecahedronGeometry(s, 0), [C.stone, C.stoneDark, C.granite2, C.stone][Math.floor(r() * 4)], M(x, s * 0.1, z, r() * 6, 1, r() * 0.4, r() * 0.4).multiply(MS(0, 0, 0, 1.2, 0.8 + r() * 0.5, 1)));
        ctx.solids.add(x, z, s * 0.8);
      },
    );
  }

  // ───────── Border: Thunderfang Cliffs behind the tower (rock pillars); elsewhere, pillar silhouettes and low trees on the crests
  const far: THREE.BufferGeometry[] = [];
  for (let i = 0; i < Math.round(170 * k); i++) {
    const a = r() * Math.PI * 2;
    const d = S * (0.84 + r() * 0.2);
    const x = Math.max(-S + 2, Math.min(S - 2, Math.cos(a) * d * 1.25));
    const z = Math.max(-S + 2, Math.min(S - 2, Math.sin(a) * d * 1.25));
    const m = edgeMetric(x, z);
    if (m < S - 20) continue;
    const y = ctx.h(x, z);
    if (z < -S + 40 && r() < 0.8) {
      // Thunderfangs: jagged rock pillars (two or three stacked, each tilted a bit differently)
      let hh = 5 + r() * 8;
      let w = 2 + r() * 1.8;
      let yy = -1;
      b.lift = y;
      for (let j = 0; j < 3 && hh > 1.5; j++) {
        b.add(new THREE.CylinderGeometry(w * 0.55, w, hh, 5), [C.stoneDark, C.stone, 0x565a78][(i + j) % 3], M(x + (r() - 0.5) * 0.6, yy + hh / 2, z + (r() - 0.5) * 0.6, r() * 6, 1, (r() - 0.5) * 0.18, (r() - 0.5) * 0.18), false);
        yy += hh * 0.92;
        w *= 0.55;
        hh *= 0.55;
      }
    } else if (r() < 0.35) {
      const hh = 3.5 + r() * 4;
      b.lift = y - 0.5;
      b.add(new THREE.CylinderGeometry(0.34, 0.55, hh, 6), 0x5a5e80, M(x, hh / 2, z, r() * 6, 1, (r() - 0.5) * 0.1), false);
      b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 6), C.bronze, M(x, hh * 0.8, z), false);
      if (r() < 0.8) far.push(new THREE.OctahedronGeometry(0.3).applyMatrix4(M(x, y - 0.5 + hh + 0.4, z)));
    } else if (z > -S + 40 && Math.hypot(x - LONE[0], z - LONE[1]) > 52) {
      // Keep the ridgeline around the lone tree empty, so the lone tree is truly "lone"
      ctx.place(x, z, 1);
      bentTree(ctx, x, z, 1.1 + r() * 0.6);
    }
  }
  b.lift = 0;

  // ───────── Distant scenery: pillars, lone peaks and the campfires of other tribes beyond the map
  // Distant pillar groves: gathered in clusters, not stuck in everywhere
  for (let g = 0; g < 11; g++) {
    const a = (g / 11) * Math.PI * 2 + r() * 0.4;
    const d = 190 + r() * 260;
    const gx = Math.cos(a) * d;
    const gz = Math.sin(a) * d;
    const n = 4 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const x = gx + (r() - 0.5) * 34;
      const z = gz + (r() - 0.5) * 34;
      if (Math.max(Math.abs(x), Math.abs(z)) < S + 25) continue;
      const y = farHeight(x, z) - 1;
      const hh = 6 + r() * 9;
      b.add(new THREE.CylinderGeometry(0.7, 1.1, hh, 5), 0x4a4a66, M(x, y + hh / 2, z, r() * 6, 1, (r() - 0.5) * 0.12), false);
      if (r() < 0.7) far.push(new THREE.OctahedronGeometry(0.55).applyMatrix4(M(x, y + hh + 0.7, z)));
    }
  }
  // Distant low hills (flattened mounds, left to the fog)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3;
    const d = 330 + r() * 200;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = farHeight(x, z) - 6;
    b.add(new THREE.SphereGeometry(1, 14, 7), i % 2 ? 0x5e6048 : 0x535a44, M(x, y, z, r() * 6).multiply(MS(0, 0, 0, 60 + r() * 60, 14 + r() * 16, 40 + r() * 40)), false);
  }
  const camps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + i * 1.3 + r() * 0.3;
    const d = 200 + r() * 160;
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const y = farHeight(cx, cz);
    for (let j = 0; j < 4; j++) {
      const x = cx + (r() - 0.5) * 16;
      const z = cz + (r() - 0.5) * 16;
      b.add(new THREE.CylinderGeometry(2.6, 2.7, 1.8, 10), 0x8a7a68, M(x, y + 0.9, z), false);
      b.add(new THREE.ConeGeometry(3.0, 1.6, 10), 0x2a3060, M(x, y + 2.6, z), false);
    }
    camps.push(new THREE.SphereGeometry(1.2, 8, 6).applyMatrix4(M(cx, y + 0.8, cz)));
  }

  // ───────── Glowing things that breathe together
  const setRods = glowGroup(ctx.group, ctx.disposers, C.spark, glowRods);
  const setCable = glowGroup(ctx.group, ctx.disposers, 0x9ad0ff, glowCable);
  const setBolt = glowGroup(ctx.group, ctx.disposers, 0x9ad0ff, glowBolt);
  const setFar = glowGroup(ctx.group, ctx.disposers, C.spark, far);
  const setCamp = glowGroup(ctx.group, ctx.disposers, 0xff9a44, camps);

  let scarBoost = 0;
  let heartBoost = 0;
  let sparkT = 0;
  let festT = 0;
  const hot: [XZ, number][] = [
    [RODS, 28],
    [SCAR, 26],
    [HEART, 16],
    ...(calm ? [] : [[TOWER, 40] as [XZ, number]]),
  ];
  return {
    rodTips,
    ringTips,
    heartTip,
    scarTip,
    treeTip,
    surge: (w) => {
      if (w === 'scar') scarBoost = 1;
      else heartBoost = 1;
    },
    tick: (dt, t, flash, vfx) => {
      scarBoost = Math.max(0, scarBoost - dt * 0.7);
      heartBoost = Math.max(0, heartBoost - dt * 0.9);
      scarFx(t, flash, scarBoost);
      heartFx(t, flash, heartBoost);
      setRods(2.0 + Math.sin(t * 2.3) * 0.5 + flash * 2.5);
      setCable(1.6 + Math.sin(t * 5.1) * 0.35 + Math.sin(t * 13.7) * 0.25 + flash * 3);
      setBolt(1.8 + Math.sin(t * 1.7) * 0.4 + flash * 2);
      setFar(1.5 + flash * 2);
      setCamp(2.2 + Math.sin(t * 7) * 0.2);
      if (fest) {
        const fp = fest.flames.position;
        const near = Math.hypot(vfx.camPos.x - fp.x, vfx.camPos.z - fp.z) < 90;
        fest.flames.visible = near;
        if (near) {
          const n1 = Math.sin(t * 11.3) * 0.5 + Math.sin(t * 17.1 + 1.3) * 0.3 + Math.sin(t * 5.7 + 2.1) * 0.2;
          const n2 = Math.sin(t * 13.7 + 0.7) * 0.5 + Math.sin(t * 7.9 + 2.9) * 0.5;
          fest.parts[0].scale.set(1 + n2 * 0.12, 0.88 + n1 * 0.22, 1 - n2 * 0.12);
          fest.parts[1].scale.set(1 - n1 * 0.1, 0.9 + n2 * 0.25, 1 + n1 * 0.1);
          fest.parts[2].scale.set(1, 0.85 + n1 * 0.3, 1);
          fest.flames.rotation.y = t * 0.8;
          festT += dt;
          while (festT > 0.12) {
            festT -= 0.12;
            vfx.emit({ pos: V(fp.x, fp.y + 0.7, fp.z), count: 1, color: [0xffb040, 0xff7a20, 0xfff0a0], speed: [1.2, 2.8], dir: V(0.26, 1, 0.15), spread: 0.35, life: [0.7, 1.4], size: [0.06, 0.11], sizeEnd: 0.3, gravity: -0.6, drag: 0.6, radius: 0.25, intensity: 2 });
          }
        }
      }
      // Charged spots: small sparks crackling in the grass
      const cx = vfx.camPos.x;
      const cz = vfx.camPos.z;
      sparkT += dt;
      while (sparkT > 0.07) {
        sparkT -= 0.07;
        for (const [[hx, hz], R] of hot) {
          if (Math.hypot(cx - hx, cz - hz) > R + 30) continue;
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * R;
          const x = hx + Math.cos(a) * d;
          const z = hz + Math.sin(a) * d;
          if (Math.random() < 0.5) continue;
          vfx.emit({ pos: V(x, ctx.h(x, z) + 0.2 + Math.random() * 0.8, z), count: 1, color: [0xfff066, 0xffffff, 0xb8c8ff], speed: [0.3, 1.4], life: [0.1, 0.25], size: [0.08, 0.18], atlas: 1, intensity: 2.6 });
        }
      }
    },
  };
}

/** Undulation of the grassland beyond the map (shared by the distant props and the outer grassland) */
export function farHeight(x: number, z: number): number {
  const north = smooth(-S * 0.6, -S * 1.6, z);
  return 7 + north * 16 + 3 * Math.sin(x * 0.012 + 1.3) * Math.cos(z * 0.01 - 0.4) + 1.6 * Math.sin(x * 0.031 - z * 0.027);
}

