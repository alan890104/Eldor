// Sample sound effects: recordings generated with ElevenLabs and kept in src/audio/sfx/ (beast cries, voices and the like that synthesis cannot make).
// Files are fetched first and decoded once audio unlocks; if one is not ready at play time this returns null and the caller uses the synthesized version, so everything runs without the audio files.
// Effects have to land on the on-screen beats: at decode time each file's onset and loudest point are measured. Playback starts at the onset by default (generated files often open with tens of milliseconds of silence),
// while sounds that build up slowly (dives, falls, surges) use peakIn to say "the loudest point lands this many seconds later", and the code works out whether to start early or late.

import { synth } from './sfx.ts';

const raw = new Map<string, Promise<ArrayBuffer | null>>();
const decoded = new Map<string, AudioBuffer>();
const decoding = new Set<string>();
/** Multiplier on cutscene time: at 2x battle speed the cutscene runs twice as fast; peakIn and delay are seconds of cutscene time and must be converted to real seconds (set by the director) */
export const sampleClock = { speed: 1 };

/** Onset (the first time the envelope reaches the peak -20 dB) and loudest point (maximum 50 ms RMS), in seconds */
const marks = new Map<string, { onset: number; loudest: number }>();

function measure(b: AudioBuffer): { onset: number; loudest: number } {
  // Average the channels (what you hear is both sides summed; looking only at the left channel mis-measures stereo files)
  const chs = Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
  const d = new Float32Array(b.length);
  for (const ch of chs) for (let i = 0; i < d.length; i++) d[i] += ch[i] / chs.length;
  const sr = b.sampleRate;
  let pk = 0;
  for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
  let onset = 0;
  for (let i = 0; i < d.length; i++) {
    if (Math.abs(d[i]) > pk * 0.1) {
      onset = i / sr;
      break;
    }
  }
  const win = Math.floor(sr * 0.05);
  let best = 0;
  let loudest = 0;
  for (let i = 0; i + win <= d.length; i += win >> 1) {
    let e = 0;
    for (let j = i; j < i + win; j++) e += d[j] * d[j];
    if (e > best) {
      best = e;
      loudest = i / sr;
    }
  }
  return { onset, loudest };
}

/** Fetch the file ahead of time and (if possible) decode it. Called when an ultimate's script loads */
export function preloadSample(url: string): void {
  if (!raw.has(url)) {
    raw.set(url, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  }
  const ctx = synth.ctx;
  if (!ctx || decoded.has(url) || decoding.has(url)) return;
  decoding.add(url);
  void raw.get(url)!.then(async (b) => {
    // decodeAudioData detaches the ArrayBuffer, so hand it a copy
    const buf = b ? await ctx.decodeAudioData(b.slice(0)).catch(() => null) : null;
    if (buf) {
      decoded.set(url, buf);
      marks.set(url, measure(buf));
    }
    decoding.delete(url);
  });
}

/** Whether the file could be fetched (if not, the caller can compute the synthesized fallback first) */
export function sampleFetched(url: string): Promise<boolean> {
  preloadSample(url);
  return raw.get(url)!.then((b) => !!b);
}

/** Preload several at once */
export function preloadSamples(...urls: string[]): void {
  for (const u of urls) preloadSample(u);
}

interface PlayOpts {
  gain?: number;
  delay?: number;
  rate?: number;
  /** Where in the file (seconds) to start playing; if omitted, start at the onset */
  offset?: number;
  /** Make the file's loudest point land this many seconds from now (cutscene time; for build-up sounds, to line up with the hit); the delay or the skipped lead-in is computed automatically */
  peakIn?: number;
  /** Make the end of the file land this many seconds from now (a rush sound made by reversing: the sharpest hit is at the end) */
  endIn?: number;
}

/** A sample that is playing: it can be faded out early */
export interface SampleVoice {
  fade(sec: number): void;
}

/** Play a sample; returns null if it is not decoded yet */
export function playSample(url: string, o: PlayOpts = {}): SampleVoice | null {
  const ctx = synth.ctx;
  const b = decoded.get(url);
  if (!ctx || !b) {
    preloadSample(url);
    return null;
  }
  const rate = o.rate ?? 1;
  const mk = marks.get(url) ?? { onset: 0, loudest: 0 };
  let offset = o.offset ?? Math.max(0, mk.onset - 0.005);
  const spd = sampleClock.speed || 1;
  let delay = (o.delay ?? 0) / spd;
  if (o.peakIn !== undefined) {
    // Playing from offset to the loudest point takes (loudest - offset) / rate seconds; if that is shorter than peakIn, delay; if longer, skip further into the file
    const want = o.peakIn / spd;
    const lead = (mk.loudest - offset) / rate;
    if (lead <= want) delay += want - lead;
    else offset = mk.loudest - want * rate;
  } else if (o.endIn !== undefined) {
    const want = o.endIn / spd;
    const lead = (b.duration - offset) / rate;
    if (lead <= want) delay += want - lead;
    else offset = b.duration - want * rate;
  }
  const src = ctx.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = o.gain ?? 1;
  src.connect(g).connect(synth.sfx);
  src.start(ctx.currentTime + 0.01 + delay, offset);
  return {
    fade(sec) {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.setTargetAtTime(0, t, sec / 4);
      try {
        src.stop(t + sec);
      } catch {
        // already stopped
      }
    },
  };
}

/** Play the sample; if it is not ready, run the synthesized version instead (returns null in that case) */
export function playOr(url: string, fallback: () => void, o: PlayOpts = {}): SampleVoice | null {
  const v = playSample(url, o);
  if (!v) fallback();
  return v;
}
