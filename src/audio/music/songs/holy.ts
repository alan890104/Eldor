// Wild `holy`, Aurelia: a white holy city floating on the clouds, home of the Dawnlight Church.
// Eb major; the melody and harmony often borrow the Lydian #4 (A natural): an F major triad over an Eb pedal bass (F/Eb), which sounds like light shining down through a gap in the clouds.
// Core motif "Dawnlight": Bb4 Eb5 F5 G5 -> A5, first leaping up a fourth, then climbing step by step to the #4. The whole piece's melody grows from these five notes.
// 4/4, 72 BPM, cathedral reverb of 4.5 seconds.
// Intro: the bell tower's change ringing (Bb G F Eb), followed by one low great bell.
// A: a female choir sings a four-part chorale (the organ overlaps an octave lower, with the pedal bass descending Eb D C A Bb), and the celesta picks out points of light on the A note over the F chord.
// B: soprano solo (the motif moves to C minor and returns to its original place, reaching D6 at the highest), harp arpeggios, string pad, double bass, with the strings answering where the voice rests.
// C: two trumpets answer each other left and right (the left plays the motif, the right answers on the F chord a step higher, and from bar 5 the two play in parallel thirds), supported by the full-stops organ and the choir pad, with the timpani only on the strong beats.
// A': the strings play the chorale melody, the choir switches to the vowel u, and the ending goes Ab -> Abm (a chromatic descent C Cb Bb) and stops on the dominant, leading back to the opening bells.

import { arp, mel, pad, prog, rest, seq, vel, type SongDef } from './_kit.ts';

// ── Harmony
const cB = 'Cm | Abadd9 | Eb/G | F | Cm | Gm7 | Abadd9 | Bbsus4 Bb';
const cC = 'Eb | F/Eb | Eb | F/Eb | Cm | Ab | F | Bbsus4 Bb';
const cA2 = 'Eb | F/Eb | Cm7 F7/A | Bb | Eb | F/Eb | Ab Abm | Bbsus4 Bb';

// ── A: four-part chorale (female choir; the top voice is the melody)
const CHORALE = [
  'Bb4+G4+Eb4:4 Eb5+Bb4+G4:4 F5+Bb4+G4:4 G5+Bb4+Eb4:4',
  'A5+C5+F4:8 G5+Bb4+Eb4:4 F5+Bb4+D4:4',
  'G5+Eb5+G4:6 F5+Eb5+A4:2 Eb5+C5+A4:4 C5+A4+F4:4',
  'D5+Bb4+F4:12 r:4',
  'Bb4+G4+Eb4:4 Eb5+Bb4+G4:4 F5+Bb4+G4:4 G5+Bb4+Eb4:4',
  'A5+C5+F4:6 Bb5+D5+F4:2 C6+F5+A4:8',
  'Bb5+Eb5+C5:4 Ab5+Eb5+C5:4 G5+Eb5+Bb4:4 F5+D5+Ab4:4',
  'Eb5+Bb4+G4:12 r:4',
].join(' | ');
/** Organ pedal: Eb D C descending, the A in the bass (the Lydian signature note), cadence Ab Bb Eb */
const PED_A = 'Eb2:16 | Eb2:12 D2:4 | C2:8 A1:8 | Bb1:16 | Eb2:16 | Eb2:16 | Ab1:8 Bb1:8 | Eb2:16';

// ── B: soprano solo
const SOP = 'r:4 G4:4 C5:6 D5:2 | Eb5:12 C5:4 | Bb4:4 Eb5:4 F5:4 G5:4> | A5:12 r:4 | G5:4 C6:10 Bb5:2 | D6:8 C6:2 Bb5:2 A5:2 G5:2 | C6:6 Bb5:2 Ab5:4 F5:4 | Eb5:8 D5:4 r:4';
/** The strings' answer: they move only on the voice's long notes */
const STR_B = 'Eb4:16 | C4:4 Bb3:4 Ab3:8 | G3:8 Bb3:8 | A3:4 C4:4 F4:4 A4:4 | Eb4:16 | D4:8 F4:8 | Eb4:8 C4:8 | Bb3:8 D4:4 F4:4';
const BASS_B = 'C2:16 | Ab1:16 | G1:16 | F1:16 | C2:16 | G1:16 | Ab1:16 | Bb1:16';

// ── C: trumpet dialogue
const TPT_L = '!Bb4:2 Eb5:2 F5:4 G5:8 | R | !Bb4:2 Eb5:2 G5:4 Bb5:8 | R | G5:6 F5:2 Eb5:4 G5:4 | C6:8 Bb5:4 Ab5:4 | A5:8 C6:8 | Bb5:12 r:4';
const TPT_R = 'R | !C5:2 F5:2 G5:4 A5:8 | R | !C5:2 F5:2 A5:4 C6:8 | Eb5:6 D5:2 C5:4 Eb5:4 | Ab5:8 Eb5:8 | F5:8 A5:8 | Eb5:8 D5:4 r:4';
const PED_C = 'Eb2:16 | Eb2:16 | Eb2:16 | Eb2:16 | C2:16 | Ab1:16 | F1:16 | Bb1:12 r:4';
const TIMP_C = '!Eb2:16 | R | Eb2:16 | R | !C2:16 | Ab1:16 | ?F2:1 ?F2:1 F2:1 F2:1 F2:1 F2:1 F2:1 F2:1 !F2:8 | !Bb1:4 r:12';

// ── A': the strings play the chorale melody
const STR_A2 = 'Bb4:4 Eb5:4 F5:4 G5:4 | A5:8 G5:4 F5:4 | G5:6 F5:2 Eb5:4 C5:4 | D5:12 r:4 | Bb4:4 Eb5:4 F5:4 G5:4 | A5:6 Bb5:2 C6:8 | Eb6:4 C6:4 B5:8 | Bb5:12 r:4';
const BASS_A2 = 'Eb2:16 | Eb2:16 | C2:8 A1:8 | Bb1:16 | Eb2:16 | Eb2:16 | Ab1:16 | Bb1:16';

// ── Celesta points of light (only over F, Bb and Eb chords; the A note stays away from the Ab chord)
const CEL_A = 'R | F6:2 A6:2 C7:4 r:8 | R | r:12 D6:2 F6:2 | R | r:8 A6:2 C7:2 F7:4 | R | r:12 G6:2 Bb6:2';
const CEL_B = 'R | R | R | r:8 F6:2 A6:2 C7:4 | R | R | R | r:12 F6:2 D6:2';
const CEL_C = 'R | r:8 A6:4 C7:4 | R | r:8 C7:2 A6:2 F6:4 | R | R | A6:2 C7:2 F7:4 r:8 | R';
const CEL_A2 = 'R | r:8 C7:2 A6:2 F6:4 | R | r:12 F6:2 Bb6:2 | R | r:8 A6:2 C7:2 F7:4 | R | r:12 Bb6:2 D7:2';

/** Bells: once at the start of each section. A one low great bell, B one light bell, C four change-ringing bells, A' one high bell */
const BELLS = seq('!Eb3:16', rest(7), 'G4:16', rest(7), '!Eb4:4 Bb3:4 G3:4 Eb3:4', rest(7), 'Bb4:16', rest(7));

const song: SongDef = {
  title: '曦光聖都',
  mood: '雲上的白色聖城。女聲合唱的聖詠、管風琴、鐘聲與左右對答的小號，Eb 大調帶利底亞的 A 還原，寬廣而安靜。',
  bpm: 72,
  space: { size: 4.5, damp: 0.35, pre: 0.045, er: 0.4, mix: 0.9 },
  gain: 0.8,
  intro: [
    { name: '換鐘', inst: 'bell', part: 'Bb4:4 G4:4 F4:4 Eb4:4 | !Eb3:16', gain: 0.75, rev: 0.5 },
    { name: '合唱', inst: 'choirOo', part: vel(pad(prog('Eb | F/Eb'), { center: 64 }), 0.5), gain: 0.6, rev: 0.6 },
    { name: '踏板', inst: 'organ', part: 'Eb2:16 | Eb2:16', gain: 0.5, rev: 0.3 },
    { name: '雲上的風', inst: 'wind', part: 'C4:32', gain: 0.35, rev: 0.1, opts: { attack: 3, release: 4 } },
  ],
  tracks: [
    { name: '鐘', inst: 'bell', part: BELLS, gain: 1.3, pan: 0.1, rev: 0.5 },
    { name: '聖詠', inst: 'choir', part: seq(CHORALE, rest(24)), gain: 0.5, pan: 0.05, rev: 0.5 },
    { name: '管風琴', inst: 'organ', part: seq(CHORALE, rest(24)), tr: -12, gain: 0.3, pan: -0.1, rev: 0.45 },
    {
      name: '踏板',
      inst: 'organ',
      part: seq(PED_A, rest(8), PED_C, rest(8)),
      gain: 0.6,
      rev: 0.25,
    },
    { name: '全音栓', inst: 'organFull', part: seq(rest(16), pad(prog(cC), { center: 57, size: 4 }), rest(8)), gain: 0.36, rev: 0.45 },
    { name: '合唱墊', inst: 'choir', part: seq(rest(16), vel(pad(prog(cC), { center: 65 }), 0.7), rest(8)), gain: 0.6, rev: 0.55 },
    { name: '女高音', inst: 'soprano', part: seq(rest(8), SOP, rest(16)), gain: 1.1, pan: 0.15, rev: 0.5 },
    { name: '豎琴', inst: 'harp', part: seq(rest(8), arp(prog(cB), '0 1 2 3 5 4 3 2', { center: 60 }), rest(8), arp(prog(cA2), '0 2 4 6 5 3 1 2', { center: 55 })), gain: 0.65, pan: -0.35, rev: 0.45 },
    { name: '弦樂墊', inst: 'strPad', part: seq(rest(8), vel(pad(prog(cB), { center: 55 }), 0.5), rest(16)), gain: 0.7, rev: 0.5 },
    { name: '弦樂', inst: 'strings', part: seq(rest(8), vel(mel(STR_B), 0.65), rest(8), STR_A2), gain: 0.8, pan: -0.25, rev: 0.45, opts: { attack: 0.15 } },
    { name: '合唱 u', inst: 'choirOo', part: seq(rest(24), vel(pad(prog(cA2), { center: 62 }), 0.6)), gain: 0.6, pan: 0.1, rev: 0.6 },
    { name: '低音提琴', inst: 'contrabass', part: seq(rest(8), BASS_B, rest(8), BASS_A2), gain: 0.55, rev: 0.3 },
    { name: '小號左', inst: 'trumpet', part: seq(rest(16), TPT_L, rest(8)), gain: 1.6, pan: -0.55, rev: 0.4 },
    { name: '小號右', inst: 'trumpet', part: seq(rest(16), TPT_R, rest(8)), gain: 1.6, pan: 0.55, rev: 0.4 },
    { name: '定音鼓', inst: 'timpani', part: seq(rest(16), TIMP_C, rest(8)), gain: 0.6, rev: 0.35 },
    { name: '鋼片琴', inst: 'celesta', part: seq(CEL_A, CEL_B, CEL_C, CEL_A2), gain: 0.8, pan: 0.35, rev: 0.6 },
    { name: '雲上的風', inst: 'wind', part: mel('C4:512'), gain: 0.3, rev: 0.1, opts: { attack: 4, release: 4 } },
  ],
};

export default song;
