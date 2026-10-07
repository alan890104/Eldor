// Void Rift (final chapter, no element): the wound left by the Night of the Shattered Heart. The whole land hangs in the void and is crumbling.
// On the central Core Isle stands the "Rift Tower" the Uncrowned built with his own hands, held down by four huge chains,
// ringed by a circular abyss glowing purple-red;
// the outer land is cut into four pieces by radial cracks and linked by stone bridges: on the south shore cliff is the
// Knights' Outpost (the only warm firelight on the whole map),
// to the west are the ruins of the old kingdom and the fallen statue of the Uncrowned King, to the north the broken bridge
// and the Inverted Quarter, and to the east the Blightcrystal Basin overgrown with blight crystals;
// on an isle in the open sea to the northeast is the Shattered Heart Altar.
// In the sky are spinning nebulae, torn space and an upside-down phantom royal city, and slowly tumbling shards drift in the void.
//
// The structure is split into biomes/rift/: shape (terrain), layout (arrangement), void (void and sky), ground (fissure light and cliff edges),
// outpost (the outpost), ruins (landmarks), fx (fire and flags), props (shared props), glsl (shared shaders).

import * as THREE from 'three';
import { rng } from '../../arenaKit.ts';
import type { Biome } from '../kit.ts';
import { flushGlows } from './rift/decals.ts';
import { buildFissures, planFissures } from './rift/fissure.ts';
import { Scatter } from './rift/inst.ts';
import { buildRoadside } from './rift/roadside.ts';
import { buildScatter, groundCover, HEAL, registerKinds } from './rift/scatter.ts';
import { Banners, Flames } from './rift/fx.ts';
import { heartbeat, type RiftClock } from './rift/glsl.ts';
import { bloom, groundCracks, rimGuard, rimProps } from './rift/ground.ts';
import { LAYOUT } from './rift/layout.ts';
import { healGround } from './rift/heal.ts';
import { buildOutpost } from './rift/outpost.ts';
import { buildRelics } from './rift/relics.ts';
import { buildRuins } from './rift/ruins.ts';
import { BASIN, COLOSSUS, CRATER, FIELD, ISLE, land, relief, RIN, riftHeight, SINKS, sm, T, TOWN, VOID_Y } from './rift/shape.ts';
import { buildVoid, type Debris } from './rift/void.ts';
import { buildWisps } from './rift/wisps.ts';

const C = {
  warm: new THREE.Color(0x5e4c42),
  basin: new THREE.Color(0x3a2a58),
  crater: new THREE.Color(0x2a2032),
  island: new THREE.Color(0x2c2436),
  rim: new THREE.Color(0x5c5066),
  ruin: new THREE.Color(0x5a5468),
  deep: new THREE.Color(0x6a2a86),
  north: new THREE.Color(0x3c3a52),
  grassWarm: new THREE.Color(0x7a6c52),
  grassAsh: new THREE.Color(0x564c64),
  grassAsh2: new THREE.Color(0x443c52),
  /** Grass that grows back after purification */
  grassHeal: new THREE.Color(0x6e8058),
  ash: new THREE.Color(0x6e6478),
  stain: new THREE.Color(0x221a2c),
  crest: new THREE.Color(0x645a74),
  pit: new THREE.Color(0x1c1426),
};

/**
 * Distance to the roads (main road and paths), on a 1-meter grid, computed only on first use (so the coloring can keep the
 * two sides of the road clean)
 */
let roadGrid: Float32Array | null = null;
function roadDist(x: number, z: number): number {
  const S = LAYOUT.size;
  const n = S * 2 + 1;
  if (!roadGrid) {
    const g = new Float32Array(n * n).fill(30);
    for (const line of [LAYOUT.path, ...(LAYOUT.trails ?? [])]) {
      const curve = new THREE.CatmullRomCurve3(line.map(([px, pz]) => new THREE.Vector3(px, 0, pz)), false, 'centripetal');
      for (const p of curve.getSpacedPoints(Math.max(2, Math.round(curve.getLength() / 1.2)))) {
        const ci = Math.round(p.x + S);
        const cj = Math.round(p.z + S);
        for (let j = Math.max(0, cj - 10); j <= Math.min(n - 1, cj + 10); j++) {
          for (let i = Math.max(0, ci - 10); i <= Math.min(n - 1, ci + 10); i++) {
            const d = Math.hypot(i - S - p.x, j - S - p.z);
            if (d < g[j * n + i]) g[j * n + i] = d;
          }
        }
      }
    }
    roadGrid = g;
  }
  const i = Math.min(n - 1, Math.max(0, Math.round(x + S)));
  const j = Math.min(n - 1, Math.max(0, Math.round(z + S)));
  return roadGrid[j * n + i];
}

const hash = (x: number, z: number) => {
  const v = Math.sin(Math.round(x) * 12.9898 + Math.round(z) * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const dist = (x: number, z: number, p: readonly [number, number]) => Math.hypot(x - p[0], z - p[1]);

export const rift: Biome = {
  layout: LAYOUT,
  cols: { grass: 0x4a4256, grass2: 0x3a3346, path: 0x5c5468, cliff: 0x2a2233, plaza: 0x6a5648 },
  fog: [80, 360],
  palette: {
    fog: 0x24102e,
    ambient: 0x7a5a88,
    light: [0.35, 0.8, 0.45],
    rim: 0xff8ac8,
    shadow: 0x2a0a34,
    motes: [0xff3a7a, 0xb04aff, 0xff86d8],
    moteKind: 'rise',
    stars: true,
  },
  height: riftHeight,
  paint(x, z, h, slope, out) {
    const d = land(x, z);
    // Camp: trampled warm earth
    const tw = 1 - sm(13, 24, dist(x, z, TOWN));
    if (tw > 0) out.lerp(C.warm, tw * 0.55);
    // Core Isle: obsidian-like ground
    const rT = dist(x, z, T);
    if (rT < RIN + 4) out.lerp(C.island, (1 - sm(RIN - 8, RIN + 2, rT)) * 0.55);
    // The Blightcrystal Basin leans purple, the pits of the Inverted Quarter lean dark, the old city in the west leans gray,
    // and the broken plain in the north leans cold
    out.lerp(C.basin, (1 - sm(8, 28, dist(x, z, BASIN))) * 0.6);
    out.lerp(C.crater, (1 - sm(6, 16, dist(x, z, CRATER))) * 0.6);
    out.lerp(C.ruin, sm(-40, -62, x) * (1 - sm(-40, -10, z) * 0) * 0.35 + (1 - sm(6, 20, dist(x, z, COLOSSUS))) * 0.2);
    out.lerp(C.north, sm(-70, -90, z) * 0.3);
    out.lerp(C.crater, (1 - sm(4, 18, dist(x, z, FIELD))) * 0.35);
    // Cliff edge: a ring of crumbling pale rock rim
    if (d > -1 && d < 5) out.lerp(C.rim, (1 - sm(1, 5, d)) * (1 - sm(0.7, 1.2, slope)) * 0.5);
    // Surface detail (only on flat ground and gentle slopes): patches of wind-blown ash, dark blight stains, lighter ridge lines of ground pushed up,
    // a particularly dark floor in the collapsed pits with a ring of overturned pale soil at the pit rim;
    // plus a little light and shade in every cell, like ground strewn with rubble
    const flat = (1 - sm(0.45, 0.8, slope)) * sm(0, 3, d) * sm(12, 22, dist(x, z, TOWN));
    if (flat > 0) {
      const ash = sm(0.2, 0.8, Math.sin(x * 0.083 + Math.sin(z * 0.061) * 1.7) * Math.cos(z * 0.071 - Math.sin(x * 0.052) * 1.3) + 0.3 * Math.sin(x * 0.21 + z * 0.17));
      out.lerp(C.ash, ash * 0.3 * flat);
      const stain = sm(0.35, 0.9, Math.sin(x * 0.047 - 1.1 + Math.sin(z * 0.09) * 1.2) * Math.sin(z * 0.053 + 0.6) + 0.25 * Math.cos(x * 0.19 - z * 0.13));
      const rd = roadDist(x, z);
      out.lerp(C.stain, stain * 0.4 * flat * (0.4 + 0.6 * sm(90, 50, dist(x, z, T))) * sm(4, 10, rd));
      // Road shoulder: pale dust kicked up by trampling
      out.lerp(C.ash, (1 - sm(3, 6.5, rd)) * sm(1.5, 3, rd) * 0.3 * flat);
      out.lerp(C.crest, sm(0.45, 1.2, relief(x, z)) * 0.35 * flat);
      for (const [sx, sz, sr] of SINKS) {
        const dd = Math.hypot(x - sx, z - sz);
        if (dd > sr * 1.6) continue;
        out.lerp(C.pit, (1 - sm(sr * 0.2, sr * 0.9, dd)) * 0.7);
        out.lerp(C.ash, Math.exp(-(((dd - sr * 1.12) / (sr * 0.2)) ** 2)) * 0.45 * flat);
      }
      out.multiplyScalar(0.9 + 0.18 * hash(x, z) * flat);
    }
    // The closer a cliff face gets to the void going down, the more it is lit by the abyss's purple light
    if (h < -3) out.lerp(C.deep, sm(-6, VOID_Y + 4, h) * 0.55);
    void ISLE;
  },
  grass: {
    density: 0.85,
    height: 0.75,
    // Grass grows only after decorate: the blade tips, coverage and color all follow the purification progress (HEAL)
    get tip() {
      return HEAL.pure ? 0xd8eca0 : 0xc8a8d8;
    },
    cover: (x, z) => {
      if (land(x, z) < 2.5) return 0;
      const hk = HEAL.k;
      const town = 1 - sm(18, 30, dist(x, z, TOWN));
      if (dist(x, z, BASIN) < 24 - 10 * hk || dist(x, z, CRATER) < 14 - 6 * hk || dist(x, z, FIELD) < 15 - 8 * hk || dist(x, z, T) < RIN + 2) return 0;
      const n = Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.06 - Math.sin(x * 0.04) * 1.6);
      // Around the Wound (as far as the Void Blight erosion reaches) not a blade of grass grows,
      // with only a few clumps at the outer edge; with each floor purified, the grass grows back a little closer to the tower
      const barren = sm(48 - 24 * hk, 80 - 34 * hk, dist(x, z, T));
      return Math.max(town * 0.9, (0.55 + 0.25 * hk) * sm(-0.1 - 0.3 * hk, 0.5, n) * barren);
    },
    color: (x, z, out) => {
      const town = 1 - sm(20, 44, dist(x, z, TOWN));
      const n = Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.11 + Math.sin(x * 0.05) * 2);
      out.copy(C.grassAsh).lerp(C.grassAsh2, sm(-0.4, 0.6, n)).lerp(C.grassWarm, town * 0.8);
      if (HEAL.k > 0) out.lerp(C.grassHeal, HEAL.k * (0.5 + 0.35 * sm(-0.5, 0.5, n)) * (1 - town * 0.6));
    },
  },
  tower: { stone: 0x3e3448, stoneDark: 0x221a2c, trim: 0x6a4a86, roof: 0x2a1e38, glow: 0xffd89a, kind: 'ruin' },
  decorate(ctx) {
    // Once the Seal Tower is fully broken through (this region is purified), the light of the rift calms,
    // the tears in space close, and the heart crystal on the altar is restored to gold
    const pure = ctx.done >= ctx.floors;
    const clock: RiftClock = { uTime: { value: 0 }, uBeat: { value: 0 }, uCalm: { value: pure ? 1 : 0 } };
    ctx.extras.push((_dt, t) => {
      clock.uTime.value = t;
      clock.uBeat.value = pure ? heartbeat(t * 0.65) * 0.4 : heartbeat(t);
    });
    HEAL.pure = pure;
    HEAL.k = ctx.floors > 0 ? ctx.done / ctx.floors : 0;
    const erode = (ctx.terrain.mesh.material as THREE.ShaderMaterial).uniforms?.uErode as { value: THREE.Vector4 } | undefined;
    const fl = new Flames();
    const bn = new Banners();
    const sc = new Scatter();
    registerKinds(sc);
    const debris: Debris[] = [];
    const spots: [number, number, number][] = [];
    const rim = rimGuard(ctx);
    rimProps(ctx, rim);
    buildOutpost(ctx, clock, fl, bn);
    buildRuins(ctx, clock, fl, bn, debris);
    buildRelics(ctx, fl, rng(4417), spots, debris);
    // Newly added details each use their own random stream: the earlier layout does not shift when one more or one fewer is placed here
    buildRoadside(ctx, sc, fl, rng(5311), spots, debris);
    debris.push(...buildFissures(ctx, clock, planFissures(ctx, rng(6151)), sc, rng(6152)));
    buildScatter(ctx, sc, rng(7121), spots, debris);
    groundCover(ctx, sc, spots, rng(7122));
    sc.build(ctx);
    groundCracks(ctx, clock, erode);
    if (pure) bloom(ctx);
    healGround(ctx, rng(8411));
    // The void uses its own random stream (placed last: the floating debris must avoid the props already placed)
    buildVoid(ctx, clock, rng(9173), debris);
    buildWisps(ctx, clock, pure, rng(8123));
    fl.build(ctx, clock);
    bn.build(ctx, clock);
    flushGlows(ctx);

    // Black ash drifts up from the ground (normal blending, so it can be darker than the background);
    // after purification it is replaced by scattered gold light points
    let ashT = 0;
    const every = pure ? 0.3 : 0.1;
    ctx.extras.push((dt, _t, vfx) => {
      ashT += dt;
      while (ashT > every) {
        ashT -= every;
        const a = Math.random() * Math.PI * 2;
        const d = 4 + Math.random() * 26;
        const x = vfx.camPos.x + Math.cos(a) * d;
        const z = vfx.camPos.z + Math.sin(a) * d;
        if (land(x, z) < 0 || dist(x, z, TOWN) < 22) continue;
        const pos = new THREE.Vector3(x, ctx.h(x, z) + 0.2, z);
        if (pure) vfx.emit({ pos, count: 1, color: [0xffe0a0, 0xfff4d8], speed: [0.2, 0.5], dir: new THREE.Vector3(0, 1, 0), spread: 0.4, life: [2.5, 4], size: [0.06, 0.12], sizeEnd: 0.02, intensity: 1.4 });
        else vfx.smoke({ pos, count: 1, color: [0x07030c, 0x160a1e], speed: [0.25, 0.7], dir: new THREE.Vector3(0.15, 1, 0.05), spread: 0.35, life: [3.5, 6], size: [0.16, 0.34], sizeEnd: 0.5, drag: 0.02, intensity: 1 });
      }
    });
  },
};
