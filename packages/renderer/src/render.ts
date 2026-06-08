import { once } from "node:events";
import { createReadStream } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Composition } from "@konva-motion/core";
import { Canvas } from "skia-canvas";
import { collectAudioTrack } from "./audio-track.js";
import { buildMuxArgs, runFfmpeg, spawnVideoEncoder } from "./ffmpeg.js";
import { registerFonts } from "./setup.js";
import {
  type Fit,
  type FrameOptions,
  QUALITY_PRESETS,
  type QualityConfig,
  type QualityPreset,
  type RenderOptions,
  type RenderResult,
  type RenderToStreamResult,
  type RenderedFrame,
  type Resolution,
  type StillOptions,
  type StreamOptions,
} from "./types.js";

function assertRendering(comp: Composition): void {
  if (!comp.environment.isRendering) {
    throw new Error(
      '[konva-motion] Composition is not in rendering mode. Call setupServerRendering() (or import "@konva-motion/renderer/register") BEFORE constructing the Composition, or pass { mode: "rendering" }.',
    );
  }
}

function resolveQuality(q?: QualityPreset | QualityConfig): QualityConfig {
  if (!q) return QUALITY_PRESETS.medium;
  return typeof q === "string" ? QUALITY_PRESETS[q] : q;
}

/** Capture the current frame as a skia Canvas (already composited by core). */
function capture(comp: Composition): Canvas {
  return comp.captureCanvas() as unknown as Canvas;
}

async function* framesBetween(
  comp: Composition,
  from: number,
  to: number,
  signal?: AbortSignal,
): AsyncGenerator<RenderedFrame> {
  let index = 0;
  for (let f = from; f <= to; f++) {
    if (signal?.aborted) throw new Error("[konva-motion] render aborted");
    await comp.renderFrame(f);
    const canvas = capture(comp);
    const data = canvas.toBufferSync("raw", { colorType: "rgba" });
    yield { index: index++, frame: f, data, width: canvas.width, height: canvas.height };
  }
}

/**
 * The render primitive: yields raw RGBA frames at the composition's native size.
 * Build custom encoders / GIFs / image sequences on top of this.
 */
export async function* renderFrames(
  comp: Composition,
  opts: FrameOptions = {},
): AsyncGenerator<RenderedFrame> {
  assertRendering(comp);
  registerFonts(opts.fonts);
  const total = comp.durationInFrames.get();
  const from = opts.range?.from ?? 0;
  const to = opts.range?.to ?? total - 1;
  comp.clearAudioAssets();
  yield* framesBetween(comp, from, to, opts.signal);
}

async function renderToFile(
  comp: Composition,
  opts: RenderOptions & { fragmented?: boolean },
): Promise<RenderResult> {
  assertRendering(comp);
  registerFonts(opts.fonts);

  const fps = opts.fps ?? comp.fps;
  const fit: Fit = opts.fit ?? "contain";
  const native: Resolution = { width: comp.width(), height: comp.height() };
  const target = opts.resolution ?? native;
  const quality = resolveQuality(opts.quality);
  const total = comp.durationInFrames.get();
  const from = opts.range?.from ?? 0;
  const to = opts.range?.to ?? total - 1;
  const frameCount = to - from + 1;

  comp.clearAudioAssets();

  const tmpVideo = join(tmpdir(), `km-render-${process.pid}-${Date.now()}.mp4`);
  const encoder = spawnVideoEncoder({
    width: native.width,
    height: native.height,
    fps,
    resolution: opts.resolution,
    fit,
    quality,
    output: tmpVideo,
    ffmpegPath: opts.ffmpegPath,
  });
  const stdin = encoder.stdin;
  if (!stdin) throw new Error("[konva-motion] ffmpeg stdin unavailable");

  const encoderDone = new Promise<void>((resolve, reject) => {
    let err = "";
    encoder.stderr?.on("data", (d) => {
      err += d.toString();
    });
    encoder.on("error", reject);
    encoder.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`[konva-motion] ffmpeg encoder exited ${code}: ${err}`)),
    );
  });

  const startMs = Date.now();
  try {
    let i = 0;
    for await (const frame of framesBetween(comp, from, to, opts.signal)) {
      if (!stdin.write(frame.data)) await once(stdin, "drain");
      i++;
      if (opts.onProgress) {
        const elapsed = (Date.now() - startMs) / 1000;
        const encFps = elapsed > 0 ? i / elapsed : 0;
        opts.onProgress({
          frame: i,
          total: frameCount,
          fps: encFps,
          etaSeconds: encFps > 0 ? (frameCount - i) / encFps : undefined,
        });
      }
    }
  } finally {
    stdin.end();
  }
  await encoderDone;

  const clips = opts.mute ? [] : collectAudioTrack(comp, fps);
  const { args, hasAudio } = buildMuxArgs({
    videoFile: tmpVideo,
    clips,
    fps,
    audioBitrate: quality.audioBitrate,
    output: opts.output,
    fragmented: opts.fragmented,
  });
  try {
    await runFfmpeg(args, opts.ffmpegPath);
  } finally {
    await unlink(tmpVideo).catch(() => {});
  }

  return {
    output: opts.output,
    width: target.width,
    height: target.height,
    frames: frameCount,
    durationInSeconds: frameCount / fps,
    hasAudio,
  };
}

/** Render frames + audio to a muxed video file. */
export function renderComposition(comp: Composition, opts: RenderOptions): Promise<RenderResult> {
  return renderToFile(comp, opts);
}

/**
 * Render to a fragmented mp4/webm exposed as a `Readable`, plus a `done` promise
 * that resolves with the {@link RenderResult} (or rejects) so errors aren't lost.
 */
export function renderToStream(comp: Composition, opts: StreamOptions): RenderToStreamResult {
  const stream = new PassThrough();
  const done = (async (): Promise<RenderResult> => {
    const out = join(tmpdir(), `km-stream-${process.pid}-${Date.now()}.mp4`);
    const result = await renderToFile(comp, { ...opts, output: out, fragmented: true });
    await pipeline(createReadStream(out), stream);
    await unlink(out).catch(() => {});
    return { ...result, output: "" };
  })();
  done.catch((err) => stream.destroy(err instanceof Error ? err : new Error(String(err))));
  return { stream, done };
}

function fitCanvas(src: Canvas, target: Resolution, fit: Fit): Canvas {
  const out = new Canvas(target.width, target.height);
  const ctx = out.getContext("2d");
  const scale =
    fit === "cover"
      ? Math.max(target.width / src.width, target.height / src.height)
      : Math.min(target.width / src.width, target.height / src.height);
  const dw = src.width * scale;
  const dh = src.height * scale;
  ctx.drawImage(src, (target.width - dw) / 2, (target.height - dh) / 2, dw, dh);
  return out;
}

/** Render a single frame to a PNG/JPEG buffer (optionally written to `output`). */
export async function renderStill(comp: Composition, opts: StillOptions): Promise<Buffer> {
  assertRendering(comp);
  registerFonts(opts.fonts);
  await comp.renderFrame(opts.frame);
  let canvas = capture(comp);
  if (opts.resolution) canvas = fitCanvas(canvas, opts.resolution, opts.fit ?? "contain");
  const buf =
    opts.type === "jpeg"
      ? canvas.toBufferSync("jpg", { quality: opts.quality ?? 0.92 })
      : canvas.toBufferSync("png");
  if (opts.output) await writeFile(opts.output, buf);
  return buf;
}
