// Battle arena: the shared sky dome, ground, lighting, magic circle and ambient particles are assembled here;
// each region's props, shaders and dynamic effects live in arenas/*.ts (one file per region), and the shared helpers are in arenaKit.ts.

import * as THREE from 'three';
import { LIGHT } from './toon.ts';
import { groundTex, runeCircleTex } from './textures.ts';
import type { Vfx } from './vfx.ts';
import { PropBatch, rng, type ArenaCtx, type Palette, type RegionId, type RegionModule } from './arenaKit.ts';
import { arena as arenaRegion, hub } from './arenas/hub.ts';
import { forest } from './arenas/forest.ts';
import { isles } from './arenas/isles.ts';
import { volcano } from './arenas/volcano.ts';
import { highland } from './arenas/highland.ts';
import { canyon } from './arenas/canyon.ts';
import { plains } from './arenas/plains.ts';
import { holy } from './arenas/holy.ts';
import { shadow } from './arenas/shadow.ts';
import { rift } from './arenas/rift.ts';

export type { ArenaCtx, Palette, RegionId, RegionModule } from './arenaKit.ts';

const REGIONS: Record<RegionId, RegionModule> = {
  hub,
  arena: arenaRegion,
  forest,
  isles,
  volcano,
  highland,
  canyon,
  plains,
  holy,
  shadow,
  rift,
};

export const PALETTES: Record<RegionId, Palette> = Object.fromEntries(
  (Object.keys(REGIONS) as RegionId[]).map((k) => [k, REGIONS[k].palette]),
) as Record<RegionId, Palette>;

export interface Arena {
  group: THREE.Group;
  region: RegionId;
  palette: Palette;
  /** Sky dome material: uniforms top / mid / bot (colors), uFlash, uTime, uStars */
  skyMat: THREE.ShaderMaterial;
  ground: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Scene fog (the caller sets it on scene.fog; an arena effect can change its color and distance) */
  fog: THREE.Fog;
  update(dt: number, t: number, vfx: Vfx): void;
  dispose(): void;
}

export function buildArena(region: RegionId): Arena {
  const mod = REGIONS[region];
  const P = mod.palette;
  const group = new THREE.Group();
  LIGHT.dir.value.set(...P.light).normalize();
  LIGHT.ambient.value.set(P.ambient);
  LIGHT.rimColor.value.set(P.rim);
  LIGHT.shadowTint.value.set(P.shadow);

  // Sky
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(P.sky[0]) },
      mid: { value: new THREE.Color(P.sky[1]) },
      bot: { value: new THREE.Color(P.sky[2]) },
      uFlash: { value: 0 },
      uTime: { value: 0 },
      uStars: { value: P.stars ? 1 : 0 },
    },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float uFlash; uniform float uStars; uniform float uTime; varying vec3 vP;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        float h = vP.y;
        vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.8, h)) : mix(bot, mid, smoothstep(-0.05, 0.12, h));
        if (uStars > 0.5 && h > 0.15) {
          vec3 q = floor(vP * 220.0);
          float s = hash(q);
          float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
          c += vec3(step(0.9965, s)) * tw * smoothstep(0.15, 0.5, h) * 1.6;
        }
        c += vec3(0.8, 0.8, 1.0) * uFlash;
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat);
  group.add(sky);

  // Ground
  const gtex = groundTex(P.ground[0], P.ground[1], P.ground[2], region.length * 7);
  gtex.wrapS = gtex.wrapT = THREE.ClampToEdgeWrapping;
  const groundMat = new THREE.MeshLambertMaterial({ map: gtex });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(34, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  const farMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(P.ground[1]) });
  const far = new THREE.Mesh(new THREE.RingGeometry(33.9, 180, 64), farMat);
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.02;
  group.add(far);
  const hemi = new THREE.HemisphereLight(new THREE.Color(P.sky[1]), new THREE.Color(P.ground[1]), 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(...P.light);
  group.add(hemi, sun);

  // Central magic circle
  const runeMat = new THREE.MeshBasicMaterial({ map: runeCircleTex(region.length), color: new THREE.Color(P.ground[2]).multiplyScalar(0.9), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), runeMat);
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.02;
  group.add(rune);

  const b = new PropBatch();
  const r = rng(region.length * 131 + 7);
  const ringPos = (rMin: number, rMax: number, avoidFront = true) => {
    for (;;) {
      const a = r() * Math.PI * 2;
      const d = rMin + r() * (rMax - rMin);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      // Keep it out of the camera's way (the camera sits toward -x, +z)
      if (avoidFront && x < 2 && z > 2 && d < 26) continue;
      return [x, z] as const;
    }
  };
  const extras: ArenaCtx['extras'] = [];
  const disposers: (() => void)[] = [];

  const ctx: ArenaCtx = { region, P, group, b, r, ringPos, extras, disposers, skyMat, ground, far, rune, sun, hemi };
  mod.build(ctx);
  b.build(group);

  // Ambient particles
  let moteT = 0;
  const update = (dt: number, t: number, vfx: Vfx) => {
    skyMat.uniforms.uTime.value = t;
    rune.rotation.z += dt * 0.05;
    moteT += dt;
    while (moteT > 0.12) {
      moteT -= 0.12;
      const p = new THREE.Vector3((Math.random() - 0.5) * 22, 0, (Math.random() - 0.5) * 16);
      const kind = P.moteKind;
      p.y = kind === 'fall' ? 7 + Math.random() * 3 : kind === 'rise' ? 0.2 : 0.5 + Math.random() * 4;
      vfx.emit({
        pos: p,
        count: 1,
        color: P.motes,
        speed: kind === 'drift' ? [0.8, 1.6] : [0.2, 0.6],
        dir: kind === 'rise' ? new THREE.Vector3(0, 1, 0) : kind === 'fall' ? new THREE.Vector3(0, -1, 0) : kind === 'drift' ? new THREE.Vector3(1, 0.2, 0) : undefined,
        spread: 0.3,
        life: [2.5, 4.5],
        size: [0.08, 0.16],
        sizeEnd: 0.6,
        drag: 0.05,
        intensity: 1.4,
        atlas: P.moteAtlas && Math.random() < P.moteAtlas[1] ? P.moteAtlas[0] : 0,
      });
    }
    for (const e of extras) e(dt, t, vfx);
  };

  const fog = new THREE.Fog(new THREE.Color(P.fog), P.fogNear, P.fogFar);
  const arena: Arena = {
    group,
    region,
    palette: P,
    skyMat,
    ground,
    sun,
    hemi,
    fog,
    update,
    dispose() {
      for (const d of disposers) d();
      skyMat.dispose();
      groundMat.dispose();
      farMat.dispose();
      runeMat.dispose();
      gtex.dispose();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
    },
  };
  group.userData.fog = fog;
  return arena;
}
