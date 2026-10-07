# 05 Skill Design

> Data: `data/kits/*.json` (one file per element group) | Budget code: `sim/budget.ts`, `sim/kitrules.ts` | Authoring guide: [10 Kit Authoring Guide](10-kit-authoring.md) | Full skill table: Skill List (`docs/catalog/skills.md`, written by `npm run report`)

## 1. Design Philosophy

Eldor's skill design borrows from two sources:

- **Seer (賽爾號)**: a skill is more than a damage number. Buffs, debuffs, status conditions and timed effects interlock into a battle of rhythm.
- **Yu-Gi-Oh! (遊戲王)**: face-down traps, chains and counters, and the combos of archetype decks. The face-down card on the opponent's side is a form of pressure in itself.

Five principles:

1. **Every skill needs an answer.** When designing a skill, first write down "how can the opponent respond?" A skill with no answer does not ship.
2. **Information is a resource.** Skill loadouts are hidden, traps (伏技) are set face down, and Aether (靈能) is public. Players deduce the opponent's hand from limited information.
3. **Text must read at a glance.** One set of keywords and one card format, with at most two effects per skill.
4. **Element is archetype.** Skills of the same element combo with each other (apply a status first, then detonate it), like the archetype cards of Yu-Gi-Oh!.
5. **Numbers hold the balance.** Every skill goes through a budget calculation (§7); a new skill never gets its numbers by feel.

### 1.1 Kits: Every Spirit Has Its Own Skill List

- **Every skill is exclusive.** Each spirit has its own complete skill list (learnset), learned by level from Lv 1 with the last one no later than Lv 55, plus one exclusive Ultimate (奧義). The skills are designed around that spirit's **signature mechanic** and combo with each other (set up, then pay off); they are not a set of independent moves.
- The only shared skills are **basic skills** (`data/kits/_basic.json`): about 5 plain skills per element, of which a spirit of the same element or Neutral can learn a few before Lv 25. The higher the rarity, the fewer basic skills and the more exclusive skills.
- **Flagship skills** (`sig`): each spirit has 1-3 representative moves, which are allowed a slightly higher budget ratio.
- **There are no universal skills.** **Guard (格擋)** is a system action: like switching, it can be chosen at any time and takes no skill slot (see 04 §10).
- Rarity differences come from the completeness of the mechanic and the kit, not from overwhelming numbers. Rules and tiers are in [10 Kit Authoring Guide](10-kit-authoring.md).

## 2. The Five Skill Types

| Type | Code id | Calculated from | Description | Examples |
| --- | --- | --- | --- | --- |
| **Physical** (武技) | `physical` | Attack vs Defense | Claws, fangs, blades and rams: close-range strikes with the body | Blaze Slash (烈焰斬), Iaido (拔刀・一閃) |
| **Magic** (魔法) | `magic` | Magic Power vs Resistance | Breath, beams and incantations: ranged strikes powered by Aether | Fireball (火球術), Tidal Surge (潮湧) |
| **Status** (秘術) | `status` | None | Deals no damage: buffs, status conditions, fields, healing, shields | Heat Up (升溫), Toxic Spores (毒孢子), Blazing Sun (烈陽) |
| **Trap** (伏技) | `trap` | None | Set face down; activates automatically when its condition is met, and takes no action | Quicksand (流沙陷阱), Stone Counter (磐石反擊) |
| **Ultimate** (奧義) | `ultimate` | Higher of Attack / Magic Power (or as specified) | Unlocks at Stage III; once per battle per Pactbearer | Crimson Dragonblade (紅蓮龍劍), Eclipse Fang (月蝕之牙) |

## 3. The Skill Card Format

Every skill is shown in the UI on the same "card":

```
┌────────────────────────────────────────┐
│ Shatter Lance                      [2] │ ← Name, cost
│ Water | Physical                       │ ← Element, type
│ Power 90   Accuracy 100   Priority 0   │
├────────────────────────────────────────┤
│ If the opponent has "Freeze", power    │ ← Effect text
│ ×2 and remove its "Freeze".            │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ Quicksand                     [1] Trap │
│ Earth | Trap (Normal)                  │
├────────────────────────────────────────┤
│ Trigger: when an opposing spirit       │ ← A trap always states its trigger first
│ switches in.                           │
│ The incoming spirit takes damage equal │
│ to 8% of its max HP, loses 1 Speed     │
│ stage, and gets "Root" for 2 turns.    │
└────────────────────────────────────────┘
```

### Text Rules

- Keywords (status conditions, fields, special mechanics) are always enclosed in quotation marks, and can be tapped in the UI to see an explanation.
- The order is fixed: **condition → effect → cost**. Example: "If the opponent is Burned (condition), power +80 (effect), and remove its Burn (cost)".
- Always write the numbers out. Never write "greatly" or "slightly".
- At most two effects per skill. When a skill needs three, it usually should be split into two skills.

## 4. Keyword Glossary

| Keyword | Meaning |
| --- | --- |
| Priority ±N (先制 ±N) | Action-order modifier, see [04 Battle §4](04-battle.md#4-action-order) |
| Same-element bonus (同屬性加成) | ×1.2 when the skill's element equals the spirit's own element |
| N hits (連擊 N 次) | Split into N hits; shields and triggers are calculated per hit (e.g., Thousand Blades (千風刃)) |
| Charging (蓄力) | Charge this turn, release automatically next turn; can be interrupted |
| Interrupt (打斷) | Cancels the opponent's Charging |
| Recoil (反衝) | The user takes damage equal to a set fraction of the damage dealt |
| Drain (吸取) | Restore HP equal to a set fraction of the damage dealt |
| Shield (護盾) | Absorbs attack damage before HP does |
| Guard (格擋) | System action (takes no skill slot; 1 Aether, priority +3): immune to attacks this turn; always fails if used on consecutive turns |
| Pierce Guard (無視格擋) | Pierces Guard and shields |
| Dispel (驅散) | Removes all of the opponent's positive stat stages and shields |
| Cleanse (淨化) | Removes status conditions |
| Pivot (攻擊後替換) | After resolving, switch with another spirit on the team |
| Forced switch (強制替換) | The opponent switches to a random reserve spirit |
| Pursuit (追擊) | When the opponent switches, hits before they leave |
| Electric Charge (電荷) | Thunder's self-stacking resource (up to 3 stacks), consumed by specific skills |
| Field (場地) | Rewrites the battlefield rules, see [02 Elements and Fields §5](02-elements.md#5-fields) |
| On entry / On leaving (入場時 / 離場時) | Triggers when a spirit enters or leaves the battlefield (traits, traps) |
| When hit (受擊時) | Triggers when an attack lands, before damage is resolved (traps) |
| On KO / When KO'd (擊倒時 / 被擊倒時) | Triggers after damage is resolved |
| Trap: Normal / Quick / Counter (伏技 一般 / 速攻 / 反制) | See §6 |
| Reveal (翻開) | Turns the opponent's trap face up (it stays active) |
| Destroy (破壞) | Removes the opponent's trap outright (it does not activate) |
| Negate (無效) | Makes a skill's or trap's effect not happen |
| Exclusive (專屬) | Only the named spirit can learn it (every skill other than basic skills is exclusive) |
| Basic skill (基礎技能) | A plain skill shared by spirits of the same element or Neutral |
| Flagship skill (招牌技) | A spirit's representative move; its budget ratio may be slightly higher |
| Signature mechanic (專屬機制) | A system unique to each spirit, with visible state (stacks, forms, resources, ...) |
| Timed effect (回合類效果) | An effect that lasts "for N turns"; it can be removed by "dispel timed effects" (which is different from dispelling stat boosts) |
| Moving first / Moving later (先出手 / 後出手) | Conditions that trigger when you act earlier / later than the opponent this turn |

## 5. Interaction Design: Every Turn Is a Mind Game

### 5.1 Rock-Paper-Scissors of Actions

Choosing actions simultaneously turns every turn into a game of rock-paper-scissors:

```
              Full attack
            ╱             ╲
   punishes buffing     stopped by Guard
          ╱                 ╲
 Buff / set trap ───────▶ Guard
   (if the opponent guards, you gain a free turn)
```

- A **full attack** hurts the most on a turn when the opponent buffs.
- **Guard** wastes the opponent's attack, but always fails on consecutive turns, so the turn after a Guard is the opponent's chance.
- **Buffing / setting a trap** pays off most when the opponent guards.
- **Switching** is the fourth option: it dodges an element disadvantage, but is punished by "Pursuit" and greeted by "Quicksand".
- **Skills that hit Guard** (pierce Guard, or power boosted when hitting a Guard) and **skills that wait for the opponent to move first** (Iaido: +80 power after being hit by a Physical skill) give the player who guesses right a clear reward.

### 5.2 Interaction Matrix

Every mechanic has a counter, and every counter has a cost:

| Mechanic | Representative skills | Answered by | Cost to the responder |
| --- | --- | --- | --- |
| High-power attack | Quake (地震), Flare Rush (爆炎突擊) | Guard, Stone Counter, switching to a spirit that resists the element | Guard cannot be chained; a trap must be paid for in Aether first |
| Guard (system action) | None | Skills that pierce Guard (Skybreaker (蒼穹斷界)), Oath of Breaking (破陣之誓) | Pierce-Guard skills are low in power otherwise |
| Stat buffs | Stone Wall (岩壁), Heat Up | Dispel (Judgement Blade (聖劍・審判), Hex (詛咒)), forced switch, Curse (詛咒) | Dispel skills are weaker against an opponent with no buffs |
| Timed effects | Buffs lasting N turns | Dispel timed effects; switching forces a re-set | Useless against an opponent with no timed effects |
| Status conditions | Will-o'-Wisp (鬼火), Toxic Spores, Sleep Powder (催眠花粉) | Cleanse, Sanctuary (聖域), element immunity, switching (Poison (中毒) is halved) | Cleansing takes up a turn |
| Healing | Healing Light (治癒之光), Giga Drain (汲取) | Curse, damage-over-time pressure | None |
| Shield | Water Shield (水盾), Aqua Veil (水幕) | Multi-hit, pierce shields, dispel | None |
| Charging | Thunder Cannon (雷霆砲) | Interrupt (a trap that responds to Charging), Guard, switching | A trap must be paid for in Aether first, and the timing guessed right |
| Switching | Whirl Turn (迴旋風), switching | Pursuit, Quicksand, Root (束縛) | Pursuit is only a normal attack if the opponent does not switch |
| Priority | Wind Cutter (風刃), Flash (閃光) | Paralysis (麻痺) (priority is ignored), Guard (+3, so faster) | None |
| Fields | Blazing Sun, Sanctuary | Overwrite the field, switch to an element that benefits | Costs a turn and 2 Aether |
| Traps | Various traps | Destroy trap, reveal, Divine Judgment (神聖反制), Eye of Insight (看破之眼), Provoke (挑釁) (cannot set traps) | A destroy skill is wasted if the opponent has not set a trap |
| Ultimate | Eclipse Fang | Guard (priority +3, blocks even an Ultimate) | Pierced by Oath of Breaking |

### 5.3 Information Play

| Public information | Hidden information |
| --- | --- |
| Both sides' spirits and elements (public at the start) | Skill loadouts (public once used) |
| Aether count | Emblems (紋章) |
| Field, status conditions, stat stages, shields | Trap contents (only the face-down back can be seen) |
| Whether the Ultimate has been used | Battle Oath (public once used) |

- The opponent's Aether suddenly dropped by 3: they set a 3-cost trap. The only 3-cost trap is Shadow Snare (暗影伏擊陣), and they have a Dark spirit on the field...
- The opponent has banked 5 Aether and has not used their Ultimate: should I Guard this turn?
- The opponent's Battle Oath (戰技) is still unused, and they brought an Oath: my Guard may be pierced by Oath of Breaking.

## 6. Traps and Chains

Traps are the system closest to Yu-Gi-Oh!: set face down, triggered by conditions, resolved in chains.

### 6.1 Trap Rules

| Rule | Content |
| --- | --- |
| Trap slot | **1 slot** per Pactbearer. A trap belongs to the team and stays after spirits switch |
| Setting | Chosen with the main action in the planning phase, paying the cost; only a trap in the **active spirit's skill slots** can be set |
| Visibility | The opponent sees the back and the change in your Aether, but not the contents |
| Overwriting | A new trap can be set while the slot is full; the old one is discarded (it does not activate) |
| Activation | **Activates automatically** the first time its condition is met, then disappears |
| Taunt (挑釁) | Traps cannot be set while Taunted |

### 6.2 Three Speeds

| Speed | Kind | When it can activate | What it can respond to |
| --- | --- | --- | --- |
| 1 | Normal skill (main action) | On your own turn to act | Cannot respond |
| 2 | **Normal trap** | From the **turn after** it is set | Skills, entries, faints and other events |
| 2 | **Quick trap** | On the **same turn** it is set | Same as above |
| 3 | **Counter trap** | From the turn after it is set | **Only** the activation of a trap or a skill |

"Cannot activate on the turn it is set" gives the opponent one turn to see the back and think of a counter; this is the core of the mind game. The Eternal Night (永夜) field makes every trap Quick and breaks that rhythm.

### 6.3 Chains

When an event triggers a trap, a **chain** forms; a trap of equal or higher speed can respond again. Resolution goes **from last to first** (last in, first out).

Example:

```
Chain 1  B's Luminael uses the Status skill "Healing Light"
Chain 2  └ A's trap "Shadow Snare" (Quick, when the opponent uses a Status skill) activates: negates that Status skill and inflicts Fear (恐懼) on the opponent
Chain 3    └ B's trap "Divine Judgment" (Counter) activates: negates the opponent's trap and destroys it

Resolution:
  Chain 3 → Shadow Snare is negated and destroyed
  Chain 2 → (already negated, nothing happens)
  Chain 1 → Healing Light restores 45% HP as normal
```

- Each Pactbearer has only 1 trap slot, so a chain is at most 3 deep and players do not get lost in long chains.
- Timing: "when hit" traps activate **after the attack is declared and before damage**, so they can reduce or reflect damage; "when KO'd" and "on entry" traps activate **after** the event.
- Traits (passives) do not enter the chain and cannot be responded to by traps; they are handled after the event resolves, in the order "acting side first, opponent second".

### 6.4 Manual Activation (Advanced Option)

By default traps activate automatically, which keeps the pace fast and suits mobile devices. Advanced players can turn on 「手動確認」 (Manual confirm) in Settings: when a condition is met, a 5-second window appears to choose between activating and holding. Example: you want to save Quicksand for the opponent's main spirit instead of wasting it on a decoy sent in to probe.

## 7. Skill Budget (A Number-Design Tool)

Each skill's effects are converted into "power points" and compared with the budget its cost deserves. `npm run report` lists every skill's ratio, and `npm test` rejects any skill outside ±15%.

### 7.1 Budget

Conversion baseline: a Neutral, same-element attack with 110 power takes off about 33% of the opponent's HP, so **1% HP ≈ 3 points**; **1 Aether ≈ 25 points**.

| Cost | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal skill | 60 | 85 | 110 | 135 | 155 | 175 | 195 |

- The higher the cost, the less power each Aether buys (diminishing returns), but the damage dealt in one hit is higher; that is the value of burst.
- **Traps**: 25 × cost + 20. A trap takes no action and only trades Aether for value, plus 20 points for the value of "hidden information".
- **Ultimates**: the normal budget + 80 (the premium for once per battle). At cost 5 that is 255.

### 7.2 Effect Valuation Table

| Effect | Value |
| --- | --- |
| Power | 1 point = 1 |
| Priority (attacking skills only) | +1 = 25, +2 = 45, +3 = 60, −1 = −10, −2 = −20 |
| Status condition (100% to apply once) | Sleep (睡眠) 100, Freeze (冰凍) 90, Burn (灼燒) 70, Fear 55, Paralysis 55, Silence (沉默) 55, Taunt 55, Bleed (裂傷) 50, Curse 50, Poison 30 per stack, Root 25 |
| Stat stage (per stage) | Attack / Magic Power 40, Defense / Resistance 30, Speed 25; a drop on the user is scored at 0.75× |
| Healing | 2.5 per 1% HP; healing the whole team is 3.75 per 1% |
| Shield | 2.2 per 1% HP |
| Percentage damage | 3 per 1% of the target's HP |
| Drain / recoil | power × ratio × 0.8 (positive / negative) |
| Ignore defense | power × ratio × 0.6 |
| Crit rate | power × 0.5 × the added crit rate |
| Field / own-side effect | 90 |
| Pivot 30, forced switch 50, dispel 25, cleanse self 25, cleanse team 50, pierce Guard 20 | |
| Electric Charge 12 per stack, Aether 25 per point | |
| Trap effects: Guard 85, survive at 1 HP 100, reveal 25, destroy 65, negate a trap 110, negate a skill 90, damage reduction / reflect (per 10%) 8.8 | |
| Conditional bonus `cond` | The designer's estimate of the expected value (e.g., "+80 if the opponent is Burned" is valued at 40) |
| Exclusive effect `custom` | The designer's estimate of the value of an effect implemented in a hook (explained in the note) |
| Dispel timed effects `dispelTurns` | 35 |
| Flagship skill `sig` | 0 (it only relaxes the budget cap) |

Finally, multiply by the **accuracy** (normal skills) or the **trigger probability** (traps; the designer's estimate of how likely the condition is to be met while this trap is on the field).

### 7.3 Worked Examples

**Will-o'-Wisp** (Fire, Status, cost 1, accuracy 85): inflicts Burn on the opponent and lowers its Attack by 1 stage.

```
Burn 70 + opponent Attack −1 stage 40 = 110
× accuracy 0.85 = 93.5
Budget (cost 1) = 85 → ratio 1.10 ✓
```

**Frost Snare** (霜凍陷阱) (Water, Trap, cost 2): Trigger: when one of our spirits is hit by a Physical attack. That damage −30%, and the attacker is Frozen.

```
Damage reduction 30% 26.4 + Freeze 90 = 116.4
× trigger probability 0.6 = 69.8
Budget (trap, cost 2) = 25 × 2 + 20 = 70 → ratio 1.00 ✓
```

### 7.4 How to Use It

1. Add skills to your own group's `data/kits/<group>.json` and fill in `tags` (tag names are in `sim/budget.ts`). For an effect the tags cannot express, write a hook (`src/engine/kits/<group>.ts`) and value it with `custom`.
2. `npm run kits -- <group>` or `npm run report`: shows every skill's budget ratio and valuation breakdown.
3. `KIT=<group> node --test sim/kits.test.ts`: fails when a ratio falls outside its range. The range depends on the kind: basic skills 0.85-1.05, normal exclusive skills 0.85-1.15, flagship skills 1.00 up to the rarity cap (N 1.20 / R 1.25 / SR 1.30 / SSR 1.35); Ultimate premium N / R / SR +80, SSR +100.
4. The budget is only a starting point. If playtesting shows a skill is too strong or too weak, **adjust the valuation table first** (it means our judgment of some effect's value was wrong), then adjust the skill itself.

## 8. Element Archetypes and Combos

| Archetype | Core combo | Counterplay |
| --- | --- | --- |
| **Fire: Detonation** | Will-o'-Wisp (Burn plus lower Attack) → Combust (爆燃) (+80 power and removes Burn); Pyrewing Queen's (焰翅蛾后) "Fire Scale Dust" (火鱗粉) deals +20% to Burned targets | Cleanse, Sanctuary, Fire spirits (immune to Burn) |
| **Water: Frostbind** | Frost Breath (霜息) / Frost Snare (Freeze) → Shatter Lance (碎冰槍) (×2); Icecrown Emperor's (冰冠皇企鵝) "Chill" (凍氣) makes that hit always crit | Blazing Sun (cannot be Frozen), Fire attacks thaw, Toughness |
| **Nature: Venom** | Toxic Spores (3 stacks) → Venom Burst (毒爆) (+20 per stack); Leech Seed (寄生種子) drains continuously | Switching (Poison halves), Cleanse, fast attackers |
| **Wind: Tempo** | Tailwind (順風) → Whirl Turn attacks and then switches; Skyreign Falcon (蒼風隼王) enters with +1 Speed | Pursuit, Quicksand, Root |
| **Earth: Fortress** | Provoke (seals Status skills and traps) → Quicksand / Stone Counter; Sand Reaper (沙鐮蠍) gets +1 Attack and +1 Aether every time a trap activates | Spellbreak (破咒), Magic attacks (Earth is mostly low in Resistance), Wind spirits |
| **Thunder: Charge-up** | Spark (電火花) / "Charged Wool" (蓄電羊毛) stack Electric Charge → Discharge (放電) (+35 per stack); Thunder Cannon is a charged heavy blast | Interrupt (斷咒) (cancels Charging), Guard, Earth spirits |
| **Light: Order** | Seal of Silence (封咒聖印) reveals traps → Divine Judgment / Sanctuary locks out status conditions; healing and Cleanse | Curse (blocks healing), Dark attacks |
| **Dark: Ambush** | Set a trap → Ambush (伏擊) (+40 power, priority +1); Eternal Night makes traps Quick | Spellbreak, Light, Eye of Insight |
| **Neutral: Sword and Book** | Relic Blade (古劍之靈): a successful Guard → its next Physical skill always crits; Grimoire (秘典書靈): Transcribe (複寫術) turns the opponent's move back on them | Status-skill suppression, multi-hit attacks |

## 9. Match Walkthrough: Five Key Moments

**A** (Battle Oath: Oath of Breaking): Noxfang, the Endless Night (永夜魔狼・諾克斯) (SSR 5) + Sand Reaper (SR 4) + Pyre Dragoon (熾焰龍騎) (R 3) = 12
**B** (Battle Oath: Eye of Insight): Luminael, the Morningstar (晨星天馬・露米娜爾) (SSR 5) + Oathsea Sage (海誓賢獺) (R 3) + Relic Blade (SR 4) = 12

**Moment 1: the fight for the field (opening)**
Both sides send out Noxfang and Luminael first. Entry effects resolve by speed: Noxfang (Speed 735) sets Eternal Night first, then Luminael (490) sets Sanctuary over it. The slower Sacred Spirit ends up with the field. With Sanctuary plus the Light-Dark matchup, Luminael's Holy Lance (聖光矛) can take about **92%** of Noxfang's HP.

**Moment 2: a trap that never activated**
A dares not let Noxfang take the Holy Lance, so A switches in Sand Reaper and, in the same turn, sets a trap from Noxfang's skill slots (Aether 3 → 0). Sand Reaper takes the Holy Lance and is left with about 40% HP.
B sees A's Aether drop by 3: the only 3-cost trap is Shadow Snare (negates the opponent's Status skill and inflicts Fear). B had planned to use Healing Light and now does not dare. **The trap has not even activated, and it has already changed the opponent's choice.**

**Moment 3: Guard and Iaido**
B switches in Relic Blade. A's Sand Reaper uses Seismic Stomp (震地踏), which is stopped by Relic Blade's "Guard" and triggers its trait "Sword Intent" (劍意): the next Physical skill always crits.
On the next turn A knows B cannot Guard twice in a row and attacks confidently with Stone Edge (裂岩刃). But B picks "Iaido" (priority −2): it takes the Stone Edge first, then counterattacks with 150 power and a guaranteed crit, and one stroke takes out Sand Reaper. **The player who wins the guessing game takes the whole turn.**

**Moment 4: a three-link chain**
Noxfang returns to the field and B also switches Luminael back in. Luminael's entry trait "Morningstar Wings" (晨星之翼) reveals A's trap: as expected, Shadow Snare. This turn B first sets the Counter trap "Divine Judgment" (it cannot activate on the turn it is set) and applies pressure with Holy Lance.
On the next turn B deliberately has Luminael use the Status skill "Healing Light". A's Shadow Snare activates (Chain 2), and B's Divine Judgment responds (Chain 3). Resolving from last to first: Shadow Snare is negated and destroyed, and Healing Light restores HP as normal. **With one turn of waiting, B removed the trump card A had buried since the first turn.**

**Moment 5: the timing of the Ultimate**
A has saved up 5 Aether and has not used the Ultimate yet. Eclipse Fang (always crits) can deal **166%** of Luminael's max HP, so even full HP will not survive it.
B reads this: Luminael uses "Guard" (priority +3, which blocks even an Ultimate). But in the same turn A declares the Battle Oath "**Oath of Breaking**": attacks this turn ignore Guard. Eclipse Fang pierces the Guard, and Luminael faints.
This one turn used four layers of judgment at once: counting Aether, timing the Ultimate, reading the Guard, and the Battle Oath.

## 10. New Skill Design Checklist

- [ ] Which element archetype does it belong to? Does it combo with other skills of the same element?
- [ ] How can the opponent respond? (at least one clear answer)
- [ ] Does the text follow "condition → effect → cost"? Is it within two effects?
- [ ] Is the budget ratio inside the range for its kind (normal 0.85-1.15, flagship by rarity)?
- [ ] Does it connect with the same spirit's other skills, signature mechanic and trait? (set up → pay off)
- [ ] Does it make any element or role redundant?
- [ ] If it is a trap: is the trigger condition clear, and can the UI express it in one sentence?
- [ ] Presentation: are the hit tier, effects and sound defined (see [07 Game Feel](07-game-feel.md#12-skill-acceptance-checklist))?

## 11. Directions for Expansion

- **Tag-team skills**: an extra effect that triggers on switch-in when two specific spirits are on the same team (e.g., Relic Blade × Grimoire "Sword and Book").
- **Skill evolution**: once a skill has been used a set number of times, its look and sound upgrade (the numbers do not change), to feed the sense of collecting and growing.
- **Seasonal traps**: event-limited traps used in cup matches, to keep the environment fresh.
- **Doubles mode**: 2 vs 2, adding keywords such as "spread" and "cover".
