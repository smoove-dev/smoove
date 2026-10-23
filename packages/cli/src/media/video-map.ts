/**
 * `media_video`: where the picture is solid black or white, where it freezes,
 * and where it cuts, from frames sampled a few times a second and shrunk to a
 * tiny grid. The cost is decoding, so a range can be scanned on its own.
 */
import { join, relative } from "node:path";
import type { TimeRange, VideoMap } from "@smoove/agent";
import { type CommandResult, type RunContext, spell } from "../commands.js";
import { done, fail } from "../run.js";
import { MediaError, mediaKey, projectSource, readCached, writeAtomic } from "./cache.js";
import { framesAt } from "./frames.js";
import { cachedInfo } from "./info.js";
import { awaitJob, startJob } from "./jobs.js";
import { clock, runMedia } from "./runtime.js";

/** Measured in Task 0: decoding costs the same at 1 or 4 samples a second. */
export const DEFAULT_VIDEO_SAMPLE_RATE = 4;
/** Width the frames shrink to before measuring. */
const GRID = 64;
const BINS = 16;
/** Cuts closer than this are one transition, like a fade. */
const MIN_SHOT = 1;

export interface FrameStats {
  mean: number;
  std: number;
  /** Luma histogram, normalized to sum to 1. */
  hist: Float32Array;
  /** Per-pixel luma, 0..1. */
  luma: Float32Array;
}

export function frameStats(rgba: Uint8ClampedArray): FrameStats {
  const n = rgba.length / 4;
  const luma = new Float32Array(n);
  const hist = new Float32Array(BINS);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const y =
      (0.2126 * (rgba[i * 4] as number) +
        0.7152 * (rgba[i * 4 + 1] as number) +
        0.0722 * (rgba[i * 4 + 2] as number)) /
      255;
    luma[i] = y;
    sum += y;
    hist[Math.min(BINS - 1, Math.floor(y * BINS))] =
      (hist[Math.min(BINS - 1, Math.floor(y * BINS))] as number) + 1;
  }
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) sq += ((luma[i] as number) - mean) ** 2;
  for (let b = 0; b < BINS; b++) hist[b] = (hist[b] as number) / n;
  return { mean, std: Math.sqrt(sq / n), hist, luma };
}

const isBlack = (s: FrameStats) => s.mean < 0.06 && s.std < 0.03;
const isWhite = (s: FrameStats) => s.mean > 0.94 && s.std < 0.03;

function histDistance(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs((a[i] as number) - (b[i] as number));
  return d;
}

/** The largest change of any one pixel. */
function maxPixelChange(a: Float32Array, b: Float32Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs((a[i] as number) - (b[i] as number)));
  return d;
}

const round = (t: number) => Math.round(t * 100) / 100;

/** Runs of samples where `test` holds, as ranges at least `min` seconds long. */
function runs(
  samples: { time: number }[],
  test: (i: number) => boolean,
  period: number,
  to: number,
  min: number,
  startAt = (i: number) => i,
): TimeRange[] {
  const out: TimeRange[] = [];
  for (let i = 0; i < samples.length; ) {
    if (!test(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < samples.length && test(j + 1)) j++;
    const start = (samples[startAt(i)] as { time: number }).time;
    const end = Math.min(to, (samples[j] as { time: number }).time + period);
    if (end - start >= min) out.push({ start: round(start), end: round(end) });
    i = j + 1;
  }
  return out;
}

/** The picture's blank, frozen and cut moments from time-ordered samples. `source` is filled by the caller. */
export function mapVideo(
  samples: { time: number; stats: FrameStats }[],
  opts: { sampleRate: number; from: number; to: number },
): VideoMap {
  const period = 1 / opts.sampleRate;
  const at = (i: number) => (samples[i] as { stats: FrameStats }).stats;
  const blank = (i: number) => isBlack(at(i)) || isWhite(at(i));
  // A pair is still when no pixel visibly changes. Histograms would call
  // moving noise frozen, and an average would call a speaker who barely
  // moves frozen: on a real lecture even the quietest tenth of sample pairs
  // had some pixel change by 0.11.
  const still = (i: number) =>
    i > 0 && !blank(i) && !blank(i - 1) && maxPixelChange(at(i).luma, at(i - 1).luma) < 0.05;
  const shots: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    if (blank(i) && blank(i - 1)) continue;
    if (histDistance(at(i).hist, at(i - 1).hist) <= 0.6) continue;
    const time = round((samples[i] as { time: number }).time);
    // A fade jumps more than once in quick succession: keep its first jump.
    const last = shots[shots.length - 1];
    if (last === undefined || time - last >= MIN_SHOT) shots.push(time);
  }
  return {
    source: "",
    from: opts.from,
    to: opts.to,
    sampleRate: opts.sampleRate,
    black: runs(samples, (i) => isBlack(at(i)), period, opts.to, 0.5),
    white: runs(samples, (i) => isWhite(at(i)), period, opts.to, 0.5),
    frozen: runs(samples, still, period, opts.to, 2, (i) => i - 1),
    shots,
  };
}

function describe(map: VideoMap, file: string): string[] {
  const list = (rs: TimeRange[]) =>
    rs.length ? rs.map((r) => `${clock(r.start, 1)} to ${clock(r.end, 1)}`).join(", ") : "none";
  return [
    `${map.source}, ${clock(map.from, 1)} to ${clock(map.to, 1)}, at ${map.sampleRate} samples a second.`,
    `Black: ${list(map.black)}.`,
    `White: ${list(map.white)}.`,
    `Frozen: ${list(map.frozen)}.`,
    map.shots.length
      ? `Cuts: ${map.shots.length}${map.shots.length <= 12 ? `, at ${map.shots.map((t) => clock(t, 1)).join(", ")}` : ""}.`
      : "Cuts: none.",
    `Every range: ${file}`,
  ];
}

export function runMediaVideo(
  ctx: RunContext,
  input: { source: string; from?: number; to?: number; rate?: number },
): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const source = projectSource(root, ctx.cwd, input.source, ctx.door);
    const info = await cachedInfo(root, source);
    if (!info.hasVideo)
      throw new MediaError("no-video-track", `${source} has no video track to look at.`);
    const from = Math.max(0, input.from ?? 0);
    const to = Math.min(info.duration, input.to ?? info.duration);
    const rate = input.rate ?? DEFAULT_VIDEO_SAMPLE_RATE;
    if (to <= from) {
      throw new MediaError(
        "bad-request",
        `${source} is ${clock(info.duration, 1)} long, so there's nothing to scan from ${clock(from, 1)}${input.to !== undefined ? ` to ${clock(input.to, 1)}` : ""}.`,
      );
    }
    const { dir } = mediaKey(root, source);
    const range = `${round(from)}-${round(to)}-${rate}`;
    const name = `video-map-${range}.json`;
    const file = relative(root, join(dir, name));

    // One job per range, so a scan of another range is never joined instead.
    if (!readCached<VideoMap>(dir, name)) {
      const job = startJob(
        root,
        "media_video",
        source,
        async (report) => {
          const times: number[] = [];
          for (let t = from; t < to - 1e-9; t += 1 / rate) times.push(Math.round(t * 1000) / 1000);
          const samples: { time: number; stats: FrameStats }[] = [];
          for await (const frame of framesAt(root, source, times, GRID)) {
            samples.push({
              time: frame.at,
              stats: frameStats(frame.rgba),
            });
            report(
              samples.length / times.length,
              `Scanned ${clock(times[samples.length - 1] ?? 0)}`,
            );
          }
          const map = { ...mapVideo(samples, { sampleRate: rate, from, to }), source };
          writeAtomic(join(dir, name), JSON.stringify(map));
          return [file];
        },
        range,
      );
      const result = await awaitJob(ctx, job);
      if ("handedBack" in result) {
        return done({ job: result.handedBack }, [
          `Still scanning ${source}. It goes on in the background.`,
          `Check on it with ${spell(ctx, "media_status")}, job ${result.handedBack}.`,
        ]);
      }
      if (result.status === "error" && result.error)
        return fail(result.error.code, result.error.message);
    }
    const map = readCached<VideoMap>(dir, name);
    if (!map) throw new MediaError("media-error", `The scan of ${source} didn't write ${file}.`);
    return done(map, describe(map, file));
  });
}
