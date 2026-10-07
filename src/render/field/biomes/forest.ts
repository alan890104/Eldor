// Whisperwood (wood): the field of the first region. Morning light slants through the canopies of the giant trees,
// and leaves and spores drift slowly down. On the southern slope is "Treespeak Village", the Forest Folk's treetop settlement;
// the north gate opens onto a wildflower slope that runs downhill; past the giant-tree colonnade, the root arch of the
// thousand-year Mother Tree spans the road, and the forest stream flows down from the Moss Falls in the northwest, passes
// under the Forest Folk bridge and empties into Mirror Lake in the east; finally the road climbs the gorge of the Owlwatch
// Stair to a plateau of ancient trees, where the Whisperwood Seal Tower stands.
// The terrain skeleton is in forest/geo.ts; the village, landmarks, vegetation and waters are each split into their own module.

import * as THREE from 'three';
import { smooth } from '../compose.ts';
import type { Biome } from '../kit.ts';
import { buildFlora } from './forest/flora.ts';
import { GLADE, HOLLOW, height, MAIN_PATH, MEADOW, MOTHER, n1, n2, hash, PATH_W, plateauK, S, SPAWN, TOWER, TOWN, TOWN_R, TRAILS, WL, woods } from './forest/geo.ts';
import { buildLandmarks } from './forest/landmarks.ts';
import { buildPurified } from './forest/purified.ts';
import { buildRim } from './forest/rim.ts';
import { buildVillage } from './forest/village.ts';
import { buildWaters } from './forest/waters.ts';

const C = {
  floor: new THREE.Color(0x4f8540),
  floorDeep: new THREE.Color(0x3d6e3c),
  litter: new THREE.Color(0x9c8a50),
  meadow: new THREE.Color(0x92cc58),
  meadowGold: new THREE.Color(0xc8d860),
  plateau: new THREE.Color(0x7cbc50),
  moss: new THREE.Color(0x5a9446),
  rockMoss: new THREE.Color(0x5a8a48),
  hollow: new THREE.Color(0x2f6c58),
  hollowRing: new THREE.Color(0x62d6a4),
  glade: new THREE.Color(0x3f9a62),
  earth: new THREE.Color(0xb49468),
  earthDark: new THREE.Color(0x8c7250),
  pebble: new THREE.Color(0xa8a58c),
  flowerY: new THREE.Color(0xffe27a),
  flowerW: new THREE.Color(0xfff6e0),
  flowerP: new THREE.Color(0xffa8c8),
  trail: new THREE.Color(0xa88e62),
  wall: new THREE.Color(0x5e8e48),
  rockLight: new THREE.Color(0x9e9884),
  rockDark: new THREE.Color(0x77705f),
  wallDark: new THREE.Color(0x46763e),
};

/** Distance grid for a polyline (Catmull-Rom smoothed, matching the engine's roads), one cell per meter */
function distGrid(lines: [number, number][][]): (x: number, z: number) => number {
  let grid: Float32Array | null = null;
  const n = S * 2 + 1;
  return (x, z) => {
    if (!grid) {
      grid = new Float32Array(n * n).fill(99);
      for (const line of lines) {
        const curve = new THREE.CatmullRomCurve3(line.map(([px, pz]) => new THREE.Vector3(px, 0, pz)), false, 'centripetal');
        for (const p of curve.getSpacedPoints(Math.max(2, Math.round(curve.getLength() / 1.2)))) {
          const ci = Math.round(p.x + S);
          const cj = Math.round(p.z + S);
          for (let j = cj - 8; j <= cj + 8; j++) {
            if (j < 0 || j >= n) continue;
            for (let i = ci - 8; i <= ci + 8; i++) {
              if (i < 0 || i >= n) continue;
              const d = Math.hypot(i - S - p.x, j - S - p.z);
              if (d < grid[j * n + i]) grid[j * n + i] = d;
            }
          }
        }
      }
    }
    // bilinear interpolation
    const fx = Math.min(n - 1.001, Math.max(0, x + S));
    const fz = Math.min(n - 1.001, Math.max(0, z + S));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    return grid[j * n + i] * (1 - u) * (1 - v) + grid[j * n + i + 1] * u * (1 - v) + grid[(j + 1) * n + i] * (1 - u) * v + grid[(j + 1) * n + i + 1] * u * v;
  };
}
/** Main road and trails are computed separately: ground coloring paints trails narrower than the road, like forest paths */
const mainPathDist = distGrid([MAIN_PATH]);
const trailDist = distGrid(TRAILS);

const tmp = new THREE.Color();

export const forest: Biome = {
  cols: { grass: 0x78b84e, grass2: 0x559e44, path: 0xc9a672, cliff: 0x8a8272, sand: 0xb3ad90, plaza: 0xbaa27a },
  fog: [68, 265],
  palette: {
    sky: ['#5aa6e6', '#bfe0f0', '#f4eecc'],
    fog: 0xcfe6cf,
    light: [0.45, 0.85, 0.35],
    ambient: 0xa8c2a8,
    motes: [0xd8f07a, 0xffe08a, 0xa8e070, 0xf0c060],
    moteKind: 'fall',
    moteAtlas: [3, 0.65],
  },
  layout: {
    size: S,
    edge: 'cliff',
    town: TOWN,
    townR: TOWN_R,
    tower: TOWER,
    spawn: SPAWN,
    waypoint: [7, 53],
    pathW: PATH_W,
    path: MAIN_PATH,
    trails: TRAILS,
    zones: [
      // Wildflower Slope: at the village gate, the gentlest spirits
      { x: 2, z: 30, r: 15, tier: 0, count: 4, species: ['acornsquirrel', 'cloudfluff', 'dandelion', 'skyreign'] },
      // Around the Fallen Giant: `acornsquirrel` scurrying along the trunk
      { x: -36, z: 44, r: 11, tier: 0, count: 2, species: ['acornsquirrel', 'cloudfluff', 'leaffrog'] },
      // Mirror Lake shore: `leaffrog`
      { x: 42, z: 20, r: 12, tier: 1, count: 3, species: ['leaffrog', 'cloudfluff', 'dandelion'], corrupt: 0.1 },
      // Glowcap Hollow: home of `dreamcap`
      { x: HOLLOW[0] + 2, z: HOLLOW[1], r: 11, tier: 1, count: 3, species: ['dreamcap', 'cloudfluff', 'leaffrog'], corrupt: 0.15 },
      // Root thicket west of the Mother Tree
      { x: -40, z: -8, r: 10, tier: 1, count: 2, species: ['acornsquirrel', 'owlarchivist', 'skyreign', 'dreamcap'], corrupt: 0.12 },
      // North bank of the stream up to the foot of the cliff
      { x: -24, z: -38, r: 11, tier: 1, count: 3, species: ['leaffrog', 'dreamcap', 'elderwood_warden'], corrupt: 0.15 },
      // East slope
      { x: 54, z: -30, r: 13, tier: 1, count: 2, species: ['skyreign', 'elderwood_warden', 'acornsquirrel', 'dandelion'], corrupt: 0.18 },
      // Ancient woods around the tower
      { x: -8, z: -76, r: 13, tier: 2, count: 3, species: ['elderwood_warden', 'owlarchivist', 'dreamcap', 'skyreign'], corrupt: 0.3 },
      { x: 46, z: -76, r: 11, tier: 2, count: 2, species: ['skyreign', 'elderwood_warden', 'acornsquirrel'], corrupt: 0.3 },
      // Banyan Secret Realm
      { x: GLADE[0] + 1, z: GLADE[1] + 1, r: 7, tier: 2, count: 2, species: ['banyanelder', 'owlarchivist'], corrupt: 0.1 },
    ],
    chests: [
      [-21, 21], // Wildflower Slope: behind the pile of stones under the lone oak
      [-27.2, 28.6], // inside the broken end of the Fallen Giant
      [62.2, 10.6], // small island in the lake
      [-71, 22], // under the big umbrella mushroom in Glowcap Hollow
      [-41, -52.5], // overlook at the top of the falls
      [-78, -70], // Banyan Secret Realm (the largest chest)
    ],
    npcs: [
      [-0.9, 41.6, -0.8],
      [-15.5, 64.5, 1.9],
      [-16.5, 76, 1.2],
    ],
  },
  height,
  water: { level: WL, shallow: 0x86dcc4, deep: 0x2a6e78, foam: 0xd6f4ea },
  paint(x, z, h, slope, out) {
    const cliff = smooth(0.55, 0.95, slope);
    const md = mainPathDist(x, z);
    const w = woods(x, z);
    // Understory: the denser, the darker, with a moss tint and fallen leaves
    if (cliff < 1) {
      const litter = smooth(0.1, 0.7, n2(x * 1.7, z * 1.7)) * 0.45;
      tmp.copy(C.floor).lerp(C.floorDeep, smooth(0.5, 0.95, w)).lerp(C.litter, litter);
      out.lerp(tmp, smooth(0.25, 0.8, w) * 0.72 * (1 - cliff));
    }
    // Wildflower Slope: bright yellow-green, dotted with small flowers
    const me = Math.hypot((x - MEADOW.x) / MEADOW.rx, (z - MEADOW.z) / MEADOW.rz);
    const mk = 1 - smooth(0.75, 1.15, me);
    if (mk > 0) {
      out.lerp(C.meadow, mk * 0.55);
      out.lerp(C.meadowGold, mk * smooth(0.3, 0.9, n1(x * 2.3, z * 2.3)) * 0.35);
      const f = hash(Math.round(x), Math.round(z));
      if (f > 0.95) out.lerp(f > 0.975 ? C.flowerW : C.flowerY, mk * 0.3);
    }
    // Outer rim wall: steep slope overgrown with moss and shrubs (rock shows only where it is steepest and highest)
    const em = Math.max(Math.abs(x), Math.abs(z)) + Math.sin(x * 0.11) * 3 + Math.cos(z * 0.13) * 3;
    const ew = smooth(S - 34, S - 18, em);
    if (ew > 0) {
      tmp.copy(C.wall).lerp(C.wallDark, smooth(-0.3, 0.6, n1(x * 1.6, z * 1.6)));
      out.lerp(tmp, ew * (0.85 - 0.35 * smooth(1.4, 2.4, slope)));
    }
    // Plateau: more sunlight, a golden green
    const pk = plateauK(x, z);
    if (pk > 0.9 && cliff < 1) out.lerp(C.plateau, 0.3 * (1 - cliff));
    // Cliff: layered strata (alternating light and dark), moss growing in the cracks, moss streaming down from the cliff top
    // (on the outer rim wall the strata only show faintly, so the whole mountain does not turn gray)
    const rk = cliff * (1 - ew * 0.75);
    if (rk > 0) {
      const band = Math.sin(h * 1.25 + n2(x * 0.8, z * 0.8) * 1.6);
      tmp.copy(C.rockLight).lerp(C.rockDark, smooth(-0.2, 0.9, band));
      out.lerp(tmp, rk * 0.7);
      const moss = smooth(0.1, 0.6, n1(x * 2.2 + h * 0.15, z * 2.2) + 0.35 * Math.sin(x * 0.9 + z * 0.7));
      out.lerp(C.rockMoss, rk * moss * 0.65);
    }
    // Stream and lake banks: pebbles near the waterline, then damp mossy ground above
    if (h > WL + 0.3 && h < WL + 2.4) out.lerp(C.moss, smooth(WL + 0.6, WL + 1.2, h) * (1 - smooth(WL + 1.6, WL + 2.4, h)) * 0.5 * (1 - cliff));
    // Glowcap Hollow: dark teal moss ground with a ring of bright moss
    const dh = Math.hypot(x - HOLLOW[0], z - HOLLOW[1]);
    if (dh < 18) {
      out.lerp(C.hollow, (1 - smooth(10, 17, dh)) * 0.7);
      out.lerp(C.hollowRing, (1 - smooth(0.4, 1.3, Math.abs(dh - 7.2))) * 0.55);
    }
    // Banyan Secret Realm: a carpet of emerald moss
    const dg = Math.hypot(x - GLADE[0], z - GLADE[1]);
    if (dg < 14) out.lerp(C.glade, (1 - smooth(8, 13, dg)) * 0.6 * (1 - cliff));
    // Mother Tree's root ground: dark mossy soil
    const dm = Math.hypot(x - MOTHER[0], z - MOTHER[1]);
    if (dm < 24) out.lerp(C.floorDeep, (1 - smooth(8, 22, dm)) * 0.5 * (1 - cliff));
    // Village plaza: packed earth with ring patterns like tree rings
    const dt = Math.hypot(x - TOWN[0], z - TOWN[1]);
    if (dt < TOWN_R * 0.75) {
      const k = 1 - smooth(TOWN_R * 0.55, TOWN_R * 0.7, dt);
      tmp.copy(C.earth).lerp(C.earthDark, (1 - smooth(0.0, 0.25, Math.abs(((dt / 1.7) % 1) - 0.5))) * 0.35 * smooth(2.5, 4, dt));
      out.lerp(tmp, k * 0.9);
    }
    // Trails: narrower than the main road, the surface carrying moss and fallen leaves
    // (the engine paints every road at the same width, so here both sides of a trail are painted back to forest floor)
    if (md > PATH_W + 2) {
      const td = trailDist(x, z);
      if (td < PATH_W + 2.5) {
        const eng = 1 - smooth(PATH_W * 0.55, PATH_W + 0.9, td);
        const narrow = 1 - smooth(0.4, 1.5, td + n2(x * 3, z * 3) * 0.35);
        tmp.copy(C.floor).lerp(C.litter, 0.35);
        out.lerp(tmp, Math.max(0, eng - narrow) * 0.8);
        out.lerp(C.trail, narrow * 0.35);
      }
    }
  },
  grass: {
    density: 1.25,
    height: 1.05,
    tip: 0xd8f08a,
    cover(x, z, h, slope) {
      void h;
      void slope;
      const w = woods(x, z);
      const me = Math.hypot((x - MEADOW.x) / MEADOW.rx, (z - MEADOW.z) / MEADOW.rz);
      const meadow = 1 - smooth(0.8, 1.2, me);
      const hollow = smooth(8, 14, Math.hypot(x - HOLLOW[0], z - HOLLOW[1]));
      return Math.min(1, (0.85 - w * 0.55 + meadow * 0.4) * (0.5 + 0.5 * hollow));
    },
    color(x, z, out) {
      const w = woods(x, z);
      out.set(0x7cbf52).lerp(tmp.set(0x4f8f40), smooth(0.3, 0.9, w));
      const me = Math.hypot((x - MEADOW.x) / MEADOW.rx, (z - MEADOW.z) / MEADOW.rz);
      out.lerp(tmp.set(0x9ad35c), (1 - smooth(0.8, 1.2, me)) * 0.6);
      if (plateauK(x, z) > 0.9) out.lerp(tmp.set(0x8cc454), 0.4);
    },
  },
  tower: { stone: 0xd6d2bc, stoneDark: 0x8a8672, trim: 0x6e8e4a, roof: 0x3f7a4c, glow: 0x7aff9a, kind: 'pagoda' },
  decorate(ctx) {
    buildRim(ctx);
    buildWaters(ctx);
    buildVillage(ctx);
    buildLandmarks(ctx);
    buildFlora(ctx);
    // After purification: the Mother Tree blooms and wildflowers grow back in front of the tower
    // (the village's Sprouting Festival is in buildVillage)
    buildPurified(ctx);
    ctx.b.lift = 0;
  },
};
