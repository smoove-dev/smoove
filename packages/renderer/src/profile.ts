/**
 * Opt-in render profiler: run with `SMOOVE_PROFILE=1` to get a per-stage
 * breakdown (frame apply, rasterize, pixel copy, encode backpressure) logged
 * every 60 frames and at the end of the render. Near-zero overhead when off.
 */

const enabled = typeof process !== "undefined" && process.env && process.env.SMOOVE_PROFILE === "1";

const totals = new Map<string, number>();
let frames = 0;

function add(stage: string, ms: number): void {
  totals.set(stage, (totals.get(stage) ?? 0) + ms);
}

function report(prefix: string): void {
  if (frames === 0) return;
  const parts = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${(v / frames).toFixed(1)}ms`);
  console.log(`[smoove profile] ${prefix} avg/frame over ${frames}: ${parts.join(" ")}`);
}

export const profiler = {
  enabled,

  time<T>(stage: string, fn: () => T): T {
    if (!enabled) return fn();
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      add(stage, performance.now() - t0);
    }
  },

  async timeAsync<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    if (!enabled) return fn();
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      add(stage, performance.now() - t0);
    }
  },

  /** Count a rendered frame; logs a running breakdown every 60. */
  frame(): void {
    if (!enabled) return;
    frames++;
    if (frames % 60 === 0) report("");
  },

  finish(): void {
    if (!enabled) return;
    report("final");
    totals.clear();
    frames = 0;
  },
};
