// Second-batch spirit models (see docs/09-bestiary.md): single-form SRs (`phoenix`, `tornado`, `griffin`, `weaverspider`)
// and the legendary SSRs (`eldarin`, `astragate`, `voidchild`, `chronodragon`).
// These spirits are the stars of the battle screen: the model needs a clear main subject, multiple material layers, glowing markings, and at least one continuously moving energy part.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit, PartOpts } from '../creature.ts';
import { outlineMaterial } from '../toon.ts';
import { floater, PI, sparkle, tailChain, type Builder, type C, type V3 } from '../parts.ts';

// ───────────────────────── Shared helpers ─────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const hardOutlines = new WeakMap<Creature, THREE.ShaderMaterial>();

/** Angular parts (extrusions, polyhedra): the outline uses a copy with smooth normals pushed outward, so the hard-edge normals do not tear the outline into fragments */
function hard(k: Kit, parent: THREE.Object3D, geo: THREE.BufferGeometry, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  // The post-process outline version does not need an outline copy with smooth normals and draws the lines directly as an ordinary part
  if (k.ink) return k.mesh(parent, geo, col, pos, rot, o);
  const m = k.mesh(parent, geo, col, pos, rot, { ...o, outline: false });
  let om = hardOutlines.get(k.c);
  if (!om) {
    om = outlineMaterial(k.outline);
    k.c.outlines.push(om);
    hardOutlines.set(k.c, om);
  }
  const smooth = new THREE.BufferGeometry();
  smooth.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) smooth.setIndex(geo.index.clone());
  const merged = mergeVertices(smooth, 1e-4);
  merged.computeVertexNormals();
  m.add(new THREE.Mesh(merged, om));
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
function link(k: Kit, parent: THREE.Object3D, color: C, a: V3, b: V3, r: number, o: PartOpts = {}): THREE.Mesh {
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

/** Lightning-bolt (⚡) plate: extends from 0 to len along +y, width w, thickness along z */
function boltGeo(len: number, w: number, depth = 0.02): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.056, 1], [-0.5, 0.4], [0, 0.4], [-0.056, 0], [0.5, 0.6], [0, 0.6]];
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * w, y * len)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Thin plate extruded from a 2D outline (wing membrane, crown fragment, clock hand), centered on z */
function poly(pts: [number, number][], depth: number, curveSegments = 8): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments });
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
    const a = (i / n) * PI * 2;
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

/** A whole patch of small spikes merged into one mesh (scale spines, dorsal fin) */
function mergedMesh(k: Kit, parent: THREE.Object3D, col: C, geos: THREE.BufferGeometry[], o: PartOpts = {}): THREE.Mesh | null {
  if (!geos.length) return null;
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const geo = mergeGeometries(list);
  if (!geo) return null;
  return k.mesh(parent, geo, col, [0, 0, 0], [0, 0, 0], o);
}

/** Turn geometry built along +y toward dir and move it to pos */
function place(g: THREE.BufferGeometry, pos: THREE.Vector3, dir: THREE.Vector3): THREE.BufferGeometry {
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  g.translate(pos.x, pos.y, pos.z);
  return g;
}

/**
 * Dragon wing outline (2D, x = chordwise, backward; y = spanwise): the wing bone runs along +y from shoulder to wrist, four wing fingers fan out from the wrist,
 * and between the fingertips are scalloped concave edges. After extruding, rotateY(PI/2) turns +x into −z, so the membrane lies in the yz plane
 * and stays spread horizontally as the group flaps about the z axis.
 */
function dragonWing(L: number): { membrane: [number, number][]; wrist: [number, number]; tips: [number, number][] } {
  const wrist: [number, number] = [0, L * 0.5];
  const tips: [number, number][] = [
    [L * 0.04, L * 1.0],
    [L * 0.46, L * 0.86],
    [L * 0.74, L * 0.56],
    [L * 0.8, L * 0.2],
  ];
  const membrane: [number, number][] = [[0, 0], [0, L * 0.5], tips[0]];
  for (let i = 1; i < tips.length; i++) {
    const [ax, ay] = tips[i - 1];
    const [bx, by] = tips[i];
    for (let j = 1; j <= 6; j++) {
      const t = j / 7;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const dip = Math.sin(t * PI) * 0.3;
      membrane.push([x + (wrist[0] - x) * dip, y + (wrist[1] - y) * dip]);
    }
    membrane.push(tips[i]);
  }
  membrane.push([L * 0.42, -L * 0.02], [L * 0.12, -L * 0.06]);
  return { membrane, wrist, tips };
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Roughly uniformly distributed directions on a sphere */
function fib(n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const ga = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    out.push(v3(Math.cos(i * ga) * rr, y, Math.sin(i * ga) * rr));
  }
  return out;
}

/** A zigzag crack running along the sphere: starts at dir0 and random-walks along the tangent, returning a point list slightly above the sphere */
function crackOnSphere(R: number, dir0: THREE.Vector3, steps: number, step: number, seed: number, lift = 1.012): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const p = dir0.clone().normalize();
  const ref = Math.abs(p.y) < 0.8 ? UP : v3(1, 0, 0);
  const t = new THREE.Vector3().crossVectors(p, ref).normalize();
  t.applyAxisAngle(p, hash(seed) * PI * 2);
  for (let i = 0; i <= steps; i++) {
    pts.push(p.clone().multiplyScalar(R * lift));
    const side = new THREE.Vector3().crossVectors(p, t).normalize();
    const jit = (hash(seed + i * 7.3) - 0.5) * 1.4;
    p.addScaledVector(t, step).addScaledVector(side, jit * step).normalize();
    t.sub(p.clone().multiplyScalar(t.dot(p))).normalize();
  }
  return pts;
}

/** Body of revolution along the z axis (torso): profile is (radius, z), sorted by z so the normals face outward; scale makes the cross-section not a perfect circle */
function lathed(profile: [number, number][], scale: V3 = [1, 1, 1], seg = 32): THREE.BufferGeometry {
  const pts = [...profile].sort((a, b) => a[1] - b[1]).map(([r, z]) => new THREE.Vector2(r, z));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateX(PI / 2);
  g.scale(...scale);
  return g;
}

/** Low-segment sphere (joints, nostrils, scale plates stuck on the surface): saves triangles */
function ball(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PartOpts = {}, seg = 14): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.75)));
  g.scale(...scale);
  return k.mesh(parent, g, col, pos, rot, o);
}

/** Flat diamond gem (a glowing emblem stuck on a magic circle, wing membrane or armor), lying in the xy plane */
function flatGem(r: number, tall = 1.4, thin = 0.45): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(r, 0);
  g.scale(1, tall, thin);
  return g;
}

/**
 * Sigil / Star Gate style magic-circle ring: a main ring + a thin inner ring + radial rune engravings + a few orbiting diamonds;
 * the ring lies in the holder's xy plane, and the whole group is registered as a spinner rotating about the local z axis, with the engravings and diamonds going along so the rotation is visible.
 */
function sigil(
  k: Kit,
  c: Creature,
  parent: THREE.Object3D,
  col: C,
  hi: C,
  R: number,
  pos: V3,
  rot: V3,
  speed: number,
  o: { ticks?: number; gems?: number; r?: number; inner?: number; intensity?: number; opacity?: number } = {},
): THREE.Group {
  const holder = k.group(parent, pos, rot);
  const spin = k.group(holder);
  const r = o.r ?? R * 0.025;
  const I = o.intensity ?? 2.2;
  const op = o.opacity ?? 1;
  k.glow(spin, new THREE.TorusGeometry(R, r, 6, 64), col, I, [0, 0, 0], [0, 0, 0], op);
  if (o.inner !== 0) k.glow(spin, new THREE.TorusGeometry(R * (o.inner ?? 0.8), r * 0.55, 6, 56), hi, I * 0.85, [0, 0, 0], [0, 0, 0], Math.min(op, 0.85));
  const ticks = o.ticks ?? 8;
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * PI * 2;
    const len = i % 2 ? R * 0.1 : R * 0.16;
    k.glow(spin, new THREE.BoxGeometry(r * 1.6, len, r * 1.6), col, I, [Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, 0], [0, 0, a + PI / 2], op);
  }
  const gems = o.gems ?? 3;
  for (let i = 0; i < gems; i++) {
    const a = (i / gems) * PI * 2 + PI / 2;
    k.glow(spin, flatGem(r * 3.2, 1.5, 0.6), hi, I + 0.4, [Math.cos(a) * R, Math.sin(a) * R, 0], [0, 0, a]);
  }
  c.spinners.push({ g: spin, speed, axis: 'z' });
  return holder;
}

// ───────────────────────── Legendary SSRs ─────────────────────────

/**
 * `eldarin`: an elegant white-gold quadruped dragon. A torso of revolution with a deep chest and slim waist, white-gold shoulder and hip armor, a long S-shaped neck,
 * a pact sigil circle on the brow, a ring behind the head (the "First Pact Ring"), pact-sigil roundels on the pale gold wing membranes, interlocking light rings at the tail tip, and pact fragments flying around the body.
 */
const eldarin: Builder = (k, c, s) => {
  const col = 0xf4ecdc;
  const cream = 0xfff9ec;
  const shade = 0xd9cdb4;
  const plat = 0xdcd6c8;
  const gold = 0xffd24a;
  const goldDeep = 0xd9a532;
  const membrane = 0xefd48c;
  const glowGold = 0xffe9a0;
  const dark = 0x5a4a3c;
  c.archetype = 'quad';
  const legH = 0.47;
  const bodyY = 0.68;
  const B = c.body;

  // Torso: a body of revolution along z, deep chest, slim waist, round haunches, the cross-section slightly taller than wide
  k.mesh(B, lathed([[0.03, -0.56], [0.15, -0.51], [0.225, -0.4], [0.235, -0.26], [0.215, -0.12], [0.25, 0.04], [0.28, 0.2], [0.26, 0.36], [0.17, 0.47], [0.03, 0.52]], [0.9, 1.06, 1]), col, [0, bodyY, 0]);
  // Cream scale plates on the belly side: laid along the bottom of the torso all the way to the haunch
  const girth: [number, number][] = [[0.4, 0.24], [0.28, 0.275], [0.15, 0.275], [0.02, 0.25], [-0.11, 0.215], [-0.24, 0.232], [-0.37, 0.228]];
  for (let i = 0; i < girth.length; i++) {
    const [z, r] = girth[i];
    ball(k, B, cream, 1, [0, bodyY - r * 1.06 * 0.84, z], [r * 0.7, 0.05, 0.078], [0, 0, 0], { outline: false }, 12);
  }
  // Spine: a row of pale gold fins from the neck base to the tail base, with an inner glow
  const spine: [number, number][] = [[0.34, 0.265], [0.22, 0.28], [0.1, 0.27], [-0.02, 0.245], [-0.14, 0.215], [-0.26, 0.235], [-0.38, 0.225], [-0.48, 0.16]];
  for (let i = 0; i < spine.length; i++) {
    const [z, r] = spine[i];
    const L = 0.07 + Math.sin(((i + 0.5) / spine.length) * PI) * 0.07;
    k.blade(B, cream, L, 0.05, 0.018, [0, bodyY + r * 1.06 - 0.015, z], [-0.75, 0, 0], { emissive: gold, emissiveAmt: 0.28 });
  }
  // White-gold neck guard at the neck base: a thick ring + gold edge, tilted along the direction of the neck
  k.torus(B, plat, 0.15, 0.026, [0, bodyY + 0.2, 0.37], [-1.0, 0, 0]);
  k.torus(B, gold, 0.162, 0.011, [0, bodyY + 0.212, 0.366], [-1.0, 0, 0], PI * 2, { outline: false });
  // Pact sigil chest ornament: a gold ring set with a glowing diamond
  const brooch = k.group(B, [0, bodyY + 0.02, 0.475], [-0.55, 0, 0]);
  k.torus(brooch, gold, 0.058, 0.013, [0, 0, 0]);
  k.glow(brooch, flatGem(0.032, 1.4), glowGold, 2.6, [0, 0, 0.012]);
  for (let i = 0; i < 4; i++) {
    const a = i * PI * 0.5 + PI / 4;
    k.glow(brooch, new THREE.BoxGeometry(0.006, 0.02, 0.006), gold, 2.2, [Math.cos(a) * 0.072, Math.sin(a) * 0.072, 0.004], [0, 0, a + PI / 2]);
  }
  // Shoulder and hip armor: white-gold round plates, gold edges, a small gem
  for (const sx of [-1, 1]) {
    for (const [z, y, rr] of [[0.2, 0.2, 0.135], [-0.3, 0.17, 0.12]] as [number, number, number][]) {
      const g = k.group(B, [sx * (0.27 - rr * 0.45), bodyY + y, z], [0, 0, -sx * 0.7]);
      k.sphere(g, plat, 1, [0, 0, 0], [rr, rr * 0.5, rr * 1.05]);
      k.torus(g, gold, rr * 0.84, 0.014, [0, rr * 0.2, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      k.glow(g, flatGem(rr * 0.16, 1.3), glowGold, 2.4, [0, rr * 0.62, 0], [PI / 2, 0, 0]);
    }
    // Pact sigil veins on the flank: a line of gold light from the shoulder armor to the hip armor
    glowPath(k, B, glowGold, [v3(sx * 0.245, bodyY + 0.06, 0.3), v3(sx * 0.26, bodyY - 0.03, 0.12), v3(sx * 0.225, bodyY - 0.06, -0.08), v3(sx * 0.235, bodyY, -0.24), v3(sx * 0.2, bodyY + 0.06, -0.4)], 0.007, 1.8, 0.9, 32);
    k.glow(B, flatGem(0.016, 1.4), gold, 2.4, [sx * 0.232, bodyY - 0.06, -0.08], [0, sx * PI * 0.5, 0]);
  }

  // Slender limbs: hip ball, thigh, knee, shin, gold ankle ring, paw and three gold claws
  const legAt = (sx: number, z: number, front: boolean) => {
    const g = k.group(B, [sx * (front ? 0.2 : 0.19), legH, z]);
    ball(k, g, col, 0.085, [0, 0, 0], [1, 1.1, 1.1]);
    k.capsule(g, col, 0.06, 0.15, [0, -0.12, front ? 0.01 : -0.035], [front ? -0.1 : 0.32, 0, 0]);
    ball(k, g, shade, 0.052, [0, -0.225, front ? 0.025 : -0.06]);
    k.capsule(g, col, 0.046, 0.15, [0, -0.32, front ? 0.03 : -0.035], [front ? 0.05 : -0.22, 0, 0]);
    k.torus(g, gold, 0.052, 0.011, [0, -0.365, front ? 0.033 : -0.018], [PI / 2, 0, 0]);
    const foot = k.group(g, [0, -legH + 0.052, front ? 0.05 : 0.02]);
    k.sphere(foot, col, 0.07, [0, 0, 0], [1.1, 0.55, 1.3]);
    for (let i = -1; i <= 1; i++) k.cone(foot, goldDeep, 0.016, 0.07, [i * 0.04, -0.012, 0.075], [PI / 2 + 0.3, 0, i * 0.25], 8);
    c.legs.push({ g, phase: sx * (front ? 1 : -1) > 0 ? 0 : PI, amp: 1 });
  };
  for (const sx of [-1, 1]) {
    legAt(sx, 0.22, true);
    legAt(sx, -0.3, false);
  }

  // Long neck: an S-shaped tapered tube, a row of cream scale plates at the throat, a glowing pact sigil vein on each side
  const neckPts = [v3(0, bodyY + 0.12, 0.34), v3(0, bodyY + 0.34, 0.5), v3(0, bodyY + 0.56, 0.55), v3(0, bodyY + 0.74, 0.52)];
  const neckR = (t: number) => 0.125 - t * 0.05;
  const neck = taperTube(neckPts, neckR, 32, 14);
  k.mesh(B, neck.geo, col);
  for (let i = 0; i < 5; i++) {
    const t = 0.12 + i * 0.19;
    const p = neck.path.getPointAt(t);
    const tan = neck.path.getTangentAt(t);
    const rr = neckR(t);
    const pg = aim(k.group(B, [p.x, p.y - tan.y * 0 - rr * 0.32, p.z + rr * 0.78]), tan);
    ball(k, pg, cream, 1, [0, 0, 0], [rr * 0.72, rr * 0.4, rr * 0.28], [0, 0, 0], { outline: false }, 12);
  }
  for (const sx of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = 0.08 + (i / 8) * 0.84;
      const p = neck.path.getPointAt(t);
      pts.push(v3(sx * neckR(t) * 0.96, p.y, p.z + 0.012));
    }
    glowPath(k, B, glowGold, pts, 0.006, 1.8, 0.9, 24);
  }

  // Head: muzzle, lower jaw, nostrils, mouth line, big gold-pupilled eyes with eyeliner, brow ridges, backward-curved horns, fan-shaped ear fins
  const head = k.group(B, [0, bodyY + 0.77, 0.5], [0.22, 0, 0]);
  c.head = head;
  k.sphere(head, col, 0.172, [0, 0, 0], [0.92, 0.86, 1.05]);
  k.sphere(head, col, 0.105, [0, -0.05, 0.17], [0.7, 0.58, 1.4]);
  k.sphere(head, col, 0.06, [0, 0.03, 0.2], [0.75, 0.5, 1.6]);
  k.sphere(head, cream, 0.09, [0, -0.1, 0.15], [0.66, 0.4, 1.3], [0, 0, 0], { outline: false });
  for (const sx of [-1, 1]) {
    ball(k, head, dark, 0.011, [sx * 0.04, -0.03, 0.3], [0.7, 1, 0.5], [0, sx * 0.9, 0], { outline: false }, 10);
    k.capsule(head, dark, 0.0035, 0.1, [sx * 0.064, -0.088, 0.2], [PI / 2 - 0.05, 0, 0], { outline: false });
  }
  k.eyes(head, { x: 0.1, y: 0.035, z: 0.11, r: 0.06, iris: gold });
  for (const sx of [-1, 1]) {
    ball(k, head, shade, 0.052, [sx * 0.1, 0.095, 0.1], [1.3, 0.35, 0.7], [0, 0, -sx * 0.3]);
    k.torus(head, dark, 0.054, 0.005, [sx * 0.1, 0.04, 0.135], [0, sx * 0.28, sx * 0.25], PI * 0.8, { outline: false });
  }
  for (const sx of [-1, 1]) {
    const hg = k.group(head, [sx * 0.08, 0.1, -0.04], [-1.05, 0, -sx * 0.32]);
    k.horn(hg, col, 0.038, 0.36, 0.13, [0, 0, 0]);
    k.torus(hg, gold, 0.04, 0.009, [0, 0.05, -0.004], [PI / 2, 0, 0]);
    k.torus(hg, gold, 0.029, 0.007, [0, 0.17, -0.036], [PI / 2 + 0.3, 0, 0]);
    k.cone(hg, goldDeep, 0.013, 0.085, [0, 0.31, -0.127], [-0.12, 0, 0], 8);
    // Ear fin: pale gold membrane stretched by three fin bones
    const fin = k.group(head, [sx * 0.13, 0.0, -0.05], [0.25, 0, -sx * 1.2]);
    hard(k, fin, poly([[0, -0.01], [0.015, 0.14], [0.065, 0.11], [0.1, 0.03], [0.06, -0.025]], 0.012, 3), membrane, [0, 0, 0], [0, 0, 0], { emissive: gold, emissiveAmt: 0.3 });
    for (const [x, y] of [[0.015, 0.14], [0.065, 0.11], [0.1, 0.03]] as [number, number][]) link(k, fin, col, [0, 0, 0], [x, y, 0], 0.008);
    c.ears.push({ g: fin, phase: sx * 1.7 });
  }
  // Brow sigil: a main ring + inner ring + engravings + a central diamond, with a thin outer ring turning slowly the other way
  const seal = k.group(head, [0, 0.118, 0.12], [-0.6, 0, 0]);
  sigil(k, c, seal, gold, glowGold, 0.05, [0, 0, 0], [0, 0, 0], 0.9, { ticks: 8, gems: 3, r: 0.0065, intensity: 1.8 });
  k.glow(seal, flatGem(0.017, 1.5), 0xfff2c0, 2.3, [0, 0, 0.006]);
  sigil(k, c, seal, glowGold, gold, 0.085, [0, 0, 0.012], [0, 0, 0], -0.5, { ticks: 0, gems: 3, r: 0.003, inner: 0, opacity: 0.8 });

  // First Pact Ring: a big upright magic circle behind the head, framing the whole face; it turns slowly, with the rune engravings and diamonds going along
  const halo = k.group(B, [0, bodyY + 0.8, 0.22], [-0.25, 0, 0]);
  sigil(k, c, halo, gold, glowGold, 0.36, [0, 0, 0], [0, 0, 0], 0.45, { ticks: 12, gems: 4, r: 0.009, intensity: 1.9 });
  sigil(k, c, halo, glowGold, 0xfff2c0, 0.28, [0, 0, -0.014], [0, 0, 0], -0.7, { ticks: 6, gems: 3, r: 0.004, inner: 0, opacity: 0.75, intensity: 1.7 });
  k.glow(halo, new THREE.CircleGeometry(0.35, 48), glowGold, 0.9, [0, 0, -0.024], [0, 0, 0], 0.08);

  // Wings: wing bone, four wing fingers, pale gold wing membrane (an inner layer of brighter light membrane), gold wing veins and pact sigil roundels
  const L = 0.95;
  const wing = dragonWing(L);
  for (const sx of [-1, 1]) {
    // Wings raised about 50° and swept back slightly; the membrane lifts its trailing edge about the wing bone, so the membrane surface is visible from the front and a 3/4 view
    const flap = k.group(B, [sx * 0.13, bodyY + 0.24, 0.06], [0, sx * 0.12, 0]);
    const w = k.group(flap, [0, 0, 0], [0, -sx * 0.38, 0]);
    const mem = poly(wing.membrane, 0.016, 6);
    mem.rotateY(PI / 2);
    hard(k, w, mem, membrane, [0, 0, 0], [0, 0, 0], { emissive: gold, emissiveAmt: 0.16 });
    const inner = poly(wing.membrane.map(([x, y]) => [x * 0.86 + wing.wrist[0] * 0.14, y * 0.86 + wing.wrist[1] * 0.14]), 0.02, 6);
    inner.rotateY(PI / 2);
    k.glow(w, inner, glowGold, 1.15, [0, 0, 0], [0, 0, 0], 0.3);
    // The 2D outline's (u, y) → 3D (0, y, −u)
    const P = (u: number, y: number, x = 0): V3 => [x, y, -u];
    const wr = P(wing.wrist[0], wing.wrist[1]);
    ball(k, w, col, 0.052, [0, 0, 0]);
    link(k, w, col, [0, 0, 0], P(-0.01, L * 0.26), 0.04);
    ball(k, w, shade, 0.04, P(-0.01, L * 0.26));
    link(k, w, col, P(-0.01, L * 0.26), wr, 0.035);
    ball(k, w, shade, 0.038, wr);
    k.cone(w, goldDeep, 0.014, 0.07, P(0.02, L * 0.52), [-0.4, 0, 0], 8);
    for (const [tu, ty] of wing.tips) {
      link(k, w, col, wr, P(tu, ty), 0.02);
      const d = new THREE.Vector3(0, ty - wing.wrist[1], -(tu - wing.wrist[0])).normalize();
      aim(k.cone(w, goldDeep, 0.012, 0.05, P(tu, ty), [0, 0, 0], 8), d);
      for (const xx of [0.016, -0.016]) glowLink(k, w, glowGold, P(wing.wrist[0], wing.wrist[1], xx), P(tu * 0.93 + wing.wrist[0] * 0.07, ty * 0.93 + wing.wrist[1] * 0.07, xx), 0.006, 1.8, 0.85);
    }
    for (const xx of [0.014, -0.014]) {
      k.glow(w, new THREE.TorusGeometry(L * 0.14, 0.005, 6, 32), glowGold, 1.7, P(L * 0.36, L * 0.52, xx), [0, PI / 2, 0], 0.7);
      k.glow(w, new THREE.TorusGeometry(L * 0.09, 0.004, 6, 28), gold, 1.7, P(L * 0.36, L * 0.52, xx), [0, PI / 2, 0], 0.7);
      k.glow(w, flatGem(L * 0.03, 1.5), gold, 2.2, P(L * 0.36, L * 0.52, xx), [0, PI / 2, 0]);
    }
    c.wings.push({ g: flap, side: sx < 0 ? 1 : -1, base: 0.7, amp: 0.12, speed: 2.0 });
  }

  // Tail: a long S-shaped tapered tube, a row of small fins along the spine, a gold band near the tip, a gold core at the tip and two interlocking light rings
  const tail = k.group(B, [0, bodyY - 0.03, -0.5], [0.08, 0, 0]);
  const tailPts = [v3(0, 0.02, 0.06), v3(0, -0.06, -0.26), v3(0, -0.04, -0.5), v3(0, 0.1, -0.7), v3(0, 0.34, -0.82)];
  const tailR = (t: number) => 0.095 * (1 - t * 0.7);
  const tt = taperTube(tailPts, tailR, 40, 12);
  k.mesh(tail, tt.geo, col);
  for (let i = 0; i < 5; i++) {
    const t = 0.14 + i * 0.17;
    const p = tt.path.getPointAt(t);
    const rr = tailR(t);
    k.blade(tail, cream, rr * 1.25, rr * 0.7, 0.014, [0, p.y + rr * 0.85, p.z], [-0.75, 0, 0], { emissive: gold, emissiveAmt: 0.28 });
  }
  {
    const t = 0.86;
    const p = tt.path.getPointAt(t);
    const bg = aim(k.group(tail, [p.x, p.y, p.z]), tt.path.getTangentAt(t));
    k.torus(bg, gold, tailR(t) * 1.02, 0.01, [0, 0, 0], [PI / 2, 0, 0]);
  }
  c.tails.push({ g: tail, phase: 0, amp: 0.16, axis: 'y' });
  const tipP = tailPts[4];
  const tipG = k.group(tail, [tipP.x, tipP.y, tipP.z]);
  k.glow(tipG, new THREE.OctahedronGeometry(0.05, 0), gold, 2.6);
  k.glowSphere(tipG, 0xfff2c0, 0.03, [0, 0, 0], 3);
  k.glowSphere(tipG, glowGold, 0.1, [0, 0, 0], 0.9, [1, 1, 1], 0.28);
  spinRing(k, c, tipG, glowGold, 0.17, 0.008, [0, 0, 0], [PI / 2 + 0.45, 0, 0], 1.5, 'y', { beads: 3, beadCol: gold, beadR: 0.02 });
  spinRing(k, c, tipG, gold, 0.115, 0.007, [0, 0, 0], [0.35, 0, 0], -2.2, 'x', { beads: 2, beadCol: 0xfff2c0, beadR: 0.015 });

  // Pact fragments flying around the body: five gold diamonds orbiting slowly on a tilted orbit, each bobbing on its own
  const orbit = k.group(B, [0, bodyY + 0.12, -0.05], [0.28, 0, 0.12]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    const rr = 0.66;
    const pg = k.group(orbit, [Math.cos(a) * rr, (i % 2) * 0.06 - 0.03, Math.sin(a) * rr], [0, -a, 0]);
    k.glow(pg, flatGem(0.028, 1.7), i % 2 ? gold : glowGold, 2.4, [0, 0, 0], [0, PI / 2, 0]);
    k.glowSphere(pg, 0xfff2c0, 0.012, [0, 0, 0], 2.8);
    c.bobbers.push({ g: pg, base: pg.position.y, amp: 0.03, speed: 1.8 + i * 0.35, phase: i * 1.3 });
  }
  c.spinners.push({ g: orbit, speed: 0.45, axis: 'y' });
  // Floating gold motes
  const n = 3 + s;
  for (let i = 0; i < n; i++) sparkle(k, c, B, i % 2 ? glowGold : gold, 0.02, [Math.cos(i * 2.1) * 0.5, 0.6 + (i % 3) * 0.22, Math.sin(i * 2.1) * 0.4 - 0.05], 0.06);
};

/**
 * `astragate`: an upright giant built from city-wall stone. Masonry joints, gold inlays, layered shoulder and waist armor,
 * a starlight-stone core in the chest (spinning + radiating rays), a hexagonal crystal shield floating before the left arm, a stone Star Gate behind it (a double rotating light ring, a starry door curtain, orbiting rune stones),
 * and a ring of city-wall stones orbiting above the head like a crown.
 */
const astragate: Builder = (k, c, s) => {
  const stone = 0xd8d4c8;
  const stoneDk = 0xb9b3a4;
  const slate = 0x555a6c;
  const gold = 0xe6c264;
  const core = 0x8fd8ff;
  const coreHi = 0xe0f6ff;
  c.archetype = 'biped';
  const B = c.body;
  /** Gold inlay: a long thin gold bar, glowing slightly */
  const vein = (parent: THREE.Object3D, len: number, pos: V3, rot: V3 = [0, 0, 0], w = 0.012) => k.glow(parent, new THREE.BoxGeometry(w, len, w * 0.8), gold, 1.5, pos, rot);
  /** Masonry joint: a thin dark ring */
  const seam = (parent: THREE.Object3D, R: number, pos: V3, rot: V3 = [PI / 2, 0, 0]) => k.torus(parent, slate, R, 0.008, pos, rot, PI * 2, { outline: false });

  // Legs: pillar-like thighs and shins, masonry joints, knee armor, broad feet and three toe stones
  for (const sx of [-1, 1]) {
    const g = k.group(B, [sx * 0.23, 0.64, 0]);
    ball(k, g, stoneDk, 0.11, [0, 0, 0]);
    k.cyl(g, stone, 0.105, 0.115, 0.22, [0, -0.15, 0], [0, 0, 0], 16);
    seam(g, 0.108, [0, -0.1, 0]);
    seam(g, 0.113, [0, -0.2, 0]);
    vein(g, 0.12, [sx * 0.04, -0.15, 0.104], [0, 0, sx * 0.1]);
    const knee = new THREE.DodecahedronGeometry(0.1, 0);
    knee.scale(1.15, 0.9, 0.9);
    hard(k, g, knee, stone, [0, -0.29, 0.05]);
    k.glow(g, flatGem(0.022, 1.4), core, 2.2, [0, -0.29, 0.135]);
    k.cyl(g, stone, 0.1, 0.125, 0.24, [0, -0.43, 0], [0, 0, 0], 16);
    seam(g, 0.112, [0, -0.44, 0]);
    vein(g, 0.14, [0, -0.43, 0.118]);
    k.torus(g, gold, 0.128, 0.014, [0, -0.54, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    const foot = k.group(g, [0, -0.59, 0.04]);
    ball(k, foot, stoneDk, 0.1, [0, 0, 0], [1.35, 0.5, 1.6]);
    for (let i = -1; i <= 1; i++) ball(k, foot, stone, 0.042, [i * 0.06, 0.0, 0.13], [1, 0.7, 1.2]);
    c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.5 });
  }
  // Pelvis, belt, waist armor: five hanging stone slabs around the belt, each with a gold edge
  ball(k, B, stoneDk, 1, [0, 0.7, 0], [0.3, 0.14, 0.22]);
  k.torus(B, gold, 0.27, 0.024, [0, 0.76, 0], [PI / 2, 0, 0]);
  k.glow(B, flatGem(0.036, 1.3), core, 2.2, [0, 0.76, 0.25]);
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) / 5) * PI * 2 + PI;
    const g = k.group(B, [Math.sin(a) * 0.25, 0.75, Math.cos(a) * 0.19], [0.12, a, 0]);
    hard(k, g, poly([[-0.075, 0], [0.075, 0], [0.065, -0.2], [0, -0.25], [-0.065, -0.2]], 0.035, 2), stone);
    vein(g, 0.14, [0, -0.1, 0.022], [0, 0, 0], 0.01);
  }

  // Torso: abdomen and chest in two sections, three masonry plates on the chest (the middle one set with the starlight-stone core), gold inlay running along the plate edges
  ball(k, B, stone, 1, [0, 0.88, 0], [0.3, 0.2, 0.24], [0, 0, 0], {}, 20);
  seam(B, 0.245, [0, 0.9, 0.11], [0.35, 0, 0]);
  k.sphere(B, stone, 1, [0, 1.1, -0.02], [0.4, 0.3, 0.3]);
  const midPts: [number, number][] = [[-0.16, -0.2], [0.16, -0.2], [0.2, 0.12], [0.12, 0.26], [-0.12, 0.26], [-0.2, 0.12]];
  const mid = poly(midPts, 0.06, 4);
  const midG = k.group(B, [0, 1.1, 0.26], [-0.1, 0, 0]);
  hard(k, midG, mid, 0xe6e2d6);
  for (let i = 0; i < midPts.length; i++) {
    const a = midPts[i];
    const b = midPts[(i + 1) % midPts.length];
    glowLink(k, midG, gold, [a[0] * 0.94, a[1] * 0.94, 0.035], [b[0] * 0.94, b[1] * 0.94, 0.035], 0.006, 1.5);
  }
  for (const sx of [-1, 1]) {
    const side = poly([[-0.09, -0.14], [0.09, -0.16], [0.11, 0.1], [0.06, 0.2], [-0.07, 0.2], [-0.11, 0.05]], 0.05, 3);
    hard(k, B, side, stone, [sx * 0.29, 1.1, 0.19], [-0.1, sx * 0.55, 0]);
    vein(B, 0.28, [sx * 0.2, 1.1, 0.3], [-0.1, 0, sx * 0.12]);
    vein(B, 0.1, [sx * 0.1, 1.33, 0.27], [-0.1, 0, -sx * 0.95]);
    vein(B, 0.16, [sx * 0.34, 1.12, 0.26], [-0.1, sx * 0.55, sx * 0.1], 0.01);
  }
  // Starlight-stone core: a stone seat, a gold ring, eight rivets; the core spins, with a slanting rotating light ring around it and six radiating rays
  const socket = k.group(B, [0, 1.12, 0.29], [-0.1, 0, 0]);
  ball(k, socket, slate, 0.115, [0, 0, -0.03], [1, 1, 0.5]);
  k.torus(socket, gold, 0.12, 0.02, [0, 0, 0.005]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    ball(k, socket, stoneDk, 0.014, [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.022], [1, 1, 1], [0, 0, 0], {}, 8);
  }
  const coreGem = new THREE.OctahedronGeometry(0.08, 0);
  coreGem.scale(0.85, 1.2, 0.85);
  const cm = k.glow(socket, coreGem, coreHi, 2.8, [0, 0, 0.025]);
  c.spinners.push({ g: cm, speed: 1.6, axis: 'y' });
  k.glowSphere(socket, core, 0.1, [0, 0, 0.025], 1.2, [1, 1, 0.7], 0.35);
  spinRing(k, c, socket, core, 0.09, 0.006, [0, 0, 0.05], [0.5, 0, 0], 2.4, 'z', { beads: 2, beadCol: coreHi, beadR: 0.012 });
  const rays = k.group(socket, [0, 0, 0.04]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    const len = i % 2 ? 0.09 : 0.14;
    k.glow(rays, new THREE.BoxGeometry(0.008, len, 0.004), core, 1.7, [Math.cos(a) * (0.08 + len / 2), Math.sin(a) * (0.08 + len / 2), 0], [0, 0, a + PI / 2], 0.75);
  }
  c.spinners.push({ g: rays, speed: -0.7, axis: 'z' });

  // Shoulder armor: two layers of stone slabs stacked, a gold edge, a rune gem; two floating pieces of rubble above
  for (const sx of [-1, 1]) {
    const sh = k.group(B, [sx * 0.46, 1.3, 0], [0, 0, -sx * 0.34]);
    ball(k, sh, stoneDk, 0.17, [0, -0.08, 0], [1.1, 0.7, 1], [0, 0, 0], {}, 18);
    const top = poly([[-0.2, -0.05], [0.2, -0.05], [0.24, 0.04], [0.14, 0.12], [-0.14, 0.12], [-0.24, 0.04]], 0.26, 3);
    hard(k, sh, top, stone, [0, 0.02, 0], [0, 0, 0]);
    const low = poly([[-0.24, -0.06], [0.24, -0.06], [0.27, 0.02], [0.2, 0.06], [-0.2, 0.06], [-0.27, 0.02]], 0.24, 3);
    hard(k, sh, low, stoneDk, [sx * 0.03, -0.1, 0], [0, 0, 0]);
    k.torus(sh, gold, 0.17, 0.018, [0, 0.12, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    k.glow(sh, flatGem(0.03, 1.3), core, 2.2, [sx * 0.06, 0.135, 0.02], [PI / 2, 0, 0]);
    vein(sh, 0.16, [0, 0.0, 0.135], [0, 0, PI / 2], 0.01);
    for (const [dx, dy, dz, r, sp] of [[0.1, 0.32, -0.02, 0.06, 1.8], [0.26, 0.22, 0.08, 0.04, 2.3]] as [number, number, number, number, number][]) {
      const shard = new THREE.DodecahedronGeometry(r, 0);
      shard.scale(1.2, 0.5, 1);
      const fm = hard(k, sh, shard, r > 0.05 ? stone : stoneDk, [sx * dx, dy, dz], [0.3, sx * 0.5, sx * 0.2]);
      vein(fm, r * 0.7, [0, r * 0.5, 0], [0, 0, 0], 0.008);
      c.bobbers.push({ g: fm, base: dy, amp: 0.03, speed: sp, phase: sx * sp });
    }
  }
  // Arms: pillar upper arms, spherical elbows, tower-like stone bracers (gold bands, runes), clenched big hands; a hexagonal crystal shield floats outside the left arm
  for (const sx of [-1, 1]) {
    const base = new THREE.Euler(0.06, 0, sx * 0.2);
    const g = k.group(B, [sx * 0.5, 1.22, 0], [base.x, base.y, base.z]);
    ball(k, g, stoneDk, 0.09, [0, 0, 0]);
    k.cyl(g, stone, 0.08, 0.085, 0.24, [0, -0.16, 0], [0, 0, 0], 14);
    seam(g, 0.083, [0, -0.17, 0]);
    ball(k, g, stoneDk, 0.085, [0, -0.3, 0]);
    k.cyl(g, stone, 0.105, 0.135, 0.3, [0, -0.47, 0], [0, 0, 0], 14);
    k.torus(g, gold, 0.125, 0.016, [0, -0.34, 0], [PI / 2, 0, 0]);
    k.torus(g, gold, 0.14, 0.016, [0, -0.6, 0], [PI / 2, 0, 0]);
    seam(g, 0.12, [0, -0.47, 0]);
    vein(g, 0.16, [sx * 0.07, -0.47, 0.115]);
    k.glow(g, flatGem(0.024, 1.4), core, 2.2, [0, -0.47, 0.13]);
    const hand = k.group(g, [0, -0.72, 0.02]);
    ball(k, hand, stoneDk, 0.125, [0, 0, 0], [1, 0.85, 1]);
    for (let i = 0; i < 4; i++) k.capsule(hand, stone, 0.032, 0.05, [(i - 1.5) * 0.058, -0.075, 0.075], [0.55, 0, 0]);
    k.capsule(hand, stone, 0.034, 0.05, [sx * 0.115, -0.01, 0.07], [0.3, 0, -sx * 0.6]);
    k.torus(hand, gold, 0.115, 0.012, [0, 0.07, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    if (sx < 0) {
      // Crystal shield: a pale blue hexagonal light plate, a gold frame, a small spinning magic circle in the center
      const sg = k.group(g, [sx * 0.25, -0.42, 0.16], [0, sx * 0.4, 0]);
      const hex: [number, number][] = [];
      for (let i = 0; i < 6; i++) hex.push([Math.cos((i / 6) * PI * 2 + PI / 6) * 0.28, Math.sin((i / 6) * PI * 2 + PI / 6) * 0.28]);
      k.glow(sg, poly(hex, 0.012, 1), core, 0.95, [0, 0, 0], [0, 0, 0], 0.3);
      for (let i = 0; i < 6; i++) {
        const a = hex[i];
        const b = hex[(i + 1) % 6];
        glowLink(k, sg, gold, [a[0], a[1], 0], [b[0], b[1], 0], 0.009, 1.6);
        k.glowSphere(sg, coreHi, 0.014, [a[0], a[1], 0], 2.4);
      }
      sigil(k, c, sg, core, coreHi, 0.11, [0, 0, 0.01], [0, 0, 0], 1.1, { ticks: 6, gems: 3, r: 0.004, intensity: 2 });
      k.glow(sg, flatGem(0.03, 1.4), coreHi, 2.4, [0, 0, 0.012]);
      c.bobbers.push({ g: sg, base: -0.42, amp: 0.02, speed: 1.5, phase: 1 });
    }
    c.arms.push({ g, side: sx, base });
  }

  // Head: a short stone neck, a helmet-like round dome, a pair of sharp glowing eyes inside a dark visor, V-shaped gold brows, jaw armor, cheek guards, a gold front-to-back helmet crest
  k.cyl(B, slate, 0.09, 0.11, 0.1, [0, 1.4, 0.02], [0, 0, 0], 12);
  const head = k.group(B, [0, 1.56, 0.03]);
  c.head = head;
  k.sphere(head, stone, 0.18, [0, 0.01, 0], [1, 0.95, 0.98]);
  ball(k, head, slate, 0.17, [0, -0.01, 0.02], [1.0, 0.36, 0.95], [0, 0, 0], {}, 20);
  ball(k, head, stone, 0.13, [0, 0.085, 0.07], [1.25, 0.34, 0.95]);
  ball(k, head, stone, 0.11, [0, -0.11, 0.07], [1.2, 0.5, 0.95]);
  vein(head, 0.1, [0, -0.02, 0.19], [0.1, 0, 0], 0.016);
  k.eyes(head, { x: 0.075, y: -0.005, z: 0.15, r: 0.055, iris: core, glow: true, sharp: true });
  for (const sx of [-1, 1]) {
    vein(head, 0.085, [sx * 0.075, 0.06, 0.17], [0, 0, sx * (PI / 2 - 0.4)], 0.014);
    ball(k, head, stoneDk, 0.065, [sx * 0.16, -0.03, 0.02], [0.5, 1.1, 1]);
    vein(head, 0.09, [sx * 0.19, -0.03, 0.03]);
    ball(k, head, gold, 0.03, [sx * 0.16, 0.09, -0.02], [0.5, 1, 1.2]);
  }
  const crest = poly([[-0.24, 0], [0.13, 0], [0.17, 0.08], [0.03, 0.2], [-0.12, 0.2], [-0.26, 0.1]], 0.04, 4);
  hard(k, head, crest, gold, [0, 0.12, 0], [0, PI / 2, 0]);
  for (let i = 0; i < 4; i++) k.glow(head, new THREE.BoxGeometry(0.05, 0.012, 0.012), core, 1.6, [0, 0.2 + i * 0.01 - (i - 1.5) * (i - 1.5) * 0.012, -0.12 + i * 0.07]);
  k.glow(head, flatGem(0.024, 1.4), core, 2.4, [0, 0.1, 0.15]);
  // City-wall stone crown: six small stone bricks orbiting above the head, each topped with a point of gold light
  const crown = k.group(B, [0, 1.98, 0.02]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    const bg = k.group(crown, [Math.cos(a) * 0.2, (i % 2) * 0.02, Math.sin(a) * 0.2], [0, -a, 0]);
    hard(k, bg, new THREE.BoxGeometry(0.06, 0.045, 0.04), i % 2 ? stone : stoneDk);
    k.glow(bg, flatGem(0.012, 1.3), gold, 2.2, [0, 0.035, 0], [PI / 2, 0, 0]);
  }
  k.glow(crown, new THREE.TorusGeometry(0.2, 0.004, 6, 48), core, 1.8, [0, -0.01, 0], [PI / 2, 0, 0], 0.7);
  c.spinners.push({ g: crown, speed: 0.6, axis: 'y' });

  // Star Gate: a big stone ring behind it, eight arch stones and a gem-set keystone, a gold edge on the inner rim;
  // inside the gate two light rings rotating in opposite directions and a pale blue starry door curtain; five rune stones orbit slowly outside
  const gate = k.group(B, [0, 1.3, -0.5], [0.12, 0, 0]);
  const GR = 0.62;
  k.torus(gate, stone, GR, 0.04, [0, 0, 0]);
  k.torus(gate, gold, GR - 0.05, 0.016, [0, 0, 0.04], [0, 0, 0], PI * 2, { outline: false });
  k.torus(gate, gold, GR - 0.05, 0.016, [0, 0, -0.04], [0, 0, 0], PI * 2, { outline: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + PI / 8;
    const bg = k.group(gate, [Math.cos(a) * GR, Math.sin(a) * GR, 0], [0, 0, a]);
    hard(k, bg, new THREE.BoxGeometry(0.12, 0.17, 0.11), i % 2 ? stone : stoneDk);
    vein(bg, 0.1, [0.02, 0, 0.06], [0, 0, 0], 0.01);
  }
  const key = k.group(gate, [0, GR + 0.02, 0]);
  hard(k, key, new THREE.BoxGeometry(0.2, 0.15, 0.13), stone);
  k.glow(key, flatGem(0.035, 1.3), core, 2.4, [0, 0.0, 0.07]);
  k.torus(key, gold, 0.05, 0.01, [0, 0, 0.07]);
  k.glow(gate, new THREE.CircleGeometry(GR - 0.08, 48), core, 0.75, [0, 0, 0], [0, 0, 0], 0.14);
  for (let i = 0; i < 14; i++) {
    const a = hash(i * 3.1) * PI * 2;
    const rr = (0.12 + hash(i * 7.7) * 0.8) * (GR - 0.14);
    const m = k.glowSphere(gate, i % 3 ? 0xffffff : coreHi, 0.008 + hash(i) * 0.008, [Math.cos(a) * rr, Math.sin(a) * rr, 0.005], 2.6);
    c.bobbers.push({ g: m, base: m.position.y, amp: 0.012, speed: 1.5 + hash(i * 2) * 2, phase: i });
  }
  sigil(k, c, gate, core, coreHi, GR - 0.12, [0, 0, 0.012], [0, 0, 0], 0.55, { ticks: 12, gems: 5, r: 0.01, intensity: 2, opacity: 0.85 });
  sigil(k, c, gate, coreHi, 0xffffff, GR - 0.22, [0, 0, -0.012], [0, 0, 0], -0.9, { ticks: 8, gems: 4, r: 0.005, inner: 0, opacity: 0.7, intensity: 1.9 });
  const runes = k.group(gate);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + 0.3;
    const rg = k.group(runes, [Math.cos(a) * (GR + 0.14), Math.sin(a) * (GR + 0.14), 0], [0, 0, a]);
    hard(k, rg, poly([[-0.035, -0.055], [0.035, -0.055], [0.045, 0.03], [0, 0.065], [-0.045, 0.03]], 0.035, 2), stone);
    k.glow(rg, new THREE.BoxGeometry(0.012, 0.04, 0.01), i % 2 ? gold : core, 1.8, [0, 0, 0.022]);
    c.bobbers.push({ g: rg, base: rg.position.y, amp: 0.02, speed: 2 + i * 0.3, phase: i });
  }
  c.spinners.push({ g: runes, speed: -0.25, axis: 'z' });
  // Floating starlight motes
  const n = 3 + s;
  for (let i = 0; i < n; i++) sparkle(k, c, B, i % 2 ? coreHi : core, 0.02, [Math.cos(i * 2.3) * 0.7, 0.8 + (i % 3) * 0.3, Math.sin(i * 2.3) * 0.4 - 0.1], 0.05);
};

/**
 * `voidchild`: a floating void sphere. A deep-black ball with star points and a shell of purple mist, purple-red cracks on the surface peeling away (fragments rising);
 * one huge eye filling the front (heavy upper eyelid, slit pupil, a tear-streak-like crack below the eye); a broken gold crown on top (an incomplete ring, two intact and two broken-off spikes,
 * drifting fragments); seven winding shadow tentacles below; around it a ring of orbiting shards of reality and counter-rotating rift light arcs.
 */
const voidchild: Builder = (k, c, s) => {
  floater(c, 0.42);
  const voidC = 0x0e0a1c;
  const crack = 0xd02a8a;
  const crackHi = 0xff7ad0;
  const shadow = 0x1a1230;
  const smoke = 0x241a3c;
  const gold = 0xd8b24a;
  const goldDk = 0xa8842e;
  const R = 0.4;
  const cy = 0.62;
  const B = c.body;
  const body = k.group(B, [0, cy, 0]);
  /** Low-segment small glowing point (star point, where cracks meet) */
  const mote = (parent: THREE.Object3D, col: C, r: number, pos: V3, I = 2.6) => k.glow(parent, new THREE.SphereGeometry(r, 7, 5), col, I, pos);

  // Void sphere: a deep-black main body with a purple inner light, covered by a translucent shell of purple mist
  k.sphere(body, voidC, R, [0, 0, 0], [1, 1, 1], [0, 0, 0], { emissive: 0x2a1650, emissiveAmt: 0.32 });
  k.glowSphere(body, 0x6a3ab0, R * 1.09, [0, 0, 0], 0.85, [1, 1, 1], 0.2);
  // Star points: stuck on the sphere's surface (the front is left for the eye)
  const dirs = fib(44);
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    if (d.z > 0.45) continue;
    const rr = 0.007 + hash(i) * 0.01;
    mote(body, i % 4 === 0 ? 0x9ad8ff : i % 4 === 1 ? 0xffc0e8 : 0xffffff, rr, [d.x * R * 0.995, d.y * R * 0.995, d.z * R * 0.995], 3);
  }
  // Cracks: purple-red glowing zigzag lines crawling across the sphere, brighter where they meet; beside the cracks, a few dark fragments peeling away and rising
  const starts: [THREE.Vector3, number, number][] = [
    [v3(0.6, 0.7, 0.4), 9, 1],
    [v3(-0.8, 0.3, 0.5), 8, 2],
    [v3(0.9, -0.3, -0.2), 10, 3],
    [v3(-0.4, -0.7, -0.5), 7, 4],
    [v3(0.2, 0.9, -0.4), 6, 5],
    [v3(-0.7, -0.1, -0.7), 8, 6],
    [v3(0.75, 0.2, 0.6), 6, 7],
  ];
  for (const [d0, n, seed] of starts) {
    const pts = crackOnSphere(R, d0, n, 0.16, seed, 1.02);
    glowPath(k, body, crack, pts, 0.011, 2.2, 1, n * 3);
    const mid = pts[Math.floor(n / 2)];
    const branch = crackOnSphere(R, mid.clone().normalize(), 4, 0.12, seed + 11, 1.02);
    glowPath(k, body, crackHi, branch, 0.006, 2.4, 1, 12);
    mote(body, crackHi, 0.017, [mid.x, mid.y, mid.z]);
    for (let j = 0; j < 2; j++) {
      const p = pts[Math.min(pts.length - 1, 2 + j * 3)].clone().normalize();
      const lift = R * (1.06 + hash(seed * 3 + j) * 0.08);
      const g = k.group(body, [p.x * lift, p.y * lift, p.z * lift]);
      aim(g, p);
      const sh = poly([[-0.03, -0.02], [0.028, -0.024], [0.032, 0.02], [0, 0.036], [-0.026, 0.024]], 0.008, 1);
      sh.rotateX(-PI / 2);
      hard(k, g, sh, voidC, [0, 0, 0], [0, hash(seed + j) * PI, 0], { emissive: crack, emissiveAmt: 0.35 });
      c.bobbers.push({ g, base: g.position.y, amp: 0.012, speed: 1.4 + hash(seed + j * 5) * 1.5, phase: seed + j });
    }
  }

  // Big eye: pale purple whites, a purple-red iris with a bright ring, a slit pupil, a glint; a heavy upper eyelid presses on the top edge of the eye, and a tear-streak crack below it
  const head = k.group(body, [0, 0.02, 0]);
  c.head = head;
  const eye = k.group(head, [0, 0.03, R * 0.83]);
  const sclera = new THREE.SphereGeometry(0.2, 24, 18);
  sclera.scale(1, 0.96, 0.4);
  k.mesh(eye, sclera, 0xf2e8ff);
  k.glowSphere(eye, crack, 0.135, [0, -0.005, 0.045], 2.1, [1, 1.08, 0.4]);
  k.glowSphere(eye, 0xff9ae0, 0.095, [0, -0.005, 0.062], 2.5, [1, 1.05, 0.4]);
  k.glow(eye, new THREE.TorusGeometry(0.115, 0.006, 6, 32), 0xffc0f0, 2.4, [0, -0.005, 0.085], [0, 0, 0]);
  const pupil = new THREE.SphereGeometry(0.06, 14, 12);
  pupil.scale(0.38, 1.35, 0.4);
  k.mesh(eye, pupil, 0x0a0614, [0, -0.005, 0.09], [0, 0, 0], { outline: false });
  mote(eye, 0xffffff, 0.024, [-0.055, 0.075, 0.1], 2.2);
  mote(eye, 0xffffff, 0.014, [0.05, -0.055, 0.105], 2.4);
  c.eyes.push(eye);
  ball(k, head, voidC, 0.215, [0, 0.135, R * 0.8], [1.06, 0.62, 0.55], [0.32, 0, 0], { emissive: 0x2a1650, emissiveAmt: 0.5 }, 20);
  ball(k, head, voidC, 0.2, [0, -0.15, R * 0.84], [1.02, 0.35, 0.5], [-0.25, 0, 0], { emissive: 0x2a1650, emissiveAmt: 0.5 }, 18);
  glowPath(k, head, crack, crackOnSphere(R, v3(0.06, -0.45, 0.9), 5, 0.1, 21, 1.02), 0.006, 2.2, 1, 15);
  // A small zigzag mouth below the eye
  for (let i = 0; i < 4; i++) {
    const x0 = -0.06 + i * 0.03;
    glowLink(k, head, crack, [x0, -0.2 + (i % 2) * 0.014, R * 0.905], [x0 + 0.03, -0.2 + ((i + 1) % 2) * 0.014, R * 0.905], 0.004, 2.2);
  }

  // Broken crown: an incomplete gold ring (three arcs), two intact spikes and two broken-off ones, fragments drifting above; the whole thing turns slowly and tilts slightly
  const crown = k.group(body, [0, R + 0.06, 0], [0.12, 0, -0.1]);
  for (const [a0, len] of [[0.1, 1.9], [2.4, 1.4], [4.3, 1.5]] as [number, number][]) {
    k.torus(crown, gold, 0.2, 0.014, [0, 0, 0], [PI / 2, 0, -a0], len);
  }
  const spike = (a: number, h: number, broken: boolean) => {
    const g = k.group(crown, [Math.cos(a) * 0.2, 0.005, -Math.sin(a) * 0.2], [0, a, 0]);
    const pts: [number, number][] = broken
      ? [[-0.035, 0], [0.035, 0], [0.03, h * 0.55], [0.008, h * 0.42], [-0.012, h * 0.6], [-0.035, h * 0.5]]
      : [[-0.038, 0], [0.038, 0], [0.014, h * 0.55], [0, h], [-0.014, h * 0.55]];
    hard(k, g, poly(pts, 0.022, 1), gold, [0, 0, 0], [0, PI / 2, 0], { emissive: 0xffe08a, emissiveAmt: 0.22 });
    if (!broken) k.glow(g, flatGem(0.018, 1.4), crackHi, 2.4, [0, h * 0.62, 0.014]);
  };
  spike(0.55, 0.21, false);
  spike(1.55, 0.11, true);
  spike(2.9, 0.23, false);
  spike(4.9, 0.1, true);
  spike(3.9, 0.17, false);
  const shards: [number, number][][] = [
    [[-0.04, 0], [0.03, 0], [0.035, 0.05], [0, 0.08], [-0.03, 0.04]],
    [[-0.03, 0], [0.035, 0], [0.02, 0.06], [-0.025, 0.045]],
    [[-0.035, 0], [0.03, 0], [0.04, 0.045], [0.005, 0.07], [-0.03, 0.05]],
  ];
  for (let i = 0; i < shards.length; i++) {
    const a = 1.55 + i * 1.6;
    const g = k.group(crown, [Math.cos(a) * 0.23, 0.14 + i * 0.05, -Math.sin(a) * 0.23], [0.3, a, 0.25]);
    hard(k, g, poly(shards[i], 0.02, 1), goldDk, [0, 0, 0], [0, 0, 0], { emissive: 0xffe08a, emissiveAmt: 0.2 });
    mote(g, crackHi, 0.012, [0, 0.04, 0.015]);
    c.bobbers.push({ g, base: g.position.y, amp: 0.03, speed: 1.4 + i * 0.4, phase: i * 1.7 });
  }
  k.glow(crown, new THREE.TorusGeometry(0.2, 0.005, 6, 40), 0x9a4ad8, 1.6, [0, -0.025, 0], [PI / 2, 0, 0], 0.6);
  c.spinners.push({ g: crown, speed: 0.45, axis: 'y' });

  // Shadow tentacles: seven dark shadows winding outward and downward below the body, with a few puffs of smoke along the way and a point of purple-red light at the end; about half sway left and right, half up and down
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2 + 0.3;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    const base = v3(dx * R * 0.48, -R * 0.74, dz * R * 0.48);
    const tg = k.group(body, [base.x, base.y, base.z]);
    const L = 0.38 + hash(i + 3) * 0.14;
    const sway = (hash(i * 4) - 0.5) * 0.16;
    const px = -dz * sway;
    const pz = dx * sway;
    const pts = [v3(0, 0.02, 0), v3(dx * 0.08, -0.13, dz * 0.08), v3(dx * 0.2 + px, -0.24, dz * 0.2 + pz), v3(dx * L * 0.8 - px, -0.3, dz * L * 0.8 - pz), v3(dx * L, -0.26 + hash(i) * 0.08, dz * L), v3(dx * (L + 0.06), -0.18 + hash(i) * 0.08, dz * (L + 0.06))];
    const tube = taperTube(pts, (t) => 0.048 * (1 - t * 0.82), 32, 9);
    k.mesh(tg, tube.geo, shadow, [0, 0, 0], [0, 0, 0], { emissive: 0x3a1a5a, emissiveAmt: 0.32 });
    for (let j = 0; j < 3; j++) {
      const t = 0.3 + j * 0.22;
      const p = tube.path.getPointAt(t);
      ball(k, tg, smoke, 0.04 * (1 - t * 0.6), [p.x + (hash(i + j) - 0.5) * 0.04, p.y + 0.02, p.z + (hash(i * j + 2) - 0.5) * 0.04], [1, 0.8, 1], [0, 0, 0], { outline: false, emissive: 0x3a1a5a, emissiveAmt: 0.3 }, 10);
    }
    const tip = pts[5];
    mote(tg, crackHi, 0.018, [tip.x, tip.y, tip.z]);
    c.tails.push({ g: tg, phase: i * 1.1, amp: i % 2 ? 0.16 : 0.1, axis: i % 2 ? 'y' : 'x' });
  }

  // Orbiting shards of reality: dark triangular fragments (purple-red glowing edges) and stardust orbiting on a tilted orbit, each floating on its own
  const orbit = k.group(body, [0, 0.02, 0], [0.4, 0, 0.22]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    const rr = R * 1.42 + (i % 2) * 0.07;
    const g = k.group(orbit, [Math.cos(a) * rr, (i % 3 - 1) * 0.05, Math.sin(a) * rr], [i * 0.9, -a, i * 0.5]);
    if (i % 2 === 0) {
      const tri: [number, number][] = [[-0.035, -0.025], [0.04, -0.02], [0.005, 0.055]];
      hard(k, g, poly(tri, 0.01, 1), voidC, [0, 0, 0], [0, 0, 0], { emissive: crack, emissiveAmt: 0.3 });
      glowLink(k, g, crackHi, [tri[0][0], tri[0][1], 0.007], [tri[2][0], tri[2][1], 0.007], 0.004, 2.4);
    } else {
      hard(k, g, new THREE.OctahedronGeometry(0.02, 0), i % 4 === 1 ? gold : shadow, [0, 0, 0], [0, 0, 0], i % 4 === 1 ? {} : { emissive: crack, emissiveAmt: 0.25 });
      mote(g, i % 4 === 1 ? 0xffc0e8 : crackHi, 0.01, [0.03, 0.02, 0]);
    }
    c.bobbers.push({ g, base: g.position.y, amp: 0.03, speed: 1.6 + (i % 3) * 0.4, phase: i * 0.8 });
  }
  c.spinners.push({ g: orbit, speed: 0.6, axis: 'y' });
  const dust = k.group(body, [0, -0.05, 0], [-0.55, 0, 0.3]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    const m = mote(dust, i % 2 ? 0xffffff : 0xc0a8ff, 0.009 + (i % 3) * 0.003, [Math.cos(a) * R * 1.25, 0, Math.sin(a) * R * 1.25], 2.8);
    c.bobbers.push({ g: m, base: 0, amp: 0.02, speed: 2 + i * 0.3, phase: i });
  }
  c.spinners.push({ g: dust, speed: -1.1, axis: 'y' });
  // Two rift light arcs behind it, rotating in opposite directions
  const rift = k.group(body, [0, 0.05, -0.16]);
  k.glow(rift, new THREE.TorusGeometry(R * 1.28, 0.009, 6, 48, PI * 1.15), crack, 2, [0, 0, 0], [0, 0, PI * 0.92], 0.8);
  c.spinners.push({ g: rift, speed: -0.4, axis: 'z' });
  const rift2 = k.group(body, [0, 0.05, -0.2]);
  k.glow(rift2, new THREE.TorusGeometry(R * 1.55, 0.006, 6, 56, PI * 0.7), crackHi, 1.8, [0, 0, 0], [0, 0, PI * 0.2], 0.7);
  for (let i = 0; i < 3; i++) {
    const a = PI * 0.2 + (i / 2) * PI * 0.7;
    mote(rift2, crackHi, 0.012, [Math.cos(a) * R * 1.55, Math.sin(a) * R * 1.55, 0]);
  }
  c.spinners.push({ g: rift2, speed: 0.55, axis: 'z' });
  // Void motes being sucked in
  const n = 4 + s;
  for (let i = 0; i < n; i++) sparkle(k, c, B, i % 2 ? crackHi : 0xc0a8ff, 0.016, [Math.cos(i * 2.4) * 0.62, cy + (i % 3) * 0.2 - 0.2, Math.sin(i * 2.4) * 0.52], 0.06);
};

/**
 * `chronodragon` (old model): a stocky sand-gold quadruped dragon. A row of bronze-edged scale plates along the spine, a bronze harness holding the big hourglass on its back (glass cones, flowing glowing sand,
 * spiraling sand grains, the whole thing slowly rotating), wings shaped like an hourglass frame (a bronze frame + light-transmitting sand membrane), a clock with spinning twin hands on the brow,
 * horns that are a long and a short clock hand, a pendulum at the tail tip; underfoot a clock magic circle engraved with twelve ticks and slowly moving hands.
 * This is the old model, kept only until the new model is plugged in. The new model is not a dragon but a time-sand ancient snail, see render/lab/chronodragonModel.ts.
 */
const chronodragon: Builder = (k, c, s) => {
  const sand = 0xd8b878;
  const sandLt = 0xf0dcae;
  const sandDk = 0xb8925a;
  const bronze = 0xa8783a;
  const bronzeDk = 0x7a5424;
  const glowSand = 0xffe8a0;
  const amber = 0xffc040;
  const claw = 0x5a3c22;
  const dark = 0x5a4632;
  c.archetype = 'quad';
  const legH = 0.45;
  const bodyY = 0.67;
  const B = c.body;
  const mote = (parent: THREE.Object3D, col: C, r: number, pos: V3, I = 2.4) => k.glow(parent, new THREE.SphereGeometry(r, 7, 5), col, I, pos);

  // Torso: a body of revolution along z, thick chest and round haunches; cream scale plates on the belly side
  k.mesh(B, lathed([[0.03, -0.58], [0.17, -0.52], [0.26, -0.4], [0.27, -0.24], [0.25, -0.08], [0.29, 0.08], [0.31, 0.24], [0.28, 0.4], [0.18, 0.5], [0.03, 0.55]], [0.95, 1.02, 1]), sand, [0, bodyY, 0]);
  const girth: [number, number][] = [[0.42, 0.27], [0.3, 0.3], [0.17, 0.305], [0.04, 0.285], [-0.09, 0.255], [-0.22, 0.27], [-0.35, 0.265], [-0.46, 0.22]];
  for (const [z, r] of girth) ball(k, B, sandLt, 1, [0, bodyY - r * 1.02 * 0.84, z], [r * 0.7, 0.05, 0.08], [0, 0, 0], { outline: false }, 12);
  // Spine scale plates: a row of bronze-edged sand-colored plates stacked from the neck base to the tail base, a spot of amber on top of each
  const spine: [number, number][] = [[0.36, 0.28], [0.24, 0.31], [0.12, 0.31], [0.0, 0.29], [-0.12, 0.26], [-0.24, 0.27], [-0.36, 0.265], [-0.47, 0.2]];
  for (let i = 0; i < spine.length; i++) {
    const [z, r] = spine[i];
    const y = bodyY + r * 1.02 - 0.02;
    const w = 0.07 + Math.sin(((i + 0.5) / spine.length) * PI) * 0.03;
    ball(k, B, sandDk, 1, [0, y, z], [w, 0.035, 0.075], [-0.35, 0, 0]);
    k.torus(B, bronze, w * 0.9, 0.008, [0, y + 0.012, z + 0.01], [PI / 2 - 0.35, 0, 0], PI, { outline: false });
    if (i % 2 === 0) k.glow(B, flatGem(0.012, 1.3), amber, 2.2, [0, y + 0.03, z], [PI / 2 - 0.35, 0, 0]);
  }
  // Bronze harness: two bands around the chest and belly, fastened with a bronze buckle on the back
  for (const [z, R0] of [[0.1, 0.32], [-0.24, 0.29]] as [number, number][]) {
    k.torus(B, bronze, R0, 0.018, [0, bodyY + 0.01, z], [0, 0, 0], PI * 2, { outline: false });
    k.torus(B, bronzeDk, R0 + 0.004, 0.006, [0, bodyY + 0.01, z], [0, 0, 0], PI * 2, { outline: false });
    for (const sx of [-1, 1]) ball(k, B, bronzeDk, 0.03, [sx * R0 * 0.72, bodyY + 0.01 + R0 * 0.7, z], [1, 0.7, 1.2]);
  }
  // Time glyphs on the flank: glowing polylines and diamonds
  for (const sx of [-1, 1]) {
    const x = sx * 0.3;
    glowLink(k, B, glowSand, [x, bodyY + 0.12, 0.34], [x * 1.02, bodyY - 0.02, 0.22], 0.006, 1.8);
    glowLink(k, B, glowSand, [x * 1.02, bodyY - 0.02, 0.22], [x, bodyY + 0.1, 0.06], 0.006, 1.8);
    glowLink(k, B, glowSand, [sx * 0.27, bodyY + 0.06, -0.08], [sx * 0.275, bodyY - 0.07, -0.2], 0.006, 1.8);
    k.glow(B, flatGem(0.02, 1.4), amber, 2.2, [sx * 0.305, bodyY + 0.02, 0.0], [0, sx * PI * 0.5, 0]);
  }

  // Sturdy limbs: hip ball, thigh, bronze knee guard, shin, bronze ankle ring, paw and dark claws
  const legAt = (sx: number, z: number, front: boolean) => {
    const g = k.group(B, [sx * (front ? 0.22 : 0.21), legH, z]);
    ball(k, g, sand, 0.1, [0, 0, 0], [1, 1.1, 1.1]);
    k.capsule(g, sand, 0.075, 0.13, [0, -0.12, front ? 0.01 : -0.035], [front ? -0.1 : 0.3, 0, 0]);
    ball(k, g, sandDk, 0.062, [0, -0.22, front ? 0.03 : -0.06]);
    if (front) k.torus(g, bronze, 0.066, 0.012, [0, -0.215, 0.03], [PI / 2, 0, 0]);
    k.capsule(g, sand, 0.06, 0.13, [0, -0.31, front ? 0.03 : -0.03], [front ? 0.05 : -0.2, 0, 0]);
    k.torus(g, bronze, 0.066, 0.013, [0, -0.35, front ? 0.033 : -0.014], [PI / 2, 0, 0]);
    const foot = k.group(g, [0, -legH + 0.058, front ? 0.05 : 0.02]);
    ball(k, foot, sand, 0.085, [0, 0, 0], [1.15, 0.58, 1.3]);
    for (let i = -1; i <= 1; i++) k.cone(foot, claw, 0.02, 0.08, [i * 0.05, -0.012, 0.085], [PI / 2 + 0.3, 0, i * 0.25], 8);
    c.legs.push({ g, phase: sx * (front ? 1 : -1) > 0 ? 0 : PI, amp: 1 });
  };
  for (const sx of [-1, 1]) {
    legAt(sx, 0.24, true);
    legAt(sx, -0.3, false);
  }

  // Neck and head: a thick short neck, throat scale plates, a broad head, a heavy lower jaw, big amber eyes with eyeliner, bronze brow ridges, nostrils, a mouth line and small fangs
  const neckPts = [v3(0, bodyY + 0.16, 0.38), v3(0, bodyY + 0.36, 0.5), v3(0, bodyY + 0.54, 0.54)];
  const neckR = (t: number) => 0.15 - t * 0.055;
  const neck = taperTube(neckPts, neckR, 22, 14);
  k.mesh(B, neck.geo, sand);
  for (let i = 0; i < 4; i++) {
    const t = 0.15 + i * 0.24;
    const p = neck.path.getPointAt(t);
    const rr = neckR(t);
    const pg = aim(k.group(B, [p.x, p.y - rr * 0.34, p.z + rr * 0.78]), neck.path.getTangentAt(t));
    ball(k, pg, sandLt, 1, [0, 0, 0], [rr * 0.74, rr * 0.4, rr * 0.3], [0, 0, 0], { outline: false }, 12);
  }
  const head = k.group(B, [0, bodyY + 0.58, 0.54], [0.15, 0, 0]);
  c.head = head;
  k.sphere(head, sand, 0.18, [0, 0, 0], [1, 0.86, 1.05]);
  k.sphere(head, sand, 0.125, [0, -0.05, 0.19], [0.8, 0.6, 1.4]);
  ball(k, head, sand, 0.07, [0, 0.025, 0.2], [0.72, 0.4, 1.5]);
  ball(k, head, sandLt, 0.105, [0, -0.11, 0.17], [0.76, 0.42, 1.25], [0, 0, 0], { outline: false }, 16);
  for (const sx of [-1, 1]) {
    ball(k, head, dark, 0.013, [sx * 0.045, -0.03, 0.33], [0.7, 1, 0.5], [0, sx * 0.9, 0], { outline: false }, 10);
    k.capsule(head, dark, 0.004, 0.11, [sx * 0.075, -0.095, 0.22], [PI / 2 - 0.05, 0, 0], { outline: false });
    k.cone(head, 0xfff6e0, 0.012, 0.04, [sx * 0.07, -0.11, 0.27], [PI, 0, 0], 6, { outline: false });
  }
  k.eyes(head, { x: 0.108, y: 0.035, z: 0.12, r: 0.055, iris: amber });
  for (const sx of [-1, 1]) {
    ball(k, head, bronze, 0.055, [sx * 0.105, 0.098, 0.115], [1.3, 0.36, 0.72], [0, 0, -sx * 0.3]);
    k.torus(head, dark, 0.052, 0.005, [sx * 0.108, 0.042, 0.148], [0, sx * 0.28, sx * 0.3], PI * 0.75, { outline: false });
  }
  // Clock on the brow: a bronze ring, a glowing face, twelve ticks, one long and one short hand that turn
  const dial = k.group(head, [0, 0.13, 0.135], [-0.72, 0, 0]);
  k.torus(dial, bronze, 0.052, 0.01, [0, 0, 0]);
  k.glow(dial, new THREE.CircleGeometry(0.047, 24), glowSand, 1.5, [0, 0, 0.004]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    const big = i % 3 === 0;
    k.glow(dial, new THREE.BoxGeometry(big ? 0.007 : 0.004, big ? 0.014 : 0.008, 0.004), bronzeDk, 1, [Math.cos(a) * 0.037, Math.sin(a) * 0.037, 0.008], [0, 0, a + PI / 2]);
  }
  const hourHand = k.group(dial, [0, 0, 0.011]);
  k.glow(hourHand, new THREE.BoxGeometry(0.007, 0.024, 0.004), bronzeDk, 1, [0, 0.011, 0]);
  c.spinners.push({ g: hourHand, speed: 0.25, axis: 'z' });
  const minHand = k.group(dial, [0, 0, 0.014]);
  k.glow(minHand, new THREE.BoxGeometry(0.005, 0.036, 0.004), bronzeDk, 1, [0, 0.016, 0]);
  c.spinners.push({ g: minHand, speed: 1.4, axis: 'z' });
  mote(dial, amber, 0.008, [0, 0, 0.016]);
  // Horns: a long (minute hand) and a short (hour hand) clock hand, a bronze base, a spear-shaped tip set with amber
  for (const sx of [-1, 1]) {
    const L = sx < 0 ? 0.42 : 0.3;
    const hg = k.group(head, [sx * 0.08, 0.12, -0.03], [-0.9, 0, -sx * 0.38]);
    k.cyl(hg, bronze, 0.036, 0.04, 0.03, [0, 0.01, 0], [0, 0, 0], 12);
    k.torus(hg, bronzeDk, 0.036, 0.006, [0, 0.026, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    hard(k, hg, poly([[-0.02, 0], [0.02, 0], [0.012, L * 0.55], [0.034, L * 0.72], [0, L], [-0.034, L * 0.72], [-0.012, L * 0.55]], 0.02, 2), bronze, [0, 0.02, 0], [0, PI / 2, 0]);
    k.glow(hg, flatGem(0.014, 1.5), amber, 2.4, [0, L * 0.74, 0], [0, PI / 2, 0]);
    // Ear fin: sand-colored membrane stretched by three fin bones
    const fin = k.group(head, [sx * 0.15, -0.01, -0.04], [0.25, 0, -sx * 1.2]);
    hard(k, fin, poly([[0, -0.01], [0.015, 0.14], [0.07, 0.11], [0.105, 0.03], [0.065, -0.025]], 0.012, 3), sandLt, [0, 0, 0], [0, 0, 0], { emissive: amber, emissiveAmt: 0.15 });
    for (const [x, y] of [[0.015, 0.14], [0.07, 0.11], [0.105, 0.03]] as [number, number][]) link(k, fin, bronze, [0, 0, 0], [x, y, 0], 0.008);
    c.ears.push({ g: fin, phase: sx * 1.7 });
  }

  // The wings are hourglass-frame shaped: the bronze frame follows the outer edge of two triangular membranes and pinches in at the waist; the membrane is light-transmitting sand-colored glass with a few floating grains of sand inside
  const L = 0.72;
  const outline: [number, number][] = [[0, 0], [0, L], [0.34 * L, 0.98 * L], [0.48 * L, 0.78 * L], [0.13 * L, 0.5 * L], [0.48 * L, 0.22 * L], [0.42 * L, 0.02 * L], [0.1 * L, -0.05 * L]];
  for (const sx of [-1, 1]) {
    const flap = k.group(B, [sx * 0.16, bodyY + 0.26, 0.08], [0, sx * 0.12, 0]);
    const w = k.group(flap, [0, 0, 0], [0, -sx * 0.38, 0]);
    const mem = poly(outline, 0.014, 2);
    mem.rotateY(PI / 2);
    k.glow(w, mem, 0xf4c870, 0.92, [0, 0, 0], [0, 0, 0], 0.52);
    const P = (u: number, y: number, x = 0): V3 => [x, y, -u];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      link(k, w, bronze, P(a[0], a[1]), P(b[0], b[1]), i === 0 ? 0.03 : 0.015);
      if (i > 0) ball(k, w, bronzeDk, 0.022, P(a[0], a[1]), [1, 1, 1], [0, 0, 0], {}, 10);
    }
    ball(k, w, bronzeDk, 0.032, P(0.13 * L, 0.5 * L));
    k.glow(w, flatGem(0.014, 1.4), amber, 2.2, P(0.13 * L, 0.5 * L, 0.03), [0, PI / 2, 0]);
    ball(k, w, sand, 0.055, [0, 0, 0]);
    for (let i = 0; i < 7; i++) {
      const up = i < 4;
      const u = (0.08 + hash(i * 3 + sx) * 0.3) * L;
      const y = up ? (0.58 + hash(i * 5) * 0.34) * L : (0.06 + hash(i * 7) * 0.32) * L;
      const m = mote(w, i % 2 ? glowSand : 0xfff4c8, 0.009, P(u, y, 0.012 * (i % 2 ? 1 : -1)), 2.2);
      c.bobbers.push({ g: m, base: y, amp: 0.02, speed: 2 + (i % 3), phase: i * 0.9 });
    }
    c.wings.push({ g: flap, side: sx < 0 ? 1 : -1, base: 0.7, amp: 0.12, speed: 2.0 });
  }

  // Hourglass on the back: a bronze base and cap, four posts, two translucent glass cones with glowing sand flowing inside; the whole thing rotates slowly, with a ring of sand grains spiraling upward around it
  const hg = k.group(B, [0, bodyY + 0.3, -0.1], [0.1, 0, 0]);
  c.spinners.push({ g: hg, speed: 0.3, axis: 'y' });
  const H = 0.46;
  const RR = 0.15;
  k.cyl(hg, bronze, RR, RR * 1.08, 0.035, [0, 0.018, 0], [0, 0, 0], 20);
  k.cyl(hg, bronze, RR * 1.08, RR, 0.035, [0, H - 0.018, 0], [0, 0, 0], 20);
  k.torus(hg, bronzeDk, RR * 0.92, 0.01, [0, 0.036, 0], [PI / 2, 0, 0]);
  k.torus(hg, bronzeDk, RR * 0.92, 0.01, [0, H - 0.036, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    k.capsule(hg, bronze, 0.013, H - 0.07, [Math.cos(a) * RR * 0.96, H / 2, Math.sin(a) * RR * 0.96]);
    ball(k, hg, bronzeDk, 0.018, [Math.cos(a) * RR * 0.96, H / 2, Math.sin(a) * RR * 0.96], [1, 1, 1], [0, 0, 0], {}, 8);
  }
  gem(k, hg, amber, 0.03, 0.09, [0, H + 0.005, 0], [0, 0, 0], 0.8);
  const bulb = new THREE.ConeGeometry(RR * 0.84, H * 0.46, 22);
  bulb.translate(0, H * 0.23, 0);
  k.glow(hg, bulb, 0xfff6dc, 0.85, [0, H * 0.5 + 0.005, 0], [0, 0, 0], 0.22);
  k.glow(hg, bulb.clone(), 0xfff6dc, 0.85, [0, H * 0.5 - 0.005, 0], [PI, 0, 0], 0.22);
  k.torus(hg, bronzeDk, 0.03, 0.009, [0, H * 0.5, 0], [PI / 2, 0, 0]);
  const sandTop = new THREE.ConeGeometry(RR * 0.72, H * 0.17, 16);
  sandTop.translate(0, H * 0.085, 0);
  k.glow(hg, sandTop, glowSand, 1.8, [0, H * 0.5 + 0.01, 0], [PI, 0, 0]);
  const sandBot = new THREE.ConeGeometry(RR * 0.66, H * 0.14, 16);
  sandBot.translate(0, H * 0.07, 0);
  k.glow(hg, sandBot, glowSand, 1.8, [0, 0.035, 0]);
  k.glow(hg, new THREE.CylinderGeometry(0.007, 0.007, H * 0.34, 6), glowSand, 2.2, [0, H * 0.32, 0]);
  const flow = k.group(hg, [0, 0.035, 0]);
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const a = t * PI * 4;
    const rr = RR * 0.16 + t * RR * 0.48;
    const m = mote(flow, i % 2 ? glowSand : 0xfff4c8, 0.011, [Math.cos(a) * rr, H * 0.1 + t * H * 0.26, Math.sin(a) * rr]);
    c.bobbers.push({ g: m, base: m.position.y, amp: 0.02, speed: 3 + (i % 3), phase: i * 0.7 });
  }
  c.spinners.push({ g: flow, speed: 2.4, axis: 'y' });
  const sandOrbit = k.group(B, [0, bodyY + 0.55, -0.1], [0.3, 0, 0.15]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    const m = mote(sandOrbit, i % 3 ? glowSand : 0xf0c878, 0.008 + (i % 2) * 0.004, [Math.cos(a) * 0.27, (i % 3 - 1) * 0.03, Math.sin(a) * 0.27], 2.4);
    c.bobbers.push({ g: m, base: m.position.y, amp: 0.02, speed: 2 + (i % 4) * 0.5, phase: i });
  }
  c.spinners.push({ g: sandOrbit, speed: 1.3, axis: 'y' });

  // Tail: a sturdy tapered tube ringed with bronze bands, a bronze pendulum with amber set in at the tip
  const tail = k.group(B, [0, bodyY - 0.03, -0.52], [0.08, 0, 0]);
  const tailPts = [v3(0, 0.02, 0.06), v3(0, -0.06, -0.26), v3(0, -0.05, -0.5), v3(0, 0.06, -0.66), v3(0, 0.22, -0.76)];
  const tailR = (t: number) => 0.11 * (1 - t * 0.7);
  const tt = taperTube(tailPts, tailR, 36, 12);
  k.mesh(tail, tt.geo, sand);
  for (let i = 0; i < 3; i++) {
    const t = 0.28 + i * 0.24;
    const p = tt.path.getPointAt(t);
    const tg = aim(k.group(tail, [p.x, p.y, p.z]), tt.path.getTangentAt(t));
    k.torus(tg, bronze, tailR(t) * 1.02, 0.013, [0, 0, 0], [PI / 2, 0, 0]);
  }
  c.tails.push({ g: tail, phase: 0, amp: 0.16, axis: 'y' });
  const tp = tailPts[4];
  const bob = k.group(tail, [tp.x, tp.y + 0.01, tp.z]);
  k.cyl(bob, bronzeDk, 0.012, 0.012, 0.05, [0, 0.02, 0], [0, 0, 0], 8);
  ball(k, bob, bronze, 0.05, [0, 0.06, 0], [1, 0.95, 1]);
  k.torus(bob, bronzeDk, 0.05, 0.008, [0, 0.06, 0], [0, 0, 0], PI * 2, { outline: false });
  k.glow(bob, flatGem(0.024, 1.4), amber, 2.4, [0, 0.06, 0.045]);
  k.glowSphere(bob, glowSand, 0.09, [0, 0.06, 0], 0.9, [1, 1, 1], 0.25);

  // Clock magic circle underfoot: a pale gold circle, twelve ticks, two slowly moving hands, a rotating sand swirl on the outside
  const clock = k.group(B, [0, 0.05, -0.04]);
  k.glow(clock, new THREE.TorusGeometry(0.72, 0.008, 6, 64), glowSand, 1.6, [0, 0, 0], [PI / 2, 0, 0], 0.7);
  k.glow(clock, new THREE.TorusGeometry(0.6, 0.005, 6, 56), 0xf6dca0, 1.4, [0, 0, 0], [PI / 2, 0, 0], 0.6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    const big = i % 3 === 0;
    k.glow(clock, new THREE.BoxGeometry(big ? 0.02 : 0.012, 0.006, big ? 0.07 : 0.04), big ? amber : glowSand, big ? 2 : 1.6, [Math.sin(a) * 0.66, 0, Math.cos(a) * 0.66], [0, a, 0], 0.85);
  }
  const hand1 = k.group(clock);
  k.glow(hand1, new THREE.BoxGeometry(0.014, 0.005, 0.5), glowSand, 1.6, [0, 0, 0.25], [0, 0, 0], 0.8);
  k.glow(hand1, flatGem(0.02, 1.4), amber, 2, [0, 0.005, 0.5], [PI / 2, 0, 0]);
  c.spinners.push({ g: hand1, speed: -0.45, axis: 'y' });
  const hand2 = k.group(clock);
  k.glow(hand2, new THREE.BoxGeometry(0.02, 0.005, 0.36), 0xf0c878, 1.5, [0, 0, 0.18], [0, 0, 0], 0.8);
  c.spinners.push({ g: hand2, speed: -0.1, axis: 'y' });
  const swirl = k.group(B, [0, 0.07, -0.04]);
  k.glow(swirl, new THREE.TorusGeometry(0.8, 0.006, 6, 56, PI * 1.2), 0xf6dca0, 1.1, [0, 0, 0], [PI / 2, 0, 0], 0.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 1.2;
    mote(swirl, glowSand, 0.008, [Math.cos(a) * 0.8, 0.01 + (i % 2) * 0.03, -Math.sin(a) * 0.8], 2.2);
  }
  c.spinners.push({ g: swirl, speed: 0.6, axis: 'y' });
  const n = 4 + s;
  for (let i = 0; i < n; i++) sparkle(k, c, B, i % 2 ? glowSand : 0xf0c878, 0.015, [Math.cos(i * 2.2) * 0.6, 0.45 + (i % 3) * 0.25, Math.sin(i * 2.2) * 0.5 - 0.1], 0.07);
};

// ───────────────────────── Single-form SRs ─────────────────────────

/** `phoenix`: an elegant vermilion fire bird, gold-and-white vane edges, great burning wings, ember tail feathers, a golden crest */
const phoenix: Builder = (k, c, s) => {
  c.archetype = 'bird';
  c.hover = 0.25;
  const red = 0xe8452a;
  const redDk = 0xb8301e;
  const cream = 0xfff0b0;
  const gold = 0xffc84a;
  const orange = 0xff8a2a;
  const ember = 0xff5a1a;
  const core = 0xfff2a0;
  const by = 0.6;
  // Body: a slender chest and belly (chest thrust out, waist narrow), three layers of gold-and-white feathers on the chest
  k.sphere(c.body, red, 1, [0, by, 0.02], [0.25, 0.32, 0.29]);
  k.sphere(c.body, red, 1, [0, by - 0.12, -0.18], [0.18, 0.17, 0.22]);
  k.sphere(c.body, redDk, 1, [0, by - 0.16, -0.33], [0.11, 0.1, 0.13]);
  for (let i = 0; i < 3; i++) k.sphere(c.body, cream, 1, [0, by + 0.02 - i * 0.09, 0.2 - i * 0.03], [0.16 - i * 0.03, 0.07, 0.1], [0, 0, 0], { outline: false });
  // Feet: thin gold legs and three toes
  for (const sx of [-1, 1]) {
    const leg = k.group(c.body, [sx * 0.08, by - 0.24, 0.02]);
    k.capsule(leg, gold, 0.02, 0.13, [0, -0.08, 0]);
    k.sphere(leg, gold, 0.024, [0, -0.16, 0.01]);
    for (let i = -1; i <= 1; i++) k.capsule(leg, gold, 0.012, 0.055, [i * 0.028, -0.18, 0.04], [PI / 2 - 0.2, 0, i * 0.3]);
    c.legs.push({ g: leg, phase: sx > 0 ? 0 : PI, amp: 0.4 });
  }
  // Neck and head: a slender S-shaped neck, a round head, a golden hooked beak, golden eyes, a crest
  const neckPts = [v3(0, by + 0.2, 0.1), v3(0, by + 0.34, 0.2), v3(0, by + 0.48, 0.24)];
  const neck = taperTube(neckPts, (t) => 0.085 - t * 0.03, 16, 12);
  k.mesh(c.body, neck.geo, red);
  const head = k.group(c.body, [0, by + 0.54, 0.24]);
  c.head = head;
  k.sphere(head, red, 0.155, [0, 0, 0], [1, 0.95, 1.05]);
  k.sphere(head, cream, 0.095, [0, -0.07, 0.07], [1.05, 0.6, 0.9], [0, 0, 0], { outline: false });
  k.horn(head, gold, 0.038, 0.15, 0.055, [0, -0.025, 0.135], [PI / 2 + 0.2, 0, 0]);
  k.eyes(head, { x: 0.088, y: 0.03, z: 0.11, r: 0.046, iris: gold, glow: true });
  for (const sx of [-1, 1]) k.sphere(head, redDk, 0.04, [sx * 0.088, 0.085, 0.105], [1.3, 0.3, 0.6], [0, 0, -sx * 0.4]);
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.36;
    const cg = k.group(head, [Math.sin(a) * 0.06, 0.1, -0.03], [-0.95 - Math.abs(a) * 0.5, 0, -a]);
    const L = 0.3 - Math.abs(i - 1.5) * 0.08;
    k.blade(cg, gold, L, 0.05, 0.02, [0, 0, 0]);
    k.blade(cg, cream, L * 0.6, 0.026, 0.024, [0, 0.02, 0], [0, 0, 0], { outline: false });
    if (i === 1 || i === 2) k.flame(cg, orange, core, 0.07, [0, L, 0]);
  }
  // Wings: seven feathers fanned open across the wing like a folding fan (vermilion, gold-and-white vane edges), the leading edge and feather tips all burning
  for (const sx of [-1, 1]) {
    const w = k.group(c.body, [sx * 0.17, by + 0.14, 0], [-0.1, -sx * 0.12, 0]);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const L = 1.0 * (1 - t * 0.42);
      const rot: V3 = [-0.08 * t, 0, -sx * t * 1.15];
      const z = -t * 0.03;
      k.blade(w, i % 2 ? red : redDk, L, 0.16, 0.05, [0, 0, z], rot);
      k.blade(w, cream, L * 1.06, 0.2, 0.032, [0, 0, z], rot, { outline: false });
      const fg = k.group(w, [0, 0, z], rot);
      k.flame(fg, i % 2 ? orange : ember, core, 0.12 - t * 0.03, [0, L * 0.96, 0]);
      if (i === 0 || i === 2) k.flame(fg, orange, core, 0.085, [0, L * 0.62, 0.03]);
    }
    k.flame(w, orange, core, 0.14, [0, 0.3, 0.06]);
    k.flame(w, ember, core, 0.1, [0, 0.12, 0.07]);
    c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: 0.7, amp: 0.3, speed: 4.2 });
  }
  // Tail feathers: five long feathers hanging backward and downward in a fan, with glowing embers at the ends
  const tail = k.group(c.body, [0, by - 0.14, -0.3], [0, 0, 0]);
  for (let i = -2; i <= 2; i++) {
    const tg = k.group(tail, [i * 0.035, 0, 0], [-2.05 + Math.abs(i) * 0.18, i * 0.28, 0]);
    const L = 0.72 - Math.abs(i) * 0.08;
    k.blade(tg, i % 2 ? redDk : red, L, 0.09, 0.04, [0, 0, 0]);
    k.blade(tg, cream, L * 1.06, 0.12, 0.03, [0, 0, 0], [0, 0, 0], { outline: false });
    k.glowSphere(tg, ember, 0.03, [0, L * 0.98, 0], 2.4);
    k.glowSphere(tg, core, 0.016, [0, L * 0.98, 0], 3);
    k.flame(tg, ember, core, 0.055, [0, L * 0.9, 0.02], [PI * 0.75, 0, 0]);
  }
  c.tails.push({ g: tail, phase: 0, amp: 0.15, axis: 'y' });
  // Floating ember sparks
  const n = 4 + s;
  for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? orange : core, 0.014, [Math.cos(i * 2.1) * 0.5, by + (i % 3) * 0.22 - 0.2, Math.sin(i * 2.1) * 0.4], 0.08);
};

/** `tornado`: translucent cyan-white rings growing larger from bottom to top rotate layer by layer, a glowing eye core in the center, purple lightning flickering around */
const tornado: Builder = (k, c, s) => {
  floater(c, 0.12);
  const cyan = 0xbff0ff;
  const pale = 0xe6fbff;
  const white = 0xffffff;
  const violet = 0xb08aff;
  const violetHi = 0xd8c4ff;
  const H = 1.3;
  const n = 8;
  const radiusAt = (t: number) => 0.07 + Math.pow(t, 1.25) * 0.62;
  // Funnel: a translucent rotating surface
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new THREE.Vector2(radiusAt(t) * 0.92, 0.03 + t * H));
  }
  const funnel = k.glow(c.body, new THREE.LatheGeometry(prof, 36), cyan, 0.75, [0, 0, 0], [0, 0, 0], 0.16);
  (funnel.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  // Layer upon layer of rings: larger toward the top and spinning faster toward the bottom, with a few wisps of cloud on each ring so the rotation is visible
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = 0.05 + t * H;
    const R = radiusAt(t);
    const tube = 0.018 + t * 0.03;
    const ring = k.group(c.body, [0, y, 0], [(i % 2 ? 1 : -1) * 0.06, 0, 0]);
    k.glow(ring, new THREE.TorusGeometry(R, tube, 8, 56), i % 3 === 0 ? 0x8fdcf4 : i % 3 === 1 ? cyan : pale, 1.0, [0, 0, 0], [PI / 2, 0, 0], 0.62);
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * PI * 2 + i * 0.9;
      const puff = k.glowSphere(ring, white, tube * 1.3, [Math.cos(a) * R, tube * 0.3, Math.sin(a) * R], 0.85, [1, 0.7, 1], 0.7);
      puff.rotation.y = -a;
      puff.scale.x *= 2.2;
    }
    c.spinners.push({ g: ring, speed: 1.1 + (1 - t) * 2.6, axis: 'y' });
  }
  // Eye core: a white glowing sphere, a big blue-purple eye on the front, a furrowed brow above
  const head = k.group(c.body, [0, 0.84, 0.2]);
  c.head = head;
  k.sphere(head, 0xf6fcff, 0.19, [0, 0, 0], [1, 1, 1], [0, 0, 0], { emissive: 0xbff0ff, emissiveAmt: 0.35 });
  k.glowSphere(head, pale, 0.24, [0, 0, 0], 0.7, [1, 1, 1], 0.22);
  const eye = k.group(head, [0, 0.01, 0.12]);
  k.glowSphere(eye, 0x8ad4ff, 0.115, [0, 0, 0.055], 1.4, [1, 1.1, 0.4]);
  k.glowSphere(eye, violet, 0.076, [0, 0, 0.085], 1.7, [1, 1.1, 0.4]);
  const pupil = new THREE.SphereGeometry(0.042, 14, 12);
  pupil.scale(0.75, 1.25, 0.4);
  k.mesh(eye, pupil, 0x1a1030, [0, 0, 0.108], [0, 0, 0], { outline: false });
  k.glowSphere(eye, white, 0.024, [-0.04, 0.05, 0.12], 1.8);
  k.glowSphere(eye, white, 0.013, [0.034, -0.04, 0.122], 1.6);
  c.eyes.push(eye);
  k.glow(head, new THREE.TorusGeometry(0.125, 0.013, 6, 24, PI * 0.8), violet, 2, [0, 0.08, 0.16], [0.3, 0, PI * 0.1]);
  // A thin light ring rotating at a slant outside the core
  spinRing(k, c, head, violetHi, 0.28, 0.006, [0, 0, 0], [PI / 2 + 0.5, 0, 0], 1.6, 'y', { beads: 3, beadCol: white, beadR: 0.014, opacity: 0.8 });
  // Purple lightning: lightning sheets stuck to the outside of the funnel, each flickering on its own; plus two or three zigzag arcs spanning the rings
  for (let i = 0; i < 7; i++) {
    const t = 0.25 + (i / 7) * 0.7;
    const a = i * 2.4;
    const R = radiusAt(t) * 1.05;
    const g = k.group(c.body, [Math.sin(a) * R, 0.05 + t * H, Math.cos(a) * R], [0, a, (i % 2 ? 1 : -1) * 0.6]);
    k.glow(g, boltGeo(0.24 + (i % 3) * 0.06, 0.12, 0.014), i % 2 ? violet : violetHi, 2.3);
    c.flickers.push({ g, base: g.scale.clone(), speed: 12 + i * 2, amt: 0.6 });
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.7;
    const t0 = 0.35 + i * 0.15;
    const p0: V3 = [Math.sin(a) * radiusAt(t0), 0.05 + t0 * H, Math.cos(a) * radiusAt(t0)];
    const p1: V3 = [Math.sin(a + 0.35) * radiusAt(t0 + 0.12) * 1.05, 0.05 + (t0 + 0.12) * H, Math.cos(a + 0.35) * radiusAt(t0 + 0.12) * 1.05];
    const p2: V3 = [Math.sin(a + 0.5) * radiusAt(t0 + 0.24), 0.05 + (t0 + 0.24) * H, Math.cos(a + 0.5) * radiusAt(t0 + 0.24)];
    const arc = k.group(c.body);
    glowLink(k, arc, violetHi, p0, p1, 0.006, 2.4);
    glowLink(k, arc, violetHi, p1, p2, 0.006, 2.4);
    c.flickers.push({ g: arc, base: arc.scale.clone(), speed: 9 + i * 3, amt: 0.5 });
  }
  // Swirled-up debris: small pebbles and leaves flying around the funnel
  const debris = k.group(c.body, [0, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const t = 0.2 + (i / 8) * 0.7;
    const a = i * 1.7;
    const R = radiusAt(t) * 1.25 + 0.05;
    const p: V3 = [Math.sin(a) * R, 0.05 + t * H, Math.cos(a) * R];
    if (i % 2) k.blade(debris, 0x8fd26a, 0.08, 0.04, 0.012, p, [a, i, 0.5], { outline: false });
    else k.sphere(debris, 0xb8b4a8, 0.024, p, [1, 0.8, 1.2], [0, 0, 0], { outline: false });
    c.bobbers.push({ g: debris.children[debris.children.length - 1], base: p[1], amp: 0.04, speed: 3 + (i % 3), phase: i });
  }
  c.spinners.push({ g: debris, speed: 1.8, axis: 'y' });
  // Ring of dust at the bottom
  const dust = k.group(c.body, [0, 0.0, 0]);
  k.glow(dust, new THREE.TorusGeometry(0.24, 0.012, 6, 40, PI * 1.4), pale, 1.1, [0, 0, 0], [PI / 2, 0, 0], 0.55);
  k.glow(dust, new THREE.TorusGeometry(0.32, 0.01, 6, 40, PI * 1.1), cyan, 1, [0, 0.03, 0], [PI / 2, 0, 2.4], 0.45);
  c.spinners.push({ g: dust, speed: 3.2, axis: 'y' });
  const m = 3 + s;
  for (let i = 0; i < m; i++) sparkle(k, c, c.body, i % 2 ? violetHi : white, 0.016, [Math.cos(i * 2.2) * 0.75, 0.6 + (i % 3) * 0.3, Math.sin(i * 2.2) * 0.7], 0.08);
};

/** `griffin`: a white-gold griffin with a lion's body and an eagle's head, white wings with gold tips, a golden hooked beak, a sapphire on the chest, a tuft of fur at the end of the lion tail */
const griffin: Builder = (k, c, s) => {
  const cream = 0xf4ecd8;
  const white = 0xfffdf6;
  const shade = 0xd8ccb0;
  const gold = 0xffc84a;
  const goldDk = 0xd9a030;
  const claw = 0x3a3028;
  const sapphire = 0x4a8aff;
  c.archetype = 'quad';
  const legH = 0.44;
  const bodyY = 0.6;
  // Lion body: chest thrust out, narrow waist, round haunches, a cream belly side
  k.sphere(c.body, cream, 1, [0, bodyY + 0.03, 0.14], [0.3, 0.3, 0.34]);
  k.sphere(c.body, cream, 1, [0, bodyY - 0.01, -0.1], [0.24, 0.23, 0.26]);
  k.sphere(c.body, cream, 1, [0, bodyY + 0.01, -0.3], [0.27, 0.26, 0.27]);
  k.sphere(c.body, white, 1, [0, bodyY - 0.14, 0.02], [0.24, 0.16, 0.42], [0, 0, 0], { outline: false });
  // Sapphire on the chest: a gold base, a faceted gem, a light ring turning slowly around it
  const brooch = k.group(c.body, [0, bodyY + 0.04, 0.46], [-0.25, 0, 0]);
  k.torus(brooch, gold, 0.062, 0.014, [0, 0, 0]);
  k.cyl(brooch, goldDk, 0.05, 0.05, 0.02, [0, 0, -0.005], [PI / 2, 0, 0], 16);
  gem(k, brooch, sapphire, 0.045, 0.07, [0, 0, 0.0], [PI / 2, 0, 0], 0.8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    k.sphere(brooch, gold, 0.014, [Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.005]);
  }
  spinRing(k, c, brooch, 0x9ac4ff, 0.095, 0.005, [0, 0, 0.02], [0, 0, 0], 0.9, 'z', { beads: 2, beadCol: 0xffffff, beadR: 0.012, opacity: 0.75 });
  // Feather ruff at the neck: two rings of white feathers spreading backward
  for (let ring = 0; ring < 2; ring++) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * PI * 1.35;
      const R = 0.2 - ring * 0.03;
      const g = k.group(c.body, [Math.sin(a) * R, bodyY + 0.3 + ring * 0.07 + Math.cos(a) * 0.06, 0.34 - ring * 0.05], [-0.9 + ring * 0.2, 0, -a]);
      k.blade(g, ring ? white : cream, 0.17 - Math.abs(a) * 0.03, 0.07, 0.03, [0, 0, 0]);
    }
  }
  // The forelegs are the eagle's scaled legs: cream feathered thighs, gold-scaled shins, dark talons; the hind legs: lion legs and fleshy paws
  const legAt = (sx: number, z: number, front: boolean) => {
    const g = k.group(c.body, [sx * (front ? 0.2 : 0.2), legH, z]);
    k.sphere(g, cream, 0.1, [0, -0.02, 0], [1, 1.2, 1.05]);
    if (front) {
      k.sphere(g, white, 0.075, [0, -0.15, 0.02], [1, 1.3, 1]);
      k.cyl(g, gold, 0.04, 0.046, 0.18, [0, -0.32, 0.03], [0, 0, 0], 12);
      for (let i = 0; i < 3; i++) k.torus(g, goldDk, 0.045, 0.008, [0, -0.26 - i * 0.05, 0.03], [PI / 2, 0, 0], PI * 2, { outline: false });
      const foot = k.group(g, [0, -legH + 0.04, 0.05]);
      k.sphere(foot, gold, 0.055, [0, 0, 0], [1.2, 0.7, 1.1]);
      for (let i = -1; i <= 1; i++) {
        k.capsule(foot, gold, 0.02, 0.06, [i * 0.045, -0.005, 0.05], [PI / 2 - 0.1, 0, i * 0.35]);
        k.horn(foot, claw, 0.016, 0.06, 0.03, [i * 0.055, -0.01, 0.1], [PI / 2 + 0.6, 0, i * 0.3]);
      }
      k.horn(foot, claw, 0.014, 0.05, 0.02, [0, -0.01, -0.05], [-PI / 2 - 0.6, 0, 0]);
    } else {
      k.capsule(g, cream, 0.07, 0.14, [0, -0.15, -0.03], [0.3, 0, 0]);
      k.sphere(g, shade, 0.055, [0, -0.25, -0.05]);
      k.capsule(g, cream, 0.055, 0.12, [0, -0.33, -0.02], [-0.2, 0, 0]);
      const paw = k.group(g, [0, -legH + 0.045, 0.04]);
      k.sphere(paw, cream, 0.075, [0, 0, 0], [1.1, 0.6, 1.2]);
      for (let i = -1; i <= 1; i++) k.sphere(paw, white, 0.028, [i * 0.045, -0.005, 0.07], [1, 0.8, 1.1]);
    }
    c.legs.push({ g, phase: sx * (front ? 1 : -1) > 0 ? 0 : PI, amp: 1 });
  };
  for (const sx of [-1, 1]) {
    legAt(sx, 0.2, true);
    legAt(sx, -0.28, false);
  }
  // Eagle head: a round head, a golden hooked beak, sharp blue eyes, brow feathers, three crest feathers at the back of the head
  const neckPts = [v3(0, bodyY + 0.2, 0.32), v3(0, bodyY + 0.36, 0.4), v3(0, bodyY + 0.5, 0.42)];
  const neck = taperTube(neckPts, (t) => 0.14 - t * 0.03, 16, 14);
  k.mesh(c.body, neck.geo, cream);
  const head = k.group(c.body, [0, bodyY + 0.56, 0.42], [0.12, 0, 0]);
  c.head = head;
  k.sphere(head, white, 0.17, [0, 0, 0], [0.95, 0.9, 1.05]);
  k.sphere(head, cream, 0.11, [0, -0.06, 0.08], [1.05, 0.7, 1], [0, 0, 0], { outline: false });
  k.horn(head, gold, 0.055, 0.19, 0.08, [0, -0.02, 0.13], [PI / 2 + 0.25, 0, 0]);
  k.sphere(head, goldDk, 0.05, [0, -0.08, 0.2], [0.9, 0.6, 1.1], [0, 0, 0], { outline: false });
  for (const sx of [-1, 1]) k.sphere(head, 0x5a4a30, 0.012, [sx * 0.03, 0.005, 0.185], [1, 1, 0.5], [0, 0, 0], { outline: false });
  k.eyes(head, { x: 0.095, y: 0.035, z: 0.125, r: 0.05, iris: sapphire, glow: true, sharp: true });
  for (const sx of [-1, 1]) {
    k.blade(head, gold, 0.11, 0.05, 0.02, [sx * 0.1, 0.1, 0.1], [0.3, 0, -sx * 1.4]);
    k.blade(head, white, 0.14, 0.06, 0.025, [sx * 0.13, 0.03, -0.06], [0.2, 0, -sx * 1.25]);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.4;
    const cg = k.group(head, [Math.sin(a) * 0.05, 0.12, -0.04], [-1.1 - Math.abs(a) * 0.3, 0, -a]);
    k.blade(cg, white, 0.22 - Math.abs(i - 1) * 0.04, 0.06, 0.02, [0, 0, 0]);
    k.blade(cg, gold, 0.08, 0.04, 0.024, [0, 0.15 - Math.abs(i - 1) * 0.03, 0], [0, 0, 0], { outline: false });
  }
  // Wings: seven white feathers fanned across the wing, the feather tips inlaid with gold
  for (const sx of [-1, 1]) {
    const w = k.group(c.body, [sx * 0.2, bodyY + 0.24, 0.0], [-0.1, -sx * 0.12, 0]);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const L = 0.98 * (1 - t * 0.4);
      const rot: V3 = [-0.06 * t, 0, -sx * t * 1.1];
      const z = -t * 0.03;
      k.blade(w, i % 2 ? white : cream, L, 0.16, 0.05, [0, 0, z], rot);
      const tg = k.group(w, [0, 0, z], rot);
      k.blade(tg, gold, L * 0.3, 0.13, 0.062, [0, L * 0.68, 0], [0, 0, 0], { outline: false });
      k.glowSphere(tg, 0xfff2b0, 0.02, [0, L * 0.98, 0], 2.2);
    }
    k.sphere(w, cream, 0.09, [0, 0.06, 0.02], [1, 1.2, 0.8]);
    c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: 0.62, amp: 0.28, speed: 3.2 });
  }
  // Lion tail: a thin jointed tail, a tuft of gold-and-white fur at the end
  const tail = k.group(c.body, [0, bodyY - 0.04, -0.54], [-0.35, 0, 0]);
  const tip = tailChain(k, c, tail, cream, 4, 0.045, 0.11, 0.55);
  k.sphere(tip, white, 0.07, [0, -0.02, -0.06], [1, 1.1, 1.3]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    k.cone(tip, i % 2 ? gold : white, 0.022, 0.09, [Math.cos(a) * 0.04, -0.02 + Math.sin(a) * 0.04, -0.1], [-PI / 2 - 0.3, 0, a * 0.2], 6);
  }
  // Floating motes and two drifting small feathers
  const n = 3 + s;
  for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? 0xfff2b0 : 0xbfe0ff, 0.018, [Math.cos(i * 2.3) * 0.6, 0.6 + (i % 3) * 0.25, Math.sin(i * 2.3) * 0.5 - 0.1], 0.07);
  for (const sx of [-1, 1]) {
    const f = k.blade(c.body, white, 0.09, 0.04, 0.012, [sx * 0.55, 0.9, -0.2], [0.4, sx * 0.6, sx * 1.2], { outline: false });
    c.bobbers.push({ g: f, base: 0.9, amp: 0.06, speed: 1.4, phase: sx * 2 });
  }
};

/** `weaverspider`: a dark purple-black eight-legged spider, a silver-white glowing web pattern on the abdomen, two big purple-glowing eyes at the front and six small eyes, a silver web behind it that collects dreams */
const weaverspider: Builder = (k, c, s) => {
  c.archetype = 'crawl';
  const body = 0x2a2040;
  const bodyLt = 0x3c3060;
  const band = 0x5a4a88;
  const silver = 0xdfe8ff;
  const violet = 0xb060ff;
  const violetHi = 0xd8a8ff;
  const dream = 0xc8b8ff;
  // Cephalothorax and abdomen
  const thoraxY = 0.34;
  k.sphere(c.body, body, 0.2, [0, thoraxY, 0.2], [1.05, 0.8, 1]);
  k.sphere(c.body, bodyLt, 0.12, [0, thoraxY - 0.05, 0.3], [1.1, 0.6, 0.8], [0, 0, 0], { outline: false });
  const ab: V3 = [0, 0.5, -0.24];
  const ar: V3 = [0.31, 0.29, 0.37];
  k.sphere(c.body, body, 1, ab, ar);
  k.capsule(c.body, body, 0.1, 0.1, [0, 0.4, 0.0], [PI / 2, 0, 0]);
  // Web pattern on the abdomen: three concentric rings and eight radial lines hugging the ellipsoid surface (silver-white glow)
  const onAb = (phi: number, a: number, lift = 1.015): THREE.Vector3 =>
    v3(ab[0] + ar[0] * Math.cos(phi) * Math.sin(a) * lift, ab[1] + ar[1] * Math.sin(phi) * lift, ab[2] + ar[2] * Math.cos(phi) * Math.cos(a) * lift);
  for (let r = 0; r < 3; r++) {
    const phi = 0.95 - r * 0.42;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 36; i++) pts.push(onAb(phi, (i / 36) * PI * 2));
    glowPath(k, c.body, silver, pts, 0.006, 1.15, 0.85, 72);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + PI / 8;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= 6; j++) pts.push(onAb(1.35 - (j / 6) * 1.55, a));
    glowPath(k, c.body, silver, pts, 0.005, 1.15, 0.85, 18);
  }
  k.glowSphere(c.body, silver, 0.03, [ab[0], ab[1] + ar[1] * 1.0, ab[2]], 1.6);
  // Eight legs: extending from the sides of the cephalothorax, knees raised high, tips landing on the ground
  // This one is very wide and low and gets scaled up nearly double after normalization, so the outline must be thinned a little or it would smear into black blobs
  for (const om of c.outlines) om.uniforms.uThickness.value = 0.017;
  const legs: [number, number, number][] = [
    [0.32, 0.55, 0.22],
    [0.24, 0.85, 0.24],
    [0.14, 1.15, 0.22],
    [0.04, 1.5, 0.2],
  ];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const [z0, ang, reach] = legs[i];
      const dir = v3(sx * Math.sin(ang), 0, Math.cos(ang));
      const g = k.group(c.body, [sx * 0.16, thoraxY - 0.02, z0]);
      const p0: V3 = [0, 0, 0];
      const p1: V3 = [dir.x * 0.18, 0.22 - i * 0.02, dir.z * 0.18];
      const p2: V3 = [dir.x * (0.18 + reach), 0.06, dir.z * (0.18 + reach)];
      const p3: V3 = [dir.x * (0.26 + reach), -(thoraxY - 0.02) + 0.01, dir.z * (0.26 + reach)];
      link(k, g, body, p0, p1, 0.026);
      k.sphere(g, band, 0.028, p1);
      link(k, g, bodyLt, p1, p2, 0.021);
      k.sphere(g, band, 0.022, p2);
      link(k, g, body, p2, p3, 0.015);
      k.sphere(g, violet, 0.014, p3, [1, 1, 1], [0, 0, 0], { emissive: violet, emissiveAmt: 0.6 });
      c.legs.push({ g, phase: (i + (sx > 0 ? 0 : 1)) % 2 ? 0 : PI, amp: 0.5 });
    }
  }
  // Face: two big purple-glowing eyes at the front, six small eyes above, chelicerae and pedipalps
  const head = k.group(c.body, [0, thoraxY + 0.02, 0.2]);
  c.head = head;
  k.eyes(head, { x: 0.085, y: 0.02, z: 0.17, r: 0.055, iris: violet, glow: true, sharp: true, yaw: 0.35 });
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const a = 0.35 + i * 0.4;
      k.glowSphere(head, i === 1 ? violetHi : violet, 0.018 - i * 0.002, [sx * Math.sin(a) * 0.16, 0.1 + Math.cos(a) * 0.03, Math.cos(a) * 0.17 + 0.02], 2.4);
    }
    k.horn(head, body, 0.028, 0.1, 0.04, [sx * 0.045, -0.08, 0.18], [PI - 0.3, 0, sx * 0.2]);
    k.glowSphere(head, 0xff6ad0, 0.012, [sx * 0.045, -0.17, 0.2], 2.4);
    k.capsule(head, bodyLt, 0.018, 0.08, [sx * 0.11, -0.06, 0.2], [PI / 2 - 0.4, 0, sx * 0.7]);
  }
  k.sphere(head, 0x1a1430, 0.035, [0, -0.02, 0.2], [1.2, 0.5, 0.6], [0, 0, 0], { outline: false });
  // The silver web hanging behind it: three concentric rings + eight radial lines, with two floating dream pearls stuck to the web; the whole web sways slightly
  const web = k.group(c.body, [0, 0.55, -0.6], [0.15, 0, 0]);
  for (let r = 1; r <= 3; r++) k.glow(web, new THREE.TorusGeometry(r * 0.13, 0.005, 5, 36), silver, 1.6, [0, 0, 0], [0, 0, 0], 0.65);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    glowLink(k, web, silver, [0, 0, 0], [Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0], 0.004, 1.6, 0.65);
  }
  for (let i = 0; i < 2; i++) {
    const a = 0.9 + i * 2.4;
    const orb = k.group(web, [Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.02]);
    k.sphere(orb, dream, 0.035, [0, 0, 0], [1, 1, 1], [0, 0, 0], { emissive: violet, emissiveAmt: 0.5 });
    k.glowSphere(orb, 0xffffff, 0.012, [-0.012, 0.014, 0.03], 2.2);
    c.bobbers.push({ g: orb, base: orb.position.y, amp: 0.02, speed: 1.8 + i, phase: i * 2 });
  }
  c.tails.push({ g: web, phase: 0, amp: 0.06, axis: 'y' });
  // A thread hanging from the tip of the abdomen, with a freshly collected dream hung on it
  const silk = k.group(c.body, [0, ab[1] - ar[1] * 0.9, ab[2] - 0.05]);
  glowLink(k, silk, silver, [0, 0, 0], [0, -0.16, 0], 0.004, 1.6, 0.8);
  const drop = k.group(silk, [0, -0.19, 0]);
  k.sphere(drop, dream, 0.04, [0, 0, 0], [1, 1.15, 1], [0, 0, 0], { emissive: violet, emissiveAmt: 0.5 });
  k.glowSphere(drop, 0xffffff, 0.013, [-0.014, 0.018, 0.034], 2.2);
  c.bobbers.push({ g: drop, base: -0.19, amp: 0.02, speed: 2.2, phase: 1 });
  // Floating dream dust
  const n = 3 + s;
  for (let i = 0; i < n; i++) sparkle(k, c, c.body, i % 2 ? violetHi : silver, 0.014, [Math.cos(i * 2.2) * 0.5, 0.45 + (i % 3) * 0.2, Math.sin(i * 2.2) * 0.45 - 0.2], 0.05);
};

export const SPECIES_LEGENDS: Record<string, Builder> = {
  eldarin,
  astragate,
  voidchild,
  chronodragon,
  phoenix,
  tornado,
  griffin,
  weaverspider,
};
