// Natural props for the field: bushes, fallen logs, reeds, water lilies, cliff boulders, glowing ground,
// light-pillar clusters; plus the scatter tool for the "forest mask".

import * as THREE from 'three';
import { M, pine, rock, tree } from '../arenaKit.ts';
import { farTree, lightShafts, softDiscTex, type Shaft } from '../arenas/_woods.ts';
import type { FieldCtx } from './kit.ts';

/** Bush: a few low-poly balls clustered together */
export function bush(ctx: FieldCtx, x: number, z: number, s: number, cols: number[]): void {
  const { b, r } = ctx;
  ctx.place(x, z, s * 0.5);
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = s * 0.45 * r();
    const rr = s * (0.45 + r() * 0.3);
    b.add(new THREE.IcosahedronGeometry(rr, 1), cols[i % cols.length], M(x + Math.cos(a) * d, rr * 0.7, z + Math.sin(a) * d, r() * 6, 1));
  }
}

/** Fallen log: a trunk lying on its side, with cut ends */
export function fallenLog(ctx: FieldCtx, x: number, z: number, len: number, bark: number, cut: number, moss?: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, len * 0.4);
  const a = r() * Math.PI;
  const rad = 0.35 + r() * 0.2;
  b.add(new THREE.CylinderGeometry(rad, rad * 1.1, len, 9), bark, M(x, rad * 0.9, z, a, 1, 0, Math.PI / 2));
  for (const s of [-1, 1]) b.add(new THREE.CircleGeometry(rad * 0.95, 9), cut, M(x + Math.cos(a) * s * len * 0.5, rad * 0.9, z - Math.sin(a) * s * len * 0.5, a + (s * Math.PI) / 2), false);
  if (moss !== undefined) {
    const g = new THREE.SphereGeometry(rad * 1.05, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2.5);
    g.scale(1, 0.5, len * 0.8);
    b.add(g, moss, M(x, rad * 1.2, z, a + Math.PI / 2), false);
  }
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let t = -0.4; t <= 0.4; t += 0.4) ctx.solids.add(x + ca * len * t, z - sa * len * t, rad + 0.3);
}

/** Reeds: a clump of slender stalks by the water, with plumes at the top */
export function reeds(ctx: FieldCtx, x: number, z: number, stem: number, head: number): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.3;
    const pz = z + (r() - 0.5) * 1.3;
    const h = 1.1 + r() * 0.9;
    const tilt = (r() - 0.5) * 0.25;
    b.add(new THREE.CylinderGeometry(0.025, 0.035, h, 4), stem, M(px, h / 2, pz, 0, 1, tilt, tilt), false);
    b.add(new THREE.CapsuleGeometry(0.06, 0.25, 3, 5), head, M(px + tilt * h * 0.5, h, pz - tilt * h * 0.5, 0, 1, tilt, tilt), false);
  }
}

/** Water lily: round leaves floating on the water and a few flowers */
export function lilyPads(ctx: FieldCtx, x: number, z: number, n: number, leaf: number, flower: number): void {
  const { b, r } = ctx;
  b.lift = ctx.waterLevel + 0.03;
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 7;
    const pz = z + (r() - 0.5) * 7;
    if (ctx.h(px, pz) > ctx.waterLevel - 0.3) continue;
    const s = 0.5 + r() * 0.5;
    b.add(new THREE.CylinderGeometry(s, s, 0.04, 12, 1, false, 0.3, Math.PI * 1.85), leaf, M(px, 0, pz, r() * 6), false);
    if (r() < 0.35) b.add(new THREE.ConeGeometry(0.16, 0.22, 6), flower, M(px, 0.12, pz, 0, 1, Math.PI), false);
  }
}

/** Boulder: a large rock, with collision */
export function boulder(ctx: FieldCtx, x: number, z: number, s: number, col: number): void {
  ctx.place(x, z, s * 0.5);
  rock(ctx.b, x, z, s, col, ctx.r);
  ctx.solids.add(x, z, s * 0.9);
}

/** A tree that can be bumped into (round tree or pine) */
export function solidTree(ctx: FieldCtx, x: number, z: number, s: number, kind: 'round' | 'pine', trunk: number, leaves: number[]): void {
  ctx.place(x, z, 0.3 * s);
  if (kind === 'round') tree(ctx.b, x, z, s, trunk, leaves, ctx.r);
  else pine(ctx.b, x, z, s, trunk, leaves[0]);
  ctx.solids.add(x, z, 0.38 * s);
}

/** Distant tree silhouettes on top of the cliff walls (no collision, no outline) */
export function ridgeTrees(ctx: FieldCtx, n: number, trunk: number, leaf: number, minH = 12): void {
  const S = ctx.layout.size;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ctx.r() * 0.2;
    const d = S * (0.93 + ctx.r() * 0.18);
    const x = Math.max(-S * 1.1, Math.min(S * 1.1, Math.cos(a) * d * 1.3));
    const z = Math.max(-S * 1.1, Math.min(S * 1.1, Math.sin(a) * d * 1.3));
    if (Math.max(Math.abs(x), Math.abs(z)) < S - 6) continue;
    ctx.place(Math.max(-S, Math.min(S, x)), Math.max(-S, Math.min(S, z)));
    farTree(ctx.b, x, z, 0.8 + ctx.r() * 0.5, minH + ctx.r() * 10, trunk, leaf, ctx.r);
  }
}

/** A soft round glow patch on the ground (mushroom ring, altar, magic circle), additive blending */
export function groundGlow(ctx: FieldCtx, x: number, z: number, rad: number, color: number, amt = 1): void {
  const tex = softDiscTex();
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(amt), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  // Hugs the terrain relief: uses a subdivided plane whose vertex heights are taken from the ground
  const g = new THREE.PlaneGeometry(rad * 2, rad * 2, 8, 8);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, ctx.h(x + p.getX(i), z + p.getZ(i)) + 0.06);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, 0, z);
  m.renderOrder = 2;
  ctx.group.add(m);
  ctx.disposers.push(() => {
    mat.dispose();
    tex.dispose();
    g.dispose();
  });
}

/** A cluster of light pillars, with their bases on the ground at (x, z) */
export function shaftsAt(ctx: FieldCtx, x: number, z: number, shafts: Shaft[], dir: THREE.Vector3, color: number, amt: number): void {
  const g = new THREE.Group();
  g.position.set(x, ctx.h(x, z) - 0.3, z);
  ctx.group.add(g);
  lightShafts(g, ctx.disposers, ctx.extras, shafts, dir, color, amt);
}

/**
 * Scatter points by a mask function: try n times over the whole map, where mask(x, z) is a 0-1 probability;
 * avoids roads, the town, the tower and so on (ctx.clear) and the water surface.
 */
export function scatterMask(ctx: FieldCtx, n: number, margin: number, mask: (x: number, z: number) => number, fn: (x: number, z: number) => void): void {
  const S = ctx.layout.size - 4;
  for (let i = 0; i < n; i++) {
    const x = (ctx.r() * 2 - 1) * S;
    const z = (ctx.r() * 2 - 1) * S;
    if (ctx.r() > mask(x, z)) continue;
    if (!ctx.clear(x, z, margin)) continue;
    if (ctx.h(x, z) < ctx.waterLevel + 0.4) continue;
    if (ctx.solids.blocked(x, z, margin * 0.5)) continue;
    fn(x, z);
  }
}

/** Distance ratio to the nearest area center (< 1 means inside the area); used to let the woods leave clearings */
export function inClearings(clearings: [number, number, number][], x: number, z: number): number {
  let m = Infinity;
  for (const [cx, cz, cr] of clearings) m = Math.min(m, Math.hypot(x - cx, z - cz) / cr);
  return m;
}
