// Info on both sides of the battle screen: the nameplate on top (portrait, name, HP, party), and below it status columns along the screen edge:
// status conditions and stat changes as named icon tiles, the signature mechanic on its own mechanic card (full text, not truncated), and side conditions as a separate group.

import { useEffect, useState } from 'react';
import { findSpirit, getSkill } from '../../data.ts';
import { ELEMENT_COLOR } from '../../battle/scene.ts';
import type { CombatantView, SideView } from '../../engine/types.ts';
import { ElementChip, hex } from '../common.tsx';
import { Thumb } from '../widgets.tsx';
import { Icon, STAT_INFO, STATUS_INFO } from '../icons.tsx';
import { markInfo, tipHandlers, type HudTip } from './KitHud.tsx';

type OnTip = (t: HudTip | null) => void;

export function HpBar({ c, small }: { c: CombatantView; small?: boolean }) {
  const pct = Math.max(0, c.hp / c.maxHp);
  const [ghost, setGhost] = useState(pct);
  useEffect(() => {
    if (pct >= ghost) {
      setGhost(pct);
      return;
    }
    const t = setTimeout(() => setGhost(pct), 380);
    return () => clearTimeout(t);
  }, [pct, ghost]);
  const shieldPct = Math.min(1, c.shield / c.maxHp);
  const color = pct > 0.5 ? 'var(--hp-hi)' : pct > 0.2 ? 'var(--hp-mid)' : 'var(--hp-lo)';
  return (
    <div className={`hp ${small ? 'small' : ''}`}>
      <div className="hp-ghost" style={{ width: `${ghost * 100}%` }} />
      <div className="hp-fill" style={{ width: `${pct * 100}%`, background: color }} />
      {shieldPct > 0 && <div className="hp-shield" style={{ width: `${shieldPct * 100}%` }} />}
      {!small && (
        <div className="hp-text">
          {c.hp} / {c.maxHp}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Nameplate ─────────────────────────

const CORRUPT_TIP: HudTip = { title: '蝕化・虛蝕之軀', text: '被虛蝕侵染、失去理智的精靈。力量與魔力 ×1.2；每回合結束被虛蝕吞噬最大生命的 1/12；受到光屬性傷害 ×1.3。蝕化中無法締約，擊倒牠就能淨化。', icon: 'curse', color: '#d04aff' };

function Nameplate({ side, mine, onTip }: { side: SideView; mine: boolean; onTip: OnTip }) {
  const c = side.team[side.active];
  return (
    <div className={`np ${mine ? 'mine' : 'foe'}`} style={{ ['--c' as string]: hex(ELEMENT_COLOR[c.elements[0]]) }}>
      <div className="np-portrait">
        <Thumb speciesId={c.speciesId} stage={c.stage} size={72} />
      </div>
      <div className="np-body">
        <div className="np-head">
          {c.corrupted && <span className="sp-corrupt" {...tipHandlers(CORRUPT_TIP, onTip, 4200)}>蝕化</span>}
          <span className="np-name">{c.name}</span>
          <span className="np-lv">Lv<b>{c.level}</b></span>
          <span className="np-els">{c.elements.map((e) => <ElementChip key={e} el={e} />)}</span>
        </div>
        <HpBar c={c} />
        <div className="np-foot">
          <span className="np-team" aria-label={`隊伍 ${side.team.filter((t) => !t.fainted).length}/${side.team.length}`}>
            {side.team.map((t, i) => (
              <i key={t.uid} className={`np-gem ${t.fainted ? 'dead' : ''} ${i === side.active ? 'cur' : ''}`} />
            ))}
          </span>
          {!mine && (
            <span className="np-ae" {...tipHandlers({ title: `對手靈能 ${side.aether}`, text: '對手目前的靈能。奧義需要 5 點。', icon: 'aether', color: '#6fd8ff' }, onTip)}>
              <Icon name="aether" size={12} />
              {side.aether}
            </span>
          )}
          {side.ultUsed && (
            <span className="np-ult" {...tipHandlers({ title: '奧義已使用', text: '本場戰鬥已經使用過奧義（每場限用一次）。', icon: 'ultimate', color: '#ffc94a' }, onTip)}>
              <Icon name="ultimate" size={12} />已用
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Status icon tiles ─────────────────────────

interface TileData {
  key: string;
  icon: string;
  color: string;
  label: string;
  /** Value at the top right (stacks, percentage) */
  value?: string;
  /** Remaining turns at the bottom right */
  turns?: number;
  /** Stat change: buff / debuff */
  arrow?: 'up' | 'down';
  tip: HudTip;
}

function Tile({ t, onTip }: { t: TileData; onTip: OnTip }) {
  return (
    <span className={`st-tile ${t.arrow ?? ''}`} style={{ ['--c' as string]: t.color }} {...tipHandlers(t.tip, onTip)}>
      <span className="st-gem">
        <Icon name={t.icon} size={20} />
        {t.arrow ? (
          <b className="st-stage">
            <Icon name={t.arrow} size={8} />
            {t.value}
          </b>
        ) : (
          t.value && <b className="st-v">{t.value}</b>
        )}
        {t.turns ? <i className="st-t">{t.turns}</i> : null}
      </span>
      <span className="st-cap">{t.label}</span>
    </span>
  );
}

/** A spirit's status conditions, stat changes, built-in marks and turn-based effects (signature mechanic marks go on the mechanic card instead) */
function bodyTiles(c: CombatantView, turn?: number): TileData[] {
  const out: TileData[] = [];
  for (const s of c.status) {
    const info = STATUS_INFO[s.id];
    const stacks = s.id === 'poison' && s.stacks ? `×${s.stacks}` : undefined;
    out.push({ key: s.id, icon: s.id, color: info.color, label: info.name, value: stacks, turns: s.turns, tip: { title: `${info.name}${stacks ?? ''}（剩 ${s.turns} 回合）`, text: info.text, icon: s.id, color: info.color } });
  }
  if (c.seeded) out.push({ key: 'seed', icon: 'seed', color: '#6adf7a', label: '寄生', tip: { title: '寄生', text: '每回合結束時失去生命，並由對手吸收', icon: 'seed', color: '#6adf7a' } });
  for (const k of Object.keys(c.stages) as (keyof typeof c.stages)[]) {
    const v = c.stages[k];
    if (!v) continue;
    const up = v > 0;
    const color = up ? '#ffc94a' : '#7a92ff';
    out.push({
      key: `stage-${k}`,
      icon: k,
      color,
      label: STAT_INFO[k].name,
      arrow: up ? 'up' : 'down',
      value: String(Math.abs(v)),
      tip: { title: `${STAT_INFO[k].name} ${up ? '+' : ''}${v}`, text: `${STAT_INFO[k].text}${up ? '提升' : '降低'}（每階 ${up ? '×1.25' : '×0.8'}），離場時重置`, icon: k, color },
    });
  }
  if (c.charges > 0) out.push({ key: 'charge', icon: 'charge', color: '#ffe45a', label: '電荷', value: String(c.charges), tip: { title: `電荷 ×${c.charges}`, text: '部分雷屬性技能會消耗電荷以提升威力（最多 3 層）', icon: 'charge', color: '#ffe45a' } });
  if (c.charging) out.push({ key: 'charging', icon: 'charging', color: '#e8e0ff', label: '蓄力', tip: { title: '蓄力中', text: '下回合自動釋放蓄力技能，期間無法替換', icon: 'charging' } });
  // The engine's marksOf decides exposure by exposed >= turn, so at the start of battle (turn 0) every spirit would get a false "Exposed" mark: there can be no exposure at the start, so skip it
  const marks = c.fainted ? [] : (c.marks ?? []).filter((m) => !(m.id === 'exposed' && turn === 0));
  marks.forEach((m, i) => {
    const info = markInfo(m, c.speciesId);
    if (info.kind === 'kit') return;
    out.push({ key: `m${i}:${m.id}`, icon: info.icon, color: info.color, label: info.name, value: info.value, turns: info.turns, tip: { title: info.title, text: info.text, icon: info.icon, color: info.color } });
  });
  return out;
}

/** Side conditions: tailwind, trap, entry hazards, screens, wish... (our own aether advance is already shown on the aether bar) */
function sideTiles(side: SideView, mine: boolean): TileData[] {
  const out: TileData[] = [];
  if (side.tailwind > 0) out.push({ key: 'tailwind', icon: 'tailwind', color: '#9ff5e0', label: '順風', turns: side.tailwind, tip: { title: `順風（剩 ${side.tailwind} 回合）`, text: '這一方全體速度提升', icon: 'tailwind', color: '#9ff5e0' } });
  if (side.hasTrap) {
    const known = mine && side.trapId ? side.trapId : side.trapRevealed;
    out.push({
      key: 'trap',
      icon: 'trap',
      color: side.trapRevealed ? '#ffd978' : '#b08aff',
      label: known ? getSkill(known).name : '伏技',
      tip: { title: known ? `伏技：${getSkill(known).name}` : '蓋著的伏技', text: known ? getSkill(known).trigger ?? '' : '敵方已設置伏技，符合發動條件時會自動發動', icon: 'trap', color: '#b08aff' },
    });
  }
  (side.conds ?? []).forEach((m, i) => {
    if (mine && m.id === 'aeLoan') return;
    const info = markInfo(m);
    out.push({ key: `c${i}:${m.id}`, icon: info.icon, color: info.color, label: info.name, value: info.value, turns: info.turns, tip: { title: `陣地・${info.title}`, text: info.text, icon: info.icon, color: info.color } });
  });
  return out;
}

// ───────────────────────── Mechanic card ─────────────────────────

function MechCard({ c, onTip }: { c: CombatantView; onTip: OnTip }) {
  const sp = findSpirit(c.speciesId);
  if (!sp) return null;
  const mech = sp.mechanic;
  const tip: HudTip = mech
    ? { title: `專屬機制【${mech.name}】`, text: mech.text, icon: 'art', color: '#ffd978', extra: [`特性【${sp.trait.name}】${sp.trait.text}`] }
    : { title: `特性【${sp.trait.name}】`, text: sp.trait.text, icon: 'art', color: '#ffd978' };
  const rows = c.fainted ? [] : (c.marks ?? []).map((m) => markInfo(m, c.speciesId)).filter((m) => m.kind === 'kit');
  return (
    <div className={`mc ${mech ? '' : 'trait'}`} {...tipHandlers(tip, onTip, 4200)}>
      <div className="mc-head">
        <span className="mc-kind">
          <Icon name="art" size={11} />
          {mech ? '機制' : '特性'}
        </span>
        <span className="mc-name">{mech ? mech.name : sp.trait.name}</span>
        <b className="mc-q">?</b>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="mc-row">
          <i className="mc-dot" />
          <span className="mc-note">{r.name}</span>
          {r.value && !r.name.includes(r.value) && <b className="mc-n">{r.value}</b>}
          {r.turns ? <i className="mc-t">{r.turns} 回合</i> : null}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Assembly ─────────────────────────

export function SideHud({ side, mine, onTip, turn }: { side: SideView; mine: boolean; onTip: OnTip; turn?: number }) {
  const c = side.team[side.active];
  const body = bodyTiles(c, turn);
  const field = sideTiles(side, mine);
  return (
    <div className={`side-hud ${mine ? 'mine' : 'foe'}`}>
      <Nameplate side={side} mine={mine} onTip={onTip} />
      <div className="st-col">
        {body.length > 0 && (
          <div className="st-grid">
            {body.map((t) => <Tile key={t.key} t={t} onTip={onTip} />)}
          </div>
        )}
        <MechCard c={c} onTip={onTip} />
        {field.length > 0 && (
          <div className="st-field">
            <span className="st-field-label">陣地</span>
            <div className="st-grid">
              {field.map((t) => <Tile key={t.key} t={t} onTip={onTip} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
