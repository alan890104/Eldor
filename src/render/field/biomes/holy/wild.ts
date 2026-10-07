// Field and landmarks of the holy city: in the west the Cloud Overlook (a turning orrery), the fallen giant angel statue,
// the Old Chapel Ruins, the Cloud Spine to the secret realm and the Griffin Nest; in the east, on the Sky Garden Isle, the hedge
// garden, the Stained-Glass Ring and the Windchime Shrine atop the Cloud Pasture; in the north, on the Seal Tower Isle, the
// purification barrier, the seal pillars, the Church knights' tents, the scale of the Tribunal and the empty cages of the
// Purification Ward. Also the island edge (colliders, rocks, cloud puffs) and the flowering trees, cypresses and wildflowers
// across the whole field.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import { segM } from '../../../arenas/_woods.ts';
import { sceneMaterial } from '../../../spiritToon.ts';
import { inkScenery } from '../../../ink.ts';
import { flowers, tent, type FieldCtx, type XZ } from '../../kit.ts';
import { bush, scatterMask } from '../../props.ts';
import { C, angel, balustrade, type At, bench, column, cypress, flowerTree, frame, hedge, lamp, statue, tholos, toWorld } from './arch.ts';
import { barrier, cloudPuff, type Banners } from './sky.ts';
import { fountain, type Mats } from './town.ts';
import * as SH from './shape.ts';

const Box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const Cyl = (a: number, b: number, h: number, n = 10) => new THREE.CylinderGeometry(a, b, h, n);

/** The direction pointing outward from the island edge (the negative gradient of shore) */
function outward(x: number, z: number): [number, number] {
  const gx = SH.shore(x + 0.7, z) - SH.shore(x - 0.7, z);
  const gz = SH.shore(x, z + 0.7) - SH.shore(x, z - 0.7);
  const l = Math.hypot(gx, gz) || 1;
  return [-gx / l, -gz / l];
}

// ───────────────────────── Island edge ─────────────────────────

/**
 * Island edge: a ring of colliders (so nobody walks off the cliff); the field's island edge gets white stones and
 * small flowers, with cloud puffs welling up outside
 */
export function buildRims(ctx: FieldCtx): void {
  const { b, r, low } = ctx;
  const pts = SH.rimPoints(1);
  for (const [x, z] of pts) ctx.solids.add(x, z, 0.78);
  // No extra stones where there are railings (Outer City, Cloud Overlook, bridgeheads)
  const built = (x: number, z: number) =>
    Math.hypot(x - SH.TOWN[0], z - SH.TOWN[1] - 2) < 30 ||
    Math.hypot(x - SH.OVERLOOK[0], z - SH.OVERLOOK[1]) < 12 ||
    SH.BRIDGES.some((s) => SH.segDist(s.a, s.c, x, z)[0] < s.w + 1.5);
  let k = 0;
  for (const [x, z] of pts) {
    k++;
    const [ox, oz] = outward(x, z);
    const h = ctx.h(x, z);
    if (!built(x, z) && k % 3 === 0) {
      const u = r();
      if (u < 0.45) {
        const s = 0.5 + r() * 0.9;
        ctx.b.lift = h - 0.25;
        b.add(new THREE.DodecahedronGeometry(s, 0), r() < 0.5 ? C.rock : C.rock2, M(x + ox * 0.4, 0, z + oz * 0.4, r() * 6, 1, r() * 0.6, r() * 0.6).multiply(MS(0, 0, 0, 1, 0.6, 1)));
      } else if (u < 0.7) {
        flowers(ctx, x - ox * 1.2, z - oz * 1.2, C.flower, 4);
      }
    }
    // Cloud puffs: one every few meters along the island edge, hung below the edge
    if (k % (low ? 14 : 8) === 0) {
      const d = 3 + r() * 6;
      const top = SH.ground(x, z).top;
      ctx.b.lift = 0;
      cloudPuff(b, x + ox * d, top - 5 - r() * 9, z + oz * d, 2.5 + r() * 3, r, 3);
    }
    if (k % (low ? 18 : 11) === 0) {
      const d = 6 + r() * 10;
      ctx.b.lift = 0;
      cloudPuff(b, x + ox * d, SH.CLOUD_Y + 2 + r() * 3, z + oz * d, 4 + r() * 4, r, 4);
    }
  }
  b.lift = 0;
}

// ───────────────────────── West: Cloud Overlook, fallen angel, ruins, Cloud Spine and Griffin Nest ─────────────────────────

/** Orrery: three crossed gold rings turn slowly on a stone base, with a glowing orb in the middle */
function armillary(ctx: FieldCtx, x: number, z: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, 0, 2);
  const y0 = ctx.b.lift;
  b.add(Cyl(2.4, 2.8, 0.7, 16), C.stoneDark, at(M(0, 0.2, 0)));
  b.add(Cyl(1.0, 1.6, 1.8, 12), C.stone, at(M(0, 1.4, 0)));
  b.add(Cyl(1.4, 1.0, 0.3, 12), C.gold, at(M(0, 2.4, 0)));
  b.glow(new THREE.SphereGeometry(0.55, 14, 10), C.glow, at(M(0, 4.6, 0)));
  const gold = sceneMaterial(C.gold, { rim: 0.6, surface: 'metal' });
  const rings: THREE.Object3D[] = [];
  const root = new THREE.Group();
  root.position.set(x, y0 + 4.6, z);
  ctx.group.add(root);
  [2.1, 1.75, 1.4].forEach((rad, i) => {
    const pivot = new THREE.Group();
    const g = new THREE.TorusGeometry(rad, 0.08, 6, 48);
    pivot.add(new THREE.Mesh(g, gold));
    pivot.rotation.set(i * 0.7 + 0.3, i * 1.1, i * 0.4);
    root.add(pivot);
    rings.push(pivot);
  });
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 6), gold);
  axis.rotation.z = 0.4;
  root.add(axis);
  // Outline the three gold rings; the thin axis is not outlined, as before
  inkScenery(root, { skip: (m) => m === axis });
  ctx.disposers.push(() => gold.dispose());
  ctx.extras.push((dt) => {
    rings[0].rotation.y += dt * 0.25;
    rings[1].rotation.x += dt * 0.32;
    rings[2].rotation.z -= dt * 0.4;
  });
  ctx.solids.add(x, z, 2.8);
}

/**
 * Stone-carved wing: the wing bone arches gently along X, and three rows of feathers (primaries, secondaries,
 * coverts) hang down toward -Y, pointing more outward toward the wing tip, layered one over another.
 * o, X and Y are all in at's local coordinates.
 */
function featherWing(ctx: FieldCtx, at: At, o: THREE.Vector3, X: THREE.Vector3, Yh: THREE.Vector3, len: number, n: number): void {
  const { b } = ctx;
  const Xn = X.clone().normalize();
  const Z = new THREE.Vector3().crossVectors(Xn, Yh).normalize();
  const Y = new THREE.Vector3().crossVectors(Z, Xn).normalize();
  const basis = new THREE.Matrix4().makeBasis(Xn, Y, Z).setPosition(o);
  const W = (m: THREE.Matrix4) => at(basis.clone().multiply(m));
  const P = (t: number) => new THREE.Vector3(len * t, Math.sin(Math.PI * t) * len * 0.1, 0);
  const seg = 4;
  for (let i = 0; i < seg; i++) {
    const r0 = 0.55 * (1 - (i / seg) * 0.7);
    const r1 = 0.55 * (1 - ((i + 1) / seg) * 0.7);
    b.add(new THREE.CylinderGeometry(r1 / r0, 1, 1, 8), C.marble, W(segM(P(i / seg), P((i + 1) / seg), r0)));
  }
  const rows = [
    { n: Math.round(10 * n), t1: 1.0, L0: 0.34, L1: 0.6, w: 0.07, z: -0.14, col: C.marble },
    { n: Math.round(8 * n), t1: 0.86, L0: 0.22, L1: 0.3, w: 0.065, z: 0.0, col: C.wall },
    { n: Math.round(7 * n), t1: 0.72, L0: 0.12, L1: 0.15, w: 0.06, z: 0.14, col: C.marble },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const t = ((i + 0.5) / row.n) * row.t1;
      const th = -Math.PI / 2 + t * 1.25;
      const L = len * (row.L0 + (row.L1 - row.L0) * t);
      const c = P(t).addScaledVector(new THREE.Vector3(Math.cos(th), Math.sin(th), 0), L * 0.5 - 0.2);
      c.z = row.z;
      const m = new THREE.Matrix4().makeRotationZ(th).setPosition(c).multiply(new THREE.Matrix4().makeScale(L / 2, len * row.w, 0.14));
      b.add(new THREE.SphereGeometry(1, 8, 4), row.col, W(m));
    }
  }
}

export function buildWest(ctx: FieldCtx): void {
  const { b, r } = ctx;
  // Cloud Overlook
  const [ox, oz] = SH.OVERLOOK;
  armillary(ctx, ox, oz);
  const rim = SH.traceRim(ox + 4, oz, Math.PI * 0.6, Math.PI * 1.38, 0.05, 1.05, 24);
  balustrade(ctx, rim, { pier: 5, glowPier: true });
  for (const [a, d] of [[2.4, 6], [3.9, 6]] as const) bench(ctx, ox + Math.cos(a) * d, oz + Math.sin(a) * d, -a - Math.PI / 2);
  for (const a of [1.5, 4.7]) lamp(ctx, ox + Math.cos(a) * 7.5, oz + Math.sin(a) * 7.5, 3.2);

  // The fallen giant angel statue: lying on its back, half buried in the grass, with the upper body showing, broken off
  // at the waist, the hand holding the holy orb up to the sky, one huge wing stuck slanting into the sky, the other,
  // broken-off wing lying flat on the grass, and the shattered halo standing beside the head
  {
    const [fx, fz] = SH.FALLEN;
    const F = 0.5;
    const at = frame(ctx, fx, fz, F, 5);
    b.lift -= 0.7;
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const limb = (p0: THREE.Vector3, p1: THREE.Vector3, r0: number, r1: number, col: number = C.marble) =>
      b.add(new THREE.CylinderGeometry(r1 / r0, 1, 1, 12), col, at(segM(p0, p1, r0)));
    // Head: face to the sky, a ring of curls, the bridge of the nose and the brows
    const head = new THREE.SphereGeometry(2.0, 20, 14);
    head.scale(1, 0.95, 1.12);
    b.add(head, C.marble, at(M(0, 1.3, 2.4)));
    for (let i = 0; i < 9; i++) {
      const a = -0.4 + (i / 8) * (Math.PI + 0.8);
      b.add(new THREE.IcosahedronGeometry(0.75, 1), C.wall, at(M(Math.cos(a) * 1.85, 1.0 + Math.sin(a * 3) * 0.2, 2.5 + Math.sin(a) * 2.0)));
    }
    b.add(Box(0.42, 0.55, 1.0), C.marble, at(M(0, 3.15, 2.9, 0, 1, 0.25, 0)));
    b.add(Box(2.0, 0.28, 0.4), C.marble, at(M(0, 3.05, 3.5, 0, 1, 0.3, 0)));
    // Shattered halo: standing at the head end, its lower edge sunk into the ground
    b.add(new THREE.TorusGeometry(2.8, 0.26, 6, 36, Math.PI * 1.55), C.gold, at(M(-0.4, 2.9, 5.9, 0.35, 1, 0, 1.6)));
    b.add(new THREE.TorusGeometry(2.8, 0.26, 6, 8, 0.5), C.gold, at(M(2.6, 0.55, 5.2, 1.4, 1, Math.PI / 2 - 0.15, 0)));
    // Neck, chest, shoulders
    limb(V(0, 0.9, 0.9), V(0, 0.9, -0.4), 1.0, 1.1);
    const chest = new THREE.SphereGeometry(1, 18, 12);
    chest.scale(2.6, 1.45, 2.3);
    b.add(chest, C.marble, at(M(0, 0.8, -2.0)));
    for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(1.1, 12, 10), C.marble, at(M(s * 2.3, 1.0, -1.1)));
    // Robe: a cylinder lying flat, a belt, a few folds, broken off at the waist
    limb(V(0, 0.35, -2.2), V(0, 0.35, -6.6), 1.95, 2.05, C.wall);
    b.add(new THREE.TorusGeometry(2.0, 0.13, 6, 28), C.gold, at(M(0, 0.35, -3.4)));
    for (const x of [-1.25, -0.45, 0.45, 1.25]) {
      const y = 0.35 + Math.sqrt(2.05 * 2.05 - x * x) - 0.08;
      limb(V(x, y, -3.7), V(x * 1.05, y - 0.05, -6.5), 0.16, 0.19, C.wall);
    }
    b.add(Cyl(2.0, 2.0, 0.12, 20), C.rock2, at(M(0, 0.35, -6.62, 0, 1, Math.PI / 2, 0)), false);
    // The hand holding the holy orb up to the sky
    limb(V(-2.4, 1.2, -1.1), V(-4.1, 3.3, -0.2), 0.8, 0.66);
    limb(V(-4.1, 3.3, -0.2), V(-4.5, 6.7, 0.7), 0.66, 0.52);
    b.add(new THREE.CylinderGeometry(0.9, 0.62, 0.9, 12), C.wall, at(segM(V(-4.02, 3.0, -0.3), V(-4.18, 3.8, -0.05), 1)));
    b.add(new THREE.SphereGeometry(0.66, 12, 10), C.marble, at(M(-4.55, 7.15, 0.8)));
    for (const [dx, dz] of [[-0.45, 0.2], [0.45, 0.3], [0, -0.45], [0.1, 0.55]] as const) limb(V(-4.55 + dx * 0.6, 7.3, 0.8 + dz * 0.6), V(-4.55 + dx * 1.6, 8.0, 0.85 + dz * 1.6), 0.17, 0.13);
    b.glow(new THREE.SphereGeometry(1.0, 18, 14), C.glow, at(M(-4.55, 8.45, 0.85)));
    b.add(new THREE.TorusGeometry(1.2, 0.1, 5, 24), C.gold, at(M(-4.55, 8.45, 0.85, 0.5, 1, 1.2, 0.3)));
    // The other arm lies along the body, broken off at the forearm
    limb(V(2.5, 0.8, -1.3), V(3.2, 0.55, -4.6), 0.72, 0.62);
    b.add(Cyl(0.62, 0.62, 0.08, 12), C.rock2, at(M(3.2, 0.55, -4.64, 0, 1, Math.PI / 2 - 0.08, 0.2)), false);
    // Wings: one stuck slanting into the sky (wing face toward the head side, so the whole span of feathers is visible
    // from the path), the other broken off and lying flat
    featherWing(ctx, at, V(2.9, 0.4, -0.4), V(0.46, 0.87, -0.18), V(-0.88, 0.46, 0), 9.2, 1);
    featherWing(ctx, at, V(4.2, 0.62, -3.6), V(0.55, 0.02, -0.83), V(-0.83, 0, -0.55), 5.6, 0.7);
    b.add(new THREE.CylinderGeometry(1, 1, 1, 10), C.rock2, at(segM(V(4.18, 0.62, -3.57), V(4.22, 0.62, -3.63), 0.42)), false);
    // Rubble scattered around and a few fallen stone feathers
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2;
      const d = 6 + r() * 5;
      const [wx, wz] = toWorld(fx, fz, F, Math.cos(a) * d, Math.sin(a) * d);
      if (SH.shore(wx, wz) < 3 || ctx.pathDist(wx, wz) < 3) continue;
      ctx.place(wx, wz, 0.5);
      if (i % 3 === 0) {
        const g = new THREE.SphereGeometry(1, 7, 4);
        g.scale(1.3, 0.12, 0.42);
        b.add(g, C.marble, M(wx, 0.12, wz, r() * 6));
      } else b.add(new THREE.DodecahedronGeometry(0.35 + r() * 0.45, 0), C.marble, M(wx, 0.15, wz, r() * 6, 1, r(), r()));
    }
    ctx.b.lift = 0;
    for (const [lx, lz, rr] of [
      [0, 2.5, 2.3], [-0.4, 5.9, 1.4], [0, -1.8, 2.6], [0, -4.9, 2.2], [3.3, -0.1, 1.3], [3.1, -3.4, 1.0], [-3.4, -0.6, 1.0],
      [4.8, -4.5, 1.3], [5.7, -5.9, 1.3], [6.6, -7.3, 1.2], [5.8, -3.8, 1.1], [6.7, -5.2, 1.1],
    ] as const) {
      const [wx, wz] = toWorld(fx, fz, F, lx, lz);
      ctx.solids.add(wx, wz, rr);
    }
  }

  // Old Chapel Ruins: a collapsed rotunda, broken columns, scattered column drums, half-buried dome
  // fragments, grown-in light crystals
  {
    const [rx, rz] = SH.RUINS;
    tholos(ctx, rx, rz, 7, 10, 5.5, C.gold, 0.5);
    const at = frame(ctx, rx, rz, 0, 8);
    // Half-buried dome shell
    const shell = new THREE.SphereGeometry(4.2, 16, 8, 0, Math.PI * 1.2, 0, Math.PI / 2);
    b.add(shell, C.wall, at(M(10.5, -0.8, 3.5, 0.8, 1, 0.5, 0.35)));
    b.add(new THREE.TorusGeometry(4.2, 0.2, 5, 16, Math.PI * 1.2), C.gold, at(M(10.5, -0.8, 3.5, 0.8, 1, 0.5 + Math.PI / 2, 0.35)), false);
    ctx.solids.add(rx + 10.5, rz + 3.5, 3.6);
    // Fallen column drums
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      const d = 9 + r() * 5;
      const x = rx + Math.cos(a) * d;
      const z = rz + Math.sin(a) * d;
      if (!ctx.clear(x, z, 1) || SH.shore(x, z) < 4) continue;
      ctx.place(x, z, 1);
      const len = 1.6 + r() * 2;
      b.add(Cyl(0.38, 0.38, len, 10), C.wall, M(x, 0.33, z, r() * 3, 1, 0, Math.PI / 2));
      ctx.solids.add(x, z, 0.9);
    }
    // Broken arch
    // Broken arch: it spans the path to the Cloud Spine, and you walk through under the arch
    const [gx, gz, gf] = [-66.8, 1.9, -0.52];
    const ag = frame(ctx, gx, gz, gf, 3);
    for (const s of [-1, 1]) b.add(Box(0.9, s > 0 ? 6.2 : 3.4, 0.9), C.wall, ag(M(s * 3.1, s > 0 ? 3.1 : 1.7, 0)));
    b.add(new THREE.TorusGeometry(3.1, 0.4, 6, 14, Math.PI * 0.55), C.wall, ag(M(0, 6.2, 0)));
    b.add(Box(1.3, 0.4, 1.3), C.stoneDark, ag(M(3.1, 0.1, 0)));
    b.add(Box(1.3, 0.4, 1.3), C.stoneDark, ag(M(-3.1, 0.1, 0)));
    for (const s of [-1, 1]) {
      const [wx, wz] = toWorld(gx, gz, gf, s * 3.1, 0);
      ctx.solids.add(wx, wz, 0.7);
    }
    // Light crystals
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2;
      const d = 2 + r() * 11;
      const x = rx + Math.cos(a) * d;
      const z = rz + Math.sin(a) * d;
      if (ctx.solids.blocked(x, z, 0.6)) continue;
      ctx.place(x, z);
      for (let k = 0; k < 3; k++) {
        const g = new THREE.OctahedronGeometry(0.4);
        g.scale(0.6, 2.4, 0.6);
        b.glow(g, k % 2 ? C.glow : 0xfff0c0, M(x + (r() - 0.5) * 0.8, 0.6, z + (r() - 0.5) * 0.8, r() * 6, 0.7 + r() * 0.6, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7));
      }
    }
  }

  // Cloud Spine: a narrow natural stone ridge, with a broken column at intervals on both sides
  {
    const { a, c, w } = SH.SPINE;
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const ux = (c[0] - a[0]) / len;
    const uz = (c[1] - a[1]) / len;
    for (let t = 4, i = 0; t < len - 3; t += 5.5, i++) {
      const side = i % 2 ? 1 : -1;
      const x = a[0] + ux * t - uz * (w - 1) * side;
      const z = a[1] + uz * t + ux * (w - 1) * side;
      ctx.place(x, z, 0.5);
      const hh = 1.2 + r() * 2.2;
      b.add(Cyl(0.34, 0.4, hh, 10), C.wall, M(x, hh / 2, z));
      b.add(Box(1.05, 0.28, 1.05), C.stoneDark, M(x, 0.14, z));
      if (r() < 0.5) b.glow(new THREE.OctahedronGeometry(0.18), C.glow, M(x, hh + 0.4, z));
      // Clouds below the ridge
      ctx.b.lift = 0;
      cloudPuff(b, a[0] + ux * t - uz * (w + 4) * side, SH.ground(x, z).top - 6 - r() * 4, a[1] + uz * t + ux * (w + 4) * side, 3 + r() * 2, r, 3);
    }
  }

  // Griffin Nest: a large nest woven from gold branches, three glowing eggs, an ancient arch hung with morning chimes
  {
    const [nx, nz] = SH.NEST;
    const at = frame(ctx, nx + 2.5, nz + 1, 0, 3);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + r() * 0.2;
      const rr = 2.6 + r() * 0.8;
      const y = 0.25 + r() * 0.9;
      b.add(Cyl(0.07, 0.07, 1.8 + r() * 1.2, 4), r() < 0.5 ? 0xc8a060 : 0xe0bc70, at(M(Math.cos(a) * rr, y, Math.sin(a) * rr, -a, 1, (r() - 0.5) * 0.8, Math.PI / 2 + (r() - 0.5) * 0.5)), false);
    }
    b.add(Cyl(2.9, 2.2, 0.5, 16), 0xb89050, at(M(0, 0.2, 0)));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const g = new THREE.SphereGeometry(0.55, 12, 10);
      g.scale(1, 1.3, 1);
      b.add(g, i === 1 ? 0xfff2cc : C.marble, at(M(Math.cos(a) * 0.9, 0.95, Math.sin(a) * 0.9)));
    }
    b.glow(new THREE.SphereGeometry(0.3, 10, 8), C.glow, at(M(0, 1.1, 0)));
    ctx.solids.add(nx + 2.5, nz + 1, 3.3);
    // A big feather the griffin dropped: stuck slanting in the rim of the nest, white vanes, gold shaft and tip
    for (const [lx, lz, ry, tilt] of [[4.4, 1.2, 0.4, 0.35], [-0.6, 4.3, 2.0, 0.3], [3.2, -3.4, -0.9, 0.42], [4.9, -1.2, 0.1, 0.55]] as const) {
      const [wx, wz] = [nx + 2.5 + lx, nz + 1 + lz];
      ctx.place(wx, wz, 0.4);
      const R = M(wx, 0, wz, ry, 1, 0, tilt);
      const vane = new THREE.SphereGeometry(1, 10, 6);
      vane.scale(0.42, 1.5, 0.06);
      b.add(vane, 0xfbf6ea, R.clone().multiply(M(0.12, 1.55, 0)));
      const tip = new THREE.SphereGeometry(1, 8, 5);
      tip.scale(0.3, 0.5, 0.07);
      b.add(tip, C.gold, R.clone().multiply(M(0.1, 2.75, 0)), false);
      b.add(Cyl(0.035, 0.05, 3.4, 5), C.gold, R.clone().multiply(M(0, 1.3, 0)), false);
      ctx.solids.add(wx, wz, 0.35);
    }
    // Morning-chime arch
    const ag = frame(ctx, nx - 4, nz + 5, 0.9, 2);
    for (const s of [-1, 1]) column(ctx, ag, s * 2.4, 0, 0, 4.2, 0.3, C.marble);
    b.add(Box(6.2, 0.6, 1.0), C.wall, ag(M(0, 5.8, 0)));
    b.add(Box(6.4, 0.1, 1.1), C.gold, ag(M(0, 5.45, 0)), false);
    for (let i = 0; i < 5; i++) {
      const lx = -1.6 + i * 0.8;
      const drop = 0.8 + (i % 2) * 0.5;
      b.add(Cyl(0.015, 0.015, drop, 3), C.gold, ag(M(lx, 5.5 - drop / 2, 0)), false);
      b.add(new THREE.ConeGeometry(0.2, 0.34, 10, 1, true), C.gold, ag(M(lx, 5.35 - drop, 0)));
      b.glow(new THREE.SphereGeometry(0.06, 6, 4), C.glow, ag(M(lx, 5.2 - drop, 0)));
    }
    for (const s of [-1, 1]) {
      const [wx, wz] = toWorld(nx - 4, nz + 5, 0.9, s * 2.4, 0);
      ctx.solids.add(wx, wz, 0.6);
    }
    for (const [px, pz] of [[-6, -4], [5, -6], [7, 5]] as const) {
      if (SH.shore(nx + px, nz + pz) < 3) continue;
      ctx.place(nx + px, nz + pz);
      for (let k = 0; k < 3; k++) {
        const g = new THREE.OctahedronGeometry(0.45);
        g.scale(0.6, 2.6, 0.6);
        b.glow(g, k ? 0xfff0c0 : C.glow, M(nx + px + (r() - 0.5), 0.8, nz + pz + (r() - 0.5), r() * 6, 0.8 + r() * 0.5, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
      }
    }
  }
  b.lift = 0;
}

// ───────────────────────── East: Sky Garden, Stained-Glass Ring, Windchime Shrine ─────────────────────────

export function buildEast(ctx: FieldCtx, mats: Mats): THREE.Vector3 {
  const { b, r } = ctx;
  const [gx, gz] = SH.GARDEN;
  // Central fountain
  const spray = fountain(ctx, mats, gx, gz, 3.4, 0.8);
  // Four flower beds: low hedges around the edges (with gaps left), a whole bed of flowers inside, a
  // shrub trimmed into a cone in the center
  const H = 10;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x0 = gx + (sx > 0 ? 2.2 : -H);
    const x1 = gx + (sx > 0 ? H : -2.2);
    const z0 = gz + (sz > 0 ? 2.2 : -H);
    const z1 = gz + (sz > 0 ? H : -2.2);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    hedge(ctx, [x0, z0], [mx - 1, z0], 0.8, 0.7, true);
    hedge(ctx, [mx + 1, z0], [x1, z0], 0.8, 0.7, true);
    hedge(ctx, [x0, z1], [mx - 1, z1], 0.8, 0.7, true);
    hedge(ctx, [mx + 1, z1], [x1, z1], 0.8, 0.7, true);
    hedge(ctx, [x0, z0], [x0, mz - 1], 0.8, 0.7, true);
    hedge(ctx, [x0, mz + 1], [x0, z1], 0.8, 0.7, true);
    hedge(ctx, [x1, z0], [x1, mz - 1], 0.8, 0.7, true);
    hedge(ctx, [x1, mz + 1], [x1, z1], 0.8, 0.7, true);
    ctx.place(mx, mz, 0.6);
    const g = new THREE.ConeGeometry(0.9, 2.8, 10);
    b.add(g, C.hedge, M(mx, 1.4, mz));
    b.add(new THREE.SphereGeometry(0.5, 10, 8), C.hedge2, M(mx, 3.0, mz));
    ctx.solids.add(mx, mz, 0.9);
    const cols = [C.flower[(sx + sz + 4) % 5], C.flower[2], 0xff9ac0];
    for (let i = 0; i < 9; i++) {
      const fx = x0 + 1.2 + r() * (x1 - x0 - 2.4);
      const fz = z0 + 1.2 + r() * (z1 - z0 - 2.4);
      if (Math.hypot(fx - mx, fz - mz) < 1.4) continue;
      flowers(ctx, fx, fz, cols, 7);
    }
  }
  // Outer ring: cypresses at the four corners, angel statues, benches, lamps
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    cypress(ctx, gx + sx * 12.4, gz + sz * 12.4, 7.5);
    cypress(ctx, gx + sx * 12.4, gz + sz * 8.6, 6.4);
    cypress(ctx, gx + sx * 8.6, gz + sz * 12.4, 6.4);
  }
  for (const [px, pz, f] of [[0, 12.6, Math.PI], [12.6, 0, -Math.PI / 2], [0, -12.6, 0]] as const) statue(ctx, gx + px, gz + pz, f, 1);
  for (const [px, pz] of [[-1.6, 6], [1.6, -6], [6, 1.6], [-6, -1.6]] as const) lamp(ctx, gx + px, gz + pz, 2.8);
  for (const [px, pz, f] of [[-4.2, 1.6, 0], [4.2, -1.6, Math.PI]] as const) bench(ctx, gx + px, gz + pz, f);
  // Rose arcade at the garden entrance (west side)
  for (let i = 0; i < 3; i++) {
    const x = gx - 11 - i * 2.2;
    const at = frame(ctx, x, gz, Math.PI / 2, 1.5);
    b.add(new THREE.TorusGeometry(1.9, 0.09, 5, 14, Math.PI), C.gold, at(M(0, 1.2, 0)).multiply(MS(0, 0, 0, 1, 1.2, 1)), false);
    for (const s of [-1, 1]) {
      b.add(Cyl(0.06, 0.06, 1.2, 4), C.gold, at(M(s * 1.9, 0.6, 0)), false);
      const [wx, wz] = toWorld(x, gz, Math.PI / 2, s * 1.9, 0);
      ctx.solids.add(wx, wz, 0.25);
    }
    // Green leaves covering the arches, with small roses blooming among the leaves; the column bases are wrapped in leaves too
    const arc = (a: number, j: number) => [Math.cos(a) * 1.9 + (r() - 0.5) * j, 1.2 + Math.sin(a) * 2.28 + (r() - 0.5) * j, (r() - 0.5) * 0.35] as const;
    for (let k = 0; k < 13; k++) {
      const [lx, ly, lz] = arc((k / 12) * Math.PI, 0.2);
      b.add(new THREE.IcosahedronGeometry(0.3 + r() * 0.08, 1), k % 3 ? C.hedge : 0x6aa05a, at(M(lx, ly, lz)), false);
    }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.add(new THREE.IcosahedronGeometry(0.22, 1), C.hedge, at(M(s * 1.9 + (r() - 0.5) * 0.2, 0.25 + k * 0.42, (r() - 0.5) * 0.2)), false);
    const roses = [0xff8fb8, 0xffc4dc, 0xfff0f4, 0xff6fa0];
    for (let k = 0; k < 16; k++) {
      const [lx, ly, lz] = arc(r() * Math.PI, 0.35);
      b.add(new THREE.IcosahedronGeometry(0.15 + r() * 0.07, 1), roses[k % roses.length], at(M(lx, ly, lz * 1.6)), false);
    }
  }

  // Stained-Glass Ring: ten pointed-arch stained windows in a circle, facing the glowing crystal altar at the center;
  // colored light spots on the ground in front of the windows
  {
    const [cx, cz] = SH.GLASS;
    const at0 = frame(ctx, cx, cz, 0, 6);
    const y0 = ctx.b.lift;
    b.add(Cyl(2.2, 2.6, 0.8, 12), C.stoneDark, at0(M(0, 0.2, 0)));
    b.add(Cyl(1.2, 1.6, 1.0, 12), C.stone, at0(M(0, 1.0, 0)));
    const core = new THREE.OctahedronGeometry(0.9);
    core.scale(0.8, 1.6, 0.8);
    b.glow(core, 0xfff2d0, at0(M(0, 3.0, 0)));
    ctx.solids.add(cx, cz, 2.6);
    const cols = [0xff8a78, 0x7ab8ff, 0xffd45a, 0x8ae0a0, 0xc79aff];
    const pools: { x: number; z: number; col: number }[] = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const R = 8.4;
      const x = cx + Math.cos(a) * R;
      const z = cz + Math.sin(a) * R;
      const face = Math.atan2(cx - x, cz - z);
      const at = frame(ctx, x, z, face, 1.2);
      const col = cols[i % cols.length];
      const hh = 4.6 + (i % 2) * 0.9;
      b.add(Box(2.9, 0.5, 1.0), C.stoneDark, at(M(0, 0.1, 0)));
      for (const s of [-1, 1]) b.add(Box(0.36, hh, 0.5), C.wall, at(M(s * 1.15, 0.35 + hh / 2, 0)));
      const arch = new THREE.ConeGeometry(1.35, 1.7, 4, 1);
      arch.rotateY(Math.PI / 4);
      b.add(arch, C.wall, at(M(0, 0.35 + hh + 0.8, 0)).multiply(MS(0, 0, 0, 1, 1, 0.3)));
      b.glow(Box(1.9, hh - 0.2, 0.08), col, at(M(0, 0.35 + hh / 2, 0)));
      const tip = new THREE.CircleGeometry(0.95, 3, Math.PI / 6, (Math.PI * 2) / 3);
      b.glow(tip, col, at(M(0, 0.35 + hh + 0.2, 0.04)));
      b.add(Box(0.08, hh, 0.14), C.gold, at(M(0, 0.35 + hh / 2, 0.05)), false);
      for (const ly of [0.3, 0.6]) b.add(Box(1.9, 0.07, 0.14), C.gold, at(M(0, 0.35 + hh * ly, 0.05)), false);
      b.glow(new THREE.OctahedronGeometry(0.16), C.glow, at(M(0, 0.35 + hh + 1.75, 0)));
      ctx.solids.add(x, z, 1.25);
      pools.push({ x: cx + Math.cos(a) * (R - 2.6), z: cz + Math.sin(a) * (R - 2.6), col });
    }
    const tex = new THREE.CanvasTexture(discCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, vertexColors: true, opacity: 0.8 });
    const geos: THREE.BufferGeometry[] = [];
    for (const p of pools) {
      const g = new THREE.PlaneGeometry(4.2, 4.2);
      g.rotateX(-Math.PI / 2);
      g.translate(p.x, y0 + 0.1, p.z);
      const c = new THREE.Color(p.col);
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).map((_, k) => [c.r, c.g, c.b][k % 3]), 3));
      geos.push(g);
    }
    const m = new THREE.Mesh(mergeAll(geos), mat);
    m.renderOrder = 2;
    ctx.group.add(m);
    ctx.disposers.push(() => {
      mat.dispose();
      tex.dispose();
    });
  }

  // Cloud Pasture: the Windchime Shrine at the top of the slope and a few white stones
  {
    const [hx, hz] = SH.HILL;
    tholos(ctx, hx, hz, 3.2, 8, 3.6, C.gold);
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2;
      const d = 8 + r() * 10;
      const x = hx + Math.cos(a) * d;
      const z = hz + Math.sin(a) * d;
      if (!ctx.clear(x, z, 1.5) || SH.shore(x, z) < 5) continue;
      ctx.place(x, z, 1);
      const s = 0.8 + r() * 1.4;
      b.add(new THREE.DodecahedronGeometry(s, 0), r() < 0.5 ? C.rock : C.rock2, M(x, s * 0.35, z, r() * 6, 1, r() * 0.5, r() * 0.5));
      ctx.solids.add(x, z, s * 0.85);
    }
  }
  b.lift = 0;
  return spray;
}

function discCanvas(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,0.9)');
  rg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  return cv;
}

function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...(ng.attributes.position.array as Float32Array));
    col.push(...(ng.attributes.color.array as Float32Array));
    uv.push(...(ng.attributes.uv.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

// ───────────────────────── North: Seal Tower Isle ─────────────────────────

export function buildHolyIsle(ctx: FieldCtx, banners: Banners): THREE.Vector3 | null {
  const { b, r } = ctx;
  const [tx, tz] = SH.TOWER;
  const ty = ctx.h(tx, tz);
  // After all the tower floors are broken through: the barrier is removed, the seal pillars stop shooting light, the tents are
  // taken away and replaced by flower beds, all the cages of the Purification Ward are opened
  const pure = ctx.done >= ctx.floors;
  // Seal pillars: eight white stone pillars ring the tower (avoiding the tower gate), and the light
  // crystal on top shoots a beam at the tower shaft
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const x = tx + Math.cos(a) * 25;
    const z = tz + Math.sin(a) * 25;
    const at = frame(ctx, x, z, -a + Math.PI / 2, 1.5);
    const y0 = ctx.b.lift;
    b.add(Box(2.4, 0.6, 2.4), C.stoneDark, at(M(0, 0.2, 0)));
    const g = new THREE.CylinderGeometry(0.5, 0.85, 8, 4);
    g.rotateY(Math.PI / 4);
    b.add(g, C.marble, at(M(0, 4.4, 0)));
    b.add(Box(1.5, 0.35, 1.5), C.gold, at(M(0, 8.5, 0)));
    for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.2, 1.0, 4), C.gold, at(M(s * 0.6, 9.1, 0)));
    const crystal = new THREE.OctahedronGeometry(0.7);
    crystal.scale(0.7, 1.4, 0.7);
    b.glow(crystal, C.glow, at(M(0, 10.3, 0)));
    b.glow(Box(0.06, 5.5, 0.06), C.glow, at(M(0, 4.4, 0.55)));
    // Beam: from the crystal to the tower shaft (it goes out once the purification is complete)
    if (!pure) {
      const p0 = new THREE.Vector3(x, y0 + 10.3, z);
      const p1 = new THREE.Vector3(tx + Math.cos(a) * 8, ty + 21, tz + Math.sin(a) * 8);
      ctx.b.lift = 0;
      b.glow(new THREE.CylinderGeometry(1, 1, 1, 5), 0xffe7a8, segM(p0, p1, 0.07));
    }
    ctx.solids.add(x, z, 1.4);
  }
  // Ring of light on the ground
  ctx.b.lift = ty + 0.06;
  b.glow(new THREE.TorusGeometry(24, 0.09, 4, 160), C.glow, M(tx, 0, tz, 0, 1, Math.PI / 2));
  b.glow(new THREE.TorusGeometry(23.4, 0.04, 4, 160), C.glow, M(tx, 0, tz, 0, 1, Math.PI / 2));
  // The Church's purification barrier: a faint golden diamond-lattice wall of light rises along the ring of light
  b.lift = 0;
  if (!pure) barrier(ctx, tx, tz, 24, 13);
  // Knight statues in front of the tower gate, and the Church's tents and flags
  for (const s of [-1, 1]) {
    knight(ctx, s * 4.6, -49.5, 0);
    if (!pure) {
      tent(ctx, s * 15, -50, 2.6, 0xf4efe6, C.roof2, s > 0 ? -1.2 : 1.2);
      tent(ctx, s * 19.5, -54.5, 2.1, 0xf4efe6, C.roof2, s > 0 ? -1.2 : 1.2);
    } else {
      // The camp has been taken away; in its place are flowers planted by the residents
      for (const [px, pz] of [[s * 15, -50], [s * 19.5, -54.5]] as const) {
        flowers(ctx, px, pz, C.flower, 9);
        flowerTree(ctx, px + s * 1.5, pz - 1.2, 0.7, C.blossom, false);
        ctx.solids.add(px + s * 1.5, pz - 1.2, 0.8);
      }
    }
    const px = s * 9.5;
    const pz = -45.5;
    ctx.place(px, pz);
    b.add(Box(0.6, 0.4, 0.6), C.stoneDark, M(px, 0.2, pz));
    b.add(Cyl(0.09, 0.11, 8, 6), C.gold, M(px, 4, pz));
    b.add(Cyl(0.03, 0.03, 1.4, 4), C.gold, M(px, 7.6, pz, 0, 1, 0, Math.PI / 2), false);
    b.glow(new THREE.OctahedronGeometry(0.18), C.glow, M(px, 8.2, pz));
    banners.add(px, ctx.b.lift + 7.6, pz, 0, 1.3, 4.8, 1);
    ctx.solids.add(px, pz, 0.4);
  }
  // Tribunal: a giant gold scale on a three-tier round platform, ringed by standing law tablets
  {
    const [jx, jz] = SH.TRIBUNAL;
    const at = frame(ctx, jx, jz, 0.5, 6);
    for (let k = 0; k < 3; k++) b.add(Cyl(6.6 - k * 1.3, 6.8 - k * 1.3, 0.5, 28), k % 2 ? C.stone : C.stoneDark, at(M(0, 0.1 + k * 0.45, 0)));
    const y = 1.3;
    b.add(Cyl(0.5, 0.7, 7, 10), C.gold, at(M(0, y + 3.5, 0)));
    b.glow(new THREE.TorusGeometry(0.9, 0.12, 6, 20), C.glow, at(M(0, y + 7.4, 0)));
    b.glow(new THREE.CircleGeometry(0.55, 16), C.glow, at(M(0, y + 7.4, 0.02)));
    b.glow(new THREE.CircleGeometry(0.55, 16), C.glow, at(M(0, y + 7.4, -0.02, Math.PI)));
    const tilt = 0.12;
    b.add(Box(10, 0.35, 0.5), C.gold, at(M(0, y + 6.6, 0, 0, 1, 0, tilt)));
    for (const s of [-1, 1]) {
      const ex = s * 4.8;
      const ey = y + 6.6 + s * Math.sin(tilt) * 4.8;
      b.add(new THREE.SphereGeometry(0.3, 10, 8), C.gold, at(M(ex, ey, 0)));
      const panY = ey - 3.6;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        b.add(new THREE.CylinderGeometry(1, 1, 1, 4), C.goldDeep, at(new THREE.Matrix4()).multiply(segM(new THREE.Vector3(ex, ey, 0), new THREE.Vector3(ex + Math.cos(a) * 1.3, panY, Math.sin(a) * 1.3), 0.03)), false);
      }
      b.add(new THREE.SphereGeometry(1.5, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), C.gold, at(M(ex, panY + 0.1, 0)).multiply(MS(0, 0, 0, 1, 0.35, 1)));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 8.6;
      const z = Math.sin(a) * 8.6;
      b.add(Box(1.6, 3.2, 0.5), C.marble, at(M(x, 1.4, z, -a + Math.PI / 2)));
      b.add(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 12, 1, false, 0, Math.PI), C.marble, at(M(x, 3.0, z, -a, 1, Math.PI / 2, 0)).multiply(M(0, 0, 0, 0, 1, 0, 0)));
      for (let k = 0; k < 4; k++) b.glow(Box(1.0, 0.06, 0.04), C.glow, at(M(x + Math.cos(a) * 0.27, 1.2 + k * 0.45, z + Math.sin(a) * 0.27, -a + Math.PI / 2)));
      const [wx, wz] = toWorld(jx, jz, 0.5, x, z);
      ctx.solids.add(wx, wz, 0.9);
    }
    ctx.solids.add(jx, jz, 5.0);
  }
  // Purification Ward: a white-and-gold altar, three empty gold cages, chains on the ground (one of the
  // cages still has purple mist drifting out)
  let cagePos = new THREE.Vector3();
  {
    const [kx, kz] = SH.CAGES;
    const at = frame(ctx, kx, kz, -0.4, 4);
    const y0 = ctx.b.lift;
    b.add(Box(3.2, 1.2, 1.8), C.marble, at(M(0, 0.5, 0)));
    b.add(Box(3.5, 0.2, 2.1), C.gold, at(M(0, 1.15, 0)));
    b.glow(new THREE.SphereGeometry(0.35, 10, 8), pure ? C.glow : 0xd8b0ff, at(M(0, 1.6, 0)));
    ctx.solids.add(kx, kz, 1.9);
    const spots: [number, number][] = [[-5, 2.5], [0, 4.6], [5, 2.5]];
    spots.forEach(([lx, lz], i) => {
      b.add(Cyl(1.4, 1.5, 0.3, 14), C.stoneDark, at(M(lx, 0.1, lz)));
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        if ((i === 2 || pure) && (k === 2 || k === 3)) continue;
        b.add(Cyl(0.05, 0.05, 3.0, 4), C.gold, at(M(lx + Math.cos(a) * 1.25, 1.7, lz + Math.sin(a) * 1.25)), false);
      }
      b.add(new THREE.SphereGeometry(1.35, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.gold, at(M(lx, 3.2, lz)).multiply(MS(0, 0, 0, 1, 0.55, 1)));
      b.add(new THREE.TorusGeometry(1.3, 0.07, 4, 20), C.goldDeep, at(M(lx, 0.8, lz, 0, 1, Math.PI / 2)), false);
      const [wx, wz] = toWorld(kx, kz, -0.4, lx, lz);
      ctx.solids.add(wx, wz, 1.5);
      if (i === 1) cagePos = new THREE.Vector3(wx, y0 + 1.4, wz);
    });
    for (let k = 0; k < 8; k++) b.add(new THREE.TorusGeometry(0.16, 0.05, 4, 8), C.goldDeep, at(M(-1 + k * 0.32, 0.06, -2, k * 0.8, 1, Math.PI / 2 + (k % 2) * 0.6, 0)), false);
  }
  b.lift = 0;
  void r;
  return pure ? null : cagePos;
}

/** Church knight statue: holding a shield and a long spear */
function knight(ctx: FieldCtx, x: number, z: number, ry: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, ry, 0.8);
  b.add(Box(1.4, 0.8, 1.4), C.stoneDark, at(M(0, 0.4, 0)));
  b.add(new THREE.ConeGeometry(0.55, 1.8, 10), C.marble, at(M(0, 1.7, 0)));
  b.add(Cyl(0.3, 0.38, 0.9, 10), C.marble, at(M(0, 2.9, 0)));
  b.add(new THREE.SphereGeometry(0.26, 10, 8), C.marble, at(M(0, 3.55, 0)));
  b.add(new THREE.ConeGeometry(0.27, 0.5, 10), C.gold, at(M(0, 3.9, 0)));
  const shield = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12);
  shield.rotateX(Math.PI / 2);
  b.add(shield, C.gold, at(M(-0.38, 2.5, 0.35, 0, 1, 0, 0)).multiply(MS(0, 0, 0, 0.8, 1.1, 1)));
  b.add(Cyl(0.05, 0.05, 4.4, 5), C.goldDeep, at(M(0.5, 2.6, 0.1)), false);
  b.add(new THREE.ConeGeometry(0.12, 0.6, 4), C.gold, at(M(0.5, 5.1, 0.1)));
  ctx.solids.add(x, z, 0.9);
}

// ───────────────────────── Field flowering trees, cypresses, wildflowers and rocks ─────────────────────────

export function scatterWild(ctx: FieldCtx): void {
  const { r, low, b } = ctx;
  const k = low ? 0.5 : 1;
  const groves: [number, number, number, number[]][] = [
    [-50, 44, 14, C.blossom],
    [-74, 0, 12, C.goldLeaf],
    [-44, 10, 8, C.blossom],
    [24, 14, 11, C.blossom],
    [56, 44, 10, C.blossom],
    [90, 2, 11, C.goldLeaf],
    [-18, 58, 9, C.blossom],
    [-16, -16, 8, C.goldLeaf],
    [60, -8, 9, C.goldLeaf],
    [18, -70, 8, C.blossom],
    [-18, -90, 8, C.goldLeaf],
    [-84, 36, 8, C.blossom],
  ];
  const groveAt = (x: number, z: number) => {
    let best = 0;
    let cols = C.blossom;
    for (const [gx, gz, gr, gc] of groves) {
      const w = 1 - Math.hypot(x - gx, z - gz) / gr;
      if (w > best) {
        best = w;
        cols = gc;
      }
    }
    return [best, cols] as const;
  };
  const wild = (x: number, z: number, m: number) => SH.shore(x, z) > m && SH.paved(x, z) < 0.15 && Math.hypot(x - SH.TOWN[0], z - SH.TOWN[1]) > SH.TOWN_R + 3 && Math.hypot(x - SH.TOWER[0], z - SH.TOWER[1]) > 27 && Math.hypot(x - SH.GARDEN[0], z - SH.GARDEN[1]) > 15 && Math.hypot(x - SH.GLASS[0], z - SH.GLASS[1]) > 12;
  // Flowering-tree grove
  scatterMask(ctx, Math.round(1500 * k), 1.6, (x, z) => {
    if (!wild(x, z, 4.5)) return 0;
    const [g] = groveAt(x, z);
    return g > 0 ? 0.25 + g * 0.75 : 0.035;
  }, (x, z) => {
    const [g, cols] = groveAt(x, z);
    if (g <= 0 && r() < 0.5) cypress(ctx, x, z, 5 + r() * 3);
    else flowerTree(ctx, x, z, 1.0 + r() * 0.6, cols);
  });
  // A few scattered cypresses (along both sides of the paths)
  scatterMask(ctx, Math.round(900 * k), 1.2, (x, z) => {
    if (!wild(x, z, 5)) return 0;
    const pd = ctx.pathDist(x, z);
    return pd > 4.5 && pd < 7 ? 0.35 : 0;
  }, (x, z) => cypress(ctx, x, z, 5.5 + r() * 2.5));
  // Shrubs and wildflowers
  scatterMask(ctx, Math.round(700 * k), 0.7, (x, z) => (wild(x, z, 3) ? 0.45 : 0), (x, z) => bush(ctx, x, z, 0.7 + r() * 0.6, [0x86b865, 0x9cc874, 0x7aac5a]));
  scatterMask(ctx, Math.round(1600 * k), 0.3, (x, z) => (wild(x, z, 2.5) ? 0.6 : 0), (x, z) => flowers(ctx, x, z, r() < 0.5 ? [0xffffff, 0xfff1b8] : [0xffe27a, 0xffb8cf, 0xffffff], 5));
  // White limestone
  scatterMask(ctx, Math.round(220 * k), 1.4, (x, z) => (wild(x, z, 4) ? 0.35 : 0), (x, z) => {
    const s = 0.6 + r() * 1.2;
    ctx.place(x, z, s * 0.5);
    b.add(new THREE.DodecahedronGeometry(s, 0), r() < 0.5 ? C.rock : C.rock2, M(x, s * 0.3, z, r() * 6, 1, r() * 0.5, r() * 0.5));
    if (s > 1) ctx.solids.add(x, z, s * 0.8);
  });
  b.lift = 0;
}

export { outward, angel };
