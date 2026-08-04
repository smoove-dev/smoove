import { describe, expect, it } from "vitest";
import { buildSdf, decodeFar, decodeNear, FAR_RANGE, NEAR_RANGE } from "./sdf.js";

/** An RGBA buffer whose alpha is 255 wherever `inside(x, y)` says so. */
function alphaMask(w: number, h: number, inside: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[(y * w + x) * 4 + 3] = inside(x, y) ? 255 : 0;
    }
  }
  return data;
}

describe("buildSdf", () => {
  it("is negative inside and positive outside", () => {
    const w = 64;
    const h = 64;
    // Half plane: inside where x >= 32.
    const field = buildSdf(
      alphaMask(w, h, (x) => x >= 32),
      w,
      h,
    );
    expect(decodeNear(field, w, 40, 32)).toBeLessThan(0);
    expect(decodeNear(field, w, 20, 32)).toBeGreaterThan(0);
  });

  it("reads about zero at the edge", () => {
    const w = 64;
    const h = 64;
    const field = buildSdf(
      alphaMask(w, h, (x) => x >= 32),
      w,
      h,
    );
    // The first pixel inside is one pixel centre from the nearest outside one.
    expect(decodeNear(field, w, 32, 32)).toBeCloseTo(-1, 1);
    expect(decodeNear(field, w, 31, 32)).toBeCloseTo(1, 1);
  });

  it("measures exact euclidean distance, not a chamfer approximation", () => {
    const w = 96;
    const h = 96;
    const field = buildSdf(
      alphaMask(w, h, (x) => x >= 48),
      w,
      h,
    );
    for (const dx of [4, 9, 15]) {
      expect(decodeNear(field, w, 48 - dx, 48)).toBeCloseTo(dx, 0);
    }
  });

  it("is isotropic: a disc's field matches along an axis and a diagonal", () => {
    const w = 128;
    const h = 128;
    const r = 30;
    const field = buildSdf(
      alphaMask(w, h, (x, y) => (x - 64) ** 2 + (y - 64) ** 2 <= r * r),
      w,
      h,
    );
    // 10 px out from the rim, straight up versus at 45 degrees. A chamfer metric
    // is where the diagonal drifts and the fire looks hexagonal.
    const axis = decodeNear(field, w, 64, 64 - (r + 10));
    const diag = decodeNear(
      field,
      w,
      64 + Math.round((r + 10) / Math.SQRT2),
      64 + Math.round((r + 10) / Math.SQRT2),
    );
    expect(Math.abs(axis - diag)).toBeLessThan(1.5);
  });

  it("saturates the near channel but keeps the far one going", () => {
    const w = 160;
    const h = 64;
    const field = buildSdf(
      alphaMask(w, h, (x) => x >= 150),
      w,
      h,
    );
    // 60 px out: past the near range, well inside the far one.
    expect(decodeNear(field, w, 90, 32)).toBeCloseTo(NEAR_RANGE, 0);
    expect(decodeFar(field, w, 90, 32)).toBeCloseTo(60, 0);
    expect(FAR_RANGE).toBeGreaterThan(NEAR_RANGE);
  });

  it("treats half-transparent pixels as inside and fully clear ones as outside", () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 128;
    const field = buildSdf(data, w, h);
    expect(decodeFar(field, w, 16, 16)).toBeLessThan(0);
  });

  it("handles an empty capture without producing NaN", () => {
    const w = 32;
    const h = 32;
    const field = buildSdf(new Uint8ClampedArray(w * h * 4), w, h);
    expect(Number.isFinite(decodeFar(field, w, 16, 16))).toBe(true);
    expect(decodeFar(field, w, 16, 16)).toBeGreaterThan(0);
  });
});
