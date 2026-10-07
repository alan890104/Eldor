// Drifting Void Blight wisps: purple points of light float over the whole land,
// circling slowly close to the ground and flickering, denser the closer they are to the Wound (the tower, fissures, pits).
// One Points mesh; all the drifting is done in the vertex shader. After purification they turn into golden-green fireflies,
// fewer in number and flying higher.

import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';
import type { RiftClock } from './glsl.ts';
import { BASIN, CRATER, land, T, TOWN } from './shape.ts';

export function buildWisps(ctx: FieldCtx, clock: RiftClock, pure: boolean, r: () => number): void {
  const N = Math.round((ctx.low ? 1000 : 3000) * (pure ? 0.6 : 1));
  const S = ctx.layout.size;
  const pos: number[] = [];
  const seed: number[] = [];
  const col: number[] = [];
  const hubs: [number, number, number][] = [
    [T[0], T[1], 40],
    [CRATER[0], CRATER[1], 22],
    [BASIN[0], BASIN[1], 22],
  ];
  const palette = pure ? [0xffd870, 0xc8f080, 0xfff0b0] : [0xb070ff, 0xff5ab8, 0x8a6aff, 0xd8a0ff];
  const c = new THREE.Color();
  let tries = 0;
  while (pos.length / 3 < N && tries++ < N * 8) {
    let x: number;
    let z: number;
    if (!pure && r() < 0.35) {
      const h = hubs[Math.floor(r() * hubs.length)];
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * h[2];
      x = h[0] + Math.cos(a) * d;
      z = h[1] + Math.sin(a) * d;
    } else {
      x = (r() * 2 - 1) * S * 0.95;
      z = (r() * 2 - 1) * S * 0.95;
    }
    const ld = land(x, z);
    // None drift in the camp (that is warm light there); only a few are left past the cliff edge
    if (Math.hypot(x - TOWN[0], z - TOWN[1]) < 20 && !pure) continue;
    if (ld < -6) continue;
    if (ld < 0 && r() < 0.8) continue;
    const gy = ld > 0 ? ctx.h(x, z) : -1 - r() * 5;
    const y = gy + (pure ? 0.8 + r() * 3.5 : 0.3 + r() * r() * 3.2);
    pos.push(x, y, z);
    seed.push(r() * 6.283, 0.25 + r() * 0.55, 0.4 + r() * 1.6, (pure ? 0.12 : 0.1) + r() * 0.13);
    c.set(palette[Math.floor(r() * palette.length)]);
    col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
  geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), S * 2);
  const uScale = { value: 360 };
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: clock.uTime, uBeat: clock.uBeat, uScale, uPure: { value: pure ? 1 : 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uBeat; uniform float uScale; uniform float uPure;
      attribute vec4 aSeed; attribute vec3 aCol;
      varying vec3 vCol; varying float vA;
      void main(){
        float ph = aSeed.x; float sp = aSeed.y; float rad = aSeed.z;
        float t = uTime * sp + ph;
        vec3 p = position + vec3(sin(t) * rad, sin(t * 1.7 + ph * 2.0) * 0.35 + sin(uTime * 0.3 + ph) * 0.3, cos(t * 0.83) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        // Flickers bright and dim; flares together on the heartbeat
        float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (1.3 + sp * 2.0) + ph * 3.0), 3.0);
        tw *= 1.0 + uBeat * 0.6 * (1.0 - uPure);
        vA = tw * (1.0 - smoothstep(30.0, 75.0, d)) * smoothstep(0.8, 2.5, d);
        vCol = aCol;
        gl_PointSize = clamp(aSeed.w * uScale / max(d, 0.1), 1.0, 26.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float r2 = dot(q, q) * 4.0;
        if (r2 > 1.0) discard;
        float core = exp(-r2 * 9.0);
        float halo = (1.0 - r2) * 0.35;
        gl_FragColor = vec4(vCol * (core * 3.0 + halo) * vA, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  const sz = new THREE.Vector2();
  pts.onBeforeRender = (renderer, _s, cam) => {
    renderer.getDrawingBufferSize(sz);
    const fov = (cam as THREE.PerspectiveCamera).fov ?? 50;
    uScale.value = sz.y / (2 * Math.tan((fov * Math.PI) / 360));
  };
  ctx.group.add(pts);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
}
