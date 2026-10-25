/** The speech engines `transcribe` can run: on this machine, or through an API. */
import type { TimeRange, TranscriptWord } from "@smoove/agent";
import { apiEngine } from "./api.js";
import { localEngine } from "./local.js";
import { cacheDir } from "./models.js";

export interface SpeechEngine {
  name: "local" | "api";
  /** Why it can't run here, or null when it can. */
  unavailable(language: string | null): Promise<string | null>;
  /** Words with source times, from the 16 kHz mono WAV at `wav`, one chunk at a time. */
  transcribe(
    wav: string,
    chunks: TimeRange[],
    opts: { language: string | null; signal: AbortSignal; progress(share: number): void },
  ): Promise<TranscriptWord[]>;
}

export interface TranscribeDeps {
  local: SpeechEngine;
  api: SpeechEngine;
}

export function defaultDeps(env: NodeJS.ProcessEnv): TranscribeDeps {
  return { local: localEngine(cacheDir(env)), api: apiEngine(env) };
}

/** Longest chunk each engine is fed. */
export const CHUNK_SECONDS = { local: 30, api: 600 } as const;

/** The quietest moment in `[a, b]` on a loudness curve. */
function quietest(curve: { curveHz: number; curveDb: number[] }, a: number, b: number): number {
  let best = b;
  let bestDb = Number.POSITIVE_INFINITY;
  for (let i = Math.ceil(a * curve.curveHz); i <= Math.floor(b * curve.curveHz); i++) {
    const db = curve.curveDb[i];
    if (db !== undefined && db < bestDb) {
      bestDb = db;
      best = i / curve.curveHz;
    }
  }
  return best;
}

/**
 * Pack speech ranges, in order, into chunks no longer than `maxSeconds`,
 * splitting between ranges so no word is cut in half. A single range longer
 * than that is cut at its quietest moments when a loudness curve is given,
 * else into equal parts.
 */
export function chunkSpeech(
  speech: TimeRange[],
  maxSeconds: number,
  curve?: { curveHz: number; curveDb: number[] },
): TimeRange[] {
  const out: TimeRange[] = [];
  let current: TimeRange | null = null;
  for (const range of speech) {
    const length = range.end - range.start;
    if (length > maxSeconds) {
      if (current) out.push(current);
      current = null;
      if (curve) {
        let cursor = range.start;
        while (range.end - cursor > maxSeconds) {
          const cut = quietest(curve, cursor + maxSeconds / 2, cursor + maxSeconds);
          out.push({ start: cursor, end: cut });
          cursor = cut;
        }
        out.push({ start: cursor, end: range.end });
        continue;
      }
      const parts = Math.ceil(length / maxSeconds);
      const each = length / parts;
      for (let i = 0; i < parts; i++) {
        out.push({
          start: range.start + each * i,
          end: i === parts - 1 ? range.end : range.start + each * (i + 1),
        });
      }
      continue;
    }
    if (current && range.end - current.start <= maxSeconds) current.end = range.end;
    else {
      if (current) out.push(current);
      current = { ...range };
    }
  }
  if (current) out.push(current);
  return out;
}

/** Seconds added around each chunk, so a soft first or last word isn't clipped. */
export const CHUNK_PAD = 0.3;

/**
 * Widen each chunk by `pad` on both sides, inside `[0, duration]`, meeting a
 * neighbour halfway when the gap is smaller, so no word is heard twice.
 */
export function padChunks(chunks: TimeRange[], pad: number, duration: number): TimeRange[] {
  const r3 = (t: number) => Math.round(t * 1000) / 1000;
  return chunks.map((c, i) => {
    const prev = chunks[i - 1];
    const next = chunks[i + 1];
    const lo = prev ? (prev.end + c.start) / 2 : 0;
    const hi = next ? (c.end + next.start) / 2 : duration;
    return { start: r3(Math.max(lo, c.start - pad)), end: r3(Math.min(hi, c.end + pad)) };
  });
}
