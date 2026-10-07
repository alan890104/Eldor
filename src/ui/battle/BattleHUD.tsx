// Battle UI: both sides' status, aether crystals, skill cards, switch, trap, art, capture, log, banners and the ultimate cut-in.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getSkill } from '../../data.ts';
import { GUARD_COST, isAttack, skillCost, ULT_COST } from '../../engine/battle.ts';
import { typeMultiplier } from '../../../sim/formulas.ts';
import type { BattleController } from '../../battle/controller.ts';
import { ART_DESC, ART_NAME } from '../../battle/director.ts';
import { ELEMENT_COLOR } from '../../battle/scene.ts';
import type { TurnInput } from '../../engine/types.ts';
import { sfx } from '../../audio/sfx.ts';
import { hex } from '../common.tsx';
import { store, useStore } from '../store.ts';
import { Icon } from '../icons.tsx';
import { SkillInfo } from '../SkillInfo.tsx';
import { SkillCard } from '../SkillCard.tsx';
import { RichText, showPop } from '../glossary.tsx';
import { HelpButton } from '../Help.tsx';
import { FieldTag, GuardButton, ReverseChip } from './KitHud.tsx';
import { SideHud } from './SideHud.tsx';
import { CapturePanel, SwapPanel } from './Pickers.tsx';
import { requestThumb } from '../../render/thumbs.ts';
import { coachStep } from '../../game/tutorial.ts';

export function BattleHUD({ ctl, tips = true, tutorial = false }: { ctl: BattleController; tips?: boolean; tutorial?: boolean }) {
  const st = useSyncExternalStore(ctl.subscribe, ctl.getState);
  const floatRef = useRef<HTMLDivElement>(null);
  const [trap, setTrap] = useState<string | null>(null);
  const [art, setArt] = useState(false);
  const [panel, setPanel] = useState<'none' | 'switch' | 'capture' | 'log'>('none');
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    ctl.floatLayer = floatRef.current;
  }, [ctl]);

  // Draw the switch panel's portraits in the background first, so opening it doesn't wait
  const myTeam = st.view?.sides[0].team;
  useEffect(() => {
    myTeam?.forEach((c) => void requestThumb(c.speciesId, c.stage));
  }, [!!myTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const closePanel = useCallback(() => setPanel('none'), []);

  useEffect(() => {
    setTip(null);
    if (st.phase === 'input') {
      setTrap(null);
      setArt(false);
      setPanel('none');
    }
    if (st.phase === 'replace') setPanel('switch');
  }, [st.phase]);

  const v = st.view;
  const b = ctl.battle;
  const inputPhase = st.phase === 'input';
  const me = v ? v.sides[0] : null;
  const active = me ? me.team[me.active] : null;
  const combatant = b.active(0);
  const trapCost = trap ? getSkill(trap).cost : 0;
  const artSpring = art && b.side(0).art === 'aether_spring';
  const aeTotal = Math.min(10, (me?.aether ?? 0) + (artSpring ? 3 : 0));

  const send = (input: TurnInput) => {
    if (trap) input.trap = trap;
    if (art) input.art = true;
    sfx.confirm();
    setPanel('none');
    void ctl.submit(input);
  };

  // Show the ultimate even while it is locked (greyed out), so the player knows what condition is still missing
  const lockedUlt = active && !combatant.ultimate ? combatant.species.ultimate : null;
  const skillIds = active ? [...combatant.skills, ...(combatant.ultimate ? [combatant.ultimate] : lockedUlt ? [lockedUlt] : [])] : [];
  const foeC = b.active(1);
  const cards = skillIds.map((id) => {
    const sk = getSkill(id);
    const isTrap = sk.category === 'trap';
    const extra = artSpring ? 3 : 0;
    let ok = isTrap ? b.canSetTrap(0, id, 0).ok : b.canUse(0, id, extra).ok;
    let reason = isTrap ? b.canSetTrap(0, id, 0).reason : b.canUse(0, id, extra).reason;
    if (id === lockedUlt) reason = '階段 III 解鎖';
    else if (sk.category === 'ultimate' && reason === '靈能不足') reason = `靈能 ${aeTotal}/${ULT_COST}`;
    if (!isTrap && ok && trap && skillCost(sk) + trapCost > (me?.aether ?? 0) + extra) {
      ok = false;
      reason = '靈能不足';
    }
    // Estimated damage (as a share of the opponent's max HP) and the element matchup, to help the player judge
    const atk = isAttack(sk);
    const dmg = atk && !foeC.fainted ? b.estimate(0, id) : 0;
    const est = atk ? { pct: dmg / foeC.maxHp, ko: dmg >= foeC.hp, eff: typeMultiplier(sk.element, foeC.elements), dmg, foeHp: foeC.hp } : undefined;
    const ultCharge = sk.category === 'ultimate' && id !== lockedUlt && !ok && aeTotal < ULT_COST && !me?.ultUsed;
    return { id, isTrap, ok, reason, selected: trap === id, aetherShort: !ok && (reason === '靈能不足' || ultCharge), est, cost: skillCost(sk), ultCharge };
  });
  const ult = active ? ultState(!!combatant.ultimate, !!me?.ultUsed, aeTotal) : undefined;
  const coach = tutorial && inputPhase && v ? coachStep(b, cards, ult?.state, aeTotal) : null;
  const captureCoach = tutorial && panel === 'capture';

  return (
    <div className="hud">
      {tips && !st.auto && st.phase === 'input' && <MechanicTip ctl={ctl} />}
      <div className="floats" ref={floatRef} />
      {v && (
        <>
          <SideHud side={v.sides[0]} mine onTip={setTip} turn={v.turn} />
          <SideHud side={v.sides[1]} mine={false} onTip={setTip} turn={v.turn} />
          <div className="hud-top">
            <div className="ht-sys l">
              <button
                className="ht-btn"
                title={`戰鬥速度 ${st.speed}×（點一下切換，之後的戰鬥都沿用）`}
                onClick={() => {
                  sfx.click();
                  const next = st.speed === 1 ? 2 : 1;
                  ctl.setSpeed(next);
                  // Write it to settings: every later battle uses this speed (the same value as "Battle speed" on the settings screen)
                  store.mutate((d) => (d.settings.speed = next));
                }}
              >
                <b className="ht-speed">{st.speed}×</b>
              </button>
              {!tutorial && (
                <button className={`ht-btn auto ${st.auto ? 'on' : ''}`} title={st.auto ? '自動戰鬥中（點一下改回手動）' : '自動戰鬥：由 AI 代為出招（不會捕捉）'} onClick={() => { sfx.click(); ctl.setAuto(!st.auto); store.mutate((d) => (d.settings.auto = !st.auto)); }}>
                  <Icon name="auto" size={17} />
                  {st.auto && <span>自動中</span>}
                </button>
              )}
            </div>
            <div className="ht-turn">
              <small>第</small>
              <b>{Math.max(1, st.phase === 'playing' ? v.turn : v.turn + 1)}</b>
              <small>回合</small>
            </div>
            <div className="ht-sys r">
              <button className={`ht-btn ${panel === 'log' ? 'on' : ''}`} title="戰鬥日誌" onClick={() => { sfx.click(); setPanel(panel === 'log' ? 'none' : 'log'); }}>
                <Icon name="log" size={17} />
              </button>
              <HelpButton />
            </div>
            {(v.field || !!v.reverseOrder) && (
              <div className="ht-tags">
                {v.field && <FieldTag element={v.field.element} turns={v.field.turns} onTip={setTip} />}
                {!!v.reverseOrder && <ReverseChip turns={v.reverseOrder} onTip={setTip} />}
              </div>
            )}
          </div>
        </>
      )}

      {st.banner && (
        <div key={st.banner.id} className={`banner ${st.banner.side === 1 ? 'enemy' : st.banner.side === 0 ? 'ally' : 'neutral'}`} style={{ ['--c' as string]: hex(st.banner.color) }}>
          <div className="banner-text">{st.banner.text}</div>
          {st.banner.sub && <div className="banner-sub">{st.banner.sub}</div>}
        </div>
      )}

      {st.cutin && (
        <div key={st.cutin.id} className={`cutin ${st.cutin.side === 1 ? 'enemy' : ''} ${st.cutin.ssr ? 'ssr' : ''}`} style={{ ['--c' as string]: hex(ELEMENT_COLOR[st.cutin.element]), ['--spd' as string]: st.speed }}>
          <div className="cutin-band">
            <div className="cutin-sub gsep"><span>真名解放</span><span>{st.cutin.spirit}</span></div>
            <div className="cutin-skill">{st.cutin.skill}</div>
          </div>
        </div>
      )}

      {panel === 'log' && (
        <div className="log-panel" onClick={() => setPanel('none')}>
          {st.log.slice(-18).map((l, i) => (
            <div key={i} className={l.startsWith('──') ? 'log-turn' : ''}>
              {l}
            </div>
          ))}
        </div>
      )}

      {v && me && active && (inputPhase || st.phase === 'replace') && (
        <div className="action-bar">
          <AetherBar value={me.aether} reserve={trapCost} bonus={artSpring ? 3 : 0} coach={coach?.aether ? coach.text : undefined} ult={ult} loan={loanOf(me.conds)} />
          {st.phase === 'input' && (
            <div className="cards">
              {cards.map((c, i) => (
                <div key={c.id} className={`card-slot ${coach?.card === i ? 'coach-target' : coach?.lock && coach.card !== i ? 'coach-dim' : ''}`}>
                  {coach?.card === i && !coach.aether && <div className="coach">{coach.text}</div>}
                  <SkillCard
                    id={c.id}
                    est={c.est}
                    ok={c.ok || c.selected}
                    reason={c.reason}
                    selected={c.selected}
                    dim={!!trap && c.isTrap && !c.selected}
                    aetherShort={c.aetherShort}
                    className={c.ultCharge ? 'charging' : ''}
                    onTip={(on) => setTip(on ? { skill: c.id, est: c.est } : null)}
                    onClick={() => {
                      if (!c.ok && !c.selected) {
                        sfx.error();
                        return;
                      }
                      if (c.isTrap) {
                        sfx.click();
                        setTrap(c.selected ? null : c.id);
                        return;
                      }
                      send({ main: { type: 'skill', skillId: c.id } });
                    }}
                  >
                    {c.selected && <div className="sk-flag">已設置</div>}
                    {c.ultCharge && <UltCharge value={aeTotal} />}
                  </SkillCard>
                </div>
              ))}
            </div>
          )}
          <div className="side-buttons">
            {st.phase === 'input' && tutorial && (coach?.capture || panel === 'capture') && (
              <span className={`coach-anchor ${panel === 'capture' ? '' : 'coach-target'}`}>
                {panel !== 'capture' && <div className="coach">{coach?.text}</div>}
                <button className={`act stone ${panel === 'capture' ? 'on' : ''}`} onClick={() => { sfx.click(); setPanel(panel === 'capture' ? 'none' : 'capture'); }}>
                  <Icon name="stone" size={16} /> 捕捉
                </button>
              </span>
            )}
            {st.phase === 'input' && tutorial && coach?.guard && (
              <span className="coach-anchor coach-target">
                <div className="coach">{coach.text}</div>
                <GuardButton reason={null} onTip={setTip} onGuard={() => send({ main: { type: 'guard' } })} />
              </span>
            )}
            {st.phase === 'input' && !tutorial && (
              <>
                <button className={`act ${panel === 'switch' ? 'on' : ''}`} disabled={!b.canSwitch(0).ok} onClick={() => { sfx.click(); setPanel(panel === 'switch' ? 'none' : 'switch'); }}>
                  <Icon name="swap" size={16} /> 替換
                </button>
                <GuardButton
                  reason={(() => {
                    const extra = artSpring ? 3 : 0;
                    const g = b.canGuard(0, extra);
                    if (!g.ok) return g.reason ?? '無法格擋';
                    return trap && GUARD_COST + trapCost > (me?.aether ?? 0) + extra ? '靈能不足' : null;
                  })()}
                  onTip={setTip}
                  onGuard={() => send({ main: { type: 'guard' } })}
                />
                {b.side(0).art && (
                  <button
                    className={`act art ${art ? 'on' : ''}`}
                    disabled={b.side(0).artUsed}
                    onClick={() => { sfx.click(); setArt(!art); }}
                    onMouseEnter={() => setTip({ title: ART_NAME[b.side(0).art!], text: `締約者戰技，每場戰鬥限用一次，可與技能同時使用。效果：${ART_DESC[b.side(0).art!]}`, icon: 'art' })}
                    onMouseLeave={() => setTip(null)}
                  >
                    <Icon name="art" size={16} /> {ART_NAME[b.side(0).art!]}
                  </button>
                )}
                {ctl.setup.kind === 'wild' && (
                  <button className={`act stone ${panel === 'capture' ? 'on' : ''}`} onClick={() => { sfx.click(); setPanel(panel === 'capture' ? 'none' : 'capture'); }}>
                    <Icon name="stone" size={16} /> 捕捉
                  </button>
                )}
              </>
            )}
          </div>
          {trap && <div className="hint"><Icon name="trap" size={12} /> 伏技已設置，請選擇本回合使用的技能</div>}
          {art && <div className="hint art"><Icon name="art" size={12} /> {ART_DESC[b.side(0).art!]}</div>}
        </div>
      )}

      {panel === 'switch' && me && (
        <SwapPanel
          me={me}
          foe={v ? v.sides[1].team[v.sides[1].active] : null}
          replace={st.phase === 'replace'}
          onCancel={closePanel}
          onPick={(i) => {
            setPanel('none');
            if (st.phase === 'replace') {
              sfx.confirm();
              void ctl.chooseReplacement(i);
            } else send({ main: { type: 'switch', to: i } });
          }}
        />
      )}

      {panel === 'capture' && v && (
        <CapturePanel
          foe={v.sides[1].team[v.sides[1].active]}
          odds={(k) => b.captureOdds(0, k)}
          owned={ctl.stones}
          coach={captureCoach}
          onCancel={closePanel}
          onPick={(k) => send({ main: { type: 'capture', stone: k } })}
        />
      )}

      {tip && <TipBox tip={tip} />}
      {st.phase === 'playing' && <div className="thinking" />}
    </div>
  );
}

/** Aether explainer (shown when the "Aether" label is clicked) */
function explainAether(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  showPop(
    {
      title: '靈能',
      color: '#6fd8ff',
      icon: <Icon name="aether" size={14} />,
      lines: [
        '使用技能的資源。技能卡右上角的數字就是消耗量；0 費技能隨時都能使用，格擋消耗 1 點。',
        '取得方式：每回合結束自動 +2（上限 10）；部分技能（例如秘術「冥想」+2）與戰技「靈能湧泉」（+3）可以額外獲得靈能。',
        '奧義需要 5 點靈能。想使用奧義時，先用 0 費技能或「冥想」累積靈能。',
      ],
    },
    r.left + r.width / 2,
    r.top,
    true,
  );
}

function loanOf(conds: { id: string; n?: number; turns?: number }[]): { n: number; turns: number } | undefined {
  const c = conds.find((x) => x.id === 'aeLoan');
  return c ? { n: c.n ?? 0, turns: c.turns ?? 0 } : undefined;
}

type UltState = 'locked' | 'charging' | 'ready' | 'used';
interface UltInfo {
  state: UltState;
  /** Current aether (including the art's bonus), used to draw the ultimate's progress */
  aether: number;
}

function ultState(unlocked: boolean, used: boolean, aether: number): UltInfo {
  const state: UltState = !unlocked ? 'locked' : used ? 'used' : aether >= ULT_COST ? 'ready' : 'charging';
  return { state, aether };
}

/** Ultimate explainer (shown when the ultimate progress next to the aether bar is clicked) */
function explainUlt(el: HTMLElement, u: UltInfo): void {
  const r = el.getBoundingClientRect();
  const now =
    u.state === 'locked' ? '這隻精靈的奧義尚未解鎖：第二次突破（Lv 40）後才能使用。'
    : u.state === 'used' ? '本場戰鬥已經使用過奧義（每場限用一次）。'
    : u.state === 'ready' ? '靈能已達 5 點，現在就能發動！技能列最右側的金色卡片就是奧義。'
    : `目前靈能 ${u.aether}，還差 ${ULT_COST - u.aether} 點。每回合結束 +2；使用 0 費技能或「冥想」可以把靈能存下來。`;
  showPop(
    {
      title: '奧義',
      color: '#ffc94a',
      icon: <Icon name="ultimate" size={14} />,
      lines: [
        '呼喚精靈的真名，釋放全部力量的必殺技。消耗 5 靈能，每場戰鬥限用一次。',
        '靈能條上標著「奧義」的第 5 格就是門檻；右邊的「奧義 3/5」顯示還差多少，集滿時會亮起。',
        now,
      ],
    },
    r.left + r.width / 2,
    r.top,
    true,
  );
}

function AetherBar({ value, reserve, bonus, coach, ult, loan }: { value: number; reserve: number; bonus: number; coach?: string; ult?: UltInfo; loan?: { n: number; turns: number } }) {
  const total = Math.min(10, value + bonus);
  const mark = ult && ult.state !== 'used';
  return (
    <div className={`aether ${coach ? 'coach-target' : ''} ${ult?.state === 'ready' ? 'ult-ready' : ''}`}>
      {coach && <div className="coach wide">{coach}</div>}
      <button
        className="ae-label"
        onClick={(e) => { e.stopPropagation(); explainAether(e.currentTarget); }}
        onMouseEnter={(e) => explainAether(e.currentTarget)}
        onMouseLeave={() => showPop(null)}
      >
        靈能 <b>?</b>
      </button>
      {Array.from({ length: 10 }, (_, i) => {
        const filled = i < total;
        const reserved = filled && i >= total - reserve;
        const isMark = mark && i === ULT_COST - 1;
        return (
          <span key={i} className={`ae ${filled ? 'on' : ''} ${reserved ? 'res' : ''} ${i >= value && filled ? 'bonus' : ''} ${isMark ? `ult-mark ${ult.state}` : ''} ${mark && ult.state !== 'locked' && i < ULT_COST ? 'ult-seg' : ''}`}>
            {isMark && <i className="ae-ult">奧義</i>}
          </span>
        );
      })}
      <span className="ae-num">{total}<small>/10</small></span>
      <span className={`ae-gain ${loan ? 'loan' : ''}`}>{loan ? `每回合 +${2 - loan.n}（償還預支，剩 ${loan.turns} 回合）` : '每回合 +2'}</span>
      {ult && (
        <button
          className={`ae-ultchip ${ult.state}`}
          onClick={(e) => { e.stopPropagation(); explainUlt(e.currentTarget, ult); }}
          onMouseEnter={(e) => explainUlt(e.currentTarget, ult)}
          onMouseLeave={() => showPop(null)}
        >
          <Icon name="ultimate" size={13} />
          {ult.state === 'locked' ? (
            <span>奧義 <small>階段 III</small></span>
          ) : ult.state === 'used' ? (
            <span>奧義 <small>已使用</small></span>
          ) : ult.state === 'ready' ? (
            <span>奧義 <b>可發動！</b></span>
          ) : (
            <span>
              奧義 <b>{ult.aether}</b><small>/{ULT_COST}</small>
              <i className="uc-bar"><i style={{ width: `${(ult.aether / ULT_COST) * 100}%` }} /></i>
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/** Charge progress on the ultimate card: 5 pips, lit up to the current aether */
function UltCharge({ value }: { value: number }) {
  return (
    <div className="ult-charge" aria-label={`奧義蓄能 ${value}/${ULT_COST}`}>
      {Array.from({ length: ULT_COST }, (_, i) => (
        <i key={i} className={i < value ? 'on' : ''} />
      ))}
    </div>
  );
}

type Tip = { skill: string; est?: { dmg: number; foeHp: number; eff: number } } | { title: string; text: string; icon?: string; color?: string; extra?: string[] };

function TipBox({ tip }: { tip: Tip }) {
  if ('skill' in tip) {
    return (
      <div className="tooltip skill-tip">
        <SkillInfo id={tip.skill} est={tip.est} />
      </div>
    );
  }
  return (
    <div className="tooltip" style={{ ['--c' as string]: tip.color ?? '#ffd978' }}>
      <div className="tt-head">
        {tip.icon && <span className="tt-ico"><Icon name={tip.icon} size={14} /></span>}
        <b>{tip.title}</b>
      </div>
      <div className="tt-text"><RichText text={tip.text} /></div>
      {tip.extra?.map((t, i) => <div key={i} className="tt-text hud-tip-extra"><RichText text={t} /></div>)}
    </div>
  );
}

/** Hints for the first time each mechanic comes up (each appears only once, recorded in the save) */
const MECHANIC_TIPS: { key: string; title: string; icon: string; text: string; when: (ctl: BattleController) => boolean }[] = [
  {
    key: 'tip-trap',
    title: '伏技',
    icon: 'trap',
    text: '先點選伏技將其設置於場上，再選擇本回合的技能。敵方符合發動條件時，伏技會自動發動。',
    when: (c) => c.battle.active(0).skills.some((id) => getSkill(id).category === 'trap') && !c.battle.side(0).trap,
  },
  {
    key: 'tip-ult',
    title: '奧義',
    icon: 'ultimate',
    text: '靈能已達 5 點，奧義可以發動了！第三階段精靈的必殺技，每場戰鬥限用一次。',
    when: (c) => !!c.battle.active(0).ultimate && !c.battle.side(0).ultUsed && c.battle.side(0).aether >= 5,
  },
  {
    key: 'tip-ult-charge',
    title: '累積靈能',
    icon: 'ultimate',
    text: '這隻精靈可以使用奧義。靈能條第 5 格的「奧義」刻度是門檻，右邊的「奧義 3/5」與奧義卡下方的五格進度會顯示還差多少。靈能每回合 +2；用 0 費技能或「冥想」可以更快存滿。',
    when: (c) => !!c.battle.active(0).ultimate && !c.battle.side(0).ultUsed && c.battle.side(0).aether < 5,
  },
  {
    key: 'tip-ult-locked',
    title: '奧義尚未解鎖',
    icon: 'ultimate',
    text: '教學戰裡的奧義是星門借來的力量。平常，技能列最右側的金色奧義卡要等精靈第二次突破（Lv 40）後才能使用；靈能條旁的「奧義」會標示目前狀態。',
    when: (c) => !c.battle.active(0).ultimate && c.battle.s.turn >= 1,
  },
  {
    key: 'tip-art',
    title: '戰技',
    icon: 'art',
    text: '締約者的專屬技能，每場戰鬥限用一次，可與技能同時使用。',
    when: (c) => !!c.battle.side(0).art && !c.battle.side(0).artUsed && c.battle.s.turn >= 1,
  },
  {
    key: 'tip-capture',
    title: '捕捉',
    icon: 'stone',
    text: '敵方精靈生命越低、處於異常狀態時，捕捉成功率越高。點選「捕捉」可查看各契約石的成功率。',
    when: (c) => c.setup.kind === 'wild' && c.battle.active(1).hp / c.battle.active(1).maxHp < 0.6 && c.stones.basic + c.stones.advanced + c.stones.master > 0,
  },
  {
    key: 'tip-switch',
    title: '替換',
    icon: 'swap',
    text: '將場上精靈換成後備精靈。替換會最先執行，但會佔用本回合的行動。',
    when: (c) => c.battle.active(0).hp / c.battle.active(0).maxHp < 0.35 && c.battle.canSwitch(0).ok,
  },
  {
    key: 'tip-status',
    title: '異常狀態',
    icon: 'burn',
    text: '精靈頭像下方的圖示代表異常狀態與能力變化，右下角數字為剩餘回合。點選圖示可查看效果。',
    when: (c) => [0, 1].some((i) => Object.keys(c.battle.active(i as 0 | 1).status).length > 0 || Object.values(c.battle.active(i as 0 | 1).stages).some((x) => x !== 0)),
  },
  {
    key: 'tip-type',
    title: '屬性剋制',
    icon: 'up',
    text: '技能卡上的綠色 ▲ 代表屬性剋制，傷害 ×1.5；灰色 ▼ 代表被抵抗，傷害 ×0.75。完整相剋關係請見右上角「?」說明。',
    when: (c) => { const f = c.battle.active(1); return c.battle.active(0).skills.some((id) => { const sk = getSkill(id); return isAttack(sk) && typeMultiplier(sk.element, f.elements) !== 1; }); },
  },
  {
    key: 'tip-field',
    title: '場地',
    icon: 'field',
    text: '場地持續數回合，同屬性技能威力提升 30%，並附帶特殊效果。',
    when: (c) => !!c.battle.s.field,
  },
  {
    key: 'tip-mechanic',
    title: '專屬機制',
    icon: 'art',
    text: '每隻精靈都有自己的專屬機制：名牌下方的金色標籤就是它，點一下可以看說明；機制的層數與倒數會以標記顯示在旁邊，右下角數字是剩餘回合。',
    when: (c) => !!c.battle.active(0).species.mechanic && c.battle.s.turn >= 1,
  },
  {
    key: 'tip-guard',
    title: '格擋',
    icon: 'shield',
    text: '「格擋」是系統行動，不佔技能欄：消耗 1 靈能、先制 +3，本回合免疫攻擊與奧義的傷害。對手蓄滿奧義或準備大招時使用；不能連續兩回合格擋。',
    when: (c) => c.battle.s.turn >= 2 && c.battle.canGuard(0).ok,
  },
];

function MechanicTip({ ctl }: { ctl: BattleController }) {
  const { save } = useStore();
  const tip = MECHANIC_TIPS.find((t) => !save.seenStory.includes(t.key) && t.when(ctl));
  if (!tip) return null;
  return (
    <div className="mech-tip panel">
      <div className="mt-title"><span className="tt-ico"><Icon name={tip.icon} size={14} /></span>{tip.title}</div>
      <div className="mt-text"><RichText text={tip.text} /></div>
      <button className="btn small gold" onClick={() => { sfx.click(); store.mutate((d) => d.seenStory.push(tip.key)); }}>
        了解
      </button>
    </div>
  );
}
