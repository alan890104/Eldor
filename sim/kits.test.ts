// Kit tests: each element group's data/kits/<group>.json and src/engine/kits/<group>.ts.
// Test only your own group: KIT=fire node --test sim/kits.test.ts (list several with commas: KIT=fire,water)
// Rules are in docs/10-kit-authoring.md and sim/kitrules.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUP_OF_SPIRIT, KIT_FILES, KIT_GROUPS, SKILL_BY_ID, SPIRITS, type KitGroup } from './catalog.ts';
import { checkGroupFile, checkKit } from './kitrules.ts';
import { mulberry32 } from './formulas.ts';
import type { SpiritDef } from './types.ts';
import { Battle, fxOf } from '../src/engine/battle.ts';
import { chooseAction, chooseReplacement } from '../src/engine/ai.ts';
import { FX_ERRORS, FX_SOURCE, GROUP_MODULES, KIT_FX } from '../src/engine/kits/index.ts';
import { defaultLoadout } from '../src/game/loadout.ts';
import { stageForLevel } from '../src/data.ts';
import { duel, guard, sw, use, useTestSkills } from '../src/engine/testkit.ts';
import type { SideId, SpiritInstance, TurnInput } from '../src/engine/types.ts';
import type { TrapEventName } from '../src/engine/skillfx.ts';

useTestSkills();

const only = (process.env.KIT ?? '').split(',').map((s) => s.trim()).filter(Boolean);
for (const g of only) if (!(KIT_GROUPS as readonly string[]).includes(g)) throw new Error(`KIT=${g}: no such group (${KIT_GROUPS.join(', ')})`);
const groups: KitGroup[] = only.length ? (only as KitGroup[]) : [...KIT_GROUPS];
const membersOf = (g: KitGroup): SpiritDef[] => SPIRITS.filter((sp) => GROUP_OF_SPIRIT.get(sp.id) === g);

// ───────────────────────── Battle helpers ─────────────────────────

function instance(sp: SpiritDef, level: number, uid: string): SpiritInstance {
  return { uid, speciesId: sp.id, level, exp: 0, stage: stageForLevel(level), resonance: 0, loadout: defaultLoadout(sp.id, level) };
}

/** AI vs AI until a winner is decided (at most 30 turns) */
function aiBattle(a: SpiritInstance[], b: SpiritInstance[], seed: number): Battle {
  const bt = Battle.create({ kind: 'trainer', seed, sides: [{ name: 'A', spirits: a, isAI: true, art: 'oath_break' }, { name: 'B', spirits: b, isAI: true, art: 'eye_insight' }] });
  bt.start();
  let n = 0;
  while (bt.s.winner === null && n++ < 60) {
    bt.resolveTurn([chooseAction(bt, 0), chooseAction(bt, 1)]);
    const ch: [number | null, number | null] = [null, null];
    for (const id of [0, 1] as SideId[]) if (bt.needsReplacement(id)) ch[id] = chooseReplacement(bt, id);
    if (ch[0] !== null || ch[1] !== null) bt.replace(ch);
  }
  return bt;
}

/** Make side 0's skill be used or triggered in a "natural" situation */
function forceSkill(sp: SpiritDef, skillId: string, foes: SpiritDef[]): void {
  const sk = SKILL_BY_ID.get(skillId)!;
  const trap = sk.category === 'trap';
  const on = fxOf(skillId).trap?.on as TrapEventName | undefined;
  const mine = trap ? [skillId, 't_wait'] : sk.category === 'ultimate' ? ['t_wait'] : [skillId, 't_wait'];
  const foeKit = ['t_strike', 't_trap', 't_war_cry', 't_heal'];
  const b = duel([{ id: sp.id, level: 55, skills: mine }, { id: sp.id, level: 55 }], [{ id: foes[0].id, level: 55, skills: foeKit }, { id: foes[1].id, level: 55, skills: foeKit }], 11);
  const step = (a: TurnInput, c: TurnInput) => {
    if (b.s.winner !== null) return;
    b.resolveTurn([a, c]);
    b.side(0).aether = 10;
    b.side(1).aether = 10;
    const ch: [number | null, number | null] = [b.needsReplacement(0) ? chooseReplacement(b, 0) : null, b.needsReplacement(1) ? chooseReplacement(b, 1) : null];
    if (ch[0] !== null || ch[1] !== null) b.replace(ch);
  };
  if (!trap) {
    b.estimate(0, skillId);
    b.canUse(0, skillId);
    step(use(skillId), use('t_strike'));
    step(use(skillId), use('t_war_cry'));
    step(use(skillId), guard());
    step(chooseAction(b, 0), chooseAction(b, 1));
    return;
  }
  step({ ...use('t_wait'), trap: skillId }, use('t_wait'));
  switch (on) {
    case 'foeEnter':
    case 'foeLeave':
      step(use('t_wait'), sw(1));
      break;
    case 'foeAttack':
      step(use('t_wait'), use('t_strike'));
      step(use('t_wait'), use('t_bolt'));
      break;
    case 'foeStatus':
    case 'foeBuff':
      step(use('t_wait'), use('t_war_cry'));
      break;
    case 'foeHeal':
      b.active(1).hp = Math.ceil(b.active(1).maxHp / 2);
      step(use('t_wait'), use('t_heal'));
      break;
    case 'foeSetTrap':
      step(use('t_wait'), { ...use('t_wait'), trap: 't_trap' });
      break;
    case 'foeTrapFire':
      step(use('t_wait'), { ...use('t_wait'), trap: 't_trap' });
      step(use('t_wait'), use('t_wait'));
      break;
    case 'foeCharge':
      step(use('t_wait'), use('t_charge'));
      break;
    case 'lethal':
      b.active(0).hp = 2;
      b.active(1).stats.atk = 9999;
      step(use('t_wait'), use('t_strike'));
      break;
    case 'fainted':
      b.active(0).hp = 1;
      step(use('t_wait'), use('t_strike'));
      break;
    default:
      step(use('t_wait'), use('t_wait'));
  }
  step(chooseAction(b, 0), chooseAction(b, 1));
}

// ───────────────────────── Tests ─────────────────────────

for (const g of groups) {
  const members = membersOf(g);

  test(`${g}: group file and hooks have no errors`, () => {
    const problems = [...checkGroupFile(g), ...FX_ERRORS.filter((e) => e.where === g).map((e) => e.msg)];
    const mod = GROUP_MODULES[g];
    for (const id of Object.keys(mod.FX)) {
      if (!SKILL_BY_ID.has(id)) problems.push(`hook ${id} has no matching skill definition`);
      else if (FX_SOURCE.get(id) === g && !KIT_FILES[g].skills.some((s) => s.id === id)) problems.push(`hook ${id}: its skill is not defined in ${g}.json`);
    }
    for (const id of Object.keys(mod.KIT ?? {})) if (GROUP_OF_SPIRIT.get(id) !== g) problems.push(`kit hook ${id} is not a spirit of the ${g} group`);
    for (const s of KIT_FILES[g].skills) {
      const tr = fxOf(s.id).trap;
      if (s.category === 'trap' && !tr) problems.push(`trap skill ${s.id} has no trap hook (src/engine/kits/${g}.ts)`);
      if (s.category !== 'trap' && tr) problems.push(`${s.id} is not a trap skill and cannot have a trap hook`);
      if (tr?.on === 'foeTrapFire' && s.trapSpeed !== 'counter') problems.push(`${s.id}: a trap skill that responds to a trap (foeTrapFire) must be a Counter trap`);
      if (s.trapSpeed === 'counter' && tr && !['foeTrapFire', 'foeAttack', 'foeStatus', 'foeCharge'].includes(tr.on)) problems.push(`${s.id}: a Counter trap can only respond to a trap or a skill (foeTrapFire / foeAttack / foeStatus / foeCharge)`);
      if (fxOf(s.id).lasting && s.category === 'trap') problems.push(`${s.id}: put lasting effects on a status or attack skill`);
    }
    assert.deepEqual(problems, []);
  });

  test(`${g}: kit rules`, () => {
    const problems = members.flatMap((sp) => checkKit(sp).problems);
    const names = new Map<string, string>();
    for (const sp of SPIRITS) {
      const n = sp.mechanic?.name;
      if (!n) continue;
      if (names.has(n) && GROUP_OF_SPIRIT.get(sp.id) === g) problems.push(`${sp.id}: signature mechanic "${n}" has the same name as ${names.get(n)}`);
      names.set(n, sp.id);
    }
    assert.deepEqual(problems, []);
  });

  test(`${g}: AI battles (Lv 10 / 30 / 55) run without errors and finish`, () => {
    const rng = mulberry32(9000 + KIT_GROUPS.indexOf(g));
    const others = SPIRITS;
    const pick = (not: string) => {
      let sp = others[Math.floor(rng() * others.length)];
      while (sp.id === not) sp = others[Math.floor(rng() * others.length)];
      return sp;
    };
    for (const sp of members) {
      for (const lv of [10, 30, 55]) {
        for (let k = 0; k < 2; k++) {
          const seed = Math.floor(rng() * 1e9);
          const a = [instance(sp, lv, 'a0'), instance(pick(sp.id), lv, 'a1')];
          const b = [instance(pick(sp.id), lv, 'b0'), instance(pick(sp.id), lv, 'b1')];
          const bt = aiBattle(k === 0 ? a : b, k === 0 ? b : a, seed);
          assert.notEqual(bt.s.winner, null, `${sp.id} Lv ${lv} seed ${seed} did not finish`);
        }
      }
    }
  });

  test(`${g}: every skill can actually be used or triggered`, () => {
    const rng = mulberry32(4242 + KIT_GROUPS.indexOf(g));
    for (const sp of members) {
      const foes = SPIRITS.filter((x) => x.id !== sp.id);
      const ids = [...new Set([...sp.learnset.map((e) => e.id), sp.ultimate])].filter((id) => SKILL_BY_ID.has(id));
      for (const id of ids) {
        const f1 = foes[Math.floor(rng() * foes.length)];
        const f2 = foes[Math.floor(rng() * foes.length)];
        try {
          forceSkill(sp, id, [f1, f2]);
        } catch (e) {
          assert.fail(`${sp.id} ${id} (foe ${f1.id}): ${(e as Error).stack}`);
        }
      }
      // Kit hooks (state marks) must also be callable in battle
      if (KIT_FX[sp.id]?.marks) duel([{ id: sp.id }], [{ id: foes[0].id }]).view();
    }
  });
}
