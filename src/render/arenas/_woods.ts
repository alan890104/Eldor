// Props and shaders shared by the Whispering Forest and the Duskshade Realm: giant trees (buttress roots, burls, branches, canopy), glowing mushrooms and fungus rings, ferns, mossy stones,
// hanging ropes and spider silk, treehouses and spiral stairs, light pillars, mist bands, lake surfaces, ground decals and breathing lamplight. Depends only on three and arenaKit.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, type ArenaCtx, type PropBatch } from '../arenaKit.ts';

const UP = new THREE.Vector3(0, 1, 0);
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
type Extras = ArenaCtx['extras'];
type Disposers = ArenaCtx['disposers'];

// ───────────────────────── Segments, hanging curves and tilt ─────────────────────────

/** Place a unit cylinder (radius 1, height 1, centered at the origin) as a segment a→b */
export function segM(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.Matrix4 {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(d.length(), 1e-4);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(len));
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(radius, len, radius));
}

/** Take n+1 points along a hanging curve (sag is the drop at the midpoint) */
export function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number, n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(a.clone().lerp(b, u).setY(a.y + (b.y - a.y) * u - sag * 4 * u * (1 - u)));
  }
  return pts;
}

/** Build a hanging line out of thin cylinders (rope, spider silk); glow makes a glowing line */
export function rope(b: PropBatch, a: THREE.Vector3, c: THREE.Vector3, sag: number, radius: number, col: number, glow = false, n = 10): void {
  const pts = catenary(a, c, sag, n);
  for (let i = 0; i < n; i++) {
    const m = segM(pts[i], pts[i + 1], radius);
    if (glow) b.glow(new THREE.CylinderGeometry(1, 1, 1, 4), col, m);
    else b.add(new THREE.CylinderGeometry(1, 1, 1, 5), col, m, false);
  }
}

/** Tilt direction: a unit vector with horizontal angle a and angle tilt radians from vertical */
export const leanDir = (a: number, tilt: number) => V(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));

/**
 * A slender object with base as its bottom, leaning outward toward horizontal angle a by tilt radians, with length len (the geometry is centered at the origin; local Z is the "thin" direction).
 * geoLen is the geometry's own height: by default it is assumed to be built at len height already; with a height-1 template pass 1 and it stretches to len
 */
export function leanM(base: THREE.Vector3, a: number, tilt: number, len: number, sx = 1, sz = 1, geoLen = len): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, -tilt, 'XYZ'));
  return new THREE.Matrix4().compose(base.clone().addScaledVector(leanDir(a, tilt), len / 2), q, new THREE.Vector3(sx, len / geoLen, sz));
}

// ───────────────────────── Giant tree ─────────────────────────

export interface TreeOpts {
  /** Radius at the bottom of the trunk */
  radius: number;
  height: number;
  trunk: number;
  /** Color of the buttress roots and burls (slightly darker, so the base of the trunk has depth) */
  bark?: number;
  leaves: number[];
  /** blob: clumps of round balls (forest); umbrella: a flat umbrella cap like an umbrella mushroom (realm); none: trunk only */
  canopy: 'blob' | 'umbrella' | 'none';
  /** Glow color of the underside of the umbrella cap (umbrella) */
  rimGlow?: number;
  roots?: number;
  burls?: number;
  branches?: number;
  /** Height range where the branches sit (fraction of tree height) */
  branchBand?: [number, number];
}

/** Buttress root: a thin wedge hugging the trunk and tapering outward and downward, with a concave outer edge */
function rootFin(len: number, h: number, th: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(0, h);
  sh.lineTo(0, 0);
  sh.lineTo(len, 0);
  sh.quadraticCurveTo(len * 0.3, h * 0.15, 0, h);
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -th / 2);
  return g;
}

/** Giant tree: more than ten times taller than a spirit, with buttress roots and burls at the base and canopy-bearing branches extending from the middle */
export function giantTree(b: PropBatch, x: number, z: number, o: TreeOpts, r: () => number): void {
  const R = o.radius;
  const H = o.height;
  const bark = o.bark ?? o.trunk;
  const a0 = r() * Math.PI * 2;
  b.add(new THREE.CylinderGeometry(R * 0.5, R, H, 10), o.trunk, M(x, H / 2, z, a0));
  // Root flare: a ring spreading outward at the base
  b.add(new THREE.CylinderGeometry(R, R * 1.3, R * 0.7, 10), bark, M(x, R * 0.35 - 0.05, z, a0));
  const nr = o.roots ?? 5;
  for (let i = 0; i < nr; i++) {
    const a = a0 + (i / nr) * Math.PI * 2 + (r() - 0.5) * 0.5;
    b.add(rootFin(R * (1.4 + r()), R * (0.9 + r() * 0.8), R * 0.22), bark, M(x + Math.cos(a) * R * 0.9, -0.02, z + Math.sin(a) * R * 0.9, -a));
  }
  const nb = o.burls ?? 3;
  for (let i = 0; i < nb; i++) {
    const a = r() * Math.PI * 2;
    const y = H * (0.08 + r() * 0.35);
    const ry = R * (1 - (0.5 * y) / H);
    const g = new THREE.SphereGeometry(R * (0.3 + r() * 0.25), 8, 6);
    g.scale(0.6, 0.75, 1);
    b.add(g, bark, M(x + Math.cos(a) * ry * 0.9, y, z + Math.sin(a) * ry * 0.9, -a));
  }
  // Branches (each ends in a clump of canopy): placed low, so the low-angle battle camera can see them
  const C = R * 3.6;
  const nbr = o.branches ?? 3;
  const [b0, b1] = o.branchBand ?? [0.4, 0.7];
  for (let i = 0; i < nbr; i++) {
    const a = a0 + 1.2 + (i / nbr) * Math.PI * 2 + (r() - 0.5) * 0.8;
    const y = H * (b0 + ((b1 - b0) * (i + r() * 0.6)) / nbr);
    const ry = R * (1 - (0.5 * y) / H);
    const tilt = 0.9 + r() * 0.4;
    const len = R * (2.6 + r() * 1.4);
    const base = V(x + Math.cos(a) * ry * 0.8, y, z + Math.sin(a) * ry * 0.8);
    b.add(new THREE.CylinderGeometry(R * 0.1, R * 0.2, len, 7), o.trunk, leanM(base, a, tilt, len));
    if (o.canopy === 'blob') {
      const tip = base.clone().addScaledVector(leanDir(a, tilt), len);
      b.add(new THREE.IcosahedronGeometry(C * (0.32 + r() * 0.12), 1), o.leaves[i % o.leaves.length], M(tip.x, tip.y + C * 0.1, tip.z, r() * 6));
    }
  }
  if (o.canopy === 'blob') {
    const top = H - C * 0.35;
    b.add(new THREE.IcosahedronGeometry(C * 0.8, 1), o.leaves[0], M(x, top + C * 0.15, z, r() * 6));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r();
      b.add(new THREE.IcosahedronGeometry(C * (0.45 + r() * 0.2), 1), o.leaves[(i + 1) % o.leaves.length], M(x + Math.cos(a) * C * 0.6, top - C * 0.15 + r() * C * 0.3, z + Math.sin(a) * C * 0.6, r() * 6));
    }
  } else if (o.canopy === 'umbrella') {
    // Umbrella-mushroom style: a flat hemispherical cap, inverted-cone gills underneath, a ring of glow along the cap edge, and a few hanging threads
    const cap = new THREE.SphereGeometry(C, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.42, 1);
    b.add(cap, o.leaves[0], M(x, H - C * 0.05, z, a0));
    b.add(new THREE.CylinderGeometry(C * 1.02, C * 0.55, C * 0.2, 14), o.leaves[1 % o.leaves.length], M(x, H - C * 0.15, z, a0));
    if (o.rimGlow !== undefined) b.glow(new THREE.TorusGeometry(C * 0.86, C * 0.035, 5, 28), o.rimGlow, M(x, H - C * 0.26, z, 0, 1, Math.PI / 2));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + r() * 0.6;
      const d = C * (0.75 + r() * 0.2);
      const top = V(x + Math.cos(a) * d, H - C * 0.25, z + Math.sin(a) * d);
      b.add(new THREE.CylinderGeometry(1, 1, 1, 4), o.leaves[0], segM(top, top.clone().add(V((r() - 0.5) * 0.6, -(1.5 + r() * 2.5), (r() - 0.5) * 0.6)), 0.04), false);
    }
  }
}

/** Distant giant-tree silhouette: only a trunk, a canopy and two low side branches, no outline, left to the fog */
export function farTree(b: PropBatch, x: number, z: number, R: number, H: number, trunk: number, leaf: number, r: () => number): void {
  b.add(new THREE.CylinderGeometry(R * 0.55, R, H, 8), trunk, M(x, H / 2 - 0.5, z), false);
  b.add(new THREE.CylinderGeometry(R, R * 1.4, R, 8), trunk, M(x, R * 0.5 - 0.5, z), false);
  // The distant view is entirely in fog, so the lowest subdivision is enough for the canopy
  const C = R * 3.2;
  b.add(new THREE.IcosahedronGeometry(C, 0), leaf, M(x, H, z, r() * 6), false);
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    b.add(new THREE.IcosahedronGeometry(C * 0.6, 0), leaf, M(x + Math.cos(a) * C * 0.8, H - C * 0.5 + r() * C * 0.6, z + Math.sin(a) * C * 0.8, r() * 6), false);
  }
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2;
    const y = H * (0.22 + r() * 0.25);
    const len = R * 4;
    const base = V(x + Math.cos(a) * R * 0.6, y, z + Math.sin(a) * R * 0.6);
    b.add(new THREE.CylinderGeometry(R * 0.12, R * 0.22, len, 6), trunk, leanM(base, a, 1.1, len), false);
    const tip = base.clone().addScaledVector(leanDir(a, 1.1), len);
    b.add(new THREE.IcosahedronGeometry(C * 0.4, 0), leaf, M(tip.x, tip.y + C * 0.15, tip.z, r() * 6), false);
  }
}

// ───────────────────────── Mushrooms, ferns, mossy stones, grass tufts ─────────────────────────

export interface ShroomCols {
  stem: number;
  caps: number[];
  /** Glow color of the gills under the cap */
  glows: number[];
  spots?: number;
}

/** Glowing mushroom: a slightly crooked stem, with a ring of glowing gills under the cap a bit wider than the cap edge, so the light is visible from above too */
export function mushroom(b: PropBatch, x: number, z: number, s: number, c: ShroomCols, r: () => number, pointed = false): void {
  const lean = (r() - 0.5) * 0.35;
  const la = r() * Math.PI * 2;
  const cap = c.caps[Math.floor(r() * c.caps.length)];
  const glow = c.glows[Math.floor(r() * c.glows.length)];
  const stemLen = 0.62 * s;
  const base = V(x, 0, z);
  b.add(new THREE.CylinderGeometry(0.11 * s, 0.17 * s, stemLen, 7), c.stem, leanM(base, la, lean, stemLen));
  const top = base.clone().addScaledVector(leanDir(la, lean), stemLen);
  const cr = 0.42 * s;
  if (pointed) {
    b.add(new THREE.ConeGeometry(cr, cr * 1.3, 10), cap, M(top.x, top.y + cr * 0.55, top.z));
  } else {
    const g = new THREE.SphereGeometry(cr, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.68, 1);
    b.add(g, cap, M(top.x, top.y - 0.02 * s, top.z, r() * 6));
  }
  b.glow(new THREE.CylinderGeometry(cr * 1.04, cr * 0.7, 0.07 * s, 12), glow, M(top.x, top.y - 0.045 * s, top.z));
  if (c.spots !== undefined && !pointed && s > 1.1) {
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2;
      const d = cr * (0.25 + r() * 0.5);
      const yy = Math.sqrt(Math.max(0, cr * cr - d * d)) * 0.68;
      b.add(new THREE.SphereGeometry(cr * (0.1 + r() * 0.08), 6, 4), c.spots, M(top.x + Math.cos(a) * d, top.y - 0.02 * s + yy, top.z + Math.sin(a) * d));
    }
  }
}

export interface Pool {
  x: number;
  z: number;
  r: number;
  col: number;
}

/** Fungus ring: a ring of mushrooms of varying size, every fourth one extra large, with a ring of light left on the ground */
export function mushroomRing(b: PropBatch, cx: number, cz: number, rr: number, n: number, c: ShroomCols, r: () => number, pools: Pool[], poolCol: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const d = rr * (0.85 + r() * 0.3);
    const s = 0.5 + r() * 0.9 + (i % 4 === 0 ? 0.8 : 0);
    mushroom(b, cx + Math.cos(a) * d, cz + Math.sin(a) * d, s, c, r, r() < 0.3);
  }
  pools.push({ x: cx, z: cz, r: rr * 1.5, col: poolCol });
}

/** Shelf fungus growing on a trunk: a semicircular cap with a glowing underside */
export function shelfFungus(b: PropBatch, x: number, z: number, trunkR: number, a: number, y: number, s: number, cap: number, glow: number): void {
  const cx = x + Math.cos(a) * (trunkR - 0.05);
  const cz = z + Math.sin(a) * (trunkR - 0.05);
  b.add(new THREE.CylinderGeometry(s, s * 0.85, s * 0.18, 9, 1, false, 0, Math.PI), cap, M(cx, y, cz, -a));
  b.glow(new THREE.CylinderGeometry(s * 0.95, s * 0.8, 0.05, 9, 1, false, 0, Math.PI), glow, M(cx, y - s * 0.1, cz, -a));
}

/** Fern: a ring of flat fronds leaning outward, with a new shoot in the middle */
export function fern(b: PropBatch, x: number, z: number, s: number, col: number, r: () => number): void {
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const tilt = 0.75 + r() * 0.5;
    const len = s * (0.8 + r() * 0.5);
    b.add(new THREE.ConeGeometry(0.17 * s, len, 4), col, leanM(V(x, 0.05, z), a, tilt, len, 1, 0.3));
  }
  b.add(new THREE.ConeGeometry(0.1 * s, 0.5 * s, 4), col, M(x, 0.3 * s, z));
}

/** Grass tuft: a few slender blades, no outline */
export function grassTuft(b: PropBatch, x: number, z: number, s: number, col: number, r: () => number): void {
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const tilt = 0.2 + r() * 0.5;
    const len = s * (0.35 + r() * 0.35);
    b.add(new THREE.ConeGeometry(0.05 * s, len, 3), col, leanM(V(x + (r() - 0.5) * 0.2 * s, 0, z + (r() - 0.5) * 0.2 * s), a, tilt, len), false);
  }
}

/** Mossy stone: a rock with a flat patch of moss over it */
export function mossRock(b: PropBatch, x: number, z: number, s: number, rock: number, moss: number, r: () => number): void {
  const ry = r() * 6;
  b.add(new THREE.DodecahedronGeometry(s, 0), rock, M(x, s * 0.5, z, ry, 1, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4));
  const g = new THREE.DodecahedronGeometry(s * 0.95, 1);
  g.scale(1, 0.4, 1);
  b.add(g, moss, M(x, s * 1.05, z, ry + 0.4));
}

/** Stalactite cluster: a few pointed cones hanging down from yTop */
export function stalactites(b: PropBatch, x: number, z: number, yTop: number, s: number, col: number, r: () => number): void {
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const h = s * (1.5 + r() * 3);
    const rad = s * (0.25 + r() * 0.3);
    b.add(new THREE.ConeGeometry(rad, h, 6), col, M(x + (r() - 0.5) * s * 2, yTop - h / 2 + 0.1, z + (r() - 0.5) * s * 2, 0, 1, Math.PI), false);
  }
}

/** Stele: a slightly tapered pentagonal stone pillar with a glowing rune strip carved on the front */
export function runeStone(b: PropBatch, x: number, z: number, h: number, col: number, glow: number, facing: number, r: () => number): void {
  b.add(new THREE.CylinderGeometry(0.32, 0.5, h, 5), col, M(x, h / 2, z, facing, 1, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08));
  b.add(new THREE.CylinderGeometry(0.55, 0.65, 0.25, 6), col, M(x, 0.12, z, facing));
  for (let i = 0; i < 4; i++) {
    const y = h * (0.35 + i * 0.14);
    const w = 0.12 + r() * 0.16;
    b.glow(new THREE.BoxGeometry(w, 0.06, 0.05), glow, M(x + Math.cos(facing) * 0.4, y, z + Math.sin(facing) * 0.4, -facing));
  }
}

/** Spider web: radial threads centered at center and facing normal, plus several spiral rings */
export function spiderWeb(b: PropBatch, center: THREE.Vector3, normal: THREE.Vector3, radius: number, col: number, r: () => number): void {
  const n = normal.clone().normalize();
  const u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? V(1, 0, 0) : UP).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const at = (a: number, d: number) => center.clone().addScaledVector(u, Math.cos(a) * d).addScaledVector(v, Math.sin(a) * d);
  const spokes = 9;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    b.glow(new THREE.CylinderGeometry(1, 1, 1, 3), col, segM(center, at(a, radius * (0.9 + r() * 0.25)), 0.012));
  }
  for (let k = 1; k <= 4; k++) {
    const d = radius * (0.2 + k * 0.18);
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * Math.PI * 2;
      const a1 = ((i + 1) / spokes) * Math.PI * 2;
      const mid = at((a0 + a1) / 2, d * 0.93);
      b.glow(new THREE.CylinderGeometry(1, 1, 1, 3), col, segM(at(a0, d), mid, 0.009));
      b.glow(new THREE.CylinderGeometry(1, 1, 1, 3), col, segM(mid, at(a1, d), 0.009));
    }
  }
}

// ───────────────────────── Treehouse, spiral stairs, lanterns ─────────────────────────

/** Glowing objects that breathe together: the geometry is collected and merged into one mesh, and only the color intensity changes each frame */
export class GlowSet {
  private geos: THREE.BufferGeometry[] = [];
  private color: number;
  constructor(color: number) {
    this.color = color;
  }
  add(geo: THREE.BufferGeometry, m: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m);
    this.geos.push(g);
  }
  /** Merge and attach to the scene; returns a function that sets the brightness multiplier (around 2.2 starts to bloom) */
  build(parent: THREE.Object3D, disposers: Disposers): (k: number) => void {
    const base = new THREE.Color(this.color);
    const mat = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(2.2), toneMapped: false });
    const merged = this.geos.length ? mergeGeometries(this.geos) : null;
    if (merged) parent.add(new THREE.Mesh(merged, mat));
    disposers.push(() => mat.dispose());
    return (k) => {
      mat.color.copy(base).multiplyScalar(k);
    };
  }
}

export interface HouseCols {
  deck: number;
  post: number;
  wall: number;
  roof: number;
}

/** Lantern: a paper lamp with caps top and bottom, hung from a short rope */
export function lantern(b: PropBatch, glow: GlowSet, top: THREE.Vector3, s: number, capCol: number): void {
  const y = top.y - 0.3 * s;
  b.add(new THREE.CylinderGeometry(0.015, 0.015, 0.3 * s, 3), capCol, M(top.x, top.y - 0.15 * s, top.z), false);
  b.add(new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 0.06 * s, 8), capCol, M(top.x, y, top.z));
  const g = new THREE.SphereGeometry(0.2 * s, 10, 7);
  g.scale(1, 1.25, 1);
  glow.add(g, M(top.x, y - 0.27 * s, top.z));
  b.add(new THREE.CylinderGeometry(0.11 * s, 0.09 * s, 0.05 * s, 8), capCol, M(top.x, y - 0.55 * s, top.z));
}

/** Treehouse: a round platform around the trunk, diagonal beams, a railing, a small pointed-roof hut (the windows light up) and lanterns hanging under the platform */
export function treeHouse(b: PropBatch, glow: GlowSet, x: number, z: number, y: number, R: number, hutAngle: number, c: HouseCols): void {
  const pr = R + 2.3;
  b.add(new THREE.CylinderGeometry(pr, pr - 0.5, 0.32, 14), c.deck, M(x, y, z));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const from = V(x + Math.cos(a) * R * 0.8, y - 2.6, z + Math.sin(a) * R * 0.8);
    const to = V(x + Math.cos(a) * (pr - 0.4), y - 0.25, z + Math.sin(a) * (pr - 0.4));
    b.add(new THREE.CylinderGeometry(1, 1, 1, 6), c.post, segM(from, to, 0.13));
  }
  const np = 16;
  for (let i = 0; i < np; i++) {
    const a = (i / np) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.1, 0.95, 0.1), c.post, M(x + Math.cos(a) * (pr - 0.2), y + 0.6, z + Math.sin(a) * (pr - 0.2)));
  }
  b.add(new THREE.TorusGeometry(pr - 0.2, 0.05, 5, 32), c.post, M(x, y + 1.05, z, 0, 1, Math.PI / 2), false);
  const hx = x + Math.cos(hutAngle) * (R + 1.1);
  const hz = z + Math.sin(hutAngle) * (R + 1.1);
  b.add(new THREE.BoxGeometry(1.9, 1.7, 1.7), c.wall, M(hx, y + 1.0, hz, -hutAngle));
  b.add(new THREE.ConeGeometry(1.75, 1.3, 4), c.roof, M(hx, y + 2.45, hz, -hutAngle + Math.PI / 4));
  b.add(new THREE.BoxGeometry(0.16, 0.6, 0.16), c.post, M(hx, y + 3.3, hz));
  // Outward-facing window (warm light) and a side door
  glow.add(new THREE.BoxGeometry(0.12, 0.45, 0.5), M(hx + Math.cos(hutAngle) * 0.92, y + 1.15, hz + Math.sin(hutAngle) * 0.92, -hutAngle));
  b.add(new THREE.BoxGeometry(0.55, 1.05, 0.1), c.post, M(hx - Math.sin(hutAngle) * 0.86, y + 0.7, hz + Math.cos(hutAngle) * 0.86, -hutAngle));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    lantern(b, glow, V(x + Math.cos(a) * (pr - 0.35), y - 0.16, z + Math.sin(a) * (pr - 0.35)), 0.9, c.post);
  }
}

/** Spiral stairs: treads rising around the trunk, a post every few steps, with rope strung between the posts */
export function spiralStair(b: PropBatch, x: number, z: number, R: number, yTop: number, a0: number, turns: number, col: number, post: number): void {
  const n = Math.round(yTop / 0.3);
  const sr = R * 0.95 + 0.5;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * turns * Math.PI * 2;
    const y = 0.12 + (i / n) * (yTop - 0.3);
    b.add(new THREE.BoxGeometry(1.1, 0.09, 0.42), col, M(x + Math.cos(a) * sr, y, z + Math.sin(a) * sr, -a));
    if (i % 4 === 0) {
      const px = x + Math.cos(a) * (sr + 0.45);
      const pz = z + Math.sin(a) * (sr + 0.45);
      b.add(new THREE.BoxGeometry(0.08, 0.9, 0.08), post, M(px, y + 0.45, pz));
      pts.push(V(px, y + 0.9, pz));
    }
  }
  for (let i = 0; i + 1 < pts.length; i++) rope(b, pts[i], pts[i + 1], 0.08, 0.025, post, false, 3);
}

/** Rope bridge: hanging planks, handrail ropes on both sides and suspension ropes; returns the points where lanterns can hang */
export function ropeBridge(b: PropBatch, a: THREE.Vector3, c: THREE.Vector3, sag: number, plank: number, ropeCol: number): THREE.Vector3[] {
  const len = a.distanceTo(c);
  const n = Math.max(4, Math.round(len / 0.55));
  const pts = catenary(a, c, sag, n);
  const dir = new THREE.Vector3().subVectors(c, a).setY(0).normalize();
  const side = V(-dir.z, 0, dir.x);
  const ry = Math.atan2(-dir.x, -dir.z);
  const hooks: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    b.add(new THREE.BoxGeometry(1.3, 0.07, 0.36), plank, M(p.x, p.y, p.z, ry));
    if (i % 2 === 0 && i > 0 && i < n) {
      for (const sgn of [-1, 1]) {
        const foot = p.clone().addScaledVector(side, sgn * 0.6);
        b.add(new THREE.CylinderGeometry(1, 1, 1, 4), ropeCol, segM(foot, foot.clone().setY(p.y + 0.78), 0.02), false);
      }
    }
    if (i % 5 === 2) hooks.push(p.clone().addScaledVector(side, 0.72).setY(p.y + 0.72));
  }
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const p0 = pts[i].clone().addScaledVector(side, sgn * 0.6);
      const p1 = pts[i + 1].clone().addScaledVector(side, sgn * 0.6);
      b.add(new THREE.CylinderGeometry(1, 1, 1, 4), ropeCol, segM(p0.clone().setY(p0.y + 0.8), p1.clone().setY(p1.y + 0.8), 0.03), false);
      b.add(new THREE.CylinderGeometry(1, 1, 1, 4), ropeCol, segM(p0.clone().setY(p0.y - 0.02), p1.clone().setY(p1.y - 0.02), 0.03), false);
    }
  }
  return hooks;
}

// ───────────────────────── Textures and ground decals ─────────────────────────

/** Soft round light-spot texture */
export function softDiscTex(size = 128): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, 'rgba(255,255,255,0.9)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Light spots on the ground: all spots are merged into one additive-blended mesh, with the color written in the vertex colors */
export function lightPools(group: THREE.Object3D, disposers: Disposers, pools: Pool[], gain = 1.3): void {
  if (!pools.length) return;
  const tex = softDiscTex();
  const geos: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (const p of pools) {
    const g = new THREE.PlaneGeometry(p.r * 2, p.r * 2);
    c.set(p.col);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.applyMatrix4(new THREE.Matrix4().compose(V(p.x, 0.028, p.z), q, new THREE.Vector3(1, 1, 1)));
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  if (!merged) return;
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  mat.color.setScalar(gain);
  const mesh = new THREE.Mesh(merged, mat);
  mesh.renderOrder = 2;
  group.add(mesh);
  disposers.push(() => {
    mat.dispose();
    tex.dispose();
  });
}

/** Ground decal painted on a canvas (fallen leaves, moss patterns, cracks...), laid out as a transparent size×size plane */
export function groundDecal(group: THREE.Object3D, disposers: Disposers, size: number, px: number, draw: (g: CanvasRenderingContext2D, s: number) => void, additive = false, y = 0.014): void {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d')!;
  draw(g, px);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: !additive, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = 1;
  group.add(mesh);
  disposers.push(() => {
    mat.dispose();
    tex.dispose();
  });
}

// ───────────────────────── Shaders: light pillars, mist, lake, eyes ─────────────────────────

const NOISE = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.7) * 0.3 + vnoise(p * 4.3 + 9.1) * 0.2; }
`;

export interface Shaft {
  x: number;
  z: number;
  w: number;
  h: number;
}

/** Light pillars: crossed thin sheets along the light direction, fading at the edges and top and bottom, each pulsing slowly on its own (one mesh) */
export function lightShafts(group: THREE.Object3D, disposers: Disposers, extras: Extras, shafts: Shaft[], dir: THREE.Vector3, color: number, amt: number): void {
  const d = dir.clone().normalize();
  const qa = new THREE.Quaternion().setFromUnitVectors(UP, d);
  const geos: THREE.BufferGeometry[] = [];
  shafts.forEach((s, i) => {
    for (let k = 0; k < 2; k++) {
      const g = new THREE.PlaneGeometry(1, 1);
      g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill((i * 0.37 + k * 0.5) % 1), 1));
      const q = qa.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, (k * Math.PI) / 2 + 0.4));
      g.applyMatrix4(new THREE.Matrix4().compose(V(s.x, 0.3, s.z).addScaledVector(d, s.h / 2), q, new THREE.Vector3(s.w, s.h, 1)));
      geos.push(g);
    }
  });
  const merged = mergeGeometries(geos);
  if (!merged) return;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: amt } },
    vertexShader: /* glsl */ `
      attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uAmt; varying vec2 vUv; varying float vSeed;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float side = (1.0 - x) * (1.0 - x);
        float v = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float flick = 0.7 + 0.3 * sin(uTime * 0.6 + vSeed * 6.2832);
        gl_FragColor = vec4(uColor * side * v * flick * uAmt, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.renderOrder = 6;
  group.add(mesh);
  disposers.push(() => mat.dispose());
  extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t;
  });
}

/** Mist band: a cylindrical shell enclosing the stage, seen from the inside; mist clumps drift slowly with world-space noise and fade at top and bottom */
export function mistShell(group: THREE.Object3D, disposers: Disposers, extras: Extras, radius: number, y0: number, height: number, color: number, amt: number, speed = 1): void {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: amt } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec2 vUv;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vUv = uv; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uAmt; varying vec3 vW; varying vec2 vUv;
      ${NOISE}
      void main() {
        float n = fbm(vW.xz * 0.08 + vec2(uTime * 0.02, -uTime * 0.013)) * 0.65 + fbm(vW.xz * 0.2 - vec2(uTime * 0.03, uTime * 0.02)) * 0.35;
        float a = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.45, vUv.y) * smoothstep(0.28, 0.7, n) * uAmt;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 48, 1, true), mat);
  mesh.position.y = y0 + height / 2;
  mesh.renderOrder = 4;
  group.add(mesh);
  disposers.push(() => mat.dispose());
  extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t * speed;
  });
}

/** Ground mist: a round plane, left empty in the battle area and thickening outward, with noise flowing slowly */
export function groundFog(group: THREE.Object3D, disposers: Disposers, extras: Extras, radius: number, y: number, innerClear: number, color: number, amt: number, seed = 0, hole?: [number, number, number]): void {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: amt }, uInner: { value: innerClear }, uRadius: { value: radius }, uSeed: { value: seed }, uHole: { value: hole ? V(hole[0], hole[1], hole[2]) : V(0, 0, -100) } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uAmt; uniform float uInner; uniform float uRadius; uniform float uSeed; uniform vec3 uHole; varying vec3 vW;
      ${NOISE}
      void main() {
        float d = length(vW.xz);
        float ring = smoothstep(uInner, uInner + 6.0, d) * (1.0 - smoothstep(uRadius - 10.0, uRadius, d));
        // No fog is left on the lake surface so the reflection stays visible
        ring *= smoothstep(uHole.z - 1.0, uHole.z + 4.0, length(vW.xz - uHole.xy));
        float n = fbm(vW.xz * 0.11 + vec2(uTime * 0.03 + uSeed, -uTime * 0.02));
        float a = ring * smoothstep(0.3, 0.72, n) * uAmt;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = 3;
  group.add(mesh);
  disposers.push(() => mat.dispose());
  extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t;
  });
}

export interface LakeLight {
  x: number;
  z: number;
  r: number;
  col: number;
}

/** Lake surface: a dark water surface with a polygonal outline. The water is translucent (premultiplied alpha), so mirrored reflection objects and a sky dome placed beneath it read as a real reflection;
 *  seen at a low angle it is more transparent (reflection dominates), and from above it is a dark body of water; ripples carry scattered bright flecks, and shoreline lights drag long light spots across the water */
export function lake(group: THREE.Object3D, disposers: Disposers, extras: Extras, outline: [number, number][], deep: number, sky: number, glint: number, lights: LakeLight[]): void {
  const sh = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? sh.moveTo(x, -z) : sh.lineTo(x, -z)));
  sh.closePath();
  const geo = new THREE.ShapeGeometry(sh, 1);
  geo.rotateX(-Math.PI / 2);
  const L = Array.from({ length: 6 }, (_, i) => (lights[i] ? V(lights[i].x, lights[i].z, lights[i].r) : V(0, 0, 0)));
  const LC = Array.from({ length: 6 }, (_, i) => new THREE.Color(lights[i]?.col ?? 0));
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(deep) },
      uSky: { value: new THREE.Color(sky) },
      uGlint: { value: new THREE.Color(glint) },
      uLights: { value: L },
      uLightCols: { value: LC },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uGlint;
      uniform vec3 uLights[6]; uniform vec3 uLightCols[6];
      varying vec3 vW;
      ${NOISE}
      void main() {
        vec3 vd = cameraPosition - vW;
        float vl = length(vd);
        float up = vl > 1e-4 ? vd.y / vl : 1.0;
        float fres = pow(1.0 - clamp(up, 0.0, 1.0), 2.0);
        vec2 p = vW.xz;
        float w = fbm(p * 0.9 + vec2(uTime * 0.12, uTime * 0.07)) * 0.6 + fbm(p * 2.6 - vec2(uTime * 0.05, uTime * 0.09)) * 0.4;
        // Glints: horizontally stretched sparkles (at low viewing angles reflections on water appear as horizontal streaks)
        float g2 = fbm(vec2(p.x * 0.45, p.y * 2.4) + vec2(uTime * 0.08, -uTime * 0.16));
        float alpha = 0.8 - 0.55 * fres;
        vec3 base = mix(uDeep, uSky, 0.16 + fres * 0.4);
        vec3 extra = uGlint * smoothstep(0.6, 0.68, g2) * smoothstep(0.35, 0.6, w) * (0.25 + 0.75 * fres) * 0.7;
        for (int i = 0; i < 6; i++) {
          vec3 Lt = uLights[i];
          if (Lt.z <= 0.0) continue;
          vec2 d = (p - Lt.xy) / Lt.z;
          d.y *= 0.45;
          extra += uLightCols[i] * exp(-dot(d, d) * 2.0) * (0.55 + 0.45 * w) * 0.8;
        }
        vec3 rgb = base * alpha + extra;
        #ifdef USE_FOG
          float f = smoothstep(fogNear, fogFar, vFogDepth);
          rgb = mix(rgb, fogColor * alpha, f);
        #endif
        gl_FragColor = vec4(rgb, alpha);
      }`,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.03;
  group.add(mesh);
  disposers.push(() => mat.dispose());
  extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t;
  });
}

/** Cut a hole (the lake) in the ground disc and put a mirrored reflection beneath it; the UVs line up with the whole ground texture just as on the original disc */
export function cutGround(ground: THREE.Mesh, outline: [number, number][], radius = 34): void {
  const disk = new THREE.Shape();
  disk.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  outline.forEach(([x, z], i) => (i === 0 ? hole.moveTo(x, -z) : hole.lineTo(x, -z)));
  hole.closePath();
  disk.holes.push(hole);
  const gg = new THREE.ShapeGeometry(disk, 48);
  const pos = gg.attributes.position;
  const uv = gg.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (radius * 2) + 0.5, pos.getY(i) / (radius * 2) + 0.5);
  ground.geometry.dispose();
  ground.geometry = gg;
}

export interface EyePair {
  x: number;
  y: number;
  z: number;
  gap: number;
}

/** Eyes staring at you in the dark: pairs of small light orbs, each blinking now and then on its own (one mesh) */
export function watchingEyes(group: THREE.Object3D, disposers: Disposers, extras: Extras, pairs: EyePair[], color: number, size = 0.09): void {
  const geos: THREE.BufferGeometry[] = [];
  pairs.forEach((p, i) => {
    for (const sgn of [-1, 1]) {
      const g = new THREE.SphereGeometry(size, 6, 4);
      g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill((i * 0.618) % 1), 1));
      g.translate(p.x + sgn * p.gap * 0.5, p.y, p.z);
      geos.push(g);
    }
  });
  const merged = mergeGeometries(geos);
  if (!merged) return;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      attribute float aSeed; varying float vSeed;
      void main() { vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; varying float vSeed;
      void main() {
        float blink = step(0.07, fract(uTime * 0.11 + vSeed));
        float breathe = 1.7 + 0.5 * sin(uTime * 2.3 + vSeed * 20.0);
        gl_FragColor = vec4(uColor * blink * breathe, 1.0);
      }`,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(merged, mat);
  group.add(mesh);
  disposers.push(() => mat.dispose());
  extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t;
  });
}
