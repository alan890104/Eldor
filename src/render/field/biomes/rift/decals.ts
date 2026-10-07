// Things painted onto the ground: soft glow spots (campfires, wards, crystals, the altar),
// all merged into one mesh (originally each ring was its own mesh), and "tinting",
// which rewrites the terrain vertex colors directly (scorch marks beside fissures, ash beside rubble,
// moss that grows back after purification).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { softDiscTex } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';

// ───────────────────────── Soft glow spots ─────────────────────────

let pending: THREE.BufferGeometry[] = [];

/**
 * Soft glow spots on the ground (additive blending, following the terrain relief);
 * merged in one go by flushGlows when decorate finishes
 */
export function glowDisc(ctx: FieldCtx, x: number, z: number, rad: number, color: number, amt = 1): void {
  const seg = rad > 5 ? 8 : 6;
  const g = new THREE.PlaneGeometry(rad * 2, rad * 2, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('normal');
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const px = x + p.getX(i);
    const pz = z + p.getZ(i);
    p.setXYZ(i, px, ctx.h(px, pz) + 0.06, pz);
  }
  const c = new THREE.Color(color).multiplyScalar(amt);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  pending.push(g);
}

export function flushGlows(ctx: FieldCtx): void {
  const list = pending;
  pending = [];
  if (!list.length) return;
  const geo = mergeGeometries(list);
  for (const g of list) g.dispose();
  if (!geo) return;
  const tex = softDiscTex();
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
    tex.dispose();
  });
}

// ───────────────────────── Terrain tinting ─────────────────────────

const tc = new THREE.Color();

/**
 * Pull the terrain vertex colors within radius rad of (x, z) toward color (strength k at the center,
 * fading out toward the edge); shape can be swapped for a custom weight function.
 * The terrain mesh has cells about 1 meter across, which suits painting patch after patch of color.
 */
export function tint(ctx: FieldCtx, x: number, z: number, rad: number, color: number, k: number, shape?: (dx: number, dz: number) => number): void {
  const t = ctx.terrain;
  const geo = t.mesh.geometry;
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const n = t.seg + 1;
  const step = (t.size * 2) / t.seg;
  const i0 = Math.max(0, Math.floor((x - rad + t.size) / step));
  const i1 = Math.min(n - 1, Math.ceil((x + rad + t.size) / step));
  const j0 = Math.max(0, Math.floor((z - rad + t.size) / step));
  const j1 = Math.min(n - 1, Math.ceil((z + rad + t.size) / step));
  tc.set(color);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const dx = -t.size + i * step - x;
      const dz = -t.size + j * step - z;
      const w = shape ? shape(dx, dz) : 1 - Math.min(1, Math.hypot(dx, dz) / rad);
      if (w <= 0) continue;
      const a = Math.min(1, w * w * (3 - 2 * w) * k);
      const idx = j * n + i;
      col.setXYZ(idx, col.getX(idx) + (tc.r - col.getX(idx)) * a, col.getY(idx) + (tc.g - col.getY(idx)) * a, col.getZ(idx) + (tc.b - col.getZ(idx)) * a);
    }
  }
  col.needsUpdate = true;
}
