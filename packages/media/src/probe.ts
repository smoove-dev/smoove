import { ALL_FORMATS, Input } from "mediabunny";
import { makeInputSource } from "./input-source.js";

/** Container-level metadata for a media file, read without decoding frames. */
export type MediaMetadata = {
  /** Seconds, from container metadata (`Input.computeDuration`). */
  duration: number;
  /**
   * `floor(duration * fps)`: the clip's length as a frame count that never
   * outruns the media — feed it to a `Marker`/`plan()` step.
   */
  durationInFrames(fps: number): number;
  hasVideo: boolean;
  hasAudio: boolean;
  /** Display size of the primary video track. Present when {@link hasVideo}. */
  width?: number;
  height?: number;
  /** Primary audio track shape. Present when {@link hasAudio}. */
  sampleRate?: number;
  channels?: number;
};

const cache = new Map<string, Promise<MediaMetadata>>();

/**
 * Read a media file's container metadata (duration, track shape) without
 * decoding any frames — cheap enough to await at module top level, before
 * building a composition, so real clip lengths can drive the timeline plan:
 *
 * ```ts
 * const meta = await probeMedia(heroClip);
 * const { hero } = plan({ hero: { durationInFrames: meta.durationInFrames(fps) } });
 * ```
 *
 * Works on URLs in the browser and file paths in Node (same src handling as
 * `Audio`/`Video`). Results are memoized by `src`; failures are not cached.
 */
export function probeMedia(src: string): Promise<MediaMetadata> {
  let pending = cache.get(src);
  if (!pending) {
    pending = readMetadata(src);
    pending.catch(() => cache.delete(src));
    cache.set(src, pending);
  }
  return pending;
}

async function readMetadata(src: string): Promise<MediaMetadata> {
  const input = new Input({ formats: ALL_FORMATS, source: makeInputSource(src) });
  try {
    const [video, audio] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);
    if (!video && !audio) {
      throw new Error(`[smoove] probeMedia: no video or audio track in: ${src}`);
    }
    const duration = await input.computeDuration();
    return {
      duration,
      durationInFrames(fps: number): number {
        if (!Number.isFinite(fps) || fps <= 0) {
          throw new Error(`probeMedia: fps must be a positive number (got ${fps})`);
        }
        return Math.floor(duration * fps);
      },
      hasVideo: video !== null,
      hasAudio: audio !== null,
      width: video?.displayWidth,
      height: video?.displayHeight,
      sampleRate: audio?.sampleRate,
      channels: audio?.numberOfChannels,
    };
  } finally {
    input.dispose();
  }
}
