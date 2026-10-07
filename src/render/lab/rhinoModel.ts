// Canyon Warbeast (model lab version): the war mount of the dwarf kingdom and also an ore hauler, charging in only one direction all its life: forward. Earth, R, charge / heavy strike.
// Identifying features: 1. A long upward-curving horn at the snout tip, fitted with two iron bands forged by the dwarves, and a short horn behind it; 2. Thick hide the color of canyon red sandstone, with a high shoulder hump and the weight pressed on the front half;
// 3. The dwarves' war saddle: an iron brow plate riveted with copper nails on the forehead, a leather collar with rivets around the neck, a leather chest strap, a blue-green saddle blanket trimmed with cream, and a high-backed leather saddle.
// Back: a leather strap behind the saddle runs along the spine to the tail root, with the big iron ring for pulling ore carts lying flat on the rump (the ore hauler), and below it a thin tail with black hair at the end.
// Body shape: four-legged, with short thick pillar legs and round three-toed feet, the head stretched forward low. Personality: a single-minded charger that never turns back once it has decided what is ahead. The face follows a real rhinoceros: small black eyes sunk in the sockets on the sides of the head, tubular ears, and no human mouth line or brows.
// Personality comes from posture: shoulder hump high, head low, horn tip pointing forward and up, both ears pointing forward. Gaze order: the face and long horn first, the brow plate and saddle second, and the iron ring and strap as support.
// Action table: idle is breathing, both ears turning independently, the tail flicking and a front foot pawing the ground now and then; charge-up lowers the head and aims the horn tip ahead (act.charge); strike has the whole body charge forward with the head tossing upward;
// hit does not retreat and only lowers the head further; victory raises the head and snorts. Anchors: head, eyes, mouth, horn (long horn tip), saddle (saddle seat), hitch (the iron ring on the rump).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rbox, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const X = v3(1, 0, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Distance-field skin (written the same way as Crystal Delver) ─────────────────────────

interface Ell {
  c: THREE.Vector3;
  r: THREE.Vector3;
  inv: THREE.Quaternion;
  k: number;
}

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

/** Wrap the distance field into a mesh: vertices are shot outward from center to the surface, concentrated toward focus (the face is denser than the back of the head) */
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

/** Eyelid shell: with +y as the top, covering down to lip radians, with a rounded lip at the edge; front is centered on +z, otherwise on -z (used for the lower eyelid turned half a turn) */
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

/** Make the group's +y point along yDir and its +z face zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** The bulge of a plate: flat-topped in the wide direction with rounded shoulders on both edges (a superellipse), and rounding off quickly at both ends in the long direction */
function plateBump(su: number, sf: number, endK: number): number {
  const a = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(su), 2.6)), 1 / 2.6);
  const e = Math.abs(sf) > 1 - endK ? Math.sqrt(Math.max(0, 1 - ((Math.abs(sf) - (1 - endK)) / endK) ** 2)) : 1;
  return a * e;
}

/**
 * A plate with thickness: base(su, sf) gives a point on the bottom face and its outward normal (su and sf both run -1 to 1), the top bulges outward by th and the bottom inward a little, and the four sides are rounded into a lip.
 * Sampling in the su direction is concentrated toward the two edges (so the rounded shoulders are round), and in the sf direction toward the two ends (so the end caps are round).
 */
function plateGeo(base: (su: number, sf: number) => { p: THREE.Vector3; n: THREE.Vector3 }, th: number, nu: number, nf: number, tint: (su: number, sf: number) => THREE.Color, endK = 0.12): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  const W = nf + 1;
  const per = (nu + 1) * W;
  for (const side of [1, -0.25])
    for (let i = 0; i <= nu; i++)
      for (let j = 0; j <= nf; j++) {
        const su = -Math.cos((i / nu) * PI);
        const sf = Math.sin(((j / nf) * 2 - 1) * (PI / 2));
        const { p, n } = base(su, sf);
        const b = plateBump(su, sf, endK) * th * side;
        pos.push(p.x + n.x * b, p.y + n.y * b, p.z + n.z * b);
        const c = tint(su, sf).multiplyScalar(side > 0 ? 1 : 0.7);
        cl.push(c.r, c.g, c.b);
      }
  const idx: number[] = [];
  for (let s = 0; s < 2; s++)
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nf; j++) {
        const a = s * per + i * W + j;
        const b = a + W;
        if (s === 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
        else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  // Winding: look at the normal of the center cell of the top face, and if it is opposite the bottom face's normal, flip the whole sheet
  const ci = Math.floor(nu / 2) * W + Math.floor(nf / 2);
  const P = (k: number) => v3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const nrm = new THREE.Vector3().crossVectors(P(ci + W).sub(P(ci)), P(ci + 1).sub(P(ci)));
  if (nrm.dot(base(0, 0).n) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
  }
  g.computeVertexNormals();
  return g;
}


// ───────────────────────── Shape ─────────────────────────

export function buildRhinoLab(): LabModel {
  const RIMC = 0xffd6b6;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const HIDE = col(0xb06a4e);
  const HIDE_L = col(0xc98a6a);
  const HIDE_D = col(0x874a38);
  const HORN_TIP = col(0xf0e6cc);
  const HORN_BASE = col(0x8e7c66);
  const TEAL = col(0x2e6a70);
  const TEAL_D = col(0x22505a);
  const CREAM = col(0xe8d9b0);
  const LEATHER = col(0x7c4c2e);
  const LEATHER_D = col(0x3f281b);
  const IRON = col(0x5a606c);
  const IRON_D = col(0x3e434e);

  const M = {
    hide: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC, speckle: 0.1 })),
    hideFlat: labToon(0xb06a4e, { rim: 0.55, rimColor: RIMC, speckle: 0.1 }),
    horn: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xfff4e0 })),
    iron: vc(labToon(0xffffff, { ramp: 'metal', spec: 0.6, specTh: 0.98, rim: 0.35, rimColor: 0xdfe8ff })),
    brass: labToon(0xcf9f48, { ramp: 'metal', spec: 0.8, specTh: 0.97, rim: 0.3, rimColor: 0xffe2a8 }),
    cloth: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xcfeff0 })),
    leather: vc(labToon(0xffffff, { rim: 0.35, rimColor: RIMC })),
    eye: labToon(0x150d0b, { ramp: 'gem', rim: 0 }),
    nail: labToon(0x6e6056, { rim: 0.3, rimColor: RIMC }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'rhino-lab';
  const { add, group } = partKit();

  const BODY = 9901;
  const HEAD = 9920;

  // The midpoint between head and tail is at the origin (the lab rotates about the origin)
  const all = group(root, [0, 0, -0.225]);
  const body = group(all);

  // ── Torso: a barrel-shaped body with a high shoulder hump, a thick chest and a slightly lower rump, with the neck root stretching forward ──
  const bb = new Blob();
  bb.add(v3(0, 0.66, -0.08), v3(0.34, 0.32, 0.6), undefined, 0.12);
  bb.add(v3(0, 0.79, 0.26), v3(0.33, 0.28, 0.32), undefined, 0.12);
  bb.add(v3(0, 0.62, 0.36), v3(0.3, 0.3, 0.26), undefined, 0.12);
  bb.add(v3(0, 0.72, -0.46), v3(0.31, 0.27, 0.27), undefined, 0.12);
  bb.add(v3(0, 0.52, -0.05), v3(0.31, 0.22, 0.48), undefined, 0.14);
  bb.add(v3(0, 0.74, 0.56), v3(0.22, 0.24, 0.2), undefined, 0.1);
  const hideTint = (p: THREE.Vector3, n: THREE.Vector3) => HIDE.clone().lerp(HIDE_L, sstep(-n.y, 0.3, 0.8) * 0.8).lerp(HIDE_D, sstep(n.y, 0.75, 1) * 0.2 + sstep(0.2 - p.y, 0, 0.15) * 0.3);
  add(body, blobGeo(bb, v3(0, 0.66, -0.02), 17, v3(0, 0.2, 1), 0.12, hideTint), M.hide).userData.inkGroup = BODY;

  // ── Legs: short thick pillar legs with the top ends tucked into the torso; round three-toed feet, a gray toenail on each toe ──
  const legProf = curveTable([[0, 0, 0], [0.1, 0.14, 0.14], [0.45, 0.115, 0.12], [0.75, 0.1, 0.1], [0.9, 0.108, 0.108], [1, 0, 0]]);
  const legPts: [number, THREE.Vector3[]][] = [];
  for (const sx of [-1, 1]) {
    legPts.push([sx, [v3(sx * 0.2, 0.6, 0.3), v3(sx * 0.23, 0.36, 0.33), v3(sx * 0.235, 0.14, 0.34), v3(sx * 0.235, 0.05, 0.345)]]);
    legPts.push([sx, [v3(sx * 0.21, 0.66, -0.42), v3(sx * 0.24, 0.4, -0.5), v3(sx * 0.24, 0.16, -0.44), v3(sx * 0.24, 0.05, -0.42)]]);
  }
  const nailGeo = new THREE.SphereGeometry(1, 8, 6);
  for (const [, pts] of legPts) {
    add(body, paint(loft(pts, legProf, { segs: 16, radial: 14 }), hideTint), M.hide).userData.inkGroup = BODY;
    const f = pts[pts.length - 1];
    add(body, paint(new THREE.SphereGeometry(1, 16, 8), (p, n) => hideTint(p, n).lerp(HIDE_D, 0.35)), M.hide, [f.x, 0.05, f.z + 0.01], [0, 0, 0], [0.122, 0.05, 0.128]).userData.inkGroup = BODY;
    for (const a of [-0.62, 0, 0.62]) add(body, nailGeo, M.nail, [f.x + Math.sin(a) * 0.1, 0.034, f.z + 0.01 + Math.cos(a) * 0.108], [0, a, 0], [0.036, 0.03, 0.03]);
  }

  // ── Skin folds: one thick fold running down from the back behind the shoulder and one in front of the rump, like plates of armor hide; in the same outline group as the body, read only by shading and creases ──
  for (const [z, f0, f1] of [[0.33, 0.3, 1.45], [-0.42, 0.45, 1.85]] as [number, number, number][])
    for (const sx of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const f = sx * lerp(f0, f1, i / 10);
        const { p, n } = bb.hit(v3(0, 0.62, z), v3(Math.sin(f), Math.cos(f), 0));
        pts.push(p.addScaledVector(n, -0.004));
      }
      const g = loft(pts, (t) => {
        const k = Math.pow(Math.sin(PI * clamp(t, 0, 1)), 0.5);
        return [0.024 * k + 0.001, 0.02 * k + 0.001];
      }, { segs: 16, radial: 8, side: v3(0, 0, 1) });
      add(body, paint(g, hideTint), M.hide).userData.inkGroup = BODY;
    }

  // ── Tail: a thin tail hanging from the top of the rump, with a tuft of black hair at the end ──
  const tailG = group(body, [0, 0.8, -0.69]);
  {
    const tp = [v3(0, 0, 0.04), v3(0, -0.04, -0.06), v3(0, -0.16, -0.11), v3(0, -0.3, -0.1)];
    add(tailG, paint(loft(tp, curveTable([[0, 0, 0], [0.08, 0.034, 0.034], [0.6, 0.024, 0.024], [1, 0.02, 0.02]]), { segs: 12, radial: 8, side: X }), hideTint), M.hide).userData.inkGroup = BODY;
    const tuft = loft([v3(0, -0.28, -0.1), v3(0, -0.34, -0.1), v3(0, -0.4, -0.08)], curveTable([[0, 0.028, 0.02], [0.5, 0.032, 0.022], [1, 0, 0]]), { segs: 8, radial: 8, side: X });
    add(tailG, paint(tuft, () => col(0x2e221e)), M.leather);
  }

  // ── Head: the front part of the neck, skull, a long face sloping downward, a square muzzle and the small hook of the upper lip, one distance-field block, hung on the pivot at the neck root (the seam is hidden under the collar) ──
  const HP = v3(0, 0.76, 0.62);
  const head = group(body, [HP.x, HP.y, HP.z]);
  const toHead = (p: THREE.Vector3) => p.clone().sub(HP);
  const hb = new Blob();
  hb.add(v3(0, 0.76, 0.66), v3(0.19, 0.2, 0.14), undefined, 0.1);
  hb.add(v3(0, 0.74, 0.82), v3(0.16, 0.17, 0.19), undefined, 0.1);
  hb.add(v3(0, 0.64, 1.0), v3(0.125, 0.13, 0.2), new THREE.Quaternion().setFromAxisAngle(X, 0.32), 0.1);
  hb.add(v3(0, 0.56, 1.14), v3(0.1, 0.088, 0.095), undefined, 0.08);
  hb.add(v3(0, 0.515, 1.21), v3(0.058, 0.045, 0.05), undefined, 0.05);
  hb.add(v3(0, 0.49, 1.09), v3(0.082, 0.056, 0.1), undefined, 0.06);
  for (const sx of [-1, 1]) hb.add(v3(sx * 0.1, 0.66, 0.86), v3(0.1, 0.11, 0.13), undefined, 0.08);
  const HO = v3(0, 0.66, 0.92);
  const sdir = (lon: number, lat: number) => v3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
  const ER = 0.024;
  // The eye is on the side of the head above the cheek; a brow bone ridge of the same color is added above the eye (rhinos have one naturally)
  const eyeHit0 = [-1, 1].map((sx) => hb.hit(HO, sdir(sx * 1.05, 0.12)));
  for (const [i, sx] of [-1, 1].entries()) {
    const e = eyeHit0[i];
    hb.add(e.p.clone().add(v3(-sx * 0.025, 0.045, -0.012)), v3(0.05, 0.028, 0.06), undefined, 0.04);
  }
  const eyeAt = [-1, 1].map((sx) => {
    const { p, n } = hb.hit(HO, sdir(sx * 1.05, 0.12));
    return { sx, p, n, c: p.clone().addScaledVector(n, -ER * 0.45) };
  });
  {
    const geo = blobGeo(hb, v3(0, 0.68, 0.88), 16, v3(0, -0.1, 1), 0.3, (p, n) => {
      let c = hideTint(p, n);
      // The upper lip and lower jaw are one step darker
      c = c.lerp(HIDE_D, sstep(0.56 - p.y, 0, 0.08) * 0.55);
      return c;
    });
    geo.translate(-HP.x, -HP.y, -HP.z);
    add(head, geo, M.hide).userData.inkGroup = HEAD;
  }

  // ── Long horn: growing from above the snout tip, going forward first and then curving up and back; dark at the root and light at the tip, fitted with two iron bands ──
  const hornHit = hb.hit(v3(0, 0.58, 1.1), v3(0, 1, 0.12));
  const hb0 = toHead(hornHit.p).addScaledVector(hornHit.n, -0.035);
  const hornG = group(head, [hb0.x, hb0.y, hb0.z]);
  const hornPts = [v3(0, 0, 0), v3(0, 0.16, 0.055), v3(0, 0.33, 0.045), v3(0, 0.47, -0.02), v3(0, 0.57, -0.11)];
  const hornProf = curveTable([[0, 0.104, 0.116], [0.15, 0.084, 0.094], [0.5, 0.054, 0.058], [0.85, 0.022, 0.024], [1, 0, 0]]);
  add(hornG, paint(loft(hornPts, hornProf, { segs: 24, radial: 14, side: X }), (p) => HORN_BASE.clone().lerp(HORN_TIP, sstep(p.y, 0.0, 0.16))), M.horn);
  {
    const curve = new THREE.CatmullRomCurve3(hornPts, false, 'centripetal');
    for (const t of [0.2, 0.36]) {
      const [a, b] = hornProf(t);
      const P = curve.getPointAt(t);
      const T = curve.getTangentAt(t);
      const ring = add(hornG, paint(new THREE.TorusGeometry(1, 0.16, 8, 22), (p) => IRON.clone().lerp(IRON_D, sstep(-p.z, 0, 0.12))), M.iron, [P.x, P.y, P.z], [0, 0, 0], [a + 0.006, b + 0.006, 0.07]);
      ring.quaternion.setFromUnitVectors(v3(0, 0, 1), T);
    }
  }
  const hornTip = group(hornG, [0, 0.57, -0.11]);
  // Short horn: one in front of the forehead
  {
    const h2 = hb.hit(HO, v3(0, 1, 0.72));
    const b2 = toHead(h2.p).addScaledVector(h2.n, -0.02);
    const g2 = group(head, [b2.x, b2.y, b2.z]);
    add(g2, paint(loft([v3(0, 0, 0), v3(0, 0.07, 0.012), v3(0, 0.14, -0.015)], curveTable([[0, 0.066, 0.07], [0.4, 0.044, 0.048], [1, 0, 0]]), { segs: 10, radial: 12, side: X }), (p) => HORN_BASE.clone().lerp(HORN_TIP, sstep(p.y, 0.02, 0.12))), M.horn);
  }

  // ── Iron brow plate: an iron plate behind the short horn between the two ears, rounded all around, with a row of copper rivets on each side ──
  const plateDir = (su: number, sf: number) => {
    const th = lerp(1.22, 2.0, (su + 1) / 2);
    const w = lerp(0.3, 0.44, (su + 1) / 2);
    return v3(Math.sin(sf * w), Math.cos(sf * w) * Math.sin(th), Math.cos(sf * w) * Math.cos(th));
  };
  const plateBase = (su: number, sf: number) => {
    const { p, n } = hb.hit(HO, plateDir(su, sf));
    return { p: toHead(p), n };
  };
  add(head, plateGeo(plateBase, 0.03, 8, 12, (su, sf) => IRON.clone().lerp(IRON_D, Math.max(sstep(Math.abs(su), 0.6, 0.95), sstep(Math.abs(sf), 0.6, 0.95)) * 0.6), 0.25), M.iron);
  const rivetGeo = new THREE.SphereGeometry(1, 8, 4, 0, PI * 2, 0, PI / 2);
  const rivet = (parent: THREE.Object3D, p: THREE.Vector3, n: THREE.Vector3, r: number) => {
    const m = add(parent, rivetGeo, M.brass, [p.x, p.y, p.z], [0, 0, 0], [r, r * 0.7, r]);
    m.quaternion.setFromUnitVectors(UP, n);
  };
  for (const sf of [-0.72, 0.72])
    for (const su of [-0.55, 0.1, 0.7]) {
      const { p, n } = plateBase(su, sf);
      rivet(head, p.addScaledVector(n, plateBump(su, sf, 0.25) * 0.03 - 0.002), n, 0.016);
    }

  // ── Ears: tubular ears on both sides of the top of the head, the openings facing forward and up, dark on the inside ──
  const ears: { g: THREE.Group; sx: number }[] = [];
  {
    const prof: [number, number][] = [[0.001, 0], [0.03, 0.006], [0.046, 0.04], [0.05, 0.09], [0.045, 0.14], [0.036, 0.168], [0.03, 0.175], [0.024, 0.166], [0.028, 0.14], [0.03, 0.09], [0.02, 0.05], [0.001, 0.035]];
    const eg = paint(lathe(prof, 14), (p, n) => {
      const inside = n.x * p.x + n.z * p.z < 0 ? 1 : 0;
      return HIDE.clone().lerp(HIDE_D, inside * 0.7 + sstep(p.y, 0.15, 0.175) * 0.3);
    });
    for (const sx of [-1, 1]) {
      const { p, n } = hb.hit(HO, sdir(sx * 1.55, 1.0));
      const b = toHead(p).addScaledVector(n, -0.02);
      const eo = group(head, [b.x, b.y, b.z]);
      orient(eo, v3(sx * 0.5, 1, 0.3), v3(sx * 0.3, -0.2, 1));
      const piv = group(eo);
      add(piv, eg, M.hide, [0, 0, 0], [0, 0, 0], [0.85, 1, 1]).userData.inkGroup = HEAD + 1;
      ears.push({ g: piv, sx });
    }
  }

  // ── Eyes: small black eyes on the sides of the head (diameter about 15% of the head width), sunk in the sockets, with only one small highlight; both eyes look forward together ──
  const UP_OPEN = 1.0;
  const LO_OPEN = 0.9;
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const gazes: { g: THREE.Group; sx: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = lidLite(ER + 0.004, ER + 0.01, PI / 2, true);
  const lidLow = lidLite(ER + 0.003, ER + 0.009, PI / 2, false);
  const eyeball = new THREE.SphereGeometry(ER, 14, 7, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const { sx, n, c } of eyeAt) {
    const hc = toHead(c);
    const eg = group(head, [hc.x, hc.y, hc.z]);
    const d = n.clone().lerp(sdir(sx * 0.8, 0.1), 0.4).normalize();
    const r = new THREE.Vector3().crossVectors(UP, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    add(eg, eyeball, M.eye);
    const gaze = group(eg, [0, 0, 0], [-0.05, -sx * 0.35, 0]);
    gazes.push({ g: gaze, sx });
    for (const [x, y, rr] of [[ER * 0.34, ER * 0.36, ER * 0.26]] as [number, number, number][]) {
      const hl = add(gaze, new THREE.SphereGeometry(rr, 8, 6), M.hi, [x, y, ER * 0.96], [0, 0, 0], [1, 1, 0.5]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(gaze, [0, 0, ER]));
    const slant = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), sx * 0.08);
    const lidG = group(eg);
    lidG.quaternion.copy(slant);
    const upper = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.hideFlat).userData.inkGroup = HEAD;
    const lower = group(head, [hc.x, hc.y, hc.z]);
    lower.quaternion.copy(eg.quaternion).multiply(slant).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.hideFlat).userData.inkGroup = HEAD;
    lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02 });
  }

  // ── Collar: a thick leather band covering the seam between head and body, with three copper rivets on top ──
  const hoop = (o: THREE.Vector3, blobs: Blob[], a0: number, a1: number, n: number, plane: 'z' | 'y', lift: number) => {
    const pts: THREE.Vector3[] = [];
    const nrm: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      const d = plane === 'z' ? v3(Math.sin(a), Math.cos(a), 0) : v3(Math.sin(a), 0, Math.cos(a));
      let best: { p: THREE.Vector3; n: THREE.Vector3 } | null = null;
      for (const b of blobs) {
        const h = b.hit(o, d);
        if (!best || h.p.distanceTo(o) > best.p.distanceTo(o)) best = h;
      }
      pts.push(best!.p.addScaledVector(best!.n, lift));
      nrm.push(best!.n);
    }
    return { pts, nrm };
  };
  const strapGeo = (pts: THREE.Vector3[], w: number, h: number, side: THREE.Vector3, tint: THREE.Color, closed = false) => {
    const g = loft(pts, (t) => {
      const k = closed ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, Math.abs(t - 0.5) - 0.47) / 0.03, 2)));
      return [w * k, h * k];
    }, { segs: pts.length * 2, radial: 8, side });
    return paint(g, (p, n) => tint.clone().multiplyScalar(0.85 + 0.15 * Math.max(0, n.y)));
  };
  {
    const o = v3(0, 0.76, 0.665);
    const { pts } = hoop(o, [bb, hb], 0, PI * 2, 40, 'z', 0.012);
    add(body, strapGeo(pts, 0.05, 0.018, v3(0, 0, 1), LEATHER, true), M.leather);
    for (const a of [-0.55, 0, 0.55]) {
      const d = v3(Math.sin(a), Math.cos(a), 0);
      const hs = [bb.hit(o, d), hb.hit(o, d)].sort((x, y) => y.p.distanceTo(o) - x.p.distanceTo(o))[0];
      rivet(body, hs.p.addScaledVector(hs.n, 0.028), hs.n, 0.017);
    }
  }

  // ── Saddle blanket and saddle: a thick blue-green blanket trimmed in cream on the back, with a dark leather saddle on top, low in front and high behind ──
  const BZ = -0.06;
  const onBack = (z: number, f: number, lift: number) => {
    const { p, n } = bb.hit(v3(0, 0.62, z), v3(Math.sin(f), Math.cos(f), 0));
    return { p: p.addScaledVector(n, lift), n };
  };
  add(body, plateGeo((su, sf) => onBack(BZ + su * 0.3, sf * 1.28, 0), 0.024, 10, 22, (su, sf) => {
    const edge = Math.max(sstep(Math.abs(su), 0.84, 0.92), sstep(Math.abs(sf), 0.87, 0.94));
    return TEAL.clone().lerp(TEAL_D, sstep(Math.abs(sf), 0.3, 0.85) * 0.35).lerp(CREAM, edge);
  }, 0.07), M.cloth);
  // Leather saddle: a saddle seat, a high cantle leaning back behind it and a pommel in front
  const SEAT = (su: number, sf: number) => onBack(BZ + 0.02 + su * 0.2, sf * 0.46, 0.022);
  add(body, plateGeo(SEAT, 0.03, 8, 14, (su, sf) => LEATHER.clone().lerp(LEATHER_D, Math.max(sstep(Math.abs(su), 0.6, 0.95), sstep(Math.abs(sf), 0.6, 0.95)) * 0.6), 0.2), M.leather);
  {
    const z = BZ + 0.02 - 0.19;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const f = lerp(-0.42, 0.42, i / 12);
      const { p, n } = onBack(z, f, 0.03);
      pts.push(p.addScaledVector(n, 0.03 * Math.cos(f * 1.6)).add(v3(0, 0, -0.012 * Math.cos(f * 1.6))));
    }
    add(body, strapGeo(pts, 0.016, 0.034, v3(0, 0, 1), LEATHER_D), M.leather);
    const k = onBack(BZ + 0.02 + 0.19, 0, 0.045);
    add(body, paint(new THREE.SphereGeometry(1, 10, 8), () => LEATHER_D.clone()), M.leather, [k.p.x, k.p.y, k.p.z], [0, 0, 0], [0.028, 0.034, 0.026]);
  }
  const saddleA = group(body, [...onBack(BZ + 0.02, 0, 0.07).p.toArray()] as [number, number, number]);

  // ── Girth and breast strap: the girth passes under the blanket edge around the belly, and the breast strap runs from the girth along the flank around the front of the chest, with an iron ring in the exact middle ──
  {
    const { pts } = hoop(v3(0, 0.62, BZ + 0.02), [bb], 1.02, PI * 2 - 1.02, 30, 'z', 0.016);
    add(body, strapGeo(pts, 0.042, 0.011, v3(0, 0, 1), LEATHER), M.leather);
    const bp: THREE.Vector3[] = [];
    const Y = 0.5;
    const route: [number, number, number, number][] = [
      [-1, BZ + 0.02, -1, 0],
      [-1, 0.14, -1, 0],
      [-1, 0.3, -1, 0.35],
      [0, 0.3, -0.6, 0.8],
      [0, 0.3, 0, 1],
      [0, 0.3, 0.6, 0.8],
      [1, 0.3, 1, 0.35],
      [1, 0.14, 1, 0],
      [1, BZ + 0.02, 1, 0],
    ];
    for (const [, z, dx, dz] of route) {
      const { p, n } = bb.hit(v3(0, Y, z), v3(dx, 0, dz));
      bp.push(p.addScaledVector(n, 0.01));
    }
    add(body, strapGeo(bp, 0.03, 0.009, UP, LEATHER), M.leather);
    const front = bb.hit(v3(0, Y, 0.3), v3(0, 0, 1));
    const ring = add(body, paint(new THREE.TorusGeometry(0.042, 0.011, 8, 22), () => IRON.clone()), M.iron, [...front.p.addScaledVector(front.n, 0.02).toArray()] as [number, number, number]);
    ring.quaternion.setFromUnitVectors(v3(0, 0, 1), front.n);
  }

  // ── Back: a leather strap behind the saddle runs along the spine to the tail root, with the big iron ring for pulling ore carts standing on the rump ──
  const hitchG = group(body);
  {
    const cp: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const z = lerp(BZ - 0.3, -0.66, i / 10);
      cp.push(onBack(z, 0, 0.008).p);
    }
    add(body, strapGeo(cp, 0.028, 0.008, X, LEATHER), M.leather);
    const at = onBack(-0.5, 0, 0.012);
    add(body, paint(rbox(0.1, 0.02, 0.1, 0.008, 2), () => IRON_D.clone()), M.iron, [at.p.x, at.p.y, at.p.z]).quaternion.setFromUnitVectors(UP, at.n);
    hitchG.position.copy(at.p);
    hitchG.quaternion.setFromUnitVectors(UP, at.n);
    // The ring lies flat on an iron seat on top of the rump
    add(hitchG, paint(new THREE.TorusGeometry(0.062, 0.015, 8, 26), (p) => IRON.clone().lerp(IRON_D, sstep(p.y, 0, 0.06))), M.iron, [0, 0.022, 0], [PI / 2, 0, 0]);
  }
  const hitchA = group(hitchG, [0, 0.022, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: breathing, both ears turning independently, the tail flicking, the head nodding slightly, the iron ring swinging; charge-up lowers the head ──
  const act = { charge: 0 };
  const update = (t: number) => {
    const br = Math.sin(t * 1.5);
    body.scale.set(1 + br * 0.006, 1 + br * 0.008, 1 + br * 0.004);
    body.rotation.x = act.charge * 0.05;
    head.rotation.set(-0.03 + Math.sin(t * 0.7) * 0.03 + act.charge * 0.25, Math.sin(t * 0.33) * 0.07 * (1 - act.charge), 0);
    for (const { g, sx } of ears) {
      const ph = t * 0.9 + (sx > 0 ? 0 : 2.1);
      const flick = Math.max(0, Math.sin(ph * 1.7)) ** 6;
      g.rotation.set(Math.sin(ph * 0.5) * 0.08 - act.charge * 0.2, sx * (Math.sin(ph * 0.37) * 0.25 + flick * 0.3), 0);
    }
    tailG.rotation.set(0.05 + Math.sin(t * 1.1) * 0.05, 0, Math.sin(t * 2.3) * 0.3);
    
    const bt = t % 4.2;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
    const close = bk(bt - 3.6);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    for (const g of gazes) g.g.rotation.y = -g.sx * 0.35;
  };
  update(0);

  const faceA = group(head, [...toHead(v3(0, 0.66, 1.0)).toArray()] as [number, number, number]);
  const mouthA = group(head, [...toHead(hb.hit(v3(0, 0.5, 1.12), v3(0, -0.2, 1)).p).toArray()] as [number, number, number]);
  const rig = { head: faceA, eyes: eyeAnchors, anchors: { mouth: mouthA, horn: hornTip, saddle: saddleA, hitch: hitchA } };
  mergeStatic(root, {
    owners: [body, head, tailG, hornG, hitchG, ...ears.map((e) => e.g), ...gazes.map((g) => g.g), ...lids.map((l) => l.g)],
    keep: [...glints],
    twins: [[M.hideFlat, M.hide]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.56, 0), radius: 1.15 };
}
