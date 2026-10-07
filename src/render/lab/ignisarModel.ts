// Ignisar, the Blazing Lion King (model lab version): the sacred spirit that guards the Fire Source Crystal. Its mane is a flame that has not gone out for a thousand years, and every roar makes the ley lines of the Emberspine Volcanic Belt pulse along with it.
// It keeps the five things that made the old model easiest to recognize: golden fur, a big ring of flame mane, a gold crown with a ruby, the Fire Source Crystal on the chest, and a tuft of fire at the end of the tail.
// Body shape follows the lore: a four-legged lion king with all the weight on the front half: a broad, thick chest, forelegs as thick as pillars, wide paws, and the head and mane taking up a third of the whole animal.
// Mane: a few big tongues of flame leaping back and up (furCollar, the roots dark red and the tips orange-yellow), with a innermost ring of dark red short fur framing the face;
// not made into a ring of petals all the same size. The spine is a row of basalt plates with lava showing through the gaps between plates (the flame ridge), visible from the side and the back.
// Personality: a bold and majestic king. The chin slightly lifted, eyes open and looking straight ahead, heavy brows low on the inside and high on the outside pressing on the upper lids, the mouth slightly open showing fangs; the right foreleg stepping forward, the gold crown a little crooked.
// Face: the eyeball half set into the socket, wrapped by an upper and a lower eyelid with thickness (not a single eye-socket frame pasted on); the nose bridge runs from between the brows to the nose tip, and the cheeks are broad and thick.
// Gaze order: the face (the golden face, cream muzzle, amber eyes, fangs) first, the gold crown on the head and the source crystal on the chest second, and the flame mane and flame ridge as support.
// Back: the flame mane drapes back over the shoulders, joining below it the flame ridge that runs all the way to the tail root; the tail hangs down and then hooks up, with a tuft of fire at the end.
// Restrained light effects: the old version's corona fire ring, fire beads, little flames on the back and floating light are removed; the fire relies on shape and color, and the only emissive left is the source crystal, the rubies, the gaps in the flame ridge and the fire at the end of the tail.
//
// Anchors (rig.anchors): mouth (the mouth, moving down and forward with the open mouth when roaring), crown (center of the gold crown), crownGem (surface of the big ruby directly in front of the crown), pendant (surface of the source crystal on the chest),
//   mane (center of the mane, behind the head), tail (the fire at the end of the tail), ridge (above the middle of the flame ridge), pawFL / pawFR / pawBL / pawBR (where the four paws touch the ground; R is the +x side, the one stepping forward).
// <Action table> (act, 0-1; all 0 is idle, pixel-for-pixel the same as the original):
//   focus  stop looking around and look straight ahead
//   roar   mouth open (the lower jaw with the lower fangs turns down and the mouth cavity opens wide), head thrown back, chest out, ears laid back, tail raised, no blinking
//   crouch the front of the body lowered, head lowered, ears back, tail lashing; used together with roar it is the level-gaze open-mouth breath pose
//   flare  the mane flames spread outward and leap back and flicker fast, the fur on the chest and nape spreads with them, and the fire at the end of the tail grows
//   hue    flame color: 0 red flame, 1 white flame, 2 azure flame (intermediate values allowed). The vertex colors of the flame fur move to another color ramp according to the original light and dark, and the emissive of the flame ridge, source crystal, tail fire and mane changes color with it
//   glow   the source crystal, flame ridge, ruby on the crown and fire at the end of the tail get brighter (without relying on bloom)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, furCollar, lathe, loft, outline, partKit, PI, rbox, rng, slab, smooth, taper, type FurCollarOpts, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const FWD = v(0, 0, 1);

/** Almond shape: pointed at the left and right corners, the upper edge more curved than the lower; slant tilts the outer corner (the side where x is positive) up */
function almond(w: number, up: number, down: number, slant: number, n = 16): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = w - (2 * w * i) / n;
    pts.push([x, up * (1 - (x / w) ** 2) + slant * x]);
  }
  for (let i = 1; i < n; i++) {
    const x = -w + (2 * w * i) / n;
    pts.push([x, -down * (1 - (x / w) ** 2) + slant * x]);
  }
  return pts;
}


// ───────────────────────── Helpers for the face-count budget (SSR 60,000 faces) ─────────────────────────

/**
 * An elliptical decal on a sphere (iris, pupil): longitude radius rx, latitude radius ry (radians), centered on +z. The outline and projection are the same as the n-point ellipse that sphereDecal in shapes.ts
 * lays down, but it is split into concentric rings instead (a fan of triangles in the center and rings quadrilaterals outside), the chord faces likewise do not sink into the sphere, and the face count is a tenth.
 */
function ovalDecal(rx: number, ry: number, r: number, n = 28, rings = 4): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const put = (lon: number, lat: number) => {
    const x = Math.cos(lat) * Math.sin(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(lon);
    pos.push(x * r, y * r, z * r);
    nor.push(x, y, z);
  };
  put(0, 0);
  for (let k = 1; k <= rings; k++)
    for (let j = 0; j < n; j++) put(Math.cos((j / n) * PI * 2) * rx * (k / rings), Math.sin((j / n) * PI * 2) * ry * (k / rings));
  const at = (k: number, j: number) => 1 + (k - 1) * n + (j % n);
  const idx: number[] = [];
  for (let j = 0; j < n; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let k = 1; k < rings; k++)
    for (let j = 0; j < n; j++) idx.push(at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j), at(k + 1, j + 1), at(k, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/**
 * Eyelid shell with thickness and a round lip edge: the same shape as lidGeometry in shapes.ts, with the segment counts adjustable.
 * Only the ring near the lip edge can be seen, so the outline sampling is concentrated toward the lip edge; radial segments around the axis, n segments per face, lipN segments for the round lip.
 */
function lidGeo(ri: number, ro: number, lip: number, radial = 32, n = 6, lipN = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const at = (i: number) => { const u = i / n; return lip * u * (1.5 - 0.5 * u); };
  for (let i = 0; i <= n; i++) prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(at(i))), ri * Math.cos(at(i))));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < lipN; i++) {
    const b = (i / lipN) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = n; i >= 0; i--) prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(at(i))), ro * Math.cos(at(i))));
  return smooth(new THREE.LatheGeometry(prof, radial));
}

/** Keep 8 columns per tuft: the notch, the tip, one column on each side of each, and one column for each of the two flat stretches */
const FOLD_W = [0, 1 / 12, 3 / 12, 5 / 12, 6 / 12, 7 / 12, 9 / 12, 11 / 12];

/**
 * The furCollar mesh is column by column (12 columns per tuft), 29 vertices per column (the outer side from fur root to fur tip, k = 0..14, then back from the inner side to the root).
 * Only some of the columns and cross-section points are kept and the triangles reconnected; the shape, vertex colors and vertex normals all reuse the values computed on the original fine mesh.
 * Columns: ws is the positions kept within each tuft (0 is the notch between tufts, 0.5 is the fur tip, aligned by phase). The notch and the tip are fold lines, with one extra column kept on each side
 * (FOLD_W), so the triangles beside a fold line are exactly the same as the original, the normals change just as steeply across the fold line, and the lines between tufts do not fade;
 * only the flat stretches on the two sides are sampled more sparsely.
 * Cross-section: the ks points (14 is the fur tip and must be there); when there is a tint, the points on both sides of the color-change position are added automatically, so the color-change boundary from fur root to fur tip does not widen.
 */
function thinCollar(g: THREE.BufferGeometry, o: FurCollarOpts, ws: number[] = FOLD_W, ks0 = [0, 2, 4, 6, 8, 10, 12, 13, 14]): THREE.BufferGeometry {
  const span = (o.a1 ?? PI) - (o.a0 ?? -PI);
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * 12));
  const J = 29;
  const phase = o.phase ?? 0;
  const set = new Set<number>(full ? [] : [0, nT]);
  for (let m = -1; m <= Math.ceil(o.tufts) + 1; m++)
    for (const w of ws) {
      const i = Math.round(((m + w - phase) * nT) / o.tufts);
      if (full) set.add(((i % nT) + nT) % nT);
      else if (i >= 0 && i <= nT) set.add(i);
    }
  const cols = [...set].sort((a, b) => a - b);
  const kset = new Set(ks0);
  if (o.tint) {
    const kt = o.tint[2] * 14;
    for (const k of [Math.floor(kt), Math.ceil(kt)]) if (k >= 0 && k <= 14) kset.add(k);
  }
  const ks = [...kset].sort((a, b) => a - b);
  const js = [...ks, ...ks.slice(0, -1).reverse().map((k) => J - 1 - k)];
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

/** Merge several pieces of geometry into one: keep only positions and normals (colors kept only if every piece has vertex colors); if one has no index, everything is flattened */
function mergeParts(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = gs.some((g) => !g.index);
  const keep = ['position', 'normal', ...(gs.every((g) => g.attributes.color) ? ['color'] : [])];
  return mergeGeometries(
    gs.map((g0) => {
      const g = flat && g0.index ? g0.toNonIndexed() : g0;
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      return g;
    }),
    false,
  )!;
}

/** A matrix composed of position, rotation and scale (in the same order as Object3D) */
function mtx(pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scl: V3 = [1, 1, 1]): THREE.Matrix4 {
  return new THREE.Matrix4().compose(v(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), v(...scl));
}

/** A low-face-count hemisphere rivet (partKit's rivet is 12 × 8 segments, here 10 × 4; a rivet is only a tenth the size of a fingernail, so the difference is invisible) */
const RIVET = new THREE.SphereGeometry(1, 10, 4, 0, PI * 2, 0, PI / 2);

// ───────────────────────── Shape ─────────────────────────

/** A flame-shaped crown tooth: wide at the base, one wave on each side, the tip hooking slightly to one side (the ultimate's corona ring also uses it as its rays) */
export function flameTooth(w: number, h: number): THREE.Shape {
  return outline([
    [-w, 0], [w, 0], [w * 0.72, h * 0.32], [w * 0.28, h * 0.46], [w * 0.5, h * 0.66], [w * 0.08, h],
    [-w * 0.34, h * 0.7], [-w * 0.18, h * 0.52], [-w * 0.74, h * 0.34],
  ]);
}

export function buildIgnisarLab(): LabModel {
  const rand = rng(20260929);
  const jit = (a: number) => (rand() - 0.5) * 2 * a;
  const RIMC = 0xffe0a8;
  /** The flame fur uses vertex colors, with base color set to white */
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    fur: labToon(0xeaa63e, { rim: 0.6, rimColor: RIMC }),
    cream: labToon(0xfbe6bb, { rim: 0.5, rimColor: RIMC }),
    mane: vc(labToon(0xffffff, { rim: 0.6, rimColor: 0xffc27a })),
    flame: vc(labToon(0xffffff, { ramp: 'gem', emissive: 0xff5a10, emissiveAmt: 0.3, rim: 0.4, rimColor: 0xffe08a })),
    gold: labToon(0xe8b64a, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    ruby: labToon(0xff3a2a, { ramp: 'gem', emissive: 0xc81808, emissiveAmt: 0.45, spec: 1.4, specTh: 0.88, rim: 0.6 }),
    crystal: labToon(0xff8a2a, { ramp: 'gem', emissive: 0xff4a10, emissiveAmt: 0.55, spec: 1.4, specTh: 0.88, rim: 0.7, rimColor: 0xffe08a }),
    basalt: labToon(0x4a3632, { speckle: 0.12, spec: 0.7, specTh: 0.96, rim: 0.5, rimColor: 0xffb070 }),
    lava: labToon(0xff8a2a, { ramp: 'gem', emissive: 0xff4a0c, emissiveAmt: 0.75, rim: 0 }),
    eye: labToon(0xffc53a, { ramp: 'gem', emissive: 0xd88a10, emissiveAmt: 0.22, rim: 0 }),
    iris: labToon(0xc86a14, { ramp: 'gem', emissive: 0x8a3a08, emissiveAmt: 0.2, rim: 0 }),
    pupil: labToon(0x2a140c, { rim: 0 }),
    socket: labToon(0x5a2c16, { rim: 0.3, rimColor: RIMC }),
    nose: labToon(0x4e241e, { spec: 0.9, specTh: 0.997, rim: 0.4, rimColor: RIMC }),
    mouth: labToon(0x5a1c18, { rim: 0 }),
    ivory: labToon(0xfff6e4, { rim: 0.4 }),
    claw: labToon(0x3a2620, { spec: 0.8, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    earIn: labToon(0x8a4a26, { rim: 0.2 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'ignisar-lab';
  const { add, group } = partKit();
  /**
   * Small parts of the same material are merged into one mesh (far fewer draw calls, and the outline pass too): each piece gets its transform relative to parent applied and is then merged.
   * at is the object the part sits in (or a matrix relative to parent is given directly). Parts that touch each other are put in different batches k, so two adjacent pieces have different part indices and the lines between them are kept.
   * Only parts that never move are merged: parts that turn or scale in the idle action (the upper eyelids, ears, the outer two layers of mane, the fire at the end of the tail) each keep a mesh of their own as before.
   */
  const batch = (parent: THREE.Object3D, mat: THREE.Material) => {
    const parts = new Map<number, THREE.BufferGeometry[]>();
    const put = (g: THREE.BufferGeometry, at: THREE.Object3D | THREE.Matrix4, pos?: V3, rot?: V3, scl?: V3, k = 0, local?: THREE.Matrix4) => {
      let m: THREE.Matrix4;
      if (at instanceof THREE.Matrix4) m = at.clone();
      else {
        at.updateWorldMatrix(true, false);
        parent.updateWorldMatrix(true, false);
        m = parent.matrixWorld.clone().invert().multiply(at.matrixWorld);
      }
      m.multiply(local ?? mtx(pos, rot, scl));
      if (!parts.has(k)) parts.set(k, []);
      parts.get(k)!.push(g.clone().applyMatrix4(m));
    };
    const done = (inkGroup?: number) =>
      [...parts.entries()].sort(([a], [b]) => a - b).map(([, p]) => {
        const me = add(parent, mergeParts(p), mat);
        if (inkGroup !== undefined) me.userData.inkGroup = inkGroup;
        return me;
      });
    /** Place a part in at by giving the matrix directly (for parts like rivets oriented with a quaternion) */
    const putM = (g: THREE.BufferGeometry, at: THREE.Object3D, local: THREE.Matrix4, k = 0) => put(g, at, undefined, undefined, undefined, k, local);
    return { put, putM, done };
  };
  /** Rivet placement: a hemisphere facing the n direction (turned from +y to n the same way as partKit's rivet) */
  const rivetM = (pos: V3, n: V3, r: number) =>
    new THREE.Matrix4().compose(v(...pos), new THREE.Quaternion().setFromUnitVectors(UP, v(...n).normalize()), v(r, r * 0.6, r));

  // Outline part indices: no lines between members of the same group, so the fur root and the body it grows from do not get an extra ring of line
  const HEAD = 9101;
  const NECK = 9102;
  const TAIL = 9103;
  const TORSO = 9104;

  /** Place a ring of fur: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal */
  const collarM = (at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(at);
  };
  /** The geometry of a ring of fur: reusing furCollar's fine mesh, keeping the ws columns per tuft and the ks cross-section points and reconnecting the triangles */
  const collarG = (o: FurCollarOpts, ws = FOLD_W, ks?: number[]) => thinCollar(furCollar(o), o, ws, ks);
  /** Place a ring of fur (a mesh of its own) */
  const collar = (parent: THREE.Object3D, mat: THREE.Material, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup?: number, ws = FOLD_W, ks?: number[]) => {
    const m = add(parent, collarG(o, ws, ks), mat);
    collarM(at, axis, dorsal).decompose(m.position, m.quaternion, m.scale);
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };
  // Keep the whole cross-section: for the big flame tongues of the outer two layers and the ring on the chest, the bend along the length and the upward curl decide the shape of the light/shadow boundary
  const ALL_KS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  // Body (rising and falling slightly with breathing); the four feet hang directly on root, so they stand firmly on the ground
  const BY = -0.05;
  const body = group(root, [0, BY, 0]);

  // ── Torso: a broad thick front chest, a tight waist, a solid rump; the shoulders also bulge with an extra piece of muscle ──
  const torsoPts = [v(0, 0.78, -0.62), v(0, 0.82, -0.42), v(0, 0.8, -0.15), v(0, 0.8, 0.1), v(0, 0.84, 0.3), v(0, 0.9, 0.44)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.03, 0.12, 0.12, 0],
    [0.08, 0.19, 0.19, 0],
    [0.18, 0.22, 0.22, 0],
    [0.35, 0.2, 0.2, 0.02],
    [0.5, 0.195, 0.195, 0.03],
    [0.66, 0.25, 0.26, 0],
    [0.8, 0.28, 0.3, -0.03],
    [0.92, 0.25, 0.26, -0.02],
    [0.975, 0.16, 0.17, 0],
    [1, 0, 0, 0],
  ]);
  const torso = add(body, loft(torsoPts, torsoProf, { segs: 48, radial: 24 }), M.fur);
  torso.userData.inkGroup = TORSO;
  // The two shoulder muscles are merged into one mesh (in the same group as the torso, so there is no outline between them anyway)
  const shoulders = batch(body, M.fur);
  const shoulderGeo = new THREE.SphereGeometry(1, 18, 12);
  for (const sx of [-1, 1]) shoulders.put(shoulderGeo, body, [sx * 0.2, 0.86, 0.24], [0.3, 0, -sx * 0.15], [0.11, 0.17, 0.15]);
  shoulders.done(TORSO);
  // The torso's top line: sampled along the spine, and the rock plates of the flame ridge must lie against it
  const torsoPath = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal');
  const topAt = (z: number): number => {
    let best = 0;
    let bd = Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i <= 200; i++) {
      torsoPath.getPointAt(i / 200, p);
      const d = Math.abs(p.z - z);
      if (d < bd) {
        bd = d;
        best = i / 200;
      }
    }
    torsoPath.getPointAt(best, p);
    const [, b, dy] = torsoProf(best);
    return p.y + dy + b;
  };

  // Neck: short and thick, almost entirely hidden in the mane
  const nb = v(0, 0.9, 0.3);
  const nt = v(0, 1.2, 0.46);
  add(body, loft([nb, v(0, 1.05, 0.38), nt], curveTable([[0, 0.21, 0.21], [0.5, 0.2, 0.2], [1, 0.17, 0.17]]), { segs: 16, radial: 16 }), M.fur).userData.inkGroup = NECK;

  // ── Limbs: forelegs as thick as pillars, powerful hind legs; wide paws, four toes and exposed claws; the right foreleg stepping forward one step ──
  // The four legs are one mesh; the paws and the fur behind the elbows are one; adjacent toes are split between two meshes; the claws are one. The lines between leg, paw and toe are as before
  const legB = batch(root, M.fur);
  const pawB = batch(root, M.fur);
  const toeB = batch(root, M.fur);
  const clawB = batch(root, M.claw);
  const pawGeo = new THREE.SphereGeometry(1, 18, 12);
  const toeGeo = new THREE.SphereGeometry(1, 10, 8);
  const clawGeo = new THREE.ConeGeometry(0.009, 0.036, 6);
  const paw = (x: number, z: number) => {
    pawB.put(pawGeo, root, [x, 0.062, z], [0, 0, 0], [0.108, 0.062, 0.118]);
    for (let i = 0; i < 4; i++) {
      const cx = x + (i - 1.5) * 0.05;
      const cz = z + 0.1 - Math.abs(i - 1.5) * 0.018;
      toeB.put(toeGeo, root, [cx, 0.042, cz], [0, 0, 0], [0.032, 0.038, 0.036], i % 2);
      clawB.put(clawGeo, root, [cx, 0.022, cz + 0.034], [1.85, 0, 0]);
    }
  };
  const bracers: THREE.Group[] = [];
  const bandB = batch(root, M.gold);
  const bandRivetB = batch(root, M.gold);
  const bandRubyB = batch(root, M.ruby);
  const bandGeo = lathe([[0.094, -0.022], [0.104, -0.018], [0.107, 0.016], [0.1, 0.024], [0.093, 0.02]], 32);
  for (const sx of [-1, 1]) {
    const fz = sx > 0 ? 0.08 : 0;
    legB.put(loft([v(sx * 0.14, 0.86, 0.3 + fz), v(sx * 0.19, 0.46, 0.2 + fz), v(sx * 0.195, 0.2, 0.26 + fz), v(sx * 0.2, 0.1, 0.29 + fz), v(sx * 0.2, 0.06, 0.32 + fz)],
      curveTable([[0, 0, 0], [0.03, 0.09, 0.11], [0.09, 0.13, 0.16], [0.25, 0.12, 0.14], [0.45, 0.1, 0.11], [0.75, 0.09, 0.095], [0.95, 0.088, 0.09], [1, 0.07, 0.07]]), { segs: 28, radial: 16, side: X }), root);
    paw(sx * 0.2, 0.33 + fz);
    // Gold bracer: a gold ring with thickness, a ruby on the front and a rivet on each side
    const br = group(root, [sx * 0.197, 0.19, 0.265 + fz], [0.08, 0, 0]);
    bandB.put(bandGeo, br);
    bandRubyB.put(brilliant(0.018, 0.012, 0.014, 8), br, [0, 0, 0.106], [PI / 2, 0, 0]);
    for (const a of [-0.9, 0.9]) bandRivetB.putM(RIVET, br, rivetM([Math.sin(a) * 0.106, 0, Math.cos(a) * 0.106], [Math.sin(a), 0, Math.cos(a)], 0.009));
    bracers.push(br);
    // A tuft of fur behind the elbow flicking back
    const eo: FurCollarOpts = { r0: 0.05, len: 0.13, thick: 0.06, flare: 0.5, curl: 0.2, tufts: 3, notch: 0.5, a0: -1.2, a1: 1.2, seed: 50 + sx };
    pawB.put(collarG(eo), collarM(v(sx * 0.19, 0.5, 0.15 + fz), v(0, 0.4, 1), v(0, -0.3, -1)));
    legB.put(loft([v(sx * 0.12, 0.86, -0.47), v(sx * 0.2, 0.46, -0.3), v(sx * 0.2, 0.25, -0.51), v(sx * 0.2, 0.1, -0.49), v(sx * 0.2, 0.06, -0.46)],
      curveTable([[0, 0, 0], [0.03, 0.1, 0.14], [0.09, 0.15, 0.2], [0.2, 0.15, 0.19], [0.38, 0.1, 0.11], [0.55, 0.078, 0.085], [0.72, 0.072, 0.078], [0.9, 0.07, 0.074], [1, 0.055, 0.055]]), { segs: 30, radial: 16, side: X }), root);
    paw(sx * 0.2, -0.43);
  }
  legB.done();
  pawB.done();
  toeB.done();
  clawB.done();
  bandB.done();
  bandRivetB.done();
  bandRubyB.done();

  // ── Flame ridge: a row of basalt plates on the spine (smaller toward the back), a line of lava under each plate, showing through the gaps between plates ──
  const ridgeZ = [0.02, -0.12, -0.25, -0.37, -0.48];
  add(body, loft(ridgeZ.map((z) => v(0, topAt(z) - 0.008, z)), () => [0.042, 0.026], { segs: 30, radial: 10 }), M.lava).userData.inkGroup = TORSO;
  // Each rock is a faceted volcanic rock (a pentagonal pyramid with skewed vertices, each face with its own normal), the tip slanting backward
  const rock = (r: number, h: number) => {
    const pts: [number, number][] = [[0.001, -0.03], [r, 0], [r * 0.85, h * 0.35], [r * 0.45, h * 0.75], [0.001, h]];
    const g = lathe(pts, 5).toNonIndexed();
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setZ(i, p.getZ(i) - (y / h) * h * 0.35);
    }
    g.computeVertexNormals();
    return g;
  };
  // The rock plates are merged into three meshes: adjacent main plates take turns going into batches, and the small rocks on the two sides go in another batch (adjacent to the main plate they sit beside)
  const rockB = batch(body, M.basalt);
  const plates: THREE.Group[] = [];
  for (let i = 0; i < ridgeZ.length; i++) {
    const z = ridgeZ[i];
    const pg = group(body, [jit(0.006), topAt(z) - 0.03, z], [0, jit(0.5), jit(0.08)]);
    rockB.put(rock(0.07 - i * 0.008, 0.2 - i * 0.026), pg, undefined, undefined, undefined, i % 2);
    if (i < 3) for (const sx of [-1, 1]) rockB.put(rock(0.035 - i * 0.004, 0.09 - i * 0.012), pg, [sx * 0.06, -0.012, 0.02 + jit(0.01)], [0, jit(1), sx * -0.45], undefined, 2);
    plates.push(pg);
  }
  rockB.done();

  // ── Gold pendant for the Fire Source Crystal: hanging below the chin, in front of the mane on the chest; a beveled gold plate, six claws holding the source crystal, four rivets, a small gold wing on each side, and two strings of gold rings on the upper edge hooked into the mane ──
  // The gold pieces go in three batches: the gold plate in one; the claws, rivets, gold wings and the second ring of each string in one; the first and third rings of each string in one (the rings hook one into the next, so adjacent ones go in different batches)
  const pect = group(body, [0, 0.86, 0.6], [-0.3, 0, 0]);
  const pectB = batch(pect, M.gold);
  pectB.put(slab(outline([[-0.11, 0.04], [-0.07, 0.085], [0.07, 0.085], [0.11, 0.04], [0.075, -0.05], [0, -0.1], [-0.075, -0.05]]), 0.02, 0.008, 4), pect);
  add(pect, new THREE.CylinderGeometry(0.058, 0.058, 0.02, 24), M.socket, [0, 0, 0.012], [PI / 2, 0, 0]);
  add(pect, brilliant(0.055, 0.036, 0.042, 10), M.crystal, [0, 0, 0.024], [PI / 2, 0, 0]);
  const prongGeo = rbox(0.016, 0.024, 0.016, 0.006, 1);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 6;
    pectB.put(prongGeo, pect, [Math.cos(a) * 0.058, Math.sin(a) * 0.058, 0.034], [0, 0, a - PI / 2], undefined, 1);
  }
  for (const [x, y] of [[-0.085, 0.05], [0.085, 0.05], [-0.055, -0.045], [0.055, -0.045]] as [number, number][]) pectB.put(RIVET, rivetM([x, y, 0.016], [0, 0, 1], 0.009), undefined, undefined, undefined, 1);
  const linkGeo = new THREE.TorusGeometry(0.014, 0.0045, 6, 12);
  for (const sx of [-1, 1]) {
    pectB.put(slab(outline(([[0, 0.02], [0.07, 0.045], [0.1, 0.0], [0.05, -0.03]] as [number, number][]).map(([x, y]) => [x * sx, y] as [number, number])), 0.014, 0.005, 2), pect, [sx * 0.1, 0.02, -0.008], [0, sx * -0.4, 0], undefined, 1);
    for (let k = 0; k < 3; k++) pectB.put(linkGeo, pect, [sx * (0.06 + k * 0.012), 0.1 + k * 0.024, -0.012 - k * 0.012], [0, k % 2 ? PI / 2 : 0, sx * 0.3], undefined, k === 1 ? 1 : 2);
  }
  pectB.done();

  // ── Tail: hanging down and then hooking up, a gold ring before the end, a tuft of fire at the end ──
  const tail = group(body, [0, 0.84, -0.6], [0, 0.08, 0]);
  const tailPts = [v(0, 0.02, 0.06), v(0, -0.02, -0.12), v(0.02, -0.2, -0.3), v(0.05, -0.42, -0.4), v(0.09, -0.52, -0.52), v(0.12, -0.49, -0.64)];
  add(tail, loft(tailPts, curveTable([[0, 0.055, 0.055], [0.3, 0.042, 0.042], [0.85, 0.036, 0.036], [0.97, 0.034, 0.034], [1, 0, 0]]), { segs: 36, radial: 12, side: X }), M.fur).userData.inkGroup = TAIL;
  const tailPath = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  const ringT = 0.74;
  const ring = group(tail, tailPath.getPointAt(ringT).toArray() as V3);
  ring.quaternion.setFromUnitVectors(UP, tailPath.getTangentAt(ringT));
  add(ring, lathe([[0.036, -0.018], [0.045, -0.014], [0.047, 0.014], [0.04, 0.02], [0.035, 0.016]], 24), M.gold);
  const tailFlame = collar(tail, M.flame, { r0: 0.024, len: 0.22, thick: 0.09, flare: 0.35, curl: 0.45, tufts: 5, notch: 0.55, jitter: 0.25, tint: [0xd8401a, 0xffb43a, 0.5], seed: 21 },
    tailPath.getPointAt(0.86), tailPath.getTangentAt(0.86).negate(), UP, TAIL);

  // ── Head: the neck pivot handles looking around, the head's origin is at the center of the skull; the chin slightly lifted ──
  const neck = group(body, [0, 1.08, 0.42]);
  const head = group(neck, [0, 0.2, 0.1], [-0.05, 0, 0]);
  head.scale.setScalar(1.3);

  // The skull, cheeks, nose bridge, heavy brows and lower eyelids are all in the HEAD group (no lines between them anyway), merged into one mesh
  const headB = batch(head, M.fur);
  headB.put(new THREE.SphereGeometry(0.17, 32, 20), head, [0, 0, 0], [0, 0, 0], [1.08, 0.86, 0.92]);
  // Broad thick cheeks and a nose bridge running from between the brows to the nose tip: the face longer and more angular
  const cheekGeo = new THREE.SphereGeometry(1, 18, 12);
  for (const sx of [-1, 1]) headB.put(cheekGeo, head, [sx * 0.092, -0.066, 0.06], [0, sx * 0.3, 0], [0.072, 0.07, 0.085]);
  headB.put(loft([v(0, 0.07, 0.12), v(0, 0.035, 0.2), v(0, 0.0, 0.265)], curveTable([[0, 0.035, 0.03], [0.5, 0.036, 0.03], [0.9, 0.038, 0.028], [1, 0, 0]]), { segs: 16, radial: 12 }), head);
  // Muzzle: a wide short upper jaw, a wide triangular nose with nostrils, two cream whisker pads; the mouth almost closed, the upper fangs showing under the whisker pads
  add(head, loft([v(0, -0.02, 0.05), v(0, -0.05, 0.18), v(0, -0.065, 0.268)], curveTable([[0, 0.1, 0.09], [0.5, 0.095, 0.075], [0.85, 0.085, 0.065], [0.95, 0.07, 0.055], [1, 0, 0]]), { segs: 24, radial: 18 }), M.fur);
  add(head, taper(rbox(0.088, 0.046, 0.05, 0.018, 2), [1, 1], [0.45, 0.8]), M.nose, [0, -0.03, 0.29], [0.2, 0, 0]);
  const nostrilB = batch(head, M.pupil);
  for (const sx of [-1, 1]) nostrilB.put(new THREE.SphereGeometry(1, 12, 8), head, [sx * 0.017, -0.048, 0.306], [0, 0, 0], [0.011, 0.007, 0.008]);
  nostrilB.done();
  const fangB = batch(head, M.ivory);
  for (const sx of [-1, 1]) {
    add(head, new THREE.SphereGeometry(1, 18, 12), M.cream, [sx * 0.044, -0.092, 0.228], [0, 0, sx * 0.12], [0.054, 0.04, 0.046]);
    fangB.put(new THREE.ConeGeometry(0.013, 0.06, 8), head, [sx * 0.036, -0.13, 0.24], [PI + 0.05, 0, sx * 0.08]);
  }
  const mouthIn = add(head, new THREE.SphereGeometry(1, 16, 10), M.mouth, [0, -0.122, 0.175], [0, 0, 0], [0.05, 0.02, 0.06]);
  const jaw = group(head, [0, -0.116, 0.08], [0.06, 0, 0]);
  add(jaw, loft([v(0, -0.02, 0), v(0, -0.026, 0.1), v(0, -0.02, 0.15)], curveTable([[0, 0.072, 0.034], [0.6, 0.06, 0.03], [1, 0, 0]]), { segs: 16, radial: 12 }), M.cream);
  for (const sx of [-1, 1]) fangB.put(new THREE.ConeGeometry(0.009, 0.03, 8), jaw, [sx * 0.034, 0.004, 0.125], [0, 0, 0]);
  const [fangs] = fangB.done();

  // Eyes: the eyeball half set into the socket, wrapped by two eyelids with thickness, an upper (gold fur) and a lower (cream),
  // the edges of both eyelids being big circles through the two ends of the eyeball, so from the front they naturally make an almond eye pointed at both corners; under each eyelid a thin dark shell is laid, its edge showing a line of eyeliner.
  // The eyes are open looking straight ahead, the heavy brows low on the inside and high on the outside pressing on the upper lids: majestic and focused. At the inner corner, a lion's tear streak running down.
  const ER = 0.04;
  const UP_OPEN = 0.56;
  const LO_OPEN = 0.5;
  const lids: THREE.Group[] = [];
  const pupils: THREE.Object3D[] = [];
  // The eyelids go 24 segments around the axis: the eye is only a quarter of the head's width, and the chord height of the lip edge in a close-up is under half a pixel
  const lidFur = lidGeo(ER + 0.005, ER + 0.018, PI / 2, 24);
  const lidLow = lidGeo(ER + 0.005, ER + 0.011, PI / 2, 24);
  const lidLine = lidGeo(ER + 0.001, ER + 0.0045, PI / 2, 24);
  const browGeo = taper(rbox(0.108, 0.036, 0.056, 0.016, 2), [0.85, 0.9]);
  // The lower eyeliner and tear streak never move, so those of the two eyes are merged (lower eyeliner one batch, tear streak one batch, with the lines where the two meet as before)
  const socketB = batch(head, M.socket);
  const eyeAnchors: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.082, 0.03, 0.102]);
    eyeAnchors.push(group(eg, [0, 0, ER]));
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.4, 0.02, 0.92).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.16]);
    add(roll, new THREE.SphereGeometry(ER, 24, 16), M.eye);
    add(roll, ovalDecal(0.74, 0.74, ER + 0.0008), M.iris);
    add(roll, ovalDecal(0.6, 0.6, ER + 0.0016), M.eye);
    const pupil = add(roll, ovalDecal(0.24, 0.3, ER + 0.0024, 28, 3), M.pupil);
    pupils.push(pupil);
    const hl = add(roll, new THREE.SphereGeometry(0.0065, 10, 8), M.hi, [-0.013, 0.013, ER * 0.93]);
    hl.layers.disable(INK_LAYER);
    // Upper eyelid: the hemisphere shell tips back about x, with its front edge lifted to UP_OPEN radians above the center of the eyeball; the dark thin shell tips back a little less, showing a line of eyeliner
    const upper = group(roll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidFur, M.fur).userData.inkGroup = HEAD;
    const upLine = group(roll, [0, 0, 0], [-UP_OPEN + 0.09, 0, 0]);
    add(upLine, lidLine, M.socket);
    const lower = group(roll, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    headB.put(lidLow, lower);
    const loLine = group(roll, [0, 0, 0], [PI + LO_OPEN - 0.07, 0, 0]);
    socketB.put(lidLine, loLine);
    lids.push(upper, upLine);
    // Heavy brows: low on the inside and high on the outside, pressing above the upper lids and jutting slightly forward
    headB.put(browGeo, roll, [sx * 0.008, ER + 0.008, 0.024], [0.4, 0, sx * 0.24]);
    // Tear streak
    socketB.put(loft([v(-sx * ER * 0.92, -0.004, 0.012), v(-sx * ER * 1.05, -0.03, 0.022), v(-sx * ER * 1.0, -0.06, 0.028)], () => [0.005, 0.0035], { segs: 12, radial: 8, side: FWD }), roll, undefined, undefined, undefined, 1);
  }
  socketB.done();

  // Ears: small round ears half hidden in the mane, a patch of dark ear shell at the front
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.14, 0.095, -0.05], [-0.25, sx * 0.35, -sx * 0.65]);
    add(eg, new THREE.SphereGeometry(1, 18, 12), M.fur, [0, 0.04, 0], [0, 0, 0], [0.05, 0.052, 0.024]);
    add(eg, new THREE.SphereGeometry(1, 16, 10), M.earIn, [0, 0.036, 0.014], [0, 0, 0], [0.03, 0.033, 0.012]);
    ears.push(eg);
  }

  // Flame crown: a gold ring pressed down on the forehead and tilted forward, with a shield-shaped gold plate set with a big ruby directly in front; seven flame-shaped crown teeth spread outward like fire,
  // the middle one tallest and decreasing toward the sides, a small ruby under each; a ring of rivets on the gold ring. Slightly crooked to one side.
  // The gold pieces go in four batches: the ring; the rivets, the middle and every other crown tooth, and the four claws of the plate; the remaining crown teeth; the plate. The rubies are merged into one mesh
  const crown = group(head, [0, 0.118, 0.05], [-0.38, 0, 0.07]);
  const crownB = batch(crown, M.gold);
  const crownRubyB = batch(crown, M.ruby);
  crownB.put(lathe([[0.094, 0], [0.104, 0.004], [0.108, 0.03], [0.1, 0.04], [0.092, 0.036], [0.09, 0.004]], 48), crown);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2 + PI / 12;
    if (Math.abs(Math.sin(a / 2)) < 0.3) continue;
    crownB.put(RIVET, rivetM([Math.sin(a) * 0.108, 0.017, Math.cos(a) * 0.108], [Math.sin(a), 0, Math.cos(a)], 0.0065), undefined, undefined, undefined, 1);
  }
  const TEETH = [[0, 0.17, 0.034], [1, 0.125, 0.027], [2, 0.095, 0.023], [3, 0.07, 0.019]] as [number, number, number][];
  for (const [k, hgt, w] of TEETH) {
    for (const side of k === 0 ? [1] : [-1, 1]) {
      const a = side * k * 0.36;
      const pg = group(crown, [Math.sin(a) * 0.1, 0.032, Math.cos(a) * 0.1], [0, a, 0]);
      const tooth = group(pg, [0, 0, 0], [-0.12, 0, -side * k * 0.2]);
      crownB.put(slab(flameTooth(w, hgt), 0.014, 0.0045, 2), tooth, undefined, undefined, undefined, k % 2 ? 2 : 1);
      if (k > 0) crownRubyB.put(brilliant(0.01, 0.0065, 0.008, 8), tooth, [0, 0.02, 0.012], [PI / 2, 0, 0]);
    }
  }
  const plaque = group(crown, [0, 0.022, 0.108]);
  crownB.put(slab(outline([[-0.034, 0.03], [0.034, 0.03], [0.04, -0.004], [0, -0.04], [-0.04, -0.004]]), 0.012, 0.005, 3), plaque, undefined, undefined, undefined, 3);
  crownRubyB.put(brilliant(0.024, 0.016, 0.018, 10), plaque, [0, 0.0, 0.014], [PI / 2, 0, 0]);
  const plaqueProng = rbox(0.008, 0.012, 0.008, 0.003, 1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    crownB.put(plaqueProng, plaque, [Math.cos(a) * 0.024, Math.sin(a) * 0.024, 0.018], [0, 0, a - PI / 2], undefined, 1);
  }
  crownB.done();
  crownRubyB.done();

  // Short cream fur on the cheeks, framed between the face and the mane (two pieces that do not touch, merged into one mesh)
  const cheekFurB = batch(head, M.cream);
  for (const sx of [-1, 1]) {
    const o: FurCollarOpts = { r0: 0.12, len: 0.1, thick: 0.05, flare: 1.2, curl: 0.3, tufts: 3, notch: 0.5, a0: sx > 0 ? 1.7 : -2.7, a1: sx > 0 ? 2.7 : -1.7, seed: 41 + sx };
    cheekFurB.put(collarG(o), collarM(v(0, -0.02, 0.0), FWD, UP));
  }
  cheekFurB.done(HEAD);

  // Flame mane: the innermost ring of dark red short fur frames the face, and outside it two layers of a few big flame tongues leaping back and up, draping all the way to the shoulders
  // The innermost ring and the piece at the back of the head do not move and are in the same group, merged into one mesh; the outer two layers sway with the idle action, each with a mesh of its own
  const maneB = batch(head, M.mane);
  const mane0: FurCollarOpts = { r0: 0.14, len: 0.13, thick: 0.08, flare: 1.3, curl: 0.35, tufts: 14, notch: 0.5, jitter: 0.2, bias: 0.2, rise: 0.3, tint: [0x7a1e12, 0xb83a18, 0.6], seed: 31 };
  maneB.put(collarG(mane0), collarM(v(0, -0.01, -0.04), FWD, UP));
  const maneLayers = [
    collar(head, M.mane, { r0: 0.15, len: 0.38, thick: 0.12, flare: 0.98, curl: 0.3, tufts: 7, phase: 0.5, notch: 0.72, jitter: 0.3, bias: 0.35, rise: 0.9, tint: [0xa8321a, 0xff8a28, 0.5], seed: 32 }, v(0, 0, -0.08), FWD, UP, undefined, FOLD_W, ALL_KS),
    collar(head, M.mane, { r0: 0.14, len: 0.5, thick: 0.13, flare: 0.58, curl: 0.25, tufts: 6, phase: 0.5, notch: 0.72, jitter: 0.3, bias: 0.18, rise: 0.8, tint: [0x96301a, 0xf27424, 0.55], seed: 33 }, v(0, 0, -0.14), FWD, UP, undefined, FOLD_W, ALL_KS),
  ];
  // Back of the head: a piece draping down from the top of the head, so from behind the back of the skull does not show
  const backHead: FurCollarOpts = { r0: 0.1, len: 0.3, thick: 0.13, flare: 0.3, curl: 0.25, tufts: 5, notch: 0.6, jitter: 0.25, a0: -1.9, a1: 1.9, tint: [0x96301a, 0xe8662a, 0.55], seed: 35 };
  maneB.put(collarG(backHead), collarM(v(0, 0.1, -0.08), UP, v(0, 0, -1)));
  const maneInner = maneB.done(HEAD);
  headB.done(HEAD);
  // Chest and shoulders: a ring of flame fur draping down from the neck, the tips landing on the upper edge of the breastplate. A tuft passes out through in front of the gold pendant; without the sample points the chord faces would sink in,
  // and the patch of red showing through would get smaller, so this ring keeps its original density
  const nT = nt.clone().sub(nb).normalize();
  const nU = v(0, nT.z, -nT.y);
  const chestMane = collar(body, M.mane, { r0: 0.18, len: 0.36, thick: 0.13, flare: 0.9, curl: 0.5, tufts: 8, notch: 0.68, jitter: 0.3, tint: [0x8a2616, 0xe0561c, 0.55], seed: 4 }, nb.clone().lerp(nt, 0.45), nT, nU, NECK, FOLD_W, ALL_KS);
  // Nape: a piece draping onto the back, so from behind the neck does not show, the tips landing before the first rock plate of the flame ridge
  const napeMane = collar(body, M.mane, { r0: 0.17, len: 0.5, thick: 0.14, flare: 0.5, curl: 0.35, tufts: 5, notch: 0.65, jitter: 0.25, a0: -2.0, a1: 2.0, tint: [0x96301a, 0xf07a22, 0.55], seed: 6 }, nb.clone().lerp(nt, 1.05), nT, nU);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Action weights for performances (<Action table>); with all at 0 it is exactly the original idle ──
  const act = { focus: 0, roar: 0, crouch: 0, flare: 0, hue: 0, glow: 0 };

  // Flame color: the vertex colors of the flame fur, by their original light and dark (the dark red roots, the orange-yellow tips, the fire at the end of the tail brightest), are mapped to the color ramps of the white flame and azure flame,
  // so after the color change the layers of light and dark are the same as the original; they are rewritten only when act.hue changes. The emissive (flame ridge, source crystal, fire at the end of the tail, mane) changes color along with it
  const flameMeshes = [...maneInner, ...maneLayers, chestMane, napeMane, tailFlame];
  const lin = (hex: number) => new THREE.Color(hex);
  /** The three-step color ramp (dark, mid, bright) of each flame color; number 0 is the original vertex color */
  const HUE_RAMP = [
    null,
    [lin(0xf2c060), lin(0xffe9b4), lin(0xfffcf2)],
    [lin(0x16307e), lin(0x2f78f0), lin(0xb4e4ff)],
  ] as const;
  const lum = (r: number, g: number, b: number) => Math.sqrt(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const recs: { attr: THREE.BufferAttribute; stages: Float32Array[] }[] = [];
  {
    let lo = Infinity;
    let hi = -Infinity;
    const ws: Float32Array[] = [];
    for (const m of flameMeshes) {
      const attr = m.geometry.attributes.color as THREE.BufferAttribute;
      const a = attr.array as Float32Array;
      const w = new Float32Array(attr.count);
      for (let i = 0; i < attr.count; i++) {
        w[i] = lum(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
        lo = Math.min(lo, w[i]);
        hi = Math.max(hi, w[i]);
      }
      ws.push(w);
      recs.push({ attr, stages: [a.slice()] });
    }
    const c = new THREE.Color();
    recs.forEach((r, j) => {
      for (const ramp of [HUE_RAMP[1], HUE_RAMP[2]]) {
        const out = new Float32Array(r.attr.count * 3);
        for (let i = 0; i < r.attr.count; i++) {
          const k = (ws[j][i] - lo) / Math.max(1e-6, hi - lo);
          if (k < 0.55) c.lerpColors(ramp[0], ramp[1], k / 0.55);
          else c.lerpColors(ramp[1], ramp[2], (k - 0.55) / 0.45);
          out.set([c.r, c.g, c.b], i * 3);
        }
        r.stages.push(out);
      }
    });
  }
  /** Color change of the emissive: [material, red flame, white flame, azure flame] (one set each for base color and emissive) */
  const HUE_MATS: [THREE.MeshToonMaterial, number[], number[]][] = [
    [M.mane, [0x000000, 0x5a4a30, 0x14348c], [0xffffff, 0xffffff, 0xffffff]],
    [M.flame, [0xff5a10, 0xffc870, 0x3070ff], [0xffffff, 0xffffff, 0xffffff]],
    [M.lava, [0xff4a0c, 0xffb040, 0x2a66ff], [0xff8a2a, 0xfff0c4, 0x86ccff]],
    [M.crystal, [0xff4a10, 0xffc060, 0x2a6eff], [0xff8a2a, 0xfff2cc, 0x8ad4ff]],
  ];
  const hueCols = HUE_MATS.map(([, em, col]) => ({ em: em.map(lin), col: col.map(lin) }));
  let lastHue = 0;
  const setHue = (h: number) => {
    const i = Math.min(1, Math.floor(h));
    const k = Math.min(1, Math.max(0, h - i));
    for (const r of recs) {
      const a = r.attr.array as Float32Array;
      const s0 = r.stages[i];
      const s1 = r.stages[i + 1];
      for (let n = 0; n < a.length; n++) a[n] = s0[n] + (s1[n] - s0[n]) * k;
      r.attr.needsUpdate = true;
    }
    HUE_MATS.forEach(([m], j) => {
      m.emissive.lerpColors(hueCols[j].em[i], hueCols[j].em[i + 1], k);
      m.color.lerpColors(hueCols[j].col[i], hueCols[j].col[i + 1], k);
    });
  };

  // Open mouth: the two fangs of the lower jaw are merged with the upper row in the same mesh (in the head's coordinates), and when the lower jaw turns the vertices of the rear half turn with it
  const JAW0 = jaw.rotation.x;
  const fangPos = fangs.geometry.attributes.position as THREE.BufferAttribute;
  const fangNor = fangs.geometry.attributes.normal as THREE.BufferAttribute;
  const fang0 = { p: (fangPos.array as Float32Array).slice(), n: (fangNor.array as Float32Array).slice() };
  const lowFang = fangPos.count / 2;
  const jawM = new THREE.Matrix4();
  const jawR = new THREE.Matrix3();
  const fv = new THREE.Vector3();
  let lastJaw = JAW0;
  const moveFangs = (a: number) => {
    const p = jaw.position;
    jawM.makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationX(a - JAW0)).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    jawR.setFromMatrix4(jawM);
    const P = fangPos.array as Float32Array;
    const N = fangNor.array as Float32Array;
    for (let i = lowFang; i < fangPos.count; i++) {
      fv.fromArray(fang0.p, i * 3).applyMatrix4(jawM).toArray(P, i * 3);
      fv.fromArray(fang0.n, i * 3).applyMatrix3(jawR).toArray(N, i * 3);
    }
    fangPos.needsUpdate = true;
    fangNor.needsUpdate = true;
  };
  const chestS = chestMane.scale.clone();
  const napeS = napeMane.scale.clone();
  const mouthA = group(head, [0, -0.122, 0.175]);
  let lastGlow = 0;
  const RUBY0 = M.ruby.emissiveIntensity;

  // ── Idle: breathing, slowly looking around, blinking, the ears twitching now and then, the tail swaying lightly, the mane and the fire at the end of the tail flickering slightly, the flame ridge and source crystal glowing and fading with the breathing ──
  let blinkIn = 2.2;
  let blinkT = -1;
  const HIP = v(0, 0.8, -0.45);
  const bo = new THREE.Vector3();
  const update = (t: number, dt: number) => {
    const calm = 1 - act.focus;
    const br = Math.sin(t * 1.2);
    torso.scale.set(1 + br * 0.012, 1 + br * 0.012, 1);
    // Crouching (the front of the body lowered, leaning forward) and roaring (chest out): rotating about the rump, with the four feet staying on the ground
    const pitch = act.crouch * 0.06 - act.roar * 0.06;
    bo.set(0, BY + br * 0.004 - act.crouch * 0.035 + act.roar * 0.012, 0).sub(HIP);
    body.rotation.x = pitch;
    body.position.set(0, bo.y * Math.cos(pitch) - bo.z * Math.sin(pitch), bo.y * Math.sin(pitch) + bo.z * Math.cos(pitch)).add(HIP);
    neck.rotation.y = (Math.sin(t * 0.28) * 0.16 + Math.sin(t * 0.83) * 0.025) * calm;
    neck.rotation.x = Math.sin(t * 0.47) * 0.025 * calm - act.roar * 0.3 + act.crouch * 0.24;
    head.rotation.z = Math.sin(t * 0.28 + 0.7) * 0.025 * calm;
    head.rotation.x = -0.05 - act.roar * 0.16 + act.crouch * 0.05;
    for (const p of pupils) p.position.x = Math.sin(t * 0.28 - 0.5) * 0.005 * calm;
    // Open mouth: the lower jaw turns down and the mouth cavity opens along with it
    jaw.rotation.x = JAW0 + act.roar * 0.52;
    if (Math.abs(jaw.rotation.x - lastJaw) > 1e-5) {
      lastJaw = jaw.rotation.x;
      moveFangs(lastJaw);
    }
    mouthIn.position.set(0, -0.122 - act.roar * 0.03, 0.175 - act.roar * 0.01);
    mouthIn.scale.set(0.05 + act.roar * 0.004, 0.02 + act.roar * 0.042, 0.06);
    mouthA.position.set(0, -0.122 - act.roar * 0.035, 0.175 + act.roar * 0.07);

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
    // No blinking while roaring or crouching
    close *= 1 - Math.min(1, act.roar + act.crouch);
    for (let i = 0; i < lids.length; i++) lids[i].rotation.x = -UP_OPEN + (i % 2 ? 0.09 : 0) + (UP_OPEN + LO_OPEN - 0.02) * close;

    const back = Math.min(1, act.roar + act.crouch * 0.6);
    for (let i = 0; i < ears.length; i++) {
      const sx = i === 0 ? -1 : 1;
      const ph = (t + i * 2.7) % 5.8;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.2 : 0;
      ears[i].rotation.z = -sx * 0.5 + sx * tw * (1 - back);
      ears[i].rotation.x = -0.25 - back * 0.5;
    }
    // Mane flare: the outer two layers of big flame tongues spread outward and leap back, flickering fast; the two rings on the chest and nape spread with them
    const fa = act.flare;
    for (let i = 1; i <= maneLayers.length; i++) {
      const f = Math.sin(t * (1.6 + i * 0.5) + i * 1.3);
      const fk = fa * Math.sin(t * (15 + i * 4) + i * 2.1) * 0.03;
      maneLayers[i - 1].scale.set(1 + f * 0.012 + fa * 0.13 + fk, 1 + f * 0.012 + fa * 0.13 + fk, 1 + f * 0.025 + fa * 0.3 + fk * 1.5);
    }
    const fc = fa * Math.sin(t * 17 + 0.7) * 0.025;
    chestMane.scale.copy(chestS).multiplyScalar(1 + fa * 0.1 + fc);
    napeMane.scale.copy(napeS).multiplyScalar(1 + fa * 0.12 - fc);
    tail.rotation.y = 0.08 + Math.sin(t * 0.8) * 0.1 + Math.sin(t * 5) * 0.14 * act.crouch;
    tail.rotation.x = Math.sin(t * 1.1) * 0.03 + act.roar * 0.3;
    const fl = Math.sin(t * 5.3) * 0.5 + Math.sin(t * 3.1) * 0.5;
    const tf = 1 + fa * 0.35;
    tailFlame.scale.set((1 - fl * 0.04) * tf, (1 + fl * 0.07) * tf, (1 - fl * 0.04) * tf);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.2);
    const gl = 1 + act.glow * 0.9;
    M.crystal.emissiveIntensity = (0.5 + pulse * 0.1) * gl;
    M.lava.emissiveIntensity = (0.65 + pulse * 0.15) * gl;
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.ruby.emissiveIntensity = RUBY0 * (1 + act.glow * 0.8);
      M.flame.emissiveIntensity = 0.3 * gl;
    }
    if (Math.abs(act.hue - lastHue) > 1e-4) {
      lastHue = Math.min(2, Math.max(0, act.hue));
      setHue(lastHue);
    }
  };
  update(0, 0);

  // Anchors (<Anchors>): all empty groups that move with their parts
  const anchors: Record<string, THREE.Object3D> = {
    mouth: mouthA,
    crown: group(crown, [0, 0.08, 0.02]),
    crownGem: group(plaque, [0, 0, 0.03]),
    pendant: group(pect, [0, 0, 0.06]),
    mane: group(head, [0, 0.03, -0.12]),
    tail: group(tail, tailPath.getPointAt(0.86).addScaledVector(tailPath.getTangentAt(0.86), 0.1).toArray() as V3),
    ridge: group(body, [0, topAt(-0.2) + 0.06, -0.2]),
    pawFL: group(root, [-0.2, 0.03, 0.33]),
    pawFR: group(root, [0.2, 0.03, 0.41]),
    pawBL: group(root, [-0.2, 0.03, -0.43]),
    pawBR: group(root, [0.2, 0.03, -0.43]),
  };
  const rig = { head, eyes: eyeAnchors, anchors };
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.8, -0.02), radius: 1.08 };
}
