// Aeroth, the Azure Sky Eagle (model lab version): a sky eagle that circles above the clouds of the Azurehowl Plateau; the Wingfolk have passed down for generations that seeing its shadow sweep past is a good omen for a long journey.
// It keeps the five things that made the old model easiest to recognize: a white head and blue wings, a golden hooked beak and golden feet, golden-tipped crest feathers behind the head, a sapphire on the golden gorget, and dark blue wing tips.
// Body shape follows the lore: it lives in the sky, so it hovers in midair all the time and never stands on the ground. The body leans forward about thirty degrees, the two feet hang forward and down with the toes loosely curled,
// the tail feathers fanned and pressed back and down; it floats some distance off the ground, and its shadow can be seen on the ground (the omen in the legend is this shadow).
// Wingbeats follow a hovering large raptor: with the wing surface spread, the feathers grow toward the tail and the flapping axis runs along the wing surface, so the wing pushes air perpendicular to its surface rather than opening and closing in a plane;
// the flapping axis tilts forward from the body's long axis, the downstroke pressing forward and down and the upstroke drawing back and up, so the up and down strokes can be read from the front too.
// One beat per second: the downstroke is longer and strong, the whole wing spread flat with the leading edge pressed down; it turns over quickly at the bottom; on the upstroke the hand folds back at the wrist and the primaries turn on edge to cut through the air;
// at the top the wing surface turns over so the underside faces forward (the wing flip of slow hovering and braking), and with the wings raised high the whole wing surface can be seen from the front.
// The hand lags the wing by half a beat (the wing tips are dragged along, flinging past at the bottom and then catching up); the body is lifted after the downstroke and sinks on the upstroke, the head held steady and not swaying with it,
// and the tail feathers, the dangling feet and the crest all swing half a beat behind. The feather surface beyond the wrist is rotated vertex by vertex about the wrist on the CPU (the weights blend smoothly by feather-root position), and the outlines and shadows follow.
// The wing is three layers of feather surface joined into one sheet (flight feathers, greater coverts, lesser coverts), the trailing edge cut into individual round-headed feather tips, the primaries split apart into fingers,
// grooves pressed in between feathers and a raised rachis along the midline of the flight feathers; they are no longer outlined one feather at a time (that looks like overlapping armor plates).
// The white neck feathers, shoulder feathers, short breast feathers and feathered trousers are all rings of fur mass joined into one, the roots buried in the body; the shoulder feathers lie back along the back, so when leaning forward they do not flare into a cape when seen from behind.
// Personality: a proud and generous king of the sky. The head is brought back to level and turned slightly to one side, looking at the horizon in the distance, the eyes wide and round with the golden iris filling the whole eye,
// the bony brow ridge pressing down from above without covering the eye; the beak closed, the yellow gape at the corner of the mouth drawn up, a little confident smile.
// Gaze order: the face (white head, golden beak, golden eye) first, the sapphire on the gold medallion on the chest and the golden-tipped crest behind the head second, and the spread wings and tail feathers as support.
// Back: on the back of the wings a white scalloped band of cloud (it flies above a sea of clouds); the gold chain of the medallion on the chest passes under the neck feathers and shoulder feathers
// and clasps in the middle of the back into an eight-pointed compass star, the gorget the Wingfolk made for it, a mark that travelers on long journeys recognize.
// Restrained light effects: the old version's wind rings, halo, cloud masses, glowing rachises and glowing dots are removed; the only emissive left is the sapphire on the gold medallion and the eyes.
// <Action table> beat: beat faster and harder (0-1); tuck: both wings folded onto the back against the body, for diving (0-1);
// glide: gliding in circles, the body leveled, wings spread without beating, feet tucked under the tail, the head forward and looking slightly down (0-1; stacked with tuck it becomes a head-first diving pose);
// cry: mouth open in a long cry, the lower beak opening down, the head tilted back, the crest raised, the chest thrust out (0-1).
// Anchors: head, eyes, mouth, wingL / wingR (shoulders), wingTipL / wingTipR (wing tips, folding with the hand), crest (crest tips), gem (the sapphire).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, furCollar, lathe, loft, outline, partKit, PI, slab, smooth, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;

// ───────────────────────── Helpers for the face-count budget (SSR 60,000 faces) ─────────────────────────

/** Remove the zero-area triangles with duplicate vertices from the index (left over after mergeVertices at the two ends where a loft closes to a point) */
function dropDegenerate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!.array;
  const out: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i];
    const b = idx[i + 1];
    const c = idx[i + 2];
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  g.setIndex(out);
  return g;
}

/** Loft: the same as loft in shapes.ts, then remove the zero-area triangles at the two ends */
const lf = (pts: THREE.Vector3[], prof: (t: number) => number[], o: Parameters<typeof loft>[2]) => dropDegenerate(loft(pts, prof, o));

/** Keep only the vertices the index uses (after the triangles are reconnected, unused vertices are no longer uploaded) */
function compact(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!.array;
  const map = new Map<number, number>();
  const newIdx: number[] = [];
  for (let i = 0; i < idx.length; i++) {
    let n = map.get(idx[i]);
    if (n === undefined) map.set(idx[i], (n = map.size));
    newIdx.push(n);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes) as [string, THREE.BufferAttribute][]) {
    const arr = new Float32Array(map.size * a.itemSize);
    for (const [o, n] of map) for (let k = 0; k < a.itemSize; k++) arr[n * a.itemSize + k] = a.array[o * a.itemSize + k];
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  out.setIndex(newIdx);
  return out;
}

/** Eyelid shell: the same outline as lidGeometry in shapes.ts, with the lathe segments and the number of outline points adjustable (lidGeometry is about 4,000 faces per piece) */
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
 * The outer edge is the same as the original sphereDecal's 28-point outline; a polar grid going outward ring by ring saves many faces compared with subdividing three times, and the chord faces do not sink into the sphere.
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
 * The furCollar mesh is column by column (12 columns per tuft), 29 vertices per column (the outer side from fur root to fur tip, k = 0..14, then back from the inner side to the root).
 * For each tuft only per columns are kept, landing on the notch between tufts, the fur tip and the points on the two sides (the nearest column is found by phase, so the sawtooth's tips and notches are not skipped),
 * and the cross-section keeps only the ks points (14 is the fur tip and must be there); the shape and vertex normals reuse the values computed on the original fine mesh, with only the triangles reconnected.
 */
function thinCollar(o: FurCollarOpts, per = 6, ks = [0, 3, 6, 9, 11, 13, 14]): THREE.BufferGeometry {
  const g = furCollar(o);
  const span = (o.a1 ?? PI) - (o.a0 ?? -PI);
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * 12));
  const J = 29;
  const phase = o.phase ?? 0;
  const set = new Set<number>(full ? [] : [0, nT]);
  for (let m = -1; m <= Math.ceil(o.tufts) + 1; m++)
    for (let k = 0; k < per; k++) {
      const i = Math.round(((m + k / per - phase) * nT) / o.tufts);
      if (full) set.add(((i % nT) + nT) % nT);
      else if (i >= 0 && i <= nT) set.add(i);
    }
  const cols = [...set].sort((a, b) => a - b);
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
  return compact(g);
}

/** Fine cross-section sampling of thinCollar: used for the neck feathers beside the face and the feathered trousers in front */
const KS_FINE = [0, 2, 4, 6, 8, 10, 12, 13, 14];

/**
 * Sampling rows of a feather surface: from the originally evenly divided R rows, pick the few that fall on feature positions and drop the rest. ws is the position wanted within each feather
 * (0 is the notch between feathers, 0.5 is the feather tip; a different position can also be given for the m-th feather). The rows picked are all original rows,
 * so the shape and color of those rows are exactly the same as the original; at a notch the two rows that bracket it are kept: the original mesh almost never has a row falling exactly on a notch,
 * and the depth of the notch is set by those two rows, so taking a point that falls exactly on the notch would make the cut deeper than the original.
 * ws uses arcW to distribute equal angles around the circumference of the round-headed feather tip: the feather tip is steepest beside the notch, and sampling too sparsely there would turn the edge of the coverts into a row of long thin spikes.
 * The rows at the two closed ends are kept too. feather must increase with s.
 */
function featherRows(feather: (s: number) => number, R: number, ws: number[] | ((m: number) => number[])): number[] {
  const inv = (u: number) => {
    let a = 0;
    let b = 1;
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2;
      if (feather(m) < u) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const u0 = feather(0);
  const u1 = feather(1);
  const rows = new Set<number>([0, R, Math.round(R * 0.0125), Math.round(R * 0.025), R - Math.round(R * 0.025), R - Math.round(R * 0.0125)]);
  for (let m = Math.floor(u0); m <= Math.ceil(u1); m++)
    for (const w of typeof ws === 'function' ? ws(m) : ws) {
      const u = m + w;
      if (u < u0 || u > u1) continue;
      const x = inv(u) * R;
      if (w === 0) {
        rows.add(Math.floor(x + 1e-6));
        rows.add(Math.min(R, Math.ceil(x - 1e-6)));
      } else rows.add(Math.round(x));
    }
  return [...rows].sort((a, b) => a - b).map((i) => i / R);
}

/** n sample positions per feather, distributed at equal angles around the circumference of the round-headed feather tip: dense beside the notch, sparse near the feather tip */
const arcW = (n: number) => Array.from({ length: n }, (_, k) => (1 - Math.cos((k * PI) / n)) / 2);

/** The original feather surface takes 14 segments along the feather, denser toward the tip; ks picks a few of them (the root section is covered by the covert layer above and cannot be seen, so it can be sparse; the exposed sections, the color bands and the points of the tip's round lip are kept) */
const C14 = Array.from({ length: 15 }, (_, k) => 1 - Math.pow(1 - k / 14, 1.6));
const chordAt = (ks: number[]) => ks.map((k) => C14[k]);

/** Merge several pieces of geometry into one: keep only positions and normals (colors kept only if every piece has vertex colors); if one has no index, one is added */
function mergeParts(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const keep = ['position', 'normal', ...(gs.every((g) => g.attributes.color) ? ['color'] : [])];
  return mergeGeometries(
    gs.map((g) => {
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
      return g;
    }),
    false,
  )!;
}

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
  /** The feather-root positions s of the sampling rows (ascending, including 0 and 1, see featherRows); if not given it is rows evenly divided rows */
  at?: number[];
  /** The sample points c along the feather (0 at the root to 1 at the tip, see chordAt); if not given it is cols segments, denser toward the tip */
  cs?: number[];
  rows?: number;
  cols?: number;
}

interface Sheet {
  geo: THREE.BufferGeometry;
  /** The half thickness at s, at distance d from the feather root (for the layer stacked on top) */
  h: (s: number, d: number) => number;
  /** The feather-root position s of each vertex (when the wing goes up it decides how much to fold with the wrist) */
  s: Float32Array;
}

/**
 * A feather surface joined into one sheet: along the feather-root curve, each point grows a feather toward dir, the trailing edge cut into individual round-headed feather tips (shortened by notch between feathers),
 * with grooves pressed into the surface between feathers. The cross-section is a full ring (the back from root to tip, the underside from tip back to root), the feather tip a round lip; the thickness at both ends goes to 0, closing naturally.
 * The whole sheet is one part, so the outline falls only on the scalloped edge of the feather tips and the creases of the grooves, and does not outline every feather separately the way separate feathers would (overlapping armor plates).
 */
function featherSheet(o: SheetOpts): Sheet {
  const path = new THREE.CatmullRomCurve3(o.root, false, 'centripetal');
  const S = o.at ?? Array.from({ length: (o.rows ?? 260) + 1 }, (_, i) => i / (o.rows ?? 260));
  const R = S.length - 1;
  const cs = o.cs ?? Array.from({ length: (o.cols ?? 14) + 1 }, (_, k) => 1 - Math.pow(1 - k / (o.cols ?? 14), 1.6));
  const K = cs.length - 1;
  const groove = o.groove ?? 0.3;
  const J = 2 * K + 2;
  const pos: number[] = [];
  const col: number[] = [];
  const sv = new Float32Array((R + 1) * J);
  const P = new THREE.Vector3();
  const tc = new THREE.Color();
  const shape = (s: number) => {
    const u = o.feather(s);
    const w = u - Math.floor(u);
    const tip = o.pointy ? Math.pow(1 - Math.abs(2 * w - 1), o.pointy) : Math.sqrt(Math.max(0, 1 - (2 * w - 1) ** 2));
    const L = o.len(s) * (1 - o.notch(s) * (1 - tip));
    const e = ss(s, 0, 0.025) * (1 - ss(s, 0.975, 1));
    return { w, tip, L, e };
  };
  const hAt = (s: number, c: number, w: number, tip: number, L: number, e: number) => {
    if (c >= 1) return 0;
    const own = o.thick(s, c) * (1 - groove * c * (1 - tip)) + (o.rachis ?? 0) * Math.exp(-(((w - 0.5) / 0.07) ** 2)) * (1 - c) * ss(c, 0.05, 0.2);
    const und = o.under ? o.under(s, c * L) : 0;
    return (own + und) * Math.sqrt(Math.max(0, 1 - Math.pow(c, 8))) * e;
  };
  for (let i = 0; i <= R; i++) {
    const s = S[i];
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
      sv[i * J + j] = s;
      if (o.color) tc.set(o.color(s, c, side === 0 ? 1 : side, w));
      else tc.setRGB(1, 1, 1);
      col.push(tc.r, tc.g, tc.b);
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check: the normal of the middle row at the middle of the underside must face the underside, and if reversed it is flipped (after mirroring, the winding of the left and right feather surfaces is opposite)
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

/** Recompute the normals after changing positions vertex by vertex (the outer section of the wing bending backward) */
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
  const col = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i), n.fromBufferAttribute(na, i));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildAerothLab(): LabModel {
  const RIMC = 0xc4e2ff;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const WHITE = 0xf6f8fc;
  const PALE = 0xd6e4f6;
  const SKY = 0x4a8ce0;
  const BLUE = 0x2e62c0;
  const NAVY = 0x1b3884;
  const M = {
    white: labToon(WHITE, { rim: 0.5, rimColor: RIMC }),
    blue: labToon(BLUE, { rim: 0.75, rimColor: RIMC }),
    feather: vc(labToon(0xffffff, { rim: 0.7, rimColor: RIMC })),
    beak: labToon(0xf2b232, { spec: 0.9, specTh: 0.975, rim: 0.4, rimColor: 0xffe6a8 }),
    cere: labToon(0xffd45c, { rim: 0.4, rimColor: 0xffe6a8 }),
    foot: labToon(0xf0b53a, { rim: 0.4, rimColor: 0xffe6a8 }),
    talon: labToon(0x2c2838, { spec: 0.9, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    gold: labToon(0xe8b64a, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    sapphire: labToon(0x4a8cff, { ramp: 'gem', emissive: 0x1a5ae0, emissiveAmt: 0.55, spec: 1.4, specTh: 0.88, rim: 0.6 }),
    eye: labToon(0xffc43a, { ramp: 'gem', emissive: 0xd88a10, emissiveAmt: 0.22, rim: 0 }),
    iris: labToon(0xf09a1c, { ramp: 'gem', emissive: 0x9a4a08, emissiveAmt: 0.18, rim: 0 }),
    pupil: labToon(0x1a1626, { rim: 0 }),
    mouth: labToon(0x6a2432, { rim: 0 }),
    line: labToon(0x1e2448, { rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'aeroth-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const HEAD = 9301;
  const BODY = 9302;
  const WING_L = 9303;
  const WING_R = 9304;
  const TAIL = 9305;

  /** Place a ring of fur: y aligned to the direction the fur roots point (opposite to the fur flow), θ = 0 toward dorsal; per columns kept per tuft and the ks points of the cross-section (thinCollar) */
  const collar = (parent: THREE.Object3D, mat: THREE.Material, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup?: number, per = 6, ks?: number[]) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, thinCollar(o, per, ks), mat);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };

  // Hovering in midair: fly is the center of gravity, FLY_Y off the ground, rising and sinking with the wingbeat; pitchG leans the body forward (a hovering eagle is not upright);
  // body keeps the coordinates from modeling it upright, the origin under the feet, with PIV the center of gravity
  const FLY_Y = 0.95;
  const PITCH = 0.55;
  const PIV = v(0, 0.7, -0.05);
  const fly = group(root, [0, FLY_Y, 0]);
  const pitchG = group(fly, [0, 0, 0], [PITCH, 0, 0]);
  const body = group(pitchG, [-PIV.x, -PIV.y, -PIV.z]);

  // ── Torso: one whole loft, from the tail root slanting up to the chest and the base of the neck; the chest thrust out ──
  const torsoPts = [v(0, 0.4, -0.34), v(0, 0.47, -0.21), v(0, 0.58, -0.07), v(0, 0.74, 0.06), v(0, 0.9, 0.1), v(0, 1.02, 0.08)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.04, 0.06, 0.05, 0],
    [0.16, 0.12, 0.12, 0],
    [0.36, 0.18, 0.18, 0],
    [0.56, 0.205, 0.215, -0.025],
    [0.74, 0.18, 0.195, -0.015],
    [0.86, 0.15, 0.16, 0],
    [0.95, 0.1, 0.1, 0],
    [1, 0, 0, 0],
  ]);
  // The chest and belly are a little paler than the back (the countershading of birds), the boundary a wide smooth transition, so the body is not a single-color balloon. The part of the neck base hidden under the white neck feathers is white, so looking in through the gaps between feathers no blue step shows
  const BELLY = 0x4a84d8;
  const torso = add(body, paint(lf(torsoPts, torsoProf, { segs: 44, radial: 24 }), (p, n) => new THREE.Color(BLUE).lerp(new THREE.Color(BELLY), ss(n.dot(v(0, -0.45, 0.9).normalize()), -0.1, 0.5)).lerp(new THREE.Color(WHITE), ss(p.y, 0.9, 0.94))), M.feather);
  torso.userData.inkGroup = BODY;

  // ── Legs: blue feathered trousers covering the thigh, below them a golden tarsus with rings of scales, three toes forward and one back with dark curved talons;
  //    in flight the feet hang from the hip forward and down, the toes loosely curled ──
  // The foot parts are finally merged per leg into two meshes (golden feet, dark talons), see <Merge> at the end of the file
  const toe = (parent: THREE.Object3D, yaw: number, len: number, curl: number, feet: THREE.Mesh[], claws: THREE.Mesh[], back = false) => {
    const g = group(parent, [0, 0, 0]);
    g.rotation.set(back ? -curl : curl, yaw, 0, 'YXZ');
    const f = back ? -1 : 1;
    const pts = [v(0, 0.035, 0), v(0, 0.03, f * len * 0.4), v(0, 0.022, f * len * 0.8), v(0, 0.02, f * len)];
    feet.push(add(g, lf(pts, curveTable([[0, 0, 0], [0.12, 0.022, 0.02], [0.5, 0.018, 0.016], [0.85, 0.016, 0.015], [1, 0, 0]]), { segs: 10, radial: 8, side: X }), M.foot));
    // Curved talon: from the toe tip hooking forward and down into the ground
    const tp = [v(0, 0.022, f * (len - 0.01)), v(0, 0.028, f * (len + 0.02)), v(0, 0.012, f * (len + 0.042)), v(0, -0.004, f * (len + 0.046))];
    claws.push(add(g, lf(tp, (t) => { const k = Math.pow(1 - t, 0.8); return [0.011 * k + 0.0008, 0.012 * k + 0.0008]; }, { segs: 8, radial: 6, side: X }), M.talon));
  };
  const hips: THREE.Group[] = [];
  const legParts: { leg: THREE.Group; feet: THREE.Mesh[]; claws: THREE.Mesh[] }[] = [];
  for (const sx of [-1, 1]) {
    const hip = group(body, [sx * 0.1, 0.52, 0.01]);
    hips.push(hip);
    const leg = group(hip, [0, -0.46, 0.04]);
    const feet: THREE.Mesh[] = [];
    const claws: THREE.Mesh[] = [];
    legParts.push({ leg, feet, claws });
    feet.push(add(leg, lf([v(0, 0.36, -0.03), v(0, 0.24, -0.01), v(0, 0.13, 0.0), v(0, 0.05, 0.01)], curveTable([[0, 0, 0], [0.08, 0.046, 0.048], [0.5, 0.038, 0.04], [0.9, 0.035, 0.037], [1, 0.022, 0.022]]), { segs: 16, radial: 10, side: X }), M.foot));
    // Rings of scales on the tarsus
    for (let i = 0; i < 3; i++) {
      const y = 0.085 + i * 0.036;
      feet.push(add(leg, lathe([[0.037, -0.007], [0.044, -0.003], [0.045, 0.004], [0.039, 0.008]], 12), M.foot, [0, y, 0.004 - i * 0.003]));
    }
    const foot = group(leg, [0, 0.0, 0.015], [0, sx * 0.12, 0]);
    for (const [yaw, len] of [[-0.4, 0.11], [0, 0.13], [0.4, 0.11]] as [number, number][]) toe(foot, yaw, len, 0.85, feet, claws);
    toe(foot, 0, 0.075, 0.7, feet, claws, true);
    // Feathered trousers: a ring of feathers draping down outside the thigh, the tips reaching the middle of the tarsus (the biggest feathers seen from the front, with two extra cross-section points kept so the shading matches the original)
    collar(leg, M.feather, { r0: 0.05, len: 0.3, thick: 0.08, flare: 0.36, curl: 0.3, tufts: 7, notch: 0.4, jitter: 0.15, tint: [BLUE, 0x5a92de, 0.6], seed: 60 + sx }, v(0, 0.46, -0.04), UP, v(0, 0, -1), BODY, 6, KS_FINE);
  }

  // ── Breast feathers: a ring of short feathers draping down from the chest, only a little brighter than the body in color, so the chest is not a smooth balloon ──
  const chestFur = collar(body, M.feather, { r0: 0.17, len: 0.16, thick: 0.045, flare: 0.55, curl: 0.35, tufts: 6, notch: 0.3, jitter: 0.12, a0: PI - 0.85, a1: PI + 0.85, tint: [BELLY, 0x5a92e2, 0.5], seed: 7 }, v(0, 0.7, 0.07), v(0, 1, -0.35), v(0, 0.35, -1), BODY);
  // Shoulder feathers: a sheet of feathers on the back draping backward and down over the roots of both wings, so the wings read as growing out of the body
  const shoulderFur = collar(body, M.feather, { r0: 0.135, len: 0.27, thick: 0.06, flare: 0.32, curl: 0.2, tufts: 7, notch: 0.4, jitter: 0.15, a0: -1.9, a1: 1.9, tint: [BLUE, 0x3a72cc, 0.5], seed: 9 }, v(0, 0.9, 0.07), v(0, 1, 0.3), v(0, -0.3, -1), BODY);

  // ── Wings: hovering wingbeats. The wing bone (leading edge) goes out from the shoulder, tilts slightly forward at the wrist, then goes out and back to the hand tip;
  //    three layers of feather surface: flight feathers (the longest, with the primaries split apart into fingers), greater coverts, lesser coverts, stacked layer on layer with the tips of the upper layer covering the roots of the lower.
  //    When modeled, the wing surface lies flat on the body's xy plane (the feathers grow toward the tail, the underside facing +z);
  //    sh is the shoulder joint, and tilts the flapping axis forward by WING_AXIS from the body's long axis, so the wingbeat is an oblique plane going up and back, down and forward, and the up and down strokes can be read from the front too;
  //    wg does three rotations inside sh: flapping (about sh's y), twisting of the wing surface (about the span), and drawing the whole wing back (within the wing surface);
  //    the hand beyond the wrist (the primaries) is folded separately about the wrist on the CPU: drawn back with the wing surface on edge on the upstroke, and spread flat on the downstroke ──
  interface WingSkin { attr: THREE.BufferAttribute; nattr: THREE.BufferAttribute; rest: Float32Array; restN: Float32Array; w: Float32Array; idx: Uint32Array }
  interface WingRig { sx: number; sh: THREE.Group; wg: THREE.Group; skins: WingSkin[]; W: THREE.Vector3; hand: THREE.Vector3; tip: THREE.Vector3; tipA: THREE.Group }
  const wings: WingRig[] = [];
  const S_W = 0.57;
  const phi = curveTable([[0, -1.62], [0.3, -1.55], [0.57, -1.3], [0.8, -0.98], [1, -0.78]]);
  const flightLen = curveTable([[0, 0.2], [0.3, 0.34], [0.55, 0.38], [0.8, 0.44], [1, 0.34]]);
  const featherU = (s: number) => (s < 0.55 ? (s / 0.55) * 7 : 7 + ((s - 0.55) / 0.45) * 6);
  const WING_AXIS = 0.24;
  const DIHEDRAL = 0.2;
  const curveBack = (g: THREE.BufferGeometry) => warp(g, (p) => { const r = Math.hypot(p.x, p.y); p.z -= DIHEDRAL * Math.max(0, r - 0.12) ** 2; });
  const handW = (s: number) => ss(s, S_W - 0.05, S_W + 0.07);
  for (const sx of [-1, 1]) {
    const WG = sx < 0 ? WING_L : WING_R;
    const sh = group(body, [sx * 0.12, 0.87, 0.0], [WING_AXIS, 0, 0]);
    const wg = group(sh);
    wg.rotation.order = 'YXZ';
    const arm = [v(0, 0, 0), v(sx * 0.1, 0.03, 0), v(sx * 0.2, 0.07, 0.005), v(sx * 0.29, 0.09, 0), v(sx * 0.4, 0.07, -0.005), v(sx * 0.5, 0.03, -0.01)];
    const dir = (s: number) => { const a = phi(s)[0]; return v(sx * Math.cos(a), Math.sin(a), 0); };
    const N = () => FWD;
    // The bend of the feather surface: the underside slightly concave, the tips of the primaries turned up toward the back (the upper side in flight)
    const bend = (s: number, d: number) => {
      const c = Math.min(1, d / flightLen(s)[0]);
      return -0.035 * Math.sin(PI * c) - 0.08 * c * c * ss(s, 0.45, 1);
    };
    // The sampling rows are picked from the originally evenly divided grid: the notch of each feather (the two rows that bracket it), the two shoulders and the feather tip (pitfalls 81, 82, see featherRows);
    // along the feather, the sample points in the exposed sections, color bands and the round lip of the tip keep the positions of the original 14 segments
    const flight = featherSheet({
      root: arm, dir, normal: N, bend,
      // The primaries (the 7th feather onward) have deep notches and split into fingers, with two extra rows taken; the secondaries have shallow notches
      // The raised rachis along the midline of the flight feathers is very narrow (about 0.07 of a feather wide), so one extra row is taken on each side of the feather tip, so the bright rachis line is not smeared wider
      at: featherRows(featherU, 260, (m) => [...arcW(m >= 7 ? 10 : 8), 0.43, 0.57]),
      cs: chordAt([0, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
      len: (s) => flightLen(s)[0],
      feather: featherU,
      notch: (s) => 0.16 + 0.36 * ss(s, 0.5, 0.62),
      thick: (_s, c) => 0.011 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      rachis: 0.005,
      color: (_s, c, side) => {
        const tipBand = ss(c, 0.9, 0.95);
        if (side < 0) return new THREE.Color(SKY).lerp(new THREE.Color(NAVY), ss(c, 0.5, 0.75)).lerp(new THREE.Color(PALE), tipBand * 0.8);
        return new THREE.Color(0x8cb6ea).lerp(new THREE.Color(NAVY), ss(c, 0.6, 0.84));
      },
    });
    const covLen = (s: number) => flightLen(s)[0] * 0.52;
    const greaterU = (s: number) => featherU(s) * 1.5 + 0.5;
    const greater = featherSheet({
      root: arm, dir, normal: N, bend,
      at: featherRows(greaterU, 260, arcW(7)),
      cs: chordAt([0, 4, 6, 10, 11, 12, 14]),
      len: covLen,
      feather: greaterU,
      notch: () => 0.28,
      thick: (_s, c) => 0.004 + 0.006 * (1 - c),
      under: flight.h,
      groove: 0.4,
      color: (_s, c, side) => (side < 0 ? new THREE.Color(WHITE).lerp(new THREE.Color(PALE), ss(c, 0.3, 0.7)) : new THREE.Color(BLUE).lerp(new THREE.Color(SKY), ss(c, 0.4, 0.85))),
    });
    const lesserU = (s: number) => featherU(s) * 2.2;
    const lesser = featherSheet({
      root: arm, dir, normal: N, bend,
      at: featherRows(lesserU, 300, arcW(6)),
      // The topmost layer of lesser coverts is very short with a flat middle, so only the sample points at the root, the middle and the round lip of the tip are kept
      cs: chordAt([0, 5, 9, 11, 12, 14]),
      len: (s) => flightLen(s)[0] * 0.26,
      feather: lesserU,
      notch: () => 0.3,
      thick: (_s, c) => 0.004 + 0.008 * (1 - c),
      under: greater.h,
      groove: 0.4,
      color: () => BLUE,
    });
    // The three layers of feather surface share a material and an outline index, and are merged into one mesh (the CPU deformation then only has to change one buffer)
    const sheetGeo = mergeParts([flight.geo, greater.geo, lesser.geo]);
    const sheetS = new Float32Array(flight.s.length + greater.s.length + lesser.s.length);
    sheetS.set(flight.s, 0);
    sheetS.set(greater.s, flight.s.length);
    sheetS.set(lesser.s, flight.s.length + greater.s.length);
    // Wing bone: a rounded stretch of flesh along the leading edge, covering the roots of the three layers; its vertices use the nearest point on the wing bone as s
    const armGeo = lf(arm, curveTable([[0, 0, 0], [0.04, 0.045, 0.045], [0.3, 0.04, 0.036], [0.6, 0.032, 0.028], [0.9, 0.022, 0.02], [1, 0, 0]]), { segs: 28, radial: 10, up: FWD });
    const armPath = new THREE.CatmullRomCurve3(arm, false, 'centripetal');
    const armS = (() => {
      const samples = Array.from({ length: 121 }, (_, i) => armPath.getPointAt(i / 120));
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
        out[i] = best / 120;
      }
      return out;
    })();
    const skins: WingSkin[] = [];
    for (const [geo, sArr, mat] of [[sheetGeo, sheetS, M.feather], [armGeo, armS, M.blue]] as [THREE.BufferGeometry, Float32Array, THREE.Material][]) {
      const m = add(wg, curveBack(geo), mat);
      m.userData.inkGroup = WG;
      m.frustumCulled = false;
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
    // The wrist (the pivot where the hand folds) and the direction of the hand bone must both follow the curveBack bend
    const W = armPath.getPointAt(S_W);
    const Tip = armPath.getPointAt(1);
    for (const q of [W, Tip]) q.z -= DIHEDRAL * Math.max(0, Math.hypot(q.x, q.y) - 0.12) ** 2;
    // Wing-tip anchor: the tip of the outermost primary, folding along with the hand
    const tip = Tip.clone().addScaledVector(dir(1), flightLen(1)[0] * 0.9);
    wings.push({ sx, sh, wg, skins, W, hand: Tip.clone().sub(W).normalize(), tip, tipA: group(wg, [tip.x, tip.y, tip.z]) });
  }

  // The hand folds about the wrist: fold is the angle drawn back within the wing surface, and roll is the twist along the hand-bone direction (on the upstroke the primaries turn on edge to cut through the air).
  // The two rotations are combined into one axis-angle, and each vertex rotates by a fraction of that angle according to its weight, so the feathers near the wrist transition smoothly from stationary to following the whole hand
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
        // Position: rotated with the wrist as origin
        let px = sk.rest[o] - wx;
        let py = sk.rest[o + 1] - wy;
        let pz = sk.rest[o + 2] - wz;
        let d = kx * px + ky * py + kz * pz;
        P[o] = px * c + (ky * pz - kz * py) * s1 + kx * d * (1 - c) + wx;
        P[o + 1] = py * c + (kz * px - kx * pz) * s1 + ky * d * (1 - c) + wy;
        P[o + 2] = pz * c + (kx * py - ky * px) * s1 + kz * d * (1 - c) + wz;
        // Normal: the same rotation
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

  // ── Tail feathers: a fan drooping back and down from the tail root, a white base with two pale blue crossbars; covered by a layer of blue upper tail coverts ──
  const tailG = group(body, [0, 0.44, -0.3]);
  {
    const rootPts = [v(-0.07, 0, 0.01), v(0, 0, -0.01), v(0.07, 0, 0.01)];
    const tdir = (s: number) => v((s - 0.5) * 1.5, -1.0, -0.75).normalize();
    const tN = () => v(0, -0.6, 0.8);
    const tLen = (s: number) => 0.34 + 0.06 * Math.cos((s - 0.5) * PI);
    const tbend = (s: number, d: number) => 0.02 * Math.sin(PI * Math.min(1, d / tLen(s))) + 0.22 * ((2 * s - 1) ** 2) * d;
    const tailU = (s: number) => s * 9;
    const tail = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      at: featherRows(tailU, 220, arcW(6)),
      cs: chordAt([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
      len: tLen,
      feather: tailU,
      notch: () => 0.14,
      thick: (_s, c) => 0.013 * (0.3 + 0.7 * (1 - c)),
      groove: 0.35,
      color: (_s, c) => {
        const bar = ss(c, 0.5, 0.54) * (1 - ss(c, 0.6, 0.64)) + ss(c, 0.74, 0.78) * (1 - ss(c, 0.84, 0.88));
        return new THREE.Color(WHITE).lerp(new THREE.Color(SKY), bar);
      },
    });
    const covU = (s: number) => s * 6 + 0.5;
    const cov = featherSheet({
      root: rootPts, dir: tdir, normal: tN, bend: tbend,
      at: featherRows(covU, 160, arcW(8)),
      cs: chordAt([0, 4, 7, 10, 11, 12, 14]),
      len: (s) => tLen(s) * 0.4,
      feather: covU,
      notch: () => 0.3,
      thick: (_s, c) => 0.005 + 0.012 * (1 - c),
      under: tail.h,
      color: () => BLUE,
    });
    add(tailG, mergeParts([tail.geo, cov.geo]), M.feather).userData.inkGroup = TAIL;
  }

  // ── Head: the neck pivot handles looking around, and the head's origin is at the center of the skull ──
  // neck turns the body's forward lean back, so the face looks level and forward; look turns the head to look around only after that correction
  const neck = group(body, [0, 1.0, 0.1]);
  const look = group(neck);
  look.rotation.order = 'YXZ';
  const head = group(look, [0, 0.14, 0.07], [-0.04, 0, 0]);
  head.scale.setScalar(1.12);

  // The white parts on the head that do not move (skull, forehead, brow ridges, lower eyelids) share one outline index and are finally merged into one mesh
  const skull: THREE.Mesh[] = [];
  skull.push(add(head, new THREE.SphereGeometry(0.14, 40, 28), M.white, [0, 0, 0], [0, 0, 0], [1, 0.94, 1.1]));
  // Forehead: a block bulging forward between the two brow ridges, pulling the top of the head into the flat raptor brow, all the way to the cere; the brow ridges on both sides are buried in the head so they do not bulge into a lump seen from the side
  skull.push(add(head, new THREE.SphereGeometry(1, 20, 12), M.white, [0, 0.058, 0.095], [-0.15, 0, 0], [0.08, 0.06, 0.085]));
  // White neck feathers: a ring of feathers draping down from behind the head, covering the neck, the tips landing on the blue shoulders (the most conspicuous ring beside the face, with two extra cross-section points kept)
  const nT = v(0, 1, -0.1).normalize();
  collar(body, M.feather, { r0: 0.12, len: 0.28, thick: 0.1, flare: 0.75, curl: 0.45, tufts: 9, notch: 0.42, jitter: 0.15, tint: [WHITE, 0xe8f0fa, 0.6], seed: 3 }, v(0, 1.07, 0.12), nT, v(0, 0, -1), HEAD, 6, KS_FINE);

  // Beak: a golden hooked beak; the upper beak goes forward from the cere with the tip hooking down, the lower beak short and tucked into the upper; the cere pale yellow, with a nostril on each side
  add(head, lf([v(0, 0.035, 0.07), v(0, 0.022, 0.15), v(0, 0.0, 0.215), v(0, -0.035, 0.255), v(0, -0.085, 0.252)],
    curveTable([[0, 0, 0], [0.06, 0.05, 0.045], [0.3, 0.046, 0.042], [0.6, 0.032, 0.032], [0.85, 0.018, 0.02], [1, 0, 0]]), { segs: 28, radial: 16, side: X }), M.beak).userData.inkGroup = HEAD + 20;
  // The lower beak hangs on a pivot at the corner of the mouth (act.cry opens it downward in a long cry); a dark mouth interior is attached on it, hidden inside the upper beak when the mouth is closed
  const JAW = v(0, -0.03, 0.085);
  const jaw = group(head, [JAW.x, JAW.y, JAW.z]);
  add(jaw, lf([v(0, -0.035, 0.08).sub(JAW), v(0, -0.052, 0.15).sub(JAW), v(0, -0.058, 0.2).sub(JAW)], curveTable([[0, 0, 0], [0.1, 0.042, 0.022], [0.6, 0.03, 0.017], [1, 0, 0]]), { segs: 16, radial: 12, side: X }), M.beak).userData.inkGroup = HEAD + 20;
  add(jaw, new THREE.SphereGeometry(1, 14, 8), M.mouth, [0, -0.004, 0.05], [0.12, 0, 0], [0.026, 0.008, 0.06]).userData.inkGroup = HEAD + 20;
  // The cere and the gape share a material and an outline index and are finally merged into one mesh; the nostrils and lower eyeline (dark, with no index, not touching each other) are merged into one too
  const cere: THREE.Mesh[] = [];
  const darkLines: THREE.Mesh[] = [];
  cere.push(add(head, lf([v(0, 0.036, 0.075), v(0, 0.034, 0.11), v(0, 0.03, 0.14)], curveTable([[0, 0, 0], [0.15, 0.056, 0.05], [0.7, 0.052, 0.047], [1, 0, 0]]), { segs: 12, radial: 16, side: X }), M.cere));
  for (const sx of [-1, 1]) darkLines.push(add(head, new THREE.SphereGeometry(1, 8, 6), M.line, [sx * 0.03, 0.045, 0.128], [0, sx * 0.4, 0], [0.006, 0.009, 0.014]));
  // Gape: from the base of the beak back along the face to below the eye, the end drawn up
  for (const sx of [-1, 1]) {
    const pts = [v(sx * 0.044, -0.034, 0.14), v(sx * 0.064, -0.036, 0.105), v(sx * 0.08, -0.03, 0.074), v(sx * 0.088, -0.017, 0.06)];
    cere.push(add(head, lf(pts, (t) => { const k = Math.pow(Math.sin(PI * t), 0.5); return [0.006 * k, 0.005 * k]; }, { segs: 12, radial: 6 }), M.cere));
  }

  // Eye: the eyeball half set into the socket, wrapped by two white eyelids above and below, a dark eyeline under the lower lid; round and wide open, looking level forward; the bony brow ridge presses down from above
  const eyeA: THREE.Group[] = [];
  const ER = 0.036;
  const UP_OPEN = 1.02;
  const LO_OPEN = 0.92;
  const lids: THREE.Group[] = [];
  const pupils: THREE.Object3D[] = [];
  // The eyelids use low-face-count shells of the same outline (lidGeometry is about 4,000 faces per piece); the parts that do not move, such as the eyeball, iris and highlights, are finally merged by material
  const lidUp = lidGeo(ER + 0.004, ER + 0.014, PI / 2, 24, 5, 4);
  const lidLow = lidGeo(ER + 0.004, ER + 0.01, PI / 2, 24, 5, 4);
  const lidLine = lidGeo(ER + 0.001, ER + 0.0048, PI / 2, 20, 3, 2);
  const eyeBalls: THREE.Mesh[] = [];
  const irises: THREE.Mesh[] = [];
  const glints: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.08, 0.032, 0.1]);
    eyeA.push(group(eg));
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.52, 0.02, 0.86).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.1]);
    eyeBalls.push(add(roll, new THREE.SphereGeometry(ER, 24, 16), M.eye));
    irises.push(add(roll, diskDecal(0.8, 0.8, ER + 0.0008, 3, 28), M.iris));
    // The pale gold ring in the iris has the same material as the eyeball and is never adjacent to it (the iris lies between), so merging it with the eyeball gives the same outline
    eyeBalls.push(add(roll, diskDecal(0.71, 0.71, ER + 0.0016, 3, 28), M.eye));
    const pupil = add(roll, diskDecal(0.36, 0.38, ER + 0.0024, 2, 24), M.pupil);
    pupils.push(pupil);
    for (const [x, y, r] of [[-0.011, 0.012, 0.0068], [0.01, -0.011, 0.0034]] as [number, number, number][]) glints.push(add(roll, new THREE.SphereGeometry(r, 10, 6), M.hi, [x, y, ER * 0.94]));
    const upper = group(roll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.white).userData.inkGroup = HEAD;
    const upLine = group(roll, [0, 0, 0], [-UP_OPEN + 0.1, 0, 0]);
    add(upLine, lidLine, M.line);
    const lower = group(roll, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    skull.push(add(lower, lidLow, M.white));
    const loLine = group(roll, [0, 0, 0], [PI + LO_OPEN - 0.08, 0, 0]);
    darkLines.push(add(loLine, lidLine, M.line));
    lids.push(upper, upLine);
    // Brow ridge: a bony ridge bulging forward above the eye, low on the inside and high on the outside, almost straight, not covering the eye
    const bpts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      bpts.push(v(sx * ER * (-0.72 + 2.02 * u), ER * 0.9 + 0.004 + 0.012 * Math.min(1, u * 2) + 0.003 * Math.sin(PI * u), ER * (0.55 - 0.25 * u)));
    }
    skull.push(add(roll, lf(bpts, (tt) => { const k = Math.pow(Math.sin(PI * tt), 0.5) * ss(tt, 0, 0.35); return [0.015 * k, 0.011 * k]; }, { segs: 16, radial: 10 }), M.white));
  }

  // Crest (the origin of crestG is at the feather roots; in wind the whole sheet sways lightly about the roots): three long feathers fanning back and up from behind the head, the middle one tallest and the two on the sides lying back; white roots, pale blue bodies, golden tips, like a crown made of feathers
  const crestG = group(head, [0, 0.09, -0.09]);
  {
    const cr = [v(-0.054, 0.072, -0.08), v(0, 0.09, -0.09), v(0.054, 0.072, -0.08)];
    const cdir = (s: number) => {
      const a = 2 * s - 1;
      const yaw = a * 0.42;
      const el = 0.5 - 0.32 * Math.abs(a);
      return v(Math.sin(yaw) * Math.cos(el), Math.sin(el), -Math.cos(yaw) * Math.cos(el));
    };
    const crest = featherSheet({
      root: cr,
      at: featherRows((s) => s * 3, 180, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
      dir: cdir,
      normal: (s) => new THREE.Vector3().crossVectors(X, cdir(s)).normalize(),
      len: (s) => 0.19 + 0.11 * Math.pow(Math.cos((s - 0.5) * PI), 2),
      bend: (_s, d) => 1.2 * d * d,
      pointy: 0.6,
      feather: (s) => s * 3,
      notch: () => 0.62,
      thick: (_s, c) => 0.015 * (0.3 + 0.7 * (1 - c)),
      color: (_s, c) => new THREE.Color(WHITE).lerp(new THREE.Color(PALE), ss(c, 0.3, 0.6)).lerp(new THREE.Color(0xf2b640), ss(c, 0.74, 0.82)),
    });
    add(crestG, crest.geo, M.feather, [0, -0.09, 0.09]).userData.inkGroup = HEAD;
  }

  let gemA!: THREE.Group;
  // The gold ornaments are merged in two batches: the medallion and compass star in one, the gold chain and star core in the other; the ones that touch each other (medallion and chain, star and star core) are in different batches so their part indices differ (pitfall 84)
  const goldPlates: THREE.Mesh[] = [];
  const goldBits: THREE.Mesh[] = [];
  // ── Golden gorget: a ring of gold chain hidden under the white neck feathers, showing only on the chest, hanging a wing-shaped gold medallion set with a sapphire ──
  {
    const tp = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal');
    const t = 0.74;
    const C = tp.getPointAt(t);
    const T = tp.getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, UP).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [, b, dy] = torsoProf(t);
    const front = C.clone().addScaledVector(H, dy - b - 0.006);
    const out = H.clone().negate();
    const medal = group(body, [front.x, front.y, front.z]);
    medal.quaternion.setFromUnitVectors(FWD, out);
    medal.scale.setScalar(1.2);
    gemA = group(medal, [0, -0.004, 0.03]);
    goldPlates.push(add(medal, slab(outline([[0, 0.05], [0.026, 0.024], [0.06, 0.03], [0.042, 0.0], [0.05, -0.02], [0, -0.056], [-0.05, -0.02], [-0.042, 0.0], [-0.06, 0.03], [-0.026, 0.024]]), 0.012, 0.005, 3), M.gold, [0, 0, 0.008]));
    add(medal, brilliant(0.024, 0.016, 0.018, 10), M.sapphire, [0, -0.004, 0.02], [PI / 2, 0, 0]);
    // Gold chain: from the two corners of the medallion going up and around under the neck feathers
    for (const sx of [-1, 1]) {
      const pts = [v(sx * 0.05, 0.028, 0.006), v(sx * 0.085, 0.06, -0.004), v(sx * 0.11, 0.1, -0.03), v(sx * 0.12, 0.14, -0.07)];
      goldBits.push(add(medal, lf(pts, curveTable([[0, 0, 0], [0.08, 0.0065, 0.0065], [0.92, 0.0065, 0.0065], [1, 0, 0]]), { segs: 14, radial: 6 }), M.gold));
    }
    // The clasp at the back: the gold chain passes under the neck feathers and shoulder feathers and clasps in the middle of the back into an eight-pointed compass star (the Wingfolk's mark for finding direction)
    const tb = 0.5;
    const Cb = tp.getPointAt(tb);
    const Tb = tp.getTangentAt(tb);
    const Wb = new THREE.Vector3().crossVectors(Tb, UP).normalize();
    const Hb = new THREE.Vector3().crossVectors(Wb, Tb).normalize();
    const [, bb, dyb] = torsoProf(tb);
    const back = Cb.clone().addScaledVector(Hb, dyb + bb + 0.006);
    const clasp = group(body, [back.x, back.y, back.z]);
    clasp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(Tb, Hb), Tb, Hb));
    clasp.scale.setScalar(1.35);
    const star: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2 + PI / 2;
      const r = i % 2 ? 0.016 : i % 4 === 0 ? 0.058 : 0.034;
      star.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    goldPlates.push(add(clasp, slab(outline(star), 0.01, 0.004, 2), M.gold));
    goldBits.push(add(clasp, lathe([[0.02, 0], [0.021, 0.004], [0.015, 0.011], [0.001, 0.014]], 16), M.gold, [0, 0, 0.007], [PI / 2, 0, 0]));
    for (const sx of [-1, 1]) {
      const pts = [v(sx * 0.03, 0.03, -0.004), v(sx * 0.07, 0.09, -0.012), v(sx * 0.1, 0.16, -0.03)];
      goldBits.push(add(clasp, lf(pts, curveTable([[0, 0, 0], [0.1, 0.0065, 0.0065], [0.9, 0.0065, 0.0065], [1, 0, 0]]), { segs: 12, radial: 6 }), M.gold));
    }
  }

  // ── Merge: the parts that do not move are baked into a common parent, and those with the same material and outline index are merged into one mesh (meshes cut from 81 to thirty-odd, each mesh being drawn three times in battle) ──
  const merge = (into: THREE.Object3D, parts: THREE.Mesh[], mat: THREE.Material, inkGroup?: number) => {
    const gs = parts.map((m) => {
      const M4 = new THREE.Matrix4();
      for (let o: THREE.Object3D | null = m; o && o !== into; o = o.parent) {
        o.updateMatrix();
        M4.premultiply(o.matrix);
      }
      m.removeFromParent();
      return m.geometry.clone().applyMatrix4(M4);
    });
    const mesh = add(into, mergeParts(gs), mat);
    if (inkGroup !== undefined) mesh.userData.inkGroup = inkGroup;
    return mesh;
  };
  merge(head, skull, M.white, HEAD);
  merge(head, cere, M.cere, HEAD + 20);
  merge(head, darkLines, M.line);
  merge(head, eyeBalls, M.eye);
  merge(head, irises, M.iris);
  merge(head, glints, M.hi).layers.disable(INK_LAYER);
  for (const { leg, feet, claws } of legParts) {
    merge(leg, feet, M.foot, BODY + 10);
    merge(leg, claws, M.talon);
  }
  merge(body, [chestFur, shoulderFur], M.feather, BODY);
  merge(body, goldPlates, M.gold);
  merge(body, goldBits, M.gold);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // The head turns slightly toward its left-hand side, as if looking at the horizon in the distance; from the front the hook of the beak can be seen, and from three-quarters the whole face
  const HEAD_YAW = 0.2;

  // Anchors (for hooking into the game): head, eyes, mouth, shoulder (wing root), wing tips, crest tips, the sapphire on the chest; all empty groups, following the action
  const rig = {
    head: group(look, [0, 0.14, 0.07]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [0, -0.035, 0.2]),
      wingL: wings[0].sh,
      wingR: wings[1].sh,
      wingTipL: wings[0].tipA,
      wingTipR: wings[1].tipA,
      crest: group(crestG, [0, 0.16, -0.24]),
      gem: gemA,
    },
  };
  // Action weights (performances tween these values): beat is beating faster and harder (0-1), tuck is both wings folded onto the back against the body (diving, 0-1),
  // glide is the pose of gliding in circles (0-1), cry is the mouth open in a long cry (0-1)
  const act = { beat: 0, tuck: 0, glide: 0, cry: 0 };

  // ── Idle: hovering wingbeats. One beat takes BEAT seconds; the downstroke (strong, longer) spreads the wing flat from above the back and presses it forward and down,
  //    and on the upstroke the hand folds back at the wrist, the primaries on edge, and the wing is lifted back folded; the body is lifted after the downstroke and sinks on the upstroke,
  //    the head held steady and not swaying with it (a bird's head stabilization), the tail feathers and dangling feet swinging half a beat behind; there are also slow looking around, blinking and the gem glimmering faintly ──
  const BEAT = 1.0;
  // Phase offset: t = 1 (the time used for check screenshots) lands at the moment the downstroke has just begun, with both wings raised and spread
  const PH0 = 0.22;
  const DOWN = 0.55;
  const TOP = 1.1;
  const BOT = -0.7;
  const NECK_BACK = -PITCH - 0.06;
  const HIP = -1.3;
  const TAIL_X = -0.35;
  // Gliding pose: the body leans further forward to nearly level, the wings spread flat with a slight dihedral, no twist in the wing surface, the whole wing reaching slightly forward
  const GLIDE_PITCH = PI / 2 - PITCH - 0.08;
  const GLIDE_ELEV = 0.16;
  const GLIDE_TWIST = 0.0;
  const GLIDE_SWEEP = -0.08;
  // Wingbeat height: the downstroke and upstroke each use half a cosine, holding longer at the top (wings raised and spread) and turning quickly at the bottom
  const elevAt = (ph: number) => {
    const q = ((ph % 1) + 1) % 1;
    if (q < DOWN) return BOT + (TOP - BOT) * (0.5 + 0.5 * Math.cos(PI * Math.pow(q / DOWN, 1.15)));
    return BOT + (TOP - BOT) * (0.5 - 0.5 * Math.cos(PI * (q - DOWN) / (1 - DOWN)));
  };
  let blinkIn = 2.4;
  let blinkT = -1;
  let phase = PH0;
  const update = (t: number, dt: number) => {
    // Phase: when time is frozen (dt = 0) it is computed directly from t, and during playback it accumulates, so beating faster does not jump frames
    phase = dt > 0 ? phase + (dt / BEAT) * (1 + act.beat * 0.9) : t / BEAT + PH0;
    const ph = ((phase % 1) + 1) % 1;
    const amp = 1 + act.beat * 0.12;
    const dn = ph < DOWN;
    const k = dn ? ph / DOWN : (ph - DOWN) / (1 - DOWN);
    const elev = elevAt(ph);
    const up = dn ? 0 : Math.sin(PI * k);
    // When raised, the whole wing spreads forward, so the wing tips do not tuck in behind the head
    const high = ss((elev - BOT) / (TOP - BOT), 0.6, 1);
    const push = dn ? Math.sin(PI * k) : 0;
    // Twisting of the wing surface: at the top it flips open so the underside faces forward (the whole wing surface can be seen when raised), in the middle of the downstroke the leading edge presses down, and on the upstroke it slowly flips back
    const FLIP = 0.85;
    const twist = dn ? -FLIP * Math.pow(1 - k, 2.2) + 0.22 * push : -0.25 * up - FLIP * k * k;
    // The hand lags by half a beat: the hand's height is the wing's height from a little earlier, so on the downstroke the wing tip is dragged down still tilting up, and at the bottom it flings past and then catches up
    const lag = Math.max(-0.45, Math.min(0.45, (elevAt(ph - 0.07) - elev) * 0.9));
    // Wing tuck: the wings lifted onto the back, the whole wing drawn toward the tail, the hand folded all the way (the diving pose)
    const tk = act.tuck;
    const gl = act.glide;
    const cry = act.cry;
    const L = THREE.MathUtils.lerp;
    // Gliding: the wings stay at the flat, slight-dihedral position and the hand is fully open; tuck is then stacked on top of glide
    const flapK = 1 - gl;
    for (const r of wings) {
      const tw = L(twist, GLIDE_TWIST, gl);
      const el = L(elev * amp, GLIDE_ELEV, gl);
      const sw = L(0.18 * up - 0.06 * push - 0.22 * high, GLIDE_SWEEP, gl);
      r.wg.rotation.set(L(tw, 0.1, tk), r.sx * L(el, 0.35, tk), -r.sx * L(sw, 1.0, tk), 'YXZ');
      bendHand(r, L(0.9 * up * flapK, 1.2, tk), L(0.5 * up * flapK, 0.3, tk), lag * flapK * (1 - tk));
    }
    // Body: the downstroke lifts it, the highest point landing just as the downstroke ends, and it sinks on the upstroke; the forward lean nods slightly along.
    // When gliding the body is leveled (rotating about the center of gravity) and no longer bobs; in a long cry the chest thrusts back
    const lift = -Math.cos(2 * PI * (ph - 0.05)) * flapK;
    const nod = Math.sin(2 * PI * ph + 0.6) * 0.025 * flapK;
    const flat = gl * GLIDE_PITCH - cry * 0.16;
    fly.position.y = FLY_Y + lift * 0.035;
    pitchG.rotation.x = PITCH + nod + flat;
    const br = Math.sin(t * 1.3);
    torso.scale.set(1 + br * 0.01, 1 + br * 0.01, 1);
    // Head held steady: cancels the body's nodding, leveling and half of the bobbing; when gliding it looks down at prey, and in a long cry it tilts back
    neck.rotation.x = NECK_BACK - nod - flat + gl * 0.3;
    neck.position.y = 1.0 - lift * 0.015;
    look.rotation.y = (HEAD_YAW + Math.sin(t * 0.3) * 0.2 + Math.sin(t * 0.9) * 0.03) * (1 - Math.max(gl, cry) * 0.85);
    look.rotation.x = Math.sin(t * 0.47) * 0.03 - cry * 0.5;
    head.rotation.z = Math.sin(t * 0.3 + 0.7) * 0.04 * (1 - cry);
    jaw.rotation.x = cry * 0.8;
    for (const p of pupils) p.position.x = Math.sin(t * 0.3 - 0.5) * 0.003;
    // The tail feathers and feet lag half a beat; when gliding the feet are tucked under the tail and the tail feathers follow the body
    tailG.rotation.x = TAIL_X + Math.sin(2 * PI * ph - 1.2) * 0.06 * flapK - gl * 0.28;
    tailG.rotation.y = Math.sin(t * 0.8) * 0.04;
    for (let i = 0; i < hips.length; i++) hips[i].rotation.set(HIP + Math.sin(2 * PI * ph - 1.6) * 0.06 * flapK + gl * 1.15, 0, (i ? 1 : -1) * 0.06);
    // The crest flutters in the wingbeat's airflow; in a long cry it is raised
    crestG.rotation.x = Math.sin(2 * PI * ph - 0.8) * 0.05 + Math.sin(t * 2.9) * 0.015 + cry * 0.45;
    crestG.rotation.z = Math.sin(t * 1.1 + 0.5) * 0.03;

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
    // When the eyes close, the upper eyelid stops a little short of the lower eyelid, and the dark eyeline underneath exactly fills the gap, so it reads as a closed eye
    const shut = (UP_OPEN + LO_OPEN - 0.42) * close * (1 - cry);
    for (let i = 0; i < lids.length; i++) lids[i].rotation.x = -UP_OPEN + shut + (i % 2 ? 0.1 + 0.32 * close : 0);
    M.sapphire.emissiveIntensity = 0.55 + Math.sin(t * 1.3) * 0.08;
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0, 1.0, 0), radius: 1.15, rig, act };
}
