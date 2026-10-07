// Pyre Dragoon (model lab version): a little lizard of the Emberspine Volcanic Belt whose tail flame brightens and dims with its mood; grown up, it forges a flame sword from its tail flame,
// and is revered as a guardian deity by the knights of Rediron Keep. The partner of the rival Kael (Mila says it is "a lot like Kael, with a sour face"). Fire element, positioned for assault and physical skills: building momentum and charging in one go.
//
// Identifying features (from the name, lore and skill set):
// 1. A red-scaled lizard body: a fire lizard standing on two legs, the body leaning forward and a thick tail dragging on the ground as a third foot; red on the back, a cream belly plate with transverse bands, and an orange side stripe between the two.
//    A row of short spines hooked backward runs from the shoulder blades all the way to the tail end, the spine tips ember orange (grown from the loft itself, not pasted on piece by piece).
// 2. A head crest like the crest of a knight's helm: a fan-shaped crest on top of the head sweeping back with four spikes along its edge (deep red to gold-orange), and a pair of horns at the sides of the back of the head curving back and up,
//    from the front it is a head wearing a helm, and from the side one whole fan crest.
// 3. The flame-pattern sword: a wavy blade (a flamberge) forged from the tail flame, an iron-red blade with a glowing fuller down the middle like iron that has not cooled, a flame-tongue-shaped guard, and an ember gem on the pommel.
//    The right hand holds it on the right side of the chest, the blade lying against the right shoulder and reaching slantwise back and up, a wavy slanted line in the silhouette.
// 4. Tail flame: the tail drags on the ground and then curls up toward the back left, with a tuft of fire leaping up at the tip (four tongues of flame), growing larger and smaller with its mood.
// 5. A knight's things: an iron-red pauldron on the left shoulder (two plates, rivets, a center ridge), and around the neck the deep blue neckerchief of the Silver Oath Knights (with silver trim).
// Body shape: a lizard standing upright on two legs, not a person: thick thighs flaring outward, the shins folded back, long feet with three long toes and claws; the arms short, the head big (about a quarter of the whole body) and the muzzle short.
// Personality: a little knight with a sour face. Proud, unwilling to lose, never saying a good word, always the first to charge.
// Expression: big golden eyes open and looking straight ahead, vertical pupils; the brow ridge low on the inside and high on the outside pressing above the upper lid (the sour face), the upper lid covering only to the top of the iris; the mouth line flat, the right corner of the mouth hooked up showing one small fang (a sneer of refusing to submit);
// the chin slightly lifted. No drooping eyes, no downward look, no eye bags.
// Gaze order: the face (cream lower jaw, golden vertical pupils, dark brow ridge) first, the head crest and the flame-pattern sword on the shoulder second, the tail flame third; the pauldron, neckerchief and belly plate as support.
// Back: the neckerchief is knotted at the nape, a silver shield badge of the order pinned on the knot, the two swallowtail strap ends drifting back; below it the row of back spines running all the way to the tail end,
// the blade of the sword lying slantwise across behind the right shoulder, the tail curling up to the left with the tail flame at its tip.
// Restrained light effects: no particles, halos or translucent shells; the only emissive left is three places, the sword's fuller, the pommel gem and the tail flame, from the material itself and not from bloom.
//
// <Action table> (battle actions and the ultimate follow this table)
// - Idle: stands chest out with the sword on its shoulder, every few seconds impatiently lifting the sword off the shoulder and putting it back; the tail slowly swaying along the ground, the tail flame jumping larger and smaller; breathing, blinking, looking around with a sidelong glance.
// - Move: a two-legged dash, the body low and leaning forward, the tail stretched out flat behind as a counterbalance.
// - Charge-up (act.charge): the body pressed low forward, the sword lowered from the shoulder to point forward, the head up and fixed on the opponent; the tail flame grows (act.flare).
// - Strike: a diagonal chop down from the shoulder, or the whole body pressed low in a charge forward (momentum).
// - Hit: steps back half a step, grits its teeth, the head pulling back, the tail flame dimming for a moment and leaping up again right away.
// - Victory: plants the sword in the ground, turns its head away with a snort, the tail flame leaping high.
// act (0-1, all 0 is idle): focus stops looking around and looks straight ahead; charge is the charge-up pose; flare makes the tail flame larger and the fuller and gem brighter.
// Anchors: rig.head (center of the face), rig.eyes (the surfaces of the two eyes), anchors.mouth (in front of the mouth), crest (top of the head crest), hilt (the grip), blade (middle of the blade),
// swordTip (the sword tip), tailFlame (center of the tail flame), chest, pauldron, brooch (the badge on the neckerchief).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, lathe, loft, mergeStatic, outline, partKit, PI, slab, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const tv = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];

// ───────────────────────── Distance field (head) ─────────────────────────

interface Ell {
  c: THREE.Vector3;
  r: THREE.Vector3;
  inv: THREE.Quaternion;
  k: number;
}

/** A smooth union of a few rotated ellipsoids; f < 0 is inside. The skull, muzzle, lower jaw, cheeks and brow ridges grow into one whole with no seams */
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
  /** Walk outward from o on the inside along d to the surface */
  march(o: THREE.Vector3, d: THREE.Vector3, tmax = 1): THREE.Vector3 {
    const q = new THREE.Vector3();
    let t = 0;
    let fv = this.f(o);
    while (t < tmax) {
      const t1 = t + clamp(Math.abs(fv) * 0.6, 0.002, 0.02);
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
  hit(o: THREE.Vector3, d: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } {
    const p = this.march(o, d.clone().normalize());
    return { p, n: this.grad(p) };
  }
}

/** Wrap a distance field into a mesh: each vertex on a sphere is shot outward from center to the surface; the vertex directions are first squeezed toward focus (dense on the face, sparse on the back of the head) */
function blobGeo(blob: Blob, center: THREE.Vector3, detail: number, focus: THREE.Vector3, pull: number, paintFn: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
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
    const c = paintFn(p, n);
    cl.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────── Geometry helpers ─────────────────────────

/** Grid surface: rows × cols points (not wrapping around); the normals are computed after the vertices are merged */
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

function finish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/** Apply vertex colors to a mesh by position and normal (the material enables vertexColors and base color is set to white) */
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
const solid = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const cc = col(c);
  return paint(g, () => cc);
};

type Sec = (t: number, th: number, len: number) => [number, number];

/** Loft along a curve: the width direction uses a parallel-transport frame (if side is given it is fixed toward it), the height direction = width × tangent, with the winding facing outward */
function sweep(pts: THREE.Vector3[], sec: Sec, o: { segs?: number; radial?: number; side?: THREE.Vector3 } = {}): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = o.segs ?? 16;
  const radial = o.radial ?? 10;
  const len = path.getLength();
  const fr = o.side ? null : path.computeFrenetFrames(segs, false);
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  const g = gridGeo(segs + 1, radial + 1, (i, j) => {
    const t = i / segs;
    path.getPointAt(t, C);
    path.getTangentAt(t, T);
    if (o.side) W.copy(o.side).addScaledVector(T, -T.dot(o.side));
    else W.copy(fr!.normals[i]).addScaledVector(T, -T.dot(fr!.normals[i]));
    W.normalize();
    H.crossVectors(W, T).normalize();
    const th = ((j % radial) / radial) * PI * 2;
    const [x, y] = sec(t, th, len);
    return { p: C.clone().addScaledVector(W, x).addScaledVector(H, y) };
  });
  return finish(g);
}

/** Round tube (or elliptical tube) cross-section, both ends closed into hemispheres */
function roundSec(rad: (t: number) => number | [number, number]): Sec {
  const ab = (t: number): [number, number] => {
    const r = rad(t);
    return typeof r === 'number' ? [r, r] : r;
  };
  return (t, th, len) => {
    let [a, b] = ab(t);
    const r0 = Math.max(...ab(0), 1e-4);
    const r1 = Math.max(...ab(1), 1e-4);
    const u0 = Math.min(1, (t * len) / r0);
    const u1 = Math.min(1, ((1 - t) * len) / r1);
    const k = Math.sqrt(Math.max(0, 1 - (1 - u0) * (1 - u0))) * Math.sqrt(Math.max(0, 1 - (1 - u1) * (1 - u1)));
    a *= k;
    b *= k;
    return [Math.cos(th) * a, Math.sin(th) * b];
  };
}

/** Align the group's +y to dirY and its +z to faceZ as far as possible */
function orient(g: THREE.Object3D, dirY: THREE.Vector3, faceZ: THREE.Vector3): void {
  const y = dirY.clone().normalize();
  const z = faceZ.clone().addScaledVector(y, -faceZ.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Spherical shell (eyelid, pauldron): with +y as the top, covering from the top to the lip angle, the edge a round lip; the rim color is painted near the lip edge */
function lidGeo(ri: number, ro: number, lip: number, seg: number, phiLen: number, skin: THREE.Color, rim: THREE.Color, rimW = 0.11, back = false): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (const u of [0, 0.5, 0.85, 1]) prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(u * lip)), ri * Math.cos(u * lip)));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 4; i++) {
    const b = (i / 4) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (const u of [1, 0.95, 0.8, 0.45, 0]) prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(u * lip)), ro * Math.cos(u * lip)));
  // The lower eyelid has to be turned half a turn about x (front and back swap), so it is built centered on -z
  const g = new THREE.LatheGeometry(prof, seg, (back ? PI : 0) - phiLen / 2, phiLen);
  g.deleteAttribute('uv');
  return paint(g, (p) => skin.clone().lerp(rim, sstep(Math.atan2(Math.hypot(p.x, p.z), p.y), lip - rimW, lip - rimW * 0.5)));
}

/** A band around a sphere (the second plate of the pauldron): a0-a1 radians, both the upper and lower edges round lips. The outline order is the same as lidGeo (the inner face going down, the outer face going up), with normals facing outward */
function bandGeo(ri: number, ro: number, a0: number, a1: number, seg: number, c0: THREE.Color, c1: THREE.Color): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  const at = (a: number, r: number, tan = 0) => new THREE.Vector2(r * Math.sin(a) + tan * Math.cos(a), r * Math.cos(a) - tan * Math.sin(a));
  for (const u of [0, 0.35, 0.7, 1]) prof.push(at(lerp(a0, a1, u), ri));
  for (let i = 1; i < 4; i++) {
    const bb = (i / 4) * PI;
    prof.push(at(a1, c - Math.cos(bb) * w, Math.sin(bb) * w));
  }
  for (const u of [1, 0.65, 0.3, 0]) prof.push(at(lerp(a0, a1, u), ro));
  for (let i = 1; i < 4; i++) {
    const bb = (i / 4) * PI;
    prof.push(at(a0, c + Math.cos(bb) * w, -Math.sin(bb) * w));
  }
  prof.push(at(a0, ri));
  const g = new THREE.LatheGeometry(prof, seg);
  g.deleteAttribute('uv');
  return paint(g, (p) => {
    const a = Math.atan2(Math.hypot(p.x, p.z), p.y);
    return c0.clone().lerp(c1, Math.max(sstep(a, a1 - 0.08, a1 - 0.02), 1 - sstep(a, a0 + 0.02, a0 + 0.08)));
  });
}

/** Iris and pupil: concentric ellipses laid onto a sphere of radius r centered on +z; rings go from inside to outside [longitude radius, latitude radius, color] */
function irisGeo(r: number, rings: [number, number, THREE.Color][], seg: number): THREE.BufferGeometry {
  const rows: [number, number, THREE.Color][] = [[0, 0, rings[0][2]], [rings[0][0] * 0.5, rings[0][1] * 0.5, rings[0][2]]];
  for (let k = 0; k < rings.length; k++) {
    rows.push([rings[k][0], rings[k][1], rings[k][2]]);
    if (k + 1 < rings.length) rows.push([rings[k][0], rings[k][1], rings[k + 1][2]]);
  }
  const g = gridGeo(rows.length, seg + 1, (i, j) => {
    const [rx, ry, c] = rows[i];
    const ph = (j / seg) * PI * 2;
    const lon = Math.cos(ph) * rx;
    const lat = Math.sin(ph) * ry;
    return { p: v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(r), c };
  });
  const pa = g.attributes.position as THREE.BufferAttribute;
  const nor = new Float32Array(pa.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    n.fromBufferAttribute(pa, i).normalize();
    nor.set([n.x, n.y, n.z], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/**
 * A membrane with thickness (the neckerchief): S(u, v) is the mid-surface, growing thick / 2 out to each side, the outer edge a ring of semicircular round lips.
 * With wrapU, u goes once around with no seam; without wrapping all four edges close into round lips. color(u, v, side): side 1 is the outer side and -1 the inner side.
 */
function thickSheet(
  NU: number,
  NV: number,
  S: (u: number, v: number) => THREE.Vector3,
  thick: (u: number, v: number) => number,
  o: { wrapU?: boolean; E?: number; color?: (u: number, v: number, side: number) => THREE.Color; outward: (p: THREE.Vector3) => THREE.Vector3 },
): THREE.BufferGeometry {
  const wrap = !!o.wrapU;
  const cols = wrap ? NU : NU + 1;
  const rows = NV + 1;
  const E = o.E ?? 3;
  const P: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) P.push(S(i / NU, j / NV));
  const at = (i: number, j: number) => P[j * cols + i];
  const Nn: THREE.Vector3[] = [];
  const Su: THREE.Vector3[] = [];
  const Sv: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const iL = wrap ? (i - 1 + cols) % cols : Math.max(0, i - 1);
      const iR = wrap ? (i + 1) % cols : Math.min(cols - 1, i + 1);
      const su = at(iR, j).clone().sub(at(iL, j));
      const sv = at(i, Math.min(rows - 1, j + 1)).clone().sub(at(i, Math.max(0, j - 1)));
      Su.push(su);
      Sv.push(sv);
      const nn = su.clone().cross(sv).normalize();
      if (nn.dot(o.outward(P[j * cols + i])) < 0) nn.negate();
      Nn.push(nn);
    }
  const color = o.color ?? (() => col(0xffffff));
  const pos: number[] = [];
  const clr: number[] = [];
  const outs: THREE.Vector3[] = [];
  const addV = (p: THREE.Vector3, d: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z);
    clr.push(c.r, c.g, c.b);
    outs.push(d);
    return outs.length - 1;
  };
  const uvOf = (k: number): [number, number] => [(k % cols) / NU, Math.floor(k / cols) / NV];
  const O: number[] = [];
  const I: number[] = [];
  for (let k = 0; k < P.length; k++) {
    const [u, w] = uvOf(k);
    const h = thick(u, w) / 2;
    O.push(addV(P[k].clone().addScaledVector(Nn[k], h), Nn[k].clone(), color(u, w, 1)));
    I.push(addV(P[k].clone().addScaledVector(Nn[k], -h), Nn[k].clone().negate(), color(u, w, -1)));
  }
  const idx: number[] = [];
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    A.set(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]);
    B.set(pos[b * 3] - A.x, pos[b * 3 + 1] - A.y, pos[b * 3 + 2] - A.z);
    C.set(pos[c * 3] - A.x, pos[c * 3 + 1] - A.y, pos[c * 3 + 2] - A.z);
    const fn = B.cross(C);
    const hint = outs[a].clone().add(outs[b]).add(outs[c]);
    if (fn.dot(hint) < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < (wrap ? cols : cols - 1); i++) {
      const i2 = (i + 1) % cols;
      const a = j * cols + i;
      const b = j * cols + i2;
      const c = (j + 1) * cols + i2;
      const d = (j + 1) * cols + i;
      tri(O[a], O[b], O[c]);
      tri(O[a], O[c], O[d]);
      tri(I[a], I[b], I[c]);
      tri(I[a], I[c], I[d]);
    }
  const loops: { k: number; e: THREE.Vector3 }[][] = [];
  if (wrap) {
    loops.push(Array.from({ length: cols }, (_, i) => ({ k: i, e: Sv[i].clone().negate() })));
    loops.push(Array.from({ length: cols }, (_, i) => ({ k: (rows - 1) * cols + i, e: Sv[(rows - 1) * cols + i].clone() })));
  } else {
    const L: { k: number; e: THREE.Vector3 }[] = [];
    const eOf = (i: number, j: number) => {
      const k = j * cols + i;
      const e = new THREE.Vector3();
      if (j === 0) e.sub(Sv[k].clone().normalize());
      if (j === rows - 1) e.add(Sv[k].clone().normalize());
      if (i === 0) e.sub(Su[k].clone().normalize());
      if (i === cols - 1) e.add(Su[k].clone().normalize());
      return { k, e };
    };
    for (let i = 0; i < cols; i++) L.push(eOf(i, 0));
    for (let j = 1; j < rows; j++) L.push(eOf(cols - 1, j));
    for (let i = cols - 2; i >= 0; i--) L.push(eOf(i, rows - 1));
    for (let j = rows - 2; j >= 1; j--) L.push(eOf(0, j));
    loops.push(L);
  }
  for (const L of loops) {
    const rings = L.map(({ k, e }) => {
      const n = Nn[k];
      const ee = e.clone().addScaledVector(n, -e.dot(n)).normalize();
      const [u, w] = uvOf(k);
      const h = thick(u, w) / 2;
      const cO = color(u, w, 1);
      const cI = color(u, w, -1);
      const ring = [O[k]];
      for (let m = 1; m <= E; m++) {
        const ph = (PI * m) / (E + 1);
        const d = n.clone().multiplyScalar(Math.cos(ph)).addScaledVector(ee, Math.sin(ph));
        ring.push(addV(P[k].clone().addScaledVector(d, h), d, cO.clone().lerp(cI, (1 - Math.cos(ph)) / 2)));
      }
      ring.push(I[k]);
      return ring;
    });
    for (let q = 0; q < rings.length; q++) {
      const r1 = rings[q];
      const r2 = rings[(q + 1) % rings.length];
      for (let m = 0; m <= E; m++) {
        tri(r1[m], r2[m], r2[m + 1]);
        tri(r1[m], r2[m + 1], r1[m + 1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildPyreDragoonLab(): LabModel {
  const RIMC = 0xffd9b0;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    // Scaly skin (shared by the head, body, limbs and head crest; the colors are all vertex colors): slightly glossy scales
    skin: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC, spec: 0.28, specTh: 0.99 })),
    horn: vc(labToon(0xffffff, { rim: 0.45, rimColor: RIMC, spec: 0.35, specTh: 0.992 })),
    claw: labToon(0x3b2622, { rim: 0.3, spec: 0.5, specTh: 0.994 }),
    dark: labToon(0x3a1410, { rim: 0 }),
    sclera: labToon(0xfff4dc, { ramp: 'gem', rim: 0 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    // Iron-red: the pauldron, the guard, and the seat of the pommel (vertex colors: dark red iron, polished edges, brass rivets)
    iron: vc(labToon(0xffffff, { ramp: 'metal', spec: 0.8, specTh: 0.985, rim: 0.45, rimColor: 0xffc8a0 })),
    blade: vc(labToon(0xffffff, { ramp: 'metal', spec: 0.9, specTh: 0.985, rim: 0.45, rimColor: 0xffc890 })),
    fuller: labToon(0xffb25a, { ramp: 'gem', emissive: 0xff5a14, emissiveAmt: 0.75, rim: 0 }),
    ember: labToon(0xff7a28, { ramp: 'gem', emissive: 0xff4a10, emissiveAmt: 0.6, rim: 0 }),
    grip: labToon(0x4b2c1d, { rim: 0.35, rimColor: RIMC }),
    cloth: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xc8d8ff })),
    silver: labToon(0xdfe4ec, { ramp: 'metal', spec: 0.9, specTh: 0.985, rim: 0.4 }),
    flame: vc(labToon(0xffffff, { ramp: 'gem', emissive: 0xff6a18, emissiveAmt: 0.45, rim: 0.3, rimColor: 0xffe08a })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'pyre_dragoon-lab';
  const { add, group, rivet } = partKit();
  const model = group(root);

  // Outline part indices: within the same group lines are drawn only at normal creases
  const HEAD = 9801;
  const BODY = 9802;
  const FLAME = 9803;
  const SCARF = 9804;
  const BLADE = 9810;

  const cRed = col(0xcf3b2b);
  const cRedD = col(0x98251f);
  const cOrange = col(0xee7433);
  const cCream = col(0xf7dca6);
  const cGroove = col(0xdcae78);
  const cEmber = col(0xf39a3c);
  const cBrow = col(0x6e1a16);

  // The pivot of the body is at the pelvis: leaning forward for charge-up and breathing both revolve around it; the legs hang on model and do not move
  const PELVIS = v(0, 0.57, -0.16);
  const hips = group(model, tv(PELVIS));
  const body = group(hips, tv(PELVIS.clone().negate()));

  // ── Torso: the neck, chest, belly, pelvis and tail are one whole loft. The row of spines hooked backward on the back and the cell-by-cell transverse-banded belly plate are both undulations of the loft itself ──
  const spine = new THREE.CatmullRomCurve3(
    [v(0, 1.225, 0.1), v(0, 1.12, 0.075), v(0, 0.98, 0.045), v(0, 0.82, 0.0), v(0, 0.68, -0.07), PELVIS.clone(), v(0, 0.45, -0.31), v(0.01, 0.28, -0.46), v(0.04, 0.125, -0.62), v(0.12, 0.068, -0.78), v(0.26, 0.078, -0.885), v(0.4, 0.15, -0.9), v(0.49, 0.265, -0.83)],
    false,
    'centripetal',
  );
  // [t, width radius, depth radius, offset toward the back side]
  const prof = curveTable([
    [0, 0.07, 0.075, 0],
    [0.03, 0.08, 0.085, 0],
    [0.08, 0.088, 0.096, -0.008],
    [0.15, 0.14, 0.13, -0.02],
    [0.21, 0.162, 0.152, -0.028],
    [0.28, 0.158, 0.148, -0.018],
    [0.33, 0.156, 0.138, 0],
    [0.38, 0.18, 0.148, 0.01],
    [0.45, 0.122, 0.106, 0.01],
    [0.6, 0.086, 0.076, 0],
    [0.75, 0.062, 0.056, 0],
    [0.9, 0.044, 0.04, 0],
    [0.97, 0.034, 0.032, 0],
    [1, 0.03, 0.028, 0],
  ]);
  const SP0 = 0.13;
  const SP1 = 0.93;
  const NSP = 14;
  const SPW = (SP1 - SP0) / NSP;
  const spikeAmp = (t: number) => (t < SP0 || t > SP1 ? 0 : 0.05 * sstep(t, SP0, SP0 + 0.04) * (t < 0.42 ? 1 : lerp(1, 0.32, (t - 0.42) / (SP1 - 0.42))));
  /** Back spines: gentle on the leading edge and steep on the trailing edge, the tips hooking toward the tail */
  const spikeShape = (t: number) => {
    if (t < SP0 || t > SP1) return 0;
    const f = (t - SP0) / SPW - Math.floor((t - SP0) / SPW);
    return f < 0.7 ? Math.pow(f / 0.7, 1.35) : 1 - (f - 0.7) / 0.3;
  };
  const G0 = 0.06;
  const G1 = 0.36;
  const NG = 8;
  const grooves = Array.from({ length: NG }, (_, k) => G0 + ((G1 - G0) * (k + 0.5)) / NG);
  const GW = 0.0055;
  const grooveAt = (t: number) => {
    let g = 0;
    for (const tg of grooves) g = Math.max(g, 1 - Math.abs(t - tg) / GW);
    return Math.max(0, g);
  };
  // Sample rows: an even base plus the spine tips, the spine valleys, the two edges of each groove and the groove bottoms
  const tsSet: number[] = [];
  for (let i = 0; i <= 44; i++) tsSet.push(i / 44);
  for (let k = 0; k < NSP; k++) for (const f of [0, 0.38, 0.7, 0.86]) tsSet.push(SP0 + SPW * (k + f));
  for (const tg of grooves) for (const d of [-GW, 0, GW]) tsSet.push(tg + d);
  tsSet.push(0.006, 0.014, 0.986, 0.994);
  tsSet.sort((a, b) => a - b);
  const ts: number[] = [];
  for (const t of tsSet) if (t >= 0 && t <= 1 && (!ts.length || t - ts[ts.length - 1] > 1e-4)) ts.push(t);
  // The columns of the cross-section: an even 24 columns, densified on both sides of the spine ridge (θ = π/2), so the spines are pointed
  const thSet: number[] = [];
  for (let j = 0; j < 24; j++) thSet.push((j / 24) * PI * 2);
  for (const d of [-0.2, -0.1, 0.1, 0.2]) thSet.push(PI / 2 + d);
  thSet.sort((a, b) => a - b);
  const SPIKE_W = 0.22;
  const ringCols = thSet.length;
  // Parallel-transport frame: the width direction starts from +x and is passed down the whole length; +H is the back side
  const frames: { C: THREE.Vector3; T: THREE.Vector3; W: THREE.Vector3; H: THREE.Vector3 }[] = [];
  {
    const W = X.clone();
    for (const t of ts) {
      const C = spine.getPointAt(t);
      const T = spine.getTangentAt(t);
      W.addScaledVector(T, -T.dot(W)).normalize();
      const H = new THREE.Vector3().crossVectors(W, T).normalize();
      frames.push({ C, T, W: W.clone(), H });
    }
  }
  const bodyPos: number[] = [];
  const bodyCol: number[] = [];
  const bodyT: number[] = [];
  const cap = (t: number) => {
    // Both ends close into round heads: the top of the neck buried in the head, the tail tip hidden under the tail flame
    const k0 = t < 0.012 ? Math.sqrt(Math.max(0, 1 - (1 - t / 0.012) ** 2)) : 1;
    const k1 = t > 0.985 ? Math.sqrt(Math.max(0, 1 - (1 - (1 - t) / 0.015) ** 2)) : 1;
    return k0 * k1;
  };
  ts.forEach((t, i) => {
    const { C, W, H } = frames[i];
    const [a0, b0, dy] = prof(t);
    const k = cap(t);
    const sa = spikeAmp(t) * spikeShape(t) * k;
    const gv = grooveAt(t);
    for (const th of thSet) {
      const s = Math.sin(th);
      const dth = Math.abs(Math.atan2(Math.sin(th - PI / 2), Math.cos(th - PI / 2)));
      const add = sa * Math.pow(Math.max(0, 1 - dth / SPIKE_W), 1.6);
      const vmask = sstep(-s, 0.62, 0.84) * (t > G0 - 0.02 && t < G1 + 0.02 ? 1 : 0);
      const dent = 0.0065 * gv * vmask;
      const a = (a0 + add) * k - dent * Math.abs(Math.cos(th));
      const b = (b0 + add) * k - dent * Math.abs(s);
      const x = Math.cos(th) * a;
      const y = s * b + dy * k;
      bodyPos.push(C.x + W.x * x + H.x * y, C.y + W.y * x + H.y * y, C.z + W.z * x + H.z * y);
      // Red on the back, an orange side stripe, cream on the belly; the spine tips ember orange; the bottoms of the belly-plate grooves darker
      const c = cCream.clone().lerp(cOrange, sstep(s, -0.74, -0.56)).lerp(cRed, sstep(s, -0.34, -0.08));
      if (sa > 1e-4) {
        const rel = add / Math.max(1e-5, spikeAmp(t) * k);
        c.lerp(cRedD, sstep(rel, 0.05, 0.3)).lerp(cEmber, sstep(rel, 0.8, 0.97) * 0.85);
      }
      c.lerp(cGroove, gv * vmask * 0.8);
      bodyCol.push(c.r, c.g, c.b);
      bodyT.push(t);
    }
  });
  const bodyIdx: number[] = [];
  for (let i = 0; i < ts.length - 1; i++)
    for (let j = 0; j < ringCols; j++) {
      const j2 = (j + 1) % ringCols;
      const a = i * ringCols + j;
      const b = (i + 1) * ringCols + j;
      const c = i * ringCols + j2;
      const d = (i + 1) * ringCols + j2;
      if (i > 0) bodyIdx.push(a, b, c);
      if (i + 1 < ts.length - 1) bodyIdx.push(b, d, c);
    }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPos, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyCol, 3));
  bodyGeo.setIndex(bodyIdx);
  bodyGeo.computeVertexNormals();
  {
    // The poles at the two ends: the normals of a whole row are averaged, so no outline dots appear
    const na = bodyGeo.attributes.normal as THREE.BufferAttribute;
    for (const [i, dir] of [[0, -1], [ts.length - 1, 1]] as [number, number][]) {
      const n = frames[i].T.clone().multiplyScalar(dir);
      for (let j = 0; j < ringCols; j++) na.setXYZ(i * ringCols + j, n.x, n.y, n.z);
    }
  }
  const bodyMesh = add(body, bodyGeo, M.skin);
  bodyMesh.userData.inkGroup = BODY;
  bodyMesh.frustumCulled = false;
  (bodyGeo.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  (bodyGeo.attributes.normal as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  // Tail swaying: the vertices after the tail root rotate about the tail root, more the closer to the tail end (vertices changed on the CPU, visible to the outline)
  const TB = 0.42;
  const tailPivot = spine.getPointAt(TB);
  const restP = Float32Array.from(bodyGeo.attributes.position.array as Float32Array);
  const restN = Float32Array.from(bodyGeo.attributes.normal.array as Float32Array);
  const tailW = bodyT.map((t) => (t <= TB ? 0 : Math.pow((t - TB) / (1 - TB), 1.3)));
  const tipRest = spine.getPointAt(0.985).add(v(0, 0.012, 0));
  let lastBend = Number.NaN;
  const bendTail = (ang: number) => {
    if (Math.abs(ang - lastBend) < 1e-6) return;
    lastBend = ang;
    const pa = bodyGeo.attributes.position.array as Float32Array;
    const na = bodyGeo.attributes.normal.array as Float32Array;
    for (let i = 0; i < tailW.length; i++) {
      const w = tailW[i];
      if (w === 0) continue;
      const a = ang * w;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const k = i * 3;
      const dx = restP[k] - tailPivot.x;
      const dz = restP[k + 2] - tailPivot.z;
      pa[k] = tailPivot.x + c * dx + s * dz;
      pa[k + 2] = tailPivot.z - s * dx + c * dz;
      const nx = restN[k];
      const nz = restN[k + 2];
      na[k] = c * nx + s * nz;
      na[k + 2] = -s * nx + c * nz;
    }
    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.attributes.normal.needsUpdate = true;
  };

  // Colors of the limbs: red on top and the outer side, turning orange on the underside
  const limbColor = (p: THREE.Vector3, n: THREE.Vector3) => cRed.clone().lerp(cOrange, sstep(-n.y, 0.15, 0.55) * 0.9);
  const skinPart = (parent: THREE.Object3D, g: THREE.BufferGeometry, ig = BODY) => {
    const m = add(parent, paint(g, limbColor), M.skin);
    m.userData.inkGroup = ig;
    return m;
  };
  const clawGeo = (len: number, r: number) => {
    const g = new THREE.ConeGeometry(r, len, 7, 1);
    g.translate(0, len / 2, 0);
    return g;
  };

  // ── Legs: thick thighs flaring outward, the shins folded back to the ankle, long feet lying flat on the ground, three long toes with claws, a short spur behind; the left foot forward ──
  for (const sx of [-1, 1]) {
    const fz = sx > 0 ? 0.045 : -0.035;
    const Hh = v(sx * 0.085, 0.6, -0.15);
    const K = v(sx * 0.215, 0.37, 0.03 + fz);
    const A = v(sx * 0.205, 0.105, -0.09 + fz);
    const Bf = v(sx * 0.215, 0.034, 0.055 + fz);
    // Thigh to shin is one loft: the knee is bent and not two tubes joined; the thigh root thick, bulging outward into the muscle at the side of the hip
    const legR = curveTable([[0, 0.128], [0.22, 0.122], [0.45, 0.09], [0.55, 0.08], [0.78, 0.06], [1, 0.05]]);
    skinPart(model, sweep([Hh, v(sx * 0.175, 0.5, -0.06 + fz * 0.5), K, v(sx * 0.215, 0.24, -0.035 + fz), A], roundSec((t) => legR(t)[0]), { segs: 26, radial: 12 }));
    skinPart(model, sweep([A, v(sx * 0.21, 0.052, -0.02 + fz), Bf], roundSec((t) => [lerp(0.038, 0.03, t), lerp(0.058, 0.05, t)]), { segs: 10, radial: 10, side: UP }));
    const fwd = sx * 0.12;
    for (const [a0, len] of [[-0.44, 0.13], [0, 0.17], [0.44, 0.12]] as [number, number][]) {
      const a = a0 + fwd;
      const d = v(Math.sin(a), 0, Math.cos(a));
      const p0 = Bf.clone().addScaledVector(d, 0.01);
      const p1 = Bf.clone().addScaledVector(d, len * 0.55).setY(0.034);
      const p2 = Bf.clone().addScaledVector(d, len).setY(0.022);
      skinPart(model, sweep([p0, p1, p2], roundSec((t) => lerp(0.029, 0.02, t) + 0.004 * Math.exp(-(((t - 0.55) / 0.12) ** 2))), { segs: 8, radial: 8 }));
      const cg = group(model, tv(p2.clone().addScaledVector(d, 0.01)));
      orient(cg, d.clone().add(v(0, -0.35, 0)), UP);
      add(cg, clawGeo(0.042, 0.013), M.claw);
    }
    // The short spur on the heel
    const dS = v(-sx * 0.35, 0, -1).normalize();
    const s0 = Bf.clone().add(v(0, 0.0, -0.04));
    skinPart(model, sweep([s0, s0.clone().addScaledVector(dS, 0.04).setY(0.028), s0.clone().addScaledVector(dS, 0.065).setY(0.02)], roundSec((t) => lerp(0.018, 0.012, t)), { segs: 6, radial: 7 }));
    const sc = group(model, tv(s0.clone().addScaledVector(dS, 0.07).setY(0.02)));
    orient(sc, dS.clone().add(v(0, -0.3, 0)), UP);
    add(sc, clawGeo(0.022, 0.008), M.claw);
  }

  // ── Head: skull, muzzle, lower jaw, two cheeks, throat, eye mounds and back of the head grown into one whole with a distance field; the chin slightly lifted ──
  const HC = v(0, 1.3, 0.15);
  const NECK_TOP = v(0, 1.22, 0.1);
  const headPivot = group(body, tv(NECK_TOP));
  const headG = group(headPivot, tv(HC.clone().sub(NECK_TOP)), [-0.1, 0, 0]);
  const blob = new Blob();
  blob.add(v(0, 0.025, -0.02), v(0.132, 0.116, 0.142), undefined, 0.08);
  blob.add(v(0, -0.012, 0.125), v(0.09, 0.07, 0.125), undefined, 0.08);
  blob.add(v(0, -0.03, 0.212), v(0.07, 0.054, 0.058), undefined, 0.06);
  blob.add(v(0, -0.082, 0.075), v(0.097, 0.052, 0.138), undefined, 0.07);
  blob.add(v(0, -0.094, 0.158), v(0.058, 0.034, 0.066), undefined, 0.05);
  for (const sx of [-1, 1]) blob.add(v(sx * 0.094, -0.046, -0.005), v(0.06, 0.068, 0.074), undefined, 0.06);
  blob.add(v(0, -0.1, -0.06), v(0.094, 0.075, 0.094), undefined, 0.08);
  for (const sx of [-1, 1]) blob.add(v(sx * 0.086, 0.036, 0.07), v(0.054, 0.05, 0.05), undefined, 0.05);
  blob.add(v(0, 0.03, -0.13), v(0.1, 0.088, 0.06), undefined, 0.06);

  // Eyes: shot from the center of the head outward, up and forward to the surface, the eyeball sunk in by about half
  const ER = 0.052;
  const eyeSpots = [-1, 1].map((sx) => {
    const { p, n } = blob.hit(v(sx * 0.03, 0.03, 0.05), v(sx * 0.58, 0.3, 0.76));
    return { sx, E: p.clone().addScaledVector(n, -ER * 0.5), n };
  });
  // Brow ridge: above the eye, the inner end low and the outer end high and sweeping back (the sour face), growing on the skull
  const brows: THREE.Vector3[] = [];
  for (const { sx, E } of eyeSpots) {
    const c = E.clone().add(v(-sx * 0.012, ER * 0.98, ER * 0.18));
    brows.push(c);
    const ax = v(1, sx * 0.45, -sx * 0.5).normalize();
    const ay = UP.clone().addScaledVector(ax, -ax.dot(UP)).add(v(0, 0, 0.25)).normalize();
    const az = new THREE.Vector3().crossVectors(ax, ay).normalize();
    ay.crossVectors(az, ax).normalize();
    blob.add(c, v(0.068, 0.025, 0.044), new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, ay, az)), 0.045);
  }

  // Mouth line: from the muzzle tip around both sides to below the eyes; flat on the left, the right corner of the mouth (-x) hooked up
  const PHI = 1.15;
  const mouthY = (phi: number) => {
    const u = clamp(phi / PHI, -1, 1);
    // One flat line, the left corner of the mouth drooping slightly; only the last stretch of the right corner hooks up (a sneer, not a grin)
    return -0.064 - 0.005 * u ** 4 + 0.024 * Math.pow(Math.max(0, -u), 7);
  };
  const toMouthOrigin = (phi: number) => v(0, mouthY(phi), 0.03);
  const headColor = (p: THREE.Vector3, n: THREE.Vector3) => {
    const phi = Math.atan2(p.x, p.z - 0.03);
    const ap = Math.abs(phi);
    const yb = ap <= PHI ? mouthY(phi) : mouthY(Math.sign(phi) * PHI) - 0.3 * (ap - PHI);
    const jaw = sstep(yb - p.y, -0.003, 0.008);
    let c = cRed.clone().lerp(cOrange, sstep(yb - p.y + 0.05, 0, 0.05) * 0.7);
    for (const b of brows) c.lerp(cBrow, (1 - sstep(p.distanceTo(b), 0.03, 0.068)) * 0.95);
    // Slightly darker above the muzzle tip, so the length of the muzzle can be read
    c.lerp(cRedD, sstep(p.z, 0.2, 0.27) * sstep(p.y, -0.04, 0.0) * 0.35);
    c = c.lerp(cCream, jaw);
    return c.lerp(cGroove, jaw * sstep(-n.y, 0.6, 0.95) * 0.25);
  };
  add(headG, blobGeo(blob, v(0, -0.01, 0.03), 17, v(0, 0.05, 1), 0.3, headColor), M.skin).userData.inkGroup = HEAD;

  // Mouth line (a dark thin tube) and the small fang at the right corner of the mouth
  const mouthPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const phi = -PHI + (2 * PHI * i) / 28;
    const { p, n } = blob.hit(toMouthOrigin(phi), v(Math.sin(phi), 0, Math.cos(phi)));
    mouthPts.push(p.addScaledVector(n, 0.0015));
  }
  add(headG, sweep(mouthPts, (t, a) => {
    const r = 0.0068 * Math.pow(Math.sin(PI * t), 0.3) + 0.0008;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, { segs: 36, radial: 6 }), M.dark);
  {
    const phi = -0.8;
    const { p, n } = blob.hit(toMouthOrigin(phi), v(Math.sin(phi), 0, Math.cos(phi)));
    const fg = group(headG, tv(p.addScaledVector(n, 0.004).add(v(0, 0.004, 0))));
    orient(fg, v(0, -1, 0.15), n);
    add(fg, solid(clawGeo(0.03, 0.0095), 0xf6ecd6), M.horn);
  }
  // Nostrils: two small dimples above the muzzle tip
  for (const sx of [-1, 1]) {
    const { p, n } = blob.hit(v(0, -0.01, 0.15), v(sx * 0.24, 0.42, 0.87));
    const g = group(headG, tv(p));
    g.quaternion.setFromUnitVectors(UP, n);
    add(g, new THREE.SphereGeometry(1, 8, 5), M.dark, [0, -0.002, 0], [0, sx * 0.5, 0], [0.012, 0.005, 0.008]);
  }

  // A pair of horns at the back of the head: curving back and up, dark red at the root to ivory at the tip
  const cHornB = col(0x7a2e24);
  const cHornT = col(0xf4e6c6);
  for (const sx of [-1, 1]) {
    const { p, n } = blob.hit(v(sx * 0.02, 0.04, -0.03), v(sx * 0.68, 0.46, -0.57));
    const r0 = p.clone().addScaledVector(n, -0.03);
    const pts = [r0, p.clone().add(v(sx * 0.02, 0.03, -0.05)), p.clone().add(v(sx * 0.045, 0.075, -0.12)), p.clone().add(v(sx * 0.06, 0.11, -0.19))];
    const g = sweep(pts, (t, a, len) => {
      const r = 0.031 * Math.pow(1 - t, 0.85) + 0.0015;
      const u = Math.min(1, ((1 - t) * len) / 0.01);
      const k = Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
      return [Math.cos(a) * r * k, Math.sin(a) * r * k];
    }, { segs: 12, radial: 9 });
    const tip = pts[3];
    const L = 0.2;
    add(headG, paint(g, (q) => cHornB.clone().lerp(cHornT, sstep(L - q.distanceTo(tip), 0.05, 0.14))), M.horn);
  }

  // Head crest: a fan-shaped crest on top of the head sweeping back, four spikes hooked backward on the trailing edge; a dark red base and gold-orange edge, the crest root buried in the skull
  {
    const pts: [number, number][] = [];
    // Upper edge (z, y): from in front of the forehead along a quadratic curve back and up, then back and down to the last spike
    const P0 = [0.07, 0.15];
    const P1 = [0.02, 0.34];
    const P2 = [-0.3, 0.165];
    const bez = (u: number): [number, number] => [(1 - u) ** 2 * P0[0] + 2 * u * (1 - u) * P1[0] + u * u * P2[0], (1 - u) ** 2 * P0[1] + 2 * u * (1 - u) * P1[1] + u * u * P2[1]];
    const nrmAt = (u: number): [number, number] => {
      const a = bez(Math.max(0, u - 0.01));
      const b = bez(Math.min(1, u + 0.01));
      const dz = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dz, dy);
      return [dy / l, -dz / l];
    };
    const edge = (u: number, off: number, lean: number): [number, number] => {
      const [z, y] = bez(u);
      const [nz, ny] = nrmAt(u);
      return [z + nz * off - lean, y + ny * off];
    };
    pts.push([0.075, 0.07]);
    pts.push(edge(0, 0, 0));
    const N = 4;
    for (let k = 0; k < N; k++) {
      const u0 = 0.06 + (k / N) * 0.94;
      const w = 0.94 / N;
      pts.push(edge(u0 + w * 0.15, 0.0, 0));
      pts.push(edge(u0 + w * 0.55, 0.022, 0));
      pts.push(edge(u0 + w * 0.8, 0.048 + k * 0.004, 0.018));
      pts.push(edge(u0 + w * 0.95, 0.012, 0));
    }
    pts.push([-0.24, 0.11], [-0.15, 0.07], [-0.07, 0.05], [0.02, 0.05]);
    const g = slab(outline(pts), 0.02, 0.0075, 2);
    g.rotateY(-PI / 2);
    g.deleteAttribute('uv');
    // The extruded body's own normals on each face are kept: the crest face is one flat sheet, and the bevels are facets
    const gm = g;
    const cCrest = col(0xa3261f);
    const cCrestE = col(0xf2a43c);
    add(headG, paint(gm, (q) => cCrest.clone().lerp(cCrestE, sstep(Math.hypot(q.z + 0.03, q.y - 0.02), 0.21, 0.27))), M.skin).userData.inkGroup = HEAD;
  }

  // Eyes: the eyeball half set into the socket; a golden iris, vertical pupil; the upper and lower eyelids are shells in the scaly-skin color, a line of dark eyeliner at the lip; the inner corner of the upper lid pressed down a little (the sour face, not drooping eyes)
  const UP_OPEN = 0.74;
  const LO_OPEN = 0.62;
  const cLid = cRed.clone();
  const cLine = col(0x4a1a14);
  const lidUp = lidGeo(ER + 0.004, ER + 0.013, PI / 2, 16, 4.4, cLid, cLine);
  const lidLow = lidGeo(ER + 0.003, ER + 0.009, PI / 2, 14, 4.0, cLid, cLine, 0.11, true);
  const irisG = irisGeo(ER + 0.0008, [[0.13, 0.46, col(0x1c0c08)], [0.5, 0.52, col(0xffc53a)], [0.72, 0.72, col(0xf07d1a)], [0.8, 0.8, col(0x5a2410)]], 22);
  const eyeAnchors: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  const uppers: { g: THREE.Group; roll: number }[] = [];
  for (const { sx, E, n } of eyeSpots) {
    const f = n.clone().multiplyScalar(0.35).add(v(sx * 0.52, 0.1, 0.85).normalize()).normalize();
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    const eg = group(headG, tv(E));
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    eyeAnchors.push(group(eg, [0, 0, ER]));
    add(eg, new THREE.SphereGeometry(ER, 16, 10), M.sclera);
    // The eye socket faces outward and the gaze faces forward: the iris turns toward the nose side and up
    const gz = group(eg, [0, 0, 0], [-0.08, -sx * 0.3, 0]);
    add(gz, irisG, M.iris);
    for (const [x, y, rr] of [[-0.3 * sx, 0.3, 0.013], [0.26 * sx, -0.24, 0.006]] as [number, number, number][]) {
      const hl = add(gz, new THREE.SphereGeometry(rr, 8, 5), M.hi, [x * ER, y * ER, ER * 0.97]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    const roll = sx * 0.28;
    const upper = group(eg, [0, 0, 0]);
    upper.rotation.set(-UP_OPEN, 0, roll, 'ZYX');
    add(upper, lidUp, M.skin).userData.inkGroup = HEAD;
    uppers.push({ g: upper, roll });
    // The lower eyelid does not move: it hangs on the head (same position, same orientation) and is merged into the head's mesh
    const lower = group(headG, tv(E));
    lower.quaternion.copy(eg.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(PI + LO_OPEN, 0, -roll * 0.4, 'ZYX')));
    add(lower, lidLow, M.skin).userData.inkGroup = HEAD;
  }

  // ── Arms: short and sturdy; the right hand holds the sword on the shoulder and the left hand makes a fist hanging at the side ──
  const armR = group(body, [-0.13, 0.97, 0.0]);
  const armL = group(body, [0.13, 0.97, 0.0]);
  // Upper arm to forearm is one loft (the elbow bent, not two tubes)
  const armProf = curveTable([[0, 0.066], [0.3, 0.058], [0.5, 0.05], [0.75, 0.045], [1, 0.04]]);
  const armPart = (g: THREE.Group, pts: THREE.Vector3[]) => {
    const o = g.position;
    skinPart(g, sweep(pts.map((p) => p.clone().sub(o)), roundSec((t) => armProf(t)[0]), { segs: 20, radial: 10 }));
  };
  const FR = v(-0.19, 0.905, 0.245);
  armPart(armR, [v(-0.12, 0.975, 0.0), v(-0.2, 0.9, 0.0), v(-0.238, 0.822, 0.03), v(-0.23, 0.85, 0.12), v(-0.205, 0.885, 0.2)]);
  armPart(armL, [v(0.12, 0.975, 0.0), v(0.2, 0.89, -0.01), v(0.235, 0.8, 0.0), v(0.235, 0.73, 0.04), v(0.222, 0.67, 0.075)]);

  /** Fist: the fist body, four knuckles, the thumb; the +y of g is the direction the knuckles are lined up, kn is the knuckle side, th is the position of the thumb; with claws, a small claw in front of each knuckle */
  const fist = (g: THREE.Group, kn: THREE.Vector3, th: THREE.Vector3, claws: boolean) => {
    const k = kn.clone().normalize();
    add(g, paint(new THREE.SphereGeometry(1, 12, 9).scale(0.05, 0.056, 0.047), limbColor), M.skin).userData.inkGroup = BODY;
    for (let i = 0; i < 4; i++) {
      const y = 0.03 - i * 0.02;
      add(g, paint(new THREE.SphereGeometry(1, 8, 6).scale(0.019, 0.013, 0.019), limbColor), M.skin, tv(k.clone().multiplyScalar(0.04).add(v(0, y, 0)))).userData.inkGroup = BODY;
      if (claws && i < 3) {
        const cg = group(g, tv(k.clone().multiplyScalar(0.05).add(v(0, y - 0.006, 0))));
        orient(cg, k.clone().add(v(0, -0.6, 0)), UP);
        add(cg, clawGeo(0.016, 0.006), M.claw);
      }
    }
    add(g, paint(new THREE.SphereGeometry(1, 8, 6).scale(0.02, 0.028, 0.018), limbColor), M.skin, tv(th)).userData.inkGroup = BODY;
  };
  {
    // The left fist hangs at the side: knuckles outward, the thumb at the front and up
    const lf = group(armL, tv(v(0.217, 0.64, 0.098).sub(armL.position)));
    orient(lf, v(0.05, 0.2, 1), v(1, -0.45, 0));
    fist(lf, v(0, 0, 1), v(-0.028, 0.03, 0.03), true);
  }

  // ── Flame-pattern sword: y along the blade. An iron-red wavy blade, a glowing fuller down the middle, a flame-tongue-shaped guard, a leather grip, an ember gem on the pommel ──
  const D = v(-0.33, 0.62, -0.71).normalize();
  const xS = X.clone().addScaledVector(D, -D.dot(X)).normalize();
  const zS = new THREE.Vector3().crossVectors(xS, D).normalize();
  const swordG = group(armR, tv(FR.clone().sub(armR.position)));
  swordG.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xS, D, zS));
  const swordRest = swordG.quaternion.clone();
  // Fist: knuckles outward and forward (the -x and +z of the sword's coordinates)
  fist(swordG, v(-0.55, 0, 0.8), v(0.03, 0.035, 0.02), false);
  {
    // Grip: a cylinder wrapped in leather
    const prof: [number, number][] = [[0.001, -0.09], [0.017, -0.09]];
    for (let i = 0; i <= 8; i++) {
      const y = -0.085 + i * 0.02;
      prof.push([0.018, y - 0.005], [0.0205, y + 0.002]);
    }
    prof.push([0.017, 0.085], [0.001, 0.085]);
    add(swordG, lathe(prof, 12), M.grip);
    // Pommel: an iron-red seat holding an ember gem pointing down
    add(swordG, paint(lathe([[0.001, -0.108], [0.024, -0.11], [0.03, -0.1], [0.026, -0.09], [0.001, -0.086]], 14), (p) => col(0x7a4a42).lerp(col(0xb8866e), sstep(Math.hypot(p.x, p.z), 0.024, 0.03))), M.iron);
    const gem = brilliant(0.02, 0.01, 0.022, 8);
    gem.rotateX(PI);
    add(swordG, gem, M.ember, [0, -0.114, 0]);
    // Guard: both ends curling up toward the blade like tongues of flame
    const gp = [v(-0.118, 0.13, 0.0), v(-0.1, 0.098, 0), v(-0.055, 0.092, 0), v(0, 0.098, 0), v(0.055, 0.092, 0), v(0.1, 0.098, 0), v(0.118, 0.13, 0)];
    const guard = sweep(gp, (t, a, len) => {
      const r = 0.015 - 0.007 * Math.abs(2 * t - 1) ** 1.5;
      const u0 = Math.min(1, (t * len) / 0.008);
      const u1 = Math.min(1, ((1 - t) * len) / 0.008);
      const k = Math.sqrt(Math.max(0, 1 - (1 - u0) ** 2)) * Math.sqrt(Math.max(0, 1 - (1 - u1) ** 2));
      return [Math.cos(a) * r * k, Math.sin(a) * r * 0.8 * k];
    }, { segs: 22, radial: 8, side: v(0, 0, 1) });
    add(swordG, paint(guard, (p) => col(0x6d4540).lerp(col(0xc0906e), sstep(Math.abs(p.x), 0.07, 0.11))), M.iron).userData.inkGroup = BLADE;
    add(swordG, solid(new THREE.BoxGeometry(0.05, 0.03, 0.03), 0x6d4540), M.iron, [0, 0.105, 0]).userData.inkGroup = BLADE;
  }
  const BL0 = 0.098;
  const BLEN = 0.8;
  const bladeW = (s: number) => 0.05 * (1 - 0.3 * s) * (s > 0.84 ? Math.sqrt(Math.max(0, (1 - s) / 0.16)) : 1) + 0.0008;
  const bladeWave = (s: number) => 0.011 * Math.sin(2 * PI * s * 5.5) * sstep(s, 0.06, 0.18) * (1 - sstep(s, 0.82, 0.96));
  const bladeT = (s: number) => 0.0105 * (1 - 0.45 * s) + 0.002;
  const FUL = 0.7;
  {
    const rows: number[] = [];
    for (let i = 0; i <= 44; i++) rows.push(i / 44);
    rows.push(0.9, 0.93, 0.955, 0.975, 0.99);
    rows.sort((a, b) => a - b);
    const half = [0, 0.35, 0.72, 1.02, 1.24, 1.4, PI / 2, PI - 1.4, PI - 1.24, PI - 1.02, PI - 0.72, PI - 0.35];
    const phis = [...half, ...half.map((p) => p + PI)];
    const cDark = col(0x5d4b4a);
    const cBevel = col(0xe2d6d0);
    const cGr = col(0x3a1d18);
    const pos: number[] = [];
    const cl: number[] = [];
    for (const s of rows) {
      const w = bladeW(s);
      const c = bladeWave(s);
      const th = bladeT(s);
      const y = BL0 + s * BLEN;
      const fm = sstep(s, 0.015, 0.05) * (1 - sstep(s, FUL - 0.05, FUL));
      for (const ph of phis) {
        const xw = w * Math.cos(ph);
        const gr = 0.5 * Math.exp(-((xw / 0.012) ** 2)) * fm;
        const z = th * Math.sin(ph) * (1 - gr);
        pos.push(c + xw, y, z);
        const e = Math.abs(Math.cos(ph));
        const cc = cDark.clone().lerp(cBevel, sstep(e, 0.72, 0.92)).lerp(cGr, sstep(gr, 0.15, 0.35));
        cl.push(cc.r, cc.g, cc.b);
      }
    }
    const nc = phis.length;
    const idx: number[] = [];
    for (let i = 0; i < rows.length - 1; i++)
      for (let j = 0; j < nc; j++) {
        const j2 = (j + 1) % nc;
        const a = i * nc + j;
        const b = (i + 1) * nc + j;
        const c = i * nc + j2;
        const d = (i + 1) * nc + j2;
        idx.push(a, c, b, b, c, d);
      }
    // Bottom end closed off (buried in the seat of the guard)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Winding check: the normal in the middle of the front face of the blade must face +z
    const nz = (g.attributes.normal as THREE.BufferAttribute).getZ(Math.floor(rows.length / 2) * nc + 6);
    if (nz < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    add(swordG, g, M.blade).userData.inkGroup = BLADE;
    // The glowing core in the fuller: a thin flat strip following the wave, showing a little from the bottom of the groove on both faces
    const fp: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const s = 0.03 + (i / 24) * (FUL - 0.08);
      fp.push(v(bladeWave(s), BL0 + s * BLEN, 0));
    }
    add(swordG, loft(fp, (t) => {
      const s = 0.03 + t * (FUL - 0.08);
      const k = Math.min(1, t * 12, (1 - t) * 12);
      return [0.0055 * Math.min(1, k * 1.5), (bladeT(s) * 0.5 + 0.0012) * Math.min(1, k * 1.5)];
    }, { segs: 40, radial: 8, side: X }), M.fuller);
  }

  // ── Iron-red pauldron on the left shoulder: a dome and a ring of plates, with a center ridge and three brass rivets on the dome ──
  const PAUL = v(0.158, 0.985, -0.005);
  const paulG = group(body, tv(PAUL));
  orient(paulG, v(0.6, 0.8, 0.02), v(0.8, -0.6, 0));
  {
    const cIron = col(0x8c5448);
    const cEdge = col(0xe0b080);
    const R = 0.115;
    add(paulG, lidGeo(R - 0.012, R, 1.02, 22, PI * 2, cIron, cEdge, 0.1), M.iron);
    add(paulG, bandGeo(R - 0.022, R - 0.009, 0.98, 1.34, 22, cIron, cEdge), M.iron);
    // Center ridge: along the meridian going down (+z)
    const rp: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = 0.08 + (i / 8) * 0.86;
      rp.push(v(0, Math.cos(a) * (R + 0.002), Math.sin(a) * (R + 0.002)));
    }
    add(paulG, paint(loft(rp, (t) => {
      const k = Math.min(1, t * 6, (1 - t) * 6);
      return [0.007 * k, 0.009 * k];
    }, { segs: 16, radial: 6, side: X }), () => cEdge), M.iron);
    const cBrass = col(0xe8bc68);
    for (const az of [-0.75, 0.75, -1.7, 1.7]) {
      const a = 0.82;
      const n = v(Math.sin(a) * Math.sin(az), Math.cos(a), Math.sin(a) * Math.cos(az));
      const m = rivet(paulG, M.iron, tv(n.clone().multiplyScalar(R)), tv(n), 0.011);
      m.geometry = solid(m.geometry.clone(), cBrass);
    }
  }

  // ── Neckerchief: a ring of deep blue band (with silver trim) around the neck, knotted at the nape, a silver shield badge on the knot, two swallowtail strap ends drifting back ──
  const TS = 0.075;
  const sIdx = ts.reduce((best, t, i) => (Math.abs(t - TS) < Math.abs(ts[best] - TS) ? i : best), 0);
  const sf = frames[sIdx];
  const [sa, sb, sdy] = prof(ts[sIdx]);
  const cNavy = col(0x3a4f86);
  const cNavyIn = col(0x26345c);
  const cTrim = col(0xdfe3ea);
  const BAND_W = 0.058;
  const GAP = 0.013;
  const bandAt = (u: number, w: number) => {
    const th = u * PI * 2;
    const s = Math.sin(th);
    const droop = 0.028 * Math.pow(Math.max(0, -s), 2);
    return sf.C.clone()
      .addScaledVector(sf.T, (w - 0.5) * BAND_W + droop)
      .addScaledVector(sf.W, Math.cos(th) * (sa + GAP))
      .addScaledVector(sf.H, s * (sb + GAP) + sdy);
  };
  add(body, thickSheet(56, 4, bandAt, () => 0.017, {
    wrapU: true,
    E: 2,
    outward: (p) => p.clone().sub(sf.C),
    color: (u, w, side) => (side > 0 ? cNavy.clone().lerp(cTrim, sstep(Math.abs(w - 0.5), 0.34, 0.42)) : cNavyIn.clone()),
  }), M.cloth).userData.inkGroup = SCARF;
  // Knot: two puffed cloth balls with a knot eye in the middle
  const KNOT = bandAt(0.25, 0.5).addScaledVector(sf.H, 0.022);
  for (const s of [-1, 1]) add(body, solid(new THREE.SphereGeometry(1, 12, 8), cNavy), M.cloth, tv(KNOT.clone().addScaledVector(sf.W, s * 0.036)), [0, 0, s * 0.3], [0.034, 0.026, 0.022]).userData.inkGroup = SCARF + 1;
  add(body, solid(new THREE.SphereGeometry(1, 10, 7), cNavyIn), M.cloth, tv(KNOT.clone().addScaledVector(sf.H, 0.006)), [0, 0, 0], [0.02, 0.024, 0.018]).userData.inkGroup = SCARF + 2;
  // Silver shield badge: facing back (+H), with a sword-shaped ridge on the shield face
  const brooch = group(body, tv(KNOT.clone().addScaledVector(sf.H, 0.022)));
  orient(brooch, sf.T.clone().negate(), sf.H);
  {
    const K = 1.4;
    const shield = outline(([[-0.024, 0.022], [0.024, 0.022], [0.024, -0.002], [0.012, -0.02], [0, -0.028], [-0.012, -0.02], [-0.024, -0.002]] as [number, number][]).map(([x, y]) => [x * K, y * K] as [number, number]));
    add(brooch, slab(shield, 0.009, 0.0035, 3), M.silver);
    add(brooch, new THREE.BoxGeometry(0.008, 0.05, 0.007), M.silver, [0, -0.003, 0.008]);
    add(brooch, new THREE.BoxGeometry(0.028, 0.007, 0.007), M.silver, [0, 0.011, 0.008]);
  }
  // Two strap ends: from the knot going down, drifting to the sides and back, the ends cut into swallowtails
  const scarfTails: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const tg = group(body, tv(KNOT));
    const LEN = 0.34;
    const WID = 0.062;
    const cen = (w: number) =>
      sf.T.clone().multiplyScalar(w * LEN * 0.85)
        .addScaledVector(sf.H, 0.012 + w * 0.12 + 0.025 * Math.sin(w * PI))
        .addScaledVector(sf.W, sx * (0.03 + w * 0.09 + 0.012 * Math.sin(w * PI * 2)));
    const wdir = sf.W.clone().multiplyScalar(1).addScaledVector(sf.T, sx * 0.35).normalize();
    const geo = thickSheet(6, 14, (u, w) => {
      const x = u - 0.5;
      // Swallowtail: short in the middle at the end and long at the two corners
      const wl = w * (1 - 0.2 * (1 - Math.abs(2 * x)) * sstep(w, 0.7, 1));
      return cen(wl).addScaledVector(wdir, x * WID * (0.8 + 0.3 * wl));
    }, () => 0.014, {
      E: 2,
      outward: () => sf.H.clone(),
      color: (u, w, side) => (side > 0 ? cNavy.clone().lerp(cTrim, Math.max(sstep(Math.abs(u - 0.5), 0.36, 0.44), sstep(w, 0.9, 0.96))) : cNavyIn.clone()),
    });
    add(tg, geo, M.cloth).userData.inkGroup = SCARF + 3 + (sx > 0 ? 1 : 0);
    scarfTails.push({ g: tg, sx });
  }

  // ── Tail flame: a tuft of fire leaping up at the tail tip, four tongues of flame (the middle one tallest), pale yellow at the root, orange in the middle and red-orange at the tips ──
  const flameG = group(body, tv(tipRest));
  const flameIn = group(flameG);
  {
    const cB = col(0xfff1b0);
    const cM = col(0xffa030);
    const cT = col(0xf25a1c);
    const tongue = (pts: THREE.Vector3[], w: number) => {
      const g = loft(pts, curveTable([[0, 0, 0], [0.1, w * 0.8, w * 0.7], [0.35, w, w * 0.85], [0.7, w * 0.5, w * 0.42], [1, 0, 0]]), { segs: 16, radial: 10, side: X });
      const top = pts[pts.length - 1].y;
      return paint(g, (p) => cB.clone().lerp(cM, sstep(p.y, 0.02, top * 0.45)).lerp(cT, sstep(p.y, top * 0.6, top * 0.95)));
    };
    add(flameIn, tongue([v(0, -0.02, 0), v(0.004, 0.08, 0.01), v(-0.022, 0.17, -0.004), v(0.012, 0.27, -0.01)], 0.056), M.flame).userData.inkGroup = FLAME;
    for (const [az, h, w, lean] of [[0.5, 0.17, 0.036, 0.06], [2.6, 0.15, 0.034, 0.055], [4.4, 0.19, 0.038, 0.05]] as [number, number, number, number][]) {
      const d = v(Math.sin(az), 0, Math.cos(az));
      const pts = [v(0, 0, 0), d.clone().multiplyScalar(lean * 0.6).setY(h * 0.35), d.clone().multiplyScalar(lean).setY(h * 0.7).add(v(0, 0, 0)), d.clone().multiplyScalar(lean * 0.7).setY(h)];
      add(flameIn, tongue(pts, w), M.flame).userData.inkGroup = FLAME;
    }
    add(flameIn, paint(new THREE.SphereGeometry(0.048, 12, 8), () => cB), M.flame, [0, 0.01, 0]).userData.inkGroup = FLAME;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle and action weights ──
  const act = { focus: 0, charge: 0, flare: 0 };
  let lastFlare = Number.NaN;
  const qTmp = new THREE.Quaternion();
  const D_CHARGE = v(-0.08, 0.12, 1).normalize();
  const qCharge = new THREE.Quaternion().setFromUnitVectors(D, D_CHARGE).multiply(swordRest);
  const update = (t: number) => {
    const f = act.focus;
    const ch = act.charge;
    const fl = act.flare;
    // Breathing: about the pelvis, the chest rising and falling
    const br = Math.sin(t * 2.1);
    hips.scale.set(1 + br * 0.006, 1 + br * 0.004, 1 + br * 0.008);
    hips.rotation.x = ch * 0.2 + Math.sin(t * 2.1 - 0.6) * 0.006;
    // Looking around with a sidelong glance: the head turns slowly, and when charging up the head lifts to face forward
    const look = (1 - f) * (1 - ch);
    headPivot.rotation.set(-ch * 0.2 + look * 0.035 * Math.sin(t * 0.6 + 1), look * (0.24 * Math.sin(t * 0.43) + 0.05 * Math.sin(t * 1.27)), 0);
    // Blink: once every 4.1 seconds, and one time in three it blinks twice in a row
    const bt = t % 4.1;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
    const close = Math.max(bk(bt - 3.7), Math.floor(t / 4.1) % 3 === 1 ? bk(bt - 3.4) : 0);
    for (const u of uppers) u.g.rotation.set(lerp(-UP_OPEN, LO_OPEN - 0.12, close), 0, u.roll, 'ZYX');
    for (const g of glints) g.visible = close < 0.6;
    // Impatiently lifting the sword off the shoulder and putting it back: once every 5.3 seconds
    const tp = t % 5.3;
    const tap = tp > 4.2 ? Math.sin(((tp - 4.2) / 1.1) * PI) * (tp < 4.75 ? 1 : 0.8) : 0;
    armR.rotation.set(0.08 * tap * (1 - ch) - ch * 0.25, 0, 0.05 * tap * (1 - ch));
    qTmp.copy(swordRest).slerp(qCharge, ch);
    swordG.quaternion.copy(qTmp);
    armL.rotation.set(Math.sin(t * 2.1 + 0.4) * 0.02 - ch * 0.2, 0, Math.sin(t * 0.9) * 0.02);
    // The tail slowly swaying along the ground; stretched taut when charging up
    const ang = (1 - ch) * (0.09 * Math.sin(t * 0.75) + 0.025 * Math.sin(t * 1.9 + 0.7));
    bendTail(ang);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const dx = tipRest.x - tailPivot.x;
    const dz = tipRest.z - tailPivot.z;
    flameG.position.set(tailPivot.x + c * dx + s * dz, tipRest.y, tailPivot.z - s * dx + c * dz);
    // The tail flame larger and smaller with its mood: a slow rise and fall plus a quick jumping
    const mood = 1 + 0.08 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 12.1 + 1) + fl * 0.45 + ch * 0.2;
    flameIn.scale.set(1 + (mood - 1) * 0.4, mood, 1 + (mood - 1) * 0.4);
    flameIn.rotation.set(0.05 * Math.sin(t * 3.1), 0, 0.07 * Math.sin(t * 2.3 + 0.5) - ang * 0.5);
    // The neckerchief strap ends fluttering
    for (const st of scarfTails) st.g.rotation.set(0.05 * Math.sin(t * 1.7 + st.sx), 0, st.sx * 0.04 * Math.sin(t * 2.3 + st.sx * 0.8));
    // The emissive is written only when a weight changes (so that another spirit's ultimate changing uEmissiveAmt is not overwritten)
    if (fl !== lastFlare) {
      lastFlare = fl;
      M.fuller.emissiveIntensity = 0.75 + fl * 0.35;
      M.ember.emissiveIntensity = 0.6 + fl * 0.35;
      M.flame.emissiveIntensity = 0.45 + fl * 0.25;
    }
  };
  update(0);

  // Anchors
  const face = group(headG, [0, 0.02, 0.17]);
  const mouthA = group(headG, [0, -0.064, 0.262]);
  const crestA = group(headG, [0, 0.29, -0.04]);
  const hilt = group(swordG, [0, 0, 0]);
  const bladeA = group(swordG, [0, BL0 + BLEN * 0.5, 0]);
  const tipA = group(swordG, [0, BL0 + BLEN, 0]);
  const flameA = group(flameIn, [0, 0.1, 0]);
  const chest = group(body, [0, 0.93, 0.2]);
  const paulA = group(paulG, [0, 0.11, 0]);
  const broochA = group(brooch, [0, 0, 0.006]);
  const rig = {
    head: face,
    eyes: eyeAnchors,
    anchors: { mouth: mouthA, crest: crestA, hilt, blade: bladeA, swordTip: tipA, tailFlame: flameA, chest, pauldron: paulA, brooch: broochA },
  };

  // The whole animal is shifted so the x and z center of its bounding box lands on the origin (the lab bench turns about the origin)
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(model);
  model.position.set(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2);

  // Static parts merged (mesh budget R 50): groups that move act as owners; the torso has its vertices changed every frame and the eye highlights switch on and off, so they are not merged
  mergeStatic(root, {
    owners: [hips, body, headPivot, armR, armL, swordG, flameG, flameIn, ...scarfTails.map((s) => s.g), ...uppers.map((u) => u.g)],
    keep: [bodyMesh, ...glints],
    twins: [[M.sclera, M.iris]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.78, 0), radius: 0.95 };
}
