// Whispering Forest (nature): a forest of giant trees in morning light, giants with buttress roots and burls, the forest folk's treetop settlement (platforms, huts, spiral stairs, rope bridges, lanterns),
// glowing fungus rings under the caps, light pillars and light spots through the canopy, drifting leaves and spores, mossy stones and ferns, fallen-leaf decals, distant giant-tree silhouettes and morning mist.

import * as THREE from 'three';
import { M, type RegionModule } from '../arenaKit.ts';
import { GlowSet, V, farTree, fern, giantTree, grassTuft, groundDecal, lantern, lightPools, lightShafts, mistShell, mossRock, mushroom, mushroomRing, ropeBridge, shelfFungus, spiralStair, treeHouse, type Pool, type Shaft, type ShroomCols } from './_woods.ts';

const WOOD = { trunk: 0x86593a, bark: 0x6c4830, leaves: [0x5cb24c, 0x4a9c3e, 0x7ccc5e] };
const HOUSE = { deck: 0x9a6a42, post: 0x5a3c26, wall: 0xdcbc8c, roof: 0x7a9e4c };
const SHROOM: ShroomCols = { stem: 0xf2e8d4, caps: [0x46b8a8, 0x5cc8b4, 0xff8fb8, 0xf7c757], glows: [0x9dffd6, 0xffe38f], spots: 0xfff6e8 };
const LIGHT_DIR = V(0.45, 0.85, 0.35);
/** Camera position for each view: small props must not grow at the camera's feet */
const CAMS: [number, number][] = [[-3.4, 12.8], [-0.8, 15.5], [0, 7.2], [-1.5, 11.5], [0, 10], [0, 13.5]];
/** Fungus ring: center and radius (spores drift up from here) */
const RINGS: [number, number, number][] = [[9.5, -6.5, 2.3], [-9.5, -8.5, 2.5], [5, 11.5, 2.0]];
const SHAFTS: Shaft[] = [
  { x: 7, z: -9, w: 2.6, h: 20 },
  { x: -8.5, z: -11.5, w: 2.2, h: 19 },
  { x: 12.5, z: -3, w: 1.6, h: 17 },
  { x: 1.5, z: -15, w: 2.8, h: 21 },
  { x: -13, z: -2.5, w: 1.5, h: 16 },
  { x: 17, z: 5, w: 1.8, h: 17 },
  { x: -12, z: 8, w: 1.4, h: 16 },
];

export const forest: RegionModule = {
  palette: {
    sky: ['#66b4ea', '#bfe2f2', '#f0f2cc'],
    fog: 0xc6e6cc,
    fogNear: 26,
    fogFar: 140,
    ground: ['#7fba60', '#619e47', '#dcf3a2'],
    light: [0.45, 0.85, 0.35],
    ambient: 0xa2bea6,
    rim: 0xfff2c4,
    shadow: 0x4a7a6a,
    motes: [0xd8f07a, 0xffe08a, 0xa8e070],
    moteKind: 'fall',
    moteAtlas: [3, 0.6],
  },
  build({ b, r, ringPos, group, extras, disposers }) {
    const pools: Pool[] = [];
    const glow = new GlowSet(0xffb85a);
    /** Positions for small props that can go all around: avoiding the camera's feet and the space between the camera and the spirits */
    const anywhere = (rMin: number, rMax: number): readonly [number, number] => {
      for (;;) {
        const p = ringPos(rMin, rMax, false);
        if (CAMS.some(([cx, cz]) => Math.hypot(p[0] - cx, p[1] - cz) < 3)) continue;
        if (p[1] > -1 && Math.hypot(p[0], p[1]) < 14) continue;
        return p;
      }
    };

    // ── Main giant trees: three hold up the settlement and the rest form a ring (some behind the camera too, since the title's orbiting camera would catch them)
    const hero = (x: number, z: number, R: number, H: number) =>
      giantTree(b, x, z, { radius: R, height: H, trunk: WOOD.trunk, bark: WOOD.bark, leaves: WOOD.leaves, canopy: 'blob', roots: 6, burls: 4, branches: 3, branchBand: [0.3, 0.6] }, r);
    hero(15, -15, 2.4, 34);
    hero(-3, -23, 2.1, 30);
    hero(-18, -8, 2.3, 32);
    hero(24, -2, 2.0, 28);
    hero(-22, 5, 2.2, 30);
    hero(6, 24, 2.0, 27);
    hero(-14, 17, 2.1, 29);
    hero(20, 14, 2.1, 28);
    // Shelf fungi on the trunks
    const shelves: [number, number, number][] = [[15, -15, 2.4], [-3, -23, 2.1], [-18, -8, 2.3], [24, -2, 2.0], [-22, 5, 2.2]];
    for (const [x, z, R] of shelves) {
      const toCam = Math.atan2(12.8 - z, -3.4 - x);
      for (let i = 0; i < 3; i++) {
        const a = toCam + (i - 1) * 0.7 + (r() - 0.5) * 0.4;
        const y = 1.1 + i * 1.1 + r() * 0.6;
        shelfFungus(b, x, z, R * (1 - (0.5 * y) / 30), a, y, 0.35 + r() * 0.3, i % 2 ? 0xf7c757 : 0x46b8a8, i % 2 ? 0xffe38f : 0x9dffd6);
      }
    }

    // ── The forest folk's treetop settlement: three platforms, two rope bridges, spiral stairs and lanterns
    const camAngle = (x: number, z: number) => Math.atan2(12.8 - z, -3.4 - x);
    treeHouse(b, glow, 15, -15, 5.2, 2.4, camAngle(15, -15), HOUSE);
    spiralStair(b, 15, -15, 2.4, 5.2, camAngle(15, -15) + 2.6, 0.72, HOUSE.deck, HOUSE.post);
    treeHouse(b, glow, -3, -23, 6.4, 2.1, camAngle(-3, -23), HOUSE);
    treeHouse(b, glow, -18, -8, 5.8, 2.3, camAngle(-18, -8) - 0.5, HOUSE);
    spiralStair(b, -18, -8, 2.3, 5.8, camAngle(-18, -8) + 2.2, 0.7, HOUSE.deck, HOUSE.post);
    const edge = (x: number, z: number, R: number, tx: number, tz: number, y: number) => {
      const d = Math.hypot(tx - x, tz - z);
      return V(x + ((tx - x) / d) * (R + 2.15), y + 0.2, z + ((tz - z) / d) * (R + 2.15));
    };
    const hooks = [
      ...ropeBridge(b, edge(15, -15, 2.4, -3, -23, 5.2), edge(-3, -23, 2.1, 15, -15, 6.4), 0.9, HOUSE.deck, HOUSE.post),
      ...ropeBridge(b, edge(-3, -23, 2.1, -18, -8, 6.4), edge(-18, -8, 2.3, -3, -23, 5.8), 1.0, HOUSE.deck, HOUSE.post),
    ];
    for (const h of hooks) lantern(b, glow, h, 0.8, HOUSE.post);
    // Lamp posts on the ground: they light the feet, with light spots on the ground
    const lampPosts: [number, number][] = [[8.6, -3.6], [-7.6, -5.8], [11.5, 3.5], [-9.5, 1.5], [2.5, -12], [-4, 10]];
    for (const [x, z] of lampPosts) {
      const a = camAngle(x, z);
      b.add(new THREE.CylinderGeometry(0.07, 0.1, 2.0, 6), HOUSE.post, M(x, 1.0, z));
      b.add(new THREE.BoxGeometry(0.7, 0.08, 0.08), HOUSE.post, M(x + Math.cos(a) * 0.3, 1.98, z + Math.sin(a) * 0.3, -a));
      lantern(b, glow, V(x + Math.cos(a) * 0.6, 1.96, z + Math.sin(a) * 0.6), 0.8, HOUSE.post);
      pools.push({ x: x + Math.cos(a) * 0.6, z: z + Math.sin(a) * 0.6, r: 1.6, col: 0xffb85a });
    }

    // ── Glowing fungus ring and standalone big mushrooms
    for (const [x, z, rr] of RINGS) mushroomRing(b, x, z, rr, 11 + Math.floor(r() * 3), SHROOM, r, pools, 0x7dffc8);
    const bigs: [number, number, number][] = [[11.5, -12.5, 2.4], [18.5, -11, 1.9], [-14.5, -4.5, 2.2], [0.5, -19.5, 2.6], [20.5, 0.8, 1.8], [-19, 1, 2.0], [-11, 14, 2.1]];
    for (const [x, z, s] of bigs) mushroom(b, x, z, s, SHROOM, r, false);
    for (let i = 0; i < 16; i++) {
      const [x, z] = anywhere(7.5, 22);
      mushroom(b, x, z, 0.5 + r() * 0.8, SHROOM, r, r() < 0.35);
    }

    // ── Mossy stones, ferns, grass tufts
    for (let i = 0; i < 9; i++) {
      const [x, z] = anywhere(8.5, 24);
      mossRock(b, x, z, 0.5 + r() * 0.8, 0x8a9a8a, 0x6cbf58, r);
    }
    mossRock(b, -8, -13.5, 1.3, 0x8a9a8a, 0x6cbf58, r);
    mossRock(b, 13, 8.5, 1.1, 0x8a9a8a, 0x6cbf58, r);
    for (let i = 0; i < 24; i++) {
      const [x, z] = anywhere(7.5, 20);
      fern(b, x, z, 0.8 + r() * 0.7, i % 3 ? 0x4fae4a : 0x6cc85a, r);
    }
    for (let i = 0; i < 48; i++) {
      const [x, z] = anywhere(6.8, 24);
      grassTuft(b, x, z, 0.9 + r() * 0.6, i % 2 ? 0x8fd062 : 0x6fbf54, r);
    }

    // ── Mid-ground trees and distant giant-tree silhouettes (left to the fog)
    for (let i = 0; i < 20; i++) {
      const [x, z] = ringPos(27, 42, false);
      giantTree(b, x, z, { radius: 1.3 + r() * 0.8, height: 18 + r() * 10, trunk: WOOD.trunk, bark: WOOD.bark, leaves: WOOD.leaves, canopy: 'blob', roots: 4, burls: 2, branches: 2 }, r);
    }
    for (let i = 0; i < 44; i++) {
      const [x, z] = ringPos(44, 110, false);
      const d = Math.hypot(x, z);
      farTree(b, x, z, 3 + r() * 3 + d * 0.02, 36 + r() * 30 + d * 0.15, 0x3e5a44, 0x4a8a48, r);
    }

    // ── Light pillars, light spots, morning mist
    lightShafts(group, disposers, extras, SHAFTS, LIGHT_DIR, 0xfff0b8, 0.42);
    for (const s of SHAFTS) pools.push({ x: s.x, z: s.z, r: s.w * 1.1, col: 0xfff0b8 });
    lightPools(group, disposers, pools, 1.2);
    mistShell(group, disposers, extras, 31, -0.5, 7, 0xeaf6e0, 0.32);

    // ── Decals of fallen leaves, clover and small flowers
    groundDecal(group, disposers, 34, 1024, (g, s) => {
      let x = 7;
      const rnd = () => {
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
      };
      const leaf = (px: number, py: number, w: number, h: number, a: number, col: string, alpha: number) => {
        g.save();
        g.translate(px, py);
        g.rotate(a);
        g.globalAlpha = alpha;
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(70,90,40,0.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, -h);
        g.lineTo(0, h);
        g.stroke();
        g.restore();
      };
      const c = s / 2;
      // Moss marks: soft dark-green patches near the tree bases
      for (let i = 0; i < 70; i++) {
        const px = rnd() * s;
        const py = rnd() * s;
        if (Math.hypot(px - c, py - c) < s * 0.22) continue;
        g.globalAlpha = 0.18 + rnd() * 0.12;
        g.fillStyle = '#5c9e44';
        g.beginPath();
        g.ellipse(px, py, 20 + rnd() * 50, 14 + rnd() * 30, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      // Fallen leaves: denser the farther out, with only a few scattered in the battle area
      const cols = ['#a9d65e', '#e0c95c', '#c4874a', '#6faa48', '#f0b25a'];
      for (let i = 0; i < 900; i++) {
        const px = rnd() * s;
        const py = rnd() * s;
        const d = Math.hypot(px - c, py - c) / (s / 2);
        if (rnd() > 0.04 + d * 0.8) continue;
        leaf(px, py, 2 + rnd() * 2, 4 + rnd() * 3.5, rnd() * Math.PI, cols[Math.floor(rnd() * cols.length)], 0.75);
      }
      // Clover and small flowers
      for (let i = 0; i < 160; i++) {
        const px = rnd() * s;
        const py = rnd() * s;
        if (Math.hypot(px - c, py - c) < s * 0.16 && rnd() < 0.7) continue;
        g.globalAlpha = 0.65;
        g.fillStyle = '#5fb04f';
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          g.beginPath();
          g.arc(px + Math.cos(a) * 2.6, py + Math.sin(a) * 2.6, 2.8, 0, Math.PI * 2);
          g.fill();
        }
        if (rnd() < 0.4) {
          g.globalAlpha = 0.9;
          g.fillStyle = rnd() < 0.5 ? '#fff7d0' : '#ffe27a';
          g.beginPath();
          g.arc(px + 6, py - 4, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    });

    // ── Dynamics: lamplight breathing, fungus ring spores, floating dust in the light pillars, leaves spinning down
    const setGlow = glow.build(group, disposers);
    let acc = 0;
    const dir = LIGHT_DIR.clone().normalize();
    extras.push((dt, t, vfx) => {
      setGlow(2.0 + 0.25 * Math.sin(t * 1.7) + 0.12 * Math.sin(t * 4.3));
      acc += dt;
      while (acc > 0.1) {
        acc -= 0.1;
        const ring = RINGS[Math.floor(Math.random() * RINGS.length)];
        const a = Math.random() * Math.PI * 2;
        vfx.emit({ pos: V(ring[0] + Math.cos(a) * ring[2], 0.4, ring[1] + Math.sin(a) * ring[2]), count: 1, color: [0x9dffd6, 0xd8ffe8], speed: [0.15, 0.4], dir: V(0, 1, 0), spread: 0.5, life: [2, 3.5], size: [0.05, 0.1], sizeEnd: 0.3, drag: 0.1, intensity: 1.6 });
        if (Math.random() < 0.7) {
          const s = SHAFTS[Math.floor(Math.random() * SHAFTS.length)];
          const k = 0.5 + Math.random() * 5;
          vfx.emit({ pos: V(s.x + dir.x * k + (Math.random() - 0.5) * s.w * 0.6, 0.3 + dir.y * k, s.z + dir.z * k + (Math.random() - 0.5) * s.w * 0.6), count: 1, color: [0xfff0b8, 0xffffff], speed: [0.05, 0.2], life: [2.5, 4], size: [0.04, 0.08], sizeEnd: 0.5, drag: 0.2, intensity: 1.3 });
        }
        if (Math.random() < 0.45) {
          vfx.emit({ pos: V((Math.random() - 0.5) * 26, 6 + Math.random() * 3, (Math.random() - 0.5) * 20), count: 1, color: [0x8fd25a, 0xd8e070, 0xc98a4a], speed: [0.3, 0.8], dir: V(0.4, -1, 0.2), spread: 0.5, life: [3, 5], size: [0.12, 0.2], sizeEnd: 0.9, gravity: 0.15, drag: 0.4, atlas: 3, spin: 3, intensity: 0.9 });
        }
      }
    });
  },
};
