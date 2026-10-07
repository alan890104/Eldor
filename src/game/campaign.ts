// Main story: nine regions. Each region has a field that can be freely explored (towns, wild spirits, treasure chests) and a Seal Tower;
// the tower's floors are the main-story stages, and the source crystal trial on the top floor must be cleared before going on to the next region. Story dialogue is also here.

import type { Element } from '../../sim/types.ts';
import type { ArtId } from '../engine/types.ts';
import type { RegionId } from '../render/arena.ts';

export interface Line {
  who: string;
  text: string;
}

export interface EnemyDef {
  speciesId: string;
  level: number;
  corrupted?: boolean;
}

export interface Reward {
  gold: number;
  crystals?: number;
  tickets?: number;
  breakStones?: number;
  shards?: number;
  potions?: number;
  stones?: number;
  advStones?: number;
  masterStones?: number;
}

/** corrupt: groups of corrupted spirits that leaked out of the seal in the tower (beating them purifies them; they cannot be captured) */
export type StageKind = 'wild' | 'trainer' | 'cult' | 'rival' | 'boss' | 'corrupt';

export interface StageDef {
  id: string;
  name: string;
  kind: StageKind;
  level: number;
  /** Fixed team; wild draws one from the pool */
  team?: EnemyDef[];
  pool?: string[];
  corruptedWild?: boolean;
  enemyName: string;
  art?: ArtId;
  aiSkill: number;
  reward: Reward;
  before?: Line[];
  after?: Line[];
}

export interface WildEntry {
  speciesId: string;
  weight: number;
}

/** A resident of the town: appearance is set by look; walk up and press the interact key to talk */
export interface NpcDef {
  name: string;
  look: NpcLook;
  lines: Line[];
}

export type NpcLook = 'mila' | 'villager' | 'elder' | 'guard' | 'kid' | 'scholar' | 'knight' | 'nomad' | 'shade';

export interface RegionDef {
  id: RegionId;
  name: string;
  element: Element | null;
  desc: string;
  /** Base level of the field's spirits */
  level: number;
  /** The town in the region (where the player starts on entering the region) */
  town: string;
  /** The Seal Tower at the end of the region */
  tower: string;
  /** The tower's floors, from the bottom up; the top floor is the source crystal trial, and all must be cleared to go on to the next region */
  stages: StageDef[];
  /** Spirits that roam the field, and their spawn weights */
  explore: WildEntry[];
  /** Dialogue the first time the region is entered */
  intro: Line[];
  npcs: NpcDef[];
  mapPos: [number, number];
}

const M = '米菈';
const S = '賽倫';
const K = '凱爾';

// 'RIVAL' in a team is the partner of the rival Kael; stageTeam in opening.ts swaps it for the actual spirit according to the save

const w =(speciesId: string, weight: number): WildEntry => ({ speciesId, weight });
const e = (speciesId: string, level: number, corrupted = false): EnemyDef => ({ speciesId, level, corrupted });
const c = (speciesId: string, level: number): EnemyDef => ({ speciesId, level, corrupted: true });

/** First-clear reward for a normal floor: grows with level (the source crystal trial is hand-written separately) */
function rw(kind: Exclude<StageKind, 'boss' | 'wild'>, lv: number, extra: Partial<Reward> = {}): Reward {
  const r10 = (n: number) => Math.round(n / 10) * 10;
  const base: Record<typeof kind, Reward> = {
    corrupt: { gold: r10(20 * lv + 150), crystals: r10(60 + lv), breakStones: 2 + Math.floor(lv / 20), advStones: 1 },
    trainer: { gold: r10(20 * lv + 200), crystals: r10(80 + lv), potions: lv >= 25 ? 2 : 1 },
    cult: { gold: r10(20 * lv + 250), crystals: r10(100 + lv), breakStones: 2 + Math.floor(lv / 15), shards: lv >= 17 ? 1 + Math.floor(lv / 35) : 0 },
    rival: { gold: r10(20 * lv + 300), crystals: r10(180 + 2 * lv), tickets: lv >= 50 ? 3 : lv >= 30 ? 2 : 1 },
  };
  return { ...base[kind], ...extra };
}

const CORRUPT = '蝕化精靈';

export const REGIONS: RegionDef[] = [
  {
    id: 'forest',
    name: '翠語森林',
    element: 'nature',
    desc: '長滿巨木和發光菌圈的森林，森民就住在樹上。最近森林安靜得不太對勁。',
    level: 5,
    town: '樹語村',
    tower: '翠語伏魔塔',
    mapPos: [7.4, -5.8],
    explore: [w('acornsquirrel', 30), w('dreamcap', 30), w('cloudfluff', 26), w('leaffrog', 24), w('dandelion', 14), w('skyreign', 12), w('elderwood_warden', 6), w('owlarchivist', 4), w('banyanelder', 1)],
    intro: [
      { who: M, text: '欸，你有沒有覺得這裡安靜得有點奇怪？' },
      { who: M, text: '森林裡應該到處都是鳥叫跟蟲叫，森民也常在樹上吵架，可是現在什麼聲音都沒有，只剩下風聲。' },
      { who: M, text: '北邊那座發著綠光的塔，你看到了嗎？公會長說第一塊源晶就在那上面。' },
      { who: M, text: '村子就在前面，我們先去問問看到底發生了什麼事。' },
      { who: M, text: '對了，我們出發前，諾娃跑來問我：「樹在講話，你們為什麼聽不到？」' },
      { who: M, text: '我只好跟她說，大概是樹講話太小聲了吧。可是現在森林安靜成這樣，我反而有點在意她那句話。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '這附近的精靈好像都沒什麼精神，眼神呆呆的，跟沒睡醒一樣。' },
          { who: M, text: '不過這樣也好，我們可以先在附近多打幾場，把隊伍練強一點再去爬塔。' },
          { who: M, text: '還有，看到身上長紫黑色結晶的精靈要離遠一點。啊，不過記得叫我過去看，我想把牠畫進筆記裡。' },
        ],
      },
      {
        name: '森民長老', look: 'elder',
        lines: [
          { who: '森民長老', text: '你就是從星門那邊來的締約者吧？來得正好，村子現在很需要人幫忙。' },
          { who: '森民長老', text: '村裡有一半的人在菌圈旁邊睡著以後，就再也叫不醒了，到今天已經三天。' },
          { who: '森民長老', text: '北邊那座塔的封印這幾年越來越鬆，塔門口還冒出紫色的結晶，我想兩件事脫不了關係。' },
          { who: '森民長老', text: '塔頂有一位守林人叫希雅，她會先試試你的本事。過得了她那一關，她才會把源晶交給你。' },
        ],
      },
      {
        name: '採菇的小孩', look: 'kid',
        lines: [
          { who: '採菇的小孩', text: '我阿嬤在菌圈那邊睡著了，已經睡三天了，怎麼叫都叫不醒。' },
          { who: '採菇的小孩', text: '大人說是幻夢菌后害的，所以我每天都去把牠們趕走，可是阿嬤還是沒有醒來。' },
          { who: '採菇的小孩', text: '你也要去爬塔對不對？我哥哥也去了。大人說只要把塔修好，大家就會醒過來。' },
        ],
      },
    ],
    stages: [
      {
        id: 'f1', name: '苔階前庭', kind: 'corrupt', level: 6, team: [c('dreamcap', 6)], enemyName: CORRUPT, aiSkill: 0.3, reward: rw('corrupt', 6, { stones: 3 }),
        before: [
          { who: M, text: '你看，塔門上的封印裂開了一道縫，難怪虛蝕會漏到外面去。' },
          { who: M, text: '等一下，門口那隻幻夢菌后身上長了結晶，還在發光。小心，牠衝過來了！' },
        ],
        after: [
          { who: M, text: '結晶碎掉了！牠在打呵欠耶，看起來只是很睏，已經沒事了。' },
          { who: M, text: '好，第一層的封印亮起來了。上面還有好幾層，我們一層一層來。' },
        ],
      },
      {
        id: 'f3', name: '見習締約者', kind: 'trainer', level: 7, team: [e('cloudfluff', 7), e('dreamcap', 8)], enemyName: '見習締約者 小葉', aiSkill: 0.45, reward: rw('trainer', 7),
        before: [
          { who: '小葉', text: '欸，你也是公會的締約者嗎？我叫小葉，上禮拜才剛登記。' },
          { who: '小葉', text: '我阿嬤在菌圈旁邊睡著，一直叫不醒。我妹每天跑去趕那些菇，我就想說來爬塔，總要有人做點什麼。' },
          { who: '小葉', text: '可是我在這一層卡了三天，一直上不去。不然我們來打一場，誰贏誰先上去，怎麼樣？' },
        ],
        after: [
          { who: '小葉', text: '唉，輸了。你比我強多了，你先上去吧，我再多練一下。' },
          { who: '小葉', text: '阿嬤還沒醒，我不想就這樣回家。上面就拜託你了。' },
        ],
      },
      {
        id: 'f2', name: '菌光迴廊', kind: 'corrupt', level: 8, team: [c('dreamcap', 7), c('leaffrog', 8)], enemyName: CORRUPT, aiSkill: 0.45, reward: rw('corrupt', 8),
        before: [
          { who: M, text: '這一層的牆上長滿了菇，每一朵都在發光，而且長得比外面的大好多。' },
          { who: M, text: '你看地上，到處都是紫色的粉。這不是菇自己長出來的，比較像有人拿來餵牠們的。' },
        ],
        after: [{ who: M, text: '我剛剛看了一下，這些粉是從上面的樓層撒下來的。有人故意要讓森林裡的人跟精靈都睡著。' }],
      },
      {
        id: 'f6', name: '森民守衛', kind: 'trainer', level: 8, team: [e('acornsquirrel', 8), e('elderwood_warden', 9)], enemyName: '森民守衛 杉', aiSkill: 0.55, reward: rw('trainer', 8, { stones: 3 }),
        before: [
          { who: '杉', text: '站住。再往上走就危險了，不是誰都能上去的。' },
          { who: '杉', text: '本事不夠的人上去，只會被上面的菇迷昏，多一個叫不醒的人。我在這裡守了四十年，想過去就先打贏我。' },
        ],
        after: [
          { who: '杉', text: '守了四十年，這還是我第一次輸。' },
          { who: '杉', text: '你過關了，上去吧。守林人希雅就在塔頂，她已經等你很久了。' },
        ],
      },
      {
        id: 'f4', name: '教團斥候', kind: 'cult', level: 9, team: [c('dreamcap', 9), c('skyreign', 9)], enemyName: '虛冕教團 斥候', aiSkill: 0.55, reward: rw('cult', 9),
        before: [
          { who: '教團斥候', text: '嘖，公會的狗來得還真快。' },
          { who: '教團斥候', text: '只要再撒兩袋粉，等森林裡的人跟精靈全都睡得叫不醒，就沒有誰擋得住我們開塔了。' },
          { who: M, text: '那些紫色的粉是你撒的？你拿虛蝕去餵那些菇，害村子裡的人一直醒不過來？' },
          { who: '教團斥候', text: '封印把塔底下的力量關了一千年，小鬼。無冕者大人要打開這座塔，讓大家都得到自由。' },
        ],
        after: [
          { who: '教團斥候', text: '可惡，無冕者大人不會放過你的，你給我記住！' },
          { who: M, text: '無冕者？這個名字我還是第一次聽到，先記下來再說。' },
          { who: M, text: '他應該是虛冕教團的人。公會長提過，那是一群崇拜虛蝕的傢伙，我本來還以為只是傳聞。' },
        ],
      },
      {
        id: 'f5', name: '源晶試煉・守林人', kind: 'boss', level: 10, art: 'oath_guard',
        // Dreamveil Matron Lv 8: Lv 9 just barely survives the Oathflame channeling in Eldarin's opening, then its spores hold Eldarin down for five turns, dropping the starter partner's win rate to 30% (about 50% at Lv 8)
        team: [e('dreamcap', 8), e('elderwood_warden', 10), e('sylvaron', 11)],
        enemyName: '守林人 希雅', aiSkill: 0.75, reward: { gold: 800, crystals: 600, tickets: 3, breakStones: 5 },
        before: [
          { who: '希雅', text: '你就是星門那邊來的締約者？一路衝上來，走得真急。' },
          { who: '希雅', text: '換作平常，我會叫你放慢腳步，好好認識這片森林。可是現在村子裡一半的人都睡著醒不來，沒有時間慢慢來了。' },
          { who: '希雅', text: '這座塔底下有一道很深的裂縫，源晶就是讓塔的封印撐住的東西，我不能隨便交給別人。' },
          { who: '希雅', text: '讓我看看，你跟你的精靈守不守得住它。' },
        ],
        after: [
          { who: '希雅', text: '好，夠了。你跟你的精靈打得很穩，我可以放心把源晶交給你。' },
          { who: '希雅', text: '這是木之源晶，你拿去吧。後面的路還很長，不用急，一步一步走。' },
          { who: M, text: '你看樹頂上！剛才那頭鹿跑到上面去了。牠頭上的角長滿了枝葉，大得跟兩棵樹一樣。' },
          { who: '希雅', text: '牠叫希爾凡，一直守著這片森林。村子的人睡著的這幾天，牠也一直沒有出聲。' },
          { who: M, text: '你聽，鳥叫聲回來了！森林裡的精靈都醒過來了！' },
          { who: M, text: '拿到第一塊源晶了！小葉和他妹妹應該也叫得醒阿嬤了。下一站是潮歌群島，我們走吧！' },
        ],
      },
    ],
  },
  {
    id: 'isles',
    name: '潮歌群島',
    element: 'water',
    desc: '有珊瑚礁和燈塔的群島，北岸終年結冰。最近聖鯨不唱歌了，潮水也跟著亂掉。',
    level: 11,
    town: '燈塔港',
    tower: '潮歌伏魔塔',
    mapPos: [11.3, -0.1],
    explore: [w('bubblecrab', 30), w('icecrown', 28), w('lanternfish', 22), w('cloudfluff', 14), w('skyreign', 12), w('oathsea_sage', 6), w('swordfish', 6), w('springlotus', 5), w('steameel', 3), w('siren', 1)],
    intro: [
      { who: M, text: '奇怪，港口的船怎麼全都綁在岸邊，一艘都沒有出海？' },
      { who: M, text: '我剛剛問過港口的老船長。這裡的人說，聖鯨每天都會在海裡唱歌，潮水就是跟著牠的歌聲漲退的。' },
      { who: M, text: '可是聖鯨最近不唱了，潮水也跟著亂掉，漁船根本不敢出海。' },
      { who: M, text: '伏魔塔在最北邊的那座島上，就是被冰封住一半的那座，看到了嗎？' },
      { who: M, text: '對了，我們出發前，諾娃在公會裡哼了一首歌。很好聽，可是大家都說沒人教過她。' },
      { who: M, text: '我剛剛哼給船長聽，結果他臉都白了，說那是聖鯨的歌。我哼得有那麼像嗎？' },
      { who: M, text: '好了，我們走吧。沿著木棧道過去，淺灘可以直接走，水深的地方千萬別踩下去。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '冰原那邊的精靈比較兇，也比較強。如果覺得隊伍還不夠強，就先在海灘這邊多練幾場。' },
          { who: M, text: '船長剛剛又來問我諾娃的事，還說二十年前有個公會的人來過這裡，走的時候一隻手臂垂著抬不起來。' },
          { who: M, text: '一隻手臂抬不起來……公會長的左手也是這樣，可是他從來不肯說是怎麼受傷的。' },
        ],
      },
      {
        name: '港口老船長', look: 'elder',
        lines: [
          { who: '港口老船長', text: '潮水全亂了啦！該退的時候漲，該漲的時候退，船都不敢出海啊。' },
          { who: '港口老船長', text: '前幾天，教團那艘黑帆船開進了塔下面的冰灣。從那天起，聖鯨就再也沒唱過歌了。' },
          { who: '港口老船長', text: '小姑娘，你剛剛哼的是聖鯨的歌，而且是最後那一段。那一段牠已經五十年沒唱過了，教你的那個孩子是在哪裡聽到的啊？' },
          { who: '港口老船長', text: '你們去把聖鯨叫醒吧。牠只要一開口唱，整片海面都會跟著震動，到時候你就知道了。' },
        ],
      },
      {
        name: '燈塔守衛', look: 'guard',
        lines: [
          { who: '燈塔守衛', text: '塔裡每一層都有人守著，沒有捷徑可以走。我們燈塔的瑪琳大人就在最上面。' },
          { who: '燈塔守衛', text: '瑪琳大人嗓門很大，要是被她吼了也別放在心上，她對誰都是那樣。' },
        ],
      },
    ],
    stages: [
      {
        id: 'i1', name: '潮濕石廊', kind: 'corrupt', level: 12, team: [c('bubblecrab', 12), c('lanternfish', 12)], enemyName: CORRUPT, aiSkill: 0.4, reward: rw('corrupt', 12, { stones: 3 }),
        before: [
          { who: M, text: '牆上到處都是海水留下的痕跡，這座塔大概有一半泡在海裡。' },
          { who: M, text: '你聽，那個喀喀喀的聲音……是螃蟹的鉗子！牠們朝這邊過來了！' },
        ],
      },
      {
        id: 'i3', name: '漁夫阿勇', kind: 'trainer', level: 12, team: [e('icecrown', 12), e('bubblecrab', 13)], enemyName: '漁夫 阿勇', aiSkill: 0.5, reward: rw('trainer', 12),
        before: [
          { who: '阿勇', text: '喂，你是從內陸來的旱鴨子吧？看你走在棧道上那麼小心就知道了。' },
          { who: '阿勇', text: '船出不了海，我只好跑來爬塔。要是輸給旱鴨子，我在港口就混不下去了。' },
        ],
        after: [
          { who: '阿勇', text: '啊，輸了啦！你這隻旱鴨子還真有兩下子。' },
          { who: '阿勇', text: '那你快去把聖鯨叫醒吧，我家的漁網已經三天沒下海了。' },
        ],
      },
      {
        id: 'i2', name: '冰封迴廊', kind: 'corrupt', level: 13, team: [c('icecrown', 13), c('abyssjelly', 13)], enemyName: CORRUPT, aiSkill: 0.5, reward: rw('corrupt', 13),
        before: [{ who: M, text: '這一層整個都結冰了，牆上的冰還在發紫光，一定是虛蝕漏進來了。' }],
        after: [{ who: M, text: '你聽，冰牆裡傳來很小聲的歌，旋律跟諾娃哼的那首好像。聲音是從上面的樓層傳下來的。' }],
      },
      {
        id: 'i6', name: '燈塔見習生', kind: 'trainer', level: 14, team: [e('lanternfish', 14), e('springlotus', 14), e('oathsea_sage', 14)], enemyName: '燈塔見習生 汐', aiSkill: 0.58, reward: rw('trainer', 14),
        before: [
          { who: '汐', text: '瑪琳大人說過，只有能走到這一層的人，才有資格去見她。' },
          { who: '汐', text: '所以我不會放水。也請你拿出全力來，好嗎？' },
        ],
        after: [
          { who: '汐', text: '我輸了，輸得心服口服。' },
          { who: '汐', text: '對了，塔外面的冰灣停著教團的黑帆船，他們的人已經爬到上一層了。你要小心。' },
        ],
      },
      {
        id: 'i4', name: '教團船隊', kind: 'cult', level: 15, team: [c('icecrown', 14), c('pyrewing', 14), c('swordfish', 15)], enemyName: '虛冕教團 船長', aiSkill: 0.62, reward: rw('cult', 15),
        before: [
          { who: '教團船長', text: '公會的小鬼？來得正好，省得我下去找你們。' },
          { who: '教團船長', text: '聖鯨已經在冰灣裡睡著了。牠一睡，這座塔就少了最難對付的守衛。' },
          { who: '教團船長', text: '這是無冕者大人交代的：先讓聖鯨的歌停下來，再把塔打開。' },
          { who: M, text: '聖鯨會睡著，是你們害的？你們到底做了什麼？' },
          { who: '教團船長', text: '哼，想知道的話，自己去問海妖吧。' },
        ],
        after: [
          { who: '教團船長', text: '可惡……我們的黑帆船還會再來的，你給我記住。' },
          { who: M, text: '海妖？港口的老船長跟我提過，那是一種很會唱歌的精靈，聽到牠唱歌的人都會一直想睡。' },
        ],
      },
      {
        id: 'i7', name: '海妖之歌', kind: 'corrupt', level: 15, team: [c('siren', 15)], enemyName: '蝕化海妖', aiSkill: 0.64, reward: rw('corrupt', 15, { shards: 1 }),
        before: [
          { who: M, text: '這個歌聲……聽了好想睡覺。' },
          { who: M, text: '不行，要撐住！就是那隻海妖，牠唱的歌會讓聽到的人一直想睡。' },
          { who: M, text: '教團一定是讓牠每天對著冰灣唱，聖鯨才會一路睡到現在。' },
          { who: M, text: '你看牠懷裡的豎琴，上面長滿了結晶，牠自己也蝕化了。快把牠打醒！' },
        ],
        after: [
          { who: M, text: '結晶碎了，牠也不唱了。咦，牠是在哭嗎？' },
          { who: M, text: '等一下，你聽外面！是聖鯨在唱歌，整座塔都跟著晃起來了！' },
        ],
      },
      {
        id: 'i5', name: '源晶試煉・燈塔守護者', kind: 'boss', level: 16, art: 'light_purify',
        team: [e('icecrown', 15), e('oathsea_sage', 16), e('thalassene', 17)],
        enemyName: '燈塔守護者 瑪琳', aiSkill: 0.78, reward: { gold: 1000, crystals: 600, tickets: 3, breakStones: 6 },
        before: [
          { who: '瑪琳', text: '喂！你就是把海妖打醒的那個小鬼吧？過來讓我看看。' },
          { who: '瑪琳', text: '嗯，人長得普普通通，你的精靈倒是一點都不普通。' },
          { who: '瑪琳', text: '還有，謝謝你把瑟蓮娜叫醒。那頭聖鯨的歌我從小聽到大，這句謝謝一定要先講。' },
          { who: '瑪琳', text: '不過試煉還是照規矩來。源晶不是隨便就能交出去的東西，我要看看你有沒有那個本事。準備好了沒？' },
        ],
        after: [
          { who: '瑪琳', text: '哈！打得好！好久沒打得這麼痛快了。' },
          { who: '瑪琳', text: '這是水之源晶，拿去吧。可別弄丟了，不然瑟蓮娜會生氣喔。' },
          { who: '瑪琳', text: '你聽到了嗎？牠在用尾巴拍海面。那是牠在跟你說謝謝。' },
          { who: M, text: '聽到了！拍得這麼大聲，整座島應該都聽到了吧。' },
          { who: M, text: '回去一定要告訴諾娃。她那天哼的，就是聖鯨剛剛唱的最後一段。' },
        ],
      },
    ],
  },
  {
    id: 'volcano',
    name: '焰脊火山帶',
    element: 'fire',
    desc: '熔岩河流過的火山帶，鍛造之都「赤鐵堡」就在這裡，城裡正在辦比武大會。',
    level: 17,
    town: '赤鐵堡',
    tower: '焰脊伏魔塔',
    mapPos: [10.0, 6.2],
    explore: [w('pyrewing', 30), w('bellowsbeast', 28), w('shieldbeetle', 24), w('monolith', 18), w('digmole', 10), w('pyre_dragoon', 6), w('steameel', 5), w('magma_golem', 2), w('phoenix', 1)],
    intro: [
      { who: M, text: '好熱喔！那座塔直接蓋在火山口旁邊，你看，連路邊的石頭都在冒煙。' },
      { who: M, text: '前面那座城就是赤鐵堡，出了名的鍛造之都，銀誓騎士團在這裡也有分團。' },
      { who: M, text: '今天城裡剛好在辦比武大會，難怪街上到處都是騎士。' },
      { who: K, text: '你就是跟初契之龍締約的那個人吧？總算讓我等到了。' },
      { who: M, text: '咦？你是誰啊？' },
      { who: K, text: '我是銀誓騎士團的見習騎士，凱爾。' },
      { who: K, text: '見習騎士想受封，就得在比武大會上打贏一位公會的締約者。我選了你。' },
      { who: K, text: '別誤會，我選你不是因為看得起你，是因為看得起你身邊那條龍。' },
      { who: K, text: '比武在塔裡舉行，我在上面等你。別讓我等太久。' },
      { who: M, text: '什麼啊，話講完就走了。騎士團的人講話都這麼不客氣嗎？' },
      { who: M, text: '算了，我們也往塔那邊走吧。記得沿著石橋走，千萬別掉進底下的熔岩河。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '你有看到凱爾帶的那隻熾焰龍騎嗎？臉跟他一樣臭，搭檔真的會越來越像主人耶。' },
          { who: M, text: '他說他看得起的是那條龍。欸，艾爾達林，人家在稱讚你耶。……好吧，牠完全不理我。' },
          { who: M, text: '說真的，騎士團很在意締約者配不配得上自己的精靈。他大概覺得你是運氣好，才撿到那條龍。' },
        ],
      },
      {
        name: '赤鐵堡鐵匠', look: 'villager',
        lines: [
          { who: '赤鐵堡鐵匠', text: '這幾天塔裡一直傳出打鐵的聲音。那不是我們城裡的人在打，聽節奏就知道。' },
          { who: '赤鐵堡鐵匠', text: '他們敲得太急了。鐵要燒透了再慢慢敲，敲得太急，裡面就會留下裂縫。' },
          { who: '赤鐵堡鐵匠', text: '我不知道他們在打什麼，不過你要是上去，最好在那東西出爐之前阻止他們。' },
        ],
      },
      {
        name: '騎士團見習生', look: 'knight',
        lines: [
          { who: '騎士團見習生', text: '凱爾學長說，沒打贏他之前，誰都別想上塔頂。他真的很強喔，你要小心。' },
          { who: '騎士團見習生', text: '昨天學長一個人在爐子邊坐到半夜。受封只有一次機會，他其實很在意這一場。' },
        ],
      },
    ],
    stages: [
      {
        id: 'v1', name: '熔岩階梯', kind: 'corrupt', level: 18, team: [c('pyrewing', 18), c('bellowsbeast', 18)], enemyName: CORRUPT, aiSkill: 0.45, reward: rw('corrupt', 18, { stones: 3 }),
        before: [{ who: M, text: '這些階梯好燙，隔著鞋底都感覺得到。啊，那邊有東西衝過來了！' }],
      },
      {
        id: 'v6', name: '赤鐵堡衛兵', kind: 'trainer', level: 18, team: [e('shieldbeetle', 18), e('bellowsbeast', 19)], enemyName: '赤鐵堡衛兵 洛克', aiSkill: 0.55, reward: rw('trainer', 18),
        before: [
          { who: '洛克', text: '我是赤鐵堡的衛兵洛克。我們衛兵輪流在塔裡站崗，今天剛好輪到我。' },
          { who: '洛克', text: '要上去就得先過我這關。你可別手下留情，不然被分團長蕾格娜大人知道，挨罵的是我。' },
        ],
        after: [{ who: '洛克', text: '好身手！你上去吧，我繼續在這裡守著。' }],
      },
      {
        id: 'v2', name: '熔爐深處', kind: 'corrupt', level: 19, team: [c('monolith', 19), c('magma_golem', 19)], enemyName: CORRUPT, aiSkill: 0.55, reward: rw('corrupt', 19),
        before: [{ who: M, text: '這一層熱得跟爐子裡面一樣。咦，牆邊那些石頭怎麼在動？那不是石頭，是精靈！' }],
        after: [{ who: M, text: '你聽，打鐵的聲音越來越近了，應該就在上面幾層。' }],
      },
      {
        id: 'v3', name: '比武・勁敵', kind: 'rival', level: 19, team: [{ speciesId: 'RIVAL', level: 20 }, e('skyreign', 19), e('relic_blade', 19)], enemyName: '勁敵 凱爾', art: 'oath_break', aiSkill: 0.7, reward: rw('rival', 19),
        before: [
          { who: K, text: '你總算來了，比我想的還慢。' },
          { who: K, text: '規則很簡單，三對三，誰的精靈先全部倒下就算輸。' },
          { who: K, text: '我不會因為你是新人就放水。你也別以為有那條龍在，就贏定了。' },
          { who: K, text: '那條龍的搭檔是一千年前的第一位締約者，不是你。你只是剛好在牠醒來的時候站在那裡。' },
          { who: K, text: '不服氣的話，就打贏我來證明。' },
        ],
        after: [
          { who: K, text: '……我輸了。' },
          { who: K, text: '這次算你贏。可是你記住，下次我不會再輸給你。' },
          { who: K, text: '不過你最後那一下，打得還算可以。就只是還可以而已，別太得意。' },
          { who: M, text: '欸，他剛剛是不是在稱讚你？我有聽到喔！' },
        ],
      },
      {
        id: 'v7', name: '火山學者', kind: 'trainer', level: 20, team: [e('steameel', 20), e('pyre_dragoon', 20), e('shieldbeetle', 20)], enemyName: '火山學者 艾絲', aiSkill: 0.62, reward: rw('trainer', 20),
        before: [
          { who: '艾絲', text: '我是研究火山的艾絲。這座塔的溫度一直在升高，每往上一層就熱兩度。' },
          { who: '艾絲', text: '我想順便記錄締約者戰鬥時的數據，所以會邊打邊寫，你不要介意喔。' },
        ],
        after: [
          { who: '艾絲', text: '謝謝，這次的數據很漂亮。' },
          { who: '艾絲', text: '還有，熱源在更上面，可是那股熱跟火山不一樣，比較像有人在燒什麼東西。你上去要小心。' },
        ],
      },
      {
        id: 'v4', name: '教團鍛爐', kind: 'cult', level: 21, team: [c('pyrewing', 20), c('magma_golem', 21), c('monolith', 21)], enemyName: '虛冕教團 鍛工', aiSkill: 0.65, reward: rw('cult', 21),
        before: [
          { who: '教團鍛工', text: '你來晚了，小鬼，劍已經打好了。' },
          { who: '教團鍛工', text: '這把劍是用自由之火鍛出來的，連源晶都砍得斷。無冕者大人要用它打開每一座塔。' },
          { who: M, text: '那團紫色的火明明就是蝕化的火！所以鐵匠聽到的打鐵聲，就是你們在打這把劍？' },
          { who: '教團鍛工', text: '沒錯！有了這把劍，每一座塔的封印都能一刀斬開！' },
        ],
        after: [
          { who: '教團鍛工', text: '不、不可能……劍怎麼會自己裂開？' },
          { who: M, text: '鐵匠說得沒錯，鐵敲得太急，裡面就會留下裂縫。那把劍根本砍不了源晶。' },
        ],
      },
      {
        id: 'v8', name: '焰翅女王', kind: 'corrupt', level: 21, team: [c('pyrewing', 21), c('phoenix', 21)], enemyName: CORRUPT, aiSkill: 0.66, reward: rw('corrupt', 21, { shards: 1 }),
        before: [
          { who: M, text: '上面有鳥叫聲。那是燼羽不死鳥嗎？連牠都蝕化了！' },
          { who: M, text: '不死鳥被打倒以後會從灰裡重生。說不定重生一次，牠身上的蝕化也會跟著燒乾淨！' },
        ],
        after: [
          { who: M, text: '牠從灰裡重生了！而且身上乾乾淨淨的，一點結晶都沒有。' },
          { who: M, text: '書上說不死鳥會記得每一次重生前發生的事，所以牠應該會記得是你救了牠。' },
        ],
      },
      {
        id: 'v5', name: '源晶試煉・鍛冶騎士', kind: 'boss', level: 22, art: 'oath_break',
        team: [e('pyre_dragoon', 21), e('magma_golem', 22), e('ignisar', 23)],
        enemyName: '鍛冶騎士 蕾格娜', aiSkill: 0.8, reward: { gold: 1200, crystals: 650, tickets: 3, breakStones: 6, shards: 2 },
        before: [
          { who: '蕾格娜', text: '我是赤鐵堡的分團長蕾格娜。你把手伸出來，跟我握個手。' },
          { who: '蕾格娜', text: '嗯，握得還不夠緊。' },
          { who: '蕾格娜', text: '教團那把劍，就是在我管的塔裡打出來的，我卻一直沒有發現。這是我的恥辱。' },
          { who: '蕾格娜', text: '所以這場試煉我不會手下留情。你撐得過我們的火，我的搭檔伊格尼薩就會認你。' },
        ],
        after: [
          { who: '蕾格娜', text: '好，你過關了。' },
          { who: '蕾格娜', text: '伊格尼薩認你了，牠很少這樣。' },
          { who: '蕾格娜', text: '這是火之源晶，拿去。這次要握緊。' },
          { who: M, text: '哇，那隻獅子的鬃毛整片都是火，把整座塔都照亮了！' },
          { who: '蕾格娜', text: '還有一件事，是關於凱爾那小子。' },
          { who: '蕾格娜', text: '他今天早上來找我，說想再挑戰一次受封。他還說，他是輸給了一個配得上自己精靈的人。' },
          { who: '蕾格娜', text: '他叫我不要告訴你，不過我可沒答應他。' },
        ],
      },
    ],
  },
  {
    id: 'highland',
    name: '蒼嘯高原',
    element: 'wind',
    desc: '斷崖與浮空石的高原，住著以送信聞名的翼民。最近有一整批信不見了。',
    level: 23,
    town: '風信驛站',
    tower: '蒼嘯伏魔塔',
    mapPos: [3.9, 10.4],
    explore: [w('skyreign', 28), w('dandelion', 26), w('papercrane', 24), w('cloudfluff', 14), w('candledove', 12), w('stormram', 8), w('lyrebird', 6), w('gale_weasel', 2), w('griffin', 1)],
    intro: [
      { who: M, text: '哇，這裡的風也太大了吧！我要用喊的你才聽得到！' },
      { who: M, text: '剛剛在驛站，有個背上長翅膀的翼民跟我說，他們有一整批信不見了。' },
      { who: M, text: '翼民很會送信，自己飛不到的地方，就交給會飛的精靈乘著風送過去，聽說從來沒寄丟過。' },
      { who: M, text: '結果這次整批都不見了，裡面還有一封是曦光教廷寄給公會長的。' },
      { who: M, text: '教廷是信奉光的教會，平常跟公會很少往來，怎麼會突然寫信給公會長？' },
      { who: M, text: '塔在斷崖的另一頭。走斷崖邊的時候別靠太近，這裡的風大到會把人推下去。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '那些浮在半空中的石頭底下，常常有稀有的精靈飛過，走路的時候記得抬頭看看。' },
          { who: M, text: '教廷寄給公會長的那封信，我一直很在意。可是就算信找回來，我猜他也只會說一句「以後再說」。' },
        ],
      },
      {
        name: '翼民信使', look: 'villager',
        lines: [
          { who: '翼民信使', text: '這陣子風向整個亂掉，我們寄的信也跟著不見了一整批。' },
          { who: '翼民信使', text: '比較重要的信，我們會交給颶風之眼送。牠是一隻一直待在暴風正中央的精靈。' },
          { who: '翼民信使', text: '牠身邊的風很強，我們不敢靠太近，只要把信放進風裡，牠就會捲過去收好，從來沒弄丟過一封。' },
          { who: '翼民信使', text: '結果這次牠一拿到信，就直接往伏魔塔飛過去。牠以前從來不靠近那座塔的。' },
          { who: '翼民信使', text: '那批信裡有一封是艾茲大人在等的，裡面寫著塔第五層的暗號。' },
          { who: '翼民信使', text: '艾茲大人是高原上飛得最快的風信使，現在人就在塔頂。拜託你幫我們把信找回來。' },
        ],
      },
      {
        name: '牧羊少年', look: 'kid',
        lines: [
          { who: '牧羊少年', text: '我的霆角公羊跑到斷崖那邊去了！牠們一緊張就會放電，你過去的時候要小心喔。' },
          { who: '牧羊少年', text: '還有喔，我在斷崖上看到一個穿黑袍的人對著天空講話，然後風就突然轉向，往他那邊吹過去了，好奇怪。' },
        ],
      },
    ],
    stages: [
      {
        id: 'h1', name: '雲海迴廊', kind: 'corrupt', level: 24, team: [c('skyreign', 24), c('dandelion', 24)], enemyName: CORRUPT, aiSkill: 0.5, reward: rw('corrupt', 24, { stones: 4 }),
        before: [{ who: M, text: '這一層整個被雲包住了，連腳下都看不清楚。等一下，有翅膀拍動的聲音，有東西飛過來了！' }],
      },
      {
        id: 'h3', name: '翼民信使', kind: 'trainer', level: 24, team: [e('skyreign', 24), e('papercrane', 25)], enemyName: '翼民 綾羽', aiSkill: 0.62, reward: rw('trainer', 24),
        before: [
          { who: '綾羽', text: '我是在驛站幫忙送信的綾羽。你想上塔的話，先跟我比一場，看你跟不跟得上我的速度。' },
          { who: '綾羽', text: '跟不上也別太難過啦，大部分的人都跟不上。' },
        ],
        after: [{ who: '綾羽', text: '咦，居然被你跟上了？你的精靈動作好快，是怎麼練的啊？' }],
      },
      {
        id: 'h2', name: '浮石之間', kind: 'corrupt', level: 25, team: [c('stormram', 25), c('cloudfluff', 25), c('skyreign', 25)], enemyName: CORRUPT, aiSkill: 0.6, reward: rw('corrupt', 25),
        before: [{ who: M, text: '這一層的石頭都浮在半空中，踩上去會晃，你小心一點。啊，石頭後面躲著蝕化的精靈！' }],
        after: [{ who: M, text: '你看這些石頭上的抓痕，每一道都好深。留下這些爪印的精靈，體型一定很大。' }],
      },
      {
        id: 'h6', name: '吟遊詩人', kind: 'trainer', level: 26, team: [e('lyrebird', 26), e('candledove', 26), e('papercrane', 26)], enemyName: '吟遊詩人 萊爾', aiSkill: 0.66, reward: rw('trainer', 26),
        before: [
          { who: '萊爾', text: '你好，我是吟遊詩人萊爾，正在寫一首關於這座塔的歌。第一段寫高原的風，第二段還沒想好。' },
          { who: '萊爾', text: '不如就寫你吧。我們打一場，讓我看看你是怎麼戰鬥的，我好找點靈感。' },
        ],
        after: [
          { who: '萊爾', text: '太好了，第二段有著落了！那第三段要寫誰呢？' },
          { who: '萊爾', text: '上面那個穿黑袍的傢伙？算了吧，他一直在塔裡搞鬼，我才不要把他寫進歌裡。' },
        ],
      },
      {
        id: 'h4', name: '教團據點', kind: 'cult', level: 26, team: [c('skyreign', 26), c('eclipse_batlord', 26), c('gale_weasel', 26)], enemyName: '虛冕教團 司祭', aiSkill: 0.68, reward: rw('cult', 26),
        before: [
          { who: '教團司祭', text: '你是怎麼上來的？這一層的門要對暗號才會開，你居然硬闖進來了？' },
          { who: '教團司祭', text: '你是來找信的吧？可惜，信全在我手上。' },
          { who: '教團司祭', text: '教廷寫給你們公會長的那封，我已經拆開看過了，內容很有意思喔。' },
          { who: '教團司祭', text: '還有一封信提到你們那個銀誓騎士團的小騎士。無冕者大人可是很看好他呢。' },
          { who: M, text: '你是說凱爾？你們找他想做什麼？' },
          { who: '教團司祭', text: '想知道啊？那你就留在這座塔裡，慢慢猜一輩子吧。' },
        ],
        after: [
          { who: '教團司祭', text: '風怎麼突然變這麼大……等等，我的信！信全被吹走了！' },
          { who: M, text: '信被風吹得到處都是，我只搶到一張，上面只寫了一句話：「二十年了，賽倫。她還記得你。」' },
          { who: M, text: '賽倫就是公會長。而且二十年前，不就是船長說有個公會的人垂著一隻手臂離開的那年嗎？' },
          { who: M, text: '信裡說的「她」到底是誰？公會長從來沒提過。' },
        ],
      },
      {
        id: 'h7', name: '嵐之試煉', kind: 'trainer', level: 27, team: [e('gale_weasel', 27), e('griffin', 27)], enemyName: '翼民隊長 蒼', aiSkill: 0.72, reward: rw('trainer', 27),
        before: [
          { who: '蒼', text: '我是翼民隊長蒼。艾茲大人就在上面，最後這一關由我負責守。' },
          { who: '蒼', text: '我跟我的獅鷲都會全力擋下你，你也拿出真本事來吧。' },
        ],
        after: [{ who: '蒼', text: '連我這一關都被你過了，我也沒臉再攔你。上去吧。' }],
      },
      {
        id: 'h8', name: '颶風之眼', kind: 'corrupt', level: 27, team: [c('tornado', 27)], enemyName: '蝕化颶風', aiSkill: 0.72, reward: rw('corrupt', 27, { shards: 1 }),
        before: [
          { who: M, text: '暴風的正中間有一隻精靈，一動也不動地浮在那裡。那就是颶風之眼吧。' },
          { who: M, text: '你看，信全都繞在牠身邊，剛才被吹走的那些也在。牠不是想偷信，只是蝕化以後把信捲在身邊不肯放。' },
          { who: M, text: '結晶就長在牠風眼的周圍。我們把牠打倒，讓牠把信放下來吧。' },
        ],
        after: [
          { who: M, text: '信全部掉下來了！我數了一下，一封都沒少。' },
          { who: M, text: '就算蝕化了，牠還是沒弄丟任何一封信。難怪翼民這麼信任牠。' },
        ],
      },
      {
        id: 'h5', name: '源晶試煉・風信使', kind: 'boss', level: 28, art: 'oath_gale',
        team: [e('skyreign', 27), e('gale_weasel', 28), e('aeroth', 29)],
        enemyName: '風信使 艾茲', aiSkill: 0.82, reward: { gold: 1400, crystals: 650, tickets: 3, breakStones: 6, shards: 2 },
        before: [
          { who: '艾茲', text: '喲，你就是公會來的締約者？我們來打個賭，我賭一根羽毛，賭你跟不上我的速度。' },
          { who: '艾茲', text: '咦，你抱著的那疊是我們的信？是你帶回來的？那我加碼，賭兩根！' },
          { who: '艾茲', text: '我的搭檔艾洛斯也想看看你有多少本事。好，開始！' },
        ],
        after: [
          { who: '艾茲', text: '我輸了。好吧，說好的兩根羽毛給你，還有這塊風之源晶。' },
          { who: '艾茲', text: '欸，你先別急著走，我話還沒說完。' },
          { who: '艾茲', text: '寄給你們公會長的那封信，我看過信封，封口蓋的是教廷的印。' },
          { who: '艾茲', text: '而且我聽到一些傳言，那封信裡寫的不是什麼好消息。你回去記得……' },
          { who: M, text: '他就這樣飛走了，話都還沒講完耶。' },
          { who: M, text: '我們先把信帶回去交給公會長吧。他要是又說「以後再說」，那我們就等他願意講的時候再問。' },
        ],
      },
    ],
  },
  {
    id: 'canyon',
    name: '磐心峽谷',
    element: 'earth',
    desc: '層層砂岩堆成的深谷，矮人把王城蓋在一隻沉睡的巨龜背上。最近地一直在震，巨龜好像快醒了。',
    level: 29,
    town: '龜背王城',
    tower: '磐心伏魔塔',
    mapPos: [-3.9, 10.4],
    explore: [w('monolith', 28), w('digmole', 28), w('gargoyle', 20), w('prismsnail', 12), w('voltadillo', 10), w('pyrewing', 10), w('rhino', 6), w('sand_reaper', 2), w('sandserpent', 2)],
    intro: [
      { who: M, text: '欸，地在震耶，你有感覺到嗎？一下一下的，還很規律。' },
      { who: M, text: '矮人說他們的王城蓋在一隻巨龜的背上，只要巨龜一直睡著，王城就不會有事。' },
      { who: M, text: '可是最近地一直在震，大家都說巨龜快醒了。' },
      { who: '艾爾達林', text: '這不是普通的地震，是地底下那隻巨龜的心跳。牠睡得越來越淺了。' },
      { who: M, text: '這是心跳？那牠的心跳也太大聲了吧！' },
      { who: '艾爾達林', text: '奇怪的是，牠的心跳好像是跟著另一個心跳的節奏在跳。' },
      { who: M, text: '另一個心跳？是誰的？' },
      { who: '艾爾達林', text: '我聽不出來，只知道那個心跳離這裡很遠。' },
      { who: M, text: '好吧，先不想了。塔在峽谷的最底下，岔路很多，要是搞不清楚方向，就打開地圖看看。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '流沙那邊有沙鐮蠍，很難得遇到，可是脾氣超兇。隊伍還不夠強的話，看到牠先躲開比較好。' },
          { who: M, text: '艾爾達林說巨龜在跟著別人的心跳，可是連牠都聽不出來是誰的，我越想越在意。' },
          { who: M, text: '說到心跳，諾娃這幾天一直說胸口悶悶的，我出門前還叫她多休息。應該只是巧合吧？' },
        ],
      },
      {
        name: '矮人礦工', look: 'guard',
        lines: [
          { who: '矮人礦工', text: '俺挖了四十年的礦，這還是第一次挖到會發光的洞，而且發的是紫光。' },
          { who: '矮人礦工', text: '後來才知道是教團在塔底下偷挖，想從下面把封印撬開。俺們的王聽到以後，氣到鬍子都豎起來了。' },
          { who: '矮人礦工', text: '塔的地基就是龜殼啊。他們撬塔就等於在撬巨龜，要是把牠撬醒了，大家都得完蛋。' },
        ],
      },
      {
        name: '王城學者', look: 'scholar',
        lines: [
          { who: '王城學者', text: '王城的記載說，這座塔當初就是為了讓巨龜安睡才蓋的。塔要是倒了，巨龜就會醒過來。' },
          { who: '王城學者', text: '巨龜只要翻個身，整座王城就會掉進峽谷裡，所以我們最怕的就是這件事。' },
          { who: '王城學者', text: '對了，這隻巨龜叫泰拉岡。老典籍上寫說，牠每次醒來，第一件事就是叫一個人的名字。' },
          { who: '王城學者', text: '可惜書上沒寫那是誰的名字，我查了好多資料，到現在還是找不到。' },
        ],
      },
    ],
    stages: [
      {
        id: 'c1', name: '砂岩走廊', kind: 'corrupt', level: 30, team: [c('digmole', 30), c('monolith', 30)], enemyName: CORRUPT, aiSkill: 0.55, reward: rw('corrupt', 30, { stones: 4 }),
        before: [
          { who: M, text: '牆壁每震一下就掉一層沙下來，這座塔真的撐得住嗎？' },
          { who: M, text: '等一下，有東西從沙裡鑽出來了，是蝕化的精靈！' },
        ],
      },
      {
        id: 'c3', name: '礦工古朗', kind: 'trainer', level: 30, team: [e('monolith', 30), e('digmole', 31), e('magma_golem', 30)], enemyName: '礦工 古朗', aiSkill: 0.66, reward: rw('trainer', 30),
        before: [
          { who: '古朗', text: '俺是礦工古朗。俺的鎬子跟俺的精靈，都比這座峽谷的石頭還要硬。' },
          { who: '古朗', text: '你想上去的話，先讓俺敲敲看，看你夠不夠硬！' },
        ],
        after: [{ who: '古朗', text: '你真的夠硬，俺認輸了。上面就拜託你啦。' }],
      },
      {
        id: 'c2', name: '流沙之間', kind: 'corrupt', level: 31, team: [c('gargoyle', 31), c('sandserpent', 31)], enemyName: CORRUPT, aiSkill: 0.62, reward: rw('corrupt', 31),
        before: [
          { who: M, text: '前面是流沙，千萬別踩進去。礦工說流沙底下住著一條巨蟒，沙子會動就是牠在底下翻身。' },
          { who: M, text: '糟糕，牠好像被我們吵醒了！' },
        ],
        after: [{ who: M, text: '地震得比剛才還厲害，我們動作要快一點。' }],
      },
      {
        id: 'c6', name: '琉璃工匠', kind: 'trainer', level: 32, team: [e('prismsnail', 32), e('voltadillo', 32), e('rhino', 32)], enemyName: '琉璃工匠 蒂娜', aiSkill: 0.68, reward: rw('trainer', 32),
        before: [
          { who: '蒂娜', text: '塔裡這些琉璃窗都是我修的，等一下打的時候弄破了要賠喔。' },
          { who: '蒂娜', text: '開玩笑的啦。地震早就震破一半了，你放心打吧。' },
        ],
        after: [{ who: '蒂娜', text: '啊，窗戶又破了一片。算了，只要你們能讓巨龜安穩睡著，我再修幾片都沒關係。' }],
      },
      {
        id: 'c4', name: '教團挖掘場', kind: 'cult', level: 32, team: [c('sand_reaper', 32), c('monolith', 32), c('magma_golem', 32)], enemyName: '虛冕教團 工頭', aiSkill: 0.7, reward: rw('cult', 32),
        before: [
          { who: '教團工頭', text: '再往下挖十尺，封印就會從底下裂開了。你現在才來，已經太遲啦！' },
          { who: '教團工頭', text: '巨龜醒了會怎樣？關我什麼事。無冕者大人只要這座塔打開就好。' },
          { who: M, text: '上面是一整座城耶！那裡住了好多人！' },
          { who: '教團工頭', text: '城又怎樣？無冕者大人說過，留不住的東西，本來就不屬於你。' },
        ],
        after: [
          { who: '教團工頭', text: '怎麼會這樣，洞塌了！我們挖了那麼久……' },
          { who: M, text: '還好洞塌了，封印總算撐住。可是你感覺到了嗎？巨龜還在動。' },
        ],
      },
      {
        id: 'c7', name: '王家衛隊', kind: 'trainer', level: 33, team: [e('rhino', 33), e('sand_reaper', 33), e('gargoyle', 33)], enemyName: '矮人衛隊長 布朗', aiSkill: 0.74, reward: rw('trainer', 33),
        before: [{ who: '布朗', text: '俺是王家衛隊長布朗。王就在上面，不過要見王，得先過俺這一關。' }],
        after: [{ who: '布朗', text: '好，你有這個本事。上去吧，別讓王等太久。' }],
      },
      {
        id: 'c8', name: '沉睡的石像', kind: 'corrupt', level: 33, team: [c('gargoyle', 33), c('monolith', 34), c('sandserpent', 34)], enemyName: CORRUPT, aiSkill: 0.74, reward: rw('corrupt', 33, { shards: 1 }),
        before: [{ who: M, text: '門口那些石像動起來了！那是守門石魔，連牠們都蝕化了。' }],
        after: [{ who: M, text: '石像不動了。再上去就是塔頂，矮人王應該就在那裡。' }],
      },
      {
        id: 'c5', name: '源晶試煉・矮人王', kind: 'boss', level: 34, art: 'oath_guard',
        team: [e('monolith', 33), e('sand_reaper', 34), e('terragon', 35)],
        enemyName: '矮人王 巴爾多', aiSkill: 0.84, reward: { gold: 1600, crystals: 700, tickets: 3, breakStones: 7, shards: 3 },
        before: [
          { who: '巴爾多', text: '小子，你知道你腳下踩的是什麼嗎？是一隻烏龜，全世界最大的那一隻！' },
          { who: '巴爾多', text: '俺們整座王城就蓋在牠背上。牠只要翻個身，王城就整個沒了。' },
          { who: '巴爾多', text: '所以源晶不能隨便交出去，萬一交錯人，第一個遭殃的就是俺的王城。' },
          { who: '巴爾多', text: '老實說，俺一點都不怕教團，俺怕的是牠醒過來。' },
          { who: '巴爾多', text: '好啦，話講完了！來吧，讓俺看看你的本事！' },
        ],
        after: [
          { who: '巴爾多', text: '哈哈哈！好小子，俺認你了！' },
          { who: '巴爾多', text: '這塊地之源晶，就交給你啦。' },
          { who: M, text: '等一下，地不震了。' },
          { who: M, text: '你們看峽谷那邊！巨龜把頭抬起來了，牠睜開一隻眼睛，一直盯著艾爾達林看。' },
          { who: '泰拉岡', text: '艾爾達……是你回來了嗎？' },
          { who: '艾爾達林', text: '她沒有回來，她已經走了很久了。現在跟我在一起的，是這位締約者。' },
          { who: '泰拉岡', text: '這樣啊。那我再睡一會兒。' },
          { who: '巴爾多', text: '俺活了一百二十年，還是第一次聽到牠開口講話！' },
          { who: M, text: '牠剛剛叫的是艾爾達。那是一千年前第一個跟精靈締約的人，也是艾爾達林以前的搭檔。' },
          { who: M, text: '牠大概是看到艾爾達林身邊站著一個締約者，就以為是她回來了。' },
          { who: M, text: '這件事我一定要寫進筆記裡。可是你看，我的手到現在還在抖。' },
        ],
      },
    ],
  },
  {
    id: 'plains',
    name: '雷鳴荒原',
    element: 'thunder',
    desc: '望不到邊的草原，雷雲一年到頭都在移動，遊牧部族就跟著雲走。這次雲卻停在塔的上空不動了。',
    level: 35,
    town: '遊牧營地',
    tower: '雷鳴伏魔塔',
    mapPos: [-10.0, 6.2],
    explore: [w('hedgehog', 28), w('ballspark', 26), w('stormram', 24), w('voltadillo', 16), w('skyreign', 12), w('dandelion', 10), w('stormhorse', 6), w('thunderbird', 2), w('tornado', 1)],
    intro: [
      { who: M, text: '你看那片雷雲，就停在塔的正上方，一動也不動。' },
      { who: M, text: '這裡的遊牧部族一千年來都跟著雷雲走，雲飄到哪裡，他們就把帳篷搬到哪裡。' },
      { who: M, text: '現在雲停下來不走，他們也只能困在這裡。' },
      { who: M, text: '還有一件事，凱爾也來了。他比我們早到一步，已經先進塔了。' },
      { who: M, text: '他還跟營地的人留話，說要在塔裡等你。' },
      { who: M, text: '草原很大，慢慢走沒關係。不過雷擊柱附近的精靈身上都帶電，不要隨便伸手去摸喔。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '聽說凱爾進塔的時候臉色很難看。牧馬人說，前一天晚上有個穿黑袍的人去找過他。' },
          { who: M, text: '你還記得高原那個教團司祭說過，無冕者很看好凱爾嗎？他該不會真的被說動了吧？' },
          { who: M, text: '應該不會啦。他那麼驕傲，怎麼可能聽教團的話。' },
        ],
      },
      {
        name: '部族長老', look: 'nomad',
        lines: [
          { who: '部族長老', text: '每次雲要動之前，羊都會比人先知道，自己開始往前走。可是這幾天，羊群連一步都沒動。' },
          { who: '部族長老', text: '我們部族跟著雷雲走了一千年，雲從來沒有停過。它會停下來，一定是塔出了什麼事。' },
          { who: '部族長老', text: '對了，那個銀誓騎士團的年輕人昨天在營地住了一晚。他整晚都沒睡，天一亮就進塔了。' },
        ],
      },
      {
        name: '牧馬人', look: 'nomad',
        lines: [
          { who: '牧馬人', text: '想抓雷霆戰駒的話，別用追的，牠跑得比風還快。你站著別動，等牠好奇自己靠過來就好。' },
          { who: '牧馬人', text: '還有那個年輕騎士。昨天晚上有個穿黑袍的人來找他，兩個人講了很久。' },
          { who: '牧馬人', text: '最後騎士把那個人趕走了。可是我看到他的手一直在抖，不知道那個人跟他說了什麼。' },
        ],
      },
    ],
    stages: [
      {
        id: 'p1', name: '雷鳴前廳', kind: 'corrupt', level: 36, team: [c('hedgehog', 36), c('ballspark', 36)], enemyName: CORRUPT, aiSkill: 0.6, reward: rw('corrupt', 36, { stones: 4 }),
        before: [{ who: M, text: '這裡好多靜電，我的頭髮都豎起來了。小心，那些柱子後面躲著精靈！' }],
      },
      {
        id: 'p6', name: '遊牧騎手', kind: 'trainer', level: 36, team: [e('stormhorse', 36), e('stormram', 37)], enemyName: '遊牧騎手 塔伊', aiSkill: 0.68, reward: rw('trainer', 36),
        before: [
          { who: '塔伊', text: '這座塔由我們部族的戰士守著。想上去的話，得先讓我看看你夠不夠格。' },
          { who: '塔伊', text: '那個騎士上去的時候，我也這樣問他。結果他一句話都沒回，直接就跟我打起來了。' },
        ],
        after: [{ who: '塔伊', text: '你夠格了。那個騎士還在上面，他說要在那裡等你。' }],
      },
      {
        id: 'p2', name: '避雷柱廳', kind: 'corrupt', level: 37, team: [c('voltadillo', 37), c('stormram', 37), c('ballspark', 37)], enemyName: CORRUPT, aiSkill: 0.66, reward: rw('corrupt', 37),
        before: [{ who: M, text: '這一層全是避雷柱，雷都打進柱子裡了。那些精靈在吸柱子上的電，牠們過來了！' }],
        after: [{ who: M, text: '上面傳來精靈的叫聲，我認得，是凱爾的搭檔。他就在上一層。' }],
      },
      {
        id: 'p3', name: '雷雲下的決鬥', kind: 'rival', level: 37, team: [{ speciesId: 'RIVAL', level: 38 }, e('relic_blade', 37), e('gale_weasel', 37)], enemyName: '勁敵 凱爾', art: 'oath_break', aiSkill: 0.8, reward: rw('rival', 37),
        before: [
          { who: K, text: '你終於來了。' },
          { who: K, text: '昨晚有個穿黑袍的人來找我。他說騎士團教我的那套「配得上」，只是綁住我的枷鎖。' },
          { who: K, text: '他還說，只要我點頭，就送我一隻聖靈。不用證明自己配不配，也不用立誓。' },
          { who: K, text: '我當場就把他趕走了。' },
          { who: K, text: '可是他走了以後，我的手一直在抖。有那麼一秒，我竟然真的想答應他。' },
          { who: K, text: '所以今天我要跟你認真打一場，確定我還是原本的我。你也拿出全力來，不准放水。' },
        ],
        after: [
          { who: K, text: '……我輸了。' },
          { who: K, text: '我一直以為你會贏，只是因為那條龍很強。現在我懂了，你會贏，是因為牠願意聽你的。' },
          { who: K, text: '我的搭檔也願意聽我的。可是這些年，我只會對牠下命令，從來沒問過牠想怎麼打。' },
          { who: K, text: '哼，剛剛那些話，你不准跟別人講。' },
          { who: K, text: '等你收齊源晶，總有一天要去虛蝕裂隙。到時候我也會去。' },
          { who: K, text: '不過不是為了受封。這次是我自己想去。' },
        ],
      },
      {
        id: 'p7', name: '雷占師', kind: 'trainer', level: 38, team: [e('thunderbird', 38), e('hedgehog', 38), e('skyreign', 38)], enemyName: '雷占師 希拉', aiSkill: 0.74, reward: rw('trainer', 38),
        before: [
          { who: '希拉', text: '我是部族的雷占師，平常靠聽雷聲占卜。今天的雷聲告訴我，你會走到塔頂。' },
          { who: '希拉', text: '不過占卜準不準，還是要親自驗證才知道。來吧，跟我打一場。' },
        ],
        after: [
          { who: '希拉', text: '占卜果然很準。不過我昨晚還占到一件事，到現在都想不通。' },
          { who: '希拉', text: '卦象說，有個孩子的心跳越來越快了。你們身邊，有這樣的孩子嗎？' },
        ],
      },
      {
        id: 'p4', name: '教團祭壇', kind: 'cult', level: 38, team: [c('stormram', 38), c('eclipse_batlord', 38), c('soul_lantern', 38)], enemyName: '虛冕教團 祭司', aiSkill: 0.72, reward: rw('cult', 38),
        before: [
          { who: '教團祭司', text: '你來得正好，祭壇已經準備好了。無冕者大人要透過祭壇，親自跟你說話！' },
          { who: '無冕者', text: '歡迎你。只能隔著祭壇跟你說話，請原諒我的失禮。' },
          { who: '無冕者', text: '你一路爬這些塔，走得很快，比我當年還快。' },
          { who: '無冕者', text: '我從來沒有想毀掉什麼。我只是不想再失去任何東西了。你懂嗎？' },
          { who: '無冕者', text: '不懂也沒關係。等你走到裂隙，自然就會懂了。' },
          { who: '艾爾達林', text: '這個聲音，我好像在哪裡聽過。' },
          { who: '教團祭司', text: '聽見了嗎！這可是無冕者大人親自開口，你還不快跪下！' },
        ],
        after: [
          { who: '教團祭司', text: '大人怎麼不說話了？大人，求求您再說一句……' },
          { who: M, text: '他說他不想再失去任何東西。那他以前到底失去過什麼？' },
          { who: '艾爾達林', text: '那個聲音我確定聽過，而且是很久以前的事。可是我一時想不起來是誰。' },
        ],
      },
      {
        id: 'p8', name: '颶雷', kind: 'corrupt', level: 39, team: [c('tornado', 39), c('thunderbird', 39)], enemyName: CORRUPT, aiSkill: 0.76, reward: rw('corrupt', 39, { shards: 1 }),
        before: [
          { who: M, text: '雲裡面有個很大的東西！牠每拍一次翅膀，就打下一道雷。' },
          { who: M, text: '那是雷雲神鳥，平常就是牠拍著翅膀把雷雲往前推。現在連牠都蝕化了，雲才會停著不動。' },
        ],
        after: [{ who: M, text: '你看外面，雷雲開始動了！' }],
      },
      {
        id: 'p5', name: '源晶試煉・族長', kind: 'boss', level: 40, art: 'aether_spring',
        team: [e('stormram', 39), e('skyreign', 39), e('voltarion', 41)],
        enemyName: '族長 卡蘭', aiSkill: 0.85, reward: { gold: 1800, crystals: 700, tickets: 3, breakStones: 8, shards: 3 },
        before: [
          { who: '卡蘭', text: '雲不走，我們就不走。部族跟著雷雲走了一千年，多等幾天也不算什麼。' },
          { who: '卡蘭', text: '沒想到你讓雲重新動起來了。那接下來，就換我來試試你的本事。' },
          { who: '卡蘭', text: '來吧，跟我打一場，讓我看看你到底有多強。' },
        ],
        after: [
          { who: '卡蘭', text: '你打起來比雷雲還吵。不過這樣才對，打架就該這麼有精神。' },
          { who: '卡蘭', text: '雷之源晶就交給你了。' },
          { who: '卡蘭', text: '剛剛跟你交手的弗爾塔，是守著這片草原的雷霆麒麟。牠跑過的地方都會閃起電光。' },
          { who: '卡蘭', text: '今天晚上牠會跑遍整片草原，到時候到處都會亮起來。' },
          { who: M, text: '雲真的開始走了！營地的人在收帳篷，他們又要出發了。' },
          { who: M, text: '還有，凱爾也已經出發了。我從上面看到他往裂隙的方向走。' },
        ],
      },
    ],
  },
  {
    id: 'holy',
    name: '曦光聖都',
    element: 'light',
    desc: '浮在雲上的白色聖城，曦光教廷就在這裡。教廷的騎士把伏魔塔圍了起來。',
    level: 41,
    town: '聖都外城',
    tower: '曦光伏魔塔',
    mapPos: [-11.3, -0.1],
    explore: [w('candledove', 28), w('prismsnail', 22), w('cloudfluff', 20), w('papercrane', 14), w('stormram', 10), w('balancescale', 6), w('lyrebird', 6), w('chime_sprite', 2), w('griffin', 2)],
    intro: [
      { who: M, text: '教廷的騎士把塔整個圍起來了，說沒有他們的許可，誰都不准進去。' },
      { who: M, text: '他們說要淨化塔裡所有蝕化的精靈。可是教廷說的淨化跟我們不一樣，他們是要把精靈殺掉。' },
      { who: S, text: '對。他們一直都是這樣做的。' },
      { who: M, text: '公會長？你怎麼會在這裡？' },
      { who: S, text: '教廷要殺塔裡的精靈，我不能不管。他們那套做法，我以前在這座城裡親眼看過。' },
      { who: S, text: '你們進塔去，把裡面蝕化的精靈一隻一隻救回來。讓教廷的人親眼看看，契約救得了牠們。' },
      { who: M, text: '你剛剛有沒有看到公會長的左手？那隻手平常就抬不太起來，可是一進這座城，就整隻垂著動也不動。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '城的外圍就是雲，千萬別靠太近。掉下去的話，可就回不來了。' },
          { who: M, text: '公會長從進城以後，就一直盯著塔頂看。他不說，我也不太敢問。' },
          { who: M, text: '在高原撿到的那張信紙上寫著，有個「她」過了二十年還記得公會長。我猜那個人就在這座城裡。' },
        ],
      },
      {
        name: '教廷修女', look: 'scholar',
        lines: [
          { who: '教廷修女', text: '聖女大人最近常常一個人站在窗邊，望著塔頂發呆。' },
          { who: '教廷修女', text: '二十年前，教廷也在那座塔頂淨化過一隻蝕化的精靈。那時候牠的締約者擋在牠前面，怎麼樣都不肯讓開。' },
          { who: '教廷修女', text: '那是聖女大人第一次主持淨化，她那一年才十六歲。' },
          { who: '教廷修女', text: '另外還有一件怪事，鐘樓裡的大沙漏最近會自己翻過來。' },
          { who: '教廷修女', text: '而且裡面還會傳出喀、喀的聲音，好像有什麼小東西住在裡面。' },
          { who: '教廷修女', text: '還有，跟你們一起來的那個女孩，只要一走近鐘樓，鐘就會自己響起來。' },
        ],
      },
      {
        name: '外城守衛', look: 'knight',
        lines: [
          { who: '外城守衛', text: '沒有教廷的許可，誰都不能進塔。……算了，反正我也攔不住你，就當我沒看到吧。' },
          { who: '外城守衛', text: '你們那位公會長我認得。二十年前，我親眼看到他從這道門被抬出去。' },
        ],
      },
    ],
    stages: [
      {
        id: 'l1', name: '雲上長階', kind: 'corrupt', level: 42, team: [c('candledove', 42), c('cloudfluff', 42)], enemyName: CORRUPT, aiSkill: 0.64, reward: rw('corrupt', 42, { stones: 4 }),
        before: [{ who: M, text: '這裡的階梯跟雲都是白的，蝕化精靈身上的紫色特別顯眼。小心，牠們衝下來了！' }],
      },
      {
        id: 'l2', name: '教廷騎士', kind: 'trainer', level: 42, team: [e('chime_sprite', 42), e('relic_blade', 42)], enemyName: '教廷騎士 雷恩', aiSkill: 0.72, reward: rw('trainer', 42),
        before: [
          { who: '雷恩', text: '站住。教廷有令，塔裡蝕化的精靈一律由我們處理，公會的人不准插手。' },
          { who: '雷恩', text: '經典寫得很清楚，被虛蝕沾上的東西已經救不回來了，只能消滅。' },
        ],
        after: [
          { who: '雷恩', text: '你在樓下打倒的那隻精靈，結晶碎掉以後，真的變回原本的樣子了。' },
          { who: '雷恩', text: '經典裡從來沒有寫過這種事。這到底是怎麼回事？' },
        ],
      },
      {
        id: 'l6', name: '琉璃聖窗', kind: 'corrupt', level: 43, team: [c('prismsnail', 43), c('balancescale', 43)], enemyName: CORRUPT, aiSkill: 0.7, reward: rw('corrupt', 43),
        before: [{ who: M, text: '蝕化的精靈怕光，你看，牠們都躲在琉璃窗照不到的陰影裡。小心，牠們還是會撲過來！' }],
      },
      {
        id: 'l3', name: '審判官', kind: 'trainer', level: 43, team: [e('chime_sprite', 43), e('grimoire', 43), e('stormram', 43)], enemyName: '審判官 薇拉', art: 'eye_insight', aiSkill: 0.75, reward: rw('trainer', 43),
        before: [
          { who: '薇拉', text: '我是審判庭的審判官薇拉。審判庭只看證據，「也許」跟「可能」都不算數。' },
          { who: '薇拉', text: '你們公會說契約救得了蝕化的精靈，那就拿出真本事，證明給我看。' },
        ],
        after: [{ who: '薇拉', text: '樓下那些精靈變回原樣，我都親眼看到了，剛才這一場也是。證據成立，你可以往上走了。' }],
      },
      {
        id: 'l7', name: '聖歌隊', kind: 'trainer', level: 44, team: [e('lyrebird', 44), e('chime_sprite', 44), e('candledove', 44)], enemyName: '聖歌隊長 瑟琳', aiSkill: 0.76, reward: rw('trainer', 44),
        before: [
          { who: '瑟琳', text: '我在聖歌隊唱了二十年，經典上說，聖歌可以淨化蝕化的精靈。' },
          { who: '瑟琳', text: '可是老實說，我一次也沒看過哪隻精靈是被歌聲救回來的。' },
          { who: '瑟琳', text: '如果你的契約真的做得到，就讓我看看吧。你贏了，我就讓路。' },
        ],
        after: [
          { who: '瑟琳', text: '我讓路。這一路上我都看到了，你的契約是真的救得了牠們。' },
          { who: '瑟琳', text: '只是這樣一想，我唱了二十年的歌，好像一隻精靈都沒有救到。' },
        ],
      },
      {
        id: 'l4', name: '聖都地下', kind: 'cult', level: 44, team: [c('chime_sprite', 44), c('soul_lantern', 44), c('grimoire', 44)], enemyName: '虛冕教團 潛伏者', aiSkill: 0.75, reward: rw('cult', 44),
        before: [
          { who: '教團潛伏者', text: '沒想到公會的人會找到這裡來。教廷把二十年前那件事的紀錄，全都鎖在這間地下室裡。' },
          { who: '教團潛伏者', text: '他們在塔頂殺了一隻得到自由的精靈，還說那叫淨化。無冕者大人說得對，教廷跟我們只差在名字。' },
          { who: S, text: '你閉嘴。' },
          { who: '教團潛伏者', text: '喔？看你那隻抬不起來的左手，原來你就是當年替牠擋劍的那個締約者。' },
        ],
        after: [
          { who: '教團潛伏者', text: '可惡，怎麼會輸給公會的人……' },
          { who: S, text: '走吧，繼續往上。' },
          { who: M, text: '公會長，他剛才說的擋劍，是二十年前的事嗎？' },
          { who: S, text: '那件事以後再說。今天先把塔爬完。' },
        ],
      },
      {
        id: 'l8', name: '墮落的獅鷲', kind: 'corrupt', level: 45, team: [c('griffin', 45), c('balancescale', 45)], enemyName: CORRUPT, aiSkill: 0.78, reward: rw('corrupt', 45, { shards: 1 }),
        before: [
          { who: M, text: '那是聖翼獅鷲！牠只讓守誓的人騎，可是你看，牠的羽毛全都變成灰色了。' },
          { who: S, text: '那是聖女伊莉絲的坐騎。我們把牠救回來。' },
        ],
        after: [
          { who: M, text: '你看，牠的羽毛變回白色了！' },
          { who: S, text: '嗯。這次救回來了。' },
        ],
      },
      {
        id: 'l5', name: '源晶試煉・聖女', kind: 'boss', level: 46, art: 'light_purify',
        team: [e('chime_sprite', 45), e('grimoire', 46), e('luminael', 47)],
        enemyName: '聖女 伊莉絲', aiSkill: 0.87, reward: { gold: 2000, crystals: 750, tickets: 3, breakStones: 8, shards: 3 },
        before: [
          { who: '伊莉絲', text: '請告訴我，你在塔裡救回來的那些精靈，醒過來以後，還記得自己是誰嗎？' },
          { who: '伊莉絲', text: '其實你不用回答。你一路打上來，我都看在眼裡，牠們都還記得。' },
          { who: '伊莉絲', text: '賽倫，好久不見了。算一算，已經二十年了。' },
          { who: S, text: '嗯，二十年了。' },
          { who: '伊莉絲', text: '請問你的左手，到現在還是抬不起來嗎？' },
          { who: S, text: '我的手不要緊。開始試煉吧。' },
          { who: '伊莉絲', text: '好。露米娜爾，請你陪我打這一場。經典說的到底對不對，我想親眼看清楚。' },
        ],
        after: [
          { who: '伊莉絲', text: '我照著經典說了二十年的話。如果經典是錯的，那這二十年來，我到底是在替誰說話呢？' },
          { who: '伊莉絲', text: '剛才打完，露米娜爾自己走到你身邊去了。牠從來不會這樣，連對我都沒有過。' },
          { who: '伊莉絲', text: '光之源晶，請你收下。還有，賽倫，有一件事我一直想當面跟你說。' },
          { who: '伊莉絲', text: '二十年前那一劍，是我下的命令。' },
          { who: S, text: '我知道，我一直都知道。' },
          { who: S, text: '牠已經回不來了。這件事你不用再一個人背著，背了二十年，已經夠了。' },
          { who: M, text: '公會長把左手抬起來了……我認識他這麼多年，這還是第一次看到。' },
        ],
      },
    ],
  },
  {
    id: 'shadow',
    name: '暮影幽境',
    element: 'dark',
    desc: '大陸地底的永夜森林，照不到陽光。暮影結社住在這裡，守著一千年前那一夜的真相。',
    level: 47,
    town: '燈影村',
    tower: '暮影伏魔塔',
    mapPos: [-7.4, -5.8],
    explore: [w('eclipse_batlord', 28), w('maskfox', 26), w('abyssjelly', 20), w('dreamcap', 14), w('inkcat', 8), w('tombhound', 6), w('owlarchivist', 6), w('soul_lantern', 2), w('weaverspider', 2), w('siren', 1)],
    intro: [
      { who: '墨', text: '公會的締約者，你終於來了。我是暮影結社的首領，墨。' },
      { who: '墨', text: '你要的源晶在塔頂。一千年前那天晚上到底發生了什麼事，我也會在塔頂告訴你。' },
      { who: M, text: '等一下，你說一千年前……咦，人呢？一眨眼就不見了。' },
      { who: M, text: '這裡好暗喔。我們跟著路邊的燈籠走，千萬別走散了。' },
      { who: M, text: '對了，諾娃從進到這裡就沒講過話。我問她怎麼了，她說這裡很安靜，待起來很舒服。' },
      { who: M, text: '她以前從來沒說過哪裡待起來舒服，所以我有點擔心。' },
    ],
    npcs: [
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '這裡的精靈白天都在睡覺……啊不對，這裡根本沒有白天。' },
          { who: M, text: '結社的人看諾娃的眼神怪怪的，好像很早以前就認識她一樣。' },
        ],
      },
      {
        name: '結社的守燈人', look: 'shade',
        lines: [
          { who: '守燈人', text: '走路的時候別離開燈光。燈一熄，躲在暗處的蝕化精靈就會撲過來。' },
          { who: '守燈人', text: '塔頂有光，就表示封印還撐得住。要是連塔的光都熄了，壓在塔底下的虛蝕就會全部跑出來。' },
          { who: '守燈人', text: '還有，你們帶來的那個女孩，我們結社已經等了她一千年。為什麼要等她，首領會親口告訴你。' },
        ],
      },
      {
        name: '迷路的旅人', look: 'villager',
        lines: [
          { who: '迷路的旅人', text: '我在湖邊看到一隻會發光的水母，跟著牠走了一段，回過神來就迷路了。' },
          { who: '迷路的旅人', text: '我好像在這裡繞了三天。不過這裡沒有太陽，到底過了幾天，我也說不準。' },
        ],
      },
    ],
    stages: [
      {
        id: 'd1', name: '永夜之湖', kind: 'corrupt', level: 48, team: [c('abyssjelly', 48), c('eclipse_batlord', 48)], enemyName: CORRUPT, aiSkill: 0.7, reward: rw('corrupt', 48, { stones: 5 }),
        before: [{ who: M, text: '這座湖黑得看不到底，可是水裡有東西在發光。小心，牠們游過來了！' }],
      },
      {
        id: 'd6', name: '面具商人', kind: 'trainer', level: 48, team: [e('maskfox', 48), e('inkcat', 48), e('tombhound', 49)], enemyName: '面具商人 無面', aiSkill: 0.76, reward: rw('trainer', 48),
        before: [
          { who: '無面', text: '客人，要不要買張面具再上塔？不買也行，那就陪我打一場，當作過路費。' },
          { who: '無面', text: '我賣了一輩子面具，看人很準。打一場，我就知道你是什麼樣的人。' },
        ],
        after: [{ who: '無面', text: '你打起來一點都不裝，心裡想什麼，出手就是什麼。這種客人用不著面具，上去吧。' }],
      },
      {
        id: 'd2', name: '幽燈迴廊', kind: 'corrupt', level: 49, team: [c('soul_lantern', 49), c('maskfox', 49)], enemyName: CORRUPT, aiSkill: 0.74, reward: rw('corrupt', 49),
        before: [{ who: M, text: '走廊的燈籠一盞一盞熄掉了。守燈人說過，燈一熄，牠們就會來。真的來了！' }],
        after: [{ who: M, text: '咦，燈又全部亮起來了。我們什麼都沒碰，到底是誰點的啊？' }],
      },
      {
        id: 'd3', name: '結社影衛', kind: 'trainer', level: 49, team: [e('eclipse_batlord', 49), e('soul_lantern', 49), e('sand_reaper', 49)], enemyName: '影衛 夜', aiSkill: 0.78, reward: rw('trainer', 49),
        before: [
          { who: '夜', text: '首領交代過，想上塔頂的人，得先打贏我。' },
          { who: '夜', text: '那個女孩就留在這一層吧，試煉跟她沒有關係。' },
        ],
        after: [{ who: '夜', text: '你過關了，上去吧。那個女孩我會替你看好。' }],
      },
      {
        id: 'd7', name: '織夢之間', kind: 'corrupt', level: 50, team: [c('weaverspider', 50), c('dreamcap', 50), c('owlarchivist', 50)], enemyName: CORRUPT, aiSkill: 0.78, reward: rw('corrupt', 50),
        before: [
          { who: M, text: '天花板上掛滿了發光的蜘蛛網。守燈人說，織夢蛛會把人做過的夢留在絲上，靠近看還看得到夢裡的畫面。' },
          { who: M, text: '有一條絲特別亮，牠們全都圍在那一條旁邊。小心，牠們發現我們了！' },
        ],
        after: [
          { who: M, text: '網破掉之前，我看到那條最亮的絲裡有畫面。一顆好大的心臟裂成好幾塊，往四面八方飛了出去。' },
          { who: M, text: '旁邊沒有人在打它，看起來是它自己裂開的。會做這種夢的，到底是誰啊？' },
        ],
      },
      {
        id: 'd4', name: '教團幹部', kind: 'cult', level: 50, team: [c('eclipse_batlord', 50), c('soul_lantern', 50), c('magma_golem', 50)], enemyName: '虛冕教團 幹部', aiSkill: 0.78, reward: rw('cult', 50),
        before: [
          { who: '教團幹部', text: '結社藏了一千年的秘密，今天就要被翻出來了。' },
          { who: '教團幹部', text: '你以為無冕者大人要的只是源晶嗎？大人真正想要的，是跟在你們身邊的那個女孩。' },
          { who: M, text: '你是說諾娃？你們要她做什麼？' },
          { who: '教團幹部', text: '哈，原來你們到現在還不知道她是什麼。等你爬到塔頂，自然就知道了。' },
        ],
        after: [
          { who: '教團幹部', text: '無冕者大人，對不起，我已經盡力了……' },
          { who: M, text: '教團想要她，結社的人也一直盯著她看。諾娃到底是誰啊？' },
        ],
      },
      {
        id: 'd8', name: '冥犬看門', kind: 'corrupt', level: 51, team: [c('tombhound', 51), c('siren', 51)], enemyName: CORRUPT, aiSkill: 0.8, reward: rw('corrupt', 51, { shards: 2 }),
        before: [{ who: M, text: '那隻冥犬有三個頭，每個頭都在盯著我們。牠守在門口，塔頂應該就在後面了。' }],
      },
      {
        id: 'd5', name: '源晶試煉・結社首領', kind: 'boss', level: 52, art: 'eye_insight',
        team: [e('eclipse_batlord', 51), e('soul_lantern', 52), e('noxfang', 53)],
        enemyName: '結社首領 墨', aiSkill: 0.9, reward: { gold: 2200, crystals: 800, tickets: 4, breakStones: 9, shards: 4 },
        before: [
          { who: '墨', text: '大家都說，一千年前世界之心是被人打碎的。其實不對，它是自己碎掉的。' },
          { who: '墨', text: '那時候王國有一個叫瓦爾德的大賢者。他爬上高塔，把世界之心割開了一道口子。' },
          { who: '墨', text: '虛蝕就從那道口子湧了進來。世界之心為了不讓虛蝕全部湧出來，自己碎成了八塊。' },
          { who: '墨', text: '碎片落回大地變成源晶，一塊一塊壓在各地的封印底下，就是你這一路收回來的那些。' },
          { who: '墨', text: '那天晚上，我的搭檔諾克斯衝到裂口前面，硬是把湧出來的虛蝕擋了回去。' },
          { who: '墨', text: '從那天起，牠就一直守著這座塔的封印，我們結社的人也一代接一代陪著牠，守了一千年。' },
          { who: '墨', text: '瓦爾德並沒有死，他靠著虛蝕活到了現在。你們說的無冕者，就是他。' },
          { who: '墨', text: '還有，你帶來的那個女孩不是人類。你心裡應該早就有感覺了吧。' },
          { who: '墨', text: '世界之心碎掉的時候，有一小部分沒有變成源晶，還活了下來，那就是她。' },
          { who: '墨', text: '她遲早要去裂隙。我得確認你有沒有本事陪她走到最後。來吧。' },
        ],
        after: [
          { who: '墨', text: '好，你夠格。暗之源晶給你，這樣八塊源晶就全部到齊了。' },
          { who: '墨', text: '那一晚留下來的東西，不全都是壞的。那個女孩是一個，裂隙邊還有另一個，你到了就會看到。' },
          { who: M, text: '等一下，諾娃是世界之心的一部分？那她去了裂隙以後，會怎麼樣？' },
          { who: '墨', text: '那要看她自己怎麼選。能決定的人是她，不是你。' },
          { who: '艾爾達林', text: '原來是瓦爾德。在荒原的祭壇上跟我們說話的，就是他。' },
          { who: '艾爾達林', text: '一千年前我就認識他。只是我沒有想到，他還活著。' },
        ],
      },
    ],
  },
  {
    id: 'rift',
    name: '虛蝕裂隙',
    element: null,
    desc: '一千年前那一夜在大地上留下的傷口。這裡的地面一直在崩塌，正中央立著無冕者的塔。',
    level: 53,
    town: '騎士團前哨',
    tower: '裂隙之塔',
    mapPos: [0, -8.0],
    explore: [w('gargoyle', 20), w('tombhound', 18), w('abyssjelly', 18), w('maskfox', 16), w('eclipse_batlord', 16), w('sandserpent', 4), w('soul_lantern', 4), w('siren', 3)],
    intro: [
      { who: S, text: '到了。這就是一千年前那一夜留下來的裂隙。' },
      { who: S, text: '正中央那座塔是瓦爾德自己蓋的。他把自己關在裡面，已經一千年了。' },
      { who: S, text: '星門城有守門的阿斯特拉在，不會出事，你不用擔心。' },
      { who: S, text: '八塊源晶都在你身上了。我在前哨這裡等你們回來，去吧。' },
      { who: '諾娃', text: '這裡好吵喔。你們都聽不到嗎？有人一直在叫我，從剛剛到現在都沒停過。' },
      { who: '諾娃', text: '我要跟你一起去。你不用擔心，我知道路。' },
    ],
    npcs: [
      {
        name: S, look: 'elder',
        lines: [
          { who: S, text: '裂隙裡的精靈全都蝕化了。把牠們打倒，結晶碎掉，牠們就不用再痛了。' },
          { who: S, text: '凱爾已經先進塔了。他說一起上塔頂之前，要再跟你打一場。' },
          { who: S, text: '就隨他吧。騎士團出來的人都是這樣，不打一場不會甘心。' },
        ],
      },
      {
        name: M, look: 'mila',
        lines: [
          { who: M, text: '諾娃一路上都在看塔頂。我問她在看什麼，她說上面有人在等她。' },
          { who: M, text: '老實說，我不想讓她上去。可是她說她知道路……她以前在公會連走廊都會走錯耶。' },
          { who: M, text: '你帶她上去吧。可是你要答應我，你們兩個都要平安回來。' },
        ],
      },
      {
        name: '騎士團斥候', look: 'knight',
        lines: [
          { who: '騎士團斥候', text: '裂隙裡跑出來的蝕化精靈越來越多，前哨頂多再撐幾天。拜託你了。' },
          { who: '騎士團斥候', text: '還有一件事。裂隙邊有一隻精靈跟其他蝕化的不一樣，牠不會攻擊人，只會一直跟在巡邏隊後面看著我們。' },
          { who: '騎士團斥候', text: '牠小小的，只有一顆眼睛，頭上飄著一頂碎掉的王冠。跟你們一起來的那個女孩一走近，牠就往後躲。' },
        ],
      },
    ],
    stages: [
      {
        id: 'r1', name: '崩解之路', kind: 'cult', level: 54, team: [c('gale_weasel', 54), c('sand_reaper', 54), c('soul_lantern', 54)], enemyName: '蝕化精靈群', aiSkill: 0.8, reward: rw('cult', 54),
        before: [{ who: M, text: '這條路一直在崩，石頭一塊一塊掉進底下的黑洞裡。小心，前面來了一大群蝕化精靈！' }],
      },
      {
        id: 'r6', name: '虛蝕迴廊', kind: 'corrupt', level: 54, team: [c('gargoyle', 54), c('abyssjelly', 54), c('tombhound', 55)], enemyName: CORRUPT, aiSkill: 0.8, reward: rw('corrupt', 54),
        before: [
          { who: '諾娃', text: '這一層的精靈都在喊痛，一直喊、一直喊。' },
          { who: M, text: '你聽得到牠們的聲音？' },
          { who: '諾娃', text: '嗯。牠們身上的結晶好像很痛。拜託你，快點讓牠們不要再痛了。' },
        ],
        after: [{ who: '諾娃', text: '牠們安靜下來了，已經不痛了。謝謝你。' }],
      },
      {
        id: 'r2', name: '並肩之前', kind: 'rival', level: 55, team: [{ speciesId: 'RIVAL', level: 56 }, e('relic_blade', 55), e('aeroth', 55)], enemyName: '勁敵 凱爾', art: 'oath_break', aiSkill: 0.88, reward: rw('rival', 55),
        before: [
          { who: K, text: '你終於來了。上塔頂之前，我們再打最後一場。' },
          { who: K, text: '這次跟受封沒關係，也不管誰配不配得上誰。就是我跟我的搭檔，對上你跟你的搭檔。' },
          { who: K, text: '還有那個，之前的事，我……' },
          { who: K, text: '算了，打完再說。' },
        ],
        after: [
          { who: K, text: '又輸了。這已經是第三次了。' },
          { who: K, text: '哼，反正我也輸習慣了。' },
          { who: K, text: '還有，荒原那次謝了。要不是跟你打了那一場，我可能真的會答應那個黑袍的人。' },
          { who: K, text: '走吧，搭檔。' },
          { who: K, text: '我是在叫你啦，還愣在那裡幹嘛？' },
        ],
      },
      {
        id: 'r3', name: '教團大祭司', kind: 'cult', level: 56, team: [c('ignisar', 55), c('soul_lantern', 55), c('thalassene', 56)], enemyName: '虛冕教團 大祭司', aiSkill: 0.8, reward: rw('cult', 56),
        before: [
          { who: '教團大祭司', text: '無冕者大人在上面等了整整一千年，我絕不讓你們上去打擾他！' },
          { who: '教團大祭司', text: '看清楚了，這是大人賜給我的聖靈，是得到自由的聖靈！' },
          { who: M, text: '那是伊格尼薩跟瑟蓮娜？不對，牠們一隻在火山、一隻在海裡，不可能跑來這裡。' },
          { who: M, text: '那是用虛蝕做出來的假貨！' },
          { who: '教團大祭司', text: '假貨？你懂什麼，這才是真正的自由……' },
        ],
        after: [{ who: '教團大祭司', text: '大人，我全都照您說的做了，您為什麼不回答我？' }],
      },
      {
        id: 'r7', name: '歪曲的聖獸', kind: 'corrupt', level: 57, team: [c('griffin', 56), c('phoenix', 57), c('sandserpent', 57)], enemyName: CORRUPT, aiSkill: 0.84, reward: rw('corrupt', 57, { shards: 2 }),
        before: [
          { who: M, text: '獅鷲、不死鳥，還有流沙巨蟒，全身都長滿結晶，扭得不成樣子了。' },
          { who: M, text: '牠們本來不住在這裡，是被硬拖進裂隙的。把牠們打醒，讓牠們回自己的家吧。' },
        ],
      },
      {
        id: 'r4', name: '裂隙深處', kind: 'cult', level: 57, team: [c('grimoire', 56), c('sand_reaper', 56), c('noxfang', 57)], enemyName: '虛蝕之影', aiSkill: 0.85, reward: rw('cult', 57),
        before: [
          { who: '諾娃', text: '到了，就是這扇門。他就在門的後面。' },
          { who: '諾娃', text: '他一直在自言自語，講的都是同一件事。你們聽不到，可是我聽得很清楚。' },
          { who: '艾爾達林', text: '一千年了，他還在想同一件事。' },
          { who: M, text: '等一下，門前面還有東西。是影子，好多影子，全都朝我們過來了！' },
        ],
      },
      {
        id: 'r5', name: '終章・無冕者', kind: 'boss', level: 60, art: 'aether_spring',
        team: [c('terragon', 60), c('voltarion', 60), c('luminael', 60)],
        enemyName: '無冕者 瓦爾德', aiSkill: 0.95, reward: { gold: 5000, crystals: 1500, tickets: 10, breakStones: 10, shards: 5 },
        before: [
          { who: '無冕者', text: '歡迎你來。這一千年來，你是第一個走到這裡的客人。' },
          { who: '無冕者', text: '還有你，艾爾達林。原來你也醒了。' },
          { who: '艾爾達林', text: '瓦爾德。一千年了，你的聲音一點都沒變。' },
          { who: '無冕者', text: '因為從那一夜起，我就沒有再老過一天。是自由讓我活到了今天。' },
          { who: '無冕者', text: '只要把世界之心拼回去，那天我失去的朋友，還有整個王國，都會回來。' },
          { who: '無冕者', text: '所以，請把源晶交給我吧。這一次，我不會再失敗了。' },
          { who: '諾娃', text: '不對。你剛剛在門後面一直講的，都是一千年前的那天早上。你想回到那個時候，對不對？' },
          { who: '諾娃', text: '可是那天早上已經過去了。就算把心拼回去，也回不去了。' },
          { who: '無冕者', text: '閉嘴！' },
          { who: '諾娃', text: '締約者，你身上的八塊源晶借我用一下。我要用它們的力量，幫你的精靈一起打。' },
          { who: '諾娃', text: '還有，那隻大烏龜會在殼上堆石頭。堆了石頭以後，你打得太用力，力氣會被彈回來喔。' },
        ],
        after: [
          { who: '無冕者', text: '原來如此。我花了一千年想回到那天早上，可是那個早上，真的已經回不去了。' },
          { who: '諾娃', text: '你看，裂隙在慢慢合起來了。我也該回去了。' },
          { who: M, text: '回去？你要回去哪裡？諾娃，你在說什麼啊？' },
          { who: '諾娃', text: '我要回到世界之心裡面。八塊源晶要有我待在正中間，才能把裂隙關起來。' },
          { who: M, text: '那……你還會回來嗎？' },
          { who: '諾娃', text: '會呀，我一定會回來。謝謝你們一路帶著我。' },
          { who: '諾娃', text: '締約者，你手上的契印在發光耶，好漂亮。' },
          { who: '艾爾達林', text: '她說會回來，就一定會回來。' },
          { who: '艾爾達林', text: '我已經等過一千年了。這一次，應該不用等那麼久。' },
          { who: M, text: '嗯，那我們就等她回來。在那之前，我們的冒險可還沒結束喔。' },
        ],
      },
    ],
  },
];

// The first clear of the source crystal trial grants a Master pact stone
for (const r of REGIONS) {
  for (const st of r.stages) {
    if (st.kind === 'boss') st.reward.masterStones = 1;
    if (st.reward.shards === 0) delete st.reward.shards;
  }
}

/** First time meeting a corrupted spirit in the field: Mila explains what corruption is */
export const CORRUPT_LORE: Line[] = [
  { who: M, text: '等一下！你看那隻精靈的背上，長了一片紫黑色的結晶，還一閃一閃地在發光。' },
  { who: M, text: '牠的眼睛也變紅了。這就是蝕化，精靈沾上虛蝕以後就會變成這樣，連人都認不得。' },
  { who: M, text: '蝕化的精靈會直接撲過來，力氣也比平常大很多，你要小心。' },
  { who: M, text: '不過只要打倒牠，把結晶打碎，就能把牠淨化，讓牠變回原本的樣子。' },
  { who: M, text: '對了，我的論文就是在研究蝕化，所以打完以後讓我好好看一下牠喔。啊，牠衝過來了！' },
];

/** First time entering a Seal Tower: Mila explains the tower and the source crystals */
export const TOWER_LORE: Line[] = [
  { who: M, text: '這就是伏魔塔，比我想的還要高好多。' },
  { who: M, text: '一千年前，最早的一批締約者在冒出虛蝕的地縫上蓋了這座塔，把虛蝕壓在底下。' },
  { who: M, text: '塔的每一層都是一道封印。可是過了這麼久，封印越來越鬆，虛蝕就從縫裡漏到外面去了。' },
  { who: M, text: '所以我們要從最底層開始，一層一層往上打，讓鬆掉的封印重新亮起來。' },
  { who: M, text: '塔頂放著源晶，還有人專門守在那裡。要先過那個人的考驗，才拿得到源晶。' },
  { who: '艾爾達林', text: '這座塔蓋起來的時候，我就在旁邊看著。' },
  { who: M, text: '真的假的？被你這麼一說，我突然覺得爬這座塔壓力好大。' },
  { who: M, text: '好啦，不管了，我們從第一層開始爬吧！' },
];

/** Purification: a line after beating a corrupted spirit (depending on whether it is willing to form a pact) */
export const PURIFY_JOIN = '結晶碎了。牠抖了抖身體，回頭看你，然後跟了上來。';
export const PURIFY_LEAVE = '結晶碎了。牠抖了抖身體，朝你點了一下頭，轉身跑遠了。';
export const PURIFY_NOSTONE = '結晶碎了。牠回頭看著你等了一下，可是你身上已經沒有契約石了，牠只好跑走了。';

/** Opening (follows the animated prologue): Mila finds the protagonist lying beneath the Star Gate, and the Dragon of the First Pact wakes and chooses the protagonist. Once it has spoken, the pact is formed */
export const PROLOGUE: Line[] = [
  { who: M, text: '欸！你還好嗎？聽得到我說話嗎？' },
  { who: M, text: '太好了，你醒了。怎麼會倒在星門底下呢？來，手給我，我拉你起來。' },
  { who: M, text: '你真的嚇死我了。我一聽說星門昨天晚上亮了，就趕過來看，結果門還沒看清楚，就先看到你倒在這裡。' },
  { who: M, text: '對了，我叫米菈，是研究精靈的見習研究員。你叫什麼名字？' },
  { who: M, text: '咦，地在震？星門的底座下面好像有東西在動！' },
  { who: '？？？', text: '別怕，我不會傷害你們。我在這扇門底下睡了一千年，昨晚星門亮起來，我也跟著醒了。' },
  { who: '？？？', text: '你的手背上還沒有契印，看來你還沒有搭檔。如果你願意，就跟我結下你的第一份契約吧。' },
];

/** After the pact (Eldarin stands in the home city), followed by the tutorial battle */
export const FIRST_CONTRACT: Line[] = [
  { who: M, text: '等一下等一下，白金色的鱗片，額頭上還有一個印記，這該不會是……' },
  { who: M, text: '我家是開書店的，店裡有一本很舊的繪本，封面畫的就是這條龍。' },
  { who: M, text: '牠是初契之龍艾爾達林！故事裡說，牠是第一隻跟人類結下契約的精靈。' },
  { who: '艾爾達林', text: '一千年過去了，沒想到還有人記得我的名字。' },
  { who: M, text: '你看你的手背，上面的印記跟牠額頭上的一模一樣。你真的跟艾爾達林結下契約了！' },
  { who: M, text: '咦，你聽，好像有什麼在哼歌。是一隻野生的絨雲，大概是被星門的光引過來的。' },
  { who: M, text: '絨雲是到處都看得到的小毛球。你看牠一直往你們身上撞，好像是想找你們比劃一下。' },
  { who: '艾爾達林', text: '星門剛亮，我身上的力量還很足。等一下打起來，我可以使出全力一次。' },
  { who: M, text: '真的嗎？好，那這就是你們第一次一起戰鬥了。我在旁邊看著，你放心打吧！' },
];

/** After the tutorial battle: the Star Gate dims and the ultimate cannot be used for now (wait for stage III); Selen explains the source crystals, and Nova, who came with him, appears for the first time; then the first Star Gate summon.
 *  Old saves filter out Eldarin's lines, so other characters' lines must not depend on those few lines to connect */
export const AFTER_TUTORIAL: Line[] = [
  { who: '艾爾達林', text: '星門的光暗下來了。剛才那一招，我現在已經用不出來。' },
  { who: '艾爾達林', text: '等我們更有默契以後，就能再用了。' },
  { who: M, text: '啊，公會長來了。他叫賽倫，是締約者公會的公會長，星門就是公會在管的。' },
  { who: S, text: '剛才那一戰我看到了。你們配合得不錯，以後也要好好待牠。' },
  { who: S, text: '這陣子從地縫漏出來的虛蝕越來越多，要擋住它，得把散在各地的八塊源晶找回來。' },
  { who: S, text: '第一塊在翠語森林。你準備好就出發吧。' },
  { who: M, text: '那我也跟你一起去！我研究的就是沾上虛蝕的精靈，這種機會我才不要錯過。' },
  { who: S, text: '嗯。有兩個人一起，我也比較放心。' },
  { who: '諾娃', text: '你的精靈好吵喔。' },
  { who: M, text: '吵？牠從剛才就一直很安靜啊。' },
  { who: '諾娃', text: '牠身上一直有聲音，很吵，可是很好聽，像在唱歌一樣。你們都聽不到嗎？' },
  { who: '艾爾達林', text: '……你聽得到？' },
  { who: M, text: '她叫諾娃。昨天晚上星門亮的時候，她就站在門前，可是什麼都想不起來，公會長就先把她接回公會照顧。' },
  { who: M, text: '公會長他們先回去了。對了，他走之前塞了這個給我，什麼都沒說，我猜是要給你的。' },
  { who: M, text: '是二十張契約券！拿到星門那邊用，星門就會幫你把願意跟你結契約的精靈叫過來。' },
  { who: M, text: '快去試試看，我也好想知道第一次會來什麼樣的精靈！' },
];

export function allStages(): { region: RegionDef; stage: StageDef; index: number }[] {
  const out: { region: RegionDef; stage: StageDef; index: number }[] = [];
  for (const region of REGIONS) region.stages.forEach((stage, index) => out.push({ region, stage, index }));
  return out;
}

export function isRegionUnlocked(cleared: Record<string, number>, idx: number): boolean {
  if (idx === 0) return true;
  const prev = REGIONS[idx - 1];
  return !!cleared[prev.stages[prev.stages.length - 1].id];
}

export function isStageUnlocked(cleared: Record<string, number>, regionIdx: number, stageIdx: number): boolean {
  if (!isRegionUnlocked(cleared, regionIdx)) return false;
  if (stageIdx === 0) return true;
  return !!cleared[REGIONS[regionIdx].stages[stageIdx - 1].id];
}

/** Number of tower floors already cleared */
export function towerProgress(cleared: Record<string, number>, idx: number): number {
  return REGIONS[idx].stages.filter((s) => cleared[s.id]).length;
}

/** The next tower floor to challenge (-1 when all are cleared) */
export function nextFloor(cleared: Record<string, number>, idx: number): number {
  return REGIONS[idx].stages.findIndex((s) => !cleared[s.id]);
}
