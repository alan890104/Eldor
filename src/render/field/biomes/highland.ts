// Azurehowl Highlands (wind): a large plateau floating on a sea of clouds, rising in tiers from south to north.
// At the south cliff edge is the Wing Folk's courier station, "Windpost Station" (its launch deck juts out over the cloud sea);
// the road climbs to Windherd Terrace (Shepherd's Slope in the west, Windmill Hill in the east, Letter Crane Cliff on the headland),
// crosses the Cloudrift Chasm that cuts in from the east on "Skyridge", a natural rock bridge, then climbs to Windsong Terrace
// (the Wind-Carved Stone Forest and Windsong Stone Ring in the northwest, Floatstone Hollow in the northeast, hidden beneath
// a giant floating rock), and finally reaches Azurehowl Seal Tower on its tower terrace.
// Grass, flags, clouds, drifting fluff and wind trails all follow the same strong wind blowing from the west-northwest.

import * as THREE from 'three';
import { smooth } from '../compose.ts';
import type { Biome } from '../kit.ts';
import { buildAir } from './highland/air.ts';
import { Anim } from './highland/anim.ts';
import { buildCliffs, interiorEdges, rimDressing, rimSolids, roadEdges, slopeSkirts } from './highland/cliffs.ts';
import { BASIN, BASIN_R, landD, rawHeight, rimLoops, S, TOWER, TOWN, TOWN_R, WX, WZ } from './highland/shape.ts';
import { buildIsles } from './highland/isles.ts';
import { buildSky } from './highland/sky.ts';
import { buildTown } from './highland/town.ts';
import { buildWild } from './highland/wild.ts';

const FOG = 0xd9e7f7;
const STRATA = [0xd8c6a2, 0xbca283, 0xa68b72, 0xcfb892, 0x9c8a7c, 0xc4a98a, 0xb39478, 0xd3c1a0].map((c) => new THREE.Color(c));
const DRY = new THREE.Color(0xb5c77a);
const LUSH = new THREE.Color(0x5fa85e);
const RIMROCK = new THREE.Color(0xb4a68c);
const MESA = new THREE.Color(0xa9b08a);
const MOSS = new THREE.Color(0x4f9a62);

export const highland: Biome = {
  cols: { grass: 0x8cc66a, grass2: 0x6eab58, path: 0xdccba2, cliff: 0xa8927a, sand: 0xcdbf9c, plaza: 0xd2c9b4 },
  fog: [70, 420],
  palette: { fog: FOG, sky: ['#3a8ae6', '#9dcdf8', '#e2eefb'] },
  layout: {
    size: S,
    edge: 'void',
    town: TOWN,
    townR: TOWN_R,
    tower: TOWER,
    spawn: [-4, 55, Math.PI],
    waypoint: [10, 63],
    pathW: 2.3,
    path: [[-4, 64], [-4, 54], [-1, 50], [8, 42.5], [15, 35], [17, 26], [19, 13], [21, 4], [19.8, -3], [21.2, -11], [20, -19], [16, -28], [6, -36], [-2, -44], [-4, -51], [-4, -57]],
    trails: [
      // Station -> launch deck
      [[-4, 76], [-7, 85], [-9.5, 93]],
      // Windherd Meadow going west: Dandelion Meadow -> climb to Windsong Terrace -> Wind-Carved Stone Forest -> Windsong Stone Ring -> back to the main road
      [[17, 26], [0, 28], [-16, 26], [-34, 22], [-50, 18], [-60, 8], [-61, -4], [-58, -16], [-61, -28], [-66, -38], [-60, -52], [-44, -46], [-30, -37], [-18, -33], [-6, -35], [6, -36]],
      // Station going west: down Shepherd's Slope to Windherd Meadow
      [[-16, 64], [-34, 60], [-50, 50], [-58, 40], [-60, 26], [-60, 8]],
      // Windherd Meadow going east: Windmill Hill -> Letter Crane Cliff
      [[17, 26], [30, 28], [44, 29], [60, 25], [74, 24], [86, 25]],
      // Windsong Terrace going east: into the rock cleft of Floatstone Hollow
      [[16, -28], [26, -31], [30, -33], [40, -40.2], [50, -47.5], [57, -52]],
    ],
    zones: [
      { x: 24, z: 68, r: 13, tier: 0, count: 3, species: ['dandelion', 'skyreign', 'cloudfluff'] },
      { x: -36, z: 66, r: 12, tier: 0, count: 2, species: ['skyreign', 'cloudfluff', 'dandelion'] },
      { x: -6, z: 22, r: 14, tier: 1, count: 3, species: ['dandelion', 'cloudfluff', 'candledove', 'skyreign'], corrupt: 0.1 },
      { x: -56, z: 36, r: 13, tier: 1, count: 3, species: ['stormram', 'cloudfluff', 'skyreign'], corrupt: 0.12 },
      { x: 48, z: 16, r: 12, tier: 1, count: 2, species: ['skyreign', 'dandelion', 'stormram'], corrupt: 0.12 },
      { x: 84, z: 24, r: 8, tier: 1, count: 2, species: ['papercrane', 'candledove'], corrupt: 0.15 },
      { x: -64, z: -56, r: 13, tier: 1, count: 3, species: ['papercrane', 'skyreign', 'lyrebird'], corrupt: 0.18 },
      { x: -24, z: -33, r: 9, tier: 1, count: 2, species: ['lyrebird', 'candledove', 'papercrane'], corrupt: 0.15 },
      { x: 20, z: -66, r: 10, tier: 2, count: 2, species: ['stormram', 'skyreign', 'lyrebird', 'papercrane'], corrupt: 0.3 },
      { x: -40, z: -82, r: 9, tier: 2, count: 2, species: ['skyreign', 'papercrane', 'stormram'], corrupt: 0.3 },
      { x: 60, z: -52, r: 9, tier: 2, count: 2, species: ['griffin', 'gale_weasel', 'lyrebird', 'skyreign'], corrupt: 0.25 },
    ],
    chests: [[51, 29], [-71, 44], [90, 27], [-81, -53], [-27, -38], [64, -56]],
    npcs: [[-8.5, 52, 0.5], [-12, 72, Math.PI / 2], [-18, 62, -1.9]],
  },
  height: rawHeight,
  // The "water" under the cloud sea: only there to make the depths beyond the cliff unwalkable (the surface is hidden under the opaque cloud sea)
  water: { level: -30, shallow: 0x5d80bd, deep: 0x3d5f9a, foam: 0x9fb4d8 },
  paint(x, z, h, slope, out) {
    const d = landD(x, z);
    if (d < -0.5) {
      // Beyond the cliff: rock strata
      const i = Math.floor((h + 200) / 2.4);
      out.copy(STRATA[i % STRATA.length]);
      return;
    }
    if (slope < 0.7) {
      // The windward west side is a drier yellow-green, the leeward east side a richer green
      out.lerp(DRY, smooth(-20, -85, x) * 0.4);
      out.lerp(LUSH, smooth(25, 85, x) * 0.28);
      // Grass-wave stripes along the wind direction
      const lane = Math.sin((x * WZ - z * WX) * 0.42 + Math.sin(x * 0.045 + z * 0.03) * 2.2);
      out.multiplyScalar(1 + lane * 0.04);
      // Tower terrace: weathered stone ground
      const dt = Math.hypot(x - TOWER[0], z - TOWER[1]);
      out.lerp(MESA, (1 - smooth(26, 34, dt)) * smooth(-38, -46, z) * 0.45);
      // Floatstone Hollow: damp mossy ground
      out.lerp(MOSS, (1 - smooth(BASIN_R - 2, BASIN_R + 3, Math.hypot(x - BASIN[0], z - BASIN[1]))) * 0.4);
    }
    // Steep slopes: strata by absolute height
    if (slope > 0.45) {
      const i = Math.floor((h + 200 + Math.sin(x * 0.2 + z * 0.15) * 0.4) / 2.4);
      out.lerp(STRATA[i % STRATA.length], smooth(0.45, 0.95, slope) * 0.9);
    }
    // Cliff rim: a band of bare rock
    if (d < 2.6) out.lerp(RIMROCK, (1 - smooth(0.4, 2.6, d)) * 0.45);
  },
  grass: {
    density: 1.25,
    height: 1.3,
    tip: 0xf6f0c4,
    cover: (x, z, _h, slope) => {
      const d = landD(x, z);
      if (d < 1.2) return 0;
      let c = 0.62 + 0.38 * smooth(-0.3, 0.6, Math.sin(x * 0.09 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.08 + Math.sin(x * 0.04)));
      c *= 1 - smooth(0.45, 0.7, slope);
      // The tower terrace and stone forest are sparser
      const dt = Math.hypot(x - TOWER[0], z - TOWER[1]);
      c *= 1 - (1 - smooth(24, 34, dt)) * smooth(-38, -46, z) * 0.7;
      if (x < -40 && z < -30) c *= 0.7;
      return c;
    },
    color: (x, z, out) => {
      out.setHex(0x93cb6c).lerp(new THREE.Color(0x76b35c), 0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.05));
      out.lerp(DRY, smooth(-20, -85, x) * 0.45);
      out.lerp(LUSH, smooth(25, 85, x) * 0.3);
    },
  },
  tower: { stone: 0xebe4d4, stoneDark: 0x8e9ab0, trim: 0xe8b85a, roof: 0x3c9ec0, glow: 0x8ff5e0, kind: 'spire' },
  decorate(ctx) {
    buildSky(ctx, FOG);
    const loops = rimLoops(1.4);
    buildCliffs(ctx, loops);
    slopeSkirts(ctx, [...interiorEdges(), ...roadEdges(ctx)]);
    rimSolids(ctx, loops);
    rimDressing(ctx, loops, 0xeef3fb, 0x6b5143, 0x5f8f4a);
    const anim = new Anim();
    buildTown(ctx, anim);
    buildIsles(ctx, anim);
    buildWild(ctx, anim, loops);
    buildAir(ctx);
    anim.finish(ctx);
    ctx.b.lift = 0;
  },
};
