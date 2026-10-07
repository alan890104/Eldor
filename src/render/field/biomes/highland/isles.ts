// Floating rocks: inverted-cone rock bodies (strata striped like the plateau), grass and flag trees on top, long roots and vines
// hanging below, some with a waterfall dropping from the edge into the cloud sea. Split into several groups that each bob gently.
// Above Floatstone Hollow there is another giant floating rock: an ancient Wing Folk stone pillar stands on top, glowing wind crystals
// are embedded in its underside, and its waterfall falls into the hollow's pool.

import * as THREE from 'three';
import { M, MS, PropBatch } from '../../../arenaKit.ts';
import { segM, V } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import type { Anim } from './anim.ts';
import { banner, waterfallGeo } from './fx.ts';
import { C, WIND_RY } from './props.ts';
import { BASIN, BASIN_H, POND, WX, WZ } from './shape.ts';

const STRATA = [0xd3c1a0, 0xb89c7e, 0xa38a74, 0xc9b38e, 0x9a8a7e];
const GRASS = [0x7fbf62, 0x6fae58];
const ROOT = 0x6b5143;
const VINE = 0x5f8f4a;

/** Cone with its tip pointing down and its base at the origin */
function coneDown(rad: number, h: number, seg: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(rad, h, seg);
  g.rotateX(Math.PI);
  g.translate(0, -h / 2, 0);
  return g;
}

interface IsleOpts {
  /** Direction of the cliff edge the waterfall falls from (radians, 0 faces +z); undefined means no waterfall */
  fall?: number;
  fallLen?: number;
  trees?: number;
  /** A Wing Folk flagpole on top */
  pole?: boolean;
}

/** One floating rock (added into b, coordinates are world coordinates; the waterfall geometry goes into falls) */
function isle(b: PropBatch, flags: Anim['flags'], falls: THREE.BufferGeometry[], x: number, y: number, z: number, s: number, r: () => number, o: IsleOpts): void {
  const ry = r() * 6;
  const R = 2.2 * s;
  // Grass top and soil layer
  b.add(new THREE.CylinderGeometry(R, R * 0.93, 0.45 * s, 10), GRASS[0], M(x, y, z, ry));
  const mound = new THREE.IcosahedronGeometry(1, 1);
  b.add(mound, GRASS[1], MS(x + (r() - 0.5) * R * 0.3, y + 0.2 * s, z + (r() - 0.5) * R * 0.3, R * 0.8, 0.35 * s, R * 0.75, ry));
  b.add(new THREE.CylinderGeometry(R * 0.93, R * 0.84, 0.7 * s, 10), 0x8a6a4c, M(x, y - 0.55 * s, z, ry));
  // Rock body: several staggered inverted cones, strata colors going down layer by layer
  b.add(coneDown(R * 0.86, 3.6 * s, 8), STRATA[0], M(x, y - 0.85 * s, z, ry));
  b.add(coneDown(R * 0.62, 2.8 * s, 7), STRATA[1], M(x + R * 0.28, y - 1.6 * s, z - R * 0.15, ry + 1));
  b.add(coneDown(R * 0.45, 2.6 * s, 6), STRATA[2], M(x - R * 0.2, y - 2.4 * s, z + R * 0.2, ry + 2));
  b.add(coneDown(R * 0.3, 2.2 * s, 5), STRATA[3], M(x + R * 0.05, y - 3.6 * s, z - R * 0.05, ry + 3));
  for (let i = 0; i < 3; i++) {
    const a = ry + i * 2.1 + r();
    const chunk = new THREE.DodecahedronGeometry(1, 0);
    b.add(chunk, STRATA[(i + 1) % STRATA.length], MS(x + Math.cos(a) * R * 0.55, y - (1.2 + r()) * s, z + Math.sin(a) * R * 0.55, R * 0.35, R * 0.5, R * 0.35, r() * 6));
  }
  // Hanging roots and vines
  const nr = 5 + Math.floor(r() * 4);
  for (let i = 0; i < nr; i++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.35 + r() * 0.55);
    const L = (1.8 + r() * 4.5) * s;
    const top = y - (0.7 + (1 - d / R) * 2.2) * s;
    b.add(coneDown(0.07 * s + 0.04, L, 4), r() < 0.55 ? ROOT : VINE, M(x + Math.cos(a) * d, top, z + Math.sin(a) * d, r() * 6, 1, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25), false);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const L = (1.5 + r() * 2.5) * s;
    b.add(coneDown(0.05 * s + 0.03, L, 4), VINE, M(x + Math.cos(a) * R * 0.97, y + 0.1 * s, z + Math.sin(a) * R * 0.97), false);
  }
  // Trees and shrubs on top
  const nt = o.trees ?? (s > 1.4 ? 2 : 1);
  for (let i = 0; i < nt; i++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.1 + r() * 0.45);
    const tx = x + Math.cos(a) * d;
    const tz = z + Math.sin(a) * d;
    const ts = (0.55 + r() * 0.35) * Math.min(1.6, s);
    miniWindTree(b, tx, y + 0.2 * s, tz, ts, r);
  }
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.5 + r() * 0.35);
    b.add(new THREE.IcosahedronGeometry(1, 1), C.leaves[i], MS(x + Math.cos(a) * d, y + 0.35 * s, z + Math.sin(a) * d, 0.5 * s, 0.35 * s, 0.7 * s, WIND_RY), false);
  }
  if (o.pole) {
    const px = x - WX * R * 0.5;
    const pz = z - WZ * R * 0.5;
    b.add(new THREE.CylinderGeometry(0.06, 0.08, 4 * Math.min(1.5, s), 5), C.woodDark, M(px, y + 2 * Math.min(1.5, s), pz));
    banner(flags, px, y + 4 * Math.min(1.5, s), pz, 2.2, 0.45, [new THREE.Color(C.cloth[0]), new THREE.Color(C.cloth[1])], r() * 6, 0.7, true);
  }
  // Waterfall
  if (o.fall !== undefined) {
    const fx = Math.sin(o.fall);
    const fz = Math.cos(o.fall);
    const top = V(x + fx * R * 0.92, y + 0.05 * s, z + fz * R * 0.92);
    falls.push(waterfallGeo(top, new THREE.Vector2(fx, fz), o.fallLen ?? 34 + s * 8, 0.9 * s, 4));
    // Small rock blocks at the outlet
    b.add(new THREE.DodecahedronGeometry(0.5 * s, 0), STRATA[4], M(top.x, top.y - 0.2 * s, top.z, r() * 6));
  }
}

/** Small flag tree on a floating rock */
function miniWindTree(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number): void {
  const top = V(x + WX * 0.8 * s, y + 2.4 * s, z + WZ * 0.8 * s);
  b.add(new THREE.CylinderGeometry(1, 1, 1, 5), C.trunk, segM(V(x, y - 0.2, z), top, 0.18 * s));
  for (let i = 0; i < 3; i++) {
    const k = i / 2;
    const ss = (1.1 - k * 0.4) * s;
    b.add(new THREE.IcosahedronGeometry(1, 1), C.leaves[i % 3], MS(top.x + WX * (k * 1.8 - 0.2) * s, top.y + (0.1 - k * 0.4) * s + (r() - 0.5) * 0.2, top.z + WZ * (k * 1.8 - 0.2) * s, ss * 1.1, ss * 0.6, ss * 0.85, WIND_RY));
  }
}

/** A group of floating rocks: its own batch and waterfalls, the whole group bobs together */
function isleGroup(ctx: FieldCtx, anim: Anim, list: [number, number, number, number, IsleOpts][], phase: number, amp: number): void {
  const b = new PropBatch();
  const falls: THREE.BufferGeometry[] = [];
  for (const [x, y, z, s, o] of list) isle(b, anim.flags, falls, x, y, z, s, ctx.r, o);
  const g = new THREE.Group();
  b.build(g);
  for (const f of falls) anim.fall(f, g);
  ctx.group.add(g);
  anim.bobbers.push({ obj: g, amp, speed: 0.35 + phase * 0.05, phase, base: 0 });
}

export function buildIsles(ctx: FieldCtx, anim: Anim): void {
  const low = ctx.low;
  // [x, y, z, size, options]; y is the height of the grass top
  const groups: [number, number, number, number, IsleOpts][][] = [
    [
      // East (downwind): a large cluster
      [124, 20, -32, 2.3, { fall: -1.9, pole: true }],
      [142, 34, 8, 1.6, {}],
      [114, 12, 38, 1.4, { fall: -1.6, fallLen: 30 }],
      [152, 24, 58, 2.7, { fall: -2.2 }],
      [108, 22, 16, 1.0, {}],
    ],
    [
      // North, behind the tower
      [-52, 44, -142, 2.9, { fall: 0.3, pole: true }],
      [32, 34, -130, 2.0, { fall: 0.1 }],
      [74, 52, -118, 1.5, {}],
      [-12, 66, -156, 1.7, {}],
      [-92, 30, -118, 1.4, {}],
    ],
    [
      // West (windward side) and south
      [-128, 22, -12, 1.9, { fall: 1.4 }],
      [-120, 36, 46, 1.4, {}],
      [-142, 14, -72, 2.2, {}],
      [30, 12, 128, 1.8, { fall: 3.4, pole: true }],
      [-50, 30, 124, 1.5, {}],
      [-6, 48, 150, 2.4, {}],
    ],
    [
      // In and above the chasm
      [38, 5, -13, 0.9, { trees: 1 }],
      [-12, 7, -11.5, 0.55, { trees: 1 }],
      [62, 19, -8, 1.1, { fall: 3.3, fallLen: 30 }],
      [96, 14, -14, 0.8, {}],
    ],
  ];
  groups.forEach((list, i) => isleGroup(ctx, anim, low ? list.filter((_, k) => k % 2 === 0 || i === 3) : list, i * 1.7, 0.35 + i * 0.08));
  buildGiantRock(ctx, anim);
}

/** The giant floating rock above Floatstone Hollow */
function buildGiantRock(ctx: FieldCtx, anim: Anim): void {
  const r = ctx.r;
  const b = new PropBatch();
  const cx = BASIN[0] - 1.5;
  const cz = BASIN[1] - 3;
  // The rock's underside is still seven or eight meters above the hollow floor:
  // walking into the hollow, you can see the whole rock hanging overhead from below
  const top = BASIN_H + 28;
  const R = 11;
  const falls: THREE.BufferGeometry[] = [];
  // Grass top, soil layer
  b.add(new THREE.CylinderGeometry(R, R * 0.94, 1.2, 14), GRASS[0], M(cx, top, cz, 0.3));
  b.add(new THREE.IcosahedronGeometry(1, 2), GRASS[1], MS(cx - 2, top + 0.6, cz + 1, R * 0.75, 1.3, R * 0.7, 0.4));
  b.add(new THREE.CylinderGeometry(R * 0.94, R * 0.86, 1.6, 14), 0x8a6a4c, M(cx, top - 1.3, cz, 0.3));
  // Rock body: inverted cones stepping inward layer by layer
  const tiers: [number, number, number, number][] = [
    [0, 0, R * 0.88, 3.6],
    [1.2, -0.8, R * 0.7, 3.8],
    [-1.5, 1.2, R * 0.52, 4],
    [0.8, 1.5, R * 0.36, 3.6],
    [-0.4, -0.4, R * 0.22, 3],
  ];
  // The ring exposed on each layer's underside (roots and wind crystals hang from here): y, inner radius, outer radius, center
  const ledges: [number, number, number, number, number][] = [];
  let y = top - 2.1;
  tiers.forEach(([ox, oz, rr, hh], i) => {
    b.add(new THREE.CylinderGeometry(rr, rr * 0.78, hh, 11), STRATA[i % STRATA.length], M(cx + ox, y - hh / 2, cz + oz, i * 0.7));
    const next = tiers[i + 1];
    ledges.push([y - hh, next ? next[2] * 0.95 : 0, rr * 0.76, cx + ox, cz + oz]);
    y -= hh * 0.8;
  });
  b.add(coneDown(R * 0.22, 5, 7), STRATA[4], M(cx - 0.4, y - 0.4, cz - 0.4, 1));
  const onLedge = (): [number, number, number] => {
    const [ly, r0, r1, lx, lz] = ledges[Math.floor(r() * (ledges.length - 1))];
    const a = r() * Math.PI * 2;
    const d = r0 + (r1 - r0) * (0.2 + r() * 0.8);
    return [lx + Math.cos(a) * d, ly, lz + Math.sin(a) * d];
  };
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.45 + r() * 0.4);
    b.add(new THREE.DodecahedronGeometry(1, 0), STRATA[i % STRATA.length], MS(cx + Math.cos(a) * d * 0.9, top - 3 - r() * 5, cz + Math.sin(a) * d * 0.9, 1.6 + r() * 1.5, 2 + r() * 2, 1.6 + r() * 1.5, r() * 6));
  }
  // Wind crystals on the underside
  const crystal = new THREE.OctahedronGeometry(0.6);
  crystal.scale(0.6, 2.2, 0.6);
  for (let i = 0; i < 11; i++) {
    const [x, yy, z] = onLedge();
    b.glow(crystal, 0x8ff5e0, M(x, yy - 0.9, z, r() * 6, 0.8 + r() * 0.8, Math.PI + (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
  }
  // Long hanging roots
  for (let i = 0; i < 26; i++) {
    const [x, yy, z] = onLedge();
    const L = Math.min(4 + r() * 10, yy - BASIN_H - 3.5);
    if (L < 1.5) continue;
    b.add(coneDown(0.12 + r() * 0.12, L, 4), r() < 0.5 ? ROOT : VINE, M(x, yy + 0.3, z, r() * 6, 1, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2), false);
  }
  // On top: an ancient Wing Folk stone pillar (half fallen), flag trees
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const px = cx + Math.cos(a) * R * 0.55;
    const pz = cz + Math.sin(a) * R * 0.55;
    const h = i % 2 ? 2.2 : 4.5;
    b.add(new THREE.CylinderGeometry(0.45, 0.55, h, 8), 0xe8e0cc, M(px, top + h / 2, pz, 0, 1, i === 3 ? 0.3 : 0, 0));
    b.add(new THREE.BoxGeometry(1.3, 0.3, 1.3), 0xcfc6b2, M(px, top + h + 0.1, pz));
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    miniWindTree(b, cx + Math.cos(a) * R * 0.3, top + 0.4, cz + Math.sin(a) * R * 0.3, 1.2 + r() * 0.4, r);
  }
  // Waterfall: falls from the cliff edge on the side facing the pool
  const dx = POND[0] - cx;
  const dz = POND[1] - cz;
  const dl = Math.hypot(dx, dz);
  const ux = dx / dl;
  const uz = dz / dl;
  const ftop = V(cx + ux * (R - 0.8), top + 0.2, cz + uz * (R - 0.8));
  falls.push(waterfallGeo(ftop, new THREE.Vector2(ux, uz).multiplyScalar(0.0001), top - BASIN_H + 0.5, 1.8, 0.6));
  b.add(new THREE.DodecahedronGeometry(1.1, 0), STRATA[4], M(ftop.x, ftop.y - 0.4, ftop.z, 1));
  const g = new THREE.Group();
  b.build(g);
  for (const f of falls) anim.fall(f, g);
  ctx.group.add(g);
  anim.bobbers.push({ obj: g, amp: 0.18, speed: 0.3, phase: 0.8, base: 0 });
  // Small rubble slowly circling the giant rock
  const orbit = new THREE.Group();
  orbit.position.set(cx, top - 6, cz);
  const ob = new PropBatch();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const d = R + 4 + r() * 5;
    const s = 0.8 + r() * 1.4;
    ob.add(new THREE.DodecahedronGeometry(s, 0), STRATA[i % STRATA.length], M(Math.cos(a) * d, (r() - 0.5) * 8, Math.sin(a) * d, r() * 6, 1, r(), r()));
  }
  ob.build(orbit);
  ctx.group.add(orbit);
  anim.spinners.push({ obj: orbit, axis: 'y', speed: 0.04 });
  // Wind crystal light motes drifting down
  ctx.extras.push((dt, _t, vfx) => {
    if (Math.random() > dt * 5) return;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * R * 0.7;
    vfx.emit({ pos: V(cx + Math.cos(a) * d, top - 10 - Math.random() * 6, cz + Math.sin(a) * d), count: 1, color: [0x8ff5e0, 0xffffff], speed: [0.2, 0.6], dir: V(WX * 0.3, -1, WZ * 0.3), spread: 0.4, life: [3, 5], size: [0.12, 0.22], sizeEnd: 0.3, intensity: 2 });
  });
}
