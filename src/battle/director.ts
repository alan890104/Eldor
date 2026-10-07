// Battle director: turns engine events into cinematics: wind-up, flight, impact, hit-stop, screen shake, VFX, sound effects, numbers.

import * as THREE from 'three';
import { getSkill, getSpirit } from '../data.ts';
import { HIT_FEEL, multiHitStopMs } from '../../sim/feel.ts';
import type { Element, SkillDef } from '../../sim/types.ts';
import { sampleClock } from '../audio/samples.ts';
import { sfx, synth } from '../audio/sfx.ts';
import { ease } from '../render/tween.ts';
import type { BattleEvent, BattleView, HitTierName, SideId, ArtId } from '../engine/types.ts';
import { BattleScene, ELEMENT_BRIGHT, ELEMENT_COLOR } from './scene.ts';
import { inkScenery } from '../render/ink.ts';
import { sceneMaterial } from '../render/spiritToon.ts';
import { glowTex, runeCircleTex } from '../render/textures.ts';
import { Cine, loadUltScript, type UltCtx, type UltScript } from './ult/index.ts';
import { ultGuarded } from './ult/generic.ts';

export const ART_NAME: Record<ArtId, string> = {
  oath_break: '破陣之誓',
  oath_guard: '守護之誓',
  oath_gale: '疾風之誓',
  eye_insight: '看破之眼',
  light_purify: '淨化之光',
  aether_spring: '靈能湧泉',
};
export const ART_DESC: Record<ArtId, string> = {
  oath_break: '本回合我方的攻擊無視格擋與護盾',
  oath_guard: '本回合我方受到的傷害 −40%',
  oath_gale: '本回合我方技能先制 +1',
  eye_insight: '翻開對手的伏技，本回合它無法發動',
  light_purify: '解除我方在場精靈的所有異常',
  aether_spring: '立即獲得 3 點靈能',
};
export const STATUS_NAME: Record<string, string> = {
  burn: '灼燒',
  poison: '中毒',
  bleed: '裂傷',
  freeze: '冰凍',
  sleep: '睡眠',
  fear: '恐懼',
  paralyze: '麻痺',
  root: '束縛',
  silence: '沉默',
  taunt: '挑釁',
  curse: '詛咒',
};
export const STAT_NAME: Record<string, string> = { atk: '力量', mag: '魔力', def: '護甲', res: '抗魔', spd: '速度' };
export const FIELD_NAME: Record<Element, string> = {
  water: '暴雨',
  fire: '烈陽',
  nature: '森域',
  wind: '疾風',
  earth: '沙暴',
  thunder: '雷雲',
  light: '聖域',
  dark: '永夜',
  neutral: '無',
};
const STATUS_COLOR: Record<string, number> = {
  burn: 0xff6a1a,
  poison: 0xb05aff,
  bleed: 0xff3a5a,
  freeze: 0x9ff0ff,
  sleep: 0xb0b8ff,
  fear: 0x6a3aaa,
  paralyze: 0xfff066,
  root: 0xc49a5a,
  silence: 0xffe680,
  taunt: 0xff5a3a,
  curse: 0x7a2a8a,
};

export interface BattleUI {
  view(v: BattleView): void;
  float(text: string, world: THREE.Vector3, cls: string): void;
  banner(text: string, sub: string, color: number, side: SideId | null): void;
  log(text: string): void;
  /** ssr: an SSR's true name release (the banner is shorter and pushed lower, leaving the frame for the close-up) */
  cutin(side: SideId, spirit: string, skill: string, element: Element, ssr?: boolean): void;
}

interface Pending {
  side: SideId;
  skill: SkillDef;
  delivered: boolean;
  lunged: boolean;
  /** Ultimate cinematic script (ult/) and its context */
  run: UltRun | null;
}

interface UltRun {
  script: UltScript;
  ctx: UltCtx;
}

/** Names of non-attack damage (the damage event's reason) in the battle log */
const DMG_LABEL: Record<string, string> = {
  burn: '灼燒', poison: '中毒', bleed: '裂傷', sand: '沙暴', leech: '寄生', recoil: '反衝', reflect: '反彈', trap: '伏技', corrupt: '虛蝕侵蝕',
  hazard: '陣地', bind: '束縛', doom: '預言', bond: '同命', perish: '滅亡之歌', wither: '枯萎', retaliate: '反擊', sacrifice: '獻祭',
  storm: '雷雲', blast: '爆炸', song: '旋律', kingdom: '落石', karma: '業火', crash: '撞牆', breach: '違約', leak: '漏電',
  dust: '鱗粉', pincer: '沙鉗', erode: '虛蝕', overheat: '過熱', overload: '過充', verdict: '審判', soulfire: '魂焰',
  quicksand: '流沙', prophecy: '時印', nightmare: '夢魘', needle: '電針', chime: '和鳴', starlight: '星輝', execute: '斬殺',
  selfburn: '焚身', bounce: '彈殼', kiss: '夜吻', split: '均分',
};
/** Flash and particle colors for non-attack damage */
const DMG_COLOR: Record<string, number> = {
  burn: 0xff6a1a, selfburn: 0xff6a1a, overheat: 0x7ab8ff, dust: 0xffa040, soulfire: 0x7a8cff, karma: 0xff4a2a,
  poison: 0xb05aff, bleed: 0xff3a5a, kiss: 0xc0203a, corrupt: 0xd04aff, erode: 0x9a4aff, nightmare: 0x8a6aff,
  sand: 0xe0c080, quicksand: 0xe0c080, pincer: 0xe0c080, kingdom: 0xc0a070, crash: 0xc0a070, prophecy: 0xe8d890, doom: 0xe8d890,
  leech: 0x6ad05a, wither: 0x8a7a3a,
  storm: 0xfff06a, overload: 0xfff06a, needle: 0xfff06a, leak: 0xfff06a, blast: 0xffd04a,
  chime: 0xfff4c0, starlight: 0xfff4c0, verdict: 0xfff4c0, breach: 0xe8c860,
};

export class Director {
  scene: BattleScene;
  ui: BattleUI;
  private pending: Pending | null = null;
  names: [string, string] = ['我方', '對手'];
  speed = 1;
  private lastView: BattleView | null = null;
  private cine: Cine;

  constructor(scene: BattleScene, ui: BattleUI) {
    this.scene = scene;
    this.ui = ui;
    this.cine = new Cine(scene);
  }

  setSpeed(s: number): void {
    this.speed = s;
    this.scene.tw.speed = s;
    sampleClock.speed = s;
  }

  private wait(sec: number): Promise<void> {
    return this.scene.tw.wait(sec);
  }

  private spiritName(side: SideId, v?: BattleView): string {
    const view = v ?? this.lastView;
    if (!view) return '';
    const sd = view.sides[side];
    return sd.team[sd.active].name;
  }

  async play(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      await this.handle(ev);
      this.lastView = ev.view;
      this.syncMarks(ev.view);
    }
    await this.finishPending();
    this.ui.view(events.length ? events[events.length - 1].view : this.lastView!);
    if (this.lastView) this.syncMarks(this.lastView);
  }

  /**
   * A skill set's state is shown on the model (action weights of the experimental model): flame hue marker kit:hue → act.hue (0 crimson flame, 1 white flame, 2 azure flame); forge marks kit:rune → act.flame/edge/heavy.
   * During an ultimate cinematic the script controls it itself, so it is not overwritten.
   */
  private syncMarks(view: BattleView): void {
    if (this.pending?.run) return;
    for (const side of [0, 1] as SideId[]) {
      const sd = view.sides[side];
      const c = this.scene.slots[side].creature;
      if (!c) continue;
      const marks = sd.team[sd.active]?.marks;
      if ('hue' in c.act) {
        const note = marks?.find((m) => m.id === 'kit:hue')?.note;
        if (note) c.act.hue = note.startsWith('蒼') ? 2 : note.startsWith('白') ? 1 : 0;
      }
      // Magma Golem's forge marks kit:rune ("Forge Marks: Flame, Edge, Heavy") → the three rune studs on its body light up: act.flame/edge/heavy
      if ('flame' in c.act && 'edge' in c.act && 'heavy' in c.act) {
        const note = marks?.find((m) => m.id === 'kit:rune')?.note ?? '';
        c.act.flame = note.includes('焰') ? 1 : 0;
        c.act.edge = note.includes('鋒') ? 1 : 0;
        c.act.heavy = note.includes('重') ? 1 : 0;
      }
    }
  }

  private async handle(ev: BattleEvent): Promise<void> {
    const sc = this.scene;
    const attackFollowUps = new Set(['hit', 'miss', 'guarded', 'trap', 'negate', 'shieldBreak', 'damage', 'faint', 'trait', 'status', 'stat', 'heal', 'resist', 'charges', 'dispel', 'text', 'statusEnd', 'shield', 'cleanse', 'aether', 'reveal', 'trapDestroyed', 'switchOut', 'switchIn', 'field']);
    if (this.pending && (!attackFollowUps.has(ev.k) || ev.k === 'switchOut' || ev.k === 'switchIn' || ev.k === 'field')) {
      await this.finishPending();
    }
    switch (ev.k) {
      case 'turn': {
        this.ui.view(ev.view);
        if (ev.turn > 0) this.ui.log(`── 第 ${ev.turn} 回合 ──`);
        return;
      }
      case 'aether': {
        this.ui.view(ev.view);
        if (ev.delta > 0 && ev.side === 0) sfx.aether();
        return;
      }
      case 'art': {
        this.ui.banner(ART_NAME[ev.art], `${this.names[ev.side]}的締約者戰技`, 0xffd060, ev.side);
        sfx.fanfare(false);
        sc.stage.screenFlash(0xfff0c0, 0.35, 3);
        void sc.vfx.ring(sc.slots[ev.side].home.clone().setY(0.1), 0xffd060, 0.5, 5, 0.8);
        this.ui.log(`${this.names[ev.side]}發動締約者戰技【${ART_NAME[ev.art]}】`);
        this.ui.view(ev.view);
        await this.wait(0.7);
        return;
      }
      case 'trapSet': {
        sc.setTrapCard(ev.side, true);
        sfx.trapSet();
        this.ui.log(`${this.names[ev.side]}設置了一張伏技`);
        this.ui.view(ev.view);
        await this.wait(0.3);
        return;
      }
      case 'switchOut': {
        this.ui.log(`${this.names[ev.side]}收回了 ${this.spiritName(ev.side)}`);
        await sc.recall(ev.side);
        this.ui.view(ev.view);
        return;
      }
      case 'switchIn': {
        const v = ev.view.sides[ev.side].team[ev.idx];
        // Preload this spirit's ultimate cinematic so there is no wait when it fires
        void loadUltScript(v.speciesId);
        sc.setSpirit(ev.side, v);
        sc.slots[ev.side].creature!.root.visible = false;
        this.ui.view(ev.view);
        this.ui.log(ev.side === 0 ? `去吧，${v.name}！` : `${this.names[1]}派出了 ${v.name}！`);
        sfx.summon();
        await sc.entry(ev.side, this.speed > 1);
        return;
      }
      case 'field': {
        this.ui.view(ev.view);
        if (ev.element) {
          // Expanding the same arena again only refreshes the turn count, so the cinematic is shorter
          const refresh = sc.field === ev.element;
          void sc.setField(ev.element);
          sfx.field(ev.element);
          this.ui.banner(`場地：${FIELD_NAME[ev.element]}`, `${ev.turns} 回合`, ELEMENT_COLOR[ev.element], null);
          this.ui.log(`場地變為「${FIELD_NAME[ev.element]}」`);
          // Wait for the light wall to sweep the whole arena and the surroundings to rise (battle speed shortens this proportionally)
          await this.wait(refresh ? 0.6 : 1.5);
        } else {
          void sc.setField(null);
          this.ui.log('場地效果消失了');
          await this.wait(0.5);
        }
        return;
      }
      case 'use': {
        const sk = getSkill(ev.skillId);
        const el = sk.element;
        const who = this.spiritName(ev.side, ev.view);
        this.ui.log(`${who} 使用了【${sk.name}】${ev.copied ? '（複寫）' : ''}`);
        const run = ev.ult ? await this.startUlt(ev, sk, who) : null;
        if (run) {
          await run.script.windup(run.ctx);
        } else {
          this.ui.banner(sk.name, who, ELEMENT_COLOR[el], ev.side);
        }
        this.ui.view(ev.view);
        const isAtk = sk.category === 'physical' || sk.category === 'magic' || sk.category === 'ultimate';
        if (isAtk) {
          this.pending = { side: ev.side, skill: sk, delivered: false, lunged: false, run };
          if (!run) await this.attackWindup(ev.side, sk);
        } else {
          await this.castStatus(ev.side, sk);
          if (run) await run.script.finish(run.ctx);
        }
        return;
      }
      case 'charge': {
        const sk = getSkill(ev.skillId);
        this.ui.banner(sk.name, '蓄力中……', ELEMENT_COLOR[sk.element], ev.side);
        this.ui.log(`${this.spiritName(ev.side)} 開始蓄力！`);
        sfx.charge(0.9);
        await sc.windup(ev.side, 0.3);
        for (let i = 0; i < 5; i++) {
          sc.vfx.emit({ pos: sc.center(ev.side), count: 16, color: [ELEMENT_COLOR[sk.element], 0xffffff], speed: [2, 3], inward: true, life: [0.3, 0.5], size: [0.1, 0.25], drag: 0 });
          await this.wait(0.12);
        }
        this.ui.view(ev.view);
        return;
      }
      case 'fail': {
        this.ui.float(ev.reason, sc.top(ev.side), 'fl-info');
        this.ui.log(`${this.spiritName(ev.side)}：${ev.reason}`);
        void sc.squash(ev.side, 0.1);
        this.ui.view(ev.view);
        await this.wait(0.5);
        return;
      }
      case 'trap': {
        const sk = getSkill(ev.skillId);
        sc.stage.hitStop(260);
        sfx.trapFlip();
        synth.duck(-10, 500);
        this.ui.banner(`伏技發動！${sk.name}`, ev.chain > 2 ? `連鎖 ${ev.chain} · 反制` : `連鎖 ${ev.chain}`, 0xb08aff, ev.side);
        this.ui.log(`${this.names[ev.side]}的伏技【${sk.name}】發動！${ev.chain > 2 ? '（反制）' : ''}`);
        sc.rig.addTrauma(0.3);
        await sc.flipTrap(ev.side, sk.name, ELEMENT_COLOR[sk.element]);
        this.ui.view(ev.view);
        return;
      }
      case 'negate': {
        const sk = getSkill(ev.skillId);
        this.ui.float('無效！', sc.top(ev.side), 'fl-negate');
        this.ui.log(`【${sk.name}】被無效了！`);
        sfx.shieldBreak();
        sc.vfx.emit({ pos: sc.center(ev.side), count: 30, color: 0xb0b0c0, speed: [2, 4], life: [0.3, 0.6], size: [0.1, 0.2], atlas: 2 });
        await this.wait(0.4);
        return;
      }
      case 'reveal': {
        const sk = getSkill(ev.skillId);
        this.ui.float(`伏技翻開：${sk.name}`, sc.slots[ev.side].home.clone().setY(1.8), 'fl-info');
        this.ui.log(`${this.names[ev.side]}的伏技被看穿了：【${sk.name}】`);
        sfx.confirm();
        this.ui.view(ev.view);
        await this.wait(0.5);
        return;
      }
      case 'trapDestroyed': {
        const card = sc.slots[ev.side].trapCard;
        if (card) sc.vfx.emit({ pos: card.position.clone(), count: 40, color: [0xb08aff, 0xffffff], speed: [2, 5], life: [0.3, 0.7], size: [0.1, 0.22], atlas: 2 });
        sc.setTrapCard(ev.side, false);
        sfx.shieldBreak();
        this.ui.log(`${this.names[ev.side]}的伏技【${getSkill(ev.skillId).name}】被破壞了！`);
        this.ui.view(ev.view);
        await this.wait(0.35);
        return;
      }
      case 'miss': {
        await this.deliver();
        const run = this.pending?.run;
        if (run) run.script.settle?.(run.ctx);
        this.ui.float('MISS', sc.top(ev.side === 0 ? 1 : 0), 'fl-miss');
        this.ui.log('攻擊落空了！');
        sfx.whoosh(0.7);
        await this.wait(0.3);
        return;
      }
      case 'guarded': {
        await this.deliver();
        const run = this.pending?.run;
        if (run && !ev.broke) {
          this.ui.log(`${this.spiritName(ev.side)} 擋下了奧義！`);
          await (run.script.guarded ?? ultGuarded)(run.ctx);
          run.script.settle?.(run.ctx);
          return;
        }
        const pos = sc.center(ev.side);
        if (ev.broke) {
          this.ui.float('破防！', sc.top(ev.side), 'fl-crit');
          sfx.shieldBreak();
          sc.vfx.emit({ pos, count: 50, color: [0x9fd0ff, 0xffffff], speed: [3, 7], life: [0.3, 0.7], size: [0.12, 0.25], atlas: 2 });
          sc.stage.hitStop(90);
        } else {
          void sc.vfx.bubble(pos, 0x9fd0ff, (sc.slots[ev.side].creature?.worldHeight ?? 1.5) * 0.75, 0.7);
          this.ui.float('格擋！', sc.top(ev.side), 'fl-guard');
          this.ui.log(`${this.spiritName(ev.side)} 擋下了攻擊！`);
          sfx.guard();
          sc.stage.hitStop(120);
          sc.rig.addTrauma(0.3);
          sc.vfx.emit({ pos, count: 30, color: 0xcfe8ff, speed: [3, 6], life: [0.2, 0.4], size: [0.08, 0.16], atlas: 1 });
          await this.wait(0.45);
        }
        return;
      }
      case 'hit':
        await this.impact(ev);
        return;
      case 'damage': {
        const col = DMG_COLOR[ev.reason] ?? 0xffffff;
        const c = sc.slots[ev.target].creature;
        c?.setFlash(col, 0.8);
        sc.vfx.emit({ pos: sc.center(ev.target), count: 14, color: col, speed: [1, 2.5], life: [0.3, 0.6], size: [0.12, 0.25] });
        this.ui.float(`-${ev.dmg}`, sc.top(ev.target), ev.reason === 'reflect' || ev.reason === 'recoil' ? 'fl-dmg' : 'fl-dot');
        this.ui.log(`${this.spiritName(ev.target)} 受到${DMG_LABEL[ev.reason] ?? ''}傷害 ${ev.dmg}`);
        synth.noise({ type: 'bandpass', f0: 900, q: 2, dur: 0.15, gain: 0.2 });
        this.ui.view(ev.view);
        await this.wait(0.35);
        return;
      }
      case 'heal': {
        const pos = sc.center(ev.target);
        sc.vfx.emit({ pos: pos.clone().setY(0.2), count: 30, color: [0x7aff9a, 0xdaffc0], speed: [0.8, 2], dir: new THREE.Vector3(0, 1, 0), spread: 0.4, life: [0.6, 1.1], size: [0.1, 0.22], radius: 0.5, atlas: 1 });
        this.ui.float(`+${ev.amount}`, sc.top(ev.target), 'fl-heal');
        sfx.heal();
        this.ui.view(ev.view);
        await this.wait(0.35);
        return;
      }
      case 'shield': {
        void sc.vfx.bubble(sc.center(ev.target), 0x7fd8ff, (sc.slots[ev.target].creature?.worldHeight ?? 1.5) * 0.72, 0.9);
        this.ui.float(`護盾 ${ev.amount}`, sc.top(ev.target), 'fl-shield');
        sfx.buff();
        this.ui.view(ev.view);
        await this.wait(0.35);
        return;
      }
      case 'shieldBreak': {
        sc.vfx.emit({ pos: sc.center(ev.target), count: 30, color: [0x7fd8ff, 0xffffff], speed: [2, 5], life: [0.3, 0.6], size: [0.1, 0.2], atlas: 2 });
        sfx.shieldBreak();
        this.ui.view(ev.view);
        return;
      }
      case 'status': {
        const name = STATUS_NAME[ev.status];
        const col = STATUS_COLOR[ev.status] ?? 0xffffff;
        const pos = sc.center(ev.target);
        sc.slots[ev.target].creature?.setFlash(col, 0.9);
        sc.vfx.emit({ pos, count: 26, color: [col, 0xffffff], speed: [1, 3], life: [0.4, 0.8], size: [0.12, 0.26], radius: 0.4, atlas: ev.status === 'freeze' ? 2 : 0 });
        void sc.vfx.ring(pos.clone().setY(0.1), col, 0.3, 2, 0.5);
        this.ui.float(ev.status === 'poison' ? `中毒 ×${ev.stacks}` : `${name}！`, sc.top(ev.target), 'fl-status');
        this.ui.log(`${this.spiritName(ev.target)} 陷入了${name}${ev.status === 'poison' ? `（${ev.stacks} 層）` : ''}`);
        sfx.status();
        this.ui.view(ev.view);
        await this.wait(0.4);
        return;
      }
      case 'statusEnd': {
        this.ui.view(ev.view);
        return;
      }
      case 'resist': {
        this.ui.float(ev.reason, sc.top(ev.target), 'fl-info');
        this.ui.log(`${this.spiritName(ev.target)}：${ev.reason}`);
        await this.wait(0.3);
        return;
      }
      case 'stat': {
        const up = ev.delta > 0;
        const pos = sc.center(ev.target);
        sc.vfx.emit({ pos: pos.clone().setY(up ? 0.2 : pos.y + 1), count: 24, color: up ? [0xffd060, 0xfff4b0] : [0x6a8aff, 0xb0c0ff], speed: [1.5, 3], dir: new THREE.Vector3(0, up ? 1 : -1, 0), spread: 0.25, life: [0.4, 0.8], size: [0.12, 0.25], radius: 0.5, atlas: 1 });
        const arrows = up ? '↑'.repeat(Math.min(3, ev.delta)) : '↓'.repeat(Math.min(3, -ev.delta));
        this.ui.float(`${STAT_NAME[ev.stat]}${arrows}`, sc.top(ev.target), up ? 'fl-up' : 'fl-down');
        if (up) sfx.buff();
        else sfx.debuff();
        this.ui.view(ev.view);
        await this.wait(0.3);
        return;
      }
      case 'charges': {
        sc.vfx.emit({ pos: sc.center(ev.target), count: 20, color: [0xfff066, 0xffffff], speed: [2, 4], life: [0.2, 0.4], size: [0.1, 0.2], atlas: 1 });
        this.ui.float(`電荷 ×${ev.value}`, sc.top(ev.target), 'fl-up');
        synth.noise({ type: 'highpass', f0: 3000, dur: 0.1, gain: 0.2 });
        this.ui.view(ev.view);
        await this.wait(0.2);
        return;
      }
      case 'dispel': {
        this.ui.float('強化被驅散', sc.top(ev.target), 'fl-down');
        sc.vfx.emit({ pos: sc.center(ev.target), count: 30, color: 0xffffff, speed: [2, 4], life: [0.3, 0.6], size: [0.1, 0.2], atlas: 2 });
        sfx.debuff();
        this.ui.view(ev.view);
        await this.wait(0.3);
        return;
      }
      case 'cleanse': {
        sc.vfx.emit({ pos: sc.center(ev.target).setY(0.2), count: 30, color: [0xffffff, 0xbff0ff], speed: [1, 2.5], dir: new THREE.Vector3(0, 1, 0), spread: 0.4, life: [0.5, 1], size: [0.12, 0.24], radius: 0.6, atlas: 1 });
        this.ui.float(ev.team ? '全隊淨化' : '淨化', sc.top(ev.target), 'fl-heal');
        sfx.heal();
        this.ui.view(ev.view);
        await this.wait(0.3);
        return;
      }
      case 'faint': {
        this.ui.log(`${ev.view.sides[ev.side].team[ev.idx].name} 倒下了！`);
        sfx.faint();
        await sc.faint(ev.side);
        this.ui.view(ev.view);
        return;
      }
      case 'trait': {
        const col = ev.side === 0 ? 0x7fd8ff : 0xff9a7a;
        this.ui.float(`特性【${ev.name}】`, sc.top(ev.side).add(new THREE.Vector3(0, 0.4, 0)), 'fl-trait');
        this.ui.log(`${this.spiritName(ev.side)} 的特性【${ev.name}】發動`);
        void sc.vfx.ring(sc.slots[ev.side].home.clone().setY(0.1), col, 0.3, 2.5, 0.5);
        await this.wait(0.35);
        return;
      }
      case 'capture':
        await this.capture(ev.success, ev.shakes, ev.stone);
        this.ui.view(ev.view);
        return;
      case 'text': {
        this.ui.log(ev.text);
        this.ui.float(ev.text, new THREE.Vector3(0, 3, 0), 'fl-info');
        await this.wait(0.4);
        return;
      }
      case 'end':
        this.ui.view(ev.view);
        return;
    }
  }

  // ───────────────────────── Attack cinematic ─────────────────────────

  private isPhysical(side: SideId, sk: SkillDef): boolean {
    if (sk.category === 'physical') return true;
    if (sk.category === 'magic') return false;
    const dt = sk.damageType ?? 'auto';
    if (dt !== 'auto') return dt === 'physical';
    const v = this.lastView?.sides[side];
    if (!v) return true;
    const sp = getSpirit(v.team[v.active].speciesId);
    return sp.base.atk >= sp.base.mag;
  }

  private async attackWindup(side: SideId, sk: SkillDef): Promise<void> {
    const sc = this.scene;
    const el = sk.element;
    const physical = this.isPhysical(side, sk);
    if (physical) {
      sfx.whoosh(0.8);
      await sc.windup(side, 0.14);
    } else {
      sfx.cast(el);
      void sc.vfx.circle(sc.slots[side].home.clone().setY(0.06), ELEMENT_COLOR[el], 1.8, 0.9, undefined, side + 1);
      sc.vfx.emit({ pos: sc.center(side), count: 26, color: [ELEMENT_COLOR[el], ELEMENT_BRIGHT[el]], speed: [2, 3], inward: true, life: [0.25, 0.4], size: [0.1, 0.22], drag: 0 });
      await sc.windup(side, 0.28);
    }
  }

  /** The attack "flies" to its target (called before the first hit/miss/guarded) */
  private async deliver(): Promise<void> {
    const p = this.pending;
    if (!p || p.delivered) return;
    p.delivered = true;
    const sc = this.scene;
    const side = p.side;
    const tgt: SideId = side === 0 ? 1 : 0;
    const el = p.skill.element;
    const col = ELEMENT_COLOR[el];
    const bright = ELEMENT_BRIGHT[el];
    const from = sc.center(side);
    const to = sc.center(tgt);
    if (p.run) {
      await p.run.script.deliver(p.run.ctx);
      return;
    }
    if (this.isPhysical(side, p.skill)) {
      sfx.swish();
      await sc.lunge(side);
      p.lunged = true;
      return;
    }
    sc.release(side);
    switch (el) {
      case 'fire':
        sfx.whoosh(0.6);
        await sc.vfx.projectile(from, to, col, 0.55, 0.32, 0.8);
        break;
      case 'water':
        sfx.whoosh(0.9);
        await sc.vfx.projectile(from, to, col, 0.5, 0.3, 0.5);
        break;
      case 'nature':
        sfx.whoosh(1.1);
        sc.vfx.emit({ pos: from, count: 20, color: [col, bright], speed: [1, 2], life: [0.4, 0.7], size: [0.15, 0.25], atlas: 3, spin: 8 });
        await sc.vfx.projectile(from, to, col, 0.45, 0.34, 0.9);
        break;
      case 'wind':
        sfx.swish();
        for (let i = 0; i < 2; i++) void sc.vfx.projectile(from, to, bright, 0.3, 0.22, 0.3 + i * 0.4, true);
        await this.wait(0.22);
        break;
      case 'earth':
        sfx.whoosh(0.4);
        await this.wait(0.12);
        break;
      case 'thunder':
        await this.wait(0.08);
        break;
      case 'light':
        void sc.vfx.beam(from, to, col, 0.3, 0.45);
        sfx.whoosh(1.4);
        await this.wait(0.12);
        break;
      case 'dark':
        sfx.whoosh(0.5);
        await sc.vfx.projectile(from, to, 0x7a3aff, 0.65, 0.4, 0.4);
        break;
      default:
        sfx.whoosh(1.2);
        for (let i = 0; i < 3; i++) void sc.vfx.projectile(from, to, 0xc8d8ff, 0.3, 0.26 + i * 0.05, 0.3 + i * 0.3);
        await this.wait(0.34);
    }
  }

  private async impact(ev: Extract<BattleEvent, { k: 'hit' }>): Promise<void> {
    const sc = this.scene;
    if (!this.pending) this.pending = { side: ev.side, skill: getSkill(ev.skillId), delivered: false, lunged: false, run: null };
    await this.deliver();
    const sk = getSkill(ev.skillId);
    const el = sk.element;
    const physical = this.isPhysical(ev.side, sk);
    const tier: HitTierName = ev.tier;
    const feel = HIT_FEEL[tier];
    const target = ev.target;
    const pos = sc.center(target);
    const multi = ev.hits > 1;
    const hs = multi ? multiHitStopMs(tier, ev.hitIndex, ev.hits) : feel.hitStopMs;
    sc.stage.hitStop(hs / this.speed);
    sc.rig.addTrauma(multi && ev.hitIndex < ev.hits ? feel.trauma * 0.4 : feel.trauma);
    if (feel.timeScale < 1 && (!multi || ev.hitIndex === ev.hits)) sc.stage.slowMo(feel.timeScale, feel.timeScaleMs);
    sfx.hit(tier, el, physical);
    synth.duck(feel.musicDuckDb);
    try {
      navigator.vibrate?.(feel.vibrate);
    } catch {
      /* Not supported */
    }
    const strength = { light: 0.2, medium: 0.5, heavy: 0.8, crit: 1, ko: 1.2, ultimate: 1.3 }[tier];
    sc.hitReact(target, strength, ev.side, !!this.pending?.run?.script.pinFoe);
    // When an ultimate script wants to own the impact visuals (quietHit), neither the generic hit VFX nor the white flash is stacked
    const quiet = !!this.pending?.run?.script.quietHit;
    if (!quiet) this.impactFx(el, pos, strength, physical, target, ev.side);
    if (tier === 'crit' || tier === 'ko' || tier === 'ultimate') {
      if (!quiet) {
        sc.stage.chromatic(tier === 'crit' ? 0.8 : 1.2);
        sc.stage.screenFlash(0xffffff, tier === 'crit' ? 0.25 : 0.45, 5);
      }
      // The ultimate cinematic runs its own camera (including the knock-out blow), so it must not be interrupted by a push-in and a pull back to the wide shot
      if (tier !== 'ultimate' && !this.pending?.run) void sc.rig.push(0.12, 0.08).then(() => sc.rig.reset(0.4));
    }
    const dmgText = ev.shieldDmg > 0 && ev.dmg === 0 ? `(${ev.shieldDmg})` : `${ev.dmg + ev.shieldDmg}`;
    const cls = tier === 'crit' ? 'fl-crit' : tier === 'ultimate' ? 'fl-ult' : ev.eff > 1 ? 'fl-eff' : ev.eff < 1 ? 'fl-weak' : 'fl-dmg';
    const scale = feel.numberScale;
    this.ui.float(dmgText, sc.top(target), `${cls} s${Math.round(scale * 100)}`);
    if (ev.crit && tier !== 'ultimate') this.ui.float('暴擊！', sc.top(target).add(new THREE.Vector3(0, 0.5, 0)), 'fl-critlabel');
    if (ev.eff > 1 && ev.hitIndex === 1) this.ui.float('剋制！', sc.top(target).add(new THREE.Vector3(0.6, 0.2, 0)), 'fl-efflabel');
    if (ev.eff < 1 && ev.hitIndex === 1) this.ui.float('抵抗', sc.top(target).add(new THREE.Vector3(0.6, 0.2, 0)), 'fl-weaklabel');
    if (multi && ev.hitIndex > 1) this.ui.float(`${ev.hitIndex} HIT`, sc.top(ev.side), 'fl-combo');
    const run = this.pending?.run;
    if (run) run.script.impact?.(run.ctx, ev);
    this.ui.view(ev.view);
    if (ev.hitIndex === 1) this.ui.log(`${ev.crit ? '暴擊！' : ''}${ev.eff > 1 ? '效果拔群！' : ev.eff < 1 ? '效果不佳……' : ''}造成 ${ev.dmg + ev.shieldDmg} 點傷害`);
    const gap = multi && ev.hitIndex < ev.hits ? 0.09 : tier === 'light' ? 0.28 : 0.42;
    await this.wait(gap);
  }

  private impactFx(el: Element, pos: THREE.Vector3, s: number, physical: boolean, target: SideId, from: SideId): void {
    const sc = this.scene;
    const v = sc.vfx;
    const col = ELEMENT_COLOR[el];
    const bright = ELEMENT_BRIGHT[el];
    const h = sc.slots[target].creature?.worldHeight ?? 1.5;
    const camDist = sc.stage.camera.position.distanceTo(pos);
    const camDir = sc.stage.camera.position.clone().sub(pos).normalize();
    // A flash covers no more than a set fraction of the screen: in an ultimate close-up the camera is very near, and otherwise the whole frame would be washed white
    void v.flash(pos, bright, Math.min(1.5 + s * 2.5, camDist * 0.3), 0.2 + s * 0.1);
    if (physical) {
      void v.slash(pos, bright, h * 0.55 + 0.3, Math.random() * Math.PI, camDir, 0.26, 0.3 + s * 0.1);
      if (s >= 0.8) void v.slash(pos, col, h * 0.65 + 0.4, Math.random() * Math.PI, camDir, 0.32, 0.25);
    }
    const n = Math.round(18 + s * 40);
    v.emit({ pos, count: n, color: [col, bright, 0xffffff], speed: [3, 7 + s * 5], life: [0.25, 0.6], size: [0.08, 0.2], atlas: 1, drag: 3 });
    void v.ring(sc.slots[target].home.clone().setY(0.08), col, 0.4, 2 + s * 2.5, 0.45);
    if (s >= 0.8) void v.ring(pos, bright, 0.2, Math.min(2.5 + s * 1.5, camDist * 0.28), 0.35, camDir);
    const dir = pos.clone().sub(sc.center(from)).setY(0).normalize();
    switch (el) {
      case 'fire':
        v.emit({ pos, count: 20 + s * 30, color: [0xff5a1a, 0xffa030, 0xffe060], speed: [1, 4], dir: new THREE.Vector3(0, 1, 0), spread: 0.9, life: [0.5, 1.1], size: [0.3, 0.6], sizeEnd: 0.1, drag: 1.5, gravity: -2 });
        break;
      case 'water':
        v.emit({ pos, count: 30 + s * 30, color: [0x7fd8ff, 0xffffff], speed: [3, 7], dir: new THREE.Vector3(dir.x, 1, dir.z), spread: 0.8, life: [0.4, 0.9], size: [0.1, 0.22], gravity: 12, drag: 0.5 });
        v.emit({ pos, count: 8 + s * 10, color: 0xcff8ff, speed: [2, 5], life: [0.4, 0.8], size: [0.2, 0.35], atlas: 2, gravity: 8 });
        break;
      case 'nature':
        v.emit({ pos, count: 25 + s * 25, color: [0x6fd65a, 0xb8f07a, 0xffb8e0], speed: [2, 5], life: [0.6, 1.2], size: [0.18, 0.3], atlas: 3, spin: 10, gravity: 2, drag: 2 });
        break;
      case 'wind':
        for (let i = 0; i < 2 + Math.round(s * 2); i++) void v.slash(pos, 0xe8fffa, h * 0.5 + 0.2 + i * 0.15, Math.random() * Math.PI, camDir, 0.22, 0.18);
        break;
      case 'earth':
        void v.spikes(sc.slots[target].home.clone(), 0xb08a5a, 5 + Math.round(s * 4), 0.9 + s * 0.4, 0.9 + s * 1.2, 0.6);
        v.emit({ pos: sc.slots[target].home.clone().setY(0.3), count: 20 + s * 30, color: [0xa07a4a, 0xd0b080], speed: [3, 7], dir: new THREE.Vector3(0, 1, 0), spread: 0.8, life: [0.5, 1], size: [0.18, 0.35], atlas: 2, gravity: 14, drag: 0.5, intensity: 1 });
        break;
      case 'thunder': {
        const top = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 9, (Math.random() - 0.5) * 2));
        void v.bolt(top, sc.slots[target].home.clone(), 0xc8a0ff, 0.3, 0.07 + s * 0.04);
        if (s >= 0.8) void v.bolt(top.clone().add(new THREE.Vector3(1, 0, 0)), pos, 0xfff066, 0.25, 0.05);
        sc.stage.screenFlash(0xe8d8ff, 0.3 + s * 0.2, 6);
        v.emit({ pos, count: 30, color: [0xfff066, 0xffffff], speed: [4, 9], life: [0.1, 0.3], size: [0.1, 0.2], atlas: 1 });
        break;
      }
      case 'light':
        void v.pillar(sc.slots[target].home.clone(), 0xffe680, Math.min(0.6 + s * 0.6, camDist * 0.08), 12, 0.6);
        v.emit({ pos, count: 30, color: [0xfff4b0, 0xffffff], speed: [2, 6], life: [0.4, 0.8], size: [0.15, 0.3], atlas: 1 });
        break;
      case 'dark':
        v.emit({ pos, count: 40, color: [0x7a3aff, 0xff4ab0], speed: [3, 5], inward: true, life: [0.25, 0.45], size: [0.12, 0.25], drag: 0 });
        v.emit({ pos, count: 25 + s * 20, color: [0x3a1a6a, 0x9a5aff], speed: [1, 3], life: [0.6, 1.1], size: [0.5, 0.9], sizeEnd: 1.4, drag: 2, intensity: 0.8 });
        break;
      default:
        v.emit({ pos, count: 25, color: [0xdde4ff, 0xffffff, 0xb0c8ff], speed: [3, 6], life: [0.3, 0.6], size: [0.15, 0.25], atlas: 1 });
    }
  }

  private async castStatus(side: SideId, sk: SkillDef): Promise<void> {
    const sc = this.scene;
    const col = ELEMENT_COLOR[sk.element];
    sfx.cast(sk.element);
    void sc.vfx.circle(sc.slots[side].home.clone().setY(0.06), col, 1.6, 0.8, undefined, side + 3);
    await sc.windup(side, 0.2);
    const targetsFoe = Object.keys(sk.tags).some((k) => k.startsWith('status.') || k.startsWith('foe.') || k === 'dispel' || k === 'forceSwitch' || k === 'destroyTrap' || k === 'revealTrap');
    const tgt: SideId = targetsFoe ? (side === 0 ? 1 : 0) : side;
    if (targetsFoe) {
      await sc.vfx.projectile(sc.center(side), sc.center(tgt), col, 0.4, 0.28, 0.6);
      void sc.vfx.flash(sc.center(tgt), col, 2.5, 0.3);
    } else {
      sc.vfx.emit({ pos: sc.center(side).setY(0.2), count: 36, color: [col, ELEMENT_BRIGHT[sk.element]], speed: [1.5, 3], dir: new THREE.Vector3(0, 1, 0), spread: 0.35, life: [0.5, 0.9], size: [0.12, 0.25], radius: 0.6, atlas: 1 });
      void sc.vfx.ring(sc.slots[side].home.clone().setY(0.1), col, 0.3, 2.4, 0.5);
    }
    sc.release(side);
    await this.wait(0.15);
  }

  private async finishPending(): Promise<void> {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    const sc = this.scene;
    if (!p.delivered) {
      sc.release(p.side);
    }
    // An ultimate's dedicated move may have taken the spirit away from its place
    const c = sc.slots[p.side].creature;
    const away = !!c && c.root.position.distanceTo(sc.slots[p.side].home) > 0.05;
    if (p.lunged || away) await sc.goHome(p.side, 0.28);
    else sc.release(p.side);
    if (p.run) await p.run.script.finish(p.run.ctx);
    if (this.lastView) this.syncMarks(this.lastView);
    void sc.rig.reset(0.4);
  }

  // ───────────────────────── Ultimate ─────────────────────────

  /** Ultimate cinematic: SSR gets the full cinematic, the other rarities share a short version (see ult/) */
  private async startUlt(ev: Extract<BattleEvent, { k: 'use' }>, sk: SkillDef, who: string): Promise<UltRun> {
    const sd = ev.view.sides[ev.side];
    const speciesId = sd.team[sd.active].speciesId;
    const ctx: UltCtx = {
      sc: this.scene,
      ui: this.ui,
      cine: this.cine,
      side: ev.side,
      foe: ev.side === 0 ? 1 : 0,
      skill: sk,
      el: sk.element,
      speciesId,
      who,
      physical: this.isPhysical(ev.side, sk),
      view: ev.view,
      latest: () => this.lastView ?? ev.view,
      wait: (s) => this.wait(s),
      mem: {},
    };
    return { script: await loadUltScript(speciesId), ctx };
  }

  // ───────────────────────── Capture ─────────────────────────

  /**
   * Pact stone cinematic: charge → thrown in a parabola → pact magic circle opens and the spirit turns to light and is drawn in → lands → shakes (harder each time)
   * → success: a sealing light pillar and pact seal; failure: the stone shatters and the spirit breaks out.
   */
  private async capture(success: boolean, shakes: number, tier: StoneTier): Promise<void> {
    const sc = this.scene;
    const look = STONE_LOOK[tier];
    const target = sc.slots[1];
    const c = target.creature;
    const name = this.spiritName(1);
    const el = target.view ? getSpirit(target.view.speciesId).elements[0] : 'neutral';
    const elCol = ELEMENT_COLOR[el];
    const me = sc.slots[0].home.clone();
    const foe = target.home.clone();
    const away = me.clone().sub(foe).setY(0).normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x);
    const hover = foe.clone().add(new THREE.Vector3(0, (c?.worldHeight ?? 1.5) * 0.55 + 0.5, 0));
    const ground = foe.clone().add(away.clone().multiplyScalar(0.25)).setY(0.4);
    this.ui.log(`擲出${look.name}！`);

    // ① Charge: the camera backs off behind our side, the pact stone lights up at hand
    const stone = contractStone(look);
    const from = me.clone().add(away.clone().multiplyScalar(0.6)).add(side.clone().multiplyScalar(-0.9)).setY(1.6);
    stone.root.position.copy(from);
    stone.root.scale.setScalar(0.01);
    // Hung on the effects layer: cleared along with it when leaving the battle midway
    const stoneFx = sc.vfx.layer(stone.root, () => {});
    void sc.rig.moveTo(me.clone().add(away.clone().multiplyScalar(4.2)).add(side.clone().multiplyScalar(-2.2)).setY(3), foe.clone().setY(1.2), 0.45, ease.outCubic);
    sfx.charge(0.4);
    void sc.vfx.glint(from, look.bright, 1.4, 0.45);
    sc.vfx.emit({ pos: from, count: 26, color: [look.color, look.bright], speed: [1.5, 3], inward: true, radius: 1, life: [0.25, 0.4], size: [0.08, 0.18], drag: 0 });
    await sc.tw.to(0.35, (k) => {
      stone.root.scale.setScalar(Math.max(0.01, k));
      stone.spin.rotation.y = k * 4;
      stone.setGlow(0.6 + k * 0.6);
    }, ease.outBack);

    // ② Throw: a spinning parabola, trailing a light tail
    sfx.whoosh(1.1);
    await sc.tw.to(0.55, (k) => {
      stone.root.position.lerpVectors(from, hover, k);
      stone.root.position.y += Math.sin(k * Math.PI) * 2.2;
      stone.spin.rotation.y = 4 + k * 16;
      stone.spin.rotation.z = k * 6;
      if (Math.random() < 0.8) sc.vfx.emit({ pos: stone.root.position.clone(), count: 3, color: [look.color, look.bright, 0xffffff], speed: [0.2, 0.8], life: [0.25, 0.5], size: [0.1, 0.22], sizeEnd: 0, atlas: 1 });
    }, ease.linear);

    // ③ The pact magic circle opens: a magic circle on the ground, a halo facing the camera, and the spirit turns to light and is drawn into the stone
    sfx.summon();
    sc.stage.screenFlash(look.bright, 0.35, 5);
    void sc.vfx.flash(hover, look.bright, 3.5, 0.35);
    void sc.vfx.ring(hover, look.color, 0.2, 2.6, 0.45, sc.stage.camera.position.clone().sub(hover));
    const seal = sealCircle(foe.clone().setY(0.06), look.color, (c?.width ?? 1.4) * 1.1 + 0.9);
    const sealFx = sc.vfx.layer(seal.root, (dt) => seal.tick(dt));
    void sc.rig.moveTo(foe.clone().add(away.clone().multiplyScalar(5.2)).add(side.clone().multiplyScalar(-1.4)).setY(2.4), hover.clone().setY(hover.y - 0.4), 0.6, ease.inOutQuad);
    if (c) {
      c.setFlash(0xffffff, 1);
      const p0 = c.root.position.clone();
      for (let i = 0; i < 3; i++) sc.vfx.emit({ pos: this.scene.center(1), count: 24, color: [elCol, look.bright, 0xffffff], speed: [0.6, 1.8], dir: new THREE.Vector3(0, 1, 0), spread: 0.9, radius: 0.6, life: [0.3, 0.6], size: [0.1, 0.24] });
      await sc.tw.to(0.6, (k) => {
        seal.set(k, 0);
        c.setFlash(0xffffff, 1);
        c.root.scale.setScalar(Math.max(0.01, 1 - k));
        c.root.position.lerpVectors(p0, hover.clone().setY(hover.y - 0.2), k * k);
        stone.spin.rotation.y += 0.25;
        stone.setGlow(1.2 + k);
        if (Math.random() < 0.9) sc.vfx.emit({ pos: hover, count: 6, color: [elCol, look.bright], speed: [2.5, 4], inward: true, radius: 1.4, life: [0.2, 0.3], size: [0.08, 0.2], drag: 0 });
      }, ease.inCubic);
      c.root.visible = false;
    } else {
      await sc.tw.to(0.4, (k) => seal.set(k, 0), ease.outCubic);
    }
    void sc.vfx.flash(hover, 0xffffff, 2.2, 0.25);
    sfx.aether();

    // ④ Landing: bounces twice, raising a ring of light dust
    const h0 = hover.clone();
    await sc.tw.to(0.5, (k) => {
      stone.root.position.lerpVectors(h0, ground, k);
      stone.root.position.y = ground.y + (h0.y - ground.y) * bounce(k);
      stone.spin.rotation.set(0, stone.spin.rotation.y * 0.9, 0);
    }, ease.linear);
    synth.tone({ type: 'sine', f0: 160, f1: 70, dur: 0.18, gain: 0.25 });
    void sc.vfx.ring(ground.clone().setY(0.05), look.color, 0.2, 1.6, 0.4);
    sc.vfx.emit({ pos: ground.clone().setY(0.1), count: 16, color: [look.bright, 0xffffff], speed: [0.8, 1.8], dir: new THREE.Vector3(0, 0.4, 0), spread: 1, life: [0.3, 0.6], size: [0.1, 0.2], gravity: 2 });
    void sc.rig.moveTo(ground.clone().add(away.clone().multiplyScalar(3.1)).add(side.clone().multiplyScalar(-0.9)).setY(1.35), ground.clone().setY(0.45), 0.5, ease.outCubic);

    // ⑤ Shaking: harder each time, the magic circle pulses along
    for (let i = 0; i < shakes; i++) {
      await this.wait(0.38 + i * 0.08);
      sfx.shake(i);
      const amp = 0.35 + i * 0.12;
      void sc.vfx.ring(ground.clone().setY(0.05), look.color, 0.3, 1.2 + i * 0.4, 0.45);
      sc.vfx.emit({ pos: ground.clone().setY(0.35), count: 6 + i * 4, color: [look.bright, 0xffffff], speed: [0.6, 1.6], life: [0.2, 0.45], size: [0.06, 0.14], atlas: 1 });
      await sc.tw.to(0.34, (k) => {
        stone.root.rotation.z = Math.sin(k * Math.PI * 2) * amp * (1 - k * 0.3);
        stone.root.position.y = ground.y + Math.abs(Math.sin(k * Math.PI * 2)) * 0.08;
        stone.setGlow(1 + Math.sin(k * Math.PI) * 1.4);
        seal.set(1, Math.sin(k * Math.PI));
      }, ease.linear);
      stone.root.rotation.z = 0;
      stone.root.position.y = ground.y;
    }
    await this.wait(success ? 0.4 : 0.22);

    if (success) {
      // ⑥ Success: a click seals it, the camera backs off, a light pillar and pact seal rise
      synth.tone({ type: 'triangle', f0: 1760, dur: 0.12, gain: 0.14 });
      void sc.vfx.glint(ground.clone().setY(0.5), look.bright, 2.2, 0.6, 4);
      void sc.rig.moveTo(ground.clone().add(away.clone().multiplyScalar(7)).add(side.clone().multiplyScalar(-1.6)).setY(2.8), ground.clone().setY(1.3), 0.4, ease.outCubic);
      await this.wait(0.3);
      sfx.captureOk();
      sc.stage.screenFlash(look.bright, 0.6, 3);
      sc.rig.addTrauma(0.2);
      void sc.vfx.pillar(ground.clone().setY(0), look.color, 0.5, 10, 1.1);
      void sc.vfx.ring(ground.clone().setY(0.06), look.bright, 0.4, 5, 0.8);
      void sc.vfx.circle(ground.clone().setY(1.6), look.color, 1.6, 1.4, sc.stage.camera.position.clone().sub(ground), 3);
      sc.vfx.emit({ pos: ground.clone().setY(0.6), count: 110, color: [look.color, look.bright, 0xffffff, elCol], speed: [2, 6], life: [0.6, 1.4], size: [0.1, 0.28], atlas: 1, drag: 1.6, gravity: -0.6 });
      this.ui.banner('契約成立', `${name}成為你的夥伴了！`, look.color, 0);
      this.ui.log(`契約成立！${name}成為你的夥伴。`);
      const g0 = ground.clone();
      await sc.tw.to(1.1, (k) => {
        stone.root.position.y = g0.y + ease.outCubic(k) * 1.1;
        stone.spin.rotation.y += 0.12 + k * 0.2;
        stone.setGlow(2 + k * 1.5);
        seal.set(1 - k, 1 - k);
      }, ease.linear);
      void sc.vfx.flash(stone.root.position.clone(), look.bright, 2.8, 0.3);
      sc.vfx.emit({ pos: stone.root.position.clone(), count: 40, color: [look.bright, 0xffffff], speed: [1, 3], life: [0.4, 0.9], size: [0.1, 0.22], atlas: 1 });
      await this.wait(0.3);
    } else {
      // ⑥ Failure: the stone shakes violently then shatters, and the spirit breaks out of it
      await sc.tw.to(0.22, (k) => {
        stone.root.rotation.z = Math.sin(k * Math.PI * 8) * 0.5;
        stone.setGlow(1 + k * 3);
        stone.setTint(0xff6a5a, k);
      }, ease.linear);
      sfx.captureFail();
      sc.stage.screenFlash(0xffd0c0, 0.4, 5);
      sc.rig.addTrauma(0.35);
      void sc.vfx.flash(ground.clone().setY(0.4), 0xffffff, 3, 0.3);
      void sc.vfx.debris(ground.clone().setY(0.35), look.color, 12, 6, 1.1, 0.14, 1);
      sc.vfx.emit({ pos: ground.clone().setY(0.4), count: 50, color: [look.color, look.bright, 0xffffff], speed: [3, 7], life: [0.3, 0.7], size: [0.08, 0.2], atlas: 2, drag: 2 });
      stone.root.visible = false;
      seal.set(0, 0);
      if (c) {
        c.root.visible = true;
        c.root.position.copy(target.home);
        c.setFlash(0xffffff, 1);
        c.attackPose = 1;
        void sc.vfx.ring(target.home.clone().setY(0.06), elCol, 0.4, 3.2, 0.5);
        await sc.tw.to(0.3, (k) => c.root.scale.setScalar(Math.max(0.01, k)), ease.outBack);
        void sc.tw.to(0.7, (k) => (c.attackPose = 1 - k), ease.outQuad);
        void sc.squash(1, 0.3);
      }
      this.ui.float('掙脫了！', target.home.clone().setY(2.4), 'fl-info');
      this.ui.log(`${name}掙脫了${look.name}！`);
      await this.wait(0.55);
    }
    stoneFx.kill();
    sealFx.kill();
    await sc.rig.reset(0.45);
  }
}

type StoneTier = 'basic' | 'advanced' | 'master';

const STONE_LOOK: Record<StoneTier, { name: string; color: number; bright: number }> = {
  basic: { name: '契約石', color: 0x5fc8ff, bright: 0xd8f6ff },
  advanced: { name: '高級契約石', color: 0x9a7aff, bright: 0xe8dcff },
  master: { name: '大師契約石', color: 0xffbf3a, bright: 0xfff3c8 },
};

/** Bounce curve for landing: 1 → 0, bouncing twice on the way */
function bounce(k: number): number {
  if (k < 0.55) return 1 - (k / 0.55) ** 2;
  if (k < 0.82) {
    const t = (k - 0.55) / 0.27;
    return 0.16 * 4 * t * (1 - t);
  }
  const t = (k - 0.82) / 0.18;
  return 0.05 * 4 * t * (1 - t);
}

/** Pact stone: a slender eight-sided crystal with a metal ring around its waist, wrapped in a glow */
function contractStone(look: { color: number; bright: number }) {
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);
  const geo = new THREE.OctahedronGeometry(0.24, 0);
  // The gem uses hard facet highlights and the metal ring uses four-step hard highlights (materials per the art guidelines); the outline goes through the scene objects' post-processing outline
  const gemMat = sceneMaterial(look.color, { rim: 0.35, emissive: look.color, emissiveAmt: 0.15, surface: 'gem' });
  const gem = new THREE.Mesh(geo, gemMat);
  gem.scale.set(1, 1.5, 1);
  spin.add(gem);
  const bandGeo = new THREE.TorusGeometry(0.2, 0.035, 8, 28);
  const band = new THREE.Mesh(bandGeo, sceneMaterial(0xffe2a0, { rim: 0.5, emissive: 0xfff0c0, emissiveAmt: 0.2, surface: 'metal' }));
  band.rotation.x = Math.PI / 2;
  spin.add(band);
  inkScenery(spin);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(look.bright).multiplyScalar(2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.scale.setScalar(1.3);
  root.add(glow);
  const base = new THREE.Color(look.color);
  return {
    root,
    spin,
    setGlow(v: number) {
      glow.material.opacity = Math.min(1, 0.35 + v * 0.3);
      glow.scale.setScalar(0.9 + v * 0.45);
      gemMat.uniforms.uEmissiveAmt.value = Math.min(0.9, 0.1 + v * 0.25);
    },
    setTint(col: number, k: number) {
      gemMat.uniforms.uColor.value.copy(base).lerp(new THREE.Color(col), k);
    },
  };
}

/** Pact magic circle: two rune rings, one large and one small, on the ground, rotating in opposite directions; set(expansion, pulse) */
function sealCircle(pos: THREE.Vector3, color: number, radius: number) {
  const root = new THREE.Group();
  root.position.copy(pos);
  const mk = (seed: number, r: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: runeCircleTex(seed), color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.userData.r = r;
    root.add(m);
    return m;
  };
  const outer = mk(4, radius);
  const inner = mk(5, radius * 0.55);
  inner.position.y = 0.01;
  return {
    root,
    tick(dt: number) {
      outer.rotation.z += dt * 0.6;
      inner.rotation.z -= dt * 1;
    },
    set(open: number, pulse: number) {
      for (const m of [outer, inner]) {
        m.scale.setScalar(Math.max(0.01, m.userData.r * (0.3 + 0.7 * ease.outCubic(open)) * (1 + pulse * 0.08)));
        (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, open * (0.75 + pulse * 0.5));
      }
    },
  };
}
