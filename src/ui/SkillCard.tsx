// Skill card: battle, the Bag's skill tab and the loadout all share this one card.
// Hovering or clicking shows the full description; in battle it is shown in a fixed info box (onTip) instead, and on touch a long press shows the description while a short press uses the skill.

import { useRef, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { getSkill } from '../data.ts';
import { isAttack, skillCost } from '../engine/battle.ts';
import { ELEMENT_COLOR } from '../battle/scene.ts';
import type { Element } from '../../sim/types.ts';
import { ElementChip, hex } from './common.tsx';
import { showPop } from './glossary.tsx';
import { cardTags, effectIcons, Icon } from './icons.tsx';
import { CAT_LABEL, powerText, SkillInfo, type DamagePreview } from './SkillInfo.tsx';

/** Estimated damage in battle: its share of the opponent's max HP, whether it knocks out, and the element matchup */
export interface CardEstimate extends DamagePreview {
  pct: number;
  ko: boolean;
}

/** Shows the skill's full description beside the element */
export function showSkillInfo(id: string, el: HTMLElement, lockedLv?: number): void {
  const sk = getSkill(id);
  const r = el.getBoundingClientRect();
  const above = r.top + r.height / 2 > window.innerHeight / 2;
  showPop(
    { title: sk.name, color: hex(ELEMENT_COLOR[sk.element as Element]), lines: [], body: <SkillInfo id={id} lockedLv={lockedLv} />, width: 340 },
    r.left + r.width / 2,
    above ? r.top : r.bottom,
    above,
  );
}

export function SkillCard({
  id,
  est,
  ok = true,
  reason,
  selected,
  dim,
  aetherShort,
  lockedLv,
  className = '',
  onClick,
  onTip,
  attrs,
  children,
}: {
  id: string;
  est?: CardEstimate;
  /** false: not usable right now; the card dims and shows reason at the bottom */
  ok?: boolean;
  reason?: string;
  selected?: boolean;
  dim?: boolean;
  aetherShort?: boolean;
  /** The level at which the skill is not yet learned (the info popup marks it) */
  lockedLv?: number;
  className?: string;
  onClick?: () => void;
  /** Custom way to show the description; when not given, hovering or clicking shows the info popup */
  onTip?: (show: boolean) => void;
  /** Extra props (drag-and-drop events and data-drop) */
  attrs?: ButtonHTMLAttributes<HTMLButtonElement> & { 'data-drop'?: string };
  children?: ReactNode;
}) {
  const sk = getSkill(id);
  const el = sk.element as Element;
  const atk = isAttack(sk);
  const tags = atk ? cardTags(sk) : [];
  const effects = atk ? [] : effectIcons(sk.tags as Record<string, number>);
  const nameLen = [...sk.name].length;
  const ko = !!est?.ko && ok;
  // Touch: the description shows only after holding a moment, and releasing then does not use the skill; a short press uses it right away
  const hold = useRef<{ timer: number; long: boolean } | null>(null);
  const cancelHold = () => {
    if (hold.current && !hold.current.long) {
      clearTimeout(hold.current.timer);
      hold.current = null;
    }
  };
  const tip = onTip
    ? {
        onMouseEnter: () => onTip(true),
        onMouseLeave: () => onTip(false),
        onTouchStart: () => {
          const h = { timer: 0, long: false };
          h.timer = window.setTimeout(() => {
            h.long = true;
            onTip(true);
          }, 380);
          hold.current = h;
        },
        onTouchMove: cancelHold,
        onTouchEnd: () => {
          const h = hold.current;
          if (!h) return;
          clearTimeout(h.timer);
          if (h.long) window.setTimeout(() => onTip(false), 1800);
        },
        onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      }
    : {
        // While dragging (mouse held down), do not pop the description when passing over other cards
        onPointerEnter: (e: PointerEvent<HTMLElement>) => e.pointerType === 'mouse' && e.buttons === 0 && showSkillInfo(id, e.currentTarget, lockedLv),
        onPointerLeave: (e: PointerEvent<HTMLElement>) => e.pointerType === 'mouse' && showPop(null),
      };
  return (
    <button
      className={`skill ${sk.category} ${ok ? '' : 'off'} ${selected ? 'sel' : ''} ${dim ? 'dim' : ''} ${sk.tags.sig ? 'sig' : ''} ${className}`}
      style={{ ['--c' as string]: hex(ELEMENT_COLOR[el]) }}
      onClick={(e) => {
        if (hold.current?.long) {
          hold.current = null;
          return;
        }
        hold.current = null;
        if (onClick) onClick();
        else if (!onTip) showSkillInfo(id, e.currentTarget, lockedLv);
      }}
      {...tip}
      {...attrs}
    >
      <div className="sk-head">
        <span className="sk-cat" title={CAT_LABEL[sk.category]}>
          <Icon name={sk.category} size={13} />
        </span>
        <span className="sk-catname">{CAT_LABEL[sk.category]}</span>
        <span className="sk-el"><ElementChip el={el} /></span>
        <span className="sk-tags">
          {ko && <span className="sk-ko">KO</span>}
          {tags.map((t, i) => (
            <span key={i} className="sk-tag" style={{ color: t.color }} title={t.title}>
              <Icon name={t.icon} size={11} />
              {t.label && <i>{t.label}</i>}
            </span>
          ))}
        </span>
        <span className={`sk-gem ${aetherShort ? 'short' : ''}`} title="靈能消耗">
          <b>{skillCost(sk)}</b>
        </span>
      </div>
      <div className={`sk-name ${nameLen >= 6 ? 'xl' : nameLen >= 5 ? 'l' : ''}`}>
        {sk.name}
        {sk.tags.sig ? <i className="sk-sig" title="招牌技：這隻精靈最具代表性的專屬技能">招牌</i> : null}
      </div>
      <div className="sk-foot">
        {!ok && reason && (!aetherShort || sk.category === 'ultimate') ? (
          <span className="sk-why">{reason}</span>
        ) : atk ? (
          <span className="sk-pow-row">
            {est && est.eff > 1 && <span className="sk-eff up" title="屬性剋制 ×1.5"><Icon name="up" size={10} />剋制</span>}
            {est && est.eff < 1 && <span className="sk-eff down" title="屬性抵抗 ×0.75"><Icon name="down" size={10} />抵抗</span>}
            <span className="sk-pow-label">威力</span>
            <b className="sk-pow">{powerText(id)}</b>
            {ko && <span className="sk-ko big">KO</span>}
          </span>
        ) : (
          <span className="sk-fx">
            {effects.map((e) => (
              <span key={e.label} className="fx" style={{ color: e.color }}>
                <Icon name={e.icon} size={14} />
                {e.up && <Icon name="up" size={7} className="fx-arrow" />}
                {e.down && <Icon name="down" size={7} className="fx-arrow" />}
                <em>{e.label}</em>
              </span>
            ))}
          </span>
        )}
      </div>
      {tags.length > 0 && (
        <div className="sk-lines">
          {tags.map((t, i) => (
            <span key={i} className="sk-line" style={{ color: t.color }}>
              <Icon name={t.icon} size={12} />
              <em>{t.title}</em>
            </span>
          ))}
        </div>
      )}
      {children}
    </button>
  );
}
