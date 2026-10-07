// The SSR descent's "field flood": the sky, lighting, post-process grading and weather all change together to its element.
//   fire: a blazing sun rises, embers drift up, heat haze     water: downpour and lightning     nature: petal rain and dappled light through the trees     wind: drifting clouds and a gale of feathers
//   earth: sandstorm and floating stones     thunder: thundercloud strikes and electric arcs     light: golden divine light pillars     dark: eclipse, black mist drawn inward, red eyes
//   neutral: golden rune arrays rotating layer by layer
// ramp(amt) controls how far the flood has gone: 0 is the original starfield, 1 is fully that field.

import * as THREE from 'three';
import type { Element } from '../../../sim/types.ts';
import { LIGHT } from '../toon.ts';
import { inkScenery } from '../ink.ts';
import { sceneMaterial } from '../spiritToon.ts';
import { glowTex, runeCircleTex } from '../textures.ts';
import { cloudTex, rayTex } from '../fxtex.ts';
import { additive } from '../vfx.ts';
import { ease } from '../tween.ts';
import type { SummonScene } from './scene.ts';

export const ELEMENT_COLOR: Record<Element, number> = {
  water: 0x3db7ff,
  fire: 0xff6a2b,
  nature: 0x5fcb5a,
  wind: 0x9fe8e0,
  earth: 0xc49a5a,
  thunder: 0xb38cff,
  light: 0xffe680,
  dark: 0x7b3fc4,
  neutral: 0xe8e8f0,
};

export const ELEMENT_HI: Record<Element, number> = {
  water: 0xbff3ff,
  fire: 0xffd27a,
  nature: 0xd8f59a,
  wind: 0xffffff,
  earth: 0xe8c890,
  thunder: 0xfff6a8,
  light: 0xffffff,
  dark: 0xc89aff,
  neutral: 0xffffff,
};

/** Deeper, more saturated element colors: for flashes, speed lines and the burst (pale light and neutral are specified separately, to avoid an all-beige screen) */
export const ELEMENT_DEEP: Record<Element, number> = {
  water: 0x1a7cff,
  fire: 0xff4a10,
  nature: 0x30b040,
  wind: 0x3cc4c0,
  earth: 0xb87424,
  thunder: 0x8a50ff,
  light: 0xffb020,
  dark: 0x6a20c0,
  neutral: 0x9a8ad0,
};

export interface Flood {
  ramp(amt: number, dur: number): Promise<void>;
  kill(): void;
}

interface Prop {
  tick(dt: number, t: number, amt: number): void;
  kill(): void;
}

interface FloodDef {
  sky: number;
  skyTop: number;
  skyAmt: number;
  ambient: number;
  rim: number;
  shadow: number;
  bloom: number;
  vignette?: number;
  grain?: number;
  haze?: number;
  build(sc: SummonScene): Prop;
}

const UP = new THREE.Vector3(0, 1, 0);

// ───────────────────────── Shared pieces ─────────────────────────

/** Weather curtain stuck in front of the camera: 0 rain, 1 wind streaks, 2 sand grains */
function veil(sc: SummonScene, mode: number, color: number, alpha: number): Prop {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uMode: { value: mode }, uCol: { value: new THREE.Color(color) }, uA: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uT; uniform float uMode; uniform vec3 uCol; uniform float uA; uniform float uAspect; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float streaks(vec2 uv, float along, float across, float speed, float seed){
        vec2 p = vec2(uv.x * across, uv.y * along);
        p.y += uT * speed;
        float col = floor(p.x);
        p.y += hash(vec2(col, seed)) * 9.0;
        vec2 f = fract(p);
        float s = smoothstep(0.32, 0.5, f.x) * smoothstep(0.68, 0.5, f.x) * smoothstep(0.0, 0.2, f.y) * smoothstep(0.95, 0.55, f.y);
        return s * step(0.45, hash(vec2(col, floor(p.y) + seed)));
      }
      void main(){
        vec2 uv = vUv;
        float a = 0.0;
        if (uMode < 0.5) {
          // Rain: three layers from near to far, falling at a slant
          vec2 q = vec2(uv.x * uAspect + uv.y * 0.12, uv.y);
          a += streaks(q, 7.0, 46.0, 7.5, 1.0) * 0.55;
          a += streaks(q, 11.0, 70.0, 10.0, 2.0) * 0.35;
          a += streaks(q, 16.0, 110.0, 13.0, 3.0) * 0.22;
        } else if (uMode < 1.5) {
          // Wind: horizontal streamlines drifting slightly upward
          vec2 q = vec2(1.0 - uv.y + uv.x * 0.08, uv.x * uAspect);
          a += streaks(q, 4.0, 26.0, 5.0, 4.0) * 0.5;
          a += streaks(q, 6.0, 42.0, 8.0, 5.0) * 0.3;
        } else {
          // Sand: tiny diagonal grains
          vec2 q = vec2(uv.x * uAspect - uv.y * 0.5, uv.y + uv.x * 0.3);
          a += streaks(q, 30.0, 90.0, 9.0, 6.0) * 0.45;
          a += streaks(q, 46.0, 140.0, 14.0, 7.0) * 0.3;
        }
        // Fade out at the screen edges so the spirit in the middle is not covered
        float edge = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
        float center = 0.55 + 0.45 * smoothstep(0.12, 0.42, length((uv - 0.5) * vec2(uAspect, 1.0)));
        a *= edge * center * uA;
        gl_FragColor = vec4(uCol * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.renderOrder = 20;
  m.frustumCulled = false;
  const dir = new THREE.Vector3();
  const layer = sc.vfx.layer(m, (_dt, t) => {
    const cam = sc.stage.camera;
    cam.getWorldDirection(dir);
    m.position.copy(cam.position).addScaledVector(dir, 3);
    m.quaternion.copy(cam.quaternion);
    const hh = 2 * 3 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 1.05;
    m.scale.set(hh * cam.aspect, hh, 1);
    mat.uniforms.uT.value = t;
    mat.uniforms.uAspect.value = cam.aspect;
  });
  return {
    tick: (_dt, _t, amt) => {
      mat.uniforms.uA.value = alpha * amt;
    },
    kill: () => layer.kill(),
  };
}

function sprite(map: THREE.Texture, color: number, intensity: number, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
}

/** A ray plate radiating from a point (rayTex), turning slowly */
function rays(sc: SummonScene, pos: THREE.Vector3, color: number, count: number, len: number, width: number, speed: number, tilt: number): Prop {
  const g = new THREE.Group();
  g.position.copy(pos);
  const mats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < count; i++) {
    const mat = additive(color, rayTex(), 0.55);
    mat.depthTest = false;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat);
    m.geometry.translate(0, -len / 2, 0);
    const holder = new THREE.Group();
    holder.rotation.z = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    holder.rotation.x = tilt;
    holder.add(m);
    m.scale.x = 0.6 + Math.random() * 0.8;
    g.add(holder);
    mats.push(mat);
  }
  g.renderOrder = 3;
  const layer = sc.vfx.layer(g, (dt) => {
    g.rotation.y += dt * speed;
  });
  return {
    tick: (_dt, t, amt) => {
      mats.forEach((m, i) => (m.opacity = amt * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7)) * 0.4));
    },
    kill: () => layer.kill(),
  };
}

function combine(...props: Prop[]): Prop {
  return { tick: (dt, t, amt) => props.forEach((p) => p.tick(dt, t, amt)), kill: () => props.forEach((p) => p.kill()) };
}

/** Called once every interval seconds (limited by the amt threshold) */
function every(interval: [number, number], fn: (t: number, amt: number) => void, min = 0.3): Prop {
  let next = 0;
  return {
    tick: (_dt, t, amt) => {
      if (amt < min || t < next) return;
      next = t + interval[0] + Math.random() * (interval[1] - interval[0]);
      fn(t, amt);
    },
    kill: () => {},
  };
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ───────────────────────── Per element ─────────────────────────

/** Fire: a blazing sun rises behind the Star Gate, embers drift up, heat haze distorts */
function fire(sc: SummonScene): Prop {
  const g = new THREE.Group();
  const halo = sprite(glowTex(), 0xff6a20, 1.1, 22);
  const core = sprite(glowTex(), 0xffc060, 1.3, 8);
  g.add(halo, core);
  // The sun sits outside the camera's right: in the close-up, the horizon behind its head is dark red, and the sun's halo only seeps in from the side
  g.position.set(14, 6, -40);
  const r = rays(sc, new THREE.Vector3(14, 6, -39), 0xffb060, 12, 40, 6, 0.12, 0);
  const layer = sc.vfx.layer(g, () => {});
  const embers = every([0.05, 0.09], (_t, amt) => {
    sc.vfx.emit({ pos: new THREE.Vector3(rnd(-12, 12), 0.2, rnd(-14, 8)), count: Math.round(3 * amt), color: [0xff6a2b, 0xffd27a, 0xff3a12], speed: [0.5, 1.8], dir: UP, spread: 0.5, life: [1.2, 2.4], size: [0.06, 0.16], sizeEnd: 0.02, gravity: -1.2, drag: 0.6, intensity: 1 });
  });
  return combine(r, embers, {
    tick: (_dt, t, amt) => {
      const rise = ease.outCubic(Math.min(1, amt));
      g.position.y = -6 + 14 * rise;
      halo.material.opacity = amt * (0.3 + 0.06 * Math.sin(t * 2));
      core.material.opacity = amt;
      sc.stage.grade.haze = 0.5 * amt;
      sc.stage.grade.hazeRadius = 0.55;
    },
    kill: () => layer.kill(),
  });
}

/** Water: a downpour sweeps down, lightning occasionally lights the sky, ripples spread on the ground */
function water(sc: SummonScene): Prop {
  const rain = veil(sc, 0, 0xbfe3ff, 0.9);
  const bolts = every([0.45, 1.1], (_t, amt) => {
    const x = rnd(-16, 16);
    sc.stage.screenFlash(0xcfe4ff, 0.22 * amt, 9);
    void sc.vfx.bolt(new THREE.Vector3(x, 24, -28), new THREE.Vector3(x * 0.7, 0, -20), 0xdff0ff, 0.25, 0.09);
    sc.skyMat.uniforms.uGlow.value = 0.6;
  });
  const ripples = every([0.08, 0.18], (_t, amt) => {
    const a = Math.random() * Math.PI * 2;
    const d = rnd(2.5, 14);
    void sc.vfx.ring(new THREE.Vector3(Math.cos(a) * d, 0.05, Math.sin(a) * d - 3), 0x3db7ff, 0.1, rnd(0.6, 1.4), 0.7);
    void amt;
  });
  const drops = every([0.03, 0.06], (_t, amt) => {
    sc.vfx.emit({ pos: new THREE.Vector3(rnd(-10, 10), 0.1, rnd(-10, 8)), count: Math.round(4 * amt), color: [0xbff3ff, 0x3db7ff], speed: [1, 3], dir: UP, spread: 0.6, life: [0.25, 0.45], size: [0.05, 0.1], gravity: 9, drag: 0.5, intensity: 0.8 });
  });
  return combine(rain, bolts, ripples, drops, {
    tick: () => {
      sc.skyMat.uniforms.uGlow.value = Math.max(0, (sc.skyMat.uniforms.uGlow.value as number) - 0.04);
    },
    kill: () => {},
  });
}

/** Nature: dappled light falls from above, petal rain, a vine magic circle on the ground */
function nature(sc: SummonScene): Prop {
  const r = rays(sc, new THREE.Vector3(0, 20, -16), 0xd8f59a, 8, 24, 2, 0.08, Math.PI);
  const petals = every([0.04, 0.08], (_t, amt) => {
    sc.vfx.emit({ pos: new THREE.Vector3(rnd(-10, 10), 12, rnd(-12, 8)), count: Math.round(4 * amt), color: [0xffb0d0, 0xd8f59a, 0x5fcb5a, 0xfff0f8], speed: [0.3, 1.2], life: [2.5, 4], size: [0.12, 0.26], gravity: 1.1, drag: 1.4, spin: 3, atlas: 3, intensity: 0.9 });
  });
  const vines = every([0.5, 0.8], (_t, amt) => {
    const a = Math.random() * Math.PI * 2;
    const d = rnd(3, 12);
    void sc.vfx.circle(new THREE.Vector3(Math.cos(a) * d, 0.05, Math.sin(a) * d - 3), 0x5fcb5a, rnd(1, 2.4) * amt, 1.4, undefined, Math.floor(rnd(0, 3)));
  });
  return combine(r, petals, vines);
}

/** Wind: drifting clouds sweep by, gale streaks, scattering feathers */
function wind(sc: SummonScene): Prop {
  const streaks = veil(sc, 1, 0xdffcff, 0.7);
  const g = new THREE.Group();
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const s = sprite(cloudTex(), 0xd8f4ff, 0.9, rnd(8, 16));
    s.position.set(rnd(-40, 40), rnd(6, 16), rnd(-40, -12));
    s.scale.y *= 0.55;
    clouds.push(s);
    g.add(s);
  }
  const layer = sc.vfx.layer(g, (dt) => {
    for (const s of clouds) {
      s.position.x += dt * (14 + s.scale.x);
      if (s.position.x > 45) s.position.x = -45;
    }
  });
  const feathers = every([0.06, 0.12], (_t, amt) => {
    sc.vfx.emit({ pos: new THREE.Vector3(-16, rnd(1, 9), rnd(-12, 8)), count: Math.round(3 * amt), color: [0xffffff, 0x9fe8e0], speed: [8, 14], dir: new THREE.Vector3(1, 0.15, 0), spread: 0.25, life: [1.5, 2.6], size: [0.1, 0.22], gravity: 0.3, drag: 0.2, spin: 4, atlas: 3, intensity: 0.9 });
  });
  return combine(streaks, feathers, {
    tick: (_dt, _t, amt) => clouds.forEach((s) => (s.material.opacity = amt * 0.55)),
    kill: () => layer.kill(),
  });
}

/** Earth: sandstorm, rumbling, rocks slowly floating up around the display stand */
function earth(sc: SummonScene): Prop {
  const sand = veil(sc, 2, 0xe0b070, 0.55);
  const g = new THREE.Group();
  const rocks: { m: THREE.Mesh; base: THREE.Vector3; spd: number; rot: THREE.Vector3 }[] = [];
  for (let i = 0; i < 14; i++) {
    let a = 0;
    let d = 0;
    // The camera is straight in front of the display stand (+z): leave out the stretch between the camera and the spirit (in front of the stand, within 4.5 left and right), so floating stones do not cover half the body
    for (let k = 0; k < 12; k++) {
      a = (i / 14) * Math.PI * 2 + Math.random() * 0.4 + k * 0.37;
      d = rnd(4, 11);
      if (!(Math.sin(a) * d - 2 > 1 && Math.abs(Math.cos(a) * d) < 4.5)) break;
    }
    const geo = new THREE.DodecahedronGeometry(rnd(0.25, 0.7), 0);
    const m = new THREE.Mesh(geo, sceneMaterial(0x8a6a48, { rim: 0.4 }));
    m.position.set(Math.cos(a) * d, -1, Math.sin(a) * d - 2);
    m.rotation.set(rnd(0, 3), rnd(0, 3), 0);
    rocks.push({ m, base: m.position.clone(), spd: rnd(0.6, 1.6), rot: new THREE.Vector3(rnd(-0.6, 0.6), rnd(-0.6, 0.6), rnd(-0.4, 0.4)) });
    g.add(m);
  }
  // Floating stones are solid objects: they go into the ink layer (post-process lines, no back-face mesh)
  inkScenery(g);
  const layer = sc.vfx.layer(g, (dt) => {
    for (const r of rocks) {
      r.m.rotation.x += r.rot.x * dt;
      r.m.rotation.y += r.rot.y * dt;
    }
  });
  const dust = every([0.06, 0.1], (_t, amt) => {
    sc.vfx.smoke({ pos: new THREE.Vector3(rnd(-14, 14), 0.2, rnd(-16, 8)), count: Math.round(2 * amt), color: [0x8a6a40, 0x5a4020, 0xb08a58], speed: [0.5, 2], dir: new THREE.Vector3(1, 0.3, 0), spread: 0.7, life: [1.5, 2.6], size: [0.8, 1.8], sizeEnd: 3, drag: 0.5, gravity: -0.2 });
  });
  return combine(sand, dust, {
    tick: (_dt, t, amt) => {
      for (const r of rocks) r.m.position.y = -1 + (r.base.y + 1 + 2.5 + Math.sin(t * r.spd + r.base.x) * 0.5) * ease.outCubic(amt);
      sc.stage.grade.grain = 0.35 * amt;
    },
    kill: () => layer.kill(),
  });
}

/** Thunder: thundercloud strikes, electric arcs around the spirit, the sky flickering */
function thunder(sc: SummonScene): Prop {
  const strikes = every([0.12, 0.32], (_t, amt) => {
    const a = Math.random() * Math.PI * 2;
    const d = rnd(4, 15);
    const to = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d - 3);
    void sc.vfx.bolt(to.clone().add(new THREE.Vector3(rnd(-3, 3), 22, rnd(-3, 3))), to, 0xe8dcff, 0.22, 0.1);
    void sc.vfx.ring(to.clone().setY(0.05), 0xb38cff, 0.2, 2, 0.4);
    sc.stage.screenFlash(0xd8c8ff, 0.16 * amt, 12);
    sc.vfx.emit({ pos: to, count: 8, color: [0xfff6a8, 0xb38cff], speed: [2, 5], life: [0.2, 0.4], size: [0.06, 0.14], drag: 3, intensity: 1 });
  });
  const arcs = every([0.1, 0.2], (_t, amt) => {
    const h = sc.h;
    const c = sc.center();
    const p = () => c.clone().add(new THREE.Vector3(rnd(-1, 1) * h * 0.7, rnd(-0.5, 0.6) * h, rnd(-1, 1) * h * 0.6));
    void sc.vfx.bolt(p(), p(), 0xfff6a8, 0.12, 0.04);
    void amt;
  });
  return combine(strikes, arcs, {
    tick: (_dt, t, amt) => {
      // The dull glow of the thundercloud
      const strobe = Math.sin(t * 23) > 0.92 ? 0.35 : 0;
      sc.skyMat.uniforms.uGlow.value = amt * (0.3 + strobe);
    },
    kill: () => {},
  });
}

/** Light: golden divine light pours from the zenith, feathers and light dust drift down */
function light(sc: SummonScene): Prop {
  const r = rays(sc, new THREE.Vector3(0, 24, -18), 0xffd070, 12, 32, 3, 0.05, Math.PI);
  const r2 = rays(sc, new THREE.Vector3(0, 24, -18), 0xffc050, 8, 28, 1.5, -0.09, Math.PI + 0.12);
  const glow = sprite(glowTex(), 0xffc860, 1.0, 20);
  glow.position.set(0, 16, -14);
  const layer = sc.vfx.layer(glow, () => {});
  const motes = every([0.05, 0.1], (_t, amt) => {
    sc.vfx.emit({ pos: new THREE.Vector3(rnd(-10, 10), rnd(6, 12), rnd(-12, 8)), count: Math.round(3 * amt), color: [0xffffff, 0xffe680], speed: [0.2, 0.8], life: [2, 3.5], size: [0.08, 0.2], gravity: 0.5, drag: 1.2, spin: 2, atlas: 3, intensity: 0.85 });
  });
  return combine(r, r2, motes, {
    tick: (_dt, _t, amt) => {
      glow.material.opacity = amt * 0.35;
    },
    kill: () => layer.kill(),
  });
}

/** Dark: the sky is swallowed by an eclipse, black mist is drawn into the spirit, red eyes light up in the darkness */
function dark(sc: SummonScene): Prop {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x04020a, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const corona = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color(0x9a5aff).multiplyScalar(1.4) } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uT; uniform float uA; uniform vec3 uCol; varying vec2 vUv;
        void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
          float n = 0.5 + 0.3 * sin(a * 9.0 - uT * 1.4) + 0.2 * sin(a * 17.0 + uT * 2.1);
          float d = max(r - 0.62, 0.0); float c = exp(-d * (10.0 - 6.0 * n)) * smoothstep(0.58, 0.63, r) * smoothstep(1.0, 0.7, r);
          float edge = exp(-abs(r - 0.62) * 50.0);
          float al = (c * (0.4 + 0.6 * n) + edge) * uA; gl_FragColor = vec4(uCol * al, al); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  corona.position.z = -0.01;
  corona.scale.setScalar(1.62);
  g.add(corona, disc);
  g.position.set(0, 14, -36);
  g.scale.setScalar(7);
  const layer = sc.vfx.layer(g, (_dt, t) => {
    g.quaternion.copy(sc.stage.camera.quaternion);
    (corona.material as THREE.ShaderMaterial).uniforms.uT.value = t;
  });
  const mist = every([0.05, 0.09], (_t, amt) => {
    const c = sc.center();
    const a = Math.random() * Math.PI * 2;
    const d = rnd(5, 12);
    sc.vfx.smoke({ pos: c.clone().add(new THREE.Vector3(Math.cos(a) * d, rnd(-c.y, 3), Math.sin(a) * d)), count: Math.round(3 * amt), color: [0x1a0f2e, 0x2a1445, 0x0a0614], speed: [2, 4], dir: c.clone().sub(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d)).normalize(), spread: 0.3, life: [1.2, 2.2], size: [1, 2.2], sizeEnd: 0.3, drag: 0.4 });
  });
  const eyes = every([0.25, 0.6], (_t, amt) => {
    const a = Math.random() * Math.PI * 2;
    const d = rnd(8, 16);
    const p = new THREE.Vector3(Math.cos(a) * d, rnd(0.5, 4), Math.sin(a) * d - 4);
    void sc.vfx.glint(p, 0xff2040, 0.5 * amt, 0.7, 2);
    void sc.vfx.glint(p.clone().add(new THREE.Vector3(0.5, 0, 0)), 0xff2040, 0.5 * amt, 0.7, 2);
  });
  return combine(mist, eyes, {
    tick: (_dt, _t, amt) => {
      (disc.material as THREE.MeshBasicMaterial).opacity = amt;
      (corona.material as THREE.ShaderMaterial).uniforms.uA.value = amt;
    },
    kill: () => layer.kill(),
  });
}

/** Neutral: three golden-white rune arrays rotate in opposite directions around the display stand, sword light flashing past now and then */
function neutral(sc: SummonScene): Prop {
  const g = new THREE.Group();
  const mats: THREE.MeshBasicMaterial[] = [];
  const rings: { m: THREE.Mesh; spd: number }[] = [];
  [[3.4, 1.2, 0], [4.6, 2.6, 1], [5.8, 4.2, 2]].forEach(([rad, y, seed], i) => {
    const mat = additive(0xfff0c0, runeCircleTex(seed), 1.3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rad * 2, rad * 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, 2.5);
    rings.push({ m, spd: (i % 2 ? -1 : 1) * (0.5 + i * 0.2) });
    mats.push(mat);
    g.add(m);
  });
  const layer = sc.vfx.layer(g, (dt) => rings.forEach((r) => (r.m.rotation.z += dt * r.spd)));
  const glints = every([0.15, 0.4], (_t, amt) => {
    const p = new THREE.Vector3(rnd(-8, 8), rnd(1, 8), rnd(-12, 6));
    void sc.vfx.glint(p, 0xffffff, rnd(0.5, 1.2) * amt, 0.5, 4);
  });
  return combine(glints, {
    tick: (_dt, _t, amt) => mats.forEach((m) => (m.opacity = amt * 0.8)),
    kill: () => layer.kill(),
  });
}

const DEFS: Record<Element, FloodDef> = {
  fire: { sky: 0x5a1404, skyTop: 0x140402, skyAmt: 0.92, ambient: 0xc06a40, rim: 0xffb070, shadow: 0x5a1a10, bloom: 0.5, haze: 0.5, vignette: 0.75, build: fire },
  water: { sky: 0x123050, skyTop: 0x05091a, skyAmt: 0.95, ambient: 0x5070b0, rim: 0xbff3ff, shadow: 0x1a2a5a, bloom: 0.60, build: water },
  nature: { sky: 0x1e5a2a, skyTop: 0x06200c, skyAmt: 0.9, ambient: 0x70a860, rim: 0xd8f59a, shadow: 0x1a3a1a, bloom: 0.60, build: nature },
  wind: { sky: 0x3a7a8a, skyTop: 0x0c2a3a, skyAmt: 0.9, ambient: 0x80b0c0, rim: 0xffffff, shadow: 0x2a4a5a, bloom: 0.60, build: wind },
  earth: { sky: 0x6a4a1c, skyTop: 0x1e1206, skyAmt: 0.92, ambient: 0xa08050, rim: 0xe8c890, shadow: 0x3a2a10, bloom: 0.55, grain: 0.35, build: earth },
  thunder: { sky: 0x2a1060, skyTop: 0x080418, skyAmt: 0.92, ambient: 0x7060b0, rim: 0xfff6a8, shadow: 0x201040, bloom: 0.65, build: thunder },
  light: { sky: 0x9a5e10, skyTop: 0x2a1a04, skyAmt: 0.9, ambient: 0xb8a888, rim: 0xffe0a0, shadow: 0x5a4a28, bloom: 0.45, vignette: 0.7, build: light },
  dark: { sky: 0x0a0414, skyTop: 0x020108, skyAmt: 0.97, ambient: 0x3a2860, rim: 0xc89aff, shadow: 0x100820, bloom: 0.65, vignette: 0.9, build: dark },
  neutral: { sky: 0x3a3450, skyTop: 0x0c0a18, skyAmt: 0.85, ambient: 0x9a90b0, rim: 0xffffff, shadow: 0x3a3450, bloom: 0.60, build: neutral },
};

export function startFlood(sc: SummonScene, el: Element): Flood {
  const def = DEFS[el];
  const prop = def.build(sc);
  let amt = 0;
  const ambient = new THREE.Color(def.ambient);
  const rim = new THREE.Color(def.rim);
  const shadow = new THREE.Color(def.shadow);
  const sky = sc.skyMat.uniforms;
  (sky.uFlood.value as THREE.Color).set(def.sky);
  (sky.uFloodTop.value as THREE.Color).set(def.skyTop);
  const apply = () => {
    sky.uFloodAmt.value = amt * def.skyAmt;
    // No full-screen grading (tint, lift, desat): that would tint the spirit too. The field's character comes from the sky, props, rim light and vignette
    sc.vig = 0.35 + ((def.vignette ?? 0.55) - 0.35) * amt;
    LIGHT.dir.value.copy(sc.light0.dir);
    LIGHT.ambient.value.lerpColors(sc.light0.ambient, ambient, amt * 0.6);
    LIGHT.rimColor.value.lerpColors(sc.light0.rim, rim, amt);
    LIGHT.shadowTint.value.lerpColors(sc.light0.shadow, shadow, amt * 0.7);
    sc.applyKey();
    sc.stage.bloom.strength = sc.bloom0 + (def.bloom - sc.bloom0) * amt;
  };
  const layer = sc.vfx.layer(new THREE.Object3D(), (dt, t) => {
    apply();
    prop.tick(dt, t, amt);
  });
  return {
    ramp: (to, dur) => {
      const from = amt;
      return sc.tw.to(dur, (k) => (amt = from + (to - from) * k), ease.inOutQuad, 'fx');
    },
    kill: () => {
      layer.kill();
      prop.kill();
      sky.uFloodAmt.value = 0;
    },
  };
}
