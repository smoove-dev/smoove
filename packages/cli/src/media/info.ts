/** `media_info`: what's in a file, from its container, without decoding frames. */
import { extname, join } from "node:path";
import type { MediaInfo } from "@smoove/agent";
import type { CommandResult, RunContext } from "../commands.js";
import { done } from "../run.js";
import { MediaError, mediaKey, projectSource, readCached, writeAtomic } from "./cache.js";
import { clock, loadMedia, openInput, runMedia } from "./runtime.js";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp", ".svg"]);

/** Portrait, landscape or square, with a little give for square. */
export function shapeOf(width: number, height: number): NonNullable<MediaInfo["shape"]> {
  if (Math.abs(Math.log(width / height)) <= Math.log(1.02)) return "square";
  return width > height ? "landscape" : "portrait";
}

/**
 * A still image's size as it draws. skia-canvas applies the EXIF orientation
 * a phone writes, as the browser does, so a photo taken sideways reports its
 * upright size here (raw pixel readers like `sips` report it sideways).
 */
async function readImageInfo(root: string, source: string): Promise<MediaInfo> {
  const { skia } = await loadMedia();
  let img: Awaited<ReturnType<typeof skia.loadImage>>;
  try {
    img = await skia.loadImage(join(root, source));
  } catch (err) {
    throw new MediaError(
      "media-error",
      `${source} isn't an image smoove can read (${err instanceof Error ? err.message : String(err)}).`,
    );
  }
  return {
    source,
    kind: "image",
    duration: 0,
    hasVideo: false,
    hasAudio: false,
    width: img.width,
    height: img.height,
    shape: shapeOf(img.width, img.height),
  };
}

/**
 * Read a source's metadata. Reads Mediabunny's tracks directly rather than
 * `probeMedia`, whose in-process memo would outlive a replaced file in a
 * long-running MCP server.
 */
export async function readInfo(root: string, source: string): Promise<MediaInfo> {
  if (IMAGE_EXTS.has(extname(source).toLowerCase())) return readImageInfo(root, source);
  const input = await openInput(root, source);
  try {
    let video: Awaited<ReturnType<typeof input.getPrimaryVideoTrack>>;
    let audio: Awaited<ReturnType<typeof input.getPrimaryAudioTrack>>;
    try {
      [video, audio] = await Promise.all([
        input.getPrimaryVideoTrack(),
        input.getPrimaryAudioTrack(),
      ]);
    } catch (err) {
      throw new MediaError(
        "media-error",
        `${source} isn't a video or audio file smoove can read (${err instanceof Error ? err.message : String(err)}).`,
      );
    }
    if (!video && !audio)
      throw new MediaError("media-error", `${source} has no video or audio track.`);
    const info: MediaInfo = {
      source,
      kind: video ? "video" : "audio",
      duration: await input.computeDuration(),
      hasVideo: video !== null,
      hasAudio: audio !== null,
    };
    if (video) {
      const stats = await video.computePacketStats(100);
      info.width = video.displayWidth;
      info.height = video.displayHeight;
      info.shape = shapeOf(video.displayWidth, video.displayHeight);
      info.fps = Math.round(stats.averagePacketRate * 1000) / 1000;
      info.rotation = video.rotation;
      if (video.codec) info.videoCodec = video.codec;
    }
    if (audio) {
      info.sampleRate = audio.sampleRate;
      info.channels = audio.numberOfChannels;
      if (audio.codec) info.audioCodec = audio.codec;
    }
    return info;
  } finally {
    input.dispose();
  }
}

/** {@link readInfo}, cached in the source's media folder. */
export async function cachedInfo(root: string, source: string): Promise<MediaInfo> {
  const { dir } = mediaKey(root, source);
  const hit = readCached<MediaInfo>(dir, "info.json");
  if (hit) return hit;
  const info = await readInfo(root, source);
  writeAtomic(join(dir, "info.json"), JSON.stringify(info, null, 2));
  return info;
}

export function describeInfo(info: MediaInfo): string[] {
  if (info.kind === "image") {
    return [
      `${info.source}: a still image, ${info.width} by ${info.height}, ${info.shape}, as it draws.`,
      `Lay it out at this shape. In a box of another shape use objectFit "cover" or "contain", never "fill".`,
    ];
  }
  const lines = [`${info.source}: ${clock(info.duration)} long.`];
  if (info.hasVideo) {
    lines.push(
      `Video: ${info.width} by ${info.height}${info.shape ? `, ${info.shape},` : ""} at ${info.fps} fps${info.rotation ? `, rotated ${info.rotation} degrees` : ""}, ${info.videoCodec ?? "unknown codec"}.`,
    );
  } else lines.push("No video track.");
  if (info.hasAudio) {
    const ch =
      info.channels === 1 ? "mono" : info.channels === 2 ? "stereo" : `${info.channels} channels`;
    lines.push(
      `Audio: ${info.audioCodec ?? "unknown codec"} at ${(info.sampleRate ?? 0) / 1000} kHz ${ch}.`,
    );
  } else lines.push("No audio track.");
  return lines;
}

export function runMediaInfo(ctx: RunContext, input: { source: string }): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const source = projectSource(root, ctx.cwd, input.source, ctx.door);
    const info = await cachedInfo(root, source);
    return done(info, describeInfo(info));
  });
}
