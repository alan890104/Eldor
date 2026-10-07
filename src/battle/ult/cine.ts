// Shared tools for ultimate cinematics: post-processing color-grade tweens, framing relative to the caster, focus tracking, cinematic sound effects.
// Framing always stays on the audience side (the side of the default camera) and never crosses the line between the two spirits, because the scene only built a full backdrop for that side.

import * as THREE from 'three';
import { synth } from '../../audio/sfx.ts';
import type { SideId } from '../../engine/types.ts';
import { defaultGrade } from '../../render/stage.ts';
import { ease } from '../../render/tween.ts';
import type { BattleScene } from '../scene.ts';

/** Tweenable screen parameters (post-processing, bloom, zoom, roll) */
export interface Look {
  letterbox?: number;
  desat?: number;
  vignette?: number;
  isolate?: number;
  invert?: number;
  radial?: number;
  lines?: number;
  haze?: number;
  hazeRadius?: number;
  grain?: number;
  bloom?: number;
  fov?: number;
  roll?: number;
  tint?: THREE.ColorRepresentation;
  lift?: THREE.ColorRepresentation;
  linesColor?: THREE.ColorRepresentation;
}

type FocusKey = 'vig' | 'radial' | 'haze';
type Span = number | [number, number];
const at = (s: Span, k: number): number => (typeof s === 'number' ? s : s[0] + (s[1] - s[0]) * k);
const UP = new THREE.Vector3(0, 1, 0);
const _ray = new THREE.Raycaster();

export class Cine {
  sc: BattleScene;
  /** Sequence number of the last tween on each parameter: a new tween takes over and the old one stops automatically */
  private gen = new Map<string, number>();
  private seq = 0;
  private focus = new Map<FocusKey, () => THREE.Vector3 | null>();
  /** Characters hidden by offstage, with their visible flag from before hiding (a fallen character is already hidden, so restoring must not force it visible) */
  private hidden = new Map<SideId, boolean>();

  constructor(sc: BattleScene) {
    this.sc = sc;
    const off = sc.stage.add(() => this.update());
    sc.addCleanup(off);
  }

  // ───────────────────────── Post-processing ─────────────────────────

  /** Tween a screen parameter to a target value (fx clock: keeps running during hit-stop) */
  look(to: Look, dur = 0.3, e: (x: number) => number = ease.inOutQuad): Promise<void> {
    const st = this.sc.stage;
    const g = st.grade;
    const rig = this.sc.rig;
    const jobs: ((k: number) => void)[] = [];
    const num = (key: string, target: number | undefined, get: () => number, set: (v: number) => void) => {
      if (target === undefined) return;
      const tok = ++this.seq;
      this.gen.set(key, tok);
      const a = get();
      jobs.push((k) => {
        if (this.gen.get(key) === tok) set(a + (target - a) * k);
      });
    };
    const col = (key: string, target: THREE.ColorRepresentation | undefined, c: THREE.Color) => {
      if (target === undefined) return;
      const tok = ++this.seq;
      this.gen.set(key, tok);
      const a = c.clone();
      const b = new THREE.Color(target);
      jobs.push((k) => {
        if (this.gen.get(key) === tok) c.lerpColors(a, b, k);
      });
    };
    num('letterbox', to.letterbox, () => g.letterbox, (v) => (g.letterbox = v));
    num('desat', to.desat, () => g.desat, (v) => (g.desat = v));
    num('vignette', to.vignette, () => g.vignette, (v) => (g.vignette = v));
    num('isolate', to.isolate, () => g.isolate, (v) => (g.isolate = v));
    num('invert', to.invert, () => g.invert, (v) => (g.invert = v));
    num('radial', to.radial, () => g.radial, (v) => (g.radial = v));
    num('lines', to.lines, () => g.lines, (v) => (g.lines = v));
    num('haze', to.haze, () => g.haze, (v) => (g.haze = v));
    num('hazeRadius', to.hazeRadius, () => g.hazeRadius, (v) => (g.hazeRadius = v));
    num('grain', to.grain, () => g.grain, (v) => (g.grain = v));
    num('bloom', to.bloom, () => st.bloom.strength, (v) => (st.bloom.strength = v));
    num('fov', to.fov, () => st.fovScale, (v) => {
      st.setFovScale(v);
      this.sc.syncParticleScale();
    });
    num('roll', to.roll, () => rig.roll, (v) => (rig.roll = v));
    col('tint', to.tint, g.tint);
    col('lift', to.lift, g.lift);
    col('linesColor', to.linesColor, g.linesColor);
    if (dur <= 0) {
      for (const j of jobs) j(1);
      return Promise.resolve();
    }
    return this.sc.tw.to(dur, (k) => {
      for (const j of jobs) j(k);
    }, e, 'fx');
  }

  /** Snap to peak at once, then return to rest within dur seconds (the "beat" of radial blur and speed lines) */
  pulse(peak: Look, rest: Look, dur = 0.4, e: (x: number) => number = ease.outCubic): Promise<void> {
    void this.look(peak, 0);
    return this.look(rest, dur, e);
  }

  /** Inverted-color flash for two frames (the instant an ultimate lands) */
  invertFlash(sec = 0.05): void {
    const g = this.sc.stage.grade;
    const tok = ++this.seq;
    this.gen.set('invert', tok);
    g.invert = 1;
    void this.sc.tw.wait(sec, 'real').then(() => {
      if (this.gen.get('invert') === tok) g.invert = 0;
    });
  }

  /** The centers of the spotlight (vignette center), radial blur and heat haze follow a world position every frame; null cancels */
  track(fn: (() => THREE.Vector3 | null) | null, keys: FocusKey[] = ['vig', 'radial', 'haze']): void {
    for (const k of keys) {
      if (fn) this.focus.set(k, fn);
      else this.focus.delete(k);
    }
  }

  /** World position → post-processing screen position (0 to 1) */
  uv(p: THREE.Vector3): { x: number; y: number } {
    const st = this.sc.stage;
    st.camera.updateMatrixWorld();
    const u = st.toUv(p);
    return { x: u.x, y: u.y };
  }

  /** Screen-space shockwave, spreading out from where the world position lands */
  shock(p: THREE.Vector3, amt = 1, dur = 0.6, radius = 0.9): void {
    const u = this.uv(p);
    this.sc.stage.shockwave(u.x, u.y, amt, dur, radius);
  }

  private update(): void {
    if (!this.focus.size) return;
    const st = this.sc.stage;
    st.camera.updateMatrixWorld();
    const g = st.grade;
    for (const [k, fn] of this.focus) {
      const p = fn();
      if (!p) continue;
      const u = st.toUv(p);
      if (u.behind) continue;
      const target = k === 'vig' ? g.vigCenter : k === 'radial' ? g.radialCenter : g.hazeCenter;
      target.set(u.x, u.y);
    }
  }

  // ───────────────────────── Camera ─────────────────────────

  /** The horizontal direction the caster faces the opponent */
  forward(side: SideId): THREE.Vector3 {
    const a = this.sc.slots[side].home;
    const b = this.sc.slots[side === 0 ? 1 : 0].home;
    return b.clone().sub(a).setY(0).normalize();
  }

  /**
   * Bearing relative to the caster: yaw 0° = straight ahead of the caster (toward the opponent), 90° = directly beside the caster (the audience side), 180° = directly behind.
   * Returns the point that is dist away from center along that bearing, raised by rise.
   */
  orbitPos(side: SideId, center: THREE.Vector3, yawDeg: number, dist: number, rise: number): THREE.Vector3 {
    const f = this.forward(side);
    const aud = this.sc.rig.base.pos.clone().setY(0).sub(this.sc.slots[0].home.clone().add(this.sc.slots[1].home).multiplyScalar(0.5).setY(0));
    const sign = Math.sign(f.clone().cross(aud).y) || 1;
    const d = f.applyAxisAngle(UP, sign * THREE.MathUtils.degToRad(yawDeg));
    return center.clone().addScaledVector(d, dist).add(new THREE.Vector3(0, rise, 0));
  }

  /**
   * Camera obstacle avoidance: cast a line from look to pos; when solid objects of the arena (steps, pillars, rock walls, ground) block it,
   * return the position pulled in to pad before the blocker; if nothing blocks it, return a copy of pos. Sky, transparent and invisible meshes do not count.
   * The ray has to sweep the whole arena, so compute it once at the start of each camera position, not every frame.
   */
  safe(pos: THREE.Vector3, look: THREE.Vector3, pad = 0.4): THREE.Vector3 {
    const A = this.sc.arena;
    const dir = pos.clone().sub(look);
    const len = dir.length();
    if (len < 1e-4) return pos.clone();
    dir.divideScalar(len);
    A.group.updateMatrixWorld(true);
    _ray.set(look, dir);
    _ray.far = len + pad;
    for (const h of _ray.intersectObject(A.group, true)) {
      const m = h.object as THREE.Mesh;
      const mat = m.material as THREE.Material | THREE.Material[];
      if (!m.visible || Array.isArray(mat) || mat === A.skyMat || mat.transparent) continue;
      return look.clone().addScaledVector(dir, Math.max(0.3, Math.min(len, h.distance - pad)));
    }
    return pos.clone();
  }

  /**
   * When a caster-only camera position shoots back from the opponent's side, temporarily hide the opponent: a big, long opponent (the whale) pokes into the frame edge as a large slab,
   * while a small opponent was never in such a shot, so hiding it makes no visible difference. At the start of the next camera position that can see the opponent, on=false puts it back;
   * restore() also puts it back.
   */
  offstage(side: SideId, on: boolean): void {
    const c = this.sc.slots[side].creature;
    if (!c) return;
    if (on) {
      if (this.hidden.has(side)) return;
      this.hidden.set(side, c.root.visible);
      c.root.visible = false;
    } else {
      const v = this.hidden.get(side);
      if (v === undefined) return;
      c.root.visible = v;
      this.hidden.delete(side);
    }
  }

  /** Cut directly (no tween) */
  cut(pos: THREE.Vector3, look: THREE.Vector3): void {
    const r = this.sc.rig;
    r.claim();
    r.pos.copy(pos);
    r.look.copy(look);
  }

  shot(pos: THREE.Vector3, look: THREE.Vector3, dur: number, e: (x: number) => number = ease.inOutQuad): Promise<void> {
    if (dur <= 0) {
      this.cut(pos, look);
      return Promise.resolve();
    }
    return this.sc.rig.moveTo(pos, look, dur, e);
  }

  /**
   * Orbit around center from yaw0 to yaw1 (degrees, see orbitPos) while tweening distance and height; only one arc, never spins forever.
   * lookAt defaults to center, and may also be a function that moves along (e.g. look at the spirit's head).
   */
  arc(side: SideId, center: THREE.Vector3, yaw: Span, dist: Span, rise: Span, dur: number, e: (x: number) => number = ease.inOutQuad, lookAt?: () => THREE.Vector3): Promise<void> {
    const r = this.sc.rig;
    const tok = r.claim();
    return this.sc.tw.to(dur, (k) => {
      if (!r.owns(tok)) return;
      r.pos.copy(this.orbitPos(side, center, at(yaw, k), at(dist, k), at(rise, k)));
      r.look.copy(lookAt ? lookAt() : center);
    }, e, 'fx');
  }

  /** Restore: the camera returns to its default position and all post-processing to normal values */
  async restore(dur = 0.55): Promise<void> {
    const st = this.sc.stage;
    const d = defaultGrade();
    this.focus.clear();
    for (const side of [...this.hidden.keys()]) this.offstage(side, false);
    await Promise.all([
      this.sc.rig.reset(dur),
      this.look({ letterbox: 0, desat: 0, vignette: d.vignette, isolate: 0, invert: 0, radial: 0, lines: 0, haze: 0, grain: 0, tint: 0xffffff, lift: 0x000000, bloom: st.bloomBase, fov: 1, roll: 0 }, dur),
    ]);
    this.gen.clear();
    st.resetCinematic();
    this.sc.rig.roll = 0;
    this.sc.syncParticleScale();
  }
}

// ───────────────────────── Cinematic sound effects ─────────────────────────

export const ultSfx = {
  /** Reversed cymbal: ever-louder high-frequency noise, placed before an impact or a cut */
  swell(dur = 0.7, gain = 0.3) {
    synth.noise({ type: 'highpass', f0: 1500, f1: 7000, dur, gain, attack: dur * 0.95 });
    synth.tone({ type: 'sawtooth', f0: 70, f1: 300, dur, gain: gain * 0.2, attack: dur * 0.9 });
  },
  /** The "ching" of an eye glint */
  shing(pitch = 1) {
    synth.noise({ type: 'highpass', f0: 6000, dur: 0.1, gain: 0.18 });
    synth.tone({ type: 'triangle', f0: 2637 * pitch, dur: 0.8, gain: 0.1 });
    synth.tone({ type: 'sine', f0: 3951 * pitch, dur: 0.55, gain: 0.06, delay: 0.03 });
  },
  /** Low-frequency "thud": halo burst, cut */
  thump(gain = 0.55) {
    synth.tone({ type: 'sine', f0: 120, f1: 38, dur: 0.55, gain });
    synth.noise({ type: 'lowpass', f0: 1200, f1: 90, dur: 0.45, gain: gain * 0.5 });
  },
};
