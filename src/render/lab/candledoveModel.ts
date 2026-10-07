// Haloed Dove (model lab version): a dove of the Holy City's bell tower, with a ring of candlelight along the edges of its wings; every morning when the bell rings it flies once around the Holy City, scattering light on the streets that have not yet woken.
// Light and wind, N, peace / light curtain (trait "Bell of Peace": on entering, both sides' stat stages reset to zero).
// Only one form (decided by the user, 2026-09-28): the builder ignores the evolution stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features:
//   1. A ring of golden halo floating above its head, tilted slightly back.
//   2. Real bird wings: feather surfaces joining two layers, flight feathers and coverts, into one sheet, with a thin line of warm yellow candlelight inlaid along the trailing edge of the flight feathers (only a rim light, not an entire yellow wing).
//   3. A red satin ribbon around the neck, with a small bronze bell of the bell tower hanging in front of the throat; on the back the ribbon is tied into a bow at the nape, with the two ribbon tails blown back by the wind.
//   4. An all-white dove: a plump breast, a small round head, a pink-gray short beak and a white cere.
// Body shape follows the design: it is flying, so it hovers in midair at all times and does not stand. The flying posture is consistent with the game's other flying birds (following Aeroth's approach):
//   the body tilts forward about forty degrees, the breast bulging forward and down, the neck curving back up so the head looks level; the tail feathers spread into a fan pressed back and down;
//   the pink feet are tucked under the belly and trailing back, with the toes clenched, not standing straight on thin air.
// The wingbeat follows a hovering bird (Aeroth's flap cycle, with fewer parts): the flap axis runs along the wing surface, leaning forward from the body's long axis; the downstroke presses forward and down and the upstroke draws back and up;
//   at the top the wrist rolls so the underside faces forward (the raised wings show their whole surface from the front, like a dove in a holy icon); on the upstroke the hand folds back at the wrist and the primaries turn on edge,
//   with the hand carried along half a beat behind the wing. The feather surfaces beyond the wrist rotate about the wrist vertex by vertex on the CPU, and the candlelight edge turns with them. The body is lifted after the downstroke, and the head stays steady and does not sway along.
// The face follows a real dove, not anthropomorphized: small dark eyes (diameter about 17% of the head width) with a thin pale blue-gray eye ring around them and only one small highlight;
//   no sclera, no pale iris and no doll eyes with concentric circles. The beak is closed, with no mouth line drawn.
// Personality: a gentle but earnest peacemaker who flies over to ring the bell whenever anyone is quarreling. It tilts its head slightly to look at people, its wingbeats steady, and the bell always swinging lightly.
// Gaze order: the face (white head, small dark eyes, pink-gray beak) first, the halo second, and the candlelight on the wing trailing edges and the bronze bell in front of the throat as support.
// Back speaks of the bell tower's dove: the red bow at the nape with two ribbon tails blown open by the wind, and the backs of the raised wings white all the way to the candlelight on the trailing edge.
// Restrained light effects: the emissive is kept only on the halo and the candlelight edges, with no bloom.
//
// <Action table> (act weights 0-1)
//   Idle: hovering and flapping, the body dipping and rising, the head steady with an occasional head tilt, the halo slowly turning, the bronze bell and ribbon tails swaying lightly, blinking.
//   Move: flaps just as steadily, with the body leaning further forward as it glides along.
//   Charge-up (glow): both wings raised high and drawn together, underside facing forward, and the halo and candlelight brighten.
//   Strike (flap): both wings fan hard forward and down, the chest thrust out, and a light curtain unfolds from the halo and the chest.
//   Hit: rears back with the wings shielding the body, and the eyes do not close.
//   Victory: rings the bell and circles once in a small loop back to its place.
// Anchors: head, eyes, mouth (beak tip), halo (center of the halo), bell (the bronze bell), wingL, wingR (wing tips, folding with the hand).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rng, smooth, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const C = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Feather sheets ─────────────────────────

interface SheetOpts {
  /** The curve the feather roots lie along (wing bone, tail root), where s is the 0-1 arc-length position */
  root: THREE.Vector3[];
  /** The direction the feather grows outward at s (a unit vector) */
  dir: (s: number) => THREE.Vector3;
  /** The length of the feather at s (not including the notch at the feather tip) */
  len: (s: number) => number;
  /** Direction of the underside (the thickness runs along it), the other side being the back */
  normal: (s: number) => THREE.Vector3;
  /** s → feather coordinate: integers are the boundaries between feathers */
  feather: (s: number) => number;
  /** Ratio by which the trailing edge shortens between feathers */
  notch: (s: number) => number;
  /** This layer's own half thickness (c runs along the feather from 0 root to 1 tip) */
  thick: (s: number, c: number) => number;
  /** Half thickness of the layer underneath at the same point (d is the distance from the feather root): this layer is stacked on top of it */
  under?: (s: number, d: number) => number;
  /** Bending of the feather surface: displacement toward the underside; every layer of the same wing shares it, so they stack tightly */
  bend?: (s: number, d: number) => number;
  groove?: number;
  rachis?: number;
  /** Vertex color: side = -1 is the back, 1 the underside */
  color?: (s: number, c: number, side: number) => THREE.ColorRepresentation;
  rows: number;
  cols: number;
  /** Sample points along the feather (0 root to 1 tip); when given, the even split by cols is not used. The candlelight edge takes only the trailing-edge stretch */
  cs?: number[];
  /** The extra distance each face floats outward (for a shell laid on the outside of another feather surface) */
  shell?: number;
}

interface Sheet {
  geo: THREE.BufferGeometry;
  /** The half thickness at s, at distance d from the feather root (for the layer stacked on top of it) */
  h: (s: number, d: number) => number;
  /** The feather-root position s of each vertex (on the upstroke it decides how much each follows the wrist's fold) */
  s: Float32Array;
}

/**
 * A feather surface joined into one sheet (the featherSheet of Aeroth and Skyreign, with the segment counts and sample points turned into parameters): along the feather-root curve, each point grows a feather toward dir,
 * with the trailing edge cut into a row of round-headed feather tips and grooves pressed in between feathers. The cross-section is a full ring, and the thickness shrinks to 0 at both ends to close naturally.
 * The whole sheet is one part, so the outline falls only on the scalloped edge of the feather tips and the creases of the grooves, and does not outline every feather separately like sheets of separate feathers (pitfall 20).
 */
function featherSheet(o: SheetOpts): Sheet {
  const path = new THREE.CatmullRomCurve3(o.root, false, 'centripetal');
  const R = o.rows;
  const cs = o.cs ?? Array.from({ length: o.cols + 1 }, (_, k) => 1 - Math.pow(1 - k / o.cols, 1.6));
  const K = cs.length - 1;
  const groove = o.groove ?? 0.3;
  const shell = o.shell ?? 0;
  const J = 2 * K + 2;
  const pos: number[] = [];
  const colr: number[] = [];
  const sv = new Float32Array((R + 1) * J);
  const P = new THREE.Vector3();
  const tc = new THREE.Color();
  const shape = (s: number) => {
    const u = o.feather(s);
    const w = u - Math.floor(u);
    const tip = Math.sqrt(Math.max(0, 1 - (2 * w - 1) ** 2));
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
      const h = hAt(s, c, w, tip, L, e) + shell * e;
      const b = o.bend ? o.bend(s, c * L) : 0;
      const off = b + side * h;
      pos.push(P.x + D.x * c * L + N.x * off, P.y + D.y * c * L + N.y * off, P.z + D.z * c * L + N.z * off);
      sv[i * J + j] = s;
      if (o.color) tc.set(o.color(s, c, side === 0 ? 1 : side));
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
  // Winding check: the normal of the middle row, middle of the underside, must face the underside, and if reversed the sheet is flipped (after mirroring the left and right sides the winding is opposite)
  const mi = Math.floor(R / 2) * J + K + Math.floor(K / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, mi);
  if (nrm.dot(o.normal(0.5)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return {
    geo: g,
    s: sv,
    h: (s, d) => {
      const { w, tip, L, e } = shape(s);
      return d >= L ? 0 : hAt(s, d / L, w, tip, L, e);
    },
  };
}

/**
 * A low-segment fur collar (Skyreign's lowCollar): a whole ring of feathers joined together, the trailing edge cut into clumps of pointed tips with grooves pressed in between clumps.
 * At the two ends of a partial arc the thickness shrinks to 0 to close naturally.
 */
function lowCollar(o: FurCollarOpts, segS = 5, per = 5): THREE.BufferGeometry {
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

/** A low-segment eyelid spherical shell (lidGeometry in shapes.ts): with +y as the top, covering from the top down to lip radians, with a round lip at the edge */
function lidLow(ri: number, ro: number, lip: number, seg = 16, n = 4): THREE.BufferGeometry {
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
function capLow(r: number, ang: number, seg = 18, rings = 4): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** Recompute the normals after changing positions vertex by vertex (the outer wing section bends back) */
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

/** Merge several geometries into one: keeping only positions, normals and vertex colors; if one has no index, one is filled in */
function mergeParts(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const keep = ['position', 'normal', 'color'];
  return mergeGeometries(
    gs.map((g) => {
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
      return g;
    }),
    false,
  )!;
}

// ───────────────────────── Shape ─────────────────────────

export function buildCandledoveLab(): LabModel {
  const RIMC = 0xfff0cc;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const WHITE = 0xfbf9fd;
  const SHADE = 0xe6e1ee;
  const WARM = 0xfff3da;
  const M = {
    feather: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    beak: vc(labToon(0xffffff, { rim: 0.35, rimColor: RIMC, spec: 0.14, specTh: 0.994 })),
    ring: labToon(0xc3cddd, { rim: 0.3, rimColor: RIMC }),
    eye: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    halo: labToon(0xffd978, { ramp: 'metal', spec: 0.6, specTh: 0.97, emissive: 0xffbe40, emissiveAmt: 0.42, rim: 0.3, rimColor: 0xfff4d0 }),
    candle: labToon(0xffe2a0, { ramp: 'gem', emissive: 0xffb040, emissiveAmt: 0.55, rim: 0 }),
    bronze: vc(labToon(0xffffff, { ramp: 'metal', spec: 0.8, specTh: 0.97, rim: 0.35, rimColor: 0xffe2a8 })),
    ribbon: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xffd0d0, spec: 0.25, specTh: 0.99 })),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'candledove-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group; groups spaced 10 or more apart, so BASE + n never collides
  const BODY = 9901;
  const WING_L = 9911;
  const WING_R = 9921;
  const TAIL = 9931;
  const BEAK = 9941;
  const HALO = 9951;
  const RIB = 9961;
  const BELL = 9971;
  const LEG = 9981;
  const EYE = 9991;

  // ── Skeleton: place moves the whole thing onto the pivot; fly is the hovering center of gravity, dipping and rising with the wingbeat; pitchG tilts the body forward (modeled upright and then tipped forward);
  //    body holds the upright modeling coordinates: spine along +y, belly side toward +z, with the origin below PIV ──
  const FLY_Y = 0.62;
  const PITCH = 0.68;
  const PIV = v(0, 0.66, 0);
  const place = group(root);
  const fly = group(place, [0, FLY_Y, 0]);
  const pitchG = group(fly, [0, 0, 0], [PITCH, 0, 0]);
  const body = group(pitchG, [-PIV.x, -PIV.y, -PIV.z]);

  // ── Torso: one whole loft from the tail root up to the neck. The plump breast bulges toward the belly side; the neck curves back toward the back side, and after the body tilts forward the neck is nearly straight, so the head looks level ──
  const torsoPts = [v(0, 0.4, -0.11), v(0, 0.47, -0.07), v(0, 0.58, -0.01), v(0, 0.71, 0.03), v(0, 0.83, 0.035), v(0, 0.93, 0.0), v(0, 0.99, -0.045)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.04, 0.05, 0.045, 0],
    [0.16, 0.11, 0.11, 0],
    [0.36, 0.165, 0.175, 0.012],
    [0.52, 0.18, 0.198, 0.03],
    [0.68, 0.16, 0.172, 0.022],
    [0.82, 0.118, 0.118, 0.006],
    [0.93, 0.092, 0.092, 0],
    [1, 0, 0, 0],
  ]);
  const torsoPath = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal');
  /** The point on the torso surface at t, at angle th around the spine (th = PI/2 is the belly side, -PI/2 the back side, 0 is +x) */
  const torsoFrame = (t: number) => {
    const Cc = torsoPath.getPointAt(t);
    const T = torsoPath.getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, FWD).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    return { Cc, T, W, H };
  };
  const onTorso = (t: number, th: number, lift = 0) => {
    const { Cc, W, H } = torsoFrame(t);
    const [a, b, dy] = torsoProf(t);
    return Cc.addScaledVector(W, Math.cos(th) * (a + lift)).addScaledVector(H, Math.sin(th) * (b + lift) + dy);
  };
  // The belly side carries a touch of pale purple-gray shadow (a dove's white is not a dead flat white), with a wide transition, only on the lower belly away from the light
  const VENT = v(0, -0.55, 0.8).normalize();
  add(body, paint(loft(torsoPts, torsoProf, { segs: 36, radial: 26, up: FWD }), (_p, n) => C(WHITE).lerp(C(SHADE), ss(n.dot(VENT), 0.2, 0.85) * 0.7)), M.feather).userData.inkGroup = BODY;

  // ── Scapulars: a sheet of white feathers on the back draping toward the tail and covering the wing roots on both sides, so the wings really grow from the body ──
  {
    const { Cc, T } = torsoFrame(0.78);
    const y = T.clone();
    const z = v(0, 0, -1).addScaledVector(y, y.z).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(body, paint(lowCollar({ r0: 0.122, len: 0.22, thick: 0.05, flare: 0.3, curl: 0.2, tufts: 7, notch: 0.38, jitter: 0.12, a0: -1.9, a1: 1.9, seed: 9 }, 5, 5), (p) => C(WHITE).lerp(C(SHADE), ss(-p.y, 0.12, 0.2) * 0.45)), M.feather);
    m.position.copy(Cc);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    m.userData.inkGroup = BODY;
  }

  // ── Feet: tucked under the belly and trailing toward the tail, the tarsi short and the toes clenched; the thighs buried in the belly feathers ──
  {
    const pink = C(0xea9aa8);
    const pinkD = C(0xc97486);
    for (const sx of [-1, 1]) {
      const hp = onTorso(0.3, PI / 2 + sx * 0.42, -0.035);
      const hip = group(body, [hp.x, hp.y, hp.z], [0.35, sx * 0.12, 0]);
      const ank = v(0, -0.085, -0.012);
      add(hip, paint(loft([v(0, 0.02, 0), v(0, -0.03, -0.004), ank], curveTable([[0, 0, 0], [0.12, 0.022, 0.024], [0.6, 0.017, 0.018], [1, 0.014, 0.015]]), { segs: 8, radial: 8, side: X }), () => pink.clone()), M.beak).userData.inkGroup = LEG;
      // The three forward toes curl toward the belly side, and one short toe points back
      for (const [yaw, len] of [[-0.42, 0.042], [0, 0.05], [0.42, 0.042], [PI, 0.026]] as [number, number][]) {
        const tg = group(hip, [ank.x, ank.y, ank.z], [0, yaw, 0]);
        const back = yaw === PI;
        const pts = back ? [v(0, 0, 0), v(0, -0.012, len * 0.7), v(0, -0.022, len)] : [v(0, 0, 0), v(0, -0.014, len * 0.55), v(0, -0.03, len * 0.8), v(0, -0.042, len * 0.6)];
        add(tg, paint(loft(pts, curveTable([[0, 0, 0], [0.14, 0.011, 0.011], [0.75, 0.0085, 0.0085], [1, 0, 0]]), { segs: 6, radial: 6, side: X }), (p) => pink.clone().lerp(pinkD, ss(-p.y, 0.015, 0.04))), M.beak).userData.inkGroup = LEG;
      }
    }
  }

  // ── Wings: hovering flap. The wing bone (leading edge) runs outward from the shoulder, tipping slightly forward at the wrist and then outward and back to the hand tip;
  //    two layers joined into one feather surface: the flight feathers (longest, with the primaries slightly separated) and the coverts, with the covert tips covering the flight feather roots; a thin candlelight shell is laid again on the outside of the flight feathers' trailing edge.
  //    When modeled the wing surface lies flat in sh's xy plane (feathers growing toward the tail, underside toward +z); sh tips the flap axis forward from the body's long axis by WING_AXIS;
  //    wg performs three rotations inside sh: the flap (about y), the twist of the wing surface (about the wingspan), and the whole sheet drawing back (within the wing surface);
  //    the hand beyond the wrist is additionally folded about the wrist on the CPU ──
  interface WingSkin { attr: THREE.BufferAttribute; nattr: THREE.BufferAttribute; rest: Float32Array; restN: Float32Array; w: Float32Array; idx: Uint32Array }
  interface WingRig { sx: number; wg: THREE.Group; skins: WingSkin[]; W: THREE.Vector3; hand: THREE.Vector3; tip: THREE.Vector3; tipA: THREE.Group }
  const wings: WingRig[] = [];
  const skinned: THREE.Mesh[] = [];
  const S_W = 0.55;
  const WS = 0.92;
  const phi = curveTable([[0, -1.62], [0.3, -1.55], [0.55, -1.32], [0.8, -1.0], [1, -0.74]]);
  const flightLen = curveTable([[0, 0.17 * WS], [0.3, 0.27 * WS], [0.55, 0.31 * WS], [0.82, 0.38 * WS], [1, 0.31 * WS]]);
  const featherU = (s: number) => (s < S_W ? (s / S_W) * 6 : 6 + ((s - S_W) / (1 - S_W)) * 6);
  const WING_AXIS = 0.24;
  const DIHEDRAL = 0.2;
  const curveBack = (g: THREE.BufferGeometry) => warp(g, (p) => { const r = Math.hypot(p.x, p.y); p.z -= DIHEDRAL * Math.max(0, r - 0.12) ** 2; });
  const handW = (s: number) => ss(s, S_W - 0.05, S_W + 0.07);
  for (const sx of [-1, 1]) {
    const WG = sx < 0 ? WING_L : WING_R;
    const sh = group(body, [sx * 0.105, 0.84, -0.035], [WING_AXIS, 0, 0]);
    const wg = group(sh);
    wg.rotation.order = 'YXZ';
    const arm = [v(0, 0, 0), v(sx * 0.1, 0.03, 0), v(sx * 0.2, 0.065, 0.005), v(sx * 0.28, 0.08, 0), v(sx * 0.38, 0.06, -0.005), v(sx * 0.47, 0.02, -0.01)].map((p) => p.multiplyScalar(WS));
    const dir = (s: number) => { const a = phi(s)[0]; return v(sx * Math.cos(a), Math.sin(a), 0); };
    const N = () => FWD;
    // Bending of the feather surface: the underside slightly concave, with the tips of the primaries curling toward the back
    const bend = (s: number, d: number) => {
      const c = Math.min(1, d / flightLen(s)[0]);
      return -0.03 * Math.sin(PI * c) - 0.07 * c * c * ss(s, 0.45, 1);
    };
    const fThick = (_s: number, c: number) => 0.01 * (0.3 + 0.7 * (1 - c));
    const fNotch = (s: number) => 0.12 + 0.22 * ss(s, 0.5, 0.62);
    // Flight feathers: white on the back and a faint gray-purple on the underside; slightly warmer near the trailing edge (candlelight cast on the feathers), with a narrow transition so it does not become one big yellow sheet
    const flight = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0],
      feather: featherU,
      notch: fNotch,
      thick: fThick,
      groove: 0.35,
      rachis: 0.004,
      rows: 66,
      cols: 5,
      color: (_s, c, side) => (side < 0 ? C(WHITE) : C(0xeeebf4).lerp(C(WHITE), ss(c, 0.3, 0.7))).lerp(C(WARM), ss(c, 0.8, 0.9) * 0.45),
    });
    // Candlelight: a shell over the last tenth of the flight feathers' trailing edge, floating out a tiny bit on each face over the flight feathers; the same outline group, so the inner edge has no extra line
    const band = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0],
      feather: featherU,
      notch: fNotch,
      thick: fThick,
      groove: 0.35,
      rachis: 0.004,
      rows: 66,
      cols: 4,
      cs: [0.905, 0.908, 0.95, 0.985, 1],
      shell: 0.0012,
    });
    const coverts = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0] * 0.5,
      feather: (s) => featherU(s) * 1.4 + 0.5,
      notch: () => 0.28,
      thick: (_s, c) => 0.005 + 0.007 * (1 - c),
      under: flight.h,
      groove: 0.4,
      rows: 56,
      cols: 4,
      color: (_s, c, side) => (side < 0 ? C(WHITE) : C(0xf1eef6).lerp(C(WHITE), ss(c, 0.4, 0.9))),
    });
    // Wing bone: one rounded piece of flesh along the leading edge, covering the roots of the two layers; its vertices use the nearest point on the wing bone as s
    const armGeo = paint(loft(arm, curveTable([[0, 0, 0], [0.04, 0.042, 0.042], [0.3, 0.037, 0.033], [0.6, 0.029, 0.025], [0.9, 0.019, 0.017], [1, 0, 0]]), { segs: 24, radial: 10, up: FWD }), () => C(WHITE));
    const armPath = new THREE.CatmullRomCurve3(arm, false, 'centripetal');
    const armS = (() => {
      const samples = Array.from({ length: 81 }, (_, i) => armPath.getPointAt(i / 80));
      const pa = armGeo.attributes.position as THREE.BufferAttribute;
      const out = new Float32Array(pa.count);
      const p = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) {
        p.fromBufferAttribute(pa, i);
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < samples.length; k++) {
          const d = p.distanceToSquared(samples[k]);
          if (d < bd) { bd = d; best = k; }
        }
        out[i] = best / 80;
      }
      return out;
    })();
    // Flight feathers, coverts and wing bone share the same material and outline group, merged into one mesh (CPU deformation then needs to change only one buffer)
    const sheetGeo = mergeParts([flight.geo, coverts.geo, armGeo]);
    const sheetS = new Float32Array(flight.s.length + coverts.s.length + armS.length);
    sheetS.set(flight.s, 0);
    sheetS.set(coverts.s, flight.s.length);
    sheetS.set(armS, flight.s.length + coverts.s.length);
    const skins: WingSkin[] = [];
    for (const [geo, sArr, mat] of [[sheetGeo, sheetS, M.feather], [band.geo, band.s, M.candle]] as [THREE.BufferGeometry, Float32Array, THREE.Material][]) {
      if (mat === M.candle) geo.deleteAttribute('color');
      const m = add(wg, curveBack(geo), mat);
      m.userData.inkGroup = WG;
      m.frustumCulled = false;
      skinned.push(m);
      const attr = geo.attributes.position as THREE.BufferAttribute;
      const nattr = geo.attributes.normal as THREE.BufferAttribute;
      const w = new Float32Array(attr.count);
      const idx: number[] = [];
      for (let i = 0; i < attr.count; i++) {
        w[i] = handW(sArr[i]);
        if (w[i] > 0) idx.push(i);
      }
      attr.setUsage(THREE.DynamicDrawUsage);
      nattr.setUsage(THREE.DynamicDrawUsage);
      skins.push({ attr, nattr, rest: Float32Array.from(attr.array as Float32Array), restN: Float32Array.from(nattr.array as Float32Array), w, idx: Uint32Array.from(idx) });
    }
    // The wrist (the pivot where the hand folds up) and the direction of the hand bone both have to bend along with curveBack
    const Wp = armPath.getPointAt(S_W);
    const Tip = armPath.getPointAt(1);
    for (const q of [Wp, Tip]) q.z -= DIHEDRAL * Math.max(0, Math.hypot(q.x, q.y) - 0.12) ** 2;
    const tip = Tip.clone().addScaledVector(dir(1), flightLen(1)[0] * 0.9);
    wings.push({ sx, wg, skins, W: Wp, hand: Tip.clone().sub(Wp).normalize(), tip, tipA: group(wg, [tip.x, tip.y, tip.z]) });
  }

  // The hand folds about the wrist (Aeroth's bendHand): fold is the angle of drawing back within the wing surface, roll is the twist along the hand bone's direction (the primaries turn on edge on the upstroke),
  // lag is the hand being half a beat slow. The three rotations are combined into one axis-angle, and every vertex rotates by a fraction of that angle according to its weight, so near the wrist it transitions smoothly from not moving to the whole sheet following the hand
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const qc = new THREE.Quaternion();
  const bendHand = (r: WingRig, fold: number, roll: number, lag: number) => {
    qc.setFromAxisAngle(UP, r.sx * lag);
    qa.setFromAxisAngle(FWD, -r.sx * fold);
    qb.setFromAxisAngle(r.hand, roll * r.sx);
    qa.premultiply(qc).multiply(qb);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(qa.w))) * Math.sign(qa.w || 1);
    const sn = Math.sqrt(Math.max(1e-12, 1 - qa.w * qa.w));
    const kx = qa.x / sn;
    const ky = qa.y / sn;
    const kz = qa.z / sn;
    const { x: wx, y: wy, z: wz } = r.W;
    {
      const c = Math.cos(ang);
      const s1 = Math.sin(ang);
      const px = r.tip.x - wx;
      const py = r.tip.y - wy;
      const pz = r.tip.z - wz;
      const d = kx * px + ky * py + kz * pz;
      r.tipA.position.set(px * c + (ky * pz - kz * py) * s1 + kx * d * (1 - c) + wx, py * c + (kz * px - kx * pz) * s1 + ky * d * (1 - c) + wy, pz * c + (kx * py - ky * px) * s1 + kz * d * (1 - c) + wz);
    }
    for (const sk of r.skins) {
      const P = sk.attr.array as Float32Array;
      const Nn = sk.nattr.array as Float32Array;
      for (let n = 0; n < sk.idx.length; n++) {
        const i = sk.idx[n];
        const a = ang * sk.w[i];
        const c = Math.cos(a);
        const s1 = Math.sin(a);
        const o = i * 3;
        let px = sk.rest[o] - wx;
        let py = sk.rest[o + 1] - wy;
        let pz = sk.rest[o + 2] - wz;
        let d = kx * px + ky * py + kz * pz;
        P[o] = px * c + (ky * pz - kz * py) * s1 + kx * d * (1 - c) + wx;
        P[o + 1] = py * c + (kz * px - kx * pz) * s1 + ky * d * (1 - c) + wy;
        P[o + 2] = pz * c + (kx * py - ky * px) * s1 + kz * d * (1 - c) + wz;
        px = sk.restN[o];
        py = sk.restN[o + 1];
        pz = sk.restN[o + 2];
        d = kx * px + ky * py + kz * pz;
        Nn[o] = px * c + (ky * pz - kz * py) * s1 + kx * d * (1 - c);
        Nn[o + 1] = py * c + (kz * px - kx * pz) * s1 + ky * d * (1 - c);
        Nn[o + 2] = pz * c + (kx * py - ky * px) * s1 + kz * d * (1 - c);
      }
      sk.attr.needsUpdate = true;
      sk.nattr.needsUpdate = true;
    }
  };

  // ── Tail feathers: a fan spreading toward the back and down from the tail root; a dove's tail is a rounded blunt square fan; a layer of upper tail coverts is laid on top ──
  const tailRoot = torsoPath.getPointAt(0.03);
  const tailG = group(body, [tailRoot.x, tailRoot.y, tailRoot.z + 0.004]);
  {
    const rootPts = [v(-0.055, 0, 0.01), v(0, 0, -0.008), v(0.055, 0, 0.01)];
    const tdir = (s: number) => v((s - 0.5) * 0.9, -1.0, -0.12).normalize();
    const tN = (s: number) => new THREE.Vector3().crossVectors(tdir(s), X).normalize();
    const tLen = (s: number) => 0.27 * (0.9 + 0.1 * Math.cos((s - 0.5) * PI));
    const tbend = (s: number, d: number) => 0.015 * Math.sin(PI * Math.min(1, d / tLen(s))) + 0.07 * ((2 * s - 1) ** 2) * d;
    const tail = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      len: tLen,
      feather: (s) => s * 10,
      notch: () => 0.1,
      thick: (_s, c) => 0.011 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      rows: 52,
      cols: 5,
      color: (_s, c, side) => (side < 0 ? C(WHITE) : C(0xece8f2).lerp(C(WHITE), ss(c, 0.5, 0.9))),
    });
    const cov = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      len: (s) => tLen(s) * 0.42,
      feather: (s) => s * 6 + 0.5,
      notch: () => 0.3,
      thick: (_s, c) => 0.005 + 0.012 * (1 - c),
      under: tail.h,
      rows: 40,
      cols: 4,
      color: () => WHITE,
    });
    add(tailG, mergeParts([tail.geo, cov.geo]), M.feather).userData.inkGroup = TAIL;
  }

  // ── Red satin ribbon: a ring around the neck, the cross-section a flat band (the width along the neck, the thin side against the feathers); the seam is hidden under the bow at the nape ──
  const RED = C(0xd23e52);
  const RED_D = C(0xa82a3e);
  const RIB_T = 0.865;
  {
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) ring.push(onTorso(RIB_T, -PI / 2 + (i / 28) * PI * 2, 0.004));
    const { T } = torsoFrame(RIB_T);
    add(body, paint(loft(ring, () => [0.021, 0.0075], { segs: 56, radial: 6, side: T }), (p) => RED.clone().lerp(RED_D, ss(-p.z, -0.02, 0.08) * 0.35)), M.ribbon).userData.inkGroup = RIB;
  }
  // Bow: two flat loops at the nape with a knot in the middle; the two ribbon tails each hang on their own pivot, blown back by the wind
  const bowTails: { g: THREE.Group; sx: number }[] = [];
  {
    const at = onTorso(RIB_T, -PI / 2, 0.01);
    const { T, H } = torsoFrame(RIB_T);
    const bow = group(body, [at.x, at.y, at.z]);
    // The bow's own coordinates: y along the neck toward the head, z toward the outside of the back
    const bz = H.clone().negate();
    bow.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(T, bz), T, bz));
    for (const sx of [-1, 1]) {
      add(bow, paint(new THREE.TorusGeometry(0.03, 0.011, 6, 14), () => RED.clone()), M.ribbon, [sx * 0.034, 0.004, 0.006], [0, PI / 2 - sx * 0.4, sx * 0.3], [1, 0.72, 1]).userData.inkGroup = RIB + 1;
      const tg = group(bow, [sx * 0.008, -0.008, 0.004]);
      const pts = [v(0, 0, 0), v(sx * 0.02, -0.05, 0.02), v(sx * 0.04, -0.1, 0.035), v(sx * 0.055, -0.14, 0.04)];
      add(tg, paint(loft(pts, curveTable([[0, 0.012, 0.004], [0.85, 0.016, 0.0045], [1, 0.011, 0.004]]), { segs: 10, radial: 6, side: v(1, 0, 0.2) }), () => RED_D.clone()), M.ribbon).userData.inkGroup = RIB + 2;
      bowTails.push({ g: tg, sx });
    }
    add(bow, paint(new THREE.SphereGeometry(0.016, 10, 8), () => RED_D.clone()), M.ribbon, [0, 0, 0.008], [0, 0, 0], [1, 0.85, 0.8]).userData.inkGroup = RIB + 3;
  }
  // ── Bronze bell: hung on the ribbon in front of the throat; each frame the pivot cancels the body's forward tilt, so the bell always hangs toward world down ──
  const throat = onTorso(RIB_T - 0.015, PI / 2, 0.012);
  const bellPivot = group(body, [throat.x, throat.y, throat.z]);
  const bellG = group(bellPivot, [0, -0.012, 0.006]);
  {
    const bA = C(0xe6b85a);
    const bB = C(0xa87830);
    add(bellG, paint(new THREE.TorusGeometry(0.009, 0.0035, 5, 10), () => bB.clone()), M.bronze, [0, 0.008, 0]).userData.inkGroup = BELL;
    const bell = paint(lathe([[0.001, -0.046], [0.035, -0.048], [0.04, -0.044], [0.037, -0.037], [0.028, -0.021], [0.025, -0.006], [0.018, 0.0], [0.001, 0.002]], 16), (p) => bB.clone().lerp(bA, ss(p.y, -0.045, -0.008)));
    add(bellG, bell, M.bronze).userData.inkGroup = BELL;
    add(bellG, paint(new THREE.SphereGeometry(0.0095, 8, 6), () => bB.clone()), M.bronze, [0, -0.051, 0]).userData.inkGroup = BELL + 1;
  }

  // ── Head: neck tips the body's forward tilt back, so the face looks level; look handles the head tilt and looking around, and the head's origin is at the center of the skull ──
  const neckPt = torsoPath.getPointAt(0.95);
  const neck = group(body, [neckPt.x, neckPt.y, neckPt.z], [-PITCH, 0, 0]);
  const look = group(neck);
  look.rotation.order = 'YXZ';
  const HR = 0.122;
  const HOFF = v(0, 0.058, 0.04);
  const HS: [number, number, number] = [1, 0.95, 1.08];
  const head = group(look, [HOFF.x, HOFF.y, HOFF.z]);
  add(head, paint(new THREE.SphereGeometry(HR, 32, 22), (_p, n) => C(WHITE).lerp(C(SHADE), ss(-n.y, 0.45, 0.95) * 0.5)), M.feather, [0, 0, 0], [0, 0, 0], HS).userData.inkGroup = BODY;
  const hv = (x: number, y: number, z: number) => v(x * HR, y * HR, z * HR);

  // Beak: a pink-gray short beak, the tip slightly darker and hooking slightly down; a white cere above the beak root (the most recognizable thing on a dove); the lower beak is short and tucked into the upper beak
  {
    const bBase = C(0xdba3ad);
    const bTip = C(0x8e6670);
    const tipP = hv(0, -0.14, 1.42);
    const upper = loft([hv(0, 0.06, 0.84), hv(0, 0.03, 1.06), hv(0, -0.03, 1.27), hv(0, -0.1, 1.4), hv(0, -0.17, 1.43)],
      curveTable([[0, 0, 0], [0.08, 0.2 * HR, 0.19 * HR], [0.4, 0.15 * HR, 0.14 * HR], [0.78, 0.08 * HR, 0.085 * HR], [1, 0, 0]]), { segs: 16, radial: 12, side: X });
    add(head, paint(upper, (p) => bBase.clone().lerp(bTip, 1 - ss(p.distanceTo(tipP), 0.12 * HR, 0.3 * HR))), M.beak).userData.inkGroup = BEAK;
    add(head, paint(loft([hv(0, -0.08, 0.86), hv(0, -0.12, 1.06), hv(0, -0.14, 1.22)], curveTable([[0, 0, 0], [0.1, 0.16 * HR, 0.08 * HR], [0.6, 0.12 * HR, 0.065 * HR], [1, 0, 0]]), { segs: 10, radial: 8, side: X }), () => bBase.clone()), M.beak).userData.inkGroup = BEAK;
    // Cere: a small bulge of white above the beak root
    add(head, paint(loft([hv(0, 0.13, 0.8), hv(0, 0.11, 0.95), hv(0, 0.075, 1.05)], curveTable([[0, 0, 0], [0.18, 0.19 * HR, 0.12 * HR], [0.7, 0.16 * HR, 0.1 * HR], [1, 0, 0]]), { segs: 8, radial: 10, side: X }), () => C(0xf6f2f6)), M.beak).userData.inkGroup = BEAK;
  }

  // Eyes: a dove's eyes are on the two sides of the head, small and dark, half set in the sockets; a thin pale blue-gray eye ring around (the lip edge of the upper and lower eyelids); only one small highlight.
  // The iris, pupil and highlight are wrapped in a separate gaze group that turns a little forward, so both eyes look forward together (pitfall 43)
  const ER = 0.17 * HR;
  const eyeD = v(0.62, 0.2, 0.76).normalize();
  const surfR = (d: THREE.Vector3) => HR / Math.sqrt((d.x / HS[0]) ** 2 + (d.y / HS[1]) ** 2 + (d.z / HS[2]) ** 2);
  const eyeA: THREE.Group[] = [];
  const lids: { up: THREE.Group; lo: THREE.Group }[] = [];
  const his: THREE.Mesh[] = [];
  const UP_OPEN = 1.05;
  const LO_OPEN = 0.95;
  const lidUp = lidLow(ER + 0.002, ER + 0.0055, PI / 2);
  const lidLo = lidLow(ER + 0.002, ER + 0.005, PI / 2);
  const ballGeo = paint(new THREE.SphereGeometry(ER, 16, 10), () => C(0x1e1418));
  const irisGeo = paint(capLow(ER + 0.0006, 0.78, 18, 4), (p) => C(0x2a1614).lerp(C(0x1a0d0b), ss(-p.y / ER, -0.2, 0.6)));
  const pupilGeo = paint(capLow(ER + 0.0012, 0.46, 16, 3), () => C(0x070405));
  for (const sx of [-1, 1]) {
    const d = v(sx * eyeD.x, eyeD.y, eyeD.z);
    const c = d.clone().multiplyScalar(surfR(d) - 0.5 * ER);
    const eg = group(head, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.72, 0.06, 0.69).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.12]);
    add(roll, ballGeo, M.eye).userData.inkGroup = EYE;
    const want = v(0, 0.05, 1).normalize().applyQuaternion(eg.quaternion.clone().multiply(roll.quaternion).invert());
    const gq = new THREE.Quaternion().setFromUnitVectors(FWD, want);
    const ang = 2 * Math.acos(clamp(gq.w, -1, 1));
    const gaze = group(roll);
    gaze.quaternion.copy(new THREE.Quaternion().slerp(gq, Math.min(1, 0.42 / Math.max(ang, 1e-4))));
    add(gaze, irisGeo, M.eye).userData.inkGroup = EYE;
    add(gaze, pupilGeo, M.eye).userData.inkGroup = EYE;
    const hd = v(-0.36, 0.38, 1).normalize();
    const hl = add(gaze, new THREE.SphereGeometry(0.16 * ER, 8, 5), M.hi, [hd.x * ER * 1.01, hd.y * ER * 1.01, hd.z * ER * 1.01], [0, 0, 0], [1, 1, 0.45]);
    hl.quaternion.setFromUnitVectors(FWD, hd);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    his.push(hl);
    eyeA.push(group(gaze, [0, 0, ER]));
    // The eyelids turn along with part of the gaze, so from the side the iris falls in the middle of the eye opening
    const lidG = group(roll);
    lidG.quaternion.copy(new THREE.Quaternion().slerp(gaze.quaternion, 0.6));
    const up = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(up, lidUp, M.ring).userData.inkGroup = BODY;
    const lo = group(lidG, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lo, lidLo, M.ring).userData.inkGroup = BODY;
    lids.push({ up, lo });
  }

  // ── Halo: a ring of golden light floating above the head, tilted slightly back ──
  const HALO_Y = HR * 1.62;
  const haloPivot = group(head, [0, HALO_Y, -0.025], [-0.35, 0, 0]);
  haloPivot.rotation.order = 'XYZ';
  add(haloPivot, new THREE.TorusGeometry(0.128, 0.017, 8, 40), M.halo, [0, 0, 0], [PI / 2, 0, 0]).userData.inkGroup = HALO;

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const rig = {
    head: group(look, [HOFF.x, HOFF.y, HOFF.z + HR * 0.6]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [0, -0.15 * HR, 1.43 * HR]),
      halo: group(haloPivot),
      bell: group(bellG, [0, -0.03, 0]),
      wingL: wings[1].tipA,
      wingR: wings[0].tipA,
    },
  };
  const act = { glow: 0, flap: 0 };

  // Static parts merged (mesh budget N 40): nodes that move when idle act as owners; wings and eye highlights whose vertices the CPU changes every frame are not merged
  mergeStatic(root, {
    owners: [fly, pitchG, ...wings.map((w) => w.wg), neck, look, head, tailG, bellPivot, haloPivot, ...bowTails.map((b) => b.g), ...lids.flatMap((l) => [l.up, l.lo])],
    keep: [...skinned, ...his],
    rig,
  });

  // ── Idle action: hovering flap (Aeroth's cycle). One beat is BEAT seconds; the downstroke (strong, longer) spreads the wing as a whole sheet from above the back and presses it forward and down,
  //    and on the upstroke the hand folds back at the wrist, the primaries turn on edge, and the wing is carried back up folded; the body is lifted after the downstroke and sinks on the upstroke, with the head steady and not swaying along;
  //    the tail feathers lag half a beat; the halo turns slowly, the bronze bell and ribbon tails sway, blinking ──
  const BEAT = 0.8;
  const DOWN = 0.58;
  const TOP = 1.0;
  const BOT = -0.55;
  // t = 1 (the time of check screenshots) falls at the moment right as the downstroke begins, with both wings raised and spread and the underside facing forward
  const PH_T1 = 0.05;
  const PH0 = PH_T1 - 1 / BEAT;
  const FLIP = 0.85;
  const elevAt = (ph: number) => {
    const q = ((ph % 1) + 1) % 1;
    if (q < DOWN) return BOT + (TOP - BOT) * (0.5 + 0.5 * Math.cos(PI * Math.pow(q / DOWN, 1.15)));
    return BOT + (TOP - BOT) * (0.5 - 0.5 * Math.cos(PI * (q - DOWN) / (1 - DOWN)));
  };
  const BLINK = 3.4;
  let phase = PH0;
  let lastGlow = Number.NaN;
  const L = THREE.MathUtils.lerp;
  const update = (t: number, dt: number) => {
    // Phase: with time frozen (dt = 0) it is computed directly from t, and during playback it is accumulated, so a faster wingbeat does not jump a step (pitfall 80)
    phase = dt > 0 ? phase + dt / BEAT : t / BEAT + PH0;
    const ph = ((phase % 1) + 1) % 1;
    const gl = act.glow;
    const fp = act.flap;
    const hold = Math.max(gl, fp);
    const cyc = 1 - hold;
    const dn = ph < DOWN;
    const k = dn ? ph / DOWN : (ph - DOWN) / (1 - DOWN);
    const elev = elevAt(ph);
    const up = dn ? 0 : Math.sin(PI * k);
    const high = ss((elev - BOT) / (TOP - BOT), 0.6, 1);
    const push = dn ? Math.sin(PI * k) : 0;
    // Wing twist: the top flips open so the underside faces forward, the leading edge presses down in mid-downstroke, and on the upstroke it slowly turns back
    const twist = dn ? -FLIP * Math.pow(1 - k, 2.2) + 0.22 * push : -0.25 * up - FLIP * k * k;
    const lag = clamp((elevAt(ph - 0.07) - elev) * 0.9, -0.45, 0.45);
    // Charge-up: both wings raised high and drawn together, underside facing forward; strike: one fan forward and down, the leading edge pressed down. When both are given they are blended by weight
    const iw = hold > 0 ? 1 / (gl + fp) : 0;
    const elT = (gl * TOP * 1.02 + fp * (BOT - 0.12)) * iw;
    const twT = (gl * -FLIP + fp * 0.3) * iw;
    const swT = (gl * 0.1 + fp * -0.2) * iw;
    const sweep = 0.18 * up - 0.06 * push + 0.16 * high;
    for (const r of wings) {
      r.wg.rotation.set(L(twist, twT, hold), r.sx * L(elev, elT, hold), -r.sx * L(sweep, swT, hold), 'YXZ');
      bendHand(r, 0.6 * up * cyc + 0.25 * gl, 0.45 * up * cyc, lag * cyc);
    }
    // Body: the downstroke lifts it high and on the upstroke it sinks, the forward tilt nodding slightly along; on a strike the chest is thrust out
    const lift = -Math.cos(2 * PI * (ph - 0.05)) * cyc;
    const nod = Math.sin(2 * PI * ph + 0.6) * 0.025 * cyc;
    const pitch = PITCH + nod - fp * 0.18 - gl * 0.06;
    fly.position.y = FLY_Y + lift * 0.03 + gl * 0.04;
    pitchG.rotation.x = pitch;
    // Head steady: cancels the body's forward tilt and nodding; tilts to look at people and slowly looks around
    neck.rotation.x = -pitch;
    neck.position.y = neckPt.y - lift * 0.012;
    look.rotation.y = Math.sin(t * 0.37) * 0.2 + Math.sin(t * 1.1) * 0.03;
    look.rotation.x = Math.sin(t * 0.53) * 0.03;
    head.rotation.z = Math.sin(t * 0.5 + 0.4) * 0.1;
    // Tail fan half a beat behind; each frame the bronze bell cancels the body's forward tilt and hangs swaying lightly toward world down; the ribbon tails flutter in the wind of the wingbeat
    tailG.rotation.set(-0.05 + Math.sin(2 * PI * ph - 1.2) * 0.07 * cyc, Math.sin(t * 0.8) * 0.04, 0);
    bellPivot.rotation.set(-pitch + Math.sin(2 * PI * ph - 1.6) * 0.14 * cyc + Math.sin(t * 2.3) * 0.05, 0, Math.sin(t * 1.1) * 0.1);
    for (const b of bowTails) b.g.rotation.set(Math.sin(2 * PI * ph - 1.0 + b.sx * 0.4) * 0.16 * cyc - 0.1, 0, b.sx * (0.12 + Math.sin(t * 1.7 + b.sx) * 0.08));
    haloPivot.rotation.y = t * 0.4;
    haloPivot.position.y = HALO_Y + Math.sin(t * 1.4) * 0.006;
    // Blink: the upper and lower lids close together toward the midline (pitfall 46), and once more than half closed the highlight is hidden
    const bt = ((t + 1.3) % BLINK) / 0.2;
    const close = bt < 1 ? Math.min(1, Math.sin(bt * PI) * 1.3) : 0;
    for (const l of lids) {
      l.up.rotation.x = -UP_OPEN + (UP_OPEN - 0.14) * close;
      l.lo.rotation.x = PI + LO_OPEN - (LO_OPEN - 0.14) * close;
    }
    for (const h of his) h.visible = close < 0.6;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.halo.emissiveIntensity = 0.42 + gl * 0.5;
      M.candle.emissiveIntensity = 0.55 + gl * 0.4;
    }
  };
  update(1, 0);

  // The whole thing is moved onto the pivot: the center of the bounding box in x and z is placed at the origin, so the side and back views are not clipped (pitfall 66)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const mid = box.getCenter(new THREE.Vector3());
  place.position.set(-mid.x, 0, -mid.z);
  const size = box.getSize(new THREE.Vector3());

  return { root, update, rig, act, center: new THREE.Vector3(0, mid.y, 0), radius: Math.max(size.x, size.y, size.z) * 0.56 };
}
