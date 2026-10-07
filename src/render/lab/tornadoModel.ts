// Eye of the Gale (model lab version, SR, wind + thunder): the plateau's biggest storm every spring, with a spirit floating quietly at its center.
// The Wingfolk dare not come near, yet entrust their most important letters to the gale to carry away. It has never lost a single one.
// Only one form (decided by the user, 2026-09-28): the builder ignores the breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Body shape: it is the storm itself, with no face and no features. A hurricane stood upright and facing the camera: the silhouette is the hurricane symbol from a weather map,
// a ring of eyewall plus two big cloud arms curling outward; the eyewall encloses an "eye" you can see through from front to back, and in the very center of the eye floats a clear-sky-colored light core that does not move at all, and that is it.
// Identifying features:
//   1. The eye: a thick eyewall ring with cloud puffs rising and falling, its inner wall darkening all the way to the bottom of the eye, enclosing a see-through round hole; at the very center of the hole is a clear-sky-colored light core (the brightest and highest-contrast thing on the body).
//      Visible through from both front and back, showing the core and the letters.
//   2. Letters: three cream envelopes slowly circle the core inside the eye, the front showing the flap and amber wax seal, and the back a slate blue Wingfolk stamp in one corner. However wild it is outside, not one letter in the eye drops.
//   3. Two spiral cloud arms: growing from the outer edge of the eyewall and curling outward, thick at the head and pointed at the tail, with clouds of varying sizes along the outer edge; the tails trail behind (the wind blows backward), and from the side they look like a hook.
//      The color scheme is the blue-gray of a spring plateau thunderstorm: only the tops of the cloud puffs are white, between the puffs and on the side edges is blue-gray, and the inner wall of the eyewall is deep teal, kept distinct from the blue-purple-gray of Thunderbird.
//   4. Thunder: two pale gold lightning bolts dart outward following the wind flow of the cloud arms, and flicker.
// Personality: the quietest postman at the center of the storm. The faster the clouds outside spin, the more the core in the middle does not move at all; it shelters the entrusted letters in the eye and never looks back.
// Emotion comes entirely from motion and light: the spin speed of the cloud arms, the flicker of the core, how near or far the letters are, the frequency of the lightning.
// Gaze order: the core of the eye first, the letters circling the core second, and the spiral cloud arms and lightning as support.
// Back speaks of "the Wingfolk dare not come near, yet entrust their letters to it": from behind you can see through the eye just the same, and see the Wingfolk stamp on the back of the letters;
// two Wingfolk flight feathers with slate blue crossbars are stuck on the cloud arms at the back (someone tried to come near, and the wind kept the feathers).
// Restrained light effects: the emissive is only the core and the two lightning bolts, with no bloom; the clouds are solid toon clouds, not translucent mist shells.
//
// <Action table> (act weights: gust 0-1, glow core lights up 0-1, flash lightning flash 0-1)
//   Idle: the whole cloud floats gently up and down and sways slightly, the cloud arms turn slowly and the eyewall turns somewhat faster, the core does not move and only slowly flickers,
//         the letters slowly circle the core, each turning over lightly, and the lightning flashes now and then.
//   Move: the whole mass leans forward and the spin speeds up.
//   Charge-up (gust): the cloud arms and eyewall spin faster and faster, the cloud arms spread outward, and the letters draw in toward the core; glow brightens the core.
//   Strike: a gust blows out of the eye (the core anchor), and flash lights the lightning.
//   Hit: the cloud mass tilts and its spin goes erratic for a moment, the core still does not move, and the letters shrink in beside the core.
//   Victory: slowly comes to a stop, and the three letters line up in a row in front of the core.
// Anchors: head (front edge of the core), core (center of the core), mail (the first letter), bolt (lightning tip), eyeTop (top of the eyewall). No eyes or mouth.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { lathe, mergeStatic, outline, partKit, PI, rbox, slab, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type Vec = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// ───────────────────────── Geometry helpers ─────────────────────────

/**
 * Grid surface: P is a rows × cols grid of points, with the cols direction wrapping around (when wrapRows is true the rows wrap too, making a donut).
 * A row that shrinks to a point keeps only one vertex; winding is decided by signed volume, always facing outward; vertices at the same position average their normals.
 * Returns the geometry and each vertex's (row, column).
 */
function gridGeo(P: Vec[][], wrapRows = false): { geo: THREE.BufferGeometry; ij: number[] } {
  const rows = P.length;
  const cols = P[0].length;
  const pos: number[] = [];
  const ij: number[] = [];
  const id: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const r = P[i];
    let pole = true;
    for (let j = 1; j < cols && pole; j++) if (r[j].distanceToSquared(r[0]) > 1e-12) pole = false;
    const ids: number[] = [];
    for (let j = 0; j < cols; j++) {
      if (pole && j > 0) {
        ids.push(ids[0]);
        continue;
      }
      ids.push(pos.length / 3);
      pos.push(r[j].x, r[j].y, r[j].z);
      ij.push(i, j);
    }
    id.push(ids);
  }
  const idx: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  };
  const rn = wrapRows ? rows : rows - 1;
  for (let i = 0; i < rn; i++) {
    const i1 = (i + 1) % rows;
    for (let j = 0; j < cols; j++) {
      const j1 = (j + 1) % cols;
      tri(id[i][j], id[i1][j], id[i][j1]);
      tri(id[i1][j], id[i1][j1], id[i][j1]);
    }
  }
  const A = v3();
  const B = v3();
  const C = v3();
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    A.fromArray(pos, idx[k] * 3);
    B.fromArray(pos, idx[k + 1] * 3);
    C.fromArray(pos, idx[k + 2] * 3);
    vol += A.dot(B.cross(C));
  }
  if (vol < 0) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  weld(g);
  return { geo: g, ij };
}

/** Vertices at the same position average their normals (so the seam has no extra crease) */
function weld(g: THREE.BufferGeometry): void {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const buckets = new Map<string, number[]>();
  for (let k = 0; k < pa.count; k++) {
    const key = `${Math.round(pa.getX(k) * 1e5)},${Math.round(pa.getY(k) * 1e5)},${Math.round(pa.getZ(k) * 1e5)}`;
    const b = buckets.get(key);
    if (b) b.push(k);
    else buckets.set(key, [k]);
  }
  const n = v3();
  const m = v3();
  for (const b of buckets.values()) {
    if (b.length < 2) continue;
    n.set(0, 0, 0);
    for (const k of b) n.add(m.fromBufferAttribute(na, k));
    n.normalize();
    for (const k of b) na.setXYZ(k, n.x, n.y, n.z);
  }
}

interface Frame {
  C: Vec;
  T: Vec;
  W: Vec;
  H: Vec;
}

/**
 * Loft along a curve: prof(t) = [width radius, height radius, height-direction offset], the width direction W is decided by side(t, tangent), and the height direction H = tangent × W.
 * off can further displace each point of the cross-section (cloud puff undulation).
 */
function sweep(
  pts: Vec[],
  prof: (t: number) => number[],
  o: { segs: number; radial: number; side?: (t: number, T: Vec) => Vec; off?: (t: number, th: number, x: number, y: number) => [number, number] },
): { P: Vec[][]; F: Frame[] } {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const P: Vec[][] = [];
  const F: Frame[] = [];
  for (let i = 0; i <= o.segs; i++) {
    const t = i / o.segs;
    const C = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const s = o.side ? o.side(t, T) : v3(1, 0, 0);
    const W = s.clone().addScaledVector(T, -T.dot(s)).normalize();
    const H = v3().crossVectors(T, W).normalize();
    const [a, b, dh = 0] = prof(t);
    const row: Vec[] = [];
    for (let j = 0; j < o.radial; j++) {
      const th = (j / o.radial) * PI * 2;
      let x = Math.cos(th) * a;
      let y = Math.sin(th) * b;
      if (o.off && (a > 0 || b > 0)) [x, y] = o.off(t, th, x, y);
      row.push(C.clone().addScaledVector(W, x).addScaledVector(H, y + dh));
    }
    P.push(row);
    F.push({ C, T, W, H });
  }
  return { P, F };
}

/** Smooth interpolation of a cross-section table [t, value...]; both ends are closed into round caps with circular arcs */
const tabProf = (tab: number[][]) => (t: number) => {
  let i = 0;
  while (i < tab.length - 2 && t > tab[i + 1][0]) i++;
  const r0 = tab[i];
  const r1 = tab[i + 1];
  const u = (t - r0[0]) / (r1[0] - r0[0]);
  const s = u * u * (3 - 2 * u);
  const out: number[] = [];
  for (let k = 1; k < r0.length; k++) {
    if (i === 0 && r0[k] === 0) out.push(r1[k] * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))));
    else if (i === tab.length - 2 && r1[k] === 0) out.push(r0[k] * Math.sqrt(Math.max(0, 1 - u * u)));
    else out.push(r0[k] + (r1[k] - r0[k]) * s);
  }
  return out;
};

/** Color by vertex (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (k: number, p: Vec, n: Vec) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = v3();
  const N = v3();
  for (let k = 0; k < pa.count; k++) {
    const c = f(k, P.fromBufferAttribute(pa, k), N.fromBufferAttribute(na, k));
    out[k * 3] = c.r;
    out[k * 3 + 1] = c.g;
    out[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}
const tint = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const cc = col(c);
  return paint(g, () => cc);
};

// ───────────────────────── Shape ─────────────────────────

export function buildTornadoLab(): LabModel {
  // The blue-gray of a spring plateau thunderstorm: cloud-puff tops white, blue-gray between puffs, eyewall inner wall deep teal; the core is clear-sky blue-white; the letters are cream with amber wax seals; the lightning is pale gold
  const TOP = col(0xf4f8f6);
  const MID = col(0xa7babd);
  const LOW = col(0x667d85);
  const DEEP = col(0x3a4d56);
  const HOLE = col(0x22323a);
  const PAPER = col(0xf3e9d0);
  const FLAP = col(0xe2d3b0);
  const WAX = col(0xc9782a);

  const vc = <T extends THREE.MeshToonMaterial>(m: T) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    cloud: vc(labToon(0xffffff, { rim: 0.55, rimColor: 0xe6fff5 })),
    wall: vc(labToon(0xffffff, { rim: 0.55, rimColor: 0xe6fff5 })),
    core: vc(labToon(0xffffff, { ramp: 'gem', emissive: 0x9fd6ff, emissiveAmt: 0.55, rim: 0.3, rimColor: 0xffffff })),
    paper: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xfff4dc })),
    bolt: labToon(0xffe27a, { ramp: 'gem', emissive: 0xffc93a, emissiveAmt: 0.55, rim: 0.3, rimColor: 0xfff6c8 }),
    feather: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xffffff })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'tornado-lab';
  const { add, group } = partKit();

  // The whole hurricane stands upright facing the camera: local +y is the storm's axis, and after turning about x by TILT (about 75 degrees) the axis faces forward and slightly up, with the front facing straight into the eye
  // The center is high enough off the ground that the lowest point is still above 15% of the full height: the game treats it as a floating type (bobbing up and down, flying off the ground in the wild)
  const CY = 1.44;
  const TILT = 1.3;
  const float = group(root, [0, 0, 0]);
  const storm = group(float, [0, CY, 0], [TILT, 0, 0]);
  const spin = group(storm);
  const wallG = group(storm);
  const eye = group(storm);

  // ── Eyewall: a thick ring of cloud with puffs rising and falling, a steep inner wall and an outer edge sloping down, enclosing a see-through eye ──
  const R_W = 0.44;
  const WA = 0.12;
  const WB = 0.24;
  const LOBES_W = 9;
  {
    const NR = LOBES_W * 12;
    const NC = 26;
    const P: Vec[][] = [];
    const lobe = (a: number) => Math.pow(Math.abs(Math.cos((a * LOBES_W) / 2)), 0.6);
    for (let i = 0; i < NR; i++) {
      const a = (i / NR) * PI * 2;
      const L = lobe(a);
      const row: Vec[] = [];
      for (let j = 0; j < NC; j++) {
        const ph = (j / NC) * PI * 2;
        const c = Math.cos(ph);
        const s = Math.sin(ph);
        // The outer side (c>0) and the front and back faces have cloud puff undulation, while the inner wall is smooth; the eye opening at the front flares outward a little (so you can see into the depths of the eye)
        const out = c > 0 ? 1 + 0.16 * L * c : 1 - 0.12 * c * c;
        let r = R_W + WA * c * out;
        const y = WB * s * (1 + 0.22 * L * Math.abs(s));
        if (c < 0 && s > 0) r += 0.05 * s * -c;
        r += 0.015 * L;
        row.push(v3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      P.push(row);
    }
    const { geo, ij } = gridGeo(P, true);
    paint(geo, (k, _p, n) => {
      const i = ij[k * 2];
      const ph = (ij[k * 2 + 1] / NC) * PI * 2;
      const L = lobe((i / NR) * PI * 2);
      const face = Math.abs(n.y);
      // Front and back faces: puff tops bright and one step darker between puffs; the outer edge blue-gray; the inner wall darkening all the way to the bottom of the eye, setting off the core
      const c = LOW.clone().lerp(MID, sstep(0.15, 0.6, face)).lerp(TOP, sstep(0.6, 0.95, face) * sstep(0.3, 0.85, L));
      const inner = sstep(0.2, -0.75, Math.cos(ph));
      return c.lerp(DEEP, inner * (1 - sstep(0.75, 0.98, face) * 0.6)).lerp(HOLE, sstep(-0.6, -0.95, Math.cos(ph)) * 0.8);
    });
    add(wallG, geo, M.wall);
  }

  // ── Spiral cloud arms: growing from the outer edge of the eyewall, curling outward, thick at the head and pointed at the tail, with puffs of cloud rising and falling along the outer edge and on the front and back faces ──
  // Two big cloud arms (the two hooks of the hurricane symbol), leaving a visible gap between arms, so the silhouette is a vortex and not a donut
  const ARMS = 2;
  const R_IN = R_W + 0.07;
  const R_OUT = 1.02;
  const SWEEP = 3.5;
  const armTab: number[][] = [
    [0, 0, 0, 0],
    [0.05, 0.12, 0.15, 0],
    [0.14, 0.16, 0.19, 0],
    [0.36, 0.155, 0.17, 0],
    [0.6, 0.12, 0.12, 0],
    [0.84, 0.07, 0.07, 0],
    [1, 0, 0, 0],
  ];
  const armProf = tabProf(armTab);
  // The puffs vary in size: a main rhythm of seven puffs, then a slow sine makes some large and some small
  const LOBES_A = 7;
  const armLobe = (s: number) => Math.pow(Math.abs(Math.cos(PI * LOBES_A * s + 0.3)), 0.5) * (0.72 + 0.28 * Math.sin(PI * 3.3 * s + 1));
  const boltSpots: { pos: Vec; out: Vec; T: Vec }[] = [];
  const featherSpots: { pos: Vec; out: Vec; T: Vec }[] = [];
  for (let k = 0; k < ARMS; k++) {
    const th0 = (k / ARMS) * PI * 2 + 0.3;
    // The tails of the cloud arms trail behind (the wind blows backward), and from the side they are an arc, not a flat disc
    const warp = -0.45;
    const NP = 16;
    const pts: Vec[] = [];
    for (let i = 0; i <= NP; i++) {
      const s = i / NP;
      const r = R_IN + (R_OUT - R_IN) * Math.pow(s, 1.1);
      const th = th0 + s * SWEEP;
      pts.push(v3(r * Math.cos(th), warp * Math.pow(s, 1.8), r * Math.sin(th)));
    }
    const SEGS = 150;
    const RAD = 20;
    const sw = sweep(pts, armProf, {
      segs: SEGS,
      radial: RAD,
      side: (_t, T) => v3().crossVectors(v3(0, 1, 0), T),
      off: (t, th, x, y) => {
        const L = armLobe(t);
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const xo = x * (1 + (c > 0 ? 0.55 * L * c : 0.14 * L));
        const yo = y * (1 + 0.4 * L * Math.abs(sn));
        return [xo, yo];
      },
    });
    const { geo, ij } = gridGeo(sw.P);
    paint(geo, (q, _p, n) => {
      const s = ij[q * 2] / SEGS;
      const face = Math.abs(n.y);
      const L = armLobe(s);
      // Only the puff tops are white; between puffs and on the side edges of the cloud arms is blue-gray; the nearer the tail, the thinner and darker the cloud
      const crest = sstep(0.45, 0.9, face) * sstep(0.3, 0.85, L) * (1 - sstep(0.6, 0.95, s) * 0.6);
      const c = DEEP.clone().lerp(LOW, sstep(-0.2, 0.3, face)).lerp(MID, sstep(0.3, 0.75, face)).lerp(TOP, crest);
      return c.lerp(LOW, sstep(0.7, 1, s) * 0.4 * (1 - crest));
    });
    add(spin, geo, M.cloud);
    const at = (s: number) => sw.F[Math.round(s * SEGS)];
    {
      const sb = k === 0 ? 0.5 : 0.62;
      const f = at(sb);
      const [a] = armProf(sb);
      boltSpots.push({ pos: f.C.clone().addScaledVector(f.W, a * 0.7), out: f.W.clone(), T: f.T.clone() });
    }
    {
      const sf = k === 0 ? 0.3 : 0.4;
      const f = at(sf);
      const [, b] = armProf(sf);
      featherSpots.push({ pos: f.C.clone().addScaledVector(f.H, -b * 0.75).addScaledVector(f.W, 0.02), out: f.W.clone(), T: f.T.clone() });
    }
  }

  // ── Lightning: two pale gold polylines darting outward from the outer edge of the cloud arms ──
  const bolts: THREE.Group[] = [];
  {
    // The standard lightning symbol: wide at the top and pointed at the bottom, with one big kink in the middle
    const shape: [number, number][] = [
      [-0.05, 0],
      [0.035, 0],
      [0.012, 0.12],
      [0.075, 0.112],
      [-0.012, 0.36],
      [0.012, 0.2],
      [-0.06, 0.208],
    ];
    for (const sp of boltSpots) {
      const g = group(spin, sp.pos.toArray() as [number, number, number]);
      // Local +y is the direction the lightning darts out: along the cloud arm toward the tail and slightly outward (following the wind flow, not a spike poking outward, and turned downward it does not look like a leg either);
      // local +z is the storm's axis (toward the camera), and the lightning's plane faces the camera squarely
      const up = v3(0, 1, 0);
      const yb = sp.T.clone().multiplyScalar(0.8).addScaledVector(sp.out, 0.6).setY(0).normalize();
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3().crossVectors(yb, up), yb, up));
      // The lightning's plane is turned 40 degrees about its own long axis: the zigzag shows from both the front and the side, and does not become a yellow stick from the side
      g.rotateY(0.7);
      const bolt2D = outline(shape.map(([x, y]) => [x * 1.35, y * 1.35] as [number, number]));
      add(g, slab(bolt2D, 0.05, 0.01, 2), M.bolt, [0, -0.08, 0]);
      bolts.push(g);
    }
  }

  // ── Back: two Wingfolk feathers stuck in the cloud arms at the back ──
  {
    const FL = 0.5;
    const vane: [number, number][] = [];
    // Flight feather: the outer vane is wide and the inner narrow, with two gaps torn by the wind in the wide side
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const notch = 1 - 0.45 * Math.exp(-(((u - 0.46) / 0.025) ** 2)) - 0.4 * Math.exp(-(((u - 0.7) / 0.025) ** 2));
      vane.push([0.092 * Math.pow(Math.sin(PI * Math.min(1, u * 1.03)), 0.55) * (1 - 0.3 * u) * notch, u * FL]);
    }
    for (let i = N - 1; i >= 1; i--) vane.push([-0.05 * Math.pow(Math.sin(PI * Math.min(1, (i / N) * 1.03)), 0.55) * (1 - 0.3 * (i / N)), vane[i][1]]);
    featherSpots.forEach((sp, i) => {
      const g = group(spin, sp.pos.toArray() as [number, number, number]);
      // The feathers lie on the clouds at the back, following the wind flow toward the tail and slightly outward: local +y is the shaft direction
      // The face of the vane faces the back (opposite the storm's axis), so from behind the whole feather shows, not a needle
      const dir = sp.T.clone().setY(0).normalize().multiplyScalar(0.9).addScaledVector(sp.out, 0.3).add(v3(0, -0.22, 0)).normalize();
      const zb = v3(0, -1, 0).addScaledVector(dir, dir.y).normalize();
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3().crossVectors(dir, zb), dir, zb));
      g.rotateY(0.35 * (i ? -1 : 1));
      const vg = slab(outline(vane), 0.012, 0.005, 2);
      // The Wingfolk's flight feather: cream-white vanes
      paint(vg, (_k, p) => {
        const u = p.y / FL;
        // Two slate blue crossbars, with the whole feather tip deep blue
        const bar = sstep(0.4, 0.44, u) * (1 - sstep(0.52, 0.56, u)) + sstep(0.64, 0.68, u) * (1 - sstep(0.74, 0.78, u)) + sstep(0.86, 0.9, u);
        return col(0xfaf5e8).lerp(col(0x44577c), Math.min(1, bar));
      });
      add(g, vg, M.feather, [0, 0.04, 0]);
      add(g, tint(new THREE.CylinderGeometry(0.006, 0.009, FL + 0.06, 6).translate(0, FL / 2 + 0.01, 0), 0xe8e1cf), M.feather, [0, 0.0, 0.008]);
    });
  }

  // ── Core of the eye: a motionless clear-sky-colored light core ──
  const CR = 0.15;
  {
    const g = new THREE.SphereGeometry(CR, 32, 20);
    paint(g, (_k, p) => {
      const pole = Math.abs(p.y) / CR;
      return col(0x6cbcef).lerp(col(0xbfe6ff), sstep(0.2, 0.7, pole)).lerp(col(0xf6fcff), sstep(0.8, 0.98, pole) * 0.9);
    });
    add(eye, g, M.core);
    const hl = add(eye, new THREE.SphereGeometry(CR * 0.14, 8, 6), M.hi, [-CR * 0.4, CR * 0.8, -CR * 0.35], [0, 0, 0], [1, 0.45, 1]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
  }

  // ── Letters: three cream envelopes circling the core inside the eye, each sealed with an amber wax seal ──
  const mail = group(eye);
  const letters: { g: THREE.Group; a: number }[] = [];
  const MAIL_R = 0.235;
  const envelope = () => {
    const parts: THREE.BufferGeometry[] = [];
    const body = rbox(0.15, 0.014, 0.1, 0.005, 2);
    parts.push(tint(body, PAPER));
    // Flap: a triangular piece of paper on the front (+y) of the envelope
    const flap = slab(outline([[-0.073, 0.048], [0.073, 0.048], [0, -0.008]]), 0.003, 0.001, 1);
    flap.rotateX(-PI / 2);
    flap.translate(0, 0.0085, 0);
    parts.push(tint(flap, FLAP));
    const seal = lathe([[0.001, 0], [0.017, 0], [0.019, 0.0025], [0.017, 0.0055], [0.011, 0.0068], [0.001, 0.0068]], 12);
    seal.translate(0, 0.0095, 0.006);
    parts.push(tint(seal, WAX));
    // Back: a slate blue Wingfolk stamp in one corner, so it is recognizable as a letter even from behind
    const stamp = rbox(0.034, 0.004, 0.04, 0.002, 1);
    stamp.translate(0.045, -0.0085, -0.022);
    parts.push(tint(stamp, 0x4d5f82));
    return parts;
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + 0.5;
    const g = group(mail, [Math.cos(a) * MAIL_R, 0.015 * (i - 1), Math.sin(a) * MAIL_R]);
    // The long edge of the letter follows the direction of travel, with the front facing the storm's axis (the camera)
    g.rotation.set(0, -a - PI / 2, 0);
    const inner = group(g);
    for (const p of envelope()) add(inner, p, M.paper);
    letters.push({ g: inner, a });
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const coreA = group(eye);
  const rig = {
    head: group(eye, [0, CR * 0.6, 0]),
    eyes: [] as THREE.Object3D[],
    anchors: {
      core: coreA,
      mail: group(letters[0].g, [0, 0.012, 0]),
      bolt: bolts[0] ? group(bolts[0], [0, 0.25, 0]) : group(spin),
      eyeTop: group(wallG, [0, WB, -R_W]),
    },
  };

  // ── Idle ──
  const act = { gust: 0, glow: 0, flash: 0 };
  let spinA = 0;
  let wallA = 0;
  let mailA = 0;
  const update = (t: number, dt: number) => {
    const { gust, glow, flash } = act;
    float.position.y = Math.sin(t * 0.8) * 0.025;
    storm.rotation.x = TILT + Math.sin(t * 0.5) * 0.03 - gust * 0.08;
    storm.rotation.z = Math.sin(t * 0.37) * 0.035;
    if (dt > 0) {
      spinA += dt * (0.35 + gust * 1.6);
      wallA += dt * (0.8 + gust * 2.4);
      mailA += dt * 0.22 * (1 - gust * 0.6);
    } else {
      spinA = t * 0.35;
      wallA = t * 0.8;
      mailA = t * 0.22;
    }
    spin.rotation.y = spinA;
    wallG.rotation.y = wallA;
    const puff = 1 + gust * 0.08;
    spin.scale.set(puff, 1, puff);
    mail.rotation.y = mailA;
    for (let i = 0; i < letters.length; i++) {
      const l = letters[i];
      l.g.rotation.x = Math.sin(t * 1.3 + i * 2.1) * 0.12;
      l.g.rotation.z = Math.sin(t * 0.9 + i * 1.3) * 0.1;
      // In a gust the letters draw in toward the core
      l.g.position.set(-gust * 0.06, 0, 0);
    }
    // Core: does not move at all, only slowly flickers
    M.core.emissiveIntensity = 0.5 + 0.08 * Math.sin(t * 1.1) + glow * 0.9;
    // Lightning: faintly lit normally, flashing about once every 2.7 seconds
    const bt = t % 2.7;
    const strike = bt < 0.16 ? Math.sin((bt / 0.16) * PI) : 0;
    M.bolt.emissiveIntensity = 0.45 + strike * 0.9 + flash * 1.2;
  };
  update(0, 0);

  mergeStatic(root, {
    owners: [float, storm, spin, wallG, eye, mail, ...letters.map((l) => l.g)],
    rig,
  });
  return { root, update, act, rig, center: new THREE.Vector3(0, CY, 0), radius: 1.1 };
}
