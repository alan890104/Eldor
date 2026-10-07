// Dawnlight Holy City (light): a white holy city floating on a sea of clouds. Facing the camera is the cathedral's front (rose window, triple arch, flying buttresses and twin towers),
// with the bell tower beside it; outside the battle area are stairs and a white-stone colonnade, the sea of clouds below flows slowly, soft light pillars descend from the sky, light feathers fall and white doves circle the city.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, MS, type ArenaCtx, type PropBatch, type RegionModule } from '../arenaKit.ts';
import { inkScenery } from '../ink.ts';
import { sceneMaterial } from '../spiritToon.ts';

// The field's fixed colors: the ground is not pure white, so bright spirits can still stand out
const C = {
  stone: 0xcfc6b6,
  stoneDark: 0xafa28c,
  wall: 0xdcd6cc,
  gold: 0xe2b34a,
  glow: 0xffd45a,
  warm: 0xf2b45c,
  doorway: 0x3d3a66,
  roof: 0x8fa4cc,
  cloud: 0xe8e2d8,
  cloudFar: 0xdcd0c4,
  city: 0xc4b4b0,
  cypress: 0x5f8f66,
  planter: 0xc8b28a,
};

/** Height of the terrace (the ring outside the battle area) */
const TY = 0.5;

/** One white stone pillar of the holy city: a square base + disc, a fluted shaft, a bell-shaped capital with a square abacus, a gold ring */
function column(b: PropBatch, x: number, z: number, h: number, ry = 0) {
  const T = M(x, TY, z, ry);
  const at = (L: THREE.Matrix4) => T.clone().multiply(L);
  b.add(new THREE.BoxGeometry(1.5, 0.3, 1.5), C.stoneDark, at(M(0, 0.15, 0)));
  b.add(new THREE.CylinderGeometry(0.62, 0.7, 0.22, 16), C.stone, at(M(0, 0.41, 0)));
  // Shaft: a thick cylinder ringed by thin cylinders, which stagger into fluting shadows
  b.add(new THREE.CylinderGeometry(0.42, 0.46, h, 12), C.stone, at(M(0, 0.52 + h / 2, 0)));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.1, 0.11, h - 0.2, 6), C.wall, at(M(Math.cos(a) * 0.42, 0.52 + h / 2, Math.sin(a) * 0.42)), false);
  }
  b.add(new THREE.TorusGeometry(0.46, 0.05, 6, 16), C.gold, at(M(0, 0.62, 0, 0, 1, Math.PI / 2)), false);
  b.add(new THREE.TorusGeometry(0.44, 0.05, 6, 16), C.gold, at(M(0, 0.4 + h, 0, 0, 1, Math.PI / 2)), false);
  // Capital
  b.add(new THREE.CylinderGeometry(0.72, 0.44, 0.5, 12), C.stone, at(M(0, 0.52 + h + 0.25, 0)));
  b.add(new THREE.BoxGeometry(1.5, 0.28, 1.5), C.stoneDark, at(M(0, 0.52 + h + 0.64, 0)));
  b.glow(new THREE.OctahedronGeometry(0.16), C.glow, at(M(0, 0.52 + h + 0.95, 0)));
}

/** A section of archway: two gold-edged pillars, a semicircular arch above, a dark doorway inside (with warm light showing through the doorway) */
function portal(b: PropBatch, T: THREE.Matrix4, x: number, y: number, z: number, w: number, h: number, lit: boolean) {
  const at = (L: THREE.Matrix4) => T.clone().multiply(L);
  const r = w / 2;
  b.add(new THREE.BoxGeometry(w, h, 0.5), C.doorway, at(M(x, y + h / 2, z - 0.2)), false);
  b.add(new THREE.CircleGeometry(r, 16, 0, Math.PI), C.doorway, at(M(x, y + h, z + 0.06)), false);
  b.add(new THREE.CylinderGeometry(0.14, 0.14, h, 8), C.gold, at(M(x - r - 0.1, y + h / 2, z + 0.1)));
  b.add(new THREE.CylinderGeometry(0.14, 0.14, h, 8), C.gold, at(M(x + r + 0.1, y + h / 2, z + 0.1)));
  b.add(new THREE.TorusGeometry(r + 0.1, 0.16, 8, 18, Math.PI), C.gold, at(M(x, y + h, z + 0.1)));
  b.add(new THREE.TorusGeometry(r + 0.42, 0.12, 6, 18, Math.PI), C.stoneDark, at(M(x, y + h, z + 0.05)));
  if (lit) b.glow(new THREE.BoxGeometry(w * 0.5, h * 0.84, 0.08), C.warm, at(M(x, y + h * 0.42, z + 0.12)));
}

/** Cathedral: located at (cx, cz), front facing +z (that is, toward the camera) */
function cathedral(b: PropBatch, cx: number, cz: number) {
  const T = M(cx, 0, cz);
  const at = (L: THREE.Matrix4) => T.clone().multiply(L);
  const Y0 = TY + 1.2;
  // Its own foundation and the rock base reaching down into the sea of clouds (the cathedral's rear half hangs beyond the platform edge)
  b.add(new THREE.BoxGeometry(26, 1.2, 22), C.stoneDark, at(M(0, TY + 0.6, -4)));
  b.add(new THREE.BoxGeometry(27, 5, 23), C.stoneDark, at(M(0, TY - 2.5, -4)), false);
  // Grand staircase (five steps)
  for (let k = 0; k < 5; k++) {
    const hk = 0.24 * (k + 1);
    b.add(new THREE.BoxGeometry(15 - k * 0.6, hk, 0.8), C.stone, at(M(0, TY + hk / 2, 10.4 - k * 0.8)));
  }
  // Nave and front
  b.add(new THREE.BoxGeometry(12, 15, 18), C.wall, at(M(0, Y0 + 7.5, -3)));
  // Gable and sloped roof: a triangular prism (shortened in height, then turned point-up)
  const gable = new THREE.CylinderGeometry(6.93, 6.93, 18, 3);
  b.add(gable, C.roof, at(new THREE.Matrix4().compose(new THREE.Vector3(0, Y0 + 15 + 1.9, -3), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 0.55))));
  b.add(new THREE.BoxGeometry(12.6, 0.5, 18.4), C.stoneDark, at(M(0, Y0 + 15, -3)));
  // Golden sun emblem on the gable and the spire
  b.glow(new THREE.TorusGeometry(0.85, 0.12, 6, 20), C.glow, at(M(0, Y0 + 16.9, 6.2)));
  b.glow(new THREE.CircleGeometry(0.5, 16), C.glow, at(M(0, Y0 + 16.9, 6.15)));
  b.add(new THREE.CylinderGeometry(0.08, 0.14, 2.2, 6), C.gold, at(M(0, Y0 + 19.9, -3)));
  b.glow(new THREE.OctahedronGeometry(0.35), C.glow, at(M(0, Y0 + 21.1, -3)));
  // Rose window: a gold frame, eight pieces of colored glass, spokes and a center
  const wy = Y0 + 10.2;
  b.add(new THREE.TorusGeometry(2.5, 0.24, 8, 28), C.gold, at(M(0, wy, 6.1)));
  const glass = [0xff8a78, 0x7ab8ff, 0xffd45a, 0x8ae08a];
  for (let i = 0; i < 8; i++) b.glow(new THREE.CircleGeometry(2.35, 1, (i / 8) * Math.PI * 2, Math.PI / 4), glass[i % 4]!, at(M(0, wy, 6.05)));
  for (let i = 0; i < 4; i++) b.add(new THREE.BoxGeometry(0.14, 4.7, 0.12), C.gold, at(M(0, wy, 6.16, 0, 1, 0, (i / 4) * Math.PI)));
  b.add(new THREE.TorusGeometry(0.7, 0.1, 6, 16), C.gold, at(M(0, wy, 6.18)));
  b.glow(new THREE.CircleGeometry(0.6, 16), 0xffffff, at(M(0, wy, 6.2)));
  // Triple arch
  portal(b, T, 0, Y0, 6, 3.0, 5.0, true);
  portal(b, T, -4.2, Y0, 6, 1.9, 3.8, false);
  portal(b, T, 4.2, Y0, 6, 1.9, 3.8, false);
  // Side aisles and the aisles' arched windows
  for (const sx of [-1, 1]) {
    b.add(new THREE.BoxGeometry(4, 7, 16), C.wall, at(M(sx * 8, Y0 + 3.5, -4)));
    b.add(new THREE.BoxGeometry(4.6, 0.4, 16.6), C.stoneDark, at(M(sx * 8, Y0 + 7, -4)));
    for (const wz of [-9, -4, 1]) {
      b.add(new THREE.BoxGeometry(0.2, 3, 1.1), C.doorway, at(M(sx * 10.05, Y0 + 3.4, wz)), false);
      b.glow(new THREE.BoxGeometry(0.1, 2.4, 0.5), C.warm, at(M(sx * 10.12, Y0 + 3.4, wz)));
    }
    // Tall windows high in the nave
    for (const wz of [-8, -3, 2]) b.glow(new THREE.BoxGeometry(0.1, 3.2, 0.7), C.warm, at(M(sx * 6.06, Y0 + 11, wz)));
    // Flying buttresses: outer piers + pinnacles, with diagonal struts braced against the nave wall
    for (const bz of [-9.5, -2.5, 3.5]) {
      b.add(new THREE.BoxGeometry(1.3, 8.5, 1.3), C.stone, at(M(sx * 11.2, Y0 + 4.25, bz)));
      b.add(new THREE.ConeGeometry(0.9, 2.2, 4), C.roof, at(M(sx * 11.2, Y0 + 9.6, bz, Math.PI / 4)));
      b.glow(new THREE.OctahedronGeometry(0.18), C.glow, at(M(sx * 11.2, Y0 + 10.9, bz)));
      b.add(new THREE.BoxGeometry(6.6, 0.7, 0.8), C.stone, at(M(sx * 8.7, Y0 + 11, bz, 0, 1, 0, sx * -0.72)));
      b.add(new THREE.BoxGeometry(5.4, 0.5, 0.6), C.stoneDark, at(M(sx * 8.9, Y0 + 9.4, bz, 0, 1, 0, sx * -0.72)));
    }
    // Twin towers: body, cornice, tall windows, spire and gold cap
    const tx = sx * 7.6;
    b.add(new THREE.BoxGeometry(4.2, 23, 4.2), C.wall, at(M(tx, Y0 + 11.5, 3.5)));
    for (const ly of [6, 13, 22.8]) b.add(new THREE.BoxGeometry(4.8, 0.4, 4.8), C.stoneDark, at(M(tx, Y0 + ly, 3.5)));
    for (const ly of [9.5, 17.5]) {
      b.add(new THREE.BoxGeometry(0.7, 3, 0.2), C.doorway, at(M(tx, Y0 + ly, 5.62)), false);
      b.glow(new THREE.BoxGeometry(0.3, 2.2, 0.1), C.warm, at(M(tx, Y0 + ly, 5.7)));
    }
    b.add(new THREE.ConeGeometry(2.9, 7, 4), C.roof, at(M(tx, Y0 + 23 + 3.5, 3.5, Math.PI / 4)));
    b.add(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 6), C.gold, at(M(tx, Y0 + 31.2, 3.5)));
    b.glow(new THREE.OctahedronGeometry(0.4), C.glow, at(M(tx, Y0 + 32.1, 3.5)));
  }
}

/** Bell tower: a square tower with an arched opening on each of its four sides, a spire and a gold cap; the bell itself is a dynamic object (it swings) */
function belfry(ctx: ArenaCtx, x: number, z: number): void {
  const { b, group, extras, disposers } = ctx;
  const Y0 = TY;
  b.add(new THREE.BoxGeometry(6, 1.0, 6), C.stoneDark, M(x, Y0 + 0.5, z));
  b.add(new THREE.BoxGeometry(4.2, 21, 4.2), C.wall, M(x, Y0 + 11.5, z));
  for (const ly of [7, 14]) b.add(new THREE.BoxGeometry(4.8, 0.4, 4.8), C.stoneDark, M(x, Y0 + ly, z));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const ox = Math.cos(a) * 2.1;
    const oz = Math.sin(a) * 2.1;
    b.add(new THREE.BoxGeometry(1.8, 3.6, 0.3), C.doorway, M(x + ox, Y0 + 18.5, z + oz, -a + Math.PI / 2), false);
    b.add(new THREE.CircleGeometry(0.9, 12, 0, Math.PI), C.doorway, M(x + ox * 1.02, Y0 + 20.3, z + oz * 1.02, -a + Math.PI / 2), false);
    b.add(new THREE.TorusGeometry(1.0, 0.12, 6, 14, Math.PI), C.gold, M(x + ox * 1.04, Y0 + 20.3, z + oz * 1.04, -a + Math.PI / 2));
  }
  b.add(new THREE.BoxGeometry(5, 0.5, 5), C.stoneDark, M(x, Y0 + 22.2, z));
  b.add(new THREE.ConeGeometry(3.4, 5, 4), C.roof, M(x, Y0 + 24.9, z, Math.PI / 4));
  b.add(new THREE.CylinderGeometry(0.06, 0.14, 1.8, 6), C.gold, M(x, Y0 + 28.2, z));
  b.glow(new THREE.OctahedronGeometry(0.45), C.glow, M(x, Y0 + 29.2, z));
  // Bell: hung in the center of the opening, swinging slowly
  const pivot = new THREE.Group();
  pivot.position.set(x, Y0 + 20.6, z);
  const gold = sceneMaterial(C.gold, { rim: 0.5 });
  const bellGeo = new THREE.CylinderGeometry(0.5, 0.95, 1.5, 12);
  const bell = new THREE.Mesh(bellGeo, gold);
  bell.position.y = -1.0;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 6, 16), gold);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -1.75;
  bell.add(lip);
  pivot.add(bell);
  group.add(pivot);
  // The bell swings, so it stays out of the static batch; like the batch, it goes through the scene objects' post-process outline
  inkScenery(pivot);
  disposers.push(() => gold.dispose());
  extras.push((_dt, t) => {
    pivot.rotation.z = Math.sin(t * 1.7) * 0.32;
  });
}

/** Sea of clouds: a large ring-shaped shader plane, the cloud tops in three toon steps flowing slowly, tinged gold on the side toward the sun */
function buildCloudSea({ group, disposers }: ArenaCtx): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0xf2ece2) },
      uShade: { value: new THREE.Color(0xb4a6cc) },
      uSun: { value: new THREE.Color(0xffd08a) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vW;
      varying float vD;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xz;
        vD = length(wp.xz);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uTop;
      uniform vec3 uShade;
      uniform vec3 uSun;
      varying vec2 vW;
      varying float vD;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 q = vW * 0.045 + vec2(uTime * 0.018, uTime * 0.007);
        float n = vnoise(q) * 0.5 + vnoise(q * 2.1 + 3.7 - uTime * 0.01) * 0.3 + vnoise(q * 4.3 + 9.1 + uTime * 0.015) * 0.2;
        float k = smoothstep(0.36, 0.46, n) * 0.5 + smoothstep(0.56, 0.63, n) * 0.5;
        vec3 c = mix(uShade, uTop, k);
        // The rising sun is in the -x direction: cloud tops on that side turn golden
        float sunSide = smoothstep(20.0, -60.0, vW.x);
        c += uSun * smoothstep(0.58, 0.72, n) * (0.12 + 0.28 * sunSide);
        c += vec3(0.06, 0.05, 0.03) * (1.0 - smoothstep(30.0, 52.0, vD));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  disposers.push(() => mat.dispose());
  const sea = new THREE.Mesh(new THREE.RingGeometry(26, 178, 96, 6), mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.4;
  group.add(sea);
  return mat;
}

/** Light pillars from the sky: each one's three concentric pillar shells merged into one mesh; shell edges turn transparent with view angle, fade at top and bottom, and each whole pillar sways slowly */
function buildLightShafts({ group, disposers }: ArenaCtx, spots: [number, number][]): THREE.ShaderMaterial {
  const H = 40;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.82, 0.42) } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aLayer;
      uniform float uTime;
      varying float vY;
      varying vec3 vN;
      varying vec3 vV;
      varying float vLayer;
      varying vec2 vUv;
      void main() {
        vec3 p = position;
        float k = p.y / ${H.toFixed(1)};
        p.x += sin(uTime * 0.33 + aPhase) * 2.4 * k * k;
        p.z += cos(uTime * 0.27 + aPhase * 1.3) * 1.8 * k * k;
        vY = p.y;
        vN = normal;
        vLayer = aLayer;
        vUv = uv;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying float vY;
      varying vec3 vN;
      varying vec3 vV;
      varying float vLayer;
      varying vec2 vUv;
      vec3 safeNormalize(vec3 v, vec3 fb) { float l = length(v); return l > 1e-6 ? v / l : fb; }
      void main() {
        vec3 n = safeNormalize(vN, vec3(0.0, 1.0, 0.0));
        float edge = abs(dot(n, safeNormalize(vV, n)));
        float soft = pow(edge, 1.8);
        float vert = smoothstep(0.0, 2.5, vY) * (1.0 - smoothstep(14.0, ${H.toFixed(1)}, vY));
        float pulse = 0.85 + 0.15 * sin(uTime * 0.7 + vLayer * 2.0);
        float w = vLayer < 0.5 ? 0.95 : (vLayer < 1.5 ? 0.42 : 0.2);
        float a = soft * vert * pulse * w;
        // Glow where it lands: a disc that fades out by uv radius
        if (vLayer > 2.5) a = (1.0 - smoothstep(0.1, 0.5, length(vUv - 0.5))) * 0.6 * pulse;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  disposers.push(() => mat.dispose());
  const geos: THREE.BufferGeometry[] = [];
  spots.forEach(([x, z], i) => {
    [0.9, 1.7, 2.9].forEach((rad, layer) => {
      const g = new THREE.CylinderGeometry(rad * 0.7, rad, H, 20, 1, true);
      g.translate(x, H / 2, z);
      const n = g.attributes.position.count;
      g.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n).fill(i * 1.9), 1));
      g.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(n).fill(layer), 1));
      geos.push(g);
    });
    const disc = new THREE.CircleGeometry(3.4, 24);
    disc.rotateX(-Math.PI / 2);
    disc.translate(x, 0.04, z);
    const n = disc.attributes.position.count;
    disc.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n).fill(i * 1.9), 1));
    disc.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(n).fill(3), 1));
    geos.push(disc);
  });
  const merged = mergeGeometries(geos.map((g) => g.toNonIndexed()));
  for (const g of geos) g.dispose();
  if (merged) {
    const mesh = new THREE.Mesh(merged, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    group.add(mesh);
  }
  return mat;
}

/** White doves: a flock merged into one mesh, with position and wing flapping all computed in the vertex shader (circling the holy city) */
function buildDoves({ group, disposers }: ArenaCtx, center: THREE.Vector3, radius: number, count: number): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uCenter: { value: center }, uRadius: { value: radius } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aBird;
      attribute float aWing;
      uniform float uTime;
      uniform vec3 uCenter;
      uniform float uRadius;
      varying float vShade;
      void main() {
        float a = uTime * 0.26 + aBird * 0.55;
        float rad = uRadius + sin(aBird * 3.1) * 2.5;
        vec3 c = uCenter + vec3(cos(a) * rad, sin(uTime * 1.3 + aBird * 2.0) * 0.5 + sin(aBird * 1.7) * 1.4, sin(a) * rad);
        vec3 fwd = vec3(-sin(a), 0.0, cos(a));
        vec3 right = vec3(cos(a), 0.0, sin(a));
        vec3 p = position;
        float flap = sin(uTime * 9.0 + aBird * 1.9);
        if (aWing != 0.0) p.y += abs(p.x) * flap * 0.9;
        vec3 wp = c + right * p.x + vec3(0.0, p.y, 0.0) + fwd * p.z;
        vShade = aWing == 0.0 ? 1.0 : 0.82 + 0.18 * flap;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vShade;
      void main() {
        gl_FragColor = vec4(vec3(0.99, 0.97, 0.93) * vShade, 1.0);
        #include <fog_fragment>
      }`,
  });
  disposers.push(() => mat.dispose());
  const pos: number[] = [];
  const bird: number[] = [];
  const wing: number[] = [];
  const tri = (a: number[], b: number[], c: number[], id: number, w: number) => {
    pos.push(...a, ...b, ...c);
    bird.push(id, id, id);
    wing.push(w, w, w);
  };
  for (let i = 0; i < count; i++) {
    const s = 0.9 + (i % 3) * 0.1;
    // Body: two triangles stacked into a diamond; wings: one on each side, rooted beside the body
    tri([0, 0, 0.32 * s], [-0.08 * s, 0.06 * s, -0.12 * s], [0.08 * s, 0.06 * s, -0.12 * s], i, 0);
    tri([0, 0, 0.32 * s], [0.08 * s, -0.04 * s, -0.12 * s], [-0.08 * s, -0.04 * s, -0.12 * s], i, 0);
    tri([-0.05 * s, 0.03 * s, 0.1 * s], [-0.72 * s, 0.04 * s, -0.16 * s], [-0.05 * s, 0.03 * s, -0.12 * s], i, -1);
    tri([0.05 * s, 0.03 * s, 0.1 * s], [0.05 * s, 0.03 * s, -0.12 * s], [0.72 * s, 0.04 * s, -0.16 * s], i, 1);
    tri([0, 0.02 * s, -0.12 * s], [-0.1 * s, 0.02 * s, -0.3 * s], [0.1 * s, 0.02 * s, -0.3 * s], i, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBird', new THREE.Float32BufferAttribute(bird, 1));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  group.add(mesh);
  return mat;
}

export const holy: RegionModule = {
  palette: {
    sky: ['#3d78cc', '#e6b468', '#f5d6a2'],
    fog: 0xdcb98a,
    fogNear: 60,
    fogFar: 210,
    ground: ['#bfb096', '#a3957a', '#ffd060'],
    light: [0.45, 0.85, 0.3],
    ambient: 0xa094b0,
    rim: 0xffe9c2,
    shadow: 0x7864a4,
    motes: [0xfff0b0, 0xffffff, 0xffd86a],
    moteKind: 'fall',
    moteAtlas: [3, 0.55],
  },
  build(ctx) {
    const { b, r, ringPos, extras, far, group } = ctx;
    // The "distant ground" outside the platform becomes a sea of clouds; the platform edge is a ring of stone wall with a gold border
    far.visible = false;
    b.add(new THREE.CylinderGeometry(34, 32.5, 5, 64, 1, true), C.stoneDark, M(0, -2.5, 0), false);
    b.add(new THREE.TorusGeometry(34, 0.3, 6, 64), C.gold, M(0, 0, 0, 0, 1, Math.PI / 2), false);

    // Stairs and terrace: the battle area is the lowest level, and two steps outward climb to the terrace
    const flat = (r0: number, r1: number, y: number, col: number) => {
      const g = new THREE.RingGeometry(r0, r1, 64, 1);
      b.add(g, col, M(0, y, 0, 0, 1, -Math.PI / 2), false);
    };
    const riser = (rad: number, y0: number, y1: number) => b.add(new THREE.CylinderGeometry(rad, rad, y1 - y0, 64, 1, true), C.stoneDark, M(0, (y0 + y1) / 2, 0), false);
    riser(9.6, 0, 0.17);
    flat(9.6, 10.4, 0.17, C.stone);
    riser(10.4, 0.17, 0.34);
    flat(10.4, 11.2, 0.34, C.stone);
    riser(11.2, 0.34, TY);
    flat(11.2, 34, TY, C.stone);
    // Gold inlay: a ring at the edge of the battle area and eight rays of sunlight; a ring at the terrace edge
    b.glow(new THREE.TorusGeometry(9.5, 0.035, 4, 96), C.glow, M(0, 0.02, 0, 0, 1, Math.PI / 2));
    b.glow(new THREE.TorusGeometry(11.25, 0.035, 4, 96), C.glow, M(0, TY + 0.02, 0, 0, 1, Math.PI / 2));
    for (let i = 0; i < 8; i++) b.glow(new THREE.BoxGeometry(2.0, 0.02, 0.12), C.glow, M(Math.cos((i / 8) * Math.PI * 2) * 8.3, 0.015, Math.sin((i / 8) * Math.PI * 2) * 8.3, -(i / 8) * Math.PI * 2));
    // Railing at the outer edge of the terrace
    b.add(new THREE.TorusGeometry(32.5, 0.12, 6, 96), C.stone, M(0, TY + 1.0, 0, 0, 1, Math.PI / 2), false);
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      b.add(new THREE.BoxGeometry(0.28, 0.9, 0.28), C.stone, M(Math.cos(a) * 32.5, TY + 0.45, Math.sin(a) * 32.5, -a), false);
    }

    // Colonnade: two arc-shaped colonnades at left and right at the back (the middle is left open for the cathedral), each with a continuous entablature; two free-standing pillars at the front left and right
    const R = 15;
    const arcs: number[][] = [[], []];
    for (let i = 0; i < 5; i++) {
      arcs[0]!.push(Math.PI + 0.22 + i * 0.2);
      arcs[1]!.push(Math.PI * 2 - 0.22 - i * 0.2);
    }
    for (const arc of arcs) {
      for (let i = 0; i < arc.length; i++) {
        const a = arc[i]!;
        column(b, Math.cos(a) * R, Math.sin(a) * R, 6, -a);
        if (i > 0) {
          const a0 = arc[i - 1]!;
          const mx = (Math.cos(a0) + Math.cos(a)) * R * 0.5;
          const mz = (Math.sin(a0) + Math.sin(a)) * R * 0.5;
          const len = Math.hypot(Math.cos(a0) - Math.cos(a), Math.sin(a0) - Math.sin(a)) * R;
          const ry = -Math.atan2(Math.sin(a) - Math.sin(a0), Math.cos(a) - Math.cos(a0));
          b.add(new THREE.BoxGeometry(len + 0.6, 0.6, 1.2), C.stone, M(mx, TY + 7.5, mz, ry));
          b.add(new THREE.BoxGeometry(len + 0.6, 0.25, 1.5), C.stoneDark, M(mx, TY + 7.9, mz, ry));
          b.add(new THREE.BoxGeometry(len - 0.4, 0.5, 0.2), C.gold, M(mx, TY + 7.2, mz, ry));
        }
      }
    }
    for (const a of [0.32, 0.78, 2.95, 3.35]) column(b, Math.cos(a) * R, Math.sin(a) * R, 6, -a);
    // Cypresses and gold-edged flowerpots behind the colonnade
    for (let i = 0; i < 10; i++) {
      const [x, z] = ringPos(19, 27);
      // Do not plant them on the cathedral's stairs or the bell tower
      if ((z < -17 && Math.abs(x - 5) < 15) || Math.hypot(x + 14, z + 26) < 5.5) continue;
      b.add(new THREE.CylinderGeometry(0.7, 0.55, 0.8, 8), C.planter, M(x, TY + 0.4, z));
      b.add(new THREE.TorusGeometry(0.7, 0.07, 6, 12), C.gold, M(x, TY + 0.8, z, 0, 1, Math.PI / 2), false);
      const h = 3.5 + r() * 1.5;
      b.add(new THREE.ConeGeometry(0.75, h, 7), C.cypress, M(x, TY + 0.8 + h / 2, z, r() * 6));
    }

    // Landmarks: the cathedral is directly behind and to the right, the bell tower at the left rear
    cathedral(b, 5, -32);
    belfry(ctx, -14, -26);

    // Cloud clumps around the platform (hiding the platform edge in the clouds), cloud mountains and a cloud-city silhouette in the distance
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.1;
      const d = 33 + r() * 16;
      const s = 4 + r() * 5;
      b.add(new THREE.IcosahedronGeometry(1, 1), C.cloud, MS(Math.cos(a) * d, -2.5 + r() * 2, Math.sin(a) * d, s * (0.9 + r() * 0.5), s * 0.45, s * (0.9 + r() * 0.5), r() * 6));
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2;
      const d = 70 + r() * 45;
      const s = 12 + r() * 12;
      b.add(new THREE.IcosahedronGeometry(1, 1), C.cloudFar, MS(Math.cos(a) * d, -6 + r() * 4, Math.sin(a) * d, s * (0.9 + r() * 0.6), s * 0.4, s * (0.9 + r() * 0.6), r() * 6), false);
    }
    for (let k = 0; k < 4; k++) {
      const a = Math.PI + 0.35 + k * 0.85 + r() * 0.2;
      const d = 105 + r() * 30;
      const cx = Math.cos(a) * d;
      const cz = Math.sin(a) * d;
      for (let i = 0; i < 6; i++) {
        const w = 3 + r() * 4;
        const h = 8 + r() * 18;
        const ox = (r() - 0.5) * 22;
        const oz = (r() - 0.5) * 22;
        b.add(new THREE.BoxGeometry(w, h, w), C.city, M(cx + ox, h / 2 - 3, cz + oz), false);
        b.add(new THREE.ConeGeometry(w * 0.75, w * 1.3, 4), C.city, M(cx + ox, h - 3 + w * 0.65, cz + oz, Math.PI / 4), false);
      }
    }
    // Rising sun: a glowing orb on the horizon (bloom spreads it out)
    const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.9), toneMapped: false, fog: false });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 12), sunMat);
    sun.position.set(-34, 9, -166);
    group.add(sun);
    ctx.disposers.push(() => sunMat.dispose());

    const sea = buildCloudSea(ctx);
    const shafts = buildLightShafts(ctx, [
      [-19, -17],
      [21, -15],
      [-27, 7],
      [29, 5],
      [12, -46],
    ]);
    // The dove flock circles the whole plaza: radius 17 passes exactly in front of the cathedral's front and over the colonnade
    const doves = buildDoves(ctx, new THREE.Vector3(0, 10.5, -6), 17, 9);

    let sparkT = 0;
    extras.push((dt, t, vfx) => {
      sea.uniforms.uTime.value = t;
      shafts.uniforms.uTime.value = t;
      doves.uniforms.uTime.value = t;
      // Where the light pillars land, and an occasional star-burst flash in the air
      sparkT += dt;
      while (sparkT > 0.3) {
        sparkT -= 0.3;
        const a = Math.random() * Math.PI * 2;
        const d = 8 + Math.random() * 24;
        vfx.emit({ pos: new THREE.Vector3(Math.cos(a) * d, 0.6 + Math.random() * 5, Math.sin(a) * d), count: 1, color: [0xfff0b0, 0xffffff], speed: [0.1, 0.4], life: [0.5, 0.9], size: [0.12, 0.22], atlas: 1, intensity: 2.2 });
      }
    });
  },
};
