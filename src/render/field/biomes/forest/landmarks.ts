// Landmarks: the thousand-year Mother Tree (root arch spanning the main road, a shimenawa-like vine rope hung with paper
// streamers, a small shrine among the roots), the Forest Folk Bridge, the Owlwatch Stair (owl statues, stone steps, broken
// pillars, the ancient gate), the Fallen Giant (the upturned root plate and the hollow broken end), Glowcap Hollow (giant
// umbrella mushrooms and the fungus ring), the Lakeview Stone Ring, the Island Shrine, the Banyan Secret Realm, the area
// around the Seal Tower (stone tablets, ancient lamps, creeping vines), vines and rocks on the cliff, and light shafts
// everywhere.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { GlowSet, V, lantern, leanDir, leanM, mushroom, mushroomRing, rope, runeStone, segM, shelfFungus, type Pool } from '../../../arenas/_woods.ts';
import { smooth } from '../../compose.ts';
import type { FieldCtx } from '../../kit.ts';
import { groundGlow, shaftsAt } from '../../props.ts';
import { BRIDGE, cliffW, cliffZ, FALLEN, GLADE, GLADE_H, GORGE, HOLLOW, ISLAND, KNOLL, MOTHER, MOTHER_R, TOWER, WL } from './geo.ts';
import { blossomTree, bushAt, COL, fernAt, flowerPatch, FLOWERS, mossRockAt, put, SHROOM, shroomCluster } from './plants.ts';

const LIGHT_DIR = V(0.45, 0.85, 0.35);
const STONE = 0xb8b4a0;
const STONE_D = 0x8e8a78;
const RUNE = 0x7affb0;
const WOOD = { deck: 0x9a6a42, post: 0x5a3c26, rope: 0xc8b48a };

const MX = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));

/** A tapering root/branch along a curve (cylinder joined to cylinder, with a sphere filling each joint) */
function taperTube(ctx: FieldCtx, pts: THREE.Vector3[], r0: number, r1: number, col: number, samples = 14): void {
  const curve = new THREE.CatmullRomCurve3(pts);
  const ps = curve.getPoints(samples);
  for (let i = 0; i < samples; i++) {
    const t0 = i / samples;
    const t1 = (i + 1) / samples;
    const ra = r0 + (r1 - r0) * t0;
    const rb = r0 + (r1 - r0) * t1;
    const g = new THREE.CylinderGeometry(rb, ra, 1, 9, 1, true);
    ctx.b.add(g, col, segM(ps[i], ps[i + 1], 1));
    if (i > 0) ctx.b.add(new THREE.SphereGeometry(ra, 9, 6), col, M(ps[i].x, ps[i].y, ps[i].z));
  }
}

// ───────────────────────── Mother Tree ─────────────────────────

/** Mother Tree canopy clumps (world coords): [x, y, z, horizontal radius, vertical radius], used to bloom after purification */
export const MOTHER_CROWN: [number, number, number, number, number][] = [];

function motherTree(ctx: FieldCtx, glow: GlowSet): void {
  const { b, r } = ctx;
  const [mx, mz] = MOTHER;
  const R = MOTHER_R;
  const H = 74;
  const g0 = ctx.place(mx, mz, R);
  b.lift = g0 - 0.6;
  // Trunk: thick at the bottom and thin at the top, wrapped by a few twisting secondary trunks, plus a ring of tall buttresses
  b.add(new THREE.CylinderGeometry(R * 0.42, R, H * 0.72, 16), COL.trunk, M(mx, H * 0.36, mz));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const aa = a + t * 0.9;
      const rr = R * (0.78 - t * 0.38);
      pts.push(V(mx + Math.cos(aa) * rr, t * H * 0.62, mz + Math.sin(aa) * rr));
    }
    b.lift = g0 - 0.6;
    taperTube(ctx, pts, R * 0.36, R * 0.16, i % 2 ? COL.trunk : COL.bark, 10);
  }
  // Buttress roots: thin walls several times taller than a person
  const fins = 9;
  for (let i = 0; i < fins; i++) {
    const a = (i / fins) * Math.PI * 2 + 0.15 + (r() - 0.5) * 0.3;
    const len = R * (1.1 + r() * 0.7);
    const hh = R * (1.4 + r() * 0.8);
    const sh = new THREE.Shape();
    sh.moveTo(0, hh);
    sh.lineTo(0, 0);
    sh.lineTo(len, 0);
    sh.quadraticCurveTo(len * 0.25, hh * 0.12, 0, hh);
    const fg = new THREE.ExtrudeGeometry(sh, { depth: R * 0.22, bevelEnabled: false, curveSegments: 7 });
    fg.translate(0, 0, -R * 0.11);
    const fx = mx + Math.cos(a) * R * 0.82;
    const fz = mz + Math.sin(a) * R * 0.82;
    ctx.place(fx, fz, 2);
    b.lift -= 0.4;
    b.add(fg, COL.bark, M(fx, 0, fz, -a));
  }
  // Big roots winding along the ground
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3;
    if (Math.abs(Math.atan2(Math.sin(a - 0.19), Math.cos(a - 0.19))) < 0.35) continue; // Made separately on the root-arch side
    const len = 12 + r() * 8;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const d = R * 0.9 + t * len;
      const aa = a + Math.sin(t * 3 + i) * 0.12;
      const x = mx + Math.cos(aa) * d;
      const z = mz + Math.sin(aa) * d;
      // Roots must not climb onto the road or into the stream
      if (k > 1 && (ctx.pathDist(x, z) < 3.6 || ctx.h(x, z) < WL + 0.3)) break;
      pts.push(V(x, ctx.h(x, z) + (1 - t) * 1.2 - 0.25, z));
    }
    if (pts.length < 3) continue;
    b.lift = 0;
    taperTube(ctx, pts, 1.35, 0.3 + (4 - pts.length + 1) * 0.2, COL.bark, 10);
    for (let k = 1; k <= 2; k++) ctx.solids.add(pts[k].x, pts[k].z, 1.3 - k * 0.3);
  }
  // Root arch: reaches out from the trunk, spans the main road and dives back into the ground
  {
    const P: [number, number, number][] = [
      [mx + 5.9, 3.0, mz + 1.1],
      [-13.5, 7.2, -10.1],
      [-8.8, 8.4, -9.0],
      [-4.3, 6.4, -8.2],
      [-1.4, 2.0, -7.7],
      [0.2, -0.8, -7.4],
    ];
    const pts = P.map(([x, y, z]) => V(x, y + ctx.h(x, z), z));
    b.lift = 0;
    taperTube(ctx, pts, 1.75, 0.65, COL.bark, 22);
    ctx.solids.add(-1.2, -7.7, 1.0);
    ctx.solids.add(-16.5, -10.6, 1.8);
    // Moss and small ferns growing on the root arch, thin roots hanging down
    for (let k = 0; k < 4; k++) {
      const t = 0.36 + k * 0.08;
      const c = new THREE.CatmullRomCurve3(pts).getPoint(t);
      const g = new THREE.SphereGeometry(1.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2.2);
      g.scale(1.1, 0.5, 1.4);
      b.add(g, COL.moss, M(c.x, c.y + 0.75, c.z, r() * 6), false);
      rope(b, c.clone().add(V(0, -0.5, 0.6)), c.clone().add(V(0.2, -3.2 - r() * 1.5, 0.9)), 0.1, 0.05, COL.bark, false, 4);
    }
  }
  // Main branches and the huge canopy
  const top = H;
  const crown: [THREE.Vector3, number][] = [[V(mx, top, mz), 15]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5 + (r() - 0.5) * 0.4;
    const y = H * (0.5 + (i % 3) * 0.08);
    const base = V(mx + Math.cos(a) * R * 0.5, y, mz + Math.sin(a) * R * 0.5);
    const len = 20 + r() * 8;
    b.lift = g0 - 0.6;
    b.add(new THREE.CylinderGeometry(0.9, 2.2, len, 9), COL.trunk, leanM(base, a, 1.05 + r() * 0.2, len));
    const tip = base.clone().addScaledVector(leanDir(a, 1.1), len);
    crown.push([tip.clone().add(V(0, 3, 0)), 9 + r() * 3]);
    crown.push([base.clone().addScaledVector(leanDir(a, 1.1), len * 0.55).add(V(0, 6, 0)), 8 + r() * 2]);
    // Aerial roots: thin roots hanging down from the branches
    for (let k = 0; k < 3; k++) {
      const p = base.clone().addScaledVector(leanDir(a, 1.1), len * (0.4 + k * 0.22));
      const gh = ctx.h(p.x, p.z) - (g0 - 0.6);
      const drop = Math.min(p.y - gh - 6, 16 + r() * 10);
      if (drop > 3) b.add(new THREE.CylinderGeometry(0.08, 0.12, drop, 4), COL.bark, M(p.x, p.y - drop / 2, p.z), false);
    }
  }
  b.lift = g0 - 0.6;
  MOTHER_CROWN.length = 0;
  // After purification the Mother Tree blooms: some canopy clumps turn pink as a whole (the blossom dots are in purified.ts)
  const bloom = ctx.done >= ctx.floors;
  crown.forEach(([c, rr], i) => {
    put(b, new THREE.IcosahedronGeometry(1, 1), bloom && i % 3 === 1 ? 0xf4b0c6 : COL.leaf[i % 3], MX(c.x, c.y, c.z, rr, rr * 0.72, rr, 0, r() * 6));
    MOTHER_CROWN.push([c.x, c.y + b.lift, c.z, rr, rr * 0.72]);
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = V(mx + Math.cos(a) * 16, top - 8 + r() * 5, mz + Math.sin(a) * 16);
    const rr = 8 + r() * 3;
    put(b, new THREE.IcosahedronGeometry(1, 1), i % 2 ? COL.leafDark : bloom && i % 4 === 0 ? 0xf8c4d4 : COL.leaf[1], MX(c.x, c.y, c.z, rr, rr * 0.7, rr, 0, r() * 6));
    MOTHER_CROWN.push([c.x, c.y + b.lift, c.z, rr, rr * 0.7]);
  }
  // Bracket fungi and glowing moss on the trunk
  for (let i = 0; i < 14; i++) {
    const y = 2 + r() * 16;
    const rr = R * (1 - (0.58 * y) / (H * 0.72));
    shelfFungus(b, mx, mz, rr * 0.98, r() * Math.PI * 2, y, 0.5 + r() * 0.45, i % 2 ? 0xf7c757 : 0x46b8a8, i % 2 ? 0xffe38f : 0x9dffd6);
  }
  // Shimenawa-like vine rope: wraps once around the trunk, hung with white and green paper streamers
  {
    const y = 6.5;
    const rr = R * (1 - (0.58 * y) / (H * 0.72)) + 0.35;
    b.add(new THREE.TorusGeometry(rr, 0.32, 8, 40), WOOD.rope, M(mx, y, mz, 0, 1, Math.PI / 2));
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const px = mx + Math.cos(a) * (rr + 0.25);
      const pz = mz + Math.sin(a) * (rr + 0.25);
      const col = i % 3 === 0 ? 0x8fd06a : 0xfaf6ea;
      b.add(new THREE.BoxGeometry(0.34, 1.3, 0.04), col, M(px, y - 0.9, pz, -a + Math.PI / 2, 1, 0, (r() - 0.5) * 0.2), false);
    }
    // A lantern's glowing part is not raised by lift, so an absolute height is used here
    const lift = b.lift;
    b.lift = 0;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      lantern(b, glow, V(mx + Math.cos(a) * (rr + 0.5), lift + y - 0.2, mz + Math.sin(a) * (rr + 0.5)), 1.3, WOOD.post);
    }
    b.lift = lift;
  }
  ctx.solids.add(mx, mz, R * 1.35);
  for (let i = 0; i < fins; i++) {
    const a = (i / fins) * Math.PI * 2 + 0.15;
    ctx.solids.add(mx + Math.cos(a) * R * 1.55, mz + Math.sin(a) * R * 1.55, 1.2);
  }

  // Mother Tree shrine: a small altar, stone lantern and offerings among the roots on the south side
  const sx = mx - 1;
  const sz = mz + R + 6.5;
  ctx.place(sx, sz, 1.6);
  b.add(new THREE.BoxGeometry(2.6, 0.8, 1.6), STONE_D, M(sx, 0.35, sz));
  b.add(new THREE.BoxGeometry(2.2, 0.25, 1.3), STONE, M(sx, 0.85, sz));
  for (let i = 0; i < 5; i++) b.add(new THREE.SphereGeometry(0.16, 7, 5), [0xff8a5a, 0xffd25a, 0xc84a6a][i % 3], M(sx - 0.7 + i * 0.35, 1.1, sz + (i % 2) * 0.2 - 0.1));
  glow.add(new THREE.OctahedronGeometry(0.28), M(sx, 1.35 + ctx.h(sx, sz), sz));
  for (const s of [-1, 1]) {
    const lx = sx + s * 3.2;
    const lz = sz + 1.2;
    stoneLantern(ctx, glow, lx, lz, 1.0);
  }
  flowerPatch(ctx, sx - 2, sz + 2.5, [0xffffff, 0xffe07a], 6, 1.6);
  flowerPatch(ctx, sx + 2.2, sz + 2.2, [0xffffff, 0xff9ac0], 6, 1.6);
  ctx.solids.add(sx, sz, 1.5);

  // Light shafts: pass through the Mother Tree's canopy and fall on the roots
  shaftsAt(ctx, mx, mz, [
    { x: 11, z: 6, w: 2.6, h: 34 },
    { x: -9, z: 10, w: 2.2, h: 32 },
    { x: 14, z: -8, w: 1.8, h: 30 },
    { x: -12, z: -9, w: 2.0, h: 30 },
  ], LIGHT_DIR, 0xfff2b8, 0.26);
  b.lift = 0;
}

/** Stone lantern: base, post, lantern chamber (glowing), roof */
function stoneLantern(ctx: FieldCtx, glow: GlowSet, x: number, z: number, s: number): void {
  const { b } = ctx;
  const y = ctx.place(x, z, 0.5 * s);
  b.add(new THREE.CylinderGeometry(0.55 * s, 0.65 * s, 0.3 * s, 6), STONE_D, M(x, 0.15 * s, z));
  b.add(new THREE.CylinderGeometry(0.2 * s, 0.26 * s, 1.1 * s, 6), STONE, M(x, 0.85 * s, z));
  b.add(new THREE.BoxGeometry(0.75 * s, 0.14 * s, 0.75 * s), STONE_D, M(x, 1.45 * s, z));
  glow.add(new THREE.BoxGeometry(0.42 * s, 0.42 * s, 0.42 * s), M(x, y + 1.74 * s, z, Math.PI / 4));
  for (const a of [0, Math.PI / 2]) b.add(new THREE.BoxGeometry(0.62 * s, 0.5 * s, 0.1 * s), STONE, M(x, 1.74 * s, z, a));
  b.add(new THREE.ConeGeometry(0.72 * s, 0.5 * s, 4), STONE_D, M(x, 2.2 * s, z, Math.PI / 4));
  b.add(new THREE.SphereGeometry(0.12 * s, 6, 4), STONE, M(x, 2.5 * s, z));
  ctx.solids.add(x, z, 0.55 * s);
}

// ───────────────────────── Forest Folk Bridge ─────────────────────────

function bridge(ctx: FieldCtx, glow: GlowSet): void {
  const { b } = ctx;
  const [A, B] = BRIDGE;
  const ext = 1.8;
  const dx = B[0] - A[0];
  const dz = B[1] - A[1];
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const nx = -uz;
  const nz = ux;
  const ry = Math.atan2(ux, uz);
  const half = 3.25;
  const at = (t: number, side: number): [number, number] => [A[0] + ux * t + nx * side, A[1] + uz * t + nz * side];
  const deckY = (t: number) => {
    const [x, z] = at(t, 0);
    return ctx.h(x, z) + 0.12;
  };
  b.lift = 0;
  // Bridge deck
  for (let t = -ext; t <= L + ext; t += 0.62) {
    const [x, z] = at(t, 0);
    b.add(new THREE.BoxGeometry(half * 2, 0.16, 0.56), t % 1.24 < 0.62 ? WOOD.deck : 0x8a5c38, M(x, deckY(t), z, ry));
  }
  for (const side of [-1, 1]) {
    // Side beams and skirt boards: drop from the deck all the way into the water, hiding the earth bank under the bridge
    for (let t = -ext; t < L + ext; t += 1.2) {
      const [x, z] = at(t + 0.6, side * (half + 0.08));
      const y0 = deckY(t + 0.6);
      b.add(new THREE.BoxGeometry(0.2, y0 - (WL - 1.6), 1.24), 0x7a5232, M(x, (y0 + WL - 1.6) / 2, z, ry));
    }
    // Posts, railings, handrails
    for (let t = -ext; t <= L + ext + 0.01; t += (L + ext * 2) / 6) {
      const [x, z] = at(t, side * (half + 0.3));
      const y0 = deckY(t);
      b.add(new THREE.CylinderGeometry(0.24, 0.28, y0 + 1.25 - (WL - 2), 8), WOOD.post, M(x, (y0 + 1.25 + WL - 2) / 2, z));
      b.add(new THREE.SphereGeometry(0.28, 8, 5), WOOD.post, M(x, y0 + 1.3, z));
      ctx.solids.add(x, z, 0.5);
    }
    const [x0, z0] = at(-ext, side * (half + 0.3));
    const [x1, z1] = at(L + ext, side * (half + 0.3));
    const p0 = V(x0, deckY(-ext) + 1.05, z0);
    const p1 = V(x1, deckY(L + ext) + 1.05, z1);
    b.add(new THREE.CylinderGeometry(0.09, 0.09, 1, 6), 0x8a5c38, segM(p0, p1, 1), true);
    rope(b, p0.clone().setY(p0.y - 0.45), p1.clone().setY(p1.y - 0.45), 0.35, 0.04, WOOD.rope, false, 10);
    // Lamp posts at the bridge ends
    for (const t of [-ext - 0.6, L + ext + 0.6]) {
      const [lx, lz] = at(t, side * (half + 0.5));
      const y0 = ctx.h(lx, lz);
      b.add(new THREE.CylinderGeometry(0.12, 0.16, 2.8, 6), WOOD.post, M(lx, y0 + 1.4, lz));
      b.add(new THREE.BoxGeometry(0.1, 0.1, 0.8), WOOD.post, M(lx - nx * side * 0.3, y0 + 2.75, lz - nz * side * 0.3, ry + Math.PI / 2));
      lantern(b, glow, V(lx - nx * side * 0.6, y0 + 2.72, lz - nz * side * 0.6), 1.1, WOOD.post);
      ctx.solids.add(lx, lz, 0.3);
    }
  }
}

// ───────────────────────── Owlwatch Stair ─────────────────────────

/** Owl statue: a stone owl with folded wings on a pedestal, its eyes glowing green */
function owlStatue(ctx: FieldCtx, x: number, z: number, face: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1.4 * s);
  const fx = Math.sin(face);
  const fz = Math.cos(face);
  const sx = Math.cos(face);
  const sz = -Math.sin(face);
  b.add(new THREE.BoxGeometry(2.6 * s, 1.3 * s, 2.6 * s), STONE_D, M(x, 0.5 * s, z, face));
  b.add(new THREE.BoxGeometry(2.9 * s, 0.25 * s, 2.9 * s), STONE, M(x, 1.25 * s, z, face));
  put(b, new THREE.SphereGeometry(1, 12, 9), STONE, MX(x, 3.0 * s, z, 1.15 * s, 1.75 * s, 1.05 * s, 0, face));
  put(b, new THREE.SphereGeometry(1, 12, 9), STONE, MX(x + fx * 0.1 * s, 5.0 * s, z + fz * 0.1 * s, 0.95 * s, 0.85 * s, 0.9 * s, 0, face));
  for (const e of [-1, 1]) {
    // Ear tufts
    b.add(new THREE.ConeGeometry(0.28 * s, 0.9 * s, 5), STONE, M(x + sx * e * 0.55 * s, 5.8 * s, z + sz * e * 0.55 * s, face, 1, 0, e * -0.35));
    // Folded wings
    put(b, new THREE.SphereGeometry(1, 10, 7), STONE_D, MX(x + sx * e * 0.95 * s - fx * 0.1 * s, 3.0 * s, z + sz * e * 0.95 * s - fz * 0.1 * s, 0.35 * s, 1.45 * s, 0.9 * s, 0, face, e * 0.12));
    // Eyes (glowing) and eye rims
    const ex = x + sx * e * 0.38 * s + fx * 0.78 * s;
    const ez = z + sz * e * 0.38 * s + fz * 0.78 * s;
    b.add(new THREE.TorusGeometry(0.3 * s, 0.07 * s, 5, 12), STONE_D, MX(ex, 5.1 * s, ez, 1, 1, 1, 0, face));
    b.glow(new THREE.CircleGeometry(0.24 * s, 12), RUNE, MX(ex + fx * 0.03, 5.1 * s, ez + fz * 0.03, 1, 1, 1, 0, face));
  }
  b.add(new THREE.ConeGeometry(0.16 * s, 0.5 * s, 4), 0x9a8a60, new THREE.Matrix4().compose(V(x + fx * 0.92 * s, 4.75 * s, z + fz * 0.92 * s), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(fx, -0.35, fz).normalize()), V(1, 1, 1)));
  // Moss
  const g = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.4);
  b.add(g, COL.moss, MX(x, 5.55 * s, z, 0.8 * s, 0.35 * s, 0.75 * s, 0, r() * 6), false);
  b.add(g.clone(), COL.moss, MX(x - fx * 0.3 * s, 4.1 * s, z - fz * 0.3 * s, 1.05 * s, 0.4 * s, 0.95 * s, 0, r() * 6), false);
  ctx.solids.add(x, z, 1.7 * s);
}

function gorge(ctx: FieldCtx, glowRune: GlowSet): void {
  const { b, r } = ctx;
  const [G0, G1] = GORGE;
  const dx = G1[0] - G0[0];
  const dz = G1[1] - G0[1];
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const nx = -uz;
  const nz = ux;
  const ry = Math.atan2(ux, uz);
  const at = (t: number, p: number): [number, number] => [G0[0] + dx * t + nx * p, G0[1] + dz * t + nz * p];
  // Owl statues on both sides of the gorge mouth, facing whoever walks up
  for (const s of [-1, 1]) {
    const [x, z] = at(-0.1, s * 7.0);
    owlStatue(ctx, x, z, ry + Math.PI, 1.1);
  }
  // Stone steps: a flight of slabs, some with chipped corners, some tilted
  for (let t = 0.02; t < 1.0; t += 1.15 / L) {
    if (r() < 0.12) continue;
    const off = (r() - 0.5) * 0.4;
    const [x, z] = at(t, off);
    const y = ctx.h(x, z);
    b.lift = y - 0.18;
    const w = 3.6 + r() * 0.8;
    b.add(new THREE.BoxGeometry(w, 0.32, 0.95), r() < 0.5 ? STONE : 0xa8a490, M(x, 0, z, ry + (r() - 0.5) * 0.08, 1, (r() - 0.5) * 0.05, (r() - 0.5) * 0.06));
  }
  // Broken pillars: along both sides of the gorge, some fallen on the ground
  for (let i = 0; i < 8; i++) {
    const t = 0.08 + i * 0.12 + r() * 0.04;
    const s = i % 2 ? 1 : -1;
    const [x, z] = at(t, s * (3.3 + r() * 0.5));
    const hh = 1.6 + r() * 3.5;
    const y = ctx.place(x, z, 0.7);
    b.lift = y - 0.2;
    b.add(new THREE.CylinderGeometry(0.5, 0.56, hh, 8), STONE, M(x, hh / 2, z, r()));
    b.add(new THREE.BoxGeometry(1.35, 0.3, 1.35), STONE_D, M(x, 0.15, z, r()));
    if (hh > 3.5) b.add(new THREE.BoxGeometry(1.3, 0.35, 1.3), STONE_D, M(x, hh + 0.1, z, r()));
    const mg = new THREE.SphereGeometry(0.62, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.2);
    mg.scale(1, 0.45, 1);
    b.add(mg, COL.moss, M(x, hh - 0.05, z), false);
    ctx.solids.add(x, z, 0.65);
    // Rune carvings (glowing)
    for (let k = 0; k < 2; k++) glowRune.add(new THREE.BoxGeometry(0.08, 0.5, 0.06), M(x - nx * s * 0.5, y + 0.8 + k * 0.7, z - nz * s * 0.5, ry));
  }
  // Fallen pillar
  for (const [t, p] of [[0.35, -2.9], [0.72, 3.1]] as const) {
    const [x, z] = at(t, p);
    ctx.place(x, z, 1.5);
    b.lift -= 0.1;
    b.add(new THREE.CylinderGeometry(0.5, 0.55, 3.8, 8), STONE, M(x, 0.45, z, ry + 0.4 * Math.sign(p), 1, 0, Math.PI / 2));
    ctx.solids.add(x, z, 0.9);
  }
  // Ancient gate at the top of the gorge: two square pillars, a lintel and a glowing Source Crystal
  {
    const [x, z] = at(1.04, 0);
    const y = ctx.place(x, z, 3);
    b.lift = y - 0.3;
    for (const s of [-1, 1]) {
      const px = x + nx * s * 3.4;
      const pz = z + nz * s * 3.4;
      b.add(new THREE.BoxGeometry(1.2, 6.6, 1.2), STONE, M(px, 3.3, pz, ry));
      b.add(new THREE.BoxGeometry(1.6, 0.5, 1.6), STONE_D, M(px, 0.25, pz, ry));
      b.add(new THREE.BoxGeometry(1.5, 0.4, 1.5), STONE_D, M(px, 6.7, pz, ry));
      ctx.solids.add(px, pz, 0.9);
      for (let k = 0; k < 3; k++) glowRune.add(new THREE.BoxGeometry(0.5, 0.08, 0.06), M(px - ux * 0.62, y - 0.3 + 2 + k * 1.2, pz - uz * 0.62, ry));
    }
    b.add(new THREE.BoxGeometry(9.2, 0.9, 1.4), STONE, M(x, 7.3, z, ry));
    b.add(new THREE.BoxGeometry(10, 0.4, 1.8), STONE_D, M(x, 7.95, z, ry));
    glowRune.add(new THREE.OctahedronGeometry(0.45), M(x, y - 0.3 + 8.8, z));
    // Vines hanging from the lintel
    for (let k = 0; k < 9; k++) {
      const s = -4 + k;
      const p = V(x + nx * s, y - 0.3 + 7.0, z + nz * s);
      const len = 1.2 + r() * 2.4;
      b.add(new THREE.CylinderGeometry(0.04, 0.05, len, 4), 0x4f8a3a, M(p.x, p.y - len / 2, p.z), false);
      b.add(new THREE.IcosahedronGeometry(0.22, 0), COL.moss, M(p.x, p.y - len, p.z), false);
    }
  }
  b.lift = 0;
}

// ───────────────────────── Cliff: rocks and hanging vines on the cliff face ─────────────────────────

function cliffDressing(ctx: FieldCtx): void {
  const { b, r, low } = ctx;
  const step = low ? 5 : 3.2;
  for (let x = -100; x < 44; x += step) {
    const x0 = x + r() * step;
    // Leave the gorge, the falls and the narrow gorge mouth clear
    if (Math.abs(x0 - 3) < 9 || Math.abs(x0 + 48) < 5 || Math.abs(x0 + 60) < 4) continue;
    const zc = cliffZ(x0);
    const W = cliffW(x0);
    if (W > 8) continue;
    const u = r();
    if (u < 0) {
      // Half-buried rocks at the cliff foot (disabled: seen in front of the cliff face they look like they float in mid-air)
      const d = W * 0.05;
      const z = zc - d;
      const y = ctx.h(x0, z);
      const s = 0.9 + r() * 1.2;
      b.lift = y;
      put(b, new THREE.DodecahedronGeometry(1, 0), r() < 0.5 ? COL.rock : COL.rockDark, MX(x0, 0, z - s * 0.5, s * (1.4 + r() * 0.5), s * (0.8 + r() * 0.3), s * 0.9, r() * 0.3, r() * 6, r() * 0.3));
      // A small tuft of grass growing on a rock ledge
      put(b, new THREE.IcosahedronGeometry(1, 0), COL.moss, MX(x0, s * 0.62, z - s * 0.4, s * 0.9, s * 0.3, s * 0.6, 0, r() * 6), false);
    } else if (u < 0.9) {
      // Vines hanging from the cliff top to the cliff foot, hugging the cliff face
      const pts: THREE.Vector3[] = [];
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const d = W + 0.4 - (k / n) * (W + 0.6);
        const z = zc - d + 0.35;
        pts.push(V(x0 + Math.sin(k * 1.3 + x0) * 0.25, ctx.h(x0, z) + 0.3, z));
      }
      const col = r() < 0.5 ? 0x4f8a3a : 0x5c9a40;
      b.lift = 0;
      for (let k = 0; k < n; k++) {
        b.add(new THREE.CylinderGeometry(1, 1, 1, 4), col, segM(pts[k], pts[k + 1], 0.07), false);
        const lp = pts[k].clone().lerp(pts[k + 1], 0.5);
        put(b, new THREE.IcosahedronGeometry(1, 0), k % 2 ? COL.moss : col, MX(lp.x + (r() - 0.5) * 0.4, lp.y, lp.z + 0.15, 0.45, 0.35, 0.2, 0, r()), false);
      }
    }
  }
  b.lift = 0;
}

// ───────────────────────── Fallen Giant ─────────────────────────

function fallenGiant(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [A, B] = [FALLEN.a, FALLEN.b];
  const dx = B[0] - A[0];
  const dz = B[1] - A[1];
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const ry = Math.atan2(ux, uz);
  const R0 = FALLEN.r;
  const R1 = FALLEN.r * 0.82;
  const yA = ctx.h(A[0], A[1]) + R0 * 0.72;
  const yB = ctx.h(B[0], B[1]) + R1 * 0.78;
  const pa = V(A[0], yA, A[1]);
  const pb = V(B[0], yB, B[1]);
  b.lift = 0;
  // Trunk (solid section) and the hollow broken section
  const hollowL = 6;
  const split = pa.clone().lerp(pb, 1 - hollowL / L);
  const Rs = R0 + (R1 - R0) * (1 - hollowL / L);
  b.add(new THREE.CylinderGeometry(Rs, R0, 1, 16, 1, true), COL.trunk, segM(pa, split, 1));
  b.add(new THREE.CylinderGeometry(R1, Rs, 1, 16, 1, true), COL.trunk, segM(split, pb, 1));
  // Inner wall (dark, back faces)
  const inner = new THREE.CylinderGeometry(R1 * 0.78, Rs * 0.78, 1, 16, 1, true);
  inner.scale(-1, 1, 1);
  b.add(inner, 0x3a2618, segM(split, pb, 1), false);
  b.add(new THREE.CircleGeometry(Rs * 0.8, 16), 0x3a2618, (() => {
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), pb.clone().sub(split).normalize());
    return new THREE.Matrix4().compose(split, q, V(1, 1, 1));
  })(), false);
  // Broken end: a ring of jagged wooden splinters
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(ux, 0, uz));
    const off = V(Math.cos(a) * R1 * 0.9, 0, Math.sin(a) * R1 * 0.9).applyQuaternion(q);
    const len = 0.6 + r() * 1.4;
    const base = pb.clone().add(off);
    b.add(new THREE.ConeGeometry(0.35, len, 4), 0xd8b884, new THREE.Matrix4().compose(base.clone().add(V(ux * len * 0.5, 0, uz * len * 0.5)), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(ux, 0, uz)), V(1, 1, 1)));
  }
  // Moss, mushrooms on the bark, and small trees growing on the fallen log
  for (let i = 0; i < 9; i++) {
    const t = 0.05 + i * 0.1;
    const p = pa.clone().lerp(pb, t);
    const rr = R0 + (R1 - R0) * t;
    const g = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.3);
    b.add(g, i % 3 ? COL.moss : COL.mossDeep, MX(p.x, p.y + rr * 0.72, p.z, rr * 0.85, rr * 0.45, 2.2, 0, ry), false);
    if (i % 2 === 0) {
      const lift = b.lift;
      b.lift = p.y + rr * 0.9;
      mushroom(b, p.x + (r() - 0.5), p.z + (r() - 0.5), 0.5 + r() * 0.4, SHROOM, r);
      b.lift = lift;
    }
  }
  {
    const p = pa.clone().lerp(pb, 0.45);
    b.lift = p.y + R0 * 0.85;
    b.add(new THREE.CylinderGeometry(0.12, 0.2, 2.6, 6), COL.trunk, M(p.x, 1.3, p.z));
    put(b, new THREE.IcosahedronGeometry(1, 1), COL.leaf[2], MX(p.x, 2.9, p.z, 1.3, 1.1, 1.3));
    put(b, new THREE.IcosahedronGeometry(1, 1), COL.leaf[0], MX(p.x + 0.6, 2.3, p.z + 0.3, 0.9, 0.8, 0.9));
    b.lift = 0;
  }
  // Upturned root plate: a large upright disc, soil, and roots reaching outward
  {
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(ux, 0, uz));
    const c = pa.clone().add(V(-ux * 0.8, 2.4, -uz * 0.8));
    const disc = new THREE.CylinderGeometry(6.2, 6.6, 1.6, 18);
    b.add(disc, 0x6a4a30, new THREE.Matrix4().compose(c, q, V(1, 1, 0.9)));
    const dirt = new THREE.CylinderGeometry(4.6, 5.2, 1.7, 14);
    b.add(dirt, 0x7a5a38, new THREE.Matrix4().compose(c.clone().add(V(-ux * 0.2, 0, -uz * 0.2)), q, V(1, 1, 0.9)));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r() * 0.2;
      const off = V(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q);
      const from = c.clone().addScaledVector(off, 5.5);
      const to = c.clone().addScaledVector(off, 8.5 + r() * 3).add(V(-ux * (1 + r() * 2), 0, -uz * (1 + r() * 2)));
      if (to.y < ctx.h(to.x, to.z) - 0.5) to.y = ctx.h(to.x, to.z) - 0.3;
      b.add(new THREE.CylinderGeometry(0.12, 0.45, 1, 6), COL.bark, segM(from, to, 1));
    }
    // Grass and ferns growing on top of the root plate
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (0.2 + i * 0.2);
      const off = V(Math.cos(a), 0, Math.sin(a)).applyQuaternion(q);
      const p = c.clone().addScaledVector(off, 5.8);
      if (p.y < c.y + 2) continue;
      b.lift = p.y - 0.2;
      put(b, new THREE.IcosahedronGeometry(1, 1), COL.bush[i % 3], MX(p.x, 0, p.z, 1.1, 0.7, 1.1));
      b.lift = 0;
    }
    for (let k = -2; k <= 2; k++) ctx.solids.add(c.x + Math.cos(ry) * k * 2.6, c.z - Math.sin(ry) * k * 2.6, 1.6);
  }
  // Collision: the solid section along the centerline; the hollow section blocks only the walls on both sides
  for (let t = 0; t < 1 - hollowL / L; t += 0.08) {
    const p = pa.clone().lerp(pb, t);
    ctx.solids.add(p.x, p.z, R0 * 0.95);
  }
  for (let t = 1 - hollowL / L; t <= 1.001; t += 0.05) {
    const p = pa.clone().lerp(pb, t);
    for (const s of [-1, 1]) ctx.solids.add(p.x - uz * s * R1 * 0.95, p.z + ux * s * R1 * 0.95, 0.5);
  }
  // Fallen leaves and ferns in front of the broken end
  for (let i = 0; i < 6; i++) fernAt(ctx, B[0] + ux * (2 + r() * 3) + (r() - 0.5) * 6, B[1] + uz * (2 + r() * 3) + (r() - 0.5) * 6, 0.8 + r() * 0.5);
}

// ───────────────────────── Glowcap Hollow ─────────────────────────

function fairyHollow(ctx: FieldCtx, pools: Pool[]): void {
  const { b, r } = ctx;
  const [hx, hz] = HOLLOW;
  ctx.place(hx, hz);
  mushroomRing(b, hx, hz, 7.2, 24, SHROOM, r, pools, 0x6affd0);
  // A small clump at the center of the ring
  shroomCluster(ctx, hx + 0.5, hz - 0.3, 5, 1.6);
  groundGlow(ctx, hx, hz, 11, 0x3affb0, 0.55);
  // Giant umbrella mushrooms on the edge of the hollow (two or three times taller than a person)
  const bigs: [number, number, number][] = [
    [-76, 20, 9], [-72, 5, 7.5], [-60, 26, 7], [-78, 8, 6], [-56, 3, 6.5], [-70, 24.5, 8.5], [-64, -2, 7],
  ];
  const giantCols = { ...SHROOM, caps: [0x46b8a8, 0x5cc8b4, 0x3aa89a] };
  for (const [x, z, s] of bigs) {
    if (!ctx.clear(x, z, 0.5)) continue;
    ctx.place(x, z, 0.8);
    b.lift -= 0.1;
    mushroom(b, x, z, s, giantCols, r, false);
    ctx.solids.add(x, z, 0.16 * s + 0.3);
    // Light spots under the umbrellas
    pools.push({ x, z, r: s * 0.55, col: 0x7dffd8 });
  }
  // Scattered small mushrooms on the ground
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = 8.5 + r() * 9;
    const x = hx + Math.cos(a) * d;
    const z = hz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0.3) || ctx.solids.blocked(x, z, 0.6)) continue;
    shroomCluster(ctx, x, z, 2 + Math.floor(r() * 3), 1.1);
  }
  shaftsAt(ctx, hx, hz, [
    { x: -2, z: 2, w: 2.4, h: 22 },
    { x: 4, z: -3, w: 1.6, h: 20 },
  ], LIGHT_DIR, 0xa8ffe0, 0.16);
  ctx.extras.push((dt, _t, vfx) => {
    if (vfx.camPos.distanceTo(V(hx, 4, hz)) > 80) return;
    if (Math.random() > dt * 14) return;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() < 0.6 ? 7.2 + (Math.random() - 0.5) * 1.5 : Math.random() * 16;
    const x = hx + Math.cos(a) * d;
    const z = hz + Math.sin(a) * d;
    vfx.emit({ pos: V(x, ctx.h(x, z) + 0.4, z), count: 1, color: [0x9dffd6, 0xffe38f, 0xd8ffe8], speed: [0.15, 0.45], dir: V(0, 1, 0), spread: 0.6, life: [2.5, 4.5], size: [0.08, 0.16], sizeEnd: 0.35, drag: 0.1, intensity: 1.8 });
  });
  b.lift = 0;
}

// ───────────────────────── Lakeview Stone Ring ─────────────────────────

function stoneCircle(ctx: FieldCtx, glow: GlowSet): void {
  const { b, r } = ctx;
  const [kx, kz] = KNOLL;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const x = kx + Math.cos(a) * 6.8;
    const z = kz + Math.sin(a) * 6.8;
    const y = ctx.place(x, z, 0.8);
    b.lift = y - 0.3;
    if (i === 4) {
      // One fallen stone (its long edge lies on the slope; take a larger area to find the lowest point, then bury it deeper)
      b.lift = ctx.place(x, z, 1.8) - 0.25;
      b.add(new THREE.BoxGeometry(1.3, 0.8, 3.6), STONE, M(x, 0.3, z, a + 0.3, 1, 0, 0.06));
      ctx.solids.add(x, z, 1.4);
      continue;
    }
    const hh = 2.6 + r() * 1.6;
    b.add(new THREE.BoxGeometry(1.2, hh, 0.7), i % 2 ? STONE : 0xa6a28e, M(x, hh / 2, z, -a + Math.PI / 2, 1, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12));
    const mg = new THREE.SphereGeometry(0.75, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.4);
    mg.scale(1, 0.4, 0.7);
    b.add(mg, COL.moss, M(x, hh - 0.05, z, -a + Math.PI / 2), false);
    b.glow(new THREE.BoxGeometry(0.1, 0.8, 0.05), RUNE, M(x - Math.cos(a) * 0.36, hh * 0.55, z - Math.sin(a) * 0.36, -a + Math.PI / 2));
    ctx.solids.add(x, z, 0.8);
  }
  // The altar stone at the center
  const y = ctx.place(kx, kz, 1.2);
  b.lift = y - 0.2;
  b.add(new THREE.CylinderGeometry(1.5, 1.7, 0.7, 9), STONE_D, M(kx, 0.35, kz));
  glow.add(new THREE.TorusGeometry(0.9, 0.06, 4, 24), M(kx, y - 0.2 + 0.72, kz, 0, 1, Math.PI / 2));
  ctx.solids.add(kx, kz, 1.6);
  for (let i = 0; i < 5; i++) flowerPatch(ctx, kx + (r() - 0.5) * 10, kz + (r() - 0.5) * 10, [0xffffff, 0xb89aff], 5, 1.2);
  b.lift = 0;
}

// ───────────────────────── Island Shrine ─────────────────────────

function islandShrine(ctx: FieldCtx, glow: GlowSet): void {
  const { b } = ctx;
  const [ix, iz] = ISLAND;
  const x = ix + 0.2;
  const z = iz - 2.2;
  const y = ctx.place(x, z, 1.4);
  b.lift = y - 0.15;
  b.add(new THREE.CylinderGeometry(1.9, 2.1, 0.4, 6), STONE_D, M(x, 0.2, z));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.11, 0.13, 2.4, 6), 0x8a3a2a, M(x + Math.cos(a) * 1.5, 1.6, z + Math.sin(a) * 1.5));
  }
  b.add(new THREE.CylinderGeometry(0.8, 2.3, 0.9, 6), 0x3f7a4c, M(x, 3.2, z));
  b.add(new THREE.ConeGeometry(0.85, 1.3, 6), 0x3f7a4c, M(x, 4.25, z));
  b.add(new THREE.CylinderGeometry(2.35, 2.35, 0.14, 6), 0x6e8e4a, M(x, 2.78, z));
  b.add(new THREE.CylinderGeometry(0.4, 0.5, 0.9, 6), STONE, M(x, 0.85, z));
  glow.add(new THREE.OctahedronGeometry(0.34), M(x, y - 0.15 + 1.65, z));
  ctx.solids.add(x, z, 1.9);
  blossomTree(ctx, ix - 2.6, iz - 1.4, 1.2);
  mossRockAt(ctx, ix + 3.2, iz - 0.6, 0.7);
  flowerPatch(ctx, ix + 0.8, iz + 2.8, [0xffffff, 0xff9ac0], 6, 1.4);
  b.lift = 0;
}

// ───────────────────────── Banyan Secret Realm ─────────────────────────

function secretGlade(ctx: FieldCtx, glow: GlowSet, pools: Pool[]): void {
  const { b, r } = ctx;
  const [gx, gz] = GLADE;
  // Ancient banyan: one thick trunk, several secondary trunks, and a large umbrella-like canopy held up by a ring of aerial roots
  const cx = gx + 2.5;
  const cz = gz - 2.5;
  const y0 = ctx.place(cx, cz, 2);
  b.lift = y0 - 0.3;
  const H = 12;
  b.add(new THREE.CylinderGeometry(1.4, 2.6, H, 12), COL.bark, M(cx, H / 2, cz));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const aa = a + t * 1.2;
      pts.push(V(cx + Math.cos(aa) * (2.2 - t * 1.0), t * H * 0.9, cz + Math.sin(aa) * (2.2 - t * 1.0)));
    }
    taperTube(ctx, pts, 0.9, 0.4, COL.trunk, 8);
  }
  const canopy: [number, number, number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const len = 7 + r() * 2;
    const base = V(cx, H * 0.78, cz);
    b.add(new THREE.CylinderGeometry(0.35, 0.7, len, 7), COL.bark, leanM(base, a, 1.25, len));
    const tip = base.clone().addScaledVector(leanDir(a, 1.25), len);
    canopy.push([tip.x, tip.y + 1.8, tip.z, 4.2 + r()]);
    // Aerial root pillars: drop straight from the branches to the ground
    for (let k = 0; k < (i % 2 ? 1 : 2); k++) {
      const p = base.clone().addScaledVector(leanDir(a, 1.25), len * (0.9 - k * 0.35));
      const gy = ctx.h(p.x, p.z) - (y0 - 0.3);
      const hh = p.y - gy;
      b.add(new THREE.CylinderGeometry(0.16, 0.26, hh + 0.3, 6), COL.trunk, M(p.x, gy + hh / 2 - 0.15, p.z));
      ctx.solids.add(p.x, p.z, 0.35);
    }
  }
  canopy.push([cx, H + 3, cz, 6.5]);
  for (const [x, y, z, rr] of canopy) put(b, new THREE.IcosahedronGeometry(1, 1), COL.leafDark, MX(x, y, z, rr, rr * 0.6, rr, 0, r() * 6));
  // Glow under the umbrella: bracket fungi on the trunk, hanging glowing vines
  for (let i = 0; i < 8; i++) shelfFungus(b, cx, cz, 2.3 - i * 0.1, r() * 6.28, 1 + i * 0.9, 0.4, i % 2 ? 0xf7c757 : 0x46b8a8, i % 2 ? 0xffe38f : 0x9dffd6);
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 3 + r() * 6;
    const top = V(cx + Math.cos(a) * d, H * 0.95 + r() * 1.5, cz + Math.sin(a) * d);
    const len = 1.5 + r() * 2.5;
    b.add(new THREE.CylinderGeometry(0.02, 0.02, len, 3), 0x4f8a3a, M(top.x, top.y - len / 2, top.z), false);
    b.glow(new THREE.SphereGeometry(0.11, 6, 4), 0x9dffd6, M(top.x, top.y - len, top.z));
  }
  ctx.solids.add(cx, cz, 3.0);
  // The realm's altar: a ring of mossy rocks and a glowing rune circle
  const ax = gx - 3;
  const az = gz + 3.5;
  ctx.place(ax, az, 1.5);
  b.add(new THREE.CylinderGeometry(1.4, 1.6, 0.5, 8), STONE_D, M(ax, 0.2, az));
  glow.add(new THREE.OctahedronGeometry(0.4), M(ax, ctx.h(ax, az) + 1.1, az));
  groundGlow(ctx, ax, az, 7, 0x6affc0, 0.6);
  ctx.solids.add(ax, az, 1.5);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    runeStoneAt(ctx, ax + Math.cos(a) * 4.2, az + Math.sin(a) * 4.2, 1.4 + r() * 0.8, Math.atan2(az - (az + Math.sin(a)), ax - (ax + Math.cos(a))));
  }
  // Glowing flowers and mushrooms on the ground
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2;
    const d = 3 + r() * 8;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (ctx.solids.blocked(x, z, 0.6) || !ctx.clear(x, z, 0)) continue;
    if (i % 2) shroomCluster(ctx, x, z, 3, 1.2);
    else flowerPatch(ctx, x, z, [0x9dffd6, 0xffffff, 0xb89aff], 6, 1.4);
  }
  // Valley wall: vines hanging from the cliff top, a ring of ferns at the foot of the wall
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r() * 0.2;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) {
      const d = 14.2 - k * 0.75;
      const x = gx + Math.cos(a) * d;
      const z = gz + Math.sin(a) * d;
      pts.push(V(x, ctx.h(x, z) + 0.3, z));
    }
    b.lift = 0;
    const col = i % 2 ? 0x4f8a3a : 0x5c9a40;
    for (let k = 0; k < 5; k++) {
      b.add(new THREE.CylinderGeometry(1, 1, 1, 4), col, segM(pts[k], pts[k + 1], 0.06), false);
      const lp = pts[k].clone().lerp(pts[k + 1], 0.5);
      put(b, new THREE.IcosahedronGeometry(1, 0), k % 2 ? COL.moss : col, MX(lp.x, lp.y, lp.z, 0.4, 0.32, 0.4, 0, r()), false);
    }
    if (i % 3 === 0) b.glow(new THREE.SphereGeometry(0.1, 6, 4), 0xffe38f, M(pts[3].x, pts[3].y + 0.1, pts[3].z));
    const fx = gx + Math.cos(a + 0.12) * 9.8;
    const fz = gz + Math.sin(a + 0.12) * 9.8;
    if (!ctx.solids.blocked(fx, fz, 0.8)) fernAt(ctx, fx, fz, 0.9 + r() * 0.5);
  }
  pools.push({ x: cx, z: cz, r: 6, col: 0x7dffd8 });
  shaftsAt(ctx, gx, gz, [
    { x: -4, z: 4, w: 2.2, h: 20 },
    { x: 5, z: 3, w: 1.5, h: 18 },
  ], LIGHT_DIR, 0xfff2b8, 0.3);
  ctx.extras.push((dt, _t, vfx) => {
    if (vfx.camPos.distanceTo(V(gx, GLADE_H + 3, gz)) > 60) return;
    if (Math.random() > dt * 10) return;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 10;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    vfx.emit({ pos: V(x, ctx.h(x, z) + 0.5 + Math.random() * 2, z), count: 1, color: [0xd8ff8a, 0x9dffd6], speed: [0.1, 0.35], spread: 1, life: [2.5, 4], size: [0.08, 0.14], sizeEnd: 0.3, drag: 0.2, intensity: 2 });
  });
  b.lift = 0;
}

function runeStoneAt(ctx: FieldCtx, x: number, z: number, h: number, face: number): void {
  ctx.place(x, z, 0.5);
  runeStone(ctx.b, x, z, h, STONE, RUNE, face, ctx.r);
  ctx.solids.add(x, z, 0.6);
}

// ───────────────────────── Vine curtain at the narrow gorge mouth ─────────────────────────

function vineCurtain(ctx: FieldCtx): void {
  const { b, r } = ctx;
  // A fallen log spans the narrow gorge, with vines hanging from it, hiding the entrance behind
  const c = V(-60.4, 0, -42.2);
  const a0 = V(-63.6, 0, -41.0);
  const a1 = V(-57.2, 0, -43.4);
  const top = Math.max(ctx.h(a0.x, a0.z), ctx.h(a1.x, a1.z));
  a0.y = ctx.h(a0.x, a0.z) + 0.6;
  a1.y = ctx.h(a1.x, a1.z) + 0.6;
  const mid = V(c.x, Math.min(top, ctx.h(c.x, c.z) + 5.2), c.z);
  b.lift = 0;
  b.add(new THREE.CylinderGeometry(0.5, 0.6, 1, 8), COL.bark, segM(a0, mid, 1));
  b.add(new THREE.CylinderGeometry(0.45, 0.5, 1, 8), COL.bark, segM(mid, a1, 1));
  const gy = ctx.h(c.x, c.z);
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const p = t < 0.5 ? a0.clone().lerp(mid, t * 2) : mid.clone().lerp(a1, (t - 0.5) * 2);
    const len = Math.max(0.5, p.y - gy - 0.2 - r() * 0.6);
    const col = i % 3 ? 0x4f8a3a : 0x6aa84e;
    b.add(new THREE.CylinderGeometry(0.035, 0.05, len, 4), col, M(p.x, p.y - len / 2, p.z), false);
    for (let k = 0; k < 3; k++) put(b, new THREE.IcosahedronGeometry(1, 0), k % 2 ? COL.moss : col, MX(p.x + (r() - 0.5) * 0.3, p.y - len * (0.2 + k * 0.3), p.z + (r() - 0.5) * 0.3, 0.3, 0.26, 0.18, 0, r() * 6), false);
  }
  // A few small white flowers beside the entrance (a hint for attentive players)
  flowerPatch(ctx, c.x + 1.8, c.z + 2.4, [0xffffff, 0x9dffd6], 5, 1.0);
}

// ───────────────────────── Around the Seal Tower ─────────────────────────

function towerGrounds(ctx: FieldCtx, glow: GlowSet): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWER;
  // A ring of stone tablets
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const x = tx + Math.cos(a) * 21.5;
    const z = tz + Math.sin(a) * 21.5;
    if (ctx.pathDist(x, z) < 4) continue;
    runeStoneAt(ctx, x, z, 2.6 + r() * 1.4, Math.atan2(tz - z, tx - x));
  }
  // Stone lanterns in front of the tower: lined up from the ancient gate at the top of the stair all the way to the tower gate
  for (const t of [0.25, 0.55]) {
    const x = 11 + (15.3 - 11) * t;
    const z = -58 + (-62.4 + 58) * t;
    for (const s of [-1, 1]) stoneLantern(ctx, glow, x + s * 3.6, z + s * 0.8, 1.15);
  }
  // Fallen ancient pillars and rubble on the ground
  for (const [x, z, a] of [[tx - 17, tz + 8, 0.6], [tx + 18, tz + 4, -0.9], [tx - 12, tz - 15, 2.1]] as const) {
    ctx.place(x, z, 1.6);
    b.add(new THREE.CylinderGeometry(0.55, 0.6, 4.2, 8), STONE, M(x, 0.4, z, a, 1, 0, Math.PI / 2));
    b.add(new THREE.BoxGeometry(1.4, 1.2, 1.4), STONE_D, M(x + Math.cos(a) * 2.6, 0.5, z - Math.sin(a) * 2.6, a + 0.3, 1, 0.1, 0.2));
    ctx.solids.add(x, z, 1.1);
  }
  // Vines hanging from the tower shaft (from the eaves of each floor, more on the back and sides)
  const face = Math.atan2(-4 - tx, 70 - tz);
  const ty = ctx.h(tx, tz);
  const floors = 6;
  let yb = 3.3;
  for (let i = 0; i < floors; i++) {
    const t = i / (floors - 1);
    const rr = 7.4 + (3.8 - 7.4) * t;
    const wallH = i === 0 ? 8 : 3.3;
    const eaveR = rr * 1.42;
    const eaveY = yb + wallH;
    const n = i === 0 ? 10 : 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + i * 0.4 + r() * 0.3;
      // Fewer hung on the front of the gate
      const rel = Math.atan2(Math.sin(a - face), Math.cos(a - face));
      if (Math.abs(rel) < 0.5) continue;
      const px = tx + Math.sin(a) * eaveR * 0.93;
      const pz = tz + Math.cos(a) * eaveR * 0.93;
      const len = 1.5 + r() * (i === 0 ? 5 : 3);
      const y = ty + eaveY;
      b.lift = 0;
      b.add(new THREE.CylinderGeometry(0.04, 0.06, len, 4), 0x4f8a3a, M(px, y - len / 2, pz), false);
      for (let q = 0; q < 3; q++) put(b, new THREE.IcosahedronGeometry(1, 0), q % 2 ? COL.moss : 0x5c9a40, MX(px, y - len * (0.15 + q * 0.3), pz, 0.32, 0.28, 0.32, 0, r() * 6), false);
    }
    yb = eaveY + 1.1;
  }
  // An old tree root coiled behind the tower base
  {
    const back = face + Math.PI;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const a = back - 1.3 + (k / 6) * 2.6;
      const d = 12.6 + Math.sin(k * 1.7) * 0.6;
      const x = tx + Math.sin(a) * d;
      const z = tz + Math.cos(a) * d;
      pts.push(V(x, ctx.h(x, z) + 0.9 + Math.sin(k * 2.1) * 0.6, z));
    }
    b.lift = 0;
    taperTube(ctx, pts, 1.2, 0.9, COL.bark, 16);
  }
  shaftsAt(ctx, tx, tz, [
    { x: -10, z: 12, w: 2.6, h: 34 },
    { x: 12, z: 8, w: 2.0, h: 30 },
    { x: -14, z: -6, w: 1.8, h: 30 },
  ], LIGHT_DIR, 0xfff2b8, 0.22);
  b.lift = 0;
}

// ───────────────────────── Assembly ─────────────────────────

export function buildLandmarks(ctx: FieldCtx): void {
  const glow = new GlowSet(0xffc86a);
  const rune = new GlowSet(RUNE);
  const pools: Pool[] = [];
  motherTree(ctx, glow);
  bridge(ctx, glow);
  gorge(ctx, rune);
  cliffDressing(ctx);
  fallenGiant(ctx);
  fairyHollow(ctx, pools);
  stoneCircle(ctx, rune);
  islandShrine(ctx, glow);
  secretGlade(ctx, rune, pools);
  vineCurtain(ctx);
  towerGrounds(ctx, glow);

  // Light shafts at the giant-tree colonnade and at the top of the stair
  shaftsAt(ctx, 4, 8, [
    { x: 2, z: 4, w: 2.2, h: 26 },
    { x: -6, z: -4, w: 1.8, h: 24 },
    { x: 8, z: -10, w: 1.6, h: 22 },
  ], LIGHT_DIR, 0xfff2b8, 0.2);

  // Light spots (fungus ring, under giant umbrella mushrooms): build one additively blended mesh ourselves, hugging the terrain
  groundPools(ctx, pools);

  const setGlow = glow.build(ctx.group, ctx.disposers);
  const setRune = rune.build(ctx.group, ctx.disposers);
  ctx.extras.push((_dt, t) => {
    setGlow(2.0 + 0.22 * Math.sin(t * 1.7) + 0.1 * Math.sin(t * 4.3));
    setRune(1.7 + 0.5 * Math.sin(t * 1.1));
  });
  // A few representative shrubs and flowers (accents beside landmarks)
  bushAt(ctx, MOTHER[0] + 12, MOTHER[1] + 12, 1.4);
  ctx.b.lift = 0;
  void smooth;
  void FLOWERS;
}

/** Light spots hugging the ground (soft round discs, additive blending) */
function groundPools(ctx: FieldCtx, pools: Pool[]): void {
  for (const p of pools) groundGlow(ctx, p.x, p.z, p.r, p.col, 0.45);
}
