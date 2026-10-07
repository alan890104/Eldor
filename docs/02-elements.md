# 02 Elements and Fields

> Code: `sim/formulas.ts` (`singleTypeMultiplier`, `typeMultiplier`) | Full matchup table: [Balance Report §1](catalog/balance-report.md)

## 1. Design Goals

1. **Readable at a glance**: the six natural elements form a ring. Each element beats exactly one other and loses to exactly one. A player can memorize it from the map.
2. **Matchups matter, but they are not everything**: an advantage is ×1.5 and a resisted hit is ×0.75. There is no immunity (×0), so no matchup is a dead end where nothing gets through. The strategic weight stays with skill interactions.
3. **An element is an archetype**: each element has its own signature mechanic, status condition and field, like the archetypes of a Yu-Gi-Oh! deck. Seeing the element tells you roughly how the opponent will play.

## 2. The Nine Elements

| Element | Code id | Position | Description |
| --- | --- | --- | --- |
| Water (水) | `water` | Six-element ring | Control and sustain |
| Fire (火) | `fire` | Six-element ring | Burst and Burn |
| Nature (木) | `nature` | Six-element ring | Poison stacking and attrition |
| Wind (風) | `wind` | Six-element ring | Speed, priority and switching tempo |
| Earth (地) | `earth` | Six-element ring | Defense, Root and traps |
| Thunder (雷) | `thunder` | Six-element ring | Build up Electric Charge, then release it in one burst |
| Light (光) | `light` | Primal | Purification, healing, countering traps |
| Dark (暗) | `dark` | Primal | Disruption, Curse, ambush |
| Neutral (無) | `neutral` | Neutral | Neither beats nor loses to anything; neutral basic skills can be learned by any spirit |

## 3. Matchup Rules

### The Six-Element Ring

```
        Water ──beats──▶ Fire
          ▲                │
        beats            beats
          │                ▼
       Thunder           Nature
          ▲                │
        beats            beats
          │                ▼
        Earth ◀──beats── Wind
```

| Advantage | Reason | Border zone on the map |
| --- | --- | --- |
| Water → Fire | Water puts out fire | Steam Coast |
| Fire → Nature | Fire burns plants | Scorched Treeline |
| Nature → Wind | Forests block wind (windbreaks) | Windbreak Belt |
| Wind → Earth | Wind erodes rock | Windcarved Stones |
| Earth → Thunder | The ground carries lightning away (grounding) | Lightning-Rod Fields |
| Thunder → Water | Lightning pierces water | Thunderstorm Strait |

### Multipliers

| Case | Multiplier | Example |
| --- | --- | --- |
| Advantage | ×1.5 | Water hits Fire |
| Resisted (hitting an element that beats yours) | ×0.75 | Fire hits Water |
| Light ↔ Dark | ×1.5 both ways | Light hits Dark and Dark hits Light are both ×1.5 |
| Anything else | ×1 | Water hits Nature, Light hits Fire, any element hits Neutral |
| **Same-element bonus** (skill element = own element) | ×1.2 | A Fire spirit using a Fire skill |

- Light and Dark beat each other, which makes their duel high-risk and high-reward: whoever acts first has the edge.
- A Neutral skill is ×1 against everyone, and a Neutral spirit takes ×1 from everyone. A Neutral spirit using a Neutral skill also gets the same-element bonus.

### Dual Elements

Some spirits have two elements (example: Magma Golem (熔岩魔像), Fire / Earth).

- **Defending**: take the **average** of the two multipliers. Example: Water hitting Fire / Earth = (1.5 + 1) ÷ 2 = **×1.25**.
- **Attacking**: a skill has only one element; if that element is one of the two, the same-element bonus applies.
- Averaging instead of multiplying keeps dual elements stable and rules out a ×2.25 one-hit kill. That stability is the selling point of a dual-element spirit.

### The Starting Partner Is Neutral

No three of the six elements in the ring can form a triangle of "A beats B, B beats C, C beats A", so the opening does not offer a pick-one-of-three. The protagonist forms a pact directly with the Neutral Eldarin, Dragon of the First Pact (初契之龍・艾爾達林).

- The first tutorial battle never involves an element matchup. After that, the tailwinds and headwinds in each region come from the teammates the player summons and captures, so "the map is the matchup chart" still holds.
- The three starting partners of the old design (Pyre Dragoon (熾焰龍騎) / Oathsea Sage (海誓賢獺) / Elderwood Warden (古木熊衛)) remain in the Star Gate Summon (星門召喚) standard R pool and in the field of their own regions. Pyre Dragoon is the partner of the rival Kael (凱爾).
- The rival no longer relies on an element advantage over the protagonist's starting partner. Instead, the tournament and the duel under the thundercloud give the rival a few extra levels (`RIVAL_LEVEL_BONUS` in `src/game/opening.ts`). Old saves keep the matchup from that earlier design.

## 4. Element Archetypes

| Element | Signature mechanic | Signature status | Element immunity | Representative combo |
| --- | --- | --- | --- | --- |
| Water | Freeze control, shields, healing | Freeze (冰凍) | Freeze | Frost Breath (霜息) / Frost Snare (霜凍陷阱) freezes the opponent, then Shatter Lance (碎冰槍) has ×2 power |
| Fire | Detonate after Burn, recoil heavy hits | Burn (灼燒) | Burn | Will-o'-Wisp (鬼火) burns the opponent, then Combust (爆燃) gets +80 power |
| Nature | Poison stacking, draining, sleep | Poison (中毒) | Poison | Toxic Spores (毒孢子) stacks 3 layers, then Venom Burst (毒爆) gets +20 power per layer |
| Wind | Priority, switching after an attack, forced switches | Bleed (裂傷) | Bleed | Tailwind (順風), then Whirl Turn (迴旋風) attacks and swaps out to keep the tempo |
| Earth | Taunt, Root, counter-type traps | Root (束縛) | Root | Provoke (挑釁) shuts down Status skills, then Quicksand (流沙陷阱) blocks the swap |
| Thunder | Electric Charge buildup, charged heavy cannons | Paralysis (麻痺) | Paralysis | Spark (電火花) / Charged Wool (蓄電羊毛) stack Electric Charge, then Discharge (放電) gets +35 per layer |
| Light | Purification, healing, revealing and countering traps | Silence (沉默) | Silence | Seal of Silence (封咒聖印) reveals a trap, then Divine Judgment (神聖反制) voids the opponent's trap |
| Dark | Curse, fear, ambush | Fear (恐懼), Curse (詛咒) | Fear | Set a trap, then Ambush (伏擊) gets +40 power |
| Neutral | General tactics (Guard, Spellbreak, shields, buffs) | None | None | Guard blocks an attack, then Relic Blade's (古劍之靈) next strike is a guaranteed crit |

**Element immunity**: a spirit cannot be afflicted with the signature status of its own element (example: a Fire spirit cannot be Burned). A dual-element spirit is immune to both.

## 5. Fields

A Field (場地) works like a Yu-Gi-Oh! Field Spell: it rewrites the rules of the whole battlefield and affects both sides.

### Rules

- Only one field exists at a time. Setting a new field overwrites the old one.
- Set by a skill: lasts **5 turns**. Set automatically when a Sacred Spirit (SSR) enters: lasts **3 turns**.
- Setting the same field again refreshes its duration.
- Every field is "**+30% damage for its own element** plus one special rule", which is easy to remember.

### The Eight Fields

| Field | Element | Damage modifier | Special rule | How it is set |
| --- | --- | --- | --- | --- |
| Downpour (暴雨) | Water | Water +30%, Fire −30% | At end of turn, Water spirits recover 5% max HP | Downpour, Thalassene (潮汐聖鯨) entering |
| Blazing Sun (烈陽) | Fire | Fire +30%, Water −30% | No spirit can be Frozen | Blazing Sun, Ignisar (煌焰獅王) entering |
| Grove Domain (森域) | Nature | Nature +30% | At end of turn, all spirits recover 5% max HP | Grove Domain, Sylvaron (萬葉古鹿) entering |
| Gale (疾風) | Wind | Wind +30% | Wind skills get +1 priority | Gale, Aeroth (蒼穹天鷹) entering |
| Sandstorm (沙暴) | Earth | Earth +30% | At end of turn, non-Earth spirits take 5% max HP damage | Sandstorm, Terragon (磐岳巨龜) entering |
| Thundercloud (雷雲) | Thunder | Thunder +30% | The chance for Thunder skills to inflict Paralysis is doubled | Thundercloud, Voltarion (雷霆麒麟) entering |
| Sanctuary (聖域) | Light | Light +30% | No new status conditions can be applied to any spirit | Sanctuary, Luminael (晨星天馬) entering |
| Eternal Night (永夜) | Dark | Dark +30% | Traps can activate on the turn they are set (all count as Quick traps) | Eternal Night, Noxfang (永夜魔狼) entering |

### Field Interactions

- **Field contest**: when two Sacred Spirits enter in turn, the field flips back and forth. Keeping the field on your side is an important skill for high-level players.
- **Countering a field**: non-Earth spirits lose HP every turn under Sandstorm, so you can switch in a Water spirit and set Downpour to overwrite it. Sanctuary shuts down teams that live on status conditions.
- **Eternal Night × traps**: Eternal Night turns every trap into a Quick trap. That is a large boost for a Dark trap team, but the opponent's traps benefit equally.
