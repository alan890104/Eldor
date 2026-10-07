// Crystal Delver (model lab version): a dwarf miner's best helper; the crystal on its nose tip glows when it touches a vein of ore. Earth, N, burrowing / ambush.
// Identifying features: 1. A cyan hexagonal crystal column growing from the nose tip (the only emissive on the whole body); 2. Two pink shovel-shaped big claws wider than the head, with five long ivory-colored claws;
// 3. A brass miner's helmet given by the dwarves (rivets, a brim, a nameplate on the front), worn pushed back. Back: a canvas ore sack slung across the back, with three crystal columns poking out of its mouth.
// Body shape: a plump mole sitting up, with the head and body joined into one block with no neck, velvety deep gray-purple fur, and a pale gray-purple face and muzzle.
// Personality: a workaholic whose nose moves first, who cannot stop once it smells ore and is happy with whatever it digs up; personality comes from the twitching nose and the big claws that scoop the soil, and the face follows a real mole: shiny black bead eyes and a mouth hidden under the muzzle.
// Gaze order: the face and the crystal on the nose tip first, the shovel claws on the chest second, and the helmet and the ore sack on the back as support.
// Action table: idle is the nose twitching as it sniffs, both claws gently scooping soil and the body breathing; charge-up draws the claws to the chest and brightens the crystal (act.glow); strike has both claws dig forward (act.dig);
// hit tucks the head so the helmet takes the blow, with the eyes not closing; victory claps both claws together with the nose pointing at the sky. Anchors: head, eyes, mouth, crystal (crystal tip), claws (between the two claws), sack (ore sack).

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

// ───────────────────────── Distance-field body (same as Grove Hoarder) ─────────────────────────

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

function ellipsePts(rx: number, ry: number, dy = 0, n = 16): [number, number][] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * PI * 2) * rx, Math.sin((i / n) * PI * 2) * ry + dy] as [number, number]);
}

/** A planar shape on a sphere (iris, pupil) */
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

/** Hexagonal crystal column: the facets share no vertices, one normal per face; slightly narrowed at the bottom and pointed at the top */
function crystalGeo(r: number, h: number, tip: number): THREE.BufferGeometry {
  const g = lathe([[0.0005, -0.01], [r * 0.82, -0.01], [r, h * 0.12], [r * 0.94, h], [0.0005, h + tip]], 6).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildDigmoleLab(): LabModel {
  const RIMC = 0xd8c8ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const FUR = col(0x5a5068);
  const FUR_D = col(0x453d52);
  const FACE = col(0xa497ae);
  const BELLY = col(0x7f7390);
  const PINK = col(0xf2a6ae);
  const PINK_D = col(0xd88490);
  const CLAW = col(0xf1e6cc);

  const fur = vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC }));
  const M = {
    fur,
    face: labToon(0xa497ae, { rim: 0.6, rimColor: RIMC }),
    eye: labToon(0x1e1628, { ramp: 'gem', rim: 0 }),
    iris: labToon(0x33263f, { ramp: 'gem', rim: 0 }),
    pupil: labToon(0x0c0810, { ramp: 'gem', rim: 0 }),
    gem0: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    nose: labToon(0xf29aa6, { spec: 0.6, specTh: 0.99, rim: 0.3, rimColor: RIMC }),
    claw: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC, spec: 0.3, specTh: 0.99 })),
    brass: vc(labToon(0xffffff, { ramp: 'metal', spec: 0.8, specTh: 0.97, rim: 0.35, rimColor: 0xffe2a8 })),
    plate: labToon(0x6a4a24, { ramp: 'metal', spec: 0.5, specTh: 0.97, rim: 0.2 }),
    crystal: labToon(0x8ff4ff, { ramp: 'gem', emissive: 0x38d8f0, emissiveAmt: 0.55, rim: 0.3, rimColor: 0xd8ffff }),
    gem: vc(labToon(0xffffff, { ramp: 'gem', rim: 0.3, rimColor: 0xffffff })),
    canvas: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xffe8c8 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'digmole-lab';
  const { add, group } = partKit();

  const BODY = 9801;
  const HELM = 9802;
  const SACK = 9803;

  const body = group(root);

  // ── Body and head: rump, chest, head, muzzle and both cheeks as one distance-field block (a mole has no neck) ──
  const blob = new Blob();
  blob.add(v3(0, 0.36, -0.02), v3(0.36, 0.35, 0.32), undefined, 0.1);
  blob.add(v3(0, 0.64, 0.02), v3(0.3, 0.27, 0.27), undefined, 0.12);
  blob.add(v3(0, 0.88, 0.07), v3(0.25, 0.22, 0.24), undefined, 0.12);
  blob.add(v3(0, 0.82, 0.31), v3(0.095, 0.08, 0.2), new THREE.Quaternion().setFromAxisAngle(X, -0.2), 0.08);
  for (const sx of [-1, 1]) blob.add(v3(sx * 0.12, 0.79, 0.2), v3(0.11, 0.09, 0.1), undefined, 0.07);
  const HO = v3(0, 0.86, 0.1);
  const sdir = (lon: number, lat: number) => v3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
  const ER = 0.03;
  const eyeAt = [-1, 1].map((sx) => {
    const { p, n } = blob.hit(HO, sdir(sx * 0.46, 0.2));
    return { sx, p, n, c: p.clone().addScaledVector(n, -ER * 0.55) };
  });
  {
    const geo = blobGeo(blob, v3(0, 0.62, 0.02), 20, v3(0, 0.35, 1), 0.28, (p, n) => {
      // Dark on the back and a little lighter on the belly; the face and muzzle are pale gray-purple, turning pink at the muzzle tip
      let c = FUR.clone().lerp(FUR_D, sstep(-n.z, 0.2, 0.8) * sstep(p.y, 0.3, 0.7));
      c.lerp(BELLY, sstep(n.z, 0.35, 0.6) * (1 - sstep(Math.abs(p.x), 0.16, 0.22)) * (1 - sstep(p.y, 0.6, 0.7)));
      const face = sstep(p.z, 0.16, 0.26) * sstep(p.y, 0.66, 0.72) * (1 - sstep(p.y, 0.98, 1.04));
      c = c.lerp(FACE, face);
      return c.lerp(PINK_D, sstep(p.z, 0.42, 0.48));
    });
    add(body, geo, M.fur).userData.inkGroup = BODY;
  }

  // ── Eyes: a mole's small bead eyes, shiny black and half buried in the fur, with one highlight; both eyes look the same way, forward ──
  const UP_OPEN = 0.95;
  const LO_OPEN = 0.72;
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const gazes: { g: THREE.Group; sx: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = lidLite(ER + 0.004, ER + 0.011, PI / 2, true);
  const lidLow = lidLite(ER + 0.003, ER + 0.009, PI / 2, false);
  const eyeball = new THREE.SphereGeometry(ER, 20, 10, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const { sx, n, c } of eyeAt) {
    const eg = group(body, [c.x, c.y, c.z]);
    const d = n.clone().lerp(sdir(sx * 0.46, 0.2), 0.5).normalize();
    const r = new THREE.Vector3().crossVectors(UP, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    add(eg, eyeball, M.eye);
    const gaze = group(eg, [0, 0, 0], [-0.1, -sx * 0.32, 0]);
    gazes.push({ g: gaze, sx });
    add(gaze, lightDecal(ellipsePts(0.62, 0.66, 0, 16), ER + 0.0016), M.iris);
    add(gaze, lightDecal(ellipsePts(0.36, 0.4, 0.03, 14), ER + 0.0032), M.pupil);
    for (const [x, y, rr] of [[0.009, 0.01, 0.009]] as [number, number, number][]) {
      const hl = add(gaze, new THREE.SphereGeometry(rr, 8, 6), M.hi, [x, y, ER * 0.96], [0, 0, 0], [1, 1, 0.5]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(gaze, [0, 0, ER]));
    const slant = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), sx * 0.12);
    const lidG = group(eg);
    lidG.quaternion.copy(slant);
    const upper = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.face).userData.inkGroup = BODY;
    const lower = group(body, [c.x, c.y, c.z]);
    lower.quaternion.copy(eg.quaternion).multiply(slant).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.face).userData.inkGroup = BODY;
    lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02 });
  }

  // ── Nose and crystal: a pink round nose at the muzzle tip, a cyan hexagonal crystal column growing from the nose tip and slanting forward and up, with a small one beside it ──
  const tipHit = blob.hit(v3(0, 0.82, 0.2), v3(0, 0.12, 1));
  const noseG = group(body, [tipHit.p.x, tipHit.p.y, tipHit.p.z]);
  orient(noseG, UP.clone().addScaledVector(tipHit.n, 0.3), tipHit.n);
  add(noseG, new THREE.SphereGeometry(1, 14, 10), M.nose, [0, 0.004, 0.006], [0, 0, 0], [0.058, 0.044, 0.042]);
  const crysG = group(noseG, [0, 0.03, 0.004], [0.55, 0, 0]);
  const crystal = add(crysG, crystalGeo(0.032, 0.1, 0.055), M.crystal);
  add(crysG, crystalGeo(0.014, 0.04, 0.025), M.crystal, [0.026, -0.006, -0.01], [0, 0, -0.55]);
  add(crysG, crystalGeo(0.012, 0.03, 0.02), M.crystal, [-0.024, -0.008, -0.004], [0.2, 0, 0.6]);

  // The mouth is hidden under the muzzle (a mole's mouth cannot be seen from the front), so only the anchor remains
  const surf = (x: number, y: number, out = 0.004) => {
    const { p, n } = blob.hit(v3(0, 0.8, 0.1), v3(x, y, 1));
    return p.addScaledVector(n, out);
  };

  // ── Front claws: short arms reaching from both sides of the chest, with big pink shovel palms facing forward and five long ivory claws fanning upward ──
  const hands: { g: THREE.Group; sx: number }[] = [];
  const armProf = curveTable([[0, 0.02, 0.02], [0.15, 0.07, 0.07], [0.6, 0.068, 0.064], [1, 0.05, 0.05]]);
  const palmGeo = paint(new THREE.SphereGeometry(1, 16, 12), (p) => (p.z > 0.1 ? PINK.clone() : p.z > -0.2 ? PINK.clone().lerp(FUR, 0.4) : FUR.clone()));
  const clawGeo = paint(loft([v3(0, 0, 0), v3(0, 0.05, 0.006), v3(0, 0.1, 0.022)], curveTable([[0, 0.016, 0.012], [0.5, 0.013, 0.01], [0.85, 0.007, 0.006], [1, 0, 0]]), { segs: 8, radial: 8 }), (p) => CLAW.clone().multiplyScalar(0.86 + 0.14 * sstep(p.y, 0, 0.08)));
  for (const sx of [-1, 1]) {
    add(body, paint(loft([v3(sx * 0.2, 0.62, 0.12), v3(sx * 0.3, 0.58, 0.22), v3(sx * 0.3, 0.56, 0.32)], armProf, { segs: 12, radial: 12 }), () => FUR.clone()), M.fur).userData.inkGroup = BODY;
    const hg = group(body, [sx * 0.3, 0.58, 0.36], [-0.25, sx * 0.35, sx * -0.25]);
    add(hg, palmGeo, M.fur, [0, 0, 0], [0, 0, 0], [0.145, 0.12, 0.045]).userData.inkGroup = BODY;
    // The five claws fan out along the upper half of the palm's edge
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.3;
      const cg = group(hg, [Math.sin(a) * 0.13, Math.cos(a) * 0.105, 0.01], [0.1, 0, -a]);
      cg.scale.setScalar(1.15);
      add(cg, clawGeo, M.claw);
    }
    hands.push({ g: hg, sx });
  }

  // ── Hind feet: sitting pose, two pink paws reaching forward from under the body, with three small claws ──
  for (const sx of [-1, 1]) {
    add(body, paint(new THREE.SphereGeometry(1, 14, 10), (p) => (p.y > 0.3 ? FUR.clone() : PINK.clone())), M.fur, [sx * 0.19, 0.05, 0.24], [0, sx * 0.25, 0], [0.09, 0.05, 0.13]).userData.inkGroup = BODY;
    for (let i = 0; i < 3; i++) {
      const a = sx * 0.25 + (i - 1) * 0.35;
      const cg = group(body, [sx * 0.19 + Math.sin(a) * 0.08, 0.035, 0.24 + Math.cos(a) * 0.11], [PI / 2 - 0.2, a, 0]);
      cg.rotation.order = 'YXZ';
      cg.scale.setScalar(0.55);
      add(cg, clawGeo, M.claw);
    }
  }
  // A short tail
  add(body, paint(loft([v3(0, 0.16, -0.3), v3(0, 0.14, -0.4), v3(0, 0.16, -0.46)], curveTable([[0, 0.04, 0.04], [0.7, 0.03, 0.03], [1, 0, 0]]), { segs: 8, radial: 8 }), () => PINK_D.clone()), M.fur).userData.inkGroup = BODY;

  // ── Miner's helmet: a brass dome, a brim, a ring of rivets and a nameplate on the front set with a small crystal; worn pushed back ──
  const helm = group(body, [0, 1.0, 0.03], [-0.28, 0, 0.06]);
  {
    const brassA = col(0xd8a848);
    const brassB = col(0xa87a2c);
    const rivetGeo = paint(new THREE.SphereGeometry(1, 8, 5, 0, PI * 2, 0, PI / 2), () => brassA.clone());
    const dome = paint(lathe([[0.2, -0.02], [0.215, 0.02], [0.2, 0.08], [0.16, 0.13], [0.1, 0.165], [0.001, 0.178]], 28), (p) => brassB.clone().lerp(brassA, sstep(p.y, 0.0, 0.12)));
    add(helm, dome, M.brass).userData.inkGroup = HELM;
    // Brim: a flattened ring with a rounded lip on the edge, wider at the front
    const bm = add(helm, paint(new THREE.TorusGeometry(0.245, 0.034, 8, 36), () => brassB.clone()), M.brass, [0, -0.02, 0.02], [PI / 2, 0, 0], [1, 1.08, 0.32]);
    bm.userData.inkGroup = HELM + 10;
    // The helmet's band and rivets
    add(helm, paint(new THREE.TorusGeometry(0.214, 0.013, 6, 32), () => col(0x8a6024)), M.brass, [0, 0.016, 0], [PI / 2, 0, 0], [1, 1, 1.4]).userData.inkGroup = HELM + 11;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * PI * 2 + PI / 10;
      const rv = add(helm, rivetGeo, M.brass, [Math.sin(a) * 0.226, 0.016, Math.cos(a) * 0.226], [0, 0, 0], [0.011, 0.007, 0.011]);
      rv.quaternion.setFromUnitVectors(UP, v3(Math.sin(a), 0, Math.cos(a)));
      rv.userData.inkGroup = HELM + 11;
    }
    // Nameplate on the front: the dwarves' workshop mark, with a small crystal in the middle
    const pg = group(helm, [0, 0.07, 0.185], [-0.62, 0, 0]);
    add(pg, rbox(0.1, 0.075, 0.018, 0.008, 2), M.plate).userData.inkGroup = HELM + 12;
    add(pg, paint(new THREE.OctahedronGeometry(0.022, 0), () => col(0x8ff4ff)), M.gem, [0, 0, 0.012], [0, 0, 0], [1, 1.2, 0.6]).userData.inkGroup = HELM + 13;
  }

  // ── Ore sack: a canvas bag slung across the back, with a strap running from the right shoulder to the left waist and three crystal columns poking out of its mouth ──
  const sack = group(body, [0.02, 0.6, -0.36], [0.35, 0.2, -0.15]);
  {
    const cA = col(0xc8a878);
    const cB = col(0x9c7c50);
    const bag = paint(lathe([[0.001, -0.17], [0.1, -0.16], [0.16, -0.1], [0.175, 0.0], [0.15, 0.09], [0.08, 0.14], [0.075, 0.16], [0.095, 0.2], [0.001, 0.19]], 18), (p) => cB.clone().lerp(cA, sstep(p.y, -0.15, 0.05)));
    add(sack, bag, M.canvas, [0, 0, 0], [0, 0, 0], [1, 1, 0.7]).userData.inkGroup = SACK;
    // The rope loop at the sack's mouth
    add(sack, paint(new THREE.TorusGeometry(0.08, 0.014, 6, 16), () => col(0x7a5a34)), M.canvas, [0, 0.148, 0], [PI / 2, 0, 0], [1, 0.72, 1]).userData.inkGroup = SACK + 1;
    const gems: [number, number, number, number, number, number][] = [
      [0.0, 0.18, 0.0, 0.1, 0.0, 0x9ff6ff],
      [0.045, 0.16, 0.01, -0.1, -0.5, 0xc6a0ff],
      [-0.045, 0.16, -0.01, 0.2, 0.55, 0xffd27a],
    ];
    for (const [x, y, z, rx, rz, c] of gems) {
      const g = group(sack, [x, y, z], [rx, 0, rz]);
      add(g, paint(crystalGeo(0.024, 0.08 + Math.abs(x) * 0.2, 0.04), () => col(c)), M.gem).userData.inkGroup = SACK + 2;
    }
  }
  // Strap: a slanted band wrapping once around the body surface (starting under the ore sack on the back and wrapping back to the back), with its wide direction along the slope's normal
  {
    const nrm = v3(0.75, 1, 0.12).normalize();
    const c0 = v3(0, 0.56, 0);
    const d0 = v3(0, 0, -1).addScaledVector(nrm, nrm.z).normalize();
    const b0 = new THREE.Vector3().crossVectors(nrm, d0).normalize();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 36; i++) {
      const th = (i / 36) * PI * 2 - 0.25;
      const d = d0.clone().multiplyScalar(Math.cos(th)).addScaledVector(b0, Math.sin(th));
      const { p, n } = blob.hit(c0, d);
      pts.push(p.addScaledVector(n, 0.012));
    }
    add(body, paint(loft(pts, () => [0.028, 0.008], { segs: 90, radial: 8, side: nrm }), () => col(0x6e4a2a)), M.canvas).userData.inkGroup = SACK + 3;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: nose twitching as it sniffs, both claws gently scooping soil, breathing, blinking ──
  const act = { dig: 0, glow: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 2.2);
    body.scale.set(1 + br * 0.007, 1 + br * 0.01, 1 + br * 0.007);
    body.rotation.z = Math.sin(t * 0.9) * 0.025;
    body.rotation.x = Math.sin(t * 0.7) * 0.015 + act.dig * 0.12;
    // Nose: three quick twitches every 2.1 seconds, and the crystal nods along
    const nt = t % 2.1;
    const tw = nt < 0.45 ? Math.abs(Math.sin((nt / 0.45) * PI * 3)) : 0;
    noseG.scale.set(1 + tw * 0.06, 1 + tw * 0.1, 1);
    crysG.rotation.x = 0.55 + tw * 0.08;
    for (const { g, sx } of hands) {
      const paddle = Math.sin(t * 1.8 + (sx > 0 ? 0 : PI)) * 0.08;
      g.rotation.set(-0.25 + paddle - act.dig * 0.8, sx * 0.35, sx * -0.25);
      g.position.z = 0.36 + act.dig * 0.12;
    }
    const bt = t % 3.6;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
    const close = Math.max(bk(bt - 3.2), Math.floor(t / 3.6) % 3 === 1 ? bk(bt - 2.9) : 0);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    for (const g of gazes) g.g.rotation.y = -g.sx * 0.32 + Math.sin(t * 0.4) * 0.08;
    helm.rotation.x = -0.28 - tw * 0.02;
    sack.rotation.z = -0.15 + Math.sin(t * 0.9 - 0.6) * 0.04;
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.crystal.emissiveIntensity = 0.55 + gl * 0.6;
    }
  };
  update(0);

  const face = group(body, [0, 0.84, 0.3]);
  const mouthA = group(body, [...surf(0, -0.28, 0.01).toArray()] as [number, number, number]);
  const crysTip = group(crystal, [0, 0.155, 0]);
  const clawsA = group(body, [0, 0.6, 0.48]);
  const sackA = group(sack, [0, 0.05, 0]);
  const rig = { head: face, eyes: eyeAnchors, anchors: { mouth: mouthA, crystal: crysTip, claws: clawsA, sack: sackA } };
  mergeStatic(root, {
    owners: [body, noseG, crysG, helm, sack, ...hands.map((h) => h.g), ...gazes.map((g) => g.g), ...lids.map((l) => l.g)],
    keep: [...glints],
    twins: [[M.face, M.fur], [M.iris, M.gem0], [M.pupil, M.gem0]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.62, 0.02), radius: 0.78 };
}
