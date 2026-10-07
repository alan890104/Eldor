// Script of the prologue animation: segments, narration and key time points. The picture and the music both go by the seconds here.
//
// The narrator is Eldarin (the Pact Dragon). It was there that night: it saved Elda but could not save the world's heart,
// and then slept under the Star Gate for a thousand years. It speaks in the tone of an old dragon telling a bedtime story, saying "I" and "we (the spirits)", and calling Elda "she".
// The one who finally opens its eyes is the narrator; the name is saved for the later scene where Mila recognizes it, and the narration never gives its own name.
// The narration must read through from start to finish as one story: sentences are linked by continuations and turns (before that, until that night, but, last night),
// and the nouns are things that appear naturally in the story, with no definition sentences such as "called X" or "humans call us X".
// Each sentence introduces at most one new noun, and that thing is on screen at that moment (nouns in the subtitles are colored).
// Sentences should sound like a person talking: better to stretch a subtitle to fill its time (until 0.1 s before the next sentence) than to squash a sentence into a stiff fragment just to save a few characters (example: a clipped line about the sigil never fading in a lifetime).
// The listener knows nothing: do not write sentences that presuppose a question was asked (a sentence like "that was the Night of the Shattered Heart" answers a question nobody asked),
// and do not force in a naming sentence just to introduce a noun; speak the noun as a thing on screen (the black-purple Void Blight, the eight sacred spirits), and the listener understands by watching.
// After writing it, read it aloud from start to finish; it only counts if it sounds like one person telling the story in a single breath.
// The opening "I only had time to shield her alone" and the closing "this time I will not be too late" echo each other; the "someone has come to the gate" before the ending leads into the next scene, where Mila finds the protagonist lying under the gate.
//
//   0-20    The Night of the Shattered Heart (cold open): a huge beating heart above the town; the masked figure on the tower top reaches into it; the Void Blight pours into the city like a black waterfall;
//           the heart shatters into eight pieces and eight colored beams shoot toward the horizon; the white-gold dragon spreads its wings and shields Elda with a golden light shield, and the sigil on the back of her hand lights up
//   20-23   Black screen, the title "Eldor"
//   23-40   The lost world: a river glowing in the morning light; spirits are born from the light on the river; a child and a spirit touch foreheads and the sigils light up together
//   40-57   Aftermath: on the hills outside the city the eight sacred spirits each catch a source crystal, and eight light pillars ring the city; the Void Blight seeps out of cracks in the ground and the spirits' eyes turn red;
//           the Star Gate goes out, and the dragon lies under the gate and closes its eyes
//   57-72   The present: a meteor shower falls under the night sky a thousand years later; the Star Gate flickers a few times and lights; the dragon beneath the gate opens its eyes and looks at the camera

export interface Line {
  at: number;
  end: number;
  text: string;
  /** The nouns this sentence introduces (colored in the subtitles) */
  term?: string;
  /** A large centered text card (title, "A Thousand Years Later") rather than a subtitle at the bottom */
  card?: boolean;
}

export const LINES: Line[] = [
  { at: 3.4, end: 8.4, text: '那一夜，天上懸著世界的心臟，有個人爬上高塔，把手伸了進去。' },
  { at: 8.6, end: 12.7, text: '它痛得尖叫起來，傷口裡湧出黑紫色的虛蝕，灌進了城裡。', term: '虛蝕' },
  { at: 12.9, end: 16.6, text: '最後，整顆心臟碎成了八片，飛向天邊。' },
  { at: 16.8, end: 19.9, text: '我張開翅膀，卻只來得及護住她一個人。' },
  { at: 20.6, end: 23.0, text: '艾爾多', card: true },
  { at: 23.4, end: 28.8, text: '在那之前，這個世界很明亮，大地上流著會發光的河。' },
  { at: 29.0, end: 33.0, text: '我們這些精靈，就是從那些光裡誕生的。', term: '精靈' },
  { at: 33.2, end: 36.7, text: '孩子只要和精靈碰一碰額頭，就結下了契約，', term: '契約' },
  { at: 36.8, end: 40.0, text: '手背上會亮起契印，從此他們就是一輩子的搭檔。', term: '契印' },
  { at: 40.1, end: 43.6, text: '直到那一夜，心臟的碎片落回大地，變成了八顆源晶。', term: '源晶' },
  { at: 43.8, end: 47.6, text: '八隻聖靈各自接住了一顆，從那天起就守在城的四周。', term: '聖靈' },
  { at: 47.7, end: 50.4, text: '可是虛蝕沒有消失，它從地縫裡滲了出來。' },
  { at: 50.5, end: 53.1, text: '沾上虛蝕的精靈，連夥伴都認不得了。' },
  { at: 53.2, end: 57.2, text: '後來星門的光也熄了，我趴在門底下，就這樣睡著了。' },
  { at: 57.6, end: 60.2, text: '一千年後', card: true },
  { at: 60.4, end: 63.2, text: '昨天夜裡，天上下起了一場流星雨，' },
  { at: 63.3, end: 67.0, text: '星門閃了幾下，又重新亮了起來。' },
  { at: 67.2, end: 69.7, text: '然後，有人來到了門前。' },
  { at: 69.8, end: 72.0, text: '這一次，我不會再來不及了。' },
];

/** Segment start (seconds); &beat=N previews starting from segment N */
export const BEATS = [
  { id: 'night', start: 0 },
  { id: 'title', start: 20 },
  { id: 'lost', start: 23 },
  { id: 'after', start: 40 },
  { id: 'now', start: 57 },
] as const;

export const TOTAL = 72;

/** Key moments (seconds): shared by the picture and the music */
export const CUE = {
  /** Heartbeat (cold open) */
  heartbeats: [0.6, 2.0, 3.4, 4.8, 6.0, 7.1, 8.0],
  /** Cut to the masked figure on the tower top */
  reach: 4.9,
  /** The hand touches the heart */
  touch: 6.2,
  /** The heart screams, the Void Blight surges out */
  scream: 8.2,
  /** Cut to the rooftops: the Void Blight pours into the city */
  flood: 10.6,
  /** The heart shatters */
  shatter: 12.6,
  /** Eight fragments fly out (the interval between each) */
  shardGap: 0.05,
  /** Hard cut to ground level: the dragon and Elda */
  ground: 15.6,
  /** The sigil ignites */
  mark: 17.4,
  /** Smash to black */
  black: 19.8,
  /** Title bell */
  title: 20.6,
  /** Morning light fades in */
  dawn: 23.0,
  /** Cut to the riverside */
  river: 28.6,
  /** Three spirits are born */
  births: [29.4, 30.5, 31.6],
  /** Cut to the child and the spirit */
  meet: 33.6,
  /** Foreheads touch */
  forehead: 35.2,
  /** The sigil appears */
  mark2: 37.0,
  /** The first source crystal falls (close-up) */
  fall: 40.0,
  /** The eight sacred spirits catch the source crystals (the first one) */
  catches: 42.2,
  catchGap: 0.62,
  /** Ring-shaped wide view */
  ringWide: 45.6,
  /** The Void Blight seeps out */
  blight: 47.6,
  /** The spirit's eyes turn red */
  redEye: 50.6,
  /** The Star Gate goes out */
  gateOff: 53.6,
  /** The dragon falls asleep */
  sleep: 55.0,
  /** A thousand years later (black) */
  millennium: 57.0,
  /** Meteor shower */
  meteors: [58.4, 58.9, 59.3, 59.6, 60.0, 60.3, 60.5, 60.8, 61.0, 61.3, 61.5, 61.7, 61.9, 62.1, 62.3, 62.5],
  /** The Star Gate flickers */
  flickers: [63.2, 63.9, 64.3, 65.0, 65.25, 65.7],
  /** The Star Gate lights steadily */
  gateOn: 66.0,
  /** Cut to beneath the gate */
  under: 67.4,
  /** The dragon opens its eyes */
  eye: 69.4,
  /** Golden light, the end */
  end: 71.4,
} as const;
