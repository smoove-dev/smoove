import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tempProject } from "../test/fake-bridge.js";
import { writeMp4 } from "../test/media-fixtures.js";
import { framesAt } from "./frames.js";

let project: ReturnType<typeof tempProject>;

beforeAll(async () => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
  await writeMp4(join(project.root, "footage/long.mp4"), {
    seconds: 16,
    fps: 10,
    width: 1280,
    height: 720,
    color: (t, x, y) => [(x + t * 40) % 256, (y * 2) % 256, 90],
  });
}, 120_000);

afterAll(() => project.remove());

describe("framesAt", () => {
  it("says which asked-for time each frame answers, even when one has no frame", async () => {
    const got: number[] = [];
    for await (const frame of framesAt(project.root, "footage/long.mp4", [-1, 0.5, 1.5], 32))
      got.push(frame.at);
    expect(got).toEqual([0.5, 1.5]);
  });

  // skia-canvas records every draw call until the context is reset, so a
  // canvas reused frame after frame gets slower with each one.
  it("costs the same per frame at the end as at the start", async () => {
    const times = Array.from({ length: 160 }, (_, i) => i / 10);
    const blocks: number[] = [];
    let t = performance.now();
    let n = 0;
    for await (const _ of framesAt(project.root, "footage/long.mp4", times, 64)) {
      n++;
      if (n % 40 === 0) {
        blocks.push(performance.now() - t);
        t = performance.now();
      }
    }
    expect(n).toBe(160);
    expect(blocks[3] as number).toBeLessThan((blocks[0] as number) * 2.5);
  }, 120_000);
});
