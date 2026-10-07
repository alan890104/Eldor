// Voltarion, the Thunder Qilin (model lab version): a qilin that walks on thunder; it is said that every bolt of lightning over the Thunderpeal Wilds is a footprint it left while patrolling its territory.
// It keeps the five things that made the old model easiest to recognize: an indigo-purple body with a pale purple belly plate, a single thunder-light horn on the forehead, gold hooves, a lightning-shaped mane, and the gold ornament and thunder crystal on the chest.
// The old version was a body of three stacked balls on four thin-stick legs, surrounded by a ring of electric beads, a ring of white cloud eggs at the feet, lightning and sparks glowing all over the body, and a face too small to read an expression.
// Body shape follows the lore (the qilin: the body of a musk deer, the tail of an ox, the hooves of a horse): a four-legged animal between a deer and a horse, a deep chest and narrow waist, a long neck held high, thin but strong legs, gold horse hooves;
// not Noxfang's wolf body (low and long), nor Ignisar's lion body (the weight in front): the center of gravity is between the four feet, and the head and horn are the highest point of the whole body.
// Pose: a step in the middle of a patrol, the right forefoot lifted with the hoof folded back, the left hind foot with the heel off the ground and the hoof tip touching down; the head held high, as if looking over its own territory.
// Personality: a lord patrolling the thunder plains, with a gaze like lightning, majestic but not irascible (the qilin is a benevolent beast that does not trample living grass). The eyes are a dragonkind's small eyes: one whole sheet of golden-yellow iris, a thin vertical pupil, one small point of highlight,
// buried under a thick brow ridge whose lower edge stops at the upper edge of the eye, low on the inside and high on the outside, the outer end sweeping back into a small pointed horn; the eyelids appear only when blinking; the mouth closed into one long line, the corners tucked up slightly beneath the cheekbones, a steady faint smile, neither pouting nor fierce.
// The head is between a dragon's and a horse's: a wolf's forehead, a long, narrowing dragon muzzle, nostril wings swelling on both sides of the muzzle tip (the nostrils opening outward and up, so from the front it is not a pig's nose), a pale purple lower jaw, and pricked pointed leaf ears.
// The details are all real geometry: on the shoulders, back, rump and sides of the neck a sheet of fish scales in staggered rows (the rear edge of the previous scale pressing on the next, the rear edge a ring of brighter color),
// from the throat to under the belly a pale purple belly plate with transverse grooves (a dragon's belly scutes); the mane, top of the head and cheek fins are each a whole sheet of fur whose trailing edge is cut into lightning bends, the roots indigo-purple and the tips golden yellow,
// not separate armor plates; on each of the four hooves a ring of fluffy white cloud fur (treading on clouds), the gold hoof with a slanted front wall and a low heel, topped by a ring of dark gold coronet.
// Gaze order: the face (the golden-yellow lightning eyes, the brow ridge, the mouth line) and the faceted thunder horn on the forehead first, the gold ornament and thunder crystal on the chest and the gold hooves second, and the fish scales, mane and tail as support.
// Back: the mane splits from behind the head along the spine all the way to the tail root, with two sheets on the neck spreading to the sides into a V; the tail flicks up to the side and up, its end a mass of thundercloud
// (the cloud unfolded by the trait "Thunder Descent"), with two small bolts of lightning hanging from the cloud base; the hind hoof with its heel off the ground shows its sole, with a bolt of lightning inlaid in the sole: this is the footprint it leaves where it walks.
// Restrained light effects: the old version's ring of electric beads, cloud eggs, thunder patterns on the flanks, floating sparks and flickering electric light are removed; the only emissive left is the thunder horn, the thunder crystal on the chest and the lightning on the hoof soles, with no reliance on bloom.
// SSR has only one form: the builder does not look at the evolution stage.
// Action weights (act): charge makes the thunder horn, the thunder crystal on the chest, the lightning on the hoof soles and the eyes glow platinum, with the looking around stopped and the gaze straight ahead (the ultimate storing thunder);
//   rear throws the head back, the single horn held high, both ears laid back (the beat of the long neigh of the ultimate).
// Anchors: head (center of the face), eyes (the eyeball surfaces), mouth (the mouth line at the muzzle tip), hornTip (the tip of the thunder horn), horn (the gold band at the horn root),
//   chest (the thunder crystal on the chest), tailCloud (the thundercloud at the end of the tail).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, furCollar, lathe, loft, outline, partKit, PI, slab, smooth, type FurCollarOpts, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);

// ───────────────────────── Helpers for the face-count budget (SSR 60,000 faces) ─────────────────────────

/** Eyelid shell: the same outline as lidGeometry in shapes.ts, with the lathe segments and the number of outline points adjustable (the eyelid edge shows only half a circle from the front, so 24 segments show no corner) */
function lidGeo(ri: number, ro: number, lip: number, seg = 24, n = 6, rim = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), ri * Math.cos(a)));
  }
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < rim; i++) {
    const b = (i / rim) * PI;
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
 * An elliptical disc on a sphere (iris, pupil): centered on +z, longitude radius rx, latitude radius ry (radians), laid onto a sphere of radius r.
 * A polar grid going outward ring by ring, with segs segments on the outer edge; compared with sphereDecal subdividing long thin triangles three times it saves many faces, and the chord faces do not sink into the sphere.
 */
function diskDecal(rx: number, ry: number, r: number, rings = 3, segs = 28): THREE.BufferGeometry {
  const pos: number[] = [0, 0, r];
  for (let k = 1; k <= rings; k++)
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * PI * 2;
      const lon = (k / rings) * rx * Math.cos(a);
      const lat = (k / rings) * ry * Math.sin(a);
      pos.push(Math.cos(lat) * Math.sin(lon) * r, Math.sin(lat) * r, Math.cos(lat) * Math.cos(lon) * r);
    }
  const idx: number[] = [];
  const at = (k: number, j: number) => (k === 0 ? 0 : 1 + (k - 1) * segs + (j % segs));
  for (let j = 0; j < segs; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let k = 1; k < rings; k++)
    for (let j = 0; j < segs; j++) idx.push(at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j), at(k + 1, j + 1), at(k, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((x) => x / r), 3));
  g.setIndex(idx);
  return g;
}

/**
 * The furCollar mesh is column by column (12 columns per tuft), 29 vertices per column (once around: the outer side, the fur tip, the inner side); take one column every si columns and one point every sj points and reconnect the triangles,
 * with the shape and vertex normals reusing the values computed on the original fine mesh, only with fewer faces. The fur-tip point (point 14) is always kept.
 */
function thinCollar(g: THREE.BufferGeometry, o: FurCollarOpts, si = 2, sj = 2): THREE.BufferGeometry {
  const span = (o.a1 ?? PI) - (o.a0 ?? -PI);
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * 12));
  const J = 29;
  const cols: number[] = [];
  for (let i = 0; i < nT; i += si) cols.push(i);
  if (!full && cols[cols.length - 1] !== nT) cols.push(nT);
  const js: number[] = [];
  for (let j = 0; j < J; j += sj) js.push(j);
  const old = g.index!.array;
  // The original winding: whether the first triangle is (a, b, d) or the flipped (a, d, b)
  const flipped = old[1] !== J;
  const idx: number[] = [];
  const nc = full ? cols.length : cols.length - 1;
  for (let ci = 0; ci < nc; ci++) {
    const i = cols[ci];
    const i2 = cols[(ci + 1) % cols.length];
    for (let k = 0; k < js.length; k++) {
      const j = js[k];
      const j2 = js[(k + 1) % js.length];
      const a = i * J + j;
      const b = i2 * J + j;
      const c = i2 * J + j2;
      const d = i * J + j2;
      if (flipped) idx.push(a, d, b, b, d, c);
      else idx.push(a, b, d, b, c, d);
    }
  }
  g.setIndex(idx);
  return g;
}

/** Grid surface: rows × cols points, with f(i, j) giving the position and color; not wrapping around */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  let hasCol = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      pos.push(p.x, p.y, p.z);
      if (c) hasCol = true;
      const cc = c ?? new THREE.Color(1, 1, 1);
      col.push(cc.r, cc.g, cc.b);
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      idx.push(a, a + cols, a + 1, a + cols, a + cols + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The cross-section coordinate frame and surface points of a loft: computed the same way as loft in shapes.ts (W = T × up, or fixed toward side; H = W × T) */
function loftSurface(pts: THREE.Vector3[], prof: (t: number) => number[], side?: THREE.Vector3) {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const frame = (t: number) => {
    const C = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const W = side ? side.clone().addScaledVector(T, -T.dot(side)) : new THREE.Vector3().crossVectors(T, UP);
    if (W.lengthSq() < 1e-8) W.set(1, 0, 0);
    W.normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [a, b, dy = 0] = prof(t);
    return { C, T, W, H, a, b, dy };
  };
  /** t is the position along the path and θ is the cross-section angle (0 toward W, PI/2 toward H); off pushes outward along the normal */
  const surf = (t: number, th: number, off = 0) => {
    const { C, T, W, H, a, b, dy } = frame(t);
    const n = W.clone().multiplyScalar(Math.cos(th) / Math.max(a, 1e-3)).addScaledVector(H, Math.sin(th) / Math.max(b, 1e-3)).normalize();
    const p = C.addScaledVector(W, a * Math.cos(th)).addScaledVector(H, b * Math.sin(th) + dy).addScaledVector(n, off);
    return { p, n, T };
  };
  /** The cross-section angle whose normal is closest to dir */
  const thToward = (t: number, dir: THREE.Vector3) => {
    const { W, H, a, b } = frame(t);
    return Math.atan2(dir.dot(H) * b, dir.dot(W) * a);
  };
  return { path, frame, surf, thToward };
}

/** A fur tuft with lightning bends: the leading edge rising steeply and the trailing edge falling gently, with one more bend in the middle of the trailing edge (like a Z-shaped bolt of lightning); returns 1 − notch to 1 */
function boltTooth(u: number, notch: number): number {
  const w = u - Math.floor(u);
  let k = w < 0.32 ? w / 0.32 : 1 - (w - 0.32) / 0.68;
  k -= 0.3 * Math.exp(-(((w - 0.6) / 0.05) ** 2));
  return 1 - notch + notch * Math.pow(Math.max(0, k), 0.85);
}

interface CrestOpts {
  /** The direction (in world coordinates) of the fur-tip side, projected perpendicular to the path */
  out: (s: number) => THREE.Vector3;
  /** The fur length and the depth buried in the body */
  len: (s: number) => number;
  root: (s: number) => number;
  thick: (s: number) => number;
  tufts: number;
  notch?: number;
  phase?: number;
  /** The amount the fur tips lean toward the path's direction of travel (a multiple of the fur length) */
  lean?: number;
  /** The two colors of fur root and fur tip and the position of the color change */
  tint: [THREE.ColorRepresentation, THREE.ColorRepresentation, number];
  segs?: number;
  radial?: number;
}

/**
 * A whole sheet of mane grown along a path: the cross-section a lens shape growing outward, the outer edge cut into tufts with lightning-bend tips, the tips leaning toward the path's direction of travel.
 * The whole sheet is one part, so the outline falls only on the sawtooth edge of the fur tips and does not look like armor plates. The seam of the cross-section is placed on the side buried in the body.
 */
function crestGeo(pts: THREE.Vector3[], o: CrestOpts): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const c0 = new THREE.Color(o.tint[0]);
  const c1 = new THREE.Color(o.tint[1]);
  const at = o.tint[2];
  // Face-count budget: the sample points are placed at the turning points of the tuft outline (originally 40 segments per tuft and 32 segments in the cross-section, evenly sampled).
  // Along the path: for each tuft take the start of boltTooth, the rising section, the tip, the falling section, and the notch and shoulder of the Z-shaped bend; 9 points per tuft make up the same sawtooth.
  const W_AT = [0, 0.16, 0.32, 0.46, 0.54, 0.6, 0.66, 0.72, 0.86];
  const ph = o.phase ?? 0;
  const sList: number[] = [0, 1];
  for (let k = -1; k <= o.tufts + 1; k++)
    for (const w of W_AT) {
      const s = (k + w - ph) / o.tufts;
      if (s > 1e-4 && s < 1 - 1e-4) sList.push(s);
    }
  sList.sort((a, b) => a - b);
  // Cross-section: a lens shape, the outer side (cos greater than 0) being the fur, with one point before and after the color-change boundary (cos = at); the inner side buried in the body takes only a few points
  const csList = [...new Set([1, 0.94, 0.85, at + 0.07, at, at - 0.07, 0.4, 0, -0.5, -1].map((x) => Math.round(THREE.MathUtils.clamp(x, -1, 1) * 1e4) / 1e4))].sort((a, b) => b - a);
  const thList: number[] = [];
  for (let k = csList.length - 1; k >= 0; k--) thList.push(2 * PI - Math.acos(csList[k]));
  for (let k = 1; k < csList.length; k++) thList.push(2 * PI + Math.acos(csList[k]));
  return gridGeo(sList.length, thList.length, (i, j) => {
    const s = sList[i];
    const C = path.getPointAt(s);
    const T = path.getTangentAt(s);
    const out = o.out(s);
    const W = out.clone().addScaledVector(T, -T.dot(out)).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const th = thList[j];
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const L = o.len(s) * boltTooth(s * o.tufts + (o.phase ?? 0), o.notch ?? 0.55);
    const k = Math.max(0, cs);
    const w = cs > 0 ? cs * L : cs * o.root(s);
    const tk = o.thick(s) * sn * (1 - 0.55 * k);
    const p = C.addScaledVector(W, w).addScaledVector(H, tk).addScaledVector(T, (o.lean ?? 0) * L * k * k);
    const c = c0.clone().lerp(c1, THREE.MathUtils.smoothstep(k, at - 0.07, at + 0.07));
    return { p, c };
  });
}

/**
 * Faceted lightning horn: a polygonal column swept along a polyline, each bend mitered (the cross-section on the bisector plane of the two segments), the end closing to a point;
 * split into triangles that share no vertices, each face with its own normal, which is the facets of a crystal.
 */
function boltHorn(pts: THREE.Vector3[], rad: number[], sides = 6): THREE.BufferGeometry {
  const rings: THREE.Vector3[][] = [];
  const ref = v(1, 0, 0.3).normalize();
  for (let i = 0; i < pts.length; i++) {
    const tin = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : null;
    const tout = i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]).normalize() : null;
    const T = tin && tout ? tin.clone().add(tout).normalize() : (tin ?? tout)!;
    const U = ref.clone().addScaledVector(T, -ref.dot(T)).normalize();
    const V = new THREE.Vector3().crossVectors(T, U);
    const ring: THREE.Vector3[] = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * PI * 2 + PI / sides;
      ring.push(pts[i].clone().addScaledVector(U, Math.cos(a) * rad[i]).addScaledVector(V, Math.sin(a) * rad[i]));
    }
    rings.push(ring);
  }
  const pos: number[] = [];
  const push = (...ps: THREE.Vector3[]) => {
    for (const p of ps) pos.push(p.x, p.y, p.z);
  };
  // Base face closed
  for (let k = 0; k < sides; k++) push(pts[0], rings[0][(k + 1) % sides], rings[0][k]);
  for (let i = 0; i < rings.length - 1; i++)
    for (let k = 0; k < sides; k++) {
      const a = rings[i][k];
      const b = rings[i][(k + 1) % sides];
      const c = rings[i + 1][(k + 1) % sides];
      const d = rings[i + 1][k];
      push(a, b, c, a, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Lightning outline (the footprint on the hoof sole, the pendant of the gold ornament on the chest): height h, width about half of h */
function boltShape(h: number): THREE.Shape {
  const k = h / 0.1;
  return outline(
    ([[-0.014, 0.05], [0.024, 0.05], [0.006, 0.012], [0.026, 0.012], [-0.018, -0.05], [-0.002, -0.004], [-0.022, -0.004]] as [number, number][]).map(
      ([x, y]) => [x * k, y * k] as [number, number],
    ),
  );
}


type Surface = ReturnType<typeof loftSurface>;

interface ScaleOpts {
  t0: number;
  t1: number;
  th0: number;
  th1: number;
  /** The spacing of a row of scales (in the body's t) and the width of one scale (the cross-section angle) */
  dt: number;
  dth: number;
  /** The height a scale rises from the leading edge to the trailing edge */
  h: number;
  base: THREE.ColorRepresentation;
  rim: THREE.ColorRepresentation;
  deep: THREE.ColorRepresentation;
  /** The width over which the boundary flattens out (in t and in angle) */
  fadeT: number;
  fadeTh: number;
  /** Set true when the path direction is opposite to the fur flow: the scales' trailing edge then faces the end with the smaller t */
  rev?: boolean;
}

/** Convert a linear color value to sRGB 0-255 (the texture is stored in sRGB, for better precision) */
function srgb8(x: number): number {
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(THREE.MathUtils.clamp(s, 0, 1) * 255);
}

/**
 * Fish scales on the body: a shell laid over the surface of the loft. Round scales in staggered rows, the rear edge of the front scale pressing on the one behind (what is seen is the circular arc of the rear edge);
 * each scale rises slowly from the leading edge to the trailing edge, the trailing edge a small step down, with a ring of brighter color along the trailing edge and the covered leading edge darker.
 * The whole sheet is one part, and the scales are read from the real height differences and shading; the boundary gradually flattens out and hides in the body, so no extra ring of line.
 * Face-count budget: the color and relief of the scale pattern are baked into two textures (color, and a tangent-space normal map), and the shell itself is a smooth thin shell lying against the body (at the average rising height).
 * Originally each scale used a grid of about 17×18 cells to make the circular arc and the step (two shells came to 100,000 faces); the step of a scale is only a little over a centimeter and cannot be seen in the silhouette,
 * and the scale shapes on the light/shadow boundary still appear through the normal map, with the bright arc of the trailing edge even crisper in the texture.
 */
function scaleShell(S: Surface, o: ScaleOpts, mat: THREE.MeshToonMaterial): THREE.BufferGeometry {
  const R = 0.53;
  /** Average rise: what is mostly seen is the back half of each scale (rise 0.6-1); the shell is placed at this height, so the thickness of the silhouette is the same as the original */
  const HM = 0.75;
  const fadeAt = (t: number, th: number) =>
    THREE.MathUtils.smoothstep(Math.min(t - o.t0, o.t1 - t), 0, o.fadeT) * THREE.MathUtils.smoothstep(Math.min(th - o.th0, o.th1 - th), 0, o.fadeTh);
  /** Scale pattern: returns the rise (0-1), the trailing edge bright and the leading edge dark */
  const pattern = (t: number, th: number) => {
    // The scale grid: the spacing of a row is half a scale width, odd rows offset by half a scale; the midline aligned to the spine
    const X = (o.rev ? o.t1 - t : t - o.t0) / o.dt;
    const Y = (th - PI / 2) / o.dth;
    let bestR = Infinity;
    let bq = 0;
    let bd = 1;
    const r0 = Math.floor(X);
    for (let r = r0 - 2; r <= r0 + 1; r++) {
      const sh = (((r % 2) + 2) % 2) * 0.5;
      const c0 = Math.round(Y - sh);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const dx = (X - r) * 0.5;
        const dy = Y - (c + sh);
        const d = Math.hypot(dx, dy);
        if (d < R && (r < bestR || (r === bestR && d < bd))) {
          bestR = r;
          bq = dx / R;
          bd = d / R;
        }
      }
    }
    let hh = 0.3 + 0.7 * THREE.MathUtils.smoothstep(bq, -0.7, 0.95);
    hh *= 1 - 0.4 * THREE.MathUtils.smoothstep(bd, 0.84, 1) * THREE.MathUtils.smoothstep(bq, 0, 0.5);
    const rimK = THREE.MathUtils.smoothstep(bd, 0.66, 0.86) * THREE.MathUtils.smoothstep(bq, -0.1, 0.45);
    const deepK = 1 - THREE.MathUtils.smoothstep(bq, -0.75, -0.3);
    return { hh, rimK, deepK };
  };

  // Texture: u along the body (t), v around the cross-section (θ); about 32 cells for a row of scales and about 48 cells for the width of one scale
  const TW = Math.ceil(((o.t1 - o.t0) / o.dt) * 8) * 4;
  const TH = Math.ceil(((o.th1 - o.th0) / o.dth) * 12) * 4;
  const cb = new THREE.Color(o.base);
  const cr = new THREE.Color(o.rim);
  const cd = new THREE.Color(o.deep);
  const col = new Uint8Array(TW * TH * 4);
  const det = new Float32Array(TW * TH);
  const c = new THREE.Color();
  for (let jv = 0; jv < TH; jv++) {
    const th = o.th0 + ((o.th1 - o.th0) * (jv + 0.5)) / TH;
    for (let iu = 0; iu < TW; iu++) {
      const t = o.t0 + ((o.t1 - o.t0) * (iu + 0.5)) / TW;
      const fade = fadeAt(t, th);
      const { hh, rimK, deepK } = pattern(t, th);
      c.copy(cb).lerp(cd, deepK * 0.7 * fade).lerp(cr, rimK * fade);
      const k = (jv * TW + iu) * 4;
      col[k] = srgb8(c.r);
      col[k + 1] = srgb8(c.g);
      col[k + 2] = srgb8(c.b);
      col[k + 3] = 255;
      det[jv * TW + iu] = o.h * (hh - HM) * fade;
    }
  }
  // Normal map: the slope of the relief against the length of the body surface (one unit of t along the body is the path length, and one radian around the cross-section is the arc length of the elliptical cross-section)
  const Lp = S.path.getLength();
  const dT = (o.t1 - o.t0) / TW;
  const dTh = (o.th1 - o.th0) / TH;
  const nrm = new Uint8Array(TW * TH * 4);
  for (let iu = 0; iu < TW; iu++) {
    const t = o.t0 + ((o.t1 - o.t0) * (iu + 0.5)) / TW;
    const { a, b } = S.frame(t);
    for (let jv = 0; jv < TH; jv++) {
      const th = o.th0 + dTh * (jv + 0.5);
      const at = (i: number, j: number) => det[THREE.MathUtils.clamp(j, 0, TH - 1) * TW + THREE.MathUtils.clamp(i, 0, TW - 1)];
      const gx = (at(iu + 1, jv) - at(iu - 1, jv)) / (2 * dT * Lp);
      const gy = (at(iu, jv + 1) - at(iu, jv - 1)) / (2 * dTh * Math.max(1e-3, Math.hypot(a * Math.sin(th), b * Math.cos(th))));
      const l = Math.hypot(gx, gy, 1);
      const k = (jv * TW + iu) * 4;
      nrm[k] = Math.round((-gx / l) * 127.5 + 127.5);
      nrm[k + 1] = Math.round((-gy / l) * 127.5 + 127.5);
      nrm[k + 2] = Math.round((1 / l) * 127.5 + 127.5);
      nrm[k + 3] = 255;
    }
  }
  const tex = (data: Uint8Array, color: boolean) => {
    const tx = new THREE.DataTexture(data, TW, TH);
    tx.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tx.magFilter = THREE.LinearFilter;
    tx.minFilter = THREE.LinearMipmapLinearFilter;
    tx.generateMipmaps = true;
    tx.anisotropy = 4;
    tx.needsUpdate = true;
    return tx;
  };
  mat.map = tex(col, true);
  mat.normalMap = tex(nrm, false);

  // Shell: a smooth thin shell, the rise taking the average height; the four edges closing down into the body in a ring
  // The mesh is about 2.8 cm per cell (taking the cross-section radius at the middle)
  const mid = S.frame((o.t0 + o.t1) / 2);
  const NR = Math.round((Lp * (o.t1 - o.t0)) / 0.028);
  const NC = Math.round(((o.th1 - o.th0) * (mid.a + mid.b)) / 2 / 0.025);
  const uv: number[] = [];
  const geo = gridGeo(NR + 3, NC + 3, (ii, jj) => {
    const wall = ii === 0 || ii === NR + 2 || jj === 0 || jj === NC + 2;
    const i = THREE.MathUtils.clamp(ii - 1, 0, NR);
    const j = THREE.MathUtils.clamp(jj - 1, 0, NC);
    const t = o.t0 + ((o.t1 - o.t0) * i) / NR;
    const th = o.th0 + ((o.th1 - o.th0) * j) / NC;
    const fade = fadeAt(t, th);
    const off = wall ? -0.008 : 0.0025 + o.h * HM * fade - 0.004 * (1 - fade);
    uv.push(i / NR, j / NC);
    return { p: S.surf(t, th, off).p };
  });
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeTangents();
  return geo;
}

export function buildVoltarionLab(): LabModel {
  const RIMC = 0xd8d0ff;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const BODY = 0x5242b8;
  const DARK = 0x33287e;
  const PALE = 0xb4a8ee;
  const VOLT = 0xffe066;
  const M = {
    body: labToon(BODY, { rim: 0.85, rimColor: RIMC }),
    scales: labToon(0xffffff, { rim: 0.85, rimColor: RIMC }),
    scalesNeck: labToon(0xffffff, { rim: 0.85, rimColor: RIMC }),
    belly: labToon(PALE, { rim: 0.5, rimColor: RIMC }),
    hair: vc(labToon(0xffffff, { rim: 0.6, rimColor: 0xfff2b0 })),
    cloud: vc(labToon(0xffffff, { rim: 0.35, rimColor: RIMC })),
    gold: labToon(0xecb948, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6, rimColor: 0xfff0c0 }),
    goldDk: labToon(0xa9782a, { ramp: 'metal', spec: 1.0, specTh: 0.93, rim: 0.3 }),
    horn: labToon(0xfff2a8, { ramp: 'gem', emissive: 0xffc42a, emissiveAmt: 0.42, spec: 1.4, specTh: 0.88, rim: 0.5, rimColor: 0xffffff }),
    crystal: labToon(0xffe45a, { ramp: 'gem', emissive: 0xffb418, emissiveAmt: 0.5, spec: 1.4, specTh: 0.88, rim: 0.6 }),
    volt: labToon(0xfff27a, { ramp: 'gem', emissive: 0xffc81e, emissiveAmt: 0.75, rim: 0 }),
    // Eyes: one whole sheet of golden-yellow iris (vertex colors only darken top and bottom), the emissive brightening on charge
    eye: vc(labToon(0xf6c040, { ramp: 'gem', emissive: 0xd89a10, emissiveAmt: 0.22, rim: 0 })),
    pupil: labToon(0x1a1238, { rim: 0 }),
    socket: labToon(0x221a58, { rim: 0.3, rimColor: RIMC }),
    nose: labToon(0x221a58, { rim: 0 }),
    earIn: labToon(0x9c8ee2, { rim: 0.2 }),
    storm: labToon(0x958cd2, { rim: 0.5, rimColor: 0xe8e4ff }),
    boltY: labToon(0xffe066, { ramp: 'gem', spec: 0.8, specTh: 0.95, rim: 0.4 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'voltarion-lab';
  const kit = partKit();
  const { add, group } = kit;
  const rivet = (parent: THREE.Object3D, pos: V3, n: V3, r = 0.009) => kit.rivet(parent, M.gold, pos, n, r);

  // Outline part indices: no lines between members of the same group, so the fur root and the body it grows from do not get an extra ring of line
  const HEAD = 9301;
  const TORSO = 9302;
  const TAIL = 9303;

  /** Place a ring of fur: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal */
  const collar = (parent: THREE.Object3D, mat: THREE.Material, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup?: number) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, thinCollar(furCollar(o), o), mat);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };

  // Body (rising and falling slightly with breathing); the four feet hang directly on root, so they stand firmly on the ground
  const body = group(root);

  // ── Torso: lofted from the chest back to the rump; a deep chest, a narrow waist, a round rump, the belly line rising toward the back (a deer's waist) ──
  const torsoPts = [v(0, 0.86, 0.44), v(0, 0.8, 0.32), v(0, 0.77, 0.12), v(0, 0.77, -0.12), v(0, 0.8, -0.36), v(0, 0.77, -0.56)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.025, 0.1, 0.12, 0],
    [0.08, 0.18, 0.2, -0.015],
    [0.2, 0.215, 0.245, -0.025],
    [0.34, 0.19, 0.23, -0.01],
    [0.5, 0.168, 0.19, 0.025],
    [0.64, 0.172, 0.2, 0.012],
    [0.8, 0.19, 0.22, -0.005],
    [0.91, 0.168, 0.19, 0],
    [0.97, 0.1, 0.11, 0],
    [1, 0, 0, 0],
  ]);
  const torso = add(body, loft(torsoPts, torsoProf, { segs: 40, radial: 24 }), M.body);
  torso.userData.inkGroup = TORSO;
  const TS = loftSurface(torsoPts, torsoProf);

  // ── Neck: standing up long from above the chest, going up and forward, the top tucked into the skull ──
  const neckPts = [v(0, 0.84, 0.3), v(0, 1.0, 0.36), v(0, 1.18, 0.44), v(0, 1.34, 0.52)];
  const neckProf = curveTable([[0, 0.14, 0.17], [0.35, 0.12, 0.145], [0.7, 0.1, 0.12], [0.9, 0.095, 0.11], [1, 0, 0]]);
  add(body, loft(neckPts, neckProf, { segs: 20, radial: 20 }), M.body).userData.inkGroup = TORSO;
  const NS = loftSurface(neckPts, neckProf);
  /** The directions of the nape (back and up) and the throat (forward and down) */
  const neckBack = (t: number) => {
    const T = NS.path.getTangentAt(t);
    return v(0, T.z, -T.y);
  };

  // ── Fish scales: a sheet of round scales in staggered rows on the shoulders, back and rump, gradually flattening toward the belly side and the limbs; the sides of the neck also grow a sheet, the trailing edge facing down (toward the body) ──
  const scaleMesh = add(
    torso,
    scaleShell(TS, { t0: 0.1, t1: 0.975, th0: -0.3, th1: PI + 0.3, dt: 0.036, dth: 0.36, h: 0.014, base: BODY, rim: 0x7f70e2, deep: 0x3a2e90, fadeT: 0.06, fadeTh: 0.45 }, M.scales),
    M.scales,
  );
  scaleMesh.userData.inkGroup = TORSO;
  add(body, scaleShell(NS, { t0: 0.1, t1: 0.92, th0: PI / 2 - 1.95, th1: PI / 2 + 1.95, dt: 0.058, dth: 0.5, h: 0.012, base: BODY, rim: 0x7f70e2, deep: 0x3a2e90, fadeT: 0.08, fadeTh: 0.45, rev: true }, M.scalesNeck), M.scalesNeck).userData.inkGroup = TORSO;

  // ── Belly plate: a pale purple thick shell from the throat to under the belly, section after section of transverse grooves (a dragon's belly scutes), the rear edge of each section turned up slightly and pressing on the next ──
  const scutes = (parent: THREE.Object3D, S: Surface, t0: number, t1: number, n: number, half: (t: number) => number, down: (t: number) => THREE.Vector3) => {
    // Face-count budget: each section takes only the groove bottom, two points of the groove, the middle of the section and the point before the next groove (originally 14 rows evenly sampled per section); the step still spans just one row
    const W_AT = [0, 0.06, 0.12, 0.5, 13 / 14];
    const us: number[] = [];
    for (let k = 0; k < n; k++) for (const w of W_AT) us.push(k + w);
    us.push(n);
    const NR = us.length - 1;
    const NC = 16;
    const geo = gridGeo(NR + 3, NC + 3, (ii, jj) => {
      const wall = ii === 0 || ii === NR + 2 || jj === 0 || jj === NC + 2;
      const i = THREE.MathUtils.clamp(ii - 1, 0, NR);
      const j = THREE.MathUtils.clamp(jj - 1, 0, NC);
      const u = us[i];
      const t = t0 + ((t1 - t0) * u) / n;
      const th0 = S.thToward(t, down(t));
      const th = th0 + half(t) * ((2 * j) / NC - 1);
      // Each section: the leading edge low, rising gently going back, with a narrow groove between sections
      const w = i === NR ? 0 : u - Math.floor(u);
      const groove = w < 0.12 ? Math.sin((w / 0.12) * PI * 0.5) : 1;
      const edgeFade = Math.min(1, Math.min(j, NC - j) / 2);
      const off = wall ? -0.01 : 0.004 + 0.009 * groove * (0.55 + 0.45 * w) * edgeFade;
      return { p: S.surf(t, th, off).p };
    });
    return add(parent, geo, M.belly);
  };
  scutes(torso, TS, 0.03, 0.62, 8, (t) => 0.95 - 0.33 * THREE.MathUtils.smoothstep(t, 0.06, 0.16), () => v(0, -1, 0));
  scutes(body, NS, 0.08, 0.86, 6, () => 0.95, (t) => neckBack(t).negate());

  // ── Limbs: thin but strong legs like a deer's, with the knee and hock distinct; gold horse hooves. The right forefoot lifted and the left hind foot with its heel off the ground (a step in the middle of a patrol) ──
  const hoofGeo = (() => {
    const g = lathe([[0.001, 0], [0.058, 0], [0.061, 0.006], [0.057, 0.022], [0.048, 0.05], [0.043, 0.06], [0.001, 0.06]], 20);
    // The front wall slanted and the heel low: the front half is pushed back the higher it goes, and the top of the back half is pressed down
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const z = p.getZ(i);
      p.setZ(i, z - y * (z > 0 ? 0.62 : 0.2));
      p.setY(i, y * (1 - 0.3 * Math.max(0, -z / 0.06)));
    }
    g.computeVertexNormals();
    return g;
  })();
  const soleGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.006, 16);
  const boltGeo = slab(boltShape(0.088), 0.006, 0.002, 2);
  let soleN = 0;
  /** Hoof: y is the direction from the hoof to the leg and z is the hoof tip; the sole a piece of dark gold, with a bolt of lightning inlaid */
  const hoof = (at: THREE.Vector3, yAxis: THREE.Vector3, toe: THREE.Vector3) => {
    const y = yAxis.clone().normalize();
    const z = toe.clone().addScaledVector(y, -toe.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const g = group(root);
    g.position.copy(at);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    add(g, hoofGeo, M.gold);
    add(g, lathe([[0.04, -0.006], [0.046, -0.002], [0.047, 0.008], [0.041, 0.012], [0.036, 0.008]], 18), M.goldDk, [0, 0.05, -0.022], [-0.18, 0, 0]);
    add(g, soleGeo, M.goldDk, [0, 0.001, 0.004]);
    add(g, boltGeo, M.volt, [0, -0.002, 0.004], [PI / 2, 0, 0]);
    // A ring of white cloud fur on the hoof (treading on clouds): several rounded tufts draping down and back, longest at the back, the fur tips turned outward
    collar(g, M.cloud, { r0: 0.04, len: 0.07, thick: 0.075, flare: 0.75, curl: -0.25, tufts: 4, notch: 0.3, groove: 0.5, bias: 0.45, jitter: 0.15, phase: 0.5, tint: [0xcfc6fb, 0xffffff, 0.45], seed: 80 + soleN++ }, v(0, 0.098, -0.02), UP, v(0, 0, -1));
    return g;
  };

  interface Leg {
    pts: THREE.Vector3[];
    prof: (t: number) => number[];
    /** The origin of the hoof sole, the direction from the hoof to the leg, and the hoof-tip direction */
    hoof: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  }
  const foreProf = curveTable([[0, 0, 0], [0.03, 0.065, 0.085], [0.1, 0.095, 0.12], [0.24, 0.086, 0.105], [0.44, 0.056, 0.066], [0.52, 0.058, 0.068], [0.6, 0.047, 0.056], [0.76, 0.04, 0.047], [0.87, 0.046, 0.052], [0.95, 0.042, 0.046], [1, 0, 0]]);
  const hindProf = curveTable([[0, 0, 0], [0.03, 0.08, 0.11], [0.1, 0.11, 0.16], [0.22, 0.1, 0.14], [0.38, 0.066, 0.082], [0.5, 0.054, 0.072], [0.56, 0.05, 0.062], [0.74, 0.04, 0.047], [0.86, 0.046, 0.052], [0.95, 0.042, 0.046], [1, 0, 0]]);
  const tip = (a: number) => v(0, Math.cos(a), Math.sin(a));
  const legs: Leg[] = [
    // Left fore (standing)
    { pts: [v(-0.09, 0.82, 0.3), v(-0.155, 0.56, 0.25), v(-0.165, 0.32, 0.27), v(-0.165, 0.14, 0.28), v(-0.165, 0.08, 0.3)], prof: foreProf, hoof: [v(-0.165, 0, 0.31), UP, v(0, 0, 1)] },
    // Right fore (lifted: the forearm held out level forward, the shin hanging, the hoof folded back, the sole facing back)
    { pts: [v(0.09, 0.82, 0.3), v(0.155, 0.6, 0.29), v(0.165, 0.5, 0.45), v(0.165, 0.34, 0.45), v(0.165, 0.27, 0.4)], prof: foreProf, hoof: [v(0.165, 0.23, 0.36), tip(1.25), v(0, -1, 0)] },
    // Right hind (standing)
    { pts: [v(0.08, 0.84, -0.4), v(0.15, 0.56, -0.28), v(0.15, 0.32, -0.46), v(0.15, 0.14, -0.43), v(0.15, 0.08, -0.41)], prof: hindProf, hoof: [v(0.15, 0, -0.4), UP, v(0, 0, 1)] },
    // Left hind (the heel off the ground, the hoof tip touching down, the sole facing back)
    { pts: [v(-0.08, 0.84, -0.4), v(-0.15, 0.56, -0.3), v(-0.15, 0.36, -0.53), v(-0.15, 0.19, -0.5), v(-0.15, 0.11, -0.42)], prof: hindProf, hoof: [v(-0.15, 0.048, -0.44), tip(1.05), v(0, 0, 1)] },
  ];
  for (let li = 0; li < legs.length; li++) {
    const L = legs[li];
    const leg = add(root, loft(L.pts, L.prof, { segs: 34, radial: 18, side: X }), M.body);
    leg.userData.inkGroup = TORSO;
    hoof(...L.hoof);
  }

  // ── Mane: a whole sheet of fur from behind the head along the nape all the way to the tail root, the trailing edge cut into lightning bends, the roots indigo-purple and the tips golden yellow; on the neck one more sheet each to the left and right draping to the sides ──
  const crestLine: THREE.Vector3[] = [];
  for (let i = 0; i <= 7; i++) {
    const t = 0.92 - i * 0.1;
    crestLine.push(NS.surf(t, NS.thToward(t, neckBack(t)), -0.012).p);
  }
  for (let i = 0; i <= 6; i++) {
    const t = 0.24 + i * 0.1;
    crestLine.push(TS.surf(t, TS.thToward(t, UP), -0.012).p);
  }
  /** The direction the mane grows outward: the path goes from the head to the tail, and X × tangent is the back side */
  const crestOut = (path: THREE.CatmullRomCurve3) => (s: number) => new THREE.Vector3().crossVectors(X, path.getTangentAt(s));
  {
    const path = new THREE.CatmullRomCurve3(crestLine, false, 'centripetal');
    const env = (s: number) => Math.min(1, s * 10) * Math.min(1, (1 - s) * 6);
    add(
      body,
      crestGeo(crestLine, {
        out: crestOut(path),
        len: (s) => (0.3 - 0.2 * THREE.MathUtils.smoothstep(s, 0.3, 0.75)) * env(s),
        root: (s) => 0.03 * env(s),
        thick: (s) => (0.042 - 0.022 * s) * env(s),
        tufts: 12,
        notch: 0.62,
        lean: 0.78,
        tint: [DARK, VOLT, 0.7],
      }),
      M.hair,
    ).userData.inkGroup = TORSO;
    // Two sheets on the neck, left and right, draping to the sides, so the mane has volume from the front
    const neckLine = crestLine.slice(0, 9);
    const npath = new THREE.CatmullRomCurve3(neckLine, false, 'centripetal');
    for (const sx of [-1, 1]) {
      const e2 = (s: number) => Math.min(1, s * 8) * Math.min(1, (1 - s) * 3);
      add(
        body,
        crestGeo(neckLine, {
          out: (s) => crestOut(npath)(s).addScaledVector(X, sx * 2.4).add(v(0, -0.5, 0)),
          len: (s) => 0.21 * e2(s),
          root: (s) => 0.035 * e2(s),
          thick: (s) => 0.034 * e2(s),
          tufts: 6,
          notch: 0.55,
          phase: 0.5,
          lean: 0.85,
          tint: [DARK, VOLT, 0.72],
        }),
        M.hair,
      ).userData.inkGroup = TORSO;
    }
  }

  // ── The gold ornament on the chest: a gold collar around the base of the neck, a gold plate directly in front set with a thunder crystal, and a gold bolt of lightning hanging below ──
  let chest!: THREE.Group;
  {
    const t = 0.16;
    const { C, T, W, H, a, b, dy } = NS.frame(t);
    const g = group(body);
    g.position.copy(C).addScaledVector(H, dy);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(W, T, H));
    const k = 1.06;
    add(g, lathe([[1.0, -0.022], [1.05, -0.018], [1.07, -0.008], [1.07, 0.008], [1.05, 0.018], [1.0, 0.022]], 32), M.gold, [0, 0, 0], [0, 0, 0], [a * k, 1, b * k]);
    const s = NS.surf(t, NS.thToward(t, neckBack(t).negate()), 0.02);
    const pg = group(body, s.p.toArray() as V3);
    pg.quaternion.setFromUnitVectors(v(0, 0, 1), s.n);
    add(pg, slab(outline([[-0.064, 0.028], [-0.036, 0.056], [0.036, 0.056], [0.064, 0.028], [0.046, -0.036], [0, -0.064], [-0.046, -0.036]]), 0.016, 0.006, 3), M.gold);
    add(pg, new THREE.CylinderGeometry(0.033, 0.033, 0.014, 16), M.goldDk, [0, 0, 0.008], [PI / 2, 0, 0]);
    add(pg, brilliant(0.031, 0.02, 0.024, 10), M.crystal, [0, 0, 0.016], [PI / 2, 0, 0]);
    chest = group(pg, [0, 0, 0.03]);
    for (const [x, y] of [[-0.046, 0.032], [0.046, 0.032]] as [number, number][]) rivet(pg, [x, y, 0.012], [0, 0, 1], 0.007);
    add(pg, slab(boltShape(0.08), 0.012, 0.004, 2), M.gold, [0, -0.1, -0.004]);
  }

  // ── Tail: an ox tail flicking up and back to the side from the rump, a gold ring before the end, and a mass of thundercloud at the end ──
  const tail = group(body, [0, 0.93, -0.5]);
  const tailPts = [v(0, 0, 0.02), v(0.02, -0.01, -0.12), v(0.07, 0.03, -0.22), v(0.13, 0.11, -0.27), v(0.18, 0.2, -0.26), v(0.2, 0.27, -0.21)];
  add(tail, loft(tailPts, curveTable([[0, 0.05, 0.05], [0.25, 0.034, 0.034], [0.8, 0.024, 0.024], [0.97, 0.022, 0.022], [1, 0, 0]]), { segs: 28, radial: 10, side: X }), M.body).userData.inkGroup = TAIL;
  const tailPath = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  {
    const rt = 0.84;
    const ring = group(tail, tailPath.getPointAt(rt).toArray() as V3);
    ring.quaternion.setFromUnitVectors(UP, tailPath.getTangentAt(rt));
    add(ring, lathe([[0.02, -0.014], [0.028, -0.01], [0.03, 0.01], [0.024, 0.015], [0.019, 0.011]], 16), M.gold);
  }
  const tailTuft = group(tail);
  {
    const end = tailPath.getPointAt(1);
    tailTuft.position.copy(end).add(v(0.02, 0.04, 0.0));
    // Cloud mass: several round masses of different sizes pressed together, with the same part index, the lines falling only on the outer edge and the concave creases between masses
    const puffs: [number, number, number, number][] = [
      [0, 0, 0, 0.075], [0.06, 0.02, -0.03, 0.058], [-0.058, 0.012, 0.012, 0.055], [0.018, 0.058, 0.012, 0.052],
      [-0.02, 0.045, -0.045, 0.05], [0.05, -0.028, 0.04, 0.048], [-0.04, -0.03, -0.035, 0.046],
    ];
    for (const [x, y, z, r] of puffs) add(tailTuft, new THREE.SphereGeometry(r, 16, 11), M.storm, [x, y, z], [0, 0, 0], [1, 0.84, 1]).userData.inkGroup = TAIL + 1;
    // Two small bolts of lightning hanging from the cloud base
    for (const [x, z, h, ry] of [[-0.03, 0.02, 0.1, 0.5], [0.045, -0.01, 0.075, -0.6]] as [number, number, number, number][]) {
      const bg = group(tailTuft, [x, -0.06 - h * 0.45, z], [0, ry, 0.1]);
      add(bg, slab(boltShape(h), 0.012, 0.004, 2), M.boltY);
    }
  }
  // ── Head: the neck pivot handles looking around, the head's origin is at the center of the skull; the head held high and the chin slightly tucked ──
  const neck = group(body, [0, 1.3, 0.5]);
  const head = group(neck, [0, 0.1, 0.06], [0.04, 0, 0]);
  head.scale.setScalar(1.4);

  // Skull (a wolf's forehead): a wide forehead, joined forward to a long, narrowing dragon muzzle
  add(head, new THREE.SphereGeometry(0.13, 32, 20), M.body, [0, 0, 0], [0, 0, 0], [1.0, 0.92, 1.05]).userData.inkGroup = HEAD;
  // Cheekbones: two narrowing ridges of flesh under the eyes, so the face is angular and not two puffy cheeks
  for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(1, 18, 12), M.body, [sx * 0.078, -0.05, 0.06], [0, sx * 0.35, 0], [0.05, 0.048, 0.078]).userData.inkGroup = HEAD;
  // Bridge of the nose: from between the brows all the way to the nose tip
  add(head, loft([v(0, 0.07, 0.1), v(0, 0.025, 0.2), v(0, -0.012, 0.29)], curveTable([[0, 0.034, 0.028], [0.5, 0.031, 0.025], [0.9, 0.027, 0.022], [1, 0, 0]]), { segs: 14, radial: 12 }), M.body).userData.inkGroup = HEAD;
  // Upper muzzle: long, narrowing forward, the muzzle tip slightly square
  const muzPts = [v(0, -0.02, 0.04), v(0, -0.043, 0.18), v(0, -0.056, 0.3)];
  const muzProf = curveTable([[0, 0.092, 0.084], [0.45, 0.076, 0.064], [0.8, 0.067, 0.054], [0.93, 0.06, 0.046], [1, 0, 0]]);
  add(head, loft(muzPts, muzProf, { segs: 22, radial: 20 }), M.body).userData.inkGroup = HEAD;
  // Mouth line: pulled along the lower edge of the upper muzzle from the muzzle tip all the way under the cheekbones, the corners of the mouth tucked up into a faint smile (the steadiness of a benevolent beast), not a pout
  {
    const MS = loftSurface(muzPts, muzProf);
    const side = (sx: number) => {
      const row: THREE.Vector3[] = [];
      for (let t = 0.05; t <= 0.93; t += 0.04) {
        // The end at the corner of the mouth tucked up; the two sides of the muzzle tip also slightly higher than the exact middle, so from the front it is a shallow U and not a pout or a downturn
        const lift = 0.75 * (1 - THREE.MathUtils.smoothstep(t, 0.05, 0.32)) + 0.22 * THREE.MathUtils.smoothstep(t, 0.72, 0.9);
        row.push(MS.surf(t, MS.thToward(t, v(sx * 0.62, -0.78 + lift, 0)), 0.0025).p);
      }
      return row;
    };
    const f = MS.surf(0.955, MS.thToward(0.955, v(0, -1, 0)), 0.0025).p;
    const pts = [...side(-1), f, ...side(1).reverse()];
    add(head, loft(pts, (u) => { const k = Math.pow(Math.sin(PI * u), 0.3); return [0.0048 * k, 0.0048 * k]; }, { segs: 64, radial: 6 }), M.socket);
  }
  // Dragon nose: nostril wings swelling on both sides of the muzzle tip, the nostrils opening outward and up, so from the front it is not a pig's nose
  for (const sx of [-1, 1]) {
    const ng = group(head, [sx * 0.034, -0.022, 0.272]);
    ng.quaternion.setFromUnitVectors(v(0, 0, 1), v(sx * 0.7, 0.5, 0.5).normalize());
    add(ng, new THREE.SphereGeometry(1, 14, 10), M.body, [0, 0, -0.004], [0, 0, 0], [0.028, 0.021, 0.025]).userData.inkGroup = HEAD;
    add(ng, new THREE.SphereGeometry(1, 10, 7), M.nose, [0, 0, 0.013], [0, 0, sx * 0.5], [0.011, 0.006, 0.008]);
  }
  // Lower jaw: pale purple, and the closed mouth is the boundary between the upper muzzle and the lower jaw
  add(head, loft([v(0, -0.088, 0.02), v(0, -0.098, 0.16), v(0, -0.095, 0.275)], curveTable([[0, 0.076, 0.05], [0.5, 0.058, 0.036], [0.9, 0.042, 0.027], [1, 0, 0]]), { segs: 18, radial: 14 }), M.belly);
  // Cheek fins: a row of lightning fur sweeping back along the jaw line (the same set as the mane), a dragon's cheek fin from the side, and framing the chin from the front
  for (const sx of [-1, 1]) {
    const pts = [v(sx * 0.07, -0.088, 0.1), v(sx * 0.095, -0.078, 0.02), v(sx * 0.11, -0.056, -0.05), v(sx * 0.104, -0.02, -0.11)];
    add(
      head,
      crestGeo(pts, {
        out: () => v(sx, -0.55, -0.2),
        len: (s) => 0.085 * Math.min(1, s * 4) * Math.min(1, (1 - s) * 3 + 0.25),
        root: () => 0.015,
        thick: (s) => 0.022 * Math.min(1, s * 4),
        tufts: 3,
        notch: 0.55,
        phase: 0.2,
        lean: 0.9,
        tint: [BODY, VOLT, 0.66],
      }),
      M.hair,
    ).userData.inkGroup = HEAD;
  }

  // Eyes: a dragonkind's small eyes, the golden-yellow iris filling the whole exposed spherical cap (no sclera, no pale outer ring, no concentric circles), a thin vertical pupil, one small point of highlight;
  // about seventeen percent of the head's width in diameter, buried in the socket, the upper edge tucked under a thick brow ridge. The eyelids appear only when blinking, and the whole set is hidden when the eyes are open (reference.md pitfall 105).
  const ER = 0.022;
  const EMBED = 0.45;
  // The open-eye angle: the eyelid lips stop outside the range where the eyeball shows (the half angle of the exposed spherical cap is about 1.1); when blinking they meet slightly below the midline
  const UP_OPEN = 1.2;
  const LO_OPEN = 1.15;
  const LID_MEET = 0.14;
  const lids: THREE.Group[] = [];
  const lowers: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  /** Anchor for the eye-light: the center of the eyeball surface */
  const eyes: THREE.Group[] = [];
  const eyeBall = new THREE.SphereGeometry(ER, 16, 12);
  {
    // The iris shading only runs top to bottom: the upper edge darkened by the brow ridge and the lower half translucent and bright (vertex colors only darken, no rings drawn)
    const pa = eyeBall.attributes.position as THREE.BufferAttribute;
    const c: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      const k = 0.5 + 0.5 * THREE.MathUtils.smoothstep(-pa.getY(i) / ER, -0.75, 0.45);
      c.push(k, k * 0.94, k * 0.86);
    }
    eyeBall.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  }
  const lidTop = lidGeo(ER + 0.0025, ER + 0.0065, PI / 2, 16);
  const lidLow = lidGeo(ER + 0.002, ER + 0.005, PI / 2, 16);
  const lidLine = lidGeo(ER + 0.001, ER + 0.003, PI / 2, 16, 5, 3);
  // The half axes of the skull ellipsoid (a sphere of 0.13, scaled 1.0, 0.92, 1.05)
  const HA = v(0.13, 0.13 * 0.92, 0.13 * 1.05);
  for (const sx of [-1, 1]) {
    // The point on the ellipsoid whose normal is f: p = (a²fx, b²fy, c²fz) / √(a²fx² + b²fy² + c²fz²), then buried along the normal
    const f = v(sx * 0.6, 0.3, 0.74).normalize();
    const k = Math.hypot(HA.x * f.x, HA.y * f.y, HA.z * f.z);
    const at = v((HA.x * HA.x * f.x) / k, (HA.y * HA.y * f.y) / k, (HA.z * HA.z * f.z) / k).addScaledVector(f, -ER * EMBED);
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    const eg = group(head, [at.x, at.y, at.z]);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    // The eye socket faces forward, outward and up, and the gaze draws back down and forward to horizontal (both eyes looking in the same direction)
    const gaze = group(eg, [0, 0, 0], [0.26, -sx * 0.16, 0]);
    add(gaze, eyeBall, M.eye);
    add(gaze, diskDecal(0.1, 0.62, ER + 0.0006, 2, 16), M.pupil);
    eyes.push(group(gaze, [0, 0, ER]));
    const hl = add(gaze, new THREE.SphereGeometry(ER * 0.16, 8, 6), M.hi, [ER * 0.36, ER * 0.3, ER * 0.88], [0, 0, 0], [1, 1, 0.5]);
    hl.layers.disable(INK_LAYER);
    glints.push(hl);
    const upper = group(eg, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidTop, M.body).userData.inkGroup = HEAD;
    const upLine = group(eg, [0, 0, 0], [-UP_OPEN + 0.08, 0, 0]);
    add(upLine, lidLine, M.socket);
    const lower = group(eg, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lower, lidLow, M.body).userData.inkGroup = HEAD;
    const loLine = group(eg, [0, 0, 0], [PI + LO_OPEN - 0.06, 0, 0]);
    add(loLine, lidLine, M.socket);
    lids.push(upper, upLine);
    lowers.push(lower, loLine);
    // Brow ridge: a thick ridge of flesh growing on the skull, its front edge reaching out to press on the upper edge of the eye (the eye buried beneath), the inner end low and the outer end high,
    // behind the outer corner of the eye sweeping back and up into a small pointed horn (a dragon's brow); the same color and outline group as the head
    const B = 0.036;
    const bpts: THREE.Vector3[] = [];
    for (let q = 0; q <= 10; q++) {
      const s2 = q / 10;
      const x = sx * B * (-1.0 + 2.4 * s2);
      const y = ER * 0.9 + B * (0.1 + 0.3 * s2 + 1.2 * Math.max(0, s2 - 0.72) ** 1.5);
      const z = ER * 0.62 + B * (0.2 - 1.6 * s2 * s2);
      bpts.push(v(x, y, z));
    }
    add(eg, loft(bpts, (tt) => { const kk = Math.pow(Math.sin(PI * Math.min(1, tt * 1.6)), 0.5) * (1 - 0.85 * tt); return [0.02 * kk + 0.001, 0.014 * kk + 0.001]; }, { segs: 18, radial: 10 }), M.body).userData.inkGroup = HEAD;
  }

  // Ears: pointed leaf ears like a deer's, standing up from the sides of the head and slanting back, the inside a pale purple
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.098, 0.085, -0.07], [-0.9, sx * 0.55, -sx * 0.8]);
    const leaf = outline([[-0.022, 0], [0.022, 0], [0.031, 0.04], [0.022, 0.09], [0.004, 0.135], [-0.018, 0.09], [-0.03, 0.04]]);
    add(eg, slab(leaf, 0.02, 0.008, 6), M.body);
    add(eg, slab(outline([[-0.012, 0.018], [0.012, 0.018], [0.018, 0.045], [0.012, 0.08], [0.002, 0.105], [-0.01, 0.08], [-0.017, 0.045]]), 0.01, 0.003, 4), M.earIn, [0, 0, 0.011]);
    ears.push(eg);
  }

  // Mane on the top of the head: draping back along the top of the head from behind the horn, joining the mane on the nape
  {
    const pts = [v(0, 0.118, 0.01), v(0, 0.12, -0.05), v(0, 0.09, -0.11), v(0, 0.03, -0.15)];
    const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    add(
      head,
      crestGeo(pts, {
        out: crestOut(path),
        len: (s) => 0.1 * Math.min(1, s * 5) * Math.min(1, (1 - s) * 3 + 0.3),
        root: () => 0.02,
        thick: (s) => 0.03 * Math.min(1, s * 5),
        tufts: 3,
        notch: 0.55,
        lean: 0.6,
        tint: [DARK, VOLT, 0.6],
      }),
      M.hair,
    ).userData.inkGroup = HEAD;
  }

  // Thunder horn: a faceted crystal horn on the forehead, bending once in the middle like a bolt of lightning that has struck down; a gold band around the horn root
  let hornTip!: THREE.Group;
  let hornBase!: THREE.Group;
  {
    const hg = group(head, [0, 0.105, 0.06], [-0.2, 0, 0]);
    const d = v(0.8, 0, 0.6).normalize();
    const p0 = v(0, -0.03, 0);
    const p1 = v(0, 0.08, 0);
    const p2 = v(0, 0.125, 0).addScaledVector(d, 0.04);
    const p3 = v(0, 0.2, 0).addScaledVector(d, -0.012);
    const p4 = v(0, 0.31, -0.02).addScaledVector(d, 0.01);
    add(hg, boltHorn([p0, p1, p2, p3, p4], [0.03, 0.026, 0.021, 0.015, 0], 6), M.horn);
    add(hg, lathe([[0.033, -0.012], [0.039, -0.006], [0.04, 0.02], [0.034, 0.028], [0.029, 0.024]], 20), M.gold);
    for (const a of [-1, 1]) rivet(hg, [Math.sin(a) * 0.04, 0.008, Math.cos(a) * 0.04], [Math.sin(a), 0, Math.cos(a)], 0.006);
    hornTip = group(hg, p4.toArray() as V3);
    hornBase = group(hg, [0, 0.008, 0]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: breathing, slow looking around, blinking, the ears twitching now and then, the tail and the thundercloud at its end swaying lightly, the thunder horn and thunder crystal glimmering faintly ──
  // Action weights for performances: charge stores thunder (the glowing parts brighten to platinum, looking straight ahead), rear throws the head back with the single horn held high and both ears laid back
  const act = { charge: 0, rear: 0 };
  const hornEm = M.horn.emissive.clone();
  const crystalEm = M.crystal.emissive.clone();
  const WHITE_GOLD = new THREE.Color(0xfff4c8);
  let lastCharge = 0;
  let blinkIn = 2.3;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    const { charge, rear } = act;
    // When storing thunder or throwing the head back it no longer looks around and looks straight ahead
    const still = 1 - Math.max(charge, rear);
    const br = Math.sin(t * 1.3);
    torso.scale.set(1 + br * 0.008, 1 + br * 0.006, 1);
    body.position.y = br * 0.003;
    neck.rotation.y = (Math.sin(t * 0.3) * 0.16 + Math.sin(t * 0.87) * 0.025) * still;
    neck.rotation.x = Math.sin(t * 0.5) * 0.025 * still - rear * 0.32;
    head.rotation.z = Math.sin(t * 0.3 + 0.7) * 0.025 * still;

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.8 + ((t * 7.3) % 3);
    }
    let close = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.2;
      close = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.3) : 0;
      if (k >= 1) blinkT = -1;
    }
    // Blink: the upper and lower eyelids slide out of the socket and meet slightly below the midline; when the eyes are open the whole set is hidden, leaving no ring of eyelid around the eye
    const lidOn = close > 0.01;
    for (let i = 0; i < lids.length; i++) {
      lids[i].rotation.x = -UP_OPEN + (i % 2 ? 0.08 : 0) + (UP_OPEN + LID_MEET) * close;
      lids[i].visible = lidOn;
    }
    for (let i = 0; i < lowers.length; i++) {
      lowers[i].rotation.x = PI + LO_OPEN - (i % 2 ? 0.06 : 0) - (LO_OPEN - LID_MEET + 0.03) * close;
      lowers[i].visible = lidOn;
    }
    for (const g of glints) g.visible = close < 0.6;

    for (let i = 0; i < ears.length; i++) {
      const sx = i === 0 ? -1 : 1;
      const ph = (t + i * 2.6) % 6.1;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.2 : 0;
      ears[i].rotation.z = -sx * 0.8 + sx * tw * still;
      ears[i].rotation.x = -0.9 - rear * 0.4;
    }
    tail.rotation.y = Math.sin(t * 0.8) * 0.12;
    tail.rotation.x = Math.sin(t * 1.1) * 0.04;
    tailTuft.rotation.set(Math.sin(t * 1.1) * 0.04, Math.sin(t * 0.7) * 0.1, Math.sin(t * 1.7) * 0.03);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
    M.horn.emissiveIntensity = 0.38 + pulse * 0.08 + charge * 0.45;
    M.crystal.emissiveIntensity = 0.45 + pulse * 0.1 + charge * 0.4;
    // The other materials are changed only when charge changes, so when another spirit's ultimate changes these materials they are not overwritten back every frame
    if (charge !== lastCharge) {
      lastCharge = charge;
      M.horn.emissive.copy(hornEm).lerp(WHITE_GOLD, charge * 0.6);
      M.crystal.emissive.copy(crystalEm).lerp(WHITE_GOLD, charge * 0.4);
      M.volt.emissiveIntensity = 0.75 + charge * 0.3;
      M.eye.emissiveIntensity = 0.22 + charge * 0.4;
    }
  };
  update(0, 0);

  const anchors = {
    mouth: group(head, [0, -0.1, 0.29]),
    hornTip,
    horn: hornBase,
    chest,
    tailCloud: group(tailTuft),
  };
  return { root, update, act, rig: { head: group(head, [0, 0.005, 0.1]), eyes, anchors }, center: new THREE.Vector3(0, 0.88, -0.1), radius: 1.05 };
}
