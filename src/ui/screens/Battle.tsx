// Battle screen and results screen.

import { useEffect, useRef, useState } from 'react';
import { BattleController, type BattleResult, type BattleSetup } from '../../battle/controller.ts';
import { BattleHUD } from '../battle/BattleHUD.tsx';
import { ShowcaseScene } from '../../render/scenes.ts';
import { getSpirit, hasSkill } from '../../data.ts';
import { music } from '../../audio/music.ts';
import { sfx } from '../../audio/sfx.ts';
import { expToNext } from '../../../sim/formulas.ts';
import { store, useStore, type ResultInfo } from '../store.ts';
import { getStage, Thumb, useScene } from '../widgets.tsx';
import { ElementChip, RarityTag } from '../common.tsx';
import { ItemIcon, ITEMS, rewardItems, showItemInfo } from '../items.tsx';
import { Icon } from '../icons.tsx';
import { showPop } from '../glossary.tsx';
import type { LevelGain } from '../../game/progression.ts';
import { AdviceList } from '../Advice.tsx';
import { getAdvice } from '../../game/advice.ts';
import { LearnedCards } from '../KitInfo.tsx';
import { LoadoutEditor } from './Loadout.tsx';

export function BattleScreen({ setup, onEnd, tutorial }: { setup: BattleSetup; onEnd: (r: BattleResult) => void; tutorial?: boolean }) {
  const [ctl, setCtl] = useState<BattleController | null>(null);
  const [ended, setEnded] = useState<BattleResult | null>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    const c = new BattleController(getStage(), setup);
    c.setSpeed(store.save.settings.speed);
    if (!tutorial) c.setAuto(store.save.settings.auto);
    c.onEnd = (r) => {
      music.sting(r.winner === 1 ? 'defeat' : 'victory');
      setEnded(r);
      setTimeout(() => endRef.current(r), 2200);
    };
    setCtl(c);
    (window as unknown as { __ctl: BattleController }).__ctl = c;
    music.play(setup.music ?? (setup.boss ? 'boss' : setup.kind === 'arena' ? 'arena' : `wild:${setup.region}`));
    void c.start();
    return () => c.dispose();
  }, [setup]);
  return (
    <div className="screen battle-screen">
      {ctl && <BattleHUD ctl={ctl} tips={!tutorial} tutorial={tutorial} />}
      {ended && (
        <div className={`battle-end ${ended.winner === 0 ? 'win' : 'lose'}`}>
          <div className="be-text">{ended.captured ? '契約成立' : ended.winner === 0 ? '勝利' : ended.winner === 'draw' ? '平手' : '戰敗'}</div>
        </div>
      )}
    </div>
  );
}

/** Results screen: the spirit is shown on the left, and the large panel on the right lists EXP, rewards and suggestions. */
export function ResultScreen({ info }: { info: ResultInfo }) {
  const { save } = useStore();
  const win = info.result.winner === 0;
  const leadId = info.captured?.speciesId ?? save.spirits.find((s) => s.uid === (info.gains[0]?.uid ?? save.party[0]))?.speciesId;
  const scene = useScene((st) => {
    const sc = new ShowcaseScene(st, 1, 'hub');
    if (leadId) {
      const inst = save.spirits.find((x) => x.speciesId === leadId);
      sc.show(0, leadId, inst?.stage ?? 1);
      if (win) setTimeout(() => sc.cheer(0), 600);
    }
    return sc;
  }, []);
  // The spirit stands in the empty space to the left of the results panel
  useEffect(() => {
    if (!scene) return;
    const place = () => scene.frameAt(window.innerWidth * 0.18);
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [scene]);
  useEffect(() => {
    music.play('hub');
  }, []);
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const k = Math.min(1, (performance.now() - t0) / 1600);
      setAnim(k);
      if (k < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const lvUps = info.gains.filter((g) => g.after > g.before).length;
    if (lvUps) setTimeout(() => sfx.levelUp(), 900);
    return () => cancelAnimationFrame(raf);
  }, []);
  // When leveling up teaches a new skill but the skill slots are full, open the loadout right there (closing it returns to the results screen)
  const [edit, setEdit] = useState<{ uid: string; focusId?: string } | null>(null);
  const rewards = info.reward ? rewardItems(info.reward) : [];
  const advice = win ? [] : getAdvice(save, info.advice);
  const gains = info.gains.length > 0 && (
    <section className="rs-sec">
      <h3 className="rs-h">經驗值</h3>
      <div className={`rs-gains ${win ? '' : 'compact'}`}>
        {info.gains.map((g) => (
          <GainCard key={g.uid} g={g} anim={anim} onEdit={(uid, focusId) => setEdit({ uid, focusId })} />
        ))}
      </div>
    </section>
  );
  return (
    <div className={`screen result-screen ${win ? 'win' : 'lose'}`}>
      <div className="rs-main panel">
        <header className="rs-head">
          <div className={`result-title ${win ? 'win' : 'lose'}`}>{info.title}</div>
          <div className="rs-sub">
            {info.subtitle && <span>{info.subtitle}</span>}
            {info.result.turns > 0 && <span>{info.result.turns} 回合</span>}
            {info.firstClear && <span className="rs-first">首次通關</span>}
          </div>
        </header>
        <div className="rs-scroll">
          {info.captured && <CapturedCard c={info.captured} />}
          {!win && advice.length > 0 && (
            <section className="rs-sec">
              <AdviceList items={advice} max={4} layout="grid" />
            </section>
          )}
          {gains}
          {rewards.length > 0 && (
            <section className="rs-sec">
              <h3 className="rs-h">獲得獎勵</h3>
              <div className="rs-rewards">
                {rewards.map((x) => (
                  <button
                    key={x.id}
                    className="rs-reward"
                    style={{ ['--ic' as string]: ITEMS[x.id].color }}
                    onMouseEnter={(e) => showItemInfo(x.id, undefined, e.currentTarget)}
                    onMouseLeave={() => showPop(null)}
                    onClick={(e) => { e.stopPropagation(); showItemInfo(x.id, undefined, e.currentTarget); }}
                  >
                    <ItemIcon id={x.id} size={44} />
                    <span className="rr-n">+{x.n.toLocaleString()}</span>
                    <span className="rr-name">{ITEMS[x.id].name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
        <footer className="rs-foot">
          <button className="btn gold rs-next" onClick={() => { sfx.confirm(); showPop(null); info.next(); }}>
            繼續
          </button>
        </footer>
      </div>
      {edit && (
        <div className="lo-modal bag-screen l-wide">
          <LoadoutEditor
            uid={edit.uid}
            focusId={edit.focusId}
            onSwitch={(uid) => setEdit({ uid })}
            onDone={() => { sfx.click(); showPop(null); setEdit(null); }}
          />
        </div>
      )}
    </div>
  );
}

function GainCard({ g, anim, onEdit }: { g: LevelGain; anim: number; onEdit?: (uid: string, focusId?: string) => void }) {
  const { save } = useStore();
  const s = save.spirits.find((x) => x.uid === g.uid);
  if (!s) return null;
  // Skill data may have changed since the save: list only the skills that still exist
  const learned = g.newSkills.filter(hasSkill);
  /** Skills learned but not placed because the skill slots are full */
  const waiting = learned.some((id) => !s.loadout.includes(id)) && s.loadout.length >= 4;
  const sp = getSpirit(s.speciesId);
  const up = g.after > g.before;
  const lvShown = Math.round(g.before + (g.after - g.before) * Math.min(1, anim * 1.2));
  const need = expToNext(s.level);
  const [title, given] = sp.name.includes('・') ? sp.name.split('・', 2) : ['', sp.name];
  const maxed = s.level >= 60;
  const pct = maxed ? 1 : anim < 1 ? anim : s.exp / need;
  const done = anim >= 1;
  return (
    <div className={`rs-gain ${up ? 'up' : ''}`}>
      <Thumb speciesId={s.speciesId} stage={s.stage} size={84} />
      <div className="rg-id">
        {/* Title and name on two lines: small title on top, large name below, so a narrow card does not have to cut the name down to one character and an ellipsis */}
        {title && <span className="rg-title">{title}</span>}
        <b className="rg-name">{given}</b>
        <span className="rg-lv">
          Lv <b>{lvShown}</b>
          {up && anim > 0.6 && <span className="rg-up">LEVEL UP</span>}
        </span>
      </div>
      <div className="rg-bar">
        <div className="expbar big"><div className="expfill" style={{ width: `${pct * 100}%` }} /></div>
        <div className="rg-exp">
          <b>+{g.exp.toLocaleString()} EXP</b>
          <span>{maxed ? '已達最高等級' : g.capped ? `已達等級上限 Lv ${s.level}` : `距離下一級 ${(need - s.exp).toLocaleString()}`}</span>
        </div>
      </div>
      {done && (up || learned.length > 0 || g.capped) && (
        <div className="rg-notes">
          {up && <span className="rg-note up"><Icon name="up" size={13} /> Lv {g.before}<i className="chev" />{g.after}</span>}
          {learned.length > 0 && <LearnedCards ids={learned} equipped={s.loadout} />}
          {waiting && onEdit && (
            <button className="btn small gold rg-edit" onClick={() => { sfx.click(); showPop(null); onEdit(s.uid, learned.find((id) => !s.loadout.includes(id))); }}>
              <Icon name="swap" size={14} /> 技能欄已滿，配置技能
            </button>
          )}
          {g.capped && <span className="rg-note warn"><Icon name="up" size={13} /> 需突破才能繼續獲得經驗</span>}
        </div>
      )}
    </div>
  );
}

function CapturedCard({ c }: { c: NonNullable<ResultInfo['captured']> }) {
  const { save } = useStore();
  const sp = getSpirit(c.speciesId);
  const inst = save.spirits.find((s) => s.speciesId === c.speciesId);
  const head = c.kind === 'new' ? '新夥伴加入！' : c.kind === 'resonance' ? '同源共鳴！' : '轉為星塵';
  const text =
    c.kind === 'new'
      ? '已加入背包的倉庫，可在背包中編入出戰隊伍。'
      : c.kind === 'resonance'
        ? `已擁有同種精靈，共鳴提升至 R${inst?.resonance ?? 1}，全能力上升。`
        : '該精靈共鳴已達上限，轉換為星塵。星塵可在背包兌換契約券。';
  return (
    <section className="rs-captured">
      <Thumb speciesId={c.speciesId} stage={inst?.stage ?? 1} size={104} />
      <div className="rc-body">
        <div className="rc-head">{head}</div>
        <div className="rc-name">
          {sp.name} <RarityTag r={sp.rarity} />
          {sp.elements.map((e) => <ElementChip key={e} el={e} />)}
          <span className="rc-lv">Lv {c.level}</span>
        </div>
        <p>{text}</p>
      </div>
    </section>
  );
}
