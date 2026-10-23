import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { VideoMap } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { writeMp4, writeWav } from "../test/media-fixtures.js";
import { frameStats, runMediaVideo } from "./video-map.js";

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
  door: "cli",
});

/** A pattern that changes every frame, so it is never blank or frozen. */
const noise = (t: number, x: number, y: number): [number, number, number] => {
  const v = (x * 7 + y * 13 + Math.round(t * 10) * 37) % 256;
  return [v, (v * 3) % 256, (v * 5) % 256];
};

const near = (a: number | undefined, b: number) =>
  expect(Math.abs((a ?? Number.NaN) - b)).toBeLessThanOrEqual(0.25);

async function scan(file: string, input: { from?: number; to?: number } = {}): Promise<VideoMap> {
  const result = await runMediaVideo(ctx(), { source: file, rate: 4, ...input });
  expect(result.errors).toBe("");
  return (result.answer as { data: VideoMap }).data;
}

describe("frameStats", () => {
  it("measures luma mean, spread and histogram", () => {
    const rgba = new Uint8ClampedArray(4 * 4).fill(255);
    const s = frameStats(rgba);
    expect(s.mean).toBeCloseTo(1, 3);
    expect(s.std).toBeCloseTo(0, 3);
    expect(s.hist[15]).toBeCloseTo(1, 3);
  });
});

describe("media_video", () => {
  it("finds black and white stretches", async () => {
    await writeMp4(join(project.root, "footage/bw.mp4"), {
      seconds: 6,
      fps: 10,
      width: 64,
      height: 36,
      color: (t, x, y) => (t < 1.5 ? [0, 0, 0] : t < 4 ? noise(t, x, y) : [255, 255, 255]),
    });
    const map = await scan("footage/bw.mp4");
    expect(map.black).toHaveLength(1);
    near(map.black[0]?.start, 0);
    near(map.black[0]?.end, 1.5);
    expect(map.white).toHaveLength(1);
    near(map.white[0]?.start, 4);
    near(map.white[0]?.end, 6);
    expect(map.frozen).toEqual([]);
  });

  it("finds a frozen picture", async () => {
    await writeMp4(join(project.root, "footage/frozen.mp4"), {
      seconds: 5,
      fps: 10,
      width: 64,
      height: 36,
      color: (t, x, y) => (t >= 1 && t < 4 ? [x * 4, y * 7, 128] : noise(t, x, y)),
    });
    const map = await scan("footage/frozen.mp4");
    expect(map.frozen).toHaveLength(1);
    near(map.frozen[0]?.start, 1);
    near(map.frozen[0]?.end, 4);
  });

  it("doesn't call a subject who moves a little frozen", async () => {
    // A still backdrop with a small square drifting across it, like a
    // speaker at a podium: little changes overall, but something always does.
    await writeMp4(join(project.root, "footage/podium.mp4"), {
      seconds: 4,
      fps: 10,
      width: 64,
      height: 36,
      color: (t, x, y) => {
        const left = 10 + Math.round(t * 10);
        return x >= left && x < left + 4 && y >= 14 && y < 20 ? [230, 200, 170] : [60, 70, 80];
      },
    });
    const map = await scan("footage/podium.mp4");
    expect(map.frozen).toEqual([]);
  });

  it("counts a fade out of black as one cut", async () => {
    await writeMp4(join(project.root, "footage/fade.mp4"), {
      seconds: 5,
      fps: 10,
      width: 64,
      height: 36,
      color: (t, x, y) => (t < 2 ? [0, 0, 0] : t < 2.3 ? [70, 70, 70] : noise(t, x, y)),
    });
    const map = await scan("footage/fade.mp4");
    expect(map.shots).toHaveLength(1);
    near(map.shots[0], 2);
  });

  it("finds the cuts between shots", async () => {
    await writeMp4(join(project.root, "footage/shots.mp4"), {
      seconds: 6,
      fps: 10,
      width: 64,
      height: 36,
      color: (t, x) =>
        t < 2 ? [255, 0, 0] : t < 4 ? (x < 32 ? [0, 0, 255] : [255, 255, 0]) : [0, 255, 0],
    });
    const map = await scan("footage/shots.mp4");
    expect(map.shots).toHaveLength(2);
    near(map.shots[0], 2);
    near(map.shots[1], 4);
  });

  it("scans only the range asked for", async () => {
    await writeMp4(join(project.root, "footage/shots.mp4"), {
      seconds: 6,
      fps: 10,
      width: 64,
      height: 36,
      color: (t) => (t < 2 ? [255, 0, 0] : t < 4 ? [0, 0, 255] : [0, 255, 0]),
    });
    const map = await scan("footage/shots.mp4", { from: 2.5, to: 3.5 });
    expect(map).toMatchObject({ from: 2.5, to: 3.5, shots: [] });
  });

  it("says there is no video track", async () => {
    writeWav(join(project.root, "footage/voice.wav"), { seconds: 1, loud: [] });
    const result = await runMediaVideo(ctx(), { source: "footage/voice.wav" });
    expect((result.answer as { error: { code: string } }).error.code).toBe("no-video-track");
  });
});
