// Stoneheart Canyon (earth): a canyon maze cut through layers of red rock. In the Sleeping Tortoise Basin to the south a giant
// tortoise sleeps, and the dwarves' Shellback Citadel is built on top of its shell. A Royal Stair winds down along the shell's
// rim, past the tortoise's head resting on the ground, and into the criss-crossing canyon paths to the north:
// to the west are the Glassworks and its waterfall, the Quicksand Hollow with its seven warning pillars, and the Crystalheart
// Grotto hidden deep in a narrow crack; to the east are the huge Wind-Carved Arch, Hoodoo Valley, the mine and the rails;
// due north, through Skythread Gorge, stands the Stoneheart Seal Tower with its foundation already cracked, and beside it the
// pit the Order dug.

import * as THREE from 'three';
import { samplePath } from '../compose.ts';
import type { Biome, FieldCtx, XZ } from '../kit.ts';
import { POOLS, RAMP, SHELL, SIZE, SPOT, TOWER, TOWN, TOWN_R, floorH, isFloor, rampAt, smooth, vnoise, wallDist } from './canyon/geo.ts';
import { SHELL_MARK, patchTerrain } from './canyon/shaders.ts';
import { buildCanyon } from './canyon/decor.ts';
import { composeInverse } from './canyon/engine.ts';

const LAYOUT: Biome['layout'] = {
  size: SIZE,
  edge: 'cliff',
  town: TOWN,
  townR: TOWN_R,
  tower: TOWER,
  spawn: [2.5, 50.5, Math.PI],
  waypoint: [9, 64],
  pathW: 2.6,
  path: [
    [0, 72],
    [-2, 63],
    ...RAMP.map(([x, z]) => [x, z] as XZ),
    [-28, 12],
    [-16, 5],
    [-6, 0],
    [-3, -10],
    [-1, -21],
    [3, -31],
    [4, -42],
    [1.5, -51],
    [0, -59],
  ],
  trails: [
    // In front of the tortoise's nose → Rail Valley to the east
    [[-16, 5], [0, 12], [20, 18], [38, 27]],
    // Lift → along the rails → Hoodoo Valley → mine
    [[40, 66], [44, 50], [41, 32], [44, 14], [47, -4], [56, -22], [66, -36], [74, -46]],
    // Triple Fork → arch → Hoodoo Valley
    [[-3, -12], [12, -10], [30, -9], [46, -8]],
    // Mine → edge of the dig site → in front of the tower
    [[74, -46], [68, -58], [54, -67], [40, -65], [26, -66], [14, -70]],
    // Basin → Glassworks
    [[-34, 24], [-48, 22], [-61, 17]],
    // Triple Fork → Quicksand Hollow
    [[-8, -16], [-26, -25], [-42, -35], [-49, -37]],
  ],
  zones: [
    { x: -44, z: 32, r: 9, tier: 0, count: 2, species: ['monolith', 'digmole'] },
    { x: 44, z: 40, r: 9, tier: 0, count: 3, species: ['monolith', 'voltadillo', 'digmole'] },
    { x: -6, z: -15, r: 8, tier: 1, count: 2, species: ['monolith', 'gargoyle', 'voltadillo'], corrupt: 0.12 },
    { x: -62, z: 12, r: 9, tier: 1, count: 3, species: ['prismsnail', 'pyrewing', 'monolith'], corrupt: 0.12 },
    { x: 49, z: -12, r: 8, tier: 1, count: 3, species: ['rhino', 'voltadillo', 'gargoyle', 'monolith'], corrupt: 0.15 },
    { x: 68, z: -38, r: 8, tier: 1, count: 2, species: ['digmole', 'pyrewing', 'monolith'], corrupt: 0.15 },
    { x: -52, z: -38, r: 10, tier: 2, count: 3, species: ['sand_reaper', 'rhino', 'voltadillo'], corrupt: 0.28 },
    { x: 36, z: -68, r: 7, tier: 2, count: 3, species: ['gargoyle', 'digmole', 'pyrewing'], corrupt: 0.35 },
    { x: -19, z: -70, r: 7, tier: 2, count: 2, species: ['gargoyle', 'monolith', 'rhino'], corrupt: 0.3 },
    { x: -82, z: -78, r: 5, tier: 2, count: 2, species: ['sandserpent', 'sand_reaper'], corrupt: 0.15 },
  ],
  chests: [
    [9, 15],
    [-77, 15.5],
    [61, -17],
    [82, -42],
    [-37, -88],
    [-88, -81.5],
  ],
  npcs: [
    [-2, 51.2, 1.75],
    [25, 67, -1.2],
    [-6.5, 81, 0.5],
  ],
};

// ───────────────────────── Road distance (so the road surface keeps its original color when painting the ground) ─────────────────────────

let roadGrid: Float32Array | null = null;
const RN = SIZE * 2 + 1;
function roadDist(x: number, z: number): number {
  if (!roadGrid) {
    roadGrid = new Float32Array(RN * RN).fill(30);
    const pts = [samplePath(LAYOUT.path, 1), ...(LAYOUT.trails ?? []).map((t) => samplePath(t, 1))].flat();
    // Only mark cells within 8 m of the road
    for (const [px, pz] of pts) {
      for (let j = Math.floor(pz) - 8; j <= Math.ceil(pz) + 8; j++) {
        for (let i = Math.floor(px) - 8; i <= Math.ceil(px) + 8; i++) {
          if (i < -SIZE || i > SIZE || j < -SIZE || j > SIZE) continue;
          const k = (j + SIZE) * RN + (i + SIZE);
          const d = Math.hypot(i - px, j - pz);
          if (d < roadGrid[k]) roadGrid[k] = d;
        }
      }
    }
  }
  const fx = Math.min(RN - 1.001, Math.max(0, x + SIZE));
  const fz = Math.min(RN - 1.001, Math.max(0, z + SIZE));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const g = roadGrid;
  return g[j * RN + i] * (1 - u) * (1 - v) + g[j * RN + i + 1] * u * (1 - v) + g[(j + 1) * RN + i] * (1 - u) * v + g[(j + 1) * RN + i + 1] * u * v;
}

// ───────────────────────── Ground coloring ─────────────────────────

const C = (h: number) => new THREE.Color(h);
const SAND = C(0xe2b07a);
const DIRT = C(0xcf8f5c);
const PLAYA = C(0xefd3a8);
const TALUS = C(0xb86a44);
const TOP = C(0xb4704a);
const TOP2 = C(0xcc8e5c);
const SCRUB = C(0x98905a);
const PAVE = C(0xd8c2a0);
const MARK = C(SHELL_MARK);
const QUICK = C(0xe8c08a);
const SOIL = C(0x6e4a42);
const HEX = C(0x5a3a58);
const GLASS = C(0xf0dcb4);
const GROT = C(0x9a6a5a);
const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

function paint(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
  const pw = 1 - smooth(LAYOUT.pathW * 0.55, LAYOUT.pathW + 1.1, roadDist(x, z));
  const d = wallDist(x, z);
  const fl = floorH(x, z);
  const n1 = vnoise(x * 0.05, z * 0.05);
  const n2 = vnoise(x * 0.23 + 4, z * 0.23);
  const c = tmp.copy(SAND).lerp(DIRT, smooth(0.35, 0.8, n1) * 0.8);
  c.lerp(PLAYA, smooth(0.62, 0.8, vnoise(x * 0.028 + 11, z * 0.028)) * 0.7);
  c.multiplyScalar(0.94 + n2 * 0.1);
  // Scree at the foot of the rock walls
  c.lerp(TALUS, smooth(-4.5, 0, d) * 0.55);
  // Ledges on the rock walls and mesa tops
  const up = h - fl;
  if (up > 2.2) {
    const top = tmp2.copy(TOP).lerp(TOP2, smooth(0.3, 0.75, n1));
    top.lerp(SCRUB, smooth(0.62, 0.85, n2) * 0.45);
    if (slope > 0.35) top.lerp(TALUS, smooth(0.35, 0.7, slope) * 0.8);
    c.lerp(top, smooth(2.2, 4, up));
  }
  // Tortoise shell: painted with the marker color, and the shader draws the scutes
  const rs = Math.hypot(x - SHELL[0], z - SHELL[1]);
  if (rs < SHELL[2] + 3) {
    const [rd] = rampAt(x, z);
    const k = (1 - smooth(SHELL[2] + 1, SHELL[2] + 2.6, rs)) * smooth(TOWN_R * 0.62, TOWN_R * 0.8, rs) * smooth(3.4, 4.6, rd);
    c.lerp(MARK, k);
  }
  // Royal Stair: stone slabs
  const [rd, rh] = rampAt(x, z);
  if (rd < 5 && Math.abs(h - rh) < 1.5) c.lerp(PAVE, 1 - smooth(3.2, 4.2, rd));
  // Pale fine sand around the Quicksand Hollow
  const dq = Math.hypot(x - SPOT.quick[0], z - SPOT.quick[1]);
  if (dq < 18) c.lerp(QUICK, (1 - smooth(8, 17, dq)) * 0.8);
  // Dig pit: turned-up dark soil, corrupted purple
  const dg = Math.hypot(x - SPOT.dig[0], z - SPOT.dig[1]);
  if (dg < 16) {
    c.lerp(SOIL, (1 - smooth(6, 14, dg)) * 0.85);
    c.lerp(HEX, (1 - smooth(1, 6, dg)) * 0.6);
  }
  // Glassworks: white sand
  const dw = Math.hypot(x - SPOT.glass[0], z - SPOT.glass[1]);
  if (dw < 16 && up < 2) c.lerp(GLASS, (1 - smooth(6, 15, dw)) * 0.7);
  // Crystalheart Grotto: cooler rock color
  const dc = Math.hypot(x - SPOT.grotto[0], z - SPOT.grotto[1]);
  if (dc < 14) c.lerp(GROT, (1 - smooth(5, 13, dc)) * 0.6);
  for (const [px, pz, pr] of POOLS) {
    const e = Math.hypot(x - px, z - pz);
    if (e < pr + 3) c.lerp(TALUS, (1 - smooth(pr, pr + 2.5, e)) * 0.5);
  }
  // The stone plaza at the center of the town keeps the engine's color
  const town = 1 - smooth(TOWN_R * 0.55, TOWN_R * 0.7, rs);
  out.lerp(c, (1 - pw) * (1 - town * 0.9));
}

// ───────────────────────── Grass ─────────────────────────

const GRASS_A = C(0xd9b46a);
const GRASS_B = C(0xa89048);
const GRASS_C = C(0xc8a060);

function grassCover(x: number, z: number, h: number, slope: number): number {
  if (!isFloor(x, z, 0.5)) {
    // An occasional clump on top of the mesas
    return h - floorH(x, z) > 8 && slope < 0.3 ? 0.25 * smooth(0.55, 0.75, vnoise(x * 0.09, z * 0.09)) : 0;
  }
  if (Math.hypot(x - SHELL[0], z - SHELL[1]) < SHELL[2] + 2) return 0;
  if (Math.hypot(x - SPOT.quick[0], z - SPOT.quick[1]) < 14) return 0;
  if (Math.hypot(x - SPOT.dig[0], z - SPOT.dig[1]) < 14) return 0;
  if (Math.hypot(x - SPOT.glass[0], z - SPOT.glass[1]) < 9) return 0;
  const n = vnoise(x * 0.07 + 3, z * 0.07);
  // Grass clumps at the wall feet and in the valleys
  const edge = smooth(-5, -1.5, wallDist(x, z)) * 0.5;
  return Math.min(1, smooth(0.5, 0.72, n) * 0.85 + edge * smooth(0.3, 0.6, n));
}

export const canyon: Biome = {
  layout: LAYOUT,
  cols: { grass: 0xe2b07a, grass2: 0xcf8f5c, path: 0xe9c794, cliff: 0xb05c3c, sand: 0xe6c08a, plaza: 0xcfb495 },
  fog: [70, 310],
  palette: {
    sky: ['#5a4a94', '#ee8f5a', '#ffd9a6'],
    fog: 0xf0c48e,
    light: [-0.72, 0.5, 0.24],
    ambient: 0xc99a7c,
    rim: 0xffd6a0,
    shadow: 0x8c4d4a,
    motes: [0xf2c894, 0xe0a870, 0xffe2b8],
    moteKind: 'drift',
  },
  // Keep the engine's road / town / tower-base flattening from turning the rock walls into slopes (see canyon/engine.ts)
  height: composeInverse(LAYOUT),
  paint,
  grass: {
    density: 0.85,
    height: 0.8,
    tip: 0xf6e2a4,
    cover: grassCover,
    color: (x, z, out) => {
      out.copy(GRASS_A).lerp(GRASS_B, smooth(0.3, 0.8, vnoise(x * 0.06, z * 0.06)) * 0.7).lerp(GRASS_C, smooth(0.5, 0.9, vnoise(x * 0.3, z * 0.3)) * 0.5);
    },
  },
  tower: { stone: 0xdcae7e, stoneDark: 0x8e5c46, trim: 0xe8c060, roof: 0x3f8a78, glow: 0xffb040, kind: 'spire' },
  decorate(ctx: FieldCtx) {
    if (!patchTerrain(ctx.terrain.mesh, SHELL)) console.warn('canyon: terrain shader patch skipped');
    buildCanyon(ctx);
  },
};
