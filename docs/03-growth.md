# 03 Stats and Growth

> Code: `sim/formulas.ts` | Actual numbers for each spirit: Spirit Codex (`docs/catalog/spirits.md`, written by `npm run report`) | Curves and tables: [Balance Report](catalog/balance-report.md)

## 1. Design Principle: Few Systems, All Felt

Seer (賽爾號) has deep progression, but individual values, effort values, natures and imprint affixes pile up in layers. Players spend large amounts of time grinding numbers and can barely feel the difference. Eldor's principles are:

1. **Spirits of the same species have the same stats.** Two Lv 60 Pyre Dragoons (熾焰龍騎) are identical in every stat; they differ only in loadout and emblem. There is no grinding for individual rolls.
2. **Every step of growth is visible.** Leveling makes the numbers bigger, a Breakthrough makes the stats jump a step, and the spirit grows a little larger.
3. **Choices over grinding.** The depth of progression lives in "which 4 skills to bring and which emblem to equip", not in "grind until the affixes are perfect".
4. **PvP does not compare play time.** The standard arena flattens levels to 60 automatically and turns Resonance off (see [04 Battle §1](04-battle.md#1-battle-modes)).

### Comparison with Seer

| Seer | Eldor | Reason |
| --- | --- | --- |
| Individual values (random 0-31) | **None** | Same-species spirits have identical stats, so there is nothing to grind |
| Effort values (stat allocation) | **None** | The stat distribution is set by base stats; personality comes from the loadout |
| Natures (±10% stats) | **None** | Same as above |
| Traits | Kept: **1 fixed trait per spirit** | A trait is the core of a spirit's personality, but it is not random |
| Imprints, soul marks and other random affixes | **Emblems (紋章)**: fixed effects, no randomness, not in the gacha pool | Keeps the fun of building a set, removes affix grinding |
| Level cap 100 | **Level cap 60** | Shortens the time spent growing a spirit |
| Evolution | Replaced by **two Breakthroughs** (three stages); appearance and name stay the same | A leap in stats and the unlock of the Ultimate are the greatest joys of raising a pet |

### Three Growth Axes

| Axis | What it does | Effect | How to get it |
| --- | --- | --- | --- |
| **Level** | Battles, EXP Potions | All stats grow linearly with level | Play |
| **Breakthrough (突破)** | Spend materials after reaching the level cap | Stats jump a step, unlocks skills and the Ultimate, the spirit grows taller | Play |
| **Resonance (共鳴)** | Pull a duplicate spirit | Small all-stat bonus plus cosmetics | Gacha (affects PvE only) |

There are also two "build" systems: the **Skill Loadout (技能配置)** and the **Emblem (紋章)**. They are choices, not stats to grind.

## 2. The Six Stats

| Stat | Code | Role |
| --- | --- | --- |
| Health (生命) | HP | Reaching zero means the spirit faints |
| Attack (力量) | ATK | The offense of Physical skills |
| Magic Power (魔力) | MAG | The offense of Magic skills |
| Defense (護甲) | DEF | Resists Physical skills |
| Resistance (抗魔) | RES | Resists Magic skills |
| Speed (速度) | SPD | Decides the acting order at equal priority |

The split between Physical (武技) and Magic (魔法) shows up directly in the stats: Attack against Defense, Magic Power against Resistance. A team has to withstand both kinds of attack.

## 3. Base Stats and Rarity

Each species has a fixed set of **base stats**. The base stat total (BST) is set by rarity:

| Rarity | BST | How to get it | Role |
| --- | --- | --- | --- |
| N | 450 | Captured in the field | Narrow but useful; the cheapest pick in the standard arena's "cost" budget |
| R | 480 | Capture (rare spawn), summon | The workhorses |
| SR | 510 | Summon, rare capture, Stardust exchange | Specialists with unique mechanics |
| SSR | 540 | Summon; Eldarin, Dragon of the First Pact (初契之龍・艾爾達林) is the starting partner, a pact made at the start of the game | The Eight Sacred Spirits: set a field on entry, exclusive Ultimate |

An SSR's BST is 20% above an N's. The standard arena balances this with a "cost cap" (SSR costs 5, N costs 2; see [04 Battle §2](04-battle.md#2-team-rules)).

## 4. The Stat Formula

```
stat   = floor( base × growth factor × stage factor × (1 + resonance bonus) )
health = floor( base × growth factor × stage factor × (1 + resonance bonus) × 2 )

growth factor = 1 + level ÷ 10          (each level adds 10% of the base)
```

| Level | 1 | 10 | 20 | 30 | 40 | 50 | 60 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Growth factor | 1.1 | 2 | 3 | 4 | 5 | 6 | **7** |

So a Lv 60, Stage III stat is simply "base × 7" (health ×2 on top). A base Attack of 100 is 700 at Lv 60, which is easy to do in your head.

Example (Pyre Dragoon, base Attack 110):

| | Lv 1 (I) | Lv 20 (I) | Lv 20 (II, just broken through) | Lv 40 (III, just broken through) | Lv 60 (III) |
| --- | --- | --- | --- | --- | --- |
| Attack | 102 | 280 | **306** | **550** | 770 |

The full curve is in [Balance Report §3](catalog/balance-report.md).

## 5. Breakthrough

| Stage | Level cap | Stage factor | Unlocks |
| --- | --- | --- | --- |
| I | 20 | ×0.85 | Entries 1-5 of the learnable skill list (Lv 1 / 5 / 10 / 15 / 20) |
| II (first Breakthrough) | 40 | ×0.93 | Entries 6-9 (Lv 25 / 30 / 35 / 40) |
| III (second Breakthrough) | 60 | ×1.00 | **Ultimate (奧義)** |

- A spirit can break through to the next stage only after reaching its level cap. At the moment of Breakthrough the stats jump a step (+9%, +7.5%), a major moment of satisfaction.
- Every spirit, whatever its rarity, has a single form and a single name (decided by the project owner on 2026-09-28): the three stages use the same model, only scaled up by the rarity height table (see `TARGET` in `src/render/species.ts`), and a Breakthrough does not rename the spirit.

### Materials

| Stage | Breakthrough Stones (of the matching element) | Source Crystal Shards | Gold |
| --- | --- | --- | --- |
| I → II | 5 | None | 5,000 |
| II → III | 15 | 3 | 30,000 |

Breakthrough Stones come from field battles in the matching region and the daily dungeon; Source Crystal Shards come from Source Crystal Trials and weekly challenges.

## 6. Experience

```
EXP to next level = 2 × level² + 24 × level + 40
EXP for defeating a wild spirit = (20 + 10 × enemy level) × level-difference modifier
```

| Level difference (enemy − mine) | Modifier |
| --- | --- |
| ≥ 0 | 1 + 0.04 × difference (at most ×1.2) |
| −1 to −4 | ×1 |
| ≤ −5 | ×0.5 |

- A spirit that fights gets the full amount; spirits in the team that did not fight get 50%.
- Against a wild spirit of the same level, one level takes about 2 battles at Lv 1, 6 at Lv 20, 10 at Lv 40 and 14 at Lv 59.
- Going from 1 to 60 takes **185,260** EXP in total. The daily dungeon's EXP Potions let a main spirit reach the cap in about 3-4 weeks, and a bench spirit can be raised directly with potions.

## 7. Resonance (Duplicate Pulls)

| Resonance | All stats | Appearance |
| --- | --- | --- |
| R1 | +3% | No change |
| R2 | +3% | Upgraded Ultimate cinematic (new camera work and effects) |
| R3 | +6% | No change |
| R4 | +6% | Exclusive idle animation and voice |
| R5 | **+10%** | Resonance color scheme, title |

- Resonance affects PvE only. **In the standard arena every spirit counts as R0.**
- Duplicates beyond R5 convert into Stardust (星塵), which can be exchanged in the shop; see [06 Gacha and Economy](06-gacha-economy.md).
- Resonance does not change skills or traits, which avoids the feeling that a spirit is incomplete until fully pulled.

## 8. Skill Loadout

- Each spirit carries **4 skills** plus **1 Ultimate** (unlocked at Stage III, fixed and not swappable).
- Skills have only one source: **the spirit's own skill list (learnset)**. As in Seer, each spirit learns 10-15 skills by level starting at Lv 1 (more for higher rarity), the last one no later than Lv 55. The learnset is written in `data/kits/<element group>.json`; the rules are in [10 Kit Authoring Guide](10-kit-authoring.md).
  - **Exclusive skills**: only this spirit has them, designed around its signature mechanic and chaining into each other. 1-3 of them are **flagship skills**.
  - **Basic skills**: plain element skills (`data/kits/_basic.json`); a spirit of the same element, or a Neutral one, learns a few before Lv 25; the higher the rarity, the fewer.
  - There are no universal skills and no skill books.
- **Guard (格擋)** is a system action (always selectable, like switching) and does not take a skill slot.
- When leveling up teaches a new skill, it goes into a free skill slot automatically; the Skill Loadout screen lets you freely swap among learned skills.
- Traps also take a skill slot. Bringing a trap means one fewer attack, which is a trade-off when building.

## 9. Emblems

Each spirit can equip **1 emblem**. Effects are fixed, with no random affixes. Emblems are crafted with gold and materials and are not in the gacha pool.

| Emblem | Effect |
| --- | --- |
| Guardian Emblem (守護紋章) | Max HP +10% |
| Power Emblem (力量紋章) | Attack +10% |
| Mana Emblem (魔力紋章) | Magic Power +10% |
| Swift Emblem (迅捷紋章) | Speed +10% |
| Unyielding Emblem (不屈紋章) | If hit by lethal damage at full HP, survive with 1 HP (once per battle) |
| Leeway Emblem (餘裕紋章) | The first skill after entering costs 1 less |
| Purity Emblem (淨化紋章) | The duration of own status conditions −1 turn |
| Initiative Emblem (先機紋章) | Speed +1 stage on entering |
| Ambush Emblem (伏咒紋章) | Traps set by this spirit cost 1 less (minimum 1) |
| Elemental Charm (屬性護符), 8 kinds | Damage taken from the chosen element −20% |

Rule: a team cannot equip duplicate emblems (the same as Pokemon's item clause), which keeps team building varied.

## 10. Bonds

- Bond (羈絆) levels (0-10) rise when a spirit fights, is fed, or is played with in the Spirit Lodge (精靈小屋) (petting, throwing a ball, changing outfits).
- Bonds unlock voices, interaction animations, background stories, name-card frames and lodge furniture.
- **Bonds do not affect any stat.** They are the emotional payoff of "raising a pet", not another progression line that must be ground.

## 11. Cost of Taking One Spirit from 0 to Max (Estimate)

| Item | Amount | Time to obtain (30-45 minutes of play per day) |
| --- | --- | --- |
| EXP 1 → 60 | 185,260 | About 3-4 weeks (main spirit); about 1 week with potions (bench spirit) |
| Breakthrough Stones | 20 | About 1 week |
| Source Crystal Shards | 3 | About 1 week |
| Gold | 35,000 (plus skill books and emblems) | About 1 week |
| Emblem | 1 | About 2-3 days |

Target: **a new player can raise a full team of three main spirits in about a month**, and afterwards each new spirit takes about a week to bring into the arena.
