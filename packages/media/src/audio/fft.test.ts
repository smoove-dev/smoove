import { describe, expect, it } from "vitest";
import { fft, nextPow2 } from "./fft.js";

describe("fft", () => {
  it("finds a pure tone in the right bin", () => {
    const n = 512;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    // 16 full cycles over n samples → energy in bin 16.
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 16 * i) / n);
    fft(re, im);
    const mag = (k: number) => Math.hypot(re[k] as number, im[k] as number);
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

describe("nextPow2", () => {
  it("rounds up to powers of two", () => {
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(441)).toBe(512);
    expect(nextPow2(512)).toBe(512);
    expect(nextPow2(513)).toBe(1024);
  });
});
