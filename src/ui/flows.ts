// Game flows: new game, Seal Tower stages, field encounters, the Arena, post-battle results. Kept apart from the screen components for readability.

import type { BattleResult, BattleSetup } from '../battle/controller.ts';
import { getSkill, getSpirit, learnedSkills, stageForLevel } from '../data.ts';
import { isAttack, skillCost } from '../engine/battle.ts';
import type { SpiritInstance } from '../engine/types.ts';
import { ARENA } from '../game/arena.ts';
import { AFTER_TUTORIAL, FIRST_CONTRACT, PURIFY_JOIN, PURIFY_LEAVE, PURIFY_NOSTONE, REGIONS, type Line, type Reward } from '../game/campaign.ts';
import type { RegionId } from '../render/arena.ts';
import { defaultLoadout } from '../game/loadout.ts';
import { FIRST_PARTNER, signFirstContract as signContract, stageTeam } from '../game/opening.ts';
import { applyReward, battleExpFor, giveExp, type LevelGain } from '../game/progression.ts';
import { wildReward, type WildSpawn } from '../game/field.ts';
import { addSpirit, markSeen, partySpirits } from '../game/save.ts';
import { tutorialFoeAction, TUTORIAL_FOE, TUTORIAL_SEED, TUTORIAL_ULT_BOOST } from '../game/tutorial.ts';
import { sfx } from '../audio/sfx.ts';
import { store } from './store.ts';

let enemySeq = 1;

function enemyInst(speciesId: string, level: number, corrupted = false): SpiritInstance {
  return {
    uid: `e${enemySeq++}`,
    speciesId,
    level,
    exp: 0,
    stage: stageForLevel(level),
    resonance: 0,
    loadout: defaultLoadout(speciesId, level),
    corrupted,
  };
}

function playerTeam(normalize = false) {
  const s = store.save;
  return { name: s.playerName, isAI: false, art: s.art, spirits: partySpirits(s).map((x) => ({ ...x, loadout: [...x.loadout] })), normalize };
}

// ───────────────────────── Story ─────────────────────────

export function showStory(lines: Line[] | undefined, bg: RegionId, next: () => void): void {
  if (!lines || lines.length === 0) {
    next();
    return;
  }
  store.go({ name: 'story', lines, bg, next });
}

/** Prologue animation (the origin of the world): next runs whether it is watched or skipped */
export function showPrologue(next: () => void): void {
  store.go({ name: 'prologue', next });
}

// ───────────────────────── Tutorial flow ─────────────────────────
// Opening story → form a pact with the First Pact dragon → tutorial battle (script in game/tutorial.ts) → Pact Tickets → first Star Gate Summon

/** After the opening story: form a pact with the First Pact dragon, Eldarin, then go into the tutorial battle */
export function signFirstContract(): void {
  sfx.fanfare(false);
  store.mutate((d) => void signContract(d));
  store.showToast('契約成立：初契之龍・艾爾達林');
  showStory(FIRST_CONTRACT, 'hub', startTutorialBattle);
}

/** Skills for the old tutorial spirit (used when an old save is stuck at the tutorial battle): keeps only 0-cost attacks and status skills that neither deal damage nor heal */
function gentleLoadout(speciesId: string, level: number): string[] {
  const picks = learnedSkills(getSpirit(speciesId), level).filter((id) => {
    const sk = getSkill(id);
    const t = sk.tags as Record<string, number>;
    if (isAttack(sk)) return sk.category !== 'ultimate' && skillCost(sk) === 0;
    return sk.category === 'status' && !Object.keys(t).some((k) => k.startsWith('status.') || ['trueDamage', 'heal', 'teamHeal', 'regen', 'drain'].includes(k));
  });
  return picks.some((id) => isAttack(getSkill(id))) ? picks.slice(0, 4) : defaultLoadout(speciesId, level);
}

export function startTutorialBattle(): void {
  // New save: the scripted battle fought with Eldarin: Sigil Claw → Oath Flame → bank aether → guard → True Name (ultimate) → capture.
  // Neither side can be knocked out and the battle seed is fixed; the Star Gate resonance makes it call out its True Name early and doubles the ultimate's power; Cloudfluff acts to the script, and the tutorial prompts lock the other buttons.
  // An old save (with the pick-one-of-three starter partner) stuck at the tutorial battle keeps the old version: attack → ultimate → capture, partner stats ×1.2.
  const scripted = partySpirits(store.save)[0]?.speciesId === FIRST_PARTNER;
  const stones = { ...store.save.inv.stones, basic: Math.max(1, store.save.inv.stones.basic) };
  const team = playerTeam();
  const setup: BattleSetup = scripted
    ? {
        kind: 'wild',
        region: 'hub',
        enemyName: '野生精靈',
        aiSkill: 0.2,
        seed: TUTORIAL_SEED,
        player: { ...team, spirits: team.spirits.slice(0, 1), awaken: true, ultBoost: TUTORIAL_ULT_BOOST, tutorial: true },
        blessing: { name: '星門共鳴', text: '星門還亮著，這一戰艾爾達林可以使出奧義。打完這一戰就不行了' },
        enemy: { name: '野生精靈', isAI: true, tutorial: true, boost: TUTORIAL_FOE.boost, hpBoost: TUTORIAL_FOE.hpBoost, spirits: [{ ...enemyInst(TUTORIAL_FOE.speciesId, TUTORIAL_FOE.level), loadout: [...TUTORIAL_FOE.loadout] }] },
        foeScript: tutorialFoeAction,
        stones,
      }
    : {
        kind: 'wild',
        region: 'hub',
        enemyName: '野生精靈',
        aiSkill: 0.2,
        player: { ...team, awaken: true, boost: 1.2 },
        blessing: { name: '星門共鳴', text: '星門還亮著，這一戰夥伴會變強，也可以使出奧義。打完這一戰就不行了' },
        enemy: { name: '野生精靈', isAI: true, tutorial: true, spirits: [{ ...enemyInst('cloudfluff', 5), loadout: gentleLoadout('cloudfluff', 5) }] },
        stones,
      };
  // The dialogue after the tutorial battle has lines for Eldarin; an old save doesn't have it, so skip those lines
  const after = scripted ? AFTER_TUTORIAL : AFTER_TUTORIAL.filter((l) => l.who !== '艾爾達林');
  store.go({
    name: 'battle',
    setup,
    tutorial: true,
    onEnd: (r) => {
      const beaten = r.capturedSpirit ? [r.capturedSpirit] : r.defeated;
      const gains = partySpirits(store.save).map((s) => giveExp(s, battleExpFor(s, beaten, false) + 60));
      let captured: { speciesId: string; level: number; kind: string } | null = null;
      store.mutate((d) => {
        d.inv.tickets += 20;
        d.tutorial = 'summon';
        for (const e of setup.enemy.spirits) markSeen(d, e.speciesId);
        for (const [k, v] of Object.entries(r.stonesUsed)) d.inv.stones[k as 'basic'] = Math.max(0, d.inv.stones[k as 'basic'] - v);
        if (r.capturedSpirit) {
          d.stats.captures++;
          captured = { ...r.capturedSpirit, kind: addSpirit(d, r.capturedSpirit.speciesId, r.capturedSpirit.level).kind };
        }
      });
      store.go({
        name: 'result',
        info: {
          result: r,
          title: r.captured ? '契約成立！' : r.winner === 0 ? '首戰勝利！' : '戰鬥結束',
          subtitle: '初次戰鬥',
          gains,
          reward: { gold: 0, tickets: 20 },
          captured,
          firstClear: false,
          next: () => showStory(after, 'hub', () => store.go({ name: 'summon', tutorial: true })),
        },
      });
    },
  });
}

/** Continue the adventure: if the tutorial wasn't finished (e.g. refreshed midway), pick up from the step where it broke off, so the Pact Tickets aren't missed */
export function continueGame(): void {
  const t = store.save.tutorial;
  if (t === 'battle') startTutorialBattle();
  else if (t === 'summon') store.go({ name: 'summon', tutorial: true });
  else store.go({ name: 'hub' });
}

// ───────────────────────── Stages ─────────────────────────

const FINALE_BOOST = 1.12;

export function stageSetup(regionIdx: number, stageIdx: number): BattleSetup {
  const region = REGIONS[regionIdx];
  const st = region.stages[stageIdx];
  let spirits: SpiritInstance[];
  if (st.team) {
    spirits = stageTeam(st, store.save.starter).map((t) => enemyInst(t.speciesId, t.level, t.corrupted));
  } else {
    const pool = st.pool ?? ['cloudfluff'];
    const id = pool[Math.floor(Math.random() * pool.length)];
    spirits = [enemyInst(id, st.level, st.corruptedWild)];
  }
  const s = store.save;
  // Final battle: Nova blesses the Pactbearer with the power of the Primal Heart
  const finale = region.id === 'rift' && st.kind === 'boss';
  return {
    kind: st.kind === 'wild' ? 'wild' : 'trainer',
    region: region.id,
    enemyName: st.enemyName,
    aiSkill: st.aiSkill,
    player: { ...playerTeam(), boost: finale ? FINALE_BOOST : 1 },
    blessing: finale ? { name: '世界之心的加護', text: `諾娃的祝福：全隊能力 +${Math.round((FINALE_BOOST - 1) * 100)}%` } : undefined,
    enemy: { name: st.enemyName, isAI: true, art: st.art ?? null, spirits },
    stones: st.kind === 'wild' ? { ...s.inv.stones } : undefined,
    boss: st.kind === 'boss',
    music: finale ? 'final' : st.kind === 'wild' ? `wild:${region.id}` : st.kind,
  };
}

export function playStage(regionIdx: number, stageIdx: number): void {
  const region = REGIONS[regionIdx];
  const st = region.stages[stageIdx];
  const firstClear = !store.save.cleared[st.id];
  const go = () => {
    const setup = stageSetup(regionIdx, stageIdx);
    store.go({
      name: 'battle',
      setup,
      onEnd: (r) => afterBattle(r, setup, st.name, firstClear ? st.reward : { gold: Math.floor(st.reward.gold * 0.4) }, firstClear, () => {
        if (r.winner === 0) {
          store.mutate((d) => (d.cleared[st.id] = (d.cleared[st.id] ?? 0) + 1));
          const after = firstClear ? st.after : undefined;
          const isFinal = region.id === 'rift' && stageIdx === region.stages.length - 1;
          showStory(after, region.id, () => {
            if (isFinal && firstClear) {
              store.mutate((d) => (d.ending = true));
              store.go({ name: 'ending' });
            } else store.go({ name: 'tower', idx: regionIdx });
          });
        } else store.go({ name: 'tower', idx: regionIdx });
      }),
    });
  };
  const foes = st.team
    ? stageTeam(st, store.save.starter).map((t) => ({ speciesId: t.speciesId, level: t.level, stage: stageForLevel(t.level) }))
    : (st.pool ?? []).map((id) => ({ speciesId: id, level: st.level, stage: stageForLevel(st.level) }));
  store.go({
    name: 'party',
    purpose: 'stage',
    foes,
    foeTitle: st.team ? st.enemyName : '野生精靈（隨機出現其一）',
    onGo: () => (firstClear ? showStory(st.before, region.id, go) : go()),
    back: () => store.go({ name: 'tower', idx: regionIdx }),
  });
}

/** Field encounter: fight the wild spirit that was met (it can be captured); afterwards go back to the field, where lost means a defeat (sent back to town) */
export function fieldBattle(regionIdx: number, w: WildSpawn, back: (lost: boolean) => void): void {
  const region = REGIONS[regionIdx];
  const name = w.corrupted ? '蝕化精靈' : '野生精靈';
  const setup: BattleSetup = {
    kind: 'wild',
    region: region.id,
    enemyName: name,
    aiSkill: w.corrupted ? 0.55 : 0.4,
    player: playerTeam(),
    enemy: { name, isAI: true, spirits: [enemyInst(w.speciesId, w.level, w.corrupted)] },
    stones: { ...store.save.inv.stones },
    music: w.corrupted ? 'corrupt' : `wild:${region.id}`,
  };
  if (getSpirit(w.speciesId).rarity === 'SR') store.showToast('稀有的精靈出現了！');
  store.go({
    name: 'battle',
    setup,
    onEnd: (r) => {
      // Purify: once the corrupted spirit is beaten the void crystal shatters, and the spirit restored to normal may be willing to form a pact (costs one Pact Stone, always succeeds)
      let res = r;
      let purified: string | undefined;
      if (w.corrupted && r.winner === 0 && !r.captured) {
        const st = store.save.inv.stones;
        const stone = st.basic > 0 ? 'basic' : st.advanced > 0 ? 'advanced' : st.master > 0 ? 'master' : null;
        const wants = Math.random() < PURIFY_JOIN_CHANCE && getSpirit(w.speciesId).rarity !== 'SSR';
        if (wants && stone) {
          res = { ...r, captured: true, capturedSpirit: { speciesId: w.speciesId, level: w.level }, stonesUsed: { ...r.stonesUsed, [stone]: r.stonesUsed[stone] + 1 } };
          purified = PURIFY_JOIN;
        } else purified = wants ? PURIFY_NOSTONE : PURIFY_LEAVE;
      }
      afterBattle(res, setup, purified ?? `野外・${region.name}`, wildReward(w), false, () => back(r.winner === 1), !!purified);
    },
  });
}

/** Chance that a purified spirit is willing to form a pact */
const PURIFY_JOIN_CHANCE = 0.6;

export function playArena(rank: number): void {
  const foe = ARENA[rank];
  const first = store.save.arena.best <= rank;
  store.go({
    name: 'party',
    purpose: 'arena',
    cap: 12,
    foes: foe.team.map((id) => ({ speciesId: id, level: 60, stage: 3 as const })),
    foeTitle: `${foe.title}・${foe.name}`,
    back: () => store.go({ name: 'arena' }),
    onGo: () => {
      const setup: BattleSetup = {
        kind: 'arena',
        region: 'arena',
        enemyName: foe.name,
        aiSkill: foe.ai,
        player: playerTeam(true),
        enemy: { name: foe.name, isAI: true, art: foe.art, normalize: true, spirits: foe.team.map((id) => enemyInst(id, 60)) },
      };
      store.go({
        name: 'battle',
        setup,
        onEnd: (r) => {
          const reward: Reward = first && r.winner === 0 ? { ...foe.reward } : { gold: r.winner === 0 ? 300 : 100 };
          const got = r.winner === 0 ? applyRewardSave(reward) : applyRewardSave({ gold: 100 });
          if (r.winner === 0)
            store.mutate((d) => {
              d.arena.best = Math.max(d.arena.best, rank + 1);
              d.stats.wins++;
            });
          store.mutate((d) => foe.team.forEach((id) => markSeen(d, id)));
          store.go({
            name: 'result',
            info: { result: r, title: r.winner === 0 ? '競技場勝利！' : '競技場落敗', subtitle: `${foe.title}・${foe.name}`, gains: [], reward: got, captured: null, firstClear: first && r.winner === 0, next: () => store.go({ name: 'arena' }), advice: { arena: true, foeElements: foe.team.flatMap((id) => getSpirit(id).elements) } },
          });
        },
      });
    },
  });
}

function applyRewardSave(r: Reward): Reward {
  let got: Reward = { gold: 0 };
  store.mutate((d) => (got = applyReward(d, r)));
  return got;
}

function afterBattle(r: BattleResult, setup: BattleSetup, title: string, reward: Reward, firstClear: boolean, next: () => void, purified = false): void {
  const win = r.winner === 0;
  let gains: LevelGain[] = [];
  let got: Reward | null = null;
  let captured: { speciesId: string; level: number; kind: string } | null = null;
  store.mutate((d) => {
    for (const e of setup.enemy.spirits) markSeen(d, e.speciesId);
    const party = partySpirits(d);
    const defeated = win ? r.defeated : r.defeated.map((x) => ({ ...x, level: Math.floor(x.level * 0.5) }));
    gains = party.map((s) => giveExp(s, battleExpFor(s, defeated, !!setup.boss)));
    if (win) got = applyReward(d, reward);
    for (const [k, v] of Object.entries(r.stonesUsed)) d.inv.stones[k as 'basic'] = Math.max(0, d.inv.stones[k as 'basic'] - v);
    if (win) d.stats.wins++;
    if (setup.kind === 'wild' && (title.startsWith('野外') || purified)) d.stats.explores++;
    if (r.capturedSpirit) {
      d.stats.captures++;
      const res = addSpirit(d, r.capturedSpirit.speciesId, r.capturedSpirit.level);
      captured = { ...r.capturedSpirit, kind: res.kind };
    }
  });
  store.go({
    name: 'result',
    info: {
      result: r,
      title: win ? (purified ? '淨化成功！' : r.captured ? '契約成立！' : '勝利！') : '戰敗',
      subtitle: title,
      gains,
      reward: got,
      captured,
      firstClear: win && firstClear,
      next,
      advice: {
        foeLevel: Math.max(...setup.enemy.spirits.map((e) => e.level)),
        foeElements: setup.enemy.spirits.flatMap((e) => getSpirit(e.speciesId).elements),
        regionIdx: Math.max(0, REGIONS.findIndex((x) => x.id === setup.region)),
      },
    },
  });
}

export function currentObjective(): string[] {
  const d = store.save;
  for (const region of REGIONS) {
    const i = region.stages.findIndex((st) => !d.cleared[st.id]);
    if (i >= 0) return [region.name, `伏魔塔第 ${i + 1} 層`];
  }
  return ['主線已完成，可挑戰競技場'];
}
