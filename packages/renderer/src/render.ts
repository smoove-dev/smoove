import { writeFile } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { type Composition, isAudioNode, isVideoNode } from "@smoove/core";
import Konva from "konva";
import type { Canvas } from "skia-canvas";
import { mixAudio } from "./audio-mix.js";
import { collectAudioTrack } from "./audio-track.js";
import {
  AUDIO_CHANNELS,
  AUDIO_SAMPLE_RATE,
  type EncodeTarget,
  MediabunnyEncoder,
} from "./encode.js";
import { registerFonts } from "./setup.js";
import { cpuCanvas } from "./skia.js";
import {
  type Fit,
  type FrameOptions,
  QUALITY_PRESETS,
  type QualityConfig,
  type QualityPreset,
  type RenderedFrame,
  type RenderOptions,
  type RenderResult,
  type RenderToStreamResult,
  type Resolution,
  type StillOptions,
  type StreamOptions,
} from "./types.js";

function assertRendering(comp: Composition): void {
  if (!comp.environment.isRendering) {
    throw new Error(
      '[smoove] Composition is not in rendering mode. Call setupServerRendering() (or import "@smoove/renderer/register") BEFORE constructing the Composition, or pass { mode: "rendering" }.',
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

/** Does the composition contain any audio-bearing node? Decides the audio track up front. */
function hasAudioNodes(comp: Composition): boolean {
  for (const layer of comp.getChildren()) {
    if (!(layer instanceof Konva.Layer)) continue;
    const found = layer.find((n: Konva.Node) => isAudioNode(n) || isVideoNode(n));
    if (found.length > 0) return true;
  }
  return false;
}

async function* framesBetween(
  comp: Composition,
  from: number,
  to: number,
  signal?: AbortSignal,
): AsyncGenerator<RenderedFrame> {
  let index = 0;
  for (let f = from; f <= to; f++) {
    if (signal?.aborted) throw new Error("[smoove] render aborted");
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

/**
 * Core render: rasterize each frame, feed it to a single Mediabunny
 * {@link MediabunnyEncoder}, then mix + add audio and finalize — one pass, no
 * temp files, no child processes. `target` is either an output file or a stream.
 */
async function runRender(
  comp: Composition,
  opts: RenderOptions,
  target: EncodeTarget,
): Promise<RenderResult> {
  assertRendering(comp);
  registerFonts(opts.fonts);

  const fps = opts.fps ?? comp.fps;
  const fit: Fit = opts.fit ?? "contain";
  const native: Resolution = { width: comp.width(), height: comp.height() };
  const size = opts.resolution ?? native;
  const resize = size.width !== native.width || size.height !== native.height;
  const quality = resolveQuality(opts.quality);
  const format = opts.format ?? "mp4";
  const total = comp.durationInFrames.get();
  const from = opts.range?.from ?? 0;
  const to = opts.range?.to ?? total - 1;
  const frameCount = to - from + 1;
  const durationInSeconds = frameCount / fps;

  comp.clearAudioAssets();
  const wantAudio = !opts.mute && hasAudioNodes(comp);

  const encoder = new MediabunnyEncoder({
    width: size.width,
    height: size.height,
    fps,
    format,
    quality,
    hasAudio: wantAudio,
    target,
  });
  await encoder.start();

  const startMs = Date.now();
  try {
    let i = 0;
    for (let f = from; f <= to; f++) {
      if (opts.signal?.aborted) throw new Error("[smoove] render aborted");
      await comp.renderFrame(f);
      let canvas = capture(comp);
      if (resize) canvas = fitCanvas(canvas, size, fit);
      const data = canvas.toBufferSync("raw", { colorType: "rgba" });
      await encoder.addFrame(data, i / fps, 1 / fps);
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

    let hasAudio = false;
    if (wantAudio) {
      const clips = collectAudioTrack(comp, fps);
      const mixed = await mixAudio(clips, fps, durationInSeconds, from);
      hasAudio = mixed !== null;
      await feedAudio(encoder, mixed, durationInSeconds);
    }

    await encoder.finalize();
    return {
      output: target.kind === "file" ? target.path : "",
      width: size.width,
      height: size.height,
      frames: frameCount,
      durationInSeconds,
      hasAudio,
    };
  } catch (err) {
    await encoder.cancel().catch(() => {});
    throw err;
  }
}

/** Feed mixed PCM (or full-duration silence when the track is empty) in 1s chunks. */
async function feedAudio(
  encoder: MediabunnyEncoder,
  mixed: Float32Array | null,
  durationInSeconds: number,
): Promise<void> {
  const totalFrames = Math.ceil(durationInSeconds * AUDIO_SAMPLE_RATE);
  const buf = mixed ?? new Float32Array(totalFrames * AUDIO_CHANNELS);
  const chunkFrames = AUDIO_SAMPLE_RATE; // 1 second per AudioSample
  for (let frame = 0; frame < totalFrames; frame += chunkFrames) {
    const n = Math.min(chunkFrames, totalFrames - frame);
    const chunk = buf.slice(frame * AUDIO_CHANNELS, (frame + n) * AUDIO_CHANNELS);
    await encoder.addAudioChunk(chunk, frame / AUDIO_SAMPLE_RATE);
  }
}

/** Render frames + audio to a muxed video file. */
export function renderComposition(comp: Composition, opts: RenderOptions): Promise<RenderResult> {
  return runRender(comp, opts, { kind: "file", path: opts.output });
}

/**
 * Render to a fragmented mp4/webm exposed as a `Readable`, plus a `done` promise
 * that resolves with the {@link RenderResult} (or rejects) so errors aren't lost.
 * Mediabunny writes the fragmented container straight into the stream — no temp file.
 */
export function renderToStream(comp: Composition, opts: StreamOptions): RenderToStreamResult {
  const stream = new PassThrough();
  const done = runRender(comp, { ...opts, output: "" }, { kind: "stream", writable: stream });
  done.catch((err) => stream.destroy(err instanceof Error ? err : new Error(String(err))));
  return { stream, done };
}

function fitCanvas(src: Canvas, target: Resolution, fit: Fit): Canvas {
  const out = cpuCanvas(target.width, target.height);
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
