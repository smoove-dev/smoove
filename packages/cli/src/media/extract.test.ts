import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type RunContext, UsageError } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { solid, writeMp4 } from "../test/media-fixtures.js";
import { extractAudio, runExtractAudio } from "./extract.js";
import { readInfo } from "./info.js";

let project: ReturnType<typeof tempProject>;

beforeEach(async () => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
  await writeMp4(join(project.root, "footage/talk.mp4"), {
    seconds: 2,
    fps: 10,
    width: 64,
    height: 64,
    color: solid([20, 120, 60]),
    audio: { loud: [{ start: 0, end: 2 }] },
  });
});

afterEach(() => project.remove());

const ctx = (): RunContext => ({
  cwd: project.root,
  env: {},
  sleep: async () => {},
  door: "cli",
});

describe("extract_audio", () => {
  it("writes 16 kHz mono for transcription", async () => {
    const out = await extractAudio(project.root, "footage/talk.mp4", { preset: "transcribe" });
    expect(out).toMatch(/^\.smoove\/media\/talk-[0-9a-f]{10}\/audio-16k\.wav$/);
    const info = await readInfo(project.root, out);
    expect(info).toMatchObject({ hasVideo: false, sampleRate: 16000, channels: 1 });
    expect(Math.abs(info.duration - 2)).toBeLessThan(0.05);
  });

  it("leaves no cache folder for the file it wrote", async () => {
    await runExtractAudio(ctx(), { source: "footage/talk.mp4", preset: "transcribe" });
    const folders = readdirSync(join(project.root, ".smoove/media"));
    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatch(/^talk-/);
  });

  it("trims to a range", async () => {
    const out = await extractAudio(project.root, "footage/talk.mp4", {
      preset: "transcribe",
      from: 0.5,
      to: 1.5,
    });
    expect(out).toMatch(/audio-16k-0\.5-1\.5\.wav$/);
    const info = await readInfo(project.root, out);
    expect(Math.abs(info.duration - 1)).toBeLessThan(0.05);
  });

  it("writes an m4a for the user", async () => {
    const result = await runExtractAudio(ctx(), { source: "footage/talk.mp4" });
    expect(result.code).toBe(0);
    expect(result.text).toContain("talk.m4a");
    const info = await readInfo(project.root, "talk.m4a");
    expect(info).toMatchObject({ hasVideo: false, hasAudio: true, audioCodec: "aac" });
  });

  it("never writes over the source", async () => {
    const before = readFileSync(join(project.root, "footage/talk.mp4"));
    await expect(
      runExtractAudio(ctx(), { source: "footage/talk.mp4", out: "footage/talk.mp4" }),
    ).rejects.toBeInstanceOf(UsageError);
    expect(readFileSync(join(project.root, "footage/talk.mp4"))).toEqual(before);
  });

  it("never writes over another file", async () => {
    const other = join(project.root, "footage/b.mp4");
    writeFileSync(other, "someone's only copy");
    await expect(
      runExtractAudio(ctx(), { source: "footage/talk.mp4", out: "footage/b.mp4" }),
    ).rejects.toThrow(/already/);
    expect(readFileSync(other, "utf8")).toBe("someone's only copy");
  });

  it("never writes over the default name either", async () => {
    writeFileSync(join(project.root, "talk.m4a"), "a separate mic recording");
    await expect(runExtractAudio(ctx(), { source: "footage/talk.mp4" })).rejects.toThrow(/already/);
    expect(readFileSync(join(project.root, "talk.m4a"), "utf8")).toBe("a separate mic recording");
  });

  it("refuses the source by another spelling", async () => {
    await expect(
      runExtractAudio(ctx(), { source: "footage/talk.mp4", out: "footage/TALK.MP4" }),
    ).rejects.toBeInstanceOf(UsageError);
  });

  it("replaces its own earlier file only when asked", async () => {
    await runExtractAudio(ctx(), { source: "footage/talk.mp4" });
    const again = await runExtractAudio(ctx(), { source: "footage/talk.mp4", overwrite: true });
    expect(again.code).toBe(0);
  });

  it("says there is no audio track", async () => {
    await writeMp4(join(project.root, "footage/silent.mp4"), {
      seconds: 1,
      fps: 10,
      width: 64,
      height: 64,
      color: solid([0, 0, 0]),
    });
    const result = await runExtractAudio(ctx(), { source: "footage/silent.mp4" });
    expect((result.answer as { error: { code: string } }).error.code).toBe("no-audio-track");
  });
});
