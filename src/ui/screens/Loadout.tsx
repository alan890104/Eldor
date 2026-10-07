// Skills: the "Skills" tab of the Bag's detail view, and the skill loadout (tap or drag skill cards to place, replace, reorder and remove them).

import { Fragment, useEffect, useState } from 'react';
import { findSkill, getSkill, getSpirit, learnedSkills } from '../../data.ts';
import { sfx } from '../../audio/sfx.ts';
import { validateLoadout } from '../../game/progression.ts';
import { defaultLoadout } from '../../game/loadout.ts';
import type { SpiritInstance } from '../../engine/types.ts';
import { ElementChip } from '../common.tsx';
import { store, useStore } from '../store.ts';
import { Thumb } from '../widgets.tsx';
import { Icon } from '../icons.tsx';
import { SkillInfo } from '../SkillInfo.tsx';
import { SkillCard } from '../SkillCard.tsx';
import { showPop } from '../glossary.tsx';
import { parseDrop, useDragDrop } from '../dragDrop.ts';
import { COARSE } from '../partyDrag.ts';
import { KitBlurb, learnLadder, MechanicChip } from '../KitInfo.tsx';

function spiritName(s: SpiritInstance): string {
  return getSpirit(s.speciesId).name;
}

/** The "Skills" tab of the detail view: the equipped skill cards and the ultimate; tap or hover for the full description */
export function SkillSummary({ s, onEdit }: { s: SpiritInstance; onEdit: () => void }) {
  const sp = getSpirit(s.speciesId);
  return (
    <div className="skill-sum">
      <KitBlurb sp={sp} />
      <div className="sk-deck">
        {s.loadout.map((id) => <SkillCard key={id} id={id} />)}
        <SkillCard id={sp.ultimate} ok={s.stage >= 3} reason="階段 III 解鎖" />
      </div>
      <button className="btn gold ss-edit" onClick={onEdit}>
        <Icon name="swap" size={16} /> 配置技能
      </button>
      <p className="note">{COARSE ? '點一下' : '滑鼠停留或點選'}技能卡可查看詳細說明。戰鬥中只能使用攜帶的技能（最多 4 個）；每隻精靈依自己的技能表在升級時習得新技能。格擋是系統行動，不佔技能欄。</p>
    </div>
  );
}

// ───────────────────────── Skill loadout ─────────────────────────

type Focus = { id: string; equipped: boolean; lockedLv?: number };
/** The skill being dragged: from the skill slots above or the skill pool below */
type SkillDrag = { id: string; from: 'slot' | 'pool' };

/** The skill slots after a drop; null means no change. Drop targets: slot:<position> (skill slots), pool (skill pool, removes the skill) */
function dropLoadout(loadout: string[], src: SkillDrag, target: string): string[] | null {
  const { kind, arg } = parseDrop(target);
  if (kind === 'pool') return src.from === 'slot' ? loadout.filter((x) => x !== src.id) : null;
  if (kind !== 'slot') return null;
  const i = Number(arg);
  const from = loadout.indexOf(src.id);
  if (src.from === 'pool') return i < loadout.length ? loadout.map((x, j) => (j === i ? src.id : x)) : [...loadout, src.id];
  if (i === from || (i >= loadout.length && from === loadout.length - 1)) return null;
  if (i >= loadout.length) return [...loadout.filter((x) => x !== src.id), src.id];
  const next = [...loadout];
  [next[from], next[i]] = [next[i], next[from]];
  return next;
}

function skillDropLabel(loadout: string[], src: SkillDrag, target: string): string {
  const { kind, arg } = parseDrop(target);
  if (kind === 'pool') return '卸下';
  if (Number(arg) >= loadout.length) return '放入';
  return src.from === 'slot' ? '互換' : '替換';
}

/** focusId: the skill selected as soon as it opens (e.g. one just learned that isn't in the skill slots yet; when the slots are full it goes straight into replace mode) */
export function LoadoutEditor({ uid, onSwitch, onDone, focusId }: { uid: string; onSwitch: (uid: string) => void; onDone: () => void; focusId?: string }) {
  const { save } = useStore();
  const s = save.spirits.find((x) => x.uid === uid)!;
  const sp = getSpirit(s.speciesId);
  const learned = learnedSkills(sp, s.level);
  /** Skill list (by learn level): the line between learned and not yet learned is the current level */
  const ladder = learnLadder(sp);
  const total = ladder.reduce((n, r) => n + r.ids.length, 0);
  const learnedCount = ladder.filter((r) => r.lv <= s.level).reduce((n, r) => n + r.ids.length, 0);
  const nextRung = ladder.find((r) => r.lv > s.level);
  const initialFocus = (): Focus | null =>
    focusId && learned.includes(focusId) && !s.loadout.includes(focusId) ? { id: focusId, equipped: false } : s.loadout[0] ? { id: s.loadout[0], equipped: true } : null;
  const [focus, setFocus] = useState<Focus | null>(initialFocus);
  useEffect(() => setFocus(initialFocus()), [uid, focusId]);
  // When opened with a new skill to handle, scroll it into view in the skill list
  useEffect(() => {
    if (!focusId) return;
    const t = window.setTimeout(() => document.querySelector('.lo-editor .le-rung .skill.focus')?.scrollIntoView({ block: 'nearest' }), 60);
    return () => window.clearTimeout(t);
  }, [uid, focusId]);
  const full = s.loadout.length >= 4;
  const swapping = !!focus && !focus.equipped && !focus.lockedLv && full;
  const [landed, setLanded] = useState<string[]>([]);
  useEffect(() => {
    if (!landed.length) return;
    const t = window.setTimeout(() => setLanded([]), 450);
    return () => window.clearTimeout(t);
  }, [landed]);

  const allowed = (next: string[] | null): next is string[] => {
    if (!next) return false;
    const err = validateLoadout(s.speciesId, next, s.level);
    return !err || err === '建議至少帶一個 0 費攻擊';
  };
  const apply = (next: string[]): boolean => {
    const err = validateLoadout(s.speciesId, next, s.level);
    if (err && err !== '建議至少帶一個 0 費攻擊') {
      sfx.error();
      store.showToast(err);
      return false;
    }
    sfx.confirm();
    store.mutate((d) => (d.spirits.find((x) => x.uid === uid)!.loadout = next));
    if (err) store.showToast('提醒：建議至少攜帶一個 0 靈能的攻擊技能，靈能不足時仍可出手');
    return true;
  };
  const equip = (id: string) => {
    if (full) return;
    if (apply([...s.loadout, id])) setFocus({ id, equipped: true });
  };
  const unequip = (id: string) => {
    if (s.loadout.length <= 1) {
      sfx.error();
      store.showToast('至少需要攜帶 1 個技能');
      return;
    }
    if (apply(s.loadout.filter((x) => x !== id))) setFocus({ id, equipped: false });
  };
  const onSlot = (id: string) => {
    if (swapping && focus) {
      const next = s.loadout.map((x) => (x === id ? focus.id : x));
      if (apply(next)) {
        setFocus({ id: focus.id, equipped: true });
        setLanded([focus.id, id]);
      }
      return;
    }
    sfx.click();
    setFocus({ id, equipped: true });
  };
  const pick = (id: string, lockedLv?: number) => {
    sfx.click();
    setFocus({ id, equipped: false, lockedLv });
  };
  // Recommended loadout: the same automatic loadout that newly obtained spirits and AI opponents get (the kit's core skills come first)
  const recommended = defaultLoadout(s.speciesId, s.level);
  const isRecommended = recommended.length === s.loadout.length && recommended.every((id) => s.loadout.includes(id));
  const applyRecommended = () => {
    if (isRecommended || recommended.length === 0) {
      sfx.click();
      store.showToast('目前已是推薦配招');
      return;
    }
    if (!apply(recommended)) return;
    setFocus({ id: recommended[0], equipped: true });
    setLanded(recommended);
    store.showToast('已套用推薦配招');
  };

  const dnd = useDragDrop<SkillDrag>({
    canDrop: (src, t) => allowed(dropLoadout(s.loadout, src, t)),
    onDrop: (src, t) => {
      const next = dropLoadout(s.loadout, src, t);
      if (!next || !apply(next)) return;
      const { kind, arg } = parseDrop(t);
      const other = kind === 'slot' ? s.loadout[Number(arg)] : undefined;
      setFocus({ id: src.id, equipped: kind === 'slot' });
      setLanded(other ? [src.id, other] : [src.id]);
    },
    onStart: () => showPop(null),
    onTap: (src) => {
      sfx.click();
      setFocus({ id: src.id, equipped: src.from === 'slot' });
    },
  });
  const drag = dnd.drag;
  const target = (key: string) => {
    const ok = !!drag && allowed(dropLoadout(s.loadout, drag.src, key));
    return { ok, over: ok && drag?.over === key, cls: `${ok ? 'drop-ok' : ''} ${ok && drag?.over === key ? 'drop-over' : ''}` };
  };
  /** A draggable skill card: the source goes semi-transparent, valid drop spots are hinted, and a card just dropped gives a little bounce */
  const dragCard = (id: string, from: 'slot' | 'pool', key?: string) => {
    const t = key ? target(key) : null;
    return {
      cls: `${drag?.src.id === id ? 'drag-src' : ''} ${t?.cls ?? ''} ${landed.includes(id) ? 'landed' : ''}`,
      tag: t?.over && drag ? <span className="drop-tag"><Icon name="swap" size={14} /> {skillDropLabel(s.loadout, drag.src, key!)}</span> : null,
      attrs: { ...(key ? { 'data-drop': key } : {}), ...dnd.bind({ id, from }) },
    };
  };

  const switchable = [...save.party.map((u) => save.spirits.find((x) => x.uid === u)!).filter(Boolean)];
  if (!switchable.some((x) => x.uid === uid)) switchable.push(s);
  const pool = target('pool');

  /** One row of the skill list: level label + skill card. A learned skill can be dragged into the skill slots; an equipped one can be dragged to another slot or back to the skill list to remove it */
  const rungCard = (id: string, lv: number) => {
    const lockedLv = lv > s.level ? lv : undefined;
    const equipped = !lockedLv && s.loadout.includes(id);
    const d = lockedLv ? null : dragCard(id, equipped ? 'slot' : 'pool');
    const focused = focus?.id === id && (equipped ? focus.equipped : !focus.equipped);
    return (
      <div key={id} className={`le-rung ${lockedLv ? 'locked' : equipped ? 'equipped' : ''}`}>
        <div className="le-rlv">
          <b>Lv {lv}</b>
          <span>{lockedLv ? '未習得' : equipped ? '攜帶中' : '已習得'}</span>
        </div>
        <SkillCard
          id={id}
          ok={!lockedLv}
          reason={lockedLv ? `Lv ${lockedLv} 習得` : undefined}
          lockedLv={lockedLv}
          className={`${focused ? 'focus' : ''} ${equipped ? 'in-slot' : ''} ${d?.cls ?? ''}`}
          onClick={() => (equipped ? onSlot(id) : pick(id, lockedLv))}
          attrs={d?.attrs}
        />
      </div>
    );
  };
  const ultOpen = s.stage >= 3;
  const ult = findSkill(sp.ultimate);

  const hint = drag
    ? drag.src.from === 'slot'
      ? '拖到其他技能欄可互換位置，拖回下方即可卸下'
      : full ? '放到技能欄上即可替換' : '放到空位，或放到技能欄上替換'
    : swapping
      ? `技能欄已滿：點選上方要替換的技能，換成「${getSkill(focus!.id).name}」`
      : COARSE ? '長按拖曳技能卡：放入、替換、換位或卸下' : '按住技能卡即可拖曳：放入、替換、調整順序，或拖回下方卸下';

  return (
    <div className={`lo-editor panel ${drag ? 'dnd-active' : ''}`} ref={dnd.rootRef}>
      <div className="le-head">
        <Thumb speciesId={s.speciesId} stage={s.stage} size={56} />
        <div className="le-id">
          <b>{spiritName(s)} 的技能配置</b>
          <span>
            {sp.elements.map((e) => <ElementChip key={e} el={e} />)} Lv {s.level}　攜帶中 <b className="le-count">{s.loadout.length}/4</b>
            <MechanicChip sp={sp} />
          </span>
          {sp.concept && <p className="le-concept">{sp.concept}</p>}
        </div>
        {switchable.length > 1 && (
          <div className="le-switch">
            {switchable.map((x) => (
              <button key={x.uid} className={x.uid === uid ? 'on' : ''} title={spiritName(x)} onClick={() => { sfx.click(); onSwitch(x.uid); }}>
                <Thumb speciesId={x.speciesId} stage={x.stage} size={40} />
              </button>
            ))}
          </div>
        )}
        <div className="le-headbtns">
          <button
            className={`btn small le-rec ${isRecommended ? 'ghost' : ''}`}
            onClick={applyRecommended}
            title="依技能組的核心技能與目前等級，自動挑選 4 個技能"
          >
            <Icon name="up" size={14} /> 推薦配招
          </button>
          <button className="btn gold small le-done" onClick={onDone}>完成</button>
        </div>
      </div>

      <div className={`le-slots sk-deck ${swapping ? 'swapping' : ''}`}>
        {[0, 1, 2, 3].map((i) => {
          const id = s.loadout[i];
          const key = `slot:${i}`;
          if (!id) {
            const t = target(key);
            return (
              <div key={`empty-${i}`} className={`lo-card empty ${t.cls}`} data-drop={key}>
                <span>空位</span>
                <small>{drag ? '放到這裡' : '把下方技能拖到這裡'}</small>
                {t.over && <span className="drop-tag">放入</span>}
              </div>
            );
          }
          const d = dragCard(id, 'slot', key);
          return (
            <SkillCard
              key={id}
              id={id}
              className={`${focus?.equipped && focus.id === id ? 'focus' : ''} ${swapping ? 'swap' : ''} ${d.cls}`}
              onClick={() => onSlot(id)}
              attrs={d.attrs}
            >
              {d.tag ?? (swapping && <span className="lc-swap"><Icon name="swap" size={14} /> 替換</span>)}
            </SkillCard>
          );
        })}
        <SkillCard
          id={sp.ultimate}
          ok={s.stage >= 3}
          reason="階段 III 解鎖"
          className={focus?.id === sp.ultimate ? 'focus' : ''}
          onClick={() => { sfx.click(); setFocus({ id: sp.ultimate, equipped: true }); }}
        />
      </div>
      <div className={`le-swap-hint ${drag || swapping ? 'on' : ''}`}><Icon name="swap" size={15} /> {hint}</div>

      <div className="le-body">
        <div className={`le-poolbox ${pool.cls}`} data-drop="pool">
          <div className="le-pool">
            <div className="le-group">
              <div className="le-gtitle">
                技能表 <small>已習得 {learnedCount}／共 {total} 個{nextRung ? `・下一個在 Lv ${nextRung.lv}` : total ? '・已全部習得' : ''}</small>
              </div>
              <div className="le-tiles le-ladder">
                {ladder.map((r, i) => (
                  <Fragment key={r.lv}>
                    {r === nextRung && i > 0 && (
                      <div className="le-now"><span>目前 Lv {s.level}</span><i>以下升級後習得</i></div>
                    )}
                    {r.ids.map((id) => rungCard(id, r.lv))}
                  </Fragment>
                ))}
                {ult && (
                  <button
                    className={`le-ultrung ${ultOpen ? 'open' : ''} ${focus?.id === sp.ultimate ? 'focus' : ''}`}
                    onClick={() => { sfx.click(); setFocus({ id: sp.ultimate, equipped: true }); }}
                  >
                    <span className="le-rlv"><b>階段 III</b><span>{ultOpen ? '已解鎖' : '未解鎖'}</span></span>
                    <Icon name="ultimate" size={16} />
                    <span className="lu-name">奧義「{ult.name}」</span>
                    <small>{ultOpen ? '固定攜帶，不佔技能欄' : '第二次突破（Lv 40）後解鎖'}</small>
                  </button>
                )}
              </div>
            </div>
          </div>
          {pool.over && <div className="drop-tag store-tag">放開以卸下</div>}
        </div>
        <div className="le-detail">
          {focus ? (
            <>
              <SkillInfo id={focus.id} lockedLv={focus.lockedLv} />
              <div className="le-actions">
                {focus.id === sp.ultimate ? (
                  <span className="note">{s.stage < 3 ? '第二次突破（Lv 40）後解鎖。' : ''}奧義固定攜帶，不佔技能欄；發動需要 5 靈能，每場戰鬥限用一次。</span>
                ) : focus.lockedLv ? (
                  <span className="note">Lv {focus.lockedLv} 時習得。</span>
                ) : focus.equipped ? (
                  <button className="btn ghost" onClick={() => unequip(focus.id)}>卸下</button>
                ) : full ? (
                  <span className="note">點選上方技能欄中要替換的技能，或直接把技能卡拖上去。</span>
                ) : (
                  <button className="btn gold" onClick={() => equip(focus.id)}>放入技能欄</button>
                )}
              </div>
            </>
          ) : (
            <div className="note">點選技能查看說明。</div>
          )}
        </div>
      </div>
    </div>
  );
}
