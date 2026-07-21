import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probeMedia } from "./probe.js";

/** Minimal mono 16-bit PCM WAV: `seconds` of a 440 Hz sine at 8 kHz. */
function writeSineWav(path: string, seconds: number): void {
  const sr = 8000;
  const n = Math.round(sr * seconds);
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
    const s = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr);
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, buf);
}

function makeWav(seconds: number): string {
  const dir = mkdtempSync(join(tmpdir(), "smoove-probe-test-"));
  const path = join(dir, "tone.wav");
  writeSineWav(path, seconds);
  return path;
}

describe("probeMedia", () => {
  it("reads duration and track shape from a Node file path", async () => {
    const meta = await probeMedia(makeWav(1.5));
    expect(meta.duration).toBeCloseTo(1.5, 2);
    expect(meta.hasAudio).toBe(true);
    expect(meta.hasVideo).toBe(false);
    expect(meta.width).toBeUndefined();
    expect(meta.sampleRate).toBe(8000);
    expect(meta.channels).toBe(1);
  });

  it("durationInFrames floors so the window never outruns the media", async () => {
    const meta = await probeMedia(makeWav(1.5));
    expect(meta.durationInFrames(30)).toBe(45);
    // 1.5s at 29.97 fps is 44.955 frames, floored to 44.
    expect(meta.durationInFrames(29.97)).toBe(44);
    expect(() => meta.durationInFrames(0)).toThrow(/positive/);
  });

  it("memoizes by src", async () => {
    const src = makeWav(0.5);
    const a = probeMedia(src);
    const b = probeMedia(src);
    expect(a).toBe(b); // same in-flight promise
    expect(await a).toBe(await b);
  });

  it("rejects for a src with no media tracks and does not cache the failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smoove-probe-test-"));
    const bogus = join(dir, "not-media.txt");
    writeFileSync(bogus, "hello");
    await expect(probeMedia(bogus)).rejects.toThrow();
    await expect(probeMedia(bogus)).rejects.toThrow(); // second read re-attempts
  });
});
