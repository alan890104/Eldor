// Shaders for the prologue animation: the sky vault (stars, cracks, glow), the ground (daytime rivers of light / night Void Blight fissures),
// the Heart of the World (faceted crystal, pulse, wound), the Star Gate's door, the Void Blight's wound and torrent, and the sacred spirits' light pillars.

import * as THREE from 'three';

/** Shared noise functions (value noise + fbm; OCT sets the number of octaves via defines) */
const NOISE = /* glsl */ `
  float phash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float phash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 phash22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  float pnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(phash(i), phash(i + vec3(1, 0, 0)), u.x), mix(phash(i + vec3(0, 1, 0)), phash(i + vec3(1, 1, 0)), u.x), u.y),
               mix(mix(phash(i + vec3(0, 0, 1)), phash(i + vec3(1, 0, 1)), u.x), mix(phash(i + vec3(0, 1, 1)), phash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < OCT; i++) { v += pnoise(p) * a; p = p * 2.07 + 11.3; a *= 0.5; }
    return v;
  }
  /** Voronoi border distance (for cracks) */
  float vedge(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = phash22(i + g);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return d2 - d1;
  }
`;

const std = (o: { uniforms: Record<string, THREE.IUniform>; vert: string; frag: string; low: boolean; transparent?: boolean; blending?: THREE.Blending; side?: THREE.Side; depthWrite?: boolean }) =>
  new THREE.ShaderMaterial({
    uniforms: o.uniforms,
    vertexShader: o.vert,
    fragmentShader: o.frag,
    defines: { OCT: o.low ? 2 : 4 },
    transparent: o.transparent ?? false,
    blending: o.blending ?? THREE.NormalBlending,
    side: o.side ?? THREE.FrontSide,
    depthWrite: o.depthWrite ?? !(o.transparent ?? false),
    toneMapped: false,
  });

const WORLD_VERT = /* glsl */ `
  varying vec3 vWorld; varying vec3 vN; varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// ───────────────────────── Sky vault ─────────────────────────

export function skyMaterial(low: boolean): THREE.ShaderMaterial {
  return std({
    low,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x06061a) },
      uMid: { value: new THREE.Color(0x1a1440) },
      uBot: { value: new THREE.Color(0x2a1a50) },
      uStars: { value: 1 },
      uNebula: { value: 0.6 },
      uTime: { value: 0 },
      uGlow: { value: new THREE.Color(0xff9ad0) },
      uGlowAmt: { value: 0 },
      uGlowDir: { value: new THREE.Vector3(0, 1, 0) },
      /** Cracks in the sky (0 to 1): spreading outward from the direction of uGlowDir */
      uCrack: { value: 0 },
      uCrackCol: { value: new THREE.Color(0xd070ff) },
      uSmoke: { value: 0 },
      uClouds: { value: 0 },
    },
    vert: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    frag: /* glsl */ `
      uniform vec3 uTop, uMid, uBot, uGlow, uGlowDir, uCrackCol;
      uniform float uStars, uNebula, uTime, uGlowAmt, uCrack, uSmoke, uClouds;
      varying vec3 vDir;
      ${NOISE}
      float starLayer(vec2 sp, float thresh, float t) {
        vec2 id = floor(sp);
        vec2 f = fract(sp) - 0.5;
        float r = phash2(id);
        vec2 off = (phash22(id + 7.0) - 0.5) * 0.8;
        float d = length(f - off);
        float s = smoothstep(0.09, 0.0, d) * step(thresh, r);
        float tw = 0.55 + 0.45 * sin(t * (1.0 + r * 3.0) + r * 40.0);
        return s * tw;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uBot, uMid, smoothstep(-0.08, 0.28, h));
        col = mix(col, uTop, smoothstep(0.28, 0.85, h));
        // Nebula
        float n = fbm(d * 2.6 + vec3(0.0, uTime * 0.01, 0.0));
        float n2 = fbm(d * 5.0 - vec3(uTime * 0.006));
        vec3 neb = mix(vec3(0.28, 0.1, 0.5), vec3(0.08, 0.32, 0.5), n2);
        col += neb * smoothstep(0.38, 0.78, n) * uNebula;
        // Stars (two density layers)
        vec2 sp = vec2(atan(d.z, d.x) * 34.0, d.y * 52.0);
        float st = starLayer(sp, 0.78, uTime) + starLayer(sp * 2.3 + 40.0, 0.86, uTime) * 0.6;
        col += st * uStars * mix(vec3(1.0), vec3(0.72, 0.85, 1.0), n2) * 1.3 * smoothstep(-0.05, 0.15, h);
        // Black smoke: purple-black billowing near the horizon
        float sm = fbm(vec3(d.xz * 4.0, uTime * 0.05)) * smoothstep(0.55, -0.1, h);
        col = mix(col, vec3(0.05, 0.01, 0.08), sm * uSmoke);
        // Daytime clouds: noise projected onto the zenith plane, with a warm rim on the side toward the sun
        if (uClouds > 0.0 && h > 0.0) {
          vec2 cp = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.01, 0.0);
          float cl = smoothstep(0.42, 0.68, fbm(vec3(cp, 7.0)));
          float sunSide = pow(max(0.0, dot(d, normalize(uGlowDir))), 3.0);
          vec3 cc = mix(vec3(1.0, 0.95, 0.9), vec3(1.0, 0.78, 0.55), sunSide);
          col = mix(col, cc, cl * uClouds * 0.75 * smoothstep(0.0, 0.12, h));
        }
        // Glow in one direction (heart, dawn)
        float g = pow(max(0.0, dot(d, normalize(uGlowDir))), 9.0);
        col += uGlow * g * uGlowAmt;
        // Cracks: Voronoi borders centered on the glow direction, only within the range of uCrack
        if (uCrack > 0.0) {
          float ang = acos(clamp(dot(d, normalize(uGlowDir)), -1.0, 1.0));
          vec3 up = abs(uGlowDir.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          vec3 tx = normalize(cross(normalize(uGlowDir), up));
          vec3 ty = cross(normalize(uGlowDir), tx);
          vec2 cp = vec2(dot(d, tx), dot(d, ty)) * 14.0;
          float e = vedge(cp + 0.5);
          float reach = smoothstep(uCrack * 1.4, uCrack * 1.4 - 0.5, ang);
          float line = smoothstep(0.014, 0.0, e) * reach;
          col += uCrackCol * line * 1.4;
          col = mix(col, vec3(0.0), smoothstep(0.006, 0.0, e) * reach * 0.7);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ───────────────────────── Ground ─────────────────────────

/** Ground: vertex color is the base color, uDay chooses day / night; uRivers draws the flowing rivers of light; uCracks draws the purple-glowing Void Blight fissures */
export function groundMaterial(low: boolean): THREE.ShaderMaterial {
  const m = std({
    low,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uDay: { value: 0 },
      uRivers: { value: 0 },
      uCracks: { value: 0 },
      uBlight: { value: 0 },
      uNightCol: { value: new THREE.Color(0x0c0a24) },
      uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
      uCamPos: { value: new THREE.Vector3() },
      uHorizon: { value: new THREE.Color(0x1a1440) },
      uEdge: { value: 90 },
      uLit: { value: new THREE.Vector4(0, 0, 0, 0) },
      uLitCol: { value: new THREE.Color(0xffd080) },
      /** Radius of the local warm light */
      uLitR: { value: 12 },
      /** Black stain of the Void Blight: xyz center, w radius (a ring of purple light at the edge pushes outward) */
      uStain: { value: new THREE.Vector4(0, 0, 0, 0) },
      /** Veins glowing along the streets inside the black stain (0 = off) */
      uVeins: { value: 0 },
      /** Start and end distance at which the far view melts into the horizon */
      uFog: { value: new THREE.Vector2(45, 140) },
    },
    vert: /* glsl */ `
      varying vec3 vWorld; varying vec3 vN; varying vec3 vCol;
      void main() {
        vCol = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    frag: /* glsl */ `
      uniform float uTime, uDay, uRivers, uCracks, uBlight, uEdge, uVeins;
      uniform vec3 uNightCol, uLightDir, uCamPos, uHorizon, uLitCol;
      uniform vec4 uLit, uStain;
      uniform vec2 uFog;
      uniform float uLitR;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vCol;
      ${NOISE}
      vec3 palette(float k) { return 0.55 + 0.45 * cos(6.2831 * (k + vec3(0.0, 0.33, 0.67))); }
      void main() {
        vec2 p = vWorld.xz;
        float lam = max(0.0, dot(normalize(vN), uLightDir));
        float shade = mix(0.55, 1.0, smoothstep(0.2, 0.7, lam));
        vec3 day = vCol * shade;
        // Daytime grass is not one flat fill: large light and dark patches, plus small flowers nearby
        float patchy = fbm(vec3(p * 0.09, 2.0));
        day *= mix(0.72, 1.06, patchy);
        float near = smoothstep(20.0, 5.0, length(vWorld - cameraPosition));
        vec2 fc = floor(p * 3.2);
        float fl = step(0.975, phash2(fc)) * smoothstep(0.2, 0.1, length(fract(p * 3.2) - 0.5));
        day = mix(day, palette(phash2(fc + 7.0) * 0.4 + 0.05) * 1.05, fl * near * 0.75);
        vec3 night = uNightCol * mix(0.6, 1.1, lam);
        vec3 col = mix(night, day, uDay);
        // River of light: two sets of bright lines meandering with noise, with color changing along the line
        if (uRivers > 0.0) {
          float flow = fbm(vec3(p * 0.022, 3.0));
          float b1 = sin(p.x * 0.10 + p.y * 0.04 + flow * 11.0 - uTime * 0.04);
          float b2 = sin(p.y * 0.085 - p.x * 0.05 + flow * 8.0 + uTime * 0.03 + 2.0);
          float l1 = smoothstep(0.982, 0.997, b1);
          float l2 = smoothstep(0.986, 0.998, b2);
          float halo = smoothstep(0.9, 0.99, b1) * 0.16 + smoothstep(0.93, 0.99, b2) * 0.12;
          // The bright streaks on the river surface follow the flow direction
          float ripple = 0.8 + 0.2 * sin(p.x * 0.9 + p.y * 0.4 - uTime * 3.0 + flow * 20.0);
          vec3 c1 = palette(flow * 1.5 + uTime * 0.03);
          vec3 c2 = palette(flow * 1.5 + 0.5 - uTime * 0.02);
          col = mix(col, c1 * 1.15 * ripple, l1 * uRivers);
          col = mix(col, c2 * 1.1 * ripple, l2 * uRivers);
          col += (c1 * halo + c2 * halo * 0.6) * uRivers;
        }
        // Void Blight cracks: Voronoi borders glow purple while the surrounding ground is eaten black by dark mist
        if (uCracks > 0.0) {
          float e = vedge(p * 0.16);
          float wob = fbm(vec3(p * 0.3, uTime * 0.2));
          float mask = smoothstep(0.35, 0.8, fbm(vec3(p * 0.05, 9.0)) + uCracks * 0.5) * uCracks;
          float line = smoothstep(0.06 + wob * 0.03, 0.0, e) * mask;
          float pulse = 0.7 + 0.3 * sin(uTime * 2.5 + wob * 6.0);
          col = mix(col, vec3(0.02, 0.0, 0.04), mask * uBlight * 0.8);
          col += vec3(0.75, 0.15, 1.0) * line * 1.8 * pulse;
          col += vec3(1.0, 0.3, 0.9) * smoothstep(0.02, 0.0, e) * mask * pulse;
        }
        // Local warm light (the dragon beneath the gate, lanterns)
        if (uLit.w > 0.0) {
          float d = length(vWorld - uLit.xyz);
          col += uLitCol * uLit.w * smoothstep(uLitR, 0.0, d);
        }
        if (uStain.w > 0.0) {
          float d = length(vWorld.xz - uStain.xz);
          float edge = uStain.w + (fbm(vec3(vWorld.xz * 0.22, uTime * 0.4)) - 0.5) * 5.0;
          float inside = smoothstep(edge, edge - 1.8, d);
          col = mix(col, vec3(0.015, 0.0, 0.03), inside * mix(0.94, 0.8, uVeins));
          // Veins of the Void Blight: purple light along the streets between the towers, flowing outward in waves
          if (uVeins > 0.0) {
            vec2 wq = vWorld.xz * 0.22 + (fbm(vec3(vWorld.xz * 0.12, 4.0)) - 0.5) * 1.2;
            float ve = vedge(wq);
            float vein = smoothstep(0.09, 0.0, ve);
            float core = smoothstep(0.025, 0.0, ve);
            float wave = 0.5 + 0.5 * sin(d * 1.1 - uTime * 7.0);
            float reach = smoothstep(edge + 0.5, edge - 3.0, d);
            col += (vec3(0.62, 0.12, 1.0) * vein * 1.1 + vec3(1.0, 0.45, 1.0) * core * 0.9) * (0.45 + 0.75 * wave) * reach * uVeins;
          }
          float rim = smoothstep(edge + 0.9, edge, d) * (1.0 - smoothstep(edge, edge - 1.6, d));
          col += vec3(0.65, 0.12, 1.0) * rim * 1.1;
        }
        // Distance blends into the horizon
        float dist = length(vWorld - uCamPos);
        col = mix(col, uHorizon, smoothstep(uFog.x, uFog.y, dist));
        float r = length(p);
        float alpha = smoothstep(uEdge, uEdge - 10.0, r);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  m.vertexColors = true;
  return m;
}

// ───────────────────────── Heart of the World ─────────────────────────

export function heartMaterial(low: boolean): THREE.ShaderMaterial {
  return std({
    low,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uColor: { value: new THREE.Color(0xd8487e) },
      uInner: { value: new THREE.Color(0xff5aa8) },
      uRim: { value: new THREE.Color(0xffb8dc) },
      uPulse: { value: 0 },
      uCrack: { value: 0 },
      uAlpha: { value: 1 },
      uTime: { value: 0 },
      /** Position of the wound (object space) and its extent */
      uWound: { value: new THREE.Vector4(0, 0, 1, 0) },
    },
    vert: /* glsl */ `
      varying vec3 vWorld; varying vec3 vObj;
      void main() { vObj = position; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    frag: /* glsl */ `
      uniform vec3 uColor, uInner, uRim; uniform float uPulse, uCrack, uAlpha, uTime; uniform vec4 uWound;
      varying vec3 vWorld; varying vec3 vObj;
      ${NOISE}
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(max(1.0 - max(0.0, dot(n, v)), 0.0), 2.2);
        float lam = 0.5 + 0.5 * dot(n, normalize(vec3(0.3, 0.8, 0.5)));
        float inner = 1.0 - smoothstep(0.0, 1.0, length(vObj * vec3(1.0, 0.62, 1.0)));
        // Slowly flowing texture inside, as if something is breathing within
        float veins = fbm(vec3(vObj * 2.2 + vec3(0.0, uTime * 0.15, 0.0)));
        vec3 col = uColor * (0.22 + 0.5 * lam) * (0.7 + veins * 0.45);
        col += uInner * inner * (0.55 + uPulse * 2.4);
        // Veins in the crystal that light up with the heartbeat
        col += uInner * smoothstep(0.56, 0.7, veins) * (0.25 + uPulse * 0.9);
        col += uRim * fres * (0.55 + uPulse * 1.1);
        // Wound: purple-black cracks spreading outward from uWound
        if (uCrack > 0.0) {
          float d = length(vObj - uWound.xyz);
          float reach = smoothstep(uCrack * 3.2, uCrack * 3.2 - 0.8, d);
          float e = vedge(vObj.xy * 5.0 + vObj.z * 3.0);
          float line = smoothstep(0.025, 0.0, e) * reach;
          col = mix(col, vec3(0.03, 0.0, 0.06), line * 0.95);
          col += vec3(0.7, 0.15, 1.0) * smoothstep(0.06, 0.015, e) * reach * 0.6;
          col = mix(col, vec3(0.08, 0.0, 0.12), smoothstep(uWound.w, 0.0, d) * step(0.001, uWound.w));
        }
        gl_FragColor = vec4(col, uAlpha);
      }
    `,
  });
}

// ───────────────────────── Door, wound ─────────────────────────

/** The Star Gate's door: a vortex sea of stars, uOpen sets brightness and transparency */
export function portalMaterial(low: boolean): THREE.ShaderMaterial {
  return std({
    low,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      uOpen: { value: 0 },
      uTime: { value: 0 },
      /** Progress of the gate ring igniting: 0 fully dark, burning up both sides from the bottom, 1 the whole ring lit */
      uIgnite: { value: 1 },
      /** How bright the gate ring's halo is on its own while the door is not yet open */
      uRim: { value: 0 },
      uColA: { value: new THREE.Color(0x3a2a9a) },
      uColB: { value: new THREE.Color(0x8fd8ff) },
    },
    vert: WORLD_VERT,
    frag: /* glsl */ `
      uniform float uOpen, uTime, uIgnite, uRim; uniform vec3 uColA, uColB; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float sw = fbm(vec3(r * 3.0 - uTime * 0.6, a * 1.5 + r * 5.0 - uTime * 0.4, 1.0));
        // Deep blue base; only the spiral arms of the vortex are bright; the center is darkened so the whole gate does not turn into one white block
        vec3 deep = vec3(0.015, 0.03, 0.12);
        vec3 col = mix(deep, mix(uColA, uColB, sw), smoothstep(0.38, 0.8, sw)) * (0.45 + sw * 0.7);
        col *= mix(0.4, 1.0, smoothstep(0.0, 0.85, r));
        vec2 id = floor(p * 9.0); vec2 f = fract(p * 9.0) - 0.5;
        float rr = phash2(id);
        float st = smoothstep(0.12, 0.0, length(f - (phash22(id) - 0.5) * 0.6)) * step(0.8, rr) * (0.5 + 0.5 * sin(uTime * 3.0 + rr * 30.0));
        col += vec3(0.8, 0.9, 1.0) * st * 0.7;
        // Gate ring: blue inside, gold outside, burning up from the bottom into a full ring
        float ab = abs(atan(p.x, -p.y)) / 3.14159;
        float lit = 1.0 - smoothstep(uIgnite - 0.05, uIgnite + 0.01, ab);
        float front = exp(-abs(ab - uIgnite) * 30.0) * step(uIgnite, 0.999) * step(0.001, uIgnite);
        // The inner edge of the stone ring is at about r≈0.94, and the two halos sit inside it: gold outside, blue inside
        float rimGold = smoothstep(0.84, 0.895, r) * smoothstep(0.945, 0.905, r);
        float rimBlue = smoothstep(0.7, 0.83, r) * smoothstep(0.9, 0.85, r);
        col += vec3(0.3, 0.65, 1.3) * rimBlue * 0.7 * lit;
        col += vec3(1.6, 1.05, 0.35) * rimGold * (0.85 * lit + front * 2.0);
        float disk = smoothstep(1.0, 0.9, r);
        float open = smoothstep(0.0, 1.0, uOpen);
        gl_FragColor = vec4(col * (0.35 + max(open, uRim) * 0.7), disk * max(open, (rimGold + rimBlue) * max(front, uRim)));
      }
    `,
  });
}

/** The Void Blight's wound: a black hole with a trembling purple-red edge (normal blending, which blacks out what is behind) */
export function voidMaterial(low: boolean): THREE.ShaderMaterial {
  return std({
    low,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vert: WORLD_VERT,
    frag: /* glsl */ `
      uniform float uTime, uOpen; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float edge = uOpen * (0.55 + 0.3 * fbm(vec3(a * 1.3, uTime * 0.8, 2.0)));
        float inside = smoothstep(edge + 0.06, edge - 0.04, r);
        float rim = smoothstep(edge + 0.16, edge, r) * (1.0 - smoothstep(edge, edge - 0.14, r));
        vec3 col = vec3(0.85, 0.2, 1.0) * rim * 1.7 + vec3(1.0, 0.15, 0.5) * pow(rim, 3.0) * 1.5;
        col *= 1.0 - inside;
        float alpha = max(inside, rim) * smoothstep(0.0, 0.15, uOpen);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

/** Additive glow (for billboard light streaks and halos) */
export function glowMat(color: THREE.ColorRepresentation, map: THREE.Texture | null, intensity = 2): THREE.MeshBasicMaterial {
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

/** Golden shield: a hemisphere glowing only at the edge (Fresnel), uAmt controls the strength */
export function shieldMaterial(color: THREE.ColorRepresentation = 0xffd070): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmt: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmt, uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.6);
        float hex = 0.5 + 0.5 * sin(vP.x * 9.0 + uTime * 2.0) * sin(vP.y * 9.0 - uTime * 1.3) * sin(vP.z * 9.0);
        float a = (f * 1.1 + 0.05 + hex * 0.06) * uAmt;
        gl_FragColor = vec4(uColor * (1.2 + f * 1.5), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * The Void Blight's torrent: a tube along a curve, black-purple, with a purple-glowing edge and a surface texture scrolling along the flow.
 * uGrow (0 to 1) sets how far the torrent has flowed from its start; normal blending, which darkens what is behind.
 */
export function torrentMaterial(low: boolean): THREE.ShaderMaterial {
  return std({
    low,
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uGrow: { value: 1 }, uAlpha: { value: 1 }, uEdge: { value: new THREE.Color(0x9a40ff) } },
    vert: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        // The surface undulates along the flow so it does not look like a plastic tube
        float w = sin(uv.x * 38.0 - uTime * 9.0 + uv.y * 6.2831) * 0.5 + sin(uv.x * 17.0 - uTime * 5.0) * 0.5;
        vec3 p = position + normal * w * 0.12;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    frag: /* glsl */ `
      uniform float uTime, uGrow, uAlpha; uniform vec3 uEdge;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      ${NOISE}
      void main() {
        float along = vUv.x;
        if (along > uGrow) discard;
        float n = fbm(vec3(along * 7.0 - uTime * 2.4, vUv.y * 5.0, uTime * 0.25));
        float fres = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.2);
        vec3 col = vec3(0.02, 0.0, 0.035) * (0.6 + n);
        col += uEdge * pow(fres, 1.6) * (0.12 + n * 0.3);
        col += uEdge * smoothstep(0.66, 0.78, n) * 0.3;
        float head = smoothstep(uGrow, uGrow - 0.06, along);
        float a = uAlpha * head * smoothstep(0.0, 0.04, along) * mix(0.72, 1.0, n);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
}

/** Soft light pillar (a sacred spirit catching a source crystal): bright in the center, pale at the edge, fading out toward the top; additive blending, with the brightness cap controlled by uAmt (≤0.9) */
export function pillarMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmt: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmt; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(f, 3.0);
        float fade = smoothstep(0.0, 0.04, vUv.y) * pow(max(1.0 - vUv.y, 0.0), 1.6);
        gl_FragColor = vec4(uColor * (0.25 + core * 0.65) * uAmt * fade, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
