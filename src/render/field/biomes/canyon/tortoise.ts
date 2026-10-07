// The sleeping giant tortoise: the head and neck that stretch out from under the shell with the chin resting on the valley
// floor, two forelegs propping up in front of the shell, and a ring of upturned marginal scutes along the shell rim; amber light
// shows through the closed eye slits (it is about to wake), and every so often the nostrils puff out a cloud of dust. In
// front of the chin is a small shrine the dwarves keep.

import * as THREE from 'three';
import { rope } from '../../../arenas/_woods.ts';
import { glowGroup, type FieldCtx } from '../../kit.ts';
import { SHELL, SPOT, rampAt, shellProfile } from './geo.ts';
import { COL, MX, frame, local } from './pal.ts';

const sphere = () => new THREE.SphereGeometry(1, 16, 11);
const lowSphere = () => new THREE.SphereGeometry(1, 10, 7);

export function buildTortoise(ctx: FieldCtx): void {
  head(ctx);
  for (const s of [-1, 1]) leg(ctx, s);
  shellLip(ctx);
  shrine(ctx);
}

/** Head and neck: in local coordinates +z points north (toward the tip of the nose) */
function head(ctx: FieldCtx): void {
  const { b } = ctx;
  const [hx, hz] = SPOT.head;
  const face = Math.PI;
  const y0 = ctx.place(hx, hz, 3);
  b.lift = 0;
  const F = frame(hx, hz, face);
  const E = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, rx = 0, rz = 0, ry = 0) => {
    const [x, z] = local(hx, hz, face, lx, lz);
    return MX(x, y0 + ly, z, sx, sy, sz, face + ry, rx, rz);
  };
  // Neck: three segments, the last one tucking under the shell rim
  b.add(sphere(), COL.skin, E(0, 4.6, -6.5, 4.6, 4.0, 5.0));
  b.add(sphere(), COL.skin, E(0, 5.3, -11, 5.0, 4.5, 4.6));
  b.add(sphere(), COL.skinDk, E(0, 5.6, -15, 5.4, 4.6, 4.2));
  for (const [lz, r] of [[-8.6, 4.35], [-12.9, 4.8]] as const) {
    const g = new THREE.TorusGeometry(r, 0.5, 6, 22);
    b.add(g, COL.skinDk, E(0, 5.0, lz, 1, 0.92, 1));
  }
  // Skull, snout, horny beak
  b.add(sphere(), COL.skin, E(0, 4.4, 0, 6.0, 4.4, 7.0));
  b.add(sphere(), COL.skin, E(0, 3.9, 5.0, 4.1, 3.0, 4.2));
  b.add(sphere(), COL.skinLt, E(0, 4.1, 7.2, 2.5, 1.3, 2.6, -0.25));
  const beak = new THREE.ConeGeometry(1.4, 2.6, 7);
  b.add(beak, COL.beak, E(0, 2.4, 8.3, 1.05, 1, 0.8, Math.PI - 0.35));
  b.add(sphere(), COL.skinDk, E(0, 1.3, 3.5, 4.7, 1.5, 5.1));
  b.add(sphere(), COL.beak, E(0, 1.1, 7.4, 2.3, 0.95, 1.9));
  // Mouth line
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.16, 0.14, 7.6), 0x2e2a22, E(s * 3.55, 2.35, 3.6, 1, 1, 1, 0, 0, s * 0.3), false);
  // Eyes: bulging at the front of the skull (visible from the front and the side), heavy eyelids closed, amber light showing
  // through the eye slits
  const slits: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const [ex, ey, ez] = [s * 4.55, 4.75, 3.25];
    b.add(sphere(), COL.skinDk, E(ex, ey, ez, 1.45, 1.3, 1.5));
    // Heavy upper eyelids pressed down, so it looks deeply asleep
    b.add(sphere(), COL.skinLt, E(ex * 0.98, ey + 0.42, ez + 0.05, 1.55, 0.95, 1.6, 0.1, s * 0.18));
    // Eye slit: an arc along the eyeball surface, facing the front
    const A = 2.1;
    const th = s * 0.8;
    const g = new THREE.TorusGeometry(1.5, 0.13, 4, 14, A);
    g.rotateX(-Math.PI / 2);
    g.rotateY(th - (Math.PI / 2 + A / 2));
    g.applyMatrix4(E(ex, ey - 0.05, ez, 1, 1, 1));
    slits.push(g);
  }
  const setEyes = glowGroup(ctx.group, ctx.disposers, COL.rune, slits);
  // Mouth line seen from the front (curving back from both sides of the beak)
  {
    const g = new THREE.TorusGeometry(1, 0.05, 4, 20, Math.PI * 0.9);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-(Math.PI / 2 + Math.PI * 0.45));
    g.scale(3.56, 1.6, 3.7);
    b.add(g, 0x2e2a22, E(0, 2.3, 4.9, 1, 1, 1), false);
  }
  // Nostrils
  const nost: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    b.add(lowSphere(), 0x2a241c, E(s * 1.05, 5.2, 8.7, 0.5, 0.36, 0.34), false);
    const [nx, nz] = local(hx, hz, face, s * 1.05, 9.2);
    nost.push(new THREE.Vector3(nx, y0 + 5.2, nz));
  }
  // Large scales on top of the head, moss and a few small shrubs (it has slept so long that things grow on its head)
  for (const [lx, ly, lz, s] of [[0, 8.55, -1, 1.2], [2.3, 8.2, 0.8, 1.0], [-2.3, 8.2, 0.8, 1.0], [2.5, 7.9, -2.8, 1.0], [-2.5, 7.9, -2.8, 1.0], [0, 8.1, 2.6, 0.9], [0, 8.6, -7, 1.3], [2.6, 8.4, -8.4, 1.1], [-2.6, 8.4, -8.4, 1.1]] as const) {
    const g = new THREE.DodecahedronGeometry(1, 0);
    b.add(g, COL.skinLt, E(lx, ly, lz, s * 1.2, s * 0.38, s * 1.2, 0.08 * lx, 0.05 * lz));
  }
  for (const [lx, ly, lz] of [[-1.2, 8.7, -3.6], [1.8, 8.5, -5.4], [-2.2, 9.2, -10.5], [1.4, 9.6, -12.2], [0.4, 8.6, 1.6]] as const) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    b.add(g, COL.moss, E(lx, ly, lz, 1.3, 0.35, 1.1), false);
  }
  for (const [lx, ly, lz, s] of [[1.2, 9.2, -10, 0.8], [-1.6, 9.8, -13, 0.65]] as const) {
    const [x, z] = local(hx, hz, face, lx, lz);
    b.add(new THREE.CylinderGeometry(0.08, 0.14, 1.4, 5), COL.bark, MX(x, y0 + ly + 0.6 * s, z, s, s, s));
    b.add(new THREE.IcosahedronGeometry(0.9, 0), COL.juniper[0], MX(x, y0 + ly + 1.6 * s, z, s * 1.2, s * 0.8, s * 1.2));
  }
  void F;
  // Collision
  for (const [lz, r] of [[8.4, 2.2], [5, 4.2], [0, 6.2], [-6.5, 4.8], [-11, 5.2], [-15, 5.4]] as const) {
    const [x, z] = local(hx, hz, face, 0, lz);
    ctx.solids.add(x, z, r);
  }

  // Breathing: the eye-slit light brightens and dims with the breath, and the nostrils puff out dust on the exhale
  // After purification the tower base is mended and the tortoise falls into a deep sleep again: only a faint glow is left in the
  // eye slits and the breathing slows
  const calm = ctx.done >= ctx.floors;
  const period = calm ? 11 : 7.5;
  let last = 0;
  ctx.extras.push((_dt, t, vfx) => {
    const cyc = (t % period) / period;
    const breath = Math.sin(cyc * Math.PI * 2);
    setEyes(calm ? 0.35 + 0.2 * Math.max(0, breath) : 1.3 + 0.9 * Math.max(0, breath) + 0.25 * Math.sin(t * 1.7));
    if (cyc > 0.55 && last <= 0.55 && vfx.camPos.distanceTo(nost[0]) < 90) {
      for (const p of nost) {
        vfx.smoke({ pos: p, count: 7, color: [0xe6c59a, 0xd2a878], speed: [1.6, 3.2], dir: new THREE.Vector3(0, -0.35, -1), spread: 0.35, life: [1.6, 2.6], size: [0.5, 0.9], sizeEnd: 3.2, drag: 0.6, intensity: 0.8 });
      }
    }
    last = cyc;
  });
}

/** Foreleg: a thick columnar leg, foot, five claws and scales; s = -1 left, 1 right */
function leg(ctx: FieldCtx, s: number): void {
  const { b } = ctx;
  const [cx, cz, R] = SHELL;
  const ang = s * (62 * Math.PI) / 180;
  const fx = cx + Math.sin(ang) * (R + 2.6);
  const fz = cz - Math.cos(ang) * (R + 2.6);
  const face = Math.atan2(fx - cx, fz - cz);
  const y0 = ctx.place(fx, fz, 2);
  b.lift = 0;
  const E = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, rx = 0, rz = 0) => {
    const [x, z] = local(fx, fz, face, lx, lz);
    return MX(x, y0 + ly, z, sx, sy, sz, face, rx, rz);
  };
  b.add(sphere(), COL.skinDk, E(0, 1.1, 0.6, 4.5, 1.9, 4.8));
  b.add(new THREE.CylinderGeometry(3.1, 3.7, 6.5, 12), COL.skin, E(0, 4.2, -1.2, 1, 1, 1, -0.32));
  b.add(sphere(), COL.skin, E(0, 6.6, -2.8, 3.4, 2.4, 3.2));
  // Large scales at the front of the leg
  for (const [lx, ly, lz, sc] of [[0, 2.8, 2.4, 1.1], [-1.9, 2.4, 1.9, 0.9], [1.9, 2.4, 1.9, 0.9], [0, 4.4, 1.7, 1.0], [-1.7, 4.8, 1.0, 0.85], [1.7, 4.8, 1.0, 0.85], [0, 6.0, 0.9, 0.9]] as const) {
    b.add(new THREE.DodecahedronGeometry(1, 0), COL.skinLt, E(lx, ly, lz, sc, sc * 0.9, sc * 0.45, -0.3));
  }
  // Claws
  for (let i = 0; i < 5; i++) {
    const lx = (i - 2) * 1.25;
    const lz = 4.5 - Math.abs(i - 2) * 0.55;
    b.add(new THREE.ConeGeometry(0.52, 1.7, 6), COL.horn, E(lx, 0.62, lz, 1, 1, 0.75, Math.PI / 2 + 0.28, -lx * 0.08));
  }
  ctx.solids.add(fx, fz + 0, 4.6);
  const [kx, kz] = local(fx, fz, face, 0, -3);
  ctx.solids.add(kx, kz, 3.8);
}

/**
 * Shell rim: a ring of marginal scutes flaring outward and curling down (adds a three-dimensional edge on the terrain's shell)
 */
function shellLip(ctx: FieldCtx): void {
  const { b } = ctx;
  const [cx, cz, R] = SHELL;
  const n = 34;
  const legs = [-1, 1].map((s) => {
    const a = (s * 62 * Math.PI) / 180;
    return [cx + Math.sin(a) * R, cz - Math.cos(a) * R];
  });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.05;
    const r = R + 0.3;
    const x = cx + Math.sin(a) * r;
    const z = cz - Math.cos(a) * r;
    if (z > 96) continue;
    if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) > 0) continue; // neck
    if (rampAt(x, z)[0] < 7) continue;
    if (legs.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 6.5)) continue;
    if (Math.abs(x - 31) < 4 && Math.abs(z - cz) < 4) continue; // lift
    // The marginal scutes cover the ring where the shell rim drops straight down: upper edge tucked slightly in, lower edge
    // flaring out
    const top = shellProfile(R - 0.6);
    const bot = ctx.h(x + Math.sin(a) * 0.8, z - Math.cos(a) * 0.8) - 0.3;
    const hh = top - bot + 0.4;
    const F = frame(x, z, Math.atan2(Math.sin(a), -Math.cos(a)));
    b.lift = 0;
    // Plump, rounded marginal scutes (flattened ellipsoids, overlapping each other a little)
    const w = (2 * Math.PI * r) / n;
    const m = F(0, bot + hh / 2, 0.1, 0, 1, -0.2).multiply(new THREE.Matrix4().makeScale(w * 0.62, hh * 0.54, 0.6));
    b.add(new THREE.SphereGeometry(1, 14, 9), i % 2 ? COL.shellDk : COL.shellLt, m);
  }
}

/**
 * The small shrine in front of the tortoise's chin: stone platform, offerings, candle flames, two stone lanterns and prayer
 * flags hung to the tip of the nose
 */
function shrine(ctx: FieldCtx): void {
  const { b } = ctx;
  const ax = -5.5;
  const az = 15.5;
  const ay = ctx.place(ax, az, 1.2);
  const F = frame(ax, az, Math.atan2(SPOT.head[0] - ax, SPOT.head[1] - az));
  b.add(new THREE.BoxGeometry(2.6, 0.5, 1.7), COL.stoneDk, F(0, 0.25, 0));
  b.add(new THREE.BoxGeometry(2.2, 0.7, 1.3), COL.stone, F(0, 0.85, 0));
  b.add(new THREE.BoxGeometry(2.5, 0.16, 1.55), COL.stone2, F(0, 1.27, 0));
  const flames: THREE.BufferGeometry[] = [];
  for (const lx of [-0.8, 0.8]) {
    b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 6), 0xf2e6d0, F(lx, 1.55, -0.3), false);
    const g = new THREE.ConeGeometry(0.07, 0.2, 6);
    g.applyMatrix4(F(lx, 1.85, -0.3));
    g.translate(0, ay, 0);
    flames.push(g);
  }
  for (const [lx, c] of [[-0.3, 0xe2503a], [0.05, 0xf2b040], [0.35, 0x8ab04a]] as const) b.add(new THREE.IcosahedronGeometry(0.17, 0), c, F(lx, 1.48, 0.2), false);
  b.add(new THREE.CylinderGeometry(0.3, 0.22, 0.18, 8), COL.bronze, F(0, 1.44, -0.1));
  const setFlame = glowGroup(ctx.group, ctx.disposers, 0xffb050, flames);
  // Stone lanterns
  for (const [lx, lz] of [[-3.2, 0.6], [3.2, 0.6]] as const) {
    const [x, z] = local(ax, az, Math.atan2(SPOT.head[0] - ax, SPOT.head[1] - az), lx, lz);
    ctx.place(x, z, 0.6);
    b.add(new THREE.BoxGeometry(0.9, 0.4, 0.9), COL.stoneDk, MX(x, 0.2, z, 1, 1, 1));
    b.add(new THREE.CylinderGeometry(0.28, 0.34, 1.2, 6), COL.stone, MX(x, 1.0, z, 1, 1, 1));
    b.add(new THREE.BoxGeometry(0.85, 0.7, 0.85), COL.stone2, MX(x, 1.95, z, 1, 1, 1));
    b.glow(new THREE.BoxGeometry(0.5, 0.42, 0.9), COL.win, MX(x, 1.95, z, 1, 1, 1));
    b.add(new THREE.ConeGeometry(0.75, 0.55, 4), COL.stoneDk, MX(x, 2.58, z, 1, 1, 1, Math.PI / 4));
    ctx.solids.add(x, z, 0.55);
  }
  ctx.solids.add(ax, az, 1.3);
  // Prayer flags: strung from the bridge of the nose to the flagpole
  const [px, pz] = [-11, 12.5];
  const py = ctx.place(px, pz, 0.3);
  b.add(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), COL.wood, MX(px, 2.6, pz, 1, 1, 1));
  ctx.solids.add(px, pz, 0.3);
  b.lift = 0;
  const [sx, sz] = local(SPOT.head[0], SPOT.head[1], Math.PI, -1.2, 5.6);
  const a = new THREE.Vector3(sx, ctx.h(SPOT.head[0], SPOT.head[1]) + 6.6, sz);
  const c = new THREE.Vector3(px, py + 5.1, pz);
  rope(b, a, c, 1.1, 0.03, 0x6a5a48, false, 12);
  const flagCols = [0xd8483a, 0xf0c050, 0x4aa0c0, 0xf2ead8, 0x6ab04a];
  for (let i = 1; i < 12; i++) {
    const u = i / 12;
    const p = a.clone().lerp(c, u);
    p.y -= 1.1 * 4 * u * (1 - u);
    const g = new THREE.CylinderGeometry(0.34, 0.001, 0.62, 3, 1);
    b.add(g, flagCols[i % flagCols.length], MX(p.x, p.y - 0.33, p.z, 1, 1, 0.12, Math.atan2(c.x - a.x, c.z - a.z) + Math.PI / 2), false);
  }
  ctx.extras.push((_dt, t) => setFlame(2 + Math.sin(t * 11) * 0.3 + Math.sin(t * 5.3) * 0.2));
}
