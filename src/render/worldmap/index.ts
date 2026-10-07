// World map (the continent of Eldor): ten islands floating on a sea of clouds, each a miniature of that region's field map, so anyone who has been there recognizes it at a glance.
//
// Layers: at the bottom is the sea of clouds in three-step toon bands (each island casts a shadow on the clouds along the main light direction) → the islands (an undulating top surface, a base of rock strata tapering downward)
// → cloud puffs drifting slowly along the screen edges (only on the left and right and the two lower corners, blocking neither the islands nor the name plates). The main light has one direction for the whole map (LIGHT.dir),
// and each island has its own ambient light, shade color and rim light (taken from the palette of that region's field). Each island has just one landmark, and the Seal Tower is always visible.
// Materials: sceneMaterial + vertex colors, with the outline through inkScenery; each island's static parts are merged into three or four meshes (MapBatch). Glow is kept for a few highlights only.
// States: locked islands fade to gray-blue and their motes dim; the target island's Seal Tower is wrapped in a corrupted purple vortex with a golden beacon above it; a cleared island returns to its original colors and the source crystal at the top of its tower emits a light pillar.
//
// The islands (mood | landmark | palette):
// - Star Gate City: a ring-shaped city on the ruins of the kingdom | the standing Star Gate (eight source crystals, a rotating inner ring, a starry vortex) | pale purple stone, purple roofs, warm yellow street lamps
// - Whispering Forest: a forest of giant trees in morning light | the thousand-year Mother Tree (spread roots and a root arch spanning the path), a ring of glowing fungi | light and dark greens, ochre paths, the blue of the mirror lake
// - Tidesong Isles: bright sea islands, with ice on the north shore | a red-and-white lighthouse (the lantern room turns out a beam), a Seal Tower half frozen in ice | grass green, sand white, the turquoise of the inner bay, the white of the ice field
// - Emberspine Volcanic Belt: black rock and lava | the smoking main peak of the Emberspine, a lava river crossing the whole island and falling off the cliff edge, Red Iron Keep with iron walls and red roofs | basalt black, oxidized red, lava orange
// - Skyhowl Highlands: terraces rising tier by tier above the clouds | floating stones (ancient stone pillars with wind crystals, small rocks hung with waterfalls), windmills and a takeoff platform at the cliff edge | grass green, the beige-brown of the rock strata, sky-blue roofs
// - Stoneheart Canyon: canyon passages cut through red rock | the sleeping giant tortoise, with the dwarves' tortoise-back royal city on its shell | ochre-red rock strata, sand-yellow canyon floor, verdigris domes
// - Thunderplain: a sea of tall grass under thunderclouds | a thunderstorm cluster with lightning strikes parked over the tower, the ribs of an ancient thunder beast | waves of golden-yellow and blue-green grass, scorched black glass plains, cold-blue shade
// - Dawnlight Holy City: a white holy city on the clouds | a twin-towered cathedral, a holy bridge leading to the small island of the Seal Tower ringed by a barrier | white stone, blue roofs, gold accents, a ring of cloud at the island edge
// - Duskshade Realm: the endless night underground | a rock arch with stalactites hanging behind the tower, a grove of umbrella mushrooms, lamps leading from the lamplit village all the way to the tower | deep blue-purple, warm orange lamplight, cold blue fluorescence
// - Void Rift: a crumbling land | the Rift Tower bound by four giant chains, a purple-red abyss showing through beneath the outer ring broken into four pieces | gray-purple, scorched black, with warm fire only at the south outpost
//
// Island ids and positions are decided by World.tsx (mapPos in REGIONS), and the name plate hangs at the lowest point under the island (screenPositions).

import * as THREE from 'three';
import { inkScenery } from '../ink.ts';
import { MenuScene } from '../menuScene.ts';
import type { Stage } from '../stage.ts';
import { sceneMaterial } from '../spiritToon.ts';
import { LIGHT } from '../toon.ts';
import { islandBody, MapBatch, rng, topY, type BodySpec, type Foot, type Outline } from './kit.ts';
import { lookMaterial, type IsleCtx, type MapIsland, type RegionDef } from './props.ts';
import { FOREST, HIGHLAND, HUB, ISLES, VOLCANO } from './isles1.ts';
import { CANYON, HOLY, PLAINS, RIFT, SHADOW } from './isles2.ts';
import { buildSky, SEA_Y } from './sky.ts';

export type { MapIsland };

const DEFS: Record<string, RegionDef> = { hub: HUB, forest: FOREST, isles: ISLES, volcano: VOLCANO, highland: HIGHLAND, canyon: CANYON, plains: PLAINS, holy: HOLY, shadow: SHADOW, rift: RIFT };

const _g = new THREE.Color();
/** Locked: faded to gray-blue and slightly darkened */
function lockTint(c: THREE.Color): THREE.Color {
  const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  return c.lerp(_g.setRGB(l * 0.84, l * 0.87, l * 1.04), 0.62).multiplyScalar(0.88);
}
function lockGlow(c: THREE.Color): THREE.Color {
  const l = (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) * 0.45;
  return c.multiplyScalar(0.3).lerp(_g.setRGB(l, l, l * 1.1), 0.5);
}
const same = (c: THREE.Color) => c;

interface Isle {
  def: MapIsland;
  group: THREE.Group;
  /** Name plate candidate points (local coordinates): the tip of the rock cone and the island edge straight ahead, taking whichever is lower on screen */
  anchors: THREE.Vector3[];
  towerTop: THREE.Vector3;
  anim: ((dt: number, t: number, w: THREE.Vector3) => void)[];
  /** Points used for framing (local coordinates) */
  fit: THREE.Vector3[];
  /** Name plate on the side (-1 left, 1 right), 0 = below */
  side: number;
  R: number;
}

function buildIsle(def: MapIsland, reg: RegionDef, scene: MapScene, low: boolean): Isle {
  const group = new THREE.Group();
  const towerTop = new THREE.Vector3(0, 1.2, 0);
  const anim: Isle['anim'] = [];
  // The rift is gray-black to begin with, so fade it only a little, or the whole thing turns into a black hole
  const tint = def.locked ? (def.id === 'rift' ? (c: THREE.Color) => c.lerp(_g.setRGB(0.4, 0.38, 0.44), 0.25) : lockTint) : same;
  const glowTint = def.locked ? (def.id === 'rift' ? (c: THREE.Color) => c.multiplyScalar(0.7) : lockGlow) : same;
  const finishers: (() => void)[] = [];
  const fit: THREE.Vector3[] = [];
  let seed = 1;
  for (const ch of def.id) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const r = rng(seed + 7);

  const makeCtx = (spec: BodySpec, g: THREE.Group, off: THREE.Vector3): IsleCtx => {
    const b = new MapBatch();
    b.tint = tint;
    b.glowTint = glowTint;
    const feet: Foot[] = [];
    const plats: { o: Outline; x: number; z: number; y1: number }[] = [];
    const y = (x: number, z: number) => {
      let v = topY(spec, x, z);
      for (const p of plats) if (p.o.inside(x - p.x, z - p.z)) v = Math.max(v, p.y1);
      return v;
    };
    const ctx: IsleCtx = {
      b,
      g,
      r,
      y,
      inside: (x, z, m = 0) => spec.outline.inside(x, z, m),
      foot: (x, z, rr, k = 0.35) => feet.push({ x, z, r: rr, k }),
      def,
      look: reg.look,
      low,
      vfx: scene.vfx,
      anim,
      setTowerTop: (v) => towerTop.copy(v).add(off),
      getTowerTop: () => towerTop.clone().sub(off),
      plat: (o, x, z, y1) => plats.push({ o, x, z, y1 }),
      tint: (hex) => tint(new THREE.Color(hex)),
      sub: (s, x, sy, z, bob = 0) => {
        const sg = new THREE.Group();
        sg.position.set(x, sy, z);
        g.add(sg);
        const child = makeCtx(s, sg, off.clone().add(new THREE.Vector3(x, sy, z)));
        const ph = r() * 6;
        if (bob > 0) anim.push((_dt, t) => (sg.position.y = sy + Math.sin(t * 0.8 + ph) * bob));
        return child;
      },
      mesh: (geo, color, lined = true, heavy = false) => {
        const m = new THREE.Mesh(geo, lookMaterial(tint(new THREE.Color(color)), reg.look));
        g.add(m);
        if (lined) inkScenery(m, heavy ? { heavy: true } : {});
        return m;
      },
      glowMesh: (geo, color, k = 1.7, additive = false) => {
        const c = glowTint(new THREE.Color(color).multiplyScalar(k));
        const mat = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
        if (additive) Object.assign(mat, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const m = new THREE.Mesh(geo, mat);
        g.add(m);
        return m;
      },
    };
    finishers.push(() => {
      b.heavy = false;
      const { top, under } = islandBody(spec, feet);
      b.addVC(top, new THREE.Matrix4(), b.nextPart());
      b.addVC(under, new THREE.Matrix4(), b.nextPart());
      b.build(g, reg.look);
      // Framing: eight points on the island edge + the tip of the rock cone
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rr = spec.outline.rAt(a);
        fit.push(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr).add(off));
      }
      const [tx, tz] = spec.tip ?? [0, 0];
      fit.push(new THREE.Vector3(tx, -spec.depth, tz).add(off));
    });
    return ctx;
  };

  const main = makeCtx(reg.body, group, new THREE.Vector3());
  reg.build(main);
  for (const f of finishers) f();
  fit.push(towerTop.clone());
  const body = reg.body;
  const tip = body.tip ?? [0, 0];
  const anchors = reg.label ? [new THREE.Vector3(...reg.label)] : [new THREE.Vector3(tip[0], -body.depth - 0.1, tip[1]), new THREE.Vector3(0, -0.3, body.outline.rAt(Math.PI / 2) + 0.05)];
  const side = reg.side ?? 0;
  if (side) anchors.splice(0, anchors.length, new THREE.Vector3(side * (body.outline.rAt(side > 0 ? 0 : Math.PI) + 0.15), -0.35, 0.3));
  return { def, group, anchors, towerTop, anim, fit, side, R: body.outline.R };
}

export class MapScene extends MenuScene {
  islands: Isle[] = [];
  /** Outline fade-out distance before the scene is entered, restored on exit */
  private inkFade: [number, number];
  private pathDots: THREE.InstancedMesh | null = null;
  private dotInfo: { pos: THREE.Vector3; state: 0 | 1 | 2; seg: number }[] = [];
  private beacon: THREE.Group | null = null;
  private sky: ReturnType<typeof buildSky>;
  private world = new THREE.Vector3();

  constructor(stage: Stage, islands: MapIsland[]) {
    super(stage);
    const ink = stage.ink.core.style;
    this.inkFade = [ink.sceneNear, ink.sceneFar];
    LIGHT.dir.value.set(0.42, 0.86, 0.36).normalize();
    LIGHT.ambient.value.set(0x9a9ac8);
    LIGHT.rimColor.value.set(0xffffff);
    LIGHT.shadowTint.value.set(0x4a4a90);
    stage.scene.fog = new THREE.Fog(0x5a70b8, 70, 170);
    const low = stage.quality === 'low';
    this.sky = buildSky(this.root, low);
    for (const def of islands) {
      const reg = DEFS[def.id] ?? DEFS.rift;
      const isle = buildIsle(def, reg, this, low);
      isle.group.position.copy(def.pos);
      this.root.add(isle.group);
      this.islands.push(isle);
    }
    this.sky.setShadows(
      this.islands.map((i) => ({ x: i.def.pos.x, z: i.def.pos.z, r: (DEFS[i.def.id] ?? DEFS.rift).body.outline.R * 1.05, h: i.def.pos.y - SEA_Y })),
      LIGHT.dir.value,
    );
    const cur = this.islands.find((i) => i.def.current);
    if (cur) this.beacon = this.buildBeacon(cur.def.pos.clone().add(cur.towerTop));
    this.buildPath(islands);
    this.fitCamera();
    // For tests: with ?devsave the map can be driven from the console (for example to zoom the camera in on an island)
    if (new URLSearchParams(location.search).has('devsave')) (window as unknown as { __map: MapScene }).__map = this;
  }

  private portrait(): boolean {
    return this.stage.container.clientHeight > this.stage.container.clientWidth;
  }

  /** UI scale (the same calculation as uiZoom in ui/uiScale.ts; fixed at 1 on phones) */
  private uiz(): number {
    return Math.max(1, Math.min(1.8, Math.floor(Math.min(window.innerWidth / 1366, window.innerHeight / 768) * 20) / 20));
  }

  /** Phone: the name plate sits under the island edge (covering its own rock cone) and does not extend down into the next row of islands */
  private anchorsOf(i: Isle): THREE.Vector3[] {
    return this.stage.container.clientHeight <= 560 && !i.side ? [i.anchors[i.anchors.length - 1]] : i.anchors;
  }

  /** Approximate pixel size of a name plate (width, height) */
  private labelSize(): [number, number] {
    const phone = this.stage.container.clientHeight <= 560;
    const z = this.uiz();
    return phone ? [104, 36] : [130 * z, 46 * z];
  }

  /**
   * Framing: all the islands (island edge, rock cone, tower top) and name plates land inside the frame without touching the title bar above;
   * find the distance first, then center the content within the usable area
   */
  private fitCamera(): void {
    const W = this.stage.container.clientWidth;
    const H = Math.max(1, this.stage.container.clientHeight);
    const portrait = this.portrait();
    const el = portrait ? 1.3 : 0.62;
    const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const cam = this.stage.camera.clone();
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    const pts: THREE.Vector3[] = [];
    const labels: THREE.Vector3[] = [];
    for (const i of this.islands) {
      for (const p of i.fit) pts.push(p.clone().add(i.def.pos));
      for (const a of i.anchors) labels.push(a.clone().add(i.def.pos));
      // The target island's arrow (bouncing above the tower top) must also stay below the title bar
      if (i.def.current) pts.push(i.towerTop.clone().add(i.def.pos).add(new THREE.Vector3(0, 1.8, 0)));
    }
    const [lw, lh] = this.labelSize();
    const topBar = (H <= 560 ? 48 : 60 * this.uiz()) + 6;
    const topLimit = 1 - (2 * topBar) / H;
    const bottom = -0.97;
    const target = new THREE.Vector3();
    for (const p of pts) target.add(p);
    target.divideScalar(pts.length).setY(0);
    const bounds = (d: number) => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let x0 = 1e9;
      let x1 = -1e9;
      let y0 = 1e9;
      let y1 = -1e9;
      for (const p of pts) {
        const v = p.clone().project(cam);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      // Name plates: for each island take the lowest candidate point on screen and hang the plate below it; side plates are vertically centered
      for (const i of this.islands) {
        if (i.side) {
          const v = i.anchors[0].clone().add(i.def.pos).project(cam);
          x0 = Math.min(x0, i.side < 0 ? v.x - (2 * lw) / W : v.x);
          x1 = Math.max(x1, i.side < 0 ? v.x : v.x + (2 * lw) / W);
          y0 = Math.min(y0, v.y - lh / H);
          y1 = Math.max(y1, v.y + lh / H);
          continue;
        }
        let low = 1e9;
        let lx = 0;
        for (const a of this.anchorsOf(i)) {
          const v = a.clone().add(i.def.pos).project(cam);
          if (v.y < low) {
            low = v.y;
            lx = v.x;
          }
        }
        x0 = Math.min(x0, lx - lw / W);
        x1 = Math.max(x1, lx + lw / W);
        y0 = Math.min(y0, low - (2 * lh) / H);
      }
      return { x0, x1, y0, y1 };
    };
    let d = 16;
    for (; d < 160; d += 0.5) {
      const b = bounds(d);
      if (b.x1 - b.x0 < 1.9 && b.y1 - b.y0 < topLimit - bottom) break;
    }
    // Centering: move the content's center to the center of the usable area (approximate under perspective, repeated twice)
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    for (let k = 0; k < 3; k++) {
      const b = bounds(d);
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2 - (topLimit + bottom) / 2;
      const hh = d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      target.addScaledVector(right, cx * hh * cam.aspect).addScaledVector(up, cy * hh);
    }
    this.rig.setBase(target.clone().addScaledVector(dir, d), target);
    // With the camera at distance d from the map center: lines on the islands (about d ± 12) stay at full strength, and only farther clouds start to fade
    const ink = this.stage.ink.core.style;
    ink.sceneNear = d + 12;
    ink.sceneFar = d + 60;
  }

  dispose(): void {
    super.dispose();
    const ink = this.stage.ink.core.style;
    [ink.sceneNear, ink.sceneFar] = this.inkFade;
  }

  /** Adventure route: motes linking the islands in unlock order */
  private buildPath(islands: MapIsland[]): void {
    const pts = islands.map((i) => i.pos.clone().setY(i.pos.y * 0.6 + 0.35));
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const segLen = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const total = segLen.reduce((a, b) => a + b, 0);
    const count = Math.floor(total / 0.7);
    for (let k = 0; k <= count; k++) {
      const u = k / count;
      // Work out which segment we are on from the arc-length fraction
      let acc = 0;
      let seg = 0;
      for (; seg < segLen.length - 1; seg++) {
        if (acc + segLen[seg] >= u * total) break;
        acc += segLen[seg];
      }
      const t = (u * total - acc) / segLen[seg];
      if (t < 0.28 || t > 0.72) continue; // No dots on the islands
      const dest = islands[seg + 1];
      const state: 0 | 1 | 2 = dest.cleared ? 2 : dest.locked ? 0 : 1;
      this.dotInfo.push({ pos: curve.getPointAt(u), state, seg });
    }
    const geo = new THREE.OctahedronGeometry(0.15);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, this.dotInfo.length));
    const m = new THREE.Matrix4();
    const cols = [new THREE.Color(0x6a70a8), new THREE.Color(0xffffff).multiplyScalar(1.5), new THREE.Color(0xffc850).multiplyScalar(1.9)];
    this.dotInfo.forEach((d, i) => {
      m.makeTranslation(d.pos.x, d.pos.y, d.pos.z);
      im.setMatrixAt(i, m);
      im.setColorAt(i, cols[d.state]);
    });
    im.count = this.dotInfo.length;
    this.pathDots = im;
    this.root.add(im);
  }

  /** Current objective: a golden light pillar and arrow above the Seal Tower */
  private buildBeacon(at: THREE.Vector3): THREE.Group {
    const g = new THREE.Group();
    g.position.copy(at);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.3, 5.5, 20, 1, true),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        // At the top, vUv.y interpolates to slightly above 1, and pow of a negative base is NaN, which the clean-up before bloom turns into a ring of black dots, so the base must be clamped to 0 or above
        fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float a = pow(max(1.0 - vUv.y, 0.0), 1.6) * (0.5 + 0.18*sin(vUv.y*30.0 - uTime*4.0)); gl_FragColor = vec4(vec3(1.0,0.74,0.22), a*0.9); }`,
      }),
    );
    beam.position.y = 2.6;
    beam.name = 'beam';
    g.add(beam);
    // The light pillar uses normal blending (additive blending would turn into a white sheet over the snow of the Tidesong Isles), and the arrow is solid gold with an outline
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.78, 4), sceneMaterial(0xffb020, { emissive: 0xff9a10, emissiveAmt: 0.45, rim: 0.6 }));
    arrow.rotation.x = Math.PI;
    arrow.position.y = 1.5;
    arrow.name = 'arrow';
    g.add(arrow);
    inkScenery(arrow, { heavy: true });
    this.root.add(g);
    return g;
  }

  /** Name plate position: the lowest point under the island (landscape); in portrait it goes on the inner side of the island, to avoid covering the islands above and below */
  screenPositions(): { id: string; x: number; y: number; align: 'below' | 'left' | 'right' }[] {
    const portrait = this.portrait();
    return this.islands.map((i) => {
      const x = i.def.pos.x;
      const align = portrait && Math.abs(x) > 0.5 ? (x < 0 ? 'right' : 'left') : 'below';
      if (align !== 'below') {
        const p = this.stage.project(i.group.position.clone().add(new THREE.Vector3(x < 0 ? 1.9 : -1.9, 0.3, 0.3)));
        return { id: i.def.id, x: p.x, y: p.y, align };
      }
      if (i.side) {
        const p = this.stage.project(i.group.position.clone().add(i.anchors[0]));
        return { id: i.def.id, x: p.x, y: p.y, align: i.side < 0 ? 'left' : 'right' };
      }
      let best = { x: 0, y: -1e9 };
      for (const a of this.anchorsOf(i)) {
        const p = this.stage.project(i.group.position.clone().add(a));
        if (p.y > best.y) best = { x: p.x, y: p.y };
      }
      const c = this.stage.project(i.group.position);
      return { id: i.def.id, x: c.x, y: best.y + 2, align };
    });
  }

  protected tick(_dt: number, fxDt: number): void {
    this.sky.tick(this.time);
    for (const [n, i] of this.islands.entries()) {
      i.group.position.y = i.def.pos.y + Math.sin(this.time * 0.7 + n * 1.3) * 0.1;
      this.world.copy(i.group.position);
      for (const f of i.anim) f(fxDt, this.time, this.world);
    }
    if (this.pathDots) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      const yAxis = new THREE.Vector3(0, 1, 0);
      this.dotInfo.forEach((d, i) => {
        const pulse = d.state === 1 ? 1 + 0.6 * Math.max(0, Math.sin(this.time * 4 - i * 0.55)) : d.state === 2 ? 1.1 : 0.8;
        sc.setScalar(pulse);
        q.setFromAxisAngle(yAxis, this.time * 1.5 + i);
        m.compose(d.pos, q, sc);
        this.pathDots!.setMatrixAt(i, m);
      });
      this.pathDots.instanceMatrix.needsUpdate = true;
    }
    if (this.beacon) {
      const cur = this.islands.find((i) => i.def.current)!;
      this.beacon.position.copy(cur.group.position).add(cur.towerTop);
      const beam = this.beacon.getObjectByName('beam') as THREE.Mesh;
      (beam.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
      const arrow = this.beacon.getObjectByName('arrow')!;
      arrow.position.y = 1.0 + Math.abs(Math.sin(this.time * 3)) * 0.35;
      arrow.rotation.y += fxDt * 2;
      if (Math.random() < fxDt * (this.stage.quality === 'low' ? 4 : 9)) {
        const p = this.beacon.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, -0.6, (Math.random() - 0.5) * 1.2));
        this.vfx.emit({ pos: p, count: 1, color: [0xffc040, 0xff9a20], speed: [1.2, 2.4], dir: new THREE.Vector3(0, 1, 0), spread: 0.1, life: [0.8, 1.3], size: [0.1, 0.18], intensity: 0.8 });
      }
    }
  }
}
