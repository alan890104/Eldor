// In-game post-process outline: meshes with INK_LAYER enabled (spirits using the spiritToon material) get their lines from edge detection, replacing the normal-extruded back-face mesh.
// Order within a frame: opaque objects → the ink layer's normals / part ids / depth → compute the lines (only within the spirits' screen extent) → composite the lines into the color and write the lines' depth
// → translucent effects → shrink back to the output size. Lines are composited before the translucent effects, so fog shells, halos and effects cover the lines normally;
// opaque objects in front of a spirit (trees, pillars, glowing parts) hide the lines through the color pass's depth texture.
// When the scene has no ink-layer objects, InkRenderPass hands off to the original RenderPass, and the picture is identical to the old version.
// It also outputs a spirit mask (output size, R = visible spirit pixels), which bloom's bright-pass uses to exclude spirits, so spirits are not washed out by bloom.
// Scene objects (arena props, buildings, map characters) go through the same lines and are marked with inkScenery(): part ids sit in 33 to 63,
// the outer contour is only half the spirits' width and fades with distance, and inner lines and crease lines are lighter; the bloom mask does not include scene objects.

import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { materialOpacity } from './spiritToon.ts';

/** Meshes that take part in the outline enable this layer */
export const INK_LAYER = 1;

/** Root nodes of ink-layer objects (a spirit's root), used to decide whether this frame takes the outline path. Held by weak reference, so a discarded spirit does not stay stuck here */
const inkRoots = new Set<WeakRef<THREE.Object3D>>();

export function registerInkRoot(root: THREE.Object3D): void {
  inkRoots.add(new WeakRef(root));
  // Outline group ids are shared only within one spirit: different spirits (or two of the same species) picking the same group id still do not lose a line where they overlap
  root.userData.inkRoot = true;
}

export interface InkStyle {
  /** Outer contour width (output pixels) */
  outer: number;
  /** Sampling radius for front/back occlusion lines (output pixels) */
  inner: number;
  /** Sampling radius for part-boundary and crease lines (output pixels) */
  crease: number;
  depthTh: number;
  normalTh: number;
  ink: THREE.ColorRepresentation;
  /** Scene-object lines start to fade at this distance (world units), down to 35% at sceneFar */
  sceneNear: number;
  sceneFar: number;
}

export const GAME_INK: InkStyle = { outer: 2.6, inner: 1.2, crease: 0.6, depthTh: 0.035, normalTh: 0.42, ink: 0x1b1026, sceneNear: 14, sceneFar: 60 };

/** Scene objects' part ids start here (spirits use 1 to 31). The normal buffer is half-float, and between 33 and 63 the fractional resolution is 1/32, enough for opacity.
 *  Ordinary scene objects use 33 to 47; heavy lines (light-colored or protagonist-level props, ultimates' solid effects) use 48 to 63, and the lines do not lighten */
const SCENE_ID0 = 33;
const HEAVY_ID0 = 48;

/**
 * Mark a whole group of scene objects (arena props, buildings, map characters) as the ink layer: opaque meshes enable INK_LAYER, and part ids use the scene range.
 * Only opaque toon materials (MeshToon) are outlined; self-lit, translucent and old materials are not. opts.skip can exclude more (for example, the ground gets no lines).
 */
export function inkScenery(root: THREE.Object3D, opts: { skip?: (m: THREE.Mesh) => boolean; heavy?: boolean } = {}): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    // Only toon materials are outlined (spiritMaterial / sceneMaterial, both MeshToonMaterial); the old toonMaterial still carries a back-face outline mesh, so do not outline it twice
    if (!mats.every((x) => (x as THREE.MeshToonMaterial).isMeshToonMaterial && !x.transparent)) return;
    if (opts.skip?.(m)) return;
    m.layers.enable(INK_LAYER);
    m.userData.inkScene = true;
    if (opts.heavy) m.userData.inkHeavy = true;
  });
  registerInkRoot(root);
}

/**
 * Merged meshes (prop batches) mark parts per vertex: different props inside the same mesh still get part lines between them.
 * All vertices of one prop get the same integer; ids rotate within the scene range, so adjacent props collide on an id with a chance of about 1/15
 */
export function tagInkPart(g: THREE.BufferGeometry, part: number): void {
  g.setAttribute('inkPart', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(part % 64), 1));
}

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
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * p;
    vDepth = -mv.z;
    vN = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * mv;
  }
`;
// B channel = part id (integer) + 0.05 + 0.9 × opacity, so the lines fade along with a fading spirit
const normalFrag = /* glsl */ `
  uniform float uId;
  uniform float uOpacity;
  varying vec3 vN;
  varying float vDepth;
  #ifdef USE_INK_PART
    uniform vec2 uIdRange;
    varying float vPart;
  #endif
  void main() {
    // Back faces of double-sided materials: the normal is flipped back toward the camera so cloth strips and flags are outlined on their backs as usual
    vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
    float id = uId;
    #ifdef USE_INK_PART
      id = uIdRange.x + mod(uId - uIdRange.x + floor(vPart + 0.5), uIdRange.y);
    #endif
    gl_FragColor = vec4(n.xy, id + 0.05 + 0.9 * clamp(uOpacity, 0.0, 1.0), vDepth);
  }
`;

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Output: R = fraction of the original color kept, G = fraction of ink color, B = line depth (linear). When compositing, color = original × R + ink × G
const edgeFrag = /* glsl */ `
  #include <packing>
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uNear;
  uniform float uFar;
  uniform float uOuter;
  uniform float uInner;
  uniform float uCrease;
  uniform float uDepthTh;
  uniform float uNormalTh;
  uniform float uSceneNear;
  uniform float uSceneFar;
  varying vec2 vUv;

  float sceneDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return d >= 1.0 ? 1e6 : -perspectiveDepthToViewZ(d, uNear, uFar);
  }
  // Whether this cell is a visible outline layer: it has outline-layer depth and is not blocked by other opaque objects
  float inkAt(vec4 s, float dScene) { return step(1e-4, s.a) * step(s.a, dScene * 1.004 + 0.004); }
  float opacityOf(vec4 s) { return clamp((fract(s.b) - 0.05) / 0.9, 0.0, 1.0); }
  vec3 nrm(vec4 s) { return vec3(s.xy, sqrt(max(0.0, 1.0 - dot(s.xy, s.xy)))); }
  // Scene objects (part id 33 and up); the line fades with distance
  float isScene(vec4 s) { return step(32.5, floor(s.b)); }
  // Heavy-line scene objects (part id 48 and up): the outer outline and inner lines use the line thickness of a spirit, fading only slightly with distance
  float isHeavy(vec4 s) { return step(47.5, floor(s.b)); }
  float sceneFade(float d) { return mix(1.0, 0.35, smoothstep(uSceneNear, uSceneFar, d)); }

  void main() {
    vec4 c = texture2D(tNormal, vUv);
    float dS = sceneDepth(vUv);
    float ic = inkAt(c, dS);
    float dC = ic > 0.5 ? c.a : dS;

    // Outer outline: whoever is in front owns the line. If a spirit is in front: the background side takes the large radius (uOuter) and the spirit side only takes 0.35 times;
    // If a scene object is in front: draw only on the outside, 90% dark on the inner ring and half on the outer ring (thinner than a spirit), fainter with distance. Between the same kind (spirit to spirit, scene to scene) the inner line handles it
    float cS = ic * isScene(c);
    float cP = ic - cS;
    float rOut = cP > 0.5 ? uOuter * 0.35 : uOuter;
    float outer = 0.0;
    float lineD = ic > 0.5 ? c.a : 1e6;
    for (int i = 0; i < OUT_DIRS; i++) {
      float a = float(i) * 6.2831853 / float(OUT_DIRS);
      vec2 dir = vec2(cos(a), sin(a));
      for (int k = 1; k <= 2; k++) {
        vec2 uv = vUv + dir * rOut * (float(k) * 0.5) * uTexel;
        vec4 s = texture2D(tNormal, uv);
        float dSs = sceneDepth(uv);
        float is = inkAt(s, dSs);
        float sS = is * isScene(s);
        float sP = is - sS;
        if (abs(sP - cP) < 0.5 && abs(sS - cS) < 0.5) continue;
        float dSam = is > 0.5 ? s.a : dSs;
        if (cP > 0.5 && dC < dSam * 0.996) {
          outer = max(outer, opacityOf(c));
          lineD = min(lineD, c.a);
        } else if (is > 0.5 && (dSam < dC * 0.996 || (sS > 0.5 && ic < 0.5 && dSam < dC * 1.015))) {
          // When a scene object sits on ground that is not outlined, depth on both sides of the contact line is almost the same; loosen it a bit so the base edge of the prop gets a line
          if (sP > 0.5) {
            outer = max(outer, opacityOf(s));
            lineD = min(lineD, s.a);
          } else {
            // Scene objects: the inner ring (k = 1) is 90% dark and the outer ring gets only half, so the line is thinner than on a spirit; heavy lines follow the spirit on both rings
            float hv = isHeavy(s);
            float ring = k == 1 ? 0.9 : 0.5;
            outer = max(outer, opacityOf(s) * mix(sceneFade(s.a) * ring, 0.6 + 0.4 * sceneFade(s.a), hv));
            lineD = min(lineD, s.a);
          }
        }
      }
    }

    float inner = 0.0;
    float crease = 0.0;
    float creaseId = 0.0;
    if (ic > 0.5) {
      float op = opacityOf(c);
      vec3 nc = nrm(c);
      float th = uDepthTh * c.a / max(nc.z, 0.3);
      for (int i = 0; i < IN_DIRS; i++) {
        float a = float(i) * 6.2831853 / float(IN_DIRS) + IN_ROT;
        vec2 dir = vec2(cos(a), sin(a));
        for (int k = 1; k <= 2; k++) {
          float f = float(k) * 0.5;
          vec2 uv = vUv + dir * uInner * f * uTexel;
          vec4 s = texture2D(tNormal, uv);
          if (inkAt(s, sceneDepth(uv)) > 0.5) inner = max(inner, step(th, c.a - s.a) * op);
          vec2 uv2 = vUv + dir * uCrease * f * uTexel;
          vec4 s2 = texture2D(tNormal, uv2);
          if (inkAt(s2, sceneDepth(uv2)) > 0.5) {
            float idEdge = step(0.5, abs(floor(s2.b) - floor(c.b)));
            float nEdge = smoothstep(uNormalTh, uNormalTh + 0.12, 1.0 - dot(nc, nrm(s2)));
            crease = max(crease, nEdge * 0.85 * op);
            creaseId = max(creaseId, idEdge * op);
          }
        }
      }
    }

    // Inner lines and crease lines of scene objects are fainter and also fade with distance; part lines between props (numbered per vertex) are darker than crease lines on a single prop,
    // so that merged prop batches can still be told apart piece by piece
    if (cS > 0.5) {
      float f = sceneFade(c.a);
      float hv = isHeavy(c);
      inner *= mix(0.85 * f, 0.6 + 0.4 * f, hv);
      crease = max(crease * mix(0.5, 0.85, hv), creaseId * mix(0.85, 1.0, hv)) * mix(f, 0.6 + 0.4 * f, hv);
    } else {
      crease = max(crease, creaseId);
    }

    // Inner lines use a darkened base color (base color × 0.34 + ink color × 0.4), fainter than the outer outline
    float a = crease * 0.78;
    float K = 1.0 - 0.66 * a;
    float L = 0.4 * a;
    float b = inner * 0.95;
    K = K * (1.0 - b) + 0.153 * b;
    L = L * (1.0 - b) + 0.73 * b;
    K *= 1.0 - outer;
    L = L * (1.0 - outer) + outer;
    gl_FragColor = vec4(K, L, lineD < 1e5 ? lineD : dC, 1.0);
  }
`;

// Lay the lines over the color buffer (premultiplied alpha: color = ink × L + original × K) and write the lines' depth at the same time,
// so a translucent effect drawn later that sits behind a spirit does not paint over the spirit's outer lines
const overlayFrag = /* glsl */ `
  #include <packing>
  uniform sampler2D tLine;
  uniform vec3 uInk;
  uniform float uNear;
  uniform float uFar;
  uniform vec3 uFogColor;
  uniform vec3 uFog;
  varying vec2 vUv;
  void main() {
    vec4 l = texture2D(tLine, vUv);
    if (l.x > 0.999 && l.y < 0.001) discard;
    // When the scene has fog, lines are swallowed by the fog like objects (uFog: x is the mode, 0 none, 1 linear, 2 exponential squared; linear uses y and z as start and end, exponential uses y as density)
    float fog = 0.0;
    if (uFog.x > 1.5) fog = 1.0 - exp(-uFog.y * uFog.y * l.z * l.z);
    else if (uFog.x > 0.5) fog = smoothstep(uFog.y, uFog.z, l.z);
    gl_FragColor = vec4(mix(uInk, uFogColor, fog) * l.y, 1.0 - l.x);
    gl_FragDepth = viewZToPerspectiveDepth(-l.z, uNear, uFar);
  }
`;

// Spirit mask: visible ink-layer pixels (not hidden by opaque objects) multiplied by opacity. A whole spirit takes no bloom (after the inverse ACES the highlights exceed 1, and they would blow out),
// and a signature glow that needs a halo uses effect objects instead (vfx light sheets and halos), which take bloom as usual
const maskFrag = /* glsl */ `
  #include <packing>
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 uSrcSize;
  uniform float uNear;
  uniform float uFar;
  varying vec2 vUv;
  void main() {
    vec2 uv = (floor(vUv * uSrcSize) + 0.5) / uSrcSize;
    vec4 s = texture2D(tNormal, uv);
    float d = texture2D(tDepth, uv).x;
    float dS = d >= 1.0 ? 1e6 : -perspectiveDepthToViewZ(d, uNear, uFar);
    float ink = step(1e-4, s.a) * step(s.a, dS * 1.004 + 0.004);
    float op = clamp((fract(s.b) - 0.05) / 0.9, 0.0, 1.0);
    float spirit = 1.0 - step(32.5, floor(s.b));
    gl_FragColor = vec4(ink * op * spirit, 0.0, 0.0, 1.0);
  }
`;

// Shrink back to the output size: with supersampling, average four slightly offset bilinear samples (offset too far and the picture blurs); without supersampling, copy directly
const downFrag = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uSrcTexel;
  uniform float uSpread;
  varying vec2 vUv;
  void main() {
    vec2 o = uSrcTexel * uSpread;
    vec4 c = texture2D(tSrc, vUv + vec2(-o.x, -o.y)) + texture2D(tSrc, vUv + vec2(o.x, -o.y))
           + texture2D(tSrc, vUv + vec2(-o.x, o.y)) + texture2D(tSrc, vUv + vec2(o.x, o.y));
    gl_FragColor = c * 0.25;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const _sphere = new THREE.Sphere();
const _v = new THREE.Vector3();
const _clear = new THREE.Color();

/** The core of the outline: it owns three supersampled buffers (color, normal, line) and outputs to the given target */
export class InkCore {
  style: InkStyle;
  /** Supersampling factor (1 = no supersampling) */
  ss = 1;
  /** Sample count (MSAA) of the color buffer */
  samples = 4;
  /** Low quality: the edge shader takes 8 directions for the outer contour and 4 for inner lines (default 12 / 8), half the samples per pixel */
  low = false;
  /** Canvas pixels per output pixel (devicePixelRatio); line width is multiplied by it */
  pr = 1;
  private colorRT: THREE.WebGLRenderTarget;
  private normalRT: THREE.WebGLRenderTarget;
  private lineRT: THREE.WebGLRenderTarget;
  private maskRT: THREE.WebGLRenderTarget;
  private maskMat: THREE.ShaderMaterial;
  private maskQuad: FullScreenQuad;
  private maskDirty = true;
  /** Meshes in the same inkGroup share part ids and get no lines between them; each registered root (spirit, character) has its own table */
  private groupIds = new Map<string, number>();
  private rootGroupIds = new WeakMap<THREE.Object3D, Map<string, number>>();
  private edgeMat: THREE.ShaderMaterial;
  private overlayMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private edge: FullScreenQuad;
  private overlay: FullScreenQuad;
  private down: FullScreenQuad;
  private nMats = new WeakMap<THREE.Mesh, THREE.ShaderMaterial>();
  private nextId = 1;
  private nextSceneId = 0;
  private nextHeavyId = 0;
  private outW = 1;
  private outH = 1;
  private mats = new Map<THREE.Material, boolean>();
  private inkMeshes: THREE.Mesh[] = [];

  constructor(style: InkStyle = GAME_INK) {
    this.style = { ...style };
    const depthTexture = new THREE.DepthTexture(1, 1);
    this.colorRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.samples, depthTexture });
    // Normal / id / depth must be sampled nearest-point: linear sampling blends the part id and depth at edges (diagonal edges break into chains of dashes, and a line's depth gets pulled closer so it cuts through translucent effects)
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.lineRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.maskRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.maskMat = new THREE.ShaderMaterial({
      uniforms: { tNormal: { value: this.normalRT.texture }, tDepth: { value: depthTexture }, uSrcSize: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 100 } },
      vertexShader: quadVert,
      fragmentShader: maskFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.maskQuad = new FullScreenQuad(this.maskMat);
    this.edgeMat = new THREE.ShaderMaterial({
      defines: { OUT_DIRS: 12, IN_DIRS: 8, IN_ROT: '0.0' },
      uniforms: {
        tNormal: { value: this.normalRT.texture },
        tDepth: { value: depthTexture },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uOuter: { value: 0 },
        uInner: { value: 0 },
        uCrease: { value: 0 },
        uDepthTh: { value: 0 },
        uNormalTh: { value: 0 },
        uSceneNear: { value: 14 },
        uSceneFar: { value: 60 },
      },
      vertexShader: quadVert,
      fragmentShader: edgeFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.overlayMat = new THREE.ShaderMaterial({
      uniforms: {
        tLine: { value: this.lineRT.texture },
        uInk: { value: new THREE.Color() },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uFogColor: { value: new THREE.Color() },
        uFog: { value: new THREE.Vector3() },
      },
      vertexShader: quadVert,
      fragmentShader: overlayFrag,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      depthTest: true,
      depthFunc: THREE.AlwaysDepth,
      depthWrite: true,
      transparent: true,
    });
    this.downMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: this.colorRT.texture }, uSrcTexel: { value: new THREE.Vector2() }, uSpread: { value: 0 } },
      vertexShader: quadVert,
      fragmentShader: downFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.edge = new FullScreenQuad(this.edgeMat);
    this.overlay = new FullScreenQuad(this.overlayMat);
    this.down = new FullScreenQuad(this.downMat);
  }

  /** w, h are the pixel size of the output target */
  setSize(w: number, h: number): void {
    this.outW = Math.max(1, w);
    this.outH = Math.max(1, h);
    const sw = Math.max(1, Math.round(this.outW * this.ss));
    const sh = Math.max(1, Math.round(this.outH * this.ss));
    if (this.colorRT.samples !== this.samples) {
      this.colorRT.samples = this.samples;
      this.colorRT.dispose();
    }
    this.colorRT.setSize(sw, sh);
    this.normalRT.setSize(sw, sh);
    this.lineRT.setSize(sw, sh);
    this.maskRT.setSize(this.outW, this.outH);
    this.maskMat.uniforms.uSrcSize.value.set(sw, sh);
    this.maskDirty = true;
    this.edgeMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
    this.downMat.uniforms.uSrcTexel.value.set(1 / sw, 1 / sh);
    this.downMat.uniforms.uSpread.value = this.ss > 1.01 ? 0.18 : 0;
  }

  /** Whether the scene has any visible ink-layer objects */
  hasInk(scene: THREE.Scene): boolean {
    for (const ref of inkRoots) {
      const r = ref.deref();
      if (!r) {
        inkRoots.delete(ref);
        continue;
      }
      let o: THREE.Object3D | null = r;
      while (o && o.visible && o !== scene) o = o.parent;
      if (o === scene) return true;
    }
    return false;
  }

  /** Spirit mask (output size, R channel): bloom's bright-pass uses it to exclude spirits */
  get spiritMask(): THREE.Texture {
    return this.maskRT.texture;
  }

  /** Clear the mask when this frame has no ink-layer objects (cleared once, only if the previous frame had content) */
  clearMask(renderer: THREE.WebGLRenderer): void {
    if (!this.maskDirty) return;
    const prev = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(_clear).clone();
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.maskRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.setRenderTarget(prev);
    this.maskDirty = false;
  }

  private normalMat(m: THREE.Mesh): THREE.ShaderMaterial {
    let nm = this.nMats.get(m);
    if (!nm) {
      // Part ids 1 to 31 are used in rotation: half-float still has 1/64 resolution between 16 and 32, so the fractional part has room for opacity.
      // Meshes with userData.inkGroup set (a lab model's fur roots, eyelids and skull) share one id per group
      const g = m.userData.inkGroup as number | undefined;
      const scene = !!m.userData.inkScene;
      const heavy = scene && !!m.userData.inkHeavy;
      const key = g !== undefined ? `${heavy ? 'h' : scene ? 's' : 'p'}${g}` : undefined;
      let ids = this.groupIds;
      if (key !== undefined && !scene)
        for (let p: THREE.Object3D | null = m.parent; p; p = p.parent)
          if (p.userData.inkRoot) {
            ids = this.rootGroupIds.get(p) ?? new Map<string, number>();
            this.rootGroupIds.set(p, ids);
            break;
          }
      let id = key !== undefined ? ids.get(key) : undefined;
      if (id === undefined) {
        // A mesh produced by mergeStatic carries inkParts parts: it takes that many consecutive ids, so there are no collisions between its parts or with the next mesh
        const n = key === undefined ? Math.max(1, (m.geometry.userData.inkParts as number | undefined) ?? 1) : 1;
        id = heavy ? HEAVY_ID0 + (this.nextHeavyId++ % 16) : scene ? SCENE_ID0 + (this.nextSceneId++ % 15) : (this.nextId % 31) + 1;
        if (!scene) this.nextId += n;
        if (key !== undefined) ids.set(key, id);
      }
      const parts = !!m.geometry.attributes.inkPart;
      const range = heavy ? [HEAVY_ID0, 16] : scene ? [SCENE_ID0, 15] : [1, 31];
      nm = new THREE.ShaderMaterial({
        uniforms: { uId: { value: id }, uOpacity: { value: 1 }, uIdRange: { value: new THREE.Vector2(range[0], range[1]) } },
        defines: parts ? { USE_INK_PART: '' } : {},
        side: (Array.isArray(m.material) ? m.material[0] : m.material).side,
        vertexShader: normalVert,
        fragmentShader: normalFrag,
      });
      this.nMats.set(m, nm);
    }
    return nm;
  }

  /** The screen extent of the ink layer (in supersampled pixels), or null if there is none */
  private inkRect(camera: THREE.Camera, sw: number, sh: number, pad: number): THREE.Vector4 | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const cam = camera as THREE.PerspectiveCamera;
    for (const m of this.inkMeshes) {
      // Instanced meshes use the union of all instances (computed once; for instances moved on the CPU every frame, the geometry's bounding sphere must be enlarged to the movement range yourself)
      const im = m as THREE.InstancedMesh;
      if (im.isInstancedMesh) {
        if (!im.boundingSphere) im.computeBoundingSphere();
        _sphere.copy(im.boundingSphere!).applyMatrix4(m.matrixWorld);
      } else {
        const g = m.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        _sphere.copy(g.boundingSphere!).applyMatrix4(m.matrixWorld);
      }
      _v.copy(_sphere.center).applyMatrix4(cam.matrixWorldInverse);
      const z = -_v.z;
      // Anything entirely behind the camera does not count; one that crosses the near plane counts as the whole screen needing lines
      if (z + _sphere.radius < cam.near) continue;
      if (z < cam.near * 0.5) return new THREE.Vector4(0, 0, sw, sh);
      _v.copy(_sphere.center).project(cam);
      const rPx = (_sphere.radius / (z * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))) * (sh / 2);
      const cx = (_v.x * 0.5 + 0.5) * sw;
      const cy = (_v.y * 0.5 + 0.5) * sh;
      x0 = Math.min(x0, cx - rPx);
      x1 = Math.max(x1, cx + rPx);
      y0 = Math.min(y0, cy - rPx);
      y1 = Math.max(y1, cy + rPx);
    }
    if (!isFinite(x0)) return null;
    x0 = Math.max(0, Math.floor(x0 - pad));
    y0 = Math.max(0, Math.floor(y0 - pad));
    x1 = Math.min(sw, Math.ceil(x1 + pad));
    y1 = Math.min(sh, Math.ceil(y1 + pad));
    if (x1 <= x0 || y1 <= y0) return null;
    return new THREE.Vector4(x0, y0, x1 - x0, y1 - y0);
  }

  /** Draw one frame to target (null = the canvas) */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): void {
    const s = this.style;
    const k = this.ss * this.pr;
    const sw = this.colorRT.width;
    const sh = this.colorRT.height;
    const autoClear = renderer.autoClear;
    const bg = scene.background;

    // Collect the materials used this frame (recording their original visible), and the visible ink-layer meshes
    this.mats.clear();
    this.inkMeshes.length = 0;
    scene.traverseVisible((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      if (Array.isArray(mat)) for (const x of mat) this.mats.has(x) || this.mats.set(x, x.visible);
      else if (!this.mats.has(mat)) this.mats.set(mat, mat.visible);
      if ((o as THREE.Mesh).isMesh && o.layers.isEnabled(INK_LAYER)) this.inkMeshes.push(o as THREE.Mesh);
    });

    // 1. Opaque objects
    for (const [m, vis] of this.mats) m.visible = vis && !m.transparent;
    renderer.setRenderTarget(this.colorRT);
    renderer.autoClear = true;
    renderer.render(scene, camera);

    // 2. The ink layer's normals / ids / depth (translucent spirits must be drawn too, so the lines can fade with them)
    for (const [m, vis] of this.mats) m.visible = vis;
    scene.background = null;
    const prevClear = renderer.getClearColor(_clear).clone();
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    const prevMask = camera.layers.mask;
    camera.layers.set(INK_LAYER);
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    for (const m of this.inkMeshes) {
      const nm = this.normalMat(m);
      nm.uniforms.uOpacity.value = materialOpacity(m.material as THREE.Material);
      swapped.push([m, m.material]);
      m.material = nm;
    }
    renderer.setRenderTarget(this.normalRT);
    renderer.render(scene, camera);
    for (const [m, mat] of swapped) m.material = mat;
    camera.layers.mask = prevMask;
    renderer.setClearColor(prevClear, prevAlpha);

    // 3. Compute the lines, only near the spirits
    const cam = camera as THREE.PerspectiveCamera;
    const rect = this.inkRect(camera, sw, sh, s.outer * k + 4);
    if (rect) {
      const d = this.edgeMat.defines;
      const outDirs = this.low ? 8 : 12;
      if (d.OUT_DIRS !== outDirs) {
        d.OUT_DIRS = outDirs;
        d.IN_DIRS = this.low ? 4 : 8;
        this.edgeMat.needsUpdate = true;
      }
      const u = this.edgeMat.uniforms;
      u.uNear.value = cam.near;
      u.uFar.value = cam.far;
      u.uOuter.value = s.outer * k;
      u.uInner.value = s.inner * k;
      u.uCrease.value = s.crease * k;
      u.uDepthTh.value = s.depthTh;
      u.uNormalTh.value = s.normalTh;
      u.uSceneNear.value = s.sceneNear;
      u.uSceneFar.value = s.sceneFar;
      // The render target's scissor box must be set before setRenderTarget, so the renderer reads it when it switches targets
      this.lineRT.scissor.copy(rect);
      this.lineRT.scissorTest = true;
      renderer.setRenderTarget(this.lineRT);
      this.edge.render(renderer);
      this.lineRT.scissorTest = false;

      // 4. Lay the lines over the color buffer (no clear)
      const o = this.overlayMat.uniforms;
      (o.uInk.value as THREE.Color).set(s.ink);
      o.uNear.value = cam.near;
      o.uFar.value = cam.far;
      const fog = scene.fog as (THREE.Fog & THREE.FogExp2) | null;
      const fu = o.uFog.value as THREE.Vector3;
      if (!fog) fu.set(0, 0, 0);
      else {
        (o.uFogColor.value as THREE.Color).copy(fog.color);
        if ((fog as THREE.FogExp2).isFogExp2) fu.set(2, fog.density, 0);
        else fu.set(1, fog.near, fog.far);
      }
      renderer.autoClear = false;
      this.colorRT.scissor.copy(rect);
      this.colorRT.scissorTest = true;
      renderer.setRenderTarget(this.colorRT);
      this.overlay.render(renderer);
      this.colorRT.scissorTest = false;
    }

    // 5. Translucent objects on top (depth carried over from step 1 and the lines' depth)
    for (const [m, vis] of this.mats) m.visible = vis && m.transparent;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.colorRT);
    renderer.render(scene, camera);
    for (const [m, vis] of this.mats) m.visible = vis;
    scene.background = bg;
    renderer.autoClear = autoClear;

    // 6. Spirit mask (output size)
    {
      const mu = this.maskMat.uniforms;
      mu.uNear.value = cam.near;
      mu.uFar.value = cam.far;
      const prevClear = renderer.getClearColor(_clear).clone();
      const prevAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(this.maskRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      renderer.setClearColor(prevClear, prevAlpha);
      if (rect) {
        const f = this.outW / sw;
        this.maskRT.scissor.set(Math.floor(rect.x * f), Math.floor(rect.y * f), Math.ceil(rect.z * f) + 1, Math.ceil(rect.w * f) + 1);
        this.maskRT.scissorTest = true;
        renderer.setRenderTarget(this.maskRT);
        this.maskQuad.render(renderer);
        this.maskRT.scissorTest = false;
      }
      this.maskDirty = true;
    }

    // 7. Shrink back to the output size
    renderer.setRenderTarget(target);
    this.down.render(renderer);
  }

  dispose(): void {
    this.colorRT.depthTexture?.dispose();
    this.colorRT.dispose();
    this.normalRT.dispose();
    this.lineRT.dispose();
    this.maskRT.dispose();
    this.maskQuad.dispose();
    this.edge.dispose();
    this.overlay.dispose();
    this.down.dispose();
  }
}

/** The pass for EffectComposer: with ink-layer objects it goes through InkCore, otherwise it hands off to the original RenderPass */
export class InkRenderPass extends Pass {
  readonly core = new InkCore();
  private base: RenderPass;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.base = new RenderPass(scene, camera);
    this.needsSwap = false;
  }

  setSize(width: number, height: number): void {
    this.base.setSize(width, height);
    this.core.setSize(width, height);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    if (!this.core.hasInk(this.scene)) {
      this.core.clearMask(renderer);
      this.base.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      return;
    }
    this.core.render(renderer, this.scene, this.camera, this.renderToScreen ? null : readBuffer);
  }

  dispose(): void {
    this.base.dispose();
    this.core.dispose();
  }
}
