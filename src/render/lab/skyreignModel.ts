// Skyreign, the Azure Falcon King (model lab version): the falcon king of the Azurehowl Plateau, which can ride the updrafts for three days without landing. The Wingfolk of the plateau raise it in their hats from childhood,
// and when it is grown they fit a copper ring on its foot as their family's mark.
// Only one form (decided by the user, 2026-09-28): the builder takes no evolution stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on, with reasons (from the name, the wind element, the fast-attack role and the lore):
//   1. A blue back and white belly, with dark blue wing tips and tail end: the "azure wind" is the blue of the plateau sky, and the white underside is like the underside of a cloud, so seen from the ground looking up it is a piece of sky.
//   2. Dark blue malar stripes hanging beneath the eyes and white cheeks: the falcon's most recognizable face, still recognizable as a falcon when shrunk, not an eagle or a finch.
//   3. A yellow hooked beak and cere, a yellow eye ring, the beak tip dark: the brightest and most saturated patch on the face, where the gaze lands first.
//   4. Three crest feathers on top of the head sweeping back, the feather tips gold: the "King" wears a crown made only of feathers, not a metal crown.
//   5. Two long tail feathers streaming back, the ends small gold-tipped vanes: the wind blows from the front and the long tail feathers are blown into two lines swept back and up, which in silhouette is "wind".
// Body shape follows the lore: it does not land for three days, so it always hangs in the updraft in a "fixed-point hover" (kiting): facing the wind, the body at forty-five degrees,
// both wings spread without beating, the wing surfaces half facing forward with a slight dihedral; the tail feathers fanned whole and pressed down, the feet tucked under the belly.
// The falcon's wings are long and pointed, the wrist forward and the hand swept back into a scythe shape, which sets it apart from Aeroth, which beats its wings and hovers on the same plateau.
//
// Personality: a king of the wind that always takes the first beat. It looks as if it is just resting in the wind, but its eyes stay locked on the next target, and at the first gap it is the first to dash out.
// Expression: made after a falcon's face, not anthropomorphized, no doll eyes. The eyes are sunk in the sockets, about twenty percent of the head's width in diameter, the whole eye dark brown close to black with only a small point of highlight,
// no sclera, no pale iris; the outer ring is a yellow bare-skin eye ring; the brow ridge is a bony ridge of the same color as the head hood, lying against the upper eye ring and pressing on the eye without covering it; dark blue malar stripes hang beneath the eyes.
// The beak is closed, and the yellow line of the gape is not drawn (from the front it would read as a mouth line or a mustache). The body moves with the air currents, but the head stays at the same point (a bird's head stabilization),
// and the head turns in jerks, as if locking onto targets one after another.
// Gaze order: the face (the dark blue malar stripes on white cheeks, the dark eyes in yellow eye rings, the yellow beak) first, the gold-tipped crest second, and the scythe-shaped wings and long tail feathers as support.
// The back tells "riding the wind": scalloped dark blue shoulder feathers, the backs of the scythe wings dark all the way to the tips, a white tail band, and the two gold-tipped long tail feathers blown into a V by the wind in its face;
// from behind it is exactly how it hangs in midair facing the wind. The back of the head keeps only the blue head hood and the crest roots, with no markings:
// nape eye-spots were tried (a white ring around a dark dot, a slanted teardrop plus a pale feather band), but seen from behind all read as the eyes of a second face, so they were removed entirely.
// Restrained light effects: no emissive and no reliance on bloom; only a small point of highlight on the eyes.
//
// <Action table> (act weights: tuck, wings folded into an arrow shape, 0-1; flare, wings spread and crest raised, 0-1)
//   Idle: wings spread, fixed in the updraft, the body slowly rising, falling and rolling with the air currents, the wing tips and tail fan correcting half a beat behind, the head held steady and turning in jerks to lock onto targets,
//         the crest and long tail feathers trembling in the wind; blinks now and then.
//   Move: no wingbeats, the wings closing and opening once, gliding along on the air current.
//   Charge-up: the wings drawn back into an arrow shape, the crest laid flat, the body leveled and aimed at the target (tuck).
//   Strike: wings folded in a dive, a flash gone by, the first strike that gets in ahead of everyone.
//   Hit: all the feathers burst up and it rolls over to shed the force, returning to its original height at once, without retreating.
//   Victory: both wings spread whole and swept up, the crest raised (flare), circling half a turn back to its place, with no cry.
// Anchors: head, eyes, mouth (beak tip), crest (crest tip), wingTipL / wingTipR (wing tips), tail (center of the end of the tail fan),
//       streamerL / streamerR (the gold vanes at the ends of the long tail feathers), ring (the copper ring on the foot).
// Face count: the N budget is 25,000 faces. The skull uses only medium segments, and the white cheeks and malar stripes are thin patches laid on the skull (clean edges, not relying on densely subdivided vertex colors);
// the feather sheets, fur collars and eyelids all use low-segment versions of their own.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rng, smooth, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type V3 = [number, number, number];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Feather surface ─────────────────────────

interface SheetOpts {
  /** The curve the feather roots follow (wing bone, tail root, top of the head), with s the arc-length position from 0 to 1 */
  root: THREE.Vector3[];
  /** The direction (unit vector) the feather grows outward at s */
  dir: (s: number) => THREE.Vector3;
  /** The length of the feather at s (not including the notch at the tip) */
  len: (s: number) => number;
  /** The direction of the underside (the thickness runs along it), the other side being the back */
  normal: (s: number) => THREE.Vector3;
  /** s → feather coordinate: an integer is the boundary between two feathers */
  feather: (s: number) => number;
  /** The proportion by which the trailing edge is shortened between feathers */
  notch: (s: number) => number;
  /** This layer's own half thickness (c runs along the feather from 0 at the root to 1 at the tip) */
  thick: (s: number, c: number) => number;
  /** The half thickness of the layer underneath at the same point (d is the distance from the feather root): this layer is stacked on it, so the feather tips do not sink in */
  under?: (s: number, d: number) => number;
  /** The bend of the feather surface: the displacement toward the underside (d is the distance from the feather root); shared by every layer of the same wing so they stack tightly */
  bend?: (s: number, d: number) => number;
  /** The depth of the groove between feathers */
  groove?: number;
  /** The feather tip is pointed (give an exponent, the larger the more pointed); if not given it is round-headed */
  pointy?: number;
  /** The rachis: the height of the ridge along the midline of each feather */
  rachis?: number;
  /** Vertex color: side = -1 is the back and 1 the underside; w is the lateral position within the feather (0.5 is the rachis) */
  color?: (s: number, c: number, side: number, w: number) => THREE.ColorRepresentation;
  /** The number of rows along the feather roots (5-6 rows per feather are enough), and the number of segments along the feather */
  rows: number;
  cols: number;
}

interface Sheet {
  geo: THREE.BufferGeometry;
  /** The half thickness at s, at distance d from the feather root (for the layer stacked on top) */
  h: (s: number, d: number) => number;
}

/**
 * A feather surface joined into one sheet (Aeroth's featherSheet, with the segment counts turned into parameters): along the feather-root curve, each point grows a feather toward dir,
 * the trailing edge cut into individual feather tips, with grooves pressed into the surface between feathers. The cross-section is a full ring, closing naturally as the thickness at both ends goes to 0.
 * The whole sheet is one part, so the outline falls only on the edges of the feather tips and the creases of the grooves, and does not outline every feather separately the way separate feathers would (pitfall 20).
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
  // Winding check: the normal of the middle row at the middle of the underside must face the underside, and if reversed it is flipped (after mirroring left and right the winding is opposite)
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

/** A low-segment spherical cap centered on +z (iris, pupil) */
function capLow(r: number, ang: number, seg = 20, rings = 4): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/**
 * A thin patch on the skull surface: f(u, v) returns [longitude, latitude] (0 longitude toward +z), laid onto an ellipsoid of radius r and scale sc, floating lift outward.
 * The normals are the ellipsoid's own normals, so the shading matches the skull; in the same outline group as the skull, the edge shows only a clean color change, with no extra ring of line.
 */
function skinPatch(f: (u: number, v: number) => [number, number], nu: number, nv: number, r: number, sc: V3, lift: number, color?: (u: number, v: number) => THREE.Color): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const [lon, lat] = f(i / nu, j / nv);
      d.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const px = d.x * r * sc[0];
      const py = d.y * r * sc[1];
      const pz = d.z * r * sc[2];
      n.set(px / (sc[0] * sc[0]), py / (sc[1] * sc[1]), pz / (sc[2] * sc[2])).normalize();
      pos.push(px + n.x * lift, py + n.y * lift, pz + n.z * lift);
      nor.push(n.x, n.y, n.z);
      if (color) {
        const c = color(i / nu, j / nv);
        col.push(c.r, c.g, c.b);
      }
    }
  const idx: number[] = [];
  const W = nu + 1;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * W + i;
      idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
    }
  // Winding: the triangles must face outward (on the same side as the normals), and if reversed they are flipped; the middle cell is used to judge, avoiding the edges that close to a point
  const mid = (Math.floor(nv / 2) * nu + Math.floor(nu / 2)) * 6;
  const pa = new THREE.Vector3().fromArray(pos, idx[mid] * 3);
  const pb = new THREE.Vector3().fromArray(pos, idx[mid + 1] * 3);
  const pc = new THREE.Vector3().fromArray(pos, idx[mid + 2] * 3);
  const fn = new THREE.Vector3().crossVectors(pb.sub(pa), pc.sub(pa));
  if (fn.dot(new THREE.Vector3().fromArray(nor, idx[mid] * 3)) < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Recompute the normals after changing positions vertex by vertex (the dihedral of the wing surface) */
function warp(g: THREE.BufferGeometry, f: (p: THREE.Vector3) => void): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    p.fromBufferAttribute(pa, i);
    f(p);
    pa.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

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

// ───────────────────────── Shape ─────────────────────────

export function buildSkyreignLab(): LabModel {
  const RIMC = 0xcfe6ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const BLUE = 0x4a90dc;
  const HOOD = 0x3d7ccc;
  const BLUE_L = 0x7ab2ec;
  const NAVY = 0x223f86;
  const WHITE = 0xf7fafe;
  const PALE = 0xdae7f6;
  const YEL = 0xffc23e;
  const TIP = 0x3a3552;
  const GOLD = 0xf2c04a;
  const M = {
    feather: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    hood: labToon(HOOD, { rim: 0.55, rimColor: RIMC }),
    white: labToon(WHITE, { rim: 0.4, rimColor: RIMC }),
    navy: labToon(NAVY, { rim: 0.4, rimColor: RIMC }),
    beak: vc(labToon(0xffffff, { spec: 0.8, specTh: 0.975, rim: 0.35, rimColor: 0xffe6a8 })),
    blue: labToon(BLUE, { rim: 0.7, rimColor: RIMC }),
    yellow: labToon(YEL, { rim: 0.35, rimColor: 0xffe6a8 }),
    talon: labToon(0x2a2838, { spec: 0.9, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    eye: labToon(0x140e0c, { ramp: 'gem', rim: 0 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    pupil: labToon(0x060405, { rim: 0 }),
    nostril: labToon(0x4a3a2a, { rim: 0 }),
    brass: labToon(0xcf9d4c, { ramp: 'metal', spec: 1.3, specTh: 0.9, rim: 0.5, rimColor: 0xffe2a8 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  const C = (c: THREE.ColorRepresentation) => new THREE.Color(c);

  const root = new THREE.Group();
  root.name = 'skyreign-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const HEAD = 9401;
  const BODY = 9402;
  const WING_L = 9403;
  const WING_R = 9404;
  const TAIL = 9405;
  const BEAK = 9406;
  const LEG = 9407;

  /** Place a ring of feathers: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal; the color is computed in the collar's own coordinates (+z is the back side) */
  const collar = (parent: THREE.Object3D, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup: number, color: (p: THREE.Vector3) => THREE.Color, segS = 6, per = 5) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, paint(lowCollar(o, segS, per), (p) => color(p)), M.feather);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    m.userData.inkGroup = inkGroup;
    return m;
  };

  // ── Skeleton: place moves the whole animal onto the pivot; fly is the center of gravity in midair, rising and falling with the air currents; pitchG tilts the body forty-five degrees into the wind (modeled upright and then leaned forward);
  //    body holds the coordinates of the upright modeling: the spine along +y, the belly side toward +z, and the origin below PIV ──
  // The hover height, the wingspan and the tail length all go into the game's height normalization (labLocalHeight takes the maximum of the top, 0.7 times the length and 0.6 times the width),
  // so if it floats too high or the wingspan is too wide, in battle the animal itself comes out a size smaller than the other N spirits; the three components are kept at about the same value, and the head is enlarged a bit more
  const FLY_Y = 0.64;
  const PITCH = 0.82;
  const PIV = v(0, 0.66, 0);
  const place = group(root);
  const fly = group(place, [0, FLY_Y, 0]);
  const pitchG = group(fly, [0, 0, 0], [PITCH, 0, 0]);
  const body = group(pitchG, [-PIV.x, -PIV.y, -PIV.z]);

  // ── Torso: one whole loft from the tail root up to the neck base, the chest deep and tapering toward the tail; blue back and white belly, the boundary on the flank with a narrow transition; the lower belly toward the tail carries a touch of pale cloud-underside blue ──
  const torsoPts = [v(0, 0.36, -0.13), v(0, 0.44, -0.085), v(0, 0.56, -0.02), v(0, 0.71, 0.035), v(0, 0.85, 0.05), v(0, 0.97, 0.04)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.05, 0.052, 0.048, 0],
    [0.18, 0.1, 0.1, 0],
    [0.4, 0.148, 0.152, 0.004],
    [0.6, 0.166, 0.176, 0.018],
    [0.78, 0.15, 0.158, 0.012],
    [0.91, 0.108, 0.108, 0],
    [1, 0, 0, 0],
  ]);
  const torsoPath = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal');
  /** The point on the torso surface at t, at angle th about the spine (th = PI/2 the belly side, -PI/2 the back side, 0 the left side +x) */
  const onTorso = (t: number, th: number, lift = 0) => {
    const Cc = torsoPath.getPointAt(t);
    const T = torsoPath.getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, FWD).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [a, b, dy] = torsoProf(t);
    return Cc.addScaledVector(W, Math.cos(th) * (a + lift)).addScaledVector(H, Math.sin(th) * (b + lift) + dy);
  };
  const VENT = v(0, -0.12, 1).normalize();
  const torso = add(body, paint(loft(torsoPts, torsoProf, { segs: 40, radial: 30, up: FWD }), (p, n) => C(BLUE).lerp(C(WHITE).lerp(C(PALE), ss(p.y, 0.62, 0.44)), ss(n.dot(VENT), -0.02, 0.22))), M.feather);
  torso.userData.inkGroup = BODY;

  // ── Wings: fixed in the air current, not beating. The wing bone (leading edge) goes out from the shoulder, tilts slightly forward at the wrist, then goes out and back to the hand tip, the wing a long pointed scythe;
  //    two layers of feather sheet joined into one: flight feathers and coverts, the tips of the coverts covering the roots of the flight feathers, and the flesh of the wing bone covering the roots of the coverts.
  //    When modeled, the wing surface lies flat on the body's xy plane (the feathers growing toward the tail, the underside facing +z), and with the body at forty-five degrees the wing's underside half faces forward;
  //    the dihedral is bent up with the square of z (pitfall 73), not by rotating the whole sheet ──
  interface WingRig { sx: number; wg: THREE.Group; tipA: THREE.Group }
  const wings: WingRig[] = [];
  const S_W = 0.5;
  const phi = curveTable([[0, -1.62], [0.3, -1.57], [0.5, -1.38], [0.78, -1.04], [1, -0.76]]);
  const WS = 0.9;
  const flightLen = curveTable([[0, 0.17 * WS], [0.3, 0.24 * WS], [0.5, 0.27 * WS], [0.78, 0.37 * WS], [1, 0.33 * WS]]);
  const featherU = (s: number) => (s < S_W ? (s / S_W) * 6 : 6 + ((s - S_W) / (1 - S_W)) * 7);
  const DIHEDRAL = 1.0;
  const lift = (g: THREE.BufferGeometry) => warp(g, (p) => {
    p.z -= DIHEDRAL * Math.max(0, Math.abs(p.x) - 0.1) ** 2;
  });
  for (const sx of [-1, 1]) {
    const WG = sx < 0 ? WING_L : WING_R;
    const sh = group(body, [sx * 0.1, 0.86, -0.05]);
    const wg = group(sh);
    wg.rotation.order = 'YXZ';
    const arm = [v(0, 0, 0), v(sx * 0.1, 0.035, 0), v(sx * 0.2, 0.065, 0.004), v(sx * 0.29, 0.075, 0), v(sx * 0.42, 0.045, -0.004), v(sx * 0.55, 0.0, -0.008)].map((p) => p.multiplyScalar(WS));
    const dir = (s: number) => {
      const a = phi(s)[0];
      return v(sx * Math.cos(a), Math.sin(a), 0);
    };
    const N = () => FWD;
    // The bend of the feather surface: the underside slightly concave, the tips of the primaries turned up toward the back, as if held up by the updraft
    const bend = (s: number, d: number) => {
      const c = Math.min(1, d / flightLen(s)[0]);
      return -0.03 * Math.sin(PI * c) - 0.07 * c * c * ss(s, 0.45, 1);
    };
    const flight = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0],
      feather: featherU,
      notch: (s) => 0.14 + 0.2 * ss(s, 0.5, 0.62),
      thick: (_s, c) => 0.011 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      rachis: 0.004,
      rows: 66,
      cols: 5,
      color: (s, c, side) => {
        const hand = ss(s, S_W - 0.06, S_W + 0.06);
        const edge = ss(c, 0.88, 1);
        if (side < 0) return C(BLUE).lerp(C(NAVY), Math.max(hand * ss(c, 0.05, 0.35), ss(c, 0.5, 0.78))).lerp(C(WHITE), edge * 0.8);
        return C(PALE).lerp(C(NAVY), ss(c, 0.6, 0.86) * (0.35 + 0.65 * hand));
      },
    });
    const coverts = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0] * 0.48,
      feather: (s) => featherU(s) * 1.4 + 0.5,
      notch: () => 0.28,
      thick: (_s, c) => 0.005 + 0.007 * (1 - c),
      under: flight.h,
      groove: 0.4,
      rows: 56,
      cols: 4,
      color: (_s, c, side) => (side < 0 ? C(BLUE).lerp(C(BLUE_L), ss(c, 0.7, 1)) : C(WHITE).lerp(C(PALE), ss(c, 0.4, 0.9))),
    });
    // Wing bone: a rounded stretch of flesh along the leading edge, covering the roots of the two layers
    const armGeo = loft(arm, curveTable([[0, 0, 0], [0.04, 0.044, 0.044], [0.3, 0.04, 0.036], [0.6, 0.031, 0.027], [0.9, 0.02, 0.018], [1, 0, 0]]), { segs: 26, radial: 10, up: FWD });
    for (const [geo, mat] of [[flight.geo, M.feather], [coverts.geo, M.feather], [armGeo, M.blue]] as [THREE.BufferGeometry, THREE.Material][]) {
      add(wg, lift(geo), mat).userData.inkGroup = WG;
    }
    const tip = arm[arm.length - 1].clone().addScaledVector(dir(1), flightLen(1)[0] * 0.92);
    tip.z -= DIHEDRAL * Math.max(0, Math.abs(tip.x) - 0.1) ** 2;
    wings.push({ sx, wg, tipA: group(wg, [tip.x, tip.y, tip.z]) });
  }

  // ── Shoulder feathers: a sheet of blue feathers on the back draping toward the tail, the tips dark blue (a row of dark blue scalloped edges on the back, so the back is not one smooth patch of blue), covering the roots of both wings, so the wings read as growing out of the body ──
  {
    const at = torsoPath.getPointAt(0.8);
    const T = torsoPath.getTangentAt(0.8);
    collar(body, { r0: 0.12, len: 0.28, thick: 0.06, flare: 0.3, curl: 0.18, tufts: 7, notch: 0.42, jitter: 0.12, a0: -1.95, a1: 1.95, seed: 9 },
      at, T, v(0, 0, -1), BODY, (q) => C(BLUE).lerp(C(NAVY), ss(-q.y, 0.13, 0.21) * 0.85));
  }
  // ── Neck feathers: a ring of feathers draping down behind the head, covering the junction of neck and head; blue on the back side and white on the throat side ──
  {
    const at = torsoPath.getPointAt(0.9);
    const T = torsoPath.getTangentAt(0.9);
    collar(body, { r0: 0.095, len: 0.19, thick: 0.075, flare: 0.62, curl: 0.4, tufts: 9, notch: 0.4, jitter: 0.14, seed: 3 },
      at, T, v(0, 0, -1), BODY, (q) => C(BLUE).lerp(C(WHITE), ss(-q.z / Math.max(1e-4, Math.hypot(q.x, q.z)), -0.1, 0.3)), 6, 4);
  }

  // ── Tail feathers: a spread fan going down from the tail root, a blue base, a dark blue subterminal band, a white end; covered by a layer of blue upper tail coverts;
  //    the two central long tail feathers are blown back and up by the wind and spread to the sides, the ends a small gold-tipped vane ──
  const tailRoot = torsoPath.getPointAt(0.03);
  const tailG = group(body, [tailRoot.x, tailRoot.y, tailRoot.z + 0.005], [0.05, 0, 0]);
  const TAIL_LEN = 0.35;
  const streamers: { g: THREE.Group; sx: number; tipA: THREE.Group }[] = [];
  let tailTipA!: THREE.Group;
  {
    const rootPts = [v(-0.06, 0, 0.012), v(0, 0, -0.008), v(0.06, 0, 0.012)];
    const tdir = (s: number) => v((s - 0.5) * 1.35, -1.0, -0.08).normalize();
    const tN = (s: number) => new THREE.Vector3().crossVectors(tdir(s), X).normalize();
    const tLen = (s: number) => TAIL_LEN * (0.88 + 0.12 * Math.cos((s - 0.5) * PI));
    const tbend = (s: number, d: number) => 0.015 * Math.sin(PI * Math.min(1, d / tLen(s))) + 0.1 * ((2 * s - 1) ** 2) * d;
    const tail = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      len: tLen,
      feather: (s) => s * 10,
      notch: () => 0.12,
      thick: (_s, c) => 0.012 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      rows: 52,
      cols: 6,
      color: (_s, c, side) => {
        const band = ss(c, 0.6, 0.68) * (1 - ss(c, 0.76, 0.84));
        const tipW = ss(c, 0.84, 0.92);
        if (side < 0) return C(BLUE).lerp(C(NAVY), band).lerp(C(WHITE), tipW);
        return C(PALE).lerp(C(0x9fb6d6), band).lerp(C(WHITE), tipW);
      },
    });
    add(tailG, tail.geo, M.feather).userData.inkGroup = TAIL;
    const cov = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      len: (s) => tLen(s) * 0.42,
      feather: (s) => s * 6 + 0.5,
      notch: () => 0.3,
      thick: (_s, c) => 0.005 + 0.012 * (1 - c),
      under: tail.h,
      rows: 40,
      cols: 4,
      color: (_s, _c, side) => (side < 0 ? BLUE : WHITE),
    });
    add(tailG, cov.geo, M.feather).userData.inkGroup = TAIL;
    tailTipA = group(tailG, [0, -TAIL_LEN * 0.98, -0.03]);
    // Long tail feathers: a thin rachis going down and out, blown by the wind toward the back side (the world's back and up), the end opening into a small vane (dark blue, gold tip);
    // spreading to the left and right, so seen from behind it is a V, not two parallel sticks
    for (const sx of [-1, 1]) {
      const g = group(tailG, [sx * 0.012, 0, -0.012]);
      const pts = [v(0, 0.02, 0), v(sx * 0.03, -0.16, -0.03), v(sx * 0.1, -0.3, -0.09), v(sx * 0.18, -0.4, -0.19), v(sx * 0.25, -0.45, -0.32)];
      const prof = curveTable([[0, 0, 0], [0.04, 0.008, 0.005], [0.6, 0.0065, 0.0042], [0.72, 0.02, 0.0048], [0.88, 0.025, 0.005], [0.97, 0.012, 0.004], [1, 0, 0]]);
      const geo = loft(pts, prof, { segs: 30, radial: 8, side: X });
      const end = pts[pts.length - 1];
      paint(geo, (p) => C(NAVY).lerp(C(GOLD), 1 - ss(p.distanceTo(end), 0.035, 0.05)));
      add(g, geo, M.feather).userData.inkGroup = TAIL + 10 + sx;
      streamers.push({ g, sx, tipA: group(g, [end.x, end.y, end.z]) });
    }
  }

  // ── Feet: tucked under the belly while hovering, the tarsus hanging a short way down and back, the toes curled. The left foot (+x) wears the Wingfolk's copper ring ──
  let ringA!: THREE.Group;
  const legs: THREE.Group[] = [];
  const HIP_X = 0.05;
  for (const sx of [-1, 1]) {
    const p = onTorso(0.36, PI / 2 + sx * 0.55, -0.02);
    const hip = group(body, [p.x, p.y, p.z], [HIP_X, sx * 0.1, 0]);
    legs.push(hip);
    add(hip, loft([v(0, 0.03, 0), v(0, -0.04, 0.004), v(0, -0.1, 0.006), v(0, -0.14, 0.004)], curveTable([[0, 0, 0], [0.1, 0.03, 0.032], [0.6, 0.024, 0.026], [0.92, 0.022, 0.024], [1, 0, 0]]), { segs: 12, radial: 10, side: X }), M.yellow).userData.inkGroup = LEG;
    // Curled toes: three curling forward (the one pointing back is hidden in the belly feathers, to save faces)
    const foot = group(hip, [0, -0.135, 0.006]);
    for (const [yaw, len] of [[-0.4, 0.05], [0, 0.058], [0.4, 0.05]] as [number, number][]) {
      const tg = group(foot, [0, 0, 0], [0, yaw, 0]);
      const pts = [v(0, 0, 0), v(0, -0.012, len * 0.5), v(0, -0.03, len * 0.8), v(0, -0.05, len * 0.72)];
      add(tg, loft(pts, curveTable([[0, 0, 0], [0.12, 0.012, 0.012], [0.7, 0.01, 0.01], [1, 0, 0]]), { segs: 7, radial: 6, side: X }), M.yellow).userData.inkGroup = LEG;
      const tp = [v(0, -0.048, len * 0.74), v(0, -0.06, len * 0.62), v(0, -0.064, len * 0.45)];
      add(tg, loft(tp, (t) => { const k = Math.pow(1 - t, 0.8); return [0.0075 * k + 0.0006, 0.008 * k + 0.0006]; }, { segs: 6, radial: 6, side: X }), M.talon);
    }
    if (sx > 0) {
      ringA = group(hip, [0, -0.07, 0.004]);
      add(ringA, lathe([[0.028, -0.013], [0.033, -0.01], [0.034, 0.01], [0.028, 0.013]], 16), M.brass);
    }
  }

  // ── Head: neck turns the body's forward lean back, so the face looks level; look handles the jerky head turns, and the head's origin is at the center of the skull ──
  const neckPt = torsoPts[torsoPts.length - 1];
  const neck = group(body, [neckPt.x, neckPt.y, neckPt.z], [-PITCH, 0, 0]);
  const look = group(neck);
  look.rotation.order = 'YXZ';
  const HR = 0.168;
  const HOFF = v(0, 0.075, 0.08);
  // The head lifted up a little: from the side the upper edge of the beak is roughly level and the gaze forward, not as if looking down (pitfalls 44, 71)
  const HEAD_UP = -0.2;
  const head = group(look, [HOFF.x, HOFF.y, HOFF.z]);
  const HS: V3 = [1, 0.93, 1.06];

  // The position of the eye: in direction eyeD, buried a little inward from the skull surface
  // The eye is about twenty percent of the head's width in diameter (no doll eyes)
  const ER = 0.19 * HR;
  const eyeD = v(0.6, 0.2, 0.77).normalize();
  const surfR = (d: THREE.Vector3) => HR / Math.sqrt((d.x / HS[0]) ** 2 + (d.y / HS[1]) ** 2 + (d.z / HS[2]) ** 2);
  const EYE_LON = Math.atan2(eyeD.x, eyeD.z);
  const EYE_LAT = Math.asin(eyeD.y);
  const EYE_ANG = ER / HR;

  // The skull is a blue head hood; the white cheeks and white throat and the two malar stripes are all thin patches laid on the skull
  add(head, new THREE.SphereGeometry(HR, 40, 26), M.hood, [0, 0, 0], [0, 0, 0], HS).userData.inkGroup = HEAD;
  // White cheeks: the lower edge of the head hood passes from the two sides of the beak root directly below the eye and draws up a little behind the eye, then sinks back into the neck feathers
  const hood = curveTable([[0, -0.1], [0.3, -0.06], [EYE_LON, EYE_LAT - EYE_ANG - 0.07], [0.95, -0.1], [1.2, -0.06], [1.55, -0.34], [1.95, -1.3]]);
  const L0 = 1.95;
  add(head, skinPatch((u, w) => {
    const lon = (2 * u - 1) * L0;
    const top = hood(Math.abs(lon))[0];
    return [lon, THREE.MathUtils.lerp(-1.42, top, w)];
  }, 56, 7, HR, HS, 0.0012), M.white).userData.inkGroup = HEAD;
  // Malar stripe: a dark blue teardrop mark hanging directly below the eye, wide at the top and narrow at the bottom, the lower end round
  const MA: [number, number] = [EYE_LON * 1.02, EYE_LAT - EYE_ANG * 0.55];
  const MB: [number, number] = [EYE_LON - 0.02, EYE_LAT - 0.84];
  for (const sx of [-1, 1]) {
    add(head, skinPatch((u, w) => {
      const lon = THREE.MathUtils.lerp(MA[0], MB[0], u);
      const lat = THREE.MathUtils.lerp(MA[1], MB[1], u);
      const half = THREE.MathUtils.lerp(0.125, 0.08, u) * (u > 0.82 ? Math.sqrt(Math.max(0, 1 - ((u - 0.82) / 0.18) ** 2)) : 1);
      // The lateral direction follows longitude (divided by cos latitude, so the width is uniform)
      return [sx * (lon + ((2 * w - 1) * half) / Math.cos(lat)), lat];
    }, 12, 4, HR, HS, 0.0024), M.navy).userData.inkGroup = HEAD;
  }
  // Beak: a yellow hooked beak, the beak tip dark; the upper beak goes forward from the cere with the tip hooking down, the lower beak short and tucked into the upper; the cere yellow, with a round nostril on each side
  const hv = (x: number, y: number, z: number) => v(x * HR, y * HR, z * HR);
  const hookTip = hv(0, -0.2, 1.36);
  const upper = loft([hv(0, 0.16, 0.8), hv(0, 0.14, 1.04), hv(0, 0.06, 1.24), hv(0, -0.1, 1.36), hv(0, -0.3, 1.34)],
    curveTable([[0, 0, 0], [0.06, 0.27 * HR, 0.26 * HR], [0.3, 0.25 * HR, 0.24 * HR], [0.6, 0.17 * HR, 0.17 * HR], [0.85, 0.085 * HR, 0.095 * HR], [1, 0, 0]]), { segs: 22, radial: 14, side: X });
  add(head, paint(upper, (p) => C(YEL).lerp(C(TIP), 1 - ss(p.distanceTo(hookTip), 0.14 * HR, 0.2 * HR))), M.beak).userData.inkGroup = BEAK;
  add(head, loft([hv(0, -0.14, 0.84), hv(0, -0.21, 1.04), hv(0, -0.23, 1.17)], curveTable([[0, 0, 0], [0.1, 0.25 * HR, 0.13 * HR], [0.6, 0.18 * HR, 0.1 * HR], [1, 0, 0]]), { segs: 12, radial: 10, side: X }), M.yellow).userData.inkGroup = BEAK;
  add(head, loft([hv(0, 0.17, 0.82), hv(0, 0.15, 0.97), hv(0, 0.12, 1.08)], curveTable([[0, 0, 0], [0.15, 0.3 * HR, 0.27 * HR], [0.7, 0.28 * HR, 0.25 * HR], [1, 0, 0]]), { segs: 10, radial: 14, side: X }), M.yellow).userData.inkGroup = BEAK;
  for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(1, 6, 4), M.nostril, [sx * 0.13 * HR, 0.2 * HR, 1.02 * HR], [0, sx * 0.5, 0], [0.028 * HR, 0.028 * HR, 0.02 * HR]);

  // Eyes: a falcon's eyes half set into the socket, wrapped by yellow eyelids (which are the falcon's yellow eye ring); the eyeball, iris and pupil are all dark (dark brown close to black), with no sclera showing and no pale iris,
  // only a small point of highlight; wide and round, looking level. The iris, pupil and highlight are wrapped in a separate gaze group turned slightly forward, so both eyes look forward together (pitfall 43); the brow ridge presses down from above without covering the eye
  const eyeA: THREE.Group[] = [];
  const lids: { up: THREE.Group; lo: THREE.Group }[] = [];
  const his: THREE.Mesh[] = [];
  const UP_OPEN = 1.05;
  const LO_OPEN = 0.93;
  const lidUp = lidLow(ER + 0.003, ER + 0.009, PI / 2);
  const lidLo = lidLow(ER + 0.003, ER + 0.008, PI / 2);
  const irisGeo = paint(capLow(ER + 0.0008, 0.8, 22, 5), (p) => C(0x1a110c).lerp(C(0x2a1b12), ss(-p.y / ER, 0.2, 0.7)));
  for (const sx of [-1, 1]) {
    const d = v(sx * eyeD.x, eyeD.y, eyeD.z);
    const c = d.clone().multiplyScalar(surfR(d) - 0.5 * ER);
    const eg = group(head, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.7, 0.05, 0.71).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.14]);
    add(roll, new THREE.SphereGeometry(ER, 18, 12), M.eye).userData.inkGroup = HEAD + 40;
    // gaze: turned a little from the direction the eye faces toward the front and up of the head
    const want = v(0, 0.06, 1).normalize().applyQuaternion(eg.quaternion.clone().multiply(roll.quaternion).invert());
    const gq = new THREE.Quaternion().setFromUnitVectors(FWD, want);
    const ang = 2 * Math.acos(clamp(gq.w, -1, 1));
    const gaze = group(roll);
    gaze.quaternion.copy(new THREE.Quaternion().slerp(gq, Math.min(1, 0.45 / Math.max(ang, 1e-4))));
    add(gaze, irisGeo, M.iris).userData.inkGroup = HEAD + 40;
    add(gaze, capLow(ER + 0.0016, 0.5, 18, 3), M.pupil).userData.inkGroup = HEAD + 40;
    for (const [x, y, r] of [[-0.34, 0.36, 0.15]] as [number, number, number][]) {
      const hd = v(x, y, 1).normalize();
      const hl = add(gaze, new THREE.SphereGeometry(r * ER, 8, 5), M.hi, [hd.x * ER * 1.01, hd.y * ER * 1.01, hd.z * ER * 1.01], [0, 0, 0], [1, 1, 0.45]);
      hl.quaternion.setFromUnitVectors(FWD, hd);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      his.push(hl);
    }
    eyeA.push(group(gaze, [0, 0, ER]));
    // The eyelids turn along with part of the gaze (real eyelids also follow the eyeball), so from the side the iris lands in the middle of the palpebral fissure and is not pressed by the upper lid at the corner of the eye
    const lidG = group(roll);
    lidG.quaternion.copy(new THREE.Quaternion().slerp(gaze.quaternion, 0.65));
    const up = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(up, lidUp, M.yellow).userData.inkGroup = HEAD;
    const lo = group(lidG, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lo, lidLo, M.yellow).userData.inkGroup = HEAD;
    lids.push({ up, lo });
    // Brow ridge: a bony ridge jutting forward above the eye, the same color and outline group as the head hood (part of the skull, not an eyebrow), the inner end slightly lower and the outer end drawing back, almost straight, lying against the upper eye ring without touching the upper lid (pitfall 47)
    const bpts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      bpts.push(v(sx * ER * (-0.8 + 2.1 * u), ER * 1.07 + 0.0045 + 0.007 * Math.min(1, u * 1.8) + 0.002 * Math.sin(PI * u), ER * (0.62 - 0.45 * u)));
    }
    add(roll, loft(bpts, (tt) => { const k = Math.pow(Math.sin(PI * tt), 0.5) * ss(tt, 0, 0.3); return [0.014 * k, 0.01 * k]; }, { segs: 14, radial: 8 }), M.hood).userData.inkGroup = HEAD;
  }

  // Crest (the origin of crestG is at the feather roots; in wind the whole sheet trembles about the roots): three pointed feathers spreading back and up from the top of the head, the middle one longest and the two on the sides lying back;
  // blue roots, dark blue bodies, gold tips, like a crown made of feathers (pitfall 74: three pointed feathers with thickness and different elevations)
  const CR = hv(0, 0.7, -0.6);
  const crestG = group(head, [CR.x, CR.y, CR.z]);
  const CREST_LEN = 0.3;
  {
    const cr = [hv(-0.3, 0.6, -0.56), hv(0, 0.7, -0.6), hv(0.3, 0.6, -0.56)].map((p) => p.sub(CR));
    const cdir = (s: number) => {
      const a = 2 * s - 1;
      const yaw = a * 0.45;
      const el = 0.52 - 0.3 * Math.abs(a);
      return v(Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el));
    };
    const crest = featherSheet({
      root: cr,
      dir: cdir,
      normal: (s) => new THREE.Vector3().crossVectors(X, cdir(s)).normalize(),
      len: (s) => CREST_LEN * (0.7 + 0.3 * Math.pow(Math.cos((s - 0.5) * PI), 2)),
      bend: (_s, d) => 1.1 * d * d,
      pointy: 0.6,
      feather: (s) => s * 3,
      notch: () => 0.62,
      thick: (_s, c) => 0.016 * (0.3 + 0.7 * (1 - c)),
      rows: 36,
      cols: 6,
      color: (_s, c) => C(HOOD).lerp(C(NAVY), ss(c, 0.25, 0.55)).lerp(C(GOLD), ss(c, 0.74, 0.86)),
    });
    add(crestG, crest.geo, M.feather).userData.inkGroup = HEAD;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const rig = {
    head: group(look, [HOFF.x, HOFF.y, HOFF.z + HR * 0.6]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [0, -0.2 * HR, 1.37 * HR]),
      crest: group(crestG, [0, CREST_LEN * 0.5, -CREST_LEN * 0.85]),
      wingTipL: wings[0].tipA,
      wingTipR: wings[1].tipA,
      tail: tailTipA,
      streamerL: streamers[0].tipA,
      streamerR: streamers[1].tipA,
      ring: ringA,
    },
  };
  const act = { tuck: 0, flare: 0 };

  // Static parts merged (mesh budget N 40): nodes that move when idle act as owners, and the body (scaling with the breathing) and the eye highlights (switched on and off when blinking) are not merged
  mergeStatic(root, {
    owners: [fly, pitchG, ...wings.map((w) => w.wg), neck, look, head, tailG, ...streamers.map((s) => s.g), ...legs, crestG, ...lids.flatMap((l) => [l.up, l.lo])],
    keep: [torso, ...his],
    rig,
  });

  // ── Idle: fixed in the updraft. The body slowly rises, falls and rolls with the air currents, and the wing tips and tail fan correct half a beat behind; the head held steady (cancelling the body's nodding and rolling),
  //    turning in jerks to lock onto targets; the crest and long tail feathers tremble in the wind; blinking. All computed from t, so frame-by-frame screenshots at frozen time are consistent too (pitfall 80) ──
  const LOOKS = [0.16, -0.12, 0.3, 0.02, -0.22, 0.2, -0.04];
  const LOOK_T = 1.7;
  const lookAt = (t: number) => {
    const u = t / LOOK_T;
    const i = Math.floor(u);
    const f = u - i;
    const n = LOOKS.length;
    return THREE.MathUtils.lerp(LOOKS[((i % n) + n) % n], LOOKS[(((i + 1) % n) + n) % n], ss(f, 0.82, 0.92));
  };
  const BLINK = 3.3;
  const update = (t: number) => {
    const L = THREE.MathUtils.lerp;
    const tk = act.tuck;
    const fl = act.flare;
    const bob = Math.sin(t * 0.9);
    const bank = Math.sin(t * 0.45) * 0.06 + Math.sin(t * 1.3) * 0.012;
    fly.position.y = FLY_Y + bob * 0.022 + fl * 0.05;
    const pitch = PITCH + Math.sin(t * 0.9 - 0.6) * 0.025 + tk * 0.55 - fl * 0.1;
    pitchG.rotation.set(pitch, 0, bank);
    const br = Math.sin(t * 1.6);
    torso.scale.set(1 + br * 0.008, 1, 1 + br * 0.01);
    // Wings: when held up by the air current the wing tips move up and down half a beat behind, with a very small twist as well; when folded they draw back into an arrow shape, and when spread they sweep up
    for (const r of wings) {
      const flex = Math.sin(t * 0.9 - 0.9 + r.sx * 0.15) * 0.045 - bank * r.sx * 0.3;
      r.wg.rotation.set(L(0, 0.3, tk) + Math.sin(t * 1.1 + r.sx) * 0.015, r.sx * L(0, -0.9, tk), -r.sx * (flex + L(0, 0.35, tk) - fl * 0.28));
    }
    // Head: cancelling the body's nodding and most of its rolling, looking level; turning in jerks
    neck.rotation.set(-pitch + L(0, 0.35, tk), 0, 0);
    look.rotation.y = lookAt(t) * (1 - tk);
    look.rotation.x = Math.sin(t * 0.53) * 0.02;
    head.rotation.set(HEAD_UP + L(0, 0.15, tk), 0, -bank * 0.85);
    // Tail fan: steering along with the roll, the long tail feathers flicking half a beat behind
    tailG.rotation.set(0.05 + Math.sin(t * 0.9 - 1.2) * 0.04 - tk * 0.2, Math.sin(t * 0.45 - 0.8) * 0.08, 0);
    for (const s of streamers) s.g.rotation.set(Math.sin(t * 1.7 + s.sx) * 0.07 + Math.sin(t * 3.1 + s.sx * 2) * 0.02, 0, s.sx * (0.03 + Math.sin(t * 1.2 + s.sx * 0.7) * 0.05));
    for (const l of legs) l.rotation.x = HIP_X + Math.sin(t * 0.9 - 1.6) * 0.04;
    // The crest trembles in the wind; laid flat when the wings are folded and raised when they are spread
    crestG.rotation.set(Math.sin(t * 2.9) * 0.025 + Math.sin(t * 1.3) * 0.02 + tk * 0.3 - fl * 0.25, 0, Math.sin(t * 1.1 + 0.5) * 0.03);

    // Blink: the upper and lower lids close together toward the midline (pitfall 46); the eyeball is dark, so when closed a gap left between the two lids is the line of the closed eye (pitfall 70); the highlight is hidden once it is more than half closed
    const bt = ((t + 1.1) % BLINK) / 0.2;
    const close = bt < 1 ? Math.min(1, Math.sin(bt * PI) * 1.3) : 0;
    for (const l of lids) {
      l.up.rotation.x = -UP_OPEN + (UP_OPEN - 0.16) * close;
      l.lo.rotation.x = PI + LO_OPEN - (LO_OPEN - 0.16) * close;
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
