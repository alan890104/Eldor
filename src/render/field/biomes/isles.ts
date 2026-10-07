// Tidesong Isles (water): the field map.
// In the south is Harbor Isle, home of Lighthouse Harbor; a wooden boardwalk crosses the inner bay northward to Palm Grove
// Isle (Sacred Whale bones, Springheart Pool),
// then a shoal is waded to Hot Spring Isle, where warm meets cold, and a wooden bridge leads up to Icefield Isle in the
// north. The Tidesong Seal Tower is at the far end of the icefield, half frozen over,
// with the Order's black-sailed ship moored in the ice bay below the tower and the Sacred Whale chained in the ice.
// To the east are Lighthouse Cape and Wreck Reef, to the west Coral Atoll and Windy Cape,
// and north of Windy Cape hides an unmarked sandbar leading to the secret realm "Siren Reef".
// Terrain, roads and coloring are in isles/terrain.ts; the town is in isles/town.ts; the field of the north and south halves
// is in isles/south.ts and isles/north.ts.

import * as THREE from 'three';
import type { Biome } from '../kit.ts';
import { buildCamps } from './isles/camps.ts';
import { flags, halos, ocean } from './isles/fx.ts';
import { buildNorth } from './isles/north.ts';
import { buildShores } from './isles/shore.ts';
import { buildSouth } from './isles/south.ts';
import { buildTown } from './isles/town.ts';
import { ATOLL, CAPE, cold, grassCover, islesHeight, islesPaint, PATH, PATH_W, POND, REEF, ROOKERY, SIZE, TOWER, TOWN, TOWN_R, TRAILS, WRECK } from './isles/terrain.ts';

const GRASS_A = new THREE.Color(0x8ad86a);
const GRASS_B = new THREE.Color(0x52b454);
const GRASS_COLD = new THREE.Color(0x9cc49a);

export const isles: Biome = {
  cols: { grass: 0x7ccc5e, grass2: 0x55ad50, path: 0xead7a8, cliff: 0x8f9cac, sand: 0xf5e5b6, plaza: 0xe6dac2 },
  fog: [85, 340],
  palette: {
    sky: ['#2c8ce8', '#94d2ff', '#effaff'],
    fog: 0xd4ecff,
    ambient: 0xaccae4,
    motes: [0xe4fbff, 0xffffff],
    moteKind: 'float',
  },
  layout: {
    size: SIZE,
    edge: 'water',
    town: TOWN,
    townR: TOWN_R,
    tower: TOWER,
    spawn: [-3.5, 67, Math.PI],
    waypoint: [9.5, 69],
    pathW: PATH_W,
    path: PATH,
    trails: TRAILS,
    zones: [
      // Harbor Isle: the beach near the town and the grassy slope below the lighthouse
      { x: 18, z: 84, r: 13, tier: 0, count: 3, species: ['bubblecrab', 'cloudfluff', 'skyreign'] },
      { x: -34, z: 84, r: 11, tier: 0, count: 2, species: ['bubblecrab', 'lanternfish', 'cloudfluff'] },
      // Palm Grove Isle
      { x: 2, z: 20, r: 13, tier: 1, count: 3, species: ['cloudfluff', 'skyreign', 'bubblecrab', 'oathsea_sage'], corrupt: 0.1 },
      { x: POND[0], z: POND[1] + 1, r: 7, tier: 1, count: 1, species: ['springlotus', 'oathsea_sage'], corrupt: 0.1 },
      // Coral Atoll (the lagoon can be waded)
      { x: ATOLL.x, z: ATOLL.z, r: 13, tier: 1, count: 3, species: ['bubblecrab', 'oathsea_sage', 'swordfish', 'lanternfish'], corrupt: 0.12 },
      // Wreck Reef
      { x: WRECK[0] - 2, z: WRECK[1] + 3, r: 10, tier: 1, count: 2, species: ['lanternfish', 'swordfish', 'bubblecrab'], corrupt: 0.18 },
      // Windy Cape
      { x: CAPE[0] + 5, z: CAPE[1], r: 10, tier: 1, count: 2, species: ['skyreign', 'cloudfluff', 'oathsea_sage'], corrupt: 0.12 },
      // Foghorn Hot Springs
      { x: 18, z: -29, r: 9, tier: 1, count: 2, species: ['steameel', 'icecrown', 'oathsea_sage'], corrupt: 0.15 },
      // Icefield: where the wooden bridge comes ashore, the Penguin Ice Cliff, the Ice Bay Overlook
      { x: -6, z: -64, r: 12, tier: 2, count: 2, species: ['icecrown', 'swordfish', 'lanternfish'], corrupt: 0.25 },
      { x: ROOKERY[0] - 4, z: ROOKERY[1] + 2, r: 12, tier: 2, count: 3, species: ['icecrown', 'skyreign'], corrupt: 0.2 },
      { x: 26, z: -80, r: 10, tier: 2, count: 1, species: ['icecrown', 'swordfish'], corrupt: 0.3 },
      // Secret realm: Siren Reef
      { x: REEF.x + 2, z: REEF.z + 2, r: 7, tier: 2, count: 2, species: ['siren', 'oathsea_sage', 'swordfish'], corrupt: 0.2 },
    ],
    chests: [
      [48, 67],
      [ATOLL.x - 11.4, ATOLL.z + 1.2],
      [WRECK[0] - 4.5, WRECK[1] + 5.5],
      [POND[0] - 4, POND[1] + 7],
      [ROOKERY[0] + 7, ROOKERY[1] - 4],
      [REEF.x + 4.2, REEF.z + 5.2],
    ],
    npcs: [
      [-7.5, 63.5, 0.6],
      [-28, 49.5, Math.PI + 0.3],
      [12.5, 74.5, -1.3],
    ],
  },
  height: islesHeight,
  paint: islesPaint,
  water: { level: 0, shallow: 0x3fd4d0, deep: 0x1564b0, foam: 0xf2fffe },
  grass: {
    density: 1.0,
    height: 0.85,
    tip: 0xe4f7a2,
    cover: (x, z, h) => grassCover(x, z, h),
    color: (x, z, out) => {
      out.copy(GRASS_A).lerp(GRASS_B, Math.max(0, Math.min(1, 0.5 + Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * 0.5)));
      out.lerp(GRASS_COLD, cold(x, z));
    },
  },
  tower: { stone: 0xe6eef4, stoneDark: 0x86a2ba, trim: 0x2f6eaa, roof: 0x2a5f92, glow: 0x6ad8ff, kind: 'spire' },
  decorate(ctx) {
    ocean(ctx);
    const town = buildTown(ctx);
    const south = buildSouth(ctx);
    const north = buildNorth(ctx);
    // Small scenes on each island: the Palm Grove Isle camp, the Order's camp and black-sailed ship in the ice bay,
    // the Tidesong Festival after purification
    const camps = buildCamps(ctx);
    // Ground detail is scattered last: it avoids the houses, trees and rocks already placed
    buildShores(ctx);
    ctx.b.lift = 0;
    flags(ctx, [...town.flags, ...south.flags, ...north.flags, ...camps.flags]);
    // Warm lights (windows, lanterns) and cold lights (ice lamps, deep-sea lantern mothers, Siren Reef) go into two groups of glows
    const all = [...town.lights, ...south.lights, ...north.lights, ...camps.lights];
    const warm = all.filter(([x, , z]) => cold(x, z) < 0.5 && Math.hypot(x - REEF.x, z - REEF.z) > 20 && Math.hypot(x - WRECK[0], z - WRECK[1]) > 6);
    const coolL = all.filter((p) => !warm.includes(p));
    const setWarm = halos(ctx, warm, 0xffc870, 0.55);
    const setCool = halos(ctx, coolL, 0x9ad8ff, 0.5);
    ctx.extras.push((_dt, t) => {
      setWarm(0.9 + Math.sin(t * 1.7) * 0.08);
      setCool(0.85 + Math.sin(t * 1.1 + 1) * 0.15);
    });
  },
};
