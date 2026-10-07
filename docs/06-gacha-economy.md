# 06 Gacha and Economy

> Code: `sim/gacha.ts` (exact calculation, not simulation) | Full rate table: [Balance Report §11](catalog/balance-report.md)

## 1. Principles

1. **Gacha sells "how it plays" and "liking", not a "stat ceiling".** An SSR is strong because of its unique mechanics (a field on entry, an exclusive Ultimate), not because of overwhelming stats.
2. **The arena is not a wallet contest**: the standard arena flattens levels, disables Resonance and caps team cost at 12 (see [04 Battle §2](04-battle.md#2-team-rules)).
3. **Pity is transparent**: all rates, pity rules and personal pull history are public in the game.
4. **Everything that is not an SSR can be obtained for free**: N, R and SR can all be had through capture, Stardust exchange or events.
5. **Cosmetics are the main revenue**: 3D models make appearance (spirit looks, Ultimate cinematics, fields) very valuable, which is a paid item that does not affect balance.

## 2. Currencies and Resources

| Name | Use | How to get it |
| --- | --- | --- |
| **Starlight Stones (星輝石)** | Summoning (150 per pull), buying cosmetics | Top-up, quests, events, achievements |
| **Pact Tickets (契約券)** | 1 summon (any banner) | Events, season pass, Stardust shop |
| **Gold (金幣)** | Breakthrough, skill books, emblem crafting | All activities |
| **Breakthrough Stones (突破石)** (8 elements) | Breakthrough | Field of the matching region, daily dungeon |
| **Source Crystal Shards (源晶碎片)** | Stage II → III | Source Crystal Trials, weekly challenges |
| **EXP Potions (經驗藥水)** | Leveling | Daily dungeon |
| **Stardust (星塵)** | Stardust shop | Duplicate spirits once Resonance is full |
| **Arena Badges (競技徽章)** | Arena shop (cosmetics, emblem materials) | The arena |
| **Pact Stones (契約石)** (Basic / Advanced / Master) | Capture | Shop (gold), exploration |

## 3. Banners

| Banner | Contents | Notes |
| --- | --- | --- |
| **Beginner's Gate (初心星門)** (starter) | Standard SSR / SR / R | Limited to 50 pulls at 120 Starlight Stones each (20% off); **1 SSR guaranteed within 50 pulls** |
| **Gate of Stars (星辰之門)** (standard) | All 12 SSRs (the Eight Sacred Spirits plus the four Legends), all SRs, Rs | Pity counted separately |
| **Sacred Descent (聖靈降臨)** (selectable rate-up) | The player picks any 1 of the 12 SSRs as the rate-up and can change it at any time (the game has no daily rotation) | 50% chance of the rate-up; after a miss, the next SSR is guaranteed to be the currently chosen rate-up |

- Pity counters of banners of the same type are **carried over across periods**.
- The prologue tutorial gives 20 Pact Tickets, and the first 10-pull always contains at least 1 SR.

## 4. Rates and Pity

| Item | Value |
| --- | --- |
| Base SSR rate | 1.5% |
| Base SR rate | 13% |
| Soft pity | From the 41st pull since the last SSR, the SSR rate rises by 8% per pull |
| Hard pity | **An SSR is guaranteed on the 50th pull** |
| SR pity | At least 1 SR or better every 10 pulls |
| **Combined SSR rate** (with pity) | **3.09%** |
| **Combined SR rate** (with pity) | **16.38%** |

|  | Mean | Median | 90% of players | Worst case |
| --- | --- | --- | --- | --- |
| Getting any SSR | 32.4 pulls | 41 pulls | 46 pulls | 50 pulls |
| Getting the chosen rate-up SSR | 48.6 pulls | 45 pulls | 87 pulls | 100 pulls |

Why these numbers:

- **An SSR is guaranteed in 50 pulls**: one month of free income (about 32 pulls) plus main-story rewards reaches the pity, so players can see the finish line.
- Soft pity starts at pull 41, and about **45% of players get an SSR before soft pity**, so the surprise remains; players who have not pulled one yet also know that "one is guaranteed within 10 more pulls".
- The combined rate of 3.09% is more generous than most large 3D mobile games (about 1.6%), because an SSR is not required in the arena (a standard arena team holds at most two), and what is sold is how it plays and liking.
- "Rate-up in 100 pulls at worst" gives paying players a clear upper bound.

## 5. Duplicates

| Duplicate count | Result |
| --- | --- |
| 2nd-6th copy | Resonance R1 → R5 (see [03 Growth §7](03-growth.md#7-resonance-duplicate-pulls)) |
| From the 7th copy | Converted into Stardust: SSR 40, SR 10, R 2 |

### Stardust Shop

| Item | Price | Limit |
| --- | --- | --- |
| Pact Ticket | 15 | 5 per month |
| SR of choice | 100 | 1 per month |
| Standard SSR of choice | 400 | 1 per 6 months |

## 6. Free-to-Play Income (Estimate)

| Source | Starlight Stones per month |
| --- | --- |
| Daily commissions (60 × 30 days) | 1,800 |
| Weekly challenge: Rift Depths (200 × 4) | 800 |
| Arena weekly settlement (median rank, 150 × 4) | 600 |
| Events (1-2 per month) | 1,200 |
| Check-in, maintenance compensation | 400 |
| **Total** | **4,800 Starlight Stones ≈ 32 pulls** |
| Check-in Pact Tickets | +5 pulls |
| **About 37 pulls per month** | |

- 37 pulls per month ÷ an average of 62.7 pulls → **about 1.7 months to get one chosen rate-up Sacred Spirit**.
- First month after launch: one-time rewards (main story, exploration, achievements) of about 15,000 Starlight Stones, plus that month's income of 4,800 Starlight Stones and 5 Pact Tickets. After subtracting the 50 pulls of the starter banner (6,000 Starlight Stones, 1 SSR guaranteed), about 97 pulls remain, so a free player owns **about 3 Sacred Spirits** on average in the first month.
- A standard arena team holds at most two SSRs (cost cap), so a free player can assemble a "fully built" arena team in about 3 months.

## 7. Monetization Design (Provisional)

| Product | Contents | Provisional price |
| --- | --- | --- |
| Monthly card 「星輝契約」 (Starlight Contract) | 300 Starlight Stones immediately, plus 90 per day for 30 days (3,000 in total ≈ 20 pulls) | NT$ 150 |
| Season pass (6 weeks) | Free track plus paid track: 10 Pact Tickets, materials, limited cosmetics | NT$ 300 |
| Cosmetics | Spirit looks, Ultimate cinematics, Pactbearer outfits, battle fields, Star Gate Summon effects | NT$ 150-600 |
| Direct Starlight Stone purchase | Price anchor: 1 pull ≈ NT$ 50 | By top-up tier |

Cosmetics are the biggest commercial advantage of going 3D: a seasonal look for the same spirit or a reskinned Ultimate cinematic does not affect any stat.

## 8. Compliance

- **Rate disclosure**: the banner page publishes the rate of every rarity and every spirit, and the pity rules; in Taiwan, probability-based items are disclosed under the "Matters to Be Included and Not to Be Included in Standard Contracts for Online Game Services".
- **Pull history**: players can look up at least 6 months of their personal pull history.
- **Prohibited**: no gacha that rewards completing a specific combination (the "complete gacha" that Japanese law prohibits); the presentation must not suggest a better result than the actual one (see [07 Game Feel §9](07-game-feel.md#9-star-gate-summon-cinematic)).
- **Minor protection**: a monthly spending cap and play-time reminders can be set.
- Before release, have legal counsel confirm the latest rules for each release region (Taiwan, Japan, Korea, China, Europe and the Americas).

## 9. Anti-Pay-to-Win Checklist

- [ ] Standard arena: levels flattened, Resonance disabled, cost cap 12
- [ ] Emblem effects are fixed, not in the gacha pool, and all craftable
- [ ] Skill books are bought with gold and need no gacha
- [ ] N / R / SR can all be obtained for free
- [ ] When adding an SSR, confirm that at its cost of 5 it does not make existing SRs lose their arena value
- [ ] When adding a paid product, confirm it affects only cosmetics or time, not arena numbers
