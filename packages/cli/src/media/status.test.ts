import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MediaJob } from "@smoove/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { mediaKey } from "./cache.js";
import { jobId } from "./jobs.js";
import { runMediaStatus } from "./status.js";

let project: ReturnType<typeof tempProject>;
let id: string;
let dir: string;

beforeEach(() => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
  writeFileSync(join(project.root, "footage/talk.mp4"), "x");
  const k = mediaKey(project.root, "footage/talk.mp4");
  id = jobId("transcribe", k.name, k.key);
  dir = k.dir;
});

afterEach(() => project.remove());

const ctx = (): RunContext => ({ cwd: project.root, env: {}, sleep: async () => {}, door: "mcp" });

function job(over: Partial<MediaJob>): void {
  mkdirSync(join(dir, "jobs"), { recursive: true });
  const now = new Date().toISOString();
  const base: MediaJob = {
    id,
    kind: "transcribe",
    source: "footage/talk.mp4",
    status: "running",
    progress: 0.42,
    message: "Transcribing (40 percent)",
    pid: process.pid,
    started: now,
    updated: now,
  };
  writeFileSync(join(dir, "jobs", "transcribe.json"), JSON.stringify({ ...base, ...over }));
}

describe("media_status", () => {
  it("reports a running job's progress", async () => {
    job({});
    const r = await runMediaStatus(ctx(), { job: id });
    expect(r.code).toBe(0);
    expect(r.text).toContain("42 percent");
    expect(r.text).toContain("Transcribing (40 percent)");
  });

  it("lists a finished job's files", async () => {
    job({ status: "done", progress: 1, result: ["transcripts/talk.json", "transcripts/talk.txt"] });
    const r = await runMediaStatus(ctx(), { job: id });
    expect(r.text).toContain("done");
    expect(r.text).toContain("transcripts/talk.txt");
  });

  it("reports a failed job's error", async () => {
    job({
      status: "error",
      error: { code: "no-audio-track", message: "footage/talk.mp4 has no audio track." },
    });
    const r = await runMediaStatus(ctx(), { job: id });
    expect(r.code).toBe(1);
    expect((r.answer as { error: { code: string } }).error.code).toBe("no-audio-track");
  });

  it("says when a job's process ended", async () => {
    job({ pid: 999999 });
    const r = await runMediaStatus(ctx(), { job: id });
    expect(r.text).toContain(
      "That job stopped when its process ended. Call the tool again to restart it.",
    );
  });

  it("says when there's no such job", async () => {
    const r = await runMediaStatus(ctx(), { job: "transcribe.nothing-0000000000" });
    expect((r.answer as { error: { code: string } }).error.code).toBe("not-found");
  });
});
