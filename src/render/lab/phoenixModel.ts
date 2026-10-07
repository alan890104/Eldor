// Phoenix, the Emberfeather Deathless Bird (model lab version): the volcano of the Emberspine erupts greatly once every hundred years, and where the ash falls a phoenix hatches.
// It remembers everything from before each rebirth, so it is never in a hurry to grow up.
// Only one form (decided by the user, 2026-09-28): the builder takes no breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on, with reasons (from the name "Emberfeather", the fire and light elements, the role of rebirth and the lore):
//   1. Ash outside, fire inside: the back, the backs of the wings and the tail feathers are the color of cooled ash, with the end of every feather still burning a line of orange-red ember;
//      the undersides of the wings are the color of fire (deep red to orange to gold), and in the exact middle of the pale ash-colored chest burns a flower of fire with three tongues (the fire under the ash that has not gone out).
//      From behind it is a heap of ash that has not gone out, and from the front it is fire.
//   2. Both wings raised high: the wing surfaces facing forward, spreading up and out from the shoulders, as if just awake from the ash and basking in the warmth; from the front two fire-colored wing surfaces frame the face,
//      and the silhouette is a phoenix, not to be mistaken for a pheasant or a peacock.
//   3. The fire crown on top of the head: a five-tongued flame around the back half of the top of the head (tall behind and short in front, the tongue tips curling back), the gold roots burning into red tips, the highest tuft of fire above the face.
//      Three separate crest feathers would be left as a single antenna from the side, so it is changed into a ring of fire tongues facing outward, and fire reads from all four views.
//   4. Three long tail feathers: flowing level back from the tail root, the ends curling up into a tongue of fire, with an "ember eye" at the base of the tongue (a dark gray outer ring, an ember-red middle ring, and a glowing gold ember crystal at the center).
//      Chevron-shaped ember marks across the vanes, one mark for each rebirth: it remembers every one.
//   5. A gold-orange head, a short gold hooked beak, an ivory chin and throat below the beak root, and a pair of small dark eyes sunk in deep red eye rings: the head is where the gaze lands first.
// Body shape follows the lore: a two-legged bird standing on the ground (not hovering; a bird hatched from fallen ash, with its feet on the ground). A big head, a round chest and short legs, the proportions keeping a touch of a chick
// (never in a hurry to grow up), but the long tail feathers and crest are what a bird that has lived through several cycles has.
//
// Personality: an old soul that has seen everything and is never in a hurry. Gentle and unhurried, never flustered.
// Expression: the face is made after a bird's structure, with no human features imposed: dark small bird eyes open and looking level ahead (a dark brown iris, a black pupil, a thin deep red eye ring, no sclera, no brows),
// the beak closed, the seam between the upper and lower beak being the mouth. Its calm comes from posture: the head now and then slowly tilts, as if listening to something you tell it that it has long known; the blinks are slow too.
// Gaze order: the head (gold-orange head, gold beak, small eyes in deep red eye rings, ivory throat) first, the flame crest on top of the head second, and the raised fire-colored wings and the ember eyes of the long tail feathers as support.
// The back tells "ash and memory": the backs of the wings, shoulder feathers, back feathers and tail fan are all ash-colored layer on layer, the feather tips burning a line of ember, like a heap of ash that has not gone out;
// the chevron marks on the three long tail feathers can be counted one by one, and the ember eyes in the three tongues of fire at the ends look backward: those are the previous lives it carries with it.
// The eyelids are the head's gold-orange; when the eyes are open the whole piece is tucked into the skull, and when closed it is an eyelid shut inside the deep red eye ring, not a red ball.
// Restrained light effects: no fire particles, halo or translucent fire shell; the only emissive left is the ember crystals at the centers of the three ember eyes, with no reliance on bloom. The fire relies on shape and color.
//
// <Action table> (act weights 0-1; all 0 is idle)
//   focus  stop looking around and tilting the head, look straight ahead
//   spread both wings raised and spread whole, crest raised (charge-up, victory)
//   furl   both wings hanging down along the sides, the underside facing inward and wrapping the body, with only the ash-colored backs of the wings showing outside, like putting on a cloak of ash, the head slightly lowered
//          (Nirvana: the beat of curling up after being knocked down, before rebirth)
//   glow   the ember crystals of the ember eyes brighten (charge-up, rebirth)
//   cry    beak open, head thrown back (the cry on the strike)
//   Idle: wings open basking in the warmth, breathing slowly, the wing surfaces opening and closing to fan warm air, the crest swaying lightly like a flame, the tail feathers swaying slowly; the head turns slowly and now and then tilts, and the blinks are slow too.
//   Move: it does not run, one beat of the wings glides it a stretch, the tail feathers dragging across the ground on landing.
//   Charge-up: both wings raised and opened (spread), the crest raised, the ember eyes lit (glow).
//   Strike: both wings fan forward to send the fire out, beak open (cry).
//   Hit: the feathers lift and settle again, like ash blown up by the wind and falling back in place, without stepping back.
//   Victory: both wings raised open whole, head thrown back (spread), the ember eyes flaring once, then slowly drawing back to the basking pose, with no cry.
// Anchors: head, eyes, mouth (beak tip), crest (crest tip), wingL / wingR (shoulders), wingTipL / wingTipR (wing tips),
//       tail (the ember eye of the central long tail feather), plumeL / plumeR (the ember eyes of the two side long tail feathers), heart (the middle of the chest, where the fire of rebirth starts).
// Budget: SR 45,000 faces, 60 meshes (currently about 33,000 faces and 35 meshes). The feather sheets, fur collars and eyelids all use low-segment versions of their own;
// the static parts are merged at the end with mergeStatic; the flame sheets on the chest hang under the torso, scaling with the breathing, and are not merged along with the torso.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, loft, mergeStatic, partKit, PI, rng, smooth, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type V3 = [number, number, number];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Feather surface ─────────────────────────

interface SheetOpts {
  /** The curve the feather roots follow, with s the arc-length position from 0 to 1 */
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
  groove?: number;
  /** The feather tip is pointed (give an exponent, the larger the more pointed); if not given it is round-headed */
  pointy?: number;
  rachis?: number;
  /** Vertex color: side = -1 is the back and 1 the underside; w is the lateral position within the feather (0.5 is the rachis) */
  color?: (s: number, c: number, side: number, w: number) => THREE.ColorRepresentation;
  rows: number;
  cols: number;
}

interface Sheet {
  geo: THREE.BufferGeometry;
  /** The half thickness at s, at distance d from the feather root (for the layer stacked on top) */
  h: (s: number, d: number) => number;
}

/**
 * A feather surface joined into one sheet (Skyreign's featherSheet): along the feather-root curve, each point grows a feather toward dir, the trailing edge cut into individual feather tips,
 * with grooves pressed into the surface between feathers. The cross-section is a full ring, closing naturally as the thickness at both ends goes to 0; the outline falls only on the edges of the feather tips and the creases of the grooves (pitfall 20).
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

interface CollarOpts {
  r0: number;
  len: number;
  thick: number;
  flare: number;
  tufts: number;
  a0?: number;
  a1?: number;
  notch?: number;
  curl?: number;
  groove?: number;
  jitter?: number;
  phase?: number;
  bias?: number;
  /** The fur tips curl toward the θ = 0 side (the flame tongues leaping up) */
  rise?: number;
  seed?: number;
  /** Vertex color: sK is 0 at the root to 1 at the tip along the fur flow, and th is the angle about the axis (0 toward +z) */
  tint?: (sK: number, th: number) => THREE.Color;
}

/**
 * A low-segment fur collar (furCollar in shapes.ts, with the columns per tuft and the segments along the fur flow turned into parameters, and the vertex colors applied by position along the fur flow,
 * so the tip of every tuft changes color following the shape of the sawtooth): a whole ring of feathers joined together, the trailing edge cut into clumps of pointed tips with grooves pressed in between clumps.
 */
function lowCollar(o: CollarOpts, segS = 6, per = 5): THREE.BufferGeometry {
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
  const rise = o.rise ?? 0;
  const cols = full ? nT : nT + 1;
  const J = segS * 2 + 1;
  const pos: number[] = [];
  const col: number[] = [];
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
      const sK = k / segS;
      const rr = cr[k] + nr[k] * off;
      const t2 = th - rise * Math.sin(th) * sK * sK;
      pos.push(Math.sin(t2) * rr, ca[k] + na[k] * off, Math.cos(t2) * rr);
      const tc = o.tint ? o.tint(sK, th) : new THREE.Color(1, 1, 1);
      col.push(tc.r, tc.g, tc.b);
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
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

/**
 * Low-segment eyelid shell (lidGeometry in shapes.ts): with +y as the top, covering from the top to a lip angle, the edge a rounded lip.
 * fr is the sample position from the top to the lip (0-1); to change color at the lip edge, a few more rows are kept on the two sides of the color change (pitfall 89)
 */
function lidLow(ri: number, ro: number, lip: number, seg = 18, fr = [0, 0.25, 0.5, 0.75, 1]): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const n = fr.length - 1;
  for (let i = 0; i <= n; i++) {
    const a = fr[i] * lip;
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
    const a = fr[i] * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  return smooth(new THREE.LatheGeometry(prof, seg));
}

/** A low-segment spherical cap centered on +z (iris, pupil) */
function capLow(r: number, ang: number, seg = 20, rings = 4): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** A closed round tube: a tube of radius r put along a ring of points (joined head to tail), with radial the cross-section segments; the normals are directly the cross-section directions */
function loopTube(pts: THREE.Vector3[], r: number, radial: number): THREE.BufferGeometry {
  const n = pts.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
  for (let i = 0; i < n; i++) {
    const T = pts[(i + 1) % n].clone().sub(pts[(i + n - 1) % n]).normalize();
    const O = pts[i].clone().sub(c);
    const N = O.addScaledVector(T, -O.dot(T)).normalize();
    const B = new THREE.Vector3().crossVectors(T, N);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * PI * 2;
      const d = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(pts[i].x + d.x * r, pts[i].y + d.y * r, pts[i].z + d.z * r);
      nor.push(d.x, d.y, d.z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const e = ((i + 1) % n) * radial + j;
      const f = ((i + 1) % n) * radial + ((j + 1) % radial);
      idx.push(a, b, e, b, f, e);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/**
 * A thin patch on the skull surface: f(u, v) returns [longitude, latitude] (0 longitude toward +z), laid onto an ellipsoid of radius r and scale sc, floating lift outward.
 * The normals are the ellipsoid's own normals, so the shading matches the skull; in the same outline group as the skull, the edge shows only a clean color change, with no extra ring of line.
 */
function skinPatch(f: (u: number, v: number) => [number, number], nu: number, nv: number, r: number, sc: V3, lift: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
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
    }
  const idx: number[] = [];
  const W = nu + 1;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * W + i;
      idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
    }
  const mid = (Math.floor(nv / 2) * nu + Math.floor(nu / 2)) * 6;
  const pa = new THREE.Vector3().fromArray(pos, idx[mid] * 3);
  const pb = new THREE.Vector3().fromArray(pos, idx[mid + 1] * 3);
  const pc = new THREE.Vector3().fromArray(pos, idx[mid + 2] * 3);
  const fn = new THREE.Vector3().crossVectors(pb.sub(pa), pc.sub(pa));
  if (fn.dot(new THREE.Vector3().fromArray(nor, idx[mid] * 3)) < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
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

interface PlumeOpts {
  /** The points the rachis passes through (lying in the yz plane) */
  pts: THREE.Vector3[];
  /** The half width of the vane at t (along x) */
  width: (t: number) => number;
  /** The half thickness of the vane at t */
  thick: (t: number) => number;
  /** Vertex color: t is 0 at the root to 1 at the tip along the rachis, u is the lateral position -1 to 1, and half is the half width at t (for converting to real distance) */
  color: (t: number, u: number, half: number) => THREE.Color;
  /** Sample positions along the rachis (from 0 to 1, denser near feature points) */
  ts: number[];
  radial: number;
}

/**
 * Long tail feather: a flat vane lofted along the rachis, the wide direction fixed toward x (the whole rachis lies in the yz plane and does not twist, pitfall 52),
 * colored by position along the rachis and lateral position (the chevron marks and the concentric rings of the ember eye), the width at both ends going to 0, closing naturally.
 */
function plumeGeo(o: PlumeOpts): { geo: THREE.BufferGeometry; at: (t: number) => { p: THREE.Vector3; n: THREE.Vector3; T: THREE.Vector3 } } {
  const path = new THREE.CatmullRomCurve3(o.pts, false, 'centripetal');
  const pos: number[] = [];
  const col: number[] = [];
  const Rr = o.radial;
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const H = new THREE.Vector3();
  for (const t of o.ts) {
    path.getPointAt(t, C);
    path.getTangentAt(t, T);
    H.crossVectors(X, T).normalize();
    const a = o.width(t);
    const b = o.thick(t);
    for (let j = 0; j < Rr; j++) {
      const th = (j / Rr) * PI * 2;
      const u = Math.cos(th);
      pos.push(C.x + u * a, C.y + H.y * Math.sin(th) * b, C.z + H.z * Math.sin(th) * b);
      const c = o.color(t, u, a);
      col.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < o.ts.length - 1; i++)
    for (let j = 0; j < Rr; j++) {
      const a = i * Rr + j;
      const b = (i + 1) * Rr + j;
      const a2 = i * Rr + ((j + 1) % Rr);
      const b2 = (i + 1) * Rr + ((j + 1) % Rr);
      idx.push(a, b, a2, b, b2, a2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding: the normal at the top point of the middle section must face the +x outside (the side where u = 1)
  const mi = Math.floor(o.ts.length / 2) * Rr;
  const nx = (g.attributes.normal as THREE.BufferAttribute).getX(mi);
  if (nx < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return {
    geo: g,
    at: (t) => {
      const p = path.getPointAt(t);
      const Tt = path.getTangentAt(t);
      return { p, T: Tt, n: new THREE.Vector3().crossVectors(X, Tt).normalize() };
    },
  };
}

// ───────────────────────── Shape ─────────────────────────

export function buildPhoenixLab(): LabModel {
  const RIMC = 0xffdcb8;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  // Palette: ash (back, backs of the wings, tail feathers), fire (chest, undersides of the wings), face (ivory, deep red eye ring, golden eyes and beak)
  const ASH_L = 0xb8aca9;
  const ASH = 0x8c8088;
  const ASH_D = 0x5c5060;
  const CRIMSON = 0xb02a3a;
  const EMBER = 0xe4502c;
  const FLAME = 0xff8a36;
  const GOLD = 0xffc24a;
  const IVORY = 0xfff2da;
  const PALE = 0xe2d8d2;
  const ROSE = 0xc79a94;
  const M = {
    feather: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    face: labToon(IVORY, { rim: 0.35, rimColor: RIMC }),
    lid: vc(labToon(0xffffff, { rim: 0.3, rimColor: RIMC })),
    beak: vc(labToon(0xffffff, { spec: 0.8, specTh: 0.975, rim: 0.35, rimColor: 0xffe6a8 })),
    gold: labToon(0xf4b23e, { rim: 0.35, rimColor: 0xffe6a8 }),
    leg: labToon(0x4e424a, { rim: 0.45, rimColor: RIMC }),
    claw: labToon(0x2a2228, { spec: 0.9, specTh: 0.97, rim: 0.3, rimColor: RIMC }),
    eye: labToon(0x3a140c, { ramp: 'gem', rim: 0 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    pupil: labToon(0x1c0c10, { rim: 0 }),
    nostril: labToon(0x7a4020, { rim: 0 }),
    ember: labToon(0xffd27a, { ramp: 'gem', emissive: 0xff8a20, emissiveAmt: 0.55, spec: 1.2, specTh: 0.9, rim: 0.3, rimColor: 0xfff0c8 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  const C = (c: THREE.ColorRepresentation) => new THREE.Color(c);

  const root = new THREE.Group();
  root.name = 'phoenix-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const HEAD = 9501;
  const BODY = 9502;
  const WING_L = 9503;
  const WING_R = 9504;
  const TAIL = 9505;
  const BEAK = 9506;
  const LEG = 9507;

  /** Place a ring of feathers: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal */
  const collar = (parent: THREE.Object3D, o: CollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup: number, segS = 6, per = 5) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, lowCollar(o, segS, per), M.feather);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    m.userData.inkGroup = inkGroup;
    return m;
  };

  // ── Skeleton: place moves the whole animal onto the pivot; the feet hang directly under place to stand firmly on the ground; bodyP pivots at the hip so the body can breathe and sway lightly ──
  const place = group(root);
  const HIP = v(0, 0.4, -0.06);
  const bodyP = group(place, [HIP.x, HIP.y, HIP.z]);
  const body = group(bodyP, [-HIP.x, -HIP.y, -HIP.z]);

  // ── Torso: one whole loft from the tail root forward and up to the neck (the chest thrust out, tapering toward the tail), the back ash-colored and the chest and belly fire; the throat fading upward into apricot ──
  const torsoPts = [v(0, 0.42, -0.38), v(0, 0.41, -0.27), v(0, 0.44, -0.13), v(0, 0.53, 0.0), v(0, 0.67, 0.08), v(0, 0.82, 0.1), v(0, 0.95, 0.08)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.06, 0.06, 0.05, 0],
    [0.22, 0.14, 0.14, 0],
    [0.42, 0.165, 0.172, 0.012],
    [0.6, 0.155, 0.16, 0.016],
    [0.76, 0.108, 0.104, 0.004],
    [0.9, 0.08, 0.08, 0],
    [1, 0, 0, 0],
  ]);
  const torsoPath = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal');
  /** The point on the torso surface at t, at angle th about the spine (th = PI/2 the belly side, -PI/2 the back side, 0 is +x) */
  const onTorso = (t: number, th: number, lift = 0) => {
    const Cc = torsoPath.getPointAt(t);
    const T = torsoPath.getTangentAt(t);
    const H = new THREE.Vector3().crossVectors(X, T).normalize();
    const [a, b, dy] = torsoProf(t);
    return Cc.addScaledVector(X, Math.cos(th) * (a + lift)).addScaledVector(H, Math.sin(th) * (b + lift) + dy);
  };
  const VENT = v(0, -0.4, 1).normalize();

  const torso = add(
    body,
    paint(loft(torsoPts, torsoProf, { segs: 44, radial: 30, side: X }), (p, n) => {
      const breast = C(ASH_L).lerp(C(PALE), ss(p.y, 0.5, 0.85));
      return C(ASH).lerp(breast, ss(n.dot(VENT), -0.2, 0.15));
    }),
    M.feather,
  );
  torso.userData.inkGroup = BODY;
  // The fire on the chest: a flower of fire still burning under the ash, the outer layer ember red and the inner layer orange-gold, the tip leaping up to under the neck ring.
  // It is two sheets lying on the torso surface (a mesh built along the torso's t and the angle about the spine, with clean edges, not relying on the vertex colors of a coarse mesh, pitfall 32);
  // in the same outline group as the torso, only changing color with no extra ring of line; hung under the torso and scaling with the breathing
  {
    const flame = (t0: number, t1: number, W: number, lift: number, col: (h: number, u: number) => THREE.Color, c0 = 0, lean = 0) => {
      const NR = 16;
      const NC = 10;
      const pos: number[] = [];
      const cl: number[] = [];
      const e = 1e-3;
      const nrm: number[] = [];
      const surf = (t: number, lat: number) => {
        const r = torsoProf(t)[1];
        return onTorso(t, PI / 2 + lat / Math.max(r, 0.02), lift);
      };
      for (let i = 0; i <= NR; i++) {
        const h = i / NR;
        // A round base and a pointed top, the midline with a bit of S-shaped sway
        const hw = W * (h < 0.32 ? Math.sin((PI / 2) * Math.sqrt(h / 0.32)) : Math.pow(1 - (h - 0.32) / 0.68, 1.25));
        const cx = c0 + lean * h * h + W * 0.22 * Math.sin(h * PI * 1.3) * h;
        const t = THREE.MathUtils.lerp(t0, t1, h);
        for (let j = 0; j <= NC; j++) {
          const u = (2 * j) / NC - 1;
          const lat = cx + u * Math.max(hw, 1e-4);
          const P = surf(t, lat);
          const dT = surf(t + e, lat).sub(surf(t - e, lat));
          const dL = surf(t, lat + e).sub(surf(t, lat - e));
          const n = new THREE.Vector3().crossVectors(dT, dL).normalize();
          pos.push(P.x, P.y, P.z);
          nrm.push(n.x, n.y, n.z);
          const c = col(h, u);
          cl.push(c.r, c.g, c.b);
        }
      }
      const idx: number[] = [];
      for (let i = 0; i < NR; i++)
        for (let j = 0; j < NC; j++) {
          const a = i * (NC + 1) + j;
          const b = a + NC + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
      g.setIndex(idx);
      // Winding: the triangles must face outward
      const pa = new THREE.Vector3().fromArray(pos, idx[0] * 3);
      const pb = new THREE.Vector3().fromArray(pos, idx[1] * 3);
      const pc = new THREE.Vector3().fromArray(pos, idx[2] * 3);
      const fn = new THREE.Vector3().crossVectors(pb.sub(pa), pc.sub(pa));
      if (fn.dot(new THREE.Vector3().fromArray(nrm, idx[0] * 3)) < 0) {
        for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
        g.setIndex(idx);
      }
      return g;
    };
    // Three tongues: the middle one tallest, the two on the sides shorter and slanting outward; inside it a small orange-gold fire
    const ember = (h: number) => C(EMBER).lerp(C(CRIMSON), ss(h, 0.72, 0.96));
    const mid = flame(0.45, 0.77, 0.08, 0.002, ember);
    const sideL = flame(0.455, 0.64, 0.045, 0.0011, ember, -0.055, -0.035);
    const sideR = flame(0.455, 0.64, 0.045, 0.0011, ember, 0.055, 0.035);
    const inner = flame(0.47, 0.66, 0.044, 0.0032, (h) => C(GOLD).lerp(C(FLAME), ss(h, 0.25, 0.7)));
    const fm = new THREE.Mesh(mergeGeometries([mid, sideL, sideR, inner])!, M.feather);
    fm.layers.enable(INK_LAYER);
    fm.userData.inkGroup = BODY;
    torso.add(fm);
  }

  // ── Wings: raised high, the wing surfaces facing forward, spreading up and out from the shoulders, as if just awake from the ash and basking in the warmth.
  //    The wing surface is built in its own coordinates (the wing bone along +x, the feathers growing toward -y, the underside facing +z, the same as Skyreign) and then turned onto the body with a set of basis vectors:
  //    the span direction outward and up and slightly back; the underside facing forward. The left wing's geometry is mirrored in x, and the basis is mirrored with it (pitfall 31: the top and bottom of the colors are judged separately with side).
  //    Two layers of feather sheet joined into one: flight feathers and coverts, the tips of the coverts covering the roots of the flight feathers, and the flesh of the wing bone covering the roots of the coverts ──
  interface WingRig { sx: number; wg: THREE.Group; q0: THREE.Quaternion; qFurl: THREE.Quaternion; qSpread: THREE.Quaternion; tipA: THREE.Group; shA: THREE.Group }
  const wings: WingRig[] = [];
  const S_W = 0.46;
  const phi = curveTable([[0, -1.64], [0.3, -1.58], [0.5, -1.4], [0.78, -1.06], [1, -0.82]]);
  const flightLen = curveTable([[0, 0.2], [0.3, 0.26], [0.5, 0.3], [0.78, 0.4], [1, 0.36]]);
  const featherU = (s: number) => (s < S_W ? (s / S_W) * 6 : 6 + ((s - S_W) / (1 - S_W)) * 7);
  // The outer part of the wing curls toward the back (deformed with the square of x, not rotating the whole sheet, pitfall 73): from the front it is a cupped sheet, and from the side the arc of the wing surface can be seen
  const CURL = 0.55;
  const curl = (g: THREE.BufferGeometry) => warp(g, (p) => {
    p.z -= CURL * Math.max(0, Math.abs(p.x) - 0.15) ** 2;
  });
  /** The orientation of the wing: span is the span direction and face is roughly the direction the underside faces (the right wing, x positive); it returns the right wing's basis, and the left wing is mirrored separately */
  const wingBasis = (span: THREE.Vector3, face: THREE.Vector3, sx: number) => {
    const S = span.clone().normalize();
    const N = face.clone().addScaledVector(S, -face.dot(S)).normalize();
    const Y = new THREE.Vector3().crossVectors(N, S);
    const mir = (a: THREE.Vector3) => v(-a.x, a.y, a.z);
    const m = sx > 0 ? new THREE.Matrix4().makeBasis(S, Y, N) : new THREE.Matrix4().makeBasis(mir(S).negate(), mir(Y), mir(N));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  };
  for (const sx of [-1, 1]) {
    const WG = sx < 0 ? WING_L : WING_R;
    const shP = onTorso(0.74, -PI / 2 + sx * 0.75, -0.035);
    const sh = group(body, [shP.x, shP.y, shP.z]);
    const wg = group(sh);
    const arm = [v(0, 0, 0), v(0.1, 0.03, 0), v(0.2, 0.06, 0.004), v(0.3, 0.07, 0), v(0.43, 0.04, -0.004), v(0.57, 0.0, -0.008)].map((p) => v(sx * p.x, p.y, p.z));
    const dir = (s: number) => {
      const a = phi(s)[0];
      return v(sx * Math.cos(a), Math.sin(a), 0);
    };
    const N = () => FWD;
    // The bend of the feather surface: the underside slightly concave, the tips of the primaries turned up toward the back (when the wing surface faces forward that is curling back, and from the front it is a cupped sheet of fire)
    const bend = (s: number, d: number) => {
      const c = Math.min(1, d / flightLen(s)[0]);
      return -0.03 * Math.sin(PI * c) - 0.06 * c * c * ss(s, 0.45, 1);
    };
    const flight = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0],
      feather: featherU,
      notch: (s) => 0.16 + 0.22 * ss(s, 0.5, 0.62),
      thick: (_s, c) => 0.011 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      rachis: 0.004,
      pointy: 0.8,
      rows: 66,
      cols: 5,
      color: (s, c, side) => {
        const hand = ss(s, S_W - 0.06, S_W + 0.06);
        if (side < 0) {
          // Backs of the wings: ash, the ends burning a line of ember (dark gray → ember red → orange)
          return C(ASH).lerp(C(ASH_D), ss(c, 0.2, 0.55) * (0.5 + 0.5 * hand)).lerp(C(EMBER), ss(c, 0.74, 0.84)).lerp(C(FLAME), ss(c, 0.9, 0.97));
        }
        // Undersides of the wings: the deep red feather roots burning outward to orange, the feather tips a line of gold
        return C(CRIMSON).lerp(C(EMBER), ss(c, 0.15, 0.5)).lerp(C(FLAME), ss(c, 0.6, 0.82)).lerp(C(GOLD), ss(c, 0.9, 0.97));
      },
    });
    const coverts = featherSheet({
      root: arm, dir, normal: N, bend,
      len: (s) => flightLen(s)[0] * 0.5,
      feather: (s) => featherU(s) * 1.4 + 0.5,
      notch: () => 0.3,
      thick: (_s, c) => 0.005 + 0.007 * (1 - c),
      under: flight.h,
      groove: 0.4,
      pointy: 0.8,
      rows: 56,
      cols: 4,
      color: (_s, c, side) => (side < 0 ? C(ASH_L).lerp(C(ASH), ss(c, 0.3, 0.7)).lerp(C(EMBER), ss(c, 0.84, 0.95)) : C(ROSE).lerp(C(EMBER), ss(c, 0.55, 0.92))),
    });
    // Wing bone: a rounded stretch of flesh along the leading edge, covering the roots of the two layers; the root buried in the shoulder (pitfalls 21, 25)
    const armGeo = loft(arm.map((p, i) => (i === 0 ? v(-sx * 0.04, -0.01, 0.0) : p)), curveTable([[0, 0, 0], [0.06, 0.046, 0.046], [0.3, 0.04, 0.036], [0.6, 0.031, 0.027], [0.9, 0.02, 0.018], [1, 0, 0]]), { segs: 26, radial: 10, up: FWD });
    paint(armGeo, (_p, n) => C(ASH).lerp(C(ROSE), ss(n.z, -0.1, 0.4)));
    for (const [geo, mat] of [[flight.geo, M.feather], [coverts.geo, M.feather], [armGeo, M.feather]] as [THREE.BufferGeometry, THREE.Material][]) {
      add(wg, curl(geo), mat).userData.inkGroup = WG;
    }
    const tip = arm[arm.length - 1].clone().addScaledVector(dir(1), flightLen(1)[0] * 0.92);
    tip.z -= CURL * Math.max(0, Math.abs(tip.x) - 0.15) ** 2;
    const q0 = wingBasis(v(0.5, 0.82, -0.28), v(0.55, 0.05, 1), sx);
    // Raised high: the span straighter and the whole wing surface facing forward; folded: the wing bone goes down along the side from the shoulder, slightly forward, the underside facing inward against the body,
    // with only the ash-colored backs of the wings and a ring of ember feather tips visible outside, like wearing a cloak of ash (the beat of curling up before Nirvana)
    const qSpread = wingBasis(v(0.55, 0.86, -0.1), v(0.2, 0.05, 1), sx);
    const qFurl = wingBasis(v(0.0, -0.62, 0.78), v(-1, 0, 0.0), sx);
    wg.quaternion.copy(q0);
    wings.push({ sx, wg, q0, qFurl, qSpread, tipA: group(wg, [tip.x, tip.y, tip.z]), shA: group(sh) });
  }

  // ── Shoulder feathers: a sheet of ash feathers on the back draping toward the tail, the tips burning with ember, covering the roots of both wings, so the wings read as growing out of the body ──
  {
    const at = torsoPath.getPointAt(0.8);
    const T = torsoPath.getTangentAt(0.8);
    collar(body, {
      r0: 0.1, len: 0.26, thick: 0.06, flare: 0.32, curl: 0.18, tufts: 7, notch: 0.42, jitter: 0.12, a0: -1.95, a1: 1.95, seed: 9,
      tint: (sK) => C(ASH_L).lerp(C(ASH), ss(sK, 0.2, 0.6)).lerp(C(EMBER), ss(sK, 0.78, 0.9)),
    }, at, T, v(0, 0, -1), BODY);
  }
  // ── Back feathers: another layer of ash feathers draping toward the tail over the middle of the back, the tips burning with ember; from the back it is layer on layer of ash that has not gone out ──
  {
    const at = torsoPath.getPointAt(0.6);
    const T = torsoPath.getTangentAt(0.6);
    collar(body, {
      r0: 0.146, len: 0.26, thick: 0.07, flare: 0.42, curl: 0.12, tufts: 6, notch: 0.4, jitter: 0.12, a0: -1.5, a1: 1.5, phase: 0.5, seed: 21,
      tint: (sK) => C(ASH).lerp(C(ASH_D), ss(sK, 0.3, 0.6) * 0.6).lerp(C(EMBER), ss(sK, 0.66, 0.8)),
    }, at, T, v(0, 0, -1), BODY);
  }
  // ── Neck ring: a ring of ash feathers draping down behind the head, the tips burning into embers (ember feathers); it separates the ivory face from the fire-colored chest ──
  {
    const at = torsoPath.getPointAt(0.88);
    const T = torsoPath.getTangentAt(0.88);
    collar(body, {
      r0: 0.075, len: 0.2, thick: 0.07, flare: 0.66, curl: 0.42, tufts: 10, notch: 0.45, jitter: 0.14, seed: 3,
      tint: (sK) => C(ASH_L).lerp(C(ASH), ss(sK, 0.25, 0.6)).lerp(C(EMBER), ss(sK, 0.72, 0.84)).lerp(C(FLAME), ss(sK, 0.9, 0.98)),
    }, at, T, v(0, 0, -1), BODY, 6, 4);
  }

  // ── Tail: a short tail fan at the tail root going back and down (ash, the tips ember); three long tail feathers extend from it, flowing level back, the ends curling up into tongues of fire, with an ember eye at the base of each tongue ──
  const tailRoot = torsoPath.getPointAt(0.04);
  const tailG = group(body, [tailRoot.x, tailRoot.y, tailRoot.z + 0.01]);
  const plumes: { g: THREE.Group; i: number; yaw: number; tipA: THREE.Group }[] = [];
  {
    const rootPts = [v(-0.07, 0, 0.015), v(0, 0.01, -0.005), v(0.07, 0, 0.015)];
    const tdir = (s: number) => v((s - 0.5) * 1.4, -0.7, -1).normalize();
    const tN = (s: number) => new THREE.Vector3().crossVectors(tdir(s), X).normalize();
    const tLen = (s: number) => 0.3 * (0.85 + 0.15 * Math.cos((s - 0.5) * PI));
    const fan = featherSheet({
      root: rootPts, dir: tdir, normal: tN,
      bend: (s, d) => 0.012 * Math.sin(PI * Math.min(1, d / tLen(s))),
      len: tLen,
      feather: (s) => s * 9,
      notch: () => 0.2,
      thick: (_s, c) => 0.012 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      pointy: 0.8,
      rows: 46,
      cols: 5,
      color: (_s, c, side) => (side < 0 ? C(ASH).lerp(C(ASH_D), ss(c, 0.3, 0.6)).lerp(C(EMBER), ss(c, 0.76, 0.86)).lerp(C(FLAME), ss(c, 0.9, 0.97)) : C(ASH_D).lerp(C(EMBER), ss(c, 0.5, 0.9))),
    });
    add(tailG, fan.geo, M.feather).userData.inkGroup = TAIL;

    // Long tail feathers: the rachis in the yz plane (flowing back and slightly down, the end curling up), the vane spread along x;
    // the two at the sides only spread outward a little, and from the front they are hidden by the body, so they do not look like two paddles held at the sides of the body;
    // the front section is a thin ash-colored vane with chevron-shaped ember marks one after another (one mark per rebirth), and the end opens into the ember eye: a dark gray outer ring, an ember-red middle ring, gold at the center
    const T_EYE = 0.8;
    const bandAt = (t: number, u: number) => {
      // Chevron marks: the point toward the feather tip, five marks with t from 0.22 to 0.7
      if (t < 0.2 || t > 0.72) return 0;
      const q = (t - 0.2) / 0.1 - Math.abs(u) * 0.55;
      const f = q - Math.floor(q);
      return ss(f, 0.0, 0.06) * (1 - ss(f, 0.36, 0.44));
    };
    const ts: number[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      ts.push(t);
    }
    const mk = (L: number) =>
      plumeGeo({
        pts: [v(0, 0.01, 0.02), v(0, -0.05, -0.18), v(0, -0.11, -0.4), v(0, -0.12, -0.62), v(0, -0.05, -0.8), v(0, 0.09, -0.9), v(0, 0.26, -0.93)].map((p) => p.multiplyScalar(L)),
        width: (t) => {
          const shaft = 0.014 + 0.022 * ss(t, 0.04, 0.35);
          // Above the ember eye it closes into the tip of a tongue of fire: a round base, a concave arc closing to a point
          const eye = t < T_EYE ? 0.078 * Math.sqrt(Math.max(0, 1 - ((t - T_EYE) / 0.12) ** 2)) : 0.078 * Math.pow(Math.max(0, 1 - (t - T_EYE) / (1 - T_EYE)), 1.5);
          return Math.max(shaft * (1 - ss(t, 0.8, 0.95)), eye) * ss(t, 0, 0.02) * L;
        },
        thick: (t) => (0.007 - 0.002 * t) * L,
        color: (t, u, half) => {
          const du = (u * half) / (0.078 * L);
          const d = Math.hypot((t - T_EYE) / 0.085, du);
          const vane = C(ASH).lerp(C(ASH_L), ss(Math.abs(u), 0.6, 1) * 0.5).lerp(C(EMBER), bandAt(t, u));
          if (t < 0.66) return vane;
          // The ember eye: a dark gray outer ring, an ember-red middle ring, gold at the center; above the eye is the tongue of fire (a tip burning from ember red to orange)
          const flameC = C(EMBER).lerp(C(FLAME), ss(t, 0.9, 0.98));
          const eyeC = d < 0.42 ? C(GOLD) : d < 0.68 ? C(EMBER) : d < 1 ? C(ASH_D) : flameC;
          return (t > T_EYE ? flameC : vane).lerp(eyeC, 1 - ss(d, 0.98, 1.06));
        },
        ts,
        radial: 10,
      });
    for (const [i, yaw, L, roll] of [[0, -0.28, 0.84, -0.2], [1, 0, 1, 0], [2, 0.28, 0.84, 0.2]] as [number, number, number, number][]) {
      const g = group(tailG, [0, 0, 0], [0, yaw, roll]);
      const pl = mk(L);
      add(g, pl.geo, M.feather).userData.inkGroup = TAIL + 10 + i;
      const e = pl.at(T_EYE);
      const gem = add(g, new THREE.SphereGeometry(0.03 * L, 12, 8), M.ember, [e.p.x, e.p.y, e.p.z], [0, 0, 0], [1, 1, 0.42]);
      gem.quaternion.setFromUnitVectors(FWD, e.n);
      gem.userData.inkGroup = TAIL + 10 + i;
      plumes.push({ g, i, yaw, tipA: group(g, [e.p.x, e.p.y, e.p.z]) });
    }
  }

  // ── Feet: both feet planted firmly, charcoal-gray tarsi, three toes forward and one back, black claws; the thighs hidden in a ring of ash-colored leg feathers ──
  for (const sx of [-1, 1]) {
    const hip = group(place, [sx * 0.09, 0.28, -0.03]);
    add(hip, loft([v(0, 0.16, -0.01), v(0, 0.06, 0), v(0, -0.1, 0.012), v(0, -0.25, 0.03)], curveTable([[0, 0, 0], [0.08, 0.036, 0.038], [0.5, 0.03, 0.032], [0.92, 0.028, 0.03], [1, 0, 0]]), { segs: 14, radial: 10, side: X }), M.leg).userData.inkGroup = LEG;
    // Leg feathers: a ring of ash-colored feathers below the knee, covering the junction of leg and belly
    collar(hip, {
      r0: 0.034, len: 0.12, thick: 0.05, flare: 0.5, curl: 0.3, tufts: 6, notch: 0.4, seed: 5 + sx,
      tint: (sK) => C(ASH_L).lerp(C(ASH), ss(sK, 0.3, 0.7)).lerp(C(EMBER), ss(sK, 0.82, 0.94)),
    }, v(0, 0.1, 0), v(0, 1, 0), v(0, 0, -1), LEG, 5, 4);
    const foot = group(hip, [0, -0.25, 0.03]);
    for (const [yaw, len] of [[-0.5, 0.09], [0, 0.11], [0.5, 0.09], [PI, 0.055]] as [number, number][]) {
      const tg = group(foot, [0, 0, 0], [0, yaw + sx * 0.08, 0]);
      const pts = [v(0, 0.01, 0), v(0, -0.012, len * 0.45), v(0, -0.02, len)];
      add(tg, loft(pts, curveTable([[0, 0, 0], [0.12, 0.019, 0.016], [0.8, 0.014, 0.012], [1, 0, 0]]), { segs: 7, radial: 6, side: X }), M.leg).userData.inkGroup = LEG;
      const tp = [v(0, -0.018, len * 0.94), v(0, -0.022, len + 0.02), v(0, -0.03, len + 0.03)];
      add(tg, loft(tp, (t) => { const k = Math.pow(1 - t, 0.8); return [0.008 * k + 0.0006, 0.008 * k + 0.0006]; }, { segs: 5, radial: 6, side: X }), M.claw);
    }
  }

  // ── Head: neck is on the neck, look handles slowly turning and tilting the head, and the head's origin is at the center of the skull ──
  const neckPt = torsoPath.getPointAt(0.93);
  const neck = group(body, [neckPt.x, neckPt.y, neckPt.z]);
  const look = group(neck);
  look.rotation.order = 'YXZ';
  const HR = 0.155;
  const HOFF = v(0, 0.1, 0.05);
  const head = group(look, [HOFF.x, HOFF.y, HOFF.z]);
  const HS: V3 = [1, 0.93, 1.08];

  // The eyes are small and sunk in the sockets: about fourteen percent of the head's width in diameter (no doll big eyes)
  const ER = 0.14 * HR;
  const eyeD = v(0.58, 0.2, 0.79).normalize();
  const surfR = (d: THREE.Vector3) => HR / Math.sqrt((d.x / HS[0]) ** 2 + (d.y / HS[1]) ** 2 + (d.z / HS[2]) ** 2);

  // The skull is gold-orange on the top of the head and around the eyes; the ivory only follows below the beak root (chin, lower edge of the cheeks, throat), sinking back into the neck ring, not a round face patch
  add(head, paint(new THREE.SphereGeometry(HR, 40, 26), (p) => {
    const d = p.clone().normalize();
    return C(ASH_L).lerp(C(0xf8993c), ss(1.3 * d.y + 0.8 * d.z, -0.3, 0.35)).lerp(C(GOLD), ss(d.y, 0.72, 0.95) * 0.6);
  }), M.feather, [0, 0, 0], [0, 0, 0], HS).userData.inkGroup = HEAD;
  const faceTop = curveTable([[0, -0.08], [0.4, -0.16], [0.8, -0.28], [1.1, -0.4], [1.4, -0.6], [1.7, -0.9], [1.95, -1.3]]);
  const L0 = 1.95;
  add(head, skinPatch((u, w) => {
    const lon = (2 * u - 1) * L0;
    const top = faceTop(Math.abs(lon))[0];
    return [lon, THREE.MathUtils.lerp(-1.42, top, w)];
  }, 56, 14, HR, HS, 0.0018), M.face).userData.inkGroup = HEAD;

  // Beak: a short gold hooked beak, the tip tending to amber; the upper beak goes forward from the beak root with the tip hooking down, and the lower beak is short and tucked into the upper (the jaw group, for opening the beak);
  // the seam between the upper and lower beak is the mouth, and no gape drawn turning upward is added (that would be a human smile)
  const hv = (x: number, y: number, z: number) => v(x * HR, y * HR, z * HR);
  const hookTip = hv(0, -0.24, 1.4);
  const upper = loft([hv(0, 0.1, 0.84), hv(0, 0.08, 1.08), hv(0, 0.0, 1.28), hv(0, -0.14, 1.4), hv(0, -0.32, 1.38)],
    curveTable([[0, 0, 0], [0.06, 0.26 * HR, 0.25 * HR], [0.3, 0.23 * HR, 0.22 * HR], [0.6, 0.15 * HR, 0.15 * HR], [0.85, 0.075 * HR, 0.085 * HR], [1, 0, 0]]), { segs: 22, radial: 14, side: X });
  add(head, paint(upper, (p) => C(GOLD).lerp(C(0xc86a1e), 1 - ss(p.distanceTo(hookTip), 0.14 * HR, 0.24 * HR))), M.beak).userData.inkGroup = BEAK;
  const jawP = hv(0, -0.12, 0.84);
  const jaw = group(head, [jawP.x, jawP.y, jawP.z]);
  add(jaw, loft([hv(0, -0.04, 0), hv(0, -0.1, 0.2), hv(0, -0.13, 0.36)], curveTable([[0, 0, 0], [0.1, 0.24 * HR, 0.12 * HR], [0.6, 0.17 * HR, 0.09 * HR], [1, 0, 0]]), { segs: 12, radial: 10, side: X }), M.gold).userData.inkGroup = BEAK;
  for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(1, 6, 4), M.nostril, [sx * 0.12 * HR, 0.13 * HR, 1.06 * HR], [0, sx * 0.5, 0], [0.026 * HR, 0.026 * HR, 0.018 * HR]);

  // Eyes: a bird's eyes, small and deep: an iris of dark brown with a touch of ember red, a black pupil taking half, one small point of highlight, and around it a thin ring of deep red bare skin (the phoenix's red eye ring);
  // no sclera, no brows, no doll eyes, and the eyelids are normally tucked into the head (they close from above and below only when blinking).
  // The iris, pupil and highlight are wrapped in a gaze group turned slightly forward, so both eyes look forward together (pitfall 43)
  const eyeA: THREE.Group[] = [];
  const lids: { up: THREE.Group; lo: THREE.Group; upOpen: number; loOpen: number }[] = [];
  const his: THREE.Mesh[] = [];
  const CRIM = 0xc02a38;
  // The eyelid as a whole is the head's gold-orange: when closed it is an eyelid shut inside the deep red eye ring (painting the lip red would make two red lines), not a red ball
  const LID_FR = [0, 0.3, 0.55, 0.72, 0.8, 0.87, 1];
  const LID_RO = ER * 1.22;
  const lidPaint = (g: THREE.BufferGeometry) => paint(g, () => C(0xf8993c));
  const lidUp = lidPaint(lidLow(ER * 1.07, LID_RO, PI / 2, 14, LID_FR));
  const lidLo = lidPaint(lidLow(ER * 1.06, ER * 1.2, PI / 2, 14, LID_FR));
  // The iris is made larger than the opening of the eye ring, so when it turns forward its rear edge does not expose the eyeball; dark brown, with a touch of ember red at the edge of the pupil
  const IRIS_A = 1.65;
  const irisGeo = paint(capLow(ER * 1.005, IRIS_A, 18, 6), (p) => {
    const a = Math.acos(clamp(p.z / Math.max(p.length(), 1e-6), -1, 1));
    return C(0x86301a).lerp(C(0x4a1a10), ss(a, 0.6, 0.95));
  });
  /** Inside the skull (compared with the skull's ellipsoid, margin is the distance kept inward) */
  const inHead = (p: THREE.Vector3, margin = 0) => (p.x / HS[0]) ** 2 + (p.y / HS[1]) ** 2 + (p.z / HS[2]) ** 2 < (HR - margin) ** 2;
  const GAZE = 0.3;
  for (const sx of [-1, 1]) {
    const d = v(sx * eyeD.x, eyeD.y, eyeD.z);
    const c = d.clone().multiplyScalar(surfR(d) - 0.58 * ER);
    const eg = group(head, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.7, 0.05, 0.71).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.12]);
    add(roll, new THREE.SphereGeometry(ER, 18, 12), M.eye).userData.inkGroup = HEAD + 40;
    const want = v(0, 0.05, 1).normalize().applyQuaternion(eg.quaternion.clone().multiply(roll.quaternion).invert());
    const gq = new THREE.Quaternion().setFromUnitVectors(FWD, want);
    const ang = 2 * Math.acos(clamp(gq.w, -1, 1));
    const gaze = group(roll);
    gaze.quaternion.copy(new THREE.Quaternion().slerp(gq, Math.min(1, GAZE / Math.max(ang, 1e-4))));
    add(gaze, irisGeo, M.iris).userData.inkGroup = HEAD + 40;
    add(gaze, capLow(ER * 1.012, 0.5, 14, 3), M.pupil).userData.inkGroup = HEAD + 40;
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

    // Eye ring: along the ring where the eyeball emerges from the skull (finding the boundary by bisection at each azimuth), a thin deep red round tube (bare skin) is put on, so the eye is round and not almond-shaped
    eg.updateMatrix();
    roll.updateMatrix();
    const toHead = eg.matrix.clone().multiply(roll.matrix);
    const onEye = (th: number, ph: number, r: number) => v(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)).multiplyScalar(r);
    const RN = 40;
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < RN; i++) {
      const ph = (i / RN) * PI * 2;
      let lo = 0.1;
      let hi = 1.7;
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) / 2;
        if (inHead(onEye(mid, ph, ER).applyMatrix4(toHead))) hi = mid;
        else lo = mid;
      }
      ring.push(onEye(hi, ph, ER));
    }
    add(roll, paint(loopTube(ring, 0.2 * ER, 8), () => C(CRIM)), M.lid).userData.inkGroup = HEAD;

    // Eyelids: when open the whole piece is tucked into the skull (the circle of the lip is entirely inside the skull), so no extra ivory shell appears above and below the eye
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
    let upOpen = 1.0;
    while (upOpen < 1.7 && !hidden(-upOpen)) upOpen += 0.02;
    let loOpen = 0.7;
    while (loOpen < 1.7 && !hidden(PI + loOpen)) loOpen += 0.02;
    const up = group(lidG, [0, 0, 0], [-upOpen, 0, 0]);
    add(up, lidUp, M.lid).userData.inkGroup = HEAD;
    const lo = group(lidG, [0, 0, 0], [PI + loOpen, 0, 0]);
    add(lo, lidLo, M.lid).userData.inkGroup = HEAD;
    lids.push({ up, lo, upOpen, loOpen });
  }

  // Crest (the origin of crestG is on the top of the head, the pivot when the flames sway): a ring of fire tongues around the back half of the top of the head (the fur collar's fur flow pointing up),
  // the one behind the tallest and gradually shorter toward the sides, the tongue tips drawing in and curling back, like flames blown backward by the wind; the forehead left empty for the face.
  // Each tongue faces outward, so from the front, side and back it is a ring of fire, and not a single antenna. Gold roots burning into red tips;
  // in the same outline group as the skull, so the roots have no extra ring of line, and the fire grows from the top of the head and is not a crown set on it
  const CR = hv(0, 0.56, -0.1);
  const crestG = group(head, [CR.x, CR.y, CR.z]);
  let crestTip = v(0, 0, 0);
  {
    const m = collar(crestG, {
      r0: 0.52 * HR, len: 0.27, thick: 0.07, flare: 0.5, curl: 0.95, tufts: 5, notch: 0.6, jitter: 0.12, bias: 0.4, rise: 0.45,
      a0: -2.25, a1: 2.25, phase: 0.5, seed: 17,
      tint: (sK) => C(0xf8993c).lerp(C(GOLD), ss(sK, 0.1, 0.25)).lerp(C(FLAME), ss(sK, 0.3, 0.5)).lerp(C(EMBER), ss(sK, 0.58, 0.76)).lerp(C(CRIMSON), ss(sK, 0.88, 0.99)),
    }, v(0, 0, 0), v(0, -0.94, 0.34), v(0, 0, -1), HEAD, 8, 6);
    // Anchor at the crest tip: the highest point
    m.updateMatrix();
    const pa = m.geometry.attributes.position as THREE.BufferAttribute;
    const q = new THREE.Vector3();
    let best = -Infinity;
    for (let i = 0; i < pa.count; i++) {
      q.fromBufferAttribute(pa, i).applyMatrix4(m.matrix);
      if (q.y > best) {
        best = q.y;
        crestTip = q.clone();
      }
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const heartP = onTorso(0.58, PI / 2, 0);
  const rig = {
    head: group(look, [HOFF.x, HOFF.y, HOFF.z + HR * 0.6]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [hookTip.x, hookTip.y, hookTip.z]),
      crest: group(crestG, [crestTip.x, crestTip.y, crestTip.z]),
      wingL: wings[0].shA,
      wingR: wings[1].shA,
      wingTipL: wings[0].tipA,
      wingTipR: wings[1].tipA,
      tail: plumes[1].tipA,
      plumeL: plumes[0].tipA,
      plumeR: plumes[2].tipA,
      heart: group(body, [heartP.x, heartP.y, heartP.z]),
    },
  };
  const act = { focus: 0, spread: 0, furl: 0, glow: 0, cry: 0 };

  // Static parts merged (mesh budget SR 60): nodes that move when idle act as owners, and the torso (scaling with the breathing) and the eye highlights (switched on and off when blinking) are not merged
  mergeStatic(root, {
    owners: [place, bodyP, ...wings.map((w) => w.wg), neck, look, head, jaw, tailG, ...plumes.map((p) => p.g), crestG, ...lids.flatMap((l) => [l.up, l.lo])],
    keep: [torso, ...his],
    rig,
  });

  // ── Idle: basking in the warmth. Breathing slowly, the wing surfaces opening and closing to fan warm air (the hand half a beat behind the shoulder), the crest swaying lightly like a flame, the tail feathers swaying slowly;
  //    the head turning slowly and now and then tilting; the blinks slow too. All computed from t, so frame-by-frame screenshots at frozen time are consistent too (pitfall 80) ──
  const LOOKS = [0.12, -0.08, 0.22, 0.0, -0.18, 0.1];
  const LOOK_T = 2.6;
  const lookAt = (t: number) => {
    const u = t / LOOK_T;
    const i = Math.floor(u);
    const f = u - i;
    const n = LOOKS.length;
    return THREE.MathUtils.lerp(LOOKS[((i % n) + n) % n], LOOKS[(((i + 1) % n) + n) % n], ss(f, 0.55, 0.95));
  };
  const BLINK = 4.2;
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  let lastGlow = -1;
  const update = (t: number) => {
    const L = THREE.MathUtils.lerp;
    const fo = act.focus;
    const sp = act.spread;
    const fu = act.furl;
    const cry = act.cry;
    const br = Math.sin(t * 1.3);
    torso.scale.set(1 + br * 0.01, 1 + br * 0.004, 1 + br * 0.012);
    bodyP.rotation.set(Math.sin(t * 0.65) * 0.012 - cry * 0.06, 0, Math.sin(t * 0.4) * 0.01);
    // Wings: slowly fanning warm air (a small angle about the span direction), spreading further up when raised; drawing together forward when furled
    for (const r of wings) {
      const fan = Math.sin(t * 0.9 + r.sx * 0.2) * 0.07;
      qa.copy(r.q0).slerp(r.qSpread, sp);
      qa.slerp(r.qFurl, fu);
      qb.setFromEuler(e3.set(fan * (1 - fu), 0, (Math.sin(t * 0.9 - 0.6) * 0.03) * (1 - fu)));
      r.wg.quaternion.copy(qa).multiply(qb);
    }
    // Head: turning slowly and now and then tilting (as if listening to something long known); looking straight ahead at focus
    const tilt = Math.max(0, Math.sin(t * 0.33)) ** 3 * 0.16;
    look.rotation.y = lookAt(t) * (1 - fo) * (1 - fu * 0.6);
    look.rotation.x = Math.sin(t * 0.47) * 0.02 - cry * 0.28 - sp * 0.08 + fu * 0.22;
    look.rotation.z = tilt * (1 - fo);
    jaw.rotation.x = cry * 0.55;
    // The crest sways lightly like a flame, and is raised when the wings are spread
    crestG.rotation.set(Math.sin(t * 2.1) * 0.03 + Math.sin(t * 3.4 + 1) * 0.015 - sp * 0.2, 0, Math.sin(t * 1.6 + 0.5) * 0.03);
    // The tail feathers sway slowly
    tailG.rotation.set(Math.sin(t * 0.65 - 1.0) * 0.025, Math.sin(t * 0.4 - 0.8) * 0.04, 0);
    for (const p of plumes) p.g.rotation.set(Math.sin(t * 0.8 + p.i * 1.3) * 0.03, p.yaw + Math.sin(t * 0.55 + p.i) * 0.04, (p.i - 1) * 0.2);
    // Ember eyes: written only when a weight changes (another spirit's ultimate changes uEmissiveAmt, and overwriting it every frame would cover it)
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.ember.emissiveIntensity = 0.55 + act.glow * 0.9;
    }
    // Blink: a bird closes mostly with the lower lid coming up and the upper lid coming down a little, the two overlapping a little above the midline, leaving no gap when fully closed (a bright iris showing through a gap looks like squinting);
    // closing slowly and opening slowly; the highlight is hidden once it is more than half closed
    const bt = ((t + 1.4) % BLINK) / 0.34;
    const close = bt < 1 ? Math.min(1, Math.sin(bt * PI) * 1.25) : 0;
    for (const l of lids) {
      l.up.rotation.x = -L(l.upOpen, 0.22, close);
      l.lo.rotation.x = PI + L(l.loOpen, -0.26, close);
    }
    for (const h of his) h.visible = close < 0.6;
  };
  update(1);

  // Move the whole bird onto the pivot: the x and z center of the bounding box is placed at the origin, so the side and back views are not cropped (pitfall 66)
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
