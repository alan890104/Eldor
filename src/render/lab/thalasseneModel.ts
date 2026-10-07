// Thalassene (Serena), the Tidal Holy Whale (model lab version): a giant whale that roams where the Aether Sea meets the continent; the fishermen of the Tidesong Isles believe the tides are its song.
// Keeps the five things that made the old design easiest to recognize: the deep blue body, the white grooved throat and belly, the long pectoral fins and broad flukes, the gold crown and pearls on its head, and the aquamarines.
// Body shape follows the design: a singing humpback whale. The old version was a blue balloon made of a few stacked balls with thin sheet fins, surrounded by water rings, musical notes and glowing dots all over the body;
// here the whale body is a single lofted form, arched into a banana shape with the head slightly raised and the tail curling up; the pectoral fins are long and broad, with a row of wavy bumps along the leading edge, and the flukes have a notch in the middle and a serrated trailing edge.
// The details are all real geometry: a thick white shell from the chin to the tail stock (the front half is grooved throat and belly pleats, which past the top edge of the pectoral fin become a rolling tide line), three rows of round tubercles on the snout,
// a blowhole on top of the head, a lofted sickle-shaped dorsal fin and knuckle bumps on the back of the tail stock; a gold band set with pearls is fitted over the pectoral fin root, and a gold ring around the tail stock carries an aquamarine.
// Personality: a gentle and solemn singer. The big eyes are on both sides of the snout, tilted slightly forward, so the face can be seen from the front too; the lower eyelid is raised into smiling eyes, the outer corners slightly drooping, with a flat brow ridge;
// the mouth line wraps around the snout tip, with both ends sweeping up to below and in front of the eyes, which from the front reads as a smile. The pectoral fins are like open arms.
// Gaze order: the face (big eyes with two highlights, the smiling mouth line) and the tide crown on its head first, the long pectoral fins and gold bands second, and the tide line of the white belly and the flukes as support.
// Back: the raised flukes show their underside, with three deep blue arc-shaped wave marks on the white ground (every whale's fluke pattern is different, and this one is its own);
// on the right side of the tail ring hangs a hemp-rope prayer knot tied by the fishermen of the Tidesong Isles, with two hanging tassels each carrying a cowrie shell.
// Restrained light effects: the old version's water rings, notes, spout droplets, constellation lines and floating light are removed; the emissive is kept only on the two aquamarines, on the tide crown and on the tail ring.
// <Action table> focus: bobbing and swaying reduced to 20%, holding steady in close-ups (0-1); sing: sings with eyes closed, the lower eyelid raised into smiling eyes, the head tilted back slightly and the pectoral fins spread and raised (0-1);
// glow: the tide crown, the tail ring's aquamarine and the irises light up (0-1); breach: raises the head and leaps (tilting back about 70° about the center of mass, the pectoral fins flung out to both sides and the flukes pressed down);
// dive: lowers the head and dives (tilting down about 65° about the center of mass, the pectoral fins drawn in toward the body); roll: rolls about the body's long axis (-1 to 1, positive rolling toward its own right, about ±97°);
// fluke: the flukes curl up (raised high out of the water when diving); swim: swims hard (the flukes beating up and down widely, the pectoral fins paddling).
// Anchors: head (front of the forehead), eyes, mouth (below the snout tip), snout (snout tip), throat (throat pleats), blowhole (blowhole), crown (center of the tide crown),
// crownGem (the aquamarine at the front of the tide crown), finL / finR (pectoral fin tips), belly (directly below the belly), core (center of mass), dorsal (dorsal fin), tailGem (tail ring gem),
// fluke (center of the flukes), flukeL / flukeR (the two ends of the flukes). L / R are its own left and right.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, lathe, loft, outline, partKit, PI, rbox, rng, slab, smooth, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);

/**
 * An elliptical decal on a sphere (iris, pupil): the outline and projection are the same as the n-point ellipse that sphereDecal in shapes.ts attaches,
 * but split with concentric rings instead (a fan in the center and rings quad rings outside), and the chord faces likewise do not sink into the sphere, with only a tenth of the face count.
 */
function ovalDecal(rx: number, ry: number, r: number, n = 28, rings = 4): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const put = (lon: number, lat: number) => {
    const x = Math.cos(lat) * Math.sin(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.cos(lon);
    pos.push(x * r, y * r, z * r);
    nor.push(x, y, z);
  };
  put(0, 0);
  for (let k = 1; k <= rings; k++)
    for (let j = 0; j < n; j++) put(Math.cos((j / n) * PI * 2) * rx * (k / rings), Math.sin((j / n) * PI * 2) * ry * (k / rings));
  const at = (k: number, j: number) => 1 + (k - 1) * n + (j % n);
  const idx: number[] = [];
  for (let j = 0; j < n; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let k = 1; k < rings; k++)
    for (let j = 0; j < n; j++) idx.push(at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j), at(k + 1, j + 1), at(k, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/**
 * An eyelid spherical shell with thickness and a rounded lip edge: the same shape as lidGeometry in shapes.ts, with an adjustable segment count.
 * Only the ring near the lip edge can be seen, so the outline sampling is concentrated toward the lip edge; radial segments around the axis, n segments per face, lipN segments for the rounded lip.
 */
function lidGeo(ri: number, ro: number, lip: number, radial = 32, n = 8, lipN = 5): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const at = (i: number) => { const u = i / n; return lip * u * (1.5 - 0.5 * u); };
  for (let i = 0; i <= n; i++) prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(at(i))), ri * Math.cos(at(i))));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < lipN; i++) {
    const b = (i / lipN) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = n; i >= 0; i--) prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(at(i))), ro * Math.cos(at(i))));
  return smooth(new THREE.LatheGeometry(prof, radial));
}

/** Grid surface: rows × cols points, f(i, j) gives the position and color; not wrapped around */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  let hasCol = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      pos.push(p.x, p.y, p.z);
      if (c) hasCol = true;
      const cc = c ?? new THREE.Color(1, 1, 1);
      col.push(cc.r, cc.g, cc.b);
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      idx.push(a, a + cols, a + 1, a + cols, a + cols + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface FinOpts {
  /** Chord direction (the leading edge side) */
  side: THREE.Vector3;
  /** Which face counts as the top (decides the top and bottom of the vertex colors) */
  up: THREE.Vector3;
  /** Half chord length, half thickness */
  chord: (s: number) => number;
  thick: (s: number) => number;
  /** Chord length multiplier: cs > 0 is the leading edge and cs < 0 the trailing edge (leading-edge bumps, trailing-edge serration and notch) */
  edge?: (s: number, cs: number) => number;
  color?: (s: number, top: number, cs: number) => THREE.ColorRepresentation;
  /** Builds only a stretch of path, with the shell bulging outward by inflate(u) (u is the 0-1 position within this stretch), making a gold band fitted over the fin */
  range?: [number, number];
  inflate?: (u: number) => number;
  segs?: number;
  radial?: number;
  /** Color is baked into a texture by finTexture rather than written as vertex colors: [segments along s, segments around the cross-section] is the bake grid, and the uv maps to its pixel centers */
  tex?: [number, number];
}

/** Cross-section coordinate frame on the fin at s: C center, W chord direction, H thickness direction */
function finFrame(path: THREE.Curve<THREE.Vector3>, side: THREE.Vector3, s: number) {
  const C = path.getPointAt(s);
  const T = path.getTangentAt(s);
  const W = side.clone().addScaledVector(T, -T.dot(side)).normalize();
  const H = new THREE.Vector3().crossVectors(W, T).normalize();
  return { C, W, H, T };
}

/**
 * A flat fin: lofted along path, with the cross-section a lens shape slightly thicker at the leading edge. As with loft H = W × T, so the winding always faces outward;
 * for the left and right fins H goes one up and one down, so the up/down of the color is judged separately with up.
 */
function finGeo(pts: THREE.Vector3[], o: FinOpts): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const SEG = o.segs ?? 96;
  const RAD = o.radial ?? 48;
  const [s0, s1] = o.range ?? [0, 1];
  const tc = new THREE.Color();
  const g = gridGeo(SEG + 1, RAD + 1, (i, j) => {
    const u = i / SEG;
    const s = s0 + (s1 - s0) * u;
    const { C, W, H } = finFrame(path, o.side, s);
    const th = (j / RAD) * PI * 2;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const inf = o.inflate ? o.inflate(u) : 0;
    const ch = o.chord(s) * (o.edge ? o.edge(s, cs) : 1) + inf;
    const tk = o.thick(s) * (1 + 0.2 * cs) + inf;
    const p = C.addScaledVector(W, cs * ch).addScaledVector(H, sn * tk);
    const top = sn * (H.dot(o.up) >= 0 ? 1 : -1);
    return { p, c: o.color && !o.tex ? tc.set(o.color(s, top, cs)).clone() : undefined };
  });
  if (o.tex) {
    const [TS, TR] = o.tex;
    const uv: number[] = [];
    for (let i = 0; i <= SEG; i++) for (let j = 0; j <= RAD; j++) uv.push(((s0 + ((s1 - s0) * i) / SEG) * TS + 0.5) / (TS + 1), ((j / RAD) * TR + 0.5) / (TR + 1));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  return g;
}

/**
 * Bake the fin's color function into a texture, to go with finGeo's uv (o.tex is the bake grid). Fine patterns (the wave marks on the underside of the flukes) need a very dense mesh
 * for vertex colors so the boundary is not jagged (pitfall 32); once baked into a texture, every pixel is one vertex of the original dense mesh, interpolated bilinearly to the same soft edge, and the mesh only has to care about the silhouette.
 */
function finTexture(pts: THREE.Vector3[], o: FinOpts): THREE.DataTexture {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const [TS, TR] = o.tex!;
  const w = TS + 1;
  const h = TR + 1;
  const data = new Uint8Array(w * h * 4);
  const tc = new THREE.Color();
  const rgb = { r: 0, g: 0, b: 0 };
  for (let x = 0; x < w; x++) {
    const s = x / TS;
    const upSign = finFrame(path, o.side, s).H.dot(o.up) >= 0 ? 1 : -1;
    for (let y = 0; y < h; y++) {
      const th = (y / TR) * PI * 2;
      tc.set(o.color!(s, Math.sin(th) * upSign, Math.cos(th))).getRGB(rgb, THREE.SRGBColorSpace);
      const k = (y * w + x) * 4;
      data[k] = Math.round(rgb.r * 255);
      data[k + 1] = Math.round(rgb.g * 255);
      data[k + 2] = Math.round(rgb.b * 255);
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export function buildThalasseneLab(): LabModel {
  const rand = rng(20260930);
  const jit = (a: number) => (rand() - 0.5) * 2 * a;
  const RIMC = 0xa8e4ff;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const SKIN = 0x2f5cc4;
  const PALE = 0xeef5fc;
  const M = {
    skin: labToon(SKIN, { rim: 0.75, rimColor: RIMC }),
    belly: labToon(PALE, { rim: 0.5, rimColor: RIMC }),
    fin: vc(labToon(0xffffff, { rim: 0.7, rimColor: RIMC })),
    gold: labToon(0xe8b64a, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    pearl: labToon(0xfff6ee, { spec: 1.3, specTh: 0.93, rim: 0.6, rimColor: 0xffe8f0 }),
    aqua: labToon(0x5ce0ff, { ramp: 'gem', emissive: 0x1aa0e0, emissiveAmt: 0.5, spec: 1.4, specTh: 0.88, rim: 0.6 }),
    eye: labToon(0x1c2a66, { ramp: 'gem', rim: 0 }),
    iris: labToon(0x4f86e8, { ramp: 'gem', emissive: 0x1a3a9a, emissiveAmt: 0.2, rim: 0 }),
    pupil: labToon(0x0e1538, { rim: 0 }),
    line: labToon(0x16224e, { rim: 0 }),
    dark: labToon(0x1a2552, { rim: 0 }),
    rope: labToon(0xd8b684, { speckle: 0.2, rim: 0.4 }),
    shell: labToon(0xf6e6d6, { spec: 1.0, specTh: 0.94, rim: 0.5, rimColor: 0xffe0d0 }),
    shellIn: labToon(0x9a5a4a, { rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'thalassene-lab';
  const { add, group } = partKit();
  const BODY = 9201;

  // The whole thing floats; the float group handles the bobbing up and down and slight pitching
  const float = group(root);

  // ── Whale body: a single loft, with a big round head and the chest and belly thickest, tapering back into a laterally flattened tail stock; the whole thing arched into a banana shape with the head slightly raised and the tail curling up ──
  const spine = [v(0, 0.68, 0.84), v(0, 0.63, 0.56), v(0, 0.6, 0.22), v(0, 0.61, -0.12), v(0, 0.66, -0.4), v(0, 0.75, -0.64), v(0, 0.87, -0.8)];
  const prof = curveTable([
    [0, 0, 0, 0],
    [0.015, 0.08, 0.06, -0.01],
    [0.06, 0.18, 0.14, -0.02],
    [0.14, 0.27, 0.22, -0.02],
    [0.24, 0.33, 0.28, -0.01],
    [0.36, 0.35, 0.3, 0],
    [0.5, 0.31, 0.28, 0.01],
    [0.64, 0.22, 0.21, 0.01],
    [0.76, 0.13, 0.14, 0],
    [0.86, 0.065, 0.095, 0],
    [0.95, 0.05, 0.07, 0],
    [1, 0, 0, 0],
  ]);
  add(float, loft(spine, prof, { segs: 96, radial: 36 }), M.skin).userData.inkGroup = BODY;
  const path = new THREE.CatmullRomCurve3(spine, false, 'centripetal');
  /** Cross-section coordinate frame of the whale body at t (as with loft: W toward the right, H toward up) */
  const frame = (t: number) => {
    const C = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const W = new THREE.Vector3().crossVectors(T, UP).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [a, b, dy] = prof(t);
    return { C, T, W, H, a, b, dy };
  };
  /** Whale body surface: t is the position along the body (0 snout tip, 1 tail end), θ = 0 faces right (+x) and PI/2 faces up; returns the position and normal */
  const surf = (t: number, th: number, off = 0) => {
    const { C, T, W, H, a, b, dy } = frame(t);
    const n = W.clone().multiplyScalar(Math.cos(th) / Math.max(a, 1e-3)).addScaledVector(H, Math.sin(th) / Math.max(b, 1e-3)).normalize();
    const p = C.addScaledVector(W, a * Math.cos(th)).addScaledVector(H, b * Math.sin(th) + dy).addScaledVector(n, off);
    return { p, n, T };
  };
  /** Left-right symmetric angle: sx = 1 is the right and -1 the left; lat is the elevation relative to the equator */
  const sideTh = (sx: number, lat: number) => (sx > 0 ? lat : PI - lat);
  /** A small hemisphere (tubercle) lying on the whale body with its dome toward the normal */
  const bumpGeo = new THREE.SphereGeometry(1, 10, 5, 0, PI * 2, 0, PI / 2);
  const bump = (t: number, th: number, r: number, mat: THREE.Material, h = 0.6) => {
    const { p, n } = surf(t, th, -r * 0.15);
    const m = add(float, bumpGeo, mat, [p.x, p.y, p.z], [0, 0, 0], [r, r * h, r]);
    m.quaternion.setFromUnitVectors(UP, n);
    return m;
  };
  /** A thin tube along the whale body surface (mouth line): pts are [t, θ] or given directly as coordinates, with both ends tapered to points */
  const surfTube = (pts: ([number, number] | THREE.Vector3)[], r: number, off: number, mat: THREE.Material) =>
    add(float, loft(pts.map((q) => (q instanceof THREE.Vector3 ? q : surf(q[0], q[1], off).p)), (u) => { const k = Math.pow(Math.sin(PI * u), 0.35); return [r * k, r * k]; }, { segs: 64, radial: 8 }), mat);

  // ── White belly: a thick white shell from the chin all the way to the tail stock. The front half is grooved throat and belly pleats, and the shell's upper edge on the head is the mouth line, with the mouth corner below and in front of the eye;
  //    past the pectoral fin the upper edge becomes a rolling tide line that retreats all the way to below the tail stock and tapers to a point ──
  /** Position of the mouth corner (along the body) */
  const MC = 0.145;
  /** Elevation of the shell's upper edge relative to the equator */
  const edge = curveTable([
    [0, -0.34], [0.05, -0.28], [0.1, -0.2], [MC, -0.15], [0.19, -0.4], [0.25, -0.58], [0.3, -0.6], [0.36, -0.5], [0.42, -0.34], [0.48, -0.5],
    [0.54, -0.64], [0.6, -0.48], [0.66, -0.4], [0.72, -0.62], [0.78, -0.98], [0.84, -1.5],
  ]);
  {
    const T0 = 0.003;
    const T1 = 0.84;
    const NR = 64;
    const NC = 84;
    const PLEATS = 12;
    const geo = gridGeo(NR + 3, NC + 3, (ii, jj) => {
      // The outermost ring is a side wall tucked down into the whale body
      const wallI = ii === 0 || ii === NR + 2;
      const wallJ = jj === 0 || jj === NC + 2;
      const i = THREE.MathUtils.clamp(ii - 1, 0, NR);
      const j = THREE.MathUtils.clamp(jj - 1, 0, NC);
      // The cross-section changes fastest at the snout tip: the rows are densified toward the snout tip (the step of the first 30% of rows shrunk to a third), so the white shell is not poked through by the whale body's creases
      const x = i / NR;
      const t = T0 + (T1 - T0) * x * (0.35 + 0.65 * THREE.MathUtils.smoothstep(x, 0, 0.3));
      const e = edge(t)[0];
      const phi = -PI / 2 + (PI / 2 + e) * ((2 * j) / NC - 1);
      const u = (j / NC) * PLEATS;
      const d = Math.abs(u - Math.round(u));
      const g = d < 0.2 ? 0.5 + 0.5 * Math.cos((PI * d) / 0.2) : 0;
      const tipFade = THREE.MathUtils.smoothstep(t, T0, T0 + 0.05);
      const pleat = g * tipFade * (1 - THREE.MathUtils.smoothstep(t, 0.4, 0.5));
      const off = wallI || wallJ ? -0.012 : (0.017 - 0.01 * pleat) * Math.min(1, prof(t)[0] / 0.2);
      return { p: surf(t, phi, off).p };
    });
    add(float, geo, M.belly);
  }
  // Mouth line: along the upper edge of the shell around the snout tip, with the mouth corner hooking upward (a smile)
  {
    const pts: ([number, number] | THREE.Vector3)[] = [];
    const side = (sx: number, rev: boolean) => {
      const row: [number, number][] = [[MC + 0.016, edge(MC)[0] + 0.19], [MC + 0.004, edge(MC)[0] + 0.06]];
      for (let t = MC - 0.018; t >= 0.012; t -= 0.022) row.push([t, edge(t)[0] + 0.02]);
      const out = row.map(([t, lat]) => [t, sideTh(sx, lat)] as [number, number]);
      return rev ? out.reverse() : out;
    };
    // Snout tip: the mouth line wraps from the left and right sides directly in front of the snout tip
    const f0 = frame(0);
    const tip = f0.C.clone().addScaledVector(f0.H, f0.dy - 0.012).addScaledVector(f0.T, -0.008);
    pts.push(...side(-1, false), tip, ...side(1, true));
    surfTube(pts, 0.0065, 0.014, M.line);
  }

  // ── Tubercles on top of the head: three rows of round tubercles of varying size ──
  for (const [dth, n, r] of [[0, 4, 0.024], [0.4, 3, 0.02], [-0.4, 3, 0.02]] as [number, number, number][]) {
    for (let i = 0; i < n; i++) bump(0.03 + i * 0.03 + Math.abs(dth) * 0.04, PI / 2 + dth + jit(0.03), r * (1 - i * 0.07), M.skin, 0.85);
  }
  // ── Blowhole: behind the tide crown on top of the head, two dark holes with a raised ring of water-blocking flesh in front ──
  let blowA: THREE.Group;
  {
    const s = surf(0.37, PI / 2);
    const bh = group(float, [s.p.x, s.p.y, s.p.z]);
    bh.quaternion.setFromUnitVectors(UP, s.n);
    add(bh, new THREE.SphereGeometry(1, 16, 7, 0, PI * 2, 0, PI / 2), M.skin, [0, -0.012, 0.02], [0, 0, 0], [0.07, 0.03, 0.045]).userData.inkGroup = BODY;
    for (const sx of [-1, 1]) add(bh, new THREE.SphereGeometry(1, 10, 6), M.dark, [sx * 0.018, 0.004, -0.02], [0, sx * 0.3, 0], [0.01, 0.006, 0.028]);
    blowA = group(bh, [0, 0.012, -0.02]);
  }

  // ── A row of knuckle bumps on the back of the tail stock ──
  for (let i = 0; i < 4; i++) bump(0.74 + i * 0.045, PI / 2, 0.022 - i * 0.003, M.skin, 0.7).userData.inkGroup = BODY;

  // ── Dorsal fin: a small sickle-shaped fin in front of the tail stock, with a raised stretch in front ──
  let dorsalA: THREE.Group;
  {
    const s0 = surf(0.655, PI / 2, -0.03);
    const B = s0.p;
    const back = s0.T.clone().setY(0).normalize();
    const pts = [B.clone(), B.clone().addScaledVector(UP, 0.06).addScaledVector(back, 0.02), B.clone().addScaledVector(UP, 0.1).addScaledVector(back, 0.075)];
    dorsalA = group(float, [pts[1].x, pts[1].y, pts[1].z]);
    add(
      float,
      finGeo(pts, {
        side: back.clone().negate(),
        up: UP,
        segs: 28,
        radial: 24,
        chord: (t) => 0.085 * Math.pow(1 - t, 0.9) + 0.004 * (1 - t),
        thick: (t) => 0.022 * (1 - t * 0.8) * Math.min(1, (1 - t) * 10),
        edge: (t, cs) => (cs < 0 ? 1 - 0.35 * Math.sin(PI * t) * -cs : 1 + 0.4 * (1 - t) * cs),
      }),
      M.skin,
    ).userData.inkGroup = BODY;
  }

  // ── Gold ring on the tail stock: a gold band with an aquamarine on top ──
  let tailGemA: THREE.Group;
  {
    const { C, T, W, H, a, b, dy } = frame(0.87);
    const g = group(float);
    g.position.copy(C).addScaledVector(H, dy);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(W, T, H));
    const k = 1.08;
    add(g, lathe([[1.0, -0.024], [1.05, -0.02], [1.08, -0.01], [1.08, 0.01], [1.05, 0.02], [1.0, 0.024]], 48), M.gold, [0, 0, 0], [0, 0, 0], [a * k, 1, b * k]);
    const top = group(g, [0, 0, b * k * 1.08], [PI / 2, 0, 0]);
    add(top, lathe([[0.014, -0.004], [0.02, -0.002], [0.021, 0.006], [0.016, 0.009], [0.012, 0.004]], 24), M.gold);
    add(top, brilliant(0.016, 0.011, 0.012, 8), M.aqua, [0, 0.006, 0]);
    tailGemA = group(top, [0, 0.016, 0]);
    for (const sx of [-1, 1]) add(g, new THREE.SphereGeometry(0.01, 10, 6), M.pearl, [sx * a * k * 1.06, 0, 0]);
  }

  // ── Prayer rope: a hemp-rope knot tied by the fishermen of the Tidesong Isles on the right side of the tail ring, with two hanging tassels each carrying a cowrie shell ──
  const tassels: THREE.Group[] = [];
  {
    const { C, T, W, H, a, dy } = frame(0.875);
    const K = C.clone().addScaledVector(H, dy).addScaledVector(W, a * 1.08 + 0.014);
    const knot = group(float, [K.x, K.y, K.z]);
    knot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, W, new THREE.Vector3().crossVectors(T, W)));
    add(knot, new THREE.TorusGeometry(0.013, 0.0055, 8, 20), M.rope, [0, 0, 0], [0, PI / 2, 0]);
    add(knot, new THREE.SphereGeometry(0.011, 10, 6), M.rope, [0, 0.004, 0]);
    for (const [k, len] of [[0, 0.1], [1, 0.075]] as [number, number][]) {
      const tg = group(float, [K.x, K.y, K.z]);
      tassels.push(tg);
      const back = T.clone().multiplyScalar(0.3 + k * 0.25);
      const d0 = back.clone().add(v(0, -1, 0)).normalize();
      const P = [v(0, 0, 0), d0.clone().multiplyScalar(len * 0.45).addScaledVector(W, 0.006), d0.clone().multiplyScalar(len).addScaledVector(W, 0.004 + k * 0.01)];
      add(tg, loft(P, (u) => [0.0042 * (1 - u * 0.3), 0.0042 * (1 - u * 0.3)], { segs: 16, radial: 8 }), M.rope);
      const end = P[2];
      const sh = group(tg, [end.x, end.y - 0.012, end.z]);
      sh.quaternion.setFromUnitVectors(v(0, 1, 0), d0.clone().negate());
      add(sh, new THREE.SphereGeometry(1, 14, 10), M.shell, [0, 0, 0], [0, 0, 0], [0.014, 0.02, 0.011]);
      add(sh, rbox(0.003, 0.03, 0.004, 0.0015, 1), M.shellIn, [0, -0.001, 0.0105]);
    }
  }

  // ── Pectoral fins: long and broad, with a row of wavy bumps along the leading edge; the stretch at the fin root on top is blue and the rest white; a gold band set with pearls is fitted over the fin root ──
  const fins: THREE.Group[] = [];
  /** Pectoral fin tips (left and right, in the same order as fins: sx = -1 first, then sx = 1) */
  const finTips: THREE.Group[] = [];
  const finChord = curveTable([[0, 0.07], [0.2, 0.115], [0.5, 0.115], [0.8, 0.08], [0.95, 0.035], [1, 0]]);
  const finThick = (t: number) => 0.026 * (1 - t * 0.75) * Math.min(1, (1 - t) * 14);
  for (const sx of [-1, 1]) {
    const s = surf(0.3, sideTh(sx, -0.5), -0.035);
    const pivot = group(float, [s.p.x, s.p.y, s.p.z]);
    const pts = [v(0, 0, 0), v(sx * 0.17, -0.06, -0.02), v(sx * 0.33, -0.17, -0.1), v(sx * 0.46, -0.29, -0.2), v(sx * 0.54, -0.37, -0.28)];
    const side = v(0, 0.3, 1);
    const fo: FinOpts = {
      side,
      up: UP,
      chord: (t) => finChord(t)[0],
      thick: finThick,
      edge: (t, cs) => (cs > 0 ? 1 + 0.13 * Math.pow(Math.abs(Math.sin(t * 8.5 * PI)), 0.6) * cs * THREE.MathUtils.smoothstep(t, 0.2, 0.3) : 1),
      // The stretch at the fin root is blue on top, with the boundary a narrow smooth transition, so interpolating the vertex colors is not jagged
      color: (t, top, cs) => new THREE.Color(PALE).lerp(new THREE.Color(SKIN), top > 0 ? THREE.MathUtils.smoothstep(0.36 + cs * 0.05 - t, -0.006, 0.006) : 0),
    };
    add(pivot, finGeo(pts, { ...fo, segs: 64, radial: 28 }), M.fin);
    // Gold band: a short stretch of the same fin, bulging outward a little
    const C0 = 0.13;
    const C1 = 0.21;
    add(pivot, finGeo(pts, { ...fo, color: undefined, range: [C0, C1], inflate: (u) => 0.008 * Math.pow(Math.sin(PI * u), 0.4), segs: 12, radial: 32 }), M.gold);
    const fpath = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const mid = finFrame(fpath, side, (C0 + C1) / 2);
    const upSign = mid.H.dot(UP) >= 0 ? 1 : -1;
    for (const x of [-0.55, 0, 0.55]) {
      const tk = finThick((C0 + C1) / 2) * (1 + 0.2 * x) + 0.008;
      const pp = mid.C.clone().addScaledVector(mid.W, x * finChord((C0 + C1) / 2)[0]).addScaledVector(mid.H, upSign * tk);
      add(pivot, new THREE.SphereGeometry(x === 0 ? 0.013 : 0.01, 12, 8), M.pearl, [pp.x, pp.y, pp.z]);
    }
    fins.push(pivot);
    finTips.push(group(pivot, [pts[4].x, pts[4].y, pts[4].z]));
  }

  // ── Flukes: a whole broad fin at the end of the raised tail, with a notch in the middle and a serrated trailing edge; blue on top, and on the underside three deep blue wave marks on a white ground ──
  const endT = path.getTangentAt(1);
  const endP = path.getPointAt(0.975);
  const fluke = group(float, [endP.x, endP.y, endP.z]);
  // The flukes curl up a bit more along the raised tail stock, so the underside's pattern can be seen from behind
  const flukeRest = new THREE.Quaternion().setFromUnitVectors(v(0, 0, -1), endT).multiply(new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), 0.05));
  fluke.quaternion.copy(flukeRest);
  {
    const pts = [v(-0.4, 0.035, -0.25), v(-0.27, 0.012, -0.13), v(-0.12, 0, -0.035), v(0, 0, 0), v(0.12, 0, -0.035), v(0.27, 0.012, -0.13), v(0.4, 0.035, -0.25)];
    const U = (s: number) => Math.abs(2 * s - 1);
    const fo: FinOpts = {
      side: v(0, 0, 1),
      up: UP,
      segs: 100,
      radial: 40,
      tex: [220, 96],
      chord: (s) => { const u = U(s); return (0.06 + 0.07 * Math.sin(Math.min(1, u * 1.05) * PI * 0.9)) * Math.min(1, (1 - u) * 5) + 0.004 * (1 - u); },
      thick: (s) => { const u = U(s); return 0.03 * Math.pow(1 - u, 0.6) * Math.min(1, (1 - u) * 8); },
      edge: (s, cs) => {
        if (cs >= 0) return 1;
        const u = U(s);
        const notch = 1 - 0.55 * Math.exp(-u * u * 180);
        const saw = 1 + 0.16 * (1 - Math.abs(2 * ((u * 4.5 + 0.3) % 1) - 1)) * THREE.MathUtils.smoothstep(u, 0.15, 0.3);
        return 1 + (notch * saw - 1) * -cs;
      },
      color: (s, top, cs) => {
        if (top > 0) return SKIN;
        // Underside: white ground, a deep blue trailing edge, plus three arc-shaped wave marks; the boundaries are narrow smooth transitions
        const u = U(s);
        const w = u * 3.4 + 0.5 * cs * cs - 0.25;
        const dd = Math.abs(w - Math.floor(w) - 0.1);
        let m = THREE.MathUtils.smoothstep(0.13 - dd, 0, 0.05) * THREE.MathUtils.smoothstep(u, 0.1, 0.16) * (1 - THREE.MathUtils.smoothstep(u, 0.86, 0.92));
        m = Math.max(m, THREE.MathUtils.smoothstep(-cs, 0.74, 0.84));
        return new THREE.Color(PALE).lerp(new THREE.Color(SKIN), m);
      },
    };
    // The underside's wave marks are baked into a texture (each pixel is one vertex of the old 220 × 96 mesh): the mesh only cares about the silhouette (the notch and serration), and the soft edges of the wave marks are interpolated by the texture, so they do not become jagged with the mesh
    const flukeMat = labToon(0xffffff, { rim: 0.7, rimColor: RIMC });
    flukeMat.map = finTexture(pts, fo);
    add(fluke, finGeo(pts, fo), flukeMat);
  }
  // The center and the left and right ends of the flukes (L is its own left = +x)
  const flukeA = group(fluke, [0, 0.01, -0.09]);
  const flukeL = group(fluke, [0.4, 0.035, -0.25]);
  const flukeR = group(fluke, [-0.4, 0.035, -0.25]);

  // ── Eyes: a big eye half set into the side of the head, wrapped by blue upper and lower eyelids; the lower eyelid is raised and the outer corner slightly drooping, smiling eyes; a flat brow ridge presses on top; two highlights ──
  const ER = 0.074;
  const UP_OPEN = 0.72;
  const LO_OPEN = 0.36;
  const lids: THREE.Group[] = [];
  /** The lower eyelid and its line (raised into smiling eyes when singing) */
  const lowLids: THREE.Group[] = [];
  const lidFur = lidGeo(ER + 0.004, ER + 0.017, PI / 2, 28);
  const lidLow = lidGeo(ER + 0.004, ER + 0.012, PI / 2, 28);
  const lidLine = lidGeo(ER + 0.001, ER + 0.0045, PI / 2, 24, 7, 4);
  const eyeAnchors: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const s = surf(0.175, sideTh(sx, 0.12), -ER * 0.5);
    const f = s.n.clone().add(v(0, 0.12, 1.25)).normalize();
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    const eg = group(float, [s.p.x, s.p.y, s.p.z]);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    eyeAnchors.push(group(eg, [0, 0, ER]));
    const roll = group(eg, [0, 0, 0], [0, 0, -sx * 0.1]);
    add(roll, new THREE.SphereGeometry(ER, 32, 20), M.eye);
    add(roll, ovalDecal(0.7, 0.7, ER + 0.0008), M.iris);
    add(roll, ovalDecal(0.5, 0.5, ER + 0.0016, 28, 3), M.eye);
    add(roll, ovalDecal(0.28, 0.33, ER + 0.0024, 24, 2), M.pupil);
    for (const [x, y, rr] of [[-sx * 0.018, 0.02, 0.012], [sx * 0.016, -0.014, 0.006]] as [number, number, number][]) {
      const hl = add(roll, new THREE.SphereGeometry(rr, 10, 6), M.hi, [x, y, ER * 0.93]);
      hl.layers.disable(INK_LAYER);
    }
    const upper = group(roll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidFur, M.skin).userData.inkGroup = BODY;
    const upLine = group(roll, [0, 0, 0], [-UP_OPEN + 0.09, 0, 0]);
    add(upLine, lidLine, M.line);
    const lower = group(roll, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lower, lidLow, M.skin).userData.inkGroup = BODY;
    const loLine = group(roll, [0, 0, 0], [PI + LO_OPEN - 0.06, 0, 0]);
    add(loLine, lidLine, M.line);
    lids.push(upper, upLine);
    lowLids.push(lower, loLine);
    // Three lashes curling back from the outer corner
    for (let k = 0; k < 3; k++) {
      const lg = group(roll, [0, 0, 0], [-UP_OPEN - 0.04, 0, sx * (0.25 + k * 0.28)]);
      add(lg, loft([v(0, ER + 0.01, 0.002), v(0, ER + 0.024, -0.006), v(sx * 0.006, ER + 0.034, -0.016)], (tt) => [0.0055 * (1 - tt) + 0.0005, 0.004 * (1 - tt) + 0.0005], { segs: 8, radial: 6 }), M.line);
    }
    // Brow ridge: a flat ridge of flesh above the eye
    const bpts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = 0.35 + (k / 8) * (PI - 0.7);
      bpts.push(v(Math.cos(a) * ER * 1.34, Math.sin(a) * ER * 1.14 + 0.016, ER * 0.4));
    }
    add(roll, loft(bpts, (tt) => { const k = Math.pow(Math.sin(PI * tt), 0.5); return [0.009 * k, 0.007 * k]; }, { segs: 20, radial: 10 }), M.skin).userData.inkGroup = BODY;
  }

  // ── Tide crown: a gold ring on top of the head, seven pointed crown teeth holding pearls, with the tallest one at the very front set with an aquamarine ──
  let crownA: THREE.Group;
  let crownGemA: THREE.Group | null = null;
  {
    const s = surf(0.225, PI / 2, -0.014);
    const crown = group(float, [s.p.x, s.p.y, s.p.z]);
    crown.quaternion.setFromUnitVectors(UP, s.n);
    const tilt = group(crown, [0, 0, 0], [0.1, 0, 0]);
    const R = 0.104;
    add(tilt, lathe([[R - 0.008, 0], [R + 0.002, 0.003], [R + 0.007, 0.012], [R + 0.007, 0.024], [R + 0.001, 0.032], [R - 0.008, 0.028], [R - 0.011, 0.004]], 48), M.gold);
    const tooth = (w: number, h: number) => outline([[-w, 0], [w, 0], [w * 0.62, h * 0.3], [w * 0.28, h * 0.72], [0, h], [-w * 0.28, h * 0.72], [-w * 0.62, h * 0.3]]);
    const HS = [0.11, 0.075, 0.058, 0.05];
    const WS = [0.034, 0.024, 0.02, 0.018];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      const k = Math.min(i, 7 - i);
      const tg = group(tilt, [Math.sin(a) * (R + 0.002), 0.026, Math.cos(a) * (R + 0.002)], [0, a, 0]);
      const lean = group(tg, [0, 0, 0], [0.14, 0, 0]);
      add(lean, slab(tooth(WS[k], HS[k]), 0.01, 0.004, 3), M.gold);
      add(lean, new THREE.SphereGeometry(k === 0 ? 0.017 : 0.013, 12, 8), M.pearl, [0, HS[k] + 0.006, 0]);
      if (k === 0) {
        const set = group(lean, [0, HS[0] * 0.38, 0.007], [PI / 2, 0, 0]);
        add(set, lathe([[0.017, -0.004], [0.023, -0.002], [0.024, 0.006], [0.019, 0.009], [0.015, 0.004]], 32), M.gold);
        add(set, brilliant(0.018, 0.012, 0.012, 10), M.aqua, [0, 0.006, 0]);
        crownGemA = group(set, [0, 0.016, 0]);
      }
      const pa = a + PI / 7;
      add(tilt, new THREE.SphereGeometry(0.008, 10, 6), M.pearl, [Math.sin(pa) * (R + 0.008), 0.018, Math.cos(pa) * (R + 0.008)]);
    }
    crownA = group(tilt, [0, 0.07, 0]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // Action weights (performances tween these values; names are in the header's <Action table>)
  const act = { focus: 0, sing: 0, glow: 0, breach: 0, dive: 0, roll: 0, fluke: 0, swim: 0 };
  /** Pivot for pitch and roll: the body's center of mass (the same point as center) */
  const PIV = v(0, 0.66, -0.02);
  const qAct = new THREE.Quaternion();
  const eAct = new THREE.Euler(0, 0, 0, 'XYZ');
  const pAct = new THREE.Vector3();
  let lastGlow = -1;

  // ── Idle action: slow bobbing up and down and pitching, the pectoral fins slowly moving as if paddling, the flukes swaying lightly, blinking, the gems flickering faintly ──
  let blinkIn = 2.6;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    // In focus the bobbing and swaying are reduced to 20%, and in close-ups the whole thing holds steady
    const calm = 1 - 0.8 * act.focus;
    float.position.set(0, Math.sin(t * 0.9) * 0.03 * calm, 0);
    float.rotation.set(Math.sin(t * 0.9 - 0.8) * 0.035 * calm, 0, Math.sin(t * 0.45) * 0.02 * calm);
    // The whole body's pitch and roll turn about the center of mass: breach raises the head and leaps, dive lowers the head and dives, sing tilts the head back slightly, and roll rolls about the body's long axis (-1 to 1)
    const pitch = -act.breach * 1.25 + act.dive * 1.15 - act.sing * 0.2;
    const roll = act.roll * 1.7;
    if (pitch !== 0 || roll !== 0) {
      qAct.setFromEuler(eAct.set(pitch, 0, roll));
      pAct.copy(float.position).sub(PIV).applyQuaternion(qAct).add(PIV);
      float.position.copy(pAct);
      float.quaternion.premultiply(qAct);
    }
    // Pectoral fins: paddling when idle; sing spreads and raises them (like open arms), breach flings them out to both sides, dive draws them in toward the body, and swim paddles hard
    const stroke = Math.sin(t * 6.5) * 0.4 * act.swim;
    for (let i = 0; i < fins.length; i++) {
      const sx = i === 0 ? -1 : 1;
      fins[i].rotation.z = sx * (Math.sin(t * 0.9 - 0.4) * 0.1 * calm + act.sing * 0.42 + act.breach * 0.55 - act.dive * 0.3 + stroke);
      fins[i].rotation.y = Math.sin(t * 0.9) * 0.05 * calm + sx * (-act.sing * 0.3 + act.breach * 0.2 + act.dive * 0.4);
    }
    // Flukes: swaying lightly when idle; fluke curls them up (raised high out of the water when diving), breach presses them down, and swim beats them up and down hard
    fluke.quaternion.copy(flukeRest);
    for (let i = 0; i < tassels.length; i++) tassels[i].rotation.set(Math.sin(t * 1.3 + i) * 0.12, 0, Math.sin(t * 0.9 - 1.2 + i * 0.7) * 0.15);
    fluke.rotateX(Math.sin(t * 0.9 - 1.6) * 0.12 * (1 - act.swim) + act.fluke * 0.85 - act.breach * 0.3 + Math.sin(t * 7.5) * 0.45 * act.swim);

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 3 + ((t * 7.3) % 3);
    }
    let close = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.22;
      close = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.3) : 0;
      if (k >= 1) blinkT = -1;
    }
    // sing: the lower eyelid rises and the upper eyelid drops to meet it, smiling eyes singing with the eyes closed; it transitions only between weights 0.35 and 0.8, and does not rest on half-open sleepy eyes
    const shut = THREE.MathUtils.smoothstep(act.sing, 0.35, 0.8);
    const lift = shut * 0.42;
    close = Math.max(close, shut * 0.94);
    for (let i = 0; i < lids.length; i++) lids[i].rotation.x = -UP_OPEN + (i % 2 ? 0.09 : 0) + (UP_OPEN + LO_OPEN - 0.02 - lift) * close;
    for (let i = 0; i < lowLids.length; i++) lowLids[i].rotation.x = PI + LO_OPEN - (i % 2 ? 0.06 : 0) - lift;

    // glow: the aquamarines on the tide crown and tail ring, and the irises, light up
    M.aqua.emissiveIntensity = (0.5 + Math.sin(t * 1.1) * 0.08) * (1 + act.glow * 1.3);
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.iris.emissiveIntensity = 0.2 * (1 + act.glow * 1.6);
    }
  };
  update(0, 0);

  // Anchors (for hooking into the game): all empty groups, hung on parts that move along. L / R are its own left and right (the model faces +z, and its left hand side is +x).
  // The whale has no separate head: the face anchor is on the forehead between the two eyes, and the mouth is below the snout tip
  const faceP = surf(0.1, PI / 2, 0).p;
  const f0 = frame(0);
  const mouthP = f0.C.clone().addScaledVector(f0.H, f0.dy - 0.02).addScaledVector(f0.T, -0.01);
  const snoutP = f0.C.clone().addScaledVector(f0.H, f0.dy + 0.01).addScaledVector(f0.T, -0.004);
  const throatP = surf(0.13, -PI / 2, 0.02).p;
  const bellyP = surf(0.36, -PI / 2, 0.02).p;
  const at = (p: THREE.Vector3) => group(float, [p.x, p.y, p.z]);
  const rig = {
    head: at(faceP),
    eyes: eyeAnchors,
    anchors: {
      mouth: at(mouthP),
      snout: at(snoutP),
      throat: at(throatP),
      blowhole: blowA!,
      crown: crownA!,
      crownGem: crownGemA ?? crownA!,
      finL: finTips[1],
      finR: finTips[0],
      belly: at(bellyP),
      core: at(PIV),
      dorsal: dorsalA!,
      tailGem: tailGemA!,
      fluke: flukeA,
      flukeL,
      flukeR,
    },
  };
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.66, -0.02), radius: 1.0 };
}
