// Pyrewing Queen (model lab version, N, fire): moths that gather at night beside lava cracks, whose wing scales burst into flame at a touch; ancient miners used them as lanterns.
// Identifying features: 1. A pair of big wings swept back, plum at the root and burning outward to flame red and orange, with a charred black edge and a ring of bright yellow on the outer rim, and the hind wings carrying a pair of amber eyespots and long flame-shaped tail ribbons hanging down;
// 2. A pair of golden feathery antennae on its head, like a crown; 3. A glowing amber lamp at the tip of the abdomen (the miners' lantern). A big cream-colored fur collar around the neck is the queen's collar.
// Body shape: a moth floating in the air with its body slightly upright; the head and thorax are the same color family and fuzzy, with a tuft of down on top of the head combed back, a pair of dark finely faceted compound eyes on the sides, and the proboscis coiled into a spring; no pale round face, doll eyes or human mouth (<Do not anthropomorphize>).
// Personality: a curious and vain queen of the night who goes straight to any firelight: expressed by head tilting, the antennae trembling lightly and the wings opening and closing. Gaze order: head → the golden crest and the bright yellow wing edges → the tail lamp. Back: an old copper ring on the back of the thorax, the ring the miners hung it by long ago.
// Action table: idle floats in the air swaying lightly, the wings slowly opening and closing, the tail ribbons swaying half a beat behind; charge-up act.spread spreads the wings flat and act.glow brightens the tail lamp; hit folds the wings in and presses the antennae back.
// Anchors: head, eyes, anchors.mouth, lantern (tail lamp), wingTipL / wingTipR (forewing tips, L is its own left +x), antennaL / antennaR (antenna tips).
// Restrained light effects: the emissive is kept only on the tail lamp; the bright yellow of the wing edges is base color and does not glow.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, furCollar, furLock, lathe, loft, mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
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

export function buildPyrewingLab(): LabModel {
  const RIMC = 0xffc48a;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  // Thorax, head, neck fur, antennae, legs and abdomen share one vertex-color material (they can be merged only with the same parameters)
  const soft = vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC }));
  const M = {
    soft,
    wing: vc(labToon(0xffffff, { rim: 0.6, rimColor: 0xffb070 })),
    brass: labToon(0xd9a441, { ramp: 'metal', rim: 0.4, rimColor: RIMC, spec: 0.8, specTh: 0.97 }),
    lamp: labToon(0xffd68a, { ramp: 'gem', rim: 0, emissive: 0xff8a2a, emissiveAmt: 0.7 }),
    // Compound eye: dark fine facets (vertex colors), with only a very faint reflection
    ceye: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.15, rimColor: 0xff9a50, spec: 0.3, specTh: 0.95 })),
    probo: labToon(0x7a2a2a, { rim: 0.3, rimColor: RIMC }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'pyrewing-lab';
  const kit = partKit();
  const { add, group } = kit;
  const HEAD = 9501;
  const body = group(root);

  // ── Thorax: a fuzzy apricot-colored egg, turning charred brown on the lower half; a big cream-colored fur collar around the neck (the queen's collar) ──
  const T = v3(0, 0.8, 0);
  const cApri = col(0xf2b872);
  const cCream = col(0xfff0d6);
  const cEmberBrown = col(0x9a4a2a);
  const cPlum = col(0x4a2238);
  add(body, paint(new THREE.SphereGeometry(1, 22, 16), (p) => cApri.clone().lerp(cEmberBrown, sstep(-p.y, 0.1, 0.9))), M.soft, [T.x, T.y, T.z], [0, 0, 0], [0.15, 0.17, 0.145]);
  {
    const g = group(body, [0, 0.925, 0.012], [0.12, 0, 0]);
    add(g, furCollar({ r0: 0.1, len: 0.16, thick: 0.06, flare: 1.08, tufts: 8, notch: 0.42, curl: 0.25, groove: 0.2, jitter: 0.14, tint: [0xf0bf80, 0xfff3de, 0.45], seed: 7 }), M.soft);
  }
  // An old copper ring on the back: the ring the ancient miners hung it by as a lantern, kept to this day
  {
    const g = group(body, [0, 0.9, -0.152], [-0.35, 0, 0]);
    add(g, new THREE.CylinderGeometry(0.016, 0.02, 0.03, 10), M.brass, [0, 0, -0.005], [PI / 2, 0, 0]);
    add(g, new THREE.TorusGeometry(0.036, 0.009, 6, 18), M.brass, [0, 0.03, -0.026], [0, 0, 0]);
  }

  // ── Abdomen: a segmented abdomen hanging down from the back and underside of the thorax, with a ring of flame orange between the dark plum segments; the tip is a glowing lamp ──
  const abPts = [v3(0, 0.71, -0.05), v3(0, 0.6, -0.12), v3(0, 0.49, -0.165), v3(0, 0.4, -0.172), v3(0, 0.33, -0.15)];
  {
    const base = curveTable([[0, 0.07], [0.12, 0.1], [0.4, 0.1], [0.75, 0.078], [0.93, 0.05], [1, 0.03]]);
    const NS = 5;
    const geo = loft(abPts, (t) => {
      const w = 0.5 + 0.5 * Math.cos(2 * PI * NS * t);
      const r = base(t)[0] * (1 - 0.1 * (1 - w) ** 2);
      return [r, r * 0.95];
    }, { segs: 40, radial: 12 });
    const y0 = abPts[0].y;
    const y1 = abPts[abPts.length - 1].y;
    const cBand = col(0xf06a24);
    add(body, paint(geo, (p) => {
      const t = THREE.MathUtils.clamp((y0 - p.y) / (y0 - y1), 0, 1);
      const w = 0.5 + 0.5 * Math.cos(2 * PI * NS * t);
      return cPlum.clone().lerp(cBand, sstep(-w, -0.25, 0.25) * sstep(t, 0.05, 0.15));
    }), M.soft);
  }
  const lampG = group(body, [abPts[4].x, abPts[4].y + 0.005, abPts[4].z]);
  lampG.quaternion.setFromUnitVectors(UP, abPts[4].clone().sub(abPts[3]).normalize());
  {
    const g = lathe([[0.001, -0.075], [0.028, -0.066], [0.046, -0.042], [0.052, -0.014], [0.046, 0.012], [0.03, 0.026], [0.012, 0.03]], 8).toNonIndexed();
    g.rotateX(PI);
    g.computeVertexNormals();
    add(lampG, g, M.lamp);
  }
  const lampTip = group(lampG, [0, 0.06, 0]);

  // ── Legs: the front legs tucked at the chest (as if holding something) and the middle legs hanging down ──
  const cLeg = col(0x6a3036);
  for (const sx of [-1, 1]) {
    add(body, tint(loft([v3(sx * 0.07, 0.69, 0.1), v3(sx * 0.095, 0.64, 0.14), v3(sx * 0.065, 0.61, 0.16), v3(sx * 0.03, 0.605, 0.15)], (t) => [0.021 - 0.006 * t, 0.021 - 0.006 * t], { segs: 10, radial: 8 }), cLeg), M.soft);
    add(body, tint(loft([v3(sx * 0.11, 0.68, 0.04), v3(sx * 0.15, 0.62, 0.07), v3(sx * 0.15, 0.56, 0.085)], (t) => [0.02 - 0.006 * t, 0.02 - 0.006 * t], { segs: 10, radial: 8 }), cLeg), M.soft);
  }

  // ── Wings: triangular forewings and round hindwings, one group per side beating together. Plum at the root, burning outward to flame red and orange, with a charred black edge and then a ring of bright yellow (the scales that burst into flame at a touch) ──
  const wingGs: THREE.Group[] = [];
  const tailGs: { g: THREE.Group; sx: number }[] = [];
  const tipAnchors: THREE.Object3D[] = [];
  const cRed = col(0xb0321c);
  const cOrange = col(0xf2721c);
  const cBurnt = col(0x3a1616);
  const cYellow = col(0xffc452);
  const cUnder = col(0xc8866a);
  const vsF = [0, 0.14, 0.28, 0.4, 0.5, 0.58, 0.66, 0.73, 0.79, 0.835, 0.865, 0.895, 0.93, 0.965, 1];
  const vmapF = (v: number) => {
    const x = v * (vsF.length - 1);
    const i = Math.min(vsF.length - 2, Math.floor(x));
    return lerp(vsF[i], vsF[i + 1], x - i);
  };
  const RF = curveTable([[0, 0.34], [0.25, 0.45], [0.55, 0.54], [0.85, 0.6], [1, 0.575]]);
  const RH = curveTable([[0, 0.25], [0.3, 0.37], [0.65, 0.42], [1, 0.3]]);
  for (const sx of [-1, 1]) {
    const wg = group(body, [sx * 0.085, 0.835, -0.05], [-0.1, sx * 0.42, 0]);
    wingGs.push(wg);
    /** A point on the wing surface: the fan angle th (0 pointing outward, positive up) and the distance rr from the wing root; the wing curls back slightly into a shallow bowl */
    const wingPt = (th: number, rr: number, R: number, dy = 0, dz = 0) => {
      const f = rr / R;
      return v3(sx * Math.cos(th) * rr, Math.sin(th) * rr + dy, -0.045 * (rr / 0.6) ** 2 - 0.02 * f + dz);
    };
    const paintWing = (f: number, u: number, side: number, edge0: number) => {
      const b = edge0 + 0.05 * Math.sin(u * PI * 5 + 0.6);
      let c = cPlum.clone().lerp(cRed, sstep(f, 0.22, 0.45)).lerp(cOrange, sstep(f, b, b + 0.1));
      c = c.lerp(cBurnt, sstep(f, 0.82, 0.845)).lerp(cYellow, sstep(f, 0.88, 0.905));
      return side > 0 ? c : c.lerp(cUnder, 0.35);
    };
    // Forewing
    const TH0 = -0.42;
    const TH1 = 0.66;
    const fore = thickSheet(18, vsF.length - 1, (u, v) => {
      const th = lerp(TH0, TH1, u);
      const R = RF(u)[0] * (1 + 0.018 * Math.sin(u * PI * 7));
      return wingPt(th, lerp(0.035, 1, vmapF(v)) * R, R);
    }, (u, v) => 0.018 - 0.006 * vmapF(v), { E: 2, outward: () => v3(0, 0, 1), color: (u, v, s) => paintWing(vmapF(v), u, s, 0.55) });
    add(wg, fore, M.wing);
    // Hindwing: slightly behind and lower than the forewing
    const HDY = -0.07;
    const HDZ = -0.03;
    const HT0 = -1.5;
    const HT1 = -0.3;
    const hind = thickSheet(16, vsF.length - 1, (u, v) => {
      const th = lerp(HT0, HT1, u);
      const R = RH(u)[0] * (1 + 0.02 * Math.sin(u * PI * 6));
      return wingPt(th, lerp(0.035, 1, vmapF(v)) * R, R, HDY, HDZ);
    }, (u, v) => 0.017 - 0.005 * vmapF(v), { E: 2, outward: () => v3(0, 0, 1), color: (u, v, s) => paintWing(vmapF(v), u, s, 0.5) });
    add(wg, hind, M.wing);
    // Hindwing eyespot: a dark ring, an amber ring, and a dark pupil center with a small cream reflection, laid on the wing surface
    {
      const uE = 0.5;
      const th = lerp(HT0, HT1, uE);
      const R = RH(uE)[0];
      const rr = R * 0.68;
      const p = wingPt(th, rr, R, HDY, HDZ);
      const h = 1e-3;
      const du = wingPt(th + h, rr, R, HDY, HDZ).sub(wingPt(th - h, rr, R, HDY, HDZ));
      const dv = wingPt(th, rr + h, R, HDY, HDZ).sub(wingPt(th, rr - h, R, HDY, HDZ));
      const n = du.cross(dv).normalize();
      if (n.z < 0) n.negate();
      const eg = group(wg, [p.x + n.x * 0.009, p.y + n.y * 0.009, p.z + n.z * 0.009]);
      eg.quaternion.setFromUnitVectors(UP, n);
      eg.scale.setScalar(1.25);
      const rings: [number, number][] = [[0.001, 0.004], [0.014, 0.004], [0.018, 0.004], [0.03, 0.004], [0.034, 0.004], [0.054, 0.004], [0.058, 0.004], [0.07, 0.003], [0.074, 0.0], [0.074, -0.004]];
      const cD = col(0x241016);
      const cA = col(0xffb640);
      const cC = col(0xfff0c8);
      const disc = paint(lathe(rings.map(([r, y]) => [r, y]), 20), (q) => {
        const r = Math.hypot(q.x - 0.01, q.z - 0.012);
        const r0 = Math.hypot(q.x, q.z);
        if (r < 0.011) return cC;
        return r0 < 0.032 ? cD : r0 < 0.056 ? cA : cD;
      });
      add(eg, disc, M.wing);
    }
    // A long flame-shaped tail ribbon hangs from the hindwing tip: flung outward and then drawn inward, with a bright yellow tip
    {
      const th = -1.28;
      const base = wingPt(th, 0.2, 0.3, HDY, HDZ);
      const tg = group(wg, [base.x, base.y, base.z]);
      tailGs.push({ g: tg, sx });
      const pts = [v3(0, 0, 0), v3(sx * 0.03, -0.13, -0.01), v3(sx * 0.09, -0.25, -0.03), v3(sx * 0.07, -0.37, -0.05), v3(sx * 0.12, -0.47, -0.07)];
      const geo = loft(pts, (t) => {
        const w = t < 0.1 ? 0.035 + 0.25 * t : 0.06 * Math.sin(PI * Math.min(1, t * 0.95 + 0.05)) ** 0.6 * (1 + 0.25 * Math.sin(t * PI * 3));
        return [w, 0.009];
      }, { segs: 26, radial: 8, up: v3(0, 0, 1) });
      add(tg, paint(geo, (q) => cPlum.clone().lerp(cRed, sstep(-q.y, 0.05, 0.16)).lerp(cOrange, sstep(-q.y, 0.2, 0.32)).lerp(cYellow, sstep(-q.y, 0.38, 0.45))), M.wing);
    }
    const TH = TH1;
    const tipR = RF(1)[0];
    const tp = wingPt(TH - 0.04, tipR * 0.96, tipR);
    tipAnchors.push(group(wg, [tp.x, tp.y, tp.z]));
  }

  // ── Head: a fuzzy moth head in the same color family as the thorax (apricot, turning charred brown downward), with a tuft on top combed back;
  // a pair of dark finely faceted compound eyes on the sides and a pair of golden feathery antennae like a crown; no pale round face ──
  const HC = v3(0, 0.99, 0.07);
  const HR = 0.115;
  const headG = group(body, [HC.x, HC.y, HC.z]);
  const cTawny = col(0xc27440);
  add(headG, paint(new THREE.SphereGeometry(HR, 24, 16), (p) => cApri.clone().lerp(cTawny, sstep(-p.y / HR, -0.2, 0.8))), M.soft).userData.inkGroup = HEAD;
  for (const [lon, s] of [[-0.3, 0.8], [0, 1], [0.3, 0.8]] as [number, number][]) {
    const p = dirOf(lon, 0.72).multiplyScalar(HR * 0.9);
    const g = group(headG, [p.x, p.y, p.z], [0.55, lon * 0.8, 0]);
    add(g, tint(furLock(0.1 * s, 0.07 * s, 0.035 * s, 0.35, 10), 0xe8b074), M.soft);
  }
  const antGs: { g: THREE.Group; sx: number }[] = [];
  const antTips: THREE.Object3D[] = [];
  const cGold = col(0xd8963a);
  const cGoldTip = col(0xffd27a);
  for (const sx of [-1, 1]) {
    const b0 = dirOf(sx * 0.3, 0.86).multiplyScalar(HR * 0.93);
    const ag = group(headG, [b0.x, b0.y, b0.z]);
    antGs.push({ g: ag, sx });
    const pts = [v3(0, 0, 0), v3(sx * 0.025, 0.08, 0.012), v3(sx * 0.085, 0.19, 0.0), v3(sx * 0.18, 0.27, -0.05), v3(sx * 0.27, 0.29, -0.13), v3(sx * 0.32, 0.25, -0.2)];
    const geo = loft(pts, (t) => {
      const env = Math.sin(PI * THREE.MathUtils.clamp((t - 0.06) / 0.94, 0, 1)) ** 0.75;
      const w = 0.011 + 0.052 * env * (0.74 + 0.26 * Math.cos(2 * PI * 9 * t));
      return [t > 0.985 ? 0.004 : w, 0.0075];
    }, { segs: 64, radial: 8, up: v3(0, 0, 1) });
    add(ag, paint(geo, (q) => cGold.clone().lerp(cGoldTip, sstep(Math.hypot(q.x, q.y), 0.15, 0.35))), M.soft);
    antTips.push(group(ag, [pts[5].x, pts[5].y, pts[5].z]));
  }

  // Eyes: a pair of dark (nearly black to deep red-brown) compound-eye hemispheres on the sides of the head, finely faceted, with no iris, pupil or white highlight, and no blinking
  const ER = 0.05;
  const eyes = [-1, 1].map((sx) => {
    const d = dirOf(sx * 1.0, 0.05);
    return buildFacetEye(kit, headG, d.clone().multiplyScalar(HR - ER * 0.3), d, { ER, mat: M.ceye, dark: 0x1c0a0c, warm: 0x5e1c12, seed: 71 + sx });
  });
  // Proboscis: coiled into a spring under the face
  {
    const C = v3(0, -0.1, 0.108);
    const sp: THREE.Vector3[] = [];
    for (let i = 0; i <= 26; i++) {
      const s = i / 26;
      const ph = PI / 2 + s * 2.3 * PI;
      const r = 0.034 * (1 - 0.72 * s);
      sp.push(v3(-Math.cos(ph) * r, C.y + Math.sin(ph) * r, C.z + 0.012 * s));
    }
    add(headG, loft(sp, (t) => [0.0085 - 0.002 * t, 0.0085 - 0.002 * t], { segs: 40, radial: 6, up: v3(0, 0, 1) }), M.probo);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: floating in the air and swaying lightly up and down, the wings slowly opening and closing, the tail ribbons swaying half a beat behind like flames, the head tilted as it looks around curiously, the antennae trembling lightly (personality comes from the antennae and posture, not expression) ──
  const act = { glow: 0, spread: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    body.position.y = Math.sin(t * 1.7) * 0.025;
    body.rotation.x = Math.sin(t * 1.7 - 0.8) * 0.025;
    const flap = Math.sin(t * 3.4);
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      wingGs[i].rotation.set(-0.1, sx * (0.42 + 0.14 * flap - act.spread * 0.36), 0);
    }
    for (const tg of tailGs) tg.g.rotation.set(Math.sin(t * 3.4 - 1.2) * 0.12, 0, tg.sx * Math.sin(t * 2.1 - 0.5) * 0.08);
    headG.rotation.set(Math.sin(t * 0.53 + 1) * 0.04, Math.sin(t * 0.45) * 0.12, 0.08 + Math.sin(t * 0.6) * 0.03);
    for (const a of antGs) a.g.rotation.set(Math.sin(t * 1.7 - 0.6) * 0.04, 0, a.sx * Math.sin(t * 2.3 + a.sx) * 0.05);
    // Emissive is written only when the glow weight changes (so when another spirit's ultimate changes this one's uEmissiveAmt it is not overwritten)
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.lamp.emissiveIntensity = 0.7 + act.glow * 0.3;
    }
  };
  update(0);

  const face = group(headG, [0, Math.sin(0.1) * HR, Math.cos(0.1) * HR + 0.02]);
  const mouthA = group(headG, [0, -0.07, HR * 0.93]);
  const rig = {
    head: face,
    eyes: eyes.map((e) => e.anchor),
    anchors: { mouth: mouthA, lantern: lampTip, wingTipR: tipAnchors[0], wingTipL: tipAnchors[1], antennaR: antTips[0], antennaL: antTips[1] },
  };
  mergeStatic(root, {
    owners: [body, headG, lampG, ...wingGs, ...tailGs.map((x) => x.g), ...antGs.map((a) => a.g)],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.82, 0), radius: 0.85 };
}
