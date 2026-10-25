/**
 * `media_audio`: where a recording is quiet, where someone speaks, and where
 * it gets loud, from one decode of its audio into loudness windows.
 */
import { join, relative } from "node:path";
import type { AudioMap, AudioPeak, TimeRange } from "@smoove/agent";
import { type CommandResult, type RunContext, spell } from "../commands.js";
import { done, fail } from "../run.js";
import { MediaError, mediaKey, projectSource, readCached, writeAtomic } from "./cache.js";
import { cachedInfo } from "./info.js";
import { awaitJob, startJob } from "./jobs.js";
import { clock, loadMedia, runMedia } from "./runtime.js";

export interface AudioMapOptions {
  /** Quiet is this many dB under the clip's typical level. */
  thresholdDb: number;
  /** Seconds a quiet stretch must last. */
  minQuiet: number;
  /** How many loud moments to keep. */
  peaks: number;
}

export const AUDIO_MAP_DEFAULTS: AudioMapOptions = { thresholdDb: 20, minQuiet: 0.5, peaks: 10 };

/** Below this a window counts as silence, not speech, when finding the typical level. */
const FLOOR_DB = -60;
/** Speech ranges closer than this merge. */
const MERGE_GAP = 0.3;
const CURVE_HZ = 4;
const PEAK_ABOVE_DB = 6;
const PEAK_APART = 5;

const toDb = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-6));

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Fold an envelope's loudness windows into an audio map. `source` is filled by the caller. */
export function mapAudio(
  env: { windowHz: number; rms: Float32Array; duration: number },
  opts: AudioMapOptions,
): AudioMap {
  const { windowHz, duration } = env;
  const db = Array.from(env.rms, toDb);
  const at = (i: number) => Math.min(duration, i / windowHz);

  const block = Math.max(1, Math.round(windowHz / CURVE_HZ));
  const curveDb: number[] = [];
  for (let i = 0; i < db.length; i += block) {
    const slice = db.slice(i, i + block);
    curveDb.push(Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10);
  }

  const voiced = db.filter((d) => d > FLOOR_DB);
  if (voiced.length === 0) {
    return {
      source: "",
      duration,
      typicalDb: FLOOR_DB,
      thresholdDb: FLOOR_DB,
      quiet: [{ start: 0, end: duration }],
      speech: [],
      peaks: [],
      curveHz: CURVE_HZ,
      curveDb,
    };
  }
  const typicalDb = median(voiced);
  const thresholdDb = typicalDb - opts.thresholdDb;

  const quiet: TimeRange[] = [];
  for (let i = 0; i < db.length; ) {
    if ((db[i] as number) >= thresholdDb) {
      i++;
      continue;
    }
    let j = i;
    while (j < db.length && (db[j] as number) < thresholdDb) j++;
    const range = { start: at(i), end: at(j) };
    if (range.end - range.start >= opts.minQuiet) quiet.push(range);
    i = j;
  }

  const speech: TimeRange[] = [];
  let cursor = 0;
  for (const q of [...quiet, { start: duration, end: duration }]) {
    if (q.start > cursor) {
      const last = speech[speech.length - 1];
      if (last && cursor - last.end < MERGE_GAP) last.end = q.start;
      else speech.push({ start: cursor, end: q.start });
    }
    cursor = q.end;
  }

  return {
    source: "",
    duration,
    typicalDb: Math.round(typicalDb * 10) / 10,
    thresholdDb: Math.round(thresholdDb * 10) / 10,
    quiet,
    speech,
    peaks: findPeaks(db, windowHz, typicalDb, opts.peaks),
    curveHz: CURVE_HZ,
    curveDb,
  };
}

/** Local maxima of a one-second moving average that stand out, kept apart, loudest first. */
function findPeaks(db: number[], windowHz: number, typicalDb: number, count: number): AudioPeak[] {
  if (count <= 0) return [];
  const prefix = new Float64Array(db.length + 1);
  for (let i = 0; i < db.length; i++) prefix[i + 1] = (prefix[i] as number) + (db[i] as number);
  const half = Math.max(1, Math.round(windowHz / 2));
  const smooth = db.map((_, i) => {
    const a = Math.max(0, i - half);
    const b = Math.min(db.length, i + half);
    return ((prefix[b] as number) - (prefix[a] as number)) / (b - a);
  });
  const candidates: { i: number; v: number }[] = [];
  for (let i = 0; i < smooth.length; i++) {
    const v = smooth[i] as number;
    if (v < typicalDb + PEAK_ABOVE_DB) continue;
    const prev = i > 0 ? (smooth[i - 1] as number) : Number.NEGATIVE_INFINITY;
    const next = i + 1 < smooth.length ? (smooth[i + 1] as number) : Number.NEGATIVE_INFINITY;
    if (v > prev && v >= next) candidates.push({ i, v });
  }
  candidates.sort((a, b) => b.v - a.v);
  const kept: { i: number; v: number }[] = [];
  for (const c of candidates) {
    if (kept.length >= count) break;
    if (kept.every((k) => Math.abs(k.i - c.i) / windowHz >= PEAK_APART)) kept.push(c);
  }
  return kept
    .sort((a, b) => a.i - b.i)
    .map((k) => ({
      time: Math.round((k.i / windowHz) * 100) / 100,
      aboveTypicalDb: Math.round((k.v - typicalDb) * 10) / 10,
    }));
}

function mapFile(opts: AudioMapOptions): string {
  const same =
    opts.thresholdDb === AUDIO_MAP_DEFAULTS.thresholdDb &&
    opts.minQuiet === AUDIO_MAP_DEFAULTS.minQuiet &&
    opts.peaks === AUDIO_MAP_DEFAULTS.peaks;
  return same
    ? "audio-map.json"
    : `audio-map-${opts.thresholdDb}-${opts.minQuiet}-${opts.peaks}.json`;
}

/** A source's audio map, from the cache or one decode. */
export async function readAudioMap(
  root: string,
  source: string,
  report?: (progress: number, message: string) => void,
  options: Partial<AudioMapOptions> = {},
): Promise<AudioMap> {
  const opts = { ...AUDIO_MAP_DEFAULTS, ...options };
  const { dir } = mediaKey(root, source);
  const hit = readCached<AudioMap>(dir, mapFile(opts));
  if (hit) return hit;
  const info = await cachedInfo(root, source);
  if (!info.hasAudio) {
    throw new MediaError(
      "no-audio-track",
      `${source} has no audio track, so there's no audio to map.`,
    );
  }
  report?.(0, "Decoding the audio");
  const { media } = await loadMedia();
  let env: Awaited<ReturnType<typeof media.buildEnvelope>>;
  try {
    env = await media.buildEnvelope(join(root, source));
  } catch (err) {
    throw new MediaError(
      "unsupported-codec",
      `smoove couldn't decode the audio in ${source}: ${err instanceof Error ? err.message : String(err)}.`,
    );
  }
  const map = { ...mapAudio(env, opts), source };
  writeAtomic(join(dir, mapFile(opts)), JSON.stringify(map));
  report?.(1, "Mapped the audio");
  return map;
}

function describe(map: AudioMap, file: string): string[] {
  const span = (r: TimeRange) => `${clock(r.start, 1)} to ${clock(r.end, 1)}`;
  const quietTotal = map.quiet.reduce((a, q) => a + q.end - q.start, 0);
  const longest = [...map.quiet].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  const lines = [
    `${map.source}: ${clock(map.duration)} of audio, typical level ${map.typicalDb} dB.`,
    map.quiet.length
      ? `Quiet: ${map.quiet.length} stretch${map.quiet.length === 1 ? "" : "es"}, ${clock(quietTotal, 1)} in all, below ${map.thresholdDb} dB. Longest: ${span(longest as TimeRange)}.`
      : `Quiet: none, at below ${map.thresholdDb} dB.`,
    `Speech: ${map.speech.length} stretch${map.speech.length === 1 ? "" : "es"}.`,
  ];
  if (map.peaks.length) {
    lines.push(
      `Loudest moments: ${map.peaks.map((p) => `${clock(p.time, 1)} (+${p.aboveTypicalDb} dB)`).join(", ")}.`,
    );
  }
  lines.push(`Every range and the loudness curve: ${file}`);
  return lines;
}

export function runMediaAudio(
  ctx: RunContext,
  input: { source: string; thresholdDb?: number; minQuiet?: number; peaks?: number },
): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const source = projectSource(root, ctx.cwd, input.source, ctx.door);
    const opts = {
      ...AUDIO_MAP_DEFAULTS,
      ...Object.fromEntries(
        Object.entries({
          thresholdDb: input.thresholdDb,
          minQuiet: input.minQuiet,
          peaks: input.peaks,
        }).filter(([, v]) => v !== undefined),
      ),
    } as AudioMapOptions;
    const mapName = mapFile(opts);
    const file = relative(root, join(mediaKey(root, source).dir, mapName));
    const job = startJob(
      root,
      "media_audio",
      source,
      async (report) => {
        await readAudioMap(root, source, report, opts);
        return [file];
      },
      // Other thresholds are other work: never join a job mapping the defaults.
      mapName === "audio-map.json"
        ? undefined
        : mapName.slice("audio-map-".length, -".json".length),
    );
    const result = await awaitJob(ctx, job);
    if ("handedBack" in result) {
      return done({ job: result.handedBack }, [
        `Still mapping the audio of ${source}. It goes on in the background.`,
        `Check on it with ${spell(ctx, "media_status")}, job ${result.handedBack}.`,
      ]);
    }
    if (result.status === "error" && result.error)
      return fail(result.error.code, result.error.message);
    const map = await readAudioMap(root, source, undefined, opts);
    return done(map, describe(map, file));
  });
}
