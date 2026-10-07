# 07 Game Feel and Audiovisual Feedback

> Parameter code: `sim/feel.ts` (`HIT_FEEL`, `hitTier`) | Implementation: [08 Art and Tech §5](08-art-tech.md#5-architecture-logic-separated-from-presentation)

Turn-based games lose most easily on "feel": you press a skill, a number pops out, and that is all. Eldor wants every action to have **weight**: you see the wind-up, feel the impact and hear the afterglow.

## 1. Principles

1. **Every input gets a response**: any click must give visual and audio feedback within 100 milliseconds, even if it is only a button press.
2. **Windup → impact → afterglow**: every move has a clear three-beat rhythm. The windup builds anticipation, the impact delivers the shock, and the afterglow lets the shock settle.
3. **Graded feedback**: light, medium, heavy, crit, KO and Ultimate, each stronger than the last. Not every hit shakes the screen, which is what makes a heavy hit feel heavy.
4. **Information first**: however flashy, an effect must never cover the health bar, the damage numbers or the status icons.
5. **Skippable and adjustable**: long cinematics that have been seen can be skipped; screen shake, vibration and flashes can all be adjusted in the settings.

## 2. Hit Tiers

The battle engine reports only "how much damage, whether it was a crit, whether it was a KO", and the presentation layer uses this table to decide the feel. The tier is chosen by "damage ÷ target max HP":

| Tier | Condition | Hit-stop | Camera trauma | Slow motion | Number size | Phone vibration (ms) | Music ducking |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Light (輕擊) | < 15% | 40 ms | 0 | None | ×1.0 | 10 | 0 dB |
| Medium (中擊) | 15-35% | 70 ms | 0.25 | None | ×1.15 | 20 | −2 dB |
| Heavy (重擊) | ≥ 35% | 110 ms | 0.45 | None | ×1.35 | 35 | −4 dB |
| **Crit (暴擊)** | On a crit | 140 ms | 0.6 | ×0.35, 180 ms | ×1.6 | 15-30-40 | −6 dB |
| **Ultimate (奧義)** | Ultimate hits | 160 ms | 0.9 | ×0.3, 300 ms | ×1.8 | 30-30-30-30-120 | −8 dB |
| **KO (擊倒)** | Target faints | 180 ms | 0.75 | ×0.25, 450 ms | ×1.6 | 40-40-80 | −9 dB |

Priority: KO > Ultimate > Crit > by damage ratio.

- **Hit-stop (頓幀)**: at the moment of impact, the **animations** of the attacker and the target **freeze**, while effects and particles **keep playing**. This is the most important source of the feeling of "hitting something".
- **Multi-hit**: the hit-stop of each hit is halved in turn (minimum 20 ms), and the last hit returns to the full tier. A 5-hit Thousand Wind Blades (千風刃) goes "ta-ta-ta-ta... bam".
- **Camera trauma**: actual shake amplitude = trauma² × max displacement (0.35 units, roll 2°), decaying 1.5 per second; several hits stack (cap 1). The square makes light shakes almost invisible, so only heavy hits are clearly felt.

## 3. Timeline of an Attack

At 60 fps:

**Physical (武技, melee)** about 0.9-1.2 seconds

```
Windup   10-14 frames  Gathering pose, weapon or claws glow, dust kicked up at the feet
Dash      6-8 frames   Rush at the target, motion-blur trail
Impact                 Hit-stop (by tier) + white flash 1-2 frames + impact effect + sound
Recovery 12-18 frames  Follow-through of the swing, particles fall
Return   10 frames     Hop back to place
```

**Magic (魔法)** about 1.0-1.3 seconds

```
Casting  14-20 frames  Magic circle unfolds at the feet, particles gather toward the caster, pitch rises
Launch    4 frames     Recoil, flash
Flight   10-16 frames  Projectile, trail, camera follows
Impact                 Hit-stop + burst effect + ground decal
```

**Status (秘術)** about 0.6-0.8 seconds: light rises, stat arrow icons (↑↑ green / ↓ red), a crisp confirmation sound.

**Trap (伏技) activation**: the screen freezes for 0.25 seconds → the trap card flips up from the ground (0.35 seconds, "card flip" sound) → the 「伏技發動！」 (Trap activated!) banner → the effect. This is the moment the opponent least expects and enjoys most, so it must have a pause.

- One turn (one action from each side) is kept **within 4 seconds** at 1× speed.
- Battle speed can be 1× / 1.5× / 2×. Higher speeds shorten the windup and recovery, but **do not shorten hit-stop** (shortening hit-stop makes the feel go soft immediately).

## 4. Hit Reactions

| Element | How it is done |
| --- | --- |
| White flash | The whole target model turns white for 1-2 frames, then shifts to the element color for 3 frames |
| Knockback | Light 0.1, heavy 0.35, crit 0.5 units, easing back into place within 12 frames |
| Deformation | On impact the Y axis squashes to 0.9 and the X axis stretches to 1.08, for 4 frames |
| Hit animation | Two sets, light hit and heavy hit; heavy hits and crits use the latter |
| Delayed HP drain | The foreground of the health bar drops to the new value at once; a white afterimage behind it stays for 0.35 seconds, then catches up over 0.4 seconds. On heavy hits the bar itself also shakes slightly |
| Shield break | When a shield is broken, a glass-shatter effect and a crisp breaking sound play |
| Guard (格擋) | A hemispherical barrier appears; when hit it cracks but holds, with a heavy metallic impact. Blocking an attack must feel satisfying too |
| Effective / resisted | Effective: orange number + 「剋制！」 (Effective!), slightly higher pitch. Resisted: small gray text + 「抵抗」 (Resisted), a muffled sound |

### Knockout

1. Hit-stop 180 ms, slow motion ×0.25 for 450 ms
2. The camera pushes in 15%, and the background saturation drops by 60%
3. The spirit turns into points of light in its element color and is drawn back into the Pact Stone (契約石) (in the world: spirits do not die, they only return to the Pact Stone to rest)
4. KO sound + music ducking −9 dB
5. The next spirit enters: the Pact Stone is thrown → a summoning circle unfolds → the spirit lands and kicks up a shockwave → entry pose and cry

## 5. Camera

- **Default battle camera**: oblique 3/4 view, 25-30° pitch down, 35° field of view, both sides in frame, with safe margins around for the UI.
- **Attacks**: during the windup the camera pushes in 5-8% toward the attacker; magic projectiles are followed by the camera; on impact it snaps quickly toward the target.
- **Crits**: on impact it pushes in 10% and stays inside the slow motion, then bounces back.
- **Screen shake**: see the trauma model in §2. The intensity can be adjusted from 0-100% in the settings.
- Never a continuous spinning camera that causes dizziness; apart from the Ultimate, camera moves finish within 0.3 seconds.

## 6. Ultimate Cinematics

The Ultimate (奧義) is the climax of the whole battle, and every spirit has its own cinematic, 2.5-3.5 seconds long:

| Time | Phase | Content |
| --- | --- | --- |
| 0.0-0.4 s | Declaration | The screen darkens, black bars slide in top and bottom, a bust of the Pactbearer cuts in and shouts the spirit's True Name (example: 「以真名呼喚你，伊格尼薩！」 (By your True Name, I call you, Ignisar!)) |
| 0.4-1.2 s | True Name release | The camera circles in a close-up of the spirit, the element halo bursts; **the music drops out** (0.4 seconds of silence or a reversed cymbal) |
| 1.2-2.2 s | The move | Exclusive animation and exclusive camera work |
| 2.2-2.6 s | Impact | Ultimate tier (hit-stop 160 ms, trauma 0.9, slow motion), a full-screen white flash for 2 frames, the largest damage number |
| 2.6-3.2 s | Afterglow | The camera pulls back to the default position, particles settle, and the music's downbeat returns |

- The first time it plays in full; afterwards it can be skipped by clicking (jumping straight to the impact).
- Resonance (共鳴) R2 unlocks an upgraded cinematic (new camera work and effects).
- When an Ultimate is blocked it must still have drama: the barrier is nearly shattered, the screen shakes violently, and in the end it holds. Even a failure must be spectacular.

## 7. Visual and Audio Language of the Elements

All skills of one element share a color scheme, shapes and sounds, so a player can tell the element with their eyes closed.

| Element | Main / light color | Shapes and particles | Hit effect | Sound material |
| --- | --- | --- | --- | --- |
| Water (水) | `#3DB7FF` / `#BFF3FF` | Curved streams, bubbles, ice crystals | Splash ring, ice cracks | Splashes, high-frequency shattering of ice, low-frequency swells |
| Fire (火) | `#FF6A2B` / `#FFD27A` | Tongues of flame, rising embers, heat distortion | Explosion ring, scorch decal | The roar of ignition, bursts, burning tail |
| Nature (木) | `#5FCB5A` / `#D8F59A` | Leaves, vines, spores | Leaves burst apart | Rustling, the dull crack of snapping wood, a spore "pop" |
| Wind (風) | `#9FE8E0` / `#FFFFFF` | Arc blade-light, spiral airflow, feathers | Cross-slash afterimage | High-frequency whoosh, a wind tail |
| Earth (地) | `#C49A5A` / `#6B4E2E` | Rubble, cracks in the ground, dust | Ground shockwave, bouncing rubble | Low-frequency thuds, stones colliding, rumbling |
| Thunder (雷) | `#B38CFF` / `#FFF6A8` | Jagged lightning, afterimages, electric arcs | Full-white flash, lingering arcs | Very short crackles, electric hum |
| Light (光) | `#FFE680` / `#FFFFFF` | Pillars of light, feathers, geometric holy patterns | Cross-shaped starburst | Bells, sustained choir notes, bright sparkling sounds |
| Dark (暗) | `#7B3FC4` / `#1A0F2E` | Smoke, rifts, red eye-glow | Inward-sucking implosion | Reversed low-frequency roars, a heartbeat, whispers |
| Neutral (無) | `#E8E8F0` / `#9AA0B5` | Sword light, magic-circle runes | A clean white impact | Metal clang (swords), magic hum (books) |

Effects linger for no more than 1.5 seconds and must not cover the health bar, the numbers or the status icons.

## 8. Sound Design

### The Four Layers of a Hit Sound

| Layer | Length | Purpose | Example (Fire heavy hit) |
| --- | --- | --- | --- |
| ① Transient | 0-30 ms | The crisp "it hit" feeling, the key to the feel of impact | A bursting crack |
| ② Body | 50-300 ms | The texture of the element | The whoomp of a flame bursting |
| ③ Tail | 300 ms-1.5 s | Space and afterglow | Crackling flames, reverb |
| ④ Accent | Varies | Exclusive emphasis for crits, effective hits and KOs | Crit: a metallic ring + a reversed inhale sound 100 ms before impact |

- Layers stack by tier: a light hit has only ① and ②; a heavy hit adds 50-80 Hz low frequency; a crit adds ④; a KO adds the KO sound.
- Prepare 3-5 variants of each layer and pick randomly (no consecutive repeats), pitch ±4%, volume ±1.5 dB.
- Alignment: the transient lands on the first frame of the hit-stop; the whoosh comes 80-120 ms earlier.
- Ducking: the music drops instantly during big moves and heavy hits (see §2) and recovers within 350 ms. Priority: voice > Ultimate > hit > skill > UI > ambience.

### Spirit Voices

- Each spirit has 4 cries: entry, attack, hit and Ultimate.
- Each spirit has its own melodic motif; after each Breakthrough (突破) its pitch drops and its timbre thickens. The player can hear "it got stronger".

### Dynamic Music

The battle track is split into multiple stems and mixed according to the state of the fight:

| Situation | Music change |
| --- | --- |
| Start | Base layer (drums, bass) + main melody |
| Aether (靈能) ≥ 5 and the Ultimate available | A rising string layer is added, hinting "the big move is ready" |
| Either side down to its last spirit | A tension layer is added and the tempo quickens |
| Ultimate | The music drops out for 0.4 seconds and the downbeat returns on impact |
| Victory / defeat | A dedicated short piece |

Each region has its own arrangement of the battle track (Emberspine (焰脊火山帶) uses war drums, Tidesong Isles (潮歌群島) uses waves and strings, Aurelia (曦光聖都) uses a pipe organ).

### UI Sounds

- One timbre family (crystal, magic bells), and every sound shorter than 150 ms.
- Each point of Aether gained has a "ding"; when Aether is insufficient the skill card shakes left and right with a low error sound.
- Setting a trap: a "smack" like laying down a card in Yu-Gi-Oh!; a trap being revealed: "whoosh... thud".

## 9. Star Gate Summon Cinematic

Gacha is the most direct source of excitement, and the cinematic needs both anticipation and a burst:

1. Click summon → Starlight Stones (星輝石) shatter into points of light and fly into the Star Gate (0.6 seconds)
2. The Star Gate's runes light up one by one, the pitch rising step by step
3. **A meteor streaks across the sky**, its color showing the highest rarity of this pull: blue (R), purple (SR), gold (SSR)
4. The Star Gate opens and the results are revealed one by one: silhouette → burst into the full form, with the hit tiers applied by rarity
5. **SSR**: the Sacred Spirit (聖靈) descends from the sky, and its field (Blazing Sun (烈陽), Downpour (暴雨), ...) instantly fills the whole screen, followed by an Ultimate-like close-up and a roar, with full hit-stop, screen shake and phone vibration
6. The 10-pull summary screen, with new spirits tagged "NEW"

- The whole sequence can be skipped; a 10-pull takes about 6 seconds.
- **The cinematic may under-report, never over-report**: the meteor color must never be higher than the actual result; a surprise where purple "upgrades" to gold midway is allowed, but gold must never end with only an SR.

## 10. UI Feedback

| Element | Feedback |
| --- | --- |
| Damage numbers | Pop out from the impact point: scale up to 1.2× within 120 ms and back to 1×, float up 40 px within 0.6 seconds and fade. Size depends on the tier |
| Number colors | Normal white, effective orange, resisted gray, crit gold (with a starburst), healing green, shield cyan, damage over time in the color of that status |
| Multi-hit | Shows "5 HIT" and the accumulated damage |
| Status icons | Icon + remaining turns; bounces once when added |
| Aether | 10 crystal slots; they light up one by one with a "ding" when gained, and crystals fly to the skill card when spent |
| Skill cards | Rise 6 px when hovered; shrink to 0.95× (60 ms) and glow when pressed; after confirming, the card flips to show 「已決定」 (Decided) |
| Trap slot | Setting: the card slides into the slot face down; the opponent's trap has a slowly breathing glow on its back, creating pressure |
| Chain | Cards in a chain stack in order, labeled 1, 2, 3; on resolution they are processed from the top down, and negated cards shatter |
| Turn change | A small 「第 5 回合」 (Turn 5) banner for 0.4 seconds |
| Waiting for the opponent | Shows a 「等待對手……」 (Waiting for the opponent...) animation so the screen never sits still |

## 11. Exploration, Capture and Breakthrough

- **Movement**: 0.12 seconds of acceleration, 0.08 seconds of deceleration; footstep dust and footstep sounds that vary with terrain.
- **Encounters**: grass shakes → "!" → a screen-shatter transition in the element color (0.6 seconds).
- **Capture**:
  1. Throw the Pact Stone (a parabola), and the stone pulls the spirit in (a vortex of light)
  2. It shakes 1-3 times, each shake with a sound and a pause
  3. Success: the seal flashes, a bell rings, 「契約成立！」 (Pact formed!), colored points of light; failure: the stone cracks and the spirit jumps out angrily
  4. The number of shakes is tied to the success chance: the higher the chance, the more likely it shakes all 3 times, so the shaking itself carries meaning
- **Breakthrough**: 5-8 seconds, skippable. The spirit glows, the silhouette pulses faster and faster (heartbeat sound), a burst of light, then the slightly larger spirit strikes a debut pose + cry + a 「某某 突破了！」 (<name> has broken through!) banner, with the music swelling. Its shape and name do not change.
- **Level up**: a small burst of light + "Lv UP" + the stat numbers count up (0.5 seconds), with the gain marked (example: "+12").

## 12. Skill Acceptance Checklist

Every skill must pass this before release:

- [ ] The windup makes it clear that "a move is coming" and shows whether it is Physical, Magic or Status
- [ ] The correct hit tier is applied on impact (decided by `hitTier`, never set by hand)
- [ ] The hit sound has transient, body and tail layers, and matches the element's sound language
- [ ] Effects use the element's colors, linger for no more than 1.5 seconds and do not cover the UI
- [ ] At 1× speed the whole move is within 1.3 seconds (Ultimate 3.5 seconds)
- [ ] Trap: has the freeze, the card flip and the banner, three beats
- [ ] At "low quality" the hit is still visible (it does not depend on post-processing effects)

## 13. Accessibility and Settings

| Setting | Options |
| --- | --- |
| Screen shake intensity | 0-100% |
| Phone vibration | On / off (note: iOS Safari does not support the web vibration API; on iOS, stronger visual feedback makes up for it) |
| Reduced flashing | Removes full-screen white flashes; no more than 3 flashes per second |
| Battle speed | 1× / 1.5× / 2× |
| Ultimate cinematic | Full / short (impact only) / skip |
| Color-blind mode | Elements are told apart by icon + shape, not by color alone |
| Subtitles | Subtitles for voice and important sound effects |

## 14. Validation

- **Prototype the feel first**: the first milestone of the battle prototype is to finish the complete feedback chain for one Physical move and one Magic move (see [08 §9](08-art-tech.md#9-milestones)). Do not expand content before the feel is there.
- **Playtests**: after each test, ask players to rate "hit feel" and "cinematic length" from 1 to 5.
- **Skip rate**: record the skip rate of each cinematic. If a cinematic is skipped more than 60% of the time, it is too long or too repetitive and must be shortened.
