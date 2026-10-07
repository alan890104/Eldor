// Ironclad Knight (model lab version, N, fire): a squire of Rediron Keep, whose first companion is often an Ironclad Knight; they copy their master and raise a shield, and are said never to have let their master be hurt even once.
// Identifying features: 1. A beetle sitting upright, with two glossy red-iron elytra on its back, a copper edging along the outer rim plus rivets; 2. The left front leg grips a steel-colored kite shield with a copper rim and a red-iron flame mark in the center,
// and two scratches on the shield face from blows it has blocked; 3. A red-iron helmet on its head, with a horn on top curving back like a helmet crest. Body shape: the beetle's body sitting up, middle and hind legs bracing on the ground, and the right front leg held at the chest as if saluting.
// Personality: an earnest and loyal little squire with a "leave it to me" air: expressed by sitting upright with chest out, one hand on the hip and one hand raising the shield. The head is the dark red-brown carapace itself, with a small dark finely faceted
// compound eye on each side under the helmet rim, and no pale face, doll eyes or human mouth (<Do not anthropomorphize>).
// Gaze order: the shield (copper rim and flame mark) and the helmet's horn → the red elytra. Back: a wooden practice sword is strapped diagonally across the elytra with two leather straps, the hilt sticking out from behind the right shoulder.
// Action table: idle is chest-out breathing and the head slowly looking around; blocking raises the shield in front of the face; strike is a horn thrust forward or a shield bash (anchor shield); hit shrinks in behind the shield.
// Anchors: head, eyes, anchors.mouth, shield (center of the shield face), hornTip (horn tip).
// Restrained light effects: no emissive; metal relies on four-step shading and hard highlights.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, type LabModel } from './shapes.ts';
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

/** Outline points of a shield shape (flat top edge, both sides tapering to a pointed bottom), where s is the scale and cy is the height of the scaling center */
function heaterPts(s: number, cy = -0.02): [number, number][] {
  const out: [number, number][] = [];
  const W = 0.17;
  const TOP = 0.2;
  const q = (a: [number, number], c: [number, number], b: [number, number], n: number) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      out.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]);
    }
  };
  out.push([-W + 0.03, TOP]);
  out.push([W - 0.03, TOP]);
  q([W - 0.03, TOP], [W, TOP], [W, TOP - 0.03], 3);
  out.push([W, 0.03]);
  q([W, 0.03], [W - 0.01, -0.15], [0, -0.26], 8);
  q([0, -0.26], [-W + 0.01, -0.15], [-W, 0.03], 8);
  out.push([-W, TOP - 0.03]);
  q([-W, TOP - 0.03], [-W, TOP], [-W + 0.03, TOP], 3);
  out.pop();
  return out.map(([x, y]) => [x * s, (y - cy) * s + cy] as [number, number]);
}

// ───────────────────────── Shape ─────────────────────────

export function buildShieldbeetleLab(): LabModel {
  const RIMC = 0xffb08a;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  // The carapace (elytra, pronotum, helmet, horn, shield) is one vertex-color metal material; the body, legs and face are one vertex-color chitin material
  const shell = vc(labToon(0xffffff, { ramp: 'metal', rim: 0.45, rimColor: RIMC, spec: 0.75, specTh: 0.965 }));
  const chitin = vc(labToon(0xffffff, { rim: 0.45, rimColor: RIMC }));
  const M = {
    shell,
    chitin,
    wood: vc(labToon(0xffffff, { rim: 0.35, rimColor: RIMC })),
    // Compound eye: dark fine facets (vertex colors), with only a very faint reflection
    ceye: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.15, rimColor: RIMC, spec: 0.3, specTh: 0.95 })),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'shieldbeetle-lab';
  const kit = partKit();
  const { add, group, rivet } = kit;
  const HEAD = 9701;
  const body = group(root);

  const cRed = col(0xc23a20);
  const cRedDk = col(0x6e1a10);
  const cBrass = col(0xd8a440);
  const cBelly = col(0x5a3a30);
  const cBellyHi = col(0x7e5642);
  const cDark = col(0x3a2a28);
  const cSteel = col(0xa2a8b2);

  // ── Body: a beetle sitting upright with its axis slanting forward and up; the back is covered by two red-iron elytra, and the front is segmented dark copper belly plates ──
  const A = v3(0, 0.92, 0.39).normalize();
  const X = v3(1, 0, 0);
  const DD = new THREE.Vector3().crossVectors(A, X).normalize();
  const BASE = v3(0, 0.05, -0.26);
  const L = 0.8;
  const Wt = curveTable([[0, 0], [0.05, 0.15], [0.2, 0.25], [0.5, 0.29], [0.8, 0.26], [0.93, 0.19], [1, 0.12]]);
  const Dt = curveTable([[0, 0], [0.05, 0.12], [0.25, 0.22], [0.5, 0.245], [0.8, 0.22], [0.95, 0.16], [1, 0.1]]);
  const surf = (t: number, th: number, off = 0) =>
    BASE.clone().addScaledVector(A, L * t).addScaledVector(X, (Wt(t)[0] + off) * Math.sin(th)).addScaledVector(DD, (Dt(t)[0] + off) * Math.cos(th));
  const axisOut = (p: THREE.Vector3) => {
    const q = p.clone().sub(BASE);
    return q.addScaledVector(A, -q.dot(A));
  };
  {
    const R = 26;
    const C = 40;
    const geo = wrapGrid(R, C, (i, j) => {
      const t = i / (R - 1);
      const th = (j / C) * PI * 2;
      const p = surf(t, th);
      const ven = sstep(-Math.cos(th), 0.2, 0.6);
      const seg = Math.abs(((t * 7 + 0.3) % 1) - 0.5) * 2;
      const c = cDark.clone().lerp(cBelly.clone().lerp(cBellyHi, sstep(seg, 0.35, 0.8)), ven);
      return { p, c };
    }, BASE.clone().addScaledVector(A, 0.4));
    add(body, geo, M.chitin);
  }
  // Elytra: two thick shells, left and right, leaving a seam in the middle; a copper edging along the outer rim, with a row of rivets on the edging
  const us = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.78, 0.85, 0.9, 0.93, 0.96, 1];
  const umap = (u: number) => {
    const x = u * (us.length - 1);
    const i = Math.min(us.length - 2, Math.floor(x));
    return lerp(us[i], us[i + 1], x - i);
  };
  const EL_OFF = 0.028;
  const elyTh = (u: number) => lerp(0.035, 1.95, umap(u));
  const elyT = (v: number) => lerp(0.64, 0.03, v);
  for (const sx of [-1, 1]) {
    const geo = thickSheet(us.length - 1, 20, (u, v) => surf(elyT(v), sx * elyTh(u), EL_OFF), () => 0.03, {
      E: 2,
      outward: axisOut,
      color: (u, v, side) => {
        if (side < 0) return cRedDk.clone();
        const k = umap(u);
        return cRed.clone().lerp(cRedDk, sstep(k, 0.45, 0.88) * 0.55 + sstep(v, 0.6, 1) * 0.25).lerp(cBrass, sstep(k, 0.9, 0.93));
      },
    });
    add(body, geo, M.shell);
    for (const t of [0.14, 0.26, 0.38, 0.5]) {
      const p = surf(t, sx * 1.92, EL_OFF + 0.017);
      const n = axisOut(p).normalize();
      rivet(body, M.shell, [p.x, p.y, p.z], [n.x, n.y, n.z], 0.012);
    }
  }
  // Pronotum: a red-iron plate on the shoulders that covers the upper edge of the elytra downward (like a pauldron)
  {
    const geo = thickSheet(24, 8, (u, v) => {
      const th = lerp(-2.25, 2.25, u);
      const t = lerp(0.57, 0.98, v);
      return surf(t, th, lerp(0.06, 0.03, v));
    }, () => 0.028, {
      E: 2,
      outward: axisOut,
      color: (u, v, side) => (side < 0 ? cRedDk.clone() : cRed.clone().lerp(cRedDk, 0.2 + 0.3 * Math.abs(u - 0.5) * 2).lerp(cBrass, sstep(0.14 - v, 0.0, 0.06))),
    });
    add(body, geo, M.shell);
  }
  // The copper rivets are swapped for vertex-color copper
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material === M.shell && m.geometry.type === 'SphereGeometry') m.geometry = tint(m.geometry.clone(), cBrass);
  });

  // ── A wooden practice sword strapped on the back: the blade lies slantwise on the elytra and the hilt sticks out from behind the right shoulder (it is a squire knight itself) ──
  {
    const path: THREE.Vector3[] = [];
    const OFF = EL_OFF + 0.032;
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      path.push(surf(lerp(0.1, 0.66, s), lerp(0.75, -0.62, s), OFF));
    }
    const mid = path[4];
    const nUp = axisOut(mid).normalize();
    const cWood = col(0xd2a468);
    const cWoodDk = col(0xa87a44);
    add(body, paint(loft(path, (t) => {
      const w = t < 0.1 ? 0.012 + 0.2 * t : 0.032;
      return [w, 0.011];
    }, { segs: 24, radial: 8, up: nUp }), (p) => cWood.clone().lerp(cWoodDk, 0.5 + 0.5 * Math.sin(p.y * 60))), M.wood);
    const end = path[8];
    const dir = path[8].clone().sub(path[7]).normalize();
    const side = new THREE.Vector3().crossVectors(dir, axisOut(end).normalize()).normalize();
    // Guard, grip, pommel
    add(body, tint(loft([end.clone().addScaledVector(side, -0.075), end.clone().addScaledVector(side, 0.075)], () => [0.018, 0.016], { segs: 4, radial: 8 }), cWoodDk), M.wood);
    const gEnd = end.clone().addScaledVector(dir, 0.13);
    add(body, tint(loft([end, end.clone().addScaledVector(dir, 0.065), gEnd], () => [0.016, 0.016], { segs: 6, radial: 8 }), 0x6a3a22), M.wood);
    add(body, tint(new THREE.SphereGeometry(0.026, 10, 8), cWoodDk), M.wood, [gEnd.x + dir.x * 0.015, gEnd.y + dir.y * 0.015, gEnd.z + dir.z * 0.015]);
    // Two leather straps tie the sword to the shell: the straps follow the curved surface of the elytra across the blade
    for (const s of [0.28, 0.72]) {
      const t0 = lerp(0.1, 0.66, s);
      const th0 = lerp(0.75, -0.62, s);
      const band = thickSheet(10, 2, (u, v) => {
        const th = th0 + (u - 0.5) * 0.7;
        const t = t0 + (v - 0.5) * 0.05 + (u - 0.5) * 0.04;
        const bump = Math.max(0, 1 - Math.abs(u - 0.5) * 7);
        return surf(t, th, EL_OFF + 0.022 + 0.025 * bump ** 0.7);
      }, () => 0.012, { E: 2, outward: axisOut, color: () => col(0x7a4a2a) });
      add(body, band, M.wood);
    }
  }

  // ── Legs: the middle and hind legs brace on the ground, the right front leg is held at the chest, and the left front leg grips the shield ──
  const cLeg = col(0x4a3430);
  const legGeo = (pts: THREE.Vector3[], r0: number, r1: number) => tint(loft(pts, (t) => [lerp(r0, r1, t), lerp(r0, r1, t)], { segs: 8, radial: 8 }), cLeg);
  const knee = (p: THREE.Vector3, r: number) => add(body, tint(new THREE.SphereGeometry(r, 10, 8), cLeg), M.chitin, [p.x, p.y, p.z]);
  const leg = (a: THREE.Vector3, k: THREE.Vector3, f: THREE.Vector3, pad = true) => {
    add(body, legGeo([a, a.clone().lerp(k, 0.5), k], 0.046, 0.036), M.chitin);
    knee(k, 0.043);
    add(body, legGeo([k, k.clone().lerp(f, 0.5), f], 0.036, 0.026), M.chitin);
    if (pad) add(body, tint(new THREE.SphereGeometry(1, 10, 8), 0x2e2220), M.chitin, [f.x, f.y, f.z], [0, 0, 0], [0.034, 0.022, 0.04]);
  };
  for (const sx of [-1, 1]) {
    leg(surf(0.45, sx * (PI - 0.85)), v3(sx * 0.4, 0.34, 0.08), v3(sx * 0.44, 0.022, 0.16));
    leg(surf(0.22, sx * (PI - 0.95)), v3(sx * 0.36, 0.22, -0.16), v3(sx * 0.37, 0.022, -0.04));
  }
  // Right front leg (-x): planted on the hip with the elbow out (a stance copying its master's air)
  leg(surf(0.74, -(PI - 0.8)), v3(-0.4, 0.6, 0.1), v3(-0.27, 0.43, 0.12));
  // ── Shield: a steel-colored kite shield with a copper edging and a red-iron flame mark in the center (the crest of Rediron Keep); two scratches on the shield face from blows it has blocked ──
  const shieldG = group(body, [0.3, 0.44, 0.27], [-0.06, 0.5, 0.04]);
  {
    const D = 0.026;
    add(shieldG, tint(slab(outline(heaterPts(0.94)), D, 0.008, 6), cSteel), M.shell);
    const rim = new THREE.Shape(heaterPts(1.0).map(([x, y]) => new THREE.Vector2(x, y)));
    rim.holes.push(new THREE.Path(heaterPts(0.86).reverse().map(([x, y]) => new THREE.Vector2(x, y))));
    add(shieldG, tint(slab(rim, D + 0.014, 0.006, 6), cBrass), M.shell);
    const flame = new THREE.Shape();
    flame.moveTo(0, 0.13);
    flame.quadraticCurveTo(0.03, 0.06, 0.07, 0.03);
    flame.quadraticCurveTo(0.09, -0.06, 0, -0.1);
    flame.quadraticCurveTo(-0.09, -0.06, -0.07, 0.03);
    flame.quadraticCurveTo(-0.045, 0.02, -0.035, 0.07);
    flame.quadraticCurveTo(-0.01, 0.05, 0, 0.13);
    add(shieldG, tint(slab(flame, 0.012, 0.004, 5), cRed), M.shell, [0, 0.0, D / 2 + 0.006]);
    for (const [x, y, a] of [[-0.09, -0.05, 0.6], [0.06, 0.11, -0.3]] as [number, number, number][])
      add(shieldG, tint(rbox(0.07, 0.008, 0.01, 0.003, 1), 0x6a707a), M.shell, [x, y, D / 2 + 0.006], [0, 0, a]);
  }
  shieldG.updateMatrixWorld(true);
  const grip = new THREE.Vector3(0.0, 0.03, -0.03).applyMatrix4(shieldG.matrix);
  leg(surf(0.74, PI - 0.8), v3(0.34, 0.6, 0.12), grip, false);
  add(body, tint(new THREE.SphereGeometry(0.03, 10, 8), 0x2e2220), M.chitin, [grip.x, grip.y, grip.z]);

  // ── Head: at the very top of the body, wearing a red-iron helmet, with a horn on top curving back like a helmet crest ──
  const HC = v3(0, 0.9, 0.12);
  const HR = 0.15;
  const headG = group(body, [HC.x, HC.y, HC.z]);
  // The head is the carapace: a dark red-brown glossy head shell, turning slightly redder toward the front lower edge, with no pale face; the small dark compound eyes are on the two sides under the helmet rim
  const cHeadTop = col(0x4e1610);
  const cHeadLow = col(0x8a2c1a);
  add(headG, paint(new THREE.SphereGeometry(HR, 26, 18), (p) => cHeadTop.clone().lerp(cHeadLow, sstep(p.z / HR - 0.4 * p.y / HR, 0.1, 0.8))), M.shell).userData.inkGroup = HEAD;
  const ER = 0.032;
  const eyes = [-1, 1].map((sx) => {
    const d = dirOf(sx * 0.8, 0.14);
    return buildFacetEye(kit, headG, d.clone().multiplyScalar(HR - ER * 0.35), d, { ER, mat: M.ceye, dark: 0x140c0a, warm: 0x4e2c16, seed: 81 + sx });
  });
  // Helmet: a spherical shell, the front edge above the eyes and slanting back to the back of the head, with the edge flaring out slightly and a copper rim
  {
    const geo = thickSheet(40, 10, (u, v) => {
      const ph = u * PI * 2;
      const latB = lerp(0.46, -0.3, (1 - Math.cos(ph)) / 2);
      const lat = lerp(1.42, latB, v);
      const r = HR + 0.02 + 0.018 * sstep(v, 0.7, 1);
      return dirOf(ph, lat).multiplyScalar(r);
    }, (u, v) => 0.026, {
      wrapU: true,
      E: 2,
      outward: (p) => p.clone(),
      color: (u, v, side) => (side < 0 ? cRedDk.clone() : cRed.clone().lerp(cRedDk, 0.25 * (1 - Math.cos(u * PI * 2)) / 2).lerp(cBrass, sstep(v, 0.9, 0.94))),
    });
    add(headG, geo, M.shell);
    // Horn: from the top of the helmet up and then curving back, slightly flat from the side like the plume of a helmet crest
    const p0 = dirOf(0, 1.2).multiplyScalar(HR + 0.01);
    const pts = [p0, p0.clone().add(v3(0, 0.1, 0.03)), p0.clone().add(v3(0, 0.2, 0.0)), p0.clone().add(v3(0, 0.27, -0.07)), p0.clone().add(v3(0, 0.29, -0.15))];
    const horn = loft(pts, (t) => [0.03 * (1 - t) + 0.006, 0.05 * (1 - t) ** 0.9 + 0.007], { segs: 18, radial: 10, side: X });
    add(headG, paint(horn, (p) => cRed.clone().lerp(cRedDk, sstep(p.y - p0.y, 0.15, 0.28))), M.shell);
  }
  const hornTip = group(headG, [0, dirOf(0, 1.2).y * (HR + 0.01) + 0.29, dirOf(0, 1.2).z * (HR + 0.01) - 0.15]);
  // Antennae: two short rod-like antennae under the helmet rim
  for (const sx of [-1, 1]) {
    const b = dirOf(sx * 1.0, 0.36).multiplyScalar(HR * 0.97);
    const e = b.clone().add(v3(sx * 0.08, 0.07, 0.03));
    add(headG, tint(loft([b, b.clone().lerp(e, 0.5).add(v3(0, 0.01, 0)), e], () => [0.011, 0.011], { segs: 6, radial: 6 }), cLeg), M.chitin);
    add(headG, tint(new THREE.SphereGeometry(0.022, 10, 8), 0x6a4a3a), M.chitin, [e.x, e.y, e.z], [0, 0, 0], [1, 1.3, 1]);
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: sitting upright with chest out, rising and falling slightly with breathing, the head slowly looking around (alert) ──
  const act = {};
  const update = (t: number) => {
    const br = Math.sin(t * 1.9);
    body.scale.set(1 + br * 0.008, 1 + br * 0.01, 1 + br * 0.008);
    body.rotation.z = Math.sin(t * 0.7) * 0.012;
    headG.rotation.set(-0.04 + Math.sin(t * 0.5 + 1) * 0.03, Math.sin(t * 0.43) * 0.16, Math.sin(t * 0.6) * 0.03);
  };
  update(0);

  const face = group(headG, [0, Math.sin(0.0) * HR, HR]);
  const mouthA = group(headG, [0, -0.1, HR * 0.9]);
  const shieldA = group(shieldG, [0, 0, 0.04]);
  const rig = { head: face, eyes: eyes.map((e) => e.anchor), anchors: { mouth: mouthA, shield: shieldA, hornTip } };
  mergeStatic(root, {
    owners: [body, headG],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.55, 0), radius: 0.78 };
}
