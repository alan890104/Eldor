# 01 World: Eldor

> A thousand years after the Primal Heart (源初之心) shattered, the Star Gate (星門) lights up again. The First Pact Dragon, asleep beneath the base of the Star Gate, opens its eyes in front of you. You become the new Pactbearer (締約者), form pacts with the spirits born of the source flows, recover the eight Source Crystals, and stop the Void Blight (虛蝕) from swallowing the world.

> This document follows the game code (`src/game/campaign.ts`, `src/battle/director.ts`, `src/engine/battle.ts`). The old "sword and magic" framework has been removed: this game has no swordsman / mage class choice, and the Pactbearer's power comes entirely from the Pact Mark (契印).

## 1. Tone

| Item | Setting |
| --- | --- |
| Genre | A fantasy adventure of pacts and spirits × spirit collection and raising × strategy battles |
| Atmosphere | A bright adventure fairy tale with a layer of lost-civilization sorrow beneath. Cute but not childish, perilous but not dark |
| Target players | Ages 12 and up; players who grew up on Seer, Pokemon and Yu-Gi-Oh! and now want more strategic depth |
| References | Seer's planet exploration and spirit collecting, Yu-Gi-Oh!'s duel ritual and the mind games of face-down cards, Pokemon's joy of evolution, Zelda's sense of ancient ruins |
| Three keywords | **Pact** (the bond between people and spirits), **Source Flow** (the law by which the world runs), **Shattering** (a world waiting to be repaired) |

### Core Terms

Players only need to remember these terms. The prologue teaches the first six, each later chapter adds at most one more, and only at the moment the player sees it with their own eyes.

| Term | In one sentence | When it is taught |
| --- | --- | --- |
| **Spirit** and **Pact** | Creatures born from the forces of the world. The **Pact Mark** on the back of your hand forms a pact with one: it lends you its power, and you make judgments for it | Prologue |
| **Night of the Shattered Heart** | The night, a thousand years ago, when the Heart of the World was cut open. The kingdom vanished overnight | Prologue |
| **Source Crystal** | The eight pieces the Heart of the World broke into. Each one sits at the top of a tower | Prologue |
| **Void Blight** | The purple-black substance that flowed out of that wound. Spirits it touches go berserk, which is called 「蝕化」 (corruption) | Prologue |
| **Sacred Spirits** | The eight oldest great spirits, each guarding one Source Crystal | Prologue |
| **Eldarin** | Your partner. The dragon of the world's first pact, asleep for a thousand years and just awakened | Prologue |
| **Seal Tower** | A tower built over the wound that presses the Void Blight down beneath it. Each floor is a seal, and a Source Crystal sits at the top | Chapter 1, the first time entering a tower |
| **Purification** | Defeat a corrupted spirit and the purple-black crystals on it shatter, and it returns to normal | Chapter 1, the first time meeting a corrupted spirit |
| **The Cult** | The Order of the Hollow Crown (虛冕教團). People who worship the Void Blight and want to open the towers | Chapter 1, the first time met inside a tower |

**Dialogue wording rule**: characters speak plainly and do not recite lore. In dialogue, "source flow" is said as "element" or "power"; "Primal Heart" is said as "Heart of the World"; the "Ether Sea" never appears; "keeper" is said only when that person is really standing in front of the player. Never put two new terms in one sentence. The deeper lore stays in this document and is not put in front of the player.

## 2. Structure of the World

### The Ether Sea and the Continent of Eldor

The continent of Eldor floats on the boundless "Ether Sea" (以太之海). The Ether Sea is a starry mist as dense as water, with no visible bottom. Stand at the edge of the continent and look out, and bands of glowing star currents flow across the surface of the mist.

### The Primal Heart and the Eight Source Flows

In primordial times a giant crystal condensed in the Ether Sea, called the **Primal Heart**. With every pulse it sends out eight **source flows** (源流):

- Six natural flows: **Water, Fire, Nature, Wind, Earth, Thunder**. They circle the Primal Heart and join head to tail in a ring
- Two primal flows: **Light** rises into the sky and **Dark** sinks into the earth
- Where flows meet and cancel each other, what remains belongs to no flow: **Neutral**

The continent's terrain, climate and creatures are all shaped by the flows. This set of relations is the game's element matchup; see [02 Elements and Fields](02-elements.md).

### Spirits

**Spirits** are life condensed from source flows. Each spirit has a "core" inside it, and it grows by absorbing source flow.

- **Breakthrough (突破)**: once its core has absorbed enough source flow, a spirit breaks past its former limit and its power leaps one stage (the game's Stage I → II → III). Each spirit has only one form and one name; after a Breakthrough it just grows a little larger
- **Every spirit has its own way of fighting**: spirits are not containers of numbers. Each carries the habits of the place it came from: mushrooms make people dream, penguins stack ice, bulls build up for a charge. These habits are the tailor-made kits and mechanics of each spirit in the game. A rare spirit is not "bigger numbers" but a more complete mechanic, and harder to deal with
- **True Name**: every spirit has a "True Name" that it tells only the person it trusts most. Calling it makes the spirit burn its source flow and unleash all of its power, which is the game's **Ultimate (奧義)**. The cost is too great, so it can be used only once per battle
- **Twelve SSRs = Eight Sacred Spirits + Four Legends.** The Eight Sacred Spirits (聖靈) are the embodiments of the eight source flows; each guards one Source Crystal and meets the protagonist at the top of the tower in its own region. The origins of the four Legendary spirits are all tied to human history and to that wound:

  | Legend | Origin | In the story |
  | --- | --- | --- |
  | **Eldarin, Dragon of the First Pact (初契之龍・艾爾達林)** | The dragon of the world's first pact; the prototype of the Pact Mark is carved on its forehead. After the Night of the Shattered Heart it slept beneath the base of the Star Gate | The protagonist's partner. It remembers the Night of the Shattered Heart and remembers Valde's voice; when the giant tortoise calls out Elda's name in Chapter 5, it is the only one not surprised |
  | **Astra, Warden of the Star Gate (星門守望者・阿斯特拉)** | A gatekeeper built together by the craftsmen and sages of the Kingdom Age, with a Starlight Stone for a heart and the stone of the city wall for a body. It has one task: let nothing through from the other side of the gate | Awakens when the Star Gate is relit and guards Astralgate. In the final chapter Selen hands the city over to it before he dares to lead people into the Rift |
  | **Chronos, the Hourglass Nautilus (時砂古螺・克羅諾斯)** | A small snail from the hourglass in the kingdom's bell tower. When time stopped on the Night of the Shattered Heart, it kept growing for a thousand years, waiting for the kingdom's last morning to come again | The Church moved the kingdom's bell-tower hourglass to the bell tower of Aurelia. In Chapter 7 a nun says there is "something counting" inside the hourglass, and the bell tolls for Nova |
  | **Nephe, Child of the Void (虛蝕之子・奈芙)** | A spirit that condensed at the edge of the Rift on the night of the Shattered Heart, belonging to no source flow. It does not understand the world and only understands devouring, until someone reaches out a hand to it | In the final chapter a Knights scout says that "something unlike the other corrupted ones" has been watching the patrol at the Rift's edge. Not everything the wound produced is bad: it and Nova are two children of the same night |

- **Corruption (蝕化)**: a spirit infected by the Void Blight. You can tell at a glance: the body fades to purple-black, the surface is covered in pulsing glowing cracks, black-purple **Void crystals** grow on the back and head, the eyes become hollow and glow red, black mist spreads from the feet, and the spirit twitches from time to time. A corrupted spirit loses its reason and pounces on anyone (corrupted spirits in the field charge at you on their own), and it is stronger but afraid of light, while the Void Blight eats its life bit by bit. While a spirit is corrupted, Pact Stones are bounced off by the Void crystals and no pact can form; knock it out, and the Void crystals shatter and the spirit returns to normal, which is **purification**. The shattered Void crystals form **Breakthrough Stones**, and a purified spirit is sometimes willing to follow the Pactbearer

### Seal Towers

After the Night of the Shattered Heart, the Void Blight seeped out of cracks in the earth. The first Pactbearers built a **Seal Tower** (伏魔塔) over each crack, set a Source Crystal into the heart of the tower, and used the source flow of the crystal to press the Void Blight down beneath it. Every floor of a tower is a seal.

- A thousand years later the seals have loosened floor by floor and the Void Blight leaks out through the gaps: **the land around a tower is eroded** (the ground blackens, cracks glow, plants wither, clumps of Void crystals grow), and most of the nearby spirits are already corrupted
- The Order of the Hollow Crown has slipped into the towers across the land, trying to pry the seals open and seize the Source Crystals at the tower hearts
- The Pactbearer breaks through from the bottom up, floor by floor, relighting the seals; **each floor relit pushes the erosion around the tower back a little**, and once all floors are cleared the erosion disappears and the Source Crystal at the top sends up a pillar of light
- The keepers at the tops of the towers (forest warden Shia (希雅), lighthouse keeper Marin (瑪琳), ...) run the 「源晶試煉」 (Source Crystal Trial) and hand the crystal only to a true Pactbearer
- In the game: each region's Seal Tower is the main-story stage, with the Source Crystal Trial on the top floor; clearing it is what unlocks the next region

### Pacts and Pactbearers

Humans cannot manipulate source flow directly, but through the **Pact Mark** (an emblem carved on the back of the hand) they can form a pact with a spirit. The pact runs both ways: the spirit lends its power, and the Pactbearer provides judgment and will.

- **Origin of the Pact Mark**: the first Pactbearer, **Elda** (艾爾達), formed the world's first pact with a platinum-gold dragon. The prototype of that mark is still carved on the dragon's forehead, and the dragon is **Eldarin, Dragon of the First Pact**. The emblems on the backs of the hands of all later Pactbearers are copies of that one
- **Aether (靈能)**: the source flow that the Pactbearer and the spirit share through the Pact Mark. It is the resource for all skills in battle
- **Battle Oaths (戰技)**: the pact runs both ways, so the Pactbearer can also send their own will into the battlefield through the Pact Mark, once per battle. The six Arts divide into two lines, both from the same Pact Mark:
  - Three **Oaths** (誓): **Oath of Breaking (破陣之誓), Oath of Guarding (守護之誓), Oath of Gale (疾風之誓)**. Promises the Pactbearer makes to the spirit, which the spirit answers with power. Formalized by the Silver Oath Knights (銀誓騎士團), under the creed "the oath is our shield"
  - Three **Echoes** (回響): **Eye of Insight (看破之眼), Purifying Light (淨化之光), Aether Spring (靈能湧泉)**. Abilities the Pact Mark lends back to the Pactbearer. Rediscovered in the texts of the Kingdom Age by scholars of the Star Vault Sages' Tower (星穹賢者塔)
  - The Pactbearer picks one before setting out, and can change it at any time afterward
- **Hidden Spells (伏咒)**: the Pact Mark can bury a small amount of Aether on the battlefield in advance, to trigger as soon as the opponent steps into its condition. Kingdom Age Pactbearers developed this craft at the Star Gate Arena, and it is the **Trap (伏技)** of battle
- **Guarding and switching**: the two most basic things a Pactbearer says to a spirit, "block" and "retreat". They are not skills; every spirit understands them

> **Terminology rule**: in this game "spirit" means the source-flow lifeforms described above. To avoid confusion, the long-lived people of the forest are not called the elf race but "**Forest Folk**" (森民).

## 3. Timeline

| Age | Time | Events |
| --- | --- | --- |
| Primordial Age (太初紀) | None | The Primal Heart is born in the Ether Sea, the eight source flows split apart, and the continent takes shape |
| Spirit Age (精靈紀) | From about 10,000 years ago | Source flows condense into the first spirits. The eight oldest spirits become the embodiments of the source flows and are later called the "**Eight Sacred Spirits**" |
| Kingdom Age (王國紀) | About 3,000-1,000 years ago | Humans found the **Kingdom of Eldor** at the center of the continent. The first Pactbearer Elda forms the first pact with the First Pact Dragon and creates the Pact Mark, and people and spirits begin to live together. The Silver Oath Knights (Oaths) and the Star Vault Sages' Tower (Echoes) are founded. The kingdom builds the **Star Gate**: a giant device that can call distant spirits along the source flows |
| Night of the Shattered Heart | About 1,000 years ago | The great sage **Valde** (瓦爾德), seeking eternity, tries to cut open the Primal Heart. The other side of the rift leads to outside the world, and a nothingness called the "**Void Blight**" surges in. The Primal Heart shatters itself to seal the rift, becoming eight **Source Crystals** that scatter in eight directions across the continent, each guarded by one of the Sacred Spirits. The kingdom collapses in a single night and the Star Gate falls silent. Eldarin sleeps beneath the base of the Star Gate |
| Silent Age (沉寂紀) | 1,000 years ago to the present | The regions develop different cultures under the influence of the Source Crystals. All that remains of the kingdom's name is the continent's name, "Eldor". The craft of pacts is handed down in different forms in different places |
| Star Gate Year 1 (星門曆元年) | Present | The **Pactbearers' Guild** (締約者公會) rebuilds Astralgate on the ruins of the kingdom and relights the Star Gate with Starlight Stones (crystals that fell in the meteor showers of the Ether Sea). The moment the Star Gate lights, Eldarin wakes, and a girl who has lost her memory appears before the gate. In the same year corrupted spirits begin to appear, and the **Order of the Hollow Crown**, which worships the Void Blight, surfaces |

## 4. Geography

### The Map Is the Matchup Chart

The six natural regions circle the central Star Gate city clockwise, in the order of the source-flow ring. **Two neighboring regions are exactly an advantage relationship**, so each border zone is where two source flows wrestle. Light is in the sky and Dark is under the ground.

```
                        Aurelia (Light)
                    floats above Astralgate
                               │
   Tidesong Isles (Water) ───────────── Emberspine (Fire)
           ╱                                     ╲
Stormreach (Thunder)       Astralgate       Whisperwood (Nature)
           ╲                                     ╱
Stoneheart Canyon (Earth) ───────────── Galecrest (Wind)
                               │
                        Umbral Hollow (Dark)
                    deep beneath the continent

  Clockwise: Water → Fire → Nature → Wind → Earth → Thunder → Water (each beats the next)
```

| Border zone | Matchup | Landscape |
| --- | --- | --- |
| Steam Coast (蒸汽海岸) | Water beats Fire | Waves pound the lava cape without pause, and steam hangs in the air all year |
| Scorched Treeline (焦痕林線) | Fire beats Nature | A long band at the forest's edge burned black, where new shoots and embers live side by side |
| Windbreak Belt (防風林帶) | Nature beats Wind | A wall of giant trees planted by the Forest Folk, blocking the gales from the plateau |
| Windcarved Stones (風蝕石林) | Wind beats Earth | A cluster of rock pillars cut into odd shapes by the wind |
| Lightning-Rod Fields (避雷柱原) | Earth beats Thunder | A thousand stone pillars raised by the canyon dwarves, which lead the plains' lightning strikes into the ground |
| Thunderstorm Strait (雷暴海峽) | Thunder beats Water | A strait under storm clouds all year, which only brave captains dare to cross |

### Regions

| Region | Element | Terrain | Residents and culture | Common spirits | Source Crystal Keeper |
| --- | --- | --- | --- | --- | --- |
| **Astralgate (星門城)** | Neutral | A ring-shaped city built on the kingdom's ruins, with the Star Gate rising at the center | Pactbearers' Guild headquarters, the Star Gate Arena, a market, an academy. People from everywhere come here | Cloudfluff (絨雲) | Guild Master Selen (賽倫) |
| **Whisperwood (翠語森林)** | Nature | Giant-tree forests, glowing mushroom rings, treetop settlements | The long-lived Forest Folk, who speak slowly and remember a great deal | Elderwood Warden (古木熊衛), Dreamveil Matron (幻夢菌后) | Forest warden Shia + Sylvaron (萬葉古鹿) |
| **Tidesong Isles (潮歌群島)** | Water | Coral reefs, lighthouses, the northern ice fields | Fishers and sailors, who believe the tides are the song of the Sacred Whale | Oathsea Sage (海誓賢獺), Icecrown Emperor (冰冠皇企鵝) | Lighthouse keeper Marin + Thalassene (潮汐聖鯨) |
| **Emberspine (焰脊火山帶)** | Fire | Volcanoes, lava rivers, the forge city Rediron Keep (赤鐵堡) | Smiths and knights; a branch garrison of the Silver Oath Knights | Pyre Dragoon (熾焰龍騎), Pyrewing Queen (焰翅蛾后) | Forge knight Regna (蕾格娜) + Ignisar (煌焰獅王) |
| **Galecrest (蒼嘯高原)** | Wind | Cliffs, seas of cloud, floating rocks | The winged Wing Folk (翼民), famed as couriers and minstrels | Skyreign Falcon (蒼風隼王), Galeweasel (嵐斬鼬) | Wind courier Aiz (艾茲) + Aeroth (蒼穹天鷹) |
| **Stoneheart Canyon (磐心峽谷)** | Earth | Deep gorges, an underground kingdom, quicksand | The dwarf kingdom, built on the back of a sleeping giant tortoise | Monolith Colossus (磐石巨像), Sand Reaper (沙鐮蠍) | Dwarf king Baldo (巴爾多) + Terragon (磐岳巨龜) |
| **Stormreach (雷鳴荒原)** | Thunder | Endless grassland, thunderclouds, nomad camps | Nomad tribes that migrate following the thunderclouds | Stormram (霆角公羊) | Chieftain Kalan (卡蘭) + Voltarion (雷霆麒麟) |
| **Aurelia (曦光聖都)** | Light | A white holy city floating on the clouds, with bell towers | Seat of the Dawnlight Church (曦光教廷), in good order | Chime Sprite (晨鈴仙) | Saintess Iris (伊莉絲) + Luminael (晨星天馬) |
| **Umbral Hollow (暮影幽境)** | Dark | Underground forests, the Lake of Eternal Night, the ancient kingdom's catacombs | The Umbral Society (暮影結社), regarded as heretics | Eclipse Batlord (月蝕蝠王), Soul Lantern (冥燈引魂者) | Society head Mo (墨) + Noxfang (永夜魔狼) |
| **The Rift (虛蝕裂隙)** | Neutral | The wound left by the Night of the Shattered Heart, where space is warped | None | Corrupted spirits | Final chapter |

## 5. Factions

| Faction | Stance | Description |
| --- | --- | --- |
| **Pactbearers' Guild** | The protagonist's own | Manages the Star Gate, registers Pactbearers and runs the arena. Pragmatic, and values equality between people and spirits. The Guild's creed: "A pact can still save them" |
| **Silver Oath Knights** | Friendly | A knightly order that forms pacts through oaths, keepers of the lineage of the three Oaths. "The oath is our shield, to keep the spirit safe". The rival Kael (凱爾) comes from here. The Order holds that a pact is a responsibility, and a Pactbearer must be worthy of the spirit |
| **Star Vault Sages' Tower** | Friendly | Scholars who study the Pact Mark and the source flows and keep the texts of the Kingdom Age; the three Echoes come from here. It is also where the great sage Valde came from, and it is tight-lipped about this. Mila (米菈) is a junior researcher here |
| **Dawnlight Church** | Friendly on the surface | The center of faith for the Light source flow. It holds that corrupted spirits should be "purified" (in fact, destroyed), which conflicts with the Guild's ideals. A "purification" twenty years ago is the source of Selen's old injury |
| **Umbral Society** | Gray | A secret organization guarding the Dark Source Crystal, long regarded as heretics by the Church. They know the truth of the Night of the Shattered Heart |
| **Order of the Hollow Crown** | Hostile | Worships the Void Blight and believes that "nothingness is true freedom". Collects Source Crystals to open the Rift again. Cultists never say "Void Blight", only "freedom" |

## 6. Main Characters

| Character | Role | Profile |
| --- | --- | --- |
| **Protagonist** | The player | A newly minted Pactbearer with a customizable look, addressed as "Pactbearer" by default. On the day the Star Gate relit, Eldarin woke in front of them and formed a pact on its own. Chooses one Battle Oath before setting out, and can change it later |
| **Eldarin** | Partner, the First Pact Dragon | Partner of the first Pactbearer Elda, with the prototype of the Pact Mark carved on its forehead. It slept for a thousand years and woke to a world that had been renamed. It remembers the Night of the Shattered Heart and remembers Valde's voice. It seldom speaks, and when it does it says a single sentence |
| **Mila** | Companion | A junior researcher of the Star Vault Sages' Tower, lively and curious, always carrying a notebook. Travels with the protagonist everywhere and handles new-player tutorials and system explanations. Studying corruption is her thesis topic |
| **Selen** | Mentor | Guild Master of the Pactbearers' Guild, once the strongest Pactbearer. Gentle and of few words. His left arm has an old injury that he can barely lift and never mentions: twenty years ago in Aurelia, the Church "purified" his corrupted partner, and he took the blow in his partner's place and failed to block it. The Guild's creed "A pact can still save them" is his |
| **Kael** | Rival | A junior knight of the Silver Oath Knights, a proud prodigy. He holds an oath dearer than life and believes a Pactbearer must be "worthy" of their spirit, so he cannot stand that the protagonist's strength was "picked up" along with a legendary dragon. His partner is Pyre Dragoon, whom he grew up with |
| **Nova** | Mystery | A girl who appeared in front of the Star Gate when it lit, with no memory; Selen took her in at the Guild. She is in fact the will left over when the Primal Heart shattered. She can hear the voices of the source flows and hums songs that no one taught her |
| **The Uncrowned** | Villain | Head of the Order of the Hollow Crown, always wearing a broken crown. His true identity is the great sage Valde, kept alive by the Void Blight. Courteous and weary; he never says "Void Blight" and calls it "freedom" and "wholeness" |

**Tower keepers**: Shia (Whisperwood), Marin (Tidesong Isles), Regna (Emberspine), Aiz (Galecrest), Baldo (Stoneheart Canyon), Kalan (Stormreach), Iris (Aurelia), Mo (Umbral Hollow).

### Character Voice

Dialogue is natural, everyday Taiwanese Mandarin, and it should sound like a well-dubbed anime or TV drama: not explanatory prose and not stilted, foreign-sounding phrasing. **Sound like a normal person first, then have personality** (the project owner rejected the old dialogue on 2026-09-28: it "feels super fake-human" and "the tone makes people feel fear; it is not how normal people talk"): full sentences, normal connectives, every line connecting to the previous one, emotions expressed normally, and what needs saying said directly. A character's personality shows in what they care about and how they see the matter, not in catchphrases; a catchphrase at most once per scene, and the ellipsis "……" at most once per scene, used only for real hesitation or when words fail. The listener knows nothing: do not write lines that presuppose a question the other party asked, and do not write noun explanations of the form "X is called Y". Do not compress a sentence into a stiff fragment just to save a few words.

**Plain wording first**: say every line out loud, and if you have to stop and think to understand it, rewrite it. A character may have catchphrases and quirks, as long as an ordinary person understands them at once. Verbs must go with their nouns; when unsure, pick the most ordinary everyday phrasing: a light "went dark" (暗下來) or "went out" (熄了), not "retreated" (退了); a move "can't be used" (用不出來), not "went back to sleep" (睡回去). Do not let abstract nouns act like people ("the true name went back to sleep" (真名睡回去了), "it will wake again" (它會再醒)). Do not use a comma to cut the subject from the predicate to create a pause ("My true name, I lend you to call once" (我的真名，借你喊一次); "People call us, spirits" (人叫我們，精靈)). Dialogue must not lean on concepts the player cannot understand: for example, "True Name" is used only as the name of the Ultimate and is not a piece of lore the player has to grasp in dialogue.

**Dialogue prohibitions**: no dashes of any kind or length; an inserted clause becomes its own sentence, or goes between commas. Do not use: "interweave" (交織), "weave" (編織), "whisper" (低語), "murmur" (呢喃), "echo" (迴盪), "linger" (縈繞), "quietly" (悄然), "resplendent" (璀璨), "profound" (深邃), "endless" (無盡的), "ancient power" (古老的力量), "gears of fate" (命運的齒輪), "witness" (見證), "a journey of ..." (一場……的旅程). Do not write "not only ... but also ..." (不僅……更是……), do not write "not A, but B" for rhetoric, and do not make a rhythmic list of three. No riddles, no figurative lore explanations ("the tower is like a hand pressing down on the wound beneath" (塔像一隻手，壓著底下的傷口)) and no pretentious lines. No strings of broken short fragments ("Wouldn't wake. The dream was too long." (叫不醒。夢太長了。)). No horror-movie lines that make people's skin crawl, unless that scene is meant to scare. Talk about things that can be seen, touched and done, not abstract words. **Every line must make literal sense** (the project owner's rejection: "'Don't step in, the miner said it's his breath': how do you step on a breath" (別踩進去，礦工說那是他的呼吸，呼吸是要怎麼踩)): a breath cannot be stepped on, a heartbeat cannot be counted, a tower does not fall asleep, thunder does not speak; figures of speech in old lines are not plot facts, so change them into the concrete reason a local would give an outsider ("A giant python lives under the quicksand; when the sand moves, it is turning over down there" (流沙底下住著一條巨蟒，沙子會動就是牠在底下翻身)). Ask of every line: would this person really say this out loud in this situation?

#### Main Characters

**Mila**
- 19 years old, a junior researcher at the Star Vault Sages' Tower, with corruption as her thesis topic. Her family runs a bookshop, and she has read the old texts as storybooks since childhood.
- Wants: to understand corruption and write a paper nobody has written; and, while she is at it, to see the protagonist come back alive.
- How she speaks: lively, talkative, curious, in full sentences, fast but clear. Self-deprecating, takes good care of the protagonist, often tells the protagonist what she sees and guesses the reason in passing. Occasionally mentions her research or notebook and occasionally says "hey" (欸), but not in every scene. Colloquial, with Taiwanese sentence-final particles (喔, 啦).
- Never says: cold commands; "I don't know" (she always follows it with a guess); textbook-style definitions.
- Examples: "Hey, look at the crystals on its back, bright then dark, like it's breathing. I'm definitely writing this down after the fight." / "I'll say this first: corruption is my thesis topic, so before you knock it out, could I get a couple more looks?"

**Selen**
- 44 years old, Guild Master of the Pactbearers' Guild, once the strongest Pactbearer. Twenty years ago in Aurelia, the Church "purified" his corrupted partner; he stood in front of it, and his left arm has not lifted since.
- Wants: that no second Pactbearer ever stands in that position. The Guild's creed "A pact can still save them" is his.
- How he speaks: few words, calm, short but complete sentences with warmth, and he says clearly what needs to be said. No exclamation marks. When asked about his own past he says "We'll talk about that later."
- Never says: explanations of himself; "trust me"; long speeches.
- Examples: "Be careful out there. If you meet the Cult, don't fight them head-on." / "We'll talk about that later. Finish the tower today."

**Kael**
- 17 years old, a junior knight of the Silver Oath Knights and the youngest prodigy in the Order. His father is an instructor of the Order, and he was taught from childhood that "a Pactbearer must be worthy of their spirit". His partner is Pyre Dragoon (who grew up with him).
- Wants: to be knighted formally and prove he is worthy. He cannot stand that the protagonist "picked up" a legendary dragon.
- How he speaks: proud, competitive, stubborn, like a normal 17-year-old boy. Calls the player "you" and never uses a name. Cares about "oaths" and "being worthy of one's spirit". Calls his own spirit "my partner". When he praises someone he awkwardly adds a "but". Occasionally a "hmph", not in every line.
- Never says: "please" or "sorry" (in the final chapter he manages half of one: "Um. About before.").
- Examples: "Don't get it wrong. That dragon woke up on its own. You didn't wake it." / "That last hit, I'll give you that. It won't land again next time."

**Nova**
- Looks 14, appeared in front of the Star Gate the day it lit, with no memory. In fact she is a small piece of will left behind when the Heart of the World shattered.
- Wants: to find out who the voice that keeps calling her is. At the Rift she learns that she has to go back.
- How she speaks: like a child, with simple words, direct and curious. She says what she hears and feels ("so loud", "it hurts", "it sounds nice"), says it even when others can't hear it, and asks the questions only children ask. She makes people feel she is cute and a little wondrous, not eerie.
- Never says: idioms; adult pleasantries; riddles that take a moment to understand, like "something is thinking about me".
- Examples: "Your spirit is so loud. But it sounds nice, like it's singing." / "The trees are talking. Why can't you hear them?"

**Eldarin**
- The dragon of the world's first pact. It was there on the night of the Shattered Heart and protected Elda ("she"), but could not protect the heart of the world. After that it slept for a thousand years beneath the Star Gate. The animated prologue is narrated by it in the first person.
- Wants: to finish what the last pact left undone. To recognize Valde's voice.
- How it speaks: plain speech, like a very old, very calm dragon talking to you. Few words, a steady tone, complete and easy sentences. It says directly what it can and cannot do. It calls the player "you" or "Pactbearer", and says "she" when it speaks of Elda.
- Never says: riddles or pretentious lines; sentences with commas forcing out pauses; jokes; exclamation marks; words like "source flow" or "Ether Sea".
- Examples: "The Star Gate just lit, and I still have plenty of power. When the fight starts I can use all of it once." / "Valde. A thousand years, and your voice hasn't changed at all."

**The Uncrowned (Valde)**
- The great sage of a thousand years ago, the one who cut open the Heart of the World. He has lived until now on the Void Blight, wearing a shattered crown and shutting himself inside the tower in the Rift.
- Wants: to put the heart back together and return to the morning before the Night of the Shattered Heart. He believes he never meant to destroy anything, only to stop losing.
- How he speaks: polite, weary, slow, in full sentences. He talks about the specific things he wants back (that morning, friends, the kingdom) and does not pile up big abstract words. He calls the Void Blight "freedom". He shouts only once in the whole story (when Nova sees through him).
- Never says: the words "Void Blight"; insults; anything hurried.
- Examples: "Welcome. In a thousand years, you are the first guest to make it here." / "I never meant to destroy anything. I just didn't want to lose anything else. Do you understand?"

#### Tower Keepers and Local Characters

| Character | Identity and wants | How they speak | Never says | Examples |
| --- | --- | --- | --- | --- |
| **Shia** (Whisperwood) | The Forest Folk's forest warden, older than the elders. Wants the forest to wake up, and wants to see whether the protagonist's hand can hold a spirit | Slow and gentle, in full sentences. Occasionally compares things to trees or seasons, in a way that is understood at once | Rushing; the word "quick" | "You came running all the way up here, in such a hurry. Normally I would tell you to slow down." / "A tree takes many years to stand firm. You and your spirit have known each other only a few days; let me see whether you get along." |
| **Marin** (Tidesong Isles) | Lighthouse keeper in their early thirties, who grew up with the Sacred Whale's song. Wants the whale to sing again, and wants to find someone the Source Crystal can be trusted to | Loud, with a seaside person's bluntness. "Hey!" "Kid." Loves talking about the Sacred Whale and laughs when she comes up | Sulking for more than one sentence; pleasantries | "Hey! You're the kid who woke the sea monster? Come here, let me look at you." / "When it sings, the whole sea sways along with it. You'll see in a moment." |
| **Regna** (Emberspine) | Forge knight and branch commander at Rediron Keep. The Cult forged swords in her tower without her noticing, and she wants to wash away this disgrace | Direct and crisp, with short but complete sentences. Likes to judge people by grip and by heat | Pleasantries; comfort | "Hold out your hand and let me see. Hm, still not gripping tight enough." / "You can't fake it in fire. If you can take it, your spirit will acknowledge you." |
| **Aiz** (Galecrest) | The Wing Folk's wind courier, the fastest flyer on the whole plateau. Wants to get all the letters back, and to win a bet while at it | Fast talker, jokes, loves betting, and often wants to fly off before finishing a sentence | Dragging, long-winded speeches | "Let's make a bet: one feather says you can't catch me." / "Fine, I lose, here's the Wind Source Crystal. Hey, don't go yet, I'm not done talking." |
| **Baldo** (Stoneheart Canyon) | Dwarf king, 120 years old. Wants to protect the royal city built on the tortoise's back; what he fears is not the Cult but the tortoise waking | Hearty laugh, booming voice, refers to himself as 「俺」 (a gruff, rustic "I"). Calls everyone "kid" (小子). Proud of the royal city | Admitting fear (only once) | "Kid, what you're standing on is a tortoise. The biggest one in the world. We live on its back." / "...If it turns over, my royal city is gone. So I can't lose to you." |
| **Kalan** (Stormreach) | Nomad chieftain, who has chased thunderclouds all their life. Wants the clouds to move again and the tribe to set out again | Even, with the patience of someone weathered by wind and sun. Talks about clouds, flocks and a thousand years | Rushing; complaining | "If the clouds don't move, we don't move. We've waited a thousand years; a few more days make no difference." / "You fight louder than a thundercloud. But that's right, clouds need that to get moving." |
| **Iris** (Aurelia) | Saintess, 36. At 16 she led her first "purification" and ordered Selen's partner cut down. For twenty years she has spoken by the scriptures, and she wants to know whether the scriptures are wrong | Formal and restrained, with "please" in every sentence. Uses questions in place of statements. Her voice gets quieter when she is about to give way | Raising her voice; admitting the earlier thing outright with "I was wrong" (she goes the long way around first) | "Please tell me, those you saved... do they still remember who they are now?" / "If the scriptures are wrong, then whom have I been speaking for these twenty years?" |
| **Mo** (Umbral Hollow) | Head of the Umbral Society, keeper of Noxfang and of the truth of the Night of the Shattered Heart. Wants to find someone worthy of taking Nova to the Rift | Cold and direct with a touch of sarcasm; says the truth without detours | Comfort; explaining a second time | "You think the Heart of the World was cut open by someone? No. It shattered by itself." / "That child is not human. You must have noticed already." |
| **Cultists** | The Order of the Hollow Crown's scouts, captains, smiths, priests, foremen, ritualists, infiltrators, officers and high priests. Want to open the towers so that the Uncrowned can see them | Fervent, repeating the leader's words. "Freedom", "liberation" | Saying "Void Blight"; doubt | "The seal is a shackle! The Uncrowned will free this tower!" |
| **Forest Folk** | The long-lived residents of Whisperwood | Slow and gentle, calls young people "child" | Rushing | "Child, that root you just stepped on is older than your grandmother." |
| **Isle residents** | The fishers, captains and guards of the Tidesong Isles | Loud, direct, often ending sentences with the particles (啊, 啦) | Pessimism | "The tide's all messed up, so the boats won't go out at all." |
| **Rediron Keep residents** | Blacksmiths, guards, junior knights | Direct, rough, talk about heat | Euphemism | "That hammering inside the tower isn't ours. The rhythm is wrong." |
| **Wing Folk** | Couriers, poets, shepherd children | Fast and hearty | Dawdling | "The wind changed direction, and the letters went missing with it." |
| **Dwarves** | Miners, craftsmen, guards | Booming, down-to-earth, says 「俺」 for "I" | Abstractions | "I've been digging forty years, and this is the first time I dug into a cave that glows." |
| **Nomad tribe** | Elders, horse herders, riders, thunder-seers | Even and patient, talk about clouds and sheep | Rushing | "The sheep know before people that the clouds are about to move." |
| **Aurelia residents** | Nuns, guards, Church knights, judges, choir | Formal, voices lowered | Criticizing the Church directly | "The Saintess lately... often stands alone looking at the top of the tower." |
| **Hollow residents** | Lamp-keepers, shadow guards, mask merchants | Speak quietly and are very wary | Loud talk | "Don't leave the light. When the lights go out, they come." |

## 7. Main Story Outline

**Prologue 「星門初啟」 (The Star Gate Awakens)** (Astralgate, Lv 1-5): the animated prologue is narrated by Eldarin; it tells of the Night of the Shattered Heart and the lost world, and stops at the Star Gate relighting and the dragon beneath the gate opening its eyes. The game picks up from that moment: Mila finds the fallen protagonist beneath the gate, and the First Pact Dragon Eldarin awakens and offers a pact on its own. The light of the Star Gate draws in a wild Cloudfluff, and Mila takes the protagonist through the first tutorial battle: the Star Gate has just lit, so Eldarin can use one full-power move (the Ultimate), but it holds back, and the protagonist captures the Cloudfluff. After the battle Selen explains the eight Source Crystals, the first of which is in the forest; Nova, who came with him, appears for the first time and says the protagonist's spirit is "so loud, but sounds nice, like it's singing", and Eldarin asks her "You can hear it?". She is the girl whom Selen took in at the Guild, who stood on the other side of the gate when the Star Gate lit. Mila hands over a Pact Ticket, and the first Star Gate Summon (星門召喚) follows. Kael is not in the prologue; he first appears in Chapter 3 at Rediron Keep.

| Chapter | Region | Suggested level | Plot points |
| --- | --- | --- | --- |
| Chapter 1 「入夢之森」 (The Dreaming Forest) | Whisperwood | 5-12 | The forest is too quiet: the Forest Folk have fallen into dreams together in the mushroom rings, and a child's grandmother will not wake. First purification of a corrupted spirit. Cult scouts inside the tower feed corrupted spirits to the Dreamveil Matron. Shia's trial; Sylvaron appears and the forest wakes |
| Chapter 2 「潮汐之歌」 (Song of the Tides) | Tidesong Isles | 12-18 | The Sacred Whale's song has stopped, the tides are disordered, and fishing boats are stuck in harbor. A Cult black-sail ship sails into the ice bay, and the first head-on clash follows. A sea monster sings a stolen passage of the song and puts the Sacred Whale to sleep. Nova hums a melody in the Guild that nobody taught her. The old captain remembers "a man from the Guild who left twenty years ago with one arm hanging" |
| Chapter 3 「赤鐵之誓」 (Oath of Red Iron) | Emberspine | 18-25 | The tournament at Rediron Keep. Kael's first appearance: this is his knight's trial, and he must beat the protagonist to be knighted, the first duel. The Cult forges "a sword that can cut Source Crystals" in the tower with corrupted fire. Regna's trial; Ignisar |
| Chapter 4 「雲上信使」 (Messengers Above the Clouds) | Galecrest | 25-32 | The Wing Folk's letters are missing, carried off by a corrupted Eye of the Gale (颶風之眼), which has never lost a letter. Among the letters are the Cult's codes for its bases, a letter the Church sent to Selen, and a letter that mentions "that Silver Oath knight". Aiz's trial; Aeroth |
| Chapter 5 「沉睡之山」 (The Sleeping Mountain) | Stoneheart Canyon | 32-38 | The ground is shaking: the Cult is digging under the tower and prying at the seal, the giant tortoise is waking, and the whole royal city will fall into the canyon. Baldo's trial. Terragon opens one eye, looks at Eldarin, and says a name: "Elda" |
| Chapter 6 「雷之遷徙」 (The Thunder Migration) | Stormreach | 38-44 | The thunderclouds have stopped, and the tribe that has chased clouds for a thousand years is trapped for the first time. Kael entered the tower first and waits for the protagonist before the Cult's altar: he was shaken by the Cult's words. The decisive duel with Kael; he loses, and for the first time admits that a pact is not a command. The Uncrowned speaks for the first time through the altar. Kalan's trial; Voltarion, and the clouds move again |
| Chapter 7 「黎明審判」 (Judgment at Dawn) | Aurelia | 44-50 | The Church surrounds the tower to "purify" all the corrupted spirits inside. Selen comes in person. A nun says the Saintess lately keeps staring blankly at the top of the tower. The protagonist purifies all the way to the top, proving that a pact can restore them. Selen's old injury is revealed here: twenty years ago, in this very city. Iris admits the scriptures were wrong, and Luminael stands up "for" someone for the first time |
| Chapter 8 「永夜真相」 (The Truth of Eternal Night) | Umbral Hollow | 50-55 | The Umbral Society reveals the truth of the Night of the Shattered Heart: the one who cut open the Primal Heart was Valde, the Uncrowned; the dire wolf bit the Void Blight by the throat back then; the Primal Heart was not cut apart but chose to shatter itself, and its remaining will has been following the protagonist all along: Nova. Mo's trial; Noxfang |
| Final Chapter 「碎心之夜」 (Night of the Shattered Heart) | The Rift | 55-60 | The last duel with Kael, and then fighting side by side. The Uncrowned's true face: what he wants is not destruction but "never losing again". Eldarin recognizes Valde's voice. Nova's choice: return to the Primal Heart, let the eight Source Crystals resonate again, and seal the Rift. A pact runs both ways: she will come back |
| Epilogue | Rift Depths | 60 | Descend layer by layer into the depths of the Rift (periodic challenge), arena seasons |

Fixed structure of every chapter: **Arrival (a hook) → the local trouble (a person inside the trouble) → the Cult steps in → Source Crystal Trial (Keeper 3v3) → a Sacred Spirit appears**.

### Foreshadowing

| Thread | Plant | Payoff |
| --- | --- | --- |
| Nova is the will of the Primal Heart | Appears in the prologue with Selen and can hear the voice in Eldarin; the dragon asks "You can hear it?"; in Chapter 2 she hums the Sacred Whale's lost song; in Chapter 5 the tortoise is "counting her heartbeat"; in Chapter 7 the Church's bell tolls for her | Chapter 8, Mo points it out; final chapter, her choice |
| Selen's old injury | Chapter 2, the old captain's memory, and Mila notices the Guild Master's left hand also hangs; Chapter 4, the letter the Church sent him | Chapter 7, Aurelia: the blow he took for his partner twenty years ago |
| Kael's pride | Chapter 3, first appearance, "I think highly of that dragon", while Mila says he thinks you picked it up; Chapter 3, the tournament trial; Chapter 4, a letter mentions the Cult is watching him | Chapter 6, after the duel he admits he wavered; final chapter, "partner" |
| The truth of the Night of the Shattered Heart | Chapter 1, Shia: "the tower is a hand pressed over the wound"; Chapter 5, the tortoise calls out Elda's name; Chapter 6, the Uncrowned says through the altar "I destroyed nothing" | Chapter 8, Mo reveals it; final chapter, Eldarin recognizes Valde |

## 8. How Systems Map to the World

Every system has to make sense inside the story, so the player feels this is one whole world.

| Game system | In-world explanation |
| --- | --- |
| Gacha | **Star Gate Summon**: light the Star Gate with Starlight Stones and call distant spirits along the source flows. Those who come are spirits willing to answer you, not spirits who were caught |
| Duplicate spirits | **Shared-source resonance** (同源共鳴): the source flow of the same spirit answers again, and the pact deepens |
| Capture | Offer a pact to a wild spirit with a **Pact Stone**. A weakened spirit is more willing to listen |
| Levels | A spirit's core absorbs the source flow that moves through battle, and grows |
| Breakthrough | See "Spirits" in Section 2 |
| Each spirit's exclusive skill set | The habits and nature of the spirit's home; rarity = completeness of mechanics, not numbers |
| Aether | The source flow that the Pactbearer and the spirit share through the Pact Mark |
| Traps | The "Hidden Spells" developed by Pactbearers of the Kingdom Age |
| Ultimate | Calling the spirit's **True Name**, only once per battle |
| Battle Oaths | A sentence the Pactbearer sends into the battlefield through the Pact Mark: three Oaths and three Echoes, once per battle |
| Guard, switch | The most basic commands a Pactbearer gives a spirit, which every spirit understands |
| Fields | Powerful spirits can rewrite the source flow around them (a Sacred Spirit's field unfolds automatically on entry) |
| PvP | The Star Gate Arena: formal duels between Pactbearers, descended from the knightly tournaments of the Kingdom Age |
| Bond | The time spent with a spirit. It does not affect stats and only unlocks voices, animations and background stories |

## 9. Naming Conventions

| Object | Rule | Example |
| --- | --- | --- |
| Ordinary spirit | 2-4 characters, the first half a trait and the second half the animal or species; each has one name, and a Breakthrough does not rename it | Pyre Dragoon (熾焰龍騎) |
| Sacred Spirit (SSR) | 「title・name」 in Chinese, with the name a Western-style transliteration | Ignisar, the Blazing King (煌焰獅王・伊格尼薩) |
| Skill | 2-4 characters, with the element or effect clear at a glance | Shatter Lance (碎冰槍), Quicksand (流沙陷阱) |
| Region | "Imagery + terrain", four characters | Tidesong Isles (潮歌群島), Stoneheart Canyon (磐心峽谷) |
| English name | Every noun has an English name, used for program ids and for overseas editions | Tidesong Isles |

## 10. Open Questions

- Whether the protagonist has a voice, and the scope of appearance customization
- Nova's choice in the final chapter is currently a single ending (she returns to the Primal Heart and leaves a promise that she will come back); whether to make it a branching ending
- In which version to release limited SSRs beyond the Eight Sacred Spirits (for example "Corrupted Sacred Spirits", or partners of the legendary Pactbearers of the Kingdom Age)
