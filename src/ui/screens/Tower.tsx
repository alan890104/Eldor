// Tower: a region's main-story stages. Clear it floor by floor from the bottom up; the top floor is the Source Crystal Trial. Clearing everything leads on to the next region.

import { useEffect, useState } from 'react';
import { music } from '../../audio/music.ts';
import { sfx } from '../../audio/sfx.ts';
import { stageForLevel } from '../../data.ts';
import { REGIONS, TOWER_LORE, isStageUnlocked, nextFloor, towerProgress } from '../../game/campaign.ts';
import { stageTeam } from '../../game/opening.ts';
import { partyLevel } from '../../game/advice.ts';
import { ShowcaseScene } from '../../render/scenes.ts';
import { playStage } from '../flows.ts';
import { RewardRow } from '../items.tsx';
import { ElementChip } from '../common.tsx';
import { Icon } from '../icons.tsx';
import { store, useStore } from '../store.ts';
import { Dialogue, Thumb, TopBar, useScene } from '../widgets.tsx';
import { uiZoom } from '../uiScale.ts';

const KIND: Record<string, string> = { corrupt: '蝕化', trainer: '對戰', cult: '教團', rival: '勁敵', boss: '源晶試煉', wild: '野生' };

export function TowerScreen({ idx }: { idx: number }) {
  const { save } = useStore();
  const r = REGIONS[idx];
  const floors = r.stages;
  const done = towerProgress(save.cleared, idx);
  const next = nextFloor(save.cleared, idx);
  const [sel, setSel] = useState(next >= 0 ? next : floors.length - 1);
  const st = floors[sel];
  const foes = stageTeam(st, save.starter);
  const lead = foes[foes.length - 1];
  const scene = useScene((s) => new ShowcaseScene(s, 1, r.id), [r.id]);
  useEffect(() => music.play(`tower:${r.id}`), [r.id]);
  useEffect(() => {
    if (!scene || !lead) return;
    scene.show(0, lead.speciesId, stageForLevel(lead.level), true, !!lead.corrupted);
  }, [scene, sel, lead?.speciesId]);
  // The panel is on the left and the guardian spirit stands in the free space on the right; in portrait the panel fills the width
  useEffect(() => {
    if (!scene) return;
    const place = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscape = w > h;
      scene.setShowcaseVisible(landscape);
      if (landscape) scene.frameAt((uiZoom() * (12 + Math.min(760, w * 0.58)) + w) / 2);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [scene]);

  const plv = partyLevel(save);
  const unlocked = isStageUnlocked(save.cleared, idx, sel);
  const cleared = !!save.cleared[st.id];
  const allDone = done >= floors.length;
  const nextRegion = REGIONS[idx + 1];
  const back = () => store.go({ name: 'region', idx });
  // First time in the tower: Mila explains the tower and the Source Crystal
  const [lore, setLore] = useState(() => !save.seenStory.includes('lore-tower'));

  return (
    <div className="screen uiz twr">
      <TopBar title={r.tower} back={back} />
      <div className="twr-panel panel">
        <div className="twr-head">
          {r.element && <ElementChip el={r.element} big />}
          <div className="twr-title">
            <b>{r.tower}</b>
            <small className="gsep"><span>{r.name}</span><span>已突破 {done} / {floors.length} 層</span></small>
          </div>
        </div>
        <div className="twr-bar"><i style={{ width: `${(done / floors.length) * 100}%` }} /></div>
        {allDone && (
          <div className="twr-clear">
            <b>伏魔塔已淨化</b>
            <span>{r.id === 'rift' ? '裂隙已經閉合。' : nextRegion ? `源晶到手！下一站：${nextRegion.name}` : ''}</span>
            {nextRegion && r.id !== 'rift' && <button className="btn small gold" onClick={() => { sfx.confirm(); store.go({ name: 'map' }); }}>前往世界地圖</button>}
          </div>
        )}
        <div className="twr-body">
          <div className="twr-floors">
            {[...floors].map((f, i) => ({ f, i })).reverse().map(({ f, i }) => {
              const ok = isStageUnlocked(save.cleared, idx, i);
              const cl = !!save.cleared[f.id];
              const cur = i === next;
              return (
                <button
                  key={f.id}
                  className={`twr-floor k-${f.kind} ${ok ? '' : 'locked'} ${cl ? 'done' : ''} ${cur ? 'cur' : ''} ${i === sel ? 'sel' : ''}`}
                  onClick={() => {
                    sfx.click();
                    setSel(i);
                  }}
                >
                  <span className="tf-no">{i === floors.length - 1 ? '頂' : `${i + 1}F`}</span>
                  <span className="tf-kind">{KIND[f.kind]}</span>
                  <span className="tf-name">{ok ? f.name : '？？？'}</span>
                  <span className={`tf-lv ${ok && !cl && f.level > plv + 1 ? 'hard' : ''}`}>Lv {f.level}</span>
                  <span className="tf-st">{cl ? <Icon name="check" size={14} /> : cur ? '▶' : ok ? '' : <Icon name="lock" size={13} />}</span>
                </button>
              );
            })}
          </div>
          <div className="twr-detail">
            <div className="td-head">
              <span className={`tf-kind k-${st.kind}`}>{KIND[st.kind]}</span>
              <b>{sel === floors.length - 1 ? '頂層' : `第 ${sel + 1} 層`}・{unlocked ? st.name : '？？？'}</b>
            </div>
            <div className="td-foe">{unlocked ? st.enemyName : '突破下面的樓層才能看到'}</div>
            <div className="td-team">
              {foes.map((t, i) => (
                <div key={i} className={`td-mon ${t.corrupted ? 'corrupt' : ''}`}>
                  <Thumb speciesId={t.speciesId} stage={stageForLevel(t.level)} size={58} silhouette={!unlocked} />
                  <i>Lv {t.level}</i>
                </div>
              ))}
            </div>
            {unlocked && st.level > plv + 1 && !cleared && <div className="td-warn">⚠ 對手等級高於隊伍平均（Lv {plv}），建議先到野外練等</div>}
            <div className="td-reward">
              <small>{cleared ? '再次挑戰的獎勵' : '首次突破獎勵'}</small>
              <RewardRow reward={cleared ? { gold: Math.floor(st.reward.gold * 0.4) } : st.reward} />
            </div>
            <div className="td-actions">
              <button
                className="btn gold"
                disabled={!unlocked}
                onClick={() => {
                  sfx.confirm();
                  playStage(idx, sel);
                }}
              >
                {cleared ? '再次挑戰' : '挑戰'}
              </button>
              <button className="btn ghost small" onClick={() => { sfx.click(); back(); }}>離開伏魔塔</button>
            </div>
          </div>
        </div>
      </div>
      {lore && (
        <Dialogue
          lines={TOWER_LORE}
          onDone={() => {
            store.mutate((d) => d.seenStory.push('lore-tower'));
            setLore(false);
          }}
        />
      )}
    </div>
  );
}
