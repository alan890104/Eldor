// "The Uncrowned": the final boss, "Vald the Uncrowned", at the top of the Rift Tower. The last battle of the whole game.
// Core idea: Vald's theme is the minor-mode version of the leitmotif. The main theme's A -> F# major sixth becomes a G -> Eb minor sixth here;
//   at the climax the same motif turns back into a major sixth (G -> E), and the trumpets and choir sing the complete leitmotif in C major (the power of bonds),
//   and finally it falls back to C minor, where the trumpets sing the minor-mode leitmotif once more at the original speed, joining the loop.
// C minor, 4/4, 160 BPM. Vald's theme uses a 3+3+2 rhythm (dotted quarter, dotted quarter, quarter).
// Accompaniment engine: low brass (root + fifth) and toms play eighth notes together, with accents on the 3+3+2 positions, pulling against the four beats of the taiko underneath;
//   the B section switches to a straight four beats and the strings change to ungrouped tremolo; the climax uses a broad half-speed groove (like 80 BPM). The full-stops organ only appears in the intro and the climax.
// Harmony: theme i -> bVI -> iv -> V, answer i -> bVI -> bII (Db, Neapolitan) -> V -> i; B section iv -> bII -> bVI -> bIII -> iv -> bII -> bVII -> V;
//   the climax reuses the main theme's I -> vi -> IV -> V.
// Sections: intro (plays once), 4 bars of void, organ pedal, male-voice drone and a reversed piano that sucks into the downbeat
//   -> A Vald's theme: strings in unison, low brass and toms push eighth notes, 8 -> B straight four beats: horns sing a new melody, male voices an octave below, strings in tremolo, 8
//   -> A2 theme returns: strings plus female choir, male voices sing hollow fifths, 8 -> C the Rift: void, reversed piano, soprano solo on the head of Vald's theme, ending with G -> B -> D upward, 8
//   -> D climax, 16: trumpets and female choir sing the C major leitmotif (at half speed), full-stops organ, male voices, distorted guitar, horn counterpoint, timpani and taiko
//   -> E back to C minor: trumpets sing the minor-mode leitmotif at the original speed, brass and toms return, stopping on G7 to join A, 4.

import { bassline, grid, mel, midi, pad, prog, progLen, rest, seq, tr, vel, voice, type Chd, type Part, type SongDef } from './_kit.ts';

// ── Harmony
const cA = 'Cm | Ab | Fm | G | Cm | Ab | Db:12 G7:4 | Cm';
const cB = 'Fm | Db | Ab | Eb | Fm | Db | Bb | G';
const cC = 'Cm | Cm | Ab | Ab | Fm | Fm | G | G7';
const cD = 'C:32 | Am:32 | F:32 | G:32 | C:32 | Am:32 | Dm7:16 G7:16 | C:32';
const cE = 'Cm | Ab:12 G:4 | Fm | G7';
const A = prog(cA), B = prog(cB), C = prog(cC), D = prog(cD), E = prog(cE);
const LOOP = prog(`${cA} | ${cB} | ${cA} | ${cC} | ${cD} | ${cE}`);

// ── Melody
/** Vald's theme: the G -> Eb minor sixth (the minor version of the leitmotif), all in a 3+3+2 rhythm */
const VALD = mel(
  '!G4:6 Eb5:6 D5:2 C5:2 | !Eb5:6 C5:6 Ab4:4 | !F5:6 Ab5:6 G5:2 F5:2 | !G5:6 D5:6 B4:4 | ' +
    '!G4:6 Eb5:6 D5:2 C5:2 | !Eb5:6 Ab5:6 G5:2 F5:2 | !F5:6 Db5:6 B4:4 | C5:12 r:4',
);
/** B section horns: straight four beats, climbing from the F minor chord up to Db, finally stopping on the B and D of a G major triad */
const MARCH = mel('!F4:4 Ab4:4 C5:6 Bb4:2 | Db5:8 C5:4 Bb4:4 | C5:4 Ab4:4 Eb4:8 | Eb4:4 G4:4 Bb4:8 | !F4:4 Ab4:4 C5:6 Bb4:2 | Db5:8 F5:8 | D5:8 Bb4:8 | B4:8 D5:8');
/** C section soprano: the head of Vald's theme, slowed down; the last two bars sing G B D upward, bringing in the climax's G -> E */
const SOLO = mel('G4:8 Eb5:8 | D5:4 C5:4 D5:8 | C5:12 r:4 | R | Ab4:8 F5:8 | Eb5:4 D5:4 C5:8 | D5:16 | r:4 G4:4 B4:4 D5:3 r:1');
/** The leitmotif (the main theme's A section moved to C major): the G -> E major sixth, followed by an echo of D C D */
const LEIT = mel(
  'G4:4 E5:6 D5:2 C5:2 D5:2 | E5:4 A4:4 C5:6 B4:2 | A4:4 F5:6 E5:2 D5:2 C5:2 | D5:12 r:4 | ' +
    'G4:4 E5:6 D5:2 C5:2 D5:2 | E5:4 G5:4 A5:6 G5:2 | F5:4 E5:2 D5:2 D5:4 C5:2 D5:2 | C5:12 r:4',
);
/** Minor-mode leitmotif (E section, original speed): G -> Eb, C B over Ab, F Eb D C over the F minor chord, stopping on D (G7) */
const LEIT_MINOR = mel('G4:4 Eb5:6 D5:2 C5:2 D5:2 | Eb5:4 Ab4:4 C5:6 B4:2 | Ab4:4 F5:6 Eb5:2 D5:2 C5:2 | D5:12 r:4');
/** Horn counterpoint at the climax: long notes, one note every one to three bars */
const D_HORN = mel('E4:48 C4:32 A3:16 B3:16 D4:16 E4:16 G4:16 E4:16 A4:16 F4:32 E4:32');

/** Detach: each note is cut g steps early, leaving a breath before the chord changes (brass, organ, choir, guitar) */
function detach(p: Part, g: number): Part {
  return { ev: p.ev.map((e) => ({ ...e, d: Math.max(0.5, e.d - g) })), len: p.len };
}

/** Augmentation: time multiplied by k (the climax leitmotif uses two, like half speed) */
function aug(p: Part, k: number): Part {
  return { ev: p.ev.map((e) => ({ ...e, t: e.t * k, d: e.d * k })), len: p.len * k };
}

/** Low brass engine: eighth notes on root + fifth (F2 to E3), accented at the 3+3+2 positions (steps 0, 6, 12), the rest pushed lightly */
function brassEngine(p: Chd[], v = 1): Part {
  const ev: Part['ev'] = [];
  for (const c of p) {
    const r = 41 + ((((c.root - 41) % 12) + 12) % 12);
    for (let s = 0; s < c.d; s += 2) {
      const acc = [0, 6, 12].includes((c.t + s) % 16);
      ev.push({ t: c.t + s, d: acc ? 2 : 1.5, m: [r, r + 7], v: (acc ? 1 : 0.5) * v });
    }
  }
  return { ev, len: progLen(p) };
}

/** Tom eighth notes: the 3+3+2 accents are on the low tom, the rest tapped lightly on the high tom */
const TOMS_LO = 'X.....X.....X...';
const TOMS_HI = '..o.o...o.o...x.';
const TOMS_FILL_LO = 'X.....X.....X.X.';
const TOMS_FILL_HI = '..o.o...o.o.x.xx';

/** String tremolo: the chord (three notes around C3 to B3) repeated straight on every sixteenth note, with no accent grouping */
function tremolo(p: Chd[], center: number, v = 0.45): Part {
  const ev: Part['ev'] = [];
  let prev: number[] | undefined;
  for (const c of p) {
    const vc = voice(c, center, prev, 3);
    prev = vc;
    for (let s = 0; s < c.d; s++) ev.push({ t: c.t + s, d: 1, m: vc, v: v * (s % 4 === 0 ? 1.15 : 1) });
  }
  return { ev, len: progLen(p) };
}

/** Male voices: root + fifth (around C3) */
function fifths(p: Chd[], v = 0.8): Part {
  return { ev: p.map((c) => { const r = 43 + ((((c.root - 43) % 12) + 12) % 12); return { t: c.t, d: c.d, m: [r, r + 7], v }; }), len: progLen(p) };
}

// ── The Rift: reversed piano 1.8 s (about 19.2 steps at 160 BPM), reversed cymbal 1.6 s (about 17.1 steps); started early so they fill up exactly on the downbeat of the target bar
/** Fills up on the downbeat of the given bar (0-based); len is the number of bars in the whole part */
function inhale(targets: [number, string][], ahead: number, len: number): Part {
  return { ev: targets.map(([bar, notes]) => ({ t: bar * 16 - ahead, d: ahead, m: notes.split('+').map(midi), v: 0.8 })), len: len * 16 };
}
const CM = 'C3+G3+Eb4';

const song: SongDef = {
  title: '無冕者',
  mood: '最終決戰。瓦爾德的主題是主導動機的小調版，3+3+2 的節奏，低音銅管與通鼓推著八分音符；高潮時全音栓管風琴進來，小號和合唱用 C 大調唱出主導動機，最後落回小調。',
  bpm: 160,
  gain: 0.85,
  space: { size: 3.0, damp: 0.5, pre: 0.03, er: 0.35, mix: 0.9 },
  intro: [
    { name: '虛空', inst: 'void', part: 'C4:64', gain: 0.8, rev: 0.2, opts: { attack: 1.5, release: 1.5 } },
    { name: '管風琴踏板', inst: 'organFull', part: 'C2:48 r:16', gain: 0.6, rev: 0.4, opts: { release: 0.4 } },
    { name: '男聲', inst: 'menChoir', part: 'C3+G3:32 Db3+Ab3:16 B2+G3:16', gain: 0.7, rev: 0.5 },
    { name: '倒放鋼琴', inst: 'revPiano', part: inhale([[4, CM]], 19.2, 4), gain: 0.9, rev: 0.5 },
    { name: '定音鼓', inst: 'timpani', part: seq(rest(2), mel('(C2:1)*16 | (G2:1)*12 !G2:4')), gain: 0.8, rev: 0.3 },
    { name: '太鼓', inst: 'taiko', part: grid('X...............' + '................' + '................' + 'X.....X.....X.X.', 1, 36), gain: 0.8, rev: 0.2 },
  ],
  tracks: [
    {
      name: '弦樂主旋律',
      inst: 'strings',
      part: seq(VALD, vel(MARCH, 0.75), VALD, rest(8), vel(tr(aug(LEIT, 2), 12), 0.65), rest(4)),
      gain: 1.15,
      pan: 0.15,
      rev: 0.35,
      opts: { attack: 0.05, release: 0.3, vib: 10 },
    },
    { name: '小號', inst: 'trumpets', part: seq(rest(32), aug(LEIT, 2), LEIT_MINOR), gain: 0.95, pan: 0.05, rev: 0.35, opts: { release: 0.14 } },
    { name: '女聲合唱', inst: 'choir', part: seq(rest(16), vel(VALD, 0.9), rest(8), aug(LEIT, 2), vel(pad(E, { center: 70, size: 3 }), 0.7)), gain: 0.8, pan: -0.1, rev: 0.5 },
    {
      name: '男聲合唱',
      inst: 'menChoir',
      part: seq(rest(8), tr(MARCH, -12), vel(fifths(A), 0.7), rest(8), vel(pad(D, { center: 55, size: 3, gap: 2 }), 0.8), fifths(E, 0.9)),
      gain: 0.8,
      pan: 0.2,
      rev: 0.45,
      opts: { release: 0.18 },
    },
    { name: '法國號', inst: 'horns', part: seq(rest(8), MARCH, rest(16), detach(D_HORN, 2), rest(4)), gain: 0.85, pan: -0.25, rev: 0.4, opts: { release: 0.14 } },
    { name: '管風琴', inst: 'organFull', part: seq(rest(32), vel(pad(D, { center: 60, size: 3, gap: 2 }), 0.85), rest(4)), gain: 0.7, pan: -0.1, rev: 0.45, opts: { release: 0.15 } },
    { name: '管風琴踏板', inst: 'organFull', part: seq(rest(32), bassline(D, 'x---------------', '1', { base: 36 }), rest(4)), gain: 0.65, rev: 0.35, opts: { release: 0.3 } },
    { name: '低音提琴', inst: 'contrabass', part: seq(bassline(prog(`${cA} | ${cB} | ${cA} | ${cC}`), 'x-------x-------', '1 1', { base: 36 }), rest(16), bassline(E, 'x-------x-------', '1 1', { base: 36 })), gain: 0.75, rev: 0.2 },
    { name: '弦樂和聲', inst: 'strPad', part: seq(rest(8), vel(pad(B, { center: 57, size: 3 }), 0.6), vel(pad(A, { center: 57, size: 3 }), 0.5), vel(pad(C, { center: 55, size: 3, gap: 2 }), 0.5), rest(20)), gain: 0.6, rev: 0.5, opts: { release: 0.5 } },
    { name: '合唱（柔）', inst: 'choirOo', part: seq(rest(24), vel(pad(C, { center: 62, size: 3, gap: 2 }), 0.7), rest(20)), gain: 0.7, pan: -0.2, rev: 0.6, opts: { release: 0.3 } },
    { name: '破音吉他', inst: 'powerGtr', part: seq(rest(32), detach(mel('C2:32 A1:32 F2:32 G2:32 C2:32 A1:32 D2:16 G2:16 C2:32'), 2), rest(4)), gain: 0.5, pan: 0.3, rev: 0.25, opts: { release: 0.12 } },
    {
      name: '低音銅管',
      inst: 'brassStab',
      part: seq(brassEngine(A), rest(8), brassEngine(A), rest(24), brassEngine(E)),
      gain: 0.6,
      pan: -0.15,
      rev: 0.25,
    },
    {
      name: '低音通鼓',
      inst: 'tom',
      part: seq(grid((TOMS_LO.repeat(3) + TOMS_FILL_LO).repeat(2), 1, 43), rest(8), grid((TOMS_LO.repeat(3) + TOMS_FILL_LO).repeat(2), 1, 43), rest(24), grid(TOMS_LO.repeat(3) + TOMS_FILL_LO, 1, 43)),
      gain: 0.7,
      pan: 0.1,
      rev: 0.2,
    },
    {
      name: '高音通鼓',
      inst: 'tom',
      part: seq(grid((TOMS_HI.repeat(3) + TOMS_FILL_HI).repeat(2), 1, 50), rest(8), grid((TOMS_HI.repeat(3) + TOMS_FILL_HI).repeat(2), 1, 50), rest(24), grid(TOMS_HI.repeat(3) + TOMS_FILL_HI, 1, 50)),
      gain: 0.55,
      pan: 0.3,
      rev: 0.2,
    },
    {
      name: '弦樂震音',
      inst: 'spicc',
      part: seq(rest(8), tremolo(B, 55), rest(16), tremolo(D, 55, 0.4), rest(4)),
      gain: 0.7,
      pan: -0.3,
      rev: 0.3,
    },
    { name: '女高音', inst: 'soprano', part: seq(rest(24), SOLO, rest(20)), gain: 0.75, pan: 0.1, rev: 0.55, opts: { release: 0.3 } },
    { name: '倒放鋼琴', inst: 'revPiano', part: inhale([[16, CM], [25, CM], [27, 'C3+Ab3+Eb4'], [29, 'C3+F3+Ab3'], [32, 'C3+G3+E4'], [52, CM]], 19.2, 52), gain: 0.8, pan: -0.2, rev: 0.5 },
    { name: '虛空', inst: 'void', part: seq(rest(24), 'C4:128', rest(20)), gain: 0.8, rev: 0.2, opts: { attack: 2, release: 2 } },
    {
      name: '定音鼓',
      inst: 'timpani',
      part: seq(
        bassline(A, 'x.....x.....x...', '1 5 1', { base: 36 }),
        bassline(B, 'x.......x.......', '1 5', { base: 36 }),
        bassline(A, 'x.....x.....x.x.', '1 5 1 1', { base: 36 }),
        bassline(prog('Cm | Cm | Ab | Ab | Fm | Fm'), 'x...............', '1', { base: 36 }),
        mel('(G2:1)*16 | (G2:1)*12 !G2:4'),
        bassline(D, 'X.......x.......', '1 5', { base: 36 }),
        bassline(E, 'x.....x.....x...', '1 5 1', { base: 36 }),
      ),
      gain: 0.85,
      rev: 0.3,
    },
    {
      name: '太鼓',
      inst: 'taiko',
      part: grid(
        ('X.....X.....X...'.repeat(3) + 'X.....X.....X.xx').repeat(2) +
          'X...x...X...x...'.repeat(7) + 'X...x...X.x.XXXX' +
          ('X.....X.....X.o.'.repeat(3) + 'X.....X.....XXXX').repeat(2) +
          '................'.repeat(4) + 'X...............'.repeat(2) + 'X.......X.......' + 'X...X...X.x.XXXX' +
          ('X.......X.......'.repeat(3) + 'X.......X...X.XX').repeat(4) +
          'X.....X.....X...'.repeat(3) + 'X.....X.....XXXX',
        1,
        36,
      ),
      gain: 0.4,
      rev: 0.2,
    },
    {
      name: '行進軍鼓',
      inst: 'field',
      part: grid(
        '...o..x..o..X...'.repeat(7) + '...o..x..o..xxXX' +
          '..o.X..o....X.o.'.repeat(7) + '..o.X..o..xxXXXX' +
          '...o..x..o..X.o.'.repeat(7) + '...o..x..o..xxXX' +
          '................'.repeat(6) + 'o.o.o.o.o.o.o.o.' + 'x.x.x.x.xxxxXXXX' +
          ('........X.......'.repeat(3) + '........X...xxXX').repeat(4) +
          '...o..x..o..X...'.repeat(3) + 'x.xxX.xxX.xxXXXX',
      ),
      gain: 1,
      pan: 0.15,
      rev: 0.3,
    },
    {
      name: '鈸',
      inst: 'crash',
      part: grid('X' + '.'.repeat(255) + 'X' + '.'.repeat(255) + ('X' + '.'.repeat(63)).repeat(4) + 'X' + '.'.repeat(63)),
      gain: 0.6,
      rev: 0.4,
    },
    { name: '反向鈸', inst: 'swell', part: inhale([[16, 'C#3'], [32, 'C#3']], 17.1, 52), gain: 0.7, rev: 0.3 },
  ],
};

export default song;
