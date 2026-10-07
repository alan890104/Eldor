// Composition toolbox: a song file only needs to import this one module.
export { mel, grid, prog, pad, arp, bassline, holdRoots, strum, seq, stack, loop, rest, tr, mapPitch, vel, slice, progLen, type Part, type Ev, type Chd } from '../notation.ts';
export { midi, chord, voice, degree, remap, roman, MODES, type Mode } from '../theory.ts';
export type { SongDef, TrackDef } from '../engine.ts';
