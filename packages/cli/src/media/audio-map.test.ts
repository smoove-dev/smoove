import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AudioMap } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { solid, writeMp4, writeWav } from "../test/media-fixtures.js";
import { mapAudio, readAudioMap, runMediaAudio } from "./audio-map.js";

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

const defaults = { thresholdDb: 20, minQuiet: 0.5, peaks: 10 };

describe("mapAudio", () => {
  it("ranks peaks by how far they stand out", () => {
    const windowHz = 100;
    const seconds = 60;
    const rms = new Float32Array(seconds * windowHz).fill(0.1); // -20 dB
    const burst = (at: number, rmsValue: number) => {
      for (let i = (at - 1) * windowHz; i < (at + 1) * windowHz; i++) rms[i] = rmsValue;
    };
    burst(20, 0.1 * 10 ** (10 / 20));
    burst(40, 0.1 * 10 ** (16 / 20));
    const map = mapAudio({ windowHz, rms, duration: seconds }, { ...defaults, peaks: 1 });
    expect(map.typicalDb).toBeCloseTo(-20, 0);
    expect(map.peaks).toHaveLength(1);
    expect(map.peaks[0]?.time).toBeGreaterThan(39);
    expect(map.peaks[0]?.time).toBeLessThan(41);
    expect(map.peaks[0]?.aboveTypicalDb).toBeCloseTo(16, 0);
  });

  it("keeps peaks at least five seconds apart", () => {
    const windowHz = 100;
    const rms = new Float32Array(30 * windowHz).fill(0.1);
    for (const at of [10, 12]) {
      for (let i = (at - 0.6) * windowHz; i < (at + 0.6) * windowHz; i++) rms[i] = 0.5;
    }
    const map = mapAudio({ windowHz, rms, duration: 30 }, defaults);
    expect(map.peaks).toHaveLength(1);
  });
});

describe("media_audio", () => {
  it("finds the quiet stretch between two loud ones", async () => {
    writeWav(join(project.root, "footage/talk.wav"), {
      seconds: 5,
      loud: [
        { start: 0, end: 2 },
        { start: 3.5, end: 5 },
      ],
    });
    const map = await readAudioMap(project.root, "footage/talk.wav");
    expect(map.quiet).toHaveLength(1);
    expect(map.quiet[0]?.start).toBeCloseTo(2, 1);
    expect(Math.abs((map.quiet[0]?.start ?? 0) - 2)).toBeLessThan(0.02);
    expect(Math.abs((map.quiet[0]?.end ?? 0) - 3.5)).toBeLessThan(0.02);
    expect(map.speech).toHaveLength(2);
    expect(map.speech[0]?.start).toBe(0);
    expect(map.speech[1]?.end).toBeCloseTo(5, 1);
  });

  it("ignores pauses shorter than the minimum", async () => {
    writeWav(join(project.root, "footage/talk.wav"), {
      seconds: 4,
      loud: [
        { start: 0, end: 2 },
        { start: 2.3, end: 4 },
      ],
    });
    const map = await readAudioMap(project.root, "footage/talk.wav");
    expect(map.quiet).toEqual([]);
    expect(map.speech).toHaveLength(1);
  });

  it("treats a silent file as all quiet", async () => {
    writeWav(join(project.root, "footage/silence.wav"), { seconds: 3, loud: [] });
    const map = await readAudioMap(project.root, "footage/silence.wav");
    expect(map.quiet).toHaveLength(1);
    expect(map.quiet[0]?.start).toBe(0);
    expect(map.quiet[0]?.end).toBeCloseTo(3, 1);
    expect(map.speech).toEqual([]);
    expect(map.peaks).toEqual([]);
  });

  it("says there is no audio track", async () => {
    await writeMp4(join(project.root, "footage/silent.mp4"), {
      seconds: 1,
      fps: 10,
      width: 64,
      height: 64,
      color: solid([0, 0, 0]),
    });
    const result = await runMediaAudio(ctx(), { source: "footage/silent.mp4" });
    expect(result.code).toBe(1);
    expect((result.answer as { error: { code: string } }).error.code).toBe("no-audio-track");
    expect(result.errors).toContain("no audio");
  });

  it("writes the full curve to the file and keeps the text short", async () => {
    writeWav(join(project.root, "footage/talk.wav"), {
      seconds: 5,
      loud: [
        { start: 0, end: 2 },
        { start: 3.5, end: 5 },
      ],
    });
    const result = await runMediaAudio(ctx(), { source: "footage/talk.wav" });
    expect(result.code).toBe(0);
    expect(result.text.split("\n").length).toBeLessThanOrEqual(12);
    const path = result.text.match(/\.smoove\/media\/\S+\/audio-map\.json/)?.[0];
    expect(path).toBeDefined();
    const map = JSON.parse(readFileSync(join(project.root, path as string), "utf8")) as AudioMap;
    expect(map.curveHz).toBe(4);
    expect(Math.abs(map.curveDb.length - Math.ceil(5 * 4))).toBeLessThanOrEqual(1);
  });
});
