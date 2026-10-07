// Elderwood Warden (model lab version): a little bear with moss growing all over its back, who loves napping in a tree hollow; grown up, it carries a whole ancient tree on its back and is the most reliable gatekeeper of the Verdantwhisper Forest.
// Nature element, guardian role (skills are Carry the Log, Ram the Log, Grove-Guard Roar and Thousand-Layer Moss Armor: a wooden shield piled up layer by layer).
// Only one form (decided by the user, 2026-09-28): the builder takes no evolution stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features settled on (from the name, lore and skills):
// 1. A whole ancient tree slung diagonally across its back: a thick trunk, gray-brown with twisting bark grooves, running from behind the right hip slanting to outside the left shoulder (a "/" from the front),
//    the lower end a clump of roots curling outward (the whole tree is carried with its roots), the upper end a broken stump showing pale heartwood and a new sprout; under the stump an oak branch carries a few lobed leaves and two acorns.
//    The crown is not made into a ball: Sylvaron has a round crown on its antlers, while here there is only a broken stump and a small clump of leaves, the silhouette a slanted wooden stake.
// 2. A moss cape: a whole thick sheet of green moss draping from the nape over both shoulders, the lower edge round clumps of moss (the lore's "moss growing all over its back"), extending onto the sky-facing side of the ancient tree.
// 3. A bear's face: warm chestnut fur, a cream muzzle, a big dark nose, a bear's small round dark eyes (no sclera, one small point of highlight), a philtrum under the nose joining a lip line running back along the lower edge of the muzzle, and round ears with dark ear sockets inside.
// 4. A vine-rope strap and the gatekeeper badge: the vine rope carrying the ancient tree crosses the chest slantwise from the left shoulder around to the right hip, and on the chest hangs the round wooden badge the forest folk give a gatekeeper, a jade-colored leaf set in the middle.
// 5. Big bear paws: broad thick forepaws, four ivory claws; the right paw grips the vine rope on the chest (the most natural gesture for someone carrying a load), and the left paw hangs at the side.
// Body shape: an upright bear, with short thick legs, a round belly and a big head, its weight set firmly on the two big feet like a guard on duty; the ancient tree is taller than it is, the second line in the silhouette.
// Kept apart from Sylvaron: a warm-chestnut upright bear against a milk-white four-legged deer; a single slanted wooden stake against a round crown growing on the head; only a small clump of oak leaves, with no flowers, fruit clusters or curtains of hanging vines.
//
// Personality: an honest, stubborn gatekeeper bear who never gives an inch. Whoever comes, it blocks the way first, smiling as it blocks; what it carries on its back is the tree it napped in as a cub.
// Expression: made after a bear's face, not anthropomorphized. The small, dark, glossy round eyes fully open and looking level ahead, no sclera showing, only one small point of highlight; no human brows, no smiling mouth, and the muzzle is a bear's muzzle (big nose, philtrum, lip line drawn back).
// Its honesty and refusal to yield come from the body and posture: the big head held low, the feet planted firmly on the ground, the paws gripping the vine rope. No drooping eyes, no downward look, no eye bags.
// Gaze order: the face (cream muzzle, dark nose, dark bright eyes with highlights, the strongest contrast on the whole body) first, the diagonally carried ancient tree (the roots and the new sprout on the broken stump) second, and the moss cape, the wooden badge on the chest and the paws as support.
// Back: the back of the ancient tree has a tree hollow, its opening a ring of thickly curled bark, with a honeycomb stuffed inside and honey dripping from the opening onto the bark: this is the hollow it napped in as a cub, and now it is its snack cabinet.
// Restrained light effects: no emissive and no halo; the jade leaf and the honey rely only on gem shading and hard highlights.
//
// <Action table> (battle actions follow this table):
// - Idle: slow deep breathing (the belly rising and falling), the head slowly looking left and right, blinking, now and then twitching the left ear; the right paw gripping the vine rope never lets go; the oak leaves and new sprout on the stump sway lightly in the wind.
// - Move: heavy step after step, the body swaying left and right, the ancient tree swaying along.
// - Charge-up: both feet planted firmly, heaving the ancient tree from its back forward (act.heave).
// - Strike: the paw slaps forward (Paw Slap), or swings the ancient tree forward and smashes it down (Ram the Log); for Grove-Guard Roar it tilts the head back and opens the mouth (act.roar).
// - Hit: does not retreat, only lowers the head and sinks the shoulders, with the ancient tree shielding its back.
// - Victory: stands up straight, pats the wooden badge on its chest, and gives a "hey" of a grin.
// act: focus (0-1, stop looking around, look straight ahead), roar (0-1, head tilted back and mouth open), heave (0-1, the ancient tree swung up over the back and heaved forward).
// Anchors: rig.head (center of the face), rig.eyes (the surfaces of the two eyes), anchors.mouth (the mouth), nose (the nose tip), badge (the wooden badge on the chest), pawL / pawR (the left and right forepaws),
// log (middle of the ancient tree), logTop (the broken stump), roots (the clump of roots), hollow (the tree hollow on the back), branch (the tip of the oak branch). L / R are its own left and right.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, mergeStatic, outline, partKit, PI, rng, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const tv = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];

// ───────────────────────── Distance-field body ─────────────────────────

interface Ell {
  c: THREE.Vector3;
  r: THREE.Vector3;
  inv: THREE.Quaternion;
  k: number;
}

/** A smooth union of a few ellipsoids; f < 0 is inside. The bear's body, head, legs and paws all use it to grow one seamless whole, and it is also used to find points and normals on the surface */
class Blob {
  parts: Ell[] = [];
  private l = new THREE.Vector3();
  private q = new THREE.Vector3();
  add(c: THREE.Vector3, r: THREE.Vector3, k = 0.08, q = new THREE.Quaternion()): void {
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
  hit(o: THREE.Vector3, d: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } {
    const p = this.march(o, d.clone().normalize());
    return { p, n: this.grad(p) };
  }
}

/**
 * Wrap a distance field into a mesh: each vertex on a sphere is shot outward from center to the surface, the normals come from the distance field's gradient, and the color is decided by paint.
 * The vertex directions are squeezed toward focus (the angle θ from focus becomes θ - pull·sin θ), so the mesh is denser on the face than on the back of the head.
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

/** Grid surface: rows × cols points; wrapCols / wrapRows join the columns or rows back to the start (no seam) */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, wrapCols = false, wrapRows = false): THREE.BufferGeometry {
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
  for (let i = 0; i < (wrapRows ? rows : rows - 1); i++)
    for (let j = 0; j < (wrapCols ? cols : cols - 1); j++) {
      const i2 = (i + 1) % rows;
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = i2 * cols + j;
      const c = i * cols + j2;
      const d = i2 * cols + j2;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  return g;
}

/** Merge duplicate vertices (seams, closures) and then compute smooth normals */
function finish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/** The average of the whole mesh's normals must point away from ref, and if reversed it is flipped */
function orientOut(g: THREE.BufferGeometry, ref: (p: THREE.Vector3) => THREE.Vector3): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  let s = 0;
  for (let i = 0; i < pa.count; i++) s += ref(P.fromBufferAttribute(pa, i)).dot(N.fromBufferAttribute(na, i));
  if (s < 0) {
    const idx = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors) */
function paintGeo(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
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

type Sec = (t: number, th: number, len: number) => [number, number];

/**
 * Loft along a curve: sec(t, θ) returns the [width direction, height direction] coordinates on the cross-section. The width direction uses a parallel-transport frame (an upright tube that curls back does not twist),
 * and if side is given it is fixed toward it; the height direction = width × tangent, with the winding always facing outward.
 */
function sweep(pts: THREE.Vector3[], sec: Sec, o: { segs?: number; radial?: number; side?: THREE.Vector3; paint?: (t: number, th: number) => THREE.Color } = {}): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = o.segs ?? 32;
  const radial = o.radial ?? 16;
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
    return { p: C.clone().addScaledVector(W, x).addScaledVector(H, y), c: o.paint?.(t, th) };
  });
  return finish(g);
}

/** Round tube cross-section, both ends closed into hemispheres: rad(t) returns the radius */
function roundSec(rad: (t: number) => number, caps: [boolean, boolean] = [true, true]): Sec {
  return (t, th, len) => {
    let a = rad(t);
    if (caps[0]) {
      const u = Math.min(1, (t * len) / Math.max(rad(0), 1e-4));
      a *= Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
    }
    if (caps[1]) {
      const u = Math.min(1, ((1 - t) * len) / Math.max(rad(1), 1e-4));
      a *= Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
    }
    return [Math.cos(th) * a, Math.sin(th) * a];
  };
}

/** Align the group's +y to dirY and its +z to faceZ as far as possible */
function orient(g: THREE.Object3D, dirY: THREE.Vector3, faceZ: THREE.Vector3): void {
  const y = dirY.clone().normalize();
  const z = faceZ.clone().addScaledVector(y, -faceZ.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * A membrane with thickness (the moss cape): S(u, v) is the mid-surface, growing thick / 2 out to each side, the four edges closed into round lips.
 * color(u, v, side): side 1 is the outer side and -1 the inner side; the outer side is decided by outward(p).
 */
function thickSheet(
  NU: number,
  NV: number,
  S: (u: number, v: number) => THREE.Vector3,
  thick: (u: number, v: number) => number,
  o: { E?: number; color: (u: number, v: number, side: number) => THREE.Color; outward: (p: THREE.Vector3) => THREE.Vector3 },
): THREE.BufferGeometry {
  const cols = NU + 1;
  const rows = NV + 1;
  const E = o.E ?? 2;
  const P: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) P.push(S(i / NU, j / NV));
  const at = (i: number, j: number) => P[j * cols + i];
  const Nn: THREE.Vector3[] = [];
  const Su: THREE.Vector3[] = [];
  const Sv: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const su = at(Math.min(cols - 1, i + 1), j).clone().sub(at(Math.max(0, i - 1), j));
      const sv = at(i, Math.min(rows - 1, j + 1)).clone().sub(at(i, Math.max(0, j - 1)));
      Su.push(su);
      Sv.push(sv);
      Nn.push(su.clone().cross(sv).normalize());
    }
  for (let k = 0; k < P.length; k++) if (Nn[k].dot(o.outward(P[k])) < 0) Nn[k].negate();
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
    const [u, vv] = uvOf(k);
    const h = thick(u, vv) / 2;
    O.push(addV(P[k].clone().addScaledVector(Nn[k], h), Nn[k].clone(), o.color(u, vv, 1)));
    I.push(addV(P[k].clone().addScaledVector(Nn[k], -h), Nn[k].clone().negate(), o.color(u, vv, -1)));
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
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = j * cols + i + 1;
      const c = (j + 1) * cols + i + 1;
      const d = (j + 1) * cols + i;
      tri(O[a], O[b], O[c]);
      tri(O[a], O[c], O[d]);
      tri(I[a], I[b], I[c]);
      tri(I[a], I[c], I[d]);
    }
  // The round lips on the four edges
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
  const rings = L.map(({ k, e }) => {
    const n = Nn[k];
    const ee = e.clone().addScaledVector(n, -e.dot(n)).normalize();
    const [u, vv] = uvOf(k);
    const h = thick(u, vv) / 2;
    const cO = o.color(u, vv, 1);
    const cI = o.color(u, vv, -1);
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
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Eyelid shell: with +y as the top, covering to the lip angle, the edge a round lip; only the visible arc is made (when front is true it is centered on +z, otherwise on -z).
 * Near the lip it is painted with vertex colors in the eyeliner color, with no separate eyeliner shell layered on.
 */
function lidGeo(ri: number, ro: number, lip: number, front: boolean, skin: THREE.Color, rim: THREE.Color, rimW: number, arc = PI * 1.15, segs = 12): THREE.BufferGeometry {
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
  return paintGeo(m, (p) => skin.clone().lerp(rim, sstep(Math.atan2(Math.hypot(p.x, p.z), p.y), lip - rimW, lip - rimW + 0.05)));
}

/**
 * Iris and pupil: concentric ellipses (longitude radius, latitude radius) laid onto a sphere of radius r centered on +z, one mesh with vertex colors by ring;
 * at each boundary two overlapping rings of vertices are placed so the color boundary is hard. rings go from inside to outside, and within a ring is that ring's color.
 */
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

/** Oak leaf: a flat leaf growing out along +y (the thickness along z), four rounded lobes on each edge, the base closing into a leaf stalk */
function oakLeafGeo(L: number, W: number, depth: number, base: THREE.Color, tip: THREE.Color, N = 16): THREE.BufferGeometry {
  const half: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const env = Math.pow(Math.sin(PI * Math.min(1, 0.04 + t * 0.96)), 0.7) * (0.55 + 0.45 * sstep(t, 0, 0.55));
    const lobe = 0.6 + 0.4 * Math.pow(Math.abs(Math.cos(PI * 3.5 * t + 0.35)), 0.6);
    half.push([Math.max(0.0015, W * env * lobe), t * L]);
  }
  const pts: [number, number][] = [[0, -0.012 * L / 0.1], ...half.map(([x, y]) => [x, y] as [number, number])];
  for (let i = N - 1; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
  const g = new THREE.ExtrudeGeometry(outline(pts), { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  return paintGeo(g, (p) => base.clone().lerp(tip, sstep(p.y / L, 0.2, 0.95)));
}

/** A closed ring tube (the vine ring around the trunk): pts is a ring of center-line points, out is the outward direction at each point; rad(i, a) can make twisted strands */
function ringTube(pts: THREE.Vector3[], out: THREE.Vector3[], radial: number, rad: (i: number, a: number) => number, paint: (i: number, a: number) => THREE.Color): THREE.BufferGeometry {
  const n = pts.length;
  const g = gridGeo(n, radial, (i, j) => {
    const T = pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]).normalize();
    const Nn = out[i].clone().addScaledVector(T, -out[i].dot(T)).normalize();
    const B = new THREE.Vector3().crossVectors(T, Nn);
    const a = (j / radial) * PI * 2;
    const r = rad(i, a);
    return { p: pts[i].clone().addScaledVector(Nn, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r), c: paint(i, a) };
  }, true, true);
  g.computeVertexNormals();
  const cen = new THREE.Vector3();
  for (const p of pts) cen.add(p);
  cen.divideScalar(n);
  // The normals must point away from the tube's center line
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const P = new THREE.Vector3().fromBufferAttribute(pa, 0);
  if (P.sub(pts[0]).dot(new THREE.Vector3().fromBufferAttribute(na, 0)) < 0) {
    const idx = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildElderwoodWardenLab(): LabModel {
  const rand = rng(20261009);
  const RIMC = 0xffdcb4;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    dark: vc(labToon(0xffffff, { rim: 0 })),
    nose: labToon(0x2c1d1d, { rim: 0.3, rimColor: RIMC, spec: 0.8, specTh: 0.985 }),
    eyeball: labToon(0x1a110b, { rim: 0.2, rimColor: RIMC, spec: 0.9, specTh: 0.97 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    moss: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xe4f7b8 })),
    bark: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC, speckle: 0.12 })),
    plant: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xeaf5c8 })),
    honey: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.35, rimColor: 0xffe6a0, spec: 0.9, specTh: 0.975 })),
    jade: labToon(0x5ac888, { ramp: 'gem', rim: 0.25, rimColor: 0xe0ffe8, spec: 0.7, specTh: 0.97 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const cFur = col(0x8c5634);
  const cFurD = col(0x683c24);
  const cFurL = col(0xa46c43);
  const cBelly = col(0xc99c6a);
  const cMuz = col(0xf1ddb8);
  const cEarIn = col(0x4e2c1e);
  const cClaw = col(0xece1c8);
  const cClawD = col(0xb9a684);
  const cLiner = col(0x2c1812);

  const root = new THREE.Group();
  root.name = 'elderwood_warden-lab';
  const { add, group } = partKit();
  // The whole animal is moved by one group so the center of its bounding box lands on the origin (the lab bench turns about the origin; the ancient tree is behind, so it is shifted forward)
  const model = group(root, [-0.04, 0, 0.12]);
  const body = group(model);

  // Outline part indices: within the same group lines are drawn only at normal creases
  const BODY = 9701;
  const HEAD = 9702;
  const LEG = 9703;
  const MOSS = 9704;

  // ── Body: rump, belly, chest, two shoulders, neck and the muscle hump on the shoulders and back, smoothly united into one whole; the belly a patch of light brown ──
  const bodyB = new Blob();
  bodyB.add(v(0, 0.44, -0.02), v(0.31, 0.24, 0.26), 0.12);
  bodyB.add(v(0, 0.57, 0.06), v(0.29, 0.27, 0.25), 0.12);
  bodyB.add(v(0, 0.8, 0.0), v(0.28, 0.2, 0.22), 0.12);
  for (const sx of [-1, 1]) bodyB.add(v(sx * 0.2, 0.87, -0.03), v(0.14, 0.12, 0.15), 0.1);
  bodyB.add(v(0, 0.97, 0.0), v(0.18, 0.13, 0.16), 0.1);
  bodyB.add(v(0, 0.9, -0.1), v(0.21, 0.15, 0.15), 0.1);
  const BC = v(0, 0.64, 0);
  const bodyPaint = (p: THREE.Vector3, n: THREE.Vector3) => {
    const c = cFur.clone().lerp(cFurD, sstep(-n.z, 0.2, 0.8) * 0.3 + sstep(0.36 - p.y, 0, 0.14) * 0.45);
    const e = Math.hypot(p.x / 0.2, (p.y - 0.52) / 0.22);
    const belly = (1 - sstep(e, 0.86, 1.0)) * sstep(n.z, 0.2, 0.45);
    return c.lerp(cBelly, belly);
  };
  add(body, blobGeo(bodyB, BC, 13, v(0, 0.1, 1), 0.2, bodyPaint), M.fur).userData.inkGroup = BODY;

  // ── Legs: thick short thighs, shins and big feet, with four toe pads at the front of each foot; outlined separately from the body (the junction of thigh and belly is a natural line) ──
  for (const sx of [-1, 1]) {
    const lb = new Blob();
    lb.add(v(sx * 0.19, 0.34, -0.02), v(0.15, 0.18, 0.17), 0.1);
    lb.add(v(sx * 0.2, 0.16, 0.0), v(0.115, 0.14, 0.12), 0.1);
    lb.add(v(sx * 0.21, 0.058, 0.07), v(0.12, 0.06, 0.17), 0.08);
    for (let k = 0; k < 4; k++) lb.add(v(sx * 0.21 + (k - 1.5) * 0.045, 0.045, 0.225), v(0.032, 0.035, 0.04), 0.03);
    const legPaint = (p: THREE.Vector3) => cFur.clone().lerp(cFurD, 0.35 + 0.4 * sstep(0.3 - p.y, 0, 0.25));
    add(model, blobGeo(lb, v(sx * 0.2, 0.2, 0.03), 8, v(0, -0.4, 1), 0.15, legPaint), M.fur).userData.inkGroup = LEG;
    // Claws: in front of each toe pad a short ivory claw curving downward
    for (let k = 0; k < 4; k++) {
      const x = sx * 0.21 + (k - 1.5) * 0.045;
      const pts = [v(x, 0.05, 0.235), v(x, 0.042, 0.272), v(x, 0.022, 0.296), v(x, 0.006, 0.302)];
      add(model, sweep(pts, roundSec((t) => 0.0125 * (1 - 0.75 * t)), { segs: 6, radial: 6, paint: (t) => cClaw.clone().lerp(cClawD, t * 0.5) }), M.fur);
    }
  }

  // ── Head: the pivot on the neck (looking around); skull, cheeks, muzzle and chin smoothly united ──
  const neck = group(body, [0, 0.98, 0.0]);
  const headG = group(neck, [0, 0.15, 0.05]);
  const hb = new Blob();
  hb.add(v(0, 0.01, -0.02), v(0.2, 0.18, 0.18), 0.08);
  for (const sx of [-1, 1]) hb.add(v(sx * 0.1, -0.05, 0.05), v(0.12, 0.1, 0.11), 0.08);
  hb.add(v(0, -0.06, 0.15), v(0.105, 0.075, 0.1), 0.07);
  hb.add(v(0, -0.12, 0.1), v(0.09, 0.05, 0.08), 0.06);
  const HC = v(0, -0.03, 0.03);
  const HO = v(0, 0.02, 0);
  const headPaint = (p: THREE.Vector3, n: THREE.Vector3) => {
    const q = Math.hypot(p.x / 0.125, (p.y + 0.068) / 0.095, (p.z - 0.14) / 0.13);
    const muz = (1 - sstep(q, 0.9, 1.04)) * sstep(p.z, 0.03, 0.08);
    const c = cFur.clone().lerp(cFurL, sstep(-n.y, -0.1, 0.5) * sstep(Math.abs(p.x), 0.08, 0.18) * 0.6).lerp(cFurD, sstep(n.y, 0.6, 0.95) * 0.25);
    return c.lerp(cMuz, muz);
  };
  add(headG, blobGeo(hb, HC, 14, v(0, 0.05, 1), 0.35, headPaint), M.fur).userData.inkGroup = HEAD;

  // ── Eyes: a bear's small round eyes (about fifteen percent of the head's width in diameter), half set into the skull; the whole eye a near-black dark brown and glossy, no sclera showing, only one small point of highlight;
  //    the upper eyelid carries a ring of dark eye socket (the skin around a bear's eye is dark anyway), hidden normally and appearing only when blinking; the lower eyelid wraps only the lower edge (hung on the head, not moving) ──
  const ER = 0.031;
  const UP_OPEN = 0.7;
  const LO_OPEN = 0.52;
  const SHUT = LO_OPEN - 0.18;
  const lidUp = lidGeo(ER + 0.004, ER + 0.009, PI / 2, true, cFur, cFurD.clone().lerp(cLiner, 0.35), 0.1, PI);
  const lidLow = lidGeo(ER + 0.0012, ER + 0.005, PI / 2, false, cFur, cFur.clone().multiplyScalar(0.8), 0.1);
  const ballGeo = new THREE.SphereGeometry(ER, 16, 8, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  const irisG = irisGeo(ER + 0.0008, [[0.34, 0.36, col(0x080504)], [0.66, 0.68, col(0x1f140c)], [0.8, 0.82, col(0x1a110b)]], 20);
  const eyes: { upper: THREE.Group; gaze: THREE.Group; glints: THREE.Object3D[]; sx: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const { p, n } = hb.hit(HO, v(sx * 0.64, 0.17, 1));
    const E = p.clone().addScaledVector(n, -ER * 0.55);
    const f = n.clone().lerp(v(sx * 0.3, 0.08, 1).normalize(), 0.5).normalize();
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    const eg = group(headG, tv(E));
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    eyeAnchors.push(group(eg, [0, 0, ER]));
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.08]);
    add(roll, ballGeo, M.eyeball);
    const gaze = group(roll, [0, 0, 0], [0.03, -sx * 0.18, 0]);
    add(gaze, irisG, M.iris);
    const glints: THREE.Object3D[] = [];
    // Only one small point of highlight is kept (no doll-eye pair of big white highlights)
    for (const [x, y, rr] of [[0.3, 0.32, 0.0055]] as [number, number, number][]) {
      const hl = add(gaze, new THREE.SphereGeometry(rr, 8, 5), M.hi, [x * ER, y * ER, ER * 0.97]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    const upper = group(roll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.fur).userData.inkGroup = HEAD;
    // The lower eyelid does not move and hangs on the head (at the same position and orientation as the eye), so it can be merged into the head's mesh
    const lower = group(headG, tv(E));
    lower.quaternion.copy(eg.quaternion).multiply(roll.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), PI + LO_OPEN));
    add(lower, lidLow, M.fur).userData.inkGroup = HEAD;
    eyes.push({ upper, gaze, glints, sx });
  }

  // ── Nose: a dark rounded-triangle nose above the front end of the muzzle, wide at the top and narrow at the bottom ──
  const MUZ = v(0, -0.06, 0.13);
  const noseHit = hb.hit(MUZ, v(0, 0.3, 1));
  const noseG = group(headG, tv(noseHit.p.clone().addScaledVector(noseHit.n, -0.004)));
  orient(noseG, v(0, 1, 0).addScaledVector(noseHit.n, -noseHit.n.y).normalize(), noseHit.n);
  {
    const g = new THREE.SphereGeometry(1, 14, 10);
    const pa = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i);
      pa.setXYZ(i, pa.getX(i) * 0.044 * (0.78 + 0.22 * y), y * 0.028, Math.max(-0.4, pa.getZ(i)) * 0.028);
    }
    g.computeVertexNormals();
    add(noseG, g, M.nose);
  }

  // ── Mouth: a bear's muzzle. A philtrum under the nose, then two lip lines drawn back along the lower edge of the muzzle (an inverted Y), the corners of the mouth not turned up, no smiling mouth ──
  const mouthTab = curveTable([[0, -0.3], [0.15, -0.35], [0.3, -0.42], [0.45, -0.49], [0.6, -0.54]]);
  const onMuzzle = (phi: number, e: number) => {
    const { p, n } = hb.hit(MUZ, v(Math.sin(phi) * Math.cos(e), Math.sin(e), Math.cos(phi) * Math.cos(e)));
    return p.addScaledVector(n, 0.0015);
  };
  const lineR = (t: number) => 0.0058 * (1 - 0.45 * t);
  {
    const phil = [0.12, 0.0, -0.12, -0.22, -0.3].map((e) => onMuzzle(0, e));
    add(headG, sweep(phil, roundSec(() => 0.0065), { segs: 8, radial: 6, paint: () => cLiner }), M.dark);
    for (const sx of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * 0.6;
        pts.push(onMuzzle(sx * a, mouthTab(a)[0]));
      }
      add(headG, sweep(pts, roundSec(lineR), { segs: 14, radial: 6, paint: () => cLiner }), M.dark);
    }
  }
  // Open mouth (Grove-Guard Roar): under the mouth a dark oval mouth cavity and a pink tongue, folded away normally
  const mouthC = onMuzzle(0, -0.36);
  const mouthN = hb.hit(MUZ, v(0, Math.sin(-0.36), Math.cos(-0.36))).n;
  const mouthBase = group(headG, tv(mouthC));
  orient(mouthBase, v(0, 1, 0).addScaledVector(mouthN, -mouthN.y).normalize(), mouthN);
  const mouthOpen = group(mouthBase, [0, -0.012, 0]);
  add(mouthOpen, paintGeo(new THREE.SphereGeometry(1, 12, 8).scale(0.05, 0.036, 0.022), () => col(0x3a1418)), M.dark);
  add(mouthOpen, paintGeo(new THREE.SphereGeometry(1, 10, 6).scale(0.03, 0.016, 0.014).translate(0, -0.016, 0.012), () => col(0xd8707a)), M.dark);

  // ── Ears: round ears on the two sides of the top of the head, dished in at the front into a dark ear socket; pivoting at the ear root (twitching now and then) ──
  const earGeo = paintGeo(
    finish(lathe([[0.001, 0.008], [0.025, 0.01], [0.042, 0.016], [0.054, 0.023], [0.062, 0.025], [0.068, 0.021], [0.0715, 0.011], [0.0715, -0.002], [0.066, -0.014], [0.052, -0.024], [0.03, -0.03], [0.001, -0.032]], 18).rotateX(PI / 2)),
    (p) => cFur.clone().lerp(cEarIn, (1 - sstep(Math.hypot(p.x, p.y), 0.044, 0.054)) * sstep(p.z, 0.0, 0.006)),
  );
  const earTw: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const { p, n } = hb.hit(HO, v(sx * 0.62, 0.8, -0.1));
    const eb = group(headG, tv(p.clone().addScaledVector(n, 0.012)));
    orient(eb, n.clone().add(v(0, 0.6, 0)).normalize(), v(sx * 0.3, 0.05, 1));
    const tw = group(eb, [0, -0.03, 0]);
    add(tw, earGeo, M.fur, [0, 0.03, 0]).userData.inkGroup = HEAD;
    earTw.push(tw);
  }

  // The center of the face (for close-ups)
  const faceA = group(headG, tv(hb.hit(HO, v(0, -0.05, 1)).p));

  // ── Moss cape: a whole thick sheet of green moss draping from the nape over both shoulders, the lower edge round clumps of moss, the surface undulating ──
  {
    const MC = v(0, 0.74, -0.03);
    const TA = 0.78;
    const thickF = (u: number, vv: number) => 0.062 * Math.pow(Math.min(1, u / 0.07, (1 - u) / 0.07), 0.5) * (1 - 0.35 * vv * vv) + 0.012;
    const angOf = (u: number, vv: number) => {
      const th = TA + u * (PI * 2 - 2 * TA);
      const b = (1 - Math.cos(th)) / 2;
      const phTop = lerp(0.95, 1.12, b);
      const lump = Math.pow(Math.abs(Math.sin(th * 6)), 0.5);
      const phBot = lerp(0.5, -0.02, Math.pow(b, 0.8)) - 0.075 * lump;
      return { th, ph: lerp(phTop, phBot, vv) };
    };
    const mossS = (u: number, vv: number) => {
      const { th, ph } = angOf(u, vv);
      const { p, n } = bodyB.hit(MC, v(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)));
      const bump = 0.009 * Math.sin(th * 19 + vv * 4) * Math.sin(th * 7 - vv * 5 + 1);
      return p.addScaledVector(n, thickF(u, vv) / 2 - 0.012 + bump);
    };
    const cM0 = col(0x5f8c34);
    const cM1 = col(0x8cb84a);
    const cM2 = col(0xa6cc5c);
    const cMin = col(0x3a5520);
    const geo = thickSheet(60, 6, mossS, thickF, {
      E: 2,
      outward: (p) => p.clone().sub(MC),
      color: (u, vv, side) => {
        if (side < 0) return cMin.clone();
        const { th } = angOf(u, vv);
        const nz = 0.5 + 0.5 * Math.sin(th * 13 + vv * 6) * Math.sin(th * 5 + 2);
        return cM0.clone().lerp(cM1, nz * 0.8).lerp(cM2, sstep(vv, 0.75, 1) * 0.55);
      },
    });
    add(body, geo, M.moss).userData.inkGroup = MOSS;
  }

  // ── Vine-rope strap: from under the moss on the left shoulder slanting across the chest and around the right hip to the ancient tree on the back; two strands twisted together ──
  const ropePts: THREE.Vector3[] = [];
  const ropeN: THREE.Vector3[] = [];
  for (const [x, y, z, off] of [
    [0.27, 0.92, 0.03, -0.012],
    [0.22, 0.83, 0.2, 0.02],
    [0.12, 0.745, 0.28, 0.02],
    [0.0, 0.665, 0.31, 0.02],
    [-0.13, 0.575, 0.31, 0.02],
    [-0.24, 0.49, 0.26, 0.02],
    [-0.31, 0.43, 0.14, 0.02],
    [-0.345, 0.44, -0.01, 0.02],
  ] as [number, number, number, number][]) {
    const { p, n } = bodyB.hit(BC, v(x, y, z).sub(BC));
    ropePts.push(p.addScaledVector(n, off));
    ropeN.push(n);
  }
  // The axis of the ancient tree: the lower end behind the right hip, slanting up to the left by about 44 degrees (the stump reaches out from outside the left shoulder, so it does not block the head's silhouette).
  // h is the proportion along the axis (0 the base, about 1.2 the broken stump), and the real length is multiplied by LF
  const A = v(-0.34, 0.3, -0.4);
  const ax = v(Math.sin(0.77), Math.cos(0.77), 0.02).normalize();
  const LF = 1.32;
  const wB = v(0, 0, -1).addScaledVector(ax, ax.z).normalize();
  const eS = new THREE.Vector3().crossVectors(ax, wB).normalize();
  const axisPt = (h: number) => A.clone().addScaledVector(ax, h * LF);
  const radial = (th: number) => wB.clone().multiplyScalar(Math.cos(th)).addScaledVector(eS, Math.sin(th));
  ropePts.push(v(-0.3, 0.46, -0.2), axisPt(0.26));
  const cVine = col(0x5f6c2c);
  const cVineL = col(0x87963e);
  {
    const path = new THREE.CatmullRomCurve3(ropePts, false, 'centripetal');
    const len = path.getLength();
    add(body, sweep(ropePts, (t, th) => {
      const r = 0.02 * (1 + 0.16 * Math.cos(2 * th + t * len * 60));
      const e = Math.min(1, (t * len) / 0.02);
      return [Math.cos(th) * r * e, Math.sin(th) * r * e];
    }, { segs: 56, radial: 10, paint: (t, th) => cVine.clone().lerp(cVineL, 0.5 + 0.5 * Math.cos(2 * th + t * len * 60)) }), M.plant);
  }
  const ropeCurve = new THREE.CatmullRomCurve3(ropePts, false, 'centripetal');

  // ── Gatekeeper badge: the round wooden badge on the vine rope on the chest, a jade-colored leaf set in the middle ──
  const badgeG = group(body);
  {
    const t0 = 0.2;
    const p = ropeCurve.getPointAt(t0);
    const n = bodyB.hit(BC, p.clone().sub(BC)).n;
    badgeG.position.copy(p.addScaledVector(n, 0.034));
    badgeG.scale.setScalar(1.15);
    orient(badgeG, v(0, 1, 0).addScaledVector(n, -n.y).normalize(), n);
    badgeG.rotateZ(-0.12);
    const cW = col(0xb37c46);
    const cWd = col(0x7a4a26);
    const disc = finish(lathe([[0.001, 0.005], [0.031, 0.005], [0.036, 0.004], [0.04, 0.01], [0.049, 0.01], [0.055, 0.004], [0.055, -0.006], [0.05, -0.011], [0.001, -0.011]], 20).rotateX(PI / 2));
    add(badgeG, paintGeo(disc, (q) => cW.clone().lerp(cWd, sstep(Math.hypot(q.x, q.y), 0.034, 0.04) * 0.6)), M.plant);
    const leaf: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      leaf.push([0.017 * Math.pow(Math.sin(PI * t), 0.85), -0.026 + 0.052 * t]);
    }
    for (let i = 9; i >= 1; i--) leaf.push([-leaf[i][0], leaf[i][1]]);
    const lg = new THREE.ExtrudeGeometry(outline(leaf), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0018, bevelSegments: 1, curveSegments: 1 });
    lg.deleteAttribute('uv');
    add(badgeG, lg, M.jade, [0, 0, 0.004], [0, 0, 0.5]);
  }
  // Two small leaves sprouting from the vine rope: this rope is a living vine
  for (const [t, side] of [[0.13, 1], [0.58, -1]] as [number, number][]) {
    const p = ropeCurve.getPointAt(t);
    const T = ropeCurve.getTangentAt(t);
    const n = bodyB.hit(BC, p.clone().sub(BC)).n;
    const g = group(body, tv(p.addScaledVector(n, 0.01)));
    orient(g, T.clone().multiplyScalar(side).addScaledVector(n, 0.5), n);
    add(g, oakLeafGeo(0.07, 0.022, 0.006, col(0x6a9c34), col(0x9cc850), 12), M.plant, [0, 0.01, 0], [-0.25, 0, 0]);
  }

  // ── Forelimbs: the left arm hangs at the side with the back of the paw facing forward; the right arm bends to the chest gripping the vine rope ──
  const pawGeo = (seed: number) => {
    const b = new Blob();
    b.add(v(0, 0, 0), v(0.078, 0.074, 0.062), 0.05);
    const fx = [-0.05, -0.017, 0.017, 0.05];
    for (const x of fx) b.add(v(x, -0.058, 0.012), v(0.029, 0.033, 0.03), 0.028);
    const g = blobGeo(b, v(0, -0.01, 0), 6, v(0, -0.5, 1), 0.2, () => cFur.clone().lerp(cFurD, 0.12 + 0.05 * seed));
    const claws = fx.map((x) => sweep([v(x, -0.078, 0.022), v(x, -0.1, 0.02), v(x, -0.114, 0.004), v(x * 1.02, -0.118, -0.014)], roundSec((t) => 0.0118 * (1 - 0.72 * t)), { segs: 6, radial: 6, paint: (t) => cClaw.clone().lerp(cClawD, t * 0.5) }));
    return { g, claws };
  };
  const armR0 = (t: number) => lerp(0.094, 0.07, t);
  // Left arm
  const SL = v(0.22, 0.86, -0.01);
  const armL = group(body, tv(SL));
  const pawLA = group(armL);
  {
    const E = v(0.35, 0.65, 0.04);
    const W = v(0.372, 0.47, 0.1);
    add(armL, sweep([SL, v(0.3, 0.78, 0.0), E, W].map((q) => q.clone().sub(SL)), roundSec(armR0), { segs: 14, radial: 12, paint: () => cFur }), M.fur).userData.inkGroup = BODY;
    const pg = group(armL, tv(v(0.378, 0.405, 0.12).sub(SL)));
    orient(pg, W.clone().sub(E).negate(), v(0.35, 0, 1));
    const { g, claws } = pawGeo(0);
    add(pg, g, M.fur).userData.inkGroup = BODY;
    for (const c of claws) add(pg, c, M.fur);
    pawLA.position.copy(pg.position);
    pawLA.quaternion.copy(pg.quaternion);
    pawLA.position.add(v(0, -0.1, 0).applyQuaternion(pg.quaternion));
  }
  // Right arm: the palm against the belly, four fingers hooked over the vine rope
  const SR = v(-0.22, 0.86, -0.01);
  const armR = group(body, tv(SR));
  const pawRA = group(armR);
  {
    const G = ropeCurve.getPointAt(0.42);
    const n = bodyB.hit(BC, G.clone().sub(BC)).n;
    const Pc = G.clone().addScaledVector(n, 0.045);
    const py = v(-0.8, 0.45, -0.15).addScaledVector(n, -v(-0.8, 0.45, -0.15).dot(n)).normalize();
    const W = Pc.clone().addScaledVector(py, 0.06);
    const E = v(-0.39, 0.62, 0.08);
    add(armR, sweep([SR, v(-0.33, 0.77, 0.0), E, W].map((q) => q.clone().sub(SR)), roundSec(armR0), { segs: 14, radial: 12, paint: () => cFur }), M.fur).userData.inkGroup = BODY;
    const pg = group(armR, tv(Pc.clone().sub(SR)));
    orient(pg, py, n);
    const { g, claws } = pawGeo(1);
    add(pg, g, M.fur).userData.inkGroup = BODY;
    for (const c of claws) add(pg, c, M.fur);
    pawRA.position.copy(pg.position);
    pawRA.quaternion.copy(pg.quaternion);
  }

  // ── Ancient tree: pivoting on the contact point on the upper back (when heaved it turns about here) ──
  const logP = v(0.16, 0.9, -0.28);
  const logG = group(body, tv(logP));
  const logIn = group(logG, tv(logP.clone().negate()));
  const cBark = col(0x7a6d60);
  const cBarkD = col(0x443a33);
  const cBarkL = col(0x958875);
  const cHeart = col(0xdcbb88);
  const cRing = col(0xb8905c);
  const cMossL = col(0x7ea840);
  // Table of trunk cross-section radii (h along the axis, the lower end the base of a clump of roots, tapering going up)
  const rTab = curveTable([[-0.03, 0], [-0.012, 0.12], [0.02, 0.215], [0.08, 0.262], [0.18, 0.232], [0.32, 0.205], [0.55, 0.194], [0.8, 0.182], [1.0, 0.171], [1.14, 0.162]]);
  const Rh = (h: number) => rTab(clamp(h, -0.03, 1.14))[0];
  // Bark grooves: 9 twisting narrow V-shaped grooves; each groove takes 6 columns (groove bottom, two edges, ridge)
  const NG = 9;
  const OFF = [0, 0.07, 0.17, 0.5, 0.83, 0.93];
  const GRV = [1, 0.42, 0.0, -0.12, 0.0, 0.42];
  const TW = 0.35;
  const burls: [number, number, number][] = [[0.42, 2.2, 0.035], [0.95, -2.5, 0.03], [0.2, -1.2, 0.03]];
  const tooth = (th: number) => 0.9 * Math.pow(Math.max(0, Math.cos(3 * th + 0.7)), 2) + 0.5 * Math.pow(Math.max(0, Math.cos(5 * th - 1.1)), 3);
  {
    const hs: number[] = [-0.03, -0.018, -0.006, 0.01, 0.03, 0.055, 0.085, 0.12, 0.16];
    for (let h = 0.21; h < 1.13; h += 0.055) hs.push(h);
    hs.push(1.14);
    const bodyRows = hs.length;
    // Broken stump: a sawtooth edge of bark, pale heartwood inside, slightly dished in the middle
    const topRows: [number, number, number, THREE.Color][] = [
      [1.165, 0.159, 0.0, cBark],
      [1.182, 0.155, 0.95, cBark],
      [1.19, 0.146, 1.0, cHeart.clone().lerp(cBarkL, 0.25)],
      [1.176, 0.12, 0.8, cRing],
      [1.162, 0.07, 0.25, cHeart],
      [1.156, 0.0, 0.0, cHeart],
    ];
    const cols = NG * OFF.length;
    const rows = bodyRows + topRows.length;
    const geo = gridGeo(rows, cols, (i, j) => {
      const k = Math.floor(j / OFF.length);
      const o = j % OFF.length;
      if (i < bodyRows) {
        const h = hs[i];
        const th = ((k + OFF[o]) / NG) * PI * 2 - TW * h;
        let r = Rh(h);
        const onBark = sstep(h, -0.01, 0.06) * (1 - sstep(h, 1.1, 1.14) * 0.5);
        r -= 0.026 * GRV[o] * onBark;
        for (const [bh, bt, ba] of burls) {
          const dt = Math.atan2(Math.sin(th - bt), Math.cos(th - bt));
          r += ba * Math.exp(-(((h - bh) / 0.09) ** 2) - (dt / 0.45) ** 2);
        }
        const p = axisPt(h).addScaledVector(radial(th), r);
        const up = radial(th).y;
        const mossK = sstep(up, 0.35, 0.75) * sstep(h, 0.15, 0.3) * (0.5 + 0.5 * Math.sin(h * 23 + th * 3));
        let c = cBark.clone().lerp(cBarkD, Math.max(0, GRV[o]) * 0.85 * onBark).lerp(cBarkL, (GRV[o] < 0 ? 0.5 : 0) * onBark);
        c = c.lerp(cMossL, sstep(mossK, 0.35, 0.6) * 0.85);
        return { p, c };
      }
      const [h0, r0, tk, c0] = topRows[i - bodyRows];
      const th = ((k + OFF[o]) / NG) * PI * 2 - TW * 1.14;
      const h = h0 + 0.06 * tooth(th) * tk;
      return { p: axisPt(h).addScaledVector(radial(th), r0), c: c0.clone() };
    }, true);
    const g = finish(geo);
    orientOut(g, (p) => {
      const q = p.clone().sub(A);
      return q.addScaledVector(ax, -q.dot(ax));
    });
    // The normals at the poles (the lower end, the center of the stump) are averaged, so no outline dots appear
    add(logIn, g, M.bark);
  }
  // Roots: five thick roots spreading from the base to the left, backward and up and then curling down (the whole tree is carried with its roots); they do not grow toward the bear's legs, and the root tips do not touch the ground
  const rootDirs: [number, number, number][] = [[-1, 0.1, 0.05], [-0.55, -0.2, -0.8], [-0.1, 0.1, -1], [-0.7, 0.55, -0.45], [-0.86, -0.18, 0.48]];
  for (const [k, [dx, dy, dz]] of rootDirs.entries()) {
    const d = v(dx, dy, dz).normalize();
    const reach = 0.27 - 0.025 * (k % 2);
    const pts = [
      axisPt(0.05),
      A.clone().addScaledVector(d, 0.2).addScaledVector(ax, 0.03),
      A.clone().addScaledVector(d, reach * 0.82).add(v(0, -0.025, 0)),
      A.clone().addScaledVector(d, reach).add(v(0, -0.08, 0)),
      A.clone().addScaledVector(d, reach * 0.96).add(v(0, -0.13, 0)),
    ];
    const L0 = 0.078 - 0.008 * (k % 2);
    add(logIn, sweep(pts, roundSec((t) => lerp(L0, 0.024, Math.pow(t, 0.9))), { segs: 12, radial: 8, paint: (t) => cBark.clone().lerp(cBarkD, 0.2 + 0.3 * t) }), M.bark);
  }
  // Oak branch: from the upward-facing side of the upper trunk grows a thick branch going up, its tip carrying oak leaves and two acorns
  const thB = 1.0;
  const bDir = radial(thB).multiplyScalar(0.45).add(v(0.1, 0.9, 0)).normalize();
  const b0 = axisPt(0.93).addScaledVector(radial(thB), 0.06);
  const b1 = b0.clone().addScaledVector(bDir, 0.2);
  const bDir2 = bDir.clone().add(v(0.25, 0.1, 0)).normalize();
  const b2 = b1.clone().addScaledVector(bDir2, 0.1);
  add(logIn, sweep([b0, b1, b2], roundSec((t) => lerp(0.055, 0.032, t), [true, true]), { segs: 10, radial: 10, paint: (t) => cBark.clone().lerp(cBarkL, t * 0.4) }), M.bark);
  const leafBase = group(logIn, tv(b2));
  orient(leafBase, bDir2, v(0, 0, 1));
  const leafSway = group(leafBase);
  {
    const cL0 = col(0x5c9030);
    const cL1 = col(0x94c24a);
    const leafSpec: [number, number, number, number][] = [
      [0.0, 0.0, 0.155, 0.046],
      [1.3, 0.6, 0.14, 0.04],
      [-1.2, 0.55, 0.13, 0.04],
      [2.5, 1.05, 0.12, 0.036],
      [-2.4, 1.0, 0.115, 0.035],
    ];
    for (const [az, tilt, L, W] of leafSpec) {
      const g = group(leafSway, [0, 0, 0], [0, az, 0]);
      const g2 = group(g, [0, 0.005, 0], [tilt, 0, 0]);
      add(g2, oakLeafGeo(L, W, 0.007, cL0, cL1), M.plant);
    }
    // Acorn: a cupule (with a short stretch of stalk) plus the nut
    const cNut = col(0xc29a4a);
    const cNutD = col(0x8a6a2c);
    const cCup = col(0x6c4a2a);
    for (const [x, z, rz] of [[0.02, 0.03, 0.35], [-0.03, 0.015, -0.3]] as [number, number, number][]) {
      const ag = group(leafSway, [x, -0.02, z], [0.2, 0, PI + rz]);
      add(ag, paintGeo(finish(lathe([[0.001, -0.052], [0.011, -0.047], [0.02, -0.035], [0.024, -0.018], [0.024, -0.004], [0.02, 0.006]], 10)), (p) => cNut.clone().lerp(cNutD, sstep(-p.y, 0.03, 0.05))), M.plant);
      add(ag, paintGeo(finish(lathe([[0.021, -0.002], [0.027, 0.001], [0.029, 0.009], [0.024, 0.017], [0.012, 0.021], [0.004, 0.023], [0.0035, 0.034], [0.001, 0.035]], 10)), () => cCup), M.plant);
    }
  }
  // New sprout: a small seedling growing from the heartwood of the broken stump, with two young leaves
  const sproutBase = group(logIn, tv(axisPt(1.16).addScaledVector(radial(1.2), 0.03)));
  const sproutSway = group(sproutBase);
  {
    const stemPts = [v(0, -0.02, 0), v(0.005, 0.04, 0.0), v(0.02, 0.09, 0.005)];
    add(sproutSway, sweep(stemPts, roundSec((t) => lerp(0.011, 0.007, t)), { segs: 6, radial: 6, paint: () => col(0x6f9a38) }), M.plant);
    for (const [az, tilt, L] of [[0.4, 0.95, 0.09], [PI + 0.2, 0.85, 0.08]] as [number, number, number][]) {
      const g = group(sproutSway, [0.018, 0.085, 0.005], [0, az, 0]);
      add(g, oakLeafGeo(L, 0.028, 0.006, col(0x78b03e), col(0xb4dc6a), 12), M.plant, [0, 0, 0], [tilt, 0, 0]);
    }
  }
  // Vine rings: two rings of vine twisted together tie the ancient tree onto the strap
  for (const h0 of [0.24, 0.76]) {
    const NP = 30;
    const pts: THREE.Vector3[] = [];
    const outs: THREE.Vector3[] = [];
    for (let i = 0; i < NP; i++) {
      const th = (i / NP) * PI * 2;
      const h = h0 + 0.025 * Math.sin(th);
      outs.push(radial(th));
      pts.push(axisPt(h).addScaledVector(radial(th), Rh(h) + 0.01));
    }
    add(logIn, ringTube(pts, outs, 8, (i, a) => 0.019 * (1 + 0.15 * Math.cos(2 * a + (i / NP) * PI * 2 * 9)), (i, a) => cVine.clone().lerp(cVineL, 0.5 + 0.5 * Math.cos(2 * a + (i / NP) * PI * 2 * 9))), M.plant);
  }

  // ── Tree hollow (back): a ring of thickly curled bark around a dark hole, a honeycomb stuffed in the hole, and honey dripping down from the opening ──
  const HH = 0.6;
  const HA = 0.078;
  const HB = 0.072;
  const hollowA = group(logIn);
  {
    const R0 = Rh(HH);
    const NP = 22;
    const lipPts: THREE.Vector3[] = [];
    const lipOut: THREE.Vector3[] = [];
    for (let i = 0; i < NP; i++) {
      const ph = (i / NP) * PI * 2;
      const h = HH + HA * Math.cos(ph);
      const th = (HB * Math.sin(ph)) / R0;
      lipOut.push(radial(th));
      lipPts.push(axisPt(h).addScaledVector(radial(th), Rh(h) + 0.016));
    }
    add(logIn, ringTube(lipPts, lipOut, 10, () => 0.03, (i, a) => cBarkL.clone().lerp(cBark, 0.5 - 0.5 * Math.cos(a))), M.bark);
    // Hole: a shallow dark bowl, its edge hidden under the curled bark
    const dish = gridGeo(6, NP, (i, j) => {
      const rho = i / 5;
      const ph = (j / NP) * PI * 2;
      const h = HH + HA * rho * Math.cos(ph);
      const th = (HB * rho * Math.sin(ph)) / R0;
      const p = axisPt(h).addScaledVector(radial(th), R0 + 0.012 + 0.012 * rho * rho);
      return { p, c: col(0x1c120c).lerp(col(0x3a2616), rho * rho) };
    }, true);
    const dg = finish(dish);
    orientOut(dg, (p) => {
      const q = p.clone().sub(A);
      return q.addScaledVector(ax, -q.dot(ax));
    });
    add(logIn, dg, M.bark);
    hollowA.position.copy(axisPt(HH).addScaledVector(radial(0), R0 + 0.04));
    // Honeycomb: a small clump of hexagonal columns in the lower half of the hole, the cell-by-cell lines coming from the outlines between columns
    const cComb = col(0xe9b443);
    const cCombL = col(0xf6d27a);
    const cells: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0.5, -0.87], [-0.5, -0.87], [0.5, 0.87]];
    const hex = new THREE.CylinderGeometry(0.0175, 0.0175, 0.036, 6, 1);
    hex.deleteAttribute('uv');
    const hexNI = hex.toNonIndexed();
    hexNI.computeVertexNormals();
    for (const [cx, cy] of cells) {
      const h = HH - 0.027 + cy * 0.026;
      const th = (cx * 0.033) / R0;
      const n = radial(th);
      const p = axisPt(h).addScaledVector(n, R0 + 0.02);
      const g = group(logIn, tv(p));
      orient(g, n, ax);
      add(g, paintGeo(hexNI.clone(), (q) => cComb.clone().lerp(cCombL, sstep(q.y, 0.012, 0.018))), M.honey);
    }
    // Honey: flowing down from the lower edge of the opening along the bark, the end swelling into a drop
    const cHoney = col(0xf2a322);
    for (const [ph0, len] of [[PI + 0.35, 0.17], [PI - 0.5, 0.11]] as [number, number][]) {
      const h1 = HH + HA * Math.cos(ph0);
      const t1 = (HB * Math.sin(ph0)) / R0;
      const pts: THREE.Vector3[] = [];
      let P = axisPt(h1).addScaledVector(radial(t1), Rh(h1) + 0.036);
      for (let i = 0; i <= 5; i++) {
        pts.push(P.clone());
        // Flowing toward the bottom of the world and then lying back against the bark surface
        const Q = P.clone().add(v(0, -len / 5, 0));
        const q = Q.clone().sub(A);
        const h = q.dot(ax) / LF;
        const rdir = q.addScaledVector(ax, -h * LF).normalize();
        P = axisPt(h).addScaledVector(rdir, Rh(h) + 0.016 + 0.014 * (1 - i / 5));
      }
      add(logIn, sweep(pts, roundSec((t) => 0.011 + 0.012 * Math.exp(-(((t - 0.88) / 0.1) ** 2)), [true, true]), { segs: 12, radial: 8, paint: () => cHoney }), M.honey);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: deep breathing, slowly looking around, blinking, now and then twitching the left ear, the oak leaves and new sprout swaying lightly in the wind ──
  // All computed from t (a frozen time gives the same pose)
  const act = { focus: 0, roar: 0, heave: 0 };
  const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
  const update = (t: number) => {
    const br = Math.sin(t * 1.5);
    body.scale.set(1 + br * 0.005, 1 + br * 0.006, 1 + br * 0.008);
    const f = 1 - act.focus;
    const ro = act.roar;
    neck.rotation.set(Math.sin(t * 0.5) * 0.025 - ro * 0.3, (Math.sin(t * 0.33) * 0.22 + Math.sin(t * 0.14 + 1) * 0.08) * f, Math.sin(t * 0.27) * 0.03 * f);
    mouthOpen.visible = ro > 0.02;
    mouthOpen.scale.set(0.7 + 0.3 * ro, Math.max(0.05, ro), 1);
    const et = t % 5.7;
    earTw[1].rotation.set(et > 4.9 && et < 5.2 ? Math.sin(((et - 4.9) / 0.3) * PI) * 0.35 : 0, 0, 0);
    earTw[0].rotation.set(-ro * 0.25, 0, 0);
    const bt = t % 4.4;
    const close = Math.max(bk(bt - 3.95), Math.floor(t / 4.4) % 3 === 2 ? bk(bt - 3.62) : 0);
    for (const e of eyes) {
      e.upper.rotation.x = lerp(-UP_OPEN, SHUT, close);
      // When the upper eyelid turns about the x axis its edge always passes through the corner of the eye, and when the eye is open what shows is an arc pressed on the eye (like a person's eyelid line), appearing only when blinking
      e.upper.visible = close > 0.01;
      for (const g of e.glints) g.visible = close < 0.6;
      e.gaze.rotation.set(0.03 + Math.sin(t * 0.53 + 1) * 0.03 * f, -e.sx * 0.18 + Math.sin(t * 0.41) * 0.06 * f, 0);
    }
    armL.rotation.set(Math.sin(t * 1.5 - 0.5) * 0.025, 0, Math.sin(t * 1.5) * 0.02);
    armR.rotation.set(Math.sin(t * 1.5 - 0.3) * 0.01, 0, 0);
    leafSway.rotation.set(Math.sin(t * 1.3) * 0.04, 0, Math.sin(t * 1.7) * 0.06 + Math.sin(t * 2.9 + 1) * 0.02);
    sproutSway.rotation.set(Math.sin(t * 1.6 + 0.7) * 0.06, 0, Math.sin(t * 2.1) * 0.08);
    const hv = act.heave;
    logG.rotation.set(hv * 0.55 + br * 0.004, 0, 0);
    logG.position.set(logP.x, logP.y + hv * 0.08, logP.z);
  };
  update(0);

  // Anchors
  const noseA = group(noseG, [0, 0, 0.03]);
  const mouthA = group(mouthBase, [0, 0, 0.01]);
  const logA = group(logIn, tv(axisPt(0.6)));
  const logTopA = group(logIn, tv(axisPt(1.2)));
  const rootsA = group(logIn, tv(axisPt(-0.05)));
  const branchA = group(leafBase, [0, 0.03, 0]);
  const badgeA = group(badgeG, [0, 0, 0.012]);
  const rig = {
    head: faceA,
    eyes: eyeAnchors,
    anchors: { mouth: mouthA, nose: noseA, badge: badgeA, pawL: pawLA, pawR: pawRA, log: logA, logTop: logTopA, roots: rootsA, hollow: hollowA, branch: branchA },
  };
  void rand;
  // The open-mouth group is folded away normally; merging only sees parts that are displayed, so open it first and then merge
  mouthOpen.visible = true;
  for (const e of eyes) e.upper.visible = true;
  // Static parts merged (mesh budget R 50): the groups that move when idle act as owners, and the eye highlights (switched on and off when blinking) are not merged
  mergeStatic(root, {
    owners: [body, neck, logG, armL, armR, leafSway, sproutSway, mouthOpen, ...earTw, ...eyes.map((e) => e.gaze), ...eyes.map((e) => e.upper)],
    keep: eyes.flatMap((e) => e.glints),
    rig,
  });
  update(0);
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.82, 0), radius: 1.0 };
}
