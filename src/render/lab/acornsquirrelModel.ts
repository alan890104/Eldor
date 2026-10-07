// Grove Hoarder (model lab version): in autumn it buries seeds all over the Verdantwhisper Forest, and always forgets where it put them;
// the forest folk say half the giant trees in the forest grew from snacks it forgot. Nature element, N, positioned for sustained fighting and wish-making (trait "Hoarding": eating the stored fruit restores health).
// Only one form (decided by the user, 2026-09-28): the builder takes no evolution stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features (from the name, lore and the skill set "Pinecone Toss, Bury Fruit, Nut Shell, Hoarding Charge, Grow a Forest"):
// 1. A fluffy tail bigger than the body: curling up from the rump along the back, with the tip folding backward behind and to the right of the head. The tail is offset to the right side of the body,
//    so from the front a whole sheet of tail fur shows up from behind the right shoulder, and the front and back silhouettes are asymmetric as a result. The fur is one continuous surface,
//    its two side edges cut into clumps of fur tips sweeping toward the tail tip (a herringbone pattern), the tips bright and the roots dark, with no separate fur tufts.
// 2. A big acorn held to the chest in both hands: the one it treasures most and the only one it has not forgotten. The nut is a glossy golden brown, and the cupule is a dark brown bowl built of overlapping scales.
// 3. Cream cheeks bulging with stuffed fruit and two exposed incisors: the face of a hoarder, still recognizable as a squirrel when shrunk.
// 4. A dark tuft of fur at each ear tip (the red squirrel's ear tufts): two outward-flicking points on the silhouette at the top of the head.
// 5. Big, shiny black eyes with a cream ring around them.
// Body shape: a squirrel's sitting pose. The rump and two thick hind legs sit on the ground, the long hind feet lying flat forward along the ground; the body is like a pear, narrow at the top and wide at the bottom, leaning slightly forward;
// a big head (cartoon proportions, about a third of the height) sitting directly on the shoulders. The forelegs are short, holding the acorn against the belly.
// The body and head are each one whole smooth distance field (rump, belly, chest, neck; skull, cheeks, muzzle, chin), with no seams from joining parts.
//
// Personality: a cheerful little steward, busy hoarding and forgetting the moment it turns around. Always scanning for the next fruit, and immensely proud of the one in its arms.
// Expression: the eyes wide open looking straight ahead, the outer corners tilting up slightly, two highlights; the cheeks pushed up round, the mouth an upturned ω, the incisors showing.
// No drooping eyes, no downward look, no eye bags.
// Gaze order: the face (the cream muzzle and cheeks, the shiny big eyes with white highlights, the incisors) first, the big golden-brown acorn on the chest second,
// the big tail curling up on the right and the ear tufts as support.
// Back: two acorns it has itself forgotten are wedged in the fur on the back of the tail, and the one near the tail tip has sprouted, putting out a small stem and three oak leaves:
// this is how half the giant trees in the forest grew.
// Restrained light effects: no emissive and no reliance on bloom; only the two highlights in the eyes.
//
// Action table (battle actions and the ultimate follow this table):
// - Idle: sits holding the acorn, the head turning left and right in jerks (a squirrel's quick head turns), the nose twitching, the ear tufts flicking now and then, blinking;
//         the tail slowly swaying left and right, with the little sprout at the tail tip swaying along.
// - Move: hops along, the tail following behind like a wave, the acorn held tight.
// - Charge-up: brings the acorn up to the mouth (act.nibble) and the tail bursts out (act.puff).
// - Strike: Pinecone Toss, thrown from the front paws (anchor paws); Hoarding Charge rushes in with the head pushing the acorn.
// - Hit: the tail bursts out, the shoulders hunch and the acorn is held tighter, the eyes do not close, and it pokes its head up to look around again right away.
// - Victory: takes a bite of the acorn it holds (act.nibble), the cheeks bulging more, flicks the tail once, no cheering.
// Action weights (act, 0-1; all 0 is idle): focus (stop looking around, look straight ahead), nibble (bring the acorn to the mouth), puff (tail bursts out).
// Anchors: rig.head (center of the face), rig.eyes (the surfaces of the two eyes), anchors.mouth (the incisors), anchors.acorn (center of the acorn in its arms),
// anchors.paws (between the two front paws, the release point for throwing the nut), anchors.tail (the highest point of the tail), anchors.tailTip (the tail tip),
// anchors.sprout (top of the oak sapling sprouting on the tail), anchors.stash (the other hidden acorn in the tail).
// Face count and mesh budget (N: 25,000 faces, 40 meshes): the head and body use medium-subdivision distance-field meshes with vertices concentrated toward the face; the eyelids, pupils and mouth all use low-segment versions;
// the two small acorns on the tail use low-segment geometry; finally mergeStatic merges the static parts.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, loft, mergeStatic, outline, partKit, PI, rbox, slab, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const X = v3(1, 0, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Distance-field body ─────────────────────────

interface Ell {
  c: THREE.Vector3;
  r: THREE.Vector3;
  inv: THREE.Quaternion;
  k: number;
}

/** A smooth union of a few rotated ellipsoids; f < 0 is inside. Used to grow a seamless body and head, and to find points and normals on the surface */
class Blob {
  parts: Ell[] = [];
  private l = new THREE.Vector3();
  private q = new THREE.Vector3();
  add(c: THREE.Vector3, r: THREE.Vector3, q = new THREE.Quaternion(), k = 0.08): void {
    this.parts.push({ c: c.clone(), r: r.clone(), inv: q.clone().invert(), k });
  }
  f(p: THREE.Vector3): number {
    let d = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const e = this.parts[i];
      const l = this.l.copy(p).sub(e.c).applyQuaternion(e.inv);
      const ax = l.x / e.r.x;
      const ay = l.y / e.r.y;
      const az = l.z / e.r.z;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax / e.r.x;
      const by = ay / e.r.y;
      const bz = az / e.r.z;
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      const di = k1 < 1e-9 ? -Math.min(e.r.x, e.r.y, e.r.z) : (k0 * (k0 - 1)) / k1;
      if (i === 0) d = di;
      else {
        const h = Math.max(e.k - Math.abs(d - di), 0) / e.k;
        d = Math.min(d, di) - h * h * e.k * 0.25;
      }
    }
    return d;
  }
  grad(p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    const h = 4e-4;
    const q = this.q;
    const dx = this.f(q.copy(p).setX(p.x + h)) - this.f(q.copy(p).setX(p.x - h));
    const dy = this.f(q.copy(p).setY(p.y + h)) - this.f(q.copy(p).setY(p.y - h));
    const dz = this.f(q.copy(p).setZ(p.z + h)) - this.f(q.copy(p).setZ(p.z - h));
    return out.set(dx, dy, dz).normalize();
  }
  /** Walk outward from o inside the body along d to the surface */
  march(o: THREE.Vector3, d: THREE.Vector3, tmax = 2): THREE.Vector3 {
    const q = new THREE.Vector3();
    let t = 0;
    let fv = this.f(o);
    while (t < tmax) {
      const t1 = t + clamp(Math.abs(fv) * 0.6, 0.002, 0.03);
      const f1 = this.f(q.copy(o).addScaledVector(d, t1));
      if (f1 > 0) {
        let a = t;
        let b = t1;
        for (let i = 0; i < 16; i++) {
          const m = (a + b) / 2;
          if (this.f(q.copy(o).addScaledVector(d, m)) > 0) b = m;
          else a = m;
        }
        return o.clone().addScaledVector(d, (a + b) / 2);
      }
      t = t1;
      fv = f1;
    }
    return o.clone().addScaledVector(d, tmax);
  }
  /** Find the surface from o along d: position and normal */
  hit(o: THREE.Vector3, d: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } {
    const p = this.march(o, d.clone().normalize());
    return { p, n: this.grad(p) };
  }
}

/**
 * Wrap a distance field into a mesh: each vertex on a sphere is shot outward from center to the surface, the normals come from the distance field's gradient, and the color is decided by paint.
 * The vertex directions are first squeezed toward focus (the angle θ from focus becomes θ - pull·sin θ), so the mesh is denser on the face than on the back of the head.
 */
function blobGeo(blob: Blob, center: THREE.Vector3, detail: number, focus: THREE.Vector3, pull: number, paint: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(1, detail);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const g = mergeVertices(base, 1e-5);
  const pa = g.attributes.position as THREE.BufferAttribute;
  const nor = new Float32Array(pa.count * 3);
  const cl = new Float32Array(pa.count * 3);
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  const h = focus.clone().normalize();
  const side = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    d.fromBufferAttribute(pa, i).normalize();
    const th = Math.acos(clamp(d.dot(h), -1, 1));
    if (th > 1e-4 && th < PI - 1e-4) {
      side.copy(d).addScaledVector(h, -Math.cos(th)).normalize();
      const t2 = th - pull * Math.sin(th);
      d.copy(h).multiplyScalar(Math.cos(t2)).addScaledVector(side, Math.sin(t2));
    }
    const p = blob.march(center, d);
    blob.grad(p, n);
    pa.setXYZ(i, p.x, p.y, p.z);
    nor.set([n.x, n.y, n.z], i * 3);
    const c = paint(p, n);
    cl.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────── Geometry helpers ─────────────────────────

/** Grid surface: rows × cols points */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  let hasCol = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      pos.push(p.x, p.y, p.z);
      if (c) hasCol = true;
      const cc = c ?? new THREE.Color(1, 1, 1);
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
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  return g;
}

/** Merge duplicate vertices (seams, closures) and then compute smooth normals; the zero-area triangles left by the ring that closes to a point are filtered out (pitfall 85) */
function finish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = mergeVertices(g, 1e-6);
  const idx = m.index!.array;
  const keep: number[] = [];
  for (let i = 0; i < idx.length; i += 3) if (idx[i] !== idx[i + 1] && idx[i + 1] !== idx[i + 2] && idx[i] !== idx[i + 2]) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  m.setIndex(keep);
  m.computeVertexNormals();
  return m;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

type Sec = (t: number, th: number) => [number, number];

/**
 * Loft along a curve: sec(t, θ) returns the [width direction, height direction] coordinates on the cross-section. The width direction is held toward side (with the tangent component removed),
 * and the height direction = width × tangent (same as loft in shapes.ts, with the winding always facing outward). paint(t, θ) gives the vertex color.
 */
function sweep(pts: THREE.Vector3[], sec: Sec, o: { segs: number; radial: number; side: THREE.Vector3; paint?: (t: number, th: number) => THREE.Color }): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  const g = gridGeo(o.segs + 1, o.radial + 1, (i, j) => {
    const t = i / o.segs;
    path.getPointAt(t, C);
    path.getTangentAt(t, T);
    W.copy(o.side).addScaledVector(T, -T.dot(o.side)).normalize();
    H.crossVectors(W, T).normalize();
    const th = ((j % o.radial) / o.radial) * PI * 2;
    const [x, y] = sec(t, th);
    return { p: C.clone().addScaledVector(W, x).addScaledVector(H, y), c: o.paint?.(t, th) };
  });
  return finish(g);
}

/** Spherical-texture outline of an ellipse: longitude radius rx, latitude radius ry (radians), the center shifted up by dy */
function ellipsePts(rx: number, ry: number, dy = 0, n = 16): [number, number][] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * PI * 2) * rx, Math.sin((i / n) * PI * 2) * ry + dy] as [number, number]);
}

/** A planar figure on a sphere (iris, pupil): projected onto a sphere of radius r, with a selectable subdivision count so the face count can be kept down */
function lightDecal(pts: [number, number][], r: number, levels = 2): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const flat = new THREE.ShapeGeometry(s, 1).toNonIndexed();
  const src = flat.attributes.position as THREE.BufferAttribute;
  let tris: [number, number][][] = [];
  for (let i = 0; i < src.count; i += 3) tris.push([0, 1, 2].map((k) => [src.getX(i + k), src.getY(i + k)] as [number, number]));
  for (let l = 0; l < levels; l++) {
    const next: [number, number][][] = [];
    for (const [a, b, c] of tris) {
      const m = (u: [number, number], w: [number, number]): [number, number] => [(u[0] + w[0]) / 2, (u[1] + w[1]) / 2];
      const ab = m(a, b);
      const bc = m(b, c);
      const ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }
  const pos: number[] = [];
  const nor: number[] = [];
  for (const t of tris)
    for (const [lon, lat] of t) {
      const x = Math.cos(lat) * Math.sin(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon);
      pos.push(x * r, y * r, z * r);
      nor.push(x, y, z);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/**
 * Eyelid shell (same as lidGeometry in shapes.ts: +y as the top, covering to the lip angle, the edge a round lip),
 * making only the arc that can be seen: when front is true it is centered on +z, otherwise on -z (the lower eyelid is turned half a turn about x, which swaps front and back).
 */
function lidLite(ri: number, ro: number, lip: number, front: boolean, arc = PI * 1.15, segs = 12): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const N = 5;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * lip;
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
  for (let i = N; i >= 0; i--) {
    const a = (i / N) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  const g = new THREE.LatheGeometry(prof, segs, (front ? 0 : PI) - arc / 2, arc);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/**
 * A surface of revolution about the y axis (the acorn's nut and cupule): f(u, θ) returns [radius, height, color], with u along the cross-section and θ around;
 * the last column connects back to the first with no seam; rows at the head and tail with radius 0 close to a point.
 */
function revolve(rows: number, cols: number, f: (u: number, th: number) => [number, number, THREE.Color]): THREE.BufferGeometry {
  const g = gridGeo(rows + 1, cols + 1, (i, j) => {
    const th = ((j % cols) / cols) * PI * 2;
    const [r, y, c] = f(i / rows, th);
    return { p: v3(Math.sin(th) * r, y, Math.cos(th) * r), c };
  });
  const m = finish(g);
  // Winding: the normal of the middle row must point away from the y axis, and if reversed the whole thing is flipped
  const pa = m.attributes.position as THREE.BufferAttribute;
  const na = m.attributes.normal as THREE.BufferAttribute;
  let s = 0;
  for (let i = 0; i < pa.count; i++) s += pa.getX(i) * na.getX(i) + pa.getZ(i) * na.getZ(i);
  if (s < 0) {
    const idx = Array.from(m.index!.array);
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    m.setIndex(idx);
    m.computeVertexNormals();
  }
  return m;
}

/** Make the group's +y point along yDir and its +z toward zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// ───────────────────────── Acorn ─────────────────────────

const NUT_A = col(0xe0a452);
const NUT_B = col(0xb87632);
const NUT_TIP = col(0x7a4a22);
const NUT_BAND = col(0xf0c47a);
const CUP_A = col(0x7a5230);
const CUP_B = col(0xa87a4a);
const CUP_GAP = col(0x4e321c);

/** The acorn's nut: a small point at the bottom end, the widest point in the middle, the top covered by the cupule; the color shifts gradually from dark brown at the tip to golden brown, a ring of pale color at the lower edge of the cupule, plus a few faint longitudinal streaks */
function nutGeo(rows: number, cols: number): THREE.BufferGeometry {
  const prof = curveTable([
    [0, 0, -0.128],
    [0.06, 0.012, -0.122],
    [0.14, 0.03, -0.112],
    [0.3, 0.062, -0.084],
    [0.5, 0.083, -0.036],
    [0.68, 0.088, 0.01],
    [0.84, 0.082, 0.045],
    [1, 0.074, 0.062],
  ]);
  return revolve(rows, cols, (u, th) => {
    const [r, y] = prof(u);
    const stripe = 0.5 + 0.5 * Math.cos(th * 9);
    const c = NUT_TIP.clone().lerp(NUT_B, sstep(u, 0.02, 0.2)).lerp(NUT_A, sstep(u, 0.25, 0.6)).lerp(NUT_BAND, sstep(u, 0.84, 0.95));
    c.multiplyScalar(0.94 + 0.06 * stripe);
    return [r * (1 + 0.012 * stripe * sstep(u, 0.2, 0.5)), y, c];
  });
}

/**
 * Cupule: an inverted bowl, the rim a thick round lip, with rows of scales on the outside (odd rows offset by half a scale), the lower edge of each scale turned up and brighter, the seams between scales dark.
 * scales is the number of scales in one ring.
 */
function cupGeo(rows: number, cols: number, scales: number): THREE.BufferGeometry {
  // Cross-section: from inside the bowl (covered by the nut), around the rim, and then along the outside all the way to the little dome on top
  const prof = curveTable([
    [0, 0.07, 0.056],
    [0.1, 0.086, 0.034],
    [0.18, 0.1, 0.036],
    [0.26, 0.106, 0.052],
    [0.45, 0.101, 0.078],
    [0.65, 0.084, 0.1],
    [0.82, 0.052, 0.114],
    [0.93, 0.02, 0.119],
    [1, 0, 0.12],
  ]);
  return revolve(rows, cols, (u, th) => {
    const [r, y] = prof(u);
    // Scales grow only on the outside (u 0.2-0.85)
    const outer = sstep(u, 0.17, 0.24) * (1 - sstep(u, 0.8, 0.9));
    const rowF = (u - 0.2) * 7.5;
    const ri = Math.floor(rowF);
    const fv = rowF - ri;
    const fu = (((th / (PI * 2)) * scales + (ri % 2) * 0.5) % 1 + 1) % 1;
    // Scales: the lower edge (small fv) turned up highest and buried going up into the row above; the left and right sides close into seams
    const lift = Math.pow(1 - fv, 1.4) * Math.pow(Math.sin(PI * fu), 0.6);
    const bump = outer * lift;
    const c = CUP_GAP.clone().lerp(CUP_A, sstep(bump, 0.05, 0.3)).lerp(CUP_B, sstep(bump, 0.5, 0.85));
    if (outer < 0.5) c.copy(CUP_A).lerp(CUP_GAP, u < 0.2 ? 0.6 : 0);
    return [r + bump * 0.007, y, c];
  });
}

/** Oak leaf: three pairs of rounded lobes along the edge, the base narrowing into the leaf stalk, the tip rounded; lying flat in the xy plane with the tip toward +y */
function oakLeafShape(len: number, wid: number): THREE.Shape {
  const n = 14;
  const right: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.pow(Math.sin(PI * Math.min(1, t * 1.02)), 0.75) * (1 - 0.25 * t);
    const lobe = 0.72 + 0.28 * Math.abs(Math.cos(PI * 3.5 * t));
    right.push([wid * env * lobe * sstep(t, 0, 0.12), t * len]);
  }
  const pts: [number, number][] = [[0, 0], ...right.slice(1, -1), [0, len], ...right.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
  return outline(pts);
}

// ───────────────────────── Shape ─────────────────────────

export function buildAcornsquirrelLab(): LabModel {
  const RIMC = 0xffd6ae;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const RUS = col(0xc8622c);
  const RUS_D = col(0xa24c22);
  const CREAM = 0xf7e7c8;
  const CRM = col(CREAM);
  const PINK = col(0xefae98);
  const TUFT = col(0x7c3416);
  const TUFT_D = col(0x5a240e);

  // The fur (body, head, tail, ears, hands and feet) shares one vertex-color material; the eyelids' cream uses a single-color material with the same parameters, merged in as twins by mergeStatic
  const fur = vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC }));
  const M = {
    fur,
    cream: labToon(CREAM, { rim: 0.6, rimColor: RIMC }),
    eye: labToon(0x2c1a10, { ramp: 'gem', rim: 0 }),
    iris: labToon(0x6e3a1a, { ramp: 'gem', rim: 0 }),
    irisLow: labToon(0xb4743a, { ramp: 'gem', rim: 0 }),
    pupil: labToon(0x0e0806, { ramp: 'gem', rim: 0 }),
    gem0: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    nose: labToon(0x4a2a22, { spec: 0.9, specTh: 0.992, rim: 0.3, rimColor: RIMC }),
    dark: labToon(0x3e1e14, { rim: 0.2 }),
    teeth: labToon(0xfffaf0, { rim: 0.2 }),
    flat0: vc(labToon(0xffffff, { rim: 0.2 })),
    nut: vc(labToon(0xffffff, { spec: 0.7, specTh: 0.985, rim: 0.45, rimColor: RIMC })),
    cup: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC })),
    leaf: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xe4ffc0 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'acornsquirrel-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const BODY = 9601;
  const HEAD = 9602;

  // Shift the whole animal so the midpoint between head and tail (tail backward, feet forward) falls on the pivot (pitfall 66)
  const place = group(root, [-0.06, 0, 0.13]);
  const body = group(place);

  // ── Body: rump, belly, chest, neck and two thick hind legs, one whole smooth distance field ──
  const bodyBlob = new Blob();
  bodyBlob.add(v3(0, 0.3, -0.02), v3(0.29, 0.3, 0.27), undefined, 0.1);
  bodyBlob.add(v3(0, 0.6, 0.03), v3(0.2, 0.25, 0.19), new THREE.Quaternion().setFromAxisAngle(X, 0.14), 0.1);
  bodyBlob.add(v3(0, 0.8, 0.05), v3(0.14, 0.12, 0.13), undefined, 0.08);
  for (const sx of [-1, 1]) bodyBlob.add(v3(sx * 0.2, 0.19, 0.04), v3(0.15, 0.17, 0.21), new THREE.Quaternion().setFromAxisAngle(X, -0.3), 0.07);
  {
    const geo = blobGeo(bodyBlob, v3(0, 0.4, 0), 13, v3(0, 0.2, 1), 0.2, (p, n) => {
      // Darker on the back and a cream belly (the edge blended with smoothstep, so no triangular sawteeth appear, pitfall 32)
      const c = RUS.clone().lerp(RUS_D, sstep(-n.z, 0.3, 0.8) * sstep(p.y, 0.25, 0.6));
      const belly = sstep(n.z, 0.22, 0.4) * (1 - sstep(Math.abs(p.x), 0.13, 0.165)) * sstep(p.y, 0.1, 0.14);
      return c.lerp(CRM, belly);
    });
    add(body, geo, M.fur).userData.inkGroup = BODY;
  }
  // Hind feet: long feet running from under the thigh forward flat along the ground, three round toes at the tip
  for (const sx of [-1, 1]) {
    const foot = loft([v3(sx * 0.2, 0.06, -0.04), v3(sx * 0.21, 0.042, 0.12), v3(sx * 0.215, 0.036, 0.27)], curveTable([[0, 0, 0], [0.12, 0.05, 0.04], [0.5, 0.056, 0.036], [0.86, 0.05, 0.03], [1, 0, 0]]), { segs: 14, radial: 10, side: X });
    add(body, paint(foot, (p) => RUS.clone().lerp(col(0xd88a4a), sstep(p.z, 0.12, 0.24))), M.fur);
    const toe = paint(new THREE.SphereGeometry(1, 6, 5), () => col(0xb86a38));
    for (let i = 0; i < 3; i++) add(body, toe, M.fur, [sx * 0.215 + (i - 1) * 0.03, 0.024, 0.285 - Math.abs(i - 1) * 0.012], [0, 0, 0], [0.018, 0.018, 0.022]);
  }

  // ── Head: the neck pivot handles the looking around; skull, cheeks, muzzle and chin are one whole distance field ──
  const head = group(body, [0, 0.84, 0.05]);
  const hc = group(head, [0, 0.18, 0.02]);
  const headBlob = new Blob();
  headBlob.add(v3(0, 0.02, -0.01), v3(0.26, 0.235, 0.24), undefined, 0.08);
  for (const sx of [-1, 1]) headBlob.add(v3(sx * 0.14, -0.1, 0.09), v3(0.125, 0.105, 0.115), undefined, 0.07);
  headBlob.add(v3(0, -0.07, 0.17), v3(0.085, 0.07, 0.1), undefined, 0.06);
  headBlob.add(v3(0, -0.14, 0.1), v3(0.075, 0.05, 0.08), undefined, 0.06);
  const HO = v3(0, 0.0, 0.02);
  const sdir = (lon: number, lat: number) => v3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));

  // The eye positions are computed first: the cream eye ring has to be painted on the head
  const ER = 0.068;
  const EYE_LON = 0.6;
  const EYE_LAT = 0.1;
  const eyeAt = [-1, 1].map((sx) => {
    const { p, n } = headBlob.hit(HO, sdir(sx * EYE_LON, EYE_LAT));
    return { sx, p, n, c: p.clone().addScaledVector(n, -ER * 0.55) };
  });
  {
    const geo = blobGeo(headBlob, HO, 15, v3(0, -0.15, 1), 0.3, (p, n) => {
      // The top and back of the head are red-brown; the muzzle, cheeks and chin are cream; around each eye is a cream eye ring
      let c = RUS.clone().lerp(RUS_D, sstep(n.y, 0.55, 0.9) * 0.5);
      const face = sstep(-p.y, -0.045, 0.004) * sstep(p.z, -0.03, 0.05);
      let ring = 0;
      for (const e of eyeAt) ring = Math.max(ring, sstep(ER * 1.62 - p.distanceTo(e.c), -0.004, 0.016));
      c = c.lerp(CRM, Math.max(face, ring));
      return c;
    });
    add(hc, geo, M.fur).userData.inkGroup = HEAD;
  }

  // ── Eyes: big shiny black eyes sunk deep into the head, the cream upper and lower eyelids being the eye ring; the sockets face outward and the iris, pupil and highlights turn toward the nose side, so from the front it is a straight-ahead gaze ──
  const UP_OPEN = 0.92;
  const LO_OPEN = 0.68;
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const gazes: { g: THREE.Group; sx: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = lidLite(ER + 0.005, ER + 0.013, PI / 2, true);
  const lidLow = lidLite(ER + 0.004, ER + 0.011, PI / 2, false);
  const eyeball = new THREE.SphereGeometry(ER, 20, 10, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const { sx, n, c } of eyeAt) {
    const eg = group(hc, [c.x, c.y, c.z]);
    const d = n.clone().lerp(sdir(sx * EYE_LON, EYE_LAT), 0.5).normalize();
    const r = new THREE.Vector3().crossVectors(UP, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    add(eg, eyeball, M.eye);
    const gaze = group(eg, [0, 0, 0], [-0.08, -sx * 0.3, 0]);
    gazes.push({ g: gaze, sx });
    add(gaze, lightDecal(ellipsePts(0.66, 0.7, 0, 16), ER + 0.0016), M.iris);
    add(gaze, lightDecal(ellipsePts(0.46, 0.26, -0.36, 12), ER + 0.0032), M.irisLow);
    add(gaze, lightDecal(ellipsePts(0.34, 0.38, 0.03, 14), ER + 0.0048), M.pupil);
    // Both highlights fall on the key-light side (upper right of the view), the same for both eyes
    for (const [x, y, rr] of [[0.02, 0.022, 0.017], [-0.016, -0.02, 0.008]] as [number, number, number][]) {
      const hl = add(gaze, new THREE.SphereGeometry(rr, 8, 6), M.hi, [x, y, ER * 0.96], [0, 0, 0], [1, 1, 0.5]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(gaze, [0, 0, ER]));
    // The outer corner turned up a little (pitfall 43), the upper eyelid flipping down when blinking; the lower eyelid does not move, and hangs off the head so it can be merged into the head's mesh (pitfall 102)
    const slant = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), sx * 0.16);
    const lidG = group(eg);
    lidG.quaternion.copy(slant);
    const upper = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.cream).userData.inkGroup = HEAD;
    const lower = group(hc, [c.x, c.y, c.z]);
    lower.quaternion.copy(eg.quaternion).multiply(slant).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.cream).userData.inkGroup = HEAD;
    lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02 });
  }

  // ── Nose, mouth, incisors ──
  const surf = (x: number, y: number) => headBlob.hit(HO, v3(x, y, 1));
  const noseAt = surf(0, -0.2);
  const noseG = group(hc, [noseAt.p.x, noseAt.p.y, noseAt.p.z]);
  orient(noseG, UP.clone().addScaledVector(noseAt.n, -0.4), noseAt.n);
  {
    // A round nose tip in an inverted triangle: the lower edge narrowing
    const g = new THREE.SphereGeometry(1, 12, 8);
    const pa = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setX(i, pa.getX(i) * (0.78 + 0.22 * pa.getY(i)));
    g.computeVertexNormals();
    add(noseG, g, M.nose, [0, 0.002, 0.004], [0, 0, 0], [0.036, 0.024, 0.022]);
  }
  // Mouth: a short philtrum under the nose, joining an ω that turns up on both sides; the line has thickness, so under the outline it does not break into dots
  const lift = (x: number, y: number, out = 0.003) => {
    const { p, n } = surf(x, y);
    return p.addScaledVector(n, out);
  };
  const tube = (pts: THREE.Vector3[], r: number) => loft(pts, (t) => {
    const k = Math.pow(Math.sin(PI * clamp(t, 0, 1)), 0.25);
    return [r * k + 0.001, r * k + 0.001];
  }, { segs: 10, radial: 6 });
  add(hc, tube([lift(0, -0.3), lift(0, -0.36), lift(0, -0.415)], 0.0062), M.dark);
  for (const sx of [-1, 1]) add(hc, tube([lift(0, -0.405), lift(sx * 0.06, -0.455), lift(sx * 0.13, -0.45), lift(sx * 0.19, -0.405), lift(sx * 0.23, -0.35)], 0.0062), M.dark);
  // Incisors: two white square teeth, showing from under the upper lip
  const teethAt: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    const { p, n } = surf(sx * 0.03, -0.5);
    const tg = group(hc, [p.x, p.y, p.z]);
    orient(tg, UP.clone().addScaledVector(n, -UP.dot(n)), n);
    add(tg, rbox(0.026, 0.036, 0.016, 0.006, 1), M.teeth, [0, 0.004, 0.002], [-0.12, 0, sx * 0.04]);
    teethAt.push(p);
  }

  // ── Ears: round leaf-shaped ear shells (dished in at the front, pink), the ear tip carrying a dark tuft flicking outward; the whole ear is one loft ──
  const ears: { g: THREE.Group; sx: number }[] = [];
  const earA = curveTable([[0, 0.006], [0.12, 0.04], [0.26, 0.064], [0.4, 0.066], [0.52, 0.05], [0.62, 0.026], [0.69, 0.024], [0.77, 0.027], [0.88, 0.017], [1, 0]]);
  const earB = curveTable([[0, 0.006], [0.12, 0.018], [0.26, 0.022], [0.45, 0.02], [0.62, 0.017], [0.7, 0.021], [0.8, 0.02], [0.9, 0.013], [1, 0]]);
  const earCup = curveTable([[0, 0], [0.2, 0.006], [0.35, 0.016], [0.5, 0.012], [0.6, 0], [1, 0]]);
  for (const sx of [-1, 1]) {
    const { p: S, n } = headBlob.hit(HO, v3(sx * 0.48, 0.85, -0.18));
    const eg = group(hc, [S.x, S.y, S.z]);
    const f = v3(sx * 0.45, 0, 1).normalize();
    const side = v3(f.z, 0, -f.x);
    const pts = [
      n.clone().multiplyScalar(-0.05),
      n.clone().multiplyScalar(0.015),
      v3(sx * 0.025, 0.085, -0.005),
      v3(sx * 0.04, 0.16, -0.015),
      v3(sx * 0.058, 0.215, -0.03),
      v3(sx * 0.085, 0.268, -0.05),
    ];
    const geo = sweep(pts, (t, th) => {
      const a = earA(t)[0];
      const b = earB(t)[0];
      const cth = Math.cos(th);
      return [a * cth, b * Math.sin(th) - earCup(t)[0] * (1 - cth * cth)];
    }, {
      segs: 30,
      radial: 12,
      side,
      paint: (t, th) => {
        const inner = sstep(Math.sin(th), 0.25, 0.6) * (1 - sstep(Math.abs(Math.cos(th)), 0.55, 0.75)) * sstep(t, 0.18, 0.26) * (1 - sstep(t, 0.5, 0.58));
        return RUS.clone().lerp(PINK, inner).lerp(TUFT, sstep(t, 0.6, 0.68)).lerp(TUFT_D, sstep(t, 0.85, 1));
      },
    });
    add(eg, geo, M.fur);
    ears.push({ g: eg, sx });
  }

  // ── Forelegs and acorn: two short forelegs reaching out from the chest, the paws holding the acorn from both sides, the fingers hooked over the front of the nut ──
  const HP = v3(0, 0.66, 0.1);
  const hold = group(body, [HP.x, HP.y, HP.z]);
  const rel = (x: number, y: number, z: number) => v3(x - HP.x, y - HP.y, z - HP.z);
  const ACORN = v3(0, 0.5, 0.34);
  const armProf = curveTable([[0, 0, 0], [0.08, 0.044, 0.044], [0.4, 0.05, 0.048], [0.8, 0.044, 0.042], [1, 0.03, 0.03]]);
  const mitten = paint(new THREE.SphereGeometry(1, 10, 8), () => col(0xd07a40));
  const finger = paint(new THREE.SphereGeometry(1, 7, 5), () => col(0xc06a36));
  for (const sx of [-1, 1]) {
    const arm = loft([rel(sx * 0.1, 0.68, 0.03), rel(sx * 0.17, 0.58, 0.14), rel(sx * 0.15, 0.51, 0.24), rel(sx * 0.105, 0.5, 0.3)], armProf, { segs: 16, radial: 10 });
    add(hold, paint(arm, () => RUS.clone()), M.fur);
    add(hold, mitten, M.fur, [...rel(sx * 0.094, 0.5, 0.325).toArray()] as [number, number, number], [0, 0, 0], [0.042, 0.05, 0.052]);
    // Three fingers curving forward along the nut, gripping the acorn
    for (let i = 0; i < 3; i++) {
      const ang = sx * (0.72 - 0.02 * i);
      const yy = ACORN.y - 0.03 + i * 0.03;
      const rr = 0.088 * Math.sqrt(Math.max(0.3, 1 - ((yy - ACORN.y) / 0.13) ** 2));
      // The long axis of each finger runs along the tangent of the nut's surface, pointing at the midline straight ahead
      const tan = v3(-Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(sx);
      const fp = v3(ACORN.x + Math.sin(ang) * (rr + 0.004), yy, ACORN.z + Math.cos(ang) * (rr + 0.004)).addScaledVector(tan, 0.008);
      add(hold, finger, M.fur, [...rel(fp.x, fp.y, fp.z).toArray()] as [number, number, number], [0, Math.atan2(tan.x, tan.z), 0], [0.015, 0.015, 0.024]);
    }
  }
  const acornG = group(hold, [...rel(ACORN.x, ACORN.y, ACORN.z).toArray()] as [number, number, number], [0.28, 0, 0.12]);
  add(acornG, nutGeo(14, 20), M.nut);
  add(acornG, cupGeo(22, 32, 11), M.cup);
  add(acornG, paint(loft([v3(0, 0.11, 0), v3(0.004, 0.14, 0), v3(0.018, 0.158, 0)], (t) => [0.011 - 0.004 * t, 0.011 - 0.004 * t], { segs: 5, radial: 6 }), () => CUP_A.clone()), M.cup);

  // ── Tail: from the rump going back and curling up along the back, the tip folding backward behind and to the right of the head. The wide direction faces left and right (x), a fluffy flat sheet of tail fur ──
  // The two side edges are cut into clumps of fur tips sweeping toward the tail tip (a herringbone pattern): the radius is a sawtooth along the tail, the tips bright and the roots dark; the back and front have only shallow undulation
  const TB = v3(0, 0.16, -0.18);
  const tail = group(body, [TB.x, TB.y, TB.z]);
  const tailW = [
    v3(0, 0.18, -0.1), v3(0.02, 0.12, -0.32), v3(0.06, 0.2, -0.49), v3(0.12, 0.45, -0.52), v3(0.18, 0.75, -0.39),
    v3(0.22, 1.02, -0.32), v3(0.26, 1.24, -0.3), v3(0.3, 1.34, -0.42), v3(0.32, 1.3, -0.56),
  ];
  const tailPts = tailW.map((p) => p.clone().sub(TB));
  const tailA = curveTable([[0, 0.03], [0.07, 0.08], [0.18, 0.135], [0.38, 0.185], [0.58, 0.2], [0.76, 0.185], [0.88, 0.14], [0.96, 0.07], [1, 0]]);
  const tailB = curveTable([[0, 0.03], [0.07, 0.07], [0.18, 0.1], [0.38, 0.12], [0.58, 0.125], [0.76, 0.115], [0.88, 0.09], [0.96, 0.045], [1, 0]]);
  // Each clump: the valley bulges up smoothly, and at the tip there is a sharp corner that then drops back quickly (the corner pointing toward the tail tip); the first version used a vertical cliff, which looked like stacked plates
  const TUFTS = 10;
  const PEAK = 0.74;
  const tooth = (t: number, th: number) => {
    const e = Math.pow(Math.abs(Math.cos(th)), 1.5);
    const u = t * TUFTS - 0.5 * e - (Math.cos(th) < 0 ? 0.5 : 0) * e;
    const w = u - Math.floor(u);
    const k = w < PEAK ? Math.pow(w / PEAK, 1.6) : Math.pow(1 - (w - PEAK) / (1 - PEAK), 1.3);
    return { e, k };
  };
  const tailGeo = sweep(tailPts, (t, th) => {
    const { e, k } = tooth(t, th);
    const amp = (0.03 + 0.17 * e) * sstep(t, 0.1, 0.22) * (1 - 0.5 * sstep(t, 0.93, 1));
    const m = 1 + amp * (k - 0.4);
    return [tailA(t)[0] * Math.cos(th) * m, tailB(t)[0] * Math.sin(th) * (1 + amp * 0.4 * (k - 0.4))];
  }, {
    segs: 96,
    radial: 16,
    side: X,
    paint: (t, th) => {
      const { e, k } = tooth(t, th);
      const f = sstep(t, 0.08, 0.2);
      const c = col(0x9a4220).lerp(RUS, sstep(k, 0.05, 0.4)).lerp(col(0xe89148), sstep(k, 0.6, 0.95) * (0.5 + 0.5 * e));
      return RUS.clone().lerp(c, f);
    },
  });
  add(tail, tailGeo, M.fur);
  // A point on the tail: pushed outward to out times the radius, in the direction of angle φ on the cross-section (0 toward the edge on +x, π/2 the height direction H)
  // In the upright section of the tail H points forward (toward the body) and -H is the back; in the section folding backward at the tip H points up
  const tailPath = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  const tailSpot = (t: number, phi: number, out: number) => {
    const C = tailPath.getPointAt(t);
    const T = tailPath.getTangentAt(t);
    const W = X.clone().addScaledVector(T, -T.dot(X)).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const a = tailA(t)[0];
    const b = tailB(t)[0];
    const p = C.clone().addScaledVector(W, a * Math.cos(phi) * out).addScaledVector(H, b * Math.sin(phi) * out);
    const n = W.clone().multiplyScalar(Math.cos(phi) / a).addScaledVector(H, Math.sin(phi) / b).normalize();
    return { p, n, T, W };
  };
  // An acorn hidden on the back of the middle of the tail: lying across the fur along the grain, half the nut and cupule showing (it has forgotten it itself)
  const stash = group(tail);
  {
    const s = tailSpot(0.42, -PI / 2 - 0.35, 0.96);
    stash.position.copy(s.p);
    orient(stash, s.T.clone().multiplyScalar(0.9).addScaledVector(s.n, 0.35), s.n);
    const sg = group(stash, [0, 0, 0], [0, 0, 0.5]);
    sg.scale.setScalar(0.62);
    add(sg, nutGeo(8, 12), M.nut);
    add(sg, cupGeo(10, 24, 9), M.cup);
  }
  // On top of the section where the tail tip folds backward, a forgotten acorn has already sprouted: the nut facing up, putting out one small stem and three oak leaves.
  // This little sapling is visible from the front, side and back (this is how half the giant trees in the forest grew)
  const sproutBase = tailSpot(0.87, PI / 2 - 0.25, 0.8);
  const sprout = group(tail, [sproutBase.p.x, sproutBase.p.y, sproutBase.p.z]);
  orient(sprout, sproutBase.n.clone().add(v3(0, 1.2, 0)), v3(0, 0, -1));
  // The idle sway goes in a child group: the angle set by orient must not be overwritten by update's rotation (pitfall 22)
  const sway = group(sprout);
  {
    const sg = group(sway, [0, 0.03, 0], [PI, 0, 0]);
    sg.scale.setScalar(0.55);
    add(sg, nutGeo(8, 12), M.nut);
    add(sg, cupGeo(10, 24, 9), M.cup);
    const stemPts = [v3(0, 0.09, 0), v3(0.004, 0.13, -0.004), v3(-0.006, 0.17, -0.01), v3(0.004, 0.2, -0.012)];
    add(sway, paint(loft(stemPts, (t) => [0.0085 - 0.003 * t, 0.0085 - 0.003 * t], { segs: 8, radial: 6 }), (p) => col(0x6aa440).lerp(col(0x9ccc5a), sstep(p.y, 0.1, 0.2))), M.leaf);
    const leafGeo = (len: number, wid: number) => {
      const g = slab(oakLeafShape(len, wid), 0.008, 0.003);
      // The leaf blade folds slightly along the midrib and the leaf tip droops a little; dark at the base and bright at the tip
      const pa = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) + Math.abs(pa.getX(i)) * 0.35 - (pa.getY(i) / len) ** 2 * 0.012);
      g.computeVertexNormals();
      return paint(g, (p) => col(0x5e9e38).lerp(col(0x8cc850), sstep(p.y / len, 0.1, 0.9)));
    };
    const leaves: [number, number, number, number, number][] = [
      // Position y, heading (about y), elevation (about x), length, width
      [0.195, 0.3, -0.75, 0.095, 0.034],
      [0.185, PI + 0.5, -0.8, 0.085, 0.031],
      [0.205, 1.9, -0.45, 0.06, 0.024],
    ];
    for (const [y, yaw, pitch, len, wid] of leaves) {
      const lg = group(sway, [0, y, -0.011]);
      lg.rotation.set(0, yaw, 0);
      const lp = group(lg, [0, 0, 0], [pitch, 0, 0]);
      // The leaf tips go outward along +z and slightly upward
      add(lp, leafGeo(len, wid), M.leaf, [0, 0, 0], [PI / 2, 0, 0]);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: breathing, looking around in jerks, nose twitching, ear tufts flicking, blinking, the tail swaying slowly, the sprout swaying ──
  // All computed from t (a frozen time gives the same pose); all weights at 0 is idle
  const act = { focus: 0, nibble: 0, puff: 0 };
  const LOOK = [0, 0.3, 0.12, -0.26, -0.06, 0.22, 0.34, -0.18];
  const TILT = [0, 0.07, -0.04, 0.08, 0, -0.06, 0.05, -0.03];
  const P_LOOK = 1.8;
  const update = (t: number) => {
    const still = 1 - Math.min(1, act.focus);
    const br = Math.sin(t * 2.4);
    body.scale.set(1 + br * 0.006, 1 + br * 0.01, 1 + br * 0.006);
    // Looking around: a new direction every 1.8 seconds, turning over quickly in the last 0.16 seconds (a squirrel's jerky style)
    const k = Math.floor(t / P_LOOK);
    const f = t / P_LOOK - k;
    const n = LOOK.length;
    const i0 = ((k % n) + n) % n;
    const i1 = (i0 + 1) % n;
    const e = sstep(f, 0.91, 1);
    head.rotation.y = lerp(LOOK[i0], LOOK[i1], e) * still;
    head.rotation.z = lerp(TILT[i0], TILT[i1], e) * still;
    head.rotation.x = Math.sin(t * 1.1) * 0.02 + act.nibble * 0.1;
    // Nose: three quick twitches in a row every 2.3 seconds
    const nt = t % 2.3;
    const tw = nt < 0.42 ? Math.abs(Math.sin((nt / 0.42) * PI * 3)) : 0;
    noseG.scale.set(1 + tw * 0.1, 1 + tw * 0.14, 1);
    // The ear tufts flick now and then (the two ears staggered)
    for (const { g, sx } of ears) {
      const ph = (t + (sx > 0 ? 1.7 : 0)) % 5.3;
      const flick = ph < 0.3 ? Math.sin((ph / 0.3) * PI * 2) * (1 - ph / 0.3) : 0;
      g.rotation.set(-flick * 0.08, 0, -sx * flick * 0.12);
    }
    // Blink: once every 3.4 seconds, and one time in three it blinks twice in a row
    const bt = t % 3.4;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
    const close = Math.max(bk(bt - 3.0), Math.floor(t / 3.4) % 3 === 1 ? bk(bt - 2.7) : 0);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    // Holding the acorn: gently hugging tighter with the breathing; nibble brings the acorn to the mouth
    hold.rotation.x = -Math.sin(t * 2.4 + 0.6) * 0.02 - act.nibble * 0.42;
    // The tail slowly swaying left and right with the tip dipping slightly; puff bursts the whole tail out
    tail.rotation.set(Math.sin(t * 1.3) * 0.025, Math.sin(t * 0.7) * 0.03, -Math.sin(t * 0.9) * 0.035);
    const pf = act.puff;
    tail.scale.set(1 + pf * 0.2, 1 + pf * 0.05, 1 + pf * 0.12);
    sway.rotation.z = Math.sin(t * 1.7) * 0.08;
  };
  update(0);

  // Anchors
  const face = group(hc, [0, -0.01, 0.25]);
  const mouthA = group(hc, [0, teethAt[0].y, (teethAt[0].z + teethAt[1].z) / 2 + 0.01]);
  const acornA = group(acornG, [0, 0, 0]);
  const pawsA = group(hold, [...rel(0, 0.5, 0.42).toArray()] as [number, number, number]);
  const top = tailSpot(0.9, PI / 2, 1);
  const tailTop = group(tail, [top.p.x, top.p.y, top.p.z]);
  const tailTip = group(tail, [tailPts[tailPts.length - 1].x, tailPts[tailPts.length - 1].y, tailPts[tailPts.length - 1].z]);
  const sproutTop = group(sway, [0, 0.22, -0.01]);
  const stashA = group(stash);
  const rig = { head: face, eyes: eyeAnchors, anchors: { mouth: mouthA, acorn: acornA, paws: pawsA, tail: tailTop, tailTip, sprout: sproutTop, stash: stashA } };
  // Static parts merged (mesh budget N 40): moving groups act as owners, and the eye highlights (switched on and off when blinking) are not merged
  mergeStatic(root, {
    owners: [body, head, noseG, hold, tail, sway, ...ears.map((e) => e.g), ...gazes.map((g) => g.g), ...lids.map((l) => l.g)],
    keep: [...glints],
    twins: [[M.cream, M.fur], [M.iris, M.gem0], [M.irisLow, M.gem0], [M.pupil, M.gem0], [M.dark, M.flat0], [M.teeth, M.flat0]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.74, 0), radius: 0.86 };
}
