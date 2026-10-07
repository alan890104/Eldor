// Second-batch spirit models (see docs/09-bestiary.md): Whispering Forest (nature) and Tidesong Isles (water).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit, PartOpts } from '../creature.ts';
import { biped, ears, floater, halo, PI, sparkle, wing, type Builder, type C, type V3 } from '../parts.ts';
import { outlineMaterial } from '../toon.ts';

// ───────────────────────── Shared helpers ─────────────────────────

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const smoothOutlines = new WeakMap<Creature, THREE.ShaderMaterial>();

/** Sheet / extruded parts: the outline uses a copy with vertex-merged smooth normals, so the hard edges do not tear the outline into fragments */
function slab(k: Kit, parent: THREE.Object3D, geo: THREE.BufferGeometry, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  // The post-process outline version does not need an outline copy with smooth normals and draws the lines directly as an ordinary part
  if (k.ink) return k.mesh(parent, geo, col, pos, rot, o);
  const m = k.mesh(parent, geo, col, pos, rot, { ...o, outline: false });
  let om = smoothOutlines.get(k.c);
  if (!om) {
    om = outlineMaterial(k.outline);
    k.c.outlines.push(om);
    smoothOutlines.set(k.c, om);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) sg.setIndex(geo.index.clone());
  const merged = mergeVertices(sg, 1e-4);
  merged.computeVertexNormals();
  m.add(new THREE.Mesh(merged, om));
  return m;
}

/**
 * Petal / leaf geometry: a pointed elliptical sheet extending from 0 to len along +y (wid is about the full width),
 * curl bends the tip toward +z, bulge puffs the middle toward +z, cup rolls the two sides toward -z into a cup shape.
 */
function petalGeo(len: number, wid: number, o: { curl?: number; bulge?: number; cup?: number; thick?: number; tip?: number } = {}): THREE.BufferGeometry {
  const thick = o.thick ?? 0.02;
  const tip = o.tip ?? 0.78;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.8, len * 0.12, wid * 0.72, len * tip, 0, len);
  s.bezierCurveTo(-wid * 0.72, len * tip, -wid * 0.8, len * 0.12, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -thick / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const curl = o.curl ?? 0;
  const bulge = o.bulge ?? 0;
  const cup = o.cup ?? 0;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / len;
    const u = p.getX(i) / (wid * 0.55);
    p.setZ(i, p.getZ(i) + curl * t * t + bulge * Math.sin(PI * t) - cup * u * u * Math.sin(PI * t));
  }
  g.computeVertexNormals();
  return g;
}

/** One petal: yaw is the azimuth about y (0 = straight ahead, +z), tilt is the outward lean angle (near π = drooping down) */
function petal(k: Kit, parent: THREE.Object3D, col: C, len: number, wid: number, pos: V3, yaw: number, tilt: number, o: Parameters<typeof petalGeo>[2] = {}): THREE.Mesh {
  const m = slab(k, parent, petalGeo(len, wid, o), col, pos);
  m.rotation.set(tilt, yaw, 0, 'YXZ');
  return m;
}

/** Lotus leaf: a disc with a notch lying flat in the xz plane (notch toward +z), with radial veins on the leaf */
function lilyPad(k: Kit, parent: THREE.Object3D, R: number, pos: V3, col: C, vein: C, spin = 0, thick = 0.035): THREE.Group {
  const g = k.group(parent, pos, [0, spin, 0]);
  const s = new THREE.Shape();
  s.absarc(0, 0, R, -PI / 2 + 0.3, PI * 1.5 - 0.3, false);
  s.lineTo(0, -R * 0.3);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 36 });
  slab(k, g, geo, col, [0, 0, 0], [-PI / 2, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const a = 0.55 + (i / 6) * (PI * 2 - 1.1);
    k.mesh(g, new THREE.BoxGeometry(0.008, 0.004, R * 0.8), vein, [Math.sin(a) * R * 0.45, thick + 0.002, Math.cos(a) * R * 0.45], [0, a, 0], { outline: false });
  }
  return g;
}

/** Water-drop shape (base at y=0, tip pointing up, widest radius r) */
function dropGeo(r: number): THREE.BufferGeometry {
  const prof: [number, number][] = [
    [0, 0],
    [0.5, 0.06],
    [0.86, 0.25],
    [1, 0.62],
    [0.9, 1.0],
    [0.62, 1.36],
    [0.3, 1.66],
    [0.1, 1.86],
    [0, 1.96],
  ];
  return new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * r, y * r)), 20);
}

/** Glowing spring-water drop: a glowing core + translucent shell + highlight, can bob up and down */
function waterDrop(k: Kit, c: Creature, parent: THREE.Object3D, r: number, pos: V3, o: { bob?: number; shell?: number; intensity?: number; col?: C } = {}): THREE.Group {
  const g = k.group(parent, pos);
  const col = o.col ?? 0x8fe8ff;
  k.glow(g, dropGeo(r), col, o.intensity ?? 2.4);
  if (o.shell !== 0) {
    const sh = o.shell ?? 1.3;
    k.glow(g, dropGeo(r * sh), col, 1.1, [0, -r * (sh - 1) * 0.9, 0], [0, 0, 0], 0.28);
  }
  k.glowSphere(g, 0xffffff, r * 0.2, [-r * 0.32, r * 0.95, r * 0.6], 2.6, [1, 1.5, 0.6]);
  if (o.bob) c.bobbers.push({ g, base: pos[1], amp: o.bob, speed: 1.6 + Math.random(), phase: Math.random() * 6 });
  return g;
}

/** Stick big eyes onto an ellipsoid (rad) surface: compute the surface z from x and y, sunk in slightly so the whites bulge out */
function faceEyes(k: Kit, head: THREE.Object3D, rad: V3, o: { x: number; y: number; r: number; iris: C; glow?: boolean; sharp?: boolean; yaw?: number; cz?: number }): void {
  const nx = o.x / rad[0];
  const ny = o.y / rad[1];
  const z = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny)) * rad[2] - o.r * 0.18 + (o.cz ?? 0);
  k.eyes(head, { x: o.x, y: o.y, z, r: o.r, iris: o.iris, glow: o.glow, sharp: o.sharp, yaw: o.yaw });
}

/** Smiling mouth: a short downward arc */
function smile(k: Kit, head: THREE.Object3D, col: C, R: number, pos: V3, rot: V3 = [0, 0, 0], w = 0.3): THREE.Mesh {
  const g = new THREE.TorusGeometry(R, R * w, 6, 20, PI * 0.9);
  g.rotateZ(PI + PI * 0.05);
  return k.mesh(head, g, col, pos, rot, { outline: false });
}

/** Make the object's +y point along dir */
function aim<T extends THREE.Object3D>(o: T, dir: V3): T {
  o.quaternion.setFromUnitVectors(Y_AXIS, new THREE.Vector3(...dir).normalize());
  return o;
}

/** Make the object's +y point along dir, with +z (the sheet's thickness direction) facing thin as far as possible: for placing directional sheets such as fins and leaves */
function aimPlane<T extends THREE.Object3D>(o: T, dir: V3, thin: V3): T {
  const y = new THREE.Vector3(...dir).normalize();
  const z = new THREE.Vector3(...thin);
  z.sub(y.clone().multiplyScalar(y.dot(z))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return o;
}

function mix(a: C, b: C, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

/** A point on an ellipsoid surface (theta measured from +y, phi from +x toward +z) */
function onEll(rx: number, ry: number, rz: number, theta: number, phi: number, center: V3 = [0, 0, 0]): V3 {
  return [center[0] + rx * Math.sin(theta) * Math.cos(phi), center[1] + ry * Math.cos(theta), center[2] + rz * Math.sin(theta) * Math.sin(phi)];
}

/** Swept-back fin: a flattened ellipsoid with the top edge cut slanted toward -z */
function sweptFin(k: Kit, parent: THREE.Object3D, col: C, h: number, w: number, thick: number, sweep: number, pos: V3, rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  const g = new THREE.SphereGeometry(0.5, 20, 14);
  g.scale(thick, h, w);
  g.translate(0, h / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, -sweep, 1, 0, 0, 0, 0, 1));
  return k.mesh(parent, g, col, pos, rot, o);
}

/** Two-tone ellipsoid (a fish body dark on the back and light on the belly), cut is the polar-angle fraction of the dividing line */
function twoTone(k: Kit, parent: THREE.Object3D, top: C, bottom: C, scale: V3, cut: number, pos: V3): void {
  const a = new THREE.SphereGeometry(1, 24, 12, 0, PI * 2, 0, PI * cut);
  a.scale(...scale);
  const b = new THREE.SphereGeometry(1, 24, 8, 0, PI * 2, PI * cut, PI * (1 - cut));
  b.scale(...scale);
  k.mesh(parent, a, top, pos);
  k.mesh(parent, b, bottom, pos);
}

/** Tube geometry along a curve with variable radius */
function tubeGeo(curve: THREE.Curve<THREE.Vector3>, rad: (t: number) => number, seg = 20, radial = 10): THREE.TubeGeometry {
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const ctr = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, ctr);
    const r = Math.max(0.004, rad(i / seg));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(p, idx).sub(ctr).multiplyScalar(r).add(ctr);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  return g;
}

function curveOf(pts: V3[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
}

/** Long tube with a color gradient (sea-snake body): colored in segments, each segment joined along the same curve */
function gradientTube(k: Kit, parent: THREE.Object3D, cols: C[], pts: V3[], rad: (t: number) => number): THREE.CatmullRomCurve3 {
  const main = curveOf(pts);
  const n = cols.length;
  for (let s = 0; s < n; s++) {
    const t0 = s / n;
    const t1 = (s + 1) / n;
    const sub: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) sub.push(main.getPointAt(t0 + ((t1 - t0) * i) / 6));
    const geo = tubeGeo(new THREE.CatmullRomCurve3(sub), (t) => rad(t0 + (t1 - t0) * t), 12, 14);
    k.mesh(parent, geo, cols[s]);
  }
  return main;
}

/** Elliptical ring (vine wrapped around the body), lying in the group's xy plane */
function ellRing(k: Kit, parent: THREE.Object3D, col: C, rx: number, ry: number, tube: number, pos: V3, tilt: number, spin: number): THREE.Group {
  const g = k.group(parent, pos);
  g.rotation.set(PI / 2 + tilt, spin, 0, 'YXZ');
  const t = tube / Math.min(rx, ry);
  const geo = new THREE.TorusGeometry(1, t, 6, 40);
  geo.scale(rx, ry, tube / t);
  k.mesh(g, geo, col);
  return g;
}

/** Bubble: a translucent sphere + highlight, bobbing up and down */
function bubble(k: Kit, c: Creature, parent: THREE.Object3D, r: number, pos: V3): THREE.Group {
  const g = k.group(parent, pos);
  k.glowSphere(g, 0x9fe4ff, r, [0, 0, 0], 1.05, [1, 1, 1], 0.42);
  k.glowSphere(g, 0xffffff, r * 0.24, [-r * 0.38, r * 0.4, r * 0.62], 2.2);
  c.bobbers.push({ g, base: pos[1], amp: r * 0.7, speed: 1.4 + Math.random(), phase: Math.random() * 6 });
  return g;
}

/** Glowing musical note */
function note(k: Kit, c: Creature, parent: THREE.Object3D, col: C, sz: number, pos: V3, tilt = 0.25): THREE.Group {
  const g = k.group(parent, pos, [0, 0, tilt]);
  k.glowSphere(g, col, sz, [0, 0, 0], 2.4, [1.25, 0.95, 0.6]);
  k.glow(g, new THREE.CylinderGeometry(sz * 0.18, sz * 0.18, sz * 3.2, 6), col, 2.4, [sz * 1.08, sz * 1.6, 0]);
  k.glow(g, new THREE.BoxGeometry(sz * 1.2, sz * 0.5, sz * 0.3), col, 2.4, [sz * 1.55, sz * 3.0, 0], [0, 0, -0.45]);
  c.bobbers.push({ g, base: pos[1], amp: sz * 1.2, speed: 1.6 + Math.random(), phase: Math.random() * 6 });
  return g;
}

/** Acorn */
function acorn(k: Kit, parent: THREE.Object3D, sz: number, pos: V3, rot: V3 = [0, 0, 0]): THREE.Group {
  const g = k.group(parent, pos, rot);
  k.sphere(g, 0xdca25c, sz, [0, -sz * 0.35, 0], [0.85, 1.08, 0.85]);
  k.sphere(g, 0x7a4a24, sz * 0.92, [0, sz * 0.12, 0], [1, 0.62, 1]);
  k.cyl(g, 0x5a3a1a, sz * 0.12, sz * 0.16, sz * 0.45, [0, sz * 0.62, 0], [0, 0, 0.3], 6);
  return g;
}

/** Pine cone: octagonal tiers stacked up */
function pinecone(k: Kit, parent: THREE.Object3D, sz: number, pos: V3, rot: V3 = [0, 0, 0]): THREE.Group {
  const g = k.group(parent, pos, rot);
  const tiers: [number, number][] = [
    [-0.5, 0.34],
    [-0.22, 0.46],
    [0.06, 0.47],
    [0.33, 0.4],
    [0.58, 0.28],
  ];
  tiers.forEach(([y, r], i) => {
    const geo = new THREE.CylinderGeometry(r * sz * 0.52, r * sz, sz * 0.32, 8);
    k.mesh(g, geo, i % 2 ? 0xa8683a : 0x8a522a, [0, y * sz, 0], [0, (i * PI) / 8, 0]);
  });
  k.cone(g, 0x8a522a, sz * 0.16, sz * 0.18, [0, -0.64 * sz, 0], [PI, 0, 0], 8);
  k.cyl(g, 0x5a3a1a, sz * 0.04, sz * 0.05, sz * 0.2, [0, 0.8 * sz, 0], [0, 0, 0], 6);
  return g;
}

/** Branching coral */
function coral(k: Kit, parent: THREE.Object3D, col: C, sc: number, pos: V3, rot: V3 = [0, 0, 0]): THREE.Group {
  const g = k.group(parent, pos, rot);
  const r = 0.03 * sc;
  k.capsule(g, col, r, 0.16 * sc, [0, 0.1 * sc, 0]);
  const br: [number, number, number, number][] = [
    [0.07, 0.75, 0.3, 0.1],
    [0.11, -0.7, -0.5, 0.09],
    [0.16, 0.35, 1.9, 0.08],
  ];
  for (const [h, rz, ry, len] of br) {
    const b = k.group(g, [0, h * sc, 0], [0, ry, rz]);
    k.capsule(b, col, r * 0.8, len * sc, [0, len * sc * 0.5 + r * 0.4, 0]);
  }
  return g;
}

/** Rolled-up leaf flute */
function leafFlute(k: Kit, parent: THREE.Object3D, pos: V3, dir: V3, len: number): THREE.Group {
  const g = aim(k.group(parent, pos), dir);
  const tubeCol = 0xa6dc6c;
  k.cyl(g, tubeCol, 0.026, 0.03, len, [0, len / 2, 0], [0, 0, 0], 10);
  k.cyl(g, tubeCol, 0.052, 0.03, 0.06, [0, len + 0.02, 0], [0, 0, 0], 10);
  for (let i = 0; i < 2; i++) k.sphere(g, 0x2a4a22, 0.012, [0, len * (0.42 + i * 0.22), -0.027], [1, 1, 0.5], [0, 0, 0], { outline: false });
  k.blade(g, 0x6cc84a, 0.15, 0.08, 0.02, [0.02, len * 0.55, 0.01], [0, 0, -0.9]);
  return g;
}

// ───────────────────────── Species ─────────────────────────

export const SPECIES_NATURE_WATER: Record<string, Builder> = {
  // `acornsquirrel`
  acornsquirrel(k, c, s) {
    const col = 0xc8763a;
    const belly = 0xf6e4c4;
    const dark = 0x8e4e24;
    const hi = 0xe8a060;
    const fur2 = 0xd8884a;
    const earIn = 0xf2b89a;
    const nose = 0x3a2016;
    const iris = 0x5a2e14;
    const leafA = 0x5aa83a;
    const leafB = 0x78c44a;
    const leafC = 0x4a8a2e;

    /** Squirrel face: cream muzzle, nose tip, front teeth, big eyes, blush, ears (cheek = puffed cheek pouches, tuft = fur at the ear tips) */
    const face = (h: THREE.Object3D, hr: number, o: { cheek?: number; tuft?: number; eye?: number; earH?: number }) => {
      k.sphere(h, col, hr, [0, 0, 0], [1, 0.96, 1]);
      k.sphere(h, belly, hr * 0.5, [0, -hr * 0.36, hr * 0.66], [1.2, 0.8, 0.8], [0, 0, 0], { outline: false });
      k.sphere(h, nose, hr * 0.12, [0, -hr * 0.18, hr * 1.02], [1.3, 0.85, 1]);
      for (const sx of [-1, 1]) k.mesh(h, new THREE.BoxGeometry(hr * 0.1, hr * 0.15, hr * 0.06), 0xffffff, [sx * hr * 0.06, -hr * 0.66, hr * 0.9], [-0.35, 0, 0], { outline: false });
      faceEyes(k, h, [hr, hr * 0.96, hr], { x: hr * 0.4, y: hr * 0.12, r: hr * (o.eye ?? 0.3), iris });
      k.blush(h, hr * 0.7, -hr * 0.22, hr * 0.66, hr * 0.17);
      if (o.cheek) for (const sx of [-1, 1]) k.sphere(h, 0xf2cf9a, hr * o.cheek, [sx * hr * 0.66, -hr * 0.4, hr * 0.46], [1, 0.85, 0.9]);
      ears(k, c, h, col, earIn, hr * 0.24, hr * (o.earH ?? 0.6), hr * 0.52, hr * 0.7, 0.22);
      if (o.tuft) for (const e of c.ears.slice(-2)) k.horn(e.g, dark, hr * 0.11, hr * o.tuft, hr * 0.15, [0, hr * (o.earH ?? 0.6) * 0.8, 0]);
    };
    /** Bushy tail: a tube thickening along a curve (yz plane) + a ring of fur balls along the outer edge; center is the curl center (the fur balls grow on the side away from it) */
    const furTail = (parent: THREE.Object3D, pts: V3[], radii: number[], center: V3, balls: number[], o: { amp?: number; axis?: 'x' | 'y' | 'z'; tip?: C; col?: C } = {}) => {
      const tg = k.group(parent);
      c.tails.push({ g: tg, phase: 0, amp: o.amp ?? 0.08, axis: o.axis ?? 'z' });
      const curve = curveOf(pts);
      const rad = (t: number) => {
        const f = t * (radii.length - 1);
        const i = Math.min(radii.length - 2, Math.floor(f));
        return radii[i] + (radii[i + 1] - radii[i]) * (f - i);
      };
      k.mesh(tg, tubeGeo(curve, rad, 28, 14), o.col ?? col);
      k.sphere(tg, o.tip ?? hi, rad(1), pts[pts.length - 1]);
      const ctr = new THREE.Vector3(...center);
      const at = (t: number) => {
        const p = curve.getPointAt(t);
        const n = p.clone().sub(ctr).setX(0).normalize();
        return { p, n, r: rad(t) };
      };
      balls.forEach((t, i) => {
        const { p, n, r } = at(t);
        // One big fur ball on the outer edge and a small one on each side, so the silhouette has tufts of fur
        k.sphere(tg, i % 2 ? fur2 : o.col ?? col, r * 0.58, [p.x + (i % 2 ? 0.015 : -0.015), p.y + n.y * r * 0.66, p.z + n.z * r * 0.66]);
        for (const sx of [-1, 1]) k.sphere(tg, i % 2 ? o.col ?? col : fur2, r * 0.42, [p.x + sx * r * 0.78, p.y + n.y * r * 0.28, p.z + n.z * r * 0.28]);
      });
      return { tg, at, rad };
    };
    /** Both hands hugging in front of the chest (hugging a pine cone) */
    const hug = (lift: number, inward: number, fwd: number) => {
      for (const a of c.arms) {
        a.base.set(-lift, 0, -a.side * inward);
        a.g.rotation.copy(a.base);
        a.g.position.z += fwd;
      }
    };

    if (s === 1) {
      // I: a pup sitting on the ground, a small pear-shaped body, a head bigger than the body, folded hind legs, the tail curled behind the back and higher than the head
      c.archetype = 'biped';
      const bodyY = 0.3;
      k.sphere(c.body, col, 1, [0, bodyY, 0], [0.24, 0.27, 0.22]);
      k.sphere(c.body, belly, 1, [0, bodyY - 0.03, 0.1], [0.17, 0.2, 0.14], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        const lg = k.group(c.body, [sx * 0.2, 0.12, 0.02]);
        k.sphere(lg, col, 0.12, [0, 0, 0], [1, 0.85, 1.15]);
        k.capsule(lg, col, 0.05, 0.08, [sx * 0.01, -0.07, 0.13], [PI / 2, 0, 0]);
        for (let i = -1; i <= 1; i++) k.sphere(lg, dark, 0.02, [sx * 0.01 + i * 0.03, -0.09, 0.22], [1, 0.7, 1], [0, 0, 0], { outline: false });
        c.legs.push({ g: lg, phase: sx > 0 ? 0 : PI, amp: 0.3 });
      }
      const hr = 0.3;
      const head = k.group(c.body, [0, bodyY + 0.46, 0.04]);
      c.head = head;
      face(head, hr, { eye: 0.33, earH: 0.5 });
      for (const sx of [-1, 1]) {
        const base = new THREE.Euler(-1.15, 0, -sx * 0.55);
        const g = k.group(c.body, [sx * 0.17, bodyY + 0.12, 0.08], [base.x, base.y, base.z]);
        k.capsule(g, col, 0.042, 0.1, [0, -0.07, 0]);
        k.sphere(g, hi, 0.055, [0, -0.15, 0]);
        c.arms.push({ g, side: sx, base });
      }
      pinecone(k, c.body, 0.15, [0, bodyY + 0.02, 0.24], [0.2, 0, 0.12]);
      furTail(k.group(c.body, [0, 0.16, -0.16]), [
        [0, 0, 0],
        [0, 0.14, -0.1],
        [0, 0.38, -0.18],
        [0, 0.66, -0.16],
        [0, 0.9, -0.03],
      ], [0.07, 0.1, 0.13, 0.13, 0.11], [0, 0.5, 0.14], [0.3, 0.5, 0.7, 0.88], { amp: 0.1 });
      return;
    }

    if (s === 2) {
      // II: a young squirrel standing up, the body lengthened and the legs longer, puffed cheek pouches, a long S-shaped tail with an acorn stuck in it
      const b = biped(k, c, { col, belly, torsoR: 0.23, torsoH: 0.42, leg: 0.17, legR: 0.068, headR: 0.27, armLen: 0.16, armR: 0.052, hand: hi });
      for (const sx of [-1, 1]) k.sphere(c.body, col, 0.1, [sx * 0.15, b.leg + 0.05, 0.01], [0.9, 0.9, 1.15]);
      for (const l of c.legs) for (let i = -1; i <= 1; i++) k.sphere(l.g, dark, 0.02, [i * 0.03, -b.leg + 0.03, 0.14], [1, 0.7, 1], [0, 0, 0], { outline: false });
      face(b.head, b.headR, { cheek: 0.42, tuft: 0.3, eye: 0.29 });
      hug(1.1, 0.5, 0.07);
      pinecone(k, c.body, 0.15, [0, b.torsoY + 0.05, b.tr * 0.95], [0.25, 0, 0.15]);
      const { tg, at } = furTail(k.group(b.tail, [0, 0.02, -0.02]), [
        [0, 0, 0],
        [0, 0.1, -0.14],
        [0, 0.36, -0.24],
        [0, 0.64, -0.22],
        [0, 0.88, -0.1],
        [0, 1.02, 0.06],
      ], [0.06, 0.09, 0.13, 0.145, 0.13, 0.1], [0, 0.55, 0.18], [0.2, 0.34, 0.48, 0.62, 0.76, 0.9], { amp: 0.09 });
      [0.32, 0.5, 0.68, 0.84].forEach((t, i) => {
        const { p, n, r } = at(t);
        const sx = i % 2 ? -1 : 1;
        acorn(k, tg, 0.065, [p.x + sx * r * 0.74, p.y + n.y * r * 0.3, p.z + n.z * r * 0.3], [n.z * 0.5, 0, -sx * 0.95]);
      });
      return;
    }

    // III: an adult `acornsquirrel`, taller and sturdier with slender limbs, an acorn-cap helmet, a leaf cape, the tail grown into a small tree
    const b = biped(k, c, { col, belly, torsoR: 0.3, torsoH: 0.56, leg: 0.25, legR: 0.085, headR: 0.28, armLen: 0.23, armR: 0.065, hand: hi });
    k.sphere(c.body, col, 1, [0, b.leg + b.th * 0.72, 0.01], [b.tr * 1.08, b.th * 0.3, b.tr * 0.9]);
    for (const sx of [-1, 1]) k.sphere(c.body, col, 0.13, [sx * 0.17, b.leg + 0.06, 0.01], [0.9, 1, 1.2]);
    for (const l of c.legs) for (let i = -1; i <= 1; i++) k.sphere(l.g, dark, 0.024, [i * 0.038, -b.leg + 0.04, 0.17], [1, 0.7, 1], [0, 0, 0], { outline: false });
    const hr = b.headR;
    const h = b.head;
    face(h, hr, { cheek: 0.3, tuft: 0.42, eye: 0.27, earH: 0.7 });
    hug(1.15, 0.45, 0.08);
    pinecone(k, c.body, 0.2, [0, b.torsoY + 0.1, b.tr * 0.98], [0.25, 0, 0.15]);
    // Acorn-cap helmet: brim, scales on the cap, cap stem
    const helm = k.group(h, [0, hr * 0.42, -0.02], [-0.22, 0, 0]);
    const cap = new THREE.SphereGeometry(1, 22, 10, 0, PI * 2, 0, PI * 0.52);
    cap.scale(hr * 1.06, hr * 0.66, hr * 1.06);
    k.mesh(helm, cap, 0x7a4a24);
    k.torus(helm, 0x5e3618, hr * 1.04, 0.03, [0, 0.0, 0], [PI / 2, 0, 0]);
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 6 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + ring * 0.3;
        const rr = hr * (ring ? 0.42 : 0.8);
        const yy = hr * (ring ? 0.56 : 0.32);
        k.sphere(helm, 0x6a3e1e, 0.036, [Math.cos(a) * rr, yy, Math.sin(a) * rr], [1, 0.55, 1], [0, 0, 0], { outline: false });
      }
    }
    k.cyl(helm, 0x5a3a1a, 0.028, 0.04, 0.12, [0, hr * 0.7, 0], [0, 0, 0.3], 6);
    // Leaf cape: a vine collar + a ring of hanging leaves (long at the back, short on the shoulders)
    const collarY = b.leg + b.th * 0.92;
    k.torus(c.body, leafC, b.tr * 0.72, 0.03, [0, collarY, 0], [PI / 2 - 0.15, 0, 0]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * PI * 1.1;
      const yaw = PI + a;
      const long = Math.abs(a) < 0.8;
      petal(k, c.body, i % 2 ? leafA : leafB, long ? 0.78 : 0.5, long ? 0.26 : 0.2, [Math.sin(yaw) * b.tr * 0.8, collarY - 0.02, Math.cos(yaw) * b.tr * 0.72], yaw, PI - 0.3 - (long ? 0 : 0.35), { curl: 0.1, bulge: 0.03, thick: 0.025 });
    }
    // Short leaves on the shoulders (like pauldrons)
    for (const sx of [-1, 1]) petal(k, c.body, leafB, 0.34, 0.2, [sx * b.tr * 0.95, collarY + 0.03, 0.02], sx * PI * 0.5, PI - 1.0, { curl: 0.06, thick: 0.025 });
    for (const sx of [-1, 1]) k.sphere(c.body, 0xffc85a, 0.035, [sx * b.tr * 0.72, collarY + 0.01, b.tr * 0.2], [1, 1, 1], [0, 0, 0], { emissive: 0xffc85a, emissiveAmt: 0.5 });
    // The tail grown into a small tree: the lower half is bushy tail fur, tapering up into a trunk, with a canopy spread at the top and glowing fruit hanging
    const { tg, at, rad } = furTail(k.group(b.tail, [0, 0.04, -0.04]), [
      [0, 0, 0],
      [0, 0.18, -0.12],
      [0, 0.5, -0.2],
      [0, 0.82, -0.18],
      [0, 1.08, -0.1],
    ], [0.09, 0.14, 0.13, 0.1, 0.09], [0, 0.5, 0.3], [0.18, 0.32, 0.46], { amp: 0.06, tip: 0x8a5a30, col: col });
    // The upper half is wrapped in a layer of bark color, so the tail gradually changes from furry to trunk
    const barkPts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const p = at(0.42 + (i / 6) * 0.58).p;
      barkPts.push([p.x, p.y, p.z]);
    }
    k.mesh(tg, tubeGeo(curveOf(barkPts), (t) => rad(0.42 + t * 0.58) * 1.03, 16, 12), 0x8a5a30);
    const top = at(0.97);
    const crown = k.group(tg, [0, top.p.y + 0.02, top.p.z]);
    const canopy: [number, number, number, number, C][] = [
      [0, 0.1, 0, 0.24, leafA],
      [0.17, 0.02, 0.04, 0.16, leafB],
      [-0.18, 0.04, -0.03, 0.16, leafC],
      [0.03, 0.3, -0.04, 0.16, leafB],
      [0.0, -0.02, 0.15, 0.13, leafA],
      [-0.02, 0.0, -0.17, 0.13, leafB],
    ];
    for (const [x, y, z, r, cc] of canopy) k.sphere(crown, cc, r, [x, y, z]);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05;
      const pos: V3 = [Math.cos(a) * 0.23, 0.02 + (i % 3) * 0.12, Math.sin(a) * 0.2];
      k.glowSphere(crown, i % 2 ? 0xffc85a : 0xff9a5a, 0.04, pos, 2.2);
      k.cyl(crown, 0x5a3a1a, 0.006, 0.006, 0.05, [pos[0], pos[1] + 0.05, pos[2]], [0, 0, 0], 4, { outline: false });
    }
    for (const t of [0.55, 0.72]) {
      const { p, n, r } = at(t);
      for (const sx of [-1, 1]) petal(k, tg, sx > 0 ? leafB : leafA, 0.2, 0.1, [p.x + sx * r * 0.5, p.y + n.y * r * 0.6, p.z + n.z * r * 0.6], sx * 1.2, PI * 0.5 - 0.3 * n.y, { curl: 0.05 });
    }
    for (let i = 0; i < 4; i++) sparkle(k, c, crown, i % 2 ? 0xfff2a0 : 0xd8ffb0, 0.022, [Math.cos(i * 1.6) * 0.3, 0.15 + (i % 2) * 0.2, Math.sin(i * 1.6) * 0.28], 0.05);
  },

  // `leaffrog`
  leaffrog(k, c, s) {
    const col = 0x5fc25a;
    const belly = 0xf4efa6;
    const dark = 0x3f9a44;
    const toe = 0x9adf7e;
    const iris = 0x2f6a1c;
    const vine = 0x3a8a30;
    const mouth = 0x2a4a22;

    /** Frog head (sc is the overall scale): a wide flat face, two eye bulges on top of the head, big eyes, nostrils, blush, a wide mouth */
    const frogHead = (head: THREE.Object3D, sc: number, eye = 0.1) => {
      k.sphere(head, col, 1, [0, 0, 0], [0.37 * sc, 0.25 * sc, 0.3 * sc]);
      k.sphere(head, belly, 1, [0, -0.085 * sc, 0.05 * sc], [0.31 * sc, 0.15 * sc, 0.255 * sc], [0, 0, 0], { outline: false });
      const er = eye * sc;
      for (const sx of [-1, 1]) k.sphere(head, col, er * 1.35, [sx * 0.17 * sc, 0.16 * sc, 0.06 * sc]);
      k.eyes(head, { x: 0.17 * sc, y: 0.175 * sc, z: 0.06 * sc + er * 1.05, r: er, iris });
      for (const sx of [-1, 1]) k.sphere(head, mouth, 0.012 * sc, [sx * 0.05 * sc, 0.03 * sc, 0.29 * sc], [1, 0.7, 0.5], [0, 0, 0], { outline: false });
      k.blush(head, 0.26 * sc, -0.02 * sc, 0.2 * sc, 0.05 * sc);
      const mg = new THREE.TorusGeometry(1, 0.032, 6, 32, PI * 0.76);
      mg.rotateZ(PI * 0.12);
      mg.scale(0.378 * sc, 0.306 * sc, 0.45 * sc);
      mg.rotateX(PI / 2);
      k.mesh(head, mg, mouth, [0, -0.035 * sc, 0], [0, 0, 0], { outline: false });
    };
    /** Three webbed toes */
    const toes = (g: THREE.Object3D, pos: V3, sp: number, r: number) => {
      for (let i = -1; i <= 1; i++) k.sphere(g, toe, r, [pos[0] + i * sp, pos[1], pos[2]], [1, 0.7, 1.3], [0, 0, 0], { outline: false });
    };
    /** Dark spots on the back */
    const spots = (list: [number, number, number, number][]) => {
      for (const [x, y, z, r] of list) k.sphere(c.body, dark, r, [x, y, z], [1, 0.45, 1], [0, 0, 0], { outline: false });
    };

    if (s === 1) {
      // I: a round plump froglet, the head almost the whole body, short limbs, with a small tadpole tail still left behind
      c.archetype = 'quad';
      k.sphere(c.body, col, 1, [0, 0.19, -0.04], [0.29, 0.19, 0.27]);
      k.sphere(c.body, belly, 1, [0, 0.14, 0.05], [0.23, 0.13, 0.22], [0, 0, 0], { outline: false });
      spots([
        [0.12, 0.36, -0.14, 0.04],
        [-0.1, 0.35, -0.2, 0.035],
      ]);
      const head = k.group(c.body, [0, 0.35, 0.07]);
      c.head = head;
      frogHead(head, 1.05, 0.115);
      for (const sx of [-1, 1]) {
        // Front feet: short, propped on the ground
        const f = k.group(c.body, [sx * 0.16, 0.13, 0.2]);
        k.capsule(f, col, 0.04, 0.05, [0, -0.05, 0.01]);
        k.sphere(f, col, 0.05, [0, -0.1, 0.04], [1.3, 0.45, 1.2]);
        toes(f, [0, -0.105, 0.09], 0.035, 0.02);
        c.legs.push({ g: f, phase: sx > 0 ? 0 : PI, amp: 0.5 });
        // Hind legs: small thighs folded at the sides, feet stretched forward
        const hg = k.group(c.body, [sx * 0.24, 0.12, -0.08]);
        k.sphere(hg, col, 0.1, [0, 0, 0], [0.8, 0.85, 1.1]);
        k.sphere(hg, col, 0.055, [sx * 0.03, -0.08, 0.12], [1.1, 0.4, 1.6]);
        toes(hg, [sx * 0.03, -0.085, 0.2], 0.038, 0.022);
        c.legs.push({ g: hg, phase: sx > 0 ? PI : 0, amp: 0.4 });
      }
      // Tadpole tail: a thin fin that swishes left and right
      const tw = k.group(c.body, [0, 0.16, -0.25]);
      c.tails.push({ g: tw, phase: 0, amp: 0.35, axis: 'y' });
      const fin = aimPlane(k.group(tw), [0, -0.3, -1], [1, 0, 0]);
      k.blade(fin, toe, 0.24, 0.13, 0.035, [0, 0, 0]);
      k.blade(fin, col, 0.16, 0.06, 0.04, [0, 0, 0]);
      leafFlute(k, head, [0.1, -0.06, 0.28], [0.5, -0.3, 0.85], 0.2);
      note(k, c, head, 0xc8ffb0, 0.032, [0.4, 0.06, 0.4]);
      return;
    }

    if (s === 2) {
      // II: a young frog crouching, the body lengthened, sturdy hind legs folded at the sides, front legs braced straight; wrapped in vines and wearing a lotus-leaf hat
      c.archetype = 'quad';
      k.sphere(c.body, col, 1, [0, 0.3, -0.06], [0.3, 0.23, 0.38], [0.12, 0, 0]);
      k.sphere(c.body, belly, 1, [0, 0.23, 0.04], [0.24, 0.16, 0.3], [0.12, 0, 0], { outline: false });
      spots([
        [0.15, 0.5, -0.16, 0.05],
        [-0.12, 0.48, -0.26, 0.045],
        [0.03, 0.44, -0.36, 0.04],
        [-0.16, 0.44, 0.02, 0.035],
      ]);
      const head = k.group(c.body, [0, 0.44, 0.25]);
      c.head = head;
      frogHead(head, 0.95, 0.1);
      for (const sx of [-1, 1]) {
        // Front feet: braced straight on the ground
        const f = k.group(c.body, [sx * 0.2, 0.24, 0.24]);
        k.capsule(f, col, 0.042, 0.12, [0, -0.09, 0]);
        k.sphere(f, col, 0.06, [0, -0.19, 0.04], [1.3, 0.45, 1.3]);
        toes(f, [0, -0.195, 0.1], 0.04, 0.022);
        c.legs.push({ g: f, phase: sx > 0 ? 0 : PI, amp: 0.6 });
        // Hind legs: thighs folded at the sides, shins forward, feet flat on the ground
        const hg = k.group(c.body, [sx * 0.28, 0.2, -0.16]);
        k.sphere(hg, col, 0.15, [0, 0.02, 0], [0.75, 0.9, 1.3]);
        k.capsule(hg, col, 0.05, 0.16, [sx * 0.03, -0.08, 0.09], [2.24, 0, 0]);
        k.sphere(hg, col, 0.07, [sx * 0.04, -0.16, 0.2], [1.1, 0.4, 1.7]);
        toes(hg, [sx * 0.04, -0.165, 0.32], 0.045, 0.026);
        c.legs.push({ g: hg, phase: sx > 0 ? PI : 0, amp: 0.4 });
      }
      // Vines and leaves wrapped around the body
      const r1 = ellRing(k, c.body, vine, 0.31, 0.24, 0.018, [0, 0.31, 0.02], 0.45, 0.5);
      const r2 = ellRing(k, c.body, vine, 0.3, 0.24, 0.018, [0, 0.31, -0.16], -0.4, -0.6);
      for (const [rg, rx, ry] of [
        [r1, 0.31, 0.24],
        [r2, 0.3, 0.24],
      ] as [THREE.Group, number, number][]) {
        for (let i = 0; i < 4; i++) {
          const a = 0.4 + i * 1.55;
          k.blade(rg, i % 2 ? 0x6cc84a : 0x4fb04a, 0.12, 0.07, 0.02, [rx * Math.cos(a), ry * Math.sin(a), 0], [0.5, 0, a - PI / 2]);
        }
      }
      // Lotus-leaf hat: worn tilted to one side, with a dewdrop resting on the leaf
      const hat = lilyPad(k, head, 0.26, [0.05, 0.23, 0.0], 0x4aa84a, 0x7ad066, 0.4);
      hat.rotation.set(-0.12, 0.4, 0.3);
      k.cyl(hat, 0x7ad066, 0.02, 0.028, 0.05, [0, 0.035, 0], [0, 0, 0], 8);
      k.glowSphere(hat, 0xbff0ff, 0.028, [0.09, 0.05, 0.08], 1.3, [1, 0.7, 1]);
      leafFlute(k, head, [0.1, -0.05, 0.27], [0.5, -0.3, 0.85], 0.32);
      note(k, c, head, 0xc8ffb0, 0.035, [0.45, 0.08, 0.42]);
      note(k, c, head, 0xfff2a0, 0.028, [0.58, 0.22, 0.3], -0.2);
      return;
    }

    // III: an upright frog king, slender legs and arms, a lotus crown, a leaf shawl, a long leaf-flute staff
    const b = biped(k, c, { col, belly, torsoR: 0.24, torsoH: 0.5, leg: 0.28, legR: 0.062, headR: 0.06, armLen: 0.24, armR: 0.05, hand: col, foot: col });
    b.head.position.y = b.leg + b.th + 0.15;
    frogHead(b.head, 0.95, 0.1);
    for (const l of c.legs) {
      k.sphere(l.g, col, 0.085, [0, -0.04, 0], [1, 1.25, 1]);
      k.sphere(l.g, col, 0.075, [0, -b.leg + 0.03, 0.08], [1.2, 0.35, 1.6]);
      toes(l.g, [0, -b.leg + 0.025, 0.2], 0.05, 0.026);
    }
    spots([
      [0.16, b.torsoY + 0.18, -0.16, 0.05],
      [-0.13, b.torsoY + 0.06, -0.19, 0.045],
      [0.05, b.torsoY - 0.06, -0.22, 0.04],
    ]);
    // Lotus crown: petals pink on the outer ring and pale pink on the inner ring, a point of gold light in the center
    const crown = k.group(b.head, [0, 0.21, -0.04]);
    k.torus(crown, 0xe6b44a, 0.1, 0.018, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) petal(k, crown, 0xffa2c4, 0.22, 0.12, [Math.sin((i / 8) * PI * 2) * 0.08, 0, Math.cos((i / 8) * PI * 2) * 0.08], (i / 8) * PI * 2, 0.72, { curl: 0.05, cup: 0.03 });
    for (let i = 0; i < 5; i++) petal(k, crown, 0xffe0ec, 0.17, 0.1, [Math.sin((i / 5) * PI * 2 + 0.3) * 0.035, 0.01, Math.cos((i / 5) * PI * 2 + 0.3) * 0.035], (i / 5) * PI * 2 + 0.3, 0.25, { curl: 0.04, cup: 0.03 });
    k.glowSphere(crown, 0xffe27a, 0.045, [0, 0.08, 0], 2.4);
    // Leaf shawl: big leaves hanging from the shoulders to the back
    const shawlY = b.leg + b.th * 0.95;
    [0.4, 0.65, 0.88, 1.12, 1.35, 1.6].forEach((v, i) => {
      const a = v * PI;
      petal(k, c.body, i % 2 ? dark : 0x52b04a, 0.4, 0.2, [Math.sin(a) * 0.2, shawlY, Math.cos(a) * 0.17], a, PI - 0.55, { curl: 0.08, bulge: 0.02, thick: 0.025 });
    });
    k.torus(c.body, vine, 0.2, 0.022, [0, shawlY + 0.01, 0.0], [PI / 2 - 0.15, 0, 0]);
    // Long leaf-flute staff (held in the right hand, the left hand slightly open)
    c.arms[1].base.set(-0.55, 0, -0.15);
    c.arms[1].g.rotation.copy(c.arms[1].base);
    c.arms[0].base.set(0.1, 0, 0.55);
    c.arms[0].g.rotation.copy(c.arms[0].base);
    // Gripped on the lower part of the staff, which stands straight at its side with the top higher than the crown
    const staff = k.group(b.hands[1], [0.03, 0, 0.02], [0.55, 0, -0.12]);
    const stick = 0xa6dc6c;
    k.cyl(staff, stick, 0.028, 0.032, 1.15, [0, 0.42, 0], [0, 0, 0], 10);
    for (let i = 0; i < 4; i++) k.sphere(staff, mouth, 0.013, [0, 0.5 + i * 0.09, 0.028], [1, 1, 0.5], [0, 0, 0], { outline: false });
    k.cyl(staff, stick, 0.065, 0.03, 0.09, [0, 1.0, 0], [0, 0, 0], 12);
    petal(k, staff, col, 0.28, 0.13, [0, 0.84, -0.02], 0.4, 0.75, { curl: 0.1, cup: 0.03 });
    petal(k, staff, 0x4fb04a, 0.24, 0.11, [0, 0.8, 0.0], -2.2, 0.7, { curl: 0.08, cup: 0.03 });
    k.glowSphere(staff, 0xd8ffb0, 0.05, [0, 1.07, 0], 2.4);
    note(k, c, c.body, 0xc8ffb0, 0.04, [0.55, 1.2, 0.1]);
    note(k, c, c.body, 0xfff2a0, 0.032, [0.4, 1.36, -0.05], -0.2);
    note(k, c, c.body, 0xc8ffb0, 0.03, [-0.45, 1.05, 0.0]);
  },

  // `owlarchivist`
  owlarchivist(k, c, s) {
    const moss = 0x6a8a4a;
    const mossD = 0x54703a;
    const mossL = 0x8fae62;
    const bark = 0x6b4a2e;
    const barkD = 0x4e3520;
    const face = 0xdfe6b8;
    const belly = 0xe2d4a8;
    const bellyD = 0xcdbd8e;
    const beak = 0xe8b04a;
    const gold = 0xd8a840;
    const page = 0xfffbf0;
    const bookG = 0xffe9a8;
    const rune = 0xb8ff9a;
    c.archetype = 'bird';
    c.hover = 0.03;

    /** Owl face: a heart-shaped facial disc, big eyes, round-rimmed glasses (bridge + temples), a small beak, blush; brow / tuft give lengths (0 = none) */
    const owlFace = (head: THREE.Object3D, hr: number, o: { eye: number; brow: number; tuft: number }) => {
      k.sphere(head, moss, 1, [0, 0, 0], [hr * 1.08, hr * 0.94, hr * 0.98]);
      k.sphere(head, bark, 1, [0, hr * 0.3, -hr * 0.3], [hr * 0.98, hr * 0.68, hr * 0.76], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        k.sphere(head, mossD, 1, [sx * hr * 0.36, -hr * 0.04, hr * 0.6], [hr * 0.6, hr * 0.68, hr * 0.34], [0, sx * 0.35, 0], { outline: false });
        k.sphere(head, face, 1, [sx * hr * 0.36, -hr * 0.04, hr * 0.64], [hr * 0.54, hr * 0.62, hr * 0.32], [0, sx * 0.35, 0], { outline: false });
      }
      k.sphere(head, face, 1, [0, -hr * 0.34, hr * 0.72], [hr * 0.3, hr * 0.32, hr * 0.22], [0, 0, 0], { outline: false });
      const er = hr * o.eye;
      k.eyes(head, { x: hr * 0.36, y: -hr * 0.02, z: hr * 0.86, r: er, iris: 0xffb22a, yaw: 0.22 });
      for (const sx of [-1, 1]) {
        k.torus(head, gold, er * 1.3, 0.014, [sx * hr * 0.36, -hr * 0.02, hr * 0.94], [0, sx * 0.22, 0]);
        k.cyl(head, gold, 0.008, 0.008, hr * 0.7, [sx * hr * 0.78, hr * 0.08, hr * 0.45], [0, 0, 0], 5, { outline: false }).rotation.set(PI / 2 - 0.15, sx * 0.4, 0);
      }
      k.torus(head, gold, hr * 0.09, 0.012, [0, 0.0, hr * 1.0], [0, 0, 0], PI);
      k.cone(head, beak, hr * 0.1, hr * 0.26, [0, -hr * 0.2, hr * 0.92], [PI * 0.7, 0, 0], 8);
      k.blush(head, hr * 0.64, -hr * 0.3, hr * 0.66, hr * 0.12);
      for (const sx of [-1, 1]) {
        if (o.brow) {
          const brow = aimPlane(k.group(head, [sx * hr * 0.22, hr * 0.42, hr * 0.78]), [sx * 0.75, 0.45, -0.25], [0, 0.35, 1]);
          k.blade(brow, bark, hr * o.brow, hr * 0.24, 0.035, [0, 0, 0]);
        }
        if (o.tuft) {
          const eg = k.group(head, [sx * hr * 0.62, hr * 0.62, -hr * 0.1], [-0.2, 0, -sx * 0.55]);
          k.horn(eg, bark, hr * 0.13, hr * o.tuft, hr * 0.12, [0, 0, 0]);
          c.ears.push({ g: eg, phase: sx * 1.7 });
        }
      }
    };
    /** Pale belly + rows of feather scales (rad is the body ellipsoid's radius) */
    const bellyPlate = (y: number, rad: V3, rows: number) => {
      const br: V3 = [rad[0] * 0.7, rad[1] * 0.74, rad[2] * 0.72];
      const cz = rad[2] * 0.3;
      const cy = y - rad[1] * 0.12;
      k.sphere(c.body, belly, 1, [0, cy, cz], br, [0, 0, 0], { outline: false });
      for (let row = 0; row < rows; row++) {
        const n = 2 + row;
        for (let i = 0; i < n; i++) {
          const x = (i - (n - 1) / 2) * br[0] * 0.42;
          const yy = cy + br[1] * 0.25 - row * br[1] * 0.36;
          const z = Math.sqrt(Math.max(0.02, 1 - (x / br[0]) ** 2 - ((yy - cy) / br[1]) ** 2)) * br[2] + cz;
          k.sphere(c.body, bellyD, br[0] * 0.2, [x, yy, z], [1, 0.7, 0.2], [0, 0, 0], { outline: false });
        }
      }
    };
    /** Bird foot: one leg segment + toes, three forward and one back */
    const feet = (x: number, z: number, sc: number) => {
      for (const sx of [-1, 1]) {
        const fg = k.group(c.body, [sx * x, 0.1, z]);
        k.capsule(fg, beak, sc * 0.08, sc * 0.1, [0, -0.02, 0]);
        for (const [dx, dz] of [
          [-0.09, 0.2],
          [0, 0.24],
          [0.09, 0.2],
          [0, -0.16],
        ] as [number, number][])
          k.capsule(fg, beak, sc * 0.055, sc * 0.16, [dx * sc, -0.08, dz * sc * 0.5], [PI / 2, 0, 0]);
        c.legs.push({ g: fg, phase: sx > 0 ? 0 : PI, amp: 0.4 });
      }
    };
    /** Three tail feathers that sway slightly */
    const tail = (y: number, z: number, len: number, w: number) => {
      const tw = k.group(c.body, [0, y, z]);
      c.tails.push({ g: tw, phase: 0, amp: 0.1, axis: 'y' });
      for (let i = -1; i <= 1; i++) {
        const tg = aimPlane(k.group(tw, [i * w * 0.7, 0, 0]), [i * 0.25, -0.55, -1], [0, 1, 0]);
        k.blade(tg, i ? bark : barkD, len, w, 0.035, [0, 0, 0]);
      }
    };
    /** Layered feather wings folded at the sides; pages = feather edges like book pages */
    const wings = (x: number, y: number, z: number, len: number, w: number, pages: boolean, fold: V3, base: number, amp: number) => {
      for (const sx of [-1, 1]) {
        const wg = k.group(c.body, [sx * x, y, z]);
        const fg = aimPlane(k.group(wg), [sx * fold[0], fold[1], fold[2]], [sx * 1, 0, 0.45]);
        for (let i = 0; i < 3; i++) {
          const l = len * (1 - i * 0.12);
          k.blade(fg, i % 2 ? barkD : bark, l, w, 0.04, [0, 0, -i * 0.025], [-i * 0.12, 0, 0]);
          if (pages) {
            const pg = k.group(fg, [0, l * 0.66, -i * 0.025 - 0.008], [-i * 0.12, 0, 0]);
            k.blade(pg, page, l * 0.42, w * 0.88, 0.028, [0, 0, 0]);
            for (let j = 0; j < 3; j++) k.mesh(pg, new THREE.BoxGeometry(w * 0.35, 0.006, 0.004), 0x5a4a3a, [0, l * 0.1 + j * l * 0.09, 0.016], [0, 0, 0], { outline: false });
          }
        }
        c.wings.push({ g: wg, side: -sx, base, amp, speed: 2.2 });
      }
    };
    /** Quill hanging on the chest */
    const quill = (y: number, r: number) => {
      k.torus(c.body, 0x8a6a4a, r * 0.66, 0.01, [0, y + r * 0.62, r * 0.02], [PI / 2 + 0.35, 0, 0]);
      const q = k.group(c.body, [r * 0.2, y + r * 0.02, r * 0.98], [0.1, 0, -0.5]);
      k.blade(q, page, r * 0.9, r * 0.24, 0.02, [0, 0, 0]);
      k.cyl(q, 0x8a6a4a, 0.006, 0.006, r * 0.9, [0, r * 0.38, 0.012], [0, 0, 0], 4, { outline: false });
      k.cone(q, gold, 0.015, r * 0.18, [0, 0, 0], [PI, 0, 0], 6);
    };

    if (s === 1) {
      // I: a fluffball owlet, the head and body joined into one egg, down sticking out all around, the small wings spread like hands
      const r = 0.3;
      const y = 0.3;
      k.sphere(c.body, moss, 1, [0, y, 0], [r, r * 0.95, r * 0.92]);
      bellyPlate(y, [r, r * 0.95, r * 0.92], 1);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2 + 0.3;
        k.sphere(c.body, i % 2 ? mossD : moss, r * 0.2, [Math.cos(a) * r * 0.92, y - r * 0.5 + (i % 2) * 0.03, Math.sin(a) * r * 0.85], [1, 0.8, 1]);
      }
      const hr = r;
      const head = k.group(c.body, [0, y + r * 0.62, r * 0.02]);
      c.head = head;
      owlFace(head, hr, { eye: 0.3, brow: 0, tuft: 0 });
      for (let i = -2; i <= 2; i++) k.horn(head, i % 2 ? barkD : bark, hr * 0.08, hr * 0.3, hr * 0.1, [i * hr * 0.22, hr * 0.74, -hr * 0.2], [-0.35, 0, -i * 0.35]);
      for (const sx of [-1, 1]) {
        const wg = k.group(c.body, [sx * r * 0.9, y + r * 0.2, r * 0.1]);
        const fg = aimPlane(k.group(wg), [sx * 0.85, -0.5, 0.1], [0, 0.3, 1]);
        k.blade(fg, bark, r * 0.55, r * 0.4, 0.05, [0, 0, 0]);
        k.blade(fg, barkD, r * 0.42, r * 0.28, 0.05, [0, 0, -0.02], [-0.25, 0, 0]);
        c.wings.push({ g: wg, side: -sx, base: 0.15, amp: 0.3, speed: 4 });
      }
      tail(y - r * 0.55, -r * 0.7, r * 0.42, r * 0.2);
      feet(r * 0.35, r * 0.2, r);
      return;
    }

    if (s === 2) {
      // II: a young owl, the egg-shaped body now separate from the head, the wings folded at the sides (feather edges like book pages), a quill hanging on the chest, brow feathers and ear tufts starting to grow
      const r = 0.3;
      const y = r * 1.2 + 0.08;
      k.sphere(c.body, moss, 1, [0, y, 0], [r, r * 1.2, r * 0.92]);
      bellyPlate(y, [r, r * 1.2, r * 0.92], 2);
      k.sphere(c.body, bark, 1, [0, y + r * 0.1, -r * 0.4], [r * 0.82, r * 1.0, r * 0.6], [0, 0, 0], { outline: false });
      const hr = r * 0.85;
      const head = k.group(c.body, [0, y + r * 1.35, r * 0.06]);
      c.head = head;
      k.sphere(c.body, moss, 1, [0, y + r * 1.05, r * 0.02], [r * 0.66, r * 0.45, r * 0.6]);
      owlFace(head, hr, { eye: 0.28, brow: 0.5, tuft: 0.45 });
      wings(r * 0.86, y + r * 0.62, r * 0.12, r * 1.25, r * 0.36, true, [0.3, -1, 0.05], 0.08, 0.06);
      tail(y - r * 0.85, -r * 0.55, r * 0.62, r * 0.24);
      feet(r * 0.32, r * 0.15, r);
      quill(y, r);
      for (const sx of [-1, 1]) k.sphere(c.body, mossL, r * 0.16, [sx * r * 0.55, y + r * 0.95, r * 0.35], [1, 0.6, 0.5], [0, sx * 0.6, 0], { outline: false });
      return;
    }

    // III: `owlarchivist`, a slender body leaning slightly forward, wings hanging to the feet like a robe, a bark crown circled by rune motes, a glowing ancient book floating beside it
    const r = 0.32;
    const y = r * 1.5 + 0.1;
    k.sphere(c.body, moss, 1, [0, y, 0], [r * 0.95, r * 1.55, r * 0.88]);
    bellyPlate(y, [r * 0.95, r * 1.55, r * 0.88], 3);
    k.sphere(c.body, bark, 1, [0, y + r * 0.2, -r * 0.35], [r * 0.8, r * 1.35, r * 0.6], [0, 0, 0], { outline: false });
    const hr = r * 0.8;
    const head = k.group(c.body, [0, y + r * 1.62, r * 0.14]);
    c.head = head;
    k.sphere(c.body, moss, 1, [0, y + r * 1.3, r * 0.08], [r * 0.62, r * 0.5, r * 0.56]);
    owlFace(head, hr, { eye: 0.27, brow: 0.72, tuft: 0.62 });
    wings(r * 0.8, y + r * 0.95, r * 0.05, r * 2.4, r * 0.42, true, [0.12, -1, 0.03], 0.06, 0.05);
    tail(y - r * 1.25, -r * 0.6, r * 0.7, r * 0.26);
    feet(r * 0.32, r * 0.2, r);
    quill(y + r * 0.3, r);
    for (const sx of [-1, 1]) {
      k.sphere(c.body, mossL, r * 0.2, [sx * r * 0.62, y + r * 1.15, r * 0.3], [1, 0.6, 0.5], [0, sx * 0.6, 0], { outline: false });
      k.sphere(c.body, mossL, r * 0.12, [sx * r * 0.5, y + r * 0.5, r * 0.62], [1, 0.6, 0.5], [0, sx * 0.4, 0], { outline: false });
    }
    // Bark crown and the rune motes circling it
    const crown = k.group(head, [0, hr * 0.62, -hr * 0.1]);
    k.torus(crown, barkD, hr * 0.5, 0.035, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      k.cone(crown, i % 2 ? barkD : bark, 0.045, hr * (0.4 + (i % 2) * 0.2), [Math.sin(a) * hr * 0.5, 0, Math.cos(a) * hr * 0.5], [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25], 5);
    }
    k.glowSphere(crown, rune, 0.035, [0, 0.04, hr * 0.52], 2.6);
    const runes = k.group(crown, [0, hr * 0.32, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const g = new THREE.OctahedronGeometry(0.03);
      g.scale(0.7, 1.4, 0.7);
      const m = k.glow(runes, g, i % 2 ? bookG : rune, 2.6, [Math.cos(a) * hr * 0.95, Math.sin(i * 1.7) * 0.05, Math.sin(a) * hr * 0.95]);
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.04, speed: 2.2, phase: i });
    }
    c.spinners.push({ g: runes, speed: 0.7, axis: 'y' });
    // Glowing ancient book floating beside it: open, turned slightly toward the viewer
    const book = k.group(c.body, [-r * 1.95, y + r * 0.7, r * 0.5], [-0.55, 0.65, 0.15]);
    c.bobbers.push({ g: book, base: book.position.y, amp: 0.035, speed: 1.3, phase: 0 });
    for (const sx of [-1, 1]) {
      const half = k.group(book, [0, 0, 0], [0, -sx * 0.3, 0]);
      const cover = new THREE.BoxGeometry(0.34, 0.46, 0.025);
      cover.translate(sx * 0.17, 0, 0);
      slab(k, half, cover, 0x6b3a22, [0, 0, -0.014]);
      const pg = new THREE.BoxGeometry(0.32, 0.43, 0.03);
      pg.translate(sx * 0.16, 0, 0);
      k.glow(half, pg, bookG, 1.25, [0, 0, 0.014]);
      for (let i = 0; i < 5; i++) k.glow(half, new THREE.BoxGeometry(0.2 - (i % 2) * 0.05, 0.012, 0.006), i % 2 ? rune : 0xffc860, 2.2, [sx * 0.16, 0.15 - i * 0.07, 0.032]);
    }
    k.cyl(book, 0x4a2a16, 0.022, 0.022, 0.46, [0, 0, -0.01], [0, 0, 0], 6);
    k.glowSphere(book, bookG, 0.34, [0, 0, 0.03], 1.1, [1.3, 0.9, 0.4], 0.26);
    for (let i = 0; i < 3; i++) sparkle(k, c, book, i % 2 ? rune : bookG, 0.018, [(i - 1) * 0.18, 0.14 + (i % 2) * 0.1, 0.08], 0.05);
    for (let i = 0; i < 3; i++) sparkle(k, c, c.body, bookG, 0.018, [Math.cos(i * 2.1) * 0.55, y + (i % 2) * 0.5, Math.sin(i * 2.1) * 0.45], 0.06);
  },

  // `banyanelder` (single form)
  banyanelder(k, c) {
    c.archetype = 'biped';
    const bark = 0x7a5634;
    const barkD = 0x563a22;
    const barkL = 0x9a7450;
    const leaf = 0x4f9a3a;
    const leafL = 0x6cbf4a;
    const leafD = 0x3c7e2e;
    const fruit = 0xffd86a;
    const moss = 0x86b84e;
    const rune = 0x9aff7a;

    /** Hanging glowing fruit: a short stalk, the fruit, a glow, a small leaf; sways gently */
    const fruitAt = (parent: THREE.Object3D, pos: V3, r = 0.042) => {
      const g = k.group(parent, pos);
      k.cyl(g, barkD, 0.006, 0.006, 0.06, [0, 0.03, 0], [0, 0, 0], 5, { outline: false });
      k.glowSphere(g, fruit, r, [0, -r * 0.7, 0], 2.3);
      k.glowSphere(g, fruit, r * 1.7, [0, -r * 0.7, 0], 1.0, [1, 1, 1], 0.2);
      const lf = k.group(g, [0.01, 0.02, 0], [0, 0, -1.2]);
      slab(k, lf, petalGeo(0.06, 0.035, { curl: 0.02 }), leafL);
      c.bobbers.push({ g, base: pos[1], amp: 0.012, speed: 1.4 + Math.random(), phase: Math.random() * 6 });
      return g;
    };
    /** A tuft of leaves turned up on the foliage: stuck on the sphere's surface, extending toward dir */
    const tuft = (parent: THREE.Object3D, ctr: V3, r: number, dir: V3, col: C, len = 0.14) => {
      const d = new THREE.Vector3(...dir).normalize();
      const g = aim(k.group(parent, [ctr[0] + d.x * r * 0.9, ctr[1] + d.y * r * 0.9, ctr[2] + d.z * r * 0.9]), dir);
      slab(k, g, petalGeo(len, len * 0.55, { curl: 0.05, cup: 0.03 }), col);
      return g;
    };

    // Forked root legs: a thick root splitting downward into three toe roots gripping the ground, with a ring of glowing veins on the roots
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * 0.2, 0.34, 0]);
      k.cyl(g, bark, 0.11, 0.14, 0.26, [0, -0.12, 0], [0, 0, 0], 12);
      for (const d of [
        [sx * 0.35, -0.5, 0.8],
        [sx * 0.9, -0.55, -0.1],
        [-sx * 0.3, -0.5, -0.85],
      ] as V3[]) {
        const rg = aim(k.group(g, [0, -0.22, 0]), d);
        k.horn(rg, bark, 0.06, 0.22, 0.03, [0, 0, 0]);
      }
      k.glow(g, new THREE.TorusGeometry(0.125, 0.008, 6, 24), rune, 1.8, [0, -0.12, 0], [PI / 2, 0, 0], 0.7);
      c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.3 });
    }

    // Trunk: a revolved profile with a waist and burls
    const prof: [number, number][] = [
      [0.001, 0.24],
      [0.3, 0.27],
      [0.37, 0.36],
      [0.34, 0.56],
      [0.3, 0.78],
      [0.31, 0.98],
      [0.35, 1.16],
      [0.29, 1.28],
      [0.001, 1.3],
    ];
    k.lathe(c.body, bark, prof);
    /** Radius of the trunk profile at height y */
    const trunkR = (y: number) => {
      for (let i = 1; i < prof.length; i++) {
        if (y <= prof[i][1]) {
          const [x0, y0] = prof[i - 1];
          const [x1, y1] = prof[i];
          return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
        }
      }
      return prof[prof.length - 1][0];
    };
    // Bark ridges (avoiding the face on the front)
    for (const a of [0.85, 1.35, 1.9, 2.5, 3.1, -0.9, -1.45, -2.0, -2.6]) {
      const pts: V3[] = [];
      for (let j = 0; j <= 5; j++) {
        const y = 0.3 + (j / 5) * 0.9;
        const aa = a + Math.sin(j * 1.7 + a) * 0.08;
        const r = trunkR(y) * 1.01;
        pts.push([Math.sin(aa) * r, y, Math.cos(aa) * r]);
      }
      k.mesh(c.body, tubeGeo(curveOf(pts), (t) => 0.018 * (1 - Math.abs(t - 0.5) * 0.8), 12, 6), barkD, [0, 0, 0], [0, 0, 0], { outline: false });
    }
    // Burls and a tree hollow (aether green light shows through the hollow)
    k.sphere(c.body, barkL, 0.08, [-0.3, 1.08, 0.1], [1, 0.8, 0.7], [0, -0.6, 0.2]);
    k.sphere(c.body, barkL, 0.06, [0.3, 0.44, -0.14], [1, 0.9, 0.7], [0, 1.2, 0]);
    {
      const a = 1.25;
      const y = 0.6;
      const r = trunkR(y);
      const n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const hole = k.sphere(c.body, barkD, 0.065, [n.x * r, y, n.z * r], [1, 1.35, 0.25], [0, 0, 0], { outline: false });
      hole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      const gl = k.glowSphere(c.body, rune, 0.028, [n.x * (r + 0.012), y - 0.01, n.z * (r + 0.012)], 2.2, [1, 1.3, 0.3]);
      gl.quaternion.copy(hole.quaternion);
    }
    // Rune ring on the buttress roots: two green light rings around the trunk with motes
    for (const [y, op] of [
      [0.44, 0.6],
      [1.12, 0.5],
    ] as [number, number][]) {
      const R = trunkR(y) + 0.012;
      k.glow(c.body, new THREE.TorusGeometry(R, 0.009, 6, 48), rune, 1.9, [0, y, 0], [PI / 2, 0, 0], op);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + PI / 6;
        k.glowSphere(c.body, rune, 0.016, [Math.sin(a) * R, y + 0.03, Math.cos(a) * R], 2.4, [1, 1.6, 0.5]);
      }
    }
    // Moss and small mushrooms
    k.sphere(c.body, moss, 0.09, [0.24, 1.24, 0.16], [1.4, 0.5, 1.1], [0.3, 0.4, 0.3]);
    k.sphere(c.body, moss, 0.08, [-0.26, 1.22, -0.1], [1.3, 0.5, 1.1], [0, -0.5, -0.3]);
    k.sphere(c.body, moss, 0.07, [-0.22, 0.34, 0.24], [1.3, 0.6, 1], [0, -0.7, 0.3]);
    for (const [a, y, sz] of [
      [2.1, 0.42, 1],
      [2.35, 0.36, 0.75],
      [-2.2, 0.68, 0.8],
    ] as [number, number, number][]) {
      const r = trunkR(y);
      const mg = aim(k.group(c.body, [Math.sin(a) * r, y, Math.cos(a) * r]), [Math.sin(a), 0.4, Math.cos(a)]);
      k.cyl(mg, 0xf2e6c8, 0.016 * sz, 0.02 * sz, 0.07 * sz, [0, 0.03 * sz, 0], [0, 0, 0], 8);
      k.sphere(mg, 0xe8925a, 0.045 * sz, [0, 0.075 * sz, 0], [1, 0.62, 1]);
      k.sphere(mg, 0xfff4e0, 0.012 * sz, [0.02 * sz, 0.095 * sz, 0.02 * sz], [1, 0.6, 1], [0, 0, 0], { outline: false });
      k.sphere(mg, 0xfff4e0, 0.009 * sz, [-0.022 * sz, 0.09 * sz, -0.01 * sz], [1, 0.6, 1], [0, 0, 0], { outline: false });
    }

    // A gentle face on the bark: big eyes, moss brows, a burl nose, a smile, a moss beard
    const head = k.group(c.body, [0, 0.9, 0]);
    c.head = head;
    const frad: V3 = [0.31, 0.44, 0.31];
    faceEyes(k, head, frad, { x: 0.12, y: 0.02, r: 0.085, iris: 0xb07a34 });
    for (const sx of [-1, 1]) k.sphere(head, moss, 0.075, [sx * 0.125, 0.145, 0.27], [1.6, 0.55, 0.7], [0, sx * 0.3, -sx * 0.22]);
    k.sphere(head, barkL, 0.048, [0, -0.06, 0.305], [1, 0.85, 0.8]);
    smile(k, head, barkD, 0.065, [0, -0.14, 0.295], [0.25, 0, 0], 0.2);
    k.blush(head, 0.21, -0.08, 0.225, 0.048, 0xe89a7a);
    for (const [x, yy, r] of [
      [0, -0.25, 0.08],
      [-0.095, -0.22, 0.062],
      [0.095, -0.22, 0.062],
      [0.048, -0.31, 0.046],
      [-0.048, -0.31, 0.046],
    ] as V3[])
      k.sphere(head, moss, r, [x, yy, 0.265], [1, 1.15, 0.7]);

    // Dense canopy: three layers of leaf balls stacked, with leaf tufts turned up on top
    const cy = 1.3;
    const can = k.group(c.body, [0, cy, 0]);
    k.sphere(can, leaf, 0.42, [0, 0.22, 0], [1.25, 0.78, 1.15]);
    const clusters: [number, number, number, number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.2;
      clusters.push([Math.cos(a) * 0.44, 0.12 + (i % 2) * 0.05, Math.sin(a) * 0.4, 0.24 + (i % 3) * 0.015, i % 2 ? leafD : leaf]);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.7;
      clusters.push([Math.cos(a) * 0.3, 0.42 + (i % 2) * 0.04, Math.sin(a) * 0.27, 0.24, i % 2 ? leafL : leaf]);
    }
    clusters.push([0.05, 0.64, 0.02, 0.24, leafL], [-0.2, 0.6, -0.1, 0.18, leaf], [0.22, 0.58, 0.14, 0.16, leafL]);
    clusters.forEach(([x, y, z, r, col], i) => {
      k.sphere(can, col, r, [x, y, z]);
      if (i >= 8 || i % 2 === 0) tuft(can, [x, y, z], r, [x * 0.6, 0.5, z * 0.6], i % 2 ? leafL : leaf, 0.12 + (i % 3) * 0.015);
    });
    // Glowing fruit hanging among the canopy
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2 + 0.35;
      const R = 0.46 + (i % 2) * 0.08;
      fruitAt(can, [Math.sin(a) * R, -0.04 - (i % 3) * 0.05, Math.cos(a) * R * 0.9], 0.04 + (i % 2) * 0.006);
    }
    for (const [x, y, z] of [
      [0.18, 0.4, 0.46],
      [-0.26, 0.44, 0.38],
      [0.4, 0.52, -0.18],
      [-0.08, 0.76, 0.18],
    ] as V3[])
      fruitAt(can, [x, y, z], 0.038);
    // Hanging aerial roots (avoiding the front)
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * PI * 2 + 0.13;
      if (Math.cos(a) > 0.72) continue;
      const R = 0.46 + (i % 3) * 0.06;
      const len = 0.42 + ((i * 37) % 5) * 0.05;
      const g = k.group(can, [Math.sin(a) * R, 0.06, Math.cos(a) * R * 0.88]);
      const sw = Math.sin(i * 2.3) * 0.03;
      const pts: V3[] = [
        [0, 0, 0],
        [sw, -len * 0.35, Math.cos(i) * 0.02],
        [-sw * 0.6, -len * 0.7, 0.01],
        [sw * 0.4, -len, 0],
      ];
      k.mesh(g, tubeGeo(curveOf(pts), (t) => 0.02 * (1 - t * 0.5), 10, 6), barkL, [0, 0, 0], [0, 0, 0], { outline: false });
      k.sphere(g, barkL, 0.016, [sw * 0.4, -len, 0], [1, 1, 1], [0, 0, 0], { outline: false });
      c.tails.push({ g, phase: i * 0.7, amp: 0.05, axis: i % 2 ? 'x' : 'z' });
    }

    // Branch arms: a shoulder burl, upper arm, a knotted elbow, forearm, ending in three branch fingers and a clump of leaves
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(0.1, 0, sx * 0.6);
      const g = k.group(c.body, [sx * 0.33, 1.1, 0.02], [base.x, base.y, base.z]);
      k.sphere(g, bark, 0.09, [0, 0, 0]);
      k.cyl(g, bark, 0.06, 0.08, 0.3, [0, -0.16, 0], [0, 0, 0], 10);
      const elbow = k.group(g, [0, -0.32, 0], [-0.55, 0, -sx * 0.35]);
      k.sphere(elbow, barkD, 0.07);
      k.cyl(elbow, bark, 0.045, 0.06, 0.26, [0, -0.14, 0], [0, 0, 0], 10);
      const hand = k.group(elbow, [0, -0.28, 0]);
      k.sphere(hand, bark, 0.055);
      for (const [rx, rz] of [
        [0.35, -sx * 0.45],
        [0.15, 0],
        [0.45, sx * 0.55],
      ] as [number, number][])
        k.horn(hand, bark, 0.026, 0.14, 0.03, [0, 0, 0], [PI - rx, 0, rz]);
      k.sphere(hand, leaf, 0.11, [sx * 0.05, 0.0, 0.03]);
      k.sphere(hand, leafL, 0.085, [-sx * 0.05, 0.07, 0.05]);
      tuft(hand, [sx * 0.05, 0.0, 0.03], 0.11, [sx * 0.8, 0.3, 0.4], leafL, 0.13);
      tuft(hand, [-sx * 0.05, 0.07, 0.05], 0.085, [-sx * 0.3, 0.9, 0.3], leaf, 0.11);
      fruitAt(hand, [sx * 0.06, -0.08, 0.1], 0.036);
      c.arms.push({ g, side: sx, base });
    }

    // A halo of a leaf ring spinning above the canopy
    const ring = halo(k, c, can, rune, 0.3, [0, 0.98, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      const lg = k.group(ring, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0], [0, 0, a - PI / 2]);
      slab(k, lg, petalGeo(0.11, 0.06, { curl: 0.03 }), i % 2 ? leafL : leaf, [0, 0, 0], [PI / 2, 0, 0]);
    }
    // Fireflies and pollen motes around the canopy
    for (let i = 0; i < 6; i++) sparkle(k, c, c.body, i % 2 ? 0xfff2a0 : 0xd8ffb0, 0.02, [Math.cos(i * 1.1) * 0.72, 0.8 + (i % 3) * 0.4, Math.sin(i * 1.1) * 0.6], 0.06);
  },

  // `bubblecrab`
  bubblecrab(k, c, s) {
    c.archetype = 'crawl';
    const col = 0xff7a5a;
    const dark = 0xd85a3e;
    const belly = 0xffd8c4;
    const pink = 0xff9ec0;
    const pinkL = 0xffb8d2;
    const shellC = 0xf2dcc0;
    const shellD = 0xd8b890;
    const rock = 0xc9b28a;
    const wall = 0xecdcb6;
    const roof = 0x3aa0b8;
    const warm = 0xffc860;
    const weed = 0x3a9a6a;
    // I is small and round with short legs; II has a wider, flatter body and longer legs; III has a huge wide flat shell and thick legs
    const bw = [0.22, 0.34, 0.46][s - 1];
    const bh = [0.17, 0.18, 0.22][s - 1];
    const bd = [0.2, 0.27, 0.36][s - 1];
    const L = [0.13, 0.18, 0.24][s - 1];
    const legR = [0.024, 0.03, 0.042][s - 1];
    const y = 0.02 + bh * 0.1 + L * 1.5;

    /** A single eye (at the top of the eye stalk), registered in c.eyes so it can blink */
    const eye = (parent: THREE.Object3D, pos: V3, r: number, yaw: number) => {
      const g = k.group(parent, pos, [0, yaw, 0]);
      const sc = new THREE.SphereGeometry(r, 20, 16);
      sc.scale(1, 1.15, 0.45);
      k.mesh(g, sc, 0xffffff);
      const ir = new THREE.SphereGeometry(r * 0.74, 18, 14);
      ir.scale(1, 1.15, 0.42);
      k.mesh(g, ir, 0x3a2430, [0, -r * 0.05, r * 0.2], [0, 0, 0], { outline: false });
      const pu = new THREE.SphereGeometry(r * 0.42, 14, 12);
      pu.scale(1, 1.1, 0.4);
      k.mesh(g, pu, 0x14101c, [0, -r * 0.05, r * 0.3], [0, 0, 0], { outline: false });
      k.glowSphere(g, 0xffffff, r * 0.24, [-r * 0.3, r * 0.34, r * 0.42], 1.6);
      k.glowSphere(g, 0xffffff, r * 0.11, [r * 0.28, -r * 0.3, r * 0.42], 1.4);
      c.eyes.push(g);
    };
    /** Claw (cs is the size multiplier; right big, left small) */
    const claw = (sx: number, cs: number) => {
      const base = new THREE.Euler(-0.25, sx * 0.45, 0);
      const arm = k.group(c.body, [sx * bw * 0.8, y - bh * 0.1, bd * 0.45], [base.x, base.y, base.z]);
      k.capsule(arm, col, legR * 1.5, 0.1 * cs, [0, 0, 0.06 * cs], [PI / 2, 0, 0]);
      k.sphere(arm, col, legR * 1.8, [0, 0, 0.12 * cs]);
      const cl = k.group(arm, [0, 0.02 * cs, 0.19 * cs]);
      k.sphere(cl, col, 0.095 * cs, [0, 0, 0], [0.85, 0.8, 1.1]);
      k.horn(cl, col, 0.045 * cs, 0.15 * cs, -0.05 * cs, [0, 0.03 * cs, 0.06 * cs], [PI / 2 - 0.4, 0, 0]);
      k.horn(cl, dark, 0.035 * cs, 0.11 * cs, 0.03 * cs, [0, -0.035 * cs, 0.06 * cs], [PI / 2 + 0.35, 0, 0]);
      if (s === 3) for (let i = 0; i < 3; i++) k.cone(cl, dark, 0.016 * cs, 0.04 * cs, [(i - 1) * 0.035 * cs, 0.07 * cs, -0.02 * cs + i * 0.01], [-0.3, 0, 0], 6);
      c.arms.push({ g: arm, side: sx, base });
    };

    // Body: an ellipsoid shell, a light underside, small spines on the shell rim (from II), a smile and blush
    k.sphere(c.body, col, 1, [0, y, 0], [bw, bh, bd]);
    k.sphere(c.body, belly, 1, [0, y - bh * 0.35, bd * 0.12], [bw * 0.86, bh * 0.62, bd * 0.86], [0, 0, 0], { outline: false });
    if (s >= 2) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) k.cone(c.body, dark, 0.018 + s * 0.005, 0.05 + s * 0.012, [sx * bw * (0.96 - i * 0.06), y + bh * 0.05, bd * (0.45 - i * 0.42)], [0, 0, -sx * 1.25], 6);
    k.blush(c.body, bw * 0.5, y - bh * 0.05, bd * 0.86, 0.03 + s * 0.006);
    k.torus(c.body, 0x5a2020, 0.03 + s * 0.005, 0.009, [0, y - bh * 0.15, bd * 0.98], [0, 0, PI], PI, { outline: false });
    // Eye stalks (registered as ears so they twitch now and then) + bubbles
    const head = k.group(c.body, [0, y + bh * 0.4, bd * 0.7]);
    c.head = head;
    const er = [0.08, 0.07, 0.065][s - 1];
    const stalk = [0.12, 0.13, 0.15][s - 1];
    for (const sx of [-1, 1]) {
      const eg = k.group(head, [sx * bw * 0.42, 0, 0]);
      k.cyl(eg, col, 0.026, 0.034, stalk, [0, stalk * 0.5, 0], [0, 0, 0], 10);
      k.sphere(eg, col, er * 1.12, [0, stalk + er * 0.5, 0]);
      eye(eg, [0, stalk + er * 0.5, er * 0.8], er, sx * 0.2);
      c.ears.push({ g: eg, phase: sx * 2.3 });
    }
    const nb = s === 3 ? 2 : 3;
    for (let i = 0; i < nb; i++) bubble(k, c, head, 0.04 + i * 0.012, [-0.05 + i * 0.07, stalk + 0.18 + i * 0.1, -0.03 + (i % 2) * 0.04]);
    // Claws and three pairs of legs (thighs out, shins folded down, dark tips)
    claw(1, [1.3, 1.6, 2.2][s - 1]);
    claw(-1, [0.8, 0.9, 1.1][s - 1]);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const g = k.group(c.body, [sx * bw * 0.8, y - bh * 0.1, bd * 0.2 - i * bd * 0.42], [0, sx * (i - 1) * 0.35, sx * 0.85]);
        k.capsule(g, col, legR, L * 0.7, [0, -L * 0.5, 0]);
        k.sphere(g, col, legR * 1.3, [0, -L * 0.85, 0]);
        const sh = k.group(g, [0, -L * 0.85, 0], [0, 0, -sx * 0.9]);
        k.capsule(sh, col, legR * 0.85, L * 0.6, [0, -L * 0.4, 0]);
        k.cone(sh, dark, legR, L * 0.35, [0, -L * 0.75, 0], [PI, 0, 0], 6);
        c.legs.push({ g, phase: i * 1.2 + (sx > 0 ? PI : 0), amp: 0.5 });
      }
    }

    if (s === 1) {
      // I: a baby hermit crab carrying a small snail shell
      const sh = k.group(c.body, [0, y + bh * 0.5, -bd * 0.15], [-1.2, 0, 0.3]);
      sh.scale.setScalar(1.3);
      k.lathe(sh, shellC, [
        [0.001, 0],
        [0.13, 0.01],
        [0.145, 0.07],
        [0.12, 0.15],
        [0.085, 0.23],
        [0.045, 0.3],
        [0.001, 0.35],
      ]);
      for (const [h, r] of [
        [0.07, 0.145],
        [0.15, 0.12],
        [0.23, 0.085],
      ] as [number, number][])
        k.torus(sh, shellD, r, 0.012, [0, h, 0], [PI / 2, 0, 0]);
      k.sphere(sh, shellD, 0.03, [0, 0.35, 0]);
      return;
    }
    if (s === 2) {
      // II: the shell has grown into a round chunk of reef rock, with pink coral, barnacles and a starfish growing on it
      const sh = k.group(c.body, [0, y + bh * 0.45, -bd * 0.12]);
      k.sphere(sh, rock, 1, [0, 0, 0], [bw * 0.72, 0.17, bd * 0.7]);
      k.sphere(sh, 0xd8c4a0, 1, [0.05, 0.06, 0.08], [bw * 0.4, 0.1, bd * 0.35], [0, 0, 0], { outline: false });
      coral(k, sh, pink, 1.4, [0, 0.14, -0.05], [-0.1, 0, 0]);
      coral(k, sh, pinkL, 1.0, [bw * 0.4, 0.1, -0.15], [0, 1, -0.45]);
      coral(k, sh, pink, 0.85, [-bw * 0.42, 0.1, -0.05], [0, -1.2, 0.5]);
      for (let i = 0; i < 4; i++) k.cone(sh, 0xf4ecd8, 0.022, 0.03, [Math.cos(i * 1.9) * bw * 0.5, 0.11, Math.sin(i * 1.9) * bd * 0.45], [0, 0, 0], 7);
      const star = k.group(sh, [bw * 0.25, 0.15, bd * 0.35], [0.3, 0.4, 0]);
      for (let i = 0; i < 5; i++) k.capsule(star, 0xffa040, 0.016, 0.05, [0, 0, 0], [0, 0, (i / 5) * PI * 2]).position.set(Math.sin((i / 5) * PI * 2) * -0.03, Math.cos((i / 5) * PI * 2) * 0.03, 0);
      k.sphere(star, 0xffa040, 0.02, [0, 0, 0]);
      return;
    }
    // III: a whole reef-rock castle on its back, a main keep, two pointed side towers, warm-lit windows, a small lighthouse on top (the beam turns), coral and seaweed
    const cs = k.group(c.body, [0, y + bh * 0.62, -bd * 0.08]);
    k.sphere(cs, rock, 1, [0, 0.0, 0], [bw * 0.86, 0.12, bd * 0.86]);
    k.sphere(cs, 0xd8c4a0, 1, [-0.08, 0.06, 0.1], [bw * 0.4, 0.08, bd * 0.3], [0, 0, 0], { outline: false });
    k.cyl(cs, wall, 0.15, 0.17, 0.34, [0, 0.22, -0.03], [0, 0, 0], 12);
    k.torus(cs, 0xd8c8a0, 0.165, 0.014, [0, 0.16, -0.03], [PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      k.mesh(cs, new THREE.BoxGeometry(0.05, 0.05, 0.045), wall, [Math.sin(a) * 0.135, 0.415, -0.03 + Math.cos(a) * 0.135], [0, a, 0]);
    }
    for (const sx of [-1, 1]) {
      k.cyl(cs, wall, 0.07, 0.08, 0.26, [sx * 0.25, 0.16, 0.06], [0, 0, 0], 10);
      k.torus(cs, 0xd8c8a0, 0.078, 0.012, [sx * 0.25, 0.27, 0.06], [PI / 2, 0, 0]);
      k.cone(cs, roof, 0.1, 0.16, [sx * 0.25, 0.29, 0.06], [0, 0, 0], 10);
      k.sphere(cs, warm, 0.018, [sx * 0.25, 0.46, 0.06]);
      k.glow(cs, new THREE.BoxGeometry(0.04, 0.055, 0.01), warm, 2.4, [sx * 0.25, 0.17, 0.142]);
      k.glow(cs, new THREE.BoxGeometry(0.03, 0.04, 0.01), warm, 2.2, [sx * 0.25 + sx * 0.06, 0.1, 0.11], [0, sx * 0.7, 0]);
    }
    k.glow(cs, new THREE.BoxGeometry(0.05, 0.07, 0.01), warm, 2.4, [0, 0.25, 0.14]);
    k.glow(cs, new THREE.BoxGeometry(0.05, 0.07, 0.01), warm, 2.4, [0.1, 0.25, 0.1], [0, 0.7, 0]);
    k.glow(cs, new THREE.BoxGeometry(0.07, 0.1, 0.01), 0xffb040, 2.2, [0, 0.08, 0.15]);
    k.torus(cs, 0x8a6a4a, 0.04, 0.008, [0, 0.13, 0.155], [0, 0, 0], PI, { outline: false });
    // Lighthouse
    const lh = k.group(cs, [0, 0.42, -0.03]);
    k.cyl(lh, 0xffffff, 0.05, 0.065, 0.22, [0, 0.11, 0], [0, 0, 0], 10);
    k.cyl(lh, 0xe8504a, 0.058, 0.062, 0.05, [0, 0.08, 0], [0, 0, 0], 10);
    k.cyl(lh, 0xe8504a, 0.052, 0.055, 0.04, [0, 0.17, 0], [0, 0, 0], 10);
    k.cyl(lh, 0x3a3a4a, 0.064, 0.064, 0.02, [0, 0.23, 0], [0, 0, 0], 10);
    k.glowSphere(lh, 0xfff2a0, 0.05, [0, 0.275, 0], 2.8);
    k.cone(lh, 0xe8504a, 0.07, 0.075, [0, 0.31, 0], [0, 0, 0], 10);
    k.sphere(lh, 0xe6b44a, 0.014, [0, 0.39, 0]);
    const beam = k.group(lh, [0, 0.275, 0]);
    const bg = new THREE.ConeGeometry(0.08, 0.5, 12, 1, true);
    bg.translate(0, -0.25, 0);
    k.glow(beam, bg, 0xfff2a0, 1.4, [0, 0, 0], [PI / 2, 0, 0], 0.3);
    c.spinners.push({ g: beam, speed: 1.6, axis: 'y' });
    // Coral, barnacles and swaying seaweed on the rock
    coral(k, cs, pink, 0.8, [bw * 0.62, 0.05, -bd * 0.35], [0, 0.5, -0.5]);
    coral(k, cs, pinkL, 0.7, [-bw * 0.62, 0.05, -bd * 0.45], [0, -0.5, 0.5]);
    coral(k, cs, pink, 0.6, [-bw * 0.5, 0.06, bd * 0.4], [0, 1.4, 0.3]);
    for (let i = 0; i < 5; i++) k.cone(cs, 0xf4ecd8, 0.02, 0.028, [Math.cos(i * 1.3) * bw * 0.6, 0.08, Math.sin(i * 1.3) * bd * 0.55], [0, 0, 0], 7);
    for (const [x, z, ph] of [
      [bw * 0.45, -bd * 0.62, 0],
      [-bw * 0.3, -bd * 0.7, 1.5],
      [bw * 0.7, bd * 0.2, 3],
    ] as [number, number, number][]) {
      const wg = k.group(cs, [x, 0.06, z]);
      c.tails.push({ g: wg, phase: ph, amp: 0.18, axis: 'x' });
      k.blade(wg, weed, 0.2, 0.05, 0.02, [0, 0, 0], [0.15, 0, 0.2]);
      k.blade(wg, 0x4ab07a, 0.15, 0.045, 0.02, [0.02, 0, 0.01], [-0.1, 0, -0.3]);
    }
  },

  // `lanternfish`
  lanternfish(k, c, s) {
    floater(c, 0.35);
    const col = 0x2a3f7a;
    const belly = 0x4d6bb0;
    const fin = 0x3d5ea8;
    const finL = 0x6f9ae0;
    const lamp = 0xfff2a0;
    const cold = 0x7ff0ff;
    const mouthC = 0x2a0c28;
    const L = [0.9, 1, 1.15][s - 1];
    const F = [0.8, 1.15, 1.45][s - 1];
    const body = k.group(c.body, [0, 0.42, 0]);
    c.head = body;

    /** A fin: length toward dir, the thin face's normal toward thin; at stage III there is an extra outer layer of cold-light fin membrane */
    const finAt = (parent: THREE.Object3D, pos: V3, dir: V3, thin: V3, len: number, wid: number, col2: C = fin) => {
      const g = aimPlane(k.group(parent, pos), dir, thin);
      k.blade(g, col2, len, wid, 0.035, [0, 0, 0]);
      if (s >= 2) {
        const gg = new THREE.SphereGeometry(0.5, 16, 10);
        gg.scale(wid * 1.2, len * 1.12, 0.02);
        gg.translate(0, len * 0.56, 0);
        k.glow(g, gg, s === 3 ? cold : finL, 1.4, [0, 0, 0], [0, 0, 0], 0.4);
      }
      return g;
    };
    /** Lantern lure: a feeler curving forward from the top of the head, with a glowing lamp ball hanging from the end */
    const lure = (pos: V3, rot: V3, len: number, r: number) => {
      const g = k.group(body, pos, rot);
      k.horn(g, col, 0.03, len, len * 0.55, [0, 0, 0]);
      const tip: V3 = [0, len * 0.98, -len * 0.55];
      k.cyl(g, 0x1a2a5a, 0.012, 0.012, 0.05, [tip[0], tip[1] - 0.02, tip[2]], [0, 0, 0], 6, { outline: false });
      k.glowSphere(g, lamp, r, [tip[0], tip[1] - 0.05 - r * 0.6, tip[2]], 2.8);
      k.glowSphere(g, lamp, r * 2.1, [tip[0], tip[1] - 0.05 - r * 0.6, tip[2]], 1.1, [1, 1, 1], 0.25);
      k.glowSphere(g, 0xffffff, r * 0.3, [tip[0] - r * 0.3, tip[1] - 0.05 - r * 0.3, tip[2] + r * 0.5], 3);
      c.tails.push({ g, phase: pos[0] * 5, amp: 0.08, axis: 'x' });
      return g;
    };

    // Big head and body: a revolved profile wide at the front and narrow at the back (axis along z), a light-blue belly
    const prof: [number, number][] = [
      [0.001, -0.5 * L],
      [0.07, -0.48 * L],
      [0.13, -0.36 * L],
      [0.24, -0.2 * L],
      [0.32, -0.04 * L],
      [0.35, 0.1],
      [0.33, 0.24],
      [0.24, 0.34],
      [0.12, 0.39],
      [0.001, 0.4],
    ];
    const bg = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 28);
    bg.rotateX(PI / 2);
    bg.scale(1, 0.92, 1);
    k.mesh(body, bg, col);
    k.sphere(body, belly, 1, [0, -0.13, 0.06], [0.27, 0.2, 0.3], [0, 0, 0], { outline: false });
    // Big mouth and small sharp teeth: an open mouth, a jaw jutting forward
    k.sphere(body, mouthC, 1, [0, -0.08, 0.3], [0.26, 0.11, 0.14], [0, 0, 0], { outline: false });
    k.sphere(body, col, 1, [0, -0.2, 0.27], [0.28, 0.085, 0.2]);
    k.sphere(body, belly, 1, [0, -0.22, 0.3], [0.2, 0.05, 0.14], [0, 0, 0], { outline: false });
    for (let i = -2; i <= 2; i++) k.cone(body, 0xffffff, 0.022, 0.06, [i * 0.09, 0.0, 0.4 - Math.abs(i) * 0.03], [PI, 0, 0], 5, { outline: false });
    for (const i of [-1.5, 1.5]) k.cone(body, 0xffffff, 0.02, 0.05, [i * 0.1, -0.17, 0.42], [0, 0, 0], 5, { outline: false });
    // Eyes (the juvenile's eyes are bigger)
    faceEyes(k, body, [0.34, 0.31, 0.41], { x: 0.16, y: 0.1, r: [0.11, 0.1, 0.095][s - 1], iris: 0x4ad0ff, yaw: 0.22 });
    k.blush(body, 0.27, -0.04, 0.24, 0.04, 0xa070c0);
    if (s === 3) for (const sx of [-1, 1]) k.cone(body, 0x101a3a, 0.012, 0.06, [sx * 0.29, 0.2, 0.22], [0.3, 0, -sx * 1.2], 5, { outline: false });
    // Lantern lure
    lure([0, 0.27, 0.12], [0.35, PI, 0], 0.42 * (s === 1 ? 0.9 : 1), s === 1 ? 0.06 : 0.07);
    if (s === 3) for (const sx of [-1, 1]) lure([sx * 0.24, 0.2, 0.0], [0.45, PI, -sx * 1.1], 0.34, 0.05);
    // Fins: pectoral fins (they sway), dorsal fin, pelvic fins, tail fin
    for (const sx of [-1, 1]) {
      const pg = k.group(body, [sx * 0.3, -0.04, 0.04]);
      finAt(pg, [0, 0, 0], [sx * 0.85, -0.25, -0.45], [0, 1, 0], 0.22 * F, 0.13 * F);
      c.wings.push({ g: pg, side: -sx, base: 0.25, amp: 0.25, speed: 2.5 });
    }
    finAt(body, [0, 0.24, -0.14 * L], [0, 1, -0.55], [1, 0, 0], 0.16 * F, 0.12 * F);
    for (const sx of [-1, 1]) finAt(body, [sx * 0.12, -0.22, -0.16 * L], [sx * 0.3, -0.9, -0.4], [0, 0, 1], 0.1 * F, 0.06 * F);
    const tail = k.group(body, [0, 0, -0.48 * L]);
    for (const up of [0.55, 0, -0.55]) finAt(tail, [0, 0, 0], [0, up, -1], [1, 0, 0], (up ? 0.22 : 0.26) * F, 0.12 * F, up ? fin : finL);
    c.tails.push({ g: tail, phase: 0, amp: 0.25, axis: 'y' });

    if (s >= 2) {
      // Glowing spots on the body
      const spots = s === 2 ? 5 : 8;
      for (const sx of [-1, 1]) {
        for (let i = 0; i < spots; i++) {
          const th = 0.6 + (i % 3) * 0.3;
          const ph = -0.3 - i * (1.7 / spots);
          const p = onEll(0.35, 0.31, 0.44 * L, th, ph);
          k.glowSphere(body, s === 2 ? 0xbff8ff : cold, 0.02 + (i % 2) * 0.008, [p[0] * sx, p[1], p[2]], 2.4);
        }
      }
    }
    if (s === 3) {
      // Cold-light markings over the whole body: two lines of light along the flank, glowing barbels on the chin, a ring of halo around the body
      for (const sx of [-1, 1]) {
        for (const th of [1.0, 1.35]) {
          const pts: V3[] = [];
          for (let j = 0; j <= 6; j++) {
            const ph = -0.2 - (j / 6) * 2.3;
            const p = onEll(0.355, 0.315, 0.45 * L, th + Math.sin(j * 1.3) * 0.12, ph);
            pts.push([p[0] * sx, p[1], p[2]]);
          }
          k.glow(body, tubeGeo(curveOf(pts), (t) => 0.009 * Math.sin(Math.max(0.05, Math.min(0.95, t)) * PI) + 0.003, 24, 6), cold, 2.0);
        }
        const wg = k.group(body, [sx * 0.14, -0.27, 0.26], [0.9, 0, sx * 0.5]);
        k.horn(wg, fin, 0.014, 0.14, 0.05, [0, 0, 0], [PI, 0, 0]);
        k.glowSphere(wg, cold, 0.024, [0, -0.14, -0.04], 2.6);
        c.tails.push({ g: wg, phase: sx, amp: 0.12, axis: 'x' });
      }
      const aura = k.glow(body, new THREE.TorusGeometry(0.58, 0.01, 6, 56), cold, 1.5, [0, -0.05, 0], [PI / 2, 0, 0], 0.4);
      c.spinners.push({ g: aura, speed: 0.5, axis: 'z' });
      for (let i = 0; i < 5; i++) sparkle(k, c, c.body, i % 2 ? cold : lamp, 0.02, [Math.cos(i * 1.3) * 0.6, 0.25 + i * 0.12, Math.sin(i * 1.3) * 0.45], 0.08);
    }
  },

  // `swordfish`
  swordfish(k, c, s) {
    floater(c, 0.42);
    const back = 0x1f5a9a;
    const backD = 0x164a84;
    const belly = 0xe4ebf4;
    const fin = 0x2a6cb2;
    const gold = 0xffc94a;
    const edge = 0x8ff4ff;
    const L = [0.78, 0.95, 1.1][s - 1];
    const F = [0.85, 1.05, 1.2][s - 1];
    const body = k.group(c.body, [0, 0.34, 0]);
    c.head = body;

    /** A revolved profile along the z axis (one half); y points up after rotateX; phiStart π/2 is the back half and −π/2 the belly half */
    const half = (prof: [number, number][], phiStart: number, col: C) => {
      const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 16, phiStart, PI);
      g.rotateX(PI / 2);
      return k.mesh(body, g, col);
    };
    /** Fin: length toward dir, the thin face's normal toward thin; from II there is an extra gold edge on the outer ring, and III adds cold light */
    const finAt = (parent: THREE.Object3D, pos: V3, dir: V3, thin: V3, len: number, wid: number) => {
      const g = aimPlane(k.group(parent, pos), dir, thin);
      if (s >= 2) k.blade(g, gold, len * 1.12, wid * 1.3, 0.024, [0, -len * 0.04, 0]);
      k.blade(g, fin, len, wid, 0.034, [0, 0, 0]);
      return g;
    };

    // Streamlined body: dark-blue back, silver-white belly
    const prof: [number, number][] = [
      [0.001, -0.55 * L],
      [0.045, -0.5 * L],
      [0.07, -0.42 * L],
      [0.13, -0.28 * L],
      [0.185, -0.1 * L],
      [0.2, 0.06 * L],
      [0.17, 0.24 * L],
      [0.1, 0.38 * L],
      [0.04, 0.45 * L],
      [0.001, 0.46 * L],
    ];
    half(prof, PI / 2, back);
    half(prof, -PI / 2, belly);
    // Gill lines on the side of the head, and the eyes
    for (const sx of [-1, 1]) k.torus(body, backD, 0.06, 0.008, [sx * 0.165, 0.0, 0.22 * L], [0, sx * PI * 0.5, 0], PI, { outline: false });
    faceEyes(k, body, [0.2, 0.2, 0.46 * L], { x: 0.12, y: 0.05, r: [0.08, 0.075, 0.068][s - 1], iris: 0x163a6e, yaw: 0.5, sharp: s === 3 });
    k.torus(body, 0x163050, 0.045, 0.009, [0, -0.07, 0.4 * L], [0.3, 0, PI], PI, { outline: false });
    // Sword bill: glows at III
    const swordLen = [0.28, 0.42, 0.56][s - 1];
    const noseZ = 0.45 * L;
    if (s < 3) {
      k.cone(body, 0x2a4f80, 0.032, swordLen, [0, 0.01, noseZ], [PI / 2, 0, 0], 10);
    } else {
      const bg = new THREE.ConeGeometry(0.036, swordLen, 10);
      bg.translate(0, swordLen / 2, 0);
      k.glow(body, bg, edge, 2.0, [0, 0.01, noseZ], [PI / 2, 0, 0]);
      const core = new THREE.ConeGeometry(0.016, swordLen * 0.92, 8);
      core.translate(0, swordLen * 0.46, 0);
      k.glow(body, core, 0xffffff, 2.6, [0, 0.01, noseZ], [PI / 2, 0, 0]);
      k.glowSphere(body, edge, 0.07, [0, 0.01, noseZ + 0.03], 1.3, [1, 1, 1.4], 0.35);
    }
    // Sail-like dorsal fin: tall and swept back, with fin rays on the fin face; gold-edged from II
    const sailH = [0.26, 0.36, 0.44][s - 1];
    const sail: [number, number][] = [
      [0.18 * L, 0],
      [0.15 * L, sailH * 0.45],
      [0.06 * L, sailH * 0.88],
      [-0.08 * L, sailH],
      [-0.22 * L, sailH * 0.82],
      [-0.33 * L, sailH * 0.42],
      [-0.36 * L, 0],
    ];
    const sailGeo = (sc: number, thick: number) => {
      const sh = new THREE.Shape();
      sail.forEach(([x, y], i) => (i ? sh.lineTo(x * sc, y * sc) : sh.moveTo(x * sc, y * sc)));
      sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false });
      g.translate(0, 0, -thick / 2);
      return g;
    };
    const sailG = k.group(body, [0, 0.14, 0.02], [0, -PI / 2, 0]);
    if (s >= 2) slab(k, sailG, sailGeo(1.08, 0.022), gold, [-0.02 * L, -0.01, 0]);
    slab(k, sailG, sailGeo(1, 0.03), fin);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x0 = 0.15 * L - t * 0.44 * L;
      const h = sailH * (0.92 - Math.abs(t - 0.5) * 1.0);
      k.mesh(sailG, new THREE.BoxGeometry(0.008, h, 0.006), backD, [x0 - (0.08 * L * h) / sailH, h * 0.5 + 0.02, 0.018], [0, 0, 0.3], { outline: false });
    }
    if (s === 3) k.glow(sailG, sailGeo(1.14, 0.01), edge, 1.2, [-0.03 * L, -0.015, 0], [0, 0, 0], 0.35);
    c.tails.push({ g: sailG, phase: 0.5, amp: 0.05, axis: 'x' });
    // Pectoral fins (they sway), pelvic fins, second dorsal fin, anal fin
    for (const sx of [-1, 1]) {
      const pg = k.group(body, [sx * 0.17, -0.06, 0.12 * L]);
      finAt(pg, [0, 0, 0], [sx * 0.85, -0.3, -0.65], [0, 1, 0], 0.3 * F, 0.09 * F);
      c.wings.push({ g: pg, side: -sx, base: 0.2, amp: 0.15, speed: 2 });
    }
    for (const sx of [-1, 1]) finAt(body, [sx * 0.08, -0.16, -0.02 * L], [sx * 0.25, -0.8, -0.6], [0, 0, 1], 0.12 * F, 0.05 * F);
    finAt(body, [0, 0.1, -0.36 * L], [0, 0.8, -0.7], [1, 0, 0], 0.1 * F, 0.05 * F);
    finAt(body, [0, -0.1, -0.36 * L], [0, -0.8, -0.7], [1, 0, 0], 0.1 * F, 0.05 * F);
    // Crescent tail fin
    const tail = k.group(body, [0, 0, -0.53 * L]);
    k.sphere(tail, back, 0.05, [0, 0, 0], [0.8, 1, 1.2]);
    for (const up of [1, -1]) finAt(tail, [0, 0, -0.02], [0, up * 0.85, -0.55], [1, 0, 0], 0.34 * F, 0.1 * F);
    c.tails.push({ g: tail, phase: 0, amp: 0.25, axis: 'y' });

    if (s >= 2) {
      // Armor-like gold rings and lateral line
      k.torus(body, gold, 0.19, 0.016, [0, 0, 0.16 * L], [0, 0, 0]).scale.set(1, 1, 0.8);
      for (const sx of [-1, 1]) {
        const pts: V3[] = [];
        for (let j = 0; j <= 5; j++) {
          const t = j / 5;
          const z = 0.12 * L - t * 0.5 * L;
          const r = 0.2 * Math.sqrt(Math.max(0.05, 1 - ((z / L + 0.05) / 0.5) ** 2));
          pts.push([sx * r * 1.01, -0.01, z]);
        }
        k.mesh(body, tubeGeo(curveOf(pts), () => 0.008, 12, 5), gold, [0, 0, 0], [0, 0, 0], { outline: false });
      }
    }
    if (s === 3) {
      // Orbiting wave ribbons: two translucent cyan-white light ribbons carrying small waves
      for (let i = 0; i < 2; i++) {
        const g = k.group(c.body, [0, 0.34, -0.02], [PI / 2 + (i ? -0.4 : 0.3), 0, 0]);
        const pts: V3[] = [];
        const R0 = 0.62 + i * 0.1;
        for (let j = 0; j <= 14; j++) {
          const a = (j / 14) * PI * 1.3;
          pts.push([Math.cos(a) * R0, Math.sin(a) * R0, Math.sin(a * 4) * 0.04]);
        }
        const geo = tubeGeo(curveOf(pts), (t) => 0.02 * Math.sin(Math.max(0.05, t) * PI) + 0.003, 40, 6);
        geo.scale(1, 1, 2.2);
        k.glow(g, geo, i ? 0xbff8ff : edge, 1.3, [0, 0, 0], [0, 0, 0], 0.7);
        for (let j = 0; j < 3; j++) {
          const a = (0.3 + j * 0.4) * PI;
          k.glowSphere(g, 0xffffff, 0.026 - j * 0.004, [Math.cos(a) * R0, Math.sin(a) * R0, 0.03], 2.2);
        }
        c.spinners.push({ g, speed: i ? -1.3 : 1.0, axis: 'z' });
      }
      for (let i = 0; i < 4; i++) sparkle(k, c, c.body, i % 2 ? edge : 0xffffff, 0.018, [Math.cos(i * 1.6) * 0.5, 0.2 + i * 0.12, Math.sin(i * 1.6) * 0.4], 0.07);
    }
  },

  // `siren` (single form)
  siren(k, c) {
    floater(c, 0.24);
    const deep = 0x3a3f8a;
    const teal = 0x3ab8a8;
    const band = 0x2a2460;
    const hair = 0x7fe0d0;
    const hairD = 0x4fc4b8;
    const face = 0xc8ccf6;
    const pale = 0xb4c0f4;
    const coralC = 0xff8f7a;
    const violet = 0xb890ff;
    const noteC = 0x9ff4ff;

    // Ripples on the water surface (put in pose, so they do not bob with the hovering)
    const rip1 = k.glow(c.pose, new THREE.TorusGeometry(0.42, 0.009, 6, 48), noteC, 1.6, [0, 0.02, 0], [PI / 2, 0, 0], 0.5);
    const rip2 = k.glow(c.pose, new THREE.TorusGeometry(0.58, 0.006, 6, 56), noteC, 1.3, [0, 0.02, 0], [PI / 2, 0, 0], 0.3);
    c.spinners.push({ g: rip1, speed: 0.5, axis: 'z' }, { g: rip2, speed: -0.35, axis: 'z' });

    // Sea-snake-like body: from the neck down and back, circling once and then curling the tail up; a gradient from deep purple-blue to blue-green
    const path: V3[] = [
      [0, 1.0, 0.0],
      [0, 0.82, 0.04],
      [0.02, 0.64, 0.02],
      [0.1, 0.46, -0.08],
      [0.12, 0.3, -0.26],
      [-0.08, 0.18, -0.36],
      [-0.3, 0.14, -0.2],
      [-0.34, 0.14, 0.08],
      [-0.18, 0.17, 0.3],
      [0.1, 0.2, 0.36],
      [0.3, 0.26, 0.24],
      [0.38, 0.36, 0.06],
    ];
    const rad = (t: number) => 0.035 + 0.135 * Math.pow(1 - t, 0.9);
    const cols = [deep, mix(deep, teal, 0.22), mix(deep, teal, 0.45), mix(deep, teal, 0.68), mix(deep, teal, 0.86), teal];
    const curve = gradientTube(k, c.body, cols, path, rad);
    /** The point at t on the curve, its tangent, and the "back" direction (up and behind) */
    const at = (t: number) => {
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t);
      const back = new THREE.Vector3(0, 0.25, -1);
      const n = back.sub(tg.clone().multiplyScalar(tg.dot(back))).normalize();
      return { p, tg, n, r: rad(t) };
    };
    // Pale belly plates on the chest
    k.sphere(c.body, pale, 1, [0, 0.8, 0.1], [0.1, 0.2, 0.08], [0, 0, 0], { outline: false });
    // Dark ring markings on the tail
    for (const t of [0.5, 0.61, 0.72, 0.83]) {
      const { p, tg, r } = at(t);
      const g = aim(k.group(c.body, [p.x, p.y, p.z]), [tg.x, tg.y, tg.z]);
      k.torus(g, band, r * 1.0, 0.014, [0, 0, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    }
    // Dorsal fin: translucent glowing fin membrane laid out along the spine
    for (const t of [0.04, 0.15, 0.27, 0.39]) {
      const { p, n, r } = at(t);
      const g = aim(k.group(c.body, [p.x + n.x * r * 0.8, p.y + n.y * r * 0.8, p.z + n.z * r * 0.8]), [n.x, n.y, n.z]);
      k.mesh(g, petalGeo(0.09 + r * 0.4, 0.07, { thick: 0.016, curl: -0.03 }), hairD, [0, 0, 0], [0, 0, 0], { outline: false });
      k.glow(g, petalGeo(0.2 + r * 0.9, 0.13, { curl: -0.08, thick: 0.01 }), hair, 1.5, [0, 0, 0], [0, 0, 0], 0.7);
    }
    // Tail fin: three long fanned fins, glowing at the ends
    {
      const { p, tg } = at(1);
      const tf = aim(k.group(c.body, [p.x, p.y, p.z]), [tg.x, tg.y, tg.z]);
      for (const [yaw, len, col] of [
        [-0.7, 0.28, hairD],
        [0, 0.36, hair],
        [0.7, 0.28, hairD],
      ] as [number, number, number][])
        petal(k, tf, col, len, 0.12, [0, 0, 0], yaw + PI / 2, 0.35, { curl: 0.1, cup: 0.03, thick: 0.022 });
      k.glowSphere(tf, hair, 0.025, [0, 0.02, 0], 2.2);
      c.tails.push({ g: tf, phase: 0, amp: 0.2, axis: 'z' });
    }
    // Pectoral fins: two small swept-back fins that sway gently
    for (const sx of [-1, 1]) {
      const fg = k.group(c.body, [sx * 0.14, 0.74, -0.04], [0.9, 0, -sx * 2.4]);
      sweptFin(k, fg, hair, 0.18, 0.11, 0.025, 0.8, [0, 0, 0], [0, 0, 0]);
      c.wings.push({ g: fg, side: -sx, base: 2.4, amp: 0.12, speed: 2 });
    }

    // Head: a deep-blue head, a pale purple face, glowing blue-green eyes, lashes, a smile
    const head = k.group(c.body, [0, 1.13, 0.02]);
    c.head = head;
    const hr = 0.21;
    k.sphere(head, deep, hr, [0, 0, 0], [1.02, 1, 0.98]);
    k.sphere(head, face, 1, [0, -0.05, 0.075], [0.15, 0.15, 0.135], [0, 0, 0], { outline: false });
    k.eyes(head, { x: 0.085, y: 0.0, z: 0.185, r: 0.076, iris: 0x2fd8c8, yaw: 0.3 });
    for (const sx of [-1, 1]) {
      k.cone(head, 0x1a1a3a, 0.011, 0.055, [sx * 0.16, 0.07, 0.145], [0.4, 0, -sx * 1.15], 5, { outline: false });
      k.cone(head, 0x1a1a3a, 0.009, 0.04, [sx * 0.165, 0.035, 0.15], [0.3, 0, -sx * 1.45], 5, { outline: false });
    }
    smile(k, head, 0x2a1a3a, 0.02, [0, -0.095, 0.2], [0.3, 0, 0]);
    k.blush(head, 0.14, -0.06, 0.16, 0.036, 0xff9ac8);
    // Pearl hair ornament on the brow
    for (const [x, y] of [
      [0, 0.15],
      [-0.09, 0.135],
      [0.09, 0.135],
    ] as [number, number][])
      k.glowSphere(head, 0xfff4ec, x === 0 ? 0.022 : 0.016, [x, y, Math.sqrt(Math.max(0.01, hr * hr - x * x - y * y)) + 0.004], 1.8);
    // Fan-shaped fin hair: one fan on each side and a long fin sweeping back from the top of the head, all swaying
    for (const sx of [-1, 1]) {
      const ef = k.group(head, [sx * 0.17, 0.06, -0.04]);
      for (let i = 0; i < 4; i++) {
        const tilt = 0.45 + i * 0.3;
        petal(k, ef, i % 2 ? hairD : hair, 0.34 - i * 0.03, 0.1, [0, 0, 0], sx * PI * 0.5, PI - tilt, { curl: 0.08, cup: 0.02, thick: 0.02 });
      }
      c.ears.push({ g: ef, phase: sx * 1.4 });
      c.tails.push({ g: ef, phase: sx * 0.9, amp: 0.05, axis: 'z' });
    }
    const mane = k.group(head, [0, 0.12, -0.1]);
    for (let i = 0; i < 5; i++) {
      const yaw = PI + (i - 2) * 0.4;
      petal(k, mane, i % 2 ? hairD : hair, 0.62 - Math.abs(i - 2) * 0.08, 0.14, [Math.sin(yaw) * 0.07, 0, Math.cos(yaw) * 0.07 + 0.02], yaw, PI - 0.55 - Math.abs(i - 2) * 0.12, { curl: 0.14, cup: 0.03, thick: 0.022 });
    }
    k.sphere(head, hair, 1, [0, 0.06, -0.08], [0.21, 0.17, 0.2]);
    // Crest fin on the top of the head: a tall swept-back fin, with a translucent glowing fin membrane on the outer ring
    sweptFin(k, head, hairD, 0.2, 0.34, 0.03, 1.3, [0, 0.16, -0.02], [-0.2, 0, 0]);
    k.glow(head, petalGeo(0.3, 0.16, { curl: -0.14, thick: 0.01 }), hair, 1.5, [0, 0.17, 0.02], [-0.5, 0, 0], 0.55);
    c.tails.push({ g: mane, phase: 0, amp: 0.06, axis: 'x' });

    // Arms hugging a coral harp: the right hand plucks the strings, the left hand holds up the harp
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(sx > 0 ? -0.63 : -0.43, 0, -sx * 0.17);
      const g = k.group(c.body, [sx * 0.16, 0.93, 0.03], [base.x, base.y, base.z]);
      k.sphere(g, deep, 0.055, [0, 0, 0]);
      k.capsule(g, deep, 0.036, 0.16, [0, -0.11, 0]);
      k.sphere(g, face, 0.042, [0, -0.23, 0]);
      c.arms.push({ g, side: sx, base });
    }
    const harp = k.group(c.body, [0.02, 0.5, 0.23], [0.12, 0.25, 0.08]);
    harp.scale.setScalar(1.25);
    k.cyl(harp, coralC, 0.022, 0.026, 0.26, [0, 0, 0], [0, 0, PI / 2], 10);
    k.sphere(harp, coralC, 0.04, [-0.13, 0, 0]);
    k.sphere(harp, coralC, 0.04, [0.13, 0, 0]);
    for (const sx of [-1, 1]) k.horn(harp, coralC, 0.024, 0.32, 0.09, [sx * 0.13, 0.0, 0], [0, sx * PI * 0.5, 0]);
    k.cyl(harp, coralC, 0.018, 0.018, 0.2, [0, 0.31, -0.05], [0, 0, PI / 2], 10);
    for (let i = 0; i < 6; i++) {
      const x = -0.08 + (i / 5) * 0.16;
      k.glow(harp, new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4), 0xfff4d0, 2.2, [x, 0.155, -0.02], [0, 0, 0]);
    }
    coral(k, harp, 0xff9ec0, 0.32, [-0.15, 0.2, 0.0], [0, 0, 0.5]);
    coral(k, harp, 0xffb8d2, 0.26, [0.15, 0.24, 0.0], [0, 0, -0.55]);
    k.glowSphere(harp, 0xfff8f0, 0.024, [0, 0.31, -0.05], 1.8);
    k.glowSphere(harp, 0xfff8f0, 0.016, [-0.12, 0.28, -0.03], 1.6);

    // Musical-note motes floating nearby: a ring circling the head, a few more scattered at its side
    const orbit = k.group(c.body, [0, 1.05, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      note(k, c, orbit, i % 2 ? violet : noteC, 0.034, [Math.sin(a) * 0.55, (i % 2) * 0.12, Math.cos(a) * 0.5]);
    }
    c.spinners.push({ g: orbit, speed: 0.6, axis: 'y' });
    note(k, c, c.body, noteC, 0.03, [0.42, 0.62, 0.3]);
    note(k, c, c.body, violet, 0.028, [-0.45, 0.5, 0.2], -0.2);
    // Dreamlike purple thin mist and water light
    for (let i = 0; i < 3; i++) {
      const m = k.glowSphere(c.body, violet, 0.07 + i * 0.01, [Math.cos(i * 2.1) * 0.35, 0.22 + i * 0.05, Math.sin(i * 2.1) * 0.3], 1.2, [1.3, 0.7, 1.3], 0.3);
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.03, speed: 1.1 + i * 0.3, phase: i * 2 });
    }
    for (let i = 0; i < 4; i++) sparkle(k, c, c.body, i % 2 ? 0xbff8ff : violet, 0.02, [Math.cos(i * 1.6) * 0.5, 0.45 + i * 0.22, Math.sin(i * 1.6) * 0.4], 0.06);
  },

  // `springlotus`
  springlotus(k, c, s) {
    const blue = 0x7cc6ea;
    const blueL = 0xc4e8f8;
    const blueD = 0x4f9fd0;
    const bud = 0xa8dd80;
    const leaf = 0x7ccd5c;
    const leafD = 0x4f9e4a;
    const spring = 0x8fe8ff;
    const iris = 0x2f9ac4;
    const mouth = 0x3a7a72;
    const skin = 0xf6f3e6;
    const hair = 0x62c8ea;
    const hairL = 0xa8e6f8;
    const gold = 0xffe08a;

    /** Leaf arm: a single leaf lobe, hung on parent and registered as an arm */
    const leafArm = (parent: THREE.Object3D, sx: number, pos: V3, len: number, wid: number) => {
      const base = new THREE.Euler(-0.5, 0, -sx * 2.5);
      const g = k.group(parent, pos, [base.x, base.y, base.z]);
      slab(k, g, petalGeo(len, wid, { curl: 0.05, cup: 0.03 }), leaf);
      k.mesh(g, new THREE.BoxGeometry(0.005, len * 0.7, 0.004), leafD, [0, len * 0.42, 0.012], [0, 0, 0], { outline: false });
      c.arms.push({ g, side: sx, base });
    };

    if (s === 1) {
      // I: a closed drop-shaped bud sitting on a lotus leaf, the front petals parting to reveal a round face, a drop of spring water poking out of the bud tip
      c.archetype = 'crawl';
      lilyPad(k, c.body, 0.4, [0, 0, 0.02], leaf, leafD);
      k.glow(c.body, new THREE.TorusGeometry(0.28, 0.008, 6, 40), spring, 1.6, [0, 0.045, 0], [PI / 2, 0, 0], 0.55);
      const head = k.group(c.body, [0, 0.04, 0]);
      c.head = head;
      const prof: [number, number][] = [
        [0.001, 0],
        [0.13, 0.01],
        [0.21, 0.09],
        [0.24, 0.24],
        [0.22, 0.4],
        [0.16, 0.52],
        [0.09, 0.6],
        [0.05, 0.63],
      ];
      k.lathe(head, blue, prof);
      // Petal seams: thin lines along the bud surface
      const curveP = new THREE.CatmullRomCurve3(prof.map(([x, y]) => new THREE.Vector3(x, y, 0)));
      for (let i = 0; i < 6; i++) {
        const a = PI * 0.42 + (i / 5) * PI * 1.16;
        const pts: V3[] = [];
        for (let j = 0; j <= 8; j++) {
          const p = curveP.getPoint(0.12 + (j / 8) * 0.82);
          pts.push([Math.sin(a) * p.x * 1.02, p.y, Math.cos(a) * p.x * 1.02]);
        }
        k.mesh(head, tubeGeo(curveOf(pts), () => 0.009, 12, 6), blueD, [0, 0, 0], [0, 0, 0], { outline: false });
      }
      // The round face peeking out
      const core = k.group(head, [0, 0.28, 0.1]);
      const rad: V3 = [0.17, 0.17, 0.16];
      k.sphere(core, bud, 1, [0, 0, 0], rad);
      faceEyes(k, core, rad, { x: 0.068, y: 0.015, r: 0.056, iris });
      k.blush(core, 0.125, -0.045, 0.11, 0.032);
      smile(k, core, mouth, 0.02, [0, -0.065, 0.15], [0.3, 0, 0]);
      // Two parted front petals framing the face
      for (const sx of [-1, 1]) {
        petal(k, head, blueL, 0.32, 0.2, [sx * 0.14, 0.08, 0.13], sx * PI * 0.34, 0.5, { bulge: 0.05, cup: 0.07, curl: 0.03, thick: 0.024 });
      }
      // Spring water and a sprout at the bud tip
      waterDrop(k, c, head, 0.045, [0, 0.59, 0], { bob: 0.012 });
      k.cyl(head, leafD, 0.008, 0.01, 0.07, [0.05, 0.63, -0.03], [0.25, 0, -0.35], 6, { outline: false });
      petal(k, head, leaf, 0.1, 0.055, [0.07, 0.68, -0.04], 1.2, 1.15, { curl: 0.03 });
      petal(k, head, leaf, 0.08, 0.045, [0.06, 0.67, -0.04], -1.6, 1.2, { curl: 0.03 });
      // Leaf arms
      for (const sx of [-1, 1]) leafArm(head, sx, [sx * 0.2, 0.22, 0.1], 0.17, 0.09);
      // Dewdrops on the lotus leaf
      for (const [x, z] of [
        [0.3, 0.14],
        [-0.28, -0.12],
      ] as [number, number][])
        waterDrop(k, c, c.body, 0.022, [x, 0.04, z], { bob: 0.01, shell: 0 });
      return;
    }

    if (s === 2) {
      // II: the petals half open into a cup cradling the round face, a larger spring-water drop and water ring floating at the heart of the flower, a second bud sprouting beside it
      c.archetype = 'crawl';
      lilyPad(k, c.body, 0.48, [0, 0, 0.03], leaf, leafD);
      lilyPad(k, c.body, 0.2, [-0.42, 0.002, -0.28], mix(leaf, leafD, 0.3), leafD, 2.4, 0.03);
      k.glow(c.body, new THREE.TorusGeometry(0.34, 0.008, 6, 44), spring, 1.6, [0, 0.045, 0], [PI / 2, 0, 0], 0.55);
      const head = k.group(c.body, [0, 0.4, 0]);
      c.head = head;
      // Receptacle
      k.lathe(head, bud, [
        [0.001, -0.36],
        [0.13, -0.35],
        [0.2, -0.28],
        [0.22, -0.16],
        [0.19, -0.06],
        [0.001, -0.04],
      ]);
      const rad: V3 = [0.24, 0.24, 0.22];
      k.sphere(head, bud, 1, [0, 0, 0], rad);
      faceEyes(k, head, rad, { x: 0.095, y: 0.02, r: 0.074, iris });
      k.blush(head, 0.175, -0.06, 0.15, 0.042);
      smile(k, head, mouth, 0.027, [0, -0.09, 0.205], [0.28, 0, 0]);
      // Outer six petals (an opening left at the front)
      for (let i = 0; i < 6; i++) {
        const a = PI * 0.33 + (i / 5) * PI * 1.34;
        petal(k, head, i % 2 ? blue : mix(blue, blueL, 0.3), 0.5, 0.34, [Math.sin(a) * 0.2, -0.26, Math.cos(a) * 0.2], a, 0.6, { bulge: 0.03, cup: 0.08, curl: 0.06, thick: 0.024 });
      }
      // Inner four petals
      for (let i = 0; i < 4; i++) {
        const a = PI * 0.55 + (i / 3) * PI * 0.9;
        petal(k, head, blueL, 0.42, 0.26, [Math.sin(a) * 0.13, -0.2, Math.cos(a) * 0.13], a, 0.3, { bulge: 0.04, cup: 0.05, thick: 0.022 });
      }
      // Two flattened collar petals at the front
      for (const sx of [-1, 1]) {
        const a = sx * PI * 0.2;
        petal(k, head, blueL, 0.36, 0.28, [Math.sin(a) * 0.2, -0.28, Math.cos(a) * 0.2], a, 1.15, { cup: 0.06, curl: 0.05, thick: 0.024 });
      }
      // Flower heart: golden stamens around the floating spring water, with a turning water ring on the outside
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        k.sphere(head, gold, 0.018, [Math.sin(a) * 0.09, 0.235, Math.cos(a) * 0.09], [1, 1.3, 1], [0, 0, 0], { outline: false });
      }
      waterDrop(k, c, head, 0.075, [0, 0.27, 0], { bob: 0.018 });
      const ring = k.group(head, [0, 0.36, 0], [0.35, 0, 0]);
      k.glow(ring, new THREE.TorusGeometry(0.14, 0.007, 6, 40), spring, 2, [0, 0, 0], [PI / 2, 0, 0], 0.85);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2;
        k.glow(ring, dropGeo(0.02), spring, 2.4, [Math.sin(a) * 0.14, -0.01, Math.cos(a) * 0.14]);
      }
      c.spinners.push({ g: ring, speed: 1.4, axis: 'y' });
      // Small water droplets welling up like a fountain
      for (let i = 0; i < 3; i++) waterDrop(k, c, head, 0.016, [Math.cos(i * 2.1) * 0.08, 0.46 + i * 0.05, Math.sin(i * 2.1) * 0.08], { bob: 0.04, shell: 0 });
      // Leaf arms
      for (const sx of [-1, 1]) leafArm(head, sx, [sx * 0.23, -0.04, 0.1], 0.24, 0.12);
      // The second bud sprouting beside it
      const stem = k.group(c.body, [0.3, 0.03, -0.24], [0.2, 0, -0.35]);
      k.cyl(stem, leafD, 0.014, 0.02, 0.56, [0, 0.28, 0], [0, 0, 0], 8);
      const b2 = k.group(stem, [0, 0.58, 0]);
      k.lathe(b2, blue, [
        [0.001, 0],
        [0.05, 0.005],
        [0.07, 0.05],
        [0.055, 0.12],
        [0.02, 0.18],
        [0.001, 0.19],
      ]);
      k.sphere(b2, bud, 0.05, [0, 0.0, 0], [1.1, 0.5, 1.1]);
      c.tails.push({ g: stem, phase: 1, amp: 0.05, axis: 'z' });
      for (const [x, z] of [
        [0.36, 0.2],
        [-0.34, 0.16],
      ] as [number, number][])
        waterDrop(k, c, c.body, 0.024, [x, 0.045, z], { bob: 0.012, shell: 0 });
      return;
    }

    // III: `springlotus`, a maiden floating on the spring's lotus leaf, a petal skirt, water-like hair, a crown of water droplets on her head
    floater(c, 0.14);
    lilyPad(k, c.pose, 0.42, [0, 0, 0.03], leaf, leafD);
    const rip1 = k.glow(c.pose, new THREE.TorusGeometry(0.3, 0.009, 6, 44), spring, 1.7, [0, 0.05, 0], [PI / 2, 0, 0], 0.6);
    const rip2 = k.glow(c.pose, new THREE.TorusGeometry(0.4, 0.006, 6, 48), spring, 1.4, [0, 0.05, 0], [PI / 2, 0, 0], 0.35);
    c.spinners.push({ g: rip1, speed: 0.6, axis: 'z' }, { g: rip2, speed: -0.4, axis: 'z' });
    // Skirt: a narrow inner bell-shaped lining + two layers of drooping petals
    const waist = 0.5;
    k.lathe(c.body, mix(bud, blueL, 0.5), [
      [0.001, 0.05],
      [0.2, 0.06],
      [0.24, 0.12],
      [0.2, 0.3],
      [0.13, waist - 0.04],
      [0.11, waist],
      [0.001, waist + 0.02],
    ]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2 + PI / 7;
      petal(k, c.body, i % 2 ? blue : mix(blue, blueL, 0.3), 0.52, 0.3, [Math.sin(a) * 0.11, waist, Math.cos(a) * 0.11], a, PI - 0.4, { curl: 0.12, cup: 0.06, thick: 0.028 });
      const b = a + PI / 7;
      petal(k, c.body, blueL, 0.44, 0.24, [Math.sin(b) * 0.1, waist + 0.02, Math.cos(b) * 0.1], b, PI - 0.28, { curl: 0.08, cup: 0.05, thick: 0.024 });
    }
    k.torus(c.body, leafD, 0.125, 0.022, [0, waist + 0.01, 0], [PI / 2, 0, 0]);
    k.sphere(c.body, gold, 0.03, [0, waist + 0.01, 0.13], [1, 1, 0.6], [0, 0, 0], { outline: false });
    // Body and leaf bodice
    k.sphere(c.body, bud, 1, [0, 0.68, 0], [0.135, 0.2, 0.115]);
    for (const sx of [-1, 1]) {
      const m = slab(k, c.body, petalGeo(0.34, 0.17, { cup: 0.09, curl: -0.04 }), leaf, [sx * 0.06, waist + 0.02, 0.07]);
      m.rotation.set(-0.3, sx * 0.55, -sx * 0.3, 'YXZ');
    }
    k.glowSphere(c.body, spring, 0.03, [0, 0.76, 0.115], 2.4, [1, 1.3, 0.7]);
    // Head
    const head = k.group(c.body, [0, 1.0, 0.02]);
    c.head = head;
    const hr = 0.21;
    const hrad: V3 = [hr, hr * 1.02, hr * 0.96];
    k.sphere(head, skin, 1, [0, 0, 0], hrad);
    faceEyes(k, head, hrad, { x: 0.082, y: 0.0, r: 0.066, iris });
    k.blush(head, 0.145, -0.055, 0.15, 0.038);
    smile(k, head, mouth, 0.024, [0, -0.085, 0.195], [0.3, 0, 0]);
    // Water-like hair: a cap, bangs parted to both sides, long sidelocks, five locks at the back, a small tuft of water curls on top
    k.sphere(head, hair, 1, [0, 0.06, -0.03], [0.225, 0.19, 0.22]);
    for (const sx of [-1, 1]) petal(k, head, hairL, 0.17, 0.1, [sx * 0.07, 0.19, 0.13], sx * 0.75, PI - 0.7, { curl: 0.04, cup: 0.02 });
    petal(k, head, hair, 0.11, 0.07, [0, 0.2, 0.15], 0, PI - 0.55, { curl: 0.03 });
    k.horn(head, hairL, 0.022, 0.13, 0.06, [0.03, 0.24, -0.02], [0.3, 0, -0.5]);
    for (const sx of [-1, 1]) {
      const g = k.group(head, [sx * 0.19, 0.07, 0.03]);
      petal(k, g, hair, 0.38, 0.12, [0, 0, 0], sx * PI * 0.5, PI - 0.1, { curl: 0.06, cup: 0.03, thick: 0.024 });
      c.tails.push({ g, phase: sx * 1.2, amp: 0.05, axis: 'z' });
    }
    const back = k.group(head, [0, 0.1, -0.13]);
    for (let i = 0; i < 5; i++) {
      const yaw = PI + (i - 2) * 0.42;
      petal(k, back, i % 2 ? hairL : hair, 0.62 - Math.abs(i - 2) * 0.08, 0.15, [Math.sin(yaw) * 0.08, 0, Math.cos(yaw) * 0.08 + 0.02], yaw, PI - 0.5 - Math.abs(i - 2) * 0.1, { curl: 0.12, cup: 0.03, thick: 0.024 });
    }
    c.tails.push({ g: back, phase: 0, amp: 0.05, axis: 'x' });
    // Water-drop crown: a ring of floating water drops spinning above the head, with a larger one in the center
    const crown = k.group(head, [0, 0.34, 0]);
    k.glow(crown, new THREE.TorusGeometry(0.16, 0.005, 6, 40), spring, 1.8, [0, 0, 0], [PI / 2, 0, 0], 0.7);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      waterDrop(k, c, crown, 0.024, [Math.sin(a) * 0.16, (i % 2) * 0.02, Math.cos(a) * 0.16], { bob: 0.015, shell: 0, intensity: 2.6 });
    }
    waterDrop(k, c, crown, 0.036, [0, 0.05, 0], { bob: 0.012 });
    c.spinners.push({ g: crown, speed: 0.6, axis: 'y' });
    // Arms cupping spring water: leaf cuffs, thin arms
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(-0.85, 0, -sx * 0.42);
      const g = k.group(c.body, [sx * 0.14, 0.83, 0.03], [base.x, base.y, base.z]);
      const sleeve = slab(k, g, petalGeo(0.12, 0.1, { cup: 0.05 }), leaf, [0, 0.02, 0]);
      sleeve.rotation.set(PI + 0.2, sx * PI * 0.5, 0, 'YXZ');
      k.capsule(g, skin, 0.03, 0.18, [0, -0.12, 0]);
      k.sphere(g, skin, 0.038, [0, -0.25, 0]);
      c.arms.push({ g, side: sx, base });
    }
    const well = waterDrop(k, c, c.body, 0.06, [0, 0.56, 0.26], { bob: 0.01, shell: 1.35, intensity: 2.0 });
    const stars = k.group(well, [0, 0.07, 0], [0.5, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      const st = new THREE.OctahedronGeometry(0.016);
      st.scale(0.7, 1.3, 0.7);
      k.glow(stars, st, i % 2 ? 0xffffff : gold, 2.8, [Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12]);
    }
    c.spinners.push({ g: stars, speed: 1.6, axis: 'y' });
    for (let i = 0; i < 4; i++) sparkle(k, c, c.body, i % 2 ? spring : 0xffffff, 0.018, [Math.cos(i * 1.7) * 0.45, 0.55 + (i % 2) * 0.45, Math.sin(i * 1.7) * 0.35], 0.06);
  },
};

void halo;
