import { describe, expect, it } from "vitest";
import { blit, createSurface, resizeSurface } from "./surface.js";

/** A solid-colour RGBA buffer. */
function fill(width: number, height: number, rgba: [number, number, number, number]) {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) out.set(rgba, i * 4);
  return out;
}

function pixelAt(surface: ReturnType<typeof createSurface>, x: number, y: number) {
  const ctx = surface.canvas.getContext("2d") as CanvasRenderingContext2D;
  return Array.from(ctx.getImageData(x, y, 1, 1).data);
}

describe("surface", () => {
  it("creates a canvas at the requested size", () => {
    const s = createSurface(32, 16);
    expect(s.width).toBe(32);
    expect(s.height).toBe(16);
    expect(s.canvas.width).toBe(32);
    expect(s.canvas.height).toBe(16);
  });

  it("writes RGBA pixels through to the canvas", () => {
    const s = createSurface(8, 8);
    blit(s, fill(8, 8, [255, 0, 0, 255]));
    expect(pixelAt(s, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it("ignores a buffer smaller than the surface rather than tearing", () => {
    const s = createSurface(8, 8);
    blit(s, fill(8, 8, [0, 255, 0, 255]));
    blit(s, new Uint8Array(4));
    expect(pixelAt(s, 4, 4)).toEqual([0, 255, 0, 255]);
  });

  it("reallocates on resize and reports the new size", () => {
    const s = createSurface(8, 8);
    const resized = resizeSurface(s, 16, 4);
    expect(resized.width).toBe(16);
    expect(resized.height).toBe(4);
    expect(resized.canvas.width).toBe(16);
    expect(resized.canvas.height).toBe(4);
  });

  it("returns the same surface when the size is unchanged", () => {
    const s = createSurface(8, 8);
    expect(resizeSurface(s, 8, 8)).toBe(s);
  });

  it("leaves no stale pixels after a resize", () => {
    const s = createSurface(8, 8);
    blit(s, fill(8, 8, [255, 0, 0, 255]));
    const bigger = resizeSurface(s, 16, 16);
    expect(pixelAt(bigger, 12, 12)).toEqual([0, 0, 0, 0]);
  });
});
