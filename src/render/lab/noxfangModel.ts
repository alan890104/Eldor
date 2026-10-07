// Noxfang (Nox), the Eternal Night Wolf (model lab version): the dire wolf that guards the dark source crystal, often mistaken for the calamity itself; a thousand years ago it was the one that clamped its jaws on the throat of the Void Blight.
// Keeps the five things that made the old design easiest to recognize: the deep midnight purple fur, the sharp red eyes, the long fangs showing outside the lower jaw, the crescent on the forehead and the old scar over the right eye.
// Body shape follows the design: a lean, tall four-legged wolf with a deep chest, narrow waist and long legs, and a thick ring of mane around the neck; the old version looked like a plump dog made of a few stacked balls, and here it becomes a single lofted torso.
// Personality: a night watcher who does not defend itself even when taken for the calamity, steady, alert and commanding without anger. The brows are pressed flat and the eyelids half lowered, the mouth is closed but two fangs show outside;
// head raised, chest thrust out, all four feet planted firmly. The right ear is missing a corner and the right eye has an old scar, both left by that battle.
// Gaze order: the face (red eyes, crescent, fangs, framed by the pale muzzle) first, the cluster of source crystal growing between the shoulder blades second, and the mane and tail as support.
// Back: the source crystal standing up behind the mane (the thing it guards grows right on its body, and to touch it you must get past it first), with a big tail hanging below.
// Fur: the mane, chest fur, head-side fur and tail fur are each one continuous ring of fur mass whose rear edge is cut into clumps of pointed tips, rather than separate strands of fur (those would look like armor plates).
// Restrained light effects: the old version's halo, moon arc, orbiting shards, shadow flames and glowing purple sigils all over the body are removed; the emissive is kept only on three places, the eyes, the crescent and the source crystal, with no bloom.
// Action table (act, 0-1, ultimate tweens; with all weights at 0 the shape and idle are exactly the same as the original):
//   glare  stare: the eyelids lift fully and the pupils narrow, and it stops looking around (eyes open at the start of the ultimate)
//   howl   long howl: neck and head tilt up, mouth open, eyes narrowed, both ears pressed back, and the chest lifts slightly
//   crouch crouch low: body pressed down, front low and rear high, front feet bracing forward and hind feet pushing back, head lowered but the eyes still level ahead, ears laid flat, tail raised level
//   leap   pounce: front feet reaching forward and hind feet kicked back straight, torso stretched, head reaching forward, tail pulled back straight (the instant it is airborne)
//   jaw    open mouth: the lower jaw opens downward, showing the upper and lower fangs and the mouth cavity
//   glow   glow: the source crystal, the forehead crescent and the eyes brighten
// Anchors (rig): head (center of the face), eyes (surface of the eyeballs), mouth (front of the upper muzzle), jaw (front of the lower jaw), brand (forehead crescent),
//   scar (the old scar on the right eye), crystal (center of the crystal cluster), crystalTip (tip of the longest crystal), chest (the chest), tailTip (end of the tail).
// Movable structure: each of the four legs has its own shoulder or hip pivot (leg, paw and claws turn together), the lower jaw has one pivot (the jaw and lower fangs), and the mouth cavity appears only when the mouth is open.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, furCollar, lathe, loft, outline, partKit, PI, rbox, slab, taper, type FurCollarOpts, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);

/** Almond shape: both corners pointed, with the upper edge more curved than the lower; slant raises the outer corner (the side where x is positive) */
function almond(w: number, up: number, down: number, slant: number, n = 16): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = w - (2 * w * i) / n;
    pts.push([x, up * (1 - (x / w) ** 2) + slant * x]);
  }
  for (let i = 1; i < n; i++) {
    const x = -w + (2 * w * i) / n;
    pts.push([x, -down * (1 - (x / w) ** 2) + slant * x]);
  }
  return pts;
}

/** A crystal of a hexagonal prism with a pointed top, each face with its own normal */
function crystal(r: number, len: number): THREE.BufferGeometry {
  const g = lathe([[0.001, -0.06], [r, -0.02], [r * 0.9, len * 0.7], [0.001, len]], 6).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

export function buildNoxfangLab(): LabModel {
  const RIMC = 0xcaa8ff;

  const M = {
    fur: labToon(0x4b3e7d, { rim: 0.85, rimColor: RIMC }),
    ruff: labToon(0x372d5f, { rim: 0.85, rimColor: RIMC }),
    dark: labToon(0x2f2652, { rim: 0.6, rimColor: RIMC }),
    pale: labToon(0xaa9bd8, { rim: 0.55, rimColor: RIMC }),
    moon: labToon(0xf4efff, { ramp: 'gem', emissive: 0xc4b0ff, emissiveAmt: 0.4, rim: 0.3 }),
    eye: labToon(0xff4a5e, { ramp: 'gem', emissive: 0xe0203c, emissiveAmt: 0.55, rim: 0 }),
    pupil: labToon(0x1b0f22, { rim: 0 }),
    socket: labToon(0x251c40, { rim: 0.3, rimColor: RIMC }),
    nose: labToon(0x2b2242, { spec: 0.9, specTh: 0.997, rim: 0.5, rimColor: RIMC }),
    fang: labToon(0xf6f1fb, { rim: 0.4 }),
    claw: labToon(0x2e2645, { spec: 0.9, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    scar: labToon(0xb8aae2, { rim: 0.4 }),
    crystal: labToon(0x4a2c9e, { ramp: 'gem', emissive: 0x5a20e0, emissiveAmt: 0.32, spec: 0.8, specTh: 0.95, rim: 0.7, rimColor: 0xe0c8ff }),
    mouth: labToon(0x4a0d26, { rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'noxfang-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between parts of the same group. The skull and the ring of fur behind the head form one group, and the neck and upper mane form one, so the fur-root boundary gets no extra line
  const HEAD = 9001;
  const NECK = 9002;
  const TAIL = 9003;

  /** Place a ring of fur: y aligns to the direction the fur roots point (opposite to the fur flow), and θ = 0 faces dorsal */
  const collar = (parent: THREE.Object3D, mat: THREE.Material, o: FurCollarOpts, at: THREE.Vector3, axis: THREE.Vector3, dorsal: THREE.Vector3, inkGroup?: number) => {
    const y = axis.clone().normalize();
    const z = dorsal.clone().addScaledVector(y, -dorsal.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = add(parent, furCollar(o), mat);
    m.position.copy(at);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (inkGroup !== undefined) m.userData.inkGroup = inkGroup;
    return m;
  };

  // Body (rises and falls slightly with breathing); the four feet hang directly on root so they stand firmly on the ground
  const BY = -0.08;
  const body = group(root, [0, BY, 0]);

  // ── Torso: a single loft, round rump, narrow waist, deep chest ──
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.025, 0.1, 0.1, 0],
    [0.07, 0.15, 0.16, 0],
    [0.15, 0.172, 0.185, -0.01],
    [0.28, 0.16, 0.175, 0],
    [0.45, 0.13, 0.135, 0.04],
    [0.6, 0.165, 0.195, -0.005],
    [0.76, 0.195, 0.25, -0.05],
    [0.9, 0.175, 0.215, -0.03],
    [0.965, 0.12, 0.15, 0],
    [1, 0, 0, 0],
  ]);
  const torso = add(body, loft([v(0, 0.8, -0.64), v(0, 0.82, -0.44), v(0, 0.82, -0.2), v(0, 0.8, 0.05), v(0, 0.82, 0.27), v(0, 0.87, 0.4)], torsoProf, { segs: 64, radial: 28 }), M.fur);

  // Neck: rises up from above the chest, wrapped in a thick layer of mane
  const nb = v(0, 0.88, 0.2);
  const nt = v(0, 1.2, 0.42);
  add(body, loft([nb, v(0, 1.05, 0.32), nt], curveTable([[0, 0.13, 0.14], [0.5, 0.115, 0.12], [1, 0.1, 0.1]]), { segs: 20, radial: 20 }), M.fur).userData.inkGroup = NECK;
  add(body, loft([v(0, 0.86, 0.14), v(0, 1.0, 0.26), v(0, 1.16, 0.34), v(0, 1.26, 0.36)], curveTable([[0, 0, 0, 0], [0.12, 0.17, 0.16, 0], [0.45, 0.185, 0.175, -0.01], [0.8, 0.15, 0.14, 0], [1, 0, 0, 0]]), { segs: 28, radial: 24 }), M.ruff).userData.inkGroup = NECK;

  // ── Limbs: front legs straight, hind legs with the thigh forward, the shin back and straight down below the hock ──
  // Each leg (with paw and claws) hangs on the shoulder or hip pivot, and the whole leg turns about the pivot when crouching and pouncing; part coordinates stay as before, just with the pivot position subtracted
  const legs: { g: THREE.Group; y0: number; len: number; front: boolean }[] = [];
  const paw = (parent: THREE.Object3D, o: THREE.Vector3, x: number, z: number) => {
    add(parent, new THREE.SphereGeometry(1, 24, 16), M.fur, [x - o.x, 0.05 - o.y, z - o.z], [0, 0, 0], [0.074, 0.05, 0.096]);
    for (let i = 0; i < 4; i++) {
      const cx = x + (i - 1.5) * 0.03;
      add(parent, new THREE.ConeGeometry(0.0105, 0.044, 8), M.claw, [cx - o.x, 0.028 - o.y, z + 0.088 - Math.abs(i - 1.5) * 0.008 - o.z], [1.9, 0, (i - 1.5) * -0.12]);
    }
  };
  for (const sx of [-1, 1]) {
    const fz = sx > 0 ? 0.03 : 0;
    const fp = v(sx * 0.1, 0.82, 0.25 + fz);
    const fg = group(root, [fp.x, fp.y, fp.z]);
    add(fg, loft([v(sx * 0.1, 0.82, 0.25 + fz), v(sx * 0.148, 0.52, 0.19 + fz), v(sx * 0.155, 0.26, 0.22 + fz), v(sx * 0.158, 0.11, 0.25 + fz), v(sx * 0.158, 0.05, 0.29 + fz)],
      curveTable([[0, 0, 0], [0.03, 0.06, 0.08], [0.09, 0.085, 0.11], [0.3, 0.08, 0.092], [0.5, 0.06, 0.068], [0.78, 0.052, 0.058], [0.95, 0.049, 0.054], [1, 0.04, 0.04]]), { segs: 36, radial: 18, side: X }), M.fur, [-fp.x, -fp.y, -fp.z]);
    paw(fg, fp, sx * 0.158, 0.31 + fz);
    legs.push({ g: fg, y0: fp.y, len: fp.y - 0.05, front: true });
    const hp = v(sx * 0.11, 0.84, -0.42);
    const hg = group(root, [hp.x, hp.y, hp.z]);
    add(hg, loft([v(sx * 0.11, 0.84, -0.42), v(sx * 0.16, 0.5, -0.27), v(sx * 0.16, 0.25, -0.47), v(sx * 0.16, 0.1, -0.45), v(sx * 0.16, 0.05, -0.42)],
      curveTable([[0, 0, 0], [0.03, 0.08, 0.12], [0.09, 0.12, 0.18], [0.2, 0.11, 0.15], [0.38, 0.076, 0.088], [0.55, 0.058, 0.064], [0.72, 0.053, 0.058], [0.9, 0.049, 0.054], [1, 0.04, 0.04]]), { segs: 40, radial: 18, side: X }), M.fur, [-hp.x, -hp.y, -hp.z]);
    paw(hg, hp, sx * 0.16, -0.4);
    legs.push({ g: hg, y0: hp.y, len: hp.y - 0.05, front: false });
  }

  // ── Mane: two layers of fur joined into one sheet on the neck, the rear edge cut into clumps of pointed tips, with the tips of the upper layer covering the roots of the lower; from throat to chest is a sheet of pale chest fur ──
  const nT = nt.clone().sub(nb).normalize();
  const nU = v(0, nT.z, -nT.y);
  collar(body, M.ruff, { r0: 0.1, len: 0.27, thick: 0.1, flare: 0.8, curl: 0.55, tufts: 8, a0: -2.4, a1: 2.4, seed: 3 }, nb.clone().lerp(nt, 0.78), nT, nU, NECK);
  collar(body, M.ruff, { r0: 0.13, len: 0.3, thick: 0.11, flare: 0.95, curl: 0.65, tufts: 7, a0: -2.2, a1: 2.2, phase: 0.5, seed: 5 }, nb.clone().lerp(nt, 0.3), nT, nU);
  collar(body, M.pale, { r0: 0.08, len: 0.34, thick: 0.08, flare: 0.85, curl: 0.7, tufts: 3, a0: PI - 0.75, a1: PI + 0.75, notch: 0.35, seed: 9 }, nb.clone().lerp(nt, 0.82), nT, nU);

  // ── Source crystal: a cluster of dark purple crystal columns growing between the shoulder blades, slanting backward ──
  const crystals = group(body, [0, 0.93, -0.1]);
  add(crystals, crystal(0.05, 0.36), M.crystal, [0, 0, 0], [-0.5, 0.3, 0]);
  for (const sx of [-1, 1]) add(crystals, crystal(0.04, 0.3), M.crystal, [sx * 0.07, -0.01, 0.03], [-0.25, sx * 0.4, -sx * 0.95]);
  add(crystals, crystal(0.03, 0.16), M.crystal, [-0.03, -0.02, -0.12], [-1.0, -0.6, 0.35]);

  // ── Tail: a thick, heavy wolf tail, hanging down and narrowing slightly at the end ──
  const tail = group(body, [0, 0.87, -0.58], [-0.3, 0.1, 0]);
  const tailPts = [v(0, 0.02, 0.06), v(0, 0, -0.12), v(0.02, -0.1, -0.3), v(0.07, -0.3, -0.42), v(0.14, -0.5, -0.43)];
  add(tail, loft(tailPts, curveTable([[0, 0.05, 0.05], [0.2, 0.06, 0.068], [0.5, 0.074, 0.096], [0.75, 0.068, 0.088], [0.92, 0.042, 0.05], [1, 0, 0]]), { segs: 40, radial: 20, side: X }), M.fur).userData.inkGroup = TAIL;
  // Two layers of fur on the outside of the tail drape toward the tail end, the rear edge likewise in clumps of pointed tips
  const tailPath = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  for (const [t, r0, len, tufts, grp] of [[0.3, 0.05, 0.22, 6, TAIL], [0.58, 0.05, 0.22, 5, undefined]] as [number, number, number, number, number | undefined][]) {
    const tan = tailPath.getTangentAt(t);
    collar(tail, M.fur, { r0, len, thick: 0.075, flare: 0.3, curl: 0.2, tufts, phase: t, seed: Math.round(t * 100) }, tailPath.getPointAt(t), tan.negate(), v(0, 1, 0), grp);
  }

  // ── Head: the neck pivot handles looking around, and the head's origin is at the center of the skull ──
  const neck = group(body, [0, 1.08, 0.36]);
  const head = group(neck, [0, 0.16, 0.1], [0.06, 0, 0]);
  head.scale.setScalar(1.22);

  add(head, new THREE.SphereGeometry(0.15, 36, 24), M.fur, [0, 0, 0], [0, 0, 0], [1, 0.88, 1.08]).userData.inkGroup = HEAD;
  // Muzzle: upper muzzle, pale lower jaw and two cheeks; the closed mouth is the boundary between the upper muzzle and the lower jaw
  add(head, loft([v(0, 0, 0.02), v(0, -0.035, 0.2), v(0, -0.05, 0.36)], curveTable([[0, 0.085, 0.08], [0.4, 0.07, 0.06], [0.8, 0.054, 0.048], [0.94, 0.043, 0.039], [1, 0, 0]]), { segs: 30, radial: 24 }), M.fur);
  // The lower jaw hangs on the pivot at the mouth corner (turning down when the mouth opens); the two lower canines are normally hidden in the upper muzzle and show only when the mouth opens
  const HINGE = v(0, -0.07, 0.035);
  const jaw = group(head, [HINGE.x, HINGE.y, HINGE.z]);
  add(jaw, loft([v(0, -0.085, 0.04), v(0, -0.095, 0.18), v(0, -0.098, 0.31)], curveTable([[0, 0.07, 0.04], [0.5, 0.055, 0.032], [0.9, 0.04, 0.026], [1, 0, 0]]), { segs: 24, radial: 18 }), M.pale, [-HINGE.x, -HINGE.y, -HINGE.z]);
  for (const sx of [-1, 1]) add(jaw, new THREE.ConeGeometry(0.009, 0.042, 10), M.fang, [sx * 0.033 - HINGE.x, -0.061 - HINGE.y, 0.255 - HINGE.z], [0, 0, -sx * 0.08]);
  // Mouth cavity: a deep red that appears only when the mouth is open, placed along half the angle between the upper and lower jaws and getting thicker the wider it opens
  const mouthPivot = group(head, [HINGE.x, HINGE.y, HINGE.z]);
  const mouthIn = add(mouthPivot, new THREE.SphereGeometry(1, 20, 12), M.mouth, [0, -0.004, 0.14], [0, 0, 0], [0.042, 0.002, 0.14]);
  mouthIn.visible = false;
  for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(1, 24, 16), M.pale, [sx * 0.05, -0.08, 0.15], [0, sx * 0.3, 0], [0.04, 0.03, 0.07]);
  add(head, taper(rbox(0.074, 0.046, 0.05, 0.02), [1, 1], [0.72, 0.85]), M.nose, [0, -0.028, 0.358], [0.15, 0, 0]);
  for (const sx of [-1, 1]) add(head, new THREE.ConeGeometry(0.012, 0.09, 12), M.fang, [sx * 0.05, -0.108, 0.285], [PI, 0, sx * 0.1]);

  // Eye: the dark eye socket is an almond-shaped frame with thickness, the red eyeball bulges behind the frame, the upper eyelid hangs from behind the frame to cover the top edge; heavy brows press down on the frame
  const lids: { g: THREE.Group; open: number }[] = [];
  let scar: THREE.Group | null = null;
  const pupils: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.08, 0.028, 0.128]);
    eyeAnchors.push(group(eg, [0, 0, 0.02]));
    eg.quaternion.setFromUnitVectors(v(0, 0, 1), v(sx * 0.52, 0.1, 0.85).normalize());
    const W = 0.045;
    const sl = sx * 0.2;
    const frame = outline(almond(W + 0.012, 0.03, 0.024, sl));
    const hole = new THREE.Path();
    const hp = almond(W, 0.018, 0.013, sl);
    hole.moveTo(hp[0][0], hp[0][1]);
    for (const p of hp.slice(1)) hole.lineTo(p[0], p[1]);
    hole.closePath();
    frame.holes.push(hole);
    add(eg, slab(frame, 0.014, 0.004, 4), M.socket, [0, 0, 0.008]);
    add(eg, new THREE.SphereGeometry(0.03, 32, 20), M.eye, [0, 0, -0.004], [0, 0, 0], [1.55, 0.85, 0.5]);
    const pupil = add(eg, rbox(0.009, 0.03, 0.008, 0.004), M.pupil, [0, 0.001, 0.009]);
    pupils.push(pupil);
    const hl = add(eg, new THREE.SphereGeometry(0.0055, 10, 8), M.hi, [-0.012, 0.008, 0.014]);
    hl.layers.disable(INK_LAYER);
    const lid = group(eg, [0, 0.026, 0.0145], [0, 0, sl * 0.8]);
    add(lid, rbox(0.1, 0.05, 0.008, 0.003), M.fur, [0, -0.025, 0]);
    const open = sx < 0 ? 0.36 : 0.26;
    lid.scale.y = open;
    lids.push({ g: lid, open });
    add(eg, taper(rbox(0.1, 0.03, 0.04, 0.014), [0.85, 0.9]), M.fur, [sx * 0.004, 0.038, 0.004], [0, 0, sx * 0.12]);
    // An old scar on the right eye (its own right): a pale ridge slanting from above the brow down to the cheek
    if (sx < 0) {
      add(eg, loft([v(-0.016, 0.066, 0.008), v(-0.007, 0.036, 0.026), v(0.004, 0.0, 0.027), v(0.012, -0.04, 0.01)], (t) => [0.009 * (1 - Math.abs(t - 0.5)), 0.006], { segs: 20, radial: 8, side: X }), M.scar);
      scar = group(eg, [-0.004, 0.02, 0.03]);
    }
  }

  // Forehead crescent: a thick crescent with its points up, lying on the slope of the forehead
  const moonShape = new THREE.Shape();
  {
    const R = 0.058;
    const d = 0.027;
    const r = 0.05;
    const ty = (R * R - r * r + d * d) / (2 * d);
    const tx = Math.sqrt(R * R - ty * ty);
    const a = Math.atan2(ty, tx);
    const b = Math.atan2(ty - d, tx);
    moonShape.absarc(0, 0, R, a, PI - a, true);
    moonShape.absarc(0, d, r, PI - b, b, false);
  }
  const brow = group(head, [0, 0.086, 0.122], [-0.8, 0, 0]);
  add(brow, slab(moonShape, 0.018, 0.006, 16), M.moon);
  const brand = group(brow, [0, -0.028, 0.014]);

  // Ears: tall upright triangular ears with a recessed dark inner shell; the outer edge of the right ear has a corner bitten off
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.085, 0.1, -0.03], [-0.2, sx * 0.25, -sx * 0.28]);
    const base = 0.058;
    const H = 0.2;
    const pts: [number, number][] = [[-base, 0], [base, 0]];
    if (sx < 0) pts.push([0.004, H], [-0.012, H * 0.8], [-0.004, H * 0.7], [-0.024, H * 0.58]);
    else pts.push([0.018, H * 0.62], [0.004, H]);
    const shape = outline(pts);
    const inner = new THREE.Path();
    inner.moveTo(-0.032, 0.025);
    inner.lineTo(0.032, 0.025);
    inner.lineTo(0.004, H * 0.62);
    inner.closePath();
    shape.holes.push(inner);
    add(eg, slab(shape, 0.036, 0.01, 4), M.fur);
    add(eg, slab(outline([[-0.036, 0.02], [0.036, 0.02], [0.004, H * 0.66]]), 0.02, 0.004, 2), M.dark, [0, 0, -0.012]);
    ears.push(eg);
  }

  // Fur flaring out and back on both sides of the head (seen from the front it frames the head a size larger, leaving the top of the head to the ears), with the lower edge of the cheeks pale
  for (const sx of [-1, 1]) collar(head, M.ruff, { r0: 0.1, len: 0.22, thick: 0.075, flare: 0.95, curl: 0.45, tufts: 3, a0: sx > 0 ? 0.5 : -1.95, a1: sx > 0 ? 1.95 : -0.5, seed: 13 + sx }, v(0, 0, -0.03), v(0, 0, 1), v(0, 1, 0), HEAD);
  for (const sx of [-1, 1]) collar(head, M.pale, { r0: 0.09, len: 0.15, thick: 0.06, flare: 1.0, curl: 0.35, tufts: 2, a0: sx > 0 ? 1.95 : -2.75, a1: sx > 0 ? 2.75 : -1.95, seed: 17 + sx }, v(0, -0.01, -0.01), v(0, 0, 1), v(0, 1, 0), HEAD);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: breathing, slow looking around, blinking, an occasional ear twitch, the tail swaying lightly, the source crystal flickering faintly ──
  // The performance's action weights are layered on top of idle (see the header's <Action table>); with all at 0 every term equals the original idle
  const act = { glare: 0, howl: 0, crouch: 0, leap: 0, jaw: 0, glow: 0 };
  const eyeEm = M.eye.emissiveIntensity;
  const moonEm = M.moon.emissiveIntensity;
  const crystalEm = M.crystal.emissive.clone();
  const CRYSTAL_HOT = new THREE.Color(0xb040ff);
  let lastGlow = 0;
  let blinkIn = 2.4;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    const { glare, howl, crouch, leap, glow } = act;
    // It no longer looks around while glaring, howling, crouching or pouncing
    const still = 1 - Math.min(1, Math.max(glare, howl, crouch, leap));
    const low = crouch * (1 - leap);
    const br = Math.sin(t * 1.4);
    torso.scale.set(1 + br * 0.012, 1 + br * 0.012, 1 + leap * 0.07);
    body.position.y = BY + br * 0.004 - low * 0.07;
    body.rotation.x = low * 0.1 - howl * 0.07;
    neck.rotation.y = (Math.sin(t * 0.33) * 0.2 + Math.sin(t * 0.91) * 0.03) * still;
    neck.rotation.x = Math.sin(t * 0.52) * 0.03 * still - howl * 0.32 + low * 0.24 + leap * 0.12;
    head.rotation.x = 0.06 - howl * 0.6 - low * 0.26 - leap * 0.1;
    head.rotation.z = Math.sin(t * 0.33 + 0.7) * 0.03 * still;
    for (const p of pupils) {
      p.position.x = Math.sin(t * 0.33 - 0.5) * 0.004 * still;
      p.scale.x = 1 - glare * 0.45;
    }

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.6 + ((t * 7.3) % 3);
    }
    let close = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.2;
      close = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.3) : 0;
      if (k >= 1) blinkT = -1;
    }
    // No blinking while glaring, with the eyelids fully lifted; eyes narrow while howling
    close *= 1 - Math.min(1, glare * 2);
    for (const l of lids) {
      const open = l.open + (0.06 - l.open) * glare + howl * 0.34;
      l.g.scale.y = open + (1.05 - open) * close;
    }

    const back = Math.min(1, Math.max(howl * 0.7, crouch, leap));
    for (let i = 0; i < ears.length; i++) {
      const sx = i === 0 ? -1 : 1;
      const ph = (t + i * 2.9) % 6.2;
      const tw = ph < 0.35 ? Math.sin(ph * 36) * (1 - ph / 0.35) * 0.2 : 0;
      ears[i].rotation.z = -sx * 0.28 + sx * tw * still - sx * back * 0.12;
      ears[i].rotation.x = -0.2 - back * 0.85;
    }
    // Legs turn about the shoulder and hip: when crouching the front feet brace forward and the hind feet push back (the amount the paws lift is made up, so they still stand on the ground); when pouncing they reach forward and kick back
    for (const l of legs) {
      const a = l.front ? -0.22 * low - 1.05 * leap : 0.16 * low + 0.95 * leap;
      l.g.rotation.x = a;
      l.g.position.y = l.y0 - l.len * (1 - Math.cos(a)) * (1 - leap);
    }
    tail.rotation.y = (0.1 + Math.sin(t * 0.8) * 0.09) * (1 - leap * 0.8);
    tail.rotation.x = -0.3 + Math.sin(t * 1.1) * 0.03 + low * 0.35 + leap * 1.0 + howl * 0.25;
    // Open mouth: the lower jaw turns down and the mouth cavity opens along half the angle; howling also opens the mouth
    const ja = Math.min(0.7, act.jaw * 0.62 + howl * 0.4);
    jaw.rotation.x = ja;
    mouthPivot.rotation.x = ja * 0.5;
    mouthIn.visible = ja > 0.02;
    mouthIn.scale.y = Math.max(0.002, Math.sin(ja * 0.5) * 0.15);
    M.crystal.emissiveIntensity = 0.45 + Math.sin(t * 1.2) * 0.08 + glow * 0.9;
    // Other materials are written only when the weight changes, so other spirits' ultimates that change these materials are not overwritten every frame
    if (glow !== lastGlow) {
      lastGlow = glow;
      M.eye.emissiveIntensity = eyeEm + glow * 0.7;
      M.moon.emissiveIntensity = moonEm + glow * 1.1;
      M.crystal.emissive.copy(crystalEm).lerp(CRYSTAL_HOT, glow * 0.6);
    }
  };
  update(0, 0);

  const anchors = {
    mouth: group(head, [0, -0.07, 0.34]),
    jaw: group(jaw, [0 - HINGE.x, -0.1 - HINGE.y, 0.3 - HINGE.z]),
    brand,
    ...(scar ? { scar } : {}),
    crystal: group(crystals, [0, 0.15, -0.07]),
    crystalTip: group(crystals, [0, 0.316, -0.173]),
    chest: group(body, [0, 0.86, 0.42]),
    tailTip: group(tail, [tailPts[4].x, tailPts[4].y, tailPts[4].z]),
  };
  const rig = { head: group(head, [0, -0.01, 0.13]), eyes: eyeAnchors, anchors };
  return { root, update, act, rig, center: new THREE.Vector3(0, 0.74, 0), radius: 1.0 };
}
