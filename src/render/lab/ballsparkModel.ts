// Ball Lightning Core (model lab version): a glowing ball that rolls across the grassland on nights when thunderclouds hang low; children chase it and adults carry the children back to the tent, because it explodes when it gets excited. Thunder, N, burst / self-destruct.
// It has no face to begin with: no eyes or mouth are added, the focus is the glowing thunder core, and its mood is carried entirely by the light's flicker, the arcs' rotation speed and the rhythm of its bouncing.
// Identifying features: 1. An amber-gold round thunder core (the main emissive), its surface covered with white-hot branching lightning marks (the tree-branch patterns left on something struck by lightning) spreading from two strike points, front and back;
// 2. Three blue-purple jagged arcs, each circling the core along its own tilted plane, tapering to points at both ends, with one occasionally flickering off; 3. Three jagged tail flames trail out behind and spread backward, so you can tell it is rolling forward.
// Body shape: a ball floating low above the ground, as a whole like a comet head wrapped in arcs. Personality: a child that cannot stop once excited; the happier it is the brighter it glows, and when it glows too bright it explodes.
// Gaze order: the core and lightning marks first, the arcs second, the tail flames as support.
// Action table: idle is quick small bounces, the core slowly rolling and flickering, each arc turning on its own, and now and then one arc flickering off; charge-up swells and brightens the core and speeds up the arcs (act.charge);
// strike slams the whole ball forward; hit flashes the core once and makes the arcs jitter wildly; victory is repeated jumps in place. Anchors: head (directly in front of the core), mouth (same as head), core (center of the core), tail (end of the tail flames). No eyes (eyes is empty).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Geometry helpers ─────────────────────────

/**
 * Polyline tube: the cross-section at each vertex sits on the bisecting plane of the two adjacent segments, so the corners stay sharp (lightning needs sharp corners, not curve-rounded ones).
 * rad(t) gives the radius at the t-th point (0-1, by point order); give 0 at the ends to taper them to points; when closed, the ends join. The frame moves in parallel along the path and does not twist.
 */
function polyTube(pts: THREE.Vector3[], rad: (t: number) => number, radial = 7, closed = false): THREE.BufferGeometry {
  const n = pts.length;
  const T: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const d0 = pts[i].clone().sub(prev);
    const d1 = next.clone().sub(pts[i]);
    if (d0.lengthSq() > 1e-12) d0.normalize();
    if (d1.lengthSq() > 1e-12) d1.normalize();
    T.push(d0.add(d1).normalize());
  }
  let N = new THREE.Vector3(0, 1, 0);
  if (Math.abs(N.dot(T[0])) > 0.9) N.set(1, 0, 0);
  N.addScaledVector(T[0], -N.dot(T[0])).normalize();
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    N = N.clone().addScaledVector(T[i], -N.dot(T[i])).normalize();
    const B = new THREE.Vector3().crossVectors(T[i], N);
    const r = rad(closed ? i / n : i / (n - 1));
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * PI * 2;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      pos.push(pts[i].x + N.x * c + B.x * s, pts[i].y + N.y * c + B.y * s, pts[i].z + N.z * c + B.z * s);
    }
  }
  const idx: number[] = [];
  const rows = closed ? n : n - 1;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = ((i + 1) % n) * radial + j;
      const a1 = i * radial + ((j + 1) % radial);
      const b1 = ((i + 1) % n) * radial + ((j + 1) % radial);
      idx.push(a, a1, b, b, a1, b1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // The normal of triangle (i,j)→(i,j+1)→(i+1,j) is B×T = N, always pointing outward
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/** One jagged arc: an arc of radius R in the xy plane, running from a0 to a1, each segment of uneven length kinking in and out and forward and back, tapering to points at both ends */
function arcBolt(R: number, a0: number, a1: number, segs: number, jag: number, r: number, seed: number): THREE.BufferGeometry {
  const rand = rng(seed);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = lerp(a0, a1, t + (i > 0 && i < segs ? (rand() - 0.5) * 0.35 / segs : 0));
    const side = i % 2 ? 1 : -1;
    const rr = R + (i > 0 && i < segs ? side * jag * (0.6 + rand() * 0.6) : 0);
    const z = i > 0 && i < segs ? -side * jag * 0.5 * (0.5 + rand()) : 0;
    pts.push(v3(Math.cos(a) * rr, Math.sin(a) * rr, z));
  }
  return polyTube(pts, (t) => r * Math.min(1, Math.pow(Math.min(t, 1 - t) / 0.14, 0.7)), 7);
}

/** A jagged spark or tail flame shooting out from o along d, thick at the root and pointed at the end */
function sparkBolt(o: THREE.Vector3, d: THREE.Vector3, len: number, segs: number, jag: number, r: number, seed: number): THREE.BufferGeometry {
  const rand = rng(seed);
  const D = d.clone().normalize();
  const S = new THREE.Vector3().crossVectors(D, Math.abs(D.y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0)).normalize();
  const U = new THREE.Vector3().crossVectors(S, D);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const side = i % 2 ? 1 : -1;
    const off = i === 0 ? 0 : side * jag * (0.6 + rand() * 0.5);
    const off2 = i === 0 ? 0 : (rand() - 0.5) * jag * 0.6;
    pts.push(o.clone().addScaledVector(D, len * t).addScaledVector(S, off).addScaledVector(U, off2));
  }
  return polyTube(pts, (t) => r * (1 - t) + 0.0004, 6);
}

// ───────────────────────── Shape ─────────────────────────

export function buildBallsparkLab(): LabModel {
  const RIMC = 0xd8ccff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const ARC = col(0x6a58ec);
  const ARC_L = col(0x9d8cff);

  const M = {
    core: labToon(0xffbf45, { ramp: 'gem', emissive: 0xff9a1e, emissiveAmt: 0.34, rim: 0.3, rimColor: 0xfff0c0 }),
    vein: labToon(0xfffbe8, { ramp: 'gem', emissive: 0xfff2b0, emissiveAmt: 0.6, rim: 0 }),
    arc: vc(labToon(0xffffff, { ramp: 'gem', emissive: 0x4a38d8, emissiveAmt: 0.18, rim: 0.55, rimColor: RIMC })),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'ballspark-lab';
  const { add, group } = partKit();

  const CY = 0.64;
  const float = group(root, [0, CY, 0]);

  // ── Core: an amber-gold sphere; its surface is covered with white-hot branching lightning marks spreading out from two strike points, upper front and lower back (same outline group as the ball, read by color alone) ──
  const coreG = group(float);
  const RC = 0.22;
  const CORE_G = 9981;
  add(coreG, new THREE.IcosahedronGeometry(RC, 10), M.core).userData.inkGroup = CORE_G;
  const rand = rng(11);
  const veins: THREE.BufferGeometry[] = [];
  const STEP = 0.034;
  const grow = (d0: THREE.Vector3, h0: THREE.Vector3, steps: number, w: number, depth: number) => {
    const d = d0.clone().normalize();
    const h = h0.clone().addScaledVector(d, -h0.dot(d)).normalize();
    const pts = [d.clone().multiplyScalar(RC + 0.003)];
    for (let i = 0; i < steps; i++) {
      h.applyAxisAngle(d, (rand() - 0.5) * 1.3);
      const axis = new THREE.Vector3().crossVectors(d, h).normalize();
      const ang = STEP / RC;
      d.applyAxisAngle(axis, ang);
      h.applyAxisAngle(axis, ang).addScaledVector(d, -h.dot(d)).normalize();
      pts.push(d.clone().multiplyScalar(RC + 0.003));
      if (depth < 2 && i > 0 && i < steps - 2 && rand() < (depth === 0 ? 0.3 : 0.18)) {
        const side = rand() < 0.5 ? 1 : -1;
        grow(d, h.clone().applyAxisAngle(d, side * (0.6 + rand() * 0.4)), Math.max(2, Math.round((steps - i) * 0.55)), w * 0.62, depth + 1);
      }
    }
    veins.push(polyTube(pts, (t) => w * (1 - t * 0.8), 5));
  };
  for (const [hot, n] of [[v3(0.25, 0.55, 0.8), 4], [v3(-0.3, -0.5, -0.8), 3]] as [THREE.Vector3, number][]) {
    const d = hot.clone().normalize();
    const t0 = new THREE.Vector3().crossVectors(d, v3(0, 1, 0)).normalize();
    for (let k = 0; k < n; k++) grow(d, t0.clone().applyAxisAngle(d, (k / n) * PI * 2 + rand() * 0.5), 9 + Math.floor(rand() * 4), 0.013, 0);
  }
  for (const g of veins) add(coreG, g, M.vein).userData.inkGroup = CORE_G;
  // Strike points: two slightly raised white-hot dots
  for (const hot of [v3(0.25, 0.55, 0.8), v3(-0.3, -0.5, -0.8)]) {
    const d = hot.clone().normalize();
    add(coreG, new THREE.SphereGeometry(0.03, 12, 8), M.vein, [d.x * RC, d.y * RC, d.z * RC], [0, 0, 0], [1, 1, 1]).userData.inkGroup = CORE_G;
  }

  // ── Arcs: three blue-purple jagged arcs, each circling the core along its own tilted plane ──
  const arcs: { spin: THREE.Group; speed: number; base: number }[] = [];
  const arcDefs: [THREE.Vector3, number, number, number, number][] = [
    [v3(0.2, 1, 0.3), 0.35, 4.3, 0.37, 3],
    [v3(0.3, 0.35, 1), 1.6, 5.4, 0.4, 5],
    [v3(-1, 0.45, -0.2), 2.4, 5.2, 0.36, 8],
  ];
  arcDefs.forEach(([nrm, a0, a1, R, seed], i) => {
    const tilt = group(float);
    tilt.quaternion.setFromUnitVectors(v3(0, 0, 1), nrm.clone().normalize());
    const spin = group(tilt);
    const geo = arcBolt(R, a0, a1, 13, 0.038, 0.023, seed);
    const pa = geo.attributes.position as THREE.BufferAttribute;
    const cl: number[] = [];
    for (let k = 0; k < pa.count; k++) {
      const r = Math.hypot(pa.getX(k), pa.getY(k));
      const c = ARC.clone().lerp(ARC_L, sstep(r, R - 0.02, R + 0.04));
      cl.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    add(spin, geo, M.arc);
    arcs.push({ spin, speed: [1.6, -2.1, 2.6][i], base: i * 1.7 });
  });

  // ── Tail flames: three jagged flames at the back spreading backward and tilting slightly up, growing from the back of the core at the root ──
  const tailG = group(float);
  const tailDirs: [THREE.Vector3, number][] = [
    [v3(0, 0.4, -1), 0.44],
    [v3(0.6, 0.0, -1), 0.34],
    [v3(-0.6, 0.08, -1), 0.36],
  ];
  tailDirs.forEach(([d, len], i) => {
    const dn = d.clone().normalize();
    const o = dn.clone().multiplyScalar(RC - 0.05);
    const g = sparkBolt(o, dn, len, 5, 0.042, 0.033, 40 + i);
    const pa = g.attributes.position as THREE.BufferAttribute;
    const cl: number[] = [];
    for (let k = 0; k < pa.count; k++) {
      const t = clamp((o.z - pa.getZ(k)) / len, 0, 1);
      const c = ARC_L.clone().lerp(ARC, sstep(t, 0.1, 0.8));
      cl.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    add(tailG, g, M.arc);
  });
  const tailEnd = group(tailG, [0, 0.12, -RC - 0.44]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: quick small bounces, the core rolling and flickering, each arc turning on its own, one occasionally flickering off, tail flames swaying ──
  const act = { charge: 0 };
  let acc = 0;
  let lastGlow = Number.NaN;
  const update = (t: number, dt: number) => {
    // When time is frozen the phase is computed from t; during playback it is accumulated with dt (the rotation speed is changed by act)
    const k = 1 + act.charge * 2.5;
    acc = dt > 0 ? acc + dt * k : t * k;
    const hop = Math.abs(Math.sin(t * 3.2));
    float.position.y = CY + hop * 0.05 + Math.sin(t * 1.1) * 0.012;
    float.scale.set(1 + (1 - hop) * 0.025, 1 - (1 - hop) * 0.03, 1 + (1 - hop) * 0.025);
    coreG.rotation.set(acc * 0.9, acc * 0.35, 0);
    const pulse = 1 + Math.sin(t * 5.3) * 0.015 + act.charge * 0.14;
    coreG.scale.setScalar(pulse);
    for (const a of arcs) a.spin.rotation.z = a.base + acc * a.speed;
    // The second arc flickers off once every 2.7 s
    arcs[1].spin.visible = t % 2.7 > 0.12 || act.charge > 0.5;
    tailG.rotation.set(Math.sin(t * 2.1) * 0.06, Math.sin(t * 1.7) * 0.1, 0);
    const gl = 0.34 + Math.max(0, Math.sin(t * 2.4)) * 0.1 + act.charge * 0.5;
    if (Math.abs(gl - lastGlow) > 0.004) {
      lastGlow = gl;
      M.core.emissiveIntensity = gl;
    }
  };
  update(0, 0);

  const headA = group(float, [0, 0, RC]);
  const coreA = group(float, [0, 0, 0]);
  const rig = { head: headA, eyes: [] as THREE.Object3D[], anchors: { mouth: headA, core: coreA, tail: tailEnd } };
  mergeStatic(root, {
    owners: [float, coreG, tailG, ...arcs.map((a) => a.spin)],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, CY, 0), radius: 0.68 };
}
