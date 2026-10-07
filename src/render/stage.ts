// Render stage: WebGL, post-processing (spirit post-process outline, bloom, vignette, chromatic aberration, white flash), the main loop and the time scale (hit-stop, slow motion).

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { InkRenderPass } from './ink.ts';

const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, 64.0);
    }`,
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.35 },
    uVigCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uIsolate: { value: 0 },
    uCA: { value: 0 },
    uFlash: { value: new THREE.Color(1, 1, 1) },
    uFlashAmt: { value: 0 },
    uDesat: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uLift: { value: new THREE.Color(0, 0, 0) },
    uInvert: { value: 0 },
    uLetterbox: { value: 0 },
    uAspect: { value: 1 },
    uTime: { value: 0 },
    uShock: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
    uRadial: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uHaze: { value: new THREE.Vector4(0.5, 0.5, 0.3, 0) },
    uLines: { value: 0 },
    uLinesColor: { value: new THREE.Color(1, 1, 1) },
    uGrain: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform vec2 uVigCenter;
    uniform float uIsolate;
    uniform float uCA;
    uniform vec3 uFlash;
    uniform float uFlashAmt;
    uniform float uDesat;
    uniform vec3 uTint;
    uniform vec3 uLift;
    uniform float uInvert;
    uniform float uLetterbox;
    uniform float uAspect;
    uniform float uTime;
    uniform vec4 uShock;
    uniform vec3 uRadial;
    uniform vec4 uHaze;
    uniform float uLines;
    uniform vec3 uLinesColor;
    uniform float uGrain;
    varying vec2 vUv;
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    vec3 samp(vec2 uv) {
      if (uCA > 0.0) {
        vec2 off = (uv - 0.5) * uCA * 0.03;
        return vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      }
      return texture2D(tDiffuse, uv).rgb;
    }
    void main() {
      vec2 uv = vUv;
      vec2 asp = vec2(uAspect, 1.0);
      // Screen-space shockwave: a ring of refraction pushing outward
      if (uShock.w > 0.0) {
        vec2 d = (uv - uShock.xy) * asp;
        float r = length(d);
        float x = (r - uShock.z) / 0.07;
        float m = exp(-x * x) * uShock.w;
        uv -= (d / max(r, 1e-4)) / asp * m * 0.04;
      }
      // Heat-haze distortion
      if (uHaze.w > 0.0) {
        vec2 d = (uv - uHaze.xy) * asp;
        float m = smoothstep(uHaze.z, 0.0, length(d)) * uHaze.w;
        uv += vec2(sin(uv.y * 90.0 + uTime * 11.0) + sin(uv.y * 37.0 - uTime * 7.0), cos(uv.x * 80.0 + uTime * 9.0)) * 0.0016 * m;
      }
      vec3 col = samp(uv);
      // Radial blur (whip pans, dashes)
      if (uRadial.z > 0.0) {
        vec2 dir = (uv - uRadial.xy) * uRadial.z * 0.09;
        vec3 acc = col;
        for (int i = 1; i < 9; i++) acc += texture2D(tDiffuse, uv - dir * (float(i) / 8.0)).rgb;
        col = acc / 9.0;
      }
      // The vignette center can be offset to act as a spotlight; uIsolate keeps color in the center and desaturates the surroundings
      float v = smoothstep(0.85, 0.2, length((vUv - uVigCenter) * vec2(1.1, 1.0)));
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      float ds = clamp(uDesat * mix(1.0, 1.0 - v, uIsolate), 0.0, 1.0);
      col = mix(col, vec3(l), ds) * uTint + uLift;
      col = mix(col, vec3(1.0) - clamp(col, 0.0, 1.0), uInvert);
      col *= mix(1.0 - uVignette, 1.0, v);
      // Manga focus lines
      if (uLines > 0.0) {
        vec2 p = (vUv - 0.5) * asp;
        float rr = length(p);
        if (rr > 0.16) {
          float a = atan(p.y, p.x) / 6.2831853 + 0.5;
          float cell = floor(a * 120.0);
          float fr = fract(a * 120.0);
          float t = floor(uTime * 15.0);
          float h = hash12(vec2(cell, t));
          float h2 = hash12(vec2(cell + 17.0, t + 3.0));
          float r0 = 0.26 + h2 * 0.36;
          float w = h * 0.42 * smoothstep(r0, r0 + 0.55, rr);
          float line = step(abs(fr - 0.5), w) * step(0.42, h);
          col = mix(col, uLinesColor, line * uLines);
        }
      }
      if (uGrain > 0.0) col += (hash12(vUv * 1024.0 + fract(uTime * 7.0) * 97.0) - 0.5) * uGrain * 0.1;
      col = mix(col, uFlash, uFlashAmt);
      float lb = uLetterbox * 0.12;
      if (vUv.y < lb || vUv.y > 1.0 - lb) col = vec3(0.0);
      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }
  `,
};

/** Cinematic post-process parameters: written into FinalShader every frame (used by ultimate cinematics; defaults otherwise) */
export interface CineGrade {
  letterbox: number;
  desat: number;
  tint: THREE.Color;
  lift: THREE.Color;
  vignette: number;
  vigCenter: THREE.Vector2;
  isolate: number;
  invert: number;
  radial: number;
  radialCenter: THREE.Vector2;
  lines: number;
  linesColor: THREE.Color;
  haze: number;
  hazeCenter: THREE.Vector2;
  hazeRadius: number;
  grain: number;
}

export function defaultGrade(): CineGrade {
  return {
    letterbox: 0,
    desat: 0,
    tint: new THREE.Color(1, 1, 1),
    lift: new THREE.Color(0, 0, 0),
    vignette: 0.35,
    vigCenter: new THREE.Vector2(0.5, 0.5),
    isolate: 0,
    invert: 0,
    radial: 0,
    radialCenter: new THREE.Vector2(0.5, 0.5),
    lines: 0,
    linesColor: new THREE.Color(1, 1, 1),
    haze: 0,
    hazeCenter: new THREE.Vector2(0.5, 0.5),
    hazeRadius: 0.3,
    grain: 0,
  };
}

type Updater = (dt: number, fxDt: number, realDt: number) => void;

export type Quality = 'high' | 'medium' | 'low';

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  /** The first pass: draws the outline when there are post-process outline spirits, otherwise it is equivalent to a RenderPass */
  ink: InkRenderPass;
  bloom: UnrealBloomPass;
  sanitize: ShaderPass;
  final: ShaderPass;
  container: HTMLElement;
  /** World time scale (slow motion) */
  timeScale = 1;
  /** Hit-stop: world time stops until this time (effects keep running) */
  private hitStopUntil = 0;
  private updaters = new Set<Updater>();
  private errored = new WeakSet<Updater>();
  private last = performance.now();
  private running = false;
  private flash = { amt: 0, decay: 4 };
  private ca = { amt: 0, decay: 3 };
  private slow = { until: 0, scale: 1 };
  private shock = { t: 0, dur: 0, amt: 0, r1: 0.9, x: 0.5, y: 0.5 };
  private time = 0;
  /** Post-process grading (letterbox, desaturation, spotlight, speed lines...), written into the shader every frame */
  grade: CineGrade = defaultGrade();
  /** Camera zoom factor (1 = original view; used for ultimate close-ups) */
  fovScale = 1;
  private baseFov = 35;
  /** Normal bloom strength (to restore when a cinematic ends) */
  readonly bloomBase = 0.7;
  quality: Quality = 'high';
  /** Auto downgrade: when the frame rate stays low, step down one tier (down only, never back up) */
  autoQuality = true;
  onAutoQuality: ((q: Quality) => void) | null = null;
  private dtSamples: number[] = [];
  /** The quality before the last auto downgrade and the median frame time at that point: if the downgrade did not make it faster, switch back */
  private lastDrop: { from: Quality; med: number } | null = null;
  fps = 60;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, rt);
    this.ink = new InkRenderPass(this.scene, this.camera);
    this.composer.addPass(this.ink);
    // Clear NaN / infinite pixels before bloom: a single bad pixel would be spread by bloom's downsampling into a large black square
    this.sanitize = new ShaderPass(SanitizeShader);
    this.composer.addPass(this.sanitize);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 1.0);
    // Spirits do not take bloom: the bright-pass is multiplied by (1 − spirit mask), while ultimate effects and the scene glow as before.
    // The mask is dilated outward by 2 pixels: the ring of anti-aliased silhouette edge has a mask below 1, and that is exactly where the rim light is brightest, so it would leak out as a halo
    const hp = this.bloom.materialHighPassFilter;
    hp.uniforms.tSpiritMask = { value: this.ink.core.spiritMask };
    hp.fragmentShader = hp.fragmentShader
      .replace(
        'uniform sampler2D tDiffuse;',
        `uniform sampler2D tDiffuse;
uniform sampler2D tSpiritMask;
float spiritMaskAt(vec2 uv) {
  vec2 px = 2.0 / vec2(textureSize(tSpiritMask, 0));
  float m = texture2D(tSpiritMask, uv).r;
  m = max(m, texture2D(tSpiritMask, uv + vec2(px.x, 0.0)).r);
  m = max(m, texture2D(tSpiritMask, uv - vec2(px.x, 0.0)).r);
  m = max(m, texture2D(tSpiritMask, uv + vec2(0.0, px.y)).r);
  m = max(m, texture2D(tSpiritMask, uv - vec2(0.0, px.y)).r);
  return m;
}`,
      )
      .replace('gl_FragColor = mix( outputColor, texel, alpha );', 'gl_FragColor = mix( outputColor, texel, alpha * ( 1.0 - spiritMaskAt( vUv ) ) );');
    hp.needsUpdate = true;
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setLowQuality(low: boolean): void {
    this.setQuality(low ? 'low' : 'high');
  }

  /**
   * Three quality tiers (pixel ratio in CSS pixels, capped by the screen's devicePixelRatio):
   * - high: 2x resolution + bloom; medium: 1.5x resolution + bloom; low: 1x resolution, no bloom, outline sampling halved.
   * - The outline's 4x MSAA is only enabled when the pixel ratio is below 1.4 (ordinary screens with coarse pixels): on a Retina screen a resolution of 1.5x or more is already fine enough,
   *   while MSAA (together with the depth texture's resolution) takes more than half of the frame time (1512×860 Retina battle: high drops from about 60 to about 18 ms).
   * - The post-process buffer does not use MSAA: the outline layer finishes drawing the frame and only then pastes it into the post-process buffer with a full-screen quad, where MSAA has no effect and only wastes bandwidth.
   * - low no longer goes below 1x resolution: at 0.6x the spirits' silhouettes and outlines are magnified into stair-stepped jaggies (only 0.3x on Retina).
   */
  setQuality(q: Quality): void {
    this.quality = q;
    this.dtSamples.length = 0;
    const ratio = Math.min(window.devicePixelRatio, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    this.renderer.setPixelRatio(ratio);
    this.bloom.enabled = q !== 'low';
    this.sanitize.enabled = this.bloom.enabled;
    // A change of sample count takes effect only after releasing and rebuilding; the post-process resolution must also follow the canvas pixel ratio
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      rt.samples = 0;
      rt.dispose();
    }
    this.composer.setPixelRatio(ratio);
    this.applyInkQuality();
    this.resize();
  }

  /**
   * Outline quality: on screens with a pixel ratio below 1.4, high enables 1.5x supersampling within the total pixel budget;
   * 4x MSAA is only enabled when the actual sampling density (pixel ratio × supersampling) is still below 1.4 (medium on an ordinary screen), and the two do not stack.
   * At a pixel ratio of 1.4 or more (phones, Retina) the screen is fine enough already, so neither supersampling nor MSAA is used. low enables neither.
   * Line width is in CSS pixels, multiplied by the current pixelRatio.
   */
  private applyInkQuality(): void {
    const core = this.ink.core;
    const ratio = this.renderer.getPixelRatio();
    const w = (this.container.clientWidth || window.innerWidth) * ratio;
    const h = (this.container.clientHeight || window.innerHeight) * ratio;
    core.pr = ratio;
    core.low = this.quality === 'low';
    core.ss = this.quality === 'high' && ratio < 1.4 ? Math.max(1, Math.min(1.5, Math.sqrt(4.2e6 / Math.max(1, w * h)))) : 1;
    core.samples = this.quality !== 'low' && ratio * core.ss < 1.4 ? 4 : 0;
  }

  private watchFps(rawDt: number): void {
    // Anything over 1 second is mostly a tab switch, so it is not counted
    if (!this.autoQuality || document.hidden || rawDt > 1) return;
    if (this.quality === 'low' && !this.lastDrop) return;
    this.dtSamples.push(rawDt);
    const total = this.dtSamples.reduce((a, b) => a + b, 0);
    if (this.dtSamples.length < 12 || total < 3) return;
    const sorted = [...this.dtSamples].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    this.dtSamples.length = 0;
    // The frame rate did not improve noticeably after the downgrade: the bottleneck is not rendering (for example the browser's power-saving mode locks the frame rate to 30), so switch back to the original quality and stop auto adjusting
    const drop = this.lastDrop;
    this.lastDrop = null;
    if (drop && med > drop.med * 0.85) {
      this.setQuality(drop.from);
      this.autoQuality = false;
      return;
    }
    if (med > 1 / 38 && this.quality !== 'low') {
      const next: Quality = this.quality === 'high' ? 'medium' : 'low';
      this.lastDrop = { from: this.quality, med };
      this.setQuality(next);
      this.onAutoQuality?.(next);
    }
  }

  /** For tests: allow a larger time step, so time still follows real elapsed time in a low-frame-rate environment */
  maxDt = 0.1;

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.applyInkQuality();
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Pull the camera back a bit in portrait so both sides stay in frame
    this.baseFov = w < h ? 52 : 35;
    this.camera.fov = this.baseFov * this.fovScale;
    this.camera.updateProjectionMatrix();
    this.final.uniforms.uAspect.value = w / h;
  }

  add(fn: Updater): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame();
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  frames = 0;
  private frame(): void {
    this.frames++;
    const now = performance.now();
    const rawDt = (now - this.last) / 1000;
    this.watchFps(rawDt);
    const realDt = Math.min(this.maxDt, rawDt);
    this.last = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(realDt, 0.001)) * 0.05;
    let scale = this.timeScale;
    if (now < this.slow.until) scale *= this.slow.scale;
    const fxDt = realDt * scale;
    const dt = now < this.hitStopUntil ? 0 : fxDt;
    for (const u of this.updaters) {
      try {
        u(dt, fxDt, realDt);
      } catch (e) {
        if (!this.errored.has(u)) {
          this.errored.add(u);
          console.error('stage updater error', e);
        }
      }
    }
    this.flash.amt = Math.max(0, this.flash.amt - realDt * this.flash.decay);
    this.ca.amt = Math.max(0, this.ca.amt - realDt * this.ca.decay);
    this.final.uniforms.uFlashAmt.value = Math.min(0.9, this.flash.amt);
    this.final.uniforms.uCA.value = this.ca.amt;
    this.time += realDt;
    this.applyGrade(realDt);
    this.composer.render(realDt);
  }

  /**
   * Precompile shaders: objects temporarily hidden under root are compiled too (renderer.compile only compiles what is visible, so a hidden effect hitches for about 0.2 s the first time it appears).
   * An ultimate calls this once at the start of windup, after building all its effect objects. The frame is drawn into half-float render targets (the outline pipeline and post-process),
   * and compiling against the same kind of target makes the shader variant match (compiling against the canvas gives a different variant, which would still hitch).
   */
  prewarm(root: THREE.Object3D = this.scene): void {
    const hidden: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    this.prewarmRT ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.prewarmRT);
    try {
      this.renderer.compile(root, this.camera, this.scene);
    } finally {
      this.renderer.setRenderTarget(prev);
      for (const o of hidden) o.visible = false;
    }
  }
  private prewarmRT: THREE.WebGLRenderTarget | null = null;

  hitStop(ms: number): void {
    this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + ms);
  }

  slowMo(scale: number, ms: number): void {
    this.slow = { scale, until: performance.now() + ms };
  }

  screenFlash(color: THREE.ColorRepresentation, amt = 0.8, decay = 4): void {
    this.final.uniforms.uFlash.value.set(color);
    // Low quality has no supersampling or tone-mapping detail, so the same flash washes out more
    this.flash = { amt: this.quality === 'low' ? amt * 0.65 : amt, decay };
  }

  chromatic(amt = 1): void {
    this.ca.amt = Math.max(this.ca.amt, amt);
  }

  setLetterbox(v: number): void {
    this.grade.letterbox = v;
  }

  setDesaturate(v: number): void {
    this.grade.desat = v;
  }

  setTint(c: THREE.ColorRepresentation): void {
    this.grade.tint.set(c);
  }

  /** Screen-space shockwave: expands outward from screen coordinates (0 to 1, origin at the bottom left) */
  shockwave(x: number, y: number, amt = 1, dur = 0.6, radius = 0.9): void {
    this.shock = { t: 0, dur, amt, r1: radius, x, y };
  }

  setFovScale(s: number): void {
    this.fovScale = s;
    this.camera.fov = this.baseFov * s;
    this.camera.updateProjectionMatrix();
  }

  /** Restore all cinematic state: grading, zoom, time scale, bloom */
  resetCinematic(): void {
    this.grade = defaultGrade();
    this.shock.dur = 0;
    this.timeScale = 1;
    this.slow = { until: 0, scale: 1 };
    this.bloom.strength = this.bloomBase;
    if (this.fovScale !== 1) this.setFovScale(1);
    this.applyGrade(0);
  }

  private applyGrade(realDt: number): void {
    const u = this.final.uniforms;
    const g = this.grade;
    u.uTime.value = this.time % 1000;
    u.uLetterbox.value = g.letterbox;
    u.uDesat.value = g.desat;
    u.uTint.value.copy(g.tint);
    u.uLift.value.copy(g.lift);
    u.uVignette.value = g.vignette;
    u.uVigCenter.value.copy(g.vigCenter);
    u.uIsolate.value = g.isolate;
    u.uInvert.value = g.invert;
    u.uRadial.value.set(g.radialCenter.x, g.radialCenter.y, g.radial);
    u.uLines.value = g.lines;
    u.uLinesColor.value.copy(g.linesColor);
    u.uHaze.value.set(g.hazeCenter.x, g.hazeCenter.y, g.hazeRadius, g.haze);
    u.uGrain.value = g.grain;
    const sh = this.shock;
    if (sh.dur > 0) {
      sh.t += realDt;
      const k = Math.min(1, sh.t / sh.dur);
      u.uShock.value.set(sh.x, sh.y, sh.r1 * (1 - Math.pow(1 - k, 2.2)), sh.amt * (1 - k) * (1 - k));
      if (k >= 1) sh.dur = 0;
    } else u.uShock.value.w = 0;
  }

  /** World coordinates → post-process screen coordinates (0 to 1, origin at the bottom left); behind = behind the camera */
  toUv(p: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const v = p.clone().project(this.camera);
    return { x: v.x * 0.5 + 0.5, y: v.y * 0.5 + 0.5, behind: v.z > 1 };
  }

  /** World coordinates → screen pixels */
  project(p: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const v = p.clone().project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 };
  }

  clearScene(): void {
    const keep: THREE.Object3D[] = [];
    for (const o of [...this.scene.children]) {
      if (!keep.includes(o)) {
        this.scene.remove(o);
        disposeTree(o);
      }
    }
    this.scene.fog = null;
    this.scene.background = null;
  }
}

export function disposeTree(o: THREE.Object3D): void {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
    else if (mat) mat.dispose();
  });
}
