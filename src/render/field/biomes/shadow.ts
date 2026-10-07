// Duskshade Hollow (dark): the everdark great cavern under the continent. The cave ceiling is seventy meters high,
// covered in glowworms like a starry sky, with a few cracks letting moonlight through.
// From Lampglow Village in the southeast (Thousand-Lamp Pillar, Society stone houses), lanterns lead along the road one by
// one to the northwest: Glowgrass Meadow -> Everdark Lake's east shore (pier, glowing jellyfish,
// Moonspring Falls dropping from the ceiling) -> Capwood -> the Tomb Gate of the ancient kingdom -> Stele Gorge climbing to
// the northern plateau, which ends at the Duskshade Seal Tower, whose top arches into a crack in the ceiling.
// Side routes: the Sunken Tomb in the southwest, the Old Stone Causeway on the lake's west shore (leading to the secret
// realm Sunken Moon Isle), the Unlit Wood in the east where every lamp has gone out, Silkthread Vale climbing the Root
// Slope, and the Moonlit Glade in the woods.

import * as THREE from 'three';
import { GlowSet } from '../../arenas/_woods.ts';
import type { Biome } from '../kit.ts';
import {
  COLUMNS,
  CRYPT,
  CRYPT_FLOOR,
  GLADE,
  GROVE,
  ISLE,
  LAKE,
  LIT,
  MEADOW,
  PATH,
  S,
  SILK,
  SPAWN,
  TOWER,
  TOWN,
  TOWN_R,
  TRAILS,
  WATER,
  cryptDist,
  cryptLocal,
  cryptWorld,
  gorgeUV,
  lakeEdge,
  polyDist,
  CAUSEWAY,
  rawHeight,
  sm,
  upMask,
} from './shadow/common.ts';
import { ceiling, groundLights, groundShadows, overviewLid, type GroundLight } from './shadow/fx.ts';
import { buildTown } from './shadow/town.ts';
import { buildWild } from './shadow/wild.ts';

// Ground color
const MOSS = new THREE.Color(0x24506a);
const WARM = new THREE.Color(0x7a5a4e);
const STONE = new THREE.Color(0x4a4562);
const FLAG = new THREE.Color(0x57516e);
const FLAG2 = new THREE.Color(0x48435e);
const ROT = new THREE.Color(0x1c1426);
const VEIN = new THREE.Color(0x6a2a9a);
const SILVER = new THREE.Color(0x626488);
const WALL = new THREE.Color(0x2e2944);
const WALL2 = new THREE.Color(0x423a5c);
const GRASS_A = new THREE.Color(0x353868);
const GRASS_B = new THREE.Color(0x2a4a66);
const GRASS_DEAD = new THREE.Color(0x2a2236);
const GRASS_SILK = new THREE.Color(0x5a5c86);

const nz = (x: number, z: number) => Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.11 + Math.sin(x * 0.05) * 2);

/** How brightly the lanterns light things (0-1): shared by the ground coloring and the grass color */
function lampLight(x: number, z: number): number {
  let m = 0;
  for (const l of LIT) {
    const dx = x - l.x;
    const dz = z - l.z;
    if (Math.abs(dx) > 7 || Math.abs(dz) > 7) continue;
    m = Math.max(m, 1 - sm(0.5, 7, Math.hypot(dx, dz)));
  }
  const dt = Math.hypot(x - TOWN[0], z - TOWN[1]);
  return Math.max(m, (1 - sm(TOWN_R * 0.5, TOWN_R + 4, dt)) * 0.7);
}

export const shadow: Biome = {
  cols: { grass: 0x323462, grass2: 0x28405c, path: 0x766c96, cliff: 0x363050, sand: 0x3c3858, plaza: 0x5c5678 },
  fog: [24, 195],
  palette: {
    sky: ['#04030a', '#100a22', '#231640'],
    fog: 0x191330,
    light: [0.28, 0.9, 0.34],
    ambient: 0x7a6cb4,
    rim: 0xb8a0ff,
    shadow: 0x2a1a4a,
    motes: [0x9a6aff, 0x6ad8ff, 0xc0a0ff, 0xffc070],
    moteKind: 'float',
    stars: true,
  },
  layout: {
    size: S,
    edge: 'cliff',
    town: TOWN,
    townR: TOWN_R,
    tower: TOWER,
    spawn: [SPAWN[0], SPAWN[1], Math.atan2(TOWER[0] - SPAWN[0], TOWER[1] - SPAWN[1])],
    waypoint: [24, 61],
    pathW: 2.4,
    path: PATH,
    trails: TRAILS,
    zones: [
      { x: MEADOW[0] - 7, z: MEADOW[1] - 6, r: 13, tier: 0, count: 4, species: ['maskfox', 'inkcat', 'dreamcap', 'eclipse_batlord'] },
      { x: 64, z: 66, r: 10, tier: 0, count: 2, species: ['inkcat', 'maskfox', 'dreamcap'] },
      { x: -20, z: 18, r: 10, tier: 1, count: 3, species: ['abyssjelly', 'dreamcap', 'maskfox'], corrupt: 0.12 },
      { x: GLADE[0], z: GLADE[1], r: 11, tier: 1, count: 3, species: ['dreamcap', 'owlarchivist', 'eclipse_batlord'], corrupt: 0.12 },
      { x: CRYPT[0], z: CRYPT[1], r: 11, tier: 1, count: 3, species: ['tombhound', 'owlarchivist', 'inkcat'], corrupt: 0.15 },
      { x: GROVE[0], z: GROVE[1], r: 13, tier: 1, count: 3, species: ['maskfox', 'eclipse_batlord', 'tombhound'], corrupt: 0.35 },
      { x: 2, z: -66, r: 12, tier: 2, count: 3, species: ['eclipse_batlord', 'tombhound', 'owlarchivist', 'maskfox'], corrupt: 0.3 },
      { x: SILK[0], z: SILK[1], r: 11, tier: 2, count: 3, species: ['weaverspider', 'dreamcap', 'eclipse_batlord', 'owlarchivist'], corrupt: 0.25 },
      { x: ISLE[0], z: ISLE[1], r: 5.5, tier: 2, count: 2, species: ['siren', 'soul_lantern', 'abyssjelly'], corrupt: 0.2 },
    ],
    chests: [[3, 55], [-29.5, 8.5], cryptWorld(-7.2, 0), [84, 19], [66, -74], [ISLE[0], ISLE[1] + 2]],
    npcs: [
      [22.8, 43.2, 0.85],
      [42.5, 69.5, -1.9],
      [30.5, 83.5, -1.6],
    ],
  },
  height: rawHeight,
  water: { level: WATER, shallow: 0x2e3a86, deep: 0x0a0a24, foam: 0x7ab8ff },
  paint(x, z, h, slope, out) {
    const n1 = nz(x * 1.7, z * 1.7);
    // Glowing moss: patches of bluish-green ground
    const moss = sm(0.45, 0.8, n1) * (1 - sm(20, 34, Math.hypot(x - TOWN[0], z - TOWN[1])));
    out.lerp(MOSS, moss * 0.45);
    // Plateau and gorge: rocky
    const up = upMask(x, z);
    if (up > 0.3) out.lerp(STONE, (up - 0.3) * 0.5 * (0.6 + 0.4 * nz(x * 2.3, z * 2.3)));
    // The flagstone floor of the Sunken Tomb
    const cd = cryptDist(x, z);
    if (cd < 1.5) {
      const [qx, qz] = cryptLocal(x, z);
      const tile = (Math.floor(qx / 2) + Math.floor(qz / 2)) & 1 ? FLAG : FLAG2;
      out.lerp(tile, (1 - sm(0.5, 1.5, cd)) * 0.9);
    }
    void CRYPT_FLOOR;
    // The shrine floor on Sunken Moon Isle, the Old Stone Causeway
    const di = Math.hypot(x - ISLE[0], z - ISLE[1]);
    if (di < 6.5) out.lerp((Math.floor(Math.atan2(z - ISLE[1], x - ISLE[0]) * 3) + Math.floor(di / 1.6)) & 1 ? FLAG : FLAG2, (1 - sm(5, 6.5, di)) * 0.85);
    if (polyDist(CAUSEWAY, x, z) < 1.4 && h > WATER - 0.2) out.lerp(STONE, 0.7);
    // Unlit Wood: scorched ground with purple corruption veins
    const dg = Math.hypot(x - GROVE[0], z - GROVE[1]);
    if (dg < 24) {
      const k = 1 - sm(10, 24, dg);
      out.lerp(ROT, k * 0.7);
      const vein = Math.abs(Math.sin(x * 0.55 + Math.sin(z * 0.31) * 2.2) + Math.sin(z * 0.47 - x * 0.2) * 0.8);
      if (vein < 0.12) out.lerp(VEIN, k * (1 - vein / 0.12) * 0.8);
    }
    // Silkthread Vale: silvery-white ground covered in spider silk
    const ds = Math.hypot(x - SILK[0], z - SILK[1]);
    if (ds < 18) out.lerp(SILVER, (1 - sm(6, 18, ds)) * (0.45 + 0.25 * n1));
    // Mud on the lakeshore
    const le = lakeEdge(x, z);
    if (le < 3 && h > WATER - 0.3) out.lerp(new THREE.Color(0x2e2c48), (1 - sm(0, 3, le)) * 0.5);
    // Ground lit by lanterns
    out.lerp(WARM, lampLight(x, z) * 0.32);
    // Cave wall: steep slopes and the edge are dark rock strata
    const m = Math.max(Math.abs(x), Math.abs(z));
    const wall = Math.max(sm(0.5, 0.95, slope), sm(S - 30, S - 12, m));
    if (wall > 0) {
      const band = Math.sin(h * 0.9 + nz(x * 0.6, z * 0.6) * 2) * 0.5 + 0.5;
      out.lerp(band > 0.55 ? WALL2 : WALL, wall * 0.85);
    }
    // More stone-colored at the foot of the stalactite-stalagmite pillars
    for (const [cx, cz, r] of COLUMNS) {
      const d = Math.hypot(x - cx, z - cz);
      if (d < r + 6) out.lerp(STONE, (1 - sm(r, r + 6, d)) * 0.6);
    }
    void gorgeUV;
  },
  grass: {
    density: 1.05,
    height: 0.95,
    tip: 0x9ab4ff,
    cover(x, z, h, slope) {
      void h;
      void slope;
      let c = 0.55 + 0.45 * sm(-0.5, 0.5, nz(x * 1.3, z * 1.3));
      c *= 1 - upMask(x, z) * 0.55;
      if (cryptDist(x, z) < 1.5) return 0;
      if (Math.hypot(x - ISLE[0], z - ISLE[1]) < 6.5) return 0;
      const dm = Math.hypot(x - MEADOW[0], z - MEADOW[1]);
      c = Math.max(c, 1 - sm(16, 28, dm));
      if (Math.hypot(x - GROVE[0], z - GROVE[1]) < 18) c *= 0.5;
      if (Math.hypot(x - GLADE[0], z - GLADE[1]) < 3) return 0;
      if (Math.max(Math.abs(x), Math.abs(z)) > S - 24) c *= 0.3;
      return c;
    },
    color(x, z, out) {
      out.copy(GRASS_A).lerp(GRASS_B, sm(-0.4, 0.6, nz(x, z)));
      const dg = Math.hypot(x - GROVE[0], z - GROVE[1]);
      if (dg < 22) out.lerp(GRASS_DEAD, 1 - sm(10, 22, dg));
      const ds = Math.hypot(x - SILK[0], z - SILK[1]);
      if (ds < 18) out.lerp(GRASS_SILK, (1 - sm(6, 18, ds)) * 0.7);
      out.lerp(WARM, lampLight(x, z) * 0.35);
    },
  },
  tower: { stone: 0x5a5474, stoneDark: 0x3a3452, trim: 0xa4a2c8, roof: 0x2a2444, glow: 0xffb45a, kind: 'spire' },
  decorate(ctx) {
    const t0 = performance.now();
    const lamps = [new GlowSet(0xffb45a), new GlowSet(0xffa84a), new GlowSet(0xffbe6a)];
    const big = new GlowSet(0xffb050);
    const eye = new GlowSet(0xa46aff);
    const cold = new GlowSet(0x6ae8ff);
    const pools: GroundLight[] = [];
    const ceil = ceiling(ctx);
    overviewLid(ctx, 30);
    buildTown(ctx, lamps, big, eye, pools);
    buildWild(ctx, { lamps, big, eye, cold }, pools, ceil);
    groundShadows(ctx);
    groundLights(ctx, pools);
    if (location.search.includes('sdbg')) console.log(`shadow decorate ${Math.round(performance.now() - t0)} ms`);
    // Breathing, flickering lamplight
    const setL = lamps.map((g) => g.build(ctx.group, ctx.disposers));
    const setBig = big.build(ctx.group, ctx.disposers);
    const setEye = eye.build(ctx.group, ctx.disposers);
    const setCold = cold.build(ctx.group, ctx.disposers);
    ctx.extras.push((_dt, t) => {
      setL.forEach((f, i) => f(2.05 + 0.16 * Math.sin(t * (6.1 + i * 1.7) + i * 2) + 0.08 * Math.sin(t * (13.3 + i * 2.9))));
      setBig(2.2 + 0.25 * Math.sin(t * 1.4));
      setEye(1.8 + 0.5 * Math.sin(t * 0.9));
      setCold(1.9 + 0.35 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 3.7));
    });
  },
};

void LAKE;
