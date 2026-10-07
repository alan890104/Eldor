// Heavenly Lyrebird (model lab version, R, wind + light): the troubadours' teacher, able to learn any sound it has heard.
// Identifying features: 1. A seven-string lyre tail standing up behind it: two S-shaped lyre plumes that spread outward and then curve inward with the tips curling outward, the plume faces ivory white banded with amber; the four white filament feathers in the middle are the strings, and a single arched central tail feather on top is the lyre's crossbar.
// 2. An open slender beak: it is singing (learning sounds) at all times, the lower beak opening and closing, with a tuft of crest feathers on top of the head curling back like a clef. 3. A cyan-green satin ribbon around the neck holds a brass tuning fork, the teacher's mark.
// Body shape: a ground-dwelling fowl-shaped bird, with an egg-shaped body, long legs and a slender neck and small head; a gray-rose back, a cream chest and belly and deep plum wings, not leaning toward a humanoid shape.
// Personality: a self-satisfied old performer who always sings with head up and chest out, and can hear it if anyone sings a note wrong; personality comes from the chest-out pose, the raised head, the open beak and the display of the lyre tail, and the face follows a real bird, not a human face.
// Gaze order: the head (open beak, curled crest, small bright dark eye) first, the lyre tail second, the tuning fork third. Back: three thank-you ribbons given by the troubadours (cyan, gold, rose) are tied at the root of the lyre tail.
// Action table: idle is chest-out breathing, the head turning in jerks, singing a phrase every few seconds with the beak open (the strings trembling along), the lyre tail slowly swaying left and right and blinking; move is a long-legged stride with the head bobbing back and forth;
// charge-up act.display stands the lyre tail up and spreads it forward; strike act.sing tilts the head back with the beak open and a sound wave comes from mouth; hit draws the neck in and the lyre tail shudders with the eyes not closing; victory turns around in place to show the lyre tail and tilts the head back for one long call.
// Anchors: head, eyes, mouth, lyreTop (exact middle of the crossbar), lyreL / lyreR (the curls at the tops of the lyre plumes), fork (tuning fork), ribbons (the ribbon knot at the back).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, smooth, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const frac = (x: number) => x - Math.floor(x);
/** Convert latitude and longitude (centered on +z, longitude positive toward +x) to a unit direction */
const sph = (lon: number, lat: number) => v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));

// ───────────────────────── Helpers ─────────────────────────

function ringIndex(rows: number, J: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < J; j++) {
      const a = i * J + j;
      const a1 = i * J + ((j + 1) % J);
      idx.push(a, a + J, a1, a + J, a1 + J, a1);
    }
  return idx;
}

/** Decide whether to flip the facing from the sum of all triangle normals (triangles degenerate at the end points cannot cause a misjudgment) */
function faceOut(g: THREE.BufferGeometry, want: THREE.Vector3): void {
  const P = g.attributes.position as THREE.BufferAttribute;
  const idx = g.index!.array as Uint32Array | Uint16Array;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let sum = 0;
  for (let k = 0; k < idx.length; k += 3) {
    a.fromBufferAttribute(P, idx[k]);
    b.fromBufferAttribute(P, idx[k + 1]);
    c.fromBufferAttribute(P, idx[k + 2]);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    const mid = a.clone().add(b).add(c).divideScalar(3);
    sum += n.dot(want.lengthSq() ? want : mid);
  }
  if (sum >= 0) return;
  for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  g.index!.needsUpdate = true;
  g.computeVertexNormals();
}

function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i), n.fromBufferAttribute(na, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

function capGeo(r: number, ang: number, seg = 20, rings = 3): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** Eyelid: a spherical shell with +y as the top, turning only the front half×2 radians (the back half is buried in the head) */
function lidGeo(ri: number, ro: number, lip: number, seg = 18, half = 1.96): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const inner = [0, 0.45, 0.72, 0.88, 1];
  for (const f of inner) prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(f * lip)), ri * Math.cos(f * lip)));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 3; i++) {
    const b = (i / 3) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (const f of [...inner].reverse()) prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(f * lip)), ro * Math.cos(f * lip)));
  return smooth(new THREE.LatheGeometry(prof, seg, -half, half * 2));
}

/**
 * A feather with thickness (xy plane, thickness along z): each cell along s is a lens-shaped cross-section ring running from L(s) to T(s), with both edges rounded into lips;
 * where L and T coincide at the two ends it closes to a point. color applies vertex colors by (s, h) (h 0 is on the L edge, 1 on the T edge).
 */
function finGeo(L: (s: number) => [number, number], T: (s: number) => [number, number], th: (s: number, h: number) => number, S: number, J: number, color?: (s: number, h: number) => THREE.Color): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const [lx, ly] = L(s);
    const [tx, ty] = T(s);
    for (let j = 0; j < J; j++) {
      const f = (j / J) * PI * 2;
      const h = (1 - Math.cos(f)) / 2;
      pos.push(lx + (tx - lx) * h, ly + (ty - ly) * h, th(s, h) * Math.sin(f));
      if (color) {
        const c = color(s, h);
        cl.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(ringIndex(S, J));
  g.computeVertexNormals();
  // The cross-section is a lens about z, and the normals must point away from the midline: check using the half-ring on the +z face
  const P = g.attributes.position as THREE.BufferAttribute;
  const N = g.attributes.normal as THREE.BufferAttribute;
  let sum = 0;
  for (let i = 0; i < P.count; i++) sum += N.getZ(i) * Math.sign(P.getZ(i));
  if (sum < 0) {
    const idx = g.index!.array as Uint32Array | Uint16Array;
    for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

function spline2(pts: [number, number][]): THREE.SplineCurve {
  return new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}

// ───────────────────────── Shape ─────────────────────────

export function buildLyrebirdLab(): LabModel {
  const RIMC = 0xffe6d6;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    feather: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    shaft: labToon(0x6a3526, { rim: 0.4, rimColor: RIMC }),
    string: labToon(0xfff4dc, { rim: 0.5, rimColor: 0xfff0c8 }),
    beak: labToon(0x3a3040, { spec: 0.7, specTh: 0.95, rim: 0.35, rimColor: RIMC }),
    mouth: labToon(0xc4566a, { rim: 0 }),
    leg: labToon(0x6f6470, { rim: 0.35, rimColor: RIMC }),
    claw: labToon(0x2e2830, { spec: 0.6, specTh: 0.95, rim: 0.2 }),
    eyeball: labToon(0x140c10, { ramp: 'gem', spec: 0.5, specTh: 0.97, rim: 0.1 }),
    lid: labToon(0x8f6476, { rim: 0.4, rimColor: RIMC }),
    ribbon: labToon(0x2f8a86, { rim: 0.45, rimColor: 0xd8fff4 }),
    brass: labToon(0xdcaa4c, { ramp: 'metal', spec: 1.4, specTh: 0.9, rim: 0.55, rimColor: 0xffe6a8 }),
    cloth: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'lyrebird-lab';
  const { add, group } = partKit();
  const BODY = 9601;

  // pose: breathing and overall bobbing; inner: parts are placed in absolute coordinates, with the midpoint of head and tail moved to the origin (pitfall 66)
  const pose = group(root);
  const inner = group(pose, [0, 0, 0.07]);

  const cBack = col(0x94697a);
  const cBackDk = col(0x7b5366);
  const cCream = col(0xf4e6cc);
  const cBuff = col(0xe9c69c);
  const cPlum = col(0x5e3e56);
  const cPlumLt = col(0x86607a);

  // ── Body to neck: one loft, an egg-shaped body connecting to a slender neck forward and up ──
  const bodyPts = [v(0, 0.42, -0.35), v(0, 0.46, -0.23), v(0, 0.52, -0.05), v(0, 0.61, 0.09), v(0, 0.75, 0.14), v(0, 0.87, 0.125), v(0, 0.95, 0.11)];
  const bodyProf = curveTable([
    [0, 0, 0],
    [0.06, 0.075, 0.065],
    [0.25, 0.16, 0.15],
    [0.45, 0.175, 0.165],
    [0.6, 0.14, 0.13],
    [0.74, 0.078, 0.078],
    [0.88, 0.064, 0.066],
    [1, 0.06, 0.06],
  ]);
  const bodyColor = (p: THREE.Vector3, n: THREE.Vector3) => {
    // Gray-rose on the back and back of the neck, cream on the chest and belly, with a touch of light brown under the throat
    const belly = ss(-n.y * 0.8 + n.z * 0.7, -0.15, 0.35);
    const c = cBack.clone().lerp(cBackDk, ss(-n.z, 0.3, 0.9) * ss(n.y, -0.2, 0.5) * 0.6);
    c.lerp(cCream, belly);
    c.lerp(cBuff, belly * ss(p.y, 0.66, 0.8) * 0.7);
    return c;
  };
  add(inner, paint(loft(bodyPts, (t) => bodyProf(t), { segs: 44, radial: 22, side: v(1, 0, 0) }), bodyColor), M.feather).userData.inkGroup = BODY;

  // ── Wings: flat long feather panels folded at the sides of the body, gray-rose coverts, one cream wing bar and deep plum flight feathers ──
  for (const sx of [-1, 1]) {
    const pts = [v(sx * 0.135, 0.68, 0.09), v(sx * 0.165, 0.62, -0.02), v(sx * 0.172, 0.55, -0.16), v(sx * 0.155, 0.48, -0.3), v(sx * 0.13, 0.44, -0.38)];
    const wp = curveTable([[0, 0, 0], [0.1, 0.03, 0.07], [0.35, 0.034, 0.1], [0.7, 0.026, 0.075], [0.92, 0.015, 0.035], [1, 0, 0]]);
    const g = loft(pts, (t) => wp(t), { segs: 26, radial: 14, side: v(1, 0, 0) });
    paint(g, (p) => {
      const u = THREE.MathUtils.clamp((0.09 - p.z) / 0.47, 0, 1);
      const c = cBack.clone().lerp(cCream, (1 - ss(Math.abs(u - 0.36), 0.03, 0.06)) * 0.85);
      c.lerp(cPlumLt, ss(u, 0.42, 0.5)).lerp(cPlum, ss(u, 0.6, 0.8));
      return c;
    });
    add(inner, g, M.feather);
  }

  // ── Legs: long and strong legs, three front toes and one hind toe, with dark claws at the toe tips ──
  const clawGeo = lathe([[0.001, 0], [0.009, 0.004], [0.006, 0.02], [0.001, 0.034]], 7);
  for (const sx of [-1, 1]) {
    const hip = v(sx * 0.075, 0.42, 0.0);
    const ank = v(sx * 0.085, 0.045, 0.05);
    add(inner, loft([hip, v(sx * 0.082, 0.3, -0.02), v(sx * 0.085, 0.16, 0.02), ank], (t) => {
      const r = t < 0.12 ? 0.05 * (t / 0.12) ** 0.5 : THREE.MathUtils.lerp(0.03, 0.02, t);
      return [r, r];
    }, { segs: 16, radial: 10, side: v(1, 0, 0) }), M.leg);
    const toes: [number, number][] = [[-0.45, 0.1], [0, 0.115], [0.45, 0.1], [PI, 0.055]];
    for (const [a, len] of toes) {
      const dir = v(Math.sin(a + sx * 0.12), 0, Math.cos(a + sx * 0.12));
      const tip = ank.clone().addScaledVector(dir, len).setY(0.015);
      const mid = ank.clone().addScaledVector(dir, len * 0.5).setY(0.028);
      add(inner, loft([ank.clone().setY(0.04), mid, tip], (t) => {
        const r = 0.014 * (1 - 0.4 * t) * Math.min(1, t * 12 + 0.2);
        return [r, r * 0.8];
      }, { segs: 8, radial: 8 }), M.leg);
      const cg = group(inner, [tip.x, tip.y, tip.z]);
      cg.quaternion.setFromUnitVectors(v(0, 1, 0), dir.clone().setY(-0.25).normalize());
      add(cg, clawGeo, M.claw, [0, -0.004, 0]);
    }
  }

  // ── Head: a small round head, gray-rose on top and cream cheeks and throat ──
  const NECK = v(0, 0.9, 0.12);
  const headG = group(inner, NECK.toArray() as [number, number, number]);
  const HC = v(0, 0.99, 0.13).sub(NECK);
  const HR = 0.1;
  const headGeo = paint(new THREE.SphereGeometry(HR, 36, 24), (_p, n) => {
    const c = cBack.clone().lerp(cCream, ss(-n.y + 0.25 * n.z, 0.05, 0.45));
    return c.lerp(cBuff, ss(-n.y, 0.4, 0.8) * 0.5);
  });
  headGeo.deleteAttribute('uv');
  add(headG, headGeo, M.feather, HC.toArray() as [number, number, number]).userData.inkGroup = BODY;

  // ── Beak: a slender upper beak curving slightly down, with the lower beak on its own joint (opening when singing), and a patch of pink mouth cavity inside ──
  const BK = HC.clone().add(v(0, -0.012, HR * 0.86));
  const upperBeak = loft([BK.clone().add(v(0, 0.004, -0.035)), BK.clone().add(v(0, 0.008, 0.04)), BK.clone().add(v(0, -0.004, 0.1)), BK.clone().add(v(0, -0.02, 0.135))], (t) => {
    const k = t < 0.1 ? Math.sqrt(t / 0.1) : 1 - 0.85 * ((t - 0.1) / 0.9) ** 1.1;
    return [0.03 * k * (t < 1 ? 1 : 0), 0.019 * k * (t < 1 ? 1 : 0), -0.004 * k];
  }, { segs: 16, radial: 12 });
  add(headG, upperBeak, M.beak);
  const jaw = group(headG, [BK.x, BK.y - 0.012, BK.z - 0.03]);
  add(jaw, loft([v(0, 0, -0.005), v(0, -0.002, 0.06), v(0, -0.006, 0.12)], (t) => {
    const k = t < 0.1 ? Math.sqrt(t / 0.1) : 1 - 0.9 * ((t - 0.1) / 0.9);
    return [0.024 * k * (t < 1 ? 1 : 0), 0.011 * k * (t < 1 ? 1 : 0), -0.002];
  }, { segs: 12, radial: 10 }), M.beak);
  add(jaw, new THREE.SphereGeometry(1, 12, 8), M.mouth, [0, 0.008, 0.035], [0, 0, 0], [0.02, 0.01, 0.05]);

  // ── Eyes: a bird's eye. A small one (diameter about 13% of the head width) set in the side of the head, dark and glossy with only one small highlight; no eye ring, brow or eyeliner, and the eyelid flips down only when blinking ──
  const ER = 0.0135;
  const UP_OPEN = 1.28;
  const LO_SHUT = 0.98;
  const lids: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = lidGeo(ER + 0.001, ER + 0.0035, PI / 2, 14);
  const hiGeo = new THREE.SphereGeometry(1, 8, 6);
  for (const sx of [-1, 1]) {
    const d = sph(sx * 0.95, 0.16);
    const c = HC.clone().addScaledVector(d, HR - ER * 0.6);
    const eg = group(headG, c.toArray() as [number, number, number]);
    eg.quaternion.setFromUnitVectors(FWD, d);
    // After the eye socket is turned outward, the eye's y axis does not necessarily point up: turn it back so the "up" of the eyelid lines up with the top of the head
    const roll = group(eg);
    {
      const upW = v(0, 1, 0).applyQuaternion(eg.quaternion);
      const want = v(0, 1, 0).addScaledVector(d, -d.y).normalize();
      roll.rotation.z = Math.atan2(new THREE.Vector3().crossVectors(upW, want).dot(d), upW.dot(want));
    }
    add(roll, capGeo(ER, 1.3, 16, 6), M.eyeball);
    const q = sph(-sx * 0.3, 0.35).multiplyScalar(ER + 0.0008);
    const hl = add(roll, hiGeo, M.hi, q.toArray() as [number, number, number], [0, 0, 0], [0.0022, 0.0022, 0.001]);
    hl.quaternion.setFromUnitVectors(FWD, q.clone().normalize());
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    eyeAnchors.push(group(roll, [0, 0, ER]));
    const upper = group(roll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.lid).userData.inkGroup = BODY;
    lids.push(upper);
  }

  // ── Crest feathers: a tuft on top of the head curling back (like a clef), with another short tuft beside it ──
  const crest = group(headG, HC.clone().add(v(0, HR * 0.9, -0.01)).toArray() as [number, number, number]);
  {
    const pts = [v(0, -0.03, 0.03), v(0, 0.03, 0.0), v(0, 0.075, -0.05), v(0, 0.07, -0.11), v(0, 0.035, -0.125), v(0, 0.02, -0.095), v(0, 0.038, -0.075)];
    const cp = curveTable([[0, 0, 0], [0.08, 0.03, 0.026], [0.4, 0.024, 0.02], [0.8, 0.014, 0.013], [0.96, 0.01, 0.01], [1, 0, 0]]);
    add(crest, paint(loft(pts, (t) => cp(t), { segs: 30, radial: 10, side: v(1, 0, 0) }), (p) => cBackDk.clone().lerp(cPlum, ss(-p.z, 0.02, 0.1))), M.feather);
    const pts2 = [v(0.022, -0.02, 0.02), v(0.03, 0.03, -0.01), v(0.04, 0.05, -0.06), v(0.045, 0.035, -0.09)];
    add(crest, paint(loft(pts2, (t) => cp(Math.min(1, t * 1.1)), { segs: 16, radial: 8, side: v(1, 0, 0) }), () => cBackDk), M.feather);
  }

  // ── Cyan-green satin ribbon and brass tuning fork on the neck ──
  {
    const cp = new THREE.CatmullRomCurve3(bodyPts, false, 'centripetal');
    const t = 0.72;
    const at = cp.getPointAt(t);
    const tan = cp.getTangentAt(t);
    const ring = group(inner, at.toArray() as [number, number, number]);
    ring.quaternion.setFromUnitVectors(v(0, 0, 1), tan);
    const r = bodyProf(t)[0] + 0.006;
    add(ring, new THREE.TorusGeometry(r, 0.013, 8, 28), M.ribbon, [0, 0, 0], [0, 0, 0], [1, 1.02, 1.5]);
  }
  const forkG = group(inner, [0, 0.772, 0.234], [-0.03, 0, 0]);
  forkG.scale.setScalar(1.35);
  {
    // Hanging ring, handle, and the two prongs of the U shape
    add(forkG, new THREE.TorusGeometry(0.011, 0.004, 6, 14), M.brass, [0, 0.0, 0], [0, PI / 2, 0]);
    const tube = (pts: THREE.Vector3[], r: number) => loft(pts, (t) => {
      const k = t < 0.08 ? Math.sqrt(t / 0.08) : t > 0.92 ? Math.sqrt((1 - t) / 0.08) : 1;
      return [r * k, r * k];
    }, { segs: 14, radial: 8, side: v(0, 0, 1) });
    add(forkG, tube([v(0, -0.008, 0), v(0, -0.04, 0), v(0, -0.058, 0)], 0.008), M.brass);
    add(forkG, tube([v(-0.022, -0.125, 0), v(-0.022, -0.07, 0), v(-0.012, -0.053, 0), v(0, -0.05, 0), v(0.012, -0.053, 0), v(0.022, -0.07, 0), v(0.022, -0.125, 0)], 0.0085), M.brass);
  }

  // ── Lyre tail: two S-shaped lyre plumes, four filament feather strings and one arched central tail feather on top (the crossbar) ──
  const TAIL = v(0, 0.45, -0.33);
  const tailG = group(inner, TAIL.toArray() as [number, number, number], [-0.14, 0, 0]);
  const LZ = -0.06;
  const cIvory = col(0xf6ecd4);
  const cAmber = col(0xd8893a);
  const cRust = col(0x8a4630);
  const arm = spline2([[0.02, 0.0], [0.12, 0.13], [0.2, 0.31], [0.205, 0.49], [0.155, 0.64], [0.155, 0.78], [0.2, 0.88], [0.265, 0.9], [0.3, 0.855], [0.285, 0.8]]);
  const curls: THREE.Group[] = [];
  // The lyre face arches back into a curve, so from the side you can see the lyre's thickness and curvature, and it is not a flat board
  const bowZ = (y: number) => -0.075 * Math.sin(PI * THREE.MathUtils.clamp(y / 0.9, 0, 1)) + 0.03 * ss(y, 0.72, 0.92);
  const bend = (g: THREE.BufferGeometry, y0 = 0) => {
    const pa = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) + bowZ(pa.getY(i) + y0));
    g.computeVertexNormals();
    return g;
  };
  for (const sx of [-1, 1]) {
    const P = (s: number): [number, number] => {
      const p = arm.getPointAt(THREE.MathUtils.clamp(s, 0, 1));
      return [sx * p.x, p.y];
    };
    // The feather face is on the inner side of the lyre plume (facing the midline), with the width narrowing at the curl
    const W = (s: number) => 0.058 * ss(s, 0.0, 0.1) * (1 - ss(s, 0.6, 0.82) * 0.7) * (1 - ss(s, 0.9, 1));
    const T2 = (s: number): [number, number] => {
      const t = arm.getTangentAt(THREE.MathUtils.clamp(s, 0, 1));
      const [x, y] = P(s);
      const w = W(s);
      // The left normal (-ty, tx) points toward the midline on the right lyre plume; mirrored to the left, x is negated
      return [x + sx * -t.y * w, y + t.x * w];
    };
    const g = finGeo(P, T2, (s, h) => (0.009 * (1 - 0.5 * h) + 0.003) * ss(s, 0, 0.04), 70, 12, (s, h) => {
      // Amber crossbands (V shapes) alternating with ivory white, and the edge near the shaft a deep rust color
      const band = frac(s * 11 + h * 0.35);
      const c = cIvory.clone().lerp(cAmber, (1 - ss(Math.abs(band - 0.5), 0.14, 0.22)) * ss(s, 0.06, 0.12) * 0.95);
      return c.lerp(cRust, (1 - ss(h, 0.05, 0.3)) * 0.8);
    });
    g.translate(0, 0, LZ);
    add(tailG, bend(g), M.feather);
    // Shaft: a dark round ridge along the outer edge of the lyre plume, curling up at the top and rounding off
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const [x, y] = P(i / 24);
      pts.push(v(x, y, LZ));
    }
    add(tailG, bend(loft(pts, (t) => {
      const r = 0.012 * (1 - 0.35 * t) * Math.min(1, Math.sqrt(t / 0.02 + 0.05)) * Math.min(1, Math.sqrt((1 - t) / 0.03));
      return [r, r];
    }, { segs: 70, radial: 8, side: v(0, 0, 1) })), M.shaft);
    const [cx, cy] = P(0.93);
    curls.push(group(tailG, [cx, cy, LZ + bowZ(cy)]));
  }
  // Strings: four white filament feathers, inserted up from the tail root into the crossbar
  const strings = group(tailG, [0, 0, LZ]);
  const yoke = (x: number) => 0.775 - 1.9 * x * x;
  for (const x of [-0.105, -0.036, 0.036, 0.105]) {
    const pts = [v(x * 0.35, 0.05, 0), v(x * 0.8, 0.3, 0), v(x, 0.55, 0), v(x, yoke(x) + 0.005, 0)];
    add(strings, bend(loft(pts, (t) => {
      const r = THREE.MathUtils.lerp(0.012, 0.0095, t) * Math.min(1, Math.sqrt(t / 0.03 + 0.05));
      return [r, r];
    }, { segs: 20, radial: 8, side: v(0, 0, 1) })), M.string);
  }
  // Crossbar: two central tail feathers arching over the top and resting on the lyre plumes
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const x = -0.17 + (i / 12) * 0.34;
      pts.push(v(x, yoke(x), 0.004));
    }
    const g = loft(pts, (t) => {
      const k = Math.min(1, Math.sqrt(t / 0.04), Math.sqrt((1 - t) / 0.04));
      return [0.02 * k, 0.018 * k];
    }, { segs: 30, radial: 10, side: v(0, 0, 1) });
    add(strings, paint(bend(g), (p) => cIvory.clone().lerp(cAmber, (1 - ss(Math.abs(frac(p.x * 14) - 0.5), 0.12, 0.2)) * 0.8)), M.feather);
  }
  // Tail root: a small clump of coverts covering all the feather roots
  add(tailG, paint(new THREE.SphereGeometry(0.07, 18, 12), (_p, n) => cBack.clone().lerp(cPlum, ss(-n.z, 0.2, 0.9) * 0.5)), M.feather, [0, 0.03, -0.02], [0, 0, 0], [1, 1.1, 0.9]);

  // ── Back: the thank-you ribbons at the root of the lyre tail (cyan, gold, rose), one knot with three ribbons hanging down ──
  const bowG = group(tailG, [0, 0.07, -0.075], [0.25, 0, 0]);
  {
    const cols = [col(0x2f8a86), col(0xe0b04a), col(0xd7707e)];
    add(bowG, paint(new THREE.SphereGeometry(0.018, 12, 8), () => cols[1]), M.cloth);
    for (const sx of [-1, 1]) add(bowG, paint(new THREE.TorusGeometry(0.022, 0.008, 6, 14), () => cols[0]), M.cloth, [sx * 0.024, 0.006, 0], [0, 0.35 * sx, sx * 0.4], [1, 0.7, 1]);
    [[-0.022, 0.16, 0], [0.0, 0.2, 1], [0.024, 0.15, 2]].forEach(([x, len, ci]) => {
      const L = (s: number): [number, number] => [x + 0.012 * s + 0.01 * Math.sin(s * 5 + x * 40), -len * s];
      const T = (s: number): [number, number] => {
        const [a, b] = L(s);
        return [a + 0.022 * (1 - 0.2 * s), b + (s > 0.97 ? 0.012 : 0)];
      };
      const g = finGeo(L, T, () => 0.0035, 12, 8, () => cols[ci]);
      g.translate(-0.011, -0.006, -0.004);
      add(bowG, g, M.cloth);
    });
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const faceP = HC.clone().add(v(0, 0, HR * 0.8));
  const rig = {
    head: group(headG, faceP.toArray() as [number, number, number]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(headG, BK.clone().add(v(0, -0.012, 0.09)).toArray() as [number, number, number]),
      lyreTop: group(strings, [0, 0.79, bowZ(0.79)]),
      lyreL: curls[1],
      lyreR: curls[0],
      fork: group(forkG, [0, -0.09, 0]),
      ribbons: bowG,
    },
  };
  const act = { sing: 0, display: 0 };

  mergeStatic(root, {
    owners: [pose, inner, headG, jaw, crest, tailG, strings, forkG, bowG, ...lids],
    keep: [...glints],
    rig,
  });

  // ── Idle ──
  let blinkIn = 2.2;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    // Sings for 2 seconds every 6 seconds; when a performance gives act.sing, the larger of the two wins
    const ph = t % 6;
    const idleSing = ss(ph, 3.4, 3.6) * (1 - ss(ph, 5.3, 5.5));
    const sg = Math.max(act.sing, idleSing * 0.7);
    const dp = act.display;
    const br = Math.sin(t * 1.7);
    pose.position.y = br * 0.004;
    pose.scale.set(1 + br * 0.006, 1 - br * 0.003, 1 + br * 0.006);
    // The head turns in jerks (a bird's head): a quantized phase makes the pauses
    const step = Math.floor(t / 1.6);
    const look = Math.sin(step * 2.3) * 0.28;
    const k = ss(t - step * 1.6, 0, 0.18);
    const prevLook = Math.sin((step - 1) * 2.3) * 0.28;
    headG.rotation.set(-0.06 - sg * 0.32 + Math.sin(t * 13) * 0.02 * sg, THREE.MathUtils.lerp(prevLook, look, k) * (1 - sg * 0.6), Math.sin(t * 0.7) * 0.05);
    jaw.rotation.x = 0.16 + sg * (0.26 + Math.sin(t * 11) * 0.08);
    crest.rotation.x = Math.sin(t * 2.2 - 0.6) * 0.06 - sg * 0.12;
    tailG.rotation.set(-0.14 + dp * 0.35 + Math.sin(t * 0.9) * 0.02, Math.sin(t * 0.55) * 0.05, Math.sin(t * 0.7) * 0.04);
    tailG.scale.setScalar(1 + dp * 0.08);
    strings.scale.x = 1 + Math.sin(t * 38) * 0.035 * sg;
    forkG.rotation.set(-0.03 - Math.abs(Math.sin(t * 1.7)) * 0.03, 0, Math.sin(t * 1.1) * 0.04);
    bowG.rotation.set(0.25 + Math.sin(t * 1.3) * 0.06, 0, Math.sin(t * 0.9) * 0.05);
    let close = 0;
    if (dt === 0) {
      const bt = t % 3.8;
      close = bt > 3.5 && bt < 3.7 ? Math.min(1, Math.sin(((bt - 3.5) / 0.2) * PI) * 1.3) : 0;
    } else {
      blinkIn -= dt;
      if (blinkIn <= 0) {
        blinkT = 0;
        blinkIn = 2.6 + ((t * 7.3) % 3);
      }
      if (blinkT >= 0) {
        blinkT += dt;
        const q = blinkT / 0.18;
        close = q < 1 ? Math.min(1, Math.sin(q * PI) * 1.3) : 0;
        if (q >= 1) blinkT = -1;
      }
    }
    const shut = (UP_OPEN + LO_SHUT) * close;
    for (const l of lids) l.rotation.x = -UP_OPEN + shut;
    for (const g of glints) g.visible = close < 0.6;
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0, 0.68, 0), radius: 0.85, rig, act };
}
