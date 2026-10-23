import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { solid, writeMp4 } from "../test/media-fixtures.js";
import { readInfo } from "./info.js";
import { runMediaSheet, sheetTimes } from "./sheet.js";

let project: ReturnType<typeof tempProject>;

beforeEach(() => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
});

afterEach(() => project.remove());

const ctx = (): RunContext => ({
  cwd: project.root,
  env: {},
  sleep: async () => {},
  door: "mcp",
});

type Sheet = { data: { image: string; tiles: number[]; tileWidth: number } };

async function pixel(png: string, x: number, y: number): Promise<number[]> {
  const { loadImage, Canvas } = await import("skia-canvas");
  const img = await loadImage(png);
  const c = new Canvas(img.width, img.height);
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  return Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
}

async function imageSize(png: string): Promise<{ width: number; height: number }> {
  const { loadImage } = await import("skia-canvas");
  const img = await loadImage(png);
  return { width: img.width, height: img.height };
}

describe("sheetTimes", () => {
  it("spaces tiles across the file", () => {
    expect(sheetTimes(120, { tiles: 4 })).toEqual([15, 45, 75, 105]);
  });

  it("spaces tiles across a range", () => {
    expect(sheetTimes(120, { tiles: 2, from: 60, to: 80 })).toEqual([65, 75]);
  });

  it("uses exact times when given", () => {
    expect(sheetTimes(10, { at: [12, 3, 1] })).toEqual([1, 3, 9.999]);
  });

  it("defaults to twelve tiles", () => {
    expect(sheetTimes(12, {})).toHaveLength(12);
  });
});

describe("media_sheet", () => {
  it("draws one tile per time with a timecode", async () => {
    await writeMp4(join(project.root, "footage/two.mp4"), {
      seconds: 4,
      fps: 10,
      width: 320,
      height: 180,
      color: (t) => (t < 2 ? [255, 0, 0] : [0, 0, 255]),
    });
    const result = await runMediaSheet(ctx(), { source: "footage/two.mp4", tiles: 2, width: 160 });
    expect(result.code).toBe(0);
    const png = join(project.root, (result.answer as Sheet).data.image);
    expect(await imageSize(png)).toMatchObject({ width: 2 * 160 + 3 * 8 });
    const [r1, g1, b1] = await pixel(png, 8 + 80, 8 + 45);
    expect(r1).toBeGreaterThan(180);
    expect(Math.max(g1 as number, b1 as number)).toBeLessThan(80);
    const [r2, , b2] = await pixel(png, 8 + 160 + 8 + 80, 8 + 45);
    expect(b2).toBeGreaterThan(180);
    expect(r2).toBeLessThan(80);
    expect(result.text).toContain("0:01.0");
    expect(result.text).toContain("0:03.0");
  });

  it("returns the sheet inline", async () => {
    await writeMp4(join(project.root, "footage/one.mp4"), {
      seconds: 2,
      fps: 10,
      width: 64,
      height: 64,
      color: solid([90, 90, 90]),
    });
    const result = await runMediaSheet(ctx(), { source: "footage/one.mp4", tiles: 2 });
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.inline).toBe(true);
    expect(existsSync(result.images[0]?.path as string)).toBe(true);
  });

  it("snaps tiles to keyframes unless exact", async () => {
    await writeMp4(join(project.root, "footage/gop.mp4"), {
      seconds: 8,
      fps: 10,
      width: 64,
      height: 64,
      color: (t) => [Math.round(t * 30), 0, 0],
      keyframeEvery: 2,
    });
    const snapped = await runMediaSheet(ctx(), { source: "footage/gop.mp4", tiles: 4 });
    expect((snapped.answer as Sheet).data.tiles).toEqual([0, 2, 4, 6]);
    const exact = await runMediaSheet(ctx(), { source: "footage/gop.mp4", tiles: 4, exact: true });
    expect((exact.answer as Sheet).data.tiles).toEqual([1, 3, 5, 7]);
  });

  it("draws a rotated phone video upright", async () => {
    // Encoded landscape with a 90 degree rotation: the coded left half is the
    // displayed top half.
    await writeMp4(join(project.root, "footage/phone.mp4"), {
      seconds: 1,
      fps: 10,
      width: 320,
      height: 180,
      color: (_t, x) => (x < 160 ? [0, 220, 0] : [0, 0, 0]),
      rotation: 90,
    });
    const info = await readInfo(project.root, "footage/phone.mp4");
    expect(info).toMatchObject({ width: 180, height: 320, rotation: 90 });
    const result = await runMediaSheet(ctx(), {
      source: "footage/phone.mp4",
      tiles: 2,
      width: 90,
      exact: true,
    });
    const png = join(project.root, (result.answer as Sheet).data.image);
    const [, gTop] = await pixel(png, 8 + 45, 8 + 20);
    const [, gBottom] = await pixel(png, 8 + 45, 8 + 140);
    expect(gTop).toBeGreaterThan(150);
    expect(gBottom).toBeLessThan(60);
  });

  it("says there is no video track", async () => {
    const { writeWav } = await import("../test/media-fixtures.js");
    writeWav(join(project.root, "footage/voice.wav"), { seconds: 1, loud: [] });
    const result = await runMediaSheet(ctx(), { source: "footage/voice.wav" });
    expect((result.answer as { error: { code: string } }).error.code).toBe("no-video-track");
  });
});
