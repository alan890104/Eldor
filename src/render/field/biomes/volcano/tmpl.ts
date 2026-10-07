// Template geometry and color palette for the Emberspine Volcanic Belt's ground layer:
// geometry is first made into non-indexed templates with uv removed, and a copy is dropped into a batch each time,
// which is much faster than creating a new geometry every time when over ten thousand small props are scattered;
// rubble and lapilli are first merged into several "pinch" templates, and one pinch is placed at a time.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FieldBatch, FieldCtx } from '../../kit.ts';

/** Palette of the ground layer (kept apart from COL in props.ts: these are the new rock, plant and mineral colors) */
export const G = {
  // Rock
  basalt: 0x2a2226,
  basalt2: 0x352b31,
  basaltL: 0x44383e,
  crust: 0x231c1f,
  scoria: 0x5a2c26,
  scoria2: 0x6e3a2c,
  scoriaD: 0x3e201c,
  ash: 0x5a5054,
  ashD: 0x463e42,
  ashL: 0x6c6164,
  pumice: 0x958780,
  char: 0x1c1517,
  charL: 0x2c2224,
  scorch: 0x1a1214,
  obsidian: 0x121016,
  obsidianL: 0x3a3e52,
  obsidianG: 0x5a4a78,
  // Minerals, lichen, microbial mats
  sulfur: 0xa88a3c,
  sulfurL: 0xb89a48,
  sinter: 0xcfc4ac,
  oxide: 0x7a3a20,
  oxideD: 0x5a2c1c,
  rust: 0xb0602c,
  lichenO: 0x9a5428,
  lichenY: 0x8a7e3a,
  lichenG: 0x6a7456,
  // Plants
  stem: 0x3a1814,
  stemL: 0x5a2618,
  dry: 0x5a3c26,
  dryL: 0x7a5432,
  berry: 0x8a2418,
  capD: 0x5e1a14,
  capL: 0x8a2c1a,
  gill: 0xff6a1a,
  bone: 0xcfc2a8,
  boneD: 0xa89a80,
  // Plants that grow back after purification
  moss: 0x5e8a44,
  mossL: 0x7aa050,
  fireweed: 0xd24a9a,
  fireweedL: 0xee78c0,
  leafG: 0x4a7a3a,
  // Glowing
  ember: 0xff6a1a,
  // The dull red showing through under the seams
  seam: 0x7a1c06,
  emberL: 0xff8a2a,
  fire: 0xffb040,
  gold: 0xffc860,
  sulfurG: 0xe8c030,
  cult: 0x9a3aff,
};

// ───────────────────────── Templates ─────────────────────────

/** Remove uv and convert to non-indexed (batches only need positions and normals) */
function prep(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  return n;
}

const flat = (g: THREE.BufferGeometry) => {
  g.rotateX(-Math.PI / 2);
  return g;
};

/** Unit-size templates (centered at the origin; cylinders and cones are 1 high) */
export const T = {
  tet: prep(new THREE.TetrahedronGeometry(1, 0)),
  oct: prep(new THREE.OctahedronGeometry(1, 0)),
  ico: prep(new THREE.IcosahedronGeometry(1, 0)),
  ico1: prep(new THREE.IcosahedronGeometry(1, 1)),
  dod: prep(new THREE.DodecahedronGeometry(1, 0)),
  hex: prep(new THREE.CylinderGeometry(1, 1, 1, 6)),
  pent: prep(new THREE.CylinderGeometry(1, 1, 1, 5)),
  hexT: prep(new THREE.CylinderGeometry(0.78, 1, 1, 6)),
  cyl7: prep(new THREE.CylinderGeometry(1, 1, 1, 7)),
  cyl5: prep(new THREE.CylinderGeometry(1, 1, 1, 5)),
  stem: prep(new THREE.CylinderGeometry(1, 1, 1, 3, 1, true)),
  cone3: prep(new THREE.ConeGeometry(1, 1, 3)),
  cone4: prep(new THREE.ConeGeometry(1, 1, 4)),
  cone6: prep(new THREE.ConeGeometry(1, 1, 6)),
  box: prep(new THREE.BoxGeometry(1, 1, 1)),
  disc: prep(flat(new THREE.CircleGeometry(1, 9))),
  disc6: prep(flat(new THREE.CircleGeometry(1, 6))),
  ring: prep(flat(new THREE.RingGeometry(0.72, 1, 12))),
  half: prep(new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2)),
  // A flat-lying arc (a fold of ropy lava, a rib): radius 1 in the XZ plane, tube thickness 0.16
  arc: prep(flat(new THREE.TorusGeometry(1, 0.16, 3, 9, Math.PI * 0.7))),
  // An upright arc (a rib, an arch)
  arcV: prep(new THREE.TorusGeometry(1, 0.12, 4, 10, Math.PI * 0.75)),
  torus: prep(flat(new THREE.TorusGeometry(1, 0.12, 4, 12))),
};

/** Add a template to a batch (the batch makes its own copy, so the template can be reused over and over) */
export function put(b: FieldBatch, geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, outline = true): void {
  b.add(geo, color, m, outline);
}
export function glow(b: FieldBatch, geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
  b.glow(geo, color, m);
}

const _q = new THREE.Quaternion();
// Tilt in its own coordinates first (rx, rz), and turn (ry) last
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
/** Translation + non-uniform scale + rotation (ry is the heading, rx and rz are its own forward/back and left/right tilt) */
export const MX = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));

const _el = new THREE.Euler();
/**
 * A slender object based at (x, y, z), leaning outward by tilt radians toward horizontal angle a (direction (cos a, sin a)):
 * the template is hUnit high (1 for cylinders and cones, 2 for octahedra), scaled to length len and thickness sx x sz.
 */
export function lean(x: number, y: number, z: number, a: number, tilt: number, len: number, sx: number, sz: number, hUnit = 1): THREE.Matrix4 {
  const st = Math.sin(tilt) * len * 0.5;
  _q.setFromEuler(_el.set(0, -a, -tilt));
  return new THREE.Matrix4().compose(_p.set(x + st * Math.cos(a), y + Math.cos(tilt) * len * 0.5, z + st * Math.sin(a)), _q, _s.set(sx, len / hUnit, sz));
}

/** Stack q's rotation onto the ground normal (slabs and ash drifts on a slope lie flush with the slope surface) */
const _up = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3();
const _qa = new THREE.Quaternion();
export function onSlope(ctx: FieldCtx, x: number, z: number, y: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  const h = ctx.h;
  _n.set(h(x - 0.7, z) - h(x + 0.7, z), 1.4, h(x, z - 0.7) - h(x, z + 0.7)).normalize();
  _qa.setFromUnitVectors(_up, _n);
  _q.setFromEuler(_e.set(rx, ry, rz)).premultiply(_qa);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/**
 * The near view straight ahead of the camera: the opening camera (about 10 m behind the spawn point) and the two fixed cameras
 * of the town and the tower approach, a fan-shaped patch about 9 m ahead that widens with distance. No rocks,
 * charred wood or prop piles go here (only ground-hugging lapilli stay), so that no big mass of things blocks the camera and
 * pulls the eye away from the tower. m is the prop's own radius
 */
export function lensZone(ctx: FieldCtx, x: number, z: number, m = 0): boolean {
  const L = ctx.layout;
  let cams = lensCache.get(L);
  if (!cams) {
    const [sx, sz, yaw] = L.spawn;
    const aim = (px: number, pz: number, tx: number, tz: number): [number, number, number, number, number] => {
      const l = Math.hypot(tx - px, tz - pz) || 1;
      return [px, pz, (tx - px) / l, (tz - pz) / l, 9];
    };
    cams = [
      [sx - Math.sin(yaw) * 10.3, sz - Math.cos(yaw) * 10.3, Math.sin(yaw), Math.cos(yaw), 9.5],
      aim(L.town[0] + 26, L.town[1] + 30, L.town[0], L.town[1]),
      aim(L.tower[0] + 8, L.tower[1] + 52, L.tower[0], L.tower[1]),
    ];
    lensCache.set(L, cams);
  }
  for (const [cx, cz, dx, dz, deep] of cams) {
    const along = (x - cx) * dx + (z - cz) * dz;
    const across = Math.abs((x - cx) * dz - (z - cz) * dx);
    if (along > -1.5 - m && along < deep + m && across < 2 + Math.max(0, along) * 0.8 + m) return true;
  }
  return false;
}
const lensCache = new WeakMap<object, [number, number, number, number, number][]>();

// ───────────────────────── Templates for a pinch of rubble ─────────────────────────

/** Small fixed-seed random generator (for the templates; leaves the region's random sequence alone) */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function cluster(seed: number, n: number, R: number, s0: number, s1: number, shapes: THREE.BufferGeometry[], squash: number): THREE.BufferGeometry {
  const r = lcg(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R;
    const s = s0 + r() * (s1 - s0);
    const g = shapes[i % shapes.length].clone();
    // Half-buried in the ground: the center sits slightly below the surface
    g.applyMatrix4(MX(Math.cos(a) * d, s * 0.18, Math.sin(a) * d, s * (0.8 + r() * 0.5), s * squash * (0.7 + r() * 0.5), s * (0.8 + r() * 0.5), r() * 6, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8));
    parts.push(g);
  }
  const m = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return m;
}

/** Lapilli: a pinch of fingertip-sized small gravel (four sets) */
export const LAPILLI = [0, 1, 2, 3].map((k) => cluster(11 + k * 7, 9, 0.75, 0.05, 0.12, [T.tet, T.oct], 0.8));
/** Rubble: a few stones fist- to watermelon-sized (four sets) */
export const SCREE = [0, 1, 2, 3].map((k) => cluster(101 + k * 13, 4, 0.85, 0.14, 0.32, [T.dod, T.ico], 0.72));
/** Big rubble slope (cliff foot): a pile of rocks of different sizes */
export const TALUS = [0, 1, 2].map((k) => cluster(301 + k * 17, 6, 1.6, 0.3, 0.75, [T.dod, T.ico], 0.7));

// ───────────────────────── Ground stains ─────────────────────────

/**
 * Ground stains (scorch marks of lava bombs, rust of fumaroles, coal ash of charcoal kilns):
 * no flat discs are placed (on slopes they would sink half in and show only a stripe of color);
 * instead the terrain's vertex colors are edited directly at the end, with the edge roughened by angular noise.
 */
export class Stains {
  private list: [number, number, number, THREE.Color, number, number][] = [];
  add(x: number, z: number, R: number, color: number, amt: number): void {
    this.list.push([x, z, R, new THREE.Color(color), amt, (x * 12.9898 + z * 78.233) % 6.28]);
  }
  apply(ctx: FieldCtx): void {
    const t = ctx.terrain;
    const attr = t.mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!attr || !this.list.length) return;
    const n = t.seg + 1;
    const step = (t.size * 2) / t.seg;
    const arr = attr.array as Float32Array;
    for (const [x, z, R, c, amt, seed] of this.list) {
      const i0 = Math.max(0, Math.floor((x - R * 1.3 + t.size) / step));
      const i1 = Math.min(n - 1, Math.ceil((x + R * 1.3 + t.size) / step));
      const j0 = Math.max(0, Math.floor((z - R * 1.3 + t.size) / step));
      const j1 = Math.min(n - 1, Math.ceil((z + R * 1.3 + t.size) / step));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const vx = -t.size + i * step - x;
          const vz = -t.size + j * step - z;
          const a = Math.atan2(vz, vx);
          const d = Math.hypot(vx, vz) * (1 + 0.22 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 5 - seed * 2));
          if (d > R) continue;
          const tt = Math.min(1, Math.max(0, (d - R * 0.3) / (R * 0.7)));
          const k = amt * (1 - tt * tt * (3 - 2 * tt));
          const o = (j * n + i) * 3;
          arr[o] += (c.r - arr[o]) * k;
          arr[o + 1] += (c.g - arr[o + 1]) * k;
          arr[o + 2] += (c.b - arr[o + 2]) * k;
        }
      }
    }
    attr.needsUpdate = true;
    this.list = [];
  }
}
