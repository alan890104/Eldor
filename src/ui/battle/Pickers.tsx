// Choice panels in battle (switch spirit, throw a Pact Stone): a gold-framed panel on a dark scrim, with large option cards side by side.

import { useEffect, type ReactNode } from 'react';
import { getSpirit } from '../../data.ts';
import { CAPTURE_STATUS, typeMultiplier } from '../../../sim/formulas.ts';
import { ELEMENT_COLOR } from '../../battle/scene.ts';
import { CONTROL } from '../../engine/battle.ts';
import type { CombatantView, SideView } from '../../engine/types.ts';
import { sfx } from '../../audio/sfx.ts';
import { ElementChip, hex, RarityTag } from '../common.tsx';
import { Thumb } from '../widgets.tsx';
import { Icon, STATUS_INFO } from '../icons.tsx';
import { ItemIcon, ITEMS, type ItemId } from '../items.tsx';
import { HpBar } from './SideHud.tsx';

/** Panel frame: title, subtitle, close button at the top right; when forced it cannot be cancelled (switch after fainting, tutorial capture) */
function PickerShell({ icon, title, sub, extra, hint, forced, onCancel, children }: { icon: ReactNode; title: string; sub?: ReactNode; extra?: ReactNode; hint?: string[]; forced: boolean; onCancel: () => void; children: ReactNode }) {
  useEffect(() => {
    if (forced) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [forced, onCancel]);

  return (
    <div className={`bp-veil ${forced ? 'forced' : ''}`} onClick={() => !forced && onCancel()}>
      <div className="bp panel" onClick={(e) => e.stopPropagation()}>
        <div className="bp-head">
          <div className="bp-title">
            {icon}
            <span>{title}</span>
          </div>
          {sub && <div className="bp-sub">{sub}</div>}
          {extra}
          {!forced && (
            <button className="bp-close" aria-label="取消" onClick={() => { sfx.click(); onCancel(); }}>
              ✕
            </button>
          )}
        </div>
        {children}
        {!forced && hint && <div className="bp-hint gsep">{hint.map((h) => <span key={h}>{h}</span>)}</div>}
      </div>
    </div>
  );
}

// ───────────────────────── Switch ─────────────────────────

/** Best multiplier of our element against the opponent, worst multiplier of the opponent's element against us */
function matchup(c: CombatantView, foe: CombatantView): { off: number; def: number } {
  const off = Math.max(...c.elements.map((e) => typeMultiplier(e, foe.elements)));
  const def = Math.max(...foe.elements.map((e) => typeMultiplier(e, c.elements)));
  return { off, def };
}

export function SwapPanel({ me, foe, replace, onPick, onCancel }: { me: SideView; foe: CombatantView | null; replace: boolean; onPick: (i: number) => void; onCancel: () => void }) {
  const out = me.team[me.active];
  return (
    <PickerShell
      icon={<Icon name="swap" size={18} />}
      title={replace ? '選擇下一隻出戰的精靈' : '替換精靈'}
      sub={replace ? <span className="bp-alert">{out.name}倒下了</span> : '替換最先執行，但會用掉本回合的行動'}
      extra={foe && !foe.fainted && (
        <div className="bp-foe">
          對手 <b>{foe.name}</b>
          {foe.elements.map((e) => <ElementChip key={e} el={e} />)}
        </div>
      )}
      hint={['點選精靈出戰', '點空白處取消']}
      forced={replace}
      onCancel={onCancel}
    >
      <div className="sw-row">
        {me.team.map((c, i) => {
          const current = i === me.active;
          const sp = getSpirit(c.speciesId);
          const mu = foe && !foe.fainted && !c.fainted && !current ? matchup(c, foe) : null;
          return (
            <button
              key={c.uid}
              className={`sw-card rb-${sp.rarity} ${current && !c.fainted ? 'cur' : ''} ${c.fainted ? 'down' : ''}`}
              style={{ ['--c' as string]: hex(ELEMENT_COLOR[c.elements[0]]) }}
              disabled={current || c.fainted}
              onClick={() => onPick(i)}
            >
              <div className="sw-art">
                <Thumb speciesId={c.speciesId} stage={c.stage} size={132} />
                <span className="sw-rar"><RarityTag r={sp.rarity} /></span>
                <span className="sw-lv">Lv<b>{c.level}</b></span>
                {current && !c.fainted && <span className="sw-stamp cur">出戰中</span>}
                {c.fainted && <span className="sw-stamp down">倒下</span>}
              </div>
              <div className="sw-info">
                <div className="sw-name">
                  <span>{c.name}</span>
                  <span className="sw-els">{c.elements.map((e) => <ElementChip key={e} el={e} />)}</span>
                </div>
                <HpBar c={c} />
                <div className="sw-tags">
                  {c.status.map((s) => (
                    <span key={s.id} className="sw-st" style={{ ['--c' as string]: STATUS_INFO[s.id].color }} title={STATUS_INFO[s.id].name}>
                      <Icon name={s.id} size={13} />
                      {STATUS_INFO[s.id].name}
                    </span>
                  ))}
                  {mu && mu.off > 1 && <span className="sw-mu good"><Icon name="up" size={9} />剋制對手</span>}
                  {mu && mu.def > 1 && <span className="sw-mu bad"><Icon name="down" size={9} />被對手剋制</span>}
                  {mu && mu.def < 1 && <span className="sw-mu res"><Icon name="shield" size={10} />耐對手屬性</span>}
                  {mu && mu.off < 1 && mu.def <= 1 && <span className="sw-mu dim"><Icon name="down" size={9} />攻擊被抵抗</span>}
                  {mu && mu.off === 1 && mu.def === 1 && <span className="sw-mu dim">相性普通</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </PickerShell>
  );
}

// ───────────────────────── Capture ─────────────────────────

type StoneKind = 'basic' | 'advanced' | 'master';
const STONES: { k: StoneKind; item: ItemId; mult: number }[] = [
  { k: 'basic', item: 'stoneBasic', mult: 1 },
  { k: 'advanced', item: 'stoneAdvanced', mult: 1.5 },
  { k: 'master', item: 'stoneMaster', mult: 2.5 },
];

export function CapturePanel({ foe, odds, owned, coach, onPick, onCancel }: { foe: CombatantView; odds: (k: StoneKind) => number; owned: Record<StoneKind, number>; coach: boolean; onPick: (k: StoneKind) => void; onCancel: () => void }) {
  const sp = getSpirit(foe.speciesId);
  const hpPct = Math.round((foe.hp / foe.maxHp) * 100);
  const ctrl = foe.status.find((s) => CONTROL.includes(s.id));
  const other = foe.status[0];
  const statusMult = ctrl ? CAPTURE_STATUS.control : other ? CAPTURE_STATUS.other : CAPTURE_STATUS.none;
  const blocked = foe.corrupted || sp.rarity === 'SSR';
  return (
    <PickerShell
      icon={<ItemIcon id="stoneBasic" size={22} />}
      title="擲出契約石"
      sub={coach ? '教學戰必定成功' : '成功就能和牠締結契約；失敗會用掉本回合的行動'}
      hint={['點選契約石擲出', '點空白處取消']}
      forced={coach}
      onCancel={onCancel}
    >
      <div className="cp-target" style={{ ['--c' as string]: hex(ELEMENT_COLOR[foe.elements[0]]) }}>
        <div className="cp-portrait">
          <Thumb speciesId={foe.speciesId} stage={foe.stage} size={76} />
        </div>
        <div className="cp-tinfo">
          <div className="cp-tname">
            {foe.corrupted && <span className="cp-corrupt">蝕化</span>}
            <span>{foe.name}</span>
            <RarityTag r={sp.rarity} />
            <span className="cp-lv">Lv{foe.level}</span>
            {foe.elements.map((e) => <ElementChip key={e} el={e} />)}
          </div>
          <HpBar c={foe} />
          {!blocked && !coach && (
            <div className="cp-factors">
              <span className={`cp-f ${hpPct <= 35 ? 'good' : ''}`}>
                <Icon name="heal" size={12} />剩餘生命 <b>{hpPct}%</b>
              </span>
              {ctrl || other ? (
                <span className="cp-f good" style={{ ['--c' as string]: STATUS_INFO[(ctrl ?? other).id].color }}>
                  <Icon name={(ctrl ?? other).id} size={12} />
                  {STATUS_INFO[(ctrl ?? other).id].name} <b>×{statusMult}</b>
                </span>
              ) : (
                <span className="cp-f">無異常狀態</span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="cp-row">
        {STONES.map(({ k, item, mult }) => {
          const p = odds(k);
          const n = owned[k];
          const tier = p >= 0.7 ? 'hi' : p >= 0.35 ? 'mid' : 'lo';
          const coached = coach && k === 'basic';
          return (
            <button
              key={k}
              className={`cp-stone st-${k} ${tier} ${coached ? 'coach-target' : ''}`}
              style={{ ['--sc' as string]: ITEMS[item].color, ['--p' as string]: String(p) }}
              disabled={n <= 0 || p <= 0}
              onClick={() => onPick(k)}
            >
              {coached && <div className="coach">擲出契約石！</div>}
              <div className="cp-socket">
                <ItemIcon id={item} size={46} />
              </div>
              <div className="cp-name">{ITEMS[item].name}</div>
              <div className="cp-mult">成功率 ×{mult}</div>
              <div className="cp-odds">
                {p > 0 ? <>{Math.round(p * 100)}<small>%</small></> : <em>無法捕捉</em>}
              </div>
              <div className={`cp-own ${n <= 0 ? 'none' : ''}`}>{n > 0 ? <>持有 <b>{n}</b></> : '沒有持有'}</div>
            </button>
          );
        })}
      </div>
      <div className={`cp-note ${blocked ? 'warn' : ''}`}>
        {foe.corrupted
          ? '蝕化中的精靈無法締約。先擊倒牠來淨化，淨化後牠可能願意跟你走'
          : sp.rarity === 'SSR'
            ? 'SSR 精靈無法以契約石捕捉'
            : '生命越低越容易成功；冰凍、沉睡、恐懼 ×1.5，其他異常 ×1.2'}
      </div>
    </PickerShell>
  );
}
