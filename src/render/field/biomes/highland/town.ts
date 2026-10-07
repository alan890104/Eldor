// Windpost Station: the Wing Folk's courier station, built on the highest cliff top at the south end.
// The plaza floor is paved with a wind rose (compass) stone pattern with a giant weathervane in the center; on the west is the
// station main hall (with a tower and a letter notice board), on the east is the homing pigeon tower (flocks of pigeons circle it);
// two windmills stand on the windward west edge, and a watchtower on the cliff edge in the northeast corner (looking toward the
// Seal Tower).
// The Wing Folk's round tower houses have a "perch door" and a small balcony on the second floor, because they fly home; the wing-roof
// houses have eaves that curve up like folded wings, with perches jutting from the gables.
// A wooden launch deck juts out from the rock tongue to the south.

import * as THREE from 'three';
import { M, MS, PropBatch } from '../../../arenaKit.ts';
import { GlowSet, segM, V, catenary } from '../../../arenas/_woods.ts';
import { sceneMaterial } from '../../../spiritToon.ts';
import { inkScenery } from '../../../ink.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import type { Anim } from './anim.ts';
import { banner, bird } from './fx.ts';
import { C, featherFlag, flagPole, flagRail, windLamp, WIND_RY } from './props.ts';
import { TOWN, WX, WZ } from './shape.ts';

const T = {
  stone: 0xc4baa8,
  stoneDark: 0x9a9084,
  wall: 0xf2eadb,
  timber: 0x8a6a48,
  timberDark: 0x5e4634,
  roofs: [0x3f9fbf, 0x5b83b8, 0x2f86a0],
  /** Wing-roof house roofs: apricot, straw yellow, gray-blue, so a few warm colors pop out from all the blue roofs */
  warm: [0xe0955a, 0xe3b964, 0x4d8f9c],
  gold: 0xf2c66a,
  window: 0xffe0a0,
};

const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);

/** Matrix of the local coordinates with (x, z) as the origin, facing f (local +z points to (sin f, cos f)) */
function frame(x: number, z: number, f: number) {
  const c = Math.cos(f);
  const s = Math.sin(f);
  return (lx: number, ly: number, lz: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
    new THREE.Matrix4().compose(V(x + c * lx + s * lz, ly, z - s * lx + c * lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, f + ry, rz)), V(sx, sy, sz));
}

/** Emissive things (windows, lamps) must add lift themselves */
function lifted(ctx: FieldCtx, m: THREE.Matrix4): THREE.Matrix4 {
  return m.premultiply(new THREE.Matrix4().makeTranslation(0, ctx.b.lift, 0));
}

// ───────────────────────── Buildings ─────────────────────────

/**
 * Wing Folk round tower house: stone base, white walls, wooden ring band, ground-floor door,
 * second-floor perch door and small balcony, pointed conical roof
 */
function roundHouse(ctx: FieldCtx, anim: Anim, glow: GlowSet, x: number, z: number, R: number, H: number, face: number, roof: number): void {
  const { b, r } = ctx;
  const g = ctx.place(x, z, R);
  const L = frame(x, z, face);
  b.add(new THREE.CylinderGeometry(R + 0.25, R + 0.35, 1.0, 12), T.stone, L(0, 0.3, 0));
  b.add(new THREE.CylinderGeometry(R, R, H, 12), T.wall, L(0, H / 2 + 0.5, 0));
  for (const y of [H * 0.5 + 0.5, H + 0.4]) b.add(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.22, 12), T.timber, L(0, y, 0));
  // Door
  b.add(BOX, T.timberDark, L(0, 1.4, R - 0.02, 0, 0.95, 1.8, 0.2));
  b.add(BOX, T.timber, L(0, 2.38, R + 0.02, 0, 1.25, 0.18, 0.25));
  // Windows
  for (const a of [0.9, -1.1, 2.4]) glow.add(BOX, lifted(ctx, L(Math.sin(a) * (R - 0.02), H * 0.3 + 0.9, Math.cos(a) * (R - 0.02), a, 0.5, 0.6, 0.12)));
  // Second-floor perch door and balcony
  const pa = face > 0 ? 2.2 : -2.2;
  const pa2 = pa + (r() - 0.5) * 0.4;
  const px = Math.sin(pa2);
  const pz = Math.cos(pa2);
  b.add(BOX, T.timberDark, L(px * (R - 0.02), H * 0.72 + 0.5, pz * (R - 0.02), pa2, 0.8, 1.4, 0.18));
  b.add(BOX, T.timber, L(px * (R + 0.55), H * 0.72 - 0.25, pz * (R + 0.55), pa2, 1.3, 0.12, 1.1));
  for (const s of [-0.45, 0.45]) {
    const ox = Math.cos(pa2) * s;
    const oz = -Math.sin(pa2) * s;
    b.add(CYL, T.timberDark, segM(V(x + px * R + ox, H * 0.72 - 1.3, z + pz * R + oz), V(x + px * (R + 0.9) + ox, H * 0.72 - 0.3, z + pz * (R + 0.9) + oz), 0.06));
  }
  // Roof
  const rh = R * 1.5;
  b.add(new THREE.ConeGeometry(R * 1.32, rh, 12), roof, L(0, H + 0.5 + rh / 2, 0));
  b.add(new THREE.CylinderGeometry(R * 1.34, R * 1.34, 0.14, 12), T.timberDark, L(0, H + 0.52, 0));
  b.add(new THREE.SphereGeometry(0.2, 8, 6), T.gold, L(0, H + 0.5 + rh + 0.15, 0));
  b.add(CYL, T.timberDark, L(0, H + rh + 1.2, 0, 0, 0.04, 1.4, 0.04));
  banner(anim.flags, x, g + H + rh + 1.85, z, 1.4, 0.3, [new THREE.Color(C.cloth[Math.floor(r() * C.cloth.length)])], r() * 6, 0.6, true);
  ctx.solids.add(x, z, R + 0.35);
}

/**
 * Wing-roof house: the Wing Folk's other kind of home. A rectangular stone-based timber house whose two roof slopes curve up at the
 * eaves, like folded wings; a feather ornament stands at each end of the ridge, a perch juts from the front gable (homing pigeons and
 * Wing Folk both land here), and a windsock hangs on the back gable.
 */
function wingHouse(ctx: FieldCtx, anim: Anim, glow: GlowSet, x: number, z: number, face: number, roof: number, W = 4.4, D = 5.4, H = 3.3): void {
  const { b, r } = ctx;
  const g = ctx.place(x, z, Math.max(W, D) / 2);
  const L = frame(x, z, face);
  const y0 = H + 0.7;
  b.add(BOX, T.stone, L(0, 0.3, 0, 0, W + 0.5, 1.0, D + 0.5));
  b.add(BOX, T.stoneDark, L(0, 1.0, 0, 0, W + 0.08, 0.6, D + 0.08));
  b.add(BOX, T.wall, L(0, H / 2 + 0.75, 0, 0, W, H - 0.1, D));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(BOX, T.timberDark, L((sx * W) / 2, H / 2 + 0.75, (sz * D) / 2, 0, 0.26, H, 0.26));
  b.add(BOX, T.timberDark, L(0, y0 - 0.05, 0, 0, W + 0.12, 0.22, D + 0.12));
  // Gable (solid triangular prism)
  const pitch = 0.6;
  const rise = (W / 2) * Math.tan(pitch);
  const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, rise)]);
  const gable = new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: false });
  gable.translate(0, 0, -D / 2);
  b.add(gable, T.wall, L(0, y0, 0));
  // Two roof slopes + upturned eave corners
  const over = 0.7;
  const len = (W / 2 + over) / Math.cos(pitch);
  const flick = 0.95;
  for (const s of [-1, 1]) {
    const cx = (s * (W / 2 + over)) / 2;
    const cy = y0 + rise - ((W / 2 + over) * Math.tan(pitch)) / 2 + 0.12;
    b.add(BOX, roof, L(cx, cy, 0, 0, len + 0.05, 0.2, D + 1.1, 0, -s * pitch));
    const ex = s * (W / 2 + over);
    const ey = y0 + rise - (W / 2 + over) * Math.tan(pitch) + 0.12;
    b.add(BOX, roof, L(ex + (s * Math.cos(0.3) * flick) / 2, ey + (Math.sin(0.3) * flick) / 2 - 0.02, 0, 0, flick, 0.18, D + 1.1, 0, s * 0.3));
    // Timber strips under the eaves
    b.add(BOX, T.timberDark, L(ex * 0.98, ey - 0.2, 0, 0, 0.16, 0.16, D + 1.2));
  }
  b.add(BOX, T.timberDark, L(0, y0 + rise + 0.2, 0, 0, 0.24, 0.24, D + 1.4));
  // Feather ornaments at the ridge ends
  for (const s of [-1, 1]) {
    const f = new THREE.ConeGeometry(0.2, 1.5, 5);
    f.scale(1, 1, 0.35);
    f.rotateX(s * 0.75);
    b.add(f, s > 0 ? T.gold : C.cloth[1], L(0, y0 + rise + 0.75, s * (D / 2 + 0.75)));
  }
  // Front: door, door canopy, two windows, round gable window
  b.add(BOX, T.timberDark, L(0, 1.55, D / 2 + 0.02, 0, 1.0, 1.9, 0.18));
  b.add(new THREE.BoxGeometry(1.8, 0.14, 0.9).rotateX(0.35), roof, L(0, 2.8, D / 2 + 0.45));
  for (const lx of [-1.4, 1.4]) glow.add(BOX, lifted(ctx, L(lx, 2.2, D / 2 + 0.02, 0, 0.6, 0.75, 0.1)));
  for (const s of [-1, 1]) {
    b.add(new THREE.TorusGeometry(0.42, 0.09, 5, 12), T.timberDark, L(0, y0 + rise * 0.42, s * (D / 2 + 0.05)));
    glow.add(new THREE.CircleGeometry(0.38, 10), lifted(ctx, L(0, y0 + rise * 0.42, s * (D / 2 + 0.07), s > 0 ? 0 : Math.PI)));
  }
  // Side windows and flower beds
  for (const s of [-1, 1]) {
    for (const lz of [-1.3, 1.3]) glow.add(BOX, lifted(ctx, L(s * (W / 2 + 0.02), 2.2, lz, Math.PI / 2, 0.6, 0.7, 0.1)));
    b.add(BOX, T.timber, L(s * (W / 2 + 0.2), 1.72, 0, 0, 0.35, 0.28, 3.6));
    for (let k = 0; k < 6; k++) b.add(new THREE.IcosahedronGeometry(0.16, 0), [0xffc3d8, 0xfff6ec, 0xffe07a][k % 3], L(s * (W / 2 + 0.22), 1.95, -1.5 + k * 0.6), false);
  }
  // Perch (juts out from the front gable)
  const p0 = new THREE.Vector3().setFromMatrixPosition(L(0, y0 + rise * 0.8, D / 2));
  const p1 = new THREE.Vector3().setFromMatrixPosition(L(0, y0 + rise * 0.8 + 0.25, D / 2 + 1.7));
  b.add(CYL, T.timber, segM(p0, p1, 0.08));
  const p2 = new THREE.Vector3().setFromMatrixPosition(L(0, y0 + rise * 0.8 + 0.25, D / 2 + 1.55));
  b.add(BOX, T.timberDark, M(p2.x, p2.y + 0.08, p2.z, face + Math.PI / 2).multiply(new THREE.Matrix4().makeScale(0.9, 0.07, 0.07)));
  // Windsock on the back gable
  const sp = new THREE.Vector3().setFromMatrixPosition(L(0, 0, -D / 2 - 0.2));
  b.add(CYL, T.timberDark, L(0, y0 + rise + 0.9, -D / 2 - 0.2, 0, 0.05, 2.2, 0.05));
  banner(anim.flags, sp.x, g + y0 + rise + 1.9, sp.z, 1.6, 0.42, [new THREE.Color(C.cloth[2]), new THREE.Color(C.cloth[1]), new THREE.Color(C.cloth[4])], r() * 6, 0.75, false);
  for (const lz of [-D / 4, D / 4]) {
    const p = new THREE.Vector3().setFromMatrixPosition(L(0, 0, lz));
    ctx.solids.add(p.x, p.z, W / 2 + 0.55);
  }
}

/**
 * Station main hall: stone base, half-timbered long house, steep blue roof, porch and signboard at the main door,
 * round gable window; a tower is attached beside it
 */
function postHouse(ctx: FieldCtx, anim: Anim, glow: GlowSet, x: number, z: number, face: number): void {
  const { b } = ctx;
  const g = ctx.place(x, z, 4.5);
  const L = frame(x, z, face);
  const W = 6.4;
  const D = 10;
  const H = 5;
  b.add(BOX, T.stone, L(0, 0.3, 0, 0, D + 0.6, 1.2, W + 0.6));
  b.add(BOX, T.wall, L(0, H / 2 + 0.8, 0, 0, D, H, W));
  // Half-timber posts and beams
  for (const lx of [-D / 2, -D / 4, 0, D / 4, D / 2]) for (const lz of [-W / 2, W / 2]) b.add(BOX, T.timberDark, L(lx, H / 2 + 0.8, lz * 1.005, 0, 0.26, H, 0.26));
  for (const lz of [-W / 2, W / 2]) for (const y of [0.9, H * 0.55 + 0.8, H + 0.7]) b.add(BOX, T.timberDark, L(0, y, lz * 1.01, 0, D + 0.1, 0.2, 0.22));
  // Steep roof (gable along the long side)
  const roofH = 3.4;
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  prism.rotateX(Math.PI / 2);
  prism.rotateZ(Math.PI);
  prism.rotateY(Math.PI / 2);
  b.add(prism, T.roofs[1], L(0, H + 0.8 + roofH / 3 + 0.05, 0, 0, D + 1.2, roofH / 1.5, ((W + 1.4) * 0.5) / 0.866));
  b.add(BOX, T.timberDark, L(0, H + 0.8 + roofH, 0, 0, D + 1.4, 0.22, 0.22));
  // Dormer on the ridge
  for (const lx of [-2.6, 2.6]) {
    b.add(BOX, T.wall, L(lx, H + 1.9, W / 2 - 0.9, 0, 1.3, 1.3, 1.2));
    b.add(new THREE.ConeGeometry(1.05, 0.9, 4), T.roofs[1], L(lx, H + 2.95, W / 2 - 0.9, Math.PI / 4));
    glow.add(BOX, lifted(ctx, L(lx, H + 1.9, W / 2 - 0.28, 0, 0.6, 0.6, 0.1)));
  }
  // Main door (facing +z): porch, double doors, signboard
  b.add(BOX, T.timberDark, L(0, 1.7, W / 2 + 0.02, 0, 1.8, 2.4, 0.18));
  b.add(BOX, T.gold, L(0, 1.7, W / 2 + 0.1, 0, 0.08, 2.3, 0.05));
  for (const lx of [-1.6, 1.6]) b.add(CYL, T.timber, L(lx, 1.6, W / 2 + 1.5, 0, 0.16, 3.2, 0.16));
  b.add(BOX, T.roofs[0], L(0, 3.35, W / 2 + 0.9, 0, 4.2, 0.18, 2.2, 0.22));
  b.add(BOX, T.timber, L(0, 3.9, W / 2 + 1.55, 0, 2.4, 0.9, 0.12));
  // Envelope on the signboard
  b.add(BOX, T.wall, L(0, 3.9, W / 2 + 1.63, 0, 0.9, 0.55, 0.05));
  b.add(BOX, T.gold, L(0, 3.95, W / 2 + 1.67, 0, 0.12, 0.12, 0.05));
  // Windows
  for (const lx of [-3.2, -1.1, 1.1 + 2.1]) glow.add(BOX, lifted(ctx, L(lx, 2.2, W / 2 + 0.02, 0, 0.8, 1.0, 0.1)));
  for (const lx of [-3, 0, 3]) glow.add(BOX, lifted(ctx, L(lx, 2.2, -W / 2 - 0.02, 0, 0.8, 1.0, 0.1)));
  // Round gable window
  for (const s of [-1, 1]) {
    b.add(new THREE.TorusGeometry(0.6, 0.12, 6, 14), T.timberDark, L((s * (D + 0.05)) / 2, H + 1.6, 0, Math.PI / 2));
    glow.add(new THREE.CircleGeometry(0.55, 12), lifted(ctx, L((s * (D + 0.12)) / 2, H + 1.6, 0, (s * Math.PI) / 2)));
  }
  // Tower (at a rear corner of the building)
  const tx = -D / 2 + 0.8;
  const tz = -W / 2 + 0.4;
  const TH = 10.5;
  b.add(new THREE.CylinderGeometry(2.1, 2.3, 1, 10), T.stone, L(tx, 0.4, tz));
  b.add(new THREE.CylinderGeometry(1.85, 1.95, TH, 10), T.wall, L(tx, TH / 2 + 0.8, tz));
  for (const y of [4.2, 7.6, TH + 0.6]) b.add(new THREE.CylinderGeometry(1.93, 1.93, 0.2, 10), T.timberDark, L(tx, y, tz));
  for (const a of [0.5, 2.1, 3.7, 5.3]) glow.add(BOX, lifted(ctx, L(tx + Math.sin(a) * 1.9, 9, tz + Math.cos(a) * 1.9, a, 0.45, 0.7, 0.1)));
  b.add(new THREE.ConeGeometry(2.5, 3.6, 10), T.roofs[0], L(tx, TH + 0.8 + 1.8, tz));
  b.add(new THREE.SphereGeometry(0.22, 8, 6), T.gold, L(tx, TH + 4.75, tz));
  b.add(CYL, T.timberDark, L(tx, TH + 5.7, tz, 0, 0.05, 2, 0.05));
  const tw = new THREE.Vector3().setFromMatrixPosition(L(tx, 0, tz));
  banner(anim.flags, tw.x, g + TH + 6.6, tw.z, 3.6, 0.8, [new THREE.Color(C.cloth[0]), new THREE.Color(C.cloth[1]), new THREE.Color(C.cloth[0])], 1.1, 0.7, true);
  // Large weathervane on the roof (the arrow points toward where the wind comes from)
  const vx = new THREE.Vector3().setFromMatrixPosition(L(D / 4, 0, 0));
  weathervane(ctx, anim, vx.x, g + H + 0.8 + roofH + 0.1, vx.z, 1.2);
  // Notice board by the door (pinned full of letters)
  const nb = L(3.4, 0, W / 2 + 2.6, 0.3);
  b.add(BOX, T.timberDark, nb.clone().multiply(new THREE.Matrix4().compose(V(0, 1.1, 0), new THREE.Quaternion(), V(1.9, 1.3, 0.12))));
  for (const [sx, sy] of [[-0.5, 1.3], [0.2, 1.4], [0.6, 1.0], [-0.2, 0.9], [-0.65, 0.85]]) b.add(BOX, T.wall, nb.clone().multiply(new THREE.Matrix4().compose(V(sx, sy, 0.08), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (sx - sy) * 0.3)), V(0.34, 0.26, 0.02))));
  for (const s of [-0.85, 0.85]) b.add(BOX, T.timberDark, nb.clone().multiply(new THREE.Matrix4().compose(V(s, 0.8, 0), new THREE.Quaternion(), V(0.12, 1.6, 0.12))));
  const nbp = new THREE.Vector3().setFromMatrixPosition(nb);
  ctx.solids.add(nbp.x, nbp.z, 0.6);
  for (const lx of [-3, 0, 3]) {
    const p = new THREE.Vector3().setFromMatrixPosition(L(lx, 0, 0));
    ctx.solids.add(p.x, p.z, 3.6);
  }
  const tp = new THREE.Vector3().setFromMatrixPosition(L(tx, 0, tz));
  ctx.solids.add(tp.x, tp.z, 2.3);
}

/**
 * Weathervane: an arrow (feathers as the tail) pointing toward where the wind comes from,
 * with a golden cross of the four compass directions below
 */
function weathervane(ctx: FieldCtx, anim: Anim, x: number, y: number, z: number, s: number): void {
  const { b } = ctx;
  b.lift = 0;
  b.add(CYL, T.timberDark, M(x, y + 0.9 * s, z).multiply(new THREE.Matrix4().makeScale(0.06 * s, 1.8 * s, 0.06 * s)));
  for (let i = 0; i < 4; i++) b.add(BOX, T.gold, M(x, y + 0.9 * s, z, (i * Math.PI) / 2).multiply(new THREE.Matrix4().makeScale(0.05 * s, 0.05 * s, 1.1 * s)));
  const pivot = new THREE.Group();
  pivot.position.set(x, y + 1.7 * s, z);
  const vb = new THREE.Group();
  const mat = sceneMaterial(T.gold, { rim: 0.5, surface: 'metal' });
  const arrow = new THREE.ConeGeometry(0.16 * s, 0.5 * s, 4);
  arrow.rotateX(-Math.PI / 2);
  arrow.translate(0, 0, -0.95 * s);
  const shaft = new THREE.BoxGeometry(0.05 * s, 0.05 * s, 1.5 * s);
  const tail = new THREE.BoxGeometry(0.03 * s, 0.5 * s, 0.6 * s);
  tail.translate(0, 0.08 * s, 0.75 * s);
  for (const g of [arrow, shaft, tail]) vb.add(new THREE.Mesh(g, mat));
  inkScenery(vb);
  pivot.add(vb);
  ctx.group.add(pivot);
  // The arrow (local -z) points toward where the wind comes from (-W)
  const base = WIND_RY;
  anim.ticks.push((_dt, t) => (pivot.rotation.y = base + Math.sin(t * 1.7) * 0.12 + Math.sin(t * 4.1) * 0.04));
  ctx.disposers.push(() => {
    mat.dispose();
    arrow.dispose();
    shaft.dispose();
    tail.dispose();
  });
}

/**
 * Homing pigeon tower: stone base and white shaft, rings of pigeon holes and perches, a small lamplit pavilion on top;
 * flocks of pigeons circle the tower
 */
function dovecote(ctx: FieldCtx, anim: Anim, glow: GlowSet, x: number, z: number): void {
  const { b, r } = ctx;
  const g = ctx.place(x, z, 2.6);
  const R = 2.4;
  const H = 11;
  b.add(new THREE.CylinderGeometry(R + 0.35, R + 0.55, 3.2, 12), T.stone, M(x, 1.3, z));
  b.add(new THREE.CylinderGeometry(R, R + 0.1, H - 3, 12), T.wall, M(x, 3 + (H - 3) / 2, z));
  b.add(BOX, T.timberDark, M(x + Math.sin(-0.4) * (R + 0.4), 1.2, z + Math.cos(-0.4) * (R + 0.4), -0.4).multiply(new THREE.Matrix4().makeScale(1, 1.9, 0.2)));
  for (let ring = 0; ring < 4; ring++) {
    const y = 4.2 + ring * 1.75;
    b.add(new THREE.CylinderGeometry(R + 0.32, R + 0.32, 0.12, 14), T.timber, M(x, y - 0.35, z));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + ring * 0.3;
      b.add(BOX, 0x3a3440, M(x + Math.sin(a) * (R + 0.01), y, z + Math.cos(a) * (R + 0.01), a).multiply(new THREE.Matrix4().makeScale(0.36, 0.44, 0.08)), false);
    }
  }
  // Viewing pavilion on top
  b.add(new THREE.CylinderGeometry(R + 0.9, R + 0.7, 0.3, 14), T.timber, M(x, H + 0.1, z));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.add(CYL, T.timberDark, M(x + Math.sin(a) * (R + 0.6), H + 0.9, z + Math.cos(a) * (R + 0.6)).multiply(new THREE.Matrix4().makeScale(0.08, 1.6, 0.08)));
  }
  glow.add(new THREE.CylinderGeometry(0.7, 0.7, 1.1, 8), lifted(ctx, M(x, H + 0.85, z)));
  b.add(new THREE.ConeGeometry(R + 1.3, 2.6, 14), T.roofs[2], M(x, H + 1.7 + 1.3, z));
  b.add(new THREE.SphereGeometry(0.28, 8, 6), T.gold, M(x, H + 4.45, z));
  b.add(CYL, T.timberDark, M(x, H + 5.3, z).multiply(new THREE.Matrix4().makeScale(0.05, 1.8, 0.05)));
  banner(anim.flags, x, g + H + 6.1, z, 2.6, 0.55, [new THREE.Color(C.cloth[3]), new THREE.Color(C.cloth[1])], 2.3, 0.7, true);
  ctx.solids.add(x, z, R + 0.6);
  // Flock of pigeons
  const flock = anim.flock(x, g + H + 3, z, 0.55);
  const white = new THREE.Color(0xf8f6f0);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3;
    const rr = 7 + r() * 5;
    const y = g + H + 1 + r() * 5;
    bird(flock, x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, -a, 0.45 + r() * 0.15, white, r() * 6);
  }
}

/** Watchtower: octagonal stone shaft, wooden platform and railing, lookout pavilion, pointed roof and long flag */
function watchtower(ctx: FieldCtx, anim: Anim, glow: GlowSet, x: number, z: number): void {
  const { b } = ctx;
  const g = ctx.place(x, z, 2);
  b.add(new THREE.CylinderGeometry(1.5, 2.0, 7.5, 8), 0xbdb5a8, M(x, 3.5, z, 0.2));
  for (const y of [2.4, 5.2]) b.add(new THREE.CylinderGeometry(1.8, 1.85, 0.35, 8), T.stoneDark, M(x, y, z, 0.2));
  b.add(new THREE.CylinderGeometry(2.5, 2.1, 0.4, 8), 0x8c6a48, M(x, 7.4, z, 0.2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    b.add(BOX, T.timberDark, M(x + Math.cos(a) * 2.25, 8.0, z + Math.sin(a) * 2.25, -a).multiply(new THREE.Matrix4().makeScale(0.12, 0.9, 0.12)));
  }
  b.add(new THREE.TorusGeometry(2.25, 0.05, 5, 16), T.timberDark, M(x, 8.4, z, 0, 1, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(1.4, 1.4, 1.9, 8), T.wall, M(x, 8.6, z, 0.2));
  b.add(new THREE.ConeGeometry(2.5, 2.4, 8), T.roofs[0], M(x, 10.75, z, 0.2));
  b.add(new THREE.SphereGeometry(0.28, 8, 6), T.gold, M(x, 12.0, z));
  b.add(CYL, T.timberDark, M(x, 13.3, z).multiply(new THREE.Matrix4().makeScale(0.05, 2.6, 0.05)));
  for (const a of [0.4, 1.4, 2.6, 3.6, 4.8]) glow.add(BOX, lifted(ctx, M(x + Math.cos(a) * 1.4, 8.7, z + Math.sin(a) * 1.4, -a).multiply(new THREE.Matrix4().makeScale(0.34, 0.5, 0.1))));
  b.add(BOX, T.timberDark, M(x - 1.4, 0.8, z + 1.2, Math.PI / 4).multiply(new THREE.Matrix4().makeScale(0.9, 1.6, 0.3)));
  banner(anim.flags, x, g + 14.4, z, 4.2, 0.95, [new THREE.Color(C.cloth[0]), new THREE.Color(C.cloth[0]), new THREE.Color(C.cloth[1]), new THREE.Color(C.cloth[1])], 0.7, 0.85, true);
  ctx.solids.add(x, z, 2.1);
}

/** Windmill blades (four wooden arms + canvas sails); in the local xy plane, rotating about the z axis */
function millBladeGeos(): { wood: THREE.BufferGeometry; sail: THREE.BufferGeometry } {
  const woods: THREE.BufferGeometry[] = [];
  const sails: THREE.BufferGeometry[] = [];
  woods.push(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8).rotateX(Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const arm = new THREE.BoxGeometry(0.16, 4.2, 0.12);
    arm.translate(0, 2.2, 0.08);
    arm.rotateZ(a);
    woods.push(arm);
    const sail = new THREE.BoxGeometry(1.05, 3.1, 0.04);
    sail.translate(0.62, 2.55, 0.06);
    sail.rotateZ(a);
    sails.push(sail);
    for (let k = 0; k < 4; k++) {
      const rung = new THREE.BoxGeometry(1.2, 0.06, 0.06);
      rung.translate(0.55, 1.2 + k * 0.85, 0.1);
      rung.rotateZ(a);
      woods.push(rung);
    }
  }
  const merge = (list: THREE.BufferGeometry[]) => {
    const all = list.map((g) => g.toNonIndexed());
    const pos: number[] = [];
    for (const g of all) pos.push(...(g.getAttribute('position').array as Float32Array));
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.computeVertexNormals();
    return out;
  };
  return { wood: merge(woods), sail: merge(sails) };
}

let bladeGeos: { wood: THREE.BufferGeometry; sail: THREE.BufferGeometry } | null = null;

/** Windmill: stone shaft, wooden rings, cap; the blades are mounted on the windward side and spin */
export function windmill(ctx: FieldCtx, anim: Anim, x: number, z: number, H = 7, broken = false): void {
  const { b } = ctx;
  const g = ctx.place(x, z, 2);
  b.add(new THREE.CylinderGeometry(1.55, 2.15, H, 8), T.wall, M(x, H / 2, z, 0.3));
  b.add(new THREE.CylinderGeometry(2.3, 2.4, 0.4, 8), T.stoneDark, M(x, 0.2, z, 0.3));
  b.add(new THREE.CylinderGeometry(1.95, 1.95, 0.22, 8), T.timber, M(x, H * 0.52, z, 0.3));
  b.add(BOX, T.timberDark, M(x + WX * 2, 0.8, z + WZ * 2, WIND_RY).multiply(new THREE.Matrix4().makeScale(0.9, 1.6, 0.25)));
  // Cap (the whole cap faces the wind)
  b.add(new THREE.ConeGeometry(2.0, 2.0, 8), broken ? 0x8a8478 : T.roofs[0], M(x, H + 0.95, z, WIND_RY));
  const hub = V(x - WX * 1.85, g + H - 0.4, z - WZ * 1.85);
  b.lift = 0;
  b.add(CYL, T.timberDark, segM(V(x, g + H - 0.4, z), hub, 0.16));
  ctx.solids.add(x, z, 2.2);
  if (!bladeGeos) {
    bladeGeos = millBladeGeos();
    const bg = bladeGeos;
    ctx.disposers.push(() => {
      bg.wood.dispose();
      bg.sail.dispose();
      bladeGeos = null;
    });
  }
  const pivot = new THREE.Group();
  pivot.position.copy(hub);
  // Local +z faces the wind (-W)
  pivot.rotation.y = WIND_RY + Math.PI;
  const rotor = new THREE.Group();
  pivot.add(rotor);
  const mats = [sceneMaterial(T.timber, { rim: 0.3 }), sceneMaterial(broken ? 0xd8cfbf : 0xf4ecdc, { rim: 0.3 })];
  rotor.add(new THREE.Mesh(bladeGeos.wood, mats[0]));
  if (!broken) rotor.add(new THREE.Mesh(bladeGeos.sail, mats[1]));
  inkScenery(rotor);
  rotor.rotation.z = ctx.r() * 6;
  ctx.group.add(pivot);
  anim.spinners.push({ obj: rotor, axis: 'z', speed: broken ? 0.15 : 0.9 + ctx.r() * 0.3 });
  ctx.disposers.push(() => {
    for (const m of mats) m.dispose();
  });
}

// ───────────────────────── Plaza ─────────────────────────

/** Wind rose stone pattern: a compass design on the plaza floor (a decal) */
function windRose(ctx: FieldCtx, x: number, z: number, R: number): void {
  const cv = document.createElement('canvas');
  const S = 512;
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const c = S / 2;
  g.translate(c, c);
  const ring = (rr: number, w: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, rr, 0, Math.PI * 2);
    g.stroke();
  };
  g.fillStyle = 'rgba(196,184,160,0.97)';
  g.beginPath();
  g.arc(0, 0, c - 4, 0, Math.PI * 2);
  g.fill();
  ring(c - 10, 12, 'rgba(92,80,66,0.95)');
  ring(c - 36, 5, 'rgba(92,80,66,0.8)');
  ring(c * 0.34, 6, 'rgba(92,80,66,0.85)');
  // Rays of the sixteen wind directions
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const long = i % 4 === 0 ? 0.92 : i % 2 === 0 ? 0.66 : 0.48;
    const w = i % 4 === 0 ? 0.13 : 0.09;
    for (const side of [-1, 1]) {
      const main = i % 4 === 0;
      const mid = !main && i % 2 === 0;
      g.fillStyle = side > 0 ? (main ? '#2f8fb4' : mid ? '#e8b85a' : '#9cc6d2') : main ? '#1c5d78' : mid ? '#b98a38' : '#6f9aa8';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * (c - 40) * long, Math.sin(a) * (c - 40) * long);
      g.lineTo(Math.cos(a + side * w) * c * 0.22, Math.sin(a + side * w) * c * 0.22);
      g.closePath();
      g.fill();
    }
  }
  g.fillStyle = '#f2c66a';
  g.beginPath();
  g.arc(0, 0, c * 0.1, 0, Math.PI * 2);
  g.fill();
  // Joints between the flagstones
  g.strokeStyle = 'rgba(110,98,84,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * (c - 36), Math.sin(a) * (c - 36));
    g.lineTo(Math.cos(a) * (c - 10), Math.sin(a) * (c - 10));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const geo = new THREE.CircleGeometry(R, 48);
  geo.rotateX(-Math.PI / 2);
  // North (-z) aligned with map north
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, ctx.h(x, z) + 0.04, z);
  m.renderOrder = 1;
  ctx.group.add(m);
  // A slightly raised curb ring on the outside so the pattern still reads from afar
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * (R + 0.3);
    const pz = z + Math.sin(a) * (R + 0.3);
    ctx.place(px, pz, 0.4);
    ctx.b.add(BOX, i % 7 === 0 ? T.gold : T.stoneDark, M(px, 0.06, pz, -a).multiply(new THREE.Matrix4().makeScale(0.55, 0.22, ((R + 0.3) * Math.PI * 2) / n - 0.12)));
  }
  ctx.b.lift = 0;
  ctx.disposers.push(() => {
    tex.dispose();
    mat.dispose();
    geo.dispose();
  });
}

/** Wind monument in the middle of the plaza: stone base, a stone pillar carved with wind patterns, a large weathervane on top */
function windMonument(ctx: FieldCtx, anim: Anim, glow: GlowSet, x: number, z: number): void {
  const { b } = ctx;
  const g = ctx.place(x, z, 1.5);
  b.add(new THREE.CylinderGeometry(1.7, 1.9, 0.5, 8), T.stone, M(x, 0.25, z, Math.PI / 8));
  b.add(new THREE.CylinderGeometry(1.2, 1.4, 0.6, 8), T.stoneDark, M(x, 0.75, z, Math.PI / 8));
  b.add(new THREE.CylinderGeometry(0.45, 0.6, 4.2, 8), T.wall, M(x, 3.1, z, Math.PI / 8));
  for (const y of [1.3, 3.0, 4.8]) b.add(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 8), T.gold, M(x, y, z, Math.PI / 8));
  glow.add(new THREE.OctahedronGeometry(0.32), lifted(ctx, M(x, 5.4, z)));
  weathervane(ctx, anim, x, g + 5.6, z, 1.6);
  ctx.solids.add(x, z, 1.9);
}

// ───────────────────────── Small things ─────────────────────────

function crates(ctx: FieldCtx, x: number, z: number, n: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1);
  for (let i = 0; i < n; i++) {
    const s = 0.55 + r() * 0.35;
    const px = x + (r() - 0.5) * 1.8;
    const pz = z + (r() - 0.5) * 1.8;
    if (r() < 0.5) {
      b.add(BOX, 0xa07a50, M(px, s / 2, pz, r()).multiply(new THREE.Matrix4().makeScale(s, s, s)));
      b.add(BOX, 0x7a5a3a, M(px, s / 2, pz, r()).multiply(new THREE.Matrix4().makeScale(s * 1.02, s * 0.15, s * 1.02)));
    } else {
      // Mail bag
      const g = new THREE.SphereGeometry(1, 8, 6);
      b.add(g, 0xe8dcc0, MS(px, s * 0.35, pz, s * 0.5, s * 0.45, s * 0.4, r() * 6));
      b.add(new THREE.ConeGeometry(0.12, 0.25, 5), 0xc9a870, M(px, s * 0.8, pz));
    }
  }
  ctx.solids.add(x, z, 1.1);
}

function bench(ctx: FieldCtx, x: number, z: number, f: number): void {
  const { b } = ctx;
  ctx.place(x, z, 0.8);
  const L = frame(x, z, f);
  b.add(BOX, T.timber, L(0, 0.45, 0, 0, 1.8, 0.1, 0.5));
  b.add(BOX, T.timber, L(0, 0.85, -0.22, 0, 1.8, 0.4, 0.08));
  for (const s of [-0.75, 0.75]) b.add(BOX, T.timberDark, L(s, 0.22, 0, 0, 0.1, 0.45, 0.45));
  ctx.solids.add(x, z, 0.7);
}

/** Telescope (a lookout spot at the cliff edge) */
function telescope(ctx: FieldCtx, x: number, z: number, f: number): void {
  const { b } = ctx;
  ctx.place(x, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(CYL, T.timberDark, segM(V(x + Math.cos(a) * 0.45, 0, z + Math.sin(a) * 0.45), V(x, 1.3, z), 0.035));
  }
  const tube = new THREE.CylinderGeometry(0.09, 0.13, 1.1, 8);
  b.add(tube, T.gold, M(x + Math.sin(f) * 0.2, 1.42, z + Math.cos(f) * 0.2, f, 1, Math.PI / 2 - 0.25));
  ctx.solids.add(x, z, 0.5);
}

// ───────────────────────── Launch deck ─────────────────────────

/**
 * Launch deck: a wooden platform on the rock tongue extending out past the cliff, railings on both sides,
 * and at the far end a tall pole with a windsock and a signal bell
 */
function launchDeck(ctx: FieldCtx, anim: Anim, a: XZ, c: XZ, extra: number): void {
  const { b } = ctx;
  const dx = c[0] - a[0];
  const dz = c[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const ang = Math.atan2(ux, uz);
  const y = ctx.h(a[0], a[1]) + 0.35;
  b.lift = 0;
  const total = len + extra;
  const n = Math.round(total / 0.62);
  const W = 3.6;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * total;
    const x = a[0] + ux * t;
    const z = a[1] + uz * t;
    b.add(BOX, i % 2 ? 0x9a7650 : 0x8a6a48, M(x, y, z, ang).multiply(new THREE.Matrix4().makeScale(W, 0.14, 0.58)));
  }
  // Main beam
  for (const s of [-1, 1]) {
    const sx = -uz * s * (W / 2 - 0.2);
    const sz = ux * s * (W / 2 - 0.2);
    b.add(CYL, T.timberDark, segM(V(a[0] + sx, y - 0.2, a[1] + sz), V(a[0] + ux * total + sx, y - 0.2, a[1] + uz * total + sz), 0.12));
    // Diagonal braces: support the part sticking out from the cliff wall
    for (const k of [0.25, 0.7, 1]) {
      const t = len + extra * k;
      const top = V(a[0] + ux * t + sx, y - 0.2, a[1] + uz * t + sz);
      const foot = V(a[0] + ux * (len - 1.5) + sx * 0.8, y - 5.5 - k * 2, a[1] + uz * (len - 1.5) + sz * 0.8);
      b.add(CYL, T.timberDark, segM(foot, top, 0.1));
    }
  }
  // Railings (the far end is left open: that is where you take off)
  const rails: XZ[][] = [-1, 1].map((s) => [
    [a[0] - uz * s * (W / 2 - 0.1), a[1] + ux * s * (W / 2 - 0.1)],
    [a[0] + ux * (total - 1.2) - uz * s * (W / 2 - 0.1), a[1] + uz * (total - 1.2) + ux * s * (W / 2 - 0.1)],
  ]);
  for (const rl of rails) {
    const [p0, p1] = rl;
    const m = Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 1.6);
    const posts: THREE.Vector3[] = [];
    for (let i = 0; i <= m; i++) {
      const x = p0[0] + ((p1[0] - p0[0]) * i) / m;
      const z = p0[1] + ((p1[1] - p0[1]) * i) / m;
      b.add(BOX, T.timberDark, M(x, y + 0.55, z).multiply(new THREE.Matrix4().makeScale(0.12, 1.1, 0.12)));
      posts.push(V(x, y + 1.05, z));
    }
    for (let i = 0; i < posts.length - 1; i++) {
      b.add(CYL, T.timber, segM(posts[i], posts[i + 1], 0.05));
      if (i % 2 === 0) featherFlag(anim, (posts[i].x + posts[i + 1].x) / 2, posts[i].y - 0.05, (posts[i].z + posts[i + 1].z) / 2, new THREE.Color(C.cloth[i % C.cloth.length]), i * 1.7, 0.9);
    }
  }
  // Far end: tall pole and windsock
  const ex = a[0] + ux * (total - 0.6) - uz * (W / 2 - 0.3);
  const ez = a[1] + uz * (total - 0.6) + ux * (W / 2 - 0.3);
  b.add(CYL, T.timberDark, M(ex, y + 3.2, ez).multiply(new THREE.Matrix4().makeScale(0.1, 6.4, 0.1)));
  b.add(new THREE.SphereGeometry(0.18, 8, 6), T.gold, M(ex, y + 6.5, ez));
  // Windsock: a string of fabric tubes getting thinner (alternating red and white)
  const sock = new THREE.Group();
  sock.position.set(ex, y + 6.0, ez);
  sock.rotation.y = WIND_RY;
  // The windsock is a double-sided open fabric tube: the outline's normal pass only draws front faces,
  // so double-sided meshes get no outline (same as before)
  const sockMats = [sceneMaterial(0xf26a5a, { rim: 0.3 }), sceneMaterial(0xf6f1e6, { rim: 0.3 })];
  const sockGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CylinderGeometry(0.38 - i * 0.06, 0.32 - i * 0.06, 0.55, 10, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, 0.35 + i * 0.55);
    sockGeos.push(g);
    const m = new THREE.Mesh(g, sockMats[i % 2]);
    m.material.side = THREE.DoubleSide;
    sock.add(m);
  }
  ctx.group.add(sock);
  anim.ticks.push((_dt, t) => {
    sock.rotation.y = WIND_RY + Math.sin(t * 2.3) * 0.1;
    sock.rotation.x = 0.08 + Math.sin(t * 3.1) * 0.05;
  });
  ctx.disposers.push(() => {
    for (const m of sockMats) m.dispose();
    for (const g of sockGeos) g.dispose();
  });
  // Signal bell
  const bx = a[0] + ux * (len - 0.5) + uz * (W / 2 + 0.2);
  const bz = a[1] + uz * (len - 0.5) - ux * (W / 2 + 0.2);
  const by = ctx.h(bx, bz);
  for (const s of [-0.6, 0.6]) b.add(CYL, T.timberDark, M(bx + ux * s, by + 1.3, bz + uz * s).multiply(new THREE.Matrix4().makeScale(0.08, 2.6, 0.08)));
  b.add(CYL, T.timberDark, segM(V(bx - ux * 0.7, by + 2.55, bz - uz * 0.7), V(bx + ux * 0.7, by + 2.55, bz + uz * 0.7), 0.07));
  b.add(new THREE.CylinderGeometry(0.2, 0.36, 0.5, 10), T.gold, M(bx, by + 2.15, bz));
  ctx.solids.add(bx, bz, 0.7);
}

// ───────────────────────── Town ─────────────────────────

export function buildTown(ctx: FieldCtx, anim: Anim): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWN;
  const glow = new GlowSet(T.window);

  // Plaza: wind rose pattern and wind monument
  windRose(ctx, tx, tz, 6.2);
  windMonument(ctx, anim, glow, tx, tz);

  // Station main hall (west side, door facing the plaza)
  postHouse(ctx, anim, glow, tx - 13.5, tz + 1, Math.PI / 2);
  crates(ctx, tx - 8.5, tz - 5.5, 5);
  crates(ctx, tx - 9, tz + 8, 4);
  // Homing pigeon tower (east side)
  dovecote(ctx, anim, glow, tx + 10.5, tz - 1.5);
  // Watchtower (cliff edge in the northeast corner: overlooks Windsong Terrace and looks toward the Seal Tower in the distance)
  watchtower(ctx, anim, glow, tx + 20, tz - 18.5);
  // Wing Folk round tower houses and wing-roof houses (all doors facing the plaza)
  roundHouse(ctx, anim, glow, tx - 8, tz + 13, 2.5, 5.2, 0.4, T.roofs[0]);
  roundHouse(ctx, anim, glow, tx + 10, tz - 11, 2.3, 5.0, -2.4, T.roofs[1]);
  wingHouse(ctx, anim, glow, tx + 6.5, tz + 11, Math.atan2(-6.5, -11), T.warm[0]);
  wingHouse(ctx, anim, glow, tx - 14, tz - 11, Math.atan2(14, 11), T.warm[1], 4.0, 5.0, 3.0);
  wingHouse(ctx, anim, glow, tx + 17.5, tz + 4, Math.atan2(-17.5, -4), T.warm[2], 4.6, 5.8, 3.6);
  // Windward west edge: two windmills
  windmill(ctx, anim, tx - 17, tz - 3, 7.5);
  windmill(ctx, anim, tx - 19, tz + 12, 6.8);

  // Feather-flag rope across the plaza (main hall tower -> pigeon tower)
  b.lift = 0;
  const g0 = ctx.h(tx, tz);
  const ropeLine = (p: THREE.Vector3, q: THREE.Vector3, sag: number, every = 2) => {
    const n = Math.max(6, Math.round(p.distanceTo(q) / 0.9));
    const pts = catenary(p, q, sag, n);
    for (let i = 0; i < n; i++) b.add(CYL, C.rope, segM(pts[i], pts[i + 1], 0.03), false);
    for (let i = 1; i < n; i += every) featherFlag(anim, pts[i].x, pts[i].y, pts[i].z, new THREE.Color(C.cloth[Math.floor(r() * C.cloth.length)]), r() * 6);
    return pts;
  };
  ropeLine(V(tx - 17.7, g0 + 10.5, tz - 1.2), V(tx + 10.5, g0 + 11, tz - 1.5), 3.2);
  ropeLine(V(tx + 10.5, g0 + 10.8, tz - 1.5), V(tx + 20, g0 + 8.3, tz - 18.5), 2.2);
  ropeLine(V(tx - 8, g0 + 8.6, tz + 13), V(tx + 6.5, g0 + 5.9, tz + 11), 1.2);

  // North exit: two tall flagpoles flank the road, with a cliff-edge lookout spot beside them
  flagPole(ctx, anim, tx - 7.5, tz - 19.8, 6.5, [C.cloth[0], C.cloth[1], C.cloth[0]], 3.6);
  flagPole(ctx, anim, tx + 6.5, tz - 19.2, 6.5, [C.cloth[2], C.cloth[1], C.cloth[2]], 3.6);
  flagRail(ctx, anim, [[tx - 20, tz - 22.5], [tx - 13, tz - 23.2], [tx - 7.5, tz - 22.8]], 2.6);
  telescope(ctx, tx - 11, tz - 21.5, Math.PI);
  bench(ctx, tx - 15.5, tz - 20.5, Math.PI);

  // Street lamps
  for (const [x, z, f] of [
    [tx - 6.5, tz - 6.5, 0.8], [tx + 6.5, tz - 6.5, -0.8], [tx - 6.8, tz + 6.2, 2.3], [tx + 6.5, tz + 6.5, -2.3],
    [tx - 2.5, tz + 17, 3.1], [tx - 5.2, tz + 22, 3.1],
  ] as const) windLamp(ctx, glow, x, z, f);
  bench(ctx, tx + 4, tz + 5.8, 2.8);
  bench(ctx, tx - 5.5, tz - 5.8, -0.6);

  // Launch deck
  launchDeck(ctx, anim, [-8.4, 92.2], [-11.6, 100.8], 5.5);

  // Small flowers and wooden crates on the outskirts of the town
  for (let i = 0; i < 24; i++) {
    const a = r() * Math.PI * 2;
    const d = 9 + r() * 10;
    const x = tx + Math.cos(a) * d;
    const z = tz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < 3.5 || ctx.solids.blocked(x, z, 1)) continue;
    ctx.place(x, z);
    for (let k = 0; k < 5; k++) b.add(new THREE.IcosahedronGeometry(0.09, 0), [0xfff6ec, 0xffe07a, 0x9ad0f0, 0xffc3d8][k % 4], M(x + (r() - 0.5) * 1.2, 0.3, z + (r() - 0.5) * 1.2), false);
  }
  // After the Seal Tower is purified, the station holds the "Windpost Festival": four festive ropes hung with feather flags
  // and paper lanterns stretch out from the wind monument, and the Wing Folk's kites fill the sky
  if (ctx.done >= ctx.floors) festival(ctx, anim, glow, ropeLine, g0);
  b.lift = 0;
  const setGlow = glow.build(ctx.group, ctx.disposers);
  anim.ticks.push((_dt, t) => setGlow(2.1 + Math.sin(t * 1.1) * 0.15));
}

function festival(ctx: FieldCtx, anim: Anim, glow: GlowSet, ropeLine: (p: THREE.Vector3, q: THREE.Vector3, sag: number, every?: number) => THREE.Vector3[], g0: number): void {
  const { b } = ctx;
  const [tx, tz] = TOWN;
  b.lift = 0;
  // Top of the wind monument -> four street lamps, like a maypole
  for (const [lx, lz] of [[-6.5, -6.5], [6.5, -6.5], [-6.8, 6.2], [6.5, 6.5]] as const) {
    const pts = ropeLine(V(tx, g0 + 4.8, tz), V(tx + lx, g0 + 2.75, tz + lz), 0.35, 1);
    for (let i = 2; i < pts.length - 1; i += 3) {
      const p = pts[i];
      b.add(CYL, C.rope, M(p.x, p.y - 0.15, p.z).multiply(new THREE.Matrix4().makeScale(0.015, 0.3, 0.015)), false);
      glow.add(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 1.25, 1), M(p.x, p.y - 0.45, p.z));
    }
  }
  // Main hall tower -> round tower house, the second long festive rope
  ropeLine(V(tx - 16.3, g0 + 11.3, tz + 5.2), V(tx - 8, g0 + 8.6, tz + 13), 1.6, 1);
  // Kites: flown from the launch deck, the south meadow and the top of the watchtower
  const deckY = ctx.h(-8.4, 92.2) + 0.42;
  kite(ctx, anim, -12.2, deckY + 1.0, 102.5, 26, 0.72, [0xf7c95c, 0x3fb2c9], 0.3);
  const lawn = ctx.place(tx + 3, tz + 19.5, 0.3);
  b.add(CYL, T.timberDark, M(tx + 3, 0.5, tz + 19.5).multiply(new THREE.Matrix4().makeScale(0.07, 1.0, 0.07)));
  b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 8).rotateZ(Math.PI / 2), T.timber, M(tx + 3, 0.75, tz + 19.5));
  b.lift = 0;
  kite(ctx, anim, tx + 3, lawn + 0.95, tz + 19.5, 20, 0.9, [0xf2a3b8, 0xf6f1e6], 1.7);
  const wg = ctx.place(tx + 20, tz - 18.5, 2);
  b.lift = 0;
  kite(ctx, anim, tx + 20 + WX * 2.25, wg + 8.35, tz - 18.5 + WZ * 2.25, 30, 0.62, [0x3fb2c9, 0xf6f1e6], 3.1);
}

/**
 * Kite: a diamond sail (two colors), a cross frame, a long bow-tie tail, with its string tied to the anchor.
 * The whole kite and its string sway in the wind around the anchor; the end of the string always stays in place.
 */
function kite(ctx: FieldCtx, anim: Anim, ax: number, ay: number, az: number, len: number, el: number, [c1, c2]: [number, number], phase: number): void {
  const pivot = new THREE.Group();
  pivot.position.set(ax, ay, az);
  const pb = new PropBatch();
  const k = V(WX * len * Math.cos(el), len * Math.sin(el), WZ * len * Math.cos(el));
  // The sail faces the string end (windward, downward), then tilts back a little more
  const o = new THREE.Object3D();
  o.position.copy(k);
  o.lookAt(0, 0, 0);
  o.rotateX(-0.35);
  o.updateMatrix();
  const at = (lx: number, ly: number, lz = 0) => V(lx, ly, lz).applyMatrix4(o.matrix);
  const sail = (sx: number, sy: number, lz: number) => o.matrix.clone().multiply(new THREE.Matrix4().compose(V(0, 0.12, lz), new THREE.Quaternion(), V(sx, sy, 0.035)));
  pb.add(new THREE.OctahedronGeometry(1, 0), c1, sail(0.8, 1.25, 0));
  pb.add(new THREE.OctahedronGeometry(1, 0), c2, sail(0.42, 0.66, 0.02), false);
  pb.add(new THREE.OctahedronGeometry(1, 0), c2, sail(0.42, 0.66, -0.02), false);
  pb.add(CYL, T.timberDark, segM(at(0, 1.35, 0.05), at(0, -1.1, 0.05), 0.025), false);
  pb.add(CYL, T.timberDark, segM(at(-0.78, 0.12, 0.05), at(0.78, 0.12, 0.05), 0.025), false);
  // String: from the string end to the center of the sail, sagging a little
  const tie = at(0, 0.1, 0.1);
  const pts = catenary(V(0, 0, 0), tie, len * 0.05, 18);
  for (let i = 0; i < 18; i++) pb.add(CYL, 0xf4efe4, segM(pts[i], pts[i + 1], 0.022), false);
  // Tail: drifts downwind
  const tail0 = at(0, -1.13, 0);
  let prev = tail0;
  for (let i = 1; i <= 9; i++) {
    const p = V(tail0.x + WX * 0.55 * i, tail0.y - 0.42 * i + 0.018 * i * i, tail0.z + WZ * 0.55 * i);
    pb.add(CYL, 0xf4efe4, segM(prev, p, 0.018), false);
    if (i % 2 === 0) {
      const bow = new THREE.OctahedronGeometry(1, 0);
      pb.add(bow, i % 4 ? c1 : c2, MS(p.x, p.y, p.z, 0.26, 0.11, 0.05, Math.atan2(WX, WZ) + Math.PI / 2), false);
    }
    prev = p;
  }
  pb.build(pivot);
  ctx.group.add(pivot);
  anim.ticks.push((_dt, t) => {
    pivot.rotation.x = Math.sin(t * 0.9 + phase) * 0.035 + Math.sin(t * 2.3 + phase * 2) * 0.01;
    pivot.rotation.z = Math.sin(t * 1.25 + phase * 1.7) * 0.045;
    pivot.rotation.y = Math.sin(t * 0.6 + phase) * 0.05;
  });
}
