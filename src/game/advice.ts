// Growth advice: lists "what you can do now to get stronger" from the save state. Shared by the defeat summary, the home city and the pre-battle screen.

import { getSkill, getSpirit, learnedSkills } from '../data.ts';
import { ELEMENT_LABEL, typeMultiplier } from '../../sim/formulas.ts';
import type { Element } from '../../sim/types.ts';
import { PULL_COST, pullsAvailable } from './gachaGame.ts';
import { breakthroughCost, canBreakthrough, hasBreakthroughMaterials, levelCap } from './progression.ts';
import { claimable } from './quests.ts';
import { REGIONS, isRegionUnlocked, isStageUnlocked } from './campaign.ts';
import { partySpirits, type SaveData } from './save.ts';

export type AdviceAction =
  | { to: 'team'; uid?: string; tab?: 'spirits' | 'items' }
  | { to: 'region'; idx: number }
  | { to: 'summon' }
  | { to: 'quests' };

export interface Advice {
  id: string;
  icon: string;
  title: string;
  text: string;
  button: string;
  action: AdviceAction;
  /** Lower comes first (higher priority) */
  weight: number;
}

export interface AdviceContext {
  /** Opponent level (on defeat or before battle) */
  foeLevel?: number;
  foeElements?: Element[];
  /** Current region (used to suggest where to explore) */
  regionIdx?: number;
  /** Arena: levels are flattened, so no leveling advice */
  arena?: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function partyLevel(d: SaveData): number {
  return Math.round(avg(partySpirits(d).map((s) => s.level)));
}

/** The newest stage currently available to challenge */
export function nextStage(d: SaveData): { regionIdx: number; stageIdx: number } | null {
  for (let r = 0; r < REGIONS.length; r++) {
    for (let i = 0; i < REGIONS[r].stages.length; i++) {
      if (!d.cleared[REGIONS[r].stages[i].id] && isStageUnlocked(d.cleared, r, i)) return { regionIdx: r, stageIdx: i };
    }
  }
  return null;
}

/** Regions suited to leveling: the last one among those unlocked whose recommended level is not above the team's level */
function trainingRegion(d: SaveData, prefer?: number): number {
  const lv = partyLevel(d);
  let best = 0;
  REGIONS.forEach((r, i) => {
    if (isRegionUnlocked(d.cleared, i) && r.level <= lv + 2 && r.explore.length > 0) best = i;
  });
  if (prefer !== undefined && isRegionUnlocked(d.cleared, prefer) && REGIONS[prefer].level <= lv + 2) return prefer;
  return best;
}

export function getAdvice(d: SaveData, ctx: AdviceContext = {}): Advice[] {
  const out: Advice[] = [];
  const party = partySpirits(d);
  const lv = partyLevel(d);
  const name = (uid: string) => {
    const s = d.spirits.find((x) => x.uid === uid)!;
    return getSpirit(s.speciesId).name;
  };

  // 1. Breakthrough: once the level cap is reached no more experience is gained; this is the most important hint
  for (const s of party) {
    if (!canBreakthrough(s)) continue;
    const c = breakthroughCost(s);
    if (hasBreakthroughMaterials(d, s)) {
      out.push({ id: `break-${s.uid}`, icon: 'up', title: `突破 ${name(s.uid)}`, text: `已達等級上限 Lv ${levelCap(s)}，突破後能力提升，並可繼續升級。`, button: '前往突破', action: { to: 'team', uid: s.uid }, weight: 0 });
    } else {
      const lack: string[] = [];
      if (d.inv.gold < c.gold) lack.push(`金幣 ${c.gold.toLocaleString()}（持有 ${d.inv.gold.toLocaleString()}）`);
      if (d.inv.breakStones < c.breakStones) lack.push(`突破石 ${c.breakStones}（持有 ${d.inv.breakStones}）`);
      if (d.inv.shards < c.shards) lack.push(`源晶碎片 ${c.shards}（持有 ${d.inv.shards}）`);
      out.push({ id: `breakmat-${s.uid}`, icon: 'up', title: `${name(s.uid)} 需要突破素材`, text: `已達等級上限，無法再獲得經驗。突破需要：${lack.join('、')}。突破石可於蝕化精靈、教團關卡與探索取得。`, button: '前往探索', action: { to: 'region', idx: trainingRegion(d, ctx.regionIdx) }, weight: 1 });
    }
  }

  // 2. Level gap
  const target = ctx.foeLevel ?? (() => {
    const n = nextStage(d);
    return n ? REGIONS[n.regionIdx].stages[n.stageIdx].level : undefined;
  })();
  if (!ctx.arena && target !== undefined && lv < target) {
    const r = trainingRegion(d, ctx.regionIdx);
    out.push({ id: 'level', icon: 'spd', title: '提升隊伍等級', text: `出戰隊伍平均 Lv ${lv}，對手 Lv ${target}。在「${REGIONS[r].name}」探索可反覆遭遇野生精靈，出戰的 3 隻精靈都會獲得經驗值。已通關的關卡也可以重複挑戰。`, button: '前往探索', action: { to: 'region', idx: r }, weight: 2 });
  }

  // 3. Experience potions
  const growable = party.filter((s) => s.level < levelCap(s));
  if (d.inv.potions > 0 && growable.length > 0) {
    out.push({ id: 'potion', icon: 'heal', title: `使用經驗藥水（持有 ${d.inv.potions}）`, text: '在背包的「道具」中選擇精靈使用，可立即獲得大量經驗值。', button: '前往背包', action: { to: 'team', tab: 'items' }, weight: 3 });
  }

  // 4. A reserve spirit is stronger than a deployed one
  const weakest = [...party].sort((a, b) => a.level - b.level)[0];
  const bench = d.spirits.filter((s) => !d.party.includes(s.uid)).sort((a, b) => b.level - a.level)[0];
  if (weakest && bench && bench.level >= weakest.level + 3) {
    out.push({ id: 'bench', icon: 'swap', title: '調整出戰隊伍', text: `後備的 ${name(bench.uid)}（Lv ${bench.level}）比出戰中的 ${name(weakest.uid)}（Lv ${weakest.level}）等級更高。`, button: '調整隊伍', action: { to: 'team', uid: bench.uid }, weight: 4 });
  }

  // 5. Elemental advantage
  if (ctx.foeElements && ctx.foeElements.length > 0) {
    const foeEls = [...new Set(ctx.foeElements)].filter((e) => e !== 'neutral');
    let best: { uid: string; score: number; el: Element } | null = null;
    for (const s of d.spirits) {
      const sp = getSpirit(s.speciesId);
      for (const el of sp.elements) {
        const score = avg(foeEls.map((f) => typeMultiplier(el, [f])));
        if (score > 1 && (!best || score > best.score || (score === best.score && s.level > (d.spirits.find((x) => x.uid === best!.uid)?.level ?? 0)))) best = { uid: s.uid, score, el };
      }
    }
    if (best && foeEls.length > 0) {
      const inParty = d.party.includes(best.uid);
      out.push({
        id: 'type',
        icon: 'up',
        title: '利用屬性相剋',
        text: `對手為${foeEls.map((e) => ELEMENT_LABEL[e]).join('、')}屬性。${ELEMENT_LABEL[best.el]}屬性技能可造成 ×1.5 傷害，${inParty ? `出戰中的 ${name(best.uid)} 可優先使用` : `可將 ${name(best.uid)} 加入出戰`}。`,
        button: inParty ? '查看技能' : '調整隊伍',
        action: { to: 'team', uid: best.uid },
        weight: 5,
      });
    }
  }

  // 6. Open slots in the skill bar
  for (const s of party) {
    const sp = getSpirit(s.speciesId);
    const unused = learnedSkills(sp, s.level).filter((id) => !s.loadout.includes(id) && getSkill(id).category !== 'trap');
    if (s.loadout.length < 4 && unused.length > 0) {
      out.push({ id: `skill-${s.uid}`, icon: 'physical', title: `${name(s.uid)} 的技能欄有空位`, text: `目前攜帶 ${s.loadout.length}/4 個技能，可加入已習得的技能。`, button: '配置技能', action: { to: 'team', uid: s.uid }, weight: 6 });
      break;
    }
  }

  // 7. Summon
  const pulls = pullsAvailable(d);
  if (pulls > 0) {
    const own = [d.inv.tickets > 0 ? `契約券 ${d.inv.tickets} 張` : '', d.inv.crystals >= PULL_COST ? `星輝石 ${d.inv.crystals.toLocaleString()}（每 ${PULL_COST} 召喚 1 次）` : ''].filter(Boolean).join('、');
    out.push({ id: 'summon', icon: 'magic', title: `召喚新精靈（可召喚 ${pulls} 次）`, text: `持有${own}。召喚時先使用契約券，不足的次數以星輝石補足。新精靈會以接近隊伍的等級加入。`, button: '前往召喚', action: { to: 'summon' }, weight: 7 });
  }

  // 8. Quest rewards
  const ready = claimable(d).length;
  if (ready > 0) {
    out.push({ id: 'quest', icon: 'art', title: `領取任務獎勵（${ready} 個）`, text: '已完成的任務可領取金幣、星輝石、契約券等獎勵。', button: '前往任務', action: { to: 'quests' }, weight: 8 });
  }

  return out.sort((a, b) => a.weight - b.weight);
}
