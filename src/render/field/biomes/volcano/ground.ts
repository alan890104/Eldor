// Ground layer of the Emberspine Volcanic Belt: the whole map is laid down cell by cell on a jittered grid,
// with a different set of things per zone.
//   Cold lava plain: cracked lava crust slabs (red light showing through the seams), ropy lava folds, raised tumuli,
//     pressure ridges, small hornitos, tree molds;
//   Lava shore: obsidian blades, still-hot crust slabs and lava bombs, fumaroles;
//   Northern plateau: lava bombs thrown from the main peak (each leaves a ring of scorching where it lands), sulfur vents,
//     burnt-out stumps;
//   Ash plain: ash drifts, lapilli, emberbell flowers, charred thornbushes, stumps and fallen charred logs, lichen-covered rocks,
//     small animal bones;
//   Cliff foot: fallen boulders and slanted basalt columns.
// Under every cell a pinch of lapilli or rubble is laid as well, so the ground is not one flat wash. Last comes an edging along
// the roads (curbstones, cairn waymarkers, emberbell flowers).
// Positions that smoke, throw sparks or glow are collected into GroundOut and handed to the particles and the ground light pools.

import * as THREE from 'three';
import { V } from '../../../arenas/_woods.ts';
import { smooth } from '../../compose.ts';
import { Solids, type FieldCtx, type XZ } from '../../kit.ts';
import * as SH from './shape.ts';
import { COL, pebbles } from './props.ts';
import { G, LAPILLI, MX, SCREE, Stains, T, TALUS, glow, lean, lensZone, onSlope, put } from './tmpl.ts';

/** A pool of light on the ground */
export interface Pool {
  x: number;
  z: number;
  r: number;
  color: number;
  amt: number;
}

export interface GroundOut {
  /** White smoke from small fumaroles */
  wisps: THREE.Vector3[];
  /** Mouths of small hornitos (throw sparks, now and then splash lava) */
  spatter: THREE.Vector3[];
  /** Still-hot lava bombs and crust slabs (give off the odd ember) */
  hot: THREE.Vector3[];
  /** Ground light pools */
  pools: Pool[];
  /** Small hornitos (heat-haze curtain) */
  cones: [number, number, number][];
  /** Ground stains (scorch marks, rust), written into the terrain's vertex colors at the very end */
  stains: Stains;
  /**
   * Rubble is piled at the foot of these (crust slabs, lava bombs, tumuli, hornitos; also those without colliders): x, z, radius
   */
  rubble: [number, number, number][];
}

const TAU = Math.PI * 2;

// ───────────────────────── Small props ─────────────────────────

/** A pinch of lapilli (fingertip-sized gravel) */
export function lapilli(ctx: FieldCtx, x: number, z: number, s: number, col: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  put(b, LAPILLI[Math.floor(r() * 4)], col, MX(x, 0, z, s, s, s, r() * TAU), false);
}

/** A few stones, fist- to watermelon-sized */
export function scree(ctx: FieldCtx, x: number, z: number, s: number, col: number, outline = false): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z) - 0.04 * s;
  put(b, SCREE[Math.floor(r() * 4)], col, MX(x, 0, z, s, s, s, r() * TAU), outline);
}

/** Fallen blocks at a cliff foot (the big ones have colliders) */
export function talus(ctx: FieldCtx, x: number, z: number, s: number, col: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, s);
  b.lift -= 0.12 * s;
  put(b, TALUS[Math.floor(r() * 3)], col, MX(x, 0, z, s, s, s, r() * TAU));
  if (s > 1.05) ctx.solids.add(x, z, 0.9 * s);
}

/**
 * Volcanic ash piled up by the wind: a pale gray wash on the ground (painted on the terrain); on flat ground a low,
 * flat pile is added on top, hugging the ground (on slopes a flat pile looks like a pasted-on color patch, so none there)
 */
export function ashDrift(ctx: FieldCtx, x: number, z: number, R: number, stains: Stains): void {
  const { b, r } = ctx;
  b.lift = 0;
  stains.add(x, z, R * 1.3, G.ashL, 0.45);
  if (slopeAt(ctx, x, z) > 0.12) return;
  const y = ctx.h(x, z) - 0.08 * R;
  const ry = r() * TAU;
  put(b, T.ico, r() < 0.6 ? G.ash : G.ashL, onSlope(ctx, x, z, y, R * 0.85, 0.16 + r() * 0.08, R * (0.5 + r() * 0.3), ry), false);
  if (r() < 0.6) {
    const a = ry + (r() - 0.5) * 1.5;
    const px = x + Math.cos(a) * R * 0.8;
    const pz = z - Math.sin(a) * R * 0.8;
    put(b, T.ico, G.ashD, onSlope(ctx, px, pz, ctx.h(px, pz) - 0.05 * R, R * 0.5, 0.12, R * 0.4, ry + 0.7), false);
  }
}

/**
 * Cracked lava crust slabs: flat five- and six-sided slabs crowded together, some with edges tilted up; with hot set,
 * the seams show lava still glowing red underneath; with moss set, moss grows on the slabs
 */
export function plates(ctx: FieldCtx, x: number, z: number, s: number, hot: boolean, out: GroundOut, moss = false): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  const n = 4 + Math.floor(r() * 4);
  const cols = [G.basalt, G.basalt2, G.crust];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = i === 0 ? 0 : (0.45 + r() * 0.75) * s;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const rad = (0.38 + r() * 0.36) * s;
    const th = (0.12 + r() * 0.1) * s;
    const up = r() < 0.2 ? 0.28 + r() * 0.2 : (r() - 0.5) * 0.18;
    const gy = ctx.h(px, pz) - b.lift;
    put(b, r() < 0.5 ? T.hex : T.pent, cols[i % 3], MX(px, gy + th * 0.25 + Math.abs(up) * rad * 0.4, pz, rad, th, rad * (0.8 + r() * 0.3), r() * TAU, up, (r() - 0.5) * 0.12));
    // After purification: small tufts of moss grow on top of the slabs (puffed-up cushions, not flat color patches)
    if (moss && r() < 0.45) {
      const my = gy + th * 0.55 + Math.abs(up) * rad * 0.4;
      for (let k = 0; k < 3; k++) {
        const ma = r() * TAU;
        const md = r() * rad * 0.3;
        const ms = rad * (0.12 + r() * 0.08);
        put(b, T.ico, k === 1 ? G.mossL : G.moss, MX(px + Math.cos(ma) * md, my, pz + Math.sin(ma) * md, ms, ms * 0.7, ms, r() * TAU), false);
      }
    }
  }
  out.rubble.push([x, z, 0.9 * s]);
  if (hot && !moss) {
    // The dull red showing through under the seams: a few thin cracks radiating from the middle, mostly pressed under the slabs
    const a0 = r() * TAU;
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k / 3) * TAU + (r() - 0.5) * 0.6;
      const len = (0.7 + r() * 0.5) * s;
      glow(b, T.box, G.seam, onSlope(ctx, x + Math.cos(a) * len * 0.45, z + Math.sin(a) * len * 0.45, 0.03, len, 0.03, 0.07 * s, -a));
    }
    out.stains.add(x, z, s * 2.4, G.scorch, 0.55);
  }
}

/** Ropy lava: ripples of folds pushed forward ring by ring (half-buried flat arcs) */
export function ropes(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  const dir = r() * TAU;
  const n = 3 + Math.floor(r() * 3);
  // The arc's center is behind: the folds bow out in the flow direction
  const cx = x - Math.cos(dir) * 0.9 * s;
  const cz = z + Math.sin(dir) * 0.9 * s;
  for (let k = 0; k < n; k++) {
    const R = (0.7 + k * 0.32) * s;
    put(b, T.arc, k % 2 ? G.basalt2 : G.crust, MX(cx, 0.02, cz, R, R * 0.45, R, dir - Math.PI * 0.35 + (r() - 0.5) * 0.2), false);
  }
}

/** Obsidian blades: a few slabs of black glass stuck slantwise in the ground */
export function shards(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z) - 0.1 * s;
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const tilt = 0.15 + r() * 0.45;
    const len = (0.55 + r() * 0.65) * s * (i === 0 ? 1.25 : 1);
    const base = V(x + Math.cos(a) * 0.18 * s * i, 0, z + Math.sin(a) * 0.18 * s * i);
    put(b, T.oct, i === 1 ? G.obsidianL : r() < 0.25 ? G.obsidianG : G.obsidian, lean(base.x, 0, base.z, a, tilt, len, (0.09 + r() * 0.07) * s, (0.22 + r() * 0.12) * s, 2));
  }
  if (s > 0.9) ctx.solids.add(x, z, 0.45 * s);
}

/**
 * Lava bomb: a rock thrown from the main peak, its shell cracked like bread crust;
 * it leaves a ring of scorching and fragments where it landed.
 * Returns whether it is still hot
 */
export function bomb(ctx: FieldCtx, x: number, z: number, s: number, hot: boolean, out: GroundOut): void {
  const { b, r } = ctx;
  ctx.place(x, z, s * 0.6);
  const ry = r() * TAU;
  const sink = 0.22 * s;
  put(b, T.dod, r() < 0.5 ? G.crust : G.scoriaD, MX(x, s * 0.62 - sink, z, s * 1.12, s * 0.8, s, ry, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
  // Bread-crust cracks
  for (let k = 0; k < 3; k++) {
    const a = ry + k * 1.05 + (r() - 0.5) * 0.4;
    const m = MX(x, s * 1.14 - sink, z, s * 1.5, 0.05, 0.07, a, 0, (r() - 0.5) * 0.3);
    if (hot) glow(b, T.box, k === 1 ? G.fire : G.ember, m);
    else put(b, T.box, G.scorch, m, false);
  }
  // Scorch marks from the impact (ground stains) and fragments (now placed at absolute height)
  out.stains.add(x, z, 1.2 + s * 2.2, G.scorch, 0.8);
  out.rubble.push([x, z, s]);
  b.lift = 0;
  for (let k = 0; k < 5; k++) {
    const a = r() * TAU;
    const d = (1.4 + r() * 1.3) * s;
    const fs = (0.08 + r() * 0.12) * s;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    put(b, T.tet, G.crust, MX(px, ctx.h(px, pz) + fs * 0.2, pz, fs, fs * 0.8, fs, r() * TAU, r(), r()), false);
  }
  if (s > 0.5) ctx.solids.add(x, z, 0.95 * s);
  if (hot) {
    out.hot.push(V(x, ctx.h(x, z) + s * 1.0, z));
    out.pools.push({ x, z, r: 1.8 + s * 2.2, color: 0xff6a24, amt: 0.35 + s * 0.2 });
  }
}

/**
 * Sulfur vent: rust-colored ground, a low mound crusted with sulfur, a ring of white silica sinter,
 * and a black opening giving off white smoke
 */
export function fumarole(ctx: FieldCtx, x: number, z: number, s: number, out: GroundOut, moss = false): void {
  const { b, r } = ctx;
  // On a slope: a flat sulfur-bloom mound would sink half into the slope and show only a slanted yellow patch;
  // make it a smoking crack instead, with the sulfur bloom painted only on the ground
  if (slopeAt(ctx, x, z) > 0.2) {
    b.lift = ctx.h(x, z);
    out.stains.add(x, z, 2.2 * s, G.oxide, 0.6);
    out.stains.add(x, z, 1.1 * s, G.sulfur, 0.5);
    const a = r() * TAU;
    put(b, T.box, 0x120a0c, onSlope(ctx, x, z, 0.01, 0.9 * s, 0.05, 0.12 * s, a), false);
    for (let k = 0; k < 3; k++) {
      const d = (k - 1) * 0.35 * s;
      glow(b, T.oct, G.sulfurG, onSlope(ctx, x + Math.cos(-a) * d, z + Math.sin(-a) * d, 0.05, 0.04 * s, 0.09 * s, 0.04 * s, r() * TAU));
    }
    out.wisps.push(V(x, b.lift + 0.12, z));
    return;
  }
  ctx.place(x, z, 0.7 * s);
  const ry = r() * TAU;
  // A ring of rust color all around, sulfur yellow near the opening (ground stains)
  out.stains.add(x, z, 2.6 * s, G.oxide, 0.65);
  out.stains.add(x, z, 1.3 * s, G.sulfur, 0.55);
  put(b, T.hexT, G.sulfurL, MX(x, 0.06 * s, z, 0.55 * s, 0.26 * s, 0.55 * s, ry));
  const top = 0.19 * s;
  put(b, T.torus, G.sinter, MX(x, top, z, 0.36 * s, 0.9 * s, 0.36 * s, ry), false);
  put(b, T.disc, 0x120a0c, MX(x, top + 0.01, z, 0.3 * s, 1, 0.3 * s), false);
  glow(b, T.disc, G.ember, MX(x, top + 0.005, z, 0.13 * s, 1, 0.13 * s));
  for (let k = 0; k < 5; k++) {
    const a = ry + (k / 5) * TAU + r() * 0.5;
    const d = (0.5 + r() * 0.35) * s;
    glow(b, T.oct, G.sulfurG, MX(x + Math.cos(a) * d, top * 0.6, z + Math.sin(a) * d, 0.05 * s, (0.1 + r() * 0.08) * s, 0.05 * s, r() * TAU, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8));
  }
  if (moss) for (let k = 0; k < 4; k++) {
    const a = r() * TAU;
    const d = (1.0 + r() * 0.5) * s;
    put(b, T.ico, k % 2 ? G.moss : G.mossL, MX(x + Math.cos(a) * d, 0.02, z + Math.sin(a) * d, 0.22 * s, 0.08 * s, 0.18 * s, r() * TAU), false);
  }
  if (s > 0.9) ctx.solids.add(x, z, 0.55 * s);
  out.wisps.push(V(x, b.lift + top + 0.1, z));
  out.pools.push({ x, z, r: 1.6 * s, color: 0xffc050, amt: 0.18 });
}

/** Hornito: lava slag spattered up glob by glob; the opening on top still glows and throws sparks */
export function hornito(ctx: FieldCtx, x: number, z: number, s: number, out: GroundOut): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1.1 * s);
  const cols = [G.scoriaD, G.scoria, G.crust, G.scoria2];
  let y = 0;
  let R = 1.25 * s;
  let ox = 0;
  let oz = 0;
  for (let k = 0; k < 4; k++) {
    const hh = R * (0.62 + r() * 0.15);
    put(b, T.dod, cols[k], MX(x + ox, y + hh * 0.35, z + oz, R, hh, R * (0.85 + r() * 0.2), r() * TAU));
    // Each glob stacked on top shrinks upward and leans a little to one side
    y += hh * 0.72;
    R *= 0.72;
    ox += (r() - 0.5) * 0.16 * s;
    oz += (r() - 0.5) * 0.16 * s;
  }
  const top = y + R * 0.3;
  put(b, T.torus, G.scoriaD, MX(x + ox, top, z + oz, R * 1.15, 2.2, R * 1.15));
  glow(b, T.disc, G.ember, MX(x + ox, top + 0.02, z + oz, R * 0.95, 1, R * 0.95));
  glow(b, T.disc, G.fire, MX(x + ox, top + 0.04, z + oz, R * 0.5, 1, R * 0.5));
  // Two or three streams of overflowed lava run down the cone wall
  for (let k = 0; k < 3; k++) {
    const a = r() * TAU;
    const len = top * (0.45 + r() * 0.35);
    const base = V(x + ox + Math.cos(a) * R * 0.9, top - len - 0.05, z + oz + Math.sin(a) * R * 0.9);
    glow(b, T.box, k ? G.ember : G.emberL, lean(base.x, base.y, base.z, a, 0.45 + r() * 0.2, len * 1.1, 0.12 + r() * 0.06, 0.07));
  }
  ctx.solids.add(x, z, 1.05 * s);
  out.stains.add(x, z, 3.6 * s, G.scoriaD, 0.6);
  out.rubble.push([x, z, 1.2 * s]);
  const wy = b.lift + top;
  out.spatter.push(V(x + ox, wy + 0.1, z + oz));
  out.pools.push({ x, z, r: 3.2 * s, color: 0xff5a1a, amt: 0.5 });
  out.cones.push([x + ox, wy - top, z + oz]);
}

/**
 * Tumulus: a low rounded mound where the crust has been pushed up by lava underneath; it splits open on top, showing red light
 */
export function tumulus(ctx: FieldCtx, x: number, z: number, R: number, out: GroundOut): void {
  const { b, r } = ctx;
  ctx.place(x, z, R * 0.8);
  const H = R * (0.3 + r() * 0.1);
  const ry = r() * TAU;
  b.lift -= H * 0.25;
  put(b, T.ico1, G.basalt, MX(x, 0, z, R, H, R * (0.75 + r() * 0.25), ry));
  // The split on top: three cracks radiating from the center
  for (let k = 0; k < 3; k++) {
    const a = ry + (k / 3) * TAU + (r() - 0.5) * 0.6;
    const len = R * (0.8 + r() * 0.4);
    const px = x + Math.cos(a) * len * 0.42;
    const pz = z - Math.sin(a) * len * 0.42;
    glow(b, T.box, k ? G.ember : G.emberL, MX(px, H * 0.9, pz, len, 0.08, 0.16, a, 0, -0.18));
    put(b, T.box, G.crust, MX(px, H * 0.92, pz, len * 0.9, 0.1, 0.42, a, 0, -0.18));
  }
  // Crust slabs scattered at the mound's foot
  for (let k = 0; k < 4; k++) {
    const a = r() * TAU;
    const px = x + Math.cos(a) * R * 1.05;
    const pz = z + Math.sin(a) * R * 1.05;
    const rad = 0.3 + r() * 0.3;
    b.lift = ctx.h(px, pz);
    put(b, T.pent, G.basalt2, MX(px, 0.05, pz, rad, 0.14, rad, r() * TAU, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
  }
  ctx.solids.add(x, z, R * 0.78);
  out.hot.push(V(x, ctx.h(x, z) + H * 0.8, z));
  out.rubble.push([x, z, R]);
  out.pools.push({ x, z, r: R * 1.4, color: 0xff6a24, amt: 0.28 });
}

/** Pressure ridge: a whole row of crust slabs squeezed up and tilted (along direction a, length len) */
export function pressureRidge(ctx: FieldCtx, x: number, z: number, len: number, a: number): void {
  const { b, r } = ctx;
  const n = Math.max(3, Math.round(len / 0.9));
  const dx = Math.cos(a);
  const dz = -Math.sin(a);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) - 0.5) * len;
    const px = x + dx * t + (r() - 0.5) * 0.3;
    const pz = z + dz * t + (r() - 0.5) * 0.3;
    b.lift = ctx.h(px, pz);
    const k = 1 - Math.abs(t / len) * 1.2;
    const side = i % 2 ? 1 : -1;
    put(b, T.box, i % 3 ? G.basalt : G.basalt2, MX(px, 0.25 * k, pz, 0.95 + r() * 0.3, 0.2, 0.8 + r() * 0.4, a, side * (0.55 + r() * 0.35) * Math.max(0.4, k), (r() - 0.5) * 0.3));
    if (i % 2 === 0) ctx.solids.add(px, pz, 0.6);
  }
}

/** Lava tree mold: lava wrapped the trunk and cooled, then the tree burned away, leaving only a stone tube */
export function treeMold(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.8 * s);
  const H = (1.0 + r() * 0.8) * s;
  const tilt = (r() - 0.5) * 0.16;
  put(b, T.cyl7, G.basalt2, MX(x, H / 2 - 0.15, z, 0.55 * s, H, 0.55 * s, r() * TAU, tilt, tilt * 0.5));
  put(b, T.torus, G.basaltL, MX(x, H - 0.12, z, 0.48 * s, 1.2, 0.48 * s, 0, tilt, tilt * 0.5));
  put(b, T.disc, 0x0c0809, MX(x, H - 0.13, z, 0.4 * s, 1, 0.4 * s, 0, tilt, tilt * 0.5), false);
  // The burnt-out tree core inside the stone tube
  put(b, T.cyl5, G.char, MX(x, H - 0.1, z, 0.15 * s, 0.5 * s, 0.15 * s, r() * TAU, tilt));
  for (let k = 0; k < 4; k++) {
    const a = r() * TAU;
    put(b, T.dod, k % 2 ? G.basalt : G.crust, MX(x + Math.cos(a) * 0.62 * s, 0.1, z + Math.sin(a) * 0.62 * s, 0.38 * s, 0.26 * s, 0.34 * s, r() * TAU));
  }
  ctx.solids.add(x, z, 0.7 * s);
}

/** Charred stump: ragged broken top, roots showing above ground, some with the break still smoldering */
export function stump(ctx: FieldCtx, x: number, z: number, s: number, embers: boolean, out: GroundOut): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.35 * s);
  const H = (0.45 + r() * 0.55) * s;
  const ry = r() * TAU;
  put(b, T.hexT, G.char, MX(x, H / 2 - 0.05, z, 0.3 * s, H, 0.3 * s, ry));
  for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
    const a = ry + k * 2.1 + r() * 0.5;
    put(b, T.cone3, k % 2 ? G.charL : G.char, lean(x + Math.cos(a) * 0.14 * s, H - 0.08, z + Math.sin(a) * 0.14 * s, a, 0.1 + r() * 0.2, (0.2 + r() * 0.3) * s, 0.09 * s, 0.07 * s));
  }
  for (let k = 0; k < 3; k++) {
    const a = ry + (k / 3) * TAU + r() * 0.6;
    put(b, T.cyl5, G.char, lean(x, 0.12 * s, z, a, 1.25, 0.7 * s, 0.08 * s, 0.08 * s));
  }
  out.stains.add(x, z, 1.6 * s, G.ash, 0.35);
  if (embers) {
    glow(b, T.disc, G.ember, MX(x, H - 0.03, z, 0.2 * s, 1, 0.2 * s));
    out.hot.push(V(x, b.lift + H, z));
  }
  if (r() < 0.35) fireCaps(ctx, x + 0.35 * s, z + 0.1, 3, s);
  ctx.solids.add(x, z, 0.4 * s);
}

/** Fallen charred log: embers still show in the cracks, the broken end smolders */
export function charLog(ctx: FieldCtx, x: number, z: number, len: number, a: number, out: GroundOut): void {
  const { b, r } = ctx;
  const rad = 0.26 + r() * 0.12;
  const dx = Math.cos(a);
  const dz = -Math.sin(a);
  // Lies slanted along the ground's rise and fall (a level log on a slope would hang in the air at one end and sink in at the
  // other, looking like a black board)
  const h0 = ctx.h(x - dx * len * 0.45, z - dz * len * 0.45);
  const h1 = ctx.h(x + dx * len * 0.45, z + dz * len * 0.45);
  const p = Math.atan2(h0 - h1, len * 0.9);
  const sp = Math.sin(p);
  const yc = (h0 + h1) / 2 + rad * 0.6;
  b.lift = 0;
  put(b, T.cyl7, G.char, MX(x, yc, z, rad, len, rad, a, 0, Math.PI / 2 - p));
  // The break: one end is jagged splintered wood, the other smolders
  put(b, T.cone3, G.charL, MX(x + dx * len * 0.52, yc - sp * len * 0.52, z + dz * len * 0.52, rad * 0.8, rad * 1.4, rad * 0.8, a, 0, -Math.PI / 2 - p));
  glow(b, T.disc, G.ember, MX(x - dx * (len * 0.5 + 0.01), yc + sp * (len * 0.5 + 0.01), z - dz * (len * 0.5 + 0.01), rad * 0.7, 1, rad * 0.7, a, 0, Math.PI / 2 - p));
  for (let k = 0; k < 3; k++) {
    const t = (r() - 0.5) * len * 0.75;
    glow(b, T.box, k === 1 ? G.emberL : G.ember, MX(x + dx * t, yc - sp * t + rad * 0.9, z + dz * t, len * (0.1 + r() * 0.12), 0.04, 0.05, a + (r() - 0.5) * 0.3, 0, -p));
  }
  // Flame mushrooms on the bark
  if (r() < 0.6) {
    const t = (r() - 0.5) * len * 0.6;
    fireCaps(ctx, x + dx * t, z + dz * t, 3, 1, yc - sp * t + rad * 0.85);
  }
  for (let t = -0.4; t <= 0.41; t += 0.4) ctx.solids.add(x + dx * len * t, z + dz * len * t, rad + 0.25);
  out.hot.push(V(x - dx * len * 0.5, yc + sp * len * 0.5, z - dz * len * 0.5));
}

/**
 * Flame mushroom: a small mushroom growing on charred wood, with a ring of orange light under the cap (y is absolute height,
 * default on the ground)
 */
export function fireCaps(ctx: FieldCtx, x: number, z: number, n: number, s: number, y?: number): void {
  const { b, r } = ctx;
  b.lift = y ?? ctx.h(x, z);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = r() * 0.25 * s;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const hh = (0.08 + r() * 0.1) * s;
    const cr = (0.06 + r() * 0.06) * s;
    put(b, T.cyl5, G.boneD, MX(px, hh / 2, pz, 0.022 * s, hh, 0.022 * s), false);
    put(b, T.half, i % 2 ? G.capL : G.capD, MX(px, hh, pz, cr, cr * 0.6, cr), false);
    glow(b, T.disc, G.gill, MX(px, hh - 0.005, pz, cr * 0.8, 1, cr * 0.8, 0, Math.PI));
  }
}

/** Emberbell flower: a heat-hardy small flower, a thin dark red stem topped with a glowing bell */
export function emberBells(ctx: FieldCtx, x: number, z: number, n: number, bright = false): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  const bells = bright ? [G.fire, G.gold, G.emberL] : [G.emberL, G.fire, G.ember];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.65;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const gy = ctx.h(px, pz) - b.lift;
    const hh = 0.28 + r() * 0.32;
    const la = r() * TAU;
    const tilt = r() * 0.25;
    put(b, T.stem, i % 2 ? G.stem : G.stemL, lean(px, gy, pz, la, tilt, hh, 0.018, 0.018), false);
    // Two leaves at the base
    for (let k = 0; k < 2; k++) put(b, T.tet, G.stemL, MX(px, gy + 0.03, pz, 0.12, 0.02, 0.045, la + k * Math.PI + r() * 0.5), false);
    const tx = px + Math.sin(tilt) * Math.cos(la) * hh;
    const tz = pz + Math.sin(tilt) * Math.sin(la) * hh;
    const ty = gy + Math.cos(tilt) * hh;
    glow(b, T.cone6, bells[i % 3], MX(tx, ty - 0.02, tz, 0.055, 0.11, 0.055, r() * TAU));
  }
}

/** Charred thornbush: a burnt-out dry shrub, thin twigs bursting outward, an occasional spark hanging at a twig tip */
export function thornBush(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z) - 0.05;
  const n = 7 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.5;
    const tilt = 0.3 + r() * 0.65;
    const len = (0.5 + r() * 0.6) * s;
    put(b, T.cone3, i % 3 ? G.dry : G.dryL, lean(x, 0, z, a, tilt, len, 0.035 * s, 0.035 * s), false);
    if (r() < 0.2) {
      const tip = V(x + Math.sin(tilt) * Math.cos(a) * len, Math.cos(tilt) * len, z + Math.sin(tilt) * Math.sin(a) * len);
      if (r() < 0.5) glow(b, T.oct, G.ember, MX(tip.x, tip.y, tip.z, 0.04, 0.04, 0.04));
      else put(b, T.ico, G.berry, MX(tip.x, tip.y, tip.z, 0.05, 0.05, 0.05), false);
    }
  }
}

/** Lichen-covered rock: patches of rust orange, sulfur yellow and gray-green */
export function lichenRock(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, s * 0.6);
  const ry = r() * TAU;
  const sink = 0.2 * s;
  put(b, T.dod, r() < 0.4 ? G.ash : r() < 0.5 ? G.scoria : G.basaltL, MX(x, s * 0.5 - sink, z, s * 1.15, s * 0.72, s, ry, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
  const lc = [G.lichenO, G.lichenY, G.lichenG];
  for (let k = 0; k < 2; k++) {
    const a = ry + k * 2.4;
    put(b, T.disc, lc[Math.floor(r() * 3)], MX(x + Math.cos(a) * s * 0.3, s * 1.02 - sink - k * 0.08 * s, z + Math.sin(a) * s * 0.3, s * (0.35 + r() * 0.2), 1, s * (0.25 + r() * 0.15), r() * TAU, (r() - 0.5) * 0.3), false);
  }
  if (s > 0.55) ctx.solids.add(x, z, 0.9 * s);
}

/**
 * A patch of lichen on the ground: a small cluster of spots of different sizes, each one hugging the ground right where it sits
 * (a big disc on a slope would sink half in and look like a stripe of color)
 */
export function lichen(ctx: FieldCtx, x: number, z: number, s: number, col: number, stains: Stains): void {
  const { b, r } = ctx;
  // The big wash of color is painted on the terrain (ragged edge, blended into the ground);
  // only a few raised lichen crusts stand in the middle, no flat color patches
  stains.add(x, z, 0.8 + s * 0.4, col, 0.32);
  b.lift = 0;
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.45 * s;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const rr = (0.05 + r() * 0.07) * s;
    put(b, T.ico, i % 3 === 2 ? G.lichenG : col, onSlope(ctx, px, pz, ctx.h(px, pz) + 0.01, rr, rr * 0.45, rr * (0.6 + r() * 0.4), r() * TAU), false);
  }
}

/** Bones of a small animal: a half-buried skull and a few ribs */
export function bones(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  const ry = r() * TAU;
  put(b, T.dod, G.bone, MX(x, 0.1 * s, z, 0.22 * s, 0.16 * s, 0.3 * s, ry, 0.2));
  for (const k of [-1, 1]) put(b, T.cone4, G.boneD, MX(x + Math.cos(ry) * k * 0.14 * s, 0.24 * s, z - Math.sin(ry) * k * 0.14 * s, 0.05 * s, 0.3 * s, 0.05 * s, ry, 0, k * 0.8));
  for (let i = 0; i < 4; i++) {
    const t = 0.55 + i * 0.22;
    put(b, T.arcV, G.bone, MX(x + Math.sin(ry) * t * s, -0.08 * s, z + Math.cos(ry) * t * s, 0.35 * s, 0.35 * s, 0.35 * s, ry + Math.PI / 2 + (r() - 0.5) * 0.3, 0, 0.3), false);
  }
}

/** Slanted basalt column: a broken hexagonal column stuck slantwise in the ground, with the broken-off piece lying beside it */
export function leaningColumn(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.5 * s);
  const a = r() * TAU;
  const tilt = 0.2 + r() * 0.35;
  const len = (2.2 + r() * 1.8) * s;
  const rad = (0.38 + r() * 0.12) * s;
  put(b, T.hex, r() < 0.5 ? 0x3a2f36 : 0x463a42, lean(x, -0.4, z, a, tilt, len, rad, rad));
  const px = x + Math.cos(a) * (len * Math.sin(tilt) + 1.2 * s);
  const pz = z + Math.sin(a) * (len * Math.sin(tilt) + 1.2 * s);
  b.lift = ctx.h(px, pz);
  put(b, T.hex, 0x3a2f36, MX(px, rad * 0.85, pz, rad, (0.8 + r() * 0.6) * s, rad, a + 0.4, 0, Math.PI / 2));
  ctx.solids.add(x, z, rad + 0.25);
  ctx.solids.add(px, pz, rad + 0.2);
}

/** Cairn waymarker: a stack of flat stones, the top one weighing down a red cloth strip of the Knights */
export function cairn(ctx: FieldCtx, x: number, z: number, s: number, rag = true): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.4 * s);
  let y = 0;
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const w = (0.5 - i * 0.07) * s;
    const hh = (0.16 + r() * 0.06) * s;
    put(b, T.dod, i % 2 ? G.ash : G.basaltL, MX(x + (r() - 0.5) * 0.06, y + hh * 0.5, z + (r() - 0.5) * 0.06, w, hh, w * (0.8 + r() * 0.3), r() * TAU));
    y += hh * 0.9;
  }
  if (rag) put(b, T.box, 0xb02a22, MX(x, y - 0.02, z, 0.06, 0.02, 0.5 * s, r() * TAU, 0, 0.9), false);
  ctx.solids.add(x, z, 0.42 * s);
}

// ───────────────────────── Laying the whole map ─────────────────────────

/** Jittered grid: one random point per cell */
export function jitter(r: () => number, cell: number, lo: number, hi: number, fn: (x: number, z: number) => void): void {
  for (let gz = lo; gz < hi; gz += cell) for (let gx = lo; gx < hi; gx += cell) fn(gx + r() * cell, gz + r() * cell);
}

function segDist(px: number, pz: number, a: XZ, b: XZ): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz);
}

function slopeAt(ctx: FieldCtx, x: number, z: number): number {
  const h = ctx.h;
  return Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
}

/** The area where a landmark has its own dressing (the ground layer stays out) */
export function landmark(x: number, z: number): boolean {
  const d = (p: XZ) => Math.hypot(x - p[0], z - p[1]);
  return (
    SH.terraceMask(x, z) > 0.15 ||
    d(SH.COLONNADE) < 17 ||
    d(SH.SWORDS) < 15 ||
    d(SH.MESA) < 12.5 ||
    d(SH.CRATER) < 12 ||
    d(SH.GEYSER) < 15 ||
    d(SH.TOWN) < SH.WALL_R + 4 ||
    d(SH.MINE) < 9 ||
    // Dragon Skeleton
    Math.hypot(x - 47, z + 52) < 12 ||
    // The ramp up to the Phoenix Nest
    segDist(x, z, SH.MESA_RAMP[0], SH.MESA_RAMP[1]) < 5
  );
}

/**
 * pebbleN: the number of rubble piles the field layer used to scatter evenly
 * (now piled together with the underlying lapilli at the feet of rocks and crust slabs, and along the road edges)
 */
export function buildGround(ctx: FieldCtx, busy: Solids, stains: Stains, pebbleN = 0): GroundOut {
  const out: GroundOut = { wisps: [], spatter: [], hot: [], pools: [], cones: [], stains, rubble: [] };
  const { r, low } = ctx;
  const S = ctx.layout.size;
  const bloom = ctx.done >= ctx.floors;
  const cell = low ? 3.6 : 2.5;
  // Cap on the number of large props (too many turns the ground into a field of lumps)
  const cap = { tumulus: low ? 9 : 16, hornito: low ? 8 : 13, ridge: low ? 6 : 12, mold: low ? 5 : 9, log: low ? 14 : 26, column: low ? 10 : 18 };
  const used = { tumulus: 0, hornito: 0, ridge: 0, mold: 0, log: 0, column: 0 };
  const crossings = SH.getCrossings();
  // Large props have a count cap and must also keep apart (tumuli and hornitos must not crowd together)
  const big: [number, number, number][] = [];
  const room = (k: keyof typeof cap, x: number, z: number, rr: number) => {
    if (used[k] >= cap[k] || big.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < rr + br)) return false;
    big.push([x, z, rr]);
    used[k]++;
    return true;
  };

  const cand: [number, number, number, number][] = [];
  jitter(r, cell, -S + 8, S - 8, (x, z) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m > S - 13) return;
    if (!ctx.clear(x, z, 0.2)) return;
    const h = ctx.h(x, z);
    if (h < SH.LAVA + 0.45) return;
    if (landmark(x, z)) return;
    if (busy.blocked(x, z, 0.3)) return;
    if (crossings.some((c) => Math.hypot(x - c.c[0], z - c.c[1]) < 9)) return;
    const sl = slopeAt(ctx, x, z);
    if (sl > 1.1) return;
    const inSolid = ctx.solids.blocked(x, z, 0.35);
    const le = SH.lavaEdgeDist(x, z);
    // Zone weights
    const field = 1 - smooth(15, 28, Math.hypot(x - SH.FIELD[0], z - SH.FIELD[1]));
    const bank = 1 - smooth(3, 13, le);
    const north = smooth(-30, -52, z) * (1 - bank);
    const edge = smooth(S - 36, S - 20, m);
    const ash = Math.max(0, 1 - field - bank - north - edge * 0.7);

    // ── Underlying lapilli and rubble: note this cell now, and pile them up once the large props are placed,
    // weighted by closeness to rocks, crust slabs and road edges
    if (!inSolid) cand.push([x, z, ash, sl]);
    // No large props right in front of the camera
    if (inSolid || lensZone(ctx, x, z, 2.5)) return;

    // ── Main props: pick a zone by weight first, then pick the thing
    const tot = field + bank + north + edge + ash;
    let pick = r() * tot;
    const zone = (pick -= field) < 0 ? 'field' : (pick -= bank) < 0 ? 'bank' : (pick -= north) < 0 ? 'north' : (pick -= edge) < 0 ? 'edge' : 'ash';
    const u = r() * (low ? 1.5 : 1);
    const big1 = sl < 0.35;
    if (zone === 'field') {
      if (u < 0.2) plates(ctx, x, z, 0.9 + r() * 0.7, r() < 0.45, out, bloom);
      else if (u < 0.3) ropes(ctx, x, z, 0.9 + r() * 0.8);
      else if (u < 0.335 && big1 && room('tumulus', x, z, 5)) tumulus(ctx, x, z, 1.9 + r() * 1.3, out);
      else if (u < 0.36 && big1 && room('ridge', x, z, 3)) pressureRidge(ctx, x, z, 3.5 + r() * 3.5, r() * TAU);
      else if (u < 0.375 && big1 && room('hornito', x, z, 6)) hornito(ctx, x, z, 0.85 + r() * 0.5, out);
      else if (u < 0.42) shards(ctx, x, z, 0.6 + r() * 0.6);
      else if (u < 0.46) emberBells(ctx, x, z, 3 + Math.floor(r() * 3), bloom);
      else if (u < 0.49) bomb(ctx, x, z, 0.35 + r() * 0.5, r() < 0.6, out);
      else if (u < 0.51) fumarole(ctx, x, z, 0.7 + r() * 0.4, out, bloom);
      else if (u < 0.53 && field < 0.6 && big1 && room('mold', x, z, 2)) treeMold(ctx, x, z, 0.9 + r() * 0.4);
    } else if (zone === 'bank') {
      if (le < 1.2) return;
      if (u < 0.13) shards(ctx, x, z, 0.6 + r() * 0.7);
      else if (u < 0.24) plates(ctx, x, z, 0.8 + r() * 0.6, true, out);
      else if (u < 0.29) bomb(ctx, x, z, 0.25 + r() * 0.4, true, out);
      else if (u < 0.32) fumarole(ctx, x, z, 0.6 + r() * 0.4, out, bloom);
      else if (u < 0.335 && le > 4 && big1 && room('hornito', x, z, 6)) hornito(ctx, x, z, 0.8 + r() * 0.4, out);
      else if (u < 0.37) scree(ctx, x, z, 1.2 + r() * 0.6, G.crust, true);
    } else if (zone === 'north') {
      if (u < 0.08) bomb(ctx, x, z, 0.35 + r() * 0.75, r() < 0.35, out);
      else if (u < 0.14) plates(ctx, x, z, 0.8 + r() * 0.6, r() < 0.25, out, bloom);
      else if (u < 0.2) shards(ctx, x, z, 0.6 + r() * 0.7);
      else if (u < 0.24) fumarole(ctx, x, z, 0.7 + r() * 0.5, out, bloom);
      else if (u < 0.26 && big1 && room('tumulus', x, z, 5)) tumulus(ctx, x, z, 1.8 + r() * 1.2, out);
      else if (u < 0.272 && big1 && room('hornito', x, z, 6)) hornito(ctx, x, z, 0.8 + r() * 0.5, out);
      else if (u < 0.31) stump(ctx, x, z, 0.9 + r() * 0.5, r() < 0.4, out);
      else if (u < 0.34) emberBells(ctx, x, z, 3 + Math.floor(r() * 3), bloom);
      else if (u < 0.37) ashDrift(ctx, x, z, 1.2 + r() * 1.2, out.stains);
      else if (u < 0.385 && big1 && room('ridge', x, z, 3)) pressureRidge(ctx, x, z, 3 + r() * 3, r() * TAU);
      else if (u < 0.4) ropes(ctx, x, z, 0.8 + r() * 0.6);
    } else if (zone === 'edge') {
      if (u < 0.14) talus(ctx, x, z, 0.8 + r() * 0.8, r() < 0.5 ? G.basalt2 : G.crust);
      else if (u < 0.17 && room('column', x, z, 2.5)) leaningColumn(ctx, x, z, 0.9 + r() * 0.5);
      else if (u < 0.22) stump(ctx, x, z, 1 + r() * 0.5, false, out);
      else if (u < 0.27) thornBush(ctx, x, z, 0.9 + r() * 0.5);
      else if (u < 0.31) lichenRock(ctx, x, z, 0.5 + r() * 0.6);
    } else {
      if (u < 0.11) emberBells(ctx, x, z, 3 + Math.floor(r() * 4), bloom);
      else if (u < 0.18) ashDrift(ctx, x, z, 1.1 + r() * 1.4, out.stains);
      else if (u < 0.235) thornBush(ctx, x, z, 0.8 + r() * 0.6);
      else if (u < 0.28) lichenRock(ctx, x, z, 0.35 + r() * 0.55);
      else if (u < 0.31) stump(ctx, x, z, 0.8 + r() * 0.6, r() < 0.3, out);
      else if (u < 0.33) bomb(ctx, x, z, 0.3 + r() * 0.5, r() < 0.15, out);
      else if (u < 0.345 && big1 && room('log', x, z, 3)) charLog(ctx, x, z, 2.6 + r() * 2.4, r() * Math.PI, out);
      else if (u < 0.375) plates(ctx, x, z, 0.7 + r() * 0.5, false, out, bloom);
      else if (u < 0.395) fumarole(ctx, x, z, 0.6 + r() * 0.4, out, bloom);
      else if (u < 0.425) shards(ctx, x, z, 0.5 + r() * 0.5);
      else if (u < 0.432) bones(ctx, x, z, 0.9 + r() * 0.4);
      else if (u < 0.45 && sl > 0.25) talus(ctx, x, z, 0.7 + r() * 0.5, G.basalt2);
      else if (u < 0.47 && big1 && room('column', x, z, 3)) leaningColumn(ctx, x, z, 0.8 + r() * 0.4);
    }
  });

  rubble(ctx, cand, Math.round(cand.length * (low ? 0.45 : 0.8)), pebbleN, out);
  roadside(ctx, busy, out, bloom);
  ctx.b.lift = 0;
  return out;
}

/**
 * Rubble is not scattered evenly: each cell gets a weight from how close it is to rocks (colliders),
 * crust slabs and lava bombs, and whether it is a road edge; the total count stays the same and is shared out by weight;
 * the piles near rocks go right at the foot of the rocks, so they read as rubble that has fallen down, not stray dots all over.
 * nUnder: number of underlying lapilli / rubble pinches; nPeb: number of black-red rubble piles
 */
function rubble(ctx: FieldCtx, cand: [number, number, number, number][], nUnder: number, nPeb: number, out: GroundOut): void {
  const { r } = ctx;
  const pw = ctx.layout.pathW;
  const cell = ctx.low ? 3.6 : 2.5;
  // Anchors without colliders (crust slabs, lava bombs, ...) are put into the grid with their radius plus 3 meters,
  // so that nearby ones can be found
  const grid = new Solids();
  for (const [x, z, R] of out.rubble) grid.add(x, z, R + 3);
  const info = cand.map(([x, z]) => {
    let best: [number, number, number] | null = null;
    let gap = 3;
    for (const s of ctx.solids.near(x, z)) {
      if (s.r > 3.5) continue;
      const g = Math.hypot(x - s.x, z - s.z) - s.r;
      if (g < gap) {
        gap = g;
        best = [s.x, s.z, s.r];
      }
    }
    for (const s of grid.near(x, z)) {
      const R = s.r - 3;
      const g = Math.hypot(x - s.x, z - s.z) - R;
      if (g < gap) {
        gap = g;
        best = [s.x, s.z, R];
      }
    }
    const a = best ? 1 - Math.max(0, gap) / 3 : 0;
    const pd = ctx.pathDist(x, z);
    const p = Math.max(0, 1 - Math.abs(pd - (pw + 2.3)) / 1.5);
    return { best, a, p, w: 0.08 + 1.5 * a + 0.8 * p };
  });
  const sw = info.reduce((t, i) => t + i.w, 0) || 1;
  const spot = (i: number): [number, number, 'rock' | 'path' | 'open'] => {
    const [x, z] = cand[i];
    const { best, a, p } = info[i];
    if (best && a > 0.2 && (p < a || r() < 0.5)) {
      const [bx, bz, bR] = best;
      const ang = Math.atan2(z - bz, x - bx) + (r() - 0.5) * 1.6;
      const d = bR + 0.05 + r() * r() * 1.4;
      return [bx + Math.cos(ang) * d, bz + Math.sin(ang) * d, 'rock'];
    }
    return [x + (r() - 0.5) * cell * 0.8, z + (r() - 0.5) * cell * 0.8, p > 0.3 ? 'path' : 'open'];
  };
  const ok = (x: number, z: number) => ctx.pathDist(x, z) > pw * 0.8 && ctx.h(x, z) > SH.LAVA + 0.45 && !landmark(x, z);
  const deal = (n: number, fn: (i: number) => void) => {
    info.forEach((it, i) => {
      const e = (n * it.w) / sw;
      const k = Math.floor(e) + (r() < e - Math.floor(e) ? 1 : 0);
      for (let j = 0; j < k; j++) fn(i);
    });
  };
  // Underlying layer: lapilli and rubble (at the foot of rocks they are mostly larger chunks);
  // lichen and pumice only on open ground
  deal(nUnder, (i) => {
    const [px, pz, where] = spot(i);
    if (!ok(px, pz)) return;
    const [, , ash, sl] = cand[i];
    const lens = lensZone(ctx, px, pz, 0.5);
    const u = r();
    if (where === 'rock' && !lens) {
      if (u < 0.55) scree(ctx, px, pz, 0.6 + r() * 0.6, r() < 0.5 ? G.basalt2 : r() < 0.5 ? G.scoria2 : G.ash);
      else lapilli(ctx, px, pz, 0.7 + r() * 0.7, r() < 0.5 ? G.scoria : G.basalt);
    } else if (where === 'path' || lens) {
      if (u < 0.65 || lens) lapilli(ctx, px, pz, 0.8 + r() * 0.7, r() < 0.4 ? G.scoria : r() < 0.5 ? G.ash : G.basalt);
      else scree(ctx, px, pz, 0.7 + r() * 0.5, r() < 0.5 ? G.basalt2 : G.scoria2);
    } else {
      if (u < 0.45) lapilli(ctx, px, pz, 0.8 + r() * 0.8, r() < 0.4 ? G.scoria : r() < 0.5 ? G.ash : G.basalt);
      else if (u < 0.7) scree(ctx, px, pz, 0.7 + r() * 0.6, r() < 0.5 ? G.basalt2 : r() < 0.5 ? G.scoria2 : G.ash);
      else if (u < 0.85 && ash > 0.4) lichen(ctx, px, pz, 1.1 + r() * 0.7, r() < 0.5 ? G.lichenO : G.lichenY, out.stains);
      else if (sl < 0.5) lapilli(ctx, px, pz, 1.2 + r() * 0.6, G.pumice);
    }
  });
  // Black-red rubble piles: almost always against a rock or a crust slab
  deal(nPeb, (i) => {
    const [px, pz] = spot(i);
    if (!ok(px, pz) || lensZone(ctx, px, pz, 0.8)) return;
    pebbles(ctx, px, pz, 3 + Math.floor(r() * 4), 1.1, r() < 0.5 ? COL.rock : COL.scoria);
  });
}

// ───────────────────────── Road edging ─────────────────────────

/** Reserved areas of the town, the tower approach, the teleport circle, chests and residents (road distance is not considered) */
export function reserved(ctx: FieldCtx, x: number, z: number): boolean {
  const L = ctx.layout;
  const d = (p: readonly number[]) => Math.hypot(x - p[0], z - p[1]);
  return d(L.town) < L.townR + 2 || d(L.tower) < 22 || d(L.waypoint) < 4 || L.chests.some((c) => d(c) < 3) || L.npcs.some((n) => d(n) < 2);
}

/**
 * Along both sides of the main road and side paths: against the road surface go lapilli, rubble,
 * emberbell flowers and half-buried curbstones (not blocking the road), charred thornbushes only a bit further out,
 * and a cairn waymarker every so often; the road surface also gets a few pieces of rubble crushed by wheels.
 */
function roadside(ctx: FieldCtx, busy: Solids, out: GroundOut, bloom: boolean): void {
  const { r, low } = ctx;
  const pw = ctx.layout.pathW;
  const roads: XZ[][] = [SH.PATH, ...SH.TRAILS];
  const crossings = SH.getCrossings();
  const bad = (x: number, z: number) =>
    reserved(ctx, x, z) || landmark(x, z) || busy.blocked(x, z, 0.3) || ctx.h(x, z) < SH.LAVA + 0.6 || crossings.some((c) => Math.hypot(x - c.c[0], z - c.c[1]) < 9) || ctx.solids.blocked(x, z, 0.4);
  roads.forEach((line, li) => {
    const curve = new THREE.CatmullRomCurve3(line.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const n = Math.round(curve.getLength() / 1.6);
    const pts = curve.getSpacedPoints(n);
    let sinceCairn = 8 + r() * 10;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const t = p.clone().sub(pts[i - 1]).normalize();
      sinceCairn -= 1.6;
      // Rubble on the road surface
      if (r() < (low ? 0.15 : 0.35)) {
        const k = (r() - 0.5) * 2 * pw * 0.85;
        const x = p.x - t.z * k;
        const z = p.z + t.x * k;
        if (!bad(x, z)) lapilli(ctx, x, z, 0.5 + r() * 0.4, r() < 0.5 ? G.ash : G.basalt2);
      }
      for (const side of [-1, 1]) {
        if (r() > (low ? 0.45 : 0.85)) continue;
        const near = r() < 0.6;
        const off = near ? pw + 0.35 + r() * 1.0 : pw + 1.5 + r() * 1.8;
        const x = p.x - t.z * side * off;
        const z = p.z + t.x * side * off;
        if (ctx.pathDist(x, z) < pw + 0.3 || bad(x, z) || lensZone(ctx, x, z, 0.8)) continue;
        const u = r();
        if (!near && sinceCairn < 0 && ctx.pathDist(x, z) > pw + 1.4) {
          cairn(ctx, x, z, 0.9 + r() * 0.4, li === 0 || r() < 0.4);
          sinceCairn = 20 + r() * 12;
        } else if (u < 0.28) {
          // Curbstones: half-buried basalt blocks (very low, not blocking the road)
          const s = 0.24 + r() * 0.22;
          ctx.b.lift = ctx.h(x, z) - s * 0.4;
          const ry = Math.atan2(t.x, t.z) + (r() - 0.5) * 0.5;
          put(ctx.b, r() < 0.5 ? T.dod : T.box, r() < 0.5 ? G.basalt2 : G.basaltL, MX(x, s * 0.4, z, s * 1.4, s * 0.8, s, ry));
        } else if (u < 0.5) lapilli(ctx, x, z, 0.9 + r() * 0.6, r() < 0.5 ? G.scoria : G.ash);
        else if (u < 0.68) emberBells(ctx, x, z, 2 + Math.floor(r() * 3), bloom);
        else if (u < 0.82) scree(ctx, x, z, 0.8 + r() * 0.5, r() < 0.5 ? G.basalt2 : G.scoria2);
        else if (u < 0.9 && !near) thornBush(ctx, x, z, 0.6 + r() * 0.4);
        else lichen(ctx, x, z, 1.3, r() < 0.5 ? G.lichenO : G.lichenY, out.stains);
      }
    }
  });
  void out;
}
