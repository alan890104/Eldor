// Duskshade Realm (dark): the endless-night forest beneath the continent, umbrella-mushroom-like trees in pale and deep purple, a reflective Endless Night Lake, the stone gate of the ancient kingdom's catacombs, guard-dog statues and stelae,
// purple-cyan glowing fungi and drifting motes, silver spider silk and webs hung between the trees, red eyes in the distant darkness, ground-hugging purple mist, stalactites on the cave roof and moonlight through the cracks.

import * as THREE from 'three';
import { M, PropBatch, rng, type RegionModule } from '../arenaKit.ts';
import { GlowSet, V, catenary, cutGround, fern, giantTree, groundDecal, groundFog, lake, lightPools, lightShafts, mistShell, mossRock, mushroom, mushroomRing, rope, runeStone, shelfFungus, spiderWeb, stalactites, watchingEyes, type LakeLight, type Pool, type Shaft, type ShroomCols } from './_woods.ts';

const PALE = { trunk: 0xb4a8c4, bark: 0x968aac, leaves: [0x33254e, 0x2a1f44] };
const DEEP = { trunk: 0x3d2c5c, bark: 0x30234a, leaves: [0x2c2050, 0x241a40] };
const STONE = 0x66608a;
const STONE_DARK = 0x4a4268;
const SILK = 0xc8d8ff;
const SHROOM: ShroomCols = { stem: 0xd8ccee, caps: [0x5a3aa8, 0x3d4ab4, 0x7a3fb8], glows: [0xc46aff, 0x6ae8ff], spots: 0xe8dcff };
const MOON_DIR = V(0.12, 1, 0.08);
const CAMS: [number, number][] = [[-3.4, 12.8], [-0.8, 15.5], [0, 7.2], [-1.5, 11.5], [0, 10], [0, 13.5]];
/** Endless Night Lake: center (12, −18), irregular shoreline */
const LAKE_C: [number, number] = [12, -18];
const LAKE_R = [11, 12.5, 10, 11.5, 13, 12, 9.5, 11, 12.5, 10.5, 9, 11.5];
const inLake = (x: number, z: number) => Math.hypot(x - LAKE_C[0], z - LAKE_C[1]) < 13.8;
const RINGS: [number, number, number][] = [[-9, -7.5, 2.3], [7, -4, 2.0], [-6, 12, 2.0]];
const SHAFTS: Shaft[] = [
  { x: -6, z: -10, w: 1.6, h: 22 },
  { x: 8, z: -3, w: 1.2, h: 22 },
  { x: -13, z: 2, w: 1.4, h: 20 },
  { x: 3, z: -18, w: 2.2, h: 24 },
  { x: 16, z: 8, w: 1.2, h: 20 },
  { x: -5, z: -24.5, w: 3.2, h: 26 },
];

export const shadow: RegionModule = {
  palette: {
    sky: ['#05040c', '#150f2c', '#3a2058'],
    fog: 0x1e1636,
    fogNear: 16,
    fogFar: 90,
    ground: ['#2e2848', '#1e1834', '#8a6ae0'],
    light: [0.3, 0.85, 0.45],
    ambient: 0x6e5ea0,
    rim: 0xb8a0ff,
    shadow: 0x2a1a4a,
    motes: [0x9a6aff, 0x6ad8ff, 0xc0a0ff],
    moteKind: 'float',
    stars: true,
  },
  build({ b, r, ringPos, group, extras, disposers, ground }) {
    const pools: Pool[] = [];
    const glow = new GlowSet(0x6ae8ff);
    // Reflection in the lake: cut a hole in the ground and put a vertically mirrored copy of the shore objects under it (same seed, so the two copies look identical)
    const mb = new PropBatch();
    const twin = (seed: number, fn: (bb: PropBatch, rr: () => number) => void) => {
      fn(b, rng(seed));
      fn(mb, rng(seed));
    };
    const anywhere = (rMin: number, rMax: number): readonly [number, number] => {
      for (;;) {
        const p = ringPos(rMin, rMax, false);
        if (CAMS.some(([cx, cz]) => Math.hypot(p[0] - cx, p[1] - cz) < 3)) continue;
        if (p[1] > -1 && Math.hypot(p[0], p[1]) < 14) continue;
        if (inLake(p[0], p[1])) continue;
        return p;
      }
    };
    const camAngle = (x: number, z: number) => Math.atan2(12.8 - z, -3.4 - x);

    // ── Umbrella-mushroom-like underground trees: pale and deep purple alternating, with a ring of cold light along the cap edge
    const treeOpts = (R: number, H: number, pale: boolean, big: boolean) => ({ radius: R, height: H, ...(pale ? PALE : DEEP), canopy: 'umbrella' as const, rimGlow: pale ? 0x6ae8ff : 0xc46aff, roots: big ? 5 : 3, burls: big ? 3 : 1, branches: big ? 2 : 1, branchBand: [0.35, 0.6] as [number, number] });
    const tree = (x: number, z: number, R: number, H: number, pale: boolean, big = true) => giantTree(b, x, z, treeOpts(R, H, pale, big), r);
    const shoreTree = (x: number, z: number, R: number, H: number, pale: boolean, seed: number) => twin(seed, (bb, rr) => giantTree(bb, x, z, treeOpts(R, H, pale, true), rr));
    tree(-14, -14, 1.7, 15, true);
    tree(-9, -20, 1.3, 12, false);
    shoreTree(20.5, -6, 1.5, 13, true, 101);
    shoreTree(26.5, -15, 1.4, 12, false, 102);
    tree(-21, 2, 1.9, 16, true);
    tree(-15, 16, 1.5, 13, false);
    tree(7, 23, 1.6, 14, true);
    tree(21, 12, 1.5, 13, false);
    shoreTree(3, -33, 1.6, 15, true, 103);
    shoreTree(14, -34, 1.2, 11, false, 104);
    for (let i = 0; i < 12; i++) {
      const [x, z] = ringPos(24, 40, false);
      if (inLake(x, z)) continue;
      tree(x, z, 1.0 + r() * 0.6, 10 + r() * 6, r() < 0.5, false);
    }
    for (let i = 0; i < 30; i++) {
      const [x, z] = ringPos(42, 100, false);
      const pale = r() < 0.6;
      giantTree(b, x, z, { radius: 1.6 + r() * 1.4, height: 16 + r() * 12, trunk: pale ? 0x5a5074 : 0x2a2040, leaves: [0x2e2450, 0x261e44], canopy: 'umbrella', roots: 0, burls: 0, branches: 0 }, r);
    }
    // Shelf fungi on the trunks
    const shelves: [number, number, number][] = [[-14, -14, 1.7], [20.5, -6, 1.5], [-21, 2, 1.9], [-9, -20, 1.3]];
    for (const [x, z, R] of shelves) {
      const toCam = camAngle(x, z);
      for (let i = 0; i < 3; i++) {
        const y = 0.9 + i * 1.0 + r() * 0.5;
        shelfFungus(b, x, z, R * (1 - (0.5 * y) / 14), toCam + (i - 1) * 0.6 + (r() - 0.5) * 0.4, y, 0.3 + r() * 0.25, i % 2 ? 0x5a3aa8 : 0x3d4ab4, i % 2 ? 0xc46aff : 0x6ae8ff);
      }
    }

    // ── Endless Night Lake: shore edge, water surface, stepping stones in the lake and reeds on the shore
    const outline = LAKE_R.map((rad, i): [number, number] => {
      const a = (i / LAKE_R.length) * Math.PI * 2;
      return [LAKE_C[0] + Math.cos(a) * rad, LAKE_C[1] + Math.sin(a) * rad];
    });
    cutGround(ground, outline);
    const shore = new THREE.Shape();
    const inner = new THREE.Path();
    outline.forEach(([x, z], i) => {
      const sx = LAKE_C[0] + (x - LAKE_C[0]) * 1.07;
      const sz = LAKE_C[1] + (z - LAKE_C[1]) * 1.07;
      const ix = LAKE_C[0] + (x - LAKE_C[0]) * 0.985;
      const iz = LAKE_C[1] + (z - LAKE_C[1]) * 0.985;
      if (i === 0) {
        shore.moveTo(sx, -sz);
        inner.moveTo(ix, -iz);
      } else {
        shore.lineTo(sx, -sz);
        inner.lineTo(ix, -iz);
      }
    });
    shore.closePath();
    inner.closePath();
    shore.holes.push(inner);
    b.add(new THREE.ShapeGeometry(shore, 1), 0x1c1830, M(0, 0.018, 0, 0, 1, -Math.PI / 2), false);
    const lakeLights: LakeLight[] = [
      { x: 2.5, z: -26, r: 4.5, col: 0x2a7a9a },
      { x: 16, z: -7.5, r: 3, col: 0x6a44c0 },
      { x: 3.5, z: -18.5, r: 3.5, col: 0x5a70c0 },
      { x: 23, z: -15.5, r: 3, col: 0x3aa8c0 },
      { x: 19.5, z: -28, r: 2.5, col: 0x7a50d0 },
    ];
    lake(group, disposers, extras, outline, 0x0c0a22, 0x2e2460, 0x8ab8ff, lakeLights);
    for (const [x, z, s] of [[5.5, -11, 0.7], [7.2, -13.6, 0.55], [9.5, -15.5, 0.6]] as [number, number, number][]) {
      const g = new THREE.DodecahedronGeometry(s, 0);
      g.scale(1, 0.32, 1);
      b.add(g, STONE, M(x, 0.05, z, r() * 6));
    }
    outline.forEach(([x, z], i) => {
      if (i < 3 || i > 8) return;
      const rx = LAKE_C[0] + (x - LAKE_C[0]) * 1.04;
      const rz = LAKE_C[1] + (z - LAKE_C[1]) * 1.04;
      for (let k = 0; k < 5; k++) {
        const h = 0.8 + r() * 0.9;
        b.add(new THREE.CylinderGeometry(0.02, 0.05, h, 3), 0x5a4a80, M(rx + (r() - 0.5) * 1.6, h / 2, rz + (r() - 0.5) * 1.6, 0, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3), false);
      }
    });

    // ── The ancient kingdom's catacombs: stone gate, double doors, stairs, broken walls and two guard-dog statues
    const gz = -26;
    twin(201, (bb) => {
      for (const sx of [-3.2, 3.2]) {
        bb.add(new THREE.BoxGeometry(1.4, 8.2, 1.4), STONE, M(-5 + sx, 4.1, gz));
        bb.add(new THREE.BoxGeometry(1.9, 0.5, 1.9), STONE_DARK, M(-5 + sx, 8.4, gz));
        bb.add(new THREE.BoxGeometry(1.9, 0.4, 1.9), STONE_DARK, M(-5 + sx, 0.9, gz));
        // Braziers on top of the pillars: cold blue netherfire
        bb.add(new THREE.CylinderGeometry(0.55, 0.35, 0.5, 8), STONE_DARK, M(-5 + sx, 8.9, gz));
        bb.glow(new THREE.SphereGeometry(0.42, 8, 6), 0x5ad8ff, M(-5 + sx, 9.35, gz));
      }
      bb.add(new THREE.BoxGeometry(9.6, 1.3, 1.7), STONE, M(-5, 9.2, gz));
      const gable = new THREE.ConeGeometry(5.2, 2.2, 4);
      gable.scale(1, 1, 0.32);
      bb.add(gable, STONE_DARK, M(-5, 10.9, gz, Math.PI / 4));
      bb.glow(new THREE.TorusGeometry(0.7, 0.08, 6, 20), 0x8a6aff, M(-5, 10.3, gz + 0.35));
      for (const sx of [-1.35, 1.35]) {
        bb.add(new THREE.BoxGeometry(2.6, 6.8, 0.4), 0x1e1830, M(-5 + sx, 4.5, gz + 0.5));
        for (let i = 0; i < 3; i++) bb.glow(new THREE.BoxGeometry(0.5, 0.07, 0.06), 0x6ae8ff, M(-5 + sx, 3 + i * 1.3, gz + 0.72));
      }
      bb.glow(new THREE.BoxGeometry(0.12, 6.6, 0.12), 0x6ae8ff, M(-5, 4.5, gz + 0.72));
      for (let i = 0; i < 4; i++) bb.add(new THREE.BoxGeometry(9.6 - i * 0.6, 0.3, 1.0), STONE_DARK, M(-5, 1.05 - i * 0.3, gz + 1.6 + i * 1.0));
      for (const sx of [-1, 1]) {
        bb.add(new THREE.BoxGeometry(5.5, 2.6, 1.2), STONE_DARK, M(-5 + sx * 7.6, 1.3, gz - 0.3, 0, 1, 0, sx * 0.04));
        bb.add(new THREE.BoxGeometry(2.4, 1.4, 1.2), STONE, M(-5 + sx * 11.2, 0.7, gz - 0.3, sx * 0.15));
      }
    });
    const hound = (x: number, z: number, f: number) => {
      const at = (dx: number, dy: number, dz: number) => V(x + Math.cos(f) * dx - Math.sin(f) * dz, dy, z + Math.sin(f) * dx + Math.cos(f) * dz);
      const put = (g: THREE.BufferGeometry, col: number, dx: number, dy: number, dz: number) => {
        const p = at(dx, dy, dz);
        b.add(g, col, M(p.x, p.y, p.z, -f));
        mb.add(g.clone(), col, M(p.x, p.y, p.z, -f));
      };
      put(new THREE.BoxGeometry(2.3, 0.4, 1.5), STONE_DARK, 0, 0.2, 0);
      put(new THREE.BoxGeometry(1.6, 1.0, 0.95), STONE, -0.15, 0.9, 0);
      put(new THREE.BoxGeometry(0.95, 1.4, 0.85), STONE, 0.45, 1.2, 0);
      put(new THREE.SphereGeometry(0.45, 8, 6), STONE, 0.72, 2.1, 0);
      put(new THREE.BoxGeometry(0.5, 0.3, 0.36), STONE, 1.05, 1.98, 0);
      put(new THREE.ConeGeometry(0.13, 0.4, 4), STONE, 0.55, 2.55, 0.22);
      put(new THREE.ConeGeometry(0.13, 0.4, 4), STONE, 0.55, 2.55, -0.22);
      put(new THREE.BoxGeometry(0.32, 0.9, 0.32), STONE, 0.8, 0.85, 0.32);
      put(new THREE.BoxGeometry(0.32, 0.9, 0.32), STONE, 0.8, 0.85, -0.32);
      for (const s of [-0.15, 0.15]) {
        const e = at(1.08, 2.18, s);
        glow.add(new THREE.SphereGeometry(0.06, 6, 4), M(e.x, e.y, e.z));
      }
    };
    hound(-10.2, gz + 3.4, Math.PI / 2);
    hound(0.2, gz + 3.4, Math.PI / 2);
    pools.push({ x: -5, z: gz + 2.5, r: 4, col: 0x2a7a9a });

    // ── Stelae: a road from the battle area to the catacombs, with a few on the far shore reflected in the lake
    const stones: [number, number, number][] = [[-7, -11, 2.4], [-2.5, -16, 3.0], [-9.5, -19.5, 2.6], [-12, -14, 2.2], [-15, -21, 4.8], [-1, -31.5, 5.5], [22, -31, 4.2], [28, -8, 3.6], [-25, -6, 4.0], [-19, 9, 2.8], [13, 14, 2.6], [-8, 20, 3.2]];
    stones.forEach(([x, z, h], i) => {
      if (Math.hypot(x - LAKE_C[0], z - LAKE_C[1]) < 22) twin(300 + i, (bb, rr) => runeStone(bb, x, z, h, STONE, 0xa06aff, camAngle(x, z), rr));
      else runeStone(b, x, z, h, STONE, 0xa06aff, camAngle(x, z), r);
      pools.push({ x, z, r: 1.5, col: 0x5a3aa0 });
    });

    // ── Glowing fungi: fungus rings, big mushrooms and scattered small mushrooms
    for (const [x, z, rr] of RINGS) mushroomRing(b, x, z, rr, 11 + Math.floor(r() * 3), SHROOM, r, pools, 0x7a4ad8);
    const bigs: [number, number, number][] = [[-12, -11, 2.2], [17.5, -3.5, 2.4], [-18, -1, 2.0], [-1.5, -21, 2.0], [24, -4, 1.8], [-16, 12, 2.1], [10, 19, 2.0]];
    bigs.forEach(([x, z, s], i) => {
      if (Math.hypot(x - LAKE_C[0], z - LAKE_C[1]) < 18) twin(400 + i, (bb, rr) => mushroom(bb, x, z, s, SHROOM, rr, false));
      else mushroom(b, x, z, s, SHROOM, r, false);
    });
    for (let i = 0; i < 18; i++) {
      const [x, z] = anywhere(7.5, 22);
      mushroom(b, x, z, 0.5 + r() * 0.8, SHROOM, r, r() < 0.35);
    }
    for (let i = 0; i < 14; i++) {
      const [x, z] = anywhere(7.5, 20);
      fern(b, x, z, 0.7 + r() * 0.6, i % 2 ? 0x3a4a6a : 0x4a3a7a, r);
    }
    for (let i = 0; i < 8; i++) {
      const [x, z] = anywhere(8.5, 24);
      mossRock(b, x, z, 0.5 + r() * 0.8, 0x4a4462, 0x3f5a8a, r);
    }

    // ── `weaverspider`'s webs and the silk between the trees (dewdrops hang on the silk)
    spiderWeb(b, V(-11.5, 4.6, -17), V(0.26, 0, 0.97), 2.4, SILK, r);
    spiderWeb(b, V(23.5, 5.2, -10.5), V(-0.6, 0.1, 0.8), 1.7, SILK, r);
    const strands: [THREE.Vector3, THREE.Vector3, number][] = [
      [V(-14, 6.5, -14), V(-9, 5.8, -20), 0.6],
      [V(20.5, 7, -6), V(26.5, 6, -15), 0.8],
      [V(-21, 8, 2), V(-14, 7, -14), 1.5],
      [V(-15, 6, 16), V(-21, 7.5, 2), 1.2],
      [V(7, 7, 23), V(21, 6.5, 12), 1.4],
      [V(-9, 5, -20), V(3, 7, -33), 1.3],
    ];
    for (const [p0, p1, sag] of strands) {
      rope(b, p0, p1, sag, 0.014, SILK, true, 12);
      for (const p of catenary(p0, p1, sag, 5).slice(1, 5)) b.glow(new THREE.SphereGeometry(0.06, 5, 4), 0xdfe8ff, M(p.x, p.y - 0.05, p.z));
    }

    // ── Cave roof: stalactites, floor-to-ceiling stone pillars, cracks that let moonlight through
    for (let i = 0; i < 16; i++) {
      const [x, z] = ringPos(6, 30, false);
      stalactites(b, x, z, 17 + r() * 7, 0.8 + r() * 0.9, STONE_DARK, r);
    }
    for (let i = 0; i < 6; i++) {
      const [x, z] = anywhere(23, 33);
      const R = 0.8 + r() * 0.6;
      b.add(new THREE.CylinderGeometry(R * 0.5, R, 26, 8), STONE_DARK, M(x, 13, z));
      b.add(new THREE.ConeGeometry(R * 2.2, R * 4, 8), STONE_DARK, M(x, R * 2 - 0.1, z));
      stalactites(b, x, z, 26, R * 1.6, STONE_DARK, r);
    }
    for (const s of SHAFTS) {
      const top = V(s.x, 0.3, s.z).addScaledVector(MOON_DIR.clone().normalize(), s.h);
      b.glow(new THREE.BoxGeometry(s.w * 3, 0.12, 0.3), 0x9ab8ff, M(top.x, top.y + 0.2, top.z, r() * 3));
      pools.push({ x: s.x, z: s.z, r: s.w * 1.4, col: 0x8aa0ff });
    }
    lightShafts(group, disposers, extras, SHAFTS, MOON_DIR, 0xb8c8ff, 0.3);
    // A faint ring of purple mist in the distance: it separates the mid-ground trees from the darkness deep in the cave
    mistShell(group, disposers, extras, 38, -0.5, 6, 0x5a4a90, 0.3, 0.6);

    // ── Distant: boulder silhouettes of the cave wall and eyes in the darkness
    for (let i = 0; i < 14; i++) {
      const [x, z] = ringPos(55, 95, false);
      const h = 14 + r() * 18;
      b.add(new THREE.BoxGeometry(10 + r() * 10, h, 4 + r() * 5), 0x221a38, M(x, h / 2 - 1, z, r() * 6, 1, 0, (r() - 0.5) * 0.2), false);
    }
    watchingEyes(group, disposers, extras, [
      { x: -27, y: 1.2, z: -17, gap: 0.4 },
      { x: 31, y: 0.9, z: -27, gap: 0.36 },
      { x: -35, y: 1.5, z: 5, gap: 0.42 },
      { x: 17, y: 1.1, z: -37, gap: 0.34 },
      { x: -12, y: 0.8, z: -40, gap: 0.36 },
      { x: 37, y: 1.4, z: 3, gap: 0.42 },
      { x: -30, y: 1.0, z: 22, gap: 0.38 },
      { x: 14, y: 1.2, z: 34, gap: 0.38 },
    ], 0xff2a3a);

    // ── Light spots, purple mist, aether-vein decals on the ground
    lightPools(group, disposers, pools, 1.1);
    const mirror = new THREE.Group();
    mirror.scale.y = -1;
    mb.build(mirror);
    group.add(mirror);
    groundFog(group, disposers, extras, 34, 0.35, 6, 0x7a48c0, 0.62, 0, [LAKE_C[0], LAKE_C[1], 12.5]);
    groundFog(group, disposers, extras, 34, 0.95, 7.5, 0x5a34a0, 0.32, 3.1, [LAKE_C[0], LAKE_C[1], 13.5]);
    groundDecal(group, disposers, 34, 1024, (g, s) => {
      let x = 11;
      const rnd = () => {
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
      };
      const c = s / 2;
      g.lineCap = 'round';
      for (let i = 0; i < 40; i++) {
        let px = rnd() * s;
        let py = rnd() * s;
        if (Math.hypot(px - c, py - c) < s * 0.3) continue;
        g.strokeStyle = rnd() < 0.5 ? 'rgba(120,80,220,0.32)' : 'rgba(80,200,255,0.24)';
        g.lineWidth = 1 + rnd() * 1.2;
        g.beginPath();
        g.moveTo(px, py);
        let a = rnd() * Math.PI * 2;
        for (let k = 0; k < 6; k++) {
          a += (rnd() - 0.5) * 1.4;
          px += Math.cos(a) * (12 + rnd() * 18);
          py += Math.sin(a) * (12 + rnd() * 18);
          g.lineTo(px, py);
        }
        g.stroke();
      }
      for (let i = 0; i < 260; i++) {
        const px = rnd() * s;
        const py = rnd() * s;
        if (Math.hypot(px - c, py - c) < s * 0.25) continue;
        g.fillStyle = rnd() < 0.6 ? 'rgba(140,100,255,0.7)' : 'rgba(110,230,255,0.7)';
        g.beginPath();
        g.arc(px, py, 1.5 + rnd() * 2.5, 0, Math.PI * 2);
        g.fill();
      }
    }, true, 0.016);

    // ── Dynamics: cold-light breathing of the catacomb gate and statue eyes, spirit light rising from the lake, fungus ring spores, drifting fireflies
    const setGlow = glow.build(group, disposers);
    let acc = 0;
    extras.push((dt, t, vfx) => {
      setGlow(1.9 + 0.35 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 3.7));
      acc += dt;
      while (acc > 0.11) {
        acc -= 0.11;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 9;
        vfx.emit({ pos: V(LAKE_C[0] + Math.cos(a) * d, 0.1, LAKE_C[1] + Math.sin(a) * d), count: 1, color: [0x6ae8ff, 0x9ab8ff], speed: [0.1, 0.3], dir: V(0, 1, 0), spread: 0.3, life: [3, 5], size: [0.06, 0.14], sizeEnd: 0.2, drag: 0.1, intensity: 1.5 });
        if (Math.random() < 0.7) {
          const ring = RINGS[Math.floor(Math.random() * RINGS.length)];
          const ra = Math.random() * Math.PI * 2;
          vfx.emit({ pos: V(ring[0] + Math.cos(ra) * ring[2], 0.4, ring[1] + Math.sin(ra) * ring[2]), count: 1, color: [0xc46aff, 0xe0c0ff], speed: [0.1, 0.35], dir: V(0, 1, 0), spread: 0.6, life: [2, 3.5], size: [0.05, 0.1], sizeEnd: 0.3, drag: 0.1, intensity: 1.6 });
        }
        if (Math.random() < 0.35) {
          vfx.emit({ pos: V((Math.random() - 0.5) * 30, 0.8 + Math.random() * 4, (Math.random() - 0.5) * 24), count: 1, color: [0x9a6aff, 0x6ae8ff], speed: [0.2, 0.5], life: [3, 5], size: [0.05, 0.1], sizeEnd: 0.4, drag: 0.3, intensity: 1.8 });
        }
      }
    });
  },
};
