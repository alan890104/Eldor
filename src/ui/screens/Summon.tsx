// Star Gate Summon: banner selection, rate explanation, summon cutscene, results overview.

import { useEffect, useRef, useState } from 'react';
import { SummonScene, type RevealBeat } from '../../render/summon/index.ts';
import { summonSfx } from '../../audio/summonSfx.ts';
import { getSpirit } from '../../data.ts';
import { music } from '../../audio/music.ts';
import { sfx } from '../../audio/sfx.ts';
import { featuredFor, longRunSummary, pay, pityLeft, poolOf, pull, pullCost, pullsAvailable, setFeatured, spiritRates, type BannerId, type PullCost, type PullResult } from '../../game/gachaGame.ts';
import { LIMITED_BANNER } from '../../../sim/gacha.ts';
import { ElementChip, RarityTag } from '../common.tsx';
import { store, useStore } from '../store.ts';
import { ItemIcon } from '../items.tsx';
import { Modal, ResonancePips, Thumb, TopBar, useScene } from '../widgets.tsx';

export function SummonScreen({ tutorial }: { tutorial?: boolean }) {
  const { save } = useStore();
  const scene = useScene((s) => new SummonScene(s), []);
  const [banner, setBanner] = useState<BannerId>('up');
  const [rates, setRates] = useState(false);
  const [picking, setPicking] = useState(false);
  const [playing, setPlaying] = useState<PullResult[] | null>(null);
  useEffect(() => music.play('summon'), []);
  const featured = featuredFor(save);
  const fsp = getSpirit(featured);
  const ownedFeatured = save.spirits.find((s) => s.speciesId === featured);
  const doPull = (n: number) => {
    const c = pullCost(save, n);
    if (!c.ok) {
      sfx.error();
      const need = c.tickets > 0 ? `契約券 ${c.tickets} 張 + 星輝石 ${c.crystals.toLocaleString()}` : `星輝石 ${c.crystals.toLocaleString()}`;
      store.showToast(`召喚 ×${n} 需要${need}，目前星輝石 ${save.inv.crystals.toLocaleString()}，還差 ${(c.crystals - save.inv.crystals).toLocaleString()}`);
      return;
    }
    let res: PullResult[] = [];
    store.mutate((d) => {
      pay(d, n);
      res = pull(d, banner, n);
      if (tutorial) d.tutorial = undefined;
    });
    sfx.confirm();
    setPlaying(res);
  };
  if (playing && scene) {
    return (
      <SummonPlay
        scene={scene}
        results={playing}
        onDone={() => {
          setPlaying(null);
          scene.clearReveal();
        }}
      />
    );
  }
  return (
    <div className="screen uiz summon-screen">
      {/* During the tour you can't leave before the first summon; once you have pulled (save.tutorial cleared) it behaves as usual */}
      <TopBar title="星門召喚" back={tutorial && save.tutorial ? undefined : () => store.go({ name: 'hub' })} />
      <div className="banner-tabs">
        <button className={banner === 'up' ? 'on' : ''} onClick={() => { sfx.click(); setBanner('up'); }}>聖靈降臨</button>
        <button className={banner === 'standard' ? 'on' : ''} onClick={() => { sfx.click(); setBanner('standard'); }}>星辰之門</button>
      </div>
      <div className="banner-card panel">
        {banner === 'up' ? (
          <>
            <button className="bc-thumb bc-pick" onClick={() => { sfx.click(); setPicking(true); }}>
              <Thumb speciesId={featured} stage={3} size={150} />
              <Sash owned={!!ownedFeatured} />
              <span className="bc-swap">更換</span>
            </button>
            <div className="bc-info">
              <div className="bc-tag">自選 UP</div>
              <div className="bc-name">{fsp.name}</div>
              <div className="bc-meta">
                <RarityTag r="SSR" /> {fsp.elements.map((e) => <ElementChip key={e} el={e} />)}
                {ownedFeatured && <ResonancePips n={ownedFeatured.resonance} />}
              </div>
              <div className="bc-desc">從 {poolOf('SSR').length} 隻 SSR 任選一隻當 UP，隨時可換。抽中 SSR 時 50% 是牠；沒抽中的話，下一隻 SSR 必定是你當時選的那隻。</div>
            </div>
          </>
        ) : (
          <div className="bc-info">
            <div className="bc-tag">常駐</div>
            <div className="bc-name">星辰之門</div>
            <div className="bc-desc">全部 {poolOf('SSR').length} 隻 SSR（八聖靈與四傳說）、{poolOf('SR').length} 隻 SR、{poolOf('R').length} 隻 R 都在池內，SSR 平均分配。</div>
          </div>
        )}
      </div>
      <div className="summon-foot">
      <div className="pity">
        <span>可召喚 {pullsAvailable(save)} 次</span>
        <span>{pityLeft(save) === 1 ? '下一抽必出 SSR' : `再 ${pityLeft(save)} 抽內必出 SSR`}</span>
        {save.pity.guaranteed && <span className="pity-up">下一隻 SSR 必定為 UP</span>}
        <button className="link" onClick={() => setRates(true)}>機率說明</button>
      </div>
      <div className="summon-buttons">
        {([1, 10] as const).map((n) => {
          const c = pullCost(save, n);
          return (
            <button key={n} className={`btn ${n === 10 ? 'gold' : ''} summon-btn ${c.ok ? '' : 'short'}`} onClick={() => doPull(n)}>
              召喚 ×{n}
              <CostLine c={c} crystals={save.inv.crystals} />
            </button>
          );
        })}
      </div>
      {tutorial && save.inv.tickets < 10 && (
        <button className="btn small ghost sf-cta" onClick={() => { store.mutate((d) => { d.tutorial = undefined; }); store.go({ name: 'hub' }); }}>前往星門城</button>
      )}
      </div>
      {rates && <RatesModal banner={banner} featured={featured} onClose={() => setRates(false)} />}
      {picking && (
        <PickModal
          current={featured}
          onPick={(id) => {
            sfx.confirm();
            store.mutate((d) => void setFeatured(d, id));
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/** Pick-your-own UP: any of 12 SSR spirits. A diagonal ribbon on the card corner says owned or not yet obtained, and the gem row above is the collection progress */
function PickModal({ current, onPick, onClose }: { current: string; onPick: (id: string) => void; onClose: () => void }) {
  const owned = new Map(store.save.spirits.map((s) => [s.speciesId, s.resonance]));
  const pool = poolOf('SSR');
  const have = pool.filter((id) => owned.has(id)).length;
  return (
    <Modal onClose={onClose}>
      <h3>選擇 UP 精靈</h3>
      <div className="pick-tally" title={`已擁有 ${have} 隻，未取得 ${pool.length - have} 隻`}>
        <span className="pt-gems">{pool.map((id) => <i key={id} className={owned.has(id) ? 'on' : ''} />)}</span>
        <b>{have}</b><span className="pt-of">/ {pool.length}</span>
      </div>
      <div className="pick-grid">
        {pool.map((id) => {
          const sp = getSpirit(id);
          const res = owned.get(id);
          return (
            <button key={id} className={`pick-item ${res !== undefined ? 'is-owned' : 'is-new'} ${id === current ? 'on' : ''}`} onClick={() => (id === current ? onClose() : onPick(id))}>
              {id === current && <span className="pi-up">UP</span>}
              <Sash owned={res !== undefined} />
              <Thumb speciesId={id} stage={3} size={72} />
              <div className="pi-name">{sp.name}</div>
              <div className="pi-meta">{sp.elements.map((e) => <ElementChip key={e} el={e} />)}</div>
              {res !== undefined && <ResonancePips n={res} />}
            </button>
          );
        })}
      </div>
      <p className="pick-note">保底跟著目前的選擇：沒抽中 UP 之後換選，下一隻 SSR 就會是新選的精靈。</p>
    </Modal>
  );
}

/** The diagonal ribbon on the card corner: owned is emerald green with a gold edge, not yet obtained is rose with a gold edge */
function Sash({ owned }: { owned: boolean }) {
  return (
    <span className={`sash ${owned ? 'sash-own' : 'sash-miss'}`}>
      <span>{owned ? '已擁有' : '未取得'}</span>
    </span>
  );
}

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace(/\.0+$/, '')}%`;

function RatesModal({ banner, featured, onClose }: { banner: BannerId; featured: string; onClose: () => void }) {
  const cfg = LIMITED_BANNER;
  const lr = longRunSummary();
  const list = spiritRates(banner, featured);
  return (
    <Modal onClose={onClose}>
      <h3>召喚機率（{banner === 'up' ? '聖靈降臨' : '星辰之門'}）</h3>
      <p>
        <b>{cfg.hardPity} 抽內必出 SSR</b>（距上次 SSR 第 {cfg.hardPity} 抽必定是 SSR；抽到 SSR 後重新計算，未用完的抽數會保留到下次召喚）<br />
        SSR {pct(cfg.ssrBase)}（第 {cfg.softPityStart} 抽起每抽 +{pct(cfg.softPityStep, 0)}）<br />
        SR {pct(cfg.srBase, 0)}（每 {cfg.srPity} 抽至少 1 隻 SR 以上）<br />
        R {pct(1 - cfg.ssrBase - cfg.srBase)}<br />
        含保底的綜合機率：SSR 約 {pct(lr.ssr, 2)}、SR 約 {pct(lr.sr)}
      </p>
      <p>重複的精靈會提升「共鳴」（最高 R5，全能力 +10%），之後轉為星塵。新夥伴會以接近你隊伍的等級加入。</p>
      <div className="rate-list">
        {(['SSR', 'SR', 'R'] as const).map((r) => (
          <div key={r} className="rl-group">
            <div className="rl-head"><RarityTag r={r} /> {list.filter((x) => x.rarity === r).length} 隻</div>
            {list
              .filter((x) => x.rarity === r)
              .map((x) => (
                <div key={x.id} className={`rl-row ${banner === 'up' && x.id === featured ? 'up' : ''}`}>
                  <span>{getSpirit(x.id).name}{banner === 'up' && x.id === featured ? '（UP）' : ''}</span>
                  <span>{pct(x.rate, 3)}</span>
                </div>
              ))}
          </div>
        ))}
        <div className="rl-foot">以上為含保底的長期平均單抽機率；N 精靈只在野外出現，不在卡池內。</div>
      </div>
      <button className="btn small" onClick={onClose}>知道了</button>
    </Modal>
  );
}

/** The cost on the summon button: tickets are spent first, any pulls beyond them are paid in crystals; when the holdings fall short the shortfall is marked */
function CostLine({ c, crystals }: { c: PullCost; crystals: number }) {
  return (
    <>
      <small className="cost">
        {c.tickets > 0 && <span className="ci"><ItemIcon id="tickets" size={15} /> 契約券 ×{c.tickets}</span>}
        {c.tickets > 0 && c.crystals > 0 && <span className="plus">+</span>}
        {c.crystals > 0 && <span className="ci"><ItemIcon id="crystals" size={15} /> 星輝石 ×{c.crystals.toLocaleString()}</span>}
      </small>
      {!c.ok && <small className="sb-short">星輝石還差 {(c.crystals - crystals).toLocaleString()}</small>}
    </>
  );
}

function stageOf(speciesId: string): 1 | 2 | 3 {
  return store.save.spirits.find((s) => s.speciesId === speciesId)?.stage ?? 3;
}

export type SummonPhase = 'intro' | 'reveal' | 'summary';

const KIND_TEXT = { new: 'NEW', resonance: '同源共鳴 +1', stardust: '轉為星塵' } as const;
const KIND_CLASS = { new: 'new', resonance: 'res', stardust: 'dust' } as const;

/**
 * Summon cutscene: intro (skippable) -> reveal one by one (a tap moves to the next spirit; during an SSR cutscene a tap first fast-forwards to the nameplate) -> results.
 * fake sets whether the shooting star first disguises itself as purple (default 35% chance, only when there is an SSR); onPhase lets the dev recording tool sync.
 */
export function SummonPlay({ scene, results, onDone, fake, onPhase }: { scene: SummonScene; results: PullResult[]; onDone: () => void; fake?: boolean; onPhase?: (p: SummonPhase) => void }) {
  const [phase, setPhaseRaw] = useState<SummonPhase>('intro');
  const [idx, setIdx] = useState(0);
  const [beat, setBeat] = useState<RevealBeat | null>(null);
  // The cutscene is asynchronous: after a skip or unmount, a late callback must not change state any more
  const alive = useRef(true);
  const skipped = useRef(false);
  const best = results.some((r) => r.rarity === 'SSR') ? 'SSR' : results.some((r) => r.rarity === 'SR') ? 'SR' : 'R';
  const setPhase = (p: SummonPhase) => {
    setPhaseRaw(p);
    onPhase?.(p);
  };
  const startReveal = (i: number) => {
    const r = results[i];
    setIdx(i);
    setBeat(null);
    void scene.reveal(r.speciesId, r.rarity, stageOf(r.speciesId), (b) => {
      if (alive.current && !skipped.current) setBeat(b);
    });
  };
  const finish = () => {
    scene.abort();
    scene.summary();
    setPhase('summary');
  };
  useEffect(() => {
    alive.current = true;
    const upgrade = fake ?? (best === 'SSR' && Math.random() < 0.35);
    void scene.intro(best, upgrade).then(() => {
      if (!alive.current || skipped.current) return;
      setPhase('reveal');
      startReveal(0);
    });
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cur = results[idx];
  const next = () => {
    if (phase !== 'reveal') return;
    sfx.click();
    // The SSR showpiece: the first tap fast-forwards to the nameplate, only the second moves on to the next spirit
    if (scene.busy && cur.rarity === 'SSR' && beat !== 'settled') {
      scene.hurry();
      setBeat('settled');
      return;
    }
    if (scene.busy) scene.hurry();
    if (idx + 1 >= results.length) {
      finish();
      return;
    }
    startReveal(idx + 1);
  };
  const skip = () => {
    sfx.click();
    skipped.current = true;
    finish();
  };
  const sp = getSpirit(cur.speciesId);
  const shown = beat === 'burst' || beat === 'banner' || beat === 'settled';
  const revealedCount = phase === 'reveal' ? idx + (shown ? 1 : 0) : phase === 'summary' ? results.length : 0;
  return (
    <div className="screen summon-play" onClick={next}>
      {phase !== 'summary' && results.length > 1 && (
        <div className="reveal-strip">
          {results.map((r, i) => (
            <div key={i} className={`rs-slot ${i < revealedCount ? r.rarity : ''} ${phase === 'reveal' && i === idx ? 'cur' : ''}`}>{i < revealedCount ? r.rarity : '?'}</div>
          ))}
        </div>
      )}
      {phase === 'reveal' && shown && cur.rarity === 'SSR' && (
        <div key={`b${idx}`} className="ssr-banner" style={{ ['--c' as string]: elementHex(sp.elements[0]) }}>
          <div className="sb-sub">{sp.role.startsWith('傳說') ? '傳說降臨' : '聖靈降臨'}</div>
          <div className="sb-name">{sp.name}</div>
          <div className="sb-line" />
        </div>
      )}
      {phase === 'reveal' && shown && (
        <div key={idx} className={`reveal-info r-${cur.rarity}-b ${cur.rarity === 'SSR' ? 'ssr' : ''}`}>
          <div className="ri-rarity"><RarityTag r={cur.rarity} /> {cur.featured && <span className="ri-up">UP!</span>}</div>
          <div className="ri-name">{sp.name}</div>
          <div className="ri-meta">{sp.elements.map((e) => <ElementChip key={e} el={e} />)} {sp.role}</div>
          <div className={`ri-kind ${KIND_CLASS[cur.kind]}`}>{KIND_TEXT[cur.kind]}</div>
          <div className="ri-count"><b>{idx + 1} / {results.length}</b><span>點擊繼續</span></div>
        </div>
      )}
      {phase !== 'summary' && (
        <button className="skip-btn" onClick={(e) => { e.stopPropagation(); skip(); }}>略過 »</button>
      )}
      {phase === 'summary' && <SummonSummary results={results} onDone={onDone} />}
    </div>
  );
}

const elementHex = (el: string): string => {
  const ELEMENT_HEX: Record<string, string> = { water: '#3db7ff', fire: '#ff6a2b', nature: '#5fcb5a', wind: '#9fe8e0', earth: '#c49a5a', thunder: '#b38cff', light: '#ffe680', dark: '#9a5aff', neutral: '#e8e8f0' };
  return ELEMENT_HEX[el] ?? '#ffd978';
};

/** Results screen: the cards flip over in turn and SSRs glow; one line of stats on top */
function SummonSummary({ results, onDone }: { results: PullResult[]; onDone: () => void }) {
  useEffect(() => {
    results.forEach((r, i) => summonSfx.card(i, r.rarity));
  }, [results]);
  const count = (r: string) => results.filter((x) => x.rarity === r).length;
  const fresh = results.filter((x) => x.kind === 'new').length;
  return (
    <div className="summary panel" onClick={(e) => e.stopPropagation()}>
      <div className="sum-title">召喚結果</div>
      <div className="sum-counts">
        {count('SSR') > 0 && <span className="sc ssr">SSR ×{count('SSR')}</span>}
        {count('SR') > 0 && <span className="sc sr">SR ×{count('SR')}</span>}
        {count('R') > 0 && <span className="sc r">R ×{count('R')}</span>}
        {fresh > 0 && <span className="sc new">NEW ×{fresh}</span>}
      </div>
      <div className={`sum-grid ${results.length === 1 ? 'single' : ''}`}>
        {results.map((r, i) => {
          const s = getSpirit(r.speciesId);
          return (
            <div key={i} className={`sum-item r-${r.rarity}-b ${r.rarity === 'SSR' ? 'ssr' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
              {r.kind === 'new' && <span className="si-new">NEW</span>}
              {r.featured && <span className="si-up">UP</span>}
              <Thumb speciesId={r.speciesId} stage={stageOf(r.speciesId)} size={78} />
              <div className="si-name">{s.name}</div>
              <div className="si-tag"><RarityTag r={r.rarity} />{r.kind === 'resonance' && <span className="si-res">共鳴</span>}</div>
            </div>
          );
        })}
      </div>
      <button className="btn gold" onClick={() => { sfx.confirm(); onDone(); }}>確定</button>
    </div>
  );
}
