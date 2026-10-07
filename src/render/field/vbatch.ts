// A vertex-color prop batch: used like FieldBatch (add / glow / lift), but the color is written into vertex colors,
// so each chunk is merged into just three meshes ("outlined toon", "unoutlined toon" and "glow")
// and many colors never blow up into thousands of draw calls.
// The material is spiritToon's sceneMaterial (MeshToon + vertex colors), and the outline goes through ink.ts's post-process
// outline (inkScenery), no longer using back-face meshes.
// Chunks far away (beyond the fog) are hidden whole. The field's ctx.b is this by default.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FieldBatch } from './kit.ts';
import { sceneMaterial } from '../spiritToon.ts';
import { INK_LAYER, inkScenery, tagInkPart } from '../ink.ts';

interface Chunk {
  x: number;
  z: number;
  ol: THREE.BufferGeometry[];
  /** Props with heavy outlines (those added while heavy is on) */
  hv: THREE.BufferGeometry[];
  plain: THREE.BufferGeometry[];
  glow: THREE.BufferGeometry[];
  group?: THREE.Group;
  /** Outlined meshes (the outline layer is turned off when too far from the camera) */
  lined?: THREE.Mesh;
  heavyLined?: THREE.Mesh;
}

/**
 * The scene toon material reads vertex colors instead: base color 1, and MeshToon multiplies the vertex colors in (lighting,
 * rim light and fog are the same set as the spirits')
 */
export function sceneVC(rim = 0.35): THREE.MeshToonMaterial {
  const m = sceneMaterial(0xffffff, { rim });
  m.vertexColors = true;
  return m;
}

export class VBatch extends FieldBatch {
  private vc = new Map<string, Chunk>();
  private cs: number;
  private c = new THREE.Color();
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private chunksBuilt: Chunk[] = [];
  /** false: no outlines for the whole batch (for distant views and backgrounds) */
  lines = true;
  /**
   * true: props added afterward get heavy outlines (light-colored stone statues, torii and other landmarks that should stand
   * out; ink.ts's heavy); set it back to false when done
   */
  heavy = false;

  constructor(chunk = 36) {
    super(chunk);
    this.cs = chunk;
  }

  private prep(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, k: number): [THREE.BufferGeometry, Chunk] {
    // Template geometry is reused often, so always copy it before changing it (changing non-indexed geometry directly would move the template itself)
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    // Geometry in the same chunk must have the same attributes to merge; a missing normal makes the whole chunk fail to merge
    if (!g.attributes.normal) g.computeVertexNormals();
    const mm = this.lift ? new THREE.Matrix4().makeTranslation(0, this.lift, 0).multiply(m) : m;
    g.applyMatrix4(mm);
    this.c.set(color).multiplyScalar(k);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = this.c.r;
      arr[i * 3 + 1] = this.c.g;
      arr[i * 3 + 2] = this.c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    // Each prop's own part id: after merging into one mesh, the props still get part lines between them
    tagInkPart(g, this.inkPart++);
    const e = mm.elements;
    const cx = Math.floor(e[12] / this.cs);
    const cz = Math.floor(e[14] / this.cs);
    const key = `${cx},${cz}`;
    let ch = this.vc.get(key);
    if (!ch) this.vc.set(key, (ch = { x: (cx + 0.5) * this.cs, z: (cz + 0.5) * this.cs, ol: [], hv: [], plain: [], glow: [] }));
    return [g, ch];
  }

  override add(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, outline = true): void {
    const [g, ch] = this.prep(geo, color, m, 1);
    (outline ? (this.heavy ? ch.hv : ch.ol) : ch.plain).push(g);
  }

  override glow(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
    const [g, ch] = this.prep(geo, color, m, 2.2);
    ch.glow.push(g);
  }

  override build(parent: THREE.Object3D): void {
    const toon = sceneVC();
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.mats.push(toon, glow);
    for (const ch of this.vc.values()) {
      const g = new THREE.Group();
      const put = (list: THREE.BufferGeometry[], mat: THREE.Material): THREE.Mesh | undefined => {
        if (!list.length) return;
        const merged = mergeGeometries(list);
        for (const x of list) x.dispose();
        if (!merged) return;
        this.geos.push(merged);
        const mesh = new THREE.Mesh(merged, mat);
        g.add(mesh);
        return mesh;
      };
      const lined = put(ch.ol, toon);
      const heavyLined = put(ch.hv, toon);
      put(ch.plain, toon);
      put(ch.glow, glow);
      if (lined && this.lines) {
        inkScenery(lined);
        ch.lined = lined;
      }
      if (heavyLined && this.lines) {
        inkScenery(heavyLined, { heavy: true });
        ch.heavyLined = heavyLined;
      }
      ch.ol = [];
      ch.hv = [];
      ch.plain = [];
      ch.glow = [];
      ch.group = g;
      parent.add(g);
      this.chunksBuilt.push(ch);
    }
    this.vc.clear();
  }

  /**
   * Chunks too far from the camera are hidden whole (an overhead camera shows everything).
   * inkFar: beyond this distance a chunk turns off its outline layer (props in the fog are only silhouettes,
   * the lines are already invisible, and the normal pass draws fewer of them)
   */
  cull(cam: THREE.Vector3, far: number, inkFar = Infinity): void {
    const all = cam.y > 60;
    const f = far + this.cs * 0.72;
    const fi = inkFar + this.cs * 0.72;
    for (const ch of this.chunksBuilt) {
      if (!ch.group) continue;
      const d = Math.hypot(ch.x - cam.x, ch.z - cam.z);
      ch.group.visible = all || d < f;
      for (const m of [ch.lined, ch.heavyLined]) {
        if (!m) continue;
        if (d < fi) m.layers.enable(INK_LAYER);
        else m.layers.disable(INK_LAYER);
      }
    }
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
  }
}
