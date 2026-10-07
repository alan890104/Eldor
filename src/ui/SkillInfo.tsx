// Skill info card: shared by the battle popup and the Bag's loadout. Terms in the body text get their explanation attached automatically.

import { getSkill } from '../data.ts';
import { skillCost } from '../engine/battle.ts';
import { ELEMENT_COLOR } from '../battle/scene.ts';
import type { Element } from '../../sim/types.ts';
import { ElementChip, hex } from './common.tsx';
import { findTermsWith, kitTerms, RichText, TermList } from './glossary.tsx';
import { Icon } from './icons.tsx';

export const CAT_LABEL: Record<string, string> = { physical: '武技', magic: '魔法', status: '秘術', trap: '伏技', ultimate: '奧義' };

export interface DamagePreview {
  dmg: number;
  foeHp: number;
  eff: number;
}

export function powerText(id: string): string {
  const sk = getSkill(id);
  return sk.tags.hits ? `${sk.power / sk.tags.hits}×${sk.tags.hits}` : String(sk.power);
}

export function SkillInfo({ id, est, lockedLv }: { id: string; est?: DamagePreview; lockedLv?: number }) {
  const sk = getSkill(id);
  const el = sk.element as Element;
  const chips: string[] = [CAT_LABEL[sk.category]];
  if (sk.power) chips.push(`威力 ${powerText(id)}`);
  chips.push(sk.accuracy < 100 ? `命中 ${sk.accuracy}%` : '必中');
  if (sk.priority) chips.push(`先制 ${sk.priority > 0 ? '+' : ''}${sk.priority}`);
  const kit = kitTerms(id);
  // The signature mechanic goes first and is listed only once: any keyword of the mechanic used in the body text (e.g. "Flame Devour" or "Kiss") is folded into the mechanic's own explanation
  const found = findTermsWith(kit, CAT_LABEL[sk.category], sk.trigger, sk.text);
  const usesKit = found.some((t) => t.group === '專屬機制');
  const terms = [...(usesKit ? [kit[0]] : []), ...found.filter((t) => t.group !== '專屬機制')];
  return (
    <div className="skill-info" style={{ ['--c' as string]: hex(ELEMENT_COLOR[el]) }}>
      <div className="tt-head">
        <span className="sk-cat"><Icon name={sk.category} size={13} /></span>
        <b>{sk.name}</b>
        <ElementChip el={el} />
        <span className="sk-gem"><b>{skillCost(sk)}</b></span>
      </div>
      <div className="tt-chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>
      {(sk.tags.sig || sk.basic) && (
        <div className={`tt-kit ${sk.tags.sig ? 'sig' : 'basic'}`}>
          {sk.tags.sig ? <><Icon name="art" size={12} /> 招牌技：這隻精靈最具代表性的專屬技能</> : '基礎技能：同屬性精靈共通的樸素技能'}
        </div>
      )}
      {lockedLv && <div className="tt-lock">Lv {lockedLv} 習得</div>}
      {sk.category === 'ultimate' && (
        <div className="tt-ult">
          <Icon name="ultimate" size={12} /> 解鎖：第二次突破（Lv 40）｜發動：5 靈能｜每場戰鬥限用一次
        </div>
      )}
      {est && (
        <div className="tt-dmg">
          預計傷害 <b>{Math.max(1, Math.round(est.dmg))}</b>
          {est.dmg >= est.foeHp ? <span className="sk-ko">KO</span> : <span className="tt-left">（敵方剩餘生命約 {Math.max(1, Math.round(est.foeHp - est.dmg))}）</span>}
          {est.eff > 1 && <span className="tt-eff up">屬性剋制 ×1.5</span>}
          {est.eff < 1 && <span className="tt-eff down">屬性抵抗 ×0.75</span>}
        </div>
      )}
      {sk.trigger && (
        <div className="tt-trigger">
          <Icon name="trap" size={12} /> 發動條件：<RichText text={sk.trigger} extra={kit} />
        </div>
      )}
      <div className="tt-text"><RichText text={sk.text} extra={kit} /></div>
      <TermList terms={terms} />
    </div>
  );
}
