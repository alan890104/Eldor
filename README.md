# Eldor

**Make pacts with spirits and mend a broken world.** A creature-battle RPG with 3D spirits in a 2.5D world, played in the browser. Collect and raise spirits, then outthink your opponent with skills and face-down traps.

[Play it](https://eldor.pages.dev)&emsp;[繁體中文](README.zh-TW.md)

[![Eldor trailer](https://img.youtube.com/vi/nc8aHfAzebs/maxresdefault.jpg)](https://youtu.be/nc8aHfAzebs)

> A thousand years after the Heart of the World shattered, the Star Gate lights up again, and Eldarin, Dragon of the First Pact, wakes in front of you. You become the new Pactbearer: make pacts with spirits, recover the eight source crystals, and stop the Void Blight from swallowing the world.

The game's text is in Traditional Chinese (the title on screen is 艾爾多). The whole story is playable: a prologue, nine regions and an ending, plus summoning, growth and breakthroughs, an arena and a bestiary.

## How it was made

Eldor was built by a coding agent, Claude Code. I wrote the design and directed the work; one night the agent ran on its own for six hours while I slept, which is what the trailer above shows. Every line of music is synthesised in the browser, and every spirit is modelled in code.

[docs/prompts.md](docs/prompts.md) holds the nine prompts that rebuild it, in the order it was made: the game concept, the stack and architecture, procedural character modelling, the rendering pipeline, hit feel and ultimate cinematics, particles and effects, the open field, the synthesised instruments, and the score engine. Each is a short prompt that names the stack, the techniques and the effect to reach, in Chinese, the language the work was directed in. The agent writes all the code.

## What you do

| System | How it plays |
| --- | --- |
| **Field** | Nine regions on the world map, each a 3D field you walk freely (WASD or stick, run, jump, third-person camera) with towns, people, landmarks, chests and a minimap. Wild spirits roam: some shy, some curious, and corrupted ones charge you. Touch one and the battle starts. |
| **Towers** | Each region ends in a Seal Tower, the main quest: 6 to 8 floors of corrupted packs, duels, cultists and rivals, with a source-crystal trial at the top. Clear them in order to move on. While a tower's seal weakens, the Void eats the land around it, and each floor you clear pushes it back. |
| **Corruption** | Spirits taken by the Void Blight: purple-black bodies, glowing cracks, void crystals, red eyes. In battle they hit ×1.2 harder, lose 1/12 of their health each turn, take ×1.3 from light, and cannot be captured. Defeat purifies them; a purified spirit may agree to a pact, and drops breakthrough stones. |
| **Battle** | Both sides choose a skill at the start of each turn. Energy grows by 2 a turn and skills cost 0 to 4. Traps are set face down until the opponent triggers them. After the second breakthrough (Lv 40) a spirit unlocks an ultimate, once per battle. Each team also carries one Battle Oath. |
| **Capture** | Wild spirits in the field can be captured; the lower their health, the likelier the pact stone holds. |
| **Growth** | Battles and experience potions level spirits up. At the level caps (Lv 20 and 40) a breakthrough costs gold and breakthrough stones. Four skill slots, with signature skills unlocking every 5 levels. |
| **Summoning** | One pull costs a Pact Ticket or 150 Starlight Stones. Ten pulls guarantee an SR, and **50 pulls guarantee an SSR**. Duplicates raise resonance. |
| **Arena** | Ten tiers of opponents. Every spirit is set to Lv 60 at its third stage and teams are capped at 12 cost, so it comes down to team building and tactics. |
| **Quests** | 22 long-term goals across adventure, collection, growth and the arena, claimed in the hub town. |

Every screen has a manual behind its **?** (element matchups, how to get stronger, the full glossary), and terms in skill text open their definitions. Plays with mouse or touch; on phones it installs as an app. Sound on is recommended.

## Run it

Needs Node.js 22.18 or later (it runs TypeScript directly).

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # to dist/
npm run music        # audition the soundtrack
```

URL flags for testing: `?lowfx` low quality, `?hq` force high quality, `?nomusic`, `?devsave` a mid-game save, `?devsave=late` a save one fight from the end, `?viewer` the spirit model viewer, `?viewer&corrupt=half` spirits beside their corrupted forms, `?arena=<region>` the battle stage viewer (add `&field=<element>`, `&cam=showcase`, `&corrupt=1`), `?fieldview=<region>` the field viewer (WASD; add `&cam=overview|tower|town`, `&at=x,z&yaw=deg`, `&done=N` tower progress, `&check` reachability check).

## Cloud save

Progress lives in the browser's localStorage and is **backed up to the cloud automatically, with no login**. The first time there is progress to keep, the browser quietly creates an anonymous account (a key that exists only on that device) and uploads after every save. To move devices, Settings → Advanced gives a transfer code to enter on the other device; cloud backup can also be turned off there. The server is one Cloudflare Worker (`worker/`) that serves the site and `/api/*`, with saves in D1 (SQLite). The free plan is enough.

| Path | What it does |
| --- | --- |
| `worker/src/index.ts` | The API: create an account, verify a key, read, write and delete saves (`rev` catches two devices overwriting each other) |
| `worker/schema.sql` | The D1 tables (`accounts`, `saves`) |
| `worker/wrangler.jsonc` | Worker config (static assets from `dist/`, the D1 binding) |
| `src/game/cloud.ts` | In the browser: the anonymous account, sync at start, upload 4 s after a save and on tab close, conflict handling |
| `src/game/cloudSync.ts` | Pure logic deciding which copy wins, local or cloud (tested) |
| `src/ui/screens/Cloud.tsx` | The cloud section of Settings (status, conflicts, the transfer code) |

Sync rules: at start the game downloads first. A copy without progress yields to one with progress; if both have progress, the newer save wins. While playing it only uploads; if another device wrote newer progress, Settings asks which copy to keep. The server stores only a SHA-256 of the key, so a lost key cannot be recovered.

Cloud backup is off unless the build sets `VITE_CLOUD=1` (`npm run cloud:deploy` does); without it the game saves locally only and Settings hides the cloud section.

Local development:

```bash
npm run cloud:db:local       # create the local D1 tables (once)
npm run cloud:dev            # the Worker on http://localhost:8787 (run npm run build first)
VITE_CLOUD=1 npm run dev     # Vite proxies /api to 8787
```

Deploy the game alone (no cloud save, no D1):

```bash
npx wrangler login
npm run deploy                        # build and upload dist/ (worker/wrangler.static.jsonc)
```

Deploy with cloud save (same Worker name, same URL):

```bash
npx wrangler login
npx wrangler d1 create eldor          # put the printed database_id in worker/wrangler.jsonc
npm run cloud:db                      # create the tables in production
npm run cloud:deploy                  # build and deploy site and API together
```

Add a free WAF rate-limiting rule in the Cloudflare dashboard (for example at most 5 requests a minute per IP to `/api/account`) so nobody can flood it with accounts. A save is 2 to 10 KB and each save is one row write; `?devsave` saves never sync.

## Design pillars

| Pillar | Meaning | Where |
| --- | --- | --- |
| **Every turn is a read** | Simultaneous choices, hidden loadouts, face-down traps and chains | [04 Battle](docs/04-battle.md), [05 Skill design](docs/05-skill-design.md) |
| **Little growth, all of it felt** | No hidden stats, natures or effort values; every spirit of a species has the same numbers. The depth is in loadouts and emblems | [03 Growth](docs/03-growth.md) |
| **Every hit has weight** | Hit-stop, screen shake, layered sound, cinematic ultimates: a turn-based game that hits like an action game | [07 Game feel](docs/07-game-feel.md) |
| **The arena is not a wallet** | Levels flattened, resonance off, team cost capped; SSRs are stronger in how they play, not in their numbers | [06 Gacha and economy](docs/06-gacha-economy.md) |

## Docs

| # | Doc | Covers |
| --- | --- | --- |
| 01 | [World](docs/01-world.md) | The continent, the source and its spirits, history, the nine regions, factions, characters, the main story |
| 02 | [Elements and fields](docs/02-elements.md) | The six-element ring plus light and dark, multipliers, dual elements, fields |
| 03 | [Stats and growth](docs/03-growth.md) | Six stats, base stats, formulas, breakthroughs, experience, resonance, emblems, bonds |
| 04 | [Battle](docs/04-battle.md) | Modes, team cost, turn flow, energy, the damage formula, statuses, special mechanics, ranking |
| 05 | [Skill design](docs/05-skill-design.md) | Five kinds of skill, the card layout, the interaction matrix, traps and chains, skill budgets, a sample match |
| 06 | [Gacha and economy](docs/06-gacha-economy.md) | Banners, rates and pity, duplicates, free-player income, monetisation design, compliance |
| 07 | [Game feel](docs/07-game-feel.md) | Hit tiers, attack timelines, camera, ultimates, the look and sound of each element, sound layering, the summon |
| 08 | [Art and tech](docs/08-art-tech.md) | The 3D × 2.5D direction, model specs, rig archetypes, architecture, stack, performance, milestones |
| 09 | [Bestiary](docs/09-bestiary.md) | Every spirit |
| 10 | [Kit authoring](docs/10-kit-authoring.md) | How to write a spirit's skills, traits and ultimate |

`npm run report` generates a bestiary with stats, a skill list with budgets, and a balance report (matchups, growth curves, damage examples, match matrix, summon odds) into `docs/catalog/`. The [balance report](docs/catalog/balance-report.md) is checked in.

## Key numbers

| | |
| --- | --- |
| Elements | 9: water → fire → wood → wind → earth → thunder → water (strong ×1.5, resisted ×0.75); light and dark beat each other; neutral |
| Stats | base × (1 + level ÷ 10) × stage factor; at Lv 60, base × 7 (health ×2 on top) |
| Damage | attack × power% × K ÷ (K + defense) × element × …, with K = 10 × (level + 10) |
| Pace | 3 hits to KO as a rule, 5 to 6 for tanks, 2 with the element advantage |
| Energy | 3 at the start, +2 a turn, 10 at most; skills cost 0 to 4, an ultimate 5 (once a battle) |
| Arena teams | 3 spirits, cost cap 12 (N 2, R 3, SR 4, SSR 5) |
| Summoning | SSR 1.5% (3.09% overall), soft pity from pull 41, hard pity at 50; a rate-up SSR takes 48.6 pulls on average, 100 at most |
| Launch roster | 26 spirits (N 6, R 5, SR 7, SSR 8), 115 skills |

## Development

```bash
npm test             # design-constraint tests and battle engine tests
npm run report       # regenerate the catalog in docs/catalog/
npm run typecheck    # TypeScript, game and worker
```

| Path | What it holds |
| --- | --- |
| `data/spirits.json`, `data/skills.json` | Spirit and skill data |
| `sim/` | Core formulas, skill budgets, summon odds, game-feel parameters, balance analysis and reports |
| `src/engine/` | The battle engine in plain TypeScript (deterministic, emits events) and the AI |
| `src/game/` | Saves, the campaign, growth and breakthroughs, summoning, the arena |
| `src/render/` | three.js rendering: toon shading and outlines, procedural spirits, battle stages, particles and effects, post-processing |
| `src/battle/` | The battle director: turns engine events into animation (hit-stop, shake, slow motion, ultimate camera work, trap reveals) |
| `src/audio/` | Sound effects and the procedural soundtrack, synthesised live with Web Audio |
| `src/ui/` | The React interface: screens, the battle HUD, flow |
| `tools/` | Headless screenshots and an autoplay script (`play.mjs`), full-screen regression shots (`regress.mjs`) |
| `worker/` | The Cloudflare Worker: cloud save API and static site (see Cloud save) |

To change numbers: edit `data/*.json` or `sim/formulas.ts`, run `npm test` (no skill over budget, base stats match rarity), then `npm run report` and check knockout counts and the match matrix. If a number quoted in the docs changed, update the doc too.

## Credits

The human characters' heads use meshes from [KayKit](https://kaylousberg.com/game-assets) by Kay Lousberg (CC0). Creature voice samples in `src/audio/sfx/` were generated with ElevenLabs; each has a synthesised fallback. Fonts load from Google Fonts.

## License

[MIT](LICENSE)
