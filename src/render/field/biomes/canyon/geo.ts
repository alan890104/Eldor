// Stoneheart Canyon's terrain: the valley-floor network (basins + canyons + narrow cracks), the stepped-back red rock walls
// (cliffs alternating with scree slopes), the tortoise's shell mesa and the Royal Stair, the Quicksand Hollow, and the dig pit
// in front of the tower. All position constants live here, shared by terrain, coloring and props.

import type { XZ } from '../../kit.ts';

// ───────────────────────── Noise ─────────────────────────

function hash2(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Value noise, 0 to 1 */
export function vnoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Value noise, -1 to 1 */
export const snoise = (x: number, z: number) => vnoise(x, z) * 2 - 1;

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ───────────────────────── Map layout ─────────────────────────

export const SIZE = 120;
/** Center and radius of the tortoise's shell (the citadel sits on top of it) */
export const SHELL: [number, number, number] = [0, 72, 31];
export const TOWN: XZ = [0, 72];
export const TOWN_R = 15;
/** Height of the citadel (on the shell) */
export const TOWN_H = 14;
export const TOWER: XZ = [0, -78];

/** The various locations */
export const SPOT = {
  /** The tortoise's head (nose pointing north) */
  head: [0, 27] as XZ,
  fork: [-4, -14] as XZ,
  glass: [-64, 16] as XZ,
  pool: [-72, 11] as XZ,
  quick: [-58, -44] as XZ,
  arch: [24, -9] as XZ,
  hoodoo: [48, -10] as XZ,
  mine: [80, -53] as XZ,
  dig: [36, -72] as XZ,
  shrine: [-33, -87] as XZ,
  grotto: [-83, -79] as XZ,
  lift: [35.5, 72] as XZ,
  fossil: [79, 7] as XZ,
};

/** Basins (ellipses): [x, z, rx, rz] */
const BASINS: [number, number, number, number][] = [
  [0, 52, 58, 46], // Sleeping Tortoise Basin
  [-4, -14, 15, 13], // Triple Fork
  [-64, 16, 15, 13], // Glassworks
  [-56, -42, 19, 17], // Quicksand Hollow
  [48, -10, 18, 17], // Hoodoo Valley
  [74, -46, 10, 9], // Mine Mouth
  [0, -77, 27, 22], // Tower Approach
  [34, -72, 13, 11], // The Order's dig site
  [-83, -79, 9.5, 8.5], // Secret realm: Crystalheart Grotto
  [-33, -86, 9, 7], // Old Shrine west of the tower
];

/** Canyons (capsules with a different radius at each end): [x0, z0, x1, z1, r0, r1] */
const CANYONS: [number, number, number, number, number, number][] = [
  // Basin → Triple Fork
  [-4, 10, -4, -8, 9, 8],
  // The main road from the foot of the Royal Stair, around the tortoise's head, to the Triple Fork
  [-31, 15, -9, 2, 6.5, 7.5],
  // Triple Fork → Skythread Gorge → Tower Approach
  [-2, -20, 3, -32, 9, 7.5],
  [3, -32, 4, -42, 7.5, 4.6],
  [4, -42, 1, -53, 4.6, 6],
  // Triple Fork → arch → Hoodoo Valley
  [2, -12, 16, -9, 8, 7.5],
  [16, -9, 32, -9, 7.5, 8.5],
  // Hoodoo Valley → east side of the basin (rails)
  [46, 2, 44, 16, 8, 7],
  [44, 16, 40, 30, 7, 8],
  // Hoodoo Valley → mine
  [54, -22, 64, -32, 8, 7.5],
  [64, -32, 72, -42, 7.5, 8],
  // Mine → dig site (around the east side to the tower)
  [72, -50, 64, -62, 7, 6.5],
  [64, -62, 46, -70, 6.5, 7.5],
  // Basin → Glassworks
  [-40, 28, -54, 20, 9, 9],
  // Glassworks → Quicksand Hollow (narrow crack on the west side)
  [-60, 5, -67, -10, 4.5, 4],
  [-67, -10, -68, -26, 4, 4.5],
  // Triple Fork → Quicksand Hollow
  [-12, -18, -28, -26, 8, 7.5],
  [-28, -26, -42, -36, 7.5, 8.5],
  // Quicksand Hollow → secret realm (a winding narrow crack)
  [-63, -56, -68, -64, 4, 3.4],
  [-68, -64, -77, -70, 3.4, 3.6],
  // Tower Approach → Old Shrine
  [-18, -84, -28, -86, 7, 7],
  // Dead end on the east side of the basin: at its end, a rock wall with a dragon fossil set into it
  [50, 32, 66, 24, 7.5, 6.5],
  [66, 24, 76, 11, 6.5, 6],
];

/** Buttes standing alone in the valleys: [x, z, r, height] */
const BUTTES: [number, number, number, number][] = [
  [55, -2, 4.2, 15],
  [41, -20, 3.2, 11],
  [-45, -52, 3.4, 13],
  [-47, 64, 3.6, 12],
];

/** Royal Stair: winds down along the front-left of the tortoise shell [x, z, height] */
export const RAMP: [number, number, number][] = [
  [-6, 55, 13.2],
  [-12, 49.5, 11.8],
  [-22, 44.5, 8.4],
  [-31, 37.5, 4.4],
  [-35, 28, 0.9],
  [-34, 21, 0.2],
];
const RAMP_W = 3.4;

// ───────────────────────── Distance field ─────────────────────────

function capsule(x: number, z: number, c: (typeof CANYONS)[number]): [number, number] {
  const [x0, z0, x1, z1, r0, r1] = c;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
  const r = r0 + (r1 - r0) * t;
  return [Math.hypot(x - x0 - dx * t, z - z0 - dz * t) - r, r];
}

/** Signed distance to the valley floor (negative inside the valley floor, positive inside the rock wall), without noise */
function openRaw(x: number, z: number): [number, number] {
  let d = 1e9;
  let rr = 10;
  for (const [bx, bz, rx, rz] of BASINS) {
    const q = Math.hypot((x - bx) / rx, (z - bz) / rz);
    const e = (q - 1) * Math.min(rx, rz);
    if (e < d) {
      d = e;
      rr = Math.min(rx, rz);
    }
  }
  for (const c of CANYONS) {
    const [e, r] = capsule(x, z, c);
    if (e < d) {
      d = e;
      rr = r;
    }
  }
  return [d, rr];
}

// 1 m grid cache (terrain, coloring and props all query it heavily)
const N = SIZE * 2 + 1;
let grid: Float32Array | null = null;
let buttes: Float32Array | null = null;

function build(): void {
  grid = new Float32Array(N * N);
  buttes = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = i - SIZE;
      const z = j - SIZE;
      const [d, r] = openRaw(x, z);
      // Undulation of the rock wall: narrow cracks get less noise so that they don't get sealed off entirely
      const k = Math.max(0.28, Math.min(1, (r - 2.5) / 6));
      const warp = (2.3 * snoise(x * 0.065 + 3.1, z * 0.065 - 1.7) + 0.9 * snoise(x * 0.19, z * 0.19 + 5)) * k;
      let w = d + warp;
      let bh = 0;
      for (const [bx, bz, br, h] of BUTTES) {
        // Buttes: rock pillars that rise out of the valley floor, with the same cliff + scree slope around them
        const e = br + 2.2 - Math.hypot(x - bx, z - bz) + 0.7 * snoise(x * 0.3, z * 0.3);
        if (e > w) {
          w = e;
          bh = h;
        }
      }
      grid[j * N + i] = w;
      buttes[j * N + i] = bh;
    }
  }
}

function lerpGrid(a: Float32Array, x: number, z: number): number {
  const fx = Math.min(N - 1.001, Math.max(0, x + SIZE));
  const fz = Math.min(N - 1.001, Math.max(0, z + SIZE));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  return a[j * N + i] * (1 - u) * (1 - v) + a[j * N + i + 1] * u * (1 - v) + a[(j + 1) * N + i] * (1 - u) * v + a[(j + 1) * N + i + 1] * u * v;
}

/**
 * Distance to the edge of the valley floor: negative on the floor (more negative toward the middle of the valley), positive
 * going into the rock wall
 */
export function wallDist(x: number, z: number): number {
  if (!grid) build();
  return lerpGrid(grid!, x, z);
}

function butteH(x: number, z: number): number {
  if (!buttes) build();
  return lerpGrid(buttes!, x, z);
}

// ───────────────────────── Height ─────────────────────────

/**
 * Height of the mesa tops: low in the middle of the map, high around the outside, with the walls around the tower raised a bit
 * more
 */
export function plateau(x: number, z: number): number {
  const m = Math.max(Math.abs(x), Math.abs(z));
  const dt = Math.hypot(x - TOWER[0], z - TOWER[1]);
  return 13 + 9 * smooth(45, 100, m) + 2.6 * snoise(x * 0.03 + 9, z * 0.03) + 4 * (1 - smooth(25, 60, dt));
}

/** Valley floor: the Sleeping Tortoise Basin in the south is lowest, rising gently north toward the tower */
export function floorH(x: number, z: number): number {
  return 0.35 * snoise(x * 0.07, z * 0.07) + 0.25 * snoise(x * 0.19 + 7, z * 0.19) + 3.4 * smooth(-18, -66, z);
}

// Rock wall profile: a vertical cliff followed by a scree slope, stepping back layer by layer; each layer has a different
// thickness (hard sandstone forms cliffs, soft shale forms slopes)
const CL = [5.0, 3.4, 4.4, 2.8, 4.8, 3.6, 4.2, 3.0];
const TL = [1.3, 2.0, 1.1, 2.3, 1.2, 1.8, 1.4, 2.0];
/** World height of the top of each layer (mesa tops only come to rest at these heights) */
export const LEVELS: number[] = [0];
for (let i = 0; i < 12; i++) LEVELS.push(LEVELS[i] + CL[i % 8] + TL[i % 8]);
/** Height of the plateau outside the map */
export const RIM = LEVELS[8];

/**
 * d is the horizontal distance into the rock wall; wide adjusts how wide or narrow the scree slope is (varying along the wall)
 */
export function wallProfile(d: number, wide = 1): number {
  if (d <= 0) return 0;
  let base = 0;
  let x = d;
  for (let i = 0; i < 16; i++) {
    const c = CL[i % 8];
    const t = TL[i % 8];
    const cw = c * 0.16;
    const tw = (t / 0.62) * wide;
    if (x < cw) return base + c * smooth(0, cw, x);
    x -= cw;
    if (x < tw) return base + c + t * (x / tw);
    x -= tw;
    base += c + t;
  }
  return base;
}

/** Snap the height of a mesa top to the nearest layer top; where it crosses layers there is a sheer cliff */
export function quantTop(y: number): number {
  let k = 0;
  while (k < LEVELS.length - 2 && LEVELS[k + 1] <= y) k++;
  const a = LEVELS[k];
  const b = LEVELS[k + 1];
  const f = (y - a) / (b - a);
  return a + (b - a) * smooth(0.82, 1, f) + 0.25 * f;
}

/** Butte: a skirt of low scree, then an almost vertical rock pillar */
function butteProfile(d: number, top: number): number {
  if (d <= 0) return 0;
  return 1.3 * Math.min(1, d / 2.2) + (top - 1.3) * smooth(2.2, 3.4, d);
}

/**
 * The amount the engine automatically raises at the map edge (compose.ts's cliff boundary); the terrain subtracts it first, and
 * the edge is instead piled up here into a stepped rock wall
 */
export function engineEdge(x: number, z: number): number {
  const S = SIZE;
  const m = Math.max(Math.abs(x), Math.abs(z)) + Math.sin(x * 0.11) * 3 + Math.cos(z * 0.13) * 3;
  const e = smooth(S - 30, S - 4, m);
  return e * (18 + Math.sin(x * 0.21 + z * 0.17) * 4 + Math.sin(x * 0.07 - z * 0.05) * 5);
}

/**
 * Top of the rock wall (world height, not snapped to the layers): low in the middle, high around the outside, with the
 * outermost ring joining the outer plateau
 */
function topAt(x: number, z: number): number {
  const m = Math.max(Math.abs(x), Math.abs(z)) + 3 * snoise(x * 0.05, z * 0.05);
  return Math.min(RIM + 0.5, plateau(x, z) + 34 * smooth(SIZE - 36, SIZE - 8, m));
}

/**
 * Profile of the tortoise shell (r is the distance to the shell's center): an arched surface on top, with the rim rolling
 * smoothly downward
 */
export function shellProfile(r: number): number {
  const R = SHELL[2];
  if (r <= R - 4.5) return TOWN_H - 3 * (r / (R - 4.5)) ** 2;
  if (r <= R) {
    const u = (r - (R - 4.5)) / 4.5;
    return 3 + (TOWN_H - 3 - 3) * Math.sqrt(Math.max(0, 1 - u * u));
  }
  return 3 * (1 - smooth(R, R + 1.8, r));
}

function segProj(x: number, z: number, ax: number, az: number, bx: number, bz: number): [number, number] {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return [Math.hypot(x - ax - dx * t, z - az - dz * t), t];
}

/** Distance to the centerline of the Royal Stair and the height of the stair surface there */
export function rampAt(x: number, z: number): [number, number] {
  let best = 1e9;
  let hh = 0;
  for (let i = 0; i < RAMP.length - 1; i++) {
    const a = RAMP[i];
    const b = RAMP[i + 1];
    const [d, t] = segProj(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) {
      best = d;
      hh = a[2] + (b[2] - a[2]) * t;
    }
  }
  return [best, hh];
}

/** Shallow pools in the secret realm and the Glassworks: [x, z, radius, depth] */
export const POOLS: [number, number, number, number][] = [
  [SPOT.pool[0], SPOT.pool[1], 4.3, 0.9],
  [SPOT.grotto[0] + 2.5, SPOT.grotto[1] - 4.5, 3.0, 0.7],
];

export function rawHeight(x: number, z: number): number {
  const fl = floorH(x, z);
  const d = wallDist(x, z);
  const bh = butteH(x, z);
  let h: number;
  if (bh > 0) h = fl + butteProfile(d, bh);
  else {
    const wide = 0.55 + 0.9 * vnoise(x * 0.045 + 2, z * 0.045 - 3);
    const top = quantTop(topAt(x, z));
    const w = fl + wallProfile(d, wide);
    // Round off the mesa edge a bit
    const s = 0.8;
    h = w < top - s ? w : top - s * Math.exp(-(w - top + s) / s);
  }
  // The tortoise's shell
  const rs = Math.hypot(x - SHELL[0], z - SHELL[1]);
  if (rs < SHELL[2] + 3) h = Math.max(h, shellProfile(rs));
  // Quicksand Hollow: sunk in the middle
  const dq = Math.hypot(x - SPOT.quick[0], z - SPOT.quick[1]);
  if (dq < 11) h -= 1.15 * (1 - smooth(1.5, 9.5, dq));
  // The Order's dig pit: dug down ring by ring
  const dg = Math.hypot(x - SPOT.dig[0], z - SPOT.dig[1]);
  if (dg < 11) {
    const k = 1 - smooth(2.5, 9.5, dg);
    h -= 4.6 * k * k * (3 - 2 * k) * 0.5 + 2.3 * k;
  }
  for (const [px, pz, pr, pd] of POOLS) {
    const e = Math.hypot(x - px, z - pz);
    if (e < pr + 2) h -= pd * (1 - smooth(pr * 0.35, pr + 1.2, e));
  }
  // Royal Stair: cut into the tortoise shell, with a steep embankment on the outside
  const [rd, rh] = rampAt(x, z);
  if (rd < RAMP_W + 8) {
    if (rd < RAMP_W) h = rh;
    else if (h > rh) h = rh + (h - rh) * smooth(RAMP_W, RAMP_W + 1.6, rd);
    else h = Math.max(h, rh - 3.2 * (rd - RAMP_W));
  }
  return h - engineEdge(x, z);
}

/** Whether this is walkable valley floor (check before placing spirits, chests and valley-floor props) */
export function isFloor(x: number, z: number, margin = 0): boolean {
  return wallDist(x, z) < -margin;
}
