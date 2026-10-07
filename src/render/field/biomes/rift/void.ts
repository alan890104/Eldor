// The void: the nebula sky shell enclosing the whole world, the "abyss plane" covering the underside of the land (using the
// same function as the sky shell, so the horizons meet), the void mist slowly rotating above the abyss,
// the curtains of light seeping up from the Wound and the cracks, the distant tears in space, the upside-down phantom royal
// city, and the slowly tumbling shards in the void and the floating isles carrying ruins.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, PropBatch, rng } from '../../../arenaKit.ts';
import { LIGHT } from '../../../toon.ts';
import type { FieldCtx } from '../../kit.ts';
import { ADD_FOG_FRAG, ADD_FOG_PARS, ADD_FOG_VERT, ADD_FOG_VERT_PARS, additive, NOISE, noiseTexture, SKY, SKY_BAKE, type RiftClock } from './glsl.ts';
import { COL } from './props.ts';
import { SoloBatch } from './inst.ts';
import { CRACKS, crackW, land, ROUT, RIN, T, VOID_Y } from './shape.ts';

type Anim = [number, number, number, number];

// ───────────────────────── Sky shell and abyss plane ─────────────────────────

/** Bake the static part of the nebula sky into a cube map (done once when the sky is first drawn; afterward each pixel only samples the map) */
function bakeSky(renderer: THREE.WebGLRenderer, size: number): THREE.WebGLCubeRenderTarget {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${NOISE}
      ${SKY_BAKE}
      void main(){ gl_FragColor = riftSkyBake(normalize(vDir)); }`,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), mat);
  scene.add(box);
  const cam = new THREE.CubeCamera(0.1, 100, rt);
  const auto = renderer.autoClear;
  renderer.autoClear = true;
  cam.update(renderer, scene);
  renderer.autoClear = auto;
  mat.dispose();
  box.geometry.dispose();
  return rt;
}

function skyShell(ctx: FieldCtx, clock: RiftClock): void {
  const uSkyCube: { value: THREE.Texture | null } = { value: null };
  const frag = /* glsl */ `
      uniform float uTime; uniform float uBeat; varying vec3 vDir;
      ${NOISE}
      ${SKY}
      void main(){ gl_FragColor = vec4(riftSky(normalize(vDir), uTime, uBeat), 1.0); }`;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: clock.uTime, uBeat: clock.uBeat, uSkyCube },
    // Directions always use "camera -> this point", so even if the sky shell's center differs a little from the camera,
    // the seam with the abyss plane still lines up
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
  });
  // Drawn after all opaque objects (pixels blocked by terrain need not be computed) but before transparent objects
  const shell = new THREE.Mesh(new THREE.SphereGeometry(700, 48, 24), mat);
  shell.renderOrder = 100;
  shell.frustumCulled = false;
  ctx.group.add(shell);

  // Abyss plane: one big horizontal plane whose color is directly "the sky in this direction", so it looks like a void falling away without end;
  // it writes depth, covering the terrain that falls into the void (the bottom of the cliffs) entirely
  const vmat = new THREE.ShaderMaterial({
    uniforms: { uTime: clock.uTime, uBeat: clock.uBeat, uSkyCube },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: frag,
  });
  const pg = new THREE.PlaneGeometry(3000, 3000, 1, 1);
  pg.rotateX(-Math.PI / 2);
  const plane = new THREE.Mesh(pg, vmat);
  plane.position.y = VOID_Y;
  plane.renderOrder = 99;
  plane.frustumCulled = false;
  ctx.group.add(plane);

  let rt: THREE.WebGLCubeRenderTarget | null = null;
  const bake = (renderer: THREE.WebGLRenderer) => {
    if (rt) return;
    rt = bakeSky(renderer, ctx.low ? 256 : 512);
    uSkyCube.value = rt.texture;
  };
  plane.onBeforeRender = bake;
  shell.onBeforeRender = bake;

  ctx.extras.push((_dt, _t, vfx) => {
    shell.position.copy(vfx.camPos);
    plane.position.x = vfx.camPos.x;
    plane.position.z = vfx.camPos.z;
  });
  ctx.disposers.push(() => {
    mat.dispose();
    vmat.dispose();
    shell.geometry.dispose();
    pg.dispose();
    rt?.dispose();
  });
}

// ───────────────────────── Void mist ─────────────────────────

/** A few layers of mist above the abyss rotating around the Wound (additive blending), softening the line where the cliffs sink into the void */
function voidMist(ctx: FieldCtx, clock: RiftClock, noise: THREE.Texture): void {
  const layers: [number, number, number, number][] = [
    // Height, brightness, scale, seed
    [VOID_Y + 4, 0.55, 0.016, 1.3],
    [VOID_Y + 15, 0.3, 0.026, 7.7],
  ];
  const geo = new THREE.PlaneGeometry(1600, 1600, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const meshes: THREE.Mesh[] = [];
  const mats: THREE.ShaderMaterial[] = [];
  for (const [y, amt, scale, seed] of layers) {
    const mat = additive({
      uniforms: { uTime: clock.uTime, uBeat: clock.uBeat, uNoise: { value: noise }, uAmt: { value: amt }, uScale: { value: scale }, uSeed: { value: seed }, uC: { value: new THREE.Vector2(T[0], T[1]) } },
      vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uBeat; uniform sampler2D uNoise; uniform float uAmt; uniform float uScale; uniform float uSeed; uniform vec2 uC; varying vec3 vW;
        vec2 rot(vec2 p, float a){ float c = cos(a); float s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
        void main(){
          vec2 p = vW.xz - uC;
          float r = length(p);
          // Two layers rotate around the wound at different speeds, looking like a vortex
          vec2 q1 = rot(p, uTime * 0.011 + uSeed);
          vec2 q2 = rot(p, uTime * 0.004 - uSeed);
          float n = texture2D(uNoise, (q1 * uScale + uSeed) / 8.0).r * 0.6 + texture2D(uNoise, (q2 * uScale * 2.3 - uSeed) / 8.0).g * 0.4;
          float m = smoothstep(0.4, 0.78, n);
          vec3 V = vW - cameraPosition;
          float dist = length(V);
          float graze = smoothstep(0.02, 0.16, abs(V.y) / dist);
          float far = 1.0 - smoothstep(380.0, 780.0, dist);
          // Fog near the wound leans red, farther out blue-purple
          vec3 col = mix(vec3(0.95, 0.25, 0.62), vec3(0.42, 0.16, 0.85), smoothstep(40.0, 220.0, r));
          gl_FragColor = vec4(col * m * uAmt * graze * far * (0.85 + 0.25 * uBeat), 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    ctx.group.add(mesh);
    meshes.push(mesh);
    mats.push(mat);
  }
  ctx.extras.push((_dt, _t, vfx) => {
    for (const m of meshes) {
      m.position.x = vfx.camPos.x;
      m.position.z = vfx.camPos.z;
    }
  });
  ctx.disposers.push(() => {
    geo.dispose();
    for (const m of mats) m.dispose();
  });
}

// ───────────────────────── Curtains of light seeping up from the abyss ─────────────────────────

const CURTAIN_FRAG = /* glsl */ `
  uniform float uTime; uniform float uBeat; uniform float uAmt; uniform float uLen; uniform float uCalm; uniform sampler2D uNoise;
  varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vGap;
  ${ADD_FOG_PARS}
  void main(){
    float h = vUv.y;
    float u = vUv.x * uLen;
    float streak = texture2D(uNoise, vec2(u * 0.9, h * 2.5 - uTime * 0.32) / 64.0).g;
    float rise = texture2D(uNoise, vec2(u * 0.25, h * 1.6 - uTime * 0.18) / 8.0).r;
    float a = pow(clamp(1.0 - h, 0.0, 1.0), 1.8) * smoothstep(0.0, 0.08, h) * (0.25 + 0.75 * streak * rise * 1.6);
    vec3 V = normalize(cameraPosition - vW);
    float f = 1.0 - abs(dot(normalize(vN), V));
    a *= (0.35 + 0.65 * f) * vGap;
    vec3 col = mix(vec3(1.0, 0.28, 0.66), vec3(0.52, 0.2, 1.0), smoothstep(0.1, 0.8, h));
    // After purification: what shines up from the abyss is soft golden-white morning light
    col = mix(col, mix(vec3(1.0, 0.78, 0.45), vec3(0.75, 0.8, 1.0), smoothstep(0.1, 0.8, h)), uCalm);
    gl_FragColor = vec4(col * a * uAmt * (0.75 + 0.5 * uBeat) * (1.0 - 0.45 * uCalm), 1.0);
    ${ADD_FOG_FRAG}
  }`;

function curtainMat(clock: RiftClock, noise: THREE.Texture, amt: number, len: number, gapGLSL: string): THREE.ShaderMaterial {
  return additive({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: clock.uTime, uBeat: clock.uBeat, uCalm: clock.uCalm, uNoise: { value: noise }, uAmt: { value: amt }, uLen: { value: len } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vGap;
      ${ADD_FOG_VERT_PARS}
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        ${gapGLSL}
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        ${ADD_FOG_VERT}
      }`,
    fragmentShader: CURTAIN_FRAG,
  });
}

function lightCurtains(ctx: FieldCtx, clock: RiftClock, noise: THREE.Texture): void {
  const top = 7;
  const H = top - VOID_Y;
  // The Wound: three concentric curtains of light, with gaps where the southern road and the northern broken bridge are
  const gap = `
    vec2 rel = wp.xz - vec2(${T[0].toFixed(1)}, ${T[1].toFixed(1)});
    vGap = rel.y > 0.0 ? smoothstep(8.5, 13.0, abs(rel.x)) : smoothstep(6.0, 10.0, abs(rel.x));`;
  for (const [rad, amt] of [
    [RIN + 3.5, 0.5],
    [(RIN + ROUT) / 2, 0.75],
    [ROUT - 4, 0.45],
  ] as const) {
    const mat = curtainMat(clock, noise, amt, Math.PI * 2 * rad, gap);
    const g = new THREE.CylinderGeometry(rad, rad, H, 96, 1, true);
    const m = new THREE.Mesh(g, mat);
    m.position.set(T[0], VOID_Y + H / 2, T[1]);
    m.renderOrder = 4;
    ctx.group.add(m);
    ctx.disposers.push(() => {
      mat.dispose();
      g.dispose();
    });
  }
  // Radial cracks: upright curtains of light along the crack centerlines, with gaps at the stone bridges
  for (const c of CRACKS) {
    let a0 = ROUT - 2;
    let a1 = a0;
    // Only along the crack itself: stop once both sides are already void (past the coast)
    for (let s = a0; s < 150; s += 1) {
      const x = T[0] + c.dx * s;
      const z = T[1] + c.dz * s;
      if (Math.max(Math.abs(x), Math.abs(z)) > 118) break;
      const off = crackW(c, s) + 3;
      if (s > ROUT + 6 && land(x - c.dz * off, z + c.dx * off) < 0 && land(x + c.dz * off, z - c.dx * off) < 0) break;
      a1 = s;
    }
    const len = a1 - a0;
    const g = new THREE.PlaneGeometry(len, H, 48, 1);
    const cgap = `
      float along = ${a0.toFixed(1)} + uv.x * ${len.toFixed(1)};
      vGap = smoothstep(${(c.bw - 1).toFixed(1)}, ${(c.bw + 3).toFixed(1)}, abs(along - ${c.rb.toFixed(1)})) * smoothstep(${a1.toFixed(1)}, ${(a1 - 8).toFixed(1)}, along);`;
    const mat = curtainMat(clock, noise, 0.6, len, cgap);
    const m = new THREE.Mesh(g, mat);
    const mid = (a0 + a1) / 2;
    m.position.set(T[0] + c.dx * mid, VOID_Y + H / 2, T[1] + c.dz * mid);
    // The plane's +x is aligned to the crack direction
    m.rotation.y = Math.atan2(c.dx, c.dz) - Math.PI / 2;
    m.renderOrder = 4;
    ctx.group.add(m);
    ctx.disposers.push(() => {
      mat.dispose();
      g.dispose();
    });
  }
}

// ───────────────────────── Tears in space ─────────────────────────

function tearMaterial(clock: RiftClock, noise: THREE.Texture, aspect: number, seed: number): THREE.ShaderMaterial {
  return additive({
    side: THREE.DoubleSide,
    uniforms: { uTime: clock.uTime, uBeat: clock.uBeat, uCalm: clock.uCalm, uNoise: { value: noise }, uAspect: { value: aspect }, uSeed: { value: seed } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBeat; uniform float uCalm; uniform float uAspect; uniform float uSeed; uniform sampler2D uNoise; varying vec2 vUv;
      void main(){
        float v = vUv.y;
        float px = (vUv.x - 0.5) * uAspect;
        // Center line of the main crack: several frequencies layered into a jagged line
        float cx = 0.05 * sin(v * 5.0 + uSeed) + 0.025 * sin(v * 13.0 + uTime * 0.4 + uSeed) + 0.012 * sin(v * 37.0 + uSeed * 2.0);
        float env = pow(max(sin(3.14159 * v), 0.0), 0.6);
        float w = 0.045 * env * (0.6 + 0.8 * texture2D(uNoise, vec2(v * 11.0 + uSeed, uTime * 0.5) / 64.0).g);
        float dx = abs(px - cx);
        float core = smoothstep(w, w * 0.15, dx);
        // Branches: thin cracks forking to both sides along the main crack
        float br = 0.0;
        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float by = 0.2 + fi * 0.18 + 0.05 * sin(uSeed + fi);
          float side = mod(fi, 2.0) * 2.0 - 1.0;
          float t = (px - cx) * side;
          float len = 0.14 + 0.06 * sin(uSeed * 3.0 + fi);
          float yy = by + t * (0.6 + 0.3 * sin(fi + uSeed)) + 0.01 * sin(t * 60.0);
          float bw = 0.006 * (1.0 - smoothstep(0.0, len, t)) * step(0.0, t);
          br += smoothstep(bw, 0.0, abs(v - yy)) * step(0.0, t) * (1.0 - smoothstep(len * 0.6, len, t));
        }
        float fil = texture2D(uNoise, (vec2(vUv.x * 9.0, v * 7.0 - uTime * 0.35) + uSeed) / 8.0).r;
        float glow = exp(-dx * dx / (w * w * 20.0 + 0.0006)) * (0.45 + 0.8 * fil) * env;
        float halo = exp(-(dx * dx * 10.0 + (v - 0.5) * (v - 0.5) * 4.0)) * 0.4 * (0.6 + 0.6 * fil);
        float pulse = 0.7 + 0.55 * uBeat;
        // The four edges of the plane must fade completely to dark or the rectangle shows; the glow stays only inside the inscribed ellipse (so the four corners are not visible even at a slant)
        float el = length(vec2((vUv.x - 0.5) * 2.0, (v - 0.5) * 2.0));
        float edge = smoothstep(0.5, 0.28, abs(vUv.x - 0.5)) * smoothstep(0.0, 0.1, v) * smoothstep(1.0, 0.9, v);
        halo *= smoothstep(1.0, 0.55, el);
        glow *= smoothstep(1.05, 0.8, el);
        vec3 col = vec3(1.0, 0.9, 0.97) * (core * 1.5 + br * 0.9) + vec3(1.0, 0.3, 0.62) * glow * 0.75 + vec3(0.62, 0.16, 0.7) * halo * 0.7;
        gl_FragColor = vec4(col * pulse * edge * (1.0 - 0.45 * uCalm), 1.0);
      }`,
  });
}

function tears(ctx: FieldCtx, clock: RiftClock, noise: THREE.Texture): void {
  // After purification, the tears in space have all closed
  if (clock.uCalm.value > 0) return;
  const [sx, sz] = [ctx.layout.spawn[0], ctx.layout.spawn[1]];
  const dx = T[0] - sx;
  const dz = T[1] - sz;
  const l = Math.hypot(dx, dz);
  // The main tear: seen from the spawn point it is exactly directly behind the tower
  const specs: [number, number, number, number, number, number][] = [
    [T[0] + (dx / l) * 560, 110, T[1] + (dz / l) * 560, 120, 380, 0.05],
    [590, 60, -60, 60, 240, -0.18],
    [-560, 40, 230, 70, 230, 0.22],
    [180, 150, 560, 40, 170, 0.5],
    [-420, 190, -380, 36, 150, -0.6],
  ];
  specs.forEach(([x, y, z, w, h, roll], i) => {
    // The plane is twice as wide as the tear itself, so the glow has room to fade to zero
    const mat = tearMaterial(clock, noise, (w * 2.2) / h, 1.7 + i * 2.3);
    const g = new THREE.PlaneGeometry(w * 2.2, h);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.lookAt(0, y, 0);
    m.rotateZ(roll);
    m.frustumCulled = false;
    m.renderOrder = -7;
    ctx.group.add(m);
    ctx.disposers.push(() => {
      mat.dispose();
      g.dispose();
    });
  });
}

// ───────────────────────── Phantom royal city ─────────────────────────

/** The silhouette of an old-kingdom building (origin at the foundation center, growing along +y): main tower, spire, dome, wall, arch bridge */
function kingdomPiece(out: THREE.BufferGeometry[], m: THREE.Matrix4, kind: number, s: number, r: () => number): void {
  const add = (g: THREE.BufferGeometry, lm: THREE.Matrix4) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal') ng.deleteAttribute(k);
    ng.applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, lm));
    out.push(ng);
  };
  if (kind === 0) {
    // Spire
    const h = (16 + r() * 18) * s;
    const w = (2.2 + r() * 1.6) * s;
    add(new THREE.CylinderGeometry(w * 0.85, w, h, 8), M(0, h / 2, 0));
    add(new THREE.CylinderGeometry(w * 1.3, w * 1.3, 0.8 * s, 8), M(0, h, 0));
    add(new THREE.ConeGeometry(w * 1.25, h * 0.45, 8), M(0, h + h * 0.22, 0));
    if (r() < 0.6) add(new THREE.CylinderGeometry(w * 0.5, w * 0.6, h * 0.6, 8), M(w * 1.6, h * 0.3, 0));
  } else if (kind === 1) {
    // Castle keep: a block + four corner turrets + crenellations
    const w = (8 + r() * 6) * s;
    const h = (10 + r() * 8) * s;
    add(new THREE.BoxGeometry(w, h, w), M(0, h / 2, 0));
    for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      add(new THREE.CylinderGeometry(w * 0.16, w * 0.18, h * 1.35, 8), M((cx * w) / 2, (h * 1.35) / 2, (cz * w) / 2));
      add(new THREE.ConeGeometry(w * 0.22, h * 0.4, 8), M((cx * w) / 2, h * 1.35 + h * 0.2, (cz * w) / 2));
    }
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(w * 0.16, 1.2 * s, w * 0.16), M(-w * 0.3 + i * w * 0.2, h + 0.6 * s, w / 2));
  } else if (kind === 2) {
    // Domed hall
    const R = (5 + r() * 4) * s;
    const h = (6 + r() * 5) * s;
    add(new THREE.CylinderGeometry(R, R * 1.05, h, 16), M(0, h / 2, 0));
    add(new THREE.SphereGeometry(R * 0.98, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0, h, 0));
    add(new THREE.ConeGeometry(R * 0.15, R * 0.9, 8), M(0, h + R + R * 0.4, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(new THREE.CylinderGeometry(0.5 * s, 0.5 * s, h, 6), M(Math.cos(a) * R * 1.15, h / 2, Math.sin(a) * R * 1.15));
    }
  } else {
    // Arch bridge / wall section
    const len = (18 + r() * 14) * s;
    const h = (7 + r() * 5) * s;
    add(new THREE.BoxGeometry(len, 1.6 * s, 3 * s), M(0, h, 0));
    const n = 3;
    for (let i = 0; i <= n; i++) add(new THREE.BoxGeometry(1.6 * s, h, 3 * s), M(-len / 2 + (i * len) / n, h / 2, 0));
    for (let i = 0; i < n; i++) add(new THREE.TorusGeometry(len / n / 2 - 0.8 * s, 0.5 * s, 6, 12, Math.PI), M(-len / 2 + ((i + 0.5) * len) / n, h - len / n / 2 + 0.8 * s - 0.8, 0, 0, 1, Math.PI, 0));
  }
}

function phantoms(ctx: FieldCtx, clock: RiftClock, r: () => number): void {
  const parts: THREE.BufferGeometry[] = [];
  const city = (cx: number, cy: number, cz: number, rad: number, n: number, inv: boolean, s: number) => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const y = cy + (r() - 0.5) * 8;
      const kind = Math.floor(r() * 4);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(inv ? Math.PI : 0, r() * 6, (r() - 0.5) * 0.12)), new THREE.Vector3(1, 1, 1));
      kingdomPiece(parts, m, kind, s * (0.7 + r() * 0.6), r);
    }
  };
  // The Uncrowned's royal city hanging upside down directly above the Wound: the tower tip points to it
  const [tx, tz] = T;
  const top = 330;
  {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(tx, top, tz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0.4, 0)), new THREE.Vector3(1, 1, 1));
    kingdomPiece(parts, m, 1, 4.2, r);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.3;
      const d = 34 + r() * 30;
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(tx + Math.cos(a) * d, top + 10 + r() * 16, tz + Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, r() * 6, 0)), new THREE.Vector3(1, 1, 1));
      kingdomPiece(parts, mm, i % 3 === 0 ? 2 : 0, 2.2 + r() * 1.4, r);
    }
  }
  // In the distance: upside-down districts and a ruined city growing out of the abyss
  city(-300, 210, -240, 70, 11, true, 2.2);
  city(320, 190, -180, 60, 9, true, 2.0);
  city(-60, 230, 360, 60, 8, true, 1.8);
  city(340, VOID_Y - 30, 160, 70, 9, false, 2.4);
  city(-340, VOID_Y - 30, 90, 80, 10, false, 2.6);
  city(90, VOID_Y - 30, 400, 60, 8, false, 2.2);
  city(-150, VOID_Y - 40, -420, 70, 9, false, 2.6);
  const geo = mergeGeometries(parts);
  if (!geo) return;
  const mat = additive({
    side: THREE.DoubleSide,
    uniforms: { uTime: clock.uTime, uBeat: clock.uBeat },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - wp.xyz;
        vY = wp.y;
        vD = length(vV);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBeat; varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){
        float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
        float scan = 0.65 + 0.35 * sin(vY * 0.9 - uTime * 1.4);
        float flick = 0.75 + 0.25 * sin(uTime * 5.3 + vY * 0.05) * sin(uTime * 2.1 + vY * 0.013);
        float a = (0.03 + 0.26 * fres) * scan * flick * (0.85 + 0.3 * uBeat);
        // The part close to the abyss surface fades out, as if growing out of fog
        a *= smoothstep(${(VOID_Y - 6).toFixed(1)}, ${(VOID_Y + 30).toFixed(1)}, vY);
        vec3 col = mix(vec3(0.55, 0.36, 1.0), vec3(1.0, 0.45, 0.8), smoothstep(0.3, 0.9, fres));
        gl_FragColor = vec4(col * a * 1.4, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -6;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
}

// ───────────────────────── Slowly tumbling shards ─────────────────────────

const FRAG_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  attribute vec3 color; attribute vec3 aCenter; attribute vec4 aAnim;
  varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vColor; varying float vGlow;
  mat3 rotY(float a){ float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotX(float a){ float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotZ(float a){ float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  void main(){
    float spin = aAnim.y;
    mat3 rot = rotY(uTime * spin) * rotX(sin(uTime * 0.23 + aAnim.x) * 0.35 * abs(spin) * 8.0 + uTime * spin * 0.4) * rotZ(uTime * spin * 0.3);
    vec3 n = rot * normal;
    vec3 p = rot * (position - aCenter) + aCenter;
    p.y += sin(uTime * 0.5 + aAnim.x * 1.7) * aAnim.z;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vNormal = normalize(mat3(modelMatrix) * n);
    vViewDir = normalize(cameraPosition - wp.xyz);
    vColor = color;
    vGlow = aAnim.w;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uLightDir; uniform vec3 uAmbient; uniform vec3 uRimColor; uniform vec3 uShadowTint; uniform float uBeat;
  varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vColor; varying float vGlow;
  void main(){
    vec3 n = normalize(vNormal);
    float ndl = dot(n, normalize(uLightDir));
    float lit = smoothstep(-0.05, 0.05, ndl) * 0.55 + smoothstep(0.55, 0.62, ndl) * 0.2;
    vec3 shade = vColor * mix(uShadowTint * 0.62, vec3(1.0), 0.35);
    vec3 col = mix(shade, vColor, lit / 0.75);
    col *= mix(uAmbient * 1.35, vec3(1.08), 0.55);
    float fres = pow(clamp(1.0 - dot(n, normalize(vViewDir)), 0.0, 1.0), 3.0);
    col += uRimColor * smoothstep(0.35, 0.6, fres) * 0.35;
    // The underside is lit by the light of the abyss
    col += vec3(0.5, 0.12, 0.45) * smoothstep(0.0, -0.8, n.y) * 0.35;
    col = mix(col, vColor * (2.0 + 0.6 * uBeat), vGlow);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

/**
 * A group of shards that tumble and bob up and down: each shard's center and animation parameters are written into vertex
 * attributes, so the whole group is a single mesh.
 * No outlines: the tumbling is computed in the vertex shader, which the outline's normal pass cannot keep up with;
 * these are distant shards in the void and small stones above the ground.
 */
class FragmentSet {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: number, center: THREE.Vector3, anim: Anim): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.applyMatrix4(m);
    g.computeVertexNormals();
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    const cen = new Float32Array(n * 3);
    const an = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      col.set([c.r, c.g, c.b], i * 3);
      cen.set([center.x, center.y, center.z], i * 3);
      an.set(anim, i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aCenter', new THREE.BufferAttribute(cen, 3));
    g.setAttribute('aAnim', new THREE.BufferAttribute(an, 4));
    this.parts.push(g);
  }

  build(ctx: FieldCtx, clock: RiftClock): void {
    if (!this.parts.length) return;
    const geo = mergeGeometries(this.parts);
    if (!geo) return;
    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: clock.uTime,
        uBeat: clock.uBeat,
        uLightDir: LIGHT.dir,
        uAmbient: LIGHT.ambient,
        uRimColor: LIGHT.rimColor,
        uShadowTint: LIGHT.shadowTint,
      },
      vertexShader: FRAG_VERT,
      fragmentShader: FRAG_FRAG,
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

/** A piece of rock debris (a hexagonal slab or a polyhedral rock), possibly carrying crystals or a broken pillar */
function rockChunk(set: FragmentSet, r: () => number, x: number, y: number, z: number, s: number, anim: Anim): void {
  const c = new THREE.Vector3(x, y, z);
  const col = [COL.slab, COL.stoneD, 0x362a42, COL.stone][Math.floor(r() * 4)];
  const hex = r() < 0.55;
  const geo = hex ? new THREE.CylinderGeometry(s, s * 0.3, s * 1.1, 6) : new THREE.DodecahedronGeometry(s, 0);
  set.add(geo, M(x, y, z, r() * 6, 1, hex ? (r() - 0.5) * 0.5 : r() * 3, hex ? (r() - 0.5) * 0.5 : r() * 3), col, c, anim);
  if (hex) {
    // A lighter layer of ground cover on top
    set.add(new THREE.CylinderGeometry(s * 0.98, s * 0.98, s * 0.12, 6), M(x, y + s * 0.55, z, r() * 6), 0x4a4056, c, anim);
  }
  const topY = y + (hex ? s * 0.6 : s * 0.7);
  if (r() < 0.5) {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const g = new THREE.OctahedronGeometry(0.35);
      g.scale(0.6, 2.4, 0.6);
      const cs = 0.5 + r() * s * 0.45;
      set.add(g, M(x + (r() - 0.5) * s * 0.7, topY + 0.5 * cs, z + (r() - 0.5) * s * 0.7, r() * 6, cs, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7), r() < 0.55 ? COL.cryA : COL.cryB, c, [anim[0], anim[1], anim[2], 1]);
    }
  } else if (hex && s > 1.6 && r() < 0.6) {
    const h = 0.8 + r() * s * 0.9;
    set.add(new THREE.CylinderGeometry(0.34 * s * 0.4, 0.4 * s * 0.4, h, 8), M(x + (r() - 0.5) * s * 0.4, topY + h / 2, z, 0, 1, (r() - 0.5) * 0.3), COL.stoneL, c, anim);
  }
}

/** A floating old-kingdom paving stone (a square slab with a bit of soil stuck underneath) */
function tileChunk(set: FragmentSet, r: () => number, x: number, y: number, z: number, s: number, anim: Anim): void {
  const c = new THREE.Vector3(x, y, z);
  const w = s * (1.6 + r() * 0.8);
  const d = s * (1.4 + r() * 0.8);
  const ry = r() * 6;
  const rx = (r() - 0.5) * 0.7;
  const rz = (r() - 0.5) * 0.7;
  set.add(new THREE.BoxGeometry(w, s * 0.35, d), M(x, y, z, ry, 1, rx, rz), [COL.stone, COL.stoneD, 0x4c4258][Math.floor(r() * 3)], c, anim);
  set.add(new THREE.DodecahedronGeometry(s * 0.55, 0), M(x, y - s * 0.3, z, ry, 1, rx, rz), 0x2e2438, c, anim);
}

/** Shards drifting low above the ground: x, y, z, size, kind (0 rock debris, 1 paving stone) */
export type Debris = [number, number, number, number, number?];

function fragments(ctx: FieldCtx, clock: RiftClock, r: () => number, debris: Debris[]): void {
  const set = new FragmentSet();
  // Use its own random stream: one more or one fewer ground shard leaves the layout in the void unchanged
  const dr = rng(5501);
  const lane = ctx.layout.pathW + 0.6;
  for (const [x, y, z, s, kind] of debris) {
    const anim: Anim = [dr() * 6.28, (dr() - 0.5) * 0.45, 0.15 + dr() * 0.3, 0];
    // Nothing placed above walkways or within a person's height (it would look like it blocks the road)
    if (ctx.pathDist(x, z) < lane && y - ctx.h(x, z) < 2.8) continue;
    if (kind === 1) tileChunk(set, dr, x, y, z, s, anim);
    else rockChunk(set, dr, x, y, z, s, anim);
  }
  const k = ctx.low ? 0.5 : 1;
  // Shards in the void: from the land's outer edge into the distance, bigger the farther away
  for (let i = 0; i < 130 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = 118 + Math.pow(r(), 0.8) * 230;
    const x = Math.cos(a) * d;
    const z = -6 + Math.sin(a) * d;
    const y = VOID_Y + 6 + Math.pow(r(), 1.4) * 75;
    const s = (0.8 + r() * 3) * (0.6 + (d - 118) / 110) * (r() < 0.08 ? 2.2 : 1);
    rockChunk(set, r, x, y, z, s, [r() * 6.28, (r() - 0.5) * 0.09, 0.3 + r() * 1.2, 0]);
  }
  // Shards floating in the Wound: a ring around the tower
  for (let i = 0; i < 48 * k; i++) {
    const a = r() * Math.PI * 2;
    const d = RIN + 3 + r() * (ROUT - RIN - 6);
    const x = T[0] + Math.sin(a) * d;
    const z = T[1] + Math.cos(a) * d;
    // Avoid the Old Kingdom Road in the south and the broken bridge in the north
    if (Math.abs(x - T[0]) < 10) continue;
    const y = VOID_Y + 4 + r() * 30;
    rockChunk(set, r, x, y, z, 0.6 + r() * 2.2, [r() * 6.28, (r() - 0.5) * 0.14, 0.4 + r() * 0.8, 0]);
  }
  // Small stones floating above the ground: gravity is no longer very reliable here
  const spots: [number, number, number, number][] = [
    [-25, 24, 11, 20],
    [-40, -84, 12, 22],
    [-74, -10, 14, 12],
    [T[0], T[1], 24, 22],
    [72, -6, 18, 16],
    [0, -61, 6, 10],
  ];
  for (const [cx, cz, rad, n] of spots) {
    for (let i = 0; i < n * k; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const gh = ctx.h(x, z);
      if (gh < -6 || ctx.solids.blocked(x, z, 2.2)) continue;
      const tower = cx === T[0] && cz === T[1];
      if (tower && d < 19) continue;
      const y = gh + 2.4 + r() * (tower ? 14 : 6);
      rockChunk(set, r, x, y, z, 0.25 + r() * 0.8, [r() * 6.28, (r() - 0.5) * 0.5, 0.3 + r() * 0.5, 0]);
    }
  }
  set.build(ctx, clock);
}

// ───────────────────────── Floating isles carrying ruins ─────────────────────────

/** Floating isle: a jagged flat top (ground color) and a rock body tapering downward to a point */
export function floatingIsland(b: PropBatch, r: () => number, R: number, depth: number, ground: number, rock: number): void {
  const SEG = 28;
  const rim = Array.from({ length: SEG }, (_, i) => R * (0.8 + 0.25 * Math.sin(i * 1.7 + R) * r() + 0.15 * r()));
  const levels: [number, number, number][] = [
    [0, 1, 0],
    [-depth * 0.18, 1.02, 0.15],
    [-depth * 0.45, 0.72, 0.25],
    [-depth * 0.72, 0.38, 0.25],
  ];
  const ring = (y: number, s: number, j: number) =>
    rim.map((rr, i) => {
      const a = (i / SEG) * Math.PI * 2;
      const q = rr * s * (1 + (r() - 0.5) * j);
      return new THREE.Vector3(Math.cos(a) * q, y + (r() - 0.5) * j * depth * 0.2, Math.sin(a) * q);
    });
  const rings = levels.map(([y, s, j]) => ring(y, s, j));
  const body: number[] = [];
  for (let l = 0; l < rings.length - 1; l++) {
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      const A = rings[l];
      const B = rings[l + 1];
      body.push(A[i].x, A[i].y, A[i].z, B[i].x, B[i].y, B[i].z, A[j].x, A[j].y, A[j].z);
      body.push(A[j].x, A[j].y, A[j].z, B[i].x, B[i].y, B[i].z, B[j].x, B[j].y, B[j].z);
    }
  }
  const last = rings[rings.length - 1];
  const apex = new THREE.Vector3((r() - 0.5) * R * 0.3, -depth, (r() - 0.5) * R * 0.3);
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    body.push(last[i].x, last[i].y, last[i].z, apex.x, apex.y, apex.z, last[j].x, last[j].y, last[j].z);
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(body, 3));
  bg.computeVertexNormals();
  b.add(bg, rock, new THREE.Matrix4());
  const top: number[] = [];
  const t0 = rings[0];
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    top.push(0, 0.05, 0, t0[j].x, t0[j].y + 0.05, t0[j].z, t0[i].x, t0[i].y + 0.05, t0[i].z);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  tg.computeVertexNormals();
  b.add(tg, ground, new THREE.Matrix4(), false);
}

function ruinColumn(b: PropBatch, x: number, y: number, z: number, h: number, s: number, tilt: number, ry: number): void {
  b.add(new THREE.CylinderGeometry(0.42 * s, 0.5 * s, h, 9), COL.stone, M(x, y + h / 2, z, ry, 1, tilt, 0));
  b.add(new THREE.BoxGeometry(1.2 * s, 0.3 * s, 1.2 * s), COL.stoneD, M(x, y + 0.15 * s, z, ry));
}

function islands(ctx: FieldCtx, r: () => number): void {
  const specs: [number, number, number, number, boolean][] = [
    // x, y, z, radius, upside down
    [-190, 18, -150, 22, false],
    [235, 6, 30, 16, false],
    [-170, -4, 175, 14, false],
    [70, 30, -250, 26, false],
    [40, -8, 225, 12, false],
    [-250, 40, -30, 11, false],
    [150, 95, -130, 18, true],
    [-120, 120, 60, 14, true],
    [60, 140, 140, 16, true],
  ];
  const groups: { g: THREE.Group; y: number; ph: number; sp: number }[] = [];
  for (const [x, y, z, R, inv] of specs) {
    const b = new SoloBatch();
    // Distant floating isles get no outline
    b.lines = false;
    floatingIsland(b, r, R, R * (1.2 + r() * 0.5), 0x3e3448, COL.slab);
    // Ruins on the isle: a colonnade, broken arches, crystals
    const n = 3 + Math.floor(R / 5);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * R * 0.6;
      const px = Math.cos(a) * d;
      const pz = Math.sin(a) * d;
      if (r() < 0.55) ruinColumn(b, px, 0, pz, 2 + r() * R * 0.35, 1 + R * 0.04, (r() - 0.5) * 0.25, r() * 6);
      else {
        for (let c = 0; c < 3; c++) {
          const g = new THREE.OctahedronGeometry(0.5);
          g.scale(0.6, 2.4, 0.6);
          const s = 1 + r() * R * 0.12;
          b.glow(g, r() < 0.5 ? COL.cryA : COL.cryB, M(px + (r() - 0.5) * 2, 0.8 * s, pz + (r() - 0.5) * 2, r() * 6, s, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
        }
      }
    }
    if (R > 15) {
      // On the big isle, half-standing hall walls
      b.add(new THREE.BoxGeometry(R * 0.7, R * 0.3, 1.2), COL.stoneD, M(-R * 0.1, R * 0.15, R * 0.2, r() * 3));
      b.add(new THREE.TorusGeometry(R * 0.18, 0.5, 6, 12, Math.PI * 0.8), COL.stone, M(R * 0.2, R * 0.3, -R * 0.2, r() * 3));
    }
    const g = new THREE.Group();
    b.buildInto(g, ctx.disposers);
    g.position.set(x, y, z);
    if (inv) g.rotation.x = Math.PI;
    g.rotation.y = r() * 6;
    ctx.group.add(g);
    groups.push({ g, y, ph: r() * 6, sp: 0.15 + r() * 0.15 });
  }
  ctx.extras.push((_dt, t) => {
    for (const it of groups) {
      it.g.position.y = it.y + Math.sin(t * it.sp + it.ph) * 1.6;
      it.g.rotation.y += 0.0004;
    }
  });
}

/** Assemble the whole void */
export function buildVoid(ctx: FieldCtx, clock: RiftClock, r: () => number, debris: Debris[] = []): void {
  const noise = noiseTexture(128);
  ctx.disposers.push(() => noise.dispose());
  skyShell(ctx, clock);
  voidMist(ctx, clock, noise);
  lightCurtains(ctx, clock, noise);
  tears(ctx, clock, noise);
  phantoms(ctx, clock, r);
  fragments(ctx, clock, r, debris);
  islands(ctx, r);
}
