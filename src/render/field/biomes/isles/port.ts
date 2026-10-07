// The harbor of Lighthouse Harbor: fishing gear piled on the inner side of the embankment (shrimp pots, barrels, rope coils,
// fish crates, fishing nets drying on the embankment, oars leaning on the wall, anchors),
// small rowboats tied to the mooring posts in the anchorage and a row of buoys; the fishing harbor in the west has two
// piers, moored sailboats, stilt houses on wooden piles,
// net-drying and fish-drying racks, a fish-smoking hut and a shipbuilding slip, and on the south beach are boat sheds and
// small boats turned over to dry.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { ColorBatch } from './fx.ts';
import { palm, reefRock, shell } from './flora.ts';
import { medHouse, PLANK, STONE, STONE_D, TERRA, WINDOW, WOOD, WOOD_D, type HouseOut } from './houses.ts';
import { Frame, MX, put, putGlow, rod, rope, T, V } from './parts.ts';
import { boat, deckAlong, mooredBoat, perchedGull } from './town.ts';
import { DECK_Y, PIER_LINES, TOWN } from './terrain.ts';

const IRON = 0x3a4050;
const NET = 0x7a8a6a;
const CORK = [0xff6a4a, 0xffffff, 0xffc83a];
const HULLS = [0x2f6aa8, 0xd8553f, 0x2a9a8a, 0xf2c24a, 0xf8f4ea, 0x4a9a5a];

/** Embankment: the same circle as town.ts's stone embankment (radius, angle range) */
const WALL_R = 16.6;
const GATE_X = -3.6;

// ───────────────────────── Fishing gear ─────────────────────────

/** Shrimp pot: a round cage of wooden slats, two or three stacked together */
function lobsterPots(ctx: FieldCtx, F: Frame, n: number): void {
  const { b, r } = ctx;
  for (let i = 0; i < n; i++) {
    const x = (i % 2) * 0.75 - 0.35;
    const y = i < 2 ? 0 : 0.62;
    const z = i < 2 ? 0 : 0.1;
    const ry = r();
    put(b, T.cyl8, 0x9a7a52, F.L(x + (i >= 2 ? 0.35 : 0), y + 0.3, z, 0.34, 0.6, 0.34, Math.PI / 2, ry));
    for (const dz of [-0.28, 0, 0.28]) put(b, T.cyl8, WOOD_D, F.L(x + (i >= 2 ? 0.35 : 0), y + 0.3, z, 0.355, 0.05, 0.355, Math.PI / 2, ry, 0), false);
    put(b, T.disc, 0x2a2016, F.L(x + (i >= 2 ? 0.35 : 0) + Math.sin(ry) * 0.31, y + 0.3, z + Math.cos(ry) * 0.31, 0.26, 1, 0.26, Math.PI / 2, ry), false);
  }
}

/** A coil of rope (two or three loops stacked) */
function ropeCoil(ctx: FieldCtx, F: Frame, lx: number, lz: number, s = 1): void {
  for (let i = 0; i < 3; i++) put(ctx.b, T.torus, 0xc8b48a, F.L(lx, 0.07 + i * 0.09, lz, (0.36 - i * 0.05) * s, (0.36 - i * 0.05) * s, (0.36 - i * 0.05) * s, Math.PI / 2), false);
}

/** Fish crate: a stack of flat wooden crates, with the top one full of fish */
function fishCrates(ctx: FieldCtx, F: Frame): void {
  const { b, r } = ctx;
  for (let i = 0; i < 3; i++) put(b, T.box, i % 2 ? PLANK : 0xb08050, F.L(r() * 0.1, 0.14 + i * 0.27, r() * 0.1, 0.9, 0.26, 0.6, 0, r() * 0.2));
  for (let i = 0; i < 6; i++) put(b, T.oct, [0xb8c8d8, 0x6a9ac8, 0xff8a5a, 0xd8c070][i % 4], F.L(-0.3 + (i % 3) * 0.3, 0.84, -0.12 + Math.floor(i / 3) * 0.24, 0.28, 0.07, 0.11, 0, r() * 0.6), false);
  put(b, T.box, PLANK, F.L(0.9, 0.14, 0.15, 0.9, 0.26, 0.6, 0, 0.5));
}

/** A pile of fishing nets and buoys */
function netPile(ctx: FieldCtx, F: Frame): void {
  const { b, r } = ctx;
  for (let i = 0; i < 3; i++) put(b, T.ico1, i % 2 ? NET : 0x6a7a5a, F.L((r() - 0.5) * 0.8, 0.12, (r() - 0.5) * 0.6, 0.7, 0.26, 0.55, 0, r() * 6), false);
  for (let i = 0; i < 5; i++) put(b, T.sphere, CORK[i % 3], F.L((r() - 0.5) * 1.2, 0.28, (r() - 0.5) * 0.9, 0.11, 0.11, 0.11), false);
}

/** A pair of oars leaning against a wall */
function oars(ctx: FieldCtx, F: Frame): void {
  for (const s of [-0.2, 0.2]) {
    put(ctx.b, T.cyl5, PLANK, F.L(s, 1.1, -0.15, 0.04, 2.2, 0.04, -0.2, 0, s));
    put(ctx.b, T.box, PLANK, F.L(s + Math.sin(s) * 0.05, 0.25, 0.02, 0.2, 0.55, 0.04, -0.2, 0, s));
  }
}

/** Anchor: an iron shank, a crossbar and curved flukes */
function anchor(ctx: FieldCtx, F: Frame, s = 1): void {
  const { b } = ctx;
  put(b, T.cyl6, IRON, F.L(0, 1.1 * s, 0, 0.1 * s, 2.2 * s, 0.1 * s, 0, 0, 0.25));
  put(b, T.box, IRON, F.L(0.25 * s, 2.0 * s, 0, 1.3 * s, 0.14 * s, 0.14 * s, 0, 0, 0.25));
  put(b, T.torus, IRON, F.L(-0.3 * s, 0.35 * s, 0, 0.85 * s, 0.85 * s, 0.5 * s, 0, 0, Math.PI + 0.25));
  put(b, T.ring, IRON, F.L(0.5 * s, 2.3 * s, 0, 0.18 * s, 0.18 * s, 0.18 * s));
}

/** Small rowboat (vertex-color batch): hull, gunwale, two thwarts, a pair of oars; base is the boat's position and direction */
export function rowboat(cb: ColorBatch, base: THREE.Matrix4, hull: number, s = 1): void {
  const shape = (k: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 1.6 * k);
    sh.quadraticCurveTo(0.72 * k, 0.8 * k, 0.66 * k, -0.2 * k);
    sh.quadraticCurveTo(0.62 * k, -1.1 * k, 0.4 * k, -1.3 * k);
    sh.lineTo(-0.4 * k, -1.3 * k);
    sh.quadraticCurveTo(-0.62 * k, -1.1 * k, -0.66 * k, -0.2 * k);
    sh.quadraticCurveTo(-0.72 * k, 0.8 * k, 0, 1.6 * k);
    return sh;
  };
  const at = (m: THREE.Matrix4) => base.clone().multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(m);
  const hullG = new THREE.ExtrudeGeometry(shape(1), { depth: 0.55, bevelEnabled: false, curveSegments: 5 });
  hullG.rotateX(Math.PI / 2);
  cb.add(hullG, hull, at(M(0, 0.45, 0)));
  const rim = new THREE.ExtrudeGeometry(shape(1.06), { depth: 0.1, bevelEnabled: false, curveSegments: 5 });
  rim.rotateX(Math.PI / 2);
  cb.add(rim, hull === 0xf8f4ea ? 0x2f6aa8 : 0xf8f4ea, at(M(0, 0.55, 0)));
  const inner = new THREE.ShapeGeometry(shape(0.86), 4);
  inner.rotateX(-Math.PI / 2);
  cb.add(inner, 0x6a4a30, at(M(0, 0.4, 0)));
  for (const z of [0.5, -0.55]) cb.add(new THREE.BoxGeometry(1.15, 0.07, 0.24), PLANK, at(M(0, 0.48, z)));
  for (const sd of [-1, 1]) cb.add(new THREE.BoxGeometry(0.05, 0.05, 1.9), PLANK, at(M(sd * 0.45, 0.56, -0.1, sd * 0.12)));
}

// ───────────────────────── Embankment and anchorage ─────────────────────────

function quay(ctx: FieldCtx, out: HouseOut): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWN;
  b.lift = 0;
  // Fishing gear on the inner side of the embankment: a pile every so often (avoiding the Tidebell Gate and the road)
  const kinds = ['pots', 'crates', 'net', 'barrels', 'coil', 'oars', 'pots', 'crates', 'anchor', 'net'] as const;
  let k = 0;
  for (let a = -1.12; a <= 1.12; a += 0.14) {
    const R = 14.9 + r() * 0.3;
    const x = tx + Math.sin(a) * R;
    const z = tz - Math.cos(a) * R;
    if (Math.abs(x - GATE_X) < 5.5) continue;
    if (ctx.pathDist(x, z) < 2.9 || ctx.solids.blocked(x, z, 0.9)) continue;
    const y = ctx.h(x, z);
    if (y < 1.5) continue;
    // Facing: back to the embankment
    const F = new Frame(x, y, z, Math.atan2(-Math.sin(a), Math.cos(a)));
    const kind = kinds[k++ % kinds.length];
    if (kind === 'pots') lobsterPots(ctx, F, 3);
    else if (kind === 'crates') fishCrates(ctx, F);
    else if (kind === 'net') netPile(ctx, F);
    else if (kind === 'coil') {
      ropeCoil(ctx, F, 0, 0);
      ropeCoil(ctx, F, 0.8, 0.2, 0.8);
    } else if (kind === 'oars') {
      oars(ctx, F.sub(0, 0, -0.6, 0));
      ropeCoil(ctx, F, 0.9, 0.3, 0.7);
    } else if (kind === 'anchor') anchor(ctx, F.sub(0, 0, -0.5, 0), 0.8);
    else {
      for (let i = 0; i < 3; i++) {
        put(b, T.cyl12, 0x8a5a38, F.L(-0.45 + i * 0.5, 0.45, i === 1 ? 0.3 : 0, 0.34, 0.9, 0.34));
        for (const yy of [0.15, 0.75]) put(b, T.cyl12, IRON, F.L(-0.45 + i * 0.5, yy, i === 1 ? 0.3 : 0, 0.35, 0.05, 0.35), false);
      }
    }
    ctx.solids.add(x, z, kind === 'coil' ? 0.6 : 0.85);
  }
  // Fishing nets drying on top of the embankment, with buoys hanging on the seaward side
  for (let a = -1.0; a <= 1.0; a += 0.33) {
    const x = tx + Math.sin(a) * WALL_R;
    const z = tz - Math.cos(a) * WALL_R;
    if (Math.abs(x - GATE_X) < 4.5 || ctx.h(x, z) < -1.5) continue;
    const F = new Frame(x, 2.66, z, Math.atan2(-Math.sin(a), Math.cos(a)));
    put(b, T.ico1, NET, F.L(0, 0.05, 0.1, 1.1, 0.14, 0.7, 0, r()), false);
    put(b, T.box, NET, F.L(0, -0.55, -0.82, 1.6, 1.1, 0.04), false);
    for (let i = 0; i < 4; i++) put(b, T.sphere, CORK[i % 3], F.L(-0.6 + i * 0.4, -1.05, -0.86, 0.12, 0.12, 0.12), false);
  }
  // A seagull on a mooring post
  for (const i of [1, 9, 21]) {
    const a = -1.25 + (i / 26) * 2.5;
    const x = tx + Math.sin(a) * WALL_R + Math.sin(a) * 0.3;
    const z = tz - Math.cos(a) * WALL_R - Math.cos(a) * 0.3;
    if (Math.abs(x - GATE_X) < 3) continue;
    perchedGull(ctx, x, 2.55 + 0.72, z, a * 2 + 1);
  }

  // Small rowboats in the anchorage: tied along the embankment, a rope running to a mooring post on top of the embankment (all one rocking mesh)
  const cb = new ColorBatch();
  let n = 0;
  for (const i of [1, 5, 9, 17, 21, 25]) {
    const a = -1.25 + (i / 26) * 2.5;
    const R = WALL_R + 2.6;
    const x = tx + Math.sin(a) * R;
    const z = tz - Math.cos(a) * R;
    if (ctx.h(x, z) > -0.9 || Math.abs(x - GATE_X) < 6 || ctx.pathDist(x, z) < 4) continue;
    const heading = -a + Math.PI / 2 + (r() - 0.5) * 0.3;
    cb.bob = r() * 6.28;
    rowboat(cb, new THREE.Matrix4().compose(V(x, -0.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, heading, (r() - 0.5) * 0.08)), V(1, 1, 1)), HULLS[n++ % HULLS.length], 1.05);
    const bow = V(x + Math.sin(heading) * 1.5, 0.3, z + Math.cos(heading) * 1.5);
    const post = V(tx + Math.sin(a) * (WALL_R + 0.3), 2.7, tz - Math.cos(a) * (WALL_R + 0.3));
    rope(b, post, bow, 0.5, 0.02, 0xc8b48a, 5);
  }
  // A row of buoys on the east side of the anchorage (marking where the fishing nets are)
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const x = 6 + t * 8;
    const z = 58 - t * 6 + Math.sin(t * 6) * 0.4;
    if (ctx.h(x, z) > -0.6) continue;
    cb.bob = t * 5;
    cb.add(new THREE.SphereGeometry(0.2, 8, 6), CORK[i % 2], M(x, -0.02, z));
  }
  if (!cb.empty) {
    const { tick } = cb.build(ctx.group, ctx.disposers, 0.04);
    ctx.extras.push((_dt, t) => tick(t));
  }
  void out;
}

// ───────────────────────── The fishing harbor in the west ─────────────────────────

/**
 * Stilt house: wooden piles, diagonal braces, a platform and a railing, with a small white house on top;
 * fishing gear piled on the platform, a ladder hanging to the water, and a small boat tied below
 */
function stiltHouse(ctx: FieldCtx, x: number, z: number, f: number, v: number, cb: ColorBatch, out: HouseOut): void {
  const { b, r } = ctx;
  const top = 1.9;
  b.lift = 0;
  const F = new Frame(x, top, z, f);
  for (const sx of [-1.8, 1.8])
    for (const sz of [-1.6, 1.6]) {
      const p = F.p(sx, 0, sz);
      put(b, T.cyl6, WOOD_D, MX(p.x, (top - 5) / 2, p.z, 0.17, top + 5, 0.17));
      // A ring of barnacles and seaweed on the water surface
      put(b, T.cyl6, 0x5a6a5a, MX(p.x, 0.05, p.z, 0.21, 0.4, 0.21), false);
    }
  // Diagonal braces
  for (const sz of [-1.6, 1.6]) {
    rod(b, F.p(-1.8, -1.2 - top, sz), F.p(1.8, -0.2 - top + top, sz), 0.07, WOOD_D, T.cyl4);
  }
  put(b, T.box, PLANK, F.L(0, 0, 0, 4.6, 0.2, 4.4));
  for (let i = 0; i < 7; i++) put(b, T.box, i % 2 ? 0xb48656 : PLANK, F.L(-2.0 + i * 0.66, 0.11, 0, 0.04, 0.02, 4.4), false);
  medHouse(ctx, F.sub(0, 0.1, -0.5, 0), { w: 3.4, d: 2.9, h: 2.4, floors: 1, roof: v === 1 ? 'gable' : 'hip', wall: [0xf7f2e8, 0xeef4f4, 0xf3e6cf][v], trim: [0x2a9a8a, 0x2f7ab8, 0xc0503a][v], roofCol: v === 2 ? 0x3a9aa8 : undefined, deck: true, noSolid: true, lit: 0.6 }, out);
  // Railing
  const n = 7;
  for (let i = 0; i <= n; i++) put(b, T.box, WOOD_D, F.L(-2.2 + (i * 4.4) / n, 0.5, 2.1, 0.07, 0.8, 0.07), false);
  put(b, T.box, WOOD, F.L(0, 0.9, 2.1, 4.5, 0.07, 0.07));
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 5; i++) put(b, T.box, WOOD_D, F.L(s * 2.2, 0.5, -2.1 + (i * 4.2) / 5, 0.07, 0.8, 0.07), false);
    put(b, T.box, WOOD, F.L(s * 2.2, 0.9, 0, 0.07, 0.07, 4.3));
  }
  // Nets drying on the railing, shrimp pots and fish baskets on the platform
  put(b, T.box, NET, F.L(-0.8, 0.55, 2.16, 1.8, 0.75, 0.03), false);
  for (let i = 0; i < 4; i++) put(b, T.sphere, CORK[i % 3], F.L(-1.5 + i * 0.45, 0.2, 2.2, 0.1, 0.1, 0.1), false);
  lobsterPots(ctx, F.sub(1.3, 0.1, 1.2, 0.4), r() < 0.5 ? 2 : 3);
  // Ladder: hanging from the platform edge into the water
  for (const s of [-0.3, 0.3]) put(b, T.box, WOOD, F.L(1.6 + s, -1.0, 2.35, 0.07, 2.4, 0.07));
  for (let i = 0; i < 5; i++) put(b, T.box, WOOD, F.L(1.6, -0.3 - i * 0.45, 2.35, 0.6, 0.06, 0.06), false);
  // The small boat tied below the platform
  const bp = F.p(2.7, 0, 2.7);
  cb.bob = r() * 6.28;
  rowboat(cb, new THREE.Matrix4().compose(V(bp.x, -0.25, bp.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, f + 0.3, 0)), V(1, 1, 1)), HULLS[(v + 2) % HULLS.length], 0.9);
  // The lamp under the eaves
  const lp = F.p(1.9, 1.9, 1.7);
  put(b, T.cyl5, WOOD_D, MX(lp.x, top + 1.0, lp.z, 0.05, 2.0, 0.05), false);
  putGlow(b, T.sphere, WINDOW, MX(lp.x, top + 2.05, lp.z, 0.16, 0.2, 0.16));
  put(b, T.cone6, IRON, MX(lp.x, top + 2.3, lp.z, 0.24, 0.18, 0.24));
  out.lights.push([lp.x, top + 2.05, lp.z, 1.4]);
}

/** Net-drying rack + fish-drying rack: two posts, a crossbar, a hanging net, and the other half hung with a row of dried fish */
function netRack(ctx: FieldCtx, x: number, z: number, f: number): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 1.5);
  if (y < 0.3) return;
  b.lift = 0;
  const F = new Frame(x, y, z, f);
  for (const s of [-1.6, 1.6]) put(b, T.cyl5, WOOD_D, F.L(s, 1.2, 0, 0.08, 2.4, 0.08));
  put(b, T.cyl5, WOOD, F.L(0, 2.3, 0, 0.05, 3.4, 0.05, 0, 0, Math.PI / 2));
  // Left half: the net (a few hanging ropes + horizontal lines); right half: dried fish
  for (let i = 0; i < 5; i++) put(b, T.box, NET, F.L(-1.4 + i * 0.3, 1.55, 0.02, 0.03, 1.5, 0.03), false);
  for (let i = 0; i < 4; i++) put(b, T.box, NET, F.L(-0.8, 0.95 + i * 0.4, 0.02, 1.3, 0.03, 0.03), false);
  for (let i = 0; i < 3; i++) put(b, T.sphere, CORK[i % 3], F.L(-1.3 + i * 0.5, 0.82, 0.05, 0.1, 0.1, 0.1), false);
  for (let i = 0; i < 6; i++) {
    const fx = 0.2 + i * 0.24;
    put(b, T.cyl4, 0xc8b48a, F.L(fx, 2.1, 0, 0.01, 0.4, 0.01), false);
    put(b, T.oct, r() < 0.5 ? 0xc8a878 : 0xb89868, F.L(fx, 1.72, 0, 0.1, 0.36, 0.05, 0, r() * 0.4), false);
  }
  // Fish baskets and stools under the rack
  put(b, T.pot, 0xc8a870, F.L(0.6, 0.22, 0.6, 0.3, 0.44, 0.3));
  put(b, T.box, PLANK, F.L(-0.7, 0.35, 0.8, 1.0, 0.08, 0.35));
  for (const s of [-0.4, 0.4]) put(b, T.box, WOOD_D, F.L(-0.7 + s, 0.16, 0.8, 0.07, 0.32, 0.3), false);
  ctx.solids.add(x, z, 1.4);
}

/** Fish-smoking hut: a low stone-built house, a wooden door, a chimney, with firewood and fish baskets outside */
function smokehouse(ctx: FieldCtx, x: number, z: number, f: number, out: HouseOut): void {
  const { b } = ctx;
  const y = ctx.place(x, z, 1.6);
  b.lift = 0;
  const F = new Frame(x, y, z, f);
  put(b, T.box, 0xb8ae9a, F.L(0, 0.9, 0, 2.6, 2.0, 2.2));
  for (let i = 0; i < 6; i++) put(b, T.box, i % 2 ? 0xa89c86 : 0xc4baa6, F.L(-1.3 + (i % 3) * 1.3, 0.3 + Math.floor(i / 3) * 0.9, 1.11, 0.7, 0.35, 0.03), false);
  put(b, T.prism, 0x8a7a5a, F.L(0, 1.9, 0, 2.9, 0.9, 2.6));
  put(b, T.box, WOOD_D, F.L(0, 0.7, 1.12, 0.8, 1.4, 0.06));
  put(b, T.box, 0xb8ae9a, F.L(0.8, 2.6, -0.5, 0.45, 1.2, 0.45));
  out.smoke.push(F.p(0.8, 3.3, -0.5));
  for (let i = 0; i < 6; i++) put(b, T.cyl6, 0xa07a4c, F.L(-1.7, 0.12 + Math.floor(i / 3) * 0.22, -0.4 + (i % 3) * 0.24, 0.1, 1.0, 0.1, 0, 0, Math.PI / 2), false);
  put(b, T.pot, 0xc8a870, F.L(1.0, 0.22, 1.5, 0.3, 0.44, 0.3));
  ctx.solids.add(x, z, 1.8);
}

/** Boat shed: three walls and a single-slope roof, the front open toward the sea, a small boat resting inside, and a launching slip in front */
function boathouse(ctx: FieldCtx, x: number, z: number, f: number): void {
  const { b } = ctx;
  const y = ctx.place(x, z, 2.2);
  b.lift = 0;
  const F = new Frame(x, y, z, f);
  const w = 3.6;
  const d = 4.6;
  put(b, T.box, 0xf4efe4, F.L(0, 1.2, -d / 2, w, 2.6, 0.3));
  for (const s of [-1, 1]) {
    put(b, T.box, 0xf4efe4, F.L(s * w / 2, 1.1, 0, 0.3, 2.4, d));
    put(b, T.box, 0x2f7ab8, F.L(s * w / 2, 0.3, 0, 0.34, 0.5, d + 0.04), false);
  }
  put(b, T.box, TERRA, F.L(0, 2.55, 0.2, w + 0.6, 0.16, d + 0.8, 0.12));
  for (let k = 1; k < 5; k++) put(b, T.box, 0xa84a2c, F.L(0, 2.7 - (k / 5 - 0.5) * 0.6, 0.2 + (k / 5 - 0.5) * (d + 0.8), w + 0.6, 0.05, 0.07, 0.12), false);
  // Slip: two wooden rails running to the water's edge
  for (const s of [-0.6, 0.6]) put(b, T.box, WOOD_D, F.L(s, 0.08, d / 2 + 1.6, 0.18, 0.14, d + 1.6));
  // The small boat inside (stationary, resting on a wooden cradle)
  const hull = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  hull.rotateX(Math.PI);
  put(b, hull, 0x2a9a8a, F.L(0, 0.75, 0.2, 0.75, 0.45, 1.7));
  put(b, T.box, 0xf8f4ea, F.L(0, 0.76, 0.2, 1.46, 0.08, 3.3), false);
  // Lifebuoys and oars hung on the wall
  put(b, T.torus, 0xe8443a, F.L(-w / 2 - 0.18, 1.6, 0.8, 0.32, 0.32, 0.32, 0, Math.PI / 2));
  put(b, T.cyl5, PLANK, F.L(w / 2 + 0.2, 1.2, 0.5, 0.04, 2.0, 0.04, 0.3, 0, 0));
  ctx.solids.add(F.p(0, 0, -1.2).x, F.p(0, 0, -1.2).z, 2.0);
  ctx.solids.add(F.p(-1.5, 0, 1.2).x, F.p(-1.5, 0, 1.2).z, 0.6);
  ctx.solids.add(F.p(1.5, 0, 1.2).x, F.p(1.5, 0, 1.2).z, 0.6);
}

function westHarbor(ctx: FieldCtx, out: HouseOut): void {
  const { b, r } = ctx;
  const cb = new ColorBatch();
  PIER_LINES.forEach((line, k) => {
    const lamps = deckAlong(ctx, line, 2.5, { rail: false, lamps: 3 });
    for (const [x, y, z] of lamps) {
      b.lift = 0;
      b.add(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), WOOD_D, M(x, y + 1.3, z));
      b.glow(new THREE.SphereGeometry(0.2, 8, 6), WINDOW, M(x, y + 2.7, z));
      b.add(new THREE.ConeGeometry(0.3, 0.25, 6), IRON, M(x, y + 3.0, z));
      out.lights.push([x, y + 2.7, z, 1.5]);
    }
    // Pier end: mooring posts, rope coils, crates, a pile of nets, a fishing rod of someone sitting at the pier's edge to fish
    const [ex, ez] = line[line.length - 1];
    const [px, pz] = line[line.length - 3];
    const dx = ex - px;
    const dz = ez - pz;
    const l = Math.hypot(dx, dz);
    const nx = dz / l;
    const nz = -dx / l;
    b.lift = 0;
    const heading = Math.atan2(dx, dz);
    const E = new Frame(ex, DECK_Y + 0.07, ez, heading);
    for (const s of [-1, 1]) {
      put(b, T.cyl8, IRON, E.L(s * 0.9, 0.3, 0, 0.22, 0.55, 0.22));
      put(b, T.cyl8, IRON, E.L(s * 0.9, 0.6, 0, 0.3, 0.08, 0.3), false);
    }
    const P = new Frame(px, DECK_Y + 0.07, pz, heading);
    put(b, T.box, 0xb08050, P.L(-0.75, 0.35, 0, 0.7, 0.7, 0.7, 0, r()));
    put(b, T.cyl8, 0x8a5a38, P.L(-0.8, 0.35, 1.0, 0.3, 0.7, 0.3));
    netPile(ctx, P.sub(0.6, 0, 0.2, 0));
    ropeCoil(ctx, E, 0.4, -0.8, 0.8);
    // Fishing rod: stuck in at the pier's edge, with the line hanging into the water
    const rodBase = E.p(-1.1, 0.1, -2.2);
    const tip = E.p(-3.0, 2.2, -1.6);
    rod(b, rodBase, tip, 0.025, 0x6a4a30, T.cyl4, false);
    rod(b, tip, V(tip.x, -0.1, tip.z), 0.006, 0xe8e8e8, T.cyl4, false);
    put(b, T.sphere, 0xff4a3a, MX(tip.x, 0.05, tip.z, 0.06, 0.06, 0.06), false);
    put(b, T.pot, 0xc8a870, E.L(-0.9, 0.2, -2.8, 0.25, 0.4, 0.25));
    ctx.solids.add(ex + nx * 0.9, ez + nz * 0.9, 0.3);
    ctx.solids.add(ex - nx * 0.9, ez - nz * 0.9, 0.3);
    // Boats: tied on both sides of the pier
    mooredBoat(ctx, ex + nx * 2.8 - (dx / l) * 2, ez + nz * 2.8 - (dz / l) * 2, heading + 0.08, k ? 0xd8553f : 0x2f6aa8, 0xfff2d8, 1.25);
    cb.bob = r() * 6;
    rowboat(cb, new THREE.Matrix4().compose(V(ex - nx * 2.6 - (dx / l) * 5.5, -0.25, ez - nz * 2.6 - (dz / l) * 5.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, heading + Math.PI - 0.1, 0)), V(1, 1, 1)), k ? 0x2a9a8a : 0xf2c24a, 1.1);
    cb.bob = r() * 6;
    rowboat(cb, new THREE.Matrix4().compose(V(ex - nx * 2.4 - (dx / l) * 1.2, -0.25, ez - nz * 2.4 - (dz / l) * 1.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, heading - 0.15, 0)), V(1, 1, 1)), HULLS[(k + 4) % HULLS.length], 0.9);
  });
  // Stilt houses: a platform and small house held up by wooden piles, built at the edge of the anchorage
  for (const [x, z, f, v] of [[-32.8, 56.5, Math.PI, 1], [-45.5, 58.5, Math.PI - 0.3, 2], [-18.5, 58, Math.PI + 0.2, 0]] as const) stiltHouse(ctx, x, z, f, v, cb, out);
  // A fish-drying line strung between the two stilt houses
  {
    const a = V(-34.9, 3.9, 56.5);
    const c = V(-43.4, 3.9, 57.9);
    const pts = rope(b, a, c, 0.5, 0.015, 0xc8b48a, 8);
    for (let i = 1; i < pts.length - 1; i++) put(b, T.oct, i % 2 ? 0xc8a878 : 0xb89868, MX(pts[i].x, pts[i].y - 0.25, pts[i].z, 0.09, 0.32, 0.05, 0, r()), false);
  }
  // Net-drying and fish-drying racks (on the shore of the fishing harbor)
  for (const [x, z, f] of [[-34, 66.5, 0.3], [-44, 64, -0.2], [-22.5, 62.8, 0.1]] as const) netRack(ctx, x, z, f);
  smokehouse(ctx, -35, 71, 0.4, out);
  // Shipbuilding slip: a boat's frame resting on the beach, with paint buckets and tools beside the boat
  {
    const x = -40;
    const z = 69.5;
    const y = ctx.place(x, z, 3);
    b.lift = 0;
    const F = new Frame(x, y, z, 0.9);
    put(b, T.box, WOOD_D, F.L(0, 0.4, 0, 0.3, 0.3, 7.5));
    for (let i = 0; i < 7; i++) {
      const zz = -3 + i;
      const w = 1.2 + Math.sin((i / 6) * Math.PI) * 0.9;
      b.add(new THREE.TorusGeometry(w, 0.08, 4, 10, Math.PI), 0xc49564, F.L(0, 1.4, zz, 1, 1, 1, 0, 0, Math.PI));
    }
    // A few hull planks already nailed on
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) put(b, T.box, 0x9a6c46, F.L(s * (1.55 - i * 0.35), 0.95 + i * 0.35, -0.5, 0.06, 0.28, 4.6, 0, 0, s * (0.5 + i * 0.3)));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) put(b, T.box, WOOD_D, F.L(s * 2.3, 0.45, -2.5 + i * 2.5, 0.2, 0.9, 0.2));
    put(b, T.cyl8, 0x2f6aa8, F.L(2.9, 0.22, 1.5, 0.2, 0.44, 0.2));
    put(b, T.cyl8, 0xe8443a, F.L(3.2, 0.22, 1.9, 0.2, 0.44, 0.2));
    put(b, T.box, PLANK, F.L(2.6, 0.08, -1.2, 0.3, 0.1, 2.4, 0, 0.3), false);
    put(b, T.box, PLANK, F.L(2.9, 0.18, -1.0, 0.3, 0.1, 2.4, 0, 0.1), false);
    ctx.solids.add(x, z, 3.2);
  }
  if (!cb.empty) {
    const { tick } = cb.build(ctx.group, ctx.disposers, 0.04);
    ctx.extras.push((_dt, t) => tick(t));
  }
  // A small boat turned over on the beach, an anchor
  for (const [x, z, a] of [[-12, 97, 0.4], [18, 94, -0.3], [-30, 95, 1.2]] as const) {
    if (ctx.solids.blocked(x, z, 1.4)) continue;
    const y = ctx.place(x, z, 1.5);
    if (y < 0.1) continue;
    b.lift = 0;
    const g = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(0.9, 0.55, 2.0);
    b.add(g, HULLS[Math.floor(r() * 3)], M(x, y + 0.05, z, a));
    // A pair of oars beside the boat
    put(b, T.box, PLANK, MX(x + Math.cos(a) * 1.2, y + 0.05, z - Math.sin(a) * 1.2, 0.08, 0.05, 2.0, 0, a + 0.2), false);
    ctx.solids.add(x, z, 1.4);
  }
  {
    const x = -24;
    const z = 69.5;
    const y = ctx.place(x, z, 1);
    b.lift = 0;
    anchor(ctx, new Frame(x, y, z, 0.25), 1.05);
    ctx.solids.add(x, z, 0.8);
  }
  boathouse(ctx, -24, 95.5, 0);
  // Shells and reef rocks on the beach, coconut palms
  for (let i = 0; i < 60; i++) {
    const x = -48 + r() * 80;
    const z = 88 + r() * 12;
    const hh = ctx.h(x, z);
    if (hh < 0.05 || hh > 1.1 || !ctx.clear(x, z, 0) || ctx.solids.blocked(x, z, 0.5)) continue;
    ctx.place(x, z);
    if (i % 6 === 0) reefRock(b, x, z, 0.8 + r() * 0.6, r);
    else shell(b, x, z, r);
  }
  for (let i = 0; i < 14; i++) {
    const x = -50 + r() * 90;
    const z = 90 + r() * 8;
    const hh = ctx.h(x, z);
    if (hh < 0.15 || hh > 1.4 || !ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1.5)) continue;
    ctx.place(x, z, 0.3);
    palm(b, x, z, 1.5 + r() * 0.6, Math.PI / 2 + (r() - 0.5) * 0.8, r);
    ctx.solids.add(x, z, 0.5);
  }
  b.lift = 0;
  void STONE;
  void STONE_D;
  void boat;
}

export function buildPort(ctx: FieldCtx, out: HouseOut): void {
  quay(ctx, out);
  westHarbor(ctx, out);
}
