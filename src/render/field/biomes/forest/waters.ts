// Waters: the stream on the plateau (its own flowing-water mesh), the Moss Falls dropping from the cliff (the water curtain,
// white foam on the pool, mist and a rainbow), morning mist over the lake and stream, reeds, water lilies, rocks on the banks,
// and the stepping stones at the shallow ford.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import { V, softDiscTex } from '../../../arenas/_woods.ts';
import { smooth } from '../../compose.ts';
import type { FieldCtx } from '../../kit.ts';
import { LAKE, lakeE, LIP, POOL, STREAM, UP_WL, UPSTREAM, WL, streamAt } from './geo.ts';
import { COL, mossRockAt, put } from './plants.ts';

const NOISE = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.7) * 0.3 + vnoise(p * 4.3 + 9.1) * 0.2; }
`;

/** Stream on the plateau: a ribbon mesh along the centerline, vertices carry water depth, flow stripes scroll downstream */
function upperStream(ctx: FieldCtx): THREE.Vector3 {
  const curve = new THREE.CatmullRomCurve3(UPSTREAM.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const n = Math.round(curve.getLength());
  const pos: number[] = [];
  const uv: number[] = [];
  const depth: number[] = [];
  const idx: number[] = [];
  const cols = 7;
  let along = 0;
  let prev: THREE.Vector3 | null = null;
  let rows = 0;
  let end = V(LIP[0], UP_WL, LIP[1]);
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    if (p.z > LIP[1]) break;
    const t = curve.getTangentAt(i / n);
    if (prev) along += p.distanceTo(prev);
    prev = p;
    let hw = 4;
    {
      // Interpolate the half-width along the centerline
      let best = 1e9;
      for (const [x, z, w] of UPSTREAM) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < best) {
          best = d;
          hw = w + 1.6;
        }
      }
    }
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1) - 0.5;
      const x = p.x - t.z * u * hw * 2;
      const z = p.z + t.x * u * hw * 2;
      pos.push(x, UP_WL, z);
      uv.push(u + 0.5, along);
      depth.push(UP_WL - ctx.h(x, z));
    }
    rows++;
    end = V(p.x, UP_WL, p.z);
  }
  for (let rI = 0; rI + 1 < rows; rI++) {
    for (let c = 0; c + 1 < cols; c++) {
      const a = rI * cols + c;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aDepth; varying float vDepth; varying vec2 vUv; varying vec3 vW;
      void main() {
        vDepth = aDepth; vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying float vDepth; varying vec2 vUv; varying vec3 vW;
      ${NOISE}
      void main() {
        float d = max(vDepth, 0.0);
        vec3 col = mix(vec3(0.55, 0.88, 0.8), vec3(0.16, 0.45, 0.5), smoothstep(0.1, 1.4, d));
        // Streaks flowing downstream
        float flow = fbm(vec2(vUv.x * 5.0, vUv.y * 0.5 - uTime * 1.4));
        float streak = smoothstep(0.62, 0.8, flow);
        col += streak * 0.28;
        float foam = 1.0 - smoothstep(0.05, 0.45, d);
        col = mix(col, vec3(0.95, 1.0, 0.97), foam * 0.8);
        gl_FragColor = vec4(col, mix(0.78, 0.92, smoothstep(0.2, 1.0, d)));
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 2;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
  });
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
  return end;
}

/** Waterfall curtain: a mesh falling in a parabola, stripes flowing down, edges and top fading, the bottom turning to foam */
function waterfall(ctx: FieldCtx, lip: THREE.Vector3): void {
  const dir = V(-0.08, 0, 1).normalize();
  const side = V(dir.z, 0, -dir.x);
  const W = 5.6;
  const top = lip.y;
  const drop = top - (WL - 0.4);
  const cols = 10;
  const rows = 22;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const out = 0.4 + 5.2 * t;
    const y = top + 0.15 - drop * t * t;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols - 0.5;
      // The lower half spreads out a little
      const spread = 1 + t * 0.25;
      const p = lip.clone().addScaledVector(dir, out).addScaledVector(side, u * W * spread);
      pos.push(p.x, y, p.z);
      uv.push(u + 0.5, t);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main() {
        float streak = fbm(vec2(vUv.x * 9.0, vUv.y * 2.2 - uTime * 2.6));
        float streak2 = vnoise(vec2(vUv.x * 23.0, vUv.y * 5.0 - uTime * 4.0));
        vec3 col = mix(vec3(0.62, 0.9, 0.9), vec3(1.0), smoothstep(0.35, 0.75, streak) * 0.8 + streak2 * 0.25);
        col = mix(col, vec3(1.0), smoothstep(0.7, 1.0, vUv.y));
        float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        float a = edge * (0.62 + 0.3 * streak) * smoothstep(0.0, 0.04, vUv.y);
        gl_FragColor = vec4(col * 1.08, a);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 5;
  ctx.group.add(mesh);

  // Foam on the pool: a ring of tumbling foam where the water lands
  const foamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float n = fbm(p * 7.0 + vec2(0.0, -uTime * 0.9)) * 0.7 + fbm(p * 15.0 - vec2(uTime * 0.6, 0.0)) * 0.3;
        float a = smoothstep(1.0, 0.25, r) * smoothstep(0.35, 0.6, n + (1.0 - r) * 0.35);
        gl_FragColor = vec4(vec3(0.96, 1.0, 0.98), a * 0.9);
      }`,
  });
  const splash = lip.clone().addScaledVector(dir, 5.6);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(splash.x, WL + 0.04, splash.z - 0.5);
  foam.renderOrder = 4;
  ctx.group.add(foam);

  // Mist: several clumps of fog made of soft discs, slowly rising and falling
  const mistTex = softDiscTex();
  const mistMat = new THREE.MeshBasicMaterial({ map: mistTex, color: 0xf4fffa, transparent: true, opacity: 0.5, depthWrite: false, fog: true });
  const mists: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mistMat);
    const s = 5 + i * 0.9;
    m.scale.setScalar(s);
    m.position.set(splash.x + (i - 2.5) * 1.3, WL + 1.2 + (i % 3) * 1.4, splash.z + 0.5 + (i % 2));
    m.renderOrder = 6;
    ctx.group.add(m);
    mists.push(m);
  }

  // Rainbow: a faint arc, hung in front of the mist
  const bowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uAmt: { value: 0.35 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAmt; varying vec2 vUv;
      vec3 spectrum(float t) { return clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0); }
      void main() {
        float band = vUv.y;
        vec3 c = spectrum(1.0 - band) * smoothstep(0.0, 0.25, band) * smoothstep(1.0, 0.75, band);
        float ends = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        gl_FragColor = vec4(c * uAmt * ends, 1.0);
      }`,
  });
  const bowGeo = new THREE.RingGeometry(5.4, 6.4, 40, 1, 0.15, Math.PI - 0.3);
  // RingGeometry's uv is a planar projection, changed here to (angle, radius)
  {
    const p = bowGeo.attributes.position;
    const u = bowGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getY(i), p.getX(i));
      const rr = Math.hypot(p.getX(i), p.getY(i));
      u.setXY(i, (a - 0.15) / (Math.PI - 0.45), (rr - 5.4) / 1.0);
    }
  }
  const bow = new THREE.Mesh(bowGeo, bowMat);
  bow.position.set(splash.x, WL + 0.6, splash.z + 2.8);
  bow.rotation.y = Math.atan2(dir.x, dir.z) + 0.1;
  bow.renderOrder = 7;
  ctx.group.add(bow);

  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
    foamMat.dispose();
    foam.geometry.dispose();
    mistMat.dispose();
    mistTex.dispose();
    for (const m of mists) m.geometry.dispose();
    bowGeo.dispose();
    bowMat.dispose();
  });
  let acc = 0;
  ctx.extras.push((dt, t, vfx) => {
    mat.uniforms.uTime.value = t;
    foamMat.uniforms.uTime.value = t;
    mists.forEach((m, i) => {
      m.lookAt(vfx.camPos);
      m.position.y = WL + 1.2 + (i % 3) * 1.4 + Math.sin(t * 0.5 + i) * 0.35;
    });
    mistMat.opacity = 0.42 + 0.08 * Math.sin(t * 0.7);
    // Emit splashes only when the camera is close
    if (vfx.camPos.distanceTo(splash) > 70) return;
    acc += dt;
    while (acc > 0.06) {
      acc -= 0.06;
      vfx.emit({
        pos: splash.clone().add(V((Math.random() - 0.5) * 4, WL + 0.3 - splash.y, (Math.random() - 0.5) * 2)),
        count: 1,
        color: [0xffffff, 0xd8fff4],
        speed: [1.5, 3.5],
        dir: V(0, 1, 0.35),
        spread: 0.6,
        life: [0.6, 1.2],
        size: [0.15, 0.3],
        sizeEnd: 1.2,
        gravity: -5,
        intensity: 1.1,
      });
      if (Math.random() < 0.3) vfx.smoke({ pos: splash.clone().add(V((Math.random() - 0.5) * 5, WL + 0.8 - splash.y, 0)), count: 1, color: 0xf2fff8, speed: [0.4, 1.0], dir: V(0, 1, 0.5), spread: 0.4, life: [1.6, 2.6], size: [1.2, 2.0], sizeEnd: 3.2 });
    }
  });
}

/** Morning mist over water: several patches of fog that hug the water and drift slowly (fading out at the edges) */
function mistPatches(ctx: FieldCtx, spots: [number, number, number, number, number][]): void {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uColor: { value: new THREE.Color(0xf2fbf2) } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vW;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
      ${NOISE}
      void main() {
        vec2 p = vUv - 0.5;
        float edge = smoothstep(0.5, 0.2, length(p));
        float n = fbm(vW.xz * 0.09 + vec2(uTime * 0.03, uTime * 0.012));
        float a = edge * smoothstep(0.35, 0.75, n) * 0.4;
        gl_FragColor = vec4(uColor, a);
        #include <fog_fragment>
      }`,
  });
  const geos: THREE.BufferGeometry[] = [];
  for (const [x, z, w, d, y] of spots) {
    for (let k = 0; k < 2; k++) {
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      g.translate(x, y + k * 0.7, z);
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = 5;
      ctx.group.add(m);
      geos.push(g);
    }
  }
  ctx.disposers.push(() => {
    mat.dispose();
    for (const g of geos) g.dispose();
  });
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
}

export function buildWaters(ctx: FieldCtx): void {
  const { b, r, low } = ctx;
  const lip = upperStream(ctx);
  waterfall(ctx, lip);

  // Large mossy rocks around the falls pool (at the pool's edge, not blocking the way to the narrow gorge)
  const pool: [number, number, number][] = [[-40.5, -39.5, 1.5], [-39, -35.5, 1.1], [-54.5, -31.5, 1.3], [-42.5, -42.2, 1.3]];
  for (const [x, z, s] of pool) mossRockAt(ctx, x, z, s);
  // Rocks on both sides of the top of the falls (the water falls through the gaps in the rock)
  for (const s of [-1, 1]) {
    const x = lip.x + s * 3.6;
    const z = lip.z - 0.8;
    ctx.place(x, z, 1.5);
    b.lift -= 0.6;
    put(b, new THREE.DodecahedronGeometry(1, 0), COL.rock, new THREE.Matrix4().compose(V(x, 0.6, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, r() * 6, 0.1)), V(1.8, 1.3, 1.6)));
  }

  // Stream bank: pebbles and reeds
  const sc = new THREE.CatmullRomCurve3(STREAM.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const sn = Math.round(sc.getLength() / 2.4);
  for (let i = 0; i <= sn; i++) {
    const p = sc.getPointAt(i / sn);
    const t = sc.getTangentAt(i / sn);
    const { w } = streamAt(p.x, p.z);
    for (const s of [-1, 1]) {
      if (r() > 0.55 * (low ? 0.5 : 1)) continue;
      const off = w + 0.6 + r() * 2.2;
      const x = p.x - t.z * s * off;
      const z = p.z + t.x * s * off;
      const hh = ctx.h(x, z);
      if (hh < WL - 0.2 || hh > WL + 1.6 || !ctx.clear(x, z, -0.5)) continue;
      if (lakeE(x, z) < 1.1) continue;
      if (r() < 0.55) reedsAt(ctx, x, z);
      else {
        ctx.place(x, z);
        b.lift -= 0.15;
        put(b, new THREE.DodecahedronGeometry(1, 0), r() < 0.5 ? COL.rock : 0xa09c8c, new THREE.Matrix4().compose(V(x, 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), V(0.5 + r() * 0.5, 0.3 + r() * 0.2, 0.4 + r() * 0.4)), false);
      }
    }
  }

  // Stepping stones at the shallow ford
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = 26.6 + t * 1.6 + (r() - 0.5) * 0.6 + 1.6;
    const z = 1.5 - t * 15;
    const hh = ctx.h(x, z);
    if (hh > WL + 0.3) continue;
    b.lift = WL - 0.25;
    put(b, new THREE.CylinderGeometry(0.62, 0.72, 0.5, 8), 0xa8a492, M(x, 0, z, r() * 6));
  }

  // Lake shore: reeds, water lilies, stepping stones to the island
  for (let i = 0; i < (low ? 30 : 60); i++) {
    const a = r() * Math.PI * 2;
    const k = 0.95 + r() * 0.16;
    const x = LAKE.x + Math.cos(a) * LAKE.rx * k;
    const z = LAKE.z + Math.sin(a) * LAKE.rz * k;
    const hh = ctx.h(x, z);
    if (hh < WL - 0.3 || hh > WL + 0.7 || !ctx.clear(x, z, -0.5)) continue;
    reedsAt(ctx, x, z);
  }
  lilies(ctx, LAKE.x - 10, LAKE.z - 4, 9, 18);
  lilies(ctx, LAKE.x + 8, LAKE.z + 2, 7, 12);
  lilies(ctx, LAKE.x - 4, LAKE.z + 10, 5, 9);
  lilies(ctx, POOL[0] + 4, POOL[1] + 4, 3.5, 5);
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const x = 51 + (57 - 51) * t + (r() - 0.5) * 0.8;
    const z = 21 + (13.5 - 21) * t;
    b.lift = WL - 0.2;
    put(b, new THREE.CylinderGeometry(0.55, 0.65, 0.5, 8), 0xa8a492, M(x, 0, z, r() * 6));
  }

  // Morning mist: lake surface, stream surface, falls pool
  const mist: [number, number, number, number, number][] = [
    [LAKE.x - 4, LAKE.z, 30, 22, WL + 0.5],
    [LAKE.x + 10, LAKE.z - 6, 20, 14, WL + 0.9],
    [POOL[0], POOL[1] + 2, 16, 12, WL + 0.6],
    [-20, -29, 22, 9, WL + 0.6],
    [12, -21, 20, 10, WL + 0.6],
  ];
  if (!low) mistPatches(ctx, mist);
  b.lift = 0;
  void smooth;
}

/** Reed clump: slender stems with brown plumes (no outline) */
function reedsAt(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  const n = 5 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.3;
    const pz = z + (r() - 0.5) * 1.3;
    const h = 1.0 + r() * 1.0;
    const tilt = (r() - 0.5) * 0.3;
    b.add(new THREE.CylinderGeometry(0.025, 0.035, h, 4), 0x6a9a3a, M(px, h / 2, pz, 0, 1, tilt, tilt), false);
    if (r() < 0.6) b.add(new THREE.CapsuleGeometry(0.06, 0.25, 2, 5), 0x8a5a2a, M(px + tilt * h * 0.5, h, pz - tilt * h * 0.5, 0, 1, tilt, tilt), false);
  }
}

/** Water lily: round leaves floating on the water, with a few flowers */
function lilies(ctx: FieldCtx, x: number, z: number, rad: number, n: number): void {
  const { b, r } = ctx;
  b.lift = WL + 0.03;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * rad;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    if (ctx.h(px, pz) > WL - 0.3) continue;
    const s = 0.45 + r() * 0.5;
    b.add(new THREE.CylinderGeometry(s, s, 0.04, 12, 1, false, 0.3, Math.PI * 1.85), r() < 0.5 ? 0x4f9a42 : 0x5aa84a, M(px, 0, pz, r() * 6), false);
    if (r() < 0.35) b.add(new THREE.ConeGeometry(0.16, 0.22, 6), r() < 0.6 ? 0xffb8d8 : 0xffffff, M(px, 0.12, pz, 0, 1, Math.PI), false);
  }
}
