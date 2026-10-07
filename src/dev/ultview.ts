// Dev only: preview an ultimate cutscene on its own (add ?ultview=ignisar to the URL). Runs one turn on the real battle engine and hands the events to the director to play.
// Params: &foe=thalassene (opponent), &arena=volcano (arena; by default follows the caster's element), &side=1 (cast from the opponent's side),
// &guard=1 (opponent guards), &speed=2 (battle speed), &lowfx / &hq (quality), &wait=1500 (how long to wait after entering before casting, in ms),
// &pre=skillA,skillB (before the ultimate, run one turn with each of these skills to build up mechanic state: charge, rock layers, prophecy marks...; skill ids are in data/kits),
// &foeatk=1 (for those &pre turns the opponent uses attack skills instead, to test "blocks the attack" mechanics, e.g. Astra's starlight and seal), &ink=off (spirits with the post-process outline revert to the old outline, for before/after comparison).
// window.__ult: { phase: 'entry' | 'ult' | 'done', t0 }, where t0 is the performance.now() at which the ultimate started.

import { Battle, type TeamSpec } from '../engine/battle.ts';
import type { MainAction, SideId, SpiritInstance, TurnInput } from '../engine/types.ts';
import { Stage } from '../render/stage.ts';
import { applyInkParam } from '../render/species.ts';
import type { RegionId } from '../render/arena.ts';
import { BattleScene, ELEMENT_COLOR } from '../battle/scene.ts';
import { Director, type BattleUI } from '../battle/director.ts';
import { getSkill, getSpirit } from '../data.ts';
import { defaultLoadout } from '../game/loadout.ts';
import type { Element } from '../../sim/types.ts';

const REGION_OF: Record<Element, RegionId> = {
  fire: 'volcano',
  water: 'isles',
  nature: 'forest',
  wind: 'highland',
  earth: 'canyon',
  thunder: 'plains',
  light: 'holy',
  dark: 'shadow',
  neutral: 'arena',
};

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export async function runUltView(el: HTMLElement): Promise<void> {
  const q = new URLSearchParams(location.search);
  applyInkParam(q);
  const id = q.get('ultview') || 'ignisar';
  const foeId = q.get('foe') || (id === 'thalassene' ? 'ignisar' : 'thalassene');
  const caster = (Number(q.get('side') ?? 0) === 1 ? 1 : 0) as SideId;
  const other = (caster === 0 ? 1 : 0) as SideId;
  const sp = getSpirit(id);
  const region = (q.get('arena') || REGION_OF[sp.elements[0]]) as RegionId;
  const spd = Number(q.get('speed') ?? 1) || 1;
  const state = { phase: 'entry', t0: 0, h: 0 };
  (window as unknown as { __ult: typeof state }).__ult = state;

  const stage = new Stage(el);
  stage.autoQuality = false;
  if (q.has('lowfx')) stage.setQuality('low');
  else if (q.has('hq')) stage.setQuality('high');

  const hud = document.createElement('div');
  hud.className = 'hud';
  const floats = document.createElement('div');
  floats.className = 'floats';
  hud.appendChild(floats);
  el.appendChild(hud);
  const flash = (node: HTMLElement, ms: number) => {
    hud.appendChild(node);
    setTimeout(() => node.remove(), ms);
  };

  const inst = (sid: string, uid: string): SpiritInstance => ({ uid, speciesId: sid, level: 60, exp: 0, stage: 3, resonance: 0, loadout: defaultLoadout(sid, 60) });
  const team = (sid: string, uid: string, name: string, isAI: boolean): TeamSpec => ({ name, spirits: [inst(sid, uid)], isAI });
  const sides: [TeamSpec, TeamSpec] = caster === 0 ? [team(id, 'a', '我方', false), team(foeId, 'b', '對手', true)] : [team(foeId, 'a', '我方', false), team(id, 'b', '對手', true)];
  const b = Battle.create({ kind: 'trainer', seed: 7, sides });
  const scene = new BattleScene(stage, region);

  const ui: BattleUI = {
    view: () => {},
    float: (text, world, cls) => {
      const p = scene.worldToScreen(world);
      const f = document.createElement('div');
      f.className = `float ${cls}`;
      f.textContent = text;
      f.style.left = `${p.x}px`;
      f.style.top = `${p.y}px`;
      floats.appendChild(f);
      setTimeout(() => f.remove(), 1600);
    },
    banner: (text, sub, color, side) => {
      const n = document.createElement('div');
      n.className = `banner ${side === 1 ? 'enemy' : side === 0 ? 'ally' : 'neutral'}`;
      n.style.setProperty('--c', hex(color));
      n.innerHTML = `<div class="banner-text"></div><div class="banner-sub"></div>`;
      (n.firstChild as HTMLElement).textContent = text;
      (n.lastChild as HTMLElement).textContent = sub;
      flash(n, 1300 / spd);
    },
    log: (t) => console.log(`[battle] ${t}`),
    cutin: (side, spirit, skill, element, ssr) => {
      const n = document.createElement('div');
      n.className = `cutin ${side === 1 ? 'enemy' : ''} ${ssr ? 'ssr' : ''}`;
      n.style.setProperty('--c', hex(ELEMENT_COLOR[element]));
      n.style.setProperty('--spd', String(spd));
      n.innerHTML = `<div class="cutin-band"><div class="cutin-sub gsep"><span>真名解放</span><span></span></div><div class="cutin-skill"></div></div>`;
      n.querySelector('.cutin-sub span:last-child')!.textContent = spirit;
      n.querySelector('.cutin-skill')!.textContent = skill;
      flash(n, 1500 / spd);
    },
  };
  const director = new Director(scene, ui);
  director.names = ['我方', '對手'];
  director.setSpeed(spd);
  stage.start();
  await director.play(b.start());
  state.h = scene.slots[caster].creature?.worldHeight ?? 0;

  // The ultimate costs 5 aether; give both sides enough, and the opponent uses a skill that doesn't disturb the view (or guards)
  const foeAction = (guard: boolean, attack = false): MainAction => {
    const foeSkills = b.active(other).skills.filter((s) => b.canUse(other, s).ok);
    const pick = attack ? foeSkills.find((s) => getSkill(s).category !== 'status') : undefined;
    const quiet = pick ?? foeSkills.find((s) => getSkill(s).category === 'status') ?? foeSkills[0];
    return guard || !quiet ? { type: 'guard' } : { type: 'skill', skillId: quiet };
  };
  const turn = (skillId: string, guard: boolean, attack = false): [TurnInput, TurnInput] => {
    for (const s of [0, 1] as SideId[]) b.side(s).aether = 10;
    const mine: TurnInput = { main: { type: 'skill', skillId } };
    const theirs: TurnInput = { main: foeAction(guard, attack) };
    return caster === 0 ? [mine, theirs] : [theirs, mine];
  };
  for (const pre of (q.get('pre') ?? '').split(',').filter(Boolean)) {
    if (b.s.winner !== null) break;
    await director.play(b.resolveTurn(turn(pre, false, q.has('foeatk'))));
  }
  const ult = b.active(caster).ultimate ?? sp.ultimate;
  const inputs = turn(ult, q.has('guard'));

  await new Promise((r) => setTimeout(r, Number(q.get('wait') ?? 1500)));
  const evs = b.resolveTurn(inputs);
  (window as unknown as { __scene: BattleScene }).__scene = scene;
  state.phase = 'ult';
  state.t0 = performance.now();
  await director.play(evs);
  state.phase = 'done';
}
