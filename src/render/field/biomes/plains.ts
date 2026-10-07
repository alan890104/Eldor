// Thunderpeal Plains (thunder): a boundless sea of tall grass rolling in the wind, under low, tumbling thunderheads that never let up.
// In the southwest lies the "Nomad Camp" of a nomad tribe that follows the storm clouds; the main road leaves the camp gate,
// crosses the grass sea, fords Thunder Creek, passes through the chest cavity of an ancient thunderbeast's skeleton,
// and finally climbs the approach lined with giant pillars up to the Thunderpeal Dais in the northeast.
// The storm cluster above the Thunderpeal Seal Tower hangs motionless, bolt after bolt striking the tower's spire.
// To the west are Lone Tree Hill and the terrace of lightning-rod pillars raised by the dwarves
// (a gap in the stone ridge at the terrace's southwest corner leads to the secret realm "Thunderfall Heart"),
// to the east are the Scorched Glass Flats, burned with discharge patterns by a giant lightning strike,
// the marsh that Thunder Creek flows into, the boulder group and the old camp left by the migration.
// Beyond the map the grassland runs on to the horizon,
// and under the distant cumulonimbus wall cloud-to-ground lightning falls now and then.

import * as THREE from 'three';
import { smooth } from '../compose.ts';
import type { Biome } from '../kit.ts';
import { ClothSet } from './plains/cloth.ts';
import { buildCamp, CORRAL, GREAT } from './plains/camp.ts';
import { farPlains, grassSheen } from './plains/ground.ts';
import {
  CHESTS,
  creekDist,
  edgeMetric,
  HEART,
  heartVein,
  LONE,
  MAIN_PATH,
  OLDCAMP,
  PATH_W,
  rawHeight,
  roadDist,
  RODS,
  rutDist,
  S,
  SCAR,
  scarVein,
  scorchAt,
  terraceRim,
  TORS,
  TOWER,
  TOWER_DIR,
  TOWN,
  TRAILS,
  WATER,
} from './plains/land.ts';
import { buildStorm } from './plains/storm.ts';
import { buildWild, farHeight } from './plains/wild.ts';

// ── Colors
const GOLD = new THREE.Color(0xc6a547);
const GREEN = new THREE.Color(0x6f9140);
const SAGE = new THREE.Color(0x7f9a6a);
const RUST = new THREE.Color(0xb86e3e);
const STRAW = new THREE.Color(0xcdb87a);
const SCORCH = new THREE.Color(0x251d2c);
const GLASS = new THREE.Color(0x2c3a5c);
const STONY = new THREE.Color(0x77727e);
const TRAMPLE = new THREE.Color(0x7a6650);
const RUT = new THREE.Color(0x6a5640);
const tmp = new THREE.Color();

/** Colors of the grass tufts and the grass ground: large patches of golden yellow, teal green, gray green and rust red */
function grassColor(x: number, z: number, out: THREE.Color): THREE.Color {
  const n1 = Math.sin(x * 0.035 + Math.sin(z * 0.05) * 1.5) * Math.cos(z * 0.03 + Math.sin(x * 0.04));
  const n2 = Math.sin(x * 0.11 + z * 0.07) * Math.cos(x * 0.05 - z * 0.12);
  out.copy(GREEN).lerp(GOLD, smooth(-0.55, 0.6, n1));
  out.lerp(RUST, smooth(0.45, 0.85, n2) * 0.55);
  out.lerp(SAGE, (1 - smooth(4, 18, creekDist(x, z))) * 0.55);
  // Grass near the camp has been grazed, so it is greener
  out.lerp(GREEN, (1 - smooth(20, 44, Math.hypot(x - TOWN[0], z - TOWN[1]))) * 0.45);
  // Grass on the Thunderpeal Dais is sun-dried to a hay color
  out.lerp(STRAW, (1 - smooth(30, 50, Math.hypot(x - TOWER[0], z - TOWER[1]))) * 0.5);
  return out;
}

/** Tent rings of the old camp (relative to the old camp's center; the stone rings in wild.ts sit at the same positions) */
const OLD_RINGS: readonly (readonly [number, number, number])[] = [
  [-8, 10, 3.1],
  [8, 7.5, 2.8],
  [-5, -8, 3.0],
  [10, -10, 2.6],
];

/** Top surface of the pillar terrace (0~1) */
function onTerrace(x: number, z: number): number {
  const a = Math.atan2(z - RODS[1], x - RODS[0]);
  return 1 - smooth(terraceRim(a) - 5, terraceRim(a) - 1, Math.hypot(x - RODS[0], z - RODS[1]));
}

/** Coverage of the grass sea (the engine also avoids roads, towns, the tower, water, steep slopes and colliders) */
function grassCover(x: number, z: number, h: number): number {
  let c = 1;
  c *= 0.5 + 0.5 * smooth(18, 34, Math.hypot(x - TOWN[0], z - TOWN[1]));
  c *= 1 - onTerrace(x, z) * 0.62;
  c *= smooth(17, 30, Math.hypot(x - SCAR[0], z - SCAR[1]));
  c *= smooth(15, 19.5, Math.hypot(x - HEART[0], z - HEART[1]));
  c *= 0.4 + 0.6 * smooth(24, 42, Math.hypot(x - TOWER[0], z - TOWER[1]));
  c *= 1 - scorchAt(x, z);
  c *= 1 - smooth(-84, -104, z) * 0.75;
  // Old camp: the round patches of bare earth left after the tents were taken away grow only sparse short grass,
  // so the rings stay visible
  const dc = Math.hypot(x - OLDCAMP[0], z - OLDCAMP[1]);
  if (dc < 18) {
    for (const [ox, oz, R] of OLD_RINGS) c *= 0.15 + 0.85 * smooth(R - 0.5, R + 1.6, Math.hypot(x - OLDCAMP[0] - ox, z - OLDCAMP[1] - oz));
  }
  if (h < WATER + 0.7) c *= 0.5;
  // Large-scale variation in density, which gives the grass sea its depth
  c *= 0.72 + 0.28 * smooth(-0.6, 0.5, Math.sin(x * 0.06 + 2) * Math.cos(z * 0.05 + 1) + Math.sin(x * 0.17 - z * 0.13) * 0.4);
  return c;
}

// ── Map layout
const [TX, TZ] = TOWN;
const SPAWN: [number, number] = [-31.5, 50.5];
const SPAWN_YAW = Math.atan2(TOWER[0] - SPAWN[0], TOWER[1] - SPAWN[1]);
const FWD: [number, number] = [Math.sin(SPAWN_YAW), Math.cos(SPAWN_YAW)];
const RIGHT: [number, number] = [-FWD[1], FWD[0]];
const MILA: [number, number] = [SPAWN[0] + FWD[0] * 3.4 + RIGHT[0] * 2.6, SPAWN[1] + FWD[1] * 3.4 + RIGHT[1] * 2.6];
const TD: [number, number] = [-TOWER_DIR[0], -TOWER_DIR[1]];
const ELDER: [number, number] = [TX + (GREAT[0] - TX) * 0.42, TZ + (GREAT[1] - TZ) * 0.42];
const HERD: [number, number] = (() => {
  const dx = TX - CORRAL[0];
  const dz = TZ - CORRAL[1];
  const l = Math.hypot(dx, dz);
  return [CORRAL[0] + (dx / l) * 9.2, CORRAL[1] + (dz / l) * 9.2];
})();

export const plains: Biome = {
  cols: { grass: 0x9c9450, grass2: 0x6c8044, path: 0xb49a70, cliff: 0x6a6478, sand: 0x8a7a5c, plaza: 0x9a8466 },
  fog: [70, 340],
  palette: {
    sky: ['#131a32', '#3c4870', '#d69a70'],
    fog: 0xa4948a,
    light: [-0.72, 0.4, 0.28],
    ambient: 0x9ea0c6,
    rim: 0xffc8a0,
    shadow: 0x343a70,
    motes: [0xf6e8a8, 0xe8d890, 0xc8b8ff],
    moteKind: 'drift',
    stars: false,
  },
  layout: {
    size: S,
    edge: 'cliff',
    town: TOWN,
    townR: 18,
    tower: TOWER,
    spawn: [SPAWN[0], SPAWN[1], SPAWN_YAW],
    waypoint: [TX - 4.5, TZ - 6.5],
    pathW: PATH_W,
    path: MAIN_PATH,
    trails: TRAILS,
    zones: [
      { x: -24, z: 44, r: 14, tier: 0, count: 4, species: ['ballspark', 'hedgehog', 'dandelion', 'skyreign'] },
      { x: -14, z: 72, r: 11, tier: 0, count: 2, species: ['dandelion', 'ballspark', 'skyreign'] },
      { x: 8, z: 42, r: 16, tier: 1, count: 3, species: ['ballspark', 'stormram', 'dandelion', 'skyreign'], corrupt: 0.1 },
      { x: -68, z: 30, r: 13, tier: 1, count: 2, species: ['skyreign', 'dandelion', 'stormram'], corrupt: 0.1 },
      { x: TORS[0], z: TORS[1] - 2, r: 16, tier: 1, count: 3, species: ['stormram', 'stormhorse', 'voltadillo'], corrupt: 0.12 },
      { x: RODS[0], z: RODS[1] + 2, r: 17, tier: 1, count: 3, species: ['hedgehog', 'voltadillo', 'ballspark'], corrupt: 0.2 },
      { x: -8, z: -24, r: 13, tier: 1, count: 2, species: ['voltadillo', 'stormram', 'hedgehog', 'skyreign'], corrupt: 0.18 },
      { x: SCAR[0], z: SCAR[1], r: 15, tier: 2, count: 2, species: ['voltadillo', 'ballspark', 'stormhorse'], corrupt: 0.3 },
      { x: 24, z: -62, r: 12, tier: 2, count: 2, species: ['stormram', 'skyreign', 'thunderbird'], corrupt: 0.3 },
      { x: HEART[0], z: HEART[1], r: 10, tier: 2, count: 2, species: ['stormhorse', 'thunderbird', 'tornado'], corrupt: 0.12 },
    ],
    chests: CHESTS,
    npcs: [
      [MILA[0], MILA[1], Math.atan2(SPAWN[0] - MILA[0], SPAWN[1] - MILA[1])],
      [ELDER[0], ELDER[1], Math.atan2(TD[0], TD[1])],
      [HERD[0], HERD[1], Math.atan2(TX - HERD[0], TZ - HERD[1])],
    ],
  },
  height: rawHeight,
  water: { level: WATER, shallow: 0x5a7a8c, deep: 0x223656, foam: 0xa8b6c8, horizon: 0xa4948a },
  paint(x, z, h, slope, out) {
    const rd = roadDist(x, z);
    const onRoad = 1 - smooth(PATH_W * 0.55, PATH_W + 1.2, rd);
    const dt = Math.hypot(x - TX, z - TZ);
    const town = 1 - smooth(10, 14, dt);
    // Grass: the same color family as the tufts but darker (so where distant tufts are not drawn it still looks like a grass sea)
    const g = (1 - onRoad) * (1 - town) * (1 - smooth(0.5, 0.9, slope)) * (h > WATER + 0.9 ? 1 : 0.3);
    if (g > 0) out.lerp(tmp.copy(grassColor(x, z, tmp)).multiplyScalar(0.7), g * 0.5);
    // Ruts: two dark wheel tracks on the main road and the migration road, with a strip of grass between them
    const ru = rutDist(x, z);
    if (ru < 2 && dt > 16) {
      const rut = 1 - smooth(0.12, 0.34, Math.abs(ru - 1.05));
      out.lerp(RUT, rut * 0.55);
      out.lerp(tmp.copy(GREEN).multiplyScalar(0.7), (1 - smooth(0.2, 0.45, ru)) * 0.35);
    }
    // Camp: packed-down earth
    out.lerp(TRAMPLE, (1 - smooth(11, 16, dt)) * 0.35);
    // Pillar terrace: gravelly ground
    const tr = onTerrace(x, z);
    if (tr > 0) out.lerp(STONY, tr * 0.5 * (0.7 + 0.3 * Math.sin(x * 0.4) * Math.sin(z * 0.37)));
    // Thunderpeal Dais: a ring of charred black around the tower
    const dw = Math.hypot(x - TOWER[0], z - TOWER[1]);
    out.lerp(SCORCH, (1 - smooth(14, 30, dw + Math.sin(Math.atan2(z - TOWER[1], x - TOWER[0]) * 7) * 3)) * 0.55);
    // Scorched Glass Flats: a burned-black shallow basin, the discharge patterns are vitrified deep blue
    const ds = Math.hypot(x - SCAR[0], z - SCAR[1]);
    if (ds < 32) {
      const dw2 = ds + Math.sin(Math.atan2(z - SCAR[1], x - SCAR[0]) * 5) * 3;
      out.lerp(tmp.set(0x5a4a3e), (1 - smooth(19, 31, dw2)) * 0.55);
      out.lerp(SCORCH, (1 - smooth(8, 25, dw2)) * 0.85);
      out.lerp(GLASS, scarVein(x, z) * 0.9);
    }
    // Thunderfall Heart: the whole pit floor is vitrified
    const dh = Math.hypot(x - HEART[0], z - HEART[1]);
    if (dh < 20) {
      out.lerp(tmp.set(0x2a2440), 1 - smooth(12, 17, dh));
      out.lerp(GLASS, heartVein(x, z));
    }
    // Scorch marks from lightning strikes all over
    const sc = scorchAt(x, z);
    if (sc > 0) {
      out.lerp(SCORCH, sc * 0.85);
      out.lerp(GLASS, smooth(0.75, 1, sc) * 0.5);
    }
    // Old camp: round patches of bare earth left after the tents were taken away
    const dc = Math.hypot(x - OLDCAMP[0], z - OLDCAMP[1]);
    if (dc < 18) {
      for (const [ox, oz, R] of OLD_RINGS) {
        const d = Math.hypot(x - OLDCAMP[0] - ox, z - OLDCAMP[1] - oz);
        out.lerp(TRAMPLE, (1 - smooth(R - 0.6, R + 0.2, d)) * 0.55);
      }
    }
    // Top of Lone Tree Hill: wind-scoured down to short grass
    out.lerp(STRAW, (1 - smooth(4, 12, Math.hypot(x - LONE[0], z - LONE[1]))) * 0.25);
    // Thunderfang Cliffs in the north: rocky ground
    out.lerp(tmp.set(0x5a566c), smooth(-88, -106, z) * smooth(S - 34, S - 18, edgeMetric(x, z)) * 0.7);
    void slope;
  },
  grass: {
    density: 1.75,
    height: 1.65,
    tip: 0xeedc94,
    cover: (x, z, h) => grassCover(x, z, h),
    color: (x, z, out) => void grassColor(x, z, out),
  },
  tower: { stone: 0x6a6e90, stoneDark: 0x44486a, trim: 0xc98f4a, roof: 0x2f3c82, glow: 0xffe25a, kind: 'spire' },
  decorate(ctx) {
    const cloth = new ClothSet();
    const camp = buildCamp(ctx, cloth);
    const wild = buildWild(ctx, cloth);
    ctx.b.lift = 0;
    const clothTick = cloth.build(ctx.group, ctx.disposers);

    // Wind ripples on the grass sea (avoiding roads, the camp, water and steep slopes)
    const terrainMat = ctx.terrain.mesh.material as THREE.ShaderMaterial;
    const erode = (terrainMat.uniforms?.uErode as { value: THREE.Vector4 } | undefined) ?? { value: new THREE.Vector4() };
    const nrm = new THREE.Vector3();
    const sheen = grassSheen(
      ctx,
      (x, z) => {
        const h = ctx.h(x, z);
        if (h < WATER + 0.5) return 0;
        ctx.terrain.normalAt(x, z, nrm);
        const flat = smooth(0.7, 0.9, nrm.y);
        const road = smooth(PATH_W + 0.5, PATH_W + 3, ctx.pathDist(x, z));
        return Math.min(1, grassCover(x, z, h) * 1.2) * flat * road * (1 - smooth(S - 30, S - 14, edgeMetric(x, z)) * 0.5);
      },
      0xfff0b0,
      0x4a5230,
      0xffc070,
      erode,
    );

    // The grassland beyond the map, running on to the horizon
    farPlains(ctx, farHeight, (x, z, out) => {
      // Distant grassland: the color patches are scaled up and the contrast is reduced,
      // the farther away the closer to the fog color of the horizon
      const n = Math.sin(x * 0.009 + 1.1) * Math.cos(z * 0.008 - 0.3) + Math.sin(x * 0.023 - z * 0.019) * 0.35;
      out.set(0x8c8a4a).lerp(tmp.set(0x6c7a40), smooth(-0.6, 0.6, n));
      out.lerp(tmp.set(0x5a566c), smooth(-S * 1.1, -S * 1.8, z) * 0.6);
    });

    // Sky and lightning strikes
    const gy = ctx.h(TOWER[0], TOWER[1]);
    const storm = buildStorm(ctx, {
      eye: TOWER,
      groundY: gy,
      spire: new THREE.Vector3(TOWER[0], gy + 56.2, TOWER[1]),
      h: ctx.h,
      size: S,
      calm: ctx.done >= ctx.floors,
      avoid: [[TX, TZ, 40]],
      targets: [
        { pos: wild.rodTips, every: [3, 6], range: 130, power: 0.7 },
        { pos: wild.ringTips, every: [3.5, 7], range: 200, power: 0.55 },
        { pos: [camp.mastTip], every: [16, 28], range: 95, power: 0.8 },
        { pos: [wild.heartTip], every: [1.6, 3.4], range: 110, power: 0.85, after: () => wild.surge('heart') },
        { pos: [wild.scarTip], every: [7, 12], range: 170, power: 0.8, after: () => wild.surge('scar') },
        { pos: [wild.treeTip], every: [24, 40], range: 140, power: 0.75 },
      ],
    });

    ctx.extras.push((dt, t, vfx) => {
      const f = storm.flash();
      clothTick(t, f);
      sheen(t, f);
      wild.tick(dt, t, f, vfx);
      camp.tick(dt, t, vfx);
    });
    ctx.b.lift = 0;
  },
};
