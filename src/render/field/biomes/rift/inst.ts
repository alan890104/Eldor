// Large numbers of small props (gravel, crystal sprouts, ash piles, rubble):
// every prop of one shape is merged into a single InstancedMesh, each instance storing only its own matrix and color;
// two kinds of material, the scene toon material (sceneMaterial, instance color multiplied on top) or emissive.
// The whole map has just one mesh per shape, so no number of instances adds draw calls.
// Ground debris gets no outline (it is all fine small stuff, and outlines would leave only noise).

import * as THREE from 'three';
import { sceneMaterial } from '../../../spiritToon.ts';
import type { FieldCtx } from '../../kit.ts';
import { VBatch } from '../../vbatch.ts';

// ───────────────────────── Vertex-color batch for things that move as one group ─────────────────────────

const OFF = 1000;

/**
 * A vertex-color batch with no chunking: for things that move or flip as a whole group (the inverted quarter,
 * the floating isles); the group merges into just three or four meshes.
 * VBatch chunks by coordinates, so here every prop is first translated to the same far-away cell,
 * and after the build a child group moves it back to the origin.
 */
export class SoloBatch extends VBatch {
  constructor() {
    super(1e6);
  }
  private shift(m: THREE.Matrix4): THREE.Matrix4 {
    return new THREE.Matrix4().makeTranslation(OFF, 0, OFF).multiply(m);
  }
  override add(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, outline = true): void {
    super.add(geo, color, this.shift(m), outline);
  }
  override glow(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
    super.glow(geo, color, this.shift(m));
  }
  /** Build into parent (parent's origin is the origin of the prop coordinates) */
  buildInto(parent: THREE.Object3D, disposers: (() => void)[]): void {
    const g = new THREE.Group();
    g.position.set(-OFF, 0, -OFF);
    parent.add(g);
    this.build(g);
    disposers.push(() => this.dispose());
  }
}

// ───────────────────────── Instanced small props ─────────────────────────

interface Kind {
  geo: THREE.BufferGeometry;
  glow: boolean;
  m: number[];
  c: number[];
}

export class Scatter {
  private kinds = new Map<string, Kind>();
  private col = new THREE.Color();

  /** Register a shape; glow means emissive (unaffected by lighting, amplified by bloom) */
  kind(name: string, geo: THREE.BufferGeometry, glow = false): void {
    if (!this.kinds.has(name)) this.kinds.set(name, { geo, glow, m: [], c: [] });
  }

  add(name: string, m: THREE.Matrix4, color: number, k = 1): void {
    const kd = this.kinds.get(name);
    if (!kd) return;
    for (let i = 0; i < 16; i++) kd.m.push(m.elements[i]);
    this.col.set(color).multiplyScalar(kd.glow ? 2.2 * k : k);
    kd.c.push(this.col.r, this.col.g, this.col.b);
  }

  count(name: string): number {
    return (this.kinds.get(name)?.c.length ?? 0) / 3;
  }

  build(ctx: FieldCtx): void {
    const toon = sceneMaterial(0xffffff, { rim: 0.3 });
    const glow = new THREE.MeshBasicMaterial({ toneMapped: false });
    const geos: THREE.BufferGeometry[] = [];
    for (const kd of this.kinds.values()) {
      const n = kd.c.length / 3;
      if (!n) continue;
      const mesh = new THREE.InstancedMesh(kd.geo, kd.glow ? glow : toon, n);
      (mesh.instanceMatrix.array as Float32Array).set(kd.m);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(kd.c), 3);
      mesh.computeBoundingSphere();
      ctx.group.add(mesh);
      geos.push(kd.geo);
      kd.m = [];
      kd.c = [];
    }
    ctx.disposers.push(() => {
      toon.dispose();
      glow.dispose();
      for (const g of geos) g.dispose();
    });
  }
}
