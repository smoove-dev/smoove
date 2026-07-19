import { getMediaTime } from "@smoove/core";
import type { AudioDriver, AudioDriverContext } from "./audio-driver.js";

/**
 * Deterministic, non-playing audio driver for offline rendering. The engine
 * captures canvas pixels frame-by-frame and has no in-engine audio encoder, so
 * decoding/playing audio during render buys nothing. Instead each tick records
 * an {@link AudioAsset} on the composition — the seam where a future ffmpeg
 * audio-mux pass reads `comp.getAudioAssets()` to assemble the audio track.
 */
export class RenderingAudioDriver implements AudioDriver {
  constructor(private readonly ctx: AudioDriverContext) {
    // Never audible during render.
    ctx.source.setMuted(true);
  }

  tick(localFrame: number): void {
    const { comp, timing } = this.ctx;
    const mediaTime = getMediaTime(localFrame, timing);
    comp._collectAudioAsset({
      id: this.ctx.id,
      src: this.ctx.src,
      frame: comp.frame.get(),
      mediaTime,
      volume: this.ctx.effectiveVolume(),
      muted: this.ctx.effectiveMuted(),
      playbackRate: timing.playbackRate,
    });
  }

  deactivate(): void {}

  dispose(): void {}
}
