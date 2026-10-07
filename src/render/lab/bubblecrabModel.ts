// Reef Fortress (model lab version, N, water): a hermit crab that grew up carrying coral on its back, its shell growing bigger as it lived in it, until a whole reef became its home; on stormy nights fishermen shelter in the cave on its back.
// Identifying features: 1. A whole reef on its back as the shell (the silhouette is a small mountain), with pink branching coral and purple sea fans growing on top, and the spiral of the original snail shell set into one side.
// 2. An orange-red crab body peeking out of the pearl-colored shell mouth, with two claws one big and one small, the big claw held across the front (defending as offense).
// 3. The back is the cave where the fishermen shelter from the rain: a stone arch, a warm yellow lantern hanging inside the door, and a plank ramp laid to the ground.
// Body shape: a hermit crab, with the eyestalks topped by a crab's compound eyes (dark balls with fine facets, showing only a faint reflection on the facets; no sclera, iris, pupil or white highlight dot, and no eyelids), four walking legs arched at the sides; no mouth is drawn on the front of the carapace (a crab's mouthparts are below the carapace).
// Personality: a steady old landlord, with the big claw held in front to protect the guests sheltering on its back, unhurried; expressed by the pose of the big claw and the slowly turning eyestalks, not by expression.
// Gaze: the dark crab eyes on the eyestalks → the big claw and the coral on top → the lantern in the cave at the back.
// Actions: idle has the eyestalks swaying lightly, both eyestalks slowly turning together to look around, occasionally both drawing back at once (a crab has no eyelids and does not blink), the big claw pinching twice now and then, and the lantern swinging lightly; charge-up raises the big claw high (act.guard); hit retracts the eyestalks with the legs not retreating; victory pinches the big claw twice.
// Anchors: rig.head (between the two eyes), rig.eyes, anchors.mouth, anchors.claw (big claw tip), anchors.coral (top of the coral), anchors.cave (lantern). act: guard, glow.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lathe, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, wedge, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Geometry helpers ─────────────────────────

function ellipsePts(rx: number, ry: number, dy = 0, n = 24): [number, number][] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * PI * 2) * rx, Math.sin((i / n) * PI * 2) * ry + dy] as [number, number]);
}

function orientOut(g: THREE.BufferGeometry, ref: THREE.Vector3): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  let s = 0;
  for (let i = 0; i < pa.count; i++) s += (pa.getX(i) - ref.x) * na.getX(i) + (pa.getY(i) - ref.y) * na.getY(i) + (pa.getZ(i) - ref.z) * na.getZ(i);
  if (s < 0) {
    const idx = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** A grid surface wrapped around once (rows along the cross-section, columns around it); when the head and tail shrink to a point, the normal is averaged */
function wrapGrid(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c: THREE.Color }, ref: THREE.Vector3): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const cl = new Float32Array(rows * cols * 3);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      const k = (i * cols + j) * 3;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
      cl[k] = c.r;
      cl[k + 1] = c.g;
      cl[k + 2] = c.b;
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = i * cols + j2;
      const d = (i + 1) * cols + j2;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  orientOut(g, ref);
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (const i of [0, rows - 1]) {
    let spread = 0;
    for (let j = 1; j < cols; j++) spread = Math.max(spread, Math.abs(pos[(i * cols + j) * 3] - pos[i * cols * 3]) + Math.abs(pos[(i * cols + j) * 3 + 1] - pos[i * cols * 3 + 1]) + Math.abs(pos[(i * cols + j) * 3 + 2] - pos[i * cols * 3 + 2]));
    if (spread > 1e-5) continue;
    const n = new THREE.Vector3();
    for (let j = 0; j < cols; j++) n.x += na.getX(i * cols + j), n.y += na.getY(i * cols + j), n.z += na.getZ(i * cols + j);
    n.normalize();
    for (let j = 0; j < cols; j++) na.setXYZ(i * cols + j, n.x, n.y, n.z);
  }
  return g;
}

/** Apply vertex colors by position and normal (the material enables vertexColors and sets base color to white) */
function paint(g: THREE.BufferGeometry, f: THREE.ColorRepresentation | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const fixed = typeof f === 'function' ? null : col(f);
  for (let i = 0; i < pa.count; i++) {
    const c = fixed ?? (f as (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i));
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** Orientation with fwd as +z and upHint roughly as +y */
function basis(fwd: THREE.Vector3, upHint = UP): THREE.Quaternion {
  const z = fwd.clone().normalize();
  const x = new THREE.Vector3().crossVectors(upHint, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** A segment with both ends rounded off (crab leg, coral branch) */
function segment(pts: THREE.Vector3[], r0: number, r1: number, o: { segs?: number; radial?: number; tip?: number; flat?: number } = {}): THREE.BufferGeometry {
  const tip = o.tip ?? 0.12;
  const fl = o.flat ?? 1;
  return loft(pts, (t) => {
    const k = Math.min(1, t / tip, (1 - t) / tip);
    const e = Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
    const r = lerp(r0, r1, t) * e;
    return [r, r * fl];
  }, { segs: o.segs ?? 8, radial: o.radial ?? 8 });
}

// ───────────────────────── Shape ─────────────────────────

export function buildBubblecrabLab(): LabModel {
  const rand = rng(20260928);
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    stone: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xcfe8ff, speckle: 0.28 })),
    shell: vc(labToon(0xffffff, { rim: 0.55, rimColor: 0xffe0cc, spec: 0.22, specTh: 0.99 })),
    eye: labToon(0x20242e, { ramp: 'gem', rim: 0.3, rimColor: 0x8fb4cc, spec: 0.28, specTh: 0.93 }),
    glass: labToon(0xffe6a8, { ramp: 'gem', rim: 0, emissive: 0xffa640, emissiveAmt: 0.85 }),
    iron: labToon(0x4a4038, { ramp: 'metal', rim: 0.3, spec: 0.6, specTh: 0.97 }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'bubblecrab-lab';
  const { add, group } = partKit();
  const body = group(root);

  // Outline group: no lines between members of the same group
  const G_MOUND = 9501;
  const G_CARA = 9502;
  const G_CORAL = 9503;
  const G_LIP = 9504;

  // ── Reef shell: a lumpy stone mound with the lower edge flattened to the ground ──
  const MC = v3(0, 0.48, -0.2);
  const MA = v3(0.52, 0.46, 0.5);
  const lumps: [THREE.Vector3, number, number][] = [
    [v3(0.6, 0.8, -0.1).normalize(), 0.13, 0.08],
    [v3(-0.55, 0.75, 0.15).normalize(), 0.12, 0.06],
    [v3(-0.8, 0.3, -0.5).normalize(), 0.12, 0.07],
    [v3(0.7, 0.15, -0.7).normalize(), 0.09, 0.06],
    [v3(-0.1, 0.9, -0.45).normalize(), 0.1, 0.09],
    [v3(-0.95, -0.05, 0.2).normalize(), 0.08, 0.05],
    [v3(0.45, 0.45, -0.8).normalize(), 0.09, 0.05],
    [v3(-0.4, 0.3, -0.9).normalize(), 0.07, 0.05],
    [v3(0.85, 0.5, 0.25).normalize(), 0.08, 0.05],
    [v3(0.2, 0.75, 0.6).normalize(), 0.07, 0.05],
  ];
  const fM = (d: THREE.Vector3) => {
    let f = 1;
    for (const [u, a, w] of lumps) f += a * Math.exp((d.dot(u) - 1) / w);
    return f + 0.028 * Math.sin(d.x * 9 + 1) * Math.sin(d.y * 7) * Math.sin(d.z * 8 + 2) + 0.012 * Math.sin(d.x * 17 + d.z * 13);
  };
  const surf = (d: THREE.Vector3) => {
    const f = fM(d);
    const p = v3(MC.x + MA.x * d.x * f, MC.y + MA.y * d.y * f, MC.z + MA.z * d.z * f);
    if (p.y < 0.025) p.y = 0.025 + (p.y - 0.025) * 0.2;
    return p;
  };
  const dirTo = (p: THREE.Vector3) => v3((p.x - MC.x) / MA.x, (p.y - MC.y) / MA.y, (p.z - MC.z) / MA.z).normalize();
  const surfN = (d: THREE.Vector3) => {
    const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? v3(1, 0, 0) : UP).normalize();
    const t2 = new THREE.Vector3().crossVectors(d, t1);
    const e = 0.01;
    const a = surf(d.clone().addScaledVector(t1, e).normalize()).sub(surf(d.clone().addScaledVector(t1, -e).normalize()));
    const b = surf(d.clone().addScaledVector(t2, e).normalize()).sub(surf(d.clone().addScaledVector(t2, -e).normalize()));
    const n = a.cross(b).normalize();
    return n.dot(d) < 0 ? n.negate() : n;
  };
  const dSpiral = v3(1, 0.25, -0.3).normalize();
  {
    const cStone = col(0xbcab92);
    const cLow = col(0x8c7e6e);
    const cTop = col(0xd6c8ae);
    const cPink = col(0xcf9b96);
    const cOld = col(0xe2ceae);
    const ROWS = 30;
    const COLS = 48;
    const geo = wrapGrid(ROWS, COLS, (i, j) => {
      const lat = -PI / 2 + (PI * i) / (ROWS - 1);
      const lon = (j / COLS) * PI * 2;
      const d = v3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const p = surf(d);
      const c = cStone.clone().lerp(cLow, sstep(0.36 - p.y, 0, 0.26)).lerp(cTop, sstep(p.y, 0.78, 1.0));
      // Scattered pink crustose coralline algae, and the color is paler around the old snail shell set into the side
      const blot = Math.sin(d.x * 11 + 2) * Math.sin(d.z * 9) * Math.sin(d.y * 10 + 1);
      c.lerp(cPink, sstep(blot, 0.35, 0.5) * 0.7);
      c.lerp(cOld, sstep(d.dot(dSpiral), 0.86, 0.93));
      return { p, c };
    }, MC);
    add(body, geo, M.stone).userData.inkGroup = G_MOUND;
  }

  // The snail shell from back then set into the side: a spiral ridge coiling twice along the surface of the mound, with a shell apex at the center
  {
    const n0 = surfN(dSpiral);
    const u = UP.clone().addScaledVector(n0, -n0.dot(UP)).normalize();
    const w = new THREE.Vector3().crossVectors(n0, u);
    const c0 = surf(dSpiral);
    const pts: THREE.Vector3[] = [];
    const rads: number[] = [];
    const N = 36;
    for (let k = 0; k <= N; k++) {
      const s = k / N;
      const a = s * 1.8 * PI * 2;
      const r = 0.03 + 0.19 * Math.pow(s, 1.1);
      const q = c0.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r);
      const d = dirTo(q);
      const rad = 0.012 + 0.024 * s;
      pts.push(surf(d).addScaledVector(surfN(d), rad * 0.35));
      rads.push(rad);
    }
    const g = loft(pts, (t) => {
      const r = rads[Math.min(N, Math.round(t * N))] * Math.min(1, t / 0.04, (1 - t) / 0.03 + 0.25);
      return [r, r];
    }, { segs: 72, radial: 8 });
    add(body, paint(g, (p) => col(0xf2e4cc).lerp(col(0xc9a57e), 0.5 + 0.5 * Math.sin(p.y * 60))), M.shell);
    add(body, paint(new THREE.SphereGeometry(0.038, 10, 8), 0xf4e8d2), M.shell, c0.clone().addScaledVector(n0, 0.012).toArray() as [number, number, number]);
  }

  // Barnacles: a few small volcano-shaped cones on the mound
  {
    const g0 = lathe([[0.001, -0.01], [0.036, -0.01], [0.034, 0.012], [0.02, 0.03], [0.012, 0.032], [0.01, 0.018], [0.001, 0.016]], 8);
    paint(g0, (p) => (p.y > 0.026 || (p.y > 0.014 && Math.hypot(p.x, p.z) < 0.013) ? col(0x4a3f3a) : col(0xe9e2d6)));
    const dirs = [v3(0.8, 0.1, 0.4), v3(-0.75, 0.25, 0.3), v3(-0.6, -0.1, -0.7), v3(0.35, -0.2, -0.9), v3(0.2, 0.6, -0.75), v3(-0.9, 0.5, -0.2), v3(0.9, -0.2, -0.3)];
    for (const d0 of dirs) {
      const d = d0.normalize();
      const s = 0.8 + rand() * 0.5;
      const m = add(body, g0, M.stone, surf(d).toArray() as [number, number, number], [0, 0, 0], [s, s, s]);
      m.quaternion.setFromUnitVectors(UP, surfN(d));
    }
  }

  // Reef rocks: a few big stones half buried in the mound, so the silhouette has edges and does not look like a smooth egg
  {
    const cols = [0xa89e90, 0x9a9184, 0xb3a894, 0x958c80];
    const spots: [THREE.Vector3, number, number][] = [
      [v3(-0.7, 0.6, -0.1), 0.13, 1], [v3(-0.62, 0.45, -0.72), 0.12, 2], [v3(0.55, 0.85, -0.6), 0.11, 3],
      [v3(-0.9, -0.35, -0.3), 0.11, 1], [v3(0.8, -0.4, -0.45), 0.1, 0], [v3(0.1, 0.95, -0.6), 0.09, 2],
    ];
    for (const [d0, r, ci] of spots) {
      const d = d0.normalize();
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      const m0 = mergeVertices(g, 1e-4);
      const pa = m0.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) {
        const k = 0.82 + rand() * 0.3;
        pa.setXYZ(i, pa.getX(i) * k * 1.25, pa.getY(i) * k * 0.72, pa.getZ(i) * k);
      }
      m0.computeVertexNormals();
      const m = add(body, paint(m0, cols[ci]), M.stone, surf(d).addScaledVector(surfN(d), r * 0.15).toArray() as [number, number, number], [0, 0, 0], [r, r, r]);
      m.quaternion.setFromUnitVectors(UP, surfN(d)).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * PI));
    }
  }

  // ── Shell mouth: a pearl-colored lip with darkness inside, from which the crab body peeks out ──
  const dFront = v3(0, -0.28, 1).normalize();
  const LP = surf(dFront);
  const nF = surfN(dFront);
  {
    const lipG = group(body, LP.clone().addScaledVector(nF, 0.02).toArray() as [number, number, number]);
    lipG.quaternion.copy(basis(nF));
    const ring = new THREE.TorusGeometry(0.265, 0.044, 10, 40).scale(1, 0.78, 1);
    paint(ring, (p) => (Math.hypot(p.x, p.y / 0.78) < 0.255 ? col(0xf0b8b0) : col(0xf7e6d8)));
    add(lipG, ring, M.shell).userData.inkGroup = G_LIP;
    const hole = new THREE.ShapeGeometry(outline(ellipsePts(0.26, 0.2, 0, 32)), 1);
    add(lipG, paint(hole, 0x241a1e), M.shell, [0, 0, -0.012]).userData.inkGroup = G_LIP;
  }

  // ── Crab body: the carapace peeking out of the shell mouth, orange-red on top and cream underneath ──
  const K = LP.clone().add(v3(0, -0.01, 0.07));
  const KR = v3(0.23, 0.14, 0.19);
  const caraDir = (lon: number, lat: number) => v3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
  const caraF = (d: THREE.Vector3) => 1 + 0.12 * Math.exp(-(d.x * d.x) / 0.02 - ((d.y - 0.45) ** 2) / 0.06) * Math.max(0, d.z);
  const caraPt = (d: THREE.Vector3, lift = 0) => {
    const f = caraF(d);
    return v3(K.x + KR.x * d.x * f, K.y + KR.y * d.y * f, K.z + KR.z * d.z * f).addScaledVector(d, lift);
  };
  const cRed = col(0xde5238);
  const cOrange = col(0xef7a48);
  const cCream = col(0xf6d6b4);
  {
    const ROWS = 18;
    const COLS = 32;
    const geo = wrapGrid(ROWS, COLS, (i, j) => {
      const lat = -PI / 2 + (PI * i) / (ROWS - 1);
      const lon = (j / COLS) * PI * 2;
      const d = caraDir(lon, lat);
      const p = caraPt(d);
      const c = cOrange.clone().lerp(cRed, sstep(d.y, 0.1, 0.6)).lerp(cCream, sstep(-d.y, 0.05, 0.35));
      return { p, c };
    }, K);
    add(body, geo, M.shell).userData.inkGroup = G_CARA;
    // Small warts on the carapace
    for (const [lon, lat, r] of [[0.5, 0.55, 0.024], [-0.5, 0.55, 0.024], [0.9, 0.35, 0.02], [-0.9, 0.35, 0.02], [0.25, 0.85, 0.02], [-0.25, 0.85, 0.02]] as [number, number, number][]) {
      const d = caraDir(lon, lat);
      const m = add(body, paint(new THREE.SphereGeometry(r, 8, 6, 0, PI * 2, 0, PI / 2), 0xf28c5c), M.shell, caraPt(d, -0.004).toArray() as [number, number, number]);
      m.quaternion.setFromUnitVectors(UP, d);
      m.userData.inkGroup = G_CARA;
    }
  }
  // The crab's mouthparts are below the front edge of the carapace (the mouth anchor is placed there), and no mouth line is drawn on the front
  const mouthC = caraPt(caraDir(0, -0.3), 0.004);

  // ── Eyestalks and crab eyes: the eyestalk grows up from the front edge of the carapace, and its top opens to hold a crab's compound eye: a dark ball of flat facets (each facet reflecting on its own),
  //    with no sclera, iris, pupil or white highlight dot, and no eyelids ──
  const ER = 0.052;
  const stalks: { g: THREE.Group; s: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  // Flat facets: an icosahedron shares no vertices to begin with, so recomputing the normals gives each face its own flat shading
  const eyeball = new THREE.IcosahedronGeometry(ER, 3);
  eyeball.computeVertexNormals();
  for (const s of [-1, 1]) {
    const B = caraPt(caraDir(s * 0.32, 0.55), -0.01);
    const E = v3(s * 0.125, 0.67, B.z + 0.04);
    const stalkG = group(body, B.toArray() as [number, number, number]);
    stalks.push({ g: stalkG, s });
    const q = basis(v3(s * 0.24, 0.04, 1));
    const eyeG = group(stalkG, [E.x - B.x, E.y - B.y, E.z - B.z]);
    eyeG.quaternion.copy(q);
    // Eyestalk: in the eye's coordinates it grows from the root to the bottom of the eye, and its top opens to hold the eyeball
    const inv = q.clone().invert();
    const toEye = (p: THREE.Vector3) => p.clone().sub(E).applyQuaternion(inv);
    const stalkPts = [B.clone().add(v3(0, -0.03, -0.02)), B.clone().lerp(E, 0.45).add(v3(s * 0.01, 0, 0)), E.clone().add(v3(0, -ER * 0.55, -0.005))].map(toEye);
    const stalkGeo = loft(stalkPts, (t) => {
      const r = t < 0.8 ? lerp(0.034, 0.027, t / 0.8) : lerp(0.027, 0.036, (t - 0.8) / 0.2);
      const e = t > 0.96 ? Math.sqrt(Math.max(0, 1 - ((t - 0.96) / 0.04) ** 2)) : 1;
      return [r * e, r * e];
    }, { segs: 10, radial: 10 });
    add(eyeG, paint(stalkGeo, (p) => cRed.clone().lerp(cOrange, sstep(p.y, -0.09, -0.04))), M.shell).userData.inkGroup = 9510 + s;
    add(eyeG, eyeball, M.eye);
    eyeAnchors.push(group(eyeG, [0, 0, ER]));
  }

  // ── Walking legs: two on each side, with the knees arched higher than the carapace and the segments separate ──
  const legPaint = (p: THREE.Vector3) => cOrange.clone().lerp(cRed, sstep(p.y, 0.15, 0.4));
  for (const s of [-1, 1]) {
    const legs: THREE.Vector3[][] = [
      [v3(s * 0.2, 0.27, 0.33), v3(s * 0.44, 0.43, 0.43), v3(s * 0.58, 0.22, 0.5), v3(s * 0.62, 0.005, 0.55)],
      [v3(s * 0.21, 0.26, 0.2), v3(s * 0.47, 0.41, 0.2), v3(s * 0.63, 0.21, 0.15), v3(s * 0.68, 0.005, 0.12)],
    ];
    for (const [R, Kn, A, T] of legs) {
      const ext = (a: THREE.Vector3, b: THREE.Vector3, k: number) => a.clone().addScaledVector(b.clone().sub(a).normalize(), -k);
      add(body, paint(segment([ext(R, Kn, 0.0), R.clone().lerp(Kn, 0.5).add(v3(0, 0.02, 0)), ext(Kn, R, -0.02)], 0.042, 0.037), legPaint), M.shell);
      add(body, paint(segment([ext(Kn, A, 0.02), Kn.clone().lerp(A, 0.5), ext(A, Kn, -0.015)], 0.036, 0.031), legPaint), M.shell);
      const tipG = segment([ext(A, T, 0.015), A.clone().lerp(T, 0.5).add(v3(s * 0.012, 0, 0)), T], 0.03, 0.006, { tip: 0.1 });
      add(body, paint(tipG, (p) => (p.y < 0.06 ? col(0x4a2a24) : legPaint(p))), M.shell);
    }
  }

  // ── Claws: the big claw (+x) held across the front and the small claw (-x) tucked to the side; the arms are segmented, with warts on the palm and deep brown fingertips ──
  const buildClaw = (parent: THREE.Object3D, wrist: THREE.Vector3, fwd: THREE.Vector3, sc: number, tilt: number) => {
    const g = group(parent, wrist.toArray() as [number, number, number]);
    g.quaternion.copy(basis(fwd)).multiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), tilt));
    const PC = v3(0, 0, 0.1 * sc);
    const PR = v3(0.085, 0.075, 0.13).multiplyScalar(sc);
    const palm = wrapGrid(14, 22, (i, j) => {
      const lat = -PI / 2 + (PI * i) / 13;
      const lon = (j / 22) * PI * 2;
      const d = v3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const sw = 1 + 0.12 * Math.max(0, d.y) - 0.1 * Math.max(0, -d.z);
      const p = v3(PC.x + PR.x * d.x * sw, PC.y + PR.y * d.y * sw, PC.z + PR.z * d.z);
      return { p, c: cOrange.clone().lerp(cRed, sstep(d.y, -0.1, 0.5)).lerp(cCream, sstep(-d.y, 0.2, 0.6)) };
    }, PC);
    add(g, palm, M.shell);
    for (const [x, y, z] of [[0.5, 0.7, 0.3], [-0.4, 0.75, 0.1], [0.1, 0.9, -0.2], [0.75, 0.3, -0.3], [-0.7, 0.4, 0.45]] as [number, number, number][]) {
      const d = v3(x, y, z).normalize();
      const m = add(g, paint(new THREE.SphereGeometry(0.018 * sc, 8, 6, 0, PI * 2, 0, PI / 2), 0xf6a070), M.shell, [PC.x + PR.x * d.x * 0.98, PC.y + PR.y * d.y * 0.98, PC.z + PR.z * d.z * 0.98]);
      m.quaternion.setFromUnitVectors(UP, d);
    }
    const fingerPaint = (p: THREE.Vector3) => (p.z > 0.28 * sc ? col(0x4a2a24) : cOrange.clone().lerp(cCream, 0.35));
    const fixed = segment([v3(0, -0.035, 0.17), v3(0, -0.045, 0.26), v3(0, -0.02, 0.35)].map((p) => p.multiplyScalar(sc)), 0.045 * sc, 0.012 * sc, { tip: 0.1, flat: 0.8 });
    add(g, paint(fixed, fingerPaint), M.shell);
    const dac = group(g, [0, 0.035 * sc, 0.18 * sc]);
    const dg = segment([v3(0, 0, -0.015), v3(0, 0.012, 0.08), v3(0, -0.02, 0.17)].map((p) => p.multiplyScalar(sc)), 0.04 * sc, 0.011 * sc, { tip: 0.1, flat: 0.8 });
    add(dac, paint(dg, (p) => (p.z > 0.1 * sc ? col(0x4a2a24) : cOrange.clone().lerp(cRed, 0.5))), M.shell);
    return { g, dac, tip: group(dac, [0, -0.015 * sc, 0.16 * sc]) };
  };
  const arm = (s: number, pts: THREE.Vector3[], fwd: THREE.Vector3, sc: number, tilt: number) => {
    const pivot = group(body, pts[0].toArray() as [number, number, number]);
    const inner = group(pivot, pts[0].clone().negate().toArray() as [number, number, number]);
    const [S, E, W] = pts;
    add(inner, paint(segment([S.clone().add(v3(-s * 0.02, 0, -0.02)), S.clone().lerp(E, 0.5).add(v3(0, 0.01, 0)), E.clone().addScaledVector(E.clone().sub(S).normalize(), 0.02)], 0.046 * sc + 0.012, 0.04 * sc + 0.01), legPaint), M.shell);
    add(inner, paint(segment([E.clone().addScaledVector(W.clone().sub(E).normalize(), -0.02), E.clone().lerp(W, 0.5), W.clone().addScaledVector(fwd, 0.03 * sc)], 0.042 * sc + 0.01, 0.05 * sc + 0.008), legPaint), M.shell);
    return { pivot, ...buildClaw(inner, W, fwd, sc, tilt) };
  };
  const big = arm(1, [v3(0.16, 0.28, 0.44), v3(0.3, 0.2, 0.55), v3(0.25, 0.22, 0.66)], v3(-0.42, 0.14, 1).normalize(), 0.9, -0.25);
  const small = arm(-1, [v3(-0.16, 0.27, 0.44), v3(-0.28, 0.22, 0.52), v3(-0.25, 0.24, 0.6)], v3(0.12, 0.1, 1).normalize(), 0.55, 0.3);

  // ── Coral on top: a clump of pink branching coral (same outline group, no lines between branches) and a purple sea fan ──
  let coralTop = v3(0, 1, 0);
  {
    const cBase = col(0xf27f78);
    const cTip = col(0xffd9cc);
    const grow = (p: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
      const bend = v3(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(0.25 * len);
      const e = p.clone().addScaledVector(dir, len);
      const mid = p.clone().lerp(e, 0.5).add(bend);
      const g = segment([p.clone().addScaledVector(dir, -r * 0.6), mid, e], r, r * 0.82, { segs: 7, radial: 8, tip: 0.14 });
      add(body, paint(g, (q) => cBase.clone().lerp(cTip, sstep(q.distanceTo(e), r * 2.2, 0) * (depth === 0 ? 1 : 0.35))), M.shell).userData.inkGroup = G_CORAL;
      if (e.y > coralTop.y) coralTop = e.clone();
      if (depth <= 0) return;
      const n = depth === 2 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * PI * 2 + rand() * 1.2;
        const side = v3(Math.cos(a), 0, Math.sin(a));
        const nd = dir.clone().addScaledVector(side, 0.55 + rand() * 0.2).normalize();
        grow(e.clone().addScaledVector(dir, -r * 0.3), nd, len * (0.72 + rand() * 0.12), r * 0.8, depth - 1);
      }
    };
    const dA = v3(0.32, 1, 0.05).normalize();
    grow(surf(dA).addScaledVector(dA, -0.03), v3(0.12, 1, 0.05).normalize(), 0.16, 0.042, 2);
    // Second clump: a low orange-yellow clump growing at the front left, visible from the front too
    cBase.set(0xf29a44);
    cTip.set(0xffe2a6);
    const dC = v3(-0.3, 1, 0.45).normalize();
    grow(surf(dC).addScaledVector(dC, -0.03), v3(-0.2, 1, 0.2).normalize(), 0.11, 0.032, 2);
    // Sea fan: a thick fan-shaped plate with a few radiating ribs on the front and back
    const dB = v3(-0.42, 0.9, -0.35).normalize();
    const fb = surf(dB).addScaledVector(dB, -0.02);
    const fanG = group(body, fb.toArray() as [number, number, number], [0, 0.55, -0.22]);
    const pts: [number, number][] = [[-0.025, 0]];
    for (let i = 0; i <= 16; i++) {
      const a = lerp(PI - 0.35, 0.35, i / 16);
      const r = 0.26 + 0.025 * Math.sin(i * 1.7) - 0.02 * Math.abs(Math.sin((i * PI) / 4));
      pts.push([Math.cos(a) * r * 1.05, Math.sin(a) * r + 0.02]);
    }
    pts.push([0.025, 0]);
    const fan = slab(outline(pts), 0.012, 0.007, 4);
    add(fanG, paint(fan, (p) => col(0x9a6ccc).lerp(col(0xc9a6ec), sstep(Math.hypot(p.x, p.y), 0.1, 0.2))), M.shell);
    for (let i = 0; i < 5; i++) {
      const a = lerp(0.6, PI - 0.6, i / 4);
      const e = v3(Math.cos(a) * 0.25, Math.sin(a) * 0.25 + 0.02, 0);
      for (const z of [-0.012, 0.012])
        add(fanG, paint(segment([v3(0, 0.005, z), e.clone().multiplyScalar(0.5).setZ(z), e.clone().setZ(z)], 0.011, 0.006, { segs: 6, radial: 6 }), 0x6e4a9e), M.shell);
    }
  }

  // ── Cave at the back: a stone arch set into the back of the mound, darkness inside the door, a lantern hanging from the top of the arch and a plank ramp laid to the ground ──
  const dBack = v3(0, -0.12, -1).normalize();
  const QB = surf(dBack);
  const nB = surfN(dBack);
  const archG = group(body, QB.clone().addScaledVector(nB, 0.012).toArray() as [number, number, number]);
  archG.quaternion.copy(basis(nB));
  const YS = 0.02;
  const RIN = 0.12;
  const ROUT = 0.19;
  let lantern: THREE.Group;
  let lanternA: THREE.Group;
  {
    const stoneC = [0xa39c90, 0x958e84, 0xaaa396, 0x9a9388, 0xa6a094];
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * PI + 0.025;
      const a1 = ((k + 1) / 5) * PI - 0.025;
      add(archG, paint(slab(wedge(RIN, ROUT, a0, a1), 0.08, 0.012, 3), stoneC[k]), M.stone, [0, YS, 0]);
    }
    for (const s of [-1, 1]) add(archG, paint(rbox(0.07, 0.15, 0.09, 0.014, 2), 0x9d968a), M.stone, [s * 0.155, YS - 0.075, 0]);
    add(archG, paint(rbox(0.42, 0.045, 0.14, 0.014, 2), 0xb0a89b), M.stone, [0, YS - 0.175, 0.02]);
    const holeS = new THREE.Shape();
    holeS.moveTo(-RIN - 0.005, YS - 0.16);
    holeS.lineTo(RIN + 0.005, YS - 0.16);
    holeS.lineTo(RIN + 0.005, YS);
    holeS.absarc(0, YS, RIN + 0.005, 0, PI, false);
    holeS.lineTo(-RIN - 0.005, YS - 0.16);
    add(archG, paint(new THREE.ShapeGeometry(holeS, 10), 0x1e1618), M.shell, [0, 0, -0.004]);
    // Ramp: laid slantwise from the threshold to the ground, with three cross slats nailed on
    const A = v3(0, YS - 0.2, 0.1);
    const Bg = v3(0, -QB.y + 0.02, 0.34);
    const len = A.distanceTo(Bg);
    const plank = group(archG, A.clone().lerp(Bg, 0.5).toArray() as [number, number, number], [Math.atan2(A.y - Bg.y, Bg.z - A.z), 0, 0]);
    add(plank, paint(rbox(0.13, 0.022, len, 0.008, 1), 0x8c5a38), M.shell);
    for (const f of [-0.3, 0, 0.3]) add(plank, paint(rbox(0.13, 0.016, 0.022, 0.006, 1), 0x6c4228), M.shell, [0, 0.018, f * len]);
    // Lantern: an iron hanging rod, an iron cap and a warm yellow glass body
    lantern = group(archG, [0, YS + RIN - 0.008, 0.03]);
    add(lantern, segment([v3(0, 0.01, 0), v3(0, -0.02, 0), v3(0, -0.045, 0)], 0.008, 0.008, { segs: 4, radial: 6 }), M.iron);
    add(lantern, lathe([[0.001, -0.06], [0.03, -0.06], [0.036, -0.052], [0.022, -0.042], [0.001, -0.04]], 10), M.iron);
    add(lantern, lathe([[0.001, -0.132], [0.026, -0.132], [0.03, -0.124], [0.022, -0.118], [0.001, -0.118]], 10), M.iron);
    add(lantern, lathe([[0.001, -0.122], [0.022, -0.12], [0.029, -0.1], [0.029, -0.075], [0.022, -0.058], [0.001, -0.055]], 10), M.glass);
    lanternA = group(lantern, [0, -0.09, 0]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: everything is computed from t (frozen time gives the same pose) ──
  const act = { guard: 0, glow: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 1.5);
    body.scale.set(1 + br * 0.004, 1 - br * 0.005, 1 + br * 0.004);
    // A crab has no eyelids: it does not blink, and instead both eyestalks draw back together every 4.3 seconds; looking around is both eyestalks slowly turning together
    const bt = t % 4.3;
    const tuck = bt > 3.9 && bt < 4.25 ? Math.sin(((bt - 3.9) / 0.35) * PI) : 0;
    const look = Math.sin(t * 0.37) * 0.14;
    for (const st of stalks) st.g.rotation.set(Math.sin(t * 0.8 + st.s) * 0.04 - act.guard * 0.1 - tuck * 0.22, look, st.s * 0.05 * Math.sin(t * 0.6 + st.s * 1.3));
    // The big claw pinches twice every 5.5 seconds
    const ct = t % 5.5;
    const clk = ct > 4.4 && ct < 5.2 ? Math.abs(Math.sin(((ct - 4.4) / 0.8) * PI * 2)) : 0;
    big.dac.rotation.x = -0.14 - clk * 0.28 + act.guard * 0.1;
    small.dac.rotation.x = -0.1 + Math.sin(t * 0.9) * 0.05;
    big.pivot.rotation.set(Math.sin(t * 0.7) * 0.02 - act.guard * 0.45, act.guard * 0.25, 0);
    small.pivot.rotation.set(Math.sin(t * 0.7 + 1) * 0.03, 0, 0);
    lantern.rotation.set(Math.sin(t * 0.9) * 0.05, 0, Math.sin(t * 1.2) * 0.12);
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.glass.emissiveIntensity = 0.85 + gl * 0.35;
    }
  };
  update(0);

  const head = group(body, [0, 0.6, K.z + KR.z * 0.9]);
  const mouth = group(body, mouthC.toArray() as [number, number, number]);
  const coral = group(body, coralTop.toArray() as [number, number, number]);
  const rig = { head, eyes: eyeAnchors, anchors: { mouth, claw: big.tip, coral, cave: lanternA } };
  mergeStatic(root, {
    owners: [body, big.pivot, small.pivot, big.dac, small.dac, lantern, ...stalks.map((s) => s.g)],
    keep: [],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.5, 0), radius: 0.9 };
}
