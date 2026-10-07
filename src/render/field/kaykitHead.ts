/**
 * KayKit's heads (kaykitHeads.ts, CC0) converted into head coordinates: the face, nose, ears, eyes, brows,
 * hair and beard are all the original file's meshes,
 * sized by HeadShape's rx, ry, rz (normalized against the same skull, so helmets and hoods still fit).
 *
 * The original is low-poly with hard edges (several vertices at the same position, each with its own normal),
 * and the post-process normal outline would draw the seams between faces as dashed lines.
 * Here each part is welded by position and its smooth normals are recomputed with area weighting,
 * so on the face only the places with a real height difference (eyes, brows, mouth, nose tip) show lines.
 *
 * look.young: KayKit's head is an adult face. Young characters (boys, girls, children) get a narrower jaw and a shorter
 * chin, and every part deforms along with it,
 * so the hair, ears and shapes on the face still sit on the face.
 */
import * as THREE from 'three';
import type { HeadShape } from './avatarKit.ts';
import { KAYKIT_HEADS, type KayKitHead, type KayKitRole } from './kaykitHeads.ts';

export interface KKLook {
  head: KayKitHead;
  /** 0 is an adult; 1 is a teen; 1.4 is a child */
  young: number;
}

interface Decoded {
  pos: Float32Array;
  shade: Float32Array;
  groups: Partial<Record<KayKitRole, Uint16Array>>;
}

const cache = new Map<KayKitHead, Decoded>();
const clamp = THREE.MathUtils.clamp;

function bytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decode(name: KayKitHead): Decoded {
  let d = cache.get(name);
  if (d) return d;
  const src = KAYKIT_HEADS[name];
  const p = new Int16Array(bytes(src.pos).buffer);
  const s = bytes(src.shade);
  const groups: Partial<Record<KayKitRole, Uint16Array>> = {};
  for (const [r, v] of Object.entries(src.groups)) groups[r as KayKitRole] = new Uint16Array(bytes(v as string).buffer);
  d = { pos: Float32Array.from(p, (x) => x / 1e4), shade: Float32Array.from(s, (x) => x / 255), groups };
  cache.set(name, d);
  return d;
}

/**
 * A young face (head coordinates, modified in place): below the eye line, the jaw narrows toward the chin,
 * the chin is pulled up shorter, and the front half of the face is pulled back a little.
 * Everything above the eye line stays put (the forehead, the top of the head, hats, and where the prologue touches the forehead are all the same).
 */
function youth(p: THREE.Vector3, hs: HeadShape, k: number): void {
  const t = clamp((-p.y / hs.ry - 0.15) / 0.85, 0, 1);
  if (t <= 0) return;
  p.x *= 1 - k * 0.1 * Math.pow(t, 1.5);
  p.y += k * 0.05 * t * t * hs.ry;
  if (p.z > 0) p.z *= 1 - k * 0.045 * t * t;
}

/**
 * Smooth normals after welding by position (area-weighted): vertices at the same position get the same normal,
 * while the vertices themselves are not merged (their shade values are kept separately)
 */
function smoothNormals(pos: number[], idx: number[]): number[] {
  const key = (i: number) => `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
  const keys: string[] = [];
  for (let i = 0; i < pos.length / 3; i++) keys.push(key(i));
  const acc = new Map<string, [number, number, number]>();
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    // The cross product's length is twice the area: adding them directly is area weighting
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      const v = acc.get(keys[i]);
      if (v) {
        v[0] += nx;
        v[1] += ny;
        v[2] += nz;
      } else acc.set(keys[i], [nx, ny, nz]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < keys.length; i++) {
    const [x, y, z] = acc.get(keys[i])!;
    const l = Math.hypot(x, y, z) || 1;
    out.push(x / l, y / l, z / l);
  }
  return out;
}

/**
 * Whether this head has a given part (Knight, Rogue and Mage have hair, the Barbarian has a beard, the Mage has the bundle at the back of the head)
 */
export function kaykitHas(name: KayKitHead, role: KayKitRole): boolean {
  return !!decode(name).groups[role];
}

/**
 * The geometry of a part (head coordinates): keeps only the vertices in use, deforms the young face per look.young,
 * and recomputes smooth normals; shade is stored in the shade attribute
 * (mergePerson multiplies it in when baking vertex colors, preserving the top-to-bottom gradient of the original palette).
 * side takes just one side (+1 is the +x side), for splitting the eyes and brows into left and right.
 * head can be swapped for another head (the eyes always use the Knight's), and the deformation still uses look.young.
 */
export function kaykitPart(look: KKLook, role: KayKitRole, hs: HeadShape, side = 0, head: KayKitHead = look.head): THREE.BufferGeometry | null {
  const d = decode(head);
  const idx = d.groups[role];
  if (!idx) return null;
  const remap = new Map<number, number>();
  const pos: number[] = [];
  const sh: number[] = [];
  const out: number[] = [];
  const v = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    if (side) {
      const cx = d.pos[idx[t] * 3] + d.pos[idx[t + 1] * 3] + d.pos[idx[t + 2] * 3];
      if (Math.sign(cx) !== side) continue;
    }
    for (let k = 0; k < 3; k++) {
      const i = idx[t + k];
      let j = remap.get(i);
      if (j === undefined) {
        j = pos.length / 3;
        remap.set(i, j);
        v.set(d.pos[i * 3] * hs.rx, d.pos[i * 3 + 1] * hs.ry, d.pos[i * 3 + 2] * hs.rz);
        if (look.young) youth(v, hs, look.young);
        pos.push(v.x, v.y, v.z);
        sh.push(d.shade[i]);
      }
      out.push(j);
    }
  }
  if (!out.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(smoothNormals(pos, out), 3));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(sh, 1));
  g.setIndex(out);
  return g;
}

/** Center of the geometry's bounding box (used for rotating the eyes and brows and for closing the eyes) */
export function centerOf(g: THREE.BufferGeometry): THREE.Vector3 {
  g.computeBoundingBox();
  return g.boundingBox!.getCenter(new THREE.Vector3());
}

/**
 * The eyes always use the Knight head's (round upright ovals): the Rogue's and Mage's original eyes have slanted top edges,
 * which makes the whole face look angry. The position is aligned to this head's own original eye center.
 */
export function kaykitEye(look: KKLook, hs: HeadShape, side: number): THREE.BufferGeometry {
  const g = kaykitPart(look, 'eye', hs, side, 'knight')!;
  if (look.head === 'knight' || look.head === 'barbarian') return g;
  const own = kaykitPart(look, 'eye', hs, side);
  if (!own) return g;
  const d = centerOf(own).sub(centerOf(g));
  own.dispose();
  g.translate(d.x, d.y, d.z);
  return g;
}

/** The geometry's main axis angle in the front view (xy): the brow slant (the +x side, positive means the outer end is higher) */
export function slantOf(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position');
  let mx = 0;
  let my = 0;
  for (let i = 0; i < p.count; i++) {
    mx += p.getX(i);
    my += p.getY(i);
  }
  mx /= p.count;
  my /= p.count;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i) - mx;
    const dy = p.getY(i) - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

// ───────── Surface: shapes and accessories on the face must hug the original mesh, not the sampled head shape ─────────

const lookKey = (l: KKLook, role: KayKitRole) => `${l.head}|${l.young}|${role}`;
const surfaces = new Map<string, THREE.Mesh | null>();
function surface(look: KKLook, role: KayKitRole, hs: HeadShape): THREE.Mesh | null {
  const k = `${lookKey(look, role)}|${hs.rx},${hs.ry},${hs.rz}`;
  if (surfaces.has(k)) return surfaces.get(k)!;
  const g = kaykitPart(look, role, hs);
  const m = g ? new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })) : null;
  m?.updateMatrixWorld();
  surfaces.set(k, m);
  return m;
}

const _ray = new THREE.Raycaster();
const _hits: THREE.Intersection[] = [];
/** From p, 0.3 outside, cast along −n to the mesh's first intersection (returns null if it hits nothing) */
function hit(m: THREE.Mesh, p: THREE.Vector3, n: THREE.Vector3): THREE.Intersection | null {
  _ray.set(p.clone().addScaledVector(n, 0.3), n.clone().negate());
  _ray.far = 0.6;
  _hits.length = 0;
  m.raycast(_ray, _hits);
  let best: THREE.Intersection | null = null;
  for (const h of _hits) if (!best || h.distance < best.distance) best = h;
  return best;
}

/**
 * Move the decals on the head shape onto the original file's face: each vertex is cast along the head shape's normal onto
 * the face and placed lift outside the intersection, with that face's normal.
 * The sampled head shape is smoothed, so the face near the mouth sits a few millimeters in front of or behind it;
 * without moving the decals, the mouth would sink into the face or float in front of it.
 */
export function onFace(look: KKLook, hs: HeadShape, g: THREE.BufferGeometry, lift: number): THREE.BufferGeometry {
  const m = surface(look, 'skin', hs);
  if (!m) return g;
  const pa = g.getAttribute('position') as THREE.BufferAttribute;
  const na = g.getAttribute('normal') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    p.fromBufferAttribute(pa, i);
    n.fromBufferAttribute(na, i);
    const h = hit(m, p, n);
    if (!h || !h.normal) continue;
    // The smoothed normal (interpolated from the intersection's three vertices), so the shape is lit together with the face rather than patchily
    const fn = h.normal;
    pa.setXYZ(i, h.point.x + fn.x * lift, h.point.y + fn.y * lift, h.point.z + fn.z * lift);
    na.setXYZ(i, fn.x, fn.y, fn.z);
  }
  pa.needsUpdate = true;
  na.needsUpdate = true;
  return g;
}

/**
 * Attach the nose to the face: the nose is a separate mesh, its seam with the face is a concave crease,
 * and the normal outline would draw a ring of line around the nose root, looking pasted on from the front.
 * For vertices near the face (within band of the face surface) the normal is replaced by the face's normal at that point,
 * returning to their own normals toward the nose tip: the normals on both sides of the seam are continuous,
 * so the nose root draws no line and only the lower edge of the nose tip (hanging in front of the face, with a depth step) gets an outline.
 */
export function blendIntoFace(look: KKLook, hs: HeadShape, g: THREE.BufferGeometry, band: number): THREE.BufferGeometry {
  const m = surface(look, 'skin', hs);
  if (!m) return g;
  const pa = g.getAttribute('position') as THREE.BufferAttribute;
  const na = g.getAttribute('normal') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    p.fromBufferAttribute(pa, i);
    n.fromBufferAttribute(na, i);
    // Cast in the direction opposite the head center (the nose faces roughly forward), hitting the face behind the nose
    dir.copy(p).normalize();
    const h = hit(m, p, dir);
    if (!h || !h.normal) continue;
    const height = p.clone().sub(h.point).dot(h.normal);
    const w = 1 - THREE.MathUtils.smoothstep(height, 0, band);
    if (w <= 0) continue;
    n.lerp(h.normal, w).normalize();
    na.setXYZ(i, n.x, n.y, n.z);
  }
  na.needsUpdate = true;
  return g;
}

/**
 * How high the original hair's outer surface sits above the scalp (along the head shape's normal, in meters): headbands,
 * circlets, hair ties and long hair attached at the back are placed against it.
 * On first use rays are cast once over the (φ, θ) grid and stored, then bilinearly interpolated afterward; directions with no hair give 0.
 */
const hairGrids = new Map<string, Float32Array>();
const GP = 48;
const GT = 96;
export function kaykitHairOff(look: KKLook, hs: HeadShape): (phi: number, th: number) => number {
  return kaykitOff(look, 'hair', hs);
}

/**
 * Same as above, for any part: skin is how much higher the original file's face (scalp) sits than the sampled head shape,
 * so hand-made hair (the elder's) grows against the real scalp
 */
export function kaykitOff(look: KKLook, role: KayKitRole, hs: HeadShape): (phi: number, th: number) => number {
  const m = surface(look, role, hs);
  if (!m) return () => 0;
  const k = `${lookKey(look, role)}|${hs.rx},${hs.ry},${hs.rz}`;
  let grid = hairGrids.get(k);
  if (!grid) {
    grid = new Float32Array((GP + 1) * GT);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i <= GP; i++)
      for (let j = 0; j < GT; j++) {
        const phi = (i / GP) * Math.PI;
        const th = (j / GT) * 2 * Math.PI;
        hs.point(phi, th, p);
        hs.normal(phi, th, n);
        // Cast from outside inward: the first face hit is the hair's outer surface
        _ray.set(p.clone().addScaledVector(n, 0.3), n.clone().negate());
        _ray.far = 0.3;
        _hits.length = 0;
        m.raycast(_ray, _hits);
        let best = Infinity;
        for (const h of _hits) best = Math.min(best, h.distance);
        grid[i * GT + j] = Number.isFinite(best) ? Math.max(0, 0.3 - best) : 0;
      }
    hairGrids.set(k, grid);
  }
  const G = grid;
  return (phi, th) => {
    const u = clamp(phi / Math.PI, 0, 1) * GP;
    const v = ((((th / (2 * Math.PI)) * GT) % GT) + GT) % GT;
    const i = Math.min(GP - 1, Math.floor(u));
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const j1 = (j + 1) % GT;
    const a = G[i * GT + j] * (1 - fv) + G[i * GT + j1] * fv;
    const b = G[(i + 1) * GT + j] * (1 - fv) + G[(i + 1) * GT + j1] * fv;
    return a * (1 - fu) + b * fu;
  };
}
