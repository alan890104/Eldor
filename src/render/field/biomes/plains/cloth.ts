// Cloth that sways in the wind: flags, felt and cloth hung to dry, ribbons on the ovoo and the lone tree, prayer flags.
// All merged into one mesh; the vertex shader sways it by "distance from the fixed edge"; ribbons are blown out toward leeward.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Wind over the plains (same direction as the grass sea's wind: blowing toward the southeast) */
export const WIND = new THREE.Vector3(0.87, 0, 0.49);

interface Piece {
  pos: number[];
  u: number[];
  n: number[];
  s: number[];
  col: number[];
  ph: number[];
  idx: number[];
}

export class ClothSet {
  private p: Piece = { pos: [], u: [], n: [], s: [], col: [], ph: [], idx: [] };
  private c = new THREE.Color();

  /**
   * A piece of cloth: starting at corner, laid out along `along` (the fixed edge) and `down` (the free direction) into an nu × nv
   * grid;
   * aU runs from 0 at the fixed edge to 1 at the free end; flap is the swing direction;
   * stream is the displacement of the free end blown out by the wind.
   */
  private sheet(corner: THREE.Vector3, along: THREE.Vector3, down: THREE.Vector3, nu: number, nv: number, flap: THREE.Vector3, stream: THREE.Vector3, col: number, phase: number, spread = 0.8): void {
    const P = this.p;
    const base = P.pos.length / 3;
    this.c.set(col);
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const a = i / nu;
        const v = j / nv;
        const x = corner.x + along.x * a + down.x * v;
        const y = corner.y + along.y * a + down.y * v;
        const z = corner.z + along.z * a + down.z * v;
        P.pos.push(x, y, z);
        P.u.push(v);
        P.n.push(flap.x, flap.y, flap.z);
        P.s.push(stream.x, stream.y, stream.z);
        P.col.push(this.c.r, this.c.g, this.c.b);
        P.ph.push(phase + a * spread);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const k = base + j * (nu + 1) + i;
        P.idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1);
      }
    }
  }

  /** Flag: hung on the flagpole from y0 to y1, extending w meters toward dir (a horizontal direction) */
  flag(x: number, z: number, y0: number, y1: number, dir: THREE.Vector3, w: number, col: number, phase = Math.random() * 6, stripe?: number): void {
    const d = dir.clone().setY(0).normalize();
    const flap = new THREE.Vector3(-d.z, 0, d.x);
    const sag = new THREE.Vector3(0, -0.08 * w, 0);
    this.sheet(new THREE.Vector3(x, y1, z), new THREE.Vector3(0, y0 - y1, 0), d.clone().multiplyScalar(w), 2, 8, flap, sag, col, phase, 0);
    if (stripe !== undefined) {
      // A decorative stripe across the middle of the flag: swings the same way, stuck on both faces of the cloth
      const h = y1 - y0;
      for (const s of [-1, 1]) this.sheet(new THREE.Vector3(x, y1 - h * 0.4, z).addScaledVector(flap, s * 0.012), new THREE.Vector3(0, -h * 0.2, 0), d.clone().multiplyScalar(w), 1, 8, flap, sag, stripe, phase, 0);
    }
  }

  /** Cloth hanging down from the rope a→b (felt hung to dry, prayer flags) */
  hang(a: THREE.Vector3, b: THREE.Vector3, h: number, col: number, phase = Math.random() * 6, blow = 0.35): void {
    const along = b.clone().sub(a);
    const flap = new THREE.Vector3(-along.z, 0, along.x).normalize();
    const n = Math.max(1, Math.round(along.length() / 0.4));
    // Wind direction: projected onto the cloth's normal, so the cloth bulges outward
    const push = flap.clone().multiplyScalar(flap.dot(WIND) >= 0 ? 1 : -1);
    this.sheet(a, along, new THREE.Vector3(0, -h, 0), n, Math.max(2, Math.round(h / 0.3)), flap, push.multiplyScalar(h * blow).add(new THREE.Vector3(0, h * blow * 0.3, 0)), col, phase);
  }

  /** Ribbon tied at a single point: blown into an arc toward leeward */
  strip(top: THREE.Vector3, len: number, width: number, col: number, phase = Math.random() * 6): void {
    const side = new THREE.Vector3(-WIND.z, 0, WIND.x).multiplyScalar(width);
    const corner = top.clone().addScaledVector(side, -0.5);
    this.sheet(corner, side, new THREE.Vector3(0, -len, 0), 1, Math.max(3, Math.round(len / 0.25)), side.clone().normalize(), WIND.clone().multiplyScalar(len * 0.85).add(new THREE.Vector3(0, len * 0.45, 0)), col, phase);
  }

  /** Merge into one mesh; returns the update to call every frame (time and flash) */
  build(parent: THREE.Object3D, disposers: (() => void)[]): (t: number, flash: number) => void {
    const P = this.p;
    if (!P.idx.length) return () => {};
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(P.u, 1));
    g.setAttribute('aN', new THREE.Float32BufferAttribute(P.n, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(P.s, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3));
    g.setAttribute('aPh', new THREE.Float32BufferAttribute(P.ph, 1));
    g.setIndex(P.idx);
    g.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({
      fog: true,
      vertexColors: true,
      side: THREE.DoubleSide,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uFlash: { value: 0 } },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        attribute float aU; attribute vec3 aN; attribute vec3 aS; attribute float aPh;
        uniform float uTime;
        varying vec3 vC; varying float vShade;
        void main() {
          float t = uTime * 3.3 + aPh;
          float wave = sin(t - aU * 5.2) * 0.55 + sin(t * 1.9 - aU * 9.0 + aPh) * 0.22;
          float amp = aU * aU * 0.3 + aU * 0.05;
          float gust = 0.75 + 0.25 * sin(uTime * 0.9 + aPh * 0.3);
          vec3 p = position + aN * wave * amp + aS * aU * aU * gust;
          vC = color;
          vShade = 0.78 + 0.22 * sin(t - aU * 5.2 + 1.3);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uFlash;
        varying vec3 vC; varying float vShade;
        void main() {
          vec3 c = vC * vShade + vec3(0.7, 0.7, 1.0) * uFlash * 0.45;
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(g, mat);
    parent.add(mesh);
    disposers.push(() => {
      g.dispose();
      mat.dispose();
    });
    return (t, flash) => {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uFlash.value = flash;
    };
  }
}

/** Small helper to merge a group of geometries (unused attributes are dropped first) */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const list = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
  });
  return list.length ? mergeGeometries(list) : null;
}
