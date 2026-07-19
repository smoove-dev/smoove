# Audio Introspection (`rmsAt` / `peakAt` / `envelope`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Rotem's standing rule forbids subagent-driven execution — implement inline in the main session). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commits:** Each task ends with a `git commit` step as a natural boundary, but per repo convention ([[no-unrequested-commits]]) do **not** run it unless Rotem explicitly asks. Stage/verify and pause otherwise.

**Goal:** Expose an audio clip's real amplitude as a frame-pure signal on the `Audio` node — `audio.rmsAt(frame)`, `audio.peakAt(frame, { holdFrames })`, `audio.envelope` — so audio-reactive visuals (VU meters, waveforms, beat-sync) read the actual sound instead of volume automation, in both preview and server render.

**Architecture:** A new `envelope.ts` in `@smoove/media` decodes a clip **once, up front** with a mediabunny `AudioSampleSink` (its own `Input`, `UrlSource` in the browser / `FilePathSource` in Node) and folds the PCM stream into a tiny per-window RMS+peak table in **media-file seconds** at a fixed window rate. The `Audio` node starts the decode at construction when `introspect: true`, publishes it as a `ReadonlySignal<AudioEnvelope | null>`, and gates readiness through the composition's existing two gates (preview `registerAsset`, render `delayRender`/`continueRender`) so `setFrame(n) → rmsAt(n)` is synchronous and deterministic from frame 0. Frame → seconds mapping reuses `getMediaTime`, so trim/loop/playbackRate come for nothing.

**Tech Stack:** TypeScript, mediabunny (`AudioSampleSink`, `Input`, `UrlSource`/`FilePathSource`), Vitest (new to `@smoove/media`, mirroring `@smoove/code`), existing `@smoove/core` gates (`registerAsset`, `delayRender`).

---

## Feasibility (verified 2026-07-18)

- **Server decode is already proven in-repo:** `packages/renderer/src/audio-mix.ts` decodes entire clips in Node with `AudioSampleSink.samples(start, end)` + `s.copyTo(buf, { planeIndex: 0, format: "f32" })` (interleaved f32). Codecs come from `@mediabunny/server` (`registerMediabunnyServer()` = node-av → FFmpeg), registered **globally** by `setupServerRendering()` (`packages/renderer/src/media-server.ts`) — so any mediabunny decode in the same process works after renderer setup, including from `@smoove/media`.
- **Browser decode is already proven in-repo:** `MediabunnyAudioSource` builds an `AudioBufferSink` and the preview driver streams decoded buffers off it (`audio-for-preview.ts`). An `AudioSampleSink` over the same kind of `Input` works identically via WebCodecs.
- **Readiness gates already exist on `Composition`:** `registerAsset(promise)` (preview buffer state, the Font precedent — hides sequences until ready, defers `play()`) and `delayRender()`/`continueRender()` (render gate — `renderFrame()` awaits all handles). Both are public core API; no core changes needed.
- **Memory is a non-issue:** the envelope keeps 2 × `Float32Array` at 100 windows/sec (a 26 s clip ≈ 21 KB); PCM is streamed and discarded.

## Locked decisions

1. **Opt-in via `introspect: true`** on `AudioConfig`. Decoding a full clip costs real CPU (and a second fetch in the browser); don't tax every `Audio` for a feature most don't use. `rmsAt`/`peakAt` return `0` and `envelope` stays `null` when not enabled.
2. **The envelope decodes from its own mediabunny `Input`**, chosen by src shape (`https?://` → `UrlSource`, else `FilePathSource`, mirroring the renderer's `makeInputSource`). It does **not** reach into the node's `AudioSource`: on the server that source is `NullAudioSource` (no PCM), and in preview sharing the scheduler's live `AudioBufferSink` iterator is a concurrency risk. The extra browser fetch is absorbed by HTTP cache.
3. **Envelope domain = media-file seconds** at fixed `windowHz` (default 100, i.e. 10 ms meter windows). `rmsAt(localFrame)` maps frame → seconds via the existing `getMediaTime(localFrame, timing)`, so `trimBefore`/`trimAfter`/`loop`/`playbackRate` all behave correctly with zero new timing code. Out-of-range seconds (before 0 / past the decoded end) read as `0`.
4. **Gating hooks in at `_ensureDriver()`** (first tick, when the composition becomes reachable): preview → `comp.registerAsset(load)`, rendering → `comp.delayRender()` + `continueRender` on settle. Until the envelope resolves, `rmsAt`/`peakAt` return `0`.
5. **RMS is computed on the mono average** of channels (standard for meters); **peak is the true per-channel absolute peak** (mono-averaging would hide anti-phase content).
6. **`rmsAt`/`peakAt` are pre-fader**: they report the loudness of the *file*, not the mix. A post-fader meter is `audio.rmsAt(f) * effectiveGain` in userland (the kitchen-sink task shows exactly this). Master/bus meters on the mixer are **out of scope** (triage spec said "possibly"; YAGNI — derivable in userland).
7. **Amplitude values are raw sample magnitudes (0..1),** not normalized to the clip's own maximum. A quiet file reads quiet. Callers scale for display.
8. **Vitest lands in `@smoove/media`** with this feature (second Vitest package after `@smoove/code`, same zero-config setup): the windowing math is pure and the decode path is testable against a generated WAV (mediabunny decodes PCM/WAVE in pure JS, no WebCodecs or `@mediabunny/server` needed). Contingency: if `track.canDecode()` is ever false for WAVE in plain Node vitest, add `@mediabunny/server` as a media **devDependency** and register it in the test file — do not add it to `dependencies`.
9. **Spectral bands are opt-in via `introspect: { bands: N }`** and computed in the same decode pass: Hann window + an in-house ~50-line radix-2 FFT (no dependency; runs once per analysis window at build time, never per painted frame), bucketed into N log-spaced bands from 40 Hz to Nyquist (log spacing is how EQ displays read). Spectral flux between windows, normalized to the clip's own max, becomes `noveltyAt` for onset/beat-synced motion.
10. **The same pass also yields free extras** (Task 7): envelope metadata (`sampleRate`, `channels`), per-clip `maxRms`/`maxPeak` powering `{ normalized: true }` reads, and signed per-window min/max for static waveform drawing (`waveform(from, to, buckets)`). None of these add decode work.

## File map

**Create**
- `packages/media/src/audio/envelope.ts` — `AudioEnvelope` type, `EnvelopeBuilder` (pure windowing math incl. bands/waveform folds), `envelopeRmsAt`/`envelopePeakAt`/`envelopeBandsAt`/`envelopeNoveltyAt`/`envelopeWaveform` lookups, `buildEnvelope(src, opts)` decode driver, `makeEnvelopeSource` (URL vs file path).
- `packages/media/src/audio/envelope.test.ts` — unit tests for the pure math + a WAV-fixture integration test for `buildEnvelope`.
- `packages/media/src/audio/fft.ts` + `fft.test.ts` — minimal radix-2 FFT for the band fold.

**Modify**
- `packages/media/src/audio/types.ts` — `AudioConfig.introspect?: boolean`.
- `packages/media/src/audio/index.ts` — envelope signal + gate + `rmsAt`/`peakAt`; extract `_timing()` (dedupes `_ensureDriver`'s inline `MediaTiming`).
- `packages/media/src/index.ts` — export `type AudioEnvelope`.
- `packages/media/package.json` — `test`/`test:watch` scripts, `vitest` devDependency.
- `packages/kitchen-sink/src/compositions/audio-mixer/composition.ts` — meters driven by real `rmsAt` (× the existing gain), `introspect: true` on the three metered strips.
- `packages/renderer/examples/render-demo.ts` — `introspect: true` on the tone `Audio` + a printed/asserted mid-tone `rmsAt` (server-path smoke).
- `packages/docs/content/docs/audio.mdx` — "Read the sound" section.
- `skills/smoove-video/rules/media.md` (+ `.agents/skills/smoove-video/rules/media.md` mirror) — one rule entry for audio-reactive visuals.
- `.changeset/audio-introspection.md` — minor, `@smoove/media` only.

---

## Task 1: Vitest infra + envelope math (pure, TDD)

The windowing math is pure `Float32Array` folding — build it test-first. No mediabunny import in this task.

**Files:**
- Modify: `packages/media/package.json`
- Create: `packages/media/src/audio/envelope.test.ts`
- Create: `packages/media/src/audio/envelope.ts`

- [ ] **Step 1: Add Vitest to `@smoove/media`**

In `packages/media/package.json` add to `scripts` (after `clean`):

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

and add a `devDependencies` block (after `dependencies`):

```json
  "devDependencies": {
    "vitest": "^3.2.4"
  }
```

Run: `pnpm install`
Expected: vitest linked; no errors.

- [ ] **Step 2: Write the failing unit tests**

Create `packages/media/src/audio/envelope.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  EnvelopeBuilder,
  envelopePeakAt,
  envelopeRmsAt,
} from "./envelope.js";

/** Interleave per-channel generators into one Float32Array of `frames` frames. */
function gen(frames: number, channels: number, fn: (i: number, c: number) => number): Float32Array {
  const out = new Float32Array(frames * channels);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++) out[i * channels + c] = fn(i, c);
  return out;
}

describe("EnvelopeBuilder", () => {
  it("measures a constant mono signal exactly", () => {
    const b = new EnvelopeBuilder(100, 1);
    // 1s of constant 0.5 at 1000 Hz, mono, starting at t=0.
    b.add(gen(1000, 1, () => 0.5), 1000, 1, 1000, 0);
    const env = b.finish();
    expect(env.windowHz).toBe(100);
    expect(env.duration).toBeCloseTo(1, 1);
    expect(envelopeRmsAt(env, 0.5)).toBeCloseTo(0.5, 3);
    expect(envelopePeakAt(env, 0.5)).toBeCloseTo(0.5, 3);
  });

  it("measures a sine's RMS as amplitude / sqrt(2)", () => {
    const sr = 8000;
    const amp = 0.8;
    const b = new EnvelopeBuilder(100, 1);
    b.add(
      gen(sr, 1, (i) => amp * Math.sin((2 * Math.PI * 440 * i) / sr)),
      sr,
      1,
      sr,
      0,
    );
    const env = b.finish();
    expect(envelopeRmsAt(env, 0.5)).toBeCloseTo(amp / Math.SQRT2, 2);
    expect(envelopePeakAt(env, 0.5)).toBeCloseTo(amp, 2);
  });

  it("is silent where nothing was added, and 0 out of range", () => {
    const b = new EnvelopeBuilder(100, 2);
    // Half a second of 0.5 starting at t=1.0 — windows before that stay silent.
    b.add(gen(500, 1, () => 0.5), 500, 1, 1000, 1.0);
    const env = b.finish();
    expect(envelopeRmsAt(env, 0.5)).toBe(0);
    expect(envelopeRmsAt(env, 1.25)).toBeCloseTo(0.5, 3);
    expect(envelopeRmsAt(env, -1)).toBe(0);
    expect(envelopeRmsAt(env, 99)).toBe(0);
  });

  it("RMS mono-mixes channels but peak sees each channel", () => {
    const b = new EnvelopeBuilder(100, 1);
    // Anti-phase stereo: L = +0.5, R = -0.5 — mono mix cancels, peak doesn't.
    b.add(gen(1000, 2, (_i, c) => (c === 0 ? 0.5 : -0.5)), 1000, 2, 1000, 0);
    const env = b.finish();
    expect(envelopeRmsAt(env, 0.5)).toBeCloseTo(0, 3);
    expect(envelopePeakAt(env, 0.5)).toBeCloseTo(0.5, 3);
  });

  it("grows beyond the expected duration without losing samples", () => {
    const b = new EnvelopeBuilder(100, 0.1); // expect 0.1s, feed 1s
    b.add(gen(1000, 1, () => 0.25), 1000, 1, 1000, 0);
    const env = b.finish();
    expect(env.duration).toBeCloseTo(1, 1);
    expect(envelopeRmsAt(env, 0.9)).toBeCloseTo(0.25, 3);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @smoove/media test`
Expected: FAIL — `envelope.js` module not found.

- [ ] **Step 4: Implement the math**

Create `packages/media/src/audio/envelope.ts`:

```ts
/**
 * Frame-pure audio introspection: a clip's decoded loudness folded into a tiny
 * per-window RMS + peak table over **media-file seconds**. Built once, before
 * frame 0 (gated via the composition's asset/render gates), then read
 * synchronously by `Audio.rmsAt()`/`Audio.peakAt()` — audio-reactive visuals
 * get the real sound, deterministic under seek/scrub/server render.
 */

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

  constructor(windowHz: number, expectedDurationSeconds: number) {
    this.windowHz = windowHz;
    const n = Math.max(1, Math.ceil(expectedDurationSeconds * windowHz) + 1);
    this.sumSq = new Float64Array(n);
    this.counts = new Uint32Array(n);
    this.peaks = new Float32Array(n);
  }

  /** Fold one decoded chunk in. `data` is interleaved f32, `frames` frames of `channels`. */
  add(data: Float32Array, frames: number, channels: number, sampleRate: number, timestampSeconds: number): void {
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
        mono += s;
      }
      mono /= channels;
      this.sumSq[w] = (this.sumSq[w] as number) + mono * mono;
      this.counts[w] = (this.counts[w] as number) + 1;
      if (w > this.maxWindow) this.maxWindow = w;
    }
  }

  finish(): AudioEnvelope {
    const n = this.maxWindow + 1;
    const rms = new Float32Array(Math.max(0, n));
    const peak = this.peaks.slice(0, Math.max(0, n));
    for (let w = 0; w < n; w++) {
      const count = this.counts[w] as number;
      rms[w] = count > 0 ? Math.sqrt((this.sumSq[w] as number) / count) : 0;
    }
    return { windowHz: this.windowHz, rms, peak, duration: n / this.windowHz };
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

function windowValue(table: Float32Array, windowHz: number, seconds: number): number {
  const i = Math.floor(seconds * windowHz);
  return i >= 0 && i < table.length ? (table[i] as number) : 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @smoove/media test`
Expected: PASS (5 tests).

- [ ] **Step 6: Build + lint**

Run: `pnpm --filter @smoove/media build && npx biome check packages/media/src/audio/envelope.ts packages/media/src/audio/envelope.test.ts`
Expected: both clean. (If tsc complains that test files land in `dist`, add `"exclude": ["src/**/*.test.ts"]` to `packages/media/tsconfig.json` — mirror how `packages/code/tsconfig.json` handles its `*.test.ts` files; check that file for the exact shape.)

- [ ] **Step 7: Commit** (only if Rotem asks)

```bash
git add packages/media/package.json packages/media/tsconfig.json packages/media/src/audio/envelope.ts packages/media/src/audio/envelope.test.ts pnpm-lock.yaml
git commit -m "feat(media): envelope windowing math for audio introspection"
```

---

## Task 2: `buildEnvelope` — decode a clip into an envelope

Wire the builder to mediabunny, mirroring the decode loop the renderer already uses in `audio-mix.ts`. Integration-test against a generated PCM WAV (decodes in pure JS in Node — no WebCodecs, no `@mediabunny/server`).

**Files:**
- Modify: `packages/media/src/audio/envelope.ts` (append)
- Modify: `packages/media/src/audio/envelope.test.ts` (append)

- [ ] **Step 1: Write the failing integration test**

Append to `packages/media/src/audio/envelope.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEnvelope } from "./envelope.js";

/** 16-bit PCM mono WAV of a sine at `amp`, `secs` seconds, 44.1 kHz. */
function writeSineWav(path: string, amp: number, secs: number): void {
  const sr = 44100;
  const n = Math.round(sr * secs);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = amp * Math.sin((2 * Math.PI * 440 * i) / sr);
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
}

describe("buildEnvelope", () => {
  it("decodes a WAV into a correct envelope", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smoove-envelope-test-"));
    const wav = join(dir, "tone.wav");
    writeSineWav(wav, 0.6, 1);
    const env = await buildEnvelope(wav);
    expect(env.duration).toBeCloseTo(1, 1);
    expect(envelopeRmsAt(env, 0.5)).toBeCloseTo(0.6 / Math.SQRT2, 2);
    expect(envelopePeakAt(env, 0.5)).toBeCloseTo(0.6, 2);
    expect(envelopeRmsAt(env, 5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @smoove/media test`
Expected: FAIL — `buildEnvelope` not exported.

- [ ] **Step 3: Implement `buildEnvelope`**

Append to `packages/media/src/audio/envelope.ts` (and add the mediabunny import at the top of the file):

```ts
import {
  ALL_FORMATS,
  AudioSampleSink,
  FilePathSource,
  Input,
  type Source,
  UrlSource,
} from "mediabunny";
```

```ts
/**
 * Mediabunny source for an envelope decode. Browser srcs are URLs; server
 * renders resolve Vite asset URLs to filesystem paths (the `mediaSrc` helper),
 * so anything that isn't `http(s)` is treated as a local path — mirrors the
 * renderer's `makeInputSource`.
 */
function makeEnvelopeSource(src: string): Source {
  if (/^https?:\/\//i.test(src)) return new UrlSource(src);
  if (src.startsWith("file://")) return new FilePathSource(new URL(src).pathname);
  return new FilePathSource(src);
}

/**
 * Decode `src`'s primary audio track once and fold it into an
 * {@link AudioEnvelope}. Streams PCM through the {@link EnvelopeBuilder};
 * nothing but the windowed table is retained.
 */
export async function buildEnvelope(
  src: string,
  opts?: { windowHz?: number },
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
    const builder = new EnvelopeBuilder(windowHz, duration);
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @smoove/media test`
Expected: PASS (6 tests). If the WAV test fails with a cannot-decode error, apply the locked-decision contingency: add `"@mediabunny/server": "^1.49.0"` to media's **devDependencies**, and in the test file call `registerMediabunnyServer()` from a top-level `beforeAll`. Do not touch `dependencies`.

- [ ] **Step 5: Build + lint**

Run: `pnpm --filter @smoove/media build && npx biome check --write packages/media/src/audio`
Expected: clean.

- [ ] **Step 6: Commit** (only if Rotem asks)

```bash
git add packages/media/src/audio/envelope.ts packages/media/src/audio/envelope.test.ts packages/media/package.json pnpm-lock.yaml
git commit -m "feat(media): buildEnvelope decodes a clip into an RMS/peak table"
```

---

## Task 3: `Audio` node API — `introspect`, `envelope`, `rmsAt`, `peakAt`

Surface the envelope on the node with readiness gating. No new unit tests here (constructing `Audio` needs a live source factory + stage); Tasks 4–5 are the integration proof.

**Files:**
- Modify: `packages/media/src/audio/types.ts`
- Modify: `packages/media/src/audio/index.ts`
- Modify: `packages/media/src/index.ts`

- [ ] **Step 1: Add the config flag**

In `packages/media/src/audio/types.ts`, add to `AudioConfig` (alongside the other optional props):

```ts
  /**
   * Decode the clip's loudness envelope up front so `rmsAt`/`peakAt`/`envelope`
   * report the real sound. Pass an object to also compute spectral bands for
   * EQ-style visuals (`bandsAt`/`noveltyAt`). Costs one full audio decode
   * before frame 0 (and, in the browser, a second fetch of `src`); leave off
   * unless a visual reads it.
   */
  introspect?: boolean | { bands?: number; windowHz?: number };
```

- [ ] **Step 2: Wire the envelope into the `Audio` node**

In `packages/media/src/audio/index.ts`:

Add to the imports from `"@smoove/core"`: `getMediaTime` (value import; `MediaTiming` type is already imported). Add a local import:

```ts
import {
  type AudioEnvelope,
  buildEnvelope,
  envelopePeakAt,
  envelopeRmsAt,
} from "./envelope.js";
```

Add fields (near the other privates):

```ts
  /** Decoded loudness envelope — `null` until `introspect: true` finishes decoding. */
  readonly envelope: ReadonlySignal<AudioEnvelope | null>;
  private readonly _envelope: Signal<AudioEnvelope | null>;
  private _envelopeLoad: Promise<void> | null = null;
  private _envelopeGated = false;
```

In the constructor (after `this.muted = this._muted;`):

```ts
    this._envelope = createSignal<AudioEnvelope | null>(null);
    this.envelope = this._envelope;
    if (config.introspect) {
      const opts = config.introspect === true ? {} : config.introspect;
      this._envelopeLoad = buildEnvelope(config.src, opts)
        .then((env) => {
          this._envelope.set(env);
        })
        .catch((err: unknown) => {
          console.error("[smoove] Audio envelope decode failed:", err);
        });
    }
```

(`buildEnvelope`'s `opts` already accepts `{ windowHz }`; Task 6 extends it with `{ bands }` — the pass-through above needs no further change.)

Extract the timing object `_ensureDriver` builds inline into a reusable private (and have `_ensureDriver` call it — replace its `const timing: MediaTiming = { ... }` block with `const timing = this._timing(comp.fps);`):

```ts
  /** Resolved clip timing for a composition fps — shared by the driver and introspection. */
  private _timing(fps: number): MediaTiming {
    return {
      fps,
      trimBefore: this._trimBefore,
      trimAfter: this._trimAfter,
      loop: this._loop,
      playbackRate: this._playbackRate,
    };
  }
```

In `_ensureDriver`, right after the `comp.mixer.register(this);` line, add the readiness gate:

```ts
    // Envelope gate: block the first painted/rendered frame on the decode.
    // Preview uses the asset-buffer gate; render uses delayRender so
    // renderFrame() awaits it. Register once, on first driver resolution.
    if (this._envelopeLoad && !this._envelopeGated) {
      this._envelopeGated = true;
      if (getEnvironment(stage).isRendering) {
        const handle = comp.delayRender("audio-envelope");
        void this._envelopeLoad.finally(() => comp.continueRender(handle));
      } else {
        comp.registerAsset(this._envelopeLoad, "audio-envelope");
      }
    }
```

Add the public readers (after `setVolume`):

```ts
  /**
   * RMS loudness (0..1) of the clip's actual sound at a **local frame** (same
   * frame your sequence updater receives). Pre-fader: multiply by your
   * effective gain for a post-fader meter. Returns 0 until the envelope is
   * decoded (`introspect: true`) or when the frame maps outside the clip.
   */
  rmsAt(localFrame: number): number {
    const ctx = this._introspectionContext();
    if (!ctx) return 0;
    return envelopeRmsAt(ctx.env, getMediaTime(localFrame, ctx.timing));
  }

  /**
   * Absolute sample peak (0..1) at a local frame. `holdFrames` extends the
   * reading to the max over the trailing window — the classic meter hold bar.
   */
  peakAt(localFrame: number, opts?: { holdFrames?: number }): number {
    const ctx = this._introspectionContext();
    if (!ctx) return 0;
    const hold = Math.max(0, Math.floor(opts?.holdFrames ?? 0));
    let max = 0;
    for (let f = Math.max(0, localFrame - hold); f <= localFrame; f++) {
      const v = envelopePeakAt(ctx.env, getMediaTime(f, ctx.timing));
      if (v > max) max = v;
    }
    return max;
  }

  /** Envelope + timing, or null while unattached / not yet decoded. */
  private _introspectionContext(): { env: AudioEnvelope; timing: MediaTiming } | null {
    const env = this._envelope.get();
    if (!env) return null;
    const stage = this.getStage();
    const comp = stage ? getComposition(stage) : null;
    if (!comp) return null;
    return { env, timing: this._timing(comp.fps) };
  }
```

- [ ] **Step 3: Export the type from the barrel**

In `packages/media/src/index.ts`, add alongside the `AudioConfig` type export:

```ts
export type { AudioEnvelope } from "./audio/envelope.js";
```

- [ ] **Step 4: Build, test, lint**

Run: `pnpm --filter @smoove/media build && pnpm --filter @smoove/media test && npx biome check packages/media/src`
Expected: all pass. (`delayRender`/`continueRender`/`registerAsset` are existing public members of core's `Composition` — if tsc can't see them, core's build is stale: `pnpm --filter @smoove/core build` first.)

- [ ] **Step 5: Commit** (only if Rotem asks)

```bash
git add packages/media/src
git commit -m "feat(media): Audio.rmsAt/peakAt/envelope with introspect config"
```

---

## Task 4: Kitchen-sink mixer — real meters

The showcase pain this feature exists for: the mixer's meters currently show `intrinsic gain × master` (`composition.ts:233-237`) — automation, not sound. Drive them with `rmsAt` so the bars move with the music.

**Files:**
- Modify: `packages/kitchen-sink/src/compositions/audio-mixer/composition.ts`

- [ ] **Step 1: Enable introspection on the three metered strips**

Lines 68–76 — add `introspect: true` to the three metered `Audio` nodes (leave the two whooshes alone; nothing meters them):

```ts
const musicA = new Audio({ id: "music-a", name: "Music A", src: musicAUrl, introspect: true });
// ...
const musicB = new Audio({ id: "music-b", name: "Music B", src: musicBUrl, volume: 0, introspect: true });
// ...
const voice = new Audio({ id: "voice", name: "Voice", src: voiceUrl, volume: 0, introspect: true });
```

- [ ] **Step 2: Fold real loudness into the levels**

In the `render` closure, `rmsAt` takes each node's **local** frame (its sequence starts at `seqA: 0`, `seqB: XF_FROM`, `seqV: VO_FROM`). Replace the "Effective levels" block (lines ~233-237):

```ts
  // Effective levels = intrinsic × master (what you'd actually hear).
  const eA = (aOn ? iA : 0) * master * gate;
  const eB = (bOn ? iB : 0) * master * gate;
  const eV = (vOn ? iV : 0) * master * gate;
  const levels: Record<Strip["key"], number> = { A: eA, B: eB, V: eV };
```

with:

```ts
  // Effective gain = intrinsic × master; the meter shows gain × the clip's
  // real RMS loudness (rmsAt reads the decoded envelope at each node's
  // sequence-local frame). METER_GAIN rescales quiet program material so the
  // bars use the full strip.
  const METER_GAIN = 2.5;
  const gA = (aOn ? iA : 0) * master * gate;
  const gB = (bOn ? iB : 0) * master * gate;
  const gV = (vOn ? iV : 0) * master * gate;
  const eA = Math.min(1, gA * musicA.rmsAt(frame) * METER_GAIN);
  const eB = Math.min(1, gB * musicB.rmsAt(frame - XF_FROM) * METER_GAIN);
  const eV = Math.min(1, gV * voice.rmsAt(frame - VO_FROM) * METER_GAIN);
  const levels: Record<Strip["key"], number> = { A: eA, B: eB, V: eV };
```

(Everything downstream — strip widths, `pct` labels, the radial visualizer's `combined` — now breathes with the actual audio. Tune `METER_GAIN` by eye in Step 3 if the bars sit too low or clip; typical music RMS is well under 0.5.)

- [ ] **Step 3: Verify in the browser**

Start the kitchen-sink dev server (launch config `kitchen-sink`, port 5190) and open `/c/audio-mixer`. Because the preview pane has no rAF, drive frames directly (browser JS console pattern):

```js
const c = window.Konva.stages.find(s => typeof s.setFrame === 'function');
await c.setFrame(300); // mid-song
```

Expected: meter bars sit at a level that visibly differs from the volume-automation curve and *changes* between nearby frames (e.g. compare `setFrame(300)` vs `setFrame(310)` — automation is flat there, real RMS is not). Console shows no `[smoove] Audio envelope decode failed`. First paint waits for the buffer gate (stage briefly transparent, then paints).

- [ ] **Step 4: Commit** (only if Rotem asks)

```bash
git add packages/kitchen-sink/src/compositions/audio-mixer/composition.ts
git commit -m "feat(kitchen-sink): drive mixer meters from real audio RMS"
```

---

## Task 5: Server-path smoke in the renderer example

Prove frame-purity on the render path: envelope decoded before frame 0 (via the `delayRender` gate), `rmsAt` readable inside a render.

**Files:**
- Modify: `packages/renderer/examples/render-demo.ts`

- [ ] **Step 1: Introspect the tone and assert its RMS**

In `packages/renderer/examples/render-demo.ts`, the demo synthesizes a 2 s sine WAV at amplitude ~0.25 (check the `amp` constant in the WAV-writer block; if it writes `0.25 * Math.sin(...)`, expected RMS is `0.25 / Math.SQRT2 ≈ 0.177`). Add `introspect: true` where the `Audio` is constructed:

```ts
const audio = new Audio({ src: audioPath, introspect: true });
```

(match the actual variable name in the file), and after the `renderComposition` call add:

```ts
// Audio introspection smoke: the envelope must be decoded (delayRender gate)
// and frame-pure — mid-tone RMS of a sine at amplitude A is A/sqrt(2).
const rms = audio.rmsAt(30);
console.log("rmsAt(30):", rms.toFixed(3));
if (rms < 0.05) throw new Error(`introspection failed: rmsAt(30) = ${rms}`);
```

- [ ] **Step 2: Run both renderer examples**

Run: `pnpm --filter @smoove/renderer example`
Expected: completes as before (mp4 with audio + still), plus a plausible `rmsAt(30): 0.1xx` line, no throw. The envelope decode runs through `FilePathSource` + the node-av codecs `setupServerRendering()` registered.

Run: `pnpm --filter @smoove/renderer example:mixer`
Expected: unchanged (that example does not use `introspect`), still produces the mp4 with audio.

- [ ] **Step 3: Commit** (only if Rotem asks)

```bash
git add packages/renderer/examples/render-demo.ts
git commit -m "test(renderer): audio introspection smoke in render-demo"
```

---

## Task 6: Spectral bands + novelty (`bandsAt`, `noveltyAt`) — the visual-EQ layer

Same decode pass, one extra fold: when `introspect: { bands: N }`, run a Hann-windowed FFT per analysis window and bucket bin magnitudes into N log-spaced bands (40 Hz → Nyquist, matching how EQ displays are drawn). Spectral flux between consecutive windows becomes a normalized novelty curve for beat-ish syncing. TDD on the FFT and the band fold.

**Files:**
- Create: `packages/media/src/audio/fft.ts`
- Create: `packages/media/src/audio/fft.test.ts`
- Modify: `packages/media/src/audio/envelope.ts`, `envelope.test.ts`
- Modify: `packages/media/src/audio/index.ts`
- Modify: `packages/media/src/index.ts` (no new exports needed — `AudioEnvelope` grows optional fields)

- [ ] **Step 1: Write the failing FFT test**

Create `packages/media/src/audio/fft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fft } from "./fft.js";

describe("fft", () => {
  it("finds a pure tone in the right bin", () => {
    const n = 512;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    // 16 full cycles over n samples → energy in bin 16.
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 16 * i) / n);
    fft(re, im);
    const mag = (k: number) =>
      Math.hypot(re[k] as number, im[k] as number);
    let best = 0;
    for (let k = 1; k < n / 2; k++) if (mag(k) > mag(best)) best = k;
    expect(best).toBe(16);
    // Amplitude-1 sine → |X[k]| ≈ n/2 at the tone bin.
    expect(mag(16)).toBeCloseTo(n / 2, -1);
  });

  it("transforms silence to silence", () => {
    const re = new Float32Array(64);
    const im = new Float32Array(64);
    fft(re, im);
    expect(Math.max(...re, ...im)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @smoove/media test`
Expected: FAIL — `fft.js` not found.

- [ ] **Step 3: Implement the FFT**

Create `packages/media/src/audio/fft.ts`:

```ts
/**
 * Minimal iterative radix-2 Cooley-Tukey FFT, in place over parallel
 * real/imaginary arrays. Length must be a power of two. ~50 lines beats a
 * dependency: this runs once per analysis window at envelope-build time, never
 * per painted frame.
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i] as number;
      re[i] = re[j] as number;
      re[j] = tr;
      const ti = im[i] as number;
      im[i] = im[j] as number;
      im[j] = ti;
    }
  }
  // Butterflies.
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const ar = re[i + k] as number;
        const ai = im[i + k] as number;
        const xr = re[i + k + half] as number;
        const xi = im[i + k + half] as number;
        const br = xr * cr - xi * ci;
        const bi = xr * ci + xi * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + half] = ar - br;
        im[i + k + half] = ai - bi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/** Smallest power of two ≥ `n`. */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
```

- [ ] **Step 4: Run to verify FFT tests pass**

Run: `pnpm --filter @smoove/media test`
Expected: PASS.

- [ ] **Step 5: Write the failing band-fold tests**

Append to `packages/media/src/audio/envelope.test.ts`:

```ts
describe("spectral bands", () => {
  it("concentrates a pure tone into one band and is quiet elsewhere", () => {
    const sr = 8000;
    const b = new EnvelopeBuilder(100, 1, { bands: 16 });
    b.add(
      gen(sr, 1, (i) => 0.8 * Math.sin((2 * Math.PI * 440 * i) / sr)),
      sr,
      1,
      sr,
      0,
    );
    const env = b.finish();
    expect(env.bandCount).toBe(16);
    const bands = envelopeBandsAt(env, 0.5);
    expect(bands.length).toBe(16);
    const top = bands.indexOf(Math.max(...bands));
    // 440 Hz sits in the log-spaced band whose range contains it; dominance is
    // the invariant (exact index depends on edges).
    const rest = [...bands].filter((_, i) => i !== top);
    expect(Math.max(...bands)).toBeGreaterThan(0.2);
    expect(Math.max(...rest)).toBeLessThan(Math.max(...bands) * 0.5);
  });

  it("novelty spikes at an onset and is flat in steady state", () => {
    const sr = 8000;
    const b = new EnvelopeBuilder(100, 1, { bands: 8 });
    // 0.5s silence, then a tone: flux must spike near t=0.5.
    b.add(
      gen(sr, 1, (i) =>
        i < sr / 2 ? 0 : 0.8 * Math.sin((2 * Math.PI * 440 * i) / sr),
      ),
      sr,
      1,
      sr,
      0,
    );
    const env = b.finish();
    expect(envelopeNoveltyAt(env, 0.5)).toBeGreaterThan(0.8); // the onset
    expect(envelopeNoveltyAt(env, 0.8)).toBeLessThan(0.3); // steady tone
    expect(envelopeNoveltyAt(env, 0.2)).toBeLessThan(0.05); // silence
  });
});
```

Add `envelopeBandsAt` and `envelopeNoveltyAt` to the test file's import from `./envelope.js`.

- [ ] **Step 6: Run to verify they fail**

Run: `pnpm --filter @smoove/media test`
Expected: FAIL — builder takes no third argument; `envelopeBandsAt` missing.

- [ ] **Step 7: Extend the builder and envelope**

In `packages/media/src/audio/envelope.ts`:

Add to the top: `import { fft, nextPow2 } from "./fft.js";`

Extend `AudioEnvelope` with optional spectral fields:

```ts
  /** Number of spectral bands, when built with `{ bands }`. */
  readonly bandCount?: number;
  /** Per-window band magnitudes (0..~1), row-major `[window * bandCount + band]`. */
  readonly bands?: Float32Array;
  /** Per-window spectral-flux novelty, normalized 0..1 over the clip. */
  readonly novelty?: Float32Array;
```

Extend `EnvelopeBuilder`: constructor takes `opts?: { bands?: number }`; while streaming it collects the current window's mono samples and, on window advance, FFTs the completed window into band magnitudes.

```ts
  private readonly bandCount: number;
  private bandRows: Float32Array[] = [];
  private winSamples: number[] = [];
  private winIndex = -1;
  private sampleRateSeen = 0;
```

In the constructor: `this.bandCount = opts?.bands ?? 0;`

In `add()`, after computing `mono` (inside the per-frame loop), fold the spectral stream — insert:

```ts
      if (this.bandCount > 0) {
        if (w !== this.winIndex) {
          this._flushSpectral();
          this.winIndex = w;
        }
        this.sampleRateSeen = sampleRate;
        this.winSamples.push(mono);
      }
```

Add the private flush + band mapping:

```ts
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
```

In `finish()`, before building the return object, flush the tail and derive novelty:

```ts
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
```

and include them in the returned object: `{ windowHz: this.windowHz, rms, peak, duration: n / this.windowHz, ...(bands ? { bandCount: this.bandCount, bands, novelty } : {}) }`.

Add the lookups:

```ts
/** Band magnitudes at a media time. Empty array when bands weren't built or out of range. */
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
```

Thread `bands` through `buildEnvelope`: signature becomes `opts?: { windowHz?: number; bands?: number }` and the builder construction becomes `new EnvelopeBuilder(windowHz, duration, { bands: opts?.bands })`.

- [ ] **Step 8: Run to verify all tests pass**

Run: `pnpm --filter @smoove/media test`
Expected: PASS (all suites).

- [ ] **Step 9: Node API — `bandsAt` and `noveltyAt`**

In `packages/media/src/audio/index.ts`, extend the envelope import with `envelopeBandsAt, envelopeNoveltyAt` and add after `peakAt`:

```ts
  /**
   * Spectral band magnitudes (log-spaced, 40 Hz → Nyquist) at a local frame —
   * the data behind an EQ/spectrum visual. Requires `introspect: { bands: N }`;
   * returns an empty array otherwise, a zeroed array out of range.
   */
  bandsAt(localFrame: number): Float32Array {
    const ctx = this._introspectionContext();
    if (!ctx) return new Float32Array(0);
    return envelopeBandsAt(ctx.env, getMediaTime(localFrame, ctx.timing));
  }

  /**
   * Spectral-flux novelty (0..1, normalized over the clip) at a local frame —
   * spikes on onsets, useful for beat-synced motion. Requires bands.
   */
  noveltyAt(localFrame: number): number {
    const ctx = this._introspectionContext();
    if (!ctx) return 0;
    return envelopeNoveltyAt(ctx.env, getMediaTime(localFrame, ctx.timing));
  }
```

- [ ] **Step 10: Kitchen-sink — radial spectrum**

Upgrade the mixer's radial visualizer from loudness-modulated noise to a real spectrum. In `packages/kitchen-sink/src/compositions/audio-mixer/composition.ts`:

Change the two music nodes to build bands (voice stays rms-only):

```ts
const musicA = new Audio({ id: "music-a", name: "Music A", src: musicAUrl, introspect: { bands: 24 } });
const musicB = new Audio({ id: "music-b", name: "Music B", src: musicBUrl, volume: 0, introspect: { bands: 24 } });
```

In the `render` closure, before the bars loop:

```ts
  const bandsA = musicA.bandsAt(frame);
  const bandsB = musicB.bandsAt(frame - XF_FROM);
  const N_BANDS = 24;
```

and inside the bars loop replace the `osc`/`len` pair:

```ts
    const osc = 0.32 + 0.68 * Math.abs(Math.sin(frame * 0.22 + i * 0.55));
    const len = 14 + 120 * combined * osc * pulse;
```

with:

```ts
    // Mirror the spectrum around the circle: bar i reads a log-spaced band.
    const k = Math.floor((Math.min(i, N - i) / (N / 2)) * (N_BANDS - 1));
    const band = Math.max(gA * ((bandsA[k] ?? 0) as number), gB * ((bandsB[k] ?? 0) as number));
    const len = 14 + 150 * Math.min(1, band * 2.5 + eV * 0.3) * pulse;
```

Verify in the browser (same `setFrame` technique as Task 4 Step 3): bars now form a spectrum shape that differs frame to frame and between bass-heavy and treble-heavy moments, instead of uniform sine wobble.

- [ ] **Step 11: Build, full test, lint**

Run: `pnpm --filter @smoove/media build && pnpm --filter @smoove/media test && npx biome check --write packages/media/src packages/kitchen-sink/src/compositions/audio-mixer`
Expected: green.

- [ ] **Step 12: Commit** (only if Rotem asks)

```bash
git add packages/media/src packages/kitchen-sink/src/compositions/audio-mixer/composition.ts
git commit -m "feat(media): spectral bands + novelty (bandsAt/noveltyAt) for EQ visuals"
```

---

## Task 7: Free extras from the same pass — metadata, normalized reads, waveform shape

Everything here reads data the decode already touches; no new decode, negligible memory.

**Files:**
- Modify: `packages/media/src/audio/envelope.ts`, `envelope.test.ts`
- Modify: `packages/media/src/audio/index.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/media/src/audio/envelope.test.ts`:

```ts
describe("extras", () => {
  it("records metadata and per-clip maxima", () => {
    const b = new EnvelopeBuilder(100, 1);
    b.add(gen(1000, 2, () => 0.4), 1000, 2, 1000, 0);
    const env = b.finish();
    expect(env.sampleRate).toBe(1000);
    expect(env.channels).toBe(2);
    expect(env.maxRms).toBeCloseTo(0.4, 3);
    expect(env.maxPeak).toBeCloseTo(0.4, 3);
  });

  it("tracks signed waveform min/max per window", () => {
    const b = new EnvelopeBuilder(100, 1);
    // Asymmetric signal: rides between -0.2 and +0.8.
    b.add(gen(1000, 1, (i) => (i % 2 === 0 ? 0.8 : -0.2)), 1000, 1, 1000, 0);
    const env = b.finish();
    const wf = envelopeWaveform(env, 0, 1, 10);
    expect(wf.max[5]).toBeCloseTo(0.8, 2);
    expect(wf.min[5]).toBeCloseTo(-0.2, 2);
  });
});
```

Add `envelopeWaveform` to the imports.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @smoove/media test`
Expected: FAIL — missing fields/exports.

- [ ] **Step 3: Implement**

In `packages/media/src/audio/envelope.ts`:

Extend `AudioEnvelope`:

```ts
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
```

In `EnvelopeBuilder`: add `private mins: Float32Array; private maxs: Float32Array; private channelsSeen = 0;` — allocate both in the constructor alongside `peaks`, grow them in `_ensure()` the same way. In `add()` record `this.channelsSeen = channels; this.sampleRateSeen = sampleRate;` (the field exists since Task 6) and inside the per-channel loop:

```ts
        if (s < (this.mins[w] as number)) this.mins[w] = s;
        if (s > (this.maxs[w] as number)) this.maxs[w] = s;
```

In `finish()`: compute `maxRms`/`maxPeak` while filling `rms`, slice `wfMin = this.mins.slice(0, n)` / `wfMax = this.maxs.slice(0, n)`, and add `sampleRate: this.sampleRateSeen, channels: this.channelsSeen, maxRms, maxPeak, wfMin, wfMax` to the returned object. (Task 1/2's earlier return-object snippets predate these fields — this step supersedes them.)

Add the waveform resampler:

```ts
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
```

In `packages/media/src/audio/index.ts`:

Give `rmsAt`/`peakAt` a normalized read (both signatures gain the option; `rmsAt` shown):

```ts
  rmsAt(localFrame: number, opts?: { normalized?: boolean }): number {
    const ctx = this._introspectionContext();
    if (!ctx) return 0;
    const v = envelopeRmsAt(ctx.env, getMediaTime(localFrame, ctx.timing));
    return opts?.normalized && ctx.env.maxRms > 0 ? v / ctx.env.maxRms : v;
  }
```

(`peakAt` divides its held maximum by `ctx.env.maxPeak` the same way.) Add the waveform accessor:

```ts
  /**
   * Static waveform outline (signed min/max per column) for the clip span
   * between two local frames — draw it once, it never changes with playback.
   */
  waveform(fromFrame: number, toFrame: number, buckets: number): { min: Float32Array; max: Float32Array } {
    const ctx = this._introspectionContext();
    if (!ctx) return { min: new Float32Array(buckets), max: new Float32Array(buckets) };
    return envelopeWaveform(
      ctx.env,
      getMediaTime(fromFrame, ctx.timing),
      getMediaTime(toFrame, ctx.timing),
      buckets,
    );
  }
```

- [ ] **Step 4: Run to verify everything passes**

Run: `pnpm --filter @smoove/media test && pnpm --filter @smoove/media build && npx biome check --write packages/media/src`
Expected: green. Then re-run the Task 5 renderer smoke unchanged (`pnpm --filter @smoove/renderer example`) — still green.

- [ ] **Step 5: With `METER_GAIN` now obsolete, simplify the kitchen-sink meters**

In the Task 4 levels block, replace the `* METER_GAIN` scaling with normalized reads and delete the constant:

```ts
  const eA = Math.min(1, gA * musicA.rmsAt(frame, { normalized: true }));
  const eB = Math.min(1, gB * musicB.rmsAt(frame - XF_FROM, { normalized: true }));
  const eV = Math.min(1, gV * voice.rmsAt(frame - VO_FROM, { normalized: true }));
```

- [ ] **Step 6: Commit** (only if Rotem asks)

```bash
git add packages/media/src packages/kitchen-sink/src/compositions/audio-mixer/composition.ts
git commit -m "feat(media): envelope metadata, normalized reads, waveform outline"
```

---

## Task 8: Docs, skill rule, changeset

**Files:**
- Modify: `packages/docs/content/docs/audio.mdx`
- Modify: `skills/smoove-video/rules/media.md` (+ `.agents/skills/smoove-video/rules/media.md` mirror)
- Create: `.changeset/audio-introspection.md`

- [ ] **Step 1: Docs section**

In `packages/docs/content/docs/audio.mdx`, add a section before "The master mixer" (write it in the smoove voice — no em dashes, code first):

````markdown
## Read the sound

Volume automation is the level you set. Sometimes a visual needs the level of
the sound itself: a VU meter, a waveform, motion that lands on the beat. Pass
`introspect: true` and the clip's loudness becomes a frame-pure signal.

```ts
const music = new Audio({ src: musicUrl, introspect: true });

seq.register((f) => {
  meter.width(300 * music.rmsAt(f));                      // real loudness, 0..1
  holdTick.x(300 * music.peakAt(f, { holdFrames: 18 }));  // decaying peak hold
});
```

`rmsAt(f)` and `peakAt(f)` take the same local frame your updater receives and
respect `trim`, `loop`, and `playbackRate`. They read a small envelope decoded
once before frame 0, so scrubbing and server renders see identical values. The
readings are pre-fader (the file's own loudness): multiply by your gain for a
post-fader meter, or pass `{ normalized: true }` to scale against the clip's
own loudest moment. Both return 0 until the envelope is ready, and `introspect`
costs one extra decode of the clip, so enable it only where a visual reads it.

For a spectrum, ask for bands:

```ts
const music = new Audio({ src: musicUrl, introspect: { bands: 24 } });

seq.register((f) => {
  const bands = music.bandsAt(f);          // 24 log-spaced magnitudes, bass → treble
  bands.forEach((v, k) => eqBars[k].height(200 * v));
  if (music.noveltyAt(f) > 0.7) kick();    // onset spike → beat-synced motion
});
```

`waveform(fromFrame, toFrame, buckets)` returns the clip's static min/max
outline for drawing a waveform, and the raw table is on `audio.envelope` if you
want to build something else from it.
````

- [ ] **Step 2: Skill rule**

In `skills/smoove-video/rules/media.md` under the Audio section, add (and mirror the identical edit in `.agents/skills/smoove-video/rules/media.md`):

```markdown
- Audio-reactive visuals: construct the node with `introspect: true`, then read
  `audio.rmsAt(f)` / `audio.peakAt(f, { holdFrames })` in the updater (`f` is
  the sequence-local frame). Never fake meters from volume automation.
```

- [ ] **Step 3: Changeset**

Create `.changeset/audio-introspection.md`:

```markdown
---
"@smoove/media": minor
---

Audio introspection: pass `introspect: true` (or `{ bands: N }`) to `Audio` and
read the clip's real sound as frame-pure signals — `rmsAt(frame)` /
`peakAt(frame, { holdFrames })` for loudness (with a `{ normalized: true }`
option), `bandsAt(frame)` / `noveltyAt(frame)` for spectrum and onsets,
`waveform(from, to, buckets)` for a static outline, and the raw table on the
`audio.envelope` signal (exported as `AudioEnvelope`). Everything is decoded
once before frame 0 in both preview and server renders, so audio-reactive
visuals (meters, EQ bars, waveforms, beat-synced motion) scrub and render
deterministically.
```

- [ ] **Step 4: Docs render check**

Start the docs dev server (launch config `docs`, port 5176) and open `/docs/audio`. Expected: the new "Read the sound" section renders, appears in the on-page TOC, code block intact.

- [ ] **Step 5: Full-repo gate**

Run: `pnpm -r build && pnpm check && pnpm --filter @smoove/media test`
Expected: all green.

- [ ] **Step 6: Commit** (only if Rotem asks)

```bash
git add packages/docs/content/docs/audio.mdx skills/smoove-video/rules/media.md .agents/skills/smoove-video/rules/media.md .changeset/audio-introspection.md
git commit -m "docs(media): audio introspection docs, skill rule, changeset"
```

---

## Cross-cutting notes

- **Why not reuse the preview source's `AudioBufferSink`:** it is live scheduler state; a second concurrent iterator over it is unproven, and the server has no sink at all. One decode path (own `Input`) serves both environments; the browser's duplicate fetch hits HTTP cache.
- **Suspend/resume:** `_kmSuspend` drops the `AudioSource`, not the envelope — the table is ~20 KB and stays valid, so `rmsAt` keeps working across suspend cycles and nothing re-decodes on resume.
- **`loop` + `peakAt` hold:** the hold window iterates local frames through `getMediaTime`, so a hold spanning a loop seam correctly reads the end of one pass and the start of the next.
- **Renderer stays untouched in `src/`** — the gate rides the existing `delayRender` contract; `audio-mix.ts` and friends don't know introspection exists.
- **Follow-ups explicitly out of scope:** mixer/master-bus meters (derivable in userland), tempo/BPM estimation and a discrete beat grid (`noveltyAt` gives the raw onset signal; grid inference is a rabbit hole), per-channel envelopes, LUFS-style loudness standards, envelope caching across `Audio` instances sharing one `src`.

## Self-review

- **Spec coverage (triage §1 / the API sketch):** `rmsAt` (Task 3), `peakAt` with `holdFrames` (Task 3), `envelope` as `ReadonlySignal` (Task 3), decoded once + frame-pure (Tasks 2–3 gates), browser path (Task 4), server path (Task 5), replaces faked meters (Task 4), visual EQ via `bandsAt`/`noveltyAt` (Task 6), free extras — metadata, normalized reads, waveform outline (Task 7). Mixer bus meters: consciously descoped (locked decision 6).
- **Types consistent:** `AudioEnvelope`/`EnvelopeBuilder`/`envelopeRmsAt`/`envelopePeakAt`/`envelopeBandsAt`/`envelopeNoveltyAt`/`envelopeWaveform`/`buildEnvelope`/`fft`/`nextPow2` defined in Tasks 1–2 and 6–7 match every later use; `_timing(fps)` replaces `_ensureDriver`'s inline object; `sampleRateSeen` is introduced in Task 6 and reused in Task 7; Task 7 supersedes the earlier `finish()` return-object snippets by adding fields.
- **No placeholders:** every step carries real code/commands; the one contingency (WAVE decode in vitest) names its exact fallback.
