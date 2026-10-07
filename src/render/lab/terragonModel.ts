// Terragon, the Mountain Tortoise (model lab version): a giant tortoise whose shell is a mountain; the dwarf kingdom of Stoneheart Canyon is really built on its sleeping back.
// It keeps the five things that made the old model easiest to recognize: the olive-green skin, the rock-gray peaks with snow caps, the pine groves on the mountain, the amber Earth Source Crystal, and the dwarves' stone houses and lamplight.
// The old version's weaknesses: half-drooping glowing eyes with slanted brows gave a world-weary face, with the head tucked under the edge of the shell; the shell was a smooth brown dome, with no tortoise shell to be seen;
// the mountain was a few cones with a snow cap, with trees and houses stuck on it at random; the four feet were straight tubes with round stools; and on top of that came halos, floating stones, rune rings, sand swirls and bright dots all over.
// Body shape follows the lore: a four-legged land tortoise, not drifting toward a humanoid. The lower edge of the high-arched shell is a ring of truly separate marginal scutes, with a gap at the front edge for the neck and one for each of the four feet, the rear edge flaring outward;
// above, two rows of costal scutes, each with thickness, rounded corners and growth-ring steps, shallow at the center and gradually deeper going outward. The top of the shell is covered in green grass, with a multifaceted stone mountain rising from the grass:
// the main peak leaning back, gentle in front and steep behind, a shoulder peak at the front right, a small peak at the front left, two small peaks behind, and fallen rocks scattered at the foot; every face is flat, one color step per face.
// The snow cap is a thick layer of snow lying against the rock face, its lower edge dripping down in sawteeth following the rock face. The forelegs are thick like an elephant's, the elbows braced outward, the forearms with two rows of big scales overlapping downward, and the foot with five blunt claws.
// Personality: an elder who does not move a hair even carrying a whole kingdom, steady, generous and patient; awake, its gaze is clear and dignified.
// Face: the neck extends level out from under the front edge of the shell and, once out of the shell, bends up; the head held high with the chin slightly lifted; the amber eyes open and looking straight ahead, the iris filling the eye,
// the upper lid covering only to the upper edge of the iris, a heavy, straight brow ridge pressing down above; the cream horny beak closed, the beak tip hooking down slightly, the mouth line drawing back and turning up slightly;
// the big scales on top of the head fit together into a sheet like a helmet, with a round bulging tympanic scale on each cheek, and the throat pale.
// Gaze order: the face (cream beak, amber eyes and highlights, heavy brows) first, the amber source crystal bursting through the rock at the front shoulder of the main peak and the snow cap second, and the tortoise shell, pine groves and small peaks as support.
// Back: the steep cliff wall on the rear side of the main peak is the entrance to Stoneheart Canyon, where the dwarves chiseled an arched stone gate in the cliff (arch stones, stone pillars, a gold mountain pattern on the lintel, a gold keystone),
// windows in the cliff face on both sides and a flight of stone steps going down, lamplight showing through the gap in the door and the windows; on the grass below the cliff three red-tiled stone houses, and beside the small peak at the rear right a watchtower flying a gold flag;
// below, the upturned pygal scute and a short tail.
// Restrained light effects: the old version's halo, floating stones, amber rune ring, sand swirl, waterfall and bright dots are removed; the only emissive left is three places: a touch of amber in the eyes, the source crystal, and the lamplight of the dwarf city on the back.
// Anchors (for hooking into the game): head the center of the face, eyes the surfaces of the two eyes, mouth the mouth seam at the beak tip;
//   shell the plane of the lower edge of the carapace, with the origin on the shell's center axis, y at the same height as the marginal scutes, scaled up by 1.15 (the ultimate's rock layers are stacked under this plane in the old carapace's local coordinates,
//   outer radius 0.6, 1.2 times in the z direction, each layer 0.085 lower going down), rising and falling with the breathing; summit the snow cap of the main peak (snow dust sifts down); crystal the center of the source crystal cluster (the halo when the ley lines light up).
// Action weights (act): glow brightens the emissive of the source crystal, lamplight and iris (the beat in which the old ultimate turned up glows); focus stops looking around and looks straight ahead.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, outline, partKit, PI, rbox, rng, slab, smooth, taper, wedge, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v(0, 1, 0);
const X = v(1, 0, 0);
const ss = THREE.MathUtils.smoothstep;

// ───────────────────────── Helpers for the face-count budget (SSR 60,000 faces) ─────────────────────────

/** Eyelid shell: the same outline as lidGeometry in shapes.ts, with the lathe segments and the number of outline points adjustable (the eyelid edge shows only half a circle from the front, so 20 segments show no corner) */
function lidGeo(ri: number, ro: number, lip: number, seg = 20, n = 6, rim = 4): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), ri * Math.cos(a)));
  }
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < rim; i++) {
    const b = (i / rim) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = n; i >= 0; i--) {
    const a = (i / n) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  return smooth(new THREE.LatheGeometry(prof, seg));
}

/**
 * An elliptical disc on a sphere (iris, pupil): centered on +z, longitude radius rx, latitude radius ry (radians), laid onto a sphere of radius r.
 * A polar grid going outward ring by ring, with segs segments on the outer edge; compared with sphereDecal subdividing long thin triangles three times it saves many faces, and the chord faces do not sink into the sphere.
 */
function diskDecal(rx: number, ry: number, r: number, rings = 3, segs = 28): THREE.BufferGeometry {
  const pos: number[] = [0, 0, r];
  for (let k = 1; k <= rings; k++)
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * PI * 2;
      const lon = (k / rings) * rx * Math.cos(a);
      const lat = (k / rings) * ry * Math.sin(a);
      pos.push(Math.cos(lat) * Math.sin(lon) * r, Math.sin(lat) * r, Math.cos(lat) * Math.cos(lon) * r);
    }
  const idx: number[] = [];
  const at = (k: number, j: number) => (k === 0 ? 0 : 1 + (k - 1) * segs + (j % segs));
  for (let j = 0; j < segs; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let k = 1; k < rings; k++)
    for (let j = 0; j < segs; j++) idx.push(at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j), at(k + 1, j + 1), at(k, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((x) => x / r), 3));
  g.setIndex(idx);
  return g;
}

/** Merge several pieces of geometry into one: keep only positions and normals (colors kept only if every piece has vertex colors); if one has no index, everything is flattened */
function mergeParts(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = gs.some((g) => !g.index);
  const keep = ['position', 'normal', ...(gs.every((g) => g.attributes.color) ? ['color'] : [])];
  return mergeGeometries(
    gs.map((g0) => {
      const g = flat && g0.index ? g0.toNonIndexed() : g0;
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      return g;
    }),
    false,
  )!;
}

/** A matrix composed of position, rotation and scale (in the same order as Object3D) */
function mtx(pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scl: V3 = [1, 1, 1]): THREE.Matrix4 {
  return new THREE.Matrix4().compose(v(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), v(...scl));
}

/** Grid surface: rows × cols points, with f(i, j) giving the position and color; on merge, coincident vertices are merged and then the normals computed (wrap-around seams, poles closed to a point) */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, merge = false): THREE.BufferGeometry {
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
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  if (merge) {
    g = mergeVertices(g, 1e-6);
    // The ring that closes to a point (the center of the scute) leaves zero-area triangles after merging, which are removed
    const ix = g.index!.array;
    const keep: number[] = [];
    for (let k = 0; k < ix.length; k += 3) if (ix[k] !== ix[k + 1] && ix[k + 1] !== ix[k + 2] && ix[k] !== ix[k + 2]) keep.push(ix[k], ix[k + 1], ix[k + 2]);
    g.setIndex(keep);
  }
  g.computeVertexNormals();
  return g;
}

type Surf = (u: number, v: number) => { p: THREE.Vector3; n: THREE.Vector3 };

interface PlateOpts {
  /** The half widths in the two directions (in surf's parameter units) */
  hu: number;
  hv: number;
  /** Thickness */
  th: number;
  /** Squareness: 2 is an ellipse, and the larger the squarer */
  sq?: number;
  /** The number of growth-ring steps (0-2) */
  rings?: number;
  /** Tile-style slant: the side where u is positive is thicker (the scales overlapping downward) */
  lean?: number;
  /** The three colors of the center, middle ring and outer ring */
  cols: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation];
  seg?: number;
}

/**
 * One scute (or scale): centered on surf(0, 0), a superellipse outline, with thickness growing along the surface normal; the first-grown scute at the center is the highest,
 * ring after ring of growth-ring steps going down outward, the outer edge rounded off, and the outermost ring inserted down into the surface beneath, so there is no open edge.
 */
function plateGeo(surf: Surf, o: PlateOpts): THREE.BufferGeometry {
  const r = o.rings ?? 2;
  // Sample rings: one ring at each end of the growth-ring steps and one more on the flat outside of a step (without this ring the vertex normals would average the slope of the step into the whole scute, and the outline could not draw the step);
  // one ring at the color boundary and three at the rounded outer edge, the last ring being the wall inserted down into the base surface
  const S = r >= 2 ? [0, 0.36, 0.4, 0.46, 0.5, 0.62, 0.66, 0.72, 0.76, 0.9, 0.973, 1, 1] : r >= 1 ? [0, 0.36, 0.4, 0.46, 0.5, 0.8, 0.9, 0.973, 1, 1] : [0, 0.5, 0.8, 0.9, 0.973, 1, 1];
  const SEG = o.seg ?? 16;
  const e = 2 / (o.sq ?? 4);
  const c0 = new THREE.Color(o.cols[0]);
  const c1 = new THREE.Color(o.cols[1]);
  const c2 = new THREE.Color(o.cols[2]);
  const h = (s: number) => {
    let k = 1;
    if (r >= 1) k -= 0.2 * ss(s, 0.4, 0.46);
    if (r >= 2) k -= 0.18 * ss(s, 0.66, 0.72);
    const edge = s > 0.8 ? Math.sqrt(Math.max(0, 1 - ((s - 0.8) / 0.2) ** 2)) : 1;
    return o.th * k * (0.25 + 0.75 * edge);
  };
  const sp = (x: number) => Math.sign(x) * Math.pow(Math.abs(x), e);
  return gridGeo(S.length, SEG + 1, (i, j) => {
    const s = S[i];
    const wall = i === S.length - 1;
    // The seam column uses exactly the same angle as column 0: sin(2π) is not 0, and passed through the superellipse's exponent it is amplified, the vertices cannot be merged, and small outline dots would appear on the seam
    const ph = ((j % SEG) / SEG) * PI * 2;
    const { p, n } = surf(s * o.hu * sp(Math.cos(ph)), s * o.hv * sp(Math.sin(ph)));
    const uN = s * sp(Math.cos(ph));
    const off = wall ? -0.012 : 0.003 + h(s) * (1 + (o.lean ?? 0) * uN);
    const c = c0.clone().lerp(c1, ss(s, 0.4, 0.46)).lerp(c2, ss(s, 0.66, 0.72) * (r >= 2 ? 1 : 0) + ss(s, 0.8, 0.9) * (r >= 2 ? 0 : 1));
    return { p: p.addScaledVector(n, off), c };
  }, true);
}

/** A small patch on an ellipsoid centered on direction d (a gnomonic projection, with no pole distortion anywhere); e1 × e2 = d */
function ellipsoidSurf(C: THREE.Vector3, r: THREE.Vector3, d: THREE.Vector3, roll = 0): Surf {
  const dn = d.clone().normalize();
  const ref = Math.abs(dn.y) > 0.9 ? v(0, 0, 1) : UP;
  const e1 = new THREE.Vector3().crossVectors(ref, dn).normalize().applyAxisAngle(dn, roll);
  const e2 = new THREE.Vector3().crossVectors(dn, e1);
  return (u, w) => {
    const q = dn.clone().addScaledVector(e1, u).addScaledVector(e2, w).normalize();
    const p = v(C.x + q.x * r.x, C.y + q.y * r.y, C.z + q.z * r.z);
    const n = v(q.x / r.x, q.y / r.y, q.z / r.z).normalize();
    return { p, n };
  };
}

/** Coordinates on a lofted surface: t along the path, th once around (th = 0 toward side); for scutes and scales to be grown lying along a limb */
function loftSurf(pts: THREE.Vector3[], prof: (t: number) => number[], side: THREE.Vector3): Surf {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const at = (t: number, th: number) => {
    const tt = THREE.MathUtils.clamp(t, 0, 1);
    const C = path.getPointAt(tt);
    const T = path.getTangentAt(tt);
    const W = side.clone().addScaledVector(T, -T.dot(side)).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const [a, b, dy = 0] = prof(tt);
    return C.addScaledVector(W, a * Math.cos(th)).addScaledVector(H, b * Math.sin(th) + dy);
  };
  return (t, th) => {
    const e = 1e-3;
    const dt = at(t + e, th).sub(at(t - e, th));
    const dh = at(t, th + e).sub(at(t, th - e));
    return { p: at(t, th), n: dt.cross(dh).normalize() };
  };
}

// ───────────────────────── Stone mountain ─────────────────────────

interface Ring {
  y: number;
  s: number;
  ox?: number;
  oz?: number;
}

interface Peak {
  geo: THREE.BufferGeometry;
  /** The vertices of each ring */
  P: THREE.Vector3[][];
  apex: THREE.Vector3;
}

/** With out as the outer side, push the triangle into the array (with the order swapped if reversed) */
function pushTri(pos: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3): void {
  const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  if (n.lengthSq() < 1e-14) return;
  if (n.dot(out) < 0) [b, c] = [c, b];
  pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

function flatGeo(pos: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Multifaceted stone peak: the same irregular polygon stacked ring after ring, shrinking and shifting upward (each ring a homothetic copy of the base ring),
 * so every face is a flat trapezoid, the cartoon shading one color step per face and not breaking into triangular blocks of color. Where two rings are close in height and shrink a lot is a rock ledge.
 */
function peakGeo(poly: [number, number][], R: number, cx: number, cz: number, rings: Ring[], apex: THREE.Vector3): Peak {
  const P = rings.map((r) => poly.map(([px, pz]) => v(cx + (r.ox ?? 0) + r.s * R * px, r.y, cz + (r.oz ?? 0) + r.s * R * pz)));
  const pos: number[] = [];
  const n = poly.length;
  for (let k = 0; k < rings.length - 1; k++) {
    const ax = v(cx + (rings[k].ox ?? 0), 0, cz + (rings[k].oz ?? 0));
    for (let j = 0; j < n; j++) {
      const a = P[k][j];
      const b = P[k][(j + 1) % n];
      const c = P[k + 1][(j + 1) % n];
      const d = P[k + 1][j];
      const mid = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
      const out = v(mid.x - ax.x, 0, mid.z - ax.z).normalize().add(v(0, 0.5, 0));
      pushTri(pos, a, b, c, out);
      pushTri(pos, a, c, d, out);
    }
  }
  const L = P[P.length - 1];
  for (let j = 0; j < n; j++) {
    const a = L[j];
    const b = L[(j + 1) % n];
    const out = a.clone().add(b).multiplyScalar(0.5).sub(apex).setY(0).normalize().add(v(0, 0.6, 0));
    pushTri(pos, a, b, apex, out);
  }
  return { geo: flatGeo(pos), P, apex };
}

/** Between ring k and ring k + 1 of the stone peak, the center and outward normal of face j */
function facet(pk: Peak, k: number, j: number): { c: THREE.Vector3; n: THREE.Vector3 } {
  const n = pk.P[0].length;
  const a = pk.P[k][j];
  const b = pk.P[k][(j + 1) % n];
  const c = pk.P[k + 1][(j + 1) % n];
  const d = pk.P[k + 1][j];
  const mid = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
  const nn = new THREE.Vector3().crossVectors(b.clone().sub(a), d.clone().sub(a)).normalize();
  const ax = pk.P[k].reduce((s, p) => s.add(p), v(0, 0, 0)).multiplyScalar(1 / n);
  if (nn.dot(mid.clone().sub(ax).setY(0)) < 0) nn.negate();
  return { c: mid, n: nn };
}

/** A point on a face: between ring k and k + 1, a is along the edge (0-1, from vertex j to j + 1) and b is going up (0-1) */
function onFacet(pk: Peak, k: number, j: number, a: number, b: number): THREE.Vector3 {
  const n = pk.P[0].length;
  const lo = pk.P[k][j].clone().lerp(pk.P[k][(j + 1) % n], a);
  const hi = pk.P[k + 1][j].clone().lerp(pk.P[k + 1][(j + 1) % n], a);
  return lo.lerp(hi, b);
}

/** Among the faces of ring k of the stone peak, the one whose outward normal is closest to dir */
function facetToward(pk: Peak, k: number, dir: THREE.Vector3): number {
  let best = 0;
  let bd = -2;
  for (let j = 0; j < pk.P[0].length; j++) {
    const d = facet(pk, k, j).n.dot(dir);
    if (d > bd) {
      bd = d;
      best = j;
    }
  }
  return best;
}

/**
 * Snow cap: covering the rock face above ring kS, scaled by k times about Q (a homothety), each patch of snow still flat;
 * the lower edge is between ring kS and ring kS + 1, each vertex and each face midpoint at a height of its own, dripping down in sawteeth. A ring of side wall is added along the lower edge to join back to the rock face, so the snow has thickness.
 */
function snowGeo(pk: Peak, kS: number, lo: (j: number, mid: boolean) => number, Q: THREE.Vector3, k: number): THREE.BufferGeometry {
  const n = pk.P[0].length;
  const pos: number[] = [];
  const sc = (p: THREE.Vector3) => Q.clone().add(p.clone().sub(Q).multiplyScalar(k));
  const up = v(0, 0.4, 0);
  for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n;
    const b0 = onFacet(pk, kS, j, 0, lo(j, false));
    const bm = onFacet(pk, kS, j, 0.5, lo(j, true));
    const b1 = onFacet(pk, kS, j, 1, lo(j1, false));
    const t0 = pk.P[kS + 1][j];
    const t1 = pk.P[kS + 1][j1];
    const f = facet(pk, kS, j).n.add(up);
    pushTri(pos, sc(t0), sc(b0), sc(bm), f);
    pushTri(pos, sc(t0), sc(bm), sc(b1), f);
    pushTri(pos, sc(t0), sc(b1), sc(t1), f);
    // Side wall: the lower edge of the snow joining back to the rock face
    const cen = t0.clone().add(t1).multiplyScalar(0.5);
    for (const [x, y] of [[b0, bm], [bm, b1]]) {
      const down = x.clone().add(y).multiplyScalar(0.5).sub(cen);
      pushTri(pos, x, y, sc(y), down);
      pushTri(pos, x, sc(y), sc(x), down);
    }
  }
  for (let kk = kS + 1; kk < pk.P.length - 1; kk++)
    for (let j = 0; j < n; j++) {
      const f = facet(pk, kk, j).n.add(up);
      const a = sc(pk.P[kk][j]);
      const b = sc(pk.P[kk][(j + 1) % n]);
      const c = sc(pk.P[kk + 1][(j + 1) % n]);
      const d = sc(pk.P[kk + 1][j]);
      pushTri(pos, a, b, c, f);
      pushTri(pos, a, c, d, f);
    }
  const L = pk.P[pk.P.length - 1];
  const A = sc(pk.apex);
  for (let j = 0; j < n; j++) {
    const a = L[j];
    const b = L[(j + 1) % n];
    const out = a.clone().add(b).multiplyScalar(0.5).sub(pk.apex).setY(0).normalize().add(v(0, 0.6, 0));
    pushTri(pos, sc(a), sc(b), A, out);
  }
  return flatGeo(pos);
}

/** A layered pine tree: a seven-sided lathe body, the lower edge of each layer flaring outward, each face with its own normal */
function pineGeo(h: number, r: number): THREE.BufferGeometry {
  const prof: [number, number][] = [[0.001, -0.03], [r * 0.22, -0.03], [r * 0.22, h * 0.08]];
  const tiers = [[1, 0.1], [0.78, 0.36], [0.54, 0.6]];
  for (let i = 0; i < tiers.length; i++) {
    const [k, y] = tiers[i];
    prof.push([r * k, h * y], [r * k * 0.46, h * (y + 0.22)]);
  }
  prof.push([0.001, h]);
  const g = lathe(prof, 7).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/** A crystal of a hexagonal column with a pointed top, each face with its own normal */
function crystalGeo(r: number, len: number): THREE.BufferGeometry {
  const g = lathe([[0.001, -0.05], [r, -0.02], [r * 0.92, len * 0.72], [0.001, len]], 6).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/** Apply vertex colors to a geometry (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  const q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const c = f(q.fromBufferAttribute(p, i));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildTerragonLab(): LabModel {
  const rand = rng(20261001);
  const jit = (a: number) => (rand() - 0.5) * 2 * a;
  const RIMC = 0xffe4b4;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const SKIN = 0x86a062;
  const SKIN_DK = 0x66804a;
  const HORN = 0xeee0b2;
  const THROAT = 0xc8ca8e;
  const M = {
    skin: labToon(SKIN, { rim: 0.6, rimColor: RIMC }),
    skinDk: labToon(SKIN_DK, { rim: 0.5, rimColor: RIMC }),
    painted: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    scute: vc(labToon(0xffffff, { rim: 0.45, rimColor: RIMC })),
    seam: labToon(0x4a372c, { rim: 0.2 }),
    plastron: labToon(0xd8c28a, { rim: 0.3 }),
    meadow: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xeaffb0 })),
    rock: labToon(0x9d958c, { speckle: 0.1, rim: 0.5, rimColor: 0xe8f0ff }),
    snow: labToon(0xe2e9f1, { rim: 0.35, rimColor: 0xffffff }),
    pine: labToon(0x2f6a40, { rim: 0.5, rimColor: 0xd8ffb0 }),
    amber: labToon(0xffb040, { ramp: 'gem', emissive: 0xff7a10, emissiveAmt: 0.55, spec: 1.4, specTh: 0.88, rim: 0.6, rimColor: 0xfff0b0 }),
    sand: labToon(0xdcc9a0, { speckle: 0.08, rim: 0.5 }),
    sandDk: labToon(0xb8a07a, { speckle: 0.08, rim: 0.4 }),
    roof: labToon(0xb0553e, { rim: 0.45 }),
    wood: labToon(0x7a5234, { rim: 0.3 }),
    dark: labToon(0x2e2420, { rim: 0 }),
    gold: labToon(0xe2ad48, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    win: labToon(0xffd070, { ramp: 'gem', emissive: 0xffa020, emissiveAmt: 0.75, rim: 0 }),
    nail: labToon(0x5a4a3a, { spec: 0.7, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    eye: labToon(0x2a1a10, { ramp: 'gem', rim: 0 }),
    iris: labToon(0xf2a434, { ramp: 'gem', emissive: 0xb86a10, emissiveAmt: 0.2, rim: 0 }),
    irisIn: labToon(0xc4701e, { ramp: 'gem', rim: 0 }),
    pupil: labToon(0x1a0f08, { rim: 0 }),
    line: labToon(0x2e2a1c, { rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'terragon-lab';
  const { add, group } = partKit();
  /**
   * Small parts of the same material are merged into one mesh (far fewer draw calls, and the outline pass too): each piece gets its transform relative to parent applied and is then merged.
   * at is the object the part sits in (or a matrix relative to parent is given directly). Parts that touch each other are put in different batches k, so two adjacent pieces have different part indices and the lines between them are kept.
   */
  const batch = (parent: THREE.Object3D, mat: THREE.Material) => {
    const parts = new Map<number, THREE.BufferGeometry[]>();
    const put = (g: THREE.BufferGeometry, at: THREE.Object3D | THREE.Matrix4, pos?: V3, rot?: V3, scl?: V3, k = 0) => {
      let m: THREE.Matrix4;
      if (at instanceof THREE.Matrix4) m = at.clone();
      else {
        at.updateWorldMatrix(true, false);
        parent.updateWorldMatrix(true, false);
        m = parent.matrixWorld.clone().invert().multiply(at.matrixWorld);
      }
      m.multiply(mtx(pos, rot, scl));
      if (!parts.has(k)) parts.set(k, []);
      parts.get(k)!.push(g.clone().applyMatrix4(m));
    };
    const done = () => [...parts.values()].map((p) => add(parent, mergeParts(p), mat));
    return { put, done };
  };
  // The whole animal is shifted back so the midpoint from head to tail lands on the pivot, centered in all four views
  const rig = group(root, [0, 0, -0.18]);

  // Outline part indices: no lines between members of the same group
  const HEAD = 9301;
  const NECK = 9302;

  // Body (rising and falling slightly with breathing); the four feet hang directly on rig, so they stand firmly on the ground
  const body = group(rig);

  // ── Carapace: a high-arched ellipsoid, the lower edge raised at the front so the head can reach out, a gap at each of the positions of the fore and hind feet, the rear edge flaring outward ──
  const CC = v(0, 0.34, -0.06);
  const AX = 0.64;
  const AY = 0.5;
  const AZ = 0.76;
  const flare = (az: number) => 0.25 + 0.75 * Math.max(0, -Math.cos(az)) ** 2;
  const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
  const elMin = (az: number) => {
    const a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az)));
    return -0.16 + 0.38 * Math.pow(Math.max(0, Math.cos(az)), 8) + 0.26 * bump(a, 0.82, 0.3) + 0.2 * bump(a, 2.34, 0.3);
  };
  const domeP = (az: number, el: number) => {
    const rf = Math.cos(el) * (1 + (flare(az) * 1.4 * Math.max(0, -el) ** 2) / 0.3);
    return v(CC.x + Math.sin(az) * AX * rf, CC.y + AY * Math.sin(el), CC.z + Math.cos(az) * AZ * rf);
  };
  const domeS: Surf = (az, el) => {
    const e = 1e-3;
    const p = domeP(az, el);
    const da = domeP(az + e, el).sub(domeP(az - e, el));
    const de = domeP(az, el + e).sub(domeP(az, el - e));
    return { p, n: da.cross(de).normalize() };
  };
  /** The height of the top of the shell (el ≥ 0) at horizontal position (x, z) */
  const domeY = (x: number, z: number) => CC.y + AY * Math.sqrt(Math.max(0, 1 - (x / AX) ** 2 - ((z - CC.z) / AZ) ** 2));

  const shell = group(body);
  // Base shell: the dark gaps between scutes, which is what you see looking into the seams between scutes; the lower edge closing inward into a lip
  {
    const NA = 72;
    const NE = 14;
    add(shell, gridGeo(NA + 1, NE + 2, (i, j) => {
      const az = (i / NA) * PI * 2;
      const e0 = elMin(az) - 0.05;
      if (j < 2) {
        const p = domeP(az, e0);
        const k = j === 0 ? 0.12 : 0.03;
        const hz = v(p.x - CC.x, 0, p.z - CC.z).normalize();
        return { p: p.addScaledVector(hz, -k).add(v(0, -0.01 * (2 - j), 0)) };
      }
      const t = (j - 2) / (NE - 1);
      return { p: domeP(az, e0 + (PI / 2 - 0.001 - e0) * t) };
    }, true), M.seam);
  }
  // Scutes: a ring of marginal scutes and two rows of costal scutes, separate piece by piece with thickness, light amber at the center and gradually deeper going outward through ring after ring of growth-ring steps
  const SC: [number, number, number] = [0xc49a62, 0x94704a, 0x6e5238];
  const scute = (azc: number, e0: number, e1: number, w: number, th: number, sq: number, rings: number, seg: number) => {
    const elc = (e0 + e1) / 2;
    const da = domeS(azc + 1e-3, elc).p.sub(domeS(azc - 1e-3, elc).p).length() / 2e-3;
    const de = domeS(azc, elc + 1e-3).p.sub(domeS(azc, elc - 1e-3).p).length() / 2e-3;
    const gap = 0.006;
    const surf: Surf = (u, vv) => domeS(azc + u, elc + vv);
    return plateGeo(surf, { hu: w / 2 - gap / da, hv: (e1 - e0) / 2 - gap / de, th, sq, rings, cols: SC, seg });
  };
  /** A ring of scutes: the i-th goes into the (i % alt)-th mesh, adjacent scutes (including the pair joined head to tail) get different part indices, so the lines in the seams between scutes are kept */
  const scuteRing = (n: number, alt: number, make: (i: number) => THREE.BufferGeometry) => {
    const parts: THREE.BufferGeometry[][] = Array.from({ length: alt }, () => []);
    for (let i = 0; i < n; i++) parts[i % alt].push(make(i));
    for (const pp of parts) add(shell, mergeParts(pp), M.scute);
  };
  const NM = 26;
  const mTop = (az: number) => Math.max(0.15, elMin(az) + 0.14);
  scuteRing(NM, 2, (i) => {
    const az = (i / NM) * PI * 2;
    return scute(az, elMin(az), mTop(az), (PI * 2) / NM, 0.024, 9, 1, 16);
  });
  const NC = 11;
  scuteRing(NC, 3, (i) => {
    const az = ((i + 0.5) / NC) * PI * 2;
    return scute(az, mTop(az) + 0.004, 0.5, (PI * 2) / NC, 0.03, 5, 2, 20);
  });
  const NU = 8;
  scuteRing(NU, 2, (i) => {
    const az = (i / NU) * PI * 2;
    return scute(az, 0.504, 0.86, (PI * 2) / NU, 0.03, 5, 2, 20);
  });

  // ── The grass on top of the shell: one whole sheet covering the scutes, the lower edge undulating; the place at the back where the dwarves live has a larger stretch of grass ──
  const edgeM = (az: number) => 0.68 + 0.05 * Math.sin(3 * az + 0.5) + 0.03 * Math.sin(7 * az + 1.3) + 0.015 * Math.sin(15 * az) - 0.1 * Math.max(0, -Math.cos(az)) ** 2;
  const MEAD = 0.05;
  {
    const NA = 96;
    // Sampling upward: the rings at the lower edge denser, and the stretch where moss color turns to grass color has sample points
    const F = [0, 0.047, 0.09, 0.14, 0.22, 0.32, 0.44, 0.58, 0.73, 0.87, 1];
    const moss = new THREE.Color(0x6f8c3a);
    const grass = new THREE.Color(0x96b24c);
    add(shell, gridGeo(NA + 1, F.length + 1, (i, j) => {
      const az = (i / NA) * PI * 2;
      const e0 = edgeM(az);
      if (j === 0) {
        const s = domeS(az, e0 - 0.01);
        return { p: s.p.addScaledVector(s.n, 0.0), c: moss };
      }
      const el = e0 + (PI / 2 - 0.001 - e0) * F[j - 1] ** 1.3;
      const s = domeS(az, el);
      return { p: s.p.addScaledVector(s.n, MEAD), c: moss.clone().lerp(grass, ss(el - e0, 0.02, 0.07)) };
    }, true), M.meadow);
  }
  /** A point on the grass: the horizontal position (x, z) */
  const onMeadow = (x: number, z: number) => v(x, domeY(x, z) + MEAD, z);

  // ── Stone mountain: the main peak leaning back, gentle in front and steep behind; a shoulder peak at the front right, and a small peak each at the front left and the rear ──
  const poly = (n: number, seed: number, squash = 1): [number, number][] => {
    const r = rng(seed);
    return Array.from({ length: n }, (_, i) => {
      // The changes in angle and radius must not be too large: when the turn between two adjacent faces gets close to the outline's normal threshold, the ridge line turns into a dashed line
      const a = ((i + (r() - 0.5) * 0.2) / n) * PI * 2;
      const k = 0.9 + r() * 0.2;
      return [Math.sin(a) * k, Math.cos(a) * k * squash] as [number, number];
    });
  };
  const peaks: Peak[] = [];
  const addPeak = (pk: Peak) => {
    add(shell, pk.geo, M.rock);
    peaks.push(pk);
    return pk;
  };
  // Main peak: the rings at the back pushed back, the face at the back almost vertical (the cliff wall of the canyon)
  const A = addPeak(peakGeo(poly(9, 7), 0.44, -0.05, -0.06, [
    { y: 0.6, s: 1 },
    { y: 0.86, s: 0.95, oz: -0.01 },
    { y: 1.04, s: 0.76, oz: -0.06 },
    { y: 1.08, s: 0.65, oz: -0.07 },
    { y: 1.25, s: 0.44, oz: -0.11 },
    { y: 1.28, s: 0.36, oz: -0.12 },
    { y: 1.4, s: 0.17, oz: -0.14 },
  ], v(-0.09, 1.5, -0.2)));
  const B = addPeak(peakGeo(poly(8, 11), 0.26, 0.31, 0.15, [
    { y: 0.62, s: 1 },
    { y: 0.92, s: 0.8, ox: 0.02 },
    { y: 0.95, s: 0.66, ox: 0.02 },
    { y: 1.14, s: 0.3, ox: 0.03 },
  ], v(0.35, 1.25, 0.14)));
  const D = addPeak(peakGeo(poly(8, 19), 0.21, -0.35, 0.12, [
    { y: 0.6, s: 1 },
    { y: 0.86, s: 0.72 },
    { y: 0.89, s: 0.6 },
    { y: 1.04, s: 0.28 },
  ], v(-0.38, 1.13, 0.1)));
  const C = addPeak(peakGeo(poly(8, 23), 0.25, 0.26, -0.44, [
    { y: 0.52, s: 1 },
    { y: 0.86, s: 0.76, oz: -0.02 },
    { y: 0.89, s: 0.64, oz: -0.02 },
    { y: 1.1, s: 0.3, oz: -0.03 },
  ], v(0.27, 1.21, -0.48)));
  addPeak(peakGeo(poly(8, 29), 0.18, -0.31, -0.42, [
    { y: 0.52, s: 1 },
    { y: 0.84, s: 0.7 },
    { y: 0.98, s: 0.3 },
  ], v(-0.32, 1.06, -0.43)));

  // Snow cap: the main peak from the upper rock ledge up, the lower edge dripping down in sawteeth on the cliff face below the ledge; the shoulder peak and rear peak have only a small patch at the summit
  const snowLo = (seed: number, base: number, amp: number) => {
    const r = rng(seed);
    const t = Array.from({ length: 24 }, () => r());
    return (j: number, mid: boolean) => base + (mid ? -amp * (0.5 + t[j * 2 + 1] * 0.5) : amp * (t[j * 2] - 0.5) * 0.6);
  };
  add(shell, snowGeo(A, 3, snowLo(3, 0.55, 0.42), v(-0.07, 1.24, -0.16), 1.07), M.snow);
  add(shell, snowGeo(B, 2, snowLo(5, 0.62, 0.4), v(0.34, 1.08, 0.15), 1.08), M.snow);
  add(shell, snowGeo(C, 2, snowLo(9, 0.66, 0.4), v(0.27, 1.02, -0.46), 1.08), M.snow);

  // ── Earth Source Crystal: the rock face at the front right of the main peak splits, and a cluster of amber crystal columns grows out and up, a ring of broken rock at the root ──
  const crystals = group(shell);
  let crystalAnchor: THREE.Group;
  {
    // Find the face of the main peak between rings 1 and 2 that faces the front right
    let best = 0;
    let bd = -2;
    for (let j = 0; j < 9; j++) {
      const d = facet(A, 1, j).n.dot(v(0.55, 0, 0.83).normalize());
      if (d > bd) {
        bd = d;
        best = j;
      }
    }
    const f = facet(A, 1, best);
    const at = onFacet(A, 1, best, 0.5, 0.45).addScaledVector(f.n, -0.02);
    const g = group(crystals, [at.x, at.y, at.z]);
    const out = f.n.clone().add(v(0, 0.55, 0)).normalize();
    g.quaternion.setFromUnitVectors(UP, out);
    // The split: a ring of rock plates at the root of the crystal cluster turned outward, lifted flat against the rock face
    // Adjacent pieces go into different meshes (piece 0 and piece 6 are also adjacent, so three batches)
    const flaps = batch(g, M.rock);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2 + 0.2;
      flaps.put(taper(rbox(0.07 + jit(0.01), 0.022, 0.05, 0.008, 1), [0.55, 0.7], [1, 1]), mtx([Math.cos(a) * 0.07, 0.0, Math.sin(a) * 0.07], [0, -a, 0]), [0.02, 0.0, 0], [0, 0, -0.55 + jit(0.15)], undefined, i === 6 ? 2 : i % 2);
    }
    flaps.done();
    for (const [len, r, rx, rz, ox, oz] of [
      [0.3, 0.055, 0, 0, 0, 0],
      [0.22, 0.045, 0.35, -0.5, 0.05, 0.02],
      [0.18, 0.038, -0.45, 0.4, -0.05, 0.02],
      [0.12, 0.03, 0.2, 0.75, 0.02, -0.05],
      [0.1, 0.026, -0.7, -0.6, -0.03, -0.045],
    ] as number[][]) add(g, crystalGeo(r, len), M.amber, [ox, -0.02, oz], [rx, jit(0.5), rz]);
    // Anchor: the middle of the main crystal column
    crystalAnchor = group(g, [0, 0.12, 0]);
  }

  // ── Pine groves: in groups of three or five on the grass, one clump each at the front left, the right side and the back, and a few scattered on the rock ledges ──
  // The pine trees are merged into three meshes: two adjacent trees in the same clump land in different meshes
  const pines = batch(shell, M.pine);
  let pineN = 0;
  const pine = (x: number, z: number, h: number, sink = 0.01) => {
    const p = onMeadow(x, z);
    pines.put(pineGeo(h, h * 0.36), shell, [p.x, p.y - sink, p.z], [jit(0.06), rand() * PI, jit(0.06)], undefined, pineN++ % 3);
  };
  for (const [x, z, h] of [
    [-0.46, 0.3, 0.17], [-0.36, 0.38, 0.14], [-0.52, 0.16, 0.13], [-0.22, 0.4, 0.11],
    [0.5, -0.08, 0.16], [0.52, 0.06, 0.12], [0.42, -0.2, 0.13],
    [-0.47, -0.2, 0.15], [-0.42, -0.08, 0.12], [-0.1, -0.56, 0.12],
  ] as [number, number, number][]) pine(x, z, h);
  // Small pines on the rock ledges
  const ledgePine = (pk: Peak, k: number, j: number, h: number) => {
    const p = onFacet(pk, k, j, 0.5, 0.5);
    pines.put(pineGeo(h, h * 0.36), shell, [p.x, p.y - 0.005, p.z], [0, rand() * PI, 0], undefined, pineN++ % 3);
  };
  ledgePine(A, 2, facetToward(A, 2, v(-0.8, 0.3, 0.5).normalize()), 0.09);
  ledgePine(D, 1, facetToward(D, 1, v(-0.3, 0.3, 0.9).normalize()), 0.07);
  pines.done();
  // Fallen rocks at the foot of the mountain: a few multifaceted rock blocks scattered at the foot of each peak, so the mountain looks like it grew out of the grass
  const rocks = batch(shell, M.rock);
  let rockN = 0;
  for (const pk of peaks) {
    const ring = pk.P[1];
    const n = ring.length;
    for (let j = 0; j < n; j += 2) {
      const p = ring[j].clone().lerp(ring[(j + 1) % n], 0.3 + rand() * 0.4);
      const c = ring.reduce((a, q) => a.add(q), v(0, 0, 0)).multiplyScalar(1 / n);
      const out = p.clone().sub(c).setY(0).normalize();
      const q = p.clone().addScaledVector(out, 0.03 + rand() * 0.03);
      if (q.x * q.x / (AX * AX) + ((q.z - CC.z) / AZ) ** 2 > 0.62) continue;
      const m = onMeadow(q.x, q.z);
      const r = 0.022 + rand() * 0.02;
      const g = new THREE.DodecahedronGeometry(r, 0);
      g.scale(1.3, 0.7, 1.1);
      rocks.put(g, shell, [m.x, m.y - r * 0.2, m.z], [jit(0.3), rand() * PI, jit(0.3)], undefined, rockN++ % 2);
    }
  }
  rocks.done();

  // ── Stoneheart Canyon: the dwarf city gate chiseled into the cliff wall on the rear side of the main peak, stone pillars on both sides, arch stones, a gold mountain-pattern emblem on the lintel; lamplight showing through the gap in the door, and a flight of stone steps before the gate ──
  // The stone, lamplight, wood and red tiles of the gate, windows, stone houses and watchtower are each merged into one or two meshes; the stone pieces that touch each other are split into two batches, A and B
  const sandB = batch(shell, M.sand);
  const sandDkB = batch(shell, M.sandDk);
  const winB = batch(shell, M.win);
  const woodB = batch(shell, M.wood);
  const roofB = batch(shell, M.roof);
  {
    const best = facetToward(A, 1, v(0, 0, -1));
    const f = facet(A, 1, best);
    const at = onFacet(A, 1, best, 0.5, 0.1);
    const face = f.n.clone().setY(0).normalize();
    const gate = group(shell, [at.x, at.y, at.z]);
    gate.quaternion.setFromUnitVectors(v(0, 0, 1), face);
    // Gate opening: a dark arched opening, two half-open wooden doors, the lamplight in the gap of the doors
    const archShape = (w: number, h: number) => {
      const s = new THREE.Shape();
      s.moveTo(-w, 0);
      s.lineTo(w, 0);
      s.lineTo(w, h - w);
      s.absarc(0, h - w, w, 0, PI, false);
      s.closePath();
      return s;
    };
    // Gate face: an arched stone frame chiseled into the cliff face, with the original rock wall around it
    sandB.put(slab(archShape(0.118, 0.25), 0.03, 0.008, 10), gate, [0, -0.01, 0.012]);
    add(gate, slab(archShape(0.05, 0.14), 0.02, 0.004, 8), M.dark, [0, 0.0, 0.03]);
    winB.put(slab(archShape(0.012, 0.11), 0.01, 0.002, 6), gate, [0, 0.0, 0.04]);
    for (const sx of [-1, 1]) woodB.put(rbox(0.038, 0.1, 0.012, 0.004, 1), gate, [sx * 0.03, 0.05, 0.043], [0, sx * 0.35, 0]);
    // Arch stones: the middle one is gold; of the rest, two adjacent ones go in the two batches A and B (the outermost two A, those next to the stone pillars B)
    const goldB = batch(gate, M.gold);
    for (let i = 0; i < 7; i++) {
      const a0 = (i / 7) * PI + 0.02;
      const a1 = ((i + 1) / 7) * PI - 0.02;
      const geo = slab(wedge(0.052, 0.078, a0, a1), 0.03, 0.004, 3);
      if (i === 3) goldB.put(geo, gate, [0, 0.09, 0.04]);
      else sandDkB.put(geo, gate, [0, 0.09, 0.04], undefined, undefined, i === 1 || i === 5 ? 1 : 0);
    }
    // Stone pillars (B) and capitals (A)
    for (const sx of [-1, 1]) {
      sandDkB.put(rbox(0.03, 0.15, 0.03, 0.006, 1), gate, [sx * 0.092, 0.075, 0.045], undefined, undefined, 1);
      sandDkB.put(rbox(0.044, 0.02, 0.04, 0.006, 1), gate, [sx * 0.092, 0.16, 0.047]);
    }
    // Lintel (B) and the gold emblem (a triangular mountain pattern)
    sandDkB.put(rbox(0.22, 0.026, 0.05, 0.008, 1), gate, [0, 0.182, 0.035], undefined, undefined, 1);
    goldB.put(slab(outline([[-0.028, 0], [-0.01, 0.022], [0.0, 0.014], [0.014, 0.03], [0.03, 0]]), 0.008, 0.003, 2), gate, [0, 0.198, 0.05]);
    goldB.done();
    // Stone steps before the gate: extending down to the grass, one step A and the next B
    for (let i = 0; i < 5; i++) sandDkB.put(rbox(0.13 - i * 0.004, 0.03, 0.05, 0.008, 1), gate, [0, -0.015 - i * 0.028, 0.06 + i * 0.045], undefined, undefined, i % 2);
    // Windows in the cliff face: arched stone frames with lamplight showing through; each lies flat against the rock face it sits on
    const win = (pk: Peak, k: number, j: number, a: number, b: number, s = 1) => {
      const ff = facet(pk, k, j);
      const p = onFacet(pk, k, j, a, b);
      const W = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), ff.n), v(s, s, s));
      sandDkB.put(slab(archShape(0.022, 0.05), 0.012, 0.003, 6), W, [0, -0.025, 0.002]);
      winB.put(slab(archShape(0.013, 0.038), 0.012, 0.002, 6), W, [0, -0.019, 0.006]);
    };
    win(A, 1, (best + 1) % 9, 0.35, 0.55, 1.35);
    win(A, 1, (best + 1) % 9, 0.72, 0.3, 1.2);
    win(A, 1, (best + 8) % 9, 0.62, 0.5, 1.35);
    win(A, 1, (best + 8) % 9, 0.25, 0.25, 1.2);
  }

  // ── The dwarves' stone houses under the cliff: three red-tiled stone houses on the grass, the windows showing lamplight; beside the rear peak a watchtower flying a gold flag ──
  const house = (x: number, z: number, w: number, yaw: number) => {
    const p = onMeadow(x, z);
    const H = mtx([p.x, p.y - 0.01, p.z], [0, yaw, 0]);
    sandB.put(rbox(w, w * 0.72, w * 0.8, 0.008, 1), H, [0, w * 0.36, 0]);
    const roof = outline([[-w * 0.62, 0], [w * 0.62, 0], [0, w * 0.5]]);
    roofB.put(slab(roof, w * 0.96, 0.004, 2), H, [0, w * 0.72, 0]);
    sandDkB.put(rbox(w * 0.16, w * 0.4, w * 0.16, 0.004, 1), H, [w * 0.26, w * 0.95, -w * 0.15]);
    winB.put(rbox(w * 0.2, w * 0.22, 0.006, 0.002, 1), H, [-w * 0.2, w * 0.4, w * 0.4]);
    woodB.put(rbox(w * 0.2, w * 0.36, 0.006, 0.002, 1), H, [w * 0.18, w * 0.18, w * 0.4]);
  };
  house(-0.18, -0.6, 0.1, PI + 0.3);
  house(0.06, -0.66, 0.09, PI - 0.15);
  house(-0.36, -0.5, 0.085, PI + 0.8);
  // Watchtower (the battlements at the top of the tower are a separate batch, so there is a line between them and the tower body)
  const flag = new THREE.Group();
  {
    const p = onMeadow(0.46, -0.36);
    const t = group(shell, [p.x, p.y - 0.02, p.z]);
    sandB.put(lathe([[0.001, 0], [0.05, 0], [0.046, 0.2], [0.056, 0.21], [0.056, 0.24], [0.001, 0.24]], 12), t);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      sandB.put(rbox(0.022, 0.026, 0.018, 0.004, 1), t, [Math.sin(a) * 0.046, 0.25, Math.cos(a) * 0.046], [0, a, 0], undefined, 1);
    }
    roofB.put(new THREE.ConeGeometry(0.052, 0.09, 8), t, [0, 0.29, 0]);
    winB.put(rbox(0.018, 0.028, 0.006, 0.002, 1), t, [0, 0.14, -0.048], [0, PI, 0]);
    woodB.put(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), t, [0, 0.38, 0]);
    t.add(flag);
    flag.position.set(0, 0.43, 0);
    add(flag, slab(outline([[0, 0], [0.07, -0.006], [0.058, -0.02], [0.07, -0.034], [0, -0.04]]), 0.004, 0.0015, 2), M.gold);
  }
  for (const b of [sandB, sandDkB, winB, woodB, roofB]) b.done();

  // ── Plastron and body: the pale plastron showing below the shell edge, the skin inside the leg holes ──
  add(body, new THREE.SphereGeometry(1, 32, 14), M.plastron, [0, 0.27, -0.05], [0, 0, 0], [0.54, 0.08, 0.66]);
  add(body, new THREE.SphereGeometry(1, 28, 12), M.skin, [0, 0.33, -0.04], [0, 0, 0], [0.56, 0.12, 0.68]);

  // ── Limbs: pillar feet as thick as an elephant's, the forelegs with elbows braced outward and a row of big scales on the forearm; round feet with five blunt claws ──
  // The four feet are merged into one mesh and the eighteen claws into one (the claws do not touch each other)
  const pads = batch(rig, M.skin);
  const nailB = batch(rig, M.nail);
  const foot = (x: number, z: number, sx: number, nails: number, r: number) => {
    pads.put(new THREE.SphereGeometry(1, 20, 10), rig, [x, 0.05, z], [0, 0, 0], [r, 0.06, r * 1.05]);
    for (let i = 0; i < nails; i++) {
      const a = ((i - (nails - 1) / 2) / nails) * 1.9 + sx * 0.12;
      nailB.put(taper(rbox(0.036, 0.03, 0.05, 0.012, 1), [0.6, 0.6], [1, 1]), mtx([x + Math.sin(a) * r * 0.92, 0.03, z + Math.cos(a) * r * 0.95], [0, a, 0]), [0, 0.0, 0.012], [0.35, 0, 0]);
    }
  };
  for (const sx of [-1, 1]) {
    const fpts = [v(sx * 0.24, 0.36, 0.26), v(sx * 0.43, 0.28, 0.4), v(sx * 0.48, 0.17, 0.45), v(sx * 0.48, 0.07, 0.47), v(sx * 0.48, 0.03, 0.47)];
    const fprof = curveTable([[0, 0, 0], [0.04, 0.09, 0.09], [0.12, 0.13, 0.13], [0.35, 0.135, 0.13], [0.6, 0.12, 0.12], [0.85, 0.125, 0.125], [0.96, 0.12, 0.12], [1, 0, 0]]);
    add(rig, loft(fpts, fprof, { segs: 28, radial: 18, side: X }), M.skin).userData.inkGroup = 9310 + sx;
    foot(sx * 0.48, 0.48, sx, 5, 0.14);
    // Big scales on the forearm: thick scales grown along the surface of the leg, three rows on the front outer side arranged staggered
    const legS = loftSurf(fpts, fprof, X);
    const thC = Math.atan2(-0.84, 0.55 * sx);
    // The big scales have the same outline index as the leg, so merging them into one mesh does not affect the lines
    const scales: THREE.BufferGeometry[] = [];
    for (let r = 0; r < 2; r++) {
      const t = 0.47 + r * 0.17;
      for (const k of r % 2 ? [-0.5, 0.5] : [-1, 0, 1]) {
        const th0 = thC + k * 0.62;
        scales.push(plateGeo((u, w) => legS(t + u, th0 + w), { hu: 0.092, hv: 0.3, th: 0.016, sq: 2.4, rings: 0, lean: 1.0, cols: [0x8aa264, 0x8aa264, 0x76904f], seg: 16 }));
      }
    }
    add(rig, mergeParts(scales), M.painted).userData.inkGroup = 9310 + sx;
    const rpts = [v(sx * 0.28, 0.34, -0.38), v(sx * 0.43, 0.25, -0.49), v(sx * 0.46, 0.14, -0.52), v(sx * 0.46, 0.06, -0.52), v(sx * 0.46, 0.03, -0.52)];
    add(rig, loft(rpts, curveTable([[0, 0, 0], [0.05, 0.1, 0.1], [0.15, 0.14, 0.14], [0.4, 0.14, 0.14], [0.7, 0.125, 0.125], [0.96, 0.13, 0.13], [1, 0, 0]]), { segs: 24, radial: 18 }), M.skin);
    foot(sx * 0.46, -0.52, sx, 4, 0.14);
  }
  pads.done();
  nailB.done();

  // ── Tail: a short tail under the pygal scute, with a horny point at the end ──
  const tail = group(body, [0, 0.27, -0.7], [0.35, 0, 0]);
  add(tail, loft([v(0, 0.02, 0.1), v(0, 0, -0.08), v(0, -0.05, -0.22)], curveTable([[0, 0, 0], [0.1, 0.075, 0.065], [0.5, 0.055, 0.048], [0.9, 0.026, 0.022], [1, 0, 0]]), { segs: 14, radial: 10 }), M.skin);
  add(tail, new THREE.ConeGeometry(0.015, 0.045, 8), M.nail, [0, -0.058, -0.235], [-1.9, 0, 0]);

  // ── Neck: reaching out from under the front edge of the shell, thick and wrinkled, the pale throat below ──
  // The neck extends level out from under the front edge of the shell and, once out of the shell, bends up, the head held high
  const neck = group(body, [0, 0.28, 0.42]);
  const neckPts = [v(0, 0.02, -0.14), v(0, -0.01, 0.14), v(0, 0.06, 0.3), v(0, 0.22, 0.44), v(0, 0.33, 0.5)];
  const neckProf = (t: number) => {
    const fold = t > 0.25 && t < 0.62 ? 0.07 * Math.pow(Math.max(0, Math.sin(((t - 0.25) / 0.37) * PI * 3)), 3) : 0;
    const r = THREE.MathUtils.lerp(0.155, 0.142, t) * (1 + fold) * Math.min(1, (1 - t) * 14 + 0.35) * Math.sqrt(Math.min(1, t * 9));
    return [r, r * 0.95, 0];
  };
  const throatC = new THREE.Color(THROAT);
  const skinC = new THREE.Color(SKIN);
  add(neck, paint(loft(neckPts, neckProf, { segs: 40, radial: 22 }), (p) => skinC.clone().lerp(throatC, ss(-(p.y - (0.02 + p.z * 0.45)), 0.02, 0.07))), M.painted).userData.inkGroup = NECK;

  // ── Head: the neck pivot handles looking around; the head's origin is at the center of the skull, the chin slightly lifted ──
  const head = group(neck, [0, 0.38, 0.52], [-0.12, 0, 0]);
  head.scale.setScalar(1.36);
  const SK = v(0.15, 0.13, 0.17);
  add(head, new THREE.SphereGeometry(1, 32, 22), M.skin, [0, 0, 0], [0, 0, 0], SK.toArray() as V3).userData.inkGroup = HEAD;
  // Muzzle: a round blunt snout drawing in toward the front, the front and lower part a cream horny upper beak (the vertex colors transitioning smoothly)
  const hornC = new THREE.Color(HORN);
  const beakLine = (p: THREE.Vector3) => -0.03 + (p.z - 0.12) * 0.55 - Math.abs(p.x) * 0.2;
  add(head, paint(loft([v(0, -0.01, 0.02), v(0, -0.035, 0.15), v(0, -0.055, 0.215)], curveTable([[0, 0, 0, 0], [0.12, 0.11, 0.1, 0], [0.4, 0.1, 0.085, 0], [0.75, 0.08, 0.068, -0.004], [0.92, 0.058, 0.05, -0.012], [1, 0, 0, -0.02]]), { segs: 26, radial: 28 }), (p) => skinC.clone().lerp(hornC, ss(beakLine(p) - p.y, -0.006, 0.006))), M.painted).userData.inkGroup = HEAD;
  // Lower beak: hidden a little behind the upper beak, the front end cream and turning to the pale throat going back
  add(head, paint(loft([v(0, -0.085, 0.0), v(0, -0.1, 0.12), v(0, -0.095, 0.19)], curveTable([[0, 0, 0], [0.15, 0.1, 0.05], [0.5, 0.082, 0.04], [0.85, 0.058, 0.03], [1, 0, 0]]), { segs: 20, radial: 18 }), (p) => throatC.clone().lerp(hornC, ss(p.z, 0.08, 0.1))), M.painted);
  // Nostrils
  for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(1, 12, 8), M.dark, [sx * 0.016, -0.03, 0.21], [0.5, 0, 0], [0.008, 0.0055, 0.006]);

  // Eyes: the eyeball half set into the side of the head, wrapped by two eyelids above and below; the eyes open and looking straight ahead, the iris filling the eye, the upper lid covering only to the upper edge of the iris; a heavy brow ridge pressing flat above
  const ER = 0.046;
  const UP_OPEN = 0.72;
  const LO_OPEN = 0.6;
  const lids: THREE.Group[] = [];
  const pupils: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidSkin = lidGeo(ER + 0.004, ER + 0.016, PI / 2);
  const lidLow = lidGeo(ER + 0.004, ER + 0.011, PI / 2);
  const lidLine = lidGeo(ER + 0.001, ER + 0.0045, PI / 2, 20, 4, 3);
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.094, 0.03, 0.097]);
    eg.quaternion.setFromUnitVectors(v(0, 0, 1), v(sx * 0.56, 0.06, 0.83).normalize());
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.06]);
    add(roll, new THREE.SphereGeometry(ER, 24, 16), M.eye);
    add(roll, diskDecal(0.74, 0.74, ER + 0.0008, 3, 28), M.iris);
    add(roll, diskDecal(0.5, 0.5, ER + 0.0016, 2, 24), M.irisIn);
    const pupil = add(roll, diskDecal(0.3, 0.3, ER + 0.0024, 2, 20), M.pupil);
    pupils.push(pupil);
    // Anchor: the center of the eyeball surface
    eyeAnchors.push(group(roll, [0, 0, ER]));
    for (const [x, y, rr] of [[-sx * 0.014, 0.017, 0.009], [sx * 0.013, -0.012, 0.0045]] as [number, number, number][]) {
      const hl = add(roll, new THREE.SphereGeometry(rr, 10, 7), M.hi, [x, y, ER * 0.95]);
      hl.layers.disable(INK_LAYER);
    }
    const upper = group(roll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidSkin, M.skin).userData.inkGroup = HEAD;
    const upLine = group(roll, [0, 0, 0], [-UP_OPEN + 0.09, 0, 0]);
    add(upLine, lidLine, M.line);
    const lower = group(roll, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lower, lidLow, M.skin).userData.inkGroup = HEAD;
    const loLine = group(roll, [0, 0, 0], [PI + LO_OPEN - 0.07, 0, 0]);
    add(loLine, lidLine, M.line);
    lids.push(upper, upLine);
    // Brow ridge: a thick, straight scaly ridge above the eye, pressing down above the upper lid
    const bpts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = 0.3 + (k / 8) * (PI - 0.6);
      const x = Math.cos(a) * ER * 1.36;
      bpts.push(v(x, ER * 0.74 + Math.sin(a) * ER * 0.1 + sx * x * 0.05, ER * 0.2 + Math.sin(a) * ER * 0.26));
    }
    add(roll, loft(bpts, (tt) => { const k = Math.pow(Math.sin(PI * tt), 0.45); return [0.019 * k, 0.013 * k]; }, { segs: 18, radial: 10 }), M.skinDk).userData.inkGroup = HEAD;
  }

  // The big scales on top of the head: one at the front of the forehead, one on each side, two behind, like a helmet; a round bulging tympanic scale on each cheek
  const HC: [number, number, number] = [0x96ad6e, 0x7f975a, 0x6a8049];
  const headPlate = (d: THREE.Vector3, hu: number, hv: number, roll = 0, cols = HC, sq = 3) =>
    plateGeo(ellipsoidSurf(v(0, 0, 0), SK, d, roll), { hu, hv, th: 0.01, sq, rings: 1, cols, seg: 20 });
  // The scales on top of the head fit into one sheet: arranged on the same projection plane with very thin seams, like a helmet and not patches pasted on one by one
  // The nine pieces go into three meshes, with two adjacent pieces never in the same mesh (the part indices differ, so the lines in the scale seams are there)
  {
    const top = ellipsoidSurf(v(0, 0, 0), SK, v(0, 0.9, 0.44));
    const tiles: THREE.BufferGeometry[][] = [[], [], []];
    const tile = (uc: number, wc: number, hu: number, hv: number, k: number) =>
      tiles[k].push(plateGeo((u, w) => top(uc + u, wc + w), { hu, hv, th: 0.006, sq: 2.8, rings: 1, cols: HC, seg: 20 }));
    tile(0, -0.08, 0.27, 0.3, 0);
    for (const sx of [-1, 1]) {
      tile(sx * 0.22, -0.64, 0.2, 0.24, sx > 0 ? 1 : 2);
      tile(sx * 0.58, -0.2, 0.28, 0.32, sx > 0 ? 2 : 1);
      tile(sx * 0.29, 0.56, 0.27, 0.3, sx > 0 ? 1 : 2);
      tile(sx * 0.82, 0.38, 0.22, 0.28, 0);
    }
    for (const tt of tiles) add(head, mergeParts(tt), M.painted);
    add(head, mergeParts([-1, 1].map((sx) => headPlate(v(sx * 1, -0.3, -0.25), 0.24, 0.26, 0, [0xd2d09a, 0xb9bb82, 0x9aa16a], 2))), M.painted);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: slow breathing, the head slowly looking around and nodding, blinking, the tail swaying lightly, the source crystal and lamplight glimmering faintly, the gold flag on the tower fluttering ──
  const act = { glow: 0, focus: 0 };
  let blinkIn = 2.8;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    const { glow, focus } = act;
    // focus: no more looking around, the head and pupils back straight ahead
    const still = 1 - focus;
    const br = Math.sin(t * 0.9);
    shell.position.y = br * 0.005;
    neck.rotation.y = (Math.sin(t * 0.26) * 0.14 + Math.sin(t * 0.71) * 0.02) * still;
    neck.rotation.x = Math.sin(t * 0.45) * 0.03;
    head.rotation.set(-0.12 + Math.sin(t * 0.45 + 0.8) * 0.025, 0, Math.sin(t * 0.26 + 0.7) * 0.03 * still);
    for (const p of pupils) p.position.x = Math.sin(t * 0.26 - 0.5) * 0.004 * still;

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 3.2 + ((t * 7.3) % 3);
    }
    let close = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.26;
      close = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.35) : 0;
      if (k >= 1) blinkT = -1;
    }
    for (let i = 0; i < lids.length; i++) lids[i].rotation.x = -UP_OPEN + (i % 2 ? 0.09 : 0) + (UP_OPEN + LO_OPEN - 0.02) * close;

    tail.rotation.set(0.35, Math.sin(t * 0.7) * 0.12, 0);
    flag.rotation.y = Math.sin(t * 2.3) * 0.25 + 0.2;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
    // glow: the source crystal, lamplight and iris brighten together (without relying on bloom, only to the point of not overexposing)
    M.amber.emissiveIntensity = 0.5 + pulse * 0.12 + glow * 0.25;
    M.win.emissiveIntensity = 0.7 + Math.sin(t * 3.1) * 0.03 + Math.sin(t * 5.3) * 0.02 + glow * 0.25;
    M.iris.emissiveIntensity = 0.2 + glow * 0.3;
  };
  update(0, 0);

  // ── Anchors ──
  const faceAnchor = group(head, [0, 0, 0.1]);
  // The plane of the lower edge of the carapace: the marginal scutes at the sides and rear are at y 0.26-0.33, outer radius x 0.68, z 0.8; the ultimate's rock layers have outer radius 0.6 (bulging out 1.05 times in the middle),
  // and after scaling by 1.15 the top layer is a ring wider than the marginal scutes and wraps the edge of the shell, each layer going down narrower than the one above, the bottom layer still a little off the ground (the same proportions as the old carapace)
  const shellAnchor = group(shell, [0, 0.3, CC.z]);
  shellAnchor.scale.setScalar(1.15);
  const anchors = {
    mouth: group(head, [0, -0.072, 0.205]),
    shell: shellAnchor,
    summit: group(shell, [-0.08, 1.32, -0.17]),
    crystal: crystalAnchor,
  };

  return { root, update, act, rig: { head: faceAnchor, eyes: eyeAnchors, anchors }, center: new THREE.Vector3(0, 0.78, 0), radius: 1.14 };
}
