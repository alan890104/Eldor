// Arena, Codex, settings.

import { useEffect, useState } from 'react';
import { HubScene, ShowcaseScene } from '../../render/scenes.ts';
import { getSkill, getSpirit, hasSkill, SPIRITS } from '../../data.ts';
import { computeStats, STAT_KEYS, STAT_LABEL } from '../../../sim/formulas.ts';
import { music } from '../../audio/music.ts';
import { sfx, synth } from '../../audio/sfx.ts';
import { ARENA, COST } from '../../game/arena.ts';
import { clearSave, partySpirits } from '../../game/save.ts';
import { QUESTS, questState, type Quest } from '../../game/quests.ts';
import { applyReward } from '../../game/progression.ts';
import type { Reward } from '../../game/campaign.ts';
import { ElementChip, RarityTag } from '../common.tsx';
import { store, useStore } from '../store.ts';
import { applyQuality, getStage, Modal, Thumb, TopBar, useScene } from '../widgets.tsx';
import { SkillInfo } from '../SkillInfo.tsx';
import { RichText } from '../glossary.tsx';
import { Icon } from '../icons.tsx';
import { ItemAmount, RewardRow } from '../items.tsx';
import { KitBlurb, learnLadder, SigMark } from '../KitInfo.tsx';
import { playArena } from '../flows.ts';
import { frameBetweenPanels } from './Team.tsx';
import { CloudSection } from './Cloud.tsx';
import { CLOUD_ON, cloudState, deleteCloudSave, unlink } from '../../game/cloud.ts';

export function ArenaScreen() {
  const { save } = useStore();
  useScene((s) => new ShowcaseScene(s, 0, 'arena'), []);
  useEffect(() => music.play('map'), []);
  return (
    <div className="screen uiz">
      <TopBar title="星門競技場" back={() => store.go({ name: 'hub' })} />
      <div className="arena-panel panel">
        <div className="note gsep"><span>3 隻出戰</span><span>費用上限 12</span><span>全員 Lv 60</span></div>
        <div className="arena-list">
          {ARENA.map((f, i) => {
            const locked = i > save.arena.best;
            const beaten = i < save.arena.best;
            return (
              <button key={i} className={`arena-row ${locked ? 'locked' : ''} ${beaten ? 'done' : ''}`} onClick={() => {
                if (locked) {
                  sfx.error();
                  store.showToast('先打贏上一階的對手');
                  return;
                }
                sfx.confirm();
                playArena(i);
              }}>
                <span className="ar-rank">{i + 1}</span>
                <span className="ar-info">
                  <b>{f.name}</b>
                  <small>{f.title}</small>
                </span>
                <span className="ar-team">
                  {f.team.map((id) => (
                    <Thumb key={id} speciesId={id} stage={3} size={44} silhouette={locked && !save.dex[id]} />
                  ))}
                </span>
                <span className="ar-rw">{beaten ? <Icon name="check" size={18} /> : locked ? <Icon name="lock" size={15} /> : <ItemAmount id="crystals" amount={f.reward.crystals} plus />}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DexScreen() {
  const { save } = useStore();
  const [sel, setSel] = useState<string>(SPIRITS[0].id);
  const [skillInfo, setSkillInfo] = useState<string | null>(null);
  const scene = useScene((s) => new ShowcaseScene(s, 1, 'hub'), []);
  useEffect(() => music.play('hub'), []);
  const state = save.dex[sel];
  useEffect(() => {
    if (!scene) return;
    frameBetweenPanels(scene);
    // A spirit not yet met is shown only as a silhouette (not the corrupted look)
    scene.show(0, sel, 3, true, false, !state);
  }, [scene, sel, state]);
  const sp = getSpirit(sel);
  const owned = Object.values(save.dex).filter((v) => v === 'owned').length;
  const seen = Object.keys(save.dex).length;
  const order = ['SSR', 'SR', 'R', 'N'];
  const list = [...SPIRITS].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
  const stats = computeStats(sp.base, 60, 3);
  const ladder = learnLadder(sp);
  const skillChip = (id: string) => {
    const sk = getSkill(id);
    return (
      <button key={id} className={`dex-skill ${sk.category} ${sk.tags.sig ? 'sig' : ''} ${skillInfo === id ? 'on' : ''}`} onClick={() => { sfx.click(); setSkillInfo(skillInfo === id ? null : id); }}>
        <Icon name={sk.category} size={11} /> {sk.name}
        {sk.tags.sig ? <SigMark /> : null}
      </button>
    );
  };
  return (
    <div className="screen uiz team-screen">
      <TopBar title={`圖鑑 ${owned}/${SPIRITS.length}`} back={() => store.go({ name: 'hub' })} />
      <div className="team-list dex-list">
        {list.map((s) => {
          const st = save.dex[s.id];
          return (
            <button key={s.id} className={`dex-item r-${s.rarity}-b ${sel === s.id ? 'sel' : ''}`} onClick={() => { sfx.click(); setSel(s.id); setSkillInfo(null); }}>
              <Thumb speciesId={s.id} stage={3} size={64} silhouette={!st} />
              <span>{st ? s.name : '？？？'}</span>
              {st === 'owned' && <span className="owned"><Icon name="check" size={10} /></span>}
            </button>
          );
        })}
      </div>
      <div className="team-detail panel">
        {state ? (
          <>
            <div className="td-name">{sp.name}</div>
            <div className="td-meta">
              <RarityTag r={sp.rarity} /> {sp.elements.map((e) => <ElementChip key={e} el={e} />)} <span>{sp.role}</span> <span>費用 {COST[sp.rarity]}</span>
            </div>
            <div className="lore">{sp.lore}</div>
            <div className="trait"><b>特性【{sp.trait.name}】</b> <RichText text={sp.trait.text} /></div>
            <div className="stat-grid">
              {STAT_KEYS.map((k) => (
                <div key={k} className="stat">
                  <span className="sn">{STAT_LABEL[k]}</span>
                  <div className="sbar"><div style={{ width: `${Math.min(100, (sp.base[k] / 140) * 100)}%` }} /></div>
                  <span className="sv">{stats[k]}</span>
                </div>
              ))}
            </div>
            <KitBlurb sp={sp} />
            <div className="dex-ladder">
              <div className="dl-title">技能表 <small>共 {ladder.reduce((n, r) => n + r.ids.length, 0)} 個・依等級習得</small></div>
              {ladder.map((r) => (
                <div key={r.lv} className="dl-rung">
                  <span className="dl-lv">Lv {r.lv}</span>
                  <span className="dl-skills">
                    {r.ids.map((id) => skillChip(id))}
                  </span>
                </div>
              ))}
              {hasSkill(sp.ultimate) && (
                <div className="dl-rung ult">
                  <span className="dl-lv">階段 III</span>
                  <span className="dl-skills">{skillChip(sp.ultimate)}</span>
                </div>
              )}
            </div>
            {skillInfo && hasSkill(skillInfo) && <div className="lo-info"><SkillInfo id={skillInfo} /></div>}
            <div className="note">取得方式：{sp.obtain}</div>
          </>
        ) : (
          <div className="unknown">尚未遇見此精靈。<br />可於冒險探索中遭遇，或透過星門召喚取得。</div>
        )}
      </div>
    </div>
  );
}

const REWARD_LABEL: [keyof Reward, string][] = [
  ['gold', '金幣'],
  ['crystals', '星輝石'],
  ['tickets', '契約券'],
  ['breakStones', '突破石'],
  ['shards', '源晶碎片'],
  ['potions', '經驗藥水'],
  ['stones', '契約石'],
  ['advStones', '高級契約石'],
  ['masterStones', '大師契約石'],
];

export function rewardText(r: Reward): string {
  return REWARD_LABEL.filter(([k]) => (r[k] ?? 0) > 0)
    .map(([k, t]) => `${t} ×${(r[k] ?? 0).toLocaleString()}`)
    .join('　');
}

export function QuestScreen() {
  const { save } = useStore();
  const party = partySpirits(save);
  const key = party.map((p) => `${p.speciesId}${p.stage}`).join();
  useScene((s) => new HubScene(s, party.map((p) => ({ speciesId: p.speciesId, stage: p.stage }))), [key]);
  useEffect(() => music.play('hub'), []);
  const claim = (q: Quest) => {
    const st = questState(save, q);
    if (!st.done || st.claimed) return;
    sfx.levelUp();
    store.mutate((d) => {
      applyReward(d, q.reward);
      d.claimed.push(q.id);
    });
    store.showToast(`領取「${q.name}」：${rewardText(q.reward)}`);
  };
  const groups = ['冒險', '收集', '培養', '競技'] as const;
  const rank = (q: Quest) => {
    const st = questState(save, q);
    return st.done && !st.claimed ? 0 : st.claimed ? 2 : 1;
  };
  return (
    <div className="screen uiz">
      <TopBar title="任務" back={() => store.go({ name: 'hub' })} />
      <div className="quest-panel panel">
        {groups.map((g) => (
          <div key={g} className="quest-group">
            <div className="qg-title">{g}</div>
            {QUESTS.filter((q) => q.group === g)
              .sort((a, b) => rank(a) - rank(b))
              .map((q) => {
                const st = questState(save, q);
                return (
                  <div key={q.id} className={`quest ${st.claimed ? 'claimed' : st.done ? 'ready' : ''}`}>
                    <div className="q-main">
                      {/* A claimed quest gets a check mark; a claimable row already has a gold frame and a gold button, so no star is added */}
                      <div className="q-name">{st.claimed && <Icon name="check" size={14} />}{q.name}</div>
                      <div className="q-desc">{q.desc}</div>
                      <div className="q-bar"><div style={{ width: `${(st.value / q.target) * 100}%` }} /><span>{st.value} / {q.target}</span></div>
                    </div>
                    <div className="q-side">
                      <div className="q-reward"><RewardRow reward={q.reward} /></div>
                      <button className={`btn small ${st.done && !st.claimed ? 'gold' : 'ghost'}`} disabled={!st.done || st.claimed} onClick={() => claim(q)}>
                        {st.claimed ? '已領取' : st.done ? '領取' : '進行中'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { save } = useStore();
  const [reset, setReset] = useState(false);
  const [alsoCloud, setAlsoCloud] = useState(false);
  useScene((s) => new ShowcaseScene(s, 0, 'hub'), []);
  const deleteAll = async () => {
    if (alsoCloud && cloudState().enabled) {
      try {
        await deleteCloudSave();
      } catch {
        store.showToast('雲端備份刪除失敗，只刪除了本機進度');
      }
      unlink();
    }
    clearSave();
    store.reset();
    store.hasSave = false;
    store.go({ name: 'title' });
  };
  const set = (fn: (d: typeof save) => void) => {
    store.mutate(fn);
    synth.volume.sfx = store.save.settings.sfx;
    synth.volume.music = store.save.settings.music;
    synth.setVolumes();
  };
  const setQuality = (q: 'auto' | 'high' | 'low') => {
    sfx.click();
    store.mutate((d) => {
      d.settings.quality = q;
      d.settings.lowfx = q === 'low';
    });
    applyQuality(getStage(), q);
  };
  const quality = save.settings.lowfx ? 'low' : save.settings.quality;
  return (
    <div className="screen uiz">
      <TopBar title="設定" back={() => store.go({ name: 'hub' })} />
      <div className="settings panel">
        <label>
          音效音量 <input type="range" min={0} max={1} step={0.05} value={save.settings.sfx} onChange={(e) => set((d) => (d.settings.sfx = +e.target.value))} />
        </label>
        <label>
          音樂音量 <input type="range" min={0} max={1} step={0.05} value={save.settings.music} onChange={(e) => set((d) => (d.settings.music = +e.target.value))} />
        </label>
        <label>
          戰鬥速度
          <span className="seg">
            {[1, 2].map((v) => (
              <button key={v} className={save.settings.speed === v ? 'on' : ''} onClick={() => set((d) => (d.settings.speed = v))}>{v}×</button>
            ))}
          </span>
        </label>
        <label>
          畫質
          <span className="seg">
            {([['auto', '自動'], ['high', '高畫質'], ['low', '省電']] as const).map(([v, t]) => (
              <button key={v} className={quality === v ? 'on' : ''} onClick={() => setQuality(v)}>{t}</button>
            ))}
          </span>
        </label>
        {CLOUD_ON && <CloudSection />}
        <div className="settings-foot">
          <span>締約者：{save.playerName}</span>
          <button className="btn small ghost" onClick={() => setReset(true)}>刪除存檔</button>
        </div>
      </div>
      {reset && (
        <Modal onClose={() => setReset(false)}>
          <h3>刪除存檔？</h3>
          <p>所有精靈與進度都會消失，無法復原。</p>
          {cloudState().enabled && (
            <label className="cloud-check">
              <input type="checkbox" checked={alsoCloud} onChange={(e) => setAlsoCloud(e.target.checked)} /> 同時刪除雲端備份（不勾的話，下次開啟會從雲端載回進度）
            </label>
          )}
          <div className="row">
            <button className="btn ghost small" onClick={() => setReset(false)}>取消</button>
            <button className="btn small" onClick={() => void deleteAll()}>刪除</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
