/** A seeded generator: call it for a float in `[0, 1)`, or use the helpers. */
export type Random = {
  (): number;
  /** A float in `[min, max)`. */
  range(min: number, max: number): number;
  /** An integer in `[min, max]`, both ends inclusive. */
  int(min: number, max: number): number;
  /** A uniformly chosen member of `items`. */
  pick<T>(items: readonly T[]): T;
};

/** Hash a string seed to a 32-bit integer so `random("balloons")` works. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A seeded pseudo-random generator (mulberry32). `Math.random` breaks frame
 * purity, so a composition that needs scatter seeds one of these instead and
 * gets the same sequence on every run, in the browser and on the server.
 *
 * ```ts
 * const r = random("confetti");
 * const x = r.range(0, comp.width());
 * const tint = r.pick(["#FF2D3F", "#FFC53D"]);
 * ```
 *
 * A generator is stateful: it walks its sequence as you call it. Seed one per
 * thing you are scattering, and seed it outside the frame updater, or reseed
 * it at the top of each frame. A generator advanced inside an updater produces
 * different values on a seek than on playback.
 */
export function random(seed: number | string): Random {
  let state = (typeof seed === "number" ? seed >>> 0 : hashSeed(seed)) || 1;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const r = next as Random;
  r.range = (min, max) => min + next() * (max - min);
  r.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  r.pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("random: pick() needs a non-empty array");
    return items[Math.floor(next() * items.length)] as T;
  };
  return r;
}
