// Moving flames and flags: each merged into a single mesh, with the swaying and fluttering left to the vertex shader (shared
// by the camp, the graveyard and the altar).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M } from '../../../arenaKit.ts';
import { LIGHT } from '../../../toon.ts';
import type { FieldCtx } from '../../kit.ts';
import type { RiftClock } from './glsl.ts';

const BLUE = 0x2e4a8a;
const GOLD = 0xe8c060;

// ───────────────────────── Flames (one mesh, the vertex shader handles the swaying) ─────────────────────────

export class Flames {
  private parts: THREE.BufferGeometry[] = [];
  /** kind: 0 campfire (orange), 1 corrupted wisp fire (purple), 2 the eternal sacred fire (gold-white) */
  add(x: number, y: number, z: number, s: number, phase: number, kind = 0): void {
    for (const [k, rr, hh] of [
      [0, 0.34, 1.1],
      [1, 0.2, 1.5],
      [2, 0.12, 0.8],
    ] as const) {
      const g = new THREE.ConeGeometry(rr * s, hh * s, 7, 3, true).toNonIndexed();
      g.translate((k === 2 ? 0.12 : 0) * s, (hh * s) / 2, (k === 2 ? -0.08 : 0) * s);
      g.translate(x, y, z);
      const n = g.attributes.position.count;
      const base = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) base.set([x, y, z, phase + k * 1.3], i * 4);
      g.setAttribute('aBase', new THREE.BufferAttribute(base, 4));
      const hs = new Float32Array(n);
      for (let i = 0; i < n; i++) hs[i] = hh * s;
      g.setAttribute('aH', new THREE.BufferAttribute(hs, 1));
      const kd = new Float32Array(n);
      kd.fill(kind);
      g.setAttribute('aKind', new THREE.BufferAttribute(kd, 1));
      g.deleteAttribute('uv');
      g.deleteAttribute('normal');
      this.parts.push(g);
    }
  }
  build(ctx: FieldCtx, clock: RiftClock): void {
    const geo = mergeGeometries(this.parts);
    if (!geo) return;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: { uTime: clock.uTime },
      vertexShader: /* glsl */ `
        uniform float uTime; attribute vec4 aBase; attribute float aH; attribute float aKind; varying float vT; varying float vKind;
        void main(){
          vKind = aKind;
          vec3 p = position - aBase.xyz;
          float t = clamp(p.y / aH, 0.0, 1.0);
          vT = t;
          float ph = aBase.w;
          float fl = 1.0 + 0.22 * sin(uTime * 11.0 + ph * 3.0) + 0.14 * sin(uTime * 17.0 + ph);
          p.y *= fl;
          p.x += sin(uTime * 6.0 + ph + t * 3.0) * 0.1 * t * aH;
          p.z += cos(uTime * 5.0 + ph * 1.7 + t * 2.0) * 0.08 * t * aH;
          p.xz *= 1.0 - t * 0.3;
          gl_Position = projectionMatrix * viewMatrix * vec4(p + aBase.xyz, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vT; varying float vKind;
        void main(){
          vec3 base = vKind < 0.5 ? vec3(1.0, 0.95, 0.7) : vKind < 1.5 ? vec3(1.0, 0.75, 1.0) : vec3(1.0, 1.0, 0.9);
          vec3 tip = vKind < 0.5 ? vec3(1.0, 0.42, 0.1) : vKind < 1.5 ? vec3(0.55, 0.15, 1.0) : vec3(1.0, 0.78, 0.35);
          vec3 c = mix(base, tip, smoothstep(0.1, 0.8, vT));
          gl_FragColor = vec4(c * (1.0 - vT * 0.7) * 1.3, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    ctx.group.add(mesh);
    ctx.disposers.push(() => {
      geo.dispose();
      mat.dispose();
    });
  }
}

// ───────────────────────── Flags (cloth that flutters in the wind) ─────────────────────────

export class Banners {
  private parts: THREE.BufferGeometry[] = [];
  /**
   * An upright flag hung at (x, top, z), facing `face` (the direction of the cloth's normal); when given a cloth color it is
   * a plain cloth (laundry, a tent's door flap) with no banner emblem drawn
   */
  add(x: number, top: number, z: number, face: number, w: number, h: number, phase: number, cloth?: number): void {
    const g = new THREE.PlaneGeometry(w, h, 4, 10).toNonIndexed();
    g.translate(0, -h / 2, 0);
    g.applyMatrix4(M(x, top, z, face));
    const n = g.attributes.position.count;
    const nrm = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
    const an = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) an.set([nrm.x, nrm.z, top, phase], i * 4);
    g.setAttribute('aAnim', new THREE.BufferAttribute(an, 4));
    const hh = new Float32Array(n);
    hh.fill(h);
    g.setAttribute('aLen', new THREE.BufferAttribute(hh, 1));
    const cc = new Float32Array(n * 4);
    if (cloth !== undefined) {
      const c = new THREE.Color(cloth);
      for (let i = 0; i < n; i++) cc.set([c.r, c.g, c.b, 1], i * 4);
    }
    g.setAttribute('aCloth', new THREE.BufferAttribute(cc, 4));
    g.deleteAttribute('normal');
    this.parts.push(g);
  }
  build(ctx: FieldCtx, clock: RiftClock): void {
    const geo = mergeGeometries(this.parts);
    if (!geo) return;
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      fog: true,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: clock.uTime, uLightDir: LIGHT.dir, uAmbient: LIGHT.ambient, uBlue: { value: new THREE.Color(BLUE) }, uGold: { value: new THREE.Color(GOLD) } },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        uniform float uTime; attribute vec4 aAnim; attribute float aLen; attribute vec4 aCloth;
        varying vec2 vUv; varying float vShade; varying vec4 vCloth;
        void main(){
          vUv = uv;
          vCloth = aCloth;
          float hang = clamp((aAnim.z - position.y) / aLen, 0.0, 1.0);
          float w = sin(uTime * 2.4 + aAnim.w + hang * 3.2 - uv.x * 1.5) * 0.28 + sin(uTime * 3.7 + aAnim.w * 2.0 + hang * 5.0) * 0.1;
          vec3 p = position + vec3(aAnim.x, 0.0, aAnim.y) * w * pow(hang, 1.2) * aLen * 0.35;
          p.y += (1.0 - cos(w)) * hang * 0.2;
          vShade = 0.72 + 0.28 * cos(uTime * 2.4 + aAnim.w + hang * 3.2 - uv.x * 1.5);
          vec4 mvPosition = viewMatrix * modelMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform vec3 uBlue; uniform vec3 uGold; uniform vec3 uAmbient;
        varying vec2 vUv; varying float vShade; varying vec4 vCloth;
        void main(){
          vec2 uv = vUv;
          if (vCloth.w > 0.5) {
            // Plain cloth: a dark hem along the top edge, a slightly ragged lower hem
            if (uv.y < 0.06 * (0.5 + 0.5 * sin(uv.x * 23.0))) discard;
            vec3 cc = vCloth.rgb * (1.0 - 0.25 * step(0.9, uv.y));
            cc *= vShade * mix(uAmbient * 1.4, vec3(1.1), 0.6);
            gl_FragColor = vec4(cc, 1.0);
            #include <fog_fragment>
            return;
          }
          // Swallowtail: a V is cut from the bottom
          if (uv.y < 0.14 && abs(uv.x - 0.5) < (0.14 - uv.y) * 2.4) discard;
          vec3 c = uBlue;
          float border = step(uv.x, 0.08) + step(0.92, uv.x) + step(0.93, uv.y);
          // Order emblem: a golden diamond starburst and an upright sword
          vec2 q = uv - vec2(0.5, 0.6);
          q.y *= 0.62;
          float star = step(abs(q.x) + abs(q.y), 0.16) * (1.0 - step(abs(q.x) + abs(q.y), 0.11));
          float sword = step(abs(uv.x - 0.5), 0.022) * step(0.34, uv.y) * step(uv.y, 0.84) + step(abs(uv.x - 0.5), 0.09) * step(abs(uv.y - 0.72), 0.018);
          c = mix(c, uGold, clamp(border + star + sword, 0.0, 1.0));
          c *= vShade * mix(uAmbient * 1.4, vec3(1.1), 0.6);
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    ctx.group.add(mesh);
    ctx.disposers.push(() => {
      geo.dispose();
      mat.dispose();
    });
  }
}

