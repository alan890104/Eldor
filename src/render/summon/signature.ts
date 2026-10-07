// A signature segment for each SSR: so descents of the same element also look different.
//   fall    the height and timing of the descent (`aeroth` dives from the stratosphere, `terragon` slowly drops with great weight)
//   enter   when the descent begins (background props: moon, blood moon, constellation, clock...)
//   land    the moment of landing
//   climax  the moment the silhouette bursts
//   kill    clear all persistent effects and changes made to the model

import * as THREE from 'three';
import type { Element } from '../../../sim/types.ts';
import { glowTex, runeCircleTex } from '../textures.ts';
import { additive, type FxLayer } from '../vfx.ts';
import { ease } from '../tween.ts';
import { ELEMENT_COLOR, ELEMENT_HI } from './flood.ts';
import type { SummonScene } from './scene.ts';

export interface Signature {
  fall?: { height: number; dur: number };
  enter?(): void;
  land?(): void;
  climax?(): void;
  kill(): void;
}

const UP = new THREE.Vector3(0, 1, 0);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function billboard(sc: SummonScene, obj: THREE.Object3D): FxLayer {
  return sc.vfx.layer(obj, () => obj.quaternion.copy(sc.stage.camera.quaternion));
}

function glowSprite(color: number, intensity: number, size: number, opacity = 1): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
}

/** Persistent particle emission (rate per second), used for the mane flame and the sand stream */
function emitter(sc: SummonScene, rate: number, fn: (n: number) => void): FxLayer {
  let acc = 0;
  return sc.vfx.layer(new THREE.Object3D(), (dt) => {
    acc += dt * rate;
    const n = Math.floor(acc);
    if (!n) return;
    acc -= n;
    fn(n);
  });
}

// ───────────────────────── The eight sacred spirits ─────────────────────────

/** `ignisar`: sparks keep flying from the mane flame; at the burst a corona ring rises behind it */
function ignisar(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    enter: () => {
      layers.push(emitter(sc, 40, (n) => sc.vfx.emit({ pos: sc.head(), count: n, color: [0xff3a12, 0xff8a2a, 0xffe066], speed: [0.5, 1.6], dir: UP, spread: 0.9, life: [0.25, 0.5], size: [0.05, 0.13], sizeEnd: 0.02, radius: sc.h * 0.2, gravity: -3, drag: 1.2, intensity: 0.8 })));
    },
    climax: () => {
      const h = sc.h;
      const hp = sc.head();
      const toCam = sc.stage.camera.position.clone().sub(hp).normalize();
      const pos = hp.clone().addScaledVector(toCam, -h * 0.9);
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x1a0604, transparent: true, depthWrite: false, toneMapped: false }));
      const halo = glowSprite(0xff7a2a, 1.4, 3.2, 0.9);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.12, 64), additive(0xffd27a, undefined, 1.6));
      g.add(halo, disc, rim);
      g.position.copy(pos);
      let s = 0;
      void sc.vfx.spawn(g, 1.4, (k) => {
        g.quaternion.copy(sc.stage.camera.quaternion);
        s = ease.outBack(Math.min(1, k / 0.25)) * (h * 0.9 + 0.8);
        g.scale.setScalar(Math.max(1e-3, s));
        const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        halo.material.opacity = 0.9 * fade;
        (disc.material as THREE.MeshBasicMaterial).opacity = fade;
        (rim.material as THREE.MeshBasicMaterial).opacity = fade;
      });
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

/** `thalassene`: a full moon rises; on landing the tide spreads ring by ring and bubbles float up; at the burst a water dome surges out */
function thalassene(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 2, dur: 1.0 },
    enter: () => {
      const moon = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaf6ff).multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      const halo = glowSprite(0xbff3ff, 1.1, 3.2, 0);
      moon.add(halo, disc);
      moon.position.set(6, 2, -34);
      moon.scale.setScalar(3.2);
      layers.push(billboard(sc, moon));
      void sc.tw.to(1.6, (k) => {
        moon.position.y = 2 + 14 * ease.outCubic(k);
        (disc.material as THREE.MeshBasicMaterial).opacity = k;
        halo.material.opacity = k * 0.7;
      }, ease.linear, 'fx');
    },
    land: () => {
      const p = sc.pedPos().setY(0.08);
      for (let i = 0; i < 3; i++) setTimeout(() => void sc.vfx.ring(p, i % 2 ? 0xbff3ff : 0x3db7ff, 1, 14 + i * 3, 1.2), i * 140);
      for (let i = 0; i < 6; i++) void sc.vfx.bubble(p.clone().add(new THREE.Vector3(rnd(-3, 3), 0.3, rnd(-2, 2))), 0x3db7ff, rnd(0.4, 1), rnd(0.8, 1.4));
    },
    climax: () => {
      const h = sc.h;
      void sc.vfx.dome(sc.center(), 0x3db7ff, 0.5, h * 1.6 + 2, 0.6);
      sc.vfx.emit({ pos: sc.pedPos().setY(0.6), count: 120, color: [0xbff3ff, 0x3db7ff, 0xffffff], speed: [4, 10], dir: UP, spread: 0.7, life: [0.5, 1], size: [0.08, 0.2], radius: h * 0.6, gravity: 9, drag: 0.5, intensity: 0.9 });
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

/** `sylvaron`: giant petals grow around the display stand; on landing a vine circle blooms; at the burst petals fill the sky */
function sylvaron(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 1, dur: 0.95 },
    enter: () => {
      const g = new THREE.Group();
      const petals: THREE.Mesh[] = [];
      // Seven petals arranged in a half circle behind the display stand (the camera side is left empty, so the screen is not smothered)
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 1.1 + (i / 6) * Math.PI * 0.8;
        const geo = new THREE.ConeGeometry(0.55, 2.6, 8, 1, true);
        geo.translate(0, 1.3, 0);
        const mat = additive(i % 2 ? 0xffb0d0 : 0x9fe8a0, undefined, 0.3);
        mat.depthWrite = false;
        const m = new THREE.Mesh(geo, mat);
        m.position.set(Math.cos(a) * 3.6, 0.3, Math.sin(a) * 3.6 + 2.5);
        m.rotation.z = -Math.cos(a) * 0.55;
        m.rotation.x = Math.sin(a) * 0.55;
        m.scale.setScalar(1e-3);
        petals.push(m);
        g.add(m);
      }
      layers.push(sc.vfx.layer(g, (dt) => (g.rotation.y += dt * 0.15)));
      petals.forEach((m, i) => void sc.tw.to(0.9, (k) => m.scale.setScalar(Math.max(1e-3, ease.outBack(Math.max(0, k - i * 0.05) / 0.6))), ease.linear, 'fx'));
    },
    land: () => {
      void sc.vfx.circle(sc.pedPos().setY(0.55), 0x5fcb5a, 5, 1.6, undefined, 2);
    },
    climax: () => {
      sc.vfx.emit({ pos: sc.center(), count: 220, color: [0xffb0d0, 0xfff0f8, 0xd8f59a], speed: [3, 9], life: [1, 2], size: [0.12, 0.28], gravity: 1.5, drag: 1.5, spin: 5, atlas: 3, intensity: 0.9 });
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

/** `aeroth`: dives from high in the sky, wrapped in a cone of vapor; landing is a cross-shaped blade of light, and at the burst feathers scatter */
function aeroth(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 14, dur: 0.5 },
    enter: () => {
      const c = sc.current;
      if (!c) return;
      const h = c.worldHeight;
      const geo = new THREE.ConeGeometry(h * 0.9, h * 3, 24, 1, true);
      geo.translate(0, -h * 1.5, 0);
      const mat = additive(0xdffcff, undefined, 0.35);
      const cone = new THREE.Mesh(geo, mat);
      cone.rotation.x = Math.PI;
      layers.push(sc.vfx.layer(cone, () => {
        cone.position.copy(c.root.position).setY(c.root.position.y + h * 0.5);
        mat.opacity = Math.min(1, (c.root.position.y - 0.5) / 4) * 0.5;
      }));
      layers.push(emitter(sc, 60, (n) => sc.vfx.emit({ pos: c.root.position.clone().setY(c.root.position.y + h * 0.6), count: n, color: [0xffffff, 0x9fe8e0], speed: [3, 8], dir: UP, spread: 0.6, life: [0.3, 0.6], size: [0.06, 0.16], radius: h * 0.4, drag: 2, intensity: 0.7, atlas: 3, spin: 6 })));
    },
    land: () => {
      const c = sc.center();
      const toCam = sc.stage.camera.position.clone().sub(c).normalize();
      void sc.vfx.slash(c, 0xffffff, sc.h * 1.2 + 1.5, 0.6, toCam, 0.3);
      void sc.vfx.slash(c, 0x9fe8e0, sc.h * 1.2 + 1.5, -0.9, toCam, 0.32);
      layers.forEach((l) => l.kill());
    },
    climax: () => {
      const hp = sc.head();
      const toCam = sc.stage.camera.position.clone().sub(hp).normalize();
      void sc.vfx.crescent(hp.clone().add(new THREE.Vector3(-3, 1, 0)), hp.clone().add(new THREE.Vector3(3, -1, 0)), 0xffffff, 1.2, 0.3, 0.3);
      void sc.vfx.crescent(hp.clone().add(new THREE.Vector3(3, 1, 0)), hp.clone().add(new THREE.Vector3(-3, -1, 0)), 0x9fe8e0, 1.2, 0.3, -0.3);
      void toCam;
      sc.vfx.emit({ pos: hp, count: 90, color: [0xffffff, 0x9fe8e0], speed: [3, 8], life: [0.8, 1.6], size: [0.1, 0.24], gravity: 0.8, drag: 1.2, spin: 6, atlas: 3, intensity: 0.9 });
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

/** `terragon`: drops heavily; landing is a ring of stone pillars and flying rocks, with the screen shaking one extra beat; at the burst the stone pillars rise another ring */
function terragon(sc: SummonScene): Signature {
  return {
    fall: { height: 3, dur: 1.1 },
    land: () => {
      const p = sc.pedPos();
      sc.stage.hitStop(80);
      sc.rig.addTrauma(0.5);
      void sc.vfx.spikes(p, 0xc49a5a, 10, sc.h * 0.8 + 2.4, 1.6, 1.2);
      void sc.vfx.debris(p.clone().setY(0.6), 0x8a6a48, 18, 9, 1.8, 0.35, 1.5);
      void sc.vfx.ring(p.clone().setY(0.55), 0xe8c890, 1, 18, 1.0);
    },
    climax: () => {
      const p = sc.pedPos();
      void sc.vfx.spikes(p, 0xe8c890, 14, sc.h * 1.2 + 3.6, 2.6, 1.4);
      sc.vfx.smoke({ pos: p.clone().setY(0.4), count: 60, color: [0x8a6a40, 0x5a4020], speed: [3, 7], dir: UP, spread: 1.3, life: [1, 1.8], size: [0.8, 1.6], sizeEnd: 3, radius: 2, drag: 1.5 });
    },
    kill: () => {},
  };
}

/** `voltarion`: nine rings of thunder in the sky fall layer by layer as a countdown; on landing it is pierced by a bolt from heaven; at the burst the screen inverts to white and freezes */
function voltarion(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 6, dur: 0.6 },
    enter: () => {
      const p = sc.pedPos();
      for (let i = 0; i < 9; i++) {
        const y = 4 + (8 - i) * 1.6;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2 + i * 0.35, 0.045, 6, 64), additive(i % 3 === 2 ? 0xfff6a8 : 0xb38cff, undefined, 0.7));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(p.x, y, p.z);
        void sc.vfx.spawn(ring, 1.6 + i * 0.04, (k, dt) => {
          ring.rotation.z += dt * (1 + i * 0.3);
          ring.position.y = y - ease.inQuad(k) * 2;
          (ring.material as THREE.MeshBasicMaterial).opacity = (k < 0.1 ? k / 0.1 : 1 - Math.pow(k, 3)) * 0.6;
        });
      }
    },
    land: () => {
      const c = sc.center();
      for (let i = 0; i < 3; i++) void sc.vfx.bolt(c.clone().add(new THREE.Vector3(rnd(-3, 3), 20, rnd(-2, 2))), c, i ? 0xb38cff : 0xffffff, 0.3, 0.14 - i * 0.03);
      void sc.vfx.ring(sc.pedPos().setY(0.55), 0xfff6a8, 0.5, 9, 0.5);
    },
    climax: () => {
      sc.stage.grade.invert = 1;
      void sc.tw.to(0.09, (k) => (sc.stage.grade.invert = k < 0.6 ? 1 : 0), ease.linear, 'real');
      const c = sc.center();
      for (let i = 0; i < 5; i++) void sc.vfx.bolt(c.clone().add(new THREE.Vector3(rnd(-4, 4), 8, rnd(-3, 3))), c.clone().add(new THREE.Vector3(rnd(-1, 1), rnd(-0.5, 0.8), rnd(-1, 1))), 0xfff6a8, 0.25, 0.08);
    },
    kill: () => {
      sc.stage.grade.invert = 0;
      layers.forEach((l) => l.kill());
    },
  };
}

/** `luminael`: a morning star rises behind it, and the whole descent is a backlit silhouette; at the burst the screen flips for a beat */
function luminael(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 4, dur: 1.0 },
    enter: () => {
      const star = new THREE.Group();
      const core = glowSprite(0xfff0c0, 1.2, 1.8, 0);
      const halo = glowSprite(0xffc040, 1.0, 8, 0);
      star.add(halo, core);
      star.position.set(0, 1, -12);
      layers.push(sc.vfx.layer(star, () => {}));
      void sc.tw.to(1.3, (k) => {
        star.position.y = 1 + 7 * ease.outCubic(k);
        core.material.opacity = k;
        halo.material.opacity = k * 0.5;
      }, ease.linear, 'fx');
      layers.push(emitter(sc, 12, (n) => sc.vfx.emit({ pos: star.position, count: n, color: [0xffffff, 0xffe680], speed: [0.5, 1.5], life: [1.5, 3], size: [0.1, 0.22], radius: 1, gravity: 0.6, drag: 1, spin: 2, atlas: 3, intensity: 0.8 })));
    },
    climax: () => {
      void sc.tw.to(0.5, (k) => (sc.rig.roll = Math.sin(k * Math.PI) * 0.16), ease.linear, 'fx');
      sc.stage.grade.lift.set(0x1a1204);
      void sc.tw.to(0.3, (k) => sc.stage.grade.lift.set(0x1a1204).multiplyScalar(1 - k), ease.outQuad, 'fx');
      for (const e of sc.eyes()) void sc.vfx.glint(e, 0xffd070, 0.22 + sc.h * 0.05, 0.6, 4);
    },
    kill: () => {
      sc.rig.roll = 0;
      layers.forEach((l) => l.kill());
    },
  };
}

/** `noxfang`: a blood moon hangs high and only red eyes remain in the dark; at the burst a red claw mark slashes across the screen */
function noxfang(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 2, dur: 0.7 },
    enter: () => {
      const moon = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3040).multiplyScalar(1.1), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      const halo = glowSprite(0xff2040, 1.2, 3.4, 0);
      moon.add(halo, disc);
      moon.position.set(-5, 15, -34);
      moon.scale.setScalar(3.6);
      layers.push(billboard(sc, moon));
      void sc.tw.to(0.8, (k) => {
        (disc.material as THREE.MeshBasicMaterial).opacity = k;
        halo.material.opacity = k * 0.8;
      }, ease.linear, 'fx');
    },
    land: () => {
      for (const e of sc.eyes()) void sc.vfx.glint(e, 0xff2040, 0.3 + sc.h * 0.08, 1.2, 3);
    },
    climax: () => {
      const hp = sc.head();
      const h = sc.h;
      void sc.vfx.crescent(hp.clone().add(new THREE.Vector3(-h * 1.6 - 2, h * 0.5, 0.5)), hp.clone().add(new THREE.Vector3(h * 1.6 + 2, -h * 0.5, 0.5)), 0xff2040, 1.4, 0.28, 0.2, 0.4);
      sc.stage.grade.lift.set(0x180004);
      void sc.tw.to(0.3, (k) => sc.stage.grade.lift.set(0x180004).multiplyScalar(1 - k), ease.outQuad, 'fx');
      for (const e of sc.eyes()) void sc.vfx.glint(e, 0xff2040, 0.4 + h * 0.1, 0.8, 4);
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

// ───────────────────────── Legends ─────────────────────────

/** `eldarin`: a golden pact ring is written and spins around it; at the burst a seal falls from the sky and stamps down */
function eldarin(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 3, dur: 0.9 },
    enter: () => {
      const g = new THREE.Group();
      const c = sc.pedPos().setY(0.5 + sc.h * 0.5);
      const rings: { m: THREE.Mesh; axis: THREE.Vector3; spd: number }[] = [];
      [[0, 0], [1, Math.PI / 2], [2, Math.PI / 4]].forEach(([seed, tilt], i) => {
        const r = sc.h * 0.9 + 1.2 + i * 0.5;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), additive(0xffd070, runeCircleTex(seed), 1.1));
        m.rotation.x = -Math.PI / 2 + tilt;
        m.position.copy(c);
        rings.push({ m, axis: new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0).normalize(), spd: (i % 2 ? -1 : 1) * (0.6 + i * 0.3) });
        g.add(m);
      });
      layers.push(sc.vfx.layer(g, (dt) => rings.forEach((r) => r.m.rotateZ(dt * r.spd))));
      rings.forEach((r, i) => void sc.tw.to(0.7, (k) => ((r.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, k * 1.5 - i * 0.2))), ease.outQuad, 'fx'));
    },
    climax: () => {
      const p = sc.pedPos();
      void sc.vfx.circle(p.clone().setY(0.56), 0xffd070, sc.h * 1.4 + 4, 1.6, undefined, 1);
      void sc.vfx.pillar(p, 0xffd070, sc.h * 0.5 + 0.8, 18, 0.9);
      void sc.vfx.ring(p.clone().setY(0.6), 0xfff0c0, 1, sc.h * 2 + 8, 0.9);
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

/** `astragate`: a whole constellation is connected in the sky; at the burst starlight pours down from the Star Gate */
function astragate(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 4, dur: 0.9 },
    enter: () => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 14; i++) pts.push(new THREE.Vector3(rnd(-22, 22), rnd(8, 24), rnd(-40, -26)));
      const seg: number[] = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[Math.floor(Math.random() * i)];
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0xffe680).multiplyScalar(1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const lines = new THREE.LineSegments(geo, lineMat);
      const g = new THREE.Group();
      g.add(lines);
      const stars = pts.map((p) => {
        const s = glowSprite(0xffffff, 1.4, rnd(0.8, 1.6), 0);
        s.position.copy(p);
        g.add(s);
        return s;
      });
      layers.push(sc.vfx.layer(g, (_dt, t) => stars.forEach((s, i) => (s.material.opacity = Math.min(1, t * 1.5 - i * 0.05) * (0.7 + 0.3 * Math.sin(t * 3 + i))))));
      void sc.tw.to(1.2, (k) => (lineMat.opacity = k * 0.8), ease.outQuad, 'fx');
    },
    climax: () => {
      const gate = sc.gatePos();
      sc.vfx.emit({ pos: gate, count: 260, color: [0xffe680, 0xffffff, 0xc49a5a], speed: [3, 9], dir: new THREE.Vector3(0, -1, 0.6).normalize(), spread: 0.5, life: [0.8, 1.6], size: [0.12, 0.28], radius: 3, gravity: 4, drag: 0.6, intensity: 1, atlas: 1 });
      void sc.vfx.circle(gate, 0xffe680, 7, 1.2, new THREE.Vector3(0, 0, 1), 2);
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

/** `voidchild`: black holes gnaw gaps out of the screen one by one; at the burst all light is sucked in and the camera pushes in dizzily */
function voidchild(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 2, dur: 0.8 },
    enter: () => {
      const c = sc.pedPos().setY(0.5 + sc.h * 0.6);
      for (let i = 0; i < 7; i++) {
        const hole = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
        const rim = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.08, 40), additive(0x9a5aff, undefined, 1.2));
        rim.material.depthTest = false;
        hole.add(disc, rim);
        hole.renderOrder = 15;
        hole.position.copy(c).add(new THREE.Vector3(rnd(-6, 6), rnd(-2, 5), rnd(-3, 3)));
        const size = rnd(0.6, 1.8);
        const delay = i * 0.12;
        hole.scale.setScalar(1e-3);
        layers.push(sc.vfx.layer(hole, (_dt, t) => {
          hole.quaternion.copy(sc.stage.camera.quaternion);
          const k = Math.max(0, Math.min(1, (t - delay) / 0.4));
          hole.scale.setScalar(Math.max(1e-3, ease.outBack(k) * size * (1 + 0.08 * Math.sin(t * 5 + i))));
        }));
      }
    },
    climax: () => {
      const c = sc.center();
      sc.vfx.emit({ pos: c, count: 220, color: [0x9a5aff, 0x1a0f2e, 0xff4080], speed: [6, 12], inward: true, life: [0.4, 0.8], size: [0.08, 0.22], radius: sc.h * 2 + 3, drag: 0, intensity: 0.9 });
      const f0 = sc.stage.fovScale;
      void sc.tw.to(0.6, (k) => sc.stage.setFovScale(f0 + Math.sin(k * Math.PI) * 0.25), ease.linear, 'fx');
      sc.stage.grade.invert = 1;
      void sc.tw.to(0.12, (k) => (sc.stage.grade.invert = k < 0.5 ? 1 : 0), ease.linear, 'real');
      layers.forEach((l) => l.kill());
    },
    kill: () => {
      sc.stage.grade.invert = 0;
      layers.forEach((l) => l.kill());
    },
  };
}

/** `chronodragon`: a giant clock turns around it and time-sand falls from the sky; at the burst everything freezes, then resumes all at once */
function chronodragon(sc: SummonScene): Signature {
  const layers: FxLayer[] = [];
  return {
    fall: { height: 3, dur: 1.0 },
    enter: () => {
      const c = sc.pedPos().setY(0.5 + sc.h * 0.55);
      const R = sc.h * 1.1 + 1.8;
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 6, 96), additive(0xe8c890, undefined, 1.2));
      g.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.08, i % 3 ? 0.3 : 0.6, 0.08), additive(0xfff0c0, undefined, 1.3));
        tick.position.set(Math.cos(a) * (R - 0.35), Math.sin(a) * (R - 0.35), 0);
        tick.rotation.z = a - Math.PI / 2;
        g.add(tick);
      }
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, R * 0.8, 0.1), additive(0xffffff, undefined, 1.4));
      hand.geometry.translate(0, R * 0.4, 0);
      g.add(hand);
      g.position.copy(c);
      g.rotation.x = -0.35;
      layers.push(sc.vfx.layer(g, (dt) => {
        g.rotation.y += dt * 0.3;
        hand.rotation.z -= dt * 2.2;
      }));
      layers.push(emitter(sc, 90, (n) => sc.vfx.emit({ pos: c.clone().add(new THREE.Vector3(rnd(-R, R), R + 2, rnd(-1, 1))), count: n, color: [0xe8c890, 0xc49a5a, 0xfff0c0], speed: [0.2, 0.8], dir: new THREE.Vector3(0, -1, 0), spread: 0.1, life: [1.2, 2], size: [0.05, 0.12], gravity: 3, drag: 0.4, intensity: 0.8 })));
    },
    climax: () => {
      sc.stage.hitStop(380);
      sc.stage.grade.desat = 0.9;
      void sc.tw.to(0.7, (k) => (sc.stage.grade.desat = k < 0.55 ? 0.9 : 0.9 * (1 - (k - 0.55) / 0.45)), ease.linear, 'real');
      const c = sc.center();
      void sc.vfx.ring(c, 0xe8c890, 0.5, sc.h * 3 + 4, 0.9, sc.stage.camera.position.clone().sub(c));
    },
    kill: () => layers.forEach((l) => l.kill()),
  };
}

/** When there is no dedicated segment: just a simple landing ring in the element color */
function generic(sc: SummonScene, el: Element): Signature {
  return {
    land: () => void sc.vfx.ring(sc.pedPos().setY(0.55), ELEMENT_HI[el], 1, 10, 0.8),
    climax: () => void sc.vfx.dome(sc.center(), ELEMENT_COLOR[el], 0.5, sc.h * 1.5 + 2, 0.5),
    kill: () => {},
  };
}

const TABLE: Record<string, (sc: SummonScene) => Signature> = { ignisar, thalassene, sylvaron, aeroth, terragon, voltarion, luminael, noxfang, eldarin, astragate, voidchild, chronodragon };

export function signatureFor(sc: SummonScene, speciesId: string, el: Element): Signature {
  const f = TABLE[speciesId];
  return f ? f(sc) : generic(sc, el);
}
