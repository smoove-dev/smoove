import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunContext } from "../commands.js";
import { tempProject } from "../test/fake-bridge.js";
import { writeWav } from "../test/media-fixtures.js";
import { runFootageAdd } from "./footage.js";

let project: ReturnType<typeof tempProject>;
let outside: string;

beforeEach(() => {
  project = tempProject();
  outside = mkdtempSync(join(tmpdir(), "smoove-outside-"));
});

afterEach(() => {
  project.remove();
  rmSync(outside, { recursive: true, force: true });
});

const ctx = (): RunContext => ({
  cwd: project.root,
  env: {},
  sleep: async () => {},
  door: "mcp",
});

type Added = { data: { source: string; copied: boolean } };

describe("footage_add", () => {
  it("copies an outside file whole into footage/", async () => {
    const original = join(outside, "Talk One.wav");
    writeWav(original, { seconds: 1, loud: [{ start: 0, end: 1 }] });
    const result = await runFootageAdd(ctx(), { path: original });
    expect(result.code).toBe(0);
    const { source, copied } = (result.answer as Added).data;
    expect(source).toBe("footage/Talk One.wav");
    expect(copied).toBe(true);
    expect(readFileSync(join(project.root, source))).toEqual(readFileSync(original));
  });

  it("leaves the original untouched", async () => {
    const original = join(outside, "talk.wav");
    writeWav(original, { seconds: 1, loud: [] });
    const before = { bytes: readFileSync(original), mtime: statSync(original).mtimeMs };
    await runFootageAdd(ctx(), { path: original });
    expect(readFileSync(original)).toEqual(before.bytes);
    expect(statSync(original).mtimeMs).toBe(before.mtime);
  });

  it("adds footage/ to .gitignore once", async () => {
    writeFileSync(join(project.root, ".gitignore"), "node_modules\n.smoove\n");
    const a = join(outside, "a.wav");
    const b = join(outside, "b.wav");
    writeWav(a, { seconds: 1, loud: [] });
    writeWav(b, { seconds: 1, loud: [] });
    await runFootageAdd(ctx(), { path: a });
    await runFootageAdd(ctx(), { path: b });
    const lines = readFileSync(join(project.root, ".gitignore"), "utf8").split("\n");
    expect(lines.filter((l) => l === "footage/")).toHaveLength(1);
    expect(lines.slice(0, 2)).toEqual(["node_modules", ".smoove"]);
  });

  it("uses a file already in the project where it is", async () => {
    mkdirSync(join(project.root, "media"));
    writeWav(join(project.root, "media/clip.wav"), { seconds: 1, loud: [] });
    const result = await runFootageAdd(ctx(), { path: join(project.root, "media/clip.wav") });
    expect((result.answer as Added).data).toEqual({ source: "media/clip.wav", copied: false });
  });

  it("reuses a same-size copy", async () => {
    const original = join(outside, "talk.wav");
    writeWav(original, { seconds: 1, loud: [] });
    await runFootageAdd(ctx(), { path: original });
    const again = await runFootageAdd(ctx(), { path: original });
    expect((again.answer as Added).data).toEqual({ source: "footage/talk.wav", copied: false });
  });

  it("copies a different recording of the same size beside the first", async () => {
    const first = join(outside, "a", "take.wav");
    const second = join(outside, "b", "take.wav");
    mkdirSync(join(outside, "a"));
    mkdirSync(join(outside, "b"));
    writeWav(first, { seconds: 1, loud: [] });
    writeWav(second, { seconds: 1, loud: [{ start: 0, end: 1 }] });
    expect(statSync(first).size).toBe(statSync(second).size);
    await runFootageAdd(ctx(), { path: first });
    const again = await runFootageAdd(ctx(), { path: second });
    expect((again.answer as Added).data).toEqual({ source: "footage/take-2.wav", copied: true });
    expect(readFileSync(join(project.root, "footage/take-2.wav"))).toEqual(readFileSync(second));
  });

  it("refuses a file that isn't media", async () => {
    const fake = join(outside, "notes.mp4");
    writeFileSync(fake, "just some text");
    const result = await runFootageAdd(ctx(), { path: fake });
    expect(result.code).toBe(1);
    expect((result.answer as { error: { code: string } }).error.code).toBe("media-error");
    expect(() => statSync(join(project.root, "footage/notes.mp4"))).toThrow();
  });

  it("takes a path that starts with ~", async () => {
    const saved = process.env.HOME;
    process.env.HOME = outside;
    try {
      writeWav(join(outside, "home.wav"), { seconds: 1, loud: [] });
      const result = await runFootageAdd(ctx(), { path: "~/home.wav" });
      expect((result.answer as Added).data).toEqual({ source: "footage/home.wav", copied: true });
    } finally {
      process.env.HOME = saved;
    }
  });

  it("says when the file doesn't exist", async () => {
    const result = await runFootageAdd(ctx(), { path: join(outside, "missing.mp4") });
    expect((result.answer as { error: { code: string } }).error.code).toBe("not-found");
  });
});
