// Tidesong Isles: small scenes scattered over the islands.
// The fishermen's camp on the east shore of Palm Grove Isle (a thatched pavilion, hammocks, outrigger canoes, drying coconut),
// the Black Sail Order camp by the ice bay and the black-sailed fast ship in the open sea (after purification the people
// leave an empty camp and the ship is gone too),
// and the Tidesong Festival after purification (strings of lanterns in town, wreaths on the doors,
// water lanterns in the harbor, fireworks, the Sacred Whale leaping out of the sea).
import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';
import { ColorBatch, flagGeo, gulls } from './fx.ts';
import { solidPalm } from './flora.ts';
import { PLANK, WINDOW, WOOD, WOOD_D } from './houses.ts';
import { Frame, MX, put, putGlow, rod, rope, T, V } from './parts.ts';
import type { WildOut } from './south.ts';
import { BASIN, TOWN, WHALE_HEAD, WHALE_TAIL } from './terrain.ts';
import { boat } from './town.ts';

const STRAW = 0xd8b46a;
const STRAW_D = 0xb8904a;
const CULT_BLACK = 0x2a2436;
const CULT_PURPLE = 0x6a3a8a;
const CULT_GLOW = 0xc070ff;
const WH = 0x3f5f84;
const WB = 0xc8d8e4;

/** Can something that blocks the way be placed here: not on a road, not overlapping existing colliders, and not standing on water */
function free(ctx: FieldCtx, x: number, z: number, r: number, path = 3.2): boolean {
  return !ctx.solids.blocked(x, z, r) && ctx.pathDist(x, z) > path && ctx.h(x, z) > 0.05;
}

// ───────────────────────── The fishermen's camp on Palm Grove Isle ─────────────────────────

/** Thatched pavilion: four posts, a two-tier thatched roof, hanging straw tassels, with a low table beneath */
function palapa(ctx: FieldCtx, x: number, z: number, face: number, out: WildOut): void {
  const { b, r } = ctx;
  const y = ctx.h(x, z);
  b.lift = 0;
  const F = new Frame(x, y, z, face);
  const H = 2.5;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    put(b, T.cyl6, WOOD, F.L(sx * 1.55, H / 2 - 0.1, sz * 1.55, 0.11, H + 0.2, 0.11, (r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.04));
    ctx.solids.add(F.p(sx * 1.55, 0, sz * 1.55).x, F.p(sx * 1.55, 0, sz * 1.55).z, 0.25);
  }
  // Roof: a square pyramid with a smaller one stacked on top, and a ring of straw tassels along the edge
  put(b, T.cone4, STRAW, F.L(0, H + 0.75, 0, 2.75, 1.6, 2.75, 0, Math.PI / 4, 0));
  put(b, T.cone4, STRAW_D, F.L(0, H + 1.5, 0, 1.3, 0.9, 1.3, 0, Math.PI / 4 + 0.1, 0));
  put(b, T.cyl4, 0x8a6a3a, F.L(0, H + 2.05, 0, 0.08, 0.35, 0.08), false);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    // Edge of the square eaves: tassels spaced evenly along the four sides
    const side = Math.floor((a + Math.PI / 4) / (Math.PI / 2)) % 4;
    const t = ((a + Math.PI / 4) % (Math.PI / 2)) / (Math.PI / 2) - 0.5;
    const e = 1.95;
    const [lx, lz] = [[e, t * 2 * e], [-t * 2 * e, e], [-e, -t * 2 * e], [t * 2 * e, -e]][side];
    put(b, T.blade, i % 3 ? STRAW : STRAW_D, F.L(lx, H - 0.05 + r() * 0.1, lz, 0.35, 0.4 + r() * 0.25, 0.35, Math.PI, a), false);
  }
  // Crossbeams
  for (const s of [-1, 1]) {
    put(b, T.box, WOOD_D, F.L(0, H, s * 1.55, 3.4, 0.14, 0.14), false);
    put(b, T.box, WOOD_D, F.L(s * 1.55, H, 0, 0.14, 0.14, 3.4), false);
  }
  // Low table, cushions, coconut bowls
  put(b, T.cyl8, PLANK, F.L(0, 0.42, 0, 0.75, 0.08, 0.75));
  put(b, T.cyl6, WOOD_D, F.L(0, 0.2, 0, 0.12, 0.4, 0.12), false);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4;
    put(b, T.cyl8, [0xe85a4a, 0x3a9ad8, 0xf0c84a][i], F.L(Math.cos(a) * 1.05, 0.08, Math.sin(a) * 1.05, 0.38, 0.14, 0.38), false);
  }
  put(b, T.dome, 0x6a4a2a, F.L(0.2, 0.47, 0.1, 0.18, 0.12, 0.18, Math.PI), false);
  put(b, T.dome, 0xf4ecd8, F.L(-0.25, 0.47, -0.1, 0.15, 0.06, 0.15), false);
  // Lanterns and shell wind chimes under the eaves
  rod(b, F.p(0.9, H, 0.9), F.p(0.9, H - 0.45, 0.9), 0.015, 0x3a3a3a, T.cyl4, false);
  putGlow(b, T.sphere, WINDOW, F.L(0.9, H - 0.6, 0.9, 0.16, 0.2, 0.16));
  put(b, T.cyl6, 0x5a3a24, F.L(0.9, H - 0.42, 0.9, 0.12, 0.05, 0.12), false);
  const lp = F.p(0.9, H - 0.6, 0.9);
  out.lights.push([lp.x, lp.y, lp.z, 1.2]);
  for (let k = 0; k < 5; k++) put(b, T.cone5, 0xfff1e2, F.L(-0.9, H - 0.25 - k * 0.2, 0.9 + (k % 2) * 0.08, 0.07, 0.15, 0.07, Math.PI), false);
}

/** A striped hammock between two coconut palms */
function hammock(ctx: FieldCtx, ax: number, az: number, cx: number, cz: number): void {
  const { b } = ctx;
  const d = Math.hypot(cx - ax, cz - az);
  const a = V(ax, ctx.h(ax, az) + 1.25, az);
  const c = V(cx, ctx.h(cx, cz) + 1.25, cz);
  const pts = rope(b, a, c, 0.75, 0.02, 0xd8c8a0, 10);
  // Cloth: the middle 70% is colored horizontal strips of cloth, with both ends gathering into ropes
  const ang = Math.atan2(cx - ax, cz - az);
  const cols = [0xe85a4a, 0xf5e0b0, 0x3a9ad8, 0xf5e0b0];
  for (let i = 2; i < 8; i++) {
    const p = pts[i].clone().lerp(pts[i + 1], 0.5);
    const tilt = Math.atan2(pts[i + 1].y - pts[i].y, d / 10);
    const w = 0.35 + Math.sin(((i - 1.5) / 7) * Math.PI) * 0.5;
    put(b, T.box, cols[i % 4], new Frame(p.x, p.y - 0.03, p.z, ang).L(0, 0, 0, w, 0.04, d / 10 + 0.02, -tilt), false);
  }
  // Rope loops tied around the trunks
  for (const p of [a, c]) put(b, T.cyl8, 0xd8c8a0, MX(p.x, p.y, p.z, 0.2, 0.08, 0.2), false);
}

/** An outrigger canoe set on the sand: hull, float, two crossbars, a paddle */
function outrigger(ctx: FieldCtx, x: number, z: number, face: number, hull: number): void {
  const { b, r } = ctx;
  const y = ctx.h(x, z);
  const F = new Frame(x, y, z, face);
  put(b, T.sphere12, hull, F.L(0, 0.22, 0, 0.42, 0.34, 2.5));
  put(b, T.sphere12, 0x5a3a24, F.L(0, 0.4, 0, 0.3, 0.1, 2.1), false);
  put(b, T.box, 0xf5e0b0, F.L(0, 0.46, 0, 0.62, 0.035, 2.2), false);
  put(b, T.cone6, hull, F.L(0, 0.35, 2.55, 0.14, 0.45, 0.14, 1.2), false);
  put(b, T.cone6, hull, F.L(0, 0.35, -2.55, 0.14, 0.45, 0.14, -1.2), false);
  // Painted patterns on the side of the boat
  for (const s of [-1, 1]) put(b, T.box, 0xf0c84a, F.L(s * 0.41, 0.3, 0, 0.02, 0.06, 3.2), false);
  put(b, T.sphere, 0xa8844a, F.L(1.5, 0.12, 0, 0.12, 0.1, 1.5));
  for (const zz of [-0.8, 0.8]) {
    rod(b, F.p(0, 0.48, zz), F.p(1.55, 0.2, zz), 0.035, WOOD_D, T.cyl4, false);
  }
  // The paddle leans against the gunwale
  const pa = F.p(-0.5, 0.05, -1.2 + r() * 0.4);
  const pc = F.p(-0.2, 0.55, 0.6);
  rod(b, pa, pc, 0.03, WOOD, T.cyl4, false);
  put(b, T.box, WOOD, MX(pa.x, pa.y + 0.05, pa.z, 0.2, 0.03, 0.45, 0, face + 0.2), false);
  ctx.solids.add(x, z, 1.0);
}

/** Rack for drying coconut: a low bamboo frame laid with split coconuts */
function copraRack(ctx: FieldCtx, x: number, z: number, face: number): void {
  const { b, r } = ctx;
  const F = new Frame(x, ctx.h(x, z), z, face);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) put(b, T.cyl5, WOOD, F.L(sx * 1.1, 0.35, sz * 0.55, 0.05, 0.7, 0.05), false);
  for (let i = 0; i < 9; i++) put(b, T.cyl4, 0xc8b070, F.L(0, 0.7, -0.55 + i * 0.137, 0.04, 2.4, 0.04, 0, 0, Math.PI / 2), false);
  for (let i = 0; i < 14; i++) {
    const lx = -0.9 + (i % 7) * 0.3 + (r() - 0.5) * 0.06;
    const lz = i < 7 ? -0.25 : 0.25;
    put(b, T.dome, 0x7a5030, F.L(lx, 0.74, lz, 0.13, 0.07, 0.13, Math.PI), false);
    put(b, T.disc, 0xfaf4e4, F.L(lx, 0.745, lz, 0.1, 1, 0.1), false);
  }
  // A pile of whole coconuts and a basket beside it
  for (let i = 0; i < 6; i++) put(b, T.sphere, i % 2 ? 0x6a8a3a : 0x7a5a30, F.L(1.7 + (r() - 0.5) * 0.6, 0.14 + (i > 3 ? 0.2 : 0), (r() - 0.5) * 0.6, 0.16, 0.14, 0.16));
  put(b, T.pot, 0xc8a060, F.L(-1.7, 0.22, 0.2, 0.3, 0.44, 0.3));
  put(b, T.ring, 0xa88040, F.L(-1.7, 0.44, 0.2, 0.3, 0.3, 0.3, Math.PI / 2), false);
  ctx.solids.add(x, z, 1.1);
}

/** A campfire ringed by stones: charred wood, a tripod for roasting fish, giving off thin smoke */
function firePit(ctx: FieldCtx, x: number, z: number, out: WildOut): THREE.Vector3 {
  const { b, r } = ctx;
  const y = ctx.h(x, z);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    put(b, T.dode0, [0x8a8e96, 0x9aa0a8, 0x7a7e86][i % 3], MX(x + Math.cos(a) * 0.62, y + 0.1, z + Math.sin(a) * 0.62, 0.2, 0.16, 0.2, r(), r() * 6, r()));
  }
  put(b, T.disc, 0x3a3230, MX(x, y + 0.03, z, 0.55, 1, 0.55), false);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + r() * 0.3;
    rod(b, V(x + Math.cos(a) * 0.4, y + 0.06, z + Math.sin(a) * 0.4), V(x - Math.cos(a) * 0.1, y + 0.3, z - Math.sin(a) * 0.1), 0.06, 0x3a2a22, T.cyl5, false);
  }
  putGlow(b, T.cone5, 0xffa040, MX(x, y + 0.35, z, 0.22, 0.45, 0.22));
  putGlow(b, T.cone5, 0xffe070, MX(x + 0.05, y + 0.3, z, 0.12, 0.3, 0.12, 0, 0.6));
  // The tripod and the fish skewered on it
  const top = V(x, y + 1.3, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    rod(b, V(x + Math.cos(a) * 0.85, y, z + Math.sin(a) * 0.85), top, 0.035, WOOD_D, T.cyl4, false);
  }
  rod(b, top, V(x, y + 0.85, z), 0.012, 0x3a3a3a, T.cyl4, false);
  put(b, T.sphere, 0x9aa8b8, MX(x, y + 0.72, z, 0.08, 0.26, 0.05));
  put(b, T.cone4, 0x9aa8b8, MX(x, y + 0.45, z, 0.08, 0.12, 0.02, Math.PI), false);
  // Two sitting logs around the fire
  for (const a of [0.9, 2.6]) put(b, T.cyl6, WOOD, MX(x + Math.cos(a) * 1.6, y + 0.18, z + Math.sin(a) * 1.6, 0.2, 1.3, 0.2, 0, -a + Math.PI / 2, Math.PI / 2));
  ctx.solids.add(x, z, 0.8);
  out.lights.push([x, y + 0.5, z, 1.4]);
  return V(x, y + 0.6, z);
}

function palmCamp(ctx: FieldCtx, out: WildOut, smoke: THREE.Vector3[]): void {
  const { r, low } = ctx;
  // Outside the creature spawn area (Palm Grove Isle r 13), on the gentle slope north of the boardwalk
  if (free(ctx, 18, 20, 2.4)) palapa(ctx, 18, 20, -0.5, out);
  if (free(ctx, 15.5, 22.5, 1.4)) smoke.push(firePit(ctx, 15.5, 22.5, out));
  if (free(ctx, 21.5, 17.5, 1.5)) copraRack(ctx, 21.5, 17.5, 0.3);
  // Hammock: two coconut palms leaning outward
  const A: [number, number] = [14.2, 25.6];
  const C: [number, number] = [17.4, 27.4];
  if (free(ctx, A[0], A[1], 0.8) && free(ctx, C[0], C[1], 0.8)) {
    const ang = Math.atan2(C[1] - A[1], C[0] - A[0]);
    solidPalm(ctx, A[0], A[1], 1.45, ang + Math.PI, 0.6);
    solidPalm(ctx, C[0], C[1], 1.35, ang, 0.6);
    ctx.b.lift = 0;
    hammock(ctx, A[0], A[1], C[0], C[1]);
  }
  // Canoe hauled ashore
  const canoes: [number, number, number, number][] = [
    [20.2, 23.6, 1.25, 0xb8744a],
    [18.6, 29.6, 1.05, 0x3a9ad8],
  ];
  for (const [x, z, f, c] of canoes) if (free(ctx, x, z, 1.2, 2.5)) outrigger(ctx, x, z, f, c);
  // Fishing nets drying on poles
  if (!low && free(ctx, 23, 21, 1.4)) {
    const { b } = ctx;
    const y = ctx.h(23, 21);
    const a = V(22, y + 1.8, 20.2);
    const c = V(24.2, y + 1.8, 21.8);
    rod(b, V(a.x, y, a.z), a, 0.05, WOOD, T.cyl5);
    rod(b, V(c.x, y, c.z), c, 0.05, WOOD, T.cyl5);
    const pts = rope(b, a, c, 0.35, 0.02, 0xd8c8a0, 6);
    for (let i = 0; i < 6; i++) {
      const p = pts[i].clone().lerp(pts[i + 1], 0.5);
      put(b, T.box, 0x7a8a6a, MX(p.x, p.y - 0.55, p.z, 0.45, 1.1 - Math.sin((i / 5) * Math.PI) * 0.25, 0.03, 0, -Math.atan2(c.z - a.z, c.x - a.x), 0), false);
      if (i % 2) put(b, T.sphere, 0xff8a3a, MX(p.x, p.y - 1.1, p.z, 0.1, 0.1, 0.1), false);
    }
    ctx.solids.add(a.x, a.z, 0.3);
    ctx.solids.add(c.x, c.z, 0.3);
  }
  // Small things around the camp: water jars, fish baskets hung to dry, fish spears stuck upside down in the sand
  const { b } = ctx;
  for (const [x, z] of [[19.8, 21.8], [16.6, 19.4]] as const) {
    if (!free(ctx, x, z, 0.5, 2.5)) continue;
    const y = ctx.h(x, z);
    put(b, T.taper8, 0xb86a4a, MX(x, y + 0.3, z, 0.28, 0.6, 0.28));
    put(b, T.cyl8, 0x9a5a3a, MX(x, y + 0.62, z, 0.16, 0.08, 0.16), false);
    ctx.solids.add(x, z, 0.35);
  }
  for (let i = 0; i < 3; i++) {
    const x = 21.2 + i * 0.3;
    const z = 25.8 - i * 0.2;
    const y = ctx.h(x, z);
    rod(b, V(x, y - 0.1, z), V(x + 0.15, y + 1.9, z - 0.1 + r() * 0.2), 0.022, WOOD_D, T.cyl4, false);
    put(b, T.cone4, 0xb0b8c0, MX(x + 0.16, y + 2.0, z, 0.04, 0.2, 0.04), false);
  }
  gulls(ctx, 20, 12, 24, low ? 2 : 4, 5, 9, 0.12);
}

// ───────────────────────── The Order's camp by the ice bay ─────────────────────────

/** Black tent: a square-pyramid tent, purple trim, a sigil at the door; after purification it collapses into a heap */
function cultTent(ctx: FieldCtx, x: number, z: number, face: number, gone: boolean, out: WildOut): void {
  const { b, r } = ctx;
  const y = ctx.h(x, z);
  const F = new Frame(x, y, z, face);
  if (gone) {
    // Crushed by wind and snow, half buried in the snow
    put(b, T.cone4, CULT_BLACK, F.L(0, 0.3, 0, 2.2, 0.6, 1.9, 0.12, Math.PI / 4, 0.08));
    put(b, T.dome, 0xf4faff, F.L(0.3, 0.4, -0.2, 1.4, 0.35, 1.0), false);
    rod(b, F.p(-0.5, 0.1, 1.6), F.p(1.8, 0.35, -1.2), 0.05, WOOD_D, T.cyl4, false);
    ctx.solids.add(x, z, 1.5);
    return;
  }
  put(b, T.cone4, CULT_BLACK, F.L(0, 1.2, 0, 1.9, 2.4, 1.9, 0, Math.PI / 4, 0));
  put(b, T.cyl4, CULT_PURPLE, F.L(0, 0.35, 0, 1.72, 0.2, 1.72, 0, Math.PI / 4, 0), false);
  // Door flap and the eye-shaped sigil on the door
  put(b, T.prism, 0x14101c, F.L(0, 0.02, 1.2, 0.95, 1.35, 0.06, -0.51), false);
  putGlow(b, T.ring, CULT_GLOW, F.L(0, 1.55, 0.72, 0.2, 0.12, 0.2, -0.51));
  putGlow(b, T.sphere, CULT_GLOW, F.L(0, 1.55, 0.74, 0.06, 0.06, 0.03, -0.51));
  // The pole and small flag on top
  put(b, T.cyl4, WOOD_D, F.L(0, 2.6, 0, 0.04, 0.7, 0.04), false);
  out.flags.push(flagGeo(0.6, 0.28, CULT_PURPLE, false, true, F.L(0, 2.82, 0, 1, 1, 1, 0, r() * 0.4)));
  // Tent pegs and guy ropes
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const top = F.p(Math.cos(a) * 0.55, 1.75, Math.sin(a) * 0.55);
    const peg = F.p(Math.cos(a) * 2.5, 0.05, Math.sin(a) * 2.5);
    rod(b, top, peg, 0.012, 0x5a5060, T.cyl4, false);
    put(b, T.cyl4, WOOD_D, MX(peg.x, peg.y + 0.1, peg.z, 0.04, 0.25, 0.04), false);
  }
  // Snow drifts beside the tent
  put(b, T.dome, 0xf4faff, F.L(-1.2, 0, -1.1, 0.7, 0.25, 0.5), false);
  ctx.solids.add(x, z, 1.6);
}

/** The Order's long banner: a tall pole, a crossbar, a purple-black long banner hanging down; when fallen it lies on the ice */
function cultBanner(ctx: FieldCtx, x: number, z: number, face: number, fallen: boolean, out: WildOut): void {
  const { b } = ctx;
  const y = ctx.h(x, z);
  const F = new Frame(x, y, z, face);
  if (fallen) {
    rod(b, F.p(0, 0.08, 0), F.p(0, 0.2, 3.8), 0.07, WOOD_D, T.cyl6);
    put(b, T.box, CULT_PURPLE, F.L(0.45, 0.06, 2.6, 0.8, 0.03, 1.9, 0, 0.1), false);
    put(b, T.dome, 0xf4faff, F.L(0.4, 0.02, 2.2, 0.5, 0.15, 0.7), false);
    return;
  }
  put(b, T.cyl6, WOOD_D, F.L(0, 2, 0, 0.07, 4, 0.07));
  put(b, T.cyl4, WOOD_D, F.L(0, 3.85, 0, 0.04, 1.1, 0.04, 0, 0, Math.PI / 2), false);
  putGlow(b, T.oct, CULT_GLOW, F.L(0, 4.15, 0, 0.14, 0.22, 0.14));
  out.flags.push(flagGeo(0.95, 2.4, CULT_PURPLE, true, false, F.L(0, 3.82, 0.02)));
  out.flags.push(flagGeo(0.5, 1.6, CULT_BLACK, true, false, F.L(0, 3.8, -0.03)));
  put(b, T.cyl8, 0x4a4450, F.L(0, 0.15, 0, 0.3, 0.3, 0.3));
  ctx.solids.add(x, z, 0.35);
}

function cultCamp(ctx: FieldCtx, out: WildOut): THREE.Vector3 | null {
  const { b, low } = ctx;
  const purified = ctx.floors > 0 && ctx.done >= ctx.floors;
  const cracked = !purified && ctx.floors > 0 && ctx.done >= ctx.floors / 2;
  const [cx, cz] = [-24, -80.5];
  // The tents ring a ritual circle, with all the doors facing the trapped Sacred Whale
  const tents: [number, number, number][] = [
    [cx - 3.5, cz + 3.4, -2.2],
    [cx + 3.6, cz + 2.8, -2.8],
    [cx + 0.6, cz + 6.2, -2.6],
  ];
  for (const [x, z, f] of tents) if (free(ctx, x, z, 1.8)) cultTent(ctx, x, z, f, purified, out);
  // Long banners: after half the purification only half are still standing, and after full purification all have fallen
  const banners: [number, number, number][] = [
    [cx - 5.6, cz - 1.2, 0.4],
    [cx + 5.2, cz - 2.0, -0.3],
    [cx - 1.5, cz - 3.4, 0.1],
    [cx + 2.2, cz + 9.6, 1.2],
  ];
  banners.forEach(([x, z, f], i) => {
    if (!free(ctx, x, z, 0.5)) return;
    cultBanner(ctx, x, z, f, purified || (cracked && i % 2 === 1), out);
  });
  // Ritual circle: a ring of glowing runes on the ice and a black obelisk in the middle
  const y = ctx.h(cx, cz);
  const rune = purified ? 0x6a6070 : CULT_GLOW;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = MX(cx + Math.cos(a) * 2.4, y + 0.03, cz + Math.sin(a) * 2.4, 0.5, 0.02, 0.12, 0, -a + (i % 2) * 0.8, 0);
    if (purified) put(b, T.box, rune, m, false);
    else putGlow(b, T.box, rune, m);
  }
  put(b, T.ring, purified ? 0x5a5060 : CULT_PURPLE, MX(cx, y + 0.02, cz, 2.4, 2.4, 0.6, Math.PI / 2), false);
  if (purified) {
    // The obelisk is pushed over, broken in two
    put(b, T.cone4, CULT_BLACK, MX(cx + 0.6, y + 0.3, cz, 0.35, 1.6, 0.35, 0, 0, Math.PI / 2 - 0.1));
    put(b, T.box, CULT_BLACK, MX(cx - 0.5, y + 0.25, cz + 0.3, 0.5, 0.5, 0.5, 0.3, 0.5, 0.2));
  } else {
    put(b, T.box, CULT_BLACK, MX(cx, y + 0.25, cz, 0.7, 0.5, 0.7));
    put(b, T.cone4, CULT_BLACK, MX(cx, y + 1.6, cz, 0.35, 2.4, 0.35, 0, Math.PI / 4, 0));
    putGlow(b, T.box, CULT_GLOW, MX(cx, y + 1.5, cz + 0.2, 0.04, 1.6, 0.02, 0.07));
    putGlow(b, T.box, CULT_GLOW, MX(cx + 0.2, y + 1.5, cz, 0.02, 1.6, 0.04, 0, 0, -0.07));
    out.lights.push([cx, y + 2.2, cz, 1.8]);
  }
  ctx.solids.add(cx, cz, 0.8);
  // Supplies: crates, barrels, chains
  const crates: [number, number][] = [[cx + 6.4, cz + 5.6], [cx - 6.8, cz + 4.2], [cx + 4.6, cz + 7.4]];
  crates.forEach(([x, z], i) => {
    if (!free(ctx, x, z, 1.2)) return;
    const gy = ctx.h(x, z);
    const tip = purified ? 0.5 : 0;
    put(b, T.box, 0x3a3040, MX(x, gy + 0.4, z, 0.8, 0.8, 0.8, tip * 0.4, i, tip));
    put(b, T.box, CULT_PURPLE, MX(x, gy + 0.4, z, 0.84, 0.12, 0.84, tip * 0.4, i, tip), false);
    if (!purified) {
      put(b, T.box, 0x4a4050, MX(x + 0.2, gy + 1.05, z - 0.1, 0.55, 0.5, 0.55, 0, i + 0.4));
      putGlow(b, T.ring, CULT_GLOW, MX(x + 0.2, gy + 1.05, z - 0.1 + 0.28, 0.12, 0.12, 0.1, 0, i + 0.4));
    }
    put(b, T.cyl8, 0x4a3a44, MX(x - 0.9, gy + 0.45, z + 0.3, 0.3, 0.9, 0.3, purified ? Math.PI / 2 : 0, 0, 0));
    ctx.solids.add(x, z, 1.1);
  });
  // Brazier: purple fire; after purification it is overturned and extinguished
  const bx = cx - 2.4;
  const bz = cz - 5.6;
  let fire: THREE.Vector3 | null = null;
  if (free(ctx, bx, bz, 0.8)) {
    const gy = ctx.h(bx, bz);
    if (purified) {
      put(b, T.pot, 0x3a3440, MX(bx + 0.5, gy + 0.3, bz, 0.45, 0.35, 0.45, 0, 0, 1.4));
      for (let i = 0; i < 3; i++) rod(b, V(bx - 0.4 + i * 0.3, gy + 0.03, bz - 0.6), V(bx - 0.2 + i * 0.35, gy + 0.05, bz + 0.5), 0.03, 0x3a3440, T.cyl4, false);
    } else {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        rod(b, V(bx + Math.cos(a) * 0.5, gy, bz + Math.sin(a) * 0.5), V(bx, gy + 0.85, bz), 0.035, 0x3a3440, T.cyl4, false);
      }
      put(b, T.pot, 0x3a3440, MX(bx, gy + 0.95, bz, 0.45, 0.3, 0.45));
      putGlow(b, T.cone5, CULT_GLOW, MX(bx, gy + 1.35, bz, 0.3, 0.6, 0.3));
      putGlow(b, T.cone5, 0xf0c8ff, MX(bx, gy + 1.25, bz, 0.15, 0.35, 0.15, 0, 0.5));
      out.lights.push([bx, gy + 1.4, bz, 1.6]);
      fire = V(bx, gy + 1.5, bz);
    }
    ctx.solids.add(bx, bz, 0.6);
  }
  // Telescope: mounted on a tripod, aimed at the Sacred Whale in the ice
  const sx = cx - 6.5;
  const sz = cz - 5.5;
  if (!low && free(ctx, sx, sz, 0.8)) {
    const gy = ctx.h(sx, sz);
    const top = V(sx, gy + 1.3, sz);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      rod(b, V(sx + Math.cos(a) * 0.45, gy, sz + Math.sin(a) * 0.45), top, 0.025, WOOD_D, T.cyl4, false);
    }
    const dir = Math.atan2(-27 - sx, -96 - sz);
    put(b, T.cyl8, 0x8a6a3a, new Frame(sx, gy, sz, dir).L(0, 1.42, 0.2, 0.07, 0.9, 0.07, Math.PI / 2 - 0.15));
    ctx.solids.add(sx, sz, 0.45);
  }
  return fire;
}

/** The black-sailed fast ship in the open sea: one leaves after half the purification, and all are gone after full purification */
function cutters(ctx: FieldCtx): void {
  const purified = ctx.floors > 0 && ctx.done >= ctx.floors;
  const cracked = !purified && ctx.floors > 0 && ctx.done >= ctx.floors / 2;
  if (purified) return;
  const list: [number, number, number][] = [
    [-72, -100, 0.7],
    [-58, -117, 1.3],
  ];
  list.slice(0, cracked ? 1 : 2).forEach(([x, z, heading], i) => {
    if (ctx.h(x, z) > -1) return;
    const cb = new ColorBatch();
    boat(cb, CULT_BLACK, 0x1c1824, 2.3);
    // The purple lamp at the bow and the long banner at the stern
    cb.add(new THREE.BoxGeometry(2.1, 0.12, 0.08), CULT_PURPLE, MX(0, 1.72, 1.4, 1, 1, 1));
    cb.add(new THREE.BoxGeometry(2.2, 0.12, 0.08), CULT_PURPLE, MX(0, 1.72, -2.6, 1, 1, 1));
    cb.add(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), WOOD_D, MX(0, 2.6, -3.3, 1, 1, 1));
    cb.add(new THREE.BoxGeometry(0.04, 1.3, 0.7), CULT_PURPLE, MX(0, 3.05, -3.7, 1, 1, 1));
    const { group, tick } = cb.build(ctx.group, ctx.disposers, 0.05);
    group.position.set(x, ctx.waterLevel - 0.25, z);
    group.rotation.y = heading;
    ctx.b.lift = 0;
    putGlow(ctx.b, T.sphere, CULT_GLOW, MX(x + Math.sin(heading) * 4.3, 2.2, z + Math.cos(heading) * 4.3, 0.22, 0.22, 0.22));
    const ph = i * 2.3;
    ctx.extras.push((_dt, t) => {
      tick(t);
      group.position.y = ctx.waterLevel - 0.25 + Math.sin(t * 1.1 + ph) * 0.1;
      group.rotation.z = Math.sin(t * 0.8 + ph) * 0.06;
      group.rotation.x = Math.sin(t * 0.95 + ph * 1.7) * 0.03;
    });
  });
}

// ───────────────────────── The Tidesong Festival after purification ─────────────────────────

const LANTERN = [0xff5a4a, 0xffb040, 0xffe070, 0xff7ab0];

/** A string of paper lanterns: a hanging rope with glowing round lamps one by one */
function lanternString(ctx: FieldCtx, a: THREE.Vector3, c: THREE.Vector3, n: number, out: WildOut, sag = 0.9): void {
  const { b } = ctx;
  const pts = rope(b, a, c, sag, 0.02, 0x3a3440, Math.max(4, Math.round(n / 2)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = a.clone().lerp(c, t);
    p.y -= Math.sin(t * Math.PI) * sag + 0.28;
    putGlow(b, T.sphere, LANTERN[i % 4], MX(p.x, p.y, p.z, 0.2, 0.24, 0.2));
    put(b, T.cyl6, 0x3a3440, MX(p.x, p.y + 0.24, p.z, 0.08, 0.05, 0.08), false);
    put(b, T.cone4, 0xc0443a, MX(p.x, p.y - 0.3, p.z, 0.03, 0.14, 0.03, Math.PI), false);
    if (i % 2 === 0) out.lights.push([p.x, p.y, p.z, 1.3]);
  }
  void pts;
}

/** Wreath: small flowers lined along a sagging line */
function garland(ctx: FieldCtx, a: THREE.Vector3, c: THREE.Vector3, n: number, sag: number): void {
  const { b, r } = ctx;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(c, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    put(b, T.ico0, i % 3 ? 0x3a8a3a : 0x2f7a34, MX(p.x, p.y, p.z, 0.12, 0.1, 0.12, r(), r() * 6, 0), false);
    if (i % 2 === 0) put(b, T.oct, [0xff6a8a, 0xfff0d0, 0xffc83a, 0xff4a5a][(i / 2) % 4], MX(p.x + (r() - 0.5) * 0.12, p.y - 0.06, p.z + (r() - 0.5) * 0.12, 0.09, 0.07, 0.09, 0, r() * 3), false);
  }
}

function festival(ctx: FieldCtx, out: WildOut): void {
  const { b, r, low } = ctx;
  const [tx, tz] = TOWN;
  b.lift = 0;
  // Crossed lantern strings above the plaza (hung from the tops of the original four flagpoles)
  const poles: [number, number][] = [[tx - 10.5, tz - 1.5], [tx + 8.5, tz - 2.5], [tx + 6.6, tz + 6.4], [tx - 9.6, tz + 6.4]];
  const tops = poles.map(([x, z]) => V(x, ctx.h(x, z) + 6.2, z));
  lanternString(ctx, tops[0], tops[2], low ? 8 : 14, out, 1.4);
  lanternString(ctx, tops[1], tops[3], low ? 8 : 14, out, 1.4);
  lanternString(ctx, tops[0], tops[1], low ? 6 : 10, out, 0.8);
  // Tidebell Gate: the two posts wrapped in flowers, wreaths hanging from the crossbeam
  const [gx, gz] = [-3.6, 61.6];
  const gy = ctx.h(gx, gz);
  garland(ctx, V(gx - 2.9, gy + 4.9, gz + 0.35), V(gx + 2.9, gy + 4.9, gz + 0.35), low ? 18 : 34, 0.9);
  garland(ctx, V(gx - 2.9, gy + 4.9, gz - 0.35), V(gx + 2.9, gy + 4.9, gz - 0.35), low ? 12 : 24, 0.6);
  for (const s of [-1, 1]) {
    for (let i = 0; i < (low ? 8 : 16); i++) {
      const a = i * 1.1;
      const yy = gy + 0.6 + i * 0.28;
      put(b, i % 2 ? T.ico0 : T.oct, i % 2 ? 0x3a8a3a : [0xff6a8a, 0xffc83a][i % 4 === 0 ? 0 : 1], MX(gx + s * 2.9 + Math.cos(a) * 0.34, yy, gz + Math.sin(a) * 0.34, 0.1, 0.09, 0.1, 0, a), false);
    }
  }
  // Water lanterns floating in the harbor: a lotus-shaped base with a small lamp on top
  const n = low ? 16 : 40;
  let placed = 0;
  for (let i = 0; i < n * 4 && placed < n; i++) {
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(r());
    const x = BASIN.x + Math.cos(a) * BASIN.rx * k;
    const z = BASIN.z + Math.sin(a) * BASIN.rz * k;
    if (ctx.h(x, z) > -0.5 || ctx.solids.blocked(x, z, 0.6)) continue;
    const y = ctx.waterLevel + 0.04;
    for (let p = 0; p < 6; p++) put(b, T.blade, p % 2 ? 0xffd0e0 : 0xfff4f0, MX(x, y, z, 0.3, 0.3, 0.3, 1.0, (p / 6) * Math.PI * 2, 0), false);
    putGlow(b, T.cyl6, LANTERN[placed % 4], MX(x, y + 0.2, z, 0.1, 0.24, 0.1));
    if (placed % 2 === 0) out.lights.push([x, y + 0.3, z, 1.0]);
    placed++;
  }
  // More seagulls at the edge of town and at the harbor
  gulls(ctx, tx + 4, 18, tz - 4, low ? 3 : 6, 6, 12, -0.1);
}

/** The Sacred Whale leaping out of the sea after purification: the tail raised high and then slapped down, first spouting a jet of water */
function breachingWhale(ctx: FieldCtx): void {
  const [x, z] = [16, 43];
  if (ctx.h(x, z) > -1.2) return;
  const heading = 1.9;
  const cb = new ColorBatch();
  // Flukes: tail stock + two flat fins
  cb.add(new THREE.CylinderGeometry(0.35, 0.75, 3.2, 10), WH, MX(0, -1.6, 0, 1, 1, 1));
  for (const s of [-1, 1]) {
    const f = new THREE.SphereGeometry(1, 12, 6);
    f.scale(1.7, 0.16, 0.7);
    cb.add(f, WH, MX(s * 1.25, 0.2, 0.1, 1, 1, 1, 0, s * -0.35, s * 0.12));
    const u = new THREE.SphereGeometry(1, 10, 5);
    u.scale(1.5, 0.1, 0.55);
    cb.add(u, WB, MX(s * 1.2, 0.12, 0.25, 1, 1, 1, 0, s * -0.35, s * 0.12));
  }
  const back = new ColorBatch();
  const hump = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  hump.scale(2.6, 1.3, 7);
  back.add(hump, WH, MX(0, 0, 0, 1, 1, 1));
  back.add(new THREE.ConeGeometry(0.4, 0.8, 6), WH, MX(0, 1.3, -2.5, 1, 1, 1, -0.5));
  const tail = cb.build(ctx.group, ctx.disposers, 0.06);
  const body = back.build(ctx.group, ctx.disposers, 0.06);
  tail.group.rotation.order = 'YXZ';
  body.group.rotation.order = 'YXZ';
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const CYCLE = 15;
  let lastPhase = 0;
  ctx.extras.push((_dt, t, vfx) => {
    tail.tick(t);
    body.tick(t);
    const s = (t % CYCLE) / CYCLE;
    // Back: 0.05 -> 0.45 slides across the water from front to back
    const u = (s - 0.05) / 0.4;
    const bu = Math.max(0, Math.min(1, u));
    body.group.visible = u > 0 && u < 1;
    body.group.position.set(x + fx * (bu * 10 - 8), ctx.waterLevel - 1.4 + Math.sin(bu * Math.PI) * 1.5, z + fz * (bu * 10 - 8));
    body.group.rotation.set(-Math.cos(bu * Math.PI) * 0.25, heading, 0);
    // Flukes: 0.3 -> 0.6 lift, flip over, slap into the water
    const w = (s - 0.3) / 0.3;
    const tw = Math.max(0, Math.min(1, w));
    tail.group.visible = w > 0 && w < 1;
    tail.group.position.set(x - fx * 1, ctx.waterLevel - 2.6 + Math.sin(tw * Math.PI) * 4.6, z - fz * 1);
    tail.group.rotation.set(-0.9 + tw * 1.8, heading, 0);
    // Spray from the blowhole and the slap: only emitted when nearby
    const cp = vfx.camPos;
    const near = Math.hypot(cp.x - x, cp.z - z) < 110;
    if (near && lastPhase < 0.06 && s >= 0.06) {
      const blow = V(x - fx * 3.5, ctx.waterLevel + 0.6, z - fz * 3.5);
      vfx.emit({ pos: blow, count: 30, color: [0xffffff, 0xd8f6ff, 0xaee8ff], speed: [5, 8], dir: V(0, 1, 0), spread: 0.16, life: [0.9, 1.4], size: [0.22, 0.4], sizeEnd: 1.3, gravity: -7, intensity: 1.2 });
      vfx.smoke({ pos: blow.clone().setY(blow.y + 3.2), count: 3, color: [0xffffff, 0xeaf8ff], speed: [0.3, 0.8], dir: V(0, 1, 0), spread: 0.6, life: [1.5, 2.5], size: [1.0, 1.6], sizeEnd: 2.4, drag: 0.3 });
    }
    if (near && tail.group.visible && w > 0.2 && w < 0.8 && Math.random() < 0.5) {
      const p = tail.group.position;
      vfx.emit({ pos: V(p.x + (Math.random() - 0.5) * 3, p.y + 0.2, p.z), count: 1, color: [0xffffff, 0xd8f6ff], speed: [0.2, 0.6], dir: V(0, -1, 0), spread: 0.3, life: [0.6, 1.0], size: [0.12, 0.2], sizeEnd: 0.1, gravity: -9, intensity: 1.1 });
    }
    if (near && lastPhase < 0.58 && s >= 0.58) {
      vfx.emit({ pos: V(x - fx * 1, ctx.waterLevel + 0.2, z - fz * 1), count: 44, color: [0xffffff, 0xd8f6ff, 0xaee8ff], speed: [3, 7], dir: V(0, 1, 0), spread: 0.7, life: [0.7, 1.2], size: [0.25, 0.45], sizeEnd: 0.9, gravity: -9, intensity: 1.1 });
    }
    lastPhase = s;
  });
}

/** The Sacred Whale's song: after purification, glowing musical notes rise from the whale bones one by one */
function boneSong(ctx: FieldCtx): void {
  const [ax, az] = WHALE_TAIL;
  const [cx, cz] = WHALE_HEAD;
  let acc = 0;
  ctx.extras.push((dt, _t, vfx) => {
    const cp = vfx.camPos;
    const mx = (ax + cx) / 2;
    const mz = (az + cz) / 2;
    if (Math.hypot(cp.x - mx, cp.z - mz) > 55) return;
    acc += dt;
    if (acc < 0.12) return;
    acc = 0;
    const t = Math.random();
    const p = V(ax + (cx - ax) * t + (Math.random() - 0.5) * 3, ctx.h(ax + (cx - ax) * t, az + (cz - az) * t) + 1 + Math.random() * 3, az + (cz - az) * t + (Math.random() - 0.5) * 3);
    vfx.emit({ pos: p, count: 1, color: [0x9af0ff, 0xffe8a0, 0xffffff], speed: [0.4, 0.9], dir: V(0, 1, 0), spread: 0.4, life: [2.5, 3.5], size: [0.16, 0.26], sizeEnd: 0.4, intensity: 1.8 });
  });
}

/** Fireworks: after purification, one bursts above the town every few seconds */
function fireworks(ctx: FieldCtx): void {
  const [tx, tz] = TOWN;
  let next = 1.5;
  const cols = [[0xff5a4a, 0xffd070], [0x6ad8ff, 0xffffff], [0xff7ab0, 0xfff0d0], [0x8aff8a, 0xffe070]];
  ctx.extras.push((_dt, t, vfx) => {
    if (t < next) return;
    next = t + 2.2 + Math.random() * 2.5;
    const cp = vfx.camPos;
    if (Math.hypot(cp.x - tx, cp.z - (tz - 12)) > 120) return;
    const p = V(tx - 6 + (Math.random() - 0.5) * 30, 24 + Math.random() * 8, tz - 22 + (Math.random() - 0.5) * 14);
    vfx.emit({ pos: p, count: ctx.low ? 36 : 70, color: cols[Math.floor(Math.random() * cols.length)], speed: [5, 8], life: [1.1, 1.7], size: [0.3, 0.42], sizeEnd: 0.08, gravity: -3.5, drag: 0.6, intensity: 2.2 });
  });
}

// ───────────────────────── Public interface ─────────────────────────

export function buildCamps(ctx: FieldCtx): WildOut {
  const out: WildOut = { flags: [], lights: [] };
  const smoke: THREE.Vector3[] = [];
  const purified = ctx.floors > 0 && ctx.done >= ctx.floors;
  palmCamp(ctx, out, smoke);
  const fire = cultCamp(ctx, out);
  cutters(ctx);
  if (purified) {
    festival(ctx, out);
    breachingWhale(ctx);
    boneSong(ctx);
    fireworks(ctx);
  }
  ctx.b.lift = 0;
  // Campfire smoke and the purple sparks of the Order's braziers: only emitted near the camera
  let acc = 0;
  ctx.extras.push((dt, _t, vfx) => {
    acc += dt;
    if (acc < 0.35) return;
    acc = 0;
    const cp = vfx.camPos;
    for (const p of smoke) {
      if (Math.hypot(cp.x - p.x, cp.z - p.z) > 60) continue;
      vfx.smoke({ pos: p.clone(), count: 1, color: [0xd8d4cc, 0xeeeae4], speed: [0.4, 0.8], dir: V(0.1, 1, 0.05), spread: 0.15, life: [2.2, 3.2], size: [0.3, 0.5], sizeEnd: 1.8, drag: 0.3 });
    }
    if (fire && Math.hypot(cp.x - fire.x, cp.z - fire.z) < 60) {
      vfx.emit({ pos: fire.clone(), count: 2, color: [CULT_GLOW, 0xff5ac8], speed: [0.5, 1.2], dir: V(0, 1, 0), spread: 0.4, life: [1.0, 1.8], size: [0.12, 0.22], sizeEnd: 0.1, intensity: 1.8 });
    }
  });
  return out;
}
