// Thunderbird, the Thundercloud Divine Bird (model lab version): in the year the thundercloud stopped and would not move on, a nomad tribe saw a giant bird in the cloud; with every beat of its wings a bolt of lightning falls, as if urging the cloud to hurry along.
// Only one form (decided by the user, 2026-09-28): the builder takes no breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on, with reasons (from the name, the thunder + wind elements, the "Thundercloud" trait and the lore):
//   1. A mass of cumulonimbus draped over the shoulders: a ring of round bulging cloud masses at the base of the neck, bright on top and dark at the cloud base, hanging down behind into a cloak of cloud, the head poking out of the cloud.
//      The lore says the tribe saw it "in the cloud", so the cloud is part of its body, not a prop under its feet.
//   2. Two lightning-shaped horn feathers on top of the head: stiff feathers folded into a bolt of lightning, thunder yellow, standing up and back. Only these two horns on the whole body glow (the iris lights up only when storing thunder).
//   3. Both wings raised high and half open: the moment before the downstroke ("with every beat of its wings a bolt of lightning falls"); the backs of the wings are the deep blue-gray of the thundercloud,
//      the tips of the coverts a row of yellow sawteeth, which from behind is a bolt of lightning across the wings. The undersides of the wings are cloud white.
//   4. A bone-white big raptor hooked beak (opened when it calls out, showing a red tongue); small raptor eyes pressed under a brow ridge of the same color, with a ring of thunder yellow around them.
// Body shape follows the lore: a giant bird standing on the ground. A full chest, the body upright, the two feet planted apart, the feathered trousers reaching down to the ankles, the tail fan braced back and down.
// It is told apart from the birds of the same sky: Skyreign hovers at forty-five degrees with wings spread flat in blue-white scythe wings; Aeroth is a white-headed bird that beats its wings and hovers;
// the Thunderbird is a dark big bird that stands with both wings raised into a W and a mass of cloud around its neck, with two extra lightning horns in the silhouette.
//
// Personality: an impatient, loud-voiced cloud driver. If the cloud goes a little slow it beats its wings and shouts to hurry it, like a sheepdog herding sheep; hot-tempered but not fierce,
// with the nomad tribe waiting below for the cloud to move on always on its mind.
// Expression: the face is made after a raptor's structure, with no human features imposed: small, deep eyes looking level ahead, the brow ridge the same color as the head, pressing on the eye and sweeping back into the roots of the horn feathers;
// the beak is normally closed, the seam between the upper and lower beak being the mouth, and every few seconds the beak opens for a shout. Its impatience comes from action: the head turning in jerks (looking ahead, looking up at the cloud, looking back), shaking its wings.
// Gaze order: the head (bone-white hooked beak, the small eyes under the brow ridge) first, the lightning horn feathers on top of the head second, and the cloud collar and the raised wings as support.
// The back tells "falling thunder": the backs of the two raised wings are dark thundercloud, the yellow sawteeth at the tips of the coverts joining behind into a bolt of lightning across both wings;
// the cloud collar hangs behind into a cloud cloak with the wings growing out of the cloud; the end of the tail fan has a cloud-white edge.
// Restrained light effects: the only emissive left is the two horn feathers and a touch on the iris, with no reliance on bloom; the clouds and the lightning on the wings are all base color.
//
// <Action table> (act weights: charge, storing thunder, 0-1; beat, wingbeat, 0-1; call, shouting, 0-1)
//   Idle: standing steady, both wings half raised, the cloud collar slowly rolling mass by mass; the head turning in jerks to look ahead and look up at the cloud; every few seconds impatiently shaking the wings and opening the mouth for a shout; blinking.
//   Move: two hops plus a wingbeat, as if hurrying along.
//   Charge-up: both wings raised high, the cloud collar swelling, the horn feathers and eyes lighting up, the looking around stopped and the gaze straight ahead (charge).
//   Strike: both wings beat forward and down, and lightning falls from the cloud (beat).
//   Hit: the cloud collar bursts up and the head ducks, then it raises its head and glares back right away, not retreating.
//   Victory: both wings flap up once, the head thrown back for a long cry (call), and then it goes back to urging the cloud on.
// Anchors: head, eyes, mouth (between the two beaks), hornL / hornR (horn feather tips), wingTipL / wingTipR (wing tips), cloud (top of the back of the cloud collar), tail (the end of the tail fan).
// L / R are its own left and right (the model faces +z, and the left-hand side is +x).
// Face count: the SR budget is 45,000 faces and 60 meshes; the feather sheets and eyelids use low-segment versions of their own, and the clouds are low-segment spheres, scaled and rolled mass by mass on the CPU.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, loft, mergeStatic, outline, partKit, PI, rng, slab, smooth, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type V3 = [number, number, number];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const C = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Feather surface ─────────────────────────

interface SheetOpts {
  /** The curve the feather roots follow (wing bone, tail root), with s the arc-length position from 0 to 1 */
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
  /** The half thickness of the layer underneath at the same point: this layer is stacked on it, so the feather tips do not sink in */
  under?: (s: number, d: number) => number;
  /** The bend of the feather surface: the displacement toward the underside (d is the distance from the feather root); shared by every layer of the same wing */
  bend?: (s: number, d: number) => number;
  groove?: number;
  /** The feather tip is pointed (give an exponent, the larger the more pointed); if not given it is round-headed */
  pointy?: number;
  rachis?: number;
  /** Vertex color: side = -1 is the back and 1 the underside; w is the lateral position within the feather; edge is the distance from the edge of the feather tip */
  color?: (s: number, c: number, side: number, w: number, edge: number) => THREE.ColorRepresentation;
  rows: number;
  cols: number;
}

interface Sheet {
  geo: THREE.BufferGeometry;
  h: (s: number, d: number) => number;
}

/**
 * A feather surface joined into one sheet (Skyreign's featherSheet, with colors given more of the distance from the edge of the feather tip): along the feather-root curve, each point grows a feather toward dir,
 * the trailing edge cut into individual feather tips, with grooves pressed in between feathers; the whole sheet is one part, and the outline falls only on the edges of the feather tips and the creases of the grooves (pitfall 20).
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
      if (o.color) tc.set(o.color(s, c, side === 0 ? 1 : side, w, (1 - c) * L));
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
  // Winding check: the normal of the middle row at the middle of the underside must face the underside, and if reversed it is flipped
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

/** A low-segment fur collar (furCollar in shapes.ts): the cuffs of the feathered trousers. For a partial arc the thickness at both ends goes to 0, closing naturally */
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

/** Recompute the normals after changing positions vertex by vertex */
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
  if (!g.attributes.normal) g.computeVertexNormals();
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

// ───────────────────────── Cloud ─────────────────────────

interface Puff {
  c: THREE.Vector3;
  r: number;
  /** The squash ratio (the cloud base is flatter) */
  sy: number;
  /** The phase of the rolling */
  ph: number;
  /** 0-1: the larger the darker (cloud base, the lower row of the outer ring) */
  shade: number;
}

/**
 * A mass of cumulonimbus: low-segment spheres stacked together, in the same outline group, so between spheres lines are drawn only at creases and where one occludes another,
 * which is exactly the clouds of a cartoon; each sphere bright on top and dark below, with the whole lower row darkened a little more (the cloud base). It returns each sphere's vertex range, for the CPU to scale and roll mass by mass.
 */
function cloudGeo(puffs: Puff[], hi: THREE.Color, mid: THREE.Color, lo: THREE.Color) {
  const parts: THREE.BufferGeometry[] = [];
  const ranges: [number, number][] = [];
  let at = 0;
  const tc = new THREE.Color();
  for (const p of puffs) {
    const g = new THREE.SphereGeometry(p.r, 14, 10);
    g.deleteAttribute('uv');
    g.scale(1, p.sy, 1);
    g.computeVertexNormals();
    paint(g, (_q, n) => {
      tc.copy(mid).lerp(hi, ss(n.y, 0.05, 0.6) * (1 - p.shade * 0.6)).lerp(lo, Math.max(ss(-n.y, 0.0, 0.7) * 0.85, p.shade * 0.45));
      return tc;
    });
    g.translate(p.c.x, p.c.y, p.c.z);
    parts.push(g);
    const n = g.attributes.position.count;
    ranges.push([at, at + n]);
    at += n;
  }
  const geo = mergeGeometries(parts, false)!;
  return { geo, ranges };
}

// ───────────────────────── Shape ─────────────────────────

export function buildThunderbirdLab(): LabModel {
  const RIMC = 0xdce6ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const STORM = 0x46517c; // The deep blue-gray of the thundercloud: back, backs of the wings, head
  const STORM_D = 0x333b5e; // Wing tips, tail tip
  const SLATE = 0x66729a; // Sides of the body, feathered trousers
  const BELLY = 0x8e99bf; // Belly: a blue-gray one step paler than the back, not made a white belly (a white belly would look like a penguin)
  const WING_V = 0x9aa4c6; // Undersides of the wings
  const CLOUD_HI = 0xeceef7;
  const CLOUD = 0xc4c9df;
  const CLOUD_LO = 0x7a81a6;
  const BROW = 0x525d8a; // Brow ridge: a thundercloud color one step brighter than the head
  const BOLT = 0xffd23a;
  const BONE = 0xf0e7cf;
  const BONE_D = 0x4b4762;
  const M = {
    feather: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    cloud: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xffffff })),
    lid: labToon(STORM, { rim: 0.5, rimColor: RIMC }),
    beak: vc(labToon(0xffffff, { spec: 0.7, specTh: 0.975, rim: 0.35, rimColor: 0xfff2d0 })),
    mouth: vc(labToon(0xffffff, { rim: 0 })),
    horn: labToon(BOLT, { ramp: 'gem', rim: 0.5, rimColor: 0xfff6c8, emissive: BOLT, emissiveAmt: 0.14 }),
    talon: labToon(0x2a2838, { spec: 0.9, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    eye: labToon(0x1a1c34, { ramp: 'gem', rim: 0 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0, emissive: 0x5a4000, emissiveAmt: 0.5 })),
    pupil: labToon(0x10121f, { rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'thunderbird-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group (the 9700 range, unused by other spirits)
  const HEAD = 9701;
  const BODY = 9702;
  const WING_L = 9703;
  const WING_R = 9704;
  const TAIL = 9705;
  const BEAK = 9706;
  const LEG = 9707;
  const CLOUDG = 9708;
  const HORN = 9709;

  // ── Skeleton: place moves the whole animal onto the pivot; body is the body (breathing, leaning forward on a strike), its origin on the ground; the feet hang on place, standing firmly on the ground ──
  const place = group(root);
  // The pivot of lean is at the hip: when leaning forward on a strike and back when shouting, the body turns about the hip, and the feet do not leave the body
  const HIP_Y = 0.45;
  const lean = group(place, [0, HIP_Y, 0]);
  const body = group(lean, [0, -HIP_Y, 0]);

  // ── Torso: one whole loft from the tail root forward and up to the neck base, the body leaning forward about thirty-five degrees (hurrying forward), the chest full and thrust forward ──
  const torsoPts = [v(0, 0.34, -0.3), v(0, 0.44, -0.18), v(0, 0.58, -0.05), v(0, 0.72, 0.05), v(0, 0.85, 0.1), v(0, 0.95, 0.12)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.06, 0.08, 0.07, 0],
    [0.2, 0.17, 0.17, 0.01],
    [0.45, 0.225, 0.235, 0.035],
    [0.68, 0.205, 0.215, 0.03],
    [0.88, 0.14, 0.14, 0.01],
    [1, 0, 0, 0],
  ]);
  const torsoPath = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal');
  // The belly is one step paler; breast-feather collars (like rags hung on the belly) and vertex-color V marks (like dirty patches) were tried and both removed, leaving a quiet surface on the chest, with the detail concentrated on the face, the cloud and the wings
  const torso = add(body, paint(loft(torsoPts, torsoProf, { segs: 40, radial: 30, up: FWD }), (_p, n) =>
    C(STORM).lerp(C(SLATE), ss(n.z, -0.35, 0.25) * 0.8).lerp(C(BELLY), ss(n.z, 0.35, 0.7))), M.feather);
  torso.userData.inkGroup = BODY;

  // ── Feet: coming straight down from under the belly, the two feet planted apart. The feathered trousers reach down to the ankle, the cuffs a ring of feather tips flaring outward; the tarsus short and thick, bone white, the claws dark ──
  const legs: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const hip = group(place, [sx * 0.115, 0, 0.0]);
    legs.push(hip);
    add(hip, paint(loft([v(0, 0.52, -0.1), v(sx * 0.008, 0.38, -0.03), v(sx * 0.012, 0.25, 0.0), v(sx * 0.012, 0.15, 0.01)],
      curveTable([[0, 0, 0], [0.12, 0.075, 0.08], [0.55, 0.085, 0.09], [0.9, 0.062, 0.066], [1, 0, 0]]), { segs: 14, radial: 12, side: X }),
    (p) => C(STORM).lerp(C(SLATE), ss(p.y, 0.4, 0.22))), M.feather).userData.inkGroup = LEG;
    add(hip, paint(lowCollar({ r0: 0.05, len: 0.075, thick: 0.035, flare: 0.5, curl: -0.25, tufts: 6, notch: 0.5, jitter: 0.15, seed: 5 + sx }, 5, 5),
      (p) => C(SLATE).lerp(C(BELLY), ss(-p.y, 0.02, 0.06))), M.feather, [sx * 0.012, 0.19, 0.012]).userData.inkGroup = LEG;
    // Tarsus
    add(hip, paint(loft([v(sx * 0.012, 0.18, 0.012), v(sx * 0.012, 0.1, 0.016), v(sx * 0.012, 0.035, 0.02)], curveTable([[0, 0, 0], [0.12, 0.036, 0.038], [0.85, 0.033, 0.035], [1, 0, 0]]), { segs: 8, radial: 8, side: X }),
      () => C(BONE)), M.beak).userData.inkGroup = LEG + 10;
    // Toes: three spread forward and one back, lying against the ground; at each toe tip a dark claw hooking down
    const foot = group(hip, [sx * 0.012, 0.03, 0.02]);
    for (const [yaw, len] of [[-0.5, 0.1], [0, 0.12], [0.5, 0.1], [PI, 0.07]] as [number, number][]) {
      const tg = group(foot, [0, 0, 0], [0, yaw + sx * 0.12, 0]);
      const pts = [v(0, 0.006, 0), v(0, 0.0, len * 0.45), v(0, -0.006, len * 0.85), v(0, -0.01, len)];
      add(tg, paint(loft(pts, curveTable([[0, 0, 0], [0.1, 0.022, 0.02], [0.7, 0.017, 0.015], [1, 0, 0]]), { segs: 7, radial: 6, side: X }), () => C(BONE)), M.beak).userData.inkGroup = LEG + 10;
      const tp = [v(0, -0.004, len * 0.92), v(0, -0.012, len * 1.1), v(0, -0.028, len * 1.16)];
      add(tg, loft(tp, (t) => { const k = Math.pow(1 - t, 0.8); return [0.011 * k + 0.0006, 0.012 * k + 0.0006]; }, { segs: 6, radial: 6, side: X }), M.talon);
    }
  }

  // ── Tail fan: a fan spread back and down from the tail root, dark on the back and the end a cloud-white edge; covered by a layer of upper tail coverts ──
  const tailRoot = torsoPts[0];
  const tailG = group(body, [tailRoot.x, tailRoot.y + 0.03, tailRoot.z + 0.03]);
  const TAIL_LEN = 0.36;
  let tailTipA!: THREE.Group;
  {
    const rootPts = [v(-0.08, 0, 0.02), v(0, 0, -0.01), v(0.08, 0, 0.02)];
    const tdir = (s: number) => v((s - 0.5) * 1.1, -0.55, -0.83).normalize();
    const tN = (s: number) => new THREE.Vector3().crossVectors(tdir(s), X).normalize();
    const tLen = (s: number) => TAIL_LEN * (0.86 + 0.14 * Math.cos((s - 0.5) * PI));
    const tbend = (s: number, d: number) => 0.02 * Math.sin(PI * Math.min(1, d / tLen(s))) + 0.08 * ((2 * s - 1) ** 2) * d;
    const tail = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      len: tLen,
      feather: (s) => s * 9,
      notch: () => 0.14,
      thick: (_s, c) => 0.013 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      rachis: 0.004,
      rows: 45,
      cols: 6,
      color: (_s, c, side) => {
        const tipW = ss(c, 0.84, 0.92);
        if (side < 0) return C(STORM).lerp(C(STORM_D), ss(c, 0.4, 0.8)).lerp(C(CLOUD), tipW);
        return C(BELLY).lerp(C(CLOUD), tipW);
      },
    });
    add(tailG, tail.geo, M.feather).userData.inkGroup = TAIL;
    const cov = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      len: (s) => tLen(s) * 0.45,
      feather: (s) => s * 6 + 0.5,
      notch: () => 0.3,
      thick: (_s, c) => 0.005 + 0.012 * (1 - c),
      under: tail.h,
      rows: 36,
      cols: 4,
      color: (_s, _c, side) => (side < 0 ? STORM : BELLY),
    });
    add(tailG, cov.geo, M.feather).userData.inkGroup = TAIL;
    const td = tdir(0.5);
    tailTipA = group(tailG, [td.x * TAIL_LEN, td.y * TAIL_LEN, td.z * TAIL_LEN]);
  }

  // ── Wings: raised high and half open, the moment before the downstroke. The wing bone (leading edge) goes out and up from the shoulder to the wrist and then out to the hand tip;
  //    when modeled the wing surface lies flat in the xy plane of the wing group (the underside facing +z), the feathers growing down and out; the group is swept back and the wing tips cupped slightly forward,
  //    so from the side and from three-quarters it is never only a single edge (pitfall 73). Two layers of feather sheet joined into one: flight feathers and coverts (pointed, with yellow sawteeth at the tips on the back = lightning) ──
  interface WingRig { sx: number; sh: THREE.Group; wg: THREE.Group; tipA: THREE.Group }
  const wings: WingRig[] = [];
  const S_W = 0.55;
  const phi = curveTable([[0, -1.62], [0.3, -1.5], [0.55, -1.2], [0.8, -0.72], [1, -0.18]]);
  const flightLen = curveTable([[0, 0.14], [0.3, 0.27], [0.55, 0.42], [0.8, 0.47], [1, 0.38]]);
  const featherU = (s: number) => (s < S_W ? (s / S_W) * 7 : 7 + ((s - S_W) / (1 - S_W)) * 6);
  const CUP = 0.35;
  const cup = (g: THREE.BufferGeometry) => warp(g, (p) => {
    p.z += CUP * Math.max(0, Math.abs(p.x) - 0.12) ** 2;
  });
  for (const sx of [-1, 1]) {
    const WG = sx < 0 ? WING_L : WING_R;
    const sh = group(body, [sx * 0.14, 0.9, -0.05]);
    const wg = group(sh);
    wg.rotation.order = 'YXZ';
    const arm = [v(0, 0, 0), v(sx * 0.1, 0.1, 0), v(sx * 0.2, 0.2, 0), v(sx * 0.3, 0.27, 0), v(sx * 0.44, 0.32, 0), v(sx * 0.58, 0.35, 0)];
    const dir = (s: number) => {
      const a = phi(s)[0];
      return v(sx * Math.cos(a), Math.sin(a), 0);
    };
    const N = () => FWD;
    // The wing surface cupped slightly toward the underside, the tips of the primaries turned up toward the back
    const bend = (s: number, d: number) => {
      const c = Math.min(1, d / flightLen(s)[0]);
      return 0.03 * Math.sin(PI * c) - 0.05 * c * c * ss(s, 0.5, 1);
    };
    const flight = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0],
      feather: featherU,
      notch: (s) => 0.14 + 0.32 * ss(s, S_W - 0.02, S_W + 0.08),
      thick: (_s, c) => 0.012 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      rachis: 0.004,
      rows: 66,
      cols: 6,
      color: (s, c, side, _w, edge) => {
        const hand = ss(s, S_W - 0.06, S_W + 0.06);
        if (side < 0) return C(STORM).lerp(C(STORM_D), ss(c, 0.35, 0.8) * (0.5 + 0.5 * hand)).lerp(C(CLOUD_LO), (1 - ss(edge, 0.006, 0.02)) * 0.8);
        return C(WING_V).lerp(C(STORM), ss(c, 0.55, 0.9) * (0.4 + 0.6 * hand));
      },
    });
    const coverts = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0] * 0.52,
      feather: (s) => s * 8 + 0.5,
      notch: () => 0.55,
      pointy: 1.1,
      thick: (_s, c) => 0.006 + 0.008 * (1 - c),
      under: flight.h,
      groove: 0.3,
      rows: 64,
      cols: 6,
      // Back: the yellow sawteeth at the tips of the coverts, painted yellow between 0.008 and 0.05 from the edge of the feather tip (leaving a dark line at the edge), and the whole row joined is a bolt of lightning
      color: (_s, _c, side, _w, edge) => {
        if (side < 0) return C(STORM).lerp(C(BOLT), ss(edge, 0.008, 0.016) * (1 - ss(edge, 0.05, 0.062)));
        return C(CLOUD).lerp(C(WING_V), ss(edge, 0.0, 0.05));
      },
    });
    // Wing bone: a rounded stretch of flesh along the leading edge, covering the roots of the two layers
    const armGeo = paint(loft(arm, curveTable([[0, 0, 0], [0.04, 0.05, 0.05], [0.3, 0.042, 0.038], [0.6, 0.032, 0.028], [0.9, 0.021, 0.019], [1, 0, 0]]), { segs: 26, radial: 10, up: FWD }),
      (_p, n) => C(STORM).lerp(C(WING_V), ss(n.z, 0.2, 0.6)));
    for (const geo of [flight.geo, coverts.geo, armGeo]) add(wg, cup(geo), M.feather).userData.inkGroup = WG;
    const tip = arm[arm.length - 1].clone().addScaledVector(dir(1), flightLen(1)[0] * 0.95);
    tip.z += CUP * Math.max(0, Math.abs(tip.x) - 0.12) ** 2;
    wings.push({ sx, sh, wg, tipA: group(wg, [tip.x, tip.y, tip.z]) });
  }

  // ── Neck: the stretch from the neck base to the skull, mostly hidden in the cloud collar; the head thrust forward, turning the body's forward lean back ──
  const neck = group(body, [0, 0.92, 0.1]);
  const look = group(neck);
  look.rotation.order = 'YXZ';
  const HR = 0.215;
  const HOFF = v(0, 0.21, 0.11);
  add(neck, loft([v(0, -0.12, -0.05), v(0, 0.02, 0.0), v(0, 0.13, 0.06), v(0, 0.21, 0.1)], curveTable([[0, 0, 0], [0.15, 0.11, 0.11], [0.7, 0.1, 0.11], [1, 0, 0]]), { segs: 10, radial: 14 }), M.lid).userData.inkGroup = BODY;
  const head = group(look, [HOFF.x, HOFF.y, HOFF.z]);
  // The skull is long front to back and narrow side to side: a raptor's head, not an owl's round face
  const HS: V3 = [0.92, 0.9, 1.1];
  const hv = (x: number, y: number, z: number) => v(x * HR, y * HR, z * HR);

  // Skull: the dark thundercloud color, fading under the throat to join the cloud collar
  add(head, paint(new THREE.SphereGeometry(HR, 36, 24), (p) => C(STORM).lerp(C(SLATE), ss(-p.y / HR, 0.3, 0.8) * ss(p.z / HR, -0.2, 0.4))), M.feather, [0, 0, 0], [0, 0, 0], HS).userData.inkGroup = HEAD;

  // Beak: a bone-white big hooked beak, open when shouting; the upper beak goes forward from the face with the tip hooking down, the beak tip dark
  const hookTip = hv(0, -0.5, 1.5);
  const upper = loft([hv(0, 0.2, 0.84), hv(0, 0.19, 1.1), hv(0, 0.1, 1.36), hv(0, -0.07, 1.54), hv(0, -0.3, 1.6), hv(0, -0.5, 1.5)],
    curveTable([[0, 0, 0], [0.06, 0.3 * HR, 0.3 * HR], [0.3, 0.27 * HR, 0.26 * HR], [0.6, 0.18 * HR, 0.19 * HR], [0.86, 0.09 * HR, 0.1 * HR], [1, 0, 0]]), { segs: 24, radial: 14, side: X });
  add(head, paint(upper, (p) => C(BONE).lerp(C(BONE_D), 1 - ss(p.distanceTo(hookTip), 0.16 * HR, 0.26 * HR))), M.beak).userData.inkGroup = BEAK;
  // Inside the mouth: a dark red mouth cavity tucked between the two beaks, seen only when the beak is open (when closed it is entirely hidden between the two beaks, with no red seam showing)
  add(head, paint(new THREE.SphereGeometry(1, 14, 10), () => C(0x5a2234)), M.mouth, [0, -0.12 * HR, 0.96 * HR], [0.3, 0, 0], [0.17 * HR, 0.1 * HR, 0.3 * HR]).userData.inkGroup = BEAK + 1;
  // Lower beak: pivoting at the corner of the mouth, opened by act.call and by the idle shout; a red tongue on it
  const HINGE = hv(0, -0.08, 0.76);
  const jaw = group(head, [HINGE.x, HINGE.y, HINGE.z]);
  const jv = (x: number, y: number, z: number) => hv(x, y, z).sub(HINGE);
  add(jaw, paint(loft([jv(0, -0.12, 0.84), jv(0, -0.2, 1.1), jv(0, -0.25, 1.3), jv(0, -0.24, 1.42)],
    curveTable([[0, 0, 0], [0.1, 0.27 * HR, 0.15 * HR], [0.6, 0.2 * HR, 0.11 * HR], [1, 0, 0]]), { segs: 12, radial: 10, side: X }),
  (p) => C(BONE).lerp(C(0xd8ccae), ss(p.y, -0.02 * HR, -0.2 * HR))), M.beak).userData.inkGroup = BEAK;
  add(jaw, paint(loft([jv(0, -0.13, 0.9), jv(0, -0.15, 1.08), jv(0, -0.17, 1.22)], curveTable([[0, 0, 0], [0.15, 0.14 * HR, 0.05 * HR], [0.7, 0.12 * HR, 0.05 * HR], [1, 0, 0]]), { segs: 8, radial: 8, side: X }),
    () => C(0xe0606e)), M.mouth).userData.inkGroup = BEAK + 2;

  // Eyes: a raptor's eyes, small and sunk in the sockets (about fifteen percent of the head's width in diameter): a black pupil taking more than half, a ring of thunder-yellow iris outside, one small point of highlight;
  // above, pressed down by a brow ridge of the same color as the head (see below). No doll eyes: no sclera, no black rim, not big round eyes. The eyelids are normally tucked into the head and come out only to blink.
  // The eye socket turns outward (a raptor's eyes sit on the two sides of the head, and the eye can be seen from the side), and the iris, pupil and highlight are wrapped in a gaze group turned forward, so both eyes look forward together (pitfalls 23, 43)
  const ER = 0.135 * HR;
  const eyeD = v(0.64, 0.26, 0.72).normalize();
  const surfR = (d: THREE.Vector3) => HR / Math.sqrt((d.x / HS[0]) ** 2 + (d.y / HS[1]) ** 2 + (d.z / HS[2]) ** 2);
  /** Inside the skull (compared with the skull's ellipsoid, margin is the distance kept inward) */
  const inHead = (p: THREE.Vector3, margin = 0) => (p.x / HS[0]) ** 2 + (p.y / HS[1]) ** 2 + (p.z / HS[2]) ** 2 < (HR - margin) ** 2;
  const eyeA: THREE.Group[] = [];
  const lids: { up: THREE.Group; lo: THREE.Group; upOpen: number; loOpen: number }[] = [];
  const his: THREE.Mesh[] = [];
  const LID_RO = ER * 1.22;
  const lidUp = lidLow(ER * 1.07, LID_RO, PI / 2, 14);
  const lidLo = lidLow(ER * 1.06, ER * 1.2, PI / 2, 14);
  // The iris covers the back half of the eyeball, so when it turns forward its rear edge does not expose the eyeball; the pupil is big, the thunder yellow only a ring outside, turning amber toward the outer side
  const irisGeo = paint(capLow(ER * 1.005, 1.65, 18, 6), (p) => {
    const a = Math.acos(clamp(p.z / Math.max(p.length(), 1e-6), -1, 1));
    return C(0xf2c230).lerp(C(0xc07418), ss(a, 0.75, 1.05));
  });
  const GAZE = 0.3;
  for (const sx of [-1, 1]) {
    const d = v(sx * eyeD.x, eyeD.y, eyeD.z);
    const c = d.clone().multiplyScalar(surfR(d) - 0.55 * ER);
    const eg = group(head, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.64, 0.1, 0.76).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.12]);
    add(roll, new THREE.SphereGeometry(ER, 14, 10), M.eye).userData.inkGroup = HEAD + 40;
    const want = v(0, 0.04, 1).normalize().applyQuaternion(eg.quaternion.clone().multiply(roll.quaternion).invert());
    const gq = new THREE.Quaternion().setFromUnitVectors(FWD, want);
    const ang = 2 * Math.acos(clamp(gq.w, -1, 1));
    const gaze = group(roll);
    gaze.quaternion.copy(new THREE.Quaternion().slerp(gq, Math.min(1, GAZE / Math.max(ang, 1e-4))));
    add(gaze, irisGeo, M.iris).userData.inkGroup = HEAD + 40;
    add(gaze, capLow(ER * 1.012, 0.55, 14, 3), M.pupil).userData.inkGroup = HEAD + 40;
    // Highlight: one small point at the upper left, on the same side for both eyes (under a tenth of the eye in area)
    for (const [x, y, r] of [[-0.3, 0.36, 0.26]] as [number, number, number][]) {
      const hd = v(x, y, 1).normalize();
      const hl = add(gaze, new THREE.SphereGeometry(r * ER, 8, 5), M.hi, [hd.x * ER * 1.01, hd.y * ER * 1.01, hd.z * ER * 1.01], [0, 0, 0], [1, 1, 0.45]);
      hl.quaternion.setFromUnitVectors(FWD, hd);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      his.push(hl);
    }
    eyeA.push(group(gaze, [0, 0, ER]));
    // Eyelids: when open the whole piece is tucked into the skull (the circle of the lip is entirely inside the skull), and they close from above and below only when blinking
    eg.updateMatrix();
    roll.updateMatrix();
    const lidG = group(roll);
    lidG.quaternion.copy(new THREE.Quaternion().slerp(gaze.quaternion, 0.65));
    lidG.updateMatrix();
    const toHeadLid = eg.matrix.clone().multiply(roll.matrix).multiply(lidG.matrix);
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
    add(up, lidUp, M.lid).userData.inkGroup = HEAD;
    const lo = group(lidG, [0, 0, 0], [PI + loOpen, 0, 0]);
    add(lo, lidLo, M.lid).userData.inkGroup = HEAD;
    lids.push({ up, lo, upOpen, loOpen });
  }

  // Brow ridge: a raised ridge growing on the skull (half buried in the skull), in the same color scheme as the head (only one step brighter, a shape and not an eyebrow), starting from the front and above the eye,
  // pressing directly above the eye and sweeping back along the side of the head all the way to the root of the horn feathers; a raptor's focus comes from it, and it does not float above the eye or touch the upper lid (pitfall 47)
  const EYE_LON = Math.atan2(eyeD.x, eyeD.z);
  const EYE_LAT = Math.asin(eyeD.y);
  const EYE_ANG = ER / HR;
  const onHead = (lon: number, lat: number, lift: number) => {
    const d = v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
    const r = surfR(d);
    const p = d.multiplyScalar(r);
    const n = v(p.x / (HS[0] * HS[0]), p.y / (HS[1] * HS[1]), p.z / (HS[2] * HS[2])).normalize();
    return p.addScaledVector(n, lift);
  };
  for (const sx of [-1, 1]) {
    const bpts: THREE.Vector3[] = [];
    const latTop = EYE_LAT + EYE_ANG + 0.07;
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      // The inner end pressed low (sure), almost straight above the eye, sweeping back to the horn-feather root; arching too high would turn it into surprise
      bpts.push(onHead(sx * (EYE_LON - 0.32 + 1.3 * u), latTop + 0.035 * Math.sin(PI * Math.min(1, u * 1.8)) - 0.08 * (1 - u) ** 2 + 0.24 * u * u, 0.003));
    }
    add(head, paint(loft(bpts, (tt) => { const k = Math.pow(Math.sin(PI * tt), 0.5) * ss(tt, 0, 0.2) * (1 - 0.45 * tt); return [0.032 * k, 0.02 * k]; }, { segs: 18, radial: 8, up: v(sx * 0.55, 0.75, 0.35) }), () => C(BROW)), M.feather).userData.inkGroup = HEAD;
  }

  // The seam between the upper and lower beak is the mouth, and no gape drawn turning upward is added (that would be a human smile)

  // Lightning horn feathers: two bolts of lightning (two bends each) spreading back, up and outward from the two sides of the top of the head, stiff and beveled; the plane half facing outward and half forward, so the bends can be seen from the front and from the side
  // The lateral shift at each bend must be large enough (about the width of a segment), so that a bolt of lightning can be read in the silhouette, not a plate with a notch
  const BOLT_PTS: [number, number][] = [[-0.13, 0], [0.13, 0], [0.02, 0.32], [0.26, 0.32], [0.06, 0.64], [0.24, 0.64], [-0.14, 1.0], [-0.02, 0.72], [-0.2, 0.72], [-0.02, 0.4], [-0.22, 0.4]];
  const HORN_L = 0.32;
  const hornTips: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const shape = outline(BOLT_PTS.map(([x, y]) => [x * HORN_L * sx, y * HORN_L] as [number, number]));
    const g = slab(shape, 0.04, 0.01, 1);
    g.deleteAttribute('uv');
    const rootP = hv(sx * 0.48, 0.62, -0.24);
    const yA = v(sx * 0.85, 0.8, -0.65).normalize();
    const zA = v(sx * 0.32, 0.1, 0.94).normalize();
    zA.addScaledVector(yA, -zA.dot(yA)).normalize();
    const xA = new THREE.Vector3().crossVectors(yA, zA);
    const hg = group(head, [rootP.x, rootP.y, rootP.z]);
    hg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));
    add(hg, g, M.horn).userData.inkGroup = HORN;
    hornTips.push(group(hg, [-0.14 * HORN_L * sx, HORN_L, 0]));
  }

  // ── Cloud collar: a ring of round bulging cumulonimbus at the base of the neck, leaning forward with the body; low in front and big and tall at the sides and behind, hanging down behind into a cloud cloak;
  //    the upper row of small masses covering the neck and the lower row of big masses covering the shoulders and wing roots ──
  const ruffG = group(body, [0, 0.88, 0.06], [0.4, 0, 0]);
  const puffs: Puff[] = [];
  {
    const rand = rng(23);
    const put = (th: number, rr: number, y: number, r: number, shade: number, sy = 0.86) => {
      puffs.push({ c: v(Math.sin(th) * rr, y, Math.cos(th) * rr), r: r * (0.92 + rand() * 0.16), sy, ph: rand() * PI * 2, shade });
    };
    // Lower row: the big masses of the outer ring (dark cloud base)
    for (const [th, r, y, rr] of [[0.32, 0.1, 0.0, 0.17], [0.95, 0.12, 0.01, 0.2], [1.6, 0.135, 0.01, 0.22], [2.25, 0.14, -0.02, 0.22], [2.85, 0.15, -0.04, 0.2]] as [number, number, number, number][])
      for (const sx of [-1, 1]) put(sx * th, rr, y, r, 0.55);
    put(PI, 0.21, -0.05, 0.15, 0.6);
    // The cloud cloak hanging down behind
    for (const sx of [-1, 1]) put(PI + sx * 0.45, 0.2, -0.19, 0.12, 0.8, 0.8);
    put(PI, 0.19, -0.25, 0.11, 0.85, 0.8);
    // Upper row: the small masses covering the neck (bright)
    for (const [th, r, y, rr] of [[0.62, 0.085, 0.1, 0.14], [1.3, 0.1, 0.12, 0.15], [2.0, 0.11, 0.13, 0.15], [2.65, 0.11, 0.12, 0.14]] as [number, number, number, number][])
      for (const sx of [-1, 1]) put(sx * th, rr, y, r, 0.1);
    put(PI, 0.13, 0.14, 0.11, 0.1);
  }
  const cloud = cloudGeo(puffs, C(CLOUD_HI), C(CLOUD), C(CLOUD_LO));
  const cloudMesh = add(ruffG, cloud.geo, M.cloud);
  cloudMesh.userData.inkGroup = CLOUDG;
  cloudMesh.frustumCulled = false;
  const cloudRest = Float32Array.from(cloud.geo.attributes.position.array as Float32Array);
  (cloud.geo.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const rig = {
    head: group(look, [HOFF.x, HOFF.y, HOFF.z + HR * 0.6]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [0, -0.2 * HR, 1.28 * HR]),
      hornL: hornTips[1],
      hornR: hornTips[0],
      wingTipL: wings[1].tipA,
      wingTipR: wings[0].tipA,
      cloud: group(ruffG, [0, 0.2, -0.18]),
      tail: tailTipA,
    },
  };
  const act = { charge: 0, beat: 0, call: 0 };

  // Static parts merged (mesh budget SR 60): nodes that move act as owners; the body (scaling with the breathing), the clouds (rolling mass by mass), the iris (brightening when storing thunder) and the eye highlights are not merged
  mergeStatic(root, {
    owners: [lean, body, ...wings.map((w) => w.wg), neck, look, head, jaw, tailG, ruffG, ...lids.flatMap((l) => [l.up, l.lo])],
    keep: [torso, cloudMesh, ...his],
    rig,
  });

  // ── Idle: all computed from t, so frame-by-frame screenshots at frozen time are consistent too (pitfall 80) ──
  const LOOKS: [number, number][] = [[0, 0], [0.22, -0.05], [0.1, -0.28], [-0.05, 0], [-0.28, -0.04], [0.04, -0.2], [0.18, 0.02]];
  const LOOK_T = 1.6;
  const lookAt = (t: number) => {
    const u = t / LOOK_T;
    const i = Math.floor(u);
    const f = u - i;
    const n = LOOKS.length;
    const a = LOOKS[((i % n) + n) % n];
    const b = LOOKS[(((i + 1) % n) + n) % n];
    const k = ss(f, 0.8, 0.92);
    return [THREE.MathUtils.lerp(a[0], b[0], k), THREE.MathUtils.lerp(a[1], b[1], k)];
  };
  const BLINK = 3.7;
  const TWITCH = 4.4;
  const CALL = 5.3;
  const pos = cloud.geo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  let lastGlow = -1;
  const update = (t: number) => {
    const L = THREE.MathUtils.lerp;
    const ch = act.charge;
    const bt = act.beat;
    const cl = act.call;
    // Breathing: the chest rising and falling
    const br = Math.sin(t * 1.5);
    torso.scale.set(1 + br * 0.01, 1, 1 + br * 0.014);
    lean.rotation.x = bt * 0.18 - cl * 0.06;
    // Impatiently shaking the wings: once every TWITCH seconds, one beat forward and down within 0.7 seconds and then back
    const tw = (t % TWITCH) / 0.7;
    const twitch = tw < 1 ? Math.sin(tw * PI) ** 2 : 0;
    for (const r of wings) {
      const sway = Math.sin(t * 1.1 + r.sx * 0.4) * 0.03;
      // Left-right asymmetric: the wing on the -x side (the model's right wing, the side our camera sees in battle) is raised higher, as if about to swing down to drive the cloud; so the front and back silhouettes are not mirror images
      const hi = r.sx < 0 ? 0.16 : -0.06;
      r.wg.rotation.set(-0.18 + sway * 0.5 - ch * 0.1, r.sx * (0.3 - twitch * 0.22 - bt * 0.8), r.sx * (hi + sway + twitch * 0.1 + ch * 0.28 - bt * 0.75));
    }
    // Head: looking ahead in jerks and looking up at the cloud; looking straight ahead when storing thunder and shouting
    const [ly, lp] = lookAt(t);
    const focus = Math.max(ch, cl, bt);
    // The head turned slightly to one side, tilted a little (the bird listening to the stirring of the cloud)
    look.rotation.y = (ly + 0.1) * (1 - focus);
    look.rotation.x = lp * (1 - focus) - cl * 0.3 + Math.sin(t * 0.7) * 0.02;
    head.rotation.z = (Math.sin(t * 0.45) * 0.03 - 0.1) * (1 - focus);
    // Shouting: the beak is normally closed, and every CALL seconds the beak opens for a long cry (a bird's call, not a person laughing with the mouth open)
    const cu = (t % CALL) / 0.9;
    const shout = cu < 1 ? Math.sin(cu * PI) : 0;
    jaw.rotation.x = -0.08 + shout * 0.44 + cl * 0.5;
    tailG.rotation.set(Math.sin(t * 1.5 - 0.8) * 0.02 - bt * 0.15, Math.sin(t * 0.6) * 0.04, 0);
    // The cloud collar slowly rolling mass by mass; when storing thunder the whole mass swells
    for (let k = 0; k < puffs.length; k++) {
      const p = puffs[k];
      const s = 1 + Math.sin(t * 0.9 + p.ph) * 0.045 + ch * 0.1 + twitch * 0.02;
      const [a, b] = cloud.ranges[k];
      for (let i = a * 3; i < b * 3; i += 3) {
        arr[i] = p.c.x + (cloudRest[i] - p.c.x) * s;
        arr[i + 1] = p.c.y + (cloudRest[i + 1] - p.c.y) * s;
        arr[i + 2] = p.c.z + (cloudRest[i + 2] - p.c.z) * s;
      }
    }
    pos.needsUpdate = true;
    // Storing thunder: the horn feathers and iris brighten (written only when a weight changes, so as not to overwrite other performances, see the spirit-port reference)
    if (Math.abs(ch - lastGlow) > 1e-3) {
      lastGlow = ch;
      M.horn.emissiveIntensity = L(0.14, 0.9, ch);
      M.iris.emissiveIntensity = L(0.5, 2.2, ch);
    }
    // Blink: the upper and lower lids close together toward the midline (pitfall 46); the iris is bright yellow, so the two lids must close until the lip edges overlap each other, and leaving a gap would be a yellow line and look like squinting (the eyelids are the same color as the head, so overlapping does not show as a patch of white, pitfall 70)
    const bk = ((t + 1.3) % BLINK) / 0.2;
    const close = bk < 1 ? Math.min(1, Math.sin(bk * PI) * 1.3) : 0;
    for (const l of lids) {
      l.up.rotation.x = -L(l.upOpen, 0.06, close);
      l.lo.rotation.x = PI + L(l.loOpen, -0.1, close);
    }
    for (const h of his) h.visible = close < 0.6;
  };
  update(1);

  // Move the whole animal onto the pivot: the x and z center of the bounding box is placed at the origin (pitfall 66)
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
