// Archive Owl (model lab version): the scribe of the forest folk's elders. It records every battle it has seen on its feathers, and when it molts a rain of letters falls over the whole treehouse.
// Nature and dark elements, specializing in "seeing through" and "sealing" (recording, quill-scribbling, sealing a scroll, letter rain, night reading).
// Only one form (decided by the user, 2026-09-28): the builder takes no breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on (from the name, lore and skill set):
//   1. A big cream facial disc ringed by a dark brown ruff, with a pair of big amber round eyes in the middle: the easiest owl face to recognize and the brightest patch on the body, still recognizable when shrunk very small.
//   2. Two tufts of ear feathers standing up and out from the top of the head, the feather tips moss green (the ancient tree, and the basic skill Moss Feather Shot): in silhouette it reads at a glance as an eared owl and not some other bird.
//   3. A quill tucked under the right ear tuft (the skill Quill Scribbling): the scribe keeps the pen behind its ear, the nib dipped in ink.
//   4. The feathers are covered in writing: the chest and belly are lines of dark purple ink script and the wings are lines of pale script ("it records every battle on its feathers"), reading from a distance as the owl's horizontal barring.
//   5. A thick book gripped under its feet: moss-green leather cover, brass corners, a plum-purple wax seal on the leather clasp at the fore-edge, and a faintly glowing leaf pattern floating on the wax (sealing and sealing a scroll).
// Body shape: an upright egg-shaped body, the head almost as wide as the body with no neck visible, the wings folded at the sides like a coat, showing only the script-covered chest and belly in the middle.
// It stands on the book and not on a branch: the book is its post, and its talons grip the fore-edge of the book. Kept distinct from Skyreign, which hovers in the sky above the same forest (blue and white, wings spread, long tail):
// the Archive Owl is a brown, folded-wing, short and stout upright silhouette with the weight low and two ear tufts on the head.
//
// Personality: a meticulous old scribe with a photographic memory. It stares at everything and writes everything down; it says nothing, but in its mind it has already written the annotation for your move.
// Expression: the big round eyes fully open and looking level at the opponent, the iris filling almost the whole eye; the pale brow feathers low on the inside and high on the outside, as if scrutinizing; the left brow a little higher than the right,
// the raised brow of "hm, I've noted that move"; the beak closed. When idle the head turns in jerks, now and then tilts to study something, and blinks slowly.
// Gaze order: the face (the cream disc framed by the ruff, the amber eyes, the black beak) first, the ear tufts and the quill behind the ear second, the script on the chest, the book under the feet and the wax seal third.
// Back: the back of the folded wings is also covered in script, the primaries cross over the tail, and the tail feathers rest on the spine of the book; the book's spine has three raised bands,
// and a plum-purple ribbon bookmark hangs from between the pages down to the ground; the quill behind the ear shows its whole vane from behind.
// Restrained light effects: no translucent mist shell and no scattered glowing dots; the only emissive is the leaf pattern on the wax seal, and spirits take no bloom.
//
// <Action table> (act weights: spread, wings spread to show the script on them, 0-1; fluff, all the body's feathers puffed up, 0-1; focus, stop turning the head and look straight ahead, 0-1)
//   Idle: stands on the book breathing, the head turning in jerks toward different places, now and then tilting to study something, blinking slowly; the ear tufts twitch now and then.
//   Move: talons gripping the book, it glides low across with the book, the head held steady.
//   Charge-up: ear tufts raised and wings half open (spread), the script on the wings facing the opponent, like an opened book.
//   Strike: one beat of the wings flings the recorded letters off the feathers (letter rain), or it pulls the quill from behind its ear (anchor quill) and writes a seal in the air.
//   Hit: all the feathers burst up (fluff), the talons still gripping the book, the eyes not closing.
//   Victory: wings folded, head tilted, one blink, like ticking a check mark on a page.
// Anchors: head, eyes, mouth (beak tip), quill (nib), seal (wax seal), book (front edge of the cover), tuftL / tuftR (ear tuft tips),
//       wingL / wingR (middle of the wing surface), tail (end of the tail feathers).
// Budget: R 35,000 faces, 50 meshes. The head, body and wings are parametric surface meshes of its own (the facial disc, ruff and brow ridge all grow on the same surface),
// the script is thin strips laid on the surface (normals taken from the surface itself, in the same outline group as what lies beneath, so no extra ring of line), and everything is finally merged with mergeStatic.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, smooth, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const C = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Palette ─────────────────────────

const BROWN = 0x6d4a35;
const BROWN_D = 0x4f3427;
const DARK = 0x33231f;
const MOSS = 0x86a04c;
const TAWNY = 0xd7ba8c;
const BIB = 0xecdcb9;
const CREAM = 0xf5e9cd;
const DISC_EDGE = 0xe4cda0;
const RUFF = 0x4a2e23;
const BROW = 0xfff8e8;
const INK = 0x3a2436;
const PALE = 0xe4cb97;
const LEAF = 0x4a6641;
const LEAF_D = 0x3a5234;
const BAND = 0x2f4229;
const PAGE = 0xe3d2aa;
const STRAP = 0x4d3226;
const WAX = 0x6e2f5c;
const TOE = 0x857a6a;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Piecewise sampling: each segment is [start, end, step], divided evenly within a segment with the endpoints always included (denser at seams, edges and color changes) */
function samples(ranges: [number, number, number][]): number[] {
  const out: number[] = [];
  for (const [a, b, step] of ranges) {
    const n = Math.max(1, Math.ceil((b - a) / step - 1e-9));
    for (let k = 0; k < n; k++) out.push(a + ((b - a) * k) / n);
  }
  out.push(ranges[ranges.length - 1][1]);
  return out;
}

/** Normal at a point on a parametric surface (central difference), pointing away from inside; a degenerate point (a pole) just uses the direction away from inside */
function surfNormal(f: (u: number, w: number) => THREE.Vector3, u: number, w: number, inside: THREE.Vector3): THREE.Vector3 {
  const e = 1e-4;
  const du = f(u + e, w).sub(f(u - e, w));
  const dw = f(u, w + e).sub(f(u, w - e));
  const n = new THREE.Vector3().crossVectors(du, dw);
  const out = f(u, w).sub(inside);
  if (n.lengthSq() < 1e-16) n.copy(out);
  n.normalize();
  if (n.dot(out) < 0) n.negate();
  return n;
}

/**
 * Mesh of a parametric surface: us and ws are the sample points (they may be unevenly spaced), f returns the position, and inside returns the interior reference point for that point (used to face normals outward).
 * The normals are the surface's own central differences, so script strips laid on top can use the same normals and the shading matches.
 */
function gridSurf(us: number[], ws: number[], f: (u: number, w: number) => THREE.Vector3, inside: (p: THREE.Vector3) => THREE.Vector3, color: (u: number, w: number, p: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  for (const w of ws)
    for (const u of us) {
      const p = f(u, w);
      const n = surfNormal(f, u, w, inside(p));
      const c = color(u, w, p);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      col.push(c.r, c.g, c.b);
    }
  const W = us.length;
  const idx: number[] = [];
  for (let j = 0; j < ws.length - 1; j++)
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i;
      idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
    }
  // Winding: the overall face normal must be on the same side as the vertex normals, and if reversed the whole thing is flipped
  let s = 0;
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const Cc = new THREE.Vector3();
  const fn = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    A.fromArray(pos, idx[i] * 3);
    B.fromArray(pos, idx[i + 1] * 3).sub(A);
    Cc.fromArray(pos, idx[i + 2] * 3).sub(A);
    fn.crossVectors(B, Cc);
    s += fn.x * nor[idx[i] * 3] + fn.y * nor[idx[i] * 3 + 1] + fn.z * nor[idx[i] * 3 + 2];
  }
  if (s < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/**
 * Script laid on a parametric surface: each stroke is a line in parameter space, widened by a half width on each side along the line and floated as a whole by lift;
 * the normals are the underlying surface's, so in the same outline group as what lies beneath there is only a clean color change and no extra ring of line. Both ends are closed to round heads.
 */
class Script {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  readonly f: (u: number, w: number) => THREE.Vector3;
  readonly inside: (p: THREE.Vector3) => THREE.Vector3;
  readonly lift: number;
  constructor(f: (u: number, w: number) => THREE.Vector3, inside: (p: THREE.Vector3) => THREE.Vector3, lift: number) {
    this.f = f;
    this.inside = inside;
    this.lift = lift;
  }
  add(line: (s: number) => [number, number], hw: number, color: THREE.Color, n = 8): void {
    const base = this.pos.length / 3;
    const e = 1e-3;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const [u, w] = line(s);
      const p = this.f(u, w);
      const nn = surfNormal(this.f, u, w, this.inside(p));
      const [u0, w0] = line(Math.max(0, s - e));
      const [u1, w1] = line(Math.min(1, s + e));
      const T = this.f(u1, w1).sub(this.f(u0, w0)).normalize();
      const side = new THREE.Vector3().crossVectors(nn, T).normalize();
      const half = hw * Math.pow(Math.sin(PI * s), 0.35);
      for (const k of [1, -1]) {
        const q = p.clone().addScaledVector(side, half * k).addScaledVector(nn, this.lift);
        this.pos.push(q.x, q.y, q.z);
        this.nor.push(nn.x, nn.y, nn.z);
        this.col.push(color.r, color.g, color.b);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 2;
      // Left, right, and the left of the next row down: face normal = (right − left) × (next row − left), which must be on the same side as the surface normal
      this.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    // Winding check: the face normal must be on the same side as the vertex normals, and if reversed the whole thing is flipped. Both ends of each stroke close to a point, so the first triangle is degenerate, hence the check looks at the sum over all triangles
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const D = new THREE.Vector3();
    const fn = new THREE.Vector3();
    let sum = 0;
    for (let i = 0; i < this.idx.length; i += 3) {
      A.fromArray(this.pos, this.idx[i] * 3);
      B.fromArray(this.pos, this.idx[i + 1] * 3).sub(A);
      D.fromArray(this.pos, this.idx[i + 2] * 3).sub(A);
      sum += fn.crossVectors(B, D).dot(D.fromArray(this.nor, this.idx[i] * 3));
    }
    const idx = this.idx.slice();
    if (sum < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    return g;
  }
}

interface SheetOpts {
  root: THREE.Vector3[];
  dir: (s: number) => THREE.Vector3;
  len: (s: number) => number;
  normal: (s: number) => THREE.Vector3;
  feather: (s: number) => number;
  notch: (s: number) => number;
  thick: (s: number, c: number) => number;
  bend?: (s: number, d: number) => number;
  groove?: number;
  pointy?: number;
  rachis?: number;
  color: (s: number, c: number, side: number) => THREE.Color;
  rows: number;
  cols: number;
}

/**
 * A feather surface joined into one sheet (the slimmed-down version of Skyreign's featherSheet): along the feather-root curve, each point grows a feather toward dir, the trailing edge cut into individual feather tips,
 * with grooves pressed in between feathers. The cross-section is a full ring, closing naturally as the thickness at both ends goes to 0; the whole sheet is one part, with lines falling only on the feather tips and grooves (pitfall 20).
 */
function featherSheet(o: SheetOpts): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(o.root, false, 'centripetal');
  const R = o.rows;
  const K = o.cols;
  const groove = o.groove ?? 0.3;
  const cs = Array.from({ length: K + 1 }, (_, k) => 1 - Math.pow(1 - k / K, 1.6));
  const J = 2 * K + 2;
  const pos: number[] = [];
  const colr: number[] = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= R; i++) {
    const s = i / R;
    path.getPointAt(s, P);
    const D = o.dir(s);
    const N = o.normal(s);
    const u = o.feather(s);
    const w = u - Math.floor(u);
    const tip = o.pointy ? Math.pow(1 - Math.abs(2 * w - 1), o.pointy) : Math.sqrt(Math.max(0, 1 - (2 * w - 1) ** 2));
    const L = o.len(s) * (1 - o.notch(s) * (1 - tip));
    const e = ss(s, 0, 0.04) * (1 - ss(s, 0.96, 1));
    for (let j = 0; j < J; j++) {
      const jj = j === J - 1 ? 0 : j;
      const k = jj <= K ? jj : 2 * K - jj;
      const c = cs[k];
      const side = jj < K ? -1 : jj > K ? 1 : 0;
      const own = c >= 1 ? 0 : o.thick(s, c) * (1 - groove * c * (1 - tip)) + (o.rachis ?? 0) * Math.exp(-(((w - 0.5) / 0.1) ** 2)) * (1 - c) * ss(c, 0.05, 0.2);
      const h = own * Math.sqrt(Math.max(0, 1 - Math.pow(c, 8))) * e;
      const b = o.bend ? o.bend(s, c * L) : 0;
      const off = b + side * h;
      pos.push(P.x + D.x * c * L + N.x * off, P.y + D.y * c * L + N.y * off, P.z + D.z * c * L + N.z * off);
      const cc = o.color(s, c, side === 0 ? 1 : side);
      colr.push(cc.r, cc.g, cc.b);
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
  // Winding check: the normal of the middle row at the middle of the belly face must face the belly side, and if reversed it is flipped (after mirroring left and right the winding is opposite)
  const mi = Math.floor(R / 2) * J + K + Math.floor(K / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, mi);
  if (nrm.dot(o.normal(0.5)) < 0) {
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

/** Apply vertex colors by vertex position (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}
const solid = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const cc = C(c);
  return paint(g, () => cc);
};

// ───────────────────────── Head: the facial disc, ruff and nose ridge grow on the same surface ─────────────────────────

const HR = 0.2;
const HS: [number, number, number] = [1.1, 0.96, 0.96];
/** Latitude and longitude of the eyes (centers of the facial discs) and the angular radius of the disc */
const EYE_LON = 0.46;
const EYE_LAT = 0.06;
const DISC = 0.6;
const dirOf = (lon: number, lat: number) => v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
const EYE_C = [dirOf(EYE_LON, EYE_LAT), dirOf(-EYE_LON, EYE_LAT)];
/** Smooth minimum: the two facial discs join at the nose ridge without a crease forming */
const smin = (a: number, b: number, k: number) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
};
const discAng = (d: THREE.Vector3) => smin(d.angleTo(EYE_C[0]), d.angleTo(EYE_C[1]), 0.12);
/** Multiplier of the skull radius: the disc dished inward, a ring of ruff raised at the outer edge, and a nose ridge between the two eyes */
function headR(lon: number, lat: number): number {
  const d = dirOf(lon, lat);
  const am = discAng(d);
  const x = am / DISC;
  const front = ss(d.z, -0.35, 0.1);
  const dish = 0.1 * (x < 1 ? (1 - x * x) ** 2 : 0);
  const ruff = 0.075 * Math.exp(-(((am - DISC * 1.03) / 0.08) ** 2)) * front;
  const ridge = 0.06 * Math.exp(-((lon / 0.12) ** 2)) * ss(lat, -0.28, -0.08) * (1 - ss(lat, 0.28, 0.48)) * front;
  return 1 - dish + ruff + ridge;
}
const headP = (lon: number, lat: number) => {
  const d = dirOf(lon, clamp(lat, -PI / 2, PI / 2));
  const m = HR * headR(lon, lat);
  return v(d.x * HS[0] * m, d.y * HS[1] * m, d.z * HS[2] * m);
};
const ORIGIN = v(0, 0, 0);
const headN = (lon: number, lat: number) => surfNormal(headP, lon, lat, ORIGIN);
function headColor(lon: number, lat: number): THREE.Color {
  const d = dirOf(lon, lat);
  const am = discAng(d);
  const front = ss(d.z, -0.35, 0.1);
  const inner = (1 - ss(am, DISC * 0.88, DISC * 0.95)) * front;
  const ring = (1 - ss(am, DISC * 1.12, DISC * 1.2)) * front;
  const c = C(BROWN).lerp(C(BROWN_D), ss(lat, 0.8, 1.2) * 0.5);
  c.lerp(C(RUFF), ring);
  c.lerp(C(CREAM).lerp(C(DISC_EDGE), ss(am, DISC * 0.45, DISC * 0.9)), inner);
  // Nose ridge: a pale stripe from between the eyes up to the forehead
  const mid = Math.exp(-((lon / 0.1) ** 2)) * ss(lat, -0.25, -0.05) * (1 - ss(lat, 0.3, 0.45)) * front;
  c.lerp(C(BROW), mid * 0.8);
  // Under the chin: a pale bib running from outside the ruff down to the chest
  c.lerp(C(BIB), ss(-lat, 0.6, 0.78) * ss(d.z, 0.15, 0.5) * (1 - inner));
  return c;
}

// ───────────────────────── Body: an upright egg ─────────────────────────

const Y0 = 0.152;
const Y1 = 0.95;
const BZ = 0.03;
/** t (0 bottom, 1 top) → [left-right radius, front-back radius, front-back offset] */
const bodyProf = curveTable([
  [0, 0, 0, 0.02],
  [0.05, 0.13, 0.12, 0.028],
  [0.14, 0.215, 0.195, 0.034],
  [0.3, 0.258, 0.232, 0.035],
  [0.46, 0.266, 0.236, 0.03],
  [0.6, 0.252, 0.222, 0.02],
  [0.74, 0.226, 0.194, 0.01],
  [0.87, 0.192, 0.162, 0],
  [0.95, 0.13, 0.11, -0.005],
  [1, 0, 0, -0.005],
]);
/** Body surface: th = 0 at +x, PI/2 directly in front, -PI/2 at the back */
const bodyP = (t: number, th: number) => {
  const tt = clamp(t, 0, 1);
  const [a, b, dz] = bodyProf(tt);
  return v(Math.cos(th) * a, Y0 + (Y1 - Y0) * tt, Math.sin(th) * b + dz + BZ);
};
const bodyAxis = (p: THREE.Vector3) => v(0, p.y, BZ + 0.02);
const bodyN = (t: number, th: number) => surfNormal(bodyP, t, th, bodyAxis(bodyP(t, th)));

// ───────────────────────── Wings: a coat folded at the sides, a shell with thickness lying against the body ─────────────────────────

/** a (0 shoulder, 1 wing tip) → height t on the body */
const wingTab = curveTable([[0, 0.93], [0.1, 0.87], [0.3, 0.72], [0.55, 0.52], [0.8, 0.33], [1, 0.21]]);
const wingT = (a: number) => wingTab(a)[0];
/** a → [center angle, half width]: b = 1 is the leading edge (toward the chest) and b = 0 is the trailing edge (at the back) */
const wingC = curveTable([[0, 0.08, 0.3], [0.1, 0.04, 0.82], [0.3, -0.1, 1.1], [0.55, -0.3, 1.14], [0.8, -0.5, 0.92], [1, -0.72, 0.5]]);
const wingTh = (a: number, b: number) => {
  const [c, hw] = wingC(clamp(a, 0, 1));
  return c + (b * 2 - 1) * hw;
};
/** Height of the shell above the body: a steeply raised round lip around the edge (so a line can be drawn against the body), slightly bulging in the middle */
const shellLift = (a: number, b: number) => {
  const aa = clamp(a, 0, 1);
  const bb = clamp(b, 0, 1);
  const hw = wingC(aa)[1];
  const ra = bodyProf(wingT(aa))[0];
  const dA = Math.min(aa, 1 - aa) * 0.72;
  const dB = Math.min(bb, 1 - bb) * 2 * hw * ra;
  const k = Math.sqrt(clamp(dA / 0.022, 0, 1)) * Math.sqrt(clamp(dB / 0.022, 0, 1));
  return -0.005 + (0.027 + 0.012 * Math.sin(PI * aa) * Math.sin(PI * bb)) * k;
};
const shellAt = (sx: number, a: number, b: number, lift: number) => {
  const t = wingT(clamp(a, 0, 1));
  const th = wingTh(a, b);
  const p = bodyP(t, th).addScaledVector(bodyN(t, th), lift);
  p.x *= sx;
  return p;
};

// ───────────────────────── Shape ─────────────────────────

export function buildOwlarchivistLab(): LabModel {
  const RIMC = 0xe9e2bf;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    feather: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    wing: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    lid: labToon(CREAM, { rim: 0.35, rimColor: RIMC }),
    eye: labToon(0x1b1418, { ramp: 'gem', rim: 0 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    beak: labToon(0x3b3431, { spec: 0.7, specTh: 0.975, rim: 0.35, rimColor: RIMC }),
    nib: labToon(0x2c2830, { ramp: 'metal', spec: 1.1, specTh: 0.93, rim: 0.4, rimColor: RIMC }),
    talon: labToon(0x2a2226, { spec: 0.9, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    book: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC })),
    brass: labToon(0xc99b45, { ramp: 'metal', spec: 1.3, specTh: 0.9, rim: 0.5, rimColor: 0xffe2a8 }),
    rune: labToon(0xf2d38c, { emissive: 0xffc45a, emissiveAmt: 0.55, rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  // With the wings open the inside of the shell can be seen
  M.wing.side = THREE.DoubleSide;
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'owlarchivist-lab';
  const { add, group } = partKit();
  const rand = rng(23);

  // Outline part indices: no lines between members of the same group
  const HEAD = 9501;
  const BODY = 9502;
  const WING = [9503, 9504];
  const PRIM = [9505, 9506];
  const TAIL = 9507;
  const LEG = 9508;
  const BEAK = 9509;
  const QUILL = 9510;
  const EYE = 9541;

  const place = group(root);
  const owl = group(place);

  // ── Book: lying flat on the ground, fore-edge forward and spine at the back. Moss-green leather top and bottom boards, three stacks of pages (the seams between stacks are the page lines), a round spine with three spine bands,
  //    four brass corners at the front, a leather clasp at the fore-edge carrying a plum-purple wax seal with a leaf pattern floating on it; a ribbon bookmark hangs from the right end ──
  const book = group(place);
  const bk = (geo: THREE.BufferGeometry, col: THREE.ColorRepresentation, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => add(book, solid(geo, col), M.book, pos, rot);
  bk(rbox(0.64, 0.024, 0.47, 0.009, 2), LEAF, [0, 0.012, 0]);
  bk(rbox(0.64, 0.024, 0.47, 0.009, 2), LEAF, [0, 0.138, 0]);
  for (let k = 0; k < 3; k++) bk(rbox(0.6 - k * 0.006, 0.034, 0.437, 0.006, 2), k === 1 ? 0xe9dab6 : PAGE, [0.002 * (k - 1), 0.041 + k * 0.034, 0.0035 - 0.002 * k]);
  bk(new THREE.CylinderGeometry(0.075, 0.075, 0.62, 18, 1), LEAF_D, [0, 0.075, -0.215], [0, 0, PI / 2]);
  // The rings of the spine bands are flattened a little top and bottom so they do not poke through the ground underneath
  for (const x of [-0.18, 0, 0.18]) bk(lathe([[0.072, -0.012], [0.081, -0.009], [0.085, 0], [0.081, 0.009], [0.072, 0.012]], 18).rotateZ(-PI / 2).scale(1, 0.87, 1), BAND, [x, 0.075, -0.215]);
  for (const sx of [-1, 1]) for (const y of [0.016, 0.136]) add(book, rbox(0.07, 0.034, 0.07, 0.01, 2), M.brass, [sx * 0.29, y, 0.205]);
  bk(rbox(0.07, 0.132, 0.012, 0.004, 2), STRAP, [0, 0.075, 0.232]);
  bk(rbox(0.07, 0.008, 0.085, 0.003, 2), STRAP, [0, 0.153, 0.195]);
  // Wax seal: a blob of wax with an irregular edge, a leaf pattern floating in the middle (the only emissive)
  const sealG = lathe([[0.0001, 0], [0.043, 0], [0.05, 0.006], [0.047, 0.013], [0.036, 0.018], [0.0001, 0.019]], 16).rotateX(PI / 2);
  {
    const pa = sealG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const y = pa.getY(i);
      const r = Math.hypot(x, y);
      if (r < 0.03) continue;
      const k = 1 + 0.07 * Math.sin(Math.atan2(y, x) * 5 + 0.7) + 0.04 * Math.sin(Math.atan2(y, x) * 3 - 0.4);
      pa.setXY(i, x * k, y * k);
    }
    sealG.computeVertexNormals();
  }
  const SEAL = v(0, 0.075, 0.238);
  bk(sealG, WAX, [SEAL.x, SEAL.y, SEAL.z]);
  const leaf = slab(outline([[0, 0.027], [0.011, 0.016], [0.015, 0.002], [0.011, -0.012], [0.004, -0.02], [0.0015, -0.028], [-0.0015, -0.028], [-0.004, -0.02], [-0.011, -0.012], [-0.015, 0.002], [-0.011, 0.016]]), 0.003, 0.0015, 4);
  add(book, leaf, M.rune, [SEAL.x, SEAL.y, SEAL.z + 0.02]);
  // Ribbon bookmark: comes out of the right end of the pages, goes around the edge of the bottom board and hangs to the ground, the end lying flat
  {
    const pts = [v(0.28, 0.083, -0.16), v(0.323, 0.08, -0.16), v(0.343, 0.045, -0.157), v(0.35, 0.008, -0.14), v(0.37, 0.0045, -0.105), v(0.405, 0.0045, -0.075)];
    bk(loft(pts, curveTable([[0, 0.016, 0.0035], [0.9, 0.016, 0.0035], [0.97, 0.012, 0.003], [1, 0, 0]]), { segs: 20, radial: 8, side: FWD }), 0x7a3266, [0, 0, 0]);
  }

  // ── Feet: fluffy short legs mostly hidden under the belly feathers, three toes gripping forward onto the top board, with the middle toe's talon hooked over the fore-edge of the book ──
  const FOOT_Y = 0.15;
  for (const sx of [-1, 1]) {
    const ft = v(sx * 0.095, FOOT_Y, 0.15);
    add(owl, solid(loft([v(sx * 0.085, 0.27, 0.085), v(sx * 0.09, 0.215, 0.125), v(ft.x, 0.168, ft.z)], curveTable([[0, 0, 0], [0.15, 0.04, 0.04], [0.7, 0.036, 0.034], [1, 0, 0]]), { segs: 10, radial: 10, side: X }), TAWNY), M.feather).userData.inkGroup = LEG;
    for (const [yaw, L] of [[-0.38, 0.058], [0, 0.07], [0.38, 0.058]] as [number, number][]) {
      const tg = group(owl, [ft.x, ft.y, ft.z], [0, yaw + sx * 0.12, 0]);
      add(tg, solid(loft([v(0, 0.013, -0.01), v(0, 0.015, L * 0.45), v(0, 0.012, L * 0.8), v(0, 0.008, L)], curveTable([[0, 0, 0], [0.12, 0.0135, 0.012], [0.7, 0.011, 0.01], [1, 0, 0]]), { segs: 8, radial: 8, side: X }), TOE), M.feather).userData.inkGroup = LEG;
      const tp = [v(0, 0.009, L * 0.9), v(0, 0.006, L + 0.014), v(0, -0.006, L + 0.024), v(0, -0.02, L + 0.024)];
      add(tg, loft(tp, (t) => {
        const k = Math.pow(1 - t, 0.8);
        return [0.0075 * k + 0.0005, 0.0075 * k + 0.0005];
      }, { segs: 8, radial: 6, side: X }), M.talon);
    }
  }

  // ── Body (breath handles breathing and the scale of puffed-up feathers): an egg-shaped body, the chest and belly pale yellow-brown, the sides and back brown, a pale bib under the chin ──
  const BP = v(0, 0.2, BZ);
  const breath = group(owl, [BP.x, BP.y, BP.z]);
  const bodyG = group(breath, [-BP.x, -BP.y, -BP.z]);
  {
    const ts = samples([[0, 0.12, 0.02], [0.12, 0.9, 0.032], [0.9, 1, 0.025]]);
    const ths = samples([[-PI / 2, PI * 1.5, PI / 22]]);
    const geo = gridSurf(ts, ths, bodyP, bodyAxis, (t, th) => {
      const f = Math.sin(th);
      const belly = ss(f, 0.2, 0.45);
      const c = C(BROWN).lerp(C(TAWNY), belly);
      c.lerp(C(BIB), belly * ss(t, 0.74, 0.8));
      return c.lerp(C(TAWNY), (1 - ss(t, 0.04, 0.12)) * 0.6);
    });
    add(bodyG, geo, M.feather).userData.inkGroup = BODY;
    // Lines of script on the chest and belly: dark purple ink, the strokes of varying length and slightly undulating, like handwriting; the sides stop short inside the leading edge of the wings
    const sc = new Script(bodyP, bodyAxis, 0.0015);
    const inkC = C(INK);
    const rows: [number, number][] = [[0.69, 0.36], [0.6, 0.46], [0.51, 0.54], [0.42, 0.6], [0.33, 0.62], [0.245, 0.58]];
    rows.forEach(([t0, span], r) => {
      let th = PI / 2 - span + rand() * 0.06;
      while (th < PI / 2 + span - 0.08) {
        const len = Math.min(0.1 + rand() * 0.2, PI / 2 + span - th);
        const a0 = th;
        const ph = rand() * 6;
        sc.add((s) => [t0 + 0.006 * Math.sin((a0 + len * s) * 11 + ph) + 0.004 * (s - 0.5), a0 + len * s], 0.0065 + 0.0015 * rand(), inkC, Math.max(4, Math.round(len / 0.028)));
        th += len + 0.05 + rand() * 0.05;
        if (r % 2 === 1 && rand() < 0.3) th += 0.04;
      }
    });
    add(bodyG, sc.build(), M.feather).userData.inkGroup = BODY;
  }

  // ── Wings: shells folded at the sides (the coat), the leading edge running from the shoulder all the way down to the flank, the two wings almost meeting at the back; the wing surface is covered in pale script,
  //    the lower half the darker color of the flight feathers; a primary feather projects from the lower end of the shell and crosses over the tail ──
  interface WingRig { sx: number; g: THREE.Group; mid: THREE.Group }
  const wings: WingRig[] = [];
  for (const sx of [1, -1]) {
    const i = sx > 0 ? 0 : 1;
    const piv = shellAt(sx, 0.08, 0.6, 0);
    const g = group(breath, [piv.x - BP.x, piv.y - BP.y, piv.z - BP.z]);
    const inner = group(g, [-piv.x, -piv.y, -piv.z]);
    const f = (a: number, b: number) => shellAt(sx, a, b, shellLift(a, b));
    const ins = (p: THREE.Vector3) => bodyAxis(p);
    const as = samples([[0, 0.04, 0.012], [0.04, 0.96, 0.034], [0.96, 1, 0.012]]);
    const bs = samples([[0, 0.06, 0.012], [0.06, 0.94, 0.03], [0.94, 1, 0.012]]);
    const geo = gridSurf(as, bs, f, ins, (a, b) => {
      const c = C(BROWN).lerp(C(BROWN_D), ss(a, 0.55, 0.75));
      // A slightly brighter edge along the leading edge (the wrist)
      return c.lerp(C(0x8a6246), ss(b, 0.9, 0.97) * (1 - ss(a, 0.6, 0.8)) * 0.6);
    });
    add(inner, geo, M.wing).userData.inkGroup = WING[i];
    // Script on the wings
    const sc = new Script(f, ins, 0.0015);
    const paleC = C(PALE);
    for (const a0 of [0.24, 0.37, 0.5, 0.63, 0.76, 0.87]) {
      let b = 0.14 + rand() * 0.06;
      const bEnd = a0 > 0.8 ? 0.7 : 0.84;
      while (b < bEnd - 0.05) {
        const len = Math.min(0.08 + rand() * 0.14, bEnd - b);
        const b0 = b;
        const ph = rand() * 6;
        sc.add((s) => [a0 + 0.008 * Math.sin((b0 + len * s) * 30 + ph), b0 + len * s], 0.0055 + 0.0015 * rand(), paleC, Math.max(4, Math.round(len / 0.03)));
        b += len + 0.04 + rand() * 0.04;
      }
    }
    add(inner, sc.build(), M.wing).userData.inkGroup = WING[i];
    // Primaries: coming out from under the lower end of the shell, going down, back and toward the body's midline, the tips crossing over the tail; dark brown base, pale crossbars, round-headed feather tips
    {
      const rootPts = [shellAt(sx, 0.62, 0.42, 0.006), shellAt(sx, 0.8, 0.36, 0.006), shellAt(sx, 0.98, 0.3, 0.006)];
      const dir = (s: number) => v(-sx * (0.5 + 0.12 * s), -0.58, -0.64).normalize();
      const Tr = rootPts[2].clone().sub(rootPts[0]).normalize();
      const nrm = (s: number) => {
        const n = new THREE.Vector3().crossVectors(Tr, dir(s)).normalize();
        return n.x * sx < 0 ? n.negate() : n;
      };
      const pg = featherSheet({
        root: rootPts,
        dir,
        normal: nrm,
        len: (s) => 0.14 + 0.1 * s,
        feather: (s) => s * 5,
        notch: () => 0.22,
        thick: (_s, c) => 0.01 * (0.35 + 0.65 * (1 - c)),
        bend: (_s, d) => -0.25 * d * d,
        rachis: 0.003,
        rows: 40,
        cols: 5,
        color: (_s, c) => C(BROWN_D).lerp(C(PALE), ss(Math.sin(c * PI * 4.2 - 0.6), 0.55, 0.8) * ss(c, 0.25, 0.35) * 0.7).lerp(C(DARK), ss(c, 0.9, 0.98) * 0.6),
      });
      add(inner, pg, M.wing).userData.inkGroup = PRIM[i];
    }
    const mid = group(inner);
    mid.position.copy(shellAt(sx, 0.45, 0.55, 0.035));
    wings.push({ sx, g, mid });
  }

  // ── Tail feathers: a short fan behind the lower end of the body, drooping backward with the end resting on the spine of the book; brown base with two pale tail bands and dark feather tips ──
  let tailA!: THREE.Group;
  {
    const rootPts = [-0.36, 0, 0.36].map((d) => bodyP(0.11, -PI / 2 + d).addScaledVector(bodyN(0.11, -PI / 2 + d), -0.012));
    const dir = (s: number) => v((s - 0.5) * 0.6, -0.5, -0.87).normalize();
    const nrm = (s: number) => new THREE.Vector3().crossVectors(dir(s), X).normalize().negate();
    const tg = featherSheet({
      root: rootPts,
      dir,
      normal: (s) => (nrm(s).y < 0 ? nrm(s).negate() : nrm(s)),
      len: (s) => 0.13 * (0.85 + 0.15 * Math.cos((s - 0.5) * PI)),
      feather: (s) => s * 6,
      notch: () => 0.14,
      thick: (_s, c) => 0.011 * (0.35 + 0.65 * (1 - c)),
      bend: (_s, d) => -0.35 * d * d,
      rows: 36,
      cols: 5,
      color: (_s, c) => C(BROWN).lerp(C(PALE), (ss(c, 0.38, 0.44) * (1 - ss(c, 0.52, 0.58)) + ss(c, 0.7, 0.76) * (1 - ss(c, 0.82, 0.88))) * 0.75).lerp(C(DARK), ss(c, 0.92, 0.99) * 0.5),
    });
    add(bodyG, tg, M.feather).userData.inkGroup = TAIL;
    const end = bodyP(0.11, -PI / 2).addScaledVector(dir(0.5), 0.13);
    tailA = group(bodyG, [end.x, end.y, end.z]);
  }

  // ── Head: look handles the jerky head turns, and head's origin is at the center of the skull and handles the head tilt ──
  const NECK = v(0, 0.82, 0.03);
  const HC = v(0, 0.975, 0.03);
  const look = group(owl, [NECK.x, NECK.y, NECK.z]);
  look.rotation.order = 'YXZ';
  const head = group(look, [HC.x - NECK.x, HC.y - NECK.y, HC.z - NECK.z]);
  {
    const lons = samples([[-PI, -1.3, 0.14], [-1.3, 1.3, 0.055], [1.3, PI, 0.14]]);
    const lats = samples([[-PI / 2, -0.8, 0.13], [-0.8, 0.95, 0.055], [0.95, PI / 2, 0.11]]);
    add(head, gridSurf(lons, lats, headP, () => ORIGIN, headColor), M.feather).userData.inkGroup = HEAD;
    // The back of the head also has a few lines of pale script: the back carries on with "recorded on the feathers", the strokes short and many, reading as a pattern and not arranged into a second face
    const sc = new Script(headP, () => ORIGIN, 0.0015);
    const paleC = C(PALE);
    for (const [la, span] of [[0.4, 0.55], [0.2, 0.8], [0.0, 0.9], [-0.2, 0.8]] as [number, number][]) {
      let lo = PI - span + rand() * 0.08;
      while (lo < PI + span - 0.06) {
        const len = Math.min(0.12 + rand() * 0.16, PI + span - lo);
        const l0 = lo;
        const ph = rand() * 6;
        sc.add((s) => [l0 + len * s, la + 0.02 * Math.sin((l0 + len * s) * 14 + ph)], 0.006 + 0.0015 * rand(), paleC, Math.max(4, Math.round(len / 0.04)));
        lo += len + 0.06 + rand() * 0.06;
      }
    }
    add(head, sc.build(), M.feather).userData.inkGroup = HEAD;
  }

  // Brow feathers: pale, a raised ridge growing on the skull, starting from above the nose ridge, low on the inside and high on the outside, arching up and sweeping back to the root of the ear tuft, not touching the upper lid (pitfall 47);
  // the left brow (+x) is raised a little higher, the look of scrutinizing the opponent
  for (const sx of [1, -1]) {
    const raise = sx > 0 ? 0.08 : 0;
    const pts = ([[0.1, 0.4], [0.24, 0.5 + raise * 0.5], [0.44, 0.57 + raise], [0.64, 0.61 + raise], [0.8, 0.64 + raise * 0.6]] as [number, number][]).map(([lo, la]) => headP(sx * lo, la).addScaledVector(headN(sx * lo, la), 0.002));
    const geo = loft(pts, (t) => {
      const k = Math.pow(Math.sin(PI * t), 0.5) * ss(t, 0, 0.25);
      return [0.0155 * k + 0.0008, 0.0085 * k + 0.0008];
    }, { segs: 16, radial: 8, up: FWD });
    add(head, solid(geo, BROW), M.feather).userData.inkGroup = HEAD;
  }

  // Beak: a short black beak hooking downward, growing from under the nose ridge, mostly wrapped in the feathers of the disc
  const BEAK_TIP = v(0, -0.06, 0.228);
  add(head, loft([v(0, 0.03, 0.165), v(0, 0.012, 0.203), v(0, -0.013, 0.226), v(0, -0.04, 0.235), v(0, -0.064, 0.225)], curveTable([[0, 0, 0], [0.08, 0.026, 0.026], [0.35, 0.022, 0.022], [0.7, 0.012, 0.013], [1, 0, 0]]), { segs: 16, radial: 12, side: X }), M.beak).userData.inkGroup = BEAK;

  // Eyes: big eyes half set into the center of the facial disc, the eyeball dark (a ring of dark shows between the lid and the iris, which is the owl's eye ring),
  // the amber iris filling almost all of it, a big pupil, two highlights; the iris and pupil are wrapped in a gaze group to look forward (pitfall 43); the cream eyelids are the same color as the disc
  const ER = 0.066;
  const eyeA: THREE.Group[] = [];
  const lids: { up: THREE.Group; lo: THREE.Group }[] = [];
  const his: THREE.Mesh[] = [];
  const UP_OPEN = 1.02;
  const LO_OPEN = 0.98;
  const lidUp = lidLow(ER + 0.003, ER + 0.009, PI / 2);
  const lidLo = lidLow(ER + 0.003, ER + 0.008, PI / 2);
  const irisGeo = paint(capLow(ER + 0.0008, 0.84, 22, 5), (p) => C(0xe07a16).lerp(C(0xffc444), 1 - ss(Math.hypot(p.x, p.y) / ER, 0.42, 0.72)));
  const pupilGeo = solid(capLow(ER + 0.0016, 0.46, 18, 3), 0x140d10);
  for (const sx of [1, -1]) {
    const lon = sx * EYE_LON;
    const p = headP(lon, EYE_LAT);
    const c = p.clone().addScaledVector(p.clone().normalize(), -0.5 * ER);
    const eg = group(head, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, v(sx * 0.36, 0.06, 0.93).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.1]);
    add(roll, new THREE.SphereGeometry(ER, 18, 12), M.eye).userData.inkGroup = EYE;
    const want = v(0, 0.04, 1).normalize().applyQuaternion(eg.quaternion.clone().multiply(roll.quaternion).invert());
    const gq = new THREE.Quaternion().setFromUnitVectors(FWD, want);
    const ang = 2 * Math.acos(clamp(gq.w, -1, 1));
    const gaze = group(roll);
    gaze.quaternion.copy(new THREE.Quaternion().slerp(gq, Math.min(1, 0.5 / Math.max(ang, 1e-4))));
    add(gaze, irisGeo, M.iris).userData.inkGroup = EYE;
    add(gaze, pupilGeo, M.iris).userData.inkGroup = EYE;
    for (const [x, y, r] of [[-0.36, 0.38, 0.27], [0.33, -0.33, 0.12]] as [number, number, number][]) {
      const hd = v(x, y, 1).normalize();
      const hl = add(gaze, new THREE.SphereGeometry(r * ER, 8, 5), M.hi, [hd.x * ER * 1.01, hd.y * ER * 1.01, hd.z * ER * 1.01], [0, 0, 0], [1, 1, 0.45]);
      hl.quaternion.setFromUnitVectors(FWD, hd);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      his.push(hl);
    }
    eyeA.push(group(gaze, [0, 0, ER]));
    const lidG = group(roll);
    lidG.quaternion.copy(new THREE.Quaternion().slerp(gaze.quaternion, 0.6));
    const up = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(up, lidUp, M.lid).userData.inkGroup = HEAD;
    const lo = group(lidG, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lo, lidLo, M.lid).userData.inkGroup = HEAD;
    lids.push({ up, lo });
  }

  // Ear tufts: two clumps of pointed feathers standing up and out from the outer sides of the top of the head (three feathers each, the middle one longest), the roots buried in the skull; brown at the back, pale yellow-brown at the front, the tips moss green
  const tufts: { g: THREE.Group; tip: THREE.Group }[] = [];
  for (const sx of [1, -1]) {
    const rp = ([[0.66, 0.78], [0.8, 0.73], [0.96, 0.64]] as [number, number][]).map(([lo, la]) => headP(sx * lo, la).addScaledVector(headN(sx * lo, la), -0.012));
    const pv = rp[1].clone();
    const g = group(head, [pv.x, pv.y, pv.z]);
    const dir = (s: number) => v(sx * (0.3 + 0.2 * s), 0.92, -0.2 - 0.2 * s).normalize();
    const Tr = rp[2].clone().sub(rp[0]).normalize();
    const nrm = (s: number) => {
      const n = new THREE.Vector3().crossVectors(Tr, dir(s)).normalize();
      return n.z < 0 ? n.negate() : n;
    };
    const len = (s: number) => 0.205 * (0.76 + 0.24 * Math.cos((s - 0.35) * PI));
    const geo = featherSheet({
      root: rp.map((q) => q.clone().sub(pv)),
      dir,
      normal: nrm,
      len,
      feather: (s) => s * 3,
      notch: () => 0.58,
      pointy: 0.7,
      thick: (_s, c) => 0.019 * (0.3 + 0.7 * (1 - c)),
      bend: (_s, d) => -0.45 * d * d,
      rows: 30,
      cols: 5,
      color: (_s, c, side) => (side > 0 ? C(TAWNY).lerp(C(BROWN), ss(c, 0.15, 0.45)) : C(BROWN)).lerp(C(MOSS), ss(c, 0.66, 0.8)),
    });
    add(g, geo, M.feather).userData.inkGroup = HEAD;
    const tipP = rp[1].clone().addScaledVector(dir(0.4), len(0.4) * 0.95).sub(pv);
    tufts.push({ g, tip: group(g, [tipP.x, tipP.y, tipP.z]) });
  }

  // Quill: tucked under the right ear tuft (-x), resting on a point on the side of the skull (the pen is tangent at that point and the rest is all outside the head),
  // the nib pointing forward and down to beside the temple, dipped in ink; the vane of the rear section extends back and up out of the head
  let quillTip!: THREE.Group;
  {
    const lon = -1.25;
    const lat = 0.5;
    const qn = headN(lon, lat);
    const QC = headP(lon, lat).addScaledVector(qn, 0.012);
    const want = v(-0.1, 0.3, -0.95).normalize();
    const dq = want.clone().addScaledVector(qn, -want.dot(qn)).normalize();
    const L = 0.44;
    const P0 = QC.clone().addScaledVector(dq, -0.1);
    const at = (s: number) => P0.clone().addScaledVector(dq, s);
    const side = new THREE.Vector3().crossVectors(qn, dq).normalize();
    // Nib: a black metal cone, the rear end tucked into the shaft
    add(head, loft([at(0), at(0.02), at(0.045), at(0.058)], curveTable([[0, 0, 0], [0.25, 0.0042, 0.0032], [0.8, 0.0095, 0.0095], [1, 0, 0]]), { segs: 8, radial: 8, side }), M.nib).userData.inkGroup = QUILL;
    // Shaft: ivory, the section near the nib dipped in ink
    const shaft = loft([at(0.045), at(0.2), at(L - 0.01)], curveTable([[0, 0, 0], [0.02, 0.0078, 0.0078], [0.9, 0.0068, 0.0068], [1, 0, 0]]), { segs: 20, radial: 8, side });
    add(head, paint(shaft, (p) => C(0xf1e8d2).lerp(C(INK), 1 - ss(p.clone().sub(P0).dot(dq), 0.06, 0.085))), M.feather).userData.inkGroup = QUILL;
    // Vane: a long feather half facing forward and half facing outward, the shaft running through the middle; ivory white with a touch of gray-brown at the end
    const vn0 = v(-0.65, 0.25, 0.7).normalize();
    const vn = vn0.addScaledVector(dq, -vn0.dot(dq)).normalize();
    const wd = new THREE.Vector3().crossVectors(vn, dq).normalize();
    const V0 = at(0.17);
    const V1 = at(L - 0.004);
    const Vm = V0.clone().lerp(V1, 0.5).addScaledVector(vn, 0.008);
    const vane = loft([V0, Vm, V1], curveTable([[0, 0, 0], [0.07, 0.019, 0.0042], [0.35, 0.029, 0.0045], [0.8, 0.025, 0.004], [0.95, 0.013, 0.003], [1, 0, 0]]), { segs: 22, radial: 10, side: wd });
    add(head, paint(vane, (p) => C(0xeadfc4).lerp(C(0xb9a88a), ss(p.clone().sub(P0).dot(dq), 0.35, 0.42))), M.feather).userData.inkGroup = QUILL;
    quillTip = group(head, [P0.x, P0.y, P0.z]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const rig = {
    head: group(head, [0, -0.01, 0.13]),
    eyes: eyeA,
    anchors: {
      mouth: group(head, [BEAK_TIP.x, BEAK_TIP.y, BEAK_TIP.z]),
      quill: quillTip,
      seal: group(book, [SEAL.x, SEAL.y, SEAL.z + 0.022]),
      book: group(book, [0, 0.16, 0.2]),
      tuftL: tufts[0].tip,
      tuftR: tufts[1].tip,
      wingL: wings[0].mid,
      wingR: wings[1].mid,
      tail: tailA,
    },
  };
  const act = { spread: 0, fluff: 0, focus: 0 };

  // Static parts merged (mesh budget R 50): moving nodes act as owners, and the eye highlights (switched on and off when blinking) are not merged
  mergeStatic(root, {
    owners: [breath, look, head, ...wings.map((w) => w.g), ...tufts.map((t) => t.g), ...lids.flatMap((l) => [l.up, l.lo])],
    keep: [...his],
    rig,
  });

  // ── Idle: breathing; the head turns in jerks toward different places (owls turn the head fast and hold it long), now and then tilting to study something; slow blinks; the ear tufts twitch now and then.
  //    All computed from t, so frame-by-frame screenshots at frozen time are consistent too (pitfall 80) ──
  const LOOKS = [0, 0.34, 0.1, -0.3, -0.04, 0.42, -0.18];
  const TILTS = [0, 0, 0.2, 0, -0.15, 0, 0.12];
  const seq = (arr: number[], t: number, slot: number, a: number, b: number) => {
    const u = t / slot;
    const i = Math.floor(u);
    const f = u - i;
    const n = arr.length;
    return lerp(arr[((i % n) + n) % n], arr[(((i + 1) % n) + n) % n], ss(f, a, b));
  };
  const BLINK = 4.3;
  const update = (t: number) => {
    const sp = act.spread;
    const fl = act.fluff;
    const fo = act.focus;
    const br = Math.sin(t * 1.4);
    breath.scale.set(1 + br * 0.01 + fl * 0.06, 1 + br * 0.004 + fl * 0.03, 1 + br * 0.012 + fl * 0.06);
    look.rotation.y = seq(LOOKS, t, 1.9, 0.84, 0.93) * (1 - fo);
    look.rotation.x = Math.sin(t * 0.7) * 0.015 - fl * 0.04;
    head.rotation.z = seq(TILTS, t + 0.7, 2.5, 0.55, 0.85) * (1 - fo);
    for (const w of wings) w.g.rotation.set(0, w.sx * sp * 0.25, w.sx * (sp * 0.55 + fl * 0.06 + br * 0.006));
    const tk = (t % 5.3) / 0.35;
    const flick = tk < 1 ? Math.sin(tk * PI) : 0;
    for (const tf of tufts) tf.g.rotation.x = -0.14 * flick - fl * 0.2 - sp * 0.12;

    // Blink: the upper and lower lids close together toward the midline (pitfall 46); the highlights are hidden once it is more than half closed
    const bt = ((t + 0.9) % BLINK) / 0.28;
    const close = bt < 1 ? Math.min(1, Math.sin(bt * PI) * 1.3) : 0;
    for (const l of lids) {
      l.up.rotation.x = -UP_OPEN + (UP_OPEN - 0.16) * close;
      l.lo.rotation.x = PI + LO_OPEN - (LO_OPEN - 0.16) * close;
    }
    for (const h of his) h.visible = close < 0.6;
  };
  update(1);

  // Move the whole bird onto the pivot: the x and z center of the bounding box is placed at the origin, so the side and back views are not cropped (pitfall 66)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const mid = box.getCenter(new THREE.Vector3());
  // Left and right are judged by the bird (the ribbon bookmark is only on the right, and must not pull the pivot off)
  place.position.set(0, 0, -mid.z);
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
