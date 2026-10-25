import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MediaInfo } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { solid, writeJpeg, writeMp4, writeWav } from "../test/media-fixtures.js";
import { mediaKey } from "./cache.js";
import { readInfo, runMediaInfo } from "./info.js";

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

describe("media_info", () => {
  it("reads a video's size, rate, codecs and tracks", async () => {
    await writeMp4(join(project.root, "footage/clip.mp4"), {
      seconds: 2,
      fps: 30,
      width: 320,
      height: 180,
      color: solid([200, 40, 40]),
      audio: { loud: [{ start: 0, end: 2 }] },
    });
    const info = await readInfo(project.root, "footage/clip.mp4");
    expect(info.duration).toBeCloseTo(2, 1);
    expect(info).toMatchObject({
      source: "footage/clip.mp4",
      width: 320,
      height: 180,
      hasVideo: true,
      hasAudio: true,
      videoCodec: "avc",
      audioCodec: "aac",
      rotation: 0,
    });
    expect(info.fps).toBeCloseTo(30, 0);
  });

  it("reads an audio file with no video", async () => {
    writeWav(join(project.root, "footage/voice.wav"), { seconds: 1, loud: [] });
    const info = await readInfo(project.root, "footage/voice.wav");
    expect(info).toMatchObject({ hasVideo: false, hasAudio: true, sampleRate: 16000, channels: 1 });
  });

  it("reports a video with no audio", async () => {
    await writeMp4(join(project.root, "footage/silent.mp4"), {
      seconds: 1,
      fps: 10,
      width: 64,
      height: 64,
      color: solid([0, 0, 0]),
    });
    const info = await readInfo(project.root, "footage/silent.mp4");
    expect(info.hasAudio).toBe(false);
    expect(info.audioCodec).toBeUndefined();
  });

  it("reads a photo at the size it draws, after its rotation tag", async () => {
    mkdirSync(join(project.root, "assets"), { recursive: true });
    await writeJpeg(join(project.root, "assets/couple.jpg"), {
      width: 400,
      height: 300,
      orientation: 6,
    });
    const info = await readInfo(project.root, "assets/couple.jpg");
    expect(info).toMatchObject({
      source: "assets/couple.jpg",
      kind: "image",
      width: 300,
      height: 400,
      shape: "portrait",
      hasVideo: false,
      hasAudio: false,
    });
  });

  it("names a photo's shape in the text", async () => {
    mkdirSync(join(project.root, "assets"), { recursive: true });
    await writeJpeg(join(project.root, "assets/venue.jpg"), { width: 400, height: 300 });
    const result = await runMediaInfo(ctx(), { source: "assets/venue.jpg" });
    expect(result.code).toBe(0);
    expect(result.text).toContain("400 by 300");
    expect(result.text).toContain("landscape");
  });

  it("answers from the cache the second time", async () => {
    writeWav(join(project.root, "footage/voice.wav"), { seconds: 1, loud: [] });
    await runMediaInfo(ctx(), { source: "footage/voice.wav" });
    const { dir } = mediaKey(project.root, "footage/voice.wav");
    const cached = JSON.parse(readFileSync(join(dir, "info.json"), "utf8")) as MediaInfo;
    writeFileSync(join(dir, "info.json"), JSON.stringify({ ...cached, duration: 99 }));
    const again = await runMediaInfo(ctx(), { source: "footage/voice.wav" });
    expect((again.answer as { data: MediaInfo }).data.duration).toBe(99);
  });

  it("keeps the text short", async () => {
    writeWav(join(project.root, "footage/voice.wav"), { seconds: 75, loud: [] });
    const result = await runMediaInfo(ctx(), { source: "footage/voice.wav" });
    expect(result.code).toBe(0);
    expect(result.text.split("\n").length).toBeLessThanOrEqual(6);
    expect(result.text).toContain("1:15");
  });

  it("tells the agent to add a file from outside the project first", async () => {
    const result = await runMediaInfo(ctx(), { source: "/tmp/elsewhere.mp4" });
    expect(result.code).toBe(1);
    expect(result.errors).toContain("smoove agent footage_add");
  });
});
