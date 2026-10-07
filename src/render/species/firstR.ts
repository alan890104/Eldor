// Remakes of the first-batch spirits (round two: the three stages clearly differ and feel alive). The builders here override the same-named BASE entries in species.ts.
// Five Rs: `pyre_dragoon`, `oathsea_sage`, `elderwood_warden` (the three starter partners of the old version; `pyre_dragoon` is now the partner of the rival Kael), `stormram`, `eclipse_batlord`.
// Each one's three stages are "three ages of the same creature": I a rounded juvenile lying / sitting, II an adolescent stretched out and standing up, III an adult with full gear.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit, PartOpts } from '../creature.ts';
import { floater, PI, sparkle, type Builder, type C, type V3 } from '../parts.ts';

// ───────────────────────── Shared helpers ─────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const vec = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

/** Reproducible pseudo-random number (0 to 1) */
function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Angular parts (extrusions, polyhedra, boxes): the outline uses a copy with vertex-merged smooth normals, so the hard edges do not tear the outline into fragments */
function hard(k: Kit, parent: THREE.Object3D, geo: THREE.BufferGeometry, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  const m = k.mesh(parent, geo, col, pos, rot, { ...o, outline: false });
  const g = geo.clone();
  g.deleteAttribute('normal');
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  const og = mergeVertices(g, 1e-4);
  og.computeVertexNormals();
  m.add(new THREE.Mesh(og, k.c.outlines[0]));
  return m;
}

/** Low-segment sphere (small parts, joints, spots) */
function ball(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PartOpts = {}, seg = 14): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.75)));
  g.scale(...scale);
  return k.mesh(parent, g, col, pos, rot, o);
}

/** Make the object's +y point along dir */
function aim<T extends THREE.Object3D>(g: T, dir: V3): T {
  g.quaternion.setFromUnitVectors(UP, vec(dir).normalize());
  return g;
}

/** Stick big eyes onto the surface of a (ellipsoid) sphere-shaped head: compute the surface z from x and y, so the whites bulge out slightly */
function faceEyes(k: Kit, head: THREE.Object3D, rad: number | V3, o: { x: number; y: number; r: number; iris: C; glow?: boolean; sharp?: boolean; yaw?: number; cy?: number; cz?: number }): void {
  const [rx, ry, rz] = typeof rad === 'number' ? [rad, rad, rad] : rad;
  const dy = o.y - (o.cy ?? 0);
  const z = (o.cz ?? 0) + rz * Math.sqrt(Math.max(0.05, 1 - (o.x / rx) ** 2 - (dy / ry) ** 2)) - o.r * 0.1;
  k.eyes(head, { x: o.x, y: o.y, z, r: o.r, iris: o.iris, glow: o.glow, sharp: o.sharp, yaw: o.yaw });
}

/** Flat spot stuck on an ellipsoid surface (scale, moss, markings): the normal aligns with the surface, stretch can elongate it */
function spot(k: Kit, parent: THREE.Object3D, col: C, center: V3, radii: V3, dir: V3, r: number, o: PartOpts = {}, stretch: [number, number] = [1, 1], flat = 0.22): THREE.Mesh {
  const d = vec(dir).normalize();
  const p: V3 = [center[0] + d.x * radii[0], center[1] + d.y * radii[1], center[2] + d.z * radii[2]];
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(stretch[0], stretch[1], flat);
  const m = k.mesh(parent, g, col, p, [0, 0, 0], { outline: false, ...o });
  const n = new THREE.Vector3(d.x / radii[0], d.y / radii[1], d.z / radii[2]).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return m;
}

/** Mouth: a short arc (curving downward by default = a smile; reversed with frown) */
function mouth(k: Kit, head: THREE.Object3D, col: C, R: number, pos: V3, rot: V3 = [0, 0, 0], w = 0.3, arc = PI * 0.9, frown = false): THREE.Mesh {
  const g = new THREE.TorusGeometry(R, R * w, 6, 20, arc);
  g.rotateZ((frown ? 0.5 : 1.5) * PI - arc / 2);
  return k.mesh(head, g, col, pos, rot, { outline: false });
}

/** Eyebrow: a flat short bar stuck on the face, tilt > 0 means the outer end goes down (fierce), < 0 means the outer end goes up (innocent) */
function brows(k: Kit, head: THREE.Object3D, col: C, x: number, y: number, z: number, len: number, tilt: number, r = 0.018): void {
  for (const sx of [-1, 1]) ball(k, head, col, r, [sx * x, y, z], [len / r, 1, 0.5], [0, sx * 0.3, -sx * tilt], { outline: false }, 10);
}

/** Tube along a curve with variable radius (tail, neck, tentacle) */
function taperTube(pts: V3[], r: (t: number) => number, seg = 36, radial = 12): { geo: THREE.BufferGeometry; path: THREE.CatmullRomCurve3 } {
  const path = new THREE.CatmullRomCurve3(pts.map(vec));
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

/** Tube part tapering from thick to thin */
function tube(k: Kit, parent: THREE.Object3D, col: C, pts: V3[], r0: number, r1: number, o: PartOpts = {}, seg = 36): THREE.Mesh {
  return k.mesh(parent, taperTube(pts, (t) => r0 + (r1 - r0) * t, seg).geo, col, [0, 0, 0], [0, 0, 0], o);
}

/** Capsule between two points (bone, wing finger, strut) */
function link(k: Kit, parent: THREE.Object3D, col: C, a: V3, b: V3, r: number, o: PartOpts = {}): THREE.Mesh {
  const A = vec(a);
  const d = vec(b).sub(A);
  const len = Math.max(0.002, d.length());
  const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
  const m = k.mesh(parent, geo, col, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [0, 0, 0], o);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Thin plate extruded from a 2D outline (wing membrane, blade, shield emblem), centered on z */
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

/** Rotating glowing ring: the spin group rotates about axis, holder tilts by tilt; beads on the ring make the rotation visible */
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
  o: { col: C; joint?: C; r: number; len: number; front: boolean; foot?: C; footScale?: V3; bend?: number; footR?: number; hipR?: number },
): { g: THREE.Group; foot: THREE.Group } {
  const L = o.len;
  const r = o.r;
  const f = o.front;
  const bend = o.bend ?? 0.28;
  const g = k.group(parent, [sx * x, L, z]);
  ball(k, g, o.col, r * (o.hipR ?? 1.35), [0, -0.01, 0], [1, 1.15, 1.05], [0, 0, 0], {}, 18);
  k.capsule(g, o.col, r, L * 0.3, [0, -L * 0.3, f ? 0.01 : -0.05], [f ? -bend * 0.4 : bend, 0, 0]);
  ball(k, g, o.joint ?? o.col, r * 0.92, [0, -L * 0.56, f ? 0.025 : -0.1], [1, 1, 1], [0, 0, 0], {}, 16);
  // Shin: from the knee to the center of the paw, so the capsule's bottom end never goes below the sole (y=0)
  const fr = o.footR ?? r * 1.2;
  const fy = -L + fr * 0.62;
  link(k, g, o.col, [0, -L * 0.56, f ? 0.025 : -0.1], [0, fy + r * 0.2, f ? 0.05 : 0.0], r * 0.76);
  const foot = k.group(g, [0, fy, f ? 0.05 : 0.0]);
  ball(k, foot, o.foot ?? o.col, fr, [0, 0, 0], o.footScale ?? [1.1, 0.6, 1.3], [0, 0, 0], {}, 18);
  c.legs.push({ g, phase: sx * (f ? 1 : -1) > 0 ? 0 : PI, amp: 1 });
  return { g, foot };
}

/** One leg of a biped: hip → thigh → knee ball → shin → foot group (sole y≈0). Returns the leg group and the foot group */
function bipedLeg(
  k: Kit,
  c: Creature,
  parent: THREE.Object3D,
  sx: number,
  x: number,
  z: number,
  o: { col: C; joint?: C; r: number; len: number; foot?: C; footScale?: V3; footR?: number; splay?: number },
): { g: THREE.Group; foot: THREE.Group } {
  const L = o.len;
  const r = o.r;
  const g = k.group(parent, [sx * x, L, z], [0, sx * (o.splay ?? 0.12), 0]);
  ball(k, g, o.col, r * 1.25, [0, -0.02, 0], [1, 1.1, 1], [0, 0, 0], {}, 18);
  k.capsule(g, o.col, r, L * 0.32, [0, -L * 0.28, 0.02], [-0.12, 0, 0]);
  ball(k, g, o.joint ?? o.col, r * 0.95, [0, -L * 0.52, 0.03], [1, 1, 1], [0, 0, 0], {}, 16);
  const fr = o.footR ?? r * 1.3;
  const fy = -L + fr * 0.6;
  link(k, g, o.col, [0, -L * 0.52, 0.03], [0, fy + r * 0.25, fr * 0.2], r * 0.78);
  const foot = k.group(g, [0, fy, fr * 0.5]);
  ball(k, foot, o.foot ?? o.col, fr, [0, 0, 0], o.footScale ?? [1.05, 0.6, 1.5], [0, 0, 0], {}, 18);
  c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.7 });
  return { g, foot };
}

/** Claws on the front edge of the foot (n small cones) */
function claws(k: Kit, foot: THREE.Object3D, col: C, fr: number, n = 3, len = 0.5): void {
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    k.cone(foot, col, fr * 0.16, fr * len, [u * fr * 0.55, -fr * 0.2, fr * 1.15], [PI / 2 + 0.25, 0, 0], 6, { outline: false });
  }
}

/**
 * Swaying tail: a tapered tube along a curve, split into two segments (each registered in c.tails, with different phases);
 * returns the group at the tail tip (positioned at the very end of the tail) and the tip's direction, so a flame / tail fin can be attached.
 */
function tailTube(k: Kit, c: Creature, parent: THREE.Object3D, col: C, pts: V3[], r0: number, r1: number, o: { amp?: number; phase?: number; axis?: 'x' | 'y' | 'z' } & PartOpts = {}): { end: THREE.Group; dir: V3; mid: THREE.Group } {
  const base = pts[0];
  const rootG = k.group(parent, base);
  const rel = pts.map((p): V3 => [p[0] - base[0], p[1] - base[1], p[2] - base[2]]);
  const path = new THREE.CatmullRomCurve3(rel.map(vec));
  const n = 6;
  const a: V3[] = [];
  const b: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAt(i / n);
    (i <= n / 2 ? a : b).push([p.x, p.y, p.z]);
    if (i === n / 2) b.push([p.x, p.y, p.z]);
  }
  const rMid = r0 + (r1 - r0) * 0.5;
  const amp = o.amp ?? 0.22;
  const axis = o.axis ?? 'y';
  const opts: PartOpts = { emissive: o.emissive, emissiveAmt: o.emissiveAmt };
  k.mesh(rootG, taperTube(a, (t) => r0 + (rMid - r0) * t, 18).geo, col, [0, 0, 0], [0, 0, 0], opts);
  c.tails.push({ g: rootG, phase: o.phase ?? 0, amp, axis });
  const m = b[0];
  const midG = k.group(rootG, m);
  const relB = b.map((p): V3 => [p[0] - m[0], p[1] - m[1], p[2] - m[2]]);
  k.mesh(midG, taperTube(relB, (t) => rMid + (r1 - rMid) * t, 18).geo, col, [0, 0, 0], [0, 0, 0], opts);
  // Add a ball at the joint, so no seam shows when it sways
  k.sphere(midG, col, rMid * 0.98, [0, 0, 0], [1, 1, 1], [0, 0, 0], opts);
  c.tails.push({ g: midG, phase: (o.phase ?? 0) + 0.9, amp: amp * 0.8, axis });
  const last = relB[relB.length - 1];
  const prev = relB[relB.length - 2];
  const end = k.group(midG, last);
  return { end, dir: [last[0] - prev[0], last[1] - prev[1], last[2] - prev[2]], mid: midG };
}

/**
 * Membrane wings (dragon, bat): the wing bone runs along the group's +y, the membrane is in the x-y plane and drapes toward the side·x direction (thickness along z, so the rotation.z flapping is visible),
 * the finger bones fan out from 0.42·len to each fingertip. The caller registers the group in c.wings and uses an outer group to sweep the wing back.
 * side: give -1 for the left wing (x<0) and +1 for the right wing, so the membrane drapes toward the body.
 */
function membraneWing(
  k: Kit,
  parent: THREE.Object3D,
  side: number,
  o: { len: number; wid: number; bone: C; mem: C; claw?: C; fingers?: number; thick?: number; boneR?: number; scallop?: number; memOpts?: PartOpts },
): THREE.Group {
  const g = k.group(parent);
  const L = o.len;
  const W = o.wid;
  const f = side;
  const nf = o.fingers ?? 3;
  const br = o.boneR ?? L * 0.05;
  const joint = 0.42 * L;
  // Fingertip positions (x = how far it hangs backward, y = along the wing bone)
  const tips: [number, number][] = [];
  for (let i = 0; i < nf; i++) {
    const t = nf === 1 ? 0 : i / (nf - 1);
    tips.push([W * (0.55 + 0.45 * t), L * (0.9 - 0.62 * t)]);
  }
  const sc = o.scallop ?? 0.28;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(-W * 0.05 * f, L * 0.5);
  s.lineTo(0, L);
  let px = 0;
  let py = L;
  for (const [tx, ty] of tips) {
    const mx = (px + tx) / 2;
    const my = (py + ty) / 2;
    s.quadraticCurveTo((mx - mx * sc * 0.3) * f, my - (my - joint) * sc, tx * f, ty);
    px = tx;
    py = ty;
  }
  s.quadraticCurveTo(px * 0.55 * f, py * 0.35, W * 0.2 * f, -L * 0.04);
  s.lineTo(0, 0);
  const th = o.thick ?? 0.025;
  const geo = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -th / 2);
  hard(k, g, geo, o.mem, [0, 0, 0], [0, 0, 0], o.memOpts ?? {});
  // Wing bone and finger bones
  link(k, g, o.bone, [0, 0, 0], [0, L, 0], br);
  k.sphere(g, o.bone, br * 1.5, [0, joint, 0]);
  for (const [tx, ty] of tips) link(k, g, o.bone, [0, joint, 0], [tx * f, ty, 0], br * 0.75);
  if (o.claw) {
    k.horn(g, o.claw, br * 0.9, L * 0.14, L * 0.04, [0, L, 0], [0, 0, 0]);
    for (const [tx, ty] of tips) k.cone(g, o.claw, br * 0.7, L * 0.08, [tx * f, ty, 0], [0, 0, -f * PI / 2], 6, { outline: false });
  }
  return g;
}

/** Water-drop shape (base at y=0, tip pointing up, widest radius r) */
function dropGeo(r: number): THREE.BufferGeometry {
  const prof: [number, number][] = [[0, 0], [0.5, 0.06], [0.86, 0.25], [1, 0.62], [0.9, 1.0], [0.62, 1.36], [0.3, 1.66], [0.1, 1.86], [0, 1.96]];
  return new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * r, y * r)), 16);
}

/** Glowing water bead that bobs up and down: a glowing core + translucent shell + highlight */
function droplet(k: Kit, c: Creature, parent: THREE.Object3D, col: C, r: number, pos: V3, bob = 0.03): THREE.Group {
  const g = k.group(parent, pos);
  k.glow(g, dropGeo(r), col, 2.2);
  k.glow(g, dropGeo(r * 1.3), col, 1.0, [0, -r * 0.27, 0], [0, 0, 0], 0.28);
  k.glowSphere(g, 0xffffff, r * 0.2, [-r * 0.32, r * 0.95, r * 0.6], 2.6, [1, 1.5, 0.6]);
  c.bobbers.push({ g, base: pos[1], amp: bob, speed: 1.6 + rnd(pos[0] * 7 + pos[2] * 3), phase: rnd(pos[1] * 5) * 6 });
  return g;
}

// ───────────────────────── Species ─────────────────────────

export const SPECIES_FIRSTR: Record<string, Builder> = {
  // `pyre_dragoon` (fire, partner of the rival Kael)
  // I: a small lizard lying on the ground, the head bigger than the body, limbs splayed to the sides, a small tuft of fire at the end of the tail
  // II: an adolescent sword lizard standing up, the body lengthened, a row of crimson spines on the back, the flame at the end of the tail condensed into an ember blade
  // III: an upright dragon knight, steel breastplate and pauldrons, dragon wings, a helmet, a flame sword in the right hand
  pyre_dragoon(k, c, s) {
    const SCALE = 0xff7b3a;
    const SCALE_D = 0xd8552a;
    const BELLY = 0xffe2ad;
    const CRIMSON = 0xc8412a;
    const HORN = 0xf6e7c8;
    const CLAW = 0x5a2a1a;
    const STEEL = 0xdfe3f0;
    const GOLD = 0xffc23a;
    const FLAME = 0xff4a12;
    const CORE = 0xffe066;
    const IRIS = 0xffa51f;
    const DARK = 0x2a1410;
    /** Lizard / dragon face: muzzle, nostrils, mouth, eyes (big and round in juveniles, sharp and glowing in adults), brows, fangs */
    const face = (head: THREE.Object3D, hr: number, o: { snout: number; cute: boolean; glow?: boolean }) => {
      const hs: V3 = [hr, hr * 0.92, hr * 0.98];
      const sz = hr * 0.5 * o.snout;
      ball(k, head, SCALE, 1, [0, -hr * 0.3, hr * 0.62], [hr * 0.6, hr * 0.42, sz]);
      ball(k, head, BELLY, 1, [0, -hr * 0.42, hr * 0.64], [hr * 0.48, hr * 0.26, sz * 0.9], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) ball(k, head, DARK, hr * 0.045, [sx * hr * 0.2, -hr * 0.18, hr * 0.62 + sz * 0.9], [1, 0.7, 0.6], [0, 0, 0], { outline: false }, 8);
      if (o.cute) {
        faceEyes(k, head, hs, { x: hr * 0.46, y: hr * 0.12, r: hr * 0.3, iris: IRIS, yaw: 0.3 });
        k.blush(head, hr * 0.7, -hr * 0.18, hr * 0.62, hr * 0.14);
        mouth(k, head, DARK, hr * 0.14, [0, -hr * 0.5, hr * 0.62 + sz * 0.75], [0.3, 0, 0], 0.16);
      } else {
        faceEyes(k, head, hs, { x: hr * 0.46, y: hr * 0.14, r: hr * 0.26, iris: IRIS, sharp: true, glow: o.glow, yaw: 0.3 });
        brows(k, head, SCALE_D, hr * 0.44, hr * 0.42, hr * 0.84, hr * 0.28, 0.35, hr * 0.06);
        mouth(k, head, DARK, hr * 0.2, [0, -hr * 0.48, hr * 0.62 + sz * 0.7], [0.25, 0, 0], 0.1, PI * 0.7);
        for (const sx of [-1, 1]) k.cone(head, 0xffffff, hr * 0.04, hr * 0.12, [sx * hr * 0.26, -hr * 0.5, hr * 0.62 + sz * 0.55], [PI, 0, 0], 6, { outline: false });
      }
    };
    /** Flame sword: +y is the blade-tip direction, the grip is at y<0 */
    const flameSword = (parent: THREE.Object3D, len: number) => {
      const g = k.group(parent);
      k.sphere(g, GOLD, len * 0.05, [0, -len * 0.26, 0]);
      k.cyl(g, 0x4a2a1a, len * 0.035, len * 0.04, len * 0.22, [0, -len * 0.13, 0], [0, 0, 0], 10);
      hard(k, g, new THREE.BoxGeometry(len * 0.3, len * 0.045, len * 0.06), GOLD, [0, 0, 0]);
      for (const sx of [-1, 1]) k.sphere(g, GOLD, len * 0.04, [sx * len * 0.16, 0, 0]);
      k.sphere(g, 0xff3a1a, len * 0.035, [0, 0, len * 0.035], [1, 1, 0.6], [0, 0, 0], { emissive: FLAME, emissiveAmt: 0.8 });
      const bl = len * 0.9;
      hard(k, g, poly([[-bl * 0.07, 0], [bl * 0.07, 0], [bl * 0.055, bl * 0.8], [0, bl], [-bl * 0.055, bl * 0.8]], bl * 0.035), STEEL, [0, len * 0.02, 0], [0, 0, 0], { emissive: FLAME, emissiveAmt: 0.25 });
      k.glow(g, poly([[-bl * 0.13, 0], [bl * 0.13, 0], [bl * 0.1, bl * 0.82], [0, bl * 1.1], [-bl * 0.1, bl * 0.82]], bl * 0.02), FLAME, 1.8, [0, len * 0.02, 0], [0, 0, 0], 0.5);
      k.flame(g, FLAME, CORE, bl * 0.16, [0, bl * 0.35, 0], [0, 0, 0.35]);
      k.flame(g, FLAME, CORE, bl * 0.14, [0, bl * 0.62, 0], [0, 0, -0.3]);
      k.flame(g, FLAME, CORE, bl * 0.12, [0, bl * 0.88, 0]);
      return g;
    };
    if (s === 1) {
      // I: juvenile lying on the ground
      c.archetype = 'crawl';
      const by = 0.17;
      const bs: V3 = [0.2, 0.15, 0.26];
      k.sphere(c.body, SCALE, 1, [0, by, -0.02], bs);
      ball(k, c.body, BELLY, 1, [0, by - 0.05, 0], [0.16, 0.1, 0.22], [0, 0, 0], { outline: false });
      for (let i = 0; i < 3; i++) spot(k, c.body, SCALE_D, [0, by, -0.02], bs, [0, 1, 0.55 - i * 0.5], 0.05, {}, [1, 1.3]);
      for (const sx of [-1, 1]) spot(k, c.body, SCALE_D, [0, by, -0.02], bs, [sx * 0.9, 0.5, 0.2], 0.035);
      const head = k.group(c.body, [0, 0.3, 0.27]);
      c.head = head;
      const hr = 0.24;
      k.sphere(head, SCALE, hr, [0, 0, 0], [1, 0.92, 0.98]);
      face(head, hr, { snout: 0.7, cute: true });
      for (const sx of [-1, 1]) ball(k, head, HORN, 0.04, [sx * 0.11, hr * 0.86, -0.03], [1, 1.35, 1]);
      // Four short legs splayed to the sides
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const g = k.group(c.body, [sx * 0.15, by - 0.02, sz * 0.13]);
          k.capsule(g, SCALE, 0.045, 0.09, [sx * 0.07, -0.02, 0], [0, 0, sx * 1.25]);
          k.sphere(g, SCALE, 0.045, [sx * 0.13, -0.05, 0]);
          k.capsule(g, SCALE, 0.038, 0.06, [sx * 0.14, -0.09, 0], [0, 0, sx * 0.15]);
          const foot = k.group(g, [sx * 0.15, -0.11, 0.01]);
          ball(k, foot, SCALE, 0.05, [0, 0, 0], [1.1, 0.5, 1.3]);
          claws(k, foot, CLAW, 0.05, 3, 0.4);
          c.legs.push({ g, phase: sx * sz > 0 ? 0 : PI, amp: 0.5 });
        }
      }
      const t = tailTube(k, c, c.body, SCALE, [[0, by, -0.24], [0, by + 0.01, -0.4], [0, by + 0.08, -0.52], [0, by + 0.2, -0.58]], 0.075, 0.03, { amp: 0.3 });
      k.flame(t.end, FLAME, CORE, 0.12, [0, 0, 0], [0, 0, 0]);
      sparkle(k, c, c.body, CORE, 0.018, [0.12, 0.5, -0.5], 0.05);
      sparkle(k, c, c.body, FLAME, 0.014, [-0.14, 0.42, -0.55], 0.06);
      return;
    }
    if (s === 2) {
      // II: adolescent quadruped sword lizard
      c.archetype = 'quad';
      const leg = 0.34;
      const by = leg + 0.13;
      k.sphere(c.body, SCALE, 1, [0, by + 0.01, 0.19], [0.2, 0.19, 0.21]);
      k.sphere(c.body, SCALE, 1, [0, by - 0.01, -0.22], [0.17, 0.16, 0.19]);
      k.capsule(c.body, SCALE, 0.16, 0.4, [0, by, -0.02], [PI / 2, 0, 0]);
      ball(k, c.body, BELLY, 1, [0, by - 0.1, -0.02], [0.14, 0.09, 0.42], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        spot(k, c.body, SCALE_D, [0, by + 0.01, 0.19], [0.2, 0.19, 0.21], [sx * 0.9, 0.45, 0.3], 0.045);
        spot(k, c.body, SCALE_D, [0, by - 0.01, -0.22], [0.17, 0.16, 0.19], [sx * 0.9, 0.5, -0.2], 0.04);
      }
      for (const sx of [-1, 1]) {
        const f = quadLeg(k, c, c.body, sx, 0.14, 0.21, { col: SCALE, r: 0.052, len: leg, front: true, footR: 0.066 });
        claws(k, f.foot, CLAW, 0.066);
        const h = quadLeg(k, c, c.body, sx, 0.13, -0.24, { col: SCALE, r: 0.056, len: leg, front: false, footR: 0.068 });
        claws(k, h.foot, CLAW, 0.068);
      }
      k.capsule(c.body, SCALE, 0.085, 0.16, [0, by + 0.15, 0.37], [0.8, 0, 0]);
      const head = k.group(c.body, [0, by + 0.3, 0.5]);
      c.head = head;
      const hr = 0.17;
      k.sphere(head, SCALE, hr, [0, 0, 0], [1, 0.92, 0.98]);
      face(head, hr, { snout: 1, cute: false });
      for (const sx of [-1, 1]) k.horn(head, HORN, 0.032, 0.17, 0.07, [sx * 0.1, hr * 0.68, -hr * 0.25], [-0.55, 0, -sx * 0.45]);
      // A row of crimson spines on the back, with an ember glow at the tips
      for (let i = 0; i < 5; i++) {
        const z = 0.26 - i * 0.12;
        const y = by + 0.175 - Math.abs(z - 0.1) * 0.12;
        const g = k.group(c.body, [0, y, z], [-0.55 - i * 0.05, 0, 0]);
        k.blade(g, CRIMSON, 0.13 - i * 0.008, 0.07, 0.03, [0, -0.02, 0]);
        k.glowSphere(g, CORE, 0.012, [0, 0.1 - i * 0.006, 0], 2.2);
      }
      const t = tailTube(k, c, c.body, SCALE, [[0, by - 0.02, -0.38], [0, by - 0.05, -0.56], [0, by, -0.72], [0, by + 0.12, -0.82]], 0.075, 0.035, { amp: 0.25 });
      // Ember blade at the tail end: the flame condenses here into a glowing blade
      const fin = aim(k.group(t.end), t.dir);
      hard(k, fin, poly([[-0.03, 0], [0.03, 0], [0.024, 0.2], [0, 0.3], [-0.024, 0.2]], 0.014), GOLD, [0, 0.02, 0], [0, 0, 0], { emissive: FLAME, emissiveAmt: 0.65 });
      k.flame(fin, FLAME, CORE, 0.12, [0, 0, 0]);
      for (let i = 0; i < 3; i++) sparkle(k, c, c.body, i % 2 ? CORE : FLAME, 0.016, [Math.cos(i * 2.1) * 0.25, 0.5 + i * 0.12, -0.45 - i * 0.12], 0.05);
      return;
    }
    // III: upright dragon knight
    c.archetype = 'biped';
    const leg = 0.42;
    for (const sx of [-1, 1]) {
      const l = bipedLeg(k, c, c.body, sx, 0.13, 0, { col: SCALE, r: 0.062, len: leg, footR: 0.08 });
      claws(k, l.foot, CLAW, 0.08);
      k.cyl(l.g, STEEL, 0.07, 0.082, 0.15, [0, -leg * 0.74, 0.01], [0.1, 0, 0], 14);
      k.torus(l.g, GOLD, 0.075, 0.012, [0, -leg * 0.56, 0.01], [PI / 2, 0, 0]);
    }
    const ty = leg + 0.3;
    k.sphere(c.body, SCALE, 1, [0, leg + 0.08, 0], [0.18, 0.14, 0.15]);
    k.sphere(c.body, SCALE, 1, [0, ty, 0.02], [0.22, 0.22, 0.19]);
    // Steel breastplate: a gold belt and collar, an ember gem on the chest
    k.sphere(c.body, STEEL, 1, [0, ty + 0.01, 0.04], [0.235, 0.2, 0.19]);
    k.torus(c.body, GOLD, 0.235, 0.022, [0, ty - 0.14, 0.03], [PI / 2, 0, 0]);
    k.torus(c.body, GOLD, 0.15, 0.02, [0, ty + 0.18, 0.03], [PI / 2 + 0.15, 0, 0]);
    hard(k, c.body, new THREE.OctahedronGeometry(0.045, 0), 0xff3a1a, [0, ty + 0.04, 0.24], [0, 0, 0], { emissive: FLAME, emissiveAmt: 0.85 });
    k.glowSphere(c.body, CORE, 0.02, [0, ty + 0.04, 0.27], 2.4);
    ball(k, c.body, BELLY, 1, [0, leg + 0.12, 0.13], [0.13, 0.08, 0.06], [0, 0, 0], { outline: false });
    // Pauldrons: steel hemispheres + gold edge + crimson spikes
    for (const sx of [-1, 1]) {
      const p = k.group(c.body, [sx * 0.26, ty + 0.17, 0.02], [0, 0, -sx * 0.5]);
      k.lathe(p, STEEL, [[0.12, 0], [0.115, 0.04], [0.09, 0.09], [0.05, 0.12], [0.001, 0.13]]);
      k.torus(p, GOLD, 0.12, 0.014, [0, 0.005, 0], [PI / 2, 0, 0]);
      k.cone(p, CRIMSON, 0.03, 0.12, [sx * 0.06, 0.09, 0], [0, 0, -sx * 0.7], 8);
    }
    // Arms: the right hand raises the sword, the left hand makes a fist hanging at the side
    const hands: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const base = sx > 0 ? new THREE.Euler(-1.05, 0, 0.3) : new THREE.Euler(0.2, 0, -0.45);
      const g = k.group(c.body, [sx * 0.25, ty + 0.14, 0.02], [base.x, base.y, base.z]);
      k.sphere(g, SCALE, 0.07, [0, 0, 0]);
      k.capsule(g, SCALE, 0.058, 0.12, [0, -0.1, 0]);
      k.sphere(g, SCALE, 0.06, [0, -0.19, 0]);
      k.capsule(g, STEEL, 0.062, 0.11, [0, -0.28, 0]);
      k.torus(g, GOLD, 0.066, 0.011, [0, -0.225, 0], [PI / 2, 0, 0]);
      k.sphere(g, SCALE, 0.07, [0, -0.37, 0], [1, 0.9, 1]);
      const hand = k.group(g, [0, -0.38, 0]);
      hands.push(hand);
      c.arms.push({ g, side: sx, base });
    }
    {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.05, 0, 0.3)).invert();
      const d = new THREE.Vector3(0.05, 1, 0.45).applyQuaternion(q);
      aim(flameSword(hands[1], 0.8), [d.x, d.y, d.z]);
    }
    // Head: a dragon head + an open-faced steel helmet (gold edge, an ember flame on top), long horns swept backward
    k.capsule(c.body, SCALE, 0.075, 0.1, [0, ty + 0.26, 0.04]);
    const head = k.group(c.body, [0, ty + 0.36, 0.06]);
    c.head = head;
    const hr = 0.19;
    k.sphere(head, SCALE, hr, [0, 0, 0], [1, 0.92, 0.98]);
    face(head, hr, { snout: 1.1, cute: false, glow: true });
    const helm = k.group(head, [0, hr * 0.06, -hr * 0.1], [-0.55, 0, 0]);
    k.lathe(helm, STEEL, [[hr * 1.07, hr * 0.12], [hr * 1.05, hr * 0.35], [hr * 0.9, hr * 0.7], [hr * 0.56, hr * 0.98], [0.001, hr * 1.08]]);
    k.torus(helm, GOLD, hr * 1.06, hr * 0.045, [0, hr * 0.13, 0], [PI / 2, 0, 0]);
    k.cone(helm, GOLD, hr * 0.14, hr * 0.28, [0, hr * 0.5, hr * 1.0], [PI / 2 - 0.3, 0, 0], 6);
    k.flame(helm, FLAME, CORE, 0.075, [0, hr * 1.02, 0]);
    for (const sx of [-1, 1]) k.horn(head, HORN, 0.04, 0.3, 0.1, [sx * 0.11, hr * 0.55, -hr * 0.35], [-0.75, 0, -sx * 0.5]);
    // Dragon wings: swept back, flapping slowly
    for (const sx of [-1, 1]) {
      const holder = k.group(c.body, [sx * 0.1, ty + 0.14, -0.17], [0.25, sx * 0.4, 0]);
      const w = membraneWing(k, holder, sx, { len: 0.64, wid: 0.5, bone: SCALE, mem: CRIMSON, claw: GOLD, boneR: 0.026, memOpts: { emissive: FLAME, emissiveAmt: 0.12 } });
      c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: 0.95, amp: 0.12, speed: 2.4 });
    }
    const t = tailTube(k, c, c.body, SCALE, [[0, leg + 0.06, -0.14], [0, leg - 0.02, -0.36], [0, leg - 0.04, -0.56], [0, leg + 0.06, -0.72]], 0.075, 0.03, { amp: 0.2 });
    k.torus(t.mid, GOLD, 0.06, 0.012, [0, 0, 0], [0, 0, 0]);
    k.flame(t.end, FLAME, CORE, 0.14, [0, 0, 0]);
    for (let i = 0; i < 4; i++) sparkle(k, c, c.body, i % 2 ? CORE : FLAME, 0.016, [Math.cos(i * 1.7) * 0.42, 0.45 + i * 0.16, Math.sin(i * 1.7) * 0.3 - 0.1], 0.06);
  },
  // `oathsea_sage` (water)
  // I: a small otter sitting on the ground hugging a pink scallop, the head bigger than the body, feet pointing forward, the tail flat on the ground
  // II: an adolescent otter standing up, the body and tail lengthened, glowing tide markings on its fur, a shell necklace, a conch for recording the tides in its left hand
  // III: a sage in a long robe and a wave-crest hat, white brows and beard, the right hand's coral staff holding up a pearl, the left hand an open shell, the "Tide Chronicle"
  oathsea_sage(k, c, s) {
    const FUR = 0x5ab3de;
    const FUR_D = 0x3d8fbf;
    const CREAM = 0xf6ecd4;
    const NOSE = 0x1e2233;
    const IRIS = 0x1b4f8a;
    const TIDE = 0x8fe8ff;
    const PINK = 0xf6c1c9;
    const SHELL = 0xffd6e0;
    const SHELL_D = 0xe08aa0;
    const CORAL = 0xe07a5f;
    const CORAL_L = 0xff9b85;
    const ROBE = 0x26467e;
    const ROBE_L = 0x3a6aa8;
    const GOLD = 0xffcf5a;
    const PEARL = 0xeaf6ff;
    const WHITE = 0xfafaff;
    /** Otter face: cream muzzle, black nose tip, smile, whiskers, round ears, big eyes, blush; old = the sage's white brows, white beard, chin tuft */
    const otterFace = (head: THREE.Object3D, hr: number, o: { old?: boolean }) => {
      const hs: V3 = [hr, hr * 0.95, hr * 0.95];
      ball(k, head, CREAM, 1, [0, -hr * 0.28, hr * 0.62], [hr * 0.62, hr * 0.46, hr * 0.42], [0, 0, 0], { outline: false });
      ball(k, head, NOSE, hr * 0.13, [0, -hr * 0.12, hr * 1.0], [1.25, 0.85, 0.7]);
      mouth(k, head, NOSE, hr * 0.1, [0, -hr * 0.34, hr * 0.98], [0.2, 0, 0], 0.18);
      faceEyes(k, head, hs, { x: hr * 0.42, y: hr * 0.14, r: o.old ? hr * 0.26 : hr * 0.3, iris: IRIS, yaw: 0.3 });
      k.blush(head, hr * 0.7, -hr * 0.2, hr * 0.66, hr * 0.14);
      for (const sx of [-1, 1]) {
        const wl = hr * (o.old ? 1.1 : 0.7);
        for (let i = 0; i < 2; i++) k.cyl(head, WHITE, 0.005, 0.005, wl, [sx * (hr * 0.45 + wl * 0.4), -hr * 0.22 - i * hr * 0.1, hr * 0.85], [0, 0, sx * (PI / 2 + 0.25 - i * 0.35)], 4, { outline: false });
        const g = k.group(head, [sx * hr * 0.8, hr * 0.6, -hr * 0.05]);
        k.sphere(g, FUR, hr * 0.24, [0, 0, 0], [1, 1, 0.55]);
        ball(k, g, PINK, hr * 0.14, [0, 0, hr * 0.08], [1, 1, 0.35], [0, 0, 0], { outline: false });
        c.ears.push({ g, phase: sx * 2.1 });
      }
      if (o.old) {
        brows(k, head, WHITE, hr * 0.42, hr * 0.5, hr * 0.8, hr * 0.32, -0.2, hr * 0.07);
        for (const sx of [-1, 1]) ball(k, head, WHITE, hr * 0.07, [sx * hr * 0.26, -hr * 0.34, hr * 0.92], [2.8, 0.6, 0.5], [0, 0, -sx * 0.45], { outline: false });
        ball(k, head, WHITE, hr * 0.1, [0, -hr * 0.66, hr * 0.66], [0.8, 1.7, 0.7], [0.35, 0, 0], { outline: false });
      } else {
        for (let i = 0; i < 3; i++) k.horn(head, FUR_D, hr * 0.05, hr * 0.22, hr * 0.12, [(i - 1) * hr * 0.14, hr * 0.9, hr * 0.1], [-0.3 + (i - 1) * 0.2, 0, (i - 1) * 0.6]);
      }
    };
    /** Scallop: a flattened spherical shell + radial ribs, a pearl can be added; with open, an extra lifted upper shell is added */
    const scallop = (parent: THREE.Object3D, R: number, pos: V3, rot: V3, o: { pearl?: boolean; open?: boolean } = {}) => {
      const g = k.group(parent, pos, rot);
      const half = (gg: THREE.Object3D) => {
        k.sphere(gg, SHELL, R, [0, 0, 0], [1, 0.9, 0.32]);
        for (const a of [-0.8, -0.4, 0, 0.4, 0.8]) link(k, gg, SHELL_D, [0, -R * 0.55, R * 0.26], [Math.sin(a) * R * 0.72, -R * 0.55 + Math.cos(a) * R * 1.3, R * 0.28], R * 0.045, { outline: false });
      };
      half(g);
      if (o.open) {
        const lid = k.group(g, [0, -R * 0.7, 0], [-1.25, 0, 0]);
        const gg = k.group(lid, [0, R * 0.7, 0]);
        half(gg);
      }
      if (o.pearl) k.glowSphere(g, PEARL, R * 0.28, [0, R * 0.05, R * 0.34], 2.2);
      return g;
    };
    /** Tide markings: two glowing arcs joined into a wave (local z facing outward, stuck on the surface) */
    const tideMark = (parent: THREE.Object3D, pos: V3, rot: V3, R: number, intensity = 2.0) => {
      const g = k.group(parent, pos, rot);
      k.glow(g, new THREE.TorusGeometry(R, R * 0.2, 6, 14, PI), TIDE, intensity, [-R, 0, 0], [0, 0, 0], 0.95);
      k.glow(g, new THREE.TorusGeometry(R, R * 0.2, 6, 14, PI), TIDE, intensity, [R, 0, 0], [0, 0, PI], 0.95);
      return g;
    };
    /** Flat paddle-shaped tail fin, along +y */
    const paddle = (parent: THREE.Object3D, L: number) => ball(k, parent, FUR_D, 1, [0, L * 0.45, 0], [L * 0.32, L * 0.5, L * 0.12]);
    if (s === 1) {
      // I: sitting juvenile otter
      c.archetype = 'biped';
      const by = 0.22;
      k.sphere(c.body, FUR, 1, [0, by, 0], [0.23, 0.22, 0.21]);
      ball(k, c.body, CREAM, 1, [0, by - 0.03, 0.1], [0.16, 0.15, 0.13], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        const g = k.group(c.body, [sx * 0.11, 0.15, 0.12], [-0.95, 0, sx * 0.15]);
        k.capsule(g, FUR, 0.05, 0.08, [0, -0.06, 0]);
        ball(k, g, FUR_D, 0.06, [0, -0.13, 0.01], [1, 0.55, 1.35]);
        c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.3 });
      }
      for (const sx of [-1, 1]) {
        const base = new THREE.Euler(-1.2, 0, -sx * 0.5);
        const g = k.group(c.body, [sx * 0.19, by + 0.1, 0.06], [base.x, base.y, base.z]);
        k.capsule(g, FUR, 0.045, 0.1, [0, -0.07, 0]);
        ball(k, g, FUR_D, 0.05, [0, -0.15, 0]);
        c.arms.push({ g, side: sx, base });
      }
      scallop(c.body, 0.1, [0, by + 0.04, 0.23], [-0.45, 0, 0], { pearl: true });
      const head = k.group(c.body, [0, by + 0.31, 0.02]);
      c.head = head;
      const hr = 0.27;
      k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.95, 0.95]);
      otterFace(head, hr, {});
      const tail = k.group(c.body, [0, 0.05, -0.16]);
      ball(k, tail, FUR, 1, [0, 0, -0.1], [0.08, 0.035, 0.16]);
      c.tails.push({ g: tail, phase: 0, amp: 0.35, axis: 'y' });
      droplet(k, c, c.body, TIDE, 0.03, [0.22, 0.5, 0.2], 0.03);
      droplet(k, c, c.body, TIDE, 0.022, [-0.26, 0.42, 0.14], 0.04);
      return;
    }
    if (s === 2) {
      // II: standing adolescent otter
      c.archetype = 'biped';
      const leg = 0.22;
      for (const sx of [-1, 1]) {
        const l = bipedLeg(k, c, c.body, sx, 0.1, 0, { col: FUR, r: 0.055, len: leg, foot: FUR_D, footR: 0.065, footScale: [1.2, 0.5, 1.5] });
        for (const u of [-1, 0, 1]) ball(k, l.foot, FUR_D, 0.02, [u * 0.04, -0.005, 0.09], [1, 0.6, 1.4], [0, 0, 0], { outline: false });
      }
      const ty = leg + 0.22;
      k.sphere(c.body, FUR, 1, [0, ty, 0], [0.17, 0.23, 0.15]);
      k.sphere(c.body, FUR, 1, [0, leg + 0.06, 0], [0.16, 0.12, 0.14]);
      ball(k, c.body, CREAM, 1, [0, ty - 0.02, 0.07], [0.12, 0.18, 0.1], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        tideMark(c.body, [sx * 0.165, ty + 0.06, -0.02], [0, sx * PI / 2, 0], 0.028);
        tideMark(c.body, [sx * 0.15, ty - 0.08, -0.06], [0, sx * PI / 2 + sx * 0.4, 0], 0.022);
      }
      tideMark(c.body, [0, ty + 0.12, -0.15], [0, PI, 0], 0.03);
      // Arms: the left hand cradles the conch in front of the chest, the right hand hangs at the side
      for (const sx of [-1, 1]) {
        const base = sx < 0 ? new THREE.Euler(-1.3, 0, 0.55) : new THREE.Euler(0.15, 0, 0.35);
        const g = k.group(c.body, [sx * 0.17, ty + 0.13, 0.02], [base.x, base.y, base.z]);
        k.sphere(g, FUR, 0.055, [0, 0, 0]);
        k.capsule(g, FUR, 0.045, 0.14, [0, -0.1, 0]);
        ball(k, g, FUR_D, 0.05, [0, -0.2, 0]);
        if (sx < 0) {
          const conch = k.group(g, [0.02, -0.2, 0.03], [0.3, 0, -0.6]);
          k.lathe(conch, SHELL, [[0.001, 0], [0.05, 0.02], [0.075, 0.09], [0.06, 0.17], [0.032, 0.25], [0.001, 0.32]]);
          for (let i = 0; i < 3; i++) k.horn(conch, CORAL_L, 0.014, 0.05, 0.02, [Math.cos(i * 2.1) * 0.06, 0.06, Math.sin(i * 2.1) * 0.06], [Math.sin(i * 2.1) * 0.8, 0, -Math.cos(i * 2.1) * 0.8]);
          ball(k, conch, PINK, 0.03, [0, 0.1, 0.07], [1, 1.4, 0.5], [0, 0, 0], { outline: false });
          k.glowSphere(conch, TIDE, 0.012, [0, 0.1, 0.085], 2.2);
        }
        c.arms.push({ g, side: sx, base });
      }
      // Shell necklace
      k.torus(c.body, CREAM, 0.15, 0.006, [0, ty + 0.17, 0.0], [PI / 2 + 0.4, 0, 0], PI * 2, { outline: false });
      for (let i = -1.5; i <= 1.5; i++) {
        const a = i * 0.42;
        scallop(c.body, 0.028, [Math.sin(a) * 0.15, ty + 0.17 - Math.cos(a) * 0.058 - 0.02, Math.cos(a) * 0.14], [-0.3, a, 0]);
      }
      const t = tailTube(k, c, c.body, FUR, [[0, leg + 0.05, -0.12], [0, leg - 0.04, -0.3], [0, leg + 0.02, -0.46], [0, leg + 0.14, -0.56]], 0.055, 0.03, { amp: 0.3 });
      paddle(aim(k.group(t.end), t.dir), 0.16);
      tideMark(t.mid, [0, 0.045, -0.02], [-PI / 2, 0, 0], 0.02);
      const head = k.group(c.body, [0, ty + 0.3, 0.02]);
      c.head = head;
      const hr = 0.2;
      k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.95, 0.95]);
      otterFace(head, hr, {});
      droplet(k, c, c.body, TIDE, 0.03, [0.3, 0.7, 0.1], 0.04);
      droplet(k, c, c.body, TIDE, 0.024, [-0.3, 0.5, 0.15], 0.05);
      droplet(k, c, c.body, TIDE, 0.02, [0.12, 0.95, -0.2], 0.04);
      return;
    }
    // III: robed sage
    c.archetype = 'biped';
    k.lathe(c.body, ROBE, [[0.33, 0], [0.31, 0.06], [0.23, 0.28], [0.17, 0.54], [0.15, 0.72], [0.12, 0.8]]);
    k.torus(c.body, GOLD, 0.325, 0.014, [0, 0.035, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      tideMark(c.body, [Math.sin(a) * 0.3, 0.11, Math.cos(a) * 0.3], [0, a, 0], 0.03);
    }
    tideMark(c.body, [0, 0.42, 0.2], [0, 0, 0], 0.035);
    k.torus(c.body, GOLD, 0.195, 0.016, [0, 0.46, 0], [PI / 2 + 0.12, 0, 0]);
    for (const sx of [-1, 1]) ball(k, c.body, FUR_D, 0.06, [sx * 0.1, 0.03, 0.27], [1.2, 0.5, 1.5]);
    // Short shawl and pearl necklace
    k.lathe(c.body, ROBE_L, [[0.27, 0.66], [0.25, 0.72], [0.17, 0.82], [0.12, 0.86]]);
    k.torus(c.body, GOLD, 0.268, 0.014, [0, 0.665, 0], [PI / 2, 0, 0]);
    k.torus(c.body, CREAM, 0.16, 0.006, [0, 0.82, 0.0], [PI / 2 + 0.45, 0, 0], PI * 2, { outline: false });
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.36;
      k.glowSphere(c.body, PEARL, i === 0 ? 0.03 : 0.018, [Math.sin(a) * 0.16, 0.82 - Math.cos(a) * 0.077 - (i === 0 ? 0.01 : 0), Math.cos(a) * 0.145], 1.8);
    }
    // Arms: wide sleeves; the right hand holds the staff, the left hand holds up the open shell
    const hands: THREE.Group[] = [];
    const bases: THREE.Euler[] = [];
    for (const sx of [-1, 1]) {
      const base = sx > 0 ? new THREE.Euler(-0.55, 0, 0.42) : new THREE.Euler(-1.2, 0, -0.3);
      bases.push(base);
      const g = k.group(c.body, [sx * 0.23, 0.76, 0.03], [base.x, base.y, base.z]);
      k.sphere(g, ROBE_L, 0.07, [0, 0, 0]);
      k.capsule(g, ROBE, 0.06, 0.13, [0, -0.1, 0]);
      k.cone(g, ROBE, 0.085, 0.09, [0, -0.13, 0], [PI, 0, 0], 14);
      k.torus(g, GOLD, 0.083, 0.01, [0, -0.215, 0], [PI / 2, 0, 0]);
      ball(k, g, FUR_D, 0.05, [0, -0.25, 0]);
      const hand = k.group(g, [0, -0.26, 0]);
      hands.push(hand);
      c.arms.push({ g, side: sx, base });
    }
    {
      const q = new THREE.Quaternion().setFromEuler(bases[1]).invert();
      const d = new THREE.Vector3(0.06, 1, 0.04).applyQuaternion(q);
      const staff = aim(k.group(hands[1]), [d.x, d.y, d.z]);
      k.cyl(staff, CORAL, 0.02, 0.026, 1.1, [0, 0.18, 0], [0, 0, 0], 10);
      k.cone(staff, GOLD, 0.03, 0.06, [0, -0.37, 0], [PI, 0, 0], 8);
      k.torus(staff, GOLD, 0.03, 0.01, [0, 0.7, 0], [PI / 2, 0, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2;
        k.horn(staff, CORAL_L, 0.024, 0.2, 0.09, [Math.sin(a) * 0.045, 0.71, Math.cos(a) * 0.045], [0, a, 0]);
      }
      k.glowSphere(staff, PEARL, 0.062, [0, 0.85, 0], 2.0);
      k.glowSphere(staff, TIDE, 0.085, [0, 0.85, 0], 1.0, [1, 1, 1], 0.3);
      spinRing(k, c, staff, TIDE, 0.12, 0.008, [0, 0.85, 0], [PI / 2, 0, 0], 1.4, 'y', { beads: 3, beadCol: PEARL, beadR: 0.016, opacity: 0.85 });
      sparkle(k, c, staff, PEARL, 0.014, [0.08, 0.99, 0.03], 0.03);
      sparkle(k, c, staff, TIDE, 0.012, [-0.07, 0.77, -0.05], 0.03);
      // The open shell on the left palm, the "Tide Chronicle"
      const q2 = new THREE.Quaternion().setFromEuler(bases[0]).invert();
      const up = new THREE.Vector3(0, 1, 0.15).applyQuaternion(q2);
      const book = aim(k.group(hands[0], [0, 0, 0.02]), [up.x, up.y, up.z]);
      scallop(book, 0.085, [0, 0.04, 0], [-PI / 2 + 0.2, 0, 0], { pearl: true, open: true });
    }
    // Head: an old otter's face, a wave-crest hat (the hat tip curls forward like a wave crest)
    const head = k.group(c.body, [0, 1.0, 0.03]);
    c.head = head;
    const hr = 0.2;
    k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.95, 0.95]);
    otterFace(head, hr, { old: true });
    const hat = k.group(head, [0, hr * 0.82, -hr * 0.1], [-0.3, 0, 0]);
    k.cyl(hat, ROBE, hr * 1.06, hr * 1.06, hr * 0.07, [0, 0, 0], [0, 0, 0], 28);
    k.torus(hat, ROBE, hr * 1.04, hr * 0.06, [0, 0, 0], [PI / 2, 0, 0]);
    k.mesh(hat, taperTube([[0, 0.02, 0], [0, 0.18, 0], [0, 0.33, 0.01], [0.01, 0.43, 0.07], [0.02, 0.48, 0.16]], (t) => hr * 0.9 * (1 - t) ** 1.15 + 0.014, 30, 16).geo, ROBE);
    k.torus(hat, GOLD, hr * 0.86, hr * 0.045, [0, 0.09, 0], [PI / 2, 0, 0]);
    k.glowSphere(hat, PEARL, 0.028, [0.02, 0.49, 0.17], 2.0);
    tideMark(hat, [0, 0.2, hr * 0.6], [0.2, 0, 0], 0.024);
    const t = tailTube(k, c, c.body, FUR, [[0, 0.1, -0.3], [0, 0.1, -0.44], [0, 0.17, -0.56]], 0.055, 0.03, { amp: 0.25 });
    paddle(aim(k.group(t.end), t.dir), 0.16);
    droplet(k, c, c.body, TIDE, 0.032, [0.38, 0.55, 0.15], 0.05);
    droplet(k, c, c.body, TIDE, 0.026, [-0.4, 0.8, 0.05], 0.04);
    droplet(k, c, c.body, TIDE, 0.022, [-0.2, 1.2, 0.25], 0.05);
  },
  // `elderwood_warden` (nature)
  // I: a small bear dozing on the ground, big head and round body, feet pointing forward, a tuft of moss on top of the head sprouting two seedlings
  // II: an adolescent quadruped bear, the body lengthened, a whole moss cloak and a small sapling on the back, bark starting to grow on the shoulders
  // III: an upright giant bear guardian, a bark breastplate and pauldrons, a wooden shield on the left arm, a whole ancient tree on its back, glowing spores among the canopy
  elderwood_warden(k, c, s) {
    const FUR = 0x8e5b3a;
    const FUR_D = 0x6a3f26;
    const TAN = 0xd9b48c;
    const NOSE = 0x2a1a14;
    const IRIS = 0x4a2a14;
    const IRIS_G = 0x3a7a2a;
    const MOSS = 0x6cc24a;
    const MOSS_D = 0x4fa83a;
    const LEAF = 0x9be26a;
    const BARK = 0x6b4428;
    const BARK_D = 0x4a2e1c;
    const GLOW = 0xfff6a0;
    const GLOW_G = 0xc8ff6a;
    const PINK = 0xf6b6b0;
    /** Bear face: cream muzzle, a big black nose, smile, round ears, big eyes; stern = the adult's thick brows */
    const bearFace = (head: THREE.Object3D, hr: number, o: { stern?: boolean; iris?: C }) => {
      const hs: V3 = [hr, hr * 0.94, hr * 0.96];
      ball(k, head, TAN, 1, [0, -hr * 0.3, hr * 0.66], [hr * 0.56, hr * 0.42, hr * 0.4]);
      ball(k, head, NOSE, hr * 0.16, [0, -hr * 0.16, hr * 1.02], [1.25, 0.8, 0.7]);
      mouth(k, head, NOSE, hr * 0.1, [0, -hr * 0.4, hr * 0.98], [0.2, 0, 0], 0.18);
      faceEyes(k, head, hs, { x: hr * 0.4, y: hr * 0.12, r: o.stern ? hr * 0.24 : hr * 0.3, iris: o.iris ?? IRIS, yaw: 0.28 });
      if (o.stern) brows(k, head, FUR_D, hr * 0.4, hr * 0.42, hr * 0.84, hr * 0.32, 0.3, hr * 0.075);
      else k.blush(head, hr * 0.7, -hr * 0.2, hr * 0.66, hr * 0.14);
      for (const sx of [-1, 1]) {
        const g = k.group(head, [sx * hr * 0.72, hr * 0.7, -hr * 0.1]);
        k.sphere(g, FUR, hr * 0.28, [0, 0, 0], [1, 1, 0.6]);
        ball(k, g, PINK, hr * 0.16, [0, 0, hr * 0.1], [1, 1, 0.35], [0, 0, 0], { outline: false });
        c.ears.push({ g, phase: sx * 2.3 });
      }
    };
    /** Seedling: one stem and two leaves, the whole group registered as a part that sways gently */
    const sprout = (parent: THREE.Object3D, pos: V3, L: number, leaves = 2, phase = 0) => {
      const g = k.group(parent, pos);
      k.cyl(g, MOSS_D, L * 0.05, L * 0.07, L, [0, L * 0.5, 0], [0, 0, 0], 8);
      for (let i = 0; i < leaves; i++) {
        const a = (i / leaves) * PI * 2 + 0.5;
        k.blade(g, LEAF, L * 0.7, L * 0.42, 0.04, [Math.sin(a) * L * 0.04, L * 0.85 - i * L * 0.12, Math.cos(a) * L * 0.04], [0.9 * Math.cos(a), a, -0.9 * Math.sin(a)]);
      }
      c.tails.push({ g, phase, amp: 0.12, axis: 'z' });
      return g;
    };
    /** Moss patch: a flat green spot stuck on the surface, with a paler bright dot */
    const mossSpot = (parent: THREE.Object3D, center: V3, radii: V3, dir: V3, r: number, stretch: [number, number] = [1, 1]) => {
      spot(k, parent, MOSS, center, radii, dir, r, {}, stretch, 0.3);
      spot(k, parent, LEAF, center, radii, [dir[0] + 0.15, dir[1] + 0.2, dir[2]], r * 0.4, {}, [1, 1], 0.4);
    };
    /** Bark armor: a hemispherical shell + two dark lines */
    const barkPlate = (parent: THREE.Object3D, R: number, pos: V3, rot: V3) => {
      const g = k.group(parent, pos, rot);
      k.lathe(g, BARK, [[R, 0], [R * 0.96, R * 0.3], [R * 0.78, R * 0.66], [R * 0.45, R * 0.92], [0.001, R]]);
      for (const a of [-0.6, 0.6]) k.torus(g, BARK_D, R * 0.7, R * 0.05, [0, R * 0.45, 0], [PI / 2, 0, a], PI * 0.7, { outline: false });
      return g;
    };
    if (s === 1) {
      // I: sitting small bear
      c.archetype = 'biped';
      const by = 0.24;
      k.sphere(c.body, FUR, 1, [0, by, 0], [0.25, 0.24, 0.23]);
      ball(k, c.body, TAN, 1, [0, by - 0.03, 0.12], [0.17, 0.16, 0.13], [0, 0, 0], { outline: false });
      mossSpot(c.body, [0, by, 0], [0.25, 0.24, 0.23], [0.3, 0.6, -0.7], 0.07, [1.3, 1]);
      mossSpot(c.body, [0, by, 0], [0.25, 0.24, 0.23], [-0.5, 0.3, -0.8], 0.05);
      for (const sx of [-1, 1]) {
        const g = k.group(c.body, [sx * 0.13, 0.16, 0.13], [-1.0, 0, sx * 0.2]);
        k.capsule(g, FUR, 0.06, 0.07, [0, -0.05, 0]);
        ball(k, g, FUR_D, 0.07, [0, -0.13, 0.01], [1, 0.6, 1.3]);
        ball(k, g, PINK, 0.035, [0, -0.13, 0.08], [1, 0.9, 0.5], [0, 0, 0], { outline: false });
        c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.3 });
      }
      for (const sx of [-1, 1]) {
        const base = new THREE.Euler(-0.9, 0, -sx * 0.35);
        const g = k.group(c.body, [sx * 0.21, by + 0.1, 0.06], [base.x, base.y, base.z]);
        k.capsule(g, FUR, 0.05, 0.09, [0, -0.07, 0]);
        ball(k, g, FUR_D, 0.055, [0, -0.15, 0]);
        c.arms.push({ g, side: sx, base });
      }
      const head = k.group(c.body, [0, by + 0.33, 0.02]);
      c.head = head;
      const hr = 0.28;
      k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.94, 0.96]);
      bearFace(head, hr, {});
      mossSpot(head, [0, 0, 0], [hr, hr * 0.94, hr * 0.96], [0.1, 1, 0.15], hr * 0.3, [1.4, 1]);
      sprout(head, [0.02, hr * 0.9, 0.02], 0.16, 2);
      const tail = k.group(c.body, [0, 0.12, -0.2]);
      k.sphere(tail, FUR, 0.06, [0, 0, -0.04]);
      c.tails.push({ g: tail, phase: 0, amp: 0.3, axis: 'y' });
      sparkle(k, c, c.body, GLOW, 0.014, [0.22, 0.8, 0.05], 0.04);
      sparkle(k, c, c.body, GLOW_G, 0.012, [-0.24, 0.62, -0.12], 0.05);
      return;
    }
    if (s === 2) {
      // II: quadruped adolescent bear
      c.archetype = 'quad';
      const leg = 0.28;
      const by = leg + 0.16;
      const cs: V3 = [0.23, 0.22, 0.24];
      const hs2: V3 = [0.22, 0.21, 0.22];
      k.sphere(c.body, FUR, 1, [0, by + 0.01, 0.16], cs);
      k.sphere(c.body, FUR, 1, [0, by, -0.2], hs2);
      k.capsule(c.body, FUR, 0.19, 0.34, [0, by, -0.02], [PI / 2, 0, 0]);
      ball(k, c.body, TAN, 1, [0, by - 0.13, -0.02], [0.16, 0.1, 0.4], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        const f = quadLeg(k, c, c.body, sx, 0.16, 0.2, { col: FUR, r: 0.075, len: leg, front: true, foot: FUR_D, footR: 0.085 });
        claws(k, f.foot, BARK_D, 0.085, 3, 0.4);
        const h = quadLeg(k, c, c.body, sx, 0.16, -0.24, { col: FUR, r: 0.08, len: leg, front: false, foot: FUR_D, footR: 0.09 });
        claws(k, h.foot, BARK_D, 0.09, 3, 0.4);
      }
      // Moss cloak on the back (a ring of dark moss clumps along the edge) and a sapling
      k.sphere(c.body, MOSS, 1, [0, by + 0.11, -0.05], [0.245, 0.14, 0.36]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        ball(k, c.body, i % 2 ? MOSS_D : LEAF, 0.045, [Math.sin(a) * 0.235, by + 0.12 - 0.02 * (i % 2), Math.cos(a) * 0.34 - 0.05], [1, 0.7, 1], [0, 0, 0], { outline: false });
      }
      sprout(c.body, [0.03, by + 0.24, -0.1], 0.24, 3);
      for (const sx of [-1, 1]) barkPlate(c.body, 0.09, [sx * 0.2, by + 0.12, 0.17], [0.2, 0, -sx * 0.9]);
      k.capsule(c.body, FUR, 0.13, 0.12, [0, by + 0.12, 0.34], [0.8, 0, 0]);
      const head = k.group(c.body, [0, by + 0.24, 0.46]);
      c.head = head;
      const hr = 0.22;
      k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.94, 0.96]);
      bearFace(head, hr, {});
      mossSpot(head, [0, 0, 0], [hr, hr * 0.94, hr * 0.96], [0, 0.95, -0.3], hr * 0.36, [1.5, 1]);
      k.blade(head, LEAF, 0.12, 0.07, 0.03, [0.03, hr * 0.85, -hr * 0.2], [-0.6, 0.3, 0.4]);
      const tail = k.group(c.body, [0, by + 0.02, -0.4]);
      k.sphere(tail, FUR, 0.07, [0, 0, -0.04]);
      c.tails.push({ g: tail, phase: 0, amp: 0.3, axis: 'y' });
      for (let i = 0; i < 3; i++) sparkle(k, c, c.body, i % 2 ? GLOW : GLOW_G, 0.014, [Math.cos(i * 2.1) * 0.22, by + 0.4 + i * 0.08, -0.1 + Math.sin(i * 2.1) * 0.2], 0.04);
      return;
    }
    // III: upright ancient-wood guardian
    c.archetype = 'biped';
    const leg = 0.34;
    for (const sx of [-1, 1]) {
      const l = bipedLeg(k, c, c.body, sx, 0.17, 0, { col: FUR, r: 0.09, len: leg, foot: FUR_D, footR: 0.11, footScale: [1.1, 0.6, 1.4] });
      claws(k, l.foot, BARK_D, 0.11, 3, 0.4);
      k.torus(l.g, BARK, 0.085, 0.022, [0, -leg * 0.68, 0.01], [PI / 2, 0.2, 0]);
      k.torus(l.g, BARK, 0.08, 0.02, [0, -leg * 0.82, 0.01], [PI / 2, -0.3, 0]);
    }
    const ty = leg + 0.34;
    k.sphere(c.body, FUR, 1, [0, leg + 0.1, 0], [0.26, 0.17, 0.21]);
    k.sphere(c.body, FUR, 1, [0, ty, 0.02], [0.33, 0.28, 0.27]);
    ball(k, c.body, TAN, 1, [0, ty - 0.12, 0.16], [0.18, 0.16, 0.12], [0, 0, 0], { outline: false });
    // Bark breastplate (a leaf-shaped glowing emblem), a vine belt
    const chest = k.group(c.body, [0, ty + 0.06, 0.2], [0.25, 0, 0]);
    k.lathe(chest, BARK, [[0.23, -0.04], [0.22, 0.02], [0.17, 0.09], [0.08, 0.14], [0.001, 0.15]]);
    k.glow(chest, poly([[0, 0], [0.035, 0.03], [0.03, 0.07], [0, 0.1], [-0.03, 0.07], [-0.035, 0.03]], 0.01), GLOW_G, 2.0, [0, 0.04, 0.115], [0.5, 0, 0]);
    k.torus(c.body, MOSS_D, 0.25, 0.022, [0, leg + 0.2, 0.02], [PI / 2, 0, 0]);
    // Pauldrons: bark hemispheres + moss
    for (const sx of [-1, 1]) {
      const p = barkPlate(c.body, 0.14, [sx * 0.33, ty + 0.2, 0.02], [0, 0, -sx * 0.55]);
      ball(k, p, MOSS, 0.07, [0, 0.12, 0], [1.3, 0.55, 1.2]);
      k.blade(p, LEAF, 0.1, 0.06, 0.03, [sx * 0.04, 0.13, 0.02], [-0.5, 0, -sx * 0.9]);
    }
    // Arms: the left arm raises the shield, the right paw hangs down
    const hands: THREE.Group[] = [];
    const arms: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const base = sx < 0 ? new THREE.Euler(-0.75, 0, -0.55) : new THREE.Euler(0.3, 0, 0.22);
      const g = k.group(c.body, [sx * 0.32, ty + 0.16, 0.03], [base.x, base.y, base.z]);
      arms.push(g);
      k.sphere(g, FUR, 0.09, [0, 0, 0]);
      k.capsule(g, FUR, 0.08, 0.13, [0, -0.12, 0]);
      k.cyl(g, BARK, 0.085, 0.095, 0.14, [0, -0.29, 0], [0, 0, 0], 12);
      k.torus(g, BARK_D, 0.09, 0.012, [0, -0.25, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      const hand = k.group(g, [0, -0.41, 0]);
      hands.push(hand);
      ball(k, hand, FUR_D, 0.1, [0, 0, 0], [1, 0.85, 1]);
      for (const u of [-1, 0, 1]) k.cone(hand, BARK_D, 0.02, 0.07, [u * 0.055, -0.07, 0.03], [PI - 0.3 * u * sx, 0, 0], 6, { outline: false });
      c.arms.push({ g, side: sx, base });
    }
    // Wooden shield: growth rings, a bark frame, wooden pegs, a moss emblem
    {
      const sh = k.group(arms[0], [-0.06, -0.3, 0.1], [0.2, 0.5, 0.15]);
      k.cyl(sh, BARK, 0.27, 0.27, 0.05, [0, 0, 0], [PI / 2, 0, 0], 24);
      k.torus(sh, BARK_D, 0.265, 0.025, [0, 0, 0.02], [0, 0, 0]);
      for (const R of [0.19, 0.12, 0.06]) k.torus(sh, BARK_D, R, 0.007, [0, 0, 0.027], [0, 0, 0], PI * 2, { outline: false });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        ball(k, sh, 0x8a6a48, 0.022, [Math.cos(a) * 0.23, Math.sin(a) * 0.23, 0.035], [1, 1, 0.6], [0, 0, 0], { outline: false });
      }
      ball(k, sh, MOSS, 0.075, [0, 0.01, 0.04], [1, 1.1, 0.4]);
      k.glow(sh, poly([[0, 0], [0.03, 0.025], [0.026, 0.06], [0, 0.085], [-0.026, 0.06], [-0.03, 0.025]], 0.01), GLOW_G, 2.0, [0, -0.03, 0.065]);
    }
    // Head: thick brows, green eyes, moss on top of the head
    k.capsule(c.body, FUR, 0.1, 0.08, [0, ty + 0.3, 0.05]);
    const head = k.group(c.body, [0, ty + 0.42, 0.08]);
    c.head = head;
    const hr = 0.215;
    k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.94, 0.96]);
    bearFace(head, hr, { stern: true, iris: IRIS_G });
    mossSpot(head, [0, 0, 0], [hr, hr * 0.94, hr * 0.96], [0, 0.95, -0.25], hr * 0.34, [1.6, 1]);
    k.blade(head, LEAF, 0.1, 0.06, 0.03, [-0.04, hr * 0.88, -hr * 0.15], [-0.5, -0.4, -0.5]);
    // The ancient tree on its back: a trunk, roots gripping the shoulders and back, four clumps of canopy, floating spores
    const treeBase: V3 = [0, ty + 0.1, -0.24];
    const tree = k.group(c.body, treeBase);
    k.mesh(tree, taperTube([[0, -0.12, 0.02], [0, 0.2, -0.07], [0.02, 0.46, -0.18], [0.03, 0.66, -0.27]], (t) => 0.11 - t * 0.05, 24, 12).geo, BARK);
    for (const [x, y, z] of [[-0.16, 0.04, 0.12], [0.16, 0.01, 0.13], [0, -0.06, 0.18], [-0.12, -0.1, -0.08], [0.13, -0.12, -0.06]] as V3[]) tube(k, tree, BARK, [[0, -0.02, 0.01], [x * 0.5, y * 0.5 - 0.02, z * 0.5], [x, y, z]], 0.05, 0.02, {}, 12);
    link(k, tree, BARK, [0.02, 0.42, -0.16], [0.28, 0.56, -0.12], 0.035);
    link(k, tree, BARK, [0.01, 0.34, -0.13], [-0.26, 0.5, -0.2], 0.035);
    const canopy = k.group(tree, [0.03, 0.66, -0.27]);
    for (const [x, y, z, r] of [[0, 0.08, 0, 0.28], [0.26, -0.06, 0.04, 0.2], [-0.27, -0.08, -0.02, 0.21], [0.05, 0.3, -0.04, 0.18], [-0.04, -0.06, 0.2, 0.16], [0.02, -0.1, -0.2, 0.15]] as [number, number, number, number][]) {
      ball(k, canopy, MOSS, r, [x, y, z], [1, 1, 1], [0, 0, 0], {}, 18);
      ball(k, canopy, LEAF, r * 0.42, [x - r * 0.3, y + r * 0.55, z + r * 0.5], [1.2, 0.6, 1], [0, 0, 0], { outline: false });
    }
    k.torus(canopy, BARK_D, 0.03, 0.01, [0.05, 0.46, -0.04], [0, 0, 0]);
    c.tails.push({ g: canopy, phase: 1.2, amp: 0.05, axis: 'z' });
    for (let i = 0; i < 6; i++) sparkle(k, c, canopy, i % 2 ? GLOW : GLOW_G, 0.017, [Math.cos(i * 1.4) * 0.36, -0.05 + (i % 3) * 0.16, Math.sin(i * 1.4) * 0.32], 0.05);
    const tail = k.group(c.body, [0, leg + 0.06, -0.2]);
    k.sphere(tail, FUR, 0.07, [0, 0, -0.04]);
    c.tails.push({ g: tail, phase: 0, amp: 0.25, axis: 'y' });
    mossSpot(c.body, [0, ty, 0.02], [0.33, 0.28, 0.27], [-0.7, 0.5, -0.5], 0.06);
    mossSpot(c.body, [0, ty, 0.02], [0.33, 0.28, 0.27], [0.75, 0.2, -0.6], 0.05);
  },
  // `stormram` (thunder)
  // I: a fluffball that throws off static, short legs almost buried in wool, a tuft of cowlick on its head
  // II: an adolescent ram with longer legs, lightning sparking out of its wool, small curled horns growing on the brow, a ring of wool mane around the neck
  // III: a sturdy ram, arcs of electricity jumping between golden spiral horns, the lower half of its wool a thundercloud-colored storm cape, a ring of thunder light around it
  stormram(k, c, s) {
    const WOOL = 0xfff5d8;
    const WOOL_S = 0xfffbe8;
    const CLOUD = 0x9a96b8;
    const FACE = 0x4b4a6e;
    const FACE_L = 0x66648c;
    const HOOF = 0x2e2c48;
    const HORN = 0xd8c8a0;
    const GOLD = 0xffcf3a;
    const SPARK = 0xfff066;
    const VOLT = 0x8ff0ff;
    const IRIS = 0xffd21a;
    const PINK = 0xf6a8b8;
    const DARK = 0x24223a;
    /** A clump of wool: a core ellipsoid + fluff balls stuck on the surface (lat limits the latitude range, to make storm-cloud wool growing only on the lower half) */
    const wool = (parent: THREE.Object3D, ctr: V3, rad: V3, n: number, seed: number, col: C = WOOL, puffR = 0.1, lat: [number, number] = [-0.35, 0.5], core = true) => {
      const g = k.group(parent, ctr);
      if (core) k.sphere(g, col, 1, [0, 0, 0], rad);
      for (let i = 0; i < n; i++) {
        const u = (i / n) * PI * 2 + rnd(seed + i * 3.1) * 0.8;
        const v = (lat[0] + rnd(seed + i * 7.3) * (lat[1] - lat[0])) * PI;
        const r = puffR * (0.75 + rnd(seed + i * 11.7) * 0.5);
        ball(k, g, i % 4 === 0 ? WOOL_S : col, r, [Math.cos(v) * Math.sin(u) * rad[0] * 0.88, Math.sin(v) * rad[1] * 0.88, Math.cos(v) * Math.cos(u) * rad[2] * 0.88], [1, 1, 1], [0, 0, 0], {}, 16);
      }
      return g;
    };
    /** Sheep face: a slightly long muzzle, nostrils, mouth, eyes, drooping ears, a cowlick on the head; stern = the adult's thick brows and glowing eyes */
    const sheepFace = (head: THREE.Object3D, hr: number, o: { stern?: boolean; tuft?: number }) => {
      const hs: V3 = [hr, hr * 1.02, hr * 1.1];
      k.sphere(head, FACE, 1, [0, 0, 0], hs);
      ball(k, head, FACE_L, 1, [0, -hr * 0.32, hr * 0.7], [hr * 0.52, hr * 0.38, hr * 0.5]);
      for (const sx of [-1, 1]) ball(k, head, DARK, hr * 0.05, [sx * hr * 0.16, -hr * 0.3, hr * 1.15], [1, 0.7, 0.6], [0, 0, 0], { outline: false }, 8);
      mouth(k, head, DARK, hr * 0.1, [0, -hr * 0.52, hr * 1.05], [0.25, 0, 0], 0.18);
      faceEyes(k, head, hs, { x: hr * 0.42, y: hr * 0.16, r: o.stern ? hr * 0.25 : hr * 0.31, iris: IRIS, glow: o.stern, sharp: o.stern, yaw: 0.3 });
      if (o.stern) brows(k, head, DARK, hr * 0.42, hr * 0.48, hr * 0.86, hr * 0.32, 0.4, hr * 0.07);
      else k.blush(head, hr * 0.7, -hr * 0.16, hr * 0.7, hr * 0.14, PINK);
      for (const sx of [-1, 1]) {
        const g = k.group(head, [sx * hr * 0.9, hr * 0.2, -hr * 0.15], [0, 0, -sx * (o.stern ? 1.35 : 1.15)]);
        k.blade(g, FACE, hr * 0.75, hr * 0.42, 0.05, [0, 0, 0]);
        k.blade(g, PINK, hr * 0.5, hr * 0.22, 0.05, [0, hr * 0.1, 0.012], [0, 0, 0], { outline: false });
        c.ears.push({ g, phase: sx * 1.7 });
      }
      wool(head, [0, hr * 0.78, -hr * 0.05], [hr * 0.5, hr * 0.3, hr * 0.5], o.tuft ?? 3, 21, WOOL, hr * 0.28, [0, 0.5]);
    };
    /** Spiral ram horn: curling from the side of the head backward, down and then forward, thinning and moving outward as it curls */
    const ramHorn = (head: THREE.Object3D, sx: number, hr: number, R0: number, tubeR: number, sweep: number, col: C, o: PartOpts = {}) => {
      const pts: V3[] = [];
      const N = 14;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = PI * 0.5 + t * sweep;
        const Rr = R0 * (1 - t * 0.42);
        pts.push([sx * t * R0 * 0.9, Rr * Math.sin(a), Rr * Math.cos(a) * 0.9]);
      }
      const g = k.group(head, [sx * hr * 0.6, -hr * 0.05, -hr * 0.22]);
      k.mesh(g, taperTube(pts, (t) => tubeR * (1 - t * 0.72), 40, 12).geo, col, [0, 0, 0], [0, 0, 0], o);
      return g;
    };
    /** Static lightning: glowing lightning sheets, registered as flickering parts */
    const bolt = (parent: THREE.Object3D, len: number, pos: V3, rot: V3, col: C = VOLT) => {
      const m = k.glow(parent, boltGeo(len, len * 0.45, len * 0.12), col, 2.6, pos, rot, 0.95);
      c.flickers.push({ g: m, base: m.scale.clone(), speed: 7 + rnd(pos[0] * 9) * 5, amt: 0.3 });
      return m;
    };
    /** Static spark: a small elongated octahedron, bobbing up and down */
    const sparks = (parent: THREE.Object3D, n: number, ctr: V3, rad: V3, seed: number, size = 0.03) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + rnd(seed + i) * 0.5;
        const g = new THREE.OctahedronGeometry(size);
        g.scale(0.5, 1.8, 0.5);
        const m = k.glow(parent, g, SPARK, 2.8, [ctr[0] + Math.sin(a) * rad[0], ctr[1] + (rnd(seed + i * 5) - 0.3) * rad[1], ctr[2] + Math.cos(a) * rad[2]], [0, 0, rnd(i) * 2]);
        c.bobbers.push({ g: m, base: m.position.y, amp: 0.04, speed: 5 + rnd(seed + i * 2) * 3, phase: i * 1.3 });
      }
    };
    const hoofFoot = (foot: THREE.Object3D, r: number, col: C) => {
      ball(k, foot, col, r, [0, -r * 0.1, r * 0.2], [1.05, 0.7, 1.15]);
    };
    if (s === 1) {
      // I: fluffball lamb
      c.archetype = 'quad';
      const by = 0.3;
      wool(c.body, [0, by, 0], [0.24, 0.21, 0.25], 12, 1, WOOL, 0.1);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const g = k.group(c.body, [sx * 0.12, 0.15, sz * 0.12]);
          k.capsule(g, FACE, 0.035, 0.09, [0, -0.06, 0]);
          hoofFoot(g, 0.042, HOOF);
          g.children[g.children.length - 1].position.y = -0.12;
          c.legs.push({ g, phase: sx * sz > 0 ? 0 : PI, amp: 0.6 });
        }
      }
      const head = k.group(c.body, [0, by + 0.12, 0.27]);
      c.head = head;
      sheepFace(head, 0.17, {});
      const tail = k.group(c.body, [0, by + 0.02, -0.24]);
      ball(k, tail, WOOL_S, 0.06, [0, 0, -0.04]);
      c.tails.push({ g: tail, phase: 0, amp: 0.35, axis: 'y' });
      sparks(c.body, 3, [0, by + 0.12, 0], [0.26, 0.16, 0.28], 3, 0.026);
      return;
    }
    if (s === 2) {
      // II: long-legged adolescent ram
      c.archetype = 'quad';
      const leg = 0.34;
      const by = leg + 0.14;
      wool(c.body, [0, by, -0.02], [0.22, 0.19, 0.31], 14, 2, WOOL, 0.095);
      wool(c.body, [0, by + 0.1, 0.27], [0.15, 0.13, 0.13], 6, 3, WOOL, 0.075);
      for (const sx of [-1, 1]) {
        quadLeg(k, c, c.body, sx, 0.13, 0.18, { col: FACE, r: 0.04, len: leg, front: true, foot: HOOF, footR: 0.05, footScale: [1.05, 0.7, 1.15] });
        quadLeg(k, c, c.body, sx, 0.13, -0.2, { col: FACE, r: 0.042, len: leg, front: false, foot: HOOF, footR: 0.052, footScale: [1.05, 0.7, 1.15] });
      }
      const head = k.group(c.body, [0, by + 0.24, 0.42]);
      c.head = head;
      const hr = 0.16;
      sheepFace(head, hr, {});
      for (const sx of [-1, 1]) ramHorn(head, sx, hr, hr * 0.68, 0.036, PI * 1.4, HORN);
      const tail = k.group(c.body, [0, by + 0.02, -0.3]);
      ball(k, tail, WOOL_S, 0.065, [0, 0, -0.05]);
      bolt(tail, 0.09, [0, 0.03, -0.09], [-0.6, 0, 0]);
      c.tails.push({ g: tail, phase: 0, amp: 0.35, axis: 'y' });
      bolt(c.body, 0.13, [0.2, by + 0.14, 0.05], [0, 0, -0.9]);
      bolt(c.body, 0.11, [-0.16, by + 0.16, -0.18], [0.3, 0, 0.8]);
      sparks(c.body, 4, [0, by + 0.14, -0.02], [0.25, 0.16, 0.34], 4, 0.028);
      return;
    }
    // III: `stormram`
    c.archetype = 'quad';
    const leg = 0.42;
    const by = leg + 0.2;
    wool(c.body, [0, by, -0.02], [0.3, 0.26, 0.42], 16, 4, WOOL, 0.12, [-0.05, 0.5]);
    wool(c.body, [0, by - 0.06, -0.04], [0.31, 0.24, 0.42], 10, 5, CLOUD, 0.11, [-0.45, -0.08], false);
    wool(c.body, [0, by + 0.14, 0.36], [0.2, 0.17, 0.16], 8, 6, WOOL, 0.085);
    for (const sx of [-1, 1]) {
      quadLeg(k, c, c.body, sx, 0.17, 0.26, { col: FACE, r: 0.06, len: leg, front: true, foot: GOLD, footR: 0.07, footScale: [1.05, 0.7, 1.15] });
      quadLeg(k, c, c.body, sx, 0.17, -0.28, { col: FACE, r: 0.064, len: leg, front: false, foot: GOLD, footR: 0.072, footScale: [1.05, 0.7, 1.15] });
    }
    const head = k.group(c.body, [0, by + 0.3, 0.55], [0.18, 0, 0]);
    c.head = head;
    const hr = 0.19;
    sheepFace(head, hr, { stern: true, tuft: 4 });
    wool(head, [0, -hr * 0.6, hr * 0.5], [hr * 0.35, hr * 0.3, hr * 0.3], 3, 22, WOOL, hr * 0.2, [-0.5, 0]);
    for (const sx of [-1, 1]) {
      ramHorn(head, sx, hr, hr * 1.2, 0.068, PI * 1.9, GOLD, { emissive: VOLT, emissiveAmt: 0.18 });
    }
    // Arcs between the horns and thunder light above the head
    bolt(head, 0.28, [0, hr * 1.05, -hr * 0.45], [0, 0, PI / 2 - 0.15]);
    bolt(head, 0.2, [0, hr * 0.95, -hr * 0.75], [0.4, 0, -PI / 2 + 0.3]);
    bolt(head, 0.16, [0, hr * 1.3, -hr * 0.2], [0, 0, 0.3]);
    const tail = k.group(c.body, [0, by + 0.04, -0.42]);
    ball(k, tail, WOOL_S, 0.08, [0, 0, -0.05]);
    bolt(tail, 0.12, [0, 0.04, -0.11], [-0.7, 0, 0]);
    c.tails.push({ g: tail, phase: 0, amp: 0.3, axis: 'y' });
    bolt(c.body, 0.2, [0.3, by + 0.18, 0.1], [0, 0, -1.0]);
    bolt(c.body, 0.18, [-0.26, by + 0.22, -0.2], [0.4, 0, 0.9]);
    bolt(c.body, 0.16, [0.1, by + 0.32, -0.3], [-0.3, 0, 0.2]);
    spinRing(k, c, c.body, VOLT, 0.56, 0.01, [0, by + 0.02, -0.02], [PI / 2, 0, 0], 1.1, 'y', { beads: 4, beadCol: SPARK, beadR: 0.024, opacity: 0.8, arc: PI * 1.6 });
    sparks(c.body, 6, [0, by + 0.2, -0.02], [0.34, 0.2, 0.46], 7, 0.032);
  },

  // `eclipse_batlord` (dark)
  // I: a furry round ball, the head is the body, big ears, tiny wings flapping very fast, two little feet dangling
  // II: the head separate from the body, the wings spread wide, the ears lengthened, the gaze sharpened, a crescent moon on the brow
  // III: a bat king wearing a gold crown and a dark-red cloak, enormous wing membranes, fangs, behind it a lunar eclipse turning slowly
  eclipse_batlord(k, c, s) {
    const FUR = 0x3b2b5e;
    const FUR_L = 0x5a4488;
    const MEM = 0x6c4ca8;
    const INNER = 0xb07ae0;
    const MOON = 0xffcf40;
    const CRIMSON = 0x8a1a3a;
    const EYE = 0xd8b0ff;
    const EYE_R = 0xff3a5a;
    const DARK = 0x1a1030;
    const CORONA = 0xb06aff;
    const CLAW = 0x2a1a3a;
    /** Bat face: glowing big eyes, a small nose, fangs, big ears (king = red eyes, thick brows, gold rings at the ear bases) */
    const batFace = (head: THREE.Object3D, hr: number, o: { cute?: boolean; king?: boolean }) => {
      const cute = !!o.cute;
      faceEyes(k, head, hr, { x: hr * 0.4, y: hr * 0.1, r: cute ? hr * 0.3 : hr * 0.26, iris: o.king ? EYE_R : EYE, glow: true, sharp: !cute, yaw: 0.3 });
      ball(k, head, DARK, hr * 0.07, [0, -hr * 0.12, hr * 0.98], [1.3, 0.8, 0.6], [0, 0, 0], { outline: false }, 8);
      mouth(k, head, DARK, hr * 0.11, [0, -hr * 0.34, hr * 0.94], [0.2, 0, 0], 0.16, PI * 0.8, !!o.king);
      const fl = o.king ? hr * 0.26 : hr * 0.15;
      for (const sx of [-1, 1]) k.cone(head, 0xffffff, hr * 0.045, fl, [sx * hr * 0.18, -hr * 0.36, hr * 0.9], [PI, 0, 0], 6, { outline: false });
      if (cute) k.blush(head, hr * 0.68, -hr * 0.2, hr * 0.7, hr * 0.14, 0xd07aa0);
      if (o.king) brows(k, head, DARK, hr * 0.4, hr * 0.42, hr * 0.86, hr * 0.32, 0.45, hr * 0.07);
      for (const sx of [-1, 1]) {
        const eh = hr * (cute ? 0.95 : 1.15);
        const g = k.group(head, [sx * hr * 0.5, hr * 0.72, -hr * 0.12], [-0.2, 0, -sx * 0.4]);
        k.cone(g, FUR, hr * 0.3, eh, [0, 0, 0], [0, 0, 0], 10);
        k.cone(g, INNER, hr * 0.17, eh * 0.72, [0, hr * 0.03, hr * 0.13], [0, 0, 0], 10, { outline: false });
        if (o.king) k.torus(g, MOON, hr * 0.22, hr * 0.035, [0, hr * 0.28, 0], [PI / 2, 0, 0]);
        c.ears.push({ g, phase: sx * 1.9 });
      }
    };
    /** A pair of wings: the outer group sweeps the wings back, and the wing group is registered for flapping */
    const wings = (parent: THREE.Object3D, y: number, x: number, len: number, wid: number, fingers: number, o: { base: number; amp: number; speed: number; claw?: C; memOpts?: PartOpts }) => {
      for (const sx of [-1, 1]) {
        const holder = k.group(parent, [sx * x, y, -0.04], [0.1, sx * 0.25, 0]);
        const w = membraneWing(k, holder, sx, { len, wid, bone: FUR, mem: MEM, claw: o.claw, fingers, boneR: len * 0.045, memOpts: o.memOpts });
        c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: o.base, amp: o.amp, speed: o.speed });
      }
    };
    /** Dangling small foot: a capsule + claws */
    const feet = (parent: THREE.Object3D, y: number, x: number, len: number, claw: C) => {
      for (const sx of [-1, 1]) {
        const g = k.group(parent, [sx * x, y, 0.03], [0.2, 0, sx * 0.15]);
        k.capsule(g, FUR, len * 0.3, len, [0, -len * 0.5, 0]);
        for (const u of [-1, 0, 1]) k.cone(g, claw, len * 0.1, len * 0.4, [u * len * 0.28, -len * 0.95, len * 0.1], [PI - 0.4, 0, 0], 6, { outline: false });
        c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.3 });
      }
    };
    const motes = (parent: THREE.Object3D, n: number, y: number, R: number) => {
      for (let i = 0; i < n; i++) sparkle(k, c, parent, i % 2 ? CORONA : MOON, 0.012 + (i % 3) * 0.003, [Math.cos(i * 2.3) * R, y + (i % 3) * 0.14, Math.sin(i * 2.3) * R * 0.8], 0.06);
    };
    if (s === 1) {
      // I: fluffball bat
      floater(c, 0.3);
      const head = k.group(c.body, [0, 0.3, 0]);
      c.head = head;
      const hr = 0.26;
      k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.96, 0.96]);
      ball(k, head, FUR_L, 1, [0, -hr * 0.42, hr * 0.5], [hr * 0.55, hr * 0.42, hr * 0.5], [0, 0, 0], { outline: false });
      for (let i = 0; i < 3; i++) k.horn(head, FUR, hr * 0.06, hr * 0.26, hr * 0.1, [(i - 1) * hr * 0.16, hr * 0.9, hr * 0.05], [-0.4 + (i - 1) * 0.2, 0, (i - 1) * 0.5]);
      batFace(head, hr, { cute: true });
      wings(head, -hr * 0.05, hr * 0.8, 0.26, 0.2, 2, { base: 1.0, amp: 0.5, speed: 12 });
      feet(head, -hr * 0.85, hr * 0.32, 0.07, CLAW);
      motes(c.body, 3, 0.15, 0.36);
      return;
    }
    // Shared by II / III: the forward-leaning body group
    const B = k.group(c.body, [0, 0, 0], [s === 2 ? 0.14 : 0.06, 0, 0]);
    if (s === 2) {
      floater(c, 0.45);
      k.sphere(B, FUR, 1, [0, 0.3, 0], [0.17, 0.22, 0.15]);
      ball(k, B, FUR_L, 1, [0, 0.3, 0.06], [0.12, 0.15, 0.11], [0, 0, 0], { outline: false });
      const head = k.group(B, [0, 0.58, 0.03]);
      c.head = head;
      const hr = 0.2;
      k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.96, 0.96]);
      batFace(head, hr, {});
      k.glow(head, new THREE.TorusGeometry(hr * 0.16, hr * 0.035, 6, 20, PI * 1.25), MOON, 2.2, [0, hr * 0.42, hr * 0.9], [0.3, 0, PI * 0.88], 0.95);
      wings(B, 0.42, 0.15, 0.52, 0.42, 3, { base: 1.1, amp: 0.4, speed: 6.5, claw: CLAW });
      feet(B, 0.1, 0.08, 0.1, CLAW);
      tailTube(k, c, B, FUR, [[0, 0.14, -0.1], [0, 0.04, -0.2], [0, 0.0, -0.3]], 0.03, 0.012, { amp: 0.3, axis: 'x' });
      motes(c.body, 3, 0.2, 0.42);
      return;
    }
    // III: `eclipse_batlord`
    floater(c, 0.5);
    k.sphere(B, FUR, 1, [0, 0.36, 0], [0.2, 0.28, 0.18]);
    ball(k, B, FUR_L, 1, [0, 0.36, 0.08], [0.15, 0.2, 0.13], [0, 0, 0], { outline: false });
    for (let i = 0; i < 3; i++) k.blade(B, FUR_L, 0.09, 0.05, 0.04, [(i - 1) * 0.06, 0.5, 0.15], [0.5 + (i - 1) * 0.1, 0, (i - 1) * 0.4]);
    // Dark-red cloak: a partial surface of revolution covering only the back, a gold ring and a ruby at the collar
    {
      const pts = [[0.33, 0.0], [0.31, 0.2], [0.27, 0.42], [0.23, 0.58], [0.2, 0.64]].map(([x, y]) => new THREE.Vector2(x, y));
      const geo = new THREE.LatheGeometry(pts, 20, PI * 0.28, PI * 1.44);
      k.mesh(B, geo, CRIMSON, [0, 0, -0.02]);
      // Cloak lining: the same surface of revolution flipped, in an unlit dark color, so it does not look hollow when seen into from the side
      const inner = new THREE.LatheGeometry(pts.map((v) => new THREE.Vector2(v.x * 0.985, v.y + 0.004)), 20, PI * 0.28, PI * 1.44);
      const im = k.glow(B, inner, 0x3a0c24, 0.9, [0, 0, -0.02]);
      (im.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
    }
    k.torus(B, MOON, 0.16, 0.025, [0, 0.62, 0.0], [PI / 2 + 0.2, 0, 0]);
    hard(k, B, new THREE.OctahedronGeometry(0.04, 0), EYE_R, [0, 0.57, 0.17], [0, 0, 0], { emissive: EYE_R, emissiveAmt: 0.8 });
    const head = k.group(B, [0, 0.74, 0.04]);
    c.head = head;
    const hr = 0.2;
    k.sphere(head, FUR, hr, [0, 0, 0], [1, 0.96, 0.96]);
    batFace(head, hr, { king: true });
    // Gold crown: a ring + five spikes, the front spike set with a ruby
    const crown = k.group(head, [0, hr * 0.72, -hr * 0.05]);
    k.torus(crown, MOON, hr * 0.7, hr * 0.07, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      const front = i === 0;
      k.cone(crown, MOON, hr * 0.09, hr * (front ? 0.5 : 0.32), [Math.sin(a) * hr * 0.66, 0.0, Math.cos(a) * hr * 0.66], [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25], 6);
      if (front) hard(k, crown, new THREE.OctahedronGeometry(hr * 0.1, 0), EYE_R, [0, hr * 0.2, hr * 0.7], [0, 0, 0], { emissive: EYE_R, emissiveAmt: 0.8 });
    }
    wings(B, 0.56, 0.19, 0.74, 0.58, 4, { base: 1.15, amp: 0.3, speed: 5, claw: MOON, memOpts: { emissive: CORONA, emissiveAmt: 0.1 } });
    feet(B, 0.1, 0.09, 0.12, MOON);
    const t = tailTube(k, c, B, FUR, [[0, 0.14, -0.12], [0, 0.02, -0.26], [0, 0.0, -0.4]], 0.032, 0.012, { amp: 0.3, axis: 'x' });
    hard(k, aim(k.group(t.end), t.dir), poly([[-0.03, 0], [0, 0.03], [0.03, 0], [0, 0.07]], 0.012), DARK, [0, 0.0, 0], [0, PI / 2, 0]);
    // Lunar eclipse behind it: a black disc + a glowing corona ring, turning slowly
    {
      // The eclipse hangs up and behind the head and is translucent: seen from behind by the battle camera, the bat king's silhouette is still visible
      const ecl = k.group(B, [0, 0.82, -0.38]);
      const disc = k.glow(ecl, new THREE.CircleGeometry(0.33, 40), 0x0e0818, 0.35, [0, 0, 0], [0, 0, 0], 0.62);
      (disc.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
      const ring = k.glow(ecl, new THREE.TorusGeometry(0.345, 0.022, 8, 56), CORONA, 2.6, [0, 0, 0.002], [0, 0, 0], 0.95);
      (ring.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
      k.glow(ecl, new THREE.TorusGeometry(0.39, 0.05, 8, 56), CORONA, 1.2, [0, 0, -0.004], [0, 0, 0], 0.28);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + 0.6;
        k.glowSphere(ecl, MOON, 0.022, [Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.01], 2.6);
      }
      c.spinners.push({ g: ecl, speed: 0.35, axis: 'z' });
    }
    motes(c.body, 5, 0.25, 0.5);
  },
};
