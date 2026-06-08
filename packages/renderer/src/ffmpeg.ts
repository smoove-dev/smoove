import { type ChildProcess, spawn } from "node:child_process";
import { resolveFfmpegPath } from "./ffmpeg-bin.js";
import type { AudioClip, Fit, QualityConfig, Resolution, VolumeKeyframe } from "./types.js";

/** Simple `-vf` scale/pad (contain) or scale/crop (cover) into a target size. */
export function buildScaleFilter(target: Resolution, fit: Fit): string {
  const { width: w, height: h } = target;
  if (fit === "cover") {
    return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  }
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;
}

/**
 * Spawn the pass-1 encoder: raw RGBA frames on stdin → H.264 video-only file.
 * The caller writes frames to `proc.stdin` (honoring backpressure) and ends it.
 */
export function spawnVideoEncoder(spec: {
  width: number;
  height: number;
  fps: number;
  resolution?: Resolution;
  fit: Fit;
  quality: QualityConfig;
  output: string;
  ffmpegPath?: string;
}): ChildProcess {
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-s",
    `${spec.width}x${spec.height}`,
    "-framerate",
    String(spec.fps),
    "-i",
    "pipe:0",
  ];
  if (spec.resolution) {
    args.push("-vf", buildScaleFilter(spec.resolution, spec.fit));
  }
  args.push(
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    spec.quality.preset,
    "-crf",
    String(spec.quality.crf),
    spec.output,
  );
  return spawn(resolveFfmpegPath(spec.ffmpegPath), args, { stdio: ["pipe", "ignore", "pipe"] });
}

/** Decompose an arbitrary positive tempo into atempo factors within [0.5, 2.0]. */
function atempoChain(rate: number): string[] {
  if (Math.abs(rate - 1) < 1e-6) return [];
  const factors: number[] = [];
  let r = rate;
  while (r > 2) {
    factors.push(2);
    r /= 2;
  }
  while (r < 0.5) {
    factors.push(0.5);
    r /= 0.5;
  }
  factors.push(r);
  return factors.map((f) => `atempo=${f.toFixed(6)}`);
}

/** A constant `volume=` or a frame-evaluated piecewise-linear envelope over `t`. */
function volumeFilter(volume: number | VolumeKeyframe[]): string {
  if (typeof volume === "number") return `volume=${volume.toFixed(6)}`;
  if (volume.length === 0) return "volume=1";
  if (volume.length === 1) return `volume=${(volume[0] as VolumeKeyframe).volume.toFixed(6)}`;
  // Piecewise-LINEAR interpolation over clip-relative time `t`. Each segment
  // lerps between adjacent breakpoints; outside the range it holds the ends.
  const f = (n: number) => n.toFixed(6);
  const last = volume[volume.length - 1] as VolumeKeyframe;
  let expr = f(last.volume);
  for (let i = volume.length - 2; i >= 0; i--) {
    const a = volume[i] as VolumeKeyframe;
    const b = volume[i + 1] as VolumeKeyframe;
    const span = b.time - a.time || 1;
    const seg = `(${f(a.volume)}+(${f(b.volume - a.volume)})*(t-${f(a.time)})/${f(span)})`;
    expr = `if(lt(t,${f(b.time)}),${seg},${expr})`;
  }
  return `volume=eval=frame:volume='${expr}'`;
}

/**
 * Build the pass-2 mux: copy the encoded video and (if any) lay coalesced audio
 * clips over it in a single ffmpeg invocation. Returns the full arg list.
 */
export function buildMuxArgs(opts: {
  videoFile: string;
  clips: AudioClip[];
  fps: number;
  audioBitrate: string;
  output: string;
  fragmented?: boolean;
}): { args: string[]; hasAudio: boolean } {
  const { videoFile, clips, fps, audioBitrate, output, fragmented } = opts;
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", videoFile];

  const hasAudio = clips.length > 0;
  const filters: string[] = [];
  const labels: string[] = [];

  clips.forEach((clip, k) => {
    const inputIndex = k + 1;
    const compDur = (clip.endFrame - clip.startFrame + 1) / fps;
    const srcDur = compDur * clip.playbackRate;
    const delayMs = Math.round((clip.startFrame / fps) * 1000);
    args.push("-ss", clip.mediaInSeconds.toFixed(6), "-i", clip.src);

    const chain = [
      `atrim=0:${srcDur.toFixed(6)}`,
      "asetpts=PTS-STARTPTS",
      ...atempoChain(clip.playbackRate),
      volumeFilter(clip.volume),
      `adelay=${delayMs}:all=1`,
    ].join(",");
    const label = `a${k}`;
    filters.push(`[${inputIndex}:a]${chain}[${label}]`);
    labels.push(`[${label}]`);
  });

  if (hasAudio) {
    filters.push(
      `${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0[aout]`,
    );
    args.push("-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]");
    args.push("-c:v", "copy", "-c:a", "aac", "-b:a", audioBitrate);
  } else {
    args.push("-map", "0:v", "-c:v", "copy");
  }

  if (fragmented) args.push("-movflags", "frag_keyframe+empty_moov");
  args.push(output);
  return { args, hasAudio };
}

/** Run an ffmpeg invocation to completion, rejecting on non-zero exit. */
export function runFfmpeg(args: string[], ffmpegPath?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveFfmpegPath(ffmpegPath), args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`[konva-motion] ffmpeg exited ${code}: ${err}`));
    });
  });
}
