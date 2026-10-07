// Wild landmarks of the Emberspine Volcanic Belt: the lava river surface, the stone bridge,
// the natural stone arch over the lava tunnel, the Basalt Colonnade, the Abandoned Mine, the Sword Mound,
// the Sulfur Hot Spring Terraces, the Magma Crater and the Order forge, the Phoenix Nest and lavafall, the Dragon Skeleton,
// cinder cones, lava skylights, and the basalt, charred wood and rubble all over the ground.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M } from '../../../arenaKit.ts';
import { smooth } from '../../compose.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import { groundGlow, scatterMask } from '../../props.ts';
import { banner, curtain, geyserMaterial, hazeMaterial, lavaMaterial, ribbon, springMaterial } from './fx.ts';
import { COL, basalt, brazier, charredTree, emberMaple, local, obsidian, oreCrates, pebbles, rib, scoria, shield, skylight, slopeAt, sulfur, sword, vent } from './props.ts';
import * as SH from './shape.ts';
import { MX, Stains, T, lensZone, put } from './tmpl.ts';

export interface WildOut {
  /** Fumaroles (white steam) */
  steam: THREE.Vector3[];
  /** Steam over the hot spring water */
  springSteam: THREE.Vector3[];
  /** Points on the lava surface (embers, heat) */
  embers: THREE.Vector3[];
  /** Brazier flames */
  flames: THREE.Vector3[];
  /** Purple sparks of the Order forge */
  purple: THREE.Vector3[];
  /** Black smoke (the Order forge's chimney) */
  smoke: THREE.Vector3[];
  /** Phoenix Nest */
  nest: THREE.Vector3;
  /** Center of the Magma Crater's lava surface */
  crater: THREE.Vector3;
  /** Lava skylights */
  skylights: THREE.Vector3[];
  /** Where the lavafall lands (throws up sparks) */
  splash: THREE.Vector3[];
  flags: THREE.BufferGeometry[];
  /** Animated shader time */
  timed: THREE.ShaderMaterial[];
  /** Number of rubble piles (handed to the ground layer to pile at the foot of rocks, not scattered evenly here) */
  pebbles: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildWild(ctx: FieldCtx, riverStart: number, stains: Stains): WildOut {
  const out: WildOut = { steam: [], springSteam: [], embers: [], flames: [], purple: [], smoke: [], nest: new THREE.Vector3(), crater: new THREE.Vector3(), skylights: [], splash: [], flags: [], timed: [], pebbles: 0 };
  lavaSurfaces(ctx, riverStart, out);
  const [main, west] = SH.getCrossings();
  stoneBridge(ctx, main, out);
  lavaTubeArch(ctx, west, out);
  barriers(ctx);
  colonnade(ctx, out);
  mine(ctx, out);
  swordGrave(ctx, out);
  springs(ctx, out, stains);
  craterForge(ctx, out);
  towerApproach(ctx, out);
  phoenixNest(ctx, out);
  dragonBones(ctx);
  cones(ctx, out);
  basaltGate(ctx);
  geysers(ctx, out);
  fieldFeatures(ctx, out);
  out.pebbles = scatter(ctx);
  ctx.b.lift = 0;
  return out;
}

// ───────────────────────── Lava surface ─────────────────────────

function discGeo(cx: number, cz: number, R: number, y: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(R, 40, 0, Math.PI * 2);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const edge = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    edge[i] = Math.hypot(p.getX(i), p.getZ(i)) / R;
    uv.setXY(i, (p.getX(i) + cx) / 4, (p.getZ(i) + cz) / 9);
  }
  g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  g.translate(cx, y, cz);
  return g;
}

function lavaSurfaces(ctx: FieldCtx, riverStart: number, out: WildOut): void {
  const { pts, ts } = SH.riverSamples();
  const y = SH.LAVA + 0.04;
  const seg = pts.slice(Math.max(0, riverStart - 2));
  const t0 = ts[Math.max(0, riverStart - 2)];
  const river = ribbon(
    seg.map(([x, z]) => V(x, y, z)),
    (t) => SH.riverHalfWidth(t0 + (1 - t0) * t) + 1.1,
    () => y,
  );
  const overlay = lavaMaterial({ speed: 0.22, overlay: true, fogK: 0.4 });
  const pools = [discGeo(SH.LAKE[0], SH.LAKE[1], 19, y), discGeo(SH.CRATER[0], SH.CRATER[1], 8.6, y), discGeo((SH.FALL_BAY[0][0] + SH.FALL_BAY[1][0]) / 2, (SH.FALL_BAY[0][1] + SH.FALL_BAY[1][1]) / 2, 9, y + 0.01)];
  const poolMat = lavaMaterial({ speed: 0.06, overlay: true, fogK: 0.4 });
  const rm = new THREE.Mesh(river, overlay);
  rm.renderOrder = 3;
  ctx.group.add(rm);
  for (const g of pools) {
    const m = new THREE.Mesh(g, poolMat);
    m.renderOrder = 3;
    ctx.group.add(m);
  }
  out.timed.push(overlay, poolMat);
  // Heat haze: along the river, around the lake, over the crater
  const haze = hazeMaterial();
  const hz: THREE.BufferGeometry[] = [curtain(seg.filter((_, i) => i % 2 === 0).map(([x, z]) => V(x, SH.LAVA + 0.1, z)), 4.2)];
  for (const [cx, cz, R] of [
    [SH.LAKE[0], SH.LAKE[1], 11],
    [SH.CRATER[0], SH.CRATER[1], 5.5],
  ] as const) {
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) ring.push(V(cx + Math.cos((i / 40) * Math.PI * 2) * R, SH.LAVA + 0.1, cz + Math.sin((i / 40) * Math.PI * 2) * R));
    hz.push(curtain(ring, R > 8 ? 5 : 7));
  }
  for (const g of hz) {
    const m = new THREE.Mesh(g, haze);
    m.renderOrder = 7;
    ctx.group.add(m);
  }
  out.timed.push(haze);
  ctx.disposers.push(() => {
    overlay.dispose();
    poolMat.dispose();
    haze.dispose();
    river.dispose();
    for (const g of [...pools, ...hz]) g.dispose();
  });
  // Spawn points of embers
  seg.forEach(([x, z], i) => i % 3 === 0 && out.embers.push(V(x, SH.LAVA + 0.15, z)));
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const r = 4 + (i % 3) * 3.5;
    out.embers.push(V(SH.LAKE[0] + Math.cos(a) * r, SH.LAVA + 0.15, SH.LAKE[1] + Math.sin(a) * r));
  }
  for (let i = 0; i < 8; i++) out.embers.push(V(SH.CRATER[0] + Math.cos(i) * 4, SH.LAVA + 0.15, SH.CRATER[1] + Math.sin(i) * 4));
  out.crater.set(SH.CRATER[0], SH.LAVA + 0.2, SH.CRATER[1]);
}

// ───────────────────────── Stone bridge ─────────────────────────

function stoneBridge(ctx: FieldCtx, c: SH.Crossing, out: WildOut): void {
  const { b } = ctx;
  const pts = c.pts;
  // Find the bridge section: the stretch where the ground 4.5 m to either side of the road is below or near the lava surface,
  // then extend it outward
  const lat = (i: number, d: number): XZ => {
    const a = pts[Math.max(0, i - 1)];
    const bb = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(bb[0] - a[0], bb[1] - a[1]);
    return [pts[i][0] + Math.cos(ang) * d, pts[i][1] - Math.sin(ang) * d];
  };
  let i0 = -1;
  let i1 = -1;
  for (let i = 0; i < pts.length; i++) {
    const low = [4.6, -4.6].some((d) => {
      const [x, z] = lat(i, d);
      return ctx.h(x, z) < SH.LAVA + 1.2;
    });
    if (low) {
      if (i0 < 0) i0 = i;
      i1 = i;
    }
  }
  if (i0 < 0) return;
  i0 = Math.max(0, i0 - 6);
  i1 = Math.min(pts.length - 1, i1 + 6);
  ctx.b.lift = 0;
  const W = 2.75;
  for (let i = i0; i < i1; i += 2) {
    const p0 = pts[i];
    const p1 = pts[Math.min(i1, i + 2)];
    const mx = (p0[0] + p1[0]) / 2;
    const mz = (p0[1] + p1[1]) / 2;
    const ang = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.08;
    const gy = ctx.h(mx, mz);
    const L = local(mx, mz, ang);
    // Deck slabs (two colors alternating)
    b.add(new THREE.BoxGeometry(W * 2, 0.34, len), (i / 2) % 2 ? COL.stone : COL.stoneL, M(mx, gy - 0.12, mz, ang));
    // Parapets and side walls on both sides (built all the way down to cover the rock ledge)
    for (const s of [-1, 1]) {
      const [px, pz] = L(s * (W + 0.18), 0);
      b.add(new THREE.BoxGeometry(0.45, 0.95, len), COL.stoneD, M(px, gy + 0.47, pz, ang));
      b.add(new THREE.BoxGeometry(0.6, 0.14, len), COL.stone, M(px, gy + 1.0, pz, ang));
      const [wx, wz] = L(s * (W + 0.35), 0);
      const bottom = SH.LAVA - 2;
      const top = gy - 0.1;
      b.add(new THREE.BoxGeometry(0.7, top - bottom, len), COL.stoneD, M(wx, (top + bottom) / 2, wz, ang));
      ctx.solids.add(px, pz, 0.42);
    }
  }
  // Piers (pointed cutwaters) and the lava light showing through under the arches; the posts and braziers at the bridgehead
  const mid = Math.round((i0 + i1) / 2);
  for (const k of [-7, 0, 7]) {
    const i = Math.max(i0 + 2, Math.min(i1 - 2, mid + k * 2));
    const [x, z] = pts[i];
    const a = pts[i - 1];
    const bb = pts[i + 1];
    const ang = Math.atan2(bb[0] - a[0], bb[1] - a[1]);
    const L = local(x, z, ang);
    const gy = ctx.h(x, z);
    for (const s of [-1, 1]) {
      const [px, pz] = L(s * (W + 1.6), 0);
      const top = gy - 0.4;
      const bottom = SH.LAVA - 2;
      b.add(new THREE.BoxGeometry(2.2, top - bottom, 1.8), COL.stoneD, M(px, (top + bottom) / 2, pz, ang));
      const prow = new THREE.CylinderGeometry(1.25, 1.25, top - bottom, 4);
      const [qx, qz] = L(s * (W + 2.7), 0);
      b.add(prow, COL.stone, M(qx, (top + bottom) / 2, qz, ang + Math.PI / 4));
    }
  }
  for (const k of [-3.5, 3.5]) {
    const i = Math.max(i0 + 2, Math.min(i1 - 2, mid + Math.round(k * 2)));
    const [x, z] = pts[i];
    const a = pts[i - 1];
    const bb = pts[i + 1];
    const ang = Math.atan2(bb[0] - a[0], bb[1] - a[1]);
    const L = local(x, z, ang);
    for (const s of [-1, 1]) {
      const [ax, az] = L(s * (W + 0.35 + 0.37), 0);
      const g = new THREE.TorusGeometry(1.5, 0.16, 4, 12, Math.PI);
      b.glow(g, COL.ember, M(ax, SH.LAVA + 0.6, az, ang + Math.PI / 2));
      b.add(new THREE.BoxGeometry(0.1, 1.9, 2.8), 0x160c0e, M(ax + Math.cos(ang) * s * 0.02, SH.LAVA + 1.0, az - Math.sin(ang) * s * 0.02, ang), false);
    }
  }
  for (const i of [i0 + 1, i1 - 1]) {
    const [x, z] = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const bb = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(bb[0] - a[0], bb[1] - a[1]);
    const L = local(x, z, ang);
    const gy = ctx.h(x, z);
    for (const s of [-1, 1]) {
      const [px, pz] = L(s * (W + 0.18), 0);
      b.add(new THREE.BoxGeometry(0.8, 2.2, 0.8), COL.stoneD, M(px, gy + 1.1, pz, ang));
      b.add(new THREE.BoxGeometry(1.0, 0.25, 1.0), COL.stone, M(px, gy + 2.3, pz, ang));
      b.add(new THREE.CylinderGeometry(0.42, 0.26, 0.4, 8), COL.ironL, M(px, gy + 2.6, pz));
      b.glow(new THREE.ConeGeometry(0.3, 0.7, 7), COL.fire, M(px, gy + 3.05, pz));
      out.flames.push(V(px, gy + 3.0, pz));
      ctx.solids.add(px, pz, 0.6);
    }
  }
}

// ───────────────────────── Natural stone arch over the lava tunnel (west route) ─────────────────────────

function lavaTubeArch(ctx: FieldCtx, c: SH.Crossing, out: WildOut): void {
  const { b, r } = ctx;
  const [cx, cz] = c.c;
  const ang = c.ang;
  const L = local(cx, cz, ang);
  const gy = ctx.place(cx, cz);
  b.lift = gy;
  // Natural stone arch spanning the walkway
  const arch = new THREE.TorusGeometry(3.7, 1.25, 5, 9, Math.PI);
  b.add(arch, COL.basalt, M(cx, 0.2, cz, ang + Math.PI / 2, 1, 0, 0));
  for (let k = 0; k < 6; k++) {
    const a = (k / 5) * Math.PI;
    const [px, pz] = L(Math.cos(a) * 3.7, 0);
    b.add(new THREE.DodecahedronGeometry(1.0 + r() * 0.5, 0), k % 2 ? COL.rock : COL.basalt2, M(px, 0.2 + Math.sin(a) * 3.9, pz, r() * 6, 1, r(), r()));
  }
  for (const s of [-1, 1]) {
    const [px, pz] = L(s * 3.8, 0);
    ctx.place(px, pz);
    b.add(new THREE.DodecahedronGeometry(1.7, 0), COL.basalt, M(px, 0.6, pz, r() * 6, 1, 0.3, 0.2));
    ctx.solids.add(px, pz, 1.4);
  }
  // Big rocks on both sides (covering the slope of the rock ledge) and the lava tunnel mouth
  const { pts } = SH.riverSamples();
  let bi = 0;
  let bd = 1e9;
  pts.forEach(([x, z], i) => {
    const d = Math.hypot(x - cx, z - cz);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  for (const dir of [-1, 1]) {
    // Walk up or down the river to find where the lava surface is exposed: the tunnel mouth
    let k = bi;
    while (k > 0 && k < pts.length - 1 && ctx.h(pts[k][0], pts[k][1]) > SH.LAVA - 0.2) k += dir;
    const [mx, mz] = pts[Math.max(0, Math.min(pts.length - 1, k - dir * 2))];
    const flow = Math.atan2(pts[k][0] - pts[k - dir][0], pts[k][1] - pts[k - dir][1]);
    ctx.b.lift = 0;
    const face = dir > 0 ? flow : flow + Math.PI;
    const R = SH.riverHalfWidth(k / pts.length) + 0.6;
    b.add(new THREE.TorusGeometry(R, 1.1, 5, 10, Math.PI), COL.basalt, M(mx, SH.LAVA - 0.3, mz, face));
    const hole = new THREE.CircleGeometry(R - 0.4, 12, 0, Math.PI);
    b.add(hole, 0x120a0c, M(mx - Math.sin(face) * 0.4, SH.LAVA - 0.2, mz - Math.cos(face) * 0.4, face + Math.PI), false);
    const glow = new THREE.CircleGeometry(R - 0.8, 10, 0, Math.PI);
    glow.scale(1, 0.35, 1);
    b.glow(glow, COL.ember, M(mx - Math.sin(face) * 0.5, SH.LAVA - 0.1, mz - Math.cos(face) * 0.5, face + Math.PI));
    out.embers.push(V(mx, SH.LAVA + 0.2, mz));
    // Rocks on top of the tunnel
    for (let j = 0; j < 5; j++) {
      const a = r() * Math.PI;
      const px = mx + Math.cos(face) * Math.cos(a) * R - Math.sin(face) * (1 + r());
      const pz = mz - Math.sin(face) * Math.cos(a) * R - Math.cos(face) * (1 + r());
      ctx.place(px, pz, 1);
      b.add(new THREE.DodecahedronGeometry(1.3 + r() * 1.2, 0), j % 2 ? COL.basalt : COL.rock, M(px, 0.3, pz, r() * 6, 1, r(), r()));
    }
  }
  ctx.b.lift = 0;
}

// ───────────────────────── Barrier walls (crater rim, mesa edge) ─────────────────────────

function barriers(ctx: FieldCtx): void {
  const { b, r } = ctx;
  for (const br of SH.BARRIERS) {
    const samples: XZ[] = [];
    if (br.b) {
      const len = Math.hypot(br.b[0] - br.c[0], br.b[1] - br.c[1]);
      const n = Math.ceil(len / 1.4);
      for (let i = 0; i <= n; i++) samples.push([br.c[0] + ((br.b[0] - br.c[0]) * i) / n, br.c[1] + ((br.b[1] - br.c[1]) * i) / n]);
    } else {
      const from = br.from ?? 0;
      const to = br.to ?? Math.PI * 2;
      const n = Math.ceil(((to - from) * br.r) / 1.4);
      for (let i = 0; i <= n; i++) {
        const a = from + ((to - from) * i) / n;
        samples.push([br.c[0] + Math.cos(a) * br.r, br.c[1] + Math.sin(a) * br.r]);
      }
    }
    samples.forEach(([x, z], i) => {
      ctx.place(x, z, 0.8);
      if (i % 3 === 0) {
        // Ragged basalt spires
        const h = 1.6 + r() * 2.2;
        b.add(new THREE.CylinderGeometry(0.35, 0.6, h, 6), COL.basalt, M(x, h / 2 - 0.2, z, r() * 6, 1, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25));
      } else {
        const s = 0.75 + r() * 0.5;
        b.add(new THREE.DodecahedronGeometry(s, 0), i % 2 ? COL.rock : COL.scoria, M(x, s * 0.45, z, r() * 6, 1, r(), r()));
      }
      ctx.solids.add(x, z, 1.0);
    });
  }
}

// ───────────────────────── Basalt Colonnade ─────────────────────────

function colonnade(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [cx, cz] = SH.COLONNADE;
  const chest = ctx.layout.chests[0];
  const step = 3.3;
  for (let j = -6; j <= 6; j++) {
    for (let i = -6; i <= 6; i++) {
      const x = cx + (i + (j % 2 ? 0.5 : 0)) * step + (r() - 0.5) * 0.6;
      const z = cz + j * step * 0.87 + (r() - 0.5) * 0.6;
      const d = Math.hypot(x - cx, z - cz);
      if (d > 18 + Math.sin(Math.atan2(z - cz, x - cx) * 3) * 3) continue;
      if (ctx.pathDist(x, z) < ctx.layout.pathW + 2.2) continue;
      if (Math.hypot(x - chest[0], z - chest[1]) < 3.4) continue;
      // An open space left in the middle
      if (d < 4.2) continue;
      if (r() < 0.3) continue;
      const rad = 1.05 + r() * 0.35;
      const hgt = 2.5 + (1 - smooth(4, 18, d)) * 8 + r() * 3.5 + Math.max(0, -(x - cx)) * 0.15;
      ctx.place(x, z, rad);
      const ry = r() * 0.3;
      b.add(new THREE.CylinderGeometry(rad, rad * 1.03, hgt + 0.6, 6), r() < 0.5 ? COL.basalt : COL.basalt2, M(x, hgt / 2 - 0.3, z, ry));
      b.add(new THREE.CylinderGeometry(rad * 0.98, rad * 0.98, 0.14, 6), COL.basaltTop, M(x, hgt + 0.02, z, ry), false);
      // Horizontal joints in the column shafts
      if (hgt > 5) b.add(new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, 0.08, 6), COL.rock, M(x, hgt * (0.4 + r() * 0.3), z, ry), false);
      if (r() < 0.18) b.glow(new THREE.BoxGeometry(rad * 1.4, 0.05, 0.08), COL.ember, M(x, 0.06, z, r() * 3));
      ctx.solids.add(x, z, rad + 0.1);
    }
  }
  // Fallen columns
  for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2;
    const d = 8 + r() * 8;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1.5) || ctx.solids.blocked(x, z, 1.4)) continue;
    const len = 4 + r() * 3;
    const ry = r() * 6;
    ctx.place(x, z, len / 2);
    for (let s = 0; s < 3; s++) {
      const off = (s - 1) * (len / 3) * 1.05;
      b.add(new THREE.CylinderGeometry(0.9, 0.9, len / 3, 6), s % 2 ? COL.basalt : COL.basalt2, M(x + Math.sin(ry) * off, 0.75, z + Math.cos(ry) * off, ry, 1, Math.PI / 2 + (r() - 0.5) * 0.1));
    }
    ctx.solids.add(x, z, 1.2);
    ctx.solids.add(x + Math.sin(ry) * len * 0.35, z + Math.cos(ry) * len * 0.35, 1.1);
    ctx.solids.add(x - Math.sin(ry) * len * 0.35, z - Math.cos(ry) * len * 0.35, 1.1);
  }
  out.steam.push(vent(ctx, cx + 1.5, cz - 1.2, 1.2));
  sulfur(ctx, cx - 2, cz + 1.5, 1.1);
}

// ───────────────────────── Abandoned Mine ─────────────────────────

function mine(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [mx, mz] = SH.MINE;
  const face = Math.atan2(-60 - mx, 55 - mz);
  const L = local(mx, mz, face);
  // Push the mine mouth into the cliff until the ground is 2.5 m higher than in front of the mouth
  const g0 = ctx.h(mx, mz);
  let back = 0;
  for (let d = 0; d < 10; d += 0.5) {
    const [x, z] = L(0, -d);
    if (ctx.h(x, z) > g0 + 2.2) {
      back = d;
      break;
    }
  }
  const [px, pz] = L(0, -back + 0.6);
  const y = ctx.place(px, pz, 1.5);
  const P = local(px, pz, face);
  // Timber frame: two posts, a crossbeam, diagonal braces, and a pitch-black shaft inside
  for (const s of [-1, 1]) {
    const [x, z] = P(s * 1.7, 0);
    b.add(new THREE.BoxGeometry(0.42, 3.8, 0.42), COL.wood, M(x, 1.9, z, face));
    const [bx, bz] = P(s * 1.2, 0.1);
    b.add(new THREE.BoxGeometry(0.2, 1.4, 0.2), COL.woodD, M(bx, 3.1, bz, face, 1, 0, s * 0.7));
  }
  const [lx, lz] = P(0, 0);
  b.add(new THREE.BoxGeometry(4.4, 0.5, 0.55), COL.wood, M(lx, 3.95, lz, face));
  const [dx, dz] = P(0, -0.35);
  b.add(new THREE.BoxGeometry(3.0, 3.6, 0.3), 0x0e0a0c, M(dx, 1.8, dz, face), false);
  const [kx, kz] = P(0, -2.0);
  b.add(new THREE.BoxGeometry(5.6, 4.8, 3.0), COL.rock, M(kx, 2.2, kz, face));
  void y;
  // Sign
  const [sx, sz] = P(0, 0.3);
  b.add(new THREE.BoxGeometry(1.8, 0.5, 0.08), COL.woodD, M(sx, 4.5, sz, face, 1, 0, 0.06));
  // Rocks above the mine mouth
  for (let k = 0; k < 5; k++) {
    const [x, z] = P((k - 2) * 1.6, -1.2);
    b.add(new THREE.DodecahedronGeometry(1.2 + r() * 0.6, 0), COL.basalt, M(x, 4.6 + r() * 0.8, z, r() * 6, 1, r(), r()));
  }
  ctx.solids.add(...P(-1.7, 0), 0.5);
  ctx.solids.add(...P(1.7, 0), 0.5);
  ctx.solids.add(...P(0, -1.2), 1.4);
  // Rails: coming out of the shaft, running 16 m outward
  const n = 22;
  for (let i = 0; i < n; i++) {
    const t = i * 0.8 - 0.4;
    const [x, z] = P(Math.sin(t * 0.09) * 1.2, t);
    const gy = ctx.place(x, z);
    void gy;
    b.add(new THREE.BoxGeometry(1.5, 0.1, 0.24), COL.woodD, M(x, 0.05, z, face + Math.cos(t * 0.09) * 0.1));
    for (const s of [-1, 1]) {
      const [rx, rz] = P(Math.sin(t * 0.09) * 1.2 + s * 0.5, t);
      b.add(new THREE.BoxGeometry(0.08, 0.1, 0.84), COL.ironTrim, M(rx, 0.14, rz, face + Math.cos(t * 0.09) * 0.1), false);
    }
  }
  // Mine carts (one on the rails, one overturned)
  for (const [t, tip] of [
    [5.5, 0],
    [13.5, 1],
  ] as const) {
    const [x, z] = P(Math.sin(t * 0.09) * 1.2 + (tip ? 2.4 : 0), t);
    ctx.place(x, z, 1);
    const rz = tip ? 1.2 : 0;
    b.add(new THREE.BoxGeometry(1.3, 0.8, 1.8), COL.ironL, M(x, 0.75 + (tip ? 0.1 : 0), z, face, 1, 0, rz));
    b.add(new THREE.BoxGeometry(1.4, 0.12, 1.9), COL.ironTrim, M(x, 1.15, z, face, 1, 0, rz), false);
    if (!tip) {
      for (let k = 0; k < 5; k++) b.add(new THREE.DodecahedronGeometry(0.25, 0), COL.rock, M(x + (r() - 0.5) * 0.8, 1.25, z + (r() - 0.5) * 1.2, r() * 6));
      b.glow(new THREE.OctahedronGeometry(0.2), COL.ember, M(x + 0.2, 1.4, z));
      b.glow(new THREE.OctahedronGeometry(0.15), COL.fire, M(x - 0.3, 1.35, z + 0.4));
    }
    for (const s of [-1, 1]) for (const f of [-1, 1]) {
      const [wx, wz] = local(x, z, face)(s * 0.7, f * 0.6);
      b.add(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 8), COL.iron, M(wx, 0.3, wz, face, 1, 0, Math.PI / 2 + rz));
    }
    ctx.solids.add(x, z, 1.2);
  }
  // Tool shed, ore piles, lamp posts
  const [hx, hz] = P(-6, 6);
  ctx.place(hx, hz, 2);
  for (const [ox, oz] of [
    [-1.4, -1.1],
    [1.4, -1.1],
    [-1.4, 1.1],
    [1.4, 1.1],
  ]) {
    const [qx, qz] = local(hx, hz, face)(ox, oz);
    b.add(new THREE.BoxGeometry(0.2, 2.4, 0.2), COL.woodD, M(qx, 1.2, qz, face));
  }
  b.add(new THREE.BoxGeometry(3.4, 0.14, 2.8), COL.woodD, M(hx, 2.45, hz, face, 1, 0.2));
  oreCrates(ctx, ...P(-5.6, 5.8), face);
  oreCrates(ctx, ...P(4.2, 9), face + 1);
  ctx.solids.add(hx, hz, 1.8);
  for (const [ox, oz] of [
    [3, 3],
    [-3.2, 12],
  ]) {
    const [qx, qz] = P(ox, oz);
    ctx.place(qx, qz);
    b.add(new THREE.BoxGeometry(0.16, 2.8, 0.16), COL.woodD, M(qx, 1.4, qz, face));
    b.add(new THREE.BoxGeometry(0.7, 0.1, 0.1), COL.woodD, M(qx, 2.75, qz, face));
    const [gx, gz] = local(qx, qz, face)(0.3, 0);
    b.glow(new THREE.SphereGeometry(0.16, 8, 6), 0xffb040, M(gx, 2.45, gz));
    ctx.solids.add(qx, qz, 0.3);
  }
  // Slag heap
  for (let k = 0; k < 6; k++) {
    const [x, z] = P(5 + r() * 6, 1 + r() * 10);
    if (!ctx.clear(x, z, 0.5)) continue;
    ctx.place(x, z, 1);
    b.add(new THREE.ConeGeometry(1.0 + r() * 0.9, 0.8 + r() * 0.6, 7), COL.rock, M(x, 0.3, z, r() * 6));
  }
}

// ───────────────────────── Sword Mound ─────────────────────────

function swordGrave(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [cx, cz] = SH.SWORDS;
  const gy = ctx.place(cx, cz, 2.5);
  const face = Math.atan2(SH.TOWN[0] - cx, SH.TOWN[1] - cz);
  const L = local(cx, cz, face);
  // Base: a shattered round stone platform
  b.add(new THREE.CylinderGeometry(3.4, 3.8, 0.8, 9), COL.stone, M(cx, 0.1, cz, 0.3));
  b.add(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 9), COL.stoneD, M(cx, 0.65, cz, 0.1));
  b.add(new THREE.CylinderGeometry(4.6, 5.0, 0.5, 11), COL.stoneD, M(cx, -0.05, cz, 0.5));
  // Giant sword: stuck slantwise in the platform, glowing runes on the blade
  sword(ctx, cx, gy + 0.4, cz, 7.2, face + 0.4, 0.12, -0.1, COL.stoneL, COL.bronze, COL.rune);
  ctx.solids.add(cx, cz, 3.2);
  // A ring of knights' gravestones: a sword stuck in front of each stone
  for (let k = 0; k < 9; k++) {
    const a = face + Math.PI + ((k - 4) / 9) * Math.PI * 1.5;
    const x = cx + Math.sin(a) * 7.4;
    const z = cz + Math.cos(a) * 7.4;
    if (ctx.pathDist(x, z) < ctx.layout.pathW + 1 || ctx.solids.blocked(x, z, 0.6)) continue;
    const fy = ctx.place(x, z, 0.5);
    const fa = Math.atan2(cx - x, cz - z) + Math.PI;
    b.add(new THREE.BoxGeometry(0.95, 1.5, 0.28), COL.stoneD, M(x, 0.6, z, fa, 1, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12));
    const cap = new THREE.CylinderGeometry(0.475, 0.475, 0.28, 10, 1, false, 0, Math.PI);
    cap.rotateX(Math.PI / 2);
    cap.rotateZ(Math.PI / 2);
    b.add(cap, COL.stoneD, M(x, 1.35, z, fa));
    b.glow(new THREE.BoxGeometry(0.5, 0.06, 0.04), COL.rune, M(x + Math.sin(fa) * 0.15, 1.0, z + Math.cos(fa) * 0.15, fa));
    const sx = x + Math.sin(fa) * 0.75;
    const sz = z + Math.cos(fa) * 0.75;
    sword(ctx, sx, fy - 0.15, sz, 1.25, fa, 0.08, 0, COL.ironTrim, r() < 0.4 ? COL.bronze : COL.iron);
    ctx.solids.add(x, z, 0.6);
  }
  // The inscription and two braziers in front of the platform
  const [px, pz] = L(0, 4.4);
  ctx.place(px, pz);
  b.add(new THREE.BoxGeometry(1.6, 1.2, 0.4), COL.stoneD, M(px, 0.6, pz, face, 1, -0.2));
  b.glow(new THREE.BoxGeometry(1.1, 0.08, 0.05), COL.rune, M(px, 0.78, pz + 0.05, face, 1, -0.2));
  ctx.solids.add(px, pz, 0.8);
  for (const s of [-1, 1]) out.flames.push(brazier(ctx, ...L(s * 3.2, 4.2), 1.1));
  // A ring of swords of knights of past generations
  for (let i = 0; i < 56; i++) {
    const a = r() * Math.PI * 2;
    const d = 9 + Math.sqrt(r()) * 8;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < ctx.layout.pathW + 0.8) continue;
    if (Math.hypot(x - ctx.layout.chests[2][0], z - ctx.layout.chests[2][1]) < 1.8) continue;
    const y = ctx.h(x, z);
    const broken = r() < 0.2;
    sword(ctx, x, y - (broken ? 0.5 : 0.12), z, 1.2 + r() * 0.45, r() * 6, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6, r() < 0.5 ? COL.ironTrim : COL.stoneL, r() < 0.3 ? COL.bronze : COL.iron);
    if (r() < 0.22) {
      ctx.b.lift = 0;
      shield(ctx, x + 0.5, y + 0.35, z + 0.3, 0.9, r() * 6, 1.2 + r() * 0.3, r() < 0.5 ? COL.cloth : COL.ironL, COL.bronze);
    }
  }
  // Tattered banner
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.6;
    const x = cx + Math.cos(a) * 9.5;
    const z = cz + Math.sin(a) * 9.5;
    if (ctx.pathDist(x, z) < ctx.layout.pathW + 1) continue;
    ctx.place(x, z);
    b.add(new THREE.CylinderGeometry(0.07, 0.09, 6, 5), COL.woodD, M(x, 3, z, 0, 1, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15));
    b.add(new THREE.BoxGeometry(1.4, 0.08, 0.08), COL.woodD, M(x, 5.7, z, a));
    out.flags.push(banner(1.2, 2.6, M(x, ctx.h(x, z) + 5.7, z, a), 0x7a2020, 0x3a1a18));
    ctx.solids.add(x, z, 0.3);
  }
}

// ───────────────────────── Sulfur Hot Spring Terraces ─────────────────────────

/**
 * Rows of small travertine dams (rimstone) on the terrace slope: low arcs bowing out downhill,
 * lined up along the contours step by step; some dams have a small pool of hot spring water standing behind them. This way the
 * slope between the big pools is not one flat wash of color.
 */
function rimstones(ctx: FieldCtx, pools: [number, number, number][], water: THREE.BufferGeometry[]): void {
  const { b, r, low } = ctx;
  const [sx, sz] = SH.SPRINGS;
  const [dx, dz] = SH.SPRING_DOWN;
  const lx = -dz;
  const lz = dx;
  // The direction the arc (T.arc) bows out = downhill: (cos dir, -sin dir) = (dx, dz)
  const dir = Math.atan2(-dz, dx);
  const cols = [0xcdbc98, 0xb88a58, 0xd6c8a8, 0xa87448];
  const pw = ctx.layout.pathW;
  let row = 0;
  for (let u = -19; u <= 19; u += low ? 1.9 : 1.35) {
    row++;
    for (let v = -19 + (row % 2) * 0.8; v <= 19; v += (low ? 2.4 : 1.6) + r() * 0.8) {
      const x = sx + dx * u + lx * v + (r() - 0.5) * 0.5;
      const z = sz + dz * u + lz * v + (r() - 0.5) * 0.5;
      if (SH.terraceMask(x, z) < 0.3) continue;
      if (pools.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr + 2.4)) continue;
      if (ctx.pathDist(x, z) < pw + 0.8 || ctx.solids.blocked(x, z, 0.4) || !ctx.clear(x, z, -1)) continue;
      const R = 0.6 + r() * 0.65;
      const cx = x - dx * R;
      const cz = z - dz * R;
      b.lift = ctx.h(x, z);
      put(b, T.arc, cols[(row + Math.floor(r() * 2)) % 4], MX(cx, 0.02, cz, R, R * 1.1, R, dir - Math.PI * 0.35 + (r() - 0.5) * 0.3), false);
      if (r() < 0.3) {
        const w = new THREE.CircleGeometry(R * 0.62, 9);
        w.rotateX(-Math.PI / 2);
        w.translate(x - dx * R * 0.55, ctx.h(x - dx * R * 0.55, z - dz * R * 0.55) + 0.07, z - dz * R * 0.55);
        water.push(w);
      }
    }
  }
}


function springs(ctx: FieldCtx, out: WildOut, stains: Stains): void {
  const { b, r } = ctx;
  const [sx, sz] = SH.SPRINGS;
  const [dx, dz] = SH.SPRING_DOWN;
  const lx = -dz;
  const lz = dx;
  // Travertine pools stacked downhill one after another: the pool surface is level,
  // and the downhill side shows a milky-white pool wall and hanging stalactites
  const rows: [number, number[]][] = [
    [-11, [-2.5, 4]],
    [-6, [-7, -0.5, 6]],
    [-1, [-4, 2.5, 8.5]],
    [4, [-7.5, -1, 5.5]],
    [9, [-3, 3.5]],
  ];
  const water: THREE.BufferGeometry[] = [];
  // Travertine colors: the pool rim is milky-white fresh deposit; going downhill it is stained by iron and thermophilic
  // bacteria into ocher yellow, rust orange and dark brown (an all-white expanse would blow out under firelight)
  const bands: [number, number, number][] = [
    [0, 0.2, 0xd2c2a0],
    [0.2, 0.46, 0xbc8e5c],
    [0.46, 1, 0x8e5a38],
  ];
  const lip = 0xdccdb0;
  const drips = [0xd2c2a0, 0xc08a58, 0xa8683a];
  const pools: [number, number, number][] = [];
  let top: THREE.Vector3 | null = null;
  for (const [s, lats] of rows) {
    for (const l of lats) {
      const x = sx + dx * s + lx * l + (r() - 0.5) * 1.2;
      const z = sz + dz * s + lz * l + (r() - 0.5) * 1.2;
      const R = 2.1 + r() * 1.3;
      if (ctx.pathDist(x, z) < ctx.layout.pathW + R + 0.4 || ctx.solids.blocked(x, z, R) || !ctx.clear(x, z, R * 0.5)) continue;
      let hi = -1e9;
      let lo = 1e9;
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rr = k === 12 ? 0 : R;
        const h = ctx.h(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
        hi = Math.max(hi, h);
        lo = Math.min(lo, h);
      }
      const level = hi + 0.12;
      const H = level - lo + 0.5;
      const flare = Math.min(2.2, H * 0.7);
      const seed = r() * 6;
      // The pool wall flares outward and downward into a ring of travertine slope (built up like a heap, not a bucket),
      // split into three color bands from top to bottom
      b.lift = 0;
      for (const [t0, t1, col] of bands) {
        const hh = (t1 - t0) * H;
        const g = new THREE.CylinderGeometry(R + flare * t0, R + flare * t1, hh, 18, 1, true);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const a = Math.atan2(p.getZ(i), p.getX(i));
          const k = 1 + 0.035 * Math.sin(a * 5 + seed) + 0.02 * Math.sin(a * 9 + seed * 2);
          p.setX(i, p.getX(i) * k);
          p.setZ(i, p.getZ(i) * k);
        }
        g.computeVertexNormals();
        b.add(g, col, M(x, level - (t0 + t1) * 0.5 * H, z));
      }
      const t = new THREE.TorusGeometry(R * 1.01, 0.2, 5, 20);
      t.rotateX(Math.PI / 2);
      t.scale(1, 0.6, 1);
      b.add(t, lip, M(x, level, z), false);
      // Travertine stalactites hanging from the downhill face (milky white, ocher yellow and rust color alternating,
      // of different lengths)
      const drop = level - ctx.h(x + dx * R, z + dz * R);
      for (let k = 0; k < 8; k++) {
        const a = Math.atan2(dz, dx) + (k - 3.5) * 0.24 + (r() - 0.5) * 0.12;
        const len = Math.min(drop - 0.2, 0.35 + r() * 1.4);
        if (len < 0.25) continue;
        // Hanging down against the flared pool wall
        const fl = R + flare * (len / H) * 0.5 + 0.12;
        const px = x + Math.cos(a) * fl;
        const pz = z + Math.sin(a) * fl;
        b.add(new THREE.ConeGeometry(0.16 + r() * 0.14, len, 5), drips[k % 3], M(px, level - 0.1 - len / 2, pz, r() * 6, 1, Math.PI), false);
      }
      const w = new THREE.CircleGeometry(R * 0.93, 20);
      w.rotateX(-Math.PI / 2);
      w.translate(x, level - 0.05, z);
      water.push(w);
      ctx.solids.add(x, z, R * 0.95);
      pools.push([x, z, R]);
      // Thermophile mat at the foot of the pool: rust orange outer ring, olive green inner ring (written into the terrain's
      // vertex colors)
      stains.add(x + dx * R * 0.6, z + dz * R * 0.6, R + flare + 2.4, 0xa0582c, 0.5);
      stains.add(x + dx * R * 0.4, z + dz * R * 0.4, R + flare + 0.8, 0x6e7438, 0.4);
      if (r() < 0.55) out.springSteam.push(V(x + (r() - 0.5) * R, level + 0.2, z + (r() - 0.5) * R));
      if (!top || s < -8) top = V(x, level, z);
    }
  }
  rimstones(ctx, pools, water);
  if (water.length) {
    const g = mergeGeometries(water);
    for (const w of water) w.dispose();
    const mat = springMaterial();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 2;
    ctx.group.add(m);
    out.timed.push(mat);
    ctx.disposers.push(() => {
      g.dispose();
      mat.dispose();
    });
  }
  // Source: the bubbling fumarole beside the topmost pool
  if (top) {
    const vx = top.x - dx * 4.5 + lx * 1.5;
    const vz = top.z - dz * 4.5 + lz * 1.5;
    if (ctx.clear(vx, vz, 1) && !ctx.solids.blocked(vx, vz, 1.2)) out.steam.push(vent(ctx, vx, vz, 1.2));
  }
  // Sulfur crystals, rubble and flame maples at the pool edge
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = 4 + r() * 17;
    const x = sx + Math.cos(a) * d;
    const z = sz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0.6) || ctx.solids.blocked(x, z, 0.8)) continue;
    if (i % 3 === 0) sulfur(ctx, x, z, 0.7 + r() * 0.5);
    else pebbles(ctx, x, z, 4, 1.4, COL.sulfurRock);
  }
  for (const [ox, oz] of [
    [-12, 6],
    [11, -8],
  ]) {
    const x = sx + ox;
    const z = sz + oz;
    if (ctx.clear(x, z, 1) && !ctx.solids.blocked(x, z, 1.2)) out.steam.push(vent(ctx, x, z, 1.1));
  }
  for (const [ox, oz, s] of [
    [-15, -6, 1.1],
    [15, -12, 1.2],
    [-17, 7, 1.0],
  ]) {
    const x = sx + ox;
    const z = sz + oz;
    if (ctx.clear(x, z, 1) && !ctx.solids.blocked(x, z, 1.5)) emberMaple(ctx, x, z, s);
  }
  // The small shrine at the top of the pool: a stone platform, an eternal flame
  const [tx, tz] = [sx - dx * 15 - lx * 6, sz - dz * 15 - lz * 6];
  if (ctx.clear(tx, tz, 1) && !ctx.solids.blocked(tx, tz, 1.6)) {
    ctx.place(tx, tz, 1.5);
    b.add(new THREE.BoxGeometry(2.6, 0.5, 2.6), COL.travertine, M(tx, 0.25, tz, 0.4));
    b.add(new THREE.BoxGeometry(1.1, 1.6, 1.1), COL.stone, M(tx, 1.3, tz, 0.4));
    b.add(new THREE.ConeGeometry(1.1, 0.9, 4), COL.roof, M(tx, 2.55, tz, 0.4 + Math.PI / 4));
    b.glow(new THREE.BoxGeometry(0.5, 0.6, 1.14), COL.fire, M(tx, 1.4, tz, 0.4));
    ctx.solids.add(tx, tz, 1.5);
  }
}

// ───────────────────────── Magma Crater and the Order forge ─────────────────────────

function craterForge(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [cx, cz] = SH.CRATER;
  // Heat glow rising from the pit: a gradient-shaded section of light column
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        float k = pow(max(1.0 - vUv.y, 0.0), 2.2);
        float flick = 0.8 + 0.2 * sin(uTime * 3.0 + vUv.x * 18.0) * sin(uTime * 1.7 + vUv.x * 7.0);
        gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * 1.4, k * 0.45 * flick);
      }`,
  });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 7.0, 22, 24, 1, true), glowMat);
  col.position.set(cx, SH.LAVA + 11, cz);
  col.renderOrder = 6;
  ctx.group.add(col);
  out.timed.push(glowMat);
  ctx.disposers.push(() => {
    glowMat.dispose();
    col.geometry.dispose();
  });
  // Gantry reaching over the crater: a crucible hung on iron chains
  const craneA = Math.atan2(SH.TOWER[1] - cz, SH.TOWER[0] - cx);
  const base: XZ = [cx + Math.cos(craneA) * 13.6, cz + Math.sin(craneA) * 13.6];
  const gy = ctx.place(base[0], base[1], 1.5);
  const face = Math.atan2(cx - base[0], cz - base[1]);
  const L = local(base[0], base[1], face);
  for (const s of [-1, 1]) {
    const [lx, lz] = L(s * 1.6, -0.8);
    b.add(new THREE.BoxGeometry(0.35, 9, 0.35), COL.iron, M(lx, 4.4, lz, face, 1, 0.12, s * 0.12));
  }
  const tipY = 8.8;
  const [bx, bz] = L(0, 4.4);
  b.add(new THREE.BoxGeometry(0.45, 0.45, 11), COL.ironL, M(bx, tipY, bz, face));
  const [tx, tz] = L(0, 9.4);
  const cy = SH.PLATEAU - gy - 7;
  for (let k = 0; k < 14; k++) {
    const yy = tipY - (k + 0.5) * ((tipY - cy - 1.4) / 14);
    b.add(new THREE.TorusGeometry(0.13, 0.04, 4, 6), COL.iron, M(tx, yy, tz, k * 1.57), false);
  }
  const purified = ctx.done >= ctx.floors;
  b.add(new THREE.CylinderGeometry(1.1, 0.8, 1.4, 10), COL.iron, M(tx, cy, tz));
  if (!purified) {
    b.glow(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 10), COL.purple, M(tx, cy + 0.72, tz));
    out.purple.push(V(tx, gy + cy + 0.8, tz));
  }
  // The Order forge: black stone hearth, purple fire, a black sword on the anvil, purple banners
  const [fx, fz] = [-11, -81];
  const fy = ctx.place(fx, fz, 2);
  const ff = Math.atan2(SH.TOWER[0] - fx, SH.TOWER[1] - fz);
  const F = local(fx, fz, ff);
  b.add(new THREE.BoxGeometry(3.4, 1.4, 2.2), COL.obsidian, M(fx, 0.7, fz, ff));
  b.add(new THREE.BoxGeometry(3.6, 0.2, 2.4), COL.obsidianL, M(fx, 1.45, fz, ff));
  const [chx, chz] = F(0, -1.2);
  b.add(new THREE.BoxGeometry(1.2, 4.6, 1.2), COL.obsidian, M(chx, 2.3, chz, ff));
  ctx.solids.add(fx, fz, 2.2);
  const [ax, az] = F(3.2, 1.4);
  ctx.place(ax, az, 0.5);
  b.add(new THREE.CylinderGeometry(0.35, 0.45, 0.55, 8), COL.obsidian, M(ax, 0.27, az));
  b.add(new THREE.BoxGeometry(1.0, 0.24, 0.44), COL.iron, M(ax, 0.66, az, ff));
  ctx.solids.add(ax, az, 0.6);
  const poles: [number, number][] = [
    [-3.4, -1.5],
    [3.8, -1.8],
    [-1.5, 3.4],
  ];
  if (!purified) {
    // The Order is still here: purple fire, black smoke, a half-forged black sword on the anvil, three purple banners
    b.glow(new THREE.BoxGeometry(2.6, 0.12, 1.4), COL.purple, M(fx, 1.56, fz, ff));
    out.purple.push(V(fx, fy + 1.8, fz));
    out.smoke.push(V(chx, fy + 4.7, chz));
    sword(ctx, ax, ctx.h(ax, az) + 0.95, az, 0.9, ff + Math.PI / 2, Math.PI / 2, 0, 0x2a1a3a, COL.cult, COL.purple);
    for (const [ox, oz] of poles) {
      const [px, pz] = F(ox, oz);
      ctx.place(px, pz);
      b.add(new THREE.CylinderGeometry(0.08, 0.1, 6.2, 5), COL.iron, M(px, 3.1, pz));
      b.add(new THREE.ConeGeometry(0.18, 0.5, 4), COL.gold, M(px, 6.4, pz));
      b.add(new THREE.BoxGeometry(1.3, 0.08, 0.08), COL.iron, M(px, 5.9, pz, ff));
      out.flags.push(banner(1.2, 3.0, M(px, ctx.h(px, pz) + 5.9, pz, ff), COL.cult, COL.gold));
      ctx.solids.add(px, pz, 0.3);
    }
    oreCrates(ctx, ...F(-3.8, 2.2), ff, COL.purple);
    groundGlow(ctx, fx, fz, 6.5, COL.purple, 0.35);
  } else {
    // After purification: the Order has fled, the forge fire is out, the purple banners are torn down and thrown on the ground,
    // and the Knights have planted their own banner here
    for (const [ox, oz] of poles) {
      const [px, pz] = F(ox, oz);
      const a = ctx.r() * Math.PI * 2;
      ctx.place(px, pz, 1);
      b.add(new THREE.CylinderGeometry(0.08, 0.1, 6.2, 5), COL.iron, M(px + Math.cos(a) * 3, 0.12, pz + Math.sin(a) * 3, -a, 1, 0, Math.PI / 2));
      b.add(new THREE.BoxGeometry(1.1, 0.04, 2.2), COL.cult, M(px + Math.cos(a) * 1.4, 0.05, pz + Math.sin(a) * 1.4, -a + 0.3), false);
    }
    const [kx, kz] = F(-1, 4.6);
    ctx.place(kx, kz, 0.4);
    b.add(new THREE.CylinderGeometry(0.08, 0.1, 6.6, 5), COL.woodD, M(kx, 3.3, kz));
    b.add(new THREE.BoxGeometry(1.4, 0.08, 0.08), COL.iron, M(kx, 6.3, kz, ff));
    out.flags.push(banner(1.3, 3.2, M(kx, ctx.h(kx, kz) + 6.3, kz, ff), COL.cloth, COL.gold));
    ctx.solids.add(kx, kz, 0.3);
    oreCrates(ctx, ...F(-3.8, 2.2), ff, COL.ember);
  }
  // Obsidian around the crater
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 13 + r() * 7;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1.2)) continue;
    obsidian(ctx, x, z, 0.8 + r() * 0.6);
  }
  out.steam.push(vent(ctx, cx + 15, cz + 9, 1));
}

// ───────────────────────── Tower Approach ─────────────────────────

function towerApproach(ctx: FieldCtx, out: WildOut): void {
  const { b } = ctx;
  const [tx, tz] = SH.TOWER;
  const road = SH.PATH;
  // Along the last stretch of the main road, a pair of brazier posts every 7 m
  const curve = new THREE.CatmullRomCurve3(road.slice(-5).map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const len = curve.getLength();
  for (let s = 0; s < len; s += 7) {
    const p = curve.getPointAt(s / len);
    const d = Math.hypot(p.x - tx, p.z - tz);
    if (d < 23 || d > 44) continue;
    const tan = curve.getTangentAt(s / len);
    for (const k of [-1, 1]) {
      const x = p.x + tan.z * k * 4.2;
      const z = p.z - tan.x * k * 4.2;
      ctx.place(x, z, 0.6);
      b.add(new THREE.CylinderGeometry(0.55, 0.7, 2.6, 6), COL.basalt2, M(x, 1.3, z));
      b.add(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 6), COL.basaltTop, M(x, 2.65, z));
      b.add(new THREE.CylinderGeometry(0.55, 0.3, 0.45, 8), COL.ironL, M(x, 2.95, z));
      b.glow(new THREE.ConeGeometry(0.38, 0.9, 7), COL.fire, M(x, 3.55, z));
      out.flames.push(V(x, ctx.h(x, z) + 3.5, z));
      ctx.solids.add(x, z, 0.8);
    }
  }
}

// ───────────────────────── Phoenix Nest and lavafall ─────────────────────────

function phoenixNest(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [mx, mz] = SH.MESA;
  const ny = ctx.place(mx, mz, 3);
  // Nest: a ring of charred wood leaning inward, with glowing embers and golden feather crystals in the middle
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.2;
    const len = 3 + r() * 1.2;
    const x = mx + Math.cos(a) * 2.6;
    const z = mz + Math.sin(a) * 2.6;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(-Math.cos(a) * 0.55, 0.45, -Math.sin(a) * 0.55).normalize());
    b.add(new THREE.CylinderGeometry(0.14, 0.2, len, 5), COL.char, new THREE.Matrix4().compose(V(x, 0.6, z), q, V(1, 1, 1)));
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const g = new THREE.OctahedronGeometry(0.3);
    g.scale(0.35, 2.4, 0.9);
    b.glow(g, 0xffc860, M(mx + Math.cos(a) * 1.3, 0.8, mz + Math.sin(a) * 1.3, -a, 1, Math.cos(a) * 0.5, Math.sin(a) * 0.5));
  }
  b.glow(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 14), COL.ember, M(mx, 0.12, mz));
  ctx.solids.add(mx, mz, 3.0);
  groundGlow(ctx, mx, mz, 7, 0xffa040, 0.45);
  out.nest.set(mx, ny + 0.8, mz);
  // Fire spring on the mesa: a small pool of lava that spills over the south edge and runs down the cliff face into the lava bay
  const vx = mx + 0.6;
  const vz = mz + 7.2;
  const vy = ctx.place(vx, vz, 1.5);
  const pool = new THREE.CircleGeometry(1.8, 16);
  pool.rotateX(-Math.PI / 2);
  const pp = pool.attributes.position;
  const e = new Float32Array(pp.count);
  for (let i = 0; i < pp.count; i++) e[i] = Math.hypot(pp.getX(i), pp.getZ(i)) / 1.8;
  pool.setAttribute('aEdge', new THREE.BufferAttribute(e, 1));
  pool.translate(vx, vy + 0.12, vz);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    b.add(new THREE.DodecahedronGeometry(0.5 + r() * 0.3, 0), COL.rock, M(vx + Math.cos(a) * 2.1, 0.2, vz + Math.sin(a) * 2.1, r() * 6, 1, r(), r()));
  }
  ctx.solids.add(vx, vz, 2.3);
  // Lavafall: flows from the pool southward down the cliff face (sampled a little above the cliff face,
  // so the fall stands off the cliff)
  const fall: THREE.Vector3[] = [];
  for (let z = vz + 1.2; z < SH.FALL_BAY[1][1] + 6.5 + 2; z += 0.4) {
    const x = vx + Math.sin(z * 0.8) * 0.15;
    const hh = Math.max(ctx.h(x, z), ctx.h(x, z - 0.9) - 0.4);
    fall.push(V(x, Math.max(hh + 0.3, SH.LAVA + 0.06), z));
  }
  const fallGeo = ribbon(fall, (t) => 1.1 + t * 1.3, (_x, _z, t) => fall[Math.round(t * (fall.length - 1))].y);
  const fallMat = lavaMaterial({ speed: 1.4, stretch: 3.5, fogK: 0.3, gain: 1.15 });
  const poolMat = lavaMaterial({ speed: 0.1, fogK: 0.3 });
  ctx.group.add(new THREE.Mesh(fallGeo, fallMat), new THREE.Mesh(pool, poolMat));
  out.timed.push(fallMat, poolMat);
  ctx.disposers.push(() => {
    fallGeo.dispose();
    pool.dispose();
    fallMat.dispose();
    poolMat.dispose();
  });
  out.splash.push(fall[fall.length - 1].clone());
  out.embers.push(V(vx, vy + 0.3, vz));
}

// ───────────────────────── Dragon Skeleton ─────────────────────────

function dragonBones(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const cx = 45;
  const cz = -55;
  const face = Math.atan2(SH.LAKE[0] - cx, SH.LAKE[1] - cz);
  const L = local(cx, cz, face);
  // Spine: a string of vertebrae arching forward
  const spine: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const [x, z] = L(Math.sin(t * 2.6) * 1.6, -8 + t * 17);
    const y = ctx.h(x, z) + Math.sin(t * Math.PI) * 1.6 - 0.2;
    spine.push(V(x, y, z));
    ctx.b.lift = 0;
    b.add(new THREE.DodecahedronGeometry(0.42 - Math.abs(t - 0.45) * 0.3, 0), COL.bone, M(x, y, z, r() * 6));
  }
  // Ribs: curving out of the ground on both sides of the spine
  for (let i = 3; i < 11; i++) {
    const p = spine[i];
    const R = 2.6 + Math.sin(((i - 3) / 8) * Math.PI) * 1.4;
    for (const s of [-1, 1]) rib(ctx, p.x, p.y - 0.4, p.z, R, face + (s > 0 ? Math.PI / 2 : -Math.PI / 2), 0.16);
  }
  // Skull: half-buried in the ground, facing the lava lake
  const head = spine[15];
  const [hx, hz] = L(Math.sin(2.6) * 1.6, 10.8);
  const hy = ctx.h(hx, hz);
  b.add(new THREE.BoxGeometry(1.8, 1.3, 3.2), COL.bone, M(hx, hy + 0.4, hz, face, 1, 0.15));
  b.add(new THREE.BoxGeometry(1.4, 0.6, 2.2), COL.bone, M(hx + Math.sin(face) * 1.8, hy + 0.1, hz + Math.cos(face) * 1.8, face, 1, 0.1));
  for (const s of [-1, 1]) {
    const [ex, ez] = local(hx, hz, face)(s * 0.55, 0.6);
    b.add(new THREE.SphereGeometry(0.28, 8, 6), 0x140a0c, M(ex, hy + 0.75, ez), false);
    const [kx, kz] = local(hx, hz, face)(s * 0.7, -1.4);
    b.add(new THREE.ConeGeometry(0.22, 1.8, 6), COL.bone, M(kx, hy + 1.3, kz, face, 1, -0.9, s * 0.3));
  }
  void head;
  for (const p of [spine[4], spine[9]]) ctx.solids.add(p.x, p.z, 1.2);
  ctx.solids.add(hx, hz, 1.6);
  // Wing bones: two long bones stuck slantwise into the earth
  for (const s of [-1, 1]) {
    const p = spine[6];
    const [wx, wz] = local(p.x, p.z, face)(s * 4.6, 0.5);
    ctx.place(wx, wz);
    b.add(new THREE.CylinderGeometry(0.12, 0.2, 7, 6), COL.bone, M(wx, 2.4, wz, face, 1, 0.2, s * 0.75));
    ctx.solids.add(wx, wz, 0.5);
  }
}

// ───────────────────────── Cinder cones, Basalt Gate, Cold Lava Plain ─────────────────────────

function cones(ctx: FieldCtx, out: WildOut): void {
  const { r } = ctx;
  for (const [cx, cz, , cr] of SH.CONES) {
    out.steam.push(vent(ctx, cx, cz, 1.3));
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2;
      const d = cr * (0.5 + r() * 0.6);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1)) continue;
      scoria(ctx, x, z, 0.8 + r() * 0.9, r() < 0.3);
    }
  }
}

function basaltGate(ctx: FieldCtx): void {
  const { r } = ctx;
  for (const [cx, cz] of [SH.CRAG_W, SH.CRAG_E]) {
    basalt(ctx, cx, cz, 1.8, 7, true);
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      const x = cx + Math.cos(a) * (3 + r() * 2.5);
      const z = cz + Math.sin(a) * (3 + r() * 2.5);
      if (ctx.pathDist(x, z) < ctx.layout.pathW + 2) continue;
      basalt(ctx, x, z, 1.1 + r() * 0.5, 3 + r() * 3, true);
    }
  }
}

function fieldFeatures(ctx: FieldCtx, out: WildOut): void {
  for (const [x, z, R] of [
    [-13, 33, 1.6],
    [0, 45, 1.3],
    [-24, 40, 1.8],
    [9, 33, 1.2],
    [-3, 26, 1.1],
  ] as const) {
    if (!ctx.clear(x, z, R + 1) || ctx.solids.blocked(x, z, R + 1)) continue;
    out.skylights.push(skylight(ctx, x, z, R));
  }
  for (const [x, z] of [
    [-18, 26],
    [12, 50],
    [-36, 30],
    [26, -22],
    [48, -34],
    [-8, -58],
    [-40, -58],
    [62, 14],
  ] as const) {
    if (ctx.clear(x, z, 1.2) && !ctx.solids.blocked(x, z, 1.5)) out.steam.push(vent(ctx, x, z, 0.9 + ctx.r() * 0.4));
  }
}

// ───────────────────────── Geyser Flats ─────────────────────────

/**
 * A few sinter mounds on the gray-white silica sinter plateau, each spouting a water column at its own rhythm
 * (bubbling first before an eruption)
 */
function geysers(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [gx, gz] = SH.GEYSER;
  const sinter = 0xb8b2a8;
  const sinterD = 0x8e877e;
  const mat = geyserMaterial();
  const water: THREE.BufferGeometry[] = [];
  const cols: { m: THREE.Mesh; p: THREE.Vector3; s: number; period: number; off: number; on: boolean }[] = [];
  const colGeo = new THREE.CylinderGeometry(0.28, 0.5, 1, 10, 4, true);
  colGeo.translate(0, 0.5, 0);
  for (const [dx, dz, s, period] of SH.GEYSER_VENTS) {
    const x = gx + dx;
    const z = gz + dz;
    if (ctx.solids.blocked(x, z, 1.5 * s) || ctx.pathDist(x, z) < ctx.layout.pathW + 1.5 * s) continue;
    let lo = 1e9;
    let hi = -1e9;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const h = ctx.h(x + Math.cos(a) * 2.6 * s, z + Math.sin(a) * 2.6 * s);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    b.lift = 0;
    // Sinter mound: silica sinter built up ring by ring, a black opening on top
    b.add(new THREE.CylinderGeometry(1.5 * s, 2.3 * s, 0.5 * s + (hi - lo), 12), sinterD, M(x, lo + (0.5 * s + hi - lo) / 2 - 0.2, z, r() * 6));
    b.add(new THREE.CylinderGeometry(0.55 * s, 1.45 * s, 0.9 * s, 12), sinter, M(x, hi + 0.25 * s + 0.45 * s - 0.1, z, r() * 6));
    const top = hi + 1.05 * s;
    b.add(new THREE.CircleGeometry(0.42 * s, 10).rotateX(-Math.PI / 2), 0x1a1416, M(x, top - 0.02, z), false);
    // The shallow pool at the foot of the mound
    const w = new THREE.RingGeometry(2.3 * s, 3.2 * s, 20);
    w.rotateX(-Math.PI / 2);
    w.translate(x, hi + 0.04, z);
    water.push(w);
    ctx.solids.add(x, z, 1.9 * s);
    const m = new THREE.Mesh(colGeo, mat);
    m.position.set(x, top - 0.1, z);
    m.scale.set(s, 0.01, s);
    m.visible = false;
    m.renderOrder = 3;
    ctx.group.add(m);
    cols.push({ m, p: new THREE.Vector3(x, top, z), s, period, off: r() * period, on: false });
  }
  if (water.length) {
    const g = mergeGeometries(water);
    for (const w of water) w.dispose();
    const wm = springMaterial();
    const mesh = new THREE.Mesh(g, wm);
    mesh.renderOrder = 2;
    ctx.group.add(mesh);
    out.timed.push(wm);
    ctx.disposers.push(() => {
      g.dispose();
      wm.dispose();
    });
  }
  // Broken sinter and small fumaroles at the plateau edge
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = 5 + r() * 10;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 0.6) || ctx.solids.blocked(x, z, 0.8)) continue;
    pebbles(ctx, x, z, 5, 1.6, i % 2 ? sinter : sinterD);
  }
  out.timed.push(mat);
  ctx.disposers.push(() => {
    colGeo.dispose();
    mat.dispose();
  });
  const up = V(0, 1, 0);
  const q = V(0, 0, 0);
  ctx.extras.push((_dt, t, vfx) => {
    const cam = vfx.camPos;
    for (const c of cols) {
      const ph = (t + c.off) % c.period;
      const dur = 1.2 + c.s * 1.4;
      const near = Math.abs(c.p.x - cam.x) < 110 && Math.abs(c.p.z - cam.z) < 110;
      if (ph < dur) {
        // Eruption: shoots up hard first, then slowly shrinks back for the last stretch
        const k = Math.min(1, ph / 0.35) * (1 - smooth(dur - 0.7, dur, ph));
        const H = (5 + c.s * 5) * k * (0.92 + 0.08 * Math.sin(t * 23 + c.off));
        c.m.visible = H > 0.1;
        c.m.scale.set(c.s * (0.9 + 0.1 * Math.sin(t * 31)), Math.max(0.01, H), c.s * (0.9 + 0.1 * Math.cos(t * 27)));
        if (near && !c.on) {
          vfx.smoke({ pos: c.p, count: 6, color: [0xf4f4f0, 0xe4ecec], speed: [3, 7], dir: up, spread: 0.3, life: [2.5, 4], size: [1.4, 2.4], sizeEnd: 2.6, gravity: -0.3, drag: 0.6, radius: 0.5 });
        }
        c.on = true;
        if (near && Math.random() < 0.5) {
          q.copy(c.p).setY(c.p.y + H * 0.85);
          vfx.emit({ pos: q, count: 2, color: [0xffffff, 0xd8f0f4], speed: [2, 4], dir: up, spread: 1.2, life: [0.8, 1.4], size: [0.12, 0.22], gravity: 9, radius: 0.4, intensity: 1.2 });
          if (Math.random() < 0.3) vfx.smoke({ pos: q, count: 1, color: [0xf0f0ec, 0xe0e8e8], speed: [1, 2], dir: up, spread: 0.5, life: [2, 3], size: [1.2, 2], sizeEnd: 2.4, gravity: -0.2, drag: 0.5, radius: 0.6 });
        }
      } else {
        c.m.visible = false;
        c.on = false;
        // Before an eruption: the opening bubbles and gives off a little steam
        if (near && ph > c.period - 1.6 && Math.random() < 0.15) {
          vfx.smoke({ pos: c.p, count: 1, color: [0xeeeeea, 0xdde6e6], speed: [0.6, 1.2], dir: up, spread: 0.3, life: [1.5, 2.5], size: [0.5, 0.9], sizeEnd: 2.2, gravity: -0.1, drag: 0.5, radius: 0.2 });
        }
      }
    }
  });
}

// ───────────────────────── Props all over the ground ─────────────────────────

/** Returns the number of rubble piles (the ground layer decides the positions) */
function scatter(ctx: FieldCtx): number {
  const { r, low, b } = ctx;
  const S = ctx.layout.size;
  const k = low ? 0.5 : 1;
  const edgeK = (x: number, z: number) => smooth(S - 34, S - 12, Math.max(Math.abs(x), Math.abs(z)));
  const nearTown = (x: number, z: number) => Math.hypot(x - SH.TOWN[0], z - SH.TOWN[1]) < SH.TOWN_R + 6;
  // The near view straight ahead of the camera counts too (no basalt columns, boulders or dead trees)
  const special = (x: number, z: number) =>
    lensZone(ctx, x, z, 1.5) ||
    SH.terraceMask(x, z) > 0.2 || Math.hypot(x - SH.COLONNADE[0], z - SH.COLONNADE[1]) < 20 || Math.hypot(x - SH.MESA[0], z - SH.MESA[1]) < 13 || Math.hypot(x - SH.SWORDS[0], z - SH.SWORDS[1]) < 15 || nearTown(x, z);
  // Basalt column clusters: denser on the riverbanks, on the plateau and at the cliff foot
  scatterMask(ctx, Math.round(300 * k), 1.4, (x, z) => {
    if (special(x, z)) return 0;
    const le = SH.lavaEdgeDist(x, z);
    return 0.12 + (1 - smooth(2, 14, le)) * 0.4 + smooth(-20, -50, z) * 0.2 + edgeK(x, z) * 0.35;
  }, (x, z) => basalt(ctx, x, z, 0.6 + r() * 0.8, r() < 0.15 ? 2 + r() * 3 : 0));
  // Scoria boulders (those near lava have glowing cracks)
  scatterMask(ctx, Math.round(220 * k), 1.2, (x, z) => (lensZone(ctx, x, z, 1.5) ? 0 : special(x, z) ? 0.05 : 0.35 + edgeK(x, z) * 0.3), (x, z) => {
    const le = SH.lavaEdgeDist(x, z);
    scoria(ctx, x, z, 0.4 + r() * 1.1, le < 10 && r() < 0.5, r() < 0.5 ? COL.scoria : COL.rock);
  });
  // Charred dead trees: the southern plain and the north bank
  scatterMask(ctx, Math.round(110 * k), 1.5, (x, z) => {
    if (special(x, z)) return 0;
    const le = SH.lavaEdgeDist(x, z);
    const field = 1 - smooth(16, 28, Math.hypot(x - SH.FIELD[0], z - SH.FIELD[1]));
    return (0.25 + smooth(20, 60, z) * 0.35) * smooth(3, 10, le) * (1 - field * 0.8);
  }, (x, z) => charredTree(ctx, x, z, 0.9 + r() * 0.6));
  // Rubble: here only the number of piles is counted (same odds as the old even scatter); the actual positions are left to the
  // ground layer, which piles them at the foot of rocks and crust slabs and along the road edges
  let peb = 0;
  scatterMask(ctx, Math.round(260 * k), 0.4, (x, z) => (nearTown(x, z) ? 0 : 0.6), () => peb++);
  // Obsidian on the lava lake shore
  for (let i = 0; i < 40 * k; i++) {
    const a = r() * Math.PI * 2;
    const x = SH.LAKE[0] + Math.cos(a) * (18 + r() * 8);
    const z = SH.LAKE[1] + Math.sin(a) * (18 + r() * 8);
    if (Math.abs(x) > S - 16 || Math.abs(z) > S - 16) continue;
    if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1) || SH.lavaEdgeDist(x, z) < 1) continue;
    obsidian(ctx, x, z, 0.6 + r() * 0.7);
  }
  // Flame maples outside the town: gathered into two or three small groves
  for (const [gx, gz, n] of [
    [6, 72, 4],
    [60, 52, 3],
  ] as const) {
    for (let i = 0; i < n * k + 1; i++) {
      const x = gx + (r() - 0.5) * 12;
      const z = gz + (r() - 0.5) * 10;
      if (!ctx.clear(x, z, 1.5) || ctx.solids.blocked(x, z, 1.8) || Math.max(Math.abs(x), Math.abs(z)) > S - 18) continue;
      emberMaple(ctx, x, z, 0.9 + r() * 0.5);
    }
  }
  // Cliff top: silhouettes of boulders and charred wood
  for (let i = 0; i < 110 * k; i++) {
    const a = r() * Math.PI * 2;
    const x = Math.cos(a) * (S - 8) * (0.92 + r() * 0.2);
    const z = Math.sin(a) * (S - 8) * (0.92 + r() * 0.2);
    const cx = Math.max(-S + 2, Math.min(S - 2, x));
    const cz = Math.max(-S + 2, Math.min(S - 2, z));
    if (Math.max(Math.abs(cx), Math.abs(cz)) < S - 22) continue;
    ctx.place(cx, cz, 1);
    if (r() < 0.55) {
      // Boulders half-buried at the cliff top (the exposed part is flatter, so it reads as having fallen there)
      const R = 1.6 + r() * 2.4;
      const sink = Math.min(1.2, slopeAt(ctx, cx, cz, R)) * R * 0.7;
      const g = new THREE.DodecahedronGeometry(R, 0);
      g.scale(1.1, 0.62, 1);
      b.add(g, r() < 0.5 ? COL.basalt : COL.rock, M(cx, -R * 0.12 - sink, cz, r() * 6, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
    }
    else if (r() < 0.6) basalt(ctx, cx, cz, 1.2 + r() * 0.8, 3 + r() * 5, false);
    else charredTree(ctx, cx, cz, 1.3 + r() * 0.6, false);
  }
  return peb;
}
