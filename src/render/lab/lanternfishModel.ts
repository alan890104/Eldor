// Abyss Lantern (model lab version, N, water + light): a deep-sea anglerfish whose little lamp lights the way for ships that have lost their course; the first lamp of the lighthouse was fire borrowed from the Lantern Mother.
// Identifying features: 1. A curved fishing rod growing from the forehead, with a warm yellow lantern in a brass shade hanging from its end (the only light on the whole body).
// 2. A round, plump anglerfish body: a big head and a big mouth across the whole face, the lower jaw jutting forward (an underbite), a row of long thin sharp teeth curving into the mouth, and a few more pointing down from the upper jaw.
// 3. A deep indigo back fading to a pale cyan belly, pectoral fins like two little fans, a dorsal fin of three soft spines, and a round two-lobed tail fin.
// Body shape: an anglerfish floating in the water, the head bigger than the body. Personality: a gentle deep-sea lantern mother who guides lost ships with her lamp, unhurried; the gentleness comes from slow floating and the flicker of the lamp, not from a human-face smile.
// The face follows a real anglerfish: small eyes on the sides of the head above the mouth corners, almost entirely black (a deep indigo eye base with a black pupil) with only one small highlight, no eyelids and no blinking; the mouth is a big mouth with a jutting lower jaw, not human smiling lips.
// Gaze: the lantern on the head → the big mouth and sharp teeth, the eyes on the sides of the head → the pectoral and tail fins.
// Actions: idle floats up and down, with the pectoral fins fanning lightly, the tail fin swaying slowly, the rod and lantern swinging gently like a pendulum, and the pupils of both eyes turning slowly together; charge-up brightens the lantern (act.glow); hit pulls the whole fish back with the lamp staying lit; victory circles the lantern once.
// Anchors: rig.head (face center), rig.eyes, anchors.mouth (exact middle of the mouth line), anchors.lure (lantern center), anchors.tail (tail fin). act: glow.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, outline, partKit, PI, slab, type LabModel } from './shapes.ts';
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

/** A planar shape on a sphere (iris, pupil): projected onto a sphere of radius r, subdivided levels times */
function lightDecal(pts: [number, number][], r: number, lat0 = 0, levels = 2): THREE.BufferGeometry {
  const flat = new THREE.ShapeGeometry(outline(pts), 1).toNonIndexed();
  const src = flat.attributes.position as THREE.BufferAttribute;
  let tris: [number, number][][] = [];
  for (let i = 0; i < src.count; i += 3) tris.push([0, 1, 2].map((k) => [src.getX(i + k), src.getY(i + k)] as [number, number]));
  for (let l = 0; l < levels; l++) {
    const next: [number, number][][] = [];
    for (const [a, b, c] of tris) {
      const m = (u: [number, number], w: [number, number]): [number, number] => [(u[0] + w[0]) / 2, (u[1] + w[1]) / 2];
      const ab = m(a, b);
      const bc = m(b, c);
      const ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }
  const pos: number[] = [];
  const nor: number[] = [];
  for (const t of tris)
    for (const [lon, dl] of t) {
      const lat = lat0 + dl;
      const x = Math.cos(lat) * Math.sin(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon);
      pos.push(x * r, y * r, z * r);
      nor.push(x, y, z);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
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

export function buildLanternfishLab(): LabModel {
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    skin: vc(labToon(0xffffff, { rim: 0.65, rimColor: 0xffd49a, spec: 0.25, specTh: 0.99 })),
    brass: labToon(0xd9a441, { ramp: 'metal', rim: 0.4, rimColor: 0xffe2a0, spec: 0.8, specTh: 0.96 }),
    glass: labToon(0xffeab0, { ramp: 'gem', rim: 0, emissive: 0xffb43c, emissiveAmt: 0.95 }),
    eye: labToon(0x1a2233, { ramp: 'gem', rim: 0, spec: 0.5, specTh: 0.97 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'lanternfish-lab';
  const { add, group } = partKit();
  const float = group(root);
  const body = group(float);
  const G_BODY = 9701;

  // ── Body: an elliptical cross-section along the z axis, with a wide blunt big head at the front tapering back to the tail peduncle ──
  // The face is made a dome rather than a flat plane: a flat face's normals fall right on the light/shadow threshold, which would cut a dark V into the front (pitfall 40)
  const ZF = 0.38;
  const ZB = -0.5;
  const tab = curveTable([
    // The end radii are given as 0 (not 0.001): the poles close to a single point, so wrapGrid averages the normals of that row and the middle of the face does not turn out a pinwheel-shaped dark V
    [0, 0, 0, 0.045],
    [0.025, 0.1, 0.09, 0.043],
    [0.06, 0.19, 0.16, 0.035],
    [0.11, 0.26, 0.22, 0.025],
    [0.18, 0.31, 0.265, 0.015],
    [0.3, 0.335, 0.285, 0.005],
    [0.46, 0.31, 0.28, 0.005],
    [0.64, 0.23, 0.22, 0.02],
    [0.82, 0.12, 0.13, 0.045],
    [0.95, 0.06, 0.075, 0.055],
    [1, 0, 0, 0.06],
  ]);
  const YC = 0.56;
  const bodyPt = (t: number, ph: number) => {
    const [a, b, dy] = tab(t);
    return v3(a * Math.cos(ph), YC + dy + b * Math.sin(ph), lerp(ZF, ZB, t));
  };
  const bodyN = (t: number, ph: number) => {
    const e = 0.003;
    const dT = bodyPt(Math.min(1, t + e), ph).sub(bodyPt(Math.max(0, t - e), ph));
    const dP = bodyPt(t, ph + e).sub(bodyPt(t, ph - e));
    const n = dP.cross(dT).normalize();
    const p = bodyPt(t, ph);
    const c = v3(0, YC + tab(t)[2], p.z);
    return n.dot(p.sub(c)) < 0 ? n.negate() : n;
  };
  const cTop = col(0x27325e);
  const cSide = col(0x3c6592);
  const cBelly = col(0xa5c9da);
  const skinCol = (y: number) => {
    const s = THREE.MathUtils.clamp((y - YC - 0.02) / 0.27, -1, 1);
    return cSide.clone().lerp(cTop, sstep(s, 0.15, 0.8)).lerp(cBelly, sstep(-s, 0.1, 0.65));
  };
  const glints: THREE.Object3D[] = [];
  {
    const ROWS = 34;
    const COLS = 44;
    const geo = wrapGrid(ROWS, COLS, (i, j) => {
      const t = Math.pow(i / (ROWS - 1), 1.35);
      const ph = (j / COLS) * PI * 2;
      const p = bodyPt(t, ph);
      // Color depends on world height (not on the angle around the axis): the front of the face is a pole of the loft, where the angle goes through a full turn on a very small circle and the color boundary would become jagged
      return { p, c: skinCol(p.y) };
    }, v3(0, YC, -0.05));
    add(body, geo, M.skin).userData.inkGroup = G_BODY;
  }

  // ── Mouth: the anglerfish's big mouth runs across the whole face, with the corners tapering back and down; the lower jaw juts forward (an underbite), and the mouth line shows a dark mouth cavity ──
  // A point at the given front (x, y) on the face: shot from inside the body along +z to the surface (not outward from the center of the head, which would shrink the eye spacing and mouth width)
  const facePt = (x: number, y: number) => {
    const inside = (t: number) => {
      const [a, b, dy] = tab(t);
      return a > 1e-4 && (x / a) ** 2 + ((y - YC - dy) / b) ** 2 <= 1;
    };
    let lo = 0;
    let hi = 0.3;
    for (let k = 0; k < 28; k++) {
      const m = (lo + hi) / 2;
      if (inside(m)) hi = m;
      else lo = m;
    }
    const [a, b, dy] = tab(hi);
    const ph = Math.atan2((y - YC - dy) / b, x / a);
    return { p: bodyPt(hi, ph), n: bodyN(hi, ph) };
  };
  const MW = 0.29;
  const mouthY = (u: number) => 0.535 - 0.06 * u * u;
  const jawOut = (u: number) => 0.012 + 0.036 * Math.sqrt(Math.max(0, 1 - u * u));
  const jawR = (u: number) => 0.02 + 0.02 * Math.pow(1 - Math.abs(u), 0.8);
  const jawC = (u: number) => {
    const { p, n } = facePt(u * MW, mouthY(u) - 0.03);
    return p.addScaledVector(n, jawOut(u));
  };
  const endCap = (t: number, w = 0.07) => Math.sqrt(Math.max(0, 1 - Math.max(0, (w - Math.min(t, 1 - t)) / w) ** 2));
  const mouthC = facePt(0, mouthY(0) - 0.004).p.add(v3(0, 0, 0.02));
  {
    const N = 14;
    // Mouth cavity: a dark band in the mouth line, half buried in the face
    const gap: THREE.Vector3[] = [];
    for (let k = 0; k <= N; k++) {
      const u = -1.02 + (2.04 * k) / N;
      const { p, n } = facePt(u * MW * 0.99, mouthY(u) - 0.008);
      gap.push(p.addScaledVector(n, 0.002));
    }
    add(body, paint(loft(gap, (t) => {
      const e = endCap(t, 0.1);
      return [0.014 * e, (0.012 + 0.012 * Math.sin(t * PI)) * e];
    }, { segs: 28, radial: 8 }), 0x1c1936), M.skin);
    // Lower jaw: thickest at the front edge and jutting forward, thinning toward the mouth corners on both sides and tucking into the face
    const jaw: THREE.Vector3[] = [];
    for (let k = 0; k <= N; k++) jaw.push(jawC(-1 + (2 * k) / N));
    add(body, paint(loft(jaw, (t) => {
      const r = jawR(2 * t - 1) * endCap(t);
      return [r * 1.05, r * 0.85];
    }, { segs: 30, radial: 10 }), (p) => col(0x6f97b8).lerp(col(0x9ec2d6), sstep(0.5 - p.y, -0.02, 0.07))), M.skin);
    // Teeth: long thin sharp teeth curving into the mouth, a row pointing up on the lower jaw and a few pointing down from the upper jaw, of uneven length
    const fang = (base: THREE.Vector3, dir: THREE.Vector3, back: THREE.Vector3, len: number, r: number) =>
      segment([
        base.clone().addScaledVector(dir, -r),
        base.clone().addScaledVector(dir, len * 0.5).addScaledVector(back, len * 0.06),
        base.clone().addScaledVector(dir, len).addScaledVector(back, len * 0.3),
      ], r, r * 0.2, { segs: 7, radial: 6, tip: 0.18 });
    for (const [u, len] of [[-0.74, 0.042], [-0.46, 0.066], [-0.16, 0.054], [0.14, 0.058], [0.45, 0.07], [0.76, 0.04]] as [number, number][]) {
      const { n } = facePt(u * MW, mouthY(u) - 0.03);
      const base = jawC(u).addScaledVector(UP, jawR(u) * 0.6).addScaledVector(n, -jawR(u) * 0.25);
      add(body, paint(fang(base, UP.clone().addScaledVector(n, 0.12).normalize(), n.clone().negate(), len, 0.0095), 0xf1ede0), M.skin);
    }
    for (const [u, len] of [[-0.6, 0.036], [-0.3, 0.03], [0.3, 0.033], [0.6, 0.034]] as [number, number][]) {
      const { p, n } = facePt(u * MW, mouthY(u) + 0.01);
      add(body, paint(fang(p.addScaledVector(n, 0.004), v3(0, -1, 0), n.clone().negate(), len, 0.0078), 0xf1ede0), M.skin);
    }
  }

  // ── Eyes: the anglerfish's small eyes sit on the sides of the head above the mouth corners, facing outward and slightly forward, sunk in a ring of fleshy socket; almost entirely black with one small highlight (no doll eyes with concentric irises and two big highlights);
  //    a fish has no eyelids and does not blink ──
  const ER = 0.046;
  const gazes: { g: THREE.Group; s: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const eyeball = new THREE.SphereGeometry(ER, 18, 10, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const s of [-1, 1]) {
    const t = 0.15;
    const ph = PI / 2 - s * 1.02;
    const n = bodyN(t, ph);
    const p = bodyPt(t, ph);
    const c = p.clone().addScaledVector(n, -ER * 0.4);
    const eg = group(body, c.toArray() as [number, number, number]);
    eg.quaternion.copy(basis(n.clone().add(v3(0, -0.05, 0.2)).normalize()));
    add(eg, eyeball, M.eye);
    // Eye socket: a ring of flesh in the same color family, covering the boundary between the eyeball and the skin
    add(eg, paint(new THREE.TorusGeometry(ER * 0.93, 0.011, 8, 22), skinCol(p.y).lerp(col(0x7ea4c8), 0.18)), M.skin, [0, 0, ER * 0.38]).userData.inkGroup = G_BODY;
    const gaze = group(eg);
    gazes.push({ g: gaze, s });
    add(gaze, paint(lightDecal(ellipsePts(0.56, 0.58, 0, 20), ER + 0.0016, 0, 2), 0x04050a), M.iris);
    // The highlight is fixed on the eye (it does not turn with the pupil), and both eyes point up and forward, so they look like the same light; only one small dot (less than a tenth of the eye in area)
    for (const [d, rr] of [[v3(-s * 0.36, 0.46, 0.81), 0.0075]] as [THREE.Vector3, number][]) {
      const hl = add(eg, new THREE.SphereGeometry(rr, 8, 6), M.hi, d.normalize().multiplyScalar(ER * 1.01).toArray() as [number, number, number], [0, 0, 0], [1, 1, 0.5]);
      hl.quaternion.setFromUnitVectors(v3(0, 0, 1), d);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(eg, [0, 0, ER]));
  }

  // ── Dorsal fin: a membrane held up by three soft spines, lying along the spine ──
  {
    const fin = group(body, [0, 0, 0], [0, -PI / 2, 0]);
    const pts: [number, number][] = [];
    const tA = 0.36;
    const tB = 0.74;
    for (let k = 0; k <= 10; k++) {
      const t = lerp(tA, tB, k / 10);
      const p = bodyPt(t, PI / 2);
      pts.push([p.z, p.y - 0.03]);
    }
    const top: [number, number][] = [];
    for (let k = 10; k >= 0; k--) {
      const t = lerp(tA, tB, k / 10);
      const p = bodyPt(t, PI / 2);
      const w = k / 10;
      const h = 0.03 + 0.12 * Math.pow(Math.sin(w * PI), 0.8) * (1 - 0.25 * w) + 0.035 * Math.max(0, Math.cos(w * PI * 3 * 2)) * Math.sin(w * PI);
      top.push([p.z + 0.02, p.y + h]);
    }
    const shape = outline([...pts, ...top]);
    add(fin, paint(slab(shape, 0.012, 0.006, 6), (p) => col(0x2c3d70).lerp(col(0x6b93c0), sstep(p.y, 0.87, 0.97))), M.skin);
  }

  // ── Pectoral fins: two little fans; tail fin: a round two-lobed shape ──
  const fanShape = (r: number, a0: number, a1: number, n: number) => {
    const pts: [number, number][] = [[0, -0.02], [0, 0.02]];
    for (let i = 0; i <= 16; i++) {
      const a = lerp(a1, a0, i / 16);
      const rr = r * (1 - 0.1 * Math.abs(Math.sin((i / 16) * PI * n)));
      pts.splice(2 + i, 0, [Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return outline(pts);
  };
  const pects: { g: THREE.Group; s: number }[] = [];
  for (const s of [-1, 1]) {
    const t = 0.36;
    const ph = s > 0 ? -0.2 : PI + 0.2;
    const p = bodyPt(t, ph);
    const g = group(body, p.toArray() as [number, number, number], [0, s * 0.55, s * -0.35]);
    pects.push({ g, s });
    const geo = slab(fanShape(0.17, -0.9, 0.9, 3), 0.012, 0.006, 6);
    if (s < 0) geo.rotateY(PI);
    add(g, paint(geo, (q) => col(0x3a5e8e).lerp(col(0x9cc4de), sstep(Math.hypot(q.x, q.y), 0.06, 0.16))), M.skin);
  }
  const tail = group(body, bodyPt(0.97, 0).setX(0).toArray() as [number, number, number]);
  let tailTip: THREE.Group;
  {
    const fin = group(tail, [0, 0, 0], [0, -PI / 2, 0]);
    const pts: [number, number][] = [[0.02, -0.03]];
    for (let i = 0; i <= 20; i++) {
      const a = lerp(-1.05, 1.05, i / 20);
      const r = 0.2 * (1 - 0.28 * Math.exp(-((a / 0.28) ** 2)));
      pts.push([-Math.cos(a) * r, Math.sin(a) * r * 1.05]);
    }
    pts.push([0.02, 0.03]);
    add(fin, paint(slab(outline(pts), 0.014, 0.007, 6), (q) => col(0x2c3d70).lerp(col(0x7aa2cc), sstep(Math.hypot(q.x, q.y), 0.08, 0.2))), M.skin);
    tailTip = group(tail, [0, 0, -0.18]);
  }

  // ── Rod and lantern: arching up from the forehead and then hanging forward, with a warm yellow lantern in a brass shade at the end ──
  const rodBase = bodyPt(0.2, PI / 2).add(v3(0, -0.02, 0));
  const rod = group(body, rodBase.toArray() as [number, number, number]);
  const lamp = group(rod, [0, 0.225, 0.41]);
  lamp.scale.setScalar(1.35);
  let lureA: THREE.Group;
  {
    const pts = [v3(0, 0, 0), v3(0, 0.2, 0.0), v3(0, 0.34, 0.12), v3(0, 0.35, 0.3), v3(0, 0.28, 0.4), v3(0, 0.245, 0.41)];
    add(rod, paint(loft(pts, (t) => {
      const r = lerp(0.03, 0.015, t);
      const e = t > 0.96 ? Math.sqrt(Math.max(0, 1 - ((t - 0.96) / 0.04) ** 2)) : 1;
      return [r * e, r * e];
    }, { segs: 26, radial: 8 }), (p) => col(0x2a3868).lerp(col(0x6e8fbe), sstep(p.y, 0.14, 0.32))), M.skin);
    // Lamp: a hanging ring, a domed shade, a glass bulb, three struts and a base
    add(lamp, new THREE.TorusGeometry(0.014, 0.0055, 6, 12), M.brass, [0, 0.0, 0], [0, PI / 2, 0]);
    add(lamp, lathe([[0.001, -0.042], [0.05, -0.042], [0.056, -0.036], [0.04, -0.022], [0.016, -0.012], [0.001, -0.01]], 12), M.brass);
    add(lamp, new THREE.SphereGeometry(0.045, 16, 12), M.glass, [0, -0.088, 0]);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * PI * 2 + PI / 6;
      const cx = Math.sin(a);
      const cz = Math.cos(a);
      add(lamp, segment([v3(cx * 0.044, -0.04, cz * 0.044), v3(cx * 0.05, -0.088, cz * 0.05), v3(cx * 0.036, -0.134, cz * 0.036)], 0.0065, 0.0065, { segs: 8, radial: 6, tip: 0.1 }), M.brass);
    }
    add(lamp, lathe([[0.001, -0.152], [0.012, -0.15], [0.034, -0.14], [0.034, -0.132], [0.001, -0.13]], 12), M.brass);
    lureA = group(lamp, [0, -0.088, 0]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: everything is computed from t ──
  const act = { glow: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    float.position.y = Math.sin(t * 1.1) * 0.03;
    float.rotation.x = Math.sin(t * 1.1 - 0.8) * 0.03;
    body.rotation.y = Math.sin(t * 0.4) * 0.06;
    tail.rotation.y = Math.sin(t * 1.6) * 0.22;
    for (const f of pects) f.g.rotation.set(Math.sin(t * 2.2 + f.s) * 0.12, f.s * 0.55 + Math.sin(t * 2.2) * 0.1 * f.s, f.s * -0.35);
    rod.rotation.set(Math.sin(t * 1.1 - 1.4) * 0.05, 0, Math.sin(t * 0.7) * 0.05);
    lamp.rotation.set(Math.sin(t * 1.1 - 2.2) * 0.12, 0, Math.sin(t * 0.9 + 0.5) * 0.14);
    // The pupils of both eyes turn together forward, backward, up and down (left-right symmetric), looking in the same direction; a fish has no eyelids and does not blink
    for (const g of gazes) {
      g.g.rotation.y = -g.s * (0.26 + Math.sin(t * 0.37) * 0.08);
      g.g.rotation.x = -0.04 + Math.sin(t * 0.5 + 1) * 0.05;
    }
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.glass.emissiveIntensity = 0.95 + gl * 0.4;
    }
  };
  update(0);

  const head = group(body, bodyPt(0.02, PI / 2 - 0.4).toArray() as [number, number, number]);
  const mouth = group(body, mouthC.toArray() as [number, number, number]);
  const rig = { head, eyes: eyeAnchors, anchors: { mouth, lure: lureA!, tail: tailTip! } };
  mergeStatic(root, {
    owners: [float, body, tail, rod, lamp, ...pects.map((f) => f.g), ...gazes.map((g) => g.g)],
    keep: [...glints],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.62, -0.02), radius: 0.8 };
}
