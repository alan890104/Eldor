// Kit-related parts of the battle UI: the guard button (a system action), names and descriptions of status marks (shown by SideHud), and the action-order reversal hint.
// Marks come from the engine's CombatantView.marks / SideView.conds: built-in ids have fixed names and descriptions,
// kits (data/kits, src/engine/kits) may add marks at any time, so an unknown id is always shown by its note (or the id if there is none), and no kit is hard-coded.

import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { findSkill, findSpirit } from '../../data.ts';
import { GUARD_COST } from '../../engine/battle.ts';
import { ELEMENT_COLOR } from '../../battle/scene.ts';
import type { MarkView } from '../../engine/types.ts';
import type { Element } from '../../../sim/types.ts';
import { sfx } from '../../audio/sfx.ts';
import { hex } from '../common.tsx';
import { Icon } from '../icons.tsx';
import { COARSE } from '../partyDrag.ts';
import { getTerm } from '../glossary.tsx';
import { FIELD_NAME } from '../../battle/director.ts';

/** The battle UI's tooltip box (compatible with BattleHUD's Tip); extra is additional paragraphs */
export type HudTip = { title: string; text: string; icon?: string; color?: string; extra?: string[] };
type OnTip = (t: HudTip | null) => void;

/** Mouse: shown while hovering, closed on leave; touch: a tap shows it for a while */
export function tipHandlers(tip: HudTip, onTip: OnTip, hold = 2600) {
  return {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => e.pointerType === 'mouse' && onTip(tip),
    onPointerLeave: (e: PointerEvent<HTMLElement>) => e.pointerType === 'mouse' && onTip(null),
    onClick: (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      onTip(tip);
      window.setTimeout(() => onTip(null), hold);
    },
  };
}

// ───────────────────────── Guard ─────────────────────────

/** Guard's hotkey (uses the physical key position, like E / F / M in the field) */
const GUARD_KEY = 'KeyG';

/**
 * Guard (a system action): takes no skill slot and sits beside switch. Usable when reason is null; otherwise the button dims and shows the reason,
 * and a tap (touch) or the hotkey explains why guarding is not allowed, without sending an action.
 */
export function GuardButton({ reason, onTip, onGuard }: { reason: string | null; onTip: OnTip; onGuard: () => void }) {
  const tip: HudTip = {
    title: '格擋',
    text: `系統行動，不佔技能欄：本回合免疫攻擊與奧義的傷害及附加效果（伏技仍會發動）。消耗 ${GUARD_COST} 靈能、先制 +3；不能連續兩回合使用，蓄力中也不能格擋。`,
    icon: 'shield',
    color: '#8fe0ff',
    extra: reason ? [`現在不能格擋：${reason}`] : COARSE ? undefined : ['快捷鍵：G'],
  };
  const latest = useRef({ reason, tip, onTip, onGuard });
  latest.current = { reason, tip, onTip, onGuard };
  const press = () => {
    const l = latest.current;
    if (l.reason) {
      sfx.error();
      l.onTip(l.tip);
      window.setTimeout(() => l.onTip(null), 2200);
      return;
    }
    l.onTip(null);
    l.onGuard();
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== GUARD_KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
      // Don't fire by accident while the help book or a dialog is open
      if (document.querySelector('.help-overlay, .modal')) return;
      e.preventDefault();
      press();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);
  return (
    <button
      className={`act hud-guard ${reason ? 'off' : ''}`}
      aria-disabled={!!reason}
      title={reason ? `不能格擋：${reason}` : COARSE ? '格擋' : '格擋（G）'}
      onClick={press}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onTip(tip)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onTip(null)}
    >
      <Icon name="shield" size={16} />
      <span className="hud-guard-label">
        <span className="hud-guard-name">格擋</span>
        <small className={`hud-guard-sub ${reason ? 'why' : ''}`}>{reason ?? '先制 +3'}</small>
      </span>
      <span className="hud-guard-cost" title={`消耗 ${GUARD_COST} 靈能`}><b>{GUARD_COST}</b></span>
      {!COARSE && <kbd className="hud-guard-key">G</kbd>}
    </button>
  );
}

// ───────────────────────── Status marks ─────────────────────────

interface MarkInfo {
  name: string;
  icon: string;
  color: string;
  /** The number on a mark (stacks, percentage, countdown) */
  value?: string;
  turns?: number;
  title: string;
  text: string;
  /** kit = signature mechanic, fx = turn-based effect, sys = engine built-in */
  kind: 'kit' | 'fx' | 'sys';
}

const turnsText = (t?: number) => (t ? `剩 ${t} 回合` : '');
const withTurns = (s: string, t?: number) => (t ? `${s}（${turnsText(t)}）` : s);

/** Names and descriptions of the engine's built-in marks (for n / turns / note see marksOf / condsOf in battle.ts) */
const BUILTIN: Record<string, (m: MarkView) => Omit<MarkInfo, 'kind' | 'turns'> & { turns?: number }> = {
  decoy: (m) => ({ name: '替身', icon: 'shield', color: '#c8b0ff', value: `${m.n ?? 0}%`, title: `替身（${m.n ?? 0}% 最大生命）`, text: '替本體承受攻擊，被打破前本體不會受到攻擊傷害。' }),
  disabled: (m) => ({ name: '封印', icon: 'silence', color: '#f0e090', turns: m.turns, title: withTurns(`封印：${m.note ?? '技能'}`, m.turns), text: `「${m.note ?? '技能'}」暫時無法使用。替換可以解除。` }),
  bound: (m) => ({ name: '纏繞', icon: 'root', color: '#c8955a', value: m.n ? `${m.n}%` : undefined, turns: m.turns, title: withTurns('纏繞', m.turns), text: `無法替換，回合結束時失去 ${m.n ?? 0}% 最大生命。` }),
  perish: (m) => ({ name: '終焉', icon: 'skull', color: '#ff7a9a', value: String(m.n ?? 0), title: `終焉（${m.n ?? 0} 回合後倒下）`, text: '倒數歸零時倒下；替換離場即可解除。' }),
  exposed: (m) => ({ name: '破綻', icon: 'eye', color: '#ff9a6a', turns: m.turns, title: withTurns('破綻', m.turns), text: '下一次受到的攻擊必定暴擊。' }),
  bond: () => ({ name: '同命', icon: 'curse', color: '#ff6a9a', title: '同命', text: '在自己下一次行動前被攻擊擊倒時，擊倒者也一起倒下。' }),
  echo: (m) => ({ name: '回音', icon: 'magic', color: '#b0a0ff', title: `回音：${m.note ?? ''}`, text: `「${m.note ?? '技能'}」的回音會在之後的回合結束時再攻擊一次。` }),
  hidden: () => ({ name: '潛地', icon: 'charging', color: '#c49a5a', title: '潛地', text: '蓄力中，對手的攻擊無法命中。' }),
  retaliate: () => ({ name: '反擊架勢', icon: 'shield', color: '#ffb070', title: '反擊架勢', text: '本回合受到攻擊時，把部分傷害反擊給攻擊者。' }),
  snowball: (m) => ({ name: '連環', icon: 'up', color: '#ffd978', value: `×${1.5 ** (m.n ?? 1)}`, title: `連環：${m.note ?? ''}（威力 ×${1.5 ** (m.n ?? 1)}）`, text: `連續使用「${m.note ?? '同一個技能'}」時，威力每次 ×1.5（最多 ×2.25）；命中失敗或改用其他技能時重新計算。` }),
  // Side conditions
  hazard: (m) => ({ name: '入場陷阱', icon: 'trap', color: '#c49a5a', value: m.n ? `${m.n}%` : undefined, title: '入場陷阱', text: `這一方的精靈入場時受到 ${m.n ?? 0}% 最大生命的傷害${m.note ? `，${m.note} 階` : ''}。` }),
  screenPhys: (m) => ({ name: '晶壁', icon: 'def', color: '#ffd978', turns: m.turns, title: withTurns('晶壁', m.turns), text: `這一方受到的武技傷害 −${m.n ?? 0}%。` }),
  screenMag: (m) => ({ name: '光幕', icon: 'res', color: '#9ae0ff', turns: m.turns, title: withTurns('光幕', m.turns), text: `這一方受到的魔法傷害 −${m.n ?? 0}%。` }),
  wish: (m) => ({ name: '許願', icon: 'heal', color: '#7dffa0', turns: m.turns, title: withTurns('許願', m.turns), text: `願望實現時，場上的精靈回復 ${m.n ?? 0}% 最大生命。` }),
  doom: (m) => ({ name: '預言', icon: 'skull', color: '#b03aa8', turns: m.turns, title: withTurns('預言', m.turns), text: `預言應驗時，這一方場上的精靈受到 ${m.n ?? 0}% 最大生命的傷害。` }),
  healWish: () => ({ name: '生命之歌', icon: 'heal', color: '#7dffa0', title: '生命之歌', text: '下一隻入場的精靈完全回復，並解除異常。' }),
  aeLoan: (m) => ({ name: '預支', icon: 'aether', color: '#ffc98a', value: m.n ? `−${m.n}` : undefined, turns: m.turns, title: withTurns('靈能預支', m.turns), text: `償還中：每回合結束時的靈能回復 −${m.n ?? 0}。` }),
};

/** Display data for a mark; owner is the species of the spirit carrying the mark (kit marks use it to look up the signature mechanic description) */
export function markInfo(m: MarkView, owner?: string): MarkInfo {
  const b = BUILTIN[m.id];
  if (b) {
    const r = b(m);
    return { ...r, turns: r.turns ?? m.turns, kind: 'sys' };
  }
  const value = m.n !== undefined && m.n !== 0 ? String(m.n) : undefined;
  // Lingering effect (turn-based effect): fx:<skill id>, note is the effect name
  if (m.id.startsWith('fx:')) {
    const sk = findSkill(m.id.slice(3));
    const name = m.note ?? sk?.name ?? m.id.slice(3);
    return {
      name,
      icon: sk && sk.category !== 'ultimate' ? sk.category : 'charging',
      color: sk ? hex(ELEMENT_COLOR[sk.element as Element]) : '#e8e0ff',
      value,
      turns: m.turns,
      title: withTurns(`${name}${value ? ` ×${value}` : ''}`, m.turns),
      text: sk ? `回合類效果（來自「${sk.name}」）：${sk.text}` : '回合類效果，回合數歸零時消失。',
      kind: 'fx',
    };
  }
  // A kit's signature mechanic mark (kit:<name>) and other unknown marks: the name comes from note, the description from this spirit's signature mechanic
  const name = m.note ?? m.id.replace(/^kit:/, '');
  const mech = owner ? findSpirit(owner)?.mechanic : undefined;
  return {
    name,
    icon: 'art',
    color: '#ffd978',
    value,
    turns: m.turns,
    title: withTurns(`${name}${value ? ` ${value}` : ''}`, m.turns),
    text: mech ? `專屬機制【${mech.name}】${mech.text}` : m.note && m.note !== name ? m.note : '這隻精靈的專屬機制狀態。',
    kind: 'kit',
  };
}

/** Terrain (top row): name and remaining turns, tap to see the effect */
export function FieldTag({ element, turns, onTip }: { element: Element; turns: number; onTip: OnTip }) {
  const name = FIELD_NAME[element];
  const color = hex(ELEMENT_COLOR[element]);
  const tip: HudTip = { title: `場地・${name}（剩 ${turns} 回合）`, text: getTerm(name)?.text ?? '同屬性技能傷害 +30%，並附帶特殊效果。', icon: 'field', color };
  return (
    <span className="ht-tag" style={{ ['--c' as string]: color }} {...tipHandlers(tip, onTip, 3200)}>
      <Icon name="field" size={13} />
      <span>{name}</span>
      <i className="ht-n">{turns}</i>
    </span>
  );
}

/** Hint for action-order reversal (Trick Room style): remaining turns */
export function ReverseChip({ turns, onTip }: { turns: number; onTip: OnTip }) {
  const tip: HudTip = {
    title: `行動順序反轉（剩 ${turns} 回合）`,
    text: '先制相同時，速度較慢的精靈先行動；入場與回合結束的順序也反轉。再次使用同類技能會恢復正常。',
    icon: 'swap',
    color: '#d8a0ff',
  };
  return (
    <span className="ht-tag reverse" style={{ ['--c' as string]: '#b070ff' }} {...tipHandlers(tip, onTip, 3200)}>
      <Icon name="swap" size={13} />
      <span className="hr-long">順序反轉</span>
      <span className="hr-short">反轉</span>
      <i className="ht-n">{turns}</i>
    </span>
  );
}
