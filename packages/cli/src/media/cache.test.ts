import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempProject } from "../test/fake-bridge.js";
import { MediaError, mediaKey, projectSource, writeAtomic } from "./cache.js";

let project: ReturnType<typeof tempProject>;

beforeEach(() => {
  project = tempProject();
  mkdirSync(join(project.root, "footage"), { recursive: true });
});

afterEach(() => project.remove());

describe("mediaKey", () => {
  it("keys a source by path, size and modification time", () => {
    const file = join(project.root, "footage", "talk.mp4");
    writeFileSync(file, "one");
    const first = mediaKey(project.root, "footage/talk.mp4");
    expect(first.key).toHaveLength(10);
    expect(mediaKey(project.root, "footage/talk.mp4").key).toBe(first.key);
    writeFileSync(file, "a different body");
    expect(mediaKey(project.root, "footage/talk.mp4").key).not.toBe(first.key);
  });

  it("names the folder after the file", () => {
    writeFileSync(join(project.root, "footage", "My Talk (final).MP4"), "x");
    const k = mediaKey(project.root, "footage/My Talk (final).MP4");
    expect(k.name).toBe("my-talk-final");
    expect(k.dir).toBe(join(project.root, ".smoove", "media", `my-talk-final-${k.key}`));
  });
});

describe("projectSource", () => {
  it("returns the project-relative path of a file inside the project", () => {
    writeFileSync(join(project.root, "footage", "talk.mp4"), "x");
    expect(projectSource(project.root, join(project.root, "footage"), "talk.mp4", "cli")).toBe(
      "footage/talk.mp4",
    );
  });

  it("refuses a file outside the project and names footage_add", () => {
    let thrown: unknown;
    try {
      projectSource(project.root, project.root, "/tmp/elsewhere.mp4", "mcp");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(MediaError);
    expect((thrown as MediaError).code).toBe("not-found");
    expect((thrown as MediaError).message).toContain("the footage_add tool");
  });

  it("expands ~ to the home folder, as a shell would", () => {
    const home = mkdtempSync(join(tmpdir(), "smoove-home-"));
    const saved = process.env.HOME;
    process.env.HOME = home;
    try {
      writeFileSync(join(home, "talk.mp4"), "x");
      expect(() => projectSource(project.root, project.root, "~/talk.mp4", "mcp")).toThrow(
        /the footage_add tool/,
      );
    } finally {
      process.env.HOME = saved;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("names footage_add when there's no such file", () => {
    expect(() => projectSource(project.root, project.root, "footage/none.mp4", "mcp")).toThrow(
      /footage_add/,
    );
  });

  it("refuses a missing file", () => {
    expect(() => projectSource(project.root, project.root, "footage/none.mp4", "cli")).toThrow(
      /footage\/none\.mp4/,
    );
  });
});

describe("writeAtomic", () => {
  it("never leaves a half-written file", () => {
    const p = join(project.root, "out.json");
    writeAtomic(p, "x");
    expect(readdirSync(project.root).filter((f) => f.startsWith("out"))).toEqual(["out.json"]);
  });

  it("creates the folders it needs", () => {
    const p = join(project.root, "a", "b", "c.json");
    writeAtomic(p, "{}");
    expect(readdirSync(join(project.root, "a", "b"))).toEqual(["c.json"]);
  });
});
