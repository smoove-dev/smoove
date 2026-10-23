import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CutPlan, TranscriptWord } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type RunContext, UsageError } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { writeWav } from "../test/media-fixtures.js";
import { MAX_RECUT_SEGMENTS, planCuts, runCutPlan } from "./plan.js";

const w = (text: string, start: number, end: number): TranscriptWord => ({ text, start, end });
const f = (frames: number) => frames / 30;

describe("planCuts", () => {
  it("keeps the ranges given, snapped to frames", () => {
    const got = planCuts({ duration: 10, fps: 30, keep: [{ start: 1.01, end: 2.02 }] });
    expect(got.segments).toEqual([{ start: 1, end: f(61) }]);
    expect(got.seconds).toBeCloseTo(f(61) - 1, 3);
  });

  it("keeps labels", () => {
    const got = planCuts({
      duration: 10,
      fps: 30,
      keep: [{ start: 2, end: 3, label: "the hook" }],
    });
    expect(got.segments[0]?.label).toBe("the hook");
  });

  it("removes ranges from the whole", () => {
    const got = planCuts({ duration: 10, fps: 30, remove: [{ start: 2, end: 3 }] });
    expect(got.segments).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 10 },
    ]);
  });

  it("drops the whole filler word, padding or not", () => {
    const got = planCuts({
      duration: 3,
      fps: 30,
      words: [w("so", 0.5, 0.9), w("um", 1.0, 1.3), w("right", 1.4, 1.8)],
      fillers: ["um"],
    });
    expect(got.segments).toEqual([
      { start: 0, end: 1 },
      { start: f(39), end: 3 },
    ]);
  });

  it("drops a short filler squeezed between two words", () => {
    const got = planCuts({
      duration: 3,
      fps: 30,
      words: [w("so", 0.5, 1.0), w("uh", 1.0, 1.2), w("right", 1.2, 1.6)],
      fillers: ["uh"],
    });
    expect(got.segments).toEqual([
      { start: 0, end: 1 },
      { start: f(36), end: 3 },
    ]);
  });

  it("matches fillers whatever their case and punctuation", () => {
    const got = planCuts({
      duration: 3,
      fps: 30,
      words: [w("Um,", 1.0, 1.3)],
      fillers: ["um"],
      pad: 0,
    });
    expect(got.segments).toEqual([
      { start: 0, end: 1 },
      { start: f(39), end: 3 },
    ]);
  });

  it("shortens long pauses to the maximum", () => {
    const got = planCuts({
      duration: 10,
      fps: 30,
      quiet: [{ start: 4, end: 7 }],
      maxPause: 1,
      pad: 0,
    });
    expect(got.segments).toEqual([
      { start: 0, end: 4.5 },
      { start: 6.5, end: 10 },
    ]);
  });

  it("pads both sides of a shortened pause inside a kept range", () => {
    const got = planCuts({
      duration: 10,
      fps: 30,
      keep: [{ start: 0, end: 10 }],
      quiet: [{ start: 4, end: 7 }],
      maxPause: 1,
    });
    expect(got.segments).toEqual([
      { start: 0, end: f(138) },
      { start: f(192), end: 10 },
    ]);
  });

  it("moves a cut out of the middle of a word", () => {
    const got = planCuts({
      duration: 10,
      fps: 30,
      keep: [{ start: 0, end: 1.5 }],
      words: [w("hello", 1.4, 1.8)],
    });
    expect(got.segments[0]?.end).toBeCloseTo(1.8, 6);
    expect(got.warnings).toHaveLength(1);
    expect(got.warnings[0]).toContain("1.5");
    expect(got.warnings[0]).toContain("1.8");
  });

  it("warns about very short segments", () => {
    const got = planCuts({ duration: 10, fps: 30, keep: [{ start: 1, end: 1.2 }] });
    expect(got.warnings.some((x) => x.includes("shorter than half a second"))).toBe(true);
  });

  it("warns when the total misses a target", () => {
    const over = planCuts({ duration: 100, fps: 30, keep: [{ start: 0, end: 70 }], target: 60 });
    expect(over.warnings.some((x) => x.includes("70") && x.includes("60"))).toBe(true);
    const short = planCuts({ duration: 100, fps: 30, keep: [{ start: 0, end: 40 }], target: 60 });
    expect(short.warnings.some((x) => x.includes("40") && x.includes("60"))).toBe(true);
    const fine = planCuts({ duration: 100, fps: 30, keep: [{ start: 0, end: 58 }], target: 60 });
    expect(fine.warnings).toEqual([]);
  });

  it("warns past the segment cap", () => {
    const keep = Array.from({ length: MAX_RECUT_SEGMENTS + 1 }, (_, i) => ({
      start: i * 2,
      end: i * 2 + 1,
    }));
    const got = planCuts({ duration: 200, fps: 30, keep });
    expect(got.warnings.some((x) => x.includes(String(MAX_RECUT_SEGMENTS)))).toBe(true);
  });
});

describe("cut_plan", () => {
  let project: ReturnType<typeof tempProject>;
  const ctx = (): RunContext => ({
    cwd: project.root,
    env: {},
    sleep: async () => {},
    door: "cli",
  });

  beforeEach(() => {
    project = tempProject();
    mkdirSync(join(project.root, "footage"), { recursive: true });
    mkdirSync(join(project.root, "compositions/short"), { recursive: true });
    writeWav(join(project.root, "footage/talk.wav"), {
      seconds: 10,
      loud: [{ start: 0, end: 10 }],
    });
  });

  afterEach(() => project.remove());

  const start = (plan: CutPlan) =>
    writeFileSync(join(project.root, "compositions/short/cuts.json"), JSON.stringify(plan));

  it("refuses a composition without cuts.json", async () => {
    await expect(
      runCutPlan(ctx(), { composition: "short", keep: [{ start: 0, end: 1 }] }),
    ).rejects.toThrow(/smoove new --template recut/);
  });

  it("refuses keep with remove", async () => {
    start({ source: "footage/talk.wav", fps: 30, segments: [{ start: 0, end: 10 }], seconds: 10 });
    await expect(
      runCutPlan(ctx(), {
        composition: "short",
        keep: [{ start: 0, end: 1 }],
        remove: [{ start: 2, end: 3 }],
      }),
    ).rejects.toBeInstanceOf(UsageError);
  });

  it("writes the plan back, keeping its source and frame rate", async () => {
    start({ source: "footage/talk.wav", fps: 25, segments: [{ start: 0, end: 10 }], seconds: 10 });
    const result = await runCutPlan(ctx(), { composition: "short", keep: [{ start: 2, end: 4 }] });
    expect(result.code).toBe(0);
    const plan = JSON.parse(
      readFileSync(join(project.root, "compositions/short/cuts.json"), "utf8"),
    ) as CutPlan;
    expect(plan).toEqual({
      source: "footage/talk.wav",
      fps: 25,
      segments: [{ start: 2, end: 4 }],
      seconds: 2,
    });
  });

  it("uses the source's transcript for fillers", async () => {
    start({ source: "footage/talk.wav", fps: 30, segments: [{ start: 0, end: 10 }], seconds: 10 });
    mkdirSync(join(project.root, "transcripts"));
    writeFileSync(
      join(project.root, "transcripts/talk.json"),
      JSON.stringify({
        source: "footage/talk.wav",
        duration: 10,
        language: "en",
        engine: "local",
        words: [w("uh", 5, 5.5)],
      }),
    );
    await runCutPlan(ctx(), { composition: "short", fillers: ["uh"], pad: 0 });
    const plan = JSON.parse(
      readFileSync(join(project.root, "compositions/short/cuts.json"), "utf8"),
    ) as CutPlan;
    expect(plan.segments).toEqual([
      { start: 0, end: 5 },
      { start: 5.5, end: 10 },
    ]);
  });

  it("says the footage is missing on a fresh clone", async () => {
    start({ source: "footage/gone.mp4", fps: 30, segments: [{ start: 0, end: 10 }], seconds: 10 });
    const result = await runCutPlan(ctx(), { composition: "short", keep: [{ start: 0, end: 1 }] });
    expect(result.code).toBe(1);
    expect((result.answer as { error: { code: string } }).error.code).toBe("not-found");
    expect(result.errors).toContain("footage_add");
  });

  it("needs a transcript to drop fillers", async () => {
    start({ source: "footage/talk.wav", fps: 30, segments: [{ start: 0, end: 10 }], seconds: 10 });
    await expect(runCutPlan(ctx(), { composition: "short", fillers: ["um"] })).rejects.toThrow(
      /transcribe/,
    );
  });
});
