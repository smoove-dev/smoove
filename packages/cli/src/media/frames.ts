/**
 * Frames of a source as RGBA at a chosen width, upright and in display
 * proportions, for contact sheets and picture analysis.
 */
import type { CanvasRenderingContext2D as SkiaContext } from "skia-canvas";
import { MediaError } from "./cache.js";
import { loadMedia, openInput } from "./runtime.js";

export interface Frame {
  /** The decoded frame's own time, which can differ a little from the time asked for. */
  time: number;
  /** The time asked for. A time with no frame is skipped, so label by this, not by position. */
  at: number;
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

/** The primary video track of an open input, or a `no-video-track` error. */
export async function videoTrack(input: Awaited<ReturnType<typeof openInput>>, source: string) {
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new MediaError("no-video-track", `${source} has no video track to look at.`);
  if (!(await track.canDecode())) {
    throw new MediaError(
      "unsupported-codec",
      `smoove can't decode the video in ${source} (${track.codec}).`,
    );
  }
  return track;
}

/** Decode `times` (sorted) and yield each frame scaled to `width`. */
export async function* framesAt(
  root: string,
  source: string,
  times: number[],
  width: number,
): AsyncGenerator<Frame> {
  const { mb, skia } = await loadMedia();
  const input = await openInput(root, source);
  try {
    const track = await videoTrack(input, source);
    const sink = new mb.VideoSampleSink(track);
    const height = Math.max(1, Math.round((width * track.displayHeight) / track.displayWidth));
    const out = new skia.Canvas(width, height);
    const g = out.getContext("2d") as SkiaContext;
    let coded: InstanceType<typeof skia.Canvas> | null = null;
    let pixels: InstanceType<typeof skia.ImageData> | null = null;
    let asked = -1;
    for await (const sample of sink.samplesAtTimestamps(times)) {
      asked++;
      if (!sample) continue;
      try {
        const cw = sample.codedWidth;
        const ch = sample.codedHeight;
        if (!coded || coded.width !== cw || coded.height !== ch) {
          coded = new skia.Canvas(cw, ch);
          pixels = new skia.ImageData(cw, ch);
        }
        await sample.copyTo((pixels as InstanceType<typeof skia.ImageData>).data, {
          format: "RGBA",
        });
        // skia-canvas records every call until a reset, and clearRect only adds
        // to the recording: without these, each frame costs more than the last.
        const cg = coded.getContext("2d");
        cg.reset();
        cg.putImageData(pixels as InstanceType<typeof skia.ImageData>, 0, 0);
        // Rotation is clockwise: turn the coded picture so it displays upright.
        const turn = sample.rotation;
        const sideways = turn === 90 || turn === 270;
        g.reset();
        g.translate(width / 2, height / 2);
        g.rotate((turn * Math.PI) / 180);
        const w = sideways ? height : width;
        const h = sideways ? width : height;
        g.drawImage(coded, -w / 2, -h / 2, w, h);
        yield {
          time: sample.timestamp,
          at: times[asked] as number,
          rgba: g.getImageData(0, 0, width, height).data,
          width,
          height,
        };
      } finally {
        sample.close();
      }
    }
  } finally {
    input.dispose();
  }
}

/** Each time snapped back to the keyframe at or before it, duplicates dropped. */
export async function keyframeTimes(
  root: string,
  source: string,
  times: number[],
): Promise<number[]> {
  const { mb } = await loadMedia();
  const input = await openInput(root, source);
  try {
    const packets = new mb.EncodedPacketSink(await videoTrack(input, source));
    const keys = new Set<number>();
    for (const t of times) {
      const key = await packets.getKeyPacket(t, { metadataOnly: true });
      keys.add(key ? key.timestamp : t);
    }
    return [...keys].sort((a, b) => a - b);
  } finally {
    input.dispose();
  }
}
