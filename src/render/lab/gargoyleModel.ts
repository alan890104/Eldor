// Gatewarden (model lab version, N, earth + dark): a stone statue crouched on a dwarf city gate, not moving at all by day; under the moonlight it stretches and counts whether any child is missing today.
// Identifying features: 1. A Gothic stone gargoyle crouched on a gate ledge stone: arched back, knees up against the chest, claws hooked over the front edge of the ledge, and a pair of folded stone bat wings standing up behind the shoulders with the wing tips higher than the head.
// 2. A point of moonlight-colored light in the deep eye sockets of the carving (the only glowing place on the whole body), two fangs pushed out by the short muzzle and lower jaw, goat horns sweeping back and pointed ears spread to the sides; no human face.
// 3. A single block of blue-gray carved stone, with moss growing on the shoulders, the top of the head and the wing edges; the right hand is raised with one clawed finger counting, and the front of the ledge stone has a row of chalk tally marks (the Chinese five-stroke tally).
// Kept distinct from Astragate (a stone lion of pale city-wall stone sitting bolt upright): a single block of deep blue-gray carved stone, arched-back crouch, bat wings and horns, with no gold trim or masonry joints.
// Personality: an old gatekeeper, gruff outside and soft inside. It looks fierce, yet crouches on the gate all night raising one clawed finger to count heads, and remembers whose child came home late; personality comes from posture and motion, not expression.
// Gaze order: the head (moonlight in the eye sockets, fangs, horns) first, the raised counting hand and the standing wing tips second, and the ledge stone and tail as support.
// Back: between the two wings on its back there is a bird's nest holding two pale blue eggs (it does not move at all by day, and the bird thinks it is a stone).
// Action table: idle is slow breathing, the head slowly turning left and right as if counting heads, the raised clawed finger counting one tick at a time, the tail tip flicking now and then, and blinking; move is a heavy crawl on all fours;
// charge-up act.wake brightens the light in the eye sockets and opens the wings slightly; strike is a pounce or a petrifying gaze (emitted from eyes); hit does not retreat and only tucks the head; victory crouches back onto the ledge stone and nods after counting off one clawed finger.
// Anchors: head, eyes, mouth, finger (the counting claw tip), hornL / hornR, wingL / wingR (wing tips), tail (the spade shape at the tail tip), nest (the nest on the back), ledge (the marks on the front of the ledge stone).

import * as THREE from 'three';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rbox, smooth, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
/** Convert latitude and longitude (centered on +z, longitude positive toward +x) to a unit direction */
const sph = (lon: number, lat: number) => v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));

// ───────────────────────── Helpers ─────────────────────────

function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i), n.fromBufferAttribute(na, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

function capGeo(r: number, ang: number, seg = 20, rings = 3): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** Loft from a cross-section table, with both ends rounded */
function limb(pts: THREE.Vector3[], rows: number[][], segs = 24, radial = 12, side?: THREE.Vector3): THREE.BufferGeometry {
  const pr = curveTable(rows);
  return loft(pts, (t) => pr(t), { segs, radial, side });
}

/** A tube with both ends rounded */
function tube(pts: THREE.Vector3[], r0: number, r1: number, segs = 12, radial = 8, side?: THREE.Vector3): THREE.BufferGeometry {
  return loft(pts, (t) => {
    const k = Math.min(1, Math.sqrt(t / 0.06), Math.sqrt((1 - t) / 0.06));
    const r = THREE.MathUtils.lerp(r0, r1, t) * k;
    return [r, r];
  }, { segs, radial, side });
}

/** Smooth pseudo-noise (about -1 to 1), built by layering sines that perturb each other */
function n3(x: number, y: number, z: number): number {
  return (Math.sin(x * 1.7 + Math.sin(y * 2.3)) + Math.sin(y * 1.9 + Math.sin(z * 1.3)) + Math.sin(z * 2.1 + Math.sin(x * 1.1))) / 3;
}

/**
 * Hand-chiseled undulation: vertices are pushed in and out a little along the normal (low-frequency noise), so the toon light/shadow boundary is not the perfect arc of smooth plastic.
 * Merge the vertices first and then push, so the sphere's seam and poles do not split open; recompute the normals after pushing
 */
function rough(g0: THREE.BufferGeometry, amp: number, freq: number): THREE.BufferGeometry {
  const g = smooth(g0);
  const P = g.attributes.position as THREE.BufferAttribute;
  const N = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    const k = amp * (n3(x * freq, y * freq, z * freq) + 0.5 * n3(x * freq * 2.7 + 5, y * freq * 2.7, z * freq * 2.7));
    P.setXYZ(i, x + N.getX(i) * k, y + N.getY(i) * k, z + N.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Distribution of moss on the stone (0-1): upward-facing surfaces, patches built from layered sines */
function mossAt(p: THREE.Vector3, n: THREE.Vector3): number {
  const k = Math.sin(p.x * 21 + 1.3) + Math.sin(p.y * 17 + p.z * 9) + Math.sin(p.z * 25 + p.x * 7 + 2.1);
  return ss(n.y, 0.4, 0.8) * ss(k, 0.95, 1.45);
}

/** Pointed ear: a leaf shape in the xy plane cupped toward -z, length h, width w */
function earGeo(w: number, h: number, th: number, cup: number): THREE.BufferGeometry {
  const S = 12;
  const J = 12;
  const pos: number[] = [];
  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const half = w * 0.5 * Math.pow(1 - s, 0.8) * (0.7 + 0.3 * Math.sin(Math.min(1, s * 3) * PI * 0.5)) + 1e-4;
    for (let j = 0; j < J; j++) {
      const f = (j / J) * PI * 2;
      const u = Math.cos(f);
      pos.push(u * half, s * h, -cup * (1 - u * u) * Math.sin(PI * Math.min(1, s + 0.1)) + Math.sin(f) * th * 0.5 * (1 - 0.5 * s));
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < S; i++)
    for (let j = 0; j < J; j++) {
      const a = i * J + j;
      const a1 = i * J + ((j + 1) % J);
      idx.push(a, a1, a + J, a + J, a1, a1 + J);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const P = g.attributes.position as THREE.BufferAttribute;
  const N = g.attributes.normal as THREE.BufferAttribute;
  let sum = 0;
  for (let i = 0; i < P.count; i++) if (i % J > 0 && i % J < J / 2) sum += N.getZ(i);
  if (sum < 0) {
    const a = g.index!.array as Uint32Array | Uint16Array;
    for (let k = 0; k < a.length; k += 3) [a[k + 1], a[k + 2]] = [a[k + 2], a[k + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** Make the object's y axis point along yDir and its z axis face zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// ───────────────────────── Shape ─────────────────────────

export function buildGargoyleLab(): LabModel {
  const RIMC = 0xc9d8ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    stone: vc(labToon(0xffffff, { speckle: 0.16, rim: 0.5, rimColor: RIMC })),
    horn: labToon(0x4a5060, { speckle: 0.06, spec: 0.4, specTh: 0.95, rim: 0.45, rimColor: RIMC }),
    iron: labToon(0x34343c, { ramp: 'metal', spec: 1.0, specTh: 0.92, rim: 0.4 }),
    chalk: labToon(0xf4f1e8, { rim: 0.2 }),
    eye: labToon(0xfff0a8, { ramp: 'gem', emissive: 0xffc040, emissiveAmt: 0.75, rim: 0 }),
    socket: labToon(0x1e2130, { rim: 0 }),
    tooth: labToon(0xe2dccd, { speckle: 0.05, rim: 0.3 }),
    nest: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xffe8c8 })),
    egg: labToon(0xc4e4ea, { rim: 0.4, rimColor: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'gargoyle-lab';
  const { add, group, rivet } = partKit();
  const BODY = 9621;

  // The midpoint of the ledge stone is at the origin; pose: breathing; body: parts are placed in absolute coordinates
  const pose = group(root);
  const body = group(pose, [0, 0, 0.02]);

  const cStone = col(0x6d7688);
  const cStoneDk = col(0x535a6a);
  const cStoneLt = col(0x8d96a6);
  const cMoss = col(0x6f8f3e);
  const cMossLt = col(0x93b04e);
  const cChip = col(0xa3aab6);
  const cStreak = col(0x474d5b);
  // Base color of the stone: large light and dark mottling, vertical rain streaks and scattered pale chips (only the base color changes, the number of shading steps stays the same)
  const rock = (p: THREE.Vector3, n: THREE.Vector3) => {
    const c = cStone.clone().lerp(cStoneLt, ss(n.y, 0.3, 0.9) * 0.45).lerp(cStoneDk, ss(-n.y, 0.2, 0.8) * 0.5);
    c.multiplyScalar(1 + 0.14 * n3(p.x * 9, p.y * 9, p.z * 9));
    const streak = ss(Math.sin(p.x * 61 + Math.sin(p.y * 5) * 2 + p.z * 37), 0.55, 0.95) * (1 - Math.abs(n.y)) * ss(n3(p.x * 4 + 3, p.y * 2, p.z * 4), -0.2, 0.4);
    c.lerp(cStreak, streak * 0.45);
    return c.lerp(cChip, ss(n3(p.x * 23 + 7, p.y * 23, p.z * 23 + 1), 0.72, 0.8) * 0.7);
  };
  const stoneColor = (p: THREE.Vector3, n: THREE.Vector3) => {
    const c = rock(p, n);
    const m = mossAt(p, n);
    return c.lerp(cMoss.clone().lerp(cMossLt, ss(n.y, 0.7, 1)), m);
  };

  // ── Ledge stone: the lintel stone of the dwarf city gate, with a projecting eave molding along the front edge, three iron nails and a row of chalk tally marks ──
  const cLedge = col(0x857a70);
  const cLedgeDk = col(0x645b54);
  const ledgeColor = (p: THREE.Vector3, n: THREE.Vector3) => cLedge.clone().lerp(cLedgeDk, ss(-n.y, 0.1, 0.9) * 0.6 + ss(-p.y, -0.06, -0.01) * 0.2).lerp(cMoss, mossAt(p.clone().multiplyScalar(0.8), n) * 0.7);
  {
    // A chunk is broken off at the upper left front corner: vertices near the corner are pushed inward, and the break is painted a light color as a fresh fracture
    const g = smooth(rbox(0.84, 0.14, 0.58, 0.03, 3));
    const P = g.attributes.position as THREE.BufferAttribute;
    const corner = v(-0.42, 0.07, 0.29);
    const q = v(0, 0, 0);
    for (let i = 0; i < P.count; i++) {
      q.fromBufferAttribute(P, i);
      const d = q.distanceTo(corner);
      if (d < 0.1) q.lerp(v(0, 0, 0), ((0.1 - d) / 0.1) ** 1.5 * 0.13);
      P.setXYZ(i, q.x, q.y, q.z);
    }
    g.computeVertexNormals();
    add(root, paint(g, (p, n) => ledgeColor(p, n).lerp(cChip, (1 - ss(p.distanceTo(corner), 0.05, 0.09)) * 0.7)), M.stone, [0, 0.07, -0.02]);
  }
  add(root, paint(rbox(0.9, 0.04, 0.07, 0.015, 2), ledgeColor), M.stone, [0, 0.14, 0.26]);
  for (const x of [-0.33, 0.33]) rivet(root, M.iron, [x, 0.075, 0.27], [0, 0, 1], 0.018);
  const tally = group(root, [-0.02, 0.07, 0.271]);
  for (let i = 0; i < 4; i++) add(tally, rbox(0.012, 0.07, 0.008, 0.004, 1), M.chalk, [-0.045 + i * 0.03, 0, 0]);
  add(tally, rbox(0.012, 0.13, 0.008, 0.004, 1), M.chalk, [0, 0, 0.003], [0, 0, 1.05]);

  // ── Torso: an arched back, a broad chest, a narrow waist and the neck stretching forward ──
  const torsoPts = [v(0, 0.28, -0.12), v(0, 0.4, -0.1), v(0, 0.52, -0.04), v(0, 0.63, 0.03), v(0, 0.72, 0.09), v(0, 0.8, 0.14)];
  add(body, paint(rough(limb(torsoPts, [[0, 0, 0, 0], [0.12, 0.15, 0.13, 0], [0.4, 0.185, 0.155, 0], [0.64, 0.225, 0.15, -0.035], [0.84, 0.16, 0.12, -0.01], [1, 0.1, 0.1, 0]], 40, 24, v(1, 0, 0)), 0.007, 11), stoneColor), M.stone).userData.inkGroup = BODY;

  // ── Legs: crouched, with the thighs up against the chest and the shins down, as a single loft (the knee does not fold like a robot's) ──
  for (const sx of [-1, 1]) {
    add(body, paint(rough(limb([v(sx * 0.08, 0.34, -0.08), v(sx * 0.16, 0.42, 0.03), v(sx * 0.2, 0.46, 0.15), v(sx * 0.205, 0.34, 0.18), v(sx * 0.195, 0.2, 0.15)], [[0, 0, 0], [0.1, 0.095, 0.095], [0.35, 0.088, 0.085], [0.55, 0.066, 0.066], [0.8, 0.052, 0.054], [1, 0.05, 0.05]], 30, 14, v(1, 0, 0)), 0.005, 13), rock), M.stone);
    // Paw and three toes, the claws hooked over the front edge of the ledge stone
    add(body, paint(limb([v(sx * 0.195, 0.24, 0.12), v(sx * 0.2, 0.19, 0.17), v(sx * 0.2, 0.18, 0.22)], [[0, 0, 0], [0.15, 0.06, 0.045], [0.7, 0.062, 0.04], [1, 0.05, 0.035]], 12, 10, v(1, 0, 0)), rock), M.stone);
    for (const dx of [-0.045, 0, 0.045]) {
      const x = sx * 0.2 + dx;
      add(body, paint(tube([v(x, 0.19, 0.19), v(x, 0.178, 0.245), v(x * 1.02, 0.155, 0.275)], 0.024, 0.02, 10, 8), rock), M.stone);
      const cg = group(body, [x * 1.02, 0.155, 0.275]);
      orient(cg, v(0, -1, 0.25), v(0, 0, 1));
      add(cg, lathe([[0.001, -0.004], [0.017, 0.0], [0.012, 0.03], [0.001, 0.055]], 8), M.horn);
    }
  }

  // ── Arms: the left hand (+x) rests on the knee, and the right hand (-x) is raised with one clawed finger counting ──
  const armRows = [[0, 0, 0], [0.1, 0.07, 0.07], [0.45, 0.058, 0.06], [1, 0.045, 0.045]];
  add(body, paint(rough(limb([v(0.14, 0.66, 0.0), v(0.29, 0.52, 0.04), v(0.27, 0.48, 0.17), v(0.24, 0.5, 0.22)], armRows, 24, 12, v(1, 0, 0)), 0.004, 14), rock), M.stone);
  {
    // The hand resting on the knee: a palm and three clawed fingers hanging forward
    add(body, paint(new THREE.SphereGeometry(0.055, 14, 10), rock), M.stone, [0.23, 0.51, 0.24], [0.2, 0, 0], [1.1, 0.7, 1]);
    for (const dx of [-0.035, 0, 0.035]) {
      add(body, paint(tube([v(0.23 + dx, 0.51, 0.25), v(0.23 + dx * 1.2, 0.5, 0.3), v(0.23 + dx * 1.3, 0.465, 0.315)], 0.018, 0.015, 10, 8), rock), M.stone);
      const cg = group(body, [0.23 + dx * 1.3, 0.465, 0.315]);
      orient(cg, v(0, -1, 0.3), v(0, 0, 1));
      add(cg, lathe([[0.001, -0.004], [0.013, 0.0], [0.009, 0.022], [0.001, 0.04]], 7), M.horn);
    }
  }
  add(body, paint(rough(limb([v(-0.14, 0.66, 0.0), v(-0.3, 0.56, 0.08), v(-0.29, 0.7, 0.19), v(-0.27, 0.76, 0.21)], armRows, 24, 12, v(1, 0, 0)), 0.004, 14), rock), M.stone);
  const handG = group(body, [-0.265, 0.79, 0.215], [0.1, 0.3, 0.12]);
  {
    add(handG, paint(new THREE.SphereGeometry(0.052, 14, 10), rock), M.stone, [0, 0, 0], [0, 0, 0], [1, 1.1, 0.72]);
    // The raised index finger
    add(handG, paint(tube([v(0.01, 0.03, 0.01), v(0.012, 0.09, 0.012), v(0.012, 0.13, 0.008)], 0.017, 0.014, 10, 8), rock), M.stone);
    const tip = group(handG, [0.012, 0.13, 0.008]);
    add(tip, lathe([[0.001, -0.004], [0.012, 0.0], [0.009, 0.022], [0.001, 0.04]], 7), M.horn, [0, 0, 0], [-0.2, 0, 0]);
    // The two folded fingers and the thumb
    for (const dx of [-0.02, -0.042]) add(handG, paint(tube([v(dx, 0.03, 0.02), v(dx, 0.05, 0.05), v(dx, 0.02, 0.06)], 0.016, 0.014, 8, 8), rock), M.stone);
    add(handG, paint(tube([v(0.03, -0.01, 0.02), v(0.045, 0.02, 0.045), v(0.03, 0.04, 0.05)], 0.016, 0.013, 8, 8), rock), M.stone);
  }
  const finger = group(handG, [0.012, 0.17, 0.0]);

  // ── Head: a carved stone beast head. A wide face, a thick brow ridge across the forehead, a short muzzle and jaw, and two lower fangs pushed up past the lips; no human face ──
  const HC = v(0, 0.88, 0.17);
  const HR = 0.14;
  const HS = v(1.15, 0.95, 1.0);
  const headG = group(body, HC.toArray() as [number, number, number]);
  const onHead = (d: THREE.Vector3, off = 0) => v(d.x * HS.x, d.y * HS.y, d.z * HS.z).multiplyScalar(HR + off);
  // The eye socket is a bowl recessed into the skull itself (vertices pushed inward); the base color inside the socket is darkened, and the top edge under the brow bone is the darkest
  const EYE_DIRS = [-1, 1].map((sx) => sph(sx * 0.38, 0.17));
  const SOCK_A = 0.31;
  const SOCK_D = 0.036;
  const sockAt = (u: THREE.Vector3) => Math.max(...EYE_DIRS.map((d) => {
    const a = Math.acos(THREE.MathUtils.clamp(u.dot(d), -1, 1));
    return a < SOCK_A ? 0.5 * (1 + Math.cos((PI * a) / SOCK_A)) : 0;
  }));
  {
    const g = smooth(new THREE.SphereGeometry(HR, 48, 36));
    const P = g.attributes.position as THREE.BufferAttribute;
    const u = v(0, 0, 0);
    for (let i = 0; i < P.count; i++) {
      u.fromBufferAttribute(P, i).normalize();
      const r = HR - SOCK_D * sockAt(u) + 0.004 * n3(u.x * 9, u.y * 9, u.z * 9);
      P.setXYZ(i, u.x * r, u.y * r, u.z * r);
    }
    g.computeVertexNormals();
    const cHollow = col(0x262a38);
    paint(g, (p, n) => {
      const uu = p.clone().normalize();
      const k = sockAt(uu);
      const base = n.y > 0.72 && k === 0 ? stoneColor(p, n) : rock(p, n);
      return base.lerp(cHollow, ss(k, 0.15, 0.7) * (0.75 + 0.25 * ss(n.y, -0.6, 0.2)));
    });
    add(headG, g, M.stone, [0, 0, 0], [0, 0, 0], HS.toArray() as [number, number, number]).userData.inkGroup = BODY;
  }
  // The upper muzzle and the lower jaw are two blocks, and the boundary between them is the mouth (a carved stone jaw, with no smiling mouth line drawn)
  add(headG, paint(rough(new THREE.SphereGeometry(0.09, 26, 16), 0.004, 20), rock), M.stone, [0, -0.04, 0.1], [0, 0, 0], [1.25, 0.7, 0.85]).userData.inkGroup = BODY;
  add(headG, paint(rough(new THREE.SphereGeometry(0.075, 22, 14), 0.004, 20), rock), M.stone, [0, -0.097, 0.078], [0.15, 0, 0], [1.12, 0.62, 0.95]);
  // Nose: a flat block with two nostrils
  add(headG, paint(new THREE.SphereGeometry(1, 14, 10), rock), M.stone, [0, -0.012, 0.19], [-0.3, 0, 0], [0.04, 0.026, 0.024]).userData.inkGroup = BODY;
  for (const sx of [-1, 1]) add(headG, new THREE.SphereGeometry(0.009, 8, 6), M.socket, [sx * 0.017, -0.017, 0.213]);
  // Two lower fangs: pushed up from both sides of the lower jaw past the upper lip
  for (const sx of [-1, 1]) {
    const tg = group(headG, [sx * 0.078, -0.088, 0.14], [-0.2, 0, -sx * 0.18]);
    add(tg, lathe([[0.001, -0.012], [0.017, -0.005], [0.014, 0.02], [0.001, 0.05]], 8), M.tooth);
  }

  // ── Eyes: at the bottom of the socket there is only a small point of moonlight-colored light (not a whole glowing disc); above the socket a thick brow bone across the forehead pressing forward ──
  const eyeOrbs: THREE.Mesh[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const dotGeo = new THREE.SphereGeometry(0.0095, 10, 8);
  for (const d of EYE_DIRS) {
    const eg = group(headG, onHead(d, -SOCK_D + 0.006).toArray() as [number, number, number]);
    eg.quaternion.setFromUnitVectors(FWD, d);
    eyeOrbs.push(add(eg, dotGeo, M.eye, [0, 0, 0], [0, 0, 0], [1, 1, 0.6]));
    eyeAnchors.push(group(eg, [0, 0, 0.012]));
  }
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const lon = -0.8 + (i / 12) * 1.6;
      pts.push(onHead(sph(lon, 0.5 + 0.04 * Math.cos((lon / 0.8) * PI * 0.5)), 0.008));
    }
    add(headG, paint(rough(tube(pts, 0.036, 0.036, 28, 10), 0.003, 25), rock), M.stone).userData.inkGroup = BODY;
  }

  // ── Pointed ears: spreading to the sides and slightly back and up ──
  for (const sx of [-1, 1]) {
    const eg = group(headG, onHead(sph(sx * 1.35, 0.15), -0.02).toArray() as [number, number, number]);
    orient(eg, v(sx * 1, 0.35, -0.35), v(0, 0.3, 1));
    add(eg, paint(earGeo(0.1, 0.2, 0.03, 0.025), rock), M.stone).userData.inkGroup = BODY;
  }

  // ── Goat horns: sweeping back from the two sides of the top of the head and curving slightly upward, with ridges ring after ring ──
  const hornTips: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const b = onHead(sph(sx * 0.35, 0.7), -0.02);
    const pts = [b, b.clone().add(v(sx * 0.02, 0.07, -0.05)), b.clone().add(v(sx * 0.05, 0.11, -0.14)), b.clone().add(v(sx * 0.08, 0.1, -0.23)), b.clone().add(v(sx * 0.1, 0.07, -0.29))];
    const g = loft(pts, (t) => {
      const r = 0.036 * (1 - 0.85 * t) * (1 + 0.08 * Math.max(0, Math.sin(t * 38))) * Math.min(1, Math.sqrt((1 - t) / 0.03 + 0.001));
      return [r, r];
    }, { segs: 34, radial: 10 });
    add(headG, g, M.horn);
    hornTips.push(group(headG, pts[4].toArray() as [number, number, number]));
  }

  // ── Stone bat wings: folded wings standing up behind the shoulders with the wing tips higher than the head, the rear edge scalloped in segments, and three finger-bone ridges on the wing surface ──
  const wings: { g: THREE.Group; sx: number }[] = [];
  const wingTips: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const wg = group(body, [sx * 0.11, 0.7, -0.1], [0, -sx * 0.25, -sx * 0.3]);
    // The wing surface is in the xy plane (x backward, y up), extruded and then turned to the side of the body
    const W: [number, number] = [0.06, 0.46];
    const T: [number, number][] = [[0.22, 0.34], [0.32, 0.12], [0.3, -0.1]];
    const sh = new THREE.Shape();
    // A notch is broken out of the leading edge and the first finger tip is snapped off (the break is flat), the age of the stone
    const T0b: [number, number] = [T[0][0] - 0.004, T[0][1] - 0.014];
    sh.moveTo(-0.03, -0.02);
    sh.lineTo(-0.01, 0.22);
    sh.lineTo(-0.002, 0.3);
    sh.lineTo(0.022, 0.312);
    sh.lineTo(0.018, 0.345);
    sh.lineTo(W[0], W[1] + 0.06);
    sh.lineTo(T[0][0] - 0.03, T[0][1] + 0.022);
    sh.lineTo(T0b[0], T0b[1]);
    const sc = (a: [number, number], b: [number, number]) => sh.quadraticCurveTo(THREE.MathUtils.lerp((a[0] + b[0]) / 2, W[0], 0.35), THREE.MathUtils.lerp((a[1] + b[1]) / 2, W[1], 0.35), b[0], b[1]);
    sc(T0b, T[1]);
    sc(T[1], T[2]);
    sc(T[2], [0.1, -0.16]);
    sh.lineTo(-0.03, -0.02);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -0.012);
    g.deleteAttribute('uv');
    g.rotateY(PI / 2);
    // rotateY(PI/2) makes x go to -z (backward) and the thickness go to +x; on both the left and right the thickness points outward
    if (sx < 0) g.scale(-1, 1, 1);
    const wingColor = (p: THREE.Vector3, n: THREE.Vector3) => stoneColor(p.clone().add(v(sx * 0.3, 0.7, 0)), n);
    // The front and back faces of the wing plate have vertices only on the outer edge (big triangles), so per-vertex mottling would become triangular color patches: apply only shading and moss, and leave the stone grain to the material's mottling
    const slabColor = (p: THREE.Vector3, n: THREE.Vector3) => {
      const q = p.clone().add(v(sx * 0.3, 0.7, 0));
      return cStone.clone().lerp(cStoneLt, ss(n.y, 0.3, 0.9) * 0.45).lerp(cStoneDk, ss(-n.y, 0.2, 0.8) * 0.5).lerp(cMoss, mossAt(q, n) * (1 - ss(Math.abs(n.x), 0.5, 0.9)));
    };
    add(wg, paint(g, slabColor), M.stone);
    const toW = (x: number, y: number) => v(sx * 0.028, y, -x);
    add(wg, paint(tube([toW(-0.02, 0.0), toW(-0.005, 0.24), toW(W[0], W[1])], 0.03, 0.022, 14, 8), wingColor), M.stone);
    for (const tp of [[T0b[0] - 0.012, T0b[1] + 0.008], T[1], T[2]]) add(wg, paint(tube([toW(W[0], W[1]), toW((W[0] + tp[0]) / 2 + 0.01, (W[1] + tp[1]) / 2 + 0.02), toW(tp[0], tp[1])], 0.018, 0.012, 12, 8), wingColor), M.stone);
    // A small horn claw pointing up at the wrist
    const cg = group(wg, toW(W[0], W[1] + 0.05).toArray() as [number, number, number]);
    add(cg, lathe([[0.001, -0.01], [0.016, 0.0], [0.011, 0.03], [0.001, 0.06]], 8), M.horn, [0, 0, 0], [-0.3, 0, 0]);
    if (sx < 0) {
      // Mirrored geometry has to flip its facing (negative scale)
      const a = g.index;
      if (a) {
        const arr = a.array as Uint32Array | Uint16Array;
        for (let k = 0; k < arr.length; k += 3) [arr[k + 1], arr[k + 2]] = [arr[k + 2], arr[k + 1]];
      } else {
        const P = g.attributes.position as THREE.BufferAttribute;
        const Nn = g.attributes.normal as THREE.BufferAttribute;
        const C = g.attributes.color as THREE.BufferAttribute;
        for (let k = 0; k < P.count; k += 3)
          for (const A of [P, Nn, C]) {
            const t1 = [A.getX(k + 1), A.getY(k + 1), A.getZ(k + 1)];
            A.setXYZ(k + 1, A.getX(k + 2), A.getY(k + 2), A.getZ(k + 2));
            A.setXYZ(k + 2, t1[0], t1[1], t1[2]);
          }
      }
    }
    wings.push({ g: wg, sx });
    wingTips.push(group(wg, toW(W[0], W[1] + 0.1).toArray() as [number, number, number]));
  }

  // ── Tail: hanging from behind the rump onto the ledge stone, wrapping along the stone toward the +x side to the front, with a spade shape at the end ──
  const tailPts = [v(0, 0.3, -0.19), v(0.06, 0.22, -0.28), v(0.2, 0.19, -0.3), v(0.34, 0.19, -0.2), v(0.39, 0.2, -0.07), v(0.38, 0.26, 0.0)];
  add(body, paint(rough(tube(tailPts, 0.045, 0.02, 30, 10), 0.004, 16), stoneColor), M.stone);
  const tailTip = group(body, [0.38, 0.26, 0.0]);
  const spadeBase = group(tailTip);
  orient(spadeBase, v(-0.05, 0.75, 0.66), v(0.6, 0, 0.8));
  const spade = group(spadeBase);
  {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.01);
    sh.quadraticCurveTo(0.055, 0.02, 0.05, 0.05);
    sh.lineTo(0.0, 0.12);
    sh.lineTo(-0.05, 0.05);
    sh.quadraticCurveTo(-0.055, 0.02, 0, -0.01);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -0.008);
    g.deleteAttribute('uv');
    add(spade, paint(g, rock), M.stone, [0, -0.012, 0]);
  }

  // ── Nest on the back: between the two wings, a ring of tangled twigs and two pale blue eggs ──
  const nest = group(body, [0, 0.655, -0.175]);
  orient(nest, v(0, 0.62, -0.78), v(0, 0.78, 0.62));
  {
    const cTw = col(0x7a5a3a);
    const cTwDk = col(0x543e2a);
    const ring = new THREE.TorusGeometry(0.07, 0.028, 10, 28).rotateX(PI / 2);
    {
      const P = ring.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const a = Math.atan2(P.getZ(i), P.getX(i));
        const k = 1 + 0.12 * Math.sin(a * 9 + P.getY(i) * 60) + 0.08 * Math.sin(a * 17);
        P.setXYZ(i, P.getX(i) * (0.97 + 0.03 * k), P.getY(i) * k, P.getZ(i) * (0.97 + 0.03 * k));
      }
      ring.computeVertexNormals();
    }
    ring.deleteAttribute('uv');
    add(nest, paint(ring, (p) => cTw.clone().lerp(cTwDk, ss(Math.sin(Math.atan2(p.z, p.x) * 13 + p.y * 90), 0.2, 0.9) * 0.7)), M.nest, [0, 0.01, 0]);
    add(nest, paint(new THREE.CylinderGeometry(0.062, 0.05, 0.02, 20), () => cTwDk), M.nest, [0, 0.0, 0]);
    add(nest, new THREE.SphereGeometry(0.026, 12, 8), M.egg, [-0.02, 0.025, 0.005], [0.3, 0, 0.5], [1, 1.28, 1]);
    add(nest, new THREE.SphereGeometry(0.024, 12, 8), M.egg, [0.022, 0.022, -0.01], [-0.2, 0, -0.6], [1, 1.28, 1]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const rig = {
    head: group(headG, [0, 0, HR * 0.9]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(headG, [0, -0.075, 0.19]),
      finger,
      hornL: hornTips[1],
      hornR: hornTips[0],
      wingL: wingTips[1],
      wingR: wingTips[0],
      tail: group(spade, [0, 0, -0.06]),
      nest: group(nest, [0, 0.03, 0]),
      ledge: group(tally, [0, 0, 0.01]),
    },
  };
  const act = { wake: 0 };

  mergeStatic(root, {
    owners: [pose, body, headG, handG, spade, ...wings.map((w) => w.g)],
    keep: [...eyeOrbs],
    rig,
  });

  // ── Idle ──
  let blinkIn = 2.4;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    const wk = act.wake;
    const br = Math.sin(t * 1.1);
    body.scale.set(1 + br * 0.008, 1 + br * 0.006, 1 + br * 0.008);
    // The head slowly turns left and right as if counting heads; it pauses for each one counted
    const step = Math.floor(t / 1.8);
    const k = ss(t - step * 1.8, 0, 0.5);
    const look = (i: number) => Math.sin(i * 1.9) * 0.3;
    headG.rotation.set(-0.04 + Math.sin(t * 0.6) * 0.02, THREE.MathUtils.lerp(look(step - 1), look(step), k), Math.sin(t * 0.4) * 0.04);
    // Counting: the clawed finger ticks one at a time
    const tap = Math.max(0, Math.sin(t * PI / 1.8)) ** 6;
    handG.rotation.set(0.1 + tap * 0.18, 0.3, 0.12);
    for (const w of wings) w.g.rotation.set(0, -w.sx * (0.25 + wk * 0.35), -w.sx * (0.3 + wk * 0.2 + Math.sin(t * 1.1) * 0.012));
    spade.rotation.set(0, 0, Math.max(0, Math.sin(t * 0.7) - 0.85) * 2.5 * Math.sin(t * 12));
    M.eye.emissiveIntensity = 0.75 + wk * 0.9 + Math.sin(t * 0.9) * 0.06;
    let close = 0;
    if (dt === 0) {
      const bt = t % 4.2;
      close = bt > 3.9 && bt < 4.1 ? Math.min(1, Math.sin(((bt - 3.9) / 0.2) * PI) * 1.3) : 0;
    } else {
      blinkIn -= dt;
      if (blinkIn <= 0) {
        blinkT = 0;
        blinkIn = 3.2 + ((t * 7.3) % 3);
      }
      if (blinkT >= 0) {
        blinkT += dt;
        const q = blinkT / 0.22;
        close = q < 1 ? Math.min(1, Math.sin(q * PI) * 1.3) : 0;
        if (q >= 1) blinkT = -1;
      }
    }
    // Blink: the light in the eye sockets squashes down once
    for (const o of eyeOrbs) o.scale.set(1, 1 - 0.85 * close, 1);
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0, 0.62, 0), radius: 0.78, rig, act };
}
