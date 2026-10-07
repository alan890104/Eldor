// The shared kit UI: gameplay overview, signature mechanic, a skill list ordered by level, and the prompt for new skills learned on level-up.
// Shared by the Bag's skills tab, the loadout screen, the Codex and the results screen. Skill data changes at any time, so this always reads from the learnset and never hard-codes a skill id.

import { useEffect, useRef, type MouseEvent } from 'react';
import { findSkill, getSpirit, SYSTEM_SKILL_IDS } from '../data.ts';
import { sfx } from '../audio/sfx.ts';
import type { Element, SkillDef, SpiritDef } from '../../sim/types.ts';
import { ELEMENT_COLOR } from '../battle/scene.ts';
import { hex } from './common.tsx';
import { RichText, showPop } from './glossary.tsx';
import { Icon } from './icons.tsx';
import { useStore } from './store.ts';
import { Thumb } from './widgets.tsx';

/** One rung of the skill list: the skills learned at the same level */
export interface LearnRung {
  lv: number;
  ids: string[];
}

/** Skills that can go into the skill slots (exists, is not an ultimate, is not a system action) */
function learnable(id: string): SkillDef | undefined {
  const s = findSkill(id);
  return s && s.category !== 'ultimate' && !SYSTEM_SKILL_IDS.has(id) ? s : undefined;
}

/** The skill list sorted by level (a skill counts only at its earliest level; deleted skills are skipped) */
export function learnLadder(sp: SpiritDef): LearnRung[] {
  const seen = new Set<string>();
  const out: LearnRung[] = [];
  for (const e of [...sp.learnset].sort((a, b) => a.lv - b.lv)) {
    if (seen.has(e.id) || !learnable(e.id)) continue;
    seen.add(e.id);
    const last = out[out.length - 1];
    if (last && last.lv === e.lv) last.ids.push(e.id);
    else out.push({ lv: e.lv, ids: [e.id] });
  }
  return out;
}

/** The small flagship-skill mark */
export function SigMark() {
  return (
    <span className="kit-sig" title="招牌技">
      <Icon name="art" size={10} />
    </span>
  );
}

/** Pop-up explaining the signature mechanic (shows the trait if there is no mechanic) */
export function showMechanic(sp: SpiritDef, el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const m = sp.mechanic;
  const lines = m ? [m.text, `特性【${sp.trait.name}】${sp.trait.text}`] : [sp.trait.text];
  showPop(
    { title: m ? `專屬機制【${m.name}】` : `特性【${sp.trait.name}】`, color: '#ffd978', icon: <Icon name="art" size={13} />, lines, width: 330 },
    r.left + r.width / 2,
    r.top > window.innerHeight / 2 ? r.top : r.bottom,
    r.top > window.innerHeight / 2,
  );
}

/** The signature mechanic's little pill (tap or hover to see the explanation) */
export function MechanicChip({ sp }: { sp: SpiritDef }) {
  if (!sp.mechanic) return null;
  const open = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    showMechanic(sp, e.currentTarget);
  };
  return (
    <button
      className="kit-mech"
      onClick={open}
      onPointerEnter={(e) => e.pointerType === 'mouse' && showMechanic(sp, e.currentTarget)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && showPop(null)}
    >
      <Icon name="art" size={12} /> {sp.mechanic.name}
    </button>
  );
}

/** Gameplay overview + signature mechanic (the Bag's skills tab, the Codex) */
export function KitBlurb({ sp }: { sp: SpiritDef }) {
  if (!sp.concept && !sp.mechanic) return null;
  return (
    <div className="kit-blurb">
      {sp.concept && <p className="kit-concept">{sp.concept}</p>}
      {sp.mechanic && (
        <div className="kit-mechbox">
          <b><Icon name="art" size={13} /> 專屬機制【{sp.mechanic.name}】</b>
          <RichText text={sp.mechanic.text} />
        </div>
      )}
    </div>
  );
}

/** Skills learned on level-up: a "Learned X!" card, showing whether it is already in the skill slots */
export function LearnedCards({ ids, equipped }: { ids: string[]; equipped: string[] }) {
  return (
    <div className="kit-learned">
      {ids.map((id) => {
        const sk = findSkill(id);
        if (!sk) return null;
        const on = equipped.includes(id);
        return (
          <div key={id} className={`kit-learn ${sk.tags.sig ? 'sig' : ''}`} style={{ ['--c' as string]: hex(ELEMENT_COLOR[sk.element as Element]) }}>
            <span className="kl-ico"><Icon name={sk.category} size={14} /></span>
            {/* Two lines: a small label on top, the skill name below; the skill name is never broken across lines */}
            <span className="kl-text">
              <small>學會新技能</small>
              <b>
                {sk.name}
                {sk.tags.sig ? <SigMark /> : null}
              </b>
            </span>
            <span className={`kl-state ${on ? 'on' : ''}`}>{on ? '已放入技能欄' : '未攜帶'}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
  * The prompt after a level-up from an EXP Potion and the like: lists the skills learned; if the skill slots are full and the new skill didn't go in, it offers a button to edit the loadout.
  * It doesn't block input: when there is nothing to handle it closes itself after a few seconds.
 */
export function LearnPop({ uid, ids, onEdit, onClose }: { uid: string; ids: string[]; onEdit: (uid: string, focusId?: string) => void; onClose: () => void }) {
  const { save } = useStore();
  const s = save.spirits.find((x) => x.uid === uid);
  const shown = ids.filter((id) => !!findSkill(id));
  const waiting = !!s && shown.some((id) => !s.loadout.includes(id)) && s.loadout.length >= 4;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (waiting) return;
    const t = window.setTimeout(() => close.current(), 5000);
    return () => window.clearTimeout(t);
  }, [uid, ids, waiting]);
  if (!s || shown.length === 0) return null;
  const sp = getSpirit(s.speciesId);
  return (
    <div className="learn-pop panel" role="status">
      <div className="lp-head">
        <Thumb speciesId={s.speciesId} stage={s.stage} size={40} />
        <b>{sp.name} 升到了 Lv {s.level}！</b>
        <button className="lp-close" onClick={() => { sfx.click(); onClose(); }} aria-label="關閉">×</button>
      </div>
      <LearnedCards ids={shown} equipped={s.loadout} />
      {waiting ? (
        <div className="lp-foot">
          <span>技能欄已滿，要換上新技能嗎？</span>
          <button className="btn small gold" onClick={() => { sfx.click(); onEdit(uid, shown.find((id) => !s.loadout.includes(id))); }}>
            <Icon name="swap" size={14} /> 配置技能
          </button>
        </div>
      ) : (
        <div className="lp-foot note">新技能已放入技能欄的空位。</div>
      )}
    </div>
  );
}
