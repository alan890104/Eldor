// Icecrown Emperor (model lab version, N, water): emperor penguins that live in flocks on the ice field; the ice crown on their heads never melts and is said to have condensed from a shard of source crystal a thousand years ago.
// Identifying features: 1. A crown of faceted ice crystals around the top of the head, tallest at the very front, with a faintly glowing cyan source crystal shard set in the front of the crown.
// 2. The emperor penguin's coloring: black head, deep blue-gray back, white belly, golden-yellow ear patches on both sides of the neck fading to cream yellow toward the chest; an orange-pink stripe on the lower beak.
// 3. Back: a row of icicles hangs from the rear edge of the ice crown against the back of the neck, like a frozen cape.
// Body shape: a plump penguin standing chest out, beak tilted slightly up, with the two flippers slightly spread. Personality: a deadpan little emperor who patrols the ice field chest out and head high, and is actually a bit of a show-off.
// The eyes follow a real penguin: small dark bead eyes on both sides of the black head (diameter about 15% of the head width, dark brown nearly black, with one small highlight), no sclera, no brows; the show-off attitude is expressed by the chest-out, beak-up pose, not by expression.
// Gaze: face (dark bead eyes with highlights on the black head, orange beak stripe) → ice crown and source crystal → golden-yellow ear patches and white belly.
// Actions: idle is chest-out breathing, light flipper flaps, blinking and looking left and right; charge-up makes the ice crown glow (act.glow) and the chest swell (act.puff); hit lifts the beak even higher with the feet not retreating; victory spreads both flippers with the chest out.
// Anchors: rig.head (face center), rig.eyes, anchors.mouth (beak root), anchors.beak (beak tip), anchors.crown (top of the crown), anchors.core (source crystal). act: glow, puff.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, lathe, loft, mergeStatic, outline, partKit, PI, type LabModel } from './shapes.ts';
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

/** Eyelid shell: with +y as the top, covering down to lip radians, with a rounded lip at the edge; only builds the front (+z) or the back arc */
function lidLite(ri: number, ro: number, lip: number, front: boolean, arc = PI * 1.15, segs = 12): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const N = 5;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), ri * Math.cos(a)));
  }
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 4; i++) {
    const b = (i / 4) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = N; i >= 0; i--) {
    const a = (i / N) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  const g = new THREE.LatheGeometry(prof, segs, (front ? 0 : PI) - arc / 2, arc);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
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

/** Flat facets: split into triangles that share no vertices, so the ice crystal is separated face by face */
function facet(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const f = g.index ? g.toNonIndexed() : g;
  f.deleteAttribute('uv');
  f.computeVertexNormals();
  return f;
}

// ───────────────────────── Shape ─────────────────────────

export function buildIcecrownLab(): LabModel {
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    feather: vc(labToon(0xffffff, { rim: 0.6, rimColor: 0xcfeaff })),
    ice: labToon(0xd6f1ff, { ramp: 'gem', rim: 0.7, rimColor: 0xffffff, spec: 0.55, specTh: 0.975, emissive: 0x5aaede, emissiveAmt: 0.14 }),
    core: labToon(0x7af2ff, { ramp: 'gem', rim: 0, spec: 0.6, specTh: 0.97, emissive: 0x22c4f0, emissiveAmt: 0.55 }),
    eye: labToon(0x1a110c, { ramp: 'gem', rim: 0.45, rimColor: 0x9fb8d8, spec: 0.9, specTh: 0.97 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'icecrown-lab';
  const { add, group } = partKit();
  const body = group(root);
  const G_BODY = 9601;
  const G_CROWN = 9602;

  // ── Body: head and body joined into one pear shape, horizontal cross-section; the belly at the front bulges out a bit more ──
  const table = curveTable([
    [0.03, 0.001, 0.001, 0],
    [0.05, 0.17, 0.16, 0.02],
    [0.1, 0.26, 0.25, 0.03],
    [0.22, 0.315, 0.305, 0.04],
    [0.36, 0.33, 0.325, 0.045],
    [0.5, 0.3, 0.3, 0.04],
    [0.62, 0.24, 0.245, 0.03],
    [0.72, 0.195, 0.205, 0.02],
    [0.8, 0.188, 0.195, 0.015],
    [0.88, 0.178, 0.182, 0.01],
    [0.95, 0.145, 0.148, 0.005],
    [1.0, 0.09, 0.09, 0],
    [1.03, 0.001, 0.001, 0],
  ]);
  const Y0 = 0.03;
  const Y1 = 1.03;
  const bodyPt = (y: number, th: number) => {
    const [a, b, dz] = table(y);
    const bulge = 1 + 0.07 * Math.max(0, Math.cos(th)) * sstep(0.62 - y, 0, 0.2);
    return v3(a * Math.sin(th), y, dz + b * Math.cos(th) * bulge);
  };
  const bodyN = (y: number, th: number) => {
    const e = 0.004;
    const a = bodyPt(y + e, th).sub(bodyPt(y - e, th));
    const b = bodyPt(y, th + e).sub(bodyPt(y, th - e));
    return b.cross(a).normalize();
  };
  const cBlack = col(0x1b1f29);
  const cBack = col(0x353d4e);
  const cWhite = col(0xf7f5ef);
  const cGold = col(0xf6ae34);
  const cCream = col(0xfbe6a4);
  {
    // Rows are placed at the color boundaries and on the head: the head's black boundary at y 0.72
    const ys: number[] = [];
    for (let i = 0; i <= 12; i++) ys.push(lerp(Y0, 0.66, Math.pow(i / 12, 0.8)));
    for (let i = 1; i <= 22; i++) ys.push(lerp(0.66, Y1, i / 22));
    const COLS = 48;
    const geo = wrapGrid(ys.length, COLS, (i, j) => {
      const y = ys[i];
      const th = (j / COLS) * PI * 2;
      const p = bodyPt(y, th);
      const c = cBack.clone().lerp(cBlack, sstep(y, 0.62, 0.72));
      return { p, c };
    }, v3(0, 0.5, 0.03));
    add(body, geo, M.feather).userData.inkGroup = G_BODY;
  }

  // White belly and ear patches: a sheet that hugs the body (floating out 0.003, same outline group), edges sampled to the shape so the color boundary is not jagged.
  // White on the lower half and cream yellow on the upper chest, with both sides turning up into golden-yellow ear patches
  {
    const wOf = curveTable([[0.06, 1.2], [0.3, 1.32], [0.5, 1.25], [0.63, 0.98], [0.72, 1.3], [0.78, 1.5], [0.815, 1.5]]);
    const NR = 30;
    const NC = 40;
    const pos: number[] = [];
    const clr: number[] = [];
    for (let i = 0; i <= NR; i++)
      for (let k = 0; k <= NC; k++) {
        const u = -1 + (2 * k) / NC;
        const au = Math.abs(u);
        const yTop = 0.815 - 0.07 * au ** 3 - 0.03 * sstep(au, 0.55, 0.7) * (1 - au);
        const y = lerp(0.06, yTop, i / NR);
        const th = u * wOf(y)[0];
        const p = bodyPt(y, th).addScaledVector(bodyN(y, th), 0.003);
        pos.push(p.x, p.y, p.z);
        const c = cWhite.clone().lerp(cCream, sstep(y, 0.5, 0.66) * (1 - sstep(au, 0.5, 0.7)));
        c.lerp(cGold, sstep(y, 0.6, 0.68) * sstep(au, 0.58, 0.66));
        clr.push(c.r, c.g, c.b);
      }
    const idx: number[] = [];
    for (let i = 0; i < NR; i++)
      for (let k = 0; k < NC; k++) {
        const a = i * (NC + 1) + k;
        const b = a + NC + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // The normal must point outward (the middle point at the front points toward +z)
    const mid = (NR / 2) * (NC + 1) + NC / 2;
    if ((g.attributes.normal as THREE.BufferAttribute).getZ(mid) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    add(body, g, M.feather).userData.inkGroup = G_BODY;
  }

  // ── Beak: black upper beak, an orange-pink stripe at the root of the lower beak; tilted slightly up (show-off) ──
  {
    const up = loft([v3(0, 0.852, 0.14), v3(0, 0.846, 0.26), v3(0, 0.822, 0.365)], (t) => {
      const k = Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.85) / 0.15) ** 2));
      return [lerp(0.046, 0.012, t) * k, lerp(0.03, 0.009, t) * k, 0];
    }, { segs: 10, radial: 10 });
    add(body, paint(up, (p) => col(0x2a2d36).lerp(col(0x474c58), sstep(p.y - (0.852 - (p.z - 0.14) * 0.13), 0.012, 0.024))), M.feather);
    const lo = loft([v3(0, 0.82, 0.14), v3(0, 0.814, 0.25), v3(0, 0.8, 0.34)], (t) => {
      const k = Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.85) / 0.15) ** 2));
      return [lerp(0.038, 0.009, t) * k, lerp(0.021, 0.007, t) * k, 0];
    }, { segs: 10, radial: 8 });
    add(body, paint(lo, (p) => (p.z < 0.3 ? col(0xf4884e) : col(0x2a2d36))), M.feather);
  }

  // ── Eyes: a penguin's small dark bead eyes (diameter about 15% of the head width, no doll eyes), on both sides of the black head; the whole eye is dark brown nearly black, with the pupil only slightly darker than the iris,
  //    one small highlight (both eyes on the same side), no sclera;
  //    the upper eyelid usually rests up top (birds blink), is the head's black and is not made into a brow; no lower eyelid (it would look like an eye bag), and the eye is a full circle ──
  const ER = 0.027;
  const UP_OPEN = -1.05;
  // Half of the eyeball is buried in the head, and the exposed spherical cap spans about 1.05 radians up and down; when blinking, the upper eyelid closes all the way down
  const UP_SHUT = 1.1;
  const lids: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = paint(lidLite(ER + 0.003, ER + 0.011, PI / 2, true), 0x1b1f29);
  const eyeball = new THREE.SphereGeometry(ER, 16, 10, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const s of [-1, 1]) {
    const th = s * 0.6;
    const y = 0.878;
    const n = bodyN(y, th);
    const c = bodyPt(y, th).addScaledVector(n, -ER * 0.5);
    const q = basis(n.clone().add(v3(0, 0.08, 0)));
    const eg = group(body, c.toArray() as [number, number, number]);
    eg.quaternion.copy(q);
    add(eg, eyeball, M.eye);
    add(eg, paint(lightDecal(ellipsePts(0.42, 0.44, 0, 16), ER + 0.0008, 0, 1), 0x0a0707), M.iris);
    for (const [x, yy, rr] of [[-0.3, 0.34, 0.0045]] as [number, number, number][]) {
      const p = v3(x, yy, Math.sqrt(1 - x * x - yy * yy)).multiplyScalar(ER * 0.99);
      const hl = add(eg, new THREE.SphereGeometry(rr, 8, 6), M.hi, [p.x, p.y, p.z], [0, 0, 0], [1, 1, 0.5]);
      hl.quaternion.setFromUnitVectors(v3(0, 0, 1), p.clone().normalize());
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    const upper = group(eg, [0, 0, 0], [UP_OPEN, 0, 0]);
    add(upper, lidUp, M.feather);
    lids.push(upper);
    eyeAnchors.push(group(eg, [0, 0, ER]));
  }

  // ── Flippers: flat paddles, dark on the outside and white on the inside, slightly spread ──
  const flippers: { g: THREE.Group; s: number }[] = [];
  for (const s of [-1, 1]) {
    const g = group(body, [s * 0.225, 0.63, -0.03], [0, 0, s * 0.28]);
    flippers.push({ g, s });
    const geo = loft([v3(0, 0.03, 0), v3(s * 0.05, -0.14, 0.02), v3(s * 0.07, -0.3, 0.04), v3(s * 0.065, -0.38, 0.045)], (t) => {
      const w = 0.075 * Math.sin(Math.min(1, 0.25 + t * 1.2) * PI * 0.5) * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - 0.8) / 0.2) ** 2));
      return [w, Math.max(0.004, 0.022 * (1 - t * 0.6)) * Math.min(1, w / 0.02)];
    }, { segs: 14, radial: 12, side: v3(0, 0, 1) });
    add(g, paint(geo, (p, nn) => (nn.x * s < -0.3 ? cWhite.clone() : cBack.clone().lerp(cBlack, sstep(p.y, -0.1, 0.02)))), M.feather);
  }

  // ── Feet and tail ──
  for (const s of [-1, 1]) {
    const f = group(body, [s * 0.12, 0.02, 0.18], [0, s * 0.22, 0]);
    add(f, paint(new THREE.SphereGeometry(1, 12, 8), 0x2c2b33), M.feather, [0, 0, 0], [0, 0, 0], [0.07, 0.024, 0.09]);
    for (const k of [-1, 0, 1]) add(f, paint(segment([v3(k * 0.03, 0.005, 0.03), v3(k * 0.045, 0.005, 0.08), v3(k * 0.055, 0.0, 0.12)], 0.02, 0.012, { segs: 6, radial: 6, flat: 0.7 }), 0x2c2b33), M.feather);
  }
  add(body, paint(loft([v3(0, 0.15, -0.26), v3(0, 0.1, -0.33), v3(0, 0.05, -0.39)], (t) => [lerp(0.07, 0.02, t) * Math.min(1, (1 - t) / 0.15 + 0.2), lerp(0.025, 0.01, t), 0], { segs: 8, radial: 8 }), 0x262c38), M.feather);

  // ── Ice crown: a faceted ice ring, seven ice crystals (tallest at the very front), the source crystal shard at the front of the crown, and icicles hanging from the rear edge ──
  const crown = group(body, [0, 0.935, 0.01], [-0.16, 0, 0]);
  let crownTop: THREE.Group;
  let coreA: THREE.Group;
  {
    add(crown, facet(lathe([[0.135, 0], [0.168, 0], [0.174, 0.032], [0.16, 0.052], [0.135, 0.048], [0.135, 0]], 10)), M.ice).userData.inkGroup = G_CROWN;
    const hs = [0.22, 0.15, 0.115, 0.095, 0.095, 0.115, 0.15];
    for (let k = 0; k < 7; k++) {
      const phi = (k / 7) * PI * 2;
      const h = hs[k];
      const r = k === 0 ? 0.032 : 0.026;
      const g1 = group(crown, [0, 0, 0], [0, phi, 0]);
      const g2 = group(g1, [0, 0.04, 0.152], [0.2, 0, 0]);
      add(g2, facet(lathe([[0.001, -0.02], [r, -0.02], [r * 1.05, h * 0.6], [0.001, h]], 6)), M.ice).userData.inkGroup = G_CROWN;
      if (k === 0) crownTop = group(g2, [0, h, 0]);
    }
    const coreG = group(crown, [0, 0.03, 0.172], [PI / 2 - 0.1, 0, 0]);
    add(coreG, brilliant(0.034, 0.024, 0.032, 8), M.core);
    coreA = group(coreG, [0, 0.03, 0]);
    // Icicles: hang down along the back of the neck. The crown tilts back 0.16, so the icicles have to flip outward about 0.5 to show against the back of the neck; otherwise each one would be buried inside the head
    const ls = [0.09, 0.13, 0.17, 0.21, 0.17, 0.13, 0.09];
    for (let k = 0; k < 7; k++) {
      const phi = PI + (k - 3) * 0.3;
      const L = ls[k];
      const g1 = group(crown, [0, 0, 0], [0, phi, 0]);
      const g2 = group(g1, [0, 0.005, 0.162], [-0.5 + 0.04 * Math.abs(k - 3), 0, 0]);
      add(g2, facet(lathe([[0.001, -L], [0.018, -L * 0.4], [0.022, 0], [0.001, 0.012]], 6)), M.ice).userData.inkGroup = G_CROWN;
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: chest-out breathing, light flipper flaps, looking left and right, blinking; all computed from t ──
  const act = { glow: 0, puff: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 1.4);
    const pf = act.puff;
    body.scale.set(1 + br * 0.006 + pf * 0.04, 1 - br * 0.004, 1 + br * 0.008 + pf * 0.06);
    body.rotation.y = Math.sin(t * 0.33) * 0.12;
    body.rotation.z = Math.sin(t * 0.7) * 0.015;
    for (const f of flippers) f.g.rotation.set(Math.sin(t * 0.9 + f.s) * 0.04, 0, f.s * (0.28 + 0.06 * Math.max(0, Math.sin(t * 1.8)) + pf * 0.3));
    const bt = t % 3.9;
    const bk = (x: number) => (x > 0 && x < 0.22 ? Math.min(1, Math.sin((x / 0.22) * PI) * 1.3) : 0);
    const close = bk(bt - 3.5);
    for (const l of lids) l.rotation.x = lerp(UP_OPEN, UP_SHUT, close);
    for (const g of glints) g.visible = close < 0.6;
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.core.emissiveIntensity = 0.55 + gl * 0.45;
      M.ice.emissiveIntensity = 0.14 + gl * 0.3;
    }
  };
  update(0);

  const head = group(body, bodyPt(0.87, 0).toArray() as [number, number, number]);
  const mouth = group(body, [0, 0.838, 0.16]);
  const beak = group(body, [0, 0.822, 0.365]);
  const rig = { head, eyes: eyeAnchors, anchors: { mouth, beak, crown: crownTop!, core: coreA! } };
  mergeStatic(root, {
    owners: [body, ...flippers.map((f) => f.g), ...lids],
    keep: [...glints],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.58, 0), radius: 0.78 };
}
