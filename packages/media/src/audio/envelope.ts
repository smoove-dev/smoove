/**
 * Frame-pure audio introspection: a clip's decoded loudness folded into a tiny
 * per-window RMS + peak table over **media-file seconds**. Built once, before
 * frame 0 (gated via the composition's asset/render gates), then read
 * synchronously by `Audio.rmsAt()`/`Audio.peakAt()` — audio-reactive visuals
 * get the real sound, deterministic under seek/scrub/server render.
 */

import {
  ALL_FORMATS,
  AudioSampleSink,
  FilePathSource,
  Input,
  type Source,
  UrlSource,
} from "mediabunny";
import { fft, nextPow2 } from "./fft.js";

/** A clip's decoded loudness envelope. Values are raw sample magnitudes, 0..1. */
export type AudioEnvelope = {
  /** Analysis windows per second of media time. */
  readonly windowHz: number;
  /** Per-window RMS of the mono-averaged signal. */
  readonly rms: Float32Array;
  /** Per-window absolute sample peak across all channels. */
  readonly peak: Float32Array;
  /** Media seconds covered by the table. */
  readonly duration: number;
  /** Source sample rate (Hz); 0 if nothing was decoded. */
  readonly sampleRate: number;
  /** Source channel count; 0 if nothing was decoded. */
  readonly channels: number;
  /** Loudest window's RMS — divide by this for a normalized meter. */
  readonly maxRms: number;
  /** Largest absolute sample. */
  readonly maxPeak: number;
  /** Per-window signed sample minimum (waveform bottom edge). */
  readonly wfMin: Float32Array;
  /** Per-window signed sample maximum (waveform top edge). */
  readonly wfMax: Float32Array;
  /** Number of spectral bands, when built with `{ bands }`. */
  readonly bandCount?: number;
  /** Per-window band magnitudes (0..~1), row-major `[window * bandCount + band]`. */
  readonly bands?: Float32Array;
  /** Per-window spectral-flux novelty, normalized 0..1 over the clip. */
  readonly novelty?: Float32Array;
};

export const DEFAULT_WINDOW_HZ = 100;

/**
 * Streaming accumulator: feed interleaved f32 PCM chunks (any order of
 * timestamps), then {@link finish} into an {@link AudioEnvelope}. Pure math —
 * no decode, no mediabunny — so it unit-tests without fixtures.
 */
export class EnvelopeBuilder {
  private readonly windowHz: number;
  private sumSq: Float64Array;
  private counts: Uint32Array;
  private peaks: Float32Array;
  private maxWindow = -1;

  // Spectral fold (only when `bands > 0`): the current window's mono samples,
  // FFT'd into a band row when the stream advances past the window.
  private readonly bandCount: number;
  private bandRows: Float32Array[] = [];
  private winSamples: number[] = [];
  private winIndex = -1;
  private sampleRateSeen = 0;
  private channelsSeen = 0;
  private mins: Float32Array;
  private maxs: Float32Array;

  constructor(windowHz: number, expectedDurationSeconds: number, opts?: { bands?: number }) {
    this.windowHz = windowHz;
    this.bandCount = opts?.bands ?? 0;
    const n = Math.max(1, Math.ceil(expectedDurationSeconds * windowHz) + 1);
    this.sumSq = new Float64Array(n);
    this.counts = new Uint32Array(n);
    this.peaks = new Float32Array(n);
    this.mins = new Float32Array(n);
    this.maxs = new Float32Array(n);
  }

  /** Fold one decoded chunk in. `data` is interleaved f32, `frames` frames of `channels`. */
  add(
    data: Float32Array,
    frames: number,
    channels: number,
    sampleRate: number,
    timestampSeconds: number,
  ): void {
    this.channelsSeen = channels;
    this.sampleRateSeen = sampleRate;
    for (let i = 0; i < frames; i++) {
      const w = Math.floor((timestampSeconds + i / sampleRate) * this.windowHz);
      if (w < 0) continue;
      this._ensure(w);
      const base = i * channels;
      let mono = 0;
      for (let c = 0; c < channels; c++) {
        const s = data[base + c] as number;
        const a = Math.abs(s);
        if (a > (this.peaks[w] as number)) this.peaks[w] = a;
        if (s < (this.mins[w] as number)) this.mins[w] = s;
        if (s > (this.maxs[w] as number)) this.maxs[w] = s;
        mono += s;
      }
      mono /= channels;
      this.sumSq[w] = (this.sumSq[w] as number) + mono * mono;
      this.counts[w] = (this.counts[w] as number) + 1;
      if (w > this.maxWindow) this.maxWindow = w;
      if (this.bandCount > 0) {
        if (w !== this.winIndex) {
          this._flushSpectral();
          this.winIndex = w;
        }
        this.winSamples.push(mono);
      }
    }
  }

  finish(): AudioEnvelope {
    const n = this.maxWindow + 1;
    const rms = new Float32Array(Math.max(0, n));
    const peak = this.peaks.slice(0, Math.max(0, n));
    const wfMin = this.mins.slice(0, Math.max(0, n));
    const wfMax = this.maxs.slice(0, Math.max(0, n));
    let maxRms = 0;
    let maxPeak = 0;
    for (let w = 0; w < n; w++) {
      const count = this.counts[w] as number;
      const r = count > 0 ? Math.sqrt((this.sumSq[w] as number) / count) : 0;
      rms[w] = r;
      if (r > maxRms) maxRms = r;
      if ((peak[w] as number) > maxPeak) maxPeak = peak[w] as number;
    }

    this._flushSpectral();
    let bands: Float32Array | undefined;
    let novelty: Float32Array | undefined;
    if (this.bandCount > 0) {
      while (this.bandRows.length < n) this.bandRows.push(new Float32Array(this.bandCount));
      bands = new Float32Array(n * this.bandCount);
      for (let w = 0; w < n; w++) bands.set(this.bandRows[w] as Float32Array, w * this.bandCount);
      // Spectral flux: positive band-energy increase vs the previous window,
      // normalized to the clip's own max so noveltyAt reads 0..1.
      novelty = new Float32Array(n);
      let maxFlux = 0;
      for (let w = 1; w < n; w++) {
        let flux = 0;
        for (let k = 0; k < this.bandCount; k++) {
          const d =
            (bands[w * this.bandCount + k] as number) -
            (bands[(w - 1) * this.bandCount + k] as number);
          if (d > 0) flux += d;
        }
        novelty[w] = flux;
        if (flux > maxFlux) maxFlux = flux;
      }
      if (maxFlux > 0) for (let w = 0; w < n; w++) novelty[w] = (novelty[w] as number) / maxFlux;
    }

    return {
      windowHz: this.windowHz,
      rms,
      peak,
      duration: n / this.windowHz,
      sampleRate: this.sampleRateSeen,
      channels: this.channelsSeen,
      maxRms,
      maxPeak,
      wfMin,
      wfMax,
      ...(bands ? { bandCount: this.bandCount, bands, novelty } : {}),
    };
  }

  /** FFT the collected window into log-spaced band magnitudes. */
  private _flushSpectral(): void {
    const w = this.winIndex;
    const samples = this.winSamples;
    this.winSamples = [];
    if (w < 0 || samples.length === 0 || this.sampleRateSeen === 0) return;
    const n = nextPow2(samples.length);
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let i = 0; i < samples.length; i++) {
      // Hann window against spectral leakage.
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1 || 1)));
      re[i] = (samples[i] as number) * hann;
    }
    fft(re, im);
    const row = new Float32Array(this.bandCount);
    const nyquist = this.sampleRateSeen / 2;
    const lo = 40;
    // Amplitude scale: /len undoes FFT gain, ×2 folds negative bins, ×2 undoes
    // the Hann window's coherent gain of 0.5.
    const scale = 4 / samples.length;
    for (let k = 1; k < n / 2; k++) {
      const freq = (k * this.sampleRateSeen) / n;
      if (freq < lo || freq > nyquist) continue;
      const band = Math.min(
        this.bandCount - 1,
        Math.floor((Math.log(freq / lo) / Math.log(nyquist / lo)) * this.bandCount),
      );
      const mag = Math.hypot(re[k] as number, im[k] as number) * scale;
      if (mag > (row[band] as number)) row[band] = mag;
    }
    while (this.bandRows.length < w) this.bandRows.push(new Float32Array(this.bandCount));
    this.bandRows[w] = row;
  }

  private _ensure(w: number): void {
    if (w < this.sumSq.length) return;
    let cap = this.sumSq.length;
    while (cap <= w) cap *= 2;
    const sumSq = new Float64Array(cap);
    sumSq.set(this.sumSq);
    this.sumSq = sumSq;
    const counts = new Uint32Array(cap);
    counts.set(this.counts);
    this.counts = counts;
    const peaks = new Float32Array(cap);
    peaks.set(this.peaks);
    this.peaks = peaks;
    const mins = new Float32Array(cap);
    mins.set(this.mins);
    this.mins = mins;
    const maxs = new Float32Array(cap);
    maxs.set(this.maxs);
    this.maxs = maxs;
  }
}

/** RMS at a media time, 0 outside the decoded range. */
export function envelopeRmsAt(env: AudioEnvelope, seconds: number): number {
  return windowValue(env.rms, env.windowHz, seconds);
}

/** Absolute peak at a media time, 0 outside the decoded range. */
export function envelopePeakAt(env: AudioEnvelope, seconds: number): number {
  return windowValue(env.peak, env.windowHz, seconds);
}

/** Band magnitudes at a media time. Empty array when bands weren't built; zeroed out of range. */
export function envelopeBandsAt(env: AudioEnvelope, seconds: number): Float32Array {
  const { bands, bandCount, windowHz } = env;
  if (!bands || !bandCount) return new Float32Array(0);
  const w = Math.floor(seconds * windowHz);
  if (w < 0 || (w + 1) * bandCount > bands.length) return new Float32Array(bandCount);
  return bands.slice(w * bandCount, (w + 1) * bandCount);
}

/** Normalized spectral-flux novelty (0..1) at a media time; 0 without bands. */
export function envelopeNoveltyAt(env: AudioEnvelope, seconds: number): number {
  return env.novelty ? windowValue(env.novelty, env.windowHz, seconds) : 0;
}

/**
 * Signed min/max waveform outline between two media times, resampled to
 * `buckets` columns — enough to draw a static waveform as a polygon or bars.
 */
export function envelopeWaveform(
  env: AudioEnvelope,
  startSeconds: number,
  endSeconds: number,
  buckets: number,
): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const span = Math.max(1e-9, endSeconds - startSeconds);
  for (let b = 0; b < buckets; b++) {
    const w0 = Math.floor((startSeconds + (b / buckets) * span) * env.windowHz);
    const w1 = Math.floor((startSeconds + ((b + 1) / buckets) * span) * env.windowHz);
    for (let w = w0; w <= w1; w++) {
      if (w < 0 || w >= env.wfMin.length) continue;
      if ((env.wfMin[w] as number) < (min[b] as number)) min[b] = env.wfMin[w] as number;
      if ((env.wfMax[w] as number) > (max[b] as number)) max[b] = env.wfMax[w] as number;
    }
  }
  return { min, max };
}

function windowValue(table: Float32Array, windowHz: number, seconds: number): number {
  const i = Math.floor(seconds * windowHz);
  return i >= 0 && i < table.length ? (table[i] as number) : 0;
}

/**
 * Mediabunny source for an envelope decode. Browser srcs are URLs; server
 * renders resolve Vite asset URLs to filesystem paths (the `mediaSrc` helper),
 * so anything that isn't `http(s)` is treated as a local path — mirrors the
 * renderer's `makeInputSource`.
 */
function makeEnvelopeSource(src: string): Source {
  if (/^https?:\/\//i.test(src)) return new UrlSource(src);
  if (src.startsWith("file://")) return new FilePathSource(new URL(src).pathname);
  // Root-relative/relative srcs: in a browser they're asset URLs (Vite serves
  // them; fetch resolves against the page), in Node they're local paths.
  if (typeof document !== "undefined") return new UrlSource(src);
  return new FilePathSource(src);
}

/**
 * Decode `src`'s primary audio track once and fold it into an
 * {@link AudioEnvelope}. Streams PCM through the {@link EnvelopeBuilder};
 * nothing but the windowed table is retained.
 */
export async function buildEnvelope(
  src: string,
  opts?: { windowHz?: number; bands?: number },
): Promise<AudioEnvelope> {
  const windowHz = opts?.windowHz ?? DEFAULT_WINDOW_HZ;
  const input = new Input({ formats: ALL_FORMATS, source: makeEnvelopeSource(src) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error(`[smoove] no audio track in: ${src}`);
    if (!(await track.canDecode())) {
      throw new Error(`[smoove] cannot decode audio track in: ${src}`);
    }
    const duration = await track.computeDuration();
    const builder = new EnvelopeBuilder(windowHz, duration, { bands: opts?.bands });
    const sink = new AudioSampleSink(track);
    for await (const s of sink.samples()) {
      const data = new Float32Array(s.allocationSize({ planeIndex: 0, format: "f32" }) / 4);
      s.copyTo(data, { planeIndex: 0, format: "f32" });
      builder.add(data, s.numberOfFrames, s.numberOfChannels, s.sampleRate, s.timestamp);
      s.close();
    }
    return builder.finish();
  } finally {
    input.dispose();
  }
}
