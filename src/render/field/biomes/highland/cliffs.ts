// Highland cliff walls: sweep a ring of layered rock walls downward along the cliff rim (the landD = 0 contour).
// Strata heights are absolute, so the stripes line up across the whole plateau; an overhanging grass lip at the cliff top
// joins the ground, and grass grows on the jutting rock shelves.
// Also place an invisible ring of colliders along the rim (nothing falls off), and put churning cloud puffs at the cliff foot
// to cover the seam between the rock wall and the cloud sea.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import { samplePath } from '../../compose.ts';
import { rockMaterial } from './fx.ts';
import { BASIN, basinR, BUTTES, butteR, landD, mesaR, SEA, TOWER, wA, wB, zA, zB, type RimPoint } from './shape.ts';

type V3 = [number, number, number];

/** Strata colors (alternating from top to bottom by absolute height) */
const STRATA = [0xd8c6a2, 0xbca283, 0xa68b72, 0xcfb892, 0x9c8a7c, 0xc4a98a, 0xb39478, 0xd3c1a0];
const BAND = 2.4;
const TOP = 34;

/** Vertex color of the terrain mesh at (x, z) (the grass lip at the cliff top must match the ground color) */
export function groundColor(ctx: FieldCtx, x: number, z: number, out: THREE.Color): THREE.Color {
  const t = ctx.terrain;
  const n = t.seg + 1;
  const step = (2 * t.size) / t.seg;
  const i = Math.max(0, Math.min(t.seg, Math.round((x + t.size) / step)));
  const j = Math.max(0, Math.min(t.seg, Math.round((z + t.size) / step)));
  const c = t.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
  return out.setRGB(c.getX(j * n + i), c.getY(j * n + i), c.getZ(j * n + i));
}

/** Platform height at the cliff rim (sampled a little inward to avoid the terrain mesh's slope at the cliff edge) */
export function rimHeight(ctx: FieldCtx, p: RimPoint): number {
  return Math.max(ctx.h(p.x - p.nx * 1.8, p.z - p.nz * 1.8), ctx.h(p.x - p.nx * 2.6, p.z - p.nz * 2.6));
}

export function buildCliffs(ctx: FieldCtx, loops: RimPoint[][]): void {
  const pos: number[] = [];
  const col: number[] = [];
  const tmp = new THREE.Color();
  const grassA = new THREE.Color();
  const dirt = new THREE.Color(0x8a7658);
  const nLevels = Math.ceil((TOP - (SEA - 10)) / BAND);
  const bandCols = STRATA.map((c) => new THREE.Color(c));

  for (const loop of loops) {
    const closed = Math.hypot(loop[0].x - loop[loop.length - 1].x, loop[0].z - loop[loop.length - 1].z) < 3;
    // One "column" per sample point: the vertices from the cliff top down and the color of each segment
    const colsV: V3[][] = [];
    const colsC: THREE.Color[][] = [];
    for (const p of loop) {
      const hr = rimHeight(ctx, p);
      groundColor(ctx, p.x - p.nx * 2, p.z - p.nz * 2, grassA);
      const vs: V3[] = [];
      const cs: THREE.Color[] = [];
      const at = (o: number, y: number) => vs.push([p.x + p.nx * o, y, p.z + p.nz * o]);
      at(-1.2, hr - 0.1);
      cs.push(grassA.clone());
      at(0.18, hr + 0.24);
      cs.push(grassA.clone().multiplyScalar(0.92));
      at(0.6, hr - 0.32);
      cs.push(grassA.clone().lerp(dirt, 0.55));
      at(0.5, hr - 1.05);
      cs.push(dirt.clone());
      const s = p.s;
      let lastY = hr - 1.05;
      for (let i = 0; i < nLevels; i++) {
        let y = TOP - i * BAND + 0.35 * Math.sin(s * 0.13 + i * 1.3) + 0.2 * Math.sin(s * 0.41 + i);
        const bulge = 0.6 * Math.sin(Math.min(1, Math.max(0, (hr - y) / 14)) * Math.PI);
        let o = 0.55 + (i % 2 === 0 ? 0.95 : 0.2) + bulge + 0.4 * Math.sin(s * 0.19 + i * 1.7) + 0.25 * Math.sin(s * 0.53 + i * 0.9);
        if (y < SEA) o -= (SEA - y) * 0.3;
        // Levels above the cliff top fold into the first rock face (degenerate to zero area, skipped when building the mesh)
        if (y > lastY - 0.4) {
          y = lastY;
          o = 0.5;
        }
        lastY = Math.min(lastY, y);
        at(o, y);
        const bc = bandCols[((i % STRATA.length) + STRATA.length) % STRATA.length];
        tmp.copy(bc).multiplyScalar(0.94 + 0.08 * Math.sin(s * 0.07 + i * 2.1));
        cs.push(tmp.clone());
      }
      at(-4, SEA - 16);
      cs.push(bandCols[0].clone().multiplyScalar(0.7));
      colsV.push(vs);
      colsC.push(cs);
    }
    const n = loop.length;
    const segs = closed ? n : n - 1;
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    for (let k = 0; k < segs; k++) {
      const k2 = (k + 1) % n;
      const A = colsV[k];
      const B = colsV[k2];
      const p = loop[k];
      if (Math.hypot(loop[k2].x - p.x, loop[k2].z - p.z) > 4) continue;
      for (let r = 0; r < A.length - 1; r++) {
        const a = A[r];
        const b = B[r];
        const c = B[r + 1];
        const d = A[r + 1];
        // Both rows degenerate to the same point: skip
        if (Math.abs(a[1] - d[1]) < 1e-3 && Math.abs(b[1] - c[1]) < 1e-3 && Math.abs(a[0] - d[0]) < 1e-3) continue;
        e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
        nrm.crossVectors(e1, e2);
        const flip = nrm.x * p.nx + nrm.y * 0.6 + nrm.z * p.nz < 0;
        const cc = colsC[k][r];
        const tri = (u: V3, v: V3, w: V3) => {
          for (const q of flip ? [u, w, v] : [u, v, w]) {
            pos.push(q[0], q[1], q[2]);
            col.push(cc.r, cc.g, cc.b);
          }
        };
        tri(a, b, c);
        tri(a, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // Upward-facing rock shelves grow grass
  const nr = g.getAttribute('normal') as THREE.BufferAttribute;
  const cl = g.getAttribute('color') as THREE.BufferAttribute;
  const moss = new THREE.Color(0x7aa85a);
  for (let i = 0; i < nr.count; i += 3) {
    const ny = nr.getY(i);
    const y = (g.getAttribute('position') as THREE.BufferAttribute).getY(i);
    if (ny > 0.5 && y < TOP) {
      const k = Math.min(1, (ny - 0.5) * 2.5) * 0.75;
      for (let v = i; v < i + 3; v++) {
        tmp.setRGB(cl.getX(v), cl.getY(v), cl.getZ(v)).lerp(moss, k);
        cl.setXYZ(v, tmp.r, tmp.g, tmp.b);
      }
    }
  }
  const mat = rockMaterial();
  const mesh = new THREE.Mesh(g, mat);
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
  });
}

/** Colliders around the cliff rim: the character and wild spirits never walk off the cliff */
export function rimSolids(ctx: FieldCtx, loops: RimPoint[][]): void {
  for (const loop of loops) for (const p of loop) ctx.solids.add(p.x - p.nx * 0.25, p.z - p.nz * 0.25, 0.85);
}

/** Churning clouds at the cliff foot, roots and vines hanging from the rim */
export function rimDressing(ctx: FieldCtx, loops: RimPoint[][], cloudCol: number, rootCol: number, vineCol: number): void {
  const { b, r } = ctx;
  const k = ctx.low ? 2 : 1;
  b.lift = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i += 3 * k) {
      const p = loop[i];
      // Clouds hugging the cliff wall (two or three clumped together)
      const o = 2.5 + r() * 7;
      const s = 2.6 + r() * 3.8;
      const x = p.x + p.nx * o;
      const z = p.z + p.nz * o;
      const y = SEA - 0.4 + r() * 1.8;
      b.add(new THREE.IcosahedronGeometry(1, 1), cloudCol, MS(x, y, z, s, s * 0.5, s, r() * 6), false);
      if (r() < 0.6) b.add(new THREE.IcosahedronGeometry(1, 1), cloudCol, MS(x - p.nz * s * 0.9, y - 0.3, z + p.nx * s * 0.9, s * 0.72, s * 0.4, s * 0.72, r() * 6), false);
    }
    for (let i = 0; i < loop.length; i += 2 * k) {
      if (r() > 0.22) continue;
      const p = loop[i];
      const hr = rimHeight(ctx, p);
      // Roots and vines hanging from the rim
      const n = 2 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) {
        const t = (r() - 0.5) * 1.6;
        const x = p.x + p.nx * 0.55 - p.nz * t;
        const z = p.z + p.nz * 0.55 + p.nx * t;
        const L = 1.6 + r() * 4.5;
        const g = new THREE.ConeGeometry(0.07 + r() * 0.06, L, 4);
        g.rotateX(Math.PI);
        g.translate(0, -L / 2, 0);
        b.add(g, r() < 0.5 ? rootCol : vineCol, M(x, hr + 0.1, z, r() * 6, 1, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2), false);
      }
    }
  }
}

// ───────────────────────── Cliffs between terraces ─────────────────────────

export interface EdgePt {
  x: number;
  z: number;
  /** Downslope direction */
  ux: number;
  uz: number;
}

export interface Edge {
  pts: EdgePt[];
  /** Edge along the road (road embankment, rock cleft): the start may hug the road shoulder, and the drop threshold is lower */
  road?: boolean;
}

/** Top edges of the cliffs between terraces (Station Cliff, west Windsong Terrace, tower terrace, small shelf, Floatstone Hollow) */
export function interiorEdges(): Edge[] {
  const out: Edge[] = [];
  const step = 1.25;
  // Station Cliff: cliff top in the south, slopes down to the north (-z)
  const a: EdgePt[] = [];
  for (let x = -46; x <= 100; x += step) {
    const d = zA(x + 0.5) - zA(x - 0.5);
    const l = Math.hypot(d, 1);
    a.push({ x, z: zA(x) + wA(x) / 2 - 0.3, ux: d / l, uz: -1 / l });
  }
  out.push({ pts: a });
  // West section of Windsong Terrace: cliff top in the north, slopes down to the south (+z)
  const bw: EdgePt[] = [];
  for (let x = -100; x <= -30; x += step) {
    const d = zB(x + 0.5) - zB(x - 0.5);
    const l = Math.hypot(d, 1);
    bw.push({ x, z: zB(x) - wB(x) / 2 + 0.3, ux: -d / l, uz: 1 / l });
  }
  out.push({ pts: bw });
  const ring = (cx: number, cz: number, rad: (a: number) => number, inward: boolean) => {
    const pts: EdgePt[] = [];
    const n = Math.max(12, Math.round((Math.PI * 2 * rad(0)) / step));
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = rad(a);
      const s = inward ? -1 : 1;
      pts.push({ x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr, ux: Math.cos(a) * s, uz: Math.sin(a) * s });
    }
    out.push({ pts });
  };
  ring(TOWER[0], TOWER[1], (a) => mesaR(a) - 2.2, false);
  for (const bt of BUTTES) ring(bt[0], bt[1], (a) => butteR(bt, a) - 1.1, false);
  ring(BASIN[0], BASIN[1], (a) => basinR(a) + 2.4, true);
  return out;
}

/**
 * Rock walls along a slope: on both sides of Station Cliff's sloping road are embankments (falling away from the road shoulder),
 * and on both sides of Floatstone Hollow's rock cleft are cut rock walls (falling from the terrace to the road surface).
 * The edge lines are made by offsetting the road's sample points to either side.
 */
export function roadEdges(ctx: FieldCtx): Edge[] {
  const pw = ctx.layout.pathW;
  const out: Edge[] = [];
  const side = (pts: XZ[], off: number, toward: boolean) => {
    for (const sgn of [-1, 1]) {
      const e: EdgePt[] = [];
      for (let i = 1; i < pts.length - 1; i++) {
        const dx = pts[i + 1][0] - pts[i - 1][0];
        const dz = pts[i + 1][1] - pts[i - 1][1];
        const l = Math.hypot(dx, dz) || 1;
        const nx = (-dz / l) * sgn;
        const nz = (dx / l) * sgn;
        e.push({ x: pts[i][0] + nx * off, z: pts[i][1] + nz * off, ux: toward ? -nx : nx, uz: toward ? -nz : nz });
      }
      out.push({ pts: e, road: true });
    }
  };
  const main = samplePath(ctx.layout.path, 1.25);
  side(main.filter(([x, z]) => z > 33 && z < 50.5 && x > -3), pw + 0.9, false);
  const basin = ctx.layout.trails?.find((t) => t.some(([x, z]) => Math.hypot(x - 50, z + 47.5) < 1));
  if (basin) side(samplePath(basin, 1.25).filter(([x, z]) => x > 27 && x < 47 && z < -30), pw + 9, true);
  return out;
}

/**
 * Rock walls between terraces: each column measures the actual terrain profile along the downslope direction and attaches
 * a layer of rock face with strata and shelves outside the profile; where the drop is too small (ramps cut by the road,
 * gentle slopes) it breaks off automatically.
 */
export function slopeSkirts(ctx: FieldCtx, edges: Edge[]): void {
  const pos: number[] = [];
  const col: number[] = [];
  const bandCols = STRATA.map((c) => new THREE.Color(c));
  const dirt = new THREE.Color(0x8a7658);
  const grassA = new THREE.Color();
  const tmp = new THREE.Color();
  const pw = ctx.layout.pathW;
  const N = 9;
  const O0 = -1.5;
  const DO = 0.25;
  const OMAX = 11;
  const talus: V3[] = [];
  for (const { pts: edge, road } of edges) {
    const colsV: ([number, number, number][] | null)[] = [];
    const colsC: THREE.Color[][] = [];
    let s = 0;
    edge.forEach((e, k) => {
      if (k) s += Math.hypot(e.x - edge[k - 1].x, e.z - edge[k - 1].z);
      const prof: number[] = [];
      for (let o = O0; o <= OMAX; o += DO) prof.push(ctx.h(e.x + e.ux * o, e.z + e.uz * o));
      const ht = Math.max(prof[0], prof[1], prof[2], prof[3]);
      // Slope foot: where the profile flattens; walls falling toward the road stop at the road shoulder
      let kb = prof.length - 1;
      let trunc = false;
      let pdPrev = ctx.pathDist(e.x + e.ux * O0, e.z + e.uz * O0);
      for (let i = 1; i < prof.length - 2; i++) {
        const o = O0 + DO * i;
        const pd = ctx.pathDist(e.x + e.ux * o, e.z + e.uz * o);
        if (pd < pw + 0.9 && pd < pdPrev - 0.02) {
          kb = i;
          trunc = true;
          break;
        }
        pdPrev = pd;
        if (i >= 8 && prof[i] - prof[i + 2] < 0.08 && ht - prof[i] > 2) {
          kb = i;
          break;
        }
      }
      const hb = prof[kb];
      const at = (o: number): [number, number] => [e.x + e.ux * o, e.z + e.uz * o];
      const ok =
        ht - hb > (trunc || road ? 1.5 : 2.6) &&
        landD(e.x, e.z) > 2.5 &&
        landD(...at(OMAX * 0.6)) > 1.5 &&
        ctx.pathDist(e.x, e.z) > pw + (road ? 0.5 : 1.2);
      if (!ok) {
        colsV.push(null);
        colsC.push([]);
        return;
      }
      const cross = (y: number) => {
        for (let i = 1; i <= kb; i++) {
          if (prof[i] <= y) {
            const t = (prof[i - 1] - y) / Math.max(1e-4, prof[i - 1] - prof[i]);
            return O0 + DO * (i - 1 + t);
          }
        }
        return O0 + DO * kb;
      };
      const oLip = cross(ht - 0.2);
      groundColor(ctx, e.x - e.ux * 1.6, e.z - e.uz * 1.6, grassA);
      const vs: [number, number, number][] = [];
      const cs: THREE.Color[] = [];
      const put = (o: number, y: number, c: THREE.Color) => {
        const [x, z] = at(o);
        vs.push([x, y, z]);
        cs.push(c);
      };
      put(oLip - 1.1, ht - 0.06, grassA.clone());
      put(oLip + 0.12, ht + 0.16, grassA.clone().multiplyScalar(0.92));
      put(oLip + 0.45, ht - 0.4, grassA.clone().lerp(dirt, 0.5));
      const yTop = ht - 0.85;
      const yBot = hb + 0.35;
      for (let i = 0; i < N; i++) {
        const y = yTop - (i / (N - 1)) * (yTop - yBot) + 0.12 * Math.sin(s * 0.5 + i);
        const push = 0.3 + (i % 2 ? 0.4 : 0.05) + 0.15 * Math.sin(s * 0.37 + i * 1.3);
        const bi = Math.floor((y + 200) / 2.4);
        tmp.copy(bandCols[bi % bandCols.length]).multiplyScalar(0.95 + 0.07 * Math.sin(s * 0.11 + i));
        put(cross(y) + push, y, tmp.clone());
      }
      put(cross(yBot) + (trunc ? 0.25 : 1.1), hb - (trunc ? 0.25 : 0.5), bandCols[0].clone());
      // Rockfall pile at the cliff foot
      if (!trunc && !road && k % (ctx.low ? 9 : 5) === 2 && ctx.r() < 0.7) {
        const [fx, fz] = at(cross(yBot) + 1.2 + ctx.r() * 1.2);
        if (ctx.pathDist(fx, fz) > pw + 1.4 && ctx.clear(fx, fz, 0.8)) talus.push([fx, fz, ht - hb]);
      }
      colsV.push(vs);
      colsC.push(cs);
    });
    for (let k = 0; k < edge.length - 1; k++) {
      const A = colsV[k];
      const B = colsV[k + 1];
      if (!A || !B) continue;
      const e = edge[k];
      for (let r = 0; r < A.length - 1; r++) {
        const a = A[r];
        const b = B[r];
        const c = B[r + 1];
        const d = A[r + 1];
        const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
        const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        const flip = nx * e.ux + ny * 0.6 + nz * e.uz < 0;
        const cc = colsC[k][r];
        for (const q of flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d]) {
          pos.push(q[0], q[1], q[2]);
          col.push(cc.r, cc.g, cc.b);
        }
      }
    }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const nr = g.getAttribute('normal') as THREE.BufferAttribute;
  const cl = g.getAttribute('color') as THREE.BufferAttribute;
  const moss = new THREE.Color(0x7aa85a);
  for (let i = 0; i < nr.count; i += 3) {
    const ny = nr.getY(i);
    if (ny > 0.55 && i % 9 !== 0) {
      const k = Math.min(1, (ny - 0.55) * 2.5) * 0.7;
      for (let v = i; v < i + 3; v++) {
        tmp.setRGB(cl.getX(v), cl.getY(v), cl.getZ(v)).lerp(moss, k);
        cl.setXYZ(v, tmp.r, tmp.g, tmp.b);
      }
    }
  }
  const mat = rockMaterial();
  ctx.group.add(new THREE.Mesh(g, mat));
  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
  });
  // Fallen rocks: one big one leaning against the cliff foot, two or three small ones beside it, with a bit of moss on the big rock
  const { b, r } = ctx;
  for (const [x, z, drop] of talus) {
    ctx.place(x, z, 1);
    const s0 = Math.min(1.5, 0.6 + drop * 0.08) * (0.8 + r() * 0.4);
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s1 = i ? s0 * (0.3 + r() * 0.35) : s0;
      const ox = i ? (r() - 0.5) * 2.6 : 0;
      const oz = i ? (r() - 0.5) * 2.6 : 0;
      b.add(new THREE.DodecahedronGeometry(1, 0), STRATA[(i + Math.floor(r() * 8)) % STRATA.length], MS(x + ox, s1 * 0.35, z + oz, s1 * (1 + r() * 0.3), s1 * 0.75, s1, r() * 6));
      if (!i) b.add(new THREE.IcosahedronGeometry(1, 1), 0x6f9f52, MS(x, s1 * 0.85, z, s1 * 0.7, s1 * 0.22, s1 * 0.65, r()), false);
    }
    ctx.solids.add(x, z, s0 * 0.9);
  }
  b.lift = 0;
}
