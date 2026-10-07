// Stage pieces for the Star Gate summon: starfield, Star Gate (ring, runes, vortex door), meteor, starlight stones.

import * as THREE from 'three';
import { glowTex, ringTex, runeCircleTex } from '../textures.ts';
import { streakTex } from '../fxtex.ts';
import { inkScenery } from '../ink.ts';
import { sceneMaterial, type SpiritMaterial } from '../spiritToon.ts';
import { additive, taperedTube, type Vfx } from '../vfx.ts';
import { ease, type Tweens } from '../tween.ts';

export const RARITY_COLOR = { R: 0x5ab8ff, SR: 0xc070ff, SSR: 0xffc040 } as const;
export const RARITY_HI = { R: 0xd8f0ff, SR: 0xf0d0ff, SSR: 0xfff4c0 } as const;

// ───────────────────────── Starfield ─────────────────────────

/** Starfield: gradient + nebula + twinkling stars; uFlood can tint the whole sky with an element's field color */
export function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFlood: { value: new THREE.Color(0x000000) },
      uFloodAmt: { value: 0 },
      uFloodTop: { value: new THREE.Color(0x000000) },
      uGlow: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uFlood; uniform vec3 uFloodTop; uniform float uFloodAmt; uniform float uGlow; varying vec3 vP;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        float up = smoothstep(-0.3, 0.5, vP.y);
        vec3 c = mix(vec3(0.012, 0.008, 0.035), vec3(0.075, 0.04, 0.19), up);
        // Two layers of nebula flowing slowly
        float neb = sin(vP.x * 6.0 + uTime * 0.1) * sin(vP.y * 5.0) * sin(vP.z * 4.0 - uTime * 0.05);
        float neb2 = sin(vP.x * 3.0 - uTime * 0.07 + 1.7) * sin(vP.y * 7.0 + 0.4) * sin(vP.z * 5.0 + uTime * 0.04);
        c += vec3(0.35, 0.12, 0.5) * smoothstep(0.3, 0.9, neb) * 0.28;
        c += vec3(0.1, 0.25, 0.5) * smoothstep(0.4, 0.95, neb2) * 0.22;
        // Stars: two scales, each twinkling
        float s = hash(floor(vP * 260.0));
        float s2 = hash(floor(vP * 90.0 + 3.0));
        c += vec3(step(0.996, s)) * (0.6 + 0.4 * sin(uTime * 2.0 + s * 50.0));
        c += vec3(0.9, 0.85, 1.0) * step(0.997, s2) * (0.5 + 0.5 * sin(uTime * 1.3 + s2 * 80.0)) * 1.6;
        // Faint glow toward the Star Gate (the whole sky brightens as the gate opens)
        c += vec3(0.5, 0.4, 0.9) * uGlow * 0.6 * exp(-length(vP - vec3(0.0, 0.12, -1.0)) * 2.2);
        // Element field: the horizon is uFlood, the zenith is uFloodTop
        vec3 flood = mix(uFlood, uFloodTop, smoothstep(-0.1, 0.7, vP.y));
        c = mix(c, flood, uFloodAmt);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ───────────────────────── Star Gate ─────────────────────────

export interface Rune {
  mesh: THREE.Mesh;
  /** Gem: the gem faces of a toon material, lighting up and going out only change the base color and the emissive amount */
  mat: SpiritMaterial;
  glow: THREE.Sprite;
  color: THREE.Color;
}

export interface Gate {
  group: THREE.Group;
  ring: THREE.Mesh;
  ringMat: SpiritMaterial;
  runes: Rune[];
  /** Vortex door */
  portal: THREE.Mesh;
  portalMat: THREE.ShaderMaterial;
  /** Static rune array on the door */
  seal: THREE.Mesh;
  sealMat: THREE.MeshBasicMaterial;
  /** Golden rune array on the inner ring, rotating in reverse */
  seal2: THREE.Mesh;
  seal2Mat: THREE.MeshBasicMaterial;
  radius: number;
}

/** Vortex door: polar spiral arms + a central light core; uOpen is the iris opening fraction, uHot is extra brightness */
function portalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x8a9aff) }, uHi: { value: new THREE.Color(0xe0e8ff) }, uOpen: { value: 0 }, uHot: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform vec3 uHi; uniform float uOpen; uniform float uHot; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        // Three spiral arms curl inward, rotating faster nearer the center
        float arm = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 2.6 + 3.0 / (r + 0.25));
        float arm2 = 0.5 + 0.5 * sin(a * 5.0 - r * 14.0 + uTime * 1.7);
        float swirl = pow(arm, 2.5) * 0.8 + pow(arm2, 4.0) * 0.4;
        float core = exp(-r * r * 6.0);
        // Iris: the vortex is visible only inside the opening, with a bright rim around the edge of the opening
        float iris = smoothstep(uOpen + 0.03, uOpen - 0.05, r);
        float edge = exp(-abs(r - uOpen) * 40.0) * step(0.02, uOpen);
        float fade = smoothstep(1.0, 0.85, r);
        vec3 col = mix(uColor, uHi, core * 0.9 + swirl * 0.25) * (1.0 + uHot * 0.6);
        float alpha = (swirl * 0.3 + core * 0.42) * iris * fade + edge * 0.7 * fade;
        gl_FragColor = vec4(col * alpha, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** Base color fraction and emissive amount when a rune gem is out */
const RUNE_DIM = 0.3;
const RUNE_DIM_GLOW = 0.06;

export function buildGate(radius = 5): Gate {
  const group = new THREE.Group();
  // The stone is always the scene toon material, with the outline handed to post-process by inkScenery (no back-face mesh)
  // Main ring: dark stone, with a thicker dark ring behind it for thickness
  const ringGeo = new THREE.TorusGeometry(radius, 0.55, 18, 96);
  const ringMat = sceneMaterial(0x3a3260, { rim: 0.5, emissive: 0x2a1a70, emissiveAmt: 0.12 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  group.add(ring);
  const backGeo = new THREE.TorusGeometry(radius, 0.78, 12, 96);
  const back = new THREE.Mesh(backGeo, sceneMaterial(0x221c3e, { rim: 0.3 }));
  back.position.z = -0.45;
  group.add(back);
  // Carved stone blocks: a ring of chiseled faces, alternating high and low
  const blockMat = sceneMaterial(0x4a4076, { rim: 0.45 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.PI / 24;
    const tall = i % 3 === 0;
    const geo = new THREE.BoxGeometry(0.62, tall ? 0.34 : 0.26, tall ? 0.42 : 0.3);
    const b = new THREE.Mesh(geo, blockMat);
    b.position.set(Math.cos(a) * (radius + (tall ? 0.55 : 0.5)), Math.sin(a) * (radius + (tall ? 0.55 : 0.5)), 0.2);
    b.rotation.z = a + Math.PI / 2;
    group.add(b);
  }
  // Golden inlay: two thin gold rings inside and outside + one ring on the front
  const gold = new THREE.MeshBasicMaterial({ color: 0xd9a94a, toneMapped: true });
  for (const [r, w, z] of [[radius - 0.62, 0.05, 0.1], [radius + 0.98, 0.05, 0.05], [radius, 0.045, 0.56]] as const) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 128), gold);
    m.position.z = z;
    group.add(m);
  }
  // Door: the vortex (visible only when the gate opens) + two rune arrays rotating in opposite directions
  const portalMat = portalMaterial();
  const portal = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.3, 72), portalMat);
  portal.position.z = -0.05;
  group.add(portal);
  const sealMat = new THREE.MeshBasicMaterial({ map: runeCircleTex(6), color: new THREE.Color(0x8a9aff).multiplyScalar(0.8), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const seal = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.4, 64), sealMat);
  group.add(seal);
  const seal2Mat = new THREE.MeshBasicMaterial({ map: runeCircleTex(3), color: new THREE.Color(0xd9a94a).multiplyScalar(0.7), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const seal2 = new THREE.Mesh(new THREE.CircleGeometry(radius - 1.3, 64), seal2Mat);
  seal2.position.z = 0.02;
  group.add(seal2);
  // Eight rune seats: dark stone seats + gold frames, very dim while the gem is unlit
  const runes: Rune[] = [];
  const runeColors = [0xff6a2b, 0x3db7ff, 0x5fcb5a, 0x9fe8e0, 0xc49a5a, 0xb38cff, 0xffe680, 0x7b3fc4];
  const socketMat = sceneMaterial(0x241e44, { rim: 0.35 });
  const socketGeo = new THREE.CylinderGeometry(0.68, 0.74, 0.3, 8);
  const gemGeo = new THREE.OctahedronGeometry(0.4);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 + (i / 8) * Math.PI * 2;
    const color = new THREE.Color(runeColors[i]);
    const socket = new THREE.Mesh(socketGeo, socketMat);
    socket.rotation.x = Math.PI / 2;
    socket.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.55);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 32), gold);
    frame.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.72);
    // Gems: flat-faceted toon gems, dark crystals when out, lit by emission + the halo behind them
    const mat = sceneMaterial(color.clone().multiplyScalar(RUNE_DIM), { surface: 'gem', rim: 0.5, emissive: color, emissiveAmt: RUNE_DIM_GLOW });
    const mesh = new THREE.Mesh(gemGeo, mat);
    mesh.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.85);
    mesh.rotation.z = a;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: color.clone().multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glow.position.copy(mesh.position);
    glow.scale.setScalar(2.2);
    group.add(socket, frame, mesh, glow);
    runes.push({ mesh, mat, glow, color });
  }
  // Opaque toon meshes (ring, stone blocks, seats, gems) go into the ink layer; the gold inlay, door, rune arrays and halos are not MeshToon and are skipped automatically
  inkScenery(group);
  return { group, ring, ringMat, runes, portal, portalMat, seal, sealMat, seal2, seal2Mat, radius };
}

/** Light up one rune (and keep it lit) */
export function lightRune(r: Rune, tw: Tweens, boost = 1): void {
  r.mat.uniforms.uColor.value.copy(r.color);
  r.mat.uniforms.uEmissiveAmt.value = 1.25 * boost;
  void tw.to(0.5, (k) => {
    (r.glow.material as THREE.SpriteMaterial).opacity = 0.7 * (1 - k) + 0.3;
    r.glow.scale.setScalar(2.2 + (1 - k) * 1.8);
    r.mesh.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.5);
  }, ease.outCubic, 'fx');
}

export function dimRune(r: Rune): void {
  r.mat.uniforms.uColor.value.copy(r.color).multiplyScalar(RUNE_DIM);
  r.mat.uniforms.uEmissiveAmt.value = RUNE_DIM_GLOW;
  (r.glow.material as THREE.SpriteMaterial).opacity = 0;
  r.mesh.scale.setScalar(1);
}

// ───────────────────────── Meteor ─────────────────────────

/**
 * Meteor: a light tube is prebuilt along the whole arc, and the shader draws only "the stretch behind the head", with the head having its own halo and sparks.
 * The returned promise resolves when the meteor reaches the end.
 */
export function meteor(vfx: Vfx, from: THREE.Vector3, apex: THREE.Vector3, to: THREE.Vector3, color: number, hi: number, dur: number): Promise<void> {
  const curve = new THREE.CatmullRomCurve3([from, apex, to], false, 'catmullrom', 0.6);
  const geo = taperedTube(curve, 90, 10, 0.7, 0.7);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color).multiplyScalar(1.6) }, uHi: { value: new THREE.Color(hi).multiplyScalar(2.0) }, uProg: { value: 0 }, uTail: { value: 0.32 }, uT: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform vec3 uHi; uniform float uProg; uniform float uTail; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float d = uProg - vUv.x;
        if (d < 0.0 || d > uTail) discard;
        float k = 1.0 - d / uTail;
        float f = abs(dot(normalize(vN), normalize(vV)));
        // The tail gets thinner and darker the farther it goes, with some fire streaks along the tube
        float flame = 0.75 + 0.25 * sin(vUv.y * 18.85 + vUv.x * 120.0 - uT * 40.0);
        float body = pow(f, 1.2) * k * k * flame;
        float core = pow(f, 5.0) * pow(k, 6.0);
        float a = body * 0.9 + core * 1.2;
        gl_FragColor = vec4(mix(uCol, uHi, core) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const tube = new THREE.Mesh(geo, mat);
  tube.frustumCulled = false;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(hi).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  head.scale.setScalar(4.4);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.setScalar(10);
  const g = new THREE.Group();
  g.add(tube, head, halo);
  const p = new THREE.Vector3();
  let t = 0;
  let acc = 0;
  return vfx.spawn(g, dur + 0.35, (k, dt) => {
    t += dt;
    const prog = Math.min(1, (k * (dur + 0.35)) / dur);
    const pe = ease.inQuad(prog) * 0.55 + prog * 0.45;
    mat.uniforms.uProg.value = pe;
    mat.uniforms.uT.value = t;
    curve.getPointAt(Math.min(1, pe), p);
    head.position.copy(p);
    halo.position.copy(p);
    const fade = prog >= 1 ? Math.max(0, 1 - (k * (dur + 0.35) - dur) / 0.35) : 1;
    head.material.opacity = fade;
    halo.material.opacity = 0.7 * fade;
    mat.uniforms.uTail.value = prog >= 1 ? 0.32 * fade : 0.32;
    acc += dt * 220;
    const n = Math.floor(acc);
    if (n > 0 && prog < 1) {
      acc -= n;
      vfx.emit({ pos: p, count: n, color: [color, hi, 0xffffff], speed: [0.5, 2.5], life: [0.3, 0.7], size: [0.08, 0.2], sizeEnd: 0.02, radius: 0.3, gravity: 1.5, drag: 1, intensity: 1.1, atlas: 1 });
    }
  });
}

// ───────────────────────── Starlight stone ─────────────────────────

/** One starlight stone: a pale blue crystal that glows; shatter() blows it into fragments and motes flowing toward target */
export function crystal(vfx: Vfx, pos: THREE.Vector3, target: THREE.Vector3, delay: number, life: number): Promise<void> {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.28);
  geo.scale(1, 1.6, 1);
  // Solid crystal: toon gem faces + emission, getting brighter and brighter before it shatters; the outline goes through post-process
  const mat = sceneMaterial(0x9ad8ff, { surface: 'gem', rim: 0.6, emissive: 0x7ac8ff, emissiveAmt: 0.3 });
  const m = new THREE.Mesh(geo, mat);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0x7ac8ff).multiplyScalar(0.9), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.scale.setScalar(0.9);
  g.add(m, glow);
  inkScenery(g);
  g.position.copy(pos);
  const dir = target.clone().sub(pos).normalize();
  let shattered = false;
  return vfx.spawn(g, life, (k, dt) => {
    const t = k * life;
    m.rotation.y += dt * 2.5;
    m.rotation.x += dt * 0.8;
    // Appearance: floats up from below
    const rise = Math.min(1, t / 0.15);
    g.position.y = pos.y - (1 - ease.outCubic(rise)) * 0.5;
    if (t >= delay && !shattered) {
      shattered = true;
      m.visible = false;
      glow.visible = false;
      vfx.emit({ pos: g.position, count: 14, color: [0x9ad8ff, 0xffffff], speed: [2, 5], life: [0.25, 0.5], size: [0.06, 0.16], atlas: 2, drag: 2, gravity: 4, intensity: 1 });
      // Motes flow to the Star Gate: spreading out sideways a little, then converging
      vfx.emit({ pos: g.position, count: 40, color: [0xbfe8ff, 0xffffff, 0xd8c8ff], speed: [11, 17], dir, spread: 0.22, life: [0.45, 0.7], size: [0.1, 0.22], sizeEnd: 0.03, drag: 0, intensity: 1.2, atlas: 1 });
      void vfx.flash(g.position, 0xbfe8ff, 0.8, 0.22);
    }
    if (!shattered) {
      const pulse = 0.3 + 0.2 * Math.sin(t * 14 + pos.x);
      (glow.material as THREE.SpriteMaterial).opacity = pulse;
      mat.uniforms.uEmissiveAmt.value = 0.3 + Math.min(1, t / delay) * 0.8;
    }
  });
}

/** A large ring of light (facing a given normal), a brighter, slower version of vfx.ring, for the gate opening */
export function slowRing(vfx: Vfx, pos: THREE.Vector3, color: number, r0: number, r1: number, dur: number, normal: THREE.Vector3, intensity = 1.6): Promise<void> {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(color, ringTex(), intensity));
  m.position.copy(pos);
  m.lookAt(pos.clone().add(normal));
  return vfx.spawn(m, dur, (k) => {
    m.scale.setScalar(r0 + (r1 - r0) * ease.outCubic(k));
    (m.material as THREE.MeshBasicMaterial).opacity = 1 - k * k;
  });
}

/** Light bar: a stroke of light from a to b (facing the camera), for the upgrade and impacts */
export function streakMaterial(color: number): THREE.MeshBasicMaterial {
  return additive(color, streakTex(), 1.8);
}
