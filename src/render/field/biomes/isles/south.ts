// The southern half of the archipelago: the boardwalk, coral on the beaches and in shallows, Palm Grove Isle (Sacred Whale
// bones, Springheart Pool), Coral Atoll (a giant crab's empty shell), Wreck Reef, Windy Cape and its sea stacks.

import * as THREE from 'three';
import { M, type PropBatch } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { boulder, scatterMask } from '../../props.ts';
import { flagGeo, gulls, poolSurface, waterfall } from './fx.ts';
import { coral, driftwood, palm, reefRock, seaStack, seg, shell, solidPalm, tropicBush } from './flora.ts';
import { deckAlong } from './town.ts';
import { ATOLL, CAPE, cold, DECKS, fbm, POND, POND_R, REEF, TOWN, TOWN_R, WHALE_HEAD, WHALE_TAIL, WRECK } from './terrain.ts';

const BONE = 0xf0e6d0;
const BONE_D = 0xd8cbb0;
const HIBISCUS = [0xff4a5a, 0xff8ab0, 0xffc83a, 0xff7a3a];
const WOOD_D = 0x6a4a30;

export interface WildOut {
  flags: THREE.BufferGeometry[];
  lights: [number, number, number, number][];
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ───────────────────────── Boardwalk ─────────────────────────

function boardwalks(ctx: FieldCtx, out: WildOut): void {
  const { b } = ctx;
  for (const run of DECKS) {
    const mz = run.reduce((s, p) => s + p[1], 0) / run.length;
    const bridge = mz < -30;
    const lamps = deckAlong(ctx, run, bridge ? 4.6 : 4.2, { rail: true, lamps: bridge ? 3 : 5, snow: bridge ? 1 : 0 });
    for (const [x, y, z] of lamps) {
      b.lift = 0;
      b.add(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), WOOD_D, M(x, y + 1.2, z));
      b.add(new THREE.BoxGeometry(0.34, 0.42, 0.34), 0x3a4050, M(x, y + 2.55, z));
      b.glow(new THREE.BoxGeometry(0.24, 0.3, 0.24), 0xffd88a, M(x, y + 2.55, z));
      b.add(new THREE.ConeGeometry(0.32, 0.26, 4), 0x3a4050, M(x, y + 2.9, z, Math.PI / 4));
      out.lights.push([x, y + 2.55, z, 1.6]);
    }
    // Torii-style wooden gates at both ends (with a shimenawa rope hung on the icefield's wooden bridge); boardwalks that are too short get none
    let len = 0;
    for (let i = 1; i < run.length; i++) len += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
    if (len < 10) continue;
    for (const end of [run[0], run[run.length - 1]]) {
      const other = end === run[0] ? run[Math.min(2, run.length - 1)] : run[Math.max(0, run.length - 3)];
      const dx = other[0] - end[0];
      const dz = other[1] - end[1];
      const l = Math.hypot(dx, dz) || 1;
      const nx = dz / l;
      const nz = -dx / l;
      const [x, z] = end;
      if (Math.hypot(x - TOWN[0], z - TOWN[1]) < TOWN_R + 6) continue;
      const y = ctx.h(x, z);
      const w = bridge ? 2.9 : 2.7;
      b.lift = 0;
      for (const s of [-1, 1]) {
        b.add(new THREE.CylinderGeometry(0.2, 0.24, 4.2, 7), bridge ? 0x8a4a3a : 0xb8503a, M(x + nx * s * w, y + 2.1, z + nz * s * w));
        ctx.solids.add(x + nx * s * w, z + nz * s * w, 0.35);
      }
      const ry = Math.atan2(nx, nz);
      b.add(new THREE.BoxGeometry(0.4, 0.34, w * 2 + 1.4), 0x3a4050, M(x, y + 4.3, z, ry));
      b.add(new THREE.BoxGeometry(0.3, 0.24, w * 2 + 0.2), bridge ? 0x8a4a3a : 0xb8503a, M(x, y + 3.7, z, ry));
      if (bridge) {
        for (let i = 0; i < 5; i++) b.add(new THREE.BoxGeometry(0.06, 0.5, 0.26), 0xffffff, M(x + nx * (i - 2) * 1.1, y + 3.3, z + nz * (i - 2) * 1.1, ry), false);
        b.add(new THREE.BoxGeometry(0.5, 0.12, w * 2 + 1.5), 0xf4f8ff, M(x, y + 4.52, z, ry), false);
      }
    }
  }
  b.lift = 0;
}

// ───────────────────────── Beach, shallows, coconut palms ─────────────────────────

function beaches(ctx: FieldCtx): void {
  const { b, r, low } = ctx;
  const k = low ? 0.5 : 1;
  const S = ctx.layout.size - 6;
  // Coconut palms: most where the beach meets the inland, leaning toward the sea
  const palmMask = (x: number, z: number) => {
    const c = cold(x, z);
    if (c > 0.35) return 0;
    const h = ctx.h(x, z);
    if (h < 0.35) return 0;
    return (1 - c * 2.5) * (h < 1.6 ? 0.8 : 0.35);
  };
  scatterMask(ctx, Math.round(900 * k), 1.6, palmMask, (x, z) => {
    // Leaning in the downhill direction (usually the sea)
    const gx = ctx.h(x + 2, z) - ctx.h(x - 2, z);
    const gz = ctx.h(x, z + 2) - ctx.h(x, z - 2);
    const lean = Math.atan2(-gz, -gx) + (r() - 0.5) * 0.8;
    solidPalm(ctx, x, z, 1.35 + r() * 0.75, lean);
  });
  // Tropical bushes and hibiscus
  scatterMask(ctx, Math.round(520 * k), 1.0, (x, z) => (cold(x, z) < 0.3 && ctx.h(x, z) > 1.0 ? 0.55 : 0), (x, z) => {
    tropicBush(ctx, x, z, 0.8 + r() * 0.7, r() < 0.55 ? HIBISCUS[Math.floor(r() * 4)] : undefined);
  });
  // Shells, starfish, driftwood and reef rocks on the beach
  for (let i = 0; i < 700 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const h = ctx.h(x, z);
    if (h < 0.05 || h > 0.95 || cold(x, z) > 0.4 || ctx.pathDist(x, z) < 2.6 || !ctx.clear(x, z, -1)) continue;
    ctx.place(x, z);
    const q = r();
    if (q < 0.7) shell(b, x, z, r);
    else if (q < 0.8) driftwood(b, x, z, 0.8 + r() * 0.4, r);
    else if (!ctx.solids.blocked(x, z, 1)) {
      reefRock(b, x, z, 0.7 + r() * 0.8, r);
      ctx.solids.add(x, z, 0.8);
    }
  }
  // Coral in shallow water (visible through the sea surface)
  for (let i = 0; i < 1400 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const h = ctx.h(x, z);
    if (h > -0.45 || h < -2.8 || cold(x, z) > 0.3 || ctx.pathDist(x, z) < 3) continue;
    b.lift = h;
    // Most of the coral hides under the water surface, with only the tips showing
    coral(b, x, z, Math.min(0.8 + r() * 0.9, -h * 1.1 + 0.2), r);
  }
  // Buoy
  for (const [x, z] of [[8, 46], [-12, 44], [24, 30], [-30, 28], [32, 50], [-52, 22], [40, -8], [70, 30]] as const) {
    if (ctx.h(x, z) > -0.8) continue;
    b.lift = 0;
    b.add(new THREE.SphereGeometry(0.42, 10, 7), (x + z) % 2 ? 0xe8443a : 0xffffff, M(x, 0.18, z));
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 4), 0x3a4050, M(x, 0.8, z));
    b.glow(new THREE.SphereGeometry(0.13, 6, 5), 0xffd870, M(x, 1.35, z));
  }
  b.lift = 0;
}

// ───────────────────────── Sacred Whale bones ─────────────────────────

/**
 * Sacred Whale bones: a huge spine arching up from the sand in the south, crossing the main road and landing in the shoal in
 * the north, with ribs hanging to the ground on both sides and the skull soaking in the shallows
 */
function whaleBones(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  b.lift = 0;
  const g = (x: number, z: number) => ctx.h(x, z);
  const [hx, hz] = WHALE_HEAD;
  const [tx, tz] = WHALE_TAIL;
  const pts = [
    [tx + 6.5, 0.15, tz + 1.5],
    [tx + 4.2, 1.6, tz - 1.5],
    [tx + 1.8, 4.2, tz - 5.2],
    [tx + 1.6, 5.9, tz - 9.2],
    [tx + 2.4, 5.8, tz - 12.8],
    [hx - 1.4, 4.4, hz + 2.6],
    [hx - 4.2, 2.2, hz - 1.6],
  ].map(([x, y, z]) => V(x, g(x, z) + y, z));
  const spine = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const L = spine.getLength();
  const n = Math.round(L / 0.85);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = spine.getPointAt(t);
    const d = spine.getTangentAt(t);
    const rad = 0.22 + 0.32 * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.9);
    const v = new THREE.CylinderGeometry(rad, rad, 0.55, 8);
    b.add(v, i % 2 ? BONE : BONE_D, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), new THREE.Vector3(1, 1, 1)));
    // Spinous processes on the back
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
    seg(b, p, p.clone().addScaledVector(up, rad + 0.5), rad * 0.35, BONE, 5, true, rad * 0.15);
  }
  // Ribs: hanging to the ground from both sides of the spine
  const ribs = 11;
  for (let i = 0; i < ribs; i++) {
    const t = 0.24 + (i / (ribs - 1)) * 0.5;
    const p = spine.getPointAt(t);
    const d = spine.getTangentAt(t);
    const side = new THREE.Vector3(-d.z, 0, d.x).normalize();
    const span = 3.1 + Math.sin((i / (ribs - 1)) * Math.PI) * 0.8;
    for (const s of [-1, 1]) {
      const foot = p.clone().addScaledVector(side, s * span).add(V(d.x * 0.8, 0, d.z * 0.8));
      foot.y = g(foot.x, foot.z) - 0.2;
      const mid = p.clone().addScaledVector(side, s * span * 0.95);
      mid.y = p.y - (p.y - foot.y) * 0.3;
      const c = new THREE.CatmullRomCurve3([p.clone().addScaledVector(side, s * 0.3), mid, foot]);
      b.add(new THREE.TubeGeometry(c, 10, 0.2, 5), i % 2 ? BONE : BONE_D, new THREE.Matrix4());
      ctx.solids.add(foot.x, foot.z, 0.35);
    }
  }
  // Skull: a flat long bone shell, two open jaws, eye sockets
  const hp = pts[pts.length - 1];
  const hd = new THREE.Vector3().subVectors(pts[pts.length - 1], pts[pts.length - 2]).setY(0).normalize();
  const yaw = Math.atan2(hd.x, hd.z);
  const cx = hp.x + hd.x * 2.2;
  const cz = hp.z + hd.z * 2.2;
  const cy = g(cx, cz);
  const skull = new THREE.SphereGeometry(1, 14, 10);
  skull.scale(2.1, 1.05, 3.4);
  b.add(skull, BONE, M(cx, cy + 0.7, cz, yaw, 1, -0.12));
  const snout = new THREE.ConeGeometry(1.3, 4.2, 10);
  snout.rotateX(Math.PI / 2);
  snout.scale(1, 0.45, 1);
  b.add(snout, BONE_D, M(cx + hd.x * 4.4, cy + 0.5, cz + hd.z * 4.4, yaw));
  for (const s of [-1, 1]) {
    const side = new THREE.Vector3(hd.z, 0, -hd.x).multiplyScalar(s);
    const a = V(cx + side.x * 1.4 - hd.x * 1.5, cy + 0.1, cz + side.z * 1.4 - hd.z * 1.5);
    const m1 = V(cx + side.x * 2.6 + hd.x * 2.5, cy + 0.2, cz + side.z * 2.6 + hd.z * 2.5);
    const e = V(cx + side.x * 1.6 + hd.x * 6.8, cy + 0.1, cz + side.z * 1.6 + hd.z * 6.8);
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, m1, e]), 12, 0.3, 6), BONE, new THREE.Matrix4());
    b.add(new THREE.SphereGeometry(0.42, 8, 6), 0x3a4a5a, M(cx + side.x * 1.55 - hd.x * 0.6, cy + 1.05, cz + side.z * 1.55 - hd.z * 0.6), false);
    // A faint blue light in the eye sockets: the Sacred Whale's song has not quite faded
    b.glow(new THREE.SphereGeometry(0.16, 6, 5), 0x6ad8ff, M(cx + side.x * 1.6 - hd.x * 0.55, cy + 1.05, cz + side.z * 1.6 - hd.z * 0.55));
    out.lights.push([cx + side.x * 1.6 - hd.x * 0.55, cy + 1.05, cz + side.z * 1.6 - hd.z * 0.55, 1.4]);
  }
  ctx.solids.add(cx, cz, 2.4);
  ctx.solids.add(cx + hd.x * 3.5, cz + hd.z * 3.5, 1.4);
  // Barnacles and coral on the skull, shells and candle stands for worship
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    b.lift = cy + 0.6 + r() * 0.8;
    coral(b, cx + Math.cos(a) * 1.8, cz + Math.sin(a) * 2.2, 0.35 + r() * 0.3, r);
  }
  b.lift = 0;
  const ox = cx - hd.x * 4.2;
  const oz = cz - hd.z * 4.2;
  const oy = g(ox, oz);
  if (oy > -0.1) {
    b.add(new THREE.BoxGeometry(1.6, 0.5, 0.9), 0xb8a888, M(ox, oy + 0.25, oz, yaw));
    for (let i = 0; i < 3; i++) {
      const px = ox + Math.cos(yaw) * (i - 1) * 0.5;
      const pz = oz - Math.sin(yaw) * (i - 1) * 0.5;
      b.add(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 6), 0xfff4e0, M(px, oy + 0.68, pz));
      b.glow(new THREE.SphereGeometry(0.06, 5, 4), 0xffc86a, M(px, oy + 0.92, pz));
    }
    shell(b, ox + 0.3, oz + 0.2, r, 1.2);
    ctx.solids.add(ox, oz, 0.9);
  }
  // Shimenawa rope: hung between the two tallest pairs of ribs, with white paper streamers hanging from it
  for (const t of [0.42, 0.62]) {
    const p = spine.getPointAt(t);
    const d = spine.getTangentAt(t);
    const side = new THREE.Vector3(-d.z, 0, d.x).normalize();
    const a = p.clone().addScaledVector(side, -2.6).setY(p.y - 1.4);
    const c = p.clone().addScaledVector(side, 2.6).setY(p.y - 1.4);
    const mid = a.clone().lerp(c, 0.5).setY(p.y - 2.1);
    b.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, c), 10, 0.09, 5), 0xd8c08a, new THREE.Matrix4());
    for (let k = 1; k < 6; k++) {
      const q = new THREE.QuadraticBezierCurve3(a, mid, c).getPoint(k / 6);
      out.flags.push(flagGeo(0.22, 0.55, 0xffffff, true, false, M(q.x, q.y - 0.05, q.z, Math.atan2(side.x, side.z) + Math.PI / 2)));
    }
  }
}

// ───────────────────────── Springheart Pool ─────────────────────────

function springPond(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [px, pz] = POND;
  // Pool surface: a little below the lowest point of the pool rim
  let rim = Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    rim = Math.min(rim, ctx.h(px + Math.cos(a) * (POND_R + 0.6), pz + Math.sin(a) * (POND_R + 0.6)));
  }
  const level = rim - 0.18;
  poolSurface(ctx, px, level, pz, POND_R + 0.35, 0x6ae8d8, 0x2a9ab8, 0.35);
  // Stones on the pool rim
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.1;
    const d = POND_R + 0.7 + r() * 0.4;
    const x = px + Math.cos(a) * d;
    const z = pz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < 2.4) continue;
    ctx.place(x, z);
    b.add(new THREE.DodecahedronGeometry(0.45 + r() * 0.35, 0), [0x9aa8b0, 0x8a98a4, 0xb0bcc0][i % 3], M(x, 0.1, z, r() * 6, 1, r(), r()));
  }
  // Lotus leaves and lotus flowers (the one in the center is especially large and glows)
  b.lift = level + 0.02;
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * (POND_R - 0.8);
    const s = 0.5 + r() * 0.5;
    const x = px + Math.cos(a) * d;
    const z = pz + Math.sin(a) * d;
    b.add(new THREE.CylinderGeometry(s, s, 0.04, 14, 1, false, 0.3, Math.PI * 1.85), 0x4fae52, M(x, 0, z, r() * 6), false);
    if (r() < 0.45) lotus(b, x, z, 0.5 + r() * 0.3, r() < 0.5 ? 0xffb8d8 : 0xffffff);
  }
  lotus(b, px + 0.5, pz - 0.3, 1.4, 0xffc8e0, true);
  b.lift = 0;
  out.lights.push([px + 0.5, level + 0.8, pz - 0.3, 5]);
  // Overflow: from the pool's lowest point down the steepest direction into the sea
  let best = 0;
  let bh = Infinity;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const hh = ctx.h(px + Math.cos(a) * (POND_R + 1.5), pz + Math.sin(a) * (POND_R + 1.5));
    if (hh < bh && ctx.pathDist(px + Math.cos(a) * (POND_R + 3), pz + Math.sin(a) * (POND_R + 3)) > 4) {
      bh = hh;
      best = a;
    }
  }
  const flow: THREE.Vector3[] = [];
  let x = px + Math.cos(best) * (POND_R - 0.4);
  let z = pz + Math.sin(best) * (POND_R - 0.4);
  flow.push(V(x, level + 0.02, z));
  let dx = Math.cos(best);
  let dz = Math.sin(best);
  for (let i = 0; i < 60; i++) {
    const gx = ctx.h(x + 1, z) - ctx.h(x - 1, z);
    const gz = ctx.h(x, z + 1) - ctx.h(x, z - 1);
    const gl = Math.hypot(gx, gz) || 1;
    dx = dx * 0.6 - (gx / gl) * 0.4;
    dz = dz * 0.6 - (gz / gl) * 0.4;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    x += dx;
    z += dz;
    const hh = ctx.h(x, z);
    flow.push(V(x, Math.max(hh + 0.08, 0.02), z));
    if (hh < -0.05) break;
  }
  if (flow.length > 3) waterfall(ctx, flow, 1.3, 0x8ae8f0);
  for (let i = 2; i < flow.length; i += 2) {
    const p = flow[i];
    for (const s of [-1, 1]) {
      const q = flow[Math.min(flow.length - 1, i + 1)];
      const nx = -(q.z - p.z);
      const nz = q.x - p.x;
      const l = Math.hypot(nx, nz) || 1;
      const sx = p.x + (nx / l) * s * (0.9 + r() * 0.3);
      const sz = p.z + (nz / l) * s * (0.9 + r() * 0.3);
      ctx.place(sx, sz);
      b.add(new THREE.DodecahedronGeometry(0.25 + r() * 0.2, 0), 0x8a98a4, M(sx, 0.05, sz, r() * 6), false);
    }
  }
  b.lift = 0;
}

/** Lotus flower: two rings of petals and a yellow heart; when glow is set the heart glows */
function lotus(pb: PropBatch, x: number, z: number, s: number, col: number, glow = false): void {
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 6 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.4;
      const petal = new THREE.SphereGeometry(0.2 * s, 6, 4);
      petal.scale(0.55, 1, 0.3);
      const tilt = ring ? 0.35 : 0.8;
      pb.add(petal, ring ? 0xffffff : col, new THREE.Matrix4().compose(V(x + Math.cos(a) * 0.13 * s, 0.14 * s, z + Math.sin(a) * 0.13 * s), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt)), new THREE.Vector3(1, 1, 1)), false);
    }
  }
  if (glow) pb.glow(new THREE.SphereGeometry(0.1 * s, 8, 6), 0xffe68a, M(x, 0.16 * s, z));
  else pb.add(new THREE.SphereGeometry(0.08 * s, 6, 5), 0xffd84a, M(x, 0.16 * s, z), false);
}

// ───────────────────────── Coral Atoll ─────────────────────────

function atoll(ctx: FieldCtx, out: WildOut): void {
  const { b, r, low } = ctx;
  const k = low ? 0.5 : 1;
  // The lagoon is full of coral
  for (let i = 0; i < 170 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * (ATOLL.R - 2);
    const x = ATOLL.x + Math.cos(a) * d;
    const z = ATOLL.z + Math.sin(a) * d;
    const h = ctx.h(x, z);
    if (h > -0.25 || h < -2.4) continue;
    b.lift = h;
    coral(b, x, z, Math.min(0.5 + r() * 0.9, -h * 1.3 + 0.35), r);
  }
  b.lift = 0;
  // The giant crab's empty shell: a spiral shell on the sand ring in the west with its mouth facing the lagoon;
  // beside it lies the shell of a big claw
  const sx = ATOLL.x - 14;
  const sz = ATOLL.z + 1;
  const y0 = ctx.place(sx, sz, 3);
  const face = 0.15;
  const cq = Math.cos(face);
  const sq = Math.sin(face);
  const loc = (lx: number, ly: number, lz: number) => V(sx + cq * lx + sq * lz, ly, sz - sq * lx + cq * lz);
  const whorls = 7;
  let rad = 3.2;
  let y = 1.8;
  let back = -0.6;
  for (let i = 0; i < whorls; i++) {
    const a = i * 1.35;
    const c = loc(Math.cos(a) * rad * 0.35 + back, y, Math.sin(a) * rad * 0.35);
    const g = new THREE.SphereGeometry(rad, 14, 10);
    g.scale(1, 0.78, 1);
    b.add(g, i % 2 ? 0xf4d8b0 : 0xeab48a, M(c.x, c.y, c.z, a));
    // Spine
    for (let s = 0; s < 5; s++) {
      const aa = (s / 5) * Math.PI * 2 + i;
      const tip = new THREE.ConeGeometry(rad * 0.16, rad * 0.55, 5);
      b.add(tip, 0xf6e6c8, along3(c.x + Math.cos(aa) * rad * 0.92, c.y + rad * 0.3, c.z + Math.sin(aa) * rad * 0.92, Math.cos(aa), 0.6, Math.sin(aa)));
    }
    y += rad * 0.62;
    back -= rad * 0.12;
    rad *= 0.72;
  }
  // Shell mouth: the pink inner wall (facing east, where the chest is inside)
  const mouth = loc(2.6, 1.3, 0);
  const lip = new THREE.TorusGeometry(1.7, 0.45, 8, 16);
  b.add(lip, 0xffc8b0, M(mouth.x, mouth.y, mouth.z, face + Math.PI / 2, 1).multiply(new THREE.Matrix4().makeScale(1, 1.1, 1)));
  const inner = new THREE.CircleGeometry(1.5, 16);
  b.add(inner, 0xd86a8a, M(mouth.x - 0.1, mouth.y, mouth.z, face + Math.PI / 2), false);
  ctx.solids.add(sx - 0.5, sz, 3.6);
  // Coral growing on the shell
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    b.lift = y0 + 2.4 + r() * 2.5;
    coral(b, sx - 0.6 + Math.cos(a) * 2.2, sz + Math.sin(a) * 2.2, 0.5 + r() * 0.4, r);
  }
  b.lift = 0;
  // The big claw's empty shell
  const cx = ATOLL.x - 12;
  const cz = ATOLL.z - 7.5;
  ctx.place(cx, cz, 2);
  const claw = new THREE.SphereGeometry(1, 12, 8);
  claw.scale(2.2, 1.0, 1.3);
  b.add(claw, 0xe8704a, M(cx, 0.6, cz, 0.7));
  const f1 = new THREE.ConeGeometry(0.6, 3.0, 8);
  b.add(f1, 0xf08a5a, M(cx + 1.8, 0.9, cz + 1.7, 0.7, 1, Math.PI / 2 - 0.3, 0).multiply(new THREE.Matrix4().makeRotationZ(0)));
  const f2 = new THREE.ConeGeometry(0.5, 2.4, 8);
  b.add(f2, 0xe8704a, M(cx + 2.2, 0.35, cz + 0.8, 1.2, 1, Math.PI / 2 + 0.1, 0));
  ctx.solids.add(cx, cz, 1.9);
  ctx.solids.add(cx + 1.8, cz + 1.2, 1.0);
  // Coconut palms on the ring (leaning outward)
  for (let i = 0; i < 26 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = ATOLL.R + (r() - 0.5) * 3;
    const x = ATOLL.x + Math.cos(a) * d;
    const z = ATOLL.z + Math.sin(a) * d;
    if (ctx.h(x, z) < 0.5 || !ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1.4)) continue;
    solidPalm(ctx, x, z, 1.3 + r() * 0.7, a + (r() - 0.5) * 0.6);
  }
  b.lift = 0;
  out.lights.push([mouth.x, y0 + 1.3, mouth.z, 3]);
}

function along3(x: number, y: number, z: number, dx: number, dy: number, dz: number): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
  return new THREE.Matrix4().compose(V(x, y, z), q, new THREE.Vector3(1, 1, 1));
}

// ───────────────────────── Wreck Reef ─────────────────────────

function wreck(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [wx, wz] = WRECK;
  const y0 = ctx.place(wx, wz, 4);
  const yaw = 2.35;
  const roll = 0.32;
  const pitch = -0.1;
  const base = new THREE.Matrix4().compose(V(wx, y0 - 0.9, wz), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  b.lift = 0;
  // Hull: the hull cross-sections stacked along its length
  const hullShape = (k: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 9.5 * k);
    sh.quadraticCurveTo(3.6 * k, 5 * k, 3.2 * k, -1 * k);
    sh.quadraticCurveTo(3.0 * k, -6.5 * k, 2.2 * k, -8 * k);
    sh.lineTo(-2.2 * k, -8 * k);
    sh.quadraticCurveTo(-3.0 * k, -6.5 * k, -3.2 * k, -1 * k);
    sh.quadraticCurveTo(-3.6 * k, 5 * k, 0, 9.5 * k);
    return sh;
  };
  for (let i = 0; i < 6; i++) {
    const k = 1 - i * 0.07;
    const g = new THREE.ExtrudeGeometry(hullShape(k), { depth: 0.62, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(Math.PI / 2);
    b.add(g, i % 2 ? 0x5a3a26 : 0x6a4630, at(M(0, 3.2 - i * 0.6, 0)));
  }
  // Deck (with a few planks missing) and gunwale
  for (let i = 0; i < 26; i++) {
    const zz = -7.4 + i * 0.62;
    if (i === 9 || i === 10 || i === 16) continue;
    const half = zz > 0 ? 3.2 - (zz / 9.5) ** 2 * 3.0 : 3.1;
    b.add(new THREE.BoxGeometry(half * 2 - 0.3, 0.1, 0.56), i % 3 ? 0x8a6440 : 0x7a5436, at(M(0, 3.25, zz)));
  }
  const rim = new THREE.ExtrudeGeometry(hullShape(1.02), { depth: 0.25, bevelEnabled: false, curveSegments: 8 });
  rim.rotateX(Math.PI / 2);
  b.add(rim, 0x3a2a1c, at(M(0, 3.7, 0)));
  // Stern castle
  b.add(new THREE.BoxGeometry(5.0, 2.2, 3.4), 0x5a3a26, at(M(0, 4.4, -6.2)));
  b.add(new THREE.BoxGeometry(5.3, 0.25, 3.7), 0x3a2a1c, at(M(0, 5.55, -6.2)));
  for (const s of [-1.3, 0, 1.3]) b.glow(new THREE.BoxGeometry(0.5, 0.6, 0.1), 0x6affd8, at(M(s, 4.5, -7.95)));
  // The broken mainmast and foremast, the bowsprit
  b.add(new THREE.CylinderGeometry(0.3, 0.38, 9, 8), 0x7a5436, at(M(0, 7.6, 0.8)));
  b.add(new THREE.CylinderGeometry(0.1, 0.1, 5.6, 5), 0x7a5436, at(M(0, 10.2, 0.8, 0, 1, 0, Math.PI / 2)));
  b.add(new THREE.CylinderGeometry(0.25, 0.3, 5, 8), 0x7a5436, at(M(0, 5.6, 5.4)));
  b.add(new THREE.CylinderGeometry(0.18, 0.24, 6, 6), 0x7a5436, at(M(0, 5.2, 11.5, 0, 1, Math.PI / 2 - 0.35)));
  // Canvas: hanging in tatters
  const sailM = at(M(0, 10.1, 0.9, Math.PI / 2));
  out.flags.push(flagGeo(5, 3.6, 0xe8dcc0, true, false, sailM, 0.4));
  out.flags.push(flagGeo(1.6, 0.8, 0x2a2a3a, false, true, at(M(0, 12.4, 0.8, Math.PI / 2)), 0.5));
  // The mizzenmast fallen on the beach
  const fx = wx + 4;
  const fz = wz + 6;
  ctx.place(fx, fz, 2);
  b.add(new THREE.CylinderGeometry(0.28, 0.34, 10, 8), 0x7a5436, M(fx, 0.3, fz, 0.4, 1, 0, Math.PI / 2 - 0.04));
  ctx.solids.add(fx - 2.5 * Math.cos(0.4), fz + 2.5 * Math.sin(0.4), 0.6);
  ctx.solids.add(fx + 2.5 * Math.cos(0.4), fz - 2.5 * Math.sin(0.4), 0.6);
  b.lift = 0;
  // Rigging
  const top = V(0, 12, 0.8).applyMatrix4(base);
  for (const s of [-1, 1]) {
    const a = V(s * 3.1, 3.7, -3).applyMatrix4(base);
    const c = V(s * 3.0, 3.7, 4.5).applyMatrix4(base);
    seg(b, top, a, 0.03, 0x3a3020, 3, false);
    seg(b, top, c, 0.03, 0x3a3020, 3, false);
  }
  // Barnacles and coral on the bottom of the hull
  for (let i = 0; i < 14; i++) {
    const p = V((r() - 0.5) * 6, 0.9, (r() - 0.5) * 14).applyMatrix4(base);
    b.lift = Math.max(ctx.h(p.x, p.z), p.y - 0.4);
    coral(b, p.x, p.z, 0.5 + r() * 0.5, r);
  }
  b.lift = 0;
  // Collision: a row of circles along the hull
  for (let i = -3; i <= 3; i++) {
    const p = V(0, 0, i * 2.6).applyMatrix4(base);
    ctx.solids.add(p.x, p.z, 3.1 - Math.abs(i) * 0.2);
  }
  // Scattered barrels and crates
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 5;
    const x = wx + Math.cos(a) * d;
    const z = wz + Math.sin(a) * d;
    if (ctx.h(x, z) < -0.3 || ctx.solids.blocked(x, z, 0.8) || ctx.pathDist(x, z) < 2.5) continue;
    ctx.place(x, z);
    if (i % 2) b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.95, 10), 0x8a5a38, M(x, 0.3, z, r(), 1, Math.PI / 2, 0));
    else b.add(new THREE.BoxGeometry(0.8, 0.8, 0.8), 0xa07848, M(x, 0.3, z, r(), 1, 0.2, 0.1));
    ctx.solids.add(x, z, 0.6);
  }
  b.lift = 0;
  // Lamps of the deep-sea lantern mothers: blue-green points of light one by one in the water beside the ship
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 8 + r() * 7;
    const x = wx + Math.cos(a) * d;
    const z = wz + Math.sin(a) * d;
    if (ctx.h(x, z) > -0.3) continue;
    const y = -0.3 - r() * 0.5;
    b.glow(new THREE.SphereGeometry(0.16, 6, 5), 0x7affd8, M(x, y, z));
    out.lights.push([x, y + 0.2, z, 2.4]);
  }
  out.lights.push([wx, y0 + 3.6, wz, 4]);
}

// ───────────────────────── Windy Cape ─────────────────────────

function cape(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [cx, cz] = CAPE;
  // Sea stacks in the sea around the cape (a few in the north are especially tall, pointing to the secret sandbar)
  const stacks: [number, number, number][] = [
    [-72, -4, 2.4],
    [-70, 8, 1.8],
    [-66, 15, 1.3],
    [-73, -14, 2.0],
    [-70, -22, 1.5],
    [-50, -20, 1.2],
    [-80, 2, 1.6],
    [-60, 22, 1.1],
    [-84, -20, 1.4],
  ];
  for (const [x, z, s] of stacks) {
    const g = ctx.h(x, z);
    if (g > 0.5) continue;
    b.lift = Math.min(g, -0.5) + 0.4;
    seaStack(b, x, z, s * 1.6, r);
    b.lift = 0;
    b.add(new THREE.RingGeometry(1.9 * s * 1.1, 2.6 * s * 1.1, 18).rotateX(-Math.PI / 2), 0xffffff, M(x, 0.04, z), false);
    ctx.solids.add(x, z, 2.2 * s);
    // Bird nest
    if (s > 1.5) {
      const top = b.lift + s * 1.6 * 4.3;
      const ring = new THREE.TorusGeometry(0.55, 0.2, 5, 10);
      ring.rotateX(Math.PI / 2);
      b.add(ring, 0x8a6a40, M(x, Math.min(g, -0.5) + 0.4 + top, z), false);
      for (let i = 0; i < 3; i++) b.add(new THREE.SphereGeometry(0.14, 6, 5), 0xf4f0e0, M(x + (i - 1) * 0.2, Math.min(g, -0.5) + 0.5 + top, z + (i % 2) * 0.15), false);
    }
  }
  b.lift = 0;
  gulls(ctx, cx - 10, 22, cz - 4, 9, 10, 20, 0.12);
  // Summit: a pile of stones, a string of wind flags, a coconut palm bent by the wind
  let sx = cx;
  let sz = cz;
  let top = -Infinity;
  for (let i = 0; i < 60; i++) {
    const x = cx - 8 + r() * 12;
    const z = cz - 6 + r() * 12;
    const h = ctx.h(x, z);
    if (h > top) {
      top = h;
      sx = x;
      sz = z;
    }
  }
  ctx.place(sx, sz, 1);
  for (let i = 0; i < 6; i++) b.add(new THREE.DodecahedronGeometry(0.7 - i * 0.09, 0), i % 2 ? 0x9aa4b0 : 0x8a94a0, M(sx + (r() - 0.5) * 0.2, 0.4 + i * 0.5, sz + (r() - 0.5) * 0.2, r() * 6));
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 4, 5), WOOD_D, M(sx, 2.6, sz));
  ctx.solids.add(sx, sz, 1.0);
  const flagTop = V(sx, top + 4.4, sz);
  const cols = [0x4fb0ff, 0xffffff, 0xe8443a, 0xffc84a, 0x5ad88a];
  for (const [ex, ez] of [[sx + 5, sz + 2.5], [sx - 4.5, sz + 3.5], [sx + 1, sz - 5]] as const) {
    const ey = ctx.h(ex, ez) + 0.2;
    if (ey < top - 1.6) continue;
    ctx.place(ex, ez);
    b.add(new THREE.BoxGeometry(0.4, 0.4, 0.4), 0x8a94a0, M(ex, 0.2, ez));
    b.lift = 0;
    const end = V(ex, ey + 0.3, ez);
    seg(b, flagTop, end, 0.02, 0x3a4050, 3, false);
    const ry = -Math.atan2(end.z - flagTop.z, end.x - flagTop.x);
    for (let i = 0; i < 8; i++) {
      const k = (i + 0.5) / 8;
      const p = flagTop.clone().lerp(end, k);
      out.flags.push(flagGeo(0.45, 0.55, cols[i % cols.length], true, false, M(p.x, p.y, p.z, ry)));
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = 3 + r() * 7;
    const x = sx + Math.cos(a) * d;
    const z = sz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1.5) || ctx.h(x, z) < 3) continue;
    ctx.place(x, z, 0.3);
    palm(b, x, z, 1.1 + r() * 0.4, Math.PI * 0.1 + (r() - 0.5) * 0.3, r, 2.6);
    ctx.solids.add(x, z, 0.45);
  }
  // Boulders at the cliff edge
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = 12 + r() * 6;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d * 0.8;
    const h = ctx.h(x, z);
    if (h < -0.8 || h > 4 || !ctx.clear(x, z, 1.5)) continue;
    boulder(ctx, x, z, 1.2 + r() * 1.4, [0x7d8ea4, 0x6c7c92][i % 2]);
  }
  b.lift = 0;
}

// ───────────────────────── Open sea ─────────────────────────

function offshore(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const S = ctx.layout.size;
  // Small islands beyond the map: sand, reef rocks and coconut palms (southern half)
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.05 + (i / 8) * 0.9) + (r() - 0.5) * 0.2;
    const d = S * (1.25 + r() * 0.45);
    const x = Math.cos(a) * d * 1.1;
    const z = Math.sin(a) * d * 0.9 + 10;
    const s = 1 + r() * 0.8;
    b.lift = 0;
    const isl = new THREE.CylinderGeometry(5 * s, 7 * s, 1.0, 14);
    b.add(isl, 0xead9ac, M(x, 0.1, z), false);
    b.add(new THREE.RingGeometry(6.8 * s, 8.4 * s, 22).rotateX(-Math.PI / 2), 0xffffff, M(x, 0.05, z), false);
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
      b.lift = 0.5;
      palm(b, x + (r() - 0.5) * 5 * s, z + (r() - 0.5) * 5 * s, (1.6 + r() * 0.6) * s, r() * 6, r);
    }
    b.lift = 0.3;
    reefRock(b, x + 3 * s, z + 2 * s, 1.4 * s, r);
  }
  // Sea stacks beyond the map
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = S * (1.1 + r() * 0.3);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z < -S * 0.6) continue;
    b.lift = -0.5;
    seaStack(b, x, z, 2.2 + r() * 1.4, r);
  }
  b.lift = 0;
  // Fishing boats in the inner bay and the open sea (slowly circling the archipelago) and seagulls
  gulls(ctx, TOWN[0] - 16, 16, TOWN[1] - 18, 7, 8, 16, -0.09);
  gulls(ctx, WRECK[0], 14, WRECK[1], 6, 6, 12, 0.1);
  gulls(ctx, REEF.x + 30, 18, REEF.z + 60, 5, 20, 30, 0.05);
}

export function buildSouth(ctx: FieldCtx): WildOut {
  const out: WildOut = { flags: [], lights: [] };
  boardwalks(ctx, out);
  whaleBones(ctx, out);
  springPond(ctx, out);
  atoll(ctx, out);
  wreck(ctx, out);
  cape(ctx, out);
  beaches(ctx);
  offshore(ctx);
  void fbm;
  return out;
}
