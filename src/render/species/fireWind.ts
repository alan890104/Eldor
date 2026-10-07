// Second-batch spirit models (see docs/09-bestiary.md): Emberspine Volcanic Belt (fire) and Skyhowl Highlands (wind).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit, PartOpts } from '../creature.ts';
import { biped, bird, floater, halo, quad, roundEars, sparkle, tailChain, PI, type Builder, type C, type V3 } from '../parts.ts';

// ───────────────────────── Shared helpers ─────────────────────────

/** Reproducible pseudo-random number (0 to 1) */
function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const vec = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

/** Stick big eyes onto the surface of a (ellipsoid) sphere-shaped head: compute the surface z from x and y, so the whites bulge out slightly */
function faceEyes(k: Kit, head: THREE.Object3D, rad: number | V3, o: { x: number; y: number; r: number; iris: C; glow?: boolean; sharp?: boolean; yaw?: number; cy?: number; cz?: number }) {
  const [rx, ry, rz] = typeof rad === 'number' ? [rad, rad, rad] : rad;
  const dy = o.y - (o.cy ?? 0);
  const z = (o.cz ?? 0) + rz * Math.sqrt(Math.max(0.05, 1 - (o.x / rx) ** 2 - (dy / ry) ** 2)) - o.r * 0.1;
  k.eyes(head, { x: o.x, y: o.y, z, r: o.r, iris: o.iris, glow: o.glow, sharp: o.sharp, yaw: o.yaw });
}

/** A point on an ellipsoid surface: lat is elevation, lon is measured from straight ahead (+z) toward +x */
function surf(ctr: V3, sc: V3, lat: number, lon: number, lift = 1.03): THREE.Vector3 {
  return new THREE.Vector3(
    ctr[0] + Math.cos(lat) * Math.sin(lon) * sc[0] * lift,
    ctr[1] + Math.sin(lat) * sc[1] * lift,
    ctr[2] + Math.cos(lat) * Math.cos(lon) * sc[2] * lift,
  );
}

/** A zigzag path from start to end in (lat, lon) space */
function zig(lat0: number, lon0: number, lat1: number, lon1: number, n: number, amp: number, seed: number): [number, number][] {
  const dl = lat1 - lat0;
  const dn = lon1 - lon0;
  const L = Math.hypot(dl, dn) || 1;
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * amp * (0.6 + rnd(seed + i) * 0.8);
    out.push([lat0 + dl * t - (dn / L) * j, lon0 + dn * t + (dl / L) * j]);
  }
  return out;
}

function polyline(pts: THREE.Vector3[]): THREE.CurvePath<THREE.Vector3> {
  const cp = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < pts.length - 1; i++) cp.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  return cp;
}

/** Glowing crack: a polyline hugging the ellipsoid surface */
function crack(k: Kit, parent: THREE.Object3D, ctr: V3, sc: V3, path: [number, number][], w: number, col: C = 0xff7a2a): THREE.Mesh {
  const pts = path.map(([a, b]) => surf(ctr, sc, a, b));
  return k.glow(parent, new THREE.TubeGeometry(polyline(pts), (pts.length - 1) * 4, w, 5, false), col, 2.4);
}

/** Sharp-edged part: the body uses flat normals (origami, iron blocks), and the outline uses vertex-merged smooth normals, so the outline does not split at the edges */
function facet(k: Kit, c: Creature, parent: THREE.Object3D, geo: THREE.BufferGeometry, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  const m = k.mesh(parent, geo, col, pos, rot, { ...o, outline: false });
  const g = geo.clone();
  g.deleteAttribute('normal');
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  const og = mergeVertices(g);
  og.computeVertexNormals();
  m.add(new THREE.Mesh(og, c.outlines[c.outlines.length - 1]));
  return m;
}

function box(k: Kit, c: Creature, parent: THREE.Object3D, col: C, size: V3, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]): THREE.Mesh {
  return facet(k, c, parent, new THREE.BoxGeometry(size[0], size[1], size[2]), col, pos, rot);
}

/** Thin sheet (polygon extrusion); with yz = true the sheet stands in the yz plane (the shape's x maps to +z, thickness along x) */
function plate(k: Kit, c: Creature, parent: THREE.Object3D, pts: [number, number][], depth: number, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], yz = false, o: PartOpts = {}): THREE.Mesh {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  if (yz) g.rotateY(-PI / 2);
  return facet(k, c, parent, g, col, pos, rot, o);
}

/** Thin rod between two points */
function rod(k: Kit, parent: THREE.Object3D, col: C, a: V3, b: V3, r: number, glow = 0, outline = true): THREE.Mesh {
  const va = vec(a);
  const vb = vec(b);
  const d = vb.clone().sub(va);
  const g = new THREE.CylinderGeometry(r, r, Math.max(1e-3, d.length()), 6, 1);
  const m = glow ? k.glow(parent, g, col, glow) : k.mesh(parent, g, col, [0, 0, 0], [0, 0, 0], { outline });
  m.position.copy(va.add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/** Tube along a curve, thick to thin (tail feather, harp arm, whisker) */
function tube(k: Kit, parent: THREE.Object3D, col: C, pts: V3[], r0: number, r1: number, o: { glow?: number; outline?: boolean; opacity?: number } = {}): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map(vec));
  const segs = 22;
  const rad = 8;
  const g = new THREE.TubeGeometry(curve, segs, 1, rad, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ctr = curve.getPointAt(t);
    const r = Math.max(0.002, r0 + (r1 - r0) * t);
    for (let j = 0; j <= rad; j++) {
      const idx = i * (rad + 1) + j;
      v.fromBufferAttribute(p, idx).sub(ctr).multiplyScalar(r).add(ctr);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  if (o.glow) return k.glow(parent, g, col, o.glow, [0, 0, 0], [0, 0, 0], o.opacity ?? 1);
  return k.mesh(parent, g, col, [0, 0, 0], [0, 0, 0], { outline: o.outline });
}

/** Zigzag electric arc */
function bolt(k: Kit, parent: THREE.Object3D, col: C, a: V3, b: V3, n: number, jit: number, r: number, seed: number): THREE.Mesh {
  const va = vec(a);
  const vb = vec(b);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const p = va.clone().lerp(vb, i / n);
    if (i > 0 && i < n) p.add(new THREE.Vector3(rnd(seed + i) - 0.5, rnd(seed + i + 50) - 0.5, rnd(seed + i + 99) - 0.5).multiplyScalar(jit * 2));
    pts.push(p);
  }
  return k.glow(parent, new THREE.TubeGeometry(polyline(pts), n * 3, r, 4, false), col, 2.8);
}

/** Tongue of flame: a flat drop shape widest in the middle with a pointed end */
function tongue(L: number, W: number, flat = 0.3): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.001, 0], [W * 0.7, L * 0.12], [W, L * 0.3], [W * 0.85, L * 0.5], [W * 0.45, L * 0.75], [0.001, L]];
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 12);
  g.scale(1, 1, flat);
  return g;
}

/** Floating musical-note light mote */
function note(k: Kit, c: Creature, parent: THREE.Object3D, col: C, pos: V3, sz: number, seed: number): THREE.Group {
  const g = k.group(parent, pos, [0, 0, 0.15]);
  k.glowSphere(g, col, sz * 0.3, [0, 0, 0], 2.6, [1.3, 0.9, 0.5]);
  k.glow(g, new THREE.BoxGeometry(sz * 0.09, sz, sz * 0.09), col, 2.6, [sz * 0.34, sz * 0.5, 0]);
  k.glow(g, new THREE.BoxGeometry(sz * 0.42, sz * 0.14, sz * 0.09), col, 2.6, [sz * 0.52, sz * 0.9, 0], [0, 0, -0.5]);
  c.bobbers.push({ g, base: pos[1], amp: 0.05, speed: 1.6 + rnd(seed) * 1.2, phase: seed * 1.7 });
  return g;
}

/** Fluffy dandelion puffball: fine filaments radiating from the center, a small parachute at each end, covered in a layer of soft glow; the whole ball slowly spins */
function puff(k: Kit, c: Creature, parent: THREE.Object3D, pos: V3, R: number, n: number, seed = 0): THREE.Group {
  const g = k.group(parent, pos);
  ball(k, g, 0xd8cc9a, R * 0.22, [0, 0, 0], [1, 1, 1], [0, 0, 0], { outline: false });
  const fil: THREE.BufferGeometry[] = [];
  const tuft: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = i * 2.39996 + seed;
    q.setFromUnitVectors(up, new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr));
    const L = R * (0.72 + rnd(seed * 31 + i) * 0.16);
    const cg = new THREE.CylinderGeometry(R * 0.014, R * 0.03, L, 4, 1);
    cg.translate(0, L * 0.5 + R * 0.1, 0);
    cg.applyQuaternion(q);
    fil.push(cg);
    const tg = new THREE.SphereGeometry(R * 0.11, 6, 4);
    tg.scale(1, 0.4, 1);
    tg.translate(0, L + R * 0.1, 0);
    tg.applyQuaternion(q);
    tuft.push(tg);
  }
  k.mesh(g, mergeGeometries(fil)!, 0xf4f4ff, [0, 0, 0], [0, 0, 0], { outline: false });
  k.mesh(g, mergeGeometries(tuft)!, 0xffffff, [0, 0, 0], [0, 0, 0], { outline: false, emissive: 0xffffff, emissiveAmt: 0.25 });
  k.glowSphere(g, 0xffffff, R * 0.9, [0, 0, 0], 0.9, [1, 1, 1], 0.18);
  c.spinners.push({ g, speed: 0.25 + rnd(seed) * 0.2, axis: 'y' });
  return g;
}

/** Serrated dandelion leaf: lying in the xy plane, growing from the origin toward +y */
function dandyLeaf(k: Kit, c: Creature, parent: THREE.Object3D, L: number, W: number, pos: V3, rot: V3): THREE.Mesh {
  const right: [number, number][] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const w = W * 0.5 * Math.pow(Math.sin(t * PI), 0.6);
    right.push([w * 0.45, L * (t - 0.06)]);
    right.push([w, L * (t + 0.02)]);
  }
  const pts: [number, number][] = [[0, 0], ...right, [0, L], ...right.map(([x, y]) => [-x, y] as [number, number]).reverse()];
  const g = k.group(parent, pos, rot);
  const m = plate(k, c, g, pts, 0.012, 0x5aa84a);
  k.cyl(g, 0x8fd070, 0.005, 0.007, L * 0.9, [0, L * 0.45, 0.008], [0, 0, 0], 4, { outline: false });
  return m;
}

/** Tube along a curve with radius varying with t; takes only the stretch of the curve from t0 to t1, which makes it easy to color in segments (the eel body's gradient) */
function taperGeo(pts: V3[], rFn: (t: number) => number, o: { segs?: number; radial?: number; t0?: number; t1?: number } = {}): THREE.BufferGeometry {
  const full = new THREE.CatmullRomCurve3(pts.map(vec));
  const t0 = o.t0 ?? 0;
  const t1 = o.t1 ?? 1;
  const segs = o.segs ?? 24;
  const radial = o.radial ?? 12;
  const sub = new THREE.CatmullRomCurve3(Array.from({ length: 14 }, (_, i) => full.getPointAt(t0 + ((t1 - t0) * i) / 13)));
  const geo = new THREE.TubeGeometry(sub, segs, 1, radial, false);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const ctr = sub.getPointAt(u);
    const r = Math.max(0.002, rFn(t0 + (t1 - t0) * u));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(p, idx).sub(ctr).multiplyScalar(r).add(ctr);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Position and frame at t on the curve: tan the tangent, up the dorsal side, side the lateral side (for sticking fins and whistle pipes onto the body) */
function frameAt(curve: THREE.Curve<THREE.Vector3>, t: number): { p: THREE.Vector3; tan: THREE.Vector3; up: THREE.Vector3; side: THREE.Vector3 } {
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t).normalize();
  const ref = Math.abs(tan.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(tan, ref).normalize();
  const up = new THREE.Vector3().crossVectors(side, tan).normalize();
  return { p, tan, up, side };
}

/** Align the group's local x/y/z axes to the three given directions */
function orient(g: THREE.Object3D, x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3): void {
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** A puff of white steam drifting up (three spheres growing larger), bobbing up and down */
function steamPuff(k: Kit, c: Creature, parent: THREE.Object3D, pos: V3, sz: number, dir: V3, phase: number, col: C = 0xf6faff): THREE.Group {
  const g = k.group(parent, pos);
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    ball(k, g, col, sz * (0.55 + t * 0.55), [dir[0] * t * sz * 1.6, dir[1] * t * sz * 1.6 + sz * 0.3 * t, dir[2] * t * sz * 1.6], [1, 0.9, 1], [0, 0, 0], { outline: false, emissive: 0xffffff, emissiveAmt: 0.2 });
  }
  c.bobbers.push({ g, base: pos[1], amp: sz * 0.35, speed: 1.8 + (phase % 3) * 0.3, phase });
  return g;
}

/** The point at t on the curve (for placing barbs along a feather shaft and a flame at the tail end) */
function curveAt(pts: V3[], t: number): V3 {
  const p = new THREE.CatmullRomCurve3(pts.map(vec)).getPointAt(t);
  return [p.x, p.y, p.z];
}

/** Low-segment small sphere (small decorations such as rivets, spots, noses), saving about 83% of the triangles compared with k.sphere */
function ball(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 12, 8);
  g.scale(...scale);
  return k.mesh(parent, g, col, pos, rot, o);
}

// ───────────────────────── Emberspine Volcanic Belt (fire) ─────────────────────────

const COAL = 0x2a2226;
const COAL_BODY = 0x3a2e33;
const COAL2 = 0x54444a;
const LAVA = 0xff7a2a;

/** Face of the `bellowsbeast` family: charcoal-gray muzzle, a magma nose tip, round ears, cracks on the forehead */
function coalFace(k: Kit, c: Creature, head: THREE.Object3D, hr: number, s: number) {
  k.sphere(head, 0x65545a, hr * 0.4, [0, -hr * 0.4, hr * 0.7], [1, 0.66, 0.85]);
  k.glowSphere(head, 0xff6a2a, hr * 0.1, [0, -hr * 0.26, hr * 1.03], 2.6, [1.3, 0.85, 0.7]);
  k.glowSphere(head, 0xffa040, hr * 0.07, [0, -hr * 0.5, hr * 0.98], 2.2, [1.6, 0.6, 0.5]);
  faceEyes(k, head, hr, { x: hr * 0.42, y: hr * 0.12, r: hr * 0.27, iris: 0xff8a1a, glow: s === 3 });
  k.blush(head, hr * 0.68, -hr * 0.22, hr * 0.64, hr * 0.15, 0xff7a5a);
  roundEars(k, c, head, COAL_BODY, LAVA, hr * 0.3, hr * 0.72, hr * 0.62);
  crack(k, head, [0, 0, 0], [hr, hr, hr], [[1.3, 0.35], [1.02, 0.08], [0.9, 0.24], [0.64, 0.02]], hr * 0.045);
  crack(k, head, [0, 0, 0], [hr, hr, hr], zig(0.6, 1.3, -0.2, 1.95, 3, 0.14, 5), hr * 0.04);
  crack(k, head, [0, 0, 0], [hr, hr, hr], zig(0.7, -1.4, -0.1, -2.0, 3, 0.14, 9), hr * 0.04);
}

function chimney(k: Kit, parent: THREE.Object3D, pos: V3, rot: V3, h: number, r: number) {
  const g = k.group(parent, pos, rot);
  k.cyl(g, 0x4a4248, r * 0.85, r, h, [0, h / 2, 0], [0, 0, 0], 12);
  k.torus(g, 0x5e5660, r * 0.9, r * 0.28, [0, h, 0], [PI / 2, 0, 0]);
  k.glowSphere(g, LAVA, r * 0.7, [0, h, 0], 2.6, [1, 0.3, 1]);
  k.flame(g, 0xff5a1a, 0xffe066, r * 1.7, [0, h + 0.01, 0]);
  return g;
}

// ───────────────────────── Skyhowl Highlands (wind) ─────────────────────────

const PAPER = 0xf3ead6;
const INK = 0xb0a184;
const SEAL = 0xc8323a;

/** An origami crane (assembled at the origin of parent, with the body center at the origin and the head toward +z); returns the head group */
function crane(k: Kit, c: Creature, parent: THREE.Object3D, sz: number, o: { col?: C; face?: boolean; seal?: boolean; flap?: number; ink?: number; iris?: C }): THREE.Group {
  const col = o.col ?? PAPER;
  // The paper has a bit of warm-white emissive, so it does not turn gray under the toon shadows
  const sheen: PartOpts = { emissive: 0xfff4e0, emissiveAmt: 0.14 };
  // Body: a diamond pointed at front and back + the keel fold underneath
  const body = new THREE.OctahedronGeometry(1, 0);
  body.scale(0.2 * sz, 0.17 * sz, 0.34 * sz);
  facet(k, c, parent, body, col, [0, 0, 0], [0, 0, 0], sheen);
  plate(k, c, parent, [[0.3 * sz, 0.02 * sz], [-0.3 * sz, 0.02 * sz], [0, -0.22 * sz]], 0.035 * sz, col, [0, -0.02 * sz, 0], [0, 0, 0], true, sheen);
  // Wings: two triangles folded into a V crease along the midline, spreading outward and upward
  for (const sx of [-1, 1]) {
    const g = k.group(parent, [sx * 0.1 * sz, 0.06 * sz, 0]);
    const halves: [[number, number][], number][] = [
      [[[0.02, 0.3], [0.02, 0.0], [0.88, -0.05]], 0.22],
      [[[0.02, 0.0], [0.02, -0.3], [0.88, -0.05]], -0.22],
    ];
    for (const [pts, tilt] of halves) {
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(sx * x * sz, y * sz)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02 * sz, bevelEnabled: false });
      geo.translate(0, 0, -0.01 * sz);
      // Laid flat into the xz plane (the shape's y maps to +z), then folded about the line from wing root to wing tip to make the crease
      geo.rotateX(-PI / 2);
      geo.rotateX(tilt);
      facet(k, c, g, geo, col, [0, 0, 0], [0, 0, 0], sheen);
    }
    // Faint handwriting: a few short lines on the wings
    if (o.ink) {
      const lines: THREE.BufferGeometry[] = [];
      for (let i = 0; i < o.ink; i++) {
        const x = sx * (0.22 + i * 0.16) * sz;
        const len = (0.2 - i * 0.03) * sz;
        for (const face of [-1, 1]) {
          const lg = new THREE.BoxGeometry(0.014 * sz, 0.006 * sz, len);
          lg.translate(x, face * 0.014 * sz, (0.02 - i * 0.02) * sz);
          lines.push(lg);
        }
      }
      k.mesh(g, mergeGeometries(lines)!, INK, [0, 0, 0], [0, 0, 0], { outline: false });
    }
    c.wings.push({ g, side: sx, base: 0.68, amp: 0.26, speed: o.flap ?? 3.2 });
  }
  // Neck and tail: long thin pointed triangles, the neck going forward and up, the tail backward and up
  const neck = k.group(parent, [0, 0.02 * sz, 0.2 * sz], [0.62, 0, 0]);
  plate(k, c, neck, [[0.07 * sz, 0], [-0.07 * sz, 0], [0.005 * sz, 0.52 * sz]], 0.04 * sz, col, [0, 0, 0], [0, 0, 0], true, sheen);
  const tail = k.group(parent, [0, 0.02 * sz, -0.22 * sz], [-0.72, 0, 0]);
  plate(k, c, tail, [[0.07 * sz, 0], [-0.07 * sz, 0], [-0.01 * sz, 0.5 * sz]], 0.04 * sz, col, [0, 0, 0], [0, 0, 0], true, sheen);
  // Head: a small diamond + a pointed beak folded downward
  const head = k.group(neck, [0, 0.5 * sz, 0.01 * sz], [-0.62, 0, 0]);
  const hg = new THREE.OctahedronGeometry(1, 0);
  hg.scale(0.11 * sz, 0.1 * sz, 0.12 * sz);
  facet(k, c, head, hg, col, [0, 0, 0], [0, 0, 0], sheen);
  const beak = new THREE.ConeGeometry(0.035 * sz, 0.18 * sz, 4, 1);
  beak.translate(0, 0.09 * sz, 0);
  facet(k, c, head, beak, col, [0, -0.03 * sz, 0.1 * sz], [PI / 2 + 0.45, PI / 4, 0], sheen);
  if (o.face) k.eyes(head, { x: 0.055 * sz, y: 0.015 * sz, z: 0.06 * sz, r: 0.04 * sz, iris: o.iris ?? 0x3a3450 });
  // Red wax seal on the chest
  if (o.seal) {
    const sg = k.group(parent, [0, -0.06 * sz, 0.2 * sz], [-0.5, 0, 0]);
    k.cyl(sg, SEAL, 0.07 * sz, 0.075 * sz, 0.028 * sz, [0, 0, 0], [PI / 2, 0, 0], 10);
    k.torus(sg, 0x9a1e2a, 0.042 * sz, 0.009 * sz, [0, 0, 0.016 * sz], [0, 0, 0], PI * 2, { outline: false });
    ball(k, sg, 0x9a1e2a, 0.016 * sz, [0, 0, 0.016 * sz], [1, 1, 0.4], [0, 0, 0], { outline: false });
    k.glowSphere(sg, 0xff8a7a, 0.02 * sz, [0.02 * sz, 0.02 * sz, 0.02 * sz], 1.6, [1, 1, 0.4]);
  }
  return head;
}

// ───────────────────────── Species ─────────────────────────

export const SPECIES_FIRE_WIND: Record<string, Builder> = {
  // `bellowsbeast`
  bellowsbeast(k, c, s) {
    const IRON = 0x8a8494;
    const IRON_D = 0x4e4956;
    const LEATHER = 0x6a4a34;
    if (s < 3) {
      const big = s === 2;
      const q = quad(k, c, { col: COAL_BODY, belly: COAL2, len: big ? 0.5 : 0.36, r: big ? 0.36 : 0.31, leg: big ? 0.18 : 0.12, legR: big ? 0.1 : 0.085, headR: big ? 0.33 : 0.36, headZ: big ? 0.06 : 0.02, paw: COAL });
      coalFace(k, c, q.head, q.headR, s);
      const bc: V3 = [0, q.bodyY, 0];
      const bs: V3 = [q.r, q.r * 0.88, q.len];
      for (const sx of [-1, 1]) {
        crack(k, c.body, bc, bs, zig(0.6, sx * 1.1, -0.25, sx * 1.95, 4, 0.16, sx * 3 + s), 0.02);
        crack(k, c.body, bc, bs, zig(0.1, sx * 2.25, 0.8, sx * 2.8, 3, 0.14, sx * 7), 0.018);
        crack(k, c.body, bc, bs, zig(-0.1, sx * 0.5, 0.35, sx * 1.4, 3, 0.12, sx * 13 + s), 0.016);
      }
      crack(k, c.body, bc, bs, zig(1.25, -2.6, 0.8, -3.5, 3, 0.12, 11), 0.016);
      // Magma belly: a horizontal band of furnace-mouth light
      k.glowSphere(c.body, 0xff6a1a, 0.06, [0, q.bodyY - q.r * 0.55, q.len * 0.55], 2.2, [1.5, 0.5, 1]);
      // Firelight showing through the gaps in the paws
      for (const l of c.legs) k.glowSphere(l.g, LAVA, 0.02, [0, -(big ? 0.15 : 0.1), big ? 0.12 : 0.1], 2.4, [1.6, 0.5, 0.6]);
      if (!big) {
        // I: a tiny ember tail
        const tail = k.group(q.tail, [0, 0.02, 0], [0.7, 0, 0]);
        k.sphere(tail, COAL_BODY, 0.08, [0, 0, -0.04]);
        k.glowSphere(tail, LAVA, 0.035, [0, 0, -0.11], 2.6);
        c.tails.push({ g: tail, phase: 0, amp: 0.35, axis: 'y' });
      } else {
        // II: a riveted iron furnace and chimney on the back, a furnace grate on the belly
        const tip = tailChain(k, c, q.tail, COAL_BODY, 3, 0.08, 0.1, 0.1);
        k.flame(tip, 0xff5a1a, 0xffe066, 0.1, [0, 0.02, -0.04], [-0.9, 0, 0]);
        const stove = k.group(c.body, [0, q.bodyY + q.r * 0.62, -0.06], [-0.1, 0, 0]);
        k.sphere(stove, IRON_D, 1, [0, 0, 0], [0.2, 0.12, 0.2]);
        k.torus(stove, IRON, 0.19, 0.022, [0, 0.03, 0], [PI / 2, 0, 0]);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          ball(k, stove, 0x8a8494, 0.018, [Math.cos(a) * 0.19, 0.03, Math.sin(a) * 0.19], [1, 1, 1], [0, 0, 0], { outline: false });
        }
        chimney(k, stove, [0, 0.06, -0.02], [-0.12, 0, 0], 0.26, 0.09);
        steamPuff(k, c, stove, [0.04, 0.42, -0.08], 0.05, [0.4, 1, -0.2], 1, 0x9a96a4);
        const grate = k.group(c.body, [0, q.bodyY - q.r * 0.25, q.len * 0.78], [0.3, 0, 0]);
        k.torus(grate, IRON, 0.1, 0.018, [0, 0, 0], [0, 0, 0]);
        k.glowSphere(grate, 0xff7a2a, 0.09, [0, 0, -0.01], 2.4, [1, 1, 0.3]);
        for (const dx of [-0.05, 0, 0.05]) k.cyl(grate, IRON_D, 0.01, 0.01, 0.19, [dx, 0, 0.012], [0, 0, 0], 6, { outline: false });
      }
      return;
    }
    // III: an upright forge beast, a sturdy torso, anvil pauldrons, a leather apron, iron gauntlets, a forging hammer, twin chimneys
    const b = biped(k, c, { col: COAL_BODY, belly: COAL2, torsoR: 0.42, torsoH: 0.56, leg: 0.22, legR: 0.11, headR: 0.3, armLen: 0.3, armR: 0.11, hand: COAL, foot: COAL });
    coalFace(k, c, b.head, b.headR, s);
    k.flame(b.head, 0xff5a1a, 0xffe066, 0.11, [0, b.headR * 0.95, -0.02]);
    const ty = b.torsoY;
    const tc: V3 = [0, ty, 0];
    const ts: V3 = [b.tr, b.th * 0.62, b.tr * 0.88];
    for (const sx of [-1, 1]) {
      crack(k, c.body, tc, ts, zig(0.55, sx * 1.15, -0.45, sx * 1.75, 4, 0.16, sx * 5), 0.02);
      crack(k, c.body, tc, ts, zig(0.3, sx * 2.1, -0.3, sx * 2.7, 3, 0.14, sx * 9), 0.018);
      crack(k, c.body, tc, ts, zig(0.9, sx * 0.4, 0.4, sx * 1.1, 3, 0.12, sx * 17), 0.016);
    }
    for (const a of c.arms) crack(k, a.g, [0, -0.16, 0], [0.11, 0.2, 0.11], zig(0.9, 0.3, -0.6, 1.4, 4, 0.2, 21), 0.014);
    for (const l of c.legs) crack(k, l.g, [0, -0.08, 0], [0.11, 0.14, 0.11], zig(0.8, 0.2, -0.5, 1.2, 3, 0.2, 23), 0.014);
    // Furnace fire on the chest: an iron-ringed furnace door, a grate, a ball of fire inside
    const door = k.group(c.body, [0, ty + 0.04, b.tr * 0.92], [0.15, 0, 0]);
    k.torus(door, IRON, 0.16, 0.03, [0, 0, 0], [0, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + PI / 6;
      ball(k, door, 0xb0aabc, 0.018, [Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.02], [1, 1, 0.6], [0, 0, 0], { outline: false });
    }
    k.glowSphere(door, 0xff5a1a, 0.13, [0, 0, -0.03], 2.4, [1, 1, 0.5]);
    k.glowSphere(door, 0xffd060, 0.07, [0, -0.02, 0.0], 3, [1, 1, 0.5]);
    for (const dx of [-0.07, 0, 0.07]) k.cyl(door, IRON_D, 0.012, 0.012, 0.27, [dx, 0, 0.02], [0, 0, 0], 6, { outline: false });
    k.flame(door, 0xff5a1a, 0xffe066, 0.07, [0, -0.06, 0.03], [-0.3, 0, 0]);
    // Leather apron and belt
    plate(k, c, c.body, [[-0.22, 0.08], [0.22, 0.08], [0.24, -0.16], [0.16, -0.24], [-0.16, -0.24], [-0.24, -0.16]], 0.03, LEATHER, [0, ty - 0.24, b.tr * 0.78], [0.12, 0, 0]);
    k.torus(c.body, 0x4a3226, b.tr * 0.9, 0.028, [0, ty - 0.16, 0], [PI / 2, 0, 0]);
    k.sphere(c.body, 0xd8a840, 0.045, [0, ty - 0.16, b.tr * 0.9], [1, 1, 0.5]);
    // Anvil armor on the shoulders: anvil base, anvil body, an outward-facing horn
    for (const sx of [-1, 1]) {
      const a = k.group(c.body, [sx * b.tr * 0.92, b.leg + b.th + 0.02, 0], [0, 0, -sx * 0.15]);
      box(k, c, a, IRON_D, [0.16, 0.05, 0.14], [0, 0, 0]);
      box(k, c, a, IRON_D, [0.1, 0.05, 0.1], [0, 0.05, 0]);
      box(k, c, a, IRON, [0.26, 0.07, 0.15], [sx * 0.02, 0.1, 0]);
      const horn = new THREE.ConeGeometry(0.045, 0.14, 10);
      horn.translate(0, 0.07, 0);
      k.mesh(a, horn, IRON, [sx * 0.15, 0.1, 0], [0, 0, -sx * PI / 2]);
      for (const dz of [-0.05, 0.05]) ball(k, a, 0x8a8494, 0.014, [-sx * 0.1, 0.14, dz], [1, 0.6, 1], [0, 0, 0], { outline: false });
    }
    // Iron gauntlets: thick fists, knuckle rivets
    for (const [i, hand] of b.hands.entries()) {
      k.sphere(hand, IRON, 0.13, [0, 0.03, 0], [1, 0.95, 1.05]);
      k.torus(hand, IRON_D, 0.115, 0.022, [0, 0.13, 0], [PI / 2, 0, 0]);
      for (const dx of [-0.05, 0, 0.05]) ball(k, hand, 0x8a8494, 0.016, [dx, 0.0, 0.12], [1, 1, 0.6], [0, 0, 0], { outline: false });
      if (i === 1) {
        // Forging hammer: carried on the right shoulder, the hammer head glowing red-hot
        const hm = k.group(hand, [0.02, 0, 0.03], [-0.3, 0, -0.75]);
        k.cyl(hm, 0x7a5236, 0.028, 0.032, 0.62, [0, 0.18, 0], [0, 0, 0], 8);
        k.cyl(hm, 0x5a2a22, 0.034, 0.034, 0.12, [0, 0.02, 0], [0, 0, 0], 8);
        box(k, c, hm, IRON_D, [0.17, 0.17, 0.34], [0, 0.5, 0]);
        box(k, c, hm, IRON, [0.19, 0.07, 0.36], [0, 0.5, 0]);
        k.torus(hm, IRON, 0.05, 0.02, [0, 0.62, 0], [PI / 2, 0, 0]);
        k.glow(hm, new THREE.BoxGeometry(0.12, 0.12, 0.02), 0xff8a2a, 2.6, [0, 0.5, 0.175]);
        k.glow(hm, new THREE.BoxGeometry(0.12, 0.12, 0.02), 0xff8a2a, 2.6, [0, 0.5, -0.175]);
      }
    }
    // Two chimneys and smoke behind its back
    for (const sx of [-1, 1]) {
      chimney(k, b.back, [sx * 0.15, 0.02, 0.02], [-0.3, 0, sx * 0.2], 0.26, 0.075);
      steamPuff(k, c, b.back, [sx * 0.22, 0.4, -0.08], 0.05, [sx * 0.5, 1, -0.3], sx + 2, 0x9a96a4);
    }
    const tip = tailChain(k, c, b.tail, COAL_BODY, 3, 0.08, 0.1, 0.5);
    k.flame(tip, 0xff5a1a, 0xffe066, 0.1, [0, 0, -0.05], [-0.9, 0, 0]);
    for (let i = 0; i < 3; i++) sparkle(k, c, c.body, i % 2 ? 0xffd060 : 0xff7a2a, 0.02, [Math.cos(i * 2.2) * 0.55, 0.5 + (i % 2) * 0.35, Math.sin(i * 2.2) * 0.45], 0.08);
  },

  // `shieldbeetle`
  shieldbeetle(k, c, s) {
    const SHELL = 0xb8412a;
    const SHELL_D = 0x86301f;
    const UNDER = 0x3a2828;
    const FACE = 0x4a302c;
    const GOLD = 0xf0b848;
    const GOLD_D = 0xb8842a;
    const STEEL = 0xb4bac8;
    const PLUME = 0xe8283a;
    /** Shield-like carapace: a round dome + frame + shield boss + four rivets, with the seam of the elytra along the top */
    const dome = (parent: THREE.Object3D, R: number, h: number, rim: C, boss: C, pos: V3, rot: V3, split = true) => {
      const g = k.group(parent, pos, rot);
      k.lathe(g, SHELL, [[R, 0], [R * 0.96, h * 0.32], [R * 0.82, h * 0.66], [R * 0.56, h * 0.9], [R * 0.26, h], [0.001, h * 1.02]]);
      k.torus(g, rim, R * 0.98, R * 0.08, [0, 0.005, 0], [PI / 2, 0, 0]);
      k.sphere(g, boss, R * 0.2, [0, h * 0.95, 0], [1, 0.55, 1]);
      for (let i = 0; i < 4; i++) {
        const a = i * (PI / 2) + PI / 4;
        ball(k, g, boss, R * 0.065, [Math.cos(a) * R * 0.62, h * 0.76, Math.sin(a) * R * 0.62], [1, 0.6, 1], [0, 0, 0], { outline: false });
      }
      if (split) {
        const line: V3[] = [];
        for (let i = 0; i <= 10; i++) {
          const u = (i / 10) * 2 - 1;
          const rho = Math.abs(u) * 0.95;
          line.push([0, h * Math.sqrt(Math.max(0, 1 - rho * rho)) + 0.008, u * R * 0.95]);
        }
        tube(k, g, SHELL_D, line, R * 0.028, R * 0.028, { outline: false });
      }
      return g;
    };
    /** Spear: a steel shaft, a gold guard ring, a small pennant at the butt */
    const lance = (parent: THREE.Object3D, len: number, r: number, pos: V3, rot: V3, flag = false) => {
      const g = k.group(parent, pos, rot);
      k.cone(g, STEEL, r, len, [0, 0, 0], [0, 0, 0], 12);
      k.torus(g, GOLD, r * 1.15, r * 0.4, [0, len * 0.08, 0], [PI / 2, 0, 0]);
      k.cone(g, GOLD, r * 1.9, r * 2.2, [0, r * 0.4, 0], [PI, 0, 0], 12);
      if (flag) {
        k.blade(g, PLUME, len * 0.22, len * 0.09, 0.015, [0, len * 0.72, 0], [0, 0, -PI / 2 + 0.2], { outline: false });
        k.blade(g, GOLD, len * 0.1, len * 0.05, 0.02, [0, len * 0.72, 0], [0, 0, -PI / 2 + 0.2], { outline: false });
      }
      return g;
    };
    /** Beetle face: big eyes, blush, small mandibles, antennae */
    const beetleFace = (head: THREE.Object3D, hr: number, hs: V3, tipCol: C) => {
      faceEyes(k, head, hs, { x: hr * 0.42, y: hr * 0.08, r: hr * 0.3, iris: 0xffa830 });
      k.blush(head, hr * 0.66, -hr * 0.26, hr * 0.62, hr * 0.15);
      ball(k, head, 0x241818, hr * 0.06, [0, -hr * 0.3, hr * 0.95], [1.5, 0.45, 0.5], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        const base = k.group(head, [sx * hr * 0.32, hr * 0.72, hr * 0.15], [0, 0, 0]);
        const g = k.group(base, [0, 0, 0]);
        tube(k, g, FACE, [[0, 0, 0], [sx * hr * 0.25, hr * 0.5, hr * 0.2], [sx * hr * 0.62, hr * 0.85, hr * 0.15]], hr * 0.05, hr * 0.035);
        k.sphere(g, tipCol, hr * 0.12, [sx * hr * 0.62, hr * 0.88, hr * 0.15]);
        c.ears.push({ g, phase: sx * 1.4 });
        k.horn(head, 0xe8d6b8, hr * 0.07, hr * 0.28, hr * 0.1, [sx * hr * 0.28, -hr * 0.62, hr * 0.62], [PI / 2 + 0.3, 0, -sx * 0.7]);
      }
    };
    if (s < 3) {
      c.archetype = 'crawl';
      const sz = s === 1 ? 1 : 1.25;
      const y = 0.17 * sz;
      k.sphere(c.body, UNDER, 1, [0, y, 0], [0.25 * sz, 0.13 * sz, 0.31 * sz]);
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const g = k.group(c.body, [sx * 0.2 * sz, y - 0.02, (0.15 - i * 0.14) * sz], [0, sx * (1 - i) * 0.45, sx * 0.8]);
          k.capsule(g, UNDER, 0.034 * sz, 0.1 * sz, [0, -0.07 * sz, 0]);
          if (s === 2) k.torus(g, GOLD, 0.036 * sz, 0.01 * sz, [0, -0.1 * sz, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
          k.sphere(g, 0x241818, 0.042 * sz, [0, -0.15 * sz, 0.01], [1, 0.7, 1.25]);
          c.legs.push({ g, phase: i * 2.1 + (sx > 0 ? PI : 0), amp: 0.6 });
        }
      }
      dome(c.body, 0.31 * sz, 0.21 * sz, s === 1 ? SHELL_D : GOLD, s === 1 ? 0xd8c8b8 : GOLD, [0, y + 0.01, -0.03 * sz], [0, 0, 0]);
      const head = k.group(c.body, [0, y + 0.05 * sz, 0.35 * sz]);
      c.head = head;
      const hr = 0.19 * sz;
      const hs: V3 = [hr * 1.05, hr * 0.92, hr * 0.95];
      k.sphere(head, FACE, 1, [0, 0, 0], hs);
      beetleFace(head, hr, hs, s === 1 ? SHELL : GOLD);
      if (s === 2) lance(head, 0.52, 0.05, [0, hr * 0.62, hr * 0.35], [0.9, 0, 0]);
      return;
    }
    // III: an upright beetle knight
    const b = biped(k, c, { col: UNDER, belly: 0x5a3a34, torsoR: 0.3, torsoH: 0.48, leg: 0.22, legR: 0.085, headR: 0.27, armLen: 0.24, armR: 0.075, hand: 0x2a1c1c, foot: 0x2a1c1c });
    const ty = b.torsoY;
    // Breastplate + gold shield boss, a belt; gold greaves on the shins
    k.sphere(c.body, SHELL, 1, [0, ty + 0.04, 0.07], [0.29, 0.25, 0.24]);
    k.torus(c.body, GOLD, 0.26, 0.02, [0, ty - 0.1, 0.02], [PI / 2 - 0.2, 0, 0]);
    k.sphere(c.body, GOLD, 0.05, [0, ty + 0.08, 0.3], [1, 1, 0.5]);
    for (const l of c.legs) k.cyl(l.g, GOLD, 0.095, 0.1, 0.07, [0, -0.1, 0], [0, 0, 0], 12);
    // Folded elytra on the back: a shield-like back carapace, the elytra seam pointing up
    dome(c.body, 0.3, 0.14, GOLD, GOLD, [0, ty + 0.08, -0.2], [-PI / 2 - 0.15, 0, 0]);
    // The middle pair of small legs: tucked against the sides of the body
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * 0.27, ty - 0.06, 0.06], [0, 0, sx * 1.1]);
      k.capsule(g, UNDER, 0.03, 0.1, [0, -0.06, 0]);
      k.sphere(g, 0x241818, 0.035, [0, -0.13, 0.01]);
    }
    // Head: the face exposed, a helmet covering the top and back of the head, a spear-horn on the brow, a red plume on top
    const hr = b.headR;
    const hs: V3 = [hr, hr, hr];
    beetleFace(b.head, hr, hs, GOLD);
    const helm = k.group(b.head, [0, hr * 0.08, -hr * 0.04], [-0.5, 0, 0]);
    const R = hr * 1.1;
    const prof: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const a2 = (i / 8) * (PI / 2);
      prof.push([Math.max(0.001, Math.cos(a2) * R), Math.sin(a2) * R]);
    }
    k.lathe(helm, SHELL, prof);
    k.torus(helm, GOLD, R, hr * 0.08, [0, 0, 0], [PI / 2, 0, 0]);
    k.sphere(helm, GOLD, hr * 0.12, [0, R * 0.98, 0], [1, 0.6, 1]);
    const at = (deg: number): V3 => [0, R * Math.sin((deg * PI) / 180), R * Math.cos((deg * PI) / 180)];
    lance(helm, 0.34, 0.045, at(24), [1.4, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const deg = 58 + i * 22;
      const g = k.group(helm, at(deg), [PI / 2 - (deg * PI) / 180 - 0.3, 0, 0]);
      k.blade(g, i % 2 ? 0xff5a4a : PLUME, 0.34 - i * 0.03, 0.12, 0.05, [0, 0, 0]);
      k.blade(g, 0xffb0a0, 0.16 - i * 0.01, 0.05, 0.06, [0, 0.16 - i * 0.015, 0.01], [0, 0, 0], { outline: false });
    }
    // Round shield in the left hand (shield face turned forward and slightly outward), spear in the right hand (upright, with the pennant at the butt)
    dome(b.hands[0], 0.25, 0.09, GOLD, GOLD, [-0.1, 0.05, 0.03], [PI / 2, 0, 0.5], false);
    lance(b.hands[1], 1.0, 0.062, [0, -0.2, 0.03], [0.08, 0, -0.2], true);
    k.cyl(b.hands[1], 0x6a2a22, 0.07, 0.07, 0.16, [0, 0.0, 0.03], [0.08, 0, -0.2], 10);
    k.sphere(b.hands[1], 0x2a1c1c, 0.075, [0, 0.02, 0.03]);
    for (let i = 0; i < 2; i++) sparkle(k, c, c.body, 0xffd070, 0.02, [Math.cos(i * 2.6) * 0.5, 0.5 + i * 0.35, Math.sin(i * 2.6) * 0.4], 0.06);
  },

  // `steameel`
  steameel(k, c, s) {
    c.archetype = 'crawl';
    const BLUE = 0x2f7fbf;
    const BLUE_L = 0x5fb0e8;
    const PALE = 0xcdeeff;
    const ORANGE = 0xff7a3a;
    const ORANGE_D = 0xd8551e;
    const BRASS = 0xd9a441;
    const BRASS_D = 0xa8762a;
    const CREAM = 0xf4e2b0;
    const sz = [0.85, 1, 1.12][s - 1];
    const r0 = [0.11, 0.115, 0.125][s - 1];
    const hr = [0.22, 0.2, 0.2][s - 1] * sz;
    const hy = [0.42, 0.5, 0.64][s - 1];
    // Body path (unit space, then multiplied by sz): drops vertically from under the head to the ground, makes an S on the ground, and curls the tail tip up
    const P = (x: number, y: number, z: number): V3 => [x * sz, y * sz, z * sz];
    const pts: V3[] = [
      P(0, hy - 0.1, 0.3),
      P(0, r0 + 0.14, 0.3),
      P(0.02, r0, 0.12),
      P(0.24, r0, -0.1),
      P(0.1, r0, -0.38),
      P(-0.22, r0, -0.44),
      P(-0.44, r0, -0.2),
      P(-0.38, r0 + 0.08, 0.06),
      P(-0.2, r0 + 0.24, 0.14),
    ];
    const curve = new THREE.CatmullRomCurve3(pts.map(vec));
    const baseR = (t: number) => r0 * sz * (1.05 - 0.6 * t);
    // Segmented tubes: a sea-blue gradient on the front half to lava orange on the back half, each segment bulging slightly like a string of beads
    const nSeg = [7, 9, 10][s - 1];
    // Blue to orange is not blended directly (it would turn a dirty purple), and passes through a stretch of bright yellow-white like red-hot metal
    const cA = new THREE.Color(BLUE);
    const cM = new THREE.Color(0xf8e8b0);
    const cB = new THREE.Color(ORANGE);
    for (let i = 0; i < nSeg; i++) {
      const t0 = i / nSeg;
      const t1 = Math.min(1, (i + 1) / nSeg + 0.015);
      const tm = (t0 + t1) / 2;
      const m = Math.min(1, Math.max(0, (tm - 0.34) / 0.3));
      const mix = m * m * (3 - 2 * m);
      const col = (mix < 0.5 ? cA.clone().lerp(cM, mix * 2) : cM.clone().lerp(cB, (mix - 0.5) * 2)).getHex();
      const geo = taperGeo(pts, (t) => baseR(t) * (1 + 0.1 * Math.sin((PI * (t - t0)) / (t1 - t0))), { t0, t1, segs: 10 });
      k.mesh(c.body, geo, col, [0, 0, 0], [0, 0, 0], mix > 0.6 ? { emissive: 0xff5a1a, emissiveAmt: 0.22 } : {});
      // Bright spots on the lava section
      if (mix > 0.7 && i % 2 === 0) {
        const f = frameAt(curve, tm);
        const q = f.p.clone().addScaledVector(f.up, baseR(tm) * 0.6).addScaledVector(f.side, baseR(tm) * 0.55);
        k.glowSphere(c.body, 0xffc040, baseR(tm) * 0.28, [q.x, q.y, q.z], 2.4, [1, 0.5, 1]);
      }
    }
    // Pale belly: the underside of the neck and front section
    for (const t of [0.12, 0.2, 0.28]) {
      const f = frameAt(curve, t);
      const q = f.p.clone().addScaledVector(f.up, -baseR(t) * 0.35);
      const g = k.group(c.body, [q.x, q.y, q.z]);
      orient(g, f.tan, f.up, f.side);
      k.sphere(g, PALE, baseR(t), [0, 0, 0], [1.2, 0.55, 0.85], [0, 0, 0], { outline: false });
    }
    // Dorsal fin: a row along the spine; III has glowing translucent fins
    const nFin = [5, 7, 10][s - 1];
    for (let i = 0; i < nFin; i++) {
      const t = 0.1 + (i / (nFin - 1)) * 0.62;
      const f = frameAt(curve, t);
      const rr = baseR(t);
      const g = k.group(c.body, [f.p.x + f.up.x * rr * 0.75, f.p.y + f.up.y * rr * 0.75, f.p.z + f.up.z * rr * 0.75]);
      orient(g, f.tan, f.up, f.side);
      const hot = t > 0.5;
      if (s === 3) {
        const fin = new THREE.SphereGeometry(0.5, 12, 8);
        fin.scale(rr * 1.5, rr * 1.9, rr * 0.2);
        fin.translate(0, rr * 0.8, 0);
        k.glow(g, fin, hot ? 0xffd070 : 0x8ff0ff, 1.4, [0, 0, 0], [0, 0, 0], 0.8);
      } else {
        k.blade(g, hot ? ORANGE_D : BLUE_L, rr * 1.3, rr * 1.2, rr * 0.25, [0, 0, 0], [0, 0, 0], { outline: true });
      }
    }
    // Pectoral fins: on both sides of the neck base
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * r0 * sz * 0.85, r0 * sz * 1.55, 0.3 * sz]);
      k.blade(g, BLUE_L, 0.17 * sz, 0.08 * sz, 0.02, [0, 0, 0], [0.3, 0, 0]);
      k.blade(g, PALE, 0.11 * sz, 0.045 * sz, 0.025, [0, 0.01, 0.005], [0.3, 0, 0], { outline: false });
      c.wings.push({ g, side: -sx, base: 1.25, amp: 0.12, speed: 2.4 });
    }
    // Whistle pipes on the back (from II): brass pipes with dark mouths, venting steam alternately
    const pipeT = s === 1 ? [] : s === 2 ? [0.2, 0.31, 0.42, 0.53, 0.64] : [0.16, 0.29, 0.42, 0.55];
    pipeT.forEach((t, j) => {
      const f = frameAt(curve, t);
      const rr = baseR(t);
      const g = k.group(c.body, [f.p.x, f.p.y, f.p.z]);
      orient(g, f.tan, f.up, f.side);
      const ph = rr * (s === 3 ? 1.9 : 1.5) * (1 - (j % 2) * 0.15);
      const pr = rr * (s === 3 ? 0.36 : 0.3);
      k.cyl(g, BRASS, pr, pr * 1.15, ph, [0, rr * 0.6 + ph / 2, 0], [0, 0, 0], 10);
      k.torus(g, BRASS_D, pr * 1.08, pr * 0.3, [0, rr * 0.6 + ph, 0], [PI / 2, 0, 0]);
      k.torus(g, BRASS_D, pr * 1.02, pr * 0.22, [0, rr * 0.6 + ph * 0.35, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      k.cyl(g, 0x2a1a14, pr * 0.78, pr * 0.78, 0.006, [0, rr * 0.6 + ph + 0.004, 0], [0, 0, 0], 10, { outline: false });
      if (j % 2 === 0) steamPuff(k, c, g, [0, rr * 0.6 + ph + 0.05 * sz, 0], 0.04 * sz, [0.2, 1, 0], j);
    });
    // Tail fin: a vertical paddle-shaped fin that sways left and right
    const ft = frameAt(curve, 0.985);
    const tb = k.group(c.body, [ft.p.x, ft.p.y, ft.p.z]);
    orient(tb, ft.tan, ft.up, ft.side);
    const tf = k.group(tb, [0, 0, 0]);
    c.tails.push({ g: tf, phase: 0, amp: 0.3, axis: 'y' });
    k.blade(tf, ORANGE, 0.24 * sz, 0.1 * sz, 0.02, [0, 0, 0], [0, 0, -0.5], { emissive: 0xff5a1a, emissiveAmt: 0.25 });
    k.blade(tf, ORANGE, 0.14 * sz, 0.08 * sz, 0.02, [0, 0, 0], [PI, 0, 0.6], { emissive: 0xff5a1a, emissiveAmt: 0.25 });
    k.blade(tf, 0xffd070, 0.16 * sz, 0.045 * sz, 0.024, [0, 0.01, 0], [0, 0, -0.5], { outline: false, emissive: 0xffb040, emissiveAmt: 0.5 });
    // Head
    const head = k.group(c.body, [0, hy * sz, 0.3 * sz]);
    c.head = head;
    const hs: V3 = s === 3 ? [hr, hr * 0.9, hr * 1.1] : [hr * 1.05, hr * 0.95, hr];
    k.sphere(head, BLUE, 1, [0, 0, 0], hs);
    if (s < 3) {
      k.sphere(head, PALE, hr, [0, -hr * 0.38, hr * 0.4], [0.74, 0.46, 0.66], [0, 0, 0], { outline: false });
      faceEyes(k, head, hs, { x: hr * 0.42, y: hr * 0.1, r: hr * 0.3, iris: 0xff9a2a });
      k.blush(head, hr * 0.7, -hr * 0.26, hr * 0.64, hr * 0.14);
      ball(k, head, 0x1a3050, hr * 0.06, [0, -hr * 0.34, hr * 0.98], [1.6, 0.4, 0.5], [0, 0, 0], { outline: false });
      k.blade(head, BLUE_L, hr * 0.75, hr * 0.14, hr * 0.5, [0, hr * 0.7, -hr * 0.1], [-0.55, 0, 0]);
    } else {
      // Dragon head: a long muzzle, lower jaw, nostrils, fangs, horns, whiskers
      k.sphere(head, BLUE, hr, [0, -hr * 0.18, hr * 0.78], [0.66, 0.52, 0.72]);
      k.sphere(head, PALE, hr, [0, -hr * 0.44, hr * 0.62], [0.6, 0.3, 0.72], [0, 0, 0], { outline: false });
      k.sphere(head, BLUE_L, hr, [0, -hr * 0.4, hr * 0.98], [0.5, 0.2, 0.42]);
      for (const sx of [-1, 1]) {
        ball(k, head, 0x1a3050, hr * 0.06, [sx * hr * 0.18, -hr * 0.1, hr * 1.42], [1, 0.7, 0.6], [0, 0, 0], { outline: false });
        k.cone(head, 0xffffff, hr * 0.045, hr * 0.14, [sx * hr * 0.3, -hr * 0.38, hr * 1.2], [PI, 0, 0], 6, { outline: false });
        k.horn(head, CREAM, hr * 0.13, hr * 1.3, hr * 0.45, [sx * hr * 0.42, hr * 0.6, -hr * 0.15], [-0.5, 0, -sx * 0.45]);
        k.sphere(head, BLUE, 1, [sx * hr * 0.4, hr * 0.36, hr * 0.7], [hr * 0.3, hr * 0.14, hr * 0.28], [0, 0, -sx * 0.3]);
        tube(k, head, 0xfff0c0, [[sx * hr * 0.36, -hr * 0.28, hr * 1.3], [sx * hr * 0.9, -hr * 0.36, hr * 1.1], [sx * hr * 1.4, -hr * 0.1, hr * 0.7]], hr * 0.045, hr * 0.016, { glow: 2 });
        steamPuff(k, c, head, [sx * hr * 0.62, -hr * 0.4, hr * 1.05], hr * 0.16, [sx * 0.8, 0.5, 0.4], sx * 2);
      }
      faceEyes(k, head, hs, { x: hr * 0.42, y: hr * 0.18, r: hr * 0.26, iris: 0xff9a2a, sharp: true, glow: true });
      const crest = new THREE.SphereGeometry(0.5, 12, 8);
      crest.scale(hr * 0.2, hr * 1.1, hr * 0.9);
      crest.translate(0, hr * 0.45, 0);
      k.glow(head, crest, 0x8ff0ff, 1.2, [0, hr * 0.7, -hr * 0.2], [-0.5, 0, 0], 0.7);
    }
    // Gill-cover fins and white steam
    for (const sx of [-1, 1]) {
      const gill = k.group(head, [sx * hr * 0.9, -hr * 0.05, -hr * 0.1]);
      for (let i = 0; i < 3; i++) k.blade(gill, i === 1 ? PALE : BLUE_L, hr * (0.6 - i * 0.08), hr * 0.3, 0.02, [0, 0, -i * 0.012], [0, sx * 0.5, -sx * (0.95 + i * 0.45)]);
      c.ears.push({ g: gill, phase: sx * 1.3 });
      steamPuff(k, c, head, [sx * hr * 1.2, hr * 0.15, -hr * 0.4], hr * (s === 1 ? 0.16 : 0.2), [sx * 0.6, 0.9, -0.3], sx);
    }
    for (let i = 0; i < s; i++) sparkle(k, c, c.body, i % 2 ? 0xbfefff : 0xffc040, 0.02, [Math.cos(i * 2.1) * 0.5, 0.35 + i * 0.2, Math.sin(i * 2.1) * 0.4], 0.06);
  },

  // `phoenix` (single form)
  phoenix(k, c) {
    c.archetype = 'bird';
    c.hover = 0.3;
    const RED = 0xe8452a;
    const EDGE = 0xfff0b0;
    const GOLD = 0xffc83a;
    const CHEST = 0xffa25a;
    const y = 0.62;
    k.sphere(c.body, RED, 1, [0, y, 0], [0.2, 0.25, 0.24], [-0.35, 0, 0]);
    k.sphere(c.body, CHEST, 1, [0, y - 0.02, 0.09], [0.15, 0.2, 0.16], [-0.35, 0, 0], { outline: false });
    for (let i = 0; i < 3; i++) k.blade(c.body, EDGE, 0.1, 0.07, 0.02, [(i - 1) * 0.06, y - 0.08 - Math.abs(i - 1) * 0.02, 0.2], [PI - 0.3, 0, 0], { outline: false });
    k.capsule(c.body, RED, 0.09, 0.14, [0, y + 0.2, 0.07], [0.35, 0, 0]);
    const head = k.group(c.body, [0, y + 0.37, 0.12]);
    c.head = head;
    const hr = 0.19;
    k.sphere(head, RED, hr);
    k.sphere(head, CHEST, hr * 0.7, [0, -hr * 0.38, hr * 0.45], [1, 0.55, 0.7], [0, 0, 0], { outline: false });
    faceEyes(k, head, hr, { x: hr * 0.4, y: hr * 0.12, r: hr * 0.28, iris: 0xffb020, sharp: true });
    const beak = new THREE.ConeGeometry(hr * 0.2, hr * 0.6, 10);
    beak.translate(0, hr * 0.3, 0);
    k.mesh(head, beak, GOLD, [0, -hr * 0.14, hr * 0.88], [PI / 2 + 0.3, 0, 0]);
    // Gold-and-white feather markings at the corner of the eye
    for (const sx of [-1, 1]) k.blade(head, EDGE, hr * 0.55, hr * 0.13, 0.02, [sx * hr * 0.66, hr * 0.12, hr * 0.62], [0, sx * 0.7, -sx * 2.0], { outline: false });
    // Golden crest
    for (let i = 0; i < 5; i++) {
      const d = i - 2;
      const g = k.group(head, [0, hr * 0.78, -hr * 0.15], [-0.35 - Math.abs(d) * 0.18, 0, d * 0.28]);
      const L = 0.3 - Math.abs(d) * 0.05;
      k.blade(g, i % 2 ? EDGE : GOLD, L, 0.07, 0.03, [0, 0, 0]);
      k.glowSphere(g, EDGE, 0.026, [0, L, 0], 2.6);
    }
    // Flame wings: the feathers fan out across the wing plane, with tongues of flame leaping from the outer edge
    for (const sx of [-1, 1]) {
      const wg = k.group(c.body, [sx * 0.16, y + 0.1, -0.04]);
      const tr = -sx;
      c.wings.push({ g: wg, side: sx < 0 ? 1 : -1, base: 0.8, amp: 0.3, speed: 3.4 });
      const fl = k.group(wg, [0, 0, -0.05]);
      for (let j = 0; j < 5; j++) {
        const tg = k.group(fl, [0, 0.12, 0], [0, 0, tr * (-0.12 + j * 0.27)]);
        const L = 0.68 - Math.abs(j - 1) * 0.07;
        k.glow(tg, tongue(L, 0.1), j % 2 ? 0xff5a1a : 0xff7a22, 2.2, [0, 0, 0], [0, 0, 0], 0.9);
        k.glow(tg, tongue(L * 0.72, 0.05), 0xffe070, 2.8, [0, 0.02, 0.02]);
      }
      c.flickers.push({ g: fl, base: fl.scale.clone(), speed: 8 + sx, amt: 0.1 });
      for (let i = 0; i < 3; i++) {
        const fg = k.group(wg, [0, 0, -0.01 - i * 0.012], [0, 0, tr * i * 0.34]);
        const L = 0.44 - i * 0.07;
        k.blade(fg, EDGE, L * 1.07, 0.19, 0.035, [0, 0, -0.012]);
        k.blade(fg, RED, L, 0.15, 0.05, [0, 0, 0]);
      }
    }
    // Long tail feathers, with embers at the ends
    const tail = k.group(c.body, [0, y - 0.1, -0.16]);
    c.tails.push({ g: tail, phase: 0, amp: 0.1, axis: 'y' });
    for (let i = -2; i <= 2; i++) {
      const x = i * 0.09;
      const L = 1 - Math.abs(i) * 0.13;
      const pts: V3[] = [[0, 0, 0], [x * 0.5, -0.04 * L, -0.25 * L], [x, -0.18 * L, -0.5 * L], [x * 1.25, -0.4 * L, -0.66 * L], [x * 1.35, -0.56 * L, -0.62 * L]];
      const main = Math.abs(i) !== 1;
      tube(k, tail, main ? RED : EDGE, pts, 0.034, 0.018);
      const tip = pts[4];
      const eg = k.group(tail, tip, [PI - 0.5, 0, 0]);
      k.glow(eg, tongue(main ? 0.16 : 0.12, main ? 0.05 : 0.04, 0.6), 0xff5a1a, 2.4, [0, -0.02, 0], [0, 0, 0], 0.95);
      k.glowSphere(eg, 0xffe070, main ? 0.028 : 0.022, [0, 0.03, 0], 3);
      if (main) sparkle(k, c, tail, 0xff8a2a, 0.014, [tip[0] + 0.05, tip[1] + 0.02, tip[2] - 0.06], 0.05);
    }
    for (const sx of [-1, 1]) {
      const lg = k.group(c.body, [sx * 0.07, y - 0.2, 0.04], [0.6, 0, 0]);
      k.capsule(lg, GOLD, 0.022, 0.06, [0, -0.05, 0]);
      k.sphere(lg, GOLD, 0.028, [0, -0.1, 0.015], [1, 0.6, 1.3]);
    }
    halo(k, c, head, 0xffe08a, 0.3, [0, 0.06, -0.16], [0.15, 0, 0]);
    for (let i = 0; i < 4; i++) sparkle(k, c, c.body, i % 2 ? 0xffd060 : 0xff7a2a, 0.02, [Math.cos(i * 1.7) * 0.55, y + 0.1 + (i % 3) * 0.15, Math.sin(i * 1.7) * 0.4], 0.08);
  },

  // `dandelion`
  dandelion(k, c, s) {
    floater(c, 0.14);
    const GREEN = 0x7ac85a;
    const LIGHT = 0xb0e890;
    const LEAF = 0x5aa84a;
    const STEM = 0x8fd070;
    const br = [0.2, 0.21, 0.23][s - 1];
    const by = br * 1.3;
    // Body: a round green little body, a light belly, a tuft of small roots underneath
    k.sphere(c.body, GREEN, br, [0, by, 0], [1, 0.94, 0.96]);
    k.sphere(c.body, LIGHT, br * 0.72, [0, by - br * 0.22, br * 0.42], [1, 0.82, 0.6], [0, 0, 0], { outline: false });
    k.cone(c.body, LEAF, br * 0.32, br * 0.55, [0, by - br * 0.75, 0], [PI, 0, 0], 10);
    const head = k.group(c.body, [0, by, 0]);
    c.head = head;
    faceEyes(k, head, [br, br * 0.94, br * 0.96], { x: br * 0.4, y: br * 0.1, r: br * 0.3, iris: 0x3a8a3a });
    k.blush(head, br * 0.66, -br * 0.22, br * 0.66, br * 0.15);
    ball(k, head, 0x2a4a22, br * 0.07, [0, -br * 0.3, br * 0.94], [1.6, 0.5, 0.5], [0, 0, 0], { outline: false });
    // Leaf hands (serrated dandelion leaves) and a leaf skirt underneath
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(0.2, 0, -sx * 1.15);
      const g = k.group(c.body, [sx * br * 0.82, by - br * 0.1, 0.03], [base.x, base.y, base.z]);
      dandyLeaf(k, c, g, br * [1.3, 1.45, 1.6][s - 1], br * 0.55, [0, 0, 0], [0, 0, 0]);
      c.arms.push({ g, side: sx, base });
    }
    const nl = [4, 5, 6][s - 1];
    for (let i = 0; i < nl; i++) {
      const a = (i / nl) * PI * 2 + PI / nl;
      const g = k.group(c.body, [Math.sin(a) * br * 0.5, by - br * 0.55, Math.cos(a) * br * 0.5], [0, a, 0]);
      dandyLeaf(k, c, g, br * [1.0, 1.15, 1.3][s - 1], br * 0.5, [0, 0, 0], [PI / 2 + 0.35, 0, 0]);
    }
    const top = by + br * 0.92;
    const seeds = (n: number, R: number, y: number, spin: number) => {
      // Seeds circling and drifting up and down: a thin filament topped with a small parachute
      const orbit = k.group(c.body, [0, y, 0]);
      c.spinners.push({ g: orbit, speed: spin, axis: 'y' });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2;
        const sg = k.group(orbit, [Math.sin(a) * R, (i % 2) * 0.16 - 0.08, Math.cos(a) * R], [0.2, 0, 0.35]);
        ball(k, sg, 0xa88a58, 0.016, [0, 0, 0], [0.6, 1.5, 0.6], [0, 0, 0], { outline: false });
        k.cyl(sg, 0xffffff, 0.004, 0.004, 0.09, [0, 0.065, 0], [0, 0, 0], 4, { outline: false });
        for (let j = 0; j < 6; j++) {
          const b = (j / 6) * PI * 2;
          k.cyl(sg, 0xffffff, 0.003, 0.003, 0.05, [Math.cos(b) * 0.018, 0.125, Math.sin(b) * 0.018], [Math.sin(b) * 0.9, 0, -Math.cos(b) * 0.9], 4, { outline: false });
        }
        k.glowSphere(sg, 0xffffff, 0.035, [0, 0.13, 0], 1.2, [1, 0.45, 1], 0.5);
        c.bobbers.push({ g: sg, base: sg.position.y, amp: 0.05, speed: 1.5, phase: i });
      }
    };
    if (s === 1) {
      k.cyl(c.body, STEM, 0.016, 0.022, 0.14, [0, top + 0.06, 0], [0, 0, 0], 8);
      k.cone(c.body, LEAF, 0.05, 0.05, [0, top + 0.11, 0], [0, 0, 0], 8);
      puff(k, c, c.body, [0, top + 0.13 + 0.26, 0], 0.27, 70, 0);
    } else if (s === 2) {
      k.cyl(c.body, STEM, 0.018, 0.026, 0.18, [0, top + 0.08, 0], [0, 0, 0], 8);
      k.cone(c.body, LEAF, 0.055, 0.05, [0, top + 0.16, 0], [0, 0, 0], 8);
      puff(k, c, c.body, [0, top + 0.18 + 0.27, 0], 0.28, 70, 0);
      for (const sx of [-1, 1]) {
        const tip: V3 = [sx * 0.4, top + 0.2, -0.06];
        tube(k, c.body, STEM, [[0, top + 0.02, 0], [sx * 0.16, top + 0.08, -0.02], [sx * 0.32, top + 0.12, -0.05], tip], 0.018, 0.012);
        k.cone(c.body, LEAF, 0.04, 0.04, tip, [0, 0, -sx * 0.3], 8);
        puff(k, c, c.body, [tip[0] + sx * 0.05, tip[1] + 0.19, tip[2]], 0.2, 50, sx * 3);
      }
      seeds(3, 0.55, top + 0.15, 0.5);
    } else {
      // III: a crown made of a ring of fluff balls on the head, a yellow flower in the center, the seeds flying around the crown
      k.cyl(c.body, STEM, 0.02, 0.028, 0.16, [0, top + 0.07, 0], [0, 0, 0], 8);
      const crown = k.group(c.body, [0, top + 0.3, 0]);
      const CR = 0.34;
      k.torus(crown, STEM, CR, 0.018, [0, 0, 0], [PI / 2, 0, 0]);
      k.sphere(crown, LEAF, 0.1, [0, 0, 0], [1.4, 0.4, 1.4]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 4;
        rod(k, crown, STEM, [Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08], [Math.sin(a) * CR, 0, Math.cos(a) * CR], 0.011);
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        k.blade(crown, 0xffd23a, 0.1, 0.045, 0.02, [Math.sin(a) * 0.02, 0.03, Math.cos(a) * 0.02], [PI / 2 - 0.45, a, 0], { outline: false });
      }
      k.sphere(crown, 0xffb81a, 0.045, [0, 0.045, 0], [1, 0.6, 1]);
      k.cyl(crown, STEM, 0.012, 0.014, 0.16, [0, -0.08, 0], [0, 0, 0], 6);
      const ring = 7;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * PI * 2 + PI / 7;
        const p: V3 = [Math.sin(a) * CR, 0.2 + (i % 2) * 0.05, Math.cos(a) * CR];
        k.cyl(crown, STEM, 0.012, 0.014, p[1] - 0.06, [p[0], (p[1] - 0.06) / 2, p[2]], [0, 0, 0], 6);
        k.cone(crown, LEAF, 0.03, 0.03, [p[0], p[1] - 0.07, p[2]], [0, 0, 0], 6);
        puff(k, c, crown, p, 0.15, 40, i);
      }
      seeds(5, 0.66, top + 0.32, 0.7);
    }
    if (s >= 2) for (let i = 0; i < s; i++) sparkle(k, c, c.body, 0xf4fff0, 0.02, [Math.cos(i * 2.3) * 0.45, 0.4 + i * 0.2, Math.sin(i * 2.3) * 0.35], 0.08);
  },

  // `papercrane`
  papercrane(k, c, s) {
    floater(c, 0.22);
    const sz = [0.9, 1.1, 1.2][s - 1];
    const main = k.group(c.body, [0, 0.34 * sz, 0]);
    const head = crane(k, c, main, sz, { face: true, seal: s >= 2, ink: s === 1 ? 2 : 3 });
    c.head = head;
    if (s === 1) k.blush(head, 0.08 * sz, -0.03 * sz, 0.07 * sz, 0.022 * sz);
    if (s >= 2) for (let i = 0; i < 2; i++) sparkle(k, c, c.body, 0xfff4d0, 0.018, [Math.cos(i * 2.6) * 0.5, 0.3 + i * 0.3, Math.sin(i * 2.6) * 0.4], 0.06);
    if (s === 3) {
      // `papercrane`: three small pale paper cranes fly around the big crane, each bobbing up and down on its own
      const orbit = k.group(c.body, [0, 0.38 * sz, 0]);
      c.spinners.push({ g: orbit, speed: 0.7, axis: 'y' });
      const tints: [C, C][] = [[0xf8d0d0, 0x8a3a4a], [0xd0e2f8, 0x3a5a8a], [0xf8ecc4, 0x8a6a2a]];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2;
        const g = k.group(orbit, [Math.sin(a) * 0.82, (i - 1) * 0.14, Math.cos(a) * 0.82], [0, a + PI / 2, 0.12]);
        crane(k, c, g, 0.5, { col: tints[i][0], face: true, iris: tints[i][1], flap: 5 + i, ink: 1 });
        c.bobbers.push({ g, base: g.position.y, amp: 0.06, speed: 1.8, phase: i * 2 });
      }
      for (let i = 0; i < 3; i++) sparkle(k, c, c.body, 0xfff4d0, 0.02, [Math.cos(i * 2.1 + 1) * 0.55, 0.25 + i * 0.25, Math.sin(i * 2.1 + 1) * 0.45], 0.06);
    }
  },

  // `lyrebird`
  lyrebird(k, c, s) {
    c.archetype = 'bird';
    c.hover = 0.18;
    const BROWN = 0xb89a7a;
    const DARK = 0x9a7a5a;
    const CREAM = 0xf6ead0;
    const STR = 0xfff4c0;
    const SKY = 0x8fd4ff;
    const BEAK = 0xe8a860;
    const r = [0.3, 0.32, 0.33][s - 1];
    const hr = [0.27, 0.25, 0.25][s - 1];
    const y = 0.42;
    // Body: a round cream chest, a slightly darker back
    k.sphere(c.body, BROWN, 1, [0, y, 0], [r, r * 0.95, r * 1.1]);
    k.sphere(c.body, CREAM, 1, [0, y - r * 0.12, r * 0.36], [r * 0.74, r * 0.74, r * 0.66], [0, 0, 0], { outline: false });
    k.sphere(c.body, DARK, 1, [0, y + r * 0.3, -r * 0.3], [r * 0.8, r * 0.55, r * 0.7], [0, 0, 0], { outline: false });
    // Head: cream cheeks, big eyes, a small pointed beak
    const head = k.group(c.body, [0, y + r * 0.8, r * 0.3]);
    c.head = head;
    k.sphere(head, BROWN, hr);
    for (const sx of [-1, 1]) k.sphere(head, CREAM, hr * 0.42, [sx * hr * 0.5, -hr * 0.2, hr * 0.62], [1, 0.9, 0.6], [0, sx * 0.5, 0], { outline: false });
    faceEyes(k, head, hr, { x: hr * 0.4, y: hr * 0.14, r: hr * 0.3, iris: 0x5a3418 });
    if (s < 3) k.blush(head, hr * 0.68, -hr * 0.22, hr * 0.62, hr * 0.15);
    k.cone(head, BEAK, hr * 0.22, hr * 0.5, [0, -hr * 0.1, hr * 0.88], [PI / 2, 0, 0], 10);
    for (const sx of [-1, 1]) ball(k, head, DARK, hr * 0.14, [sx * hr * 0.42, hr * 0.5, hr * 0.7], [1.4, 0.35, 0.5], [0, 0, sx * 0.35], { outline: false });
    // Wings: three or four feathers fanned open; from II each has an extra sky-blue vane edge behind it
    const wl = [0.36, 0.46, 0.54][s - 1];
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * r * 0.82, y + 0.06, -0.02]);
      const n = s === 1 ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const L = wl * (1 - t * 0.3);
        const rot: V3 = [-0.15 - t * 0.5, 0, 0];
        const z = -t * 0.24 * 0.55;
        k.blade(g, i === 0 ? BROWN : DARK, L, 0.24, 0.05, [0, 0, z], rot);
        if (s >= 2) k.blade(g, SKY, L * 1.08, 0.24 * 1.22, 0.04, [0, 0, z - 0.004], rot);
      }
      c.wings.push({ g, side: sx < 0 ? 1 : -1, base: 1.15, amp: 0.45, speed: 7 });
    }
    // Feet
    for (const sx of [-1, 1]) {
      const f = k.group(c.body, [sx * 0.1, y - r * 0.95, 0.05]);
      k.capsule(f, BEAK, 0.03, 0.1, [0, 0, 0]);
      for (const dx of [-0.03, 0, 0.03]) k.capsule(f, BEAK, 0.013, 0.05, [dx, -0.07, 0.03], [PI / 2, 0, 0]);
    }
    // Harp tail feathers: two curved long feathers forming a lyre shape, with glowing strings stretched between them
    const L = [0.85, 1.1, 1.3][s - 1];
    const ly = k.group(c.body, [0, y - 0.04, -r * 0.85], [-0.22, 0, 0]);
    const lyIn = k.group(ly, [0, 0, 0]);
    c.tails.push({ g: lyIn, phase: 0, amp: 0.06, axis: 'z' });
    for (let i = -1; i <= 1; i++) k.blade(lyIn, DARK, 0.2 * L, 0.08 * L, 0.03, [i * 0.04 * L, 0, 0], [PI - 0.6, 0, i * 0.4]);
    for (const sx of [-1, 1]) {
      const arm: V3[] = [[sx * 0.03, 0, 0], [sx * 0.15, 0.12, -0.02], [sx * 0.21, 0.3, -0.03], [sx * 0.15, 0.5, -0.02], [sx * 0.16, 0.64, 0], [sx * 0.25, 0.72, 0.02], [sx * 0.3, 0.66, 0.02]].map(([x, yy, z]) => [x * L, yy * L, z * L] as V3);
      if (s >= 2) tube(k, lyIn, SKY, arm.map(([x, yy, z]) => [x + sx * 0.024 * L, yy, z - 0.012] as V3), 0.045 * L, 0.022 * L);
      tube(k, lyIn, DARK, arm, 0.042 * L, 0.016 * L);
      // Barbs: a row of small vanes along the outer edge
      for (let j = 0; j < 7; j++) {
        const t = 0.12 + j * 0.1;
        const p = curveAt(arm, t);
        k.blade(lyIn, j % 2 ? CREAM : BROWN, 0.09 * L * (1 - j * 0.06), 0.035 * L, 0.014, p, [0, 0, -sx * (1.15 + j * 0.06)], { outline: false });
      }
      k.torus(lyIn, DARK, 0.03 * L, 0.012 * L, arm[arm.length - 1], [0, 0, 0], PI * 1.5);
      k.glowSphere(lyIn, s >= 2 ? SKY : STR, 0.024 * L, arm[arm.length - 1], 2.6);
    }
    rod(k, lyIn, DARK, [-0.155 * L, 0.6 * L, -0.01 * L], [0.155 * L, 0.6 * L, -0.01 * L], 0.014 * L);
    const nStr = s + 2;
    for (let i = 0; i < nStr; i++) {
      const u = (i / (nStr - 1)) * 2 - 1;
      rod(k, lyIn, STR, [u * 0.03 * L, 0.05 * L, 0], [u * 0.11 * L, 0.6 * L, -0.01 * L], 0.006 * L, 1.7);
    }
    if (s === 3) {
      // Crest on the head: three thin feathers with glowing ends
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.45;
        const tip: V3 = [Math.sin(a) * 0.2, hr + 0.32 - Math.abs(i - 1) * 0.05, -0.1 - Math.abs(i - 1) * 0.03];
        tube(k, head, DARK, [[0, hr * 0.85, 0], [tip[0] * 0.5, hr + 0.1, -0.03], tip], 0.018, 0.008);
        k.blade(head, SKY, 0.14, 0.05, 0.015, [tip[0] * 0.8, tip[1] - 0.07, tip[2] + 0.01], [0.3, 0, -a], { outline: false });
        k.glowSphere(head, STR, 0.03, tip, 2.8);
      }
      for (let i = 0; i < 5; i++) note(k, c, c.body, i % 2 ? STR : SKY, [Math.cos(i * 1.3 + 0.4) * 0.62, 0.45 + (i % 3) * 0.28, Math.sin(i * 1.3 + 0.4) * 0.42], 0.2, i);
    } else if (s === 2) {
      for (let i = 0; i < 2; i++) note(k, c, c.body, STR, [Math.cos(i * 2.6 + 0.4) * 0.5, 0.6 + i * 0.25, Math.sin(i * 2.6 + 0.4) * 0.35], 0.12, i + 3);
    }
  },

  // `tornado` (single form)
  tornado(k, c) {
    floater(c, 0.12);
    const WIND = 0xbff0ff;
    const VOLT = 0xb08aff;
    const H = 1.3;
    const eyeY = 0.6;
    const fr = (t: number) => 0.07 + Math.pow(t, 1.35) * 0.55;
    const cx = (t: number) => Math.sin(t * 3.4) * 0.04;
    // Translucent funnel
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      prof.push(new THREE.Vector2(fr(t) * 0.88, t * H));
    }
    const fm = k.glow(c.body, new THREE.LatheGeometry(prof, 32), WIND, 0.95, [0, 0, 0], [0, 0, 0], 0.16);
    (fm.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    // Layer upon layer of rotating wind rings (the middle section leaves the eye of the storm open)
    const levels = 11;
    for (let i = 0; i < levels; i++) {
      const t = i / (levels - 1);
      const yy = 0.02 + t * H;
      if (Math.abs(yy - eyeY) < 0.17) continue;
      const R = fr(t);
      const arcLen = PI * (1.35 + rnd(i) * 0.4);
      const ring = new THREE.TorusGeometry(R, 0.016 + t * 0.03, 8, 40, arcLen);
      const m = k.mesh(c.body, ring, WIND, [cx(t), yy, 0], [PI / 2 + Math.sin(i * 1.3) * 0.08, Math.cos(i * 0.9) * 0.08, i * 1.7], { emissive: WIND, emissiveAmt: 0.25 });
      c.spinners.push({ g: m, speed: 2.8 - t * 1.4, axis: 'z' });
      const streak = new THREE.TorusGeometry(R * 1.06, 0.008 + t * 0.01, 6, 32, PI * 0.8);
      const m2 = k.glow(c.body, streak, 0xffffff, 1, [cx(t), yy + 0.03, 0], [PI / 2, 0, i * 2.9], 0.55);
      c.spinners.push({ g: m2, speed: 3.6 - t * 1.6, axis: 'z' });
    }
    // The eye core at the center
    const core = k.group(c.body, [cx(eyeY / H), eyeY, 0.04]);
    c.head = core;
    k.glowSphere(core, WIND, 0.25, [0, 0, 0], 1, [1, 1, 1], 0.3);
    k.glowSphere(core, 0xffffff, 0.17, [0, 0, 0], 1.3);
    const eyeRing = k.glow(core, new THREE.TorusGeometry(0.22, 0.012, 6, 40, PI * 1.6), WIND, 1.6, [0, 0, 0], [0, 0, 0], 0.9);
    c.spinners.push({ g: eyeRing, speed: -2, axis: 'z' });
    const eye = k.group(core, [0, 0, 0.12]);
    k.sphere(eye, 0x3aa8ec, 0.105, [0, 0, 0], [1, 1.14, 0.4], [0, 0, 0], { emissive: 0x3aa8ec, emissiveAmt: 0.35 });
    k.sphere(eye, 0x1c1640, 0.058, [0, -0.005, 0.022], [1, 1.14, 0.4], [0, 0, 0], { outline: false });
    k.glowSphere(eye, 0xffffff, 0.026, [-0.034, 0.042, 0.048], 2);
    k.glowSphere(eye, 0xffffff, 0.013, [0.032, -0.036, 0.048], 2);
    c.eyes.push(eye);
    // Purple lightning
    for (let i = 0; i < 6; i++) {
      const a = i * 2.3 + 0.4;
      const t = 0.2 + (i % 3) * 0.28;
      const R = fr(t) + 0.06;
      const y0 = t * H + 0.12;
      const g = k.group(c.body, [0, 0, 0]);
      bolt(k, g, VOLT, [Math.sin(a) * R, y0, Math.cos(a) * R], [Math.sin(a + 0.5) * (R + 0.1), y0 - 0.26, Math.cos(a + 0.5) * (R + 0.1)], 4, 0.04, 0.016, i * 13);
      c.flickers.push({ g, base: g.scale.clone(), speed: 16 + i, amt: 0.15 });
    }
    for (let i = 0; i < 5; i++) sparkle(k, c, c.body, i % 2 ? VOLT : WIND, 0.022, [Math.cos(i * 1.9) * 0.62, 0.3 + i * 0.2, Math.sin(i * 1.9) * 0.45], 0.08);
    // A letter carried along by the wind
    const orbit = k.group(c.body, [0, 0, 0]);
    c.spinners.push({ g: orbit, speed: 1.3, axis: 'y' });
    for (let i = 0; i < 2; i++) {
      const a = i * PI + 0.6;
      const t = 0.3 + i * 0.45;
      const g = k.group(orbit, [Math.sin(a) * (fr(t) + 0.2), t * H, Math.cos(a) * (fr(t) + 0.2)], [0.3, a + PI / 2, 0.4]);
      box(k, c, g, 0xfaf4e4, [0.15, 0.1, 0.01]);
      rod(k, g, 0xc8b89a, [-0.07, 0.045, 0.006], [0, 0.0, 0.006], 0.004, 0, false);
      rod(k, g, 0xc8b89a, [0.07, 0.045, 0.006], [0, 0.0, 0.006], 0.004, 0, false);
      k.sphere(g, SEAL, 0.02, [0, 0, 0.008], [1, 1, 0.4], [0, 0, 0], { outline: false });
    }
  },
};
