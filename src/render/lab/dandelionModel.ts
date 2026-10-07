// Dandelion, the Thousand-Down Crown (model lab version): a dandelion spirit on the Azurehowl Plateau that sends its seeds all over the continent at the first breath of wind.
// The Wingfolk's messengers say that if you see an especially white dandelion far away, it is greeting you on someone's behalf.
// Identifying features settled on (from the name, the wind and nature elements, and the role of skirmishing and seed-sowing traps):
// - Three white pappus balls on its head: the name is "Crown", with a big one in the middle and a small one on each side, the silhouette a three-pointed crown; the seeds that scatter at a breath of wind are its weapon.
// - A yellow dandelion flower in front of the crown: the only warm accent on the whole body, like the gem of the crown, and it also lets you recognize a dandelion at a glance.
// - A green bud body: seven bracts wrap the body, with the two at the front parting to either side in the upper half to show a V-shaped streak of white fluff inside (the seeds stuffed in the bud),
//   the tip of the V pointing up at the yellow flower in front of the crown; a plant has no face, so no eyes, mouth or blush are added. The back is a green bud with split petals.
// - Dandelion leaves with barbed lobes: two serve as hands and a ring as a leaf skirt; a short length of root below the body, the whole plant floating in midair (going where the wind goes).
// - Drifting seeds and a blue ribbon: two pale seeds drift at the upper right behind the big fluff ball; a Wingfolk messenger's blue ribbon (the color of wind) is tied to the flower stalk.
// Personality: a grinning little messenger of the wind: waves and says hello to everyone, turns around and sows seeds in their yard, and slips away as soon as the wind comes.
// Personality comes from posture and motion: the body tilts to one side, one leaf is raised in a wave, and the fluff balls sway with the wind.
// Gaze order: the yellow flower in front of the crown (the flower heart, the only warm color on the body) and the three-pointed fluff crown on its head first, the V-shaped white fluff showing between the bracts second, and the leaves, leaf skirt and root as support.
// Back: a green bud wrapped by five bracts; a blue ribbon is tied on the central flower stalk with the knot on the back and the two ribbon tails drifting back with the wind;
// two seeds have already drifted off the big fluff ball, flying to the upper right behind (it sends people's greetings far away).
// How it is made:
// - Fluff ball: the tuft tips are grid points of a subdivided regular icosahedron, with a few further subdivisions between grid points as the cross-section of each tuft tip, so the outer edge of the silhouette is a ring of pointed bristles; the normals are blended toward the sphere normal,
//   so inside there is only soft shading and not a mass of lines (pitfalls 20, 50). The pappus parachutes are only an accent on the two drifting seeds.
// - Leaf: one whole leaf with thickness, the outer edge cut into lobes that barb backward toward the leaf stalk, the midrib raised on the back and a pale stripe on the front; both edges curl upward.
// - Bracts: shells floating against the sphere, the edges sinking into the body, with the outline falling on the edges; the two at the front are the top layer, parting in the upper half to show the white fluff.
// - Hand leaves: long and narrow, with a row of small barbs on each side and a round-headed leaf tip; a short leaf body with a big triangular leaf tip would read as an arrowhead (pitfall 64).
// - Fluff ball: the base color leans slightly cool, and the brightest step is pressed down to 0.96, so the lit side does not blow out to white and the yellow flower wins the first glance.
// Restrained light effects: no emissive, no halo and no glints. The face count is kept within N's budget (25,000): the parts all use low-segment geometry of their own computation.
// <Action table>
// - Idle: floats up and down with the wind and sways lightly left and right, the raised leaf waves twice now and then, the fluff balls sway half a beat behind, and the whole plant slowly turns; the drifting seeds slowly drift backward.
// - Move: as if pushed along by the wind, the body leans forward, the leaf skirt and ribbon tails drag behind, and the fluff balls tilt back.
// - Charge-up (act.charge): the two leaves hug in around the body and the body shrinks, and the three fluff balls swell.
// - Strike (act.blow): the body nods forward a little, and the fluff balls tilt forward to blow the seeds out (fluff shot and seed sowing are emitted from the crown anchor).
// - Hit: the whole plant is blown askew, the fluff balls whip back and drop two seeds, and then spring right back.
// - Victory: turns a full circle in place, both leaves raised to wave hello.
// Anchors: head (the flower heart of the yellow flower in front of the crown), eyes (empty array: no eyes), mouth (the upper end of the V-shaped white fluff), crown (center of the big fluff ball), crownTop (top of the big fluff ball), puffL / puffR (centers of the small fluff balls on the sides), flower (yellow flower),
// leafL / leafR (leaf tips of the two hand leaves), root (root tip), ribbon (ribbon knot).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rng, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon, rampTexture } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
/** Convert latitude and longitude (centered on +z, longitude positive toward +x) to a unit direction */
const sph = (lon: number, lat: number) => v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));

// ───────────────────────── Helpers ─────────────────────────

/** Apply vertex colors by vertex position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
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

/** Make the object's y axis point along yDir and its z axis face zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Winding check: the normal of the i-th vertex must face want, and if reversed all triangles are flipped */
function faceOut(g: THREE.BufferGeometry, i: number, want: THREE.Vector3): void {
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, i);
  if (nrm.dot(want) >= 0) return;
  const idx = g.index!.array as Uint32Array | Uint16Array;
  for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  g.index!.needsUpdate = true;
  g.computeVertexNormals();
}

/** Index of a ring grid: rows+1 rows, each row with J vertices around once */
function ringIndex(rows: number, J: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < J; j++) {
      const a = i * J + j;
      const a1 = i * J + ((j + 1) % J);
      idx.push(a, a + J, a1, a + J, a1 + J, a1);
    }
  return idx;
}

/**
 * A ring of fur or petals joined together (the same as shapes' furCollar), with two extra face-count parameters: perTuft columns per tuft and segS segments along the fur length.
 * When placed, y aligns to the direction the fur roots point (opposite to the fur flow), and z aligns to θ = 0.
 */
function collarGeo(o: FurCollarOpts & { perTuft?: number; segS?: number }): THREE.BufferGeometry {
  const a0 = o.a0 ?? -PI;
  const a1 = o.a1 ?? PI;
  const span = a1 - a0;
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * (o.perTuft ?? 6)));
  const segS = o.segS ?? 5;
  const rand = rng(o.seed ?? 11);
  const var_ = Array.from({ length: Math.ceil(o.tufts) + 2 }, () => 1 + (rand() - 0.5) * 2 * (o.jitter ?? 0.12));
  const notch = o.notch ?? 0.45;
  const curl = o.curl ?? 0.5;
  const groove = o.groove ?? 0.35;
  const phase = o.phase ?? 0;
  const cols = full ? nT : nT + 1;
  const J = segS * 2 + 1;
  const pos: number[] = [];
  const colr: number[] = [];
  const tRoot = new THREE.Color(o.tint?.[0] ?? 0xffffff);
  const tTip = new THREE.Color(o.tint?.[1] ?? 0xffffff);
  const tAt = o.tint?.[2] ?? 2;
  const rise = o.rise ?? 0;
  const tc = new THREE.Color();
  const cr: number[] = [];
  const ca: number[] = [];
  const nr: number[] = [];
  const na: number[] = [];
  for (let i = 0; i < cols; i++) {
    const th = a0 + (span * i) / nT;
    const u = (i / nT) * o.tufts + phase;
    const w = u - Math.floor(u);
    const c = 1 - Math.abs(2 * w - 1);
    const vi = Math.floor(u) % var_.length;
    const e = full ? 1 : Math.min(1, (i / nT) * o.tufts * 2, ((nT - i) / nT) * o.tufts * 2);
    const L = o.len * var_[vi] * (1 - notch + notch * Math.pow(c, 0.75)) * (0.55 + 0.45 * e) * (1 + (o.bias ?? 0) * Math.cos(th));
    cr.length = ca.length = nr.length = na.length = 0;
    let r = o.r0;
    let a = 0;
    for (let k = 0; k <= segS; k++) {
      const sK = k / segS;
      const phi = o.flare - curl * sK * sK;
      cr.push(r);
      ca.push(a);
      nr.push(Math.cos(phi));
      na.push(Math.sin(phi));
      const ph2 = o.flare - curl * ((k + 0.5) / segS) ** 2;
      r += Math.sin(ph2) * (L / segS);
      a -= Math.cos(ph2) * (L / segS);
    }
    const push = (k: number, off: number) => {
      const sK = k / segS;
      const rr = cr[k] + nr[k] * off;
      const aa = ca[k] + na[k] * off;
      const t2 = th - rise * Math.sin(th) * sK * sK;
      pos.push(Math.sin(t2) * rr, aa, Math.cos(t2) * rr);
      tc.copy(tRoot).lerp(tTip, ss(sK, tAt - 0.08, tAt + 0.08));
      colr.push(tc.r, tc.g, tc.b);
    };
    for (let k = 0; k <= segS; k++) {
      const sK = k / segS;
      const h = o.thick * e * Math.pow(1 - sK, 0.7) * (0.6 + 0.4 * Math.min(1, sK * 4));
      push(k, h * 0.62 * (0.8 + 0.2 * c) * (1 - groove * sK * (1 - c)));
    }
    for (let k = segS - 1; k >= 0; k--) {
      const sK = k / segS;
      const h = o.thick * e * Math.pow(1 - sK, 0.7) * (0.6 + 0.4 * Math.min(1, sK * 4));
      push(k, -h * 0.38);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nT; i++) {
    const i2 = full ? (i + 1) % nT : i + 1;
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      const a = i * J + j;
      const b = i2 * J + j;
      const c = i2 * J + j2;
      const d = i * J + j2;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (o.tint) g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mi = Math.floor(cols / 2) * J + Math.floor(segS / 2);
  const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, mi);
  faceOut(g, mi, v(p.x, 0, p.z));
  return g;
}

// ───────────────────────── Pappus ball ─────────────────────────

interface PuffOpts {
  /** Bounding radius of the tuft tips */
  R: number;
  /** Grid points of the tuft tips: the vertices of a regular icosahedron subdivided base times (each edge split into base+1 segments) */
  base: number;
  /** How many further subdivisions between tuft tips: 2 gives the tuft tips plus the valley between each pair, and the silhouette is a ring of sawteeth */
  k: number;
  /** Height of the tuft tips (as a ratio of R): the valley between tuft tips is at R·(1 − tipH) */
  tipH: number;
  /** Exponent of the cross-section (only takes effect when k is greater than 2): below 1 the tuft tips are thin and the valleys wide */
  sharp?: number;
  seed: number;
  /** Ratio of blending the normals toward the sphere normal: the larger it is the softer the inside and the fewer inner lines */
  soft?: number;
}

/**
 * Pappus ball: the tuft tips sit on the grid points of a subdivided regular icosahedron, and the same icosahedron subdivided k times more serves as the mesh, so the tuft tips always land on vertices (and are not shaved flat),
 * with each vertex's radius decided by its angle from the nearest tuft tip, with slight variation in tuft tip heights. The outer edge of the silhouette is a ring of pointed bristles;
 * the normals are almost replaced by sphere normals, so the toon shading and inner lines read as one soft white ball, and it does not outline every little ball separately as a pile of small balls would (pitfalls 20, 50).
 * With the grid points taken dense and k at 2, the tuft tips are fine and numerous, and the face count is low too (1,280 faces for the big fluff ball).
 */
function puffGeo(o: PuffOpts): THREE.BufferGeometry {
  const rand = rng(o.seed);
  const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.seed * 0.37, o.seed * 0.71, o.seed * 0.23));
  const strip = (d: number) => {
    const g = new THREE.IcosahedronGeometry(1, d);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const m = mergeVertices(g, 1e-5);
    m.applyQuaternion(spin);
    return m;
  };
  const tg = strip(o.base);
  const tp = tg.attributes.position as THREE.BufferAttribute;
  const tips: { d: THREE.Vector3; h: number }[] = [];
  for (let i = 0; i < tp.count; i++) tips.push({ d: v(tp.getX(i), tp.getY(i), tp.getZ(i)).normalize(), h: 0.86 + rand() * 0.14 });
  const g = strip((o.base + 1) * o.k - 1);
  const pa = g.attributes.position as THREE.BufferAttribute;
  const n = pa.count;
  const dirs: THREE.Vector3[] = [];
  const near: { a: number; h: number }[] = [];
  let aMax = 0;
  for (let i = 0; i < n; i++) {
    const d = v(pa.getX(i), pa.getY(i), pa.getZ(i)).normalize();
    dirs.push(d);
    let best = 9;
    let h = 1;
    for (const t of tips) {
      const a = d.angleTo(t.d);
      if (a < best) {
        best = a;
        h = t.h;
      }
    }
    near.push({ a: best, h });
    aMax = Math.max(aMax, best);
  }
  const sharp = o.sharp ?? 0.8;
  for (let i = 0; i < n; i++) {
    const d = dirs[i];
    const k = THREE.MathUtils.lerp(near[i].h, 1 - o.tipH, Math.pow(Math.min(1, near[i].a / aMax), sharp));
    pa.setXYZ(i, d.x * o.R * k, d.y * o.R * k, d.z * o.R * k);
  }
  g.computeVertexNormals();
  const soft = o.soft ?? 0.95;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    nn.fromBufferAttribute(na, i).multiplyScalar(1 - soft).addScaledVector(dirs[i], soft).normalize();
    na.setXYZ(i, nn.x, nn.y, nn.z);
  }
  return g;
}

// ───────────────────────── Leaf ─────────────────────────

interface LeafOpts {
  len: number;
  /** Full width at the widest point */
  w: number;
  /** Thickness at the midrib */
  th: number;
  /** Number of lobes on each side */
  lobes: number;
  /** Ratio by which it is pulled in between lobes */
  notch: number;
  /** The amount the outer edge sweeps toward the leaf stalk (as a ratio of leaf length): lobe tips pointing backward is the dandelion's backward pinnate lobing */
  sweep: number;
  /** The amount the leaf tip curls toward the front (+z) */
  bend: number;
  /** The amount both edges curl up toward the front (a V shape along the midrib) */
  fold: number;
  twist?: number;
  /** How far along the leaf length the lobes are distributed (after that is a round-headed leaf tip with no lobes) */
  lobeEnd?: number;
  /** Phase offset of the lobes on the other side */
  phase?: number;
  rows?: number;
  loop?: number;
  /** u along the leaf length 0-1, cx is the lateral position -1 to 1, and top is the front */
  color: (u: number, cx: number, top: boolean) => THREE.Color;
}

/**
 * One dandelion leaf: growing from the origin along +y with the front facing +z. The cross-section is a flat polygon ring (thickest at the midrib, thinning at the edges),
 * long and narrow, with a row of small lobes barbed toward the leaf stalk along each edge, and the leaf tip a round head with no lobes; the leaf stalk and leaf tip both close to 0, so the whole sheet is sealed.
 * The lobes are variations in width, not separate parts. The leaf tip should not be one big triangle: a short leaf body with a big triangular leaf tip reads as an arrow from the front.
 */
function leafGeo(o: LeafOpts): THREE.BufferGeometry {
  const R = o.rows ?? 40;
  const J = o.loop ?? 10;
  // The leaf body slowly widens from the leaf stalk, with the widest point at seventy percent of the leaf length and the leaf tip a blunt rounded triangle
  const E = o.lobeEnd ?? 0.86;
  const tipLen = 1 - E;
  const bodyEnv = curveTable([[0, 0], [0.04, 0.12], [0.14, 0.34], [0.35, 0.68], [0.6, 0.95], [0.72, 1], [E, 0.9]]);
  const env = (u: number) => (u <= E ? bodyEnv(u)[0] : Math.pow(Math.max(0, 1 - Math.pow((u - E) / tipLen, 1.5)), 0.75));
  const win = (u: number) => ss(u, 0.12, 0.2) * (1 - ss(u, E - 0.05, E + 0.02));
  const lobe = (u: number, side: number) => {
    const wv = win(u);
    if (wv <= 0) return 1;
    const p0 = ((u - 0.12) / (E - 0.12)) * o.lobes + (side > 0 ? 0 : o.phase ?? 0.45);
    const p = p0 - Math.floor(p0);
    const TIP = 0.14;
    const m = 1 - o.notch;
    const f = p < TIP ? m + (1 - m) * Math.sin((p / TIP) * PI * 0.5) : 1 - (1 - m) * Math.pow((p - TIP) / (1 - TIP), 0.8);
    return 1 - (1 - f) * wv;
  };
  const pos: number[] = [];
  const cl: number[] = [];
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const Xd = new THREE.Vector3();
  const Zd = new THREE.Vector3();
  const P = new THREE.Vector3();
  for (let i = 0; i <= R; i++) {
    const u = i / R;
    const e = Math.max(0, env(u));
    const wu = win(u);
    C.set(0, o.len * u, o.bend * o.len * u * u);
    T.set(0, o.len, 2 * o.bend * o.len * u).normalize();
    Xd.set(1, 0, 0);
    Zd.crossVectors(Xd, T);
    if (o.twist) {
      Xd.applyAxisAngle(T, o.twist * u);
      Zd.applyAxisAngle(T, o.twist * u);
    }
    const th = o.th * (1 - 0.5 * u) * Math.sqrt(Math.min(1, e / 0.2));
    for (let j = 0; j < J; j++) {
      const phi = (j / J) * PI * 2;
      const cx = Math.cos(phi);
      const sy = Math.sin(phi);
      const hw = o.w * 0.5 * e * lobe(u, cx >= 0 ? 1 : -1);
      const frac = hw / (o.w * 0.5);
      let z = sy * th * 0.5 + o.fold * hw * cx * cx;
      // The midrib is raised on the back
      if (sy < -0.1) z -= 0.8 * th * Math.exp(-((cx / 0.3) ** 2)) * (1 - 0.7 * u);
      // Only the lobed stretch sweeps toward the leaf stalk, and the round-headed leaf tip stays round
      const back = o.sweep * o.len * frac * Math.pow(Math.abs(cx), 1.5) * wu;
      P.copy(C).addScaledVector(Xd, cx * hw).addScaledVector(Zd, z).addScaledVector(T, -back);
      pos.push(P.x, P.y, P.z);
      const c = o.color(u, cx, sy >= 0);
      cl.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(ringIndex(R, J));
  g.computeVertexNormals();
  faceOut(g, Math.floor(R / 2) * J + Math.floor(J / 4), v(0, -o.bend, 1).normalize());
  return g;
}

/** The tail of a ribbon: a flat band along a curve, with its wide direction facing side as far as possible; the end is cut into a V (short in the middle, long at the two corners), and the thickness closes to a knife edge at the end */
function ribbonTail(pts: THREE.Vector3[], side: THREE.Vector3, w: number, th: number, notch: number, rows = 14, J = 8): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const pos: number[] = [];
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    const u = i / rows;
    for (let j = 0; j < J; j++) {
      const phi = (j / J) * PI * 2;
      const cx = Math.cos(phi);
      const sy = Math.sin(phi);
      const uu = Math.max(0, u - notch * (1 - Math.abs(cx)) * ss(u, 0.6, 1));
      path.getPointAt(uu, C);
      path.getTangentAt(uu, T);
      W.copy(side).addScaledVector(T, -T.dot(side)).normalize();
      H.crossVectors(W, T).normalize();
      const s0 = ss(u, 0, 0.12);
      const hw = w * 0.5 * (0.4 + 0.6 * s0);
      const ht = th * 0.5 * s0 * (1 - ss(u, 0.9, 1)) + 1e-4;
      pos.push(C.x + W.x * cx * hw + H.x * sy * ht, C.y + W.y * cx * hw + H.y * sy * ht, C.z + W.z * cx * hw + H.z * sy * ht);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ringIndex(rows, J));
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── Bracts ─────────────────────────

/**
 * One bract wrapped on the spherical body: a patch of shell on the sphere, with the midline at longitude c(lat), half width hw(t) (longitude radians), and latitude lat0 to lat1.
 * The shell floats base + th above the sphere, thinning to base toward the edge; the outermost ring sinks into the body, so the edge of the bract is a step against the body.
 * The base of a bract stacked on top is higher than the thickest point of the one under it, so its edge is not poked through by the lower one;
 * the outline falls on the edges, giving layers between the bracts; the tip closes to a point toward the top of the head.
 */
function bractGeo(R: number, c: (lat: number) => number, hw: (t: number) => number, lat0: number, lat1: number, base: number, th: number, color: (u: number, t: number) => THREE.Color, NR = 16, NC = 8): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  const rows = NR + 3;
  const cols = NC + 3;
  for (let ii = 0; ii < rows; ii++)
    for (let jj = 0; jj < cols; jj++) {
      const wall = ii === 0 || ii === rows - 1 || jj === 0 || jj === cols - 1;
      const i = THREE.MathUtils.clamp(ii - 1, 0, NR);
      const j = THREE.MathUtils.clamp(jj - 1, 0, NC);
      const t = i / NR;
      const u = (2 * j) / NC - 1;
      const lat = lat0 + (lat1 - lat0) * t;
      const d = sph(c(lat) + u * hw(t), lat);
      const fade = Math.min(1, (1 - Math.abs(u)) * 5, t * 7, (1 - t) * 3);
      const off = wall ? -0.006 : base + th * (0.45 + 0.55 * Math.sqrt(Math.max(0, fade)));
      const p = d.multiplyScalar(R + off);
      pos.push(p.x, p.y, p.z);
      const cc = color(u, t);
      cl.push(cc.r, cc.g, cc.b);
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      idx.push(a, a + cols, a + 1, a + cols, a + cols + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mid = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  faceOut(g, mid, new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, mid));
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildDandelionLab(): LabModel {
  const RIMC = 0xeaffd6;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  // The white fluff showing between the bracts uses shading with a lower threshold: the key light comes from the upper right, so most of the V-shaped fluff falls on the lit side and is not cut apart by the light/shadow boundary (pitfall 40)
  const faceRamp = rampTexture([[-1, 0.52], [-0.28, 0.8], [0.3, 1]]);
  // Fluff ball: the dark side is still bright (like a mass of light-transmitting white fluff), but the brightest step is pressed down to 0.96 and the base color leans slightly cool,
  // so the lit side does not blow out to white, and the first glance in a thumbnail falls on the yellow flower
  const puffRamp = rampTexture([[-1, 0.7], [-0.1, 0.85], [0.42, 0.96]]);

  const FLUFF = 0xf2f5e8;
  const M = {
    body: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    bract: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    leaf: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    crown: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    stalk: labToon(0x98cc6a, { rim: 0.45, rimColor: RIMC }),
    puff: labToon(0xe6edf6, { rim: 0.22, rimColor: 0xeaf2ff }),
    pappus: labToon(0xf4f7fb, { rim: 0.2, rimColor: 0xeaf2ff }),
    beak: labToon(0xf0e8d2, { rim: 0.2 }),
    achene: labToon(0xd8c49c, { rim: 0.2 }),
    // Vertex-color version of the achene and the fine beak: mergeStatic uses twins to merge the two into one mesh (mesh budget)
    seed: vc(labToon(0xffffff, { rim: 0.2 })),
    root: labToon(0xe8d5a8, { rim: 0.35, rimColor: 0xfff4dc }),
    flower: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xfff2b8 })),
    ribbon: labToon(0x5aaee6, { rim: 0.5, rimColor: 0xd8f0ff }),
    ribbonDk: labToon(0x3f8cc8, { rim: 0.4, rimColor: 0xd8f0ff }),
  };
  for (const [k, m] of Object.entries(M)) m.name = k;
  M.body.gradientMap = faceRamp;
  M.puff.gradientMap = puffRamp;
  M.pappus.gradientMap = puffRamp;

  const root = new THREE.Group();
  root.name = 'dandelion-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const BODY = 9401;
  const CROWN = 9402;
  const FLOWER = 9403;

  const R = 0.3;
  const BY = 0.86;
  // float: floats up and down with the wind and sways left and right; body: slow turning (the whole body is the head); shape: slight breathing scale
  const float = group(root, [0, BY, 0]);
  const body = group(float);
  const shape = group(body);

  // ── Body: inside the bud is a mass of white fluff (the stuffed seeds), pale green in the lower half; seven green bracts wrap it, with the two at the front parting in the upper half to show the V-shaped white fluff ──
  const cFluff = col(FLUFF);
  const cChin = col(0xd4eaac);
  const bodyGeo = paint(new THREE.SphereGeometry(R, 48, 32), (_p, n) => cFluff.clone().lerp(cChin, ss(-n.y, 0.2, 0.7) * 0.85));
  add(shape, bodyGeo, M.body).userData.inkGroup = BODY;
  const cBr = col(0x5ea646);
  const cBrLt = col(0x96cc6a);
  const cBrDk = col(0x3f8636);
  const bractColor = (u: number, t: number) => cBr.clone().lerp(cBrLt, Math.exp(-((u / 0.2) ** 2)) * 0.5 + (1 - ss(t, 0.0, 0.3)) * 0.3).lerp(cBrDk, ss(Math.abs(u), 0.55, 1) * 0.45);
  const bractHw = (W: number) => (t: number) => W * Math.sqrt(ss(t, 0, 0.16)) * (1 - Math.pow(t, 2.2));
  // Midline longitude, half width, lift: the ones at the back are placed first, the ones at the sides stacked on top, and the two at the front are the top layer (the lift must exceed the thickest point of the layer below)
  const bractSpec: [(lat: number) => number, number, number][] = [
    [() => PI, 0.72, 0],
    [() => 2.3, 0.62, 0.011],
    [() => -2.3, 0.62, 0.011],
    [(lat) => 1.42 - 0.3 * ss(lat, 0.2, 1.2), 0.64, 0.022],
    [(lat) => -1.42 + 0.3 * ss(lat, 0.2, 1.2), 0.64, 0.022],
    // The two at the front: joined together at the exact center in the lower half, and parting more and more going up (the bracts get narrower going up), showing the V-shaped white fluff in the middle with the tip pointing at the yellow flower
    [(lat) => 0.5 + 0.12 * ss(lat, 0.1, 1.1), 0.5, 0.034],
    [(lat) => -0.5 - 0.12 * ss(lat, 0.1, 1.1), 0.5, 0.034],
  ];
  for (const [c, W, base] of bractSpec) add(shape, bractGeo(R, c, bractHw(W), -0.95, 1.28, base, 0.01, bractColor), M.bract);

  // ── Hands: two dandelion leaves growing from the two sides of the body; the +x one is raised to wave and the −x one hangs outward ──
  const cLeaf = col(0x5aa444);
  const cLeafDk = col(0x3f8636);
  const cMid = col(0xb8e08a);
  const cUnder = col(0x8cc468);
  const cPet = col(0xa6d27c);
  const leafColor = (u: number, cx: number, top: boolean) => {
    const mid = Math.exp(-((cx / 0.16) ** 2));
    if (!top) return cUnder.clone().lerp(cMid, mid * 0.7).lerp(cPet, 1 - ss(u, 0.06, 0.2));
    return cLeaf.clone().lerp(cLeafDk, ss(Math.abs(cx), 0.55, 1) * 0.55).lerp(cMid, mid * 0.85).lerp(cPet, 1 - ss(u, 0.06, 0.2));
  };
  interface Arm {
    pivot: THREE.Group;
    base: THREE.Euler;
    sx: number;
    tip: THREE.Group;
  }
  const arms: Arm[] = [];
  for (const sx of [-1, 1]) {
    const raised = sx > 0;
    const at = sph(sx * 1.42, -0.04).multiplyScalar(R - 0.04);
    const pivot = group(body, [at.x, at.y, at.z]);
    const grow = raised ? v(0.74, 0.64, 0.22) : v(-0.84, -0.42, 0.26);
    orient(pivot, grow, v(0, 0.15, 1));
    const len = 0.4;
    add(pivot, leafGeo({ len, w: 0.165, th: 0.02, lobes: 5, notch: 0.5, sweep: 0.1, bend: raised ? 0.32 : 0.22, fold: 0.2, twist: raised ? -0.25 : 0.2, phase: 0.5, rows: 64, loop: 10, color: leafColor }), M.leaf);
    const tip = group(pivot, [0, len * 0.97, len * (raised ? 0.3 : 0.2)]);
    arms.push({ pivot, base: pivot.rotation.clone(), sx, tip });
  }

  // ── Leaf skirt: a ring of five leaves under the body, hanging down with the leaf tips curling outward ──
  const skirtAz = [0.55, 1.8, PI, -1.8, -0.55];
  for (let i = 0; i < skirtAz.length; i++) {
    const az = skirtAz[i];
    const out = v(Math.sin(az), 0, Math.cos(az));
    const at = sph(az, -1.02).multiplyScalar(R - 0.05);
    const g = group(body, [at.x, at.y, at.z]);
    orient(g, out.clone().multiplyScalar(0.45).add(v(0, -0.9, 0)), out.clone().multiplyScalar(0.9).add(v(0, 0.45, 0)));
    const len = 0.28 + (i % 2) * 0.03;
    add(g, leafGeo({ len, w: 0.18, th: 0.018, lobes: 4, notch: 0.48, sweep: 0.1, bend: 0.6, fold: 0.18, phase: 0.4 + i * 0.1, rows: 40, loop: 8, color: leafColor }), M.leaf);
  }

  // ── Root: a short length of pale brown taproot hanging below the body, with two thin whiskers ──
  const rootG = group(body, [0, -R * 0.72, 0]);
  const rootPts = [v(0, 0.02, 0), v(0.008, -0.08, 0.004), v(-0.012, -0.16, -0.006), v(0.01, -0.24, -0.018)];
  add(rootG, loft(rootPts, curveTable([[0, 0, 0], [0.08, 0.046, 0.046], [0.4, 0.034, 0.034], [0.8, 0.016, 0.016], [1, 0, 0]]), { segs: 12, radial: 8 }), M.root);
  for (const [a, b, c] of [[v(0.0, -0.09, 0.0), v(0.045, -0.13, 0.012), v(0.07, -0.17, 0.02)], [v(-0.006, -0.14, 0.0), v(-0.04, -0.18, -0.01), v(-0.055, -0.22, -0.01)]] as THREE.Vector3[][])
    add(rootG, loft([a, b, c], curveTable([[0, 0, 0], [0.15, 0.009, 0.009], [0.7, 0.006, 0.006], [1, 0, 0]]), { segs: 6, radial: 5 }), M.root);
  const rootTip = group(rootG, [0.01, -0.24, -0.018]);

  // ── Crown: a ring of green involucre growing upward around the top of the head (seven points), with a notch left directly in front to set the yellow flower in ──
  const crownG = group(body, [0, R * 0.84, 0]);
  const cBract = col(0x4a9a3c);
  const cBractLt = col(0x9ed06a);
  const crownRing = add(crownG, collarGeo({ r0: 0.11, len: 0.17, thick: 0.05, flare: 0.3, curl: -0.5, tufts: 7, notch: 0.75, groove: 0.3, jitter: 0.1, tint: [cBract, cBractLt, 0.55], seed: 5, perTuft: 6, segS: 5 }), M.crown, [0, -0.03, 0]);
  // The y axis points down (roots below, growing upward), θ = 0 faces back, and the notch at θ = ±π is directly in front
  orient(crownRing, v(0, -1, 0), v(0, 0, -1));
  crownRing.userData.inkGroup = CROWN;

  // ── Flower stalk and fluff balls: a thick central stalk holding the big fluff ball, and two stalks curving outward on the sides each holding a small fluff ball ──
  const PR = 0.33;
  const PRS = 0.17;
  const CEN = v(0, 0.53, -0.02);
  const stalkProf = (r0: number, r1: number) => curveTable([[0, 0, 0], [0.05, r0, r0], [0.5, (r0 + r1) / 2, (r0 + r1) / 2], [0.94, r1, r1], [1, 0, 0]]);
  const midPivot = group(crownG);
  add(midPivot, loft([v(0, -0.08, 0), v(0, 0.12, -0.005), v(0, 0.32, -0.012), CEN], stalkProf(0.036, 0.026), { segs: 12, radial: 8 }), M.stalk).userData.inkGroup = CROWN;
  const puffMid = group(midPivot, [CEN.x, CEN.y, CEN.z]);
  add(puffMid, puffGeo({ R: PR, base: 3, k: 2, tipH: 0.2, seed: 3 }), M.puff);
  const sides: { pivot: THREE.Group; puff: THREE.Group; base: THREE.Euler }[] = [];
  for (const sx of [-1, 1]) {
    const pivot = group(crownG);
    const end = v(sx * 0.47, 0.32, -0.07);
    add(pivot, loft([v(sx * 0.02, -0.06, 0), v(sx * 0.05, 0.1, -0.02), v(sx * 0.16, 0.22, -0.045), v(sx * 0.34, 0.27, -0.065), end], stalkProf(0.03, 0.021), { segs: 14, radial: 7 }), M.stalk).userData.inkGroup = CROWN;
    const puff = group(pivot, [end.x, end.y, end.z]);
    add(puff, puffGeo({ R: PRS, base: 2, k: 2, tipH: 0.22, seed: sx > 0 ? 7 : 11 }), M.puff);
    sides.push({ pivot, puff, base: pivot.rotation.clone() });
  }

  // ── Yellow flower in front of the crown: three layers of ray florets spreading outward, the outer layer flat and the inner layer standing up, with a deep yellow center ──
  const fDir = v(0, 0.62, 0.78).normalize();
  const fAt = sph(0, 0.92).multiplyScalar(R + 0.006);
  const flowerG = group(body, [fAt.x, fAt.y, fAt.z]);
  orient(flowerG, fDir, v(0, 1, 0));
  const flowerRing = (o: FurCollarOpts, h: number) => {
    const m = add(flowerG, collarGeo({ ...o, perTuft: 3, segS: 3 }), M.flower, [0, h, 0]);
    // The y axis points into the head (the roots), and the petals grow outward and toward the flower's front
    m.rotation.x = PI;
    m.userData.inkGroup = FLOWER;
    return m;
  };
  flowerRing({ r0: 0.016, len: 0.085, thick: 0.016, flare: 1.2, curl: 0.1, tufts: 14, notch: 0.4, groove: 0.3, jitter: 0.08, tint: [0xeea21a, 0xffd83c, 0.35], seed: 21 }, 0.004);
  flowerRing({ r0: 0.012, len: 0.062, thick: 0.015, flare: 0.9, curl: 0.2, tufts: 10, notch: 0.4, phase: 0.5, groove: 0.3, jitter: 0.08, tint: [0xeea21a, 0xffe052, 0.35], seed: 22 }, 0.014);
  flowerRing({ r0: 0.007, len: 0.038, thick: 0.014, flare: 0.45, curl: 0.2, tufts: 7, notch: 0.35, phase: 0.25, groove: 0.3, tint: [0xe0920e, 0xffcc30, 0.4], seed: 23 }, 0.024);
  const flowerA = group(flowerG, [0, 0.03, 0]);

  // ── The Wingfolk messenger's blue ribbon: tied on the central flower stalk, with the knot on the back and the two ribbon tails drifting back and down ──
  const RIB_Y = 0.13;
  const ribbonG = group(midPivot, [0, RIB_Y, -0.006]);
  add(ribbonG, lathe([[0.03, -0.014], [0.037, -0.012], [0.039, 0], [0.037, 0.012], [0.03, 0.014]], 18), M.ribbon);
  const knot = group(ribbonG, [0, 0, -0.04]);
  add(knot, new THREE.SphereGeometry(1, 10, 7), M.ribbonDk, [0, 0, 0], [0, 0, 0], [0.022, 0.018, 0.014]);
  const tails: { g: THREE.Group; ph: number }[] = [];
  for (const [sx, len] of [[1, 1], [-1, 0.8]] as [number, number][]) {
    const g = group(knot);
    const d = v(sx * 0.55, -0.7, -0.45).normalize();
    const pts = [v(0, 0, 0), d.clone().multiplyScalar(0.07 * len).add(v(0, 0.005, -0.01)), d.clone().multiplyScalar(0.14 * len).add(v(sx * 0.01, 0, -0.03)), d.clone().multiplyScalar(0.2 * len).add(v(sx * 0.02, 0.01, -0.05))];
    add(g, ribbonTail(pts, v(sx * 0.7, 0.55, 0), 0.036, 0.008, 0.035), M.ribbon);
    tails.push({ g, ph: sx > 0 ? 0 : 1.7 });
  }

  // ── Drifting seeds: a pale cream achene and fine beak, topped with a white pappus parachute (a shallow canopy plus a ring of radiating fine filaments), at some distance from the fluff ball.
  //    The whole thing is not in the outline layer: with ink lines drawn on them the fine beak and fine filaments would become dark little sticks, looking like worms or spines poking out of the fluff ball ──
  const filaments: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * PI * 2;
    const d = v(Math.cos(a), 0, Math.sin(a));
    const pts = [v(0, 0.004, 0), d.clone().multiplyScalar(0.045).add(v(0, 0.02, 0)), d.clone().multiplyScalar(0.085).add(v(0, 0.03, 0))];
    filaments.push(loft(pts, (t) => [0.0024 * (1 - t) + 0.0008, 0.0024 * (1 - t) + 0.0008], { segs: 3, radial: 4 }));
  }
  const seedGeo = {
    achene: loft([v(0, -0.04, 0), v(0, -0.022, 0), v(0, -0.004, 0)], curveTable([[0, 0, 0], [0.25, 0.0075, 0.0075], [0.7, 0.0065, 0.0065], [1, 0, 0]]), { segs: 6, radial: 6 }),
    beak: loft([v(0, -0.008, 0), v(0, 0.04, 0), v(0, 0.085, 0)], curveTable([[0, 0, 0], [0.1, 0.0026, 0.0026], [0.9, 0.0022, 0.0022], [1, 0, 0]]), { segs: 4, radial: 5 }),
    canopy: lathe([[0.002, -0.002], [0.02, 0.006], [0.042, 0.016], [0.05, 0.021], [0.046, 0.022], [0.02, 0.011], [0.002, 0.005]], 16),
    filaments: mergeGeometries(filaments)!,
  };
  const seeds: { g: THREE.Group; base: THREE.Vector3; ph: number; spin: number }[] = [];
  const seedSpec: [THREE.Vector3, number, THREE.Vector3][] = [
    // The parachute top of the highest one must be lower than the top of the big fluff ball: height normalization takes the top, and if the seed drifts higher than the fluff ball the whole thing (the face included) would be scaled down
    [v(0.66, 1.76, -0.5), 1.25, v(0.35, 1, -0.3)],
    [v(0.86, 1.62, -0.06), 1.1, v(0.45, 1, 0.4)],
  ];
  for (let i = 0; i < seedSpec.length; i++) {
    const [p, s, axis] = seedSpec[i];
    const g = group(root, [p.x, p.y, p.z]);
    const tilt = group(g);
    orient(tilt, axis, v(0, 0, 1));
    tilt.scale.setScalar(s);
    const parts = [add(tilt, seedGeo.achene, M.achene), add(tilt, seedGeo.beak, M.beak), add(tilt, seedGeo.canopy, M.pappus, [0, 0.082, 0]), add(tilt, seedGeo.filaments, M.pappus, [0, 0.082, 0])];
    for (const m of parts) {
      m.layers.disable(INK_LAYER);
      m.castShadow = false;
    }
    seeds.push({ g, base: p.clone(), ph: i * 1.9, spin: 0.4 + i * 0.13 });
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // Anchors (for hooking into the game): all empty groups, following the action
  // No face: head sits at the flower heart of the yellow flower in front of the crown (in a close-up, the fluff crown is above and the bud below), eyes is an empty array (the eye light falls back to head),
  // mouth sits at the upper end of the V-shaped white fluff (effects like blowing and seed sowing come out of the opening in the bracts)
  const mouthP = sph(0, 0.5).multiplyScalar(R + 0.01);
  const rig = {
    head: group(flowerG, [0, 0.02, 0]),
    eyes: [] as THREE.Group[],
    anchors: {
      mouth: group(shape, [mouthP.x, mouthP.y, mouthP.z]),
      crown: group(puffMid),
      crownTop: group(puffMid, [0, PR, 0]),
      puffL: group(sides[0].puff),
      puffR: group(sides[1].puff),
      flower: flowerA,
      leafL: arms[0].tip,
      leafR: arms[1].tip,
      root: rootTip,
      ribbon: knot,
    },
  };
  // Action weights (performances tween these values): charge is charge-up (the leaves hug the body, the fluff balls swell), blow is blowing (nodding forward, the fluff balls tilting forward)
  const act = { charge: 0, blow: 0 };

  // Static parts merged (mesh budget N 40): nodes that move or scale when idle act as owners.
  // The five leaves of the leaf skirt no longer sway individually (±0.05 radians is hardly visible), and are merged into one mesh under the body; the achene and fine beak are merged into one by twins
  mergeStatic(root, {
    owners: [float, body, shape, crownG, midPivot, puffMid, rootG, ...sides.flatMap((x) => [x.pivot, x.puff]), ...arms.map((a) => a.pivot), ...tails.map((x) => x.g), ...seeds.map((x) => x.g)],
    twins: [[M.achene, M.seed], [M.beak, M.seed]],
    rig,
  });

  // ── Idle action: floats up and down with the wind, sways lightly left and right, waves, slowly turns, the fluff balls sway half a beat behind, and the ribbon tails and seeds drift in the wind ──
  const TILT = 0.07;
  const update = (t: number) => {
    const ch = act.charge;
    const bl = act.blow;
    float.position.y = BY + Math.sin(t * 1.2) * 0.022;
    const sway = Math.sin(t * 0.8) * 0.045;
    float.rotation.z = TILT + sway;
    float.rotation.x = Math.sin(t * 0.63) * 0.025 + bl * 0.16;
    body.rotation.y = Math.sin(t * 0.31) * 0.16 + Math.sin(t * 0.9) * 0.02;
    const br = Math.sin(t * 1.6);
    shape.scale.set(1 + br * 0.008 + ch * 0.04, 1 + br * 0.01 - ch * 0.06, 1 + br * 0.008 + ch * 0.04);

    // Crown: follows the sway half a beat behind, and tilts forward when blowing
    crownG.rotation.z = -Math.sin(t * 0.8 - 0.7) * 0.05;
    crownG.rotation.x = Math.sin(t * 0.63 - 0.6) * 0.03 + bl * 0.22;
    midPivot.rotation.z = Math.sin(t * 1.1 - 1.2) * 0.025;
    for (let i = 0; i < sides.length; i++) {
      const s = sides[i];
      s.pivot.rotation.set(s.base.x + Math.sin(t * 1.3 + i * 1.7) * 0.03, s.base.y, s.base.z + Math.sin(t * 0.95 + i * 2.3) * 0.04);
    }
    const pf = 1 + ch * 0.1;
    puffMid.scale.setScalar(pf);
    for (const s of sides) s.puff.scale.setScalar(pf);

    // Hands: the raised one waves twice every 5 seconds; when charging up both hug inward
    for (const a of arms) {
      const ph = (t + (a.sx > 0 ? 0 : 2.5)) % 5;
      const wave = a.sx > 0 && ph < 1.2 ? Math.sin((ph / 1.2) * PI * 4) * Math.sin((ph / 1.2) * PI) * 0.32 : 0;
      a.pivot.rotation.set(a.base.x, a.base.y, a.base.z);
      a.pivot.rotateZ(wave + Math.sin(t * 1.2 + a.sx) * 0.05 - a.sx * ch * 0.9);
      a.pivot.rotateX(ch * 0.5);
    }
    rootG.rotation.z = Math.sin(t * 0.8 - 1.0) * 0.08;
    rootG.rotation.x = Math.sin(t * 0.6 - 0.8) * 0.06;
    for (const tl of tails) tl.g.rotation.set(Math.sin(t * 2.1 + tl.ph) * 0.12, Math.sin(t * 1.7 + tl.ph) * 0.1, 0);
    for (const s of seeds) {
      s.g.position.set(s.base.x + Math.sin(t * 0.5 + s.ph) * 0.03, s.base.y + Math.sin(t * 0.7 + s.ph) * 0.035, s.base.z + Math.cos(t * 0.45 + s.ph) * 0.025);
      s.g.rotation.y = Math.sin(t * s.spin + s.ph) * 0.6;
    }
  };
  update(0);

  return { root, update, center: new THREE.Vector3(0, 1.15, 0), radius: 1.02, rig, act };
}
