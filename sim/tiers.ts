// Rarity tier simulation: same level, default loadout, AI-vs-AI 1v1 round robin, to see whether win rate runs SSR > SR > R > N.
// Usage: npm run tiers -- [--lv 60] [--seeds 2] [--top 8]
// Each pair of spirits fights seeds × 2 games (random seeds swap who moves first). More spirits means slower (66 spirits with seeds 2 is about 10,000 games).

import { SPIRITS, stageForLevel } from '../src/data.ts';
import { Battle } from '../src/engine/battle.ts';
import { chooseAction } from '../src/engine/ai.ts';
import { defaultLoadout } from '../src/game/loadout.ts';
import type { SpiritInstance } from '../src/engine/types.ts';
import type { Rarity } from './types.ts';

const args = process.argv.slice(2);
const flag = (k: string, d: number) => {
  const i = args.indexOf(k);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const level = flag('--lv', 60);
const seeds = flag('--seeds', 2);
const top = flag('--top', 8);

const inst = (id: string, uid: string): SpiritInstance => ({ uid, speciesId: id, level, exp: 0, stage: stageForLevel(level), resonance: 0, loadout: defaultLoadout(id, level) });

/** 1v1, returns the winner 0 / 1 / 'draw' */
function duel(a: string, b: string, seed: number): 0 | 1 | 'draw' {
  const bt = Battle.create({ kind: 'trainer', seed, maxTurns: 30, sides: [{ name: 'A', spirits: [inst(a, 'a')], isAI: true }, { name: 'B', spirits: [inst(b, 'b')], isAI: true }] });
  bt.start();
  let n = 0;
  while (bt.s.winner === null && n++ < 40) bt.resolveTurn([chooseAction(bt, 0, { skill: 0.9 }), chooseAction(bt, 1, { skill: 0.9 })]);
  return bt.s.winner ?? 'draw';
}

const score = new Map<string, { w: number; n: number }>(SPIRITS.map((s) => [s.id, { w: 0, n: 0 }]));
const vsRarity = new Map<string, { w: number; n: number }>();
const t0 = Date.now();
let games = 0;
for (let i = 0; i < SPIRITS.length; i++) {
  for (let j = i + 1; j < SPIRITS.length; j++) {
    const A = SPIRITS[i];
    const B = SPIRITS[j];
    for (let s = 0; s < seeds; s++) {
      for (const [x, y] of [[A, B], [B, A]] as const) {
        const r = duel(x.id, y.id, 1000 + games);
        games++;
        const px = r === 'draw' ? 0.5 : r === 0 ? 1 : 0;
        score.get(x.id)!.w += px;
        score.get(x.id)!.n++;
        score.get(y.id)!.w += 1 - px;
        score.get(y.id)!.n++;
        const key = `${x.rarity}>${y.rarity}`;
        const v = vsRarity.get(key) ?? { w: 0, n: 0 };
        v.w += px;
        v.n++;
        vsRarity.set(key, v);
      }
    }
  }
}

const RARITIES: Rarity[] = ['SSR', 'SR', 'R', 'N'];
const pct = (w: number, n: number) => (n ? `${((w / n) * 100).toFixed(1)}%` : 'N/A');
console.log(`Lv ${level}, ${SPIRITS.length} spirits in a 1v1 round robin, ${games} games, ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
console.log('Rarity    Win%   Count');
for (const r of RARITIES) {
  const list = SPIRITS.filter((s) => s.rarity === r);
  const w = list.reduce((a, s) => a + score.get(s.id)!.w, 0);
  const n = list.reduce((a, s) => a + score.get(s.id)!.n, 0);
  console.log(`${r.padEnd(6)}  ${pct(w, n).padStart(6)}   ${list.length}`);
}
console.log('\nWin rate (row vs column)');
console.log(`       ${RARITIES.map((r) => r.padStart(7)).join('')}`);
for (const a of RARITIES) {
  const row = RARITIES.map((b) => {
    const x = vsRarity.get(`${a}>${b}`) ?? { w: 0, n: 0 };
    const y = vsRarity.get(`${b}>${a}`) ?? { w: 0, n: 0 };
    return pct(x.w + (y.n - y.w), x.n + y.n).padStart(7);
  });
  console.log(`${a.padEnd(6)} ${row.join('')}`);
}
const ranked = [...SPIRITS].sort((a, b) => score.get(b.id)!.w / score.get(b.id)!.n - score.get(a.id)!.w / score.get(a.id)!.n);
const show = (s: (typeof SPIRITS)[number]) => `${s.id.padEnd(17)} ${s.rarity.padEnd(3)} ${pct(score.get(s.id)!.w, score.get(s.id)!.n)}`;
console.log(`\nTop ${top}`);
for (const s of ranked.slice(0, top)) console.log(`  ${show(s)}`);
console.log(`Bottom ${top}`);
for (const s of ranked.slice(-top)) console.log(`  ${show(s)}`);
const inverted = SPIRITS.filter((s) => s.rarity === 'SSR' && score.get(s.id)!.w / score.get(s.id)!.n < 0.5);
if (inverted.length) console.log(`\nSSR below 50% win rate: ${inverted.map((s) => s.id).join(', ')}`);
