// Islands of the world map (part 2): Stoneheart Canyon, Thunderplain, Dawnlight Holy City, Duskshade Realm, Void Rift. The design notes are in the header of worldmap/index.ts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cloudGeo, M, Outline, smooth, type BodySpec } from './kit.ts';
import { along, gableGeo, house, lookMaterial, placeTower, rock, tree, type RegionDef } from './props.ts';
import { inkScenery } from '../ink.ts';

import { lineDist, platform, pool, ribbon, spot } from './isles1.ts';

const tmp = new THREE.Color();
const mixTo = (out: THREE.Color, h: number, t: number) => out.lerp(tmp.set(h), Math.min(1, Math.max(0, t)));
const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x - cx, z - cz);
const wob = (x: number, z: number, s = 0) => Math.sin(x * 2.3 + s) * Math.cos(z * 1.9 - s * 0.6) * 0.6 + Math.sin(x * 5.1 - z * 4.3 + s * 2) * 0.4;

// ───────────────────────── Stoneheart Canyon ─────────────────────────

const RED = [0xb05c3c, 0xcf8f5c, 0xe2b07a, 0x9c4a34, 0xd89a64];
const canyonOutline = new Outline(2.5, [[2, 0.09, 0.2], [4, 0.05, 1.3], [3, 0.05, 2.5]]);
const K_TURTLE: [number, number] = [0.02, 0.85];
const K_TOWER: [number, number] = [0.15, -1.55];
const K_PIT: [number, number] = [0.72, -1.3];
const K_GORGE: [number, number][] = [[0.05, 2.4], [0.1, 1.9], [-0.2, 0.2], [0.05, -0.6], [0.15, -1.3]];

export const CANYON: RegionDef = {
  look: { ambient: 0xc99a7c, shadow: 0x8c4d4a, rim: 0xffd6a0 },
  body: {
    outline: canyonOutline,
    h: (x, z) => 0.03 * wob(x, z, 3),
    paint: (x, z, _y, out) => {
      out.set(0xecd2a2);
      mixTo(out, 0xe2bc8a, 0.5 + 0.5 * wob(x, z, 1));
      mixTo(out, 0xd8a070, smooth(0.4, 1, wob(x * 0.8, z * 0.8, 6)) * 0.5);
      mixTo(out, 0xf4e0b8, smooth(0.1, 0.05, lineDist(x, z, K_GORGE)));
    },
    strata: [0xb05c3c, 0xcf8f5c, 0x9c4a34, 0xd89a64, 0x8c4d3a],
    depth: 3.1,
    band: 0.22,
    seed: 7,
  },
  build(ctx) {
    const { b, r } = ctx;
    // Red rock plateaus: layers of sandstone on both sides of the canyon passage, with a wind-eroded stone arch at the north end of the east plateau
    const mesaTop = (x: number, z: number) => (wob(x, z, 4) > 0.35 ? 0xa89060 : 0xc87a50);
    platform(ctx, -1.3, -0.5, new Outline(0.85, [[2, 0.15, 0.5], [3, 0.08, 1]]), 0.62, mesaTop, RED, { seed: 3, band: 0.11 });
    platform(ctx, 1.35, -0.35, new Outline(0.78, [[2, 0.12, 2], [3, 0.1, 0.3]]), 0.5, mesaTop, RED, { seed: 4, band: 0.11 });
    platform(ctx, -0.62, -1.62, new Outline(0.3, [[3, 0.1, 1]]), 0.9, 0xd89a64, RED, { seed: 5, band: 0.11 });
    platform(ctx, 1.62, 0.75, new Outline(0.22, [[3, 0.12, 2]]), 0.55, 0xd89a64, RED, { seed: 6, band: 0.1 });
    b.add(new THREE.TorusGeometry(0.2, 0.065, 6, 12, Math.PI), 0xcf8f5c, M(1.05, ctx.y(1.05, -1.05) - 0.02, -1.05, 0.7));
    // The Seal Tower and the deep pit dug by the cult
    placeTower(ctx, ...K_TOWER, { stone: 0xdcae7e, stoneDark: 0x8e5c46, trim: 0xe8c060, roof: 0x3f8a78, glow: 0xffb040, kind: 'spire' }, 0.62);
    {
      const py = ctx.y(K_PIT[0], K_PIT[1]);
      b.add(pool(new Outline(0.24, [[3, 0.1, 0.5]])), 0x3a2418, M(K_PIT[0], py + 0.012, K_PIT[1]), false);
      b.add(new THREE.TorusGeometry(0.25, 0.035, 5, 18), 0xb07850, M(K_PIT[0], py + 0.01, K_PIT[1], 0, 1, Math.PI / 2));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        b.add(new THREE.BoxGeometry(0.03, 0.14, 0.03), 0x6a4a36, M(K_PIT[0] + Math.cos(a) * 0.34, py + 0.07, K_PIT[1] + Math.sin(a) * 0.3), false);
      }
    }
    // The sleeping giant tortoise: the dwarves' tortoise-back royal city sits on its shell, its head rests on the canyon floor, and amber light shows through the slits of its closed eyes
    const [TX, TZ] = K_TURTLE;
    const gy = ctx.y(TX, TZ);
    const SR = 0.7;
    const SY = gy + 0.13;
    const SH = 0.6;
    const SZ = 1.12;
    b.heavy = true;
    const shell = new THREE.SphereGeometry(SR, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    shell.scale(1, SH / SR, SZ);
    b.add(shell, 0x8a7a58, M(TX, SY, TZ));
    const rim = new THREE.TorusGeometry(SR, 0.055, 6, 28);
    rim.scale(1, SZ, 1);
    b.add(rim, 0x6a5a42, M(TX, SY + 0.01, TZ, 0, 1, Math.PI / 2));
    // Shell plates (laid along the shell surface)
    const shellY = (x: number, z: number) => SY + SH * Math.sqrt(Math.max(0, 1 - (x * x) / (SR * SR) - (z * z) / (SR * SR * SZ * SZ)));
    for (const [px, pz] of [[-0.42, -0.3], [0.42, -0.25], [-0.45, 0.28], [0.45, 0.3], [0, -0.55]] as [number, number][]) {
      const y = shellY(px, pz);
      const n = new THREE.Vector3(px / (SR * SR), (y - SY) / (SH * SH), pz / (SR * SR * SZ * SZ)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      b.add(new THREE.CylinderGeometry(0.13, 0.14, 0.035, 6), 0x9c8a62, new THREE.Matrix4().compose(new THREE.Vector3(TX + px, y, TZ + pz), q, new THREE.Vector3(1, 1, 1)));
    }
    // Head, neck, front and back feet
    const head = new THREE.SphereGeometry(0.16, 12, 8);
    head.scale(1, 0.72, 1.3);
    b.add(head, 0x8c8a6a, M(TX, gy + 0.1, TZ + SR * SZ + 0.32));
    b.add(new THREE.CylinderGeometry(0.1, 0.13, 0.36, 10), 0x7e7c5e, along(new THREE.Vector3(TX, gy + 0.18, TZ + SR * SZ - 0.08), new THREE.Vector3(TX, gy + 0.12, TZ + SR * SZ + 0.24)));
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) b.add(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 8), 0x7e7c5e, M(TX + sx * 0.52, gy + 0.08, TZ + sz * 0.5));
    b.heavy = false;
    for (const s of [-1, 1]) b.glow(new THREE.BoxGeometry(0.05, 0.012, 0.012), 0xffb040, M(TX + s * 0.09, gy + 0.15, TZ + SR * SZ + 0.44, s * 0.4));
    ctx.foot(TX + 0.05, TZ + 0.1, 1.0, 0.4);
    // Tortoise-back royal city: sandstone houses with slanted sides, verdigris domes, the royal tower in the center
    const city: [number, number, number, number][] = [[-0.22, 0.05, 0.13, 0.1], [0.22, 0.02, 0.12, 0.11], [-0.05, 0.28, 0.12, 0.09], [0.12, -0.26, 0.13, 0.1], [-0.25, -0.22, 0.11, 0.09], [0.3, 0.3, 0.1, 0.08]];
    city.forEach(([px, pz, w, h], i) => {
      const y = shellY(px, pz) - 0.03;
      b.add(new THREE.CylinderGeometry(w * 0.62, w * 0.72, h, 4), i % 2 ? 0xdcae7e : 0xe6c08a, M(TX + px, y + h / 2, TZ + pz, Math.PI / 4));
      if (i % 3 === 0) b.add(new THREE.SphereGeometry(w * 0.45, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0x3f8a78, M(TX + px, y + h, TZ + pz));
      else b.add(new THREE.ConeGeometry(w * 0.7, h * 0.5, 4), 0x9a6a4a, M(TX + px, y + h + h * 0.25, TZ + pz, Math.PI / 4));
    });
    {
      const y = shellY(0, 0) - 0.03;
      b.add(new THREE.CylinderGeometry(0.06, 0.075, 0.34, 8), 0xdcae7e, M(TX, y + 0.17, TZ));
      b.add(new THREE.SphereGeometry(0.075, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0x3f8a78, M(TX, y + 0.34, TZ));
      b.glow(new THREE.SphereGeometry(0.03, 6, 4), 0xffc060, M(TX, y + 0.23, TZ + 0.065));
    }
    // Stone pillars and shrubs in the basin
    for (let i = 0; i < 9; i++) {
      const p = spot(ctx, 0.2, (x, z) => dist(x, z, TX, TZ + 0.2) > 1.05 && lineDist(x, z, K_GORGE) > 0.2 && dist(x, z, ...K_TOWER) > 0.4 && dist(x, z, ...K_PIT) > 0.4);
      if (!p) continue;
      if (i % 3 === 0) {
        const h = 0.18 + r() * 0.14;
        b.add(new THREE.CylinderGeometry(0.045, 0.06, h, 6), 0xcf8f5c, M(p[0], ctx.y(p[0], p[1]) + h / 2, p[1], r()));
        b.add(new THREE.CylinderGeometry(0.07, 0.05, 0.05, 6), 0xb05c3c, M(p[0], ctx.y(p[0], p[1]) + h + 0.02, p[1], r()));
        ctx.foot(p[0], p[1], 0.14, 0.3);
      } else if (i % 3 === 1) rock(ctx, p[0], p[1], 0.8, 0xb05c3c);
      else {
        b.add(new THREE.IcosahedronGeometry(0.06, 0), 0x8a9a6a, M(p[0], ctx.y(p[0], p[1]) + 0.04, p[1]));
        ctx.foot(p[0], p[1], 0.1, 0.2);
      }
    }
  },
};

// ───────────────────────── Thunderplain ─────────────────────────

const plainsOutline = new Outline(2.55, [[2, 0.08, 1.5], [3, 0.06, 0.4], [5, 0.03, 2.2]]);
const P_TERRACE: [number, number] = [1.5, 0.3];
const P_CAMP: [number, number] = [-1.25, 0.95];
const P_BONES: [number, number] = [-0.3, 0.42];
const P_ROAD: [number, number][] = [[-1.05, 0.8], [-0.55, 0.55], [0.0, 0.35], [0.55, 0.3], [1.05, 0.32]];
const P_CREEK: [number, number][] = [[-2.3, -0.7], [-1.4, -0.9], [-0.7, -0.75], [-0.1, 0.2], [0.35, 0.7], [0.5, 1.4], [0.3, 2.3]];

export const PLAINS: RegionDef = {
  look: { ambient: 0x9ea0c6, shadow: 0x343a70, rim: 0xffc8a0 },
  body: {
    outline: plainsOutline,
    h: (x, z) => 0.08 * Math.sin(x * 1.2 + z * 0.7) + 0.04 * wob(x, z, 5),
    paint: (x, z, _y, out) => {
      const n1 = Math.sin(x * 0.9 + Math.sin(z * 1.2) * 1.5) * Math.cos(z * 0.8 + Math.sin(x * 1.1));
      const n2 = Math.sin(x * 1.7 + z * 1.1) * Math.cos(x * 0.8 - z * 1.6);
      out.set(0xc6a547);
      mixTo(out, 0x6f9140, smooth(-0.2, 0.4, n1));
      mixTo(out, 0x7f9a6a, smooth(0.3, 0.8, n2) * 0.7);
      mixTo(out, 0xb86e3e, smooth(0.6, 0.9, -n2) * 0.6);
      mixTo(out, 0xcdb87a, smooth(0.5, 0.9, wob(x * 2, z * 2, 1)) * 0.4);
      // Dark patterns in the grass waves
      mixTo(out, 0x5a6a38, smooth(0.8, 0.95, Math.sin(x * 4 - z * 2.5 + Math.sin(z * 3) * 0.6)) * 0.25);
      mixTo(out, 0x7a6650, smooth(0.08, 0.04, lineDist(x, z, P_ROAD)));
      const dc = lineDist(x, z, P_CREEK);
      mixTo(out, 0x4a5a44, smooth(0.12, 0.07, dc));
      mixTo(out, 0x6a88a8, smooth(0.06, 0.035, dc));
    },
    strata: [0x6a6478, 0x7a7266, 0x5a5468, 0x8a7a5c],
    depth: 2.9,
    seed: 8,
  },
  build(ctx) {
    const { b, r, g } = ctx;
    // Thunder Terrace: a stone plateau, an approach of giant pillars, the Seal Tower
    platform(ctx, ...P_TERRACE, new Outline(0.62, [[4, 0.06, 0.4], [3, 0.05, 1.1]]), 0.34, 0x77727e, [0x6a6478, 0x5a5468, 0x77727e], { seed: 9, band: 0.1 });
    placeTower(ctx, P_TERRACE[0] + 0.04, P_TERRACE[1] - 0.06, { stone: 0x7a7ea0, stoneDark: 0x44486a, trim: 0xc98f4a, roof: 0x2f3c82, glow: 0xffe25a, kind: 'spire' }, 0.66);
    for (let i = 0; i < 3; i++) {
      const [ax, az] = P_ROAD[2 + (i > 1 ? 1 : 0)];
      const [bx, bz] = P_ROAD[3 + (i > 1 ? 1 : 0)];
      const t = (i % 2) * 0.5 + 0.25;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const nx = -(bz - az);
      const nz = bx - ax;
      const l = Math.hypot(nx, nz);
      for (const s of [-1, 1]) {
        const px = x + (nx / l) * 0.16 * s;
        const pz = z + (nz / l) * 0.16 * s;
        const y = ctx.y(px, pz);
        b.add(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 6), 0x6a6478, M(px, y + 0.18, pz));
        b.add(new THREE.BoxGeometry(0.1, 0.035, 0.1), 0x77727e, M(px, y + 0.37, pz));
        ctx.foot(px, pz, 0.12, 0.3);
      }
    }
    // Skeleton of the ancient thunder beast: the spine and a series of ribs, with the road passing through the middle of the rib cage
    {
      const [BX, BZ] = P_BONES;
      const dir = Math.atan2(P_ROAD[2][1] - P_ROAD[1][1], P_ROAD[2][0] - P_ROAD[1][0]);
      const ux = Math.cos(dir);
      const uz = Math.sin(dir);
      for (let k = 0; k < 5; k++) {
        const t = (k - 2) * 0.13;
        const x = BX + ux * t;
        const z = BZ + uz * t;
        const rr = 0.2 - Math.abs(k - 1.5) * 0.02;
        const rib = new THREE.TorusGeometry(rr, 0.028, 5, 10, Math.PI);
        b.add(rib, 0xe8e0c8, M(x, ctx.y(x, z) - 0.02, z, -dir + Math.PI / 2));
      }
      for (let k = 0; k < 9; k++) {
        const t = (k - 4) * 0.08;
        const x = BX + ux * t;
        const z = BZ + uz * t;
        b.add(new THREE.BoxGeometry(0.05, 0.04, 0.04), 0xd8d0b8, M(x, ctx.y(x, z) + 0.02, z, -dir), false);
      }
      const sx = BX - ux * 0.42;
      const sz = BZ - uz * 0.42;
      const sy = ctx.y(sx, sz);
      b.add(new THREE.BoxGeometry(0.2, 0.09, 0.12), 0xe8e0c8, M(sx, sy + 0.05, sz, -dir));
      for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.025, 0.16, 5), 0xd8d0b8, along(new THREE.Vector3(sx - ux * 0.02 - uz * s * 0.05, sy + 0.08, sz - uz * 0.02 + ux * s * 0.05), new THREE.Vector3(sx + ux * 0.05 - uz * s * 0.12, sy + 0.22, sz + uz * 0.05 + ux * s * 0.12)));
      ctx.foot(BX, BZ, 0.45, 0.2);
    }
    // Nomad camp: three round tents, a campfire, a flagpole
    const [CX, CZ] = P_CAMP;
    [[0, 0, 0xb86e3e], [0.3, -0.12, 0xcdb87a], [0.08, 0.3, 0x8a6a4a]].forEach(([dx, dz, roof]) => house(ctx, CX + dx, CZ + dz, 0, 0.24, 0.24, 0.1, 0xe8dcc0, roof, 'cone'));
    b.glow(new THREE.ConeGeometry(0.035, 0.07, 6), 0xffa040, M(CX + 0.25, ctx.y(CX + 0.25, CZ + 0.18) + 0.035, CZ + 0.18));
    b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 4), 0x5a4030, M(CX - 0.2, ctx.y(CX - 0.2, CZ + 0.2) + 0.21, CZ + 0.2), false);
    b.add(new THREE.BoxGeometry(0.12, 0.07, 0.008), 0xb86e3e, M(CX - 0.14, ctx.y(CX - 0.2, CZ + 0.2) + 0.38, CZ + 0.2), false);
    // Lone tree and lightning-rod stone pillars
    tree(ctx, -1.6, -0.3, 1.1, [0x6f9140, 0x5a7a38]);
    for (const [x, z] of [[-1.35, -1.2], [-1.0, -1.45], [-1.6, -0.95]] as [number, number][]) {
      const y = ctx.y(x, z);
      b.add(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 5), 0x77727e, M(x, y + 0.2, z));
      ctx.foot(x, z, 0.1, 0.3);
    }
    for (let i = 0; i < 6; i++) {
      const p = spot(ctx, 0.25, (x, z) => dist(x, z, ...P_TERRACE) > 0.7 && dist(x, z, ...P_CAMP) > 0.5 && lineDist(x, z, P_ROAD) > 0.2 && dist(x, z, ...P_BONES) > 0.5);
      if (p) rock(ctx, p[0], p[1], 0.9 + r() * 0.5, 0x77727e);
    }
    // Thunderstorm cloud mass: parked above the tower top and churning slowly, lightning striking the tower tip one bolt after another
    const top = ctx.getTowerTop();
    // The cloud mass gets its own, brighter shade color, otherwise the whole mass is crushed into one black lump by the plain's deep-blue shade
    const cloud = new THREE.Group();
    const cloudLook = { ambient: 0xc4c8e0, shadow: 0x6a70a8, rim: 0xffe8c8 };
    const base = cloudGeo(7, 0.8, r, 0.62);
    base.scale(1, 0.7, 1);
    const crown = cloudGeo(5, 0.5, r, 0.5);
    const dark = new THREE.Mesh(base, lookMaterial(ctx.tint(0x7a84ac), cloudLook, 0.5));
    const light = new THREE.Mesh(crown, lookMaterial(ctx.tint(0xc8cee8), cloudLook, 0.5));
    light.position.set(0.12, 0.22, -0.1);
    cloud.add(dark, light);
    inkScenery(cloud);
    cloud.position.set(top.x + 0.05, top.y + 0.7, top.z);
    g.add(cloud);
    const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff4c0).multiplyScalar(ctx.def.locked ? 0.8 : 2.2), toneMapped: false, side: THREE.DoubleSide });
    const bolts: THREE.Mesh[] = [];
    for (let v = 0; v < 3; v++) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const f = k / 6;
        const j = k === 0 || k === 6 ? 0 : 1;
        pts.push(new THREE.Vector3(top.x + (r() - 0.5) * 0.2 * j, top.y + 0.55 - f * 0.55, top.z + (r() - 0.5) * 0.1 * j));
      }
      const m = new THREE.Mesh(ribbon(pts, 0.035, undefined, new THREE.Vector3(1, 0, 0)), boltMat);
      m.visible = false;
      g.add(m);
      bolts.push(m);
    }
    ctx.anim.push((dt, t, w) => {
      cloud.rotation.y += dt * 0.12;
      cloud.position.y = top.y + 0.7 + Math.sin(t * 0.7) * 0.04;
      const period = 2.6;
      const ph = (t + 0.7) % period;
      const k = Math.floor((t + 0.7) / period) % 3;
      bolts.forEach((m, i) => (m.visible = i === k && (ph < 0.09 || (ph > 0.16 && ph < 0.22))));
      if (ph < dt * 1.01 && !ctx.def.locked) ctx.vfx.emit({ pos: top.clone().add(w), count: ctx.low ? 3 : 7, color: [0xfff4c0, 0xc8a0ff], speed: [0.4, 1.2], spread: 1, life: [0.2, 0.4], size: [0.08, 0.14], intensity: 2 });
    });
  },
};

// ───────────────────────── Dawnlight Holy City ─────────────────────────

const holyOutline = new Outline(2.2, [[2, 0.06, 0.8], [3, 0.05, 2.2], [5, 0.025, 0.3]]);
const H_SAT: [number, number] = [-0.55, -3.3];
const H_PLAZA: [number, number] = [0.05, 1.05];

export const HOLY: RegionDef = {
  look: { ambient: 0xc4bcd4, shadow: 0x9486c4, rim: 0xfff0d0 },
  side: -1,
  body: {
    outline: holyOutline,
    h: (x, z) => 0.02 * wob(x, z, 2),
    paint: (x, z, _y, out) => {
      const rho = holyOutline.rho(x, z);
      out.set(0xe2d8c3);
      mixTo(out, 0xd8cdb4, 0.5 + 0.5 * wob(x * 2, z * 2, 3));
      mixTo(out, 0xb0d47c, smooth(0.68, 0.8, rho));
      mixTo(out, 0xd8d890, smooth(0.86, 0.96, rho) * 0.6);
      mixTo(out, 0xc9bb9f, smooth(0.34, 0.28, dist(x, z, ...H_PLAZA)));
      mixTo(out, 0xe8dcc0, smooth(0.1, 0.06, Math.abs(x + 0.05)) * smooth(-2, -0.4, z) * smooth(2.2, 1.0, z));
    },
    strata: [0xddd3c2, 0xc2b5a0, 0xe8c878, 0xd6cfe4],
    depth: 2.6,
    seed: 9,
  },
  build(ctx) {
    const { b, r } = ctx;
    const WALL = 0xf0ebe0;
    const ROOF = [0x6a88c0, 0x8ea3cc, 0x5a78b0];
    // Upper city: a raised terrace ringed by curved retaining walls, with a grand staircase climbing up from the outer city
    platform(ctx, 0.05, -0.75, new Outline(1.15, [[2, 0.12, 0.2], [3, 0.05, 1.4]]), 0.3, (x, z) => (Math.abs(x - 0.05) < 0.12 ? 0xe8dcc0 : 0xe2d8c3), [0xddd3c2, 0xe8e0cc, 0xc6b99f], { seed: 4, band: 0.1, taper: 1.02 });
    for (let i = 0; i < 4; i++) b.add(new THREE.BoxGeometry(0.3, 0.075 * (i + 1), 0.09), 0xe8e0cc, M(0.05, 0.0375 * (i + 1), 0.62 - i * 0.08));
    // Cathedral: twin spires, a rose window, blue roofs
    const CX = -0.35;
    const CZ = -0.85;
    const cy = ctx.y(CX, CZ);
    const K = 1.45;
    b.heavy = true;
    b.add(new THREE.BoxGeometry(0.34 * K, 0.28 * K, 0.62 * K), WALL, M(CX, cy + 0.14 * K, CZ));
    b.add(gableGeo(0.4 * K, 0.2 * K, 0.62 * K), ROOF[0], M(CX, cy + 0.27 * K, CZ));
    for (const s of [-1, 1]) {
      b.add(new THREE.BoxGeometry(0.13 * K, 0.56 * K, 0.13 * K), WALL, M(CX + s * 0.14 * K, cy + 0.28 * K, CZ + 0.33 * K));
      b.add(new THREE.ConeGeometry(0.1 * K, 0.34 * K, 4), ROOF[1], M(CX + s * 0.14 * K, cy + 0.73 * K, CZ + 0.33 * K, Math.PI / 4));
    }
    b.add(new THREE.CylinderGeometry(0.15 * K, 0.15 * K, 0.28 * K, 12, 1, false, Math.PI / 2, Math.PI), WALL, M(CX, cy + 0.14 * K, CZ - 0.31 * K));
    b.add(new THREE.SphereGeometry(0.15 * K, 12, 5, Math.PI / 2, Math.PI, 0, Math.PI / 2), ROOF[0], M(CX, cy + 0.28 * K, CZ - 0.31 * K));
    b.heavy = false;
    b.glow(new THREE.CircleGeometry(0.06 * K, 12), 0xffe07a, M(CX, cy + 0.3 * K, CZ + 0.32 * K + 0.005));
    ctx.foot(CX, CZ, 0.7, 0.3);
    // Bell tower
    const BX = 0.55;
    const BZ = -0.7;
    const by = ctx.y(BX, BZ);
    b.add(new THREE.BoxGeometry(0.15, 0.78, 0.15), WALL, M(BX, by + 0.39, BZ));
    b.add(new THREE.BoxGeometry(0.18, 0.035, 0.18), 0xc6b99f, M(BX, by + 0.78, BZ));
    b.add(new THREE.SphereGeometry(0.045, 8, 5), 0xe2b34a, M(BX, by + 0.85, BZ));
    b.add(new THREE.ConeGeometry(0.13, 0.24, 4), ROOF[1], M(BX, by + 1.02, BZ, Math.PI / 4));
    ctx.foot(BX, BZ, 0.2, 0.3);
    // Outer city: houses with white walls and blue roofs, a domed chapel, a fountain plaza
    const HOUSES: [number, number][] = [];
    for (let i = 0; i < 11; i++) {
      const a = -0.35 + (i / 10) * (Math.PI + 0.7);
      const rr = i % 2 ? 0.62 : 0.8;
      const x = H_PLAZA[0] + Math.cos(a) * rr * 1.25;
      const z = H_PLAZA[1] + Math.sin(a) * rr * 0.85;
      if (holyOutline.inside(x, z, 0.2) && Math.abs(x - 0.05) > 0.18) HOUSES.push([x, z]);
    }
    HOUSES.forEach(([x, z], i) => house(ctx, x, z, Math.atan2(-(x - H_PLAZA[0]), -(z - H_PLAZA[1])), 0.19, 0.16, 0.14 + (i % 3) * 0.03, i % 2 ? WALL : 0xf6f2e8, ROOF[i % 3], i % 4 === 3 ? 'hip' : 'gable'));
    house(ctx, 0.75, -1.3, 0, 0.22, 0.22, 0.18, WALL, 0xe2b34a, 'dome');
    {
      const [x, z] = H_PLAZA;
      const y = ctx.y(x, z);
      b.add(new THREE.CylinderGeometry(0.16, 0.17, 0.05, 16), 0xc6b99f, M(x, y + 0.02, z));
      b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), 0x7ac8f0, M(x, y + 0.05, z), false);
      b.add(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 6), WALL, M(x, y + 0.1, z));
    }
    // Cypresses and flowering trees
    for (let i = 0; i < 12; i++) {
      const p = spot(ctx, 0.15, (x, z) => holyOutline.rho(x, z) > 0.7 && dist(x, z, CX, CZ) > 0.5);
      if (!p) continue;
      const [x, z] = p;
      if (i % 2) {
        const y = ctx.y(x, z);
        b.add(new THREE.ConeGeometry(0.05, 0.32, 6), 0x4a7a4a, M(x, y + 0.16, z));
        ctx.foot(x, z, 0.08, 0.3);
      } else tree(ctx, x, z, 0.6, [0xf0b8c8, 0xe8a0b8]);
    }
    // The holy city floats on the clouds: a ring of cloud holds up the island edge
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.2;
      const rr = holyOutline.rAt(a) * 0.96;
      b.add(cloudGeo(3, 0.28, r, 0.42), 0xf8f6ff, M(Math.cos(a) * rr, -0.34 - (i % 2) * 0.08, Math.sin(a) * rr, -a));
    }
    // The holy bridge and the small island of the Seal Tower (ringed by a purification barrier)
    const [SXX, SZZ] = H_SAT;
    const dir = Math.atan2(SZZ, SXX);
    const r0 = holyOutline.rAt(dir) - 0.15;
    const r1 = Math.hypot(SXX, SZZ) - 0.62;
    const len = r1 - r0;
    const mx = Math.cos(dir) * (r0 + len / 2);
    const mz = Math.sin(dir) * (r0 + len / 2);
    const deckY = ctx.y(Math.cos(dir) * r0, Math.sin(dir) * r0) + 0.02;
    b.add(new THREE.BoxGeometry(len + 0.1, 0.05, 0.14), 0xe2d8c3, M(mx, deckY, mz, -dir));
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(len + 0.1, 0.05, 0.02), 0xc6b99f, M(mx - Math.sin(dir) * s * 0.07, deckY + 0.05, mz + Math.cos(dir) * s * 0.07, -dir));
    b.add(new THREE.TorusGeometry(len * 0.32, 0.03, 5, 10, Math.PI).rotateZ(Math.PI), 0xd8cdb4, M(mx, deckY - 0.02, mz, -dir));
    const sat = ctx.sub(satSpec(), SXX, deckY - 0.05, SZZ, 0);
    placeTower(sat, 0, -0.05, { stone: 0xf0ebe0, stoneDark: 0xc6b99f, trim: 0xe2b34a, roof: 0x8ea3cc, glow: 0xffe07a, kind: 'spire' }, 0.66);
    sat.b.glow(new THREE.TorusGeometry(0.42, 0.012, 4, 32), 0xffe07a, M(0, sat.y(0, 0) + 0.05, -0.05, 0, 1, Math.PI / 2));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sat.b.add(cloudGeo(3, 0.22, r, 0.36), 0xf8f6ff, M(Math.cos(a) * 0.6, -0.28, Math.sin(a) * 0.6, -a));
    }
    // Light feathers drift slowly down
    let acc = 0;
    ctx.anim.push((dt, _t, w) => {
      acc += dt * (ctx.low ? 1 : 2.5);
      while (acc > 1) {
        acc -= 1;
        ctx.vfx.emit({ pos: new THREE.Vector3(w.x + (Math.random() - 0.5) * 3, w.y + 1.6, w.z + (Math.random() - 0.5) * 3), count: 1, color: [0xfff2b8, 0xffffff], speed: [0.1, 0.25], dir: new THREE.Vector3(0, -1, 0), spread: 0.3, life: [3, 4.5], size: [0.06, 0.1], intensity: 1.2 });
      }
    });
  },
};

function satSpec(): BodySpec {
  const o = new Outline(0.62, [[3, 0.07, 1.2], [2, 0.05, 0.3]]);
  return {
    outline: o,
    h: () => 0.02,
    paint: (x, z, _y, out) => {
      out.set(o.rho(x, z) > 0.75 ? 0xb0d47c : 0xe2d8c3);
    },
    strata: [0xddd3c2, 0xc2b5a0, 0xe8c878],
    depth: 1.3,
    rings: 5,
    seed: 3,
    lip: 0.12,
  };
}

// ───────────────────────── Duskshade Realm ─────────────────────────

const shadowOutline = new Outline(2.5, [[2, 0.1, 2.4], [3, 0.07, 0.9], [5, 0.04, 1.7]]);
const S_LAKE: [number, number] = [0.95, -0.25];
const S_TOWN: [number, number] = [0.85, 1.15];
const S_TOWER: [number, number] = [-0.12, -1.35];
const S_PATH: [number, number][] = [[0.6, 0.95], [0.15, 0.6], [-0.3, 0.15], [-0.4, -0.45], [-0.2, -0.95]];
const S_GROVE: [number, number] = [-1.25, -0.2];
const sLakeOutline = new Outline(0.55, [[2, 0.14, 1.1], [3, 0.07, 0.3]]);

export const SHADOW: RegionDef = {
  look: { ambient: 0x7a6cb4, shadow: 0x2a1a4a, rim: 0xb8a0ff },
  body: {
    outline: shadowOutline,
    h: (x, z) => 0.05 * wob(x, z, 4) - 0.16 * smooth(0.72, 0.4, dist(x, z, ...S_LAKE)),
    paint: (x, z, _y, out) => {
      out.set(0x323462);
      mixTo(out, 0x2a4a66, 0.5 + 0.5 * wob(x, z, 2));
      mixTo(out, 0x24506a, smooth(0.3, 0.9, wob(x * 0.7, z * 0.7, 5)) * 0.6);
      // Fluorescent meadow
      mixTo(out, 0x3a7a9a, smooth(0.9, 0.3, dist(x, z, -0.5, 1.3)) * 0.55);
      mixTo(out, 0x5c5678, smooth(0.5, 0.35, dist(x, z, ...S_TOWN)));
      mixTo(out, 0x766c96, smooth(0.07, 0.04, lineDist(x, z, S_PATH)));
      mixTo(out, 0x1c1426, smooth(0.66, 0.55, dist(x, z, ...S_LAKE)) * 0.6);
    },
    strata: [0x2e2944, 0x423a5c, 0x363050, 0x24203a],
    depth: 3.1,
    seed: 10,
  },
  build(ctx) {
    const { b, r } = ctx;
    const WARM = 0xffa850;
    // The rock arch behind the tower: a corner of the cave-roof opening, stalactites hanging under the arch, glowing insects crawling over the rock face
    b.heavy = true;
    const AX = -0.12;
    const AZ = -1.72;
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      const x = AX + Math.cos(a) * 1.02;
      const y = Math.sin(a) * 1.25;
      const s = 0.2 + 0.07 * Math.sin(i * 1.7) + (i === 0 || i === 10 ? 0.08 : 0);
      b.add(new THREE.DodecahedronGeometry(s, 0), i % 2 ? 0x423a5c : 0x363050, M(x, ctx.y(x, AZ) + y + (i === 0 || i === 10 ? 0.05 : 0), AZ + Math.sin(i * 2.1) * 0.05, i, 1, i * 0.7, i * 0.3));
    }
    b.heavy = false;
    for (let i = 0; i < 6; i++) {
      const a = 0.45 + (i / 5) * (Math.PI - 0.9);
      const x = AX + Math.cos(a) * 1.0;
      const y = Math.sin(a) * 1.25 - 0.15;
      const len = 0.16 + (i % 3) * 0.07;
      const st = new THREE.ConeGeometry(0.04, len, 5);
      st.rotateX(Math.PI);
      b.add(st, 0x4a4562, M(x, ctx.y(x, AZ) + y - len / 2, AZ + 0.06));
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI;
      b.glow(new THREE.SphereGeometry(0.018, 5, 4), 0x8ae0ff, M(AX + Math.cos(a) * 1.02 + (r() - 0.5) * 0.1, ctx.y(AX, AZ) + Math.sin(a) * 1.25 + 0.1 + (r() - 0.5) * 0.1, AZ + 0.18));
    }
    ctx.foot(AX, AZ, 1.1, 0.25);
    placeTower(ctx, ...S_TOWER, { stone: 0x5a5474, stoneDark: 0x3a3452, trim: 0xa4a2c8, roof: 0x2a2444, glow: 0xffb45a, kind: 'spire' }, 0.62);
    // Endless-night lake and glowing jellyfish
    b.add(pool(sLakeOutline), 0x1c2a58, M(S_LAKE[0], -0.07, S_LAKE[1]), false);
    for (let i = 0; i < 6; i++) {
      const a = r() * 6.28;
      const rr = r() * 0.35;
      b.glow(new THREE.SphereGeometry(0.025, 6, 4), 0x9ad8ff, M(S_LAKE[0] + Math.cos(a) * rr, -0.05, S_LAKE[1] + Math.sin(a) * rr * 0.8));
    }
    // Umbrella mushroom grove: tall umbrella mushrooms, their gills showing a cold light
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = S_GROVE[0] + Math.cos(a) * (0.25 + (i % 3) * 0.18);
      const z = S_GROVE[1] + Math.sin(a) * (0.3 + (i % 2) * 0.2);
      if (!ctx.inside(x, z, 0.2)) continue;
      const y = ctx.y(x, z);
      const h = 0.3 + ((i * 7) % 5) * 0.06;
      const cr = 0.13 + ((i * 3) % 4) * 0.025;
      b.add(new THREE.CylinderGeometry(0.025, 0.04, h, 6), 0x8a86b0, M(x, y + h / 2, z));
      const cap = new THREE.SphereGeometry(cr, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      cap.scale(1, 0.55, 1);
      b.add(cap, i % 2 ? 0x4a3a7a : 0x5a3a8a, M(x, y + h - 0.01, z));
      b.glow(new THREE.CylinderGeometry(cr * 0.92, cr * 0.5, 0.012, 12), 0x6a8aff, M(x, y + h - 0.02, z));
      ctx.foot(x, z, cr * 1.2, 0.4);
    }
    for (let i = 0; i < 10; i++) {
      const p = spot(ctx, 0.2, (x, z) => dist(x, z, ...S_LAKE) > 0.66 && dist(x, z, ...S_TOWN) > 0.55 && lineDist(x, z, S_PATH) > 0.18 && dist(x, z, ...S_TOWER) > 0.5 && dist(x, z, ...S_GROVE) > 0.6 && z > -1.5);
      if (p) tree(ctx, p[0], p[1], 0.8 + r() * 0.3, [0x2a3a5a, 0x33406a], 0x2a2236);
    }
    // Lamplit village: stone houses, warm yellow windows, strings of lamps drawn from the thousand-lamp pillar
    const [TX, TZ] = S_TOWN;
    const ty = ctx.y(TX, TZ);
    const homes: [number, number][] = [[-0.3, -0.05], [0.28, -0.2], [0.3, 0.22], [-0.2, 0.3]];
    for (const [dx, dz] of homes) {
      const x = TX + dx;
      const z = TZ + dz;
      const ry = Math.atan2(-dx, -dz);
      house(ctx, x, z, ry, 0.2, 0.17, 0.15, 0x4a4562, 0x2a2444, 'hip');
      b.glow(new THREE.BoxGeometry(0.04, 0.05, 0.01), WARM, new THREE.Matrix4().multiplyMatrices(M(x, ctx.y(x, z), z, ry), M(0, 0.08, 0.087)));
    }
    b.add(new THREE.CylinderGeometry(0.018, 0.025, 0.62, 5), 0x3a3452, M(TX, ty + 0.31, TZ));
    b.glow(new THREE.OctahedronGeometry(0.045), WARM, M(TX, ty + 0.64, TZ));
    for (const [dx, dz] of homes) {
      const end = new THREE.Vector3(TX + dx * 0.8, ctx.y(TX + dx, TZ + dz) + 0.2, TZ + dz * 0.8);
      const start = new THREE.Vector3(TX, ty + 0.55, TZ);
      b.add(new THREE.CylinderGeometry(0.004, 0.004, start.distanceTo(end), 3), 0x2a2236, along(start, end), false);
      for (let k = 1; k <= 3; k++) b.glow(new THREE.SphereGeometry(0.017, 5, 4), k % 2 ? WARM : 0xffd070, M(...start.clone().lerp(end, k / 4).toArray() as [number, number, number]));
    }
    // Lamps along the road, leading toward the tower one by one
    for (let i = 0; i < S_PATH.length - 1; i++) {
      const [ax, az] = S_PATH[i];
      const [bx, bz] = S_PATH[i + 1];
      const x = (ax + bx) / 2 + 0.08;
      const z = (az + bz) / 2;
      const y = ctx.y(x, z);
      b.add(new THREE.CylinderGeometry(0.01, 0.012, 0.2, 4), 0x2a2236, M(x, y + 0.1, z), false);
      b.glow(new THREE.BoxGeometry(0.045, 0.06, 0.045), WARM, M(x, y + 0.22, z));
    }
    // Fireflies (count follows the quality setting)
    let acc = 0;
    ctx.anim.push((dt, _t, w) => {
      acc += dt * (ctx.low ? 1.5 : 4);
      while (acc > 1) {
        acc -= 1;
        const a = Math.random() * 6.28;
        const rr = Math.random() * 2;
        ctx.vfx.emit({ pos: new THREE.Vector3(w.x + Math.cos(a) * rr, w.y + 0.15 + Math.random() * 0.4, w.z + Math.sin(a) * rr), count: 1, color: [0x8ae0ff, 0xb8f0a0], speed: [0.05, 0.15], spread: 1, life: [2, 3.5], size: [0.05, 0.09], intensity: 1.4 });
      }
    });
  },
};

// ───────────────────────── Void Rift ─────────────────────────

/** Core island: the Uncrowned's Rift Tower is bound to it by four giant chains */
const coreOutline = new Outline(0.7, [[3, 0.1, 0.4], [5, 0.05, 1]]);
const CHUNKS = [0.35, 1.95, 3.5, 5.05];

export const RIFT: RegionDef = {
  look: { ambient: 0x7a5a88, shadow: 0x2a0a34, rim: 0xff8ac8 },
  body: {
    outline: coreOutline,
    h: () => 0.05,
    paint: (x, z, _y, out) => {
      out.set(0x443c52);
      mixTo(out, 0x2c2436, smooth(0.6, 1, coreOutline.rho(x, z)));
    },
    strata: [0x2a2233, 0x3a3046, 0x221a2c, 0x4a3c56],
    depth: 3.6,
    rings: 6,
    seed: 11,
    rough: 1.4,
  },
  label: [0, -1.2, 2.2],
  build(ctx) {
    const { b, r, g } = ctx;
    const cleared = ctx.def.cleared;
    const VOID = cleared ? 0xffc870 : 0xff3a9a;
    placeTower(ctx, 0, 0, { stone: 0x4a4056, stoneDark: 0x221a2c, trim: 0x6a4a86, roof: 0x2a1e38, glow: 0xffd89a, kind: 'ruin' }, 0.82);
    // Ring-shaped abyss: light showing through between the four broken pieces of land (below the top surface, visible through the seams)
    const voidMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(VOID) }, uAmt: { value: ctx.def.locked ? 0.75 : 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
        void main(){
          vec2 p = (vUv - 0.5) * 2.0; float r = length(p); float a = atan(p.y, p.x);
          float swirl = sin(a * 4.0 - r * 10.0 + uTime * 1.3) * 0.5 + 0.5;
          float ring = smoothstep(0.2, 0.45, r) * smoothstep(1.0, 0.7, r);
          vec3 c = mix(uColor * 0.5, uColor * 1.4 + vec3(0.2), swirl * ring);
          gl_FragColor = vec4(c * ring * uAmt, 1.0);
        }`,
    });
    const voidDisc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), voidMat);
    voidDisc.rotation.x = -Math.PI / 2;
    voidDisc.position.y = -0.28;
    g.add(voidDisc);
    // The outer ring of land, cut into four pieces by radial cracks, each drifting slowly on its own
    const tops: THREE.Vector3[] = [];
    CHUNKS.forEach((a, i) => {
      const R = 0.95 + (i % 2) * 0.1;
      const cx = Math.cos(a) * 1.85;
      const cz = Math.sin(a) * 1.85;
      const o = new Outline(R, [[2, 0.28, -2 * a - Math.PI], [3, 0.08, i * 1.3], [5, 0.04, i]]);
      const spec: BodySpec = {
        outline: o,
        h: (x, z) => 0.04 * wob(x, z, i) + 0.06,
        paint: (x, z, _y, out) => {
          out.set(0x6a607a);
          mixTo(out, 0x544a64, 0.5 + 0.5 * wob(x, z, i + 3));
          if (cleared) mixTo(out, 0x6e8058, 0.5);
          // The side facing the abyss: torn open and scorched black
          const inward = -(x * Math.cos(a) + z * Math.sin(a)) / R;
          mixTo(out, 0x221a2c, smooth(0.4, 0.85, inward));
        },
        strata: [0x2a2233, 0x3a3046, 0x5c5066, 0x221a2c],
        depth: 2.0 + (i % 2) * 0.4,
        rings: 6,
        seed: 20 + i,
        rough: 1.4,
        tip: [-Math.cos(a) * 0.2, -Math.sin(a) * 0.2],
      };
      const sy = -0.04 * (i % 2);
      const s = ctx.sub(spec, cx, sy, cz, 0.035);
      tops.push(new THREE.Vector3(cx - Math.cos(a) * R * 0.72, sy + s.y(-Math.cos(a) * R * 0.72, -Math.sin(a) * R * 0.72), cz - Math.sin(a) * R * 0.72));
      // Cracks of light along the inner edge
      const pts: THREE.Vector3[] = [];
      for (let k = -3; k <= 3; k++) {
        const t = a + Math.PI + k * 0.22;
        const rr = o.rAt(t) * 0.97;
        pts.push(new THREE.Vector3(Math.cos(t) * rr, s.y(Math.cos(t) * rr, Math.sin(t) * rr) - 0.04, Math.sin(t) * rr));
      }
      s.b.glow(ribbon(pts, 0.05, undefined, new THREE.Vector3(0, 1, 0)), VOID, new THREE.Matrix4());
      // The landmark of each piece: a colonnade and a fallen royal statue to the west, a broken bridge to the north, an eroded crystal to the east, the firelight of the Order's outpost to the south
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const at = (f: number, side: number) => [dir.x * f + dir.z * side, dir.z * f - dir.x * side] as [number, number];
      const kind = ['east', 'south', 'west', 'north'][i];
      if (kind === 'west') {
        for (let k = 0; k < 4; k++) {
          const [x, z] = at(0.1, -0.45 + k * 0.3);
          const h = k === 2 ? 0.12 : 0.36 - (k % 2) * 0.08;
          s.b.add(new THREE.CylinderGeometry(0.045, 0.05, h, 6), 0x5a5468, M(x, s.y(x, z) + h / 2, z));
          s.foot(x, z, 0.1, 0.3);
        }
        const [x, z] = at(0.35, 0.1);
        s.b.add(new THREE.BoxGeometry(0.34, 0.1, 0.12), 0x5a5468, M(x, s.y(x, z) + 0.05, z, a + 0.4));
        s.b.add(new THREE.TorusGeometry(0.06, 0.02, 4, 8), 0xb89a4a, M(x + 0.2, s.y(x, z) + 0.05, z + 0.08, 0, 1, 1.2));
      } else if (kind === 'north') {
        const [x, z] = at(-0.1, 0);
        s.b.add(new THREE.BoxGeometry(0.12, 0.04, 0.5), 0x5a5468, M(x + dir.x * 0.3, s.y(x, z) + 0.05, z + dir.z * 0.3, -a + Math.PI / 2, 1, 0.12));
        for (let k = 0; k < 3; k++) {
          const [hx, hz] = at(0.35, -0.3 + k * 0.3);
          house(s, hx, hz, a, 0.14, 0.12, 0.12 + k * 0.03, 0x4a4458, 0x2a1e38, 'gable');
        }
      } else if (kind === 'east') {
        for (let k = 0; k < 5; k++) {
          const [x, z] = at(0.05 + (k % 2) * 0.25, -0.35 + k * 0.17);
          const cr = new THREE.OctahedronGeometry(0.06, 0);
          cr.scale(0.6, 2.2 + (k % 3) * 0.6, 0.6);
          s.b.glow(cr, cleared ? 0xffd89a : 0xff5ac8, M(x, s.y(x, z) + 0.1, z, k, 1, (k - 2) * 0.2, 0.15));
        }
      } else {
        for (let k = 0; k < 2; k++) {
          const [x, z] = at(0.3, -0.18 + k * 0.36);
          house(s, x, z, a, 0.16, 0.16, 0.1, 0x8a7458, 0x6a4a36, 'cone');
        }
        const [fx, fz] = at(0.1, 0);
        s.b.glow(new THREE.ConeGeometry(0.035, 0.08, 6), 0xffa040, M(fx, s.y(fx, fz) + 0.04, fz));
        const [px, pz] = at(0.5, 0.05);
        s.b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 4), 0x3a3046, M(px, s.y(px, pz) + 0.18, pz), false);
        s.b.add(new THREE.BoxGeometry(0.1, 0.08, 0.008), 0x3a5aa8, M(px + 0.05, s.y(px, pz) + 0.32, pz), false);
      }
    });
    // Four giant chains: tower body → the inner edge of each piece of land
    const top = new THREE.Vector3(0, ctx.y(0, 0) + 0.55, 0);
    const links: THREE.BufferGeometry[] = [];
    for (const end of tops) {
      const n = 11;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const p = top.clone().lerp(end, t);
        p.y -= Math.sin(t * Math.PI) * 0.12;
        const q = top.clone().lerp(end, t + 0.02);
        q.y -= Math.sin((t + 0.02) * Math.PI) * 0.12;
        const link = new THREE.TorusGeometry(0.04, 0.014, 4, 8);
        link.scale(1.4, 1, 1);
        const d = q.sub(p).normalize();
        const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, new THREE.Vector3(0, 1, 0));
        m.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        if (k % 2) m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        m.setPosition(p);
        link.applyMatrix4(m);
        links.push(link);
      }
    }
    b.add(mergeGeometries(links)!, 0x2a2233, new THREE.Matrix4(), false);
    // Fragments slowly tumbling in the void
    const debris = new THREE.Group();
    const dg: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r() * 0.8;
      const rr = 2.75 + r() * 0.3;
      const d = new THREE.DodecahedronGeometry(0.13 + r() * 0.09, 0);
      d.scale(1, 0.7, 1);
      d.applyMatrix4(M(Math.cos(a) * rr, -0.6 + r() * 1.2, Math.sin(a) * rr, r() * 6, 1, r() * 3, r() * 3));
      dg.push(d);
    }
    const dm = ctx.mesh(mergeGeometries(dg)!, 0x5a5068, true);
    g.remove(dm);
    debris.add(dm);
    g.add(debris);
    let acc = 0;
    ctx.anim.push((dt, t, w) => {
      voidMat.uniforms.uTime.value = t;
      debris.rotation.y += dt * 0.05;
      acc += dt * (ctx.low ? 2 : 6);
      while (acc > 1) {
        acc -= 1;
        const a = Math.random() * 6.28;
        const rr = 1.0 + Math.random() * 0.4;
        ctx.vfx.emit({ pos: new THREE.Vector3(w.x + Math.cos(a) * rr, w.y - 0.3, w.z + Math.sin(a) * rr), count: 1, color: cleared ? [0xffd89a, 0xffffff] : [0xff5ac8, 0x9a3aff], speed: [0.3, 0.6], dir: new THREE.Vector3(0, 1, 0), spread: 0.2, life: [1.4, 2.2], size: [0.06, 0.12], intensity: 1.5 });
      }
    });
  },
};
