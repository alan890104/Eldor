// Remakes of the first batch's 7 SR spirits (single form; stages II / III add breakthrough light effects; in the game they are always assembled at stage III, see buildCreature in species.ts). The builders here override the same-named BASE entries in species.ts.

import * as THREE from 'three';
import type { Creature, Kit } from '../creature.ts';
import { ears, floater, PI, sparkle, type Builder, type Stage, type V3 } from '../parts.ts';

// ───────────────────────── Helpers (written the same way as the SSR helpers at the top of species.ts; each file keeps its own copy here) ─────────────────────────

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
  const m = k.mesh(parent, geo, col, pos, rot, { ...o, outline: false });
  const om = k.c.outlines[0];
  if (om) m.add(new THREE.Mesh(weld(geo), om));
  return m;
}

/** Tube along a curve with variable radius (neck, tail, tentacle, body) */
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

/** Capsule between two points (bone, strut) */
function link(k: Kit, parent: THREE.Object3D, color: C, a: V3, b: V3, r: number, o: PO = {}): THREE.Mesh {
  const A = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(A);
  const len = Math.max(0.002, d.length());
  const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
  const m = k.mesh(parent, geo, color, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [0, 0, 0], o);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Thin glowing tube between two points (energy vein) */
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

/** Thin plate extruded from a 2D outline (wing membrane, crown, book page), centered on z */
function poly(pts: [number, number][], depth: number, curveSegments = 8): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * Crescent / sickle-shaped thin plate: outer arc radius Ro, spread angle arc (arc apex at +y), thickness thick at the middle, with both ends tapering to points; lies in the xy plane (thickness along z).
 * The inner arc is another circle through the two tips, so the blade thins naturally from the middle toward both ends.
 */
function crescent(Ro: number, arc: number, thick: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const n = 16;
  const half = arc / 2;
  for (let i = 0; i <= n; i++) {
    const a = -half + (i / n) * arc;
    const x = Math.sin(a) * Ro;
    const y = Math.cos(a) * Ro;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  // Inner circle: center (0, off), passing through both tips, with its apex at y = Ro - thick
  const m = Ro - thick;
  const off = (Ro * Ro - m * m) / (2 * (Ro * Math.cos(half) - m));
  const Ri = m - off;
  const tipA = Math.atan2(Math.sin(half) * Ro, Math.cos(half) * Ro - off);
  for (let i = n; i >= 0; i--) {
    const a = -tipA + (i / n) * tipA * 2;
    s.lineTo(Math.sin(a) * Ri, Math.cos(a) * Ri + off);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
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

/** Flat spot stuck on an ellipsoid surface (markings, face mask, blush), normal facing outward */
function spot(k: Kit, parent: THREE.Object3D, col: C, center: V3, radii: V3, dir: THREE.Vector3, r: number, o: PO = {}, flat = 0.22, scale: V3 = [1, 1, 1]): THREE.Mesh {
  const d = dir.clone().normalize();
  const p: V3 = [center[0] + d.x * radii[0], center[1] + d.y * radii[1], center[2] + d.z * radii[2]];
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(scale[0], scale[1], flat * scale[2]);
  const m = k.mesh(parent, g, col, p, [0, 0, 0], { outline: false, ...o });
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
  lowSphere(k, g, o.col, r * 1.35, [0, -0.01, 0], [1, 1.15, 1.05]);
  k.capsule(g, o.col, r, L * 0.3, [0, -L * 0.3, f ? 0.01 : -0.05], [f ? -bend * 0.4 : bend, 0, 0]);
  lowSphere(k, g, o.joint ?? o.col, r * 0.92, [0, -L * 0.56, f ? 0.025 : -0.1]);
  k.capsule(g, o.col, r * 0.8, L * 0.26, [0, -L * 0.78, f ? 0.03 : -0.06], [f ? 0.05 : -bend * 0.55, 0, 0]);
  const fr = o.footR ?? r * 1.2;
  const foot = k.group(g, [0, -L + fr * 0.62, f ? 0.05 : 0.0]);
  lowSphere(k, foot, o.foot ?? o.col, fr, [0, 0, 0], o.footScale ?? [1.1, 0.6, 1.3]);
  c.legs.push({ g, phase: sx * (f ? 1 : -1) > 0 ? 0 : PI, amp: 1 });
  return { g, foot };
}

/** Low-poly sphere (small parts that come in large numbers) */
function lowSphere(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PO = {}): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 12, 9);
  g.scale(...scale);
  return k.mesh(parent, g, col, pos, rot, o);
}

/** One feather / leaf: a main-color blade + a paler edge (no outline) + a point of light at the tip */
function feather(k: Kit, parent: THREE.Object3D, col: C, edge: C, L: number, w: number, pos: V3, rot: V3, tip?: C, o: PO = {}): THREE.Group {
  const g = k.group(parent, pos, rot);
  k.blade(g, col, L, w, 0.045, [0, 0, 0], [0, 0, 0], o);
  k.blade(g, edge, L * 1.05, w * 1.15, 0.028, [0, 0, 0], [0, 0, 0], { outline: false });
  if (tip) k.glowSphere(g, tip, w * 0.14, [0, L * 0.98, 0], 2.4);
  return g;
}

/** Constant for triangle-count statistics: the multiplier for the breakthrough stage's light effects */
const AWAKE = (s: Stage) => (s === 3 ? 1 : s === 2 ? 0.6 : 0);

// ───────────────────────── Species ─────────────────────────

export const SPECIES_FIRSTSR: Record<string, Builder> = {
  /** `gale_weasel`: a slender, low-slung white weasel, forelimbs carrying sickle blades, a crescent wind sickle held up at the tail end, three wind rings and three wind spirits, the "Companion Souls", orbiting it; after breakthrough wind markings appear on its fur and a whirlwind curls up behind the tail */
  gale_weasel(k, c, s) {
    c.archetype = 'quad';
    const fur = 0xe3efe9;
    const furDk = 0xc6ddd5;
    const belly = 0xfafffd;
    const teal = 0x4fcfb4;
    const tealDk = 0x2a8a78;
    const dark = 0x20242e;
    const bladeCol = 0xcff8ff;
    const bladeGlow = 0x6ff0ff;
    const wind = 0x8ff5e0;
    const windHi = 0xe8fffb;
    const gold = 0xffcf5a;
    const aw = AWAKE(s);
    const by = 0.3;

    // Body: one long, low tube thickening and thinning along the spine (chest slightly deeper, waist narrow), a white tube along the belly side
    const spine = [v3(0, by + 0.02, 0.52), v3(0, by + 0.04, 0.26), v3(0, by + 0.03, 0), v3(0, by + 0.02, -0.26), v3(0, by - 0.02, -0.5)];
    const body = taperTube(spine, (t) => 0.095 + 0.04 * Math.sin(t * PI) + 0.03 * (1 - t) * (1 - t), 40, 14);
    k.mesh(c.body, body.geo, fur);
    const bellyT = taperTube(spine.map((p) => p.clone().add(v3(0, -0.045, 0))), (t) => 0.078 + 0.032 * Math.sin(t * PI) + 0.02 * (1 - t) * (1 - t), 32, 12);
    k.mesh(c.body, bellyT.geo, belly, [0, 0, 0], [0, 0, 0], { outline: false });
    // Fur tufts on the shoulder and haunch, a row of pale fur along the spine
    k.sphere(c.body, fur, 0.12, [0, by + 0.03, 0.36], [1.2, 0.95, 1]);
    k.sphere(c.body, fur, 0.115, [0, by + 0.02, -0.36], [1.15, 0.9, 1]);
    for (let i = 0; i < 6; i++) k.blade(c.body, furDk, 0.07, 0.06, 0.025, [0, by + 0.135 - Math.sin((i / 5) * PI) * 0.01, 0.3 - i * 0.13], [-2.3, 0, 0], { outline: false });

    // Four short legs (each foreleg has a backward-curving sickle blade on its outer side)
    for (const sx of [-1, 1]) {
      const fl = quadLeg(k, c, c.body, sx, 0.085, 0.36, { col: fur, joint: furDk, r: 0.038, len: 0.24, front: true, foot: teal, footR: 0.044 });
      const bl = quadLeg(k, c, c.body, sx, 0.085, -0.36, { col: fur, joint: furDk, r: 0.042, len: 0.24, front: false, foot: teal, footR: 0.046 });
      for (const leg of [fl, bl]) for (let i = -1; i <= 1; i++) k.horn(leg.foot, dark, 0.008, 0.03, 0.01, [i * 0.025, 0.002, 0.05], [PI / 2 + 0.1, 0, i * 0.2], { outline: false });
      k.torus(fl.g, tealDk, 0.046, 0.014, [0, -0.15, 0.01], [PI / 2, 0, 0], PI * 2, { outline: false });
      k.torus(bl.g, tealDk, 0.048, 0.013, [0, -0.15, -0.02], [PI / 2, 0, 0], PI * 2, { outline: false });
      // Sickle blade: an upright crescent stuck on the outside of the forearm, the curved face toward the back
      const sickle = k.group(fl.g, [sx * 0.055, -0.085, -0.04], [0, sx * 0.12, 0]);
      hard(k, sickle, crescent(0.15, PI * 0.95, 0.045, 0.012), bladeCol, [0, 0, 0], [-PI / 2, PI / 2, 0], { emissive: bladeGlow, emissiveAmt: 0.55 + aw * 0.35 });
      k.sphere(sickle, tealDk, 0.024, [0, 0, 0.01]);
      k.glowSphere(sickle, windHi, 0.012, [0, 0.15, 0], 2.4);
    }
    // Belt and herb pouch (the one that applies the poultice)
    const belt = k.group(c.body, [0, by + 0.02, -0.12]);
    k.torus(belt, tealDk, 0.128, 0.018, [0, 0, 0], [0, 0, 0]);
    k.sphere(belt, 0x8a6a3a, 0.045, [0.12, -0.07, 0.0], [0.8, 1, 0.7]);
    k.torus(belt, gold, 0.026, 0.007, [0.12, -0.035, 0.0], [PI / 2, 0, 0], PI * 2, { outline: false });
    for (let i = 0; i < 2; i++) k.blade(belt, 0x6fd86a, 0.055, 0.028, 0.01, [0.11 + i * 0.02, -0.03, 0.0], [-0.4 + i * 0.5, 0, 0.5 - i * 0.9], { outline: false });

    // Neck and head: a pointed head reaching forward, a white muzzle, sharp eyes, green markings above the eyes, ears, whiskers
    k.capsule(c.body, fur, 0.075, 0.14, [0, by + 0.09, 0.6], [1.05, 0, 0]);
    const head = k.group(c.body, [0, by + 0.16, 0.7], [0.1, 0, 0]);
    c.head = head;
    k.sphere(head, fur, 0.15, [0, 0, 0], [0.95, 0.86, 1.05]);
    k.sphere(head, fur, 0.088, [0, -0.04, 0.115], [1, 0.72, 1.3]);
    k.sphere(head, belly, 0.066, [0, -0.068, 0.105], [1.05, 0.5, 1.25], [0, 0, 0], { outline: false });
    k.sphere(head, dark, 0.028, [0, -0.008, 0.228], [1, 0.8, 0.8]);
    k.eyes(head, { x: 0.074, y: 0.032, z: 0.115, r: 0.05, iris: 0x1a8a7a, sharp: true, glow: s === 3, yaw: 0.3 });
    for (const sx of [-1, 1]) {
      spot(k, head, teal, [0, 0, 0], [0.143, 0.13, 0.158], v3(sx * 0.72, 0.62, 0.55), 0.045, {}, 0.2, [1.9, 0.45, 1]);
      k.sphere(head, tealDk, 0.032, [sx * 0.08, 0.08, 0.108], [1.3, 0.28, 0.6], [0, 0, sx * 0.55], { outline: false });
      k.blade(head, fur, 0.09, 0.065, 0.03, [sx * 0.12, -0.035, -0.01], [0.4, 0, sx * 2.2]);
      for (let i = 0; i < 2; i++) k.cyl(head, 0xffffff, 0.0035, 0.0035, 0.13, [sx * 0.095, -0.03 - i * 0.02, 0.165], [0, 0, sx * (PI / 2 + 0.2 - i * 0.35)], 4, { outline: false });
    }
    ears(k, c, head, fur, teal, 0.046, 0.1, 0.09, 0.11, 0.45, -0.02);
    // Neckerchief: a green scarf, a gold bell, two ribbons streaming behind the head
    const scarf = k.group(c.body, [0, by + 0.12, 0.56], [0.55, 0, 0]);
    k.torus(scarf, tealDk, 0.085, 0.028, [0, 0, 0], [PI / 2, 0, 0]);
    k.sphere(scarf, gold, 0.02, [0, -0.02, 0.09], [1, 1, 0.6], [0, 0, 0], { emissive: gold, emissiveAmt: 0.4 });
    for (const sx of [-1, 1]) {
      const rb = k.group(k.group(scarf, [sx * 0.035, 0.02, -0.07], [-1.25, 0, sx * 0.55]));
      k.blade(rb, tealDk, 0.24, 0.055, 0.02, [0, 0, 0]);
      k.blade(rb, teal, 0.22, 0.026, 0.022, [0, 0.02, 0], [0, 0, 0], { outline: false });
      c.tails.push({ g: rb, phase: sx * 1.3, amp: 0.25, axis: 'x' });
    }

    // Tail: a long tail curled upward, a crescent wind sickle held up at its tip (the tail end is inserted into the middle of the blade)
    const tailG = k.group(c.body, [0, by - 0.02, -0.5]);
    const tailPts = [v3(0, 0, 0), v3(0, 0.02, -0.18), v3(0, 0.12, -0.32), v3(0, 0.3, -0.36), v3(0, 0.46, -0.3)];
    const tail = taperTube(tailPts, (t) => 0.055 * (1 - t * 0.5), 36, 12);
    k.mesh(tailG, tail.geo, fur);
    const scythe = k.group(tailG, [0, 0.47, -0.295], [0.35, 0, 0]);
    k.cyl(scythe, tealDk, 0.02, 0.028, 0.07, [0, 0.01, 0]);
    k.torus(scythe, gold, 0.026, 0.006, [0, 0.04, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    hard(k, scythe, crescent(0.24, PI * 1.05, 0.07, 0.014), bladeCol, [0, -0.11, 0], [0, PI / 2, 0], { emissive: bladeGlow, emissiveAmt: 0.6 + aw * 0.3 });
    for (const sz of [-1, 1]) k.glowSphere(scythe, windHi, 0.014, [0, -0.11 + Math.cos(PI * 0.525) * 0.24, sz * Math.sin(PI * 0.525) * 0.24], 2.6);
    c.tails.push({ g: tailG, phase: 0, amp: 0.22, axis: 'y' });

    // Wind: three tilted wind rings each rotating
    spinRing(k, c, c.body, wind, 0.46, 0.007, [0, by + 0.02, 0.04], [PI / 2, 0, 0], 2.6, 'y', { beads: 2, beadCol: windHi, beadR: 0.014, intensity: 1.8, opacity: 0.6, arc: PI * 1.25 });
    spinRing(k, c, c.body, windHi, 0.56, 0.006, [0, by + 0.06, 0.02], [PI / 2 + 0.4, 0.2, 0], -1.9, 'y', { beads: 2, beadCol: 0xffffff, beadR: 0.012, intensity: 1.6, opacity: 0.5, arc: PI * 1.05 });
    if (s >= 2) spinRing(k, c, c.body, wind, 0.66, 0.006, [0, by - 0.02, 0.0], [PI / 2 - 0.35, -0.4, 0], 1.3, 'y', { beads: 3, beadCol: windHi, beadR: 0.012, opacity: 0.5, arc: PI * 0.9 });
    // Three Companion Souls: three wind spirits trailing wind tails run around the body (tripping, slashing, applying poultice)
    const trio = k.group(c.body, [0, by + 0.1, 0.02]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      const w = k.group(trio, [Math.cos(a) * 0.6, (i - 1) * 0.08, Math.sin(a) * 0.52], [0, -a, 0]);
      k.glowSphere(w, i === 0 ? windHi : i === 1 ? bladeGlow : 0xbdf5c8, 0.034, [0, 0, 0], 2.8, [1, 0.85, 1.4]);
      for (const sx of [-1, 1]) k.glow(w, new THREE.ConeGeometry(0.011, 0.034, 6), windHi, 2.6, [sx * 0.02, 0.034, 0.0], [0, 0, -sx * 0.3], 0.9);
      glowPath(k, w, wind, [v3(0, 0, -0.02), v3(0.02, 0.01, -0.12), v3(-0.02, 0.03, -0.24)], 0.009, 2.2, 0.6, 12);
      c.bobbers.push({ g: w, base: w.position.y, amp: 0.04, speed: 2.4 + i * 0.5, phase: i * 2 });
    }
    c.spinners.push({ g: trio, speed: 1.6, axis: 'y' });
    // Breakthrough: wind markings appear on the fur, a whirlwind curls up behind the tail
    if (s >= 2) {
      for (const sx of [-1, 1]) {
        glowPath(k, c.body, wind, [v3(sx * 0.12, by + 0.06, 0.4), v3(sx * 0.135, by, 0.16), v3(sx * 0.13, by + 0.06, -0.1), v3(sx * 0.115, by - 0.01, -0.34)], 0.005, 1.8 + aw, 0.5 + aw * 0.4, 24);
        glowPath(k, c.body, wind, [v3(sx * 0.08, by + 0.13, 0.3), v3(sx * 0.1, by + 0.12, 0.05), v3(sx * 0.085, by + 0.12, -0.2)], 0.004, 1.8 + aw, 0.45 + aw * 0.4, 16);
      }
    }
    if (s === 3) {
      const vortex = k.group(c.body, [0, 0.06, -0.62]);
      for (let i = 0; i < 5; i++) {
        const R = 0.08 + i * 0.07;
        spinRing(k, c, vortex, i % 2 ? windHi : wind, R, 0.006, [0, i * 0.14, 0], [PI / 2, 0, i * 1.1], 4.2 - i * 0.4, 'y', { beads: 1, beadCol: 0xffffff, beadR: 0.012, opacity: 0.55 - i * 0.05, arc: PI * 1.4 });
      }
      c.flickers.push({ g: vortex, base: vortex.scale.clone(), speed: 5, amt: 0.18 });
    }
    for (let i = 0; i < 2 + s; i++) sparkle(k, c, c.body, i % 2 ? windHi : wind, 0.012, [Math.cos(i * 2.1) * 0.5, 0.2 + (i % 3) * 0.2, Math.sin(i * 2.1) * 0.45], 0.06);
  },

  /** `sand_reaper`: a giant scorpion half-buried in quicksand, a pair of crescent sickle claws, a three-segment carapace, eight jointed legs, a venom tail curled over its back; a ring of rotating quicksand and kicked-up sand grains at its feet; after breakthrough amber light shows through the seams of the carapace, with a sandstorm and fragments of rock swirling around it */
  sand_reaper(k, c, s) {
    c.archetype = 'crawl';
    const sand = 0xd9a45a;
    const sandLt = 0xeccb8a;
    const brown = 0x8a5a2a;
    const dark = 0x5a3a1a;
    const amber = 0xffb030;
    const amberHi = 0xffe0a0;
    const bone = 0xf2e2c0;
    const dust = 0xe8c07a;
    const aw = AWAKE(s);
    const by = 0.2;

    // Cephalothorax and three abdominal plates: stacked flattened ellipsoids, a dark carapace edge at the rear of each segment, pale on the underside
    k.sphere(c.body, sand, 1, [0, by, 0.16], [0.27, 0.13, 0.3]);
    k.sphere(c.body, brown, 1, [0, by + 0.03, 0.14], [0.2, 0.09, 0.22], [0, 0, 0], { outline: false });
    k.sphere(c.body, sand, 1, [0, by + 0.06, 0.16], [0.17, 0.08, 0.2], [0, 0, 0], { outline: false });
    const segs: [number, number, number][] = [[-0.02, 0.24, 0.17], [-0.17, 0.22, 0.15], [-0.3, 0.19, 0.13]];
    segs.forEach(([z, w, l], i) => {
      k.sphere(c.body, sand, 1, [0, by - i * 0.012, z], [w, 0.11 - i * 0.01, l]);
      k.sphere(c.body, brown, 1, [0, by + 0.045 - i * 0.012, z - 0.06], [w * 0.85, 0.05, l * 0.55], [0, 0, 0], { outline: false });
    });
    k.sphere(c.body, sandLt, 1, [0, by - 0.05, 0.0], [0.22, 0.07, 0.42], [0, 0, 0], { outline: false });
    // Mouthparts: two small chelicerae pointing forward
    for (const sx of [-1, 1]) k.horn(c.body, dark, 0.016, 0.08, 0.03, [sx * 0.035, by - 0.02, 0.44], [PI / 2 + 0.2, 0, -sx * 0.4]);

    // Head: the eyes are at the front edge of the cephalothorax, a pair of main eyes (sharp, glowing after breakthrough) + two small eyes on each side
    const head = k.group(c.body, [0, by + 0.05, 0.36]);
    c.head = head;
    k.sphere(head, sand, 0.1, [0, 0, 0], [1.4, 0.7, 0.9]);
    k.eyes(head, { x: 0.065, y: 0.03, z: 0.07, r: 0.04, iris: amber, sharp: true, glow: s >= 2, yaw: 0.4 });
    for (const sx of [-1, 1]) {
      k.sphere(head, dark, 0.03, [sx * 0.07, 0.07, 0.05], [1.4, 0.3, 0.6], [0, 0, sx * 0.6], { outline: false });
      for (let i = 0; i < 2; i++) k.glowSphere(head, amber, 0.011, [sx * (0.11 + i * 0.02), 0.02 - i * 0.02, 0.02 - i * 0.04], 2.4);
    }

    // Eight jointed legs: coxa → femur outward and up → tibia outward and down → tarsus on the ground
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const z = 0.26 - i * 0.14;
        const flare = (i - 1.5) * 0.14;
        const g = k.group(c.body, [sx * 0.2, by - 0.02, z]);
        const knee: V3 = [sx * 0.16, 0.16, flare * 0.5];
        const ankle: V3 = [sx * 0.3, 0.02, flare];
        lowSphere(k, g, brown, 0.036, [0, 0, 0]);
        link(k, g, sand, [0, 0, 0], knee, 0.03);
        lowSphere(k, g, brown, 0.032, knee);
        link(k, g, sand, knee, ankle, 0.024);
        lowSphere(k, g, brown, 0.024, ankle);
        link(k, g, dark, ankle, [sx * 0.34, -by + 0.05, flare * 1.15], 0.016);
        c.legs.push({ g, phase: i * 1.3 + (sx > 0 ? PI : 0), amp: 0.4 });
      }
      // Sickle claws: the upper arm forward and outward, the forearm forward, and on the palm two crescent blades (large on the outside, small on the inside) spread open like a mouth
      const arm = k.group(c.body, [sx * 0.2, by + 0.02, 0.3], [0, sx * -0.55, 0]);
      lowSphere(k, arm, brown, 0.05, [0, 0, 0]);
      link(k, arm, sand, [0, 0, 0], [sx * 0.08, 0.05, 0.16], 0.04);
      lowSphere(k, arm, brown, 0.042, [sx * 0.08, 0.05, 0.16]);
      link(k, arm, sand, [sx * 0.08, 0.05, 0.16], [sx * 0.1, 0.02, 0.3], 0.036);
      const hand = k.group(arm, [sx * 0.1, 0.02, 0.32], [0, sx * 0.3, 0]);
      k.sphere(hand, sand, 0.075, [0, 0, 0.02], [1.1, 0.8, 1.2]);
      k.sphere(hand, brown, 0.05, [0, 0.045, 0.02], [1.1, 0.5, 1.1], [0, 0, 0], { outline: false });
      // Outer fixed blade: a crescent lying flat, curved face outward, the two blade tips one in front and one behind (the rear tip inserted into the palm)
      const outer = k.group(hand, [0, 0, 0.02], [0, -sx * 0.18, 0]);
      hard(k, outer, crescent(0.19, PI * 0.9, 0.06, 0.022), bone, [-sx * 0.06, 0, 0.17], [PI / 2, 0, -sx * PI * 0.5], { emissive: amber, emissiveAmt: 0.25 + aw * 0.4 });
      for (let i = 0; i < 3; i++) k.cone(outer, dark, 0.011, 0.035, [sx * (0.1 - i * 0.02), 0.012, 0.12 + i * 0.08], [0, 0, sx * 1.3], 6, { outline: false });
      // Inner movable blade: smaller, curved face inward, forming an open mouth together with the outer blade
      const inner = k.group(hand, [0, 0, 0.02], [0, sx * 0.3, 0]);
      hard(k, inner, crescent(0.14, PI * 0.85, 0.045, 0.02), bone, [sx * 0.05, 0.01, 0.13], [PI / 2, 0, sx * PI * 0.5], { emissive: amber, emissiveAmt: 0.25 + aw * 0.4 });
      c.arms.push({ g: arm, side: sx, base: new THREE.Euler(0, sx * -0.55, 0) });
    }

    // Venom tail: five segments from thick to thin, up and then curling forward over the back, ending in a venom sac and a glowing stinger
    let seg = k.group(k.group(c.body, [0, by + 0.03, -0.42], [-0.35, 0, 0]));
    c.tails.push({ g: seg, phase: 0, amp: 0.08, axis: 'z' });
    let r = 0.075;
    for (let i = 0; i < 5; i++) {
      lowSphere(k, seg, i % 2 ? sand : brown, r, [0, 0.05, 0], [0.95, 1.25, 0.95]);
      k.torus(seg, dark, r * 0.8, 0.008, [0, 0.11, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      const next = k.group(k.group(seg, [0, 0.13 + r * 0.6, 0], [0.46, 0, 0]));
      c.tails.push({ g: next, phase: (i + 1) * 0.5, amp: 0.04, axis: 'z' });
      seg = next;
      r *= 0.86;
    }
    lowSphere(k, seg, brown, 0.075, [0, 0.03, 0], [1, 1.25, 1]);
    k.horn(seg, dark, 0.03, 0.2, 0.09, [0, 0.1, 0.0], [0.5, 0, 0]);
    k.glowSphere(seg, amber, 0.028, [0, 0.06, -0.02], 2.8);
    const sting = k.glowSphere(seg, amberHi, 0.02, [0, 0.19, -0.1], 3);
    c.flickers.push({ g: sting, base: sting.scale.clone(), speed: 6, amt: 0.5 });

    // Quicksand: a few dunes at its feet, a ring of rotating quicksand, kicked-up sand grains
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3;
      const rr = 0.42 + (i % 3) * 0.08;
      lowSphere(k, c.body, i % 2 ? sandLt : dust, 0.12 + (i % 3) * 0.03, [Math.cos(a) * rr, 0.015, Math.sin(a) * rr], [1.4, 0.2, 1.1], [0, a, 0], { outline: false });
    }
    spinRing(k, c, c.body, dust, 0.54, 0.012, [0, 0.035, 0], [PI / 2, 0, 0], 1.4, 'y', { beads: 4, beadCol: sandLt, beadR: 0.02, intensity: 1.2, opacity: 0.7, arc: PI * 1.5 });
    spinRing(k, c, c.body, sandLt, 0.63, 0.008, [0, 0.02, 0], [PI / 2, 0, 0], -0.9, 'y', { beads: 3, beadCol: dust, beadR: 0.016, intensity: 1.1, opacity: 0.5, arc: PI * 1.2 });
    for (let i = 0; i < 5 + s; i++) {
      const a = i * 1.9;
      const m = lowSphere(k, c.body, i % 2 ? sandLt : dust, 0.014, [Math.cos(a) * 0.5, 0.08 + (i % 3) * 0.06, Math.sin(a) * 0.45], [1, 1, 1], [0, 0, 0], { outline: false });
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.05, speed: 1.5 + (i % 3) * 0.5, phase: i });
    }
    // Breakthrough: amber light shows through the carapace seams; at stage III a sandstorm ring and fragments of rock orbiting the body are added
    if (s >= 2) {
      for (const sx of [-1, 1]) glowPath(k, c.body, amber, [v3(sx * 0.2, by + 0.03, 0.26), v3(sx * 0.19, by + 0.02, 0.06), v3(sx * 0.15, by, -0.12), v3(sx * 0.1, by - 0.01, -0.3)], 0.006, 2 + aw, 0.6 + aw * 0.3, 20);
      glowPath(k, c.body, amber, [v3(0, by + 0.12, 0.3), v3(0, by + 0.13, 0.1), v3(0, by + 0.1, -0.1), v3(0, by + 0.07, -0.3)], 0.006, 2 + aw, 0.6 + aw * 0.3, 20);
    }
    if (s === 3) {
      spinRing(k, c, c.body, dust, 0.5, 0.01, [0, 0.4, -0.05], [PI / 2 + 0.3, 0, 0], 2.2, 'y', { beads: 3, beadCol: amberHi, beadR: 0.016, intensity: 1.4, opacity: 0.5, arc: PI * 1.1 });
      const rocks = k.group(c.body, [0, 0.3, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2;
        const g = new THREE.DodecahedronGeometry(0.035 + (i % 2) * 0.015, 0);
        const m = hard(k, rocks, g, i % 2 ? brown : sand, [Math.cos(a) * 0.62, (i % 2) * 0.12, Math.sin(a) * 0.55], [i, i * 0.7, 0]);
        c.bobbers.push({ g: m, base: m.position.y, amp: 0.04, speed: 1.6 + i * 0.3, phase: i * 1.5 });
      }
      c.spinners.push({ g: rocks, speed: 0.7, axis: 'y' });
    }
  },

  /** `magma_golem`: a volcanic-rock guardian cast by the dwarves, hunchbacked, giant arms, fists hanging to the ground; an iron-grate furnace door on the chest, a smoking chimney behind the shoulder, pulsing magma showing through the gaps between the rock blocks; after breakthrough rocks float up and orbit it, with a magma ring at its feet */
  magma_golem(k, c, s) {
    c.archetype = 'biped';
    const rock = 0x574343;
    const rockLt = 0x7a5e5c;
    const rockDk = 0x342626;
    const bronze = 0xb8802a;
    const rivet = 0xffd080;
    const lava = 0xff5a1a;
    const lavaHi = 0xffd060;
    const smoke = 0x8a8088;
    const aw = AWAKE(s);
    const rockGeo = (r: number, sc: V3 = [1, 1, 1]) => {
      const g = new THREE.DodecahedronGeometry(r, 0);
      g.scale(...sc);
      return g;
    };

    // Short legs: stone pillars and flat rock feet
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * 0.17, 0.2, 0]);
      k.cyl(g, rock, 0.085, 0.105, 0.2, [0, -0.08, 0], [0, 0, 0], 10);
      k.torus(g, bronze, 0.1, 0.014, [0, -0.02, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      hard(k, g, rockGeo(0.11, [1.25, 0.6, 1.45]), rockDk, [0, -0.13, 0.03]);
      c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.5 });
    }
    // Torso: a core sphere + belly rock, shoulder rock and back rock stacked
    const ty = 0.56;
    k.sphere(c.body, rock, 1, [0, ty, 0], [0.33, 0.29, 0.28]);
    hard(k, c.body, rockGeo(0.2, [1.1, 0.85, 1]), rockLt, [0, ty - 0.14, 0.1], [0.2, 0.4, 0]);
    hard(k, c.body, rockGeo(0.17, [1.2, 0.8, 1.1]), rockLt, [0, ty + 0.05, -0.2], [0.6, 0.2, 0]);
    hard(k, c.body, rockGeo(0.12), rock, [0.14, ty + 0.2, -0.16], [0.3, 1.1, 0.2]);
    for (const sx of [-1, 1]) {
      hard(k, c.body, rockGeo(0.18, [1.15, 0.9, 1]), rockLt, [sx * 0.34, ty + 0.2, -0.02], [0.3, sx * 0.7, 0]);
      hard(k, c.body, rockGeo(0.1), rock, [sx * 0.24, ty + 0.34, 0.02], [0.9, sx * 0.3, 0.4]);
    }
    // Belt: a bronze ring and rivets forged by the dwarves
    k.torus(c.body, bronze, 0.3, 0.03, [0, ty - 0.2, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) k.sphere(c.body, rivet, 0.016, [Math.cos(i * 0.785) * 0.31, ty - 0.2, Math.sin(i * 0.785) * 0.31], [1, 1, 1], [0, 0, 0], { outline: false, emissive: rivet, emissiveAmt: 0.3 });
    // Furnace door on the chest: an iron frame, three iron bars, pulsing magma behind
    const door = k.group(c.body, [0, ty + 0.02, 0.25], [-0.15, 0, 0]);
    k.torus(door, rockDk, 0.13, 0.028, [0, 0, 0], [0, 0, 0]);
    for (let i = 0; i < 6; i++) k.sphere(door, rivet, 0.013, [Math.cos(i * 1.047 + 0.5) * 0.13, Math.sin(i * 1.047 + 0.5) * 0.13, 0.025], [1, 1, 1], [0, 0, 0], { outline: false, emissive: rivet, emissiveAmt: 0.3 });
    const furnace = k.glowSphere(door, lava, 0.115, [0, 0, -0.03], 2.6 + aw * 0.4, [1, 1, 0.5]);
    k.glowSphere(door, lavaHi, 0.06, [0, -0.01, 0.0], 3, [1, 0.8, 0.5]);
    c.flickers.push({ g: furnace, base: furnace.scale.clone(), speed: 4, amt: 0.2 });
    for (let i = -1; i <= 1; i++) k.cyl(door, rockDk, 0.012, 0.012, 0.24, [i * 0.07, 0, 0.01], [0, 0, 0], 6, { outline: false });
    k.cyl(door, rockDk, 0.01, 0.01, 0.24, [0, 0.03, 0.012], [0, 0, PI / 2], 6, { outline: false });
    // Magma in the rock seams: cracks on the shoulders, belly and back
    const cracks = k.group(c.body);
    for (const sx of [-1, 1]) {
      glowPath(k, cracks, lava, [v3(sx * 0.22, ty + 0.3, 0.08), v3(sx * 0.3, ty + 0.16, 0.14), v3(sx * 0.26, ty + 0.02, 0.18)], 0.008, 2.4 + aw, 0.9, 12);
      glowPath(k, cracks, lava, [v3(sx * 0.12, ty - 0.1, 0.24), v3(sx * 0.2, ty - 0.2, 0.2), v3(sx * 0.16, ty - 0.3, 0.12)], 0.007, 2.4 + aw, 0.9, 12);
      glowPath(k, cracks, lava, [v3(sx * 0.1, ty + 0.14, -0.24), v3(sx * 0.2, ty, -0.24), v3(sx * 0.14, ty - 0.14, -0.2)], 0.007, 2.4 + aw, 0.9, 12);
    }
    c.flickers.push({ g: cracks, base: cracks.scale.clone(), speed: 3, amt: 0.06 });

    // Giant arms: shoulder rock → upper arm → elbow rock → forearm (bronze bracer) → a rock fist hanging to the ground
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(0.05, 0, sx * 0.3);
      const arm = k.group(c.body, [sx * 0.42, ty + 0.2, 0.02], [base.x, base.y, base.z]);
      hard(k, arm, rockGeo(0.13), rock, [0, 0, 0], [0.5, 0.2, sx * 0.4]);
      k.capsule(arm, rock, 0.07, 0.14, [0, -0.15, 0]);
      hard(k, arm, rockGeo(0.1, [1, 1.1, 1]), rockLt, [0, -0.27, 0], [0.2, 0.9, 0]);
      k.capsule(arm, rock, 0.085, 0.14, [0, -0.4, 0]);
      k.torus(arm, bronze, 0.1, 0.02, [0, -0.36, 0], [PI / 2, 0, 0]);
      k.torus(arm, bronze, 0.1, 0.018, [0, -0.45, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      for (let i = 0; i < 4; i++) k.sphere(arm, rivet, 0.012, [Math.cos(i * 1.57 + 0.4) * 0.11, -0.36, Math.sin(i * 1.57 + 0.4) * 0.11], [1, 1, 1], [0, 0, 0], { outline: false, emissive: rivet, emissiveAmt: 0.3 });
      const fist = k.group(arm, [0, -0.6, 0.02]);
      hard(k, fist, rockGeo(0.14, [1.1, 0.95, 1.05]), rockDk, [0, 0, 0], [0.3, sx * 0.5, 0.2]);
      for (let i = 0; i < 3; i++) hard(k, fist, rockGeo(0.045), rock, [(i - 1) * 0.07, 0.06, 0.1], [i, 0.3, 0]);
      glowPath(k, arm, lava, [v3(sx * 0.06, -0.2, 0.05), v3(sx * 0.08, -0.32, 0.07), v3(sx * 0.05, -0.5, 0.09)], 0.007, 2.4 + aw, 0.9, 12);
      k.glowSphere(fist, lava, 0.03, [sx * 0.08, 0.02, 0.08], 2.4, [1, 1, 0.5]);
      c.arms.push({ g: arm, side: sx, base });
    }

    // Head: a rock head sunk into the shoulders, slate brows, sharp glowing eyes, a magma mouth seam with dripping magma whiskers, a cluster of flames on top of the head
    const head = k.group(c.body, [0, ty + 0.36, 0.06], [0.1, 0, 0]);
    c.head = head;
    k.sphere(head, rock, 0.165, [0, 0, 0], [1.1, 0.85, 1]);
    hard(k, head, rockGeo(0.13, [1.5, 0.45, 1.1]), rockLt, [0, 0.11, 0.02], [0.15, 0, 0]);
    hard(k, head, rockGeo(0.07), rockLt, [0, 0.12, -0.08], [0.5, 0.3, 0]);
    k.eyes(head, { x: 0.065, y: 0.005, z: 0.125, r: 0.042, iris: lavaHi, sharp: true, glow: true, yaw: 0.25 });
    for (const sx of [-1, 1]) k.sphere(head, rockDk, 0.04, [sx * 0.07, 0.06, 0.11], [1.3, 0.35, 0.6], [0, 0, sx * 0.5], { outline: false });
    const mouth = new THREE.BoxGeometry(0.12, 0.018, 0.02);
    k.glow(head, mouth, lava, 2.6, [0, -0.07, 0.14]);
    for (const sx of [-1, 0, 1]) glowPath(k, head, lava, [v3(sx * 0.05, -0.07, 0.14), v3(sx * 0.055, -0.13, 0.13), v3(sx * 0.05, -0.19 - Math.abs(sx) * -0.04, 0.1)], 0.008, 2.4, 0.9, 8);
    for (const sx of [-1, 0, 1]) k.glowSphere(head, lavaHi, 0.014, [sx * 0.05, -0.19 + Math.abs(sx) * 0.04, 0.1], 2.8);
    k.flame(head, lava, lavaHi, 0.09 + aw * 0.03, [0, 0.14, -0.02]);
    for (const sx of [-1, 1]) k.flame(c.body, lava, lavaHi, 0.05, [sx * 0.36, ty + 0.36, -0.02]);

    // Chimney behind the shoulder: a stone-built chimney, a drifting puff of smoke, flying sparks
    const chim = k.group(c.body, [-0.16, ty + 0.3, -0.2], [0.15, 0, 0.1]);
    k.cyl(chim, rockDk, 0.05, 0.065, 0.24, [0, 0.12, 0], [0, 0, 0], 10);
    k.torus(chim, rock, 0.058, 0.014, [0, 0.24, 0], [PI / 2, 0, 0]);
    k.glowSphere(chim, lava, 0.035, [0, 0.235, 0], 2.4, [1, 0.3, 1]);
    for (let i = 0; i < 4; i++) {
      const m = lowSphere(k, chim, smoke, 0.035 + i * 0.014, [Math.sin(i * 1.3) * 0.03, 0.3 + i * 0.09, Math.cos(i * 1.3) * 0.03], [1, 0.9, 1], [0, 0, 0], { outline: false });
      c.bobbers.push({ g: m, base: m.position.y, amp: 0.025, speed: 1.4 + i * 0.3, phase: i * 1.2 });
    }
    for (let i = 0; i < 3 + s; i++) sparkle(k, c, c.body, i % 2 ? lavaHi : lava, 0.012, [Math.cos(i * 2.2) * 0.3 - 0.1, ty + 0.5 + (i % 3) * 0.1, Math.sin(i * 2.2) * 0.25 - 0.1], 0.06);

    // Breakthrough: floating rocks orbit the body; at stage III a magma ring at the feet is added and the flame on the head burns higher
    if (s >= 2) {
      const orbit = k.group(c.body, [0, ty + 0.1, 0]);
      const n = s === 3 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2;
        const g = k.group(orbit, [Math.cos(a) * 0.62, (i % 2) * 0.16 - 0.08, Math.sin(a) * 0.5]);
        hard(k, g, rockGeo(0.045 + (i % 2) * 0.02), i % 2 ? rockLt : rock, [0, 0, 0], [i, i * 0.6, 0]);
        k.glowSphere(g, lava, 0.02, [0, 0, 0], 2.6);
        c.bobbers.push({ g, base: g.position.y, amp: 0.04, speed: 1.5 + i * 0.3, phase: i * 1.4 });
      }
      c.spinners.push({ g: orbit, speed: 0.6, axis: 'y' });
    }
    if (s === 3) {
      spinRing(k, c, c.body, lava, 0.5, 0.012, [0, 0.03, 0], [PI / 2, 0, 0], 0.8, 'y', { beads: 4, beadCol: lavaHi, beadR: 0.02, intensity: 2.4, opacity: 0.8, arc: PI * 1.6 });
      k.glowSphere(c.body, lava, 0.42, [0, 0.005, 0], 1.6, [1, 0.02, 0.9], 0.5);
    }
  },

  /** `chime_sprite`: a small sprite whose lower body is a golden bell, the clapper swings and a ring of small bells hangs at the mouth; two pairs of translucent wings, a halo above the head, a holy bell in hand and a healing light orb; after breakthrough a rotating dawn sun disc rises behind it */
  chime_sprite(k, c, s) {
    floater(c, 0.3);
    const gold = 0xffd45a;
    const goldDk = 0xd9a030;
    const cream = 0xfff0b8;
    const white = 0xfff8ec;
    const skin = 0xffe6d6;
    const hair = 0xffe28a;
    const sky = 0xc8f0ff;
    const glow = 0xfff4a0;
    const glowW = 0xfffbe0;
    const aw = AWAKE(s);

    // Bell skirt: the bell body, two bell bands, a ring of small bells at the mouth, a dark cavity inside and the swinging clapper
    k.lathe(c.body, gold, [[0.3, 0], [0.315, 0.03], [0.28, 0.07], [0.235, 0.18], [0.195, 0.3], [0.15, 0.4], [0.07, 0.45], [0.001, 0.46]]);
    k.cyl(c.body, 0x5a4020, 0.27, 0.27, 0.01, [0, 0.03, 0], [0, 0, 0], 24, { outline: false });
    k.torus(c.body, goldDk, 0.255, 0.014, [0, 0.12, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    k.torus(c.body, goldDk, 0.2, 0.012, [0, 0.3, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.5;
      k.sphere(c.body, glowW, 0.02, [Math.cos(a) * 0.235, 0.2, Math.sin(a) * 0.235], [0.6, 1.2, 0.2], [0, -a, 0], { outline: false, emissive: glow, emissiveAmt: 0.6 + aw * 0.3 });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      lowSphere(k, c.body, goldDk, 0.022, [Math.cos(a) * 0.31, 0.02, Math.sin(a) * 0.31]);
    }
    const clapper = k.group(c.body, [0, 0.24, 0]);
    k.cyl(clapper, goldDk, 0.008, 0.008, 0.16, [0, -0.08, 0], [0, 0, 0], 6, { outline: false });
    k.glowSphere(clapper, glow, 0.035, [0, -0.17, 0], 2.6);
    c.tails.push({ g: clapper, phase: 0.4, amp: 0.3, axis: 'z' });

    // Upper body: a milk-white robe, a gold collar, two arms (one carrying the holy bell, one holding up the light orb)
    k.sphere(c.body, cream, 1, [0, 0.55, 0], [0.155, 0.13, 0.14]);
    k.sphere(c.body, white, 1, [0, 0.53, 0.06], [0.1, 0.1, 0.09], [0, 0, 0], { outline: false });
    k.torus(c.body, gold, 0.11, 0.022, [0, 0.64, 0], [PI / 2, 0, 0]);
    gem(k, c.body, sky, 0.02, 0.05, [0, 0.58, 0.14], [PI / 2, 0, 0], 0.8);
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(sx > 0 ? -0.9 : -0.5, 0, sx * 0.5);
      const arm = k.group(c.body, [sx * 0.15, 0.62, 0.02], [base.x, base.y, base.z]);
      k.capsule(arm, cream, 0.032, 0.1, [0, -0.07, 0]);
      k.sphere(arm, skin, 0.03, [0, -0.15, 0]);
      if (sx > 0) {
        // Holy bell: a small gold bell and a short handle
        const bell = k.group(arm, [0, -0.19, 0.02], [0.3, 0, 0]);
        k.cyl(bell, 0x8a5a2a, 0.008, 0.008, 0.08, [0, 0.02, 0], [0, 0, 0], 6);
        k.lathe(bell, gold, [[0.05, -0.08], [0.052, -0.07], [0.04, -0.04], [0.025, -0.01], [0.001, 0]]);
        k.glowSphere(bell, glow, 0.012, [0, -0.09, 0], 2.6);
        c.tails.push({ g: bell, phase: 2, amp: 0.15, axis: 'z' });
      } else {
        const orb = k.glowSphere(arm, glowW, 0.045, [0, -0.2, 0.02], 2.8);
        c.flickers.push({ g: orb, base: orb.scale.clone(), speed: 3, amt: 0.25 });
        spinRing(k, c, arm, glow, 0.07, 0.004, [0, -0.2, 0.02], [0, 0, 0], 2.2, 'y', { beads: 2, beadCol: 0xffffff, beadR: 0.008, opacity: 0.8 });
      }
      c.arms.push({ g: arm, side: sx, base });
    }
    // Collar ribbon
    for (const sx of [-1, 1]) {
      const rb = k.group(k.group(c.body, [sx * 0.06, 0.62, -0.1], [-1.4, 0, sx * 0.4]));
      k.blade(rb, sky, 0.26, 0.05, 0.02, [0, 0, 0], [0, 0, 0], { emissive: 0x9fe8ff, emissiveAmt: 0.3 });
      c.tails.push({ g: rb, phase: sx * 1.1, amp: 0.25, axis: 'x' });
    }

    // Head: a round face, golden hair and bangs, side hair curls, big eyes, blush, a smile
    const head = k.group(c.body, [0, 0.8, 0.01]);
    c.head = head;
    k.sphere(head, skin, 0.165);
    k.sphere(head, hair, 0.17, [0, 0.05, -0.03], [1.04, 0.85, 1.02]);
    for (let i = -1; i <= 1; i++) k.blade(head, hair, 0.11, 0.07, 0.04, [i * 0.07, 0.11, 0.1], [-2.6 + Math.abs(i) * 0.2, 0, i * 0.35]);
    for (const sx of [-1, 1]) {
      k.torus(head, hair, 0.05, 0.02, [sx * 0.15, -0.02, 0.02], [0, sx * 0.4, 0], PI * 1.4);
      k.blade(head, hair, 0.16, 0.06, 0.04, [sx * 0.13, 0.04, -0.06], [0.5, 0, sx * 2.6]);
    }
    k.sphere(head, gold, 0.045, [0, 0.18, 0.02], [1, 0.5, 1], [0, 0, 0], { emissive: glow, emissiveAmt: 0.4 });
    k.eyes(head, { x: 0.07, y: 0.015, z: 0.135, r: 0.055, iris: 0xe0a020, yaw: 0.2 });
    k.blush(head, 0.115, -0.05, 0.12, 0.035);
    k.torus(head, 0x8a4a3a, 0.02, 0.006, [0, -0.07, 0.155], [0, 0, PI], PI, { outline: false });
    // Halo: a rotating ring above the head, with an extra slanted one after breakthrough
    spinRing(k, c, head, glow, 0.13, 0.008, [0, 0.27, 0], [PI / 2, 0, 0], 1.2, 'y', { beads: 4, beadCol: 0xffffff, beadR: 0.012, opacity: 0.9 });
    if (s >= 2) spinRing(k, c, head, glowW, 0.17, 0.005, [0, 0.27, 0], [PI / 2 + 0.5, 0, 0], -0.9, 'y', { beads: 2, beadCol: 0xffffff, beadR: 0.01, opacity: 0.6 });

    // Two pairs of translucent wings (large above, small below), flapping
    for (const sx of [-1, 1]) {
      const w = k.group(c.body, [sx * 0.08, 0.6, -0.1]);
      k.blade(w, sky, 0.4, 0.17, 0.03, [0, 0, 0], [-0.2, 0, -sx * 0.5], { emissive: 0x9fe8ff, emissiveAmt: 0.45 });
      k.blade(w, white, 0.32, 0.09, 0.034, [0, 0.02, 0.005], [-0.2, 0, -sx * 0.5], { outline: false, emissive: glowW, emissiveAmt: 0.5 });
      k.blade(w, sky, 0.24, 0.12, 0.03, [0, -0.02, -0.01], [-0.5, 0, -sx * 1.3], { emissive: 0x9fe8ff, emissiveAmt: 0.45 });
      k.blade(w, white, 0.18, 0.06, 0.034, [0, 0, -0.005], [-0.5, 0, -sx * 1.3], { outline: false, emissive: glowW, emissiveAmt: 0.5 });
      k.glowSphere(w, glowW, 0.014, [-sx * Math.sin(0.5) * 0.4, Math.cos(0.5) * 0.39, -0.08], 2.4);
      c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: 0.6, amp: 0.35, speed: 11 });
    }

    // Light: rising motes; at stage III a dawn sun disc (a rotating gold ring + radiating rays) rises behind it
    for (let i = 0; i < 3 + s; i++) sparkle(k, c, c.body, i % 2 ? glowW : glow, 0.014, [Math.cos(i * 2.2) * 0.34, 0.15 + (i % 3) * 0.25, Math.sin(i * 2.2) * 0.3], 0.08);
    if (s === 3) {
      const sun = spinRing(k, c, c.body, gold, 0.4, 0.01, [0, 0.72, -0.3], [0, 0, 0], 0.5, 'z', { beads: 8, beadCol: glowW, beadR: 0.016, intensity: 1.5, opacity: 0.7 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2 + PI / 8;
        k.blade(sun, gold, 0.18, 0.045, 0.01, [Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0], [0, 0, a - PI / 2], { outline: false, emissive: glow, emissiveAmt: 0.45 });
      }
    }
  },

  /** `soul_lantern`: a ghost in a ragged cloak, with only two points of dim blue eyes and a smile inside the pointed hood; to its right stands a curved staff hung with a lantern (the lantern swings), its left hand leads three lost wisps; after breakthrough a ring of spell script floats up around it and a netherblue corona rises behind the head */
  soul_lantern(k, c, s) {
    floater(c, 0.35);
    const hood = 0x2a3058;
    const hoodLt = 0x3d4478;
    const lining = 0x6a6aa0;
    const inner = 0x0e0f1e;
    const trim = 0x8a86b8;
    const metal = 0x3a3a4a;
    const brass = 0xc8b070;
    const blue = 0x6fd6ff;
    const blueHi = 0xd8f6ff;
    const flame = 0x4fb6ff;
    const aw = AWAKE(s);

    // Cloak: a ghost silhouette wide at the shoulders and narrowing at the hem, with a ring of fluttering rags hanging from the hem; a pale lining on the chest, a cord and a silver clasp
    k.lathe(c.body, hood, [[0.001, 0.06], [0.09, 0.08], [0.15, 0.2], [0.21, 0.38], [0.25, 0.55], [0.24, 0.66], [0.17, 0.74], [0.1, 0.78], [0.001, 0.8]]);
    k.sphere(c.body, lining, 1, [0, 0.5, 0.15], [0.12, 0.2, 0.1], [0, 0, 0], { outline: false });
    k.torus(c.body, brass, 0.2, 0.014, [0, 0.42, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    for (const sx of [-1, 1]) {
      const cord = k.group(k.group(c.body, [sx * 0.05, 0.42, 0.19], [PI - 0.3, 0, sx * 0.3]));
      k.cyl(cord, brass, 0.008, 0.008, 0.16, [0, 0.08, 0], [0, 0, 0], 6, { outline: false });
      lowSphere(k, cord, brass, 0.018, [0, 0.17, 0], [1, 1.4, 1]);
      c.tails.push({ g: cord, phase: sx * 1.7, amp: 0.15, axis: 'x' });
    }
    gem(k, c.body, blue, 0.025, 0.06, [0, 0.66, 0.2], [PI / 2, 0, 0], 0.8);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2 + 0.2;
      const tg = k.group(k.group(c.body, [Math.cos(a) * 0.09, 0.1, Math.sin(a) * 0.09], [0, -a + PI / 2, 0]));
      k.blade(tg, i % 2 ? hood : hoodLt, 0.16 + (i % 3) * 0.07, 0.035, 0.014, [0, 0, 0], [PI - 0.3 - (i % 2) * 0.25, 0, 0]);
      c.tails.push({ g: tg, phase: i * 0.7, amp: 0.3, axis: 'x' });
    }
    const wisp = k.glowSphere(c.body, blue, 0.05, [0, -0.02, 0], 1.4, [1, 1.6, 1], 0.35);
    c.flickers.push({ g: wisp, base: wisp.scale.clone(), speed: 2, amt: 0.3 });
    // Pointed hood: a round hood, a backward-curving point, piping at the opening on the front, inside it a void with two dim blue eyes and a smile
    const head = k.group(c.body, [0, 0.92, 0]);
    c.head = head;
    k.sphere(head, hood, 0.2, [0, 0, -0.02], [1, 1.05, 1]);
    k.horn(head, hood, 0.09, 0.26, 0.16, [0, 0.14, -0.06], [-0.3, 0, 0]);
    k.sphere(head, inner, 0.14, [0, -0.01, 0.1], [0.85, 0.9, 0.5], [0, 0, 0], { outline: false });
    k.torus(head, hoodLt, 0.15, 0.04, [0, 0.0, 0.11], [0.15, 0, 0]);
    k.torus(head, trim, 0.15, 0.012, [0, 0.0, 0.15], [0.15, 0, 0], PI * 2, { outline: false });
    for (const sx of [-1, 1]) {
      const eye = k.group(head, [sx * 0.07, 0.025, 0.15]);
      k.glowSphere(eye, blue, 0.034, [0, 0, 0], 1.9 + aw * 0.4, [1, 1.35, 0.5]);
      k.glowSphere(eye, blueHi, 0.012, [0.006, 0.014, 0.016], 2.2, [1, 1, 0.5]);
      c.eyes.push(eye);
    }
    k.torus(head, blue, 0.03, 0.005, [0, -0.06, 0.15], [0, 0, PI], PI, { outline: false, emissive: blue, emissiveAmt: 0.9 });
    // Arms: the right hand hangs at the side steadying the curved staff, the left hand reaches forward to lead souls
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(sx > 0 ? -0.3 : -0.9, 0, sx * (sx > 0 ? 0.9 : 0.45));
      const arm = k.group(c.body, [sx * 0.24, 0.66, 0.04], [base.x, base.y, base.z]);
      k.capsule(arm, hood, 0.05, 0.16, [0, -0.1, 0]);
      k.torus(arm, trim, 0.05, 0.012, [0, -0.2, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      k.sphere(arm, inner, 0.036, [0, -0.25, 0], [1, 1.1, 0.8]);
      for (let i = -1; i <= 1; i++) k.capsule(arm, inner, 0.009, 0.045, [i * 0.02, -0.3, 0.01], [0.1, 0, i * 0.15], { outline: false });
      if (sx < 0) {
        const ring = k.group(arm, [0, -0.3, 0.06]);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * PI * 2;
          const f = k.flame(ring, flame, blueHi, 0.028, [Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08]);
          k.glowSphere(f, inner, 0.006, [0.007, 0.02, 0.012], 1, [1, 1.4, 1]);
          k.glowSphere(f, inner, 0.006, [-0.007, 0.02, 0.012], 1, [1, 1.4, 1]);
        }
        c.spinners.push({ g: ring, speed: 2.2, axis: 'y' });
      }
      c.arms.push({ g: arm, side: sx, base });
    }
    // Curved staff and lantern: standing at its right, the hook at the top curving outward, the lantern swinging below the chain
    const staff = k.group(c.body, [0.44, 0.3, 0.09]);
    k.cyl(staff, metal, 0.012, 0.016, 0.56, [0, 0.28, 0]);
    k.torus(staff, brass, 0.02, 0.006, [0, 0.2, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    k.torus(staff, brass, 0.02, 0.006, [0, 0.5, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    k.horn(staff, metal, 0.013, 0.22, 0.13, [0, 0.55, 0], [0, PI / 2, 0]);
    const swing = k.group(staff, [0.13, 0.7, 0]);
    for (let i = 0; i < 3; i++) k.torus(swing, brass, 0.014, 0.004, [0, -0.02 - i * 0.026, 0], [i % 2 ? PI / 2 : 0, 0, 0], PI * 2, { outline: false });
    const lan = k.group(swing, [0, -0.1, 0]);
    k.cyl(lan, brass, 0.03, 0.075, 0.035, [0, 0, 0], [0, 0, 0], 6);
    k.cyl(lan, metal, 0.075, 0.07, 0.02, [0, -0.025, 0], [0, 0, 0], 6);
    k.cyl(lan, metal, 0.07, 0.075, 0.02, [0, -0.22, 0], [0, 0, 0], 6);
    k.cyl(lan, brass, 0.075, 0.05, 0.035, [0, -0.25, 0], [0, 0, 0], 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      k.cyl(lan, metal, 0.007, 0.007, 0.2, [Math.cos(a) * 0.066, -0.12, Math.sin(a) * 0.066], [0, 0, 0], 4, { outline: false });
    }
    k.glow(lan, new THREE.CylinderGeometry(0.062, 0.062, 0.19, 6, 1, true), blue, 1.6 + aw * 0.4, [0, -0.12, 0], [0, 0, 0], 0.4);
    const core = k.flame(lan, flame, blueHi, 0.06, [0, -0.2, 0]);
    core.scale.setScalar(1 + aw * 0.2);
    k.glowSphere(lan, blueHi, 0.018, [0, -0.28, 0], 2.6);
    c.tails.push({ g: swing, phase: 1.5, amp: 0.18, axis: 'z' });
    // Lost souls: two larger wisps slowly circle it
    const souls = k.group(c.body, [0, 0.5, 0]);
    for (let i = 0; i < 2; i++) {
      const a = i * PI + 2.2;
      const g = k.group(souls, [Math.cos(a) * 0.5, i * 0.15, Math.sin(a) * 0.45]);
      k.flame(g, flame, blueHi, 0.04, [0, 0, 0]);
      c.bobbers.push({ g, base: g.position.y, amp: 0.05, speed: 1.3 + i * 0.4, phase: i * 2 });
    }
    c.spinners.push({ g: souls, speed: -0.5, axis: 'y' });
    for (let i = 0; i < 2 + s; i++) sparkle(k, c, c.body, i % 2 ? blueHi : blue, 0.012, [Math.cos(i * 2.4) * 0.4, 0.2 + (i % 3) * 0.2, Math.sin(i * 2.4) * 0.35], 0.1);
    // Breakthrough: a spell-script ring around it; at stage III a netherblue corona behind the head is added
    if (s >= 2) {
      const runes = spinRing(k, c, c.body, blue, 0.42, 0.005, [0, 0.36, 0], [PI / 2, 0, 0], 0.7, 'y', { beads: 0, opacity: 0.6 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        gem(k, runes, blue, 0.012, 0.04, [Math.cos(a) * 0.42, Math.sin(a) * 0.42, -0.02], [PI / 2, 0, 0], 0.9);
      }
    }
    if (s === 3) {
      spinRing(k, c, head, blue, 0.28, 0.006, [0, 0.04, -0.16], [0, 0, 0], -0.6, 'z', { beads: 6, beadCol: blueHi, beadR: 0.012, opacity: 0.7 });
      k.glowSphere(head, blue, 0.24, [0, 0.04, -0.18], 0.8, [1, 1, 0.05], 0.18);
    }
  },

  /** `relic_blade`: a ghost knight formed from a thousand years of sword intent, with only a helmet, pauldrons, iron gauntlets and a tattered cloak and a point of blue light in the chest; the right hand holds the Silver Oath Order's ancient sword reversed, its blade carved with glowing markings; after breakthrough the sword intent becomes orbiting shards of blade and a bright moon rises behind the head */
  relic_blade(k, c, s) {
    floater(c, 0.3);
    const root = k.group(c.body, [0, 0.2, 0]);
    const steel = 0xdfe6ff;
    const steelDk = 0x9aa6c8;
    const gold = 0xffc94a;
    const wrap = 0x3a2a4a;
    const cape = 0x2f3a6e;
    const capeLt = 0x4a5a9a;
    const inner = 0x0e0f1e;
    const blue = 0x8fd0ff;
    const blueHi = 0xe0f2ff;
    const aw = AWAKE(s);

    // Hollow torso: a mass of black shadow with pulsing sword-intent light in the chest, a ring of breastplate gorget
    k.sphere(root, inner, 1, [0, 0.66, 0], [0.19, 0.2, 0.13], [0, 0, 0], { outline: false });
    const core = k.glowSphere(root, blue, 0.05, [0, 0.66, 0.06], 2.8 + aw * 0.5);
    c.flickers.push({ g: core, base: core.scale.clone(), speed: 2.5, amt: 0.3 });
    k.torus(root, steel, 0.16, 0.035, [0, 0.8, 0], [PI / 2, 0, 0]);
    k.torus(root, gold, 0.16, 0.01, [0, 0.83, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    // Pauldrons: two steel domes with gold edges and spikes
    for (const sx of [-1, 1]) {
      const p = k.group(root, [sx * 0.28, 0.78, 0], [0, 0, sx * 0.35]);
      k.sphere(p, steel, 0.15, [0, 0, 0], [1, 0.75, 0.95]);
      k.torus(p, gold, 0.14, 0.014, [0, -0.02, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
      k.sphere(p, steelDk, 0.1, [0, 0.03, 0], [1, 0.6, 0.9], [0, 0, 0], { outline: false });
      k.cone(p, gold, 0.03, 0.12, [sx * 0.08, 0.06, 0], [0, 0, sx * 0.5], 8);
      k.capsule(p, inner, 0.05, 0.1, [sx * 0.02, -0.16, 0], [0, 0, sx * 0.1], { outline: false });
    }
    // Helmet: a domed helm, a gold band, blue eye light inside the T-shaped visor opening, a tuft of fluttering blue feathers on top of the helm
    const head = k.group(root, [0, 0.98, 0.02]);
    c.head = head;
    k.sphere(head, steel, 0.15, [0, 0.01, 0], [0.95, 1, 1]);
    k.sphere(head, inner, 0.1, [0, -0.02, 0.09], [0.85, 0.75, 0.5], [0, 0, 0], { outline: false });
    k.cyl(head, steel, 0.02, 0.02, 0.16, [0, -0.06, 0.13], [0, 0, 0], 6);
    k.torus(head, gold, 0.14, 0.014, [0, 0.05, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    k.sphere(head, gold, 0.03, [0, 0.07, 0.13], [1, 1.2, 0.5], [0, 0, 0], { emissive: gold, emissiveAmt: 0.3 });
    k.eyes(head, { x: 0.052, y: 0.0, z: 0.11, r: 0.032, iris: blue, sharp: true, glow: true, yaw: 0.15 });
    for (const sx of [-1, 1]) k.sphere(head, steel, 0.06, [sx * 0.12, -0.05, 0.04], [0.5, 1, 0.9]);
    const plume = k.group(k.group(head, [0, 0.14, -0.04], [-0.9, 0, 0]));
    for (let i = 0; i < 3; i++) k.blade(plume, i === 1 ? blueHi : blue, 0.3 - i * 0.04, 0.06, 0.02, [(i - 1) * 0.02, 0, -i * 0.01], [0, 0, (i - 1) * 0.25], { emissive: blue, emissiveAmt: 0.4 });
    c.tails.push({ g: plume, phase: 0, amp: 0.2, axis: 'x' });
    // Cloak: several rags hanging behind the shoulders, each fluttering on its own
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 0.09;
      const cg = k.group(k.group(root, [x, 0.76, -0.12], [PI - 0.35, 0, 0]));
      k.blade(cg, i % 2 ? cape : capeLt, 0.5 - Math.abs(x) * 0.8, 0.11, 0.02, [0, 0, 0], [0, 0, x * 0.6]);
      c.tails.push({ g: cg, phase: i * 0.8, amp: 0.15, axis: 'x' });
    }
    // Iron gauntlets: the right hand grips the sword hilt, the left hand is open
    const hands: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(sx > 0 ? -0.2 : -0.5, 0, sx * 0.3);
      const arm = k.group(root, [sx * 0.3, 0.6, 0.02], [base.x, base.y, base.z]);
      k.capsule(arm, inner, 0.035, 0.06, [0, -0.04, 0], [0, 0, 0], { outline: false });
      k.torus(arm, steel, 0.06, 0.02, [0, -0.1, 0], [PI / 2, 0, 0]);
      const hand = k.group(arm, [0, -0.17, 0.02]);
      k.sphere(hand, steel, 0.065, [0, 0, 0], [1, 1.1, 0.8]);
      k.sphere(hand, gold, 0.02, [0, 0.03, 0.05], [1, 1, 0.5], [0, 0, 0], { outline: false });
      for (let i = -1; i <= 1; i++) k.capsule(hand, steelDk, 0.016, 0.05, [i * 0.035, -0.07, sx > 0 ? 0.03 : 0.02], [sx > 0 ? 1.2 : 0.3, 0, i * 0.12]);
      hands.push(hand);
      c.arms.push({ g: arm, side: sx, base });
    }
    // Ancient sword: held reversed in the right hand with the tip pointing down; an engraved blade, a wing-shaped crossguard with a sapphire, a leather-wrapped grip, a gold ball pommel
    const sword = k.group(hands[1], [0, -0.02, 0.06], [0.1, 0, 0]);
    k.cyl(sword, wrap, 0.022, 0.025, 0.16, [0, 0.06, 0], [0, 0, 0], 10);
    for (let i = 0; i < 3; i++) k.torus(sword, gold, 0.025, 0.006, [0, 0.02 + i * 0.045, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    k.sphere(sword, gold, 0.04, [0, 0.16, 0]);
    gem(k, sword, blue, 0.012, 0.03, [0, 0.19, 0], [0, 0, 0], 0.9);
    const guard = k.group(sword, [0, -0.03, 0]);
    k.cyl(guard, gold, 0.04, 0.05, 0.03, [0, 0, 0], [0, 0, 0], 8);
    for (const sx of [-1, 1]) {
      k.blade(guard, gold, 0.16, 0.05, 0.03, [sx * 0.03, 0, 0], [0, 0, sx * (PI / 2 + 0.35)]);
      k.blade(guard, gold, 0.08, 0.03, 0.03, [sx * 0.03, -0.01, 0], [0, 0, sx * (PI / 2 - 0.5)]);
    }
    gem(k, guard, blue, 0.02, 0.05, [0, 0, 0.02], [PI / 2, 0, 0], 0.8);
    const bladeLen = 0.56;
    const bladeG = k.group(guard, [0, -0.01, 0], [0, 0, 0]);
    hard(k, bladeG, poly([[-0.045, 0], [-0.04, -bladeLen * 0.72], [0, -bladeLen], [0.04, -bladeLen * 0.72], [0.045, 0]], 0.022, 2), steel, [0, 0, 0]);
    hard(k, bladeG, poly([[-0.012, -0.02], [-0.01, -bladeLen * 0.7], [0, -bladeLen * 0.8], [0.01, -bladeLen * 0.7], [0.012, -0.02]], 0.026, 2), blue, [0, 0, 0], [0, 0, 0], { outline: false, emissive: blue, emissiveAmt: 0.6 + aw * 0.4 });
    for (let i = 0; i < 4; i++) k.glowSphere(bladeG, blueHi, 0.008, [0, -0.1 - i * 0.1, 0.014], 2.4);
    glowLink(k, bladeG, blueHi, [-0.046, 0, 0], [0, -bladeLen, 0], 0.003, 2.2, 0.7 + aw * 0.3);
    glowLink(k, bladeG, blueHi, [0.046, 0, 0], [0, -bladeLen, 0], 0.003, 2.2, 0.7 + aw * 0.3);
    k.glowSphere(bladeG, blueHi, 0.014, [0, -bladeLen, 0], 2.6);

    // Sword intent: orbiting shards of blade and motes of light; at stage III a bright moon rises behind the head
    for (let i = 0; i < 2 + s; i++) sparkle(k, c, root, i % 2 ? blueHi : blue, 0.012, [Math.cos(i * 2.3) * 0.42, 0.3 + (i % 3) * 0.25, Math.sin(i * 2.3) * 0.36], 0.07);
    if (s >= 2) {
      const shards = k.group(root, [0, 0.55, 0]);
      const n = s === 3 ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2;
        const g = k.group(shards, [Math.cos(a) * 0.5, (i % 2) * 0.2 - 0.05, Math.sin(a) * 0.44], [0.3, -a, 0.2]);
        hard(k, g, poly([[-0.018, 0], [0, -0.12], [0.018, 0], [0, 0.03]], 0.008, 1), steel, [0, 0, 0], [0, 0, 0], { emissive: blue, emissiveAmt: 0.5 });
        k.glowSphere(g, blueHi, 0.008, [0, -0.12, 0], 2.4);
        c.bobbers.push({ g, base: g.position.y, amp: 0.04, speed: 1.6 + i * 0.3, phase: i * 1.1 });
      }
      c.spinners.push({ g: shards, speed: 0.9, axis: 'y' });
    }
    if (s === 3) {
      const moon = k.group(head, [0, 0.1, -0.2]);
      k.glow(moon, crescent(0.34, PI * 1.25, 0.09, 0.02), blueHi, 1.4, [0, -0.02, 0], [0, 0, 0.5], 0.85);
      c.spinners.push({ g: k.group(moon), speed: 0, axis: 'z' });
      spinRing(k, c, moon, blue, 0.4, 0.005, [0, 0, 0.01], [0, 0, 0], 0.4, 'z', { beads: 6, beadCol: blueHi, beadR: 0.012, opacity: 0.6 });
    }
  },

  /** `grimoire`: an open grimoire like a little lectern: the upright page has a face on it and the flat page has a quill writing by itself; gold corner fittings, a fluttering bookmark ribbon, two copy books flying around; after breakthrough a star chart and a spell ring float above the pages, and at stage III a magic circle unfolds at its feet */
  grimoire(k, c, s) {
    floater(c, 0.35);
    const cover = 0x6b3aa8;
    const coverDk = 0x4a2378;
    const gold = 0xffc94a;
    const page = 0xfff8e6;
    const pageDk = 0xefe0c0;
    const ink = 0x3a2a5a;
    const rune = 0xc49aff;
    const star = 0x9ae0ff;
    const ribbon = 0xe04a6a;
    const aw = AWAKE(s);
    const W = 0.36;
    const H = 0.3;
    const slab = (w: number, h: number, d: number, r = 0.03) => poly([[-w + r, -h], [w - r, -h], [w, -h + r], [w, h - r], [w - r, h], [-w + r, h], [-w, h - r], [-w, -h + r]], d, 2);

    // The spine is on the x axis; the back page stands up (the face), the front page lies flat (the quill)
    const book = k.group(c.body, [0, 0.3, 0]);
    c.head = book;
    k.cyl(book, coverDk, 0.045, 0.045, W * 2 + 0.04, [0, 0, 0], [0, 0, PI / 2], 12);
    for (const sx of [-1, 1]) k.torus(book, gold, 0.046, 0.008, [sx * (W - 0.06), 0, 0], [0, PI / 2, 0], PI * 2, { outline: false });
    const leaf = (tilt: number, dir: number) => {
      const g = k.group(book, [0, 0, 0], [tilt, 0, 0]);
      // Cover (purple), page stack (milk-white, shrinking layer by layer)
      hard(k, g, slab(W, H, 0.03), cover, [0, 0.0, dir * H], [PI / 2, 0, 0]);
      for (let i = 0; i < 3; i++) hard(k, g, slab(W - 0.02 - i * 0.004, H - 0.015, 0.018), i % 2 ? page : pageDk, [0, 0.026 + i * 0.019, dir * (H + 0.008)], [PI / 2, 0, 0]);
      // Gold corners and cover decoration
      for (const sx of [-1, 1]) {
        k.sphere(g, gold, 0.03, [sx * (W - 0.03), -0.012, dir * (2 * H - 0.03)], [1, 0.5, 1], [0, 0, 0], { outline: false });
        k.sphere(g, gold, 0.03, [sx * (W - 0.03), -0.012, dir * 0.03], [1, 0.5, 1], [0, 0, 0], { outline: false });
      }
      return g;
    };
    const back = leaf(1.15, -1);
    const front = leaf(0.15, 1);
    // Face: big eyes on the upright page, blush, a smile and a few lines of spell script
    const face = k.group(back, [0, 0.085, -H - 0.02], [-PI / 2, 0, 0]);
    k.eyes(face, { x: 0.11, y: 0.03, z: 0.0, r: 0.06, iris: 0x8a4ad8, yaw: 0 });
    k.blush(face, 0.19, -0.05, 0.005, 0.035);
    k.torus(face, ink, 0.035, 0.008, [0, -0.08, 0.0], [0, 0, PI], PI, { outline: false });
    for (let i = 0; i < 3; i++) glowLink(k, face, rune, [-0.2 + i * 0.03, -0.16 - i * 0.03, 0.01], [0.2 - i * 0.05, -0.16 - i * 0.03, 0.01], 0.005, 2 + aw, 0.8);
    for (const sx of [-1, 1]) glowLink(k, face, rune, [sx * 0.24, 0.16, 0.01], [sx * 0.24, -0.05, 0.01], 0.004, 2 + aw, 0.6);
    // Flat page: lines of spell script, an inkwell and a quill writing by itself
    const desk = k.group(front, [0, 0.085, H + 0.02], [-PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) glowLink(k, desk, rune, [-0.22, 0.12 - i * 0.06, 0.01], [0.02 + (i % 2) * 0.08, 0.12 - i * 0.06, 0.01], 0.005, 2 + aw, 0.7);
    k.cyl(desk, ink, 0.018, 0.024, 0.035, [0.22, -0.12, 0.02], [PI / 2, 0, 0], 10);
    k.glowSphere(desk, rune, 0.012, [0.22, -0.12, 0.04], 2.2, [1, 1, 0.3]);
    const quill = k.group(desk, [0.08, -0.14, 0.05], [-0.4, 0, -0.5]);
    k.cyl(quill, 0xfff2cc, 0.006, 0.01, 0.16, [0, 0.08, 0], [0, 0, 0], 6);
    k.blade(quill, 0xffffff, 0.16, 0.05, 0.02, [0, 0.1, 0], [0, 0, 0], { outline: false });
    k.blade(quill, star, 0.14, 0.03, 0.022, [0, 0.11, 0.005], [0, 0, 0], { outline: false, emissive: star, emissiveAmt: 0.5 });
    k.glowSphere(quill, rune, 0.012, [0, 0.0, 0], 2.6);
    c.bobbers.push({ g: quill, base: quill.position.y, amp: 0.02, speed: 6, phase: 0 });
    c.tails.push({ g: k.group(quill), phase: 0, amp: 0.2, axis: 'y' });
    // Bookmark ribbon: a red satin ribbon hanging from the spine and fluttering, a gold charm at the end
    const rb = k.group(k.group(book, [-0.1, -0.02, -0.02], [PI - 0.5, 0, 0]));
    k.blade(rb, ribbon, 0.3, 0.05, 0.015, [0, 0, 0]);
    k.sphere(rb, gold, 0.02, [0, 0.3, 0]);
    c.tails.push({ g: rb, phase: 0.6, amp: 0.3, axis: 'x' });
    // Two small copy books fly around (the copying spell)
    const copies = k.group(c.body, [0, 0.28, 0]);
    for (let i = 0; i < 2; i++) {
      const a = i * PI + 0.6;
      const g = k.group(copies, [Math.cos(a) * 0.72, i * 0.12, Math.sin(a) * 0.64], [0.2, -a, 0.3]);
      hard(k, g, slab(0.09, 0.07, 0.04, 0.015), i ? coverDk : cover, [0, 0, 0], [0.4, 0, 0]);
      hard(k, g, slab(0.08, 0.06, 0.03, 0.012), page, [0, 0.005, 0.005], [0.4, 0, 0], { outline: false });
      k.glowSphere(g, rune, 0.01, [0, 0.05, 0], 2.4);
      c.bobbers.push({ g, base: g.position.y, amp: 0.05, speed: 1.4 + i * 0.5, phase: i * 2 });
    }
    c.spinners.push({ g: copies, speed: 0.8, axis: 'y' });
    // Spell rings: two rotating rune rings above the pages (rune fragments hung on the big ring)
    // The spell rings sit above the upper edge of the upright page, so they do not block the face
    const runes = spinRing(k, c, c.body, rune, 0.3, 0.005, [0, 0.98, -0.1], [PI / 2, 0, 0], 0.7, 'y', { opacity: 0.6 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      k.glow(runes, new THREE.PlaneGeometry(0.05, 0.05), i % 2 ? rune : star, 2.4, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0], [0, 0, a + PI / 4]);
    }
    spinRing(k, c, c.body, star, 0.2, 0.004, [0, 0.94, -0.1], [PI / 2 + 0.4, 0, 0], -1.1, 'y', { beads: 3, beadCol: 0xffffff, beadR: 0.01, opacity: 0.6 });
    for (let i = 0; i < 2 + s; i++) sparkle(k, c, c.body, i % 2 ? star : rune, 0.012, [Math.cos(i * 2.5) * 0.4, 0.5 + (i % 3) * 0.15, Math.sin(i * 2.5) * 0.35], 0.06);
    // Breakthrough: a star chart floats above the pages (the Starvault Sage Tower); at stage III a magic circle unfolds at its feet
    if (s >= 2) {
      const sky = k.group(c.body, [0, 1.1, -0.1]);
      const pts: V3[] = [[-0.16, 0.06, 0], [-0.06, 0.14, 0.04], [0.04, 0.08, -0.02], [0.14, 0.16, 0.02], [0.2, 0.04, -0.03]];
      for (let i = 0; i < pts.length; i++) {
        k.glowSphere(sky, i % 2 ? 0xffffff : star, 0.012 + (i % 2) * 0.004, pts[i], 2.6);
        if (i > 0) glowLink(k, sky, star, pts[i - 1], pts[i], 0.003, 1.8, 0.6);
      }
      c.bobbers.push({ g: sky, base: sky.position.y, amp: 0.02, speed: 1.2, phase: 1 });
    }
    if (s === 3) {
      // spinRing returns the spinning group, and the ring lies in its first child group (the holder); the inner ring and the triangle must be drawn in the same plane
      const circle = spinRing(k, c, c.body, rune, 0.5, 0.008, [0, 0.02, 0], [PI / 2, 0, 0], 0.5, 'y', { beads: 6, beadCol: star, beadR: 0.014, opacity: 0.7 }).children[0] as THREE.Group;
      k.glow(circle, new THREE.TorusGeometry(0.36, 0.006, 6, 48), star, 2, [0, 0, 0], [0, 0, 0], 0.6);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2;
        glowLink(k, circle, rune, [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], [Math.cos(a + 2.094) * 0.5, Math.sin(a + 2.094) * 0.5, 0], 0.004, 2, 0.6);
      }
    }
  },
};

// Avoid unused-helper errors at typecheck time (the later builders use them)
void link;
void glowLink;
void poly;
void gem;
void lowSphere;
void feather;
void floater;
