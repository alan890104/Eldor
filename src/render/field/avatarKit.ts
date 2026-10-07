// Modeling tools for the map characters (hero, residents, prologue figures): head shape and the shapes on the face,
// thick shells (hair, hood, cape, skirt hem),
// hands, boots, materials and outline marks, and merging (mergePerson): the parts under one joint are baked into vertex
// colors and merged into a single mesh regardless of color or surface quality,
// about 15 draw calls per person. Materials are always spiritToon.ts's sceneMaterial (MeshToon),
// and outlines are left to ink.ts's inkScenery; no back-face outline meshes are used.
// The head shape is a sampling of KayKit's (CC0) skull (headData.ts); the eyes, brows and mouth on the face are flat shapes
// laid on the head shape (lit together with the head, no outline lines),
// while the nose, ears and other parts are thick geometry. Hair locks (hairLocks) grow against the bottom shell,
// with a crescent cross-section, roots buried in the bottom layer and tips tapering to a point.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature } from '../creature.ts';
import { inkScenery, tagInkPart } from '../ink.ts';
import { rampTexture } from '../lab/toonKit.ts';
import { outline } from '../lab/shapes.ts';
import { sceneMaterial, type SpiritMaterial, type SpiritSurface } from '../spiritToon.ts';
import { HEAD_GRID, HEAD_REF } from './headData.ts';

export type V3 = [number, number, number];
export const PI = Math.PI;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
export const smoothstep = (x: number, a: number, b: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ───────────────────────── Materials ─────────────────────────

/**
 * Gradient for skin and the shapes on the face: the shadows are not pushed to full black and the light-to-shade boundary
 * retreats toward the unlit side, so the face is not cut in half by a boundary line (pitfall 40)
 */
let skinRamp: THREE.DataTexture | null = null;
const SKIN_STOPS: [number, number][] = [[-1, 0.5], [-0.3, 0.8], [0.25, 1]];

/**
 * Outline groups of the parts: meshes in the same group share a number and no boundary line is drawn between them (lines
 * only fall at boundaries between different materials, normal creases and front-to-back occlusion)
 */
export const ROLE = { skin: 1, hair: 2, top: 3, topDark: 4, bottom: 5, boots: 6, sole: 7, trim: 8, cape: 9, gear: 10, gear2: 11, metal: 12, cloth: 13, hat: 14, mask: 15, beard: 16 } as const;
export type Role = keyof typeof ROLE;
/**
 * The scene outline's inkGroup is a key shared across the whole scene; characters start at 7100 so as not to collide with the arena props' numbers
 */
export const ROLE_BASE = 7100;

/**
 * Each character's own material library: the same color and surface quality share one material,
 * and all are registered in Creature.mats (white flash, fade-out and silhouette keep working).
 * Parts are first assembled with their own materials, then mergePerson bakes them into the one vertex-color material (vc());
 * materials left unused are dropped by prune().
 */
export class Mats {
  private cache = new Map<string, SpiritMaterial>();
  private basics = new Map<string, THREE.MeshBasicMaterial>();
  private c: Creature;
  private vcMat: SpiritMaterial | null = null;
  private toons = new Set<SpiritMaterial>();
  constructor(c: Creature) {
    this.c = c;
  }

  /** This material was built by toon() (it can be baked into vertex colors); materials of the shapes on the face do not count */
  owns(m: THREE.Material): boolean {
    return this.toons.has(m as SpiritMaterial);
  }

  /**
   * The vertex-color material shared by the whole person: color, gradient row, specular, rim light and emissive are all on
   * the vertices, and the white flash, fade-out and silhouette still go through Creature.mats
   */
  vc(): SpiritMaterial {
    if (!this.vcMat) {
      this.vcMat = vcMaterial();
      this.c.mats.push(this.vcMat);
    }
    return this.vcMat;
  }

  /** Materials no mesh uses after merging: removed from Creature.mats and disposed */
  prune(root: THREE.Object3D): void {
    const used = new Set<THREE.Material>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) for (const x of Array.isArray(m.material) ? m.material : [m.material]) used.add(x);
    });
    for (const [k, m] of this.cache) {
      if (used.has(m)) continue;
      this.cache.delete(k);
      this.toons.delete(m);
      const i = this.c.mats.indexOf(m);
      if (i >= 0) this.c.mats.splice(i, 1);
      m.dispose();
    }
  }

  /** spec: strength of the hard specular highlight; lowered for large smooth metal (helmets, breastplates) so a whole piece is not white */
  toon(color: THREE.ColorRepresentation, o: { surface?: SpiritSurface; skin?: boolean; emissive?: THREE.ColorRepresentation; emissiveAmt?: number; rim?: number; spec?: number } = {}): SpiritMaterial {
    const key = `${new THREE.Color(color).getHexString()}|${o.surface ?? ''}|${o.skin ? 1 : 0}|${o.emissive ?? ''}|${o.emissiveAmt ?? 0}|${o.rim ?? ''}|${o.spec ?? ''}`;
    let m = this.cache.get(key);
    if (!m) {
      m = sceneMaterial(color, { surface: o.surface, emissive: o.emissive, emissiveAmt: o.emissiveAmt, rim: o.rim });
      if (o.spec !== undefined) m.uniforms.uSpec.value = o.spec;
      if (o.skin) {
        skinRamp ??= rampTexture(SKIN_STOPS);
        m.gradientMap = skinRamp;
      }
      this.cache.set(key, m);
      this.toons.add(m);
      this.c.mats.push(m);
    }
    return m;
  }

  /**
   * The material shared by the shapes on the face: vertex colors, the skin gradient, pushed slightly toward the camera (polygonOffset).
   * All the shapes are merged into one mesh, and shapes added later are lifted higher and drawn later, so they lie on top.
   */
  face(): SpiritMaterial {
    let m = this.cache.get('face');
    if (!m) {
      m = sceneMaterial(0xffffff, { rim: 0.18 });
      skinRamp ??= rampTexture(SKIN_STOPS);
      m.gradientMap = skinRamp;
      m.vertexColors = true;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -2;
      this.cache.set('face', m);
      this.c.mats.push(m);
    }
    return m;
  }

  /** Unlit flat color (eye highlights, glowing lamp wicks): registered in glows, so it fades along with the rest on fade-out */
  basic(color: THREE.ColorRepresentation, intensity = 1): THREE.MeshBasicMaterial {
    const key = `${new THREE.Color(color).getHexString()}|${intensity}`;
    let m = this.basics.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: intensity <= 1 });
      this.basics.set(key, m);
      this.c.glows.push(m);
    }
    return m;
  }
}

/** Assembly: when a mesh is added, its outline group is tagged along; noInk parts (the flat shapes on the face) get no outline lines */
export function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, role: Role | null, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale?: V3): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  if (role) m.userData.inkGroup = ROLE_BASE + ROLE[role];
  else m.userData.noInk = true;
  parent.add(m);
  return m;
}

export function group(parent: THREE.Object3D, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.rotation.set(...rot);
  parent.add(g);
  return g;
}

/** Called after the whole character is built: opaque toon meshes go into the outline layer, and the shapes on the face are skipped */
export function inkPerson(root: THREE.Object3D): void {
  inkScenery(root, { skip: (m) => !!m.userData.noInk });
}

// ───────────────────────── Merging ─────────────────────────

function prepGeo(g: THREE.BufferGeometry, mat: THREE.Matrix4): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position').clone());
  if (g.getAttribute('color')) out.setAttribute('color', g.getAttribute('color').clone());
  // The light and dark carried by the original meshes (KayKit's head): multiplied in when baking vertex colors
  if (g.getAttribute('shade')) out.setAttribute('shade', g.getAttribute('shade').clone());
  if (g.index) out.setIndex(g.index.clone());
  else {
    const n = out.getAttribute('position').count;
    const idx = new Array<number>(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    out.setIndex(idx);
  }
  // Set the index first and then fill in the normals, so indexed geometry is not treated as separate individual triangles
  if (g.getAttribute('normal')) out.setAttribute('normal', g.getAttribute('normal').clone());
  else out.computeVertexNormals();
  out.applyMatrix4(mat);
  return out;
}

/**
 * Outline group -> part id in the merged mesh (ink.ts's tagInkPart). The scene has only 15 part ids (mod 15); of the 16 outline groups,
 * the beard (elder) and the mask (masked figure) never appear on the same person, so they share one id;
 * the others each get their own, so there are part lines between different groups and none within a group.
 */
function rolePart(g: number): number {
  return g === ROLE_BASE + ROLE.beard ? ROLE.mask - 1 : g - ROLE_BASE - 1;
}
/**
 * The outline group of the merged mesh: the game's ink.ts adds the part id to it to compute the line id;
 * the lab bench's inkPipeline takes "outline group + part id" and then applies the golden ratio,
 * counting from ROLE_BASE + 1, so each outline group's line id on the bench is exactly what it was before merging (the beard
 * is an exception, borrowing the mask's id)
 */
const MERGED_GROUP = ROLE_BASE + 1;

/**
 * The vertex-color material's gradient: matte, metal, gem and skin rows stacked into one texture (256 × 4,
 * nearest sampling), and the vertex's avMat.x picks the row; the sampled result equals the original single-row texture
 */
let rampAtlas: { tex: THREE.DataTexture; rows: Map<THREE.Texture, number> } | null = null;
function atlas(): { tex: THREE.DataTexture; rows: Map<THREE.Texture, number> } {
  if (rampAtlas) return rampAtlas;
  skinRamp ??= rampTexture(SKIN_STOPS);
  // spiritToon's three gradients are not exported, so borrow a temporary material to get its texture (the texture is shared
  // by the module, and disposing the material does not touch it)
  const src: THREE.Texture[] = (['matte', 'metal', 'gem'] as const).map((s) => {
    const m = sceneMaterial(0xffffff, { surface: s });
    const t = m.gradientMap!;
    m.dispose();
    return t;
  });
  src.push(skinRamp);
  const W = 256;
  const data = new Uint8Array(W * src.length * 4);
  src.forEach((t, r) => {
    const img = t.image as { data: Uint8Array; width: number; height: number };
    if (img.width !== W || img.height !== 1) throw new Error('avatarKit: the gradient texture is not 256 × 1');
    data.set(img.data, r * W * 4);
  });
  const tex = new THREE.DataTexture(data, W, src.length);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  rampAtlas = { tex, rows: new Map(src.map((t, r) => [t, r])) };
  return rampAtlas;
}

/** A material's serial number (three has it, the types do not say so): opaque objects at the same level are drawn in this order */
const matId = (m: THREE.Material): number => (m as unknown as { id: number }).id;

function swap(src: string, a: string, b: string): string {
  if (!src.includes(a)) throw new Error(`avatarKit: "${a}" not found in the shader (SHADE in spiritToon.ts was changed, so vcMaterial has to follow)`);
  return src.replace(a, b);
}

/**
 * The character's vertex-color toon material: on sceneMaterial's shader, the gradient row, specular strength and threshold,
 * rim light and emissive read from the vertices (avMat, avEmi),
 * and the base color reads the vertex color. One mesh can hold cloth, skin, metal and gems at once,
 * with light and shade the same as with their original separate materials.
 */
function vcMaterial(): SpiritMaterial {
  const { tex } = atlas();
  const m = sceneMaterial(0xffffff);
  m.vertexColors = true;
  m.gradientMap = tex;
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base.call(m, sh, r);
    sh.vertexShader = swap(sh.vertexShader, '#include <common>', '#include <common>\nattribute vec4 avMat;\nattribute vec3 avEmi;\nvarying vec4 vAvMat;\nvarying vec3 vAvEmi;');
    sh.vertexShader = swap(sh.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\nvAvMat = avMat;\nvAvEmi = avEmi;');
    let f = swap(sh.fragmentShader, '#include <common>', '#include <common>\nvarying vec4 vAvMat;\nvarying vec3 vAvEmi;');
    f = swap(f, 'texture2D(gradientMap, vec2(spNdl * 0.5 + 0.5, 0.5))', 'texture2D(gradientMap, vec2(spNdl * 0.5 + 0.5, vAvMat.x))');
    f = swap(f, '* uRim *', '* vAvMat.w *');
    f = swap(f, 'if (uSpec > 0.0)', 'if (vAvMat.y > 0.0)');
    f = swap(f, 'smoothstep(uSpecTh - 0.012, uSpecTh + 0.012, spH) * uSpec', 'smoothstep(vAvMat.z - 0.012, vAvMat.z + 0.012, spH) * vAvMat.y');
    f = swap(f, 'spCol += uEmissive * uEmissiveAmt * uGlowMul;', 'spCol += (uEmissive * uEmissiveAmt + vAvEmi) * uGlowMul;');
    sh.fragmentShader = f;
  };
  // /** All characters' vertex-color materials share one program, separate from the ordinary spirit materials */
  m.customProgramCacheKey = () => 'avatarVC';
  return m;
}

/**
 * The part geometry baked to a vertex-color version: moved into root space (standing pose), with color, gradient row,
 * specular, rim light and emissive written into the vertices, then the part id tagged
 */
function bakeVC(mesh: THREE.Mesh, mat: SpiritMaterial, rel: THREE.Matrix4, row: number, rows: number): THREE.BufferGeometry {
  const g = prepGeo(mesh.geometry, rel);
  const n = g.getAttribute('position').count;
  const u = mat.uniforms;
  const c = u.uColor.value;
  const e = u.uEmissive.value.clone().multiplyScalar(u.uEmissiveAmt.value);
  const spec = u.uSpec.value as number;
  const specTh = u.uSpecTh.value as number;
  const col = new Float32Array(n * 3);
  const am = new Float32Array(n * 4);
  const em = new Float32Array(n * 3);
  const v = (row + 0.5) / rows;
  const sh = g.getAttribute('shade');
  for (let i = 0; i < n; i++) {
    const k = sh ? sh.getX(i) : 1;
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
    am.set([v, spec, specTh, u.uRim.value], i * 4);
    em.set([e.r, e.g, e.b], i * 3);
  }
  if (sh) g.deleteAttribute('shade');
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('avMat', new THREE.BufferAttribute(am, 4));
  g.setAttribute('avEmi', new THREE.BufferAttribute(em, 3));
  tagInkPart(g, mesh.userData.noInk ? 0 : rolePart(mesh.userData.inkGroup as number));
  return g;
}

/**
 * Merging the whole person: under each node that moves or toggles (owners: pelvis, body, thighs, shins, upper arms,
 * forearms, head, cape, hair tips, the open-eye and closed-eye shapes),
 * the parts with toon() materials (including feet, hands, the pouch and held items hanging in static child groups)
 * are all baked into one vertex-color mesh;
 * those without outlines (the pact mark on the back of the hand, the lantern's glass) go into a separate mesh.
 * Parts are ordered by the creation order of their original materials, so draw order at overlaps is the same as before merging.
 * Other parts (shapes on the face, eye highlights, the mask, the lantern's wick, userData.keep)
 * are left alone and handed to mergeStatic for same-material merging.
 * Meshes still in the outline layer with an outline group are all changed to MERGED_GROUP plus a per-vertex part id,
 * so a given outline group has the same line id in every mesh.
 * keepNodes: groups to keep even if they end up empty after merging (palms, face anchors); other empty groups are removed.
 */
export function mergePerson(root: THREE.Object3D, M: Mats, owners: THREE.Object3D[], keepNodes: THREE.Object3D[] = []): void {
  const own = new Set<THREE.Object3D>([root, ...owners]);
  const { rows } = atlas();
  interface Piece {
    mesh: THREE.Mesh;
    mat: SpiritMaterial;
    owner: THREE.Object3D;
    rel: THREE.Matrix4;
  }
  // Each joint's transform relative to root in the standing pose. The merged mesh's vertices are stored in root space
  // (standing pose), and the mesh itself hangs under the joint with the inverse of this transform as its matrix:
  // motion still follows the joint, and in the standing pose the bounding box from Box3.setFromObject (height,
  // lab bench framing) is the same as before merging,
  // and does not grow because a slanted forearm or a long spear's bounding box is rotated back into forearm coordinates
  const frames = new Map<THREE.Object3D, THREE.Matrix4>();
  const frameOf = (o: THREE.Object3D): THREE.Matrix4 => {
    let F = frames.get(o);
    if (!F) {
      F = new THREE.Matrix4();
      for (let x: THREE.Object3D | null = o; x && x !== root; x = x.parent) {
        x.updateMatrix();
        F.premultiply(x.matrix);
      }
      frames.set(o, F);
    }
    return F;
  };
  const buckets = new Map<string, Piece[]>();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const m of meshes) {
    const mat = m.material as SpiritMaterial;
    if (Array.isArray(m.material) || !M.owns(mat) || m.userData.keep || m.children.length || own.has(m)) continue;
    if (mat.transparent || mat.polygonOffset || mat.vertexColors || mat.side !== THREE.FrontSide || !rows.has(mat.gradientMap!)) continue;
    if (m.geometry.getAttribute('color')) continue;
    // Transform relative to the joint: multiply up the local matrices of the static groups in between (without reading
    // matrixWorld), then finally multiply the joint's standing-pose transform to get root space
    const rel = new THREE.Matrix4();
    let n: THREE.Object3D = m;
    for (;;) {
      n.updateMatrix();
      rel.premultiply(n.matrix);
      if (!n.parent) break;
      if (own.has(n.parent)) break;
      n = n.parent;
    }
    const owner = n.parent;
    if (!owner) continue;
    rel.premultiply(frameOf(owner));
    const key = `${owner.uuid}|${m.userData.noInk ? 'n' : 'i'}|${m.renderOrder}`;
    const list = buckets.get(key);
    const p: Piece = { mesh: m, mat, owner, rel };
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }
  const old: THREE.BufferGeometry[] = [];
  for (const list of buckets.values()) {
    // Before merging, three draws in the order materials were created (meshes with the same material in mesh order);
    // after merging, sort in the same order
    list.sort((a, b) => matId(a.mat) - matId(b.mat) || a.mesh.id - b.mesh.id);
    const geos = list.map((p) => bakeVC(p.mesh, p.mat, p.rel, rows.get(p.mat.gradientMap!)!, rows.size));
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) throw new Error('avatarKit: merging the vertex-color parts failed (inconsistent attributes)');
    // Bounding box: the union of each part's original bounding box moved into root space (the algorithm of
    // Box3.setFromObject), so the standing height is the same as before merging
    const bb = new THREE.Box3();
    for (const p of list) {
      const g = p.mesh.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      bb.union(g.boundingBox!.clone().applyMatrix4(p.rel));
    }
    merged.boundingBox = bb;
    const first = list[0].mesh;
    const mesh = new THREE.Mesh(merged, M.vc());
    mesh.userData = first.userData.noInk ? { noInk: true, vc: true } : { inkGroup: MERGED_GROUP, vc: true };
    mesh.renderOrder = first.renderOrder;
    frameOf(list[0].owner).clone().invert().decompose(mesh.position, mesh.quaternion, mesh.scale);
    list[0].owner.add(mesh);
    for (const p of list) {
      p.mesh.removeFromParent();
      old.push(p.mesh.geometry);
    }
  }
  // Other parts: same-material merging under the same node (shapes on the face, eye highlights, ...)
  mergeStatic(root);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.vc || m.userData.noInk || m.userData.inkGroup === undefined) return;
    tagInkPart(m.geometry, rolePart(m.userData.inkGroup as number));
    m.userData.inkGroup = MERGED_GROUP;
  });
  // The original geometry: dispose only after confirming no mesh still uses it
  const live = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) live.add((o as THREE.Mesh).geometry);
  });
  for (const g of old) if (!live.has(g)) g.dispose();
  M.prune(root);
  // Remove static groups that became empty (feet, the pouch, the frames of held items), saving a few matrix computations per frame
  const keep = new Set<THREE.Object3D>([...own, ...keepNodes]);
  const sweep = (node: THREE.Object3D) => {
    for (const ch of [...node.children]) {
      sweep(ch);
      if (!(ch as THREE.Mesh).isMesh && !ch.children.length && !keep.has(ch)) ch.removeFromParent();
    }
  };
  sweep(root);
}

/**
 * Meshes under the same node with the same material and outline group are merged into one (only direct child meshes of the
 * same node are merged, and motion is unchanged).
 * userData.keep and meshes already baked to vertex colors are left alone. mergePerson uses this last to collect the shapes
 * on the face; the lab bench's &hide and &nomerge run only this step.
 */
export function mergeStatic(root: THREE.Object3D): void {
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) nodes.push(o);
  });
  for (const node of nodes) {
    const buckets = new Map<string, THREE.Mesh[]>();
    for (const ch of node.children) {
      const m = ch as THREE.Mesh;
      if (!m.isMesh || m.userData.keep || m.userData.vc || Array.isArray(m.material) || m.children.length) continue;
      const key = `${m.material.uuid}|${m.userData.inkGroup ?? 'x'}|${m.userData.noInk ? 1 : 0}|${m.renderOrder}`;
      const list = buckets.get(key);
      if (list) list.push(m);
      else buckets.set(key, [m]);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        m.updateMatrix();
        return prepGeo(m.geometry, m.matrix);
      });
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const first = list[0];
      const mesh = new THREE.Mesh(merged, first.material);
      mesh.userData = { ...first.userData };
      mesh.renderOrder = first.renderOrder;
      node.add(mesh);
      for (const m of list) {
        node.remove(m);
        m.geometry.dispose();
      }
    }
  }
}

// ───────────────────────── Thick shells ─────────────────────────

/**
 * A thick shell made of an outer and an inner grid (rows × cols): the outer surface, the inner surface,
 * and the edges around (with wrap the columns join end to end, so there are no left and right edges).
 * Each cell's winding is decided by the direction of "outer minus inner", so it faces outward however the grid is laid out.
 * After merging vertices the normals are recomputed, so the edges come out slightly rounded.
 */
export function shellGrid(O: THREE.Vector3[][], I: THREE.Vector3[][], wrap = false): THREE.BufferGeometry {
  const R = O.length;
  const C = O[0].length;
  const pos: number[] = [];
  for (const G of [O, I]) for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) pos.push(G[i][j].x, G[i][j].y, G[i][j].z);
  const off = R * C;
  const id = (i: number, j: number) => i * C + (((j % C) + C) % C);
  const idx: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const d = new THREE.Vector3();
  const A = new THREE.Vector3();
  const Bv = new THREE.Vector3();
  const Cv = new THREE.Vector3();
  const pt = (k: number, out: THREE.Vector3) => out.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  // The normal of triangle a b c must point the same way as dir
  const tri = (a: number, b: number, c: number, dir: THREE.Vector3) => {
    pt(a, A);
    e1.subVectors(pt(b, Bv), A);
    e2.subVectors(pt(c, Cv), A);
    n.crossVectors(e1, e2);
    if (n.lengthSq() < 1e-14) return;
    if (n.dot(dir) >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  };
  const cols = wrap ? C : C - 1;
  for (let i = 0; i < R - 1; i++)
    for (let j = 0; j < cols; j++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), dd = id(i, j + 1);
      d.subVectors(O[i][j], I[i][j]).add(e1.subVectors(O[i + 1][(j + 1) % C], I[i + 1][(j + 1) % C]));
      if (d.lengthSq() < 1e-14) d.set(0, 1, 0);
      const out = d.clone();
      tri(a, b, dd, out);
      tri(b, c, dd, out);
      const inn = out.clone().negate();
      tri(off + a, off + b, off + dd, inn);
      tri(off + b, off + c, off + dd, inn);
    }
  // Edges: facing outward, away from the grid
  const edge = (i0: number, j0: number, i1: number, j1: number, away: THREE.Vector3) => {
    const a = id(i0, j0), b = id(i1, j1);
    tri(a, b, off + b, away);
    tri(a, off + b, off + a, away);
  };
  for (let j = 0; j < cols; j++) {
    const j1 = (j + 1) % C;
    edge(0, j, 0, j1, new THREE.Vector3().subVectors(O[0][j], O[Math.min(1, R - 1)][j]));
    edge(R - 1, j, R - 1, j1, new THREE.Vector3().subVectors(O[R - 1][j], O[Math.max(0, R - 2)][j]));
  }
  if (!wrap)
    for (let i = 0; i < R - 1; i++) {
      edge(i, 0, i + 1, 0, new THREE.Vector3().subVectors(O[i][0], O[i][1]));
      edge(i, C - 1, i + 1, C - 1, new THREE.Vector3().subVectors(O[i][C - 1], O[i][C - 2]));
    }
  // The outer and inner surfaces and the four edges share vertices, so after averaging the normals the edges are naturally
  // rounded; no vertex merging (too slow), and duplicated vertices at the poles affect only one small point
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A thick shell around the y axis (skirt hem, robe, collar, cape, hat brim): prof is [radius, y] from top to bottom,
 * a0 to a1 is the angle around y (0 faces +z, straight ahead),
 * thick is the inward thickness; wave(θ, v, y) makes the radius undulate (pleats, hem waves, gathers above the belt),
 * where v is 0-1 along the profile and y is the height. zs squashes the cross-section into an ellipse (the body is thinner
 * front to back than side to side).
 */
export function revShell(prof: [number, number][], thick: number, o: { a0?: number; a1?: number; seg?: number; zs?: number; wave?: (th: number, v: number, y: number) => number; sub?: number } = {}): THREE.BufferGeometry {
  const a0 = o.a0 ?? -PI;
  const a1 = o.a1 ?? PI;
  const wrap = Math.abs(a1 - a0 - 2 * PI) < 1e-6;
  const seg = o.seg ?? 32;
  const cols = wrap ? seg : seg + 1;
  const zs = o.zs ?? 1;
  const sub = o.sub ?? 2;
  // The profile is subdivided segment by segment, so only the bends are round
  const pts: [number, number, number][] = [];
  for (let k = 0; k < prof.length - 1; k++)
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      pts.push([lerp(prof[k][0], prof[k + 1][0], t), lerp(prof[k][1], prof[k + 1][1], t), (k + t) / (prof.length - 1)]);
    }
  pts.push([prof[prof.length - 1][0], prof[prof.length - 1][1], 1]);
  const O: THREE.Vector3[][] = [];
  const I: THREE.Vector3[][] = [];
  for (const [r, y, v] of pts) {
    const ro: THREE.Vector3[] = [];
    const ri: THREE.Vector3[] = [];
    for (let j = 0; j < cols; j++) {
      const th = a0 + ((a1 - a0) * j) / seg;
      const rr = r * (1 + (o.wave ? o.wave(th, v, y) : 0));
      const s = Math.sin(th), c = Math.cos(th);
      ro.push(new THREE.Vector3(s * rr, y, c * rr * zs));
      const ri2 = Math.max(0.002, rr - thick);
      ri.push(new THREE.Vector3(s * ri2, y, c * ri2 * zs));
    }
    O.push(ro);
    I.push(ri);
  }
  return shellGrid(O, I, wrap);
}

/**
 * A solid lathe body (body, boot shaft, helmet): prof is [radius, y] from bottom to top, and zs squashes it into an elliptical cross-section.
 * wave(θ, y) makes the radius undulate (gathers above the belt): the profile is first subdivided sub times,
 * then after the undulation the seam is welded and the normals recomputed.
 */
export function revSolid(prof: [number, number][], o: { seg?: number; zs?: number; xs?: number; wave?: (th: number, y: number) => number; sub?: number } = {}): THREE.BufferGeometry {
  let pts = prof[0][1] > prof[prof.length - 1][1] ? [...prof].reverse() : prof;
  if (o.wave && (o.sub ?? 1) > 1) {
    const sub = o.sub!;
    const fine: [number, number][] = [];
    for (let k = 0; k < pts.length - 1; k++) for (let j = 0; j < sub; j++) fine.push([lerp(pts[k][0], pts[k + 1][0], j / sub), lerp(pts[k][1], pts[k + 1][1], j / sub)]);
    fine.push(pts[pts.length - 1]);
    pts = fine;
  }
  // The normals LatheGeometry computes are continuous at the seam, and applyMatrix4 corrects the normals together when squashing
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), o.seg ?? 32);
  g.deleteAttribute('uv');
  if (o.wave) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + o.wave(Math.atan2(x, z), y);
      p.setXYZ(i, x * k, y, z * k);
    }
    g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-5);
    g.computeVertexNormals();
  }
  g.scale(o.xs ?? 1, 1, o.zs ?? 1);
  return g;
}

// ───────────────────────── Head shape and face ─────────────────────────

/**
 * Head shape: the skull of KayKit Character Pack: Adventurers (CC0), sampled radially by tools/headgrid.mjs into headData.ts.
 * A rounded block: a slightly flat face front, full sides and back of the head, a wide jaw, a flat chin bottom; rx, ry,
 * rz are the half-width, half-height and half-depth.
 * φ is the polar angle measured from the top of the head, θ is the angle around y (0 faces straight ahead +z,
 * positive toward +x), both measured in normalized skull coordinates.
 * The sample grid is interpolated bicubically (Catmull-Rom), so the surface and normals are continuous and no creases from the sample grid appear.
 * The shapes on the face, hair, hoods and helmets all compute their positions from the same head shape, which is what makes them hug the head.
 */
export interface HeadOpts {
  /**
   * How much the width of the chin layer is taken in (0 is the original's square chin); the larger jawPow,
   * the later it tapers and the squarer the jaw angle
   */
  jaw?: number;
  jawPow?: number;
  /** Relief of the face: cheekbones, eye sockets, brow ridge, mouth and nose, and chin (sculpt()) */
  sculpt?: boolean;
  /** Flesh of the cheeks (bulging outward on the inside of the jaw angle): more for children, less for adults */
  cheek?: number;
  /** Nose size and roundness of the tip (k 0 means no nose) */
  nose?: { k: number; round?: number };
}

export class HeadShape {
  rx: number;
  ry: number;
  rz: number;
  jaw: number;
  jawPow: number;
  sculpt: boolean;
  cheek: number;
  /**
   * Nose size and roundness of the tip (0 means no nose): the nose is part of the head shape's surface,
   * with no seam or crease between it and the face
   */
  noseK: number;
  noseRound: number;
  constructor(rx: number, ry: number, rz: number, o: HeadOpts = {}) {
    this.rx = rx;
    this.ry = ry;
    this.rz = rz;
    this.jaw = o.jaw ?? 0;
    this.jawPow = o.jawPow ?? 2;
    this.sculpt = o.sculpt ?? false;
    this.cheek = o.cheek ?? 0;
    this.noseK = o.nose?.k ?? 0;
    this.noseRound = o.nose?.round ?? 0;
  }

  /**
   * Radius in normalized coordinates (φ, θ direction): bicubic interpolation of the sample grid;
   * crossing a pole is the same as turning to the opposite meridian
   */
  radius(phi: number, th: number): number {
    const { nt, np, r } = HEAD_GRID;
    const u = (clamp(phi, 0, PI) / PI) * (np - 1);
    const v = ((((th / (2 * PI)) * nt) % nt) + nt) % nt;
    const i = Math.min(np - 2, Math.floor(u));
    const j = Math.floor(v);
    const fv = v - j;
    for (let a = 0; a < 4; a++) {
      let ii = i + a - 1;
      let jo = j;
      if (ii < 0) {
        ii = -ii;
        jo += nt / 2;
      } else if (ii > np - 1) {
        ii = 2 * (np - 1) - ii;
        jo += nt / 2;
      }
      const b = ii * nt;
      _rows[a] = catmull(r[b + ((jo - 1 + nt) % nt)], r[b + (jo % nt)], r[b + ((jo + 1) % nt)], r[b + ((jo + 2) % nt)], fv);
    }
    return catmull(_rows[0], _rows[1], _rows[2], _rows[3], u - i);
  }

  point(phi: number, th: number, out = new THREE.Vector3()): THREE.Vector3 {
    const k = this.radius(phi, th) + (this.sculpt ? sculpt(PI / 2 - phi, th, this.cheek) : 0) + (this.noseK ? noseBump(PI / 2 - phi, th, this.noseK, this.noseRound) : 0);
    const s = Math.sin(phi);
    const y = Math.cos(phi) * k;
    // The lower face tapers only a little near the chin: a wide round jaw and a blunt chin, so from the front it is close to
    // a rounded square (a large jawPow tapers later and gives a squarer jaw angle)
    const t = clamp((-y - 0.05) / 0.95, 0, 1);
    const taper = 1 - this.jaw * Math.pow(t, this.jawPow);
    return out.set(s * Math.sin(th) * k * this.rx * taper, y * this.ry, s * Math.cos(th) * k * this.rz);
  }

  normal(phi: number, th: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = 1e-3;
    const p = Math.max(e * 2, Math.min(PI - e * 2, phi));
    const a = this.point(p + e, th);
    const b = this.point(p - e, th);
    const c = this.point(p, th + e);
    const d = this.point(p, th - e);
    const dp = a.sub(b);
    const dt = c.sub(d);
    out.crossVectors(dt.normalize(), dp.normalize());
    // Normalize the difference vectors before comparing: two 1e-3 differences multiply to only 1e-7,
    // and an absolute threshold would treat every point as a pole
    if (out.lengthSq() < 1e-10) return out.set(0, Math.sign(Math.cos(phi)) || 1, 0);
    out.normalize();
    // Outward
    const q = this.point(p, th);
    if (out.dot(q) < 0) out.negate();
    return out;
  }

  /** The φ of the point at height y on meridian θ (bisection; returns 0 above the top of the head and π below the chin) */
  phiAtY(y: number, th: number): number {
    let a = 0;
    let b = PI;
    for (let k = 0; k < 16; k++) {
      const m = (a + b) / 2;
      if (this.point(m, th, _p).y > y) a = m;
      else b = m;
    }
    return (a + b) / 2;
  }

  /** Turn normalized coordinates (x, y, z) into an actual position (reference points for the nose, ears and facial features) */
  local(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(x * this.rx, y * this.ry, z * this.rz);
  }

  /**
   * The [θ, latitude] of the point on the surface straight ahead of face position (x, y) (normalized coordinates):
   * cast from inside the head along +z to the surface, not from the head center in that direction
   */
  facing(x: number, y: number): [number, number] {
    // Guess the straight-ahead longitude and latitude first, then correct a few times with the x and y error of the surface point
    let th = Math.atan2(x, 1);
    let lat = Math.atan2(y, 1);
    for (let k = 0; k < 12; k++) {
      this.point(PI / 2 - lat, th, _p);
      const ex = x - _p.x / this.rx;
      const ey = y - _p.y / this.ry;
      if (Math.abs(ex) + Math.abs(ey) < 1e-5) break;
      th += ex * 0.9;
      lat += ey * 0.9;
    }
    return [th, lat];
  }

  /** A surface point lifted by lift along the normal */
  at(phi: number, th: number, lift = 0, out = new THREE.Vector3()): THREE.Vector3 {
    this.point(phi, th, out);
    return out.addScaledVector(this.normal(phi, th, _n), lift);
  }

  /**
   * The whole skull. Segments are uneven: θ is densest straight ahead (θ = s − 0.72·sin s) and φ densest around the nose,
   * so the nose, mouth and nose area and chin on the face have enough segments to form smooth relief,
   * and the back and top of the head (under the hair) are sparser.
   */
  skull(seg = 48, rows = 36): THREE.BufferGeometry {
    const pos: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    const phis = denseSamples(rows, 0, PI, PI / 2 - NOSE_LAT, 0.42, 2.6);
    for (let i = 0; i <= rows; i++) {
      const phi = phis[i];
      for (let j = 0; j < seg; j++) {
        const sj = (j / seg) * 2 * PI;
        this.point(phi, sj - 0.72 * Math.sin(sj), p);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j, b = (i + 1) * seg + j, c = (i + 1) * seg + ((j + 1) % seg), d = i * seg + ((j + 1) % seg);
        idx.push(a, b, d, b, c, d);
      }
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    m.setIndex(idx);
    m.computeVertexNormals();
    // Winding: the normal must face outward
    const nn = new THREE.Vector3().fromBufferAttribute(m.getAttribute('normal') as THREE.BufferAttribute, Math.floor(m.getAttribute('position').count / 2));
    const pp = new THREE.Vector3().fromBufferAttribute(m.getAttribute('position') as THREE.BufferAttribute, Math.floor(m.getAttribute('position').count / 2));
    if (nn.dot(pp) < 0) {
      const ix = m.index!.array as Uint32Array | Uint16Array;
      for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
      m.computeVertexNormals();
    }
    return m;
  }

  /**
   * A flat shape on the face: pts is [θ, latitude] (latitude = π/2 − φ, with the eyes near 0), triangulated,
   * subdivided three times, then laid on the head shape and lifted by lift along the normal.
   * The normal is the head shape's normal, so it is lit together with the face.
   */
  decal(pts: [number, number][], lift: number, color?: THREE.ColorRepresentation, levels = 1): THREE.BufferGeometry {
    const flat = new THREE.ShapeGeometry(outline(pts), 1).toNonIndexed();
    const src = flat.attributes.position as THREE.BufferAttribute;
    let tris: [number, number][][] = [];
    for (let i = 0; i < src.count; i += 3) tris.push([0, 1, 2].map((k) => [src.getX(i + k), src.getY(i + k)] as [number, number]));
    // Flip triangles with negative area (ShapeGeometry winds the other way when the outline is clockwise)
    for (let l = 0; l < levels; l++) {
      const next: [number, number][][] = [];
      for (const [a, b, c] of tris) {
        const m = (u: [number, number], v: [number, number]): [number, number] => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
        const ab = m(a, b), bc = m(b, c), ca = m(c, a);
        next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      }
      tris = next;
    }
    const pos: number[] = [];
    const nor: number[] = [];
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const t of tris) {
      const area = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]);
      const order = area >= 0 ? [0, 1, 2] : [0, 2, 1];
      for (const k of order) {
        const [th, lat] = t[k];
        const phi = PI / 2 - lat;
        this.normal(phi, th, n);
        this.point(phi, th, p).addScaledVector(n, lift);
        pos.push(p.x, p.y, p.z);
        nor.push(n.x, n.y, n.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    if (color !== undefined) {
      const c = new THREE.Color(color);
      const cols = new Float32Array(pos.length);
      for (let i = 0; i < cols.length; i += 3) cols.set([c.r, c.g, c.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    return g;
  }
}
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _rows = new Float64Array(4);

/** Gaussian undulation near (θ, latitude) */
function bump(th: number, lat: number, t0: number, l0: number, st: number, sl: number): number {
  let d = th - t0;
  d -= 2 * PI * Math.round(d / (2 * PI));
  const a = d / st;
  const b = (lat - l0) / sl;
  const e = a * a + b * b;
  // Beyond three standard deviations treat it as 0, so hair and back-of-head points need no exponential
  return e > 9 ? 0 : Math.exp(-e);
}

/**
 * Relief of the face (increase or decrease of the normalized radius): the original's face is one flat plane,
 * with only one color step under toon shading.
 * Adding cheekbones (bulging outside and below the eyes), shallow eye sockets, brow ridge, mouth and nose area pushed
 * forward, and a wide blunt chin gives the face volume when light comes from the upper side.
 * cheek is the flesh inside the jaw angle, so from the front the lower face is full rather than an inverted triangle.
 */
function sculpt(lat: number, th: number, cheek: number): number {
  if (lat > 0.35 || lat < -1.25 || Math.cos(th) < -0.2) return 0;
  let d = 0;
  for (const sx of [-1, 1]) {
    d += 0.022 * bump(th, lat, sx * 0.66, -0.32, 0.22, 0.16);
    d -= 0.012 * bump(th, lat, sx * 0.41, -0.19, 0.1, 0.08);
    d += cheek * bump(th, lat, sx * 0.82, -0.7, 0.34, 0.24);
  }
  // Brow ridge, a slight dip at the nose root, mouth and nose pushed forward, a wide blunt chin a bit forward;
  // from the side the forehead, nose, mouth and chin have relief
  d += 0.014 * bump(th, lat, 0, 0.04, 0.62, 0.07);
  d -= 0.01 * bump(th, lat, 0, -0.08, 0.12, 0.06);
  d += 0.03 * bump(th, lat, 0, -0.54, 0.26, 0.14);
  d += 0.022 * bump(th, lat, 0, -0.86, 0.38, 0.13);
  return d;
}

/** Latitude of the nose tip (on the face's midline) */
const NOSE_LAT = -0.38;
/** Height and width of the nose tip (normalized radius, θ radians); k is each character's multiplier */
const NOSE_A = 0.17;
const NOSE_W = 0.108;

/**
 * The nose (increment to the normalized radius): KayKit's distinct round nose tip, whose protrusion past the face outline
 * shows at three-quarter view. A very shallow bridge grows along the midline from between the brows,
 * the tip is round and slightly upturned (a long slope up, a short slope down), with a small nostril wing on each side of
 * the tip's lower edge. The whole thing is a smooth relief: from the front only soft light and shade,
 * and the outline appears only at the lower edge of the tip and at the wings in three-quarter and side views.
 */
function noseBump(lat: number, th: number, k: number, round: number): number {
  let d = th;
  d -= 2 * PI * Math.round(d / (2 * PI));
  if (Math.abs(d) > 0.6 || lat > 0.12 || lat < -0.8) return 0;
  const tip = NOSE_LAT - 0.03 * round;
  const A = NOSE_A * k;
  const st = NOSE_W * k * (1 + 0.3 * round);
  const dl = lat - tip;
  const sl = dl > 0 ? 0.12 * k : 0.062 * k;
  // Nose tip: a dome with a top slightly flatter than a Gaussian, reading from the front as a round ball rather than a point
  const e = (d / st) ** 2 + (dl / sl) ** 2;
  let n = A * Math.exp(-Math.pow(e, 1.12));
  // Bridge: getting higher from the nose root toward the tip, handed over to the tip when close to it
  const t = clamp((0.04 - lat) / (0.04 - tip), 0, 1);
  n += A * 0.22 * Math.pow(t, 1.4) * (1 - smoothstep(t, 0.7, 1)) * Math.exp(-((d / (0.06 * k)) ** 2));
  // Nostril wings
  for (const sx of [-1, 1]) n += A * 0.26 * Math.exp(-(((d - sx * 0.085 * k * (1 + 0.3 * round)) / (0.05 * k)) ** 2) - ((lat - tip + 0.03) / (0.045 * k)) ** 2);
  return n;
}

/** Take n + 1 samples over [a, b], dense by a factor of `dense` near center (width w) */
function denseSamples(n: number, a: number, b: number, center: number, w: number, dense: number): number[] {
  const M = 512;
  const cdf = [0];
  for (let i = 1; i <= M; i++) {
    const x = a + ((b - a) * (i - 0.5)) / M;
    cdf.push(cdf[i - 1] + 1 + (dense - 1) * Math.exp(-(((x - center) / w) ** 2)));
  }
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const target = (cdf[M] * i) / n;
    while (j < M && cdf[j + 1] < target) j++;
    const f = cdf[j + 1] > cdf[j] ? (target - cdf[j]) / (cdf[j + 1] - cdf[j]) : 0;
    out.push(a + ((b - a) * Math.min(M, j + f)) / M);
  }
  out[0] = a;
  out[n] = b;
  return out;
}

/** Catmull-Rom interpolation (between p1 and p2, t 0-1) */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

/** Latitude of the nose tip, for aligning the shapes on the face (the nose tip's highlight, the shadow under the nose) */
export function noseTipLat(round = 0): number {
  return NOSE_LAT - 0.03 * round;
}

/** Winding of a small mesh: the vertex normals' average must point away from the center, otherwise the whole thing flips */
function outward(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeVertexNormals();
  const c = new THREE.Vector3();
  const pa = g.getAttribute('position') as THREE.BufferAttribute;
  const na = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) c.add(new THREE.Vector3().fromBufferAttribute(pa, i));
  c.multiplyScalar(1 / pa.count);
  let d = 0;
  for (let i = 0; i < pa.count; i++) d += new THREE.Vector3().fromBufferAttribute(na, i).dot(new THREE.Vector3().fromBufferAttribute(pa, i).sub(c));
  if (d < 0) {
    const a = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
    g.computeVertexNormals();
  }
  return g;
}

/**
 * Ear: follows KayKit's ear position and size (HEAD_REF.ear: at the side of the head, below the eye line,
 * front to back near the head's midline), made as a shallow bowl opening outward and slightly forward,
 * the ring at the rim is the helix and the bottom of the bowl is the ear hollow, so it reads as an ear from the side (the
 * original's solid D-shaped block is just a plate under our outlines).
 * side −1 is the right ear (−x). Returns head coordinates.
 */
export function earGeo(hs: HeadShape, side: number): THREE.BufferGeometry {
  const [, cy, cz, , hy] = HEAD_REF.ear;
  const H = hy * hs.ry * 0.62;
  const D = H * 0.66;
  const dep = 0.06;
  // Bowl: the opening faces +y, prof goes from the rim to the bottom (rim radius 1), thickness going inward
  const g = revShell([[1, 0], [0.97, -0.16], [0.82, -0.34], [0.5, -0.46], [0.001, -0.5]], 0.3, { seg: 14, sub: 1 });
  // Turn the bowl's axis (y) outward (+x), and the rim's two axes become front-back (z, width D) and up-down (y, height H):
  // a cyclic axis swap, so the winding is unchanged
  g.applyMatrix4(new THREE.Matrix4().set(0, dep, 0, 0, 0, 0, H, 0, D, 0, 0, 0, 0, 0, 0, 1));
  // The rim tilts slightly forward: the back edge flares out more than the front edge
  g.rotateY(-0.4);
  // The rim sits 0.02 outside the head's side surface, with the bottom of the bowl buried in the head
  const lat = Math.asin(THREE.MathUtils.clamp(cy, -1, 1));
  const x = hs.point(PI / 2 - lat, PI / 2).x;
  g.translate(x + 0.018, cy * hs.ry, cz * hs.rz);
  if (side < 0) {
    g.scale(-1, 1, 1);
    const a = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
  }
  g.computeVertexNormals();
  return g;
}

/** Elliptical outline (for decals) */
export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 28, rot = 0): [number, number][] {
  const out: [number, number][] = [];
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}

/** A stroke along a curve f(t) (t 0-1): w(t) is the width, and both ends taper to points naturally */
export function stroke(f: (t: number) => [number, number], w: (t: number) => number, n = 24): [number, number][] {
  const up: [number, number][] = [];
  const dn: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = f(t);
    const [x1, y1] = f(Math.min(1, t + 0.01));
    const [x0, y0] = f(Math.max(0, t - 0.01));
    let tx = x1 - x0, ty = y1 - y0;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const h = w(t) / 2;
    up.push([x - ty * h, y + tx * h]);
    dn.push([x + ty * h, y - tx * h]);
  }
  return [...up, ...dn.reverse()];
}

// ───────────────────────── Hair, hood, helmet ─────────────────────────

export interface CapOpts {
  /**
   * Polar angle of the edge (measured from the top of the head, radians); the part beyond fall turns to hang straight down,
   * with length in units of ry
   */
  L: (th: number) => number;
  /** Height of the outer surface above the scalp (absolute units): s 0 is the top of the head to 1 the edge */
  off: (s: number, th: number) => number;
  /**
   * The inner surface's distance from the scalp (negative buries it in the skull); can be given by angle (a circlet that
   * hugs hair of uneven thickness)
   */
  inner?: number | ((th: number) => number);
  /**
   * Cut the edge into locks: how many locks around, the tip length (radians), the starting phase,
   * the depth of the grooves between locks, the randomness of the tip length
   */
  tufts?: number;
  notch?: number;
  phase?: number;
  groove?: number;
  jitter?: number;
  seed?: number;
  /**
   * Past this polar angle it hangs straight down (long hair, bob, hood); by default it does not hang. Can be given by angle:
   * for short hair the sides hug the head and only the back of the head hangs down
   */
  fall?: number | ((th: number) => number);
  /**
   * How much the hanging part tucks inward (per unit length); can be given by angle: small at the sides (do not let the
   * cheeks poke out), large at the back of the head (to hug the nape)
   */
  fallIn?: number | ((th: number) => number);
  /** Thickness of the hanging part */
  fallThick?: number;
  /** Build only one band up from the edge (headband, circlet, helmet binding): 0-1, rows starting from `from` × L */
  from?: number;
  /** Build only a range of angles (mask, bang pieces); by default a full ring */
  a0?: number;
  a1?: number;
  cols?: number;
  rows?: number;
}

/** A shell hugging the head shape: hair (edge cut into locks), hood, helmet, mask. It grows from the top of the head down to L(θ). */
export function capShell(hs: HeadShape, o: CapOpts): THREE.BufferGeometry {
  const a0 = o.a0 ?? -PI;
  const a1 = o.a1 ?? PI;
  const wrap = Math.abs(a1 - a0 - 2 * PI) < 1e-6;
  const C = o.cols ?? 72;
  const cols = wrap ? C : C + 1;
  const N = o.rows ?? 14;
  const tufts = o.tufts ?? 0;
  const notch = o.notch ?? 0;
  const groove = o.groove ?? 0;
  const innerF = typeof o.inner === 'function' ? o.inner : ((k: number) => () => k)(o.inner ?? -0.015);
  const fallF = typeof o.fall === 'function' ? o.fall : ((k: number) => () => k)(o.fall ?? 99);
  const fallInF = typeof o.fallIn === 'function' ? o.fallIn : ((k: number) => () => k)(o.fallIn ?? 0);
  const fallThick = o.fallThick ?? 0.05;
  let s = o.seed ?? 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const jit = Array.from({ length: Math.ceil(tufts) + 3 }, () => 1 + (rnd() - 0.5) * 2 * (o.jitter ?? 0));
  const O: THREE.Vector3[][] = [];
  const I: THREE.Vector3[][] = [];
  for (let i = 0; i <= N; i++) {
    O.push([]);
    I.push([]);
  }
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const base = new THREE.Vector3();
  const nh = new THREE.Vector3();
  const skP = new THREE.Vector3();
  // The top row of the head is a single point: the height above the scalp is first taken as the average over the full ring
  // and pulled toward the average near the top, so the crown does not get a star-shaped dent pinched into it
  let off0 = 0;
  for (let j = 0; j < C; j++) off0 += o.off(0, a0 + ((a1 - a0) * j) / C) / C;
  for (let j = 0; j < cols; j++) {
    const th = a0 + ((a1 - a0) * j) / C;
    // Locks: c is 1 at the middle of each lock and 0 between two locks
    let c = 1;
    let jk = 1;
    if (tufts > 0) {
      const u = ((th + PI) / (2 * PI)) * tufts + (o.phase ?? 0);
      const w = u - Math.floor(u);
      c = 1 - Math.abs(2 * w - 1);
      jk = jit[((Math.floor(u) % jit.length) + jit.length) % jit.length];
    }
    // The tip length is an absolute angle in radians (notch); the randomness changes only the tip length,
    // so the length is continuous at the boundary of two locks and the mesh does not tear apart;
    // each lock's tip is round (flat in the middle, tapering only toward the sides), and only between locks is there a
    // V-shaped notch, not a papercut sawtooth
    const Lfull = o.L(th);
    const L = Lfull - notch + notch * Math.pow(Math.sin((c * PI) / 2), 0.8) * jk;
    const from = o.from ?? 0;
    const fall = fallF(th);
    const fallIn = fallInF(th);
    const inner = innerF(th);
    for (let i = 0; i <= N; i++) {
      const v = from + (1 - from) * (i / N);
      const phi = v * L;
      const sN = phi / Math.max(1e-3, Lfull);
      const gr = 1 - groove * (1 - c) * sN * sN;
      const pole = (o.from ?? 0) > 0 ? 0 : 1 - smoothstep(sN, 0, 0.3);
      const oh = (o.off(sN, th) + (off0 - o.off(0, th)) * pole) * gr;
      if (phi <= fall) {
        hs.normal(phi, th, n);
        hs.point(phi, th, p);
        O[i].push(p.clone().addScaledVector(n, oh));
        I[i].push(p.clone().addScaledVector(n, inner));
      } else {
        hs.point(fall, th, base);
        hs.normal(fall, th, nh);
        nh.y = 0;
        nh.normalize();
        const drop = (phi - fall) * hs.ry;
        const q = base.clone();
        q.y -= drop;
        q.x -= Math.sin(th) * drop * fallIn;
        q.z -= Math.cos(th) * drop * fallIn;
        const tk = Math.max(0.004, fallThick * (1 - smoothstep(sN, 0.8, 1) * 0.85));
        // Tucking inward must not go into the skull: leave at least a little outside the skull surface at the same height,
        // and the inner surface must also be outside the skull
        if (q.y > -hs.ry * 0.999) {
          const sk = hs.point(hs.phiAtY(q.y, th), th, skP);
          const need = Math.hypot(sk.x, sk.z) + 0.01 - oh + tk;
          const rq = Math.hypot(q.x, q.z);
          if (rq < need && rq > 1e-6) {
            q.x *= need / rq;
            q.z *= need / rq;
          }
        }
        O[i].push(q.clone().addScaledVector(nh, oh));
        I[i].push(q.clone().addScaledVector(nh, oh - tk));
      }
    }
  }
  return shellGrid(O, I, wrap);
}

/**
 * One hair lock: from the root (θ, φ0) it grows along the head shape down to the tip (L, hanging straight down once past
 * fall, same as capShell), with width w (the width on the scalp, in meters),
 * thick in the middle and thinning toward the sides, with a crescent cross-section; the root is buried in the bottom layer
 * of hair and the tip tapers to a point. sweep is the tip's lateral offset relative to the root (θ radians,
 * bending more toward the tip), curl bends only the last stretch (a hooked tip), flick lifts the tip away from the head
 * (positive) or tucks it in (negative), and tip is the width left at the tip (0 is a point, 1 is a straight cut).
 */
export interface Lock {
  th: number;
  phi0: number;
  L: number;
  w: number;
  thick: number;
  sweep?: number;
  curl?: number;
  flick?: number;
  tip?: number;
  /** Layers on top are lifted a bit more, so adjacent locks lie one over another rather than interpenetrating */
  lift?: number;
  /** Thickness starts thinning toward the tip from here (0-1); big locks of long hair take a larger value, so they keep thickness all the way */
  hold?: number;
  /**
   * Width at the root (as a fraction of w): locks growing straight out of the scalp (the white hair of a bald-topped elder)
   * take a smaller value, so the root narrows and no straight edge is cut
   */
  root?: number;
  /** An S-shaped bend (θ radians): the first half to one side and the second half to the other, so the strand is not a straight line */
  bend?: number;
}

export interface LockOpts {
  /** Height of the bottom layer of hair's outer surface above the scalp (the locks grow against it): φ, θ */
  bed: (phi: number, th: number) => number;
  fall?: number | ((th: number) => number);
  fallIn?: number | ((th: number) => number);
  /** The maximum height of the outer surface above the scalp (hair under a helmet or hood must not poke out) */
  max?: number;
  rows?: number;
  cols?: number;
}

/** The point on the scalp and its normal; the part beyond fall hangs straight down and tucks in by fallIn, but not into the skull */
function drape(hs: HeadShape, phi: number, th: number, fall: number, fallIn: number, P: THREE.Vector3, N: THREE.Vector3): void {
  if (phi <= fall) {
    hs.point(phi, th, P);
    hs.normal(phi, th, N);
    return;
  }
  hs.point(fall, th, P);
  hs.normal(fall, th, N);
  N.y = 0;
  N.normalize();
  const drop = (phi - fall) * hs.ry;
  P.y -= drop;
  P.x -= Math.sin(th) * drop * fallIn;
  P.z -= Math.cos(th) * drop * fallIn;
  if (P.y > -hs.ry * 0.999) {
    const sk = hs.point(hs.phiAtY(P.y, th), th, _p);
    const need = Math.hypot(sk.x, sk.z) + 0.004;
    const r = Math.hypot(P.x, P.z);
    if (r < need && r > 1e-6) {
      P.x *= need / r;
      P.z *= need / r;
    }
  }
}

/**
 * A group of locks merged into one geometry (the same outline group; the edges of adjacent locks draw their lines through
 * normal turns, so one lock lying over another is visible)
 */
export function hairLocks(hs: HeadShape, locks: Lock[], o: LockOpts): THREE.BufferGeometry {
  const R = o.rows ?? 9;
  const C = o.cols ?? 6;
  const fallF = typeof o.fall === 'function' ? o.fall : ((k: number) => () => k)(o.fall ?? 99);
  const fallInF = typeof o.fallIn === 'function' ? o.fallIn : ((k: number) => () => k)(o.fallIn ?? 0);
  const max = o.max ?? Infinity;
  const geos: THREE.BufferGeometry[] = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (const k of locks) {
    const O: THREE.Vector3[][] = [];
    const I: THREE.Vector3[][] = [];
    const tip = k.tip ?? 0;
    for (let i = 0; i <= R; i++) {
      // Segments get denser toward the tip, so a round tip can be made
      const v = 1 - Math.pow(1 - i / R, 1.6);
      const phi = k.phi0 + (k.L - k.phi0) * v;
      const thc = k.th + (k.sweep ?? 0) * Math.pow(v, 1.4) + (k.curl ?? 0) * smoothstep(v, 0.55, 1) + (k.bend ?? 0) * Math.sin(v * 2 * PI) * (1 - 0.4 * v);
      // Width: slightly narrow at the root, widest in the middle, slowly narrowing in the second half,
      // and the last short stretch closing into a round point (an elliptical arc, not a triangle); tip is the width left when cut straight
      const r0 = k.root ?? 0.82;
      const body = 1 - 0.5 * Math.pow(smoothstep(v, 0.4, 1), 1.2);
      const e = clamp((v - 0.74) / 0.26, 0, 1);
      const end = tip + (1 - tip) * Math.sqrt(Math.max(0, 1 - e * e));
      const wv = k.w * (r0 + (1 - r0) * Math.sin(Math.min(1, v * 1.8) * PI * 0.5)) * body * end;
      // Thickness: the root grows out of the bottom layer of hair, and the tip thins
      const tk = k.thick * smoothstep(v, 0, 0.24) * (1 - 0.55 * smoothstep(v, k.hold ?? 0.55, 1));
      const up = (k.flick ?? 0) * Math.pow(smoothstep(v, 0.5, 1), 2);
      const ro: THREE.Vector3[] = [];
      const ri: THREE.Vector3[] = [];
      for (let j = 0; j <= C; j++) {
        const u = (j / C) * 2 - 1;
        const fall = fallF(thc);
        const s = Math.max(0.35, Math.sin(Math.min(phi, fall, PI / 2)));
        const th = thc + (u * wv) / (s * hs.rx);
        drape(hs, phi, th, fall, fallInF(th), P, N);
        const bed = o.bed(phi, th) + (k.lift ?? 0) + up;
        // Cross-section: a wide flat top (light and shade follow the whole head, split into a few large blocks of top light,
        // side and inner shade, so not every lock is equally bright),
        // the side edges tapering downward and buried 8 mm into the bottom layer, with grooves left between locks so the outline can tell them apart
        const cross = Math.pow(Math.max(0, 1 - u * u), 0.42);
        const outer = Math.min(max, bed - 0.008 + (tk + 0.01) * cross);
        const inner = Math.min(max - 0.003, bed - 0.014);
        ro.push(P.clone().addScaledVector(N, outer));
        ri.push(P.clone().addScaledVector(N, inner));
      }
      O.push(ro);
      I.push(ri);
    }
    geos.push(shellGrid(O, I, false));
  }
  const m = mergeGeometries(geos, false)!;
  for (const g of geos) g.dispose();
  return m;
}

/**
 * Hang angle of short hair: the sides and front do not hang (the pieces hug the temples and the sideburns follow the
 * cheeks), and the back of the head hangs down to the nape only past `back`
 */
export function fallBy(back: number): (th: number) => number {
  return (th) => back + 1.6 * (1 - smoothstep(Math.abs(Math.atan2(Math.sin(th), Math.cos(th))), 1.9, 2.5));
}

/** How much hanging hair tucks inward: side at the sides, back at the back of the head, with a smooth transition between */
export function fallInBy(side: number, back: number): (th: number) => number {
  return (th) => side + (back - side) * smoothstep(Math.abs(Math.atan2(Math.sin(th), Math.cos(th))), 1.5, 2.4);
}

/**
 * Periodic control-point interpolation (angle), for CapOpts.L: pts is [θ, value], with θ increasing and covering -π to π;
 * when left-right symmetric give only 0 to π
 */
export function angleCurve(pts: [number, number][], mirror = true): (th: number) => number {
  const full: [number, number][] = mirror ? [...pts.filter(([a]) => a > 0).map(([a, v]) => [-a, v] as [number, number]).reverse(), ...pts] : pts;
  return (th: number) => {
    let a = Math.atan2(Math.sin(th), Math.cos(th));
    if (a < full[0][0]) a += 2 * PI;
    for (let k = 0; k < full.length; k++) {
      const [x0, y0] = full[k];
      const [x1r, y1] = full[(k + 1) % full.length];
      const x1 = k + 1 < full.length ? x1r : x1r + 2 * PI;
      if (a >= x0 && a <= x1) {
        const t = (a - x0) / (x1 - x0 || 1);
        const e = t * t * (3 - 2 * t);
        return y0 + (y1 - y0) * e;
      }
    }
    return full[0][1];
  };
}

// ───────────────────────── Lofting (limbs, hair tips, fingers) ─────────────────────────

/**
 * A lofted tube along a curve: prof(t) returns [width radius, thickness radius], and 0 at both ends closes into a round tip.
 * side fixes the width direction (use it when the whole curve lies in one plane),
 * otherwise a parallel-transport frame is used so it does not twist at turns. ripple(t, a) makes the cross-section undulate
 * with the angle a around the tube (creases in sleeves and trouser legs, and diagonal folds vary with t and a together).
 */
export function tube(pts: THREE.Vector3[], prof: (t: number) => [number, number], o: { segs?: number; radial?: number; side?: THREE.Vector3; ripple?: (t: number, a: number) => number } = {}): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = o.segs ?? 16;
  const radial = o.radial ?? 12;
  const frames = path.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const C = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    path.getPointAt(t, C);
    const T = frames.tangents[i];
    if (o.side) {
      W.copy(o.side).addScaledVector(T, -T.dot(o.side));
      if (W.lengthSq() < 1e-8) W.copy(frames.normals[i]);
      W.normalize();
    } else W.copy(frames.normals[i]);
    H.crossVectors(W, T).normalize();
    const [a, b] = prof(t);
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * 2 * PI;
      const k = o.ripple ? 1 + o.ripple(t, th) : 1;
      const x = Math.cos(th) * a * k;
      const y = Math.sin(th) * b * k;
      pos.push(C.x + W.x * x + H.x * y, C.y + W.y * x + H.y * y, C.z + W.z * x + H.z * y);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = (i + 1) * radial + j, c = (i + 1) * radial + ((j + 1) % radial), d = i * radial + ((j + 1) % radial);
      idx.push(a, b, d, b, c, d);
    }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setIndex(idx);
  m.computeVertexNormals();
  // Winding: the normals in the middle must point away from the centerline
  const mid = Math.floor(segs / 2) * radial;
  const pa = m.getAttribute('position') as THREE.BufferAttribute;
  const na = m.getAttribute('normal') as THREE.BufferAttribute;
  path.getPointAt(0.5, C);
  let dot = 0;
  for (let j = 0; j < radial; j++) {
    const k = Math.min(pa.count - 1, mid + j);
    dot += new THREE.Vector3().fromBufferAttribute(na, k).dot(new THREE.Vector3().fromBufferAttribute(pa, k).sub(C));
  }
  if (dot < 0) {
    const ix = m.index!.array as Uint32Array | Uint16Array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    m.computeVertexNormals();
  }
  return m;
}

export const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** A loft cross-section with round ends: 0 and 1 close into round tips, and the middle follows r(t) */
export function roundEnds(r0: number, r1: number, k = 0.12): (t: number) => [number, number] {
  return (t) => {
    const e = Math.min(1, Math.sin(Math.min(1, t / k) * PI * 0.5), Math.sin(Math.min(1, (1 - t) / k) * PI * 0.5));
    const r = lerp(r0, r1, t) * Math.sqrt(Math.max(0, e));
    return [r, r];
  };
}

// ───────────────────────── Hands ─────────────────────────

/**
 * Hand: the origin is at the wrist, the fingers point toward -y, and the palm faces side (-x is the right hand with the palm
 * facing left, +x is the left hand with the palm facing right; with the arm hanging the palm faces the thigh), and the thumb points toward +z.
 * The four fingers are short cylinders attached to the palm, curved slightly toward the palm; the thumb grows forward and
 * down from the base of the palm. Returns one merged mesh geometry.
 */
export function handGeo(side: number, size = 1): THREE.BufferGeometry {
  const s = size;
  const parts: THREE.BufferGeometry[] = [];
  // Palm: a rounded block, wide front to back and thin side to side
  const palm = tube([v3(0, 0.012 * s, 0), v3(0, -0.03 * s, 0.002 * s), v3(0, -0.06 * s, 0.004 * s)], (t) => {
    const e = Math.sqrt(Math.max(0, Math.min(1, Math.sin(Math.min(1, t / 0.25) * PI * 0.5), Math.sin(Math.min(1, (1 - t) / 0.2) * PI * 0.5))));
    return [0.019 * s * (0.8 + 0.2 * e), 0.034 * s * (0.75 + 0.25 * t) * e];
  }, { segs: 8, radial: 12, side: new THREE.Vector3(1, 0, 0) });
  parts.push(palm);
  // Four fingers: lined up along z, curving toward the palm (-side)
  for (let k = 0; k < 4; k++) {
    const z = (0.021 - k * 0.014) * s;
    const len = (0.036 - Math.abs(k - 1.2) * 0.004) * s;
    const y0 = -0.052 * s;
    const f = tube([v3(0, y0, z), v3(-side * 0.004 * s, y0 - len * 0.55, z * 1.05), v3(-side * 0.012 * s, y0 - len, z * 1.08)], roundEnds(0.0085 * s, 0.0075 * s, 0.3), { segs: 6, radial: 8 });
    parts.push(f);
  }
  // Thumb
  const th = tube([v3(-side * 0.004 * s, -0.012 * s, 0.018 * s), v3(-side * 0.008 * s, -0.03 * s, 0.034 * s), v3(-side * 0.012 * s, -0.048 * s, 0.038 * s)], roundEnds(0.0105 * s, 0.0085 * s, 0.3), { segs: 6, radial: 8 });
  parts.push(th);
  const m = mergeGeometries(parts.map((g) => prepGeo(g, new THREE.Matrix4())), false)!;
  for (const g of parts) g.dispose();
  return m;
}
