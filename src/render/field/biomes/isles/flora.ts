// Props of Tidesong Isles: coconut palms, hibiscus bushes, coral, shells and starfish, driftwood, sea stacks, reef rocks,
// cedars, icicles, snow piles, floating ice.
// The props in the first half assume the ground is at y = 0 (first lift them onto the ground with ctx.place or b.lift);
// the section "Plants on the island" (olive, banana, agave, monstera, plumeria, beach grass, lantana, seagrass, pebbles,
// vine-covered rocks) takes the ground height y directly, so reset lift to zero before calling.

import * as THREE from 'three';
import { M, type PropBatch } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import type { ColorBatch } from './fx.ts';
import { put, T } from './parts.ts';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** Align the geometry's +Y to the direction (dx,dy,dz) and put its center at (x,y,z) */
export function along(x: number, y: number, z: number, dx: number, dy: number, dz: number, s = 1): THREE.Matrix4 {
  _q.setFromUnitVectors(UP, _v.set(dx, dy, dz).normalize());
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, s, s));
}

/** A basis matrix with yv as +Y and xv (after orthogonalization) as +X */
export function basisM(x: number, y: number, z: number, xv: THREE.Vector3, yv: THREE.Vector3): THREE.Matrix4 {
  const yy = yv.clone().normalize();
  const xx = xv.clone().addScaledVector(yy, -xv.dot(yy)).normalize();
  const zz = new THREE.Vector3().crossVectors(xx, yy);
  return new THREE.Matrix4().makeBasis(xx, yy, zz).setPosition(x, y, z);
}

/** A cylinder between two points (radius rad) */
export function seg(b: PropBatch, a: THREE.Vector3, c: THREE.Vector3, rad: number, col: number, sides = 5, outline = true, rad2 = rad): void {
  const d = new THREE.Vector3().subVectors(c, a);
  const len = d.length();
  if (len < 1e-4) return;
  b.add(new THREE.CylinderGeometry(rad2, rad, len, sides), col, along((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2, d.x, d.y, d.z), outline);
}

// ───────────────────────── South ─────────────────────────

const FRONDS = [0x3f9e4a, 0x52b85c, 0x6ccf6e];

/**
 * Coconut palm: a curved trunk, two drooping segments of fronds, a few coconuts. lean is the direction of the bend (radians, usually toward the sea),
 * and it returns the position of the treetop (for collision and lamp strings)
 */
export function palm(b: PropBatch, x: number, z: number, s: number, lean: number, r: () => number, bendK = 1): THREE.Vector3 {
  const bend = (0.14 + r() * 0.2) * bendK;
  const cx = Math.cos(lean);
  const cz = Math.sin(lean);
  let px = x;
  let py = 0;
  let pz = z;
  for (let j = 0; j < 7; j++) {
    const tilt = bend * (j + 1) * 0.2;
    const len = 0.7 * s;
    const dx = Math.sin(tilt) * cx;
    const dy = Math.cos(tilt);
    const dz = Math.sin(tilt) * cz;
    const rad = (0.26 - j * 0.02) * s;
    b.add(new THREE.CylinderGeometry(rad * 0.86, rad, len * 1.04, 7), j % 2 ? 0xa07a4c : 0x8c6840, along(px + (dx * len) / 2, py + (dy * len) / 2, pz + (dz * len) / 2, dx, dy, dz));
    px += dx * len;
    py += dy * len;
    pz += dz * len;
  }
  const n = 8 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const fx = Math.cos(a);
    const fz = Math.sin(a);
    const side = new THREE.Vector3(-fz, 0, fx);
    const col = FRONDS[i % 3];
    let qx = px;
    let qy = py + 0.1 * s;
    let qz = pz;
    for (let k = 0; k < 2; k++) {
      const pitch = k === 0 ? 0.42 - r() * 0.25 : -0.7 - r() * 0.4;
      const len = (k === 0 ? 1.2 : 1.05) * s;
      const dir = new THREE.Vector3(Math.cos(pitch) * fx, Math.sin(pitch), Math.cos(pitch) * fz);
      const g = new THREE.CylinderGeometry(k === 0 ? 0.32 * s : 0.02, k === 0 ? 0.14 * s : 0.32 * s, len, 4);
      g.scale(1, 1, 0.16);
      b.add(g, col, basisM(qx + (dir.x * len) / 2, qy + (dir.y * len) / 2, qz + (dir.z * len) / 2, side, dir));
      qx += dir.x * len;
      qy += dir.y * len;
      qz += dir.z * len;
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    b.add(new THREE.SphereGeometry(0.16 * s, 7, 5), 0x7a5a30, M(px + Math.cos(a) * 0.24 * s, py - 0.06 * s, pz + Math.sin(a) * 0.24 * s));
  }
  return new THREE.Vector3(px, py, pz);
}

/** A coconut palm that can be bumped into (placed on the ground) */
export function solidPalm(ctx: FieldCtx, x: number, z: number, s: number, lean: number, bendK = 1): void {
  ctx.place(x, z, 0.3);
  palm(ctx.b, x, z, s, lean, ctx.r, bendK);
  ctx.solids.add(x, z, 0.35 * s);
}

/** Tropical bush: a low clump of big leaves, dotted with hibiscus flowers */
export function tropicBush(ctx: FieldCtx, x: number, z: number, s: number, flower?: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, s * 0.4);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = s * 0.5 * r();
    const rr = s * (0.42 + r() * 0.3);
    const g = new THREE.IcosahedronGeometry(rr, 0);
    g.scale(1, 0.72, 1);
    b.add(g, [0x3f9a48, 0x55b454, 0x2f8a44][i % 3], M(x + Math.cos(a) * d, rr * 0.6, z + Math.sin(a) * d, r() * 6));
  }
  if (flower !== undefined) {
    const m = 3 + Math.floor(r() * 4);
    for (let i = 0; i < m; i++) {
      const a = r() * Math.PI * 2;
      const d = s * (0.3 + r() * 0.35);
      b.add(new THREE.ConeGeometry(0.13 * s, 0.14 * s, 5), flower, M(x + Math.cos(a) * d, s * (0.55 + r() * 0.35), z + Math.sin(a) * d, r() * 6, 1, Math.PI + (r() - 0.5), 0), false);
    }
  }
}

/**
 * Coral clump: four kinds, branching, brain, fan and tube, in vivid colors (can be placed in shallow water and is visible through the sea surface)
 */
export function coral(b: PropBatch, x: number, z: number, s: number, r: () => number, palette?: number[]): void {
  const kind = Math.floor(r() * 4);
  const pick = (a: number, c: number) => (palette ? palette[Math.floor(r() * palette.length)] : r() < 0.5 ? a : c);
  if (kind === 0) {
    const col = pick(0xff86b8, 0xff9a5a);
    const n = 5 + Math.floor(r() * 3);
    b.add(new THREE.CylinderGeometry(0.07 * s, 0.12 * s, 0.6 * s, 6), col, M(x, 0.3 * s, z));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      const up = 0.45 + r() * 0.6;
      const dir = new THREE.Vector3(Math.cos(a) * (1 - up), up, Math.sin(a) * (1 - up)).normalize();
      const len = (0.5 + r() * 0.4) * s;
      const by = (0.35 + r() * 0.25) * s;
      b.add(new THREE.CylinderGeometry(0.04 * s, 0.07 * s, len, 5), col, along(x + (dir.x * len) / 2, by + (dir.y * len) / 2, z + (dir.z * len) / 2, dir.x, dir.y, dir.z));
      const tip = new THREE.Vector3(x + dir.x * len, by + dir.y * len, z + dir.z * len);
      const dir2 = new THREE.Vector3(dir.x + (r() - 0.5) * 0.8, dir.y + 0.4, dir.z + (r() - 0.5) * 0.8).normalize();
      const len2 = len * 0.55;
      b.add(new THREE.CylinderGeometry(0.02 * s, 0.045 * s, len2, 5), col, along(tip.x + (dir2.x * len2) / 2, tip.y + (dir2.y * len2) / 2, tip.z + (dir2.z * len2) / 2, dir2.x, dir2.y, dir2.z));
    }
  } else if (kind === 1) {
    const col = pick(0xd8a0ff, 0xb6e07a);
    const g = new THREE.IcosahedronGeometry(0.5 * s, 1);
    g.scale(1, 0.62, 1);
    b.add(g, col, M(x, 0.28 * s, z, r() * 6));
    const g2 = new THREE.IcosahedronGeometry(0.3 * s, 1);
    g2.scale(1, 0.62, 1);
    b.add(g2, col, M(x + 0.45 * s, 0.17 * s, z + 0.2 * s, r() * 6));
  } else if (kind === 2) {
    const col = pick(0xa070ff, 0xff6a8a);
    const fan = new THREE.Shape();
    fan.absarc(0, 0, 0.55 * s, 0, Math.PI, false);
    fan.lineTo(-0.55 * s, 0);
    const ry = r() * Math.PI;
    b.add(new THREE.ExtrudeGeometry(fan, { depth: 0.06 * s, bevelEnabled: false, curveSegments: 8 }), col, M(x, 0.35 * s, z, ry));
    b.add(new THREE.CylinderGeometry(0.05 * s, 0.09 * s, 0.4 * s, 6), col, M(x, 0.2 * s, z));
  } else {
    const col = pick(0x5ce0d0, 0xffe27a);
    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const h = (0.3 + r() * 0.45) * s;
      const rr = i === 0 ? 0 : 0.17 * s;
      b.add(new THREE.CylinderGeometry(0.075 * s, 0.09 * s, h, 6), col, M(x + Math.cos(a) * rr, h / 2, z + Math.sin(a) * rr));
    }
  }
}

/** Starfish and shells: extremely thin solid shapes */
export function shell(b: PropBatch, x: number, z: number, r: () => number, s = 1): void {
  if (r() < 0.5) {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rr = i % 2 ? 0.13 : 0.3;
      if (i === 0) star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    star.closePath();
    const g = new THREE.ExtrudeGeometry(star, { depth: 0.07, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    b.add(g, [0xff7a5a, 0xffa060, 0xb890ff, 0xff9ec0][Math.floor(r() * 4)], M(x, 0.02, z, r() * 6, (1.2 + r() * 0.7) * s), false);
  } else {
    const sh = new THREE.Shape();
    sh.moveTo(-0.22, 0);
    for (let i = 1; i < 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI;
      const rr = 0.22 + (i % 2 ? 0.035 : 0);
      sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.lineTo(0.22, 0);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    b.add(g, [0xfff1e2, 0xffd8c8, 0xf7e2b0][Math.floor(r() * 3)], M(x, 0.02, z, r() * 6, (1.2 + r() * 0.7) * s), false);
  }
}

/** Driftwood: gray-white curved wood and a forked piece */
export function driftwood(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const a = r() * Math.PI;
  const len = (2 + r() * 1.5) * s;
  b.add(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, len, 6), 0xc8b8a0, M(x, 0.14 * s, z, a, 1, 0, Math.PI / 2 - 0.06));
  const bx = x + Math.cos(a) * len * 0.3;
  const bz = z - Math.sin(a) * len * 0.3;
  b.add(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, len * 0.45, 5), 0xb8a890, M(bx, 0.3 * s, bz, a + 0.8, 1, 0.3, Math.PI / 2 - 0.3));
}

/** Reef rock: a few blue-gray polyhedra clustered together */
export function reefRock(b: PropBatch, x: number, z: number, s: number, r: () => number, cols = [0x6c7c92, 0x7f90a6, 0x5f6f84]): void {
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = s * 0.5 * r();
    const ss = s * (0.5 + r() * 0.6);
    b.add(new THREE.DodecahedronGeometry(1, 0), cols[i % cols.length], M(x + Math.cos(a) * d, ss * 0.3, z + Math.sin(a) * d, r() * 6, ss, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
  }
}

/** Sea stack: stacked reef rocks topped with a tuft of grass (or snow); height about 5.5·s */
export function seaStack(b: PropBatch, x: number, z: number, s: number, r: () => number, top = 0x4fae62): void {
  const cols = [0x66788e, 0x7d8ea4, 0x8fa0b4, 0x72849a];
  let y = 0;
  const n = 3 + Math.floor(r() * 2);
  let ox = 0;
  let oz = 0;
  for (let i = 0; i < n; i++) {
    const k = 1 - i / (n + 1);
    const w = s * (1.35 * k + 0.25);
    const h = s * (1.1 + r() * 0.5);
    b.add(new THREE.DodecahedronGeometry(1, 0), cols[i % cols.length], M(x + ox, y + h * 0.55, z + oz, r() * 6, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3).multiply(new THREE.Matrix4().makeScale(w, h * 0.75, w)));
    y += h * 0.9;
    ox += (r() - 0.5) * 0.4 * s;
    oz += (r() - 0.5) * 0.4 * s;
  }
  const g = new THREE.IcosahedronGeometry(0.7 * s, 0);
  g.scale(1, 0.45, 1);
  b.add(g, top, M(x + ox, y + 0.05 * s, z + oz, r() * 6));
}

// ───────────────────────── North ─────────────────────────

/** Snow-covered pine: layered dark green cones, each layer capped with a patch of snow */
export function snowPine(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  b.add(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 1.4 * s, 6), 0x6a4a34, M(x, 0.7 * s, z));
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const rad = (1.6 - i * 0.32) * s;
    const y = (1.2 + i * 0.95) * s;
    const ry = r() * 6;
    b.add(new THREE.ConeGeometry(rad, 1.5 * s, 8), i % 2 ? 0x2f6a58 : 0x3a7a64, M(x, y + 0.75 * s, z, ry));
    const cap = new THREE.ConeGeometry(rad * 0.8, 0.8 * s, 8);
    b.add(cap, 0xf4f8ff, M(x, y + 1.18 * s, z, ry + 0.2), false);
  }
}

/** Icicle cluster: a few blue-white ice crystals pointing upward, the tallest about h */
export function iceSpire(b: PropBatch, x: number, z: number, h: number, r: () => number, glowCol?: number): void {
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : h * (0.15 + r() * 0.2);
    const hh = i === 0 ? h : h * (0.35 + r() * 0.45);
    const g = new THREE.ConeGeometry(hh * 0.16, hh, 5);
    const tilt = i === 0 ? (r() - 0.5) * 0.15 : 0.2 + r() * 0.35;
    b.add(g, i % 2 ? 0xbfe6fa : 0xa6d8f4, M(x + Math.cos(a) * d, hh * 0.45, z + Math.sin(a) * d, r() * 6, 1, Math.cos(a) * tilt, -Math.sin(a) * tilt));
  }
  if (glowCol !== undefined) {
    const g = new THREE.OctahedronGeometry(h * 0.07);
    g.scale(0.6, 2.4, 0.6);
    b.glow(g, glowCol, M(x, h * 0.18, z, r() * 6));
  }
}

/** Snow pile: a flattened white ball */
export function snowDrift(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(s * (0.6 + r() * 0.5), 1);
    g.scale(1.4, 0.4, 1);
    b.add(g, i % 2 ? 0xe8f0fa : 0xf6faff, M(x + (r() - 0.5) * s, 0, z + (r() - 0.5) * s, r() * 6), false);
  }
}

/** Snow-covered rock */
export function snowRock(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const ry = r() * 6;
  b.add(new THREE.DodecahedronGeometry(1, 0), 0x6f7f92, M(x, 0.35 * s, z, ry, s, r() * 0.4, r() * 0.4));
  const cap = new THREE.SphereGeometry(0.92, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2.6);
  b.add(cap, 0xf2f7ff, M(x, 0.62 * s, z, ry, s * 0.95), false);
}

/** Floating ice: a flat irregular ice slab, white on top and blue on the sides (added to the rocking vertex-color batch) */
export function floe(cb: ColorBatch, x: number, z: number, s: number, r: () => number): void {
  const pts: THREE.Vector2[] = [];
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = s * (0.7 + r() * 0.5);
    pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  const shape = new THREE.Shape(pts);
  const th = 0.3 + r() * 0.25;
  const g = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const ry = r() * 6;
  cb.bob = r() * 6.28;
  cb.add(g, 0x9ccfee, M(x, -th * 0.55, z, ry));
  const top = new THREE.ShapeGeometry(shape);
  top.rotateX(-Math.PI / 2);
  top.scale(0.94, 1, 0.94);
  cb.add(top, 0xf4f9ff, M(x, th * 0.46, z, ry));
  cb.bob = -1;
}

// ───────────────────────── Plants on the island (y is the ground height) ─────────────────────────

const _eY = new THREE.Euler(0, 0, 0, 'YXZ');
/** A matrix that first yaws and then pitches up (for leaves and grass blades: the template grows along +z or +y) */
function yp(x: number, y: number, z: number, sx: number, sy: number, sz: number, pitch: number, yaw: number, roll = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_eY.set(pitch, yaw, roll)), new THREE.Vector3(sx, sy, sz));
}

/** Olive tree: a twisted gray-brown trunk splitting into two or three branches, topped with clumps of silver-green canopy (about 3-4 meters) */
export function olive(b: PropBatch, x: number, z: number, y: number, s: number, r: () => number): void {
  const TRUNK = 0x8a7c68;
  const LEAVES = [0x8aa878, 0x9ab888, 0x7a9a68];
  let p = new THREE.Vector3(x, y - 0.1, z);
  let a = r() * Math.PI * 2;
  for (let i = 0; i < 2; i++) {
    a += (r() - 0.5) * 1.6;
    const q = p.clone().add(new THREE.Vector3(Math.cos(a) * 0.35 * s, 0.75 * s, Math.sin(a) * 0.35 * s));
    seg(b, p, q, (0.24 - i * 0.05) * s, TRUNK, 6, true, (0.19 - i * 0.04) * s);
    p = q;
  }
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const ba = a + (i / n) * Math.PI * 2 + r() * 0.6;
    const tip = p.clone().add(new THREE.Vector3(Math.cos(ba) * 0.9 * s, (0.7 + r() * 0.4) * s, Math.sin(ba) * 0.9 * s));
    seg(b, p, tip, 0.11 * s, TRUNK, 5, true, 0.07 * s);
    put(b, T.ico1, LEAVES[i % 3], M(tip.x, tip.y + 0.25 * s, tip.z, r() * 6).multiply(new THREE.Matrix4().makeScale(1.05 * s, 0.62 * s, 0.95 * s)));
  }
  put(b, T.ico1, LEAVES[1], M(p.x, p.y + 1.05 * s, p.z, r() * 6).multiply(new THREE.Matrix4().makeScale(1.2 * s, 0.7 * s, 1.2 * s)));
}

/** Banana plant: a green pseudostem, a ring of big leaves arching outward, a bunch of bananas and a hanging purple flower bud */
export function banana(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number): void {
  const H = (1.7 + r() * 0.6) * s;
  put(b, T.taper8, 0x7a9a4a, M(x, y + H / 2 - 0.05, z).multiply(new THREE.Matrix4().makeScale(0.16 * s, H, 0.16 * s)));
  const n = 6 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const col = i % 3 ? 0x48a03c : 0x58b048;
    // Leaves are in two segments: the inner one tilts up and the outer one droops
    const L1 = (0.9 + r() * 0.3) * s;
    const up = 0.5 + r() * 0.3;
    put(b, T.leaf, col, yp(x, y + H - 0.05, z, 0.55 * s, 1, L1, -up, a), false);
    const ex = x + Math.sin(a) * Math.cos(up) * L1 * 1.02;
    const ez = z + Math.cos(a) * Math.cos(up) * L1 * 1.02;
    const ey = y + H - 0.05 + Math.sin(up) * L1 * 1.02;
    put(b, T.leaf, i % 2 ? 0x3a9432 : col, yp(ex, ey, ez, 0.5 * s, 1, 0.9 * s, 0.35 + r() * 0.3, a), false);
    seg(b, new THREE.Vector3(x, y + H - 0.05, z), new THREE.Vector3(ex, ey, ez), 0.025 * s, 0x8ab85a, 4, false);
  }
  if (r() < 0.7) {
    const a = r() * Math.PI * 2;
    const bx = x + Math.cos(a) * 0.25 * s;
    const bz = z + Math.sin(a) * 0.25 * s;
    for (let i = 0; i < 4; i++) put(b, T.cyl5, i % 2 ? 0xa8c84a : 0x98c040, M(bx, y + H - 0.35 * s - i * 0.13 * s, bz, i).multiply(new THREE.Matrix4().makeScale(0.15 * s, 0.14 * s, 0.15 * s)), false);
    put(b, T.cone6, 0x8a2a5a, M(bx, y + H - 1.0 * s, bz, 0, 1, Math.PI).multiply(new THREE.Matrix4().makeScale(0.09 * s, 0.25 * s, 0.09 * s)));
  }
}

/** Agave: a ring of blue-green pointed leaves; a few send up one tall flower stalk topped with clusters of yellow flowers */
export function agave(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number): void {
  const n = 11 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const inner = i % 3 === 0;
    const tilt = inner ? 0.25 + r() * 0.2 : 0.7 + r() * 0.45;
    const len = (inner ? 0.8 : 0.95 + r() * 0.3) * s;
    put(b, T.blade, i % 4 ? 0x6a9a8a : 0x86b0a0, yp(x, y - 0.05, z, 0.26 * s, len, 0.9, tilt, a), false);
  }
  if (r() < 0.22) {
    const H = (2.6 + r() * 1.2) * s;
    seg(b, new THREE.Vector3(x, y, z), new THREE.Vector3(x + 0.1, y + H, z), 0.05 * s, 0x8a9a5a, 5, true, 0.03 * s);
    for (let i = 0; i < 5; i++) {
      const hy = y + H * (0.72 + i * 0.07);
      const a = i * 2.1;
      const px = x + 0.1 + Math.cos(a) * 0.3 * s;
      const pz = z + Math.sin(a) * 0.3 * s;
      seg(b, new THREE.Vector3(x + 0.1, hy - 0.1, z), new THREE.Vector3(px, hy, pz), 0.02 * s, 0x8a9a5a, 4, false);
      put(b, T.ico0, 0xf0d040, M(px, hy + 0.08, pz, a).multiply(new THREE.Matrix4().makeScale(0.16 * s, 0.1 * s, 0.16 * s)), false);
    }
  }
}

/** Monstera: a few very large heart-shaped leaves reaching out from stems on the ground */
export function monstera(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number): void {
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.8;
    const d = (0.35 + r() * 0.3) * s;
    const hh = (0.5 + r() * 0.5) * s;
    const bx = x + Math.sin(a) * d;
    const bz = z + Math.cos(a) * d;
    seg(b, new THREE.Vector3(x, y, z), new THREE.Vector3(bx, y + hh, bz), 0.03 * s, 0x3f7a3a, 4, false);
    put(b, T.leaf, i % 2 ? 0x2f8a44 : 0x3a9a4a, yp(bx, y + hh, bz, 0.95 * s, 1, 0.95 * s, 0.25 + r() * 0.3, a, (r() - 0.5) * 0.4), false);
  }
}

/** Plumeria tree: thick branches splitting like a candelabra, with a ring of long leaves and white-yellow (or pink) flowers at the branch tips */
export function plumeria(b: PropBatch, x: number, z: number, y: number, s: number, r: () => number): void {
  const BARK = 0x9a8a78;
  const pink = r() < 0.35;
  const fl = pink ? [0xff9ac0, 0xffd0e0] : [0xfffaf0, 0xffe07a];
  const base = new THREE.Vector3(x, y - 0.1, z);
  const fork = base.clone().add(new THREE.Vector3(0, 1.1 * s, 0));
  seg(b, base, fork, 0.2 * s, BARK, 6, true, 0.16 * s);
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const mid = fork.clone().add(new THREE.Vector3(Math.cos(a) * 0.55 * s, 0.45 * s, Math.sin(a) * 0.55 * s));
    const tip = mid.clone().add(new THREE.Vector3(Math.cos(a) * 0.25 * s, 0.7 * s, Math.sin(a) * 0.25 * s));
    seg(b, fork, mid, 0.12 * s, BARK, 5, true, 0.1 * s);
    seg(b, mid, tip, 0.09 * s, BARK, 5, true, 0.07 * s);
    for (let k = 0; k < 6; k++) {
      const la = (k / 6) * Math.PI * 2 + r() * 0.4;
      put(b, T.blade, k % 2 ? 0x3f8a3a : 0x4a9a42, yp(tip.x, tip.y - 0.05, tip.z, 0.22 * s, 0.75 * s, 0.9, 0.9 + r() * 0.3, la), false);
    }
    for (let k = 0; k < 4; k++) {
      const fa = r() * Math.PI * 2;
      put(b, T.ico0, fl[k % 2], M(tip.x + Math.cos(fa) * 0.16 * s, tip.y + 0.12 * s, tip.z + Math.sin(fa) * 0.16 * s, fa).multiply(new THREE.Matrix4().makeScale(0.12 * s, 0.07 * s, 0.12 * s)), false);
    }
  }
}

/** Beach grass: a clump of long thin blades on a dune and a few seed-headed stalks */
export function beachGrass(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number): void {
  const n = 8 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    put(b, T.blade, i % 3 ? 0xb8c878 : 0x98b060, yp(x + (r() - 0.5) * 0.3, y - 0.03, z + (r() - 0.5) * 0.3, 0.07 * s, (0.5 + r() * 0.5) * s, 0.6, 0.25 + r() * 0.5, a), false);
  }
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2;
    const tip = new THREE.Vector3(x + Math.cos(a) * 0.25 * s, y + (0.95 + r() * 0.3) * s, z + Math.sin(a) * 0.25 * s);
    seg(b, new THREE.Vector3(x, y, z), tip, 0.012 * s, 0xc8b878, 3, false);
    put(b, T.sphere, 0xd8c890, M(tip.x, tip.y, tip.z).multiply(new THREE.Matrix4().makeScale(0.04 * s, 0.13 * s, 0.04 * s)), false);
  }
}

/** Lantana: a small clump of leaves with two-colored small flower balls in bloom */
export function lantana(b: PropBatch, x: number, y: number, z: number, cols: [number, number], r: () => number): void {
  put(b, T.ico0, r() < 0.5 ? 0x4a9a42 : 0x3f8a3a, M(x, y + 0.12, z, r() * 6).multiply(new THREE.Matrix4().makeScale(0.42, 0.24, 0.42)), false);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.15 + r() * 0.25;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const py = y + 0.26 + r() * 0.1;
    put(b, T.oct, cols[0], M(px, py, pz, r() * 3).multiply(new THREE.Matrix4().makeScale(0.1, 0.07, 0.1)), false);
    put(b, T.oct, cols[1], M(px, py + 0.05, pz).multiply(new THREE.Matrix4().makeScale(0.055, 0.045, 0.055)), false);
  }
}

/** Seaweed washed ashore: a few flat ribbons spread on the wet sand, with small air bladders */
export function seaweed(b: PropBatch, x: number, y: number, z: number, r: () => number): void {
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI;
    const len = 0.6 + r() * 0.8;
    const col = r() < 0.5 ? 0x5a6a2a : 0x7a6a3a;
    const px = x + (r() - 0.5) * 0.8;
    const pz = z + (r() - 0.5) * 0.8;
    put(b, T.box, col, M(px, y + 0.02, pz, a, 1, 0, (r() - 0.5) * 0.2).multiply(new THREE.Matrix4().makeScale(0.12, 0.03, len)), false);
    put(b, T.sphere, 0x8a8a3a, M(px + Math.sin(a) * len * 0.4, y + 0.05, pz + Math.cos(a) * len * 0.4).multiply(new THREE.Matrix4().makeScale(0.06, 0.05, 0.06)), false);
  }
}

/** A small patch of pebbles */
export function pebbles(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number, cols = [0xb8b4a8, 0x9a9890, 0xe8e0d0, 0xc8b89a]): void {
  const n = 4 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const rr = (0.08 + r() * 0.14) * s;
    put(b, T.dode0, cols[Math.floor(r() * cols.length)], M(x + (r() - 0.5) * 1.2 * s, y + rr * 0.25, z + (r() - 0.5) * 1.2 * s, r() * 6).multiply(new THREE.Matrix4().makeScale(rr * 1.3, rr * 0.6, rr)), false);
  }
}

/** Vine-covered rock: a rock topped with vine leaves, a few strands hanging down, occasionally with small flowers */
export function vineRock(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number, bloom?: number): void {
  const ry = r() * 6;
  const col = [0x7d8ea4, 0x8a96a8, 0x6c7c92][Math.floor(r() * 3)];
  put(b, T.dode0, col, M(x, y + 0.35 * s, z, ry, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3).multiply(new THREE.Matrix4().makeScale(s * 1.2, s * 0.85, s)));
  put(b, T.ico1, 0x4a9a42, M(x, y + 0.95 * s, z, ry + 0.5).multiply(new THREE.Matrix4().makeScale(s * 0.95, s * 0.3, s * 0.8)), false);
  for (let i = 0; i < 4; i++) {
    const a = ry + (i / 4) * Math.PI * 2 + r() * 0.5;
    const px = x + Math.cos(a) * s * 0.95;
    const pz = z + Math.sin(a) * s * 0.8;
    put(b, T.ico0, i % 2 ? 0x3f8a3a : 0x55a84a, M(px, y + (0.35 + r() * 0.35) * s, pz, a).multiply(new THREE.Matrix4().makeScale(0.2 * s, 0.45 * s, 0.2 * s)), false);
    if (bloom !== undefined && r() < 0.6) put(b, T.ico0, bloom, M(px, y + 0.75 * s, pz).multiply(new THREE.Matrix4().makeScale(0.12, 0.1, 0.12)), false);
  }
}

/** Seagrass bed in shallow water: clumps of upright thin leaves (faintly visible under the water surface, depending on the sea's color) */
export function seagrass(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number): void {
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    put(b, T.blade, i % 2 ? 0x3a8a5a : 0x4aa06a, yp(x + (r() - 0.5) * 0.9 * s, y - 0.02, z + (r() - 0.5) * 0.9 * s, 0.1 * s, (0.4 + r() * 0.5) * s, 0.5, (r() - 0.5) * 0.4, a), false);
  }
}
