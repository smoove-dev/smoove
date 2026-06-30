import type { AudioSource, AudioSourceFactory } from "@smoove/core";

/**
 * No-op {@link AudioSource} for server rendering. Audio is not decoded by the
 * node during frame rendering — `RenderingAudioDriver` only records timing/volume
 * metadata per frame (collected via `comp.getAudioAssets()`), which the
 * {@link mixAudio} pass later decodes (via Mediabunny) and mixes into the muxed
 * track. This source exists only so the `Audio` node can be constructed in Node
 * without touching `document`.
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
