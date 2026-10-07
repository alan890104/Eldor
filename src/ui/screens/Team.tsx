// Bag: spirits (battle party, storage, stats, Breakthrough, skill loadout) and items.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ShowcaseScene } from '../../render/scenes.ts';
import { getSpirit } from '../../data.ts';
import { computeStats, STAT_KEYS, STAT_LABEL } from '../../../sim/formulas.ts';
import type { Element } from '../../../sim/types.ts';
import { music } from '../../audio/music.ts';
import { sfx } from '../../audio/sfx.ts';
import { breakthrough, breakthroughCost, canBreakthrough, giveExp, hasBreakthroughMaterials, levelCap, potionExp } from '../../game/progression.ts';
import type { SpiritInstance } from '../../engine/types.ts';
import { ElementChip, RarityTag } from '../common.tsx';
import { store, useStore, type Screen } from '../store.ts';
import { ExpBar, ResonancePips, Thumb, TopBar, useScene } from '../widgets.tsx';
import { ItemIcon } from '../items.tsx';
import { ItemsPanel } from './Items.tsx';
import { LoadoutEditor, SkillSummary } from './Loadout.tsx';
import { Icon } from '../icons.tsx';
import { RichText } from '../glossary.tsx';
import { LearnPop } from '../KitInfo.tsx';
import { parseDrop, useDragDrop } from '../dragDrop.ts';
import { COARSE, usePartyDrag } from '../partyDrag.ts';
import { uiZoom } from '../uiScale.ts';

/** The spirit sits between the left list and the right panel; on a narrow phone screen where that doesn't fit, it is centered */
export function frameBetweenPanels(scene: ShowcaseScene, listWidth = 290): void {
  const w = window.innerWidth;
  if (w <= 720) {
    scene.frame(0);
    return;
  }
  const z = uiZoom();
  const left = z * (16 + Math.min(listWidth, w * 0.4));
  const right = w - z * (14 + Math.min(420, w * 0.56));
  scene.frameAt((left + right) / 2);
}

/** Layout: wide = the 3D spirit is shown between the left and right panels; split = the two columns fill the screen (smaller screens such as a phone in landscape) */
type Layout = 'wide' | 'split';
function teamLayout(): Layout {
  return window.innerWidth > 1000 && window.innerHeight > 560 ? 'wide' : 'split';
}
function isWide(): boolean {
  return teamLayout() === 'wide';
}

/** Matches the widths of .bag-list / .team-detail in the CSS */
function frameTeam(scene: ShowcaseScene): void {
  const w = window.innerWidth;
  if (!isWide()) {
    scene.frame(0);
    return;
  }
  const z = uiZoom();
  const left = z * (12 + Math.min(460, w * 0.36));
  const right = w - z * (12 + Math.min(480, w * 0.38));
  scene.frameAt((left + right) / 2);
}

const STAT_DESC: Record<string, string> = {
  hp: '生命值歸零時，該精靈無法繼續戰鬥。',
  atk: '力量越高，武技造成的傷害越大。',
  mag: '魔力越高，魔法造成的傷害越大。',
  def: '護甲越高，承受武技的傷害越低。',
  res: '抗魔越高，承受魔法的傷害越低。',
  spd: '速度越高，先制相同時越先行動。',
};

const RARITY_RANK: Record<string, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
const EL_RANK: Element[] = ['fire', 'water', 'nature', 'wind', 'earth', 'thunder', 'light', 'dark', 'neutral'];

function spiritName(s: SpiritInstance): string {
  return getSpirit(s.speciesId).name;
}

export function TeamScreen({ uid, tab: initialTab, from }: { uid?: string; tab?: 'spirits' | 'items'; from?: Screen }) {
  const { save } = useStore();
  const [sel, setSel] = useState(uid ?? save.party[0] ?? save.spirits[0]?.uid);
  const [tab, setTab] = useState<'info' | 'skills'>('info');
  const [editing, setEditing] = useState(false);
  const [bagTab, setBagTab] = useState<'spirits' | 'items'>(initialTab ?? 'spirits');
  const [sortKey, setSortKey] = useState<'level' | 'rarity' | 'element'>('level');
  const [filter, setFilter] = useState<'all' | 'breakthrough'>('all');
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [breakText, setBreakText] = useState<string | null>(null);
  /** Skills just learned (shown after leveling up with an EXP Potion) */
  const [learnNote, setLearnNote] = useState<{ uid: string; ids: string[] } | null>(null);
  const [layout, setLayout] = useState(teamLayout);
  const wide = layout === 'wide';
  // Which spirit and which stage is on the showcase right now; the model is swapped only when the selection or the stage changes (the Breakthrough cutscene swaps in the new stage by itself)
  const shown = useRef<{ scene: ShowcaseScene; key: string } | null>(null);
  const s = save.spirits.find((x) => x.uid === sel) ?? save.spirits[0];
  const scene = useScene((st) => new ShowcaseScene(st, 1, 'hub'), []);
  useEffect(() => music.play('hub'), []);
  useEffect(() => {
    const onResize = () => setLayout(teamLayout());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const syncShowcase = (sc: ShowcaseScene, x: SpiritInstance, flash = true) => {
    const key = `${x.uid}:${x.stage}`;
    if (shown.current?.scene === sc && shown.current.key === key) return;
    sc.show(0, x.speciesId, x.stage, flash);
    shown.current = { scene: sc, key };
  };
  // busy is a dependency too: after the Breakthrough cutscene ends, the model must be re-aligned and the showcase's display state restored
  useEffect(() => {
    if (!scene || !s || busy) return;
    syncShowcase(scene, s);
    frameTeam(scene);
    scene.setShowcaseVisible(wide && !editing && bagTab === 'spirits');
  }, [scene, s?.uid, s?.stage, wide, editing, bagTab, busy]);
  // When the selected spirit no longer appears in the list (e.g. moved back to storage and then filtered out), keeping the selection is enough; only replace mode is cancelled
  useEffect(() => setReplacing(false), [sel]);
  const dnd = usePartyDrag({
    party: save.party,
    minSize: 1,
    commit: (next, uid) => {
      store.mutate((d) => (d.party = next));
      setSel(uid);
    },
    onTap: (uid) => {
      sfx.click();
      setSel(uid);
    },
    onStart: () => setReplacing(false),
  });
  const { dragging, fromParty } = dnd;
  if (!s) return null;
  const sp = getSpirit(s.speciesId);
  const stats = computeStats(sp.base, s.level, s.stage, s.resonance);
  const inParty = save.party.includes(s.uid);
  const partyIdx = save.party.indexOf(s.uid);
  const cost = s.stage < 3 ? breakthroughCost(s) : null;
  const canBreak = canBreakthrough(s);
  const mats = hasBreakthroughMaterials(save, s);

  const doBreakthrough = async () => {
    if (!scene || busy) return;
    if (!hasBreakthroughMaterials(save, s) || !canBreakthrough(s)) {
      sfx.error();
      return;
    }
    setBusy(true);
    // The cutscene always starts from the currently selected spirit (if the showcase model is not it, swap it in first)
    syncShowcase(scene, s, false);
    // During the cutscene the panels fade out and the spirit returns to the center of the screen
    scene.setShowcaseVisible(true);
    scene.frame(0);
    const next = (s.stage + 1) as 2 | 3;
    const anim = scene.breakthrough(0, s.speciesId, next);
    // Show the Breakthrough caption the instant the light bursts
    window.setTimeout(() => setBreakText(`${sp.name} 突破了！`), 2700);
    await anim;
    shown.current = { scene, key: `${s.uid}:${next}` };
    store.mutate((d) => {
      const t = d.spirits.find((x) => x.uid === s.uid)!;
      breakthrough(d, t);
    });
    await new Promise((r) => window.setTimeout(r, 900));
    setBreakText(null);
    setBusy(false);
  };

  const usePotion = () => {
    if (save.inv.potions <= 0 || s.level >= levelCap(s)) {
      sfx.error();
      return;
    }
    sfx.levelUp();
    scene?.cheer(0);
    const learned: string[] = [];
    store.mutate((d) => {
      const t = d.spirits.find((x) => x.uid === s.uid)!;
      d.inv.potions--;
      learned.push(...giveExp(t, potionExp(t)).newSkills);
    });
    noteLearned(s.uid, learned);
  };
  /** Skills learned by leveling up: merged into one display when the same spirit levels up repeatedly */
  const noteLearned = (uid: string, ids: string[]) => {
    if (!ids.length) return;
    setLearnNote((n) => (n && n.uid === uid ? { uid, ids: [...n.ids, ...ids.filter((x) => !n.ids.includes(x))] } : { uid, ids }));
  };
  /** Open this spirit's skill loadout straight from the level-up notice, and select the new skill that isn't in the skill slots yet */
  const [editFocus, setEditFocus] = useState<string | undefined>();
  const editSkills = (uid: string, focusId?: string) => {
    setEditFocus(focusId);
    setSel(uid);
    setBagTab('spirits');
    setReplacing(false);
    setEditing(true);
    setLearnNote(null);
  };

  const addToParty = () => {
    if (save.party.length >= 3) {
      sfx.click();
      setReplacing(true);
      return;
    }
    sfx.confirm();
    store.mutate((d) => d.party.push(s.uid));
  };
  const removeFromParty = () => {
    if (save.party.length <= 1) {
      sfx.error();
      store.showToast('出戰隊伍至少需要 1 隻精靈');
      return;
    }
    sfx.click();
    store.mutate((d) => (d.party = d.party.filter((u) => u !== s.uid)));
  };
  const makeLead = () => {
    sfx.click();
    store.mutate((d) => (d.party = [s.uid, ...d.party.filter((u) => u !== s.uid)]));
  };
  const onSlot = (i: number) => {
    const u = save.party[i];
    if (replacing && u) {
      sfx.confirm();
      store.mutate((d) => {
        d.party[i] = s.uid;
      });
      setReplacing(false);
      return;
    }
    if (!u) {
      // Empty slot: the selected storage spirit goes straight in
      if (!inParty) {
        sfx.confirm();
        store.mutate((d) => d.party.push(s.uid));
      } else {
        sfx.error();
        store.showToast('請先在倉庫點選要加入的精靈');
      }
      return;
    }
    sfx.click();
    setSel(u);
  };

  const storage = save.spirits
    .filter((x) => !save.party.includes(x.uid))
    .filter((x) => (filter === 'breakthrough' ? canBreakthrough(x) : true))
    .sort((a, b) => {
      const sa = getSpirit(a.speciesId);
      const sb = getSpirit(b.speciesId);
      if (sortKey === 'rarity') return RARITY_RANK[sa.rarity] - RARITY_RANK[sb.rarity] || b.level - a.level;
      if (sortKey === 'element') return EL_RANK.indexOf(sa.elements[0]) - EL_RANK.indexOf(sb.elements[0]) || b.level - a.level;
      return b.level - a.level || RARITY_RANK[sa.rarity] - RARITY_RANK[sb.rarity];
    });
  const storageTotal = save.spirits.length - save.party.length;

  return (
    <div className={`screen uiz team-screen bag-screen ${busy ? 'cinematic' : ''} l-${layout}`}>
      <TopBar title="背包" back={() => store.go(from ?? { name: 'hub' })} />
      {breakText && <div className="break-banner">{breakText}</div>}
      {learnNote && !editing && <LearnPop uid={learnNote.uid} ids={learnNote.ids} onEdit={editSkills} onClose={() => setLearnNote(null)} />}
      <div className="bag-tabs">
        <button className={bagTab === 'spirits' ? 'on' : ''} onClick={() => { sfx.click(); setBagTab('spirits'); }}>
          <Icon name="physical" size={15} /> 精靈 <small>{save.spirits.length}</small>
        </button>
        <button className={bagTab === 'items' ? 'on' : ''} onClick={() => { sfx.click(); setBagTab('items'); setReplacing(false); setEditing(false); }}>
          <ItemIcon id="potions" size={17} /> 道具
        </button>
      </div>
      {bagTab === 'items' ? (
        <ItemsPanel onPotion={(u, learned) => { setSel(u); scene?.cheer(0); noteLearned(u, learned); }} />
      ) : editing ? (
        <LoadoutEditor uid={s.uid} focusId={editFocus} onSwitch={setSel} onDone={() => { sfx.click(); setEditing(false); setEditFocus(undefined); }} />
      ) : (
        <>
          <div className={`bag-list panel ${dragging ? 'dnd-active' : ''}`} ref={dnd.rootRef}>
            <section className={`party-sec ${replacing ? 'replacing' : ''}`}>
              <div className="sec-head">
                <b>出戰隊伍</b>
                <span className="sec-count">{save.party.length}/3</span>
                <span className="sec-hint">
                  {replacing
                    ? `選擇要換下的精靈，由「${spiritName(s)}」替補`
                    : dragging
                      ? fromParty ? '放到其他位置互換順序' : '放到隊伍中的位置即可出戰'
                      : COARSE ? '先發最先出場・長按拖曳可換位' : '先發最先出場・拖曳可調整順序'}
                </span>
                {replacing && <button className="mini" onClick={() => setReplacing(false)}>取消</button>}
              </div>
              <div className="ps-slots">
                {[0, 1, 2].map((i) => {
                  const x = save.spirits.find((y) => y.uid === save.party[i]);
                  const order = i === 0 ? '先發' : `第 ${i + 1} 位`;
                  if (!x) {
                    const dp = dnd.target(`slot:${i}`);
                    return (
                      <button key={i} className={`ps-slot empty ${dp.cls}`} onClick={() => onSlot(i)} {...dp.attrs}>
                        <span className="ps-order">{order}</span>
                        <span className="ps-plus">+</span>
                        <span className="ps-empty">{dragging ? '拖到這裡' : inParty ? '空位' : `放入「${spiritName(s)}」`}</span>
                        {dp.over && <span className="drop-tag">放入</span>}
                      </button>
                    );
                  }
                  const xsp = getSpirit(x.speciesId);
                  const dp = dnd.target(`slot:${i}`, x.uid);
                  return (
                    <button key={x.uid} className={`ps-slot r-${xsp.rarity}-b ${x.uid === s.uid ? 'sel' : ''} ${dp.cls}`} onClick={() => onSlot(i)} {...dp.attrs}>
                      <span className="ps-order">{order}</span>
                      {dp.over && <span className="drop-tag"><Icon name="swap" size={14} /> 互換</span>}
                      {canBreakthrough(x) && <BreakBadge ready={hasBreakthroughMaterials(save, x)} />}
                      <Thumb speciesId={x.speciesId} stage={x.stage} size={80} />
                      <span className="ps-name">{xsp.name}</span>
                      <span className="ps-meta">
                        {xsp.elements.map((e) => <ElementChip key={e} el={e} />)}
                        <b>Lv {x.level}</b>
                      </span>
                      {replacing && <span className="ps-swap"><Icon name="swap" size={16} /> 換下</span>}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className={`store-sec ${dnd.target('store').cls}`} data-drop="store">
              <div className="sec-head">
                <b>倉庫</b>
                <span className="sec-count">{storageTotal}</span>
                <span className="sec-hint">
                  {fromParty ? '放到精靈上互換・空白處移回倉庫' : COARSE ? '長按拖曳到隊伍即可出戰' : '拖曳到出戰隊伍即可編入'}
                </span>
              </div>
              {dnd.over === 'store' && <div className="drop-tag store-tag">放開以移回倉庫</div>}
              <div className="bag-controls">
                <span className="seg">
                  {([['level', '等級'], ['rarity', '稀有度'], ['element', '屬性']] as const).map(([k, t]) => (
                    <button key={k} className={sortKey === k ? 'on' : ''} onClick={() => setSortKey(k)}>{t}</button>
                  ))}
                </span>
                <span className="seg">
                  {([['all', '全部'], ['breakthrough', '待突破']] as const).map(([k, t]) => (
                    <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{t}</button>
                  ))}
                </span>
              </div>
              <div className="bag-grid">
                {storage.map((x) => {
                  const xsp = getSpirit(x.speciesId);
                  const dp = dnd.target(`tile:${x.uid}`, x.uid);
                  return (
                    <button key={x.uid} className={`bag-tile r-${xsp.rarity}-b ${x.uid === s.uid ? 'sel' : ''} ${dp.cls}`} onClick={() => { sfx.click(); setSel(x.uid); }} {...dp.attrs}>
                      {dp.over && <span className="drop-tag"><Icon name="swap" size={14} /> 互換</span>}
                      <Thumb speciesId={x.speciesId} stage={x.stage} size={68} />
                      <span className="bt-name">{xsp.name}</span>
                      <span className="bt-meta">
                        {xsp.elements.map((e) => <ElementChip key={e} el={e} />)}
                        <b>Lv {x.level}</b>
                      </span>
                      {canBreakthrough(x) && <BreakBadge ready={hasBreakthroughMaterials(save, x)} />}
                    </button>
                  );
                })}
                {storage.length === 0 && (
                  <div className="note">{storageTotal === 0 ? '倉庫中沒有其他精靈。可透過星門召喚或捕捉野生精靈取得新夥伴。' : '倉庫中沒有已達等級上限、等待突破的精靈。'}</div>
                )}
              </div>
            </section>
          </div>
          <div className="team-detail panel">
            <div className="td-head">
              {!wide && <Thumb speciesId={s.speciesId} stage={s.stage} size={72} />}
              <div className="td-id">
                <div className="td-name">{spiritName(s)}</div>
                <div className="td-meta">
                  <RarityTag r={sp.rarity} />
                  {sp.elements.map((e) => <ElementChip key={e} el={e} />)}
                  <span>{sp.role}</span>
                  {s.resonance > 0 && <ResonancePips n={s.resonance} />}
                </div>
                <div className={`td-where ${inParty ? 'party gsep' : ''}`}>{inParty ? <><span>出戰隊伍</span><span>{partyIdx === 0 ? '先發' : `第 ${partyIdx + 1} 位`}</span></> : '倉庫'}</div>
              </div>
              <div className="td-actions">
                {inParty ? (
                  <>
                    {partyIdx > 0 && <button className="btn small" onClick={makeLead}>設為先發</button>}
                    <button className="btn small ghost" onClick={removeFromParty}>移回倉庫</button>
                  </>
                ) : (
                  <button className={`btn small gold ${replacing ? 'on' : ''}`} onClick={addToParty}>
                    {save.party.length >= 3 ? '替換出戰精靈' : '編入出戰'}
                  </button>
                )}
              </div>
            </div>
            <div className="td-exp">
              <span className="td-lv">Lv <b>{s.level}</b><small>/ {levelCap(s)}</small></span>
              <ExpBar s={s} />
            </div>
            <div className="tabs td-tabs">
              <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>能力與突破</button>
              <button className={tab === 'skills' ? 'on' : ''} onClick={() => setTab('skills')}>技能</button>
            </div>
            {tab === 'info' ? (
              <>
                <div className="stat-grid">
                  {STAT_KEYS.map((k) => (
                    <div key={k} className="stat" title={STAT_DESC[k]}>
                      <span className="sn"><Icon name={k === 'hp' ? 'heal' : k} size={14} /> {STAT_LABEL[k]}</span>
                      <div className="sbar"><div style={{ width: `${Math.min(100, (sp.base[k] / 140) * 100)}%` }} /></div>
                      <span className="sv">{stats[k]}</span>
                    </div>
                  ))}
                </div>
                <div className="trait">
                  <b>特性【{sp.trait.name}】</b> <RichText text={sp.trait.text} />
                </div>
                <div className="break-sec">
                  <div className="break-line">階段 {(['I', 'II', 'III'] as const).map((n, i) => <span key={n} className={i === s.stage - 1 ? 'cur' : i < s.stage - 1 ? 'past' : ''}>{n}</span>)}</div>
                  {cost ? (
                    <div className="break-box">
                      <div className="req-row">
                        <Req ok={save.inv.gold >= cost.gold} title={`持有 ${save.inv.gold.toLocaleString()}`}><ItemIcon id="gold" size={16} /> {cost.gold.toLocaleString()}</Req>
                        <Req ok={save.inv.breakStones >= cost.breakStones} title={`持有 ${save.inv.breakStones}`}><ItemIcon id="breakStones" size={16} /> {save.inv.breakStones}/{cost.breakStones}</Req>
                        {cost.shards > 0 && <Req ok={save.inv.shards >= cost.shards} title={`持有 ${save.inv.shards}`}><ItemIcon id="shards" size={16} /> {save.inv.shards}/{cost.shards}</Req>}
                      </div>
                      <button className={`btn small ${canBreak && mats ? 'gold' : ''}`} disabled={!canBreak || !mats || busy} onClick={doBreakthrough}>
                        {/* The level requirement is written only on the button (no repeated Lv label on the left); the requirement and the button share one row */}
                        {!canBreak ? `需 Lv ${levelCap(s)}` : !mats ? '素材不足' : '突破！'}
                      </button>
                    </div>
                  ) : (
                    <div className="note">已達最終階段，可使用奧義。</div>
                  )}
                </div>
                <div className="potion-box">
                  <span className="pot-label"><ItemIcon id="potions" size={22} /> 經驗藥水 <b>×{save.inv.potions}</b></span>
                  <button className="btn small ghost" disabled={save.inv.potions <= 0 || s.level >= levelCap(s)} onClick={usePotion}>
                    使用
                  </button>
                </div>
              </>
            ) : (
              <SkillSummary s={s} onEdit={() => { sfx.click(); setEditFocus(undefined); setEditing(true); }} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Breakthrough requirement: a met requirement gets a green check badge in front (the check in icons.tsx), an unmet one keeps its red background */
function Req({ ok, title, children }: { ok: boolean; title?: string; children: ReactNode }) {
  return (
    <span className={`req ${ok ? 'ok' : ''}`} title={title}>
      {ok && <Icon name="check" size={15} className="req-mark" />}
      {children}
    </span>
  );
}

/** Marker for having reached the level cap: with enough materials it can Breakthrough right away, otherwise it is shown in gray */
function BreakBadge({ ready }: { ready: boolean }) {
  return (
    <span className={`bt-break ${ready ? '' : 'wait'}`} title={ready ? '可以突破' : '已達等級上限，突破素材不足'}>
      <Icon name="up" size={11} />
    </span>
  );
}
