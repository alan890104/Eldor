// Opponent AI: scores every legal action and takes the highest score (with some randomness, more random at lower difficulty).
// Scores look only at skill tags and the state of the battle; to teach the AI a combo for an exclusive skill, add to the score through the skill hook's aiScore (see skillfx.ts).

import { getSkill } from '../data.ts';
import { typeMultiplier } from '../../sim/formulas.ts';
import type { Element, StatusId } from '../../sim/types.ts';
import { Battle, GUARD_COST, isAttack, skillCost, ULT_COST } from './battle.ts';
import { SKILL_FX } from './kits/index.ts';
import { kitHooks, traitHooks } from './traits.ts';
import type { MainAction, SideId, TurnInput } from './types.ts';

/** The best type-effectiveness multiplier a set of skills has against an element combination (1 when there are no skills) */
function maxEff(skills: string[], els: Element[]): number {
  let m = -Infinity;
  for (const s of skills) m = Math.max(m, typeMultiplier(getSkill(s).element, els));
  return m === -Infinity ? 1 : m;
}

export interface AIOptions {
  /** 0 to 1: higher is more accurate */
  skill: number;
}

export function chooseAction(b: Battle, id: SideId, opt: AIOptions = { skill: 0.8 }): TurnInput {
  const me = b.active(id);
  const f = b.foe(id);
  const foe = b.active(f);
  const sd = b.side(id);
  const fsd = b.side(f);
  if (me.charging) return { main: { type: 'skill', skillId: me.charging } };

  const hpPct = me.hp / me.maxHp;
  const foeHpPct = foe.hp / foe.maxHp;
  const options: { main: MainAction; score: number; cost: number }[] = [];
  const noise = () => (b.rng() - 0.5) * (1 - opt.skill) * 60;

  const skills = [...me.skills, ...(me.ultimate ? [me.ultimate] : [])];
  for (const id2 of skills) {
    const sk = getSkill(id2);
    if (sk.category === 'trap') continue;
    if (!b.canUse(id, id2).ok) continue;
    const cost = skillCost(sk);
    let score = 0;
    if (isAttack(sk)) {
      const dmg = b.estimate(id, id2);
      const frac = dmg / Math.max(1, foe.hp);
      score = Math.min(1, frac) * 100;
      if (frac >= 1) score += 60;
      if (sk.category === 'ultimate') score -= frac >= 1 ? 0 : 25;
      for (const [k, v] of Object.entries(sk.tags)) {
        if (k.startsWith('status.') && !foe.status[k.slice(7) as StatusId] && !b.statusBlocked(f, k.slice(7) as StatusId)) score += Math.min(1, v) * 12;
      }
      if (sk.tags.recoil) score -= sk.tags.recoil * 20;
      if (sk.tags.drain) score += (1 - hpPct) * 20;
      if (sk.tags.pivot && hpPct < 0.5) score += 10;
      if (foe.guarding) score -= 30;
      if (sk.tags.ignoreGuard && foe.lastGuardTurn !== b.s.turn && fsd.aether >= 1) score += 4;
      if (sk.tags.charge) score -= 20;
      // Self-KO: the lower the HP, the more willing to use it
      if (sk.tags.selfKO) score -= hpPct * 70 - (b.aliveBench(id).length === 0 ? 40 : 0);
      if (sk.tags.stealStages) score += Object.values(foe.stages).filter((v) => v > 0).reduce((a, v) => a + v, 0) * 12;
      if (sk.tags.bind && !foe.bound) score += 10;
      if (sk.tags.forceSwitch && Object.values(foe.stages).some((v) => v > 0)) score += 15;
      if (sk.tags.aetherPower) score += Math.min(20, sd.aether * 3);
    } else {
      const t = sk.tags;
      if (t.heal || t.shield) {
        const missing = 1 - hpPct;
        score = Math.max(score, missing * ((t.heal ?? 0) + (t.shield ?? 0)) * 1.6);
        if (me.status.curse) score = 0;
      }
      if (t.teamHeal) score = Math.max(score, (1 - hpPct) * 70);
      const selfBuff = Object.entries(t)
        .filter(([k]) => k.startsWith('self.'))
        .reduce((s, [k, v]) => s + (me.stages[k.slice(5) as 'atk'] < 2 ? v : 0), 0);
      if (selfBuff > 0) score = Math.max(score, hpPct > 0.55 ? 18 + selfBuff * 12 : 5);
      if (t.field) {
        const own = me.elements.includes(sk.element);
        score = Math.max(score, b.s.field?.element === sk.element ? 0 : own ? 42 : 20);
      }
      for (const [k] of Object.entries(t)) {
        if (!k.startsWith('status.')) continue;
        const st = k.slice(7) as StatusId;
        const already = (st === 'poison' ? (foe.status.poison?.stacks ?? 0) >= 4 : !!foe.status[st]) || b.statusBlocked(f, st);
        if (!already && foeHpPct > 0.3) score = Math.max(score, st === 'sleep' || st === 'freeze' ? 55 : 40);
      }
      if (t.cleanse || t.teamCleanse) score = Math.max(score, Object.keys(me.status).length * 22);
      if (t.dispel) {
        const buffs = Object.values(foe.stages).filter((v) => v > 0).length + (foe.shield ? 1 : 0);
        score = Math.max(score, buffs * 22);
      }
      if (t.dispelTurns) {
        const own = [...foe.lasting, ...fsd.lasting].filter((l) => l.from === f).length;
        const turnFx = own + (fsd.screens.physTurns > 0 || fsd.screens.magTurns > 0 ? 1 : 0) + (fsd.tailwind > 0 ? 1 : 0) + (foe.regen > 0 ? 1 : 0);
        score = Math.max(score, turnFx * 26);
      }
      // Status skills that restore aether (`meditate`, `aether_infusion`, ...): used when there is not enough aether for an ultimate or a big skill
      if (t.aeGain && !t.aeLoan) {
        score = Math.max(score, sd.aether < ULT_COST ? 20 + t.aeGain * 5 : sd.aether <= 7 ? 10 : 2);
      }
      // Hourglass advance (aether loan): borrow when an ultimate is short of aether; borrow less when already repaying
      if (t.aeLoan) {
        const ultReady = !!me.ultimate && !sd.ultUsed;
        score = Math.max(score, ultReady && sd.aether < ULT_COST ? 40 - sd.aeLoans.length * 15 : sd.aether <= 2 ? 18 : 2);
      }
      if (t.destroyTrap) score = Math.max(score, fsd.trap ? 45 : 8);
      if (t.revealTrap) score = Math.max(score, fsd.trap && !fsd.trap.revealed ? 25 : 0);
      // ── Second batch of mechanics ──
      const bench = b.aliveBench(id).length;
      const foeBench = b.aliveBench(f).length;
      const foeUps = Object.values(foe.stages).filter((v) => v > 0).reduce((a, v) => a + v, 0);
      const myUps = Object.values(me.stages).filter((v) => v > 0).reduce((a, v) => a + v, 0);
      if (t.wish && !sd.wish) score = Math.max(score, (1 - hpPct) * 85);
      if (t.doom && !fsd.doom) score = Math.max(score, foeHpPct > 0.5 ? 40 : 15);
      if (t.decoy) score = Math.max(score, me.decoy > 0 ? 0 : hpPct > 0.5 ? 38 : 5);
      if (t.disable) score = Math.max(score, foe.lastSkill && !foe.disabled ? 34 : 0);
      if (t.invertStages) score = Math.max(score, foeUps * 22);
      if (t.copyStages) score = Math.max(score, foeUps * 18);
      if (t.baton && t.pivot) score = Math.max(score, bench > 0 ? 12 + myUps * 15 : 0);
      else if (t.pivot && bench > 0) score = Math.max(score, hpPct < 0.5 ? 30 : 15);
      if (t.bond) score = Math.max(score, hpPct < 0.3 && me.lastBondTurn !== b.s.turn ? 48 : 0);
      if (t.painSplit) score = Math.max(score, (foeHpPct - hpPct) * 130);
      if (t.perish) score = Math.max(score, !foe.perish && bench > 0 && foeBench === 0 ? 45 : 8);
      if (t.transferStatus) score = Math.max(score, Object.keys(me.status).length * 32);
      if (t.retaliate) score = Math.max(score, hpPct > 0.4 && foe.skills.some((x) => getSkill(x).power > 0) ? 26 : 0);
      if (t.hazard || t.hazardSpd) score = Math.max(score, !fsd.hazard && foeBench > 0 ? 40 : 0);
      if (t.screenPhys || t.screenMag) {
        const on = (t.screenPhys && sd.screens.physTurns > 0) || (t.screenMag && sd.screens.magTurns > 0);
        score = Math.max(score, on ? 0 : 32);
      }
      if (t.healWish) {
        const hurt = sd.team.some((m, i) => i !== sd.active && !m.fainted && m.hp < m.maxHp * 0.5);
        score = Math.max(score, hpPct < 0.25 && hurt ? 50 : 0);
      }
      if (t.expose) score = Math.max(score, foe.exposed >= b.s.turn ? 0 : 30);
    }
    // Extra score the skill hook gives the AI (combos, timing)
    const hint = SKILL_FX[id2]?.aiScore;
    if (hint) score += hint(b, id, score);
    score -= cost * 3;
    options.push({ main: { type: 'skill', skillId: id2 }, score: score + noise(), cost });
  }

  // Guard (system action): when the opponent is predicted to use an ultimate or a big skill (no guarding in the tutorial battle)
  if (b.canGuard(id).ok && !me.tutorial) {
    const threat = fsd.aether >= ULT_COST && !fsd.ultUsed && !!foe.ultimate;
    let big = 0;
    for (const s of [...foe.skills, ...(foe.ultimate && !fsd.ultUsed ? [foe.ultimate] : [])]) {
      if (isAttack(getSkill(s)) && b.canUse(f, s).ok) big = Math.max(big, b.estimate(f, s));
    }
    let score = threat ? 55 : big >= me.hp ? 38 : big >= me.hp * 0.6 ? 24 : 12;
    // Spirits that benefit from a successful guard (Foresight, Knight's Shield, ...) guard more often
    if (traitHooks(me).some((h) => h.onGuarded)) score += 15;
    const guardHint = kitHooks(me)?.aiGuard;
    if (guardHint) score += guardHint(b, id, score);
    const foeGuardHint = foe.fainted ? undefined : kitHooks(foe)?.aiFoeGuard;
    if (foeGuardHint) score += foeGuardHint(b, f, score);
    options.push({ main: { type: 'guard' }, score: score - GUARD_COST * 3 + noise(), cost: GUARD_COST });
  }

  // Switch: considered when at a type disadvantage and low on HP
  if (b.canSwitch(id).ok && hpPct < 0.35 && opt.skill > 0.5) {
    const worst = maxEff(foe.skills, me.elements);
    if (worst > 1) {
      const bench = b.aliveBench(id);
      let best = -1;
      let bestScore = -Infinity;
      for (const i of bench) {
        const c = sd.team[i];
        const risk = maxEff(foe.skills, c.elements);
        const sc = (c.hp / c.maxHp) * 40 - risk * 20;
        if (sc > bestScore) {
          bestScore = sc;
          best = i;
        }
      }
      if (best >= 0) options.push({ main: { type: 'switch', to: best }, score: 30 + noise(), cost: 0 });
    }
  }

  if (options.length === 0) {
    // No usable action: hand in one that fails harmlessly (the engine shows the reason)
    const fallback = me.skills[0] ?? me.ultimate;
    return { main: fallback ? { type: 'skill', skillId: fallback } : { type: 'guard' } };
  }
  options.sort((a, b2) => b2.score - a.score);
  const pick = options[0];
  const input: TurnInput = { main: pick.main };

  // Trap: 55% chance to set one by default; a trap's aiScore can raise or lower the willingness and decide which one to set
  if (!sd.trap) {
    const traps = me.skills.filter((s) => getSkill(s).category === 'trap');
    const reserve = pick.main.type === 'skill' || pick.main.type === 'guard' ? pick.cost : 0;
    const usable = traps.filter((t) => b.canSetTrap(id, t, reserve).ok);
    if (usable.length > 0) {
      let best: string | null = null;
      let bestHint = -Infinity;
      for (const t of usable) {
        const h = SKILL_FX[t]?.aiScore?.(b, id, 0);
        if (h !== undefined && h > bestHint) {
          best = t;
          bestHint = h;
        }
      }
      const bonus = best ? bestHint / 100 : 0;
      if (b.rng() < 0.55 + bonus) input.trap = best ?? usable[Math.floor(b.rng() * usable.length)];
    }
  }

  // Oathbearer art
  if (sd.art && !sd.artUsed && b.s.turn >= 1) {
    const a = sd.art;
    const want =
      (a === 'aether_spring' && sd.aether <= 2) ||
      (a === 'oath_guard' && hpPct < 0.45) ||
      (a === 'light_purify' && Object.keys(me.status).length >= 2) ||
      (a === 'eye_insight' && !!fsd.trap) ||
      (a === 'oath_break' && pick.main.type === 'skill' && getSkill(pick.main.skillId).category === 'ultimate') ||
      (a === 'oath_gale' && foeHpPct < 0.35);
    if (want) input.art = true;
  }
  return input;
}

export function chooseReplacement(b: Battle, id: SideId): number {
  const bench = b.aliveBench(id);
  const foe = b.active(b.foe(id));
  let best = bench[0];
  let bestScore = -Infinity;
  for (const i of bench) {
    const c = b.side(id).team[i];
    const off = maxEff(c.skills, foe.elements);
    const def = maxEff(foe.skills, c.elements);
    const sc = (c.hp / c.maxHp) * 50 + off * 20 - def * 15;
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  }
  return best;
}
