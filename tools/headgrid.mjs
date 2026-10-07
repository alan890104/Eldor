// Head-shape data for the map characters: sampled from the head meshes of KayKit Character Pack: Adventurers and written to src/render/field/headData.ts.
// Source: KayKit Character Pack: Adventurers 1.0 by Kay Lousberg (www.kaylousberg.com), licensed CC0 1.0 (public domain, commercial use allowed, no attribution required).
// The original files (GLB) are not in the repo; only this tool and the slimmed-down converted data are kept. After downloading, point at the Characters/gltf folder:
//   node tools/headgrid.mjs <…/kaykit_character_pack_adventures/Characters/gltf> [output file, default src/render/field/headData.ts]
//
// How it works:
// 1. Read the head meshes of Barbarian.glb and Knight.glb (same skeleton, same skull), weld them by vertex position and split into connected components:
//    the largest is the skull (the Barbarian's skull is joined to the beard, the Knight's to the hair); the rest are small separate pieces for brows, eyes, nose and ears.
// 2. Skull: cast rays from the head center in every direction, take the nearest hit on each of the two skulls, then take the nearer of the two. The beard is only on the Barbarian and the hair only on the Knight,
//    and both sit higher than the scalp, so taking the nearer leaves a bald, beardless skull. Brows, eyes, nose and ears are not in the main component, so they are naturally never sampled (the ears do not get pulled into a skirt).
// 3. Coordinates are normalized so the half-width, half-height and half-depth are all 1 (origin at the center of the skull's bounding box, +z forward, +y up); the game's HeadShape then scales by rx, ry, rz.
// 4. The sampling grid (θ around the y axis, 0 toward +z; φ measured from the top of the head) gets a few passes of small-radius smoothing to remove the facets of the low-poly original; the game samples it with bicubic interpolation.
// 5. The nose is saved separately as a small mesh (Loop subdivision once, which rounds the edges) and normalized as well; the positions and sizes of the eyes, brows and ears are saved as reference values.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [dir, out = 'src/render/field/headData.ts'] = process.argv.slice(2);
if (!dir) throw new Error('Usage: node tools/headgrid.mjs <KayKit Characters/gltf folder> [output file]');

// ───────── GLB ─────────

function readGlb(file) {
  const b = readFileSync(file);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
  const o = 20 + jl;
  const bl = b.readUInt32LE(o);
  const bin = b.subarray(o + 8, o + 8 + bl);
  return { json, bin };
}

const COMP = { 5121: [Uint8Array, 1], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function accessor({ json, bin }, i) {
  const a = json.accessors[i];
  const bv = json.bufferViews[a.bufferView];
  const [T, size] = COMP[a.componentType];
  const n = NUM[a.type];
  const stride = bv.byteStride || size * n;
  const base = bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const dv = new DataView(bin.buffer);
  const outArr = new Array(a.count * n);
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < n; c++) {
      const at = base + k * stride + c * size;
      outArr[k * n + c] = T === Float32Array ? dv.getFloat32(at, true) : T === Uint16Array ? dv.getUint16(at, true) : T === Uint32Array ? dv.getUint32(at, true) : dv.getUint8(at);
    }
  return outArr;
}

/** A node's mesh: vertices (standing pose, model space) and triangle indices */
function headMesh(file, nodeName) {
  const g = readGlb(file);
  const node = g.json.nodes.find((n) => n.name === nodeName);
  if (!node) throw new Error(`${file} has no ${nodeName}`);
  const prim = g.json.meshes[node.mesh].primitives[0];
  const pos = accessor(g, prim.attributes.POSITION);
  const idx = accessor(g, prim.indices);
  const P = [];
  for (let i = 0; i < pos.length; i += 3) P.push([pos[i], pos[i + 1], pos[i + 2]]);
  const T = [];
  for (let i = 0; i < idx.length; i += 3) T.push([idx[i], idx[i + 1], idx[i + 2]]);
  return { P, T };
}

/** Connected components after welding by position; each is a list of triangles, with a bounding box */
function components({ P, T }) {
  const key = new Map();
  const wid = P.map((p) => {
    const k = p.map((x) => Math.round(x * 1e5)).join(',');
    if (!key.has(k)) key.set(k, key.size);
    return key.get(k);
  });
  const parent = Array.from({ length: key.size }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (const [a, b, c] of T) {
    for (const [u, v] of [[a, b], [b, c]]) {
      const ru = find(wid[u]);
      const rv = find(wid[v]);
      if (ru !== rv) parent[ru] = rv;
    }
  }
  const map = new Map();
  T.forEach((t, i) => {
    const r = find(wid[t[0]]);
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(i);
  });
  return [...map.values()]
    .map((tris) => {
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (const ti of tris)
        for (const vi of T[ti])
          for (let c = 0; c < 3; c++) {
            lo[c] = Math.min(lo[c], P[vi][c]);
            hi[c] = Math.max(hi[c], P[vi][c]);
          }
      const mid = lo.map((l, c) => (l + hi[c]) / 2);
      return { tris, lo, hi, mid };
    })
    .sort((a, b) => b.tris.length - a.tris.length);
}

// ───────── Rays ─────────

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Distance to the nearest intersection from o along d (double-sided); Infinity if nothing is hit */
function cast(o, d, tris) {
  let best = Infinity;
  for (const [a, b, c] of tris) {
    const e1 = sub(b, a);
    const e2 = sub(c, a);
    const p = cross(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const s = sub(o, a);
    const u = dot(s, p) * inv;
    if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(s, e1);
    const v = dot(d, q) * inv;
    if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const t = dot(e2, q) * inv;
    if (t > 1e-6 && t < best) best = t;
  }
  return best;
}

const dirOf = (phi, th) => [Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th)];

// ───────── Sampling ─────────

const NT = 64;
const NP = 33;
const barb = headMesh(path.join(dir, 'Barbarian.glb'), 'Barbarian_Head');
const knight = headMesh(path.join(dir, 'Knight.glb'), 'Knight_Head');
const bc = components(barb);
const kc = components(knight);
const triPts = (m, c) => c.tris.map((ti) => m.T[ti].map((vi) => m.P[vi]));
const skulls = [triPts(barb, bc[0]), triPts(knight, kc[0])];

/** Take the nearer of the two skulls: o is the origin, xf converts original-file coordinates to sampling coordinates */
function sampleGrid(o, xf) {
  const S = skulls.map((ts) => ts.map((t) => t.map(xf)));
  const r = [];
  let miss = 0;
  for (let i = 0; i < NP; i++) {
    const phi = (i / (NP - 1)) * Math.PI;
    for (let j = 0; j < NT; j++) {
      const th = (j / NT) * 2 * Math.PI;
      const d = dirOf(phi, th);
      const t = Math.min(...S.map((ts) => cast(o, d, ts)));
      if (!Number.isFinite(t)) miss++;
      r.push(t);
    }
  }
  return { r, miss };
}

// First pass: sample from the approximate head center in original-file coordinates and measure the skull's bounding box
const c0 = [0, 1.7, 0.02];
const first = sampleGrid(c0, (p) => p);
const lo = [Infinity, Infinity, Infinity];
const hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < NP; i++)
  for (let j = 0; j < NT; j++) {
    const t = first.r[i * NT + j];
    if (!Number.isFinite(t)) continue;
    const d = dirOf((i / (NP - 1)) * Math.PI, (j / NT) * 2 * Math.PI);
    for (let c = 0; c < 3; c++) {
      const v = c0[c] + d[c] * t;
      lo[c] = Math.min(lo[c], v);
      hi[c] = Math.max(hi[c], v);
    }
  }
const C = lo.map((l, c) => (l + hi[c]) / 2);
C[0] = 0;
const H = lo.map((l, c) => (hi[c] - l) / 2);
const norm = (p) => [(p[0] - C[0]) / H[0], (p[1] - C[1]) / H[1], (p[2] - C[2]) / H[2]];

// Second pass: sample from the origin in normalized coordinates
const { r, miss } = sampleGrid([0, 0, 0], norm);
if (miss) {
  // Opening at the neck (if any): fill with the average of the same row
  for (let i = 0; i < NP; i++) {
    const row = r.slice(i * NT, i * NT + NT).filter(Number.isFinite);
    const avg = row.length ? row.reduce((a, b) => a + b, 0) / row.length : 1;
    for (let j = 0; j < NT; j++) if (!Number.isFinite(r[i * NT + j])) r[i * NT + j] = avg;
  }
}

// Smoothing: θ wraps all the way around, φ folds back at the poles (crossing a pole is the same as turning to the opposite meridian)
const at = (g, i, j) => {
  if (i < 0) return at(g, -i, j + NT / 2);
  if (i > NP - 1) return at(g, 2 * (NP - 1) - i, j + NT / 2);
  return g[i * NT + (((j % NT) + NT) % NT)];
};
let g = r;
for (let pass = 0; pass < 3; pass++) {
  const n = new Array(g.length);
  for (let i = 0; i < NP; i++)
    for (let j = 0; j < NT; j++) {
      let s = 0;
      let w = 0;
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const k = (di ? 1 : 2) * (dj ? 1 : 2);
          s += at(g, i + di, j + dj) * k;
          w += k;
        }
      n[i * NT + j] = s / w;
    }
  g = n;
}
// The row at each pole is a single point
for (const i of [0, NP - 1]) {
  const avg = g.slice(i * NT, i * NT + NT).reduce((a, b) => a + b, 0) / NT;
  for (let j = 0; j < NT; j++) g[i * NT + j] = avg;
}

// ───────── Nose, ears, eyes, brows ─────────

const near = (list, fn) => list.slice(1).reduce((best, c) => (fn(c) < fn(best) ? c : best));
const nose = near(kc, (c) => Math.abs(c.mid[0]) * 4 - c.hi[2]);
const ear = near(kc, (c) => -c.mid[0]);
const eye = near(kc, (c) => Math.hypot(c.mid[0] - 0.2, c.mid[1] - 1.6));
const brow = near(kc, (c) => Math.hypot(c.mid[0] - 0.2, c.mid[1] - 1.74));

/** Turn one connected component into a slim mesh: welded vertices (normalized coordinates) and indices */
function pack(m, comp) {
  const map = new Map();
  const pos = [];
  const idx = [];
  for (const ti of comp.tris)
    for (const vi of m.T[ti]) {
      const p = norm(m.P[vi]);
      const k = p.map((x) => Math.round(x * 1e4)).join(',');
      if (!map.has(k)) {
        map.set(k, pos.length / 3);
        pos.push(...p);
      }
      idx.push(map.get(k));
    }
  return { pos, idx };
}
/**
 * Loop subdivision: each triangle is split into four, old vertices move toward the average of their neighbors, new vertices on edges take a weighted mix of the two endpoints and the two opposite vertices; boundaries follow the boundary rules.
 * The original nose is a 26-vertex wedge; after subdivision the edges are rounded, so the smooth normals do not come out in patches.
 */
function loop({ pos, idx }) {
  const V = [];
  for (let i = 0; i < pos.length; i += 3) V.push([pos[i], pos[i + 1], pos[i + 2]]);
  const T = [];
  for (let i = 0; i < idx.length; i += 3) T.push([idx[i], idx[i + 1], idx[i + 2]]);
  const ek = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const edges = new Map();
  for (const t of T)
    for (let k = 0; k < 3; k++) {
      const a = t[k];
      const b = t[(k + 1) % 3];
      const c = t[(k + 2) % 3];
      const key = ek(a, b);
      if (!edges.has(key)) edges.set(key, { a, b, opp: [] });
      edges.get(key).opp.push(c);
    }
  const nb = V.map(() => new Set());
  const bnb = V.map(() => []);
  for (const e of edges.values()) {
    nb[e.a].add(e.b);
    nb[e.b].add(e.a);
    if (e.opp.length === 1) {
      bnb[e.a].push(e.b);
      bnb[e.b].push(e.a);
    }
  }
  const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const out = V.map((v, i) => {
    if (bnb[i].length >= 2) return add(add(v.map((x) => x * 0.75), V[bnb[i][0]], 0.125), V[bnb[i][1]], 0.125);
    const n = nb[i].size;
    const beta = n > 3 ? 3 / (8 * n) : 3 / 16;
    let r = v.map((x) => x * (1 - n * beta));
    for (const j of nb[i]) r = add(r, V[j], beta);
    return r;
  });
  const mid = new Map();
  for (const [key, e] of edges) {
    let p;
    if (e.opp.length === 2) p = add(add(add(add([0, 0, 0], V[e.a], 3 / 8), V[e.b], 3 / 8), V[e.opp[0]], 1 / 8), V[e.opp[1]], 1 / 8);
    else p = add(add([0, 0, 0], V[e.a], 0.5), V[e.b], 0.5);
    mid.set(key, out.length);
    out.push(p);
  }
  const ni = [];
  for (const [a, b, c] of T) {
    const ab = mid.get(ek(a, b));
    const bc = mid.get(ek(b, c));
    const ca = mid.get(ek(c, a));
    ni.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  return { pos: out.flat(), idx: ni };
}

const box = (c) => {
  const a = norm(c.lo);
  const b = norm(c.hi);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (b[0] - a[0]) / 2, (b[1] - a[1]) / 2, (b[2] - a[2]) / 2].map((x) => +x.toFixed(4));
};

const f3 = (a) => a.map((x) => +x.toFixed(4));
const noseRaw = pack(knight, nose);
const noseM = loop(noseRaw);
const ts = `// Auto-generated: node tools/headgrid.mjs (do not edit by hand; to change it, change the tool and rerun).
// Source: KayKit Character Pack: Adventurers 1.0, Kay Lousberg (www.kaylousberg.com), licensed CC0 1.0 (public domain,
// commercial use allowed, no attribution required).
// Skull: the main head meshes of the Barbarian and the Knight are sampled radially from the head center,
// taking whichever of the two is nearer (beard and hair removed), smoothed 3 times; brows, eyes, nose and ears are not in the sampling.
// Coordinates are normalized: the skull's half-width, half-height and half-depth are all 1, the origin is at the center of
// the skull's bounding box, +z faces front and +y faces up.
// The original file's skull half-width, half-height, half-depth: ${H.map((x) => x.toFixed(3)).join(', ')}.

/**
 * Radial sampling of the skull: r[i * nt + j], φ = i / (np − 1) · π (measured from the top of the head),
 * θ = j / nt · 2π (around the y axis, 0 faces +z, positive toward +x)
 */
export const HEAD_GRID = { nt: ${NT}, np: ${NP}, r: [${g.map((x) => +x.toFixed(4)).join(',')}] };

/** The nose (the Knight's nose, Loop-subdivided once): vertices and triangle indices */
export const HEAD_NOSE = { pos: [${f3(noseM.pos).join(',')}], idx: [${noseM.idx.join(',')}] };

/**
 * The skull bounding box used for normalization (original file coordinates): center and half-width, half-height, half-depth;
 * other data converted from the same meshes (kaykitHeads.ts) is aligned to this
 */
export const HEAD_BOX = { c: [${f3(C).join(', ')}], h: [${f3(H).join(', ')}] };

/** Bounding box of the original file's facial features (the +x side): [center x, y, z, half-width, half-height, half-depth] */
export const HEAD_REF = { eye: [${box(eye).join(', ')}], brow: [${box(brow).join(', ')}], nose: [${box(nose).join(', ')}], ear: [${box(ear).join(', ')}] };
`;
writeFileSync(out, ts);
console.log(`skull ${skulls.map((s) => s.length).join('/')} faces, ${miss} rays missed; center ${C.map((x) => x.toFixed(3))}, radius ${H.map((x) => x.toFixed(3))}`);
console.log(`nose ${noseRaw.idx.length / 3} → ${noseM.idx.length / 3} faces; wrote ${out}`);
