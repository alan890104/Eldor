// Hundred-Mask Fox (model lab version): the messengers of the Duskshade Society walk the surface wearing fox masks, while the real foxes walk underground wearing human masks. No one knows the face under its mask, including itself.
// Dark, neutral, N. Three identifying features:
// 1. An ivory-colored human half-face mask worn crooked on its face (covering the forehead and eyes, with the fox's own pointed muzzle sticking out below the mask's lower edge), with only dark eye sockets and one small point of amber light visible in the eye holes;
//    the mask is thick lacquerware, with a vermilion brushstroke at each outer eye corner sweeping up and a vermilion dot at the center of the forehead, and a red cord wraps around the back of the head, tied in a knot with two tassels hanging down.
// 2. A dusk-purple fox: sitting pose, big pointed ears (the backs of the ears and all four feet nearly black), a pale jaw and throat, and a fluffy big tail wrapped around in front of the front feet, with a pale tail tip.
// 3. The "hundred masks": a red cord tied diagonally across the chest, and three spare small masks (black, vermilion, white) hanging on its back like a messenger's pack.
// No human face is made under the mask: the fox's eyes are small, dark and sunk in their sockets, with only one small highlight; the mask is just an object being worn, and the muzzle, nose and jaw all follow a real fox.
// Personality: a cunning, mysterious messenger, sitting upright yet tilting its head to size people up, ears always listening.
// Gaze order: the mask and the light in the eye holes first, the upright big ears and the tail wrapped around the front second, and the pack of masks on its back is the story of the back view.
// Back: the knot of red cord at the back of the head with its tassels, and three small masks hung on its back by red cord.
// Restrained light effects: the emissive is only the two points of amber light in the eye holes, with no bloom.
// Action table: idle tilts its head to size things up, slowly looks left and right, turns its ears in turn and breathes; move is a low trot; charge-up act.lunge lowers the front of the body, ready to pounce; strike is a pounce and bite or flinging the mask forward;
//   hit (trait "Mask") the mask breaks first and the body shrinks back; victory sits back in place, head tilted to the other side.
// Anchors: head (center of the mask), eyes (the eyes behind the eye holes), mouth (muzzle tip), mask (center of the mask's front), masks (the masks on the back), tailTip. act: lunge, glow.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, furCollar, loft, mergeStatic, partKit, PI, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v3(1, 0, 0);
const Y = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i)).toArray(out, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** Ray-find a surface: geo is in its own coordinate system; returns the first intersection and the interpolated vertex normal (facing the side the ray came from) */
function prober(geo: THREE.BufferGeometry) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  return (o: THREE.Vector3, d: THREE.Vector3) => {
    rc.set(o, d.clone().normalize());
    const h = rc.intersectObject(mesh, false)[0];
    if (!h) return null;
    const n = (h.normal ?? h.face!.normal).clone().normalize();
    return { p: h.point.clone(), n };
  };
}

/**
 * A band lying on a surface (belt, rope loop): P is the centerline of the band's underside and N is the surface normal; the cross-section is a rounded rectangle (width w, thickness th),
 * the whole band floats th / 2 up along the normal so the underside just touches the surface. When closed is true the ends join, otherwise both ends are rounded off.
 */
function strap(P: THREE.Vector3[], N: THREE.Vector3[], w: number, th: number, closed = false, K = 8): THREE.BufferGeometry {
  const n = P.length;
  const pos: number[] = [];
  const T = new THREE.Vector3();
  const rowOf = (i: number, scale = 1) => {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    T.subVectors(b, a).normalize();
    const nn = N[i].clone().addScaledVector(T, -N[i].dot(T)).normalize();
    const bb = new THREE.Vector3().crossVectors(T, nn).normalize();
    for (let k = 0; k < K; k++) {
      const ang = ((k + 0.5) / K) * PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const cx = Math.sign(c) * Math.abs(c) ** 0.45 * (w / 2) * scale;
      const cy = Math.sign(s) * Math.abs(s) ** 0.45 * (th / 2) * scale;
      const q = P[i].clone().addScaledVector(bb, cx).addScaledVector(nn, cy + th / 2);
      pos.push(q.x, q.y, q.z);
    }
  };
  for (let i = 0; i < n; i++) rowOf(i);
  const idx: number[] = [];
  const rows = closed ? n : n - 1;
  for (let i = 0; i < rows; i++)
    for (let k = 0; k < K; k++) {
      const i2 = (i + 1) % n;
      const k2 = (k + 1) % K;
      idx.push(i * K + k, i2 * K + k, i * K + k2, i2 * K + k, i2 * K + k2, i * K + k2);
    }
  if (!closed) {
    // One center point at each end closes it off
    for (const [i, dir] of [[0, -1], [n - 1, 1]] as [number, number][]) {
      const c = new THREE.Vector3();
      for (let k = 0; k < K; k++) c.add(v3(pos[(i * K + k) * 3], pos[(i * K + k) * 3 + 1], pos[(i * K + k) * 3 + 2]));
      c.multiplyScalar(1 / K);
      const tip = c.clone().add(P[i].clone().sub(P[i - dir]).normalize().multiplyScalar(th * 0.4));
      const ci = pos.length / 3;
      pos.push(tip.x, tip.y, tip.z);
      for (let k = 0; k < K; k++) {
        const k2 = (k + 1) % K;
        if (dir > 0) idx.push(i * K + k, ci, i * K + k2);
        else idx.push(i * K + k2, ci, i * K + k);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A curved shell with thickness (mask): outer is the outer outline and holes are the holes (2D); after triangulation it is subdivided levels times,
 * each point is placed on the surface with surf(x, y) (p is the back, n is the outward normal), and the front is pushed out a further th. The edge wall vertices are not shared, so the edge is a crisp crease.
 */
function shell(
  outer: [number, number][],
  holes: [number, number][][],
  surf: (x: number, y: number) => { p: THREE.Vector3; n: THREE.Vector3 },
  th: number,
  levels: number,
  cFront: THREE.Color,
  cBack: THREE.Color,
): THREE.BufferGeometry {
  const V2 = (a: [number, number]) => new THREE.Vector2(a[0], a[1]);
  let contour = outer.map(V2);
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.reverse();
  const hs = holes.map((h) => {
    const v = h.map(V2);
    return THREE.ShapeUtils.isClockWise(v) ? v : v.reverse();
  });
  const all = [...contour, ...hs.flat()];
  let T: [number, number][][] = THREE.ShapeUtils.triangulateShape(contour, hs).map((f) => f.map((i) => [all[i].x, all[i].y] as [number, number]));
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (let l = 0; l < levels; l++) {
    const next: [number, number][][] = [];
    for (const [a, b, c] of T) next.push([a, mid(a, b), mid(c, a)], [mid(a, b), b, mid(b, c)], [mid(c, a), mid(b, c), c], [mid(a, b), mid(b, c), mid(c, a)]);
    T = next;
  }
  const key = (p: [number, number]) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
  const map = new Map<string, number>();
  const P2: [number, number][] = [];
  const idOf = (p: [number, number]) => {
    const k = key(p);
    let i = map.get(k);
    if (i === undefined) {
      i = P2.length;
      P2.push(p);
      map.set(k, i);
    }
    return i;
  };
  const faces = T.map((t) => t.map(idOf));
  const S = P2.map(([x, y]) => surf(x, y));
  const pos: number[] = [];
  const clr: number[] = [];
  const idx: number[] = [];
  const put = (p: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z);
    clr.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };
  const F = S.map((s) => put(s.p.clone().addScaledVector(s.n, th), cFront));
  const B = S.map((s) => put(s.p.clone(), cBack));
  const at = (i: number) => v3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const tri = (a: number, b: number, c: number, hint: THREE.Vector3) => {
    const A = at(a);
    const nrm = at(b).sub(A).cross(at(c).sub(A));
    if (nrm.dot(hint) < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };
  for (const [a, b, c] of faces) {
    const n = S[a].n.clone().add(S[b].n).add(S[c].n);
    tri(F[a], F[b], F[c], n);
    tri(B[a], B[b], B[c], n.clone().negate());
  }
  // Edge wall: the outer outline and the edge of each hole, cut into segments by the subdivision count (consistent with the points on the face)
  const loops: { pts: [number, number][]; hole: boolean }[] = [
    { pts: contour.map((v) => [v.x, v.y] as [number, number]), hole: false },
    ...hs.map((h) => ({ pts: h.map((v) => [v.x, v.y] as [number, number]), hole: true })),
  ];
  const nSub = 2 ** levels;
  for (const L of loops) {
    const ring: [number, number][] = [];
    for (let i = 0; i < L.pts.length; i++) {
      const a = L.pts[i];
      const b = L.pts[(i + 1) % L.pts.length];
      for (let k = 0; k < nSub; k++) ring.push([a[0] + ((b[0] - a[0]) * k) / nSub, a[1] + ((b[1] - a[1]) * k) / nSub]);
    }
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const cen = surf(cx, cy).p;
    for (let i = 0; i < ring.length; i++) {
      const s0 = surf(...ring[i]);
      const s1 = surf(...ring[(i + 1) % ring.length]);
      const f0 = put(s0.p.clone().addScaledVector(s0.n, th), cBack);
      const b0 = put(s0.p.clone(), cBack);
      const f1 = put(s1.p.clone().addScaledVector(s1.n, th), cBack);
      const b1 = put(s1.p.clone(), cBack);
      const m = s0.p.clone().add(s1.p).multiplyScalar(0.5);
      const hint = L.hole ? cen.clone().sub(m) : m.clone().sub(cen);
      tri(f0, b0, b1, hint);
      tri(f0, b1, f1, hint);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Almond-shaped hole: both corners pointed, with the upper edge more curved than the lower; slant raises the +x corner */
function almond(cx: number, cy: number, w: number, up: number, down: number, slant: number, n = 7): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = w - (2 * w * i) / n;
    pts.push([cx + x, cy + up * (1 - (x / w) ** 2) + slant * x]);
  }
  for (let i = 1; i < n; i++) {
    const x = -w + (2 * w * i) / n;
    pts.push([cx + x, cy - down * (1 - (x / w) ** 2) + slant * x]);
  }
  return pts;
}

/** Ellipsoid surface: centered at the origin, semi-axes a, b, c, returns the front point at (x, y) and its normal */
function ellipsoidAt(a: number, b: number, c: number) {
  return (x: number, y: number) => {
    const z = c * Math.sqrt(Math.max(0.0004, 1 - (x / a) ** 2 - (y / b) ** 2));
    return { p: v3(x, y, z), n: v3(x / (a * a), y / (b * b), z / (c * c)).normalize() };
  };
}

// ───────────────────────── Shape ─────────────────────────

export function buildMaskfoxLab(): LabModel {
  const RIMC = 0xd8c8ff;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.65, rimColor: RIMC })),
    lacquer: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xfff0e0, spec: 0.45, specTh: 0.975 })),
    eye: labToon(0x15101a, { ramp: 'gem', spec: 0.8, specTh: 0.985, rim: 0 }),
    nose: labToon(0x1c1822, { spec: 0.8, specTh: 0.975, rim: 0.4, rimColor: RIMC }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffc050 }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  const cFur = col(0x54466a);
  const cFurDark = col(0x3e3350);
  const cFurLight = col(0x8a7ca0);
  const cPale = col(0xd9d1e2);
  const cSock = col(0x221c2b);
  const cIvory = col(0xece0c8);
  const cIvoryBack = col(0xd4c5aa);
  const cRed = col(0xbb3129);
  const cBlackL = col(0x2b2531);

  const root = new THREE.Group();
  root.name = 'maskfox-lab';
  const { add, group } = partKit();
  const FUR = 9801;
  const TAIL = 9802;
  const HEADF = 9803;

  /** Place a ring of fur: y aligns to the direction the fur roots point (opposite to the fur flow), and θ = 0 faces dorsal */
  const collar = (parent: THREE.Object3D, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, furCollar(o), M.fur);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return m;
  };

  const body = group(root);

  // ── Torso: sitting pose, rump on the ground and chest thrust out; darker on the back and paler on the chest ──
  const torsoPts = [v3(0, 0.13, -0.14), v3(0, 0.22, -0.1), v3(0, 0.36, -0.03), v3(0, 0.5, 0.03), v3(0, 0.62, 0.07), v3(0, 0.7, 0.09)];
  const torsoProf = curveTable([[0, 0, 0], [0.05, 0.1, 0.1], [0.18, 0.15, 0.15], [0.4, 0.13, 0.13], [0.62, 0.115, 0.125], [0.8, 0.095, 0.1], [0.93, 0.07, 0.075], [1, 0, 0]]);
  const furPaint = (p: THREE.Vector3, n: THREE.Vector3) => cFur.clone().lerp(cFurDark, sstep(-n.z, 0.3, 0.9) * 0.6).lerp(cFurLight, sstep(n.z, 0.5, 0.95) * 0.35);
  const torsoGeo = paint(loft(torsoPts, torsoProf, { segs: 30, radial: 20 }), furPaint);
  add(body, torsoGeo, M.fur).userData.inkGroup = FUR;
  const probeTorso = prober(torsoGeo);

  // Hind legs folded at the sides (the thigh a lump, the paw lying flat forward), front legs straight and bracing on the ground; the feet are nearly black
  for (const sx of [-1, 1]) {
    // Rotation and scaling are baked directly into the geometry: so the bounding box fits the actual shape (the bounding box of a rotated mesh would stretch below the ground)
    const th = add(body, paint(new THREE.SphereGeometry(1, 18, 12).scale(0.075, 0.11, 0.15).rotateX(-0.35).rotateZ(sx * 0.1), (p, n) => furPaint(p, n)), M.fur, [sx * 0.1, 0.13, -0.06]);
    th.userData.inkGroup = FUR;
    add(body, paint(new THREE.SphereGeometry(1, 12, 8), () => cSock), M.fur, [sx * 0.112, 0.026, 0.07], [0, sx * 0.1, 0], [0.042, 0.028, 0.072]).userData.inkGroup = FUR;
    add(body, paint(loft([v3(sx * 0.058, 0.46, 0.075), v3(sx * 0.062, 0.3, 0.115), v3(sx * 0.062, 0.12, 0.138), v3(sx * 0.062, 0.04, 0.148)], curveTable([[0, 0.05, 0.055], [0.45, 0.036, 0.04], [0.9, 0.032, 0.034], [1, 0.03, 0.03]]), { segs: 14, radial: 12, side: X }), (p, n) => furPaint(p, n).lerp(cSock, sstep(0.24 - p.y, 0, 0.08))), M.fur).userData.inkGroup = FUR;
    add(body, paint(new THREE.SphereGeometry(1, 12, 8), () => cSock), M.fur, [sx * 0.062, 0.026, 0.168], [0, 0, 0], [0.04, 0.028, 0.055]).userData.inkGroup = FUR;
  }

  // A patch of pale chest fur in front of the throat, with the fur tips pointing down
  collar(body, { r0: 0.055, len: 0.13, thick: 0.05, flare: 0.55, curl: 0.3, tufts: 3, a0: -1.25, a1: 1.25, seed: 5, tint: [cPale.getHex(), cPale.getHex(), 1] }, v3(0, 0.64, 0.1), v3(0, 1, 0.35), Z);

  // ── Big tail: wrapping from behind the rump around the left side (+x) and lying flat on the ground, with the tail tip resting in front of the front feet, and the tip pale ──
  const tailPts = [v3(0.02, 0.12, -0.17), v3(0.12, 0.1, -0.25), v3(0.22, 0.102, -0.15), v3(0.255, 0.105, 0.02), v3(0.205, 0.105, 0.16), v3(0.1, 0.1, 0.245), v3(-0.01, 0.1, 0.27)];
  const tailCurve = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  {
    const g = loft(tailPts, curveTable([[0, 0.04, 0.04], [0.12, 0.062, 0.058], [0.4, 0.1, 0.085], [0.7, 0.096, 0.082], [0.88, 0.07, 0.062], [0.97, 0.035, 0.032], [1, 0, 0]]), { segs: 44, radial: 18 });
    // Pale tail tip: colored by each vertex's nearest position on the curve
    const samples = Array.from({ length: 81 }, (_, i) => tailCurve.getPointAt(i / 80));
    add(body, paint(g, (p, n) => {
      let best = 0;
      let bd = 1e9;
      for (let i = 0; i < samples.length; i++) {
        const d = samples[i].distanceToSquared(p);
        if (d < bd) (bd = d), (best = i / 80);
      }
      return cFur.clone().lerp(cFurDark, sstep(-n.y, 0.2, 0.8) * 0.3).lerp(cFurLight, sstep(n.y, 0.4, 0.9) * 0.3).lerp(cPale, sstep(best, 0.8, 0.86));
    }), M.fur).userData.inkGroup = TAIL;
  }

  // ── Red cord tied diagonally across the chest, with three spare small masks hung on the back ──
  const backMasks = group(body);
  {
    const t = 0.66;
    const C = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal').getPointAt(t);
    const T = new THREE.CatmullRomCurve3(torsoPts, false, 'centripetal').getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, Y).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const P: THREE.Vector3[] = [];
    const N: THREE.Vector3[] = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * PI * 2;
      const d = W.clone().multiplyScalar(Math.cos(a)).addScaledVector(H, Math.sin(a));
      const h = probeTorso(C.clone().addScaledVector(d, 0.4), d.clone().negate());
      if (h) {
        P.push(h.p);
        N.push(h.n);
      }
    }
    add(body, paint(strap(P, N, 0.02, 0.012, true), () => cRed), M.lacquer);
    // The three small masks at the back: hung under the cord, fanned out and staggered; black, white, vermilion
    const back = H.y < 0 ? H.clone().negate() : H.clone();
    const backDir = back.z < 0 ? back : back.negate();
    const specs: [number, number, THREE.Color][] = [[-0.058, 0.4, cBlackL], [0.058, -0.4, cRed], [0, 0, cIvory]];
    for (const [dx, rz, c] of specs) {
      const o = C.clone().add(v3(dx, -0.035 - Math.abs(dx) * 0.3, 0)).addScaledVector(backDir, 0.4);
      const h = probeTorso(o, backDir.clone().negate());
      if (!h) continue;
      const mg = group(backMasks, [h.p.x, h.p.y, h.p.z]);
      mg.quaternion.setFromUnitVectors(Z, h.n);
      mg.rotateZ(rz);
      const outline = Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * PI * 2;
        return [Math.cos(a) * 0.055, Math.sin(a) * 0.045 + (Math.sin(a) < 0 ? Math.sin(a) * 0.012 : 0)] as [number, number];
      });
      const holes = [almond(-0.024, 0.004, 0.015, 0.008, 0.006, -0.25, 5), almond(0.024, 0.004, 0.015, 0.008, 0.006, 0.25, 5)];
      const surf = (x: number, y: number) => ({ p: v3(x, y, 0.006 - 3 * (x * x + y * y)), n: v3(6 * x, 6 * y, 1).normalize() });
      const back2 = c.clone().multiplyScalar(0.7);
      add(mg, shell(outline, holes, surf, 0.008, 1, c, back2), M.lacquer);
    }
    backMasks.userData.center = C.clone().addScaledVector(backDir, 0.12);
  }

  // ── Head: the neck group handles looking around, and the head group handles the head tilt ──
  const neck = group(body, [0, 0.64, 0.08]);
  const head = group(neck, [0, 0.1, 0.02]);
  const SK = [0.13, 0.115, 0.12];
  const skullAt = ellipsoidAt(SK[0], SK[1], SK[2]);
  const headPaint = (p: THREE.Vector3, n: THREE.Vector3) => cFur.clone().lerp(cFurDark, sstep(-n.z, 0.3, 0.9) * 0.5).lerp(cPale, sstep(-p.y, 0.06, 0.09) * sstep(p.z, -0.02, 0.05));
  add(head, paint(new THREE.SphereGeometry(1, 26, 18).scale(SK[0], SK[1], SK[2]), headPaint), M.fur).userData.inkGroup = HEADF;
  // Pointed muzzle: dusk purple on top and pale underneath, with a black nose at the tip; the lower jaw is a separate pale piece, and the seam is the mouth
  add(head, paint(loft([v3(0, -0.035, 0.04), v3(0, -0.05, 0.13), v3(0, -0.06, 0.205)], curveTable([[0, 0.058, 0.05], [0.4, 0.045, 0.038], [0.85, 0.03, 0.025], [1, 0, 0]]), { segs: 16, radial: 16 }), (p, n) => cFur.clone().lerp(cFurDark, sstep(p.z, 0.15, 0.2) * 0.5).lerp(cPale, sstep(-n.y, 0.55, 0.9))), M.fur).userData.inkGroup = HEADF;
  add(head, paint(loft([v3(0, -0.07, 0.04), v3(0, -0.08, 0.12), v3(0, -0.078, 0.16)], curveTable([[0, 0.043, 0.024], [0.6, 0.028, 0.017], [1, 0, 0]]), { segs: 12, radial: 12 }), (p, n) => cFur.clone().lerp(cPale, sstep(-n.y, 0.55, 0.9))), M.fur);
  add(head, new THREE.SphereGeometry(1, 12, 8), M.nose, [0, -0.052, 0.203], [0.2, 0, 0], [0.021, 0.016, 0.017]);
  // Fur on both cheeks flaring back and out (dusk purple at the roots and slightly paler at the tips), framing the two sides of the mask
  for (const sx of [-1, 1])
    collar(head, { r0: 0.085, len: 0.11, thick: 0.05, flare: 1.15, curl: 0.45, tufts: 2, a0: sx > 0 ? -2.75 : 1.65, a1: sx > 0 ? -1.65 : 2.75, seed: 7 + sx, tint: [cFur.getHex(), cFurLight.getHex(), 0.55] }, v3(0, -0.025, -0.01), Z, Y);

  // Ears: big pointed ears spread outward, the backs and tips nearly black and the insides pale purple
  const ears: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.068, 0.078, -0.025]);
    const up = v3(sx * 0.4, 1, -0.05).normalize();
    const zz = Z.clone().addScaledVector(up, -Z.dot(up)).normalize();
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, zz), up, zz));
    const sw = group(eg);
    add(sw, paint(loft([v3(0, -0.02, 0), v3(0, 0.08, 0.002), v3(0, 0.17, -0.008)], curveTable([[0, 0.055, 0.024], [0.45, 0.044, 0.019], [0.85, 0.017, 0.009], [1, 0, 0]]), { segs: 14, radial: 12, side: X }), (p, n) => cFur.clone().lerp(cSock, Math.max(sstep(-n.z, 0.1, 0.5), sstep(p.y, 0.1, 0.14)))), M.fur).userData.inkGroup = HEADF;
    add(sw, paint(loft([v3(0, 0.005, 0.02), v3(0, 0.07, 0.019), v3(0, 0.13, 0.008)], curveTable([[0, 0.036, 0.009], [0.5, 0.027, 0.008], [1, 0, 0]]), { segs: 10, radial: 10, side: X }), () => cPale.clone().lerp(cFurLight, 0.4)), M.fur);
    ears.push({ g: sw, sx });
  }

  // ── Mask: a human half-face mask worn crooked, lying on an ellipsoid a size bigger than the head, covering the forehead and eyes, with the lower edge stopping above the pointed muzzle ──
  const ROLL = 0.13;
  const rot = ([x, y]: [number, number]): [number, number] => [x * Math.cos(ROLL) - y * Math.sin(ROLL), x * Math.sin(ROLL) + y * Math.cos(ROLL)];
  const maskAt = ellipsoidAt(0.138, 0.123, 0.132);
  const MT = 0.011;
  const R: [number, number][] = [[0, 0.1], [0.045, 0.096], [0.085, 0.08], [0.11, 0.055], [0.122, 0.022], [0.118, -0.01], [0.1, -0.036], [0.072, -0.048], [0.045, -0.044], [0.024, -0.03], [0, -0.02]];
  const outer = [...R, ...R.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number])].map(rot);
  const holeC: [number, number][] = [[-0.05, 0.02], [0.05, 0.02]];
  const holes = holeC.map(([cx, cy]) => almond(cx, cy, 0.031, 0.016, 0.012, Math.sign(cx) * 0.3).map(rot));
  add(head, shell(outer, holes, maskAt, MT, 2, cIvory, cIvoryBack), M.lacquer);
  // Vermilion brushstrokes: two sweeping up at the outer eye corners and one dot at the center of the forehead, all lacquer with a little thickness stuck on the front of the mask
  const onMask = (pts: [number, number][]) => {
    const P: THREE.Vector3[] = [];
    const N: THREE.Vector3[] = [];
    for (const q of pts) {
      const s = maskAt(...rot(q));
      P.push(s.p.addScaledVector(s.n, MT));
      N.push(s.n);
    }
    return { P, N };
  };
  for (const sx of [-1, 1]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      pts.push([sx * (0.074 + 0.018 * k), 0.034 + 0.034 * k * k]);
    }
    const { P, N } = onMask(pts);
    add(head, paint(strap(P, N, 0.011, 0.0025, false, 6), () => cRed), M.lacquer);
  }
  {
    const pts: [number, number][] = Array.from({ length: 6 }, (_, i) => [0, 0.05 + i * 0.006]);
    const { P, N } = onMask(pts);
    add(head, paint(strap(P, N, 0.014, 0.0025, false, 6), () => cRed), M.lacquer);
  }
  // Red cord: wrapping from the two sides of the mask around the back of the head, tied in a knot behind it with two tassels hanging down
  const cordG = group(head);
  {
    const y0 = 0.018;
    const P: THREE.Vector3[] = [];
    const N: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) {
      const a = lerp(1.2, 2 * PI - 1.2, i / 30);
      const d0 = v3(Math.sin(a), 0, Math.cos(a));
      const [rx, ry] = rot([d0.x * SK[0], y0]);
      const d = v3(rx / SK[0], ry / SK[1], d0.z);
      const k = 1 / Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      const p = v3(d.x * SK[0] * k, d.y * SK[1] * k, d.z * SK[2] * k);
      const n = v3(p.x / (SK[0] * SK[0]), p.y / (SK[1] * SK[1]), p.z / (SK[2] * SK[2])).normalize();
      P.push(p.addScaledVector(n, 0.003));
      N.push(n);
    }
    add(cordG, paint(strap(P, N, 0.014, 0.01, false, 8), () => cRed), M.lacquer);
    const knot = P[15].clone().addScaledVector(N[15], 0.008);
    add(cordG, paint(new THREE.SphereGeometry(1, 10, 8), () => cRed), M.lacquer, [knot.x, knot.y, knot.z], [0, 0, 0], [0.02, 0.017, 0.013]);
    for (const sx of [-1, 1]) {
      const pts = [knot.clone(), knot.clone().add(v3(sx * 0.02, -0.05, -0.02)), knot.clone().add(v3(sx * 0.035, -0.11, -0.03))];
      add(cordG, paint(loft(pts, (t) => [0.006 + 0.012 * sstep(t, 0.6, 1) * (1 - sstep(t, 0.96, 1)) + 0.001, 0.006 + 0.012 * sstep(t, 0.6, 1) * (1 - sstep(t, 0.96, 1)) + 0.001], { segs: 12, radial: 8 }), () => cRed), M.lacquer);
    }
  }

  // ── Eyes: behind the mask's eye holes, at the true position on the skull, small and dark, with only one small point of amber light ──
  const ER = 0.017;
  const glints: THREE.Mesh[] = [];
  const eyeAnchors: THREE.Group[] = [];
  for (const hc of holeC) {
    const [x, y] = rot(hc);
    const s = skullAt(x, y);
    const c = s.p.clone().addScaledVector(s.n, -ER * 0.3);
    const eg = group(head, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(Z, s.n.clone().add(v3(0, 0, 0.6)).normalize());
    add(eg, new THREE.SphereGeometry(ER, 12, 8), M.eye);
    const gl = add(eg, new THREE.SphereGeometry(0.0042, 8, 6), M.glint, [Math.sign(x) * -0.003, 0.004, ER * 0.95]);
    gl.layers.disable(INK_LAYER);
    gl.castShadow = false;
    glints.push(gl);
    eyeAnchors.push(group(eg, [0, 0, ER]));
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: tilting the head to size things up, slowly looking left and right, turning the ears in turn, breathing; the light in the eye holes dims now and then (a blink) ──
  const act = { lunge: 0, glow: 0 };
  const update = (t: number) => {
    const { lunge, glow } = act;
    const still = 1 - Math.min(1, lunge);
    const br = Math.sin(t * 1.7);
    body.scale.set(1 + br * 0.006, 1 + br * 0.004, 1 + br * 0.006);
    body.rotation.x = lunge * 0.28;
    neck.rotation.y = (Math.sin(t * 0.42) * 0.2 + Math.sin(t * 1.1) * 0.03) * still;
    neck.rotation.x = -lunge * 0.2;
    head.rotation.z = (0.12 + Math.sin(t * 0.5 + 1) * 0.07) * still;
    head.rotation.x = Math.sin(t * 0.7) * 0.03;
    for (const e of ears) {
      const ph = (t + (e.sx > 0 ? 0 : 2.3)) % 4.6;
      const turn = ph < 1.2 ? Math.sin((ph / 1.2) * PI) : 0;
      e.g.rotation.y = e.sx * turn * 0.7 * still;
      e.g.rotation.x = -lunge * 0.7;
    }
    const bt = t % 3.9;
    const blink = bt > 3.6 && bt < 3.78;
    for (const g of glints) {
      g.visible = !blink;
      g.scale.setScalar(1 + glow * 0.8);
    }
  };
  update(0);

  const tailEnd = tailCurve.getPointAt(1);
  const mc = maskAt(...rot([0, 0.03]));
  const rig = {
    head: group(head, [mc.p.x, mc.p.y, mc.p.z]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(head, [0, -0.07, 0.2]),
      mask: group(head, [mc.p.x, mc.p.y, mc.p.z + MT]),
      masks: group(body, (backMasks.userData.center as THREE.Vector3).toArray() as [number, number, number]),
      tailTip: group(body, [tailEnd.x, tailEnd.y, tailEnd.z]),
    },
  };
  delete backMasks.userData.center;
  mergeStatic(root, { owners: [body, neck, head, ...ears.map((e) => e.g)], keep: [...glints], rig });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.45, 0.02), radius: 0.6 };
}
