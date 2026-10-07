// Colors and small helpers shared by the Stoneheart Canyon props. The colors are deliberately kept to a few (props of the same
// color merge into one mesh).

import * as THREE from 'three';
import { sceneMaterial } from '../../../spiritToon.ts';
import { inkScenery } from '../../../ink.ts';
import type { FieldCtx } from '../../kit.ts';

export const COL = {
  // The dwarves' stone buildings
  stone: 0xd2b894,
  stone2: 0xbfa07c,
  stoneDk: 0x86705e,
  basalt: 0x5e504c,
  copper: 0x4fa890,
  copperDk: 0x3a7e6c,
  gold: 0xe8b848,
  bronze: 0xa8743e,
  wood: 0x7a5236,
  woodDk: 0x553a28,
  iron: 0x4e4648,
  banner: 0xb8342a,
  bannerDk: 0x7e2420,
  awning: [0xc8503a, 0xe2a24a, 0x3f8f80, 0xe8dcc0],
  // The giant tortoise
  skin: 0x8e8c6a,
  skinDk: 0x6c6a50,
  skinLt: 0xaaa684,
  horn: 0xc6b282,
  beak: 0x5a4c34,
  shellDk: 0x76663f,
  shellLt: 0x8c7a4c,
  moss: 0x9aa656,
  // The canyon's rocks and plants
  rock: [0xc0683f, 0xb05a3a, 0xd08a58, 0x9e4c36],
  cap: 0xe6c49a,
  juniper: [0x5e7e52, 0x6e8e5c, 0x52704a],
  sage: [0x9aa888, 0x8a9a7a, 0xa8b494],
  bark: 0x6a4a36,
  snag: 0xb8a48a,
  bone: 0xece2cc,
  // Glowing
  win: 0xffc070,
  rune: 0xffb040,
  fire: 0xff9a3a,
  cyan: 0x6ae8ff,
  hex: 0xb04aff,
};

/**
 * Matrix for a local frame with origin (x, z), facing facing (radians, 0 = +z): (lx, ly, lz) → world; rx and rz are the
 * object's own tilt
 */
export function frame(x: number, z: number, facing: number) {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return (lx: number, ly: number, lz: number, ry = 0, sc = 1, rx = 0, rz = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x + c * lx + s * lz, ly, z - s * lx + c * lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, facing + ry, rz, 'YXZ')), new THREE.Vector3(sc, sc, sc));
}

/** Local coordinates to world (x, z) */
export function local(x: number, z: number, facing: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return [x + c * lx + s * lz, z - s * lx + c * lz];
}

/** Matrix with non-uniform scale plus arbitrary rotation */
export function MX(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}

/**
 * An animated prop: scene toon material; when outline is true it goes through the post-process outline (the material goes into
 * disposers)
 */
export function dynMesh(ctx: FieldCtx, geo: THREE.BufferGeometry, color: number, outline = true): THREE.Mesh {
  const mat = sceneMaterial(color, { rim: 0.35 });
  const mesh = new THREE.Mesh(geo, mat);
  ctx.disposers.push(() => {
    mat.dispose();
    geo.dispose();
  });
  // Only marks this mesh itself; child meshes attached later decide for themselves whether to be outlined
  if (outline) inkScenery(mesh);
  return mesh;
}

/** Emissive material (blooms) */
export function glowMat(ctx: FieldCtx, color: number, k = 2.2): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
  ctx.disposers.push(() => mat.dispose());
  return mat;
}

/** Take evenly spaced points along a polyline (with the heading angle a and cumulative length s) */
export function along(pts: [number, number][], step: number): { x: number; z: number; a: number; s: number }[] {
  const out: { x: number; z: number; a: number; s: number }[] = [];
  let acc = 0;
  let next = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const a = Math.atan2(x1 - x0, z1 - z0);
    while (next <= acc + len) {
      const t = (next - acc) / len;
      out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, a, s: next });
      next += step;
    }
    acc += len;
  }
  return out;
}
