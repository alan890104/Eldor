// Second-batch spirit models (see docs/09-bestiary.md): Star Gate City (`clockmouse`, `inkcat`).
// The legendary SSRs (`eldarin`, `astragate`, `voidchild`, `chronodragon`) are handled by species/legends.ts; the old versions kept here serve only as a fallback when legends.ts does not provide one (the registry goes by legends.ts).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit } from '../creature.ts';
import { biped, ears, floater, PI, quad, roundEars, sparkle, tailChain, type Builder, type C, type V3 } from '../parts.ts';
import { outlineMaterial } from '../toon.ts';

// ───────────────────────── Shared helpers ─────────────────────────

const hardOutlines = new WeakMap<Creature, THREE.ShaderMaterial>();

/**
 * Angular parts (gears, extrusions, polyhedra): the outline uses a copy with smooth normals pushed outward,
 * otherwise the hard-edge normals would tear the outline into scattered fragments.
 */
function hard(k: Kit, parent: THREE.Object3D, geo: THREE.BufferGeometry, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]): THREE.Mesh {
  // The post-process outline version does not need an outline copy with smooth normals and draws the lines directly as an ordinary part
  if (k.ink) return k.mesh(parent, geo, col, pos, rot);
  const m = k.mesh(parent, geo, col, pos, rot, { outline: false });
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

/** The z of the eyes when stuck on a spherical head surface (sunk in slightly, so the whites bulge out a little) */
function eyeZ(hr: number, x: number, y: number, r: number): number {
  return Math.sqrt(Math.max(0.0001, hr * hr - x * x - y * y)) - r * 0.2;
}

/** A point on an ellipsoid surface and its normal: yaw about the y axis (0 = straight ahead, +z), pitch is the elevation */
function onEllipsoid(ctr: V3, rad: V3, yaw: number, pitch: number, lift = 1): { p: V3; n: THREE.Vector3 } {
  const d = new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
  const p: V3 = [ctr[0] + d.x * rad[0] * lift, ctr[1] + d.y * rad[1] * lift, ctr[2] + d.z * rad[2] * lift];
  const n = new THREE.Vector3(d.x / rad[0], d.y / rad[1], d.z / rad[2]).normalize();
  return { p, n };
}

/** Flat spot stuck on an ellipsoid surface */
function spot(k: Kit, parent: THREE.Object3D, col: C, ctr: V3, rad: V3, yaw: number, pitch: number, size: number, stretch: [number, number] = [1, 1], spin = 0): THREE.Mesh {
  const { p, n } = onEllipsoid(ctr, rad, yaw, pitch);
  const m = k.sphere(parent, col, size, p, [stretch[0], stretch[1], 0.3], [0, 0, 0], { outline: false });
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  if (spin) m.rotateZ(spin);
  return m;
}

/** A series of points on an ellipsoid surface (a brush-stroke path) */
function surfPath(ctr: V3, rad: V3, pts: [number, number][], lift = 1.02): THREE.Vector3[] {
  return pts.map(([yaw, pitch]) => new THREE.Vector3(...onEllipsoid(ctr, rad, yaw, pitch, lift).p));
}

/** Tube along a curve, with the radius varying with prof(t) (both ends taper by default, like a stroke of ink) */
function strokeGeo(pts: THREE.Vector3[], r: number, prof: (t: number) => number = (t) => Math.pow(Math.sin(PI * t), 0.6), radial = 6): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts);
  const seg = Math.max(12, pts.length * 8);
  const g = new THREE.TubeGeometry(path, seg, r, radial, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const ctr = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    path.getPointAt(t, ctr);
    const f = Math.max(0.1, prof(t));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(ctr).multiplyScalar(f).add(ctr);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

function stroke(k: Kit, parent: THREE.Object3D, col: C, pts: THREE.Vector3[], r: number, glow = 0): THREE.Mesh {
  const g = strokeGeo(pts, r);
  return glow ? k.glow(parent, g, col, glow) : k.mesh(parent, g, col, [0, 0, 0], [0, 0, 0], { outline: false });
}

/** Gear (thickness along the z axis) */
function gearGeo(R: number, teeth: number, thick: number, holes = true): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const ri = R * 0.76;
  const p = (PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * p;
    const pts: [number, number][] = [
      [ri, a],
      [R, a + p * 0.14],
      [R, a + p * 0.44],
      [ri, a + p * 0.58],
    ];
    pts.forEach(([r, ang], j) => {
      const x = r * Math.cos(ang);
      const y = r * Math.sin(ang);
      if (i === 0 && j === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  if (holes) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * R * 0.44, Math.sin(a) * R * 0.44, R * 0.17, 0, PI * 2, true);
      s.holes.push(h);
    }
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.25, bevelSize: R * 0.04, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** Turning gear: the group's z axis is the gear axle */
function gear(k: Kit, c: Creature, parent: THREE.Object3D, col: C, R: number, teeth: number, pos: V3, rot: V3, speed: number, hub: C = 0x5a4632): THREE.Group {
  const g = k.group(parent, pos, rot);
  hard(k, g, gearGeo(R, teeth, R * 0.32), col);
  k.sphere(g, hub, R * 0.26, [0, 0, 0], [1, 1, 0.9]);
  c.spinners.push({ g, speed, axis: 'z' });
  return g;
}

/** Crenellated ring band wound into a circle (gear crown): radius R, ring height h, tooth height th */
function crownGeo(R: number, h: number, teeth: number, th: number, thick: number): THREE.BufferGeometry {
  const W = PI * 2 * R;
  const p = W / teeth;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  const steps = teeth * 4;
  for (let i = 1; i <= steps; i++) s.lineTo((i / steps) * W, 0);
  s.lineTo(W, h);
  for (let i = teeth - 1; i >= 0; i--) {
    const x0 = i * p;
    s.lineTo(x0 + p * 0.8, h);
    s.lineTo(x0 + p * 0.74, h + th);
    s.lineTo(x0 + p * 0.26, h + th);
    s.lineTo(x0 + p * 0.2, h);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) / R;
    const r = R + pos.getZ(i);
    pos.setXYZ(i, Math.sin(a) * r, pos.getY(i), Math.cos(a) * r);
  }
  g.computeVertexNormals();
  return g;
}

/** Winding key (key handle along +y) */
function windKey(k: Kit, parent: THREE.Object3D, col: C, sz: number, pos: V3, rot: V3 = [0, 0, 0], shaft = 0.5): THREE.Group {
  const g = k.group(parent, pos, rot);
  k.cyl(g, col, sz * 0.075, sz * 0.075, sz * shaft, [0, sz * shaft * 0.5, 0], [0, 0, 0], 10);
  k.cyl(g, col, sz * 0.14, sz * 0.14, sz * 0.08, [0, sz * shaft, 0], [0, 0, 0], 14);
  for (const sx of [-1, 1]) k.torus(g, col, sz * 0.2, sz * 0.07, [sx * sz * 0.24, sz * (shaft + 0.24), 0]);
  k.sphere(g, col, sz * 0.12, [0, sz * (shaft + 0.2), 0]);
  return g;
}

/** A child node aligned to world coordinates (canceling the parent's rotation at modeling time), for hanging dripping ink drops and pendulums */
function levelGroup(k: Kit, parent: THREE.Object3D, pos: V3): THREE.Group {
  const g = k.group(parent, pos);
  parent.updateWorldMatrix(true, false);
  const q = new THREE.Quaternion();
  parent.getWorldQuaternion(q);
  g.quaternion.copy(q.invert());
  return g;
}

/** A cylinder bone between two points in a plane (x-y plane, used for a wing skeleton) */
function boneBetween(k: Kit, parent: THREE.Object3D, col: C, a: [number, number], b: [number, number], r: number, rTip = r * 0.7): THREE.Mesh {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return k.cyl(parent, col, rTip, r, len, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], [0, 0, Math.atan2(-dx, dy)], 10);
}

/** Flat polygon sheet (wing membrane), the points in the x-y plane, with quadratic curves available for scalloped edges */
function membraneGeo(pts: [number, number][], scallop: number, thick = 0.02): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (scallop && i > 1 && i < pts.length - 1) {
      // Concave toward the origin (the shoulder)
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      s.quadraticCurveTo(mx * (1 - scallop), my * (1 - scallop), x1, y1);
    } else s.lineTo(x1, y1);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** Scroll: the paper surface in the x-y plane (width w, height h), with two rods at left and right */
function scroll(k: Kit, parent: THREE.Object3D, pos: V3, rot: V3, w: number, h: number, o: { text: C; glowText?: number; seal?: boolean }): THREE.Group {
  const g = k.group(parent, pos, rot);
  hard(k, g, new THREE.BoxGeometry(w, h, 0.014), 0xf7eed6);
  for (const sx of [-1, 1]) {
    k.cyl(g, 0x7a2e26, 0.032, 0.032, h + 0.06, [sx * w * 0.5, 0, 0.005], [0, 0, 0], 12);
    for (const sy of [-1, 1]) k.sphere(g, 0xe0b04a, 0.03, [sx * w * 0.5, sy * (h * 0.5 + 0.04), 0.005]);
  }
  // Vertical writing: a few lines of short strokes
  const cols = Math.max(2, Math.round(w / 0.09));
  for (let i = 0; i < cols; i++) {
    const x = -w * 0.5 + w * 0.2 + (i / Math.max(1, cols - 1)) * w * 0.6;
    const n = 2 + ((i * 7) % 3);
    for (let j = 0; j < n; j++) {
      const y = h * 0.3 - j * (h * 0.6) / Math.max(1, n - 0.2);
      const geo = new THREE.BoxGeometry(0.018, h * 0.13, 0.006);
      if (o.glowText) k.glow(g, geo, o.text, o.glowText, [x, y, 0.009], [0, 0, (j % 2 ? 0.3 : -0.2)]);
      else k.mesh(g, geo, o.text, [x, y, 0.009], [0, 0, (j % 2 ? 0.3 : -0.2)], { outline: false });
    }
  }
  if (o.seal) k.mesh(g, new THREE.BoxGeometry(0.05, 0.05, 0.008), 0xd83a3a, [w * 0.36, -h * 0.3, 0.01], [0, 0, 0], { outline: false });
  return g;
}

/** An ordinary smooth nose tip / small round dot */
function dot(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3, scale: V3 = [1, 1, 1]): THREE.Mesh {
  return k.sphere(parent, col, r, pos, scale, [0, 0, 0], { outline: false });
}

/** Whiskers */
function whiskers(k: Kit, head: THREE.Object3D, col: C, x: number, y: number, z: number, len: number, n = 2): void {
  for (const sx of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const tilt = (i - (n - 1) / 2) * 0.28;
      k.cyl(head, col, 0.006, 0.006, len, [sx * (x + len * 0.42), y + tilt * len * 0.3, z], [0, sx * 0.35, sx * (PI / 2 + tilt)], 4, { outline: false });
    }
  }
}

// ───────────────────────── Species ─────────────────────────

export const SPECIES_TOWN: Record<string, Builder> = {
  // `clockmouse`
  clockmouse(k, c, s) {
    const col = 0xb08a5a;
    const belly = 0xb4b4be;
    const dark = 0x7a5836;
    const brass = 0xe6c060;
    const brassD = 0xb08a30;
    const pink = 0xf2a2ac;
    const muzzle = 0xdcc6a2;
    const red = 0xc8303a;
    const inkD = 0x3a2a20;

    /** Mouse face: muzzle, nose tip, front teeth, big eyes (eye is a radius ratio), blush, whiskers, big round ears (ear is a radius ratio) */
    const face = (head: THREE.Object3D, hr: number, eye: number, ear: number) => {
      k.sphere(head, muzzle, hr * 0.42, [0, -hr * 0.3, hr * 0.66], [1.05, 0.78, 1.05]);
      dot(k, head, 0xe86a82, hr * 0.12, [0, -hr * 0.2, hr * 1.08], [1.2, 0.9, 1]);
      for (const sx of [-1, 1]) k.mesh(head, new THREE.BoxGeometry(hr * 0.09, hr * 0.12, hr * 0.04), 0xffffff, [sx * hr * 0.05, -hr * 0.56, hr * 0.94], [0.2, 0, 0], { outline: false });
      const ex = hr * 0.4;
      const ey = hr * 0.14;
      const er = hr * eye;
      k.eyes(head, { x: ex, y: ey, z: eyeZ(hr, ex, ey, er), r: er, iris: 0x2a78b8 });
      k.blush(head, hr * 0.64, -hr * 0.2, hr * 0.68, hr * 0.13);
      whiskers(k, head, inkD, hr * 0.32, -hr * 0.32, hr * 0.86, hr * 0.7);
      roundEars(k, c, head, col, pink, hr * ear, hr * 0.8, hr * 0.62);
    };
    /** Curled thin tail; spring = the end is a spring */
    const tail = (parent: THREE.Object3D, len: number, spring: boolean, rot: V3) => {
      const g = k.group(parent, [0, 0, 0], rot);
      c.tails.push({ g, phase: 0, amp: 0.3, axis: 'y' });
      const curl = -len * 0.45;
      k.horn(g, 0xc89478, 0.036, len, curl, [0, 0, 0]);
      if (spring) {
        const tip = k.group(g, [0, len * 0.96, -curl], [0, 0, 0]);
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * PI * 2 * 4;
          pts.push(new THREE.Vector3(Math.cos(a) * 0.05, (i / 40) * 0.2, Math.sin(a) * 0.05));
        }
        k.mesh(tip, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.013, 6, false), brass, [0, 0, 0], [0, 0, 0], { outline: false });
        k.sphere(tip, brass, 0.045, [0, 0.23, 0]);
      }
    };
    /** Brass panel + four rivets (dial = a dial in the middle of the panel; keyhole = a keyhole) */
    const panel = (parent: THREE.Object3D, w: number, h: number, pos: V3, rot: V3, o: { dial?: boolean; keyhole?: boolean } = {}) => {
      const g = k.group(parent, pos, rot);
      hard(k, g, new THREE.BoxGeometry(w, h, 0.03), brass);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) k.sphere(g, brassD, 0.013, [sx * w * 0.4, sy * h * 0.36, 0.016], [1, 1, 0.5], [0, 0, 0], { outline: false });
      if (o.dial) {
        const R = Math.min(w, h) * 0.36;
        k.cyl(g, 0xfaf4e6, R, R, 0.02, [0, 0, 0.02], [PI / 2, 0, 0], 24);
        k.torus(g, brassD, R, 0.01, [0, 0, 0.03]);
        k.mesh(g, new THREE.BoxGeometry(0.008, R * 0.8, 0.006), inkD, [0, R * 0.3, 0.036], [0, 0, 0], { outline: false });
        k.mesh(g, new THREE.BoxGeometry(0.008, R * 0.55, 0.006), inkD, [R * 0.18, R * 0.12, 0.036], [0, 0, -0.8], { outline: false });
        for (let i = 0; i < 4; i++) dot(k, g, inkD, 0.007, [Math.sin((i * PI) / 2) * R * 0.8, Math.cos((i * PI) / 2) * R * 0.8, 0.036]);
        dot(k, g, brassD, 0.012, [0, 0, 0.038]);
      }
      if (o.keyhole) {
        dot(k, g, inkD, 0.016, [0, h * 0.08, 0.018], [1, 1, 0.5]);
        k.mesh(g, new THREE.BoxGeometry(0.014, h * 0.28, 0.008), inkD, [0, -h * 0.1, 0.018], [0, 0, 0], { outline: false });
      }
      return g;
    };

    if (s === 1) {
      // I: a round clockwork toy mouse, the body about as big as the head, short legs, especially big ears, a winding key stuck in its back as big as the body
      const q = quad(k, c, { col, belly, len: 0.3, r: 0.25, leg: 0.1, legR: 0.055, headR: 0.3, headZ: 0.03, paw: dark });
      face(q.head, q.headR, 0.29, 0.56);
      tail(q.tail, 0.42, false, [-PI / 2 + 0.5, 0, 0]);
      // The toy's seam lines and the big winding key on its back
      const seam = k.torus(c.body, dark, q.r * 0.98, 0.012, [0, q.bodyY, 0.02], [0, 0, 0], PI * 2, { outline: false });
      seam.scale.set(1, 0.9, 1);
      const key = windKey(k, q.back, brass, 0.55, [0, -0.02, -0.04], [-0.35, 0, 0], 0.5);
      c.spinners.push({ g: key, speed: 2.2, axis: 'y' });
      for (let i = 0; i < 2; i++) sparkle(k, c, c.body, 0xffe07a, 0.016, [i ? 0.3 : -0.28, q.bodyY + 0.35 + i * 0.1, -0.1], 0.04);
      return;
    }

    if (s === 2) {
      // II: a lengthened adolescent mouse, longer legs, longer body, the tail raised high (spring at the end); two turning gears on the shoulders, goggles on the brow, a brass hatch on the flank
      const q = quad(k, c, { col, belly, len: 0.5, r: 0.27, leg: 0.2, legR: 0.06, headR: 0.28, headZ: 0.05, paw: dark });
      face(q.head, q.headR, 0.25, 0.5);
      for (const sx of [-1, 1]) k.sphere(c.body, col, 0.1, [sx * q.r * 0.62, q.bodyY - q.r * 0.3, -q.len * 0.5], [0.8, 1, 1.1]);
      tail(q.tail, 0.6, true, [-PI / 2 + 0.95, 0, 0]);
      const key = windKey(k, q.back, brass, 0.42, [0, -0.03, -0.1], [-0.35, 0, 0], 0.6);
      c.spinners.push({ g: key, speed: 2.2, axis: 'y' });
      // Brass bands and rivets on the body
      const band = k.torus(c.body, brass, q.r * 1.0, 0.025, [0, q.bodyY, -0.02]);
      band.scale.set(1, 0.9, 1);
      panel(c.body, 0.13, 0.1, [q.r * 0.96, q.bodyY - 0.01, q.len * 0.05], [0, PI / 2, 0], { keyhole: true });
      // Brass goggles on the brow
      const hr = q.headR;
      const el = 1.15;
      k.torus(q.head, 0x6a4428, hr * 1.0, 0.022, [0, 0, 0], [PI / 2 - el, 0, 0]);
      const gog = k.group(q.head, [0, Math.sin(el) * hr, Math.cos(el) * hr], [-el, 0, 0]);
      for (const sx of [-1, 1]) {
        k.torus(gog, brass, 0.07, 0.024, [sx * 0.085, 0, 0.01], [0, sx * 0.25, 0]);
        k.glow(gog, new THREE.CircleGeometry(0.062, 20), 0xffb040, 1.3, [sx * 0.085, 0, 0.018], [0, sx * 0.25, 0], 0.9);
        k.glowSphere(gog, 0xffffff, 0.014, [sx * 0.085 - 0.02, 0.02, 0.03], 2);
      }
      for (const sx of [-1, 1]) {
        gear(k, c, c.body, brass, 0.14, 9, [sx * (q.r - 0.01), q.bodyY + 0.14, q.len * 0.36], [0, sx * (PI / 2 - 0.25), 0], sx * 2.4);
        gear(k, c, c.body, 0xc8844a, 0.085, 7, [sx * (q.r - 0.05), q.bodyY + 0.3, q.len * 0.36 - 0.16], [0, sx * (PI / 2 - 0.25), 0], -sx * 3.6);
      }
      return;
    }

    // III: an upright `clockmouse`, body and legs lengthened, a gear crown, a monocle, a red cloak with a fur collar, a dial on the chest, gear epaulettes, a winding-key scepter
    const b = biped(k, c, { col, belly: 0xc6c6d0, torsoR: 0.28, torsoH: 0.52, leg: 0.2, legR: 0.085, headR: 0.3, armLen: 0.22, armR: 0.072, hand: muzzle, foot: dark });
    face(b.head, b.headR, 0.24, 0.48);
    // Gear crown
    const crown = k.group(b.head, [0, b.headR * 0.84, -0.01]);
    hard(k, crown, crownGeo(0.17, 0.08, 8, 0.07, 0.035), brass, [0, 0, 0], [0, PI / 8, 0]);
    k.torus(crown, red, 0.19, 0.02, [0, 0.018, 0], [PI / 2, 0, 0]);
    const emb = gear(k, c, crown, brass, 0.065, 8, [0, 0.06, 0.2], [0, 0, 0], 1.5, 0xd83040);
    k.glowSphere(emb, 0xff4a5a, 0.02, [0, 0, 0.02], 2.4);
    // Monocle
    const ex = b.headR * 0.4;
    const ey = b.headR * 0.14;
    k.torus(b.head, brass, b.headR * 0.3, 0.014, [ex + 0.01, ey - 0.005, eyeZ(b.headR, ex, ey, b.headR * 0.25) + 0.04], [0, 0.3, 0]);
    k.cyl(b.head, brass, 0.005, 0.005, 0.16, [ex + 0.1, ey - 0.12, b.headR * 0.8], [0, 0, 0.5], 4, { outline: false });
    // Short red cloak and white fur collar
    const cape = k.group(c.body, [0, 0, -0.14], [0.08, 0, 0]);
    cape.scale.set(1, 1, 0.5);
    k.lathe(cape, red, [
      [0.001, 0.16],
      [0.34, 0.16],
      [0.34, 0.22],
      [0.29, 0.44],
      [0.23, 0.62],
      [0.001, 0.65],
    ]);
    k.torus(cape, 0xe6b44a, 0.34, 0.022, [0, 0.16, 0], [PI / 2, 0, 0]);
    const collarY = b.leg + b.th - 0.02;
    k.torus(c.body, 0xfaf6ee, 0.2, 0.07, [0, collarY, -0.01], [PI / 2 + 0.1, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = -PI / 2 + (i - 2) * 0.55;
      dot(k, c.body, 0x1c1a24, 0.025, [Math.cos(a) * 0.22, collarY - 0.03, -Math.sin(a) * 0.22 + 0.03], [0.8, 1.4, 0.6]);
    }
    k.sphere(c.body, 0xe6b44a, 0.045, [0, collarY - 0.06, 0.24]);
    // Dial panel on the chest
    panel(c.body, 0.2, 0.18, [0, b.torsoY + 0.02, b.tr * 0.9], [0.12, 0, 0], { dial: true });
    // Gear epaulettes on the shoulders
    for (const a of c.arms) gear(k, c, a.g, brass, 0.1, 8, [a.side * 0.05, 0.08, 0], [0, a.side * 1.1, 0], a.side * 2);
    // Big winding key behind the back and the tail spring
    const key = windKey(k, c.body, brass, 0.44, [0, b.leg + b.th * 0.6, -0.24], [-PI / 2 + 0.45, 0, 0]);
    c.spinners.push({ g: key, speed: 1.8, axis: 'y' });
    tail(b.tail, 0.52, true, [-PI / 2 + 0.7, 0, 0]);
    // Winding-key scepter
    c.arms[1].base.set(-0.35, 0, -0.2);
    c.arms[1].g.rotation.copy(c.arms[1].base);
    const scep = k.group(b.hands[1], [0.02, 0, 0.04], [0.4, 0, -0.2]);
    k.cyl(scep, 0x8a5a30, 0.025, 0.025, 0.7, [0, 0.2, 0], [0, 0, 0], 10);
    k.torus(scep, brass, 0.03, 0.01, [0, 0.0, 0], [PI / 2, 0, 0]);
    const top = windKey(k, scep, brass, 0.3, [0, 0.5, 0], [0, 0, 0], 0.25);
    k.glowSphere(top, 0xff4a5a, 0.035, [0, 0.3 * 0.45, 0.02], 2.4);
    c.spinners.push({ g: top, speed: 1.2, axis: 'y' });
    for (let i = 0; i < 3; i++) sparkle(k, c, c.body, 0xffe07a, 0.02, [Math.cos(i * 2.1) * 0.45, 0.5 + i * 0.18, Math.sin(i * 2.1) * 0.3], 0.06);
  },

  // `inkcat`
  inkcat(k, c, s) {
    const col = 0xf4f0e6;
    const cream = 0xfffdf6;
    const ink = 0x1c1a24;
    const blue = 0x6ab8ff;
    const pink = 0xf6a8b4;

    /** Cat face: big eyes, blush, nose tip, an ω-shaped mouth, whiskers, cheek fur, pointed ears (the left ear tip is dipped in ink) */
    const catFace = (head: THREE.Object3D, hr: number, eye: number, iris: C) => {
      k.sphere(head, col, hr, [0, 0, 0], [1, 0.95, 1]);
      for (const sx of [-1, 1]) k.sphere(head, col, hr * 0.3, [sx * hr * 0.82, -hr * 0.28, hr * 0.3], [1, 0.72, 0.8], [0, sx * 0.4, sx * 0.35]);
      const ex = hr * 0.4;
      const ey = hr * 0.08;
      const er = hr * eye;
      k.eyes(head, { x: ex, y: ey, z: eyeZ(hr, ex, ey, er), r: er, iris });
      k.blush(head, hr * 0.64, -hr * 0.2, hr * 0.7, hr * 0.12);
      dot(k, head, pink, hr * 0.075, [0, -hr * 0.12, hr * 0.99], [1.4, 0.9, 1]);
      for (const sx of [-1, 1]) k.torus(head, ink, hr * 0.065, hr * 0.016, [sx * hr * 0.065, -hr * 0.22, hr * 0.965], [-0.25, 0, PI], PI, { outline: false });
      whiskers(k, head, ink, hr * 0.42, -hr * 0.18, hr * 0.8, hr * 0.62);
      ears(k, c, head, col, pink, hr * 0.3, hr * 0.56, hr * 0.5, hr * 0.62, 0.28);
      const earL = c.ears[c.ears.length - 2].g;
      k.cone(earL, ink, hr * 0.13, hr * 0.24, [0, hr * 0.33, 0.004], [0, 0, 0], 10);
    };
    /** Make the object's +y point along dir */
    const aim = <T extends THREE.Object3D>(o: T, dir: V3): T => {
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
      return o;
    };
    /** Ink streak flowing from the right side over the back to the left (ctr / rad are the body ellipsoid) */
    const stripes = (parent: THREE.Object3D, ctr: V3, rad: V3, n: number, r: number) => {
      for (let i = 0; i < n; i++) {
        const zz = rad[2] * (0.6 - (i / (n - 1)) * 1.2);
        const pts: THREE.Vector3[] = [];
        for (let j = 0; j <= 6; j++) {
          const t = j / 6;
          const a = 0.35 + t * (PI - 0.7);
          const zj = zz + Math.sin(t * PI * 1.5 + i) * 0.05 - (t - 0.5) * 0.08;
          const f = Math.sqrt(Math.max(0.05, 1 - (zj / rad[2]) ** 2));
          pts.push(new THREE.Vector3(ctr[0] + Math.cos(a) * rad[0] * f * 1.02, ctr[1] + Math.sin(a) * rad[1] * f * 1.02, ctr[2] + zj));
        }
        stroke(k, parent, ink, pts, r);
      }
    };
    /** Three ink marks on the brow */
    const browMarks = (head: THREE.Object3D, hr: number) => {
      for (const [yw, len] of [
        [-0.28, 0.5],
        [0, 0.6],
        [0.28, 0.5],
      ] as [number, number][]) {
        const pts = surfPath([0, 0, 0], [hr, hr * 0.95, hr], [
          [yw * 0.9, 0.62],
          [yw, 0.62 + len * 0.5],
          [yw * 1.2, 0.62 + len],
        ]);
        stroke(k, head, ink, pts, hr * 0.06);
      }
    };
    /** Brush tail: a white tail along a curve + an ink-colored brush tip + dripping ink beads (glow = III's blue-lit tip) */
    const brushTail = (parent: THREE.Object3D, pts: V3[], r: number, glow: boolean, amp: number) => {
      const tg = k.group(parent);
      c.tails.push({ g: tg, phase: 0, amp, axis: 'y' });
      const tp = pts.map((p) => new THREE.Vector3(...p));
      k.mesh(tg, strokeGeo(tp, r, (t) => 1 - t * 0.3, 10), col);
      const last = tp[tp.length - 1];
      const dir = last.clone().sub(tp[tp.length - 2]).normalize();
      const brush = k.group(tg, [last.x, last.y, last.z]);
      brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
      k.sphere(brush, ink, r * 1.3, [0, 0, -0.03], [1, 1, 1.25]);
      k.cone(brush, ink, r * 1.25, r * 3.4, [0, 0, -0.06], [-PI / 2, 0, 0], 14);
      if (glow) {
        const gg = new THREE.ConeGeometry(r * 0.6, r * 1.8, 10);
        gg.translate(0, r * 0.9, 0);
        k.glow(brush, gg, blue, 2.8, [0, 0, -0.06 - r * 3.2], [-PI / 2, 0, 0]);
        k.glowSphere(brush, blue, r * 1.4, [0, 0, -0.06 - r * 3.4], 1.6, [1, 1, 1.4], 0.3);
      }
      const drip = levelGroup(k, brush, [0, 0, -0.06 - r * 3.6]);
      const bead = k.group(drip, [0, -0.08, 0]);
      if (glow) {
        k.glowSphere(bead, blue, 0.03, [0, 0, 0], 2.6);
        k.glow(bead, new THREE.ConeGeometry(0.022, 0.05, 8).translate(0, 0.045, 0), blue, 2.6);
      } else {
        dot(k, bead, ink, 0.03, [0, 0, 0]);
        k.cone(bead, ink, 0.022, 0.05, [0, 0.015, 0], [0, 0, 0], 8, { outline: false });
      }
      c.bobbers.push({ g: bead, base: -0.08, amp: 0.02, speed: 2.4, phase: 0 });
      return tg;
    };

    if (s === 1) {
      // I: a small cat sitting, a big head, a round body, forelegs braced straight, hind legs tucked at the sides, the tail curled up beside it with the brush tip raised
      c.archetype = 'biped';
      const bc: V3 = [0, 0.29, 0];
      const br: V3 = [0.21, 0.26, 0.2];
      k.sphere(c.body, col, 1, bc, br);
      k.sphere(c.body, cream, 1, [0, 0.24, 0.1], [0.15, 0.18, 0.13], [0, 0, 0], { outline: false });
      for (const sx of [-1, 1]) {
        const hg = k.group(c.body, [sx * 0.16, 0.12, 0.0]);
        k.sphere(hg, col, 0.11, [0, 0, 0], [1, 0.85, 1.2]);
        k.sphere(hg, ink, 0.05, [sx * 0.01, -0.07, 0.13], [1.1, 0.6, 1.3]);
        c.legs.push({ g: hg, phase: sx > 0 ? PI : 0, amp: 0.3 });
        const fg = k.group(c.body, [sx * 0.1, 0.3, 0.13]);
        k.capsule(fg, col, 0.045, 0.16, [0, -0.13, 0]);
        k.sphere(fg, ink, 0.052, [0, -0.25, 0.02], [1.1, 0.7, 1.3]);
        c.legs.push({ g: fg, phase: sx > 0 ? 0 : PI, amp: 0.5 });
      }
      const hr = 0.28;
      const head = k.group(c.body, [0, 0.62, 0.05]);
      c.head = head;
      catFace(head, hr, 0.29, 0x4a62d8);
      const spots: [number, number, number][] = [
        [1.3, 0.55, 0.075],
        [-1.5, 0.35, 0.065],
        [2.4, 0.75, 0.055],
        [-2.5, 0.3, 0.07],
        [0.4, 1.15, 0.045],
        [3.0, 0.1, 0.05],
      ];
      for (const [yw, p, sz] of spots) spot(k, c.body, ink, bc, br, yw, p, sz, [1.2, 0.9], yw);
      spot(k, head, ink, [0, 0, 0], [hr, hr * 0.95, hr], -0.45, 0.95, hr * 0.2, [1.1, 0.9]);
      spot(k, head, ink, [0, 0, 0], [hr, hr * 0.95, hr], -0.05, 1.12, hr * 0.07);
      spot(k, head, ink, [0, 0, 0], [hr, hr * 0.95, hr], 0.8, 0.5, hr * 0.12, [1.1, 0.9]);
      brushTail(k.group(c.body, [0, 0.1, -0.15]), [
        [0, 0, 0],
        [0.06, 0.0, -0.1],
        [0.18, 0.02, -0.1],
        [0.26, 0.1, -0.02],
        [0.27, 0.24, 0.02],
      ], 0.04, false, 0.15);
      return;
    }

    if (s === 2) {
      // II: an adolescent cat standing, the body and legs lengthened, ink dots joined into flowing stripes, the tail raised high, an unrolled sheet of paper floating behind its back
      const q = quad(k, c, { col, belly: cream, len: 0.5, r: 0.23, leg: 0.2, legR: 0.065, headR: 0.26, neck: 0.03, headZ: 0.03, paw: ink });
      const hr = q.headR;
      for (const sx of [-1, 1]) {
        k.sphere(c.body, col, q.r * 0.42, [sx * q.r * 0.6, q.bodyY - q.r * 0.28, -q.len * 0.5], [0.8, 1, 1.1]);
        k.sphere(c.body, col, q.r * 0.3, [sx * q.r * 0.55, q.bodyY - q.r * 0.3, q.len * 0.55], [0.8, 1, 1]);
      }
      for (let i = -1; i <= 1; i++) k.sphere(c.body, cream, q.r * 0.26, [i * q.r * 0.3, q.bodyY + q.r * 0.22, q.len * 0.72 + (i ? -0.02 : 0.03)], [1, 0.8, 0.8]);
      catFace(q.head, hr, 0.27, 0x4a62d8);
      browMarks(q.head, hr);
      stripes(c.body, [0, q.bodyY, 0], [q.r, q.r * 0.88, q.len], 5, 0.03);
      brushTail(k.group(q.tail, [0, 0.02, 0.03]), [
        [0, 0, 0],
        [0, 0.12, -0.1],
        [0, 0.32, -0.16],
        [0, 0.5, -0.2],
        [0, 0.62, -0.3],
        [0, 0.64, -0.42],
      ], 0.045, false, 0.22);
      const sc = scroll(k, c.body, [0.05, q.bodyY + 0.42, -0.5], [-0.2, 0.25, 0.1], 0.58, 0.26, { text: ink, seal: true });
      c.bobbers.push({ g: sc, base: sc.position.y, amp: 0.04, speed: 1.6, phase: 0.5 });
      for (let i = 0; i < 2; i++) sparkle(k, c, c.body, 0xfff4c0, 0.02, [i ? 0.38 : -0.36, q.bodyY + 0.64 + i * 0.08, -0.3], 0.05);
      return;
    }

    // III: a floating `inkcat`, a slender body raised slightly, limbs hanging in the air, a long neck, two scrolls spread like wings, a tail with a blue-lit brush tip
    floater(c, 0.32);
    const bg = k.group(c.body, [0, 0.42, 0], [-0.06, 0, 0]);
    const bc: V3 = [0, 0, 0];
    const br: V3 = [0.19, 0.18, 0.4];
    k.sphere(bg, col, 1, bc, br);
    k.sphere(bg, col, 0.2, [0, 0.01, 0.3], [1, 1, 1]);
    k.sphere(bg, col, 0.18, [0, -0.01, -0.28], [1.05, 0.95, 1.1]);
    k.sphere(bg, cream, 1, [0, -0.06, 0.05], [0.15, 0.13, 0.34], [0, 0, 0], { outline: false });
    // Long neck and head
    k.capsule(bg, col, 0.09, 0.12, [0, 0.1, 0.44], [0.9, 0, 0]);
    const hr = 0.22;
    const head = k.group(bg, [0, 0.2, 0.56]);
    c.head = head;
    catFace(head, hr, 0.26, 0x3a86e8);
    browMarks(head, hr);
    stripes(bg, bc, br, 6, 0.028);
    // Forelegs tucked under the chest, hind legs stretched back
    for (const sx of [-1, 1]) {
      // The outer group is registered as the leg (the walk animation only changes rotation.x), and the inner one then sets the direction with aim
      const fo = k.group(bg, [sx * 0.11, -0.08, 0.3]);
      c.legs.push({ g: fo, phase: sx > 0 ? 0 : PI, amp: 0.3 });
      // The leg parts are placed along -y, so point +y opposite to the direction the leg extends
      const fg = aim(k.group(fo), [0, 1, 0.35]);
      k.capsule(fg, col, 0.04, 0.16, [0, -0.1, 0]);
      k.sphere(fg, ink, 0.048, [0, -0.2, 0.0], [1.1, 0.7, 1.3]);
      const ho = k.group(bg, [sx * 0.12, -0.02, -0.3]);
      c.legs.push({ g: ho, phase: sx > 0 ? PI : 0, amp: 0.3 });
      const hg = aim(k.group(ho), [0, 0.3, 1]);
      k.sphere(hg, col, 0.085, [0, -0.02, 0], [1, 1.2, 1]);
      k.capsule(hg, col, 0.042, 0.18, [0, -0.16, 0]);
      k.sphere(hg, ink, 0.05, [0, -0.28, 0.0], [1.1, 0.7, 1.3]);
    }
    // Ink-colored neckerchief on the neck
    k.torus(bg, ink, 0.12, 0.028, [0, 0.1, 0.42], [PI / 2 - 0.4, 0, 0]);
    k.sphere(bg, ink, 0.035, [0.09, 0.04, 0.45]);
    // Two scrolls spread like wings (registered as wings, so they flap slightly)
    for (const xs of [-1, 1]) {
      const w = k.group(bg, [xs * 0.14, 0.12, -0.06], [0, xs * 0.55, 0]);
      scroll(k, w, [0, 0.3, 0], [0, 0, PI / 2], 0.56, 0.22, { text: 0x3a78d8, glowText: 1.3, seal: true });
      c.wings.push({ g: w, side: xs < 0 ? 1 : -1, base: 0.6, amp: 0.12, speed: 2.2 });
    }
    // Tail: raised high and then curling forward, the brush tip glowing blue
    brushTail(k.group(bg, [0, 0.04, -0.42]), [
      [0, 0, 0],
      [0, 0.1, -0.18],
      [0, 0.3, -0.34],
      [0, 0.55, -0.36],
      [0, 0.72, -0.24],
    ], 0.045, true, 0.2);
    // Ink-colored glow beneath the body and floating blue ink dots
    k.glow(c.body, new THREE.TorusGeometry(0.3, 0.03, 8, 40), blue, 1.4, [0, 0.06, 0], [PI / 2, 0, 0], 0.5);
    for (let i = 0; i < 5; i++) sparkle(k, c, c.body, i % 2 ? blue : 0xd8ecff, 0.022, [Math.cos(i * 1.3) * 0.5, 0.35 + (i % 3) * 0.25, Math.sin(i * 1.3) * 0.45 - 0.1], 0.07);
    for (let i = 0; i < 3; i++) {
      const d = k.group(c.body, [Math.cos(i * 2.1) * 0.35, 0.2 + i * 0.05, Math.sin(i * 2.1) * 0.3]);
      dot(k, d, ink, 0.02, [0, 0, 0]);
      k.cone(d, ink, 0.015, 0.04, [0, 0.01, 0], [0, 0, 0], 8, { outline: false });
      c.bobbers.push({ g: d, base: d.position.y, amp: 0.05, speed: 1.4 + i * 0.3, phase: i });
    }
  },

  // `eldarin`
  eldarin(k, c) {
    const col = 0xf4ecdc;
    const belly = 0xfff9ee;
    const gold = 0xe6c070;
    const mem = 0xf6dc9a;
    const sig = 0xffd24a;
    const q = quad(k, c, { col, belly, len: 0.56, r: 0.3, leg: 0.3, legR: 0.078, headR: 0.25, neck: 0.3, headZ: 0.1, paw: gold });
    const head = q.head;
    const hr = q.headR;
    // Head
    k.sphere(head, col, hr * 0.62, [0, -hr * 0.34, hr * 0.72], [0.92, 0.7, 1.25]);
    for (const sx of [-1, 1]) dot(k, head, 0x8a7458, 0.014, [sx * hr * 0.16, -hr * 0.22, hr * 1.42]);
    const ex = hr * 0.42;
    const ey = hr * 0.16;
    const er = hr * 0.26;
    k.eyes(head, { x: ex, y: ey, z: eyeZ(hr, ex, ey, er), r: er, iris: 0x3a9ae8 });
    for (const sx of [-1, 1]) {
      k.horn(head, gold, 0.042, 0.34, 0.16, [sx * hr * 0.46, hr * 0.62, -hr * 0.2], [-0.55, 0, -sx * 0.28]);
      k.blade(head, mem, 0.2, 0.1, 0.03, [sx * hr * 0.82, hr * 0.12, -hr * 0.3], [-1.0, sx * 0.4, -sx * 1.05]);
    }
    // Pact sigil emblem on the brow
    const fy = hr * 0.52;
    const sigil = k.group(head, [0, fy, Math.sqrt(hr * hr - fy * fy) + 0.004], [-0.55, 0, 0]);
    k.glow(sigil, new THREE.TorusGeometry(0.046, 0.009, 8, 28), sig, 2.8);
    const dia = new THREE.OctahedronGeometry(0.034);
    dia.scale(0.7, 1.2, 0.35);
    k.glow(sigil, dia, 0xfff2b0, 3);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      k.glow(sigil, new THREE.SphereGeometry(0.011, 8, 6), sig, 2.8, [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0]);
    }
    k.glowSphere(sigil, sig, 0.07, [0, 0, 0.005], 1.8, [1, 1, 0.3], 0.35);
    // Gold dorsal fins along the spine
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const y = i < 3 ? q.bodyY + q.r * 0.55 + (2 - i) * 0.12 + 0.1 : q.bodyY + q.r * 0.86 - (i - 3) * 0.02;
      const z = i < 3 ? q.len * 0.66 - i * 0.07 + 0.08 : q.len * 0.4 - (i - 3) * 0.2;
      k.cone(c.body, gold, 0.045 - t * 0.012, 0.13 - t * 0.03, [0, y, z], [-0.6, 0, 0], 6);
    }
    // Pale gold scales on the chest
    k.sphere(c.body, 0xf8e6b8, 0.16, [0, q.bodyY + 0.02, q.len * 0.72], [1, 1.1, 0.7], [0.3, 0, 0], { outline: false });
    // A pair of big wings
    for (const xs of [-1, 1]) {
      const g = k.group(c.body, [xs * 0.14, q.bodyY + q.r * 0.72, q.len * 0.22], [0, xs * 0.5, 0]);
      const L = 0.8;
      const W: [number, number] = [0, L * 0.5];
      const tips: [number, number][] = [
        [xs * L * 0.14, L * 1.06],
        [xs * L * 0.5, L * 0.86],
        [xs * L * 0.72, L * 0.5],
      ];
      const T: [number, number] = [xs * L * 0.42, L * 0.02];
      hard(k, g, membraneGeo([[0, 0], W, ...tips, T], 0.22), mem);
      boneBetween(k, g, col, [0, 0], W, 0.04, 0.034);
      k.sphere(g, gold, 0.045, [W[0], W[1], 0]);
      k.cone(g, gold, 0.025, 0.08, [W[0] - xs * 0.02, W[1] + 0.02, 0.02], [0, 0, xs * 0.8], 6);
      for (const tp of tips) {
        boneBetween(k, g, col, W, tp, 0.028, 0.012);
      }
      k.glowSphere(g, sig, 0.028, [tips[0][0], tips[0][1], 0], 2.6);
      c.wings.push({ g, side: xs < 0 ? 1 : -1, base: 0.5, amp: 0.14, speed: 2.4 });
    }
    // Light ring at the tail end
    const tip = tailChain(k, c, q.tail, col, 6, 0.1, 0.12, 0.2);
    k.blade(tip, mem, 0.16, 0.12, 0.03, [0, 0, 0.02], [-PI / 2, 0, 0]);
    const ring = k.glow(tip, new THREE.TorusGeometry(0.1, 0.014, 8, 36), sig, 2.6, [0, 0, -0.02], [0, 0, 0], 0.95);
    c.spinners.push({ g: ring, speed: 1.4, axis: 'z' });
    k.glowSphere(tip, 0xfff2b0, 0.035, [0, 0, -0.02], 3);
    for (let i = 0; i < 4; i++) sparkle(k, c, c.body, 0xffe9a0, 0.024, [Math.cos(i * 1.6) * 0.6, 0.6 + (i % 2) * 0.35, Math.sin(i * 1.6) * 0.5], 0.08);
  },

  // `astragate`
  astragate(k, c) {
    const stone = 0xd8d4c8;
    const stoneD = 0xaaa392;
    const gold = 0xe2b24a;
    const core = 0x8fd8ff;
    const b = biped(k, c, { col: stone, torsoR: 0.4, torsoH: 0.56, leg: 0.22, legR: 0.13, headR: 0.27, armLen: 0.3, armR: 0.11, hand: stoneD, foot: stoneD });
    const tc: V3 = [0, b.torsoY, 0];
    const trd: V3 = [b.tr, b.th * 0.62, b.tr * 0.88];
    // Starlight-stone core in the chest
    const cp = onEllipsoid(tc, trd, 0, 0.22, 1.0);
    const coreG = k.group(c.body, cp.p);
    coreG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cp.n);
    k.torus(coreG, gold, 0.1, 0.028, [0, 0, 0.01]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      k.cone(coreG, gold, 0.03, 0.08, [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0], [0, 0, a - PI / 2], 4);
    }
    const star = new THREE.OctahedronGeometry(0.075);
    star.scale(1, 1.3, 0.6);
    const sm = k.glow(coreG, star, core, 2.8, [0, 0, 0.03]);
    c.spinners.push({ g: sm, speed: 1.2, axis: 'y' });
    k.glowSphere(coreG, core, 0.15, [0, 0, 0.02], 1.8, [1, 1, 0.5], 0.3);
    // Gold markings: radiating outward from the core
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + PI / 6;
      const pts: [number, number][] = [];
      for (let j = 0; j <= 4; j++) {
        const rr = 0.3 + j * 0.2;
        pts.push([Math.cos(a) * rr * 0.9 + (j % 2 ? 0.05 : 0), 0.22 + Math.sin(a) * rr * 0.75]);
      }
      stroke(k, c.body, gold, surfPath(tc, trd, pts, 1.01), 0.018);
    }
    // Belt
    k.torus(c.body, gold, b.tr * 0.86, 0.03, [0, b.torsoY - b.th * 0.28, 0], [PI / 2, 0, 0]).scale.set(1, 0.9, 1);
    // Pauldrons
    for (const a of c.arms) {
      const pd = new THREE.IcosahedronGeometry(0.19, 0);
      pd.scale(1.1, 0.8, 1);
      hard(k, a.g, pd, stone, [a.side * 0.04, 0.04, 0]);
      k.torus(a.g, gold, 0.17, 0.02, [a.side * 0.04, -0.04, 0], [PI / 2, 0, 0]);
      k.glowSphere(a.g, core, 0.03, [a.side * 0.14, 0.08, 0.1], 2.4);
      // Stone block forearms and gold bracers
      k.cyl(a.g, stoneD, 0.13, 0.15, 0.18, [0, -0.26, 0], [0, 0, 0], 6);
      k.torus(a.g, gold, 0.14, 0.022, [0, -0.2, 0], [PI / 2, 0, 0]);
    }
    // Knee guards on the legs
    for (const l of c.legs) k.sphere(l.g, gold, 0.07, [0, -0.02, 0.1], [1, 1, 0.5]);
    // Head: a stone helm, a dark visor, glowing eyes
    const head = b.head;
    const hr = b.headR;
    k.sphere(head, 0x2e3346, hr * 0.8, [0, -hr * 0.05, hr * 0.3], [1.05, 0.62, 0.9], [0, 0, 0], { outline: false });
    k.eyes(head, { x: hr * 0.34, y: -hr * 0.04, z: hr * 0.84, r: hr * 0.2, iris: core, glow: true });
    k.cone(head, stone, hr * 0.28, hr * 0.5, [0, hr * 0.78, -hr * 0.1], [-0.35, 0, 0], 4);
    k.torus(head, gold, hr * 0.98, 0.022, [0, hr * 0.28, 0], [PI / 2 - 0.1, 0, 0]);
    for (const sx of [-1, 1]) k.cone(head, gold, 0.045, 0.2, [sx * hr * 0.85, hr * 0.35, -hr * 0.1], [-0.3, 0, -sx * 0.9], 4);
    const hstar = new THREE.OctahedronGeometry(0.04);
    hstar.scale(0.8, 1.2, 0.5);
    k.glow(head, hstar, 0xfff2b0, 3, [0, hr * 0.62, hr * 0.8], [-0.6, 0, 0]);
    // Rotating Star Gate halo behind it
    const gate = k.group(c.body, [0, b.torsoY + 0.36, -0.42]);
    const ringG = k.group(gate);
    k.torus(ringG, stone, 0.64, 0.05, [0, 0, 0], [0, 0, 0]);
    k.torus(ringG, gold, 0.58, 0.015, [0, 0, 0.02], [0, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      hard(k, ringG, new THREE.BoxGeometry(0.07, 0.13, 0.12), i % 2 ? gold : stoneD, [Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0], [0, 0, a - PI / 2]);
      if (i % 2 === 0) k.glowSphere(ringG, core, 0.025, [Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0.07], 2.8);
    }
    c.spinners.push({ g: ringG, speed: 0.35, axis: 'z' });
    const inner = k.glow(gate, new THREE.TorusGeometry(0.52, 0.012, 8, 64), core, 2.4, [0, 0, 0], [0, 0, 0], 0.9);
    c.spinners.push({ g: inner, speed: -0.8, axis: 'z' });
    const disc = k.glow(gate, new THREE.CircleGeometry(0.52, 48), 0x6ab0ff, 1.2, [0, 0, -0.01], [0, 0, 0], 0.22);
    (disc.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      const st = new THREE.OctahedronGeometry(0.03);
      k.glow(inner, st, 0xe8f6ff, 2.8, [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.01]);
    }
    for (let i = 0; i < 4; i++) sparkle(k, c, c.body, core, 0.025, [Math.cos(i * 1.6) * 0.7, 0.5 + (i % 2) * 0.5, Math.sin(i * 1.6) * 0.4], 0.08);
  },

  // `voidchild`
  voidchild(k, c) {
    floater(c, 0.35);
    const voidC = 0x0e0a1c;
    const crack = 0xd02a8a;
    const gold = 0xe8c060;
    const R = 0.42;
    const cy = 0.78;
    const body = k.group(c.body, [0, cy, 0]);
    c.head = body;
    k.sphere(body, voidC, R);
    // Star points
    const N = 34;
    for (let i = 0; i < N; i++) {
      const yv = 1 - (i + 0.5) * (2 / N);
      const rr = Math.sqrt(1 - yv * yv);
      const a = i * 2.39996;
      const d = new THREE.Vector3(Math.cos(a) * rr, yv, Math.sin(a) * rr);
      if (d.z > 0.55 && Math.abs(d.x) < 0.55 && d.y > -0.5 && d.y < 0.55) continue; // Avoid the eye
      const big = i % 5 === 0;
      k.glowSphere(body, big ? 0xffffff : i % 2 ? 0xd8c8ff : 0xff9ad8, big ? 0.017 : 0.011, [d.x * R * 0.995, d.y * R * 0.995, d.z * R * 0.995], big ? 3 : 2.4);
    }
    // Purple-red cracks
    const cracks: [number, number, number, number][] = [
      // Starting yaw, pitch, direction dyaw, dpitch
      [0.95, 0.55, 0.22, -0.2],
      [-1.0, 0.35, -0.2, 0.22],
      [0.6, -0.55, 0.26, 0.05],
      [-0.55, -0.62, -0.2, -0.12],
      [2.4, 0.3, 0.22, 0.2],
      [-2.5, -0.1, -0.2, 0.25],
      [0.2, 0.95, 0.35, 0.02],
    ];
    for (const [y0, p0, dy, dp] of cracks) {
      const pts: [number, number][] = [];
      for (let j = 0; j < 5; j++) {
        const zig = (j % 2 ? 1 : -1) * 0.07;
        pts.push([y0 + dy * j + zig * Math.sign(dp || 1), p0 + dp * j - zig * Math.sign(dy)]);
      }
      stroke(k, body, crack, surfPath([0, 0, 0], [R, R, R], pts, 1.003), 0.016, 2.6);
      // Branching
      const [by, bp] = pts[2];
      stroke(k, body, crack, surfPath([0, 0, 0], [R, R, R], [[by, bp], [by + dp * 1.2, bp + dy * 0.9], [by + dp * 1.6, bp + dy * 1.8]], 1.003), 0.01, 2.4);
    }
    // One big eye
    const eye = k.group(body, [0, 0.03, R * 0.9]);
    k.glow(eye, new THREE.TorusGeometry(0.19, 0.014, 8, 40), crack, 2.6, [0, 0, 0.02], [0, 0, 0], 1).scale.set(1, 1.1, 1);
    const eg = k.group(eye);
    const sclera = new THREE.SphereGeometry(0.17, 24, 18);
    sclera.scale(1, 1.1, 0.5);
    k.mesh(eg, sclera, 0xffffff);
    const iris = new THREE.SphereGeometry(0.125, 20, 16);
    iris.scale(1, 1.12, 0.45);
    k.mesh(eg, iris, 0xc2227e, [0, -0.01, 0.035], [0, 0, 0], { outline: false });
    const irisIn = new THREE.SphereGeometry(0.085, 18, 14);
    irisIn.scale(1, 1.12, 0.45);
    k.mesh(eg, irisIn, 0x6a1a8a, [0, -0.015, 0.045], [0, 0, 0], { outline: false });
    const pupil = new THREE.SphereGeometry(0.05, 16, 12);
    pupil.scale(1, 1.15, 0.4);
    k.mesh(eg, pupil, 0x0a0612, [0, -0.015, 0.058], [0, 0, 0], { outline: false });
    k.glowSphere(eg, 0xffffff, 0.035, [-0.045, 0.05, 0.07], 1.8);
    k.glowSphere(eg, 0xffffff, 0.017, [0.045, -0.05, 0.07], 1.6);
    c.eyes.push(eg);
    k.blush(body, 0.25, -0.2, R * 0.78, 0.045, 0xd8508a);
    // Broken crown floating above the head
    const crown = k.group(c.body, [0, cy + R + 0.16, 0]);
    c.spinners.push({ g: crown, speed: 0.5, axis: 'y' });
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * PI * 2 + 0.2;
      const am = a0 + 0.6;
      const off = 0.03 + (i % 2) * 0.02;
      const pg = k.group(crown, [Math.cos(am) * off, (i % 2) * 0.05 - 0.02, Math.sin(am) * off], [((i % 3) - 1) * 0.25, 0, ((i % 2) * 2 - 1) * 0.2]);
      k.torus(pg, gold, 0.2, 0.024, [0, 0, 0], [PI / 2, 0, a0], 1.2);
      const sx = Math.cos(am) * 0.2;
      const sz = Math.sin(am) * 0.2;
      k.cone(pg, gold, 0.03, 0.1, [sx, 0, sz], [0, 0, 0], 4);
      k.glowSphere(pg, i % 2 ? 0xff4aa8 : 0xa06aff, 0.022, [sx * 1.05, 0.01, sz * 1.05], 2.6);
      c.bobbers.push({ g: pg, base: pg.position.y, amp: 0.03, speed: 1.4 + i * 0.2, phase: i * 1.6 });
    }
    // Shadow tentacles
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + PI / 6;
      const tg = k.group(c.body, [Math.cos(a) * 0.2, cy - R * 0.78, Math.sin(a) * 0.2], [0, PI / 2 - a, 0]);
      const sw = k.group(tg, [0, 0, 0], [0, 0, 0]);
      k.horn(sw, 0x2a1a48, 0.07, 0.5 - (i % 2) * 0.08, 0.16, [0, 0, 0], [PI - 0.35, 0, 0]);
      c.tails.push({ g: sw, phase: i * 1.1, amp: 0.18, axis: 'x' });
    }
    // Orbiting void fragments and orbit rings
    const orbit = k.glow(c.body, new THREE.TorusGeometry(0.66, 0.01, 6, 64, PI * 1.4), 0xa02ac8, 2, [0, cy, 0], [PI / 2 + 0.35, 0.2, 0], 0.8);
    c.spinners.push({ g: orbit, speed: 0.9, axis: 'z' });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + 0.5;
      const shard = new THREE.OctahedronGeometry(0.05);
      shard.scale(0.7, 1.4, 0.7);
      const m = hard(k, c.body, shard, 0x2a1a48, [Math.cos(a) * 0.62, cy + 0.1 + i * 0.08, Math.sin(a) * 0.45], [0.3, a, 0.4]);
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.05, speed: 1.3, phase: i * 2 });
    }
  },

  // `chronodragon` (fallback for the old model; the new model is the time-sand ancient snail, not a dragon)
  chronodragon(k, c) {
    const col = 0xd8b878;
    const belly = 0xf4e4bc;
    const bronze = 0x8a5a2a;
    const gold = 0xe8b848;
    const sand = 0xffe8a0;
    const steel = 0x2c4a8a;
    const q = quad(k, c, { col, belly, len: 0.56, r: 0.32, leg: 0.27, legR: 0.085, headR: 0.26, neck: 0.18, headZ: 0.08, paw: bronze });
    const head = q.head;
    const hr = q.headR;
    k.sphere(head, col, hr * 0.62, [0, -hr * 0.34, hr * 0.7], [0.95, 0.72, 1.2]);
    for (const sx of [-1, 1]) dot(k, head, 0x6a4a2a, 0.014, [sx * hr * 0.16, -hr * 0.22, hr * 1.38]);
    const ex = hr * 0.42;
    const ey = hr * 0.14;
    const er = hr * 0.26;
    k.eyes(head, { x: ex, y: ey, z: eyeZ(hr, ex, ey, er), r: er, iris: 0x1f9a9a });
    // Horns like clock hands
    const hub = k.group(head, [0, hr * 0.86, -hr * 0.12], [-0.3, 0, 0]);
    k.sphere(hub, gold, 0.045, [0, 0, 0]);
    const hand = (len: number, w: number, ang: number) => {
      const sh = new THREE.Shape();
      sh.moveTo(-w * 0.5, 0);
      sh.lineTo(-w * 0.5, len * 0.62);
      sh.lineTo(-w * 1.6, len * 0.72);
      sh.lineTo(0, len);
      sh.lineTo(w * 1.6, len * 0.72);
      sh.lineTo(w * 0.5, len * 0.62);
      sh.lineTo(w * 0.5, 0);
      sh.closePath();
      const hole = new THREE.Path();
      hole.absarc(0, len * 0.75, w * 0.55, 0, PI * 2, true);
      sh.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 });
      g.translate(0, 0, -0.015);
      hard(k, hub, g, steel, [0, 0, 0], [0, 0, ang]);
    };
    hand(0.36, 0.04, -0.42);
    hand(0.24, 0.05, 0.62);
    for (const sx of [-1, 1]) k.blade(head, gold, 0.16, 0.09, 0.03, [sx * hr * 0.84, hr * 0.1, -hr * 0.3], [-1.0, sx * 0.4, -sx * 1.05]);
    // Spine
    for (let i = 0; i < 5; i++) k.cone(c.body, bronze, 0.04, 0.1, [0, q.bodyY + q.r * 0.84, q.len * 0.5 - i * 0.24 - (i > 1 ? 0.18 : 0)], [-0.5, 0, 0], 6);
    // Gold rings on the legs
    for (const l of c.legs) k.torus(l.g, gold, 0.09, 0.018, [0, -0.08, 0], [PI / 2, 0, 0]);
    // Hourglass on the back
    const hg = k.group(q.back, [0, 0.02, -0.08]);
    const H = 0.5;
    k.cyl(hg, bronze, 0.17, 0.17, 0.045, [0, 0, 0], [0, 0, 0], 20);
    k.cyl(hg, bronze, 0.17, 0.17, 0.045, [0, H, 0], [0, 0, 0], 20);
    k.sphere(hg, gold, 0.045, [0, H + 0.05, 0]);
    const posts = k.group(hg);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + PI / 2;
      k.lathe(posts, gold, [
        [0.001, 0.02],
        [0.024, 0.02],
        [0.018, 0.08],
        [0.028, H * 0.5],
        [0.018, H - 0.08],
        [0.024, H - 0.02],
        [0.001, H - 0.02],
      ], [Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14]);
    }
    c.spinners.push({ g: posts, speed: 0.4, axis: 'y' });
    const glassPts: [number, number][] = [
      [0.001, 0.025],
      [0.11, 0.03],
      [0.12, 0.09],
      [0.03, H * 0.46],
      [0.02, H * 0.5],
      [0.03, H * 0.54],
      [0.12, H - 0.09],
      [0.11, H - 0.03],
      [0.001, H - 0.025],
    ];
    const glass = new THREE.LatheGeometry(glassPts.map(([x, y]) => new THREE.Vector2(x, y)), 28);
    k.glow(hg, glass, 0xdff4ff, 1.1, [0, 0, 0], [0, 0, 0], 0.3);
    const pile = new THREE.ConeGeometry(0.105, 0.1, 20);
    pile.translate(0, 0.075, 0);
    k.glow(hg, pile, sand, 2.2);
    const topSand = new THREE.LatheGeometry([new THREE.Vector2(0.001, H * 0.52), new THREE.Vector2(0.02, H * 0.54), new THREE.Vector2(0.1, H - 0.12), new THREE.Vector2(0.001, H - 0.12)], 20);
    k.glow(hg, topSand, sand, 2.2);
    k.glow(hg, new THREE.CylinderGeometry(0.006, 0.006, H * 0.4, 6), 0xfff4d0, 3, [0, H * 0.32, 0]);
    for (let i = 0; i < 3; i++) sparkle(k, c, hg, sand, 0.014, [Math.cos(i * 2.1) * 0.03, H * (0.18 + i * 0.07), Math.sin(i * 2.1) * 0.03], 0.02);
    // Wings shaped like an hourglass frame
    for (const xs of [-1, 1]) {
      const g = k.group(c.body, [xs * 0.18, q.bodyY + q.r * 0.7, q.len * 0.3], [0, xs * 0.5, 0]);
      const L = 0.7;
      const tips: [number, number][] = [
        [xs * L * 0.08, L],
        [xs * L * 0.6, L * 0.8],
        [xs * L * 0.62, L * 0.2],
      ];
      k.glow(g, membraneGeo([[0, 0], ...tips, [xs * L * 0.2, 0]], 0.28), sand, 1.3, [0, 0, 0], [0, 0, 0], 0.55);
      for (const tp of tips) {
        const len = Math.hypot(tp[0], tp[1]);
        const post = k.group(g, [0, 0, 0], [0, 0, Math.atan2(-tp[0], tp[1])]);
        k.lathe(post, gold, [
          [0.001, 0],
          [0.03, 0.01],
          [0.018, 0.08],
          [0.03, len * 0.5],
          [0.016, len - 0.06],
          [0.03, len - 0.02],
          [0.001, len],
        ]);
        k.cyl(post, bronze, 0.05, 0.05, 0.03, [0, len, 0], [0, 0, 0], 12);
      }
      for (let i = 0; i < 3; i++) k.glowSphere(g, 0xfff4d0, 0.018, [xs * L * (0.2 + i * 0.13), L * (0.35 + (i % 2) * 0.2), 0.02], 2.8);
      c.wings.push({ g, side: xs < 0 ? 1 : -1, base: 0.55, amp: 0.14, speed: 2.2 });
    }
    // Pendulum at the tail end
    const tip = tailChain(k, c, q.tail, col, 5, 0.1, 0.12, 0.25);
    const lv = levelGroup(k, tip, [0, 0, -0.02]);
    const pend = k.group(lv);
    k.cyl(pend, bronze, 0.012, 0.012, 0.16, [0, -0.08, 0], [0, 0, 0], 6);
    k.cyl(pend, gold, 0.07, 0.07, 0.025, [0, -0.2, 0], [PI / 2, 0, 0], 20);
    k.glowSphere(pend, sand, 0.03, [0, -0.2, 0.015], 2.4);
    c.tails.push({ g: pend, phase: 0.5, amp: 0.35, axis: 'z' });
    for (let i = 0; i < 4; i++) sparkle(k, c, c.body, sand, 0.02, [Math.cos(i * 1.6) * 0.6, 0.5 + (i % 2) * 0.35, Math.sin(i * 1.6) * 0.5], 0.08);
  },
};
