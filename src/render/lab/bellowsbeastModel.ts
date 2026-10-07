// Forgeheart (model lab version, N, fire): the blacksmiths of Rediron Keep keep one by the forge, and when it yawns the fire burns three parts brighter; when an apprentice finishes training, they are given a forge beast of their own.
// Identifying features: 1. A small furnace ringed with firebricks on its back, the coals burning red hot with three tongues of flame rising; 2. The middle of the body is a segmented leather bellows, with two iron bands at the front and back set with copper rivets,
// and its breathing is the blast; 3. A thick short tail curled upward, ending in an iron bellows nozzle whose mouth points at the furnace on its back. Body shape: a squat four-legged beast with a big round head held low, short legs and big paws.
// Personality: a good-natured, clingy old companion of the forge, expressed by the posture of leaning forward with the head low, panting and wagging its tail. The head has the heavy skull of a mastiff or a wild boar (bulging cheeks, a brow bone of the same color across the forehead), the whole head coal gray,
// with pale color only on the muzzle and throat; small black eyes sunk under the brow bone with only one small highlight; a broad muzzle and a big black nose, the jaw slightly open and the tongue hanging out from one side (<Do not anthropomorphize>).
// Gaze order: the fire in the furnace on its back and the low-pressed head → the bellows and the nozzle at the tail end. Back: the tail's nozzle blasts air at the furnace; under the brass buckle of the collar hangs a small anvil tag hung on the day the apprentice finished training (on the front, under the chin).
// Action table: idle has the bellows swelling and drawing in, with the flames shooting up as it draws in (act.breath reserved); charge-up act.glow brightens the coals and flames; strike is from the mouth (a yawn breathing fire) or the furnace mouth; hit tucks the head.
// Anchors: head, eyes, anchors.mouth (mouth), hearth (above the furnace mouth), nozzle (the mouth of the tail-end nozzle).
// Restrained light effects: the emissive is kept only on the coals and flames, with no bloom.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Normal-direction check for a whole mesh: on average the normals must point away from the ref point, and if not, flip the facing */
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

/**
 * A grid surface wrapped around once: rows along the cross-section, cols around it (the last column joins back to the first, with no seam line).
 * When the head and tail of the cross-section shrink to a point (a pole), the normals of that row are averaged so the pole does not show an outline dot.
 */
function wrapGrid(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, ref: THREE.Vector3): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const cl = new Float32Array(rows * cols * 3);
  let hasC = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      const k = (i * cols + j) * 3;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
      if (c) hasC = true;
      cl[k] = c ? c.r : 1;
      cl[k + 1] = c ? c.g : 1;
      cl[k + 2] = c ? c.b : 1;
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
  if (hasC) g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  orientOut(g, ref);
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (const i of [0, rows - 1]) {
    let spread = 0;
    for (let j = 1; j < cols; j++) spread = Math.max(spread, Math.abs(pos[(i * cols + j) * 3] - pos[i * cols * 3]) + Math.abs(pos[(i * cols + j) * 3 + 2] - pos[i * cols * 3 + 2]));
    if (spread > 1e-5) continue;
    const n = new THREE.Vector3();
    for (let j = 0; j < cols; j++) n.x += na.getX(i * cols + j), n.y += na.getY(i * cols + j), n.z += na.getZ(i * cols + j);
    n.normalize();
    for (let j = 0; j < cols; j++) na.setXYZ(i * cols + j, n.x, n.y, n.z);
  }
  return g;
}

/**
 * A membrane with thickness (wing, cloth, leather): S(u, v) is the midsurface, growing thick / 2 to each side, with a half-round lip along the outer edge.
 * With wrapU, u wraps around with no seam, leaving only the two edges v = 0 and v = 1; without wrapping all four edges are rounded into lips.
 * color(u, v, side): side 1 is the outside, -1 the inside. Which direction is outside is decided by outward (by default, away from the y axis).
 */
function thickSheet(
  NU: number,
  NV: number,
  S: (u: number, v: number) => THREE.Vector3,
  thick: (u: number, v: number) => number,
  o: { wrapU?: boolean; E?: number; color?: (u: number, v: number, side: number) => THREE.Color; outward?: (p: THREE.Vector3) => THREE.Vector3 } = {},
): THREE.BufferGeometry {
  const wrap = !!o.wrapU;
  const cols = wrap ? NU : NU + 1;
  const rows = NV + 1;
  const E = o.E ?? 3;
  const P: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) P.push(S(i / NU, j / NV));
  const at = (i: number, j: number) => P[j * cols + i];
  const Nn: THREE.Vector3[] = [];
  const Su: THREE.Vector3[] = [];
  const Sv: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const iL = wrap ? (i - 1 + cols) % cols : Math.max(0, i - 1);
      const iR = wrap ? (i + 1) % cols : Math.min(cols - 1, i + 1);
      const su = at(iR, j).clone().sub(at(iL, j));
      const sv = at(i, Math.min(rows - 1, j + 1)).clone().sub(at(i, Math.max(0, j - 1)));
      Su.push(su);
      Sv.push(sv);
      Nn.push(su.clone().cross(sv).normalize());
    }
  const mid = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  const ref = (o.outward ?? ((p: THREE.Vector3) => v3(p.x, 0, p.z)))(P[mid]);
  if (Nn[mid].dot(ref) < 0) for (const n of Nn) n.negate();
  const color = o.color ?? (() => col(0xffffff));

  const pos: number[] = [];
  const clr: number[] = [];
  const outs: THREE.Vector3[] = [];
  const addV = (p: THREE.Vector3, d: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z);
    clr.push(c.r, c.g, c.b);
    outs.push(d);
    return outs.length - 1;
  };
  const uvOf = (k: number): [number, number] => [(k % cols) / NU, Math.floor(k / cols) / NV];
  const O: number[] = [];
  const I: number[] = [];
  for (let k = 0; k < P.length; k++) {
    const [u, v] = uvOf(k);
    const h = thick(u, v) / 2;
    O.push(addV(P[k].clone().addScaledVector(Nn[k], h), Nn[k].clone(), color(u, v, 1)));
    I.push(addV(P[k].clone().addScaledVector(Nn[k], -h), Nn[k].clone().negate(), color(u, v, -1)));
  }
  const idx: number[] = [];
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    A.set(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]);
    B.set(pos[b * 3] - A.x, pos[b * 3 + 1] - A.y, pos[b * 3 + 2] - A.z);
    C.set(pos[c * 3] - A.x, pos[c * 3 + 1] - A.y, pos[c * 3 + 2] - A.z);
    const fn = B.cross(C);
    const hint = outs[a].clone().add(outs[b]).add(outs[c]);
    if (fn.dot(hint) < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < (wrap ? cols : cols - 1); i++) {
      const i2 = (i + 1) % cols;
      const a = j * cols + i;
      const b = j * cols + i2;
      const c = (j + 1) * cols + i2;
      const d = (j + 1) * cols + i;
      tri(O[a], O[b], O[c]);
      tri(O[a], O[c], O[d]);
      tri(I[a], I[b], I[c]);
      tri(I[a], I[c], I[d]);
    }
  // Rounded lip on the edge
  const loops: { k: number; e: THREE.Vector3 }[][] = [];
  if (wrap) {
    loops.push(Array.from({ length: cols }, (_, i) => ({ k: i, e: Sv[i].clone().negate() })));
    loops.push(Array.from({ length: cols }, (_, i) => ({ k: (rows - 1) * cols + i, e: Sv[(rows - 1) * cols + i].clone() })));
  } else {
    const L: { k: number; e: THREE.Vector3 }[] = [];
    const eOf = (i: number, j: number) => {
      const k = j * cols + i;
      const e = new THREE.Vector3();
      if (j === 0) e.sub(Sv[k].clone().normalize());
      if (j === rows - 1) e.add(Sv[k].clone().normalize());
      if (i === 0) e.sub(Su[k].clone().normalize());
      if (i === cols - 1) e.add(Su[k].clone().normalize());
      return { k, e };
    };
    for (let i = 0; i < cols; i++) L.push(eOf(i, 0));
    for (let j = 1; j < rows; j++) L.push(eOf(cols - 1, j));
    for (let i = cols - 2; i >= 0; i--) L.push(eOf(i, rows - 1));
    for (let j = rows - 2; j >= 1; j--) L.push(eOf(0, j));
    loops.push(L);
  }
  for (const L of loops) {
    const rings = L.map(({ k, e }) => {
      const n = Nn[k];
      const ee = e.clone().addScaledVector(n, -e.dot(n)).normalize();
      const [u, v] = uvOf(k);
      const h = thick(u, v) / 2;
      const cO = color(u, v, 1);
      const cI = color(u, v, -1);
      const ring = [O[k]];
      for (let m = 1; m <= E; m++) {
        const ph = (PI * m) / (E + 1);
        const d = n.clone().multiplyScalar(Math.cos(ph)).addScaledVector(ee, Math.sin(ph));
        ring.push(addV(P[k].clone().addScaledVector(d, h), d, cO.clone().lerp(cI, (1 - Math.cos(ph)) / 2)));
      }
      ring.push(I[k]);
      return ring;
    });
    for (let q = 0; q < rings.length; q++) {
      const r1 = rings[q];
      const r2 = rings[(q + 1) % rings.length];
      for (let m = 0; m <= E; m++) {
        tri(r1[m], r2[m], r2[m + 1]);
        tri(r1[m], r2[m + 1], r1[m + 1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i));
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** A single-color vertex color (for merging with other parts of the same material) */
const tint = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const cc = col(c);
  return paint(g, () => cc);
};

/**
 * Eyelid shell (with +y as the top, covering down to lip radians, with a rounded lip at the edge), building only the arc that can be seen:
 * when front is true it is centered on +z, otherwise on -z (the lower eyelid turns half a turn about x, so front and back swap).
 */
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

/** Convert latitude and longitude to a direction (longitude 0 faces +z, positive toward +x) */
const dirOf = (lon: number, lat: number) => v3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));

/** Turn eg's z axis toward d (the x axis stays horizontal) */
function aim(eg: THREE.Object3D, d: THREE.Vector3): void {
  const r = new THREE.Vector3().crossVectors(UP, d).normalize();
  const u = new THREE.Vector3().crossVectors(d, r);
  eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
}

/**
 * A mammal's small eye (no doll eyes): an almost entirely black glossy small eyeball with a little dark brown reflection on the lower half and only one small highlight (less than a tenth of the eye in area);
 * no concentric iris, no pupil texture, no lashes and no lower eyelid. The eyeball is buried in the socket (center c under the scalp, facing d), and the upper eyelid normally hides inside the head and flips down when blinking.
 */
function buildDarkEye(
  kit: ReturnType<typeof partKit>,
  parent: THREE.Object3D,
  c: THREE.Vector3,
  d: THREE.Vector3,
  o: { ER: number; sx: number; mat: THREE.Material; hi: THREE.Material; lid: THREE.Material; ink: number; top: THREE.ColorRepresentation; low: THREE.ColorRepresentation },
) {
  const { add, group } = kit;
  const { ER, sx } = o;
  const eg = group(parent, [c.x, c.y, c.z]);
  aim(eg, d);
  const cT = col(o.top);
  const cL = col(o.low);
  add(eg, paint(new THREE.SphereGeometry(ER, 16, 10), (p) => cT.clone().lerp(cL, sstep(-p.y / ER, 0.1, 0.9) * sstep(p.z / ER, 0.2, 0.8))), o.mat);
  const hl = add(eg, new THREE.SphereGeometry(ER * 0.2, 8, 6), o.hi, [-0.32 * sx * ER, 0.38 * ER, ER * 0.86], [0, 0, 0], [1, 1, 0.5]);
  hl.quaternion.setFromUnitVectors(v3(0, 0, 1), v3(-0.32 * sx, 0.38, 0.86).normalize());
  hl.layers.disable(INK_LAYER);
  hl.castShadow = false;
  const upper = group(eg, [0, 0, 0], [-1.3, 0, 0]);
  add(upper, lidLite(ER + 0.004, ER + 0.008, PI / 2, true), o.lid).userData.inkGroup = o.ink;
  return { eg, lids: [{ g: upper, open: -1.3, shut: 0.95 }], glints: [hl as THREE.Object3D], anchor: group(eg, [0, 0, ER]), sx };
}

/**
 * An insect's compound eye: a dark (deep red-brown to nearly black) hemisphere on each side of the head, an icosahedron subdivided twice with a separate normal on every face, which makes patches of fine facets;
 * each face's color varies slightly in shade, with only a very faint reflection (the material's hard highlight turned down), and no iris, pupil or white highlight dot, and it does not blink.
 */
function buildFacetEye(
  kit: ReturnType<typeof partKit>,
  parent: THREE.Object3D,
  c: THREE.Vector3,
  d: THREE.Vector3,
  o: { ER: number; mat: THREE.Material; dark: THREE.ColorRepresentation; warm: THREE.ColorRepresentation; seed: number },
) {
  const { add, group } = kit;
  const eg = group(parent, [c.x, c.y, c.z]);
  aim(eg, d);
  const r = rng(o.seed);
  const g = new THREE.IcosahedronGeometry(o.ER, 2);
  g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const cl = new Float32Array(pa.count * 3);
  const cD = col(o.dark);
  const cW = col(o.warm);
  for (let i = 0; i < pa.count; i += 3) {
    const y = (pa.getY(i) + pa.getY(i + 1) + pa.getY(i + 2)) / 3 / o.ER;
    const cc = cD.clone().lerp(cW, 0.25 * r() + 0.45 * sstep(-y, 0.0, 0.9));
    for (let k = 0; k < 3; k++) cc.toArray(cl, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  add(eg, g, o.mat);
  return { eg, anchor: group(eg, [0, 0, o.ER]) };
}

/** Blink: once every period seconds, with every third one being a double blink; returns 0 (open) to 1 (closed) */
function blinkAt(t: number, period = 3.9): number {
  const bt = t % period;
  const bk = (x: number) => (x > 0 && x < 0.22 ? Math.min(1, Math.sin((x / 0.22) * PI) * 1.3) : 0);
  return Math.max(bk(bt - (period - 0.4)), Math.floor(t / period) % 3 === 1 ? bk(bt - (period - 0.75)) : 0);
}

// ───────────────────────── Shape ─────────────────────────

export function buildBellowsbeastLab(): LabModel {
  const rand = rng(20261031);
  const RIMC = 0xffc08a;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  // The body, head, feet, ears, tail, leather bellows and leather collar share one vertex-color material
  const hide = vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC }));
  const M = {
    hide,
    // The eyelid is the coal-gray fur on the head (same parameters as hide, differing only in base color)
    skin: labToon(0x4a4246, { rim: 0.5, rimColor: RIMC }),
    brick: vc(labToon(0xffffff, { rim: 0.35, rimColor: RIMC, speckle: 0.35 })),
    metal: vc(labToon(0xffffff, { ramp: 'metal', rim: 0.4, rimColor: RIMC, spec: 0.8, specTh: 0.97 })),
    coal: labToon(0xffc050, { ramp: 'gem', rim: 0, emissive: 0xff6a18, emissiveAmt: 0.75 }),
    flame: vc(labToon(0xffffff, { ramp: 'gem', rim: 0, emissive: 0xff7a1a, emissiveAmt: 0.65 })),
    nose: labToon(0x2a1e22, { rim: 0.3, rimColor: RIMC, spec: 0.7, specTh: 0.975 }),
    // Eye: an almost entirely black glossy small eye (vertex colors: a little dark brown reflection on the lower half)
    eye: vc(labToon(0xffffff, { ramp: 'gem', rim: 0, spec: 0.8, specTh: 0.985 })),
    mouthIn: labToon(0x4a1612, { rim: 0 }),
    tongue: labToon(0xe87888, { rim: 0 }),
    dark0: vc(labToon(0xffffff, { rim: 0 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'bellowsbeast-lab';
  const kit = partKit();
  const { add, group, rivet } = kit;
  const HEAD = 9601;
  const body = group(root);

  const cSoot = col(0x4a4246);
  const cSootHi = col(0x6a5e60);
  const cBelly = col(0xe07a3a);
  const cLeather = col(0x8a5230);
  const cLeatherDk = col(0x4e2a18);
  const cTan = col(0xd8bc94);
  const cIron = col(0x5e5c64);
  const cBrass = col(0xd6a444);

  // ── Body: a squat single loft, with the middle section a segmented leather bellows (folds like a polyline, bright ridges and dark valleys), and two iron bands at the front and back ──
  const bodyPts = [v3(0, 0.4, -0.44), v3(0, 0.43, -0.3), v3(0, 0.45, -0.05), v3(0, 0.46, 0.15), v3(0, 0.47, 0.3), v3(0, 0.52, 0.42)];
  const WT = curveTable([[0, 0], [0.03, 0.16], [0.1, 0.27], [0.2, 0.285], [0.3, 0.255], [0.45, 0.25], [0.58, 0.265], [0.72, 0.29], [0.86, 0.2], [0.95, 0.13], [1, 0]]);
  const HT = curveTable([[0, 0], [0.03, 0.15], [0.1, 0.23], [0.2, 0.25], [0.3, 0.235], [0.45, 0.235], [0.58, 0.245], [0.72, 0.26], [0.86, 0.19], [0.95, 0.12], [1, 0]]);
  const P0 = 0.2;
  const P1 = 0.58;
  const NPL = 6;
  const pleat = (t: number) => {
    const s = (t - P0) / (P1 - P0);
    if (s <= 0 || s >= 1) return 0;
    const q = (s * NPL) % 1;
    return 1 - Math.abs(q - 0.5) * 2;
  };
  const bodyCurve = new THREE.CatmullRomCurve3(bodyPts, false, 'centripetal');
  {
    const geo = loft(bodyPts, (t) => {
      const k = t > P0 && t < P1 ? 1 + 0.09 * (pleat(t) - 0.5) : 1;
      return [WT(t)[0] * k, HT(t)[0] * k];
    }, { segs: 96, radial: 22 });
    // Color depends on position along the body: find the nearest point on the curve and compute t
    const samples = Array.from({ length: 201 }, (_, i) => bodyCurve.getPointAt(i / 200));
    add(body, paint(geo, (p, n) => {
      let bi = 0;
      let bd = 1e9;
      for (let i = 0; i < samples.length; i++) {
        const d = samples[i].distanceToSquared(p);
        if (d < bd) (bd = d), (bi = i);
      }
      const t = bi / 200;
      const inPl = t > P0 + 0.004 && t < P1 - 0.004;
      if (inPl) return cLeatherDk.clone().lerp(cLeather, sstep(pleat(t), 0.2, 0.85)).lerp(cBelly, 0.18 * sstep(-n.y, 0.4, 0.9));
      return cSoot.clone().lerp(cSootHi, sstep(n.y, 0.3, 0.9) * 0.5).lerp(cBelly, sstep(-n.y, 0.15, 0.6));
    }), M.hide);
    // The iron bands at the two ends of the bellows, with a row of copper rivets on each band
    for (const t of [P0, P1]) {
      const c = bodyCurve.getPointAt(t);
      const tg = bodyCurve.getTangentAt(t);
      const g = group(body, [c.x, c.y, c.z]);
      g.quaternion.setFromUnitVectors(v3(0, 0, 1), tg);
      const w = WT(t)[0] * 1.045 + 0.006;
      const h = HT(t)[0] * 1.045 + 0.006;
      add(g, tint(new THREE.TorusGeometry(1, 0.022 / Math.min(w, h), 6, 36), cIron), M.metal, [0, 0, 0], [0, 0, 0], [w, h, Math.min(w, h)]);
      for (const a of [0.5, 1.1, PI / 2, PI - 1.1, PI - 0.5]) {
        const x = Math.cos(a) * (w + 0.018);
        const y = Math.sin(a) * (h + 0.018);
        rivet(g, M.metal, [x, y, 0], [Math.cos(a) / w, Math.sin(a) / h, 0], 0.012);
      }
    }
  }
  // Copper rivet color: rivet uses the shared material, so it is swapped for the vertex-color version of copper
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material === M.metal && m.geometry.type === 'SphereGeometry') m.geometry = tint(m.geometry.clone(), cBrass);
  });

  // ── Feet: four short thick legs with big round paws ──
  for (const sx of [-1, 1])
    for (const [z0, z1] of [[0.2, 0.23], [-0.3, -0.31]]) {
      const pts = [v3(sx * 0.15, 0.38, z0), v3(sx * 0.18, 0.24, z0 + 0.01), v3(sx * 0.19, 0.1, z1)];
      add(body, paint(loft(pts, (t) => [0.1 - 0.018 * t, 0.1 - 0.018 * t], { segs: 10, radial: 14 }), (p) => cSoot.clone().lerp(cSootHi, sstep(0.3 - p.y, 0, 0.15) * 0.6)), M.hide);
      add(body, paint(new THREE.SphereGeometry(1, 16, 10), (p) => cSootHi.clone().lerp(cBelly, sstep(-p.y, 0.3, 0.8) * 0.5)), M.hide, [sx * 0.19, 0.062, z1 + 0.035], [0, 0, 0], [0.105, 0.064, 0.115]);
      for (const dx of [-0.045, 0, 0.045]) add(body, tint(new THREE.SphereGeometry(1, 8, 6), 0x8a7a78), M.hide, [sx * 0.19 + dx * 1.15, 0.036, z1 + 0.135], [0, 0, 0], [0.027, 0.022, 0.024]);
    }

  // ── Furnace on the back: three layers of firebricks ringed around (with recessed mortar between the bricks), a pile of coals inside, and three tongues of flame rising ──
  const HX = v3(0, 0, -0.08);
  const RB = 0.148;
  {
    const cBrickA = col(0xe0c49a);
    const cBrickB = col(0xc99a6e);
    const cSootBrick = col(0x6a5040);
    const brickGeo = rbox(0.082, 0.052, 0.06, 0.012, 1);
    const ys = [0.65, 0.705, 0.76];
    for (let k = 0; k < 3; k++)
      for (let i = 0; i < 10; i++) {
        const a = ((i + (k % 2) * 0.5) / 10) * PI * 2 + (rand() - 0.5) * 0.04;
        const g = group(body, [HX.x + Math.sin(a) * RB, ys[k] + (rand() - 0.5) * 0.004, HX.z + Math.cos(a) * RB], [0, a, (rand() - 0.5) * 0.04]);
        const c = cBrickA.clone().lerp(cBrickB, rand() * 0.8).lerp(cSootBrick, k === 2 ? 0.25 + rand() * 0.25 : 0);
        add(g, tint(brickGeo.clone(), c), M.brick);
      }
    add(body, tint(lathe([[RB - 0.022, 0.615], [RB + 0.024, 0.615], [RB + 0.024, 0.782], [RB - 0.022, 0.782], [RB - 0.022, 0.615]], 24), 0x5a4a44), M.brick, [HX.x, 0, HX.z]);
    // Coal bed and coal lumps: half burning red and half charred black
    add(body, tint(lathe([[0.001, 0.79], [0.11, 0.782], [RB - 0.02, 0.76], [RB - 0.02, 0.74]], 16), 0x2a2224), M.brick, [HX.x, 0, HX.z]);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4 + rand() * 0.5;
      const r = i === 0 ? 0 : 0.035 + (i % 3) * 0.03;
      const s = 0.03 + rand() * 0.018;
      const hot = i % 2 === 0;
      const g = new THREE.IcosahedronGeometry(1, 0);
      add(body, hot ? g : tint(g, 0x2e2628), hot ? M.coal : M.brick, [HX.x + Math.sin(a) * r, 0.795 + (r < 0.05 ? 0.018 : 0) + rand() * 0.01, HX.z + Math.cos(a) * r], [rand() * 3, rand() * 3, rand() * 3], [s, s * 0.8, s]);
    }
  }
  const fireG = group(body, [HX.x, 0.79, HX.z]);
  {
    const cBase = col(0xfff0a0);
    const cTip = col(0xff5a1a);
    for (const [x, z, h, lean] of [[0, 0.01, 0.2, 0.0], [-0.055, -0.02, 0.14, -0.35], [0.05, 0.03, 0.15, 0.4]] as [number, number, number, number][]) {
      const pts = [v3(x, 0, z), v3(x + lean * 0.03, h * 0.35, z), v3(x - lean * 0.01, h * 0.7, z), v3(x + lean * 0.05 + 0.012, h, z)];
      const geo = loft(pts, (t) => {
        const w = 0.05 * Math.sin(PI * Math.min(1, 0.15 + t * 0.85)) ** 0.8 * (1 - 0.6 * t);
        return [w + 0.002, w * 0.65 + 0.002];
      }, { segs: 12, radial: 10, up: v3(0, 0, 1) });
      add(fireG, paint(geo, (p) => cBase.clone().lerp(cTip, sstep(p.y / h, 0.25, 0.9))), M.flame);
    }
  }
  const hearthA = group(body, [HX.x, 0.86, HX.z]);

  // ── Tail: a thick short tail curled upward, ending in an iron bellows nozzle whose mouth points at the furnace on its back (it blasts air into its own fire) ──
  const tailG = group(body, [0, 0.46, -0.43]);
  const tailPts = [v3(0, 0, 0), v3(0, 0.1, -0.1), v3(0, 0.24, -0.14), v3(0, 0.34, -0.1), v3(0, 0.37, -0.02)];
  add(tailG, paint(loft(tailPts, (t) => [0.06 - 0.022 * t, 0.06 - 0.022 * t], { segs: 18, radial: 12 }), (p) => cSoot.clone().lerp(cSootHi, sstep(p.y, 0.2, 0.35) * 0.5)), M.hide);
  const nozG = group(tailG, [tailPts[4].x, tailPts[4].y, tailPts[4].z]);
  nozG.quaternion.setFromUnitVectors(UP, tailPts[4].clone().sub(tailPts[3]).normalize());
  add(nozG, tint(lathe([[0.042, -0.03], [0.046, -0.02], [0.046, 0.012], [0.04, 0.02]], 14), cBrass), M.metal);
  add(nozG, tint(lathe([[0.001, 0.0], [0.038, 0.0], [0.034, 0.03], [0.022, 0.075], [0.016, 0.1], [0.019, 0.108], [0.012, 0.11], [0.008, 0.095]], 14), cIron), M.metal);
  const nozA = group(nozG, [0, 0.11, 0]);

  // ── Head: the heavy skull of a mastiff or a wild boar, held very low, with bulging cheeks and a thick brow bone across the forehead (a bone ridge of the same color, not a brow line);
  // the whole head is coal gray, with pale color only on the muzzle, chin and throat; small black eyes sunk under the brow bone; a broad muzzle and a big black nose, the jaw slightly open to pant ──
  const HC = v3(0, 0.53, 0.43);
  const HR = 0.19;
  const headG = group(body, [HC.x, HC.y, HC.z]);
  const headPaint = (p: THREE.Vector3) => {
    const throat = sstep(-p.y / HR, 0.42, 0.7) * sstep(p.z / HR, -0.1, 0.35);
    return cSoot.clone().lerp(cSootHi, sstep(p.y / HR, 0.25, 0.9) * 0.45).lerp(cTan, throat);
  };
  add(headG, paint(new THREE.SphereGeometry(HR, 28, 20), headPaint), M.hide).userData.inkGroup = HEAD;
  for (const sx of [-1, 1]) {
    const c = v3(sx * 0.1, -0.055, 0.05);
    add(headG, paint(new THREE.SphereGeometry(0.125, 18, 12), (p) => headPaint(p.clone().add(c))), M.hide, [c.x, c.y, c.z]).userData.inkGroup = HEAD;
  }
  // Brow bone: a thick horizontal bone ridge across the forehead, arching slightly in the middle and stopping at the upper edge of the eyes (it does not press on the eyes, otherwise it would look like a glare or sleepiness)
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * 2 - 1;
      pts.push(dirOf(a * 0.62, 0.44 - 0.035 * a * a).multiplyScalar(HR + 0.002));
    }
    add(headG, tint(loft(pts, (t) => {
      const e = Math.sin(PI * Math.min(1, 0.03 + t * 0.94)) ** 0.45;
      return [0.03 * e + 0.004, 0.024 * e + 0.004];
    }, { segs: 18, radial: 12 }), 0x5a5054), M.hide).userData.inkGroup = HEAD;
  }
  // Ears: two small round ears, flame orange on the inside
  const ears: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const p = dirOf(sx * 0.95, 0.6).multiplyScalar(HR * 0.92);
    const g = group(headG, [p.x, p.y, p.z], [0.1, sx * 0.9, sx * -0.5]);
    ears.push({ g, sx });
    add(g, paint(new THREE.SphereGeometry(1, 14, 10), (q) => (q.z > 0.35 ? cBelly : cSoot)), M.hide, [0, 0.03, 0], [0, 0, 0], [0.065, 0.075, 0.03]);
  }
  // Eyes: diameter about 14% of the head width, almost entirely black with only a little dark brown reflection and one small highlight, sunk under the brow bone
  const ER = 0.027;
  const eyes = [-1, 1].map((sx) => {
    const d = dirOf(sx * 0.37, 0.15);
    return buildDarkEye(kit, headG, d.clone().multiplyScalar(HR - ER * 0.3), d, { ER, sx, mat: M.eye, hi: M.hi, lid: M.skin, ink: HEAD, top: 0x0c0806, low: 0x3e2414 });
  });
  // Muzzle: a broad, thick muzzle, the nose bridge continuing the coal gray of the top of the head and turning light brown only forward and down; a big black nose; the jaw slightly open with a deep red mouth and the tongue hanging out from one side (panting)
  const MZ = 0.1;
  const muzzle = group(headG, [0, -0.07, 0.145]);
  muzzle.scale.set(1.4, 0.8, 1.0);
  add(muzzle, paint(new THREE.SphereGeometry(MZ, 20, 14), (p) => cSoot.clone().lerp(cTan, sstep(p.z / MZ - 0.6 * p.y / MZ, 0.2, 0.75))), M.hide);
  add(muzzle, new THREE.SphereGeometry(1, 14, 10), M.nose, [0, 0.05, 0.086], [0, 0, 0], [0.05, 0.032, 0.03]);
  const jaw = group(headG, [0, -0.13, 0.09], [0.2, 0, 0]);
  add(jaw, tint(new THREE.SphereGeometry(0.085, 18, 12), 0xcfb08a), M.hide, [0, -0.012, 0.03], [0, 0, 0], [1.25, 0.55, 1.05]);
  add(headG, new THREE.SphereGeometry(1, 14, 10), M.mouthIn, [0, -0.118, 0.135], [0, 0, 0], [0.09, 0.04, 0.075]);
  add(headG, loft([v3(0.02, -0.12, 0.14), v3(0.028, -0.13, 0.19), v3(0.036, -0.155, 0.215), v3(0.04, -0.18, 0.212)], (t) => {
    const w = 0.034 * Math.sin(PI * Math.min(1, 0.25 + t * 0.75)) ** 0.5;
    return [w + 0.004, 0.01];
  }, { segs: 10, radial: 10, up: v3(0, 0, 1) }), M.tongue);

  // ── Collar: a leather collar around the neck, with a small anvil-shaped tag hanging under the brass buckle (hung on the day the apprentice finished training and was given it) ──
  {
    const g = group(body, [0, 0.47, 0.31], [-0.3, 0, 0]);
    add(g, tint(new THREE.TorusGeometry(0.2, 0.026, 8, 36), cLeather), M.hide, [0, 0, 0], [0, 0, 0], [1, 0.96, 1]);
    const b = group(g, [0, -0.2 * 0.96, 0]);
    add(b, tint(rbox(0.06, 0.05, 0.035, 0.008, 1), cBrass), M.metal);
    const tag = group(b, [0, -0.06, 0.005]);
    add(tag, tint(new THREE.TorusGeometry(0.012, 0.004, 5, 12), cBrass), M.metal, [0, 0.03, 0]);
    const anvil = outline([[-0.05, 0.018], [0.05, 0.018], [0.036, 0.004], [0.018, 0.0], [0.018, -0.018], [0.03, -0.03], [-0.03, -0.03], [-0.018, -0.018], [-0.018, 0.0], [-0.036, 0.004]]);
    add(tag, tint(slab(anvil, 0.012, 0.003, 3), cIron), M.metal, [0, 0, -0.006]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: the bellows swells and draws in (the body follows the breathing), and the furnace fire shoots up as it draws in; the head slowly looks around, an ear twitches now and then and the tail sways lightly ──
  const act = { glow: 0, breath: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 2.1);
    body.scale.set(1 + br * 0.012, 1 + br * 0.01, 1 - br * 0.006);
    const up = Math.max(0, -Math.sin(t * 2.1 - 0.4));
    fireG.scale.set(1 - up * 0.08, 1 + up * 0.22 + act.glow * 0.3 + Math.sin(t * 7.3) * 0.03, 1 - up * 0.08);
    headG.rotation.set(Math.sin(t * 0.53 + 1) * 0.04, Math.sin(t * 0.41) * 0.14, Math.sin(t * 0.6) * 0.03);
    const tw = t % 5.3;
    for (const e of ears) e.g.rotation.z = e.sx * -0.5 + (tw > 4.9 && tw < 5.15 && e.sx > 0 ? Math.sin(((tw - 4.9) / 0.25) * PI) * 0.35 : 0);
    tailG.rotation.set(Math.sin(t * 1.3) * 0.04, Math.sin(t * 1.9) * 0.12, 0);
    const close = blinkAt(t, 4.1);
    for (const e of eyes) {
      for (const l of e.lids) l.g.rotation.x = lerp(l.open, l.shut, close);
      for (const g of e.glints) g.visible = close < 0.6;
    }
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.coal.emissiveIntensity = 0.75 + act.glow * 0.3;
      M.flame.emissiveIntensity = 0.65 + act.glow * 0.3;
    }
  };
  update(0);

  const face = group(headG, [0, Math.sin(0.05) * HR, Math.cos(0.05) * HR + 0.02]);
  const mouthA = group(headG, [0, -0.125, 0.21]);
  const rig = { head: face, eyes: eyes.map((e) => e.anchor), anchors: { mouth: mouthA, hearth: hearthA, nozzle: nozA } };
  mergeStatic(root, {
    owners: [body, headG, fireG, tailG, ...ears.map((e) => e.g), ...eyes.flatMap((e) => e.lids.map((l) => l.g))],
    keep: eyes.flatMap((e) => e.glints),
    twins: [[M.skin, hide], [M.mouthIn, M.dark0], [M.tongue, M.dark0]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.5, 0), radius: 0.8 };
}
