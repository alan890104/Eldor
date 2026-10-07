// Voidchild (Naifu), Child of the Void Blight (model lab version): the void hatchling that condensed from the edge of the rift on the night the Void Blight poured in.
// Keeps the four things that made the old design easiest to recognize: the dark void sphere, one big eye filling the front (magenta iris, vertical pupil, upper eyelid), a crooked broken gold crown, and the shadow tentacles beneath.
// The old version's magenta cracks become real structure: the sphere is made of separate beveled obsidian shell plates, and the seams between the plates reveal the glowing magenta core inside.
// Body shape follows the design: a floating sphere with tentacles, not leaning toward a humanoid shape.
// Personality: a gluttonous hatchling that has just learned curiosity. The eye is wide open and looks slightly upward, the upper eyelid tilted to one side as if raising a brow, and the mouth grins open to show two small fangs;
// the crown is too big for it and worn crooked; a tentacle at the front right reaches forward as if to touch something in front of it (the hand the contractor holds out to it in the design).
// Gaze order: the big eye (the brightest and highest-contrast on the body) → the gold crown → the remaining shell plates and tentacles all darkened.
// Back: the wound torn open by the rift, with two shell plates tilted up and a few fragments drifting away, the core showing the most through the seams.
// Restrained light effects: no bloom, no translucent mist shell and no scattered glowing dots; only the core and the tentacle tips are emissive, and the eye's highlights are two small white dots.
// Action weights (act, for ultimates; with all at 0 it is the idle look):
//   glare  stare: the eye stops looking around and looks straight ahead, the eyeball bulges slightly, the upper eyelid lifts high, the vertical pupil narrows to a thin slit and the iris brightens
//   crown  broken crown: the crown floats up and spins about its own axis (the larger the weight the faster the spin), the fragments on the break spin along and float higher; at zero it turns back to its original angle
//   open   shell burst: each obsidian shell plate drifts outward along its own direction, flipping slightly, the eye along with its socket and mouth pushes forward, the tentacles sway faster, and the whole core is exposed
//   glow   core glow: the emissive of the core and tentacle tips strengthens
//   collapse  collapse: the core shrinks to a small point (used when an ultimate swaps the core for a black hole), and glow also decides the brightness before shrinking
//   squint  squint: the upper eyelid closes halfway (swallowing something, a hiccup)
// Anchors: head, eyes (center of the eye surface), mouth (the mouth), eye (center of the eyeball), core (center of the core), crown (center of the crown, which spins with it),
//   crownGem (the gem on the front point), wound (center of the wound at the back, moving with the wound's shell plates).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, cap, lidGeometry, outline, partKit, PI, rng, slab, sphereDecal, tentacleTube, wedge, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const UP = new THREE.Vector3(0, 1, 0);

// ───────────────────────── Shell plate geometry ─────────────────────────

/** Spherical Voronoi: the cell vertices of each seed (counterclockwise seen from outside), where a vertex is the direction of the circumcenter of three adjacent seeds */
function sphereCells(seeds: THREE.Vector3[]): THREE.Vector3[][] {
  const n = seeds.length;
  const around: THREE.Vector3[][] = seeds.map(() => []);
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const nm = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        nm.crossVectors(ab.subVectors(seeds[j], seeds[i]), ac.subVectors(seeds[k], seeds[i]));
        if (nm.dot(seeds[i]) < 0) nm.negate();
        let hull = true;
        for (let m = 0; m < n && hull; m++) if (m !== i && m !== j && m !== k && d.subVectors(seeds[m], seeds[i]).dot(nm) > 1e-9) hull = false;
        if (!hull) continue;
        const c = nm.clone().normalize();
        around[i].push(c);
        around[j].push(c);
        around[k].push(c);
      }
  return around.map((pts, i) => {
    const s = seeds[i];
    const e1 = new THREE.Vector3().crossVectors(s, Math.abs(s.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize();
    const e2 = new THREE.Vector3().crossVectors(s, e1);
    const sorted = pts.map((p) => ({ p, a: Math.atan2(p.dot(e2), p.dot(e1)) })).sort((x, y) => x.a - y.a).map((x) => x.p);
    return sorted.filter((p, k) => p.distanceToSquared(sorted[(k + 1) % sorted.length]) > 1e-10);
  });
}

/** Push each edge of a spherical polygon inward by ang radians (the intersection of two adjacent edges after pushing inward) */
function insetCell(cell: THREE.Vector3[], s: THREE.Vector3, ang: number): THREE.Vector3[] {
  const n = cell.length;
  const g = Math.sin(ang);
  const ns = cell.map((c, i) => {
    const e = new THREE.Vector3().crossVectors(c, cell[(i + 1) % n]).normalize();
    return e.dot(s) < 0 ? e.negate() : e;
  });
  return cell.map((c, i) => {
    const n1 = ns[(i - 1 + n) % n];
    const n2 = ns[i];
    const x0 = n1.clone().add(n2).multiplyScalar(g / (1 + n1.dot(n2)));
    const cr = new THREE.Vector3().crossVectors(n1, n2);
    const h = Math.sqrt(Math.max(0, (1 - x0.lengthSq()) / Math.max(cr.lengthSq(), 1e-12)));
    const a = x0.clone().addScaledVector(cr, h);
    const b = x0.clone().addScaledVector(cr, -h);
    return (a.dot(c) > b.dot(c) ? a : b).normalize();
  });
}

interface PlateOpts {
  R: number;
  /** The radius the shell plate sides extend down to (inserted into the core) */
  bottom: number;
  bevel: number;
  /** Half the seam width (world units) */
  halfGap: number;
  /** Depth of the jagged teeth on the edge of a crack */
  jag: number;
  /** Eye socket: no shell plates grow within eyeA radians of this direction */
  eyeAxis: THREE.Vector3;
  eyeA: number;
  rand: () => number;
}

/** One shell plate: the outer surface (sphere normals, with shading continuous with the whole sphere), bevel slopes, and side walls inserted down into the core; the crack edges carry a little jaggedness */
function plateGeometry(s: THREE.Vector3, cell: THREE.Vector3[], o: PlateOpts): THREE.BufferGeometry {
  const clip = (u: THREE.Vector3) => {
    const c = u.dot(o.eyeAxis);
    if (c <= Math.cos(o.eyeA)) return u;
    const t = u.clone().addScaledVector(o.eyeAxis, -c).normalize();
    return o.eyeAxis.clone().multiplyScalar(Math.cos(o.eyeA)).addScaledVector(t, Math.sin(o.eyeA));
  };
  const toward = (u: THREE.Vector3, ang: number) => u.clone().applyAxisAngle(new THREE.Vector3().crossVectors(u, s).normalize(), ang);
  const P = insetCell(cell, s, o.halfGap / o.R);
  const Q = insetCell(cell, s, (o.halfGap + o.bevel) / o.R);
  const n = cell.length;
  let m = 2;
  for (let i = 0; i < n; i++) m = Math.max(m, Math.ceil(Q[i].angleTo(Q[(i + 1) % n]) / 0.07));
  const eq: THREE.Vector3[][] = [];
  const ep: THREE.Vector3[][] = [];
  for (let i = 0; i < n; i++) {
    const a: THREE.Vector3[] = [];
    const b: THREE.Vector3[] = [];
    for (let j = 0; j <= m; j++) {
      const f = j / m;
      let q = Q[i].clone().lerp(Q[(i + 1) % n], f).normalize();
      let p = P[i].clone().lerp(P[(i + 1) % n], f).normalize();
      if (j > 0 && j < m) {
        const d = (o.jag * (j % 2 ? 1 : 0.25) * (0.5 + o.rand())) / o.R;
        q = toward(q, d);
        p = toward(p, d);
      }
      a.push(clip(q));
      b.push(clip(p));
    }
    eq.push(a);
    ep.push(b);
  }

  const pos: number[] = [];
  const nor: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();
  const mid = new THREE.Vector3();
  /** out: the direction the face should face; if the smooth normals na/nb/nc are not given, the face normal is used */
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3, smooth = false) => {
    fn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    if (fn.lengthSq() < 1e-14) return;
    if (fn.dot(out) < 0) [b, c] = [c, b];
    fn.normalize();
    if (fn.dot(out) < 0) fn.negate();
    for (const v of [a, b, c]) {
      pos.push(v.x, v.y, v.z);
      if (smooth) {
        const u = v.clone().normalize();
        nor.push(u.x, u.y, u.z);
      } else nor.push(fn.x, fn.y, fn.z);
    }
  };
  const S = clip(s.clone());
  // Outer surface (material group 0): a fan from the center to each edge, subdivided and then projected back onto the sphere
  for (let i = 0; i < n; i++) {
    const edge = eq[i];
    const at = (u: number) => {
      const x = u * m;
      const j = Math.min(m - 1, Math.floor(x));
      return edge[j].clone().lerp(edge[j + 1], x - j);
    };
    const rows: THREE.Vector3[][] = [];
    for (let r = 0; r <= m; r++) {
      const row: THREE.Vector3[] = [];
      for (let j = 0; j <= r; j++) {
        const e = r === m ? edge[j] : at(r > 0 ? j / r : 0);
        row.push(clip(S.clone().multiplyScalar(1 - r / m).addScaledVector(e, r / m).normalize()).multiplyScalar(o.R));
      }
      rows.push(row);
    }
    for (let r = 0; r < m; r++)
      for (let j = 0; j <= r; j++) {
        const a = rows[r][j];
        tri(a, rows[r + 1][j], rows[r + 1][j + 1], a, true);
        if (j < r) tri(a, rows[r + 1][j + 1], rows[r][j + 1], a, true);
      }
  }
  const fanCount = pos.length / 3;
  // Bevel slopes and side walls (material group 1: a darker break face, so the seam reads as a deep groove)
  const rb = o.R - o.bevel;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const q0 = eq[i][j].clone().multiplyScalar(o.R);
      const q1 = eq[i][j + 1].clone().multiplyScalar(o.R);
      const p0 = ep[i][j].clone().multiplyScalar(rb);
      const p1 = ep[i][j + 1].clone().multiplyScalar(rb);
      const w0 = ep[i][j].clone().multiplyScalar(o.bottom);
      const w1 = ep[i][j + 1].clone().multiplyScalar(o.bottom);
      mid.copy(q0).add(q1).add(p0).add(p1).multiplyScalar(0.25);
      const outward = mid.clone().normalize().sub(S.clone().multiplyScalar(mid.clone().normalize().dot(S))).normalize();
      const bevelOut = outward.clone().add(mid.clone().normalize());
      tri(q0, q1, p1, bevelOut);
      tri(q0, p1, p0, bevelOut);
      tri(p0, p1, w1, outward);
      tri(p0, w1, w0, outward);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.addGroup(0, fanCount, 0);
  g.addGroup(fanCount, pos.length / 3 - fanCount, 1);
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildVoidchildLab(): LabModel {
  const rand = rng(20260928);

  const RIMC = 0xe6a8ff;
  const M = {
    shell: labToon(0x2e2352, { spec: 0.9, specTh: 0.9985, rim: 0.8, rimColor: RIMC }),
    cut: labToon(0x1b1331, { rim: 0 }),
    lip: labToon(0x46367a, { spec: 0.9, specTh: 0.9985, rim: 0.7, rimColor: RIMC }),
    core: labToon(0xff58b4, { ramp: 'gem', emissive: 0xd8238a, emissiveAmt: 0.9, rim: 0 }),
    sclera: labToon(0xf7f1ff, { rim: 0.2, rimColor: RIMC }),
    limbal: labToon(0x8e1c68, { ramp: 'gem', rim: 0 }),
    iris: labToon(0xff6cc4, { ramp: 'gem', emissive: 0xe0409e, emissiveAmt: 0.35, rim: 0 }),
    pupil: labToon(0x190c2a, { rim: 0 }),
    mouth: labToon(0xa01a6c, { ramp: 'gem', emissive: 0x6a0c44, emissiveAmt: 0.5, rim: 0 }),
    fang: labToon(0xf6eefc, { rim: 0.3 }),
    gold: labToon(0xe2ad48, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6, rimColor: 0xffe2a8 }),
    goldDk: labToon(0xba8a33, { ramp: 'metal', spec: 1.2, specTh: 0.9, rim: 0.5, rimColor: 0xffe2a8 }),
    gem: labToon(0xff86d2, { ramp: 'gem', emissive: 0xd8338e, emissiveAmt: 0.5, spec: 1.4, specTh: 0.88, rim: 0.6 }),
    tent: labToon(0x3a2a62, { rim: 0.75, rimColor: RIMC }),
    tip: labToon(0xff5fb8, { ramp: 'gem', emissive: 0xd0247f, emissiveAmt: 0.75, rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'voidchild-lab';
  const { add, group } = partKit();

  const R = 0.4;
  const CY = 0.95;
  const body = group(root, [0, CY, 0]);

  // ── Core and shell plates ──
  const coreMesh = add(body, new THREE.SphereGeometry(R - 0.032, 48, 32), M.core);
  const TILT = 0.12;
  const EYE = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));
  const EYE_A = 0.64;
  const seeds: THREE.Vector3[] = [];
  const N = 30;
  for (let i = 0; i < N; i++) {
    const y = 1 - ((i + 0.5) / N) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996 + 0.4;
    const d = new THREE.Vector3(Math.cos(a) * r + (rand() - 0.5) * 0.18, y + (rand() - 0.5) * 0.18, Math.sin(a) * r + (rand() - 0.5) * 0.18).normalize();
    if (d.angleTo(EYE) > EYE_A + 0.14) seeds.push(d);
  }
  // A ring of seeds is added around the eye socket, so the shell plates arrange themselves around the eye
  const eyeQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), EYE);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2 + 0.2;
    seeds.push(new THREE.Vector3(Math.cos(a) * Math.sin(EYE_A + 0.3), Math.sin(a) * Math.sin(EYE_A + 0.3), Math.cos(EYE_A + 0.3)).applyQuaternion(eyeQ).normalize());
  }
  const cells = sphereCells(seeds);
  const plates: { g: THREE.Object3D; dir: THREE.Vector3; lift: number; phase: number }[] = [];
  // All the shell plates (for the shell burst): each one's direction, flip axis and opening distance (computed from the index, without touching the rand sequence, so the shape does not change)
  const shell: { g: THREE.Object3D; dir: THREE.Vector3; axis: THREE.Vector3; q0: THREE.Quaternion; out: number; tip: number; wound: number }[] = [];
  let wound = 0;
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    if (s.angleTo(EYE) < EYE_A + 0.05) continue;
    // The upper back is the wound: the seams are wider and two shell plates tilt up
    const back = Math.max(0, -s.z) * Math.max(0, s.y + 0.3);
    const geo = plateGeometry(s, cells[i], {
      R,
      bottom: R - 0.05,
      bevel: 0.012,
      halfGap: 0.0078 + back * 0.012,
      jag: 0.004 + back * 0.006,
      eyeAxis: EYE,
      eyeA: EYE_A,
      rand,
    });
    const pg = group(body);
    add(pg, geo, [M.shell, M.cut] as unknown as THREE.Material);
    if (back > 0.35 && wound < 2) {
      wound++;
      const lift = 0.035 + wound * 0.02;
      pg.position.copy(s).multiplyScalar(lift);
      const ax = new THREE.Vector3().crossVectors(s, UP).normalize();
      pg.quaternion.setFromAxisAngle(ax, 0.1 * (wound % 2 ? 1 : -1));
      plates.push({ g: pg, dir: s, lift, phase: wound * 1.7 });
    }
    const hsh = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
    const hr = hsh - Math.floor(hsh);
    shell.push({
      g: pg,
      dir: s.clone(),
      axis: new THREE.Vector3().crossVectors(s, Math.abs(s.y) < 0.95 ? UP : new THREE.Vector3(1, 0, 0)).normalize(),
      q0: pg.quaternion.clone(),
      out: 0.19 + hr * 0.1,
      tip: (hr - 0.5) * 0.9,
      wound: plates.length && plates[plates.length - 1].g === pg ? plates.length : 0,
    });
  }
  const woundDir = plates.reduce((a, p) => a.add(p.dir), new THREE.Vector3()).normalize();
  // Fragments drifting away from the wound
  const shards: { g: THREE.Group; base: THREE.Vector3; dir: THREE.Vector3; phase: number }[] = [];
  const shardShapes: [number, number][][] = [
    [[-0.04, -0.025], [0.045, -0.02], [0.01, 0.045]],
    [[-0.03, -0.02], [0.03, -0.028], [0.034, 0.018], [-0.01, 0.034]],
    [[-0.025, -0.02], [0.028, -0.012], [-0.004, 0.03]],
  ];
  for (let i = 0; i < 3; i++) {
    const dir = new THREE.Vector3(-0.3 + i * 0.32, 0.45 + (i % 2) * 0.12, -0.84).normalize();
    const base = dir.clone().multiplyScalar(R + 0.1 + i * 0.045);
    const g = group(body, [base.x, base.y, base.z]);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    g.rotateZ(i * 1.3);
    add(g, slab(outline(shardShapes[i]), 0.018, 0.006, 2), M.shell);
    shards.push({ g, base, dir, phase: i * 2.1 });
  }

  // ── Big eye ──
  const EC = 0.13;
  const ER = Math.hypot(R * Math.sin(EYE_A), R * Math.cos(EYE_A) - EC);
  const socket = group(body, [0, 0, 0], [-TILT, 0, 0]);
  add(socket, new THREE.TorusGeometry(R * Math.sin(EYE_A) + 0.004, 0.027, 14, 72), M.lip, [0, 0, R * Math.cos(EYE_A) - 0.004]);
  const eyeC = group(socket, [0, 0, EC]);
  const eye = group(eyeC);
  // The sclera keeps only the front spherical cap, with a ring of dark around the outside, so no white shows through when looking in through the seams between shell plates
  add(eye, cap(ER, 0.93), M.sclera);
  add(eye, new THREE.SphereGeometry(ER, 48, 6, 0, PI * 2, 0.9, 0.3).rotateX(PI / 2), M.cut);
  add(eye, cap(ER + 0.003, 0.5), M.limbal);
  add(eye, cap(ER + 0.006, 0.44), M.iris);
  const slit: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const v = -0.3 + (i / 12) * 0.6;
    slit.push([0.07 * Math.pow(1 - (v / 0.3) ** 2, 0.75), v]);
  }
  for (let i = 11; i >= 1; i--) slit.push([-slit[i][0], slit[i][1]]);
  const pupil = add(eye, sphereDecal(slit, ER + 0.009), M.pupil);
  // Eye highlights: entirely inside the iris and turning with the eyeball, so outline lines do not cross them; not in the outline layer
  for (const [lon, lat, r] of [[-0.2, 0.19, 0.032], [0.19, -0.2, 0.015]] as [number, number, number][]) {
    const d = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
    const hl = add(eye, new THREE.SphereGeometry(r, 16, 10), M.hi, [d.x * (ER + 0.012), d.y * (ER + 0.012), d.z * (ER + 0.012)], [0, 0, 0], [1, 1, 0.45]);
    hl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
  }
  // Eyelids: the upper eyelid covers down to the top edge of the iris and tilts to one side (a raised brow); the lower eyelid covers only a little, as if smiling
  const upperPivot = group(eyeC, [0, 0, 0], [0, 0, 0.12]);
  const upper = group(upperPivot);
  // The shell's axis tilts forward by 0.11, with the front edge stopping at 1.02 and the back edge only reaching -0.8: when a blink turns all the way down the back edge just fills in the top edge of the eye, and does not poke out of the shell through the top of the head
  add(upper, lidGeometry(ER + 0.01, ER + 0.036, 0.91), M.shell, [0, 0, 0], [0.11, 0, 0]);
  const lower = group(eyeC, [0, 0, 0], [PI, 0, -0.06]);
  add(lower, lidGeometry(ER + 0.01, ER + 0.03, 0.8), M.shell);

  // ── Mouth: a grinning jagged mouth below the eye, with two small fangs ──
  const ML = -0.72;
  const mouthPts: [number, number][] = [
    [-0.44, 0.04], [-0.3, 0.0], [-0.15, 0.03], [0, -0.01], [0.15, 0.03], [0.3, 0.0], [0.44, 0.04],
    [0.34, -0.07], [0.17, -0.13], [0, -0.15], [-0.17, -0.13], [-0.34, -0.07],
  ];
  // The mouth and fangs are in the same group: during the shell burst they are pushed outward along with the shell plates
  const MOUTH_DIR = new THREE.Vector3(0, Math.sin(ML), Math.cos(ML));
  const mouthG = group(body);
  add(mouthG, sphereDecal(mouthPts, R + 0.004, ML), M.mouth);
  for (const lon of [-0.22, 0.22]) {
    const lat = ML + 0.012;
    const p = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(R + 0.006);
    const down = new THREE.Vector3(Math.sin(lat) * Math.sin(lon), -Math.cos(lat), Math.sin(lat) * Math.cos(lon)).normalize();
    const f = add(mouthG, new THREE.ConeGeometry(0.02, 0.06, 10), M.fang, [p.x + down.x * 0.03, p.y + down.y * 0.03, p.z + down.z * 0.03]);
    f.quaternion.setFromUnitVectors(UP, down);
  }

  // ── Broken crown: worn crooked, a gold ring in three broken pieces, the tallest point at the front set with a magenta gem and the two at the back snapped off, with fragments floating above the break ──
  const crown = group(body, [0.05, R * 0.86, -0.01], [0.1, 0, -0.24]);
  const CROWN_Y = crown.position.y;
  // All the crown's parts are in spinG: when the broken crown spins, it spins about the crown's own axis (the crown itself is still worn crooked)
  const spinG = group(crown);
  const rIn = 0.158;
  const rOut = 0.184;
  for (const [a0, a1] of [[3.35, 5.95], [0.35, 1.75], [2.0, 3.05]]) {
    const band = slab(wedge(rIn, rOut, a0, a1), 0.05, 0.007, 24);
    band.rotateX(-PI / 2);
    add(spinG, band, M.gold, [0, 0.03, 0]);
  }
  const gemAt: { g: THREE.Group | null } = { g: null };
  const spike = (a: number, h: number, broken: boolean, gem = false) => {
    const dir = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const g = group(spinG, [dir.x * (rIn + rOut) * 0.5, 0.05, dir.z * (rIn + rOut) * 0.5], [0, Math.atan2(Math.cos(a), -Math.sin(a)), 0]);
    const w = 0.04;
    const pts: [number, number][] = broken
      ? [[-w, 0], [w, 0], [w * 0.8, h * 0.62], [w * 0.2, h * 0.45], [-w * 0.3, h * 0.72], [-w * 0.85, h * 0.55]]
      : [[-w, 0], [w, 0], [w * 0.36, h * 0.55], [0, h], [-w * 0.36, h * 0.55]];
    add(g, slab(outline(pts), 0.016, 0.006, 2), M.gold);
    if (gem) {
      add(g, brilliant(0.024, 0.014, 0.018, 8), M.gem, [0, h * 0.34, 0.016], [PI / 2, 0, 0]);
      gemAt.g = group(g, [0, h * 0.34, 0.03]);
    }
  };
  spike(-PI / 2 + 2 * PI, 0.2, false, true);
  spike(4.71 - 0.8, 0.14, false);
  spike(4.71 + 0.8, 0.15, false);
  spike(1.1, 0.12, true);
  spike(2.5, 0.1, true);
  const crownShards: { g: THREE.Group; base: number; phase: number }[] = [];
  for (const [a, y, i] of [[1.1, 0.26, 0], [2.5, 0.22, 1]] as [number, number, number][]) {
    const dir = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const g = group(spinG, [dir.x * 0.19, y, dir.z * 0.19], [0.3 + i * 0.4, a, 0.4 - i * 0.7]);
    add(g, slab(outline([[-0.026, 0], [0.024, 0], [0.012, 0.05], [-0.01, 0.04]]), 0.014, 0.005, 2), M.goldDk);
    crownShards.push({ g, base: y, phase: i * 1.9 });
  }

  // ── Shadow tentacles: six extending from beneath the body, curling up at the ends, with a point of magenta light at each tip; the one at the front right reaches forward ──
  interface Tent {
    mesh: THREE.Mesh;
    tube: ReturnType<typeof tentacleTube>;
    bulb: THREE.Mesh;
    phase: number;
    lift: number;
    amp: number;
  }
  const tents: Tent[] = [];
  const tentSpec: [number, number, number, number][] = [
    // Azimuth (from +z toward +x), length ratio, curl, lift
    [0.55, 1.08, 0.2, 0.32],
    [-0.6, 0.9, 1.0, 0],
    [1.65, 1.0, 0.8, 0],
    [-1.7, 1.0, 0.85, 0],
    [2.6, 0.95, 1.0, 0],
    [-2.55, 0.92, 0.9, 0],
  ];
  for (let i = 0; i < tentSpec.length; i++) {
    const [az, len, curl, lift] = tentSpec[i];
    const el = -0.98;
    const rootP = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(R * 0.8);
    const g = group(body, [rootP.x, rootP.y, rootP.z], [0, Math.atan2(-Math.cos(az), Math.sin(az)), 0]);
    const L = 0.44 * len;
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(L * 0.1, -0.11, 0),
      new THREE.Vector3(L * 0.34, -0.2, 0.02),
      new THREE.Vector3(L * 0.62, -0.24 + lift * 0.1, -0.01),
      new THREE.Vector3(L * 0.86, -0.2 + lift * 0.16 + curl * 0.02, 0),
      new THREE.Vector3(L * (0.98 - curl * 0.06), -0.13 + lift * 0.2 + curl * 0.06, 0.01),
      new THREE.Vector3(L * (0.96 - curl * 0.16), -0.07 + lift * 0.2 + curl * 0.08, 0.02),
    ];
    const tube = tentacleTube(pts, (t) => 0.072 * Math.pow(1 - t, 0.85) + 0.013);
    const mesh = add(g, tube.geo, M.tent);
    const bulb = add(g, new THREE.SphereGeometry(0.02, 14, 10), M.tip, [tube.tip.x, tube.tip.y, tube.tip.z]);
    tents.push({ mesh, tube, bulb, phase: i * 1.37, lift, amp: 0.11 + (i % 3) * 0.03 });
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: floating, slowly looking around, blinking, the tentacles swaying lightly, the crown wobbling slightly, the shell plates and fragments of the wound floating, the core flickering faintly ──
  // The performance's action weights (see the header's <Action weights>): with all at 0 it is exactly the same as idle
  const act = { glare: 0, crown: 0, open: 0, glow: 0, collapse: 0, squint: 0 };
  const q = new THREE.Quaternion();
  const qa = new THREE.Quaternion();
  const zA = new THREE.Vector3(0, 0, 1);
  const yA = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  let blinkIn = 2.4;
  let blinkT = -1;
  /** The crown's spin angle (the larger the crown weight the faster the spin; when the weight returns to zero it turns back to the nearest full turn) */
  let spin = 0;
  /** The extra phase the tentacles advance during the shell burst (swaying faster) */
  let tentPhase = 0;
  let lastGlare = -1;
  let lastTip = -1;
  const irisEm = M.iris.emissiveIntensity;
  const tipEm = M.tip.emissiveIntensity;
  const update = (t: number, dt: number) => {
    const { glare, crown: crownAct, open, glow, collapse, squint } = act;
    const ob = open > 0 ? open : 0;
    body.position.y = CY + Math.sin(t * 1.1) * 0.016;
    body.rotation.z = Math.sin(t * 0.7) * 0.03;
    body.rotation.x = Math.sin(t * 0.53) * 0.02;
    // Stare: no longer looks around, looks straight ahead
    const look = 1 - glare;
    eye.rotation.y = (Math.sin(t * 0.37) * 0.13 + Math.sin(t * 1.13) * 0.02) * look;
    eye.rotation.x = (-0.07 + Math.sin(t * 0.61) * 0.04) * look;
    eye.scale.setScalar(1 + glare * 0.07);
    pupil.scale.set((1 - glare * 0.5) * (1 + glare * 0.012), 1 + glare * 0.012, 1 + glare * 0.012);
    socket.position.copy(EYE).multiplyScalar(ob * 0.17);

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.6 + ((t * 7.3) % 3);
    }
    let close = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.24;
      close = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.35) : 0;
      if (k >= 1) blinkT = -1;
    }
    // No blinking while staring, with the upper eyelid lifted high; closes halfway when squinting
    upper.rotation.x = close * 1.42 * look - glare * 0.3 + squint * 0.75;

    crown.rotation.z = -0.24 * (1 - crownAct * 0.35) + Math.sin(t * 0.9) * 0.025;
    crown.rotation.x = 0.1 + Math.sin(t * 0.7 + 1) * 0.02;
    // During the shell burst the crown rises together with the shell plates on top, so it is not covered by them
    crown.position.y = CROWN_Y + crownAct * 0.1 + ob * 0.2 + Math.sin(t * 7) * 0.006 * crownAct;
    if (crownAct > 0.001) spin += dt * crownAct * 14;
    else if (spin !== 0) {
      const home = Math.round(spin / (PI * 2)) * PI * 2;
      spin += (home - spin) * Math.min(1, dt * 5);
      if (Math.abs(home - spin) < 1e-3) spin = 0;
    }
    spinG.rotation.y = spin;
    for (const s of crownShards) s.g.position.y = s.base + Math.sin(t * 1.4 + s.phase) * 0.012 + crownAct * (0.06 + s.phase * 0.02);

    // Shell burst: each shell plate drifts apart along its own direction and flips a little about its own axis; the wound's shell plates go further out from their originally tilted-up positions
    for (const sp of shell) {
      const w = sp.wound ? plates[sp.wound - 1] : null;
      const base = w ? w.lift + Math.sin(t * 1.2 + w.phase) * 0.008 : 0;
      const drift = ob * (sp.out + Math.sin(t * 2.3 + sp.tip * 7) * 0.012);
      sp.g.position.copy(sp.dir).multiplyScalar(base + drift);
      sp.g.quaternion.copy(sp.q0);
      if (ob > 0) sp.g.quaternion.premultiply(qa.setFromAxisAngle(sp.axis, ob * sp.tip * 0.5));
    }
    for (const s of shards) s.g.position.copy(s.base).addScaledVector(s.dir, Math.sin(t * 0.9 + s.phase) * 0.02 + ob * 0.3);
    mouthG.position.copy(MOUTH_DIR).multiplyScalar(ob * 0.16);
    // Core: flickers faintly when idle; glow makes it brighten and collapse makes it shrink to a small point
    coreMesh.scale.setScalar(1 - collapse * 0.62);
    M.core.emissiveIntensity = 0.9 + Math.sin(t * 1.5) * 0.07 + glow * 1.1;
    // Other materials are written only when the weight changes, so other spirits' ultimates that change these materials are not overwritten every frame
    if (glare !== lastGlare) {
      lastGlare = glare;
      M.iris.emissiveIntensity = irisEm + glare * 0.6;
    }
    if (glow !== lastTip) {
      lastTip = glow;
      M.tip.emissiveIntensity = tipEm + glow * 0.8;
    }

    tentPhase += dt * ob * 2.2;
    const tAmp = 1 + ob * 1.2;
    for (const tn of tents) {
      const pa = tn.tube.geo.attributes.position as THREE.BufferAttribute;
      const na = tn.tube.geo.attributes.normal as THREE.BufferAttribute;
      const arr = pa.array as Float32Array;
      const narr = na.array as Float32Array;
      const { rest, restN, t: tt } = tn.tube;
      const tp = t + tentPhase;
      let lastT = -1;
      for (let i = 0; i < tt.length; i++) {
        const s = tt[i];
        if (s !== lastT) {
          const bend = Math.sin(tp * 1.25 + tn.phase - s * 2.4) * tn.amp * tAmp * Math.pow(s, 1.3) + tn.lift * 0.15 * Math.sin(tp * 0.8 + tn.phase) * s;
          const sway = Math.sin(tp * 0.9 + tn.phase * 1.7 - s * 1.8) * 0.12 * tAmp * s;
          q.setFromAxisAngle(yA, sway).multiply(qa.setFromAxisAngle(zA, bend));
          lastT = s;
        }
        v.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]).applyQuaternion(q);
        arr[i * 3] = v.x;
        arr[i * 3 + 1] = v.y;
        arr[i * 3 + 2] = v.z;
        v.set(restN[i * 3], restN[i * 3 + 1], restN[i * 3 + 2]).applyQuaternion(q);
        narr[i * 3] = v.x;
        narr[i * 3 + 1] = v.y;
        narr[i * 3 + 2] = v.z;
      }
      pa.needsUpdate = true;
      na.needsUpdate = true;
      tn.bulb.position.copy(tn.tube.tip).applyQuaternion(q);
    }
  };
  update(0, 0);

  // Voidchild has no head, and the face is that one big eye: the framing and the eye-light both aim at the eye, and the mouth is on the sphere below the eye
  const face = group(eyeC, [0, 0, ER]);
  const mouthAt = MOUTH_DIR.clone().multiplyScalar(R);
  const anchors = {
    mouth: group(mouthG, [mouthAt.x, mouthAt.y, mouthAt.z]),
    eye: group(eyeC),
    core: group(body),
    crown: group(spinG, [0, 0.1, 0]),
    crownGem: gemAt.g ?? group(spinG, [0, 0.15, 0.17]),
    wound: group(body, woundDir.clone().multiplyScalar(R + 0.04).toArray() as [number, number, number]),
  };
  const rig = { head: face, eyes: [group(eyeC, [0, 0, ER])], anchors };
  return { root, update, act, rig, center: new THREE.Vector3(0, 0.9, 0), radius: 0.72 };
}
