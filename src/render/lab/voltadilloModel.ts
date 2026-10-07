// Thunderplate (model lab version): on stormy nights it curls into a ball and lets lightning strike its shell; the more it is struck, the brighter the lines on its shell, and the herders call it "stored thunder". Thunder + earth, N, tank / charge storing.
// Identifying features: 1. A high domed shell in slate blue: two large shields, front and back, with six bands between them, each band a thick, beveled plate;
// 2. A yellow jagged lightning mark down the spine, zigzagging from the front shield all the way to the rear shield (the only emissive on the whole body, the stored thunder); 3. A pink-skinned long pointed muzzle with a pair of large upright ears, and a small shield patch on top of the head.
// Body shape: a low four-legged build with all the weight pressed under the domed shell, short thick legs and three big digging claws on the front feet. Back: on the rear shield the lightning narrows to a point, and below it a short tail of segmented banded armor.
// Personality: taking hits is its profession, an honest shield that plants all four feet and does not move, and when struck by lightning it arches its shell even higher. The face follows an armadillo: small black eyes sunk in their sockets, a long muzzle, and no human mouth line or brows.
// Personality comes from posture: head slightly raised and stretched forward, ears spread outward and upright, all four feet apart and firmly planted.
// Gaze order: the face and big ears first, the lightning mark on the spine second, and the bands and tail as support.
// Action table: idle is breathing, the ears twitching in turn, the nose sniffing and the lightning mark slowly flickering; charge-up tucks the head under the front shield and brightens the lines (act.glow); strike butts forward with the shield on top of the head (act.bash);
// hit braces all four feet and shudders the shell with the head not tucking; victory raises the head and stands both ears upright. Anchors: head, eyes, mouth, shell (top of the shell), tail (tail tip).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, loft, mergeStatic, partKit, PI, type LabModel } from './shapes.ts';
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

export function buildVoltadilloLab(): LabModel {
  const RIMC = 0xfff0b8;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const SKIN = col(0xe2b49e);
  const SKIN_D = col(0xc99682);
  const BELLY = col(0xf2d8c6);
  const PINK = col(0xef9ea4);
  const SLATE = col(0x4d5b7c);
  const SLATE_L = col(0x7384a6);
  const SLATE_D = col(0x3a4562);

  const M = {
    skin: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    skinFlat: labToon(0xe2b49e, { rim: 0.55, rimColor: RIMC }),
    shell: vc(labToon(0xffffff, { ramp: 'stone', speckle: 0.22, rim: 0.5, rimColor: 0xd6e2ff })),
    bolt: labToon(0xffe45c, { ramp: 'gem', emissive: 0xffc414, emissiveAmt: 0.5, rim: 0.2, rimColor: 0xffffff }),
    eye: labToon(0x150d0b, { ramp: 'gem', rim: 0 }),
    nose: labToon(0x7c4450, { spec: 0.3, specTh: 0.992, rim: 0.3, rimColor: RIMC }),
    claw: labToon(0x4a3c3c, { spec: 0.35, specTh: 0.99, rim: 0.3, rimColor: RIMC }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'voltadillo-lab';
  const { add, group } = partKit();

  const BODY = 9811;
  const HEAD = 9830;
  const BOLT = 9850;
  const TAIL = 9860;

  const body = group(root);

  // ── Torso: the skin under the shell, with only the belly, the flanks and the leg roots showing ──
  const torso = new Blob();
  torso.add(v3(0, 0.36, -0.04), v3(0.38, 0.26, 0.5), undefined, 0.1);
  torso.add(v3(0, 0.27, -0.02), v3(0.35, 0.17, 0.44), undefined, 0.12);
  add(body, blobGeo(torso, v3(0, 0.34, -0.03), 9, v3(0, -0.3, 1), 0.1, (p, n) => SKIN.clone().lerp(BELLY, sstep(-n.y, 0.3, 0.7))), M.skin).userData.inkGroup = BODY;

  // ── Shell: a front shield, six bands and a rear shield cut out of an ellipsoid, each plate bulging on its own with rounded shoulders on both edges, and a narrow steep V groove between plates ──
  const E = { c: v3(0, 0.36, -0.05), a: 0.44, b: 0.35, z: 0.6 };
  const ellPt = (u: number, f: number) => {
    const rad = Math.sqrt(Math.max(0, 1 - u * u));
    return v3(E.a * rad * Math.sin(f), E.b * rad * Math.cos(f), E.z * u).add(E.c);
  };
  const ellN = (p: THREE.Vector3) => {
    const d = p.clone().sub(E.c);
    return v3(d.x / (E.a * E.a), d.y / (E.b * E.b), d.z / (E.z * E.z)).normalize();
  };
  interface Band {
    uc: number;
    hu: number;
    fmax: number;
    th: number;
  }
  const bands: Band[] = [];
  const cuts = [-0.9, -0.44, -0.3, -0.155, -0.01, 0.135, 0.28, 0.42, 0.86];
  for (let k = 0; k < cuts.length - 1; k++) {
    const u0 = cuts[k] - (k > 0 ? 0.012 : 0);
    const u1 = cuts[k + 1] + (k < cuts.length - 2 ? 0.012 : 0);
    const shield = k === 0 || k === cuts.length - 2;
    bands.push({ uc: (u0 + u1) / 2, hu: (u1 - u0) / 2, fmax: shield ? 1.78 : 1.7, th: shield ? 0.05 : 0.04 });
  }
  const shellG = group(body);
  bands.forEach((B, k) => {
    const shield = k === 0 || k === bands.length - 1;
    const geo = plateGeo(
      (su, sf) => {
        const p = ellPt(B.uc + su * B.hu, sf * B.fmax);
        return { p, n: ellN(p) };
      },
      B.th,
      shield ? 10 : 6,
      22,
      (su, sf) => {
        // Slate blue on the back, one step lighter on the rounded shoulders at both edges (polished plate edges), and darkening toward the skirt edge
        const c = SLATE.clone().lerp(SLATE_L, sstep(Math.abs(su), 0.55, 0.92));
        return c.lerp(SLATE_D, sstep(Math.abs(sf), 0.55, 0.95) * 0.7);
      },
      shield ? 0.1 : 0.14,
    );
    add(shellG, geo, M.shell);
  });

  // ── Lightning mark: a yellow zigzag from the front shield along the spine to the rear shield, each segment lying on the flat top of the plate it is on; thick in front and thin behind, finally narrowing to a point ──
  const onPlate = (B: Band, u: number, x: number, lift: number) => {
    const rad = Math.sqrt(Math.max(0, 1 - u * u));
    const f = x / (E.a * rad);
    const p = ellPt(u, f);
    const n = ellN(p);
    const b = plateBump((u - B.uc) / B.hu, f / B.fmax, 0.14) * B.th + lift;
    return { p: p.addScaledVector(n, b), n };
  };
  // The break points are ordered from head to tail: two strokes on the front shield, one stroke on each of the six bands and two on the rear shield; two adjacent strokes meet at the same x on either side of the groove, and joined together they form one zigzag
  const knots = [-0.02, 0.07, -0.05, 0.055, -0.05, 0.05, -0.045, 0.045, -0.04, 0.035, -0.012];
  const widths = [0.03, 0.028, 0.026, 0.024, 0.022, 0.02, 0.018, 0.016, 0.015, 0.013, 0];
  // [plate index, start su, end su, start break point]
  const plan: [number, number, number, number][] = [
    [7, 0.62, -0.05, 0],
    [7, -0.05, -0.74, 1],
    [6, 0.74, -0.74, 2],
    [5, 0.74, -0.74, 3],
    [4, 0.74, -0.74, 4],
    [3, 0.74, -0.74, 5],
    [2, 0.74, -0.74, 6],
    [1, 0.74, -0.74, 7],
    [0, 0.8, 0.12, 8],
    [0, 0.12, -0.62, 9],
  ];
  const strokes = plan.map(([k, s0, s1, i]) => [k, s0, knots[i], s1, knots[i + 1], widths[i], i === plan.length - 1 ? 0 : widths[i + 1]] as [number, number, number, number, number, number, number]);
  const boltParts: THREE.Mesh[] = [];
  for (const [k, s0, x0, s1, x1, w0, w1] of strokes) {
    const B = bands[k];
    const pts: THREE.Vector3[] = [];
    let nMid = UP.clone();
    const N = 7;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const su = lerp(s0, s1, t);
      const { p, n } = onPlate(B, B.uc + su * B.hu, lerp(x0, x1, t), 0.003);
      pts.push(p);
      if (i === Math.floor(N / 2)) nMid = n;
    }
    const T = pts[pts.length - 1].clone().sub(pts[0]).normalize();
    const side = new THREE.Vector3().crossVectors(T, nMid).normalize();
    const round = w1 > 0 ? 0.1 : 0.0;
    const geo = loft(pts, (t) => {
      const w = lerp(w0, w1, t);
      // Both ends are rounded (the last stroke narrows to a point)
      const cap0 = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, 0.1 - t) / 0.1, 2)));
      const cap1 = round > 0 ? Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.9) / 0.1, 2))) : 1;
      const k2 = cap0 * cap1;
      return [Math.max(0, w * k2), 0.007 * k2 + (k2 > 0 ? 0.0005 : 0)];
    }, { segs: 12, radial: 6, side });
    const m = add(shellG, geo, M.bolt);
    m.userData.inkGroup = BOLT;
    boltParts.push(m);
  }

  // ── Tail: a short tail of segmented banded armor extending from the lower edge of the rear shield, with the tip curled up slightly ──
  const tailG = group(body, [0, 0.29, -0.5]);
  {
    const tp = [v3(0, 0.02, 0.06), v3(0, -0.02, -0.14), v3(0, -0.1, -0.3), v3(0, -0.17, -0.4), v3(0, -0.17, -0.47)];
    const base = curveTable([[0, 0.0], [0.04, 0.075], [0.2, 0.08], [0.6, 0.05], [0.9, 0.028], [1, 0]]);
    const RINGS = 7;
    const geo = loft(tp, (t) => {
      const r = base(t)[0];
      const ring = t > 0.12 && t < 0.92 ? Math.pow(Math.sin(((t - 0.12) / 0.8) * PI * RINGS), 2) : 0;
      const k = 1 + ring * 0.12;
      return [r * k, r * k];
    }, { segs: 56, radial: 12, side: X });
    paint(geo, (p) => {
      // High on the rings is light and the trough is dark: computed from the position along the approximate length of the tail
      const t = clamp((0.06 - p.z) / 0.53, 0, 1);
      const ring = t > 0.12 && t < 0.92 ? Math.pow(Math.sin(((t - 0.12) / 0.8) * PI * RINGS), 2) : 0;
      return SLATE_D.clone().lerp(SLATE_L, ring * 0.8);
    });
    add(tailG, geo, M.shell).userData.inkGroup = TAIL;
  }

  // ── Legs: short and thick, with the top ends tucked into the torso; the front feet have three digging claws curving forward and the hind feet four short claws ──
  const clawGeo = (len: number, r: number) =>
    loft([v3(0, 0, 0), v3(0, -len * 0.18, len * 0.5), v3(0, -len * 0.5, len)], curveTable([[0, r, r * 0.8], [0.5, r * 0.75, r * 0.6], [0.85, r * 0.4, r * 0.35], [1, 0, 0]]), { segs: 7, radial: 6, side: X });
  const legProf = curveTable([[0, 0.0, 0.0], [0.12, 0.078, 0.078], [0.6, 0.074, 0.074], [0.88, 0.068, 0.064], [1, 0.0, 0.0]]);
  const legs: [number, number, number][] = [
    [1, 0.3, 0.02],
    [-1, 0.3, 0.02],
    [1, -0.32, -0.02],
    [-1, -0.32, -0.02],
  ];
  const bigClaw = clawGeo(0.095, 0.017);
  const smallClaw = clawGeo(0.05, 0.013);
  for (const [sx, z, dz] of legs) {
    const front = z > 0;
    const x0 = sx * 0.22;
    const x1 = sx * 0.27;
    add(body, paint(loft([v3(x0, 0.36, z), v3(sx * 0.255, 0.2, z + dz), v3(x1, 0.07, z + dz * 2), v3(x1, 0.02, z + dz * 2)], legProf, { segs: 12, radial: 12 }), (p) => SKIN.clone().lerp(SKIN_D, sstep(0.14 - p.y, 0, 0.12) * 0.6)), M.skin).userData.inkGroup = BODY;
    // Paw: a flattened circle with the claws reaching out from the front
    const fz = z + dz * 2 + 0.03;
    add(body, paint(new THREE.SphereGeometry(1, 14, 8), () => SKIN_D.clone()), M.skin, [x1, 0.038, fz], [0, 0, 0], [0.078, 0.036, 0.095]).userData.inkGroup = BODY;
    const n = front ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * (front ? 0.32 : 0.36);
      const cg = group(body, [x1 + Math.sin(a) * 0.058, 0.04, fz + Math.cos(a) * 0.072], [front ? -0.2 : -0.15, a, 0]);
      cg.rotation.order = 'YXZ';
      add(cg, front ? bigClaw : smallClaw, M.claw);
    }
  }

  // ── Head: neck, skull, long pointed muzzle and both cheeks as one distance-field block, hung on the pivot at the base of the neck (the seam is hidden under the front shield) ──
  const HP = v3(0, 0.42, 0.4);
  const HEAD_K = 1.12;
  const head = group(body, [HP.x, HP.y, HP.z]);
  head.scale.setScalar(HEAD_K);
  const hb = new Blob();
  const SN_TILT = 0.2;
  const snC = v3(0, 0.405, 0.81);
  const snQ = new THREE.Quaternion().setFromAxisAngle(X, SN_TILT);
  hb.add(v3(0, 0.41, 0.42), v3(0.15, 0.14, 0.17), undefined, 0.1);
  hb.add(v3(0, 0.45, 0.62), v3(0.14, 0.13, 0.145), undefined, 0.1);
  hb.add(snC, v3(0.06, 0.056, 0.2), snQ, 0.08);
  for (const sx of [-1, 1]) hb.add(v3(sx * 0.065, 0.415, 0.69), v3(0.075, 0.068, 0.085), undefined, 0.07);
  const snAxis = v3(0, 0, 1).applyQuaternion(snQ);
  const snTip = snC.clone().addScaledVector(snAxis, 0.2);
  const HO = v3(0, 0.46, 0.64);
  const sdir = (lon: number, lat: number) => v3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
  const ER = 0.024;
  const eyeAt = [-1, 1].map((sx) => {
    const { p, n } = hb.hit(HO, sdir(sx * 0.62, 0.14));
    return { sx, p, n, c: p.clone().addScaledVector(n, -ER * 0.5) };
  });
  const toHead = (p: THREE.Vector3) => p.clone().sub(HP);
  {
    const geo = blobGeo(hb, v3(0, 0.44, 0.6), 14, v3(0, 0.1, 1), 0.3, (p, n) => {
      let c = SKIN.clone().lerp(BELLY, sstep(-n.y, 0.35, 0.75) * 0.8);
      // Muzzle tip and nose turn pink
      c = c.lerp(PINK, sstep(p.z, 0.9, 0.98) * 0.55);
      return c;
    });
    geo.translate(-HP.x, -HP.y, -HP.z);
    add(head, geo, M.skin).userData.inkGroup = HEAD;
  }

  // The small shield on top of the head: from above the brows to the back of the head, narrow in front and wide behind, in the same material as the shell
  {
    const geo = plateGeo(
      (su, sf) => {
        const th = lerp(0.72, 1.95, (su + 1) / 2);
        const w = lerp(0.3, 0.5, (su + 1) / 2);
        const d = v3(Math.sin(sf * w), Math.cos(sf * w) * Math.sin(th), Math.cos(sf * w) * Math.cos(th));
        const { p, n } = hb.hit(HO, d);
        return { p: toHead(p), n };
      },
      0.026,
      8,
      12,
      (su) => SLATE.clone().lerp(SLATE_L, sstep(Math.abs(su), 0.5, 0.9)),
      0.25,
    );
    add(head, geo, M.shell).userData.inkGroup = HEAD + 1;
  }

  // ── Ears: large upright ears, cupped in front, pink on the inside, spread outward a little ──
  const ears: { g: THREE.Group; sx: number }[] = [];
  {
    const g0 = new THREE.SphereGeometry(1, 14, 14);
    const pa = g0.attributes.position as THREE.BufferAttribute;
    const cl: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      let x = pa.getX(i);
      let y = pa.getY(i);
      let z = pa.getZ(i);
      const inner = z > 0 ? sstep(z, 0.35, 0.75) : 0;
      if (z > 0) z *= -0.45;
      // Pointed at the top end, round at the bottom end
      x *= 1 - 0.42 * sstep(y, 0.0, 1.0);
      y = y > 0 ? y * 1.12 : y;
      pa.setXYZ(i, x, y + 1, z);
      const c = SKIN.clone().lerp(PINK, inner);
      cl.push(c.r, c.g, c.b);
    }
    g0.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g0.deleteAttribute('uv');
    g0.deleteAttribute('normal');
    const eg = mergeVertices(g0, 1e-5);
    eg.scale(0.062, 0.14, 0.038);
    eg.computeVertexNormals();
    for (const sx of [-1, 1]) {
      const { p, n } = hb.hit(HO, sdir(sx * 1.5, 0.9));
      const base = toHead(p).addScaledVector(n, -0.012);
      const eo = group(head, [base.x, base.y, base.z]);
      orient(eo, v3(sx * 0.6, 1, -0.1), v3(sx * 0.35, 0.1, 1));
      const piv = group(eo);
      add(piv, eg, M.skin).userData.inkGroup = HEAD + 2;
      ears.push({ g: piv, sx });
    }
  }

  // ── Eyes: an armadillo's small black eyes (diameter about 15% of the head width), half sunk in the skull, with only one small highlight; the eyelids move only when blinking and otherwise retreat to the top and bottom edges of the eyeball ──
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
    const d = n.clone().lerp(sdir(sx * 0.5, 0.14), 0.5).normalize();
    const r = new THREE.Vector3().crossVectors(UP, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    add(eg, eyeball, M.eye);
    const gaze = group(eg, [0, 0, 0], [-0.08, -sx * 0.26, 0]);
    gazes.push({ g: gaze, sx });
    for (const [x, y, rr] of [[ER * 0.34, ER * 0.36, ER * 0.26]] as [number, number, number][]) {
      const hl = add(gaze, new THREE.SphereGeometry(rr, 8, 6), M.hi, [x, y, ER * 0.96], [0, 0, 0], [1, 1, 0.5]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(gaze, [0, 0, ER]));
    const slant = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), sx * 0.1);
    const lidG = group(eg);
    lidG.quaternion.copy(slant);
    const upper = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.skinFlat).userData.inkGroup = HEAD;
    const lower = group(head, [hc.x, hc.y, hc.z]);
    lower.quaternion.copy(eg.quaternion).multiply(slant).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.skinFlat).userData.inkGroup = HEAD;
    lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02 });
  }

  // ── Nose: a dark rose-colored nose at the muzzle tip; an armadillo's mouth is a small slit under the muzzle, so no mouth line is drawn and only the mouth anchor remains ──
  const tipHit = hb.hit(snC, snAxis);
  const tipH = toHead(tipHit.p);
  const noseG = group(head, [tipH.x, tipH.y, tipH.z]);
  orient(noseG, UP.clone().addScaledVector(tipHit.n, -0.2), tipHit.n);
  add(noseG, new THREE.SphereGeometry(1, 14, 10), M.nose, [0, 0.004, -0.004], [0, 0, 0], [0.032, 0.026, 0.024]);
  const lip = (t: number, a: number, sx: number) => {
    const o = snC.clone().addScaledVector(snAxis, lerp(-0.12, 0.2, t));
    const down = v3(0, -1, 0).applyQuaternion(snQ);
    const d = X.clone().multiplyScalar(sx * Math.cos(a)).addScaledVector(down, Math.sin(a));
    const { p, n } = hb.hit(o, d);
    return toHead(p.addScaledVector(n, 0.002));
  };

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: breathing, ears twitching in turn, nose sniffing, head slowly looking around, the lightning mark flickering, the tail swaying lightly ──
  const act = { glow: 0, bash: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 1.8);
    body.scale.set(1 + br * 0.008, 1 + br * 0.012, 1 + br * 0.006);
    shellG.position.y = br * 0.004;
    head.rotation.set(-0.1 + Math.sin(t * 0.55) * 0.04 - act.bash * 0.18 + act.glow * 0.12, Math.sin(t * 0.37) * 0.16, Math.sin(t * 0.5) * 0.03);
    head.position.set(HP.x, HP.y - act.glow * 0.03, HP.z + act.bash * 0.12 - act.glow * 0.07);
    for (const { g, sx } of ears) {
      const ph = (t + (sx > 0 ? 0 : 1.7)) % 3.4;
      const flick = ph < 0.3 ? Math.sin((ph / 0.3) * PI) : 0;
      g.rotation.set(-0.06 + flick * 0.25, 0, sx * (0.04 + flick * 0.12));
    }
    const nt = t % 2.6;
    const sn = nt < 0.5 ? Math.abs(Math.sin((nt / 0.5) * PI * 2)) : 0;
    noseG.scale.set(1 + sn * 0.1, 1 + sn * 0.06, 1);
    tailG.rotation.set(Math.sin(t * 0.8) * 0.03, Math.sin(t * 0.6) * 0.12, 0);
    const bt = t % 3.8;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
    const close = Math.max(bk(bt - 3.3), Math.floor(t / 3.8) % 3 === 1 ? bk(bt - 3.0) : 0);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    for (const g of gazes) g.g.rotation.y = -g.sx * 0.26 + Math.sin(t * 0.37) * 0.06;
    const gl = 0.5 + Math.sin(t * 1.3) * 0.08 + act.glow * 0.7;
    if (Math.abs(gl - lastGlow) > 0.004) {
      lastGlow = gl;
      M.bolt.emissiveIntensity = gl;
    }
  };
  update(0);

  const faceA = group(head, [0, 0.46 - HP.y, 0.7 - HP.z]);
  const mouthA = group(head, [...lip(0.9, PI / 2, 0).toArray()] as [number, number, number]);
  const shellA = group(shellG, [0, E.c.y + E.b + 0.04, E.c.z]);
  const tailA = group(tailG, [0, -0.17, -0.5]);
  const rig = { head: faceA, eyes: eyeAnchors, anchors: { mouth: mouthA, shell: shellA, tail: tailA } };
  mergeStatic(root, {
    owners: [body, shellG, head, noseG, tailG, ...ears.map((e) => e.g), ...gazes.map((g) => g.g), ...lids.map((l) => l.g)],
    keep: [...glints],
    twins: [[M.skinFlat, M.skin]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.42, 0.04), radius: 1.12 };
}
