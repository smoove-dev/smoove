import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import {
  cacheDir,
  installModel,
  MODELS,
  modelStatus,
  RUNTIME,
  runModels,
  runtimeDir,
  startInstall,
} from "./models.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "smoove-cache-"));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Pretend the runtime is installed, so tests never run npm. */
function fakeRuntime(): void {
  const pkg = join(runtimeDir(dir), "node_modules", RUNTIME.package);
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), "{}");
}

/** Make every parakeet file tiny, so a fake download can satisfy its hash. Returns the undo. */
function tinyModel(body: string): () => void {
  const sha = createHash("sha256").update(body).digest("hex");
  const files = MODELS.parakeet.files;
  const saved = files.map((f) => ({ ...f }));
  for (const f of files) Object.assign(f, { bytes: body.length, sha256: sha });
  return () => {
    for (const [i, f] of files.entries()) Object.assign(f, saved[i]);
  };
}

describe("installing once", () => {
  it("shares one install between calls in a process", async () => {
    fakeRuntime();
    const undo = tinyModel("tiny");
    let fetched = 0;
    const slow = async () => {
      fetched++;
      await new Promise((r) => setTimeout(r, 20));
      return new Response("tiny");
    };
    try {
      await Promise.all([startInstall(dir, "parakeet", slow), startInstall(dir, "parakeet", slow)]);
      expect(fetched).toBe(MODELS.parakeet.files.length);
      expect(modelStatus(dir).find((s) => s.name === "parakeet")?.installed).toBe(true);
    } finally {
      undo();
    }
  });

  it("hands back while it installs", async () => {
    fakeRuntime();
    const undo = tinyModel("tiny");
    const project = tempProject();
    const slow = async () => {
      await new Promise((r) => setTimeout(r, 100));
      return new Response("tiny");
    };
    try {
      const ctx: RunContext = {
        cwd: project.root,
        env: { SMOOVE_CACHE_DIR: dir },
        sleep: async () => {},
        door: "mcp",
        maxWaitMs: 10,
      };
      const result = await runModels(ctx, { install: "parakeet" }, slow);
      expect(result.text).toContain("Still installing parakeet");
      await startInstall(dir, "parakeet", slow);
    } finally {
      undo();
      project.remove();
    }
  });

  it("leaves an install another process is running alone", async () => {
    fakeRuntime();
    mkdirSync(join(dir, "models", "parakeet"), { recursive: true });
    writeFileSync(join(dir, "models", "parakeet", ".install.lock"), String(process.ppid));
    let fetched = 0;
    await expect(
      startInstall(dir, "parakeet", async () => {
        fetched++;
        return new Response("");
      }),
    ).rejects.toThrow(/another process/);
    expect(fetched).toBe(0);
  });
});

describe("models", () => {
  it("lists parakeet as not installed in an empty cache", () => {
    const status = modelStatus(dir);
    const parakeet = status.find((s) => s.name === "parakeet");
    expect(parakeet?.installed).toBe(false);
    expect(parakeet?.bytes).toBe(MODELS.parakeet.files.reduce((a, f) => a + f.bytes, 0));
    expect(parakeet?.languages).toContain("en");
    expect(status.find((s) => s.name === RUNTIME.package)?.installed).toBe(false);
  });

  it("uses SMOOVE_CACHE_DIR when set", () => {
    expect(cacheDir({ SMOOVE_CACHE_DIR: "/tmp/x" })).toBe("/tmp/x");
    expect(cacheDir({})).toBe(join(homedir(), ".cache", "smoove"));
  });

  it("installs only when asked", async () => {
    const project = tempProject();
    let fetched = 0;
    const ctx: RunContext = {
      cwd: project.root,
      env: { SMOOVE_CACHE_DIR: dir },
      sleep: async () => {},
      door: "mcp",
    };
    const result = await runModels(ctx, {}, async () => {
      fetched++;
      return new Response("");
    });
    project.remove();
    expect(fetched).toBe(0);
    expect(result.text).toContain("parakeet");
    expect(result.text).toContain("not installed");
  });

  it("checks every download's hash", async () => {
    fakeRuntime();
    const wrong = async () => new Response("not the model");
    await expect(installModel(dir, "parakeet", () => {}, wrong)).rejects.toThrow(/didn't match/);
    const models = join(dir, "models", "parakeet");
    expect(existsSync(models) ? readdirSync(models) : []).toEqual([]);
  });

  it("reports progress at most once a percent, however the bytes arrive", async () => {
    fakeRuntime();
    const body = "x".repeat(2000);
    const undo = tinyModel(body);
    const chunked = async () =>
      new Response(
        new ReadableStream({
          start(c) {
            for (let i = 0; i < body.length; i++) c.enqueue(new TextEncoder().encode("x"));
            c.close();
          },
        }),
      );
    let calls = 0;
    try {
      await installModel(dir, "parakeet", () => calls++, chunked);
    } finally {
      undo();
    }
    expect(calls).toBeLessThanOrEqual(102);
  });

  it("keeps a download whose hash matches", async () => {
    fakeRuntime();
    const body = "tiny";
    const sha = createHash("sha256").update(body).digest("hex");
    const files = MODELS.parakeet.files;
    const saved = files.map((f) => ({ ...f }));
    for (const f of files) Object.assign(f, { bytes: body.length, sha256: sha });
    try {
      await installModel(
        dir,
        "parakeet",
        () => {},
        async () => new Response(body),
      );
      expect(modelStatus(dir).find((s) => s.name === "parakeet")?.installed).toBe(true);
    } finally {
      for (const [i, f] of files.entries()) Object.assign(f, saved[i]);
    }
  });
});
