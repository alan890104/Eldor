// Second-batch spirit models (see docs/09-bestiary.md): Dawnlight Holy City (light) and Duskshade Realm (dark).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit, PartOpts } from '../creature.ts';
import { ears, floater, halo, PI, quad, sparkle, tailChain, type Builder, type C, type V3 } from '../parts.ts';

// ───────────────────────── Shared helpers ─────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Apply position / rotation / scale to a geometry (used before merging) */
function xf(geo: THREE.BufferGeometry, pos: V3 = [0, 0, 0], rot: V3 | THREE.Quaternion = [0, 0, 0], scale: V3 = [1, 1, 1]): THREE.BufferGeometry {
  const q = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, new THREE.Vector3(...scale)));
  return geo;
}

/** Capsule / cylinder between two points (leg segment, hanging cord, bone) */
function link(k: Kit, parent: THREE.Object3D, color: C, a: V3, b: V3, r: number, capsule = true, o: PartOpts = {}): THREE.Mesh {
  const A = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(A);
  const len = Math.max(0.002, d.length());
  const geo = capsule ? new THREE.CapsuleGeometry(r, len, 4, 10) : new THREE.CylinderGeometry(r, r, len, 8, 1);
  const m = k.mesh(parent, geo, color, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [0, 0, 0], o);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Tube along a curve; when tip < 1 the end tapers */
function tubeGeo(pts: V3[], r: number, tip = 1, closed = false, segs?: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  const n = segs ?? Math.max(8, pts.length * 6);
  const radial = 8;
  const geo = new THREE.TubeGeometry(curve, n, r, radial, closed);
  if (tip !== 1) {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / (radial + 1)) / n;
      const center = curve.getPointAt(Math.min(1, t));
      v.fromBufferAttribute(p, i).sub(center).multiplyScalar(1 - t * (1 - tip)).add(center);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
  }
  return geo;
}

/** Merge many same-colored parts into one mesh (saves mesh count) */
function merged(k: Kit, parent: THREE.Object3D, color: C, geos: THREE.BufferGeometry[], o: PartOpts = {}): THREE.Mesh | null {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const geo = mergeGeometries(list);
  if (!geo) return null;
  return k.mesh(parent, geo, color, [0, 0, 0], [0, 0, 0], o);
}

/** Merge many glowing parts of different colors into one mesh (vertex colors) */
class GlowBatch {
  geos: THREE.BufferGeometry[] = [];
  add(geo: THREE.BufferGeometry, color: C, pos: V3 = [0, 0, 0], rot: V3 | THREE.Quaternion = [0, 0, 0], scale: V3 = [1, 1, 1]): void {
    xf(geo, pos, rot, scale);
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    const col = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.geos.push(g);
  }
  build(k: Kit, parent: THREE.Object3D, intensity = 2.2): THREE.Mesh | null {
    if (!this.geos.length) return null;
    const geo = mergeGeometries(this.geos);
    if (!geo) return null;
    const m = k.glow(parent, geo, 0xffffff, intensity);
    (m.material as THREE.MeshBasicMaterial).vertexColors = true;
    return m;
  }
}

/** Stained glass: shrink each triangle of the geometry into a piece of glowing glass, with the lead came showing through the gaps */
function glassFacets(geo: THREE.BufferGeometry, palette: number[], shrink: number, lift: number, seed = 0): THREE.BufferGeometry {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = src.attributes.position as THREE.BufferAttribute;
  const pos: number[] = [];
  const col: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const cen = new THREE.Vector3();
  const n = new THREE.Vector3();
  const t = new THREE.Vector3();
  const cc = new THREE.Color();
  for (let i = 0; i + 2 < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    d.fromBufferAttribute(p, i + 2);
    cen.copy(a).add(b).add(d).divideScalar(3);
    n.copy(b).sub(a).cross(t.copy(d).sub(a));
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    cc.set(palette[Math.floor(hash(i / 3 + seed) * palette.length)]);
    for (const v of [a, b, d]) {
      t.copy(v).sub(cen).multiplyScalar(shrink).add(cen).addScaledVector(n, lift);
      pos.push(t.x, t.y, t.z);
      col.push(cc.r, cc.g, cc.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** A single big eye (the balance's one eye) */
function oneEye(k: Kit, c: Creature, parent: THREE.Object3D, pos: V3, r: number, iris: C): THREE.Group {
  const g = k.group(parent, pos);
  const sclera = new THREE.SphereGeometry(r, 20, 16);
  sclera.scale(1, 1.12, 0.45);
  k.mesh(g, sclera, 0xffffff);
  const ir = new THREE.SphereGeometry(r * 0.72, 18, 14);
  ir.scale(1, 1.12, 0.42);
  k.mesh(g, ir, iris, [0, -r * 0.05, r * 0.2], [0, 0, 0], { outline: false });
  const pu = new THREE.SphereGeometry(r * 0.4, 14, 12);
  pu.scale(1, 1.12, 0.4);
  k.mesh(g, pu, 0x14101c, [0, -r * 0.05, r * 0.3], [0, 0, 0], { outline: false });
  k.glowSphere(g, 0xffffff, r * 0.24, [-r * 0.3, r * 0.34, r * 0.42], 1.6);
  k.glowSphere(g, 0xffffff, r * 0.11, [r * 0.28, -r * 0.3, r * 0.42], 1.4);
  c.eyes.push(g);
  return g;
}

/** Feathered wing: several blades arranged in a fan; if edge is given, each feather gets a rim of that color, and if tipCol is given the feather ends change color */
function featherWing(
  k: Kit,
  c: Creature,
  parent: THREE.Object3D,
  side: number,
  o: { len: number; wid: number; pos: V3; n?: number; col: C; edge?: C; tipCol?: C; base?: number; amp?: number; speed?: number; fan?: number },
): THREE.Group {
  const g = k.group(parent, [o.pos[0] * side, o.pos[1], o.pos[2]]);
  const n = o.n ?? 3;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const L = o.len * (1 - t * 0.32);
    const rot: V3 = [-0.12 - t * (o.fan ?? 0.5), 0, 0];
    const z = -t * o.wid * 0.5;
    if (o.edge) {
      k.blade(g, o.col, L, o.wid, 0.06, [0, 0, z], rot);
      k.blade(g, o.edge, L * 1.1, o.wid * 1.28, 0.042, [0, 0, z], rot);
    } else if (o.tipCol) {
      k.blade(g, o.col, L, o.wid, 0.05, [0, 0, z], rot);
      const tg = k.group(g, [0, 0, z], rot);
      k.blade(tg, o.tipCol, L * 0.36, o.wid * 0.78, 0.066, [0, L * 0.62, 0], [0, 0, 0], { outline: false });
    } else {
      k.blade(g, o.col, L, o.wid, 0.05, [0, 0, z], rot);
    }
  }
  c.wings.push({ g, side: side < 0 ? 1 : -1, base: o.base ?? 1.15, amp: o.amp ?? 0.4, speed: o.speed ?? 6 });
  return g;
}

/** A point on an ellipsoid surface and its outward direction (for sticking markings on) */
function onEllipsoid(center: V3, radii: V3, x: number, y: number, lift = 0): { pos: V3; q: THREE.Quaternion } {
  const nx = (x - center[0]) / radii[0];
  const ny = (y - center[1]) / radii[1];
  const nz = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));
  const z = center[2] + nz * radii[2];
  const n = new THREE.Vector3(nx / radii[0], ny / radii[1], nz / radii[2]).normalize();
  const pos: V3 = [x + n.x * lift, y + n.y * lift, z + n.z * lift];
  return { pos, q: new THREE.Quaternion().setFromUnitVectors(Z, n) };
}

/** Flat marking stuck on an ellipsoid */
function decal(k: Kit, parent: THREE.Object3D, color: C, r: number, scale: V3, center: V3, radii: V3, x: number, y: number, roll = 0, lift = 0.004): THREE.Mesh {
  const { pos, q } = onEllipsoid(center, radii, x, y, lift);
  const m = ball(k, parent, color, r, pos, scale, [0, 0, 0], { outline: false });
  m.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll));
  return m;
}

/** A small candle and its flame on a candlestick */
function candle(k: Kit, parent: THREE.Object3D, pos: V3, size: number): void {
  const g = k.group(parent, pos);
  k.cyl(g, 0xffd060, size * 0.62, size * 0.5, size * 0.12, [0, size * 0.06, 0], [0, 0, 0], 16);
  k.cyl(g, 0xfff4dc, size * 0.3, size * 0.32, size * 0.9, [0, size * 0.55, 0], [0, 0, 0], 12);
  k.sphere(g, 0xfff4dc, size * 0.14, [size * 0.22, size * 0.75, size * 0.12], [1, 1.6, 1], [0, 0, 0], { outline: false });
  k.cyl(g, 0x3a2a24, size * 0.035, size * 0.035, size * 0.2, [0, size * 1.05, 0], [0, 0, 0], 5, { outline: false });
  k.flame(g, 0xffb03a, 0xfff2b0, size * 0.55, [0, size * 1.18, 0]);
  k.glowSphere(g, 0xffe07a, size * 0.5, [0, size * 1.35, 0], 1.2, [1, 1, 1], 0.35);
}

/** Tube along a curve with radius varying with t (fox tail, mastiff's neck fur); takes only the stretch of the curve from t0 to t1, which makes recoloring easy */
function taperGeo(pts: V3[], rFn: (t: number) => number, o: { segs?: number; radial?: number; t0?: number; t1?: number } = {}): THREE.BufferGeometry {
  const full = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const t0 = o.t0 ?? 0;
  const t1 = o.t1 ?? 1;
  const segs = o.segs ?? 24;
  const radial = o.radial ?? 10;
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

/** The point at t on the curve (for placing the tail-end flame and white fur) */
function curveAt(pts: V3[], t: number): V3 {
  const p = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))).getPointAt(t);
  return [p.x, p.y, p.z];
}

/** Fluffy fox tail: thickest in the middle, a tuft of white fur at the end; returns the group at the tail root (registered in c.tails) */
function foxTail(k: Kit, c: Creature, parent: THREE.Object3D, col: C, tipCol: C, L: number, o: { yaw?: number; lift?: number; thick?: number; phase?: number } = {}): { g: THREE.Group; tip: V3 } {
  // The outer group handles the fan-out angle; only the inner one is registered as the tail (the idle animation directly overwrites the rotation of a registered group)
  const base = k.group(parent, [0, 0, 0], [0, o.yaw ?? 0, 0]);
  const g = k.group(base, [0, 0, 0]);
  const lift = o.lift ?? 1;
  const th = o.thick ?? 1;
  const pts: V3[] = [
    [0, 0, 0],
    [0, 0.05 * lift, -0.3],
    [0, 0.24 * lift, -0.6],
    [0, 0.54 * lift, -0.8],
    [0, 0.84 * lift, -0.84],
  ].map(([x, y, z]) => [x * L, y * L, z * L] as V3);
  const rFn = (t: number) => L * th * (0.07 + 0.2 * Math.pow(Math.sin(PI * Math.min(1, t * 1.06)), 0.8));
  k.mesh(g, taperGeo(pts, rFn, { t0: 0, t1: 0.72 }), col);
  k.mesh(g, taperGeo(pts, rFn, { t0: 0.68, t1: 1, segs: 12 }), tipCol);
  c.tails.push({ g, phase: o.phase ?? 0, amp: 0.14, axis: 'y' });
  return { g, tip: curveAt(pts, 0.97) };
}

/** Low-segment small sphere (small decorations such as rivets, spots, noses), saving about 83% of the triangles compared with k.sphere */
function ball(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 12, 8);
  g.scale(...scale);
  return k.mesh(parent, g, col, pos, rot, o);
}

// ───────────────────────── Species ─────────────────────────

export const SPECIES_LIGHT_DARK: Record<string, Builder> = {
  // `candledove`
  candledove(k, c, s) {
    const white = 0xfbf8f0;
    const cream = 0xfff3dc;
    const shade = 0xe8dccc;
    const gold = 0xffd060;
    const goldD = 0xd8a030;
    const beak = 0xf5a58c;
    c.archetype = 'bird';
    c.hover = 0.18;
    const r = [0.34, 0.34, 0.37][s - 1];
    const hr = [0.29, 0.26, 0.26][s - 1];
    const y = 0.44;
    // Body: a round chest, a slightly pointed tail root, a cream chest
    k.sphere(c.body, white, 1, [0, y, 0], [r, r * 0.96, r * 1.12]);
    k.sphere(c.body, white, 1, [0, y + 0.02, -r * 0.55], [r * 0.7, r * 0.6, r * 0.8]);
    k.sphere(c.body, cream, 1, [0, y - r * 0.2, r * 0.32], [r * 0.76, r * 0.72, r * 0.74], [0, 0, 0], { outline: false });
    // Neck ring: a faint shadow-colored ring on the dove's neck
    k.torus(c.body, shade, r * 0.42, r * 0.09, [0, y + r * 0.62, r * 0.28], [PI / 2 + 0.3, 0, 0], PI * 2, { outline: false });
    const head = k.group(c.body, [0, y + r * 0.82, r * 0.32]);
    c.head = head;
    k.sphere(head, white, hr);
    k.cone(head, beak, hr * 0.24, hr * 0.5, [0, -hr * 0.14, hr * 0.86], [PI / 2, 0, 0], 12);
    k.sphere(head, 0xffffff, hr * 0.15, [0, -hr * 0.02, hr * 0.9], [1.3, 0.7, 0.8], [0, 0, 0], { outline: false });
    k.eyes(head, { x: hr * 0.4, y: hr * 0.14, z: hr * 0.76, r: hr * 0.3, iris: s === 3 ? 0xd88a20 : 0x5a3a2a });
    k.blush(head, hr * 0.66, -hr * 0.14, hr * 0.7, hr * 0.17);
    // Wings: layered feathers, a ring of candlelight along the edge
    const wl = [0.44, 0.58, 0.72][s - 1];
    for (const sx of [-1, 1]) {
      const w = featherWing(k, c, c.body, sx, {
        len: wl,
        wid: 0.27,
        pos: [r * 0.82, y + 0.06, -0.02],
        n: s === 1 ? 3 : 4,
        col: white,
        edge: s === 3 ? gold : undefined,
        base: 1.1,
        amp: 0.4,
        speed: 6,
      });
      // Candlelight on the wing edge: a soft warm glow behind, a point of light at the wing tip
      const gl = new THREE.SphereGeometry(0.5, 16, 10);
      gl.scale(0.27 * 1.35, wl * 1.14, 0.02);
      gl.translate(0, wl * 0.5, 0);
      k.glow(w, gl, s === 3 ? 0xffe9a0 : 0xffc860, s === 3 ? 1.0 : 1.3, [0, -0.02, -0.04], [-0.12, 0, 0], s === 3 ? 0.35 : 0.45);
      k.glowSphere(w, 0xffe08a, 0.032, [0, wl * 0.98, 0.03], 2.6);
    }
    // Tail feathers: fan-shaped, gold-edged at III
    const nt = s === 1 ? 3 : 5;
    for (let i = 0; i < nt; i++) {
      const a = (i / (nt - 1) - 0.5) * (s === 1 ? 0.6 : 1.1);
      const L = [0.3, 0.38, 0.46][s - 1];
      if (s === 3) k.blade(c.body, gold, L * 1.1, 0.16, 0.035, [a * 0.12, y - 0.04, -r * 0.85], [-2.1, a, 0]);
      k.blade(c.body, white, L, 0.13, 0.045, [a * 0.12, y - 0.04, -r * 0.85], [-2.1, a, 0]);
    }
    // Feet: pink, three small toes
    for (const sx of [-1, 1]) {
      const f = k.group(c.body, [sx * 0.1, y - r * 0.95, 0.05]);
      k.capsule(f, beak, 0.032, 0.1, [0, 0, 0]);
      for (const dx of [-0.03, 0, 0.03]) k.capsule(f, beak, 0.014, 0.05, [dx, -0.075, 0.03], [PI / 2, 0, 0]);
    }
    // Candle flame on the head: a gold candlestick, a cream candle, a flame
    const candleAt = (parent: THREE.Object3D, pos: V3, size: number) => {
      const g = k.group(parent, pos);
      k.lathe(g, gold, [[0.001, 0], [size * 0.55, 0], [size * 0.62, size * 0.1], [size * 0.42, size * 0.16], [size * 0.3, size * 0.18], [0.001, size * 0.2]]);
      k.cyl(g, 0xfff4dc, size * 0.3, size * 0.32, size * 0.9, [0, size * 0.62, 0], [0, 0, 0], 12);
      k.sphere(g, 0xfff4dc, size * 0.14, [size * 0.22, size * 0.8, size * 0.12], [1, 1.6, 1], [0, 0, 0], { outline: false });
      k.cyl(g, 0x3a2a24, size * 0.035, size * 0.035, size * 0.2, [0, size * 1.12, 0], [0, 0, 0], 5, { outline: false });
      k.flame(g, 0xffb03a, 0xfff2b0, size * 0.62, [0, size * 1.22, 0]);
      k.glowSphere(g, 0xffe07a, size * 0.55, [0, size * 1.45, 0], 1.2, [1, 1, 1], 0.35);
      return g;
    };
    if (s < 3) candleAt(head, [0, hr * 0.9, -hr * 0.08], [0.19, 0.21][s - 1]);
    if (s === 2) {
      halo(k, c, head, gold, hr * 1.15, [0, hr * 0.45, -hr * 0.6], [-0.2, 0, 0]);
      for (let i = 0; i < 3; i++) sparkle(k, c, c.body, 0xfff0a0, 0.025, [Math.cos(i * 2.2) * 0.45, 0.7 + (i % 2) * 0.2, Math.sin(i * 2.2) * 0.3], 0.06);
    }
    if (s === 3) {
      // The halo turns into a crown: a gold crown ring, pointed spikes set with gems, a big candle flame in the center, and a ring of rays behind the crown turning slowly
      const crown = k.group(head, [0, hr * 0.78, -hr * 0.06], [-0.1, 0, 0]);
      const CR = hr * 0.7;
      k.torus(crown, gold, CR, 0.032, [0, 0, 0], [PI / 2, 0, 0]);
      k.torus(crown, goldD, CR, 0.012, [0, 0.04, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      const np = 6;
      for (let i = 0; i < np; i++) {
        const a = (i / np) * PI * 2 + PI / 6;
        const px = Math.cos(a) * CR;
        const pz = Math.sin(a) * CR;
        k.cone(crown, gold, 0.035, i % 2 ? 0.1 : 0.14, [px, 0.02, pz], [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25], 6);
        k.glowSphere(crown, i % 2 ? 0x8ad0ff : 0xfff0a0, 0.024, [px * 1.02, 0.07, pz * 1.02], 2.4);
      }
      const rays = k.group(crown, [0, 0.02, -0.02]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        const geo = new THREE.ConeGeometry(0.03, 0.2, 6);
        geo.translate(0, 0.1, 0);
        k.glow(rays, geo, 0xffe9a0, 1.8, [Math.cos(a) * CR * 1.05, 0.02, Math.sin(a) * CR * 1.05], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], 0.9);
      }
      c.spinners.push({ g: rays, speed: 0.6, axis: 'y' });
      candleAt(crown, [0, -0.02, 0], 0.2);
      // Gold badge on the chest
      k.sphere(c.body, gold, 0.065, [0, y + r * 0.3, r * 0.98], [1, 1.1, 0.45]);
      k.glowSphere(c.body, 0xfff6c0, 0.035, [0, y + r * 0.3, r * 1.05], 2.6);
      for (let i = 0; i < 4; i++) sparkle(k, c, c.body, 0xfff0a0, 0.025, [Math.cos(i * 1.7) * 0.55, 0.55 + (i % 2) * 0.3, Math.sin(i * 1.7) * 0.35], 0.07);
    }
  },

  // `prismsnail`
  prismsnail(k, c, s) {
    c.archetype = 'crawl';
    const col = 0xb8b0d0;
    const belly = 0xd6d0ea;
    const lead = 0x3e3858;
    const gold = 0xf2d27a;
    const glass = [0xff5a6a, 0x4a8aff, 0xffd84a, 0x4ade7a, 0x4a8aff, 0xff5a6a, 0xb07aff];
    const L = [0.42, 0.48, 0.54][s - 1];
    // Foot
    k.sphere(c.body, col, 1, [0, 0.1, 0], [0.2, 0.11, L]);
    k.sphere(c.body, belly, 1, [0, 0.06, 0.02], [0.215, 0.06, L * 0.97], [0, 0, 0], { outline: false });
    // A wavy skirt edge around the edge of the foot
    const skirt: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2;
      skirt.push(xf(new THREE.SphereGeometry(0.05, 10, 8), [Math.sin(a) * 0.2, 0.05, Math.cos(a) * L * 0.98], [0, 0, 0], [1, 0.55, 1.2]));
    }
    merged(k, c.body, belly, skirt, { outline: false });
    const tail = k.group(c.body, [0, 0.07, -L * 0.8]);
    k.sphere(tail, col, 0.08, [0, 0, -0.08], [1, 0.7, 1.6]);
    c.tails.push({ g: tail, phase: 0, amp: 0.15, axis: 'y' });
    // Neck and head
    const nz = L * 0.66;
    k.capsule(c.body, col, 0.12, 0.14, [0, 0.2, nz], [0.35, 0, 0]);
    const hr = [0.2, 0.19, 0.18][s - 1];
    const head = k.group(c.body, [0, 0.36 + hr * 0.3, nz + 0.07]);
    c.head = head;
    k.sphere(head, col, hr);
    k.eyes(head, { x: hr * 0.42, y: hr * 0.04, z: hr * 0.76, r: hr * 0.36, iris: 0x6a4ad8 });
    k.blush(head, hr * 0.68, -hr * 0.3, hr * 0.66, hr * 0.2);
    ball(k, head, 0x5a4a78, hr * 0.07, [0, -hr * 0.36, hr * 0.94], [1.5, 0.5, 0.5], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) {
      const g = k.group(head, [sx * hr * 0.42, hr * 0.78, -hr * 0.05], [-0.15, 0, -sx * 0.38]);
      k.cyl(g, col, 0.016, 0.026, 0.2, [0, 0.1, 0], [0, 0, 0], 8);
      k.glowSphere(g, [0xffe890, 0xffd0e8, 0xfff0b0][s - 1], 0.036, [0, 0.215, 0], 1.7);
      c.ears.push({ g, phase: sx * 1.3 });
    }
    // Shell
    const R = [0.3, 0.34, 0.4][s - 1];
    const shell = k.group(c.body, [0, 0.14 + R * 0.9, -L * 0.2], [-0.12, 0, 0]);
    if (s < 3) {
      const geo = new THREE.IcosahedronGeometry(R, s === 1 ? 1 : 2);
      geo.scale(0.72, 1, 1);
      k.mesh(shell, geo, lead);
      const fac = k.glow(shell, glassFacets(geo, glass, s === 1 ? 0.8 : 0.78, 0.004, s), 0xffffff, 1.25);
      (fac.material as THREE.MeshBasicMaterial).vertexColors = true;
      // Spiral markings (both sides)
      const turns = 2.1;
      for (const sx of [-1, 1]) {
        const pts: V3[] = [];
        for (let i = 0; i <= 28; i++) {
          const t = 1 - i / 28;
          const a = t * turns * PI * 2 + 0.6;
          const rad = R * (0.08 + t * 0.86);
          const xs = 0.72 * R * Math.sqrt(Math.max(0, 1 - (rad / R) ** 2)) + 0.012;
          pts.push([sx * xs, rad * Math.sin(a), rad * Math.cos(a)]);
        }
        k.mesh(shell, tubeGeo(pts, s === 1 ? 0.016 : 0.022, 0.35), gold);
        k.glowSphere(shell, 0xfff4c0, R * 0.08, [sx * 0.72 * R * 1.0, 0, 0], 2.4);
      }
      if (s === 2) {
        // Window frame: an outer gold frame and radial mullions
        k.torus(shell, gold, R * 0.99, 0.022, [0, 0, 0], [0, PI / 2, 0]);
        const parts: THREE.BufferGeometry[] = [];
        for (const sx of [-1, 1]) {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * PI * 2;
            const pts: V3[] = [];
            for (let j = 0; j <= 6; j++) {
              const rad = R * (0.12 + (j / 6) * 0.86);
              const xs = 0.72 * R * Math.sqrt(Math.max(0, 1 - (rad / R) ** 2)) + 0.01;
              pts.push([sx * xs, rad * Math.sin(a), rad * Math.cos(a)]);
            }
            parts.push(tubeGeo(pts, 0.012, 1, false, 12));
          }
        }
        merged(k, shell, gold, parts);
        for (let i = 0; i < 2; i++) sparkle(k, c, c.body, 0xfff4c0, 0.022, [Math.cos(i * 2.6) * 0.4, 0.75 + i * 0.1, -0.1 + Math.sin(i * 2.6) * 0.3], 0.05);
      }
    } else {
      // Rose window: a disc-shaped shell, each face a glowing rose window
      const w = R * 0.4;
      k.lathe(shell, lead, [[0.001, -w], [R * 0.88, -w], [R * 0.99, -w * 0.7], [R * 1.03, 0], [R * 0.99, w * 0.7], [R * 0.88, w], [0.001, w]], [0, 0, 0], [0, 0, PI / 2]);
      const trace: THREE.BufferGeometry[] = [];
      const panes = new GlowBatch();
      const ring = [0xffd84a, 0x4ade7a, 0x4a8aff, 0xff5a6a, 0xb07aff, 0x4a8aff];
      for (const sx of [-1, 1]) {
        const fx = sx * (w + 0.004);
        for (const rr of [0.25, 0.56, 0.93]) trace.push(xf(new THREE.TorusGeometry(R * rr, 0.016, 8, 40), [sx * (w + 0.012), 0, 0], [0, PI / 2, 0]));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI * 2;
          const mid = R * 0.59;
          trace.push(xf(new THREE.CylinderGeometry(0.012, 0.012, R * 0.68, 6), [sx * (w + 0.012), Math.cos(a) * mid, Math.sin(a) * mid], [a, 0, 0]));
          const b = a + PI / 8;
          panes.add(new THREE.SphereGeometry(1, 14, 10), i % 2 ? 0xff5a6a : 0x4a8aff, [fx, Math.cos(b) * R * 0.405, Math.sin(b) * R * 0.405], [b, 0, 0], [0.01, R * 0.13, R * 0.1]);
        }
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * PI * 2 + PI / 16;
          panes.add(new THREE.SphereGeometry(1, 12, 8), ring[i % ring.length], [fx, Math.cos(a) * R * 0.745, Math.sin(a) * R * 0.745], [0, 0, 0], [0.01, R * 0.1, R * 0.1]);
        }
        panes.add(new THREE.SphereGeometry(1, 16, 12), 0xfff2c0, [fx, 0, 0], [0, 0, 0], [0.015, R * 0.2, R * 0.2]);
        const core = k.glowSphere(shell, 0xfff6d0, R * 0.11, [sx * (w + 0.03), 0, 0], 2.4, [0.4, 1, 1]);
        c.flickers.push({ g: core, base: core.scale.clone(), speed: 3, amt: 0.15 });
      }
      // Edge: two gold frames sandwiching a ring of gems
      for (const sx of [-1, 1]) trace.push(xf(new THREE.TorusGeometry(R * 0.97, 0.022, 8, 48), [sx * w * 0.72, 0, 0], [0, PI / 2, 0]));
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * PI * 2;
        panes.add(new THREE.SphereGeometry(1, 10, 8), ring[i % ring.length], [0, Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02], [0, 0, 0], [0.05, 0.035, 0.035]);
      }
      merged(k, shell, gold, trace);
      const pm = panes.build(k, shell, 1.5);
      if (pm) pm.renderOrder = 1;
      for (let i = 0; i < 4; i++) sparkle(k, c, c.body, 0xfff4c0, 0.025, [Math.cos(i * 1.6) * 0.5, 0.7 + (i % 2) * 0.25, -0.1 + Math.sin(i * 1.6) * 0.35], 0.06);
      // A ring of small gold crowns on the head
      k.torus(head, gold, hr * 0.55, 0.018, [0, hr * 0.78, 0], [PI / 2 - 0.2, 0, 0]);
    }
  },

  // `balancescale`
  balancescale(k, c, s) {
    floater(c, 0.3);
    const gold = 0xe8c060;
    const deep = 0xb8903a;
    const pale = 0xfff2c8;
    const hr = [0.24, 0.22, 0.2][s - 1];
    const headY = [0.68, 0.8, 1.0][s - 1];
    const beamY = s === 3 ? headY - hr - 0.14 : headY - 0.02;
    const beamW = [0.4, 0.48, 0.52][s - 1];
    const panY = [0.24, 0.26, 0.22][s - 1];
    const panR = [0.13, 0.15, 0.16][s - 1];
    /** Small chain: a string of interlocking small rings */
    const chain = (parent: THREE.Object3D, a: V3, b: V3, n: number) => {
      const A = new THREE.Vector3(...a);
      const d = new THREE.Vector3(...b).sub(A);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
      const links: THREE.BufferGeometry[] = [];
      const L = d.length();
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const g = new THREE.TorusGeometry(L / n * 0.55, 0.006, 5, 10);
        g.rotateX(PI / 2);
        if (i % 2) g.rotateY(PI / 2);
        g.translate(0, t * L, 0);
        g.applyQuaternion(q);
        g.translate(A.x, A.y, A.z);
        links.push(g);
      }
      merged(k, parent, deep, links, { outline: false });
    };
    if (s < 3) {
      // Base and pillar: with a foot line, pillar rings and a capital
      const baseH = s === 1 ? 0.14 : 0.18;
      k.lathe(c.body, gold, [[0.001, 0], [0.13, 0.012], [0.18, baseH * 0.35], [0.12, baseH * 0.7], [0.06, baseH * 0.9], [0.001, baseH]]);
      k.torus(c.body, deep, 0.155, 0.018, [0, baseH * 0.38, 0], [PI / 2, 0, 0]);
      const colH = headY - baseH;
      k.cyl(c.body, gold, 0.04, 0.052, colH, [0, baseH + colH / 2, 0]);
      for (const f of [0.3, 0.5]) k.torus(c.body, deep, 0.052, 0.012, [0, baseH + colH * f, 0], [PI / 2, 0, 0]);
      k.lathe(c.body, gold, [[0.04, 0], [0.09, 0.03], [0.1, 0.06], [0.06, 0.08], [0.001, 0.085]], [0, beamY - 0.1, 0]);
      k.glowSphere(c.body, 0xfff0a0, 0.09, [0, -0.02, 0], 2, [1, 0.35, 1], 0.8);
    } else {
      // The pillar turns into a sword: the tip pointing down, the crossguard is the beam of the scale; a glowing fuller down the middle of the blade
      const top = beamY - 0.02;
      const tip = 0.0;
      const bw = 0.1;
      const shape = new THREE.Shape();
      shape.moveTo(-bw, top);
      shape.lineTo(bw, top);
      shape.lineTo(bw * 0.85, tip + 0.18);
      shape.lineTo(0, tip);
      shape.lineTo(-bw * 0.85, tip + 0.18);
      shape.closePath();
      const bg = new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2 });
      bg.translate(0, 0, -0.012);
      k.mesh(c.body, bg, 0xeef2fa, [0, 0, 0], [0, 0, 0], { outline: false });
      const fuller = new THREE.BoxGeometry(0.024, top - tip - 0.22, 0.06);
      k.glow(c.body, fuller, 0xffe27a, 2.4, [0, (top + tip + 0.22) / 2, 0]);
      for (let i = 0; i < 3; i++) k.glowSphere(c.body, 0x8ad0ff, 0.016, [0, top - 0.12 - i * 0.18, 0.035], 2.6);
      // Sword hilt: cord-wrapped grip, two guard rings, the pommel is the head
      k.cyl(c.body, 0x7a3a2a, 0.04, 0.04, headY - hr - beamY + 0.02, [0, (headY - hr + beamY) / 2, 0], [0, 0, 0], 12);
      for (let i = 0; i < 3; i++) k.torus(c.body, deep, 0.042, 0.01, [0, beamY + 0.05 + i * 0.045, 0], [PI / 2, 0, 0]);
      k.torus(c.body, gold, 0.055, 0.016, [0, headY - hr - 0.01, 0], [PI / 2, 0, 0]);
      k.glowSphere(c.body, 0xfff0a0, 0.05, [0, tip, 0], 2.6);
    }
    // Head (the one eye at the top of the pillar): a gold ball, a pale face, brow ridge, a gem on the brow, a small point on top
    const head = k.group(c.body, [0, headY, 0]);
    c.head = head;
    k.sphere(head, gold, hr);
    k.sphere(head, pale, hr * 0.74, [0, -hr * 0.05, hr * 0.42], [1, 1, 0.6], [0, 0, 0], { outline: false });
    oneEye(k, c, head, [0, hr * 0.02, hr * 0.8], hr * 0.56, s === 3 ? 0x3a7ae8 : 0x2f6fd8);
    k.sphere(head, deep, hr * 0.5, [0, hr * 0.55, hr * 0.62], [1.3, 0.28, 0.5], [0.5, 0, 0], { outline: false });
    k.blush(head, hr * 0.72, -hr * 0.42, hr * 0.62, hr * 0.14);
    k.lathe(head, gold, [[0.001, 0], [hr * 0.3, 0], [hr * 0.22, hr * 0.25], [hr * 0.1, hr * 0.45], [0.001, hr * 0.6]], [0, hr * 0.9, 0]);
    k.glowSphere(head, 0x8fd0ff, hr * 0.15, [0, hr * 1.5, 0], 2.6);
    for (const sx of [-1, 1]) k.sphere(head, deep, hr * 0.12, [sx * hr * 0.9, hr * 0.1, 0], [0.6, 1, 1]);
    // Scale beam (sways gently): both ends curled into volutes, a sapphire set in the central pivot
    const beam = k.group(c.body, [0, beamY, 0]);
    if (s < 3) c.tails.push({ g: beam, phase: 0, amp: 0.07, axis: 'z' });
    k.cyl(beam, s === 3 ? gold : deep, 0.028, 0.028, beamW * 2, [0, 0, 0], [0, 0, PI / 2], 10);
    k.sphere(beam, gold, 0.055, [0, 0, 0]);
    k.glowSphere(beam, 0x4a8aff, 0.03, [0, 0, 0.045], 2.6);
    for (const sx of [-1, 1]) {
      k.torus(beam, gold, 0.045, 0.014, [sx * (beamW + 0.02), 0.03, 0], [0, 0, 0], PI * 1.5);
      k.sphere(beam, gold, 0.04, [sx * beamW, 0, 0]);
      const hang = k.group(beam, [sx * beamW, 0, 0]);
      if (s < 3) c.tails.push({ g: hang, phase: PI, amp: 0.07, axis: 'z' });
      const drop = beamY - panY;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2 + PI / 2;
        chain(hang, [0, -0.02, 0], [Math.cos(a) * panR * 0.85, -drop + 0.01, Math.sin(a) * panR * 0.85], 7);
      }
      k.lathe(hang, gold, [[0.001, -drop - 0.05], [panR * 0.6, -drop - 0.05], [panR, -drop], [panR * 0.92, -drop + 0.014], [0.001, -drop - 0.006]]);
      k.torus(hang, deep, panR * 0.98, 0.008, [0, -drop + 0.01, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      // A glowing white feather in the left pan, a dark weight in the right pan: light weighs the same as dark
      if (sx < 0) {
        const f = k.group(hang, [0, -drop + 0.02, 0], [0, 0.6, 0.35]);
        k.blade(f, 0xffffff, panR * 1.1, panR * 0.5, 0.02, [0, 0, 0], [0, 0, 0], { emissive: 0xfff4c0, emissiveAmt: 0.35 });
        k.glowSphere(f, 0xfff2b0, panR * 0.3, [0, panR * 0.5, 0], 1.4, [1, 1, 1], 0.5);
        c.flickers.push({ g: f, base: f.scale.clone(), speed: 2.2, amt: 0.08 });
      } else {
        k.sphere(hang, 0x3a2a5a, panR * 0.4, [0, -drop + panR * 0.34, 0]);
        k.torus(hang, deep, panR * 0.2, 0.008, [0, -drop + panR * 0.74, 0], [0, 0, 0]);
        k.glowSphere(hang, 0xb07aff, panR * 0.16, [panR * 0.1, -drop + panR * 0.45, panR * 0.28], 2.4);
      }
    }
    // Small white wings (from II), gold-edged at III
    if (s >= 2) {
      const wy = s === 3 ? headY - hr * 0.2 : headY - hr * 0.5;
      for (const sx of [-1, 1]) featherWing(k, c, c.body, sx, { len: s === 3 ? 0.44 : 0.3, wid: 0.14, pos: [hr * 0.7, wy, -0.05], n: 3, col: 0xffffff, edge: s === 3 ? gold : undefined, base: 0.9, amp: 0.3, speed: 5 });
    }
    if (s === 3) {
      halo(k, c, head, 0xfff0a0, hr * 1.2, [0, hr + 0.16, 0], [PI / 2 - 0.25, 0, 0]);
      for (let i = 0; i < 4; i++) sparkle(k, c, c.body, i % 2 ? 0x8ad0ff : 0xfff0a0, 0.025, [Math.cos(i * 1.7) * 0.55, 0.45 + i * 0.15, Math.sin(i * 1.7) * 0.35], 0.06);
    } else {
      for (let i = 0; i < s + 1; i++) sparkle(k, c, c.body, 0xfff0a0, 0.022, [Math.cos(i * 2.4) * 0.42, 0.5 + i * 0.15, Math.sin(i * 2.4) * 0.3], 0.05);
    }
  },

  // `griffin`
  griffin(k, c) {
    const col = 0xf4ecd8;
    const white = 0xffffff;
    const gold = 0xf0b830;
    const q = quad(k, c, { col, belly: 0xfffaf0, len: 0.6, r: 0.29, leg: 0.32, legR: 0.07, headR: 0.24, neck: 0.2, headZ: 0.08 });
    const h = q.headR * 1.03;
    // Eagle head (white)
    k.sphere(q.head, white, h);
    const beak = k.group(q.head, [0, -h * 0.14, h * 0.84]);
    k.sphere(beak, gold, h * 0.3, [0, 0.01, -0.01], [0.95, 0.85, 1]);
    k.horn(beak, gold, h * 0.25, h * 0.62, h * 0.3, [0, 0.03, 0.03], [PI / 2, PI, 0]);
    const er = h * 0.28;
    const ex = h * 0.4;
    const ey = h * 0.16;
    k.eyes(q.head, { x: ex, y: ey, z: Math.sqrt(h * h - ex * ex - ey * ey) - er * 0.15, r: er, iris: 0xe89a20 });
    for (const sx of [-1, 1]) k.sphere(q.head, 0xfff4d8, h * 0.2, [sx * h * 0.42, h * 0.46, h * 0.72], [1.3, 0.35, 0.6], [0.3, sx * 0.4, -sx * 0.3], { outline: false });
    ears(k, c, q.head, white, 0xffe4a0, h * 0.2, h * 0.5, h * 0.55, h * 0.62, 0.35, -h * 0.2);
    // Crest feathers on the head
    for (let i = 0; i < 3; i++) {
      const fg = k.group(q.head, [0, h * 0.7, -h * (0.25 + i * 0.25)], [-1.1 - i * 0.35, 0, 0]);
      k.blade(fg, white, h * (0.9 - i * 0.15), h * 0.3, 0.035, [0, 0, 0]);
      k.blade(fg, 0xffd24a, h * 0.3, h * 0.22, 0.05, [0, h * (0.6 - i * 0.1), 0], [0, 0, 0], { outline: false });
    }
    // White feathers on the chest and the sapphire on the gold collar
    k.sphere(c.body, white, 1, [0, q.bodyY + 0.06, q.len * 0.6], [0.25, 0.25, 0.26]);
    const collar = k.group(c.body, [0, q.bodyY + q.r * 0.62, q.len * 0.74], [0.55, 0, 0]);
    k.torus(collar, gold, q.r * 0.52, 0.025, [0, 0, 0], [PI / 2, 0, 0]);
    const gem = k.group(collar, [0, -0.04, q.r * 0.56], [-0.55, 0, 0]);
    k.sphere(gem, gold, 0.065, [0, 0, 0], [1, 1.15, 0.45]);
    const gg = new THREE.OctahedronGeometry(0.052);
    gg.scale(0.8, 1.15, 0.6);
    k.glow(gem, gg, 0x4a8aff, 2.2, [0, 0, 0.028]);
    k.glowSphere(gem, 0xd8ecff, 0.014, [-0.014, 0.02, 0.055], 3);
    // Forelegs: eagle talons
    for (const l of c.legs) {
      if (l.g.position.z <= 0) continue;
      k.sphere(l.g, gold, 0.068, [0, -0.3, 0.03], [1, 0.6, 1.2]);
      for (const dx of [-0.035, 0, 0.035]) k.horn(l.g, 0x8a6a3a, 0.018, 0.07, 0.035, [dx, -0.31, 0.08], [PI / 2, PI, 0]);
    }
    // Wings: white, gold at the ends
    for (const sx of [-1, 1]) {
      const w = featherWing(k, c, c.body, sx, { len: 0.8, wid: 0.21, pos: [0.19, q.bodyY + 0.2, 0.14], n: 5, col: white, tipCol: 0xffd24a, base: 0.7, amp: 0.2, speed: 2.6, fan: 0.75 });
      k.glowSphere(w, 0xfff0a0, 0.03, [0, 0.82, 0], 2.6);
    }
    // Lion tail: a tuft of lion fur at the end
    const tg = k.group(q.tail, [0, 0, 0]);
    c.tails.push({ g: tg, phase: 0, amp: 0.25, axis: 'y' });
    const tp: V3[] = [[0, 0, 0.04], [0, 0.03, -0.14], [0, 0.13, -0.3], [0, 0.3, -0.38], [0, 0.44, -0.36]];
    k.mesh(tg, tubeGeo(tp, 0.042, 0.72), col);
    const tuft = k.group(tg, [0, 0.46, -0.36], [0.3, 0, 0]);
    k.sphere(tuft, 0xe0a848, 0.075, [0, 0.02, 0], [1, 1.25, 1]);
    for (let i = 0; i < 3; i++) k.cone(tuft, 0xe0a848, 0.035, 0.1, [Math.cos(i * 2.1) * 0.03, 0.06, Math.sin(i * 2.1) * 0.03], [Math.sin(i * 2.1) * 0.5, 0, -Math.cos(i * 2.1) * 0.5], 6);
    for (let i = 0; i < 3; i++) sparkle(k, c, c.body, 0xfff0a0, 0.025, [Math.cos(i * 2.2) * 0.6, 0.8 + (i % 2) * 0.2, Math.sin(i * 2.2) * 0.4], 0.07);
  },

  // `abyssjelly`
  abyssjelly(k, c, s) {
    floater(c, 0.32);
    const bellCol = 0x3a2a6a;
    const rimCol = 0x6ae0ff;
    const tentCol = 0x5a4aa0;
    const armCol = 0x9a80e0;
    const R = [0.36, 0.4, 0.44][s - 1];
    const H = R * 0.95;
    const Lt = [0.36, 0.5, 0.64][s - 1];
    const bell = k.group(c.body, [0, Lt + 0.04, 0]);
    c.head = bell;
    // Bell: a slightly flared bell edge, translucent with a purple inner light
    const bm = k.lathe(bell, bellCol, [
      [0.001, 0.16 * H],
      [R * 0.5, 0.12 * H],
      [R * 0.86, 0.02],
      [R, 0],
      [R * 1.04, 0.09 * H],
      [R * 0.99, 0.38 * H],
      [R * 0.8, 0.7 * H],
      [R * 0.46, 0.92 * H],
      [0.001, H],
    ], [0, 0, 0], [0, 0, 0], { emissive: 0x5a3aaa, emissiveAmt: 0.14 });
    const mat = bm.material as THREE.ShaderMaterial;
    mat.transparent = true;
    mat.uniforms.uOpacity.value = 0.88;
    k.glowSphere(bell, 0x8a5aff, R * 0.36, [0, H * 0.45, 0], 1.0, [1, 0.7, 1], 0.55);
    k.glowSphere(bell, 0x6ae0ff, R * 0.12, [0, H * 0.5, 0], 1.6, [1, 1, 1], 0.7);
    // Face
    k.eyes(bell, { x: R * 0.34, y: H * 0.36, z: R * 0.9, r: R * 0.25, iris: 0x2aa8e8, yaw: 0.36, glow: s === 3 });
    k.blush(bell, R * 0.62, H * 0.2, R * 0.8, R * 0.12, 0xd080ff);
    ball(k, bell, 0x2a1a4a, R * 0.05, [0, H * 0.16, R * 0.99], [1.6, 0.5, 0.5], [0, 0, 0], { outline: false });
    // Glowing bell edge: a ring of light band + a ring of light points
    k.glow(bell, new THREE.TorusGeometry(R * 1.02, 0.02, 8, 48), rimCol, 2.2, [0, 0.02, 0], [PI / 2, 0, 0]);
    const dots = new GlowBatch();
    const nd = [8, 12, 16][s - 1];
    for (let i = 0; i < nd; i++) {
      const a = (i / nd) * PI * 2;
      dots.add(new THREE.SphereGeometry(0.03, 10, 8), 0xbff4ff, [Math.cos(a) * R * 1.04, 0.02, Math.sin(a) * R * 1.04]);
    }
    // Markings (from II): radial glowing lines and spots on top
    if (s >= 2) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2 + PI / 8;
        const pts: V3[] = [];
        for (let j = 0; j <= 5; j++) {
          const th = 0.15 + (j / 5) * 0.75;
          pts.push([Math.cos(a) * Math.sin(th) * R * 1.01, Math.cos(th) * H * 1.01, Math.sin(a) * Math.sin(th) * R * 1.01]);
        }
        dots.add(tubeGeo(pts, 0.012, 0.4, false, 16), 0x8ae8ff);
        const e = pts[pts.length - 1];
        dots.add(new THREE.SphereGeometry(0.028, 10, 8), 0xd8a0ff, e);
        const th2 = 0.55;
        const b = a + PI / 8;
        dots.add(new THREE.SphereGeometry(0.02, 8, 6), 0xd8a0ff, [Math.cos(b) * Math.sin(th2) * R * 1.01, Math.cos(th2) * H * 1.01, Math.sin(b) * Math.sin(th2) * R * 1.01]);
      }
      dots.add(new THREE.SphereGeometry(0.05, 12, 10), 0xd8a0ff, [0, H * 1.0, 0], [0, 0, 0], [1, 0.5, 1]);
    }
    // Tentacles: varied in thickness, slightly wavy, a point of light at the end
    const nt = [6, 9, 12][s - 1];
    for (let i = 0; i < nt; i++) {
      const a = (i / nt) * PI * 2 + 0.3;
      const rr = R * (0.55 + (i % 2) * 0.22);
      const base = k.group(bell, [Math.cos(a) * rr, 0.03, Math.sin(a) * rr]);
      const g = k.group(base, [0, 0, 0]);
      const len = Lt * (0.8 + hash(i + s) * 0.35);
      const pts: V3[] = [];
      for (let j = 0; j <= 6; j++) {
        const t = j / 6;
        const wig = Math.sin(t * 6 + i) * 0.05 * t;
        pts.push([Math.cos(a) * (t * 0.05) - Math.sin(a) * wig, -t * len, Math.sin(a) * (t * 0.05) + Math.cos(a) * wig]);
      }
      const r0 = [0.04, 0.034, 0.032][s - 1];
      k.mesh(g, taperGeo(pts, (t) => r0 * (1 - t * 0.6), { segs: 16, radial: 8 }), tentCol, [0, 0, 0], [0, 0, 0], { emissive: 0x3a2a7a, emissiveAmt: 0.1 });
      const e = pts[pts.length - 1];
      dots.add(new THREE.SphereGeometry(0.024, 8, 6), rimCol, [base.position.x + e[0], base.position.y + e[1], base.position.z + e[2]]);
      c.tails.push({ g, phase: i * 0.9, amp: 0.12, axis: i % 2 ? 'x' : 'z' });
    }
    // Oral arms: four frilled arms in the center, pale purple
    const arms = k.group(bell, [0, 0.05, 0]);
    c.tails.push({ g: arms, phase: 1.3, amp: 0.08, axis: 'y' });
    const na = [3, 4, 4][s - 1];
    const armParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < na; i++) {
      const a = (i / na) * PI * 2;
      for (let j = 0; j < 5; j++) {
        const t = j / 4;
        armParts.push(xf(new THREE.SphereGeometry(1, 12, 8), [Math.cos(a) * (0.05 + t * 0.04), -0.04 - t * Lt * 0.62, Math.sin(a) * (0.05 + t * 0.04)], [0, -a, 0.35 * Math.sin(j * 2 + i)], [0.085 - t * 0.03, 0.075, 0.04]));
      }
    }
    merged(k, arms, armCol, armParts, { emissive: 0x5a3aaa, emissiveAmt: 0.1 });
    if (s === 3) {
      // Crown-like frill: a ring of frills along the bell edge + crown spikes on the upper edge (the tips set with glowing gems)
      const frill: THREE.BufferGeometry[] = [];
      const nf = 16;
      for (let i = 0; i < nf; i++) {
        const a = (i / nf) * PI * 2;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI / 2 - a, 0));
        q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(PI - 0.85, 0, 0)));
        const geo = new THREE.SphereGeometry(0.5, 12, 8);
        geo.scale(0.15, 0.22, 0.035);
        geo.translate(0, 0.09, 0);
        frill.push(xf(geo, [Math.cos(a) * R * 1.02, 0.0, Math.sin(a) * R * 1.02], q));
      }
      merged(k, bell, 0x5a44a8, frill, { emissive: 0x4a2a9a, emissiveAmt: 0.12 });
      const spikes: THREE.BufferGeometry[] = [];
      const np = 10;
      const th = 0.6;
      for (let i = 0; i < np; i++) {
        const a = (i / np) * PI * 2 + PI / 2 + PI / np;
        const tall = i % 2 === 0 ? 0.24 : 0.15;
        const p: V3 = [Math.cos(a) * Math.sin(th) * R * 0.97, Math.cos(th) * H * 0.97, Math.sin(a) * Math.sin(th) * R * 0.97];
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI / 2 - a, 0));
        q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0, 0)));
        const geo = new THREE.SphereGeometry(0.5, 12, 8);
        geo.scale(0.11, tall, 0.04);
        geo.translate(0, tall * 0.42, 0);
        spikes.push(xf(geo, p, q));
        const tipP = new THREE.Vector3(0, tall * 0.9, 0).applyQuaternion(q);
        dots.add(new THREE.SphereGeometry(i % 2 === 0 ? 0.032 : 0.024, 10, 8), i % 2 === 0 ? 0x8ae8ff : 0xd8a0ff, [p[0] + tipP.x, p[1] + tipP.y, p[2] + tipP.z]);
      }
      merged(k, bell, 0x5a44a8, spikes, { emissive: 0x4a2a9a, emissiveAmt: 0.12 });
      dots.add(new THREE.OctahedronGeometry(0.055), 0x6ae0ff, [0, Math.cos(th) * H + 0.08, Math.sin(th) * R + 0.04], [0, 0, 0], [0.8, 1.3, 0.6]);
      // The queen's veil: a few especially long thin tentacles hung with light points
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + 0.9;
        const base = k.group(bell, [Math.cos(a) * R * 0.9, 0.02, Math.sin(a) * R * 0.9]);
        const g = k.group(base, [0, 0, 0]);
        const len = Lt * 1.3;
        const pts: V3[] = [];
        for (let j = 0; j <= 6; j++) {
          const t = j / 6;
          pts.push([Math.cos(a) * t * 0.12 + Math.sin(t * 7 + i) * 0.03 * t, -t * len, Math.sin(a) * t * 0.12]);
        }
        k.mesh(g, taperGeo(pts, (t) => 0.012 * (1 - t * 0.4), { segs: 16, radial: 6 }), 0x7a66c8, [0, 0, 0], [0, 0, 0], { outline: false, emissive: 0x6ae0ff, emissiveAmt: 0.3 });
        for (const t of [0.35, 0.7, 1]) {
          const p = curveAt(pts, t);
          dots.add(new THREE.SphereGeometry(0.018, 8, 6), 0xbff4ff, [base.position.x + p[0], base.position.y + p[1], base.position.z + p[2]]);
        }
        c.tails.push({ g, phase: i * 1.1 + 2, amp: 0.15, axis: i % 2 ? 'x' : 'z' });
      }
      for (let i = 0; i < 4; i++) sparkle(k, c, c.body, 0x8ae8ff, 0.025, [Math.cos(i * 1.6) * 0.6, Lt + 0.1 + (i % 2) * 0.3, Math.sin(i * 1.6) * 0.45], 0.08);
    } else {
      for (let i = 0; i < s + 1; i++) sparkle(k, c, c.body, 0x8ae8ff, 0.022, [Math.cos(i * 2.2) * 0.45, Lt + 0.1 + (i % 2) * 0.2, Math.sin(i * 2.2) * 0.35], 0.07);
    }
    dots.build(k, bell, 2.3);
  },

  // `maskfox`
  maskfox(k, c, s) {
    c.archetype = 'quad';
    const col = 0x2e2640;
    const belly = 0x4a3e66;
    const paw = 0x1c1628;
    const mask = 0xf6f2ea;
    const red = 0xd8323a;
    const gold = 0xffc040;
    const fire = 0xa070ff;
    const len = [0.4, 0.52, 0.6][s - 1];
    const r = [0.2, 0.2, 0.21][s - 1];
    const leg = [0.15, 0.23, 0.29][s - 1];
    const legR = [0.05, 0.05, 0.052][s - 1];
    const h = [0.27, 0.24, 0.23][s - 1];
    const bodyY = leg + r * 0.85;
    // Torso: chest and haunch spheres joined by a capsule, a light belly
    k.sphere(c.body, col, 1, [0, bodyY + 0.01, len * 0.28], [r, r * 0.96, r * 1.05]);
    k.sphere(c.body, col, 1, [0, bodyY - 0.005, -len * 0.32], [r * 0.94, r * 0.9, r]);
    k.capsule(c.body, col, r * 0.82, len * 0.5, [0, bodyY, 0], [PI / 2, 0, 0]);
    k.sphere(c.body, belly, 1, [0, bodyY - r * 0.4, 0.02], [r * 0.66, r * 0.55, len * 0.5], [0, 0, 0], { outline: false });
    // Limbs: the hind legs have thighs, the paws are dark
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = k.group(c.body, [sx * r * 0.6, leg + 0.03, sz > 0 ? len * 0.3 : -len * 0.36]);
        if (sz < 0) ball(k, g, col, r * 0.46, [sx * 0.01, 0.01, -0.02], [0.8, 1, 1.05]);
        k.capsule(g, col, legR, leg * 0.55, [0, -leg * 0.45, 0]);
        k.sphere(g, paw, legR * 1.3, [0, -leg + legR * 0.9, legR * 0.35], [1, 0.7, 1.3]);
        c.legs.push({ g, phase: sx * sz > 0 ? 0 : PI, amp: 1 });
      }
    }
    // Neck and head
    const neck = [0.03, 0.07, 0.1][s - 1];
    const hp: V3 = [0, bodyY + r * 0.7 + neck, len * 0.5 + h * 0.3];
    k.capsule(c.body, col, r * 0.5, neck + r * 0.3, [0, bodyY + r * 0.4 + neck * 0.5, len * 0.42], [0.5, 0, 0]);
    const head = k.group(c.body, hp);
    c.head = head;
    k.sphere(head, col, h, [0, 0, -h * 0.05], [1, 0.95, 1]);
    // Neck fur (from II): a ring of pale purple fluff
    if (s >= 2) {
      const ruff: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        ruff.push(xf(new THREE.SphereGeometry(h * 0.3, 10, 8), [Math.cos(a) * h * 0.72, -h * 0.35 + Math.sin(a) * h * 0.2, -h * 0.35], [0, 0, 0], [1, 0.8, 0.7]));
      }
      merged(k, head, 0x5a4c78, ruff);
    }
    // Mask: a white fox mask (face plate + muzzle + white pointed ears), red markings, golden fox eyes
    const mc: V3 = [0, -h * 0.02, h * 0.34];
    const mr: V3 = [h * 0.98, h * 0.98, h * 0.7];
    k.sphere(head, mask, 1, mc, mr);
    for (const sx of [-1, 1]) {
      const base = k.group(head, [sx * h * 0.52, h * 0.7, h * 0.1], [-0.2, 0, -sx * 0.32]);
      const g = k.group(base, [0, 0, 0]);
      k.cone(g, mask, h * 0.25, h * 0.66, [0, 0, 0], [0, 0, 0], 10);
      k.cone(g, red, h * 0.14, h * 0.44, [0, h * 0.06, h * 0.1], [0, 0, 0], 10, { outline: false });
      c.ears.push({ g, phase: sx * 1.7 });
    }
    k.sphere(head, mask, 1, [0, -h * 0.34, h * 0.96], [h * 0.32, h * 0.22, h * 0.36]);
    ball(k, head, 0x1a1422, h * 0.07, [0, -h * 0.28, h * 1.3], [1.2, 0.8, 0.9], [0, 0, 0], { outline: false });
    k.eyes(head, { x: h * 0.38, y: h * 0.1, z: h * 0.96, r: h * 0.24, iris: gold, glow: s >= 2, sharp: s >= 2, yaw: 0.3 });
    for (const sx of [-1, 1]) {
      // Brow marks (slanting up and outward), three whisker marks at each cheek
      decal(k, head, red, h * 0.16, [1.8, 0.42, 0.3], mc, mr, sx * h * 0.42, h * 0.46, sx * 0.6);
      for (let i = 0; i < 3; i++) decal(k, head, red, h * 0.11, [1.8, 0.3, 0.3], mc, mr, sx * h * 0.62, -h * (0.08 + i * 0.16), -sx * (0.15 + i * 0.12));
      if (s >= 2) decal(k, head, red, h * 0.06, [0.4, 1.4, 0.3], mc, mr, sx * h * 0.3, -h * 0.2, sx * 0.15);
      if (s === 3) decal(k, head, gold, h * 0.05, [1, 1, 0.3], mc, mr, sx * h * 0.72, h * 0.3);
    }
    decal(k, head, red, h * 0.1, [0.5, 1.5, 0.3], mc, mr, 0, h * 0.62);
    if (s === 3) decal(k, head, gold, h * 0.07, [1, 1.3, 0.3], mc, mr, 0, h * 0.78);
    if (s === 1) k.blush(head, h * 0.62, -h * 0.16, h * 0.92, h * 0.12, 0xff9aa8);
    // Tie cord: a ring around the head, knotted behind with two ribbons hanging down
    k.torus(head, red, h * 0.97, 0.013, [0, h * 0.12, -h * 0.02], [PI / 2 + 0.35, 0, 0]);
    k.sphere(head, red, h * 0.09, [0, h * 0.36, -h * 0.88]);
    for (const sx of [-1, 1]) k.blade(head, red, h * (s === 1 ? 0.4 : 0.6), h * 0.14, 0.02, [sx * h * 0.06, h * 0.32, -h * 0.9], [PI - 0.35, 0, sx * 0.35]);
    // Neck bell (from II): a red cord + a gold bell
    if (s >= 2) {
      const cy = bodyY + r * 0.55 + neck * 0.4;
      k.torus(c.body, red, r * 0.62, 0.014, [0, cy, len * 0.42], [PI / 2 - 0.35, 0, 0]);
      k.sphere(c.body, gold, 0.035, [0, cy - 0.06, len * 0.42 + r * 0.6]);
      ball(k, c.body, 0x8a6010, 0.012, [0, cy - 0.075, len * 0.42 + r * 0.6 + 0.028], [1, 1, 0.6], [0, 0, 0], { outline: false });
    }
    // Tails: one at I, two at II, seven fanned out at III, with fox-fire at the tail tips
    const nt = [1, 2, 7][s - 1];
    const tl = [0.36, 0.42, 0.56][s - 1];
    const tailBase = k.group(c.body, [0, bodyY + r * 0.22, -len * 0.5 - r * 0.4]);
    for (let i = 0; i < nt; i++) {
      const u = nt === 1 ? 0 : i / (nt - 1) - 0.5;
      const yaw = u * (nt > 2 ? 2.2 : 1.1);
      const { g, tip } = foxTail(k, c, tailBase, col, mask, tl * (1 - Math.abs(u) * 0.25), { yaw, lift: 1 - Math.abs(u) * 0.5 + (nt > 2 ? (i % 2) * 0.22 : 0), thick: nt > 2 ? 0.9 : 1.1, phase: i * 0.8 });
      if (s === 3) k.flame(g, fire, 0xf0e0ff, 0.065, [tip[0], tip[1] + 0.01, tip[2] - 0.01], [-0.5, 0, 0]);
    }
    // Fox-fire around it
    if (s >= 2) for (let i = 0; i < s + 1; i++) sparkle(k, c, c.body, 0xb080ff, 0.02, [Math.cos(i * 2.1 + 0.5) * 0.5, bodyY + 0.2 + (i % 2) * 0.25, Math.sin(i * 2.1 + 0.5) * 0.4], 0.07);
    if (s === 3) {
      // Small masks floating around it: a fox mask, an oni mask and a Noh mask take turns, slowly circling the body
      const ring = k.group(c.body, [0, bodyY + r + 0.12, -0.05]);
      c.spinners.push({ g: ring, speed: 0.45, axis: 'y' });
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2;
        const R = 0.74;
        const m = k.group(ring, [Math.cos(a) * R, Math.sin(i * 1.7) * 0.12, Math.sin(a) * R], [0, PI / 2 - a, 0]);
        c.bobbers.push({ g: m, base: m.position.y, amp: 0.04, speed: 1.6, phase: i * 1.3 });
        const type = i % 3;
        const sz = 0.115;
        const face = type === 1 ? red : mask;
        ball(k, m, face, 1, [0, 0, 0], [sz * 0.88, sz, sz * 0.42]);
        if (type === 0) {
          // Fox mask: a muzzle, golden squinting eyes, red markings
          ball(k, m, mask, 1, [0, -sz * 0.38, sz * 0.3], [sz * 0.3, sz * 0.22, sz * 0.3]);
          ball(k, m, 0x1a1422, sz * 0.07, [0, -sz * 0.34, sz * 0.58], [1.2, 0.8, 0.8], [0, 0, 0], { outline: false });
          for (const sx of [-1, 1]) {
            const eg = new THREE.SphereGeometry(sz * 0.2, 10, 8);
            eg.scale(1, 0.42, 0.5);
            k.glow(m, eg, gold, 2.4, [sx * sz * 0.36, sz * 0.12, sz * 0.4], [0, 0, sx * 0.4]);
            ball(k, m, red, sz * 0.12, [sx * sz * 0.4, sz * 0.42, sz * 0.36], [1.5, 0.35, 0.3], [0, 0, sx * 0.5], { outline: false });
            ball(k, m, red, sz * 0.08, [sx * sz * 0.6, -sz * 0.12, sz * 0.3], [1.6, 0.3, 0.3], [0, 0, -sx * 0.2], { outline: false });
          }
        } else if (type === 1) {
          // Oni mask: gold horns, white fangs, black brows
          for (const sx of [-1, 1]) {
            k.horn(m, gold, sz * 0.09, sz * 0.4, sz * 0.12, [sx * sz * 0.4, sz * 0.8, -sz * 0.05], [0, 0, -sx * 0.4]);
            k.glowSphere(m, 0xffe08a, sz * 0.13, [sx * sz * 0.36, sz * 0.12, sz * 0.4], 2.4, [1, 0.7, 0.5]);
            ball(k, m, 0x1a1422, sz * 0.1, [sx * sz * 0.38, sz * 0.36, sz * 0.36], [1.6, 0.35, 0.3], [0, 0, -sx * 0.5], { outline: false });
            k.cone(m, mask, sz * 0.05, sz * 0.16, [sx * sz * 0.18, -sz * 0.6, sz * 0.36], [0, 0, 0], 6, { outline: false });
          }
          ball(k, m, 0x1a1422, sz * 0.11, [0, -sz * 0.5, sz * 0.36], [1.8, 0.4, 0.3], [0, 0, 0], { outline: false });
        } else {
          // Noh mask: thin black brows, squinting eyes, red lips
          for (const sx of [-1, 1]) {
            ball(k, m, 0x1a1422, sz * 0.09, [sx * sz * 0.34, sz * 0.4, sz * 0.36], [1.6, 0.3, 0.3], [0, 0, sx * 0.25], { outline: false });
            ball(k, m, 0x1a1422, sz * 0.1, [sx * sz * 0.34, sz * 0.1, sz * 0.4], [1.5, 0.28, 0.3], [0, 0, 0], { outline: false });
          }
          ball(k, m, red, sz * 0.1, [0, -sz * 0.42, sz * 0.36], [1.6, 0.5, 0.3], [0, 0, 0], { outline: false });
        }
      }
    }
  },

  // `tombhound`
  tombhound(k, c, s) {
    c.archetype = 'quad';
    const col = 0x241e2e;
    const muzzle = 0x5c507a;
    const jowl = 0x3e3452;
    const sheen: PartOpts = { emissive: 0x3a2a6a, emissiveAmt: 0.18 };
    const paw = 0x1a1424;
    const fire = 0x8a6aff;
    const core = 0xd8ccff;
    const bone = 0xe6dcc8;
    const iron = 0x5a5468;
    const len = [0.4, 0.56, 0.64][s - 1];
    const r = [0.22, 0.28, 0.31][s - 1];
    const leg = [0.16, 0.24, 0.27][s - 1];
    const legR = [0.07, 0.09, 0.1][s - 1];
    const h = [0.28, 0.26, 0.25][s - 1];
    const bodyY = leg + r * 0.8;
    // Torso: a wide chest, thick shoulders, a slightly smaller haunch
    k.sphere(c.body, col, 1, [0, bodyY + 0.03, len * 0.26], [r * 1.12, r * 1.02, r * 1.1], [0, 0, 0], sheen);
    k.sphere(c.body, col, 1, [0, bodyY - 0.01, -len * 0.32], [r * 0.94, r * 0.88, r], [0, 0, 0], sheen);
    k.capsule(c.body, col, r * 0.86, len * 0.45, [0, bodyY, -0.02], [PI / 2, 0, 0], sheen);
    ball(k, c.body, muzzle, 1, [0, bodyY - r * 0.38, 0.04], [r * 0.7, r * 0.55, len * 0.52], [0, 0, 0], { outline: false });
    // Limbs: short and thick, big paws with claws
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = k.group(c.body, [sx * r * 0.66, leg + 0.03, sz > 0 ? len * 0.3 : -len * 0.34]);
        ball(k, g, col, r * 0.5, [sx * 0.01, 0.02, 0], [0.85, 1, 1], [0, 0, 0], sheen);
        k.capsule(g, col, legR, leg * 0.5, [0, -leg * 0.45, 0], [0, 0, 0], sheen);
        ball(k, g, paw, legR * 1.4, [0, -leg + legR * 0.85, legR * 0.4], [1.05, 0.7, 1.3]);
        for (const dx of [-0.5, 0, 0.5]) k.cone(g, bone, legR * 0.2, legR * 0.5, [dx * legR, -leg + legR * 0.45, legR * 1.5], [PI / 2 + 0.2, 0, 0], 6, { outline: false });
        c.legs.push({ g, phase: sx * sz > 0 ? 0 : PI, amp: 1 });
      }
    }
    /** Mastiff head: thick brows, a square muzzle, drooping jowls, fangs, drooping ears; main = false is III's side heads */
    const houndHead = (g: THREE.Object3D, hh: number, main: boolean) => {
      k.sphere(g, col, hh, [0, 0, 0], [1, 0.94, 1], [0, 0, 0], sheen);
      ball(k, g, col, 1, [0, hh * 0.28, hh * 0.5], [hh * 0.86, hh * 0.28, hh * 0.5], [0, 0, 0], sheen);
      ball(k, g, muzzle, 1, [0, -hh * 0.26, hh * 0.72], [hh * 0.62, hh * 0.44, hh * 0.56]);
      for (const sx of [-1, 1]) ball(k, g, jowl, 1, [sx * hh * 0.5, -hh * 0.4, hh * 0.62], [hh * 0.24, hh * 0.32, hh * 0.3]);
      ball(k, g, 0x0e0a14, hh * 0.15, [0, -hh * 0.1, hh * 1.2], [1.3, 0.8, 0.8], [0, 0, 0], { outline: false });
      ball(k, g, 0x1a1020, 1, [0, -hh * 0.52, hh * 0.92], [hh * 0.42, hh * 0.08, hh * 0.3], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) k.cone(g, bone, hh * 0.055, hh * 0.16, [sx * hh * 0.24, -hh * 0.58, hh * 1.0], [0, 0, 0], 6, { outline: false });
      if (s === 1) {
        k.eyes(g, { x: hh * 0.38, y: hh * 0.08, z: hh * 0.86, r: hh * 0.27, iris: 0xb89aff, yaw: 0.3 });
        k.blush(g, hh * 0.64, -hh * 0.1, hh * 0.68, hh * 0.13, 0xb06a9a);
      } else {
        k.eyes(g, { x: hh * 0.38, y: hh * 0.08, z: hh * 0.86, r: hh * 0.3, iris: 0xb89aff, glow: true, sharp: true, yaw: 0.3 });
        for (const sx of [-1, 1]) ball(k, g, 0x141020, hh * 0.2, [sx * hh * 0.36, hh * 0.32, hh * 0.84], [1.3, 0.35, 0.5], [0, 0, -sx * 0.4], { outline: false });
        // Bone head armor: covers the top of the head and the bridge of the nose
        k.lathe(g, bone, [[0.001, hh * 1.0], [hh * 0.45, hh * 0.92], [hh * 0.76, hh * 0.68], [hh * 0.88, hh * 0.46], [hh * 0.82, hh * 0.4], [hh * 0.68, hh * 0.6], [hh * 0.4, hh * 0.84], [0.001, hh * 0.92]], [0, 0.01 * hh, hh * 0.06], [-0.3, 0, 0]);
        k.capsule(g, bone, hh * 0.09, hh * 0.5, [0, hh * 0.28, hh * 0.72], [PI / 2 - 0.5, 0, 0]);
        if (main && s === 3) for (const sx of [-1, 1]) k.horn(g, bone, hh * 0.1, hh * 0.42, hh * 0.16, [sx * hh * 0.5, hh * 0.6, hh * 0.1], [-0.4, 0, -sx * 0.7]);
      }
      for (const sx of [-1, 1]) {
        const base = k.group(g, [sx * hh * 0.82, hh * 0.42, -hh * 0.05], [0, 0, sx * 0.25]);
        const e = k.group(base, [0, 0, 0]);
        k.blade(e, col, hh * 0.66, hh * 0.4, 0.06, [0, 0, 0], [PI - 0.25, 0, sx * 0.15], sheen);
        k.blade(e, muzzle, hh * 0.4, hh * 0.2, 0.06, [sx * 0.01, -hh * 0.06, 0.012], [PI - 0.25, 0, sx * 0.15], { outline: false });
        c.ears.push({ g: e, phase: sx * 1.5 + hh });
      }
    };
    const neckL = [0.02, 0.06, 0.08][s - 1];
    const hp: V3 = [0, bodyY + r * 0.72 + neckL, len * 0.5 + h * 0.2];
    const head = k.group(c.body, hp);
    c.head = head;
    k.capsule(c.body, col, r * 0.62, neckL + r * 0.4, [0, bodyY + r * 0.42 + neckL * 0.5, len * 0.4], [0.55, 0, 0], sheen);
    houndHead(head, h, true);
    if (s === 3) {
      for (const sx of [-1, 1]) {
        const g = k.group(c.body, [sx * (r * 0.95), hp[1] - 0.05, hp[2] - 0.16], [0.05, sx * 0.5, sx * 0.12]);
        link(k, c.body, col, [sx * r * 0.45, bodyY + r * 0.35, len * 0.36], [g.position.x * 0.92, hp[1] - 0.1, hp[2] - 0.22], r * 0.4);
        houndHead(g, h * 0.86, false);
        c.bobbers.push({ g, base: g.position.y, amp: 0.012, speed: 2.4, phase: sx * 1.4 });
      }
    }
    // Netherfire at the neck: a whole ring of blue-purple flame mane around the neck, tallest at the back and low at the front where it props up the chin; at III it widens into an ellipse that encloses all three heads
    const ringX = r * [0.95, 0.95, 1.5][s - 1];
    const ringY = r * [0.85, 0.85, 0.95][s - 1];
    const neck = k.group(c.body, [0, hp[1] - h * 0.5, hp[2] - h * 0.45], [-1.05, 0, 0]);
    k.glow(neck, new THREE.TorusGeometry(ringX, 0.035, 8, 40).scale(1, ringY / ringX, 1), fire, 1.8, [0, 0, 0], [0, 0, 0], 0.85);
    const ruff: THREE.BufferGeometry[] = [];
    const nf = [8, 10, 14][s - 1];
    for (let i = 0; i < nf; i++) {
      const a = (i / nf) * PI * 2 + PI / 2;
      const back = 0.5 + 0.5 * Math.sin(a);
      const size = [0.13, 0.16, 0.19][s - 1] * (0.5 + 0.7 * back) * (i % 2 ? 0.85 : 1);
      k.flame(neck, fire, core, size, [Math.cos(a) * ringX, Math.sin(a) * ringY, -0.01], [-0.25 + back * 0.2, 0, a - PI / 2]);
      ruff.push(xf(new THREE.SphereGeometry(r * 0.2, 10, 8), [Math.cos(a) * ringX * 0.92, Math.sin(a) * ringY * 0.92, -0.03], [0, 0, 0], [1, 1, 0.7]));
    }
    merged(k, neck, jowl, ruff);
    // III: an iron collar and broken chains (the gate guard dog)
    if (s === 3) {
      const cg = k.group(c.body, [0, bodyY + r * 0.5 + neckL, len * 0.42], [-0.5, 0, 0]);
      k.torus(cg, iron, r * 0.66, 0.028, [0, 0, 0], [0, 0, 0]);
      for (let i = 0; i < 4; i++) {
        const a = -0.4 + i * 0.9;
        k.cone(cg, bone, 0.028, 0.09, [Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66, 0], [0, 0, a - PI / 2], 6);
      }
      const chain = k.group(cg, [0, -r * 0.62, 0.02]);
      c.tails.push({ g: chain, phase: 2, amp: 0.1, axis: 'x' });
      for (let i = 0; i < 4; i++) k.torus(chain, iron, 0.028, 0.009, [0, -0.045 - i * 0.05, 0], [0, (i % 2) * PI / 2, 0]);
    }
    // Tail: short, thick and curled up, netherfire at the end
    const tl = [0.28, 0.36, 0.4][s - 1];
    const tb = k.group(c.body, [0, bodyY + r * 0.35, -len * 0.5 - r * 0.45]);
    const tg = k.group(tb, [0, 0, 0]);
    c.tails.push({ g: tg, phase: 0, amp: 0.2, axis: 'y' });
    const tp: V3[] = [[0, 0, 0.05], [0, 0.03, -tl * 0.35], [0, 0.14 * tl / 0.3, -tl * 0.7], [0, 0.3 * tl / 0.3, -tl * 0.9]];
    k.mesh(tg, taperGeo(tp, (t) => r * (0.26 - t * 0.14)), col);
    const tipP = curveAt(tp, 0.98);
    k.flame(tg, fire, core, [0.13, 0.17, 0.2][s - 1], [tipP[0], tipP[1], tipP[2]], [-0.7, 0, 0]);
    // Bone armor (from II): shoulder guards, ribs, spinal spikes
    if (s >= 2) {
      const armor: THREE.BufferGeometry[] = [];
      const cone = (rr: number, hgt: number, pos: V3, rot: V3) => {
        const g = new THREE.ConeGeometry(rr, hgt, 6);
        g.translate(0, hgt / 2, 0);
        return xf(g, pos, rot);
      };
      for (const sx of [-1, 1]) {
        armor.push(xf(new THREE.SphereGeometry(r * 0.5, 18, 12), [sx * r * 0.8, bodyY + r * 0.4, len * 0.3], [0, 0, sx * 0.7], [0.8, 0.45, 1]));
        for (let i = 0; i < 3; i++) armor.push(xf(new THREE.CapsuleGeometry(0.022, r * 0.55, 4, 8), [sx * r * 1.0, bodyY - 0.02, len * (0.12 - i * 0.2)], [0, 0, sx * 0.25]));
      }
      const ns = s === 2 ? 4 : 5;
      for (let i = 0; i < ns; i++) armor.push(cone(0.05, 0.12 + (i === 1 ? 0.04 : 0), [0, bodyY + r * 0.9, len * (0.18 - i * 0.2)], [-0.5, 0, 0]));
      merged(k, c.body, bone, armor);
    }
    for (let i = 0; i < s + 1; i++) sparkle(k, c, c.body, 0xa88aff, 0.022, [Math.cos(i * 2.3) * 0.55, bodyY + 0.2 + (i % 2) * 0.3, Math.sin(i * 2.3) * 0.45], 0.08);
  },

  // `weaverspider`
  weaverspider(k, c) {
    c.archetype = 'crawl';
    const col = 0x2a2040;
    const joint = 0x6a5a9a;
    const fluff = 0x46386a;
    const web = 0xdfe8ff;
    // Cephalothorax
    k.sphere(c.body, col, 1, [0, 0.3, 0.05], [0.2, 0.16, 0.22]);
    const head = k.group(c.body, [0, 0.42, 0.24]);
    c.head = head;
    const hr = 0.22;
    k.sphere(head, col, hr);
    const surf = (x: number, y: number) => Math.sqrt(Math.max(0, hr * hr - x * x - y * y));
    const er = hr * 0.3;
    k.eyes(head, { x: hr * 0.36, y: -hr * 0.02, z: surf(hr * 0.36, -hr * 0.02) - er * 0.2, r: er, iris: 0xa050ff, glow: true });
    for (const [x, y] of [[0.045, 0.125], [-0.045, 0.125], [0.115, 0.1], [-0.115, 0.1]]) k.glowSphere(head, 0xc8a0ff, 0.021, [x, y, surf(x, y) - 0.004], 2);
    for (const sx of [-1, 1]) {
      k.sphere(head, 0x3e305e, 0.045, [sx * 0.045, -hr * 0.66, hr * 0.64]);
      k.horn(head, 0xd0b8ff, 0.016, 0.07, 0.03, [sx * 0.045, -hr * 0.76, hr * 0.7], [PI, 0, 0]);
    }
    k.blush(head, hr * 0.66, -hr * 0.3, hr * 0.7, hr * 0.12, 0xb070c0);
    // A ring of fluff around the neck
    const tuft: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      tuft.push(xf(new THREE.SphereGeometry(0.06, 10, 8), [Math.cos(a) * 0.15, 0.33 + Math.sin(a) * 0.1, 0.13 + Math.sin(a) * 0.02], [0, 0, 0], [1, 1, 0.8]));
    }
    merged(k, c.body, fluff, tuft);
    // Abdomen
    const ab = k.group(c.body, [0, 0.5, -0.3], [-0.4, 0, 0]);
    const AR: V3 = [0.34, 0.3, 0.37];
    k.sphere(ab, col, 1, [0, 0, 0], AR);
    k.sphere(c.body, col, 0.08, [0, 0.36, -0.1]);
    k.cone(ab, joint, 0.05, 0.08, [0, -0.02, -AR[2] + 0.02], [-PI / 2, 0, 0], 8);
    // Web pattern on the abdomen (silver-white glow)
    const pole = new THREE.Vector3(0, 1, 0.12).normalize();
    const u = new THREE.Vector3(1, 0, 0);
    const v = new THREE.Vector3().crossVectors(pole, u).normalize();
    const onAb = (th: number, ph: number): V3 => {
      const d = pole.clone().multiplyScalar(Math.cos(th)).add(u.clone().multiplyScalar(Math.cos(ph) * Math.sin(th))).add(v.clone().multiplyScalar(Math.sin(ph) * Math.sin(th)));
      d.normalize();
      return [d.x * AR[0] * 1.01, d.y * AR[1] * 1.01, d.z * AR[2] * 1.01];
    };
    const webB = new GlowBatch();
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
      const ph = (i / spokes) * PI * 2;
      const pts: V3[] = [];
      for (let j = 0; j <= 6; j++) pts.push(onAb(0.02 + (j / 6) * 1.3, ph));
      webB.add(tubeGeo(pts, 0.0065, 0.6, false, 18), web);
    }
    for (const th of [0.34, 0.68, 1.02]) {
      const pts: V3[] = [];
      for (let i = 0; i < spokes; i++) {
        const ph = (i / spokes) * PI * 2;
        pts.push(onAb(th, ph));
        pts.push(onAb(th * 0.88, ph + PI / spokes));
      }
      webB.add(tubeGeo(pts, 0.0055, 1, true, 64), web);
    }
    webB.add(new THREE.SphereGeometry(0.03, 10, 8), 0xffffff, onAb(0, 0));
    webB.build(k, ab, 1.35);
    // Eight legs (each leg merged into two meshes)
    const linkGeo = (a: V3, b: V3, r: number) => {
      const A = new THREE.Vector3(...a);
      const d = new THREE.Vector3(...b).sub(A);
      const geo = new THREE.CapsuleGeometry(r, Math.max(0.002, d.length()), 4, 8);
      return xf(geo, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
    };
    const fwd = [0.95, 0.35, -0.3, -0.9];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const g = k.group(c.body, [sx * 0.13, 0.3, 0.16 - i * 0.08], [0, -sx * fwd[i], 0]);
        const reach = i === 0 ? 1.1 : 1;
        const knee: V3 = [sx * 0.25 * reach, 0.17, 0];
        const foot: V3 = [sx * 0.46 * reach, -0.235, 0];
        merged(k, g, col, [linkGeo([sx * 0.03, 0, 0], knee, 0.03), linkGeo(knee, foot, 0.024)]);
        const tipG = new THREE.ConeGeometry(0.024, 0.07, 6);
        tipG.translate(0, -0.035, 0);
        merged(k, g, joint, [xf(new THREE.SphereGeometry(0.037, 12, 10), knee), xf(tipG, foot, [0, 0, sx * 0.25])]);
        c.legs.push({ g, phase: i * 1.3 + (sx > 0 ? PI : 0), amp: 0.3 });
      }
    }
    // Dream motes
    for (let i = 0; i < 5; i++) sparkle(k, c, c.body, i % 2 ? 0xdfe8ff : 0xc8a0ff, 0.024, [Math.cos(i * 1.3) * 0.6, 0.6 + (i % 3) * 0.15, -0.2 + Math.sin(i * 1.3) * 0.5], 0.08);
  },
};
