// Oathsea Sage (model lab version, R, water): an otter of the Tidesong Isles that is in the habit of recording the melodies of the tides on shells, and always carries a coral staff; the islanders call it the "Sage of the Oath Sea".
// Identifying features: 1. A red coral staff: a branching, jointed shaft taller than it is, with three coral branches at the top holding a pale purple glowing pearl (the only light on the whole body).
// 2. Shell notation: a hemp rope slung diagonally across the chest strings four scallop shells of different colors (each records one stretch of a tide's melody), and the left palm holds a large scallop shell it is reading.
// 3. An aged sea otter: a dark brown body, with the whole head (including the top and back of the head) a grizzled gray-cream, turning back to dark brown only from the neck down (an old sea otter's whole head goes white, not just a pale round patch on the face),
//    a paler fur patch above each eye (fur color, not a brow), puffy white whisker pads and a black nose.
// Back: the hemp rope wraps around to the back and holds a kelp-woven book bag with two shells showing at its mouth; a thick, flat tail drags on the ground curving to the side.
// Body shape: a standing sea otter, heavy in the lower body, with short legs and webbed feet. Personality: an unhurried old scholar who loves telling old tales, and glances down at the shell in his hand before speaking.
// The face follows a real sea otter: small dark bead eyes (diameter about 15% of the head width, dark brown nearly black with one small highlight, no sclera, and no lower lid of a smiling eye), no human brows and no smiling mouth; below the whisker pads is a small chin, in the same outline piece as the whisker pads, and no mouth line is drawn.
// The kindliness comes from posture and motion (holding the shell, slowly tapping out the beat), not from expression.
// Gaze: the grizzled face (pale fur patches, dark bead eyes, white whisker pads, black nose) → the pearl on top of the coral staff → the string of shells on the chest.
// Actions: idle is breathing, the shell in the left palm tapping out the beat one tick at a time, the tail swaying lightly and blinking; charge-up raises the staff and brightens the pearl (act.glow, act.raise); hit hunches the shoulders to protect the shell; victory raises the shell high.
// Anchors: rig.head, rig.eyes, anchors.mouth, anchors.staff (pearl), anchors.shell (the scallop in the palm), anchors.tail. act: glow, raise.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, loft, mergeStatic, outline, partKit, PI, rbox, slab, type LabModel } from './shapes.ts';
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

// ───────────────────────── Shape ─────────────────────────

export function buildOathseaSageLab(): LabModel {
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.6, rimColor: 0xcfe6ff })),
    shell: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xffe6d6, spec: 0.35, specTh: 0.985 })),
    pearl: labToon(0xfff2fa, { ramp: 'gem', rim: 0, spec: 0.7, specTh: 0.96, emissive: 0xc8a8ff, emissiveAmt: 0.35 }),
    eye: labToon(0x1a110c, { ramp: 'gem', rim: 0.4, rimColor: 0xd8e6f0, spec: 0.9, specTh: 0.97 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'oathsea-sage-lab';
  const { add, group } = partKit();
  const body = group(root);
  const G_BODY = 9801;
  const G_PAD = 9802;
  const G_STAFF = 9803;

  const cBrown = col(0x6e4a30);
  const cChest = col(0x94694a);
  const cGrizzle = col(0xcbb99a);
  const cPale = col(0xfbf8f0);
  const cPaw = col(0x4a3222);

  // ── Body: a lathe body with a horizontal cross-section, heavy below and narrow above, the top tucked into the head ──
  const tt = curveTable([
    [0.015, 0, 0, 0.01],
    [0.035, 0.16, 0.15, 0.01],
    [0.09, 0.225, 0.21, 0.012],
    [0.17, 0.25, 0.23, 0.014],
    [0.28, 0.26, 0.24, 0.015],
    [0.42, 0.245, 0.225, 0.015],
    [0.56, 0.2, 0.185, 0.01],
    [0.68, 0.155, 0.145, 0.005],
    [0.76, 0.12, 0.115, 0],
    [0.8, 0.09, 0.09, 0],
    [0.84, 0, 0, 0],
  ]);
  const torsoPt = (y: number, th: number) => {
    const [a, b, dz] = tt(y);
    return v3(a * Math.sin(th), y, dz + b * Math.cos(th));
  };
  const torsoN = (y: number, th: number) => {
    const e = 0.004;
    const a = torsoPt(y + e, th).sub(torsoPt(y - e, th));
    const b = torsoPt(y, th + e).sub(torsoPt(y, th - e));
    return b.cross(a).normalize();
  };
  {
    const ROWS = 36;
    const COLS = 40;
    const geo = wrapGrid(ROWS, COLS, (i, j) => {
      const y = lerp(0.015, 0.84, i / (ROWS - 1));
      const th = (j / COLS) * PI * 2;
      const p = torsoPt(y, th);
      const c = cBrown.clone().lerp(cChest, sstep(Math.cos(th), 0.2, 0.9) * sstep(y, 0.2, 0.4)).lerp(cGrizzle, sstep(y, 0.66, 0.78));
      return { p, c };
    }, v3(0, 0.45, 0));
    add(body, geo, M.fur).userData.inkGroup = G_BODY;
  }

  // ── Head: a slightly flat round head, with the face and top of the head grizzled and the back of the head and neck turning brown ──
  const HC = v3(0, 0.9, 0.02);
  const HR = v3(0.155, 0.14, 0.145);
  const headDir = (lon: number, lat: number) => v3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
  const headPt = (d: THREE.Vector3) => v3(HC.x + HR.x * d.x, HC.y + HR.y * d.y, HC.z + HR.z * d.z);
  const headN = (d: THREE.Vector3) => v3(d.x / HR.x, d.y / HR.y, d.z / HR.z).normalize();
  {
    const ROWS = 28;
    const COLS = 44;
    const cSpot = cPale.clone().lerp(cGrizzle, 0.25);
    const geo = wrapGrid(ROWS, COLS, (i, j) => {
      const lat = -PI / 2 + (PI * i) / (ROWS - 1);
      const lon = (j / COLS) * PI * 2;
      const d = headDir(lon, lat);
      // The grizzling follows the whole head (including the top and back of the head), turning back to dark brown only from the neck down; it is not a pale disc laid on just the front of the face
      const c = cBrown.clone().lerp(cGrizzle, sstep(d.y * 0.85 + d.z * 0.3, -0.62, -0.05));
      // The pale fur patch above the eyes: one soft-edged patch, slightly lower on the outside, in the same color family as the grizzled face
      const ln = Math.atan2(d.x, d.z);
      const la = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
      const k = Math.hypot((Math.abs(ln) - 0.42) / 0.26, (la - (0.5 - 0.3 * (Math.abs(ln) - 0.42))) / 0.15);
      c.lerp(cSpot, 0.6 * (1 - sstep(k, 0.55, 1.05)));
      return { p: headPt(d), c };
    }, HC);
    add(body, geo, M.fur).userData.inkGroup = G_BODY;
  }
  // Whisker pads, chin, nose, mouth
  const padY = 0.852;
  for (const s of [-1, 1]) add(body, paint(new THREE.SphereGeometry(0.056, 16, 12), cPale), M.fur, [s * 0.042, padY, 0.132]).userData.inkGroup = G_PAD;
  add(body, paint(new THREE.SphereGeometry(0.038, 12, 10), cPale), M.fur, [0, 0.812, 0.112]).userData.inkGroup = G_PAD;
  add(body, paint(new THREE.SphereGeometry(1, 14, 10), 0x1e1814), M.fur, [0, 0.893, 0.182], [0.35, 0, 0], [0.032, 0.022, 0.022]);
  // No mouth line is drawn: the chin and whisker pads are in the same outline group and the same color, outlined only at creases, so no human smiling mouth is traced
  // Whiskers: three on each side, thicker so they do not break into dots under the outline
  for (const s of [-1, 1])
    for (const [dy, dz] of [[0.02, 0.0], [0.0, 0.02], [-0.02, 0.02]] as [number, number][]) {
      const p0 = v3(s * 0.075, padY + dy * 0.5, 0.15);
      const dir = v3(s, dy * 6, dz * 4).normalize();
      add(body, paint(segment([p0, p0.clone().addScaledVector(dir, 0.07).add(v3(0, 0.004, 0)), p0.clone().addScaledVector(dir, 0.13).add(v3(0, -0.006, 0))], 0.0075, 0.004, { segs: 6, radial: 5, tip: 0.1 }), cPale), M.fur);
    }
  // Ears: two small round ears on the sides of the head
  for (const s of [-1, 1]) {
    const d = headDir(s * 1.35, 0.42);
    const g = group(body, headPt(d).toArray() as [number, number, number]);
    g.quaternion.setFromUnitVectors(v3(0, 0, 1), headN(d).add(v3(0, 0.2, 0.5)).normalize());
    add(g, paint(new THREE.SphereGeometry(1, 12, 8), (p) => (p.z > 0.4 ? col(0x3a2618) : cBrown.clone())), M.fur, [0, 0, 0], [0, 0, 0], [0.034, 0.036, 0.018]);
  }

  // ── Eyes: a sea otter's small dark bead eyes (diameter about 15% of the head width, no doll eyes), the whole eye dark brown nearly black with one small highlight (both eyes on the same side); no sclera and no lower eyelid.
  //    Half of the eyeball is buried in the head, and the exposed spherical cap spans about 1.05 radians up and down; when the upper eyelid turns about the x axis its edge always passes through the eye corners, so when open it would show as a brow-like arc,
  //    so when the eyes are open the whole lid is hidden, appearing only when blinking and closing all the way down ──
  const ER = 0.024;
  const UP_OPEN = -1.0;
  const UP_SHUT = 1.1;
  const lids: THREE.Group[] = [];
  const gazes: { g: THREE.Group; s: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = paint(lidLite(ER + 0.003, ER + 0.009, PI / 2, true), cPale.clone().lerp(cGrizzle, 0.35));
  const eyeball = new THREE.SphereGeometry(ER, 16, 10, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const s of [-1, 1]) {
    const d = headDir(s * 0.44, 0.2);
    const n = headN(d);
    const c = headPt(d).addScaledVector(n, -ER * 0.5);
    const q = basis(n.clone().add(v3(0, 0, 0.3)));
    const eg = group(body, c.toArray() as [number, number, number]);
    eg.quaternion.copy(q);
    add(eg, eyeball, M.eye);
    const gaze = group(eg, [0, 0, 0], [-0.02, -s * 0.24, 0]);
    gazes.push({ g: gaze, s });
    add(gaze, paint(lightDecal(ellipsePts(0.4, 0.42, 0, 16), ER + 0.0008, 0, 1), 0x0a0707), M.iris);
    for (const [x, yy, rr] of [[-0.3, 0.34, 0.004]] as [number, number, number][]) {
      const p = v3(x, yy, Math.sqrt(1 - x * x - yy * yy)).multiplyScalar(ER * 0.99);
      const hl = add(eg, new THREE.SphereGeometry(rr, 8, 6), M.hi, [p.x, p.y, p.z], [0, 0, 0], [1, 1, 0.5]);
      hl.quaternion.setFromUnitVectors(v3(0, 0, 1), p.clone().normalize());
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    const upper = group(eg, [0, 0, 0], [UP_OPEN, 0, 0]);
    add(upper, lidUp, M.fur);
    lids.push(upper);
    eyeAnchors.push(group(eg, [0, 0, ER]));
  }

  // ── Limbs: short legs and webbed feet; the staff-holding hand (+x) grips the staff, and the other hand holds a large scallop shell ──
  const limb = (pts: THREE.Vector3[], r0: number, r1: number) => paint(segment(pts, r0, r1, { segs: 10, radial: 10, tip: 0.15 }), cBrown);
  add(body, limb([v3(0.15, 0.68, -0.01), v3(0.26, 0.56, 0.04), v3(0.27, 0.48, 0.15)], 0.058, 0.05), M.fur);
  add(body, paint(new THREE.SphereGeometry(0.047, 12, 10), cPaw), M.fur, [0.27, 0.48, 0.2], [0, 0, 0], [1, 1.1, 1]);
  const armL = group(body, [-0.15, 0.68, -0.01]);
  const shellA = group(armL, [0.07, -0.02, 0.26]);
  {
    const inner = group(armL, [0.15, -0.68, 0.01]);
    add(inner, limb([v3(-0.15, 0.68, -0.01), v3(-0.25, 0.54, 0.08), v3(-0.14, 0.6, 0.21)], 0.058, 0.05), M.fur);
    add(inner, paint(new THREE.SphereGeometry(0.046, 12, 10), cPaw), M.fur, [-0.11, 0.62, 0.23], [0, 0, 0], [1.1, 1, 1]);
  }
  for (const s of [-1, 1]) {
    add(body, paint(new THREE.SphereGeometry(0.1, 14, 10), cBrown), M.fur, [s * 0.13, 0.15, 0.04], [0, 0, 0], [1, 0.9, 1.1]).userData.inkGroup = G_BODY;
    const foot: [number, number][] = [[-0.045, -0.05], [0.045, -0.05], [0.06, 0.03]];
    for (let k = 0; k < 4; k++) {
      const x0 = 0.06 - (k / 3) * 0.12;
      foot.push([x0 - 0.004, 0.075 + 0.008 * Math.sin((k / 3) * PI)], [x0 - 0.02, 0.06]);
    }
    foot.pop();
    foot.push([-0.06, 0.03]);
    const g = slab(outline(foot), 0.02, 0.008, 4).rotateX(PI / 2);
    add(body, paint(g, cPaw), M.fur, [s * 0.14, 0.018, 0.12], [0, s * 0.18, 0]);
  }

  // ── Tail: thick and flat, dragging on the ground and curving toward +x ──
  const tail = group(body, [0, 0.2, -0.17]);
  let tailA: THREE.Group;
  {
    const pts = [v3(0, 0.03, 0.03), v3(0, -0.07, -0.12), v3(0.05, -0.155, -0.27), v3(0.18, -0.168, -0.38), v3(0.31, -0.16, -0.4)];
    add(tail, paint(loft(pts, (t) => {
      const e = t > 0.9 ? Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) : 1;
      return [lerp(0.1, 0.045, t) * e, lerp(0.075, 0.022, t) * e, 0];
    }, { segs: 22, radial: 12 }), (p) => cBrown.clone().lerp(col(0x5a3a24), sstep(-p.z, 0.2, 0.4))), M.fur);
    tailA = group(tail, [0.31, -0.16, -0.4]);
  }

  // ── Coral staff: a jointed red coral shaft, with three short branches at the top holding a pearl ──
  const SX = 0.27;
  const SZ = 0.205;
  let staffA: THREE.Group;
  {
    const cCoral = col(0xd44a3c);
    const cTip = col(0xf6a08c);
    const shaft = loft([v3(SX, 0.0, SZ), v3(SX + 0.012, 0.3, SZ - 0.01), v3(SX - 0.01, 0.62, SZ + 0.01), v3(SX + 0.008, 0.9, SZ - 0.006), v3(SX, 1.1, SZ)], (t) => {
      const e = t < 0.02 ? Math.sqrt(Math.max(0, 1 - ((0.02 - t) / 0.02) ** 2)) : 1;
      const r = (lerp(0.022, 0.018, t) + 0.004 * Math.max(0, Math.sin(t * PI * 11)) ** 4) * e;
      return [r, r];
    }, { segs: 48, radial: 8 });
    add(body, paint(shaft, (p) => cCoral.clone().lerp(col(0xa8302a), sstep(-p.y, -0.3, 0))), M.shell).userData.inkGroup = G_STAFF;
    // Two small forks sprout beside the shaft
    for (const [y, a, L] of [[0.78, 0.6, 0.1], [0.96, -2.2, 0.08]] as [number, number, number][]) {
      const b = v3(SX, y, SZ);
      const dir = v3(Math.sin(a), 0.9, Math.cos(a)).normalize();
      const e = b.clone().addScaledVector(dir, L);
      add(body, paint(segment([b, b.clone().lerp(e, 0.5).add(v3(0, 0.01, 0)), e], 0.014, 0.011, { segs: 6, radial: 8 }), (p) => cCoral.clone().lerp(cTip, sstep(p.distanceTo(e), 0.03, 0))), M.shell).userData.inkGroup = G_STAFF;
    }
    const top = v3(SX, 1.1, SZ);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * PI * 2 + 0.4;
      const cx = Math.sin(a);
      const cz = Math.cos(a);
      const pts = [top.clone().add(v3(cx * 0.004, -0.01, cz * 0.004)), top.clone().add(v3(cx * 0.04, 0.05, cz * 0.04)), top.clone().add(v3(cx * 0.05, 0.11, cz * 0.05)), top.clone().add(v3(cx * 0.028, 0.15, cz * 0.028))];
      add(body, paint(segment(pts, 0.016, 0.01, { segs: 10, radial: 8, tip: 0.12 }), (p) => cCoral.clone().lerp(cTip, sstep(p.y, 1.19, 1.25))), M.shell).userData.inkGroup = G_STAFF;
    }
    add(body, new THREE.SphereGeometry(0.043, 16, 12), M.pearl, [SX, 1.185, SZ]);
    staffA = group(body, [SX, 1.185, SZ]);
  }

  // ── Shell: a fan-shaped plate + radial ribs + hinge ears ──
  const scallop = (r: number, c: THREE.ColorRepresentation, rib: THREE.ColorRepresentation) => {
    const g = new THREE.Group();
    const pts: [number, number][] = [[-r * 0.28, 0], [r * 0.28, 0]];
    for (let i = 0; i <= 14; i++) {
      const a = lerp(0.35, PI - 0.35, i / 14);
      const rr = r * (1 - 0.06 * Math.abs(Math.sin(i * PI * 0.5)));
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    add(g, paint(slab(outline(pts), r * 0.14, r * 0.07, 3), c), M.shell);
    for (let i = 0; i < 5; i++) {
      const a = lerp(0.62, PI - 0.62, i / 4);
      const e = v3(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.09);
      add(g, paint(segment([v3(0, r * 0.08, r * 0.09), e.clone().multiplyScalar(0.5).setZ(r * 0.1), e], r * 0.07, r * 0.05, { segs: 5, radial: 5 }), rib), M.shell);
    }
    add(g, paint(rbox(r * 0.7, r * 0.2, r * 0.16, r * 0.05, 1), rib), M.shell, [0, -r * 0.02, 0]);
    return g;
  };

  // ── String of shells on the chest: a hemp rope running from the right shoulder to the left waist and around the back; four scallops strung on the front ──
  const cordPt = (u: number) => {
    // u 0-0.5 is the front (right shoulder to left waist), 0.5-1 is the back (left waist back to the right shoulder)
    const th = 1.25 - u * PI * 2;
    const y = u <= 0.5 ? lerp(0.72, 0.24, u / 0.5) : lerp(0.24, 0.72, (u - 0.5) / 0.5);
    return { p: torsoPt(y, th), n: torsoN(y, th), y, th };
  };
  {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 48; k++) {
      const { p, n } = cordPt(k / 48);
      pts.push(p.addScaledVector(n, 0.012));
    }
    add(body, paint(loft(pts, () => [0.013, 0.013], { segs: 96, radial: 6 }), (p) => col(0xc6a472).lerp(col(0xa3834e), 0.5 + 0.5 * Math.sin((p.x + p.y) * 90))), M.shell);
    const cols: [number, number][] = [[0xf3c4b4, 0xd88c7c], [0xdcc8ee, 0xa98cc8], [0xf5e3a8, 0xd4b060], [0xbfe3da, 0x78b0a4]];
    for (let k = 0; k < 4; k++) {
      const u = 0.12 + k * 0.085;
      const { p, n } = cordPt(u);
      const sg = scallop(0.05, cols[k][0], cols[k][1]);
      body.add(sg);
      // The hinge hangs on the rope, with the fan hanging down
      sg.position.copy(p.addScaledVector(n, 0.02));
      sg.quaternion.copy(basis(n, UP)).multiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), PI));
    }
    // Kelp book bag on the back: two shells show at its mouth
    const { p: bp, n: bn } = cordPt(0.64);
    const bag = group(body, bp.clone().addScaledVector(bn, 0.05).add(v3(0, -0.06, 0)).toArray() as [number, number, number]);
    bag.quaternion.copy(basis(bn));
    add(bag, paint(rbox(0.2, 0.17, 0.08, 0.035, 2), (p) => col(0x6f8a45).lerp(col(0x55703a), Math.max(0, Math.sin(p.y * 70)) ** 3)), M.shell);
    add(bag, paint(rbox(0.21, 0.07, 0.09, 0.03, 2), 0x587236), M.shell, [0, 0.07, 0.012], [0.12, 0, 0]);
    add(bag, paint(new THREE.SphereGeometry(0.018, 10, 8), 0xe8d8a0), M.shell, [0, 0.05, 0.058]);
    for (const [x, rz, c, rc] of [[-0.045, 0.3, 0xf2ece0, 0xc8b8a0], [0.04, -0.25, 0xf3c4b4, 0xd88c7c]] as [number, number, number, number][]) {
      const sg = scallop(0.045, c, rc);
      bag.add(sg);
      sg.position.set(x, 0.1, -0.012);
      sg.rotation.set(-0.2, 0, rz);
    }
  }
  // The large scallop held in the left palm (the one being read), turned up to face itself
  {
    const sg = scallop(0.075, 0xfbe6dc, 0xe4a898);
    shellA.add(sg);
    sg.rotation.set(-1.0, 0.5, 0.1);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: everything is computed from t ──
  const act = { glow: 0, raise: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 1.3);
    body.scale.set(1 + br * 0.005, 1 - br * 0.004, 1 + br * 0.005);
    body.rotation.z = Math.sin(t * 0.6) * 0.012;
    // The shell in the left palm taps out the beat one tick at a time
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.4)), 4);
    armL.rotation.set(-beat * 0.06 - act.raise * 0.6, 0, -act.raise * 0.2);
    tail.rotation.y = Math.sin(t * 0.8) * 0.08;
    for (const g of gazes) {
      g.g.rotation.y = -g.s * 0.24 + Math.sin(t * 0.35) * 0.1;
      // Now and then it glances down at the shell in its hand
      const look = sstep(Math.sin(t * 0.3), 0.85, 0.95);
      g.g.rotation.x = -0.02 + look * 0.22;
    }
    const bt = t % 4.4;
    const bk = (x: number) => (x > 0 && x < 0.22 ? Math.min(1, Math.sin((x / 0.22) * PI) * 1.3) : 0);
    const close = bk(bt - 4.0);
    for (const l of lids) {
      l.rotation.x = lerp(UP_OPEN, UP_SHUT, close);
      l.visible = close > 0.01;
    }
    for (const g of glints) g.visible = close < 0.6;
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.pearl.emissiveIntensity = 0.35 + gl * 0.5;
    }
  };
  update(0);

  const head = group(body, headPt(headDir(0, 0.1)).toArray() as [number, number, number]);
  const mouth = group(body, [0, padY - 0.04, 0.19]);
  const rig = { head, eyes: eyeAnchors, anchors: { mouth, staff: staffA!, shell: shellA, tail: tailA! } };
  // Merging sees only parts that are displayed: open the eyelids first and then merge, and after merging return to the open-eye pose
  for (const l of lids) l.visible = true;
  mergeStatic(root, {
    owners: [body, armL, tail, ...gazes.map((g) => g.g), ...lids],
    keep: [...glints],
    rig,
  });
  update(0);
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.6, 0), radius: 0.78 };
}
