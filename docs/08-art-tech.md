# 08 Art Direction and Technical Architecture

## 1. Visual Direction: 3D Spirits in a 2.5D World

| Part | Presentation | Reason |
| --- | --- | --- |
| Spirits | **Real-time 3D models** | Breakthrough cinematics, Ultimate camera work, and hit deformation and knockback all need 3D; appearance (looks) is also a main source of revenue |
| Battle | 3D scene, fixed oblique camera, free camera during the Ultimate | Clear information in normal play, cinematic feel at the climax |
| Exploration | **2.5D**: 3D scene + fixed high-angle camera | As easy to read as a 3D map, and much cheaper than a free camera (a scene only needs the faces that can be seen) |
| UI | 2D (web DOM) | Clear text, fast development, easy to localize |

Alternatives that were considered: HD-2D (2D spirit illustrations + a 3D scene) costs less per spirit, but is too weak in expressiveness for Breakthroughs, Ultimates and hit feel; a fully free-view 3D makes scenes too expensive and is bad for phone performance.

## 2. Art Style

- **Keywords**: storybook feel, bright, rounded, weighty.
- **Shading**: toon rendering (2-3 tone steps) + rim light + outlines. Element parts (a flame tail, thunder horns, a halo) use emissive materials.
- **Proportions**: spirits have a head-to-body ratio of 1:1 to 1:2 (cute, clear silhouettes); Sacred Spirits can be slimmer and more majestic; the Pactbearer is chibi at 1:3.
- **Silhouette first**: shrunk to 64 px, you can still tell which spirit it is. Each spirit has only one look and one name, keeps one color scheme and one signature feature (example: the tail flame and flame sword of Pyre Dragoon (熾焰龍騎)).
- **Region colors**: each region has a main color set, consistent with the element colors (see [07 §7](07-game-feel.md#7-visual-and-audio-language-of-the-elements)).
- **Corrupted spirits**: the same model with a different material: purple-black cracks, glowing red fissures, a jittering-outline effect. No new model is needed.

## 3. Spirit Model Specs

| Item | Regular spirit | Sacred Spirit (SSR) |
| --- | --- | --- |
| Triangles | 3,000-8,000 | ≤ 12,000 |
| Bones | ≤ 40 | ≤ 60 |
| Textures | One 1024² (base color) + a shared tone-step texture + an emissive mask | 1-2 textures of 1024² |
| File size (compressed) | ≤ 600 KB | ≤ 1.2 MB |
| Models | One model per spirit | One model per spirit |

Every spirit, whatever its rarity, has a single form and a single name (decided by the project owner on 2026-09-28); the three Breakthrough stages use the same model, only scaled up by rarity.

### Animation List

| Animation | Use |
| --- | --- |
| `idle` | Idle (battle and lodge) |
| `move` | Exploration movement, battle dash |
| `entry` | Entry pose |
| `attack_physical` | Physical skills |
| `attack_magic` | Magic skills |
| `cast` | Status skills, setting a trap |
| `charge_loop` | While charging |
| `hit_light` / `hit_heavy` | Hit reactions |
| `guard` | Guard |
| `faint` | Fainting (turns into points of light) |
| `victory` | Victory |
| `ultimate` | Ultimate (one per spirit) |

### Rig Archetypes: Shared Animation

If every spirit model had a full set of animations of its own, the cost would spiral out of control. So all spirits fall into 5 **rig archetypes**; each archetype gets one base animation set, then is adjusted for body size:

| Archetype | Spirits |
| --- | --- |
| Quadruped | Stormram (霆角公羊), Galeweasel (嵐斬鼬), Ignisar, the Blazing King (煌焰獅王・伊格尼薩), Sylvaron, the Evergreen (萬葉古鹿・希爾凡), Terragon, the Mountain Shell (磐岳巨龜・泰拉岡), Voltarion, the Storm Qilin (雷霆麒麟・弗爾塔), Noxfang, the Endless Night (永夜魔狼・諾克斯), Luminael, the Morningstar (晨星天馬・露米娜爾) (with added wing bones) |
| Biped | Pyre Dragoon, Oathsea Sage (海誓賢獺), Elderwood Warden (古木熊衛), Icecrown Emperor (冰冠皇企鵝), Monolith Colossus (磐石巨像), Magma Golem (熔岩魔像) |
| Flying | Skyreign Falcon (蒼風隼王), Eclipse Batlord (月蝕蝠王), Pyrewing Queen (焰翅蛾后), Aeroth, the Sky Sovereign (蒼穹天鷹・艾洛斯) |
| Floating | Cloudfluff (絨雲), Dreamveil Matron (幻夢菌后), Chime Sprite (晨鈴仙), Soul Lantern (冥燈引魂者), Relic Blade (古劍之靈), Grimoire (秘典書靈), Thalassene, the Tide Singer (潮汐聖鯨・瑟蓮娜) |
| Multi-legged | Sand Reaper (沙鐮蠍) |

Each spirit only needs an extra `ultimate` and a few personality animations (a few more for Sacred Spirits).

## 4. Scenes and Camera

- **Exploration**: a fixed camera at about 50° pitch and 30° field of view, following the Pactbearer. Scenes are built as modular asset packs per region, with baked lighting, and fog and a skybox for atmosphere.
- **Battle**: 1 battle arena per region + the Star Gate Arena + the Rift, 10 in total. The center of each arena is left empty for the spirits and effects, and the background can have slight motion (waterfalls, falling leaves).
- **Spirit Lodge**: a small 3D room that can be rotated freely, used for interaction, changing outfits and admiring models (also the display case for cosmetic products).

## 5. Architecture: Logic Separated from Presentation

Hit feel and online battle both rest on the same premise: **the battle rules are a pure-function engine that does not depend on the screen**.

```
         Player input (skills, switches, traps, Battle Oaths)
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Battle engine (pure TypeScript, runs in the browser or on a server)  │
│  • Rules: 04 Battle, 05 Skill Design                                 │
│  • Formulas: sim/formulas.ts                                         │
│  • Seeded randomness → the same input always gives the same result   │
└──────────────────────────────────────────────────────────────────────┘
                                    │ event log
                                    ▼
[ Turn start ][ Skill declared ][ Trap activated ][ Damage 842, crit ][ KO ] …
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Battle Director                                                      │
│  • Turns events into a timeline: animation, effects, sound, camera   │
│  • Hit tiers: hitTier() in sim/feel.ts                               │
│  • Speed-up, skip, synchronized waiting                              │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                3D rendering, audio, UI, phone vibration
```

Benefits:

- **Fair online battle**: the server runs the engine and broadcasts the event log, and the client only plays it back. The opponent's skill loadout and trap contents are **never sent to your client** before they are revealed, so nobody can cheat by peeking.
- **Replays and spectating come almost free**: saving "seed + both sides' inputs" reproduces a whole battle exactly.
- **Reconnection**: replaying the event log brings the client back to the present.
- **Balance validation**: the engine can run large numbers of AI battles on Node and collect each spirit's win rate.
- **How hit-stop is implemented**: on impact, set the time scale of the attacker's and the target's animation mixers to 0 while the effect system and the camera keep running, so that the "freeze" has tension.

A draft of the event types:

```ts
type BattleEvent =
  | { t: 'turnStart'; turn: number; aether: [number, number] }
  | { t: 'enter'; side: 0 | 1; spiritId: string }
  | { t: 'skillDeclared'; side: 0 | 1; skillId: string }
  | { t: 'trapSet'; side: 0 | 1 }                          // the opponent only receives "a trap exists"
  | { t: 'trapActivated'; side: 0 | 1; skillId: string; chain: number }
  | { t: 'chainResolved'; chain: number; negated: boolean }
  | { t: 'damage'; target: 0 | 1; amount: number; ratio: number; crit: boolean; typeMult: number; ko: boolean }
  | { t: 'guarded'; target: 0 | 1 }
  | { t: 'statusApplied'; target: 0 | 1; status: StatusId; turns: number }
  | { t: 'statChanged'; target: 0 | 1; stat: StatKey; stages: number }
  | { t: 'fieldChanged'; field: Element | null; turns: number }
  | { t: 'faint'; side: 0 | 1 }
  | { t: 'battleEnd'; winner: 0 | 1 | null };
```

## 6. Tech Stack

| Layer | Recommendation | Notes |
| --- | --- | --- |
| Language | **TypeScript** | The frontend, server and battle engine share one codebase (this repo's `sim/` is the starting point) |
| Build | **Vite** | Fast dev server, complete asset handling |
| 3D rendering | **Three.js + React Three Fiber** | The largest ecosystem, with the most 3D web examples and talent; R3F lets the 3D scene and the React UI be managed together |
| UI | React (DOM over the canvas) | The many menus, codex and growth screens are fastest to build with web technology |
| Particle effects | three.quarks + custom shaders | A particle system with visual editing |
| Post-processing | postprocessing (bloom, chromatic aberration) | Toggled by quality tier |
| Toon shading | Custom shader: tone steps, rim light, outline, hit white-flash parameter | All spirits share one material |
| Audio | Howler.js (Web Audio) | Audio sprite sheets, audio unlocked on first touch, mobile compatible |
| State management | Zustand | Lightweight, works well with R3F |
| Online battle | **Colyseus** (Node) + WebSocket | Room-based, server-authoritative, runs the shared battle engine directly |
| Assets | glTF (.glb) + meshopt compression + KTX2 textures | Batch-processed with gltf-transform |
| Testing | Node built-in test runner (rules) + Playwright (screenshot comparison) | Rule errors are caught in CI |

WebGL 2 is the baseline; once Three.js's WebGPU renderer matures, it becomes a high-quality option.

**Alternatives**: for an "all-in-one" engine with a built-in editor, physics and GUI, choose Babylon.js; if shipping a native app is certain and a visual editor is wanted, consider Cocos Creator. This project has a heavy UI share and is web-first, so Three.js + React is recommended.

### Suggested Project Structure

```
eldor/
├─ data/               Spirit and skill data (existing)
├─ sim/                Number formulas, budgets, game-feel parameters (existing) → grow into packages/engine
├─ packages/engine/    Battle engine (pure TS, no DOM dependency)
├─ apps/client/        Vite + React Three Fiber frontend
├─ apps/server/        Colyseus battle server
└─ assets/             Source art (Blender files) → compressed output goes to client
```

## 7. Performance Budget

| Item | Target |
| --- | --- |
| Frame rate | Desktop 60 fps; mid-range phones 30-60 fps |
| First load | Title screen ≤ 5 MB; able to start the tutorial battle ≤ 15 MB |
| Battle draw calls | ≤ 150 |
| Battle triangles | ≤ 200k |
| Texture memory (phone) | ≤ 256 MB |
| Download per spirit | ≤ 600 KB (Sacred Spirits ≤ 1.2 MB), loaded only when needed |

### Quality Tiers

| | Low | Medium | High |
| --- | --- | --- | --- |
| Render resolution | 0.75× | 1× | Up to 2× device pixel ratio |
| Shadows | Round fake shadows | Round fake shadows | Real-time shadows for the two spirits |
| Post-processing | None | Bloom | Bloom + chromatic aberration on crits / Ultimates |
| Particle cap | 600 | 1,200 | 2,000 |

Frame time is measured during the first 5 seconds of a battle and the quality tier is chosen automatically; players can also adjust it by hand.

## 8. Asset Pipeline

```
Concept design → turnarounds → modeling → topology / UV → textures
  → apply rig archetype → animation → export glTF
  → gltf-transform (dedupe, prune, resample, meshopt, KTX2)
  → automatic checks (triangle count, bone count, texture size against budget)
  → web model viewer (lists all spirits and animations, for QA sign-off)
```

- **AI tools**: can be used for concept ideation and placeholder models in the prototype stage (image to 3D) to speed up validation; final assets still need hand-fixed topology, UVs and rigs, and the tool's commercial license terms must be confirmed.
- Every art file goes through a spec check, and assets over budget cannot be merged into the main branch.

## 9. Milestones

| Milestone | Contents | Done when |
| --- | --- | --- |
| **M0 Design and numbers** (this one) | World, rules, number formulas, skill budgets, game-feel parameters | Docs complete, `npm test` passes |
| **M1 Battle engine** | Complete rules without graphics: turns, Aether, traps and chains, status conditions, fields, Ultimate, Battle Oaths | Rule tests cover every rule; run ten thousand AI-vs-AI matches and collect each spirit's win rate |
| **M2 Feel prototype** | Three.js battle scene, 3 starting partners (placeholder models), 2 moves each, the full hit feedback chain | Internal playtests rate "hit feel" at 4/5 or higher on average |
| **M3 Full battle** | 3v3, battle UI, trap card flips, chain presentation, 1 Ultimate cinematic | A full PvE battle can be played from start to end |
| **M4 Collection and growth** | Codex, Breakthrough cinematic, Skill Loadout, emblems, Star Gate Summon cinematic | The new-player flow is playable |
| **M5 Exploration** | Astralgate (星門城) and Whisperwood (翠語森林) (2.5D), encounters, capture | Prologue and chapter 1 playable |
| **M6 Online battle** | Colyseus server, matchmaking, ranked play, reconnection | Public test |
| **M7 Content expansion** | Remaining regions, main story, Rift Depths (裂隙深層) | Official launch |

**M2 comes before content**: hit feel is this game's core selling point, so content is not expanded until it is achieved.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| 3D art cost | Rig archetypes share animation; one model per spirit, with Breakthroughs only scaling it up; corrupted spirits only swap the material |
| Performance on low-end phones | Quality tiers and automatic detection; spirit models load on demand |
| Complex trap and chain rules | M1 validates them first with the engine and AI battles; the UI shows the chain order clearly by stacking cards |
| Cinematics that are too long slow the pace | Speed-up, skip, and recording the skip rate to shorten them accordingly |
| A new SSR breaks balance | The budget tool + AI win-rate simulation + the cost cap |
