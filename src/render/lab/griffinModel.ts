// Holywing Griffin (model lab version): the mount of the Dawnlight Paladins, which recognizes only those who keep their oaths. It is said that when a knight betrays an oath, he wakes the next day to find all his mount's feathers turned gray.
// Only one form (decided by the user, 2026-09-28): the builder takes no breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on, with reasons (from the name, the two elements of light and wind, the riding moves and the lore):
//   1. The front half is a golden eagle: a honey-gold head, neck feathers and breast feathers, with cream cheeks and throat; the feathers of the "Holywing" are proof of the oath, so they must be bright and warm, never gray.
//   2. A big ivory hooked beak with a dark tip: the brightest, highest-contrast patch on the face; above it, pressed under the brow ridge, a pair of small deep-amber raptor eyes.
//   3. Two tufts of ear feathers sweeping back and up from the two sides of the top of the head: the griffin's ears, which in silhouette set it apart at a glance from the eagle (crest feathers in the center) and the pegasus (horse ears).
//   4. An empty riding saddle on the back: a royal-blue saddle cloth with a gold hem, the rising-sun emblem of the Dawnlight embroidered on both sides, a leather saddle, stirrups, and a horn hanging at the front of the saddle;
//      the knight's lance stands in the lance bucket behind the saddle, with a blue swallow-tailed pennon under the lance head. The moves are all "the knight in the saddle, dismounting, blowing the horn to return to the saddle", and the saddle is its signature.
//   5. The back half is a milk-white lion: stout hind legs, round paws, a tuft of golden feathers at the end of the tail. The forelegs are scaled eagle claws and the hind feet are lion paws.
// Body shape follows the lore: a four-legged griffin. High in front and low behind, the chest thrust out (an eagle's breast), the neck arched up, the head held high; both wings rising from the shoulders, half open, the wing surfaces half facing forward,
// wide and round eagle wings with the primaries split apart into fingers (Ignisar is a lion without wings and Luminael has a slender horse body with narrow wings rising in a V; here it is a display posture with wide wings).
// The eagle claw nearer the camera is lifted with the talons curled in, ready to pounce at any moment.
//
// Personality: a proud war mount that recognizes only those who keep their oaths. Fiercely loyal to its master and cold to others; when its master is not in the saddle, it guards the empty saddle itself, head high and chest out, ready to be the first to charge out.
// Expression: the face is made after a raptor's structure, with no human features imposed: small, deep eyes looking level ahead, the brow ridge the same color as the skull, straight and jutting out over the eye (the focus of a stare);
// the beak closed, the seam between the upper and lower beak being the mouth. Pride comes from posture: head high, chest out, the head turning in jerks.
// Gaze order: the head (ivory hooked beak, the eyes under the brow ridge, the two tufts of ear feathers) first, the empty saddle on the back (blue saddle cloth, rising-sun emblem, horn) second, and the raised wings, the lance and pennon and the tail feathers as support.
// The back tells "waiting for its master": the empty saddle, the two hanging stirrups, the lance standing in its bucket and the pennon blown by the wind, the back of the wings with golden coverts joining ivory-white flight feathers and sky-blue wing tips.
// Restrained light effects: no halo or light dots, and no reliance on bloom; only a small point of highlight in the eyes.
//
// <Action table> (act weights, 0-1; all 0 is idle)
//   Idle: stands with head held high, the breathing making the chest rise and fall, both wings half open and opening and closing slightly with the breathing; the head turns in jerks (a raptor's frozen head turns), and every so often looks back at the empty saddle on its back;
//         the ear feathers twitch now and then, the feather tuft at the tail's end sways lightly, the pennon on the lance flutters in the wind; blinks now and then.
//   Move: a trot, the wings half folded against the side of the saddle (half of tuck), the head kept level.
//   Charge-up: the front of the body crouched low, the ear feathers laid back, both wings raised high (crouch + spread).
//   Strike: both wings fold back (tuck) as it dives and pounces, the eagle claws in front.
//   Hit: does not retreat, the head lowered and the wings folding toward the saddle, shielding the empty saddle on its back.
//   Victory: both wings spread out whole (spread), the head thrown back for a long cry (cry), then the wings fold and it stands back in place and looks back at the saddle.
//   focus: stop looking around and look straight ahead. crouch: the front of the body crouched low, the head pressed forward, the ear feathers laid back. spread: both wings raised and spread, the wing surfaces turned straight forward.
//   tuck: both wings folded back against the saddle. cry: beak open (the lower beak opening down), the head thrown back.
// Anchors: head, eyes, mouth (beak tip), saddle (directly above the seat, where the rider sits), horn (the bell of the horn), lance (the lance head), pennon (the end of the pennon),
//       chest, wingL / wingR (wing roots, L being its own left, +x), wingTipL / wingTipR (wing tips), tail (the feather tuft at the end of the tail),
//       talonL / talonR (forefoot claws, L being the raised one).
// Face count: the SR budget is 45,000 faces and 60 meshes. The feather surfaces, fur collars and eyelids all use low-segment versions; the static parts are merged at the end with mergeStatic.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, smooth, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type V3 = [number, number, number];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const C = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Feather surface ─────────────────────────

interface SheetOpts {
  /** The curve the feather roots follow, with s the arc-length position from 0 to 1 */
  root: THREE.Vector3[];
  /** The direction (unit vector) the feather grows outward at s */
  dir: (s: number) => THREE.Vector3;
  /** The length of the feather at s */
  len: (s: number) => number;
  /** The direction of the underside (the thickness runs along it), the other side being the back */
  normal: (s: number) => THREE.Vector3;
  /** s → feather coordinate: an integer is the boundary between two feathers */
  feather: (s: number) => number;
  /** The proportion by which the trailing edge is shortened between feathers */
  notch: (s: number) => number;
  /** This layer's own half thickness (c runs along the feather from 0 at the root to 1 at the tip) */
  thick: (s: number, c: number) => number;
  /** The half thickness of the layer underneath at the same point (d is the distance from the feather root) */
  under?: (s: number, d: number) => number;
  /** The bend of the feather surface: the displacement toward the underside (d is the distance from the feather root) */
  bend?: (s: number, d: number) => number;
  groove?: number;
  /** The feather tip is pointed (give an exponent); if not given it is round-headed */
  pointy?: number;
  rachis?: number;
  /** Vertex color: side = -1 is the back and 1 the underside; w is the lateral position within the feather */
  color?: (s: number, c: number, side: number, w: number) => THREE.ColorRepresentation;
  rows: number;
  cols: number;
}

interface Sheet {
  geo: THREE.BufferGeometry;
  h: (s: number, d: number) => number;
}

/**
 * A feather surface joined into one sheet (Skyreign's featherSheet): along the feather-root curve, each point grows a feather toward dir, the trailing edge cut into individual feather tips,
 * with grooves pressed into the surface between feathers. The whole sheet is one part, and the outline falls only on the edges of the feather tips and the creases of the grooves (pitfall 20).
 */
function featherSheet(o: SheetOpts): Sheet {
  const path = new THREE.CatmullRomCurve3(o.root, false, 'centripetal');
  const R = o.rows;
  const K = o.cols;
  const groove = o.groove ?? 0.3;
  const cs = Array.from({ length: K + 1 }, (_, k) => 1 - Math.pow(1 - k / K, 1.6));
  const J = 2 * K + 2;
  const pos: number[] = [];
  const colr: number[] = [];
  const P = new THREE.Vector3();
  const tc = new THREE.Color();
  const shape = (s: number) => {
    const u = o.feather(s);
    const w = u - Math.floor(u);
    const tip = o.pointy ? Math.pow(1 - Math.abs(2 * w - 1), o.pointy) : Math.sqrt(Math.max(0, 1 - (2 * w - 1) ** 2));
    const L = o.len(s) * (1 - o.notch(s) * (1 - tip));
    const e = ss(s, 0, 0.03) * (1 - ss(s, 0.97, 1));
    return { w, tip, L, e };
  };
  const hAt = (s: number, c: number, w: number, tip: number, L: number, e: number) => {
    if (c >= 1) return 0;
    const own = o.thick(s, c) * (1 - groove * c * (1 - tip)) + (o.rachis ?? 0) * Math.exp(-(((w - 0.5) / 0.1) ** 2)) * (1 - c) * ss(c, 0.05, 0.2);
    const und = o.under ? o.under(s, c * L) : 0;
    return (own + und) * Math.sqrt(Math.max(0, 1 - Math.pow(c, 8))) * e;
  };
  for (let i = 0; i <= R; i++) {
    const s = i / R;
    path.getPointAt(s, P);
    const D = o.dir(s);
    const N = o.normal(s);
    const { w, tip, L, e } = shape(s);
    for (let j = 0; j < J; j++) {
      const jj = j === J - 1 ? 0 : j;
      const k = jj <= K ? jj : 2 * K - jj;
      const c = cs[k];
      const side = jj < K ? -1 : jj > K ? 1 : 0;
      const h = hAt(s, c, w, tip, L, e);
      const b = o.bend ? o.bend(s, c * L) : 0;
      const off = b + side * h;
      pos.push(P.x + D.x * c * L + N.x * off, P.y + D.y * c * L + N.y * off, P.z + D.z * c * L + N.z * off);
      if (o.color) tc.set(o.color(s, c, side === 0 ? 1 : side, w));
      else tc.setRGB(1, 1, 1);
      colr.push(tc.r, tc.g, tc.b);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < R; i++)
    for (let j = 0; j < J - 1; j++) {
      const a = i * J + j;
      const b = a + J;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mi = Math.floor(R / 2) * J + K + Math.floor(K / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, mi);
  if (nrm.dot(o.normal(0.5)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return {
    geo: g,
    h: (s, d) => {
      const { w, tip, L, e } = shape(s);
      return d >= L ? 0 : hAt(s, d / L, w, tip, L, e);
    },
  };
}

/**
 * A low-segment fur collar (furCollar in shapes.ts, with the columns per tuft and the segments along the fur flow turned into parameters): a whole ring of feathers joined together,
 * the trailing edge cut into clumps of pointed tips with grooves pressed in between clumps. For a partial arc the thickness at both ends goes to 0, closing naturally. The color is applied separately with paint.
 */
function lowCollar(o: FurCollarOpts, segS = 6, per = 5): THREE.BufferGeometry {
  const a0 = o.a0 ?? -PI;
  const a1 = o.a1 ?? PI;
  const span = a1 - a0;
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * per));
  const rand = rng(o.seed ?? 11);
  const var_ = Array.from({ length: Math.ceil(o.tufts) + 2 }, () => 1 + (rand() - 0.5) * 2 * (o.jitter ?? 0.12));
  const notch = o.notch ?? 0.45;
  const curl = o.curl ?? 0.5;
  const groove = o.groove ?? 0.35;
  const phase = o.phase ?? 0;
  const cols = full ? nT : nT + 1;
  const J = segS * 2 + 1;
  const pos: number[] = [];
  for (let i = 0; i < cols; i++) {
    const th = a0 + (span * i) / nT;
    const u = (i / nT) * o.tufts + phase;
    const w = u - Math.floor(u);
    const c = 1 - Math.abs(2 * w - 1);
    const vi = Math.floor(u) % var_.length;
    const e = full ? 1 : Math.min(1, (i / nT) * o.tufts * 2, ((nT - i) / nT) * o.tufts * 2);
    const L = o.len * var_[vi] * (1 - notch + notch * Math.pow(c, 0.75)) * (0.55 + 0.45 * e) * (1 + (o.bias ?? 0) * Math.cos(th));
    const cr: number[] = [];
    const ca: number[] = [];
    const nr: number[] = [];
    const na: number[] = [];
    let r = o.r0;
    let a = 0;
    for (let k = 0; k <= segS; k++) {
      const sK = k / segS;
      const ph = o.flare - curl * sK * sK;
      cr.push(r);
      ca.push(a);
      nr.push(Math.cos(ph));
      na.push(Math.sin(ph));
      const ph2 = o.flare - curl * ((k + 0.5) / segS) ** 2;
      r += Math.sin(ph2) * (L / segS);
      a -= Math.cos(ph2) * (L / segS);
    }
    const push = (k: number, off: number) => {
      const rr = cr[k] + nr[k] * off;
      pos.push(Math.sin(th) * rr, ca[k] + na[k] * off, Math.cos(th) * rr);
    };
    const hh = (k: number) => {
      const sK = k / segS;
      return o.thick * e * Math.pow(1 - sK, 0.7) * (0.6 + 0.4 * Math.min(1, sK * 4));
    };
    for (let k = 0; k <= segS; k++) push(k, hh(k) * 0.62 * (0.8 + 0.2 * c) * (1 - groove * (k / segS) * (1 - c)));
    for (let k = segS - 1; k >= 0; k--) push(k, -hh(k) * 0.38);
  }
  const idx: number[] = [];
  for (let i = 0; i < nT; i++) {
    const i2 = full ? (i + 1) % nT : i + 1;
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      idx.push(i * J + j, i2 * J + j, i * J + j2, i2 * J + j, i2 * J + j2, i * J + j2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mi = Math.floor(cols / 2) * J + Math.floor(segS / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, mi);
  const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, mi);
  if (nrm.dot(new THREE.Vector3(p.x, 0, p.z)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Low-segment eyelid shell (lidGeometry in shapes.ts): with +y as the top, covering from the top to a lip angle, the edge a rounded lip */
function lidLow(ri: number, ro: number, lip: number, seg = 18, n = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * lip;
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
  for (let i = n; i >= 0; i--) {
    const a = (i / n) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  return smooth(new THREE.LatheGeometry(prof, seg));
}

/**
 * Eyeball: a sphere with +z as straight ahead, the rings of color (pupil, iris, dark outer ring of the iris) being rings of the lathe directly,
 * with two points at the same angle forming a hard boundary that does not run in a sawtooth along the triangles the way vertex colors would (pitfall 32). The normals are the sphere's normals.
 */
function eyeGeo(r: number, bands0: [number, THREE.ColorRepresentation][], seg = 24): THREE.BufferGeometry {
  // The lathe outline must be laid out from bottom to top (here from back to front) for the faces to face outward
  const bands = [...bands0].reverse();
  const pts = bands.map(([a]) => new THREE.Vector2(Math.max(1e-4, r * Math.sin(a)), r * Math.cos(a)));
  const g = new THREE.LatheGeometry(pts, seg);
  const n = pts.length;
  const col = new Float32Array(g.attributes.position.count * 3);
  const tc = new THREE.Color();
  for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) tc.set(bands[j][1]).toArray(col, (i * n + j) * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.rotateX(PI / 2);
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const q = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    q.fromBufferAttribute(pa, i).normalize();
    na.setXYZ(i, q.x, q.y, q.z);
  }
  return g;
}

/** Apply vertex colors by vertex position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
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

/** One color for the whole piece (for parts that share the vertex-color material) */
const solid = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const k = C(c);
  return paint(g, () => k);
};

/**
 * Normal transfer at a seam (Luminael's blendNormalsInto): at the ring where a part is inserted into the torso, the vertex normals lean toward the torso surface's normals,
 * so the shading is continuous with no collar line (pitfall 38). offset is the part's position in the body's coordinates.
 */
function blendNormalsInto(g: THREE.BufferGeometry, surf: THREE.BufferGeometry, d1: number, offset = new THREE.Vector3()) {
  const sp = surf.attributes.position as THREE.BufferAttribute;
  const sn = surf.attributes.normal as THREE.BufferAttribute;
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const nq = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    p.fromBufferAttribute(pa, i).add(offset);
    let best = Infinity;
    let k = 0;
    for (let j = 0; j < sp.count; j++) {
      const dx = sp.getX(j) - p.x;
      const dy = sp.getY(j) - p.y;
      const dz = sp.getZ(j) - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) [best, k] = [d, j];
    }
    q.fromBufferAttribute(sp, k);
    nq.fromBufferAttribute(sn, k);
    const h = p.clone().sub(q).dot(nq);
    const w = 1 - ss(h, 0, d1);
    if (w <= 0) continue;
    n.fromBufferAttribute(na, i).lerp(nq, w).normalize();
    na.setXYZ(i, n.x, n.y, n.z);
  }
  na.needsUpdate = true;
}

/**
 * Cloth with thickness (saddle cloth, saddle skirts): outer(i, j) gives the grid points of the outer surface, stepping back inward along the normal by th for the inner surface, with the four edges closed by narrow strips.
 * The outer surface, inner surface and closing strips each have their own set of vertices, so the edge of the cloth is a clean crease. color gives the color at each grid point (the material enables vertexColors).
 */
function shellGeo(ni: number, nj: number, outer: (i: number, j: number) => THREE.Vector3, th: number, color?: (i: number, j: number) => THREE.Color): THREE.BufferGeometry {
  const O: THREE.Vector3[] = [];
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) O.push(outer(i, j));
  const at = (i: number, j: number) => i * nj + j;
  const quads: number[] = [];
  for (let i = 0; i < ni - 1; i++)
    for (let j = 0; j < nj - 1; j++) quads.push(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
  // Normals of the outer surface (computed once, used to step inward)
  const tmp = new THREE.BufferGeometry().setFromPoints(O);
  tmp.setIndex(quads);
  tmp.computeVertexNormals();
  const N = tmp.attributes.normal as THREE.BufferAttribute;
  const I = O.map((p, k) => p.clone().addScaledVector(new THREE.Vector3().fromBufferAttribute(N, k), -th));
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const cAt = (k: number) => (color ? color(Math.floor(k / nj), k % nj) : C(0xffffff));
  const base = (pts: THREE.Vector3[], ks: number[]) => {
    const b = pos.length / 3;
    ks.forEach((k) => {
      pos.push(pts[k].x, pts[k].y, pts[k].z);
      const c = cAt(k);
      col.push(c.r, c.g, c.b);
    });
    return b;
  };
  const all = O.map((_, k) => k);
  const bo = base(O, all);
  for (const q of quads) idx.push(bo + q);
  const bi = base(I, all);
  for (let k = 0; k < quads.length; k += 3) idx.push(bi + quads[k], bi + quads[k + 2], bi + quads[k + 1]);
  // Closing strips on the four edges
  const edges: number[][] = [
    Array.from({ length: nj }, (_, j) => at(0, j)),
    Array.from({ length: ni }, (_, i) => at(i, nj - 1)),
    Array.from({ length: nj }, (_, j) => at(ni - 1, nj - 1 - j)),
    Array.from({ length: ni }, (_, i) => at(ni - 1 - i, 0)),
  ];
  for (const e of edges) {
    const so = base(O, e);
    const si = base(I, e);
    for (let k = 0; k < e.length - 1; k++) idx.push(so + k, si + k, so + k + 1, si + k, si + k + 1, so + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding: the normal of the middle cell of the outer surface must face outward (opposite to stepping inward from the grid center), and if reversed the whole thing is flipped
  const mid = at(Math.floor(ni / 2), Math.floor(nj / 2));
  const nn = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, bo + mid);
  const want = O[mid].clone().sub(I[mid]);
  if (nn.dot(want) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}


// ───────────────────────── Shape ─────────────────────────

export function buildGriffinLab(): LabModel {
  const RIMC = 0xffe6b4;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  // Palette: a honey-gold eagle, a milk-white lion, ivory beak, sky-blue wing tips; the saddle cloth royal blue and the hem gold
  const GOLD = 0xe9b455;
  const GOLD_D = 0xc98a33;
  const AMBER = 0xa85f22;
  const CREAMG = 0xf9e7bf;
  const CREAM = 0xf3e6d0;
  const CREAM_D = 0xe0cbab;
  const IVORY = 0xfff6e4;
  const SLATE = 0x3a3954;
  const SKY = 0x86bff0;
  const SCALE = 0xefcd78;
  const ROYAL = 0x2c4da6;
  const HEM = 0xeab646;
  const M = {
    plume: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    beak: vc(labToon(0xffffff, { spec: 0.8, specTh: 0.975, rim: 0.4, rimColor: RIMC })),
    talon: labToon(0x2e2a38, { spec: 0.9, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    eye: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    cloth: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xbcd6ff })),
    leather: labToon(0x7c4830, { spec: 0.5, specTh: 0.985, rim: 0.4, rimColor: RIMC }),
    gold: labToon(0xe8b64a, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6, rimColor: 0xffe6b0 }),
    ivory: labToon(IVORY, { rim: 0.5, rimColor: RIMC }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  M.cloth.side = THREE.DoubleSide;
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'griffin-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const BODY = 9701;
  const HEAD = 9702;
  const BEAK = 9703;
  const WING_L = 9704;
  const WING_R = 9705;
  const TAIL = 9706;
  const SHANK = 9707;

  /** Place a ring of feathers: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal; the color is computed in the collar's own coordinates (+z is the side of θ = 0) */
  const collar = (parent: THREE.Object3D, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup: number | undefined, color: (p: THREE.Vector3) => THREE.Color, segS = 6, per = 5) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, paint(lowCollar(o, segS, per), (p) => color(p)), M.plume);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };

  // ── Skeleton: place moves the whole animal onto the pivot; body handles breathing and crouching; the four feet hang on place, so they stand firmly on the ground ──
  const place = group(root);
  const body = group(place);

  // ── Torso: one whole loft from the rump to the chest; high in front and low behind, the chest deep (the eagle's keel breast), the waist narrow and the rump round.
  //    The front half is golden feathers (cream on the chest) and the back half milk-white lion fur, the boundary hidden under the neck-feather mantle and the saddle cloth ──
  const torsoPts = [v(0, 0.72, -0.56), v(0, 0.76, -0.42), v(0, 0.74, -0.18), v(0, 0.77, 0.05), v(0, 0.84, 0.26), v(0, 0.9, 0.42)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.03, 0.13, 0.14, 0],
    [0.1, 0.2, 0.21, 0],
    [0.2, 0.21, 0.22, 0],
    [0.4, 0.18, 0.19, 0],
    [0.6, 0.195, 0.22, -0.02],
    [0.78, 0.21, 0.245, -0.05],
    [0.9, 0.19, 0.225, -0.05],
    [0.97, 0.13, 0.16, -0.03],
    [1, 0, 0, 0],
  ]);
  const torsoGeo = loft(torsoPts, torsoProf, { segs: 44, radial: 26 });
  const eagleCol = (n: THREE.Vector3) => C(GOLD).lerp(C(CREAMG), ss(-n.y * 0.8 + n.z * 0.6, 0.05, 0.55));
  const lionCol = (n: THREE.Vector3) => C(CREAM).lerp(C(CREAM_D), ss(n.y, 0.35, 0.95));
  paint(torsoGeo, (p, n) => lionCol(n).lerp(eagleCol(n), ss(p.z, 0.0, 0.14)));
  const torso = add(body, torsoGeo, M.plume);
  torso.userData.inkGroup = BODY;
  const torsoPath = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal');
  /** The cross-section of the torso at t: the same as loft, with W toward -x and H up */
  const tFrame = (t: number) => {
    const P = torsoPath.getPointAt(t);
    const T = torsoPath.getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, UP).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [a, b, dy] = torsoProf(t);
    return { P, W, H, a, b, dy };
  };
  const tAtZ = (z: number) => {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 30; k++) {
      const m = (lo + hi) / 2;
      if (torsoPath.getPointAt(m).z < z) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  /** Torso surface: at z, turning phi from the spine toward the sx side (0 the spine, PI/2 the widest point), floating lift outward */
  const onTorso = (z: number, phi: number, sx: number, lift = 0) => {
    const f = tFrame(tAtZ(z));
    return f.P.clone().addScaledVector(f.W, -sx * Math.sin(phi) * (f.a + lift)).addScaledVector(f.H, Math.cos(phi) * (f.b + lift) + f.dy);
  };

  // ── Forelegs (eagle): thick thighs wrapped in feathered trousers, below them scaled tarsi, three toes forward and one back, and dark hooked talons. The left forefoot (+x), nearer the camera, is lifted with the talons curled in ──
  const talonAnchors: THREE.Group[] = [];
  const legProfF = curveTable([[0, 0, 0], [0.05, 0.09, 0.11], [0.3, 0.115, 0.125], [0.65, 0.085, 0.09], [0.9, 0.06, 0.062], [1, 0, 0]]);
  const shankProf = curveTable([[0, 0, 0], [0.06, 0.04, 0.042], [0.5, 0.034, 0.036], [0.9, 0.037, 0.039], [1, 0, 0]]);
  /** One toe: reaching out from the center of the foot in the yaw direction, the end a hooked talon curving down; curl makes the toe curl down (the lifted foot) */
  const toe = (parent: THREE.Object3D, yaw: number, len: number, curl: number) => {
    const tg = group(parent, [0, 0, 0], [0, yaw, 0]);
    const d = (u: number) => v(0, -curl * len * u * u, len * u);
    const pts = [d(0), d(0.35).add(v(0, 0.007, 0)), d(0.7), d(1)];
    add(tg, solid(loft(pts, curveTable([[0, 0, 0], [0.1, 0.025, 0.025], [0.45, 0.021, 0.02], [0.72, 0.023, 0.021], [0.95, 0.017, 0.016], [1, 0, 0]]), { segs: 8, radial: 7, side: X }), SCALE), M.plume).userData.inkGroup = SHANK;
    const e = d(1);
    const dn = d(1).sub(d(0.9)).normalize();
    const tp = [e.clone().addScaledVector(dn, -0.005), e.clone().addScaledVector(dn, 0.022).add(v(0, -0.005, 0)), e.clone().addScaledVector(dn, 0.036).add(v(0, -0.024, 0)), e.clone().addScaledVector(dn, 0.033).add(v(0, -0.044, 0))];
    add(tg, loft(tp, (t) => { const k = Math.pow(1 - t, 0.8); return [0.011 * k + 0.0008, 0.013 * k + 0.0008]; }, { segs: 6, radial: 6, side: X }), M.talon);
    return tg;
  };
  for (const sx of [-1, 1]) {
    const up = sx > 0;
    // Feathered trousers: a whole leg of golden feathers under the shoulder, inserted under the chest; below the knee a ring of feathers draping down covers the top of the tarsus
    const thigh = up
      ? [v(sx * 0.11, 0.8, 0.27), v(sx * 0.155, 0.65, 0.4), v(sx * 0.16, 0.56, 0.5)]
      : [v(sx * 0.11, 0.8, 0.26), v(sx * 0.15, 0.56, 0.32), v(sx * 0.155, 0.36, 0.35)];
    const tg = loft(thigh, legProfF, { segs: 16, radial: 14, side: X });
    paint(tg, (_p, n) => C(GOLD).lerp(C(CREAMG), ss(n.z, 0.1, 0.7)));
    blendNormalsInto(tg, torsoGeo, 0.06);
    add(place, tg, M.plume).userData.inkGroup = BODY;
    const knee = thigh[2];
    const shank = up ? [knee.clone(), v(sx * 0.16, 0.47, 0.57), v(sx * 0.16, 0.39, 0.6)] : [knee.clone(), v(sx * 0.155, 0.2, 0.36), v(sx * 0.155, 0.06, 0.37)];
    add(place, solid(loft(shank, shankProf, { segs: 10, radial: 10, side: X }), SCALE), M.plume).userData.inkGroup = SHANK;
    const sT = shank[1].clone().sub(shank[0]).normalize();
    collar(place, { r0: 0.055, len: 0.13, thick: 0.055, flare: 0.5, curl: 0.3, tufts: 6, notch: 0.45, seed: 60 + sx }, knee.clone().addScaledVector(sT, 0.03), sT.clone().negate(), v(0, 0, -1), BODY,
      (p) => C(GOLD).lerp(C(CREAMG), ss(p.y, -0.04, -0.11)));
    // Feet: on the standing one the three toes spread forward gripping the ground and one toe points back; on the lifted one the toes curl down and the talons are tucked
    const footAt = shank[2];
    const foot = group(place, footAt.toArray() as V3);
    if (up) foot.rotation.x = 0.75;
    add(foot, solid(new THREE.SphereGeometry(1, 10, 8), SCALE), M.plume, [0, 0, 0], [0, 0, 0], [0.042, 0.034, 0.046]).userData.inkGroup = SHANK;
    const curl = up ? 1.25 : 0.25;
    for (const [yaw, len] of [[-0.42, 0.115], [0, 0.13], [0.42, 0.115]] as [number, number][]) toe(foot, yaw, len, curl);
    toe(foot, PI, 0.07, up ? 0.8 : 0.3);
    talonAnchors.push(group(foot, [0, -0.02, 0.12]));
  }

  // ── Hind legs (lion): stout thighs, a hock folded backward, round paws and four toes; the claws tucked into the toes ──
  const hindProf = curveTable([[0, 0, 0], [0.03, 0.11, 0.14], [0.1, 0.15, 0.2], [0.22, 0.15, 0.19], [0.42, 0.1, 0.11], [0.6, 0.078, 0.082], [0.78, 0.072, 0.075], [0.93, 0.07, 0.072], [1, 0.055, 0.055]]);
  for (const sx of [-1, 1]) {
    const hp = [v(sx * 0.11, 0.76, -0.42), v(sx * 0.17, 0.44, -0.27), v(sx * 0.17, 0.24, -0.45), v(sx * 0.17, 0.09, -0.43), v(sx * 0.17, 0.055, -0.4)];
    const hg = loft(hp, hindProf, { segs: 26, radial: 14, side: X });
    paint(hg, (_p, n) => lionCol(n));
    blendNormalsInto(hg, torsoGeo, 0.06);
    add(place, hg, M.plume).userData.inkGroup = BODY;
    add(place, solid(new THREE.SphereGeometry(1, 16, 10), CREAM), M.plume, [sx * 0.17, 0.058, -0.35], [0, 0, 0], [0.095, 0.058, 0.11]);
    for (let i = 0; i < 4; i++) {
      const cx = sx * 0.17 + (i - 1.5) * 0.045;
      const cz = -0.26 - Math.abs(i - 1.5) * 0.018;
      add(place, solid(new THREE.SphereGeometry(1, 10, 7), CREAM), M.plume, [cx, 0.038, cz], [0, 0, 0], [0.029, 0.035, 0.033]);
    }
  }

  // ── Neck: arching up from above the chest and joining all the way to the head; the root of the neck is at the pivot of neckG, so when looking around the whole neck turns a little ──
  const NB = v(0, 0.9, 0.28);
  const neckG = group(body, NB.toArray() as V3);
  const neckPts = [v(0, 0.86, 0.24), v(0, 1.01, 0.36), v(0, 1.13, 0.45), v(0, 1.24, 0.5)];
  const neckGeo = loft(neckPts, curveTable([[0, 0, 0, 0], [0.06, 0.17, 0.18, 0], [0.3, 0.145, 0.15, 0], [0.7, 0.12, 0.125, 0], [0.93, 0.11, 0.115, 0], [1, 0, 0, 0]]), { segs: 20, radial: 16, side: X });
  paint(neckGeo, (_p, n) => C(GOLD).lerp(C(CREAMG), ss(n.z, 0.2, 0.7)));
  blendNormalsInto(neckGeo, torsoGeo, 0.06);
  neckGeo.translate(-NB.x, -NB.y, -NB.z);
  add(neckG, neckGeo, M.plume).userData.inkGroup = BODY;
  const neckPath = new THREE.CatmullRomCurve3(neckPts, false, 'centripetal');

  // A ring of feathers at the base of the neck draping down (the feather collar on the chest): golden on the back side and cream on the chest, the tips landing on the chest and shoulders
  {
    const at = neckPath.getPointAt(0.34);
    const T = neckPath.getTangentAt(0.34);
    collar(body, { r0: 0.13, len: 0.28, thick: 0.1, flare: 0.8, curl: 0.45, tufts: 12, notch: 0.5, jitter: 0.14, seed: 5 }, at, T, v(0, 0, -1), BODY,
      (q) => {
        const front = ss(-q.z / Math.max(1e-4, Math.hypot(q.x, q.z)), -0.2, 0.5);
        return C(GOLD).lerp(C(CREAMG), front).lerp(C(GOLD_D), ss(-q.y, 0.18, 0.26) * (1 - front) * 0.8);
      });
  }
  // Breast feathers: another layer of feathers draping down over the chest, so the keel breast is not one whole smooth surface
  collar(body, { r0: 0.14, len: 0.26, thick: 0.08, flare: 0.5, curl: 0.3, tufts: 7, notch: 0.4, jitter: 0.12, a0: -1.5, a1: 1.5, phase: 0.5, seed: 7 },
    v(0, 0.86, 0.36), v(0, 1, 0.25), v(0, 0, 1), BODY, (q) => C(CREAMG).lerp(C(GOLD), ss(Math.abs(q.x), 0.1, 0.2) * 0.6).lerp(C(GOLD), ss(-q.y, 0.2, 0.26) * 0.35));
  // Mantle on the shoulders: a sheet of golden feathers draping back from the base of the neck over the shoulder blades, covering the roots of both wings, so the wings read as growing out of the body; the tips land on the front edge of the saddle cloth
  collar(body, { r0: 0.14, len: 0.3, thick: 0.08, flare: 0.35, curl: 0.2, tufts: 7, notch: 0.45, jitter: 0.12, a0: -2.1, a1: 2.1, seed: 8 },
    neckPath.getPointAt(0.12).add(v(0, 0.02, -0.04)), v(0, 0.55, 1), v(0, 1, -0.3), BODY, (q) => C(GOLD).lerp(C(GOLD_D), ss(-q.y, 0.2, 0.28) * 0.9));

  // ── Head: look handles looking around, and the head's origin is at the center of the skull ──
  const look = group(neckG, [0, 1.2 - NB.y, 0.47 - NB.z]);
  look.rotation.order = 'YXZ';
  const HOFF = v(0, 0.08, 0.06);
  const head = group(look, HOFF.toArray() as V3);
  const HR = 0.168;
  const HS: V3 = [0.9, 0.9, 1.1];
  const hv = (x: number, y: number, z: number) => v(x * HR, y * HR, z * HR);
  // Skull: the top of the head, around the eyes and the back of the head golden, the cheeks below the base of the beak and the throat cream (the pale follows the beak and throat, not a round face patch), the boundary below the eye and drawing back
  const skull = new THREE.SphereGeometry(HR, 34, 22).scale(...HS);
  paint(skull, (p) => {
    const n = p.clone().normalize();
    const face = ss(n.z, -0.35, 0.2) * (1 - ss(n.y, -0.2, 0.0));
    return C(GOLD).lerp(C(GOLD_D), ss(-n.z, 0.2, 0.9) * 0.7).lerp(C(CREAMG), face);
  });
  add(head, skull, M.plume).userData.inkGroup = HEAD;

  // Beak: a big ivory hooked beak with a dark tip; the upper beak goes forward from the cere with the tip hooking down; the lower beak is in jaw and turns down when the mouth opens. The cere is gold, with a nostril on each side
  const hookTip = hv(0, -0.52, 1.44);
  const upper = loft([hv(0, 0.3, 0.7), hv(0, 0.26, 0.98), hv(0, 0.14, 1.26), hv(0, -0.08, 1.46), hv(0, -0.36, 1.5), hv(0, -0.54, 1.42)],
    curveTable([[0, 0, 0], [0.06, 0.34 * HR, 0.3 * HR], [0.3, 0.3 * HR, 0.29 * HR], [0.6, 0.2 * HR, 0.22 * HR], [0.85, 0.1 * HR, 0.12 * HR], [1, 0, 0]]), { segs: 22, radial: 14, side: X });
  add(head, paint(upper, (p) => C(IVORY).lerp(C(SLATE), 1 - ss(p.distanceTo(hookTip), 0.2 * HR, 0.34 * HR))), M.beak).userData.inkGroup = BEAK;
  add(head, solid(loft([hv(0, 0.34, 0.72), hv(0, 0.33, 0.9), hv(0, 0.28, 1.02)], curveTable([[0, 0, 0], [0.15, 0.36 * HR, 0.26 * HR], [0.7, 0.34 * HR, 0.24 * HR], [1, 0, 0]]), { segs: 10, radial: 14, side: X }), GOLD_D), M.beak).userData.inkGroup = BEAK;
  for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(1, 8, 6), M.talon, [sx * 0.2 * HR, 0.36 * HR, 0.92 * HR], [0, sx * 0.5, 0], [0.05 * HR, 0.04 * HR, 0.03 * HR]);
  const jaw = group(head, [0, -0.16 * HR, 0.7 * HR]);
  add(jaw, solid(loft([hv(0, -0.02, 0.06), hv(0, -0.12, 0.34), hv(0, -0.16, 0.58)], curveTable([[0, 0, 0], [0.1, 0.28 * HR, 0.14 * HR], [0.6, 0.2 * HR, 0.11 * HR], [1, 0, 0]]), { segs: 12, radial: 10, side: X }), IVORY), M.beak).userData.inkGroup = BEAK;
  // The seam between the upper and lower beak is the mouth, and no gape drawn turning upward is added (that would be a human smile)

  // Eyes: a raptor's eyes, small and sunk in the socket (about fifteen percent of the head's width in diameter): a deep amber iris, a black pupil taking half, one small point of highlight;
  // above, a brow ridge the same color as the skull juts out and presses down on the eye (a raptor's fierceness and focus come from it, not from eyebrows). No doll eyes: no sclera, no black rim, not big round eyes.
  // The eyelids are normally tucked into the head (they come out only to blink). The eye socket turns outward so the eye can be seen from the side (pitfall 23), and the iris is turned a little forward, so both eyes look forward together (pitfall 43)
  const ER = 0.13 * HR;
  const eyeD = v(0.7, 0.16, 0.7).normalize();
  const surfR = (d: THREE.Vector3) => HR / Math.sqrt((d.x / HS[0]) ** 2 + (d.y / HS[1]) ** 2 + (d.z / HS[2]) ** 2);
  /** Inside the skull (compared with the skull's ellipsoid, margin is the distance kept inward) */
  const inHead = (p: THREE.Vector3, margin = 0) => (p.x / HS[0]) ** 2 + (p.y / HS[1]) ** 2 + (p.z / HS[2]) ** 2 < (HR - margin) ** 2;
  const eyeA: THREE.Group[] = [];
  const lids: { up: THREE.Group; lo: THREE.Group; upOpen: number; loOpen: number }[] = [];
  const his: THREE.Mesh[] = [];
  const RING = 0x6a4020;
  const LID_RO = ER * 1.22;
  // Eyelids: the outer shell is the head's color (gold above, cream below), with a line of dark brown at the lip
  const lidPaint = (g: THREE.BufferGeometry, shell: number) => paint(g, (p) => {
    const a = Math.acos(clamp(p.y / Math.max(p.length(), 1e-6), -1, 1));
    return C(shell).lerp(C(RING), ss(a, PI / 2 * 0.78, PI / 2 * 0.88));
  });
  const lidUp = lidPaint(lidLow(ER * 1.07, LID_RO, PI / 2, 14, 7), GOLD);
  const lidLo = lidPaint(lidLow(ER * 1.05, ER * 1.18, PI / 2, 14, 7), GOLD);
  // The black pupil takes half of what can be seen; the deep amber iris covers the back half of the eyeball, so when it turns forward no other color shows at its rear edge
  const eyeBall = eyeGeo(ER, [
    [0, 0x0e0806], [0.5, 0x0e0806], [0.51, 0xb8741e], [0.8, 0x9a5818], [1.05, 0x6a3812], [1.9, 0x4a2610],
  ], 18);
  const GAZE = 0.35;
  for (const sx of [-1, 1]) {
    const d = v(sx * eyeD.x, eyeD.y, eyeD.z);
    const c = d.clone().multiplyScalar(surfR(d) - 0.58 * ER);
    const eg = group(head, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.78, 0.04, 0.62).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.14]);
    const want = v(0, 0.03, 1).normalize().applyQuaternion(eg.quaternion.clone().multiply(roll.quaternion).invert());
    const gq = new THREE.Quaternion().setFromUnitVectors(FWD, want);
    const ang = 2 * Math.acos(clamp(gq.w, -1, 1));
    const gaze = group(roll);
    gaze.quaternion.copy(new THREE.Quaternion().slerp(gq, Math.min(1, GAZE / Math.max(ang, 1e-4))));
    add(gaze, eyeBall, M.eye).userData.inkGroup = HEAD + 40;
    // Highlight: one small point at the upper left, on the same side for both eyes (under a tenth of the eye in area)
    for (const [x, y, r] of [[-0.3, 0.36, 0.26]] as [number, number, number][]) {
      const hd = v(x, y, 1).normalize();
      const hl = add(gaze, new THREE.SphereGeometry(r * ER, 8, 5), M.hi, [hd.x * ER * 1.01, hd.y * ER * 1.01, hd.z * ER * 1.01], [0, 0, 0], [1, 1, 0.25]);
      hl.quaternion.setFromUnitVectors(FWD, hd);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      his.push(hl);
    }
    eyeA.push(group(gaze, [0, 0, ER]));

    eg.updateMatrix();
    roll.updateMatrix();
    const toHead = eg.matrix.clone().multiply(roll.matrix);
    const fromHead = toHead.clone().invert();

    // Eyelids: when open the whole piece is tucked into the skull (the circle of the lip is entirely inside the skull), and they close from above and below only when blinking
    const lidG = group(roll);
    lidG.quaternion.copy(new THREE.Quaternion().slerp(gaze.quaternion, 0.65));
    lidG.updateMatrix();
    const toHeadLid = toHead.clone().multiply(lidG.matrix);
    const hidden = (rotX: number) => {
      const m = toHeadLid.clone().multiply(new THREE.Matrix4().makeRotationX(rotX));
      for (let i = 0; i < 24; i++) {
        const ph = (i / 24) * PI * 2;
        if (!inHead(v(Math.sin(ph) * LID_RO * 1.05, 0, Math.cos(ph) * LID_RO * 1.05).applyMatrix4(m), 0.001)) return false;
      }
      return true;
    };
    let upOpen = 0.9;
    while (upOpen < 1.7 && !hidden(-upOpen)) upOpen += 0.02;
    let loOpen = 0.8;
    while (loOpen < 1.7 && !hidden(PI + loOpen)) loOpen += 0.02;
    const up = group(lidG, [0, 0, 0], [-upOpen, 0, 0]);
    add(up, lidUp, M.plume).userData.inkGroup = HEAD;
    const lo = group(lidG, [0, 0, 0], [PI + loOpen, 0, 0]);
    add(lo, lidLo, M.plume).userData.inkGroup = HEAD;
    lids.push({ up, lo, upOpen, loOpen });

    // Brow ridge: a bony ridge running back from above the cere along the upper edge of the eye socket, growing against the skull and the same color as the skull (a shape, not the color of an eyebrow);
    // jutting out and pressing down on the upper edge of the eye, low at the front and rising and tapering going back, from the side a straight eave (a raptor's way of staring)
    const bpts: THREE.Vector3[] = [];
    for (let k = 0; k <= 7; k++) {
      const u = k / 7;
      const p = v(sx * ER * (-2.2 + 3.8 * u), ER * (1.05 + 0.3 * Math.min(1, u * 1.6)), ER * (0.9 - 1.1 * u)).applyMatrix4(toHead);
      const dd = p.clone().normalize();
      bpts.push(dd.multiplyScalar(surfR(dd) + 0.003).applyMatrix4(fromHead));
    }
    add(roll, solid(loft(bpts, (tt) => { const k = Math.pow(Math.sin(PI * tt), 0.6) * ss(tt, 0, 0.35); return [0.026 * k, 0.011 * k]; }, { segs: 14, radial: 8 }), GOLD), M.plume).userData.inkGroup = HEAD;
  }

  // Ear feathers: two tufts of pointed feathers sweeping back and up from the two sides of the top of the head (the griffin's ears), golden roots and amber tips; three feathers per tuft, each at a different elevation (pitfall 74)
  const ears: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const E0 = hv(sx * 0.52, 0.52, -0.36);
    const eg = group(head, E0.toArray() as V3);
    const cr = [hv(sx * 0.4, 0.66, -0.22), hv(sx * 0.52, 0.52, -0.36), hv(sx * 0.6, 0.36, -0.5)].map((p) => p.sub(E0));
    const cdir = (s: number) => {
      const el = 0.5 - 0.35 * s;
      return v(sx * (0.28 + 0.22 * s), Math.sin(el), -Math.cos(el)).normalize();
    };
    const tuft = featherSheet({
      root: cr,
      dir: cdir,
      normal: (s) => new THREE.Vector3().crossVectors(cdir(s), X).normalize().negate(),
      len: (s) => 0.25 * (1 - 0.35 * s),
      bend: (_s, d) => 0.9 * d * d,
      pointy: 0.6,
      feather: (s) => s * 3,
      notch: () => 0.6,
      thick: (_s, c) => 0.015 * (0.3 + 0.7 * (1 - c)),
      rows: 30,
      cols: 6,
      color: (_s, c) => C(GOLD).lerp(C(GOLD_D), ss(c, 0.3, 0.55)).lerp(C(AMBER), ss(c, 0.72, 0.86)),
    });
    add(eg, tuft.geo, M.plume).userData.inkGroup = HEAD;
    ears.push({ g: eg, sx });
  }

  // Neck feathers at the back of the head: pointed feathers draping down from the back of the head, covering the junction of head and neck; golden with slightly darker tips
  collar(look, { r0: 0.124, len: 0.26, thick: 0.09, flare: 0.42, curl: 0.4, tufts: 5, notch: 0.55, jitter: 0.12, bias: 0.4, a0: -1.9, a1: 1.9, seed: 12 },
    HOFF.clone().add(v(0, 0.01, -0.07)), v(0, 1, 0.35), v(0, 0, -1), HEAD, (q) => C(GOLD).lerp(C(GOLD_D), ss(-q.y, 0.16, 0.24) * 0.9));

  // ── Wings: rising from the shoulders, half open, the wing surfaces half facing forward; wide and round eagle wings with the primaries split apart into fingers.
  //    Two layers of feather surface joined into one sheet (flight feathers, coverts) plus the wing bone; when modeled the wing surface lies flat in wg's xz plane (the wing bone outward, the feathers backward, the underside down), and the whole group is then turned into the display pose ──
  interface WingRig { sx: number; wg: THREE.Group; tipA: THREE.Group; rootA: THREE.Group }
  const wings: WingRig[] = [];
  const S_W = 0.48;
  const WS = 1.3;
  const flightLen = curveTable([[0, 0.24], [0.25, 0.33], [0.48, 0.38], [0.7, 0.45], [0.86, 0.47], [1, 0.36]]);
  const psi = curveTable([[0, 0.05], [0.4, 0.12], [0.6, 0.35], [0.8, 0.7], [1, 1.05]]);
  const featherU = (s: number) => (s < S_W ? (s / S_W) * 7 : 7 + ((s - S_W) / (1 - S_W)) * 6);
  for (const sx of [-1, 1]) {
    const WG = sx > 0 ? WING_L : WING_R;
    const R0 = v(sx * 0.11, 0.93, 0.17);
    const wg = group(body, R0.toArray() as V3);
    wg.rotation.order = 'YZX';
    const arm = [v(0, 0, 0), v(sx * 0.1, 0.02, 0.012), v(sx * 0.22, 0.035, 0.035), v(sx * 0.34, 0.03, 0.03), v(sx * 0.48, 0.012, -0.005), v(sx * 0.6, 0, -0.05)].map((p) => p.multiplyScalar(WS));
    const dir = (s: number) => {
      const a = psi(s)[0];
      return v(sx * Math.sin(a), 0, -Math.cos(a));
    };
    const N = () => v(0, -1, 0);
    // The bend of the feather surface: the underside slightly concave, the tips of the primaries turned up toward the back
    const bend = (s: number, d: number) => {
      const c = Math.min(1, d / flightLen(s)[0]);
      return -0.03 * Math.sin(PI * c) - 0.07 * c * c * ss(s, 0.5, 1);
    };
    const flight = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0],
      feather: featherU,
      notch: (s) => 0.12 + 0.36 * ss(s, S_W, S_W + 0.14),
      thick: (_s, c) => 0.013 * (0.3 + 0.7 * (1 - c)),
      groove: 0.4,
      rachis: 0.004,
      rows: 64,
      cols: 5,
      color: (s, c, side) => {
        const hand = ss(s, S_W - 0.05, S_W + 0.1);
        if (side < 0) return C(IVORY).lerp(C(SKY), ss(c, 0.72, 0.95) * (0.45 + 0.55 * hand));
        return C(CREAMG).lerp(C(IVORY), ss(c, 0.2, 0.5)).lerp(C(SKY), ss(c, 0.8, 0.98) * 0.6 * hand);
      },
    });
    const coverts = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0] * 0.5,
      feather: (s) => featherU(s) * 1.4 + 0.5,
      notch: () => 0.3,
      thick: (_s, c) => 0.006 + 0.009 * (1 - c),
      under: flight.h,
      groove: 0.4,
      rows: 52,
      cols: 4,
      color: (_s, c, side) => (side < 0 ? C(GOLD).lerp(C(GOLD_D), ss(c, 0.75, 1) * 0.7) : C(CREAMG)),
    });
    const armGeo = solid(loft(arm, curveTable([[0, 0, 0], [0.04, 0.06, 0.06], [0.3, 0.052, 0.046], [0.6, 0.04, 0.035], [0.9, 0.026, 0.023], [1, 0, 0]]), { segs: 24, radial: 10, up: FWD }), GOLD);
    for (const geo of [flight.geo, coverts.geo, armGeo]) add(wg, geo, M.plume).userData.inkGroup = WG;
    const tip = arm[arm.length - 1].clone().addScaledVector(dir(1), flightLen(1)[0] * 0.95);
    wings.push({ sx, wg, tipA: group(wg, tip.toArray() as V3), rootA: group(wg) });
  }

  // ── Tail: a lion's tail, hanging down from the rump and then hooking back and up, a tuft of golden feathers standing up at the end (from behind it is seen from the side, not as a flower, pitfall 55) ──
  const tailG = group(body, [0, 0.76, -0.56], [0, 0.1, 0]);
  const tailPts = [v(0, 0.02, 0.06), v(0, -0.04, -0.1), v(0.03, -0.2, -0.22), v(0.07, -0.3, -0.36), v(0.1, -0.26, -0.5), v(0.12, -0.12, -0.58)];
  add(tailG, paint(loft(tailPts, curveTable([[0, 0.052, 0.052], [0.3, 0.04, 0.04], [0.9, 0.034, 0.034], [1, 0, 0]]), { segs: 28, radial: 10, side: X }), (_p, n) => lionCol(n)), M.plume).userData.inkGroup = TAIL;
  const tailPath = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  const tuftAt = tailPath.getPointAt(0.86);
  const tailTip = group(tailG, tuftAt.toArray() as V3);
  const tailT = tailPath.getTangentAt(0.86);
  {
    // The feather fan at the end of the tail: three wide round-headed feathers spread into a small fan, the fan's plane slanted at 45 degrees (the fan's face can be seen from behind and from the side, not a ring of petals, pitfall 55)
    const T = tailT.clone().normalize();
    const S = new THREE.Vector3().crossVectors(T, v(0.7, 0, 0.7)).normalize();
    const Nf = new THREE.Vector3().crossVectors(T, S).normalize();
    const fan = featherSheet({
      root: [S.clone().multiplyScalar(-0.035), v(0, 0, 0), S.clone().multiplyScalar(0.035)],
      dir: (s) => T.clone().multiplyScalar(Math.cos((s - 0.5) * 0.9)).addScaledVector(S, Math.sin((s - 0.5) * 0.9)).normalize(),
      normal: () => Nf,
      len: (s) => 0.21 * (0.8 + 0.2 * Math.cos((s - 0.5) * PI)),
      bend: (_s, d) => 0.25 * d * d,
      feather: (s) => s * 3,
      notch: () => 0.5,
      thick: (_s, c) => 0.02 * (0.35 + 0.65 * (1 - c)),
      rows: 40,
      cols: 6,
      color: (_s, c) => C(GOLD).lerp(C(GOLD_D), ss(c, 0.35, 0.6)).lerp(C(AMBER), ss(c, 0.75, 0.9)),
    });
    add(tailTip, fan.geo, M.plume).userData.inkGroup = TAIL;
  }

  // ── Riding saddle: a royal-blue saddle cloth draping from the back to both sides, the hem gold with round scallops; the rising-sun emblem of the Dawnlight embroidered on both sides. On top is the leather saddle (front pommel, seat, rear cantle),
  //    saddle skirts at the sides and hanging stirrups; at the front right of the saddle (+x) hangs a horn, and the lance bucket at the rear left (-x) holds the knight's lance and a swallow-tailed pennon ──
  const ZF = 0.1;
  const ZB_TOP = -0.3;
  const ZB_BOT = -0.2;
  const LIFT = 0.014;
  const HEM_N = 5;
  const clothRows = HEM_N * 6 + 1;
  /** The hem: u runs from 0 (trailing edge) to 1 (leading edge), the scallops aligned to the grid rows (6 rows per scallop), the trailing edge slightly higher so as to clear the hind leg */
  const hemY = (u: number) => {
    const w = u * HEM_N - Math.floor(u * HEM_N);
    const tip = Math.sqrt(Math.max(0, 1 - (2 * w - 1) ** 2));
    return 0.55 - 0.035 * tip + 0.035 * (1 - ss(u, 0, 0.35));
  };
  const BAND = 0.032;
  const ARC = [0, 0.18, 0.4, 0.62, 0.84, 1.06, 1.28, PI / 2];
  /** One column of the cloth: [sx, arc position (radians) or the proportion hung down, hanging?] */
  const clothCols: [number, number, boolean][] = [];
  const HANG = [0.12, 0.3, 0.5, 0.7, -1, -2, -3, 1];
  for (const f of [...HANG].reverse()) clothCols.push([-1, f, true]);
  for (let k = ARC.length - 1; k >= 1; k--) clothCols.push([-1, ARC[k], false]);
  clothCols.push([1, 0, false]);
  for (let k = 1; k < ARC.length; k++) clothCols.push([1, ARC[k], false]);
  for (const f of HANG) clothCols.push([1, f, true]);
  /** The proportion of the hanging part: -1, -2, -3 are the two sides and the midline of the upper edge of the gold hem, converted from the drop length of that row, so the boundary falls on grid points (pitfall 32) */
  const hangF = (drop: number, f: number) => (f >= 0 ? f : f === -1 ? 1 - (BAND + 0.006) / drop : f === -2 ? 1 - (BAND - 0.004) / drop : 1 - (BAND * 0.45) / drop);
  const clothAt = (i: number, col: [number, number, boolean]) => {
    const u = i / (clothRows - 1);
    const [sx, f, hang] = col;
    const z0 = THREE.MathUtils.lerp(ZB_TOP, ZF, u);
    if (!hang) return { p: onTorso(z0, f, sx, LIFT), k: 0, drop: 1 };
    // The hanging part: the lower it goes the more the trailing edge draws forward, so as to clear the hind leg
    const w0 = onTorso(z0, PI / 2, sx, LIFT);
    const drop = w0.y - hemY(u);
    const k = hangF(drop, f);
    const z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(ZB_TOP, ZB_BOT, k), ZF, u);
    const w = onTorso(z, PI / 2, sx, LIFT);
    const dropZ = w.y - hemY(u);
    return { p: w.add(v(sx * 0.03 * k, -dropZ * k, 0)), k, drop: dropZ };
  };
  const clothGeo = shellGeo(clothRows, clothCols.length, (i, j) => clothAt(i, clothCols[j]).p, 0.01, (i, j) => {
    const col = clothCols[j];
    if (!col[2]) return C(ROYAL);
    const { k, drop } = clothAt(i, col);
    return C(ROYAL).lerp(C(HEM), ss(drop * k, drop - BAND - 0.002, drop - BAND + 0.002));
  });
  add(body, clothGeo, M.cloth);
  // Rising-sun emblem: half a sun with seven rays, ivory white, embroidered on the saddle cloth hanging at both sides
  const sunShape = (() => {
    const pts: [number, number][] = [];
    const R1 = 0.04;
    const R2 = 0.068;
    pts.push([-R1 - 0.014, 0]);
    for (let k = 0; k <= 14; k++) {
      const a = PI - (k / 14) * PI;
      const r = k % 2 ? R2 : R1;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    pts.push([R1 + 0.014, 0], [R1 + 0.014, -0.013], [-R1 - 0.014, -0.013]);
    return outline(pts);
  })();
  const sunGeo = slab(sunShape, 0.006, 0.002, 2);
  const sunRow = Math.round((clothRows - 1) * 0.5);
  for (const sx of [-1, 1]) {
    const a = clothAt(sunRow, [sx, 0.34, true]).p;
    const b = clothAt(sunRow, [sx, 0.5, true]).p;
    const p = a.lerp(b, 0.5).add(v(sx * 0.008, 0, 0));
    add(body, sunGeo, M.ivory, p.toArray() as V3, [0, sx * PI / 2 - sx * 0.05, 0]);
  }

  // Seat: a leather saddle along the spine, slightly dished in the middle; the front pommel arched up with a gold saddle knob on top, and the rear cantle turned up toward the back
  const topAt = (z: number, lift: number) => onTorso(z, 0, 1, LIFT + lift);
  const seatPts = [0.07, 0.0, -0.08, -0.16, -0.22].map((z) => topAt(z, 0.012 + (z > 0.02 || z < -0.2 ? 0.006 : 0)));
  add(body, loft(seatPts, curveTable([[0, 0, 0], [0.08, 0.11, 0.022], [0.5, 0.13, 0.024], [0.92, 0.12, 0.022], [1, 0, 0]]), { segs: 18, radial: 14 }), M.leather);
  const pom = topAt(0.075, 0.02);
  add(body, loft([pom.clone().add(v(-0.08, 0.0, 0)), pom.clone().add(v(0, 0.06, 0.012)), pom.clone().add(v(0.08, 0.0, 0))], curveTable([[0, 0, 0], [0.12, 0.024, 0.026], [0.88, 0.024, 0.026], [1, 0, 0]]), { segs: 14, radial: 10, side: FWD }), M.leather);
  add(body, new THREE.SphereGeometry(0.024, 12, 8), M.gold, pom.clone().add(v(0, 0.082, 0.014)).toArray() as V3);
  const can = topAt(-0.22, 0.018);
  add(body, loft([can.clone().add(v(-0.13, 0, 0.02)), can.clone().add(v(-0.07, 0.06, 0)), can.clone().add(v(0, 0.085, -0.014)), can.clone().add(v(0.07, 0.06, 0)), can.clone().add(v(0.13, 0, 0.02))],
    curveTable([[0, 0, 0], [0.08, 0.03, 0.036], [0.92, 0.03, 0.036], [1, 0, 0]]), { segs: 18, radial: 10, side: FWD }), M.leather);
  for (const sx of [-1, 1]) add(body, new THREE.SphereGeometry(0.013, 10, 6), M.gold, can.clone().add(v(sx * 0.07, 0.068, 0.024)).toArray() as V3);
  // Behind the saddle is tied a roll of blue bedding, fastened with two leather straps: the rider's luggage for a long journey is still there, but the rider is not in the saddle (the story of the back)
  {
    const rc = topAt(-0.31, 0.035);
    const roll = group(body, rc.toArray() as V3, [0, 0, PI / 2]);
    const rollGeo = new THREE.CapsuleGeometry(0.042, 0.2, 6, 16);
    add(roll, paint(rollGeo, (p) => C(ROYAL).lerp(C(HEM), ss(Math.abs(p.y), 0.118, 0.124))), M.cloth);
    for (const y of [-0.06, 0.06]) add(roll, new THREE.TorusGeometry(0.045, 0.006, 6, 18), M.leather, [0, y, 0], [PI / 2, 0, 0]);
  }
  // Crupper: a leather strap from under the bedroll along the spine all the way to the tail root, going once around the tail root and fastened with a gold buckle in the middle; seen from behind, only this gives the rump a structural line
  {
    const zs = [-0.3, -0.37, -0.44, -0.5, -0.545];
    const pts = zs.map((z) => onTorso(z, 0, 1, 0.006));
    add(body, loft(pts, curveTable([[0, 0, 0], [0.04, 0.013, 0.004], [0.96, 0.013, 0.004], [1, 0, 0]]), { segs: 20, radial: 8 }), M.leather);
    const bk = onTorso(-0.42, 0, 1, 0.012);
    add(body, rbox(0.03, 0.008, 0.026, 0.003, 1), M.gold, bk.toArray() as V3);
    const tr = v(0, 0.765, -0.585);
    add(body, new THREE.TorusGeometry(0.058, 0.009, 6, 18), M.leather, tr.toArray() as V3, [0.9, 0, 0]);
  }

  // Saddle skirts: leather pieces lying against the saddle cloth at both sides; the stirrup leathers hang from the lower edge of the skirts, holding gold stirrups (empty, the master is away)
  for (const sx of [-1, 1]) {
    const flap = shellGeo(9, 7, (i, j) => {
      const z = -0.17 + (0.15 * i) / 8;
      const phi = 0.9 + (PI / 2 - 0.9) * Math.min(1, j / 4);
      const p = onTorso(z, phi, sx, LIFT + 0.014);
      if (j > 4) p.y -= ((j - 4) / 2) * 0.07;
      return p;
    }, 0.008);
    add(body, flap, M.leather);
    const top = onTorso(-0.095, PI / 2, sx, LIFT + 0.02).add(v(0, -0.11, 0));
    const bot = v(top.x + sx * 0.045, 0.42, -0.095);
    const strap = new THREE.Group();
    body.add(strap);
    add(strap, rbox(0.006, 1, 0.024, 0.002, 1), M.leather);
    strap.position.copy(top).lerp(bot, 0.5);
    strap.quaternion.setFromUnitVectors(UP, top.clone().sub(bot).normalize());
    strap.scale.set(1, top.distanceTo(bot), 1);
    const st = group(body, bot.toArray() as V3, [0, 0, sx * 0.05]);
    add(st, new THREE.TorusGeometry(0.038, 0.0065, 6, 14, PI), M.gold, [0, -0.045, 0], [0, 0, 0], [1, 1.1, 1]);
    add(st, rbox(0.09, 0.011, 0.03, 0.004, 1), M.gold, [0, -0.045, 0]);
  }
  // Horn: the ivory horn hanging at the front right of the saddle (+x), curved into a crescent, with two gold bands, a gold mouthpiece, and the bell facing forward; a leather strap hangs it on the front pommel
  const hornG = group(body, onTorso(0.04, PI / 2, 1, LIFT + 0.03).add(v(0.022, -0.06, 0)).toArray() as V3, [1.05, 0.25, 0.1]);
  const hornPts = [v(0, 0.05, -0.12), v(0, -0.01, -0.05), v(0, -0.03, 0.04), v(0, 0.01, 0.12)];
  const hornPath = new THREE.CatmullRomCurve3(hornPts, false, 'centripetal');
  add(hornG, loft(hornPts, curveTable([[0, 0, 0], [0.04, 0.009, 0.009], [0.5, 0.018, 0.018], [0.85, 0.03, 0.03], [0.97, 0.042, 0.042], [0.995, 0.04, 0.04], [1, 0, 0]]), { segs: 20, radial: 12, side: X }), M.ivory);
  const bandGeo = new THREE.TorusGeometry(1, 0.2, 6, 14);
  for (const [t, r] of [[0.3, 0.017], [0.72, 0.028], [0.97, 0.043]] as [number, number][]) {
    const b = add(hornG, bandGeo, M.gold, hornPath.getPointAt(t).toArray() as V3, [0, 0, 0], [r, r, r]);
    b.quaternion.setFromUnitVectors(FWD, hornPath.getTangentAt(t));
  }
  const mouthP = add(hornG, new THREE.CylinderGeometry(0.008, 0.012, 0.024, 10), M.gold, hornPath.getPointAt(0).toArray() as V3);
  mouthP.quaternion.setFromUnitVectors(UP, hornPath.getTangentAt(0).negate());
  const bell = add(hornG, new THREE.CylinderGeometry(0.036, 0.036, 0.004, 16), M.talon, hornPath.getPointAt(1).toArray() as V3);
  bell.quaternion.setFromUnitVectors(UP, hornPath.getTangentAt(1));
  const hornA = group(hornG, hornPath.getPointAt(1).addScaledVector(hornPath.getTangentAt(1), 0.02).toArray() as V3);
  {
    // Hanging strap: from the right end of the front pommel to the two gold bands of the horn
    const a = pom.clone().add(v(0.07, -0.005, 0));
    hornG.updateMatrix();
    const b1 = hornPath.getPointAt(0.3).applyMatrix4(hornG.matrix);
    const b2 = hornPath.getPointAt(0.72).applyMatrix4(hornG.matrix);
    for (const b of [b1, b2]) {
      const mid = a.clone().lerp(b, 0.5).add(v(0.03, 0, 0));
      add(body, loft([a, mid, b], () => [0.006, 0.0025], { segs: 8, radial: 6 }), M.leather);
    }
  }
  // Lance: the leather lance bucket at the rear left of the saddle (-x), the lance standing slanted back and up; an ivory shaft, a gold guard and a gold lance head, with a swallow-tailed pennon under the lance head (blown by the wind and streaming back)
  const LB = onTorso(-0.22, PI / 2, -1, LIFT + 0.03).add(v(-0.02, -0.08, -0.02));
  const LD = v(-0.4, 0.78, -0.48).normalize();
  const LL = 0.88;
  add(body, new THREE.CylinderGeometry(0.026, 0.021, 0.1, 12), M.leather, LB.toArray() as V3).quaternion.setFromUnitVectors(UP, LD);
  const lanceAt = (d: number) => LB.clone().addScaledVector(LD, d);
  add(body, loft([lanceAt(-0.04), lanceAt(0.2), lanceAt(0.55), lanceAt(LL)], curveTable([[0, 0, 0], [0.02, 0.015, 0.015], [0.3, 0.014, 0.014], [0.9, 0.009, 0.009], [1, 0, 0]]), { segs: 16, radial: 8, side: X }), M.ivory);
  const vam = add(body, lathe([[0.013, 0], [0.052, 0.036], [0.048, 0.046], [0.013, 0.03]], 14), M.gold, lanceAt(0.16).toArray() as V3);
  vam.quaternion.setFromUnitVectors(UP, LD);
  const tipM = add(body, lathe([[0.001, 0], [0.02, 0.032], [0.013, 0.08], [0.001, 0.11]], 8), M.gold, lanceAt(LL - 0.02).toArray() as V3);
  tipM.quaternion.setFromUnitVectors(UP, LD);
  const lanceTipA = group(body, lanceAt(LL + 0.09).toArray() as V3);
  // Pennon: the flag face lies in inner's xy plane, with x along the direction it streams back and y along the lance shaft; flagG swings about the lance shaft
  const flagG = group(body, lanceAt(LL - 0.1).toArray() as V3);
  const FW = v(-0.55, 0, -0.84);
  const FX = FW.clone().addScaledVector(LD, -FW.dot(LD)).normalize();
  {
    const Fz = new THREE.Vector3().crossVectors(FX, LD).normalize();
    const inner = group(flagG);
    inner.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(FX, LD, Fz));
    const flag = slab(outline([[0, -0.11], [0, 0], [0.26, -0.022], [0.18, -0.06], [0.26, -0.1]]), 0.008, 0.003, 2);
    add(inner, solid(flag, ROYAL), M.cloth);
  }
  const pennonA = group(flagG, FX.clone().multiplyScalar(0.26).addScaledVector(LD, -0.03).toArray() as V3);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const rig = {
    head: group(look, HOFF.clone().add(v(0, 0, HR * 0.7)).toArray() as V3),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [0, -0.45 * HR, 1.45 * HR]),
      saddle: group(body, topAt(-0.08, 0.06).toArray() as V3),
      horn: hornA,
      lance: lanceTipA,
      pennon: pennonA,
      chest: group(body, [0, 0.8, 0.6]),
      wingL: wings[1].rootA,
      wingR: wings[0].rootA,
      wingTipL: wings[1].tipA,
      wingTipR: wings[0].tipA,
      tail: group(tailTip, tailT.clone().multiplyScalar(-0.18).toArray() as V3),
      talonL: talonAnchors[1],
      talonR: talonAnchors[0],
    },
  };
  const act = { focus: 0, crouch: 0, spread: 0, tuck: 0, cry: 0 };

  // Static parts merged (mesh budget SR 60): nodes that move when idle act as owners; the eye highlights (switched on and off when blinking) are not merged
  mergeStatic(root, {
    owners: [body, neckG, look, head, jaw, ...wings.map((w) => w.wg), tailG, tailTip, flagG, ...lids.flatMap((l) => [l.up, l.lo]), ...ears.map((e) => e.g)],
    keep: [...his],
    rig,
  });

  // ── Idle: standing with head held high, breathing; both wings open and close slightly with the breathing; the head turns in jerks, now and then looking back at the empty saddle on its back; the ear feathers twitch now and then;
  //    the tail feather tuft sways lightly; the pennon flutters in the wind; blinking. All computed from t, so frame-by-frame screenshots at frozen time are consistent too (pitfall 80) ──
  const LOOKS = [0.12, -0.16, 0.26, 0.02, -0.24, 1.05, 0.18, -0.06];
  const LOOK_T = 1.6;
  const lookAt = (t: number) => {
    const u = t / LOOK_T;
    const i = Math.floor(u);
    const f = u - i;
    const n = LOOKS.length;
    return THREE.MathUtils.lerp(LOOKS[((i % n) + n) % n], LOOKS[(((i + 1) % n) + n) % n], ss(f, 0.8, 0.92));
  };
  const BLINK = 3.7;
  const HIP = v(0, 0.76, -0.42);
  const bo = new THREE.Vector3();
  const flagQ = new THREE.Quaternion();
  const update = (t: number) => {
    const L = THREE.MathUtils.lerp;
    const calm = 1 - act.focus;
    const cr = act.crouch;
    const sp = act.spread;
    const tk = act.tuck;
    const br = Math.sin(t * 1.3);
    // Crouching: the front of the body rotates down about the rump, with the four feet staying on the ground
    const pitch = cr * 0.1;
    bo.set(0, br * 0.005 - cr * 0.03, 0).sub(HIP);
    body.rotation.x = pitch;
    body.position.set(0, bo.y * Math.cos(pitch) - bo.z * Math.sin(pitch), bo.y * Math.sin(pitch) + bo.z * Math.cos(pitch)).add(HIP);
    // Head: the head turns in jerks; on the beat when it looks back at the saddle the neck turns along too
    const la = lookAt(t) * calm;
    neckG.rotation.set(-cr * 0.25 + act.cry * 0.1, la * 0.35, 0);
    look.rotation.set(Math.sin(t * 0.53) * 0.02 * calm - act.cry * 0.35 + cr * 0.3, la * 0.65, Math.sin(t * 0.3) * 0.02 * calm);
    jaw.rotation.x = act.cry * 0.45;
    // Wings: the half-open display pose; opening and closing slightly with the breathing. spread raises them with the wing surfaces turned straight forward; tuck draws them back against the saddle
    for (const w of wings) {
      const flex = Math.sin(t * 1.3 - 0.6) * 0.03;
      const pitchW = L(L(-0.85, -1.15, sp), -0.1, tk);
      const elev = L(L(0.5, 1.0, sp), -0.35, tk) + flex;
      const sweep = L(L(0.3, 0.08, sp), 1.25, tk);
      w.wg.rotation.set(pitchW, w.sx * sweep, w.sx * elev);
    }
    // Ear feathers: twitching now and then; laid back when crouching
    for (const e of ears) {
      const ph = (t + (e.sx > 0 ? 0 : 2.3)) % 6.1;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.15 : 0;
      e.g.rotation.set(-cr * 0.4 + tw, 0, e.sx * tw * 0.5);
    }
    tailG.rotation.set(Math.sin(t * 0.9) * 0.04 + cr * 0.2, 0.1 + Math.sin(t * 0.7) * 0.12, 0);
    tailTip.rotation.set(Math.sin(t * 1.4 - 0.8) * 0.12, 0, Math.sin(t * 1.1) * 0.1);
    // Pennon: swaying about the lance shaft in the wind
    flagQ.setFromAxisAngle(LD, Math.sin(t * 2.3) * 0.14 + Math.sin(t * 5.1) * 0.05);
    flagG.quaternion.copy(flagQ);
    // Blink: the upper and lower lids close together toward the midline (pitfall 46); the highlights are hidden once it is more than half closed
    const bt = ((t + 1.4) % BLINK) / 0.2;
    const close = bt < 1 ? Math.min(1, Math.sin(bt * PI) * 1.3) : 0;
    // The two pieces overlap a little above the midline, leaving no gap when fully closed
    for (const l of lids) {
      l.up.rotation.x = -THREE.MathUtils.lerp(l.upOpen, 0.08, close);
      l.lo.rotation.x = PI + THREE.MathUtils.lerp(l.loOpen, -0.12, close);
    }
    for (const h of his) h.visible = close < 0.6;
  };
  update(1);

  // Move the whole animal onto the pivot: the x and z center of the bounding box is placed at the origin, so the side and back views are not cropped (pitfall 66)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const mid = box.getCenter(new THREE.Vector3());
  place.position.set(-mid.x, 0, -mid.z);
  const size = box.getSize(new THREE.Vector3());

  return {
    root,
    update: (t) => update(t),
    center: new THREE.Vector3(0, mid.y, 0),
    radius: Math.max(size.x, size.y, size.z) * 0.56,
    rig,
    act,
  };
}
