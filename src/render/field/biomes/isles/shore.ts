// Ground detail of the southern half of the archipelago: a jittered grid fills the whole warm island, placing different things by terrain band.
// Shallows: seagrass beds and underwater reef rocks; waterline: big rocks half in the water, heaps of stones, pebbles,
// tide pools, seaweed washed ashore;
// beach: beach grass, beach morning glory, fallen coconuts; grassland: lantana, agave, monstera, banana, plumeria,
// climbing-vine rocks, and olive trees on Harbor Isle too.
// Props that block the way (big rocks, trees) are placed only on wide ground that is passable all around; narrow sandbars,
// piers and the secret sandbar to Siren Reef get none.

import * as THREE from 'three';
import { rng } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { agave, banana, beachGrass, lantana, monstera, olive, pebbles, plumeria, seagrass, seaweed, shell, tropicBush, vineRock } from './flora.ts';
import { MX, put, T } from './parts.ts';
import { cold, fbm, HIDDEN_BAR, LIGHTHOUSE, PIER_LINES, POND, POND_R, SPRINGS, TOWN, WHALE_HEAD, WHALE_TAIL } from './terrain.ts';

const HIBISCUS = [0xff4a5a, 0xff8ab0, 0xffc83a, 0xff7a3a];
const ROCK = [0x7d8ea4, 0x8a96a8, 0x6c7c92, 0x9aa4b0];
const LANTANA: [number, number][] = [
  [0xff8a3a, 0xffd040],
  [0xff6aa8, 0xffe070],
  [0xfff4e0, 0xffc0e0],
  [0xc070ff, 0xffffff],
];

/** Distance from a point to a polyline */
function lineDist(pts: [number, number][], x: number, z: number): number {
  let best = 99;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const vx = bx - ax;
    const vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)));
    best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return best;
}

/** Big rock half in the water: a few clustered together, with a ring of white surf on the water */
/** Reef rocks that waves break on (buildShores finally uses them to place splashes) */
const SPRAY: THREE.Vector3[] = [];

function seaRock(ctx: FieldCtx, x: number, z: number, y: number, s: number, r: () => number): void {
  const { b } = ctx;
  if (y < 0.1 && s > 0.9) SPRAY.push(new THREE.Vector3(x, 0.2, z));
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = i ? s * (0.5 + r() * 0.4) : 0;
    const ss = s * (i ? 0.5 + r() * 0.3 : 1);
    put(b, T.dode0, ROCK[Math.floor(r() * ROCK.length)], MX(x + Math.cos(a) * d, y + ss * 0.25, z + Math.sin(a) * d, ss * 1.2, ss * 0.95, ss, r() * 0.4, r() * 6, r() * 0.4));
  }
  // Barnacles on the rock (small light dots)
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    put(b, T.ico0, 0xe8e4d8, MX(x + Math.cos(a) * s * 0.8, Math.max(y, 0) + 0.1, z + Math.sin(a) * s * 0.8, 0.09, 0.07, 0.09), false);
  }
  if (y < 0.1) put(b, T.ring, 0xf2fffe, MX(x, 0.03, z, s * 1.35, s * 1.35, s * 0.6, Math.PI / 2), false);
}

/** Tide pool: a ring of stones around a pool of clear water, with starfish and sea anemones inside */
function tidePool(ctx: FieldCtx, x: number, z: number, y: number, s: number, r: () => number): void {
  const { b } = ctx;
  put(b, T.disc, 0x7ad0d8, MX(x, y + 0.04, z, s * 0.95, 1, s * 0.8), false);
  put(b, T.disc, 0x4ab0c0, MX(x, y + 0.045, z, s * 0.55, 1, s * 0.45), false);
  const n = 8 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const rs = (0.22 + r() * 0.22) * s;
    put(b, T.dode0, ROCK[i % ROCK.length], MX(x + Math.cos(a) * s * 1.05, y + rs * 0.3, z + Math.sin(a) * s * 0.9, rs * 1.3, rs * 0.8, rs, 0, r() * 6));
  }
  b.lift = y + 0.03;
  shell(b, x + (r() - 0.5) * s * 0.6, z + (r() - 0.5) * s * 0.5, r, 0.9);
  shell(b, x + (r() - 0.5) * s * 0.6, z + (r() - 0.5) * s * 0.5, r, 0.8);
  b.lift = 0;
  // Sea anemone: a small cluster of tentacles
  for (let i = 0; i < 2; i++) {
    const ax = x + (r() - 0.5) * s * 0.9;
    const az = z + (r() - 0.5) * s * 0.7;
    put(b, T.cyl8, 0xff7aa8, MX(ax, y + 0.08, az, 0.1, 0.12, 0.1), false);
    for (let k = 0; k < 6; k++) {
      const ta = (k / 6) * Math.PI * 2;
      put(b, T.cone4, i ? 0xffb0d0 : 0x9af0d0, MX(ax + Math.cos(ta) * 0.07, y + 0.18, az + Math.sin(ta) * 0.07, 0.025, 0.14, 0.025, Math.sin(ta) * 0.5, 0, -Math.cos(ta) * 0.5), false);
    }
  }
}

/** Beach morning glory: vines creeping along the sand, round leaves and pink-purple trumpet flowers */
function creeper(ctx: FieldCtx, x: number, z: number, y: number, r: () => number): void {
  const { b } = ctx;
  const n = 5 + Math.floor(r() * 4);
  let px = x;
  let pz = z;
  let a = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    a += (r() - 0.5) * 1.2;
    px += Math.cos(a) * 0.35;
    pz += Math.sin(a) * 0.35;
    put(b, T.ico0, i % 2 ? 0x4aa84a : 0x5ab85a, MX(px, y + 0.05, pz, 0.2, 0.06, 0.2, 0, r() * 6), false);
    if (r() < 0.35) put(b, T.cone5, i % 3 ? 0xd070d8 : 0xf0a0e8, MX(px + 0.1, y + 0.12, pz, 0.08, 0.12, 0.08, Math.PI), false);
  }
}

/** Coconuts fallen beneath a coconut palm */
function coconuts(ctx: FieldCtx, x: number, z: number, y: number, r: () => number): void {
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) put(ctx.b, T.sphere, r() < 0.3 ? 0x6a8a3a : 0x7a5a30, MX(x + (r() - 0.5) * 1.2, y + 0.12, z + (r() - 0.5) * 1.2, 0.15, 0.13, 0.15, 0, r() * 6));
}

export function buildShores(ctx: FieldCtx): void {
  const { b, low } = ctx;
  SPRAY.length = 0;
  // Its own random stream: adding or removing things here later does not change the layout elsewhere
  const r = rng(90417);
  const k = low ? 0.5 : 1;
  const S = ctx.layout.size - 5;
  const cell = 2.3;
  const h = ctx.h;
  /** Passable all around (±2.5): props that block the way are placed only on this kind of wide ground */
  const roomy = (x: number, z: number) => Math.min(h(x + 2.5, z), h(x - 2.5, z), h(x, z + 2.5), h(x, z - 2.5)) > -0.45;
  const secret = (x: number, z: number) => lineDist(HIDDEN_BAR, x, z) < 4.5 || PIER_LINES.some((l) => lineDist(l, x, z) < 2.8);
  const nearSpring = (x: number, z: number) => SPRINGS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 3) || Math.hypot(x - POND[0], z - POND[1]) < POND_R + 2;
  const whale = (x: number, z: number) => lineDist([WHALE_TAIL, WHALE_HEAD], x, z) < 7;
  /**
   * Lighthouse highland: the stretch from the end of the trail to the chest is not in the road network and is surrounded by
   * cliffs, so only small things that do not block the way are placed there
   */
  const light = (x: number, z: number) => Math.hypot(x - LIGHTHOUSE[0], z - LIGHTHOUSE[1]) < 17;
  b.lift = 0;
  const placeAt = (x: number, z: number) => {
    const y = h(x, z);
    const v = r();
    const w = r();
    if (y < -0.45) {
      // Shallows: seagrass beds, underwater reef rocks
      if (v < 0.14) seagrass(b, x, y, z, 0.9 + w * 0.6, r);
      else if (v < 0.19) put(b, T.dode0, ROCK[Math.floor(w * 4)], MX(x, y + 0.1, z, 0.8 + w, 0.5 + w * 0.5, 0.7 + w, r(), r() * 6, r()), false);
      else if (v < 0.205 && y < -0.7 && !ctx.solids.blocked(x, z, 2.5)) seaRock(ctx, x, z, y, 1.2 + w * 1.2, r);
      return;
    }
    if (ctx.solids.blocked(x, z, 0.6)) return;
    if (y < 0.3) {
      // Waterline
      if (v < 0.13) seaweed(b, x, y, z, r);
      else if (v < 0.28) pebbles(b, x, y, z, 1 + w, r);
      else if (v < 0.33 && roomy(x, z) && !light(x, z) && !ctx.solids.blocked(x, z, 1.8)) {
        seaRock(ctx, x, z, y, 0.7 + w * 0.8, r);
        ctx.solids.add(x, z, 0.9 + w * 0.8);
      } else if (v < 0.345 && y > 0 && roomy(x, z) && !light(x, z) && !ctx.solids.blocked(x, z, 2.2)) tidePool(ctx, x, z, y, 1.1 + w * 0.5, r);
      return;
    }
    if (y < 1.1) {
      // Beach
      if (v < 0.26) beachGrass(b, x, y, z, 0.9 + w * 0.5, r);
      else if (v < 0.38) creeper(ctx, x, z, y, r);
      else if (v < 0.44) pebbles(b, x, y, z, 0.8, r, [0xf0e6d0, 0xe0d0b0, 0xd8c8a8]);
      else if (v < 0.49) coconuts(ctx, x, z, y, r);
      else if (v < 0.5 && roomy(x, z) && !light(x, z) && !ctx.solids.blocked(x, z, 1.5)) {
        vineRock(b, x, y, z, 0.8 + w * 0.5, r);
        ctx.solids.add(x, z, 0.9 + w * 0.4);
      }
      return;
    }
    // Grassland: flower clusters and small shrubs are everywhere, blooming patch by patch in different colors;
    // plants that block the way only on wide ground
    const slope = Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
    const patch = fbm(x * 0.06 + 11, z * 0.06 - 4);
    const solidOk = roomy(x, z) && !whale(x, z) && !light(x, z) && ctx.pathDist(x, z) > 4.2;
    if (v < 0.24) lantana(b, x, y, z, LANTANA[Math.floor(patch * 7) % 4], r);
    else if (v < 0.3) tropicBush(ctx, x, z, 0.7 + w * 0.5, r() < 0.6 ? HIBISCUS[Math.floor(r() * 4)] : undefined);
    else if (v < 0.36 && (slope > 0.12 || patch < 0.4)) agave(b, x, y, z, 0.8 + w * 0.5, r);
    else if (v < 0.45 && patch > 0.42) monstera(b, x, y, z, 0.8 + w * 0.5, r);
    else if (v < 0.475 && solidOk && !ctx.solids.blocked(x, z, 1.4)) {
      banana(b, x, y, z, 0.9 + w * 0.35, r);
      ctx.solids.add(x, z, 0.35);
      // Bananas often come in clumps of two or three plants
      for (let i = 0; i < 2; i++) {
        const a = r() * Math.PI * 2;
        const bx = x + Math.cos(a) * 1.6;
        const bz = z + Math.sin(a) * 1.6;
        if (ctx.solids.blocked(bx, bz, 0.8) || ctx.pathDist(bx, bz) < 4) continue;
        banana(b, bx, h(bx, bz), bz, 0.7 + r() * 0.3, r);
        ctx.solids.add(bx, bz, 0.3);
      }
    } else if (v < 0.49 && solidOk && !ctx.solids.blocked(x, z, 2)) {
      plumeria(b, x, z, y, 0.9 + w * 0.4, r);
      ctx.solids.add(x, z, 0.4);
    } else if (v < 0.505 && solidOk && !ctx.solids.blocked(x, z, 1.5)) {
      vineRock(b, x, y, z, 0.8 + w * 0.7, r, r() < 0.5 ? LANTANA[Math.floor(w * 4)][0] : undefined);
      ctx.solids.add(x, z, 0.9 + w * 0.6);
    } else if (v < 0.515 && solidOk && z > 55 && !ctx.solids.blocked(x, z, 2)) {
      olive(b, x, z, y, 0.9 + w * 0.3, r);
      ctx.solids.add(x, z, 0.45);
    } else if (v < 0.58) beachGrass(b, x, y, z, 0.8, r);
    else if (v < 0.62) pebbles(b, x, y, z, 0.7, r);
    b.lift = 0;
  };
  for (let gz = -S; gz < S; gz += cell) {
    for (let gx = -S; gx < S; gx += cell) {
      const x0 = gx + r() * cell;
      const z0 = gz + r() * cell;
      if (cold(x0, z0) > 0.42) continue;
      const y0 = h(x0, z0);
      if (y0 < -1.7) continue;
      // Three tries per cell on land, two at the water's edge, one in shallow water (halved on low graphics)
      const tries = Math.round((y0 > 1.1 ? 3 : y0 > -0.45 ? 2 : 1) * k + (r() < (k % 1) ? 1 : 0));
      for (let t = 0; t < tries; t++) {
        const x = t ? gx + r() * cell : x0;
        const z = t ? gz + r() * cell : z0;
        if (Math.hypot(x - TOWN[0], z - TOWN[1]) < 19) continue;
        if (!ctx.clear(x, z, h(x, z) < 0.3 ? 0.2 : 0) || secret(x, z) || nearSpring(x, z)) continue;
        placeAt(x, z);
      }
    }
  }
  b.lift = 0;
  // Splashes of waves hitting the reef rocks: pick rocks near the camera, splashing up in bursts
  if (!SPRAY.length) return;
  const pts = SPRAY.slice();
  let acc = 0;
  ctx.extras.push((dt, _t, vfx) => {
    acc += dt;
    if (acc < (low ? 0.6 : 0.3)) return;
    acc = 0;
    const cp = vfx.camPos;
    const near = pts.filter((p) => Math.abs(p.x - cp.x) < 34 && Math.abs(p.z - cp.z) < 34);
    if (!near.length) return;
    const p = near[Math.floor(Math.random() * near.length)];
    vfx.emit({ pos: new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.2, ctx.waterLevel + 0.15, p.z + (Math.random() - 0.5) * 1.2), count: low ? 4 : 8, color: [0xffffff, 0xe0f6ff], speed: [1.6, 3.2], dir: new THREE.Vector3(0, 1, 0), spread: 0.45, life: [0.5, 0.9], size: [0.12, 0.24], sizeEnd: 0.4, gravity: -8, intensity: 1.1 });
  });
}
