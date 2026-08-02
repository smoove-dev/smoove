import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDotLottieEngine } from "./dotlottie-engine.js";

const probe = JSON.parse(
  readFileSync(new URL("./fixtures/probe.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

function engine(width = 128, height = 128) {
  return createDotLottieEngine({
    width,
    height,
    data: probe,
    fit: "contain",
    align: [0.5, 0.5],
  });
}

/** Alpha coverage of the middle scanline, plus the leftmost covered column. */
function scanMidRow(buffer: Uint8Array, width: number, height: number) {
  const row = Math.floor(height / 2);
  let covered = 0;
  let firstX = -1;
  for (let x = 0; x < width; x++) {
    if (buffer[(row * width + x) * 4 + 3] > 10) {
      covered++;
      if (firstX < 0) firstX = x;
    }
  }
  return { covered, firstX };
}

describe("dotlottie engine", () => {
  it("loads headlessly and reports the animation's own timing", async () => {
    const e = engine();
    await e.ready;
    expect(e.fps).toBeCloseTo(24, 3);
    expect(e.totalFrames).toBe(48);
    expect(e.duration).toBeCloseTo(2, 2);
    expect(e.intrinsicSize).toEqual({ width: 200, height: 200 });
    expect(e.segment).toEqual([0, 48]);
    e.destroy();
  });

  it("renders an RGBA buffer of exactly the surface size", async () => {
    const e = engine(64, 64);
    await e.ready;
    e.setFrame(0);
    expect(e.buffer?.length).toBe(64 * 64 * 4);
    e.destroy();
  });

  it("moves the square as the frame advances", async () => {
    const e = engine();
    await e.ready;
    e.setFrame(0);
    const start = scanMidRow(e.buffer as Uint8Array, 128, 128);
    e.setFrame(47);
    const end = scanMidRow(e.buffer as Uint8Array, 128, 128);
    expect(start.covered).toBeGreaterThan(0);
    expect(end.firstX).toBeGreaterThan(start.firstX);
    e.destroy();
  });

  it("is deterministic on re-seek", async () => {
    const e = engine();
    await e.ready;
    e.setFrame(12);
    const first = Uint8Array.from(e.buffer as Uint8Array);
    e.setFrame(40);
    e.setFrame(12);
    const second = Uint8Array.from(e.buffer as Uint8Array);
    expect(second).toEqual(first);
    e.destroy();
  });

  it("interpolates fractional frames", async () => {
    const e = engine();
    await e.ready;
    e.setFrame(12);
    const whole = Uint8Array.from(e.buffer as Uint8Array);
    e.setFrame(12.5);
    const half = Uint8Array.from(e.buffer as Uint8Array);
    expect(half).not.toEqual(whole);
    e.destroy();
  });

  it("loads a .lottie archive handed over as bytes", async () => {
    // The demos load plain JSON, so the binary `.lottie` path needs its own
    // coverage: it is a zip the engine unpacks, not something we parse.
    const bytes = readFileSync(new URL("./fixtures/robot.lottie", import.meta.url));
    const e = createDotLottieEngine({
      width: 128,
      height: 128,
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      fit: "contain",
      align: [0.5, 0.5],
    });
    await e.ready;
    expect(e.totalFrames).toBe(180);
    expect(e.fps).toBeCloseTo(30, 3);
    expect(e.intrinsicSize).toEqual({ width: 682, height: 902 });

    e.setFrame(90);
    const buffer = e.buffer as Uint8Array;
    let covered = 0;
    for (let i = 3; i < buffer.length; i += 4) if (buffer[i] > 10) covered++;
    expect(covered).toBeGreaterThan(0);
    e.destroy();
  });

  it("reallocates the surface on resize", async () => {
    const e = engine(64, 64);
    await e.ready;
    e.setFrame(0);
    expect(e.buffer?.length).toBe(64 * 64 * 4);
    e.resize(96, 48);
    e.setFrame(0);
    expect(e.buffer?.length).toBe(96 * 48 * 4);
    e.destroy();
  });
});
