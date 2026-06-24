import type { WrappedAudioBuffer } from "mediabunny";
import type { MediaTiming } from "../media-time.js";
import { getMediaTime } from "../media-time.js";
import type { AudioDriver, AudioDriverContext } from "./audio-driver.js";
import { type SchedulableAudioSource, isSchedulable } from "./audio-source-mediabunny.js";
import { type SharedAudioContext, getSharedAudioContext } from "./shared-audio-context.js";

/** Keep roughly this many seconds of audio scheduled ahead of the context clock. */
const SCHEDULE_AHEAD = 1.0;
/** Decode this much lead-in before the start point so the decoder is primed. */
const PRIMING = 0.25;
/** Re-anchor (restart the pump) when the playhead diverges from the audio clock by more than this. */
const SEEK_THRESHOLD = 0.15;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Unwrapped media time (seconds) for a local frame — monotonic, ignores loop wrap. */
function unwrappedMedia(localFrame: number, timing: MediaTiming): number {
  return (timing.trimBefore + localFrame * timing.playbackRate) / timing.fps;
}

/** A decoded buffer tagged with the unwrapped media time its start corresponds to. */
type StreamItem = { buffer: AudioBuffer; startUnwrapped: number };

/**
 * Realtime preview driver for a **pull-based** audio source (Mediabunny +
 * WebCodecs). Nothing self-plays: while the composition is playing, a pump
 * decodes buffers from the source's {@link AudioBufferSink} and schedules them on
 * the shared {@link AudioContext}, anchoring the timeline clock to the context
 * clock so audio stays locked to the frame clock. Pausing or scrubbing stops the
 * pump (no audio while paused). A seek mid-playback re-anchors and reschedules.
 *
 * The clock works in **unwrapped** media time (monotonic, ignoring loop wrap), so
 * a looping clip schedules iteration after iteration seamlessly and seek
 * detection stays correct across the loop boundary.
 */
export class PreviewAudioDriver implements AudioDriver {
  private readonly _shared: SharedAudioContext;
  private _gain: GainNode | null = null;
  private readonly _nodes = new Set<AudioBufferSourceNode>();

  private _wasActive = false;
  private _lastLocalFrame = 0;

  // Pump identity (cancels a superseded pump) + the timeline↔context clock anchor.
  private _pumpToken: object | null = null;
  private _anchored = false;
  private _anchorCtxTime = 0;
  private _anchorUnwrapped = 0;
  private _effectiveRate = 1;

  private readonly _unsubs: Array<() => void> = [];

  constructor(private readonly ctx: AudioDriverContext) {
    this._shared = getSharedAudioContext(ctx.comp);
    this._unsubs.push(
      ctx.comp.isPlaying.subscribe((playing) => {
        if (playing) this._maybeStart(this._lastLocalFrame);
        else this._stop();
      }),
    );
    // A rate change re-anchors so the new speed takes effect from here on.
    this._unsubs.push(
      ctx.comp.playbackRate.subscribe(() => {
        if (ctx.comp.isPlaying.get()) this._maybeStart(this._lastLocalFrame);
      }),
    );
  }

  tick(localFrame: number): void {
    this._lastLocalFrame = localFrame;
    const { source, comp } = this.ctx;
    if (!source.isReady || !isSchedulable(source)) return;
    const wasActive = this._wasActive;
    this._wasActive = true;

    if (comp.isPlaying.get()) {
      this._applyGain();
      if (this._pumpToken === null || !wasActive || this._seekDetected(localFrame)) {
        this._startPump(source, localFrame);
      }
    } else {
      this._stop();
    }
  }

  deactivate(): void {
    this._wasActive = false;
    this._stop();
  }

  dispose(): void {
    for (const u of this._unsubs) u();
    this._unsubs.length = 0;
    this._stop();
    this._gain?.disconnect();
    this._gain = null;
  }

  private _maybeStart(localFrame: number): void {
    const { source } = this.ctx;
    if (this._wasActive && source.isReady && isSchedulable(source)) {
      this._startPump(source, localFrame);
    }
  }

  /** True if the audio clock has drifted from the playhead — i.e. a seek happened. */
  private _seekDetected(localFrame: number): boolean {
    if (!this._anchored) return false;
    const predicted =
      this._anchorUnwrapped + (this._shared.now() - this._anchorCtxTime) * this._effectiveRate;
    const actual = unwrappedMedia(localFrame, this.ctx.timing);
    return Math.abs(predicted - actual) > SEEK_THRESHOLD;
  }

  private _ensureGain(): GainNode | null {
    if (!this._gain) this._gain = this._shared.createChannelGain();
    return this._gain;
  }

  private _applyGain(): void {
    const gain = this._ensureGain();
    if (!gain) return;
    gain.gain.value = this.ctx.effectiveMuted() ? 0 : this.ctx.effectiveVolume();
  }

  private async _startPump(source: SchedulableAudioSource, fromLocalFrame: number): Promise<void> {
    const token = {};
    this._pumpToken = token;
    this._anchored = false;
    this._stopNodes();

    const sink = source.sink;
    if (!sink) return;
    await this._shared.resume();
    if (token !== this._pumpToken) return;
    const ac = this._shared.context;
    if (!ac) return;
    const gain = this._ensureGain();
    if (!gain) return;
    this._applyGain();

    const effRate = this.ctx.timing.playbackRate * this.ctx.comp.playbackRate.get();
    if (effRate <= 0) return; // reverse playback has no meaningful audio (documented)

    const anchorUnwrapped = unwrappedMedia(fromLocalFrame, this.ctx.timing);
    this._anchorCtxTime = ac.currentTime;
    this._anchorUnwrapped = anchorUnwrapped;
    this._effectiveRate = effRate;
    this._anchored = true;

    try {
      for await (const { buffer, startUnwrapped } of this._stream(sink, anchorUnwrapped)) {
        if (token !== this._pumpToken) break;

        const desiredUnwrapped = Math.max(startUnwrapped, anchorUnwrapped);
        let when = this._anchorCtxTime + (desiredUnwrapped - anchorUnwrapped) / effRate;

        // Throttle: stay ~SCHEDULE_AHEAD seconds ahead so we don't queue the file.
        while (when - ac.currentTime > SCHEDULE_AHEAD) {
          await sleep(120);
          if (token !== this._pumpToken) return;
        }

        let offset = desiredUnwrapped - startUnwrapped;
        if (when < ac.currentTime) {
          // Slightly late — start immediately and advance into the buffer.
          offset += (ac.currentTime - when) * effRate;
          when = ac.currentTime;
        }
        if (offset >= buffer.duration) continue; // fully behind the playhead — skip

        const node = ac.createBufferSource();
        node.buffer = buffer;
        node.playbackRate.value = effRate;
        node.connect(gain);
        node.onended = () => {
          this._nodes.delete(node);
          try {
            node.disconnect();
          } catch {}
        };
        node.start(when, offset);
        this._nodes.add(node);
      }
    } catch (err) {
      if (token === this._pumpToken) console.warn("[konva-motion] audio pump error:", err);
    }
  }

  /**
   * Decoded buffers tagged with unwrapped media time, from `anchorUnwrapped`
   * onward. Non-looping clips stream once to the trim end; looping clips replay
   * the `[trimBefore, trimAfter)` segment forever (offsetting each iteration), so
   * the consumer just keeps scheduling. Back-pressured by the consumer's awaits.
   */
  private async *_stream(
    sink: NonNullable<SchedulableAudioSource["sink"]>,
    anchorUnwrapped: number,
  ): AsyncGenerator<StreamItem, void, unknown> {
    const t = this.ctx.timing;
    const wrap = (item: WrappedAudioBuffer, startUnwrapped: number): StreamItem => ({
      buffer: item.buffer,
      startUnwrapped,
    });

    const loopLenFrames = t.trimAfter !== undefined ? t.trimAfter - t.trimBefore : 0;
    if (!t.loop || t.trimAfter === undefined || loopLenFrames <= 0) {
      // Single pass to the trim end (or natural end).
      const endMedia = t.trimAfter !== undefined ? t.trimAfter / t.fps : undefined;
      const start = Math.max(0, anchorUnwrapped - PRIMING);
      for await (const item of sink.buffers(start, endMedia)) {
        yield wrap(item, item.timestamp);
      }
      return;
    }

    // Looping: segment [segStart, segEnd) in source seconds.
    const segStart = t.trimBefore / t.fps;
    const segEnd = t.trimAfter / t.fps;
    const loopDur = segEnd - segStart;
    const kStart = Math.floor((anchorUnwrapped - segStart) / loopDur);
    const posInSeg = anchorUnwrapped - (segStart + kStart * loopDur);

    for (let k = kStart; ; k++) {
      const base = segStart + k * loopDur;
      const fetchFrom = k === kStart ? segStart + posInSeg : segStart;
      for await (const item of sink.buffers(Math.max(0, fetchFrom - PRIMING), segEnd)) {
        // unwrapped start of this buffer within iteration k
        yield wrap(item, base + (item.timestamp - segStart));
      }
    }
  }

  private _stop(): void {
    this._pumpToken = null;
    this._anchored = false;
    this._stopNodes();
  }

  private _stopNodes(): void {
    for (const node of this._nodes) {
      node.onended = null;
      try {
        node.stop();
      } catch {}
      try {
        node.disconnect();
      } catch {}
    }
    this._nodes.clear();
  }
}
