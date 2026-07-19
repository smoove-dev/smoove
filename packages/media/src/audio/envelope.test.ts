import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildEnvelope,
  EnvelopeBuilder,
  envelopeBandsAt,
  envelopeNoveltyAt,
  envelopePeakAt,
  envelopeRmsAt,
  envelopeWaveform,
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
    b.add(
      gen(1000, 1, () => 0.5),
      1000,
      1,
      1000,
      0,
    );
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
    b.add(
      gen(500, 1, () => 0.5),
      500,
      1,
      1000,
      1.0,
    );
    const env = b.finish();
    expect(envelopeRmsAt(env, 0.5)).toBe(0);
    expect(envelopeRmsAt(env, 1.25)).toBeCloseTo(0.5, 3);
    expect(envelopeRmsAt(env, -1)).toBe(0);
    expect(envelopeRmsAt(env, 99)).toBe(0);
  });

  it("RMS mono-mixes channels but peak sees each channel", () => {
    const b = new EnvelopeBuilder(100, 1);
    // Anti-phase stereo: L = +0.5, R = -0.5 — mono mix cancels, peak doesn't.
    b.add(
      gen(1000, 2, (_i, c) => (c === 0 ? 0.5 : -0.5)),
      1000,
      2,
      1000,
      0,
    );
    const env = b.finish();
    expect(envelopeRmsAt(env, 0.5)).toBeCloseTo(0, 3);
    expect(envelopePeakAt(env, 0.5)).toBeCloseTo(0.5, 3);
  });

  it("grows beyond the expected duration without losing samples", () => {
    const b = new EnvelopeBuilder(100, 0.1); // expect 0.1s, feed 1s
    b.add(
      gen(1000, 1, () => 0.25),
      1000,
      1,
      1000,
      0,
    );
    const env = b.finish();
    expect(env.duration).toBeCloseTo(1, 1);
    expect(envelopeRmsAt(env, 0.9)).toBeCloseTo(0.25, 3);
  });
});

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
    // the invariant (exact index depends on edges). Immediate neighbors carry
    // legitimate Hann leakage at this window size, so only non-adjacent bands
    // must be quiet.
    const rest = [...bands].filter((_, i) => Math.abs(i - top) > 1);
    expect(Math.max(...bands)).toBeGreaterThan(0.2);
    expect(Math.max(...rest)).toBeLessThan(Math.max(...bands) * 0.5);
  });

  it("novelty spikes at an onset and is flat in steady state", () => {
    const sr = 8000;
    const b = new EnvelopeBuilder(100, 1, { bands: 8 });
    // 0.5s silence, then a tone: flux must spike near t=0.5.
    b.add(
      gen(sr, 1, (i) => (i < sr / 2 ? 0 : 0.8 * Math.sin((2 * Math.PI * 440 * i) / sr))),
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

describe("extras", () => {
  it("records metadata and per-clip maxima", () => {
    const b = new EnvelopeBuilder(100, 1);
    b.add(
      gen(1000, 2, () => 0.4),
      1000,
      2,
      1000,
      0,
    );
    const env = b.finish();
    expect(env.sampleRate).toBe(1000);
    expect(env.channels).toBe(2);
    expect(env.maxRms).toBeCloseTo(0.4, 3);
    expect(env.maxPeak).toBeCloseTo(0.4, 3);
  });

  it("tracks signed waveform min/max per window", () => {
    const b = new EnvelopeBuilder(100, 1);
    // Asymmetric signal: rides between -0.2 and +0.8.
    b.add(
      gen(1000, 1, (i) => (i % 2 === 0 ? 0.8 : -0.2)),
      1000,
      1,
      1000,
      0,
    );
    const env = b.finish();
    const wf = envelopeWaveform(env, 0, 1, 10);
    expect(wf.max[5]).toBeCloseTo(0.8, 2);
    expect(wf.min[5]).toBeCloseTo(-0.2, 2);
  });
});

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
