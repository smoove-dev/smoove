export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Normalize `t` to [0,1] across the segment [a,b]. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const easeOut = (t: number): number => 1 - (1 - t) ** 3;
export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** "m:ss" timecode from seconds. */
export function fmtTime(s: number): string {
  const v = Math.max(0, s);
  return `${Math.floor(v / 60)}:${Math.floor(v % 60)
    .toString()
    .padStart(2, "0")}`;
}

export type Health = "idle" | "good" | "ok" | "low";

/** Traffic-light health for the realtime-vs-target fps readout. */
export function fpsHealth(realFps: number, targetFps: number): Health {
  if (!realFps) return "idle";
  if (realFps >= targetFps * 0.9) return "good";
  if (realFps >= targetFps * 0.6) return "ok";
  return "low";
}
