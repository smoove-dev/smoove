import type { Composition } from "../../engine/composition.js";

/**
 * Browser-only Web Audio bus, one per {@link Composition}. Owns the single
 * {@link AudioContext} every preview audio clip schedules against, plus a master
 * {@link GainNode} feeding the speakers. Created lazily on first use (so nothing
 * touches `AudioContext` in Node) and cached per composition.
 *
 * It deliberately knows nothing about clips or timing — the per-clip
 * {@link PreviewAudioDriver} owns the schedule-ahead pump and the timeline↔context
 * clock anchor. This just hands out a context, a channel gain, and `resume()`.
 */
export class SharedAudioContext {
  private _ctx: AudioContext | null = null;
  private _master: GainNode | null = null;

  /** The live context, created on first access. Null only if Web Audio is absent. */
  get context(): AudioContext | null {
    if (this._ctx) return this._ctx;
    const Ctor =
      typeof globalThis.AudioContext === "function"
        ? globalThis.AudioContext
        : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!Ctor) return null;
    this._ctx = new Ctor();
    this._master = this._ctx.createGain();
    this._master.connect(this._ctx.destination);
    return this._ctx;
  }

  /** Current context clock in seconds, or 0 if Web Audio is absent. */
  now(): number {
    return this.context?.currentTime ?? 0;
  }

  /**
   * Resume the context — `AudioContext` starts suspended until a user gesture.
   * Safe to call repeatedly; resolves once running (or immediately if no context).
   */
  async resume(): Promise<void> {
    const ctx = this.context;
    if (ctx && ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
  }

  /** A fresh per-clip {@link GainNode} wired into the master bus. */
  createChannelGain(): GainNode | null {
    const ctx = this.context;
    if (!ctx || !this._master) return null;
    const gain = ctx.createGain();
    gain.connect(this._master);
    return gain;
  }

  destroy(): void {
    void this._ctx?.close().catch(() => {});
    this._ctx = null;
    this._master = null;
  }
}

const perComposition = new WeakMap<Composition, SharedAudioContext>();

/** Lazily get (and cache) the {@link SharedAudioContext} for a composition. */
export function getSharedAudioContext(comp: Composition): SharedAudioContext {
  let shared = perComposition.get(comp);
  if (!shared) {
    shared = new SharedAudioContext();
    perComposition.set(comp, shared);
  }
  return shared;
}
