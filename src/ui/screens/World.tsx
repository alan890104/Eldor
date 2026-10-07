// Hub town, world map, region stages, battle party.

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { HubScene, MapScene, ShowcaseScene, type MapIsland } from '../../render/scenes.ts';
import { getSpirit, SPIRITS } from '../../data.ts';
import { typeMultiplier } from '../../../sim/formulas.ts';
import { music } from '../../audio/music.ts';
import { sfx } from '../../audio/sfx.ts';
import { REGIONS, isRegionUnlocked, towerProgress } from '../../game/campaign.ts';
import { partySpirits } from '../../game/save.ts';
import { canBreakthrough, hasBreakthroughMaterials } from '../../game/progression.ts';
import { pullsAvailable } from '../../game/gachaGame.ts';
import { claimable, QUESTS } from '../../game/quests.ts';
import { getAdvice } from '../../game/advice.ts';
import { AdviceList, runAdvice } from '../Advice.tsx';
import { Icon } from '../icons.tsx';
import { COST, COST_CAP, teamCost } from '../../game/arena.ts';
import { ART_DESC, ART_NAME } from '../../battle/director.ts';
import type { ArtId } from '../../engine/types.ts';
import { ElementChip } from '../common.tsx';
import { store, useStore, type FoePreview } from '../store.ts';
import { TopBar, useScene, Thumb } from '../widgets.tsx';
import { currentObjective } from '../flows.ts';
import { COARSE, usePartyDrag } from '../partyDrag.ts';
import { MenuIcon } from '../menuIcons.tsx';
import { uiZoom } from '../uiScale.ts';

export function HubScreen() {
  const { save } = useStore();
  const party = partySpirits(save);
  const key = party.map((p) => `${p.speciesId}${p.stage}`).join();
  useScene((s) => {
    const sc = new HubScene(s, party.map((p) => ({ speciesId: p.speciesId, stage: p.stage })));
    sc.besideMenu();
    return sc;
  }, [key]);
  useEffect(() => music.play('hub'), []);
  const capped = save.spirits.filter(canBreakthrough);
  const ready = capped.filter((s) => hasBreakthroughMaterials(save, s)).length;
  const bagSub = ready > 0 ? [`${ready} 隻可以突破`] : capped.length > 0 ? [`${capped.length} 隻待突破`, '素材不足'] : [`精靈 ${save.spirits.length} 隻`, '道具'];
  const questsReady = claimable(save).length;
  // The sub-label segments are separated by a gold diamond (not joined with "·")
  const items: { id: Parameters<typeof store.go>[0]; label: string; sub: string[]; icon: string; hot?: boolean; next?: boolean }[] = [
    { id: { name: 'map' }, label: '冒險', sub: currentObjective(), icon: 'adventure', hot: Object.keys(save.cleared).length === 0, next: Object.keys(save.cleared).length === 0 },
    { id: { name: 'team' }, label: '背包', sub: bagSub, icon: 'bag', hot: ready > 0 },
    { id: { name: 'summon' }, label: '星門召喚', sub: [`契約券 ${save.inv.tickets}`, `星輝石 ${save.inv.crystals}`], icon: 'summon', hot: pullsAvailable(save) > 0 },
    { id: { name: 'arena' }, label: '競技場', sub: [`目前第 ${save.arena.best + 1} 階`], icon: 'arena' },
    { id: { name: 'dex' }, label: '圖鑑', sub: [`${Object.values(save.dex).filter((v) => v === 'owned').length} / ${SPIRITS.length}`], icon: 'dex' },
    { id: { name: 'quests' }, label: '任務', sub: [questsReady > 0 ? `${questsReady} 個獎勵可以領取！` : `${save.claimed.length} / ${QUESTS.length} 已完成`], icon: 'quests', hot: questsReady > 0 },
  ];
  return (
    <div className="screen uiz">
      <TopBar title="星門城" settings />
      <div className="hub-menu">
        {items.map((it) => (
          <button key={it.label} data-tour={it.label} className={`hub-btn ${it.hot ? 'hot' : ''}`} onClick={() => { sfx.click(); store.go(it.id); }}>
            {it.next && <span className="hb-next">從這裡開始</span>}
            <span className="hb-icon"><MenuIcon name={it.icon} /></span>
            <span className="hb-text">
              <b>{it.label}</b>
              <small className="gsep">{it.sub.map((x) => <span key={x}>{x}</span>)}</small>
            </span>
          </button>
        ))}
      </div>
      {save.seenStory.includes('tour-hub') && <HubAdvisor />}
      {!save.seenStory.includes('tour-hub') && save.spirits.length > 0 && <HubTour />}
    </div>
  );
}

/** The "Next step suggestion" at the top left of the hub town */
function HubAdvisor() {
  const { save } = useStore();
  const [open, setOpen] = useState(false);
  const items = getAdvice(save);
  if (items.length === 0) return null;
  const top = items[0];
  return (
    <div className={`hub-advisor panel ${open ? 'open' : ''}`}>
      <div className="ha-head">
        <span className="adv-ico"><Icon name={top.icon} size={15} /></span>
        <div className="adv-body">
          <small>下一步建議</small>
          <b>{top.title}</b>
        </div>
        <button className="btn small gold" onClick={() => runAdvice(top.action)}>{top.button}</button>
      </div>
      {open ? (
        <>
          <p className="ha-text">{top.text}</p>
          <AdviceList items={items.slice(1)} max={4} title="其他建議" />
        </>
      ) : null}
      <button className="ha-more gsep" onClick={() => { sfx.click(); setOpen(!open); }}>{open ? <span>收合</span> : <><span>詳細說明</span>{items.length > 1 && <span>其他 {items.length - 1} 項建議</span>}</>}</button>
    </div>
  );
}

const TOUR: { target: string; title: string; text: string }[] = [
  { target: '[data-tour="冒險"]', title: '冒險', text: '選一個地區進入野外自由探索：碰到野生精靈就能戰鬥與捕捉。地區盡頭的伏魔塔是主線關卡，突破頂層的源晶試煉就能前往下一個地區。' },
  { target: '[data-tour="背包"]', title: '背包', text: '設定出戰隊伍、查看能力、配置技能、突破精靈，以及查看與使用道具。' },
  { target: '[data-tour="星門召喚"]', title: '星門召喚', text: '消耗契約券或星輝石召喚新精靈。' },
  { target: '.topbar .res', title: '貨幣與說明書', text: '右上角為持有的貨幣，滑鼠停留或點選圖示可查看用途；「?」為說明書，可查詢所有規則與術語；齒輪為設定。' },
];

/** The tour on first entering the hub town: points out the main features in turn */
function HubTour() {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const t = TOUR[step];
  useEffect(() => {
    const el = document.querySelector(t.target) as HTMLElement | null;
    el?.classList.add('tour-focus');
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    measure();
    const id = window.setInterval(measure, 300);
    return () => {
      el?.classList.remove('tour-focus');
      window.clearInterval(id);
    };
  }, [step]);
  const done = () => store.mutate((d) => d.seenStory.push('tour-hub'));
  const next = () => {
    sfx.click();
    if (step + 1 >= TOUR.length) done();
    else setStep(step + 1);
  };
  const w = Math.min(300, window.innerWidth - 24);
  let left = 12;
  let top = 80;
  if (rect) {
    if (rect.left > window.innerWidth / 2 && rect.left - w - 14 > 12) {
      // The target is on the right half and there is room on the left: place it on the left
      left = rect.left - w - 14;
      top = Math.max(60, Math.min(window.innerHeight - 190, rect.top));
    } else {
      const below = rect.bottom + 150 < window.innerHeight;
      top = below ? rect.bottom + 12 : Math.max(60, rect.top - 150);
      left = Math.max(12, Math.min(window.innerWidth - w - 12, rect.left + rect.width / 2 - w / 2));
    }
  }
  return (
    <div className="tour-layer">
      <div className="tour-bubble panel" style={{ left, top, width: w }}>
        <div className="tour-step">{step + 1} / {TOUR.length}</div>
        <b>{t.title}</b>
        <p>{t.text}</p>
        <div className="tour-actions">
          <button className="btn small ghost" onClick={() => { sfx.click(); done(); }}>略過導覽</button>
          <button className="btn small gold" onClick={next}>{step + 1 >= TOUR.length ? '開始冒險' : '下一步'}</button>
        </div>
      </div>
    </div>
  );
}

export function MapScreen() {
  const { save } = useStore();
  const islands: MapIsland[] = useMemo(() => {
    const list: MapIsland[] = [{ id: 'hub', pos: new THREE.Vector3(0, 0, 1.5), element: null, locked: false, cleared: false }];
    let foundCurrent = false;
    REGIONS.forEach((r, i) => {
      const [x, z] = r.mapPos;
      const locked = !isRegionUnlocked(save.cleared, i);
      const cleared = r.stages.every((st) => save.cleared[st.id]);
      const current = !foundCurrent && !locked && !cleared;
      if (current) foundCurrent = true;
      list.push({
        id: r.id,
        pos: new THREE.Vector3(x, r.id === 'rift' ? 2.5 : r.id === 'holy' ? 1.2 : r.id === 'shadow' ? -1 : 0, z),
        element: r.element,
        locked,
        cleared,
        current,
      });
    });
    return list;
  }, [save.cleared]);
  const scene = useScene((s) => new MapScene(s, islands), [islands]);
  const [pos, setPos] = useState<{ id: string; x: number; y: number; align: string }[]>([]);
  useEffect(() => music.play('map'), []);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (scene) setPos(scene.screenPositions());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scene]);
  // The place-name plates scale with the UI scale (CSS zoom), so the projected coordinates must be divided by the scale first to land on the island
  const z = uiZoom();
  return (
    <div className="screen">
      <TopBar title="艾爾多大陸" back={() => store.go({ name: 'hub' })} />
      {pos.map((p) => {
        if (p.id === 'hub') {
          return (
            <button key={p.id} className="map-label hub" style={{ left: p.x / z, top: p.y / z }} onClick={() => store.go({ name: 'hub' })}>
              星門城
            </button>
          );
        }
        const idx = REGIONS.findIndex((r) => r.id === p.id);
        const r = REGIONS[idx];
        const locked = !isRegionUnlocked(save.cleared, idx);
        const done = towerProgress(save.cleared, idx);
        const current = islands.find((i) => i.id === p.id)?.current;
        return (
          <button
            key={p.id}
            className={`map-label al-${p.align} ${locked ? 'locked' : ''} ${done === r.stages.length ? 'done' : ''} ${current ? 'next' : ''}`}
            style={{ left: p.x / z, top: p.y / z }}
            onClick={() => {
              if (locked) {
                sfx.error();
                store.showToast('先突破上一個地區的伏魔塔');
                return;
              }
              sfx.confirm();
              store.go({ name: 'region', idx });
            }}
          >
            <span className="ml-name">
              {r.element && <ElementChip el={r.element} />} {r.name}
            </span>
            {/* Status is shown with graphics: a lock when locked; otherwise the suggested level + one gem per Seal Tower floor (lit once cleared), and when everything is purified a "Purified" badge hangs on the corner */}
            {locked ? (
              <span className="ml-sub ml-locked"><Icon name="lock" size={11} />未解鎖</span>
            ) : (
              <span className="ml-sub" title={`伏魔塔 ${done} / ${r.stages.length} 層`}>
                <span className="ml-lv">Lv {r.level}+</span>
                <span className={`ml-pips ${done === r.stages.length ? 'full' : ''}`}>
                  {r.stages.map((st, k) => <i key={st.id} className={k < done ? 'on' : ''} />)}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PartyScreen({ purpose, onGo, back, cap, foes, foeTitle }: { purpose: string; onGo: () => void; back: () => void; cap?: number; foes?: FoePreview[]; foeTitle?: string }) {
  const { save } = useStore();
  const [sel, setSel] = useState<string[]>(() => save.party.filter((u) => save.spirits.some((s) => s.uid === u)));
  const [showArt, setShowArt] = useState(false);
  const arena = purpose === 'arena';
  const lead = save.spirits.find((s) => s.uid === sel[0]) ?? save.spirits[0];
  const scene = useScene((s) => {
    const sc = new ShowcaseScene(s, 1, arena ? 'arena' : 'hub');
    if (lead) sc.show(0, lead.speciesId, arena ? 3 : lead.stage, false);
    return sc;
  }, [lead?.uid, purpose]);
  // The party panel is on the left and the lead spirit stands in the free space on the right; in portrait the panel fills the screen
  useEffect(() => {
    if (!scene) return;
    const place = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscape = w > h;
      scene.setShowcaseVisible(landscape);
      if (!landscape) return;
      // Matches .party-panel in the CSS: on desktop the width is min(820px, 62vw) and scales with --uz; on a phone it is 64% wide, with the depart button at the bottom right, so the spirit is pulled back and raised
      const phone = h <= 560;
      const edge = phone ? 8 + w * 0.64 : uiZoom() * (12 + Math.min(820, w * 0.62));
      scene.frameAt((edge + w) / 2, phone ? 0.6 : 0, phone ? 0.8 : 1);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [scene]);
  const cost = teamCost(sel.map((u) => save.spirits.find((s) => s.uid === u)!.speciesId));
  const over = cap !== undefined && cost > cap;
  const remove = (uid: string) => {
    sfx.click();
    setSel((cur) => cur.filter((x) => x !== uid));
  };
  const add = (uid: string) => {
    if (sel.length >= 3) {
      sfx.error();
      store.showToast('出戰隊伍已滿 3 隻：點選上方的精靈移出，或把精靈拖到隊伍中互換');
      return;
    }
    sfx.click();
    setSel((cur) => [...cur, uid]);
  };
  const rest = save.spirits.filter((s) => !sel.includes(s.uid)).sort((a, b) => b.level - a.level);
  const dnd = usePartyDrag({
    party: sel,
    commit: (next) => setSel(next),
    onTap: (uid) => (sel.includes(uid) ? remove(uid) : add(uid)),
  });
  const foeEls = [...new Set((foes ?? []).flatMap((f) => getSpirit(f.speciesId).elements))].filter((e) => e !== 'neutral');
  const counters = (speciesId: string) => foeEls.length > 0 && getSpirit(speciesId).elements.some((el) => foeEls.some((f) => typeMultiplier(el, [f]) > 1));
  const selLv = sel.length ? Math.round(sel.reduce((a, u) => a + (save.spirits.find((x) => x.uid === u)?.level ?? 0), 0) / sel.length) : 0;
  const foeLv = foes && foes.length ? Math.max(...foes.map((f) => f.level)) : 0;
  const go = () => {
    if (sel.length === 0 || over) return;
    store.mutate((d) => (d.party = sel));
    onGo();
  };
  const stageOf = (s: { stage: 1 | 2 | 3 }) => (arena ? 3 : s.stage);
  return (
    <div className="screen uiz party-screen">
      <TopBar title={arena ? '競技場・選擇隊伍' : '選擇出戰隊伍'} back={back} />
      <div className={`party-panel panel ${dnd.dragging ? 'dnd-active' : ''}`} ref={dnd.rootRef}>
        {foes && foes.length > 0 && (
          <section className="pp-foes">
            <div className="sec-head">
              <b>對手</b>
              <span className="sec-hint">{foeTitle}</span>
            </div>
            <div className="pf-list">
              {foes.map((f, i) => {
                const sp = getSpirit(f.speciesId);
                const known = !!save.dex[f.speciesId];
                return (
                  <div key={i} className="pf-card" title={known ? `${sp.name}：${sp.trait.name}・${sp.trait.text}` : '尚未見過的精靈'}>
                    <Thumb speciesId={f.speciesId} stage={f.stage} size={60} silhouette={!known} />
                    <div className="pf-meta">
                      <b>{known ? sp.name : '？？？'}</b>
                      <span>{sp.elements.map((e) => <ElementChip key={e} el={e} />)} Lv {f.level}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {!arena && selLv > 0 && selLv < foeLv && (
              <div className="lv-warn">
                <b>⚠ 隊伍平均 Lv {selLv}，對手最高 Lv {foeLv}</b>
                <span>勝率可能偏低。可先到野外和野生精靈戰鬥提升等級、使用經驗藥水，或突破已達等級上限的精靈。</span>
              </div>
            )}
          </section>
        )}
        <section className="party-sec">
          <div className="sec-head">
            <b>出戰隊伍</b>
            <span className="sec-count">{sel.length}/3</span>
            <span className="sec-hint">
              {dnd.dragging
                ? dnd.fromParty ? '放到其他位置互換順序' : '放到隊伍中的位置即可出戰'
                : `先發最先出場・點選移出，${COARSE ? '長按拖曳' : '拖曳'}可換位`}
            </span>
            {cap !== undefined && <span className={`pp-cost ${over ? 'over' : ''}`}>費用 {cost}/{COST_CAP}</span>}
          </div>
          <div className="ps-slots">
            {[0, 1, 2].map((i) => {
              const x = save.spirits.find((y) => y.uid === sel[i]);
              const order = i === 0 ? '先發' : `第 ${i + 1} 位`;
              if (!x) {
                const dp = dnd.target(`slot:${i}`);
                return (
                  <div key={i} className={`ps-slot empty ${dp.cls}`} {...dp.attrs}>
                    <span className="ps-order">{order}</span>
                    <span className="ps-plus">+</span>
                    <span className="ps-empty">{dnd.dragging ? '拖到這裡' : '從下方選擇精靈'}</span>
                    {dp.over && <span className="drop-tag">放入</span>}
                  </div>
                );
              }
              const xsp = getSpirit(x.speciesId);
              const dp = dnd.target(`slot:${i}`, x.uid);
              return (
                <button key={x.uid} className={`ps-slot r-${xsp.rarity}-b ${dp.cls}`} onClick={() => remove(x.uid)} {...dp.attrs}>
                  <span className="ps-order">{order}</span>
                  {dp.over && <span className="drop-tag"><Icon name="swap" size={14} /> 互換</span>}
                  {counters(x.speciesId) && <span className="pp-adv" title="具有剋制對手的屬性"><Icon name="up" size={11} />剋制</span>}
                  <Thumb speciesId={x.speciesId} stage={stageOf(x)} size={80} />
                  <span className="ps-name">{xsp.name}</span>
                  <span className="ps-meta">
                    {xsp.elements.map((e) => <ElementChip key={e} el={e} />)}
                    <b>Lv {arena ? 60 : x.level}</b>
                  </span>
                  {cap !== undefined && <span className="pp-costb">費用 {COST[xsp.rarity]}</span>}
                </button>
              );
            })}
          </div>
        </section>
        <section className={`store-sec ${dnd.target('store').cls}`} data-drop="store">
          <div className="sec-head">
            <b>可選精靈</b>
            <span className="sec-count">{rest.length}</span>
            <span className="sec-hint">
              {dnd.fromParty ? '放到精靈上互換・空白處移出隊伍' : `點選或${COARSE ? '長按' : ''}拖曳加入隊伍${foeEls.length > 0 ? '；標示「剋制」者屬性剋制對手' : ''}`}
            </span>
          </div>
          {dnd.over === 'store' && <div className="drop-tag store-tag">放開以移出隊伍</div>}
          <div className="bag-grid">
            {rest.map((x) => {
              const xsp = getSpirit(x.speciesId);
              const dp = dnd.target(`tile:${x.uid}`, x.uid);
              return (
                <button key={x.uid} className={`bag-tile r-${xsp.rarity}-b ${sel.length >= 3 && !dnd.dragging ? 'full' : ''} ${dp.cls}`} onClick={() => add(x.uid)} {...dp.attrs}>
                  {dp.over && <span className="drop-tag"><Icon name="swap" size={14} /> 互換</span>}
                  {counters(x.speciesId) && <span className="pp-adv" title="具有剋制對手的屬性"><Icon name="up" size={11} />剋制</span>}
                  {cap !== undefined && <span className="pp-costb tile">費用 {COST[xsp.rarity]}</span>}
                  <Thumb speciesId={x.speciesId} stage={stageOf(x)} size={68} />
                  <span className="bt-name">{xsp.name}</span>
                  <span className="bt-meta">
                    {xsp.elements.map((e) => <ElementChip key={e} el={e} />)}
                    <b>Lv {arena ? 60 : x.level}</b>
                  </span>
                </button>
              );
            })}
            {rest.length === 0 && <div className="note">所有精靈皆已加入出戰隊伍。</div>}
          </div>
        </section>
        <footer className="pp-foot">
          <button className={`art-chip ${showArt ? 'on' : ''}`} onClick={() => { sfx.click(); setShowArt(!showArt); }}>
            <span>戰技</span> <b>{ART_NAME[save.art]}</b>
          </button>
          <button className="btn gold pp-go" disabled={sel.length === 0 || over} onClick={go}>
            {over ? '費用超過上限' : sel.length === 0 ? '請選擇精靈' : '出發！'}
          </button>
        </footer>
      </div>
      {showArt && (
        <div className="pp-artpop panel">
          <div className="sec-head"><b>選擇戰技</b><span className="sec-hint">每場戰鬥限用一次，可與技能同時使用</span></div>
          <div className="art-row">
            {(['oath_break', 'oath_guard', 'oath_gale', 'eye_insight', 'light_purify', 'aether_spring'] as ArtId[]).map((a) => (
              <button key={a} className={`art-opt ${save.art === a ? 'sel' : ''}`} onClick={() => { sfx.click(); store.mutate((d) => (d.art = a)); setShowArt(false); }}>
                <b>{ART_NAME[a]}</b>
                <span>{ART_DESC[a]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
