// Procedural models for each spirit × its three stages.
// Each spirit is first assembled at roughly 1 unit in size, then normalized to a target height by rarity and stage.
// The second batch of spirit models lives in separate files under species/.

import * as THREE from 'three';
import { applyCorruption } from './corruption.ts';
import { Creature, Kit } from './creature.ts';
import { applyPortParam, buildLabCreature, isPorted } from './labCreature.ts';
import { biped, bird, ears, floater, halo, PI, quad, roundEars, sparkle, tailChain, wing, type Builder, type Stage, type V3 } from './parts.ts';
import { SPECIES_TOWN } from './species/town.ts';
import { SPECIES_NATURE_WATER } from './species/natureWater.ts';
import { SPECIES_FIRE_WIND } from './species/fireWind.ts';
import { SPECIES_EARTH_THUNDER } from './species/earthThunder.ts';
import { SPECIES_LIGHT_DARK } from './species/lightDark.ts';
import { SPECIES_LEGENDS } from './species/legends.ts';
import { SPECIES_FIRSTN } from './species/firstN.ts';
import { SPECIES_FIRSTR } from './species/firstR.ts';
import { SPECIES_FIRSTSR } from './species/firstSR.ts';

// ───────────────────────── Helpers for the eight source crystal guardians (SSR) ─────────────────────────
// `ignisar` through `noxfang` are the face of the game, with models far more detailed than the other spirits; the part helpers they share are here,
// written the same way as in species/legends.ts (the helpers there are not exported, so each file keeps its own copy).

type C = THREE.ColorRepresentation;
type PO = NonNullable<Parameters<Kit['mesh']>[5]>;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Merge vertices at the same position and recompute smooth normals (for the outline copy of hard-edged geometry) */
function weld(geo: THREE.BufferGeometry, tol = 1e-4): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const map = new Map<string, number>();
  const verts: number[] = [];
  const remap = new Int32Array(pos.count);
  const q = 1 / tol;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = verts.length / 3;
      map.set(key, idx);
      verts.push(x, y, z);
    }
    remap[i] = idx;
  }
  const index: number[] = [];
  if (geo.index) for (let i = 0; i < geo.index.count; i++) index.push(remap[geo.index.getX(i)]);
  else for (let i = 0; i < pos.count; i++) index.push(remap[i]);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(index);
  out.computeVertexNormals();
  return out;
}

/** Angular parts (extrusions, polyhedra): the outline uses a copy with smooth normals pushed outward, so the hard-edge normals do not tear the outline into fragments */
function hard(k: Kit, parent: THREE.Object3D, geo: THREE.BufferGeometry, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PO = {}): THREE.Mesh {
  // The post-process outline version does not need an outline copy with smooth normals and draws the lines directly as an ordinary part
  if (k.ink) return k.mesh(parent, geo, col, pos, rot, o);
  const m = k.mesh(parent, geo, col, pos, rot, { ...o, outline: false });
  const om = k.c.outlines[0];
  if (om) m.add(new THREE.Mesh(weld(geo), om));
  return m;
}

/** Make the object's +y point along dir */
function aim<T extends THREE.Object3D>(g: T, dir: THREE.Vector3): T {
  g.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  return g;
}

/** Tube along a curve with variable radius (neck, tail, tentacle) */
function taperTube(pts: THREE.Vector3[], r: (t: number) => number, seg = 48, radial = 12): { geo: THREE.BufferGeometry; path: THREE.CatmullRomCurve3 } {
  const path = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(path, seg, 1, radial, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const center = path.getPointAt(i / seg);
    const kk = Math.max(0.004, r(i / seg));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(p, idx).sub(center).multiplyScalar(kk).add(center);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return { geo: g, path };
}

/** Capsule between two points (bone, wing finger, strut) */
function link(k: Kit, parent: THREE.Object3D, color: C, a: V3, b: V3, r: number, o: PO = {}): THREE.Mesh {
  const A = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(A);
  const len = Math.max(0.002, d.length());
  const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
  const m = k.mesh(parent, geo, color, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [0, 0, 0], o);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Thin glowing tube between two points (energy vein, wing vein) */
function glowLink(k: Kit, parent: THREE.Object3D, color: C, a: V3, b: V3, r: number, intensity = 2, opacity = 1): THREE.Mesh {
  const A = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(A);
  const len = Math.max(0.002, d.length());
  const geo = new THREE.CylinderGeometry(r, r, len, 6, 1);
  const m = k.glow(parent, geo, color, intensity, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [0, 0, 0], opacity);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Thin glowing tube along a curve (markings on the flank, energy flow) */
function glowPath(k: Kit, parent: THREE.Object3D, col: C, pts: THREE.Vector3[], r: number, intensity = 2, opacity = 1, seg = 24): THREE.Mesh {
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 6, false);
  return k.glow(parent, geo, col, intensity, [0, 0, 0], [0, 0, 0], opacity);
}

/** Thin plate extruded from a 2D outline (wing membrane, crown, fin), centered on z */
function poly(pts: [number, number][], depth: number, curveSegments = 8): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Lightning-bolt (⚡) plate: extends from 0 to len along +y, width w, thickness along z */
function boltGeo(len: number, w: number, depth = 0.02): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.056, 1], [-0.5, 0.4], [0, 0.4], [-0.056, 0], [0.5, 0.6], [0, 0.6]];
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * w, y * len)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * Rotating glowing ring: the spin group rotates about axis, the inner holder tilts by tilt; beads on the ring make the rotation visible.
 * The ring itself lies in the holder's xy plane (normal z).
 */
function spinRing(
  k: Kit,
  c: Creature,
  parent: THREE.Object3D,
  col: C,
  R: number,
  r: number,
  pos: V3,
  tilt: V3,
  speed: number,
  axis: 'x' | 'y' | 'z',
  o: { beads?: number; beadCol?: C; beadR?: number; intensity?: number; opacity?: number; arc?: number } = {},
): THREE.Group {
  const spin = k.group(parent, pos);
  const holder = k.group(spin, [0, 0, 0], tilt);
  k.glow(holder, new THREE.TorusGeometry(R, r, 8, 56, o.arc ?? PI * 2), col, o.intensity ?? 2.2, [0, 0, 0], [0, 0, 0], o.opacity ?? 0.9);
  const n = o.beads ?? 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * (o.arc ?? PI * 2);
    k.glowSphere(holder, o.beadCol ?? 0xffffff, o.beadR ?? r * 2.4, [Math.cos(a) * R, Math.sin(a) * R, 0], (o.intensity ?? 2.2) + 0.4);
  }
  c.spinners.push({ g: spin, speed, axis });
  return spin;
}

/** Glowing gem / crystal: an elongated octahedron with its bottom at the origin */
function gem(k: Kit, parent: THREE.Object3D, col: C, r: number, h: number, pos: V3, rot: V3 = [0, 0, 0], amt = 0.7): THREE.Mesh {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(r, h / 2, r);
  g.translate(0, h / 2, 0);
  return hard(k, parent, g, col, pos, rot, { emissive: col, emissiveAmt: amt });
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Flat spot stuck on an ellipsoid surface (moss, scales, markings), normal facing outward */
function spot(k: Kit, parent: THREE.Object3D, col: C, center: V3, radii: V3, dir: THREE.Vector3, r: number, o: PO = {}, flat = 0.22): THREE.Mesh {
  const d = dir.clone().normalize();
  const p: V3 = [center[0] + d.x * radii[0] * 1.0, center[1] + d.y * radii[1] * 1.0, center[2] + d.z * radii[2] * 1.0];
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(1, 1, flat);
  const m = k.mesh(parent, g, col, p, [0, 0, 0], { outline: false, ...o });
  // Align the spot's +z normal with the surface normal (ellipsoid gradient)
  const n = v3(d.x / radii[0], d.y / radii[1], d.z / radii[2]).normalize();
  m.quaternion.setFromUnitVectors(v3(0, 0, 1), n);
  return m;
}

/**
 * One leg of a quadruped: hip ball → thigh → knee ball → shin → paw group. The hip is at (sx·x, len, z), and the sole lands at y≈0.
 * Returns the leg group (registered for the walk animation) and the paw group (claws are added by the caller).
 */
function quadLeg(
  k: Kit,
  c: Creature,
  parent: THREE.Object3D,
  sx: number,
  x: number,
  z: number,
  o: { col: C; joint?: C; r: number; len: number; front: boolean; foot?: C; footScale?: V3; bend?: number; footR?: number },
): { g: THREE.Group; foot: THREE.Group } {
  const L = o.len;
  const r = o.r;
  const f = o.front;
  const bend = o.bend ?? 0.28;
  const g = k.group(parent, [sx * x, L, z]);
  k.sphere(g, o.col, r * 1.35, [0, -0.01, 0], [1, 1.15, 1.05]);
  k.capsule(g, o.col, r, L * 0.3, [0, -L * 0.3, f ? 0.01 : -0.05], [f ? -bend * 0.4 : bend, 0, 0]);
  k.sphere(g, o.joint ?? o.col, r * 0.92, [0, -L * 0.56, f ? 0.025 : -0.1]);
  k.capsule(g, o.col, r * 0.8, L * 0.26, [0, -L * 0.78, f ? 0.03 : -0.06], [f ? 0.05 : -bend * 0.55, 0, 0]);
  const fr = o.footR ?? r * 1.2;
  const foot = k.group(g, [0, -L + fr * 0.62, f ? 0.05 : 0.0]);
  k.sphere(foot, o.foot ?? o.col, fr, [0, 0, 0], o.footScale ?? [1.1, 0.6, 1.3]);
  c.legs.push({ g, phase: sx * (f ? 1 : -1) > 0 ? 0 : PI, amp: 1 });
  return { g, foot };
}

/** Low-poly sphere (for small parts that come in large numbers, such as tree canopies, cloud puffs, joints) */
function lowSphere(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PO = {}): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 12, 9);
  g.scale(...scale);
  return k.mesh(parent, g, col, pos, rot, o);
}

/** Low-poly leaf (dozens placed at a time, as foliage or fallen leaves) */
function leaf(k: Kit, parent: THREE.Object3D, col: C, len: number, wid: number, thick: number, pos: V3, rot: V3 = [0, 0, 0], o: PO = {}): THREE.Mesh {
  const g = new THREE.SphereGeometry(0.5, 8, 6);
  g.scale(wid, len, thick);
  g.translate(0, len / 2, 0);
  return k.mesh(parent, g, col, pos, rot, o);
}

/** One feather: a main-color blade + a paler vane edge (no outline) + a point of light at the tip */
function feather(k: Kit, parent: THREE.Object3D, col: C, edge: C, L: number, w: number, pos: V3, rot: V3, tip?: C, o: PO = {}): THREE.Group {
  const g = k.group(parent, pos, rot);
  k.blade(g, col, L, w, 0.045, [0, 0, 0], [0, 0, 0], o);
  k.blade(g, edge, L * 1.05, w * 1.15, 0.028, [0, 0, 0], [0, 0, 0], { outline: false });
  if (tip) k.glowSphere(g, tip, w * 0.14, [0, L * 0.98, 0], 2.4);
  return g;
}

// ───────────────────────── Species ─────────────────────────

const BASE: Record<string, Builder> = {
  pyre_dragoon(k, c, s) {
    const col = 0xff7b3a;
    const belly = 0xffe2ad;
    const eye = { iris: 0xffa51f };
    if (s < 3) {
      const q = quad(k, c, { col, belly, len: s === 1 ? 0.5 : 0.62, r: 0.3, leg: 0.22, headR: s === 1 ? 0.36 : 0.33, headZ: 0.05 });
      k.sphere(q.head, col, 0.2, [0, -0.1, 0.22], [1, 0.7, 1.1]);
      k.eyes(q.head, { x: 0.15, y: 0.06, z: 0.25, r: 0.1, ...eye });
      k.blush(q.head, 0.23, -0.06, 0.2, 0.06);
      for (const sx of [-1, 1]) k.cone(q.head, 0xffd27a, 0.05, 0.16, [sx * 0.14, 0.24, -0.05], [-0.4, 0, -sx * 0.3], 8);
      const tip = tailChain(k, c, q.tail, col, 4, 0.13, 0.14);
      k.flame(tip, 0xff4a12, 0xffe066, s === 1 ? 0.16 : 0.22, [0, 0.05, -0.08], [-0.6, 0, 0]);
      if (s === 2) {
        for (let i = 0; i < 4; i++) k.cone(q.back, 0xc8412a, 0.06, 0.16, [0, 0, 0.25 - i * 0.16], [-0.2, 0, 0], 8);
        k.cone(tip, 0xdfe3f0, 0.05, 0.3, [0, 0, -0.12], [-PI / 2, 0, 0], 4);
      }
    } else {
      const b = biped(k, c, { col, belly, torsoR: 0.3, torsoH: 0.46, leg: 0.2, headR: 0.3, armLen: 0.26, armR: 0.08 });
      k.sphere(b.head, col, 0.18, [0, -0.08, 0.2], [1, 0.72, 1.2]);
      k.eyes(b.head, { x: 0.13, y: 0.05, z: 0.21, r: 0.085, iris: 0xffc02a, sharp: true });
      for (const sx of [-1, 1]) k.horn(b.head, 0xf6e7c8, 0.045, 0.28, 0.12, [sx * 0.13, 0.2, -0.05], [-0.3, 0, -sx * 0.4]);
      // Breastplate
      k.sphere(c.body, 0xdfe3f0, 1, [0, b.torsoY + 0.05, 0.08], [0.27, 0.22, 0.24]);
      k.sphere(c.body, 0xffc23a, 0.05, [0, b.torsoY + 0.08, 0.3], [1, 1, 0.5], [0, 0, 0], { emissive: 0xffa020, emissiveAmt: 0.6 });
      for (const sx of [-1, 1]) wing(k, c, b.back, sx, 0xc8412a, 0.42, 0.22, [0.12, 0.05, 0], { base: 0.9, amp: 0.15, speed: 3, tip: 0xff9a4a });
      const tip = tailChain(k, c, b.tail, col, 4, 0.11, 0.13, 0.6);
      k.flame(tip, 0xff4a12, 0xffe066, 0.18, [0, 0, -0.08], [-0.6, 0, 0]);
      // Flame sword
      const sword = k.group(b.hands[1], [0, 0, 0.05], [PI / 2 + 0.3, 0, 0]);
      k.cyl(sword, 0x5a3a2a, 0.025, 0.025, 0.14, [0, 0, 0]);
      k.cyl(sword, 0xffc23a, 0.02, 0.02, 0.22, [0, 0.08, 0], [0, 0, PI / 2]);
      const bladeGeo = new THREE.BoxGeometry(0.07, 0.62, 0.02);
      bladeGeo.translate(0, 0.4, 0);
      k.glow(sword, bladeGeo, 0xff6a1a, 2.4);
      const core = new THREE.BoxGeometry(0.03, 0.58, 0.025);
      core.translate(0, 0.4, 0);
      k.glow(sword, core, 0xffe890, 3);
    }
  },

  oathsea_sage(k, c, s) {
    const col = 0x5ab3de;
    const belly = 0xf6ecd4;
    const b = biped(k, c, {
      col,
      belly,
      torsoR: s === 1 ? 0.28 : 0.3,
      torsoH: s === 1 ? 0.34 : 0.44,
      leg: 0.12,
      headR: s === 1 ? 0.36 : 0.32,
      armLen: 0.2,
      armR: 0.07,
      hand: 0x3d8fbf,
      foot: 0x3d8fbf,
    });
    k.sphere(b.head, belly, 0.17, [0, -0.1, 0.22], [1.2, 0.8, 0.8], [0, 0, 0], { outline: false });
    k.sphere(b.head, 0x1e2233, 0.05, [0, -0.02, 0.33]);
    k.eyes(b.head, { x: 0.14, y: 0.07, z: 0.24, r: 0.09, iris: 0x1b4f8a });
    k.blush(b.head, 0.22, -0.08, 0.2, 0.05);
    roundEars(k, c, b.head, col, 0xf6c1c9, 0.08, 0.24, 0.2);
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) k.cyl(b.head, 0xffffff, 0.006, 0.006, 0.18, [sx * 0.2, -0.08 - i * 0.03, 0.26], [0, 0, sx * (PI / 2 + 0.15 - i * 0.2)], 4, { outline: false });
    const tail = k.group(b.tail, [0, 0, 0], [0.9, 0, 0]);
    k.sphere(tail, col, 1, [0, 0, -0.12], [0.1, 0.05, 0.22]);
    c.tails.push({ g: tail, phase: 0, amp: 0.3, axis: 'y' });
    if (s === 1) {
      k.sphere(c.body, 0xffc9d6, 0.1, [0, b.torsoY, 0.3], [1, 1, 0.45]);
    }
    if (s >= 2) {
      const ribbon = new THREE.TorusGeometry(0.31, 0.035, 8, 40);
      const m = k.glow(c.body, ribbon, 0x7fe6ff, 1.8, [0, b.torsoY + 0.12, 0], [PI / 2 + 0.2, 0, 0], 0.85);
      c.spinners.push({ g: m, speed: 1.2, axis: 'z' });
    }
    if (s === 3) {
      k.cone(c.body, 0x26467e, 0.4, 0.46, [0, 0.04, 0], [0, 0, 0], 20);
      k.torus(c.body, 0xffcf5a, 0.37, 0.02, [0, 0.06, 0], [PI / 2, 0, 0]);
      k.cone(b.head, 0x26467e, 0.26, 0.42, [0, 0.22, -0.02], [-0.25, 0, 0], 16);
      k.torus(b.head, 0xffcf5a, 0.25, 0.025, [0, 0.24, -0.02], [PI / 2 - 0.25, 0, 0]);
      const staff = k.group(b.hands[1], [0, 0, 0.04], [0.2, 0, 0]);
      k.cyl(staff, 0xe07a5f, 0.025, 0.03, 0.9, [0, 0.25, 0]);
      for (const a of [0, 2.1, 4.2]) k.cone(staff, 0xff9b85, 0.03, 0.14, [Math.cos(a) * 0.05, 0.68, Math.sin(a) * 0.05], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], 6);
      sparkle(k, c, staff, 0x6fe8ff, 0.08, [0, 0.8, 0], 0.03);
    }
  },

  elderwood_warden(k, c, s) {
    const col = 0x8e5b3a;
    const moss = 0x6cc24a;
    if (s < 3) {
      const q = quad(k, c, { col, belly: 0xd9b48c, len: s === 1 ? 0.42 : 0.55, r: s === 1 ? 0.36 : 0.4, leg: 0.2, legR: 0.11, headR: 0.36, headZ: -0.02 });
      k.sphere(q.head, 0xe0c09a, 0.16, [0, -0.1, 0.26], [1.1, 0.8, 0.8]);
      k.sphere(q.head, 0x2a1a14, 0.05, [0, -0.04, 0.38]);
      k.eyes(q.head, { x: 0.14, y: 0.06, z: 0.26, r: 0.085, iris: 0x4a2a14 });
      k.blush(q.head, 0.24, -0.06, 0.2, 0.06);
      roundEars(k, c, q.head, col, 0xd9b48c, 0.11, 0.24, 0.24);
      k.blade(q.head, moss, 0.2, 0.12, 0.03, [0.02, 0.3, 0], [-0.4, 0, 0.3]);
      for (let i = 0; i < (s === 1 ? 3 : 6); i++) {
        const a = i * 1.7;
        k.sphere(q.back, moss, 0.1 + (i % 2) * 0.04, [Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.25], [1, 0.6, 1]);
      }
      if (s === 2) {
        k.sphere(q.back, 0x4fa83a, 0.2, [0, 0.12, -0.05], [1.2, 0.9, 1.2]);
        k.sphere(q.back, 0x7fd65a, 0.14, [0.08, 0.26, 0.05]);
        sparkle(k, c, q.back, 0xfff6a0, 0.03, [0.15, 0.35, 0]);
      }
      k.sphere(q.tail, col, 0.1, [0, 0.02, 0]);
    } else {
      const b = biped(k, c, { col, belly: 0xd9b48c, torsoR: 0.4, torsoH: 0.5, leg: 0.18, legR: 0.13, headR: 0.3, armLen: 0.3, armR: 0.11 });
      k.sphere(b.head, 0xe0c09a, 0.14, [0, -0.08, 0.22], [1.1, 0.8, 0.8]);
      k.sphere(b.head, 0x2a1a14, 0.045, [0, -0.03, 0.33]);
      k.eyes(b.head, { x: 0.12, y: 0.05, z: 0.22, r: 0.075, iris: 0x3a7a2a });
      roundEars(k, c, b.head, col, 0xd9b48c, 0.09, 0.2, 0.2);
      for (let i = 0; i < 5; i++) k.sphere(c.body, moss, 0.09, [Math.cos(i * 1.3) * 0.32, b.torsoY + 0.1 + (i % 3) * 0.08, Math.sin(i * 1.3) * 0.2], [1, 0.5, 1]);
      const tree = k.group(b.back, [0, 0, -0.05]);
      k.cyl(tree, 0x6b4428, 0.07, 0.1, 0.7, [0, 0.35, 0]);
      for (const [x, y, z, r] of [[0, 0.85, 0, 0.26], [0.18, 0.72, 0.05, 0.18], [-0.18, 0.74, -0.03, 0.2], [0.05, 1.02, 0, 0.16]] as [number, number, number, number][]) k.sphere(tree, moss, r, [x, y, z]);
      for (let i = 0; i < 4; i++) sparkle(k, c, tree, 0xfff6a0, 0.025, [Math.cos(i * 1.6) * 0.3, 0.8 + (i % 2) * 0.2, Math.sin(i * 1.6) * 0.2]);
      const shield = k.group(b.hands[0], [0, 0.05, 0.08]);
      k.cyl(shield, 0x7a4f2e, 0.24, 0.24, 0.06, [0, 0, 0], [PI / 2, 0, 0], 20);
      k.torus(shield, 0x5a3a20, 0.22, 0.025, [0, 0, 0.035]);
      k.sphere(shield, moss, 0.07, [0, 0, 0.05], [1, 1, 0.4], [0, 0, 0], { emissive: 0x6cff4a, emissiveAmt: 0.5 });
    }
  },

  pyrewing(k, c, s) {
    if (s === 1) {
      c.archetype = 'crawl';
      for (let i = 0; i < 5; i++) {
        const g = k.group(c.body, [0, 0.14 + (i === 0 ? 0.08 : 0), 0.3 - i * 0.15]);
        k.sphere(g, i % 2 ? 0xffe0b0 : 0xffb070, i === 0 ? 0.2 : 0.14 - i * 0.008);
        c.bobbers.push({ g, base: g.position.y, amp: 0.02, speed: 6, phase: i * 0.8 });
        if (i === 0) {
          c.head = g;
          k.eyes(g, { x: 0.09, y: 0.04, z: 0.15, r: 0.065, iris: 0xff8a1a });
          k.blush(g, 0.14, -0.04, 0.12, 0.04);
          k.cyl(g, 0x3a2a2a, 0.012, 0.012, 0.12, [0, 0.24, 0]);
          k.flame(g, 0xff6a1a, 0xffe890, 0.08, [0, 0.3, 0]);
        }
      }
      return;
    }
    const b = bird(k, c, { col: 0xffd9a0, belly: 0xfff0d8, wingCol: 0xff8a3a, beak: 0xffd9a0, r: 0.24, headR: 0.22, wingLen: s === 2 ? 0.55 : 0.7 });
    c.wings.forEach((w) => ((w.speed = 11), (w.amp = 0.35)));
    k.eyes(b.head, { x: 0.1, y: 0.04, z: 0.16, r: 0.075, iris: 0xff5a1a, glow: s === 3 });
    for (const sx of [-1, 1]) {
      const ant = k.group(b.head, [sx * 0.08, 0.18, 0.05], [-0.3, 0, -sx * 0.4]);
      k.cyl(ant, 0x5a3a2a, 0.01, 0.012, 0.22, [0, 0.11, 0]);
      k.glowSphere(ant, 0xffc040, 0.035, [0, 0.23, 0], 2.8);
    }
    for (const w of c.wings) {
      for (let i = 0; i < 2; i++) k.glowSphere(w.g, i ? 0xffe060 : 0xff5a1a, 0.05, [0, 0.2 + i * 0.18, 0.03], 2.4);
    }
    if (s === 3) {
      k.torus(b.head, 0xffcf40, 0.12, 0.02, [0, 0.2, 0], [PI / 2, 0, 0]);
      for (let i = 0; i < 5; i++) k.cone(b.head, 0xffcf40, 0.025, 0.08, [Math.cos(i * 1.256) * 0.12, 0.2, Math.sin(i * 1.256) * 0.12], [0, 0, 0], 6);
      for (const w of c.wings) k.flame(w.g, 0xff4a12, 0xffe066, 0.1, [0, 0.62, -0.05]);
    }
  },

  icecrown(k, c, s) {
    const navy = 0x2b3d6e;
    const col = s === 1 ? 0xdce4f2 : navy;
    const b = biped(k, c, {
      col,
      belly: 0xffffff,
      torsoR: s === 1 ? 0.36 : 0.34,
      torsoH: s === 1 ? 0.4 : 0.56,
      leg: 0.08,
      legR: 0.08,
      headR: s === 1 ? 0.3 : 0.26,
      armLen: 0.2,
      armR: 0.06,
      foot: 0xffa640,
      hand: col,
    });
    for (const a of c.arms) a.base.z = a.side * 0.6;
    k.cone(b.head, 0xffa640, 0.06, 0.14, [0, -0.04, 0.26], [PI / 2, 0, 0], 10);
    k.sphere(b.head, 0xffffff, 0.2, [0, -0.02, 0.1], [1.1, 0.9, 0.7], [0, 0, 0], { outline: false });
    k.eyes(b.head, { x: 0.11, y: 0.06, z: 0.2, r: 0.075, iris: 0x2a6ad8 });
    k.blush(b.head, 0.18, -0.06, 0.16, 0.045);
    if (s === 1) {
      for (let i = 0; i < 6; i++) k.sphere(b.head, 0xeef2fa, 0.07, [Math.cos(i) * 0.14, 0.22, Math.sin(i) * 0.1]);
    }
    if (s === 2) {
      for (let i = 0; i < 3; i++) k.cone(b.head, 0x8fe6ff, 0.04, 0.18, [0, 0.2, -0.05 - i * 0.06], [-0.5 - i * 0.2, 0, 0], 6, { emissive: 0x6fdcff, emissiveAmt: 0.5 });
    }
    if (s === 3) {
      for (const sx of [-1, 1]) k.sphere(b.head, 0xffc93a, 0.07, [sx * 0.18, -0.1, 0.05], [0.6, 1.2, 0.8], [0, 0, 0], { outline: false });
      const crown = k.group(b.head, [0, 0.2, 0]);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        const geo = new THREE.OctahedronGeometry(0.06);
        geo.scale(0.6, 2.2, 0.6);
        k.glow(crown, geo, 0x9ff0ff, 2.2, [Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15]);
      }
      c.spinners.push({ g: crown, speed: 0.6, axis: 'y' });
    }
  },

  dreamcap(k, c, s) {
    c.archetype = 'float';
    c.hover = 0.02;
    const cap = 0xb25ad9;
    const stem = 0xf6ecd8;
    const scale = s === 1 ? 0.8 : 1;
    k.cyl(c.body, stem, 0.2 * scale, 0.24 * scale, 0.36 * scale, [0, 0.18 * scale, 0], [0, 0, 0], 20);
    const head = k.group(c.body, [0, 0.36 * scale, 0]);
    c.head = head;
    k.lathe(head, cap, [[0.001, 0.28 * scale], [0.2 * scale, 0.26 * scale], [0.36 * scale, 0.14 * scale], [0.42 * scale, 0], [0.3 * scale, -0.02 * scale], [0.001, -0.02 * scale]]);
    k.eyes(c.body, { x: 0.08, y: 0.24 * scale, z: 0.19 * scale, r: 0.06, iris: 0x7a2ab0 });
    c.head = head;
    k.blush(c.body, 0.14, 0.18 * scale, 0.17 * scale, 0.04);
    const spots = s === 1 ? 4 : 7;
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * PI * 2;
      const r = 0.25 * scale;
      if (s === 1) k.sphere(head, 0xfff0ff, 0.05 * scale, [Math.cos(a) * r, 0.16 * scale, Math.sin(a) * r], [1, 0.5, 1], [0, 0, 0], { outline: false });
      else k.glowSphere(head, 0xffb8ff, 0.05 * scale, [Math.cos(a) * r, 0.16 * scale, Math.sin(a) * r], 2.2, [1, 0.5, 1]);
    }
    if (s >= 2) for (let i = 0; i < 4; i++) sparkle(k, c, c.body, 0xe8a0ff, 0.022, [Math.cos(i * 1.7) * 0.4, 0.5 + i * 0.1, Math.sin(i * 1.7) * 0.3], 0.1);
    if (s === 3) {
      const veil = k.lathe(c.body, 0xf2d8ff, [[0.22, 0.34], [0.3, 0.2], [0.34, 0.02], [0.3, 0]]);
      (veil.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.9;
      k.glowSphere(head, 0xffe8ff, 0.08, [0, 0.3, 0], 2.8);
      for (const sx of [-1, 1]) k.capsule(c.body, stem, 0.05, 0.16, [sx * 0.24, 0.2, 0.05], [0, 0, sx * 0.7]);
    }
  },

  skyreign(k, c, s) {
    const cols = [0x8fd3ff, 0x5aa6e6, 0x3a7fd0][s - 1];
    const b = bird(k, c, { col: cols, belly: 0xffffff, wingCol: s === 3 ? 0x2d64b0 : cols, beak: 0xffc040, r: s === 1 ? 0.38 : 0.32, headR: s === 1 ? 0.28 : 0.24, wingLen: [0.35, 0.55, 0.75][s - 1] });
    k.eyes(b.head, { x: 0.11, y: 0.05, z: 0.18, r: s === 1 ? 0.085 : 0.07, iris: 0x1a3a7a, sharp: s === 3 });
    if (s === 1) k.blush(b.head, 0.19, -0.05, 0.16, 0.045);
    const crest = s === 1 ? 1 : 3;
    for (let i = 0; i < crest; i++) k.blade(b.head, s === 3 ? 0xffd040 : cols, 0.18 + i * 0.04, 0.07, 0.03, [0, 0.2, -0.04 - i * 0.05], [-0.6 - i * 0.25, 0, 0]);
    if (s === 3) for (const w of c.wings) k.blade(w.g, 0xffffff, 0.3, 0.12, 0.04, [0, 0.45, 0.04], [0.1, 0, 0]);
  },

  monolith(k, c, s) {
    const rock = 0x9d928a;
    const dark = 0x6d645e;
    if (s === 1) {
      c.archetype = 'float';
      c.hover = 0;
      const g = new THREE.IcosahedronGeometry(0.3, 1);
      g.scale(1.1, 0.9, 1);
      k.mesh(c.body, g, rock, [0, 0.3, 0]);
      c.head = k.group(c.body, [0, 0.3, 0]);
      k.eyes(c.head, { x: 0.1, y: 0.05, z: 0.25, r: 0.06, iris: 0x4a3a2a });
      k.blush(c.head, 0.17, -0.04, 0.24, 0.04);
      for (const sx of [-1, 1]) {
        const g2 = k.group(c.body, [sx * 0.14, 0.06, 0.05]);
        k.sphere(g2, dark, 0.07, [0, 0, 0.03], [1, 0.6, 1.3]);
        c.legs.push({ g: g2, phase: sx > 0 ? 0 : PI, amp: 0.6 });
      }
      k.sphere(c.body, 0x7ac25a, 0.06, [0.05, 0.56, 0], [1.4, 0.5, 1.2]);
      return;
    }
    const b = biped(k, c, { col: rock, torsoR: s === 2 ? 0.36 : 0.42, torsoH: s === 2 ? 0.46 : 0.56, leg: 0.16, legR: 0.13, headR: 0.2, armLen: 0.3, armR: 0.12, hand: dark, foot: dark });
    k.eyes(b.head, { x: 0.08, y: 0.03, z: 0.15, r: 0.055, iris: s === 3 ? 0xffb347 : 0x4a3a2a, glow: s === 3 });
    for (const sx of [-1, 1]) k.sphere(c.body, dark, 0.16, [sx * 0.34, b.torsoY + 0.15, 0], [1, 0.8, 1]);
    k.sphere(c.body, 0x7ac25a, 0.1, [0.1, b.torsoY + 0.3, -0.1], [1.4, 0.5, 1.2]);
    if (s === 3) {
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.BoxGeometry(0.04, 0.16, 0.01);
        k.glow(c.body, geo, 0xffb347, 2.4, [-0.1 + i * 0.1, b.torsoY + 0.05, 0.37], [0, 0, (i - 1) * 0.4]);
      }
      for (let i = 0; i < 4; i++) {
        const g = new THREE.DodecahedronGeometry(0.07);
        const m = k.mesh(c.body, g, dark, [Math.cos(i * 1.57) * 0.6, b.torsoY + 0.4, Math.sin(i * 1.57) * 0.4]);
        c.bobbers.push({ g: m, base: m.position.y, amp: 0.06, speed: 1.5, phase: i });
      }
    }
  },

  cloudfluff(k, c, s) {
    floater(c, 0.15);
    const col = 0xfdf7ff;
    const r = [0.32, 0.36, 0.34][s - 1];
    k.sphere(c.body, col, r, [0, 0.35, 0]);
    const puffs = s === 1 ? 4 : s === 2 ? 7 : 10;
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * PI * 2;
      k.sphere(c.body, i % 2 ? 0xf3ecff : col, r * 0.45, [Math.cos(a) * r * 0.85, 0.35 + Math.sin(i * 2.3) * r * 0.4, Math.sin(a) * r * 0.7]);
    }
    c.head = k.group(c.body, [0, 0.38, 0]);
    k.eyes(c.head, { x: 0.1, y: 0.02, z: r * 0.88, r: 0.07, iris: 0x7a6ad8 });
    k.blush(c.head, 0.17, -0.06, r * 0.85, 0.05);
    ears(k, c, c.head, col, 0xffc8e0, 0.07, 0.14, 0.14, r * 0.75, 0.3);
    if (s === 3) {
      halo(k, c, c.body, 0xfff2a0, 0.2, [0, 0.35 + r + 0.12, 0]);
      for (const sx of [-1, 1]) wing(k, c, c.body, sx, 0xffffff, 0.22, 0.12, [r * 0.8, 0.45, -0.05], { base: 1.3, amp: 0.3, speed: 5, feathers: 2 });
    }
  },

  stormram(k, c, s) {
    const wool = 0xfff5d8;
    const face = 0x4b4a6e;
    const q = quad(k, c, { col: face, len: 0.46, r: 0.3, leg: 0.24, legR: 0.06, headR: 0.2, headZ: 0.06 });
    const y = q.bodyY;
    const n = s === 1 ? 7 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      k.sphere(c.body, wool, 0.2 + (i % 3) * 0.03, [Math.cos(a) * 0.24, y + Math.sin(i * 1.9) * 0.1 + 0.05, Math.sin(a) * 0.35]);
    }
    k.sphere(c.body, wool, 0.3, [0, y + 0.12, 0]);
    k.sphere(q.head, wool, 0.16, [0, 0.14, -0.04]);
    k.eyes(q.head, { x: 0.09, y: 0.02, z: 0.15, r: 0.06, iris: 0xffd21a, glow: s === 3 });
    k.blush(q.head, 0.14, -0.06, 0.13, 0.035);
    for (const sx of [-1, 1]) {
      const g = k.group(q.head, [sx * 0.18, 0.02, 0], [0, 0, -sx * 1.2]);
      k.sphere(g, face, 0.08, [0, 0.04, 0], [0.6, 1.2, 0.4]);
      c.ears.push({ g, phase: sx });
    }
    if (s >= 2) {
      for (const sx of [-1, 1]) {
        const arc = s === 3 ? PI * 1.4 : PI * 0.9;
        const R = s === 3 ? 0.12 : 0.08;
        k.torus(q.head, s === 3 ? 0xffcf3a : 0xd8c8a0, R, 0.035, [sx * 0.14, 0.1, -0.06], [0, sx * PI / 2, PI / 2], arc);
      }
    }
    const sparks = s === 1 ? 3 : 6;
    for (let i = 0; i < sparks; i++) {
      const g = new THREE.OctahedronGeometry(0.035);
      g.scale(0.5, 1.8, 0.5);
      const m = k.glow(c.body, g, 0xfff066, 2.8, [Math.cos(i * 2.1) * 0.35, y + 0.3 + (i % 2) * 0.08, Math.sin(i * 2.1) * 0.4], [0, 0, i]);
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.05, speed: 6, phase: i });
    }
    k.sphere(q.tail, wool, 0.08);
  },

  eclipse_batlord(k, c, s) {
    const col = 0x3b2b5e;
    const mem = 0x6c4ca8;
    floater(c, 0.45);
    const r = s === 1 ? 0.3 : 0.26;
    k.sphere(c.body, col, r, [0, 0.4, 0], [1, 1.05, 0.95]);
    c.head = k.group(c.body, [0, 0.4 + (s === 1 ? 0 : r * 0.9), s === 1 ? 0 : 0.04]);
    if (s > 1) k.sphere(c.head, col, 0.22);
    const hr = s === 1 ? r : 0.22;
    k.eyes(c.head, { x: 0.1, y: 0.04, z: hr * 0.85, r: 0.07, iris: s === 3 ? 0xff3a5a : 0xd8b0ff, glow: s === 3, sharp: s === 3 });
    if (s === 1) k.blush(c.head, 0.17, -0.05, hr * 0.8, 0.045);
    ears(k, c, c.head, col, 0xb07ae0, 0.08, 0.2, 0.12, hr * 0.7, 0.25);
    for (const sx of [-1, 1]) wing(k, c, c.body, sx, mem, [0.4, 0.55, 0.7][s - 1], 0.3, [r * 0.85, 0.45, 0], { base: 1.25, amp: 0.55, speed: 10, feathers: 3, tip: col });
    k.cone(c.head, 0xffffff, 0.02, 0.05, [0.04, -0.1, hr * 0.85], [PI, 0, 0], 6, { outline: false });
    if (s === 3) {
      k.lathe(c.body, 0x5a1a3a, [[0.12, 0.62], [0.28, 0.4], [0.36, 0.05], [0.001, 0.05]], [0, -0.02, -0.06]);
      k.torus(c.head, 0xffcf40, 0.12, 0.02, [0, 0.18, 0], [PI / 2, 0, 0]);
      for (let i = 0; i < 5; i++) k.cone(c.head, 0xffcf40, 0.022, 0.08, [Math.cos(i * 1.256) * 0.12, 0.18, Math.sin(i * 1.256) * 0.12], [0, 0, 0], 6);
      const ring = new THREE.RingGeometry(0.42, 0.5, 48);
      const m = k.glow(c.body, ring, 0xb06aff, 1.8, [0, 0.7, -0.35], [0, 0, 0], 0.8);
      (m.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
      c.spinners.push({ g: m, speed: 0.4, axis: 'z' });
    }
  },

  gale_weasel(k, c, s) {
    const col = 0xeaf6f1;
    const acc = 0x4fcfb4;
    const q = quad(k, c, { col, belly: 0xffffff, len: 0.62, r: 0.22, leg: 0.2, legR: 0.055, headR: 0.24, neck: 0.1, headZ: 0.05, paw: acc });
    k.sphere(q.head, col, 0.13, [0, -0.06, 0.18], [0.9, 0.7, 1.2]);
    k.sphere(q.head, 0x20242e, 0.035, [0, -0.02, 0.33]);
    k.eyes(q.head, { x: 0.1, y: 0.05, z: 0.17, r: 0.065, iris: 0x1a8a7a, sharp: true });
    ears(k, c, q.head, col, acc, 0.07, 0.14, 0.13, 0.17, 0.35);
    for (const sx of [-1, 1]) k.sphere(q.head, acc, 0.05, [sx * 0.13, 0.12, 0.12], [1, 0.4, 1], [0, 0, 0], { outline: false });
    const tip = tailChain(k, c, q.tail, col, 5, 0.1, 0.12, -0.2);
    const bladeCol = 0xcff8ff;
    k.horn(tip, bladeCol, 0.05, 0.4, 0.2, [0, 0, -0.05], [-PI / 2 - 0.4, 0, 0], { emissive: 0x6ff0ff, emissiveAmt: 0.6 });
    for (const l of c.legs.slice(2)) k.horn(l.g, bladeCol, 0.035, 0.26, 0.14, [0, -0.1, 0.05], [0.6, 0, 0], { emissive: 0x6ff0ff, emissiveAmt: 0.6 });
    for (let i = 0; i < s; i++) {
      const ring = new THREE.TorusGeometry(0.45 + i * 0.12, 0.012, 6, 40, PI * 1.3);
      const m = k.glow(c.body, ring, 0x8ff5e0, 2.2, [0, q.bodyY, 0], [PI / 2, 0, i * 2], 0.7);
      c.spinners.push({ g: m, speed: 2.5 + i, axis: 'z' });
    }
  },

  sand_reaper(k, c, s) {
    c.archetype = 'crawl';
    const col = 0xd9a45a;
    const dark = 0x8a5a2a;
    const y = 0.2;
    k.sphere(c.body, col, 1, [0, y, 0.05], [0.3, 0.16, 0.38]);
    c.head = k.group(c.body, [0, y + 0.06, 0.34]);
    k.sphere(c.head, col, 0.16, [0, 0, 0], [1.2, 0.8, 0.9]);
    k.eyes(c.head, { x: 0.07, y: 0.07, z: 0.1, r: 0.05, iris: 0xffb020, glow: s >= 2, sharp: true });
    for (const sx of [-1, 1]) {
      const arm = k.group(c.body, [sx * 0.2, y, 0.3], [0, sx * -0.5, 0]);
      k.capsule(arm, dark, 0.05, 0.2, [0, 0, 0.14], [PI / 2, 0, 0]);
      const claw = k.group(arm, [0, 0.02, 0.32]);
      k.sphere(claw, col, 0.1, [0, 0, 0], [0.9, 0.7, 1.2]);
      k.horn(claw, dark, 0.035, 0.2, 0.08, [0.04, 0, 0.08], [PI / 2, 0, 0.2]);
      k.horn(claw, dark, 0.03, 0.16, 0.06, [-0.04, 0, 0.08], [PI / 2, 0, -0.2]);
      c.arms.push({ g: arm, side: sx, base: new THREE.Euler(0, sx * -0.5, 0) });
      for (let i = 0; i < 3; i++) {
        const g = k.group(c.body, [sx * 0.24, y, 0.1 - i * 0.14], [0, 0, sx * 0.9]);
        k.capsule(g, dark, 0.03, 0.16, [0, -0.1, 0]);
        c.legs.push({ g, phase: i * 1.2 + (sx > 0 ? PI : 0), amp: 0.5 });
      }
    }
    let g = k.group(c.body, [0, y + 0.05, -0.3], [0.9, 0, 0]);
    c.tails.push({ g, phase: 0, amp: 0.1, axis: 'x' });
    for (let i = 0; i < 5; i++) {
      k.sphere(g, i % 2 ? col : dark, 0.1 - i * 0.008, [0, 0, 0]);
      g = k.group(g, [0, 0.12, 0], [-0.45, 0, 0]);
    }
    k.horn(g, 0x5a3a1a, 0.05, 0.2, 0.1, [0, 0, 0], [-0.5, 0, 0]);
    k.glowSphere(g, 0xffb030, 0.05, [0, 0.05, 0.02], 2.6);
    if (s === 3) for (let i = 0; i < 3; i++) k.cone(c.body, 0xffd070, 0.04, 0.1, [0, y + 0.14, 0.1 - i * 0.15], [-0.3, 0, 0], 6, { emissive: 0xffa020, emissiveAmt: 0.6 });
  },

  magma_golem(k, c, s) {
    const rock = 0x4a3838;
    const lava = 0xff5a1a;
    const b = biped(k, c, { col: rock, torsoR: 0.42, torsoH: 0.52, leg: 0.18, legR: 0.13, headR: 0.18, armLen: 0.3, armR: 0.13, hand: 0x3a2a2a, foot: 0x3a2a2a });
    k.eyes(b.head, { x: 0.07, y: 0.02, z: 0.14, r: 0.05, iris: 0xffc040, glow: true, sharp: true });
    for (const sx of [-1, 1]) {
      const g = new THREE.DodecahedronGeometry(0.2);
      k.mesh(c.body, g, 0x5a4444, [sx * 0.4, b.torsoY + 0.2, 0]);
    }
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BoxGeometry(0.03, 0.2 + (i % 3) * 0.06, 0.02);
      k.glow(c.body, geo, lava, 2.4 + s * 0.2, [Math.cos(i * 1.1) * 0.25, b.torsoY + Math.sin(i * 2.3) * 0.15, 0.38 - Math.abs(Math.cos(i * 1.1)) * 0.1], [0, Math.cos(i * 1.1) * 0.6, i * 0.7]);
    }
    k.glowSphere(c.body, 0xff7a2a, 0.1, [0, b.torsoY, 0.36], 2.8, [1, 1, 0.4]);
    k.flame(b.head, lava, 0xffe066, 0.1 + s * 0.02, [0, 0.14, 0]);
  },

  chime_sprite(k, c, s) {
    floater(c, 0.3);
    const gold = 0xfff0b8;
    k.lathe(c.body, gold, [[0.001, 0.52], [0.1, 0.5], [0.16, 0.38], [0.22, 0.18], [0.3, 0.02], [0.28, 0], [0.001, 0.02]], [0, 0, 0]);
    k.glowSphere(c.body, 0xfff6c0, 0.07, [0, -0.02, 0], 2.8);
    c.head = k.group(c.body, [0, 0.62, 0]);
    k.sphere(c.head, 0xfff8ec, 0.2);
    k.eyes(c.head, { x: 0.075, y: 0.01, z: 0.16, r: 0.055, iris: 0xe0a020 });
    k.blush(c.head, 0.12, -0.05, 0.15, 0.035);
    k.sphere(c.head, 0xffe07a, 0.2, [0, 0.07, -0.03], [1.05, 0.7, 1.05]);
    halo(k, c, c.head, 0xfff0a0, 0.14, [0, 0.26, 0]);
    for (const sx of [-1, 1]) {
      const g = wing(k, c, c.body, sx, 0xc8f0ff, 0.3, 0.16, [0.1, 0.5, -0.08], { base: 1.0, amp: 0.4, speed: 14, feathers: 2 });
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
        if (m && m.uniforms?.uEmissive) {
          m.uniforms.uEmissive.value.set(0x9fe8ff);
          m.uniforms.uEmissiveAmt.value = 0.4;
        }
      });
    }
    for (let i = 0; i < s + 1; i++) sparkle(k, c, c.body, 0xfff4a0, 0.025, [Math.cos(i * 2) * 0.35, 0.3 + i * 0.15, Math.sin(i * 2) * 0.3], 0.08);
  },

  soul_lantern(k, c, s) {
    floater(c, 0.35);
    const hood = 0x2a3058;
    k.lathe(c.body, hood, [[0.001, 0.72], [0.14, 0.68], [0.24, 0.5], [0.3, 0.2], [0.34, 0.0], [0.2, -0.08], [0.001, -0.1]]);
    c.head = k.group(c.body, [0, 0.5, 0.12]);
    k.sphere(c.head, 0x0e0f1e, 0.17, [0, 0, 0], [1, 0.9, 0.6], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) k.glowSphere(c.head, 0x7fe0ff, 0.04, [sx * 0.07, 0.01, 0.08], 3, [1, 1.3, 0.5]);
    c.eyes.push(c.head);
    const arm = k.group(c.body, [0.26, 0.3, 0.1], [0, 0, -0.5]);
    k.capsule(arm, hood, 0.05, 0.16, [0, -0.1, 0]);
    const lantern = k.group(arm, [0, -0.26, 0.04], [0, 0, 0.5]);
    k.cyl(lantern, 0x3a3a4a, 0.004, 0.004, 0.14, [0, 0.04, 0]);
    k.cyl(lantern, 0xc8b070, 0.07, 0.09, 0.03, [0, -0.04, 0]);
    k.cyl(lantern, 0xc8b070, 0.09, 0.07, 0.03, [0, -0.2, 0]);
    k.glowSphere(lantern, 0x6fd6ff, 0.07, [0, -0.12, 0], 2.8, [1, 1.3, 1]);
    k.flame(lantern, 0x4fb6ff, 0xd8f6ff, 0.05, [0, -0.15, 0]);
    c.arms.push({ g: arm, side: 1, base: new THREE.Euler(0, 0, -0.5) });
    for (let i = 0; i < 2 + s; i++) sparkle(k, c, c.body, 0x8fd8ff, 0.025, [Math.cos(i * 2.4) * 0.4, 0.1 + i * 0.12, Math.sin(i * 2.4) * 0.3], 0.1);
    if (s === 3) halo(k, c, c.body, 0x6fb6ff, 0.36, [0, 0.35, -0.15], [0, 0, 0]);
  },

  relic_blade(k, c, s) {
    floater(c, 0.3);
    const blade = k.group(c.body, [0, 0.55, 0], [0, 0, 0.15]);
    c.head = blade;
    const bg = new THREE.BoxGeometry(0.14, 0.9, 0.035);
    bg.translate(0, -0.3, 0);
    k.mesh(blade, bg, 0xdfe6ff, [0, 0, 0]);
    k.cone(blade, 0xdfe6ff, 0.1, 0.16, [0, -0.75, 0], [PI, 0, 0], 4);
    const edge = new THREE.BoxGeometry(0.03, 0.85, 0.04);
    edge.translate(0, -0.3, 0);
    k.glow(blade, edge, 0x8fd0ff, 1.6 + s * 0.3);
    k.cyl(blade, 0xffc94a, 0.04, 0.04, 0.42, [0, 0.18, 0], [0, 0, PI / 2]);
    for (const sx of [-1, 1]) k.sphere(blade, 0xffc94a, 0.06, [sx * 0.22, 0.18, 0]);
    k.cyl(blade, 0x3a2a4a, 0.035, 0.035, 0.22, [0, 0.33, 0]);
    k.glowSphere(blade, 0x7fb0ff, 0.06, [0, 0.48, 0], 2.8);
    k.eyes(blade, { x: 0.06, y: 0.07, z: 0.03, r: 0.04, iris: 0x4f8aff, glow: true, sharp: true, yaw: 0.1 });
    for (let i = 0; i < s; i++) {
      const ring = new THREE.TorusGeometry(0.36 + i * 0.1, 0.01, 6, 48);
      const m = k.glow(c.body, ring, 0x9fd0ff, 2, [0, 0.35, 0], [PI / 2 + 0.3 * i, 0, 0], 0.8);
      c.spinners.push({ g: m, speed: 1.2 + i * 0.6, axis: 'z' });
    }
  },

  grimoire(k, c, s) {
    floater(c, 0.35);
    const book = k.group(c.body, [0, 0.45, 0], [-0.35, 0, 0]);
    c.head = book;
    for (const sx of [-1, 1]) {
      const cover = new THREE.BoxGeometry(0.34, 0.03, 0.44);
      cover.translate(sx * 0.17, 0, 0);
      k.mesh(book, cover, 0x6b3aa8, [0, 0, 0], [0, 0, sx * -0.25]);
      k.sphere(book, 0xffc94a, 0.035, [sx * 0.3, -0.02, 0.19]);
      k.sphere(book, 0xffc94a, 0.035, [sx * 0.3, -0.02, -0.19]);
    }
    const pages = new THREE.BoxGeometry(0.58, 0.08, 0.4);
    k.mesh(book, pages, 0xfff8e6, [0, 0.07, 0]);
    k.eyes(book, { x: 0.1, y: 0.13, z: 0.1, r: 0.055, iris: 0x8a4ad8, yaw: 0 });
    for (const e of c.eyes) e.rotation.x = -PI / 2 + 0.35;
    const runes = k.group(c.body, [0, 0.55, 0]);
    for (let i = 0; i < 4 + s; i++) {
      const a = (i / (4 + s)) * PI * 2;
      const g = new THREE.PlaneGeometry(0.07, 0.07);
      const m = k.glow(runes, g, i % 2 ? 0xc49aff : 0x9ae0ff, 2.6, [Math.cos(a) * 0.42, Math.sin(i * 1.3) * 0.1, Math.sin(a) * 0.42], [0, -a, PI / 4]);
      (m.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    }
    c.spinners.push({ g: runes, speed: 0.9, axis: 'y' });
    if (s === 3) halo(k, c, c.body, 0xc49aff, 0.3, [0, 0.2, 0]);
  },

  /** `ignisar`: a golden-maned lion king, with a mane of flames that have burned a thousand years and a spinning corona, a gold crown with a ruby, the fire source crystal on the chest, pulsing magma cracks along the flanks */
  ignisar(k, c, s) {
    const fur = 0xf2a53a;
    const furDk = 0xd98a2a;
    const cream = 0xffe6b8;
    const maneC = 0xd8601a;
    const maneDk = 0xb8401a;
    const gold = 0xffd24a;
    const goldDk = 0xd9a030;
    const dark = 0x3a2016;
    const fire = 0xff5a1a;
    const fireHi = 0xff8a1a;
    const core = 0xffe066;
    const magma = 0xff7a20;
    c.archetype = 'quad';
    const L = 0.44;
    const by = 0.62;

    // Body: thick chest, narrow waist, strong hindquarters; cream belly
    k.sphere(c.body, fur, 1, [0, by + 0.04, 0.16], [0.31, 0.3, 0.34]);
    k.sphere(c.body, fur, 1, [0, by - 0.02, -0.1], [0.25, 0.24, 0.28]);
    k.sphere(c.body, fur, 1, [0, by, -0.3], [0.27, 0.26, 0.27]);
    k.sphere(c.body, cream, 1, [0, by - 0.14, 0.02], [0.24, 0.15, 0.42], [0, 0, 0], { outline: false });
    // A row of small flames along the spine, smaller toward the back
    for (let i = 0; i < 4; i++) k.flame(c.body, fireHi, core, 0.11 - i * 0.015, [0, by + 0.3 - i * 0.02, -0.04 - i * 0.13], [-0.55, 0, 0]);
    // Magma cracks on the flanks (shoulder and haunch), a point of light where they meet, the earth veins pulsing with the roar
    for (const sx of [-1, 1]) {
      glowPath(k, c.body, magma, [v3(sx * 0.31, by + 0.14, 0.24), v3(sx * 0.335, by + 0.03, 0.17), v3(sx * 0.325, by - 0.05, 0.25), v3(sx * 0.3, by - 0.14, 0.16)], 0.007, 2, 0.95, 24);
      glowPath(k, c.body, magma, [v3(sx * 0.27, by + 0.13, -0.24), v3(sx * 0.29, by + 0.02, -0.32), v3(sx * 0.275, by - 0.06, -0.22), v3(sx * 0.26, by - 0.13, -0.34)], 0.007, 2, 0.95, 24);
      k.glowSphere(c.body, core, 0.014, [sx * 0.335, by + 0.03, 0.17], 2.4);
      k.glowSphere(c.body, core, 0.012, [sx * 0.29, by + 0.02, -0.32], 2.4);
    }
    // Fire source crystal on the chest: a gold frame, a ruby-faceted crystal, a ring of fire turning slowly
    const brooch = k.group(c.body, [0, by - 0.01, 0.47], [-0.35, 0, 0]);
    k.torus(brooch, gold, 0.065, 0.014, [0, 0, 0]);
    k.cyl(brooch, goldDk, 0.052, 0.052, 0.02, [0, 0, -0.005], [PI / 2, 0, 0], 16);
    gem(k, brooch, 0xff4a2a, 0.042, 0.075, [0, 0, 0], [PI / 2, 0, 0], 0.85);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      k.sphere(brooch, gold, 0.013, [Math.cos(a) * 0.078, Math.sin(a) * 0.078, 0.005]);
    }
    spinRing(k, c, brooch, fireHi, 0.1, 0.005, [0, 0, 0.02], [0, 0, 0], 1.1, 'z', { beads: 3, beadCol: core, beadR: 0.012, opacity: 0.8 });

    // Limbs: sturdy lion legs, dark claws; gold bracers on the forelegs, and after breakthrough the ankles catch fire
    for (const sx of [-1, 1]) {
      const fl = quadLeg(k, c, c.body, sx, 0.21, 0.2, { col: fur, joint: furDk, r: 0.08, len: L, front: true });
      k.blade(fl.g, maneC, 0.09, 0.06, 0.04, [0, -L * 0.5, -0.04], [PI - 0.4, 0, 0]);
      k.torus(fl.g, gold, 0.062, 0.012, [0, -L * 0.8, 0.03], [PI / 2, 0, 0]);
      k.torus(fl.g, goldDk, 0.06, 0.008, [0, -L * 0.86, 0.03], [PI / 2, 0, 0], PI * 2, { outline: false });
      const hl = quadLeg(k, c, c.body, sx, 0.19, -0.3, { col: fur, joint: furDk, r: 0.072, len: L, front: false });
      for (const foot of [fl.foot, hl.foot]) {
        for (let i = -1; i <= 1; i++) k.horn(foot, dark, 0.016, 0.06, 0.03, [i * 0.045, -0.015, 0.085], [PI / 2 + 0.5, 0, i * 0.25]);
        if (s >= 2) k.flame(foot, fireHi, core, 0.07, [0, 0.03, -0.07], [-1.1, 0, 0]);
      }
    }

    // Neck and head: a short thick neck, a broad brow, a cream muzzle, a black nose, fangs, angry brows, sharp golden eyes
    const neck = taperTube([v3(0, by + 0.16, 0.3), v3(0, by + 0.32, 0.4), v3(0, by + 0.44, 0.44)], (t) => 0.16 - t * 0.03, 16, 14);
    k.mesh(c.body, neck.geo, fur);
    const head = k.group(c.body, [0, by + 0.5, 0.46], [0.1, 0, 0]);
    c.head = head;
    k.sphere(head, fur, 0.2, [0, 0, 0], [1, 0.92, 1]);
    k.sphere(head, fur, 0.13, [0, -0.06, 0.15], [1.05, 0.72, 1.05]);
    k.sphere(head, cream, 0.11, [0, -0.1, 0.16], [1.0, 0.55, 1.05], [0, 0, 0], { outline: false });
    k.sphere(head, fur, 0.085, [0, -0.15, 0.1], [1.05, 0.55, 1.1]);
    k.sphere(head, dark, 0.034, [0, -0.02, 0.27], [1.25, 0.7, 0.8]);
    k.glow(head, new THREE.TorusGeometry(0.05, 0.006, 6, 20, PI * 0.8), dark, 0.6, [0, -0.085, 0.245], [0.2, 0, PI + PI * 0.1]);
    for (const sx of [-1, 1]) {
      k.cone(head, 0xfff6e0, 0.011, 0.04, [sx * 0.045, -0.095, 0.245], [PI, 0, 0], 6, { outline: false });
      k.blade(head, cream, 0.11, 0.07, 0.04, [sx * 0.17, -0.04, 0.06], [0.2, 0, sx * 1.9]);
    }
    k.eyes(head, { x: 0.092, y: 0.05, z: 0.155, r: 0.05, iris: 0xffb020, sharp: true });
    for (const sx of [-1, 1]) k.sphere(head, maneC, 0.05, [sx * 0.092, 0.115, 0.15], [1.3, 0.34, 0.6], [0, 0, sx * 0.42]);
    for (const sx of [-1, 1]) {
      const eg = k.group(head, [sx * 0.15, 0.15, -0.02], [0, 0, -sx * 0.4]);
      k.sphere(eg, fur, 0.065, [0, 0, 0], [1, 1, 0.55]);
      k.sphere(eg, cream, 0.04, [0, 0, 0.02], [1, 1, 0.3], [0, 0, 0], { outline: false });
      c.ears.push({ g: eg, phase: sx * 1.7 });
    }
    // Gold crown: a gold ring, five pointed teeth and a ruby at the front center
    const crown = k.group(head, [0, 0.2, 0.02], [0.15, 0, 0]);
    k.torus(crown, gold, 0.115, 0.02, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + PI / 2;
      k.cone(crown, i === 2 ? goldDk : gold, 0.024, i === 2 ? 0.13 : 0.1, [Math.cos(a) * 0.11, 0.01, Math.sin(a) * 0.11], [0, 0, 0], 6);
    }
    gem(k, crown, 0xff3a2a, 0.028, 0.06, [0, 0.015, 0.12], [0.3, 0, 0], 0.85);

    // Flame mane: a dark-red base of fur tufts, a ring of fur plates swept backward, large flames on the outer ring, small flames on the inner ring; longest at the top
    const mane = k.group(head, [0, 0.01, -0.1]);
    k.sphere(mane, maneC, 0.3, [0, 0, 0], [1.15, 1.15, 0.55]);
    const nT = 16;
    for (let i = 0; i < nT; i++) {
      const a = (i / nT) * PI * 2 + PI / nT;
      const up = 0.5 + 0.5 * Math.sin(a);
      const tg = k.group(mane, [Math.cos(a) * 0.27, Math.sin(a) * 0.27, -0.02], [0, 0, a - PI / 2]);
      k.blade(tg, i % 2 ? maneC : maneDk, 0.18 + up * 0.12, 0.12, 0.05, [0, 0, 0], [-0.5, 0, 0]);
      const fg = k.group(mane, [Math.cos(a) * 0.37, Math.sin(a) * 0.37, -0.07], [0, 0, a - PI / 2]);
      k.flame(fg, i % 2 ? fire : fireHi, core, 0.13 + up * 0.09, [0, 0, 0], [-0.55, 0, 0]);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.2;
      const fg = k.group(mane, [Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.03], [0, 0, a - PI / 2]);
      k.flame(fg, fireHi, core, 0.085, [0, 0, 0], [-0.25, 0, 0]);
    }
    // Back of the mane: a ring of dark fur tufts draped backward, so there is layered fur when seen from behind
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2;
      const tg = k.group(mane, [Math.cos(a) * 0.2, Math.sin(a) * 0.2 + 0.02, -0.12], [0, 0, a - PI / 2]);
      k.blade(tg, i % 2 ? maneDk : maneC, 0.2, 0.11, 0.05, [0, 0, 0], [-1.25, 0, 0]);
    }
    // Cream beard tufts at the chin and fur tufts at the elbows of the forelegs
    k.blade(head, cream, 0.1, 0.07, 0.04, [0, -0.17, 0.12], [PI - 0.5, 0, 0]);
    // Corona: two fire rings (with fire beads) rotating in opposite directions behind the mane, and after breakthrough a translucent blazing-sun disc is added
    spinRing(k, c, mane, fireHi, 0.5, 0.011, [0, 0, -0.16], [0, 0, 0], 0.6, 'z', { beads: 6, beadCol: core, beadR: 0.02, opacity: 0.8 });
    spinRing(k, c, mane, core, 0.57, 0.007, [0, 0, -0.2], [0, 0, 0], -0.4, 'z', { beads: 4, beadCol: 0xffffff, beadR: 0.013, opacity: 0.6, arc: PI * 1.5 });
    if (s === 3) k.glow(mane, new THREE.CircleGeometry(0.54, 40), fireHi, 0.8, [0, 0, -0.24], [0, 0, 0], 0.16);

    // Tail: a tapered tube, a gold ring at the root of the tail, a big flame at the tip
    const tail = k.group(c.body, [0, by + 0.02, -0.5], [0.1, 0, 0]);
    const tailPts = [v3(0, 0, 0.04), v3(0, -0.08, -0.22), v3(0, -0.05, -0.42), v3(0, 0.12, -0.58), v3(0, 0.3, -0.62)];
    const tt = taperTube(tailPts, (t) => 0.06 * (1 - t * 0.55), 36, 12);
    k.mesh(tail, tt.geo, fur);
    const ringT = 0.72;
    const rp = tt.path.getPointAt(ringT);
    const rg = aim(k.group(tail, [rp.x, rp.y, rp.z]), tt.path.getTangentAt(ringT));
    k.torus(rg, gold, 0.06 * (1 - ringT * 0.55) * 1.05, 0.01, [0, 0, 0], [PI / 2, 0, 0]);
    const tip = tailPts[4];
    const tipG = aim(k.group(tail, [tip.x, tip.y, tip.z]), tt.path.getTangentAt(1));
    k.flame(tipG, fire, core, 0.17, [0, -0.02, 0]);
    k.flame(tipG, fireHi, core, 0.1, [0.04, 0.02, 0.02], [0, 0, -0.4]);
    c.tails.push({ g: tail, phase: 0, amp: 0.18, axis: 'y' });

    // A molten ring flowing slowly at the feet, and floating sparks
    spinRing(k, c, c.body, magma, 0.62, 0.008, [0, 0.03, -0.05], [PI / 2, 0, 0], 0.7, 'y', { beads: 4, beadCol: fireHi, beadR: 0.016, opacity: 0.55, arc: PI * 1.4 });
    const n = 4 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? fireHi : core, 0.018, [Math.cos(i * 2.2) * 0.55, 0.5 + (i % 3) * 0.25, Math.sin(i * 2.2) * 0.45 - 0.05], 0.08);
  },

  /** `thalassene`: a floating deep-blue sacred whale, with throat-belly pleats, glowing star markings, a gold crown with a gem and pearls, long pectoral fins and tail fluke swaying slowly, its song turned into orbiting musical notes, two tidal water rings around it */
  thalassene(k, c, s) {
    floater(c, 0.3);
    const blue = 0x3b6fd8;
    const blueDk = 0x2b52b0;
    const belly = 0xeaf4ff;
    const groove = 0xc4d8f2;
    const cyan = 0x7ff0ff;
    const cyanHi = 0xd8fbff;
    const gold = 0xffd46a;
    const goldDk = 0xd9a83a;
    const aqua = 0x5ce0ff;
    const cy = 0.5;
    const body = k.group(c.body, [0, cy, 0]);

    // Body: a blunt rounded head, a wide thick chest and belly, tapering back into the tail stock
    k.sphere(body, blue, 1, [0, 0.02, 0.3], [0.37, 0.34, 0.38]);
    k.sphere(body, blue, 1, [0, 0, -0.05], [0.36, 0.35, 0.48]);
    k.sphere(body, blue, 1, [0, 0.01, -0.46], [0.25, 0.24, 0.3]);
    const stalk = taperTube([v3(0, 0, -0.56), v3(0, 0.03, -0.78), v3(0, 0.1, -0.98)], (t) => 0.13 * (1 - t * 0.55), 20, 12);
    k.mesh(body, stalk.geo, blue);
    // Pale star spots on the back (spots like a whale shark's)
    const mc: V3 = [0, 0, -0.05];
    const mr: V3 = [0.36, 0.35, 0.48];
    for (let i = 0; i < 14; i++) {
      const a = hash(i * 3.1) * PI * 2;
      const el = 0.35 + hash(i * 5.7) * 1.0;
      const d = v3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      if (d.z > 0.85) continue;
      spot(k, body, 0x9ec4ff, mc, mr, d, 0.016 + hash(i * 9.3) * 0.014);
    }
    // Belly: pale, with five throat-belly pleats (thin tubes hugging the belly's curve)
    const bc: V3 = [0, -0.14, 0.12];
    const br: V3 = [0.32, 0.24, 0.52];
    k.sphere(body, belly, 1, bc, br, [0, 0, 0], { outline: false });
    for (let i = -2; i <= 2; i++) {
      const x = i * 0.075;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 10; j++) {
        const z = 0.56 - j * 0.08;
        const u = 1 - (x / br[0]) ** 2 - ((z - bc[2]) / br[2]) ** 2;
        if (u <= 0.02) continue;
        pts.push(v3(x, bc[1] - br[1] * Math.sqrt(u) * 1.012, z));
      }
      if (pts.length > 2) k.mesh(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.007, 6, false), groove, [0, 0, 0], [0, 0, 0], { outline: false });
    }
    // Star markings on the back: a glowing constellation line from the forehead to the tail stock, with small stars at the nodes
    const stars = [v3(0, 0.3, 0.42), v3(0.12, 0.32, 0.22), v3(-0.08, 0.32, 0.02), v3(0.1, 0.31, -0.18), v3(-0.06, 0.24, -0.4), v3(0.04, 0.16, -0.58)];
    glowPath(k, body, cyan, stars, 0.006, 1.9, 0.85, 40);
    for (const p of stars) k.glowSphere(body, cyanHi, 0.016, [p.x, p.y + 0.004, p.z], 2.6);
    // Ripples on the flank: two pale cyan curves
    for (const sx of [-1, 1]) {
      glowPath(k, body, aqua, [v3(sx * 0.35, 0.1, 0.3), v3(sx * 0.37, 0.02, 0.1), v3(sx * 0.35, 0.1, -0.1), v3(sx * 0.32, 0.03, -0.3), v3(sx * 0.25, 0.08, -0.46)], 0.006, 1.6, 0.8, 40);
      k.glow(body, new THREE.OctahedronGeometry(0.018, 0), cyanHi, 2.4, [sx * 0.37, 0.02, 0.1]);
    }
    // Dorsal fin and three sea-blue crystals on the back
    k.blade(body, blue, 0.22, 0.14, 0.05, [0, 0.26, -0.16], [-1.0, 0, 0]);
    k.blade(body, aqua, 0.16, 0.06, 0.056, [0, 0.28, -0.155], [-1.0, 0, 0], { outline: false, emissive: cyan, emissiveAmt: 0.5 });
    gem(k, body, aqua, 0.022, 0.06, [0.14, 0.27, -0.02], [0.2, 0, -0.5], 0.7);
    gem(k, body, aqua, 0.018, 0.05, [-0.16, 0.26, -0.1], [0.1, 0, 0.6], 0.7);
    gem(k, body, aqua, 0.016, 0.045, [0.06, 0.24, -0.34], [-0.3, 0, -0.2], 0.7);

    // Pectoral fins: long, elegant fins, white underneath, a point of light at the tip; a gold ring clasps the fin root
    for (const sx of [-1, 1]) {
      const fin = k.group(body, [sx * 0.3, -0.06, 0.2], [0, sx * 0.45, 0]);
      k.blade(fin, blue, 0.6, 0.2, 0.05, [0, 0, 0], [0, PI / 2, 0]);
      k.blade(fin, belly, 0.58, 0.19, 0.03, [sx * 0.012, 0, 0], [0, PI / 2, 0], { outline: false });
      k.blade(fin, aqua, 0.2, 0.06, 0.056, [0, 0.45, 0.06], [0, PI / 2, 0], { outline: false, emissive: cyan, emissiveAmt: 0.4 });
      k.glowSphere(fin, cyanHi, 0.02, [0, 0.6, 0], 2.6);
      k.torus(fin, gold, 0.07, 0.012, [0, 0.08, 0], [0, 0, 0]);
      c.wings.push({ g: fin, side: -sx, base: 1.62, amp: 0.14, speed: 1.6 });
    }
    // Tail fluke: two swept-back lobes, the tail-stock group swinging up and down
    const tail = k.group(body, [0, 0.09, -0.94]);
    for (const sx of [-1, 1]) {
      const lobe = k.group(tail, [0, 0, 0], [0, sx * 0.5, -sx * 1.35]);
      k.blade(lobe, blue, 0.46, 0.2, 0.05, [0, 0, 0], [0, PI / 2, 0]);
      k.blade(lobe, belly, 0.44, 0.19, 0.03, [sx * 0.012, 0, 0], [0, PI / 2, 0], { outline: false });
      k.blade(lobe, aqua, 0.16, 0.06, 0.056, [0, 0.32, 0.05], [0, PI / 2, 0], { outline: false, emissive: cyan, emissiveAmt: 0.4 });
      k.glowSphere(lobe, cyanHi, 0.016, [0, 0.46, 0], 2.6);
    }
    k.torus(tail, gold, 0.055, 0.01, [0, 0, 0.02], [0, 0, 0]);
    c.tails.push({ g: tail, phase: 0, amp: 0.14, axis: 'x' });

    // Face: gentle big eyes in profile with lashes, blush, a long smiling mouth line
    const head = k.group(body, [0, 0.05, 0.3]);
    c.head = head;
    k.eyes(head, { x: 0.25, y: 0.03, z: 0.25, r: 0.062, iris: 0x2a4a9a, yaw: 0.7 });
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) k.blade(head, 0x1a2a5a, 0.04, 0.014, 0.01, [sx * (0.29 - i * 0.02), 0.09 + i * 0.006, 0.28 - i * 0.02], [0.3 - i * 0.2, sx * 0.7, sx * (0.4 + i * 0.3)], { outline: false });
    }
    k.blush(head, 0.25, -0.06, 0.26, 0.04, 0xffb0c0);
    glowPath(k, head, 0x142250, [v3(-0.3, -0.09, 0.14), v3(-0.18, -0.17, 0.3), v3(0, -0.2, 0.372), v3(0.18, -0.17, 0.3), v3(0.3, -0.09, 0.14)], 0.008, 0.5, 1, 32);
    // Gold crown: a gold ring worn at a slant, strung with pearls, a sea-blue gem at the front center; a small gold mark on the forehead
    const circlet = k.group(head, [0, 0.16, 0.02], [0.35, 0, 0]);
    k.torus(circlet, gold, 0.24, 0.014, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2 + PI / 2;
      k.sphere(circlet, 0xfff8f0, 0.02, [Math.cos(a) * 0.24, 0.012, Math.sin(a) * 0.24]);
    }
    k.cyl(circlet, goldDk, 0.045, 0.05, 0.02, [0, 0.01, 0.24], [0, 0, 0], 12);
    gem(k, circlet, aqua, 0.03, 0.08, [0, 0.02, 0.24], [0, 0, 0], 0.8);
    spinRing(k, c, circlet, cyanHi, 0.07, 0.004, [0, 0.05, 0.24], [PI / 2, 0, 0], 1.4, 'y', { beads: 2, beadCol: 0xffffff, beadR: 0.01, opacity: 0.75 });
    // Blowhole: a small cluster of water droplets bobbing up and down and an arc of water
    const spout = k.group(body, [0, 0.3, 0.12]);
    k.glow(spout, new THREE.TorusGeometry(0.06, 0.006, 6, 20, PI), cyan, 1.8, [0, 0.03, 0], [0, PI / 2, 0], 0.7);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.9;
      const m = k.glowSphere(spout, i % 2 ? cyanHi : cyan, 0.012 + (i % 3) * 0.004, [Math.cos(a) * 0.05, 0.06 + (i % 3) * 0.06, Math.sin(a) * 0.05], 2.4);
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.035, speed: 2.2 + (i % 3) * 0.5, phase: i * 1.1 });
    }
    // Song: three musical notes floating around the head
    const notes = k.group(head, [0, 0.14, 0.2]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      const ng = k.group(notes, [Math.cos(a) * 0.42, (i % 2) * 0.08, Math.sin(a) * 0.42], [0, -a, 0.2]);
      k.glowSphere(ng, cyanHi, 0.022, [0, 0, 0], 2.4, [1.15, 0.85, 1]);
      glowLink(k, ng, cyanHi, [0.02, 0.01, 0], [0.02, 0.09, 0], 0.005, 2.2);
      k.glow(ng, new THREE.BoxGeometry(0.04, 0.012, 0.01), cyanHi, 2.2, [0.04, 0.085, 0], [0, 0, -0.5]);
      c.bobbers.push({ g: ng, base: ng.position.y, amp: 0.03, speed: 1.8 + i * 0.4, phase: i * 2 });
    }
    c.spinners.push({ g: notes, speed: 0.9, axis: 'y' });
    // Tide: two tilted water rings flowing in opposite directions, with water droplets on the rings
    spinRing(k, c, body, cyan, 0.64, 0.012, [0, -0.16, -0.05], [PI / 2 + 0.2, 0, 0], 0.5, 'y', { beads: 5, beadCol: cyanHi, beadR: 0.02, opacity: 0.8 });
    spinRing(k, c, body, aqua, 0.72, 0.008, [0, -0.06, -0.08], [PI / 2 + 0.3, 0.4, 0], -0.35, 'y', { beads: 3, beadCol: 0xffffff, beadR: 0.014, opacity: 0.6 });
    // Breakthrough: an upright arc of tidal light behind the head
    if (s === 3) spinRing(k, c, body, cyanHi, 0.44, 0.006, [0, 0.0, -0.02], [0, 0, 0], 0.45, 'z', { beads: 4, beadCol: 0xffffff, beadR: 0.012, opacity: 0.55, arc: PI * 1.3 });
    // Bubbles
    const n = 4 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? cyanHi : 0xffffff, 0.016, [Math.cos(i * 2.3) * 0.5, cy + (i % 3) * 0.2 - 0.2, Math.sin(i * 2.3) * 0.5], 0.07);
  },

  /** `sylvaron`: a slender milk-white ancient stag, its antlers grown into a small forest (canopy, flowers, fruit, hanging vines), moss and seedlings on its back, the nature source crystal on the chest, orbiting falling leaves and fireflies */
  sylvaron(k, c, s) {
    const col = 0xeef6e2;
    const shade = 0xd4e0c4;
    const white = 0xffffff;
    const hoof = 0x6a4a30;
    const bark = 0x9a7a52;
    const barkDk = 0x7a5a3a;
    const green = 0x5fbf6a;
    const greenLt = 0x8fe06a;
    const greenDk = 0x3f9a4a;
    const moss = 0x7ac66a;
    const pink = 0xffa8d8;
    const amber = 0xffb347;
    const glowG = 0xc8ff9a;
    const emerald = 0x4ae08a;
    c.archetype = 'quad';
    const L = 0.46;
    const by = 0.64;

    // Body: three sections of chest, waist and haunch (with a waist), a white belly, moss spots on the shoulder and haunch
    k.sphere(c.body, col, 1, [0, by + 0.02, 0.14], [0.23, 0.24, 0.29]);
    k.sphere(c.body, col, 1, [0, by - 0.01, -0.08], [0.19, 0.19, 0.24]);
    k.sphere(c.body, col, 1, [0, by + 0.01, -0.28], [0.22, 0.23, 0.25]);
    k.sphere(c.body, white, 1, [0, by - 0.13, -0.04], [0.17, 0.13, 0.4], [0, 0, 0], { outline: false });
    const mossOn = (cen: V3, rad: V3, n: number, seed: number) => {
      for (let i = 0; i < n; i++) {
        const a = (hash(seed + i * 2.3) - 0.5) * 2.2;
        const el = 0.5 + hash(seed + i * 7.1) * 0.9;
        spot(k, c.body, i % 3 ? moss : greenDk, cen, rad, v3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el)), 0.03 + hash(seed + i * 3.7) * 0.03);
      }
    };
    mossOn([0, by + 0.02, 0.14], [0.23, 0.24, 0.29], 6, 1);
    mossOn([0, by + 0.01, -0.28], [0.22, 0.23, 0.25], 6, 9);
    // A blanket of moss along the spine, dotted with a few small flowers
    k.sphere(c.body, moss, 1, [0, by + 0.19, -0.06], [0.13, 0.05, 0.36], [0, 0, 0], { outline: false });
    for (let i = 0; i < 4; i++) k.glowSphere(c.body, i % 2 ? pink : white, 0.012, [Math.sin(i * 2.4) * 0.07, by + 0.245, 0.2 - i * 0.13], 2.2);
    // Leaf-vein markings on the flank: pale green glowing curves
    for (const sx of [-1, 1]) {
      glowPath(k, c.body, glowG, [v3(sx * 0.22, by + 0.1, 0.2), v3(sx * 0.235, by, 0.08), v3(sx * 0.2, by - 0.04, -0.08), v3(sx * 0.22, by + 0.02, -0.24), v3(sx * 0.19, by + 0.1, -0.38)], 0.006, 1.6, 0.85, 32);
      for (let i = 0; i < 3; i++) glowLink(k, c.body, glowG, [sx * 0.23, by + 0.02 - i * 0.02, 0.1 - i * 0.14], [sx * 0.22, by + 0.12 - i * 0.02, 0.02 - i * 0.14], 0.004, 1.5, 0.75);
    }
    // A seedling and two small mushrooms on the haunch
    const sap = k.group(c.body, [0.06, by + 0.2, -0.3], [0.2, 0, -0.3]);
    link(k, sap, barkDk, [0, 0, 0], [0.02, 0.13, 0], 0.012);
    lowSphere(k, sap, green, 0.06, [0.03, 0.17, 0], [1, 0.85, 1]);
    lowSphere(k, sap, greenLt, 0.04, [0.05, 0.2, 0.02], [1, 0.8, 1], [0, 0, 0], { outline: false });
    k.glowSphere(sap, pink, 0.014, [0.0, 0.2, 0.04], 2.4);
    for (const [x, z] of [[-0.09, -0.24], [-0.05, -0.34]]) {
      k.cyl(c.body, 0xf4ecd8, 0.008, 0.01, 0.03, [x, by + 0.2, z], [0, 0, 0], 8);
      lowSphere(k, c.body, 0xff8a6a, 0.022, [x, by + 0.215, z], [1, 0.6, 1]);
      lowSphere(k, c.body, white, 0.006, [x + 0.008, by + 0.228, z + 0.008], [1, 1, 1], [0, 0, 0], { outline: false });
    }
    // Nature source crystal on the chest: a bark ring, an emerald crystal, a ring of small orbiting leaves
    const brooch = k.group(c.body, [0, by - 0.02, 0.38], [-0.4, 0, 0]);
    k.torus(brooch, bark, 0.05, 0.013, [0, 0, 0]);
    k.cyl(brooch, barkDk, 0.04, 0.04, 0.02, [0, 0, -0.005], [PI / 2, 0, 0], 12);
    gem(k, brooch, emerald, 0.03, 0.06, [0, 0, 0], [PI / 2, 0, 0], 0.8);
    const leafRing = spinRing(k, c, brooch, glowG, 0.085, 0.0035, [0, 0, 0.02], [0, 0, 0], 0.8, 'z', { opacity: 0.6 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      k.blade(leafRing, i % 2 ? green : greenLt, 0.035, 0.02, 0.01, [Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.02], [0, 0, a - PI / 2], { outline: false });
    }

    // Limbs: slender deer legs, dark hooves, a ring of moss light on each hoof
    for (const sx of [-1, 1]) {
      for (const front of [true, false]) {
        const lg = quadLeg(k, c, c.body, sx, front ? 0.13 : 0.13, front ? 0.16 : -0.28, { col, joint: shade, r: 0.045, len: L, front, foot: hoof, footR: 0.05, footScale: [1, 0.8, 1.15], bend: 0.32 });
        k.glow(lg.g, new THREE.TorusGeometry(0.04, 0.005, 6, 20), glowG, 1.6, [0, -L + 0.1, front ? 0.05 : 0.0], [PI / 2, 0, 0], 0.8);
      }
    }

    // Neck and head: a long elegant neck, gentle green eyes, a black nose, long ears (pale green inside)
    const neck = taperTube([v3(0, by + 0.12, 0.24), v3(0, by + 0.3, 0.34), v3(0, by + 0.46, 0.4)], (t) => 0.1 - t * 0.025, 24, 12);
    k.mesh(c.body, neck.geo, col);
    k.sphere(c.body, white, 1, [0, by + 0.22, 0.4], [0.06, 0.1, 0.04], [0.3, 0, 0], { outline: false });
    const head = k.group(c.body, [0, by + 0.52, 0.42], [0.15, 0, 0]);
    c.head = head;
    k.sphere(head, col, 0.14, [0, 0, 0], [0.9, 0.86, 1.05]);
    k.sphere(head, col, 0.09, [0, -0.05, 0.14], [0.85, 0.68, 1.3]);
    k.sphere(head, white, 0.07, [0, -0.09, 0.15], [0.8, 0.45, 1.2], [0, 0, 0], { outline: false });
    k.sphere(head, 0x2a2016, 0.028, [0, -0.03, 0.255], [1.2, 0.8, 0.8]);
    k.eyes(head, { x: 0.085, y: 0.03, z: 0.1, r: 0.045, iris: 0x3aa060 });
    for (const sx of [-1, 1]) k.sphere(head, shade, 0.04, [sx * 0.085, 0.085, 0.1], [1.3, 0.3, 0.6], [0, 0, -sx * 0.25]);
    k.blush(head, 0.11, -0.03, 0.12, 0.03, 0xffc0c8);
    for (const sx of [-1, 1]) {
      const eg = k.group(head, [sx * 0.11, 0.08, -0.04], [0.2, 0, -sx * 1.0]);
      k.blade(eg, col, 0.17, 0.08, 0.03, [0, 0, 0]);
      k.blade(eg, 0xc8f0b0, 0.12, 0.045, 0.034, [0, 0.015, 0.006], [0, 0, 0], { outline: false });
      c.ears.push({ g: eg, phase: sx * 1.7 });
    }
    // Antlers: a main trunk plus branches, each branch tip growing a clump of canopy (two layers of green, flowers and fruit), with vines hanging from the branches
    const canopy = (parent: THREE.Object3D, p: V3, r: number, i: number) => {
      const g = k.group(parent, p);
      lowSphere(k, g, i % 2 ? green : greenDk, r, [0, 0.01, 0], [1, 0.85, 1]);
      lowSphere(k, g, greenLt, r * 0.7, [r * 0.3, r * 0.35, r * 0.25], [1, 0.8, 1], [0, 0, 0], { outline: false });
      lowSphere(k, g, i % 2 ? greenDk : green, r * 0.65, [-r * 0.4, -r * 0.1, -r * 0.2], [1, 0.9, 1], [0, 0, 0], { outline: false });
      for (let j = 0; j < 5; j++) {
        const a = j * 1.3 + i;
        leaf(k, g, j % 2 ? greenLt : green, r * 0.9, r * 0.45, 0.012, [Math.cos(a) * r * 0.7, r * 0.2 - (j % 2) * r * 0.3, Math.sin(a) * r * 0.7], [0.4, -a, 0.8], { outline: false });
      }
      if (i % 3 === 0) k.glowSphere(g, pink, r * 0.22, [r * 0.5, r * 0.5, r * 0.4], 2.4);
      else if (i % 3 === 1) lowSphere(k, g, amber, r * 0.2, [r * 0.55, -r * 0.1, r * 0.45], [1, 1, 1], [0, 0, 0], { emissive: amber, emissiveAmt: 0.7 });
      else k.glowSphere(g, white, r * 0.18, [-r * 0.2, r * 0.55, r * 0.5], 2.2);
      return g;
    };
    const antler = (sx: number) => {
      const ag = k.group(head, [0, 0, 0]);
      const P = (x: number, y: number, z: number): V3 => [sx * x, y, z];
      const B = P(0.06, 0.1, -0.02);
      const P1 = P(0.14, 0.22, -0.07);
      const P2 = P(0.2, 0.36, -0.14);
      const P3 = P(0.2, 0.48, -0.22);
      const F1 = P(0.22, 0.32, 0.1);
      const O1 = P(0.36, 0.42, -0.1);
      const K1 = P(0.12, 0.44, -0.32);
      const T1 = P(0.3, 0.56, -0.18);
      const T2 = P(0.1, 0.6, -0.28);
      lowSphere(k, ag, barkDk, 0.03, B);
      link(k, ag, bark, B, P1, 0.028);
      lowSphere(k, ag, bark, 0.027, P1);
      link(k, ag, bark, P1, P2, 0.024);
      lowSphere(k, ag, bark, 0.023, P2);
      link(k, ag, bark, P2, P3, 0.02);
      lowSphere(k, ag, bark, 0.02, P3);
      link(k, ag, bark, P1, F1, 0.018);
      link(k, ag, bark, P2, O1, 0.018);
      link(k, ag, bark, P2, K1, 0.016);
      link(k, ag, bark, P3, T1, 0.015);
      link(k, ag, bark, P3, T2, 0.014);
      // Moss marks on the bark
      lowSphere(k, ag, moss, 0.02, [(B[0] + P1[0]) / 2, (B[1] + P1[1]) / 2, (B[2] + P1[2]) / 2], [1, 0.7, 1.4], [0, 0, 0], { outline: false });
      canopy(ag, F1, 0.055, 0 + (sx > 0 ? 0 : 1));
      canopy(ag, O1, 0.075, 1 + (sx > 0 ? 0 : 1));
      canopy(ag, K1, 0.06, 2 + (sx > 0 ? 0 : 1));
      canopy(ag, T1, 0.065, 3 + (sx > 0 ? 0 : 1));
      canopy(ag, T2, 0.055, 4 + (sx > 0 ? 0 : 1));
      // Hanging vines: thin vines hanging from the outer branches, a small leaf at each end
      for (const [from, dx] of [[O1, 0.02], [K1, -0.02]] as [V3, number][]) {
        const end: V3 = [from[0] + sx * dx, from[1] - 0.16, from[2] - 0.02];
        link(k, ag, greenDk, [from[0], from[1] - 0.03, from[2]], end, 0.006, { outline: false });
        leaf(k, ag, greenLt, 0.04, 0.025, 0.01, end, [0.3, 0, sx * 2.6], { outline: false });
      }
      return ag;
    };
    antler(1);
    antler(-1);

    // Tail: a short tuft of white fur
    const tail = k.group(c.body, [0, by + 0.08, -0.48], [0.6, 0, 0]);
    k.sphere(tail, white, 0.05, [0, 0.02, -0.03], [1, 1.1, 1.3]);
    for (let i = 0; i < 3; i++) k.blade(tail, i === 1 ? col : white, 0.07, 0.035, 0.02, [(i - 1) * 0.02, 0.03, -0.05], [-0.6, 0, (i - 1) * 0.5]);
    c.tails.push({ g: tail, phase: 0, amp: 0.3, axis: 'y' });

    // Falling leaves drifting around the body (each floating on its own, the whole ring turning slowly), fireflies, a halo of pollen light at the feet; after breakthrough a ring of leaves above the antlers
    const leaves = k.group(c.body, [0, by, -0.05]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      const rr = 0.5 + (i % 2) * 0.08;
      const lg = k.group(leaves, [Math.cos(a) * rr, (i % 3) * 0.16 - 0.1, Math.sin(a) * rr], [0.6, -a, 0.4]);
      leaf(k, lg, i % 3 === 0 ? greenLt : i % 3 === 1 ? green : amber, 0.06, 0.03, 0.01, [0, 0, 0], [0, 0, 0], { outline: false });
      c.bobbers.push({ g: lg, base: lg.position.y, amp: 0.04, speed: 1.6 + (i % 3) * 0.4, phase: i * 0.9 });
    }
    c.spinners.push({ g: leaves, speed: 0.35, axis: 'y' });
    spinRing(k, c, c.body, glowG, 0.5, 0.006, [0, 0.03, -0.05], [PI / 2, 0, 0], 0.5, 'y', { beads: 5, beadCol: 0xe8ff9a, beadR: 0.012, opacity: 0.5, arc: PI * 1.5 });
    if (s === 3) spinRing(k, c, head, glowG, 0.3, 0.005, [0, 0.72, -0.16], [PI / 2 + 0.35, 0, 0], 0.6, 'y', { beads: 6, beadCol: pink, beadR: 0.012, opacity: 0.7 });
    const n = 4 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? 0xe8ff9a : glowG, 0.014, [Math.cos(i * 2.2) * 0.5, 0.5 + (i % 3) * 0.28, Math.sin(i * 2.2) * 0.45 - 0.05], 0.08);
  },

  /** `aeroth`: a sky eagle king with a white head and blue wings, seven great feathers with glowing shafts and wind streaks at the wing tips, a golden crest feather, a gold neck guard with a sapphire, three wind rings circling it, standing on clouds */
  aeroth(k, c, s) {
    c.archetype = 'bird';
    c.hover = 0.22;
    const blue = 0x2f6fc8;
    const blueLt = 0x3f86de;
    const blueDk = 0x1e4a9a;
    const white = 0xf6f6ff;
    const cream = 0xfff4dc;
    const gold = 0xffc43a;
    const goldDk = 0xd9a030;
    const claw = 0x3a3028;
    const cyan = 0x9fe0ff;
    const cyanHi = 0xe0f6ff;
    const sapphire = 0x4a8aff;
    const by = 0.62;

    // Body: a blue back and a white chest and belly, three layers of feather scales on the chest
    k.sphere(c.body, blue, 1, [0, by, -0.03], [0.25, 0.3, 0.27]);
    k.sphere(c.body, white, 1, [0, by - 0.05, 0.1], [0.21, 0.25, 0.2], [0, 0, 0], { outline: false });
    for (let i = 0; i < 3; i++) k.sphere(c.body, cream, 1, [0, by + 0.02 - i * 0.09, 0.22 - i * 0.03], [0.15 - i * 0.03, 0.06, 0.09], [0, 0, 0], { outline: false });
    k.sphere(c.body, blueDk, 1, [0, by - 0.16, -0.2], [0.14, 0.12, 0.14]);
    // Tail feathers: five long feathers fanning out backward and downward, deep blue at the tips, a point of light at the very end
    const tail = k.group(c.body, [0, by - 0.16, -0.26]);
    for (let i = -2; i <= 2; i++) {
      const L = 0.5 - Math.abs(i) * 0.06;
      feather(k, tail, i % 2 ? blueLt : blue, white, L, 0.1, [i * 0.03, 0, 0], [-2.0 + Math.abs(i) * 0.14, i * 0.26, 0], cyanHi);
      k.blade(tail, blueDk, L * 0.32, 0.09, 0.05, [i * 0.03, 0, 0], [-2.0 + Math.abs(i) * 0.14, i * 0.26, 0], { outline: false });
    }
    c.tails.push({ g: tail, phase: 0, amp: 0.12, axis: 'y' });
    // Feet: gold scaled legs and curved talons
    for (const sx of [-1, 1]) {
      const leg = k.group(c.body, [sx * 0.09, by - 0.24, 0.04]);
      k.sphere(leg, white, 0.06, [0, 0.02, 0], [1, 1.2, 1]);
      k.capsule(leg, gold, 0.022, 0.1, [0, -0.08, 0]);
      for (let i = 0; i < 3; i++) k.torus(leg, goldDk, 0.024, 0.005, [0, -0.05 - i * 0.035, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      k.sphere(leg, gold, 0.03, [0, -0.15, 0.01]);
      for (let i = -1; i <= 1; i++) {
        k.capsule(leg, gold, 0.013, 0.04, [i * 0.03, -0.165, 0.035], [PI / 2 - 0.2, 0, i * 0.35]);
        k.horn(leg, claw, 0.012, 0.05, 0.025, [i * 0.04, -0.17, 0.07], [PI / 2 + 0.7, 0, i * 0.3]);
      }
      k.horn(leg, claw, 0.011, 0.045, 0.02, [0, -0.17, -0.03], [-PI / 2 - 0.7, 0, 0]);
      c.legs.push({ g: leg, phase: sx > 0 ? 0 : PI, amp: 0.4 });
    }

    // Neck and head: a white head, a golden hooked beak, sharp golden eyes and deep-blue angry brows, four gold-and-blue crest feathers at the back of the head
    k.capsule(c.body, white, 0.11, 0.1, [0, by + 0.26, 0.06], [0.2, 0, 0]);
    const head = k.group(c.body, [0, by + 0.4, 0.12], [0.05, 0, 0]);
    c.head = head;
    k.sphere(head, white, 0.17, [0, 0, 0], [0.95, 0.92, 1.05]);
    k.sphere(head, cream, 0.1, [0, -0.07, 0.09], [1.05, 0.65, 0.95], [0, 0, 0], { outline: false });
    k.horn(head, gold, 0.052, 0.18, 0.085, [0, -0.02, 0.14], [PI / 2 + 0.3, 0, 0]);
    k.sphere(head, goldDk, 0.045, [0, -0.085, 0.2], [0.85, 0.55, 1.1], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) k.sphere(head, 0x5a4a30, 0.011, [sx * 0.028, 0.01, 0.19], [1, 1, 0.5], [0, 0, 0], { outline: false });
    k.eyes(head, { x: 0.092, y: 0.035, z: 0.125, r: 0.048, iris: gold, sharp: true, yaw: 0.35 });
    for (const sx of [-1, 1]) {
      k.sphere(head, blueDk, 0.05, [sx * 0.095, 0.095, 0.11], [1.35, 0.32, 0.7], [0, 0, sx * 0.45]);
      k.sphere(head, blueDk, 0.04, [sx * 0.14, 0.0, 0.08], [0.7, 0.5, 0.9], [0, sx * 0.6, 0], { outline: false });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32;
      const cg = k.group(head, [Math.sin(a) * 0.06, 0.11, -0.04], [-1.0 - Math.abs(a) * 0.5, 0, -a]);
      const L = 0.36 - Math.abs(i - 2) * 0.06;
      k.blade(cg, i % 2 ? gold : blueLt, L, 0.05, 0.02, [0, 0, 0]);
      k.blade(cg, cream, L * 0.6, 0.026, 0.024, [0, 0.02, 0], [0, 0, 0], { outline: false });
      k.glowSphere(cg, cyanHi, 0.012, [0, L, 0], 2.4);
    }
    // A ring of white feather ruff spreading backward behind the neck
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * PI * 1.3;
      const g = k.group(c.body, [Math.sin(a) * 0.2, by + 0.28 + Math.cos(a) * 0.05, 0.02 - Math.cos(a) * 0.06], [-1.1, 0, -a]);
      k.blade(g, i % 2 ? white : cream, 0.2 - Math.abs(a) * 0.03, 0.08, 0.03, [0, 0, 0]);
    }
    // Gold neck guard: a gold ring worn at a slant, a sapphire at the front center and a wind ring
    const gorget = k.group(c.body, [0, by + 0.2, 0.06], [-0.35, 0, 0]);
    k.torus(gorget, gold, 0.15, 0.018, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + PI / 6;
      k.cone(gorget, gold, 0.014, 0.05, [Math.cos(a) * 0.15, -0.005, Math.sin(a) * 0.15], [PI, 0, 0], 6, { outline: false });
    }
    const jewel = k.group(gorget, [0, -0.03, 0.15], [-0.6, 0, 0]);
    k.cyl(jewel, goldDk, 0.04, 0.04, 0.02, [0, 0, 0], [PI / 2, 0, 0], 12);
    gem(k, jewel, sapphire, 0.03, 0.06, [0, 0, 0], [PI / 2, 0, 0], 0.8);
    spinRing(k, c, jewel, cyan, 0.07, 0.004, [0, 0, 0.02], [0, 0, 0], 1.3, 'z', { beads: 2, beadCol: 0xffffff, beadR: 0.01, opacity: 0.75 });

    // Wings: seven feathers fanned open (blue feathers, white vane edges, deep-blue tips, glowing shafts), with flickering wind streaks trailing from the wing tips
    for (const sx of [-1, 1]) {
      const w = k.group(c.body, [sx * 0.2, by + 0.16, -0.02], [-0.1, -sx * 0.12, 0]);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const L = 1.0 * (1 - t * 0.4);
        const rot: V3 = [-0.08 * t, 0, -sx * t * 1.1];
        const z = -t * 0.03;
        const fg = feather(k, w, i % 2 ? blueLt : blue, white, L, 0.16, [0, 0, z], rot, undefined);
        k.blade(fg, blueDk, L * 0.34, 0.15, 0.052, [0, L * 0.66, 0], [0, 0, 0], { outline: false });
        glowLink(k, fg, cyan, [0, L * 0.12, 0.03], [0, L * 0.9, 0.03], 0.005, 1.8, 0.7);
        k.glowSphere(fg, cyanHi, 0.02, [0, L * 0.98, 0], 2.4);
        if (i === 0) {
          const streak = k.group(fg, [0, L * 0.98, 0]);
          k.glow(streak, new THREE.TorusGeometry(0.16, 0.006, 6, 24, PI * 0.9), cyanHi, 2.2, [0, 0, 0], [0, PI / 2, -0.3], 0.75);
          k.glow(streak, new THREE.TorusGeometry(0.24, 0.005, 6, 24, PI * 0.7), cyan, 2, [0, -0.06, 0], [0, PI / 2, -0.5], 0.6);
          c.flickers.push({ g: streak, base: streak.scale.clone(), speed: 7, amt: 0.4 });
        }
      }
      k.sphere(w, blue, 0.09, [0, 0.06, 0.02], [1, 1.2, 0.8]);
      for (let i = 0; i < 3; i++) k.blade(w, white, 0.22, 0.09, 0.03, [0, 0.1, 0.03], [-0.02, 0, -sx * (0.15 + i * 0.35)], { outline: false });
      c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: 1.0, amp: 0.24, speed: 3.4 });
    }

    // Wind: three tilted wind rings each turning on its own, a few clouds bobbing up and down at the feet, floating motes; after breakthrough a sky corona behind the head
    spinRing(k, c, c.body, cyan, 0.5, 0.008, [0, by, 0], [PI / 2, 0, 0], 2.0, 'y', { beads: 2, beadCol: cyanHi, beadR: 0.014, opacity: 0.6, arc: PI * 1.3 });
    spinRing(k, c, c.body, cyanHi, 0.62, 0.006, [0, by + 0.04, 0], [PI / 2 + 0.5, 0.3, 0], -1.4, 'y', { beads: 2, beadCol: 0xffffff, beadR: 0.012, opacity: 0.55, arc: PI * 1.1 });
    spinRing(k, c, c.body, cyan, 0.74, 0.006, [0, by - 0.06, 0], [PI / 2 - 0.4, -0.5, 0], 1.0, 'y', { beads: 3, beadCol: cyanHi, beadR: 0.012, opacity: 0.5, arc: PI });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26;
      const rr = 0.1 + (i % 2) * 0.04;
      const m = lowSphere(k, c.body, 0xffffff, rr, [Math.cos(a) * 0.2, rr, Math.sin(a) * 0.14], [1.3, 0.75, 1.1]);
      c.bobbers.push({ g: m, base: rr, amp: 0.02, speed: 1.4 + (i % 3) * 0.4, phase: i });
    }
    if (s === 3) spinRing(k, c, head, gold, 0.3, 0.007, [0, 0.04, -0.14], [0, 0, 0], 0.5, 'z', { beads: 5, beadCol: cyanHi, beadR: 0.014, opacity: 0.7 });
    const n = 3 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? cyanHi : 0xffffff, 0.014, [Math.cos(i * 2.3) * 0.6, by + (i % 3) * 0.25 - 0.2, Math.sin(i * 2.3) * 0.4], 0.07);
  },

  /** `terragon`: a giant tortoise whose shell is a snow mountain, with a dwarf village on the mountain (stone houses, lit windows, cooking smoke, a tall tower, a pine grove, a waterfall), the earth source crystal's amber veins, orbiting floating stones and a sand swirl at its feet */
  terragon(k, c, s) {
    const skin = 0x7aa05a;
    const skinDk = 0x5a7a44;
    const plast = 0xc8b890;
    const rock = 0x7a6a5a;
    const rockDk = 0x5a4a40;
    const rockLt = 0x9a918a;
    const snow = 0xf4f6f8;
    const pine = 0x2f7a3a;
    const pineLt = 0x4a9a4a;
    const trunk = 0x6a4a30;
    const wall = 0xd8c8a8;
    const roof = 0xa04a3a;
    const lamp = 0xffd070;
    const amber = 0xffb347;
    const water = 0x7fd8ff;
    const sand = 0xe0c890;
    const claw = 0x3a3028;
    c.archetype = 'quad';
    const by = 0.3;

    // Torso and plastron (segment lines on the plastron)
    k.sphere(c.body, skin, 1, [0, by, 0], [0.42, 0.22, 0.52]);
    k.sphere(c.body, plast, 1, [0, by - 0.07, 0.02], [0.37, 0.15, 0.47], [0, 0, 0], { outline: false });
    for (let i = -1; i <= 1; i++) k.sphere(c.body, 0xa89870, 1, [0, by - 0.215, 0.02 + i * 0.18], [0.3 - Math.abs(i) * 0.06, 0.008, 0.02], [0, 0, 0], { outline: false });
    // Limbs: columnar thick legs, rock-plate knee guards, three claws
    for (const sx of [-1, 1]) {
      for (const fz of [0.32, -0.3]) {
        const g = k.group(c.body, [sx * 0.37, 0.22, fz], [0, sx * (fz > 0 ? 0.4 : -0.4), 0]);
        k.cyl(g, skin, 0.1, 0.12, 0.2, [0, -0.1, 0], [0, 0, 0], 14);
        k.sphere(g, skinDk, 0.13, [0, -0.19, 0.02], [1.15, 0.5, 1.15]);
        for (let i = -1; i <= 1; i++) k.cone(g, claw, 0.024, 0.06, [i * 0.06, -0.21, 0.13 - Math.abs(i) * 0.02], [PI / 2 + 0.3, 0, i * 0.3], 6);
        const plate = new THREE.DodecahedronGeometry(0.06, 0);
        plate.scale(1.2, 0.6, 1);
        hard(k, g, plate, rockLt, [sx * 0.05, -0.05, 0.06], [0.3, sx * 0.4, 0]);
        c.legs.push({ g, phase: sx * fz > 0 ? 0 : PI, amp: 0.5 });
      }
    }
    // Tail: a short tail with a stone at the end
    const tail = k.group(c.body, [0, by - 0.02, -0.5], [0.3, 0, 0]);
    k.cone(tail, skin, 0.07, 0.16, [0, 0, 0], [-PI / 2 - 0.3, 0, 0], 10);
    const tailRock = new THREE.DodecahedronGeometry(0.035, 0);
    hard(k, tail, tailRock, rockLt, [0, -0.05, -0.15], [0.4, 0.3, 0]);
    c.tails.push({ g: tail, phase: 0, amp: 0.2, axis: 'y' });

    // Head: heavy brow ridges, amber sleeping eyes (half-lowered eyelids), a beak-like mouth, a moss beard, three small stone horns on top of the head
    k.capsule(c.body, skin, 0.12, 0.12, [0, by + 0.05, 0.5], [PI / 2 - 0.35, 0, 0]);
    const head = k.group(c.body, [0, by + 0.14, 0.64], [0.1, 0, 0]);
    c.head = head;
    k.sphere(head, skin, 0.2, [0, 0, 0], [1.05, 0.9, 1.1]);
    k.sphere(head, skinDk, 0.12, [0, -0.04, 0.16], [1.0, 0.55, 0.9]);
    k.glow(head, new THREE.TorusGeometry(0.075, 0.006, 6, 24, PI * 0.9), 0x2a3020, 0.5, [0, -0.08, 0.2], [0.3, 0, PI + PI * 0.05]);
    for (const sx of [-1, 1]) k.sphere(head, 0x2a3020, 0.012, [sx * 0.035, -0.02, 0.245], [1, 0.7, 0.5], [0, 0, 0], { outline: false });
    k.eyes(head, { x: 0.1, y: 0.045, z: 0.165, r: 0.06, iris: amber, glow: true });
    for (const sx of [-1, 1]) {
      k.sphere(head, skin, 0.06, [sx * 0.1, 0.105, 0.155], [1.2, 0.36, 0.8], [0.35, 0, 0]);
      k.sphere(head, skinDk, 0.065, [sx * 0.1, 0.135, 0.12], [1.4, 0.4, 0.8], [0, 0, sx * 0.15]);
      spot(k, head, 0x5f9a4a, [0, 0, 0], [0.21, 0.18, 0.22], v3(sx * 0.6, 0.7, -0.3), 0.045);
    }
    for (let i = 0; i < 5; i++) k.blade(head, i % 2 ? pineLt : 0x5f9a4a, 0.09 - Math.abs(i - 2) * 0.015, 0.035, 0.02, [(i - 2) * 0.035, -0.14, 0.14], [PI - 0.5, 0, (i - 2) * 0.3]);
    for (let i = 0; i < 3; i++) k.cone(head, rockLt, 0.03, 0.07 + (i === 1 ? 0.03 : 0), [(i - 1) * 0.08, 0.16, -0.04 + Math.abs(i - 1) * 0.02], [-0.3, 0, (i - 1) * 0.3], 6);

    // Carapace: a rock dome (slightly longer front to back), dark rim, a ring of amber earth-vein rune circles, rock plates on the shell surface
    const shell = k.group(c.body, [0, by + 0.1, -0.02]);
    const prof = [[0.001, -0.02], [0.5, -0.02], [0.54, 0.05], [0.49, 0.15], [0.38, 0.26], [0.22, 0.34], [0.001, 0.37]] as [number, number][];
    const dome = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 36);
    dome.scale(1, 1, 1.2);
    k.mesh(shell, dome, rock);
    const rim = new THREE.TorusGeometry(0.52, 0.045, 10, 48);
    rim.scale(1, 1.2, 1);
    k.mesh(shell, rim, rockDk, [0, 0.0, 0], [PI / 2, 0, 0]);
    const rune = new THREE.TorusGeometry(0.585, 0.008, 6, 64);
    rune.scale(1, 1.2, 1);
    k.glow(shell, rune, amber, 1.6, [0, 0.0, 0], [PI / 2, 0, 0], 0.75);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + PI / 8;
      k.glow(shell, new THREE.OctahedronGeometry(0.018, 0), amber, 2.2, [Math.cos(a) * 0.585, 0.0, Math.sin(a) * 0.7]);
    }
    const R: V3 = [0.5, 0.36, 0.6];
    const onDome = (a: number, el: number): { p: V3; n: THREE.Vector3 } => {
      const d = v3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const p: V3 = [d.x * R[0], d.y * R[1], d.z * R[2]];
      return { p, n: v3(d.x / R[0], d.y / R[1], d.z / R[2]).normalize() };
    };
    for (let i = 0; i < 10; i++) {
      const { p, n } = onDome((i / 10) * PI * 2 + 0.2, 0.32 + (i % 2) * 0.12);
      const g = aim(k.group(shell, p), n);
      const plate = new THREE.DodecahedronGeometry(0.075 + (i % 3) * 0.012, 0);
      plate.scale(1, 0.32, 1);
      hard(k, g, plate, i % 2 ? rockLt : rock, [0, 0, 0], [0, i * 0.7, 0]);
    }

    // Mountain: three stone peaks with snow caps, amber crystal veins on the side of the main peak (the earth source crystal)
    const peaks: [number, number, number, number, number][] = [
      [0.02, 0.3, -0.12, 0.24, 0.52],
      [-0.22, 0.27, 0.1, 0.16, 0.36],
      [0.22, 0.26, 0.16, 0.14, 0.3],
    ];
    for (const [x, y, z, r, h] of peaks) {
      k.cone(shell, rockLt, r, h, [x, y, z], [0, 0, 0], 7);
      k.cone(shell, snow, r * 0.44, h * 0.42, [x, y + h * 0.58, z], [0, 0, 0], 7, { outline: false });
    }
    gem(k, shell, amber, 0.035, 0.13, [0.16, 0.42, -0.02], [0.2, 0, -0.6], 0.8);
    gem(k, shell, amber, 0.026, 0.09, [0.2, 0.4, 0.04], [0.4, 0, -0.9], 0.8);
    gem(k, shell, amber, 0.022, 0.08, [-0.1, 0.42, -0.24], [-0.5, 0, 0.5], 0.8);
    gem(k, shell, amber, 0.02, 0.07, [-0.38, 0.2, 0.22], [0.3, 0, 0.9], 0.8);
    // Pine grove: pines in two conical tiers
    const tree = (a: number, el: number, hgt: number) => {
      const { p } = onDome(a, el);
      const g = k.group(shell, [p[0], p[1] - 0.02, p[2]]);
      k.cyl(g, trunk, 0.012, 0.014, hgt * 0.4, [0, hgt * 0.2, 0], [0, 0, 0], 6);
      k.cone(g, pine, hgt * 0.28, hgt * 0.6, [0, hgt * 0.3, 0], [0, 0, 0], 7);
      k.cone(g, pineLt, hgt * 0.2, hgt * 0.5, [0, hgt * 0.62, 0], [0, 0, 0], 7);
    };
    tree(1.0, 0.6, 0.22);
    tree(1.35, 0.48, 0.2);
    tree(1.7, 0.72, 0.18);
    tree(4.2, 0.56, 0.22);
    tree(4.55, 0.7, 0.18);
    tree(5.6, 0.62, 0.18);
    // Dwarf village: three stone houses (lit windows, chimney smoke) and a tall tower, two lamps at the village entrance
    const house = (a: number, el: number, w: number, yaw: number) => {
      const { p } = onDome(a, el);
      const g = k.group(shell, [p[0], p[1] - 0.02, p[2]]);
      const inner = k.group(g, [0, 0, 0], [0, yaw, 0]);
      hard(k, inner, new THREE.BoxGeometry(w, w * 0.8, w * 0.9), wall, [0, w * 0.4, 0]);
      k.cone(inner, roof, w * 0.78, w * 0.55, [0, w * 0.8, 0], [0, PI / 4, 0], 4);
      k.glow(inner, new THREE.BoxGeometry(w * 0.22, w * 0.26, 0.006), lamp, 2.2, [w * 0.18, w * 0.42, w * 0.45]);
      k.glow(inner, new THREE.BoxGeometry(w * 0.22, w * 0.26, 0.006), lamp, 2.2, [-w * 0.18, w * 0.42, w * 0.45]);
      k.cyl(inner, rockDk, w * 0.09, w * 0.09, w * 0.4, [-w * 0.25, w * 1.0, -w * 0.15], [0, 0, 0], 6);
      for (let i = 0; i < 3; i++) {
        const m = k.sphere(inner, 0xe8e4dc, w * (0.09 + i * 0.03), [-w * 0.25 + i * 0.01, w * 1.3 + i * w * 0.22, -w * 0.15], [1, 0.9, 1], [0, 0, 0], { outline: false });
        c.bobbers.push({ g: m, base: m.position.y, amp: w * 0.06, speed: 1.2 + i * 0.4, phase: i * 1.5 + a });
      }
    };
    house(2.05, 0.42, 0.11, 0.4);
    house(1.7, 0.62, 0.095, -0.2);
    house(2.35, 0.66, 0.085, 0.9);
    const towerAt = onDome(3.5, 0.5);
    const tower = k.group(shell, [towerAt.p[0], towerAt.p[1] - 0.03, towerAt.p[2]]);
    k.cyl(tower, rock, 0.045, 0.055, 0.24, [0, 0.12, 0], [0, 0, 0], 10);
    k.torus(tower, rockDk, 0.05, 0.01, [0, 0.22, 0], [PI / 2, 0, 0]);
    k.cone(tower, roof, 0.062, 0.08, [0, 0.245, 0], [0, 0, 0], 6);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + 0.4;
      k.glow(tower, new THREE.BoxGeometry(0.02, 0.03, 0.006), lamp, 2.2, [Math.cos(a) * 0.047, 0.17, Math.sin(a) * 0.047], [0, -a + PI / 2, 0]);
    }
    k.glowSphere(tower, amber, 0.018, [0, 0.34, 0], 2.6);
    for (const [a, el] of [[2.25, 0.34], [1.85, 0.3]] as [number, number][]) {
      const { p } = onDome(a, el);
      const g = k.group(shell, [p[0], p[1] - 0.01, p[2]]);
      k.cyl(g, rockDk, 0.008, 0.01, 0.09, [0, 0.045, 0], [0, 0, 0], 6);
      k.glowSphere(g, lamp, 0.014, [0, 0.1, 0], 2.4);
    }
    // Waterfall: a glowing stream flowing down beside the main peak, landing in a small pool at the shell rim and splashing droplets
    const dp = (a: number, el: number) => {
      const { p } = onDome(a, el);
      return v3(p[0], p[1] + 0.012, p[2]);
    };
    const fall = [v3(-0.07, 0.56, -0.03), v3(-0.12, 0.42, 0.02), v3(-0.16, 0.3, 0.12), dp(2.6, 0.7), dp(2.7, 0.5), dp(2.75, 0.3), dp(2.78, 0.14)];
    glowPath(k, shell, water, fall, 0.014, 1.6, 0.85, 32);
    glowPath(k, shell, 0xe0f8ff, fall, 0.006, 2.2, 0.9, 32);
    const poolAt = onDome(2.78, 0.1);
    const pool = aim(k.group(shell, poolAt.p), poolAt.n);
    k.glow(pool, new THREE.CircleGeometry(0.09, 20), water, 1.4, [0, 0.004, 0], [-PI / 2, 0, 0], 0.8);
    for (let i = 0; i < 4; i++) {
      const m = k.glowSphere(pool, 0xe0f8ff, 0.008, [Math.cos(i * 1.6) * 0.05, 0.03, Math.sin(i * 1.6) * 0.05], 2.4);
      c.bobbers.push({ g: m, base: 0.03, amp: 0.025, speed: 3 + i, phase: i });
    }

    // Orbiting floating stones: six rocks and two amber crystals drift slowly around the carapace
    const orbit = k.group(c.body, [0, by + 0.32, -0.02]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      const rr = 0.68 + (i % 2) * 0.08;
      const g = k.group(orbit, [Math.cos(a) * rr, (i % 3) * 0.12 - 0.1, Math.sin(a) * rr * 1.15], [i * 0.6, i, 0]);
      if (i % 3 === 2) gem(k, g, amber, 0.018, 0.06, [0, -0.03, 0], [0, 0, 0], 0.8);
      else {
        const sh = new THREE.DodecahedronGeometry(0.024 + (i % 3) * 0.01, 0);
        hard(k, g, sh, i % 2 ? rockLt : rock);
      }
      c.bobbers.push({ g, base: g.position.y, amp: 0.03, speed: 1.2 + (i % 3) * 0.4, phase: i * 1.3 });
    }
    c.spinners.push({ g: orbit, speed: 0.3, axis: 'y' });
    // A sand swirl and floating dust at the feet; after breakthrough a golden earth-vein halo above the main peak
    spinRing(k, c, c.body, sand, 0.78, 0.008, [0, 0.03, 0], [PI / 2, 0, 0], 0.45, 'y', { beads: 4, beadCol: 0xf0e0b0, beadR: 0.014, opacity: 0.55, arc: PI * 1.5 });
    if (s === 3) spinRing(k, c, shell, 0xffd070, 0.26, 0.007, [0.02, 0.86, -0.12], [PI / 2 + 0.25, 0, 0], 0.5, 'y', { beads: 5, beadCol: amber, beadR: 0.014, opacity: 0.75 });
    const n = 3 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? 0xf0e0b0 : amber, 0.014, [Math.cos(i * 2.2) * 0.7, 0.3 + (i % 3) * 0.25, Math.sin(i * 2.2) * 0.6], 0.06);
  },

  /** `voltarion`: an indigo-purple scaled qilin, with gold scale armor and breastplate, a lightning mane and a thunder-lit single horn, gold hooves treading on clouds, thunder markings on the flanks, orbiting electric orbs and thunderclouds at its feet */
  voltarion(k, c, s) {
    const col = 0x4a3aa8;
    const colDk = 0x352a80;
    const belly = 0x8a7ad8;
    const gold = 0xffd24a;
    const goldDk = 0xd9a030;
    const volt = 0xfff066;
    const voltHi = 0xffffff;
    const bolt = 0xf6ff8a;
    const cloud = 0xffffff;
    const cloudDk = 0x9a90c8;
    c.archetype = 'quad';
    const L = 0.46;
    const by = 0.64;

    // Body: three sections with a waist, a pale purple belly, gold scales on the spine and haunch (scales hugging the surface, in staggered rows)
    const segs: [V3, V3][] = [
      [[0, by + 0.02, 0.14], [0.23, 0.24, 0.28]],
      [[0, by - 0.01, -0.08], [0.19, 0.19, 0.24]],
      [[0, by + 0.01, -0.28], [0.22, 0.23, 0.25]],
    ];
    for (const [p, r] of segs) k.sphere(c.body, col, 1, p, r);
    k.sphere(c.body, belly, 1, [0, by - 0.13, -0.04], [0.17, 0.13, 0.4], [0, 0, 0], { outline: false });
    for (const [p, r] of [segs[0], segs[2]]) {
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 5; i++) {
          const a = (i - 2) * 0.42 + (row % 2) * 0.2;
          const el = 1.25 - row * 0.32;
          spot(k, c.body, i % 2 ? gold : goldDk, p, r, v3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el) * (p[2] > 0 ? 0.6 : -0.6)), 0.032, {}, 0.35);
        }
      }
    }
    // Thunder markings on the flank: glowing zigzag lines
    for (const sx of [-1, 1]) {
      const zig: V3[] = [[sx * 0.23, by + 0.12, 0.2], [sx * 0.245, by + 0.02, 0.1], [sx * 0.225, by + 0.06, 0.0], [sx * 0.2, by - 0.06, -0.1], [sx * 0.215, by, -0.22], [sx * 0.2, by - 0.1, -0.32]];
      for (let i = 0; i < zig.length - 1; i++) glowLink(k, c.body, bolt, zig[i], zig[i + 1], 0.005, 2, 0.85);
      k.glow(c.body, new THREE.OctahedronGeometry(0.016, 0), voltHi, 2.6, zig[2]);
    }
    // Breastplate: a gold thunder-patterned chest plate, a lightning-shaped thunder stone in the center, a ring of electricity around it
    const plate = k.group(c.body, [0, by - 0.02, 0.38], [-0.35, 0, 0]);
    hard(k, plate, poly([[-0.09, -0.08], [0.09, -0.08], [0.11, 0.02], [0.06, 0.09], [-0.06, 0.09], [-0.11, 0.02]], 0.02, 2), gold, [0, 0, 0]);
    k.glow(plate, boltGeo(0.11, 0.06, 0.012), volt, 2.6, [0, -0.055, 0.014]);
    spinRing(k, c, plate, bolt, 0.13, 0.004, [0, 0, 0.02], [0, 0, 0], 1.6, 'z', { beads: 3, beadCol: voltHi, beadR: 0.01, opacity: 0.7 });

    // Limbs: slender legs, gold hooves, a puff of cloud and small flickering arcs at each hoof
    for (const sx of [-1, 1]) {
      for (const front of [true, false]) {
        const lg = quadLeg(k, c, c.body, sx, 0.14, front ? 0.16 : -0.28, { col, joint: colDk, r: 0.05, len: L, front, foot: gold, footR: 0.05, footScale: [1, 0.85, 1.15], bend: 0.3 });
        k.torus(lg.g, goldDk, 0.044, 0.008, [0, -L + 0.12, front ? 0.05 : 0.0], [PI / 2, 0, 0]);
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + sx;
          lowSphere(k, lg.foot, cloud, 0.03 + (i % 2) * 0.008, [Math.cos(a) * 0.05, -0.005, Math.sin(a) * 0.05], [1.1, 0.8, 1.1]);
        }
        const zap = k.glow(lg.foot, boltGeo(0.06, 0.03, 0.008), volt, 2.4, [sx * 0.06, 0.03, 0.02], [0, 0, sx * 0.5]);
        c.flickers.push({ g: zap, base: zap.scale.clone(), speed: 11 + (sx > 0 ? 1.5 : 0) + (front ? 2 : 0), amt: 0.6 });
      }
    }

    // Neck and head: a dragon-shaped head, a long muzzle and whiskers, gold brow ridges, a thunder-lit single horn and two backward-curved gold horns, deer ears
    const neck = taperTube([v3(0, by + 0.12, 0.24), v3(0, by + 0.3, 0.34), v3(0, by + 0.46, 0.4)], (t) => 0.105 - t * 0.025, 24, 12);
    k.mesh(c.body, neck.geo, col);
    k.sphere(c.body, belly, 1, [0, by + 0.22, 0.4], [0.06, 0.1, 0.04], [0.3, 0, 0], { outline: false });
    const head = k.group(c.body, [0, by + 0.52, 0.42], [0.15, 0, 0]);
    c.head = head;
    k.sphere(head, col, 0.14, [0, 0, 0], [0.92, 0.86, 1.05]);
    k.sphere(head, col, 0.095, [0, -0.05, 0.14], [0.85, 0.66, 1.35]);
    k.sphere(head, belly, 0.075, [0, -0.09, 0.15], [0.8, 0.45, 1.25], [0, 0, 0], { outline: false });
    k.sphere(head, colDk, 0.045, [0, 0.0, 0.245], [1.1, 0.6, 0.8]);
    for (const sx of [-1, 1]) {
      k.sphere(head, 0x1a1030, 0.011, [sx * 0.03, -0.005, 0.28], [1, 0.8, 0.5], [0, 0, 0], { outline: false });
      k.cone(head, 0xfff6e0, 0.009, 0.035, [sx * 0.04, -0.1, 0.24], [PI, 0, 0], 6, { outline: false });
      // Dragon whiskers: long thin whiskers extending from the sides of the muzzle, a point of electric light at each end
      const wg = k.group(head, [sx * 0.07, -0.03, 0.24], [0.4, sx * 0.9, sx * 0.9]);
      k.horn(wg, gold, 0.008, 0.2, 0.1, [0, 0, 0]);
      k.glowSphere(wg, voltHi, 0.01, [0, 0.19, -0.09], 2.4);
      c.ears.push({ g: wg, phase: sx * 2.3 });
    }
    k.eyes(head, { x: 0.085, y: 0.035, z: 0.105, r: 0.045, iris: volt, glow: true, sharp: true });
    for (const sx of [-1, 1]) k.sphere(head, gold, 0.04, [sx * 0.085, 0.09, 0.1], [1.35, 0.32, 0.6], [0, 0, sx * 0.4]);
    // Single horn: a glowing thunder horn (translucent shell, bright core); gold backward-curved horns on both sides; the ears
    const hornGeo = new THREE.ConeGeometry(0.035, 0.34, 10);
    hornGeo.translate(0, 0.17, 0);
    k.glow(head, hornGeo, volt, 2.6, [0, 0.11, 0.05], [-0.35, 0, 0]);
    const hornCore = new THREE.ConeGeometry(0.014, 0.3, 8);
    hornCore.translate(0, 0.15, 0);
    k.glow(head, hornCore, voltHi, 3, [0, 0.12, 0.05], [-0.35, 0, 0]);
    for (const sx of [-1, 1]) {
      const hg = k.group(head, [sx * 0.07, 0.09, -0.04], [-1.1, 0, -sx * 0.5]);
      k.horn(hg, gold, 0.022, 0.22, 0.08, [0, 0, 0]);
      k.torus(hg, goldDk, 0.024, 0.006, [0, 0.05, -0.003], [PI / 2, 0, 0], PI * 2, { outline: false });
      const eg = k.group(head, [sx * 0.11, 0.06, -0.02], [0.2, 0, -sx * 1.1]);
      k.blade(eg, col, 0.13, 0.06, 0.03, [0, 0, 0]);
      k.blade(eg, belly, 0.09, 0.035, 0.034, [0, 0.012, 0.006], [0, 0, 0], { outline: false });
      c.ears.push({ g: eg, phase: sx * 1.7 });
    }
    // Lightning mane: a row of flickering lightning bolts along the back of the neck, with purple fur plates underneath
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const p = i < 4 ? neck.path.getPointAt(0.95 - i * 0.26) : v3(0, by + 0.24 - (i - 4) * 0.01, 0.06 - (i - 4) * 0.14);
      const size = 0.16 + Math.sin(t * PI) * 0.1;
      const tilt = i < 4 ? -0.8 - i * 0.15 : -1.25;
      k.blade(c.body, colDk, size * 0.7, 0.07, 0.04, [0, p.y + 0.03, p.z], [tilt, 0, 0]);
      const g = k.group(c.body, [(i % 2 ? 1 : -1) * 0.02, p.y + 0.06, p.z], [tilt, PI / 2, (i % 2 ? 1 : -1) * 0.2]);
      k.glow(g, boltGeo(size, 0.09, 0.02), i % 2 ? volt : bolt, 2.5);
      c.flickers.push({ g, base: g.scale.clone(), speed: 10 + i * 1.7, amt: 0.5 });
    }

    // Tail: a lion-like tapered tube, a tuft of electric light at the tip
    const tail = k.group(c.body, [0, by + 0.06, -0.5], [0.3, 0, 0]);
    const tailPts = [v3(0, 0, 0.02), v3(0, -0.06, -0.2), v3(0, 0.02, -0.38), v3(0, 0.16, -0.48)];
    const tt = taperTube(tailPts, (t) => 0.04 * (1 - t * 0.5), 28, 10);
    k.mesh(tail, tt.geo, col);
    k.torus(tail, gold, 0.03, 0.007, [0, -0.02, -0.3], [0.3, 0, 0]);
    const tip = tailPts[3];
    const tipG = k.group(tail, [tip.x, tip.y, tip.z]);
    k.glowSphere(tipG, volt, 0.035, [0, 0.02, 0], 2.4);
    for (let i = 0; i < 3; i++) {
      const g = k.group(tipG, [0, 0.02, 0], [-0.4, (i - 1) * 1.0, (i - 1) * 0.9]);
      k.glow(g, boltGeo(0.12, 0.05, 0.016), i === 1 ? voltHi : bolt, 2.6);
      c.flickers.push({ g, base: g.scale.clone(), speed: 12 + i * 2, amt: 0.6 });
    }
    c.tails.push({ g: tail, phase: 0, amp: 0.25, axis: 'y' });

    // A ring of orbiting electric orbs (tilted, fast-spinning), a ring of thunderclouds flowing slowly at the feet (cloud puffs and small arcs), floating electric sparks; after breakthrough a ring of thunder light behind it
    spinRing(k, c, c.body, bolt, 0.5, 0.006, [0, by + 0.05, -0.04], [PI / 2 + 0.4, 0.2, 0], 2.2, 'y', { beads: 4, beadCol: voltHi, beadR: 0.018, opacity: 0.7 });
    const storm = k.group(c.body, [0, 0.06, -0.04]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      const rr = 0.52 + (i % 2) * 0.06;
      const m = lowSphere(k, storm, i % 3 ? cloud : cloudDk, 0.04 + (i % 3) * 0.01, [Math.cos(a) * rr, 0.0, Math.sin(a) * rr], [1.3, 0.8, 1.0], [0, -a, 0]);
      c.bobbers.push({ g: m, base: 0, amp: 0.015, speed: 1.5 + (i % 3) * 0.4, phase: i });
      if (i % 2) {
        const z = k.glow(storm, boltGeo(0.07, 0.03, 0.008), volt, 2.4, [Math.cos(a) * rr, 0.06, Math.sin(a) * rr], [0, -a, 0.3]);
        c.flickers.push({ g: z, base: z.scale.clone(), speed: 9 + i, amt: 0.7 });
      }
    }
    c.spinners.push({ g: storm, speed: 0.5, axis: 'y' });
    if (s === 3) spinRing(k, c, c.body, volt, 0.46, 0.008, [0, by + 0.28, -0.1], [0, 0, 0], 0.6, 'z', { beads: 6, beadCol: voltHi, beadR: 0.016, opacity: 0.7 });
    const n = 4 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? voltHi : volt, 0.014, [Math.cos(i * 2.2) * 0.5, 0.5 + (i % 3) * 0.28, Math.sin(i * 2.2) * 0.45 - 0.05], 0.08);
  },

  /** `luminael`: a pure-white pegasus, a mane and tail of light rising and falling with the wind, gold-and-white wings, a spinning morning star and a gold crown on the brow, halos and a dawn ring, holy-light markings */
  luminael(k, c, s) {
    const col = 0xfefcff;
    const shade = 0xe6e2f2;
    const gold = 0xffe27a;
    const goldDk = 0xd9b850;
    const dawn = 0xffc8d8;
    const glowGold = 0xfff4a0;
    const star = 0xfffbe0;
    const sky = 0x4a8aff;
    c.archetype = 'quad';
    const L = 0.46;
    const by = 0.64;

    // Body: a slender horse body, a soft dawn color on the chest, gold holy-light markings on the flank
    k.sphere(c.body, col, 1, [0, by + 0.02, 0.14], [0.22, 0.23, 0.28]);
    k.sphere(c.body, col, 1, [0, by - 0.01, -0.08], [0.19, 0.19, 0.24]);
    k.sphere(c.body, col, 1, [0, by + 0.01, -0.28], [0.21, 0.22, 0.25]);
    k.sphere(c.body, dawn, 1, [0, by - 0.1, 0.18], [0.16, 0.14, 0.22], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) {
      glowPath(k, c.body, glowGold, [v3(sx * 0.21, by + 0.1, 0.22), v3(sx * 0.23, by, 0.1), v3(sx * 0.2, by - 0.03, -0.06), v3(sx * 0.215, by + 0.03, -0.22), v3(sx * 0.19, by + 0.1, -0.36)], 0.005, 1.7, 0.85, 32);
      k.glow(c.body, new THREE.OctahedronGeometry(0.018, 0), star, 2.4, [sx * 0.23, by, 0.1]);
      k.glow(c.body, new THREE.OctahedronGeometry(0.014, 0), star, 2.4, [sx * 0.215, by + 0.03, -0.22]);
    }
    // Gold necklace on the chest and a morning-star gem
    const chain = k.group(c.body, [0, by + 0.04, 0.2], [-0.3, 0, 0]);
    k.torus(chain, gold, 0.17, 0.011, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + PI / 2;
      k.sphere(chain, i === 0 ? goldDk : gold, 0.014, [Math.cos(a) * 0.17, -0.005, Math.sin(a) * 0.17]);
    }
    const pend = k.group(chain, [0, -0.06, 0.16], [-0.5, 0, 0]);
    k.cyl(pend, goldDk, 0.035, 0.035, 0.016, [0, 0, 0], [PI / 2, 0, 0], 12);
    const starGem = new THREE.OctahedronGeometry(0.03, 0);
    starGem.scale(1, 1, 0.5);
    k.glow(pend, starGem, star, 2.6, [0, 0, 0.012]);
    spinRing(k, c, pend, glowGold, 0.06, 0.004, [0, 0, 0.02], [0, 0, 0], 1.2, 'z', { beads: 2, beadCol: 0xffffff, beadR: 0.01, opacity: 0.75 });

    // Limbs: slender horse legs, gold hooves, a gold ring on each hoof
    for (const sx of [-1, 1]) {
      for (const front of [true, false]) {
        const lg = quadLeg(k, c, c.body, sx, 0.13, front ? 0.16 : -0.28, { col, joint: shade, r: 0.046, len: L, front, foot: gold, footR: 0.05, footScale: [1, 0.85, 1.15], bend: 0.3 });
        k.torus(lg.g, goldDk, 0.042, 0.007, [0, -L + 0.11, front ? 0.05 : 0.0], [PI / 2, 0, 0]);
        k.glow(lg.g, new THREE.TorusGeometry(0.05, 0.004, 6, 20), glowGold, 1.8, [0, -L + 0.06, front ? 0.05 : 0.0], [PI / 2, 0, 0], 0.7);
      }
    }

    // Neck and head: a long neck, a horse face, gentle blue eyes, pointed ears, a gold crown and a spinning morning star on the brow
    const neck = taperTube([v3(0, by + 0.12, 0.24), v3(0, by + 0.32, 0.34), v3(0, by + 0.48, 0.38)], (t) => 0.105 - t * 0.025, 24, 12);
    k.mesh(c.body, neck.geo, col);
    const head = k.group(c.body, [0, by + 0.54, 0.4], [0.2, 0, 0]);
    c.head = head;
    k.sphere(head, col, 0.13, [0, 0, 0], [0.9, 0.86, 1.05]);
    k.sphere(head, col, 0.085, [0, -0.07, 0.15], [0.82, 0.68, 1.4]);
    k.sphere(head, dawn, 0.06, [0, -0.11, 0.18], [0.8, 0.45, 1.2], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) k.sphere(head, 0x9a8aa8, 0.012, [sx * 0.03, -0.075, 0.275], [1, 0.8, 0.5], [0, 0, 0], { outline: false });
    k.eyes(head, { x: 0.085, y: 0.03, z: 0.1, r: 0.045, iris: sky });
    for (const sx of [-1, 1]) k.sphere(head, shade, 0.038, [sx * 0.085, 0.085, 0.1], [1.3, 0.3, 0.6], [0, 0, -sx * 0.25]);
    k.blush(head, 0.1, -0.02, 0.13, 0.03, 0xffc0c8);
    for (const sx of [-1, 1]) {
      const eg = k.group(head, [sx * 0.08, 0.1, -0.03], [0.1, 0, -sx * 0.5]);
      k.blade(eg, col, 0.12, 0.05, 0.03, [0, 0, 0]);
      k.blade(eg, dawn, 0.08, 0.028, 0.034, [0, 0.012, 0.006], [0, 0, 0], { outline: false });
      c.ears.push({ g: eg, phase: sx * 1.7 });
    }
    const crown = k.group(head, [0, 0.09, 0.03], [0.3, 0, 0]);
    k.torus(crown, gold, 0.1, 0.012, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) k.cone(crown, gold, 0.012, 0.045 + (i === 1 ? 0.02 : 0), [(i - 1) * 0.055, 0.005, 0.085 - Math.abs(i - 1) * 0.02], [0.4, 0, 0], 6);
    const morningStar = k.group(head, [0, 0.19, 0.12]);
    const sg = new THREE.OctahedronGeometry(0.045, 0);
    sg.scale(1, 1.6, 1);
    const sm = k.glow(morningStar, sg, star, 3);
    c.spinners.push({ g: sm, speed: 1.6, axis: 'y' });
    k.glowSphere(morningStar, glowGold, 0.06, [0, 0, 0], 0.9, [1, 1, 1], 0.3);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      k.glow(morningStar, new THREE.BoxGeometry(0.004, 0.05, 0.004), glowGold, 2.2, [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0], [0, 0, a + PI / 2]);
    }
    c.bobbers.push({ g: morningStar, base: 0.19, amp: 0.02, speed: 2, phase: 0 });
    // Mane of light: a string of undulating light leaves along the back of the neck (gold and dawn colors alternating), and a forelock on the brow
    const maneAt = (p: THREE.Vector3, tilt: number, i: number, sz: number) => {
      const outer = k.group(c.body, [0, p.y + 0.02, p.z], [tilt, 0, 0]);
      const g = k.group(outer);
      k.blade(g, i % 2 ? 0xffd060 : 0xffb0c8, sz, 0.08, 0.035, [0, 0, 0], [0, 0, 0], { emissive: glowGold, emissiveAmt: 0.45 });
      k.blade(g, star, sz * 0.62, 0.035, 0.04, [0, 0.01, 0.006], [0, 0, 0], { outline: false, emissive: star, emissiveAmt: 0.7 });
      k.glowSphere(g, star, 0.013, [0, sz, 0], 2.4);
      c.tails.push({ g, phase: i * 0.7, amp: 0.14, axis: 'x' });
    };
    for (let i = 0; i < 6; i++) maneAt(neck.path.getPointAt(1 - i * 0.2), -1.0 - i * 0.12, i, 0.26 - Math.abs(i - 2) * 0.03);
    maneAt(v3(0, by + 0.1, -0.0), -1.6, 6, 0.16);
    const foreO = k.group(head, [0, 0.08, 0.1], [0.9, 0, 0]);
    const fore = k.group(foreO);
    k.blade(fore, 0xffd060, 0.12, 0.05, 0.035, [0, 0, 0], [0, 0, 0], { emissive: glowGold, emissiveAmt: 0.45 });
    c.tails.push({ g: fore, phase: 2, amp: 0.1, axis: 'x' });

    // Wings: six white feathers (gold vane edges, a point of light at each tip), raised slightly
    for (const sx of [-1, 1]) {
      const w = k.group(c.body, [sx * 0.17, by + 0.18, 0.06], [-0.1, -sx * 0.15, 0]);
      const n = 6;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const Lf = 0.82 * (1 - t * 0.4);
        const rot: V3 = [-0.06 * t, 0, -sx * t * 1.05];
        const fg = feather(k, w, i % 2 ? col : shade, 0xfff4dc, Lf, 0.14, [0, 0, -t * 0.03], rot, glowGold);
        k.blade(fg, gold, Lf * 0.22, 0.11, 0.052, [0, Lf * 0.78, 0], [0, 0, 0], { outline: false });
      }
      k.sphere(w, col, 0.075, [0, 0.05, 0.02], [1, 1.2, 0.8]);
      c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: 0.85, amp: 0.26, speed: 3 });
    }

    // Tail: four flowing ribbons of light
    const tail = k.group(c.body, [0, by + 0.1, -0.5], [0.5, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const g = k.group(tail, [(i - 1.5) * 0.025, 0, 0], [-0.3 + i * 0.12, 0, (i - 1.5) * 0.25]);
      const Lt = 0.34 - Math.abs(i - 1.5) * 0.04;
      k.blade(g, i % 2 ? 0xffd060 : 0xffb0c8, Lt, 0.08, 0.035, [0, 0, 0], [PI - 0.4, 0, 0], { emissive: glowGold, emissiveAmt: 0.45 });
      k.glowSphere(g, star, 0.012, [0, -Lt * 0.9, Lt * 0.4], 2.4);
      c.tails.push({ g, phase: i * 0.8, amp: 0.2, axis: 'y' });
    }

    // Halo (an upright gold ring behind the head), a dawn ring at the feet and floating stardust; after breakthrough a big halo and rays of light behind it
    spinRing(k, c, head, gold, 0.24, 0.007, [0, 0.06, -0.12], [0, 0, 0], 0.5, 'z', { beads: 4, beadCol: star, beadR: 0.014, opacity: 0.8 });
    spinRing(k, c, c.body, dawn, 0.52, 0.006, [0, 0.03, -0.05], [PI / 2, 0, 0], 0.4, 'y', { beads: 4, beadCol: glowGold, beadR: 0.012, opacity: 0.55, arc: PI * 1.6 });
    if (s === 3) {
      const big = spinRing(k, c, c.body, glowGold, 0.5, 0.006, [0, by + 0.2, -0.12], [0.25, 0, 0], -0.3, 'z', { beads: 8, beadCol: star, beadR: 0.012, opacity: 0.6 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2 + PI / 8;
        k.glow(big, new THREE.BoxGeometry(0.006, 0.1, 0.004), glowGold, 1.8, [Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0], [0, 0, a + PI / 2], 0.6);
      }
    }
    const n = 4 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? star : glowGold, 0.014, [Math.cos(i * 2.2) * 0.5, 0.5 + (i % 3) * 0.28, Math.sin(i * 2.2) * 0.45 - 0.05], 0.08);
  },

  /** `noxfang`: a lean, tall dark wolf, with long fangs and red eyes, a crescent moon on the brow and an old wound above the eye, shadow flames and mane spikes on the shoulders and back, purple rune markings, orbiting shadow shards and moon arcs */
  noxfang(k, c, s) {
    const fur = 0x352a56;
    const furLt = 0x4c3f78;
    const furDk = 0x1e1630;
    const violet = 0xa06aff;
    const violetHi = 0xd8b0ff;
    const shadow = 0x5a2ac0;
    const red = 0xff2a4a;
    const moon = 0xd8c0ff;
    const bone = 0xd8d0e8;
    const claw = 0x120c1e;
    c.archetype = 'quad';
    const L = 0.46;
    const by = 0.62;

    // Body: a sturdy chest, a tight waist, powerful haunches; a pale belly; purple rune markings on the shoulder and haunch
    k.sphere(c.body, fur, 1, [0, by + 0.04, 0.16], [0.27, 0.27, 0.32]);
    k.sphere(c.body, fur, 1, [0, by - 0.02, -0.08], [0.2, 0.2, 0.26]);
    k.sphere(c.body, fur, 1, [0, by + 0.01, -0.3], [0.24, 0.24, 0.25]);
    k.sphere(c.body, furLt, 1, [0, by - 0.13, 0.02], [0.2, 0.13, 0.42], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) {
      glowPath(k, c.body, violet, [v3(sx * 0.27, by + 0.14, 0.24), v3(sx * 0.29, by + 0.04, 0.16), v3(sx * 0.28, by - 0.06, 0.24), v3(sx * 0.26, by - 0.12, 0.14)], 0.006, 1.9, 0.9, 24);
      glowPath(k, c.body, violet, [v3(sx * 0.24, by + 0.12, -0.24), v3(sx * 0.26, by + 0.02, -0.32), v3(sx * 0.245, by - 0.06, -0.22)], 0.006, 1.9, 0.9, 20);
      k.glow(c.body, new THREE.OctahedronGeometry(0.016, 0), violetHi, 2.4, [sx * 0.29, by + 0.04, 0.16]);
      // Dark fur tufts on the chest
      for (let i = 0; i < 3; i++) k.blade(c.body, furDk, 0.11, 0.06, 0.04, [sx * (0.06 + i * 0.06), by - 0.02 - i * 0.03, 0.42 - i * 0.03], [PI - 0.6, 0, sx * (0.3 + i * 0.35)]);
    }
    // Mane spikes and shadow flames: a row of backward-pointing black spikes along the back of the neck, two purple shadow flames on the shoulders, a string of small shadow flames along the spine
    for (let i = 0; i < 6; i++) k.cone(c.body, furDk, 0.05 - i * 0.004, 0.16 - i * 0.012, [0, by + 0.25 - i * 0.012, 0.2 - i * 0.11], [-1.0, 0, 0], 6);
    for (const sx of [-1, 1]) k.flame(c.body, shadow, violetHi, 0.12, [sx * 0.18, by + 0.24, 0.12], [-0.6, 0, sx * 0.3]);
    for (let i = 0; i < 3; i++) k.flame(c.body, shadow, violetHi, 0.07 - i * 0.01, [0, by + 0.25, -0.05 - i * 0.14], [-0.8, 0, 0]);
    // Bone shoulder guards: two pale bone plates (the gear left from the battle a thousand years ago)
    for (const sx of [-1, 1]) {
      const sp = k.group(c.body, [sx * 0.22, by + 0.16, 0.18], [0.2, 0, sx * 0.6]);
      hard(k, sp, poly([[-0.07, -0.06], [0.07, -0.06], [0.09, 0.02], [0.04, 0.07], [-0.04, 0.07], [-0.09, 0.02]], 0.02, 2), bone, [0, 0, 0], [PI / 2 + 0.3, 0, 0]);
      k.glow(sp, new THREE.BoxGeometry(0.008, 0.05, 0.006), violet, 2, [0, 0.008, 0.02]);
    }

    // Limbs: powerful wolf legs, black claws; a purple-light rune ring at each hind ankle and forewrist
    for (const sx of [-1, 1]) {
      for (const front of [true, false]) {
        const lg = quadLeg(k, c, c.body, sx, front ? 0.18 : 0.17, front ? 0.2 : -0.3, { col: fur, joint: furLt, r: front ? 0.065 : 0.068, len: L, front, foot: fur, bend: 0.3 });
        for (let i = -1; i <= 1; i++) k.horn(lg.foot, claw, 0.014, 0.055, 0.03, [i * 0.04, -0.015, 0.08], [PI / 2 + 0.5, 0, i * 0.25]);
        k.glow(lg.g, new THREE.TorusGeometry(0.056, 0.005, 6, 20), violet, 1.8, [0, -L * 0.8, front ? 0.03 : 0.0], [PI / 2, 0, 0], 0.85);
        if (s >= 2) k.flame(lg.foot, shadow, violetHi, 0.05, [0, 0.03, -0.06], [-1.1, 0, 0]);
      }
    }

    // Neck and head: a long muzzle, a black nose, exposed long fangs, sharp red eyes, angry brows, a glowing old wound above the eye, a crescent moon on the brow, tall ears
    const neck = taperTube([v3(0, by + 0.16, 0.3), v3(0, by + 0.3, 0.4), v3(0, by + 0.42, 0.46)], (t) => 0.13 - t * 0.03, 16, 12);
    k.mesh(c.body, neck.geo, fur);
    const head = k.group(c.body, [0, by + 0.48, 0.5], [0.15, 0, 0]);
    c.head = head;
    k.sphere(head, fur, 0.17, [0, 0, 0], [0.95, 0.88, 1.05]);
    k.sphere(head, fur, 0.1, [0, -0.06, 0.17], [0.85, 0.66, 1.5]);
    k.sphere(head, furLt, 0.075, [0, -0.11, 0.18], [0.8, 0.45, 1.35], [0, 0, 0], { outline: false });
    k.sphere(head, 0x0a0812, 0.032, [0, -0.02, 0.31], [1.15, 0.8, 0.8]);
    k.glow(head, new THREE.TorusGeometry(0.055, 0.005, 6, 20, PI * 0.8), 0x0a0812, 0.5, [0, -0.09, 0.27], [0.3, 0, PI + PI * 0.1]);
    for (const sx of [-1, 1]) {
      k.cone(head, bone, 0.014, 0.075, [sx * 0.055, -0.1, 0.25], [PI - 0.1, 0, sx * 0.1], 6);
      k.cone(head, bone, 0.009, 0.035, [sx * 0.03, -0.11, 0.29], [PI, 0, 0], 6, { outline: false });
    }
    k.eyes(head, { x: 0.085, y: 0.045, z: 0.13, r: 0.048, iris: red, glow: true, sharp: true });
    for (const sx of [-1, 1]) k.sphere(head, furDk, 0.045, [sx * 0.085, 0.105, 0.125], [1.35, 0.32, 0.6], [0, 0, sx * 0.45]);
    glowPath(k, head, violetHi, [v3(-0.12, 0.16, 0.1), v3(-0.1, 0.09, 0.15), v3(-0.115, -0.01, 0.165)], 0.007, 2.4, 0.95, 12);
    glowLink(k, head, violetHi, [-0.15, 0.1, 0.12], [-0.08, 0.075, 0.16], 0.005, 2.4);
    k.glow(head, new THREE.TorusGeometry(0.05, 0.012, 8, 24, PI * 1.25), moon, 2.6, [0, 0.11, 0.13], [0.5, 0, PI * 0.45]);
    for (const sx of [-1, 1]) {
      const eg = k.group(head, [sx * 0.09, 0.13, -0.03], [0.1, 0, -sx * 0.35]);
      k.cone(eg, fur, 0.05, 0.19, [0, 0, 0], [0, 0, 0], 8);
      k.cone(eg, violet, 0.028, 0.13, [0, 0.015, 0.02], [0, 0, 0], 8, { outline: false, emissive: violet, emissiveAmt: 0.3 });
      c.ears.push({ g: eg, phase: sx * 1.7 });
      k.blade(head, furDk, 0.12, 0.07, 0.04, [sx * 0.15, -0.03, 0.02], [0.2, 0, sx * 2.0]);
    }
    k.flame(head, shadow, violetHi, 0.07, [0, 0.16, -0.06], [-0.9, 0, 0]);

    // Tail: a thick wolf tail, a tuft of shadow flame at the tip
    const tail = k.group(c.body, [0, by + 0.06, -0.5], [0.4, 0, 0]);
    const tailPts = [v3(0, 0, 0.04), v3(0, -0.04, -0.2), v3(0, 0.02, -0.4), v3(0, 0.16, -0.54)];
    const tt = taperTube(tailPts, (t) => 0.075 * (1 - Math.abs(t - 0.45) * 0.8), 28, 12);
    k.mesh(tail, tt.geo, fur);
    for (let i = 0; i < 4; i++) {
      const t = 0.3 + i * 0.18;
      const p = tt.path.getPointAt(t);
      k.blade(tail, i % 2 ? furDk : furLt, 0.09, 0.05, 0.03, [(i % 2 ? 1 : -1) * 0.03, p.y + 0.03, p.z], [-1.9, 0, (i % 2 ? 1 : -1) * 0.5]);
    }
    const tip = tailPts[3];
    k.flame(tail, shadow, violetHi, 0.11, [tip.x, tip.y - 0.02, tip.z], [-0.6, 0, 0]);
    c.tails.push({ g: tail, phase: 0, amp: 0.2, axis: 'y' });

    // Orbiting shadow shards, a moon arc behind it, a dark shadow ring at the feet, purple floating light; after breakthrough a lunar eclipse behind it
    const orbit = k.group(c.body, [0, by + 0.05, -0.05], [0.3, 0, 0.15]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const rr = 0.52 + (i % 2) * 0.06;
      const sh = new THREE.OctahedronGeometry(0.022 + (i % 3) * 0.008, 0);
      const m = hard(k, orbit, sh, i % 2 ? furDk : furLt, [Math.cos(a) * rr, (i % 3 - 1) * 0.05, Math.sin(a) * rr], [i, i * 0.7, 0], { emissive: violet, emissiveAmt: i % 2 ? 0.5 : 0.2 });
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.03, speed: 1.4 + (i % 3) * 0.5, phase: i * 1.1 });
    }
    c.spinners.push({ g: orbit, speed: 0.6, axis: 'y' });
    spinRing(k, c, c.body, moon, 0.5, 0.009, [0, by + 0.28, -0.12], [0, 0, 0], -0.4, 'z', { beads: 3, beadCol: violetHi, beadR: 0.014, opacity: 0.75, arc: PI * 1.25 });
    spinRing(k, c, c.body, shadow, 0.6, 0.008, [0, 0.03, -0.05], [PI / 2, 0, 0], 0.6, 'y', { beads: 4, beadCol: violet, beadR: 0.014, opacity: 0.55, arc: PI * 1.4 });
    if (s === 3) {
      const ecl = k.group(c.body, [0, by + 0.3, -0.34]);
      k.glow(ecl, new THREE.TorusGeometry(0.42, 0.012, 8, 56), violetHi, 2.2, [0, 0, 0.005], [0, 0, 0], 0.8);
      k.glow(ecl, new THREE.TorusGeometry(0.36, 0.03, 8, 56), 0x1a1030, 1, [0, 0, 0], [0, 0, 0], 0.6);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + 0.5;
        k.glowSphere(ecl, moon, 0.016, [Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.01], 2.6);
      }
      c.spinners.push({ g: ecl, speed: 0.3, axis: 'z' });
    }
    const n = 4 + s;
    for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? violetHi : violet, 0.014, [Math.cos(i * 2.2) * 0.55, 0.4 + (i % 3) * 0.25, Math.sin(i * 2.2) * 0.5 - 0.05], 0.08);
  },
};

const B: Record<string, Builder> = {
  ...BASE,
  ...SPECIES_TOWN,
  ...SPECIES_NATURE_WATER,
  ...SPECIES_FIRE_WIND,
  ...SPECIES_EARTH_THUNDER,
  ...SPECIES_LIGHT_DARK,
  ...SPECIES_LEGENDS,
  // The remade versions of the first batch go last, overriding the BASE builders of the same name
  ...SPECIES_FIRSTN,
  ...SPECIES_FIRSTR,
  ...SPECIES_FIRSTSR,
};

// ───────────────────────── Assembly and normalization ─────────────────────────

/** Height (world units) of the three breakthrough stages for each rarity: every spirit has only one form, and breakthrough only enlarges it slightly (about 0.15 per stage) */
export const TARGET: Record<string, [number, number, number]> = {
  N: [1.55, 1.7, 1.85],
  R: [1.65, 1.8, 1.95],
  SR: [1.7, 1.85, 2.0],
  SSR: [2.35, 2.5, 2.65],
};

/**
 * Spirits switched to the post-process outline version (spiritToon material + INK_LAYER). Added only after being remade to the model spec in ?lab and ported back;
 * switching an old model's pipeline directly would blur it (translucent fog shells, many glowing points plus bloom), so this is empty by default.
 * A dev page can temporarily change this set for before/after comparison (?viewer&ink=off, &ink=a,b).
 */
export const INK_SPECIES = new Set<string>();

/** For dev pages: &ink=off reverts everything to the old outline, &ink=a,b enables extra ones; &port=a,b|all|off temporarily ports in lab models (render/labCreature.ts) */
export function applyInkParam(q: URLSearchParams): void {
  const v = q.get('ink');
  if (v === 'off') INK_SPECIES.clear();
  else if (v) for (const id of v.split(',')) if (id) INK_SPECIES.add(id);
  applyPortParam(q);
}

export function buildCreature(speciesId: string, stage: Stage, rarity: string, opts: { corrupted?: boolean } = {}): Creature {
  // Lab models already ported into the game: only one form, and the three breakthrough stages just scale up by TARGET
  if (isPorted(speciesId)) {
    const c = buildLabCreature(speciesId, stage, (TARGET[rarity] ?? TARGET.R)[stage - 1]);
    if (opts.corrupted) applyCorruption(c);
    return c;
  }
  const c = new Creature();
  const k = new Kit(c, undefined, { ink: INK_SPECIES.has(speciesId) });
  const fn = B[speciesId];
  // Every spirit has only one form: old builders always assemble the stage III look (the SR and SSR breakthrough light effects are stage III's too), and the height is then scaled by TARGET[stage]
  if (fn) fn(k, c, 3);
  else k.sphere(c.body, 0xcccccc, 0.4, [0, 0.4, 0]);


  // Normalize size
  c.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(c.scaler);
  const size = box.getSize(new THREE.Vector3());
  const localH = Math.max(size.y + c.hover, size.z * 0.7, size.x * 0.6);
  const target = (TARGET[rarity] ?? TARGET.R)[stage - 1];
  const scale = target / Math.max(0.2, localH);
  c.scaler.scale.setScalar(scale);
  c.height = size.y;
  c.width = Math.max(size.x, size.z) * scale;
  c.worldHeight = (size.y + c.hover) * scale;
  // Corruption is added after size normalization (the void crystals on the back do not count toward the height)
  if (opts.corrupted) applyCorruption(c);
  return c;
}

