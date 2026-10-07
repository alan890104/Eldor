import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnedSkills, SKILLS, SPIRITS } from '../data.ts';
import { Battle } from './battle.ts';
import { chooseAction, chooseReplacement } from './ai.ts';
import { defaultLoadout } from '../game/loadout.ts';
import type { SideId, SpiritInstance } from './types.ts';
import { mulberry32 } from '../../sim/formulas.ts';

function team(rng: () => number, n: number, level: number, tag: string): SpiritInstance[] {
  const out: SpiritInstance[] = [];
  const pool = [...SPIRITS];
  for (let i = 0; i < n; i++) {
    const sp = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    out.push({
      uid: `${tag}${i}`,
      speciesId: sp.id,
      level,
      exp: 0,
      stage: level >= 40 ? 3 : level >= 20 ? 2 : 1,
      resonance: 0,
      loadout: defaultLoadout(sp.id, level),
    });
  }
  return out;
}

export function runBattle(seed: number, level = 60) {
  const rng = mulberry32(seed);
  const b = Battle.create({
    kind: 'trainer',
    seed,
    sides: [
      { name: 'A', spirits: team(rng, 3, level, 'a'), isAI: true, art: 'oath_break' },
      { name: 'B', spirits: team(rng, 3, level, 'b'), isAI: true, art: 'eye_insight' },
    ],
  });
  let events = b.start().length;
  let guard = 0;
  while (b.s.winner === null && guard++ < 100) {
    events += b.resolveTurn([chooseAction(b, 0), chooseAction(b, 1)]).length;
    const ch: [number | null, number | null] = [null, null];
    for (const id of [0, 1] as SideId[]) if (b.needsReplacement(id)) ch[id] = chooseReplacement(b, id);
    if (ch[0] !== null || ch[1] !== null) events += b.replace(ch).length;
  }
  return { b, events };
}

test('400 AI battles all end normally', () => {
  let turns = 0;
  const wins = new Map<string, [number, number]>();
  for (let seed = 1; seed <= 400; seed++) {
    const { b } = runBattle(seed, seed % 2 ? 60 : 25);
    assert.notEqual(b.s.winner, null, `seed ${seed} did not end`);
    assert.ok(b.s.turn <= 30);
    turns += b.s.turn;
    for (const id of [0, 1] as SideId[]) {
      for (const c of b.side(id).team) {
        const w = wins.get(c.species.id) ?? [0, 0];
        w[1]++;
        if (b.s.winner === id) w[0]++;
        wins.set(c.species.id, w);
      }
    }
  }
  const avg = turns / 400;
  assert.ok(avg > 4 && avg < 20, `average turns ${avg}`);
  if (process.env.SHOW_WINRATE) {
    console.log('average turns', avg.toFixed(1));
    [...wins.entries()]
      .sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1])
      .forEach(([id, [w, n]]) => console.log(id.padEnd(18), ((w / n) * 100).toFixed(0) + '%', n));
  }
});

test('The default loadout of every spirit has a 0-cost attack and is filled as far as possible', () => {
  for (const sp of SPIRITS) {
    for (const lv of [1, 5, 20, 60]) {
      const lo = defaultLoadout(sp.id, lv).map((id) => SKILLS.find((s) => s.id === id)!);
      const learned = learnedSkills(sp, lv);
      assert.ok(lo.length >= Math.min(4, learned.length) && lo.length <= 4, `${sp.id} ${lv}: ${lo.length}/${learned.length}`);
      assert.ok(lo.every((s) => learned.includes(s.id)), `${sp.id} ${lv} carries a skill it has not learned`);
      assert.ok(lo.some((s) => s.cost === 0 && s.power > 0), `${sp.id} ${lv} has no 0-cost attack`);
    }
  }
});
