// Dawnlight Holy City (light): a white holy city floating on a sea of clouds. The south end is the "Outer City", with a fountain
// plaza, white-walled blue-roofed houses and a Cloudedge Terrace overlooking the clouds; past the north gate, a grand stair
// climbs along a curved retaining wall to the main island: on the left the Cathedral with its rose window and flying buttresses,
// on the right the Belfry with its ringing bell. Beyond the Holy Gate straight ahead, a long Holy Bridge crosses the clouds to
// the "Dawnlight Seal Tower", which is ringed by the Church's purification barrier. In the west are the Cloud Overlook (a turning
// orrery), the fallen giant angel statue and the Old Chapel Ruins; behind the ruins a narrow Cloud Spine leads to the Griffin
// Nest (secret realm). In the east the Garden Bridge leads to the Sky Garden Isle: the hedge garden, the Stained-Glass Ring and
// the Cloud Pasture. Soft pillars of light fall from the sky, light feathers drift down, and white doves circle the city.

import * as THREE from 'three';
import { smooth } from '../compose.ts';
import type { Biome, FieldCtx } from '../kit.ts';
import { C } from './holy/arch.ts';
import { Banners, cloudSea, cumulus, doves, fallMaterial, floatingIslets, lightBeams, pavedRibbon, ringMosaic, sunMosaic, waterMaterial } from './holy/sky.ts';
import { bell, buildTerrace, buildTown, buildUpper } from './holy/town.ts';
import { buildEast, buildHolyIsle, buildRims, buildWest, scatterWild } from './holy/wild.ts';
import * as SH from './holy/shape.ts';

const LIGHT: [number, number, number] = [0.5, 0.8, 0.42];

const PAVE = new THREE.Color(0xe2d8c3);
const PAVE2 = new THREE.Color(0xc9bb9f);
const PAVE3 = new THREE.Color(0xb0a080);
const SUNC = new THREE.Color(0xe8c46a);
const GRAVEL = new THREE.Color(0xeee4cc);
const CLIFF = new THREE.Color(0xddd3c2);
const CLIFF2 = new THREE.Color(0xc2b5a0);
const VEIN = new THREE.Color(0xe8c878);
const MIST = new THREE.Color(0xd6cfe4);
const LIP = new THREE.Color(0xd8dcae);
const GOLDGRASS = new THREE.Color(0xd8d890);

export const holy: Biome = {
  cols: { grass: 0xb0d47c, grass2: 0x98c46a, path: 0xe8dcc0, cliff: 0xd6ccba, sand: 0xd6cfe4, plaza: 0xe6decb },
  fog: [95, 470],
  palette: {
    sky: ['#5f9de0', '#f6dfb2', '#fbf1de'],
    fog: 0xf5ead4,
    light: LIGHT,
    ambient: 0xc4bcd4,
    rim: 0xfff0d0,
    shadow: 0x9486c4,
    motes: [0xfff2b8, 0xffffff, 0xffe08a],
    moteKind: 'fall',
    moteAtlas: [3, 0.6],
  },
  layout: {
    size: SH.S,
    edge: 'void',
    town: SH.TOWN,
    townR: SH.TOWN_R,
    tower: SH.TOWER,
    spawn: [0, 60.5, Math.PI],
    waypoint: [12, 55],
    pathW: 2.6,
    path: SH.PATH,
    trails: SH.TRAILS,
    zones: [
      { x: -20, z: 60, r: 7, tier: 0, count: 3, species: ['candledove', 'cloudfluff', 'papercrane'] },
      { x: 17, z: 31, r: 8, tier: 0, count: 2, species: ['candledove', 'prismsnail', 'cloudfluff'] },
      { x: -60, z: 24, r: 11, tier: 1, count: 3, species: ['cloudfluff', 'papercrane', 'stormram', 'lyrebird'], corrupt: 0.12 },
      { x: -56, z: -6, r: 9, tier: 1, count: 2, species: ['prismsnail', 'balancescale', 'papercrane'], corrupt: 0.18 },
      { x: -36, z: 52, r: 8, tier: 1, count: 2, species: ['lyrebird', 'candledove', 'papercrane'], corrupt: 0.1 },
      { x: 74, z: 30, r: 10, tier: 1, count: 3, species: ['candledove', 'papercrane', 'lyrebird'], corrupt: 0.1 },
      { x: 77, z: 3, r: 8, tier: 1, count: 2, species: ['prismsnail', 'balancescale'], corrupt: 0.15 },
      { x: 74, z: -9, r: 9, tier: 1, count: 3, species: ['stormram', 'cloudfluff'], corrupt: 0.12 },
      { x: -24, z: -70, r: 8, tier: 2, count: 2, species: ['balancescale', 'stormram', 'lyrebird'], corrupt: 0.3 },
      { x: 22, z: -70, r: 8, tier: 2, count: 2, species: ['candledove', 'prismsnail', 'griffin'], corrupt: 0.35 },
      { x: -80, z: -50, r: 6, tier: 2, count: 2, species: ['griffin', 'chime_sprite'], corrupt: 0.15 },
    ],
    chests: [
      [-26, 58],
      [-81, 10],
      [-56, -6],
      [80, 36],
      [-4, -97],
      [-83, -55],
    ],
    npcs: [
      [-2.6, 57.6, 0.5],
      [-10.2, 80.2, Math.PI / 2],
      [4.4, 51.2, -0.4],
    ],
  },
  height: SH.height,
  // No water: a ring of colliders blocks the island edge, and underfoot is a sea of clouds we make ourselves
  // (on the minimap the area off the island is cloud-colored too, never a blue sea)
  paint(x, z, h, slope, out) {
    const pv = SH.paved(x, z);
    if (pv > 0.01) {
      // Large stone slabs: tile-by-tile light and dark shades
      const chk = (Math.floor(x / 2.2) + Math.floor(z / 2.2)) & 1;
      const tone = PAVE.clone().lerp(PAVE2, chk * 0.32 + 0.12 + 0.1 * Math.sin(x * 0.13 + z * 0.11));
      // Round plaza: a mosaic of sun rays and concentric rings
      for (const [cx, cz, R, n] of SH.SUNS) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > R + 1) continue;
        const a = Math.atan2(z - cz, x - cx);
        const ray = Math.cos(a * n) > 0.55 - d / R * 0.2 ? 1 : 0;
        tone.copy(PAVE);
        if (d < 2.2) tone.lerp(SUNC, 0.75);
        else if (d < R * 0.5) tone.lerp(ray ? SUNC : PAVE2, ray ? 0.55 : 0.45);
        else if (Math.abs(d - R * 0.62) < 0.55 || Math.abs(d - R) < 0.6) tone.lerp(PAVE3, 0.8);
        else tone.lerp(ray ? PAVE2 : PAVE, 0.6);
      }
      // Outer City plaza: rings upon rings around the fountain
      const dt = Math.hypot(x - SH.TOWN[0], z - SH.TOWN[1]);
      if (dt < 12.5) {
        tone.copy(PAVE).lerp(PAVE2, Math.sin(dt * 1.25) > 0.3 ? 0.6 : 0.1);
        if (Math.abs(dt - 11.6) < 0.6) tone.lerp(PAVE3, 0.8);
      }
      out.lerp(tone, pv * 0.94);
    } else {
      const dt = Math.hypot(x - SH.TOWN[0], z - SH.TOWN[1]);
      if (dt < 12.5) {
        const tone = PAVE.clone().lerp(PAVE2, Math.sin(dt * 1.25) > 0.3 ? 0.6 : 0.1);
        if (Math.abs(dt - 11.6) < 0.6) tone.lerp(PAVE3, 0.8);
        out.lerp(tone, 1 - smooth(11.8, 12.6, dt));
      }
    }
    // The garden's cross-shaped gravel paths
    const [gx, gz] = SH.GARDEN;
    if (Math.abs(x - gx) < 11 && Math.abs(z - gz) < 11) {
      const w = Math.max(1 - smooth(1.2, 2.0, Math.abs(x - gx)), 1 - smooth(1.2, 2.0, Math.abs(z - gz)), smooth(9.4, 10.4, Math.max(Math.abs(x - gx), Math.abs(z - gz))));
      out.lerp(GRAVEL, w * 0.9);
    }
    // Stained-Glass Ring and the top of the Cloud Pasture: round flagstones
    const dg = Math.hypot(x - SH.GLASS[0], z - SH.GLASS[1]);
    if (dg < 11) out.lerp(Math.sin(dg * 1.4) > 0 ? PAVE : PAVE2, (1 - smooth(9.5, 11, dg)) * 0.9);
    const dh = Math.hypot(x - SH.HILL[0], z - SH.HILL[1]);
    if (dh < 6) out.lerp(PAVE, (1 - smooth(4.8, 6, dh)) * 0.9);
    // The grass around the Cloud Pasture leans golden
    const mh = 1 - smooth(8, 22, dh);
    if (mh > 0) out.lerp(GOLDGRASS, mh * 0.45);
    // Cliffs: white limestone strata with golden veins
    const s = smooth(0.45, 1.0, slope);
    if (s > 0) {
      const band = 0.5 + 0.5 * Math.sin(h * 1.7 + Math.sin(x * 0.21 + z * 0.17) * 1.8);
      const c = CLIFF.clone().lerp(CLIFF2, band * 0.8);
      if (Math.sin(h * 0.61 + x * 0.05 - z * 0.04) > 0.93) c.lerp(VEIN, 0.8);
      out.lerp(c, s);
    }
    // Island edge: a ring of pale grass fringe
    const sh = SH.shore(x, z);
    if (sh > 0 && sh < 2.4 && slope < 0.6) out.lerp(LIP, (1 - smooth(1.2, 2.4, sh)) * 0.35);
    // Cliffs sinking down into the clouds gradually take on the color of the clouds
    if (h < 1) out.lerp(MIST, smooth(1, SH.CLOUD_Y + 2, h) * 0.85);
  },
  grass: {
    density: 1.05,
    height: 0.8,
    tip: 0xfff2c0,
    cover: (x, z, _h, slope) => {
      if (SH.paved(x, z) > 0.25) return 0;
      const s = SH.shore(x, z);
      if (s < 2.2) return 0;
      const [gx, gz] = SH.GARDEN;
      if (Math.abs(x - gx) < 11 && Math.abs(z - gz) < 11) return 0.25;
      if (Math.hypot(x - SH.GLASS[0], z - SH.GLASS[1]) < 11) return 0;
      const meadow = 1 - smooth(10, 24, Math.hypot(x - SH.HILL[0], z - SH.HILL[1]));
      const n = Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.09 + Math.sin(x * 0.05) * 2);
      return Math.min(1, (0.55 + 0.45 * smooth(-0.5, 0.4, n)) * (1 - smooth(0.4, 0.7, slope)) + meadow * 0.5);
    },
    color: (x, z, out) => {
      const n = Math.sin(x * 0.09 + z * 0.05) * Math.cos(z * 0.08 - x * 0.03);
      out.set(0xb2d67e).lerp(new THREE.Color(0x96c468), smooth(-0.3, 0.6, n));
      const mh = 1 - smooth(8, 24, Math.hypot(x - SH.HILL[0], z - SH.HILL[1]));
      if (mh > 0) out.lerp(GOLDGRASS, mh * 0.5);
    },
  },
  tower: { stone: 0xf0ebe0, stoneDark: 0xc6b99f, trim: 0xe2b34a, roof: 0x8ea3cc, glow: 0xffe07a, kind: 'spire' },
  decorate(ctx) {
    const water = waterMaterial(ctx);
    const fall = fallMaterial(ctx);
    const banners = new Banners();
    const mats = { water, fall, banners };
    // Mosaic patterns of the plazas
    for (const [x, z, R, n] of SH.SUNS) sunMosaic(ctx, x, z, R, n);
    ringMosaic(ctx, SH.TOWN[0], SH.TOWN[1], 6.2, 12.4);
    // Flagstone paving of the main roads: the Outer City avenue, the avenue from the top of the stair to the Holy Gate,
    // the Holy Bridge and the approach on the holy isle; the Garden Bridge in the east
    pavedRibbon(ctx, [
      [[0, 65.6], [0, 50.4]],
      [[0, 35.6], [-2, 26], [-4, 12], [-2.9, 5.4]],
      [[0, -15.6], [0, -30], [0, -46], [0, -53]],
    ], 5.2);
    pavedRibbon(ctx, [[[23.5, 25.2], [54, 20]]], 3.6);
    const sprayTown = buildTown(ctx, mats);
    buildTerrace(ctx, mats);
    const { bellY } = buildUpper(ctx, mats);
    bell(ctx, SH.BELFRY[0], bellY, SH.BELFRY[1]);
    buildWest(ctx);
    const sprayGarden = buildEast(ctx, mats);
    const cage = buildHolyIsle(ctx, banners);
    buildRims(ctx);
    scatterWild(ctx);
    banners.build(ctx);
    sky(ctx);
    ambience(ctx, [sprayTown, sprayGarden], cage);
    ctx.b.lift = 0;
  },
};

/** Sea of clouds, distant cumulus and floating islets, pillars of light, white doves */
function sky(ctx: FieldCtx): void {
  const { b, r, low } = ctx;
  cloudSea(ctx, SH.shore, new THREE.Vector3(...LIGHT));
  // Distant cumulus towers
  b.lift = 0;
  const n = low ? 10 : 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const d = 230 + r() * 320;
    cumulus(b, Math.cos(a) * d, Math.sin(a) * d, 18 + r() * 26, 30 + r() * 60, r);
  }
  // Floating islets: the near ones circle the holy city, the far ones are scattered over the sea of clouds
  floatingIslets(ctx, [
    { x: 38, y: 5, z: 96, R: 5, deco: 'cypress' },
    { x: -36, y: 11, z: 94, R: 4, deco: 'shrine' },
    { x: 112, y: 12, z: 46, R: 6, deco: 'tree' },
    { x: 60, y: 16, z: -86, R: 7, deco: 'arch' },
    { x: -112, y: 8, z: 30, R: 5, deco: 'crystal' },
    { x: -46, y: 18, z: -100, R: 6, deco: 'tree' },
    { x: 36, y: 2, z: 56, R: 3, deco: 'bare' },
    { x: -22, y: 0, z: -32, R: 4, deco: 'crystal' },
    { x: 24, y: 6, z: -30, R: 3.5, deco: 'bare' },
    { x: 104, y: 4, z: -40, R: 5, deco: 'cypress' },
    { x: -108, y: 14, z: -18, R: 4, deco: 'bare' },
    { x: 180, y: 30, z: -120, R: 14, deco: 'shrine' },
    { x: -190, y: 22, z: 60, R: 12, deco: 'arch' },
    { x: -150, y: 40, z: -170, R: 16, deco: 'tree' },
    { x: 150, y: 18, z: 170, R: 10, deco: 'cypress' },
    { x: 20, y: 34, z: -230, R: 18, deco: 'shrine' },
    { x: -40, y: 10, z: 210, R: 9, deco: 'tree' },
  ]);
  // Pillars of light: some on landmarks, and a few falling straight onto the sea of clouds
  const at = (x: number, z: number, rr: number) => ({ x, z, r: rr, y: ctx.h(x, z) - 0.5 });
  lightBeams(ctx, [
    at(SH.MOSAIC[0], SH.MOSAIC[1], 3.4),
    at(SH.SPRING[0], SH.SPRING[1], 3.0),
    at(SH.GARDEN[0], SH.GARDEN[1], 3.4),
    at(SH.GLASS[0], SH.GLASS[1], 3.8),
    at(SH.RUINS[0], SH.RUINS[1], 3.2),
    at(SH.NEST[0], SH.NEST[1], 2.8),
    at(SH.OVERLOOK[0], SH.OVERLOOK[1], 2.6),
    at(SH.TRIBUNAL[0], SH.TRIBUNAL[1], 3.0),
    { x: 44, z: -40, r: 5, y: SH.CLOUD_Y },
    { x: -54, z: 90, r: 4.5, y: SH.CLOUD_Y },
    { x: 104, z: 70, r: 5.5, y: SH.CLOUD_Y },
    { x: -110, z: -64, r: 5, y: SH.CLOUD_Y },
  ]);
  // White doves
  doves(ctx, [
    { c: new THREE.Vector3(SH.BELFRY[0], ctx.h(SH.BELFRY[0], SH.BELFRY[1]) + 28, SH.BELFRY[1]), r: 10, n: low ? 5 : 9, speed: 0.32 },
    { c: new THREE.Vector3(SH.TOWN[0], 16, SH.TOWN[1]), r: 15, n: low ? 6 : 12, speed: -0.24 },
    { c: new THREE.Vector3(SH.CATHEDRAL.x, 40, SH.CATHEDRAL.z), r: 22, n: low ? 5 : 10, speed: 0.2 },
    { c: new THREE.Vector3(SH.GARDEN[0], 16, SH.GARDEN[1]), r: 12, n: low ? 4 : 7, speed: -0.3 },
    { c: new THREE.Vector3(SH.TOWER[0], 58, SH.TOWER[1]), r: 28, n: low ? 6 : 12, speed: 0.15 },
  ]);
}

/**
 * Ambient particles: fountain spray, star glints that flash now and then in the air,
 * purple mist drifting out of the Purification Ward's cages
 */
function ambience(ctx: FieldCtx, sprays: THREE.Vector3[], cage: THREE.Vector3 | null): void {
  const pure = ctx.done >= ctx.floors;
  const town = new THREE.Vector3(SH.TOWN[0], ctx.h(SH.TOWN[0], SH.TOWN[1]), SH.TOWN[1]);
  let t2 = 0;
  let t0 = 0;
  let t1 = 0;
  ctx.extras.push((dt, _t, vfx) => {
    const cam = vfx.camPos;
    t0 += dt;
    while (t0 > 0.12) {
      t0 -= 0.12;
      for (const p of sprays) {
        if (p.distanceTo(cam) > 70) continue;
        const a = Math.random() * Math.PI * 2;
        vfx.emit({ pos: p.clone().add(new THREE.Vector3(Math.cos(a) * 0.4, 1.9, Math.sin(a) * 0.4)), count: 1, color: [0xdff4ff, 0xffffff], speed: [1.6, 2.6], dir: new THREE.Vector3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4), spread: 0.25, gravity: 5, life: [0.7, 1.0], size: [0.1, 0.18], intensity: 1.2 });
      }
    }
    t1 += dt;
    while (t1 > 0.35) {
      t1 -= 0.35;
      const a = Math.random() * Math.PI * 2;
      const d = 6 + Math.random() * 26;
      const x = cam.x + Math.cos(a) * d;
      const z = cam.z + Math.sin(a) * d;
      vfx.emit({ pos: new THREE.Vector3(x, ctx.h(x, z) + 0.8 + Math.random() * 6, z), count: 1, color: [0xfff0b0, 0xffffff], speed: [0.1, 0.4], life: [0.5, 0.9], size: [0.12, 0.22], atlas: 1, intensity: 2.2 });
      if (cage && cage.distanceTo(cam) < 60) vfx.emit({ pos: cage, count: 1, color: [0x9a3aff, 0x5a1a8a], speed: [0.2, 0.5], dir: new THREE.Vector3(0, 1, 0), spread: 0.6, life: [1.2, 2], size: [0.3, 0.5], sizeEnd: 1.6, radius: 0.6, intensity: 1.1 });
    }
    // After the purification is done, the Outer City celebrates: petals drift down from the sky
    if (pure && town.distanceTo(cam) < 70) {
      t2 += dt;
      while (t2 > 0.16) {
        t2 -= 0.16;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 16;
        vfx.emit({ pos: town.clone().add(new THREE.Vector3(Math.cos(a) * d, 7 + Math.random() * 4, Math.sin(a) * d)), count: 1, color: [0xffc4dc, 0xffffff, 0xffe39a], speed: [0.2, 0.5], dir: new THREE.Vector3(0.3, -1, 0.1), spread: 0.5, gravity: 0.35, life: [4, 5.5], size: [0.13, 0.2], intensity: 1.0 });
      }
    }
  });
  void C;
}
