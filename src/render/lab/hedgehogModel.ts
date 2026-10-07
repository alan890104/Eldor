// Lightning Rod King (model lab version): a colony of hedgehogs lives among the stone pillars of the Lightning Rod Plain, and in thunderstorms they all raise their spines and climb to the tops of the pillars; the dwarves say the hedgehogs taught them to put up lightning rods. Thunder, N, lightning absorption / combo.
// Identifying features: 1. A coat of raised spines: dark brown roots, cream midsections and golden tips, spread from the forehead all the way to the rump; 2. A fan-shaped crest of long spines on top of the forehead, with the longest one in the middle worn to a brass color, the "lightning-rod spine",
// whose sharpest short stretch is light (the only emissive on the whole body, where lightning is received); 3. A pointed light-brown face, a shiny black nose and small eyes, and a ring of dark fur around the eyes.
// Body shape: a four-legged hedgehog with the chest held high and the head raised, short legs hidden under the spine skirt. Back: the spines spread all the way to the rump, and from behind the spine crest is a fan standing upright.
// Personality: a proud little king who must stand at the highest spot the louder the thunder gets. The face follows a real hedgehog: small black eyes sunk in their sockets and a pointed black-nosed muzzle, with no human mouth line or brows. Personality comes from posture: chest out, head up, spine crest upright.
// Gaze order: the spine crest and lightning-rod spine first, the face second, and the coat of gold-tipped spines as support.
// Action table: idle is the spines rising and falling with the breathing, the nose sniffing, the spine crest swaying slightly and the tip of the lightning-rod spine slowly flickering; charge-up stands all the spines straight up, fans out the crest and brightens the light point (act.charge);
// strike curls into a spine ball and rolls forward to ram; hit makes the spines burst out with the head not lowering; victory shakes the spine crest. Anchors: head, eyes, mouth, rod (tip of the lightning-rod spine), crest (root of the spine crest).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
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


/** One spine: a six-sided lathe cone with the root buried in the skin; vertex colors in three bands: dark brown root, cream midsection, golden tip */
function spineGeo(r: number, h: number, root: THREE.Color, mid: THREE.Color, tip: THREE.Color): THREE.BufferGeometry {
  const g = lathe([[r, -0.02], [r, 0], [r * 0.82, h * 0.4], [r * 0.56, h * 0.62], [r * 0.3, h * 0.8], [0.0005, h]], 6);
  return paint(g, (p) => {
    const t = p.y / h;
    return root.clone().lerp(mid, sstep(t, 0.2, 0.42)).lerp(tip, sstep(t, 0.6, 0.8));
  });
}

// ───────────────────────── Shape ─────────────────────────

export function buildHedgehogLab(): LabModel {
  const RIMC = 0xfff0b0;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const FUR = col(0xa9845f);
  const FUR_L = col(0xecd6b4);
  const MASK = col(0x76563f);
  const COAT = col(0x4a3830);
  const SP_ROOT = col(0x3e2e28);
  const SP_MID = col(0xeadfc6);
  const SP_TIP = col(0xf0bf3c);
  const PAW = col(0x8e6652);

  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    furFlat: labToon(0xa9845f, { rim: 0.55, rimColor: RIMC }),
    spine: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.45, rimColor: RIMC })),
    rod: labToon(0xd9a441, { ramp: 'metal', spec: 0.8, specTh: 0.97, rim: 0.4, rimColor: 0xffe8a0 }),
    spark: labToon(0xfff4a8, { ramp: 'gem', emissive: 0xffd84a, emissiveAmt: 0.7, rim: 0 }),
    eye: labToon(0x150d0b, { ramp: 'gem', rim: 0 }),
    nose: labToon(0x201616, { ramp: 'gem', spec: 0.5, specTh: 0.99, rim: 0.2 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'hedgehog-lab';
  const { add, group } = partKit();

  const BODY = 9951;
  const COATG = 9960;
  const CREST = 9970;

  const all = group(root, [0, 0, -0.07]);
  const body = group(all);

  // ── Body: a pear-shaped body with the chest held high, the head raised and the pointed muzzle forward ──
  const bb = new Blob();
  bb.add(v3(0, 0.34, -0.06), v3(0.3, 0.26, 0.34), undefined, 0.12);
  bb.add(v3(0, 0.25, -0.02), v3(0.26, 0.17, 0.3), undefined, 0.12);
  bb.add(v3(0, 0.4, 0.16), v3(0.2, 0.22, 0.18), undefined, 0.12);
  bb.add(v3(0, 0.5, 0.3), v3(0.155, 0.145, 0.155), undefined, 0.1);
  const SN_Q = new THREE.Quaternion().setFromAxisAngle(X, 0.1);
  bb.add(v3(0, 0.455, 0.49), v3(0.055, 0.05, 0.155), SN_Q, 0.07);
  for (const sx of [-1, 1]) bb.add(v3(sx * 0.075, 0.45, 0.37), v3(0.075, 0.068, 0.08), undefined, 0.07);
  const HO = v3(0, 0.5, 0.32);
  const sdir = (lon: number, lat: number) => v3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
  const ER = 0.022;
  const eyeAt = [-1, 1].map((sx) => {
    const { p, n } = bb.hit(HO, sdir(sx * 0.62, 0.16));
    return { sx, p, n, c: p.clone().addScaledVector(n, -ER * 0.5) };
  });
  add(body, blobGeo(bb, v3(0, 0.36, 0.02), 16, v3(0, 0.2, 1), 0.34, (p, n) => {
    const c = FUR.clone().lerp(FUR_L, Math.max(sstep(-n.y, 0.3, 0.72), sstep(p.z, 0.54, 0.62) * 0.45));
    let m = 0;
    for (const e of eyeAt) m = Math.max(m, 1 - sstep(p.distanceTo(e.c), 0.035, 0.07));
    return c.lerp(MASK, m * 0.5);
  }), M.fur).userData.inkGroup = BODY;

  // ── Spine hide: a thick (dark brown) hide spread from the forehead to the rump, with the edge rounded into a lip; narrow in front and wide behind ──
  const C = v3(0, 0.36, -0.03);
  const coatDir = (su: number, sf: number) => {
    const u = (su + 1) / 2;
    const fm = lerp(1.45, 1.85, sstep(u, 0.0, 0.25)) * lerp(1, 0.84, sstep(u, 0.78, 1));
    const f = sf * fm;
    // The front edge is pulled forward at the sides, so the spined hide wraps from behind the ears to behind the cheeks and the face is framed by a ring of spines
    const th = lerp(0.46 - 0.22 * sstep(Math.abs(f), 0.35, 0.95), 3.6, u);
    return v3(Math.sin(f), Math.cos(f) * Math.sin(th), Math.cos(f) * Math.cos(th));
  };
  const COAT_TH = 0.035;
  const coatBase = (su: number, sf: number) => bb.hit(C, coatDir(su, sf));
  add(body, plateGeo(coatBase, COAT_TH, 14, 22, () => COAT.clone(), 0.1), M.fur).userData.inkGroup = COATG;

  // ── Spines: arranged in staggered rows along the spined hide, standing up and facing outward, sweeping slightly back; those on the forehead and the edge of the spine skirt are a little shorter ──
  const C0 = v3(0, 0.36, -0.03);
  const coatG = group(body, [C0.x, C0.y, C0.z]);
  const rand = rng(7);
  const spineCache = new Map<number, THREE.BufferGeometry>();
  const spine = (h: number) => {
    const k = Math.round(h * 100);
    if (!spineCache.has(k)) spineCache.set(k, spineGeo(0.024, k / 100, SP_ROOT, SP_MID, SP_TIP));
    return spineCache.get(k)!;
  };
  const ROWS = 13;
  for (let i = 0; i < ROWS; i++) {
    const su = lerp(-0.86, 0.92, i / (ROWS - 1));
    const u = (su + 1) / 2;
    const cols = Math.round(lerp(6, 13, sstep(u, 0, 0.3)));
    for (let j = 0; j < cols; j++) {
      const sf = lerp(-0.86, 0.86, cols === 1 ? 0.5 : (j + (i % 2 ? 0.5 : 0)) / (cols - (i % 2 ? 0 : 1)));
      if (Math.abs(sf) > 0.9) continue;
      // Leave the spine crest's position empty
      if (u < 0.17 && Math.abs(sf) < 0.34) continue;
      const suj = su + (rand() - 0.5) * 0.06;
      const sfj = sf + (rand() - 0.5) * 0.06;
      const { p, n } = coatBase(suj, sfj);
      const base = p.addScaledVector(n, plateBump(suj, sfj, 0.1) * COAT_TH - 0.012);
      const radial = base.clone().sub(C).normalize();
      const dir = radial.multiplyScalar(0.6).add(n.clone().multiplyScalar(0.4)).add(v3(0, 0.12, -0.42)).normalize();
      const edge = Math.min(1 - Math.abs(sfj), 1 - Math.abs(suj));
      const h = (0.12 + 0.07 * sstep(edge, 0.05, 0.3) + rand() * 0.03) * lerp(0.7, 1, sstep(u, 0.05, 0.3));
      const sg = group(coatG, [base.x - C0.x, base.y - C0.y, base.z - C0.z]);
      sg.quaternion.setFromUnitVectors(UP, dir);
      add(sg, spine(h), M.spine).userData.inkGroup = COATG;
    }
  }

  // ── Spine crest: a fan of long spines on top of the forehead, one brass lightning-rod spine in the middle, and a light point at its tip ──
  const crestHit = coatBase(-0.76, 0);
  const crestBase = crestHit.p.addScaledVector(crestHit.n, COAT_TH * 0.6);
  const crest = group(body, [crestBase.x, crestBase.y, crestBase.z]);
  const crestUp = v3(0, 1, -0.12).normalize();
  crest.quaternion.setFromUnitVectors(UP, crestUp);
  const crestFan: [number, number][] = [[-0.78, 0.2], [-0.4, 0.27], [0.4, 0.27], [0.78, 0.2]];
  for (const [a, h] of crestFan) {
    const g = group(crest, [Math.sin(a) * 0.06, -0.01, 0], [0, 0, -a * 0.8]);
    add(g, spineGeo(0.03, h, SP_ROOT, SP_MID, SP_TIP), M.spine).userData.inkGroup = CREST;
  }
  // Two short ones in the back row, so the fan has thickness from the side too
  for (const a of [-0.22, 0.22]) {
    const g = group(crest, [Math.sin(a) * 0.05, -0.01, -0.04], [-0.32, 0, -a]);
    add(g, spineGeo(0.028, 0.22, SP_ROOT, SP_MID, SP_TIP), M.spine).userData.inkGroup = CREST;
  }
  // Lightning-rod spine: the same shape as the other spines, but thicker and longer, the whole spine worn to a brass color, with only the sharpest short stretch being light
  const ROD_H = 0.36;
  const rodG = group(crest, [0, -0.01, 0.004]);
  add(rodG, lathe([[0.034, -0.02], [0.034, 0], [0.029, ROD_H * 0.3], [0.019, ROD_H * 0.62], [0.0105, ROD_H * 0.86], [0.0095, ROD_H * 0.87]], 10), M.rod);
  const spark = add(rodG, lathe([[0.0105, ROD_H * 0.865], [0.0005, ROD_H + 0.02]], 10), M.spark);
  const rodTip = group(rodG, [0, ROD_H + 0.02, 0]);

  // ── Ears: small round ears showing at the two sides of the spined hide's front edge ──
  {
    const g0 = new THREE.SphereGeometry(1, 12, 10);
    const pa = g0.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const z = pa.getZ(i);
      pa.setXYZ(i, pa.getX(i), pa.getY(i) + 1, z > 0 ? z * -0.4 : z);
    }
    g0.deleteAttribute('uv');
    g0.deleteAttribute('normal');
    const eg = mergeVertices(g0, 1e-5);
    eg.scale(0.042, 0.04, 0.02);
    eg.computeVertexNormals();
    paint(eg, (p, n) => FUR.clone().lerp(MASK, n.z > 0.3 ? 0.6 : 0));
    for (const sx of [-1, 1]) {
      const { p, n } = bb.hit(HO, sdir(sx * 0.98, 0.46));
      const b = p.addScaledVector(n, -0.01);
      const eo = group(body, [b.x, b.y, b.z]);
      orient(eo, v3(sx * 0.7, 1, 0.1), v3(sx * 0.3, 0, 1));
      add(eo, eg, M.fur).userData.inkGroup = BODY + 1;
    }
  }

  // ── Eyes: a hedgehog's small black eyes (diameter about 15% of the head width), sunk in their sockets, with only one small highlight; both eyes face forward together ──
  const UP_OPEN = 1.0;
  const LO_OPEN = 0.9;
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = lidLite(ER + 0.004, ER + 0.009, PI / 2, true);
  const lidLow = lidLite(ER + 0.003, ER + 0.008, PI / 2, false);
  const eyeball = new THREE.SphereGeometry(ER, 14, 7, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const { sx, n, c } of eyeAt) {
    const eg = group(body, [c.x, c.y, c.z]);
    const d = n.clone().lerp(sdir(sx * 0.5, 0.16), 0.5).normalize();
    const r = new THREE.Vector3().crossVectors(UP, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    add(eg, eyeball, M.eye);
    const gaze = group(eg, [0, 0, 0], [-0.06, -sx * 0.28, 0]);
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
    add(upper, lidUp, M.furFlat).userData.inkGroup = BODY;
    const lower = group(body, [c.x, c.y, c.z]);
    lower.quaternion.copy(eg.quaternion).multiply(slant).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.furFlat).userData.inkGroup = BODY;
    lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02 });
  }

  // ── Nose: a shiny black nose at the front of the pointed muzzle ──
  const snAxis = v3(0, 0, 1).applyQuaternion(SN_Q);
  const tip = bb.hit(v3(0, 0.455, 0.49), snAxis);
  const noseG = group(body, [tip.p.x, tip.p.y, tip.p.z]);
  orient(noseG, UP.clone().addScaledVector(tip.n, -0.2), tip.n);
  add(noseG, new THREE.SphereGeometry(1, 12, 10), M.nose, [0, 0.002, -0.006], [0, 0, 0], [0.03, 0.025, 0.024]);

  // ── Legs: short legs hidden under the spine skirt, with only the small light-brown paws showing ──
  const legProf = curveTable([[0, 0, 0], [0.15, 0.058, 0.058], [0.7, 0.05, 0.05], [1, 0, 0]]);
  for (const [sx, z] of [[-1, 0.17], [1, 0.17], [-1, -0.2], [1, -0.2]] as [number, number][]) {
    const x = sx * (z > 0 ? 0.13 : 0.16);
    add(body, paint(loft([v3(x * 0.8, 0.24, z), v3(x, 0.11, z + 0.01), v3(x, 0.03, z + 0.02)], legProf, { segs: 8, radial: 10 }), () => FUR.clone()), M.fur).userData.inkGroup = BODY;
    add(body, paint(new THREE.SphereGeometry(1, 12, 8), () => PAW.clone()), M.fur, [x, 0.024, z + 0.035], [0, 0, 0], [0.046, 0.024, 0.056]).userData.inkGroup = BODY;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: spines rising and falling with the breathing, nose sniffing, spine crest swaying slightly, the lightning-rod spine tip flickering, blinking ──
  const act = { charge: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 2.0);
    body.scale.set(1 + br * 0.01, 1 + br * 0.012, 1 + br * 0.008);
    coatG.scale.setScalar(1 + br * 0.006 + act.charge * 0.06);
    crest.rotation.z = Math.sin(t * 0.8) * 0.05;
    crest.scale.setScalar(1 + act.charge * 0.12);
    const nt = t % 2.4;
    const sn = nt < 0.5 ? Math.abs(Math.sin((nt / 0.5) * PI * 2)) : 0;
    noseG.scale.set(1 + sn * 0.12, 1 + sn * 0.08, 1);
    const bt = t % 3.4;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
    const close = bk(bt - 2.9);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    const gl = 0.6 + Math.max(0, Math.sin(t * 1.6)) * 0.25 + act.charge * 0.6;
    if (Math.abs(gl - lastGlow) > 0.004) {
      lastGlow = gl;
      M.spark.emissiveIntensity = gl;
    }
  };
  update(0);

  const faceA = group(body, [0, 0.48, 0.46]);
  const mouthA = group(body, [...bb.hit(v3(0, 0.44, 0.48), v3(0, -0.5, 1)).p.toArray()] as [number, number, number]);
  const rig = { head: faceA, eyes: eyeAnchors, anchors: { mouth: mouthA, rod: rodTip, crest } };
  mergeStatic(root, {
    owners: [body, coatG, crest, noseG, ...lids.map((l) => l.g)],
    keep: [...glints, spark],
    twins: [[M.furFlat, M.fur]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.46, 0), radius: 0.78 };
}
