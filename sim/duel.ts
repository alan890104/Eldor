// Text duel: have a spirit fight an opponent with AI on both sides and print the battle log. Used when designing kits to see how the skills actually work.
// Usage: npm run duel -- <spirit> [opponent] [--lv 55] [--seed 1] [--team] [--skills a,b,c,d] [--foe-skills a,b]
//   --team         3 spirits per side (the rest random)
//   --skills       set our skill slots (default = the default loadout)
//   --quiet        print only the result

import { getSkill, getSpirit, SPIRITS, stageForLevel } from '../src/data.ts';
import { Battle } from '../src/engine/battle.ts';
import { chooseAction, chooseReplacement } from '../src/engine/ai.ts';
import { defaultLoadout } from '../src/game/loadout.ts';
import type { BattleEvent, SideId, SpiritInstance } from '../src/engine/types.ts';
import { mulberry32 } from './formulas.ts';

const args = process.argv.slice(2);
const flag = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--team', '--quiet'].includes(args[i - 1])));
if (!pos[0]) {
  console.log('Usage: npm run duel -- <spirit id> [foe id] [--lv 55] [--seed 1] [--team] [--skills a,b,c,d] [--foe-skills a,b] [--quiet]');
  process.exit(1);
}
const level = Number(flag('--lv') ?? 55);
const seed = Number(flag('--seed') ?? 1);
const rng = mulberry32(seed);
const randomSpirit = (not: string[]) => {
  const pool = SPIRITS.filter((s) => !not.includes(s.id));
  return pool[Math.floor(rng() * pool.length)].id;
};
const me = getSpirit(pos[0]).id;
const foe = pos[1] ? getSpirit(pos[1]).id : randomSpirit([me]);
const make = (id: string, uid: string, loadout?: string): SpiritInstance => ({
  uid,
  speciesId: id,
  level,
  exp: 0,
  stage: stageForLevel(level),
  resonance: 0,
  loadout: loadout ? loadout.split(',') : defaultLoadout(id, level),
});
const a = [make(me, 'a0', flag('--skills'))];
const b = [make(foe, 'b0', flag('--foe-skills'))];
if (args.includes('--team')) {
  for (let i = 1; i < 3; i++) {
    a.push(make(randomSpirit([me, foe]), `a${i}`));
    b.push(make(randomSpirit([me, foe]), `b${i}`));
  }
}

const bt = Battle.create({ kind: 'trainer', seed, sides: [{ name: 'You', spirits: a, isAI: true, art: null }, { name: 'Foe', spirits: b, isAI: true, art: null }] });
const quiet = args.includes('--quiet');
const who = (e: BattleEvent, side: SideId) => {
  const sd = e.view.sides[side];
  return `${sd.team[sd.active].name} (${side === 0 ? 'you' : 'foe'})`;
};
const STATUS: Record<string, string> = { burn: 'Burn', poison: 'Poison', bleed: 'Bleed', freeze: 'Freeze', sleep: 'Sleep', fear: 'Fear', paralyze: 'Paralysis', root: 'Root', silence: 'Silence', taunt: 'Taunt', curse: 'Curse' };
const STAT: Record<string, string> = { atk: 'Attack', mag: 'Magic Power', def: 'Defense', res: 'Resistance', spd: 'Speed' };

function line(e: BattleEvent): string | null {
  switch (e.k) {
    case 'turn':
      return e.turn === 0 ? null : `── Turn ${e.turn} ──  Aether ${e.view.sides[0].aether}:${e.view.sides[1].aether}`;
    case 'switchIn':
      return `${who(e, e.side)} enters (${e.view.sides[e.side].team[e.idx].hp}/${e.view.sides[e.side].team[e.idx].maxHp})`;
    case 'use':
      return `${who(e, e.side)} uses [${getSkill(e.skillId).name}]${e.ult ? ' (ultimate)' : ''}${e.copied ? ' (copied)' : ''}`;
    case 'hit': {
      const t = e.view.sides[e.target].team[e.view.sides[e.target].active];
      return `  → ${e.dmg + e.shieldDmg} damage${e.hits > 1 ? ` (${e.hitIndex}/${e.hits})` : ''}${e.crit ? ' crit' : ''}${e.eff > 1 ? ' effective' : e.eff < 1 ? ' resisted' : ''}  ${t.name} ${t.hp}/${t.maxHp}${e.ko ? ' fainted' : ''}`;
    }
    case 'damage':
      return `  ${who(e, e.target)} takes ${e.dmg} (${e.reason})`;
    case 'heal':
      return `  ${who(e, e.target)} heals ${e.amount}`;
    case 'status':
      return `  ${who(e, e.target)} is afflicted with "${STATUS[e.status]}"${e.stacks ? ` ×${e.stacks}` : ''}`;
    case 'stat':
      return `  ${who(e, e.target)} ${STAT[e.stat]} ${e.delta > 0 ? '+' : ''}${e.delta}`;
    case 'trapSet':
      return `  ${e.side === 0 ? 'Your side' : 'Foe side'} sets a trap (${getSkill(e.skillId).name})`;
    case 'trap':
      return `  ★ ${e.side === 0 ? 'Your side' : 'Foe side'} trap [${getSkill(e.skillId).name}] triggers (chain ${e.chain})`;
    case 'negate':
      return `  [${getSkill(e.skillId).name}] is negated`;
    case 'guarded':
      return `  ${who(e, e.side)}: ${e.broke ? 'Guard broken' : 'Guard holds'}`;
    case 'miss':
      return '  miss';
    case 'fail':
      return `  ${who(e, e.side)}: ${e.reason}`;
    case 'resist':
      return `  ${who(e, e.target)}: ${e.reason}`;
    case 'trait':
      return `  Trait: ${e.name}`;
    case 'field':
      return e.element ? `  Field: ${e.element} (${e.turns} turns)` : '  Field ends';
    case 'shield':
      return `  ${who(e, e.target)} shield ${e.amount}`;
    case 'charges':
      return `  ${who(e, e.target)} Electric Charge ${e.value}`;
    case 'text':
      return `  ${e.text}`;
    case 'end':
      return `== ${e.winner === 'draw' ? 'Draw' : e.winner === 0 ? 'You win' : 'Foe wins'} ==`;
    default:
      return null;
  }
}

const print = (evs: BattleEvent[]) => {
  if (quiet) return;
  for (const e of evs) {
    const l = line(e);
    if (l) console.log(l);
  }
};
console.log(`${getSpirit(me).name} (${a[0].loadout.join(', ')}) vs ${getSpirit(foe).name} (${b[0].loadout.join(', ')}) Lv ${level} seed ${seed}`);
print(bt.start());
let n = 0;
while (bt.s.winner === null && n++ < 60) {
  print(bt.resolveTurn([chooseAction(bt, 0, { skill: 0.9 }), chooseAction(bt, 1, { skill: 0.9 })]));
  const ch: [number | null, number | null] = [null, null];
  for (const id of [0, 1] as SideId[]) if (bt.needsReplacement(id)) ch[id] = chooseReplacement(bt, id);
  if (ch[0] !== null || ch[1] !== null) print(bt.replace(ch));
}
console.log(`Result: ${bt.s.winner === 'draw' ? 'draw' : bt.s.winner === 0 ? 'you win' : 'foe wins'} (${bt.s.turn} turns)`);
