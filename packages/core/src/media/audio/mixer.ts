import { type ReadonlySignal, type Signal, createSignal } from "../../engine/signal.js";

/**
 * A registered audio source the mixer can re-apply. Implemented by {@link Video}.
 * The channel owns its intrinsic level; the mixer owns the master that scales it.
 */
export interface AudioChannel {
  /** Human label for mixer UIs. */
  readonly label: string;
  /** Intrinsic level, 0..1 — independent of the master. */
  readonly volume: ReadonlySignal<number>;
  readonly muted: ReadonlySignal<boolean>;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  /** @internal — mixer hands the channel its bus (or null on unregister). */
  _bindMixer(mixer: AudioMixer | null): void;
  /** @internal — mixer calls this when the master volume/mute changes. */
  _applyAudio(): void;
}

/**
 * Composition-level audio bus. Holds a master volume + mute that multiply into
 * every registered {@link AudioChannel}: a channel's effective output is
 * `master × channel.volume`, muted when `masterMuted || channel.muted`. The
 * mixer never touches a source directly — on any change it asks each channel to
 * re-apply its own audio.
 */
export class AudioMixer {
  /** Master level, 0..1. */
  readonly volume: ReadonlySignal<number>;
  readonly muted: ReadonlySignal<boolean>;

  private readonly _volume: Signal<number>;
  private readonly _muted: Signal<boolean>;
  private readonly _channels = new Set<AudioChannel>();

  constructor() {
    this._volume = createSignal(1);
    this._muted = createSignal(false);
    this.volume = this._volume;
    this.muted = this._muted;
  }

  setVolume(v: number): void {
    this._volume.set(Math.max(0, Math.min(1, v)));
    this._reapplyAll();
  }

  setMuted(m: boolean): void {
    this._muted.set(m);
    this._reapplyAll();
  }

  /** Register a channel. Idempotent — the Set dedupes by instance. */
  register(ch: AudioChannel): void {
    if (this._channels.has(ch)) return;
    this._channels.add(ch);
    ch._bindMixer(this);
  }

  unregister(ch: AudioChannel): void {
    if (!this._channels.delete(ch)) return;
    ch._bindMixer(null);
  }

  /** Snapshot of registered channels — for building per-track UIs. */
  get channels(): AudioChannel[] {
    return [...this._channels];
  }

  private _reapplyAll(): void {
    for (const c of this._channels) c._applyAudio();
  }
}
