// Post-process outlines: first render the character into a buffer of "normal + part index + linear depth", then draw lines on screen with edge detection.
// The outer silhouette (where the character meets the background) is the thickest, depth jumps from front/back occlusion come next, and part boundaries and normal creases are the thinnest.
// Everything is measured in output pixels, so line width does not change when the camera distance or angle changes. The whole pipeline renders at 1.5x resolution (supersampling),
// the color and normal buffers are additionally multisampled, and the result is scaled back down to the canvas size at the end.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/** Objects that take part in outlining go on this layer (background, ground and light curtains do not) */
export const INK_LAYER = 1;
export const SUPERSAMPLE = 1.5;

// Merged meshes (ink.ts's tagInkPart tagged them with a per-vertex part index inkPart): index = outline group + part index, so lines still appear between the parts inside one mesh, consistent with the game's outlines
const normalVert = /* glsl */ `
  varying vec3 vN;
  varying float vDepth;
  #ifdef USE_INK_PART
    attribute float inkPart;
    varying float vPart;
  #endif
  void main() {
    #ifdef USE_INK_PART
      vPart = inkPart;
    #endif
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;
const normalFrag = /* glsl */ `
  uniform float uId;
  varying vec3 vN;
  varying float vDepth;
  #ifdef USE_INK_PART
    uniform float uFr;
    varying float vPart;
  #endif
  void main() {
    vec3 n = normalize(vN);
    float id = uId;
    #ifdef USE_INK_PART
      id = fract(uFr + floor(vPart + 0.5) * 0.618034) * 0.9 + 0.08;
    #endif
    gl_FragColor = vec4(n.xy, id, vDepth);
  }
`;

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const edgeFrag = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tNormal;
  uniform vec2 uTexel;
  uniform float uOuter;
  uniform float uInner;
  uniform float uCrease;
  uniform float uDepthTh;
  uniform float uNormalTh;
  uniform vec3 uInk;
  uniform float uMode;
  varying vec2 vUv;

  vec3 nrm(vec4 s) { return vec3(s.xy, sqrt(max(0.0, 1.0 - dot(s.xy, s.xy)))); }

  void main() {
    vec4 base = texture2D(tColor, vUv);
    vec4 c = texture2D(tNormal, vUv);
    float mc = step(1e-4, c.a);
    vec3 nc = nrm(c);

    // Outer outline: the background side takes the large radius and the character side only a little, so the line falls mostly outside the silhouette and does not cover edge detail
    float rOut = mix(uOuter, uOuter * 0.35, mc);
    float outer = 0.0;
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 0.3926991;
      vec2 dir = vec2(cos(a), sin(a));
      for (int k = 1; k <= 3; k++) {
        vec4 s = texture2D(tNormal, vUv + dir * rOut * (float(k) / 3.0) * uTexel);
        outer = max(outer, abs(step(1e-4, s.a) - mc));
      }
    }

    float inner = 0.0;
    float crease = 0.0;
    if (mc > 0.5) {
      // The depth threshold is relative to distance and loosened on slanted surfaces (the more slanted the normal, the more depth one pixel spans)
      float th = uDepthTh * c.a / max(nc.z, 0.3);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        vec2 dir = vec2(cos(a), sin(a));
        for (int k = 1; k <= 2; k++) {
          float f = float(k) * 0.5;
          vec4 s = texture2D(tNormal, vUv + dir * uInner * f * uTexel);
          // Draw only on the back side: when the neighbor is closer, this cell is the occluded side
          if (s.a > 1e-4) inner = max(inner, step(th, c.a - s.a));
          vec4 s2 = texture2D(tNormal, vUv + dir * uCrease * f * uTexel);
          if (s2.a > 1e-4) {
            // Draw on both sides of a part boundary with a smaller radius, so the line is centered on the boundary and does not jump left and right with front-back order
            float idEdge = step(1e-3, abs(s2.b - c.b));
            float nEdge = smoothstep(uNormalTh, uNormalTh + 0.12, 1.0 - dot(nc, nrm(s2)));
            crease = max(crease, max(idEdge, nEdge * 0.85));
          }
        }
      }
    }

    vec3 col = base.rgb;
    // Inner lines use a darkened base color and are fainter than the outer outline so the eye catches the silhouette and the face first
    vec3 local = base.rgb * 0.34 + uInk * 0.4;
    col = mix(col, local, crease * 0.78);
    col = mix(col, mix(local, uInk, 0.55), inner * 0.95);
    col = mix(col, uInk, outer);
    if (uMode > 0.5) col = mix(vec3(0.9, 0.91, 0.93), uInk, max(mc, outer));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Scale back to the canvas size: the average of four offset bilinear samples, equivalent to roughly a 1.75-cell box filter
const downFrag = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uSrcTexel;
  varying vec2 vUv;
  void main() {
    vec2 o = uSrcTexel * 0.375;
    vec4 c = texture2D(tSrc, vUv + vec2(-o.x, -o.y)) + texture2D(tSrc, vUv + vec2(o.x, -o.y))
           + texture2D(tSrc, vUv + vec2(-o.x, o.y)) + texture2D(tSrc, vUv + vec2(o.x, o.y));
    gl_FragColor = c * 0.25;
    #include <colorspace_fragment>
  }
`;

export interface InkStyle {
  /** Outer silhouette width (output pixels) */
  outer: number;
  /** Occlusion line sampling radius (output pixels) */
  inner: number;
  /** Sampling radius for part-boundary and crease lines (output pixels) */
  crease: number;
  depthTh: number;
  normalTh: number;
  ink: THREE.ColorRepresentation;
}

export const DEFAULT_INK: InkStyle = { outer: 2.4, inner: 1.3, crease: 0.6, depthTh: 0.035, normalTh: 0.42, ink: 0x2a2231 };

export class InkPipeline {
  readonly colorRT: THREE.WebGLRenderTarget;
  readonly normalRT: THREE.WebGLRenderTarget;
  readonly edgeRT: THREE.WebGLRenderTarget;
  private edge: FullScreenQuad;
  private down: FullScreenQuad;
  private edgeMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private nMats = new WeakMap<THREE.Mesh, THREE.ShaderMaterial>();
  private swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
  private nextId = 1;
  /** Canvas pixels per output pixel (devicePixelRatio) */
  private pr = 1;
  silhouette = false;

  private renderer: THREE.WebGLRenderer;
  style: InkStyle;

  constructor(renderer: THREE.WebGLRenderer, style: InkStyle = DEFAULT_INK) {
    this.renderer = renderer;
    this.style = { ...style };
    const samples = Math.min(4, renderer.capabilities.maxSamples);
    this.colorRT = new THREE.WebGLRenderTarget(1, 1, { samples, type: THREE.HalfFloatType });
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, { samples, type: THREE.HalfFloatType });
    this.edgeRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.edgeMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.colorRT.texture },
        tNormal: { value: this.normalRT.texture },
        uTexel: { value: new THREE.Vector2() },
        uOuter: { value: 0 },
        uInner: { value: 0 },
        uCrease: { value: 0 },
        uDepthTh: { value: 0 },
        uNormalTh: { value: 0 },
        uInk: { value: new THREE.Color() },
        uMode: { value: 0 },
      },
      vertexShader: quadVert,
      fragmentShader: edgeFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.downMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: this.edgeRT.texture }, uSrcTexel: { value: new THREE.Vector2() } },
      vertexShader: quadVert,
      fragmentShader: downFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.edge = new FullScreenQuad(this.edgeMat);
    this.down = new FullScreenQuad(this.downMat);
  }

  /** w and h are pixels on the canvas (already multiplied by pixelRatio), and pr is the pixelRatio */
  setSize(w: number, h: number, pr: number): void {
    this.pr = pr;
    const sw = Math.max(1, Math.round(w * SUPERSAMPLE));
    const sh = Math.max(1, Math.round(h * SUPERSAMPLE));
    this.colorRT.setSize(sw, sh);
    this.normalRT.setSize(sw, sh);
    this.edgeRT.setSize(sw, sh);
    this.edgeMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
    this.downMat.uniforms.uSrcTexel.value.set(1 / sw, 1 / sh);
  }

  private normalMat(m: THREE.Mesh): THREE.ShaderMaterial {
    let nm = this.nMats.get(m);
    if (!nm) {
      // Part index: meshes in the same inkGroup share one index (no lines between them), and every other mesh gets its own
      // For meshes with a per-vertex part index: part p's index equals the outline group gid + p (the fractional part is computed here in double precision first, so the shader only adds small numbers)
      // A mesh produced by mergeStatic carries inkParts parts: it takes that many consecutive indices (part p's index is gid + p), so it does not collide with the next mesh
      const n = Math.max(1, (m.geometry.userData.inkParts as number | undefined) ?? 1);
      const gid = (m.userData.inkGroup as number | undefined) ?? (this.nextId += n) - n;
      const fr = (gid * 0.618034) % 1;
      const id = fr * 0.9 + 0.08;
      const parts = !!m.geometry.attributes.inkPart;
      nm = new THREE.ShaderMaterial({ uniforms: { uId: { value: id }, uFr: { value: fr } }, defines: parts ? { USE_INK_PART: '' } : {}, vertexShader: normalVert, fragmentShader: normalFrag });
      this.nMats.set(m, nm);
    }
    return nm;
  }

  /** Draw one frame. When viewport is null it fills the canvas; otherwise it draws into the given region of the canvas (canvas pixels, origin at the bottom left) */
  render(scene: THREE.Scene, camera: THREE.Camera, viewport: THREE.Vector4 | null = null): void {
    const r = this.renderer;
    const s = this.style;
    const k = SUPERSAMPLE * this.pr;
    const prevTarget = r.getRenderTarget();

    // 1. Color
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.colorRT);
    r.render(scene, camera);

    // 2. Normal + index + depth: draw only the outline layer, with the normal material swapped in
    const bg = scene.background;
    scene.background = null;
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    const prevMask = camera.layers.mask;
    camera.layers.set(INK_LAYER);
    scene.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.layers.test(camera.layers)) return;
      this.swapped.push([m, m.material]);
      m.material = this.normalMat(m);
    });
    r.setRenderTarget(this.normalRT);
    r.clear();
    r.render(scene, camera);
    for (const [m, mat] of this.swapped) m.material = mat;
    this.swapped.length = 0;
    camera.layers.mask = prevMask;
    scene.background = bg;
    r.setClearColor(prevClear, prevAlpha);

    // 3. Edge detection
    const u = this.edgeMat.uniforms;
    u.uOuter.value = s.outer * k;
    u.uInner.value = s.inner * k;
    u.uCrease.value = s.crease * k;
    u.uDepthTh.value = s.depthTh;
    u.uNormalTh.value = s.normalTh;
    (u.uInk.value as THREE.Color).set(s.ink);
    u.uMode.value = this.silhouette ? 1 : 0;
    r.setRenderTarget(this.edgeRT);
    this.edge.render(r);

    // 4. Scale back to the canvas
    r.setRenderTarget(prevTarget);
    if (viewport) {
      r.setViewport(viewport.x / this.pr, viewport.y / this.pr, viewport.z / this.pr, viewport.w / this.pr);
      r.setScissor(viewport.x / this.pr, viewport.y / this.pr, viewport.z / this.pr, viewport.w / this.pr);
      r.setScissorTest(true);
    }
    this.down.render(r);
    if (viewport) {
      const size = r.getSize(new THREE.Vector2());
      r.setViewport(0, 0, size.x, size.y);
      r.setScissorTest(false);
    }
  }

  dispose(): void {
    this.colorRT.dispose();
    this.normalRT.dispose();
    this.edgeRT.dispose();
    this.edge.dispose();
    this.down.dispose();
  }
}
