// Map outer ring: beyond the rim wall is an endless sea of trees (one large low-resolution terrain that continues from the
// top of the rim wall and fades into the horizon the farther it goes), a row of giant-tree silhouettes stands on top of the
// rim wall, and the cliff face is inlaid with rocks and hanging vines, so the edge of the map cannot be seen from above.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { smooth } from '../../compose.ts';
import type { FieldCtx } from '../../kit.ts';
import { Terrain } from '../../terrain.ts';
import { height, n1, n2, S } from './geo.ts';

/** Height of the rim wall the engine adds along the boundary (the formula from compose.ts, copied here so the two join up) */
function engineWall(x: number, z: number): number {
  const m = Math.max(Math.abs(x), Math.abs(z)) + Math.sin(x * 0.11) * 3 + Math.cos(z * 0.13) * 3;
  const e = smooth(S - 30, S - 4, m);
  return e * (18 + Math.sin(x * 0.21 + z * 0.17) * 4 + Math.sin(x * 0.07 - z * 0.05) * 5);
}

/** Height of the outer sea of trees: continues from the top of the rim wall, canopies bulging in clumps, lower the farther out */
function canopyH(x: number, z: number): number {
  const m = Math.max(Math.abs(x), Math.abs(z));
  const cx = Math.max(-S, Math.min(S, x));
  const cz = Math.max(-S, Math.min(S, z));
  const rim = height(cx, cz) + engineWall(cx, cz);
  const out = m - S;
  const blobs = 3.2 * Math.max(0, Math.sin(x * 0.37 + Math.sin(z * 0.2)) * Math.sin(z * 0.41 + Math.sin(x * 0.17))) + 2.2 * n1(x * 0.8, z * 0.8);
  return rim + 1.5 + blobs * smooth(0, 24, out) - smooth(20, 380, out) * 14;
}

export function buildRim(ctx: FieldCtx): void {
  const { b, r, low } = ctx;
  const SIZE = 560;
  const cDark = new THREE.Color(0x3a6e40);
  const cMid = new THREE.Color(0x4f8a48);
  const cLight = new THREE.Color(0x6aa652);
  const cFar = new THREE.Color(0xc4dcc0);
  const skirt = new Terrain({
    size: SIZE,
    seg: low ? 100 : 140,
    height: (x, z) => {
      const m = Math.max(Math.abs(x), Math.abs(z));
      if (m < S - 6) return -80;
      return canopyH(x, z) + (m < S + 1 ? 1.5 : 0);
    },
    color: (x, z, _h, _slope, out) => {
      const m = Math.max(Math.abs(x), Math.abs(z));
      const v = n1(x * 1.3, z * 1.3) * 0.5 + 0.5;
      out.copy(cDark).lerp(cMid, v).lerp(cLight, smooth(0.5, 1, n2(x * 0.9, z * 0.9)) * 0.5);
      out.lerp(cFar, smooth(S + 60, S + 420, m));
    },
  });
  ctx.group.add(skirt.mesh);
  ctx.disposers.push(() => skirt.dispose());

  // ── Giant-tree silhouettes on top of the rim wall and in the outer ring (no collision, no outline, left to the fog)
  const n = low ? 120 : 260;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const reach = S + 2 + r() * r() * 70;
    // Take points along a square frame
    const c = Math.cos(a);
    const s = Math.sin(a);
    const k = reach / Math.max(Math.abs(c), Math.abs(s));
    const x = c * k;
    const z = s * k;
    // The outer ring shows only canopy: low-poly round crowns in clumps, pressed onto the sea-of-trees surface
    b.lift = canopyH(x, z) - 1;
    const rr = 4 + r() * 3;
    const leaf = r() < 0.5 ? 0x3f7a44 : 0x4a8a4a;
    b.add(new THREE.IcosahedronGeometry(1, 1), leaf, new THREE.Matrix4().compose(new THREE.Vector3(x, rr * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(rr, rr * 0.7, rr)), false);
    if (r() < 0.6) b.add(new THREE.IcosahedronGeometry(1, 0), 0x5a9a50, M(x + rr * 0.6, rr * 0.45, z - rr * 0.3, r() * 6, rr * 0.6), false);
  }

  // ── Inside of the rim wall: rocks on the cliff face (half buried in the slope)
  for (let i = 0; i < (low ? 40 : 90); i++) {
    const a = r() * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const k = (S - 14 - r() * 14) / Math.max(Math.abs(c), Math.abs(s));
    const x = c * k;
    const z = s * k;
    const y = ctx.place(x, z, 1.5);
    const sz = 1.6 + r() * 2.6;
    b.lift = y - sz * 0.35;
    b.add(new THREE.DodecahedronGeometry(sz, 0), r() < 0.5 ? 0x8a8474 : 0x7a7666, M(x, 0, z, r() * 6, 1, r(), r()));
    if (r() < 0.6) {
      const g = new THREE.DodecahedronGeometry(sz * 0.9, 0);
      g.scale(1, 0.35, 1);
      b.add(g, 0x5f9448, M(x, sz * 0.75, z, r() * 6));
    }
  }
  b.lift = 0;
}
