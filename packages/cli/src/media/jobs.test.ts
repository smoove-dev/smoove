import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { MediaError, mediaKey } from "./cache.js";
import { awaitJob, jobId, readJob, startJob } from "./jobs.js";

let project: ReturnType<typeof tempProject>;
const source = "footage/talk.mp4";

beforeEach(() => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
  writeFileSync(join(project.root, source), "x");
});

afterEach(() => project.remove());

const ctx = (over: Partial<RunContext> = {}): RunContext => ({
  cwd: project.root,
  env: {},
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  door: "mcp",
  ...over,
});

describe("media jobs", () => {
  it("writes progress and the result to the job file", async () => {
    const job = startJob(project.root, "transcribe", source, async (report) => {
      report(0.5, "Half way");
      return ["a.json"];
    });
    const final = await job.promise;
    expect(final.status).toBe("done");
    const read = readJob(project.root, job.id);
    expect(read).not.toBe("stale");
    expect(read).toMatchObject({ status: "done", progress: 1, result: ["a.json"] });
  });

  it("names a job by its kind and its source's cache folder", () => {
    const { name, key } = mediaKey(project.root, source);
    expect(jobId("transcribe", name, key)).toBe(`transcribe.${name}-${key}`);
  });

  it("never joins a job doing other work on the same source", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const first = startJob(
      project.root,
      "media_video",
      source,
      async () => {
        await gate;
        return ["0-10.json"];
      },
      "0-10-4",
    );
    const second = startJob(
      project.root,
      "media_video",
      source,
      async () => ["20-30.json"],
      "20-30-4",
    );
    expect(second.attached).toBe(false);
    expect(second.id).not.toBe(first.id);
    expect((await second.promise).result).toEqual(["20-30.json"]);
    release();
    expect((await first.promise).result).toEqual(["0-10.json"]);
    expect(readJob(project.root, second.id)).toMatchObject({ status: "done" });
  });

  it("attaches to a running job instead of starting another", async () => {
    let runs = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const first = startJob(project.root, "media_video", source, async () => {
      runs++;
      await gate;
      return ["v.json"];
    });
    const second = startJob(project.root, "media_video", source, async () => {
      runs++;
      return [];
    });
    expect(first.attached).toBe(false);
    expect(second.attached).toBe(true);
    expect(second.id).toBe(first.id);
    release();
    const [a, b] = await Promise.all([first.promise, second.promise]);
    expect(runs).toBe(1);
    expect(a.result).toEqual(["v.json"]);
    expect(b.result).toEqual(["v.json"]);
  });

  it("marks a job stale when its process is gone", async () => {
    const { name, key, dir } = mediaKey(project.root, source);
    const id = jobId("transcribe", name, key);
    mkdirSync(join(dir, "jobs"), { recursive: true });
    writeFileSync(
      join(dir, "jobs", "transcribe.json"),
      JSON.stringify({
        id,
        kind: "transcribe",
        source,
        status: "running",
        progress: 0.2,
        message: "",
        pid: 999999,
        started: new Date().toISOString(),
        updated: new Date().toISOString(),
      }),
    );
    expect(readJob(project.root, id)).toBe("stale");
    let ran = false;
    const job = startJob(project.root, "transcribe", source, async () => {
      ran = true;
      return [];
    });
    expect(job.attached).toBe(false);
    await job.promise;
    expect(ran).toBe(true);
  });

  it("records a failure with its code", async () => {
    const job = startJob(project.root, "media_audio", source, async () => {
      throw new MediaError("no-audio-track", "footage/talk.mp4 has no audio track.");
    });
    const final = await job.promise;
    expect(final.status).toBe("error");
    expect(final.error).toEqual({
      code: "no-audio-track",
      message: "footage/talk.mp4 has no audio track.",
    });
  });

  it("reports an attached job whose process died, without an unhandled rejection", async () => {
    const { name, key, dir } = mediaKey(project.root, source);
    const id = jobId("transcribe", name, key);
    mkdirSync(join(dir, "jobs"), { recursive: true });
    const file = join(dir, "jobs", "transcribe.json");
    const now = new Date().toISOString();
    const base = {
      id,
      kind: "transcribe",
      source,
      status: "running",
      progress: 0.1,
      message: "",
      started: now,
      updated: now,
    };
    // Another live process owns it, so this one attaches.
    writeFileSync(file, JSON.stringify({ ...base, pid: process.ppid }));
    const job = startJob(project.root, "transcribe", source, async () => []);
    expect(job.attached).toBe(true);
    // Then that process dies.
    writeFileSync(file, JSON.stringify({ ...base, pid: 999999 }));
    const got = await awaitJob(ctx(), job);
    expect(got).toMatchObject({ status: "error", error: { code: "media-error" } });
  });

  it("knows nothing about a job that never ran", () => {
    expect(readJob(project.root, "transcribe.nothing-0123456789")).toBeNull();
  });

  it("hands back after maxWaitMs", async () => {
    const job = startJob(project.root, "transcribe", source, async () => {
      await new Promise((r) => setTimeout(r, 200));
      return [];
    });
    const got = await awaitJob(ctx({ maxWaitMs: 10 }), job);
    expect(got).toEqual({ handedBack: job.id });
    await job.promise;
  });

  it("waits for the job when there's no limit", async () => {
    const job = startJob(project.root, "transcribe", source, async () => ["t.json"]);
    const got = await awaitJob(ctx(), job);
    expect(got).toMatchObject({ status: "done", result: ["t.json"] });
  });
});
