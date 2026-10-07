// The lived-in feel of the outpost camp: this is the Knights' only base in the Rift, where people eat, sleep,
// mend weapons and drill with swords. There are pointed tents with guy ropes (door flaps tied back, a small pennant on top),
// a notice board inside the gate, a smithing corner (forge fire, anvil, grinding wheel, quench barrel),
// a field kitchen by the campfire (a pot hung from a tripod, a chopping table, split firewood), supply piles (crates, casks,
// sacks, tarp-covered cargo), straw dummies and archery targets for sword practice, laundry drying by the fence,
// a lookout platform at the cliff edge, an unloading wagon outside the gate; a few plank walkways are laid on the ground,
// and the trodden earth is warm brown.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { rope } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import { glowDisc, tint } from './decals.ts';
import type { Banners, Flames } from './fx.ts';
import { COL } from './props.ts';
import { seg } from './scatter.ts';
import { land, TOWN } from './shape.ts';

const WOOD = 0x6a4a32;
const WOOD_D = 0x4a3222;
const WOOD_L = 0x8a6444;
const CANVAS = 0xd8c8a8;
const CANVAS_D = 0xa89878;
const BLUE = 0x2e4a8a;
const RED = 0x8a2e3a;
const IRON = 0x4a4a58;
const STEEL = 0xaab0c0;
const GOLD = 0xe8c060;
const ROPE = 0xb09a78;
const SACK = 0xc0a878;
const STRAW = 0xd8b868;
const TARP = 0x5e6450;
const EMBER = 0xff7a30;

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/**
 * First tilt by rx about the local X axis, then turn to horizontal angle ry: a long thin object along Y falls toward (sin ry,
 * cos ry)
 */
const RM = (x: number, y: number, z: number, ry: number, rx: number, rz = 0) =>
  new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(rx)).multiply(new THREE.Matrix4().makeRotationZ(rz)).setPosition(x, y, z);

// ───────────────────────── Small props ─────────────────────────

/** Cask: a belly-bulged body with two iron hoops; lying on its side when lying */
function barrel(ctx: FieldCtx, x: number, z: number, s: number, lying = false, ry = 0, y0 = 0): void {
  const { b } = ctx;
  ctx.place(x, z);
  const h = 0.95 * s;
  const R = 0.36 * s;
  const at = (dy: number) => (lying ? RM(x, R + y0, z, ry, Math.PI / 2).multiply(new THREE.Matrix4().makeTranslation(0, dy, 0)) : M(x, h / 2 + dy + y0, z, ry));
  const lo = new THREE.CylinderGeometry(R * 1.12, R, h / 2, 10);
  lo.translate(0, -h / 4, 0);
  const hi = new THREE.CylinderGeometry(R, R * 1.12, h / 2, 10);
  hi.translate(0, h / 4, 0);
  b.add(lo, WOOD, at(0));
  b.add(hi, WOOD, at(0));
  for (const dy of [-0.3, 0.3]) b.add(new THREE.CylinderGeometry(R * 1.1, R * 1.1, 0.07 * s, 10, 1, true), IRON, at(dy * h), false);
  if (!lying) b.add(new THREE.CylinderGeometry(R * 0.92, R * 0.92, 0.02, 10), WOOD_D, at(h / 2), false);
}

/** Crate: the body plus a dark wooden strip at top and bottom */
function crate(ctx: FieldCtx, x: number, y: number, z: number, s: number, ry: number, col = WOOD_L): void {
  const { b } = ctx;
  b.add(new THREE.BoxGeometry(s, s, s), col, M(x, y + s / 2, z, ry));
  for (const k of [0.12, 0.88]) b.add(new THREE.BoxGeometry(s * 1.03, s * 0.09, s * 1.03), WOOD_D, M(x, y + s * k, z, ry), false);
}

/** Sack: a squashed sphere plus a small gathered bunch where the mouth is tied */
function sack(ctx: FieldCtx, x: number, y: number, z: number, s: number, ry: number, col = SACK): void {
  const { b } = ctx;
  const g = new THREE.SphereGeometry(0.34 * s, 7, 5);
  g.scale(1, 0.72, 0.85);
  b.add(g, col, M(x, y + 0.24 * s, z, ry));
  b.add(new THREE.ConeGeometry(0.1 * s, 0.2 * s, 5), col, M(x + Math.sin(ry) * 0.22 * s, y + 0.42 * s, z + Math.cos(ry) * 0.22 * s, ry, 1, 0.5, 0), false);
}

/** Bucket */
function bucket(ctx: FieldCtx, x: number, z: number): void {
  ctx.place(x, z);
  ctx.b.add(new THREE.CylinderGeometry(0.2, 0.16, 0.32, 8), WOOD, M(x, 0.16, z));
  ctx.b.add(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 8, 1, true), IRON, M(x, 0.25, z), false);
  ctx.b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.01, 8), 0x2a3a4a, M(x, 0.29, z), false);
}

/** Lantern hung on a short pole: the shade glows, with a ring of warm light on the ground */
function lanternPole(ctx: FieldCtx, x: number, z: number, face: number, h = 2.4): void {
  const { b } = ctx;
  const gh = ctx.place(x, z);
  b.add(new THREE.CylinderGeometry(0.06, 0.08, h, 5), WOOD_D, M(x, h / 2, z));
  const ax = x + Math.sin(face) * 0.45;
  const az = z + Math.cos(face) * 0.45;
  b.add(new THREE.BoxGeometry(0.06, 0.06, 0.6), WOOD_D, M((x + ax) / 2, h - 0.1, (z + az) / 2, face));
  b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 3), IRON, M(ax, h - 0.25, az), false);
  b.add(new THREE.ConeGeometry(0.16, 0.14, 4), IRON, M(ax, h - 0.38, az, Math.PI / 4));
  b.glow(new THREE.BoxGeometry(0.16, 0.22, 0.16), 0xffc060, M(ax, h - 0.56, az));
  b.add(new THREE.BoxGeometry(0.2, 0.04, 0.2), IRON, M(ax, h - 0.69, az), false);
  glowDisc(ctx, ax, az, 3.2, 0xffa850, 0.42);
  ctx.solids.add(x, z, 0.3);
  void gh;
  b.lift = 0;
}

// ───────────────────────── Tents ─────────────────────────

/**
 * Pointed tent: canvas walls with stitch seams, a roof of rib after rib, a ring of scalloped valance along the edge;
 * the door flaps are tied back to both sides with a dark interior; guy ropes are staked into the ground all around,
 * with a small pennant on top.
 */
export function campTent(ctx: FieldCtx, bn: Banners, x: number, z: number, R: number, cloth: number, trim: number, face: number, r: () => number): void {
  const { b } = ctx;
  const gh = ctx.place(x, z, R);
  const H = 1.5;
  const RH = R * 0.95;
  b.add(new THREE.CylinderGeometry(R * 0.98, R * 1.02, H, 14), cloth, M(x, H / 2, z));
  // Stitch seams on the wall
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = face + ((i + 0.5) / n) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.06, H - 0.1, 0.03), CANVAS_D, M(x + Math.sin(a) * (R + 0.01), H / 2, z + Math.cos(a) * (R + 0.01), a), false);
  }
  // Roof and ribs
  b.add(new THREE.ConeGeometry(R * 1.12, RH, 14), trim, M(x, H + RH / 2, z));
  const slant = Math.hypot(R * 1.12, RH);
  const tilt = Math.atan2(R * 1.12, RH);
  for (let i = 0; i < n; i++) {
    const a = face + (i / n) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.09, slant, 0.05), cloth, RM(x + Math.sin(a) * R * 0.57, H + RH / 2 + 0.02, z + Math.cos(a) * R * 0.57, a, -tilt), false);
  }
  // Scalloped valance
  const ns = 16;
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * Math.PI * 2;
    b.add(new THREE.ConeGeometry(0.2, 0.32, 3), trim, RM(x + Math.sin(a) * R * 1.1, H - 0.1, z + Math.cos(a) * R * 1.1, a, Math.PI), false);
  }
  // Pole and small pennant on top
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 5), WOOD_D, M(x, H + RH + 0.45, z));
  b.add(new THREE.SphereGeometry(0.09, 6, 4), GOLD, M(x, H + RH + 1.12, z));
  bn.add(x + Math.sin(face + 1.6) * 0.04, gh + H + RH + 1.05, z + Math.cos(face + 1.6) * 0.04, face + Math.PI / 2, 0.42, 0.9, r() * 6);
  // Door: a dark doorway, two tied-back flaps, a lintel
  const dx = Math.sin(face);
  const dz = Math.cos(face);
  b.add(new THREE.BoxGeometry(1.0, 1.35, 0.05), 0x1a120c, M(x + dx * (R + 0.02), 0.66, z + dz * (R + 0.02), face), false);
  for (const s of [-1, 1]) {
    const px = x + dx * (R + 0.12) + dz * s * 0.62;
    const pz = z + dz * (R + 0.12) - dx * s * 0.62;
    b.add(new THREE.BoxGeometry(0.34, 1.4, 0.06), trim, M(px, 0.7, pz, face + s * 0.5));
    b.add(new THREE.BoxGeometry(0.38, 0.06, 0.1), ROPE, M(px, 0.85, pz, face + s * 0.5), false);
  }
  b.add(new THREE.BoxGeometry(1.2, 0.1, 0.1), WOOD_D, M(x + dx * (R + 0.06), 1.36, z + dz * (R + 0.06), face));
  // Guy ropes and stakes (none on the door side)
  b.lift = 0;
  const nr = 6;
  for (let i = 0; i < nr; i++) {
    const a = face + ((i + 0.5) / nr) * Math.PI * 2;
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const top = V3(x + sa * R * 1.08, gh + H + 0.05, z + ca * R * 1.08);
    const px = x + sa * (R + 1.35);
    const pz = z + ca * (R + 1.35);
    if (land(px, pz) < 1) continue;
    const py = ctx.h(px, pz);
    seg(b, top, V3(px, py + 0.2, pz), 0.018, 0.018, ROPE, 3, false);
    b.add(new THREE.BoxGeometry(0.06, 0.34, 0.06), WOOD_L, RM(px, py + 0.12, pz, a + Math.PI, 0.35), false);
  }
  // One or two things by the door: a bedroll, a wooden stool, a bucket, a leaning shield
  const pick = r();
  const sx = x + dx * (R + 0.55) + dz * 1.15;
  const sz = z + dz * (R + 0.55) - dx * 1.15;
  if (land(sx, sz) > 1.5) {
    ctx.place(sx, sz);
    if (pick < 0.35) {
      b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 8), r() < 0.5 ? BLUE : 0x6a4a3a, RM(sx, 0.2, sz, face + Math.PI / 2, Math.PI / 2));
      b.add(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 8, 1, true), ROPE, RM(sx + dz * 0.25, 0.2, sz - dx * 0.25, face + Math.PI / 2, Math.PI / 2), false);
    } else if (pick < 0.65) {
      b.add(new THREE.CylinderGeometry(0.22, 0.24, 0.42, 8), WOOD, M(sx, 0.21, sz));
      b.lift = 0;
      bucket(ctx, sx - dz * 0.55 + dx * 0.2, sz + dx * 0.55 + dz * 0.2);
    } else {
      const sh = new THREE.CylinderGeometry(0.4, 0.4, 0.07, 12);
      sh.rotateX(Math.PI / 2);
      b.add(sh, trim === RED ? RED : BLUE, RM(sx, 0.42, sz, face, -0.3));
      b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 8).rotateX(Math.PI / 2), GOLD, RM(sx + dx * 0.03, 0.43, sz + dz * 0.03, face, -0.3));
    }
  }
  b.lift = 0;
  ctx.solids.add(x, z, R + 0.2);
}

// ───────────────────────── Corners of the camp ─────────────────────────

/** Notice board inside the gate: two posts, a board, a small rain shelter, covered in notices and bounties */
function noticeBoard(ctx: FieldCtx, x: number, z: number, face: number, r: () => number): void {
  const { b } = ctx;
  ctx.place(x, z, 0.8);
  const c = Math.cos(face);
  const s = Math.sin(face);
  for (const k of [-0.85, 0.85]) b.add(new THREE.BoxGeometry(0.14, 2.3, 0.14), WOOD_D, M(x + c * k, 1.15, z - s * k, face));
  b.add(new THREE.BoxGeometry(1.8, 1.1, 0.08), WOOD_L, M(x, 1.45, z, face));
  for (const [dy, rot] of [[0.12, 0.55], [-0.12, -0.55]] as const) b.add(new THREE.BoxGeometry(2.1, 0.05, 0.5), BLUE, M(x + s * dy * 1.6, 2.2, z + c * dy * 1.6, face, 1, rot, 0));
  const papers = [0xe8dcc0, 0xd8c8a0, 0xe0d0b0, 0xc8b088];
  for (let i = 0; i < 7; i++) {
    const u = (r() - 0.5) * 1.45;
    const v = 1.45 + (r() - 0.5) * 0.75;
    const w = 0.22 + r() * 0.16;
    const h = 0.28 + r() * 0.14;
    b.add(new THREE.BoxGeometry(w, h, 0.012), papers[i % 4], M(x + c * u + s * 0.05, v, z - s * u + c * 0.05, face, 1, 0, (r() - 0.5) * 0.2), false);
  }
  // A bounty poster with a red monster drawn on it
  b.add(new THREE.BoxGeometry(0.1, 0.1, 0.014), RED, M(x + c * 0.3 + s * 0.06, 1.55, z - s * 0.3 + c * 0.06, face, 1, 0, 0.785), false);
  ctx.solids.add(x, z, 0.9);
  b.lift = 0;
}

/**
 * Smithing corner: a stone forge (coals and flames in the mouth, chimney, leather bellows), an anvil on a tree stump,
 * a quench barrel, a grinding wheel, a rack for hanging tools, and a pile of broken swords awaiting repair
 */
function smithy(ctx: FieldCtx, fl: Flames, sparks: [number, number, number][], r: () => number): void {
  const { b } = ctx;
  // Forge
  {
    const x = 14.1;
    const z = 58.7;
    const face = -2.2;
    const gh = ctx.place(x, z, 1);
    b.add(new THREE.BoxGeometry(1.7, 0.95, 1.3), COL.stoneD, M(x, 0.47, z, face));
    b.add(new THREE.BoxGeometry(1.8, 0.12, 1.4), COL.stone, M(x, 0.98, z, face));
    b.glow(new THREE.BoxGeometry(1.1, 0.06, 0.8), EMBER, M(x, 1.05, z, face));
    fl.add(x, gh + 1.0, z, 0.5, r() * 6);
    fl.add(x + 0.3, gh + 1.0, z + 0.2, 0.35, r() * 6);
    const bx = x - Math.sin(face) * 0.55;
    const bz = z - Math.cos(face) * 0.55;
    b.add(new THREE.BoxGeometry(0.8, 2.6, 0.7), COL.stone, M(bx, 1.3, bz, face));
    b.add(new THREE.ConeGeometry(0.55, 0.5, 4), COL.stoneD, M(bx, 2.85, bz, face + Math.PI / 4));
    const lx = x + Math.cos(face) * 1.15;
    const lz = z - Math.sin(face) * 1.15;
    b.add(new THREE.BoxGeometry(0.5, 0.18, 0.8), 0x5a3a2a, M(lx, 0.75, lz, face, 1, 0, 0.15));
    b.add(new THREE.BoxGeometry(0.1, 0.1, 0.5), WOOD_D, M(lx, 0.9, lz + 0.1, face));
    glowDisc(ctx, x, z, 4, 0xff8a3a, 0.5);
    sparks.push([x, gh + 1.1, z]);
    ctx.solids.add(x, z, 1.05);
    ctx.solids.add(bx, bz, 0.5);
  }
  // Anvil
  {
    const x = 12.1;
    const z = 59.8;
    const gh = ctx.place(x, z, 0.5);
    b.add(new THREE.CylinderGeometry(0.32, 0.38, 0.55, 8), WOOD_D, M(x, 0.27, z));
    b.add(new THREE.BoxGeometry(0.3, 0.2, 0.26), IRON, M(x, 0.64, z, 0.4));
    b.add(new THREE.BoxGeometry(0.72, 0.18, 0.3), IRON, M(x, 0.82, z, 0.4));
    b.add(new THREE.ConeGeometry(0.1, 0.36, 6), IRON, RM(x + Math.cos(0.4) * 0.52, 0.84, z - Math.sin(0.4) * 0.52, 0.4 + Math.PI / 2, Math.PI / 2));
    // A red-hot sword blank and a hammer on the anvil
    b.glow(new THREE.BoxGeometry(0.6, 0.03, 0.07), 0xff6a20, M(x, 0.93, z, 0.4 + 0.2));
    b.add(new THREE.BoxGeometry(0.06, 0.06, 0.45), WOOD, M(x + 0.15, 0.95, z + 0.2, 1.1));
    b.add(new THREE.BoxGeometry(0.12, 0.12, 0.2), IRON, M(x + 0.05, 0.97, z + 0.4, 1.1));
    sparks.push([x, gh + 0.95, z]);
    ctx.solids.add(x, z, 0.5);
  }
  // Quench barrel
  barrel(ctx, 11.2, 58.3, 0.85);
  ctx.b.add(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 10), 0x2a3a4a, M(11.2, 0.78, 58.3), false);
  ctx.b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), IRON, M(11.35, 0.95, 58.25, 0, 1, 0.3, 0.2), false);
  ctx.b.lift = 0;
  ctx.solids.add(11.2, 58.3, 0.45);
  // Grinding wheel
  {
    const x = 14.9;
    const z = 61.6;
    ctx.place(x, z, 0.6);
    for (const s of [-0.22, 0.22]) b.add(new THREE.BoxGeometry(0.08, 0.8, 0.9), WOOD, M(x + s, 0.4, z, 0.3));
    const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14);
    wheel.rotateZ(Math.PI / 2);
    b.add(wheel, 0x8a8494, M(x, 0.78, z, 0.3));
    b.add(new THREE.BoxGeometry(0.6, 0.05, 0.05), IRON, M(x, 0.78, z, 0.3), false);
    b.add(new THREE.BoxGeometry(0.06, 0.06, 0.8), WOOD_D, M(x - 0.3, 0.3, z + 0.45, 0.3, 1, 0.5, 0));
    ctx.solids.add(x, z, 0.6);
  }
  // Rack for hanging tools (back against the fence)
  {
    const x = 16.2;
    const z = 60.0;
    const face = -1.9;
    ctx.place(x, z, 0.8);
    const c = Math.cos(face);
    const s = Math.sin(face);
    for (const k of [-0.7, 0.7]) b.add(new THREE.BoxGeometry(0.1, 1.9, 0.1), WOOD_D, M(x + c * k, 0.95, z - s * k, face));
    b.add(new THREE.BoxGeometry(1.6, 0.08, 0.08), WOOD, M(x, 1.7, z, face));
    b.add(new THREE.BoxGeometry(1.6, 0.08, 0.08), WOOD, M(x, 1.0, z, face));
    for (let i = 0; i < 5; i++) {
      const u = -0.55 + i * 0.28;
      const px = x + c * u + s * 0.08;
      const pz = z - s * u + c * 0.08;
      b.add(new THREE.BoxGeometry(0.04, 0.6, 0.04), WOOD_L, M(px, 1.38, pz, face), false);
      if (i % 2 === 0) b.add(new THREE.BoxGeometry(0.18, 0.1, 0.1), IRON, M(px, 1.1, pz, face), false);
      else b.add(new THREE.BoxGeometry(0.03, 0.4, 0.12), STEEL, M(px, 1.2, pz, face, 1, 0, 0.15), false);
    }
    ctx.solids.add(x, z, 0.7);
  }
  // Broken swords, dented helmets and shields awaiting repair
  {
    const x = 11.3;
    const z = 61.6;
    ctx.place(x, z, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      b.add(new THREE.BoxGeometry(0.05, 0.7 + r() * 0.3, 0.1), STEEL, RM(x + Math.cos(a) * 0.2, 0.3, z + Math.sin(a) * 0.2, a, 0.5 + r() * 0.5), false);
    }
    const helm = new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    b.add(helm, 0x8a90a0, M(x + 0.4, 0.02, z - 0.2, r() * 6, 1, 0.3, 0));
    const sh = new THREE.CylinderGeometry(0.36, 0.36, 0.06, 10);
    b.add(sh, BLUE, M(x - 0.35, 0.08, z + 0.25, 0, 1, 0.15, 0.1));
    ctx.solids.add(x, z, 0.55);
  }
  b.lift = 0;
}

/**
 * Field kitchen by the campfire: a smoking pot hung from a tripod (a small fire underneath), a chopping table,
 * a stack of split firewood, a stump with an axe stuck in it, a bucket and flour sacks
 */
function kitchen(ctx: FieldCtx, fl: Flames, steam: [number, number, number][], r: () => number): void {
  const { b } = ctx;
  // Tripod and pot
  {
    const x = -0.3;
    const z = 66.2;
    const gh = ctx.place(x, z, 0.8);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      b.add(new THREE.CylinderGeometry(0.04, 0.05, 2.1, 5), WOOD_D, RM(x + Math.sin(a) * 0.52, 0.95, z + Math.cos(a) * 0.52, a + Math.PI, 0.3));
    }
    b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 3), IRON, M(x, 1.55, z), false);
    const pot = new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58);
    b.add(pot, 0x2e2e36, M(x, 0.9, z));
    b.add(new THREE.TorusGeometry(0.39, 0.035, 4, 12), IRON, M(x, 0.97, z, 0, 1, Math.PI / 2), false);
    b.add(new THREE.CylinderGeometry(0.37, 0.37, 0.02, 10), 0x8a5a2a, M(x, 0.93, z), false);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.add(new THREE.DodecahedronGeometry(0.14, 0), COL.stone, M(x + Math.cos(a) * 0.5, 0.06, z + Math.sin(a) * 0.5, r() * 6));
    }
    b.glow(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 8), EMBER, M(x, 0.04, z));
    fl.add(x, gh + 0.05, z, 0.45, r() * 6);
    glowDisc(ctx, x, z, 3.2, 0xff9040, 0.45);
    steam.push([x, gh + 1.0, z]);
    ctx.solids.add(x, z, 0.85);
  }
  // Chopping table: a board, a knife, bread, a few vegetables, a bowl
  {
    const x = -2.3;
    const z = 64.9;
    const ry = 0.25;
    ctx.place(x, z, 0.8);
    b.add(new THREE.BoxGeometry(1.7, 0.08, 0.8), WOOD_L, M(x, 0.86, z, ry));
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    for (const [u, v] of [[-0.75, -0.32], [0.75, -0.32], [-0.75, 0.32], [0.75, 0.32]]) b.add(new THREE.BoxGeometry(0.08, 0.84, 0.08), WOOD_D, M(x + c * u + s * v, 0.42, z - s * u + c * v, ry), false);
    const at = (u: number, v: number, y: number) => [x + c * u + s * v, 0.9 + y, z - s * u + c * v] as const;
    { const [px, py, pz] = at(-0.4, 0, 0.02); b.add(new THREE.BoxGeometry(0.5, 0.04, 0.34), 0xa07a52, M(px, py, pz, ry + 0.1), false); }
    { const [px, py, pz] = at(-0.4, 0.05, 0.05); b.add(new THREE.BoxGeometry(0.28, 0.015, 0.05), STEEL, M(px, py, pz, ry + 0.6), false); }
    for (let i = 0; i < 2; i++) {
      const [px, py, pz] = at(0.15 + i * 0.25, -0.15, 0.08);
      const g = new THREE.SphereGeometry(0.13, 7, 5);
      g.scale(1.4, 0.7, 1);
      b.add(g, 0xc08a4a, M(px, py, pz, r() * 3));
    }
    for (let i = 0; i < 4; i++) {
      const [px, py, pz] = at(0.3 + r() * 0.35, 0.15 + r() * 0.12, 0.05);
      b.add(new THREE.SphereGeometry(0.06, 5, 4), [0x7a9a4a, 0xd87a3a, 0xa84a6a][i % 3], M(px, py, pz), false);
    }
    { const [px, py, pz] = at(0.65, -0.2, 0.03); b.add(new THREE.CylinderGeometry(0.13, 0.08, 0.08, 8, 1, true), 0x8a6444, M(px, py, pz), false); }
    ctx.solids.add(x, z, 0.95);
  }
  // Woodpile: three layers of crisscrossed logs, with a stump with an axe stuck in it beside it
  {
    const x = 1.4;
    const z = 63.9;
    const ry = 0.1;
    ctx.place(x, z, 0.8);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4 - row; i++) {
        const u = (i - (3 - row) / 2) * 0.27;
        const g = new THREE.CylinderGeometry(0.13, 0.13, 1.1, 6);
        g.rotateX(Math.PI / 2);
        b.add(g, i % 2 ? WOOD : WOOD_L, M(x + Math.cos(ry) * u, 0.13 + row * 0.23, z - Math.sin(ry) * u, ry));
      }
    }
    ctx.solids.add(x, z, 0.7);
    const sx = 1.8;
    const sz = 65.7;
    ctx.place(sx, sz);
    b.add(new THREE.CylinderGeometry(0.3, 0.34, 0.45, 8), WOOD_D, M(sx, 0.22, sz));
    b.add(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 8), 0xa07a52, M(sx, 0.45, sz), false);
    b.add(new THREE.BoxGeometry(0.04, 0.6, 0.04), WOOD_L, M(sx + 0.12, 0.7, sz, 0.8, 1, 0, -0.5));
    b.add(new THREE.BoxGeometry(0.2, 0.16, 0.03), STEEL, M(sx, 0.48, sz, 0.8, 1, 0, -0.5));
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2;
      b.add(new THREE.BoxGeometry(0.1, 0.08, 0.35), WOOD_L, M(sx + Math.cos(a) * 0.6, 0.04, sz + Math.sin(a) * 0.6, a), false);
    }
    ctx.solids.add(sx, sz, 0.35);
  }
  // Bucket and flour sacks
  barrel(ctx, -2.8, 67.2, 0.8);
  ctx.b.lift = 0;
  ctx.solids.add(-2.8, 67.2, 0.4);
  bucket(ctx, -2.1, 67.8);
  ctx.place(-3.3, 66.2);
  sack(ctx, -3.3, 0, 66.2, 0.9, 0.4, 0xe0d4b8);
  sack(ctx, -3.0, 0, 66.6, 0.8, 2.0, 0xe0d4b8);
  ctx.b.lift = 0;
}

/** Supply pile: stacked crates, a row of casks, cargo under a tarp tied with rope, a heap of sacks, a handcart */
function depot(ctx: FieldCtx, r: () => number): void {
  const { b } = ctx;
  // Crates
  {
    const x = 11.4;
    const z = 66.4;
    ctx.place(x, z, 1);
    crate(ctx, x, 0, z, 0.9, 0.1);
    crate(ctx, x + 0.95, 0, z + 0.1, 0.85, 0.05, WOOD);
    crate(ctx, x + 0.45, 0.88, z + 0.05, 0.75, 0.3);
    crate(ctx, x - 0.2, 0, z + 0.95, 0.6, 0.6, WOOD);
    ctx.solids.add(x + 0.45, z + 0.3, 1.1);
  }
  // Casks
  {
    const x = 14.5;
    const z = 66.3;
    barrel(ctx, x, z, 1);
    barrel(ctx, x + 0.78, z + 0.15, 1);
    barrel(ctx, x + 0.4, z + 0.8, 0.95);
    barrel(ctx, x - 0.3, z + 1.1, 0.95, true, 1.3);
    b.lift = 0;
    ctx.solids.add(x + 0.35, z + 0.45, 1.05);
  }
  // Cargo under a tarp
  {
    const x = 13.3;
    const z = 69.2;
    const ry = 0.35;
    ctx.place(x, z, 1.2);
    b.add(new THREE.BoxGeometry(2.3, 0.9, 1.6), WOOD, M(x, 0.45, z, ry));
    b.add(new THREE.BoxGeometry(2.0, 0.55, 1.3), WOOD_L, M(x - 0.1, 1.15, z, ry));
    const tarp = new THREE.CylinderGeometry(1.0, 1.3, 1.1, 4, 1);
    tarp.rotateY(Math.PI / 4);
    tarp.scale(1.25, 1, 0.85);
    b.add(tarp, TARP, M(x, 0.95, z, ry));
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    for (const u of [-0.6, 0.6]) {
      const g = new THREE.BoxGeometry(0.05, 0.05, 1.9);
      b.add(g, ROPE, M(x + c * u, 1.52, z - s * u, ry), false);
    }
    ctx.solids.add(x, z, 1.35);
  }
  // Heap of sacks
  {
    const x = 11.0;
    const z = 69.4;
    ctx.place(x, z, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const d = i < 4 ? 0.38 : 0;
      sack(ctx, x + Math.cos(a) * d, i < 4 ? 0 : 0.32, z + Math.sin(a) * d, 0.95 + r() * 0.15, a + r(), i === 2 ? 0xa89060 : SACK);
    }
    ctx.solids.add(x, z, 0.75);
  }
  // Handcart
  {
    const x = 16.0;
    const z = 69.3;
    const ry = -0.5;
    ctx.place(x, z, 1);
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    b.add(new THREE.BoxGeometry(1.1, 0.12, 1.5), WOOD, M(x, 0.62, z, ry, 1, -0.08, 0));
    for (const u of [-0.55, 0.55]) b.add(new THREE.BoxGeometry(0.06, 0.35, 1.5), WOOD_L, M(x + c * u, 0.82, z - s * u, ry, 1, -0.08, 0));
    for (const u of [-0.62, 0.62]) {
      const w = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12);
      w.rotateZ(Math.PI / 2);
      b.add(w, WOOD_D, M(x + c * u, 0.4, z - s * u, ry));
      b.add(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 6).rotateZ(Math.PI / 2), IRON, M(x + c * u, 0.4, z - s * u, ry), false);
    }
    for (const u of [-0.4, 0.4]) b.add(new THREE.BoxGeometry(0.06, 0.06, 1.3), WOOD_D, M(x + c * u - s * 1.2, 0.35, z - s * u - c * 1.2, ry, 1, 0.35, 0));
    sack(ctx, x + s * 0.2, 0.62, z + c * 0.2, 0.9, 0.5);
    crate(ctx, x - s * 0.35, 0.62, z - c * 0.35, 0.5, 0.2);
    ctx.solids.add(x, z, 1.0);
  }
  lanternPole(ctx, 10.2, 63.4, 2.2);
  b.lift = 0;
}

/**
 * Training ground: two straw dummies (one wearing a helmet), an archery target (with a few arrows stuck in it),
 * a few bales of hay
 */
function trainingYard(ctx: FieldCtx, r: () => number): void {
  const { b } = ctx;
  for (const [x, z, face, helm] of [
    [16.3, 73.6, -1.8, true],
    [18.9, 73.4, -1.5, false],
  ] as const) {
    ctx.place(x, z, 0.5);
    b.add(new THREE.CylinderGeometry(0.07, 0.08, 1.9, 5), WOOD_D, M(x, 0.95, z));
    b.add(new THREE.BoxGeometry(1.2, 0.08, 0.08), WOOD, M(x, 1.45, z, face + Math.PI / 2, 1, 0, 0.1));
    const body = new THREE.CylinderGeometry(0.28, 0.24, 0.8, 8);
    b.add(body, STRAW, M(x, 1.2, z, face));
    b.add(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 8, 1, true), ROPE, M(x, 1.35, z), false);
    b.add(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 8, 1, true), ROPE, M(x, 1.0, z), false);
    b.add(new THREE.SphereGeometry(0.2, 7, 5), SACK, M(x, 1.82, z));
    if (helm) b.add(new THREE.SphereGeometry(0.23, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a90a0, M(x, 1.84, z, 0, 1, 0.2, 0));
    // Chopped-off straw bits
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.3 + r() * 0.6;
      b.add(new THREE.BoxGeometry(0.2, 0.02, 0.05), STRAW, M(x + Math.cos(a) * d, 0.02, z + Math.sin(a) * d, r() * 6), false);
    }
    ctx.solids.add(x, z, 0.45);
  }
  // Archery target
  {
    const x = 22.2;
    const z = 75.2;
    const face = -Math.PI / 2 - 0.1;
    ctx.place(x, z, 0.8);
    for (let i = 0; i < 3; i++) {
      const a = face + Math.PI + (i - 1) * 1.0;
      b.add(new THREE.BoxGeometry(0.07, 1.7, 0.07), WOOD_D, RM(x + Math.sin(a) * 0.35, 0.8, z + Math.cos(a) * 0.35, a + Math.PI, 0.22), false);
    }
    const dx = Math.sin(face);
    const dz = Math.cos(face);
    const disc = (R: number, col: number, off: number) => {
      const g = new THREE.CylinderGeometry(R, R, 0.1, 16);
      g.rotateX(Math.PI / 2);
      b.add(g, col, RM(x + dx * off, 1.35, z + dz * off, face, -0.12), off > 0.02 ? false : true);
    };
    disc(0.72, STRAW, 0);
    disc(0.56, 0xe8e0d0, 0.03);
    disc(0.4, RED, 0.05);
    disc(0.24, 0xe8e0d0, 0.07);
    disc(0.1, GOLD, 0.09);
    for (let i = 0; i < 4; i++) {
      const u = (r() - 0.5) * 0.8;
      const v = (r() - 0.5) * 0.8;
      const px = x + dx * 0.35 + Math.cos(face) * u;
      const pz = z + dz * 0.35 - Math.sin(face) * u;
      b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 3), WOOD_L, RM(px, 1.35 + v, pz, face, Math.PI / 2 + (r() - 0.5) * 0.2), false);
      b.add(new THREE.BoxGeometry(0.1, 0.02, 0.12), 0xe8e0d0, RM(px + dx * 0.28, 1.35 + v, pz + dz * 0.28, face, Math.PI / 2), false);
    }
    ctx.solids.add(x, z, 0.75);
  }
  // Hay bales
  for (const [x, z, ry] of [
    [21.6, 72.3, 0.4],
    [20.9, 77.4, 1.2],
    [21.9, 78.0, 0.9],
  ] as const) {
    if (land(x, z) < 2 || ctx.solids.blocked(x, z, 0.5)) continue;
    ctx.place(x, z, 0.6);
    b.add(new THREE.BoxGeometry(1.1, 0.55, 0.7), STRAW, M(x, 0.27, z, ry));
    for (const u of [-0.3, 0.3]) b.add(new THREE.BoxGeometry(0.05, 0.57, 0.72), ROPE, M(x + Math.cos(ry) * u, 0.27, z - Math.sin(ry) * u, ry), false);
    ctx.solids.add(x, z, 0.6);
  }
  b.lift = 0;
}

/** Clothesline: a rope between two posts with a few clothes and towels pegged on (blown by the wind) */
function laundry(ctx: FieldCtx, bn: Banners, ax: number, az: number, cx: number, cz: number, r: () => number): void {
  const { b } = ctx;
  const H = 2.1;
  const ends: THREE.Vector3[] = [];
  for (const [x, z] of [[ax, az], [cx, cz]]) {
    const gh = ctx.place(x, z);
    b.add(new THREE.CylinderGeometry(0.06, 0.08, H + 0.2, 5), WOOD_D, M(x, (H + 0.2) / 2, z));
    b.add(new THREE.BoxGeometry(0.5, 0.06, 0.06), WOOD_D, M(x, H, z, Math.atan2(cx - ax, cz - az) + Math.PI / 2));
    ends.push(V3(x, gh + H - 0.05, z));
    ctx.solids.add(x, z, 0.25);
  }
  b.lift = 0;
  const sag = 0.3;
  rope(b, ends[0], ends[1], sag, 0.015, ROPE, false, 8);
  const ang = Math.atan2(cx - ax, cz - az);
  const cloths = [0xe8e0d0, 0x4a6aa8, 0xd8c8a8, 0xa84a4a, 0xe8e0d0, 0x6a8a5a, 0x8a6a4a];
  let t = 0.1;
  let k = 0;
  while (t < 0.9) {
    const w = 0.4 + r() * 0.35;
    const h = 0.45 + r() * 0.45;
    const L = ends[0].distanceTo(ends[1]);
    const tm = t + w / L / 2;
    if (tm > 0.92) break;
    const p = ends[0].clone().lerp(ends[1], tm);
    p.y -= sag * 4 * tm * (1 - tm);
    bn.add(p.x, p.y, p.z, ang + Math.PI / 2, w, h, r() * 6, cloths[k++ % cloths.length]);
    t += w / L + 0.03 + r() * 0.08;
  }
}

/**
 * Lookout platform at the cliff edge: a wooden deck, railings on three sides, a telescope on a tripod, a stool, a lamp;
 * looking out over the southern void
 */
function lookout(ctx: FieldCtx, x0: number, r: () => number): void {
  const { b } = ctx;
  // Look for the cliff edge south of the camp
  let z = 86;
  while (z < 104 && land(x0, z + 0.5) > 3.2) z += 0.5;
  const x = x0;
  const face = 0;
  const gh = ctx.h(x, z);
  const Y = gh + 0.55;
  const W = 3.0;
  const D = 2.2;
  b.lift = 0;
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = x + (u * W) / 2 - 0.1 * u;
    const pz = z + (v * D) / 2 - 0.1 * v;
    const py = Math.min(ctx.h(px, pz), gh) - 0.6;
    b.add(new THREE.BoxGeometry(0.16, Y - py + 1.05, 0.16), WOOD_D, M(px, (Y + 1.05 + py) / 2, pz));
  }
  for (let i = 0; i < 8; i++) {
    const u = -W / 2 + (i + 0.5) * (W / 8);
    b.add(new THREE.BoxGeometry(W / 8 - 0.03, 0.08, D), i % 2 ? WOOD : WOOD_L, M(x + u, Y, z));
  }
  for (const [u, v, w, d] of [[0, D / 2 - 0.1, W, 0.08], [-W / 2 + 0.1, 0, 0.08, D], [W / 2 - 0.1, 0, 0.08, D]] as const) {
    b.add(new THREE.BoxGeometry(w, 0.08, d), WOOD_L, M(x + u, Y + 1.0, z + v));
    b.add(new THREE.BoxGeometry(w, 0.06, d), WOOD, M(x + u, Y + 0.55, z + v), false);
  }
  // Telescope
  const sx = x + 0.5;
  const sz = z + 0.4;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.02, 0.025, 1.3, 4), WOOD_D, RM(sx + Math.sin(a) * 0.18, Y + 0.6, sz + Math.cos(a) * 0.18, a + Math.PI, 0.18), false);
  }
  b.add(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 8), 0xb08a4a, RM(sx, Y + 1.3, sz + 0.1, face, Math.PI / 2 - 0.25));
  b.add(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 8, 1, true), GOLD, RM(sx, Y + 1.24, sz + 0.38, face, Math.PI / 2 - 0.25), false);
  // Stool, wine bottle, lamp
  b.add(new THREE.CylinderGeometry(0.2, 0.22, 0.45, 8), WOOD, M(x - 0.8, Y + 0.26, z - 0.2));
  b.add(new THREE.CylinderGeometry(0.04, 0.06, 0.24, 6), 0x3a6a4a, M(x - 0.55, Y + 0.16, z + 0.3), false);
  const lx = x - W / 2 + 0.1;
  const lz = z + D / 2 - 0.1;
  b.add(new THREE.BoxGeometry(0.1, 1.4, 0.1), WOOD_D, M(lx, Y + 1.7, lz));
  b.glow(new THREE.BoxGeometry(0.15, 0.2, 0.15), 0xffc060, M(lx, Y + 2.5, lz));
  b.add(new THREE.ConeGeometry(0.14, 0.12, 4), IRON, M(lx, Y + 2.66, lz, Math.PI / 4));
  glowDisc(ctx, lx, lz, 3, 0xffa850, 0.35);
  // A short ladder under the platform
  for (let i = 0; i < 2; i++) b.add(new THREE.BoxGeometry(0.7, 0.06, 0.2), WOOD_L, M(x - 0.4, gh + 0.18 + i * 0.2, z - D / 2 - 0.25 - i * 0.05), false);
  for (let v = -0.6; v <= 0.6; v += 0.6) ctx.solids.add(x + v * 1.8, z, 0.9);
  void r;
}

/**
 * Unloading wagon outside the gate: the bed, four wheels (one taken off and leaned against the side), the shafts,
 * cargo on the wagon
 */
function wagon(ctx: FieldCtx, x: number, z: number, ry: number, r: () => number): void {
  const { b } = ctx;
  ctx.place(x, z, 1.6);
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (u: number, v: number, y: number, rr = ry, rx = 0, rz = 0) => M(x + c * u + s * v, y, z - s * u + c * v, rr, 1, rx, rz);
  b.add(new THREE.BoxGeometry(1.7, 0.14, 3.0), WOOD, at(0, 0, 0.8));
  for (const u of [-0.85, 0.85]) b.add(new THREE.BoxGeometry(0.07, 0.45, 3.0), WOOD_L, at(u, 0, 1.08));
  b.add(new THREE.BoxGeometry(1.7, 0.45, 0.07), WOOD_L, at(0, -1.5, 1.08));
  for (const v of [-1.0, 1.0]) b.add(new THREE.BoxGeometry(1.9, 0.1, 0.1), WOOD_D, at(0, v, 0.6), false);
  const wheel = (u: number, v: number) => {
    const g = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 14);
    g.rotateZ(Math.PI / 2);
    b.add(g, WOOD_D, at(u, v, 0.55));
    const h = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 6);
    h.rotateZ(Math.PI / 2);
    b.add(h, IRON, at(u, v, 0.55), false);
  };
  wheel(-0.98, -1.0);
  wheel(0.98, -1.0);
  wheel(-0.98, 1.0);
  // The removed wheel leans against the bed, with that corner propped up by crates
  {
    const g = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 14);
    g.rotateZ(Math.PI / 2);
    b.add(g, WOOD_D, at(1.45, 1.35, 0.55, ry, 0, -0.35));
    crate(ctx, x + c * 0.7 + s * 1.0, 0, z - s * 0.7 + c * 1.0, 0.5, ry);
  }
  // Shafts
  for (const u of [-0.35, 0.35]) b.add(new THREE.BoxGeometry(0.08, 0.08, 2.2), WOOD_D, at(u, 2.5, 0.35, ry, 0.2, 0));
  // Cargo: crates, sacks, rolled-up canvas
  crate(ctx, x + c * -0.35 + s * -0.8, 0.87, z - s * -0.35 + c * -0.8, 0.7, ry + 0.1);
  crate(ctx, x + c * 0.35 + s * -0.6, 0.87, z - s * 0.35 + c * -0.6, 0.6, ry - 0.2, WOOD);
  sack(ctx, x + c * -0.3 + s * 0.4, 0.87, z - s * -0.3 + c * 0.4, 1, ry);
  sack(ctx, x + c * 0.35 + s * 0.5, 0.87, z - s * 0.35 + c * 0.5, 0.95, ry + 1);
  const roll = new THREE.CylinderGeometry(0.22, 0.22, 1.5, 8);
  roll.rotateZ(Math.PI / 2);
  b.add(roll, CANVAS, at(0, 1.1, 1.1));
  // Cargo unloaded onto the ground
  sack(ctx, x + c * -1.5 + s * 0.2, 0, z - s * -1.5 + c * 0.2, 1, 0.3);
  sack(ctx, x + c * -1.6 + s * -0.45, 0, z - s * -1.6 + c * -0.45, 0.9, 1.8);
  ctx.solids.add(x, z, 1.8);
  ctx.solids.add(x + s * 2.3, z + c * 2.3, 0.6);
  void r;
  b.lift = 0;
}

/** Plank walkway: laid from a to c, each plank following the ground and slightly askew */
function boards(ctx: FieldCtx, ax: number, az: number, cx: number, cz: number, w: number, r: () => number): void {
  const { b } = ctx;
  const len = Math.hypot(cx - ax, cz - az);
  const ang = Math.atan2(cx - ax, cz - az);
  const n = Math.floor(len / 0.34);
  for (let i = 0; i < n; i++) {
    if (r() < 0.06) continue;
    const t = (i + 0.5) / n;
    const x = ax + (cx - ax) * t;
    const z = az + (cz - az) * t;
    ctx.place(x, z);
    const col = [WOOD, WOOD_L, WOOD_D, WOOD][Math.floor(r() * 4)];
    b.add(new THREE.BoxGeometry(w * (0.9 + r() * 0.15), 0.06, 0.28), col, M(x + (r() - 0.5) * 0.08, 0.03, z, ang + (r() - 0.5) * 0.08, 1, 0, (r() - 0.5) * 0.05));
  }
  // Crossbeams on both sides
  for (const s of [-1, 1]) {
    const ox = Math.cos(ang) * s * w * 0.38;
    const oz = -Math.sin(ang) * s * w * 0.38;
    const A = V3(ax + ox, ctx.h(ax + ox, az + oz) + 0.01, az + oz);
    const C = V3(cx + ox, ctx.h(cx + ox, cz + oz) + 0.01, cz + oz);
    b.lift = 0;
    const m = A.clone().lerp(C, 0.5);
    b.add(new THREE.BoxGeometry(0.1, 0.05, len), WOOD_D, M(m.x, m.y, m.z, ang), false);
  }
  b.lift = 0;
}

// ───────────────────────── Assembly ─────────────────────────

export function buildCamp(ctx: FieldCtx, fl: Flames, bn: Banners, r: () => number): void {
  const [CX, CZ] = TOWN;
  // Ground in the camp: trodden warm-brown earth, burnt black around the campfire, forge and kitchen
  const n2 = (x: number, z: number) => Math.sin(x * 0.61 + Math.sin(z * 0.43) * 1.7) * Math.cos(z * 0.57 + Math.sin(x * 0.37) * 1.3);
  tint(ctx, CX, CZ + 1.5, 19.5, 0x4a3a2e, 0.6, (dx, dz) => {
    const d = Math.hypot(dx, dz * 1.05) / 19.5;
    return (1 - Math.min(1, Math.max(0, (d - 0.55) / 0.45))) * (0.7 + 0.3 * n2(CX + dx, CZ + dz));
  });
  tint(ctx, -0.5, 73, 3.4, 0x201812, 0.7);
  tint(ctx, 13.4, 59.2, 2.8, 0x221a14, 0.6);
  tint(ctx, -0.3, 66.2, 1.6, 0x221a14, 0.5);

  const sparks: [number, number, number][] = [];
  const steam: [number, number, number][] = [];
  noticeBoard(ctx, -2.0, 58.8, Math.PI / 2, r);
  smithy(ctx, fl, sparks, r);
  kitchen(ctx, fl, steam, r);
  depot(ctx, r);
  trainingYard(ctx, r);
  laundry(ctx, bn, -9.3, 66.3, -11.2, 71.1, r);
  lookout(ctx, 11.5, r);
  wagon(ctx, -10.5, 48.8, 0.35, r);
  // Plank walkways to the tent doors and the training ground
  boards(ctx, 3.2, 77.7, -5.4, 77.9, 1.1, r);
  boards(ctx, 8.8, 77.1, 14.9, 77.9, 1.1, r);
  boards(ctx, 8.8, 61.2, 10.4, 61.0, 1.0, r);

  // Sparks from the forge fire and anvil, steam from the pot (emitted only when the player is nearby)
  let sT = 0;
  let vT = 0;
  ctx.extras.push((dt, _t, vfx) => {
    if (Math.hypot(vfx.camPos.x - CX, vfx.camPos.z - CZ) > 55) return;
    sT += dt;
    vT += dt;
    while (sT > 0.18) {
      sT -= 0.18;
      const s = sparks[Math.floor(Math.random() * sparks.length)];
      if (!s) break;
      vfx.emit({ pos: new THREE.Vector3(s[0], s[1], s[2]), count: 2, color: [0xffd070, 0xff8a30], speed: [1.2, 2.8], dir: new THREE.Vector3(0, 1, 0), spread: 0.8, life: [0.3, 0.7], size: [0.03, 0.06], sizeEnd: 0.01, drag: 0.8, gravity: 5, intensity: 2.5 });
    }
    while (vT > 0.25) {
      vT -= 0.25;
      const s = steam[0];
      if (!s) break;
      vfx.emit({ pos: new THREE.Vector3(s[0] + (Math.random() - 0.5) * 0.3, s[1], s[2] + (Math.random() - 0.5) * 0.3), count: 1, color: [0xd8d0c8, 0xb8b0a8], speed: [0.3, 0.6], dir: new THREE.Vector3(0.1, 1, 0), spread: 0.3, life: [1.4, 2.4], size: [0.12, 0.2], sizeEnd: 0.5, drag: 0.3, intensity: 0.5 });
    }
  });
}
