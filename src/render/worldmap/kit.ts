// Island tools for the world map: vertex-colored prop batches (four buckets: outlined, heavy line, no outline, glowing), the floating island itself (a top surface with a contour + a base of rock strata tapering downward),
// plateaus and rock pillars (columns with strata bands), cloud puffs, and miniature Seal Towers for each region.
// One MapBatch per island: parts in the same bucket are merged into one mesh by vertex color, so each island has just three or four static meshes; parts carry a per-vertex part id, so part lines still appear between parts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { inkScenery, tagInkPart } from '../ink.ts';
import { sceneMaterial, type SpiritMaterial } from '../spiritToon.ts';
import { M } from '../arenaKit.ts';

export { M, MS, rng } from '../arenaKit.ts';

/** The island's own ambient light, shade color and rim light (the main light direction LIGHT.dir is shared by the whole map, so the shadow directions agree) */
export interface Look {
  ambient: number;
  shadow: number;
  rim: number;
}

const _c = new THREE.Color();
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export { smooth };

/** The island's toon material: reads vertex colors, with the ambient light, shade and rim light swapped for the island's own (swapping the uniforms before onBeforeCompile takes effect) */
export function islandMaterial(look: Look, rim = 0.35): SpiritMaterial {
  const m = sceneMaterial(0xffffff, { rim });
  m.vertexColors = true;
  m.uniforms.uAmbient = { value: new THREE.Color(look.ambient) };
  m.uniforms.uShadowTint = { value: new THREE.Color(look.shadow) };
  m.uniforms.uRimColor = { value: new THREE.Color(look.rim) };
  return m;
}

type Bucket = 'lined' | 'heavy' | 'plain' | 'glow';

/** Vertex-colored prop batch */
export class MapBatch {
  private part = 0;
  private lists: Record<Bucket, THREE.BufferGeometry[]> = { lined: [], heavy: [], plain: [], glow: [] };
  /** true: outlined parts added from now on use the heavy line (landmarks) */
  heavy = false;
  /** Tint on the base color (locked islands fade) */
  tint: (c: THREE.Color) => THREE.Color = (c) => c;
  glowTint: (c: THREE.Color) => THREE.Color = (c) => c;
  /** Brightness multiplier for glowing parts (only above 1 does bloom pick them up a little; without bloom they are still bright flat colors) */
  glowK = 1.7;

  nextPart(): number {
    return this.part++;
  }

  private prep(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: THREE.ColorRepresentation | null, glow: boolean, part: number): THREE.BufferGeometry {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(color === null && k === 'color')) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    if (color !== null) {
      const c = glow ? this.glowTint(_c.set(color).multiplyScalar(this.glowK)) : this.tint(_c.set(color));
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    } else {
      const a = g.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        const c = this.tint(_c.fromBufferAttribute(a, i));
        a.setXYZ(i, c.r, c.g, c.b);
      }
    }
    tagInkPart(g, part);
    return g;
  }

  /** Toon part (outlined by default) */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, m: THREE.Matrix4, lined = true): void {
    this.lists[lined ? (this.heavy ? 'heavy' : 'lined') : 'plain'].push(this.prep(geo, m, color, false, this.part++));
    geo.dispose();
  }

  /** Part with its own vertex colors (island body, plateau); there are no part lines between parts with the same part */
  addVC(geo: THREE.BufferGeometry, m: THREE.Matrix4 = new THREE.Matrix4(), part = this.part++, lined = true): void {
    this.lists[lined ? (this.heavy ? 'heavy' : 'lined') : 'plain'].push(this.prep(geo, m, null, false, part));
    geo.dispose();
  }

  /** Self-lit part (unlit, no outline) */
  glow(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, m: THREE.Matrix4): void {
    this.lists.glow.push(this.prep(geo, m, color, true, 0));
    geo.dispose();
  }

  build(parent: THREE.Object3D, look: Look, rim = 0.35): void {
    const mat = islandMaterial(look, rim);
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    for (const k of ['lined', 'heavy', 'plain', 'glow'] as Bucket[]) {
      const list = this.lists[k];
      if (!list.length) continue;
      const merged = mergeGeometries(list);
      for (const g of list) g.dispose();
      this.lists[k] = [];
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, k === 'glow' ? glowMat : mat);
      parent.add(mesh);
      if (k === 'lined') inkScenery(mesh);
      if (k === 'heavy') inkScenery(mesh, { heavy: true });
    }
  }
}

// ───────────────────────── Contour ─────────────────────────

/** Undulation of the contour: [frequency, amplitude, phase] */
export type Lobes = [number, number, number][];

export class Outline {
  R: number;
  lobes: Lobes;
  constructor(R: number, lobes: Lobes = []) {
    this.R = R;
    this.lobes = lobes;
  }
  rAt(a: number): number {
    let f = 1;
    for (const [k, amp, ph] of this.lobes) f += amp * Math.cos(k * a + ph);
    return this.R * f;
  }
  /** 0 = center, 1 = edge */
  rho(x: number, z: number): number {
    return Math.hypot(x, z) / this.rAt(Math.atan2(z, x));
  }
  inside(x: number, z: number, margin = 0): boolean {
    return Math.hypot(x, z) < this.rAt(Math.atan2(z, x)) - margin;
  }
}

/** A polar grid ring by ring from the inside out (6i points per ring, zipper triangulation), with triangles of even size */
function polarTop(o: Outline, rings: number, yAt: (x: number, z: number, rho: number) => number): { pos: number[]; idx: number[]; rim: number[] } {
  const pos: number[] = [0, yAt(0, 0, 0), 0];
  const idx: number[] = [];
  let prev = [0];
  let prevA = [0];
  for (let i = 1; i <= rings; i++) {
    const n = 6 * i;
    const off = (i % 2) * (Math.PI / n);
    const cur: number[] = [];
    const curA: number[] = [];
    for (let j = 0; j < n; j++) {
      const a = off + (j / n) * Math.PI * 2;
      const rho = i / rings;
      const r = o.rAt(a) * rho;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      cur.push(pos.length / 3);
      curA.push(a);
      pos.push(x, yAt(x, z, rho), z);
    }
    zip(prev, prevA, cur, curA, idx);
    prev = cur;
    prevA = curA;
  }
  return { pos, idx, rim: prev };
}

/** Zipper triangulation between two rings (both rings' angles increase and wrap around) */
function zip(A: number[], aA: number[], B: number[], aB: number[], idx: number[]): void {
  const na = A.length;
  const nb = B.length;
  if (na === 1) {
    for (let j = 0; j < nb; j++) idx.push(A[0], B[(j + 1) % nb], B[j]);
    return;
  }
  const ang = (arr: number[], i: number) => arr[i % arr.length] + Math.floor(i / arr.length) * Math.PI * 2;
  let ia = 0;
  let ib = 0;
  while (ia < na || ib < nb) {
    const nextA = ang(aA, ia + 1);
    const nextB = ang(aB, ib + 1);
    if (ib >= nb || (ia < na && nextA <= nextB)) {
      idx.push(A[ia % na], A[(ia + 1) % na], B[ib % nb]);
      ia++;
    } else {
      idx.push(A[ia % na], B[(ib + 1) % nb], B[ib % nb]);
      ib++;
    }
  }
}

/** Triangle orientation: flip the face when the normal points opposite to out(centroid) */
function orient(pos: number[], idx: number[], out: (cx: number, cy: number, cz: number) => [number, number, number]): void {
  const p = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    const a = p(idx[t]);
    const b = p(idx[t + 1]);
    const c = p(idx[t + 2]);
    const n = e1.subVectors(b, a).cross(e2.subVectors(c, a));
    const [ox, oy, oz] = out((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3);
    if (n.x * ox + n.y * oy + n.z * oz < 0) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
  }
}

/** Footprint: the contact shadow under a prop (darkened when the top surface is colored) */
export interface Foot {
  x: number;
  z: number;
  r: number;
  k: number;
}

export interface BodySpec {
  outline: Outline;
  /** Top surface height (local coordinates) */
  h: (x: number, z: number) => number;
  /** Top surface color */
  paint: (x: number, z: number, y: number, out: THREE.Color) => void;
  /** Rock strata bands (cycling from top to bottom) */
  strata: number[];
  /** Base depth */
  depth: number;
  /** Height of the vertical cliff face at the edge */
  lip?: number;
  rings?: number;
  seed?: number;
  /** Offset of the rock cone tip from the center */
  tip?: [number, number];
  /** Thickness of one strata band */
  band?: number;
  /** Amplitude of the base surface undulation (0 to 1) */
  rough?: number;
}

/** Top surface height + rounding off the edge */
export function topY(spec: BodySpec, x: number, z: number): number {
  const rho = spec.outline.rho(x, z);
  return spec.h(x, z) - 0.1 * smooth(0.84, 1, rho);
}

const noise = (a: number, k: number, s: number) => Math.sin(a * 3 + s + k * 1.7) * 0.55 + Math.sin(a * 5 + s * 2.3 + k * 0.9) * 0.3 + Math.sin(a * 11 + s * 0.7 + k * 2.9) * 0.15;

/**
 * The floating island itself: the top surface (smooth normals, colored per vertex) + the base (a vertical cliff edge, tapering ring by ring into a rock cone, each face colored with a strata color by height).
 * The top surface and the base are two parts, and the cliff edge has a part line
 */
export function islandBody(spec: BodySpec, feet: Foot[] = []): { top: THREE.BufferGeometry; under: THREE.BufferGeometry } {
  const o = spec.outline;
  const rings = spec.rings ?? 11;
  const lip = spec.lip ?? 0.22;
  const D = spec.depth;
  const s = spec.seed ?? 1;
  const rough = spec.rough ?? 1;
  const top = polarTop(o, rings, (x, z) => topY(spec, x, z));
  orient(top.pos, top.idx, () => [0, 1, 0]);
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(top.pos, 3));
  tg.setIndex(top.idx);
  tg.computeVertexNormals();
  const cols = new Float32Array(top.pos.length);
  const c = new THREE.Color();
  for (let i = 0; i < top.pos.length / 3; i++) {
    const x = top.pos[i * 3];
    const y = top.pos[i * 3 + 1];
    const z = top.pos[i * 3 + 2];
    spec.paint(x, z, y, c);
    let k = 1;
    for (const f of feet) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r) k *= 1 - f.k * Math.pow(1 - d / f.r, 1.2);
    }
    c.multiplyScalar(k);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));

  // Base: a vertical cliff edge, tapering ring by ring into a rock cone. Between each pair of rings is one stratum (the whole ring a single color), and the band's upper and lower edges undulate with the angle, so there is no sawtooth
  const n = top.rim.length;
  const [tx, tz] = spec.tip ?? [0, 0];
  const band = spec.band ?? 0.3;
  const K = Math.max(5, Math.round((D - lip) / band));
  // Tapering profile: depth fraction → radius fraction
  const prof: [number, number][] = [[0, 1], [0.06, 0.95], [0.22, 0.85], [0.42, 0.7], [0.62, 0.5], [0.82, 0.27], [1, 0]];
  const fAt = (t: number) => {
    for (let i = 1; i < prof.length; i++) {
      if (t <= prof[i][0]) {
        const [t0, f0] = prof[i - 1];
        const [t1, f1] = prof[i];
        return f0 + ((t - t0) / (t1 - t0)) * (f1 - f0);
      }
    }
    return 0;
  };
  const rows: number[][] = [top.rim.flatMap((i) => [top.pos[i * 3], top.pos[i * 3 + 1], top.pos[i * 3 + 2]])];
  for (let k = 0; k < K; k++) {
    const t = k / K;
    const f = fAt(t);
    const j = Math.min(1, t * 2.5) * rough;
    const ring: number[] = [];
    for (let q = 0; q < n; q++) {
      const ri = top.rim[q];
      const a = Math.atan2(top.pos[ri * 3 + 2], top.pos[ri * 3]);
      const rr = o.rAt(a) * f * (1 + j * (0.12 * noise(a, k * 0.35, s) + 0.05 * Math.sin(a * 13 + k * 0.7 + s)));
      const y = k === 0 ? top.pos[ri * 3 + 1] - lip : -lip - t * (D - lip) + j * 0.06 * D * noise(a * 1.2, 4, s);
      ring.push(tx * t + Math.cos(a) * rr, y, tz * t + Math.sin(a) * rr);
    }
    rows.push(ring);
  }
  const rowCols = rows.slice(1).map((_, k) => {
    const c = new THREE.Color(spec.strata[k === 0 ? 0 : (k + Math.floor(k / 3)) % spec.strata.length]);
    return c.multiplyScalar(1 - Math.min(0.28, (k / K) * 0.32));
  });
  const under = ringsMesh(rows, rowCols, new THREE.Vector3(tx, -D, tz), (x, y, z) => [x, y + 0.45 * D, z]);
  return { top: tg, under };
}

/**
 * A side surface joined downward from rings (with equal point counts): first compute smooth normals over shared vertices, then split them apart, and each row (between two rings) is painted one color.
 * If tip is given, it ends in a single point
 */
function ringsMesh(rings: number[][], rowCols: THREE.Color[], tip: THREE.Vector3 | null, out: (x: number, y: number, z: number) => [number, number, number]): THREE.BufferGeometry {
  const n = rings[0].length / 3;
  const pos: number[] = rings.flat();
  const idx: number[] = [];
  for (let k = 1; k < rings.length; k++) {
    const a0 = (k - 1) * n;
    const b0 = k * n;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      idx.push(a0 + j, a0 + j2, b0 + j2, a0 + j, b0 + j2, b0 + j);
    }
  }
  if (tip) {
    const ti = pos.length / 3;
    pos.push(tip.x, tip.y, tip.z);
    const a0 = (rings.length - 1) * n;
    for (let j = 0; j < n; j++) idx.push(a0 + j, a0 + ((j + 1) % n), ti);
  }
  orient(pos, idx, out);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ng = g.toNonIndexed();
  g.dispose();
  const cols = new Float32Array(ng.attributes.position.count * 3);
  const per = n * 2;
  for (let t = 0; t < idx.length / 3; t++) {
    const row = Math.min(rowCols.length - 1, Math.floor(t / per));
    const c = rowCols[row];
    for (let v = 0; v < 3; v++) cols.set([c.r, c.g, c.b], (t * 3 + v) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return ng;
}

/**
 * Plateaus, rock pillars, platforms: contour o, bottom y0, top y1, with a flat top (a color function may be given) and strata bands on the sides.
 * The bottom flares out slightly and is buried in the ground, so no seam shows where it meets the ground
 */
export function slab(
  o: Outline,
  y0: number,
  y1: number,
  top: number | ((x: number, z: number) => number),
  side: number[],
  opts: { band?: number; seed?: number; taper?: number; rings?: number; rough?: number } = {},
): THREE.BufferGeometry {
  const rings = opts.rings ?? 4;
  const taper = opts.taper ?? 1.06;
  const s = opts.seed ?? 1;
  const rough = opts.rough ?? 1;
  const t = polarTop(o, rings, (x, z, rho) => y1 + 0.02 * (1 - rho * rho));
  orient(t.pos, t.idx, () => [0, 1, 0]);
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
  tg.setIndex(t.idx);
  tg.computeVertexNormals();
  const tc = new Float32Array(t.pos.length);
  const c = new THREE.Color();
  for (let i = 0; i < t.pos.length / 3; i++) {
    c.set(typeof top === 'number' ? top : top(t.pos[i * 3], t.pos[i * 3 + 2]));
    tc.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  const n = t.rim.length;
  const H = y1 - y0;
  const band = opts.band ?? 0.12;
  const steps = Math.max(2, Math.round(H / band));
  const rows: number[][] = [];
  for (let k = 0; k <= steps; k++) {
    const f = k / steps;
    const ring: number[] = [];
    for (let j = 0; j < n; j++) {
      const ri = t.rim[j];
      const a = Math.atan2(t.pos[ri * 3 + 2], t.pos[ri * 3]);
      const wob = k === 0 ? 0 : rough * 0.05 * noise(a * 1.5, k, s);
      const rr = o.rAt(a) * (1 + (taper - 1) * f + wob);
      const y = k === 0 ? t.pos[ri * 3 + 1] : k === steps ? y0 - 0.06 : y1 - H * f + rough * 0.025 * noise(a * 2, 7, s);
      ring.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
    rows.push(ring);
  }
  const rowCols = rows.slice(1).map((_, k) => new THREE.Color(side[(k + Math.floor(k / 4)) % side.length]));
  const sn = ringsMesh(rows, rowCols, null, (x, _y, z) => [x, 0, z]);
  const tn = tg.toNonIndexed();
  tg.dispose();
  const merged = mergeGeometries([tn, sn])!;
  tn.dispose();
  sn.dispose();
  return merged;
}

/** A cloud puff: a few squashed icosahedra merged into one mesh */
export function cloudGeo(n: number, spread: number, r: () => number, size = 1): THREE.BufferGeometry {
  const puffs: THREE.BufferGeometry[] = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.IcosahedronGeometry((0.55 + r() * 0.45) * size * (k === Math.floor(n / 2) ? 1.3 : 1), 1);
    g.scale(1, 0.62, 1);
    g.translate((k / Math.max(1, n - 1) - 0.5) * spread * 2, r() * 0.25 * size, (r() - 0.5) * spread * 0.7);
    puffs.push(g);
  }
  const m = mergeGeometries(puffs)!;
  for (const g of puffs) g.dispose();
  return m;
}

// ───────────────────────── Seal Tower ─────────────────────────

export interface TowerStyle {
  stone: number;
  stoneDark: number;
  trim: number;
  roof: number;
  glow: number;
  kind: 'pagoda' | 'spire' | 'ruin';
}

export const CORRUPT = 0x9a3aff;

/**
 * Miniature Seal Tower: an octagonal stone base, a four-story body (a ring of runes on each story), eaves and a pointed roof.
 * In a cleared tower the runes light up in the element's color and the source crystal at the top glows; in an uncleared tower the runes are corrupted purple. Returns the tower top (the source crystal's position, in local coordinates)
 */
export function miniTower(b: MapBatch, x: number, y: number, z: number, st: TowerStyle, s: number, cleared: boolean, ry = 0): THREE.Vector3 {
  const T = (px: number, py: number, pz: number, rot = 0, sc = 1, rx = 0) => {
    const v = new THREE.Vector3(px * s, py * s, pz * s).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    return M(x + v.x, y + v.y, z + v.z, rot + ry, sc * s, rx);
  };
  const rune = cleared ? st.glow : CORRUPT;
  const oct = Math.PI / 8;
  b.add(new THREE.CylinderGeometry(0.4, 0.44, 0.14, 8), st.stoneDark, T(0, 0.02, 0, oct));
  b.add(new THREE.CylinderGeometry(0.33, 0.36, 0.12, 8), st.stone, T(0, 0.15, 0, oct));
  b.add(new THREE.BoxGeometry(0.2, 0.08, 0.16), st.stone, T(0, 0.06, 0.4));
  const floors = 4;
  let yb = 0.21;
  const r0 = 0.25;
  const r1 = st.kind === 'spire' ? 0.13 : 0.16;
  for (let i = 0; i < floors; i++) {
    const r = r0 + ((r1 - r0) * i) / (floors - 1);
    const wh = i === 0 ? 0.36 : 0.26;
    const broken = st.kind === 'ruin' && i === floors - 1;
    if (broken) {
      // Collapsed top story: only two broken walls are left
      b.add(new THREE.BoxGeometry(r * 0.9, wh * 0.9, r * 0.45), st.stone, T(-r * 0.4, yb + wh * 0.45, 0, 0.3));
      b.add(new THREE.BoxGeometry(r * 0.6, wh * 0.55, r * 0.45), st.stoneDark, T(r * 0.45, yb + wh * 0.28, -r * 0.2, -0.5));
      yb += wh * 0.6;
      break;
    }
    b.add(new THREE.CylinderGeometry(r * 0.94, r, wh, 8), st.stone, T(0, yb + wh / 2, 0, oct));
    b.glow(new THREE.CylinderGeometry(r * 0.985, r * 0.99, 0.035, 8, 1, true), rune, T(0, yb + wh * 0.3, 0, oct));
    if (i === 0) b.add(new THREE.BoxGeometry(0.14, 0.2, 0.06), st.stoneDark, T(0, yb + 0.1, r * 0.95));
    const er = r * (st.kind === 'pagoda' ? 1.5 : 1.25);
    b.add(new THREE.CylinderGeometry(r * 0.8, er, st.kind === 'pagoda' ? 0.09 : 0.07, 8), st.roof, T(0, yb + wh + 0.035, 0, oct));
    yb += wh + 0.07;
  }
  if (st.kind !== 'ruin') {
    const sh = st.kind === 'spire' ? 0.5 : 0.3;
    b.add(new THREE.ConeGeometry(r1 * 0.95, sh, 8), st.roof, T(0, yb + sh / 2, 0, oct));
    b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5), st.trim, T(0, yb + sh + 0.07, 0), false);
    yb += sh + 0.1;
  }
  const v = new THREE.Vector3(0, (yb + 0.2) * s, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  return new THREE.Vector3(x + v.x, y + v.y, z + v.z);
}
