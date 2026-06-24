import { ALL_FORMATS, AudioBufferSink, Input, type InputAudioTrack, UrlSource } from "mediabunny";
import type { AudioSource, SeekMode } from "./audio-source.js";

/**
 * A preview {@link AudioSource} that also exposes a Mediabunny
 * {@link AudioBufferSink}. The {@link PreviewAudioDriver} owns the Web Audio
 * scheduling, so all it needs from the source is decoded buffers on demand — the
 * old self-playing `play()/pause()/seek()` surface is inert here.
 */
export interface SchedulableAudioSource extends AudioSource {
  /** Decoded-buffer sink for the primary audio track, or null until ready. */
  readonly sink: AudioBufferSink | null;
  /** Track start time in seconds (videos don't always start at 0). */
  readonly firstTimestamp: number;
}

export function isSchedulable(s: AudioSource): s is SchedulableAudioSource {
  return "sink" in s && (s as SchedulableAudioSource).sink !== undefined;
}

/**
 * Preview-mode {@link AudioSource} backed by Mediabunny + WebCodecs. Replaces the
 * `HTMLAudioElement`-based {@link BrowserAudioSource}: it only decodes — playback,
 * volume, mute and rate are driven by the {@link PreviewAudioDriver}'s Web Audio
 * scheduler, which reads {@link sink}.
 */
export class MediabunnyAudioSource implements SchedulableAudioSource {
  private _input: Input | null = null;
  private _track: InputAudioTrack | null = null;
  private _sink: AudioBufferSink | null = null;
  private _ready = false;
  private _disposed = false;
  private _duration = 0;
  private _firstTimestamp = 0;
  private readonly _readyCbs = new Set<() => void>();

  async load(src: string): Promise<void> {
    const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(src) });
    this._input = input;
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error(`[konva-motion] no audio track in: ${src}`);
    if (!(await track.canDecode())) {
      throw new Error(`[konva-motion] cannot decode audio track in: ${src}`);
    }
    if (this._disposed) return;

    this._track = track;
    this._duration = await track.computeDuration();
    this._firstTimestamp = await track.getFirstTimestamp();
    this._sink = new AudioBufferSink(track);
    this._ready = true;
    for (const cb of this._readyCbs) cb();
  }

  get sink(): AudioBufferSink | null {
    return this._sink;
  }

  get firstTimestamp(): number {
    return this._firstTimestamp;
  }

  get duration(): number {
    return this._duration;
  }

  get currentTime(): number {
    return 0;
  }

  get isReady(): boolean {
    return this._ready;
  }

  // Inert: the scheduler in PreviewAudioDriver drives playback off `sink`.
  seek(_timeSeconds: number, _mode?: SeekMode): Promise<void> {
    return Promise.resolve();
  }
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
  setMuted(_muted: boolean): void {}
  setVolume(_volume: number): void {}
  setPlaybackRate(_rate: number): void {}

  onReady(cb: () => void): () => void {
    if (this._ready) {
      cb();
      return () => {};
    }
    this._readyCbs.add(cb);
    return () => this._readyCbs.delete(cb);
  }

  destroy(): void {
    this._disposed = true;
    this._input?.dispose();
    this._input = null;
    this._track = null;
    this._sink = null;
    this._readyCbs.clear();
  }
}
