// Tween animation: two clocks: world (frozen by hit-stop) and fx (effects, which keep running during hit-stop).

export type Clock = 'world' | 'fx' | 'real';
type Job = { t: number; dur: number; fn: (k: number) => void; ease: (x: number) => number; done: () => void; clock: Clock };

export const ease = {
  linear: (x: number) => x,
  inQuad: (x: number) => x * x,
  outQuad: (x: number) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  inCubic: (x: number) => x * x * x,
  outBack: (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
  outElastic: (x: number) =>
    x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  outExpo: (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
};

export class Tweens {
  private jobs: Job[] = [];
  speed = 1;

  update(dt: number, fxDt: number, realDt: number): void {
    const list = this.jobs;
    this.jobs = [];
    const keep: Job[] = [];
    for (const j of list) {
      const d = (j.clock === 'world' ? dt : j.clock === 'fx' ? fxDt : realDt) * this.speed;
      j.t += d;
      const k = Math.min(1, j.t / j.dur);
      j.fn(j.ease(k));
      if (k >= 1) j.done();
      else keep.push(j);
    }
    this.jobs = keep.concat(this.jobs);
  }

  to(dur: number, fn: (k: number) => void, e: (x: number) => number = ease.inOutQuad, clock: Clock = 'world'): Promise<void> {
    return new Promise((resolve) => {
      if (dur <= 0) {
        fn(1);
        resolve();
        return;
      }
      fn(e(0));
      this.jobs.push({ t: 0, dur, fn, ease: e, done: resolve, clock });
    });
  }

  wait(sec: number, clock: Clock = 'world'): Promise<void> {
    return this.to(sec, () => {}, ease.linear, clock);
  }

  clear(): void {
    for (const j of this.jobs) j.done();
    this.jobs = [];
  }
}
