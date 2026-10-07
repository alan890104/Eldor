// Shared props of the Void Rift: corrupted crystals (black-purple body with a glowing tip),
// Old Kingdom pillars and broken columns, dead corrupted trees, tilted strata slabs.
// All assume the ground is at y = 0 (ctx.place before calling) and are added to the FieldBatch to be merged.

import * as THREE from 'three';
import { M, rng, type PropBatch } from '../../../arenaKit.ts';

export const COL = {
  stone: 0x5e5268,
  stoneD: 0x40364c,
  stoneL: 0x7c7088,
  slab: 0x2e2438,
  obsidian: 0x2a1e38,
  obsidian2: 0x3a2850,
  /** Crystal body (brighter than obsidian and leaning purple, so it reads as crystal) */
  cryBody: 0x5c3690,
  cryBody2: 0x6e3a96,
  cryA: 0xff3a8a,
  cryB: 0xa64aff,
  cryC: 0xff86d8,
  bark: 0x221a26,
  gold: 0xd8b060,
  goldD: 0x8a6a3a,
};

const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();

const lighter = new Map<number, number>();
const lift = (c: number) => {
  let v = lighter.get(c);
  if (v === undefined) lighter.set(c, (v = new THREE.Color(c).lerp(new THREE.Color(0xc8a0f0), 0.35).getHex()));
  return v;
};

/**
 * One crystal: a hexagonal body (purple, with a glowing vein inside) plus a short hexagonal-pyramid tip (same hue,
 * a bit brighter), with only the very tip glowing.
 * (x, y, z) is the base; rx / rz are the tilt.
 */
export function shard(b: PropBatch, x: number, y: number, z: number, s: number, ry: number, rx: number, rz: number, body: number, tip: number, len = 1.6): void {
  tmpE.set(rx, ry, rz);
  const up = tmpV.set(0, 1, 0).applyEuler(tmpE);
  const bodyH = len * s;
  const at = (k: number) => M(x + up.x * k, y + up.y * k, z + up.z * k, ry, 1, rx, rz);
  const R = 0.27 * s;
  b.add(new THREE.CylinderGeometry(R, 0.24 * s, bodyH, 6), body, at(bodyH * 0.5));
  // Vein: glows from the base upward along one ridge
  const vein = new THREE.BoxGeometry(0.07 * s, bodyH * 0.8, 0.05 * s);
  vein.translate(0, 0, 0.225 * s);
  b.glow(vein, tip, at(bodyH * 0.48));
  const tipH = 0.62 * s;
  b.add(new THREE.ConeGeometry(R, tipH, 6), lift(body), at(bodyH + tipH * 0.5 - 0.01));
  // Glowing tip (a bit larger than the crystal tip, wrapped around the outside)
  const k = 0.45;
  b.glow(new THREE.ConeGeometry(R * k * 1.06, tipH * k * 1.04, 6), tip, at(bodyH + tipH * (1 - k * 0.5) + 0.01));
}

/** A cluster of crystals: tall in the middle, leaning outward around it; with glowCore the whole middle crystal glows */
export function crystalCluster(b: PropBatch, x: number, z: number, s: number, r: () => number, glowCore = false): void {
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const main = i === 0;
    const a = r() * Math.PI * 2;
    const d = main ? 0 : s * (0.25 + r() * 0.35);
    const ss = s * (main ? 1 : 0.35 + r() * 0.45);
    const tilt = main ? (r() - 0.5) * 0.2 : 0.25 + r() * 0.5;
    const rx = Math.sin(a) * tilt;
    const rz = -Math.cos(a) * tilt;
    const tip = r() < 0.45 ? COL.cryB : r() < 0.65 ? COL.cryA : COL.cryC;
    if (main && glowCore) {
      const g = new THREE.CylinderGeometry(0.2 * ss, 0.26 * ss, 1.9 * ss, 6);
      b.glow(g, COL.cryB, M(x, 0.95 * ss - 0.1, z, r() * 6, 1, rx, rz));
      b.glow(new THREE.ConeGeometry(0.2 * ss, 0.7 * ss, 6), COL.cryC, M(x, 1.9 * ss + 0.25 * ss, z, 0, 1, rx, rz));
    } else {
      shard(b, x + Math.cos(a) * d, -0.15 * ss, z + Math.sin(a) * d, ss, r() * 6, rx, rz, r() < 0.6 ? COL.cryBody : COL.cryBody2, tip);
    }
  }
}

/** Old Kingdom pillar: base, shaft, capital; when broken the top end is a slanted break face */
export function column(b: PropBatch, x: number, z: number, h: number, s: number, broken: boolean, r: () => number, tilt = 0, ry = 0): void {
  b.add(new THREE.BoxGeometry(1.3 * s, 0.4 * s, 1.3 * s), COL.stoneD, M(x, 0.2 * s, z, ry));
  const m = M(x + Math.sin(tilt) * h * 0.5 * Math.cos(ry), 0.4 * s + (h / 2) * Math.cos(tilt), z - Math.sin(tilt) * h * 0.5 * Math.sin(ry), ry, 1, 0, tilt);
  b.add(new THREE.CylinderGeometry(0.42 * s, 0.48 * s, h, 10), COL.stone, m);
  if (!broken) {
    b.add(new THREE.BoxGeometry(1.2 * s, 0.35 * s, 1.2 * s), COL.stoneL, M(x + Math.sin(tilt) * h * Math.cos(ry), 0.4 * s + h * Math.cos(tilt) + 0.17 * s, z - Math.sin(tilt) * h * Math.sin(ry), ry, 1, 0, tilt));
  } else {
    // Break face: a small slanted-cut piece of stone
    b.add(new THREE.CylinderGeometry(0.2 * s, 0.44 * s, 0.5 * s, 7), COL.stone, M(x + Math.sin(tilt) * h * Math.cos(ry), 0.4 * s + h * Math.cos(tilt) + 0.15 * s, z - Math.sin(tilt) * h * Math.sin(ry), r() * 6, 1, (r() - 0.5) * 0.6, tilt + (r() - 0.5) * 0.6));
  }
}

/** Fallen pillar: broken into two or three sections lying on the ground */
export function fallenColumn(b: PropBatch, x: number, z: number, len: number, s: number, ry: number, r: () => number): void {
  const dx = Math.cos(ry);
  const dz = -Math.sin(ry);
  const n = 2 + Math.floor(r() * 2);
  let off = -len / 2;
  for (let i = 0; i < n; i++) {
    const l = (len / n) * (0.8 + r() * 0.3);
    const c = off + l / 2;
    b.add(new THREE.CylinderGeometry(0.44 * s, 0.44 * s, l, 10), COL.stone, M(x + dx * c, 0.36 * s, z + dz * c, ry + (r() - 0.5) * 0.25, 1, 0, Math.PI / 2));
    off += l + 0.3 + r() * 0.5;
  }
}

/** Dead corrupted tree: a black trunk and forks, with small crystals growing at the branch tips */
export function deadTree(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const h = (3.2 + r() * 2.4) * s;
  const lean = (r() - 0.5) * 0.2;
  b.add(new THREE.CylinderGeometry(0.12 * s, 0.32 * s, h, 6), COL.bark, M(x, h / 2, z, r() * 6, 1, lean, 0));
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const y = h * (0.45 + r() * 0.45);
    const a = r() * Math.PI * 2;
    const L = (1.2 + r() * 1.6) * s;
    const tilt = 0.6 + r() * 0.6;
    const ex = Math.cos(a) * Math.sin(tilt) * L;
    const ez = Math.sin(a) * Math.sin(tilt) * L;
    const ey = Math.cos(tilt) * L;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ex, ey, ez).normalize());
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + ex / 2, y + ey / 2, z + ez / 2), q, new THREE.Vector3(1, 1, 1));
    b.add(new THREE.CylinderGeometry(0.04 * s, 0.1 * s, L, 5), COL.bark, m);
    if (r() < 0.45) {
      const g = new THREE.OctahedronGeometry(0.16 * s);
      g.scale(0.7, 1.8, 0.7);
      b.glow(g, r() < 0.6 ? COL.cryA : COL.cryB, M(x + ex, y + ey + 0.1 * s, z + ez, r() * 6));
    }
  }
}

/** A strata slab pushed up from underground: stuck into the ground at a slant (leaning to one side along its own long edge,
 *  lower edge buried in the soil), with light leaking from the gap at the bottom. The slab itself is a rock with chipped edges
 *  and corners: the upper half is the paler layer that used to be the surface, with a light strata line between the two layers,
 *  glowing crystal veins on the front, and on the side it leans toward (the overhanging underside) hang stalagmites
 *  and small crystals. */
export function upthrust(b: PropBatch, x: number, z: number, w: number, h: number, t: number, ry: number, tilt: number, r: () => number): void {
  // The caller's random numbers are used only twice (as before, so later placement does not shift);
  // all other detail uses the slab's own random numbers
  const twist = (r() - 0.5) * 0.12;
  const seamCol = r() < 0.5 ? COL.cryA : COL.cryB;
  const rr = rng(((Math.floor(x * 73.1 + z * 131.7) % 99991) + 99991) % 99991 + 7);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, ry, twist, 'YXZ'));
  // Lower edge buried in the soil: center height = tilted half-height minus the burial depth
  const cy = (h / 2) * Math.cos(tilt) + (t / 2) * Math.sin(tilt) - (0.22 * h + 0.25);
  const C = new THREE.Vector3(x, cy, z);
  const at = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(C);
  const mat = (lx: number, ly: number, lz: number, lq = new THREE.Quaternion()) => new THREE.Matrix4().compose(at(lx, ly, lz), q.clone().multiply(lq), new THREE.Vector3(1, 1, 1));
  // Lower half: dark rock body; upper half: the original surface layer (paler)
  const lo = 0.62;
  b.add(rockSlab(w, h * lo, t, rr, false), [0x3e3450, 0x463a58, 0x3a3048][Math.floor(rr() * 3)], mat(0, -h * (1 - lo) / 2, 0));
  b.add(rockSlab(w * 0.97, h * (1 - lo) + 0.05, t * 0.94, rr, true), [0x5e5270, 0x665a78, 0x564a66][Math.floor(rr() * 3)], mat((rr() - 0.5) * 0.1, h * lo / 2, 0));
  // A light strata line between the two layers
  b.add(new THREE.BoxGeometry(w * 1.01, Math.min(0.14, h * 0.04), t * 1.05), 0x7a6e8a, mat(0, h * (lo - 0.5) + 0.02, 0), false);
  // Crystal veins on the front (the side opposite the lean): one or two slanted glowing cracks
  const nv = 1 + Math.floor(rr() * 2);
  for (let i = 0; i < nv; i++) {
    const len = h * (0.35 + rr() * 0.3);
    const vq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (rr() - 0.5) * 1.1));
    b.glow(new THREE.BoxGeometry(0.07, len, t * 0.24), rr() < 0.6 ? COL.cryB : COL.cryA, mat((rr() - 0.5) * w * 0.6, -h * 0.12 + (rr() - 0.5) * h * 0.2, -t / 2, vq));
  }
  // Overhanging underside (+z face pointing down): hanging stalagmites, occasionally one is a crystal
  const ns = 2 + Math.floor(rr() * 3 + w * 0.4);
  const down = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0));
  for (let i = 0; i < ns; i++) {
    const p = at((rr() - 0.5) * w * 0.85, h * (0.05 + rr() * 0.35), t / 2 - 0.05);
    const room = p.y - 0.25;
    if (room < 0.25) continue;
    const len = Math.min(room, (0.3 + rr() * 0.6) * Math.min(1.4, h / 3));
    const rad = 0.08 + rr() * 0.1;
    const cone = new THREE.ConeGeometry(rad, len, 5);
    cone.translate(0, len / 2, 0);
    const m = new THREE.Matrix4().compose(p, down, new THREE.Vector3(1, 1, 1));
    if (rr() < 0.3) b.glow(cone, rr() < 0.5 ? COL.cryB : COL.cryC, m);
    else b.add(cone, 0x3a3048, m);
  }
  // Rubble that has crumbled off at the foot
  for (let i = 0; i < 3; i++) {
    const a = rr() * Math.PI * 2;
    const d = w * (0.3 + rr() * 0.35);
    const s = 0.15 + rr() * 0.25;
    b.add(new THREE.DodecahedronGeometry(s, 0), [0x3e3450, 0x5e5270][i % 2], M(x + Math.cos(a) * d, s * 0.3, z + Math.sin(a) * d, rr() * 6, 1, rr(), rr()));
  }
  // Glowing gap at the bottom
  const seam = new THREE.BoxGeometry(w * 0.9, 0.12, t * 1.3);
  b.glow(seam, seamCol, M(x, 0.06, z, ry));
}

/**
 * Rock block with chipped edges and corners (centered at the origin): the grid points of the box are pulled inward by a
 * position hash so edges and corners are cut away; with top, the upper edge is ragged
 */
function rockSlab(w: number, h: number, t: number, r: () => number, top: boolean): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, t, 3, 2, 1);
  const p = g.attributes.position;
  const seed = r() * 97;
  const hs = (a: number, b: number, c: number) => {
    const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + seed) * 43758.5453;
    return v - Math.floor(v);
  };
  const bev = Math.min(0.28, t * 0.3, w * 0.12);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const kx = Math.abs(x) / (w / 2) > 0.99 ? Math.sign(x) : 0;
    const ky = Math.abs(y) / (h / 2) > 0.99 ? Math.sign(y) : 0;
    const kz = Math.abs(z) / (t / 2) > 0.99 ? Math.sign(z) : 0;
    const X = Math.round(x * 100);
    const Y = Math.round(y * 100);
    const Z = Math.round(z * 100);
    const n = hs(X, Y, Z);
    // Edges and corners: cut inward
    const edges = Math.abs(kx) + Math.abs(ky) + Math.abs(kz);
    if (edges >= 2) {
      const c = bev * (0.6 + n * 0.8);
      x -= kx * c * (ky || kz ? 1 : 0);
      y -= ky * c * (kx || kz ? 1 : 0) * (ky < 0 ? 0.3 : 1);
      z -= kz * c * 0.5 * (kx || ky ? 1 : 0);
    }
    // Ragged upper edge
    if (top && ky > 0) y -= n * h * 0.3;
    // A slight overall unevenness
    x += (hs(Y, Z, X) - 0.5) * w * 0.04;
    z += (hs(Z, X, Y) - 0.5) * t * 0.18;
    p.setXYZ(i, x, y, z);
  }
  const ng = g.toNonIndexed();
  g.dispose();
  ng.computeVertexNormals();
  return ng;
}
