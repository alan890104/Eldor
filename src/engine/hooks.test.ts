// Tests for skill hooks, trap events, lasting effects, kit hooks, the system guard and save-data fixes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerTestSkills } from '../data.ts';
import type { SkillDef } from '../../sim/types.ts';
import { chooseAction } from './ai.ts';
import { registerKitHooks, registerSkillHooks } from './kits/index.ts';
import type { SkillHooks, TrapEventName } from './skillfx.ts';
import { duel, guard, hitsBy, sw, texts, traits, turn, use, useTestSkills } from './testkit.ts';
import { sanitizeLoadout } from '../game/loadout.ts';
import type { BattleEvent, SideId, SpiritInstance } from './types.ts';

useTestSkills();

const S = (id: string, category: SkillDef['category'], cost: number, power: number, tags: Record<string, number> = {}, extra: Partial<SkillDef> = {}): SkillDef => ({
  id,
  name: id,
  en: id,
  element: 'neutral',
  category,
  cost,
  power,
  accuracy: 100,
  priority: 0,
  text: '',
  tags,
  ...extra,
});
const def = (d: SkillDef, h: SkillHooks = {}) => {
  registerTestSkills([d]);
  registerSkillHooks(d.id, h);
  return d.id;
};
const kindsOf = (ev: BattleEvent[], k: BattleEvent['k'], side?: SideId) => ev.filter((e) => e.k === k && (side === undefined || (e as { side?: SideId }).side === side));

// ───────────────────────── System guard ─────────────────────────

test('Guard: a system action that blocks the attack, costs 1 aether and cannot be used on consecutive turns', () => {
  const b = duel([{ id: 'monolith', skills: ['t_strike'] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  const hp = b.active(0).hp;
  b.side(0).aether = 3;
  const ev = b.resolveTurn([guard(), use('t_strike')]);
  assert.equal(b.active(0).hp, hp, 'attack blocked');
  assert.ok(ev.some((e) => e.k === 'guarded'));
  assert.ok(ev.some((e) => e.k === 'use' && e.skillId === 'guard'), 'the renderer still receives the use event for Guard');
  assert.equal(b.side(0).aether, 3 - 1 + 2, 'spends 1 aether, +2 at end of turn');
  assert.equal(b.canGuard(0).ok, false, 'cannot Guard again next turn');
  assert.equal(b.canGuard(0).reason, '不能連續格擋');
  b.side(0).aether = 10;
  const ev2 = b.resolveTurn([guard(), use('t_strike')]);
  assert.ok(ev2.some((e) => e.k === 'fail' && e.reason === '連續格擋失敗'));
  assert.ok(b.active(0).hp < hp);
});

test('Guard: priority +3, faster than a priority attack; cannot Guard while Taunted; the AI Guards when the foe has a fully charged ultimate', () => {
  const b = duel([{ id: 'monolith', skills: ['t_strike'] }], [{ id: 'skyreign', skills: ['t_quick_strike'] }]);
  b.active(0).stats.spd = 1;
  const hp = b.active(0).hp;
  turn(b, guard(), 't_quick_strike');
  assert.equal(b.active(0).hp, hp);
  b.applyStatus(0, 'taunt');
  assert.equal(b.canGuard(0).ok, false);
  const a = duel([{ id: 'monolith', skills: ['t_strike'] }], [{ id: 'ignisar', skills: ['t_strike'] }]);
  a.active(0).lastGuardTurn = -10;
  let guarded = 0;
  for (let i = 0; i < 20; i++) if (chooseAction(a, 0, { skill: 1 }).main.type === 'guard') guarded++;
  assert.ok(guarded > 0, 'the AI Guards');
});

// ───────────────────────── Skill hooks ─────────────────────────

test('power / afterAttack / manual: conditional power, a cost after attacking, tags that only count toward the budget', () => {
  const id = def(S('x_finisher', 'physical', 1, 60, { 'status.burn': 1 }), {
    power: (b, c, p) => (b.active(c.defender).status.poison ? p * 2 : p),
    afterAttack: (b, c) => b.removeStatus(c.defender, 'poison'),
    manual: ['status.burn'],
  });
  const b = duel([{ id: 'monolith', skills: [id] }], [{ id: 'cloudfluff', skills: ['t_wait'] }]);
  const plain = b.estimate(0, id);
  b.applyStatus(1, 'poison', 1);
  assert.ok(b.estimate(0, id) > plain * 1.8, 'the estimate also uses the conditional power');
  turn(b, id, 't_wait');
  assert.equal(b.active(1).status.poison, undefined, 'Poison is removed after the attack');
  assert.equal(b.active(1).status.burn, undefined, 'a manual tag is not resolved automatically');
});

test('canUse / cost / priority / effect / afterUse', () => {
  const log: string[] = [];
  const id = def(S('x_setup', 'status', 2, 0, { 'self.atk': 1 }), {
    canUse: (b, s) => (b.active(s).hp < b.active(s).maxHp ? null : '生命全滿時不能用'),
    cost: () => 0,
    priority: () => 2,
    effect: (b, s) => {
      b.active(s).vars['x:stacks'] = (b.active(s).vars['x:stacks'] ?? 0) + 1;
      log.push('effect');
    },
    afterUse: () => void log.push('after'),
  });
  const b = duel([{ id: 'monolith', skills: [id] }], [{ id: 'skyreign', skills: ['t_quick_strike'] }]);
  assert.equal(b.canUse(0, id).reason, '生命全滿時不能用');
  b.active(0).hp -= 10;
  b.side(0).aether = 0;
  assert.equal(b.canUse(0, id).ok, true, 'cost is overridden to 0');
  const ev = b.resolveTurn([use(id), use('t_quick_strike')]);
  const order = ev.filter((e) => e.k === 'use').map((e) => (e as { side: SideId }).side);
  assert.deepEqual(order, [0, 1], 'priority +2 is faster than priority +1');
  assert.deepEqual(log, ['effect', 'after']);
  assert.equal(b.active(0).vars['x:stacks'], 1);
  assert.equal(b.active(0).stages.atk, 1, 'tag effects resolve as usual');
});

test('hits / onHit: the hit count can vary and onHit is called for every hit', () => {
  let n = 0;
  const id = def(S('x_flurry', 'physical', 1, 40, { hits: 2 }), { hits: () => 4, onHit: () => void n++ });
  const b = duel([{ id: 'monolith', skills: [id] }], [{ id: 'terragon', skills: ['t_wait'] }]);
  const ev = turn(b, id, 't_wait');
  assert.equal(hitsBy(ev, 0).length, 4);
  assert.equal(n, 4);
});

test('redirect and pursuit', () => {
  const copy = def(S('x_copy', 'status', 1, 0), {
    redirect: (b, s) => b.side(b.foe(s)).lastAttackSkill ? { skill: b.side(b.foe(s)).lastAttackSkill!, cost: 1, powerMult: 0.5 } : '沒有可複製的技能',
  });
  const b = duel([{ id: 'grimoire', skills: [copy] }], [{ id: 'monolith', skills: ['t_strike'] }]);
  b.active(0).stats.spd = 1;
  const ev = turn(b, copy, 't_strike');
  assert.ok(ev.some((e) => e.k === 'use' && e.skillId === 't_strike' && e.side === 0 && e.copied));
  const chase = def(S('x_chase', 'physical', 1, 50), { pursuit: 2 });
  const p = duel([{ id: 'noxfang', skills: [chase] }], [{ id: 'monolith' }, { id: 'cloudfluff' }]);
  p.active(0).stats.spd = 1;
  const hp = p.active(1).hp;
  turn(p, chase, sw(1));
  assert.ok(p.side(1).team[0].hp < hp, 'hits before the target leaves');
  assert.equal(p.side(1).active, 1);
});

test('aiScore: the AI picks skills by the hook score', () => {
  const combo = def(S('x_combo', 'status', 1, 0), { aiScore: () => 500 });
  const b = duel([{ id: 'monolith', skills: ['t_strike', combo] }], [{ id: 'cloudfluff', skills: ['t_wait'] }]);
  assert.deepEqual(chooseAction(b, 0, { skill: 1 }).main, { type: 'skill', skillId: combo });
});

// ───────────────────────── Trap events ─────────────────────────

/** Builds a test trap that fires on the on event; fire records the event and returns result */
function trapOn(on: TrapEventName, result: object = {}, speed: SkillDef['trapSpeed'] = 'normal'): { id: string; fired: string[] } {
  const fired: string[] = [];
  const id = def(S(`x_trap_${on}_${speed}_${Object.keys(result).join('_')}`, 'trap', 1, 0, {}, { trapSpeed: speed, trigger: on }), {
    trap: { on, fire: (_b: unknown, _o: unknown, ev: { on: string }) => (fired.push(ev.on), result) } as SkillHooks['trap'],
  });
  return { id, fired };
}

test('Trap: cannot fire on the turn it is set (a Quick trap can) and disappears once fired', () => {
  const n = trapOn('foeAttack', { reduce: 0.5 });
  const b = duel([{ id: 'monolith', skills: [n.id, 't_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  turn(b, { ...use('t_wait'), trap: n.id }, 't_strike');
  assert.deepEqual(n.fired, [], 'does not fire on the turn it is set');
  turn(b, 't_wait', 't_strike');
  assert.deepEqual(n.fired, ['foeAttack']);
  assert.equal(b.side(0).trap, null);
  const q = trapOn('foeAttack', {}, 'quick');
  const c = duel([{ id: 'monolith', skills: [q.id, 't_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  c.active(1).stats.spd = 1;
  turn(c, { ...use('t_wait'), trap: q.id }, 't_strike');
  assert.deepEqual(q.fired, ['foeAttack'], 'a Quick trap can fire on the turn it is set');
});

test('Trap: negate / reflect on foeAttack, negate on foeStatus and foeCharge, survive on lethal', () => {
  const neg = trapOn('foeAttack', { negate: true });
  const b = duel([{ id: 'monolith', skills: [neg.id, 't_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  turn(b, { ...use('t_wait'), trap: neg.id }, 't_wait');
  const hp = b.active(0).hp;
  const ev = turn(b, 't_wait', 't_strike');
  assert.equal(b.active(0).hp, hp);
  assert.ok(ev.some((e) => e.k === 'negate'));

  const st = trapOn('foeStatus', { negate: true });
  const s = duel([{ id: 'monolith', skills: [st.id, 't_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_war_cry'] }]);
  turn(s, { ...use('t_wait'), trap: st.id }, 't_wait');
  turn(s, 't_wait', 't_war_cry');
  assert.equal(s.active(1).stages.atk, 0, 'the status skill is negated');

  const ch = trapOn('foeCharge', { negate: true });
  const c = duel([{ id: 'monolith', skills: [ch.id, 't_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_charge'] }]);
  turn(c, { ...use('t_wait'), trap: ch.id }, 't_wait');
  turn(c, 't_wait', 't_charge');
  assert.equal(c.active(1).charging, null, 'the charge is interrupted');

  const ls = trapOn('lethal', { survive: true });
  const l = duel([{ id: 'cloudfluff', skills: [ls.id, 't_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  turn(l, { ...use('t_wait'), trap: ls.id }, 't_wait');
  l.active(1).stats.atk = 99999;
  turn(l, 't_wait', 't_strike');
  assert.equal(l.active(0).hp, 1);
});

test('Trap: foeEnter, foeLeave (negate = the switch fails), fainted, turnEnd, foeBuff, foeHeal, foeSetTrap', () => {
  const run = (on: TrapEventName, result: object, foe: Parameters<typeof turn>[2], prep?: (b: ReturnType<typeof duel>) => void) => {
    const t = trapOn(on, result);
    const b = duel([{ id: 'monolith', skills: [t.id, 't_wait'] }, { id: 'cloudfluff' }], [{ id: 'pyre_dragoon', skills: ['t_strike', 't_trap'] }, { id: 'terragon' }]);
    turn(b, { ...use('t_wait'), trap: t.id }, 't_wait');
    prep?.(b);
    const ev = turn(b, 't_wait', foe);
    return { b, t, ev };
  };
  assert.deepEqual(run('foeEnter', {}, sw(1)).t.fired, ['foeEnter']);
  const leave = run('foeLeave', { negate: true }, sw(1));
  assert.deepEqual(leave.t.fired, ['foeLeave']);
  assert.equal(leave.b.side(1).active, 0, 'the switch fails');
  const f = run('fainted', {}, 't_strike', (b) => (b.active(0).hp = 1));
  assert.deepEqual(f.t.fired, ['fainted']);
  assert.deepEqual(run('turnEnd', {}, 't_wait').t.fired, ['turnEnd']);
  assert.deepEqual(run('foeBuff', {}, 't_war_cry').t.fired, ['foeBuff']);
  assert.deepEqual(run('foeHeal', {}, 't_heal', (b) => (b.active(1).hp = 10)).t.fired, ['foeHeal']);
  const st = run('foeSetTrap', { negate: true }, { ...use('t_wait'), trap: 't_trap' });
  assert.deepEqual(st.t.fired, ['foeSetTrap']);
  assert.equal(st.b.side(1).trap, null, 'the trap the foe just set is destroyed');
});

test('Counter trap: responds to the foe trap firing and negates it', () => {
  const counter = trapOn('foeTrapFire', { negate: true }, 'counter');
  const hit = trapOn('foeAttack', { negate: true });
  const b = duel([{ id: 'monolith', skills: [counter.id, 't_strike'] }], [{ id: 'pyre_dragoon', skills: [hit.id, 't_wait'] }]);
  turn(b, { ...use('t_strike'), trap: counter.id }, { ...use('t_wait'), trap: hit.id });
  const hp = b.active(1).hp;
  const ev = turn(b, 't_strike', 't_wait');
  assert.deepEqual(counter.fired, ['foeTrapFire']);
  assert.deepEqual(hit.fired, [], 'the countered trap does not resolve');
  assert.ok(b.active(1).hp < hp, 'the attack still hits');
  assert.ok(ev.some((e) => e.k === 'trap' && e.chain === 3));
});

// ───────────────────────── Lasting effects ─────────────────────────

test('Lasting effect: damage reduction, end of turn, expiry; cleared on leaving, while effects on the side are kept', () => {
  const log: string[] = [];
  const wall = def(S('x_wall', 'status', 1, 0), {
    effect: (b, s) => void b.addLasting(s, 'x_wall', 2),
    lasting: { reduce: () => 0.5, onTurnEnd: () => void log.push('tick'), onExpire: () => void log.push('expire') },
  });
  const b = duel([{ id: 'monolith', skills: [wall, 't_wait'] }, { id: 'cloudfluff' }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  const before = b.estimate(1, 't_strike');
  turn(b, wall, 't_wait');
  assert.ok(b.estimate(1, 't_strike') < before * 0.6, '50% damage reduction');
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'fx:x_wall'), 'shown as a mark');
  turn(b, 't_wait', 't_wait');
  assert.deepEqual(log, ['tick', 'tick', 'expire']);
  assert.equal(b.getLasting(0, 'x_wall'), undefined);
  b.addLasting(0, 'x_wall', 3);
  b.addLasting(0, 'x_wall', 3, { side: true });
  turn(b, sw(1), 't_wait');
  assert.equal(b.active(0).lasting.length, 0, 'effects on the spirit are cleared when it leaves');
  assert.ok(b.getLasting(0, 'x_wall'), 'the effect on the side is kept');
});

test('Lasting effect: blocks status conditions, blocks healing, restricts skills', () => {
  const ward = def(S('x_ward', 'status', 1, 0), {
    lasting: { blockStatus: (_b, _o, st) => st === 'burn', blockHeal: () => true, canUse: (_b, _o, sk) => (sk.category === 'status' ? '被封住了' : null) },
  });
  const b = duel([{ id: 'monolith', skills: ['t_war_cry', 't_strike'] }], [{ id: 'pyre_dragoon', skills: ['t_wait'] }]);
  b.addLasting(0, ward, 2);
  assert.equal(b.applyStatus(0, 'burn'), false);
  b.active(0).hp -= 50;
  const hp = b.active(0).hp;
  b.heal(0, 30);
  assert.equal(b.active(0).hp, hp);
  assert.equal(b.canUse(0, 't_war_cry').reason, '被封住了');
});

// ───────────────────────── Kit hooks and trait rewrites ─────────────────────────

test('Kit hooks: called like trait hooks and able to show status marks', () => {
  registerKitHooks('cloudfluff', {
    onEndTurn: (b, id) => void (b.active(id).vars['kit:heat'] = (b.active(id).vars['kit:heat'] ?? 0) + 1),
    attackBonus: () => 1,
    marks: (b, id) => [{ id: 'kit:heat', n: b.active(id).vars['kit:heat'] ?? 0, note: '熱度' }],
  });
  try {
    const b = duel([{ id: 'cloudfluff', skills: ['t_strike'] }], [{ id: 'terragon', skills: ['t_wait'] }]);
    const before = b.estimate(0, 't_strike');
    turn(b, 't_wait', 't_wait');
    assert.equal(b.active(0).vars['kit:heat'], 1);
    assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:heat' && m.n === 1));
    registerKitHooks('cloudfluff', null);
    assert.ok(before > b.estimate(0, 't_strike') * 1.5, 'the damage bonus takes effect');
  } finally {
    registerKitHooks('cloudfluff', null);
  }
});

test('Trait override: once a kit overrides a trait, the old trait implementation is fully disabled', () => {
  const override = (b: ReturnType<typeof duel>, side: SideId) => {
    for (const c of b.side(side).team) c.species = { ...c.species, traitOverride: true, trait: { name: '新特性', text: '' } };
  };
  // Firm Stone (hard-coded in battle.ts)
  const m = duel([{ id: 'monolith', skills: ['t_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  override(m, 0);
  m.active(1).stats.atk = 99999;
  turn(m, 't_wait', 't_strike');
  assert.ok(m.active(0).fainted, 'Firm Stone no longer leaves 1 HP');
  // Ride the Wind (entry effect)
  const s = duel([{ id: 'monolith' }, { id: 'skyreign' }], [{ id: 'terragon', skills: ['t_wait'] }]);
  override(s, 0);
  const ev = turn(s, sw(1), 't_wait');
  assert.ok(!traits(ev).includes('乘風'));
  assert.equal(s.active(0).stages.spd, 0);
  // Hard Shell (a hook in traits.ts)
  // Engine tag expose (after the revision, the `lure_flash` of `lanternfish` lights the lure instead; see also kits/water.test.ts)
  const expose = def(S('t_expose_ovr', 'status', 0, 0, { expose: 1 }));
  const c = duel([{ id: 'lanternfish', skills: [expose, 't_strike'] }], [{ id: 'bubblecrab', skills: ['t_wait'] }]);
  override(c, 1);
  turn(c, expose, 't_wait');
  const hit = hitsBy(turn(c, 't_strike', 't_wait'), 0)[0];
  assert.equal(hit?.crit, true, 'can be crit after the override');
  // Unchanged when not rewritten
  const k = duel([{ id: 'monolith', skills: ['t_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  k.active(1).stats.atk = 99999;
  assert.ok(traits(turn(k, 't_wait', 't_strike')).includes('堅石'));
  assert.equal(k.active(0).fainted, false, 'Firm Stone still works');
});

test('Bench effects: trigger when the active spirit faints or is hit, when the foe uses a skill, and at end of turn', () => {
  const log: string[] = [];
  registerKitHooks('cloudfluff', {
    bench: {
      onAllyHit: () => void log.push('hit'),
      onFoeSkill: (_b, _s, _i, sk) => void log.push(`skill:${sk.id}`),
      onTurnEnd: (b, s, i) => void (b.side(s).team[i].vars['bench:t'] = 1),
      onAllyFaint: (b, s, i) => {
        log.push('faint');
        b.side(s).team[i].vars['bench:avenge'] = 1;
      },
    },
  });
  try {
    const b = duel([{ id: 'monolith', skills: ['t_wait'] }, { id: 'cloudfluff' }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
    turn(b, 't_wait', 't_strike');
    assert.deepEqual(log, ['hit', 'skill:t_strike']);
    assert.equal(b.side(0).team[1].vars['bench:t'], 1);
    b.active(0).hp = 1;
    turn(b, 't_wait', 't_strike');
    assert.ok(log.includes('faint'));
    assert.equal(b.side(0).team[1].vars['bench:avenge'], 1);
  } finally {
    registerKitHooks('cloudfluff', null);
  }
});

test('Clearing timed effects, moving first / moving last, reversed action order, attack immunity', () => {
  // Clearing turn-based effects (tag dispelTurns)
  const buff = def(S('x_buff', 'status', 0, 0), { lasting: { attackBonus: () => 0.5 } });
  const wipe = def(S('x_wipe', 'status', 1, 0, { dispelTurns: 1 }));
  const b = duel([{ id: 'monolith', skills: [wipe] }], [{ id: 'pyre_dragoon', skills: ['t_strike'] }]);
  b.addLasting(1, buff, 5);
  b.setScreen(1, 'phys', 30, 5);
  turn(b, wipe, 't_wait');
  assert.equal(b.getLasting(1, buff), undefined);
  assert.equal(b.side(1).screens.physTurns, 0);
  // Moving last: power x2 when the opponent has already acted
  const late = def(S('x_late', 'physical', 0, 50), { power: (bb, c, p) => (bb.hasActed(c.defender) ? p * 2 : p) });
  const r = duel([{ id: 'monolith', skills: [late] }], [{ id: 'skyreign', skills: ['t_wait'] }]);
  const slow = hitsBy(turn(r, late, 't_wait'), 0)[0].dmg;
  // Reversed action order: the slower acts first
  r.toggleReverseOrder(3);
  const ev = turn(r, late, 't_wait');
  assert.equal(ev.find((e) => e.k === 'use')?.side, 0, 'the slower monolith acts first');
  assert.ok(hitsBy(ev, 0)[0].dmg < slow * 0.75, 'no move-last bonus when moving first');
  assert.equal(r.view().reverseOrder, 2);
  // Immunity: immune to physical skills for N turns
  const aegis = def(S('x_aegis', 'status', 1, 0), { lasting: { immune: (_b, c) => c.cat === 'physical' } });
  const m = duel([{ id: 'monolith', skills: ['t_wait'] }], [{ id: 'pyre_dragoon', skills: ['t_strike', 't_bolt'] }]);
  m.addLasting(0, aegis, 3);
  const hp = m.active(0).hp;
  turn(m, 't_wait', 't_strike');
  assert.equal(m.active(0).hp, hp);
  turn(m, 't_wait', 't_bolt');
  assert.ok(m.active(0).hp < hp, 'magic still hits');
});

// ───────────────────────── Save-data fixes ─────────────────────────

test('sanitizeLoadout: removes deleted or unlearned skills and refills; a valid loadout is left alone', () => {
  const s: SpiritInstance = { uid: 'x', speciesId: 'pyre_dragoon', level: 30, exp: 0, stage: 2, resonance: 0, loadout: ['guard', 'no_such_skill', 'blaze_slash'] };
  assert.equal(sanitizeLoadout(s), true);
  assert.ok(s.loadout.includes('blaze_slash'));
  assert.ok(!s.loadout.includes('guard') && !s.loadout.includes('no_such_skill'));
  assert.ok(s.loadout.length >= 3 && s.loadout.length <= 4);
  const mine = [s.loadout[0]];
  s.loadout = [...mine];
  assert.equal(sanitizeLoadout(s), false, 'a skill the player removed is not refilled');
  const empty: SpiritInstance = { ...s, loadout: [] };
  sanitizeLoadout(empty);
  assert.ok(empty.loadout.length > 0);
  const b = duel([{ id: 'pyre_dragoon', skills: ['no_such_skill', 'blaze_slash'] }], [{ id: 'terragon', skills: ['t_wait'] }]);
  assert.deepEqual(b.active(0).skills, ['blaze_slash'], 'unknown skills are ignored in battle');
  assert.ok(kindsOf(turn(b, 'blaze_slash', 't_wait'), 'hit', 0).length > 0);
});
