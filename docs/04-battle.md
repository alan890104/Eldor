# 04 Battle System

> Code: `sim/formulas.ts` | Skill and trap details: [05 Skill Design](05-skill-design.md) | Damage examples: [Balance Report §4](catalog/balance-report.md)

## 1. Battle Modes

| Mode | Format | Level | Resonance (共鳴) | Notes |
| --- | --- | --- | --- | --- |
| Field encounter | 1 vs 1 (the player's side may switch) | Actual level | Active | Pact Stones (契約石) can be used to capture |
| Story / Source Crystal Trial (源晶試煉) | 3 vs 3 | Actual level | Active | Keepers have their own AI and lines |
| Rift Depths (裂隙深層) | 3 vs 3 in succession | Actual level | Active | Periodic challenge; each floor has a special rule (example: starts under Eternal Night (永夜)) |
| **Standard Arena** | 3 vs 3 | **Everyone flattened to Lv 60, Stage III** | **Disabled** | Ranked play with a cost cap |
| Free battle | 3 vs 3 | Selectable | Selectable | Friend rooms with custom rules |
| Cup | 3 vs 3 | Lv 60 | Disabled | Event-only rules, example: the 「平民杯」 (Commoners' Cup) allows only N / R |

In the Standard Arena, a spirit that has not reached Lv 60 can still enter directly (the system temporarily flattens it), but the player must already own that spirit.

## 2. Team Rules

- Field and story: a team holds at most 6 spirits and brings 3 into each battle (field encounters allow switching).
- Standard Arena:
  - Bring **3 spirits**, with no duplicate species and no duplicate emblems.
  - **Cost cap 12**: N = 2, R = 3, SR = 4, SSR = 5.
    - Valid examples: SSR + SR + R (12), SSR + SSR + N (12), SR + SR + SR (12)
    - Invalid: SSR + SSR + R (13)
  - At the start, both sides' spirits and elements are **revealed**, while skill loadouts, emblems and Battle Oaths (戰技) are **hidden**. Both sides choose a lead within 30 seconds.

The cost cap gives N and R spirits a place in the arena, and makes "two Sacred Spirits" a choice with a price.

## 3. Turn Flow

```
┌─ Start phase ─ both sides +2 Aether (from turn 2); "start of turn" effects resolve
│
├─ Planning phase ─ both sides choose simultaneously and in secret (30-second limit):
│             ① Main action: a skill / a switch (Pact Stone available in the field)
│             ② Optional: set 1 trap (伏技) (trap slot empty, enough Aether)
│             ③ Optional: Battle Oath (once per battle)
│
├─ Action phase ─ Battle Oath → set traps → main actions in action order
│             Each action: declare → trap response (chain) → resolve → trigger effects
│
└─ End phase ─ damage over time → field effects → lasting turns −1 → fainted side sends in a replacement
```

- If the planning phase times out, the system picks "a cost-0 attack skill" automatically.
- A spirit that fainted is replaced in the end phase by the player's choice (no time limit, 15 seconds). A replacement entering does not count as an action.

## 4. Action Order

1. A **switch** always goes first (counted as priority +6).
2. Next, compare **priority** (−3 to +3); the higher goes first.
3. At equal priority, compare **effective Speed** (including stat stages, Paralysis and Tailwind).
4. If still tied, random.

| Priority | Examples |
| --- | --- |
| +3 | Guard (格擋, a system action) |
| +2 | Flash (閃光), Spellbreak (破咒), Heavenly Gale (天嵐), Skybreaker (蒼穹斷界) |
| +1 | Quick Strike (疾擊), Wind Cutter (風刃), Provoke (挑釁), Ambush (伏擊), Bolt Charge (雷光突進), Interrupt (斷咒) |
| 0 | Most skills |
| −1 | Blow Away (吹飛) |
| −2 | Iaido (拔刀・一閃) |

## 5. Aether

Aether (靈能) is a resource shared by the whole team. It replaces Seer's PP.

| Rule | Value |
| --- | --- |
| At the start | 3 |
| Start of each turn (from turn 2) | +2 |
| Cap | 10 |
| Skill cost | 0-4 (Ultimate (奧義) 5) |

- The amount of Aether is **public to both sides**. When the opponent sets a trap you can see their Aether drop and infer the trap's cost.
- 0-cost skills let you "save" Aether: use a 0-cost skill this turn, and next turn you can use a 4-cost heavy hit or the Ultimate.
- Aether belongs to the Pactbearer; switching spirits does not reset it.

Design intent: every turn is a choice between "spend now" and "keep it", and a trap's cost makes "whether to set a trap" a resource decision too.

## 6. Damage Formula

```
damage = floor( base × defense factor × element × crit × damage boost × damage reduction × field × variance ), minimum 1

base            = attack × power ÷ 100                   (Physical uses Attack, Magic uses Magic Power)
defense factor  = K ÷ (K + defense × (1 − defense ignored))   (Physical uses Defense, Magic uses Resistance)
K               = 10 × (attacker level + 10)            (= the defense of a base-100 species at the attacker's level)
element         = element multiplier (×1.5 / ×1 / ×0.75) × same-element bonus (×1.2)
crit            = ×1.5 (base crit rate 5%)
damage boost    = 1 + the sum of all of the attacker's boosts
damage reduction = the defender's reduction sources multiplied together, at most 75% reduction
field           = example: a Fire skill under Blazing Sun (烈陽) ×1.3
variance        = 0.95-1.05
```

### Why It Is Designed This Way

- **The defense factor is always between 0 and 1**: more defense means more durability with diminishing returns, so nothing becomes unbreakable. At equal level with a base Defense of 100 the factor is exactly 0.5, which is easy to compute in your head.
- **Clear multiplier zones**: effects in the same zone add, and different zones multiply. When designers see a new effect they only need to ask "which zone is it in" to estimate its impact.
- **Low randomness**: only ±5% variance, a 5% crit and the accuracy of a few skills. A competitive match should be decided by judgment, not luck.

### Reference Numbers (Lv 60)

- A neutral, same-element, 110-power attack against a base-80 spirit does about **30%-50% of its HP**, and in most matchups it takes **3 hits** to KO.
- Tanky spirits (Terragon (磐岳巨龜), Thalassene (潮汐聖鯨)) take **5-6 hits**.
- With an element advantage it usually takes **2 hits** to KO.

Detailed data is in [Balance Report §5-§8](catalog/balance-report.md).

## 7. Accuracy and Crits

- Most skills have 100 accuracy. A few powerful skills have 85-90 (Hurricane (颶風), Inferno (煉獄), Stone Edge (裂岩刃)), and a few status-inflicting skills have 85-90 (Will-o'-Wisp (鬼火), Toxic Spores (毒孢子)).
- There is no "evasion" stat and no effect that lowers accuracy.
- Base crit rate is 5%; some skills and traits raise it. A crit is ×1.5.

## 8. Stat Stages

Skills can raise or lower a stat, in a range of **−4 to +4**.

| Stage | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Multiplier | ×0.5 | ×0.57 | ×0.67 | ×0.8 | ×1 | ×1.25 | ×1.5 | ×1.75 | ×2 |

- Applies to Attack, Magic Power, Defense, Resistance and Speed. HP has no stages.
- **All stages reset when a spirit leaves the field.** That makes both "buff up and hold on" and "switch out to wipe the debuffs" real options.
- "Dispel" removes all positive stages and shields.

## 9. Status Conditions

| Condition | Category | Effect | Duration | Main source |
| --- | --- | --- | --- | --- |
| Burn (灼燒) | Damage over time | −6% max HP at end of turn; Physical damage dealt −20% | 3 turns | Fire |
| Poison (中毒) | Damage over time | −3% max HP per stack at end of turn, up to 5 stacks; reapplying adds a stack and refreshes the duration; **stacks are halved when the spirit leaves the field** | 4 turns | Nature |
| Bleed (裂傷) | Damage over time | −5% max HP after each skill used | 3 turns | Wind |
| Freeze (冰凍) | **Control** | Skips the next skill action; removed at once by a Fire attack | 1 action | Water |
| Sleep (睡眠) | **Control** | Skips skill actions, at most 2; wakes up when hit by attack damage | At most 2 actions | Nature |
| Fear (恐懼) | **Control** | The next action cannot use attack skills or the Ultimate (Status skills and switching are allowed) | 1 action | Dark |
| Paralysis (麻痺) | Weaken | Speed −50%; skill priority counts as 0 | 2 turns | Thunder |
| Root (束縛) | Lockdown | Cannot switch (including switching after an attack) | 2 turns | Earth, Water |
| Silence (沉默) | Lockdown | Cannot use Magic or Status skills | 2 turns | Light |
| Taunt (挑釁) | Lockdown | Can use only attack skills and the Ultimate; cannot set traps | 2 turns | Earth |
| Curse (詛咒) | Lockdown | Cannot recover HP, gain stat boosts or gain shields | 3 turns | Dark |

### General Rules

- **Element immunity**: a spirit cannot be afflicted with the signature condition of its own element (Fire is not Burned, Water is not Frozen, Nature is not Poisoned, Wind is not Bled, Earth is not Rooted, Thunder is not Paralyzed, Light is not Silenced, Dark is not Feared).
- **Control cap**: at most 1 control condition at a time.
- **Toughness (韌性)**: after a control condition ends, the spirit gains 1 turn of toughness (immune to control during it), so nobody is controlled until they cannot act.
- **Control does not block switching**: a spirit that is Frozen, asleep or Feared can still choose to switch. There is always a way to react.
- Reapplying the same condition refreshes its duration (Poison also stacks).
- "Lasts N turns" = it is removed after N end phases, and the end phase of the turn it was applied counts as the 1st.
- Status conditions persist after leaving the field (Poison is halved); stat stages reset after leaving the field.

## 10. Special Mechanics

### Guard

- A **system action**: always selectable, like switching, and takes no skill slot. Costs 1 Aether. Cannot Guard while Taunted.
- Priority +3. Immune to the damage and additional effects of attack skills and Ultimates for that turn.
- Does not block: Status skills, traps, damage over time, field damage.
- **Using it on consecutive turns always fails.**
- Skills that ignore Guard, such as Skybreaker and Crimson Dragonblade (紅蓮龍劍), go through it; exclusive skills can also be designed to gain power against a Guard (the skill hook's `ctx.guardBroken`), which is the reward for reading the opponent.

### Shield

- Absorbs attack damage; the shield is reduced first, then HP. Damage over time, recoil and percentage damage hit HP directly.
- Shields do not stack: take the larger value and refresh the duration. If not stated, the duration is 3 turns.
- Dispel removes shields; a Cursed spirit cannot gain a shield.

### Charging

- On the turn it is used the spirit only charges (the Aether is already paid), and it releases automatically on the next turn, ordered normally by priority and Speed.
- While charging, the spirit cannot switch or choose another action. It shows a clear charging effect and icon so that the opponent can see it.
- A hit by an interrupt effect such as Interrupt cancels the charge, and the Aether is not refunded.
- The opponent's answers: Guard, switch to a resistant spirit, interrupt, or go all-out while it charges.

### Switching

- A switch is a main action and always resolves first. The spirit that switches in takes the opponent's attack that turn.
- "Pursuit" hits before the opponent switches out, with ×2 power.
- "Switch after attacking" (Whirl Turn (迴旋風)): attack first, then swap out, keeping the tempo.
- "Forced switch" (Blow Away): the opponent is swapped for a random reserve spirit, and the opponent's stat stages are reset as a result.
- Traits and traps that trigger on entering (example: a Sacred Spirit's field, Quicksand (流沙陷阱)) resolve after the switch is complete.
- When both sides enter at the same time (the opening, both switching in the same turn, replacements at the same time), entry effects resolve **from fastest to slowest**. So when two Sacred Spirits enter at the same time, the slower one's field is the one that stays.

### Ultimate

- Unlocked when a spirit reaches Stage III, one per spirit. Costs 5.
- **Each Pactbearer can trigger an Ultimate only once per battle** (not once per spirit). Which spirit and which turn is the biggest decision of the whole battle.
- Activation plays an exclusive 3D camera sequence (played in full the first time, skippable afterwards); see [07 Game Feel](07-game-feel.md#6-ultimate-cinematics).

### Battle Oaths

A sentence the Pactbearer sends into the battlefield through the Pact Mark (world background in [01 §2](01-world.md#pacts-and-contractors)). Choose 1 before the battle. **Once per battle**, declared in the planning phase and resolved first in the action phase, and it **does not use the main action**.

| Line | Art | Effect |
| --- | --- | --- |
| Oath (誓) | Oath of Breaking (破陣之誓) | This turn, the player's attacks ignore Guard and shields |
| Oath | Oath of Guarding (守護之誓) | This turn, the player's active spirit takes 40% less damage |
| Oath | Oath of Gale (疾風之誓) | This turn, the player's active spirit's skills get +1 priority |
| Echo (回響) | Eye of Insight (看破之眼) | Reveals the opponent's trap, and it cannot activate this turn |
| Echo | Purifying Light (淨化之光) | Removes all status conditions from the player's active spirit |
| Echo | Aether Spring (靈能湧泉) | Immediately gain 3 Aether (up to the cap) |

## 11. Winning and Losing

- A side wins when all three of the opponent's spirits have fainted.
- **Turn cap 30**: when it is reached, compare the sum of each side's remaining spirits' HP percentages; the higher wins, and equal is a draw.
- Disconnection: 60 seconds are held for reconnecting; in the meantime the system chooses a 0-cost attack skill on the player's behalf.

## 12. Arena Ranking

- Rating uses Elo: `expected win rate E = 1 ÷ (1 + 10^((opponent rating − my rating) ÷ 400))`, `new rating = rating + K × (result − E)`, win = 1, loss = 0, draw = 0.5.
- K value: 40 for the first 20 battles, 24 afterwards.
- Ranks (display only): Apprentice (見習) → Bronze (青銅) → Silver (白銀) → Gold (黃金) → Starlight (星輝) → Sacred Spirit (聖靈) → Legendary Pactbearer (傳說締約者) (top 100).
- A season lasts 6 weeks; at the end, rewards and cosmetics are granted according to the highest rank reached.

## 13. PvE AI

- Wild spirits: choose a random usable skill, preferring attacks with an element advantage.
- Keepers and the Rift: each keeper has a "personality". For example, the dwarf king of Stoneheart Canyon (磐心峽谷) prefers a fortress tactic of Provoke plus Quicksand, so a story battle doubles as a mechanics tutorial.
- All AI use the same rules and information as the player (they do not see the player's hidden information); only the quality of their judgment is tuned for difficulty.
