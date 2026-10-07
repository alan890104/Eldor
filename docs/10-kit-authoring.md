# 10 Kit Authoring Guide

> Audience: designers who own one element group and design complete kits for 6-8 spirits. Besides this document, read only [05 Skill Design](05-skill-design.md) (text rules, keywords, traps and chains, the budget valuation table).
> Data: `data/kits/<group>.json` | Hooks: `src/engine/kits/<group>.ts` | Rules: `sim/kitrules.ts` | Tests: `sim/kits.test.ts`

## 0. The One-Minute Version

- One spirit = **identity** (`data/spirits.json`: name, element, base stats, trait, lore) + **kit** (`data/kits/<group>.json`: learnset, ultimate, signature mechanic) + **hooks** (`src/engine/kits/<group>.ts`: effects the tags cannot express).
- As in Seer (賽爾號), every spirit has its own complete skill list: **learned by level from Lv 1, the last one no later than Lv 55** (level cap 60; stage caps 20/40/60). The ultimate is exclusive and unlocks at Stage III.
- **Skills are 100% exclusive** (`"exclusive": "<spirit id>"`). The only exception is the **basic skills** in `data/kits/_basic.json`, which may go into the learnset of any spirit of the same element or of Neutral.
- There are no universal skills. **Guard is a system action** (selectable at any time like switching, takes no skill slot); do not make it a skill.
- Every spirit needs its own **visible signature mechanic with a cause and an effect** (§4), and its skills must combo with each other instead of being a pile of unrelated moves.
- Validate only your own group: `KIT=fire node --test sim/kits.test.ts`, `npm run kits -- fire`, `npx tsc --noEmit -p . 2>&1 | grep kits/fire`, `npm run duel -- pyre_dragoon`.

## 1. Division of Files

Nine groups are authored at the same time in the same working directory. **Change only your own files**:

| File | Who may change it |
| --- | --- |
| `data/kits/<group>.json` | That group |
| `src/engine/kits/<group>.ts` | That group |
| `src/engine/kits/<group>.test.ts` (new, optional) | That group |
| `data/kits/_basic.json`, `_system.json` | Read-only (definitions of the basic skills and Guard) |
| `data/spirits.json` | Read-only (to change a trait, write it in the kit's `"trait"`, §4.3) |
| The engine (`battle.ts`, `skillfx.ts`, `traits.ts`, `ai.ts`), `sim/`, the UI | Read-only. If a hook or mechanic is missing, report it; do not change it yourself |

Groups follow the spirit's **first element**:

| Group | Spirits |
| --- | --- |
| fire | pyre_dragoon, pyrewing, magma_golem, ignisar, bellowsbeast, shieldbeetle, steameel, phoenix |
| water | oathsea_sage, icecrown, thalassene, bubblecrab, lanternfish, swordfish, siren, springlotus |
| nature | elderwood_warden, dreamcap, sylvaron, acornsquirrel, leaffrog, owlarchivist, banyanelder |
| wind | skyreign, gale_weasel, aeroth, dandelion, papercrane, lyrebird, tornado |
| earth | monolith, sand_reaper, terragon, digmole, gargoyle, rhino, sandserpent, chronodragon |
| thunder | stormram, voltarion, hedgehog, ballspark, stormhorse, thunderbird, voltadillo |
| light | chime_sprite, luminael, candledove, prismsnail, balancescale, griffin, astragate |
| dark | eclipse_batlord, soul_lantern, noxfang, abyssjelly, maskfox, tombhound, weaverspider, voidchild |
| neutral | cloudfluff, relic_blade, grimoire, clockmouse, inkcat, eldarin |

## 2. Kit Format

```json
{
  "spirits": {
    "pyre_dragoon": {
      "mechanic": { "name": "Dragonflame", "text": "Each hit with a Fire Physical skill adds 1 stack of \"Dragonflame\" (max 3). ..." },
      "trait": { "name": "Dragon Knight's Heart", "text": "(Optional; if present it replaces the trait in spirits.json, §4.3)" },
      "learnset": [
        { "lv": 1, "id": "flame_claw" },
        { "lv": 1, "id": "pyd_tail_lash" },
        { "lv": 4, "id": "pyd_kindle" }
      ],
      "ultimate": "pyd_u_crimson",
      "core": ["pyd_dragon_rush", "pyd_kindle"]
    }
  },
  "skills": [
    {
      "id": "pyd_tail_lash", "name": "Tail Lash", "en": "Tail Lash",
      "element": "fire", "category": "physical",
      "cost": 0, "power": 55, "accuracy": 100, "priority": 0,
      "exclusive": "pyre_dragoon",
      "text": "On hit, adds 1 stack of \"Dragonflame\".",
      "tags": { "custom": 5 },
      "note": "1 stack of Dragonflame valued at 5 points"
    }
  ]
}
```

- `learnset`: sorted by level; several skills may share a level; it may contain your group's exclusive skills and basic skills.
- `ultimate`: the exclusive ultimate (`category: "ultimate"`, `cost: 5`; `damageType` is `physical`, `magic` or `auto`).
- `core` (optional): the priority order of the default loadout. Newly obtained spirits, enemies and arena opponents all use `defaultLoadout`: it takes the `core` skills first (those already learned), then fills in a 0-cost attack, a high-cost attack and support skills, and finally fills the rest by score. **Without `core`, AI opponents may not carry your combo.**
- `mechanic`: the signature mechanic (§4); the UI and help text show it. Required.
- `trait` (optional): rewrites the trait (§4.3).
- Skill fields follow the card in 05 §3: `element`, `category` (physical = Physical (武技), magic = Magic (魔法), status = Status (秘術), trap = Trap (伏技), ultimate = Ultimate (奧義)), `cost` (0-6), `power` (for multi-hit skills write the total power; `tags.hits` sets the number of hits), `accuracy`, `priority` (−3 to +3). Traps require `trapSpeed` (normal, quick or counter) and `trigger` (a one-sentence trigger condition).
- **ids are globally unique.** Start them with the spirit's abbreviation (`pyd_`, `osg_`, ...) so they never collide with another group. `text` is the description players see; `note` is written for designers (the reason for the valuation).

## 3. Learnset Rules and Rarity Tiers

`sim/kits.test.ts` checks every spirit for:

- At least 2 skills at Lv 1, one of which is a **0-cost attack**; at least 5 by Lv 20; at least 8 by Lv 40; the last one at Lv 55 or earlier.
- At least 5 attack skills (Physical or Magic); at least 2 Status skills or traps; at most 2 traps.
- Exclusive skills and the ultimate are defined in **your own group file**, have `exclusive` set to this spirit, and are used by this spirit only in the whole game.
- Basic skills: the element is one of the spirit's elements or Neutral; learned **before Lv 25**; the count depends on rarity.
- Every skill is within its budget range (§6); every `core` skill is in the learnset; a `mechanic` exists; every trap has a trap hook.

### Rarity Tiers

| | N | R | SR | SSR |
| --- | --- | --- | --- | --- |
| Learnset skills (excluding the ultimate) | 10-12 | 11-13 | 12-14 | 13-15 |
| Basic skill cap | 5 | 4 | 3 | 2 |
| Flagship skills (`sig`) | 1 | 1-2 | 2 | 2-3 |
| Flagship skill budget ratio | 1.00-1.20 | 1.00-1.25 | 1.00-1.30 | 1.00-1.35 |
| Regular exclusive skill budget ratio | 0.85-1.15 | 0.85-1.15 | 0.85-1.15 | 0.85-1.15 |
| Ultimate premium | +80 | +80 | +80 | +100 |

**Gacha sells play style and affection, not a stat ceiling** (06, pillar 1). An SSR should be clearly stronger, but in its **mechanics**:

- **N**: one simple, coherent one-step plan ("stack poison, then detonate").
- **R**: a clear two-step combo ("set a trap, empower after the trap fires, then pursue").
- **SR**: a combo engine whose payoff **changes the course of the game** (one turn that changes the rules of the field, a comeback counter).
- **SSR**: a **system mechanic nobody else has**: a field that deploys on entry, form changes, a brand-new resource, or a rewrite of the rules for turns, Aether or traps (e.g. reversed action order); plus the most complete and reliable kit; plus an ultimate that decides the whole battle. **Not overwhelming stats** (the base-stat table is unchanged, and the exclusive-skill budget range is the same for every rarity).

Exclusive skills should **combo with one another and echo the trait (the mechanic)**: a skill that sets something up needs a skill that cashes it in, and a powerful skill with a cost needs a way to reduce that cost. A kit that looks ordinary skill by skill and strong in combination is a good kit.

## 4. Signature Mechanics (Every Spirit Needs One)

- Every spirit has one **named mechanic whose state is visible** (`mechanic` plus the `marks` of the KIT hook), with a clear "set up, then cash in".
  - **N**: a simple counter or state (stacks, a switch).
  - **R**: a two-step interaction (skill A accumulates, skill B consumes; or a state toggle that gives different effects).
  - **SR**: a mechanic that changes how the spirit plays (e.g. hits taken accumulate counter energy, transform when a trap fires, skills change their effect while a trap is on the field).
  - **SSR**: a system that rewrites the rules (fields, forms, new resources, changes to the rules of turns, Aether or traps); only this spirit has it in the whole game.
- **No two spirits in the game may share a core mechanic** (a duplicate `mechanic.name` is rejected by the tests; avoid similar content as well). Do not use a generic condition like "+X power when the foe has a status condition" as a flagship.
- A trait may be redesigned to fit the mechanic, but only through the kit's `"trait"` and the KIT hooks (§4.3, §8.4).

### 4.1 How Mechanic State Is Stored

- On the spirit: `c.vars['pyd:heat']` (kept for the whole battle) or `c.vars['e:pyd:heat']` (**keys that start with `e:` are cleared when the spirit leaves the field**).
- Shared by a side: `b.side(id).vars['pyd:heat']`.
- Effects with a turn count: lasting effects (§8.3), which count down and display automatically.
- Always prefix key names with the spirit or skill prefix, so they never collide with traits or other spirits.

### 4.2 Display

The KIT hook's `marks` returns `{ id: 'kit:heat', n: 3, note: 'Dragonflame' }`, which appears in the spirit's mark bar (`CombatantView.marks`); lasting effects display automatically as `fx:<skill id>`.

### 4.3 Rewriting a Trait

When a kit writes `"trait": { "name", "text" }`, the UI shows the new trait and **every implementation of the old trait is disabled** (the TRAITS in `traits.ts` and the hard-coded per-spirit checks in `battle.ts` all go through `legacyTrait(c)`); the new trait is written in `KIT[spirit id]` in `src/engine/kits/<group>.ts`. Without `trait`, the old trait keeps working and the KIT hooks take effect alongside it.

## 5. Design References

Borrow from Pokemon, Yu-Gi-Oh! and 4399 Seer, above all the strategic depth of Yu-Gi-Oh! and Seer. Seer's skills are the most varied, but too complex for us, so use them only as a reference. **The limits do not change: at most two effects per skill, numbers written out** (05 §3).

**Seer**
- Soul-mark-style defining passives: signature mechanic plus trait (KIT hooks).
- "Timed effects" and "stat boosts" are two kinds of buff, each with its own removal: removing boosts is the `dispel` tag; removing timed effects is the `dispelTurns` tag or `b.clearLasting()`. Lasting effects (§8.3) are timed effects.
- Act-first / act-last clauses: `b.hasActed(b.foe(id))` (the foe has already acted means you act last).
- Fixed damage / percentage damage: `b.damage(target, amount)` / `b.trueDamage(target, %)` (they skip defense).
- A guaranteed crit on the next hit: a lasting effect with `critBonus: () => 1`, removed in `onDealt`; for "Exposed (破綻)" on the foe, use the `expose` tag.
- Immunity to the next status condition: a lasting effect whose `blockStatus` returns true and removes itself.
- "For N turns, the foe's attacks of element X have no effect": a lasting effect with `immune`.
- A fifth-skill-style finisher: a flagship skill at Lv 45-55, or the ultimate.

**Yu-Gi-Oh!**
- Archetype counters (accumulate, then spend all at once): a `c.vars` counter, `marks` for display, and a consuming skill (example 2).
- Trading a cost for power: `b.payAether()`, self-damage (`selfDamage` / `b.damage(self)`), `recoil`.
- Set-card bluffs and chains: traps (§8.2); the foe sees only the face-down card and the change in Aether.
- Floaters (effects on being knocked out or leaving): the KIT's `onFaint` / `onLeave`, or the trap's `fainted`.
- Hand traps: bench effects `bench` (§8.4), which respond even when the spirit is not on the field.
- A once-per-battle bomb: a `vars` flag (`once`).
- A lockdown with a window to answer it: a lasting effect `canUse` (skill seal) placed on the foe, but leave an answer (switching clears it, and the turns are limited).

**Pokemon**
- A readable "setup, then sweep", entry hazards (`hazard`), pivot play (`pivot`), priority, Protect / Substitute / Baton Pass (Guard, `decoy`, `baton`), weather and terrain (`field`), signature moves.
- Rule-rewriting moves (Trick Room is `b.toggleReverseOrder()`) are best saved for SSRs.

## 6. Budget

| Skill | Budget range |
| --- | --- |
| Basic skills (`_basic.json`, read-only) | 0.85-1.05 |
| Regular exclusive skills | 0.85-1.15 |
| Flagship skills (`tags.sig: 1`) | 1.00 to the rarity cap (§3) |
| Ultimates | target = 175 + premium (80 for N/R/SR, 100 for SSR), 0.85-1.15 |

- The valuation table is in 05 §7.2. New tags:
  - `custom: n`: the valuation points of an **effect implemented by a hook** (like `cond`; explain in `note` how you estimated it). Whatever a hook does must be valued.
  - `sig: 1`: flagship skill. It adds no value and only loosens the cap; the count per spirit is in §3; it cannot be placed on a basic skill or an ultimate.
  - `dispelTurns: 1`: removes the foe's timed effects (35).
- `cond` is the expected value of a conditional bonus; `adjust` is a manual correction.
- The budget is only a starting point. When you are done, run `npm run tiers` (§11) and look at the real win rates.

## 7. Tags: Resolved by the Engine vs Budget-Only

**Resolved automatically** (after an attack hits or when a Status skill is used):
- On the foe: `status.<condition>` (<=1 is a chance; for poison, >=1 is a stack count), `foe.<stat>` (used with `foeChance`), `dispel`, `dispelTurns`, `disable`, `invertStages`, `stealStages`, `expose`, `perish`, `painSplit`, `transferStatus`, `revealTrap`, `destroyTrap`, `bind` (attack), `forceSwitch` (attack), `aeDrain` / `aeSteal` (attack)
- On yourself: `self.<stat>`, `heal`, `teamHeal`, `shield`, `cleanse`, `teamCleanse`, `charges` (positive), `aeGain`, `aeLoan`, `field` (a field of the skill's element for 5 turns), `wish`, `decoy`, `copyStages`, `bond`, `retaliate`, `screenPhys`, `screenMag`, `baton`, `healWish`, `pivot`
- On the foe's side (Status skills): `hazard`, `hazardSpd`, `doom`
- Attack modes: `hits`, `critRate`, `armorPen`, `ignoreGuard`, `drain`, `recoil`, `charge` (plus `dig`), `gamble`, `aetherPower`, `useDef`, `foeAtk`, `bestDef`, `hpHigh`, `hpLow`, `spdPower`, `snowball`, `echo`, `selfKO`

**Budget-only** (write the effect yourself in a hook): `trueDamage`, `selfDamage`, `cond`, `custom`, `adjust`, `sig`, `odds`, `side`, `block`, `lifeSave`, `reduce`, `reflect`, `negateSkill`, `negateTrap`, negative `charges`, and every effect tag of a trap (traps are always resolved by the trap hook).

To have an automatic tag handled by a hook instead (e.g. "10% Bleed per hit"), write `manual: ['status.bleed']` in the hook: the budget still counts it, and the engine does not resolve it automatically.

## 8. Hook API

All types are in `src/engine/skillfx.ts` (fully commented). A group file looks like this:

```ts
import type { KitHooks, SkillHooks } from '../skillfx.ts';
export const FX: Record<string, SkillHooks> = { /* skill id -> skill hooks */ };
export const KIT: Record<string, KitHooks> = { /* spirit id -> kit hooks */ };
```

**Only `import type { Battle }`** (importing `battle.ts` at runtime creates a circular dependency). You may import the small helpers from `../skillfx.ts` (`isAttack`, `getVar`, `addVar`, `statusCount`, `buffTotal`) and `getSkill` from `../../data.ts`.

### 8.1 Skill Hooks `SkillHooks`

| Hook | When | Notes |
| --- | --- | --- |
| `canUse(b, id)` | When choosing, when using | Returns the reason the skill cannot be used (shown on the card); return `null` if it can be used |
| `cost(b, id, base)` | Same | The actual cost |
| `priority(b, id)` | When ordering | Added to the priority |
| `power(b, ctx, base)` | Attack, estimate | Returns the new power (conditional power) |
| `accuracy(b, ctx, base)` | Attack, estimate | Accuracy |
| `critBonus(b, ctx)` | Each hit | Crit chance bonus |
| `hits(b, ctx, base)` | Attack, estimate | The number of hits; power per hit = power ÷ `tags.hits`; when estimating, return the expected value |
| `onHit(b, ctx, hit)` | After each hit lands | `hit = { index, hits, dmg, crit, ko }` (not called for hits absorbed by a decoy) |
| `afterAttack(b, ctx, res)` | After all hits | Called only if the attack hit; before recoil, drain and added effects. `res = { dealt, ko, hits, decoyBlocked }` |
| `effect(b, id, sk)` | Status skills | After the tag effects; not called on a miss; a decoy does not block it automatically (check `b.active(foe).decoy` yourself) |
| `afterUse(b, id, sk)` | After full resolution | Called for both attacks and Status skills; not called if the user has left the field or fainted |
| `redirect(b, id)` | On use | Use a different skill instead (copy-type skills): return `{ skill, cost, powerMult?, text? }` or a failure reason |
| `pursuit: n` | When the foe switches | Acts before the foe leaves, at power ×n |
| `manual: [...]` | n/a | Tags that are only budgeted and not resolved automatically |
| `trap` | n/a | A trap (§8.2); required for traps |
| `lasting` | n/a | The lasting effect this skill creates (§8.3) |
| `aiScore(b, id, base)` | AI evaluation | Extra score (§8.5) |

`ctx` (`HitCtx`): `attacker`, `defender`, `sk`, `cat` (physical or magic), `guardBroken` (the foe guarded but the Guard was pierced), `followUp` (echo, follow-up attacks), `estimate` (**true while estimating: read-only; no dice rolls and no state changes**).

### 8.2 Traps

```ts
trap: { on: 'event', when?(b, owner, ev): boolean, fire(b, owner, ev): TrapResult | void }
```

| `on` | When | `ev` | Meaningful results |
| --- | --- | --- | --- |
| `foeEnter` | After the foe's spirit enters by switch or replacement (the opening does not count) | none | none |
| `foeLeave` | The foe declares a switch, before it leaves | `to` | `negate`: the switch fails |
| `foeAttack` | After the foe's attack passes its hit check, before damage | `ctx`, `eff` (matchup multiplier) | `reduce`, `reflect`, `negate`, `escape`, `after` |
| `foeStatus` | The foe uses a Status skill, before its effect | `sk` | `negate`: the Status skill has no effect |
| `foeSetTrap` | After the foe sets a trap | `skillId` | `negate`: destroys that trap |
| `foeTrapFire` | When the foe's trap fires (chain) | `skillId` | `negate`: nullifies it (**must be a Counter trap**) |
| `foeCharge` | The foe starts Charging | `skillId` | `negate`: interrupts |
| `foeBuff` | After the foe's stat stage rises | `stat`, `delta` | none |
| `foeHeal` | After the foe recovers HP | `amount` | none |
| `lethal` | Our spirit is about to be knocked out by an attack | `ctx`, `dmg` | `survive`: leave 1 HP |
| `fainted` | After our spirit is knocked out by the foe | `by`, `byAttack` | none |
| `turnEnd` | End of turn (after status damage and traits) | none | none |

- `owner` is the trap's owner, and the foe is `b.foe(owner)`. When `fire` is called, the trap has already left the trap slot and the chain has been resolved.
- `after` runs once the engine has processed the result (for `foeAttack`, after the whole attack has resolved, while the attacker is still on the field).
- The engine handles the speed rules: a Normal trap can fire only from the **turn after** it is set; a Quick trap can fire in the same turn; the **Eternal Night** (永夜) field makes all traps Quick; a Counter trap can respond only to a trap or a skill (`foeTrapFire` / `foeAttack` / `foeStatus` / `foeCharge`); chains are at most 3 deep.
- A trap's effect tags are budget-only. To apply a tag effect to the foe, call `b.applyTargetEffects(owner, getSkill('your trap'))` inside `fire`.

### 8.3 Lasting Effects (Timed Effects)

```ts
b.addLasting(target, 'skill id', turns, { n?, side?: true, from? })
```

- Write the hook in that skill's `lasting`. `turns` includes the current turn (it drops by 1 at the end of each turn; when it reaches 0, `onExpire` is called and the effect is removed); creating the effect again refreshes the turn count.
- Placed on the spirit (default): cleared when the spirit leaves the field. `side: true` places it on the side: it keeps applying to whichever spirit is on the field after switches.
- `from` defaults to the target itself (a buff); for a debuff placed on the foe write `from: id`. `b.clearLasting(target, 'own' | 'foe' | 'all')` (removing timed effects) distinguishes the two by this.
- `LastingHooks`: `attackBonus`, `reduce`, `immune`, `critBonus`, `priority`, `canUse`, `onHitTaken`, `onDealt`, `blockStatus`, `blockHeal`, `onTurnEnd`, `onExpire`, `name`.
- Reading: `b.getLasting(target, id)`, `b.lastingOf(target)`; removing: `b.removeLasting(target, id)`.

> Hooks added during development (see `src/engine/skillfx.ts` for details): `SkillHooks.pierceGuard(b, id)` (conditionally pierce Guard), `LastingHooks.blockAction(b, owner, sk, e)` (a lasting effect that nullifies an action), `SkillHooks.emergesFirst(b, holder, sk)` (during a burrowing Charge: returns true if the spirit will surface before the foe acts with `sk`, so that `estimate` and the AI know the hit will land).

### 8.4 Kit Hooks `KIT` (Signature Mechanics, Traits)

They have the same shape as the trait hooks in `traits.ts`, and the engine calls them at the same moments: `onEnter`, `onLeave`, `onEndTurn`, `attackBonus`, `critBonus`, `hitSplit`, `priorityBonus`, `freeFirstSkill`, `critImmune`, `blockPriority`, `accuracyMult`, `absorb`, `incoming`, `onGuarded`, `onHitTaken`, `hpTrigger`, `onFaint`, `blockStatDrop`, `onFoeStatusSkill`, `onTrapActivated`, `statMult`, `forceSwitchImmune`, `lockFoeSwitch` (explained in `traits.ts`). In addition:

- `marks(b, id)`: returns the state marks (§4.2).
- `typeMult(b, a, eff)` (attacker): rewrites the matchup multiplier (e.g. ignore resistance); the on-screen 「效果絕佳／不好」 (Super effective / Not very effective) follows the returned value.
- `aiGuard(b, id, base)`: the score adjustment when your own AI considers Guarding; `aiFoeGuard(b, id, base)`: the score adjustment when the **foe's** AI considers Guarding (e.g. when Time Seal (時印) is about to come due, so the foe knows to Guard).
- `bench`: **bench effects** (they trigger even when the spirit is not on the field and has not fainted): `onAllyFaint`, `onAllyHit`, `onFoeSkill`, `onTurnEnd`. The parameter `self` is this spirit's index in the team (`b.side(side).team[self]`). Do not switch spirits in the middle of attack resolution; to "jump out", call `b.switchTo(side, self)` in `onAllyFaint` or `onTurnEnd`.

### 8.5 AI

The AI scores each move from its tags and the situation (a normal attack scores about 20-100, +60 if it can knock out), then adds the value returned by `aiScore(b, id, base)`. Use it to teach the AI your combo: a large bonus when it is ready, a penalty when it is not. For a trap, `aiScore(b, id, 0)` decides which one to set and how willing the AI is to set it (default 55%; +100 points is about always). The AI also judges Guarding itself (when the foe has saved up Aether for an ultimate or a big hit is estimated). To adjust its willingness to Guard, use the KIT's `aiGuard` / `aiFoeGuard` (§8.4).

### 8.6 Public Methods of Battle

| Category | Methods |
| --- | --- |
| Reading | `b.s` (`turn`, `field`, `reverseOrder`), `b.side(id)`, `b.active(id)`, `b.foe(id)`, `b.rng()`, `b.effStat(c, stat, id)`, `b.aliveBench(id)`, `b.estimate(id, skill)`, `b.costFor(id, sk)`, `b.canUse`, `b.canSwitch`, `b.canGuard`, `b.trapReady(id)`, `b.hasActed(id)`, `b.tagsOf(sk)`, `b.attackCategory(c, sk, foe)` |
| Damage and healing | `b.damage(target, amount, reason)`, `b.trueDamage(target, %, reason)`, `b.heal(target, %)`, `b.healAmount(target, amount)`, `b.giveShield(target, %)` |
| Status | `b.applyStatus(target, status, stacks?, turns?)`, `b.removeStatus`, `b.cleanse(target, wholeTeam?)`, `b.changeStage(target, stat, ±n, fromFoe?)`, `b.resetStages`, `b.dispel`, `b.clearLasting`, `b.invertStages`, `b.stealStages`, `b.copyStages`, `b.transferStatus`, `b.painSplit`, `b.disableSkill(target, turns)` |
| Resources | `b.gainAether(id, ±n)`, `b.payAether(id, n)`, `b.drainAether(id, n, steal?)`, `b.addCharges(target, ±n)` |
| Fields and sides | `b.setField(element, turns)`, `b.setScreen(id, 'phys' \| 'mag', %, turns)`, `b.toggleReverseOrder(turns)`, `b.addLasting`, `b.removeLasting` |
| Switching | `b.forceSwitch(target)` (random), `b.autoSwitch(id)` (highest HP), `b.switchTo(id, index)` |
| Traps | `b.revealTrap(owner)`, `b.destroyTrap(owner)` |
| Attack | `b.followUp(id, attackSkill, multiplier, text?)`: attacks again immediately (costs no Aether and does not count as the main action) |
| Tag effects | `b.applyTargetEffects(id, sk)`, `b.applySelfEffects(id, sk)` |
| Presentation | `b.text('text')` (battle log and screen), `b.traitEvent(id, 'name')` (trait activation banner) |

Commonly used fields of a spirit (`b.active(id)`): `hp`, `maxHp`, `status` (`{ burn: { turns } , poison: { turns, stacks } }`), `stages`, `vars`, `charges`, `shield`, `lasting`, `skills`, `species`, `lastSkill`, `usedSinceEnter`, `enteredTurn`, `hpAtTurnStart`, `hitByPhysicalThisTurn`, `usedAttackThisTurn`, `guarding`, `fainted`. A side (`b.side(id)`): `aether`, `trap`, `vars`, `lasting`, `ultUsed`, `lastAttackSkill`, `lastStatusSkill`, `screens`, `hazard`, `tailwind`.

Status ids: `burn` Burn (灼燒), `poison` Poison (中毒, stacking), `bleed` Bleed (裂傷), `freeze` Freeze (冰凍), `sleep` Sleep (睡眠), `fear` Fear (恐懼), `paralyze` Paralysis (麻痺), `root` Root (束縛), `silence` Silence (沉默), `taunt` Taunt (挑釁), `curse` Curse (詛咒) (effects in 04 §9). Stats: `atk`, `mag`, `def`, `res`, `spd`.

## 9. Examples

**① A finisher with conditional power** (set up, then cash in)

```ts
pyd_dragon_rush: {
  // +30 power per stack of Dragonflame, cleared after the attack
  power: (b, c, p) => p + 30 * getVar(b, c.attacker, 'pyd:heat'),
  afterAttack: (b, c) => void (b.active(c.attacker).vars['pyd:heat'] = 0),
  aiScore: (b, id) => (getVar(b, id, 'pyd:heat') >= 2 ? 40 : -20),
},
```

**② A stack counter with display** (KIT hook)

```ts
export const KIT: Record<string, KitHooks> = {
  pyre_dragoon: {
    marks: (b, id) => {
      const n = getVar(b, id, 'pyd:heat');
      return n ? [{ id: 'kit:heat', n, note: 'Dragonflame' }] : [];
    },
  },
};
// Skill: +1 stack on hit (max 3)
pyd_tail_lash: { onHit: (b, c) => void addVar(b, c.attacker, 'pyd:heat', 1, 3) },
```

**③ A trap: when the foe enters**

```ts
sdr_sand_pit: {
  trap: {
    on: 'foeEnter',
    when: (b, owner) => b.active(b.foe(owner)).stats.spd > b.active(owner).stats.spd,
    fire: (b, owner) => {
      const f = b.foe(owner);
      b.trueDamage(f, 10, 'trap');
      if (!b.active(f).fainted) b.changeStage(f, 'spd', -2, true);
    },
  },
  aiScore: (b, id) => (b.aliveBench(b.foe(id)).length > 0 ? 30 : -100),
},
```

**④ A lasting effect: reduced damage for 3 turns, and immunity to Burn**

```ts
elw_bark_skin: {
  effect: (b, id) => void b.addLasting(id, 'elw_bark_skin', 3),
  lasting: {
    reduce: (_b, ctx) => (ctx.cat === 'physical' ? 0.3 : 0),
    blockStatus: (_b, _o, st) => st === 'burn',
  },
},
```

**⑤ A bench effect (hand trap): when an ally faints, once per battle, the spirit enters and gives itself a shield**

```ts
KIT.lanternfish = {
  bench: {
    onAllyFaint: (b, side, self) => {
      const me = b.side(side).team[self];
      if (me.vars['lnt:vow']) return;
      me.vars['lnt:vow'] = 1;
      b.text(`${me.name} responded to its ally's fall!`);
    },
  },
  onEnter: (b, id) => {
    if (b.active(id).vars['lnt:vow'] === 1) {
      b.active(id).vars['lnt:vow'] = 2;
      b.giveShield(id, 30);
    }
  },
};
```

**⑥ Rewriting a trait**: in `data/kits/<group>.json` write `"trait": { "name": "…", "text": "…" }`, then put the new effect in `KIT[spirit id]`; the old trait is disabled automatically.

## 10. Skill ids and Where They Are Defined

- Each skill is defined in exactly one file: exclusive skills in the owner's group file, basic skills in `_basic.json`, Guard in `_system.json`. The old shared skill table (`_legacy.json`) was deleted once every spirit had moved to the new kits.
- If two group files define the same id, or override a basic or system skill, `kits.test` fails on both sides.
- When an engine test needs a generic tag, use the `t_` test skills in `src/engine/testkit.ts` (or register them in the test file with `registerTestSkills`); do not borrow a spirit's exclusive skill. That way a test does not break when an exclusive skill is revised.

## 11. Validation and Playtesting

```sh
KIT=fire node --test sim/kits.test.ts            # test only your own group (structure, budget, every skill run once, AI duels)
npx tsc --noEmit -p . 2>&1 | grep kits/fire      # type errors in your own files only (others may be mid-edit)
npm run kits -- fire                             # each spirit's learnset, budget ratios and problems
npm run kits -- basic                            # the basic skill pool
npm run duel -- pyre_dragoon ignisar --lv 55     # text battle log (--team, --seed, --skills a,b,c,d)
npm run tiers                                    # rarity round robin: SSR > SR > R > N?
node --test src/engine/kits/fire.test.ts         # your own mechanic tests (use duel / turn / use / guard from src/engine/testkit.ts)
```

- In-game playtest: `npm run dev`, then open `http://localhost:5173/?devsave` (a test save that does not touch the cloud) or `?devsave=late`; loading a save automatically fixes the skill slots.
- While other groups are mid-edit, the full `npm test` may fail because of other people's files; for your group, passing with `KIT=` is enough.

## 12. Common Mistakes

- A trap without a trap hook never fires (a test catches it).
- Rolling dice or changing state inside `power` / `hits` / `accuracy` also happens when the AI estimates. Check `ctx.estimate` first.
- A hook does something but the budget does not value it (you forgot `custom`): the skill is too strong.
- The text and the effect disagree, there are more than two effects, or the numbers are not written out (05 §3).
- Using `Math.random()`: use `b.rng()`.
- A runtime `import { Battle }` in a group file creates a circular dependency; use `import type`.
- Putting `guard`, or a shared skill that is not a basic skill, into a learnset.
- Forgetting `core`: the AI and newly obtained spirits will not carry your combo skills.
