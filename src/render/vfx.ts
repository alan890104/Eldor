// Effects system: GPU point particles (additive blending) + mesh effects (shockwaves, slashes, light pillars, lightning, magic circles, projectiles).
// Everything runs on the fx clock and keeps moving during hit-stop, which is the key to "frozen but tense".

import * as THREE from 'three';
import { glowTex, particleAtlas, ringTex, runeCircleTex } from './textures.ts';
import { starTex, streakTex } from './fxtex.ts';
import { INK_LAYER } from './ink.ts';
import { sceneMaterial } from './spiritToon.ts';

export interface EmitOptions {
  pos: THREE.Vector3;
  count: number;
  color: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  /** Initial speed range */
  speed?: [number, number];
  /** Emission direction (uniform over the sphere when unspecified) */
  dir?: THREE.Vector3;
  spread?: number;
  life?: [number, number];
  size?: [number, number];
  sizeEnd?: number;
  gravity?: number;
  drag?: number;
  atlas?: 0 | 1 | 2 | 3;
  /** Random radius of the start position */
  radius?: number;
  /** Pull toward the center (implosion); the start distance is 0.6 to 1.2 times radius */
  inward?: boolean;
  intensity?: number;
  spin?: number;
}

export class Particles {
  points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private alpha: Float32Array;
  private size: Float32Array;
  private size0: Float32Array;
  private size1: Float32Array;
  private life: Float32Array;
  private life0: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private atlas: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private cursor = 0;
  private live = 0;
  /** There are newly emitted particles since the last upload */
  private fresh = false;
  private geo = new THREE.BufferGeometry();

  /** blending: additive (glow) or normal blending (smoke, which can be darker than the background) */
  constructor(max = 6000, blending: THREE.Blending = THREE.AdditiveBlending) {
    const MAX = max;
    this.max = MAX;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.alpha = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.size0 = new Float32Array(MAX);
    this.size1 = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.life0 = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.atlas = new Float32Array(MAX);
    this.rot = new Float32Array(MAX);
    this.spin = new Float32Array(MAX);
    const g = this.geo;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAtlas', new THREE.BufferAttribute(this.atlas, 1));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: particleAtlas() }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize; attribute float aAtlas; attribute float aRot;
        uniform float uScale;
        varying vec3 vColor; varying float vAlpha; varying float vAtlas; varying float vRot;
        void main() {
          vColor = aColor; vAlpha = aAlpha; vAtlas = aAtlas; vRot = aRot;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap;
        varying vec3 vColor; varying float vAlpha; varying float vAtlas; varying float vRot;
        void main() {
          if (vAlpha <= 0.0) discard;
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          vec2 cell = vec2(mod(vAtlas, 2.0), floor(vAtlas / 2.0));
          vec2 uv = (clamp(p, 0.0, 1.0) + cell) * 0.5;
          uv.y = 1.0 - uv.y;
          vec4 t = texture2D(tMap, uv);
          gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === THREE.AdditiveBlending ? 10 : 9;
  }

  setScale(viewportHeight: number, fov: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value =
      viewportHeight / (2 * Math.tan((fov * Math.PI) / 360));
  }

  emit(o: EmitOptions): void {
    const cols = (Array.isArray(o.color) ? o.color : [o.color]).map((c) => new THREE.Color(c));
    const inten = o.intensity ?? 1.6;
    const v = new THREE.Vector3();
    const count = Math.max(0, Math.floor(o.count));
    if (count > 0) {
      this.live = 2;
      this.fresh = true;
    }
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const sp = rand(o.speed ?? [1, 3]);
      if (o.dir) {
        v.copy(o.dir).normalize();
        const s = o.spread ?? 0.4;
        v.x += (Math.random() - 0.5) * s * 2;
        v.y += (Math.random() - 0.5) * s * 2;
        v.z += (Math.random() - 0.5) * s * 2;
        v.normalize();
      } else {
        v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      }
      const r = o.radius ?? 0;
      const ox = r ? (Math.random() - 0.5) * 2 * r : 0;
      const oy = r ? (Math.random() - 0.5) * 2 * r : 0;
      const oz = r ? (Math.random() - 0.5) * 2 * r : 0;
      if (o.inward) {
        // If radius is given, pull in from that distance; otherwise keep the old 1.2 to 2.4
        const d = r ? r * (0.6 + Math.random() * 0.6) : 1.2 + Math.random() * 1.2;
        this.pos[i * 3] = o.pos.x + v.x * d;
        this.pos[i * 3 + 1] = o.pos.y + v.y * d;
        this.pos[i * 3 + 2] = o.pos.z + v.z * d;
        this.vel[i * 3] = -v.x * sp;
        this.vel[i * 3 + 1] = -v.y * sp;
        this.vel[i * 3 + 2] = -v.z * sp;
      } else {
        this.pos[i * 3] = o.pos.x + ox;
        this.pos[i * 3 + 1] = o.pos.y + oy;
        this.pos[i * 3 + 2] = o.pos.z + oz;
        this.vel[i * 3] = v.x * sp;
        this.vel[i * 3 + 1] = v.y * sp;
        this.vel[i * 3 + 2] = v.z * sp;
      }
      const c = cols[Math.floor(Math.random() * cols.length)];
      this.col[i * 3] = c.r * inten;
      this.col[i * 3 + 1] = c.g * inten;
      this.col[i * 3 + 2] = c.b * inten;
      const l = rand(o.life ?? [0.4, 0.9]);
      this.life[i] = l;
      this.life0[i] = l;
      const s0 = rand(o.size ?? [0.15, 0.35]);
      this.size0[i] = s0;
      this.size1[i] = s0 * (o.sizeEnd ?? 0.2);
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      this.atlas[i] = o.atlas ?? 0;
      this.rot[i] = Math.random() * Math.PI * 2;
      this.spin[i] = (Math.random() - 0.5) * (o.spin ?? 4);
      this.alpha[i] = 1;
      this.size[i] = s0;
    }
  }

  update(dt: number): void {
    if (this.live <= 0) return;
    // Not advanced during time stop (fx clock is 0), but particles emitted in that time are still uploaded and stay where they were emitted
    if (dt <= 0) {
      if (this.fresh) this.upload();
      return;
    }
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = 0;
        continue;
      }
      alive++;
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.life0[i];
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = this.life[i] <= 0 ? 0 : k < 0.1 ? k * 10 : 1 - Math.pow((k - 0.1) / 0.9, 1.5);
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * k;
      this.rot[i] += this.spin[i] * dt;
    }
    // Upload once more after all particles have died out (to zero the opacity), then there is no need to upload every frame
    if (alive === 0) this.live--;
    this.upload();
  }

  private upload(): void {
    this.fresh = false;
    const a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.aAlpha.needsUpdate = true;
    a.aSize.needsUpdate = true;
    a.aColor.needsUpdate = true;
    a.aAtlas.needsUpdate = true;
    a.aRot.needsUpdate = true;
  }
}

function rand([a, b]: [number, number]): number {
  return a + Math.random() * (b - a);
}

// ───────────────────────── Mesh effects ─────────────────────────

type Effect = {
  t: number;
  dur: number;
  obj: THREE.Object3D;
  tick: (k: number, dt: number) => void;
  done?: () => void;
  /** Custom disposal (example: afterimages share the spirit's geometry, so they can only dispose their own material) */
  dispose?: () => void;
  killed?: boolean;
};

/** Control handle for a persistent effect: after kill() it is removed and disposed on the next frame */
export interface FxLayer {
  kill(): void;
  readonly alive: boolean;
}

/** Dispose the geometry and materials of a whole object tree (a Sprite's geometry is global and shared, so it must not be disposed) */
/** Dispose an effect's geometry and materials; anything marked userData.shared (scene-shared materials, template geometry) is kept, so the next use does not recompile and hitch */
export function disposeFx(o: THREE.Object3D): void {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (!(x as THREE.Sprite).isSprite && !m.geometry?.userData.shared) m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    for (const mm of Array.isArray(mat) ? mat : mat ? [mat] : []) if (!mm.userData.shared) mm.dispose();
  });
}

/** Build a tube with "tapering thickness" along a curve (vines, tentacles, tree roots); index is ordered by length, so drawRange can drive a growth animation */
export function taperedTube(curve: THREE.Curve<THREE.Vector3>, segs: number, radial: number, r0: number, r1: number, wobble = 0): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = (r0 + (r1 - r0) * t) * (1 + Math.sin(t * 23) * wobble);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      n.set(c * N.x + s * B.x, c * N.y + s * B.y, c * N.z + s * B.z);
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Stretch a plane along a→b and turn it toward the camera about that axis (light streaks, speed lines) */
export function axisBillboard(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, cam: THREE.Vector3, width: number): void {
  const axis = b.clone().sub(a);
  const len = axis.length();
  if (len < 1e-5) {
    m.scale.setScalar(1e-4);
    return;
  }
  axis.divideScalar(len);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const toCam = cam.clone().sub(mid);
  const side = new THREE.Vector3().crossVectors(axis, toCam);
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0).cross(axis);
  side.normalize();
  const normal = new THREE.Vector3().crossVectors(side, axis).normalize();
  m.position.copy(mid);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, axis, normal));
  m.scale.set(width, len, 1);
}

/** Additive-blended glowing material (ultimate cinematics' custom effects use it too) */
export function additive(color: THREE.ColorRepresentation, map?: THREE.Texture, intensity = 2): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    ...(map ? { map } : {}),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

const sweepMat = (color: THREE.ColorRepresentation) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2.2) }, uProg: { value: 0 }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uProg; uniform float uFade; varying vec2 vUv;
      void main(){
        float a = vUv.x;
        float head = uProg;
        float tail = uProg - 0.55;
        float m = smoothstep(tail, head, a) * step(a, head);
        float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float core = smoothstep(0.0, 0.6, edge);
        vec3 c = mix(uColor, vec3(3.0), pow(m, 6.0) * core);
        gl_FragColor = vec4(c, m * core * uFade);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

export class Vfx {
  group = new THREE.Group();
  particles = new Particles();
  /** Smoke: normal blending, which can draw smoke darker than the background */
  dust = new Particles(1600, THREE.NormalBlending);
  private effects: Effect[] = [];
  /** Current camera position (for camera-facing effects), updated by the scene every frame */
  camPos = new THREE.Vector3(0, 5, 12);

  constructor() {
    this.group.add(this.dust.points, this.particles.points);
  }

  setScale(viewportHeight: number, fov: number): void {
    this.particles.setScale(viewportHeight, fov);
    this.dust.setScale(viewportHeight, fov);
  }

  update(fxDt: number): void {
    this.particles.update(fxDt);
    this.dust.update(fxDt);
    const list = this.effects;
    this.effects = [];
    const keep: Effect[] = [];
    for (const e of list) {
      e.t += fxDt;
      const k = Math.min(1, e.t / e.dur);
      if (!e.killed) e.tick(k, fxDt);
      if (k >= 1 || e.killed) {
        this.group.remove(e.obj);
        this.free(e);
        e.done?.();
      } else keep.push(e);
    }
    // Effects added inside tick are queued behind
    this.effects = keep.concat(this.effects);
  }

  private free(e: Effect): void {
    if (e.dispose) e.dispose();
    else disposeFx(e.obj);
  }

  clear(): void {
    const list = this.effects;
    this.effects = [];
    for (const e of list) {
      this.group.remove(e.obj);
      this.free(e);
      e.done?.();
    }
  }

  private add(obj: THREE.Object3D, dur: number, tick: Effect['tick'], dispose?: () => void): Promise<void> {
    this.group.add(obj);
    return new Promise((resolve) => this.effects.push({ t: 0, dur, obj, tick, done: resolve, dispose }));
  }

  /** Custom effect: calls tick(k, dt) every frame for dur seconds, then removes and disposes itself when finished */
  spawn(obj: THREE.Object3D, dur: number, tick: (k: number, dt: number) => void, dispose?: () => void): Promise<void> {
    return this.add(obj, Math.max(1e-3, dur), tick, dispose);
  }

  /** Persistent effect: lasts until kill(); tick(dt, t) */
  layer(obj: THREE.Object3D, tick: (dt: number, t: number) => void, dispose?: () => void): FxLayer {
    const e: Effect = { t: 0, dur: Infinity, obj, tick: () => {}, dispose };
    e.tick = (_k, dt) => tick(dt, e.t);
    this.group.add(obj);
    this.effects.push(e);
    return {
      kill: () => {
        e.killed = true;
      },
      get alive() {
        return !e.killed;
      },
    };
  }

  emit(o: EmitOptions): void {
    this.particles.emit(o);
  }

  /** Smoke (normal blending): the color can be darker than the background */
  smoke(o: EmitOptions): void {
    this.dust.emit({ intensity: 1, atlas: 0, ...o });
  }

  /** Camera flash: four-point star + horizontal light streak */
  glint(pos: THREE.Vector3, color: THREE.ColorRepresentation, size = 1.5, dur = 0.5, streak = 3): Promise<void> {
    const g = new THREE.Group();
    const mk = (map: THREE.Texture, c: THREE.ColorRepresentation, inten: number) =>
      new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color(c).multiplyScalar(inten), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const star = mk(starTex(), color, 2.6);
    const core = mk(glowTex(), 0xffffff, 2.2);
    const bar = mk(streakTex(), color, 2);
    g.add(bar, star, core);
    g.position.copy(pos);
    g.renderOrder = 12;
    const rot = Math.random() * 0.4 - 0.2;
    return this.add(g, dur, (k) => {
      const a = k < 0.18 ? ease3(k / 0.18) : 1 - (k - 0.18) / 0.82;
      star.scale.setScalar(size * (0.3 + a * 0.9));
      star.material.rotation = rot + k * 0.6;
      core.scale.setScalar(size * 0.45 * a);
      bar.scale.set(size * streak * (0.4 + a * 0.8), size * 0.16 * a, 1);
      star.material.opacity = a;
      core.material.opacity = a;
      bar.material.opacity = a * 0.9;
    });
  }

  /** Spherical shockwave (Fresnel rim glow) */
  dome(pos: THREE.Vector3, color: THREE.ColorRepresentation, r0 = 0.3, r1 = 5, dur = 0.5): Promise<void> {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2.2) }, uA: { value: 1 } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vN = mat3(modelMatrix)*normal; vV = cameraPosition-wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV;
        void main(){ vec3 n = normalize(vN + vec3(1e-6)); vec3 v = normalize(vV + vec3(1e-6)); float f = clamp(1.0 - abs(dot(n, v)), 0.0, 1.0); gl_FragColor = vec4(uColor, (pow(f, 2.2) * 0.95 + 0.05) * uA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
    m.position.copy(pos);
    return this.add(m, dur, (k) => {
      m.scale.setScalar(r0 + (r1 - r0) * (1 - Math.pow(1 - k, 3)));
      mat.uniforms.uA.value = (1 - k) * (1 - k);
    });
  }

  /** Ground decal (additive): fades in, holds, fades out; aspect is the aspect ratio (for elongated textures, e.g. streakTex set to 4 up and down), and rot decides the direction of the long edge */
  decal(pos: THREE.Vector3, map: THREE.Texture, color: THREE.ColorRepresentation, size = 3, dur = 1.5, rot = Math.random() * 6.28, intensity = 2, aspect = 1): Promise<void> {
    const mat = additive(color, map, intensity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * aspect), mat);
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.copy(pos);
    m.position.y = Math.max(pos.y, 0.04);
    return this.add(m, dur, (k) => {
      mat.opacity = k < 0.08 ? k / 0.08 : Math.pow(1 - (k - 0.08) / 0.92, 1.4);
    });
  }

  /** Flying rock chunks (simple gravity and ground bounce) */
  debris(pos: THREE.Vector3, color: THREE.ColorRepresentation, count = 10, speed = 8, dur = 1.6, size = 0.3, spread = 1): Promise<void> {
    const g = new THREE.Group();
    // Solid rocks share the scene's materials and outline (scene line width, fading with distance)
    const mat = sceneMaterial(color, { rim: 0.3 });
    const bits: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
    for (let i = 0; i < count; i++) {
      const geo = new THREE.DodecahedronGeometry(size * (0.5 + Math.random() * 0.8), 0);
      const m = new THREE.Mesh(geo, mat);
      m.layers.enable(INK_LAYER);
      m.userData.inkScene = true;
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.3, (Math.random() - 0.5) * spread));
      const a = Math.random() * Math.PI * 2;
      const up = 0.55 + Math.random() * 0.45;
      const sp = speed * (0.5 + Math.random() * 0.6);
      bits.push({ m, v: new THREE.Vector3(Math.cos(a) * (1 - up) * 1.6, up, Math.sin(a) * (1 - up) * 1.6).normalize().multiplyScalar(sp), w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14) });
      g.add(m);
    }
    return this.add(g, dur, (k, dt) => {
      for (const b of bits) {
        b.v.y -= 20 * dt;
        b.m.position.addScaledVector(b.v, dt);
        if (b.m.position.y < 0.1) {
          b.m.position.y = 0.1;
          b.v.y = Math.abs(b.v.y) * 0.3;
          b.v.x *= 0.6;
          b.v.z *= 0.6;
          b.w.multiplyScalar(0.6);
        }
        b.m.rotation.x += b.w.x * dt;
        b.m.rotation.y += b.w.y * dt;
        b.m.rotation.z += b.w.z * dt;
        if (k > 0.8) b.m.scale.setScalar(Math.max(0.01, 1 - (k - 0.8) / 0.2));
      }
    });
  }

  /** Afterimage: copies the spirit's model (sharing geometry), swaps in a glowing translucent material and fades it out */
  ghost(src: THREE.Object3D, color: THREE.ColorRepresentation, dur = 0.35, opacity = 0.8): Promise<void> {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.8) }, uA: { value: opacity } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vN = mat3(modelMatrix)*normal; vV = cameraPosition-wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV;
        void main(){ vec3 n = normalize(vN + vec3(1e-6)); vec3 v = normalize(vV + vec3(1e-6)); float f = clamp(1.0 - abs(dot(n, v)), 0.0, 1.0); gl_FragColor = vec4(uColor * (0.35 + pow(f, 2.0) * 1.6), uA * (0.25 + pow(f, 1.5) * 0.75)); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    // Write depth only first, then layer the color: only the frontmost surface stays, so where parts overlap there are no interior seams brightened by stacking
    const depth = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
    const g = src.clone(true);
    src.getWorldPosition(g.position);
    src.getWorldQuaternion(g.quaternion);
    src.getWorldScale(g.scale);
    const meshes: THREE.Mesh[] = [];
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) meshes.push(m);
    });
    for (const m of meshes) {
      const orig = m.material as THREE.Material;
      // No outline on afterimages: the copied meshes still have the outline layer on, so turn it off, otherwise the translucent afterimage gets a black line drawn around it
      m.layers.disable(INK_LAYER);
      if (orig.side === THREE.BackSide || !m.visible) {
        m.visible = false;
        continue;
      }
      m.material = mat;
      m.renderOrder = 50.5;
      const d = new THREE.Mesh(m.geometry, depth);
      d.renderOrder = 50;
      d.layers.mask = m.layers.mask;
      m.add(d);
    }
    const root = new THREE.Group();
    root.add(g);
    return this.add(
      root,
      dur,
      (k) => {
        mat.uniforms.uA.value = opacity * (1 - k) * (1 - k);
      },
      () => {
        mat.dispose();
        depth.dispose();
      },
    );
  }

  /** Flying crescent slash (wind blade, sword energy): from → to, rotating as it flies */
  crescent(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, radius = 1, dur = 0.3, roll = 0, width = 0.28): Promise<void> {
    const geo = new THREE.RingGeometry(radius - width, radius, 32, 1, -Math.PI * 0.45, Math.PI * 0.9);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getY(i), p.getX(i));
      uv.setXY(i, (a + Math.PI * 0.45) / (Math.PI * 0.9), (Math.hypot(p.getX(i), p.getY(i)) - (radius - width)) / width);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2.2) }, uA: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; varying vec2 vUv;
        void main(){ float along = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159); float edge = smoothstep(0.0, 0.7, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          float a = pow(along, 1.5) * edge * uA; vec3 c = mix(uColor, vec3(3.0), smoothstep(0.6, 1.0, vUv.y) * along); gl_FragColor = vec4(c, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    const holder = new THREE.Group();
    holder.add(m);
    // The arc bulges toward the flight direction: local +X = flight direction, local Z = the normal of the arc's plane (up by default, then rotated about the flight direction by roll)
    const x = to.clone().sub(from);
    if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
    x.normalize();
    const up = Math.abs(x.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const z = up.clone().addScaledVector(x, -up.dot(x)).normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    holder.rotateX(roll);
    return this.add(holder, dur, (k) => {
      holder.position.lerpVectors(from, to, k);
      m.scale.setScalar(0.7 + k * 0.5);
      mat.uniforms.uA.value = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    });
  }

  /** Light trail: a thin elongated light streak flying along from → to (energy gathering, speed lines) */
  streak(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, width = 0.06, len = 1.2, dur = 0.4): Promise<void> {
    const mat = additive(color, streakTexV(), 2.4);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const dir = to.clone().sub(from);
    const total = dir.length();
    const u = total > 1e-5 ? dir.clone().divideScalar(total) : new THREE.Vector3(0, 1, 0);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    return this.add(m, dur, (k) => {
      const e = k * k;
      const head = e * (total + len);
      a.copy(from).addScaledVector(u, Math.max(0, Math.min(total, head - len)));
      b.copy(from).addScaledVector(u, Math.max(0, Math.min(total, head)));
      axisBillboard(m, a, b, this.camPos, width);
      mat.opacity = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    });
  }

  /** Expanding ground shockwave; bright is the additive brightness (lower it for night scenes and when close to the camera, to avoid washing out) */
  ring(pos: THREE.Vector3, color: THREE.ColorRepresentation, r0 = 0.3, r1 = 3, dur = 0.5, vertical?: THREE.Vector3, bright = 2.2): Promise<void> {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(color, ringTex(), bright));
    m.position.copy(pos);
    if (vertical) m.lookAt(pos.clone().add(vertical));
    else m.rotation.x = -Math.PI / 2;
    return this.add(m, dur, (k) => {
      const r = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 3));
      m.scale.setScalar(r);
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    });
  }

  /** Halo flash */
  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, size = 2, dur = 0.25): Promise<void> {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.position.copy(pos);
    return this.add(s, dur, (k) => {
      s.scale.setScalar(size * (0.6 + k * 0.8));
      s.material.opacity = 1 - k * k;
    });
  }

  /** Slash arc: center is the center, normal is the normal of the arc's plane */
  slash(center: THREE.Vector3, color: THREE.ColorRepresentation, radius = 1.2, rotZ = 0, facing?: THREE.Vector3, dur = 0.28, width = 0.35): Promise<void> {
    const geo = new THREE.RingGeometry(radius - width, radius, 40, 1, -Math.PI * 0.35, Math.PI * 1.25);
    // Reset the UVs by angle: u along the arc, v along the radius
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const a = Math.atan2(y, x);
      const u = (a + Math.PI * 0.35) / (Math.PI * 1.25);
      const rr = Math.hypot(x, y);
      uv.setXY(i, ((u % 1) + 1) % 1, (rr - (radius - width)) / width);
    }
    const mat = sweepMat(color);
    const m = new THREE.Mesh(geo, mat);
    const holder = new THREE.Group();
    holder.position.copy(center);
    if (facing) holder.lookAt(center.clone().add(facing));
    m.rotation.z = rotZ;
    holder.add(m);
    return this.add(holder, dur, (k) => {
      mat.uniforms.uProg.value = k * 1.5;
      mat.uniforms.uFade.value = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      m.scale.setScalar(1 + k * 0.15);
    });
  }

  /** Light pillar */
  pillar(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius = 0.8, height = 12, dur = 0.8): Promise<void> {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 24, 1, true);
    geo.translate(0, height / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2.5) }, uA: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0); float a = pow(f, 1.5) * (1.0 - vUv.y) * uA; gl_FragColor = vec4(uColor + vec3(1.5) * pow(f, 6.0), a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    return this.add(m, dur, (k) => {
      const w = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      m.scale.set(0.3 + w * 0.9, 1, 0.3 + w * 0.9);
      mat.uniforms.uA.value = w;
    });
  }

  /** Light beam (from → to) */
  beam(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, width = 0.35, dur = 0.5): Promise<void> {
    const len = from.distanceTo(to);
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 16, 1, true), additive(color, undefined, 1.6));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.4, width * 0.4, len, 12, 1, true), additive(0xffffff, undefined, 2.5));
    outer.rotation.x = inner.rotation.x = Math.PI / 2;
    outer.position.z = inner.position.z = len / 2;
    g.add(outer, inner);
    g.position.copy(from);
    g.lookAt(to);
    return this.add(g, dur, (k) => {
      const w = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
      g.scale.set(w + 0.05, w + 0.05, 1);
      (outer.material as THREE.MeshBasicMaterial).opacity = w;
      (inner.material as THREE.MeshBasicMaterial).opacity = w;
    });
  }

  /** Lightning */
  bolt(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, dur = 0.35, thickness = 0.06): Promise<void> {
    const g = new THREE.Group();
    const make = (w: number, c: THREE.ColorRepresentation, inten: number) => {
      const pts: THREE.Vector3[] = [];
      const n = 12;
      const dir = to.clone().sub(from);
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      for (let i = 0; i <= n; i++) {
        const p = from.clone().lerp(to, i / n);
        if (i > 0 && i < n) {
          const j = (Math.random() - 0.5) * dir.length() * 0.12;
          p.addScaledVector(side, j);
          p.x += (Math.random() - 0.5) * 0.3;
          p.z += (Math.random() - 0.5) * 0.3;
        }
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, w, 5, false), additive(c, undefined, inten));
      g.add(m);
    };
    make(thickness * 3, color, 1.2);
    make(thickness, 0xffffff, 3);
    return this.add(g, dur, (k) => {
      const flick = Math.random() > 0.25 ? 1 : 0.2;
      g.children.forEach((c) => (((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * flick));
    });
  }

  /** Magic circle */
  circle(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius = 1.4, dur = 0.8, normal?: THREE.Vector3, seed = 0): Promise<void> {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(color, runeCircleTex(seed), 2));
    const holder = new THREE.Group();
    holder.position.copy(pos);
    if (normal) holder.lookAt(pos.clone().add(normal));
    else holder.rotation.x = -Math.PI / 2;
    holder.add(m);
    return this.add(holder, dur, (k) => {
      const inK = Math.min(1, k / 0.25);
      m.scale.setScalar(radius * (0.4 + 0.6 * (1 - Math.pow(1 - inK, 3))));
      m.rotation.z = k * 2.5;
      (m.material as THREE.MeshBasicMaterial).opacity = k < 0.75 ? inK : 1 - (k - 0.75) / 0.25;
    });
  }

  /** Projectile: flies along a parabola to the target and resolves on arrival */
  projectile(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, size = 0.5, dur = 0.4, arc = 0.6, trail = true): Promise<void> {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.scale.setScalar(size * 2);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xffffff).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    core.scale.setScalar(size * 0.9);
    const g = new THREE.Group();
    g.add(s, core);
    const p = new THREE.Vector3();
    return this.add(g, dur, (k) => {
      p.lerpVectors(from, to, k);
      p.y += Math.sin(k * Math.PI) * arc;
      g.position.copy(p);
      if (trail) this.particles.emit({ pos: p.clone(), count: 3, color, speed: [0.1, 0.6], life: [0.2, 0.45], size: [size * 0.5, size * 0.9], sizeEnd: 0.1, drag: 3 });
    });
  }

  /** Spikes bursting from the ground (earth element) */
  spikes(pos: THREE.Vector3, color: THREE.ColorRepresentation, count = 7, radius = 1.2, height = 1.6, dur = 0.7): Promise<void> {
    const g = new THREE.Group();
    g.position.copy(pos);
    // Solid rock spikes share the scene's materials and outline
    const mat = sceneMaterial(color, { rim: 0.35 });
    const spikes: THREE.Mesh[] = [];
    for (let i = 0; i < count; i++) {
      const h = height * (0.6 + Math.random() * 0.6);
      const geo = new THREE.ConeGeometry(0.22 + Math.random() * 0.15, h, 5);
      geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, mat);
      m.layers.enable(INK_LAYER);
      m.userData.inkScene = true;
      const a = (i / count) * Math.PI * 2 + Math.random();
      const r = i === 0 ? 0 : radius * (0.35 + Math.random() * 0.65);
      m.position.set(Math.cos(a) * r, -h, Math.sin(a) * r);
      m.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
      m.userData.h = h;
      g.add(m);
      spikes.push(m);
    }
    return this.add(g, dur, (k) => {
      const up = k < 0.2 ? 1 - Math.pow(1 - k / 0.2, 3) : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      for (const m of spikes) m.position.y = -m.userData.h * (1 - up);
    });
  }

  /** Shield bubble attached to a spirit */
  bubble(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius = 1.3, dur = 0.8): Promise<void> {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2) }, uA: { value: 1 } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0); gl_FragColor = vec4(uColor, (pow(f, 2.5) * 0.9 + 0.08) * uA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), mat);
    m.position.copy(pos);
    return this.add(m, dur, (k) => {
      m.scale.setScalar(k < 0.2 ? 0.6 + (k / 0.2) * 0.4 : 1);
      mat.uniforms.uA.value = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    });
  }
}

function ease3(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/** Soft-edged light streak along its length (for the light trail) */
let streakV: THREE.Texture | null = null;
function streakTexV(): THREE.Texture {
  if (streakV) return streakV;
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < 128; y++) {
    // The top of the canvas (uv.y = 1 after flipping, the head of the streak) is brightest
    const along = Math.pow(1 - y / 127, 1.6);
    const lg = g.createLinearGradient(0, 0, 32, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, `rgba(255,255,255,${along})`);
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(0, y, 32, 1);
  }
  streakV = new THREE.CanvasTexture(cv);
  streakV.colorSpace = THREE.SRGBColorSpace;
  return streakV;
}
