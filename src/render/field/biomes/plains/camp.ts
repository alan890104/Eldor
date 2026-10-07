// Nomad Camp: a ring of yurts around a central campfire, with the chieftain's great tent on the side facing the camp gate;
// the gate is two thunderbird totem poles with a rope hung with cloth strips strung between them;
// at the camp's center stands a long copper-crowned lightning rod (struck by lightning now and then),
// to the west is the horse corral, felt and cloth are strung out to dry between the tents,
// and outside the camp stand carts loaded with belongings, ready to migrate at any moment.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { rope, segM, V } from '../../../arenas/_woods.ts';
import { crates, fence, type FieldCtx } from '../../kit.ts';
import { WIND, type ClothSet } from './cloth.ts';
import { TOWER_DIR, TOWN } from './land.ts';
import { C, cart, firePit, ovoo, totem, yurt } from './props.ts';

const [TX, TZ] = TOWN;
/** Direction from the town to the Seal Tower (the camp gate opens on this side) */
const TD: [number, number] = [-TOWER_DIR[0], -TOWER_DIR[1]];
/** Camp gate direction (toward the Seal Tower) */
const ENT = Math.atan2(TD[1], TD[0]);
const polar = (a: number, d: number): [number, number] => [TX + Math.cos(ENT + a) * d, TZ + Math.sin(ENT + a) * d];
/** Angle facing the camp center (yaw, 0 faces +z) */
const faceCenter = (x: number, z: number) => Math.atan2(TX - x, TZ - z);

export const CORRAL: [number, number] = [-73, 71];
export const MAST: [number, number] = [TX + 2.5, TZ + 7.5];
export const GREAT = polar(Math.PI, 14.2);

export interface CampOut {
  /** Top of the lightning rod (strike point) */
  mastTip: THREE.Vector3;
  /** Per-frame update (campfire, cooking smoke) */
  tick: (dt: number, t: number, vfx: import('../../../vfx.ts').Vfx) => void;
}

export function buildCamp(ctx: FieldCtx, cloth: ClothSet): CampOut {
  const { b, r, group, disposers } = ctx;

  // ── Yurts: a ring of eight plus the chieftain's great tent
  const chimneys: THREE.Vector3[] = [];
  const ring: [number, number, number][] = [
    [0.86, 13, 2.9],
    [1.52, 13.4, 3.1],
    [2.18, 13, 2.8],
    [4.12, 13.2, 3.0],
    [4.8, 12.8, 2.7],
    [5.46, 13.3, 3.1],
  ];
  ring.forEach(([a, d, R], i) => {
    const [x, z] = polar(a, d);
    chimneys.push(yurt(ctx, x, z, faceCenter(x, z) + (r() - 0.5) * 0.25, R, { lamp: i % 2 === 0, roof: i % 3 === 2 ? C.roof2 : C.roof }));
  });
  chimneys.push(yurt(ctx, GREAT[0], GREAT[1], faceCenter(GREAT[0], GREAT[1]), 4.4, { lamp: true, great: true }));
  // A few more small tents scattered around the camp's outskirts (family branches)
  for (const [a, d, R] of [
    [2.75, 22, 2.5],
    [3.55, 23, 2.4],
    [1.2, 22, 2.3],
  ] as const) {
    const [x, z] = polar(a, d);
    chimneys.push(yurt(ctx, x, z, faceCenter(x, z) + 0.4, R, { roof: C.roof2 }));
  }

  // ── Sulde on either side of the great tent (horsehair spear banners)
  {
    const ga = Math.atan2(GREAT[1] - TZ, GREAT[0] - TX);
    for (const s of [-1, 1]) {
      const x = GREAT[0] + Math.cos(ga + (s * Math.PI) / 2) * 6.2 - Math.cos(ga) * 1.5;
      const z = GREAT[1] + Math.sin(ga + (s * Math.PI) / 2) * 6.2 - Math.sin(ga) * 1.5;
      ctx.place(x, z, 0.5);
      b.add(new THREE.CylinderGeometry(0.5, 0.6, 0.5, 8), C.stoneDark, M(x, 0.2, z));
      b.add(new THREE.CylinderGeometry(0.06, 0.08, 5.6, 6), C.woodDark, M(x, 2.9, z));
      b.add(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12), C.gold, M(x, 5.0, z));
      b.add(new THREE.ConeGeometry(0.42, 1.1, 10, 1, true), C.metal, M(x, 4.45, z, 0, 1, Math.PI));
      b.add(new THREE.ConeGeometry(0.07, 0.8, 5), C.bronze, M(x, 6.05, z));
      for (const k of [-1, 1]) b.add(new THREE.ConeGeometry(0.05, 0.45, 5), C.bronze, M(x + k * 0.18, 5.8, z, 0, 1, 0, -k * 0.35));
      ctx.solids.add(x, z, 0.5);
    }
  }

  // ── Camp gate: two totem poles with a rope hung with cloth strips strung between them
  const gx = TX + TD[0] * 16.5;
  const gz = TZ + TD[1] * 16.5;
  const px = -TD[1];
  const pz = TD[0];
  const tops: THREE.Vector3[] = [];
  for (const s of [-1, 1]) tops.push(totem(ctx, gx + px * s * 3.6, gz + pz * s * 3.6, Math.atan2(TD[0], TD[1]), 5.6));
  b.lift = 0;
  {
    const a = tops[0].clone().add(V(0, -1.2, 0));
    const c = tops[1].clone().add(V(0, -1.2, 0));
    rope(b, a, c, 0.55, 0.035, C.rope, false, 12);
    const cols = [0x3a6ad0, 0xf2efe6, 0xc8433a, 0xe8c44a, 0x4a9a52, 0x3a6ad0, 0xc8433a];
    for (let i = 1; i < 12; i++) {
      const u = i / 12;
      const p = a.clone().lerp(c, u).setY(a.y + (c.y - a.y) * u - 0.55 * 4 * u * (1 - u));
      cloth.strip(p, 0.9 + r() * 0.5, 0.2, cols[i % cols.length]);
    }
  }

  // ── Central campfire: stone ring, woodpile, log benches, hanging pot
  firePit(ctx, TX, TZ, false);
  ctx.place(TX, TZ);
  b.add(new THREE.CylinderGeometry(0.12, 0.14, 1.3, 5), C.woodDark, M(TX, 0.4, TZ, 0.3, 1, 0, Math.PI / 2 - 0.5));
  b.add(new THREE.CylinderGeometry(0.12, 0.14, 1.3, 5), C.woodDark, M(TX, 0.4, TZ, 2.4, 1, 0, Math.PI / 2 - 0.5));
  for (let i = 0; i < 5; i++) {
    const a = ENT + 0.9 + i * 1.05;
    const x = TX + Math.cos(a) * 3.7;
    const z = TZ + Math.sin(a) * 3.7;
    ctx.place(x, z, 1);
    // Logs laid along the tangent of the fire
    b.add(new THREE.CylinderGeometry(0.26, 0.28, 2.1, 8), 0x6b4a30, M(x, 0.26, z, Math.PI / 2 - a, 1, 0, Math.PI / 2));
    ctx.solids.add(x, z, 0.7);
  }
  {
    const [cx, cz] = polar(-1.3, 2.6);
    ctx.place(cx, cz, 0.6);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      b.add(new THREE.CylinderGeometry(1, 1, 1, 5), C.woodDark, segM(V(cx + Math.cos(a) * 0.75, -0.1, cz + Math.sin(a) * 0.75), V(cx, 2.1, cz), 0.04));
    }
    b.add(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), C.metal, M(cx, 1.05, cz));
    b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 10), 0x6a5a48, M(cx, 1.03, cz), false);
    b.glow(new THREE.CircleGeometry(0.3, 8), 0xff8a3a, M(cx, 0.12, cz, 0, 1, -Math.PI / 2));
  }

  // ── Lightning rod: the tallest thing in the middle of the camp, its copper crown hung with bells and ribbons,
  // held down by three guy lines
  const [mx, mz] = MAST;
  const my = ctx.place(mx, mz, 0.6);
  const MH = 11.5;
  b.add(new THREE.CylinderGeometry(0.7, 0.85, 0.5, 8), C.stoneDark, M(mx, 0.15, mz));
  b.add(new THREE.CylinderGeometry(0.11, 0.2, MH, 7), C.woodDark, M(mx, MH / 2, mz));
  for (const f of [0.3, 0.55, 0.8]) b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 7), C.bronze, M(mx, MH * f, mz));
  b.add(new THREE.TorusGeometry(0.55, 0.06, 5, 16), C.bronze, M(mx, MH + 0.1, mz, 0, 1, Math.PI / 2));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    b.add(new THREE.ConeGeometry(0.06, 0.8, 5), C.copper, M(mx + Math.cos(a) * 0.5, MH + 0.45, mz + Math.sin(a) * 0.5, 0, 1, Math.sin(a) * 0.3, -Math.cos(a) * 0.3));
    b.add(new THREE.ConeGeometry(0.1, 0.18, 6), C.gold, M(mx + Math.cos(a) * 0.55, MH - 0.2, mz + Math.sin(a) * 0.55));
  }
  b.add(new THREE.ConeGeometry(0.12, 1.4, 6), C.copper, M(mx, MH + 0.8, mz));
  b.glow(new THREE.OctahedronGeometry(0.22), C.spark, M(mx, MH + 1.6, mz));
  b.lift = 0;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const sx = mx + Math.cos(a) * 4.2;
    const sz = mz + Math.sin(a) * 4.2;
    const sy = ctx.h(sx, sz);
    b.add(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 5), C.wood, M(sx, sy + 0.2, sz));
    rope(b, V(mx, my + MH * 0.72, mz), V(sx, sy + 0.5, sz), 0.2, 0.025, C.rope, false, 8);
  }
  for (let k = 0; k < 4; k++) cloth.strip(V(mx, my + MH * 0.55 - k * 0.1, mz), 1.6 + r() * 0.6, 0.16, [0x3a6ad0, 0xf2efe6, 0xe8c44a, 0xc8433a][k]);
  ctx.solids.add(mx, mz, 0.8);

  // ── Flagpole: a long indigo flag with a gold stripe through the middle
  const poles: [number, number, number][] = [
    [...polar(0.52, 9.5), 6.2],
    [...polar(-0.52, 9.5), 6.2],
    [...polar(3.6, 18.5), 5.2],
    [...polar(2.5, 18.5), 5.2],
  ];
  for (const [x, z, h] of poles) {
    ctx.place(x, z);
    b.add(new THREE.CylinderGeometry(0.06, 0.09, h, 6), C.woodDark, M(x, h / 2, z));
    b.add(new THREE.ConeGeometry(0.1, 0.4, 6), C.gold, M(x, h + 0.2, z));
    const y = ctx.h(x, z);
    cloth.flag(x, z, y + h - 2.0, y + h - 0.15, WIND.clone().applyAxisAngle(V(0, 1, 0), (r() - 0.5) * 0.3), 2.6, C.roof, r() * 6, C.gold);
    ctx.solids.add(x, z, 0.3);
  }

  // ── Felt and cloth hung to dry: ropes strung between the tents
  const lines: [number, number][] = [
    [1.2, 9.2],
    [4.45, 9.4],
    [5.85, 9.6],
    [2.6, 9.4],
  ];
  const felts = [0xe8d8b6, 0xc8433a, 0x3c4a8c, 0xe8c44a, 0xf2efe6, 0x8a5a3a, 0x4a9a52, 0xd0662e];
  for (const [a, d] of lines) {
    const [cx, cz] = polar(a, d);
    const ta = ENT + a + Math.PI / 2;
    const ends: THREE.Vector3[] = [];
    for (const s of [-1, 1]) {
      const x = cx + Math.cos(ta) * s * 2.7;
      const z = cz + Math.sin(ta) * s * 2.7;
      const y = ctx.place(x, z);
      b.add(new THREE.BoxGeometry(0.12, 2.3, 0.12), C.wood, M(x, 1.1, z));
      b.add(new THREE.BoxGeometry(0.5, 0.08, 0.08), C.wood, M(x, 2.15, z, ta));
      ends.push(V(x, y + 2.15, z));
      ctx.solids.add(x, z, 0.25);
    }
    b.lift = 0;
    rope(b, ends[0], ends[1], 0.18, 0.02, C.rope, false, 8);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const u0 = 0.08 + (i / n) * 0.86;
      const u1 = u0 + 0.86 / n - 0.04;
      const pt = (u: number) => ends[0].clone().lerp(ends[1], u).setY(ends[0].y + (ends[1].y - ends[0].y) * u - 0.18 * 4 * u * (1 - u) - 0.02);
      const long = r() < 0.4;
      cloth.hang(pt(u0), pt(u1), long ? 1.4 : 0.8 + r() * 0.3, felts[Math.floor(r() * felts.length)], r() * 6, long ? 0.18 : 0.3);
    }
  }

  // ── Horse corral: a ring of wooden fence, water trough, hay piles; the gate faces the camp
  {
    const [cx, cz] = CORRAL;
    const R = 7;
    const n = 12;
    const gate = Math.atan2(TZ - cz, TX - cx);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      let da = mid - gate;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.3) continue;
      fence(ctx, [cx + Math.cos(a0) * R, cz + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cz + Math.sin(a1) * R], 0x8a6a42);
      ctx.solids.add(cx + Math.cos(mid) * R, cz + Math.sin(mid) * R, 1.3);
    }
    const [wx, wz] = [cx - 2.5, cz + 2.2];
    ctx.place(wx, wz, 1);
    b.add(new THREE.BoxGeometry(2.6, 0.55, 0.8), C.woodDark, M(wx, 0.3, wz, 0.4));
    b.add(new THREE.BoxGeometry(2.4, 0.06, 0.62), 0x3a5a7a, M(wx, 0.52, wz, 0.4), false);
    ctx.solids.add(wx, wz, 1.2);
    for (const [hx, hz, rot] of [
      [cx + 3, cz - 3, 0.3],
      [cx + 3.9, cz - 1.6, 1.2],
      [cx - 3.5, cz - 3, 2],
    ] as const) {
      ctx.place(hx, hz, 0.6);
      b.add(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 10), C.hay, M(hx, 0.55, hz, rot, 1, 0, Math.PI / 2));
      for (const o of [-0.26, 0.26]) b.add(new THREE.TorusGeometry(0.56, 0.04, 4, 12), C.rope, M(hx, 0.55, hz, rot, 1, 0, Math.PI / 2).multiply(M(0, o, 0, 0, 1, Math.PI / 2)), false);
      ctx.solids.add(hx, hz, 0.7);
    }
    // Hitching posts
    for (let k = 0; k < 3; k++) {
      const a = gate + (k - 1) * 0.5;
      const x = cx + Math.cos(a) * (R + 2.2);
      const z = cz + Math.sin(a) * (R + 2.2);
      ctx.place(x, z);
      b.add(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 6), C.wood, M(x, 0.7, z));
      cloth.strip(V(x, ctx.h(x, z) + 1.35, z), 0.7, 0.12, [0x3a6ad0, 0xc8433a, 0xe8c44a][k]);
      ctx.solids.add(x, z, 0.2);
    }
  }

  // ── Carts: a few parked outside the camp, loaded with belongings, ready to migrate at any moment
  for (const [x, z, f, load] of [
    [-66, 90, 2.2, true],
    [-61, 95, 2.6, true],
    [-31, 73, -0.6, true],
    [-70, 84, 1.7, false],
  ] as const) {
    cart(ctx, x, z, f, load);
  }
  // Crates, barrels
  for (const [a, d] of [
    [1.15, 10.2],
    [3.9, 10.4],
    [5.2, 10.6],
  ] as const) {
    const [x, z] = polar(a, d);
    crates(ctx, x, z, 0x8a5a32, 0x5a3c26);
  }

  // ── Small ovoo outside the camp (on the little hill to the camp's northwest)
  ovoo(ctx, cloth, TX - 15, TZ - 17, 1.7);

  b.lift = 0;

  // ── Campfire: animated flames, sparks and smoke
  const flames = new THREE.Group();
  flames.position.set(TX, ctx.h(TX, TZ) + 0.2, TZ);
  const mats: THREE.MeshBasicMaterial[] = [];
  const cone = (rad: number, hh: number, col: number, inten: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(inten), toneMapped: false });
    mats.push(m);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(rad, hh, 7), m);
    mesh.position.y = hh / 2;
    flames.add(mesh);
    return mesh;
  };
  const f1 = cone(0.62, 1.7, 0xff5a18, 1.5);
  const f2 = cone(0.4, 1.3, 0xffa62a, 2.0);
  const f3 = cone(0.2, 0.85, 0xfff0a8, 2.6);
  group.add(flames);
  disposers.push(() => {
    for (const m of mats) m.dispose();
    flames.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  });
  let sparkT = 0;
  let smokeT = 0;
  let chimT = 0;
  const fy = flames.position.y;
  const tick = (dt: number, t: number, vfx: import('../../../vfx.ts').Vfx) => {
    const near = Math.hypot(vfx.camPos.x - TX, vfx.camPos.z - TZ) < 110;
    flames.visible = near;
    if (!near) return;
    const n1 = Math.sin(t * 11.3) * 0.5 + Math.sin(t * 17.1 + 1.3) * 0.3 + Math.sin(t * 5.7 + 2.1) * 0.2;
    const n2 = Math.sin(t * 13.7 + 0.7) * 0.5 + Math.sin(t * 7.9 + 2.9) * 0.5;
    f1.scale.set(1 + n2 * 0.12, 0.88 + n1 * 0.22, 1 - n2 * 0.12);
    f2.scale.set(1 - n1 * 0.1, 0.9 + n2 * 0.25, 1 + n1 * 0.1);
    f3.scale.set(1, 0.85 + n1 * 0.3, 1);
    flames.rotation.y = t * 0.8;
    f1.position.x = n2 * 0.08 + 0.1;
    f2.position.z = n1 * 0.06;
    sparkT += dt;
    while (sparkT > 0.09) {
      sparkT -= 0.09;
      vfx.emit({ pos: V(TX, fy + 0.8, TZ), count: 1, color: [0xffb040, 0xff7a20, 0xfff0a0], speed: [1.4, 3.2], dir: V(WIND.x * 0.3, 1, WIND.z * 0.3), spread: 0.35, life: [0.8, 1.6], size: [0.06, 0.12], sizeEnd: 0.3, gravity: -0.6, drag: 0.6, radius: 0.3, intensity: 2 });
    }
    smokeT += dt;
    while (smokeT > 0.4) {
      smokeT -= 0.4;
      vfx.smoke({ pos: V(TX, fy + 1.8, TZ), count: 1, color: 0x3a3446, speed: [0.6, 1.0], dir: V(WIND.x * 0.5, 1, WIND.z * 0.5), spread: 0.25, life: [2.4, 3.6], size: [0.4, 0.6], sizeEnd: 3, drag: 0.35, radius: 0.2 });
    }
    // Cooking smoke from the tent chimneys
    chimT += dt;
    while (chimT > 0.6) {
      chimT -= 0.6;
      const c = chimneys[Math.floor(Math.random() * chimneys.length)];
      vfx.smoke({ pos: c.clone(), count: 1, color: 0x5a5466, speed: [0.4, 0.8], dir: V(WIND.x * 0.6, 1, WIND.z * 0.6), spread: 0.2, life: [2, 3], size: [0.25, 0.4], sizeEnd: 2.2, drag: 0.3, radius: 0.05 });
    }
  };

  return { mastTip: V(mx, my + MH + 1.6, mz), tick };
}
