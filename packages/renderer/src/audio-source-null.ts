import type { AudioSource, AudioSourceFactory } from "@konva-motion/core";

/**
 * No-op {@link AudioSource} for server rendering. Audio is never decoded during
 * an offline render — `RenderingAudioDriver` only records timing/volume metadata
 * per frame (collected via `comp.getAudioAssets()`), which an external ffmpeg
 * pass turns into the muxed track. This source exists only so the `Audio` node
 * can be constructed in Node without touching `document`.
 */
export class NullAudioSource implements AudioSource {
  readonly duration = 0;
  readonly currentTime = 0;
  readonly isReady = true;

  async load(): Promise<void> {}
  async seek(): Promise<void> {}
  async play(): Promise<void> {}
  pause(): void {}
  setMuted(): void {}
  setVolume(): void {}
  setPlaybackRate(): void {}
  onReady(): () => void {
    return () => {};
  }
  destroy(): void {}
}

export const nullAudioSourceFactory: AudioSourceFactory = () => new NullAudioSource();
