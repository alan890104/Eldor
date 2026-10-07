// Emberspine Volcanic Belt (fire): the Emberspine main peak, off the northwest edge of the map, is erupting. Magma runs down
// its flanks and turns into a lavafall on the northwest cliff wall, becoming a lava river that crosses the whole map and
// finally empties into the lava lake in the east. On a small hill to the south stands the iron-walled forge city "Rediron
// Keep"; north of its North Gate is a black cold lava plain, and the main road follows a stone bridge over the lava river,
// passes through the Basalt Gate and climbs to the northern plateau, where the Emberspine Seal Tower stands right beside the
// Magma Crater. To the west are the Basalt Colonnade, the Abandoned Mine and the Sulfur Hot Spring Terraces; to the east are
// the Sword Mound and the giant dragon skeleton; from the plateau's east end the Emberspine ridge climbs to a high mesa, the
// Phoenix Nest (secret realm). The terrain skeleton is in volcano/shape.ts, the shaders in volcano/fx.ts, the town in
// volcano/town.ts, the landmarks in volcano/wild.ts, the far view in volcano/far.ts; the ground layer that covers the whole
// map (gravel, lava crust, lava bombs, fumaroles, emberbell flowers...) is in volcano/ground.ts, the traces of people
// outside the town in volcano/works.ts, and the difference between before and after purification (the Order's stakes, the
// fireweed and moss that grow back after purification) in volcano/purified.ts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smooth } from '../compose.ts';
import { Solids, type Biome, type FieldCtx } from '../kit.ts';
import { buildFar } from './volcano/far.ts';
import { curtain, disposeShared, flagMaterial, hazeMaterial, lightPools, patchTerrain } from './volcano/fx.ts';
import { buildGround, type GroundOut, type Pool } from './volcano/ground.ts';
import { Stains } from './volcano/tmpl.ts';
import { buildPurified, type PurifiedOut } from './volcano/purified.ts';
import { buildSites, type SitesOut } from './volcano/sites.ts';
import { buildWorks, type WorksOut } from './volcano/works.ts';
import {
  COLONNADE,
  CONES,
  CRATER,
  FIELD,
  FOG,
  GEYSER,
  GEYSER_VENTS,
  LAVA,
  MESA,
  PATH,
  S,
  SPRINGS,
  SPRING_DOWN,
  SWORDS,
  TOWER,
  TOWN,
  TOWN_R,
  TRAILS,
  WALL_R,
  height,
  lavaEdgeDist,
  lobes,
  terraceMask,
} from './volcano/shape.ts';
import { buildTown } from './volcano/town.ts';
import { buildWild } from './volcano/wild.ts';

const c = (hex: number) => new THREE.Color(hex);
// North Gate faces the tower: the spawn point is outside the gate, so on leaving the town you see the lava river, the stone
// bridge and the distant tower
const GATE_DIR = (() => {
  const dx = TOWER[0] - TOWN[0];
  const dz = TOWER[1] - TOWN[1];
  const l = Math.hypot(dx, dz);
  return [dx / l, dz / l] as const;
})();
const SPAWN: [number, number, number] = [TOWN[0] + GATE_DIR[0] * 36, TOWN[1] + GATE_DIR[1] * 36, Math.atan2(GATE_DIR[0], GATE_DIR[1])];

const C_ASH = c(0x5e5a60);
const C_OXIDE = c(0x5a3026);
const C_SINTER = c(0x8a8680);
const C_MAT_O = c(0xb8642a);
const C_MAT_G = c(0x7a7a3a);
const C_BASALT = c(0x28222a);
const C_SCORIA = c(0x6a3a30);
const C_SULFUR = c(0xc08a3e);
const C_TRAVERTINE = c(0xb6a484);
const C_TRAV_LIP = c(0xcfc0a0);
const C_TRAV_STAIN = c(0xa0603a);
const C_RUST = c(0x6e4230);
const C_SCORCH = c(0x2a1614);
const C_TOWN = c(0x5a4e56);
const C_SAND = c(0x9a7a5a);
const C_NEST = c(0x4a2e26);
const C_GRASS = c(0x8a6a36);
const C_GRASS2 = c(0x5e3a24);
const C_MOSS = c(0x5e8a52);
const C_MOSS2 = c(0x3e7a5a);
const C_LOBE = c(0x241c20);
const C_HOLLOW = c(0x6a6064);
// new grass that grows back after purification
const C_BLOOM = c(0x6a8a3a);
const C_BLOOM2 = c(0x4a7a44);

/**
 * How far the Seal Tower has been broken through (set at the start of decorate; grass is grown after decorate, so grass
 * coverage and color can read it)
 */
let bloomK = 0;

const n2 = (x: number, z: number) => Math.sin(x * 0.037 + Math.sin(z * 0.029) * 1.8) * Math.cos(z * 0.041 - 0.6) + 0.35 * Math.sin(x * 0.11 - z * 0.09);

export const volcano: Biome = {
  cols: { grass: 0x4a3e42, grass2: 0x2c2428, path: 0x7c6250, cliff: 0x241d22, sand: 0x2e1a18, plaza: 0x6a5c5e },
  fog: [60, 310],
  palette: {
    fog: FOG,
    sky: ['#1c0a12', '#7a2c1e', '#ff9048'],
    light: [0.45, 0.75, 0.35],
    ambient: 0xa0706a,
    motes: [0xff7a2a, 0xffc040],
    moteKind: 'rise',
  },
  layout: {
    size: S,
    edge: 'cliff',
    town: TOWN,
    townR: TOWN_R,
    tower: TOWER,
    spawn: SPAWN,
    // the teleport circle is on the plateau east of the North Gate
    waypoint: [41.5, 42.5],
    pathW: 2.4,
    path: PATH,
    trails: TRAILS,
    zones: [
      // Outside the town: the cold lava plain and the area outside the North Gate
      { x: 20, z: 26, r: 15, tier: 0, count: 4, species: ['bellowsbeast', 'shieldbeetle', 'pyrewing'] },
      { x: 2, z: 50, r: 12, tier: 0, count: 2, species: ['bellowsbeast', 'pyrewing', 'digmole'] },
      // West: the Basalt Colonnade and the Abandoned Mine
      { x: COLONNADE[0], z: COLONNADE[1], r: 15, tier: 1, count: 2, species: ['monolith', 'digmole', 'shieldbeetle'], corrupt: 0.12 },
      { x: -72, z: 62, r: 12, tier: 1, count: 2, species: ['digmole', 'monolith', 'bellowsbeast'], corrupt: 0.12 },
      // East: the Sword Mound
      { x: SWORDS[0], z: SWORDS[1], r: 14, tier: 1, count: 3, species: ['shieldbeetle', 'pyre_dragoon', 'monolith'], corrupt: 0.15 },
      // North bank of the river, hot springs
      { x: -36, z: -36, r: 11, tier: 1, count: 2, species: ['pyrewing', 'bellowsbeast', 'pyre_dragoon'], corrupt: 0.12 },
      { x: SPRINGS[0], z: SPRINGS[1] + 4, r: 14, tier: 1, count: 2, species: ['steameel', 'pyrewing', 'bellowsbeast'], corrupt: 0.1 },
      // Geyser Flats
      { x: GEYSER[0], z: GEYSER[1], r: 13, tier: 1, count: 2, species: ['steameel', 'bellowsbeast', 'shieldbeetle'], corrupt: 0.12 },
      // Around the tower: the lava lake shore and the crater
      { x: 56, z: -50, r: 13, tier: 2, count: 3, species: ['magma_golem', 'pyre_dragoon', 'pyrewing', 'steameel'], corrupt: 0.25 },
      { x: -14, z: -66, r: 10, tier: 2, count: 2, species: ['magma_golem', 'monolith', 'pyrewing'], corrupt: 0.3 },
      // Secret realm: the Phoenix Nest
      { x: MESA[0], z: MESA[1], r: 8, tier: 2, count: 2, species: ['phoenix', 'magma_golem', 'pyre_dragoon'], corrupt: 0.2 },
    ],
    chests: [
      [-60, 29],
      [-83, 72],
      [73, 29],
      [-73, -68],
      [64, -56],
      [85, -86],
    ],
    npcs: [
      [SPAWN[0] - 3.2, SPAWN[1] + 1.6, 2.1],
      [29.5, 66.2, Math.PI / 2],
      [37.6, 75.2, Math.PI],
    ],
  },
  height,
  water: { level: LAVA, shallow: 0xd8561c, deep: 0x8a1e0a, foam: 0xffb040, lava: true },
  paint(x, z, h, slope, out) {
    const flat = 1 - smooth(0.5, 0.95, slope);
    const le = lavaEdgeDist(x, z);
    // grey-white volcanic ash ground alternating with black cold lava, plus patches of rust-red oxidized soil
    // make the edges crisp (cartoon style), not one big blurry gradient
    const ashN = n2(x, z) + 0.1 * Math.sin(x * 0.21 + z * 0.13) * Math.cos(z * 0.19 - x * 0.07);
    out.lerp(C_ASH, smooth(0.36, 0.5, ashN) * 0.5 * flat);
    out.lerp(C_OXIDE, smooth(0.52, 0.64, n2(x * 0.7 + 40, z * 0.7 - 17)) * 0.45 * flat);
    // lava tongues: the leading edge is fresh black basalt, and low spots hold pale volcanic ash
    const [, front, hollow] = lobes(x, z);
    out.lerp(C_LOBE, front * 0.5);
    out.lerp(C_HOLLOW, hollow * 0.45 * flat);
    const field = 1 - smooth(16, 32, Math.hypot(x - FIELD[0], z - FIELD[1]));
    out.lerp(C_BASALT, Math.min(0.85, (1 - smooth(1.5, 15, le)) * 0.7 + field * 0.75) * flat);
    out.lerp(C_SCORCH, (1 - smooth(0.2, 3, le)) * 0.75);
    // cinder cones are red-brown
    for (const [cx, cz, , cr] of CONES) out.lerp(C_SCORIA, (1 - smooth(cr * 0.5, cr * 1.1, Math.hypot(x - cx, z - cz))) * 0.8);
    // hot spring terraces: the platforms are milky-white travertine, the step walls are sulfur yellow
    const tm = terraceMask(x, z);
    if (tm > 0) {
      // travertine crust (a warmer beige, since pure white blows out in firelight), with streaks of rust orange and sulfur
      // yellow running down the slope, and along the contour lines a brighter step edge every so often (small terraces, step
      // by step)
      out.lerp(C_TRAVERTINE, tm * 0.8);
      const lat = (x - SPRINGS[0]) * -SPRING_DOWN[1] + (z - SPRINGS[1]) * SPRING_DOWN[0];
      const along = (x - SPRINGS[0]) * SPRING_DOWN[0] + (z - SPRINGS[1]) * SPRING_DOWN[1];
      const streak = smooth(0.5, 0.9, Math.sin(lat * 1.1 + Math.sin((x + z) * 0.15) * 2.2));
      out.lerp(C_TRAV_STAIN, streak * tm * 0.45);
      out.lerp(C_SULFUR, smooth(0.7, 0.95, Math.sin(lat * 0.53 + 1.7 + Math.sin(along * 0.2) * 1.4)) * tm * 0.4);
      const step = along / 2.3 + 0.25 * Math.sin(lat * 0.6);
      out.lerp(C_TRAV_LIP, (1 - smooth(0.12, 0.35, step - Math.floor(step))) * tm * 0.45);
    }
    // Geyser Flats: grey-white silica sinter ground, with a ring of orange and yellow-green microbial mat at the foot of
    // each sinter mound
    const dg = Math.hypot(x - GEYSER[0], z - GEYSER[1]) + Math.sin(Math.atan2(z - GEYSER[1], x - GEYSER[0]) * 4 + 1) * 1.6;
    if (dg < 18) {
      out.lerp(C_SINTER, (1 - smooth(13, 15.5, dg)) * 0.8 * flat);
      for (const [vx, vz, vs] of GEYSER_VENTS) {
        const dv = Math.hypot(x - GEYSER[0] - vx, z - GEYSER[1] - vz) / vs;
        out.lerp(C_MAT_O, (1 - smooth(3.2, 3.8, dv)) * smooth(2.1, 2.5, dv) * 0.8);
        out.lerp(C_MAT_G, (1 - smooth(4.4, 5.2, dv)) * smooth(3.7, 4.2, dv) * 0.6);
      }
    }
    // rust-red soil of the Sword Mound, scorched earth on the mesa
    const ds = Math.hypot(x - SWORDS[0], z - SWORDS[1]) + Math.sin(Math.atan2(z - SWORDS[1], x - SWORDS[0]) * 5) * 1.2;
    out.lerp(C_RUST, (1 - smooth(13, 15, ds)) * 0.55 * flat);
    out.lerp(C_TOWN, (1 - smooth(4.6, 5.4, ds)) * 0.5);
    out.lerp(C_NEST, (1 - smooth(9, 13, Math.hypot(x - MESA[0], z - MESA[1]))) * 0.7);
    // the crater rim is charred black
    out.lerp(C_SCORCH, (1 - smooth(10, 18, Math.hypot(x - CRATER[0], z - CRATER[1]))) * 0.55);
    // flagstones inside the town and the sand of the drill yard
    const dt = Math.hypot(x - TOWN[0], z - TOWN[1]);
    if (dt < WALL_R + 2) {
      out.lerp(C_TOWN, (1 - smooth(WALL_R - 1, WALL_R + 1.5, dt)) * 0.7);
      const ty = Math.hypot(x - 41.3, z - 76.2);
      out.lerp(C_SAND, (1 - smooth(4, 5.5, ty)) * 0.8);
    }
    void h;
  },
  grass: {
    density: 0.85,
    height: 0.8,
    tip: 0xe8b868,
    cover: (x, z, h, slope) => {
      void h;
      void slope;
      const tm = terraceMask(x, z);
      if (tm > 0.25) return 0.3 * tm * smooth(0.1, 0.7, n2(x * 2, z * 2));
      const le = lavaEdgeDist(x, z);
      if (le < 5) return 0;
      const field = 1 - smooth(16, 32, Math.hypot(x - FIELD[0], z - FIELD[1]));
      // on the volcanic ash ground there are only scattered tufts of dead grass, not a whole meadow
      const south = 0.2 + 0.5 * smooth(-10, 40, z);
      const base = south * smooth(0.3, 0.85, n2(x * 1.7 + 3, z * 1.7)) * (1 - field) * smooth(5, 12, le) * smooth(12, 19, Math.hypot(x - SWORDS[0], z - SWORDS[1]));
      if (bloomK <= 0) return base;
      // After purification: new grass sprouts patch by patch on the grey ground (the lava shore is still too hot)
      const patch = smooth(-0.1, 0.55, n2(x * 1.3 - 7, z * 1.3 + 2));
      return Math.max(base, bloomK * (0.25 + 0.35 * patch) * smooth(6, 14, le));
    },
    color: (x, z, out) => {
      const tm = terraceMask(x, z);
      out.copy(C_GRASS).lerp(C_GRASS2, smooth(-0.5, 0.6, n2(x * 3, z * 3)));
      if (tm > 0) out.lerp(Math.sin(x * 0.7 + z * 0.5) > 0 ? C_MOSS : C_MOSS2, smooth(0.2, 0.6, tm));
      else if (bloomK > 0) out.lerp(Math.sin(x * 0.31 - z * 0.23) > 0 ? C_BLOOM : C_BLOOM2, bloomK * (0.45 + 0.4 * smooth(-0.3, 0.6, n2(x * 2.2, z * 2.2 - 5))));
    },
  },
  tower: { stone: 0x5a4a52, stoneDark: 0x3a3036, trim: 0xb8743a, roof: 0x7a2a22, glow: 0xff8a3a, kind: 'spire' },
  decorate(ctx) {
    bloomK = ctx.floors > 0 ? Math.min(1, ctx.done / ctx.floors) : 0;
    // For development: add &vdbg to the URL to print how long each pass took
    const dbg = location.search.includes('vdbg');
    const t0 = performance.now();
    let tl = t0;
    const lap = (name: string) => {
      if (!dbg) return;
      const t = performance.now();
      console.log(`volcano ${name} ${Math.round(t - tl)} ms`);
      tl = t;
    };
    const setHeat = heatMap(ctx);
    lap('heat');
    const far = buildFar(ctx);
    lap('far');
    const town = buildTown(ctx);
    lap('town');
    // Ground stains (scorch marks, rust, microbial mat, soot): each place registers its own first, then they are written
    // into the terrain's vertex colors in one pass
    const stains = new Stains();
    const wild = buildWild(ctx, far.out.riverStart, stains);
    lap('wild');
    // Placement area of the traces of people and landmarks (not blocking the road, but the ground layer must not be laid
    // over them: rails, camps)
    const busy = new Solids();
    const pools: Pool[] = [];
    const works = buildWorks(ctx, busy, pools, stains);
    lap('works');
    const ground = buildGround(ctx, busy, stains, wild.pebbles);
    lap('ground');
    const sites = buildSites(ctx, busy, ground);
    lap('sites');
    const pure = buildPurified(ctx, busy, ground);
    lap('purified');
    stains.apply(ctx);
    if (dbg) console.log(`volcano decorate ${Math.round(performance.now() - t0)} ms`);
    // Ground light pools (under braziers, lava bombs, sinter cones, fumaroles...) and the heat shimmer of the small sinter cones
    for (const f of [...town.flames, ...wild.flames, ...works.flames, ...pure.flames]) pools.push({ x: f.x, z: f.z, r: 3.2, color: 0xffa040, amt: 0.32 });
    for (const q of pure.purple) pools.push({ x: q.x, z: q.z, r: 2.4, color: 0x9a3aff, amt: 0.3 });
    const setPools = lightPools(ctx, [...pools, ...ground.pools]);
    const setHaze = coneHaze(ctx, ground.cones);

    // Flickering furnace fire (the blast furnace's belt, the tap hole, the forges)
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a, toneMapped: false });
    const fireGeo = town.fireGeos.length ? mergeGeometries(town.fireGeos.map((g) => (g.index ? g.toNonIndexed() : g))) : null;
    if (fireGeo) ctx.group.add(new THREE.Mesh(fireGeo, fireMat));
    // Banners (one mesh)
    const flagMat = flagMaterial();
    const flagGeo = mergeGeometries([...town.flags, ...wild.flags, ...works.flags, ...pure.flags]);
    if (flagGeo) ctx.group.add(new THREE.Mesh(flagGeo, flagMat));
    ctx.disposers.push(() => {
      fireMat.dispose();
      fireGeo?.dispose();
      flagMat.dispose();
      flagGeo?.dispose();
      for (const g of [...town.fireGeos, ...town.flags, ...wild.flags, ...works.flags, ...pure.flags]) g.dispose();
      disposeShared();
    });

    const fx = particles(ctx, town, wild, ground, works, pure, sites);
    const fireCol = new THREE.Color();
    ctx.extras.push((dt, t, vfx) => {
      setHeat?.(t);
      setPools?.(t);
      setHaze?.(t);
      for (const m of wild.timed) m.uniforms.uTime.value = t;
      flagMat.uniforms.uTime.value = t;
      const k = 2.0 + 0.35 * Math.sin(t * 7.3) + 0.2 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 29.7);
      fireCol.setRGB(1.0, 0.5, 0.18).multiplyScalar(k);
      fireMat.color.copy(fireCol);
      far.update(dt, t, vfx);
      fx(dt, t, vfx);
    });
  },
};

// ───────────────────────── Glowing ground cracks ─────────────────────────

/** Computes the crack brightness texture (r: cracks, g: the warm glow of the lava shore) and rewrites the terrain material */
function heatMap(ctx: FieldCtx): ((t: number) => void) | null {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const L = ctx.layout;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = -S + ((i + 0.5) / N) * S * 2;
      const z = -S + ((j + 0.5) / N) * S * 2;
      const h = ctx.h(x, z);
      const le = lavaEdgeDist(x, z);
      const dc = Math.hypot(x - CRATER[0], z - CRATER[1]);
      let r = (1 - smooth(0.8, 10, le)) * 0.95;
      r = Math.max(r, (1 - smooth(14, 30, Math.hypot(x - FIELD[0], z - FIELD[1]))) * (0.35 + 0.4 * smooth(-0.3, 0.6, n2(x * 2.3, z * 2.3))));
      r = Math.max(r, (1 - smooth(11, 22, dc)) * 0.9);
      r = Math.max(r, (1 - smooth(6, 11, Math.hypot(x - MESA[0], z - MESA[1]))) * 0.5);
      for (const [cx, cz] of CONES) r = Math.max(r, (1 - smooth(2, 6, Math.hypot(x - cx, z - cz))) * 0.7);
      r = Math.max(r, smooth(0.62, 0.95, n2(x * 0.7 + 11, z * 0.7 - 4)) * 0.45);
      // no cracks in the town, on roads, on terraces or in the lava
      r *= smooth(WALL_R + 3, WALL_R + 9, Math.hypot(x - TOWN[0], z - TOWN[1]));
      r *= 0.2 + 0.8 * smooth(L.pathW - 0.5, L.pathW + 1.5, ctx.pathDist(x, z));
      r *= 1 - terraceMask(x, z);
      if (h < LAVA + 0.05) r = 0;
      let g = h > LAVA - 0.4 ? (1 - smooth(0.1, 2.4, h - LAVA)) * (1 - smooth(1, 4, le)) : 0;
      // the inner wall of the crater is lit from below by the lava
      g = Math.max(g, (1 - smooth(7, 11, dc)) * (1 - smooth(0, 15, h - LAVA)) * 0.9);
      // the outer ring is zeroed (the far view outside the map takes the edge value)
      if (i === 0 || j === 0 || i === N - 1 || j === N - 1) r = g = 0;
      const o = (j * N + i) * 4;
      data[o] = Math.round(Math.min(1, r) * 255);
      data[o + 1] = Math.round(Math.min(1, g) * 255);
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  ctx.disposers.push(() => tex.dispose());
  return patchTerrain(ctx, tex);
}

// ───────────────────────── Heat shimmer of the small sinter cones ─────────────────────────

/** Stands a ring of heat shimmer curtains around each small sinter cone (merged into one mesh) */
function coneHaze(ctx: FieldCtx, cones: [number, number, number][]): ((t: number) => void) | null {
  if (!cones.length) return null;
  const rings = cones.map(([x, y, z]) => {
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ring.push(new THREE.Vector3(x + Math.cos(a) * 1.6, y + 0.3, z + Math.sin(a) * 1.6));
    }
    return curtain(ring, 4.5);
  });
  const geo = mergeGeometries(rings);
  for (const g of rings) g.dispose();
  if (!geo) return null;
  const mat = hazeMaterial();
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 7;
  ctx.group.add(m);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
  return (t) => (mat.uniforms.uTime.value = t);
}

// ───────────────────────── Particles ─────────────────────────

type Vfx = Parameters<FieldCtx['extras'][number]>[2];

function particles(ctx: FieldCtx, town: ReturnType<typeof buildTown>, wild: ReturnType<typeof buildWild>, ground: GroundOut, works: WorksOut, pure: PurifiedOut, sites: SitesOut): (dt: number, t: number, vfx: Vfx) => void {
  const up = new THREE.Vector3(0, 1, 0);
  const down = new THREE.Vector3(0, -1, 0);
  const wind = new THREE.Vector3(0.3, 1, 0.08);
  const p = new THREE.Vector3();
  const T = { ember: 0, heat: 0, ash: 0, tap: 0, bubble: 0, cinder: 0 };
  const rnd = Math.random;
  const pick = <V>(a: V[]) => a[Math.floor(rnd() * a.length)];
  const flames = [...wild.flames, ...town.flames, ...works.flames, ...pure.flames];
  const purple = [...wild.purple, ...pure.purple];
  const low = ctx.low;
  return (dt, _t, vfx) => {
    const cam = vfx.camPos;
    const near = (q: THREE.Vector3, d: number) => Math.abs(q.x - cam.x) < d && Math.abs(q.z - cam.z) < d;
    // embers and heat above the lava surface
    T.ember += dt;
    while (T.ember > 0.05) {
      T.ember -= 0.05;
      for (let k = 0; k < 3; k++) {
        const q = pick(wild.embers);
        if (!near(q, 80)) continue;
        p.set(q.x + (rnd() - 0.5) * 3, q.y, q.z + (rnd() - 0.5) * 3);
        vfx.emit({ pos: p, count: 1, color: [0xff7a2a, 0xffc040, 0xff5a1a], speed: [0.6, 1.6], dir: up, spread: 0.35, life: [2, 3.5], size: [0.1, 0.22], sizeEnd: 0.3, gravity: -0.25, drag: 0.2, intensity: 2.2 });
        break;
      }
    }
    T.heat += dt;
    while (T.heat > 0.25) {
      T.heat -= 0.25;
      const q = pick(wild.embers);
      if (!near(q, 70)) continue;
      vfx.emit({ pos: p.set(q.x, q.y + 0.3, q.z), count: 1, color: 0xff8a3a, speed: [0.8, 1.4], dir: up, spread: 0.15, life: [1.5, 2.5], size: [1.8, 2.8], sizeEnd: 1.6, drag: 0.1, intensity: 0.22 });
    }
    // steam from the fumaroles and hot springs
    for (const q of wild.steam) {
      if (!near(q, 70) || rnd() > dt * 2.2) continue;
      vfx.smoke({ pos: q, count: 1, color: [0xe8dcd8, 0xd8ccc8], speed: [1, 2], dir: up, spread: 0.25, life: [1.6, 2.6], size: [0.7, 1.3], sizeEnd: 2.6, gravity: -0.2, drag: 0.6, radius: 0.15 });
    }
    for (const q of wild.springSteam) {
      if (!near(q, 70) || rnd() > dt * 0.7) continue;
      vfx.smoke({ pos: q, count: 1, color: [0xf2f0ea, 0xe0ece8], speed: [0.4, 0.9], dir: wind, spread: 0.3, life: [2.2, 3.2], size: [0.6, 1.0], sizeEnd: 2.0, gravity: -0.1, drag: 0.5, radius: 0.8 });
    }
    for (const q of wild.smoke) {
      if (!near(q, 120) || rnd() > dt * 2) continue;
      vfx.smoke({ pos: q, count: 1, color: [0x2a1a30, 0x3a2440], speed: [1.2, 2], dir: wind, spread: 0.2, life: [4, 6], size: [1.2, 2], sizeEnd: 2.4, gravity: -0.1, drag: 0.3, radius: 0.3 });
    }
    // brazier flames
    for (const q of flames) {
      if (!near(q, 50) || rnd() > dt * 5) continue;
      vfx.emit({ pos: q, count: 1, color: [0xff8a2a, 0xffc040], speed: [0.8, 1.6], dir: up, spread: 0.3, life: [0.4, 0.8], size: [0.25, 0.45], sizeEnd: 0.2, drag: 0.3, radius: 0.12, intensity: 2 });
    }
    // chimneys: the blast furnace gives off black smoke and sparks, the others thin smoke
    for (const ch of town.chimneys) {
      if (!near(ch.p, 150) || rnd() > dt * (ch.big ? 6 : 1.4)) continue;
      vfx.smoke({ pos: ch.p, count: 1, color: ch.big ? [0x3a2a30, 0x4a3a40] : [0x6a5a60, 0x7a6a70], speed: [1.2, 2.2], dir: wind, spread: 0.2, life: [4, 6], size: ch.big ? [1.8, 2.8] : [0.9, 1.4], sizeEnd: 2.3, gravity: -0.1, drag: 0.3, radius: ch.big ? 0.6 : 0.2 });
      if (ch.big && rnd() < 0.5) vfx.emit({ pos: ch.p, count: 1, color: [0xff8a2a, 0xffd060], speed: [1.5, 3], dir: up, spread: 0.5, life: [0.8, 1.6], size: [0.25, 0.45], gravity: 2, drag: 0.5, radius: 0.5 });
    }
    // sparks from the blast furnace's tap hole
    T.tap += dt;
    while (T.tap > 0.12) {
      T.tap -= 0.12;
      if (!near(town.tap, 60)) break;
      vfx.emit({ pos: town.tap, count: 2, color: [0xffc040, 0xffffff, 0xff8a2a], speed: [2, 4.5], dir: p.set(rnd() - 0.5, 0.8, rnd() - 0.5).normalize(), spread: 0.6, life: [0.4, 0.8], size: [0.08, 0.16], gravity: 9, intensity: 2.4 });
    }
    // purple sparks from the Order forge
    for (const q of purple) {
      if (!near(q, 70) || rnd() > dt * 5) continue;
      vfx.emit({ pos: q, count: 1, color: [0xb04aff, 0xff5ad0, 0x7a2aff], speed: [0.6, 1.4], dir: up, spread: 0.4, life: [0.8, 1.6], size: [0.18, 0.32], sizeEnd: 0.2, drag: 0.3, radius: 0.5, intensity: 2.2 });
    }
    // golden motes of the Phoenix Nest
    if (near(wild.nest, 90) && rnd() < dt * 6) {
      vfx.emit({ pos: wild.nest, count: 1, color: [0xffd070, 0xfff0b0, 0xff9a3a], speed: [0.4, 1.2], dir: up, spread: 0.6, life: [2, 3.5], size: [0.14, 0.26], sizeEnd: 0.3, gravity: -0.3, drag: 0.2, radius: 1.8, intensity: 2.4 });
    }
    // sparks and heat thrown up where the lavafall lands
    for (const q of wild.splash) {
      if (!near(q, 110) || rnd() > dt * 8) continue;
      vfx.emit({ pos: q, count: 2, color: [0xffa030, 0xffe070], speed: [2, 5], dir: up, spread: 0.7, life: [0.6, 1.2], size: [0.18, 0.35], gravity: 8, radius: 0.8, intensity: 2.4 });
      if (rnd() < 0.3) vfx.smoke({ pos: q, count: 1, color: [0x5a4448, 0x6a5458], speed: [1.5, 2.5], dir: up, spread: 0.3, life: [3, 4.5], size: [1.6, 2.6], sizeEnd: 2.4, gravity: -0.2, drag: 0.3, radius: 0.8 });
    }
    // lava skylight
    for (const q of wild.skylights) {
      if (!near(q, 60) || rnd() > dt * 3) continue;
      vfx.emit({ pos: q, count: 1, color: [0xff7a2a, 0xffc040], speed: [0.8, 2], dir: up, spread: 0.3, life: [1.2, 2.2], size: [0.1, 0.2], gravity: -0.2, radius: 0.5, intensity: 2.2 });
    }
    // Magma Crater: now and then it bubbles and spatters, and smokes continuously
    T.bubble += dt;
    if (T.bubble > 0.7 && near(wild.crater, 140)) {
      T.bubble = rnd() * 0.4;
      p.set(wild.crater.x + (rnd() - 0.5) * 9, wild.crater.y, wild.crater.z + (rnd() - 0.5) * 9);
      vfx.emit({ pos: p, count: 6, color: [0xff6a1a, 0xffb040, 0xffe080], speed: [3, 7], dir: up, spread: 0.5, life: [0.8, 1.6], size: [0.3, 0.6], gravity: 12, radius: 0.6, intensity: 2.4 });
      vfx.smoke({ pos: p.setY(p.y + 1), count: 1, color: [0x4a3438, 0x5a4448], speed: [2.5, 4], dir: wind, spread: 0.2, life: [5, 7], size: [3, 5], sizeEnd: 2.4, gravity: -0.3, drag: 0.3, radius: 2 });
    }
    // ash smoke from the charcoal kiln
    for (const q of works.smoke) {
      if (!near(q, 110) || rnd() > dt * 1.6) continue;
      vfx.smoke({ pos: q, count: 1, color: [0x5a4a4c, 0x6a5a5c, 0x7a6a6a], speed: [0.8, 1.5], dir: wind, spread: 0.2, life: [4, 6], size: [0.8, 1.3], sizeEnd: 2.4, gravity: -0.1, drag: 0.3, radius: 0.15 });
    }
    // thin white smoke from the small fumaroles
    for (const q of ground.wisps) {
      if (!near(q, 55) || rnd() > dt * (low ? 0.6 : 1.3)) continue;
      vfx.smoke({ pos: q, count: 1, color: [0xece4dc, 0xd8d0cc, 0xe8dcc0], speed: [0.5, 1.1], dir: wind, spread: 0.3, life: [1.4, 2.4], size: [0.3, 0.55], sizeEnd: 2.3, gravity: -0.15, drag: 0.6, radius: 0.12 });
    }
    // small sinter cones: they shoot sparks constantly and now and then spit out a blob of lava
    for (const q of ground.spatter) {
      if (!near(q, 70)) continue;
      if (rnd() < dt * (low ? 2 : 4)) vfx.emit({ pos: q, count: 1, color: [0xff7a2a, 0xffc040, 0xff5a1a], speed: [1.5, 3.5], dir: up, spread: 0.4, life: [0.8, 1.5], size: [0.1, 0.2], gravity: 3, drag: 0.2, radius: 0.2, intensity: 2.2 });
      if (rnd() < dt * 0.25) vfx.emit({ pos: q, count: 6, color: [0xff6a1a, 0xffb040, 0xffe080], speed: [3, 6], dir: up, spread: 0.55, life: [0.7, 1.3], size: [0.15, 0.3], gravity: 9, radius: 0.3, intensity: 2.4 });
      if (rnd() < dt * 0.5) vfx.smoke({ pos: q, count: 1, color: [0x4a3a3c, 0x5a4648], speed: [1, 1.8], dir: wind, spread: 0.25, life: [2.5, 3.5], size: [0.6, 1], sizeEnd: 2.4, gravity: -0.15, drag: 0.4, radius: 0.2 });
    }
    // mud pots: a mud bubble pops, flings a few drops of mud and gives off a bit of steam
    for (const q of sites.mud) {
      if (!near(q, 45) || rnd() > dt * 0.9) continue;
      p.set(q.x + (rnd() - 0.5) * 0.8, q.y, q.z + (rnd() - 0.5) * 0.8);
      vfx.emit({ pos: p, count: 3, color: [0x6a625e, 0x7a716a, 0x57504e], speed: [1, 2.2], dir: up, spread: 0.6, life: [0.4, 0.7], size: [0.07, 0.13], gravity: 9, radius: 0.1, intensity: 0.8 });
      if (rnd() < 0.5) vfx.smoke({ pos: p, count: 1, color: [0xe4dcd4, 0xd4ccc6], speed: [0.4, 0.8], dir: wind, spread: 0.3, life: [1.2, 2], size: [0.3, 0.5], sizeEnd: 2.2, gravity: -0.1, drag: 0.6, radius: 0.1 });
    }
    // still-hot lava bombs and stumps: embers drift up here and there
    for (const q of ground.hot) {
      if (!near(q, 45) || rnd() > dt * (low ? 0.3 : 0.6)) continue;
      vfx.emit({ pos: q, count: 1, color: [0xff7a2a, 0xffa040], speed: [0.3, 0.8], dir: up, spread: 0.5, life: [1.5, 3], size: [0.06, 0.12], sizeEnd: 0.4, gravity: -0.2, drag: 0.3, radius: 0.3, intensity: 2 });
    }
    // near the camera, over hot ground (lava shore, cold lava plain, northern plateau) sparks keep rising from the cracks
    T.cinder += dt;
    while (T.cinder > (low ? 0.16 : 0.07)) {
      T.cinder -= low ? 0.16 : 0.07;
      const a = rnd() * Math.PI * 2;
      const d = 4 + rnd() * 26;
      const x = cam.x + Math.cos(a) * d;
      const z = cam.z + Math.sin(a) * d;
      const heat = Math.max(1 - smooth(2, 16, lavaEdgeDist(x, z)), 1 - smooth(14, 28, Math.hypot(x - FIELD[0], z - FIELD[1])), smooth(-35, -60, z) * 0.6);
      if (rnd() > heat) continue;
      const h = ctx.h(x, z);
      if (h < LAVA + 0.2) continue;
      vfx.emit({ pos: p.set(x, h + 0.15, z), count: 1, color: [0xff6a1a, 0xff9a3a, 0xffc060], speed: [0.4, 1.1], dir: wind, spread: 0.5, life: [1.8, 3.2], size: [0.05, 0.1], sizeEnd: 0.3, gravity: -0.35, drag: 0.4, intensity: 2.2 });
    }
    // volcanic ash slowly falling near the camera
    T.ash += dt;
    while (T.ash > 0.12) {
      T.ash -= 0.12;
      // scattered in a ring around the camera (ash that is too close turns into a big smear over the lens)
      const a = rnd() * Math.PI * 2;
      const d = 7 + rnd() * 26;
      p.set(cam.x + Math.cos(a) * d, cam.y - 2 + rnd() * 9, cam.z + Math.sin(a) * d);
      vfx.smoke({ pos: p, count: 1, color: [0x9a8a8c, 0x7a6a6e, 0xb8aaa6], speed: [0.3, 0.6], dir: down, spread: 0.5, life: [5, 8], size: [0.07, 0.12], sizeEnd: 0.7, drag: 0.1 });
    }
  };
}
